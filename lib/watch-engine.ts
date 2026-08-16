import { getPlaybackType, hasExpiredEmbeddedToken, sourceVerification } from "@/lib/aniraku-api";
import type { Server, StreamResponse, StreamSource } from "@/lib/types";

export type Language = "sub" | "dub";
export type SkipKind = "intro" | "outro";
export type SkipSegment = { startTime: number; endTime: number; source: "provider" | "aniskip" };
export type SkipSegments = Record<SkipKind, SkipSegment | null>;

export function qualityRank(quality?: string) {
  const value = String(quality || "").toLowerCase();
  if (/auto|adaptive|master|original|default/.test(value) || !value) return 10_000;
  const match = value.match(/(2160|1440|1080|720|480|360)/);
  return match ? Number(match[1]) : 1;
}

export function isAutoQuality(source: StreamSource | null) {
  return !source?.quality || /auto|adaptive|master|original|default/i.test(source.quality);
}

/** A background stream refresh may update metadata, but not interrupt video already mounted. */
export function shouldMountReplacementSource(sourceMounted: boolean, forceRefresh: boolean) {
  return !sourceMounted || forceRefresh;
}

/** A play request or ready state alone is not proof of a rendered or advancing video frame. */
export function hasConfirmedPlaybackStart(input: { isPlaying: boolean; currentTime: number; firstFrameRendered: boolean }) {
  return input.firstFrameRendered || input.currentTime > 0;
}

/** A direct source that never renders gets one proxied retry before embed/provider recovery. */
export function shouldRetryProxiedSourceAfterDirect(usingProxy: boolean, playbackStarted: boolean) {
  return !usingProxy && !playbackStarted;
}

/**
 * Media3 may briefly report a position just behind the rendered frame after a
 * rebuffer. Hold the UI/history watermark during that small non-user rollback;
 * never turn it into a corrective native seek.
 */
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

export function isVerifiedEmbedSource(source: StreamSource) {
  return getPlaybackType(source) === "embed" && sourceVerification(source) === "embed";
}

export function directSources(response: Pick<StreamResponse, "sources">) {
  const seen = new Set<string>();
  return (response.sources ?? [])
    .filter((source) => Boolean(source.url) && sourceVerification(source) !== "dead" && !hasExpiredEmbeddedToken(source.url))
    .filter((source) => getPlaybackType(source) !== "embed")
    .filter((source) => {
      if (seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    })
    // Watch.jsx prefers provider Auto/adaptive first, then real provider quality.
    .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
}

export function embedSources(response: Pick<StreamResponse, "sources">) {
  const seen = new Set<string>();
  return (response.sources ?? [])
    .filter(isVerifiedEmbedSource)
    .filter((source) => {
      if (seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    });
}

export function usableProvider(server: Server) {
  const initial = { sources: server.sources ?? [] };
  return directSources(initial).length > 0 || embedSources(initial).length > 0;
}

export function nextProviderIndex(
  providers: Server[],
  currentIndex: number,
  blockedIds: ReadonlySet<string>,
  sameLanguageOnly = false,
) {
  const current = providers[currentIndex];
  const preferred = current ? providers.filter((candidate) => candidate.lang === current.lang) : providers;
  const pool = sameLanguageOnly ? preferred : [...preferred, ...providers];
  const match = pool.find((candidate) => candidate.id !== current?.id && !blockedIds.has(candidate.id));
  return match ? providers.findIndex((candidate) => candidate.id === match.id) : -1;
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
