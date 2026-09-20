import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { parseRouteEpisode, parseRouteId } from "@/lib/route-params";
import { ActivityIndicator, Alert, Animated, BackHandler, Dimensions, FlatList, LayoutChangeEvent, Linking, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import Video, { type OnProgressData, type OnLoadData, type OnBufferData, type VideoRef } from "react-native-video";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Brightness from "expo-brightness";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft, Gear, Speedometer, Subtitles, SpeakerHigh, SpeakerNone,
  SkipBack, SkipForward, Play, Pause, ArrowsOut, ArrowsIn, Check, X,
  Lock, Rewind, FastForward, Download, DownloadSimple, CaretLeft, CaretRight,
  Sun
} from "phosphor-react-native";
import { anirakuProxyUrl, getAnimeMetadata, getEpisodes, getServers, getStream, getPlaybackType, isAnirakuProxyUrl, nativePlaybackHeaders } from "@/lib/aniraku-api";
import { getAnimeById, getKnownMalId, getMalIdByAnimeId } from "@/lib/anilist";
import { enrichEpisodesWithTmdb } from "@/lib/tmdb-episodes";
import {
  activeSkipKind,
  autoQualityLine,
  chapterTrackSegments,
  directSources,
  embedSources,
  episodePageCount,
  episodePageFor,
  episodePageSlice,
  hasConfirmedPlaybackStart,
  humanPlayerError,
  isAutoQuality,
  isHentaiAnime,
  isOfflinePlaybackSource,
  isProxySource,
  isResumablePosition,
  liveRenditionHeight,
  resolveHistoryResume,
  resolveResumeOnSwitch,
  resolveSkipFetchStatus,
  FUTURE_RELEASE_MESSAGE,
  isConfirmedFutureRelease,
  mergeSkipSegments,
  nativeSources,
  normalizeAniSkipSegments,
  providerSkipSegments,
  proxySources,
  shouldPreferEmbed,
  shouldRefreshSameProvider,
  shouldRetryProxiedSourceAfterDirect,
  shouldApplyInitialHistoryResume,
  shouldMountReplacementSource,
  shouldHoldRebufferWatermark,
  streamCacheKey,
  type Language,
  type RetryReason,
  type SkipFetchStatus,
  type SkipKind,
  type SkipSegments,
} from "@/lib/watch-engine";
import { animeTitle, type Episode, type Server, type StreamResponse, type StreamSource } from "@/lib/types";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useEpisodeRatings } from "@/hooks/use-episode-ratings";
import { AnimeComments } from "@/components/anime-comments";
import { useProviderSync } from "@/hooks/use-provider-sync";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { findOfflineDownload, removeOfflineDownload, selectDownloadSourceForQuality, selectMaximumQualityDownload, startMaximumQualityDownload, buildBackendDownloadOptions, hasQualityBackendDownloads, sortBackendDownloadOptions, type BackendDownloadOption, type OfflineDownload } from "@/lib/downloads";
import { adaptiveBitrateCapOptions, selectedWatchQuality, watchQualityOptions, type WatchQualityOption } from "@/lib/watch-quality";
import { buildDashQualityOptions, buildHlsQualityOptions, hlsVariantsCacheKey, originalStreamUrl, parseDashRepresentations, parseHlsMasterVariants, shouldRefetchVariants, shouldRefreshMasterOnVariantError, variantUrlForHeight, type HlsVariant, type VariantsCacheScope } from "@/lib/hls-variants";
import { AppIcon } from "@/components/app-icon";
import { EmbedPlayer } from "@/components/embed-player";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { SubtitleRenderer } from "@/components/subtitle-renderer";
import { SleepTimerPill } from "@/components/sleep-timer";
import { chrome } from "@/components/player/chrome-styles";
import { parseSubtitle, detectSubtitleFormat, detectSubtitleFormatFromContent, findActiveCues, matchSubtitleTrack, type SubtitleCue } from "@/lib/subtitle-parser";
import { loadSubtitlePreferences, saveSubtitlePreferences, SUBTITLE_FONTS, BG_OPACITY_PRESETS, OUTLINE_PRESETS, type SubtitlePreferences } from "@/lib/subtitle-preferences";
import { resolveNextEpisode, resolvePrevEpisode } from "@/lib/up-next";
import { t } from "@/lib/i18n";

const EPISODE_PAGE_SIZE = 50;
const RESUME_MIN_TIME = 30;
const DOUBLE_TAP_WINDOW_MS = 200;
const TRIPLE_TAP_WINDOW_MS = 350;
const SKIP_HOLD_MS = 400;
// ── Gesture boundaries: each gesture owns its zone, no overlaps ──
const TAP_SLOP_PX = 14; // max move to still count as a tap
const SWIPE_ACTIVATE_PX = 22; // vertical travel before brightness/volume engages
const SWIPE_DIRECTION_RATIO = 1.4; // |dy| must dominate |dx| or swipe is ignored
const HORIZONTAL_CANCEL_PX = 22; // horizontal drift kills pending/hold
const LONG_PRESS_MS = 550; // still-finger delay before center-hold → 2x
const HOLD_SEEK_MS = 350; // still-finger delay before double/triple-tap-hold → continuous skip
const TAP_ACTION_COOLDOWN_MS = 150; // min gap between any action (seek/toggle) and the next
const EDGE_ZONE = 0.35; // x < 35% = brightness · x > 65% = volume · middle = 2x zone
const SEEK_ZONE = 0.4; // x < 40% = rewind · x > 60% = forward · middle = play/pause
const STREAM_CACHE_TTL_MS = 30_000;
const STARTUP_WATCHDOG_MS = 6_000;
const SKIP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ANISKIP_TIMEOUT_MS = 8_000;
const EMPTY_EPISODES: Episode[] = [];

type CachedStream = { savedAt: number; data: StreamResponse };
type WatchPreferences = { speed?: number };

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function skipCacheKey(malId: number, episode: number) {
  return `aniraku-skip-v2:${malId}:${episode}`;
}

type ProviderQualityMap = Record<string, string>;
const PROVIDER_QUALITY_KEY = "aniraku.provider-quality.v1";

