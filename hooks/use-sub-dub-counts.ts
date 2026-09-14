import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEpisodes, hasDubForEpisode } from "@/lib/aniraku-api";

type SubDubCounts = { sub: number; dub: number; total: number; loading: boolean };

export function useSubDubCounts(animeId: number): SubDubCounts {
  const episodes = useQuery({
    queryKey: ["episodes", animeId],
    queryFn: () => getEpisodes(animeId),
    enabled: Number.isFinite(animeId) && animeId > 0,
    staleTime: 30 * 60_000,
  });

  const total = episodes.data?.length ?? 0;

  const dubQuery = useQuery({
    queryKey: ["sub-dub-counts", animeId, total],
    queryFn: async () => {
      if (total === 0) return { sub: 0, dub: 0 };
      const BATCH = 15;
      let dubCount = 0;
      for (let start = 1; start <= total; start += BATCH) {
        const end = Math.min(start + BATCH - 1, total);
        const eps = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const results = await Promise.all(eps.map((ep) => hasDubForEpisode(animeId, ep).catch(() => false)));
        for (const has of results) { if (has) dubCount++; }
      }
      return { sub: total, dub: dubCount };
    },
    enabled: Number.isFinite(animeId) && animeId > 0 && total > 0,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    retry: 1,
  });

  return useMemo(() => ({
    sub: dubQuery.data?.sub ?? 0,
    dub: dubQuery.data?.dub ?? 0,
    total,
    loading: episodes.isPending || (total > 0 && dubQuery.isPending),
  }), [dubQuery.data?.dub, dubQuery.isPending, episodes.isPending, total]);
}
