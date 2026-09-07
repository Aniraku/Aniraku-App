import { APP_CONFIG } from "@/lib/app-config";
import type { Anime, AnimePage } from "@/lib/types";

// ---------------------------------------------------------------------------
// Jikan v4 client with aggressive caching, request coalescing, and graceful
// degradation.  The public Jikan instance allows 3 req/s and 60 req/min.
// Cached responses are FREE (don't count).  We exploit this by caching
// aggressively and deduplicating identical in-flight requests.
// ---------------------------------------------------------------------------

const JIKAN_BASE = APP_CONFIG.jikanBaseUrl;

// Cache tiers — static data lives much longer than search results.
const STATIC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;   // 24 h  (top/popular/schedules)
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;          // 5 min (search results)
const DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;         // 30 min (single anime detail)
const STALE_WINDOW_MS = 60 * 60 * 1000;             // 1 h   (serve stale while revalidating)

// Minimum gap between consecutive Jikan requests (350 ms keeps us under 3/s).
const MIN_REQUEST_GAP_MS = 350;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

type CacheEntry<T> = { value: T; expiresAt: number; staleUntil: number };

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
let nextRequestAt = 0;
let blockedUntil = 0;

function sleep(ms: number) {
  return new Promise<void>((r) => globalThis.setTimeout(r, ms));
}

async function waitForSlot() {
  const now = Date.now();
  const scheduled = Math.max(now, nextRequestAt, blockedUntil);
  nextRequestAt = scheduled + MIN_REQUEST_GAP_MS;
  if (scheduled > now) await sleep(scheduled - now);
}

// ---------------------------------------------------------------------------
// Core fetcher
// ---------------------------------------------------------------------------

async function jikanFetch<T>(path: string, cacheTtlMs: number): Promise<T> {
  const url = `${JIKAN_BASE}${path}`;
  const now = Date.now();
  const cached = responseCache.get(url) as CacheEntry<T> | undefined;

  // Return fresh cache
  if (cached && cached.expiresAt > now) return cached.value;

  // Serve stale while revalidating in background
  const staleValue = cached && cached.staleUntil > now ? cached.value : undefined;

  // Deduplicate in-flight requests
  const existing = inFlight.get(url) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      await waitForSlot();
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      // Rate limited — serve stale silently
      if (res.status === 429) {
        blockedUntil = Math.max(blockedUntil, Date.now() + 60_000);
        if (staleValue !== undefined) return staleValue;
        throw new Error("Jikan is busy. Try again in a moment.");
      }

      // Upstream errors — serve stale if available
      if (!res.ok) {
        if (staleValue !== undefined) return staleValue;
        throw new Error(`Jikan returned ${res.status}`);
      }

      const json = (await res.json()) as Record<string, unknown>;
      const data: T = (json.data as T) ?? (json as unknown as T);

      // Determine cache TTL — use longer TTL for non-search endpoints
      const ttl = cacheTtlMs;
      const entry: CacheEntry<T> = {
        value: data,
        expiresAt: Date.now() + ttl,
        staleUntil: Date.now() + ttl + STALE_WINDOW_MS,
      };
      responseCache.set(url, entry);

      // Evict stale entries when cache grows large
      if (responseCache.size > 300) {
        const cut = Date.now();
        for (const [k, v] of responseCache) {
          if (v.staleUntil <= cut) responseCache.delete(k);
        }
      }

      return data;
    } catch (err) {
      // Network/parse error — serve stale if available
      if (staleValue !== undefined) return staleValue;
      throw err;
    }
  })();

  inFlight.set(url, promise as Promise<unknown>);
  try {
    return await promise;
  } finally {
    inFlight.delete(url);
  }
}

// ---------------------------------------------------------------------------
// Jikan response types (subset we actually use)
// ---------------------------------------------------------------------------

type JikanTitles = { type: string; title: string }[];

