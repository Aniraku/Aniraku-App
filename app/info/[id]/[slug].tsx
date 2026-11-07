import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { parseRouteId } from "@/lib/route-params";

/**
 * Two-segment info alias: the website also publishes /info/{id}/{slug}
 * (SEO slug) — the slug carries no routing meaning for the app, so it lands
 * on the same native details screen as /info/[id].
 */
export default function InfoSlugAliasScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; slug?: string | string[] }>();
  const id = parseRouteId(params.id);

  useEffect(() => {
    if (id === null) return;
    router.replace({ pathname: "/anime/[id]", params: { id: String(id) } } as never);
  }, [id]);

  return null;
}
