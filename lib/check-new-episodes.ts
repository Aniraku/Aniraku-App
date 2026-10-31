/**
 * Client-side trigger for the check-new-episodes Edge Function.
 *
 * The server iterates every bookmarked anime, compares current /track counts
 * against the persisted anime_track_state, and sends pushes to every user who
 * bookmarked an anime whose sub/dub count grew. Call on app launch (signed-in
 * users only) so new episodes surface via push even when the app is closed.
 */
import { supabase } from "@/lib/supabase";

export type CheckNewEpisodesResult = {
  checked: number;
  newEpisodes: Array<{ animeId: number; sub?: number; dub?: number }>;
  sent: number;
  failed: number;
};

/** Ask the server to scan bookmarked anime for new sub/dub episodes and push users. */
export async function checkNewEpisodes(): Promise<CheckNewEpisodesResult> {
  const { error, data } = await supabase.functions.invoke("check-new-episodes", {
    body: {},
  });
  if (error) throw error;
  return (data as CheckNewEpisodesResult) ?? { checked: 0, newEpisodes: [], sent: 0, failed: 0 };
}