type JikanAnime = {
  mal_id: number;
  url: string;
  images: {
    jpg: { image_url: string; small_image_url: string; large_image_url: string };
    webp: { image_url: string; small_image_url: string; large_image_url: string };
  };
  trailer: { youtube_id: string | null; url: string | null; embed_url: string | null } | null;
  approved: boolean;
  titles: JikanTitles;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  title_synonyms: string[];
  type: string;
  source: string;
  episodes: number | null;
  status: string;
  airing: boolean;
  aired: { from: string | null; to: string | null };
  duration: string;
  rating: string | null;
  score: number | null;
  scored_by: number | null;
  rank: number;
  popularity: number;
  members: number;
  favorites: number;
  synopsis: string | null;
  background: string | null;
  season: string | null;
  year: number | null;
  broadcast: { day: string; time: string; timezone: string; string: string } | null;
  producers: { mal_id: number; name: string }[];
  licensors: { mal_id: number; name: string }[];
  studios: { mal_id: number; name: string }[];
  genres: { mal_id: number; name: string }[];
  explicit_genres: { mal_id: number; name: string }[];
  themes: { mal_id: number; name: string }[];
  demographics: { mal_id: number; name: string }[];
  relations?: {
    relation: string;
    entry: { mal_id: number; type: string; name: string; url: string }[];
  }[];
};

type JikanPage<T> = {
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: { count: number; total: number; per_page: number };
  };
  data: T[];
};

// ---------------------------------------------------------------------------
// Adapter: Jikan → Anime (matches our existing type)
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, Anime["status"]> = {
  "Currently Airing": "RELEASING",
  "Finished Airing": "FINISHED",
  "Not yet aired": "NOT_YET_RELEASED",
};

const TYPE_MAP: Record<string, Anime["format"]> = {
  TV: "TV",
  Movie: "MOVIE",
  OVA: "OVA",
  ONA: "ONA",
  Special: "SPECIAL",
  Music: "MUSIC",
  tv: "TV",
  movie: "MOVIE",
  ova: "OVA",
  ona: "ONA",
  special: "SPECIAL",
  music: "MUSIC",
};

const SEASON_MAP: Record<string, Anime["season"]> = {
  winter: "WINTER",
  spring: "SPRING",
  summer: "SUMMER",
  fall: "FALL",
};

