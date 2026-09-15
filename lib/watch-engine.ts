import { getPlaybackType, hasExpiredEmbeddedToken, sourceVerification } from "@/lib/aniraku-api";
import type { StreamResponse, StreamSource } from "@/lib/types";

export type Language = "sub" | "dub";
export type SkipKind = "intro" | "outro";
export type SkipSegment = { startTime: number; endTime: number; source: "provider" | "aniskip" };
export type SkipSegments = Record<SkipKind, SkipSegment | null>;

export const EPISODE_PAGE_SIZE = 50;
export const RESUME_MIN_TIME = 30;
export const FUTURE_RELEASE_MESSAGE = "Time travel still has not been invented—sorry, we cannot stream an episode from the future. It will appear here the moment it is officially released.";

export function isConfirmedFutureRelease(input: {
  episodeNumber: number;
  episodes?: ReadonlyArray<{ number?: number }>;
  status?: string | null;
  nextAiringEpisode?: { episode?: number | null } | null;
  hasConfirmedEpisodeList?: boolean;
}) {
  const target = Number(input.episodeNumber);
  if (!Number.isInteger(target) || target < 1) return false;
  const status = String(input.status || "").toUpperCase();
  const nextEpisode = Number(input.nextAiringEpisode?.episode);
  if (Number.isInteger(nextEpisode) && nextEpisode >= 1 && target >= nextEpisode) return true;
  if (status === "NOT_YET_RELEASED") return true;
  if (status !== "RELEASING" || !input.hasConfirmedEpisodeList) return false;
  const latestReleased = (input.episodes ?? []).reduce((latest, item) => Math.max(latest, Number(item.number) || 0), 0);
  return latestReleased > 0 && target > latestReleased;
}

export function qualityRank(quality?: string) {
  const value = String(quality || "").toLowerCase();
  if (/auto|adaptive|master|original|default/.test(value) || !value) return 10_000;
  const match = value.match(/(2160|1440|1080|720|480|360)/);
  return match ? Number(match[1]) : 1;
}

export function isAutoQuality(source: StreamSource | null) {
  return !source?.quality || /auto|adaptive|master|original|default/i.test(source.quality);
}

export function shouldMountReplacementSource(sourceMounted: boolean, forceRefresh: boolean) {
  return !sourceMounted || forceRefresh;
}

export function hasConfirmedPlaybackStart(input: { isPlaying: boolean; currentTime: number; firstFrameRendered: boolean }) {
  return input.firstFrameRendered || input.currentTime > 0;
}

export function shouldApplyInitialHistoryResume(input: {
  currentTime: number;
  hasPendingResume: boolean;
  isPlaying: boolean;
  resumeAppliedForSource: boolean;
  status?: string;
}) {
  return !input.resumeAppliedForSource
    && input.hasPendingResume
    && input.currentTime <= 1
    && (input.isPlaying || input.status === "readyToPlay");
}

export function shouldRetryProxiedSourceAfterDirect(usingProxy: boolean, playbackStarted: boolean) {
  return !usingProxy && !playbackStarted;
}

export function shouldHoldRebufferWatermark(input: {
  lastStableTime: number;
  reportedTime: number;
  wasBuffering: boolean;
  playbackStarted: boolean;
  intentionalSeek: boolean;
}) {
  const rollback = input.lastStableTime - input.reportedTime;
  return input.wasBuffering
    && input.playbackStarted
    && !input.intentionalSeek
    && rollback >= 0.05
    && rollback <= 2;
}

export function isProxySource(source: StreamSource) {
  const verification = sourceVerification(source);
  const type = String(source.type ?? "").toLowerCase();
  return verification === "proxy" || type === "proxy";
}

export function isVerifiedEmbedSource(source: StreamSource) {
  const playbackType = getPlaybackType(source);
  const verification = sourceVerification(source);
  // Accept embed if EITHER the type indicates embed OR the verification field does.
  // Some providers only set one of these.
  return playbackType === "embed" || verification === "embed";
}

export function embedSources(response: Pick<StreamResponse, "sources">) {
  const seen = new Set<string>();
  return (response.sources ?? []).filter(isVerifiedEmbedSource).filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    if (sourceVerification(source) === "dead") return false;
    seen.add(source.url);
    return true;
  });
}

