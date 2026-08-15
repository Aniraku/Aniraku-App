import { APP_CONFIG } from "@/lib/app-config";
import type { AiringSchedulePage, Anime, AnimePage } from "@/lib/types";

const fields = `
  id title { romaji english native } coverImage { large extraLarge color } bannerImage
  description(asHtml: false) genres format status episodes duration averageScore popularity
  season seasonYear isAdult nextAiringEpisode { episode airingAt }
`;

async function request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const providedVariables = Object.fromEntries(Object.entries(variables).filter(([, value]) => value !== undefined));
  const response = await fetch(APP_CONFIG.anilistGraphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: providedVariables }),
  });
  const rawPayload = await response.text();
  let payload: { data?: T; errors?: Array<{ message?: string }> } = {};
  try { payload = rawPayload ? JSON.parse(rawPayload) : {}; } catch { throw new Error("AniList returned an unreadable response."); }
  if (!response.ok) throw new Error(payload.errors?.[0]?.message || `AniList is unavailable (${response.status}).`);
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message || "AniList returned an invalid response.");
  return payload.data as T;
}

const pageQuery = `query MediaPage($page: Int!, $perPage: Int!, $sort: [MediaSort], $search: String, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int) {
  Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage total } media(type: ANIME, isAdult: false, sort: $sort, search: $search, status: $status, season: $season, seasonYear: $seasonYear) { ${fields} } }
}`;

const airingScheduleQuery = `query AiringSchedule($page: Int!, $perPage: Int!) {
  Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage total } airingSchedules(notYetAired: true, sort: [TIME]) { airingAt episode media { ${fields} } } }
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
  const query = `query Anime($id: Int!) { Media(id: $id, type: ANIME) { ${fields} } }`;
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

export async function getAiringSchedule(page = 1, perPage = 40): Promise<AiringSchedulePage> {
  const data = await request<{ Page: AiringSchedulePage }>(airingScheduleQuery, { page, perPage });
  return data.Page;
}
