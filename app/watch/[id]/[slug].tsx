import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { parseRouteEpisode, parseRouteId } from "@/lib/route-params";

/**
 * Watch alias for the website's /watch/{id}/{slug}?ep=N player route (the
 * slug is SEO-only). Opens the native player; `ep` maps onto the player's
 * `episode` param, other query keys (title/image) pass through untouched.
 */
export default function WatchSlugAliasScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; slug?: string | string[]; ep?: string | string[]; title?: string; image?: string }>();
  const id = parseRouteId(params.id);
  const episode = parseRouteEpisode(params.ep, 1);

  useEffect(() => {
    if (id === null) return;
    router.replace({
      pathname: "/watch/[id]",
      params: { id: String(id), episode: String(episode), ...(params.title ? { title: String(params.title) } : {}), ...(params.image ? { image: String(params.image) } : {}) },
    } as never);
  }, [id, episode, params.title, params.image]);

  return null;
}