/** Hentai titles have no direct/proxy streams — they play via embedded WebView. */
export function isHentaiAnime(input: {
  isAdult?: boolean | null;
  genres?: string[] | null;
}) {
  if (input.isAdult) return true;
  return (input.genres ?? []).some((genre) => genre.trim().toLowerCase() === "hentai");
}

export function shouldPreferEmbed(input: {
  isHentai: boolean;
  directCount: number;
  proxyCount: number;
  embedCount: number;
}) {
  if (input.embedCount <= 0) return false;
  if (input.isHentai && input.directCount === 0 && input.proxyCount === 0) return true;
  return input.directCount === 0 && input.proxyCount === 0;
}

function validSources(response: Pick<StreamResponse, "sources">) {
  return (response.sources ?? [])
    .filter((source) => Boolean(source.url) && sourceVerification(source) !== "dead" && !hasExpiredEmbeddedToken(source.url));
}

function uniqueAndRankSources(sources: StreamSource[]) {
  const seen = new Set<string>();
  return sources
    .filter((source) => { if (seen.has(source.url)) return false; seen.add(source.url); return true; })
    .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
}

export function directSources(response: Pick<StreamResponse, "sources">) {
  return uniqueAndRankSources(validSources(response).filter((source) => !isProxySource(source) && getPlaybackType(source) !== "embed"));
}

export function proxySources(response: Pick<StreamResponse, "sources">) {
  return uniqueAndRankSources(validSources(response).filter((source) => isProxySource(source) && getPlaybackType(source) !== "embed"));
}

export function nativeSources(response: Pick<StreamResponse, "sources">) {
  const seen = new Set<string>();
  return [...directSources(response), ...proxySources(response)].filter((source) => {
    if (seen.has(source.url)) return false; seen.add(source.url); return true;
  });
}

/** Parse Anikoto auto-quality into ranked manual options. */
export function parseQualityOptions(response: Pick<StreamResponse, "sources">) {
  const sources = nativeSources(response);
  if (sources.length <= 1) return sources;
  return sources;
}

function normalizeSegment(value: unknown, source: SkipSegment["source"]) {
  const candidate = (value && typeof value === "object" && "interval" in value)
    ? (value as { interval?: Record<string, unknown> }).interval
    : value;
  const record = candidate as Record<string, unknown> | null | undefined;
  const startTime = Number(record?.startTime ?? record?.start_time ?? record?.start);
  const endTime = Number(record?.endTime ?? record?.end_time ?? record?.end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime <= startTime + 1) return null;
  return { startTime, endTime, source };
}

export function providerSkipSegments(response: StreamResponse): SkipSegments {
  return {
    intro: normalizeSegment(response.intro, "provider"),
    outro: normalizeSegment(response.outro, "provider"),
  };
}

export function mergeSkipSegments(current: SkipSegments, incoming: SkipSegments): SkipSegments {
  const pick = (existing: SkipSegment | null, next: SkipSegment | null) => {
    if (next?.source === "provider") return next;
    if (existing?.source === "provider") return existing;
    return next || existing || null;
  };
  return { intro: pick(current.intro, incoming.intro), outro: pick(current.outro, incoming.outro) };
}

export function activeSkipKind(segments: SkipSegments, currentTime: number): SkipKind | null {
  if (segments.intro && currentTime >= segments.intro.startTime && currentTime < segments.intro.endTime) return "intro";
  if (segments.outro && currentTime >= segments.outro.startTime && currentTime < segments.outro.endTime) return "outro";
  return null;
}

export function normalizeAniSkipSegments(payload: unknown): SkipSegments {
  const results = Array.isArray((payload as { results?: unknown[] })?.results)
    ? (payload as { results: Array<Record<string, unknown>> }).results
    : [];
  const segments: SkipSegments = { intro: null, outro: null };
  for (const item of results) {
    const rawType = String(item.skipType || "").toLowerCase();
    const kind: SkipKind | null = rawType === "op" || rawType === "mixed_op"
      ? "intro"
      : rawType === "ed" || rawType === "mixed_ed" ? "outro" : null;
    if (!kind || segments[kind]) continue;
    const segment = normalizeSegment(item, "aniskip");
    if (segment) segments[kind] = segment;
  }
  return segments;
}

