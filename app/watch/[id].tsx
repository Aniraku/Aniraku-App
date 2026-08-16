import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, BackHandler, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView, type SubtitleTrack, type VideoSource } from "expo-video";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { anirakuProxyUrl, getAnimeMetadata, getEpisodes, getServers, getStream, getPlaybackType, nativePlaybackHeaders } from "@/lib/aniraku-api";
import { getAnimeById, getMalIdByAnimeId } from "@/lib/anilist";
import {
  activeSkipKind,
  directSources,
  embedSources,
  hasConfirmedPlaybackStart,
  isAutoQuality,
  mergeSkipSegments,
  nextProviderIndex,
  providerSkipSegments,
  shouldRetryProxiedSourceAfterDirect,
  shouldMountReplacementSource,
  shouldRestoreRebufferPosition,
  type Language,
  type SkipKind,
  type SkipSegments,
} from "@/lib/watch-engine";
import { animeTitle, type Episode, type Server, type StreamResponse, type StreamSource } from "@/lib/types";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useEpisodeRatings } from "@/hooks/use-episode-ratings";
import { useComments } from "@/hooks/use-comments";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { AppIcon } from "@/components/app-icon";
import { EmbedPlayer } from "@/components/embed-player";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

const RESUME_MIN_TIME = 30;
const STREAM_CACHE_TTL_MS = 30_000;
const SERVER_RETRY_DELAY_MS = 1_500;
const STARTUP_WATCHDOG_MS = 6_000;
const SKIP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

function normalizeAniSkip(payload: unknown): SkipSegments {
  const results = Array.isArray((payload as { results?: unknown[] })?.results)
    ? (payload as { results: Array<Record<string, unknown>> }).results
    : [];
  const segments: SkipSegments = { intro: null, outro: null };
  for (const item of results) {
    const rawType = String(item.skipType || "").toLowerCase();
    const kind: SkipKind | null = rawType === "op" || rawType === "mixed_op"
      ? "intro"
      : rawType === "ed" || rawType === "mixed_ed" ? "outro" : null;
    const interval = item.interval as Record<string, unknown> | undefined;
    const startTime = Number(interval?.startTime ?? item.startTime ?? item.start);
    const endTime = Number(interval?.endTime ?? item.endTime ?? item.end);
    if (!kind || segments[kind] || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime + 1) continue;
    segments[kind] = { startTime, endTime, source: "aniskip" };
  }
  return segments;
}

