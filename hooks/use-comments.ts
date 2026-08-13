import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

export function useComments(animeId?: number) {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["comments", animeId];
  const comments = useQuery({ queryKey, enabled: Boolean(animeId), queryFn: async () => {
    const { data, error } = await supabase.from("comments").select("id, user_id, content, episode_number, likes, created_at").eq("anime_id", animeId!).is("parent_id", null).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  } });
  const add = useMutation({ mutationFn: async (input: { content: string; episode?: number | null }) => {
    if (!user || !animeId) throw new Error("Sign in to post a comment.");
    const content = input.content.trim();
    if (!content || content.length > 2000) throw new Error("Comments must be between 1 and 2,000 characters.");
    const { error } = await supabase.from("comments").insert({ user_id: user.id, anime_id: animeId, episode_number: input.episode ?? null, content });
    if (error) throw error;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { comments, add };
}