async function readProviderQualityMap(): Promise<ProviderQualityMap> {
  try {
    const raw = await AsyncStorage.getItem(PROVIDER_QUALITY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed as ProviderQualityMap : {};
  } catch { return {}; }
}

/** Remembers a manual per-server quality ("1080p") so Auto can re-apply it. */
async function rememberProviderQuality(providerId: string | undefined, quality: string | null) {
  if (!providerId) return;
  try {
    const map = await readProviderQualityMap();
    if (quality) map[providerId] = quality;
    else delete map[providerId];
    await AsyncStorage.setItem(PROVIDER_QUALITY_KEY, JSON.stringify(map));
  } catch { /* preference loss is acceptable */ }
}

// ── Track 5.1: Cold-start measurement (dev only) ──
const _watchMountTime = __DEV__ ? Date.now() : 0;
if (__DEV__) console.log("[watch] mount t=0");

export default function WatchScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; episode?: string | string[]; title?: string; image?: string }>();
  const animeId = parseRouteId(params.id) ?? -1;
  const invalidId = animeId <= 0;
  const episode = parseRouteEpisode(params.episode);
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
  // Real renditions parsed out of the provider's Auto URL (HLS master or DASH
  // manifest) — kept around while a parsed variant is mounted so the menu can
  // offer Auto + siblings without re-fetching.
  const [parsedQualityOptions, setParsedQualityOptions] = useState<WatchQualityOption[] | null>(null);
  const [parsedQualityNote, setParsedQualityNote] = useState<string | null>(null);

  // ── App state ──
  const [language, setLanguage] = useState<Language>("sub");

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
  const [speed, setSpeed] = useState(1);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  type ActivePanel = "settings" | "subtitles" | "speed" | "server" | "chapters" | "source" | "quality" | "download" | null;
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [manualFullscreen, setManualFullscreen] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [episodePage, setEpisodePage] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [dragPct, setDragPct] = useState<number | null>(null);
  const [skipSegments, setSkipSegments] = useState<SkipSegments>({ intro: null, outro: null });
  // AniSkip telemetry (Track 4): distinguishes "no skip data" (empty) from
  // "request timed out" (timeout) in the error-card diagnostic line.
  const [skipFetchStatus, setSkipFetchStatus] = useState<SkipFetchStatus>("idle");
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
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [is2xSeeking, setIs2xSeeking] = useState(false);
  const [doubleTapSide, setDoubleTapSide] = useState<"left" | "right" | null>(null);
  const [doubleTapSeconds, setDoubleTapSeconds] = useState(10);
  const doubleTapAnim = useRef(new Animated.Value(0)).current;
  const doubleTapGen = useRef(0);
  const skipHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipHoldSide = useRef<"left" | "right" | null>(null);
  const doubleTapTouch = useRef(false);
  // Triple-tap tracking
  const tapCountRef = useRef(0);
  const tapCountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTripleTapRef = useRef<{ side: "left" | "right"; x: number } | null>(null);
  // Multi-tap seek: the pending jump fires on touch-UP; a held 2nd/3rd touch
  // fires it on the hold timer instead and keeps skipping while held.
  const lastActionTimeRef = useRef(0);
  const pendingMultiSeekRef = useRef<{ side: "left" | "right"; seconds: number } | null>(null);
  const holdSeekTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdSeekFiredRef = useRef(false);
  const chainSeekAppliedRef = useRef<{ side: "left" | "right"; seconds: number } | null>(null);
  // PiP hardening: availability is probed (button hides where enter fails),
  // activity pauses UI updates while the system owns the frame.
  const [pipAvailable, setPipAvailable] = useState(true);
  const [pipActive, setPipActive] = useState(false);
  const pipActiveRef = useRef(false);
  // Live ExoPlayer rendition feeding the `Auto · 720p` line.
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  // Up-next card: appears near the finish line, waits for the user — never
  // auto-plays. Manual PLAY NOW or dismiss.
  const [upNextVisible, setUpNextVisible] = useState(false);
  const upNextShownFor = useRef<string | null>(null);
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

  // Sensor landscape (normal + reversed), never a hard single-sided lock.
  // Expo's LANDSCAPE already resolves to SENSOR_LANDSCAPE on Android, but the
  // explicit platform constant keeps reversed-landscape working regardless of
  // how the mapping evolves. iOS LANDSCAPE spans both sides natively.
  const lockSensorLandscape = useCallback(() => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      void ScreenOrientation.lockPlatformAsync({ screenOrientationConstantAndroid: 6 }).catch(() => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      });
      return;
    }
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  // Fullscreen entry forces landscape even with system auto-rotate OFF (a
  // sensor lock alone keeps portrait when the user holds the phone upright,
  // which read as "fullscreen does nothing"). Fixed normal landscape;
  // exiting fullscreen unlocks again.
  const lockForceLandscape = useCallback(() => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      void ScreenOrientation.lockPlatformAsync({ screenOrientationConstantAndroid: 0 }).catch(() => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      });
      return;
    }
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  const toggleOrientationLock = useCallback(() => {
    setOrientationLocked((prev) => {
      const next = !prev;
      if (Platform.OS !== "web") {
        if (next) lockSensorLandscape();
        else void ScreenOrientation.unlockAsync().catch(() => {});
      }
      return next;
    });
  }, [lockSensorLandscape]);

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
  const skipSegmentsRef = useRef(skipSegments);
  const pendingResume = useRef<number | null>(null);
  const historyResumeRequestedFor = useRef<string | null>(null);
  const initialHistoryResumeApplied = useRef(false);
  const activeProviderId = useRef<string | null>(null);
  const lastStablePlaybackTime = useRef(0);
  const rebufferSeen = useRef(false);
  const intentionalSeekUntil = useRef(0);
  const adaptiveCapSourceUrl = useRef<string | null>(null);
  // One cache entry per master playback URL. Entries are dropped only when the
  // variants scope rotates (provider / episode / refresh / master) — opening
  // the settings sheet changes none of those, so it never re-fetches.
  const hlsVariantsCache = useRef(new Map<string, { options: WatchQualityOption[]; variants: HlsVariant[] }>());
  const parsedOptionsRef = useRef<{ key: string; options: WatchQualityOption[] } | null>(null);
  // Raw parsed renditions for the current master: downloads fetch the exact
  // variant URL for the chosen height, and the token guard re-resolves the
  // same height after a master refresh.
  const parsedVariantsRef = useRef<{ key: string; variants: HlsVariant[] } | null>(null);
  const variantsScopeRef = useRef<VariantsCacheScope | null>(null);
  // Single-refresh flag for the variant token-expiry guard: the mounted
  // variant URL that already earned its one master refresh. Reset on every
  // provider / episode / language / retry switch so a fresh mount retries once.
  const variantTokenRefreshAttempted = useRef<string | null>(null);
  const autoQualityAppliedFor = useRef<string | null>(null);

  const activeProviders = providers[language] ?? [];
  const activeProvider = activeProviders[serverIndex];

  // Embed-only catalog (hentai): the backend ships embed sources and zero
  // native ones across EVERY discovered server. Mount the first embed
  // immediately — no refresh + rotation rounds — exactly like the website.
  // This does not depend on the isAdult metadata flag, so titles whose
  // metadata lacks the flag still play.
  const discoveredServers = useMemo(() => [...providers.sub, ...providers.dub], [providers]);
  const discoveredNativeCount = useMemo(() => {
    let count = 0;
    for (const server of discoveredServers) {
      const initial = { sources: server.sources ?? [] };
      if (directSources(initial).length > 0 || proxySources(initial).length > 0) count += 1;
    }
    return count;
  }, [discoveredServers]);
  const discoveredEmbed = useMemo(() => {
    for (const server of discoveredServers) {
      const first = embedSources({ sources: server.sources ?? [] })[0];
      if (first) return first;
    }
    return null;
  }, [discoveredServers]);
  const embedOnlyCatalog = discoveredServers.length > 0 && discoveredNativeCount === 0 && discoveredEmbed != null;
  const { filteredEpisodes, totalEpisodePages, safeEpisodePage, pagedEpisodes } = useMemo(() => {
    const term = episodeSearch.trim().toLowerCase();
    let filtered = term
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
  // Backend per-quality file links, collected across ALL providers for the
  // current language — SUB and DUB option lists stay separate because
  // activeProviders is already language-filtered. Labels with a quality
  // ("Kiwi 1080p") become picker rows; plain labels ("Zoko") become the
  // single default option.
  const backendDownloadOptions = useMemo(() => sortBackendDownloadOptions(buildBackendDownloadOptions(activeProviders)), [activeProviders]);
  const backendDownloads = activeProvider?.downloads ?? [];
  // Server picker lists only providers that actually carry something to play
  // (stream sources or backend download links) — every row is backend-listed,
  // never a fixed fallback name. Original indices are kept so selectServer
  // stays aligned with activeProviders.
  const selectableProviders = useMemo(() => activeProviders
    .map((provider, index) => ({ provider, index }))
    .filter(({ provider }) => (provider.sources?.length ?? 0) > 0 || (provider.downloads?.length ?? 0) > 0),
  [activeProviders]);
  const currentRating = ratings.scoreFor(episode) ?? 0;
  const skipKind = activeSkipKind(skipSegments, currentTime);

  // ── Subtitle loading ──
  useEffect(() => { loadSubtitlePreferences().then(setSubtitlePrefs).catch(() => {}); }, []);

  const parsedCuesRef = useRef<SubtitleCue[]>([]);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;
  // Mirrors for the quality effect: it depends on scalar snapshots (url, type,
  // serialized headers) instead of these objects, so unrelated identity churn
  // never re-fetches the master — only real scope changes do.
  const sourceMirrorRef = useRef(source);
  sourceMirrorRef.current = source;
  const playbackHeadersMirrorRef = useRef(playbackHeaders);
  playbackHeadersMirrorRef.current = playbackHeaders;
  // PiP-safe mirrors: refs keep tracking while setState is paused in PiP.
  const playableDurationRef = useRef(0);

  const updateSubtitlePrefs = useCallback((patch: Partial<SubtitlePreferences>) => {
    setSubtitlePrefs((prev) => {
      const next: SubtitlePreferences = {
        enabled: prev?.enabled ?? true,
        preferredLanguage: prev?.preferredLanguage ?? "en",
        fontSize: prev?.fontSize ?? 14,
        bgOpacity: prev?.bgOpacity ?? 0.55,
        outlineThickness: prev?.outlineThickness ?? 2,
        fontFamily: prev?.fontFamily ?? "default",
        ...patch,
      };
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
    setLiveHeight(null);
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
    blockedProviders.current.clear();
    refreshAttempted.current.clear();
    variantTokenRefreshAttempted.current = null;
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

  const handleProviderBlocked = useCallback((reason: RetryReason = "player") => {
    const current = activeProviders[serverIndex];
    if (!current) return;
    // Retry honesty: the same provider is re-fetched ONCE with refresh:true;
    // afterwards we move to the next unblocked provider. The same dead URL
    // is never looped without the refresh flag (see shouldRefreshSameProvider).
    if (shouldRefreshSameProvider(reason, refreshAttempted.current.has(current.id))) {
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
        setActivePanel(null);
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
        if (typeof preferences.speed === "number" && [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(preferences.speed)) setSpeed(preferences.speed);
      } catch { /* ignore malformed */ }
    }).catch(() => {}).finally(() => { if (active) setPreferencesReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
      void AsyncStorage.setItem("aniraku.watch.preferences", JSON.stringify({ speed })).catch(() => {});
  }, [preferencesReady, speed]);

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

    // Cold backend scrapes (hentai / heavy titles) often return empty on the
    // first hits while providers spin up — poll with backoff the way the
    // website does instead of erroring after one quick retry.
    const SERVER_RETRY_DELAYS_MS = [2000, 5000, 10000];
    const fetchServers = async (attempt: number) => {
      setServerAttempt(attempt + 1);
      const [subs, dubs] = await Promise.all([
        getServers(animeId, episode, "sub").catch(() => [] as Server[]),
        getServers(animeId, episode, "dub").catch(() => [] as Server[]),
      ]);
      if (cancelled) return;
      if (!subs.length && !dubs.length && attempt < SERVER_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, SERVER_RETRY_DELAYS_MS[attempt]));
        if (cancelled) return;
        return fetchServers(attempt + 1);
      }
      setProviders({ sub: subs, dub: dubs });
      setLoadingServers(false);
      // Auto-select: preferred language > available language
      const langKey = `aniraku.lang.${animeId}`;
      const preferred = await AsyncStorage.getItem(langKey).catch(() => null) as Language | null;
      if (cancelled) return;
      if (preferred === "dub" && dubs.length) { setLanguage("dub"); }
      else if (preferred === "sub" && subs.length) { setLanguage("sub"); }
      else if (!subs.length && dubs.length) { setLanguage("dub"); }
      // Embed-only catalog (hentai): point the player at the first server
      // that actually carries an embed so it mounts on the first pass.
      const hasNativeInitial = (list: Server[]) => list.some((item) => {
        const initial = { sources: item.sources ?? [] };
        return directSources(initial).length > 0 || proxySources(initial).length > 0;
      });
      const hasEmbedInitial = (item: Server) => embedSources({ sources: item.sources ?? [] }).length > 0;
      if ((subs.length > 0 || dubs.length > 0) && !hasNativeInitial(subs) && !hasNativeInitial(dubs)) {
        const subIdx = subs.findIndex(hasEmbedInitial);
        const dubIdx = dubs.findIndex(hasEmbedInitial);
        if (subIdx >= 0 && (preferred !== "dub" || dubIdx < 0)) { setLanguage("sub"); setServerIndex(subIdx); }
        else if (dubIdx >= 0) { setLanguage("dub"); setServerIndex(dubIdx); }
      }
      // Providers come from the backend only — no fixed fallback names. When
      // it lists nothing (hentai tags often list zero servers), the honest
      // error below stands and no phantom rows ever appear.
      else if (!subs.length && !dubs.length) { setError("We don't have streaming for this episode."); }
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

    // Embed-only catalog (hentai): mount the first embed and skip the native
    // network round trip entirely — the website plays these the same way.
    if (embedOnlyCatalog && !forceThisRequest && initialEmbeds.length > 0 && !alreadyMounted) {
      setError(null);
      setStream(initial);
      setPlaybackHeaders(activeProvider.headers);
      sourceMounted.current = true;
      setSource(null);
      setEmbedSource(initialEmbeds[0]);
      setSourceRevision((v) => v + 1);
      applySkipSegments(providerSkipSegments(initial));
      setLoadingStream(false);
      return () => { cancelled = true; };
    }

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

    // Cache is keyed by provider identity + language + episode (see
    // streamCacheKey in lib/watch-engine): a sub stream must never be
    // reused for a dub request, nor Momo's for Niko's.
    const cacheKey = streamCacheKey(activeProvider, episode, language);
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
          setPlaybackHeaders(response.headers ?? activeProvider.headers);
          applySkipSegments(providerSkipSegments(response));
          // Hentai / embed-only catalogs mount the embed straight away instead
          // of burning refresh + rotation rounds on a heavy backend.
          if ((isHentai || embedOnlyCatalog) && refreshedEmbeds.length > 0 && shouldMountReplacementSource(sourceMounted.current, forceThisRequest)) {
            sourceMounted.current = true;
            setSource(null);
            setEmbedSource(refreshedEmbeds[0]);
            setSourceRevision((v) => v + 1);
            setLoadingStream(false);
            return;
          }
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
  }, [activeProvider, animeId, applySkipSegments, embedOnlyCatalog, episode, futureRelease, isHentai, language, refreshNonce]);

  // ── Source loading with direct → proxy fallback ──
  // Offline saved copies never touch the stream path: no watchdog, no
  // proxy, no headers. Local files either load or surface a player error;
  // failing over to a network server would be the wrong next step.
  useEffect(() => {
    if (!source || isOfflinePlaybackSource(source)) return;
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

  // Embeds had no startup watchdog — a dead embed page spun forever. If the
  // WebView never finishes loading, fall through to the next server.
  const embedReadyRef = useRef(false);
  useEffect(() => {
    if (!embedSource || source) return;
    embedReadyRef.current = false;
    const timer = setTimeout(() => {
      if (!embedReadyRef.current) handleProviderBlockedRef.current("startup");
    }, 15_000);
    return () => clearTimeout(timer);
  }, [embedSource, source]);

  useEffect(() => {
    if (hasConfirmedPlaybackStart({ isPlaying, currentTime, firstFrameRendered: sourceFirstFrame.current })) sourceStarted.current = true;
    const pendingPosition = pendingResume.current;
    if (shouldApplyInitialHistoryResume({
      currentTime, hasPendingResume: isResumablePosition(pendingPosition),
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
    // Offline files stay offline: surface the player error, never proxy or
    // fail over to a network server.
    if (isOfflinePlaybackSource(source)) {
      sourceFailureHandled.current = source.url;
      setLoadingStream(false);
      setError("The saved copy could not play. Remove it and download again.");
      return;
    }
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
          if (!cancelled) setSkipFetchStatus(resolveSkipFetchStatus({ fromCache: true }));
          return;
        }
      }
      const timeout = setTimeout(() => controller.abort(), ANISKIP_TIMEOUT_MS);
      // Pass the real runtime when known — episodeLength=0 makes AniSkip miss
      // entries it would otherwise return (then 404, handled below).
      const runtime = duration > 0 ? Math.round(duration) : 0;
      let timedOut = false;
      try {
        const response = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types%5B%5D=op&types%5B%5D=ed&episodeLength=${runtime}`, { headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
        clearTimeout(timeout);
        if (!response.ok) {
          void AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), segments: null })).catch(() => {});
          if (!cancelled) setSkipFetchStatus(resolveSkipFetchStatus({ ok: true, hasSegments: false }));
          return;
        }
        const segments = normalizeAniSkipSegments(await response.json());
        if (cancelled) return;
        applySkipSegments(segments);
        if (!cancelled) setSkipFetchStatus(resolveSkipFetchStatus({ ok: true, hasSegments: Boolean(segments.intro || segments.outro) }));
        void AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), segments: segments.intro || segments.outro ? segments : null })).catch(() => {});
      } catch (cause) {
        clearTimeout(timeout);
        timedOut = cause instanceof Error && cause.name === "AbortError";
        void AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), segments: null })).catch(() => {});
        if (!cancelled) setSkipFetchStatus(resolveSkipFetchStatus({ timedOut, ok: false }));
      }
    }).catch(() => { if (!cancelled) setSkipFetchStatus(resolveSkipFetchStatus({ ok: false })); });
    return () => { cancelled = true; controller.abort(); };
  }, [animeId, animeQuery.data, applySkipSegments, duration, episode]);

  // ── History resume ──
  // Conflict rule (Track 4): prefer max(local, server), not last-write. A
  // device that kept watching offline must not lose its lead to an older
  // server row, and vice versa.
  useEffect(() => {
    if (!history.history.isSuccess) return;
    const historyKey = `${animeId}:${episode}`;
    if (historyResumeRequestedFor.current === historyKey) return;
    historyResumeRequestedFor.current = historyKey;
    setResumePosition(null);
    pendingResume.current = null;
    const serverEntry = history.history.data?.find((item) => item.anime_id === animeId && item.episode_number === episode);
    const server = serverEntry ? { progress: serverEntry.progress, duration: serverEntry.duration } : null;
    void AsyncStorage.getItem(`aniraku-watch-local:${animeId}:${episode}`).then((stored) => {
      let local: { progress: number; duration: number } | null = null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { progress?: number; duration?: number };
          if (Number.isFinite(parsed.progress) && Number.isFinite(parsed.duration)) {
            local = { progress: Number(parsed.progress), duration: Number(parsed.duration) };
          }
        } catch { /* ignore malformed */ }
      }
      const best = resolveHistoryResume(local, server);
      if (best !== null) {
        pendingResume.current = best;
        setResumePosition(best);
      }
    }).catch(() => {
      const best = resolveHistoryResume(null, server);
      if (best !== null) {
        pendingResume.current = best;
        setResumePosition(best);
      }
    });
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
    history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, episodeTitle: selectedEpisode?.title || null, episodeThumbnail: selectedEpisode?.thumbnail || null, progress: currentTime, duration });
  }, [animeId, auth.user, currentTime, duration, episode, history.save, image, selectedEpisode?.title, selectedEpisode?.thumbnail, source, title]);

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
      history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, episodeTitle: selectedEpisode?.title || null, episodeThumbnail: selectedEpisode?.thumbnail || null, progress: currentTime, duration });
      if (providerSync.connected.length) providerSync.pushProgress.mutate({ animeId, episode, progress: Math.floor(currentTime), status: "completed" });
    } else {
      void AsyncStorage.setItem(`aniraku-watch-local:${animeId}:${episode}`, JSON.stringify({ progress: currentTime, duration, completed: true, savedAt: Date.now() })).catch(() => {});
    }
  }, [animeId, auth.user, currentTime, duration, episode, history.save, image, providerSync.connected.length, providerSync.pushProgress, source, title]);

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

  // ── Quality from the provider's Auto URL ──
  // Fetch the manifest the player is actually using and enumerate its real
  // renditions: HLS variant playlists mount by URL; DASH representations
  // become bitrate caps. Picking one mounts that rendition; Auto remounts the
  // master. A remembered per-server quality re-applies itself once here.
  //
  // Cache audit: the effect re-runs only on scalar scope signals (master URL,
  // provider id, episode, language, refresh, proxy/headers content). Object
  // identity churn and settings-sheet opens change none of those, so the
  // master is never re-fetched from them — the held menu or the per-master
  // cache entry answers instead.
  const qualitySourceUrl = source?.url ?? null;
  const qualitySourceType = source?.type ?? null;
  const qualityHeadersKey = JSON.stringify(playbackHeaders ?? null);
  const qualityProviderId = activeProvider?.id ?? null;
  useEffect(() => {
    const current = sourceMirrorRef.current;
    const currentUrl = current?.url ?? null;
    if (!current || !currentUrl) {
      setParsedQualityOptions(null);
      setParsedQualityNote(null);
      parsedOptionsRef.current = null;
      parsedVariantsRef.current = null;
      return;
    }
    const playbackType = getPlaybackType({ url: currentUrl, type: current?.type ?? undefined } as StreamSource);
    if (playbackType !== "hls" && playbackType !== "dash") {
      setParsedQualityOptions(null);
      setParsedQualityNote(null);
      parsedOptionsRef.current = null;
      parsedVariantsRef.current = null;
      return;
    }

    // Master identity: Auto mounts the master itself; a mounted variant
    // reuses the master key captured at parse time (variant URLs rot faster
    // than masters, so they are never used as fetch keys).
    const masterPlaybackUri = hlsVariantsCacheKey(isAutoQuality(current) ? videoSourceUri : parsedOptionsRef.current?.key);
    if (!masterPlaybackUri) {
      const held = parsedOptionsRef.current;
      if (held && !isAutoQuality(current) && held.options.some((option) => option.source?.url === currentUrl)) {
        setParsedQualityOptions(held.options);
        return;
      }
      setParsedQualityOptions(null);
      setParsedQualityNote(null);
      parsedOptionsRef.current = null;
      parsedVariantsRef.current = null;
      return;
    }

    // Invalidate on scope rotation only: same scope (e.g. settings opened)
    // reuses the held menu / cache without a fetch; a rotated scope on the
    // same master drops the stale parse so the refresh below re-resolves.
    const nextScope: VariantsCacheScope = { masterUrl: masterPlaybackUri, providerId: qualityProviderId, episode, refreshNonce };
    const prevScope = variantsScopeRef.current;
    variantsScopeRef.current = nextScope;
    if (prevScope && !shouldRefetchVariants(prevScope, nextScope)) {
      const held = parsedOptionsRef.current;
      if (held && held.key === masterPlaybackUri) { setParsedQualityOptions(held.options); return; }
      const cached = hlsVariantsCache.current.get(masterPlaybackUri);
      if (cached) {
        setParsedQualityOptions(cached.options);
        parsedOptionsRef.current = { key: masterPlaybackUri, options: cached.options };
        parsedVariantsRef.current = { key: masterPlaybackUri, variants: cached.variants };
        return;
      }
    } else if (prevScope && (prevScope.masterUrl ?? null) === (nextScope.masterUrl ?? null)) {
      hlsVariantsCache.current.delete(masterPlaybackUri);
      parsedOptionsRef.current = null;
      parsedVariantsRef.current = null;
    }

    // A parsed variant is currently mounted — keep its menu alive.
    const held = parsedOptionsRef.current;
    if (!isAutoQuality(current) && held && held.key === masterPlaybackUri && held.options.some((option) => option.source?.url === currentUrl)) {
      setParsedQualityOptions(held.options);
      return;
    }

    const cached = hlsVariantsCache.current.get(masterPlaybackUri);
    if (cached) {
      setParsedQualityOptions(cached.options);
      parsedOptionsRef.current = { key: masterPlaybackUri, options: cached.options };
      parsedVariantsRef.current = { key: masterPlaybackUri, variants: cached.variants };
      return;
    }

    let cancelled = false;
    const directHeaders = nativePlaybackHeaders(playbackHeadersMirrorRef.current);
    const proxied = useSourceProxy || isAnirakuProxyUrl(currentUrl) || isAnirakuProxyUrl(masterPlaybackUri);
    const providerId = qualityProviderId;
    const activeSource = current;
    const applyRemembered = async (options: WatchQualityOption[], variants: HlsVariant[]) => {
      const remembered = providerId ? (await readProviderQualityMap())[providerId] : undefined;
      if (cancelled) return;
      if (remembered) {
        setParsedQualityNote(`${remembered} · saved for this server`);
        const match = options.find((option) => option.requestQuality === remembered);
        const applyKey = `${providerId}:${remembered}`;
        if (match?.source && autoQualityAppliedFor.current !== applyKey) {
          autoQualityAppliedFor.current = applyKey;
          setParsedQualityOptions(options);
          parsedOptionsRef.current = { key: masterPlaybackUri, options };
          parsedVariantsRef.current = { key: masterPlaybackUri, variants };
          selectQualityRef.current(match.source);
          return;
        }
      } else {
        setParsedQualityNote(null);
      }
      setParsedQualityOptions(options);
      parsedOptionsRef.current = { key: masterPlaybackUri, options };
      parsedVariantsRef.current = { key: masterPlaybackUri, variants };
    };

    fetch(masterPlaybackUri, directHeaders && !proxied ? { headers: { ...directHeaders, Accept: "*/*" } } : undefined)
      .then((response) => {
        if (!response.ok) throw new Error(`manifest ${response.status}`);
        return response.text();
      })
      .then(async (text) => {
        if (cancelled) return;
        const variants = playbackType === "dash"
          ? parseDashRepresentations(text)
          : parseHlsMasterVariants(text, originalStreamUrl(masterPlaybackUri));
        const options = playbackType === "dash"
          ? buildDashQualityOptions(activeSource, variants)
          : buildHlsQualityOptions(activeSource, variants, { proxied, headers: directHeaders });
        if (!options.length) { setParsedQualityOptions(null); parsedOptionsRef.current = null; parsedVariantsRef.current = null; return; }
        hlsVariantsCache.current.set(masterPlaybackUri, { options, variants });
        await applyRemembered(options, variants);
      })
      .catch(() => { if (!cancelled) { setParsedQualityOptions(null); parsedOptionsRef.current = null; parsedVariantsRef.current = null; } });
    return () => { cancelled = true; };
  }, [qualitySourceUrl, qualitySourceType, videoSourceUri, useSourceProxy, qualityHeadersKey, qualityProviderId, episode, language, refreshNonce]);

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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Save per-anime language preference
    void AsyncStorage.setItem(`aniraku.lang.${animeId}`, next).catch(() => {});
    // Server-switch preserves position (Track 4): stash via the tested
    // resolveResumeOnSwitch helper so sub↔dub keeps the seek target.
    const stashed = resolveResumeOnSwitch(currentTime, duration);
    if (stashed !== null) pendingResume.current = stashed;
    videoRef.current?.pause();
    blockedProviders.current.clear();
    refreshAttempted.current.clear();
    variantTokenRefreshAttempted.current = null;
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Server-switch preserves position (Track 4): stash via the tested
    // resolveResumeOnSwitch helper so the new source re-seeks here.
    const stashed = resolveResumeOnSwitch(currentTime, duration);
    if (stashed !== null) pendingResume.current = stashed;
    // Reset the mount flag or the new provider's stream resolves but never
    // mounts (permanent spinner) — this stalled every manual server switch.
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    sourceMounted.current = false;
    markedComplete.current = false;
    sourceFailureHandled.current = null;
    variantTokenRefreshAttempted.current = null;
    videoRef.current?.pause();
    setSource(null);
    setEmbedSource(null);
    setLastPlayerError(null);
    setUseSourceProxy(false);
    setAdaptiveBitrateCap(null);
    setLoadingStream(true);
    setActivePanel(null);
    if (index === serverIndex) {
      forceRefresh.current = true;
      setRefreshNonce((v) => v + 1);
    } else {
      setServerIndex(index);
    }
    setError(null);
  };

  const selectQuality = (next: StreamSource) => {
    // Quality switch preserves position too: the variant playlist starts at
    // 0, so stash the current time for the resume effect to re-apply.
    const stashed = resolveResumeOnSwitch(currentTime, duration);
    if (stashed !== null) {
      pendingResume.current = stashed;
      initialHistoryResumeApplied.current = false;
    }
    sourceMounted.current = true;
    setAdaptiveBitrateCap(null);
    setEmbedSource(null);
    setSource(next);
    setUseSourceProxy(isProxySource(next));
    setSourceRevision((v) => v + 1);
    setPlaybackHeaders(stream?.headers ?? activeProvider?.headers);
    setRequestedQuality(isAutoQuality(next) ? "auto" : next.quality || "auto");
    setActivePanel(null);
    // Remember manual quality per server; picking Auto (or a saved offline
    // copy) clears it. The parse effect re-applies it on the next Auto mount.
    const rememberedLabel = (next.quality || "").split("·")[0].trim().toLowerCase();
    const persistable = rememberedLabel && rememberedLabel !== "auto" && !/saved/i.test(next.quality || "") ? rememberedLabel : null;
    void rememberProviderQuality(activeProvider?.id, persistable);
  };
  const selectQualityRef = useRef(selectQuality);
  selectQualityRef.current = selectQuality;

  const selectAdaptiveQuality = async (choice: WatchQualityOption) => {
    if (!activeProvider || !source) return;
    if (choice.isAdaptiveCap) {
      if (!isAutoQuality(source)) return;
      setAdaptiveBitrateCap(choice.maxVideoBitrate ?? null);
      setRequestedQuality("auto");
      setActivePanel(null);
      return;
    }
    if (choice.source) { selectQuality(choice.source); return; }
    if (choice.requestQuality === "auto" && isAutoQuality(source)) { setRequestedQuality("auto"); setActivePanel(null); return; }
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

  // Token-expiry guard: a mounted variant URL 403s with a rotted embedded
  // timestamp → refresh the master once and re-resolve the same height before
  // failing over to the next server. Variant URLs rot faster than masters, so
  // a failover without this step burns a healthy provider. The
  // single-refresh flag lives on the mounted URL itself: a fresh token means
  // a fresh URL, which earns its own single attempt — no loops possible.
  const refreshVariantFromMaster = async () => {
    const stale = sourceMirrorRef.current;
    const staleUrl = stale?.url ?? null;
    const masterKey = parsedOptionsRef.current?.key ?? null;
    if (!stale || !staleUrl || !masterKey) { handleProviderBlockedRef.current("player"); return; }
    try {
      const directHeaders = nativePlaybackHeaders(playbackHeadersMirrorRef.current);
      const proxied = useSourceProxy || isAnirakuProxyUrl(staleUrl) || isAnirakuProxyUrl(masterKey);
      const response = await fetch(masterKey, directHeaders && !proxied ? { headers: { ...directHeaders, Accept: "*/*" } } : undefined);
      if (!response.ok) throw new Error(`manifest ${response.status}`);
      const text = await response.text();
      const variants = parseHlsMasterVariants(text, originalStreamUrl(masterKey));
      if (!variants.length) throw new Error("empty variants");
      const wantedHeight = Number.parseInt(String(stale.quality ?? ""), 10);
      const targetCdn = (Number.isFinite(wantedHeight) ? variantUrlForHeight(variants, wantedHeight) : null) ?? variants[0]?.url ?? null;
      if (!targetCdn) throw new Error("no variant");
      const freshOptions = buildHlsQualityOptions(stale, variants, { proxied, headers: directHeaders });
      if (freshOptions.length) {
        hlsVariantsCache.current.set(masterKey, { options: freshOptions, variants });
        setParsedQualityOptions(freshOptions);
        parsedOptionsRef.current = { key: masterKey, options: freshOptions };
        parsedVariantsRef.current = { key: masterKey, variants };
      }
      sourceMounted.current = true;
      sourceFailureHandled.current = null;
      setSource({ ...stale, url: proxied ? anirakuProxyUrl(targetCdn, directHeaders) : targetCdn });
      setSourceRevision((value) => value + 1);
    } catch {
      handleProviderBlockedRef.current("player");
    }
  };

  const markIntentionalSeek = (target?: number) => {
    intentionalSeekUntil.current = Date.now() + 1_500;
    if (typeof target === "number" && Number.isFinite(target)) lastStablePlaybackTime.current = target;
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

  const handleVideoProgress = useCallback((data: OnProgressData) => {
    currentTimeRef.current = data.currentTime;
    playableDurationRef.current = data.playableDuration;
    // While PiP is active the system owns the frame — refs keep tracking and
    // state flushes once, on exit, instead of re-rendering per tick.
    if (pipActiveRef.current) return;
    setCurrentTime(data.currentTime);
    setPlayableDuration(data.playableDuration);
  }, []);

  const handleVideoTracks = useCallback((event: { videoTracks?: Array<{ height?: number; selected?: boolean }> }) => {
    const tracks = event?.videoTracks ?? [];
    setVideoTracks(tracks);
    const height = liveRenditionHeight(tracks);
    if (height) setLiveHeight(height);
  }, []);

  const handleBandwidthUpdate = useCallback((event: { height?: number }) => {
    const height = Math.round(Number(event?.height));
    if (Number.isFinite(height) && height > 0) setLiveHeight(height);
  }, []);
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

  // ── PanResponder gesture handler — zoned state machine ──
  // Each gesture owns a screen zone so they can never fire together:
  //   outer-left  (x < 35%)  → vertical swipe = brightness (never 2x, never seek-hold)
  //   outer-right (x > 65%)  → vertical swipe = volume     (never 2x, never seek-hold)
  //   center      (35–65%)   → hold still 550ms = 2x speed  (never brightness/volume)
  //   left 40% double/triple → -10s / -20s · right 40% → +10s / +30s · center double → play/pause
  // Modes are exclusive: pending → swiping | holding | released-as-tap. Moving
  // cancels holding, holding ignores swipes, taps require <10px movement.
  type GestureMode = "idle" | "pending" | "swiping" | "holding";
  type GestureZone = "left" | "center" | "right";
  const gestureModeRef = useRef<GestureMode>("idle");
  const gestureStartX = useRef(0);
  const gestureStartY = useRef(0);
  const gestureStartTime = useRef(0);
  const gestureZoneRef = useRef<GestureZone>("center");
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const singleTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentBrightnessVal = useRef(0.5);
  const currentVolumeVal = useRef(1.0);

  const zoneForX = (x: number): GestureZone => {
    const w = Dimensions.get("window").width || 1;
    if (x < w * EDGE_ZONE) return "left";
    if (x > w * (1 - EDGE_ZONE)) return "right";
    return "center";
  };

  const seekZoneForX = (x: number): "left" | "center" | "right" => {
    const w = Dimensions.get("window").width || 1;
    if (x < w * SEEK_ZONE) return "left";
    if (x > w * (1 - SEEK_ZONE)) return "right";
    return "center";
  };

  const cancelLongPress = () => {
    if (longPressTimeout.current) { clearTimeout(longPressTimeout.current); longPressTimeout.current = null; }
  };

  const stopHoldSpeed = useCallback(() => {
    if (is2xSeeking) { setIs2xSeeking(false); endHoldSpeed(); }
  }, [is2xSeeking, endHoldSpeed]);

  useEffect(() => {
    return () => {
      if (singleTapTimeout.current) clearTimeout(singleTapTimeout.current);
      if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
      if (skipHoldTimer.current) clearTimeout(skipHoldTimer.current);
      if (unlockArmTimer.current) clearTimeout(unlockArmTimer.current);
      if (tapCountTimer.current) clearTimeout(tapCountTimer.current);
      if (holdSeekTimeout.current) clearTimeout(holdSeekTimeout.current);
      pendingMultiSeekRef.current = null;
    };
  }, []);

  const triggerDoubleTapAnimation = useCallback((side: "left" | "right", seconds = 10) => {
    const gen = ++doubleTapGen.current;
    setDoubleTapSide(side);
    setDoubleTapSeconds(seconds);
    doubleTapAnim.stopAnimation();
    doubleTapAnim.setValue(1);
    Animated.timing(doubleTapAnim, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== "web" }).start(() => {
      if (doubleTapGen.current === gen) setDoubleTapSide(null);
    });
  }, [doubleTapAnim]);

  const seekRelative = useCallback((deltaSeconds: number) => {
    setCurrentTime((curr) => {
      const next = Math.max(0, Math.min(duration || 999999, curr + deltaSeconds));
      markIntentionalSeek(next);
      videoRef.current?.seek(next);
      return next;
    });
  }, [duration, markIntentionalSeek]);

  const seekRelativeRef = useRef(seekRelative);
  useEffect(() => { seekRelativeRef.current = seekRelative; }, [seekRelative]);
  const flashRef = useRef(triggerDoubleTapAnimation);
  useEffect(() => { flashRef.current = triggerDoubleTapAnimation; }, [triggerDoubleTapAnimation]);

  const clearSkipHold = useCallback(() => {
    if (skipHoldTimer.current) { clearTimeout(skipHoldTimer.current); skipHoldTimer.current = null; }
    skipHoldSide.current = null;
  }, []);

  const armSkipHold = useCallback((side: "left" | "right", seconds = 10) => {
    clearSkipHold();
    skipHoldSide.current = side;
    const delta = side === "left" ? -seconds : seconds;
    const tick = () => {
      if (!skipHoldSide.current) return;
      seekRelativeRef.current(delta);
      flashRef.current(side, seconds);
      skipHoldTimer.current = setTimeout(tick, SKIP_HOLD_MS);
    };
    skipHoldTimer.current = setTimeout(tick, SKIP_HOLD_MS);
  }, [clearSkipHold]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !playerLocked,
        onMoveShouldSetPanResponder: () => !playerLocked,

        onPanResponderGrant: (_evt, gesture) => {
          if (playerLocked) { gestureModeRef.current = "idle"; return; }
          const now = Date.now();
          gestureStartX.current = gesture.x0;
          gestureStartY.current = gesture.y0;
          gestureStartTime.current = now;
          gestureZoneRef.current = zoneForX(gesture.x0);
          currentBrightnessVal.current = brightness;
          currentVolumeVal.current = volume;
          doubleTapTouch.current = false;
          cancelLongPress();
          // Stale multi-tap state from a previous gesture must never leak in.
          if (holdSeekTimeout.current) { clearTimeout(holdSeekTimeout.current); holdSeekTimeout.current = null; }
          holdSeekFiredRef.current = false;
          pendingMultiSeekRef.current = null;

          // Fires the pending jump when a 2nd/3rd touch is HELD: the jump
          // lands once, then the skip loop keeps ticking while held.
          const fireHeldSeek = (side: "left" | "right", tickSeconds: number) => {
            if (gestureModeRef.current !== "pending") return;
            holdSeekFiredRef.current = true;
            const pending = pendingMultiSeekRef.current;
            if (pending && pending.side === side && pending.seconds > 0) {
              pendingMultiSeekRef.current = null;
              const delta = side === "left" ? -pending.seconds : pending.seconds;
              seekRelativeRef.current(delta);
              flashRef.current(side, pending.seconds);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              const already = chainSeekAppliedRef.current?.side === side ? chainSeekAppliedRef.current.seconds : 0;
              chainSeekAppliedRef.current = { side, seconds: already + pending.seconds };
            }
            armSkipHold(side, tickSeconds);
          };
          const armHoldSeek = (side: "left" | "right", tickSeconds: number) => {
            if (holdSeekTimeout.current) clearTimeout(holdSeekTimeout.current);
            holdSeekTimeout.current = setTimeout(() => fireHeldSeek(side, tickSeconds), HOLD_SEEK_MS);
          };

          const prior = lastTapRef.current;
          const isFollowUp = Boolean(prior && (now - prior.time) < TRIPLE_TAP_WINDOW_MS && Math.abs(gesture.x0 - prior.x) < 80 && tapCountRef.current > 0);

          if (isFollowUp) {
            // Second tap down kills the pending single-tap toggle immediately —
            // otherwise controls flash on every double-tap.
            if (singleTapTimeout.current) { clearTimeout(singleTapTimeout.current); singleTapTimeout.current = null; }
            if (tapCountTimer.current) clearTimeout(tapCountTimer.current);
            tapCountRef.current += 1;
            const zone = seekZoneForX(gesture.x0);

            if (zone === "center") {
              // Center multi-tap = play/pause. The 2nd tap toggles; a 3rd is
              // already answered so it only resets the chain.
              const isTriple = tapCountRef.current >= 3;
              lastTapRef.current = null;
              tapCountRef.current = 0;
              doubleTapTouch.current = true;
              gestureModeRef.current = "pending";
              if (!isTriple) {
                setIsPlaying((p) => !p);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              return;
            }

            if (tapCountRef.current >= 3) {
              // ── Triple tap: land exactly on the labeled totals (-20s left /
              // +30s right), minus whatever this chain already applied when
              // the 2nd touch released. Executes on release; a hold keeps
              // skipping while the finger stays down. ──
              const total = zone === "left" ? 20 : 30;
              const applied = chainSeekAppliedRef.current?.side === zone ? chainSeekAppliedRef.current.seconds : 0;
              lastTapRef.current = null;
              tapCountRef.current = 0;
              doubleTapTouch.current = true;
              gestureModeRef.current = "pending";
              pendingMultiSeekRef.current = { side: zone, seconds: Math.max(0, total - applied) };
              armHoldSeek(zone, 10);
              tapCountTimer.current = setTimeout(() => { tapCountRef.current = 0; chainSeekAppliedRef.current = null; }, TRIPLE_TAP_WINDOW_MS);
              return;
            }

            // ── Double tap: ±10s on RELEASE (never on touch-down, so taps
            // meant to toggle controls can't trigger a seek), hold to keep
            // skipping while the finger stays down. ──
            doubleTapTouch.current = true;
            gestureModeRef.current = "pending";
            pendingMultiSeekRef.current = { side: zone, seconds: 10 };
            armHoldSeek(zone, 10);
            tapCountTimer.current = setTimeout(() => { tapCountRef.current = 0; chainSeekAppliedRef.current = null; }, TRIPLE_TAP_WINDOW_MS);
            return;
          }

          // ── First touch: this IS tap #1 — enter PENDING, arm center-only
          // long-press for 2x. Outer zones never arm 2x — a brightness/volume
          // swipe can never trigger speed, and a center hold can never touch
          // brightness.
          chainSeekAppliedRef.current = null;
          if (singleTapTimeout.current) { clearTimeout(singleTapTimeout.current); singleTapTimeout.current = null; }
          tapCountRef.current = 1;
          gestureModeRef.current = "pending";
          if (gestureZoneRef.current === "center") {
            longPressTimeout.current = setTimeout(() => {
              if (gestureModeRef.current !== "pending") return;
              gestureModeRef.current = "holding";
              setIs2xSeeking(true);
              beginHoldSpeed();
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }, LONG_PRESS_MS);
          }
        },

        onPanResponderMove: (_evt, gesture) => {
          if (playerLocked || gestureModeRef.current === "idle") return;
          const mode = gestureModeRef.current;
          const absDx = Math.abs(gesture.dx);
          const absDy = Math.abs(gesture.dy);

          // Any drift kills a pending multi-tap seek — a swipe must never jump.
          const cancelHoldSeek = () => {
            if (holdSeekTimeout.current) { clearTimeout(holdSeekTimeout.current); holdSeekTimeout.current = null; }
            pendingMultiSeekRef.current = null;
          };
          if (mode === "pending" && (absDx > TAP_SLOP_PX || absDy > TAP_SLOP_PX)) {
            cancelLongPress();
            cancelHoldSeek();
          }
          if (mode === "holding" && (absDx > TAP_SLOP_PX || absDy > TAP_SLOP_PX)) {
            gestureModeRef.current = "idle";
            stopHoldSpeed();
            clearSkipHold();
            return;
          }

          if (mode === "pending" && absDx > HORIZONTAL_CANCEL_PX && absDy < SWIPE_ACTIVATE_PX) {
            gestureModeRef.current = "idle";
            cancelLongPress();
            cancelHoldSeek();
            clearSkipHold();
            return;
          }

          if (mode === "pending") {
            const startZone = gestureZoneRef.current;
            const verticalDominant = absDy > SWIPE_ACTIVATE_PX && absDy > absDx * SWIPE_DIRECTION_RATIO;
            if (!verticalDominant) return;
            if (startZone === "center") return;
            gestureModeRef.current = "swiping";
            cancelLongPress();
            cancelHoldSeek();
            stopHoldSpeed();
            clearSkipHold();
          }

          if (gestureModeRef.current === "swiping") {
            const startZone = gestureZoneRef.current;
            if (startZone === "center") return;
            const effectiveDy = gesture.dy - Math.sign(gesture.dy) * SWIPE_ACTIVATE_PX;
            const delta = -effectiveDy / 250;
            const snapToStep = (value: number) => Math.max(0, Math.min(1, Math.round(value * 20) / 20));
            if (startZone === "left") {
              const newBrightness = snapToStep(currentBrightnessVal.current + delta);
              if (newBrightness !== brightness) {
                setBrightness(newBrightness);
                if (Platform.OS !== "web") Brightness.setBrightnessAsync(newBrightness).catch(() => {});
              }
              setBrightnessHud(Math.round(newBrightness * 100));
            } else {
              const newVol = snapToStep(currentVolumeVal.current + delta);
              if (newVol !== volume) setVolume(newVol);
              setVolumeHud(Math.round(newVol * 100));
            }
          }
        },

        onPanResponderRelease: (_evt, gesture) => {
          const mode = gestureModeRef.current;
          gestureModeRef.current = "idle";
          cancelLongPress();

          if (mode === "holding") {
            stopHoldSpeed();
            clearSkipHold();
            setTimeout(() => { setVolumeHud(null); setBrightnessHud(null); }, 800);
            return;
          }
          if (mode === "swiping") {
            stopHoldSpeed();
            clearSkipHold();
            setTimeout(() => { setVolumeHud(null); setBrightnessHud(null); }, 800);
            return;
          }
          if (mode !== "pending") return;

          // ── Multi-tap release: fire the pending jump (double ±10s, triple
          // to the labeled totals). Chained seeks always execute — no
          // cooldown — so a fast triple-tap never eats its third jump.
          if (doubleTapTouch.current) {
            doubleTapTouch.current = false;
            const holdFired = holdSeekFiredRef.current;
            holdSeekFiredRef.current = false;
            if (holdSeekTimeout.current) { clearTimeout(holdSeekTimeout.current); holdSeekTimeout.current = null; }
            if (holdFired) {
              // The held touch already jumped + looped; lifting stops the loop.
              clearSkipHold();
              return;
            }
            const pending = pendingMultiSeekRef.current;
            pendingMultiSeekRef.current = null;
            const drifted = Math.abs(gesture.dx) >= TAP_SLOP_PX || Math.abs(gesture.dy) >= TAP_SLOP_PX;
            if (pending && pending.seconds > 0 && !drifted) {
              const delta = pending.side === "left" ? -pending.seconds : pending.seconds;
              seekRelativeRef.current(delta);
              flashRef.current(pending.side, pending.seconds);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              const already = chainSeekAppliedRef.current?.side === pending.side ? chainSeekAppliedRef.current.seconds : 0;
              chainSeekAppliedRef.current = { side: pending.side, seconds: already + pending.seconds };
              // Window the 3rd tap from THIS release, not the first one.
              lastTapRef.current = { time: Date.now(), x: gestureStartX.current };
              if (tapCountTimer.current) clearTimeout(tapCountTimer.current);
              tapCountTimer.current = setTimeout(() => { tapCountRef.current = 0; chainSeekAppliedRef.current = null; }, TRIPLE_TAP_WINDOW_MS);
            } else {
              // Center multi-tap already toggled play/pause on touch-down.
              lastTapRef.current = null;
            }
            clearSkipHold();
            return;
          }

          clearSkipHold();

          // Single tap: tiny movement + quick lift
          const quick = Date.now() - gestureStartTime.current < 400;
          if (Math.abs(gesture.dx) < TAP_SLOP_PX && Math.abs(gesture.dy) < TAP_SLOP_PX && quick) {
            const now = Date.now();
            if (singleTapTimeout.current) clearTimeout(singleTapTimeout.current);
            lastTapRef.current = { time: now, x: gestureStartX.current };
            if (tapCountTimer.current) clearTimeout(tapCountTimer.current);
            tapCountTimer.current = setTimeout(() => { tapCountRef.current = 0; chainSeekAppliedRef.current = null; }, TRIPLE_TAP_WINDOW_MS);
            // Delayed past the double-tap window so a 2nd tap can cancel it
            singleTapTimeout.current = setTimeout(() => {
              const firedAt = Date.now();
              if (firedAt - lastActionTimeRef.current < TAP_ACTION_COOLDOWN_MS) return;
              lastActionTimeRef.current = firedAt;
              setShowControls((prev) => !prev);
              lastTapRef.current = null;
            }, DOUBLE_TAP_WINDOW_MS);
          } else {
            lastTapRef.current = null;
          }
        },

        onPanResponderTerminate: () => {
          gestureModeRef.current = "idle";
          cancelLongPress();
          stopHoldSpeed();
          clearSkipHold();
          doubleTapTouch.current = false;
          holdSeekFiredRef.current = false;
          if (holdSeekTimeout.current) { clearTimeout(holdSeekTimeout.current); holdSeekTimeout.current = null; }
          pendingMultiSeekRef.current = null;
        },
      }),
    [armSkipHold, brightness, clearSkipHold, playerLocked, volume, beginHoldSpeed, stopHoldSpeed, triggerDoubleTapAnimation],
  );

  const skip = (kind: SkipKind) => {
    const target = skipSegments[kind]?.endTime;
    if (target) { markIntentionalSeek(target); videoRef.current?.seek(target); }
  };

  // Retry honesty (Track 4): TRY AGAIN re-fetches the SAME provider once
  // with refresh:true. If that provider already had its one refresh, TRY
  // AGAIN advances to the next unblocked provider instead of looping the
  // same dead URL. SWITCH SERVER always skips the refresh and moves on.
  const retry = () => {
    if (!activeProvider) return;
    if (refreshAttempted.current.has(activeProvider.id)) {
      handleProviderBlockedRef.current("permanent");
      return;
    }
    refreshAttempted.current.add(activeProvider.id);
    blockedProviders.current.delete(activeProvider.id);
    variantTokenRefreshAttempted.current = null;
    forceRefresh.current = true;
    sourceMounted.current = false;
    setEmbedSource(null);
    setLastPlayerError(null);
    setError(null);
    setRefreshNonce((v) => v + 1);
  };

  // Backend `downloads[]` links are external download pages (e.g. provider
  // file hosts), not direct files — they open in the external browser, never
  // through the in-app proxy saver. Every tap confirms with a "leaving the
  // app" popup first. SUB and DUB option lists stay separate because they are
  // built from the language-filtered provider list.
  const openBackendDownload = (option: BackendDownloadOption) => {
    setActivePanel(null);
    const quality = String(option.quality ?? option.label).toUpperCase();
    // Second gate beside buildBackendDownloadOptions' https-only filter:
    // never hand a non-https URL to the OS browser, even if backend data
    // changed shape.
    let safeUrl: string | null = null;
    try {
      const parsed = new URL(String(option.url ?? "").trim());
      if (parsed.protocol === "https:") safeUrl = parsed.toString();
    } catch {
      safeUrl = null;
    }
    if (!safeUrl) {
      setDownloadMessage("THIS DOWNLOAD LINK IS NOT SUPPORTED.");
      return;
    }
    Alert.alert("You're leaving Aniraku", `Open the external ${quality} download page in your browser?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        onPress: () => {
          void (async () => {
            try {
              if (!(await Linking.canOpenURL(safeUrl))) throw new Error("unsupported");
              await Linking.openURL(safeUrl);
              setDownloadMessage(`OPENING ${quality} DOWNLOAD…`);
            } catch {
              setDownloadMessage("COULD NOT OPEN DOWNLOAD LINK.");
            }
          })();
        },
      },
    ]);
  };

  // Download icon behavior: quality options → picker modal; exactly one
  // default-label link → open it directly; nothing from the backend → legacy
  // in-app save of the playing stream source below.
  const onDownloadPress = () => {
    if (backendDownloadOptions.length === 0) { void startDownload(); return; }
    if (hasQualityBackendDownloads(backendDownloadOptions)) { setActivePanel("download"); return; }
    void openBackendDownload(backendDownloadOptions[0]);
  };

  const startDownload = async () => {
    try {
      setDownloadMessage(null);
      setDownloadProgress(0);
      const headers = stream?.headers ?? activeProvider?.headers;
      // The chosen rendition wins over the master's highest guess: a parsed
      // HLS variant URL for the selected height is fetched exactly. Without
      // parsed variants the native match-or-max fallback applies.
      const wantedHeight = Number.parseInt(String(requestedQuality ?? ""), 10);
      const variantUrl = Number.isFinite(wantedHeight)
        ? variantUrlForHeight(parsedVariantsRef.current?.variants ?? [], wantedHeight)
        : null;
      if (variantUrl) {
        const base = maximumDownloadSource ?? source;
        if (!base) { setDownloadMessage("DIRECT SOURCE REQUIRED FOR DOWNLOAD."); return; }
        const entry = await startMaximumQualityDownload({ animeId, episode, language, title, source: base, variantUrl, variantQuality: `${Math.round(wantedHeight)}p`, headers, onProgress: setDownloadProgress });
        setOfflineDownload(entry);
        setDownloadMessage(`${entry.quality.toUpperCase()} SAVED.`);
        return;
      }
      const matched = selectDownloadSourceForQuality(stream?.sources ?? activeProvider?.sources ?? [], requestedQuality);
      if (!matched) { setDownloadMessage("DIRECT SOURCE REQUIRED FOR DOWNLOAD."); return; }
      const entry = await startMaximumQualityDownload({ animeId, episode, language, title, source: matched, headers, onProgress: setDownloadProgress });
      setOfflineDownload(entry);
      setDownloadMessage(`${entry.quality.toUpperCase()} SAVED.`);
    } catch (cause) {
      setDownloadMessage(cause instanceof Error ? cause.message.toUpperCase() : "DOWNLOAD FAILED.");
    } finally { setDownloadProgress(null); }
  };

  const playOffline = () => {
    if (!offlineDownload) return;
    videoRef.current?.pause();
    sourceMounted.current = true;
    setPlaybackHeaders(undefined);
    setUseSourceProxy(false);
    setSource({ url: offlineDownload.uri, quality: `${offlineDownload.quality} · SAVED`, type: "native" });
    setSourceRevision((v) => v + 1);
    setActivePanel(null);
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(targetEpisode), title, image } } as never);
  }, [animeId, canonicalEpisodes, image, title]);

  const openEpisodeInfo = useCallback((targetEpisode = episode) => {
    const selected = displayEpisodes.find((item) => item.number === targetEpisode);
    router.push({ pathname: "/episode/[id]", params: { id: String(animeId), episode: String(targetEpisode), title, image, episodeTitle: selected?.title || "" } } as never);
  }, [animeId, displayEpisodes, episode, image, title]);

  const { nextKnownEpisode, previousKnownEpisode } = useMemo(() => {
    const next = resolveNextEpisode(episode, canonicalEpisodes) ?? undefined;
    const previous = resolvePrevEpisode(episode, canonicalEpisodes) ?? undefined;
    return { nextKnownEpisode: next, previousKnownEpisode: previous };
  }, [canonicalEpisodes, episode]);

  const nextEpisode = useCallback(() => { if (nextKnownEpisode) goToEpisode(nextKnownEpisode); }, [goToEpisode, nextKnownEpisode]);

  // ── Up-next card: surfaces near the finish line (or at the end) and waits
  // for the user. No countdown, no auto-play — PLAY NOW or dismiss.
  const upNextKey = `${animeId}:${episode}`;
  const nextEpisodeDisplay = nextKnownEpisode ? displayEpisodes.find((item) => item.number === nextKnownEpisode) : undefined;

  const showUpNext = useCallback(() => {
    if (!nextKnownEpisode) return;
    if (upNextShownFor.current === upNextKey) return;
    upNextShownFor.current = upNextKey;
    setUpNextVisible(true);
  }, [nextKnownEpisode, upNextKey]);

  const dismissUpNext = useCallback(() => { setUpNextVisible(false); }, []);

  useEffect(() => {
    if (!source || duration <= 0) return;
    // Scrubbing back out of the end zone cancels the card and re-arms it, so
    // the natural onEnded can still surface it.
    if (currentTime / duration < 0.85) {
      if (upNextShownFor.current === upNextKey) upNextShownFor.current = null;
      if (upNextVisible) setUpNextVisible(false);
      return;
    }
    if (currentTime > 0 && currentTime / duration >= 0.9) showUpNext();
  }, [currentTime, duration, showUpNext, source, upNextKey, upNextVisible]);

  useEffect(() => { setUpNextVisible(false); }, [animeId, episode]);

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
    setActivePanel(null);
    setShowControls(true);
    setManualFullscreen(true);
    if (Platform.OS !== "web") lockForceLandscape();
  }, [lockForceLandscape]);

  const exitFullscreen = useCallback(() => {
    setManualFullscreen(false);
    // Keep chrome visible on exit so the inline player never looks dead.
    setShowControls(true);
    if (Platform.OS !== "web") {
      // Lock portrait briefly before unlocking so Android doesn't stay stuck
      // in the last forced landscape when auto-rotate is OFF.
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {}).finally(() => {
        void ScreenOrientation.unlockAsync().catch(() => {});
      });
    }
  }, []);

  const enterPiP = useCallback(() => {
    if (Platform.OS === "web") return;
    const ref = videoRef.current as unknown as { enterPictureInPicture?: () => void } | null;
    if (typeof ref?.enterPictureInPicture !== "function") { setPipAvailable(false); return; }
    try {
      ref.enterPictureInPicture();
    } catch {
      // Device throws where PiP is unsupported — hide the button for good.
      setPipAvailable(false);
    }
  }, []);

  const onPipStatusChanged = useCallback((event: { isActive?: boolean }) => {
    const active = event?.isActive === true;
    pipActiveRef.current = active;
    setPipActive(active);
    if (!active) {
      // Flush time held in refs while the system owned the frame.
      setCurrentTime(currentTimeRef.current);
      setPlayableDuration(playableDurationRef.current);
    }
  }, []);

  // Rail lock button: freezing chrome AND hiding it is what makes the lock
  // real — previously playerLocked could never be set to true at all.
  const engagePlayerLock = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPlayerLocked(true);
    setShowControls(false);
  }, []);

  // Lock requires a second tap within 1.6s — pocket touches and accidental
  // taps on the pill stop unlocking the whole player.
  const [unlockArmed, setUnlockArmed] = useState(false);
  const unlockArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestUnlock = useCallback(() => {
    if (unlockArmTimer.current) { clearTimeout(unlockArmTimer.current); unlockArmTimer.current = null; }
    if (unlockArmed) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setPlayerLocked(false);
      setShowControls(true);
      setUnlockArmed(false);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setUnlockArmed(true);
    unlockArmTimer.current = setTimeout(() => setUnlockArmed(false), 1_600);
  }, [unlockArmed]);

  // Download status toasts self-dismiss so "SAVED." never lingers forever.
  useEffect(() => {
    if (!downloadMessage) return;
    const timer = setTimeout(() => setDownloadMessage(null), 4_000);
    return () => clearTimeout(timer);
  }, [downloadMessage]);

  useEffect(() => {
    if (!manualFullscreen || Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { exitFullscreen(); return true; });
    return () => subscription.remove();
  }, [manualFullscreen, exitFullscreen]);

  useEffect(() => {
    if (!source || !showControls || activePanel) return;
    if (dragPct !== null) return; // never hide the chrome out from under a scrub
    // NOTE: currentTime is deliberately NOT a dep — progress ticks every
    // second and would reset this timer forever, so chrome could never hide.
    const timer = setTimeout(() => setShowControls(false), 3_500);
    return () => clearTimeout(timer);
  }, [showControls, activePanel, manualFullscreen, source?.url, dragPct]);

  // Controls fade instead of popping — 180ms opacity, cause → effect only.
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const [controlsRendered, setControlsRendered] = useState(true);
  const controlsFadeJob = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (controlsFadeJob.current) { controlsFadeJob.current.stop(); controlsFadeJob.current = null; }
    if (showControls && !playerLocked) {
      setControlsRendered(true);
      controlsOpacity.setValue(0);
      const job = Animated.timing(controlsOpacity, { toValue: 1, duration: 180, useNativeDriver: true });
      controlsFadeJob.current = job;
      job.start(() => { controlsFadeJob.current = null; });
    } else {
      const job = Animated.timing(controlsOpacity, { toValue: 0, duration: 180, useNativeDriver: true });
      controlsFadeJob.current = job;
      job.start(({ finished }) => { controlsFadeJob.current = null; if (finished) setControlsRendered(false); });
    }
  }, [controlsOpacity, playerLocked, showControls]);

  const onProgressLayout = (event: LayoutChangeEvent) => setProgressWidth(event.nativeEvent.layout.width);

  // Priority: renditions parsed from the Auto manifest → ExoPlayer
  // bitrate caps (Android) → provider-claimed labels.
  const displayedQualityOptions: WatchQualityOption[] = parsedQualityOptions
    ? parsedQualityOptions
    : source
      ? (adaptiveCapOptions.length ? adaptiveCapOptions : sourceQualityOptions)
      : sourceQualityOptions.map((item) => ({ id: item.id, label: item.label, requestQuality: item.requestQuality, source: item.source }));

  const selectedSubtitleUrl = useMemo(
    () => (source?.subtitles?.length && subtitlePrefs?.enabled ? matchSubtitleTrack(source.subtitles, subtitlePrefs.preferredLanguage)?.url ?? null : null),
    [source?.subtitles, subtitlePrefs?.enabled, subtitlePrefs?.preferredLanguage],
  );

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferPct = duration > 0 && playableDuration > 0 ? Math.min(100, (playableDuration / duration) * 100) : 0;
  // Segmented track tint from real OP/ED ranges (provider + AniSkip merged).
  const chapterTrack = useMemo(() => chapterTrackSegments(skipSegments, duration), [skipSegments, duration]);

  if (invalidId) {
    return <NativeScreen scroll={false} style={styles.fill}>
      <View style={styles.invalidWrap}>
        <DotLabel tone="signal">COULDN’T LOAD THIS</DotLabel>
        <Text style={styles.invalidTitle}>This watch link is invalid.</Text>
        <NothingButton label="GO BACK" onPress={() => router.back()} variant="outline" />
      </View>
    </NativeScreen>;
  }

  return <NativeScreen scroll={false} style={styles.fill}>
    <StatusBar hidden={manualFullscreen} />

    {/* ── Video Container + Gesture Layer ── */}
    {/* NOTE: panHandlers live on the sibling overlay below, NOT on this parent.
        Parent-level onStartShouldSetPanResponder stole Pressable touches and the
        native Video SurfaceView eats touches aimed behind it. */}
    <View style={[styles.videoShell, manualFullscreen && ps.videoShellFullscreen]}>
      {embedSource && !source ? <EmbedPlayer uri={embedSource.url} headers={nativePlaybackHeaders(playbackHeaders)} onError={() => handleProviderBlockedRef.current("player")} onLoaded={() => { embedReadyRef.current = true; }} /> : null}
      {source ? <Video key={activeProvider?.id ?? "default"} ref={videoRef} style={StyleSheet.absoluteFill} source={{ uri: videoSourceUri, headers: videoSourceHeaders, type: videoContentType, bufferConfig: videoBufferConfig }}
        paused={!isPlaying} rate={is2xSeeking ? 2.0 : speed} resizeMode="contain" muted={muted} volume={volume}
        maxBitRate={adaptiveBitrateCap ?? undefined}
        onLoad={(data: OnLoadData) => { if (__DEV__) console.log(`[watch] first-frame t=${Date.now() - _watchMountTime}ms provider=${activeProvider?.id ?? "?"}`); setDuration(data.duration); sourceFirstFrame.current = true; sourceStarted.current = true; setPlayerStatus("playing"); setIsPlaying(true); setLastPlayerError(null); setShowControls(true); }}
        onProgress={handleVideoProgress}
        onBuffer={(data: OnBufferData) => { setBuffering(data.isBuffering); }}
        onVideoTracks={handleVideoTracks}
        onBandwidthUpdate={handleBandwidthUpdate}
        onPictureInPictureStatusChanged={onPipStatusChanged}
        onError={(event: any) => { const detail = event?.error?.errorString || event?.error?.errorCode || "Unknown player error"; const mountedUrl = source?.url ?? null; if (shouldRefreshMasterOnVariantError({ errorDetail: String(detail), variantUrl: mountedUrl, refreshedAlready: variantTokenRefreshAttempted.current === mountedUrl })) { variantTokenRefreshAttempted.current = mountedUrl; void refreshVariantFromMaster(); return; } setLastPlayerError(String(detail)); setPlayerStatus("error"); if (!useSourceProxy) { setUseSourceProxy(true); setSourceRevision((v) => v + 1); return; } handleProviderBlockedRef.current("player"); }}
        onEnd={() => { const reachedEnd = duration > 30 && currentTime >= Math.max(1, duration - 2); if (!sourceStarted.current || !reachedEnd) return; if (auth.user) { history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, episodeTitle: selectedEpisode?.title || null, episodeThumbnail: selectedEpisode?.thumbnail || null, progress: duration || currentTime, duration: duration || currentTime }); if (providerSync.connected.length) providerSync.pushProgress.mutate({ animeId, episode, progress: Math.floor(duration || currentTime), status: "completed" }); } showUpNext(); }}
      /> : (embedSource && !error) ? null : <View style={styles.videoPlaceholder}>
        {loadingServers ? <ProviderDiscoveryLoader attempt={serverAttempt} /> : loadingStream ? <View style={styles.thumbnailLoading}>
          <Image source={{ uri: selectedEpisode?.thumbnail || watchBackdrop || image || "" }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
          <View style={styles.thumbnailLoadingShade} />
          <View style={styles.thumbnailLoadingContent}><View style={styles.thumbnailPlay}><Play size={18} color={nothing.black} weight="fill" /></View><Text style={styles.thumbnailEpisode}>EPISODE {episode}</Text><Text numberOfLines={2} style={styles.thumbnailTitle}>{selectedEpisode?.title || title}</Text><Text style={styles.thumbnailStatus}>STARTING VIDEO</Text></View>
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

      {/* Center buffering veil — visible with chrome hidden too, so buffering
          never reads as "frozen". */}
      {source && buffering && !embedSource ? (
        <View pointerEvents="none" style={styles.bufferingVeil}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      ) : null}

      {/* ── Embed frame: the same player silhouette as native inline — scrimmed
          top bar (back / title / EMBED pill) and scrimmed bottom deck
          (provider line / fullscreen). The WebView keeps its own playback
          controls; this frame only makes it read as the same player. Taps
          pass through to the WebView (box-none), buttons stay hittable. */}
      {embedSource && !source ? (
        <View style={styles.embedFrame} pointerEvents="box-none">
          <View pointerEvents="none" style={styles.scrimTopSoft} />
          <View pointerEvents="none" style={styles.scrimTopMain} />
          <View pointerEvents="none" style={styles.scrimBottomSoft} />
          <View pointerEvents="none" style={styles.scrimBottomMain} />
          <View style={styles.embedTopBar}>
            <Pressable onPress={() => { if (manualFullscreen) exitFullscreen(); else router.back(); }} accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton} hitSlop={10}>
              <ArrowLeft size={22} color="#FFF" weight="bold" />
            </Pressable>
            <Text style={styles.playerTitle} numberOfLines={1} ellipsizeMode="tail">{`${title} - Episode ${episode}`}</Text>
            <View style={styles.topRightRow}>
              <View style={styles.subPillBadge}>
                <Text style={styles.subPillBadgeText}>EMBED</Text>
              </View>
            </View>
          </View>
          <View style={styles.embedBottomDeck}>
            <View style={styles.embedBottomInfo}>
              <Text style={styles.embedBottomLabel} numberOfLines={1}>{activeProvider ? `${activeProvider.label} · EMBEDDED STREAM` : "EMBEDDED STREAM"}</Text>
            </View>
            <Pressable onPress={manualFullscreen ? exitFullscreen : enterFullscreen} accessibilityRole="button" accessibilityLabel={manualFullscreen ? "Exit fullscreen" : "Enter fullscreen"} style={styles.iconButton} hitSlop={8}>
              {manualFullscreen ? <ArrowsIn size={20} color="#FFF" weight="bold" /> : <ArrowsOut size={20} color="#FFF" weight="bold" />}
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ── Mini progress: always visible when chrome is hidden, so inline
          never looks dead and matches the reference layout's timeline. ── */}
      {source && !showControls && !playerLocked && duration > 0 ? (
        <View style={styles.miniProgress} pointerEvents="none">
          <View style={[styles.miniProgressBuffered, { width: `${bufferPct}%` }]} />
          <View style={[styles.miniProgressPlayed, { width: `${progressPct}%` }]} />
        </View>
      ) : null}

      {/* ── Download / status toast (auto-dismisses) ── */}
      {downloadMessage ? (
        <View style={styles.statusToast} pointerEvents="none">
          <Download size={13} color={nothing.white} weight="bold" />
          <Text style={styles.statusToastText}>{downloadMessage}</Text>
        </View>
      ) : null}

      {/* ── PLAYER CHROME ── */}

      {/* Double-tap feedback */}
      {doubleTapSide ? (
        <Animated.View style={[styles.doubleTapOverlay, { left: doubleTapSide === "left" ? "12%" : undefined, right: doubleTapSide === "right" ? "12%" : undefined, opacity: doubleTapAnim }]} pointerEvents="none">
          {doubleTapSide === "left" ? <Rewind size={36} color="#FFF" weight="bold" /> : <FastForward size={36} color="#FFF" weight="bold" />}
          <Text style={styles.doubleTapText}>{doubleTapSide === "left" ? `-${doubleTapSeconds}s` : `+${doubleTapSeconds}s`}</Text>
        </Animated.View>
      ) : null}

      {/* Main controls — mounted only while visible (fading in or visible).
          When hidden they are fully unmounted so they never block touches
          on the gesture layer. pointerEvents switches with visibility, so
          buttons still win hit-test when chrome is up. */}
      {source && controlsRendered ? (
        <Animated.View style={[styles.controlsBackdrop, manualFullscreen && styles.controlsBackdropFullscreen, { opacity: controlsOpacity }]} pointerEvents={showControls && !playerLocked ? "box-none" : "none"}>
          {/* Edge scrims — layered bands fake a gradient without adding a
              native dependency; keeps top/bottom rows readable like the
              reference player. */}
          <View pointerEvents="none" style={styles.scrimTopSoft} />
          <View pointerEvents="none" style={styles.scrimTopMain} />
          <View pointerEvents="none" style={styles.scrimBottomSoft} />
          <View pointerEvents="none" style={styles.scrimBottomMain} />
          {/* TOP BAR */}
          <View style={styles.topBar}>
            <Pressable onPress={() => { if (manualFullscreen) exitFullscreen(); else router.back(); }} accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton} hitSlop={10}>
              <ArrowLeft size={22} color="#FFF" weight="bold" />
            </Pressable>
            <Text style={styles.playerTitle} numberOfLines={1} ellipsizeMode="tail">{`${title} - Episode ${episode}`}</Text>
            <View style={styles.topRightRow}>
              <Pressable onPress={() => setActivePanel("speed")} accessibilityRole="button" accessibilityLabel="Playback speed" style={styles.iconButton} hitSlop={8}>
                <Speedometer size={18} color="#FFF" weight="bold" />
              </Pressable>
              <Pressable onPress={() => setActivePanel(activePanel === "subtitles" ? null : "subtitles")} accessibilityRole="button" accessibilityLabel="Subtitles" style={[styles.iconButton, activePanel === "subtitles" && styles.iconButtonActive]} hitSlop={8}>
                <Subtitles size={18} color={activePanel === "subtitles" ? nothing.red : "#FFF"} weight="bold" />
              </Pressable>
              <Pressable onPress={() => setActivePanel(activePanel === "settings" ? null : "settings")} accessibilityRole="button" accessibilityLabel="Settings" style={[styles.iconButton, activePanel === "settings" && styles.iconButtonActive]} hitSlop={8}>
                <Gear size={18} color={activePanel === "settings" ? nothing.red : "#FFF"} weight="bold" />
              </Pressable>
            </View>
          </View>

          {/* BOTTOM CONTROLS */}
          <View style={styles.bottomDeck}>
            {/* Resume pill — resume hides near the end (there is nothing left
                to resume). Skip lives in the single floating overlay button
                below so it never renders twice. */}
            {(resumePosition && (duration <= 0 || resumePosition < duration * 0.9)) ? (
              <View style={styles.contextActions}>
                <Pressable onPress={() => { pendingResume.current = resumePosition; videoRef.current?.seek(resumePosition); setResumePosition(null); }} accessibilityRole="button" style={styles.resumeBtn}>
                  <Play size={12} color="#FFF" weight="fill" />
                  <Text style={styles.resumeBtnText}>{`RESUME ${formatTime(resumePosition)}`}</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Timeline */}
            <View style={styles.timelineRow}>
              <Text style={styles.timeLabel}>{formatTime(currentTime)}</Text>
              <View style={styles.progressBarTrack} onLayout={onProgressLayout} onTouchStart={onBarTouchStart} onTouchMove={onBarTouchMove} onTouchEnd={seekFromBar} accessibilityRole="adjustable" accessibilityLabel="Seek bar">
                <View style={[styles.progressBuffered, dragPct !== null && styles.progressTrackThick, { width: `${bufferPct}%` }]} />
                <View style={[styles.progressPlayed, dragPct !== null && styles.progressTrackThick, { width: `${dragPct !== null ? dragPct : progressPct}%` }]} />
                {chapterTrack.map((segment) => <View key={segment.kind} style={[styles.chapterMarker, { left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }]} />)}
                <View style={[styles.scrubberKnob, dragPct !== null && styles.scrubberKnobActive, { left: `${dragPct !== null ? dragPct : progressPct}%` }]} />
                {dragPct !== null ? <View style={[styles.dragPreview, { left: `${Math.max(0, Math.min(dragPct, 100))}%` }]}><Text style={styles.dragPreviewText}>{formatTime((dragPct / 100) * duration)}</Text></View> : null}
              </View>
              <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
            </View>

            {/* Action rail — reference layout: lock+volume | −10 prev play next +10 | download fullscreen.
                ±10 uses numbered icons — the old rail had two identical SkipBack/SkipForward
                pairs (±10 vs prev/next episode) that were impossible to tell apart. */}
            <View style={styles.actionRail}>
              <View style={styles.railSide}>
                <Pressable onPress={engagePlayerLock} accessibilityRole="button" accessibilityLabel="Lock player controls" style={styles.railBtn} hitSlop={8}>
                  <Lock size={18} color="#FFF" weight="bold" />
                </Pressable>
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setMuted((m) => !m); }} accessibilityRole="button" accessibilityLabel={muted ? "Unmute" : "Mute"} style={styles.railBtn} hitSlop={8}>
                  {muted ? <SpeakerNone size={18} color="#FFF" weight="bold" /> : <SpeakerHigh size={18} color="#FFF" weight="bold" />}
                </Pressable>
              </View>
              <View style={styles.railCenter}>
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); seekBy(-10); }} accessibilityRole="button" accessibilityLabel="Back 10 seconds" style={styles.railBtn} hitSlop={8}>
                  <AppIcon name="rewind-10" size={23} color="#FFF" />
                </Pressable>
                <Pressable disabled={!previousKnownEpisode} onPress={() => previousKnownEpisode && goToEpisode(previousKnownEpisode)} accessibilityRole="button" accessibilityLabel="Previous episode" style={[styles.railBtn, !previousKnownEpisode && styles.railBtnDisabled]} hitSlop={8}>
                  <SkipBack size={20} color="#FFF" weight="fill" />
                </Pressable>
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setIsPlaying((p) => !p); }} onLongPress={beginHoldSpeed} onPressOut={endHoldSpeed} delayLongPress={400} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause" : "Play"} accessibilityHint="Hold for 2x speed" style={[styles.bigPlayButton, manualFullscreen && styles.bigPlayButtonFullscreen]}>
                  {isPlaying ? <Pause size={26} color="#000" weight="fill" /> : <Play size={26} color="#000" weight="fill" style={{ marginLeft: 2 }} />}
                </Pressable>
                <Pressable disabled={!nextKnownEpisode} onPress={nextEpisode} accessibilityRole="button" accessibilityLabel="Next episode" style={[styles.railBtn, !nextKnownEpisode && styles.railBtnDisabled]} hitSlop={8}>
                  <SkipForward size={20} color="#FFF" weight="fill" />
                </Pressable>
                <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); seekBy(10); }} accessibilityRole="button" accessibilityLabel="Forward 10 seconds" style={styles.railBtn} hitSlop={8}>
                  <AppIcon name="fast-forward-10" size={23} color="#FFF" />
                </Pressable>
              </View>
              <View style={styles.railSideRight}>
                {downloadProgress !== null ? (
                  /* expo-file-system's File.downloadFileAsync emits no incremental
                     progress (only the final 1.0), so show an honest spinner. */
                  <View style={styles.downloadBtn} accessibilityLabel="Downloading episode">
                    <ActivityIndicator size="small" color="#FFF" />
                  </View>
                ) : offlineDownload ? (
                  <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); playOffline(); }} onLongPress={() => { void removeDownload(); }} accessibilityRole="button" accessibilityLabel="Play saved download" accessibilityHint="Long press to remove the saved copy" style={styles.railBtn} hitSlop={8}>
                    <DownloadSimple size={19} color={nothing.green} weight="bold" />
                  </Pressable>
                ) : (
                  <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onDownloadPress(); }} accessibilityRole="button" accessibilityLabel="Download episode" accessibilityHint="Opens quality options when the provider offers them" style={styles.railBtn} hitSlop={8}>
                    <Download size={19} color="#FFF" weight="bold" />
                  </Pressable>
                )}
                <Pressable onPress={manualFullscreen ? exitFullscreen : enterFullscreen} accessibilityRole="button" accessibilityLabel={manualFullscreen ? "Exit fullscreen" : "Enter fullscreen"} style={styles.railBtn} hitSlop={8}>
                  {manualFullscreen ? <ArrowsIn size={18} color="#FFF" weight="bold" /> : <ArrowsOut size={18} color="#FFF" weight="bold" />}
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {/* Skip Intro/Outro (positioned bottom-right) */}
      {skipKind === "intro" && !playerLocked ? (
        <Pressable style={styles.skipButtonOverlay} onPress={() => skip("intro")} accessibilityRole="button" accessibilityLabel="Skip intro" accessibilityHint="Skips the opening sequence">
          <SkipForward size={14} color="#FFF" weight="bold" />
          <Text style={styles.skipButtonText}>{`SKIP INTRO`}</Text>
          <Text style={styles.skipCountdown}>{`· ${Math.max(0, Math.round((skipSegments.intro?.endTime ?? currentTime) - currentTime))}s`}</Text>
        </Pressable>
      ) : null}
      {skipKind === "outro" && !playerLocked ? (
        <Pressable style={styles.skipButtonOverlay} onPress={() => skip("outro")} accessibilityRole="button" accessibilityLabel="Skip outro" accessibilityHint="Skips the ending sequence">
          <SkipForward size={14} color="#FFF" weight="bold" />
          <Text style={styles.skipButtonText}>{`SKIP OUTRO`}</Text>
          <Text style={styles.skipCountdown}>{`· ${Math.max(0, Math.round((skipSegments.outro?.endTime ?? currentTime) - currentTime))}s`}</Text>
        </Pressable>
      ) : null}

      {/* Up-next card: next poster + title, waits for the user. No auto-play. */}
      {source && upNextVisible && nextKnownEpisode && !playerLocked ? (
        <View style={styles.upNextCard}>
          {nextEpisodeDisplay?.thumbnail ? <Image source={{ uri: nextEpisodeDisplay.thumbnail }} style={styles.upNextPoster} contentFit="cover" cachePolicy="memory-disk" /> : null}
          <View style={styles.upNextCopy}>
            <Text style={styles.upNextKicker}>UP NEXT</Text>
            <Text numberOfLines={1} style={styles.upNextTitle}>{`EP ${nextKnownEpisode}${nextEpisodeDisplay?.title ? ` · ${nextEpisodeDisplay.title}` : ""}`}</Text>
            <View style={styles.upNextRow}>
              <Pressable onPress={() => { setUpNextVisible(false); goToEpisode(nextKnownEpisode); }} accessibilityRole="button" accessibilityLabel="Play next episode now" style={styles.upNextPlay} hitSlop={8}>
                <Text style={styles.upNextPlayText}>PLAY NOW</Text>
              </Pressable>
              <Pressable onPress={dismissUpNext} accessibilityRole="button" accessibilityLabel="Dismiss up next" style={styles.upNextDismiss} hitSlop={8}>
                <X size={15} color="#FFF" weight="bold" />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Locked state */}
      {playerLocked ? (
        <Pressable style={[styles.lockedPill, unlockArmed && styles.lockedPillArmed]} onPress={requestUnlock} accessibilityRole="button" accessibilityLabel="Unlock player" accessibilityHint="Tap twice to unlock player controls">
          <Lock size={16} color={unlockArmed ? nothing.red : "#FFF"} weight="bold" />
          <Text style={styles.lockedText}>{unlockArmed ? "Tap again to unlock" : "Controls locked"}</Text>
        </Pressable>
      ) : null}

      {/* Gesture HUD overlays */}
      {is2xSeeking ? (
        <View style={chrome.badge2x} pointerEvents="none">
          <FastForward size={16} color="#FFF" weight="bold" />
          <Text style={chrome.badge2xText}>2X SPEED</Text>
        </View>
      ) : null}
      {volumeHud !== null ? (
        <View style={chrome.verticalBarWrap} pointerEvents="none">
          <View style={chrome.verticalBarBg}><View style={[chrome.verticalBarFill, { height: `${volumeHud}%` }]} /></View>
          <View style={chrome.verticalBarLabel}>
            {volumeHud === 0 ? <SpeakerNone size={14} color="#FFF" weight="bold" /> : <SpeakerHigh size={14} color="#FFF" weight="bold" />}
            <Text style={chrome.verticalBarText}>{volumeHud}%</Text>
          </View>
        </View>
      ) : null}
      {brightnessHud !== null ? (
        <View style={chrome.verticalBarWrapLeft} pointerEvents="none">
          <View style={chrome.verticalBarBg}><View style={[chrome.verticalBarFillBright, { height: `${brightnessHud}%` }]} /></View>
          <View style={chrome.verticalBarLabel}>
            <Sun size={14} color="#FFF" weight="bold" />
            <Text style={chrome.verticalBarText}>{brightnessHud}%</Text>
          </View>
        </View>
      ) : null}

      {/* ── Settings panel — quality + playback info ── */}
      {source && activePanel === "settings" && !playerLocked ? <View style={ps.settingsOverlay}>
        <View style={ps.settingsHeader}>
          <Text style={ps.settingsHeaderText}>Settings</Text>
          <Pressable onPress={() => setActivePanel(null)} accessibilityRole="button" accessibilityLabel="Close settings" hitSlop={8}>
            <X size={15} color="#FFF" weight="bold" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={ps.settingsContent} showsVerticalScrollIndicator={false}>
          <Text style={ps.sectionLabel}>{t("player.quality")}</Text>
          <View style={ps.chipRow}>
            {displayedQualityOptions.length ? displayedQualityOptions.map((item: WatchQualityOption) => {
              const selected = displayedQuality.toLowerCase() === item.label.toLowerCase();
              return <Pressable key={item.id} onPress={() => { if (source) void selectAdaptiveQuality(item); else if (item.source) selectQuality(item.source); }} style={[ps.chip, selected && ps.chipActive]}><Text style={[ps.chipText, selected && ps.chipTextActive]}>{item.label}</Text></Pressable>;
            }) : <Text style={ps.emptyLine}>{t("player.nothingSelectable")}</Text>}
          </View>
          {(() => {
            const ceiling = parsedQualityOptions?.find((option) => option.requestQuality !== "auto")?.label ?? null;
            if (liveHeight) return <Text style={ps.emptyLine}>{autoQualityLine({ ceilingLabel: ceiling, liveHeight })}</Text>;
            return ceiling ? <Text style={ps.emptyLine}>{`Auto · up to ${ceiling}`}</Text> : null;
          })()}
          {parsedQualityNote ? <Text style={ps.emptyLine} numberOfLines={1}>{parsedQualityNote}</Text> : null}

          <Text style={ps.sectionLabel}>INFO</Text>
          <View style={ps.infoRow}>
            <Text style={ps.infoLabel}>Server</Text>
            <Text style={ps.infoValue}>{activeProvider?.label || "Unknown"}</Text>
          </View>
          <View style={ps.infoRow}>
            <Text style={ps.infoLabel}>Quality</Text>
            <Text style={ps.infoValue}>{displayedQuality || "Auto"}</Text>
          </View>
          <View style={ps.infoRow}>
            <Text style={ps.infoLabel}>Language</Text>
            <Text style={ps.infoValue}>{language === "sub" ? "Subtitled" : "Dubbed"}</Text>
          </View>
          <View style={ps.infoRow}>
            <Text style={ps.infoLabel}>Source</Text>
            <Text style={ps.infoValue}>{embedSource ? "Embed" : useSourceProxy ? "Proxied" : "Direct"}</Text>
          </View>
          <View style={ps.infoRow}>
            <Text style={ps.infoLabel}>Format</Text>
            <Text style={ps.infoValue}>{source?.type?.toUpperCase() || "HLS"}</Text>
          </View>
        </ScrollView>
      </View> : null}

      {/* ── Subtitle panel — language, size, bg, outline, font ── */}
      {source && activePanel === "subtitles" && !playerLocked ? <View style={ps.settingsOverlay}>
        <View style={ps.settingsHeader}>
          <Text style={ps.settingsHeaderText}>Subtitles</Text>
          <Pressable onPress={() => setActivePanel(null)} accessibilityRole="button" accessibilityLabel="Close subtitles" hitSlop={8}>
            <X size={15} color="#FFF" weight="bold" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={ps.settingsContent} showsVerticalScrollIndicator={false}>
          <Text style={ps.sectionLabel}>{t("player.subtitles")}</Text>
          <View style={ps.chipRow}>
            {source.subtitles?.length ? <>
              <Pressable onPress={() => updateSubtitlePrefs({ enabled: false })} style={[ps.chip, subtitlePrefs && !subtitlePrefs.enabled && ps.chipActive]}>
                <Text style={[ps.chipText, subtitlePrefs && !subtitlePrefs.enabled && ps.chipTextActive]}>{t("player.off")}</Text>
              </Pressable>
              {source.subtitles.map((sub) => { const active = subtitlePrefs?.enabled && selectedSubtitleUrl === sub.url; return <Pressable key={sub.url} onPress={() => updateSubtitlePrefs({ enabled: true, preferredLanguage: sub.lang || sub.label || "en" })} style={[ps.chip, active && ps.chipActive]}><Text numberOfLines={1} style={[ps.chipText, active && ps.chipTextActive]}>{sub.label || sub.lang || "Track"}</Text></Pressable>; })}
            </> : <Text style={ps.emptyLine}>{t("player.noTracks")}</Text>}
          </View>

          <Text style={ps.sectionLabel}>{t("player.subtitleSize")}</Text>
          <View style={ps.chipRow}>
            {[{ label: "S", value: 12 }, { label: "M", value: 14 }, { label: "L", value: 18 }].map((preset) => {
              const active = (subtitlePrefs?.fontSize ?? 14) === preset.value;
              return <Pressable key={preset.label} onPress={() => updateSubtitlePrefs({ enabled: true, fontSize: preset.value })} style={[ps.chip, active && ps.chipActive]}><Text style={[ps.chipText, active && ps.chipTextActive]}>{preset.label}</Text></Pressable>;
            })}
          </View>

          <Text style={ps.sectionLabel}>BACKGROUND</Text>
          <View style={ps.chipRow}>
            {BG_OPACITY_PRESETS.map((val) => {
              const active = (subtitlePrefs?.bgOpacity ?? 0.55) === val;
              const label = val === 0 ? "Off" : `${Math.round(val * 100)}%`;
              return <Pressable key={val} onPress={() => updateSubtitlePrefs({ enabled: true, bgOpacity: val })} style={[ps.chip, active && ps.chipActive]}><Text style={[ps.chipText, active && ps.chipTextActive]}>{label}</Text></Pressable>;
            })}
          </View>

          <Text style={ps.sectionLabel}>OUTLINE</Text>
          <View style={ps.chipRow}>
            {OUTLINE_PRESETS.map((val) => {
              const active = (subtitlePrefs?.outlineThickness ?? 2) === val;
              const label = val === 0 ? "Off" : `${val}px`;
              return <Pressable key={val} onPress={() => updateSubtitlePrefs({ enabled: true, outlineThickness: val })} style={[ps.chip, active && ps.chipActive]}><Text style={[ps.chipText, active && ps.chipTextActive]}>{label}</Text></Pressable>;
            })}
          </View>

          <Text style={ps.sectionLabel}>FONT</Text>
          <View style={ps.chipRow}>
            {SUBTITLE_FONTS.map((font) => {
              const active = (subtitlePrefs?.fontFamily ?? "default") === font.id;
              return <Pressable key={font.id} onPress={() => updateSubtitlePrefs({ enabled: true, fontFamily: font.id })} style={[ps.chip, active && ps.chipActive]}><Text style={[ps.chipText, active && ps.chipTextActive]}>{font.label}</Text></Pressable>;
            })}
          </View>
        </ScrollView>
      </View> : null}

      {source && sleepRemaining && !playerLocked ? <SleepTimerPill remaining={sleepRemaining} onPress={() => setActivePanel("settings")} /> : null}
    </View>

    {/* ── Error ── */}
    {error ? <View style={styles.errorAction}><NothingCard style={styles.errorCard}><DotLabel tone="muted">{futureRelease ? "FUTURE EPISODE" : "VIDEO UNAVAILABLE"}</DotLabel><Text style={styles.errorCopy}>{error}</Text>{lastPlayerError ? <Text style={styles.errorCopy}>{humanPlayerError(lastPlayerError) ?? "Playback failed on this server."}</Text> : null}{lastPlayerError ? <Text style={ps.diagnosticLine}>{`PLAYER · ${lastPlayerError}`}</Text> : null}{skipFetchStatus !== "idle" && skipFetchStatus !== "ok" ? <Text style={ps.diagnosticLine}>{`SKIP DATA · ${skipFetchStatus.toUpperCase()}`}</Text> : null}{futureRelease ? null : <View style={styles.errorBtnRow}><NothingButton label={t("player.retry")} onPress={retry} variant="outline" /><NothingButton label={t("player.switchServer")} onPress={() => handleProviderBlocked("permanent")} variant="outline" /><NothingButton label={t("player.copyError")} onPress={() => { void Clipboard.setStringAsync(`${error}${lastPlayerError ? `\nPLAYER · ${lastPlayerError}` : ""}${skipFetchStatus !== "idle" && skipFetchStatus !== "ok" ? `\nSKIP DATA · ${skipFetchStatus.toUpperCase()}` : ""}\nSERVER · ${activeProvider?.label || "UNKNOWN"} · ${embedSource ? "EMBED" : useSourceProxy ? "PROXY" : "DIRECT"}`).catch(() => {}); }} variant="outline" /></View>}</NothingCard></View> : null}

    {/* ── Below player ── */}
    {!manualFullscreen ? <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS === "android"}>
      <View style={styles.th3Section}>
        <Text style={styles.th3Watching}><Text style={styles.th3WatchingGreen}>You are watching </Text><Text style={styles.th3WatchingWhite}>Episode {episode}</Text></Text>
        {swipeDirectionHint ? <View style={styles.swipeHintRow}><AppIcon name="chevron-left" size={12} color={previousKnownEpisode ? nothing.muted : nothing.dim} /><Text style={[styles.swipeHintText, !previousKnownEpisode && !nextKnownEpisode && { color: nothing.dim }]}>{swipeDirectionHint}</Text><AppIcon name="chevron-right" size={12} color={nextKnownEpisode ? nothing.muted : nothing.dim} /></View> : null}
        <View style={styles.th3Tabs}>
          {providers.sub.length > 0 && providers.dub.length > 0 ? (["sub", "dub"] as Language[]).map((item) => { const active = language === item; return <Pressable key={item} accessibilityRole="tab" accessibilityLabel={`${item === "sub" ? "Subtitled" : "Dubbed"}${active ? " (selected)" : ""}`} accessibilityHint="Switch to this audio language" onPress={() => selectLanguage(item)} style={[styles.th3Tab, active && styles.th3TabActive]}><Text style={[styles.th3TabText, active && styles.th3TabTextActive]}>{item === "sub" ? "SUB" : "DUB"}</Text></Pressable>; }) : null}
        </View>
        <View style={styles.th3Servers}>
          {activeProviders.map((provider, index) => { const active = index === serverIndex; return <Pressable key={provider.id} accessibilityRole="button" accessibilityLabel={`Server: ${provider.label}${active ? " (selected)" : ""}`} accessibilityHint={active ? "Currently active server" : "Switch to this streaming server"} onPress={() => selectServer(index)} style={[styles.th3Server, active && styles.th3ServerActive]}><Text style={[styles.th3ServerText, active && styles.th3ServerTextActive]}>{provider.label}</Text></Pressable>; })}
        </View>
        <View style={styles.th3EpHead}>
          <Text style={styles.th3EpTitle}>{t("player.listOfEpisodes")}</Text>
        </View>
        <View style={styles.th3EpsRow}>
          <AppIcon name="options" size={14} color={nothing.muted} />
          <Text style={styles.th3EpsText}>EPS: {episodePage * EPISODE_PAGE_SIZE + 1}-{Math.min((episodePage + 1) * EPISODE_PAGE_SIZE, filteredEpisodes.length)}</Text>
          <View style={styles.th3EpSearch}><AppIcon name="magnify" size={14} color={nothing.muted} /><TextInput value={episodeSearch} onChangeText={setEpisodeSearch} placeholder="Ep number" placeholderTextColor={nothing.dim} style={styles.th3EpSearchInput} returnKeyType="done" keyboardType={episodeSearch && /\d/.test(episodeSearch) ? "number-pad" : "default"} /></View>
        </View>
        {episodeQuery.isPending ? <View style={styles.episodeLoading}><ActivityIndicator color={nothing.white} /><Text style={styles.episodeLoadingText}>LOADING EPISODES</Text></View> : filteredEpisodes.length ? <>
          <Animated.View style={[styles.episodeSwipeContainer, { transform: [{ translateX: swipeOffsetX }] }]} {...episodeSwipeResponder.panHandlers}>
            <EpisodeGrid episodes={pagedEpisodes} activeEpisode={episode} totalPages={totalEpisodePages} page={safeEpisodePage} onPageChange={setEpisodePage} onSelect={goToEpisode} onInfo={openEpisodeInfo} totalEpisodeCount={filteredEpisodes.length} />
          </Animated.View>
        </> : <Text style={styles.emptyEpisodeText}>{episodeSearch ? "No episodes match your search." : "No episodes are listed for this title."}</Text>}
      </View>
      <View style={styles.watchCommunitySection}>
        <View style={styles.ratingRow}><Text style={styles.ratingPrompt}>{currentRating ? `${t("player.youRated")} ${currentRating}/10` : t("player.rateEpisode")}</Text><View style={styles.ratingChoices}>{Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <Pressable key={score} onPress={() => { if (!auth.user) { router.push("/auth" as never); return; } ratings.setRating.mutate({ episode, score }); }} style={[styles.ratingChoice, currentRating >= score && styles.ratingChoiceActive]}><Text style={[styles.ratingChoiceText, currentRating >= score && styles.ratingChoiceTextActive]}>{score}</Text></Pressable>)}</View></View>
        <AnimeComments animeId={animeId} episodeNumber={episode} />
      </View>
    </ScrollView> : null}

    {/* ── Modal Pickers ── */}
    <Modal visible={activePanel === "speed"} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setActivePanel(null)}><View style={styles.modalSheet}><Text style={styles.modalTitle}>{t("player.playbackSpeed")}</Text>{[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((val) => <Pressable key={val} style={[styles.modalItem, speed === val && styles.modalItemActive]} onPress={() => { setSpeed(val); lockedSpeed.current = val; setActivePanel(null); }}><Text style={[styles.modalItemText, speed === val && styles.modalItemTextActive]}>{val === 1.0 ? "1.0x (Normal)" : `${val}x`}</Text>{speed === val && <Check size={20} color={nothing.red} weight="bold" />}</Pressable>)}</View></Pressable></Modal>

    <Modal visible={activePanel === "server"} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setActivePanel(null)}><View style={styles.modalSheet}><Text style={styles.modalTitle}>{t("player.selectServer")}</Text>{providers.sub.length > 0 && providers.dub.length > 0 ? <View style={styles.languageRow}>{(["sub", "dub"] as Language[]).map((item) => <Pressable key={item} onPress={() => selectLanguage(item)} style={[styles.language, language === item && styles.languageActive]}><Text style={[styles.languageText, language === item && styles.languageTextActive]}>{item === "sub" ? `SUB · ${providers.sub.length}` : `DUB · ${providers.dub.length}`}</Text></Pressable>)}</View> : null}
      {selectableProviders.length ? selectableProviders.map(({ provider, index }) => <Pressable key={provider.id} onPress={() => { selectServer(index); setActivePanel(null); }} style={[styles.modalItem, index === serverIndex && styles.modalItemActive]}><Text style={[styles.modalItemText, index === serverIndex && styles.modalItemTextActive]}>{provider.label}</Text>{index === serverIndex && <Check size={20} color={nothing.red} weight="bold" />}</Pressable>) : <Text style={styles.modalItemSub}>Looking for a working server…</Text>}</View></Pressable></Modal>

    {/* Download quality picker: backend per-quality file links for this language */}
    <Modal visible={activePanel === "download"} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setActivePanel(null)}><View style={styles.modalSheet}><Text style={styles.modalTitle}>DOWNLOAD · {language.toUpperCase()} · EP {episode}</Text>
      {backendDownloadOptions.map((option) => <Pressable key={option.url} onPress={() => { void openBackendDownload(option); }} style={styles.modalItem}><View style={{ flex: 1 }}><Text style={styles.modalItemText}>{option.quality ?? option.label}</Text>{option.quality ? <Text style={styles.modalItemSub}>{option.label}</Text> : null}</View><Download size={18} color={nothing.muted} weight="bold" /></Pressable>)}
    </View></Pressable></Modal>

    {/* Chapter List Modal */}
    <Modal visible={activePanel === "chapters" && !playerLocked} transparent animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setActivePanel(null)}><View style={styles.chapterModalSheet}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={styles.modalTitle}>{t("player.chapters")}</Text><Pressable onPress={() => setActivePanel(null)}><X size={20} color={nothing.muted} weight="bold" /></Pressable></View>
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
                <Pressable key={ch.kind} onPress={() => { seekTo(ch.startTime); setActivePanel(null); }} style={[styles.chapterItem, isActive && styles.chapterItemActive, isPast && styles.chapterItemPast]}>
                  <View style={styles.chapterItemLeft}>
                    <View style={[styles.chapterDot, isActive && styles.chapterDotActive, isPast && styles.chapterDotPast]} />
                    <View style={styles.chapterInfo}>
                      <Text style={[styles.chapterName, isActive && styles.chapterNameActive]}>{ch.name}</Text>
                      <Text style={styles.chapterTimestamp}>{formatTime(ch.startTime)} - {formatTime(ch.endTime)}</Text>
                    </View>
                  </View>
                  <View style={styles.chapterItemRight}>
                    <Text style={styles.chapterDuration}>{formatTime(durationSec)}</Text>
                    {isActive ? <Play size={16} color={nothing.red} weight="fill" /> : isPast ? <Check size={16} color={nothing.dim} weight="bold" /> : <CaretRight size={16} color={nothing.muted} weight="bold" />}
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
const ps = StyleSheet.create({
  videoShellFullscreen: { position: "absolute", zIndex: 50, elevation: 50, top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", aspectRatio: undefined, backgroundColor: "#000000", justifyContent: "center" },
  settingsOverlay: { position: "absolute", zIndex: 4, top: 6, right: 6, bottom: 6, width: 240, maxWidth: "76%", borderRadius: 4, backgroundColor: "rgba(9,9,9,0.92)", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  settingsHeaderText: { color: "#FFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  settingsContent: { padding: 8, paddingBottom: 10, gap: 1 },
  sectionLabel: { color: "#FF4D4D", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginTop: 6, marginBottom: 2, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  chip: { minHeight: 26, paddingHorizontal: 8, borderRadius: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: nothing.red, borderColor: nothing.red },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  chipTextActive: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  emptyLine: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "500" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  infoLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "600" },
  infoValue: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700" },
  diagnosticLine: { color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: "600", letterSpacing: 0.3, marginTop: 6 },
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  invalidWrap: { flex: 1, alignItems: "flex-start", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  invalidTitle: { color: nothing.white, fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  top: { minHeight: 52, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  closeButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 6 },
  topCopy: { flex: 1, gap: 2 },
  title: { color: nothing.white, fontSize: 18, fontWeight: "900", lineHeight: 22, letterSpacing: -0.5 },
  episodeLabel: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  videoShell: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000000", overflow: "hidden", position: "relative" },
  video: { flex: 1 },
  gestureOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  embedChrome: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 5, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.55)" },
  embedFrame: { ...StyleSheet.absoluteFillObject, zIndex: 3, justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 6 },
  embedTopBar: { flexDirection: "row", alignItems: "center", flexWrap: "nowrap", width: "100%" },
  embedBottomDeck: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  embedBottomInfo: { flex: 1, flexShrink: 1, marginRight: 6 },
  embedBottomLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  miniProgress: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, backgroundColor: "rgba(255,255,255,0.22)", zIndex: 2 },
  miniProgressBuffered: { position: "absolute", top: 0, left: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.35)" },
  miniProgressPlayed: { position: "absolute", top: 0, left: 0, bottom: 0, backgroundColor: "#FF4D4D" },
  statusToast: { position: "absolute", bottom: 28, alignSelf: "center", zIndex: 14, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  statusToastText: { color: "#FFF", fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  subtitleWrapper: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", alignItems: "center", paddingBottom: 68, zIndex: 1 },
  subtitleWrapperWithControls: { paddingBottom: 144 },
  subtitleWrapperFullscreen: { paddingBottom: 24 },
  controlsBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 3, justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 6 },
  controlsBackdropFullscreen: { paddingHorizontal: 20, paddingVertical: 12 },
  // Edge scrims stay light on purpose: readability bands only, never a veil
  // over the picture. They mount solely with the chrome and unmount with it.
  scrimTopMain: { position: "absolute", top: 0, left: 0, right: 0, height: 56, backgroundColor: "rgba(0,0,0,0.22)" },
  scrimTopSoft: { position: "absolute", top: 0, left: 0, right: 0, height: 96, backgroundColor: "rgba(0,0,0,0.10)" },
  scrimBottomMain: { position: "absolute", bottom: 0, left: 0, right: 0, height: 80, backgroundColor: "rgba(0,0,0,0.22)" },
  scrimBottomSoft: { position: "absolute", bottom: 0, left: 0, right: 0, height: 110, backgroundColor: "rgba(0,0,0,0.10)" },
  topBar: { flexDirection: "row", alignItems: "center", flexWrap: "nowrap", width: "100%" },
  playerTitle: { flex: 1, flexShrink: 1, color: "#FFF", fontSize: 13, fontWeight: "600", marginLeft: 8, marginRight: 6 },
  topRightRow: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  iconButton: { width: 30, height: 30, padding: 2, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  iconButtonActive: { backgroundColor: "rgba(255,77,77,0.15)", borderRadius: 4 },
  orientationBadge: { backgroundColor: "rgba(255,77,77,0.85)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  orientationBadgeText: { color: nothing.white, fontFamily: nothing.mono, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  subPillBadge: { backgroundColor: nothing.red, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, flexShrink: 0 },
  subPillBadgeText: { color: nothing.black, fontSize: 10, fontWeight: "800", letterSpacing: 0.2, textTransform: "uppercase" },
  bottomDeck: { gap: 3, width: "100%" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 4, width: "100%" },
  timeLabel: { color: "#FFF", fontSize: 11, fontWeight: "600", minWidth: 34, textAlign: "center", flexShrink: 0, fontVariant: ["tabular-nums"] },
  progressBarTrack: { flex: 1, height: 16, justifyContent: "center" },
  progressBuffered: { position: "absolute", height: 2, backgroundColor: "rgba(255,255,255,0.45)", borderRadius: 1 },
  progressPlayed: { position: "absolute", height: 2, backgroundColor: nothing.red, borderRadius: 1 },
  progressTrackThick: { height: 3, borderRadius: 1.5 },
  scrubberKnob: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFF", marginLeft: -5, top: 3, elevation: 3 },
  scrubberKnobActive: { width: 14, height: 14, borderRadius: 7, marginLeft: -7, top: 1 },
  dragPreview: { position: "absolute", top: -28, marginLeft: -24, backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  dragPreviewText: { color: nothing.white, fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  actionRail: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", width: "100%" },
  railSide: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  railSideRight: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2, flexShrink: 0 },
  railCenter: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 1, justifyContent: "center" },
  railBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  railBtnDisabled: { opacity: 0.35 },
  downloadBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center", flexShrink: 0, gap: 0 },
  bigPlayButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", flexShrink: 0, marginHorizontal: 4 },
  bigPlayButtonFullscreen: { width: 56, height: 56, borderRadius: 28 },
  hudBadge: { position: "absolute", top: 20, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 5, zIndex: 10 },
  hudPill: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8, zIndex: 10 },
  hudText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  doubleTapOverlay: { position: "absolute", top: "32%", alignItems: "center", justifyContent: "center", zIndex: 12 },
  doubleTapText: { color: "#FFF", fontSize: 12, fontWeight: "800", marginTop: 3 },
  chapterMarker: { position: "absolute", height: 2, backgroundColor: "#FFD600", borderRadius: 1, top: 7 },
  skipButtonOverlay: { position: "absolute", bottom: 120, right: 12, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 4, zIndex: 15, elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8 },
  upNextCard: { position: "absolute", bottom: 120, right: 12, zIndex: 15, elevation: 6, flexDirection: "row", gap: 8, alignItems: "center", maxWidth: 260, backgroundColor: "rgba(9,9,9,0.88)", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  upNextPoster: { width: 44, height: 62, borderRadius: 4, backgroundColor: nothing.raised },
  upNextCopy: { flex: 1, gap: 3 },
  upNextKicker: { color: nothing.red, fontSize: 10, fontWeight: "800", letterSpacing: 0.6, fontVariant: ["tabular-nums"] },
  upNextTitle: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  upNextRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  upNextPlay: { minHeight: 30, paddingHorizontal: 10, justifyContent: "center", borderRadius: 4, backgroundColor: nothing.red },
  upNextPlayText: { color: "#FFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  upNextDismiss: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  skipButtonText: { color: nothing.black, fontSize: 11, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  skipCountdown: { color: nothing.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  lockedPill: { position: "absolute", bottom: 32, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", zIndex: 15 },
  lockedPillArmed: { borderColor: nothing.red },
  bufferingVeil: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 2 },
  lockedText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "rgba(9,9,9,0.96)", borderTopLeftRadius: 2, borderTopRightRadius: 2, padding: 14, gap: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  modalTitle: { color: "#FFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.3, marginBottom: 4, textTransform: "uppercase" },
  modalItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  modalItemActive: { backgroundColor: "rgba(255,77,77,0.06)" },
  modalItemText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  modalItemSub: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "600", marginTop: 1 },
  modalItemTextActive: { color: nothing.red, fontWeight: "700" },
  chapterModalSheet: { backgroundColor: "rgba(9,9,9,0.96)", borderTopLeftRadius: 2, borderTopRightRadius: 2, padding: 14, gap: 4, maxHeight: "70%", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  chapterList: { gap: 1 },
  chapterItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  chapterItemActive: { backgroundColor: "rgba(255,77,77,0.06)" },
  chapterItemPast: { opacity: 0.45 },
  chapterItemLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  chapterDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: nothing.dim },
  chapterDotActive: { backgroundColor: nothing.red },
  chapterDotPast: { backgroundColor: nothing.green },
  chapterInfo: { gap: 1 },
  chapterName: { color: nothing.white, fontSize: 11, fontWeight: "700" },
  chapterNameActive: { color: nothing.red },
  chapterTimestamp: { color: nothing.muted, fontSize: 9, fontWeight: "500", fontVariant: ["tabular-nums"] },
  chapterItemRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  chapterDuration: { color: nothing.dim, fontSize: 9, fontWeight: "600", fontVariant: ["tabular-nums"] },
  chapterEmptyText: { color: nothing.muted, fontSize: 11, textAlign: "center", paddingVertical: 12 },
  contextActions: { alignSelf: "flex-end", alignItems: "flex-end", gap: 4 },
  videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#090909" },
  thumbnailLoading: { ...StyleSheet.absoluteFillObject, overflow: "hidden", justifyContent: "flex-end", backgroundColor: "#090909" },
  thumbnailLoadingShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.32)" },
  thumbnailLoadingContent: { zIndex: 1, gap: 6, padding: 14, paddingTop: 48, backgroundColor: "rgba(9,9,9,0.68)" },
  thumbnailPlay: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: nothing.white, borderRadius: 4 },
  thumbnailEpisode: { color: nothing.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  thumbnailTitle: { color: nothing.white, fontSize: 14, lineHeight: 18, fontWeight: "900" },
  thumbnailStatus: { color: nothing.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  placeholderText: { color: nothing.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  errorText: { color: nothing.red, fontSize: 11, fontWeight: "600", textAlign: "center", paddingHorizontal: 20 },
  playerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 3, justifyContent: "space-between", padding: 8 },
  pointerBoxNone: { pointerEvents: "box-none" },
  pointerNone: { pointerEvents: "none" },
  th3Section: { gap: 10 },
  th3Watching: { fontSize: 16, fontWeight: "900", letterSpacing: -0.4, textAlign: "center", paddingVertical: 10, marginHorizontal: -14, backgroundColor: nothing.surface, borderBottomWidth: 1, borderBottomColor: nothing.line },
  th3WatchingGreen: { color: nothing.red, fontSize: 16, fontWeight: "900", letterSpacing: -0.4 },
  th3WatchingWhite: { color: nothing.white, fontSize: 16, fontWeight: "900", letterSpacing: -0.4 },
  th3Tabs: { flexDirection: "row", gap: 16, marginHorizontal: 14, borderBottomWidth: 1, borderBottomColor: nothing.line },
  th3Tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  th3TabActive: { borderBottomColor: nothing.red },
  th3TabText: { color: nothing.muted, fontSize: 14, fontWeight: "700" },
  th3TabTextActive: { color: nothing.red, fontWeight: "900" },
  th3TabTextEmpty: { color: nothing.dim },
  th3Servers: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4, marginHorizontal: 14 },
  th3Server: { minHeight: 32, paddingHorizontal: 14, justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  th3ServerActive: { backgroundColor: nothing.red, borderColor: nothing.red },
  th3ServerText: { color: nothing.muted, fontSize: 12, fontWeight: "700" },
  th3ServerTextActive: { color: nothing.black, fontWeight: "900" },
  th3EpHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  th3EpTitle: { color: nothing.white, fontSize: 16, fontWeight: "900", letterSpacing: -0.4 },
  th3EpSearch: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 34, minWidth: 140, borderWidth: 1, borderColor: nothing.line, borderRadius: 8, backgroundColor: nothing.surface },
  th3EpSearchInput: { flex: 1, color: nothing.white, fontSize: 12, paddingVertical: 0 },
  th3EpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  th3EpsText: { color: nothing.red, fontFamily: nothing.mono, fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  th3Grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  th3EpBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface, overflow: "hidden" },
  th3EpBtnActive: { backgroundColor: nothing.red, borderColor: nothing.red },
  th3EpBtnText: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 13, fontWeight: "800", zIndex: 1 },
  th3EpBtnTextActive: { color: nothing.black, fontWeight: "900" },
  th3EpBtnFiller: { color: nothing.muted },
  resumeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.7)" },
  resumeBtnText: { color: nothing.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  lockedRow: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
  errorBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  errorAction: { paddingHorizontal: 12, paddingTop: 10 },
  errorCard: { gap: 6, padding: 12 },
  errorCopy: { color: nothing.muted, fontSize: 12, lineHeight: 16 },
  scroll: { padding: 14, gap: 12 },
  episodeLoading: { minHeight: 72, alignItems: "center", justifyContent: "center", gap: 7, borderTopWidth: 1, borderTopColor: nothing.line },
  episodeLoadingText: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  episodePager: { flexDirection: "row", alignItems: "center", gap: 6 },
  episodePagerButton: { flex: 1, minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  episodePagerDisabled: { opacity: 0.3 },
  episodePagerText: { color: nothing.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  episodePagerIndicator: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  emptyEpisodeText: { color: nothing.muted, paddingVertical: 14, textAlign: "center", fontSize: 12 },
  swipeHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 2 },
  swipeHintText: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  episodeSwipeContainer: { overflow: "hidden" },
  watchCommunitySection: { gap: 10, paddingTop: 2 },
  ratingRow: { gap: 5, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: nothing.line },
  ratingPrompt: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 9, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  ratingChoices: { flexDirection: "row", gap: 3 },
  ratingChoice: { flex: 1, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 3 },
  ratingChoiceActive: { backgroundColor: nothing.red, borderColor: nothing.red },
  ratingChoiceText: { color: "rgba(255,255,255,0.4)", fontFamily: nothing.mono, fontSize: 9, fontWeight: "900" },
  ratingChoiceTextActive: { color: "#FFFFFF" },
  languageRow: { flexDirection: "row", gap: 4 },
  language: { minWidth: 48, minHeight: 28, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "transparent" },
  languageActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.06)" },
  languageDisabled: { opacity: 0.3 },
  languageText: { color: "rgba(255,255,255,0.5)", fontFamily: nothing.mono, fontSize: 9, fontWeight: "900", letterSpacing: 0.2 },
  languageTextActive: { color: nothing.red },
  providerDiscovery: { width: "100%", maxWidth: 260, alignItems: "center", gap: 10 },
  providerDiscoveryCopy: { alignItems: "center", gap: 3 },
  providerDiscoveryTitle: { color: nothing.white, fontFamily: nothing.mono, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  providerDiscoveryDetail: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
});

// Memoized: the watch screen re-renders every second (progress clock), and
// re-diffing 50+ episode buttons per tick was the largest avoidable cost.
// Track 5.2: FlatList virtualization when total episodes > 100 (e.g. One Piece).
const EpisodeGrid = memo(function EpisodeGrid({ episodes, activeEpisode, totalPages, page, onPageChange, onSelect, onInfo, totalEpisodeCount = 0 }: { episodes: Episode[]; activeEpisode: number; totalPages: number; page: number; onPageChange: (update: (value: number) => number) => void; onSelect: (n: number) => void; onInfo: (n: number) => void; totalEpisodeCount?: number }) {
  // For shows with >100 total episodes, use a virtualized FlatList for the
  // grid to avoid diffing hundreds of buttons per tick. Small episode counts
  // keep the cheaper View.map path.
  if (totalEpisodeCount > 100) {
    return <>
      <FlatList
        data={episodes}
        keyExtractor={(item) => String(item.number)}
        numColumns={5}
        scrollEnabled={false}
        windowSize={3}
        maxToRenderPerBatch={8}
        removeClippedSubviews
        renderItem={({ item }) => {
          const active = item.number === activeEpisode;
          return <Pressable key={item.number} accessibilityRole="button" accessibilityLabel={`Episode ${item.number}${item.title ? `: ${item.title}` : ""}`} accessibilityHint={active ? "Currently playing" : "Double tap to play this episode"} onPress={() => onSelect(item.number)} onLongPress={() => onInfo(item.number)} style={[styles.th3EpBtn, active && styles.th3EpBtnActive]}>
            <Text style={[styles.th3EpBtnText, active ? styles.th3EpBtnTextActive : item.isFiller ? styles.th3EpBtnFiller : null]}>{item.number}</Text>
          </Pressable>;
        }}
      />
      {totalPages > 1 ? <View style={styles.episodePager}><Pressable disabled={page === 0} onPress={() => onPageChange((v) => Math.max(0, v - 1))} accessibilityRole="button" accessibilityLabel="Previous page" accessibilityHint="Shows the previous page of episodes" style={[styles.episodePagerButton, page === 0 && styles.episodePagerDisabled]}><AppIcon name="chevron-left" size={17} color={nothing.white} /><Text style={styles.episodePagerText}>PREV</Text></Pressable><Text style={styles.episodePagerIndicator}>{page + 1} / {totalPages}</Text><Pressable disabled={page >= totalPages - 1} onPress={() => onPageChange((v) => Math.min(totalPages - 1, v + 1))} accessibilityRole="button" accessibilityLabel="Next page" accessibilityHint="Shows the next page of episodes" style={[styles.episodePagerButton, page >= totalPages - 1 && styles.episodePagerDisabled]}><Text style={styles.episodePagerText}>NEXT</Text><AppIcon name="chevron-right" size={17} color={nothing.white} /></Pressable></View> : null}
    </>;
  }
  return <>
    <View style={styles.th3Grid}>{episodes.map((item) => { const active = item.number === activeEpisode; return <Pressable key={item.number} accessibilityRole="button" accessibilityLabel={`Episode ${item.number}${item.title ? `: ${item.title}` : ""}`} accessibilityHint={active ? "Currently playing" : "Double tap to play this episode"} onPress={() => onSelect(item.number)} onLongPress={() => onInfo(item.number)} style={[styles.th3EpBtn, active && styles.th3EpBtnActive]}>
      <Text style={[styles.th3EpBtnText, active ? styles.th3EpBtnTextActive : item.isFiller ? styles.th3EpBtnFiller : null]}>{item.number}</Text>
    </Pressable>; })}</View>
    {totalPages > 1 ? <View style={styles.episodePager}><Pressable disabled={page === 0} onPress={() => onPageChange((v) => Math.max(0, v - 1))} accessibilityRole="button" accessibilityLabel="Previous page" accessibilityHint="Shows the previous page of episodes" style={[styles.episodePagerButton, page === 0 && styles.episodePagerDisabled]}><AppIcon name="chevron-left" size={17} color={nothing.white} /><Text style={styles.episodePagerText}>PREV</Text></Pressable><Text style={styles.episodePagerIndicator}>{page + 1} / {totalPages}</Text><Pressable disabled={page >= totalPages - 1} onPress={() => onPageChange((v) => Math.min(totalPages - 1, v + 1))} accessibilityRole="button" accessibilityLabel="Next page" accessibilityHint="Shows the next page of episodes" style={[styles.episodePagerButton, page >= totalPages - 1 && styles.episodePagerDisabled]}><Text style={styles.episodePagerText}>NEXT</Text><AppIcon name="chevron-right" size={17} color={nothing.white} /></Pressable></View> : null}
  </>;
});

function ProviderDiscoveryLoader({ attempt }: { attempt: number }) {
  return <View style={styles.providerDiscovery}>
    <ActivityIndicator size="small" color={nothing.red} />
    <View style={styles.providerDiscoveryCopy}>
      <Text style={styles.providerDiscoveryTitle}>FINDING PROVIDERS</Text>
      <Text style={styles.providerDiscoveryDetail}>CHECKING SERVERS</Text>
    </View>
  </View>;
}
