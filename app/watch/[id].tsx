import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Animated, BackHandler, Dimensions, LayoutChangeEvent, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import Video, { type OnProgressData, type OnLoadData, type OnBufferData, type VideoRef } from "react-native-video";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Brightness from "expo-brightness";
import * as IntentLauncher from "expo-intent-launcher";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { anirakuDownloadUrl, anirakuProxyUrl, getAnimeMetadata, getEpisodes, getServers, getStream, getPlaybackType, isAnirakuProxyUrl, nativePlaybackHeaders, hasDubForEpisode } from "@/lib/aniraku-api";
import { getAnimeById, getKnownMalId, getMalIdByAnimeId } from "@/lib/anilist";
import { enrichEpisodesWithTmdb } from "@/lib/tmdb-episodes";
import {
  activeSkipKind,
  directSources,
  embedSources,
  episodePageCount,
  episodePageFor,
  episodePageSlice,
  hasConfirmedPlaybackStart,
  isAutoQuality,
  isHentaiAnime,
  isProxySource,
  FUTURE_RELEASE_MESSAGE,
  isConfirmedFutureRelease,
  mergeSkipSegments,
  nativeSources,
  normalizeAniSkipSegments,
  providerSkipSegments,
  proxySources,
  shouldPreferEmbed,
  shouldRetryProxiedSourceAfterDirect,
  shouldApplyInitialHistoryResume,
  shouldMountReplacementSource,
  shouldHoldRebufferWatermark,
  type Language,
  type SkipKind,
  type SkipSegments,
} from "@/lib/watch-engine";
import { animeTitle, type Episode, type Server, type StreamResponse, type StreamSource } from "@/lib/types";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useEpisodeRatings } from "@/hooks/use-episode-ratings";
import { AnimeComments } from "@/components/anime-comments";
import { useProviderSync } from "@/hooks/use-provider-sync";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { downloadLabel, findOfflineDownload, removeOfflineDownload, selectMaximumQualityDownload, shareOfflineDownload, startMaximumQualityDownload, type OfflineDownload } from "@/lib/downloads";
import { adaptiveBitrateCapOptions, selectedWatchQuality, watchQualityOptions, type WatchQualityOption } from "@/lib/watch-quality";
import { AppIcon } from "@/components/app-icon";
import { EmbedPlayer } from "@/components/embed-player";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { SubtitleRenderer } from "@/components/subtitle-renderer";
import { SleepTimer, SleepTimerPill } from "@/components/sleep-timer";
import { chrome } from "@/components/player/chrome-styles";
import { parseSubtitle, detectSubtitleFormat, detectSubtitleFormatFromContent, findActiveCues, matchSubtitleTrack, type SubtitleCue } from "@/lib/subtitle-parser";
import { loadSubtitlePreferences, saveSubtitlePreferences, type SubtitlePreferences } from "@/lib/subtitle-preferences";

const EPISODE_PAGE_SIZE = 50;
const RESUME_MIN_TIME = 30;
const STREAM_CACHE_TTL_MS = 30_000;
const STARTUP_WATCHDOG_MS = 6_000;
const SKIP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ANISKIP_TIMEOUT_MS = 8_000;
const EMPTY_EPISODES: Episode[] = [];

type CachedStream = { savedAt: number; data: StreamResponse };
type WatchPreferences = { autoNext?: boolean; autoSkip?: boolean; speed?: number };

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function streamCacheKey(provider: Server, episode: number) {
  return `aniraku-watch-stream:${provider.id}:${episode}`;
}

function skipCacheKey(malId: number, episode: number) {
  return `aniraku-skip-v2:${malId}:${episode}`;
}

