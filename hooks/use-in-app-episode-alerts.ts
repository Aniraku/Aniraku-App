import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getEpisodes } from "@/lib/aniraku-api";
import { getAnimeById } from "@/lib/anilist";
import { availableReleasedEpisode, shouldCreateEpisodeAlert, type EpisodeAlertMarker } from "@/lib/in-app-alerts";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

type BookmarkRecord = { anime_id: number; title?: string | null };
type MarkerMap = Record<string, EpisodeAlertMarker>;
const markerKey = (userId: string) => `aniraku-episode-track:${userId}`;

function parseMarkers(raw: string | null): MarkerMap {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed as MarkerMap : {};
  } catch {
    return {};
  }
}

/**
 * Native counterpart to the main site's bookmark release check. It deliberately
 * writes only the synced in-app inbox; no device-push provider is contacted.
 */
export function InAppEpisodeAlertMonitor() {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const running = useRef(false);

  const checkForReleasedEpisodes = useCallback(async () => {
    if (!user || running.current) return;
    running.current = true;
    try {
      const { data, error } = await supabase.from("bookmarks").select("anime_id,title").eq("user_id", user.id);
      if (error || !data?.length) return;
      const bookmarks = data as BookmarkRecord[];
      const now = Date.now();
      const markers = parseMarkers(await AsyncStorage.getItem(markerKey(user.id)).catch(() => null));
      let changed = false;

      for (const bookmark of bookmarks) {
        try {
          const anime = await getAnimeById(Number(bookmark.anime_id));
          const releasedEpisode = availableReleasedEpisode(anime);
          const marker = markers[String(bookmark.anime_id)];
          if (!releasedEpisode || !shouldCreateEpisodeAlert(marker, releasedEpisode, now)) continue;

          const episodes = await getEpisodes(Number(bookmark.anime_id));
          if (!episodes.some((item) => item.number === releasedEpisode)) continue;

          const title = bookmark.title || anime.title.english || anime.title.romaji || anime.title.native || "Your saved anime";
          const message = `Episode ${releasedEpisode} of ${title} is now available`;
          const { data: existing, error: lookupError } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "new_episode")
            .eq("anime_id", bookmark.anime_id)
            .eq("message", message)
            .limit(1);
          if (lookupError) continue;

          if (!existing?.length) {
            const { error: insertError } = await supabase.from("notifications").insert({
              user_id: user.id,
              type: "new_episode",
              message,
              anime_id: bookmark.anime_id,
            });
            if (insertError && insertError.code !== "23505") continue;
          }
          markers[String(bookmark.anime_id)] = { episode: releasedEpisode, checkedAt: now };
          changed = true;
        } catch {
          // One rate-limited title must never block the rest of the saved library.
        }
      }

      if (changed) {
        await AsyncStorage.setItem(markerKey(user.id), JSON.stringify(markers)).catch(() => {});
        await queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      }
    } finally {
      running.current = false;
    }
  }, [queryClient, user]);

  useEffect(() => {
    if (!user) return;
    void checkForReleasedEpisodes();
    const interval = setInterval(() => { void checkForReleasedEpisodes(); }, 21_600_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkForReleasedEpisodes();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [checkForReleasedEpisodes, user]);

  return null;
}
