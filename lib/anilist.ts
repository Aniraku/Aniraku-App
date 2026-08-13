import { APP_CONFIG } from "@/lib/app-config";
import type { Anime, AnimePage } from "@/lib/types";

const fields = `
  id title { romaji english native } coverImage { large extraLarge color } bannerImage
  description(asHtml: false) genres format status episodes duration averageScore popularity
  season seasonYear isAdult nextAiringEpisode { episode airingAt }
`;

async function request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(APP_CONFIG.anilistGraphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`AniList is unavailable (${response.status}).`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message || "AniList returned an invalid response.");
  return payload.data as T;
}

const pageQuery = `query MediaPage($page: Int!, $perPage: Int!, $sort: [MediaSort!], $search: String, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int) {
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
    getAnimePage({ perPage: 12, sort: ["NEXT_AIRING_EPISODE_ASC"] }),
  ]);
  return { trending: trending.media, popular: popular.media, upcoming: upcoming.media };
}

export async function getAnimeById(id: number): Promise<Anime> {
  const query = `query Anime($id: Int!) { Media(id: $id, type: ANIME) { ${fields} } }`;
  const data = await request<{ Media: Anime }>(query, { id });
  return data.Media;
}

export async function getAiringSchedule(page = 1): Promise<AnimePage> {
  return getAnimePage({ page, perPage: 40, sort: ["NEXT_AIRING_EPISODE_ASC"] });
}
