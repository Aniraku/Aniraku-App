import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { resolveMaxHistoryProgress } from "@/lib/watch-engine";
import { LOCAL_WATCH_KEY_PREFIX, parseLocalWatchEntry, type LocalWatchEntry } from "@/lib/watch-progress";
import { useAnirakuAuth } from "@/providers/auth-provider";

export type HistoryInput = { animeId: number; animeTitle: string; animeImage?: string | null; episode: number; episodeTitle?: string | null; episodeThumbnail?: string | null; progress: number; duration: number };

const HISTORY_CACHE_PREFIX = "aniraku.history-cache.v1:";

/** Zero-network fallback: last synced history rows, for offline Library / resume rows. */
async function readCachedHistoryRows(userId: string): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${HISTORY_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** All locally-remembered positions (guest + signed-in), newest first. */
export async function listLocalWatchEntries(): Promise<LocalWatchEntry[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const watchKeys = keys.filter((key) => key.startsWith(LOCAL_WATCH_KEY_PREFIX));
    if (!watchKeys.length) return [];
    const pairs = await AsyncStorage.multiGet(watchKeys);
    const entries: LocalWatchEntry[] = [];
    for (const [key, value] of pairs) {
      const match = key.match(/:(\d+):(\d+)$/);
      if (!match) continue;
      const parsed = parseLocalWatchEntry(Number(match[1]), Number(match[2]), value);
      if (parsed) entries.push(parsed);
    }
    return entries.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function useWatchHistory() {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["watch-history", user?.id] as const, [user?.id]);
  const [synced, setSynced] = useState(false);
  const syncedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const history = useQuery({ queryKey, enabled: Boolean(user), queryFn: async () => { const { data, error } = await supabase.from("watch_history").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false }); if (error) throw error; return data ?? []; } });

  // Offline open: keep the last synced rows in AsyncStorage so Library +
  // resume rails render with zero network. Fresh server data always wins
  // when it arrives; the cache is only a fallback.
  const [cachedRows, setCachedRows] = useState<any[] | null>(null);
  useEffect(() => {
    if (!user?.id) { setCachedRows(null); return; }
    let cancelled = false;
    void readCachedHistoryRows(user.id).then((rows) => { if (!cancelled) setCachedRows(rows); });
    return () => { cancelled = true; };
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id || !history.isSuccess || !history.data) return;
    setCachedRows(history.data);
    void AsyncStorage.setItem(`${HISTORY_CACHE_PREFIX}${user.id}`, JSON.stringify(history.data)).catch(() => {});
  }, [history.data, history.isSuccess, user?.id]);
  const displayRows = useMemo(
    () => (history.data ?? cachedRows ?? []) as any[],
    [history.data, cachedRows],
  );
  const isOfflineCache = !history.data && Boolean(cachedRows?.length);

  // Each mounted screen (Home, Anime-detail, Watch, Library, Settings) runs
  // this hook. They can all be alive at once in the router stack, so sharing
  // one static topic (`watch-history:<uid>`) makes supabase-js throw:
  // "cannot add `postgres_changes` callbacks ... after `subscribe()`".
  // Give every hook instance its own topic and never let a realtime failure
  // crash the screen ErrorBoundary — history queries still work without it.
  const instanceId = useRef(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const effectQueryKey = ["watch-history", userId] as const;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    try {
      channel = supabase
        .channel(`watch-history:${userId}:${instanceId.current}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "watch_history", filter: `user_id=eq.${userId}` },
          () => {
            if (cancelled) return;
            void queryClient.invalidateQueries({ queryKey: effectQueryKey });
            setSynced(true);
            if (syncedTimer.current) clearTimeout(syncedTimer.current);
            syncedTimer.current = setTimeout(() => setSynced(false), 2000);
          }
        )
        .subscribe();
    } catch {
      // Realtime is best-effort only; history list + mutations keep working.
      channel = null;
    }
    return () => {
      cancelled = true;
      if (syncedTimer.current) clearTimeout(syncedTimer.current);
      if (channel) void supabase.removeChannel(channel).catch(() => {});
    };
    // Intentionally depend only on the stable user id: queryKey is derived
    // from it, and including the array identity would resubscribe needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, queryClient]);

  const save = useMutation({ mutationFn: async (input: HistoryInput) => {
    if (!user) throw new Error("Sign in to synchronize your history.");
    let cover = input.animeImage || null;
    if (!cover) {
      const { data } = await supabase.from("watch_history").select("anime_image").eq("user_id", user.id).eq("anime_id", input.animeId).eq("episode_number", input.episode).maybeSingle();
      cover = (data as { anime_image?: string | null } | null)?.anime_image || null;
    }
    // Conflict rule: prefer max(local, server), not last-write. A stale
    // background tick must never rewind a newer position saved elsewhere.
    let progress = input.progress;
    try {
      const { data: existing } = await supabase.from("watch_history").select("progress").eq("user_id", user.id).eq("anime_id", input.animeId).eq("episode_number", input.episode).maybeSingle();
      const serverProgress = Number((existing as { progress?: unknown } | null)?.progress);
      if (Number.isFinite(serverProgress)) progress = resolveMaxHistoryProgress(input.progress, serverProgress);
    } catch {
      // Best-effort only; fall back to the incoming progress.
    }
    const { error } = await supabase.from("watch_history").upsert({ user_id: user.id, anime_id: input.animeId, anime_title: input.animeTitle, anime_image: cover, episode_number: input.episode, episode_title: input.episodeTitle ?? null, episode_thumbnail: input.episodeThumbnail ?? null, timestamp: Date.now(), progress, duration: input.duration }, { onConflict: "user_id,anime_id,episode_number" });
    if (error) throw error;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const remove = useMutation({ mutationFn: async (entry: { animeId: number; episode: number }) => { if (!user) return; const { error } = await supabase.from("watch_history").delete().eq("user_id", user.id).eq("anime_id", entry.animeId).eq("episode_number", entry.episode); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const clear = useMutation({ mutationFn: async () => { if (!user) return; const { error } = await supabase.from("watch_history").delete().eq("user_id", user.id); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { history, save, remove, clear, synced, cachedRows, displayRows, isOfflineCache };
}
