import type { Episode } from "@/lib/types";

/**
 * Episode display fallbacks — the pure remainder of the old client-side TMDB
 * resolver. The backend now merges AniZip + TMDB metadata server-side and
 * serves it from `/api/v1/anime/:id/episodes`, so no second network call is
 * made; this only applies the same display guards the merge always applied:
 * only verified TMDB-pattern thumbnails and unique non-generic titles are
 * trusted, missing thumbnails fall back to the title's banner/cover art, and
 * movie rows may take the movie title as their episode label.
 */

export type EpisodeFallbackOptions = {
  fallbackThumbnail?: string | null;
  fallbackTitle?: string | null;
  isMovie?: boolean;
};

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasVerifiedTmdbThumbnail(value: unknown): boolean {
  return /^https:\/\/image\.tmdb\.org\/t\/p\/(?:original|[wh]\d+)\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(text(value));
}

function hasSourceProvidedPoster(value: unknown): boolean {
  return /^https:\/\/[^\s]+$/i.test(text(value));
}

function isGenericEpisodeLabel(value: unknown): boolean {
  return /^(?:(?:episode|ep)\s*)?\d+(?:\s*(?:[·.-]\s*\d+\s*[ps]))?$/i.test(text(value));
}

function trustedAvailability<T extends Episode>(availability: readonly T[]): T[] {
  const entries = Array.isArray(availability) ? availability.filter(Boolean) : [];
  const titleCounts = new Map<string, number>();
  entries.forEach((episode) => {
    const title = text(episode.title);
    if (title) titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  });

  return entries.map((episode, index) => {
    const number = positiveInteger(episode.number) ?? index + 1;
    const title = text(episode.title);
    const verifiedTitle = Boolean(title) && !isGenericEpisodeLabel(title) && titleCounts.get(title) === 1;
    return {
      ...episode,
      number,
      title: verifiedTitle ? title : null,
      thumbnail: verifiedTitle && hasVerifiedTmdbThumbnail(episode.thumbnail) ? text(episode.thumbnail) : null,
      description: null,
    } as T;
  });
}

/**
 * Canonical episode identity stays intact; only display fields are guarded
 * and backfilled. This is exactly the empty-metadata path the old
 * `mergeTmdbEpisodeMetadata` took once the backend began serving the merged
 * AniZip + TMDB result — kept so removing the dead resolver call changes
 * nothing the user can see.
 */
export function applyEpisodeFallbackMetadata<T extends Episode>(
  availability: readonly T[],
  { fallbackThumbnail = "", fallbackTitle = "", isMovie = false }: EpisodeFallbackOptions = {},
): T[] {
  const verifiedFallbackThumbnail = hasSourceProvidedPoster(fallbackThumbnail) ? text(fallbackThumbnail) : null;
  const normalizedFallbackTitle = text(fallbackTitle);
  const movieFallbackTitle = isMovie && normalizedFallbackTitle && !isGenericEpisodeLabel(normalizedFallbackTitle)
    ? normalizedFallbackTitle
    : null;

  return trustedAvailability(availability).map((episode) => ({
    ...episode,
    title: episode.title || movieFallbackTitle,
    thumbnail: episode.thumbnail || verifiedFallbackThumbnail,
  } as T));
}
