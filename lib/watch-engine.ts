import { getPlaybackType, hasExpiredEmbeddedToken, sourceVerification } from "@/lib/aniraku-api";
import type { StreamResponse, StreamSource } from "@/lib/types";

export type Language = "sub" | "dub";
export type SkipKind = "intro" | "outro";
export type SkipSegment = { startTime: number; endTime: number; source: "provider" | "aniskip" };
export type SkipSegments = Record<SkipKind, SkipSegment | null>;

export const EPISODE_PAGE_SIZE = 50;
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
  return uniqueAndRankSources(validSources(response).filter((source) => !isProxySource(source)));
}

export function proxySources(response: Pick<StreamResponse, "sources">) {
  return uniqueAndRankSources(validSources(response).filter(isProxySource));
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
