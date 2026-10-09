// Saved-row list-status presentation — the app-side half of the Miruro
// `Profile.tsx` bookmark mechanism (read-only badges + status filter chips;
// statuses themselves come from import and watch-event auto-advance).
import { LIST_STATUSES, normalizeListStatus, type ListStatus } from "@/lib/list-status";

/** Shape of a bookmarks row as far as status display cares. */
export type BookmarkStatusRow = { anime_id?: unknown; status?: unknown };

/**
 * Status shown on a Saved row. A stored status always wins (import or a
 * watch-event advance wrote it); legacy rows without one fall back to the
 * old watching/plan-to-watch derivation from local history. Paused and
 * Dropped are never derived — they stay explicit-only.
 */
export function bookmarkDisplayStatus(row: BookmarkStatusRow | null | undefined, hasWatchHistory: boolean): ListStatus {
  const stored = normalizeListStatus(row?.status);
  if (stored) return stored;
  return hasWatchHistory ? "CURRENT" : "PLANNING";
}

/**
 * Miruro Profile chip model: one count per status over the full Saved list
 * (chips with a zero count are hidden at the call site).
 */
export function statusCounts(rows: readonly BookmarkStatusRow[], watchedAnimeIds: ReadonlySet<number>): Record<ListStatus, number> {
  const counts = Object.fromEntries(LIST_STATUSES.map((status) => [status, 0])) as Record<ListStatus, number>;
  for (const row of rows) {
    const status = bookmarkDisplayStatus(row, watchedAnimeIds.has(Number(row?.anime_id)));
    counts[status] += 1;
  }
  return counts;
}

/** Apply the active status chip ("ALL" passes everything through). */
export function filterByListStatus<T extends BookmarkStatusRow>(
  rows: readonly T[],
  watchedAnimeIds: ReadonlySet<number>,
  filter: ListStatus | "ALL",
): readonly T[] {
  if (filter === "ALL") return rows;
  return rows.filter((row) => bookmarkDisplayStatus(row, watchedAnimeIds.has(Number(row?.anime_id))) === filter);
}
