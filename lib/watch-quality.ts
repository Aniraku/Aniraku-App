import type { StreamResponse, StreamSource } from "@/lib/types";
import { isAutoQuality } from "@/lib/watch-engine";

const QUALITY_ORDER = ["auto", "1080p", "720p", "480p", "360p"];

export type WatchQualityOption = {
  id: string;
  label: string;
  requestQuality: string;
  source?: StreamSource;
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

/**
 * Surface only provider-returned quality labels. Expo Video exposes readable
 * adaptive tracks but no writable video-level selector, so an Auto source is
 * changed only through the backend's existing fixed-quality source response.
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

export function selectedWatchQuality(activeSource: StreamSource | null, requestedQuality?: string) {
  if (requestedQuality && requestedQuality !== "auto") return canonicalQuality(requestedQuality);
  return activeSource && !isAutoQuality(activeSource) ? canonicalQuality(activeSource.quality) : "Auto";
}
