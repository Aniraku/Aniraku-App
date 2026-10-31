import type { StreamResponse, StreamSource } from "@/lib/types";
import { isAutoQuality, nativeSources } from "@/lib/watch-engine";

const QUALITY_ORDER = ["auto", "2160p", "1440p", "1080p", "720p", "480p", "360p"];

export type WatchQualityOption = {
  id: string;
  label: string;
  requestQuality: string;
  source?: StreamSource;
  /** Android-only local ExoPlayer ceiling for an actual adaptive variant. */
  maxVideoBitrate?: number | null;
  isAdaptiveCap?: boolean;
};

export type LoadedVideoTrackLike = {
  bitrate?: number | null;
  isSupported?: boolean;
  size?: { height?: number | null } | null;
};

function canonicalQuality(value?: string) {
  const raw = String(value || "").trim();
  if (!raw || /auto|adaptive|master|original|default/i.test(raw)) return "Auto";
  const match = raw.match(/(2160|1440|1080|720|480|360)\s*p?/i);
  return match ? `${match[1]}p` : raw;
}

function rank(label: string) {
  const index = QUALITY_ORDER.indexOf(label.toLowerCase());
  return index < 0 ? QUALITY_ORDER.length : index;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Surface provider-returned quality labels for fixed source switching. These
 * options retain the existing Direct → Proxy → Embed source behavior.
 */
export function watchQualityOptions(response: StreamResponse | null, activeSource: StreamSource | null): WatchQualityOption[] {
  const labels = [...(response?.qualities ?? []), ...(response?.sources ?? []).map((source) => source.quality || "Auto"), activeSource?.quality || "Auto"];
  const seen = new Set<string>();
  return labels.map(canonicalQuality).filter((label) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => rank(left) - rank(right)).map((label) => ({
    id: label.toLowerCase(),
    label,
    requestQuality: label.toLowerCase() === "auto" ? "auto" : label,
    source: (response?.sources ?? []).find((source) => canonicalQuality(source.quality) === label),
  }));
}

/**
 * Non-HLS quality menu built from what the provider ACTUALLY returned: one
 * chip per distinct real source (mounted directly on selection — no
 * re-request gamble), Auto on top, and provider-claimed labels that have no
 * matching source trailing behind (they keep the existing quality
 * re-request fallback). The progressive playfield has no master manifest to
 * parse, so the sources themselves are the honest quality list.
 */
export function directSourceQualityOptions(response: StreamResponse | null, activeSource: StreamSource | null): WatchQualityOption[] {
  const backed = new Map<string, WatchQualityOption>();
  for (const source of nativeSources(response ?? { sources: [] })) {
    const label = canonicalQuality(source.quality);
    const key = label.toLowerCase();
    if (backed.has(key)) continue;
    backed.set(key, {
      id: `src-${key}`,
      label,
      requestQuality: key === "auto" ? "auto" : label,
      source,
    });
  }
  if (backed.size === 0) return [];

  const autoBacked = backed.get("auto");
  const autoOption: WatchQualityOption = autoBacked
    ? { ...autoBacked, id: "src-auto", label: "Auto" }
    : { id: "src-auto", label: "Auto", requestQuality: "auto", source: activeSource ?? undefined };
  const fixed = [...backed.values()]
    .filter((option) => option.label.toLowerCase() !== "auto")
    .sort((left, right) => rank(left.label) - rank(right.label));
  const claimed = watchQualityOptions(response, activeSource).filter(
    (option) => option.label.toLowerCase() !== "auto" && !option.source && !backed.has(option.label.toLowerCase()),
  );
  return [autoOption, ...fixed, ...claimed];
}

/**
 * Builds Android-only adaptive controls from variants the player has actually
 * loaded. A cap is a bitrate ceiling, not a promise of a forced resolution.
 */
export function adaptiveBitrateCapOptions(activeSource: StreamSource | null, tracks: readonly LoadedVideoTrackLike[]): WatchQualityOption[] {
  if (!activeSource || !isAutoQuality(activeSource)) return [];

  const ceilingByHeight = new Map<number, number>();
  for (const track of tracks) {
    if (track.isSupported === false) continue;
    const height = track.size?.height;
    const bitrate = track.bitrate;
    if (!isPositiveFinite(height) || !isPositiveFinite(bitrate)) continue;
    const normalizedHeight = Math.round(height);
    ceilingByHeight.set(normalizedHeight, Math.max(ceilingByHeight.get(normalizedHeight) ?? 0, Math.round(bitrate)));
  }

  const variants = [...ceilingByHeight.entries()]
    .map(([height, bitrate]) => ({ height, bitrate }))
    .sort((left, right) => right.height - left.height || right.bitrate - left.bitrate);

  if (variants.length < 2) return [];

  return [
    { id: "adaptive-auto", label: "Auto", requestQuality: "auto", maxVideoBitrate: null, isAdaptiveCap: true },
    ...variants.map((variant) => ({
      id: `adaptive-cap-${variant.height}-${variant.bitrate}`,
      label: `${variant.height}p cap`,
      requestQuality: "auto",
      maxVideoBitrate: variant.bitrate,
      isAdaptiveCap: true,
    })),
  ];
}

export function selectedWatchQuality(activeSource: StreamSource | null, requestedQuality?: string) {
  if (requestedQuality && requestedQuality !== "auto") return canonicalQuality(requestedQuality);
  return activeSource && !isAutoQuality(activeSource) ? canonicalQuality(activeSource.quality) : "Auto";
}
