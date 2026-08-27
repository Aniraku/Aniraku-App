import { APP_CONFIG } from "@/lib/app-config";
import type { Episode } from "@/lib/types";

const TMDB_BATCH_SIZE = 100;
const TMDB_BATCH_CONCURRENCY = 3;

type TmdbEpisode = {
  number?: unknown;
  title?: unknown;
  thumbnail?: unknown;
  description?: unknown;
};

type TmdbEpisodePayload = {
  anilistId?: unknown;
  source?: unknown;
  episodes?: TmdbEpisode[];
  mapped?: unknown[];
};

export type TmdbEpisodeMergeOptions = {
  fallbackThumbnail?: string | null;
  fallbackTitle?: string | null;
  isMovie?: boolean;
  mappedNumbers?: unknown[];
};

export type TmdbEpisodeEnrichmentOptions = Omit<TmdbEpisodeMergeOptions, "mappedNumbers"> & {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  baseUrl?: string;
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

function isPublishedEpisodeTitle(value: unknown): boolean {
  const title = text(value);
  return Boolean(title) && !isGenericEpisodeLabel(title) && !/^(?:tba|tbd|untitled|unknown)$/i.test(title);
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

function neutralEpisode<T extends Episode>(episode: T, index: number): T {
  return {
    ...episode,
    number: positiveInteger(episode.number) ?? index + 1,
    title: null,
    thumbnail: null,
    description: null,
  } as T;
}

/**
 * Keeps Aniraku canonical episode identity intact and replaces only display
 * fields when the website resolver returns exactly one verified TMDB record.
 * Ambiguous/missing mapped records become neutral; un-mapped rows retain the
 * existing safe source data. Movie rows may use their title-level art fallback.
 */
export function mergeTmdbEpisodeMetadata<T extends Episode>(
  availability: readonly T[],
  metadata: readonly TmdbEpisode[],
  { fallbackThumbnail = "", fallbackTitle = "", isMovie = false, mappedNumbers = [] }: TmdbEpisodeMergeOptions = {},
): T[] {
  const verifiedFallbackThumbnail = hasSourceProvidedPoster(fallbackThumbnail) ? text(fallbackThumbnail) : null;
  const normalizedFallbackTitle = text(fallbackTitle);
  const verifiedMovieFallbackTitle = isMovie && normalizedFallbackTitle && !isGenericEpisodeLabel(normalizedFallbackTitle)
    ? normalizedFallbackTitle
    : null;
  const exactMappedNumbers = new Set((Array.isArray(mappedNumbers) ? mappedNumbers : [])
    .map(positiveInteger)
    .filter((number): number is number => number !== null));
  const entriesByNumber = new Map<number, TmdbEpisode[]>();
  (Array.isArray(metadata) ? metadata : [])
    .filter((entry) => positiveInteger(entry?.number) !== null && isPublishedEpisodeTitle(entry?.title))
    .forEach((entry) => {
      const number = Number(entry.number);
      const entries = entriesByNumber.get(number) ?? [];
      entries.push(entry);
      entriesByNumber.set(number, entries);
    });
  const byNumber = new Map([...entriesByNumber.entries()]
    .filter(([, entries]) => entries.length === 1)
    .map(([number, [entry]]) => [number, entry]));

  return trustedAvailability(availability).map((episode, index) => {
    const neutral = neutralEpisode(episode, index);
    const tmdb = byNumber.get(neutral.number);
    if (!tmdb) {
      const exactMappingHadNoRecord = exactMappedNumbers.has(neutral.number);
      return {
        ...(exactMappingHadNoRecord ? neutral : episode),
        title: exactMappingHadNoRecord ? verifiedMovieFallbackTitle : (episode.title || verifiedMovieFallbackTitle),
        thumbnail: exactMappingHadNoRecord ? verifiedFallbackThumbnail : (episode.thumbnail || verifiedFallbackThumbnail),
      } as T;
    }
    return {
      ...neutral,
      title: text(tmdb.title) || episode.title,
      thumbnail: hasVerifiedTmdbThumbnail(tmdb.thumbnail) ? text(tmdb.thumbnail) : verifiedFallbackThumbnail,
      description: text(tmdb.description) || null,
    } as T;
  });
}

/**
 * Resolves every canonical position in bounded groups. The production website
 * owns AniBridge mapping, TMDB credentials, response validation, and caching;
 * the native client carries only its public HTTPS resolver URL.
 */
export async function enrichEpisodesWithTmdb<T extends Episode>(
  anilistId: number,
  availability: readonly T[],
  {
    fetchImpl = fetch,
    signal,
    baseUrl = APP_CONFIG.tmdbEpisodesResolverUrl,
    fallbackThumbnail = "",
    fallbackTitle = "",
    isMovie = false,
  }: TmdbEpisodeEnrichmentOptions = {},
): Promise<T[]> {
  const id = positiveInteger(anilistId);
  const fallback = { fallbackThumbnail, fallbackTitle, isMovie };
  const baseline = mergeTmdbEpisodeMetadata(availability, [], fallback);
  const resolverBaseUrl = text(baseUrl).replace(/\/+$/, "");
  if (!id || !baseline.length || !resolverBaseUrl) return baseline;

  const batches: number[][] = [];
  for (let offset = 0; offset < baseline.length; offset += TMDB_BATCH_SIZE) {
    batches.push(baseline.slice(offset, offset + TMDB_BATCH_SIZE).map((episode) => episode.number));
  }
  const requestBatch = async (numbers: number[]): Promise<TmdbEpisodePayload | null> => {
    const target = `${resolverBaseUrl}?anilistId=${encodeURIComponent(id)}&episodes=${encodeURIComponent(numbers.join(","))}`;
    try {
      const response = await fetchImpl(target, { headers: { Accept: "application/json" }, signal });
      const payload = await response.json().catch(() => ({})) as TmdbEpisodePayload;
      if (!response.ok || Number(payload.anilistId) !== id || payload.source !== "tmdb") return null;
      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      return null;
    }
  };

  const metadata: TmdbEpisode[] = [];
  const mappedNumbers: unknown[] = [];
  for (let offset = 0; offset < batches.length; offset += TMDB_BATCH_CONCURRENCY) {
    const payloads = await Promise.all(batches.slice(offset, offset + TMDB_BATCH_CONCURRENCY).map(requestBatch));
    if (payloads.some((payload) => !payload)) return baseline;
    for (const payload of payloads) {
      if (Array.isArray(payload?.episodes)) metadata.push(...payload.episodes);
      if (Array.isArray(payload?.mapped)) mappedNumbers.push(...payload.mapped);
    }
  }
  return mergeTmdbEpisodeMetadata(availability, metadata, { ...fallback, mappedNumbers });
}
