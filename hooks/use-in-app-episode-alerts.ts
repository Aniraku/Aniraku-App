import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getEpisodes, getServers } from "@/lib/aniraku-api";
import { getAnimeByIds } from "@/lib/anilist";
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

      // ONE batched AniList request per 50 ids (temporary 30 req/min limit):
      // the old per-bookmark getAnimeById loop burned the whole budget on
      // foreground for heavy bookmark lists.
      const animeById = new Map<number, Awaited<ReturnType<typeof getAnimeByIds>>[number]>();
      try {
        for (const anime of await getAnimeByIds(allAnimeIds)) {
          animeById.set(Number(anime.id), anime);
        }
      } catch {
        // AniList down/limited: skip this cycle entirely instead of hitting
        // every remaining endpoint for zero benefit. Markers stay untouched.
        return;
      }

      for (const animeId of allAnimeIds) {
        try {
          const anime = animeById.get(animeId);
          if (!anime) continue;
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

          // Episode-stable dedupe: the message suffix flips when dub lands
          // later ("(Sub)" → "(Sub & Dub)"), so match any existing row for
          // this episode — never a second row, and never an outside
          // notification for an episode the user already read.
          const { data: existing, error: lookupError } = await supabase
            .from("notifications")
            .select("id,read")
            .eq("user_id", user.id)
            .eq("type", "new_episode")
            .eq("anime_id", animeId)
            .like("message", `Episode ${releasedEpisode} of %`)
            .limit(5);
          if (lookupError) continue;
          const alreadyNotified = (existing?.length ?? 0) > 0;
          const alreadyRead = alreadyNotified && (existing as Array<{ read?: boolean }>).every((row) => row.read);

          // Marker always advances once this episode is resolved (notified or
          // already-read) so it is never re-checked…
          const resolveMarker = () => {
            markers[String(animeId)] = { episode: releasedEpisode, checkedAt: now };
            changed = true;
          };
          // …but nothing else happens for an already-read episode: no new
          // row, no outside notification.
          if (alreadyRead) { resolveMarker(); continue; }

          if (!alreadyNotified) {
            const { error: insertError } = await supabase.from("notifications").insert({
              user_id: user.id,
              type: "new_episode",
              message,
              anime_id: animeId,
            });
            // Non-conflict failure: leave the marker so the next check retries.
            // 23505 = unique conflict: the row exists now, treat as notified.
            if (insertError && insertError.code !== "23505") continue;
          }
          resolveMarker();
          // Unread-existing rows (e.g. notified on another device) still get
          // the outside ping once — the scheduler's own per-episode device
          // key dedupes repeats on this device.
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
