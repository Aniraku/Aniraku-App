import { APP_CONFIG } from "@/lib/app-config";
import type { AiringSchedulePage, Anime, AnimePage } from "@/lib/types";

const CLIENT_REQUEST_INTERVAL_MS = process.env.VITEST ? 0 : 2_100;
const REQUEST_CACHE_TTL_MS = 5 * 60_000;
const STALE_CACHE_TTL_MS = 30 * 60_000;
const responseCache = new Map<string, { expiresAt: number; staleUntil: number; value: unknown }>();
const inFlightRequests = new Map<string, Promise<unknown>>();
let nextAniListRequestAt = 0;
let blockedUntil = 0;

export class AniListRateLimitError extends Error {
  readonly retryAfterMs: number | null;

  constructor(retryAfterMs: number | null) {
    const retrySeconds = retryAfterMs === null ? null : Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(retrySeconds ? `AniList is busy. Try again in ${retrySeconds} seconds.` : "AniList is busy. Try again in a moment.");
    this.name = "AniListRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class AniListUnavailableError extends Error {
  readonly status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "AniListUnavailableError";
    this.status = status;
  }
}

export function isAniListRateLimitError(error: unknown): error is AniListRateLimitError {
  return error instanceof AniListRateLimitError;
}

export function isAniListUnavailableError(error: unknown): error is AniListUnavailableError {
  return error instanceof AniListUnavailableError;
}

function getRetryAfterMs(headers?: Headers): number | null {
  const retryAfter = headers?.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  const rateLimitReset = Number(headers?.get("x-ratelimit-reset"));
  if (Number.isFinite(rateLimitReset) && rateLimitReset > 0) return Math.max(0, rateLimitReset * 1000 - Date.now());
  return null;
}

function updateAniListRateState(headers?: Headers) {
  const remaining = Number(headers?.get("x-ratelimit-remaining"));
  const limit = Number(headers?.get("x-ratelimit-limit"));
  if (Number.isFinite(remaining) && remaining <= 2) {
    nextAniListRequestAt = Math.max(nextAniListRequestAt, Date.now() + (Number.isFinite(limit) && limit <= 30 ? 2_500 : 1_200));
  }
  const retryAfterMs = getRetryAfterMs(headers);
  if (retryAfterMs !== null && remaining === 0) blockedUntil = Math.max(blockedUntil, Date.now() + retryAfterMs);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));
}

async function waitForAniListSlot() {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextAniListRequestAt, blockedUntil);
  nextAniListRequestAt = scheduledAt + CLIENT_REQUEST_INTERVAL_MS;
  if (scheduledAt > now) await sleep(scheduledAt - now);
}

const fields = `
  id type title { romaji english native } coverImage { large extraLarge color } bannerImage
  description(asHtml: false) genres format status episodes duration averageScore popularity
  season seasonYear isAdult idMal nextAiringEpisode { episode airingAt }
  trailer { id site thumbnail }
`;

const detailFields = `${fields}
  relations {
    edges {
      relationType
      node { ${fields} }
    }
  }
`;

const pageQuery = `query MediaPage($page: Int!, $perPage: Int!, $sort: [MediaSort], $search: String, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $genre: String, $format: MediaFormat) {
  Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage total } media(type: ANIME, isAdult: false, sort: $sort, search: $search, status: $status, season: $season, seasonYear: $seasonYear, genre: $genre, format: $format) { ${fields} } }
}`;

const homeQuery = `query Home {
  trending: Page(page: 1, perPage: 12) { media(type: ANIME, isAdult: false, sort: [TRENDING_DESC, POPULARITY_DESC]) { ${fields} } }
  popular: Page(page: 1, perPage: 12) { media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) { ${fields} } }
  upcoming: Page(page: 1, perPage: 12) { media(type: ANIME, isAdult: false, status: NOT_YET_RELEASED, sort: [POPULARITY_DESC]) { ${fields} } }
}`;

export type AiringScheduleWindow = { startAt: number; endAt: number };

const airingScheduleQuery = `query AiringSchedule($page: Int!, $perPage: Int!, $startAt: Int, $endAt: Int) {
  Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage total } airingSchedules(notYetAired: true, airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME]) { airingAt episode media { ${fields} } } }
}`;

