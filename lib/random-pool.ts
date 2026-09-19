/**
 * Shared Random-pool page selection. Both the startup prefetch and the Random
 * tab must read the SAME randomized pages within one app session, so the
 * prefetched query key matches the key the tab queries — otherwise the
 * prefetch is a wasted request (exactly what happens under the temporary
 * 30 req/min AniList cap).
 */

export const RANDOM_MAX_PAGE = 300;

/**
 * Three distinct random pages in [1, RANDOM_MAX_PAGE]. 300 × perPage 50 =
 * 15,000 titles — comfortably inside the real non-adult catalog, so a pool is
 * never empty (page 500 exceeded it and produced the error banner).
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
