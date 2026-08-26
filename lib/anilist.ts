import { APP_CONFIG } from "@/lib/app-config";
import type { AiringSchedulePage, Anime, AnimePage } from "@/lib/types";

const REQUEST_CACHE_TTL_MS = 2 * 60_000;
const MAL_API_BASE_URL = "https://api.myanimelist.net/v2";
const MAL_FIELDS = "alternative_titles,mean,popularity,num_list_users,media_type,status,num_episodes,start_season,average_episode_duration,rating,pictures,genres,synopsis";
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export class MetadataRateLimitError extends Error {
  readonly retryAfterMs: number | null;

  constructor(retryAfterMs: number | null) {
    const retrySeconds = retryAfterMs === null ? null : Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(retrySeconds ? `Metadata is busy. Try again in ${retrySeconds} seconds.` : "Metadata is busy. Try again in a moment.");
    this.name = "MetadataRateLimitError";
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

export function isMetadataRateLimitError(error: unknown): error is MetadataRateLimitError {
  return error instanceof MetadataRateLimitError;
}

export function isAniListUnavailableError(error: unknown): error is AniListUnavailableError {
  return error instanceof AniListUnavailableError;
}

function getRetryAfterMs(headers: Headers): number | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  const rateLimitReset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(rateLimitReset) && rateLimitReset > 0) return Math.max(0, rateLimitReset * 1000 - Date.now());
  return null;
}

type MalAnimeNode = {
  id?: number;
  title?: string;
  alternative_titles?: { en?: string; ja?: string };
  main_picture?: { large?: string; medium?: string };
  pictures?: Array<{ large?: string; medium?: string }>;
  synopsis?: string;
  mean?: number;
  popularity?: number;
  num_list_users?: number;
  media_type?: string;
  status?: string;
  num_episodes?: number;
  start_season?: { season?: string; year?: number };
  average_episode_duration?: number;
  rating?: string;
  genres?: Array<{ name?: string }>;
};

type AnirakuScheduleItem = {
  id?: number;
  title?: Anime["title"] | string | null;
  coverImage?: Anime["coverImage"] | null;
  format?: string | null;
  episode?: number;
  airingAt?: number;
};

type AnirakuScheduleResponse = {
  schedule?: AnirakuScheduleItem[];
  pageInfo?: AiringSchedulePage["pageInfo"];
};

type AnirakuAiringScheduleProxyResponse = {
  data?: {
    Page?: {
      pageInfo?: AiringSchedulePage["pageInfo"];
      airingSchedules?: Array<{ airingAt?: number; episode?: number; media?: { id?: number; idMal?: number | null; title?: Anime["title"]; coverImage?: Anime["coverImage"]; format?: string | null } }>;
    };
  };
};

export type AiringScheduleWindow = { startAt: number; endAt: number };

function malStatus(status?: string) {
  const statuses: Record<string, string> = { currently_airing: "RELEASING", finished_airing: "FINISHED", not_yet_aired: "NOT_YET_RELEASED" };
  return statuses[status || ""] || "FINISHED";
}

function malFormat(type?: string) {
  const formats: Record<string, string> = { tv: "TV", movie: "MOVIE", ova: "OVA", ona: "ONA", special: "SPECIAL", tv_special: "TV_SPECIAL", music: "MUSIC" };
  return formats[type || ""] || "TV";
}

function normalizeMalAnime(node: MalAnimeNode, anilistId: number): Anime {
  const malId = Number(node.id);
  const title = String(node.title || "Unknown Anime").trim() || "Unknown Anime";
  const large = node.main_picture?.large || node.main_picture?.medium || "";
  const mean = Number(node.mean);
  return {
    id: anilistId,
    idMal: Number.isInteger(malId) && malId > 0 ? malId : null,
    title: { romaji: node.alternative_titles?.ja || title, english: node.alternative_titles?.en || title, native: node.alternative_titles?.ja || title },
    coverImage: { extraLarge: large, large, color: null },
    bannerImage: node.pictures?.[0]?.large || null,
    description: node.synopsis || null,
    genres: (node.genres || []).map((genre) => String(genre.name || "").trim()).filter(Boolean),
    format: malFormat(node.media_type),
    status: malStatus(node.status),
    episodes: Number(node.num_episodes) || null,
    duration: Number(node.average_episode_duration) ? Math.round(Number(node.average_episode_duration) / 60) : null,
    averageScore: Number.isFinite(mean) ? Math.round(mean * 10) : null,
    popularity: Number(node.num_list_users) || Number(node.popularity) || null,
    season: node.start_season?.season?.toUpperCase() || null,
    seasonYear: Number(node.start_season?.year) || null,
    isAdult: String(node.rating || "").toLowerCase() === "rx",
    relations: { edges: [] },
  };
}