export default function WatchScreen() {
  const params = useLocalSearchParams<{ id: string; episode?: string; title?: string; image?: string }>();
  const animeId = Number(params.id);
  const episode = Math.max(1, Number(params.episode ?? "1"));
  const animeQuery = useQuery({
    queryKey: ["watch-anime", animeId],
    queryFn: async () => { try { return await getAnimeMetadata(animeId); } catch { return getAnimeById(animeId); } },
    enabled: Number.isFinite(animeId) && animeId > 0,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const title = params.title || (animeQuery.data ? animeTitle(animeQuery.data) : "Aniraku stream");
  const image = params.image || animeQuery.data?.coverImage?.extraLarge || animeQuery.data?.coverImage?.large || "";
  const watchBackdrop = animeQuery.data?.bannerImage || image;
  const auth = useAnirakuAuth();
  const history = useWatchHistory();
  const ratings = useEpisodeRatings(animeId);
  const providerSync = useProviderSync();
  const episodeQuery = useQuery({ queryKey: ["watch-episodes", animeId], queryFn: () => getEpisodes(animeId), enabled: Number.isFinite(animeId) && animeId > 0, staleTime: 60_000 });
  const canonicalEpisodes = episodeQuery.data ?? EMPTY_EPISODES;
  const episodeSignature = useMemo(() => canonicalEpisodes.map((item) => `${item.number}:${item.title ?? ""}:${item.thumbnail ?? ""}`).join("|"), [canonicalEpisodes]);
  const tmdbEpisodes = useQuery({
    queryKey: ["tmdb-episode-display", animeId, episodeSignature, watchBackdrop, title, animeQuery.data?.format],
    queryFn: () => enrichEpisodesWithTmdb(animeId, canonicalEpisodes, { fallbackThumbnail: watchBackdrop, fallbackTitle: title, isMovie: animeQuery.data?.format === "MOVIE" }),
    enabled: Number.isFinite(animeId) && animeId > 0 && episodeQuery.isSuccess && canonicalEpisodes.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const displayEpisodes = tmdbEpisodes.data ?? canonicalEpisodes;
  const selectedEpisode = displayEpisodes.find((item) => item.number === episode);
  const episodeIsKnown = useMemo(() => canonicalEpisodes.some((item) => item.number === episode), [canonicalEpisodes, episode]);
  const invalidEpisode = Boolean(episodeQuery.isSuccess && canonicalEpisodes.length && !episodeIsKnown);
  const futureRelease = isConfirmedFutureRelease({
    episodeNumber: episode,
    episodes: canonicalEpisodes,
    status: animeQuery.data?.status,
    nextAiringEpisode: animeQuery.data?.nextAiringEpisode,
    hasConfirmedEpisodeList: episodeQuery.isSuccess && canonicalEpisodes.length > 0,
  });
  // Hentai titles have no direct/proxy streams — route them to embedded WebView.
  const isHentai = useMemo(
    () => isHentaiAnime({ isAdult: animeQuery.data?.isAdult, genres: animeQuery.data?.genres }),
    [animeQuery.data?.isAdult, animeQuery.data?.genres],
  );
  useKeepAwake("aniraku-watch");

  // ── Player state (react-native-video) ──
  const videoRef = useRef<VideoRef>(null);
  const [playerStatus, setPlayerStatus] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playableDuration, setPlayableDuration] = useState(0);
  const [videoTracks, setVideoTracks] = useState<any[]>([]);

  // ── App state ──
  const [language, setLanguage] = useState<Language>("sub");

  // ── Per-episode dub availability check ──
  useEffect(() => {
    if (language !== "dub" || !episodeQuery.isSuccess || !canonicalEpisodes.length || !Number.isFinite(animeId)) {
      setDubEpisodeSet(new Set());
      setDubCheckPending(false);
      return;
    }
    const unchecked = canonicalEpisodes.filter((ep) => !dubEpisodeSet.has(ep.number));
    if (!unchecked.length) return;
    let cancelled = false;
    setDubCheckPending(true);
    const batch = unchecked.slice(0, 5);
    Promise.all(batch.map((ep) => hasDubForEpisode(animeId, ep.number).then((has) => (has ? ep.number : null)))).then((results) => {
      if (cancelled) return;
      setDubEpisodeSet((prev) => {
        const next = new Set(prev);
        for (const num of results) { if (num !== null) next.add(num); }
        return next;
      });
      setDubCheckPending(false);
    }).catch(() => { if (!cancelled) setDubCheckPending(false); });
    return () => { cancelled = true; };
  }, [language, animeId, canonicalEpisodes, episodeQuery.isSuccess]);

  const [providers, setProviders] = useState<Record<Language, Server[]>>({ sub: [], dub: [] });
  const [serverIndex, setServerIndex] = useState(0);
  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [source, setSource] = useState<StreamSource | null>(null);
  const [embedSource, setEmbedSource] = useState<StreamSource | null>(null);
  const [useSourceProxy, setUseSourceProxy] = useState(false);
  const [playbackHeaders, setPlaybackHeaders] = useState<Record<string, string> | undefined>();
  const [loadingServers, setLoadingServers] = useState(true);
  const [serverAttempt, setServerAttempt] = useState(0);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [autoNext, setAutoNext] = useState(true);
  const [autoSkip, setAutoSkip] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [manualFullscreen, setManualFullscreen] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [episodePage, setEpisodePage] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [dragPct, setDragPct] = useState<number | null>(null);
  const [skipSegments, setSkipSegments] = useState<SkipSegments>({ intro: null, outro: null });
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [offlineDownload, setOfflineDownload] = useState<OfflineDownload | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [requestedQuality, setRequestedQuality] = useState("auto");
  const [adaptiveBitrateCap, setAdaptiveBitrateCap] = useState<number | null>(null);
  const [subtitlePrefs, setSubtitlePrefs] = useState<SubtitlePreferences | null>(null);
  const [activeSubtitles, setActiveSubtitles] = useState<SubtitleCue[]>([]);
  const [rotationLocked, setRotationLocked] = useState(false);
  const [orientationLocked, setOrientationLocked] = useState(false);
  const [playerLocked, setPlayerLocked] = useState(false);
  const [lastPlayerError, setLastPlayerError] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<{ type: "language" | "title" | "index"; value?: string | number } | undefined>(undefined);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [is2xSeeking, setIs2xSeeking] = useState(false);
  const [doubleTapSide, setDoubleTapSide] = useState<"left" | "right" | null>(null);
  const doubleTapAnim = useRef(new Animated.Value(0)).current;
  const [dubEpisodeSet, setDubEpisodeSet] = useState<Set<number>>(new Set());
  const [dubCheckPending, setDubCheckPending] = useState(false);
  const [volumeHud, setVolumeHud] = useState<number | null>(null);
  const [brightnessHud, setBrightnessHud] = useState<number | null>(null);
  const [volume, setVolume] = useState(1.0);
  const [brightness, setBrightness] = useState(0.5);
  const lockedSpeed = useRef(1);
  const holdSpeedRestore = useRef<number | null>(null);
  const markedComplete = useRef(false);
  const sleepFired = useRef(false);

  // Do NOT force landscape on load — the inline player must stay inline until
  // the user taps fullscreen. Forcing LANDSCAPE here rotated the whole
  // activity on first frame, which looked like "tap opens fullscreen with no UI"
  // (controls start hidden, so the rotated video showed nothing).
  // Fullscreen is entered explicitly via enterFullscreen() only.
  useEffect(() => () => { if (Platform.OS !== "web") void ScreenOrientation.unlockAsync().catch(() => {}); }, []);

  const toggleOrientationLock = useCallback(() => {
    setOrientationLocked((prev) => {
      const next = !prev;
      if (Platform.OS !== "web") {
        if (next) void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
        else void ScreenOrientation.unlockAsync().catch(() => {});
      }
      return next;
    });
  }, []);

  const streamCache = useRef(new Map<string, CachedStream>());
  const blockedProviders = useRef(new Set<string>());
  const refreshAttempted = useRef(new Set<string>());
  const forceRefresh = useRef(false);
  const sourceStarted = useRef(false);
  const sourceFirstFrame = useRef(false);
  const sourceMounted = useRef(false);
  const sourceAttempt = useRef(0);
  const sourceFailureHandled = useRef<string | null>(null);
  const lastHistorySync = useRef(0);
  const lastProviderSync = useRef(0);
  const autoSkipped = useRef<Record<SkipKind, boolean>>({ intro: false, outro: false });
  const skipSegmentsRef = useRef(skipSegments);
  const pendingResume = useRef<number | null>(null);
  const historyResumeRequestedFor = useRef<string | null>(null);
  const initialHistoryResumeApplied = useRef(false);
  const activeProviderId = useRef<string | null>(null);
  const lastStablePlaybackTime = useRef(0);
  const rebufferSeen = useRef(false);
  const intentionalSeekUntil = useRef(0);
  const adaptiveCapSourceUrl = useRef<string | null>(null);

  const activeProviders = providers[language] ?? [];
  const activeProvider = activeProviders[serverIndex];
  const { filteredEpisodes, totalEpisodePages, safeEpisodePage, pagedEpisodes } = useMemo(() => {
    const term = episodeSearch.trim().toLowerCase();
    let filtered = term
      ? displayEpisodes.filter((item) => String(item.number).includes(term) || String(item.title || "").toLowerCase().includes(term))
      : displayEpisodes;
    // When dub tab is active, only show episodes that have dub available
    if (language === "dub" && dubEpisodeSet.size > 0) {
      filtered = filtered.filter((item) => dubEpisodeSet.has(item.number));
    }
    const pageCount = episodePageCount(filtered.length);
    const safePage = Math.max(0, Math.min(episodePage, pageCount - 1));
    return { filteredEpisodes: filtered, totalEpisodePages: pageCount, safeEpisodePage: safePage, pagedEpisodes: episodePageSlice(filtered, safePage) };
  }, [displayEpisodes, episodePage, episodeSearch, language, dubEpisodeSet]);

  const sourceQualityOptions = useMemo(() => watchQualityOptions(stream, source), [source, stream]);
  const adaptiveCapOptions = useMemo(() => adaptiveBitrateCapOptions(source, videoTracks), [videoTracks, source]);
  const activeAdaptiveCap = adaptiveCapOptions.find((option) => option.maxVideoBitrate === adaptiveBitrateCap);
  const displayedQuality = activeAdaptiveCap?.label ?? selectedWatchQuality(source, requestedQuality);
  const maximumDownloadSource = useMemo(() => selectMaximumQualityDownload(stream?.sources ?? activeProvider?.sources ?? []), [activeProvider?.sources, stream?.sources]);
  const backendDownloads = activeProvider?.downloads ?? [];
  const currentRating = ratings.scoreFor(episode) ?? 0;
  const skipKind = activeSkipKind(skipSegments, currentTime);

  // ── Subtitle loading ──
  useEffect(() => { loadSubtitlePreferences().then(setSubtitlePrefs).catch(() => {}); }, []);

  const parsedCuesRef = useRef<SubtitleCue[]>([]);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;

  const updateSubtitlePrefs = useCallback((patch: Partial<SubtitlePreferences>) => {
    setSubtitlePrefs((prev) => {
      const next = { enabled: prev?.enabled ?? true, preferredLanguage: prev?.preferredLanguage ?? "en", ...patch };
      void saveSubtitlePreferences(next).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    if (!source?.subtitles?.length || !subtitlePrefs) { parsedCuesRef.current = []; setActiveSubtitles([]); return; }
    const preferred = matchSubtitleTrack(source.subtitles, subtitlePrefs.preferredLanguage) ?? source.subtitles[0];
    if (!preferred?.url) { parsedCuesRef.current = []; setActiveSubtitles([]); return; }
    const urlFormat = detectSubtitleFormat(preferred.url);
    const subtitleUrl = preferred.url.includes("/api/v1/proxy?") ? preferred.url : anirakuProxyUrl(preferred.url, nativePlaybackHeaders(playbackHeaders));
    let cancelled = false;
    const directHeaders = nativePlaybackHeaders(playbackHeaders);
    fetch(subtitleUrl, directHeaders && !preferred.url.includes("/api/v1/proxy?") ? { headers: { ...directHeaders, Accept: "*/*" } } : undefined)
      .then((r) => {
        if (!r.ok) throw new Error(`subtitle ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled || !text.trim()) {
          if (!cancelled) { parsedCuesRef.current = []; setActiveSubtitles([]); }
          return;
        }
        const format = urlFormat ?? detectSubtitleFormatFromContent(text);
        const parsed = parseSubtitle(text, format);
        if (cancelled) return;
        parsedCuesRef.current = parsed.cues;
        setActiveSubtitles(findActiveCues(parsed.cues, currentTimeRef.current));
      }).catch(() => { if (!cancelled) { parsedCuesRef.current = []; setActiveSubtitles([]); } });
    return () => { cancelled = true; };
  }, [source?.url, source?.subtitles, subtitlePrefs?.preferredLanguage, playbackHeaders]);

  useEffect(() => {
    if (parsedCuesRef.current.length) {
      setActiveSubtitles(findActiveCues(parsedCuesRef.current, currentTime));
    } else if (currentTimeRef.current !== currentTime) {
      // Keep ref in sync even before cues load.
    }
  }, [currentTime]);

  // ── Effects ──
  useEffect(() => {
    let active = true;
    void findOfflineDownload(animeId, episode, language).then((entry) => { if (active) setOfflineDownload(entry); }).catch(() => { if (active) setOfflineDownload(null); });
    return () => { active = false; };
  }, [animeId, episode, language]);

  useEffect(() => {
    if (episodeSearch.trim()) { setEpisodePage(0); return; }
    setEpisodePage(episodePageFor(episode));
  }, [episode, episodeSearch]);

  useEffect(() => {
    lastStablePlaybackTime.current = 0;
    rebufferSeen.current = false;
    intentionalSeekUntil.current = 0;
    initialHistoryResumeApplied.current = false;
  }, [source?.url, sourceRevision]);

  useEffect(() => {
    const reportedTime = currentTime;
    const intentionalSeek = Date.now() < intentionalSeekUntil.current;
    if (buffering) rebufferSeen.current = true;
    if (shouldHoldRebufferWatermark({ lastStableTime: lastStablePlaybackTime.current, reportedTime, wasBuffering: rebufferSeen.current, playbackStarted: sourceStarted.current, intentionalSeek })) return;
    if (intentionalSeek || reportedTime >= lastStablePlaybackTime.current - 0.05) {
      lastStablePlaybackTime.current = reportedTime;
      if (!buffering) rebufferSeen.current = false;
    }
  }, [buffering, currentTime]);

  useEffect(() => { skipSegmentsRef.current = skipSegments; }, [skipSegments]);

  const applySkipSegments = useCallback((incoming: SkipSegments) => {
    setSkipSegments((current) => mergeSkipSegments(current, incoming));
  }, []);

  const clearEpisodePlayback = useCallback(() => {
    videoRef.current?.pause();
    setStream(null);
    setSource(null);
    setEmbedSource(null);
    setLastPlayerError(null);
    markedComplete.current = false;
    setUseSourceProxy(false);
    setPlaybackHeaders(undefined);
    setSkipSegments({ intro: null, outro: null });
    autoSkipped.current = { intro: false, outro: false };
    blockedProviders.current.clear();
    refreshAttempted.current.clear();
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    sourceMounted.current = false;
    sourceFailureHandled.current = null;
    lastStablePlaybackTime.current = 0;
    rebufferSeen.current = false;
    intentionalSeekUntil.current = 0;
    pendingResume.current = null;
    setResumePosition(null);
  }, []);

  const handleProviderBlocked = useCallback((reason: "player" | "stream" | "startup" | "permanent" = "player") => {
    const current = activeProviders[serverIndex];
    if (!current) return;
    if (reason !== "permanent" && !refreshAttempted.current.has(current.id)) {
      refreshAttempted.current.add(current.id);
      forceRefresh.current = true;
      sourceStarted.current = false;
      sourceFirstFrame.current = false;
      sourceMounted.current = false;
      sourceFailureHandled.current = null;
      setLoadingStream(true);
      setRefreshNonce((value) => value + 1);
      return;
    }
    // No direct / proxy sources from this provider — try the next server.
    blockedProviders.current.add(current.id);
    const next = activeProviders.findIndex((p, i) => i !== serverIndex && !blockedProviders.current.has(p.id));
    if (next >= 0) {
      sourceStarted.current = false;
      sourceFirstFrame.current = false;
      sourceMounted.current = false;
      sourceFailureHandled.current = null;
      setLoadingStream(true);
      setServerIndex(next);
      return;
    }
    // ALL servers exhausted — mount the first verified embed, if any.
    if (!embedSource) {
      // Check both the stream response (which has enriched sources) and the
      // provider's initial sources from getServers (which may already carry
      // embed sources from the backend).
      const embedCandidates = embedSources(stream ?? { sources: current.sources ?? [] });
      const fallbackEmbed = embedCandidates[0] ?? embedSources({ sources: current.sources ?? [] })[0];
      if (fallbackEmbed) {
        videoRef.current?.pause();
        sourceStarted.current = false;
        sourceFirstFrame.current = false;
        sourceFailureHandled.current = null;
        setSource(null);
        setEmbedSource(fallbackEmbed);
        setLoadingStream(false);
        setShowSourcePicker(false);
        return;
      }
    }
    setLoadingStream(false);
    setError(
      isHentai
        ? "This title plays via embedded player only. No embed source responded — try again shortly."
        : "We don't have a working stream for this episode right now.",
    );
  }, [activeProviders, serverIndex, embedSource, stream, isHentai]);

  const handleProviderBlockedRef = useRef(handleProviderBlocked);
  useEffect(() => { handleProviderBlockedRef.current = handleProviderBlocked; }, [handleProviderBlocked]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem("aniraku.watch.preferences").then((stored) => {
      if (!active || !stored) return;
      try {
        const preferences = JSON.parse(stored) as WatchPreferences;
        if (typeof preferences.autoNext === "boolean") setAutoNext(preferences.autoNext);
        if (typeof preferences.autoSkip === "boolean") setAutoSkip(preferences.autoSkip);
        if (typeof preferences.speed === "number" && [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(preferences.speed)) setSpeed(preferences.speed);
      } catch { /* ignore malformed */ }
    }).catch(() => {}).finally(() => { if (active) setPreferencesReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
      void AsyncStorage.setItem("aniraku.watch.preferences", JSON.stringify({ autoNext, autoSkip, speed })).catch(() => {});
  }, [autoNext, autoSkip, preferencesReady, speed]);

  // ── Server discovery ──
  useEffect(() => {
    let cancelled = false;
    clearEpisodePlayback();
    setProviders({ sub: [], dub: [] });
    setLanguage("sub");
    setServerIndex(0);
    setLoadingServers(true);
    setServerAttempt(0);
    setLoadingStream(false);
    setError(null);
    if (episodeQuery.isPending || animeQuery.isPending) return;
    if (futureRelease) { setLoadingServers(false); setError(FUTURE_RELEASE_MESSAGE); return; }
    if (invalidEpisode) { setLoadingServers(false); setError(`Episode ${episode} is not available.`); return; }

    const fetchServers = async (attempt: number) => {
      setServerAttempt(attempt + 1);
      const [subs, dubs] = await Promise.all([
        getServers(animeId, episode, "sub").catch(() => [] as Server[]),
        getServers(animeId, episode, "dub").catch(() => [] as Server[]),
      ]);
      if (cancelled) return;
      setProviders({ sub: subs, dub: dubs });
      setLoadingServers(false);
      if (!subs.length && dubs.length) setLanguage("dub");
      if (!subs.length && !dubs.length) setError("We don't have streaming for this episode.");
    };
    void fetchServers(0);
    return () => { cancelled = true; };
  }, [animeId, animeQuery.isPending, canonicalEpisodes.length, clearEpisodePlayback, episode, episodeQuery.isPending, futureRelease, invalidEpisode]);

  // ── Stream loading ──
  useEffect(() => {
    if (futureRelease || !activeProvider) return;
    let cancelled = false;
    const providerId = activeProvider.id;
    activeProviderId.current = providerId;
    const initial: StreamResponse = { sources: activeProvider.sources ?? [], headers: activeProvider.headers };
    const initialDirect = directSources(initial);
    const initialProxies = proxySources(initial);
    const initialEmbeds = embedSources(initial);
    // Capture mount state at effect start to avoid stale reads across async boundary
    const alreadyMounted = sourceMounted.current;
    const forceThisRequest = forceRefresh.current;
    forceRefresh.current = false;
    const hasInitial = initialDirect.length > 0 || initialProxies.length > 0;
    const preferEmbed = shouldPreferEmbed({
      isHentai,
      directCount: initialDirect.length,
      proxyCount: initialProxies.length,
      embedCount: initialEmbeds.length,
    });

    setError(null);
    // Embed mounts immediately only for Hentai. For normal titles the embed
    // player is the last resort after ALL servers return null, so a
    // native-less first provider must not stick an embed before other
    // servers are even tried.
    const mountEmbedImmediately = preferEmbed && initialEmbeds.length > 0 && isHentai;
    if ((hasInitial || mountEmbedImmediately) && !alreadyMounted && !forceThisRequest) {
      setStream(initial);
      setPlaybackHeaders(activeProvider.headers);
      // Direct → proxy → embed fallback (embed immediately for Hentai only)
      if (mountEmbedImmediately) {
        sourceMounted.current = true;
        setSource(null);
        setEmbedSource(initialEmbeds[0]);
        setSourceRevision((v) => v + 1);
      } else if (initialDirect.length) {
        sourceMounted.current = true;
        setSource(initialDirect[0]);
        setUseSourceProxy(false);
        setSourceRevision((v) => v + 1);
      } else if (initialProxies.length) {
        sourceMounted.current = true;
        setSource(initialProxies[0]);
        setUseSourceProxy(true);
        setSourceRevision((v) => v + 1);
      }
      applySkipSegments(providerSkipSegments(initial));
      setLoadingStream(false);
    } else if (!hasInitial && !mountEmbedImmediately) {
      setLoadingStream(true);
    }

    const cacheKey = streamCacheKey(activeProvider, episode);
    const cached = streamCache.current.get(cacheKey);
    if (!forceThisRequest && cached && Date.now() - cached.savedAt < STREAM_CACHE_TTL_MS) {
      const cachedDirect = directSources(cached.data);
      const cachedProxies = proxySources(cached.data);
      const cachedEmbeds = embedSources(cached.data);
      const preferCachedEmbed = shouldPreferEmbed({
        isHentai,
        directCount: cachedDirect.length,
        proxyCount: cachedProxies.length,
        embedCount: cachedEmbeds.length,
      });
      const mountCachedEmbed = preferCachedEmbed && cachedEmbeds.length > 0 && isHentai;
      if (!alreadyMounted && (cachedDirect.length || cachedProxies.length || mountCachedEmbed)) {
        setStream(cached.data);
        setPlaybackHeaders(cached.data.headers ?? activeProvider.headers);
        // Embed from cache mounts only for Hentai. For normal titles the next
        // server is tried first via handleProviderBlocked.
        if (mountCachedEmbed) {
          sourceMounted.current = true;
          setSource(null);
          setEmbedSource(cachedEmbeds[0]);
          setSourceRevision((v) => v + 1);
        } else if (cachedDirect.length) {
          sourceMounted.current = true;
          setSource(cachedDirect[0]);
          setUseSourceProxy(false);
          setSourceRevision((v) => v + 1);
        } else if (cachedProxies.length) {
          sourceMounted.current = true;
          setSource(cachedProxies[0]);
          setUseSourceProxy(true);
          setSourceRevision((v) => v + 1);
        }
        applySkipSegments(providerSkipSegments(cached.data));
        setLoadingStream(false);
      }
    }

    void getStream({ animeId, episode, provider: activeProvider.provider, lang: language, refresh: forceThisRequest })
      .then((response) => {
        if (cancelled || activeProviderId.current !== providerId) return;
        const refreshedDirect = directSources(response);
        const refreshedProxies = proxySources(response);
        const refreshedEmbeds = embedSources(response);
        const preferRefreshedEmbed = shouldPreferEmbed({
          isHentai,
          directCount: refreshedDirect.length,
          proxyCount: refreshedProxies.length,
          embedCount: refreshedEmbeds.length,
        });
        const hasNative = refreshedDirect.length > 0 || refreshedProxies.length > 0;
        if (!hasNative) {
          // No direct/proxy from this provider — cache the response so
          // handleProviderBlocked can read embed sources from `stream`.
          streamCache.current.set(cacheKey, { savedAt: Date.now(), data: response });
          setStream(response);
          handleProviderBlockedRef.current("stream");
          return;
        }
        streamCache.current.set(cacheKey, { savedAt: Date.now(), data: response });
        setStream(response);
        applySkipSegments(providerSkipSegments(response));
        if (shouldMountReplacementSource(sourceMounted.current, forceThisRequest)) {
          sourceMounted.current = true;
          setPlaybackHeaders(response.headers ?? activeProvider.headers);
          if (refreshedDirect.length) {
            setSource(refreshedDirect[0]);
            setUseSourceProxy(false);
          } else {
            setSource(refreshedProxies[0]);
            setUseSourceProxy(true);
          }
          setSourceRevision((v) => v + 1);
        }
        setLoadingStream(false);
      })
      .catch(() => {
        if (cancelled || activeProviderId.current !== providerId) return;
        if (!hasInitial || forceThisRequest) handleProviderBlockedRef.current("stream");
      });
    return () => { cancelled = true; };
  }, [activeProvider, animeId, applySkipSegments, episode, futureRelease, isHentai, language, refreshNonce]);

  // ── Source loading with direct → proxy fallback ──
  useEffect(() => {
    if (!source) return;
    sourceFailureHandled.current = null;
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    const attempt = ++sourceAttempt.current;
    const directHeaders = nativePlaybackHeaders(playbackHeaders);
    // Video source: try direct, proxy already handled by useSourceProxy state
    const watchdog = setTimeout(() => {
      if (sourceAttempt.current !== attempt || sourceStarted.current) return;
      if (shouldRetryProxiedSourceAfterDirect(useSourceProxy, sourceStarted.current)) {
        setUseSourceProxy(true);
        setSourceRevision((v) => v + 1);
        return;
      }
      handleProviderBlockedRef.current("startup");
    }, STARTUP_WATCHDOG_MS);
    return () => clearTimeout(watchdog);
  }, [source?.url, sourceRevision, useSourceProxy]);

  useEffect(() => {
    const sourceUrl = source?.url ?? null;
    if (adaptiveCapSourceUrl.current !== sourceUrl) {
      adaptiveCapSourceUrl.current = sourceUrl;
      if (adaptiveBitrateCap !== null) setAdaptiveBitrateCap(null);
      return;
    }
  }, [adaptiveBitrateCap, source]);

  useEffect(() => {
    if (hasConfirmedPlaybackStart({ isPlaying, currentTime, firstFrameRendered: sourceFirstFrame.current })) sourceStarted.current = true;
    const pendingPosition = pendingResume.current;
    if (shouldApplyInitialHistoryResume({
      currentTime, hasPendingResume: Boolean(pendingPosition && pendingPosition > RESUME_MIN_TIME),
      isPlaying, resumeAppliedForSource: initialHistoryResumeApplied.current, status: playerStatus,
    })) {
      initialHistoryResumeApplied.current = true;
      videoRef.current?.seek(pendingPosition!);
      pendingResume.current = null;
      setResumePosition(null);
    }
  }, [currentTime, isPlaying, playerStatus]);

  useEffect(() => {
    if (playerStatus !== "error" || !source?.url || sourceFailureHandled.current === source.url) return;
    if (!useSourceProxy) { setUseSourceProxy(true); setSourceRevision((v) => v + 1); return; }
    sourceFailureHandled.current = source.url;
    handleProviderBlockedRef.current("player");
  }, [source?.url, playerStatus, useSourceProxy]);

  // ── Skip segments (AniSkip) ──
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const resolveMalId = async () => {
      const metadataMalId = getKnownMalId(animeQuery.data);
      if (metadataMalId) return metadataMalId;
      const cacheKey = `aniraku-watch-mal:${animeId}`;
      const stored = await AsyncStorage.getItem(cacheKey).catch(() => null);
      const cached = Number(stored);
      if (Number.isFinite(cached) && cached > 0) return cached;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const resolved = await getMalIdByAnimeId(animeId);
          if (resolved) { void AsyncStorage.setItem(cacheKey, String(resolved)).catch(() => {}); return resolved; }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
      }
      return null;
    };
    void resolveMalId().then(async (malId) => {
      if (!malId || cancelled) return;
      const key = skipCacheKey(malId, episode);
      const stored = await AsyncStorage.getItem(key).catch(() => null);
      if (stored) {
        const cached = JSON.parse(stored) as { savedAt?: number; segments?: SkipSegments | null };
        if (cached.savedAt && Date.now() - cached.savedAt < SKIP_CACHE_TTL_MS) {
          if (!cancelled && cached.segments) applySkipSegments(cached.segments);
          return;
        }
      }
      const timeout = setTimeout(() => controller.abort(), ANISKIP_TIMEOUT_MS);
      // Pass the real runtime when known — episodeLength=0 makes AniSkip miss
      // entries it would otherwise return (then 404, handled below).
      const runtime = duration > 0 ? Math.round(duration) : 0;
      const response = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types%5B%5D=op&types%5B%5D=ed&episodeLength=${runtime}`, { headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      if (!response.ok) { void AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), segments: null })).catch(() => {}); return; }
      const segments = normalizeAniSkipSegments(await response.json());
      if (cancelled) return;
      applySkipSegments(segments);
      void AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), segments: segments.intro || segments.outro ? segments : null })).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; controller.abort(); };
  }, [animeId, animeQuery.data, applySkipSegments, duration, episode]);

  // ── History resume ──
  useEffect(() => {
    if (!history.history.isSuccess) return;
    const historyKey = `${animeId}:${episode}`;
    if (historyResumeRequestedFor.current === historyKey) return;
    historyResumeRequestedFor.current = historyKey;
    setResumePosition(null);
    pendingResume.current = null;
    const entry = history.history.data?.find((item) => item.anime_id === animeId && item.episode_number === episode);
    if (entry && entry.progress > RESUME_MIN_TIME && entry.duration && entry.progress < entry.duration - 10) {
      pendingResume.current = entry.progress;
      setResumePosition(entry.progress);
    }
  }, [animeId, episode, history.history.data, history.history.isSuccess]);

  // Local resume fallback for logged-out users (Anilab parity).
  useEffect(() => {
    if (auth.user || !Number.isFinite(animeId) || animeId <= 0) return;
    const historyKey = `local:${animeId}:${episode}`;
    if (historyResumeRequestedFor.current === historyKey) return;
    historyResumeRequestedFor.current = historyKey;
    void AsyncStorage.getItem(`aniraku-watch-local:${animeId}:${episode}`).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as { progress?: number; duration?: number };
        const progress = Number(parsed.progress);
        const total = Number(parsed.duration);
        if (Number.isFinite(progress) && progress > RESUME_MIN_TIME && Number.isFinite(total) && progress < total - 10) {
          pendingResume.current = progress;
          setResumePosition(progress);
        }
      } catch {}
    }).catch(() => {});
  }, [animeId, auth.user, episode]);

  // Anonymous progress is also remembered locally while watching.
  useEffect(() => {
    if (auth.user || !source || currentTime < 1 || duration <= 0 || currentTime - lastHistorySync.current < 10) return;
    lastHistorySync.current = currentTime;
    void AsyncStorage.setItem(`aniraku-watch-local:${animeId}:${episode}`, JSON.stringify({ progress: currentTime, duration, savedAt: Date.now() })).catch(() => {});
  }, [animeId, auth.user, currentTime, duration, episode, source]);

  // ── History sync ──
  useEffect(() => {
    if (!auth.user || !source || currentTime < 1 || duration <= 0 || currentTime - lastHistorySync.current < 10) return;
    lastHistorySync.current = currentTime;
    history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, progress: currentTime, duration });
  }, [animeId, auth.user, currentTime, duration, episode, history.save, image, source, title]);

  useEffect(() => {
    if (!auth.user || !source || currentTime < 1 || duration <= 0 || providerSync.connected.length === 0 || currentTime - lastProviderSync.current < 90) return;
    lastProviderSync.current = currentTime;
    providerSync.pushProgress.mutate({ animeId, episode, progress: Math.floor(currentTime), status: "watching" });
  }, [animeId, auth.user, currentTime, duration, episode, providerSync.connected.length, providerSync.pushProgress, source]);

  // Sleep countdown owned by the screen so it survives settings close. The
  // boolean deps keep a single interval alive instead of recreating it per tick.
  const sleepIdle = sleepRemaining === null;
  const sleepDone = sleepRemaining === 0;
  useEffect(() => {
    if (sleepIdle || sleepDone) {
      if (sleepDone && !sleepFired.current) {
        sleepFired.current = true;
        setIsPlaying(false);
        videoRef.current?.pause();
      }
      return;
    }
    sleepFired.current = false;
    const id = setInterval(() => {
      setSleepRemaining((prev) => (prev === null || prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [sleepIdle, sleepDone]);

  // 90% auto-mark-as-completed (Anilab parity): exiting at 95% without
  // reaching onEnd previously recorded nothing.
  useEffect(() => {
    if (!source || duration <= 0 || currentTime <= 0 || markedComplete.current) return;
    if (currentTime / duration < 0.9) return;
    markedComplete.current = true;
    if (auth.user) {
      history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, progress: currentTime, duration });
      if (providerSync.connected.length) providerSync.pushProgress.mutate({ animeId, episode, progress: Math.floor(currentTime), status: "completed" });
    } else {
      void AsyncStorage.setItem(`aniraku-watch-local:${animeId}:${episode}`, JSON.stringify({ progress: currentTime, duration, completed: true, savedAt: Date.now() })).catch(() => {});
    }
  }, [animeId, auth.user, currentTime, duration, episode, history.save, image, providerSync.connected.length, providerSync.pushProgress, source, title]);

  // ── Auto-skip ──
  useEffect(() => {
    if (!skipKind || !autoSkip) return;
    const interval = skipSegments[skipKind];
    if (!interval || autoSkipped.current[skipKind]) return;
    autoSkipped.current[skipKind] = true;
    videoRef.current?.seek(interval.endTime);
  }, [skipKind, skipSegments, autoSkip]);

  // ── Video source URL ──
  // Backend stream URLs are already proxied (/api/v1/proxy?...). Those must
  // play as-is — re-wrapping yields a proxy-of-proxy URL the backend rejects
  // with 403 ("proxy target not allowed") → Exo BAD_HTTP_STATUS.
  const videoSourceUri = useMemo(() => {
    if (!source) return undefined;
    if (isAnirakuProxyUrl(source.url)) return source.url;
    const directHeaders = nativePlaybackHeaders(playbackHeaders);
    if (useSourceProxy) return anirakuProxyUrl(source.url, directHeaders);
    return source.url;
  }, [source?.url, useSourceProxy, playbackHeaders]);

  const videoSourceHeaders = useMemo(() => {
    if (useSourceProxy) return undefined;
    if (source && isAnirakuProxyUrl(source.url)) return undefined;
    return nativePlaybackHeaders(playbackHeaders);
  }, [useSourceProxy, playbackHeaders, source?.url]);

  const videoContentType = useMemo(() => {
    if (!source) return undefined;
    const t = getPlaybackType(source);
    return t === "hls" ? "m3u8" : t === "dash" ? "mpd" : undefined;
  }, [source?.url]);

  // Real ExoPlayer LoadControl — replaces the old "120s reserve / 20s cushion"
  // claims with actual buffering behavior on the shipped player.
  const videoBufferConfig = useMemo(() => ({
    minBufferMs: 15_000,
    maxBufferMs: 120_000,
    bufferForPlaybackMs: 2_500,
    bufferForPlaybackAfterRebufferMs: 5_000,
  }), []);

  // ── Actions ──
  const selectLanguage = (next: Language) => {
    if (!providers[next].length || next === language) return;
    // Stash current position so the new source re-seeks here after load
    if (currentTime > 0 && duration > 0) {
      pendingResume.current = currentTime;
    }
    videoRef.current?.pause();
    blockedProviders.current.clear();
    refreshAttempted.current.clear();
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    sourceMounted.current = false;
    markedComplete.current = false;
    sourceFailureHandled.current = null;
    activeProviderId.current = null;
    setStream(null);
    setSource(null);
    setEmbedSource(null);
    setLastPlayerError(null);
    setUseSourceProxy(false);
    setPlaybackHeaders(undefined);
    setLoadingStream(true);
    setLanguage(next);
    setServerIndex(0);
    setError(null);
  };

  const selectServer = (index: number) => {
    // Stash current position so the new source re-seeks here after load
    if (currentTime > 0 && duration > 0) {
      pendingResume.current = currentTime;
    }
    // Reset the mount flag or the new provider's stream resolves but never
    // mounts (permanent spinner) — this stalled every manual server switch.
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    sourceMounted.current = false;
    markedComplete.current = false;
    sourceFailureHandled.current = null;
    videoRef.current?.pause();
    setSource(null);
    setEmbedSource(null);
    setLastPlayerError(null);
    setUseSourceProxy(false);
    setAdaptiveBitrateCap(null);
    setLoadingStream(true);
    setShowSourcePicker(false);
    setShowServerModal(false);
    setShowSettings(false);
    if (index === serverIndex) {
      forceRefresh.current = true;
      setRefreshNonce((v) => v + 1);
    } else {
      setServerIndex(index);
    }
    setError(null);
  };

  const selectQuality = (next: StreamSource) => {
    sourceMounted.current = true;
    setAdaptiveBitrateCap(null);
    setEmbedSource(null);
    setSource(next);
    setUseSourceProxy(isProxySource(next));
    setSourceRevision((v) => v + 1);
    setPlaybackHeaders(stream?.headers ?? activeProvider?.headers);
    setRequestedQuality(isAutoQuality(next) ? "auto" : next.quality || "auto");
    setShowQualityPicker(false);
    setShowQualityModal(false);
    setShowSettings(false);
  };

  const selectAdaptiveQuality = async (choice: WatchQualityOption) => {
    if (!activeProvider || !source) return;
    if (choice.isAdaptiveCap) {
      if (!isAutoQuality(source)) return;
      setAdaptiveBitrateCap(choice.maxVideoBitrate ?? null);
      setRequestedQuality("auto");
      setShowQualityPicker(false);
      setShowQualityModal(false);
      setShowSettings(false);
      return;
    }
    if (choice.source) { selectQuality(choice.source); return; }
    if (choice.requestQuality === "auto" && isAutoQuality(source)) { setRequestedQuality("auto"); setShowQualityPicker(false); setShowQualityModal(false); setShowSettings(false); return; }
    try {
      setLoadingStream(true);
      const response = await getStream({ animeId, episode, provider: activeProvider.provider, lang: language, quality: choice.requestQuality });
      const replacement = nativeSources(response)[0];
      if (!replacement) throw new Error("This provider did not return that quality.");
      setStream(response);
      applySkipSegments(providerSkipSegments(response));
      setPlaybackHeaders(response.headers ?? activeProvider.headers);
      setRequestedQuality(choice.requestQuality);
      selectQuality(replacement);
    } catch (cause) {
      setDownloadMessage(cause instanceof Error ? cause.message.toUpperCase() : "QUALITY COULD NOT BE CHANGED.");
      setLoadingStream(false);
    }
  };

  const markIntentionalSeek = (target?: number) => {
    intentionalSeekUntil.current = Date.now() + 1_500;
    if (typeof target === "number" && Number.isFinite(target)) lastStablePlaybackTime.current = target;
  };

  const seek = (seconds: number) => {
    const target = Math.max(0, duration > 0 ? Math.min(duration, currentTime + seconds) : currentTime + seconds);
    markIntentionalSeek(target);
    videoRef.current?.seek(target);
  };

  const seekBy = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(duration, currentTime + seconds));
    intentionalSeekUntil.current = Date.now() + 1000;
    videoRef.current?.seek(next);
    setCurrentTime(next);
  }, [currentTime, duration]);

  const seekTo = useCallback((targetSeconds: number) => {
    if (duration > 0) {
      const target = Math.max(0, Math.min(duration, targetSeconds));
      markIntentionalSeek(target);
      videoRef.current?.seek(target);
    } else {
      markIntentionalSeek(Math.max(0, targetSeconds));
      videoRef.current?.seek(Math.max(0, targetSeconds));
    }
  }, [duration]);

  // th3-anime style hold-for-2x: remember the pre-hold speed and restore it.
  const beginHoldSpeed = useCallback(() => {
    if (holdSpeedRestore.current === null) {
      holdSpeedRestore.current = speed;
      setSpeed(2);
    }
  }, [speed]);
  const endHoldSpeed = useCallback(() => {
    if (holdSpeedRestore.current !== null) {
      setSpeed(holdSpeedRestore.current);
      holdSpeedRestore.current = null;
    }
  }, []);

  // ── PanResponder gesture handler (replaces GestureLayer component) ──
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const singleTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (singleTapTimeout.current) clearTimeout(singleTapTimeout.current);
      if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
    };
  }, []);
  const gestureStartY = useRef(0);
  const currentBrightnessVal = useRef(0.5);
  const currentVolumeVal = useRef(1.0);

  const triggerDoubleTapAnimation = useCallback((side: "left" | "right") => {
    setDoubleTapSide(side);
    doubleTapAnim.setValue(0);
    Animated.sequence([
      Animated.timing(doubleTapAnim, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(doubleTapAnim, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== "web" }),
    ]).start(() => setDoubleTapSide(null));
  }, [doubleTapAnim]);

  const seekRelative = useCallback((deltaSeconds: number) => {
    setCurrentTime((curr) => {
      const next = Math.max(0, Math.min(duration || 999999, curr + deltaSeconds));
      markIntentionalSeek(next);
      videoRef.current?.seek(next);
      return next;
    });
  }, [duration, markIntentionalSeek]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 12,
        onPanResponderGrant: (_evt, gesture) => {
          gestureStartY.current = gesture.y0;
          currentBrightnessVal.current = brightness;
          currentVolumeVal.current = volume;
          longPressTimeout.current = setTimeout(() => {
            if (!playerLocked) {
              setIs2xSeeking(true);
              beginHoldSpeed();
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
          }, 450);
        },
        onPanResponderMove: (_evt, gesture) => {
          if (playerLocked) return;
          if (Math.abs(gesture.dy) > 10 && longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
          }
          const screenWidth = Dimensions.get("window").width;
          const delta = -gesture.dy / 250;
          if (gesture.x0 < screenWidth / 2) {
            const newBrightness = Math.max(0, Math.min(1, currentBrightnessVal.current + delta));
            setBrightness(newBrightness);
            setBrightnessHud(Math.round(newBrightness * 100));
            if (Platform.OS !== "web") Brightness.setBrightnessAsync(newBrightness).catch(() => {});
          } else {
            const newVol = Math.max(0, Math.min(1, currentVolumeVal.current + delta));
            setVolume(newVol);
            setVolumeHud(Math.round(newVol * 100));
          }
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (longPressTimeout.current) { clearTimeout(longPressTimeout.current); longPressTimeout.current = null; }
          if (is2xSeeking) { setIs2xSeeking(false); endHoldSpeed(); }
          setTimeout(() => { setVolumeHud(null); setBrightnessHud(null); }, 800);
          if (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) {
            const now = Date.now();
            const { locationX } = _evt.nativeEvent;
            const screenWidth = Dimensions.get("window").width;
            if (lastTapRef.current && now - lastTapRef.current.time < 300 && Math.abs(locationX - lastTapRef.current.x) < 80) {
              if (singleTapTimeout.current) clearTimeout(singleTapTimeout.current);
              lastTapRef.current = null;
              if (!playerLocked) {
                if (locationX < screenWidth / 2) { seekRelative(-10); triggerDoubleTapAnimation("left"); }
                else { seekRelative(10); triggerDoubleTapAnimation("right"); }
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
            } else {
              lastTapRef.current = { time: now, x: locationX };
              singleTapTimeout.current = setTimeout(() => { setShowControls((prev) => !prev); lastTapRef.current = null; }, 300);
            }
          }
        },
      }),
    [brightness, is2xSeeking, playerLocked, seekRelative, volume, beginHoldSpeed, endHoldSpeed, triggerDoubleTapAnimation],
  );

  const skip = (kind: SkipKind) => {
    const target = skipSegments[kind]?.endTime;
    if (target) { markIntentionalSeek(target); videoRef.current?.seek(target); }
  };

  const retry = () => {
    if (!activeProvider) return;
    blockedProviders.current.delete(activeProvider.id);
    refreshAttempted.current.delete(activeProvider.id);
    forceRefresh.current = true;
    sourceMounted.current = false;
    setEmbedSource(null);
    setLastPlayerError(null);
    setError(null);
    setRefreshNonce((v) => v + 1);
  };

  const startDownload = async () => {
    if (!maximumDownloadSource) { setDownloadMessage("DIRECT SOURCE REQUIRED FOR DOWNLOAD."); return; }
    try {
      setDownloadMessage(null);
      setDownloadProgress(0);
      const entry = await startMaximumQualityDownload({ animeId, episode, language, title, source: maximumDownloadSource, headers: stream?.headers ?? activeProvider?.headers, onProgress: setDownloadProgress });
      setOfflineDownload(entry);
      setDownloadMessage(`${entry.quality.toUpperCase()} SAVED.`);
    } catch (cause) {
      setDownloadMessage(cause instanceof Error ? cause.message.toUpperCase() : "DOWNLOAD FAILED.");
    } finally { setDownloadProgress(null); }
  };

  const openDownloadLink = () => {
    if (!maximumDownloadSource) return;
    const url = anirakuDownloadUrl(maximumDownloadSource.url, nativePlaybackHeaders(stream?.headers ?? activeProvider?.headers));
    if (Platform.OS === "android") {
      IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: url }).catch(() => {});
    }
  };

  const playOffline = () => {
    if (!offlineDownload) return;
    videoRef.current?.pause();
    sourceMounted.current = true;
    setPlaybackHeaders(undefined);
    setUseSourceProxy(false);
    setSource({ url: offlineDownload.uri, quality: `${offlineDownload.quality} · SAVED`, type: "native" });
    setSourceRevision((v) => v + 1);
    setShowSettings(false);
    setDownloadMessage("PLAYING SAVED COPY.");
  };

  const removeDownload = async () => {
    if (!offlineDownload) return;
    await removeOfflineDownload(offlineDownload);
    setOfflineDownload(null);
    setDownloadMessage("SAVED COPY REMOVED.");
  };

  const goToEpisode = useCallback((targetEpisode: number) => {
    if (!canonicalEpisodes.some((item) => item.number === targetEpisode)) return;
    router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(targetEpisode), title, image } } as never);
  }, [animeId, canonicalEpisodes, image, title]);

  const openEpisodeInfo = useCallback((targetEpisode = episode) => {
    const selected = displayEpisodes.find((item) => item.number === targetEpisode);
    router.push({ pathname: "/episode/[id]", params: { id: String(animeId), episode: String(targetEpisode), title, image, episodeTitle: selected?.title || "" } } as never);
  }, [animeId, displayEpisodes, episode, image, title]);

  const { nextKnownEpisode, previousKnownEpisode } = useMemo(() => {
    let next: number | undefined;
    let previous: number | undefined;
    for (const item of canonicalEpisodes) {
      if (item.number > episode && (next === undefined || item.number < next)) next = item.number;
      if (item.number < episode && (previous === undefined || item.number > previous)) previous = item.number;
    }
    return { nextKnownEpisode: next, previousKnownEpisode: previous };
  }, [canonicalEpisodes, episode]);

  const nextEpisode = useCallback(() => { if (nextKnownEpisode) goToEpisode(nextKnownEpisode); }, [goToEpisode, nextKnownEpisode]);

  // ── Swipe between episodes ──
  const swipeOffsetX = useRef(new Animated.Value(0)).current;
  const swipeAnimating = useRef(false);

  const episodeSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderMove: (_, gestureState) => {
          if (swipeAnimating.current) return;
          const clamped = Math.max(-120, Math.min(120, gestureState.dx));
          swipeOffsetX.setValue(clamped);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (swipeAnimating.current) return;
          const dx = gestureState.dx;
          const shouldAdvance = dx < -50 && Boolean(nextKnownEpisode);
          const shouldGoBack = dx > 50 && Boolean(previousKnownEpisode);
          if (!shouldAdvance && !shouldGoBack) {
            Animated.spring(swipeOffsetX, { toValue: 0, useNativeDriver: true }).start();
            return;
          }
          swipeAnimating.current = true;
          const offscreen = dx < 0 ? -Dimensions.get("window").width : Dimensions.get("window").width;
          Animated.timing(swipeOffsetX, { toValue: offscreen, duration: 180, useNativeDriver: true }).start(() => {
            swipeOffsetX.setValue(0);
            swipeAnimating.current = false;
            if (shouldAdvance && nextKnownEpisode) {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              goToEpisode(nextKnownEpisode);
            } else if (shouldGoBack && previousKnownEpisode) {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              goToEpisode(previousKnownEpisode);
            }
          });
        },
      }),
    [nextKnownEpisode, previousKnownEpisode, goToEpisode, swipeOffsetX],
  );

  const swipeDirectionHint = useMemo(() => {
    if (!nextKnownEpisode && !previousKnownEpisode) return null;
    if (nextKnownEpisode && !previousKnownEpisode) return `Next: EP ${nextKnownEpisode}`;
    if (!nextKnownEpisode && previousKnownEpisode) return `Prev: EP ${previousKnownEpisode}`;
    return `EP ${previousKnownEpisode} ← → EP ${nextKnownEpisode}`;
  }, [nextKnownEpisode, previousKnownEpisode]);

  const seekFromBar = (event: { nativeEvent: { locationX: number } }) => {
    if (duration > 0 && progressWidth > 0) {
      const target = Math.max(0, Math.min(duration, (event.nativeEvent.locationX / progressWidth) * duration));
      markIntentionalSeek(target);
      videoRef.current?.seek(target);
    }
    setDragPct(null);
  };

  const onBarTouchMove = (event: { nativeEvent: { locationX: number } }) => {
    if (duration > 0 && progressWidth > 0) {
      setDragPct(Math.max(0, Math.min(100, (event.nativeEvent.locationX / progressWidth) * 100)));
    }
  };

  const onBarTouchStart = () => { setDragPct(progressPct); };

  const enterFullscreen = useCallback(() => {
    // Close every overlay so fullscreen never opens with a hidden-behind-modal
    // state, and force chrome visible — opening with showControls=false looked
    // like "fullscreen has no controls".
    setShowSettings(false);
    setShowSpeedModal(false);
    setShowSubtitleModal(false);
    setShowQualityModal(false);
    setShowServerModal(false);
    setShowChapterList(false);
    setShowSourcePicker(false);
    setShowQualityPicker(false);
    setShowControls(true);
    setManualFullscreen(true);
    if (Platform.OS !== "web") void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  const exitFullscreen = useCallback(() => {
    setManualFullscreen(false);
    // Keep chrome visible on exit so the inline player never looks dead.
    setShowControls(true);
    if (Platform.OS !== "web") void ScreenOrientation.unlockAsync().catch(() => {});
  }, []);

  const enterPiP = useCallback(() => {
    if (Platform.OS === "web") return;
    try { videoRef.current?.enterPictureInPicture(); } catch {}
  }, []);

  useEffect(() => {
    if (!manualFullscreen || Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { exitFullscreen(); return true; });
    return () => subscription.remove();
  }, [manualFullscreen, exitFullscreen]);

  useEffect(() => {
    if (!source || !showControls || showSettings || showSourcePicker || showQualityPicker) return;
    const timer = setTimeout(() => setShowControls(false), 3_500);
    return () => clearTimeout(timer);
  }, [showControls, showSettings, showSourcePicker, showQualityPicker, manualFullscreen, currentTime, source?.url]);

  const onProgressLayout = (event: LayoutChangeEvent) => setProgressWidth(event.nativeEvent.layout.width);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const buffered = duration > 0 && playableDuration > 0 ? Math.min(100, (playableDuration / duration) * 100) : 0;

  const displayedQualityOptions: WatchQualityOption[] = source
    ? (adaptiveCapOptions.length ? adaptiveCapOptions : sourceQualityOptions)
    : sourceQualityOptions.map((item) => ({ id: item.id, label: item.label, requestQuality: item.requestQuality, source: item.source }));

  const selectedSubtitleUrl = useMemo(
    () => (source?.subtitles?.length && subtitlePrefs?.enabled ? matchSubtitleTrack(source.subtitles, subtitlePrefs.preferredLanguage)?.url ?? null : null),
    [source?.subtitles, subtitlePrefs?.enabled, subtitlePrefs?.preferredLanguage],
  );

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferPct = duration > 0 && playableDuration > 0 ? Math.min(100, (playableDuration / duration) * 100) : 0;

  return <NativeScreen scroll={false} style={styles.fill}>
    <StatusBar hidden={manualFullscreen} />

    {/* ── Video Container + Gesture Layer ── */}
    {/* NOTE: panHandlers live on the sibling overlay below, NOT on this parent.
        Parent-level onStartShouldSetPanResponder stole Pressable touches and the
        native Video SurfaceView eats touches aimed behind it. */}
    <View style={[styles.videoShell, manualFullscreen && ps.videoShellFullscreen]}>
      {embedSource && !source ? <EmbedPlayer uri={embedSource.url} headers={nativePlaybackHeaders(playbackHeaders)} onError={() => handleProviderBlockedRef.current("player")} /> : null}
      {source ? <Video ref={videoRef} style={StyleSheet.absoluteFill} source={{ uri: videoSourceUri, headers: videoSourceHeaders, type: videoContentType, bufferConfig: videoBufferConfig }}
        paused={!isPlaying} rate={is2xSeeking ? 2.0 : speed} resizeMode="contain" muted={muted} volume={volume}
        maxBitRate={adaptiveBitrateCap ?? undefined} selectedAudioTrack={selectedAudioTrack as any}
        onLoad={(data: OnLoadData) => { setDuration(data.duration); sourceFirstFrame.current = true; sourceStarted.current = true; setPlayerStatus("playing"); setIsPlaying(true); setLastPlayerError(null); setShowControls(true); }}
        onProgress={(data: OnProgressData) => { setCurrentTime(data.currentTime); setPlayableDuration(data.playableDuration); }}
        onBuffer={(data: OnBufferData) => { setBuffering(data.isBuffering); }}
        onVideoTracks={(event: any) => setVideoTracks(event?.videoTracks ?? [])}
        onAudioTracks={(event: any) => setAudioTracks(event?.audioTracks ?? [])}
        onError={(event: any) => { const detail = event?.error?.errorString || event?.error?.errorCode || "Unknown player error"; setLastPlayerError(String(detail)); setPlayerStatus("error"); if (!useSourceProxy) { setUseSourceProxy(true); setSourceRevision((v) => v + 1); return; } handleProviderBlockedRef.current("player"); }}
        onEnd={() => { const reachedEnd = duration > 30 && currentTime >= Math.max(1, duration - 2); if (!sourceStarted.current || !reachedEnd) return; if (auth.user) { history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, progress: duration || currentTime, duration: duration || currentTime }); if (providerSync.connected.length) providerSync.pushProgress.mutate({ animeId, episode, progress: Math.floor(duration || currentTime), status: "completed" }); } if (autoNext && nextKnownEpisode) router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(nextKnownEpisode), title, image } } as never); }}
      /> : <View style={styles.videoPlaceholder}>
        {loadingServers ? <ProviderDiscoveryLoader attempt={serverAttempt} /> : loadingStream ? <View style={styles.thumbnailLoading}>
          <Image source={{ uri: selectedEpisode?.thumbnail || watchBackdrop || image || "" }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
          <View style={styles.thumbnailLoadingShade} />
          <View style={styles.thumbnailLoadingContent}><View style={styles.thumbnailPlay}><MaterialCommunityIcons name="play" size={18} color={nothing.black} /></View><Text style={styles.thumbnailEpisode}>EPISODE {episode}</Text><Text numberOfLines={2} style={styles.thumbnailTitle}>{selectedEpisode?.title || title}</Text><View style={styles.thumbnailProgress}><View style={styles.thumbnailProgressFill} /></View><Text style={styles.thumbnailStatus}>STARTING VIDEO</Text></View>
        </View> : error ? <Text style={styles.errorText}>{error}</Text> : <Text style={styles.placeholderText}>PREPARING VIDEO</Text>}
      </View>}

      {/* ── Subtitle Layer (lifts above the bottom deck while chrome is
          visible so cues are never hidden behind the timeline). ── */}
      {subtitlePrefs ? <View style={[styles.subtitleWrapper, showControls && !playerLocked ? styles.subtitleWrapperWithControls : manualFullscreen ? styles.subtitleWrapperFullscreen : null]} pointerEvents="none"><SubtitleRenderer cues={activeSubtitles} preferences={subtitlePrefs} /></View> : null}

      {/* ── Gesture overlay: sits ABOVE native Video, BELOW chrome.
          This is what makes tap-to-toggle reliable — touches no longer have to
          bubble through the ExoPlayer SurfaceView to the parent. Sibling
          chrome above (zIndex 3) still wins hit-test on buttons. */}
      {source && !playerLocked ? <View style={styles.gestureOverlay} {...panResponder.panHandlers} /> : null}

      {/* ── Embed chrome: WebView has its own internal controls, but we always
          show back + title + EMBED badge so it never looks like "no UI". */}
      {embedSource && !source ? (
        <View style={styles.embedChrome} pointerEvents="box-none">
          <Pressable onPress={() => { if (manualFullscreen) exitFullscreen(); else router.back(); }} accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.playerTitle} numberOfLines={1}>{`${title} - Episode ${episode}`}</Text>
          <View style={styles.subPillBadge}>
            <Text style={styles.subPillBadgeText}>EMBED</Text>
          </View>
          <Pressable onPress={manualFullscreen ? exitFullscreen : enterFullscreen} accessibilityRole="button" accessibilityLabel={manualFullscreen ? "Exit fullscreen" : "Enter fullscreen"} style={styles.iconButton} hitSlop={8}>
            <Ionicons name={manualFullscreen ? "contract" : "expand"} size={20} color="#FFF" />
          </Pressable>
        </View>
      ) : null}

      {/* ── Mini progress: always visible when chrome is hidden, so inline
          never looks dead and matches the reference layout's timeline. */}
      {source && !showControls && !playerLocked && duration > 0 ? (
        <View style={styles.miniProgress} pointerEvents="none">
          <View style={[styles.miniProgressBuffered, { width: `${bufferPct}%` }]} />
          <View style={[styles.miniProgressPlayed, { width: `${progressPct}%` }]} />
        </View>
      ) : null}

      {/* ── PLAYER CHROME (1:1 layout) ── */}

      {/* Double-tap feedback */}
      {doubleTapSide ? (
        <Animated.View style={[styles.doubleTapOverlay, { left: doubleTapSide === "left" ? "12%" : undefined, right: doubleTapSide === "right" ? "12%" : undefined, opacity: doubleTapAnim }]} pointerEvents="none">
          <MaterialCommunityIcons name={doubleTapSide === "left" ? "rewind-10" : "fast-forward-10"} size={42} color="#FFF" />
          <Text style={styles.doubleTapText}>{doubleTapSide === "left" ? "-10s" : "+10s"}</Text>
        </Animated.View>
      ) : null}

      {/* Main controls */}
      {showControls && !playerLocked ? (
        <View style={[styles.controlsBackdrop, manualFullscreen && styles.controlsBackdropFullscreen]} pointerEvents="box-none">
          {/* TOP BAR — compact inline to avoid overflow on ~360dp widths;
              full rail in fullscreen where there is room. */}
          <View style={styles.topBar}>
            <Pressable onPress={() => { if (manualFullscreen) exitFullscreen(); else router.back(); }} accessibilityRole="button" accessibilityLabel="Go back" accessibilityHint="Returns to the previous screen" style={styles.iconButton} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <Text style={styles.playerTitle} numberOfLines={1} ellipsizeMode="tail">{`${title} - Episode ${episode}`}</Text>
            <View style={styles.topRightRow}>
              {orientationLocked ? <View style={styles.orientationBadge}><Text style={styles.orientationBadgeText}>LANDSCAPE</Text></View> : null}
              {(skipSegments.intro || skipSegments.outro) ? (
                <Pressable onPress={() => setShowChapterList(true)} accessibilityRole="button" accessibilityLabel="Chapter list" accessibilityHint="Opens the list of chapters and segments" style={styles.iconButton} hitSlop={8}>
                  <Ionicons name="book" size={18} color="#FFF" />
                </Pressable>
              ) : null}
              {manualFullscreen ? (
                <Pressable onPress={() => setShowSpeedModal(true)} accessibilityRole="button" accessibilityLabel="Playback speed" accessibilityHint="Opens speed selection menu" style={styles.iconButton} hitSlop={8}>
                  <MaterialCommunityIcons name="speedometer" size={18} color="#FFF" />
                </Pressable>
              ) : null}
              <Pressable onPress={() => setShowSubtitleModal(true)} accessibilityRole="button" accessibilityLabel="Subtitles" accessibilityHint="Opens subtitle language selection" style={styles.iconButton} hitSlop={8}>
                <MaterialCommunityIcons name="subtitles" size={18} color="#FFF" />
              </Pressable>
              {manualFullscreen ? (
                <Pressable onPress={enterPiP} accessibilityRole="button" accessibilityLabel="Picture in Picture" accessibilityHint="Opens video in a floating window" style={styles.iconButton} hitSlop={8}>
                  <Ionicons name="videocam" size={18} color="#FFF" />
                </Pressable>
              ) : null}
              <Pressable onPress={() => setShowServerModal(true)} accessibilityRole="button" accessibilityLabel="Select server" accessibilityHint="Opens server and language selection" style={styles.subPillBadge} hitSlop={8}>
                <Text style={styles.subPillBadgeText}>{`${language.toUpperCase()} • ${activeProvider?.label || "S1"}`}</Text>
              </Pressable>
              <Pressable onPress={() => setShowSettings(true)} accessibilityRole="button" accessibilityLabel="Settings" accessibilityHint="Opens player settings panel" style={styles.iconButton} hitSlop={8}>
                <Ionicons name="settings-sharp" size={18} color="#FFF" />
              </Pressable>
            </View>
          </View>

          {/* BOTTOM CONTROLS */}
          <View style={styles.bottomDeck}>
            {/* Resume / Skip pills */}
            {(resumePosition || skipKind) ? (
              <View style={styles.contextActions}>
                {resumePosition ? (
                  <Pressable onPress={() => { pendingResume.current = resumePosition; videoRef.current?.seek(resumePosition); setResumePosition(null); }} accessibilityRole="button" accessibilityLabel={`Resume from ${formatTime(resumePosition)}`} accessibilityHint="Jumps to the saved playback position" style={styles.resumeBtn}>
                    <MaterialCommunityIcons name="play" size={14} color="#FFF" />
                    <Text style={styles.resumeBtnText}>{`RESUME ${formatTime(resumePosition)}`}</Text>
                  </Pressable>
                ) : null}
                {skipKind ? (
                  <Pressable onPress={() => skip(skipKind)} accessibilityRole="button" accessibilityLabel={`Skip ${skipKind}`} accessibilityHint={`Skips the ${skipKind} section`} style={styles.skipBtn}>
                    <Text style={styles.skipBtnText}>{`SKIP ${skipKind.toUpperCase()}`}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Timeline with chapter markers */}
            <View style={styles.timelineRow}>
              <Text style={styles.timeLabel}>{formatTime(currentTime)}</Text>
              <View style={styles.progressBarTrack} onLayout={onProgressLayout} onTouchStart={onBarTouchStart} onTouchMove={onBarTouchMove} onTouchEnd={seekFromBar} accessibilityRole="adjustable" accessibilityLabel="Seek bar" accessibilityHint="Drag to seek through the video">
                <View style={[styles.progressBuffered, { width: `${bufferPct}%` }]} />
                <View style={[styles.progressPlayed, { width: `${dragPct !== null ? dragPct : progressPct}%` }]} />
                {/* Chapter markers */}
                {skipSegments.intro && duration > 0 ? <View style={[styles.chapterMarker, { left: `${(skipSegments.intro.startTime / duration) * 100}%`, width: `${((skipSegments.intro.endTime - skipSegments.intro.startTime) / duration) * 100}%` }]} /> : null}
                {skipSegments.outro && duration > 0 ? <View style={[styles.chapterMarker, { left: `${(skipSegments.outro.startTime / duration) * 100}%`, width: `${((skipSegments.outro.endTime - skipSegments.outro.startTime) / duration) * 100}%` }]} /> : null}
                <View style={[styles.scrubberKnob, { left: `${dragPct !== null ? dragPct : progressPct}%` }]} />
                {dragPct !== null ? <View style={[styles.dragPreview, { left: `${Math.max(0, Math.min(dragPct, 100))}%` }]}><Text style={styles.dragPreviewText}>{formatTime((dragPct / 100) * duration)}</Text></View> : null}
              </View>
              <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
            </View>

            {/* Action rail — inline hides orientation + download (both live in
                fullscreen and in Settings) so all 8 remaining buttons fit a
                ~340dp wide inline player without overflowing. */}
            <View style={styles.actionRail}>
              <View style={styles.railSide}>
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setPlayerLocked(true); }} accessibilityRole="button" accessibilityLabel="Lock player" accessibilityHint="Locks the player controls to prevent accidental touches" style={styles.iconButton} hitSlop={8}>
                  <Ionicons name="lock-open-outline" size={18} color="#FFF" />
                </Pressable>
                {manualFullscreen ? (
                  <Pressable onPress={toggleOrientationLock} accessibilityRole="button" accessibilityLabel={orientationLocked ? "Unlock orientation" : "Lock to landscape"} accessibilityHint="Toggles between landscape-locked and free rotation" style={[styles.iconButton, orientationLocked && styles.iconButtonActive]} hitSlop={8}>
                    <Ionicons name={orientationLocked ? "phone-landscape" : "phone-portrait-outline"} size={18} color={orientationLocked ? "#FF4D4D" : "#FFF"} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setMuted((m) => !m); }} accessibilityRole="button" accessibilityLabel={muted ? "Unmute" : "Mute"} accessibilityHint="Toggles audio mute state" style={styles.iconButton} hitSlop={8}>
                  <Ionicons name={muted ? "volume-mute" : "volume-high"} size={18} color="#FFF" />
                </Pressable>
              </View>
              <View style={styles.railCenter}>
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); seekBy(-10); }} accessibilityRole="button" accessibilityLabel="Rewind 10 seconds" accessibilityHint="Seeks backward 10 seconds in the video" style={styles.iconButton} hitSlop={8}>
                  <MaterialCommunityIcons name="rewind-10" size={24} color="#FFF" />
                </Pressable>
                <Pressable disabled={!previousKnownEpisode} onPress={() => previousKnownEpisode && goToEpisode(previousKnownEpisode)} accessibilityRole="button" accessibilityLabel="Previous episode" accessibilityHint="Navigates to the previous episode" style={[styles.iconButton, !previousKnownEpisode && { opacity: 0.35 }]} hitSlop={8}>
                  <Ionicons name="play-skip-back" size={22} color="#FFF" />
                </Pressable>
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setIsPlaying((p) => !p); }} onLongPress={beginHoldSpeed} onPressOut={endHoldSpeed} delayLongPress={400} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause" : "Play"} accessibilityHint="Toggles video playback" style={styles.bigPlayButton}>
                  {buffering ? <ActivityIndicator color={nothing.black} /> : <Ionicons name={isPlaying ? "pause" : "play"} size={26} color="#000" style={!isPlaying ? { marginLeft: 2 } : undefined} />}
                </Pressable>
                <Pressable disabled={!nextKnownEpisode} onPress={nextEpisode} accessibilityRole="button" accessibilityLabel="Next episode" accessibilityHint="Navigates to the next episode" style={[styles.iconButton, !nextKnownEpisode && { opacity: 0.35 }]} hitSlop={8}>
                  <Ionicons name="play-skip-forward" size={22} color="#FFF" />
                </Pressable>
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); seekBy(10); }} accessibilityRole="button" accessibilityLabel="Forward 10 seconds" accessibilityHint="Seeks forward 10 seconds in the video" style={styles.iconButton} hitSlop={8}>
                  <MaterialCommunityIcons name="fast-forward-10" size={24} color="#FFF" />
                </Pressable>
              </View>
              <View style={styles.railSideRight}>
                {manualFullscreen ? (
                  <Pressable disabled={!maximumDownloadSource} onPress={() => void startDownload()} accessibilityRole="button" accessibilityLabel="Download episode" accessibilityHint="Saves the current episode for offline viewing" style={[styles.iconButton, !maximumDownloadSource && { opacity: 0.35 }]} hitSlop={8}>
                    <Ionicons name="download-outline" size={18} color="#FFF" />
                  </Pressable>
                ) : null}
                <Pressable onPress={manualFullscreen ? exitFullscreen : enterFullscreen} accessibilityRole="button" accessibilityLabel={manualFullscreen ? "Exit fullscreen" : "Enter fullscreen"} accessibilityHint="Toggles fullscreen video mode" style={styles.iconButton} hitSlop={8}>
                  <Ionicons name={manualFullscreen ? "contract" : "expand"} size={18} color="#FFF" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {/* Skip Intro/Outro (positioned bottom-right) */}
      {skipKind === "intro" && !playerLocked ? (
        <Pressable style={styles.skipButtonOverlay} onPress={() => skip("intro")} accessibilityRole="button" accessibilityLabel="Skip intro" accessibilityHint="Skips the opening sequence">
          <MaterialCommunityIcons name="skip-forward" size={16} color="#FFF" />
          <Text style={styles.skipButtonText}>Skip Intro</Text>
        </Pressable>
      ) : null}
      {skipKind === "outro" && !playerLocked ? (
        <Pressable style={styles.skipButtonOverlay} onPress={() => skip("outro")} accessibilityRole="button" accessibilityLabel="Skip outro" accessibilityHint="Skips the ending sequence">
          <MaterialCommunityIcons name="skip-forward" size={16} color="#FFF" />
          <Text style={styles.skipButtonText}>Skip Outro</Text>
        </Pressable>
      ) : null}

      {/* Locked state */}
      {playerLocked ? (
        <Pressable style={styles.lockedPill} onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setPlayerLocked(false); }} accessibilityRole="button" accessibilityLabel="Unlock player" accessibilityHint="Unlocks player controls to resume interaction">
          <Ionicons name="lock-closed" size={16} color="#FFF" />
          <Text style={styles.lockedText}>Tap to unlock</Text>
        </Pressable>
      ) : null}

      {/* Gesture HUD overlays */}
      {is2xSeeking ? (
        <View style={chrome.badge2x} pointerEvents="none">
          <MaterialCommunityIcons name="fast-forward" size={16} color="#FFF" />
          <Text style={chrome.badge2xText}>2X SPEED</Text>
        </View>
      ) : null}
      {volumeHud !== null ? (
        <View style={chrome.verticalBarWrap} pointerEvents="none">
          <View style={chrome.verticalBarBg}><View style={[chrome.verticalBarFill, { height: `${volumeHud}%` }]} /></View>
          <View style={chrome.verticalBarLabel}>
            <MaterialCommunityIcons name={volumeHud === 0 ? "volume-mute" : "volume-high"} size={14} color="#FFF" />
            <Text style={chrome.verticalBarText}>{volumeHud}%</Text>
          </View>
        </View>
      ) : null}
      {brightnessHud !== null ? (
        <View style={chrome.verticalBarWrapLeft} pointerEvents="none">
          <View style={chrome.verticalBarBg}><View style={[chrome.verticalBarFillBright, { height: `${brightnessHud}%` }]} /></View>
          <View style={chrome.verticalBarLabel}>
            <MaterialCommunityIcons name="white-balance-sunny" size={14} color="#FFF" />
            <Text style={chrome.verticalBarText}>{brightnessHud}%</Text>
          </View>
        </View>
      ) : null}

      {/* ── Settings panel (kept as overlay for advanced options) ── */}
      {source && showSettings ? <View style={ps.settingsOverlay}>
        <ScrollView contentContainerStyle={ps.settingsContent} showsVerticalScrollIndicator={false}>
          <View style={ps.settingsHeading}><DotLabel>SETTINGS</DotLabel><Pressable onPress={() => setShowSettings(false)}><AppIcon name="close" size={18} color={nothing.muted} /></Pressable></View>
          <View style={ps.settingsSection}><DotLabel>PLAYBACK</DotLabel><View style={styles.toggleRow}><Pressable onPress={() => setAutoNext((v) => !v)} style={[styles.toggle, autoNext && styles.toggleOn]}><Text style={[styles.toggleText, autoNext && styles.toggleTextOn]}>AUTO NEXT {autoNext ? "ON" : "OFF"}</Text></Pressable><Pressable onPress={() => setAutoSkip((v) => !v)} style={[styles.toggle, autoSkip && styles.toggleOn]}><Text style={[styles.toggleText, autoSkip && styles.toggleTextOn]}>AUTO SKIP {autoSkip ? "ON" : "OFF"}</Text></Pressable><Pressable onPress={() => { setRotationLocked((v) => !v); if (!rotationLocked) void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {}); else void ScreenOrientation.unlockAsync().catch(() => {}); }} style={[styles.toggle, rotationLocked && styles.toggleOn]}><Text style={[styles.toggleText, rotationLocked && styles.toggleTextOn]}>ROTATION {rotationLocked ? "LOCKED" : "FREE"}</Text></Pressable></View>
            <View style={styles.speedRow}>{[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => <Pressable key={value} onPress={() => { setSpeed(value); lockedSpeed.current = value; }} style={[styles.speed, speed === value && styles.speedActive]}><Text style={[styles.speedText, speed === value && styles.speedTextActive]}>{value}×</Text></Pressable>)}</View>
            {displayedQualityOptions.length > 1 ? <Pressable onPress={() => { setShowSettings(false); setShowQualityModal(true); }} style={[ps.downloadBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: nothing.line }]}><Text style={[ps.downloadBtnText, { color: nothing.white }]}>{`QUALITY · ${displayedQuality.toUpperCase()}`}</Text></Pressable> : null}
            {activeProviders.length > 1 ? <Pressable onPress={() => { setShowSettings(false); setShowServerModal(true); }} style={[ps.downloadBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: nothing.line }]}><Text style={[ps.downloadBtnText, { color: nothing.white }]}>{`SERVER · ${(activeProvider?.label || "S1").toUpperCase()}`}</Text></Pressable> : null}</View>
          {audioTracks.length > 1 ? <View style={ps.settingsSection}><DotLabel>AUDIO TRACK</DotLabel>
            <View style={styles.qualityRow}>
              <Pressable onPress={() => setSelectedAudioTrack(undefined)} style={[styles.quality, !selectedAudioTrack && styles.qualityActive]}><Text style={[styles.qualityText, !selectedAudioTrack && styles.qualityTextActive]}>AUTO</Text></Pressable>
              {audioTracks.map((track: any, index: number) => { const trackId = track?.index ?? track?.id ?? index; const label = String(track?.title || track?.language || `TRACK ${index + 1}`).toUpperCase(); const active = selectedAudioTrack?.value === trackId; return <Pressable key={String(trackId)} onPress={() => setSelectedAudioTrack({ type: "index", value: trackId })} style={[styles.quality, active && styles.qualityActive]}><Text style={[styles.qualityText, active && styles.qualityTextActive]}>{label}</Text></Pressable>; })}
            </View>
          </View> : null}
          <View style={ps.settingsSection}><DotLabel>STATUS</DotLabel>
            <Text style={ps.diagnosticLine}>{`SERVER · ${activeProvider?.label || "UNKNOWN"}`}</Text>
            <Text style={ps.diagnosticLine}>{`DELIVERY · ${embedSource ? "EMBED" : useSourceProxy ? "PROXY" : "DIRECT"}`}</Text>
            <Text style={ps.diagnosticLine}>{`QUALITY · ${displayedQuality.toUpperCase()}`}</Text>
            {lastPlayerError ? <Text style={ps.diagnosticLine}>{`PLAYER · ${lastPlayerError}`}</Text> : null}
          </View>
          <View style={ps.settingsSection}><DotLabel>OFFLINE</DotLabel>
            {offlineDownload ? <View style={ps.offlineBlock}><Text style={ps.offlineCopy}>{`${offlineDownload.quality} SAVED · ${Math.max(1, Math.round(offlineDownload.size / 1024 / 1024))} MB`}</Text>
              <View style={ps.offlineActions}><Pressable onPress={playOffline} style={ps.offlinePrimary}><AppIcon name="play" size={15} color={nothing.black} /><Text style={ps.offlinePrimaryText}>PLAY SAVED</Text></Pressable>
                <Pressable onPress={openDownloadLink} style={ps.offlineAction}><Text style={ps.offlineActionText}>DOWNLOAD</Text></Pressable>
                <Pressable onPress={() => void shareOfflineDownload(offlineDownload).catch((c) => setDownloadMessage(c instanceof Error ? c.message.toUpperCase() : "SHARE FAILED."))} style={ps.offlineAction}><Text style={ps.offlineActionText}>SHARE</Text></Pressable>
                <Pressable onPress={() => void removeDownload()} style={ps.offlineAction}><Text style={[ps.offlineActionText, { color: nothing.red }]}>REMOVE</Text></Pressable></View>
            </View> : <><Pressable disabled={downloadProgress !== null || !maximumDownloadSource} onPress={() => void startDownload()} style={[ps.downloadBtn, (!maximumDownloadSource || downloadProgress !== null) && { opacity: 0.38 }]}>
              <AppIcon name="download" size={17} color={nothing.black} /><Text style={ps.downloadBtnText}>{downloadProgress !== null ? `SAVING ${Math.round(downloadProgress * 100)}%` : maximumDownloadSource ? `SAVE ${downloadLabel(maximumDownloadSource)}` : "DIRECT SOURCE REQUIRED"}</Text></Pressable>
              {maximumDownloadSource ? <Pressable onPress={openDownloadLink} style={[ps.downloadBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: nothing.line }]}><Text style={[ps.downloadBtnText, { color: nothing.white }]}>OPEN DOWNLOAD LINK</Text></Pressable> : null}</>}
            {backendDownloads.length > 0 ? <View style={{ gap: 6, marginTop: 8 }}><Text style={ps.offlineCopy}>EXTERNAL DOWNLOADS</Text>{backendDownloads.map((dl) => <Pressable key={dl.url} onPress={() => { if (Platform.OS === "android") IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: dl.url }).catch(() => {}); }} style={[ps.downloadBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: nothing.line }]}><Text style={[ps.downloadBtnText, { color: nothing.white }]}>{`DOWNLOAD ${dl.label || "LINK"}`}</Text></Pressable>)}</View> : null}
            {downloadMessage ? <Text style={ps.downloadMessage}>{downloadMessage}</Text> : null}
          </View>
          {source?.subtitles?.length ? <View style={ps.settingsSection}><DotLabel>SUBTITLES</DotLabel>
            <View style={styles.qualityRow}><Pressable onPress={() => updateSubtitlePrefs({ enabled: false })} style={[styles.quality, subtitlePrefs && !subtitlePrefs.enabled && styles.qualityActive]}><Text style={[styles.qualityText, subtitlePrefs && !subtitlePrefs.enabled && styles.qualityTextActive]}>OFF</Text></Pressable>
              {source.subtitles.map((sub) => { const active = subtitlePrefs?.enabled && selectedSubtitleUrl === sub.url; return <Pressable key={sub.url} onPress={() => updateSubtitlePrefs({ enabled: true, preferredLanguage: sub.lang || sub.label || "en" })} style={[styles.quality, active && styles.qualityActive]}><Text style={[styles.qualityText, active && styles.qualityTextActive]}>{sub.label || sub.lang || "Track"}</Text></Pressable>; })}</View>
          </View> : null}
          <View style={ps.settingsSection}><SleepTimer remaining={sleepRemaining} onSetRemaining={setSleepRemaining} onClear={() => {}} /></View>
        </ScrollView>
      </View> : null}

      {source && sleepRemaining ? <SleepTimerPill remaining={sleepRemaining} onPress={() => setShowSettings(true)} /> : null}
    </View>

    {/* ── Error ── */}
    {error ? <View style={styles.errorAction}><NothingCard style={styles.errorCard}><DotLabel tone="muted">{futureRelease ? "FUTURE EPISODE" : "VIDEO UNAVAILABLE"}</DotLabel><Text style={styles.errorCopy}>{error}</Text>{lastPlayerError ? <Text style={ps.diagnosticLine}>{`PLAYER · ${lastPlayerError}`}</Text> : null}{futureRelease ? null : <View style={styles.errorBtnRow}><NothingButton label="TRY AGAIN" onPress={retry} variant="outline" /><NothingButton label="SWITCH SERVER" onPress={() => handleProviderBlocked("permanent")} variant="outline" /><NothingButton label="COPY ERROR" onPress={() => { void Clipboard.setStringAsync(`${error}${lastPlayerError ? `\nPLAYER · ${lastPlayerError}` : ""}\nSERVER · ${activeProvider?.label || "UNKNOWN"} · ${embedSource ? "EMBED" : useSourceProxy ? "PROXY" : "DIRECT"}`).catch(() => {}); }} variant="outline" /></View>}</NothingCard></View> : null}

    {/* ── Below player ── */}
    {!manualFullscreen ? <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS === "android"}>
      <View style={styles.th3Section}>
        <Text style={styles.th3Watching}><Text style={styles.th3WatchingGreen}>You are watching </Text><Text style={styles.th3WatchingWhite}>Episode {episode}</Text></Text>
        {swipeDirectionHint ? <View style={styles.swipeHintRow}><AppIcon name="chevron-left" size={12} color={previousKnownEpisode ? nothing.muted : nothing.dim} /><Text style={[styles.swipeHintText, !previousKnownEpisode && !nextKnownEpisode && { color: nothing.dim }]}>{swipeDirectionHint}</Text><AppIcon name="chevron-right" size={12} color={nextKnownEpisode ? nothing.muted : nothing.dim} /></View> : null}
        <View style={styles.th3Tabs}>
          {(["sub", "dub"] as Language[]).map((item) => { const active = language === item; const empty = !providers[item].length; return <Pressable key={item} accessibilityRole="tab" accessibilityLabel={`${item === "sub" ? "Subtitled" : "Dubbed"}${active ? " (selected)" : ""}`} accessibilityHint={empty ? "No servers available" : "Switch to this audio language"} disabled={empty} onPress={() => selectLanguage(item)} style={[styles.th3Tab, active && styles.th3TabActive]}><Text style={[styles.th3TabText, active ? styles.th3TabTextActive : empty && styles.th3TabTextEmpty]}>{item === "sub" ? "Sub" : "Dub"}</Text></Pressable>; })}
        </View>
        <View style={styles.th3Servers}>
          {activeProviders.map((provider, index) => { const active = index === serverIndex; return <Pressable key={provider.id} accessibilityRole="button" accessibilityLabel={`Server: ${provider.label}${active ? " (selected)" : ""}`} accessibilityHint={active ? "Currently active server" : "Switch to this streaming server"} onPress={() => selectServer(index)} style={[styles.th3ServerPill, active ? styles.th3ServerPillActive : styles.th3ServerPillIdle]}><Text style={active ? styles.th3ServerPillTextActive : styles.th3ServerPillTextIdle}>{provider.label}</Text></Pressable>; })}
        </View>
        <View style={styles.th3EpHead}>
          <Text style={styles.th3EpTitle}>List of episodes</Text>
          <View style={styles.th3EpSearch}><AppIcon name="magnify" size={16} color={nothing.muted} /><TextInput value={episodeSearch} onChangeText={setEpisodeSearch} placeholder="No. of Ep" placeholderTextColor={nothing.dim} style={styles.th3EpSearchInput} returnKeyType="done" keyboardType={episodeSearch && /\d/.test(episodeSearch) ? "number-pad" : "default"} /></View>
        </View>
        <View style={styles.th3EpsRow}><AppIcon name="layers" size={15} color={nothing.red} /><Text style={styles.th3EpsText}>{`EPS: ${filteredEpisodes.length}`}</Text>{dubCheckPending ? <><ActivityIndicator size="small" color={nothing.muted} /><Text style={[styles.th3EpsText, { color: nothing.muted }]}>CHECKING DUB</Text></> : null}</View>
        {episodeQuery.isPending ? <View style={styles.episodeLoading}><ActivityIndicator color={nothing.white} /><Text style={styles.episodeLoadingText}>LOADING EPISODES</Text></View> : filteredEpisodes.length ? <>
          <Animated.View style={[styles.episodeSwipeContainer, { transform: [{ translateX: swipeOffsetX }] }]} {...episodeSwipeResponder.panHandlers}>
            <View style={styles.th3Grid}>{pagedEpisodes.map((item) => { const active = item.number === episode; return <Pressable key={item.number} accessibilityRole="button" accessibilityLabel={`Episode ${item.number}${item.title ? `: ${item.title}` : ""}`} accessibilityHint={active ? "Currently playing" : "Double tap to play this episode"} onPress={() => goToEpisode(item.number)} onLongPress={() => openEpisodeInfo(item.number)} style={[styles.th3EpBtn, active && styles.th3EpBtnActive]}><Text style={[styles.th3EpBtnText, active ? styles.th3EpBtnTextActive : item.isFiller ? styles.th3EpBtnFiller : null]}>{item.number}</Text></Pressable>; })}</View>
            {totalEpisodePages > 1 ? <View style={styles.episodePager}><Pressable disabled={safeEpisodePage === 0} onPress={() => setEpisodePage((v) => Math.max(0, v - 1))} accessibilityRole="button" accessibilityLabel="Previous page" accessibilityHint="Shows the previous page of episodes" style={[styles.episodePagerButton, safeEpisodePage === 0 && styles.episodePagerDisabled]}><AppIcon name="chevron-left" size={17} color={nothing.white} /><Text style={styles.episodePagerText}>PREV</Text></Pressable><Pressable disabled={safeEpisodePage >= totalEpisodePages - 1} onPress={() => setEpisodePage((v) => Math.min(totalEpisodePages - 1, v + 1))} accessibilityRole="button" accessibilityLabel="Next page" accessibilityHint="Shows the next page of episodes" style={[styles.episodePagerButton, safeEpisodePage >= totalEpisodePages - 1 && styles.episodePagerDisabled]}><Text style={styles.episodePagerText}>NEXT</Text><AppIcon name="chevron-right" size={17} color={nothing.white} /></Pressable></View> : null}
          </Animated.View>
        </> : <Text style={styles.emptyEpisodeText}>{episodeSearch ? "No episodes match your search." : "No episodes are listed for this title."}</Text>}
      </View>
      <View style={styles.watchCommunitySection}>
        <DotLabel>EPISODE ACTIVITY</DotLabel>
        <View style={styles.ratingRow}><Text style={styles.ratingPrompt}>{currentRating ? `YOU RATED ${currentRating}/10` : "RATE THIS EPISODE"}</Text><View style={styles.ratingChoices}>{Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <Pressable key={score} onPress={() => { if (!auth.user) { router.push("/auth" as never); return; } ratings.setRating.mutate({ episode, score }); }} style={[styles.ratingChoice, currentRating >= score && styles.ratingChoiceActive]}><Text style={[styles.ratingChoiceText, currentRating >= score && styles.ratingChoiceTextActive]}>{score}</Text></Pressable>)}</View></View>
        <AnimeComments animeId={animeId} episodeNumber={episode} />
      </View>
    </ScrollView> : null}

    {/* ── Modal Pickers ── */}
    <Modal visible={showSpeedModal} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setShowSpeedModal(false)}><View style={styles.modalSheet}><Text style={styles.modalTitle}>Playback Speed</Text>{[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((val) => <Pressable key={val} style={[styles.modalItem, speed === val && styles.modalItemActive]} onPress={() => { setSpeed(val); lockedSpeed.current = val; setShowSpeedModal(false); }}><Text style={[styles.modalItemText, speed === val && styles.modalItemTextActive]}>{val === 1.0 ? "1.0x (Normal)" : `${val}x`}</Text>{speed === val && <Ionicons name="checkmark" size={20} color={nothing.red} />}</Pressable>)}</View></Pressable></Modal>

    <Modal visible={showSubtitleModal} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setShowSubtitleModal(false)}><View style={styles.modalSheet}><Text style={styles.modalTitle}>Subtitles</Text>{source?.subtitles?.length ? <>
      <Pressable style={[styles.modalItem, subtitlePrefs && !subtitlePrefs.enabled && styles.modalItemActive]} onPress={() => { updateSubtitlePrefs({ enabled: false }); setShowSubtitleModal(false); }}><Text style={[styles.modalItemText, subtitlePrefs && !subtitlePrefs.enabled && styles.modalItemTextActive]}>Off</Text>{subtitlePrefs && !subtitlePrefs.enabled && <Ionicons name="checkmark" size={20} color={nothing.red} />}</Pressable>
      {source.subtitles.map((sub) => { const active = subtitlePrefs?.enabled && selectedSubtitleUrl === sub.url; return <Pressable key={sub.url} style={[styles.modalItem, active && styles.modalItemActive]} onPress={() => { updateSubtitlePrefs({ enabled: true, preferredLanguage: sub.lang || sub.label || "en" }); setShowSubtitleModal(false); }}><Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>{sub.label || sub.lang || "Track"}</Text>{active && <Ionicons name="checkmark" size={20} color={nothing.red} />}</Pressable>; })}
    </> : <Text style={styles.modalItemText}>No subtitles available</Text>}</View></Pressable></Modal>

    <Modal visible={showQualityModal} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setShowQualityModal(false)}><View style={styles.modalSheet}><Text style={styles.modalTitle}>Quality</Text>{displayedQualityOptions.length ? displayedQualityOptions.map((item: WatchQualityOption) => { const selected = source ? displayedQuality.toLowerCase() === item.label.toLowerCase() : false; return <Pressable key={item.id} onPress={() => { if (source) void selectAdaptiveQuality(item); else if (item.source) selectQuality(item.source); setShowQualityModal(false); }} style={[styles.modalItem, selected && styles.modalItemActive]}><Text style={[styles.modalItemText, selected && styles.modalItemTextActive]}>{item.label.toUpperCase()}</Text>{selected && <Ionicons name="checkmark" size={20} color={nothing.red} />}</Pressable>; }) : <Text style={styles.modalItemText}>No quality options available</Text>}</View></Pressable></Modal>

    <Modal visible={showServerModal} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setShowServerModal(false)}><View style={styles.modalSheet}><Text style={styles.modalTitle}>Select Server</Text><View style={styles.languageRow}>{(["sub", "dub"] as Language[]).map((item) => <Pressable key={item} onPress={() => selectLanguage(item)} disabled={!providers[item].length} style={[styles.language, language === item && styles.languageActive, !providers[item].length && styles.languageDisabled]}><Text style={[styles.languageText, language === item && styles.languageTextActive]}>{item === "sub" ? `SUB · ${providers.sub.length}` : `DUB · ${providers.dub.length}`}</Text></Pressable>)}</View>
      {activeProviders.map((provider, index) => <Pressable key={provider.id} onPress={() => { selectServer(index); setShowServerModal(false); }} style={[styles.modalItem, index === serverIndex && styles.modalItemActive]}><Text style={[styles.modalItemText, index === serverIndex && styles.modalItemTextActive]}>{provider.label}</Text>{index === serverIndex && <Ionicons name="checkmark" size={20} color={nothing.red} />}</Pressable>)}</View></Pressable></Modal>

    {/* Chapter List Modal */}
    <Modal visible={showChapterList} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setShowChapterList(false)}><View style={styles.chapterModalSheet}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={styles.modalTitle}>CHAPTERS</Text><Pressable onPress={() => setShowChapterList(false)}><Ionicons name="close" size={20} color={nothing.muted} /></Pressable></View>
      {duration <= 0 ? <Text style={styles.chapterEmptyText}>No duration data available yet.</Text> : (
        <View style={styles.chapterList}>
          {(() => {
            const chapters: Array<{ name: string; startTime: number; endTime: number; kind: SkipKind }> = [];
            if (skipSegments.intro) chapters.push({ name: "Intro", startTime: skipSegments.intro.startTime, endTime: skipSegments.intro.endTime, kind: "intro" });
            if (skipSegments.outro) chapters.push({ name: "Outro", startTime: skipSegments.outro.startTime, endTime: skipSegments.outro.endTime, kind: "outro" });
            if (chapters.length === 0) return <Text style={styles.chapterEmptyText}>No chapters detected for this episode.</Text>;
            return chapters.sort((a, b) => a.startTime - b.startTime).map((ch) => {
              const isActive = currentTime >= ch.startTime && currentTime < ch.endTime;
              const isPast = currentTime >= ch.endTime;
              const durationSec = ch.endTime - ch.startTime;
              return (
                <Pressable key={ch.kind} onPress={() => { seekTo(ch.startTime); setShowChapterList(false); }} style={[styles.chapterItem, isActive && styles.chapterItemActive, isPast && styles.chapterItemPast]}>
                  <View style={styles.chapterItemLeft}>
                    <View style={[styles.chapterDot, isActive && styles.chapterDotActive, isPast && styles.chapterDotPast]} />
                    <View style={styles.chapterInfo}>
                      <Text style={[styles.chapterName, isActive && styles.chapterNameActive]}>{ch.name}</Text>
                      <Text style={styles.chapterTimestamp}>{formatTime(ch.startTime)} - {formatTime(ch.endTime)}</Text>
                    </View>
                  </View>
                  <View style={styles.chapterItemRight}>
                    <Text style={styles.chapterDuration}>{formatTime(durationSec)}</Text>
                    {isActive ? <MaterialCommunityIcons name="play" size={16} color={nothing.red} /> : isPast ? <Ionicons name="checkmark" size={16} color={nothing.dim} /> : <Ionicons name="chevron-forward" size={16} color={nothing.muted} />}
                  </View>
                </Pressable>
              );
            });
          })()}
        </View>
      )}
    </View></Pressable></Modal>
  </NativeScreen>;
}

