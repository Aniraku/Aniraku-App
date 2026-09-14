export type EpisodeNotificationInput = {
  animeId: number;
  title: string;
  episode: number;
};

export const EPISODE_NOTIFICATION_STORAGE_KEY = "aniraku.episode-notifs.v1";

export function episodeNotificationKey(animeId: number, episode: number): string {
  return `${animeId}:${episode}`;
}

export function buildEpisodeNotificationContent(input: EpisodeNotificationInput): {
  title: string;
  body: string;
  data: { animeId: number; episode: number };
} {
  const episode = Math.max(1, Math.floor(input.episode));
  return {
    title: input.title.trim() || "Aniraku",
    body: `Episode ${episode} is now available`,
    data: { animeId: input.animeId, episode },
  };
}

export function parseScheduledEpisodeKeys(raw: string | null): Set<string> {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return new Set(parsed.filter((item) => typeof item === "string"));
    if (parsed && typeof parsed === "object") return new Set(Object.keys(parsed));
  } catch {
    // Corrupted storage means no dedupe memory; callers reschedule once.
  }
  return new Set();
}

export function shouldScheduleEpisodeNotification(
  scheduled: Set<string> | readonly string[] | Record<string, unknown> | null | undefined,
  animeId: number,
  episode: number,
): boolean {
  if (!Number.isInteger(animeId) || animeId <= 0) return false;
  if (!Number.isInteger(episode) || episode <= 0) return false;
  const key = episodeNotificationKey(animeId, episode);
  if (scheduled instanceof Set) return !scheduled.has(key);
  if (Array.isArray(scheduled)) return !scheduled.includes(key);
  if (scheduled && typeof scheduled === "object") return !(key in scheduled);
  return true;
}

export function withScheduledEpisodeKey(scheduled: Set<string>, animeId: number, episode: number): string[] {
  const next = new Set(scheduled);
  next.add(episodeNotificationKey(animeId, episode));
  // Bound growth: saved-library checks run for years; keep the recent window.
  const values = [...next];
  return values.slice(Math.max(0, values.length - 500));
}