async function mapMalIdsToAniList(malIds: number[]) {
  const ids = [...new Set(malIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 50);
  if (!ids.length) return new Map<number, number>();
  const response = await fetch(APP_CONFIG.metadataFallbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: "query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { id idMal } } }", variables: { ids } }),
  });
  const payload = await response.json().catch(() => ({})) as { data?: { Page?: { media?: Array<{ id?: number; idMal?: number }> } } };
  if (!response.ok) throw new Error("AniList ID mapping is temporarily unavailable.");
  return new Map((payload.data?.Page?.media || []).flatMap((item) => {
    const malId = Number(item.idMal);
    const anilistId = Number(item.id);
    return Number.isInteger(malId) && malId > 0 && Number.isInteger(anilistId) && anilistId > 0 ? [[malId, anilistId] as const] : [];
  }));
}

function normalizeScheduleTitle(value: AnirakuScheduleItem["title"]): Anime["title"] {
  if (value && typeof value === "object") {
    const romaji = String(value.romaji || value.english || value.native || "").trim();
    const english = String(value.english || romaji || "").trim();
    const native = String(value.native || romaji || "").trim();
    return { romaji, english, native };
  }
  const title = String(value || "").trim() || "Unknown title";
  return { romaji: title, english: title, native: title };
}

const anirakuAiringScheduleQuery = `query AnirakuAiringSchedule($page: Int!, $perPage: Int!, $startAt: Int, $endAt: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage hasNextPage total }
    airingSchedules(airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME]) {
      airingAt episode
      media { id idMal title { romaji english native } coverImage { extraLarge large medium color } format }
    }
  }
}`;

async function getAnirakuAiringScheduleFallback(page: number, perPage: number, window?: AiringScheduleWindow): Promise<AiringSchedulePage> {
  const response = await fetch(APP_CONFIG.metadataFallbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: anirakuAiringScheduleQuery, variables: { page, perPage, startAt: window?.startAt, endAt: window?.endAt } }),
  });
  const payload = await response.json().catch(() => ({})) as AnirakuAiringScheduleProxyResponse;
  if (!response.ok) throw new Error(`Schedule fallback is unavailable (${response.status}).`);
  const pageData = payload.data?.Page;
  const airingSchedules = (pageData?.airingSchedules || []).flatMap((item) => {
    const media = item.media;
    const id = Number(media?.id);
    const episode = Number(item.episode);
    const airingAt = Number(item.airingAt);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(episode) || episode < 1 || !Number.isInteger(airingAt) || airingAt < 1) return [];
    const normalizedMedia: Anime = {
      id,
      idMal: Number.isInteger(Number(media?.idMal)) ? Number(media?.idMal) : null,
      title: normalizeScheduleTitle(media?.title || null),
      coverImage: media?.coverImage && typeof media.coverImage === "object" ? media.coverImage : null,
      format: String(media?.format || "").trim() || null,
      nextAiringEpisode: { episode, airingAt },
    };
    return [{ airingAt, episode, media: normalizedMedia }];
  });
  return {
    pageInfo: pageData?.pageInfo && typeof pageData.pageInfo === "object"
      ? pageData.pageInfo
      : { currentPage: page, hasNextPage: false, total: airingSchedules.length },
    airingSchedules,
  };
}