// ── Styles ──
const wp = StyleSheet.create({
  watchBackdrop: { position: "absolute", top: 0, left: 0, right: 0, height: 540, opacity: 0.42 },
  watchBackdropMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,9,9,0.82)" },
});

const ps = StyleSheet.create({
  videoShellFullscreen: { position: "absolute", zIndex: 50, elevation: 50, top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", aspectRatio: undefined, backgroundColor: "#000000", justifyContent: "center" },
  qualityOverlay: { position: "absolute", zIndex: 5, top: 56, right: 8, width: 212, gap: 9, padding: 12, borderWidth: 1, borderColor: "rgba(246,246,242,0.3)", borderRadius: 5, backgroundColor: "rgba(9,9,9,0.97)" },
  qualityHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qualityChoices: { borderTopWidth: 1, borderTopColor: nothing.line },
  qualityChoice: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  qualityChoiceActive: { borderBottomColor: nothing.red, backgroundColor: "rgba(255,77,77,0.06)" },
  qualityChoiceText: { color: nothing.white, fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  qualityChoiceTextActive: { color: nothing.red },
  qualityChoiceState: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800" },
  qualityChoiceStateActive: { color: nothing.red },
  sourceOverlay: { position: "absolute", zIndex: 6, left: 8, right: 8, bottom: 8, maxHeight: "65%", gap: 10, padding: 12, borderWidth: 1, borderColor: "rgba(246,246,242,0.3)", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, backgroundColor: "rgba(9,9,9,0.97)" },
  sourceItem: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  sourceItemActive: { borderBottomColor: nothing.red, backgroundColor: "rgba(255,77,77,0.06)" },
  sourceItemName: { flexDirection: "row", alignItems: "center", gap: 8 },
  sourceSignal: { width: 7, height: 7, borderRadius: 99, backgroundColor: nothing.dim },
  sourceSignalActive: { backgroundColor: nothing.red },
  sourceItemText: { color: nothing.white, fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  sourceItemTextActive: { color: nothing.red },
  sourceItemState: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800" },
  settingsOverlay: { position: "absolute", zIndex: 4, top: 8, right: 8, bottom: 8, width: "78%", maxWidth: 370, borderWidth: 1, borderColor: "rgba(246,246,242,0.3)", borderRadius: 5, backgroundColor: "rgba(9,9,9,0.96)" },
  settingsContent: { padding: 12, gap: 10 },
  settingsHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 2 },
  settingsSection: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: nothing.line },
  diagnosticLine: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.25, lineHeight: 14 },
  offlineBlock: { gap: 8 },
  offlineCopy: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.25 },
  offlineActions: { flexDirection: "row", gap: 6 },
  offlinePrimary: { flex: 1.3, minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 4, backgroundColor: nothing.white },
  offlinePrimaryText: { color: nothing.black, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.2 },
  offlineAction: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  offlineActionText: { color: nothing.white, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.2 },
  downloadBtn: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10, borderRadius: 4, backgroundColor: nothing.white },
  downloadBtnText: { color: nothing.black, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  downloadMessage: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.25, lineHeight: 13 },
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { minHeight: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 6 },
  topCopy: { flex: 1, gap: 2 },
  title: { color: nothing.white, fontSize: 22, fontWeight: "900", lineHeight: 26, letterSpacing: -0.6 },
  episodeLabel: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  videoShell: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000000", overflow: "hidden", position: "relative" },
  video: { flex: 1 },
  gestureOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  embedChrome: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 5, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  miniProgress: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(255,255,255,0.22)", zIndex: 2 },
  miniProgressBuffered: { position: "absolute", top: 0, left: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.35)" },
  miniProgressPlayed: { position: "absolute", top: 0, left: 0, bottom: 0, backgroundColor: "#FF4D4D" },
  subtitleWrapper: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", alignItems: "center", paddingBottom: 76, zIndex: 1 },
  subtitleWrapperWithControls: { paddingBottom: 148 },
  subtitleWrapperFullscreen: { paddingBottom: 28 },
  controlsBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 3, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8 },
  controlsBackdropFullscreen: { paddingHorizontal: 18, paddingVertical: 10 },
  topBar: { flexDirection: "row", alignItems: "center", flexWrap: "nowrap", width: "100%" },
  playerTitle: { flex: 1, flexShrink: 1, color: "#FFF", fontSize: 13, fontWeight: "700", letterSpacing: -0.2, marginLeft: 8, marginRight: 6 },
  topRightRow: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  iconButton: { width: 32, height: 32, padding: 4, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  iconButtonActive: { backgroundColor: "rgba(255,77,77,0.15)", borderRadius: 6 },
  orientationBadge: { backgroundColor: "rgba(255,77,77,0.85)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  orientationBadgeText: { color: nothing.white, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  subPillBadge: { backgroundColor: nothing.red, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, flexShrink: 0 },
  subPillBadgeText: { color: nothing.black, fontSize: 9, fontWeight: "900", fontFamily: "monospace", letterSpacing: 0.4 },
  bottomDeck: { gap: 4, width: "100%" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 6, width: "100%" },
  timeLabel: { color: "#FFF", fontSize: 10, fontWeight: "600", fontFamily: "monospace", minWidth: 34, textAlign: "center", flexShrink: 0 },
  progressBarTrack: { flex: 1, height: 18, justifyContent: "center" },
  progressBuffered: { position: "absolute", height: 3, backgroundColor: "rgba(255,255,255,0.45)", borderRadius: 2 },
  progressPlayed: { position: "absolute", height: 3, backgroundColor: nothing.red, borderRadius: 2 },
  scrubberKnob: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFF", marginLeft: -6, top: 3, elevation: 3 },
  dragPreview: { position: "absolute", top: -28, marginLeft: -24, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  dragPreviewText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "700" },
  actionRail: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", width: "100%" },
  railSide: { flexDirection: "row", alignItems: "center", gap: 0, flexShrink: 0 },
  railSideRight: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 0, flexShrink: 0 },
  railCenter: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 1, justifyContent: "center" },
  bigPlayButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", flexShrink: 0, marginHorizontal: 2 },
  hudBadge: { position: "absolute", top: 24, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6, zIndex: 10 },
  hudPill: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 10, zIndex: 10 },
  hudText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  doubleTapOverlay: { position: "absolute", top: "32%", alignItems: "center", justifyContent: "center", zIndex: 12 },
  doubleTapText: { color: "#FFF", fontSize: 13, fontWeight: "800", marginTop: 4 },
  chapterMarker: { position: "absolute", height: 3, backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 1, top: 7.5 },
  skipButtonOverlay: { position: "absolute", bottom: 96, right: 16, backgroundColor: nothing.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6, zIndex: 15, elevation: 6 },
  skipButtonText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  lockedPill: { position: "absolute", bottom: 36, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", zIndex: 15 },
  lockedText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#161B26", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 4 },
  modalTitle: { color: "#FFF", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  modalItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  modalItemActive: { backgroundColor: "rgba(255,77,77,0.08)" },
  modalItemText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  modalItemTextActive: { color: nothing.red, fontWeight: "700" },
  chapterModalSheet: { backgroundColor: "#161B26", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 8, maxHeight: "70%" },
  chapterList: { gap: 6 },
  chapterItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" },
  chapterItemActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" },
  chapterItemPast: { opacity: 0.5 },
  chapterItemLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  chapterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: nothing.dim },
  chapterDotActive: { backgroundColor: nothing.red },
  chapterDotPast: { backgroundColor: nothing.green },
  chapterInfo: { gap: 2 },
  chapterName: { color: nothing.white, fontSize: 14, fontWeight: "700" },
  chapterNameActive: { color: nothing.red },
  chapterTimestamp: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "700" },
  chapterItemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  chapterDuration: { color: nothing.dim, fontFamily: "monospace", fontSize: 10, fontWeight: "800" },
  chapterEmptyText: { color: nothing.muted, fontSize: 13, textAlign: "center", paddingVertical: 18 },
  contextActions: { alignSelf: "flex-end", alignItems: "flex-end", gap: 6 },
  videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 11, backgroundColor: "#090909" },
  thumbnailLoading: { ...StyleSheet.absoluteFillObject, overflow: "hidden", justifyContent: "flex-end", backgroundColor: "#090909" },
  thumbnailLoadingShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.52)" },
  thumbnailLoadingContent: { zIndex: 1, gap: 7, padding: 18, paddingTop: 56, backgroundColor: "rgba(9,9,9,0.68)" },
  thumbnailPlay: { width: 38, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: nothing.white, borderRadius: 4 },
  thumbnailEpisode: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  thumbnailTitle: { color: nothing.white, fontSize: 16, lineHeight: 20, fontWeight: "900" },
  thumbnailProgress: { height: 3, marginTop: 5, backgroundColor: "rgba(246,246,242,0.24)", overflow: "hidden" },
  thumbnailProgressFill: { width: "36%", height: "100%", backgroundColor: nothing.red },
  thumbnailStatus: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.55 },
  placeholderText: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  errorText: { color: nothing.red, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 0.5, textAlign: "center", paddingHorizontal: 24 },
  playerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 3, justifyContent: "space-between", padding: 10 },
  pointerBoxNone: { pointerEvents: "box-none" },
  pointerNone: { pointerEvents: "none" },
  th3Top: { flexDirection: "row", alignItems: "center", gap: 8 },
  th3Back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  th3Title: { flex: 1, color: nothing.white, fontSize: 18, fontWeight: "800", lineHeight: 22, letterSpacing: -0.4 },
  th3TopIcons: { flexDirection: "row", alignItems: "center", gap: 8 },
  th3Icon: { minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" },
  th3Pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: nothing.red },
  th3PillText: { color: nothing.black, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  th3SeekRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 0 },
  th3Time: { minWidth: 40, color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "700", textAlign: "center" },
  th3Timeline: { flex: 1, height: 14, justifyContent: "center" },
  th3Track: { position: "absolute", left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: "rgba(246,246,242,0.22)" },
  th3Buffered: { position: "absolute", left: 0, height: 3, borderRadius: 2, backgroundColor: "rgba(255,77,77,0.45)" },
  th3TimelinePlayed: { position: "absolute", left: 0, height: 3, borderRadius: 2, backgroundColor: nothing.red },
  th3Knob: { position: "absolute", top: 2, width: 10, height: 10, marginLeft: -5, borderRadius: 5, backgroundColor: nothing.white },
  th3Rail: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 0 },
  th3RailSide: { flexDirection: "row", alignItems: "center", gap: 2, minWidth: 72 },
  th3Cluster: { flexDirection: "row", alignItems: "center", gap: 2 },
  th3Fab: { width: 50, height: 50, alignItems: "center", justifyContent: "center", backgroundColor: nothing.white, borderRadius: 25, marginHorizontal: 4 },
  th3Disabled: { opacity: 0.3 },
  th3Section: { gap: 14 },
  th3Watching: { fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  th3WatchingGreen: { color: nothing.red, fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  th3WatchingWhite: { color: nothing.white, fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  th3Tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: nothing.line },
  th3Tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  th3TabActive: { borderBottomColor: nothing.red },
  th3TabText: { color: nothing.white, fontSize: 17, fontWeight: "700" },
  th3TabTextActive: { color: nothing.red },
  th3TabTextEmpty: { color: nothing.dim },
  th3Servers: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  th3ServerPill: { minWidth: 110, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderRadius: 22, borderWidth: 1 },
  th3ServerPillActive: { backgroundColor: nothing.red, borderColor: nothing.red },
  th3ServerPillIdle: { backgroundColor: nothing.raised, borderColor: nothing.line },
  th3ServerPillTextActive: { color: nothing.black, fontSize: 14, fontWeight: "900" },
  th3ServerPillTextIdle: { color: nothing.muted, fontSize: 14, fontWeight: "700" },
  th3EpHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  th3EpTitle: { color: nothing.white, fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  th3EpSearch: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 38, minWidth: 130, borderWidth: 1, borderColor: nothing.line, borderRadius: 10, backgroundColor: nothing.surface },
  th3EpSearchInput: { flex: 1, color: nothing.white, fontSize: 13, paddingVertical: 0 },
  th3EpsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  th3EpsText: { color: nothing.red, fontFamily: "monospace", fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
  th3Grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  th3EpBtn: { width: 56, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: nothing.raised },
  th3EpBtnActive: { backgroundColor: nothing.red },
  th3EpBtnText: { color: nothing.white, fontSize: 16, fontWeight: "800" },
  th3EpBtnTextActive: { color: nothing.black, fontWeight: "900" },
  th3EpBtnFiller: { color: nothing.red },
  overlayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sourcePill: { flexDirection: "row", alignItems: "center", gap: 7 },
  overlayActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  overlayBtn: { minWidth: 36, height: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.74)", borderWidth: 1, borderColor: "rgba(246,246,242,0.35)" },
  overlayBtnActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.15)" },
  overlayBtnText: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.25 },
  centerControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40 },
  seekBtn: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  overlayBottom: { gap: 8 },
  resumeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.8)" },
  resumeBtnText: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900" },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4, backgroundColor: nothing.red },
  skipBtnText: { color: nothing.white, fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
  lockedRow: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
  errorBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  timelineBlock: { gap: 6, paddingTop: 3 },
  timeline: { height: 4, backgroundColor: "rgba(246,246,242,0.2)", borderRadius: 2, overflow: "hidden" },
  timelineBuffered: { position: "absolute", top: 0, left: 0, height: "100%", backgroundColor: "rgba(246,246,242,0.3)" },
  timelinePlayed: { position: "absolute", top: 0, left: 0, height: "100%", backgroundColor: nothing.red },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900" },
  timeMeta: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  errorAction: { paddingHorizontal: 16, paddingTop: 12 },
  errorCard: { gap: 8, padding: 14 },
  errorCopy: { color: nothing.muted, fontSize: 13, lineHeight: 18 },
  scroll: { padding: 16, gap: 14 },
  episodeLoading: { minHeight: 86, alignItems: "center", justifyContent: "center", gap: 9, borderTopWidth: 1, borderTopColor: nothing.line },
  episodeLoadingText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  episodeGrid: { gap: 0, borderTopWidth: 1, borderTopColor: nothing.line },
  episodeInfoBar: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  episodePageMeta: { flex: 1, color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.3 },
  episodePager: { flexDirection: "row", gap: 7 },
  episodePagerButton: { flex: 1, minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  episodePagerDisabled: { opacity: 0.3 },
  episodePagerText: { color: nothing.white, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },
  episodeChoice: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: nothing.line },
  episodeChoiceActive: { borderBottomColor: nothing.red, backgroundColor: "rgba(255,77,77,0.05)" },
  episodeChoiceNumber: { width: 30, color: nothing.dim, fontFamily: "monospace", fontSize: 12, fontWeight: "900" },
  episodeChoiceTitle: { flex: 1, color: nothing.white, fontSize: 13, fontWeight: "700" },
  episodeChoiceState: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  episodeChoiceTextActive: { color: nothing.red },
  emptyEpisodeText: { color: nothing.muted, paddingVertical: 18, textAlign: "center", fontSize: 13 },
  swipeHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 2 },
  swipeHintText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  episodeSwipeContainer: { overflow: "hidden" },
  watchCommunitySection: { gap: 13, paddingTop: 3 },
  ratingRow: { gap: 8, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: nothing.line },
  ratingPrompt: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  ratingChoices: { flexDirection: "row", gap: 5 },
  ratingChoice: { flex: 1, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 3 },
  ratingChoiceActive: { backgroundColor: nothing.white, borderColor: nothing.white },
  ratingChoiceText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900" },
  ratingChoiceTextActive: { color: nothing.black },
  languageRow: { flexDirection: "row", gap: 7 },
  language: { minWidth: 56, minHeight: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  languageActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" },
  languageDisabled: { opacity: 0.32 },
  languageText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.2 },
  languageTextActive: { color: nothing.red },
  toggleRow: { flexDirection: "row", gap: 7 },
  toggle: { minHeight: 36, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line },
  toggleOn: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" },
  toggleText: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "900" },
  toggleTextOn: { color: nothing.red },
  speedRow: { flexDirection: "row", gap: 5 },
  speed: { minWidth: 40, minHeight: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, borderColor: nothing.line },
  speedActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" },
  speedText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900" },
  speedTextActive: { color: nothing.red },
  qualityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quality: { minWidth: 44, minHeight: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  qualityActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.1)" },
  qualityText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900" },
  qualityTextActive: { color: nothing.red },
  providerDiscovery: { width: "100%", maxWidth: 280, alignItems: "center", gap: 12 },
  providerDiscoveryCopy: { alignItems: "center", gap: 4 },
  providerDiscoveryTitle: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  providerDiscoveryDetail: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
});

