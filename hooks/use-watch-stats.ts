import { useMemo } from "react";
import { useWatchHistory } from "@/hooks/use-watch-history";

type WatchStats = {
  totalEpisodesWatched: number;
  totalMinutesWatched: number;
  totalHoursWatched: number;
  uniqueAnimeWatched: number;
  averageSessionMinutes: number;
  longestStreakDays: number;
  currentStreakDays: number;
  topGenres: Array<{ genre: string; count: number }>;
  favoriteAnime: Array<{ animeId: number; title: string; episodes: number }>;
  recentlyWatched: Array<{ animeId: number; title: string; episode: number; timestamp: number }>;
};

function computeStreak(timestamps: number[]): { current: number; longest: number } {
  if (!timestamps.length) return { current: 0, longest: 0 };
  const sorted = [...new Set(timestamps.map((t) => Math.floor(t / 86_400_000)))].sort((a, b) => a - b);
  let longest = 1;
  let current = 1;
  let maxLongest = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current++;
      longest++;
    } else if (sorted[i] === sorted[i - 1]) {
      // same day, no change
    } else {
      current = 1;
    }
    maxLongest = Math.max(maxLongest, longest);
  }
  // Current streak: count backwards from today
  const today = Math.floor(Date.now() / 86_400_000);
  let streak = 0;
  let checkDay = today;
  const daySet = new Set(sorted);
  while (daySet.has(checkDay)) {
    streak++;
    checkDay--;
  }
  return { current: streak, longest: maxLongest };
}

export function useWatchStats(): WatchStats {
  const { history } = useWatchHistory();
  const entries = history.data ?? [];

  return useMemo(() => {
    if (!entries.length) {
      return {
        totalEpisodesWatched: 0,
        totalMinutesWatched: 0,
        totalHoursWatched: 0,
        uniqueAnimeWatched: 0,
        averageSessionMinutes: 0,
        longestStreakDays: 0,
        currentStreakDays: 0,
        topGenres: [],
        favoriteAnime: [],
        recentlyWatched: [],
      };
    }

    const totalEpisodesWatched = entries.length;
    const totalMinutesWatched = entries.reduce((sum, e) => sum + Math.round((e.duration || 0) / 60), 0);
    const totalHoursWatched = Math.round(totalMinutesWatched / 60 * 10) / 10;
    const uniqueAnime = new Set(entries.map((e) => e.anime_id));
    const uniqueAnimeWatched = uniqueAnime.size;

    // Group by anime
    const animeMap = new Map<number, { title: string; episodes: Set<number> }>();
    for (const entry of entries) {
      const existing = animeMap.get(entry.anime_id);
      if (existing) {
        existing.episodes.add(entry.episode_number);
      } else {
        animeMap.set(entry.anime_id, { title: entry.anime_title || "Unknown", episodes: new Set([entry.episode_number]) });
      }
    }

    const favoriteAnime = [...animeMap.entries()]
      .map(([animeId, data]) => ({ animeId, title: data.title, episodes: data.episodes.size }))
      .sort((a, b) => b.episodes - a.episodes)
      .slice(0, 5);

    const timestamps = entries.map((e) => e.timestamp || 0).filter((t) => t > 0);
    const { current, longest } = computeStreak(timestamps);

    const recentlyWatched = entries
      .slice(0, 5)
      .map((e) => ({ animeId: e.anime_id, title: e.anime_title || "Unknown", episode: e.episode_number, timestamp: e.timestamp || 0 }));

    const averageSessionMinutes = totalEpisodesWatched > 0 ? Math.round(totalMinutesWatched / uniqueAnimeWatched) : 0;

    return {
      totalEpisodesWatched,
      totalMinutesWatched,
      totalHoursWatched,
      uniqueAnimeWatched,
      averageSessionMinutes,
      longestStreakDays: longest,
      currentStreakDays: current,
      topGenres: [],
      favoriteAnime,
      recentlyWatched,
    };
  }, [entries]);
}
