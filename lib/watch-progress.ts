export type ResumeHistory = { episode_number: number; progress: number; duration: number };

export function progressFraction(entry: ResumeHistory) {
  return entry.duration > 0 ? Math.max(0, Math.min(1, entry.progress / entry.duration)) : 0;
}

export function chooseResumeEpisode(entries: ResumeHistory[], fallback = 1) {
  const completed = entries.filter((entry) => progressFraction(entry) >= 0.9).map((entry) => entry.episode_number);
  if (completed.length) return Math.max(...completed) + 1;
  const partial = entries.find((entry) => progressFraction(entry) > 0);
  return partial?.episode_number ?? fallback;
}

// TRACK4-PROBE: if this line persists, the edit tool works.
export const TRACK4_PROBE = true;

export const LOCAL_WATCH_KEY_PREFIX = "aniraku-watch-local:";

export function localWatchKey(animeId: number, episode: number) {
  return `${LOCAL_WATCH_KEY_PREFIX}${animeId}:${episode}`;
}

export type LocalWatchEntry = {
  animeId: number;
  episode: number;
  progress: number;
  duration: number;
  savedAt: number;
  completed?: boolean;
};

/** Parse one local watch entry; null when malformed or nothing to resume. */
export function parseLocalWatchEntry(animeId: number, episode: number, stored: string | null): LocalWatchEntry | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { progress?: unknown; duration?: unknown; savedAt?: unknown; completed?: unknown };
    const progress = Number(parsed.progress);
    const duration = Number(parsed.duration);
    if (!Number.isFinite(progress) || !Number.isFinite(duration) || duration <= 0) return null;
    return {
      animeId,
      episode,
      progress,
      duration,
      savedAt: Number(parsed.savedAt) || 0,
      completed: parsed.completed === true,
    };
  } catch {
    return null;
  }
}