export function episodePageCount(totalEpisodes: number, pageSize = EPISODE_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, totalEpisodes) / Math.max(1, pageSize)));
}

export function episodePageFor(episodeNumber: number, pageSize = EPISODE_PAGE_SIZE) {
  return Math.max(0, Math.floor((Math.max(1, episodeNumber) - 1) / Math.max(1, pageSize)));
}

export function episodePageSlice<T>(episodes: readonly T[], page: number, pageSize = EPISODE_PAGE_SIZE) {
  const safePage = Math.max(0, Math.min(episodePageCount(episodes.length, pageSize) - 1, page));
  const start = safePage * Math.max(1, pageSize);
  return episodes.slice(start, start + Math.max(1, pageSize));
}

/** Segmented-track tint for the timeline: OP/ED ranges as % offsets. */
export type ChapterTrackSegment = { kind: SkipKind; leftPct: number; widthPct: number };

export function chapterTrackSegments(segments: SkipSegments, duration: number): ChapterTrackSegment[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const out: ChapterTrackSegment[] = [];
  for (const kind of ["intro", "outro"] as const) {
    const segment = segments[kind];
    if (!segment) continue;
    const start = Math.max(0, Math.min(duration, segment.startTime));
    const end = Math.max(0, Math.min(duration, segment.endTime));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    out.push({ kind, leftPct: (start / duration) * 100, widthPct: ((end - start) / duration) * 100 });
  }
  return out.sort((a, b) => a.leftPct - b.leftPct);
}

export type VideoTrackLike = {
  height?: number | null;
  width?: number | null;
  bitrate?: number | null;
  selected?: boolean | null;
};

/** Live ExoPlayer rendition: height of the selected video track, if reported. */
export function liveRenditionHeight(tracks: readonly VideoTrackLike[] | undefined | null): number | null {
  if (!tracks?.length) return null;
  const selected = tracks.find((track) => track.selected === true);
  const height = Number(selected?.height);
  return Number.isFinite(height) && height > 0 ? Math.round(height) : null;
}

/**
 * The `Auto · 720p` line: live rendition when ExoPlayer reports one,
 * otherwise the parsed-manifest ceiling so Auto never reads as a black box.
 */
export function autoQualityLine(input: { ceilingLabel?: string | null; liveHeight?: number | null }): string | null {
  const live = Number(input.liveHeight);
  if (Number.isFinite(live) && live > 0) return `AUTO · ${Math.round(live)}P`;
  const ceiling = String(input.ceilingLabel ?? "").trim();
  if (ceiling) return `AUTO ADAPTS UP TO ${ceiling.toUpperCase()}`;
  return null;
}

/**
 * Raw ExoPlayer/AVPlayer error strings mean nothing to a viewer. Maps the
 * common engine codes to one honest sentence; unknown details return null so
 * the UI can keep them in the small diagnostic line instead.
 */
export function humanPlayerError(detail: string | null | undefined) {
  const raw = String(detail ?? "");
  if (/BAD_HTTP_STATUS|403|forbidden|proxy target not allowed/i.test(raw)) {
    return "This server refused the stream. The next server usually works.";
  }
  if (/IO_NETWORK_ERROR|ETIMEDOUT|timed?out|ENOTCONN|ECONN|unable to connect/i.test(raw)) {
    return "The server took too long to respond. Check your connection or switch servers.";
  }
  if (/BEHIND_LIVE_WINDOW|MANIFEST|PARSING|parsing|malformed|WRONG_TIME/i.test(raw)) {
    return "This stream's listing confused the player. Switching servers is the fix.";
  }
  if (/DECOD|unsupported|codec|no decoder/i.test(raw)) {
    return "This device can't decode this stream's video. Try another quality or server.";
  }
  if (/DRM|secure|licen/i.test(raw)) {
    return "This stream is protected and can't play here. Try another server.";
  }
  return null;
}

// ── Track 4 (Reliability) pure helpers ───────────────────────────────
// These are deliberately UI-free so vitest can prove the contracts:
// position survives switches, caches never cross languages, history
// prefers max() over last-write, and retries stay honest.

