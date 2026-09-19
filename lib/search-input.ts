/**
 * Search-as-you-type commit timing, tuned for the temporary AniList
 * 30 req/min cap: a query fires when a word/sentence unit finishes, not on
 * every keystroke and not after one arbitrary debounce.
 *
 * - Text ending in whitespace or sentence punctuation means the user finished
 *   a word/sentence → short 250ms confirmation delay.
 * - A hard pause mid-word (900ms of no keys) means they stopped typing → commit.
 * - Enter/submit always commits immediately (handled by the caller).
 */

export const WORD_END_COMMIT_MS = 250;
export const MID_WORD_COMMIT_MS = 900;

/** Whitespace plus the punctuation that reads as "word/sentence finished". */
const WORD_END_PATTERN = /[\s.,!?;:·—–-]$/;

/**
 * Pure decision for the search effect: how long to wait after the last
 * keystroke before committing `text` as a query.
 */
export function searchCommitDelayMs(text: string): number {
  const value = String(text ?? "");
  if (!value) return MID_WORD_COMMIT_MS;
  return WORD_END_PATTERN.test(value) ? WORD_END_COMMIT_MS : MID_WORD_COMMIT_MS;
}