async function request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const providedVariables = Object.fromEntries(Object.entries(variables).filter(([, value]) => value !== undefined));
  const requestBody = JSON.stringify({ query, variables: providedVariables });
  const cacheKey = requestBody;
  const now = Date.now();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value as T;
  const staleValue = cached && cached.staleUntil > now ? cached.value as T : undefined;
  if (cached && cached.staleUntil <= now) responseCache.delete(cacheKey);

  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) return existingRequest as Promise<T>;

  const requestPromise = (async () => {
    try {
      await waitForAniListSlot();
      const response = await fetch(APP_CONFIG.anilistGraphqlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: requestBody,
      });
      const rawPayload = await response.text();
      let payload: { data?: T; errors?: Array<{ message?: string }> } = {};
      try { payload = rawPayload ? JSON.parse(rawPayload) : {}; } catch { throw new Error("AniList returned an unreadable response."); }
      updateAniListRateState(response.headers);
      if (response.status === 429) throw new AniListRateLimitError(getRetryAfterMs(response.headers));
      const upstreamMessage = payload.errors?.[0]?.message || `AniList is unavailable (${response.status}).`;
      if (response.status === 403 && /temporarily disabled|severe stability issues/i.test(upstreamMessage)) {
        throw new AniListUnavailableError("AniList is temporarily unavailable due to an upstream stability issue. Try again shortly.", response.status);
      }
      if (!response.ok) throw new Error(upstreamMessage);
      if (payload.errors?.length) throw new Error(payload.errors[0]?.message || "AniList returned an invalid response.");
      const data = payload.data as T;
      responseCache.set(cacheKey, { expiresAt: Date.now() + REQUEST_CACHE_TTL_MS, staleUntil: Date.now() + STALE_CACHE_TTL_MS, value: data });
      return data;
    } catch (error) {
      if (staleValue !== undefined) return staleValue;
      throw error;
    }
  })();
  inFlightRequests.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

export function resetAniListRequestStateForTests() {
  responseCache.clear();
  inFlightRequests.clear();
  nextAniListRequestAt = 0;
  blockedUntil = 0;
}

export async function getAnimePage(options: {
  page?: number;
  perPage?: number;
  sort?: string[];
  search?: string;
  status?: string;
  season?: string;
  seasonYear?: number;
  genre?: string;
  format?: string;
} = {}): Promise<AnimePage> {
  const data = await request<{ Page: AnimePage }>(pageQuery, {
    page: options.page ?? 1,
    perPage: options.perPage ?? 20,
    sort: options.sort ?? ["POPULARITY_DESC"],
    search: options.search,
    status: options.status,
    season: options.season,
    seasonYear: options.seasonYear,
    genre: options.genre,
    format: options.format,
  });
  return data.Page;
}

export async function getHomeAnime() {
  const data = await request<{ trending: AnimePage; popular: AnimePage; upcoming: AnimePage }>(homeQuery);
  return { trending: data.trending.media, popular: data.popular.media, upcoming: data.upcoming.media };
}

export async function getAnimeById(id: number): Promise<Anime> {
  const query = `query Anime($id: Int!) { Media(id: $id, type: ANIME) { ${detailFields} } }`;
  const data = await request<{ Media: Anime }>(query, { id });
  return data.Media;
}

/** Watch.jsx uses AniList's MAL mapping to fetch AniSkip timestamps. */
export async function getMalIdByAnimeId(id: number) {
  const query = `query AnimeMalId($id: Int!) { Media(id: $id, type: ANIME) { idMal } }`;
  const data = await request<{ Media?: { idMal?: number | null } }>(query, { id });
  const malId = Number(data.Media?.idMal);
  return Number.isInteger(malId) && malId > 0 ? malId : null;
}

/** Prefer metadata already returned by Aniraku before using the AniList fallback lookup. */
export function getKnownMalId(anime: Pick<Anime, "idMal" | "malId" | "mal_id" | "myAnimeListId"> | null | undefined) {
  const value = anime?.idMal ?? anime?.malId ?? anime?.mal_id ?? anime?.myAnimeListId;
  const malId = Number(value);
  return Number.isInteger(malId) && malId > 0 ? malId : null;
}

export async function getAiringSchedule(page = 1, perPage = 40, window?: AiringScheduleWindow): Promise<AiringSchedulePage> {
  const data = await request<{ Page: AiringSchedulePage }>(airingScheduleQuery, { page, perPage, startAt: window?.startAt, endAt: window?.endAt });
  return data.Page;
}
