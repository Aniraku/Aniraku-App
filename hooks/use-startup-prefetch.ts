import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentWeekWindow, getAiringScheduleWindow, getAnimePool } from "@/lib/anilist";

/**
 * Fires AniList prefetches on mount so both the Schedule and Random tabs
 * open instantly. This hook MUST be called from inside the provider tree
 * (after QueryClientProvider mounts) — calling it outside throws.
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
