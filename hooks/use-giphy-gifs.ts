import { useQuery } from "@tanstack/react-query";
import { APP_CONFIG } from "@/lib/app-config";
import { toGiphyReaction, type GiphyReaction } from "@/lib/comment-content";

const GIPHY_API_BASE = "https://api.giphy.com/v1/gifs";

export function useGiphyGifs(open: boolean, search: string) {
  const apiKey = APP_CONFIG.giphyApiKey.trim();
  const normalizedSearch = search.trim();

  return useQuery<GiphyReaction[]>({
    queryKey: ["comment-giphy", normalizedSearch],
    enabled: Boolean(open && apiKey),
    staleTime: 60_000,
    queryFn: async () => {
      const endpoint = new URL(normalizedSearch ? `${GIPHY_API_BASE}/search` : `${GIPHY_API_BASE}/trending`);
      endpoint.searchParams.set("api_key", apiKey);
      endpoint.searchParams.set("limit", "20");
      endpoint.searchParams.set("rating", "g");
      if (normalizedSearch) {
        endpoint.searchParams.set("q", normalizedSearch);
        endpoint.searchParams.set("lang", "en");
      }
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("GIF service is unavailable.");
      const payload = (await response.json()) as { data?: unknown[] };
      if (!Array.isArray(payload.data)) throw new Error("GIF service returned an invalid response.");
      return payload.data.map(toGiphyReaction).filter((gif): gif is GiphyReaction => Boolean(gif));
    },
  });
}
