import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { getAnimeById } from "@/lib/anilist";

const GENRE_CACHE_KEY = "aniraku.user-top-genre.v1";

export function useUserTopGenre(): string | null {
  const { history } = useWatchHistory();
  const entries = history.data ?? [];
  const uniqueAnimeIds = useMemo(() => [...new Set(entries.map((e) => e.anime_id))], [entries]);

  const genreQuery = useQuery({
    queryKey: [GENRE_CACHE_KEY, uniqueAnimeIds.sort((a, b) => a - b).join(",")],
    queryFn: async () => {
      if (!uniqueAnimeIds.length) return null;
      const genreCounts = new Map<string, number>();
      const batch = uniqueAnimeIds.slice(0, 30);
      const results = await Promise.allSettled(batch.map((id) => getAnimeById(id)));
      for (const result of results) {
        if (result.status === "fulfilled") {
          const genres = result.value.genres ?? [];
          for (const genre of genres) {
            genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
          }
        }
      }
      let topGenre: string | null = null;
      let maxCount = 0;
      for (const [genre, count] of genreCounts) {
        if (count > maxCount) {
          maxCount = count;
          topGenre = genre;
        }
      }
      return topGenre;
    },
    enabled: uniqueAnimeIds.length > 0,
    staleTime: 60 * 60_000,
    retry: false,
  });

  return genreQuery.data ?? null;
}
