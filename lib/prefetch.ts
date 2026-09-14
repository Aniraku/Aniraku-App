import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { getAnimeById } from "@/lib/anilist";
import { getEpisodes } from "@/lib/aniraku-api";

/**
 * Prefetch anime detail + episode list so transitions are instant.
 * Call on card press (with a small delay so haptic fires first).
 */
export function usePrefetchAnime() {
  const queryClient = useQueryClient();
  const prefetched = useRef(new Set<number>());

  const prefetch = useCallback((animeId: number) => {
    if (prefetched.current.has(animeId)) return;
    prefetched.current.add(animeId);

    queryClient.prefetchQuery({
      queryKey: ["anime", animeId],
      queryFn: () => getAnimeById(animeId),
      staleTime: 5 * 60_000,
    });

    queryClient.prefetchQuery({
      queryKey: ["episodes", animeId],
      queryFn: () => getEpisodes(animeId),
      staleTime: 5 * 60_000,
    });
  }, [queryClient]);

  return prefetch;
}
