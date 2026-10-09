// List-status model — exact port of Miruro `src/lib/listStatus.ts`.
// Every bookmark carries one of six statuses (AniList vocabulary).
// Import persists the provider's status per title; export writes the same
// status back; local watch events auto-advance it (PLANNING → CURRENT →
// COMPLETED, any post-completion watch → REPEATING). DROPPED / PAUSED are
// explicit user actions only — never auto-derived.
//
// Stored on the bookmark row (`status` column, AniList-style uppercase).
// Unknown / legacy rows without a status read as null and fall back to
// the old watching/completed derivation at each call site.

export const LIST_STATUSES = [
  "CURRENT",
  "PLANNING",
  "COMPLETED",
  "PAUSED",
  "DROPPED",
  "REPEATING",
] as const;

export type ListStatus = (typeof LIST_STATUSES)[number];

/** Provider-facing labels for the six statuses. */
export const LIST_STATUS_LABELS: Record<ListStatus, string> = {
  CURRENT: "Watching",
  PLANNING: "Plan to Watch",
  COMPLETED: "Completed",
  PAUSED: "Paused",
  DROPPED: "Dropped",
  REPEATING: "Rewatching",
};

export function isListStatus(value: unknown): value is ListStatus {
  return (
    typeof value === "string" &&
    (LIST_STATUSES as readonly string[]).includes(value.toUpperCase())
  );
}

/** Normalize any stored / provider value to canonical uppercase, or null. */
export function normalizeListStatus(value: unknown): ListStatus | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  // Canonical AniList-style values (CURRENT included — the old legacy-only
  // lookup map rejected stored "CURRENT" rows and null'd them out).
  if ((LIST_STATUSES as readonly string[]).includes(upper)) return upper as ListStatus;
  // Legacy backend lowercase canonical (`watching` → CURRENT).
  if (upper === "WATCHING") return "CURRENT";
  return null;
}

/** AniList MediaListStatus → canonical (REPEATING preserved, not folded). */
export function anilistToListStatus(value: unknown): ListStatus | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if ((LIST_STATUSES as readonly string[]).includes(upper)) {
    return upper as ListStatus;
  }
  return null;
}

/** MAL list_status → canonical (MAL has no rewatching state). */
export function malToListStatus(value: unknown): ListStatus | null {
  if (typeof value !== "string") return null;
  switch (value.trim().toLowerCase()) {
    case "watching":
      return "CURRENT";
    case "completed":
      return "COMPLETED";
    case "on_hold":
      return "PAUSED";
    case "dropped":
      return "DROPPED";
    case "plan_to_watch":
      return "PLANNING";
    default:
      return null;
  }
}

/** Canonical → AniList mutation status. */
export function listStatusToAnilist(status: ListStatus): string {
  return status;
}

/** Canonical → MAL PATCH status (no rewatching flag — stays `watching`). */
export function listStatusToMal(status: ListStatus): string {
  switch (status) {
    case "CURRENT":
    case "REPEATING":
      return "watching";
    case "COMPLETED":
      return "completed";
    case "PAUSED":
      return "on_hold";
    case "DROPPED":
      return "dropped";
    case "PLANNING":
      return "plan_to_watch";
  }
}

export interface StatusDerivationInput {
  /** Previously stored status (null = unknown / legacy row). */
  previous: ListStatus | null;
  /** Distinct episodes with a watch record for this anime. */
  watchedCount: number;
  /** Known episode total (0/unknown = cannot auto-complete). */
  total: number;
}

/**
 * Next status after a watch event. Pure — callers persist the result.
 * COMPLETED requires a known total (never guessed); DROPPED / PAUSED pass
 * through untouched (explicit-only).
 */
export function deriveStatusAfterWatch(input: StatusDerivationInput): ListStatus {
  const { previous, watchedCount, total } = input;
  if (previous === "DROPPED" || previous === "PAUSED") return previous;
  if (total > 0 && watchedCount >= total) return "COMPLETED";
  if (previous === "COMPLETED") return "REPEATING";
  return "CURRENT";
}

/** Status for a brand-new bookmark (nothing watched yet). */
export function statusForNewBookmark(): ListStatus {
  return "PLANNING";
}

/**
 * PostgREST "column does not exist" shape — older deployments predate the
 * `status` / `total_episodes` columns. Writers retry the legacy row shape;
 * readers fall back to null (ported from Miruro `isMissingColumnError`).
 */
export function isMissingStatusColumnError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  if (code === "42703") return true; // postgres: undefined_column
  if (code === "PGRST204") return true; // PostgREST: schema-cache column miss
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  return /column .* does not exist/i.test(message) || /Could not find the '.*' column/i.test(message);
}