export default function WatchScreen() {
  const params = useLocalSearchParams<{ id: string; episode?: string; title?: string; image?: string }>();
  const animeId = Number(params.id);
  const episode = Math.max(1, Number(params.episode ?? "1"));
  const animeQuery = useQuery({
    queryKey: ["watch-anime", animeId],
    queryFn: async () => {
      try {
        return await getAnimeMetadata(animeId);
      } catch {
        // Preserve the main site’s AniList recovery path without making the
        // rate-limited public GraphQL service the default Watch dependency.
        return getAnimeById(animeId);
      }
    },
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
  const comments = useComments(animeId);
  const [watchComment, setWatchComment] = useState("");
  const episodeQuery = useQuery({ queryKey: ["watch-episodes", animeId], queryFn: () => getEpisodes(animeId), enabled: Number.isFinite(animeId) && animeId > 0, staleTime: 60_000 });
  const canonicalEpisodes = episodeQuery.data ?? [];
  const episodeIsKnown = canonicalEpisodes.some((item) => item.number === episode);
  const invalidEpisode = Boolean(episodeQuery.isSuccess && canonicalEpisodes.length && !episodeIsKnown);
  useKeepAwake("aniraku-watch");

  const player = useVideoPlayer(null, (instance) => {
    // React quickly to a native rebuffer position discontinuity before the
    // replayed keyframe becomes visible for a noticeable duration.
    instance.timeUpdateEventInterval = 0.1;
    instance.staysActiveInBackground = false;
    instance.preservesPitch = true;
    instance.showNowPlayingNotification = true;
    instance.volume = 1;
    instance.audioMixingMode = "doNotMix";
    instance.bufferOptions = {
      maxBufferBytes: 0,
      // Start promptly, then keep roughly forty-five seconds ahead of playback in
      // the native media buffer so short network slowdowns do not interrupt a
      // scene. `maxBufferBytes: 0` lets Media3 size that buffer safely per device.
      minBufferForPlayback: 2,
      preferredForwardBufferDuration: 45,
      prioritizeTimeOverSizeThreshold: true,
      waitsToMinimizeStalling: true,
    };
  });

  const statusEvent = useEvent(player, "statusChange", { status: player.status });
  const timeEvent = useEvent(player, "timeUpdate", { currentTime: 0, bufferedPosition: 0, currentLiveTimestamp: null, currentOffsetFromLive: null });
  const subtitleEvent = useEvent(player, "availableSubtitleTracksChange", { availableSubtitleTracks: player.availableSubtitleTracks });
  const playingEvent = useEvent(player, "playingChange", { isPlaying: player.playing });
  const status = statusEvent?.status;
  const currentTime = timeEvent?.currentTime ?? 0;
  const duration = player.duration || 0;
  const isPlaying = playingEvent?.isPlaying ?? false;

  const [language, setLanguage] = useState<Language>("sub");
  const [providers, setProviders] = useState<Record<Language, Server[]>>({ sub: [], dub: [] });
  const [serverIndex, setServerIndex] = useState(0);
  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [source, setSource] = useState<StreamSource | null>(null);
  const [useSourceProxy, setUseSourceProxy] = useState(false);
  const [embedSource, setEmbedSource] = useState<StreamSource | null>(null);
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
  const [showConsole, setShowConsole] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [manualFullscreen, setManualFullscreen] = useState(false);
  const [showEpisodeSidebar, setShowEpisodeSidebar] = useState(true);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [controlsVisible, setControlsVisible] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [skipSegments, setSkipSegments] = useState<SkipSegments>({ intro: null, outro: null });
  const [skipLookup, setSkipLookup] = useState<"checking" | "available" | "unavailable">("checking");
  const [resumePosition, setResumePosition] = useState<number | null>(null);

  useEffect(() => () => {
    if (Platform.OS !== "web") void ScreenOrientation.unlockAsync().catch(() => {});
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
  const autoSkipped = useRef<Record<SkipKind, boolean>>({ intro: false, outro: false });
  const skipSegmentsRef = useRef(skipSegments);
  const pendingResume = useRef<number | null>(null);
  const activeProviderId = useRef<string | null>(null);
  const lastStablePlaybackTime = useRef(0);
  const rebufferSeen = useRef(false);
  const intentionalSeekUntil = useRef(0);

  const activeProviders = providers[language] ?? [];
  const activeProvider = activeProviders[serverIndex];
  const filteredEpisodes = useMemo(() => {
    const term = episodeSearch.trim().toLowerCase();
    if (!term) return canonicalEpisodes;
    return canonicalEpisodes.filter((item) => String(item.number).includes(term) || String(item.title || "").toLowerCase().includes(term));
  }, [canonicalEpisodes, episodeSearch]);
  const qualityOptions = useMemo(() => directSources(stream ?? { sources: [] }), [stream]);
  const currentRating = ratings.scoreFor(episode) ?? 0;
  const episodeComments = useMemo(() => (comments.comments.data ?? []).filter((item) => item.episode_number === episode), [comments.comments.data, episode]);
  const subtitleTracks = subtitleEvent?.availableSubtitleTracks ?? player.availableSubtitleTracks ?? [];
  const skipKind = activeSkipKind(skipSegments, currentTime);
  const buffering = loadingStream || status === "loading";

  // A new source has its own timeline. Never carry the prior episode/provider
  // position into a deliberate quality, language, or source replacement.
  useEffect(() => {
    lastStablePlaybackTime.current = 0;
    rebufferSeen.current = false;
    intentionalSeekUntil.current = 0;
  }, [source?.url, sourceRevision]);

  useEffect(() => {
    const reportedTime = currentTime;
    const intentionalSeek = Date.now() < intentionalSeekUntil.current;
    if (buffering) rebufferSeen.current = true;

    if (shouldRestoreRebufferPosition({
      lastStableTime: lastStablePlaybackTime.current,
      reportedTime,
      wasBuffering: rebufferSeen.current,
      playbackStarted: sourceStarted.current,
      intentionalSeek,
    })) {
      // This is an active native correction, not merely a timeline display
      // clamp: Media3 is returned to the position it had reached before the
      // short post-buffer rollback.
      player.currentTime = lastStablePlaybackTime.current;
      return;
    }

    if (intentionalSeek || reportedTime >= lastStablePlaybackTime.current - 0.05) {
      lastStablePlaybackTime.current = reportedTime;
      if (!buffering) rebufferSeen.current = false;
    }
  }, [buffering, currentTime, player]);

  useEffect(() => { skipSegmentsRef.current = skipSegments; }, [skipSegments]);

  const applySkipSegments = useCallback((incoming: SkipSegments) => {
    setSkipSegments((current) => mergeSkipSegments(current, incoming));
  }, []);

  const clearEpisodePlayback = useCallback(() => {
    player.pause();
    setStream(null);
    setSource(null);
    setUseSourceProxy(false);
    setEmbedSource(null);
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
  }, [player]);

  const handleProviderBlocked = useCallback((reason: "player" | "permanent" | "stream" | "startup" = "player") => {
    const current = activeProviders[serverIndex];
    if (!current) return;
    const fallbackEmbed = embedSources(stream ?? { sources: current.sources ?? [] })[0];
    // A provider has already had proxy and direct-native delivery attempts.
    // For a silent 0:00 startup stall, the verified embed is the fastest
    // device-compatible escape; the persistent picker still exposes every
    // language and provider if the user wants another source.
    if ((reason === "player" || reason === "startup") && fallbackEmbed && !embedSource) {
      player.pause();
      sourceStarted.current = false;
      sourceFirstFrame.current = false;
      sourceFailureHandled.current = null;
      setSource(null);
      setEmbedSource(fallbackEmbed);
      setControlsVisible(true);
      setShowSourcePicker(false);
      setLoadingStream(false);
      return;
    }
    if (reason !== "permanent" && !refreshAttempted.current.has(current.id)) {
      // Watch.jsx refreshes this exact provider once before classifying it as blocked.
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
    blockedProviders.current.add(current.id);
    const next = nextProviderIndex(activeProviders, serverIndex, blockedProviders.current, true);
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
  }, [activeProviders, embedSource, player, serverIndex, stream]);

  // Stream refreshes update `stream` for metadata and embed fallback only. Keep
  // the source lifecycle callback stable so that update cannot recreate the
  // current video effect, reset its watchdog, and strand Android at 0:00.
  const handleProviderBlockedRef = useRef(handleProviderBlocked);
  useEffect(() => {
    handleProviderBlockedRef.current = handleProviderBlocked;
  }, [handleProviderBlocked]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem("aniraku.watch.preferences")
      .then((stored) => {
        if (!active || !stored) return;
        const preferences = JSON.parse(stored) as WatchPreferences;
        if (typeof preferences.autoNext === "boolean") setAutoNext(preferences.autoNext);
        if (typeof preferences.autoSkip === "boolean") setAutoSkip(preferences.autoSkip);
        if (typeof preferences.speed === "number" && [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(preferences.speed)) setSpeed(preferences.speed);
      })
      .catch(() => {})
      .finally(() => { if (active) setPreferencesReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    void AsyncStorage.setItem("aniraku.watch.preferences", JSON.stringify({ autoNext, autoSkip, speed })).catch(() => {});
  }, [autoNext, autoSkip, preferencesReady, speed]);

  // Exact Watch.jsx ordering: resolve canonical episodes first, then start
  // both language requests and commit SUB as soon as it arrives.
  useEffect(() => {
    let cancelled = false;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    clearEpisodePlayback();
    setProviders({ sub: [], dub: [] });
    setLanguage("sub");
    setServerIndex(0);
    setLoadingServers(true);
    setServerAttempt(0);
    setLoadingStream(false);
    setError(null);

    if (episodeQuery.isPending) return;
    if (invalidEpisode) {
      setLoadingServers(false);
      setError(`Episode ${episode} is not available for this Aniraku title. Choose one of the ${canonicalEpisodes.length} listed episodes.`);
      return;
    }

    const fetchServers = async () => {
      setServerAttempt(retries + 1);
      const subTask = getServers(animeId, episode, "sub").catch(() => [] as Server[]);
      const dubTask = getServers(animeId, episode, "dub").catch(() => [] as Server[]);
      const subs = await subTask;
      if (cancelled) return;
      const usableSub = subs.filter((provider) => directSources({ sources: provider.sources ?? [] }).length || embedSources({ sources: provider.sources ?? [] }).length);
      setProviders({ sub: usableSub, dub: [] });
      if (usableSub.length) setLoadingServers(false);

      const dubs = await dubTask;
      if (cancelled) return;
      const usableDub = dubs.filter((provider) => directSources({ sources: provider.sources ?? [] }).length || embedSources({ sources: provider.sources ?? [] }).length);
      setProviders({ sub: usableSub, dub: usableDub });
      if (usableSub.length || usableDub.length) {
        setLoadingServers(false);
        if (!usableSub.length && usableDub.length) setLanguage("dub");
      } else if (retries >= 2) {
        setLoadingServers(false);
        setError("We don't have streaming for this episode.");
      }
      if ((usableSub.length === 0 || usableDub.length === 0) && retries < 2) {
        retries += 1;
        retryTimer = setTimeout(() => { void fetchServers(); }, SERVER_RETRY_DELAY_MS);
      }
    };
    void fetchServers();
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [animeId, canonicalEpisodes.length, clearEpisodePlayback, episode, episodeQuery.isPending, invalidEpisode]);

  // The source of truth from Watch.jsx: play the source already present in the
  // server response immediately; fetch /stream only to refresh metadata and
  // never tear down a source that has started successfully.
  useEffect(() => {
    if (!activeProvider) return;
    let cancelled = false;
    const providerId = activeProvider.id;
    activeProviderId.current = providerId;
    const initial: StreamResponse = { sources: activeProvider.sources ?? [], headers: activeProvider.headers };
    const initialDirect = directSources(initial);
    const initialEmbeds = embedSources(initial);
    const existingSourceMounted = sourceMounted.current;
    const forceThisRequest = forceRefresh.current;
    forceRefresh.current = false;
    const hasInitial = initialDirect.length > 0 || initialEmbeds.length > 0;

    setError(null);
    if (hasInitial && !existingSourceMounted && !forceThisRequest) {
      setStream(initial);
      setPlaybackHeaders(activeProvider.headers);
      if (initialDirect.length) {
        sourceMounted.current = true;
        setEmbedSource(null);
        setSource(initialDirect[0]);
        setUseSourceProxy(false);
        setSourceRevision((value) => value + 1);
      } else {
        sourceMounted.current = true;
        setSource(null);
        setEmbedSource(initialEmbeds[0]);
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
      const cachedEmbeds = embedSources(cached.data);
      if (!sourceMounted.current && (cachedDirect.length || cachedEmbeds.length)) {
        setStream(cached.data);
        setPlaybackHeaders(cached.data.headers ?? activeProvider.headers);
        if (cachedDirect.length) {
          sourceMounted.current = true;
          setSource(cachedDirect[0]);
          setEmbedSource(null);
          setUseSourceProxy(false);
          setSourceRevision((value) => value + 1);
        } else {
          sourceMounted.current = true;
          setSource(null);
          setEmbedSource(cachedEmbeds[0]);
        }
        applySkipSegments(providerSkipSegments(cached.data));
        setLoadingStream(false);
      }
    }

    void getStream({ animeId, episode, provider: activeProvider.provider, lang: language, refresh: forceThisRequest })
      .then((response) => {
        if (cancelled || activeProviderId.current !== providerId) return;
        const refreshedDirect = directSources(response);
        const refreshedEmbeds = embedSources(response);
        if (!refreshedDirect.length && !refreshedEmbeds.length) {
          if (!hasInitial || forceThisRequest) handleProviderBlockedRef.current("stream");
          return;
        }
        streamCache.current.set(cacheKey, { savedAt: Date.now(), data: response });
        setStream(response);
        applySkipSegments(providerSkipSegments(response));
        if (shouldMountReplacementSource(sourceMounted.current, forceThisRequest) && refreshedDirect.length) {
          sourceMounted.current = true;
          setPlaybackHeaders(response.headers ?? activeProvider.headers);
          setSource(refreshedDirect[0]);
          setEmbedSource(null);
          setUseSourceProxy(false);
          setSourceRevision((value) => value + 1);
        } else if (shouldMountReplacementSource(sourceMounted.current, forceThisRequest) && refreshedEmbeds.length) {
          sourceMounted.current = true;
          setPlaybackHeaders(response.headers ?? activeProvider.headers);
          setSource(null);
          setEmbedSource(refreshedEmbeds[0]);
        }
        setLoadingStream(false);
      })
      .catch(() => {
        if (cancelled || activeProviderId.current !== providerId) return;
        // A background refresh must never interrupt a playable initial source.
        if (!hasInitial || forceThisRequest) handleProviderBlockedRef.current("stream");
      });
    return () => { cancelled = true; };
  }, [activeProvider, animeId, applySkipSegments, episode, language, refreshNonce]);

  useEffect(() => {
    if (!source) return;
    sourceFailureHandled.current = null;
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    const attempt = ++sourceAttempt.current;
    const playbackType = getPlaybackType(source);
    const contentType = playbackType === "hls" ? "hls" : playbackType === "dash" ? "dash" : undefined;
    const directHeaders = nativePlaybackHeaders(playbackHeaders);
    const videoSource: VideoSource = {
      uri: useSourceProxy ? anirakuProxyUrl(source.url, directHeaders) : source.url,
      headers: useSourceProxy ? undefined : directHeaders,
      contentType,
      metadata: { title: `${title} · Episode ${episode}`, artwork: image || undefined },
      useCaching: playbackType === "native",
    };
    void player.replaceAsync(videoSource).then(() => player.play()).catch(() => {
      if (!useSourceProxy) {
        setUseSourceProxy(true);
        setSourceRevision((value) => value + 1);
        return;
      }
      handleProviderBlockedRef.current("player");
    });
    const watchdog = setTimeout(() => {
      if (sourceAttempt.current !== attempt || sourceStarted.current) return;
      if (shouldRetryProxiedSourceAfterDirect(useSourceProxy, sourceStarted.current)) {
        setUseSourceProxy(true);
        setSourceRevision((value) => value + 1);
        return;
      }
      handleProviderBlockedRef.current("startup");
    }, STARTUP_WATCHDOG_MS);
    return () => clearTimeout(watchdog);
  }, [player, source?.url, sourceRevision, useSourceProxy]);

  useEffect(() => { player.playbackRate = speed; }, [player, speed]);

  useEffect(() => {
    if (hasConfirmedPlaybackStart({ isPlaying, currentTime, firstFrameRendered: sourceFirstFrame.current })) sourceStarted.current = true;
    if ((isPlaying || status === "readyToPlay") && pendingResume.current && pendingResume.current > RESUME_MIN_TIME) {
      player.currentTime = pendingResume.current;
      pendingResume.current = null;
      setResumePosition(null);
    }
  }, [currentTime, isPlaying, player, status]);

  useEffect(() => {
    if (status !== "error" || !source?.url || sourceFailureHandled.current === source.url) return;
    if (!useSourceProxy) {
      setUseSourceProxy(true);
      setSourceRevision((value) => value + 1);
      return;
    }
    sourceFailureHandled.current = source.url;
    handleProviderBlockedRef.current("player");
  }, [source?.url, status, useSourceProxy]);

  // Watch.jsx sources provider timestamps first and enriches missing coverage
  // from AniSkip via the AniList MAL mapping.  A 404 is cached as a normal
  // no-data response rather than shown as a playback error.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setSkipLookup(skipSegments.intro || skipSegments.outro ? "available" : "checking");
    const resolveMalId = async () => {
      const cacheKey = `aniraku-watch-mal:${animeId}`;
      const stored = await AsyncStorage.getItem(cacheKey).catch(() => null);
      const cached = Number(stored);
      if (Number.isFinite(cached) && cached > 0) return cached;
      // AniList can rate-limit public requests. Retry this auxiliary lookup in
      // the background; it must never delay server discovery or video startup.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const resolved = await getMalIdByAnimeId(animeId);
          if (resolved) {
            void AsyncStorage.setItem(cacheKey, String(resolved)).catch(() => {});
            return resolved;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
      }
      return null;
    };
    void resolveMalId()
      .then(async (malId) => {
        if (!malId || cancelled) { if (!cancelled) setSkipLookup(skipSegmentsRef.current.intro || skipSegmentsRef.current.outro ? "available" : "unavailable"); return; }
        const key = skipCacheKey(malId, episode);
        const stored = await AsyncStorage.getItem(key).catch(() => null);
        if (stored) {
          const cached = JSON.parse(stored) as { savedAt?: number; segments?: SkipSegments };
          if (cached.savedAt && Date.now() - cached.savedAt < SKIP_CACHE_TTL_MS && cached.segments) {
            if (!cancelled) { applySkipSegments(cached.segments); setSkipLookup(cached.segments.intro || cached.segments.outro ? "available" : "unavailable"); }
            return;
          }
        }
        const response = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types%5B%5D=op&types%5B%5D=ed&episodeLength=0`, { headers: { Accept: "application/json" }, signal: controller.signal });
        if (!response.ok) { if (!cancelled) setSkipLookup(skipSegmentsRef.current.intro || skipSegmentsRef.current.outro ? "available" : "unavailable"); return; }
        const segments = normalizeAniSkip(await response.json());
        if (cancelled) return;
        applySkipSegments(segments);
        setSkipLookup(segments.intro || segments.outro || skipSegmentsRef.current.intro || skipSegmentsRef.current.outro ? "available" : "unavailable");
        void AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), segments })).catch(() => {});
      })
      .catch(() => { if (!cancelled) setSkipLookup(skipSegmentsRef.current.intro || skipSegmentsRef.current.outro ? "available" : "unavailable"); });
    return () => { cancelled = true; controller.abort(); };
  }, [animeId, applySkipSegments, episode]);

  useEffect(() => {
    setResumePosition(null);
    pendingResume.current = null;
    const entry = history.history.data?.find((item) => item.anime_id === animeId && item.episode_number === episode);
    if (entry && entry.progress > RESUME_MIN_TIME && entry.duration && entry.progress < entry.duration - 10) {
      pendingResume.current = entry.progress;
      setResumePosition(entry.progress);
    }
  }, [animeId, episode, history.history.data]);

  useEffect(() => {
    if (!auth.user || !source || currentTime < 1 || duration <= 0 || currentTime - lastHistorySync.current < 10) return;
    lastHistorySync.current = currentTime;
    history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, progress: currentTime, duration });
  }, [animeId, auth.user, currentTime, duration, episode, history.save, image, source, title]);

  useEffect(() => {
    if (!autoSkip || !skipKind) return;
    const interval = skipSegments[skipKind];
    if (!interval || autoSkipped.current[skipKind]) return;
    autoSkipped.current[skipKind] = true;
    player.currentTime = interval.endTime;
  }, [autoSkip, player, skipKind, skipSegments]);

  useEffect(() => {
    const subscription = player.addListener("playToEnd", () => {
      // Source replacement, a failed CDN response, or an empty first frame can
      // emit a native end event. Only the genuine end of a started episode may
      // trigger the main Watch.jsx auto-next behavior.
      const reachedEpisodeEnd = duration > 30 && currentTime >= Math.max(1, duration - 2);
      if (!sourceStarted.current || !reachedEpisodeEnd) return;
      if (auth.user) history.save.mutate({ animeId, animeTitle: title, animeImage: image || null, episode, progress: duration || currentTime, duration: duration || currentTime });
      const followingEpisode = canonicalEpisodes.find((item) => item.number > episode)?.number;
      if (autoNext && followingEpisode) router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(followingEpisode), title, image } } as never);
    });
    return () => subscription.remove();
  }, [animeId, auth.user, autoNext, canonicalEpisodes, currentTime, duration, episode, history.save, image, player, title]);

  const selectLanguage = (next: Language) => {
    if (!providers[next].length || next === language) return;
    // A language change is a new playback transaction. Clearing every source
    // state guarantees DUB mounts and starts immediately instead of waiting for
    // the user to tap another provider.
    player.pause();
    blockedProviders.current.clear();
    refreshAttempted.current.clear();
    sourceStarted.current = false;
    sourceFirstFrame.current = false;
    sourceMounted.current = false;
    sourceFailureHandled.current = null;
    activeProviderId.current = null;
    setStream(null);
    setSource(null);
    setEmbedSource(null);
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
    player.pause();
    setSource(null);
    setEmbedSource(null);
    setUseSourceProxy(false);
    setLoadingStream(true);
    setShowSourcePicker(false);
    setShowConsole(false);
    if (index === serverIndex) {
      forceRefresh.current = true;
      setRefreshNonce((value) => value + 1);
    } else {
      setServerIndex(index);
    }
    setError(null);
  };
  const selectQuality = (next: StreamSource) => {
    sourceMounted.current = true;
    setEmbedSource(null);
    setSource(next);
    setUseSourceProxy(false);
    setPlaybackHeaders(stream?.headers ?? activeProvider?.headers);
    setSourceRevision((value) => value + 1);
    setShowQualityPicker(false);
  };
  const markIntentionalSeek = (target?: number) => {
    intentionalSeekUntil.current = Date.now() + 1_500;
    if (typeof target === "number" && Number.isFinite(target)) lastStablePlaybackTime.current = target;
  };
  const seek = (seconds: number) => {
    markIntentionalSeek(Math.max(0, currentTime + seconds));
    player.seekBy(seconds);
  };
  const skip = (kind: SkipKind) => {
    const target = skipSegments[kind]?.endTime;
    if (target) {
      markIntentionalSeek(target);
      player.currentTime = target;
    }
  };
  const retry = () => {
    if (!activeProvider) return;
    blockedProviders.current.delete(activeProvider.id);
    refreshAttempted.current.delete(activeProvider.id);
    forceRefresh.current = true;
    setError(null);
    setRefreshNonce((value) => value + 1);
  };
  const goToEpisode = (targetEpisode: number) => {
    if (!canonicalEpisodes.some((item) => item.number === targetEpisode)) return;
    router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(targetEpisode), title, image } } as never);
  };
  const nextKnownEpisode = canonicalEpisodes.find((item) => item.number > episode)?.number;
  const previousKnownEpisode = [...canonicalEpisodes].reverse().find((item) => item.number < episode)?.number;
  const nextEpisode = () => { if (nextKnownEpisode) goToEpisode(nextKnownEpisode); };
  const seekFromBar = (event: { nativeEvent: { locationX: number } }) => {
    if (duration > 0 && progressWidth > 0) {
      const target = Math.max(0, Math.min(duration, (event.nativeEvent.locationX / progressWidth) * duration));
      markIntentionalSeek(target);
      player.currentTime = target;
    }
  };
  const selectSubtitle = (track: SubtitleTrack | null) => { player.subtitleTrack = track; };
  const enterFullscreen = () => {
    setShowConsole(false);
    setManualFullscreen(true);
    if (Platform.OS !== "web") void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  };
  const exitFullscreen = () => {
    setManualFullscreen(false);
    if (Platform.OS !== "web") void ScreenOrientation.unlockAsync().catch(() => {});
  };
  const togglePlayerSettings = () => {
    setControlsVisible(true);
    setShowSourcePicker(false);
    setShowQualityPicker(false);
    setShowConsole((value) => !value);
  };
  const toggleSourcePicker = () => {
    setControlsVisible(true);
    setShowConsole(false);
    setShowQualityPicker(false);
    setShowSourcePicker((value) => !value);
  };
  const toggleQualityPicker = () => {
    setControlsVisible(true);
    setShowConsole(false);
    setShowSourcePicker(false);
    setShowQualityPicker((value) => !value);
  };
  useEffect(() => {
    if (!manualFullscreen || Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      exitFullscreen();
      return true;
    });
    return () => subscription.remove();
  }, [manualFullscreen]);
  useEffect(() => {
    if (!source || !controlsVisible || showConsole || showSourcePicker || showQualityPicker) return;
    const timer = setTimeout(() => setControlsVisible(false), 2_500);
    return () => clearTimeout(timer);
  }, [controlsVisible, showConsole, showSourcePicker, showQualityPicker, source?.url]);
  const onProgressLayout = (event: LayoutChangeEvent) => setProgressWidth(event.nativeEvent.layout.width);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const buffered = duration > 0 && timeEvent?.bufferedPosition > 0 ? Math.min(100, (timeEvent.bufferedPosition / duration) * 100) : 0;

  return <NativeScreen scroll={false} style={styles.fill}>
    <StatusBar hidden={manualFullscreen} />
    {watchBackdrop ? <View pointerEvents="none" style={watchPageStyles.watchBackdrop}><Image source={{ uri: watchBackdrop }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={watchPageStyles.watchBackdropMask} /></View> : null}
    {!manualFullscreen ? <View style={styles.top}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close player" onPress={() => router.back()} style={styles.closeButton}><AppIcon name="chevron-left" size={22} color={nothing.white} /></Pressable>
      <View style={styles.topCopy}><Text style={styles.title} numberOfLines={1}>{title}</Text><Text style={styles.episodeLabel}>EPISODE {String(episode).padStart(2, "0")}</Text></View>
    </View> : null}
    <View style={[styles.videoShell, manualFullscreen && playerStyles.videoShellFullscreen]}>
      {source ? <VideoView style={styles.video} player={player} nativeControls={false} allowsFullscreen allowsPictureInPicture contentFit="contain" surfaceType="textureView" useExoShutter={false} onFirstFrameRender={() => { sourceFirstFrame.current = true; sourceStarted.current = true; }} />
        : embedSource ? <EmbedPlayer uri={embedSource.url} headers={nativePlaybackHeaders(playbackHeaders)} onError={() => handleProviderBlocked("permanent")} />
          : <View style={styles.videoPlaceholder}>{loadingServers || loadingStream ? <><ActivityIndicator color={nothing.white} /><Text style={styles.placeholderText}>{loadingServers ? `WAITING FOR EPISODE ${episode} SOURCE · CHECK ${Math.max(1, serverAttempt)} OF 3` : "STARTING VIDEO"}</Text></> : error ? <Text style={styles.errorText}>{error}</Text> : <Text style={styles.placeholderText}>PREPARING VIDEO</Text>}</View>}
      {embedSource ? <Pressable accessibilityRole="button" accessibilityLabel="Open audio language and provider selector" accessibilityState={{ expanded: showSourcePicker }} onPress={toggleSourcePicker} style={playerStyles.embedProviderButton}><AppIcon name="headphones" size={20} color={nothing.white} /><Text style={playerStyles.embedProviderButtonText}>AUDIO & PROVIDER</Text></Pressable> : null}
      {source && controlsVisible ? <View style={styles.playerOverlay} pointerEvents="box-none">
        <View style={styles.overlayTop}><View style={styles.sourcePill}><Signal label={buffering ? "BUFFERING" : `${language.toUpperCase()} · ${activeProvider?.label || "PLAYING"}`} tone={buffering ? "muted" : "live"} /></View><View style={watchPageStyles.overlayActions}>{qualityOptions.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Open video quality selector" accessibilityState={{ expanded: showQualityPicker }} onPress={toggleQualityPicker} style={[playerStyles.quickQualityButton, showQualityPicker && styles.overlayMenuActive]}><Text style={playerStyles.quickQualityButtonText}>{isAutoQuality(source) ? "AUTO" : source.quality || "HD"}</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Open audio language and provider selector" accessibilityState={{ expanded: showSourcePicker }} onPress={toggleSourcePicker} style={[styles.overlayMenu, showSourcePicker && styles.overlayMenuActive]}><AppIcon name="headphones" size={20} color={nothing.white} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={manualFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onPress={manualFullscreen ? exitFullscreen : enterFullscreen} style={styles.overlayMenu}><AppIcon name={manualFullscreen ? "fullscreen-exit" : "fullscreen"} size={20} color={nothing.white} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open player settings" accessibilityState={{ expanded: showConsole }} onPress={togglePlayerSettings} style={[styles.overlayMenu, showConsole && styles.overlayMenuActive]}><AppIcon name="tune-variant" size={20} color={nothing.white} /></Pressable></View></View>
        <View style={styles.centerControls}><Pressable accessibilityRole="button" accessibilityLabel="Seek backward ten seconds" onPress={() => seek(-10)} style={styles.seekControl}><AppIcon name="rewind-10" size={30} color={nothing.white} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause" : "Play"} onPress={() => { if (isPlaying) player.pause(); else player.play(); }} style={styles.heroPlay}>{buffering ? <ActivityIndicator color={nothing.black} /> : <AppIcon name={isPlaying ? "pause" : "play"} size={32} color={nothing.black} />}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="Seek forward ten seconds" onPress={() => seek(10)} style={styles.seekControl}><AppIcon name="fast-forward-10" size={30} color={nothing.white} /></Pressable></View>
        <View style={styles.overlayBottom}><View style={playerStyles.overlayContextActions}>{resumePosition ? <Pressable accessibilityRole="button" onPress={() => { pendingResume.current = resumePosition; player.currentTime = resumePosition; setResumePosition(null); }} style={styles.resumeInline}><AppIcon name="play" size={14} color={nothing.white} /><Text style={styles.resumeInlineText}>{`RESUME ${formatTime(resumePosition)}`}</Text></Pressable> : null}{skipKind ? <Pressable accessibilityRole="button" onPress={() => skip(skipKind)} style={styles.skipInline}><Text style={styles.skipInlineText}>{`SKIP ${skipKind.toUpperCase()}`}</Text></Pressable> : null}</View><View style={playerStyles.playerTimelineBlock}><Pressable accessibilityRole="adjustable" accessibilityLabel="Playback position" onLayout={onProgressLayout} onPress={seekFromBar} style={styles.timeline}><View style={[styles.timelineBuffered, { width: `${buffered}%` }]} /><View style={[styles.timelinePlayed, { width: `${progress}%` }]} /></Pressable><View style={styles.timeRow}><Text style={styles.timeText}>{formatTime(currentTime)}</Text><Text style={styles.timeMeta}>{buffering ? "BUFFERING" : isAutoQuality(source) ? "AUTO" : source.quality || "SOURCE"}</Text><Text style={styles.timeText}>{formatTime(duration)}</Text></View></View></View>
      </View> : null}
      {source && showQualityPicker ? <View style={playerStyles.quickQualityOverlay}><View style={playerStyles.quickQualityHeading}><DotLabel>QUALITY</DotLabel><Pressable accessibilityRole="button" accessibilityLabel="Close video quality selector" onPress={() => setShowQualityPicker(false)}><AppIcon name="close" size={18} color={nothing.muted} /></Pressable></View><Text style={playerStyles.quickQualityHint}>AVAILABLE RESOLUTION</Text><View style={playerStyles.quickQualityChoices}>{qualityOptions.map((item, index) => <Pressable key={`${item.url}:${index}`} accessibilityRole="button" accessibilityState={{ selected: source.url === item.url }} onPress={() => selectQuality(item)} style={[playerStyles.quickQualityChoice, source.url === item.url && playerStyles.quickQualityChoiceActive]}><Text style={[playerStyles.quickQualityChoiceText, source.url === item.url && playerStyles.quickQualityChoiceTextActive]}>{isAutoQuality(item) ? "AUTO · ADAPTIVE" : item.quality || "SOURCE"}</Text><Text style={[playerStyles.quickQualityChoiceState, source.url === item.url && playerStyles.quickQualityChoiceStateActive]}>{source.url === item.url ? "PLAYING" : "SELECT"}</Text></Pressable>)}</View></View> : null}
      {source && showConsole ? <View style={playerStyles.playerSettingsOverlay}><ScrollView contentContainerStyle={playerStyles.playerSettingsContent} showsVerticalScrollIndicator={false}><View style={watchPageStyles.playerMenuHeading}><DotLabel>PLAYER SETTINGS</DotLabel><Pressable accessibilityRole="button" accessibilityLabel="Close player settings" onPress={() => setShowConsole(false)}><AppIcon name="close" size={18} color={nothing.muted} /></Pressable></View>{qualityOptions.length ? <View style={watchPageStyles.menuSection}><DotLabel>QUALITY</DotLabel><View style={styles.qualityRow}>{qualityOptions.map((item, index) => <Pressable key={`${item.url}:${index}`} accessibilityRole="button" onPress={() => selectQuality(item)} style={[styles.quality, source?.url === item.url && styles.qualityActive]}><Text style={[styles.qualityText, source?.url === item.url && styles.qualityTextActive]}>{isAutoQuality(item) ? "AUTO · ADAPTIVE" : item.quality || "SOURCE"}</Text></Pressable>)}</View></View> : null}<View style={watchPageStyles.menuSection}><DotLabel>PLAYBACK</DotLabel><View style={styles.toggleRow}><Pressable accessibilityRole="switch" accessibilityState={{ checked: autoNext }} onPress={() => setAutoNext((value) => !value)} style={[styles.toggle, autoNext && styles.toggleOn]}><Text style={[styles.toggleText, autoNext && styles.toggleTextOn]}>AUTO NEXT {autoNext ? "ON" : "OFF"}</Text></Pressable><Pressable accessibilityRole="switch" accessibilityState={{ checked: autoSkip }} onPress={() => setAutoSkip((value) => !value)} style={[styles.toggle, autoSkip && styles.toggleOn]}><Text style={[styles.toggleText, autoSkip && styles.toggleTextOn]}>AUTO SKIP {autoSkip ? "ON" : "OFF"}</Text></Pressable></View><View style={styles.speedRow}>{[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => <Pressable key={value} accessibilityRole="button" onPress={() => setSpeed(value)} style={[styles.speed, speed === value && styles.speedActive]}><Text style={[styles.speedText, speed === value && styles.speedTextActive]}>{value}×</Text></Pressable>)}</View></View>{subtitleTracks.length ? <View style={watchPageStyles.menuSection}><DotLabel>SUBTITLES</DotLabel><View style={styles.qualityRow}><Pressable accessibilityRole="button" onPress={() => selectSubtitle(null)} style={[styles.quality, !player.subtitleTrack && styles.qualityActive]}><Text style={[styles.qualityText, !player.subtitleTrack && styles.qualityTextActive]}>OFF</Text></Pressable>{subtitleTracks.map((track) => <Pressable key={track.id} onPress={() => selectSubtitle(track)} style={[styles.quality, player.subtitleTrack?.id === track.id && styles.qualityActive]}><Text style={[styles.qualityText, player.subtitleTrack?.id === track.id && styles.qualityTextActive]}>{track.label || track.language}</Text></Pressable>)}</View></View> : null}</ScrollView></View> : null}
      {(source || embedSource) && showSourcePicker ? <View style={playerStyles.playerSourceOverlay}><View style={watchPageStyles.playerMenuHeading}><DotLabel>AUDIO & PROVIDER</DotLabel><Pressable accessibilityRole="button" accessibilityLabel="Close audio and provider selector" onPress={() => setShowSourcePicker(false)}><AppIcon name="close" size={18} color={nothing.muted} /></Pressable></View><View style={styles.languageRow}>{(["sub", "dub"] as Language[]).map((item) => <Pressable key={item} accessibilityRole="button" onPress={() => selectLanguage(item)} disabled={!providers[item].length} style={[styles.language, language === item && styles.languageActive, !providers[item].length && styles.languageDisabled]}><Text style={[styles.languageText, language === item && styles.languageTextActive]}>{item === "sub" ? `SUB · ${providers.sub.length}` : `DUB · ${providers.dub.length}`}</Text></Pressable>)}</View><View style={playerStyles.inPlayerProviderList}>{activeProviders.map((provider, index) => <Pressable key={provider.id} accessibilityRole="button" onPress={() => selectServer(index)} style={[playerStyles.inPlayerProvider, index === serverIndex && playerStyles.inPlayerProviderActive]}><View style={playerStyles.inPlayerProviderName}><View style={[playerStyles.providerSignal, index === serverIndex && playerStyles.providerSignalActive]} /><Text style={[playerStyles.inPlayerProviderText, index === serverIndex && playerStyles.inPlayerProviderTextActive]}>{provider.label || provider.provider}</Text></View><Text style={[playerStyles.inPlayerProviderState, index === serverIndex && playerStyles.inPlayerProviderTextActive]}>{index === serverIndex ? (embedSource ? "RECONNECT" : "PLAYING") : "SELECT"}</Text></Pressable>)}</View></View> : null}
      {source ? <Pressable accessibilityRole="button" accessibilityLabel="Show or hide player controls" onPress={() => setControlsVisible((value) => { if (value) { setShowConsole(false); setShowSourcePicker(false); setShowQualityPicker(false); } return !value; })} style={styles.revealZone} /> : null}
    </View>
    {error ? <View style={styles.errorAction}><NothingCard style={styles.errorCard}><DotLabel tone="muted">VIDEO UNAVAILABLE</DotLabel><Text style={styles.errorCopy}>{error}</Text><NothingButton label="TRY AGAIN" onPress={retry} variant="outline" /></NothingCard></View> : null}
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.siteWatchInfo}>
        <View style={styles.watchInfoHead}>
          <View style={styles.watchInfoCopy}><DotLabel tone="live">NOW WATCHING</DotLabel><Text style={styles.siteWatchTitle}>{title}</Text><Text style={styles.siteWatchMeta}>EPISODE {episode} OF {canonicalEpisodes.length || "?"} · {language.toUpperCase()} · {activeProvider?.label || "FINDING SOURCE"}</Text></View>
          <Signal label={source || embedSource ? "PLAYING" : loadingServers ? "LOOKING" : error ? "CHECK EP" : "READY"} tone={source || embedSource ? "live" : "muted"} />
        </View>
        <View style={styles.watchNav}>
          <Pressable accessibilityRole="button" disabled={!previousKnownEpisode} onPress={() => previousKnownEpisode && goToEpisode(previousKnownEpisode)} style={[styles.watchNavButton, !previousKnownEpisode && styles.watchNavDisabled]}><AppIcon name="skip-previous" size={17} color={nothing.white} /><Text style={styles.watchNavText}>PREVIOUS</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push((`/anime/${animeId}`) as never)} style={[styles.watchNavButton, styles.watchNavDetail]}><AppIcon name="movie-open-outline" size={17} color={nothing.black} /><Text style={[styles.watchNavText, styles.watchNavTextDetail]}>ANIME PAGE</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!nextKnownEpisode} onPress={nextEpisode} style={[styles.watchNavButton, !nextKnownEpisode && styles.watchNavDisabled]}><Text style={styles.watchNavText}>NEXT</Text><AppIcon name="skip-next" size={17} color={nothing.white} /></Pressable>
        </View>
      </View>
      <View style={styles.sidebarDivider} />
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showEpisodeSidebar }} onPress={() => setShowEpisodeSidebar((value) => !value)} style={styles.episodeSidebarToggle}>
        <View><DotLabel>EPISODES</DotLabel><Text style={styles.episodeSidebarTitle}>Episodes ({filteredEpisodes.length}{episodeSearch ? ` of ${canonicalEpisodes.length}` : ""})</Text></View><AppIcon name={showEpisodeSidebar ? "chevron-up" : "chevron-down"} size={22} color={nothing.white} />
      </Pressable>
      {showEpisodeSidebar ? <View style={styles.episodeSidebar}>
        <View style={styles.episodeSearchRow}><AppIcon name="magnify" size={18} color={nothing.muted} /><TextInput value={episodeSearch} onChangeText={setEpisodeSearch} placeholder="Search episodes or number" placeholderTextColor={nothing.dim} style={styles.episodeSearch} returnKeyType="done" /></View>
        {episodeQuery.isPending ? <View style={styles.episodeLoading}><ActivityIndicator color={nothing.white} /><Text style={styles.episodeLoadingText}>LOADING EPISODES</Text></View> : filteredEpisodes.length ? <View style={styles.episodeGrid}>{filteredEpisodes.slice(0, 50).map((item) => <Pressable key={item.number} accessibilityRole="button" accessibilityState={{ selected: item.number === episode }} onPress={() => goToEpisode(item.number)} style={[styles.episodeChoice, item.number === episode && styles.episodeChoiceActive]}><Text style={[styles.episodeChoiceNumber, item.number === episode && styles.episodeChoiceTextActive]}>{String(item.number).padStart(2, "0")}</Text><Text style={[styles.episodeChoiceTitle, item.number === episode && styles.episodeChoiceTextActive]} numberOfLines={1}>{item.title || `Episode ${item.number}`}</Text><Text style={[styles.episodeChoiceState, item.number === episode && styles.episodeChoiceTextActive]}>{item.number === episode ? "WATCHING" : item.isFiller ? "FILLER" : "EPISODE"}</Text></Pressable>)}</View> : <Text style={styles.emptyEpisodeText}>{episodeSearch ? "No episodes match your search." : "No episodes are listed for this title."}</Text>}
      </View> : null}
      <View style={styles.watchCommunitySection}>
        <DotLabel>EPISODE ACTIVITY</DotLabel>
        <View style={styles.ratingRow}><Text style={styles.ratingPrompt}>{currentRating ? `YOU RATED ${currentRating}/10` : "RATE THIS EPISODE"}</Text><View style={styles.ratingChoices}>{Array.from({ length: 10 }, (_, index) => index + 1).map((score) => <Pressable key={score} accessibilityRole="button" accessibilityLabel={`Rate ${score} out of 10`} onPress={() => { if (!auth.user) { router.push("/auth" as never); return; } ratings.setRating.mutate({ episode, score }); }} style={[styles.ratingChoice, currentRating >= score && styles.ratingChoiceActive]}><Text style={[styles.ratingChoiceText, currentRating >= score && styles.ratingChoiceTextActive]}>{score}</Text></Pressable>)}</View></View>
        <View style={styles.commentBlock}><Text style={styles.commentTitle}>Discussion</Text>{auth.user ? <><TextInput value={watchComment} onChangeText={setWatchComment} placeholder="Add a comment about this episode" placeholderTextColor={nothing.dim} style={styles.watchCommentInput} multiline maxLength={2000} /><NothingButton label={comments.add.isPending ? "POSTING" : "POST COMMENT"} disabled={!watchComment.trim() || comments.add.isPending} onPress={() => comments.add.mutate({ content: watchComment, episode }, { onSuccess: () => setWatchComment("") })} /></> : <NothingButton label="SIGN IN TO COMMENT" variant="outline" onPress={() => router.push("/auth" as never)} />}{episodeComments.slice(0, 4).map((item) => <View key={item.id} style={styles.watchComment}><Text style={styles.watchCommentMeta}>EP {item.episode_number} · {new Date(item.created_at).toLocaleDateString()}</Text><Text style={styles.watchCommentText}>{item.content}</Text></View>)}</View>
      </View>
    </ScrollView>
  </NativeScreen>;
}

const watchPageStyles = StyleSheet.create({
  watchBackdrop: { position: "absolute", top: 0, left: 0, right: 0, height: 540, opacity: 0.42 },
  watchBackdropMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,9,9,0.82)" },
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
  playerMenuSheet: { marginHorizontal: 16, marginTop: 10, padding: 14, gap: 14, borderWidth: 1, borderColor: nothing.line, borderRadius: 5, backgroundColor: "rgba(9,9,9,0.94)" },
  playerMenuHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 2 },
  menuSection: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: nothing.line },
  belowPlayerSources: { marginHorizontal: 16, marginTop: 14, gap: 9, paddingTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: nothing.line, paddingBottom: 14 },
  overlayActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  visibleSourceControls: { gap: 9, paddingTop: 4, borderTopWidth: 1, borderTopColor: nothing.line },
  visibleControlHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  visibleControlCount: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  visibleProviderRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  visibleProvider: { minHeight: 37, minWidth: 90, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  visibleProviderActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" },
  visibleProviderText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900" },
  visibleProviderTextActive: { color: nothing.red },
  visibleProviderState: { color: nothing.dim, fontFamily: "monospace", fontSize: 7, fontWeight: "800" },
  visibleSkipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 },
  skipLookupText: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  skipToggle: { minHeight: 36, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line },
  skipToggleActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" },
  skipToggleText: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "900" },
  skipToggleTextActive: { color: nothing.red },
  sidebarDivider: { height: 1, backgroundColor: nothing.line, marginVertical: 2 },
  episodeSidebarToggle: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  episodeSidebarTitle: { color: nothing.white, fontSize: 17, fontWeight: "900", marginTop: 4 },
  episodeSidebar: { gap: 10 },
  episodeSearchRow: { height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: nothing.line, borderRadius: 4, backgroundColor: nothing.surface },
  episodeSearch: { flex: 1, color: nothing.white, fontSize: 13, paddingVertical: 0 },
  episodeLoading: { minHeight: 86, alignItems: "center", justifyContent: "center", gap: 9, borderTopWidth: 1, borderTopColor: nothing.line },
  episodeLoadingText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  episodeGrid: { gap: 0, borderTopWidth: 1, borderTopColor: nothing.line },
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
  commentBlock: { gap: 10, paddingTop: 2 },
  commentTitle: { color: nothing.white, fontSize: 19, fontWeight: "900" },
  watchCommentInput: { minHeight: 78, color: nothing.white, fontSize: 13, lineHeight: 19, textAlignVertical: "top", padding: 11, borderWidth: 1, borderColor: nothing.line, borderRadius: 4, backgroundColor: nothing.surface },
  watchComment: { gap: 5, paddingVertical: 11, borderTopWidth: 1, borderTopColor: nothing.line },
  watchCommentMeta: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  watchCommentText: { color: nothing.white, fontSize: 13, lineHeight: 19 },
});

const playerStyles = StyleSheet.create({
  videoShellFullscreen: { position: "absolute", zIndex: 20, top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", aspectRatio: undefined },
  embedProviderButton: { position: "absolute", zIndex: 5, top: 10, right: 10, minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1, borderColor: "rgba(246,246,242,0.48)", backgroundColor: "rgba(9,9,9,0.88)" },
  embedProviderButtonText: { color: nothing.white, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.35 },
  overlayContextActions: { alignSelf: "flex-end", alignItems: "flex-end", gap: 6 },
  playerTimelineBlock: { gap: 6, paddingTop: 3 },
  playerSettingsOverlay: { position: "absolute", zIndex: 4, top: 8, right: 8, bottom: 8, width: "78%", maxWidth: 370, borderWidth: 1, borderColor: "rgba(246,246,242,0.3)", borderRadius: 5, backgroundColor: "rgba(9,9,9,0.96)" },
  playerSettingsContent: { padding: 12, gap: 10 },
  quickQualityButton: { minWidth: 48, height: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.74)", borderWidth: 1, borderColor: "rgba(246,246,242,0.35)" },
  quickQualityButtonText: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.25 },
  quickQualityOverlay: { position: "absolute", zIndex: 5, top: 56, right: 8, width: 212, gap: 9, padding: 12, borderWidth: 1, borderColor: "rgba(246,246,242,0.3)", borderRadius: 5, backgroundColor: "rgba(9,9,9,0.97)" },
  quickQualityHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quickQualityHint: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.35 },
  quickQualityChoices: { borderTopWidth: 1, borderTopColor: nothing.line },
  quickQualityChoice: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  quickQualityChoiceActive: { borderBottomColor: nothing.red, backgroundColor: "rgba(255,77,77,0.06)" },
  quickQualityChoiceText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900" },
  quickQualityChoiceTextActive: { color: nothing.red },
  quickQualityChoiceState: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800" },
  quickQualityChoiceStateActive: { color: nothing.red },
  playerSourceOverlay: { position: "absolute", zIndex: 4, right: 8, bottom: 8, width: "78%", maxWidth: 370, gap: 10, padding: 12, borderWidth: 1, borderColor: "rgba(246,246,242,0.3)", borderRadius: 5, backgroundColor: "rgba(9,9,9,0.97)" },
  inPlayerProviderList: { borderTopWidth: 1, borderTopColor: nothing.line },
  inPlayerProvider: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  inPlayerProviderActive: { borderBottomColor: nothing.red, backgroundColor: "rgba(255,77,77,0.06)" },
  inPlayerProviderName: { flexDirection: "row", alignItems: "center", gap: 8 },
  providerSignal: { width: 7, height: 7, borderRadius: 99, backgroundColor: nothing.dim },
  providerSignalActive: { backgroundColor: nothing.red },
  inPlayerProviderText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900" },
  inPlayerProviderTextActive: { color: nothing.red },
  inPlayerProviderState: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800" },
});

const styles = StyleSheet.create({ ...watchPageStyles,
  fill: { flex: 1 }, top: { minHeight: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }, closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 6, backgroundColor: "transparent" }, topCopy: { flex: 1, gap: 2 }, title: { color: nothing.white, fontSize: 15, fontWeight: "900" }, episodeLabel: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 }, topMenu: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: nothing.red }, videoShell: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000000", overflow: "hidden" }, video: { flex: 1 }, videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 11, padding: 22 }, placeholderText: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "800", textAlign: "center", letterSpacing: 1 }, errorText: { color: nothing.red, fontSize: 13, lineHeight: 19, textAlign: "center" }, playerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "space-between", padding: 12 }, revealZone: { ...StyleSheet.absoluteFillObject, zIndex: 1 }, overlayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sourcePill: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.72)", borderWidth: 1, borderColor: "rgba(246,246,242,0.18)" }, overlayMenu: { width: 38, height: 38, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(9,9,9,0.74)", borderWidth: 1, borderColor: "rgba(246,246,242,0.35)" }, overlayMenuActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.16)" }, centerControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 }, seekControl: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(9,9,9,0.68)", borderWidth: 1, borderColor: "rgba(246,246,242,0.24)" }, heroPlay: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: nothing.white }, overlayBottom: { gap: 8 }, skipInline: { minHeight: 30, paddingHorizontal: 9, borderRadius: 4, justifyContent: "center", backgroundColor: "rgba(9,9,9,0.75)", borderWidth: 1, borderColor: "rgba(246,246,242,0.3)" }, skipInlineText: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.6 }, resumeInline: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.75)", borderWidth: 1, borderColor: "rgba(246,246,242,0.3)" }, resumeInlineText: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.35 }, nextInline: { minHeight: 31, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, borderRadius: 4, backgroundColor: nothing.white }, nextInlineText: { color: nothing.black, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.4 }, timelineBlock: { paddingHorizontal: 16, paddingTop: 12, gap: 7 }, timeline: { height: 4, backgroundColor: nothing.line, overflow: "hidden" }, timelineBuffered: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#70706E" }, timelinePlayed: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: nothing.red }, timeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, timeText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "800" }, timeMeta: { flex: 1, color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", textAlign: "center", letterSpacing: 0.4 }, resumeRow: { marginHorizontal: 16, marginTop: 12, paddingVertical: 9, paddingHorizontal: 12, alignItems: "center", borderWidth: 1, borderColor: nothing.red, borderRadius: 4 }, resumeText: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 }, errorAction: { paddingHorizontal: 16, paddingTop: 12 }, errorCard: { padding: 14, gap: 8, borderColor: "rgba(255,77,77,0.45)" }, errorCopy: { color: nothing.muted, fontSize: 12, lineHeight: 18 }, scroll: { padding: 16, paddingBottom: 42, gap: 18 }, consoleHeading: { minHeight: 55, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }, consoleTitle: { color: nothing.white, fontSize: 23, fontWeight: "900", letterSpacing: -0.6 }, consoleSubtitle: { color: nothing.muted, marginTop: 4, fontSize: 12 }, consoleCount: { color: nothing.red, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 }, languageRow: { flexDirection: "row", gap: 9 }, language: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: nothing.line, borderRadius: 4, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }, languageActive: { backgroundColor: nothing.white, borderColor: nothing.white }, languageDisabled: { opacity: 0.35 }, languageText: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 9, letterSpacing: 0.3 }, languageTextActive: { color: nothing.black }, panel: { paddingVertical: 15, gap: 11, backgroundColor: "transparent", borderWidth: 0, borderTopWidth: 1, borderTopColor: nothing.line, borderRadius: 0 }, providerList: { gap: 0 }, provider: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: nothing.line }, providerActive: { borderBottomColor: nothing.red }, providerText: { color: nothing.white, fontWeight: "800", fontSize: 14 }, providerTextActive: { color: nothing.red }, providerMeta: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800" }, providerMetaActive: { color: nothing.red }, qualityRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, quality: { minHeight: 35, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line }, qualityActive: { borderColor: nothing.red }, qualityText: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 10 }, qualityTextActive: { color: nothing.white }, toggleRow: { flexDirection: "row", gap: 8 }, toggle: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line }, toggleOn: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" }, toggleText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "800" }, toggleTextOn: { color: nothing.red }, speedRow: { flexDirection: "row", gap: 5 }, speed: { flex: 1, minHeight: 35, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line }, speedActive: { borderColor: nothing.red }, speedText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "800" }, speedTextActive: { color: nothing.white }, skipRow: { flexDirection: "row", gap: 8 },
});