const EpisodeChoice = memo(function EpisodeChoice({ item, selected, onSelect, onInfo }: { item: Episode; selected: boolean; onSelect: (n: number) => void; onInfo: (n: number) => void }) {
  return <Pressable onPress={() => onSelect(item.number)} onLongPress={() => onInfo(item.number)} style={[styles.episodeChoice, selected && styles.episodeChoiceActive]}>
    <Text style={[styles.episodeChoiceNumber, selected && styles.episodeChoiceTextActive]}>{String(item.number).padStart(2, "0")}</Text>
    <Text style={[styles.episodeChoiceTitle, selected && styles.episodeChoiceTextActive]} numberOfLines={1}>{item.title || `Episode ${item.number}`}</Text>
    <Text style={[styles.episodeChoiceState, selected && styles.episodeChoiceTextActive]}>{selected ? "WATCHING" : item.isFiller ? "FILLER" : "EPISODE"}</Text>
  </Pressable>;
});

function ProviderDiscoveryLoader({ attempt }: { attempt: number }) {
  return <View style={styles.providerDiscovery}>
    <ActivityIndicator size="small" color={nothing.red} />
    <View style={styles.providerDiscoveryCopy}>
      <Text style={styles.providerDiscoveryTitle}>FINDING PROVIDERS</Text>
      <Text style={styles.providerDiscoveryDetail}>CHECKING MOMO & NIKO</Text>
    </View>
  </View>;
}
