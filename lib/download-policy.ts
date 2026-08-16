import { getPlaybackType, sourceVerification } from "@/lib/aniraku-api";
import { isAutoQuality, qualityRank } from "@/lib/watch-engine";
import type { StreamSource } from "@/lib/types";

function fileStem(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "aniraku-episode";
}

export function publicDownloadFilename(title: string, episode: number, language: "sub" | "dub", quality: string) {
  return `${fileStem(title)}-ep${String(episode).padStart(2, "0")}-${language}-${fileStem(quality)}.mp4`;
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

export function downloadLabel(source: StreamSource | null) {
  if (!source) return "DIRECT SOURCE REQUIRED";
  return isAutoQuality(source) ? "ORIGINAL DIRECT" : `${source.quality || "DIRECT"} MAX`;
}
