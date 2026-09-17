import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentWeekWindow, getAiringScheduleWindow, getAnimePool } from "@/lib/anilist";

/**
 * Fires AniList prefetches on mount so both the Schedule and Random tabs
 * open instantly. Guarded by `ready` — the hook must not call useQueryClient
 * before the QueryClientProvider is mounted (i.e. before fonts load and the
 * AppProviders tree renders).
 */
export function useStartupPrefetch(ready: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!ready) return;
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
  }, [ready, queryClient]);
}
