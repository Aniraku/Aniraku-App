import { getPlaybackType, sourceVerification } from "@/lib/aniraku-api";
import { isAutoQuality, qualityRank } from "@/lib/watch-engine";
import type { StreamSource } from "@/lib/types";

function fileStem(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "aniraku-episode";
}

function publicMediaExtension(source?: StreamSource) {
  const mime = String(source?.mime || source?.type || "").toLowerCase();
  const fromUrl = String(source?.url || "").match(/\.(mp4|m4v|webm|ogv|ogg|mpeg|mpg)(?:$|[?#])/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogv";
  if (mime.includes("mpeg")) return "mpeg";
  return "mp4";
}

export function publicDownloadFilename(title: string, episode: number, language: "sub" | "dub", quality: string, source?: StreamSource) {
  return `${fileStem(title)}-ep${String(episode).padStart(2, "0")}-${language}-${fileStem(quality)}.${publicMediaExtension(source)}`;
}

export function isDownloadableSource(source: StreamSource) {
  return /^https:\/\//i.test(source.url)
    && getPlaybackType(source) === "native"
    && sourceVerification(source) !== "dead";
}

function downloadableQualityRank(source: StreamSource) {
  return isAutoQuality(source) ? 0 : qualityRank(source.quality);
}

export function selectMaximumQualityDownload(sources: StreamSource[]) {
  const eligible = sources.filter(isDownloadableSource);
  return eligible.sort((a, b) => downloadableQualityRank(b) - downloadableQualityRank(a))[0] ?? null;
}

/**
 * Binds a download to the quality the viewer actually chose: an exact native
 * match for `requestedQuality` wins, otherwise the historical max-guess
 * fallback applies. Auto (or an unmatchable label) always takes the fallback.
 */
export function selectDownloadSourceForQuality(sources: StreamSource[], requestedQuality?: string | null) {
  const wanted = String(requestedQuality ?? "").trim();
  if (wanted && !/auto|adaptive|master|original|default/i.test(wanted)) {
    const targetRank = qualityRank(wanted);
    const exact = sources.filter(isDownloadableSource)
      .filter((source) => downloadableQualityRank(source) === targetRank)
      .sort((a, b) => downloadableQualityRank(b) - downloadableQualityRank(a))[0];
    if (exact) return exact;
  }
  return selectMaximumQualityDownload(sources);
}

export function downloadLabel(source: StreamSource | null) {
  if (!source) return "DIRECT SOURCE REQUIRED";
  return isAutoQuality(source) ? "ORIGINAL DIRECT" : `${source.quality || "DIRECT"} MAX`;
}

/**
 * Stale-index cleanup (pure, tested): drop index entries whose files are
 * gone — files removed outside the app via a file manager must not linger
 * as phantom "saved" rows. `exists` is injected so vitest stays FS-free;
 * lib/downloads.ts wires the real expo-file-system check.
 */
export function filterExistingDownloadEntries<T extends { uri: string }>(
  entries: readonly T[],
  exists: (uri: string) => boolean,
): { kept: T[]; removed: T[] } {
  const kept: T[] = [];
  const removed: T[] = [];
  for (const entry of entries) {
    let alive = false;
    try {
      alive = exists(entry.uri);
    } catch {
      alive = false;
    }
    (alive ? kept : removed).push(entry);
  }
  return { kept, removed };
}
