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
