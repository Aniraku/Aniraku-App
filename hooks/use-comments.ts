import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { canSubmitSharedComment, cleanCommentContent } from "@/lib/comment-content";

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

export type SharedReply = SharedComment & { parent_id: string | null };

export function useComments(animeId?: number, episodeNumber?: number) {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["comments", animeId, episodeNumber ?? "all"];
  const comments = useQuery<SharedComment[]>({ queryKey, enabled: Boolean(animeId), queryFn: async () => {
    let request = supabase.from("comments").select("id, user_id, content, gif_url, is_spoiler, episode_number, likes, created_at").eq("anime_id", animeId!).is("parent_id", null);
    if (typeof episodeNumber === "number") request = request.eq("episode_number", episodeNumber);
    const { data, error } = await request.order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const rows = data ?? [];
    const authorIds = [...new Set(rows.map((comment) => comment.user_id).filter(Boolean))];
    if (!authorIds.length) return rows.map((comment) => ({ ...comment, author: null }));
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds);
    if (profilesError) return rows.map((comment) => ({ ...comment, author: null }));
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return rows.map((comment) => ({ ...comment, author: profileById.get(comment.user_id) ?? null }));
  } });
  const commentIds = (comments.data ?? []).map((comment) => comment.id);
  const likesKey = ["comment-likes", animeId, episodeNumber ?? "all", user?.id ?? "guest"];
  const liked = useQuery<Set<string>>({ queryKey: likesKey, enabled: Boolean(animeId) && Boolean(user) && commentIds.length > 0, queryFn: async () => {
    const { data, error } = await supabase.from("comment_likes").select("comment_id").eq("user_id", user!.id).in("comment_id", commentIds);
    if (error) throw error;
    return new Set((data ?? []).map((row) => String(row.comment_id)));
  } });
  const repliesKey = ["comment-replies", animeId, episodeNumber ?? "all"];
  const replies = useQuery<SharedReply[]>({ queryKey: repliesKey, enabled: Boolean(animeId) && commentIds.length > 0, queryFn: async () => {
    const { data, error } = await supabase.from("comments").select("id, user_id, content, gif_url, is_spoiler, episode_number, likes, created_at, parent_id").eq("anime_id", animeId!).not("parent_id", "is", null).in("parent_id", commentIds).order("created_at", { ascending: true }).limit(200);
    if (error) throw error;
    const rows = (data ?? []) as SharedReply[];
    const authorIds = [...new Set(rows.map((comment) => comment.user_id).filter(Boolean))];
    if (!authorIds.length) return rows.map((comment) => ({ ...comment, author: null }));
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds);
    if (profilesError) return rows.map((comment) => ({ ...comment, author: null }));
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return rows.map((comment) => ({ ...comment, author: profileById.get(comment.user_id) ?? null }));
  } });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: repliesKey });
    void queryClient.invalidateQueries({ queryKey: likesKey });
  };
  const add = useMutation({ mutationFn: async (input: { content?: string; spoiler?: boolean; episode?: number | null; parentId?: string | null }) => {
    if (!user || !animeId) throw new Error("Sign in to post a comment.");
    const content = cleanCommentContent(input.content);
    if (!canSubmitSharedComment(content)) throw new Error("Write a comment before posting.");
    const { error } = await supabase.from("comments").insert({ user_id: user.id, anime_id: animeId, episode_number: input.episode ?? episodeNumber ?? null, parent_id: input.parentId ?? null, content, gif_url: null, is_spoiler: Boolean(input.spoiler) });
    if (error) throw error;
  }, onSuccess: refresh });
  const toggleLike = useMutation({ mutationFn: async (comment: SharedComment) => {
    if (!user) throw new Error("Sign in to like comments.");
    const isLiked = liked.data?.has(comment.id);
    // Optimistically update the UI
    queryClient.setQueryData<Set<string>>(likesKey, (prev) => {
      const next = new Set(prev ?? []);
      if (isLiked) next.delete(comment.id);
      else next.add(comment.id);
      return next;
    });
    queryClient.setQueryData<SharedComment[]>(queryKey, (prev) =>
      (prev ?? []).map((c) => c.id === comment.id ? { ...c, likes: Math.max(0, (c.likes ?? 0) + (isLiked ? -1 : 1)) } : c)
    );
    try {
      if (isLiked) {
        const { error } = await supabase.from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", comment.id);
        if (error) throw error;
        const { error: countError } = await supabase.rpc("decrement_comment_likes", { comment_id_input: comment.id });
        if (countError) {
          // Fallback to direct update if RPC not available
          await supabase.from("comments").update({ likes: Math.max(0, (comment.likes ?? 1) - 1) }).eq("id", comment.id);
        }
      } else {
        const { error } = await supabase.from("comment_likes").insert({ user_id: user.id, comment_id: comment.id });
        if (error) throw error;
        const { error: countError } = await supabase.rpc("increment_comment_likes", { comment_id_input: comment.id });
        if (countError) {
          // Fallback to direct update if RPC not available
          await supabase.from("comments").update({ likes: (comment.likes ?? 0) + 1 }).eq("id", comment.id);
        }
      }
    } catch (err) {
      // Revert optimistic update on error
      queryClient.setQueryData<Set<string>>(likesKey, (prev) => {
        const next = new Set(prev ?? []);
        if (isLiked) next.add(comment.id);
        else next.delete(comment.id);
        return next;
      });
      queryClient.setQueryData<SharedComment[]>(queryKey, (prev) =>
        (prev ?? []).map((c) => c.id === comment.id ? { ...c, likes: (c.likes ?? 0) + (isLiked ? 1 : -1) } : c)
      );
      throw err;
    }
  }, onSuccess: refresh });
  const remove = useMutation({ mutationFn: async (commentId: string) => {
    if (!user) throw new Error("Sign in to delete comments.");
    const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id);
    if (error) throw error;
  }, onSuccess: refresh });
  return { comments, replies, likedIds: liked.data ?? new Set<string>(), add, toggleLike, remove };
}
