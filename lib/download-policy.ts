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

export type BackendDownloadOption = { url: string; label: string; quality: string | null; providerLabel: string };

/**
 * Backend download labels carry the quality when the provider offers
 * per-quality files ("Kiwi 1080p", "1080p", "HD-720p"). Plain labels
 * ("Zoko", "Download") carry no quality — those fall back to a single
 * default option. Returns the normalized "1080p"-style tag or null.
 */
export function parseBackendDownloadQuality(label?: string | null): string | null {
  const text = String(label ?? "").toLowerCase();
  if (!text) return null;
  const match = text.match(/(2160|1440|1080|720|480|360|240)\s*p\b/);
  if (match) return `${match[1]}p`;
  if (/\b(4k|uhd)\b/.test(text)) return "2160p";
  if (/\b(sd|low)\b/.test(text)) return "480p";
  return null;
}

function backendDownloadQualityRank(quality: string | null): number {
  if (!quality) return -1;
  return qualityRank(quality);
}

export type BackendDownloadServer = { label?: string; lang?: string; downloads?: Array<{ url: string; label?: string }> };

/**
 * Collects backend `downloads[]` links across ALL providers for the current
 * language (SUB and DUB lists are built separately by the caller passing the
 * language-filtered server list). Dedupes by URL, keeps provider order, and
 * tags each option with its parsed quality (null = default label).
 */
export function buildBackendDownloadOptions(servers: readonly BackendDownloadServer[]): BackendDownloadOption[] {
  const seen = new Set<string>();
  const options: BackendDownloadOption[] = [];
  for (const server of servers) {
    const providerLabel = String(server?.label ?? "").trim().toUpperCase() || "SERVER";
    for (const link of server?.downloads ?? []) {
      const url = String(link?.url ?? "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const label = String(link?.label ?? "").trim() || providerLabel;
      options.push({ url, label, quality: parseBackendDownloadQuality(label), providerLabel });
    }
  }
  return options;
}

/** Quality-tagged options first (highest first), default-label options last. */
export function sortBackendDownloadOptions(options: BackendDownloadOption[]): BackendDownloadOption[] {
  return [...options].sort((a, b) => backendDownloadQualityRank(b.quality) - backendDownloadQualityRank(a.quality));
}

/** True when the backend offers per-quality files (1080p/720p/…) to pick from. */
export function hasQualityBackendDownloads(options: readonly BackendDownloadOption[]): boolean {
  return options.some((option) => option.quality !== null);
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
