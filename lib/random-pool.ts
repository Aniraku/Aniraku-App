/**
 * Shared Random-pool page selection. Both the startup prefetch and the Random
 * tab must read the SAME randomized pages within one app session, so the
 * prefetched query key matches the key the tab queries — otherwise the
 * prefetch is a wasted request (exactly what happens under the temporary
 * 30 req/min AniList cap).
 */

/**
 * AniList rejects any Page whose depth exceeds 5,000 entries
 * (`page × perPage`), with:
 * "Page depth exceeds maximum allowed for API requests (5000 entries)".
 * The pool uses perPage 50, so pages must stay at or below
 * floor(5000 / 50) = 100. We keep a safety margin at 90
 * (90 × 50 = 4,500) so filtered sorts with sparse tails can never
 * trip the limit.
 */
export const ANILIST_PAGE_DEPTH_LIMIT = 5000;
export const RANDOM_PER_PAGE = 50;
export const RANDOM_MAX_PAGE = 90;

/**
 * Three distinct random pages in [1, RANDOM_MAX_PAGE]. 90 × perPage 50 =
 * 4,500 titles — safely under AniList's 5,000-entry page-depth limit.
 * (The old 300 cap produced 300 × 50 = 15,000 and surfaced the
 * "Page depth exceeds maximum" error banner.)
 *
 * Depth safety is enforced at the request layer (clampAniListPage in
 * lib/anilist), so every triple dealt here is safe by construction.
 */
export function randomPages(maxPage: number = RANDOM_MAX_PAGE): [number, number, number] {
  const clamp = Math.max(1, Math.floor(maxPage));
  const pick = () => Math.floor(Math.random() * clamp) + 1;
  const a = pick();
  let b = pick();
  let c = pick();
  while (b === a) b = pick();
  while (c === a || c === b) c = pick();
  return [a, b, c];
}

/**
 * Session-stable page triple: generated once per app run, then reused by
 * every caller until the process restarts. `regenerate()` deals a new triple
 * (used when the shuffle bag runs dry after ~150 picks).
 */
let sessionPages: [number, number, number] | null = null;

export function sessionRandomPages(): [number, number, number] {
  if (!sessionPages) sessionPages = randomPages();
  return sessionPages;
}

export function regenerateRandomPages(): [number, number, number] {
  sessionPages = randomPages();
  return sessionPages;
}

/** Test hook: clears the module-scoped session state. */
export function resetRandomPagesForTests() {
  sessionPages = null;
}

/**
 * Pure decision for the pool query: when the fetched pool is too thin to be
 * worth showing (< `minTitles`), try the known-good front pages once before
 * surfacing an error.
 */
export function shouldFallbackToFirstPages(poolSize: number, minTitles = 10): boolean {
  return Number.isFinite(poolSize) && poolSize < minTitles;
}