/**
 * Stash the current position when switching server / language / quality.
 * Returns the position to resume at, or null when there is nothing worth
 * keeping (unstarted or unknown duration). Callers store the result in
 * pendingResume before tearing down the current source.
 */
export function resolveResumeOnSwitch(currentTime: number, duration: number): number | null {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration)) return null;
  if (currentTime <= 0 || duration <= 0) return null;
  return currentTime;
}

/** True when a stashed position is worth seeking to on the new source. */
export function isResumablePosition(position: number | null | undefined): boolean {
  return typeof position === "number" && Number.isFinite(position) && position > RESUME_MIN_TIME;
}

/**
 * Stream-cache key. MUST include provider identity + language + episode:
 * reusing a sub stream for a dub request (or Momo's for Niko's) plays the
 * wrong audio or a dead URL. The episode alone is never enough.
 */
export function streamCacheKey(
  provider: { id?: string | null; provider?: string | null },
  episode: number,
  lang: Language,
): string {
  const providerName = String(provider.provider ?? "").trim() || "unknown-provider";
  const providerId = String(provider.id ?? "").trim() || "unknown-id";
  return `aniraku-watch-stream:${providerName}:${providerId}:${lang}:${Number(episode)}`;
}

export type SkipFetchStatus = "idle" | "cached" | "ok" | "empty" | "timeout" | "error";

/**
 * Classify an AniSkip fetch outcome so the diagnostics line can tell
 * "no skip data for this episode" apart from "the request timed out".
 */
export function resolveSkipFetchStatus(input: {
  fromCache?: boolean;
  timedOut?: boolean;
  ok?: boolean;
  hasSegments?: boolean;
}): SkipFetchStatus {
  if (input.fromCache) return "cached";
  if (input.timedOut) return "timeout";
  if (input.ok === false) return "error";
  return input.hasSegments ? "ok" : "empty";
}

export type HistoryProgressLike = { progress?: number | null; duration?: number | null } | null | undefined;

/**
 * History conflict rule: prefer max(local, server), not last-write.
 * A stale background save must never rewind a newer position, and a
 * near-end (≥90%) entry resolves to null = nothing left to resume.
 */
export function resolveHistoryResume(
  local: HistoryProgressLike,
  server: HistoryProgressLike,
): number | null {
  const candidates = [local, server]
    .map((entry) => ({ progress: Number(entry?.progress), duration: Number(entry?.duration) }))
    .filter((entry) => Number.isFinite(entry.progress) && entry.progress > RESUME_MIN_TIME && Number.isFinite(entry.duration) && entry.duration > 0);
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (b.progress > a.progress ? b : a));
  if (best.progress >= best.duration - 10) return null;
  if (best.duration > 0 && best.progress / best.duration >= 0.9) return null;
  return best.progress;
}

/** Save path half of the same rule: never persist a regression. */
export function resolveMaxHistoryProgress(localProgress: number, serverProgress: number): number {
  const local = Number(localProgress);
  const server = Number(serverProgress);
  if (!Number.isFinite(local)) return Number.isFinite(server) ? server : 0;
  if (!Number.isFinite(server)) return local;
  return Math.max(local, server);
}

export type RetryReason = "player" | "stream" | "startup" | "permanent";

/**
 * Retry honesty: TRY AGAIN re-fetches the SAME provider once with
 * refresh:true; SWITCH moves to the next unblocked provider; the same dead
 * URL is never retried twice without the refresh flag.
 */
export function shouldRefreshSameProvider(reason: RetryReason, refreshAlreadyAttempted: boolean): boolean {
  if (reason === "permanent") return false;
  return !refreshAlreadyAttempted;
}

/**
 * Offline playback never touches the stream path: no watchdog, no proxy,
 * no headers. Saved copies play from file:// / content:// URIs and carry a
 * "· SAVED" quality marker.
 */
export function isOfflinePlaybackSource(source: { url?: string | null; quality?: string | null } | null | undefined): boolean {
  if (!source?.url) return false;
  const url = String(source.url);
  if (/^(file|content):\/\//i.test(url)) return true;
  return /saved/i.test(String(source.quality ?? ""));
}
