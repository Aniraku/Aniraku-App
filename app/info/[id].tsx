import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { parseRouteId } from "@/lib/route-params";

/**
 * App-Link alias for the website's details route. Sharing publishes
 * https://aniraku.tech/info/{id} (lib/site-links); when the recipient has the
 * app installed, Android opens that URL straight into the app and expo-router
 * needs a file route for the /info/ path. The alias replaces itself with the
 * native /anime/[id] screen so the back stack stays clean.
 */
export default function InfoAliasScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; slug?: string | string[] }>();
  const id = parseRouteId(params.id);

  useEffect(() => {
    if (id === null) return;
    router.replace({ pathname: "/anime/[id]", params: { id: String(id) } } as never);
  }, [id]);

  // Renders nothing — the alias is replaced before the first paint settles.
  return null;
}
