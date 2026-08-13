import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Anime } from "@/lib/types";
import { animeTitle } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

export function useBookmarks() {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["bookmarks", user?.id];
  const bookmarks = useQuery({ queryKey, enabled: Boolean(user), queryFn: async () => { const { data, error } = await supabase.from("bookmarks").select("*").eq("user_id", user!.id).order("added_at", { ascending: false }); if (error) throw error; return data ?? []; } });
  const toggle = useMutation({ mutationFn: async (anime: Anime) => {
    if (!user) throw new Error("Sign in to save bookmarks.");
    const current = bookmarks.data?.find((bookmark) => bookmark.anime_id === anime.id);
    if (current) { const { error } = await supabase.from("bookmarks").delete().eq("id", current.id); if (error) throw error; return false; }
    const { error } = await supabase.from("bookmarks").insert({ user_id: user.id, anime_id: anime.id, title: animeTitle(anime), image: anime.coverImage?.extraLarge || anime.coverImage?.large || null, score: anime.averageScore ?? null, type: anime.format ?? null, added_at: Date.now() });
    if (error) throw error;
    return true;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const clear = useMutation({ mutationFn: async () => { if (!user) return; const { error } = await supabase.from("bookmarks").delete().eq("user_id", user.id); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { bookmarks, toggle, clear, isBookmarked: (animeId: number) => Boolean(bookmarks.data?.some((item) => item.anime_id === animeId)) };
}
