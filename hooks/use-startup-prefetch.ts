import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentWeekWindow, getAiringScheduleWindow, getAnimePool } from "@/lib/anilist";
import { readNsfwPreference } from "@/lib/nsfw-preference";
import { sessionRandomPages } from "@/lib/random-pool";
import { nsfwFilterParam } from "@/lib/nsfw-preference";

/**
 * Fires AniList prefetches on mount so both the Schedule and Random tabs
 * open instantly. This hook MUST be called from inside the provider tree
 * (after QueryClientProvider mounts) — calling it outside throws.
 *
 * The Random prefetch must resolve the same `isAdult` flag the tab will use
 * (read from storage first), and the same session-stable pages from
 * lib/random-pool — otherwise the prefetched cache entry's key never matches
 * what the tab queries and the request is wasted under the 30 req/min cap.
 */
export function useStartupPrefetch() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    const window = currentWeekWindow();
    queryClient.prefetchQuery({
      queryKey: ["schedule", window.startAt, window.endAt],
      queryFn: () => getAiringScheduleWindow(window),
      staleTime: 5 * 60_000,
    });
    void readNsfwPreference().then((nsfwEnabled) => {
      if (cancelled) return;
      const isAdultParam = nsfwFilterParam(nsfwEnabled);
      const pages = sessionRandomPages();
      queryClient.prefetchQuery({
        queryKey: ["random-pool", pages[0], pages[1], pages[2], isAdultParam],
        queryFn: () => getAnimePool({ pages, perPage: 50, isAdult: isAdultParam }),
        staleTime: 10 * 60_000,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [queryClient]);
}