function adaptAnime(j: JikanAnime): Anime {
  const titleObj = j.titles?.find((t) => t.type === "Japanese");
  return {
    id: j.mal_id,
    type: "ANIME",
    title: {
      romaji: j.title || null,
      english: j.title_english || null,
      native: j.title_japanese || titleObj?.title || null,
    },
    coverImage: {
      large: j.images?.jpg?.large_image_url || null,
      extraLarge: j.images?.jpg?.image_url || null,
      color: null,
    },
    bannerImage: null,
    description: j.synopsis || null,
    genres: [
      ...(j.genres || []).map((g) => g.name),
      ...(j.explicit_genres || []).map((g) => g.name),
      ...(j.themes || []).map((t) => t.name),
      ...(j.demographics || []).map((d) => d.name),
    ],
    format: TYPE_MAP[j.type] || j.type || null,
    status: STATUS_MAP[j.status] || j.status || null,
    episodes: j.episodes || null,
    duration: j.duration ? parseInt(j.duration, 10) || null : null,
    averageScore: j.score || null,
    popularity: j.popularity || j.members || null,
    season: j.season ? SEASON_MAP[j.season] || null : null,
    seasonYear: j.year || null,
    nextAiringEpisode: null,
    isAdult: /R-17|Hentai|R\+|Rx/i.test(j.rating || ""),
    idMal: j.mal_id,
    malId: j.mal_id,
    mal_id: j.mal_id,
    myAnimeListId: j.mal_id,
    relations: j.relations
      ? {
          edges: j.relations.flatMap((r) =>
            r.entry
              .filter((e) => e.type === "anime")
              .map((e) => ({
                relationType: r.relation.toUpperCase() as "ADAPTATION" | "ALTERNATIVE" | "CHARACTER" | "COMPILATION" | "CONTAINS" | "OTHER" | "PARENT" | "PREQUEL" | "SEQUEL" | "SIDE_STORY" | "SOURCE" | "SPIN_OFF" | "SUMMARY" | "VERSION",
                node: {
                  id: e.mal_id,
                  title: { romaji: e.name, english: null, native: null },
                  coverImage: { large: null, extraLarge: null, color: null },
                } as Anime,
              }))
          ),
        }
      : null,
    trailer: j.trailer?.youtube_id
      ? { id: j.trailer.youtube_id, site: "youtube", thumbnail: null }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Public API — mirrors the signatures screens already expect
// ---------------------------------------------------------------------------

export async function getMalHomeAnime(): Promise<{ trending: Anime[]; popular: Anime[]; upcoming: Anime[] }> {
  const [trending, popular, upcoming] = await Promise.all([
    jikanFetch<JikanAnime[]>("/v4/top/anime?filter=bypopularity&limit=12", STATIC_CACHE_TTL_MS),
    jikanFetch<JikanAnime[]>("/v4/top/anime?filter=bypopularity&limit=12&page=2", STATIC_CACHE_TTL_MS),
    jikanFetch<JikanAnime[]>("/v4/top/anime?filter=upcoming&limit=12", STATIC_CACHE_TTL_MS),
  ]);
  return {
    trending: (trending || []).map(adaptAnime),
    popular: (popular || []).map(adaptAnime),
    upcoming: (upcoming || []).map(adaptAnime),
  };
}

export async function getMalAnimePage(options: {
  page?: number;
  perPage?: number;
  search?: string;
  genre?: string;
  status?: string;
  format?: string;
  season?: string;
  seasonYear?: number;
  sort?: string[];
} = {}): Promise<AnimePage> {
  const params = new URLSearchParams();
  params.set("page", String(options.page ?? 1));
  params.set("limit", String(Math.min(options.perPage ?? 20, 25)));

  // Search
  if (options.search) params.set("q", options.search);

  // Genre (Jikan uses numeric IDs, but we accept names for compatibility)
  if (options.genre) {
    const genreId = GENRE_NAME_TO_ID[options.genre.toLowerCase()];
    if (genreId) params.set("genre", String(genreId));
  }

  // Status mapping
  const statusMap: Record<string, string> = {
    RELEASING: "airing",
    FINISHED: "complete",
    NOT_YET_RELEASED: "upcoming",
    airing: "airing",
    complete: "complete",
    upcoming: "upcoming",
  };
  if (options.status) {
    const malStatus = statusMap[options.status];
    if (malStatus) params.set("status", malStatus);
  }

  // Type mapping
  const typeMap: Record<string, string> = {
    TV: "tv",
    MOVIE: "movie",
    OVA: "ova",
    ONA: "ona",
    SPECIAL: "special",
  };
  if (options.format) {
    const malType = typeMap[options.format];
    if (malType) params.set("type", malType);
  }

  // Season
  if (options.season && options.seasonYear) {
    params.set("start_date", `${options.seasonYear}-01-01`);
    params.set("order_by", "start_date");
    params.set("sort", "desc");
  }

  // Sort mapping
  const sortMap: Record<string, string> = {
    POPULARITY_DESC: "members",
    TRENDING_DESC: "members",
    SCORE_DESC: "score",
    START_DATE_DESC: "start_date",
    SEARCH_MATCH: "score",
  };
  if (options.sort?.[0]) {
    const orderBy = sortMap[options.sort[0]];
    if (orderBy) {
      params.set("order_by", orderBy);
      params.set("sort", "desc");
    }
  }

  // Default sort
  if (!params.has("order_by")) {
    params.set("order_by", "members");
    params.set("sort", "desc");
  }

  // Always filter out adult content
  params.set("sfw", "true");

  const qs = params.toString();
  const cacheTtl = options.search ? SEARCH_CACHE_TTL_MS : STATIC_CACHE_TTL_MS;
  const page = await jikanFetch<JikanPage<JikanAnime>>(`/v4/anime?${qs}`, cacheTtl);

  return {
    pageInfo: {
      currentPage: page.pagination?.current_page ?? options.page ?? 1,
      hasNextPage: page.pagination?.has_next_page ?? false,
      total: page.pagination?.items?.total ?? null,
    },
    media: (page.data || []).map(adaptAnime),
  };
}

export async function getMalAnimeById(id: number): Promise<Anime> {
  const jikan = await jikanFetch<JikanAnime>(`/v4/anime/${id}/full`, DETAIL_CACHE_TTL_MS);
  return adaptAnime(jikan);
}

export async function getMalAiringSchedule(): Promise<{ pageInfo: { currentPage: number; hasNextPage: boolean; total: number | null }; airingSchedules: { media: Anime; episode: number; airingAt: number }[] }> {
  const data = await jikanFetch<JikanAnime[]>(`/v4/schedules?limit=25&rf=true`, STATIC_CACHE_TTL_MS);
  // Jikan schedules return currently airing anime with broadcast info
  // We approximate the next episode time from broadcast data
  const now = Date.now();
  const items = (data || [])
    .filter((a) => a.airing)
    .map((a) => {
      const anime = adaptAnime(a);
      // Approximate next airing from broadcast schedule
      const broadcast = a.broadcast;
      let airingAt = now;
      if (broadcast?.day) {
        const dayMap: Record<string, number> = {
          Mondays: 1, Tuesdays: 2, Wednesdays: 3, Thursdays: 4,
          Fridays: 5, Saturdays: 6, Sundays: 0,
        };
        const targetDay = dayMap[broadcast.day];
        if (targetDay !== undefined) {
          const d = new Date();
          const diff = (targetDay - d.getDay() + 7) % 7 || 7;
          d.setDate(d.getDate() + diff);
          const [h, m] = (broadcast.time || "00:00").split(":").map(Number);
          d.setHours(h || 0, m || 0, 0, 0);
          airingAt = Math.floor(d.getTime() / 1000);
        }
      }
      return {
        media: anime,
        episode: 1,
        airingAt,
      };
    })
    .sort((a, b) => a.airingAt - b.airingAt)
    .slice(0, 50);
  return {
    pageInfo: { currentPage: 1, hasNextPage: false, total: items.length },
    airingSchedules: items,
  };
}

/** Search AniList for an anime by title to get the AniList ID (for streaming). */
export async function resolveAniListId(malAnime: Anime): Promise<number | null> {
  try {
    // Only attempt if AniList is reachable
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const title = malAnime.title.english || malAnime.title.romaji || "";
    if (!title) return null;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query ($search: String) { Media(search: $search, type: ANIME) { id } }`,
        variables: { search: title },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.Media?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Genre name → ID mapping (Jikan uses numeric IDs)
// ---------------------------------------------------------------------------

const GENRE_NAME_TO_ID: Record<string, number> = {
  action: 1,
  adventure: 2,
  cars: 3,
  comedy: 4,
  "avant garde": 5,
  demons: 6,
  mystery: 7,
  drama: 8,
  ecchi: 9,
  fantasy: 10,
  game: 11,
  hentai: 12,
  "historical": 13,
  horror: 14,
  "kids": 15,
  "martial arts": 17,
  mecha: 18,
  music: 19,
  parody: 20,
  samurai: 21,
  school: 22,
  "sci-fi": 24,
  shoujo: 25,
  "shoujo ai": 26,
  shounen: 27,
  "shounen ai": 28,
  "slice of life": 36,
  space: 29,
  sports: 30,
  "super power": 31,
  supernatural: 37,
  thriller: 41,
  vampire: 33,
};

export function isMalRateLimitError(error: unknown): boolean {
  return error instanceof Error && /busy|rate.?limit|429|try again/i.test(error.message);
}

export function resetMalRequestStateForTests() {
  responseCache.clear();
  inFlight.clear();
  nextRequestAt = 0;
  blockedUntil = 0;
}