async function getAnirakuAiringSchedule(page: number, perPage: number, window?: AiringScheduleWindow): Promise<AiringSchedulePage> {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(Number(perPage) || 40)));
  const startAt = Math.floor(Number(window?.startAt));
  const endAt = Math.floor(Number(window?.endAt));
  const boundedWindow = Number.isInteger(startAt) && Number.isInteger(endAt) && startAt > 0 && endAt > startAt;
  if (boundedWindow) return getAnirakuAiringScheduleFallback(safePage, safePerPage, { startAt, endAt });
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/v1/schedule?page=${safePage}&perPage=${safePerPage}`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({})) as AnirakuScheduleResponse;
  if (!response.ok) throw new Error(`Schedule is unavailable (${response.status}).`);

  const source = Array.isArray(payload.schedule) ? payload.schedule : [];
  let idMap = new Map<number, number>();
  try {
    idMap = await mapMalIdsToAniList(source.map((item) => Number(item.id)));
  } catch {
    // The primary Schedule endpoint is allowed to be temporarily empty or unmapppable.
    // In that case the existing Aniraku GraphQL proxy below returns real upstream rows.
  }
  const airingSchedules = source.flatMap((item) => {
    const malId = Number(item.id);
    const anilistId = idMap.get(malId);
    const episode = Number(item.episode);
    const airingAt = Number(item.airingAt);
    if (!anilistId || !Number.isInteger(episode) || episode < 1 || !Number.isInteger(airingAt) || airingAt < 1) return [];
    const media: Anime = {
      id: anilistId,
      idMal: malId,
      title: normalizeScheduleTitle(item.title),
      coverImage: item.coverImage && typeof item.coverImage === "object" ? item.coverImage : null,
      format: String(item.format || "").trim() || null,
      nextAiringEpisode: { episode, airingAt },
    };
    return [{ airingAt, episode, media }];
  });

  if (airingSchedules.length) {
    return {
      pageInfo: payload.pageInfo && typeof payload.pageInfo === "object"
        ? payload.pageInfo
        : { currentPage: safePage, hasNextPage: false, total: airingSchedules.length },
      airingSchedules,
    };
  }
  return getAnirakuAiringScheduleFallback(safePage, safePerPage);
}

async function requestDirectMalPage<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  if (!APP_CONFIG.directMalEnabled || !APP_CONFIG.malClientId) return null;
  if (!query.includes("Page(") || query.includes("airingSchedule") || query.includes("relations")) return null;
  const page = Math.max(1, Number(variables.page) || 1);
  const perPage = Math.min(50, Math.max(1, Number(variables.perPage) || 20));
  const sort = Array.isArray(variables.sort) ? variables.sort.join(",") : String(variables.sort || "");
  const search = String(variables.search || "").trim();
  const status = String(variables.status || "");
  const format = String(variables.format || "");
  const limit = format ? Math.min(50, perPage * 2) : perPage;
  const offset = (page - 1) * limit;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), fields: MAL_FIELDS });
  let path: string;
  if (search) {
    params.set("q", search);
    path = `/anime?${params}`;
  } else {
    params.set("ranking_type", status === "RELEASING" || /TRENDING|AIRING/.test(sort) ? "airing" : /POPULARITY/.test(sort) ? "bypopularity" : "all");
    path = `/anime/ranking?${params}`;
  }
  const response = await fetch(`${MAL_API_BASE_URL}${path}`, { headers: { Accept: "application/json", "X-MAL-CLIENT-ID": APP_CONFIG.malClientId } });
  if (response.status === 429) throw new MetadataRateLimitError(getRetryAfterMs(response.headers));
  if (!response.ok) throw new Error(`MyAnimeList is unavailable (${response.status}).`);
  const payload = await response.json().catch(() => ({})) as { data?: Array<{ node?: MalAnimeNode }>; paging?: { next?: string } };
  let nodes = (payload.data || []).map((item) => item.node).filter((node): node is MalAnimeNode => Boolean(node));
  if (format) nodes = nodes.filter((node) => malFormat(node.media_type) === format);
  const mapping = await mapMalIdsToAniList(nodes.map((node) => Number(node.id)));
  const media = nodes.flatMap((node) => {
    const anilistId = mapping.get(Number(node.id));
    return anilistId ? [normalizeMalAnime(node, anilistId)] : [];
  });
  if (nodes.length && !media.length) throw new Error("MyAnimeList results could not be mapped to verified AniList IDs.");
  return { Page: { pageInfo: { currentPage: page, hasNextPage: Boolean(payload.paging?.next), total: offset + media.length }, media } } as T;
}

const fields = `
  id type title { romaji english native } coverImage { large extraLarge color } bannerImage
  description(asHtml: false) genres format status episodes duration averageScore popularity
  season seasonYear isAdult idMal nextAiringEpisode { episode airingAt }
`;

const detailFields = `${fields}
  relations {
    edges {
      relationType
      node { ${fields} }
    }
  }
