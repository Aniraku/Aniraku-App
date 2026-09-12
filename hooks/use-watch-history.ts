import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

export type HistoryInput = { animeId: number; animeTitle: string; animeImage?: string | null; episode: number; episodeTitle?: string | null; progress: number; duration: number };

export function useWatchHistory() {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["watch-history", user?.id] as const, [user?.id]);
  const [synced, setSynced] = useState(false);
  const syncedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const history = useQuery({ queryKey, enabled: Boolean(user), queryFn: async () => { const { data, error } = await supabase.from("watch_history").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false }); if (error) throw error; return data ?? []; } });

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
    const { error } = await supabase.from("watch_history").upsert({ user_id: user.id, anime_id: input.animeId, anime_title: input.animeTitle, anime_image: cover, episode_number: input.episode, episode_title: input.episodeTitle ?? null, timestamp: Date.now(), progress: input.progress, duration: input.duration }, { onConflict: "user_id,anime_id,episode_number" });
    if (error) throw error;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const remove = useMutation({ mutationFn: async (entry: { animeId: number; episode: number }) => { if (!user) return; const { error } = await supabase.from("watch_history").delete().eq("user_id", user.id).eq("anime_id", entry.animeId).eq("episode_number", entry.episode); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const clear = useMutation({ mutationFn: async () => { if (!user) return; const { error } = await supabase.from("watch_history").delete().eq("user_id", user.id); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { history, save, remove, clear, synced };
}
