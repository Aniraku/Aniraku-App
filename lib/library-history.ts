// Watch-history presentation helpers shared by the Library History tab,
// the Home Continue Watching rail, and Saved-row progress meta.
//
// Why `timestamp` and not `updated_at`: import backdates `timestamp`
// (1h-per-episode, oldest first) so a bulk import lands at the right
// historical position, while `updated_at` is server `now()` — one import
// batch stamps every row with the same instant and floods any
// `updated_at`-based ordering with titles the user never watched that day.

export type HistoryLikeRow = {
  anime_id?: unknown;
  episode_number?: unknown;
  progress?: unknown;
  duration?: unknown;
  timestamp?: unknown;
  updated_at?: unknown;
};

/**
 * When the watch happened (ms epoch). Prefers the row's own `timestamp`
 * (written by the player and backdated by import); falls back to
 * `updated_at` for legacy rows. NaN when neither is usable.
 */
export function rowRecencyMs(row: HistoryLikeRow): number {
  const ts = Number(row.timestamp);
  if (Number.isFinite(ts) && ts > 0) return ts;
  const updated = row.updated_at ? Date.parse(String(row.updated_at)) : NaN;
  return Number.isFinite(updated) ? updated : NaN;
}

function latestRowOf<T extends HistoryLikeRow>(left: T, right: T): T {
  const leftTime = rowRecencyMs(left);
  const rightTime = rowRecencyMs(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    if (leftTime !== rightTime) return leftTime > rightTime ? left : right;
  } else if (Number(left.episode_number) !== Number(right.episode_number)) {
    return Number(left.episode_number) > Number(right.episode_number) ? left : right;
  }
  return left; // identical recency — keep the earlier in input order
}

/**
 * One row per anime — the most recently watched episode — sorted newest
 * first. Without this the History tab and Continue rail render one row per
 * episode, so an imported title with 148 rows buries everything else.
 */
export function groupLatestByAnime<T extends HistoryLikeRow>(rows: readonly T[]): T[] {
  const latest = new Map<number, T>();
  for (const row of rows) {
    const animeId = Number(row.anime_id);
    const episode = Number(row.episode_number);
    if (!Number.isInteger(animeId) || animeId <= 0 || !Number.isInteger(episode) || episode <= 0) {
      continue;
    }
    const current = latest.get(animeId);
    latest.set(animeId, current ? latestRowOf(row, current) : row);
  }
  return [...latest.values()].sort((left, right) => {
    const leftTime = rowRecencyMs(left);
    const rightTime = rowRecencyMs(right);
    // Unknown recency (offline fallback rows) keeps input order — stable.
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
    return rightTime - leftTime;
  });
}

/**
 * Distinct episodes counted as watched per anime: ≥80% through (or any
 * progress when the duration is unknown) — the same rule the hidden
 * watch-event status advance uses, so Saved badges and Saved progress
 * can never disagree. Import-synthesized rows are 100% and count,
 * matching what the provider already claims.
 */
export function countWatchedEpisodes(rows: readonly HistoryLikeRow[]): Map<number, number> {
  const watched = new Map<number, Set<number>>();
  for (const row of rows) {
    const animeId = Number(row.anime_id);
    const episode = Number(row.episode_number);
    if (!Number.isInteger(animeId) || animeId <= 0 || !Number.isInteger(episode) || episode <= 0) {
      continue;
    }
    const progress = Number(row.progress);
    const duration = Number(row.duration);
    const done = duration > 0 ? progress / duration >= 0.8 : progress > 0;
    if (!done) continue;
    const set = watched.get(animeId) ?? new Set<number>();
    set.add(episode);
    watched.set(animeId, set);
  }
  return new Map([...watched].map(([animeId, episodes]) => [animeId, episodes.size]));
}

/** Saved-row episode meta: "6/12 EP", "12 EP", "6 EP WATCHED", or null. */
export function savedEpisodeMeta(watched: number, total: number): string | null {
  const done = Math.max(0, Math.floor(Number(watched) || 0));
  const known = Math.max(0, Math.floor(Number(total) || 0));
  if (done > 0 && known > 0) return `${done}/${known} EP`;
  if (known > 0) return `${known} EP`;
  if (done > 0) return `${done} EP WATCHED`;
  return null;
}