`;

async function request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const providedVariables = Object.fromEntries(Object.entries(variables).filter(([, value]) => value !== undefined));
  const requestBody = JSON.stringify({ query, variables: providedVariables });
  const cacheKey = requestBody;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  if (cached) responseCache.delete(cacheKey);

  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) return existingRequest as Promise<T>;

  const requestPromise = (async () => {
    const requestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: requestBody,
    };
    const parsePayload = async (response: Response): Promise<{ data?: T; errors?: Array<{ message?: string }>; error?: { code?: string; message?: string; retryAfter?: number | null } }> => {
      const rawPayload = await response.text();
      try { return rawPayload ? JSON.parse(rawPayload) : {}; } catch { throw new Error("Metadata service returned an unreadable response."); }
    };

    try {
      const directMalData = await requestDirectMalPage<T>(query, providedVariables);
      if (directMalData) {
        responseCache.set(cacheKey, { expiresAt: Date.now() + REQUEST_CACHE_TTL_MS, value: directMalData });
        return directMalData;
      }
    } catch (error) {
      if (isMetadataRateLimitError(error)) throw error;
    }

    let response: Response;
    let payload: { data?: T; errors?: Array<{ message?: string }>; error?: { code?: string; message?: string; retryAfter?: number | null } };
    try {
      if (APP_CONFIG.metadataResolverUrl) {
        response = await fetch(APP_CONFIG.metadataResolverUrl, requestInit);
        payload = await parsePayload(response);
        if (response.status === 429) {
          const payloadRetryAfter = Number(payload.error?.retryAfter);
          const retryAfterMs = Number.isFinite(payloadRetryAfter) && payloadRetryAfter > 0 ? payloadRetryAfter * 1000 : null;
          throw new MetadataRateLimitError(getRetryAfterMs(response.headers) ?? retryAfterMs);
        }
        if (response.ok && payload.data) {
          const data = payload.data as T;
          responseCache.set(cacheKey, { expiresAt: Date.now() + REQUEST_CACHE_TTL_MS, value: data });
          return data;
        }
      }
    } catch (error) {
      if (isMetadataRateLimitError(error)) throw error;
      response = undefined as never;
      payload = {};
    }

    const fallback = await fetch(APP_CONFIG.metadataFallbackUrl, requestInit);
    const fallbackPayload = await parsePayload(fallback);
    if (fallback.status === 429) throw new MetadataRateLimitError(getRetryAfterMs(fallback.headers));
    const upstreamMessage = fallbackPayload.errors?.[0]?.message || fallbackPayload.error?.message || `Metadata fallback is unavailable (${fallback.status}).`;
    if (fallback.status === 403 && /temporarily disabled|severe stability issues/i.test(upstreamMessage)) {
      throw new AniListUnavailableError("AniList is temporarily unavailable due to an upstream stability issue. Try again shortly.", fallback.status);
    }
    if (!fallback.ok) throw new Error(upstreamMessage);
    if (fallbackPayload.errors?.length) throw new Error(fallbackPayload.errors[0]?.message || "Metadata fallback returned an invalid response.");
    const data = fallbackPayload.data as T;
    responseCache.set(cacheKey, { expiresAt: Date.now() + REQUEST_CACHE_TTL_MS, value: data });
    return data;
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
}

const pageQuery = `query MediaPage($page: Int!, $perPage: Int!, $sort: [MediaSort], $search: String, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int) {
  Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage total } media(type: ANIME, isAdult: false, sort: $sort, search: $search, status: $status, season: $season, seasonYear: $seasonYear) { ${fields} } }
}`;

export async function getAnimePage(options: {
  page?: number;
  perPage?: number;
  sort?: string[];
  search?: string;
  status?: string;
  season?: string;
  seasonYear?: number;
} = {}): Promise<AnimePage> {
  const data = await request<{ Page: AnimePage }>(pageQuery, {
    page: options.page ?? 1,
    perPage: options.perPage ?? 20,
    sort: options.sort ?? ["POPULARITY_DESC"],
    search: options.search,
    status: options.status,
    season: options.season,
    seasonYear: options.seasonYear,
  });
  return data.Page;
}

export async function getHomeAnime() {
  const [trending, popular, upcoming] = await Promise.all([
    getAnimePage({ perPage: 12, sort: ["TRENDING_DESC", "POPULARITY_DESC"] }),
    getAnimePage({ perPage: 12, sort: ["POPULARITY_DESC"] }),
    getAiringSchedule(1, 12),
  ]);
  return { trending: trending.media, popular: popular.media, upcoming: upcoming.airingSchedules.map((item) => item.media) };
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
  return getAnirakuAiringSchedule(page, perPage, window);
}
