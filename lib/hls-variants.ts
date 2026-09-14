import { anirakuProxyUrl, hasExpiredEmbeddedToken, isAnirakuProxyUrl } from "@/lib/aniraku-api";
import type { StreamSource } from "@/lib/types";
import type { WatchQualityOption } from "@/lib/watch-quality";

export type HlsVariant = {
  height: number;
  width?: number;
  bandwidth: number;
  /** Absolute CDN URL of the variant media playlist. */
  url: string;
  codecs?: string;
};

const STREAM_INF_ATTRIBUTES = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;

/**
 * Provider master (Auto) playlists are served through /api/v1/proxy with the
 * real CDN URL embedded as the `url` query parameter. Variant URIs inside the
 * playlist are relative to that CDN URL — NOT to the proxy — so resolution
 * has to unwrap it first, then re-wrap each variant for playback.
 */
export function originalStreamUrl(playbackUrl: string) {
  if (!isAnirakuProxyUrl(playbackUrl)) return playbackUrl;
  try {
    const parsed = new URL(playbackUrl);
    const embedded = parsed.searchParams.get("url");
    return embedded ? decodeURIComponent(embedded) : playbackUrl;
  } catch {
    return playbackUrl;
  }
}

export function resolveVariantUrl(uri: string, baseUrl: string) {
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseResolution(value?: string) {
  if (!value) return null;
  const [width, height] = value.toLowerCase().split("x").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Reads #EXT-X-STREAM-INF entries out of a master playlist. Audio-only and
 * I-frame renditions are skipped — they cannot carry picture quality.
 */
export function parseHlsMasterVariants(text: string, baseUrl: string): HlsVariant[] {
  const lines = text.split(/\r?\n/);
  const byKey = new Map<string, HlsVariant>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    if (line.includes("#EXT-X-I-FRAME-STREAM-INF") || line.startsWith("#EXT-X-I-FRAME-STREAM-INF")) continue;

    const attributes: Record<string, string> = {};
    for (const [, key, rawValue] of line.slice(line.indexOf(":") + 1).matchAll(STREAM_INF_ATTRIBUTES)) {
      attributes[key] = rawValue.replace(/^"|"$/g, "");
    }
    const resolution = parseResolution(attributes.RESOLUTION);
    const bandwidth = Number.parseInt(attributes.BANDWIDTH ?? "", 10);
    if (!resolution || !Number.isFinite(bandwidth) || bandwidth <= 0) continue;

    // The variant URI is the next non-empty, non-comment line.
    let uri: string | null = null;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor].trim();
      if (!candidate || candidate.startsWith("#")) continue;
      uri = candidate;
      index = cursor;
      break;
    }
    if (!uri) continue;
    const absolute = resolveVariantUrl(uri, baseUrl);
    if (!absolute) continue;

    // One option per height: a 720p AV1 and 720p AVC rendition would both
    // read "720p" in the menu, so keep the higher-bandwidth encode only.
    const key = `${resolution.height}`;
    const existing = byKey.get(key);
    if (!existing || bandwidth > existing.bandwidth) {
      byKey.set(key, { height: resolution.height, width: resolution.width, bandwidth, url: absolute, codecs: attributes.CODECS });
    }
  }

  return [...byKey.values()].sort((left, right) => right.height - left.height || right.bandwidth - left.bandwidth);
}

/**
 * Exact CDN variant URL for a download or a token-refresh re-resolve at the
 * given height. Null means "no parsed variant" — the caller keeps its
 * max-guess fallback instead of inventing a URL.
 */
export function variantUrlForHeight(variants: readonly HlsVariant[], height: number): string | null {
  if (!Number.isFinite(height) || height <= 0) return null;
  const wanted = Math.round(height);
  const match = variants.find((variant) => variant.height === wanted && variant.url);
  return match?.url ?? null;
}

/**
 * Same lookup by quality label ("1080p", "720P"). Auto/master labels resolve
 * to null — Auto mounts the master, it never downloads a single rendition.
 */
export function variantUrlForQuality(variants: readonly HlsVariant[], quality?: string | null): string | null {
  const raw = String(quality ?? "").trim().toLowerCase();
  if (!raw || /auto|adaptive|master|original|default/.test(raw)) return null;
  const match = raw.match(/(2160|1440|1080|720|480|360)/);
  if (!match) return null;
  return variantUrlForHeight(variants, Number(match[1]));
}

/**
 * Index of the hls.js level carrying `height`, or -1. Lets the web player
 * switch renditions through the level API (ABR state survives) with a silent
 * URL-swap fallback when the height is unknown.
 */
export function hlsLevelIndexForHeight(levels: readonly { height?: number | null }[], height: number): number {
  if (!Number.isFinite(height) || height <= 0) return -1;
  const wanted = Math.round(height);
  return levels.findIndex((level) => Math.round(Number(level?.height)) === wanted);
}

