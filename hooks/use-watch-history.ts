import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

export type HistoryInput = { animeId: number; animeTitle: string; animeImage?: string | null; episode: number; episodeTitle?: string | null; progress: number; duration: number };

export function useWatchHistory() {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["watch-history", user?.id];
  const history = useQuery({ queryKey, enabled: Boolean(user), queryFn: async () => { const { data, error } = await supabase.from("watch_history").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false }); if (error) throw error; return data ?? []; } });
  const save = useMutation({ mutationFn: async (input: HistoryInput) => {
    if (!user) throw new Error("Sign in to synchronize your history.");
    const { error: removeError } = await supabase.from("watch_history").delete().eq("user_id", user.id).eq("anime_id", input.animeId).eq("episode_number", input.episode);
    if (removeError) throw removeError;
    const { error } = await supabase.from("watch_history").insert({ user_id: user.id, anime_id: input.animeId, anime_title: input.animeTitle, anime_image: input.animeImage ?? null, episode_number: input.episode, episode_title: input.episodeTitle ?? null, timestamp: Date.now(), progress: input.progress, duration: input.duration });
    if (error) throw error;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const remove = useMutation({ mutationFn: async (entry: { animeId: number; episode: number }) => { if (!user) return; const { error } = await supabase.from("watch_history").delete().eq("user_id", user.id).eq("anime_id", entry.animeId).eq("episode_number", entry.episode); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const clear = useMutation({ mutationFn: async () => { if (!user) return; const { error } = await supabase.from("watch_history").delete().eq("user_id", user.id); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { history, save, remove, clear };
}
