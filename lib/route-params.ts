/**
 * Deep-link and router params arrive as untrusted strings (expo-router may
 * also hand over string[] for repeated query keys, or undefined when a
 * segment is missing). Every id/episode read goes through here so a
 * malformed link renders an error screen instead of an infinite loader
 * (disabled queries stay `isPending` forever) or a NaN episode that
 * poisons API URLs, history keys, and provider sync.
 */

/** Positive-integer route id, or null when the param is missing/malformed. */
export function parseRouteId(value: string | readonly string[] | null | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Episode number: finite integers clamped to ≥ 1 (floored); garbage yields the fallback. */
export function parseRouteEpisode(
  value: string | readonly string[] | null | undefined,
  fallback = 1,
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}
