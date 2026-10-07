/**
 * Shared search/browse filter model used by both search screens
 * (app/(tabs)/catalog.tsx and app/search.tsx) so their genre lists and
 * filter enums can no longer diverge.
 *
 * Every value here is validated against the AniList allowlists in
 * lib/anilist.ts (VALID_MEDIA_SORTS / VALID_MEDIA_STATUSES /
 * VALID_MEDIA_FORMATS) — an unknown enum slot fails the whole GraphQL
 * request with a 400, so only allowlisted values are exported.
 */

export const QUICK_GENRES = [
  "Action",
  "Romance",
  "Comedy",
  "Fantasy",
  "Sci-Fi",
  "Horror",
  "Slice of Life",
  "Sports",
] as const;

export type FilterOption = { label: string; value: string };

export const SORT_OPTIONS: FilterOption[] = [
  { label: "Trending", value: "TRENDING_DESC" },
  { label: "Popular", value: "POPULARITY_DESC" },
  { label: "Top rated", value: "SCORE_DESC" },
  { label: "Newest", value: "START_DATE_DESC" },
  { label: "A → Z", value: "TITLE_ROMAJI" },
];

export const STATUS_OPTIONS: FilterOption[] = [
  { label: "Airing", value: "RELEASING" },
  { label: "Finished", value: "FINISHED" },
  { label: "Not yet aired", value: "NOT_YET_RELEASED" },
  { label: "Hiatus", value: "HIATUS" },
];

export const FORMAT_OPTIONS: FilterOption[] = [
  { label: "TV", value: "TV" },
  { label: "Movie", value: "MOVIE" },
  { label: "OVA", value: "OVA" },
  { label: "ONA", value: "ONA" },
  { label: "Special", value: "SPECIAL" },
  { label: "TV short", value: "TV_SHORT" },
];

export const SEASON_OPTIONS: FilterOption[] = [
  { label: "Winter", value: "WINTER" },
  { label: "Spring", value: "SPRING" },
  { label: "Summer", value: "SUMMER" },
  { label: "Fall", value: "FALL" },
];

/** Current year first, then the 11 previous seasons. */
export const YEAR_OPTIONS: FilterOption[] = (() => {
  const current = new Date().getFullYear();
  const options: FilterOption[] = [];
  for (let year = current; year > current - 12; year--) {
    options.push({ label: String(year), value: String(year) });
  }
  return options;
})();

export type SearchFilters = {
  sort: string | null;
  status: string | null;
  format: string | null;
  season: string | null;
  year: string | null;
};

export const EMPTY_FILTERS: SearchFilters = { sort: null, status: null, format: null, season: null, year: null };

export function countActiveFilters(filters: SearchFilters): number {
  return [filters.sort, filters.status, filters.format, filters.season, filters.year].filter(Boolean).length;
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return countActiveFilters(filters) > 0;
}

/** Stable cache-key fragment for the active filters. */
export function filterSignature(filters: SearchFilters): string {
  return [filters.sort, filters.status, filters.format, filters.season, filters.year].map((v) => v ?? "").join("|");
}

/** Coerce an unknown persisted/param value onto the allowlisted option set. */
export function coerceFilterValue(options: FilterOption[], raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  return options.some((option) => option.value === value) ? value : null;
}

export function coerceFilters(raw: Partial<Record<keyof SearchFilters, unknown>> | null | undefined): SearchFilters {
  if (!raw) return { ...EMPTY_FILTERS };
  return {
    sort: coerceFilterValue(SORT_OPTIONS, raw.sort),
    status: coerceFilterValue(STATUS_OPTIONS, raw.status),
    format: coerceFilterValue(FORMAT_OPTIONS, raw.format),
    season: coerceFilterValue(SEASON_OPTIONS, raw.season),
    year: coerceFilterValue(YEAR_OPTIONS, raw.year),
  };
}
