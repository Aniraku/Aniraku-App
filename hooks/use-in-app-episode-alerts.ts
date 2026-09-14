import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getEpisodes, getServers } from "@/lib/aniraku-api";
import { getAnimeById } from "@/lib/anilist";
import { availableReleasedEpisode, shouldCreateEpisodeAlert, type EpisodeAlertMarker } from "@/lib/in-app-alerts";
import { scheduleNewEpisodeNotification } from "@/providers/notifications-provider";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

type BookmarkRecord = { anime_id: number; title?: string | null };
type MarkerMap = Record<string, EpisodeAlertMarker>;
const markerKey = (userId: string) => `aniraku-episode-track:${userId}`;
const NOTIFY_ME_KEY = "aniraku.notify-me.v1";

function parseMarkers(raw: string | null): MarkerMap {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed as MarkerMap : {};
  } catch {
    return {};
  }
}

async function getNotifyMeAnimeIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFY_ME_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw);
    return Object.keys(map).map(Number).filter((id) => Number.isFinite(id) && id > 0);
  } catch {
    return [];
  }
}

/**
 * Enhanced episode alert monitor:
 * 1. Checks bookmarks every 30 minutes (down from 6h)
 * 2. Also on every app foreground
 * 3. Verifies AniList has a released episode
 * 4. Verifies the backend episode list includes it
 * 5. Verifies the backend actually has streaming servers for it
 * 6. Only THEN sends notification
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
      const bookmarkRecords = (error || !data?.length) ? [] : (data as BookmarkRecord[]);
      const notifyMeIds = await getNotifyMeAnimeIds();
      const bookmarkIds = new Set(bookmarkRecords.map((b) => b.anime_id));
      const notifyMeTitles = bookmarkRecords.filter((b) => bookmarkIds.has(b.anime_id));
      const allAnimeIds = [...new Set([...bookmarkRecords.map((b) => b.anime_id), ...notifyMeIds])];
      if (!allAnimeIds.length) return;
      const now = Date.now();
      const markers = parseMarkers(await AsyncStorage.getItem(markerKey(user.id)).catch(() => null));
      let changed = false;

      for (const animeId of allAnimeIds) {
        try {
          const anime = await getAnimeById(animeId);
          const releasedEpisode = availableReleasedEpisode(anime);
          const marker = markers[String(animeId)];
          if (!releasedEpisode || !shouldCreateEpisodeAlert(marker, releasedEpisode, now)) continue;

          const episodes = await getEpisodes(animeId);
          if (!episodes.some((item) => item.number === releasedEpisode)) continue;

          const [subServers, dubServers] = await Promise.all([
            getServers(animeId, releasedEpisode, "sub").catch(() => []),
            getServers(animeId, releasedEpisode, "dub").catch(() => []),
          ]);
          const hasSource = subServers.length > 0 || dubServers.length > 0;
          if (!hasSource) continue;

          const bookmarkRecord = bookmarkRecords.find((b) => b.anime_id === animeId);
          const title = bookmarkRecord?.title || anime.title.english || anime.title.romaji || anime.title.native || "Your saved anime";
          const hasDub = dubServers.length > 0;
          const message = `Episode ${releasedEpisode} of ${title} is now available${hasDub ? " (Sub & Dub)" : " (Sub)"}`;

          const { data: existing, error: lookupError } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "new_episode")
            .eq("anime_id", animeId)
            .eq("message", message)
            .limit(1);
          if (lookupError) continue;

          if (!existing?.length) {
            const { error: insertError } = await supabase.from("notifications").insert({
              user_id: user.id,
              type: "new_episode",
              message,
              anime_id: animeId,
            });
            if (insertError && insertError.code !== "23505") continue;
          }
          markers[String(animeId)] = { episode: releasedEpisode, checkedAt: now };
          changed = true;
          void scheduleNewEpisodeNotification({
            animeId,
            title,
            episode: releasedEpisode,
          }).catch(() => {});
        } catch {
          // One rate-limited title must never block the rest.
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
    // Check every 30 minutes instead of 6 hours
    const interval = setInterval(() => { void checkForReleasedEpisodes(); }, 30 * 60 * 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkForReleasedEpisodes();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [checkForReleasedEpisodes, user]);

  return null;
}
