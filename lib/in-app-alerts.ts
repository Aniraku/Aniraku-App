import type { Anime } from "@/lib/types";

export type EpisodeAlertMarker = { episode: number; checkedAt: number };

export function availableReleasedEpisode(anime: Anime): number | null {
  if (String(anime.status || "").toUpperCase() !== "RELEASING") return null;
  const nextEpisode = Number(anime.nextAiringEpisode?.episode);
  const candidate = Number.isFinite(nextEpisode) && nextEpisode > 1
    ? nextEpisode - 1
    : Number(anime.episodes || 0);
  return Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

export function shouldCreateEpisodeAlert(marker: EpisodeAlertMarker | undefined, episode: number, now: number, cooldownMs = 21_600_000) {
  if (marker && now - marker.checkedAt < cooldownMs) return false;
  return episode > (marker?.episode || 0);
}
