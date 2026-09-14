export type EpisodeNumberLike = { number: number };

export const RESUME_ROWS_STORAGE_KEY = "aniraku.resume-rows.v1";
export const RESUME_ROWS_STALE_MS = 6 * 60 * 60 * 1000;

export function resolveNextEpisode(current: number, episodes: readonly EpisodeNumberLike[]): number | null {
  let next: number | null = null;
  for (const item of episodes) {
    const value = Number(item.number);
    if (!Number.isInteger(value) || value <= current) continue;
    if (next === null || value < next) next = value;
  }
  return next;
}

export function resolvePrevEpisode(current: number, episodes: readonly EpisodeNumberLike[]): number | null {
  let previous: number | null = null;
  for (const item of episodes) {
    const value = Number(item.number);
    if (!Number.isInteger(value) || value >= current) continue;
    if (previous === null || value > previous) previous = value;
  }
  return previous;
}

export type HistoryRowLike = {
  anime_id: number;
  anime_title?: string | null;
  anime_image?: string | null;
  episode_number: number;
  progress: number;
  duration: number;
  updated_at?: string | null;
};

export type ResumeRow = {
  animeId: number;
  animeTitle: string;
  animeImage: string | null;
  episode: number;
  progress: number;
  duration: number;
  percent: number;
  updatedAt: string | null;
};

function resumePercent(progress: number, duration: number): number {
  if (!Number.isFinite(progress) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress / duration) * 100)));
}

/**
 * Precomputed continue-watching rows, one per anime. Picks the most recently
 * updated entry per title so Library opens instantly offline and then
 * stale-while-revalidates against the live query.
 */
export function buildResumeRows(entries: readonly HistoryRowLike[]): ResumeRow[] {
  const latest = new Map<number, HistoryRowLike>();
  for (const entry of entries) {
    const animeId = Number(entry.anime_id);
    const episode = Number(entry.episode_number);
    if (!Number.isInteger(animeId) || animeId <= 0) continue;
    if (!Number.isInteger(episode) || episode <= 0) continue;
    const current = latest.get(animeId);
    if (!current) {
      latest.set(animeId, entry);
      continue;
    }
    const nextTime = entry.updated_at ? Date.parse(entry.updated_at) : NaN;
    const currentTime = current.updated_at ? Date.parse(current.updated_at) : NaN;
    if (Number.isFinite(nextTime) && Number.isFinite(currentTime)) {
      if (nextTime > currentTime) latest.set(animeId, entry);
    } else if (episode > current.episode_number) {
      latest.set(animeId, entry);
    }
  }
  return [...latest.values()]
    .map((entry) => ({
      animeId: entry.anime_id,
      animeTitle: entry.anime_title || "Anime",
      animeImage: entry.anime_image ?? null,
      episode: entry.episode_number,
      progress: entry.progress,
      duration: entry.duration,
      percent: resumePercent(entry.progress, entry.duration),
      updatedAt: entry.updated_at ?? null,
    }))
    .sort((left, right) => {
      const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : NaN;
      const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : NaN;
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return rightTime - leftTime;
      return right.episode - left.episode;
    });
}

export function isResumeRowsStale(savedAt: number | null, now = Date.now(), ttlMs = RESUME_ROWS_STALE_MS): boolean {
  if (!Number.isFinite(savedAt) || (savedAt as number) <= 0) return true;
  return now - (savedAt as number) > ttlMs;
}

export function isWideLayout(width: number, breakpoint = 900): boolean {
  return Number.isFinite(width) && width >= breakpoint;
}
