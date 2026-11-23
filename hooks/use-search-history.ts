import { useCallback, useEffect, useState } from "react";
import {
  clearSearchHistoryStorage,
  entriesWithoutTerm,
  loadSearchHistory,
  nextEntriesAfterSearch,
  persistSearchHistory,
  type SearchHistoryEntry,
} from "@/lib/search-history";

/**
 * One recent-searches store for both search surfaces (Catalog tab + /search).
 * Loads from AsyncStorage on mount and persists via lib/search-history; screens
 * only call record/remove/clear.
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    let alive = true;
    void loadSearchHistory().then((entries) => {
      if (!alive) return;
      setRecent(entries);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Persist OUTSIDE the updater: React can run an updater twice (StrictMode),
  // and the write must follow the settled list, not a speculative one.
  useEffect(() => {
    persistSearchHistory(recent);
  }, [recent]);

  const record = useCallback((term: string) => {
    setRecent((current) => nextEntriesAfterSearch(current, term));
  }, []);

  const remove = useCallback((term: string) => {
    setRecent((current) => entriesWithoutTerm(current, term));
  }, []);

  const clear = useCallback(() => {
    setRecent([]);
    clearSearchHistoryStorage();
  }, []);

  return { recent, record, remove, clear };
}
