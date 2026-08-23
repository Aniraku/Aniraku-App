import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { canSubmitSharedComment, cleanCommentContent, isTrustedGiphyGifUrl } from "@/lib/comment-content";

export type SharedComment = {
  id: string;
  user_id: string;
  content: string;
  gif_url: string | null;
  is_spoiler: boolean;
  episode_number: number | null;
  likes: number | null;
  created_at: string;
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

export function useComments(animeId?: number) {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["comments", animeId];
  const comments = useQuery<SharedComment[]>({ queryKey, enabled: Boolean(animeId), queryFn: async () => {
    const { data, error } = await supabase.from("comments").select("id, user_id, content, gif_url, is_spoiler, episode_number, likes, created_at").eq("anime_id", animeId!).is("parent_id", null).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const rows = data ?? [];
    const authorIds = [...new Set(rows.map((comment) => comment.user_id).filter(Boolean))];
    if (!authorIds.length) return rows.map((comment) => ({ ...comment, author: null }));
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds);
    if (profilesError) return rows.map((comment) => ({ ...comment, author: null }));
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return rows.map((comment) => ({ ...comment, author: profileById.get(comment.user_id) ?? null }));
  } });
  const add = useMutation({ mutationFn: async (input: { content?: string; gifUrl?: string | null; spoiler?: boolean; episode?: number | null }) => {
    if (!user || !animeId) throw new Error("Sign in to post a comment.");
    const content = cleanCommentContent(input.content);
    const gifUrl = input.gifUrl && isTrustedGiphyGifUrl(input.gifUrl) ? input.gifUrl : null;
    if (!canSubmitSharedComment(content, gifUrl)) throw new Error("Add a comment or a GIF before posting.");
    if (input.gifUrl && !gifUrl) throw new Error("Only GIFs selected from the Aniraku picker can be attached.");
    const { error } = await supabase.from("comments").insert({ user_id: user.id, anime_id: animeId, episode_number: input.episode ?? null, content, gif_url: gifUrl, is_spoiler: Boolean(input.spoiler) });
    if (error) throw error;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { comments, add };
}
