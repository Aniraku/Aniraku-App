import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

export function useEpisodeRatings(animeId?: number) {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["episode-ratings", user?.id, animeId];
  const ratings = useQuery({ queryKey, enabled: Boolean(user && animeId), queryFn: async () => { const { data, error } = await supabase.from("episode_ratings").select("episode_number, score").eq("user_id", user!.id).eq("anime_id", animeId!); if (error) throw error; return data ?? []; } });
  const setRating = useMutation({ mutationFn: async (input: { episode: number; score: number }) => { if (!user || !animeId) throw new Error("Sign in to rate episodes."); if (input.score < 1 || input.score > 10) throw new Error("Ratings must be between 1 and 10."); const { error } = await supabase.from("episode_ratings").upsert({ user_id: user.id, anime_id: animeId, episode_number: input.episode, score: input.score }, { onConflict: "user_id,anime_id,episode_number" }); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { ratings, setRating, scoreFor: (episode: number) => ratings.data?.find((rating) => rating.episode_number === episode)?.score };
}
