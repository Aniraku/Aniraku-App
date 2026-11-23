import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Recent-search history shared by the Catalog tab and the /search screen.
 * Pure parts are exported for tests; the storage wrappers are thin.
 */

export type SearchHistoryEntry = { term: string; timestamp: number };

const STORAGE_KEY = "aniraku.search.recent";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SEARCH_HISTORY_LIMIT = 6;

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function pruneOldEntries(entries: SearchHistoryEntry[]): SearchHistoryEntry[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  return entries.filter((e) => e.timestamp > cutoff);
}

export function upgradeLegacyEntries(raw: unknown): SearchHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { term: item, timestamp: Date.now() };
    if (item && typeof item === "object" && "term" in item && "timestamp" in item) return item as SearchHistoryEntry;
    return null;
  }).filter((e): e is SearchHistoryEntry => e !== null);
}

/** Deduped, newest-first, capped. Pure — the caller persists the result. */
export function nextEntriesAfterSearch(entries: SearchHistoryEntry[], term: string): SearchHistoryEntry[] {
  const filtered = entries.filter((item) => item.term.toLowerCase() !== term.toLowerCase());
  return [{ term, timestamp: Date.now() }, ...filtered].slice(0, SEARCH_HISTORY_LIMIT);
}

export function entriesWithoutTerm(entries: SearchHistoryEntry[], term: string): SearchHistoryEntry[] {
  return entries.filter((e) => e.term.toLowerCase() !== term.toLowerCase());
}

export async function loadSearchHistory(): Promise<SearchHistoryEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const pruned = pruneOldEntries(upgradeLegacyEntries(JSON.parse(stored)));
    return pruned;
  } catch {
    return [];
  }
}

export function persistSearchHistory(entries: SearchHistoryEntry[]) {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
}

export function clearSearchHistoryStorage() {
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
