import { Alert, type AlertButton } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Anime } from "@/lib/types";
import { animeTitle } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { LIST_STATUS_LABELS, MANUAL_LIST_STATUSES, isMissingStatusColumnError, statusForNewBookmark, type ListStatus } from "@/lib/list-status";
import { useAnirakuAuth } from "@/providers/auth-provider";

/** Insert a bookmark row carrying `status`; falls back to the legacy shape. */
async function insertBookmarkRow(userId: string, anime: Anime, status: ListStatus) {
  const payload: Record<string, unknown> = { user_id: userId, anime_id: anime.id, title: animeTitle(anime), image: anime.coverImage?.extraLarge || anime.coverImage?.large || null, score: anime.averageScore ?? null, type: anime.format ?? null, added_at: Date.now(), status, total_episodes: anime.episodes ?? null };
  let { error } = await supabase.from("bookmarks").insert(payload);
  if (error && isMissingStatusColumnError(error)) {
    // Schema predates the list-status columns — retry the legacy shape.
    const legacy = { ...payload };
    delete legacy.status;
    delete legacy.total_episodes;
    ({ error } = await supabase.from("bookmarks").insert(legacy));
  }
  if (error) throw error;
}

export function useBookmarks() {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["bookmarks", user?.id];
  const bookmarks = useQuery({ queryKey, enabled: Boolean(user), queryFn: async () => { const { data, error } = await supabase.from("bookmarks").select("*").eq("user_id", user!.id).order("added_at", { ascending: false }); if (error) throw error; return data ?? []; } });
  const toggle = useMutation({ mutationFn: async (anime: Anime) => {
    if (!user) throw new Error("Sign in to save bookmarks.");
    const current = bookmarks.data?.find((bookmark) => bookmark.anime_id === anime.id);
    if (current) { const { error } = await supabase.from("bookmarks").delete().eq("id", current.id); if (error) throw error; return false; }
    // Plain saves default to Plan to Watch; the picker path (toggleWithPicker)
    // lets the user choose the list instead.
    await insertBookmarkRow(user.id, anime, statusForNewBookmark());
    return true;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  // Add with an explicit list choice (AniList/MAL-style "add to list").
  const add = useMutation({ mutationFn: async (input: { anime: Anime; status: ListStatus }) => {
    if (!user) throw new Error("Sign in to save bookmarks.");
    await insertBookmarkRow(user.id, input.anime, input.status);
    return true;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  /**
   * AniList/MAL-style save: removing an already-saved title just toggles it
   * off; saving a new one first asks which list it should go to (Watching /
   * Plan to Watch / Completed / Dropped) and lands it there.
   */
  const toggleWithPicker = (anime: Anime, callbacks?: { onSaved?: (status: ListStatus) => void; onRemoved?: () => void; onError?: (error: unknown) => void }) => {
    const saved = bookmarks.data?.some((bookmark) => Number(bookmark.anime_id) === anime.id);
    if (saved) {
      void toggle.mutateAsync(anime).then(() => callbacks?.onRemoved?.()).catch((error) => callbacks?.onError?.(error));
      return;
    }
    const options: AlertButton[] = MANUAL_LIST_STATUSES.map((status) => ({
      text: LIST_STATUS_LABELS[status],
      onPress: () => {
        void add.mutateAsync({ anime, status }).then(() => callbacks?.onSaved?.(status)).catch((error) => callbacks?.onError?.(error));
      },
    }));
    options.push({ text: "CANCEL", style: "cancel" });
    Alert.alert(`Add “${animeTitle(anime)}” to your list`, "Which list should it go to?", options);
  };
  // Manual category change from the Saved list (Watching / Plan to Watch /
  // Completed / Dropped): writes the chosen status onto the bookmark row.
  const updateStatus = useMutation({ mutationFn: async (input: { animeId: number; status: ListStatus }) => {
    if (!user) throw new Error("Sign in to update your list.");
    const row = bookmarks.data?.find((bookmark) => bookmark.anime_id === input.animeId);
    if (!row) throw new Error("That title isn't in your saved list.");
    const { error } = await supabase.from("bookmarks").update({ status: input.status }).eq("id", row.id);
    if (error) throw error;
    return true;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const clear = useMutation({ mutationFn: async () => { if (!user) return; const { error } = await supabase.from("bookmarks").delete().eq("user_id", user.id); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { bookmarks, toggle, add, updateStatus, toggleWithPicker, clear, isBookmarked: (animeId: number) => Boolean(bookmarks.data?.some((item) => item.anime_id === animeId)) };
}
