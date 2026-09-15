import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentWeekWindow, getAiringScheduleWindow, getAnimePool } from "@/lib/anilist";

/**
 * Fires a single AniList round-trip on mount that pre-warms both the schedule
 * and the random pool caches. Both use the slim batched queries now, so the
 * total payload is small and the tabs open instantly once the prefetch lands.
 */
export function useStartupPrefetch() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const window = currentWeekWindow();
    queryClient.prefetchQuery({
      queryKey: ["schedule", window.startAt, window.endAt],
      queryFn: () => getAiringScheduleWindow(window),
      staleTime: 5 * 60_000,
    });
    queryClient.prefetchQuery({
      queryKey: ["random-pool", 1, 2, 3, null],
      queryFn: () => getAnimePool({ pages: [1, 2, 3], perPage: 50, isAdult: null }),
      staleTime: 10 * 60_000,
    });
  }, [queryClient]);
}