/**
 * Stable cache key for parsed variants: one entry per master playback URL.
 * The proxy wrapper (with its random `rn`) is part of the key on purpose —
 * different wrappers can carry different headers/tokens.
 */
export function hlsVariantsCacheKey(playbackUrl: string | null | undefined): string | null {
  if (!playbackUrl) return null;
  return playbackUrl;
}

export type VariantsCacheScope = {
  masterUrl?: string | null;
  providerId?: string | null;
  episode?: number | null;
  refreshNonce?: number | null;
};

/**
 * True when the quality effect must re-resolve variants instead of reusing
 * the held menu. Opening the settings sheet changes none of these fields, so
 * a settings open never re-fetches the master; provider / episode / refresh /
 * master changes always do.
 */
export function shouldRefetchVariants(prev: VariantsCacheScope | null, next: VariantsCacheScope): boolean {
  if (!next.masterUrl) return false;
  if (!prev) return true;
  if ((prev.masterUrl ?? null) !== (next.masterUrl ?? null)) return true;
  if ((prev.providerId ?? null) !== (next.providerId ?? null)) return true;
  if ((prev.episode ?? null) !== (next.episode ?? null)) return true;
  if ((prev.refreshNonce ?? 0) !== (next.refreshNonce ?? 0)) return true;
  return false;
}

/**
 * Pure gate for the variant token-expiry guard: a mounted variant URL that
 * 403s with a rotted embedded timestamp earns one master refresh + re-resolve
 * before the player fails over to the next server. Anything else fails over
 * immediately.
 */
export function shouldRefreshMasterOnVariantError(input: { errorDetail?: string | null; variantUrl?: string | null; refreshedAlready: boolean }): boolean {
  if (input.refreshedAlready) return false;
  const url = String(input.variantUrl ?? "");
  if (!url) return false;
  if (!/403|forbidden|BAD_HTTP_STATUS|unauthori/i.test(String(input.errorDetail ?? ""))) return false;
  return hasExpiredEmbeddedToken(url);
}

/**
 * Turns parsed variants into quality options whose selection mounts the
 * variant playlist URL directly — the rendition the provider actually
 * advertises on the Auto URL, not a claimed label or a bitrate hope.
 */
export function buildHlsQualityOptions(
  activeSource: StreamSource,
  variants: HlsVariant[],
  mode: { proxied: boolean; headers?: Record<string, string> },
): WatchQualityOption[] {
  if (variants.length < 2) return [];

  const playbackUrl = (cdnUrl: string) => (mode.proxied ? anirakuProxyUrl(cdnUrl, mode.headers) : cdnUrl);

  return [
    {
      id: "hls-auto",
      label: "Auto",
      requestQuality: "auto",
      source: { ...activeSource, quality: "Auto" },
    },
    ...variants.map((variant) => ({
      id: `hls-${variant.height}-${variant.bandwidth}`,
      label: `${variant.height}p`,
      requestQuality: `${variant.height}p`,
      source: { ...activeSource, url: playbackUrl(variant.url), quality: `${variant.height}p` },
    })),
  ];
}

const DASH_REPRESENTATION = /<Representation\b[^>]*>/g;
const DASH_ATTRIBUTE = /\b(height|bandwidth)="(\d+)"/g;

/**
 * DASH manifests can't be "mounted per rendition" the way HLS variant
 * playlists can — so representations become honest bitrate caps for the
 * player's adaptive engine instead of URL swaps.
 */
export function parseDashRepresentations(text: string): HlsVariant[] {
  const byHeight = new Map<number, HlsVariant>();
  for (const element of text.matchAll(DASH_REPRESENTATION)) {
    const attributes: Record<string, number> = {};
    for (const [, key, rawValue] of element[0].matchAll(DASH_ATTRIBUTE)) {
      attributes[key] = Number.parseInt(rawValue, 10);
    }
    const { height, bandwidth } = attributes;
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(bandwidth) || bandwidth <= 0) continue;
    const existing = byHeight.get(height);
    if (!existing || bandwidth > existing.bandwidth) {
      byHeight.set(height, { height, bandwidth, url: "" });
    }
  }
  return [...byHeight.values()].sort((left, right) => right.height - left.height || right.bandwidth - left.bandwidth);
}

export function buildDashQualityOptions(activeSource: StreamSource, variants: HlsVariant[]): WatchQualityOption[] {
  if (variants.length < 2) return [];
  return [
    { id: "dash-auto", label: "Auto", requestQuality: "auto", maxVideoBitrate: null, isAdaptiveCap: true },
    ...variants.map((variant) => ({
      id: `dash-cap-${variant.height}-${variant.bandwidth}`,
      label: `${variant.height}p`,
      requestQuality: `${variant.height}p`,
      maxVideoBitrate: variant.bandwidth,
      isAdaptiveCap: true,
    })),
  ];
}
