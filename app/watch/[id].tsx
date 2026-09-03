import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Animated, BackHandler, Dimensions, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import Video, { type OnProgressData, type OnLoadData, type OnBufferData, type VideoRef } from "react-native-video";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import * as IntentLauncher from "expo-intent-launcher";
import { anirakuDownloadUrl, anirakuProxyUrl, getAnimeMetadata, getEpisodes, getServers, getStream, getPlaybackType, nativePlaybackHeaders } from "@/lib/aniraku-api";
import { getAnimeById, getKnownMalId, getMalIdByAnimeId } from "@/lib/anilist";
import { enrichEpisodesWithTmdb } from "@/lib/tmdb-episodes";
import {
  activeSkipKind,
  directSources,
  episodePageCount,
  episodePageFor,
  episodePageSlice,
  hasConfirmedPlaybackStart,
  isAutoQuality,
  isProxySource,
  FUTURE_RELEASE_MESSAGE,
  isConfirmedFutureRelease,
  mergeSkipSegments,
  nativeSources,
  normalizeAniSkipSegments,
  providerSkipSegments,
  proxySources,
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
import { SubtitleSettings } from "@/components/subtitle-settings";
import { GestureLayer } from "@/components/gesture-player";
import { SleepTimer } from "@/components/sleep-timer";
import { parseSubtitle, detectSubtitleFormat, findActiveCues, type SubtitleCue } from "@/lib/subtitle-parser";
import { loadSubtitlePreferences, type SubtitlePreferences } from "@/lib/subtitle-preferences";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
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
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
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
  useKeepAwake("aniraku-watch");

  // ── Player state (react-native-video) ──
  const videoRef = useRef<VideoRef>(null);
  const [playerStatus, setPlayerStatus] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playableDuration, setPlayableDuration] = useState(0);
  const [videoTracks, setVideoTracks] = useState<any[]>([]);

  // ── App state ──
  const [language, setLanguage] = useState<Language>("sub");
  const [providers, setProviders] = useState<Record<Language, Server[]>>({ sub: [], dub: [] });
  const [serverIndex, setServerIndex] = useState(0);
  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [source, setSource] = useState<StreamSource | null>(null);
  const [useSourceProxy, setUseSourceProxy] = useState(false);
  const [playbackHeaders, setPlaybackHeaders] = useState<Record<string, string> | undefined>();
  const [loadingServers, setLoadingServers] = useState(true);
  const [serverAttempt, setServerAttempt] = useState(0);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [autoNext, setAutoNext] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [manualFullscreen, setManualFullscreen] = useState(false);
  const [showEpisodeSidebar, setShowEpisodeSidebar] = useState(true);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [episodePage, setEpisodePage] = useState(0);
  const [episodeJump, setEpisodeJump] = useState("");
  const [progressWidth, setProgressWidth] = useState(0);
  const [skipSegments, setSkipSegments] = useState<SkipSegments>({ intro: null, outro: null });
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [offlineDownload, setOfflineDownload] = useState<OfflineDownload | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [requestedQuality, setRequestedQuality] = useState("auto");
  const [adaptiveBitrateCap, setAdaptiveBitrateCap] = useState<number | null>(null);
  const [subtitlePrefs, setSubtitlePrefs] = useState<SubtitlePreferences | null>(null);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  const [activeSubtitles, setActiveSubtitles] = useState<SubtitleCue[]>([]);
  const [rotationLocked, setRotationLocked] = useState(false);
  const [speedLocked, setSpeedLocked] = useState(false);
  const lockedSpeed = useRef(1);

  useEffect(() => () => { if (Platform.OS !== "web") void ScreenOrientation.unlockAsync().catch(() => {}); }, []);

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
    const filtered = term
      ? displayEpisodes.filter((item) => String(item.number).includes(term) || String(item.title || "").toLowerCase().includes(term))
      : displayEpisodes;
    const pageCount = episodePageCount(filtered.length);
    const safePage = Math.max(0, Math.min(episodePage, pageCount - 1));
    return { filteredEpisodes: filtered, totalEpisodePages: pageCount, safeEpisodePage: safePage, pagedEpisodes: episodePageSlice(filtered, safePage) };
  }, [displayEpisodes, episodePage, episodeSearch]);

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
  useEffect(() => { if (showSubtitleSettings) loadSubtitlePreferences().then(setSubtitlePrefs); }, [showSubtitleSettings]);

  const parsedCuesRef = useRef<SubtitleCue[]>([]);

  useEffect(() => {
    if (!source?.subtitles?.length || !subtitlePrefs) { parsedCuesRef.current = []; setActiveSubtitles([]); return; }
    const preferred = source.subtitles.find((s) => s.lang?.startsWith(subtitlePrefs.preferredLanguage)) ?? source.subtitles[0];
    if (!preferred?.url) { parsedCuesRef.current = []; setActiveSubtitles([]); return; }
    const format = detectSubtitleFormat(preferred.url);
    if (!format) { parsedCuesRef.current = []; setActiveSubtitles([]); return; }
    const subtitleUrl = preferred.url.includes("/api/v1/proxy?") ? preferred.url : anirakuProxyUrl(preferred.url, nativePlaybackHeaders(playbackHeaders));
    let cancelled = false;
    fetch(subtitleUrl).then((r) => r.text()).then((text) => {
      if (cancelled) return;
      const parsed = parseSubtitle(text, format);
      parsedCuesRef.current = parsed.cues;
      setActiveSubtitles(findActiveCues(parsed.cues, currentTime));
    }).catch(() => { if (!cancelled) { parsedCuesRef.current = []; setActiveSubtitles([]); } });
    return () => { cancelled = true; };
  }, [source?.url, source?.subtitles, subtitlePrefs?.preferredLanguage, playbackHeaders]);

  useEffect(() => {
    if (parsedCuesRef.current.length) {
      setActiveSubtitles(findActiveCues(parsedCuesRef.current, currentTime));
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
    // Try next provider (Momo ↔ Niko)
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
    setLoadingStream(false);
    setError("We don't have a working stream for this episode right now.");
  }, [activeProviders, serverIndex]);

  const handleProviderBlockedRef = useRef(handleProviderBlocked);
  useEffect(() => { handleProviderBlockedRef.current = handleProviderBlocked; }, [handleProviderBlocked]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem("aniraku.watch.preferences").then((stored) => {
      if (!active || !stored) return;
      const preferences = JSON.parse(stored) as WatchPreferences;
      if (typeof preferences.autoNext === "boolean") setAutoNext(preferences.autoNext);
      if (typeof preferences.speed === "number" && [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(preferences.speed)) setSpeed(preferences.speed);
    }).catch(() => {}).finally(() => { if (active) setPreferencesReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    void AsyncStorage.setItem("aniraku.watch.preferences", JSON.stringify({ autoNext, speed })).catch(() => {});
  }, [autoNext, preferencesReady, speed]);

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
    const existingSourceMounted = sourceMounted.current;
    const forceThisRequest = forceRefresh.current;
    forceRefresh.current = false;
    const hasInitial = initialDirect.length > 0 || initialProxies.length > 0;

    setError(null);
    if (hasInitial && !existingSourceMounted && !forceThisRequest) {
      setStream(initial);
      setPlaybackHeaders(activeProvider.headers);
      // Direct → proxy fallback
      if (initialDirect.length) {
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
    } else if (!hasInitial) {
      setLoadingStream(true);
    }

    const cacheKey = streamCacheKey(activeProvider, episode);
    const cached = streamCache.current.get(cacheKey);
    if (!forceThisRequest && cached && Date.now() - cached.savedAt < STREAM_CACHE_TTL_MS) {
      const cachedDirect = directSources(cached.data);
      const cachedProxies = proxySources(cached.data);
      if (!sourceMounted.current && (cachedDirect.length || cachedProxies.length)) {
        setStream(cached.data);
        setPlaybackHeaders(cached.data.headers ?? activeProvider.headers);
        if (cachedDirect.length) {
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
        if (!refreshedDirect.length && !refreshedProxies.length) {
          if (!hasInitial || forceThisRequest) handleProviderBlockedRef.current("stream");
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
  }, [activeProvider, animeId, applySkipSegments, episode, futureRelease, language, refreshNonce]);

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
      const response = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types%5B%5D=op&types%5B%5D=ed&episodeLength=0`, { headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      if (!response.ok) { void AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), segments: null })).catch(() => {}); return; }
      const segments = normalizeAniSkipSegments(await response.json());
      if (cancelled) return;
      applySkipSegments(segments);
      void AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), segments: segments.intro || segments.outro ? segments : null })).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; controller.abort(); };
  }, [animeId, animeQuery.data, applySkipSegments, episode]);

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

  // ── Auto-skip ──
  useEffect(() => {
    if (!skipKind) return;
    const interval = skipSegments[skipKind];
    if (!interval || autoSkipped.current[skipKind]) return;
    autoSkipped.current[skipKind] = true;
    videoRef.current?.seek(interval.endTime);
  }, [skipKind, skipSegments]);

  // ── Video source URL ──
  const videoSourceUri = useMemo(() => {
    if (!source) return undefined;
    const directHeaders = nativePlaybackHeaders(playbackHeaders);
    if (useSourceProxy) return anirakuProxyUrl(source.url, directHeaders);
    return source.url;
  }, [source?.url, useSourceProxy, playbackHeaders]);

  const videoSourceHeaders = useMemo(() => {
    if (useSourceProxy) return undefined;
    return nativePlaybackHeaders(playbackHeaders);
  }, [useSourceProxy, playbackHeaders]);

  const videoContentType = useMemo(() => {
    if (!source) return undefined;
    const t = getPlaybackType(source);
    return t === "hls" ? "m3u8" : t === "dash" ? "mpd" : undefined;
  }, [source?.url]);

  // ── Actions ──
  const selectLanguage = (next: Language) => {
    if (!providers[next].length || next === language) return;
    videoRef.current?.pause();
    blockedProviders.current.clear();
    refreshAttempted.current.clear();
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    sourceMounted.current = false;
    sourceFailureHandled.current = null;
    activeProviderId.current = null;
    setStream(null);
    setSource(null);
    setUseSourceProxy(false);
    setPlaybackHeaders(undefined);
    setLoadingStream(true);
    setLanguage(next);
    setServerIndex(0);
    setError(null);
  };

  const selectServer = (index: number) => {
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    sourceMounted.current = false;
    sourceFailureHandled.current = null;
    videoRef.current?.pause();
    setSource(null);
    setUseSourceProxy(false);
    setAdaptiveBitrateCap(null);
    setLoadingStream(true);
    setShowSourcePicker(false);
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
    setSource(next);
    setUseSourceProxy(isProxySource(next));
    setSourceRevision((v) => v + 1);
    setPlaybackHeaders(stream?.headers ?? activeProvider?.headers);
    setRequestedQuality(isAutoQuality(next) ? "auto" : next.quality || "auto");
    setShowQualityPicker(false);
  };

  const selectAdaptiveQuality = async (choice: WatchQualityOption) => {
    if (!activeProvider || !source) return;
    if (choice.isAdaptiveCap) {
      if (!isAutoQuality(source)) return;
      setAdaptiveBitrateCap(choice.maxVideoBitrate ?? null);
      setRequestedQuality("auto");
      setShowQualityPicker(false);
      return;
    }
    if (choice.source) { selectQuality(choice.source); return; }
    if (choice.requestQuality === "auto" && isAutoQuality(source)) { setRequestedQuality("auto"); setShowQualityPicker(false); return; }
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
    markIntentionalSeek(Math.max(0, currentTime + seconds));
    videoRef.current?.seek(currentTime + seconds);
  };

  const skip = (kind: SkipKind) => {
    const target = skipSegments[kind]?.endTime;
    if (target) { markIntentionalSeek(target); videoRef.current?.seek(target); }
  };

  const retry = () => {
    if (!activeProvider) return;
    blockedProviders.current.delete(activeProvider.id);
    refreshAttempted.current.delete(activeProvider.id);
    forceRefresh.current = true;
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

  const jumpToEpisodePage = () => {
    const target = Number.parseInt(episodeJump, 10);
    if (!Number.isFinite(target) || target < 1 || target > canonicalEpisodes.length) return;
    setEpisodeSearch("");
    setEpisodePage(episodePageFor(target));
    setEpisodeJump("");
  };

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

  const seekFromBar = (event: { nativeEvent: { locationX: number } }) => {
    if (duration > 0 && progressWidth > 0) {
      const target = Math.max(0, Math.min(duration, (event.nativeEvent.locationX / progressWidth) * duration));
      markIntentionalSeek(target);
      videoRef.current?.seek(target);
    }
  };

  const enterFullscreen = () => {
    setShowSettings(false);
    setManualFullscreen(true);
    if (Platform.OS !== "web") void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  };

  const exitFullscreen = () => {
    setManualFullscreen(false);
    if (Platform.OS !== "web") void ScreenOrientation.unlockAsync().catch(() => {});
  };

  const toggleSpeedLock = () => {
    if (speedLocked) { setSpeed(lockedSpeed.current); setSpeedLocked(false); }
    else { lockedSpeed.current = speed; setSpeed(2); setSpeedLocked(true); }
  };

  const enterPiP = useCallback(() => {
    if (Platform.OS === "android") {
      videoRef.current?.enterPictureInPicture();
    }
  }, []);

  useEffect(() => {
    if (!manualFullscreen || Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { exitFullscreen(); return true; });
    return () => subscription.remove();
  }, [manualFullscreen]);

  useEffect(() => {
    if (!source || !showControls || showSettings || showSourcePicker || showQualityPicker) return;
    const timer = setTimeout(() => setShowControls(false), 3_000);
    return () => clearTimeout(timer);
  }, [showControls, showSettings, showSourcePicker, showQualityPicker, source?.url]);

  const onProgressLayout = (event: LayoutChangeEvent) => setProgressWidth(event.nativeEvent.layout.width);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const buffered = duration > 0 && playableDuration > 0 ? Math.min(100, (playableDuration / duration) * 100) : 0;

  const displayedQualityOptions: WatchQualityOption[] = source
    ? (adaptiveCapOptions.length ? adaptiveCapOptions : sourceQualityOptions)
    : sourceQualityOptions.map((item) => ({ id: item.id, label: item.label, requestQuality: item.requestQuality, source: item.source }));

  return <NativeScreen scroll={false} style={styles.fill}>
    <StatusBar hidden={manualFullscreen} />
    {watchBackdrop ? <View pointerEvents="none" style={wp.watchBackdrop}><Image source={{ uri: watchBackdrop }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={wp.watchBackdropMask} /></View> : null}
    {!manualFullscreen ? <View style={styles.top}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}><AppIcon name="chevron-left" size={22} color={nothing.white} /></Pressable>
      <View style={styles.topCopy}><Text style={styles.title} numberOfLines={1}>{title}</Text><Text style={styles.episodeLabel}>EPISODE {String(episode).padStart(2, "0")}</Text></View>
    </View> : null}

    <View style={[styles.videoShell, manualFullscreen && ps.videoShellFullscreen]}>
      {source ? <GestureLayer currentTime={currentTime} duration={duration} onSeek={(delta) => { videoRef.current?.seek(currentTime + delta); }} onDoubleTapLeft={() => seek(-10)} onDoubleTapRight={() => seek(10)}>
        <Video ref={videoRef} style={styles.video} source={{ uri: videoSourceUri, headers: videoSourceHeaders, type: videoContentType }}
          paused={!isPlaying} rate={speed} resizeMode="contain"
          onLoad={(data: OnLoadData) => { setDuration(data.duration); sourceFirstFrame.current = true; sourceStarted.current = true; setPlayerStatus("playing"); }}
          onProgress={(data: OnProgressData) => { setCurrentTime(data.currentTime); setPlayableDuration(data.playableDuration); }}
          onBuffer={(data: OnBufferData) => { setBuffering(data.isBuffering); }}
          onError={() => { setPlayerStatus("error"); if (!useSourceProxy) { setUseSourceProxy(true); setSourceRevision((v) => v + 1); return; } handleProviderBlockedRef.current("player"); }}
          onEnd={() => {
            const reachedEnd = duration > 30 && currentTime >= Math.max(1, duration - 2);
            if (!sourceStarted.current || !reachedEnd) return;
            if (auth.user) {
              history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, progress: duration || currentTime, duration: duration || currentTime });
              if (providerSync.connected.length) providerSync.pushProgress.mutate({ animeId, episode, progress: Math.floor(duration || currentTime), status: "completed" });
            }
            const followingEpisode = canonicalEpisodes.find((item) => item.number > episode)?.number;
            if (autoNext && followingEpisode) router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(followingEpisode), title, image } } as never);
          }}
        />
        {subtitlePrefs ? <SubtitleRenderer cues={activeSubtitles} preferences={subtitlePrefs} /> : null}
      </GestureLayer>
        : <View style={styles.videoPlaceholder}>
          {loadingServers ? <ProviderDiscoveryLoader attempt={serverAttempt} /> : loadingStream ? <View style={styles.thumbnailLoading}>
            <Image source={{ uri: selectedEpisode?.thumbnail || watchBackdrop || image || "" }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
            <View style={styles.thumbnailLoadingShade} />
            <View style={styles.thumbnailLoadingContent}><View style={styles.thumbnailPlay}><AppIcon name="play" size={18} color={nothing.black} /></View><Text style={styles.thumbnailEpisode}>EPISODE {episode}</Text><Text numberOfLines={2} style={styles.thumbnailTitle}>{selectedEpisode?.title || title}</Text><View style={styles.thumbnailProgress}><View style={styles.thumbnailProgressFill} /></View><Text style={styles.thumbnailStatus}>STARTING VIDEO</Text></View>
          </View> : error ? <Text style={styles.errorText}>{error}</Text> : <Text style={styles.placeholderText}>PREPARING VIDEO</Text>}
        </View>}

      {/* ── Controls overlay ── */}
      {source && showControls ? <View style={styles.playerOverlay} pointerEvents="box-none">
        <View style={styles.overlayTop}>
          <View style={styles.sourcePill}><Signal label={buffering ? "BUFFERING" : `${language.toUpperCase()} · ${activeProvider?.label || "PLAYING"}`} tone={buffering ? "muted" : "live"} /></View>
          <View style={styles.overlayActions}>
            {displayedQualityOptions.length > 1 ? <Pressable onPress={() => setShowQualityPicker((v) => !v)} style={[styles.overlayBtn, showQualityPicker && styles.overlayBtnActive]}><Text style={styles.overlayBtnText}>{displayedQuality.toUpperCase()}</Text></Pressable> : null}
            <Pressable onPress={() => setShowSourcePicker((v) => !v)} style={[styles.overlayBtn, showSourcePicker && styles.overlayBtnActive]}><AppIcon name="headphones" size={18} color={nothing.white} /></Pressable>
            <Pressable onPress={() => setShowSubtitleSettings(true)} style={styles.overlayBtn}><AppIcon name="subtitles" size={18} color={nothing.white} /></Pressable>
            <Pressable onPress={toggleSpeedLock} style={[styles.overlayBtn, speedLocked && styles.overlayBtnActive]}><Text style={styles.overlayBtnText}>{speedLocked ? `${speed}×🔒` : `${speed}×`}</Text></Pressable>
            <Pressable onPress={() => { setRotationLocked((v) => !v); if (!rotationLocked) void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {}); else void ScreenOrientation.unlockAsync().catch(() => {}); }} style={[styles.overlayBtn, rotationLocked && styles.overlayBtnActive]}><AppIcon name={rotationLocked ? "lock" : "lock-open-variant"} size={18} color={nothing.white} /></Pressable>
            <Pressable onPress={manualFullscreen ? exitFullscreen : enterFullscreen} style={styles.overlayBtn}><AppIcon name={manualFullscreen ? "fullscreen-exit" : "fullscreen"} size={18} color={nothing.white} /></Pressable>
            {Platform.OS === "android" ? <Pressable onPress={enterPiP} style={styles.overlayBtn}><AppIcon name="picture-in-picture-bottom-right" size={18} color={nothing.white} /></Pressable> : null}
            <Pressable onPress={() => setShowSettings((v) => !v)} style={[styles.overlayBtn, showSettings && styles.overlayBtnActive]}><AppIcon name="tune-variant" size={18} color={nothing.white} /></Pressable>
          </View>
        </View>

        <View style={styles.centerControls}>
          <Pressable onPress={() => seek(-10)} style={styles.seekBtn}><AppIcon name="rewind-10" size={30} color={nothing.white} /></Pressable>
          <Pressable onPress={() => setIsPlaying((p) => !p)} style={styles.heroPlay}>{buffering ? <ActivityIndicator color={nothing.black} /> : <AppIcon name={isPlaying ? "pause" : "play"} size={32} color={nothing.black} />}</Pressable>
          <Pressable onPress={() => seek(10)} style={styles.seekBtn}><AppIcon name="fast-forward-10" size={30} color={nothing.white} /></Pressable>
        </View>

        <View style={styles.overlayBottom}>
          <View style={styles.contextActions}>
            {resumePosition ? <Pressable onPress={() => { pendingResume.current = resumePosition; videoRef.current?.seek(resumePosition); setResumePosition(null); }} style={styles.resumeBtn}><AppIcon name="play" size={14} color={nothing.white} /><Text style={styles.resumeBtnText}>{`RESUME ${formatTime(resumePosition)}`}</Text></Pressable> : null}
            {skipKind ? <Pressable onPress={() => skip(skipKind)} style={styles.skipBtn}><Text style={styles.skipBtnText}>{`SKIP ${skipKind.toUpperCase()}`}</Text></Pressable> : null}
          </View>
          <View style={styles.timelineBlock}>
            <Pressable onLayout={onProgressLayout} onPress={seekFromBar} style={styles.timeline}>
              <View style={[styles.timelineBuffered, { width: `${buffered}%` }]} />
              <View style={[styles.timelinePlayed, { width: `${progress}%` }]} />
            </Pressable>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeMeta}>{buffering ? "BUFFERING" : displayedQuality.toUpperCase()}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        </View>
      </View> : null}

      {/* ── Quality picker ── */}
      {source && showQualityPicker ? <View style={ps.qualityOverlay}>
        <View style={ps.qualityHeading}><DotLabel>QUALITY</DotLabel><Pressable onPress={() => setShowQualityPicker(false)}><AppIcon name="close" size={18} color={nothing.muted} /></Pressable></View>
        <View style={ps.qualityChoices}>{displayedQualityOptions.map((item: WatchQualityOption) => {
          const selected = source ? displayedQuality.toLowerCase() === item.label.toLowerCase() : false;
          return <Pressable key={item.id} onPress={() => source ? void selectAdaptiveQuality(item) : item.source && selectQuality(item.source)} style={[ps.qualityChoice, selected && ps.qualityChoiceActive]}>
            <Text style={[ps.qualityChoiceText, selected && ps.qualityChoiceTextActive]}>{item.label.toUpperCase()}</Text>
            <Text style={[ps.qualityChoiceState, selected && ps.qualityChoiceStateActive]}>{selected ? "ACTIVE" : "SELECT"}</Text>
          </Pressable>;
        })}</View>
      </View> : null}

      {/* ── Source picker ── */}
      {source && showSourcePicker ? <View style={ps.sourceOverlay}>
        <View style={ps.qualityHeading}><DotLabel>PROVIDER</DotLabel><Pressable onPress={() => setShowSourcePicker(false)}><AppIcon name="close" size={18} color={nothing.muted} /></Pressable></View>
        <View style={styles.languageRow}>{(["sub", "dub"] as Language[]).map((item) => <Pressable key={item} onPress={() => selectLanguage(item)} disabled={!providers[item].length} style={[styles.language, language === item && styles.languageActive, !providers[item].length && styles.languageDisabled]}><Text style={[styles.languageText, language === item && styles.languageTextActive]}>{item === "sub" ? `SUB · ${providers.sub.length}` : `DUB · ${providers.dub.length}`}</Text></Pressable>)}</View>
        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>{activeProviders.map((provider, index) => <Pressable key={provider.id} onPress={() => selectServer(index)} style={[ps.sourceItem, index === serverIndex && ps.sourceItemActive]}>
          <View style={ps.sourceItemName}><View style={[ps.sourceSignal, index === serverIndex && ps.sourceSignalActive]} /><Text style={[ps.sourceItemText, index === serverIndex && ps.sourceItemTextActive]}>{provider.label}</Text></View>
          <Text style={[ps.sourceItemState, index === serverIndex && ps.sourceItemTextActive]}>{index === serverIndex ? "PLAYING" : "SELECT"}</Text>
        </Pressable>)}</ScrollView>
      </View> : null}

      {/* ── Settings panel ── */}
      {source && showSettings ? <View style={ps.settingsOverlay}>
        <ScrollView contentContainerStyle={ps.settingsContent} showsVerticalScrollIndicator={false}>
          <View style={ps.settingsHeading}><DotLabel>SETTINGS</DotLabel><Pressable onPress={() => setShowSettings(false)}><AppIcon name="close" size={18} color={nothing.muted} /></Pressable></View>
          <View style={ps.settingsSection}><DotLabel>PLAYBACK</DotLabel><View style={styles.toggleRow}><Pressable onPress={() => setAutoNext((v) => !v)} style={[styles.toggle, autoNext && styles.toggleOn]}><Text style={[styles.toggleText, autoNext && styles.toggleTextOn]}>AUTO NEXT {autoNext ? "ON" : "OFF"}</Text></Pressable></View>
            <View style={styles.speedRow}>{[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => <Pressable key={value} onPress={() => { setSpeed(value); lockedSpeed.current = value; }} style={[styles.speed, speed === value && styles.speedActive]}><Text style={[styles.speedText, speed === value && styles.speedTextActive]}>{value}×</Text></Pressable>)}</View></View>
          <View style={ps.settingsSection}><DotLabel>STATUS</DotLabel>
            <Text style={ps.diagnosticLine}>{`SERVER · ${activeProvider?.label || "UNKNOWN"}`}</Text>
            <Text style={ps.diagnosticLine}>{`DELIVERY · ${useSourceProxy ? "PROXY" : "DIRECT"}`}</Text>
            <Text style={ps.diagnosticLine}>{`QUALITY · ${displayedQuality.toUpperCase()}`}</Text>
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
            <View style={styles.qualityRow}><Pressable onPress={() => setSubtitlePrefs((p) => p ? { ...p, enabled: false } : p)} style={[styles.quality, subtitlePrefs && !subtitlePrefs.enabled && styles.qualityActive]}><Text style={[styles.qualityText, subtitlePrefs && !subtitlePrefs.enabled && styles.qualityTextActive]}>OFF</Text></Pressable>
              {source.subtitles.map((sub) => <Pressable key={sub.url} onPress={() => setSubtitlePrefs((p) => p ? { ...p, enabled: true, preferredLanguage: sub.lang || "en" } : p)} style={[styles.quality, subtitlePrefs?.enabled && subtitlePrefs.preferredLanguage === sub.lang && styles.qualityActive]}><Text style={[styles.qualityText, subtitlePrefs?.enabled && subtitlePrefs.preferredLanguage === sub.lang && styles.qualityTextActive]}>{sub.label || sub.lang || "Track"}</Text></Pressable>)}</View>
            <Pressable onPress={() => setShowSubtitleSettings(true)} style={[ps.downloadBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: nothing.line }]}><Text style={[ps.downloadBtnText, { color: nothing.white }]}>SUBTITLE SETTINGS</Text></Pressable>
          </View> : null}
          <View style={ps.settingsSection}><SleepTimer onExpire={() => { setIsPlaying(false); videoRef.current?.pause(); }} onClear={() => {}} /></View>
        </ScrollView>
      </View> : null}

      {(source || showControls) && !showSettings && !showSourcePicker && !showQualityPicker ? <Pressable onPress={() => setShowControls((v) => { if (v) { setShowSettings(false); setShowSourcePicker(false); setShowQualityPicker(false); } return !v; })} style={styles.revealZone} /> : null}
    </View>

    {/* ── Error ── */}
    {error ? <View style={styles.errorAction}><NothingCard style={styles.errorCard}><DotLabel tone="muted">{futureRelease ? "FUTURE EPISODE" : "VIDEO UNAVAILABLE"}</DotLabel><Text style={styles.errorCopy}>{error}</Text>{futureRelease ? null : <NothingButton label="TRY AGAIN" onPress={retry} variant="outline" />}</NothingCard></View> : null}

    {/* ── Below player ── */}
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS === "android"}>
      <View style={styles.siteWatchInfo}>
        <View style={styles.watchInfoHead}>
          <View style={styles.watchInfoCopy}><DotLabel tone="live">NOW WATCHING</DotLabel><Text style={styles.siteWatchTitle}>{title}</Text><Text style={styles.siteWatchMeta}>EPISODE {episode} OF {canonicalEpisodes.length || "?"} · {language.toUpperCase()} · {activeProvider?.label || "FINDING SOURCE"}</Text></View>
          <Signal label={source ? "PLAYING" : loadingServers ? "LOOKING" : error ? "CHECK EP" : "READY"} tone={source ? "live" : "muted"} />
        </View>
        <View style={styles.watchNav}>
          <Pressable disabled={!previousKnownEpisode} onPress={() => previousKnownEpisode && goToEpisode(previousKnownEpisode)} style={[styles.watchNavButton, !previousKnownEpisode && styles.watchNavDisabled]}><AppIcon name="skip-previous" size={17} color={nothing.white} /><Text style={styles.watchNavText}>PREVIOUS</Text></Pressable>
          <Pressable onPress={() => openEpisodeInfo()} style={[styles.watchNavButton, styles.watchNavDetail]}><AppIcon name="information-outline" size={17} color={nothing.black} /><Text style={[styles.watchNavText, styles.watchNavTextDetail]}>EP INFO</Text></Pressable>
          <Pressable disabled={!nextKnownEpisode} onPress={nextEpisode} style={[styles.watchNavButton, !nextKnownEpisode && styles.watchNavDisabled]}><Text style={styles.watchNavText}>NEXT</Text><AppIcon name="skip-next" size={17} color={nothing.white} /></Pressable>
        </View>
      </View>
      <View style={styles.sidebarDivider} />
      <Pressable onPress={() => setShowEpisodeSidebar((v) => !v)} style={styles.episodeSidebarToggle}>
        <View><DotLabel>EPISODES</DotLabel><Text style={styles.episodeSidebarTitle}>Episodes ({filteredEpisodes.length}{episodeSearch ? ` of ${canonicalEpisodes.length}` : ""})</Text></View>
        <AppIcon name={showEpisodeSidebar ? "chevron-up" : "chevron-down"} size={22} color={nothing.white} />
      </Pressable>
      {showEpisodeSidebar ? <View style={styles.episodeSidebar}>
        <View style={styles.episodeSearchRow}><AppIcon name="magnify" size={18} color={nothing.muted} /><TextInput value={episodeSearch} onChangeText={setEpisodeSearch} placeholder="Search episodes or number" placeholderTextColor={nothing.dim} style={styles.episodeSearch} returnKeyType="done" /></View>
        {canonicalEpisodes.length > 50 ? <View style={styles.episodeJumpRow}><TextInput value={episodeJump} onChangeText={setEpisodeJump} placeholder="Jump to episode #" placeholderTextColor={nothing.dim} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={jumpToEpisodePage} style={styles.episodeJumpInput} /><Pressable onPress={jumpToEpisodePage} style={[styles.episodeJumpButton, (!episodeJump.trim() || Number(episodeJump) < 1 || Number(episodeJump) > canonicalEpisodes.length) && styles.episodeJumpDisabled]}><Text style={styles.episodeJumpButtonText}>JUMP</Text></Pressable></View> : null}
        {episodeQuery.isPending ? <View style={styles.episodeLoading}><ActivityIndicator color={nothing.white} /><Text style={styles.episodeLoadingText}>LOADING EPISODES</Text></View> : filteredEpisodes.length ? <><View style={styles.episodeInfoBar}><Text style={styles.episodePageMeta}>{`PAGE ${safeEpisodePage + 1} / ${totalEpisodePages} · ${filteredEpisodes.length} EPISODES`}</Text></View>{totalEpisodePages > 1 ? <View style={styles.episodePager}><Pressable disabled={safeEpisodePage === 0} onPress={() => setEpisodePage((v) => Math.max(0, v - 1))} style={[styles.episodePagerButton, safeEpisodePage === 0 && styles.episodePagerDisabled]}><AppIcon name="chevron-left" size={17} color={nothing.white} /><Text style={styles.episodePagerText}>PREV</Text></Pressable><Pressable disabled={safeEpisodePage >= totalEpisodePages - 1} onPress={() => setEpisodePage((v) => Math.min(totalEpisodePages - 1, v + 1))} style={[styles.episodePagerButton, safeEpisodePage >= totalEpisodePages - 1 && styles.episodePagerDisabled]}><Text style={styles.episodePagerText}>NEXT</Text><AppIcon name="chevron-right" size={17} color={nothing.white} /></Pressable></View> : null}<View style={styles.episodeGrid}>{pagedEpisodes.map((item) => <EpisodeChoice key={item.number} item={item} selected={item.number === episode} onSelect={goToEpisode} onInfo={openEpisodeInfo} />)}</View></> : <Text style={styles.emptyEpisodeText}>{episodeSearch ? "No episodes match your search." : "No episodes are listed for this title."}</Text>}
      </View> : null}
      <View style={styles.watchCommunitySection}>
        <DotLabel>EPISODE ACTIVITY</DotLabel>
        <View style={styles.ratingRow}><Text style={styles.ratingPrompt}>{currentRating ? `YOU RATED ${currentRating}/10` : "RATE THIS EPISODE"}</Text><View style={styles.ratingChoices}>{Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <Pressable key={score} onPress={() => { if (!auth.user) { router.push("/auth" as never); return; } ratings.setRating.mutate({ episode, score }); }} style={[styles.ratingChoice, currentRating >= score && styles.ratingChoiceActive]}><Text style={[styles.ratingChoiceText, currentRating >= score && styles.ratingChoiceTextActive]}>{score}</Text></Pressable>)}</View></View>
        <AnimeComments animeId={animeId} episodeNumber={episode} />
      </View>
    </ScrollView>

    <SubtitleSettings visible={showSubtitleSettings} onClose={() => setShowSubtitleSettings(false)} onChanged={setSubtitlePrefs} />
  </NativeScreen>;
}

// ── Styles ──
const wp = StyleSheet.create({
  watchBackdrop: { position: "absolute", top: 0, left: 0, right: 0, height: 540, opacity: 0.42 },
  watchBackdropMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,9,9,0.82)" },
});

const ps = StyleSheet.create({
  videoShellFullscreen: { position: "absolute", zIndex: 20, top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", aspectRatio: undefined },
  qualityOverlay: { position: "absolute", zIndex: 5, top: 56, right: 8, width: 212, gap: 9, padding: 12, borderWidth: 1, borderColor: "rgba(246,246,242,0.3)", borderRadius: 5, backgroundColor: "rgba(9,9,9,0.97)" },
  qualityHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qualityChoices: { borderTopWidth: 1, borderTopColor: nothing.line },
  qualityChoice: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  qualityChoiceActive: { borderBottomColor: nothing.red, backgroundColor: "rgba(255,77,77,0.06)" },
  qualityChoiceText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900" },
  qualityChoiceTextActive: { color: nothing.red },
  qualityChoiceState: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800" },
  qualityChoiceStateActive: { color: nothing.red },
  sourceOverlay: { position: "absolute", zIndex: 6, left: 8, right: 8, bottom: 8, maxHeight: "65%", gap: 10, padding: 12, borderWidth: 1, borderColor: "rgba(246,246,242,0.3)", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, backgroundColor: "rgba(9,9,9,0.97)" },
  sourceItem: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  sourceItemActive: { borderBottomColor: nothing.red, backgroundColor: "rgba(255,77,77,0.06)" },
  sourceItemName: { flexDirection: "row", alignItems: "center", gap: 8 },
  sourceSignal: { width: 7, height: 7, borderRadius: 99, backgroundColor: nothing.dim },
  sourceSignalActive: { backgroundColor: nothing.red },
  sourceItemText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900" },
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
  title: { color: nothing.white, fontSize: 15, fontWeight: "900" },
  episodeLabel: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  videoShell: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000000", overflow: "hidden" },
  video: { flex: 1 },
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
  playerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 3, justifyContent: "space-between", padding: 12 },
  overlayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sourcePill: { flexDirection: "row", alignItems: "center", gap: 7 },
  overlayActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  overlayBtn: { minWidth: 36, height: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.74)", borderWidth: 1, borderColor: "rgba(246,246,242,0.35)" },
  overlayBtnActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.15)" },
  overlayBtnText: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.25 },
  centerControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40 },
  seekBtn: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  heroPlay: { width: 62, height: 62, alignItems: "center", justifyContent: "center", backgroundColor: nothing.white, borderRadius: 31 },
  overlayBottom: { gap: 8 },
  contextActions: { alignSelf: "flex-end", alignItems: "flex-end", gap: 6 },
  resumeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.8)" },
  resumeBtnText: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900" },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4, backgroundColor: nothing.red },
  skipBtnText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  timelineBlock: { gap: 6, paddingTop: 3 },
  timeline: { height: 4, backgroundColor: "rgba(246,246,242,0.2)", borderRadius: 2, overflow: "hidden" },
  timelineBuffered: { position: "absolute", top: 0, left: 0, height: "100%", backgroundColor: "rgba(246,246,242,0.3)" },
  timelinePlayed: { position: "absolute", top: 0, left: 0, height: "100%", backgroundColor: nothing.red },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900" },
  timeMeta: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  revealZone: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  errorAction: { paddingHorizontal: 16, paddingTop: 12 },
  errorCard: { gap: 8, padding: 14 },
  errorCopy: { color: nothing.muted, fontSize: 13, lineHeight: 18 },
  scroll: { padding: 16, gap: 14 },
  siteWatchInfo: { gap: 14 },
  watchInfoHead: { minHeight: 68, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  watchInfoCopy: { flex: 1, gap: 5 },
  siteWatchTitle: { color: nothing.white, fontSize: 25, fontWeight: "900", letterSpacing: -0.6 },
  siteWatchMeta: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "800", letterSpacing: 0.4, lineHeight: 14 },
  watchNav: { flexDirection: "row", gap: 7 },
  watchNavButton: { flex: 1, minHeight: 41, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  watchNavDisabled: { opacity: 0.28 },
  watchNavDetail: { backgroundColor: nothing.white, borderColor: nothing.white },
  watchNavText: { color: nothing.white, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.2 },
  watchNavTextDetail: { color: nothing.black },
  sidebarDivider: { height: 1, backgroundColor: nothing.line, marginVertical: 2 },
  episodeSidebarToggle: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  episodeSidebarTitle: { color: nothing.white, fontSize: 17, fontWeight: "900", marginTop: 4 },
  episodeSidebar: { gap: 10 },
  episodeSearchRow: { height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: nothing.line, borderRadius: 4, backgroundColor: nothing.surface },
  episodeSearch: { flex: 1, color: nothing.white, fontSize: 13, paddingVertical: 0 },
  episodeJumpRow: { minHeight: 38, flexDirection: "row", gap: 7 },
  episodeJumpInput: { flex: 1, color: nothing.white, fontSize: 12, paddingHorizontal: 11, paddingVertical: 0, borderWidth: 1, borderColor: nothing.line, borderRadius: 4, backgroundColor: nothing.surface },
  episodeJumpButton: { minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, borderRadius: 4, backgroundColor: nothing.white },
  episodeJumpDisabled: { opacity: 0.38 },
  episodeJumpButtonText: { color: nothing.black, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.25 },
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
  providerDiscoverySignal: { width: "100%", height: 4, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,77,77,0.18)" },
  providerDiscoveryCore: { width: "44%", height: "100%", alignSelf: "center", borderRadius: 4, backgroundColor: nothing.red },
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
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.32, 1] });
  return <View style={styles.providerDiscovery}>
    <Animated.View style={[styles.providerDiscoverySignal, { opacity, transform: [{ scaleX: scale }] }]}><View style={styles.providerDiscoveryCore} /></Animated.View>
    <View style={styles.providerDiscoveryCopy}>
      <Text style={styles.providerDiscoveryTitle}>FINDING PROVIDERS</Text>
      <Text style={styles.providerDiscoveryDetail}>CHECKING MOMO & NIKO</Text>
    </View>
  </View>;
}
