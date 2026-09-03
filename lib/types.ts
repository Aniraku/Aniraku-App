export type AnimeTitle = {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
};

export type AnimeRelationType = "ADAPTATION" | "ALTERNATIVE" | "CHARACTER" | "COMPILATION" | "CONTAINS" | "OTHER" | "PARENT" | "PREQUEL" | "SEQUEL" | "SIDE_STORY" | "SOURCE" | "SPIN_OFF" | "SUMMARY" | "VERSION";

export type AnimeRelationEdge = {
  relationType?: AnimeRelationType | null;
  node?: Anime | null;
};

export type Anime = {
  id: number;
  type?: string | null;
  title: AnimeTitle;
  coverImage?: { large?: string | null; extraLarge?: string | null; color?: string | null } | null;
  bannerImage?: string | null;
  description?: string | null;
  genres?: string[] | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  isAdult?: boolean | null;
  idMal?: number | null;
  malId?: number | null;
  mal_id?: number | null;
  myAnimeListId?: number | null;
  relations?: { edges?: AnimeRelationEdge[] | null } | null;
  trailer?: { id?: string | null; site?: string | null; thumbnail?: string | null } | null;
};

export type AnimePage = {
  pageInfo: { currentPage: number; hasNextPage: boolean; total?: number | null };
  media: Anime[];
};

export type AiringScheduleItem = {
  airingAt: number;
  episode: number;
  media: Anime;
};

export type AiringSchedulePage = {
  pageInfo: AnimePage["pageInfo"];
  airingSchedules: AiringScheduleItem[];
};

export type Episode = {
  number: number;
  title?: string | null;
  thumbnail?: string | null;
  description?: string | null;
  isFiller?: boolean;
};

export type Server = {
  id: string;
  provider: string;
  label: string;
  lang: "sub" | "dub";
  verification?: string;
  type?: string;
  sources?: StreamSource[];
  headers?: Record<string, string>;
  downloads?: Array<{ url: string; label?: string }>;
  subtitles?: Array<{ url: string; label?: string; lang?: string }>;
};

export type StreamSource = {
  url: string;
  quality?: string;
  type?: string;
  mime?: string;
  verification?: string;
  Verification?: string;
  subtitles?: Array<{ url: string; label?: string; lang?: string }>;
};

export type StreamResponse = {
  sources: StreamSource[];
  qualities?: string[];
  headers?: Record<string, string>;
  intro?: { startTime?: number; endTime?: number };
  outro?: { startTime?: number; endTime?: number };
  error?: string;
};

export type AnirakuProfile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  location?: string | null;
  socials?: Record<string, string> | null;
  created_at?: string | null;
};

export type WatchHistoryEntry = {
  anime_id: number;
  episode: number;
  progress: number;
  duration?: number | null;
  completed?: boolean | null;
  updated_at?: string | null;
  anime_title?: string | null;
  anime_cover?: string | null;
};

export function animeTitle(anime: Pick<Anime, "title"> | AnimeTitle): string {
  const title = "title" in anime ? anime.title : anime;
  return title.english || title.romaji || title.native || "Untitled anime";
}
