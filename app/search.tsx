import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { getAnimePage, isAniListRateLimitError, sanitizeMediaFormat, sanitizeMediaSortList, sanitizeMediaStatus } from "@/lib/anilist";
import { searchCommitDelayMs } from "@/lib/search-input";
import { nsfwFilterParam, useNsfwPreference } from "@/lib/nsfw-preference";
import { EMPTY_FILTERS, QUICK_GENRES, coerceFilters, countActiveFilters, filterSignature, hasActiveFilters, type SearchFilters } from "@/lib/search-filters";
import { type Anime } from "@/lib/types";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { SearchFilterSheet } from "@/components/search-filter-sheet";
import { SearchResultRow } from "@/components/search-result-row";
import { showThemedDialog } from "@/components/choice-sheet";
import { useRecentSearches } from "@/hooks/use-search-history";
import { relativeTime } from "@/lib/search-history";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ genre?: string; sort?: string | string[]; status?: string; format?: string; title?: string }>();
  const genreFilter = typeof params.genre === "string" && params.genre.trim() ? params.genre.trim().slice(0, 40) : null;
  // Rail "View all" links, shared URLs, and typed deep links all land here —
  // every enum slot is allowlisted so a stale/crafted param degrades to the
  // default browse instead of 400ing the whole screen. sanitizeMediaSortList
  // also tolerates expo-router's string[] shape (multi ?sort= params).
  const sortFilter = sanitizeMediaSortList(params.sort ?? null);
  const statusFilter = sanitizeMediaStatus(params.status);
  const formatFilter = sanitizeMediaFormat(params.format);
  const categoryTitle = params.title || null;
  const nsfw = useNsfwPreference();
  const isAdultParam = nsfwFilterParam(nsfw.enabled);
  const [input, setInput] = useState("");
  const normalizedInput = input.trim().replace(/\s+/g, " ");
  const [query, setQuery] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const { recent, record: recordRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches();
  const [filters, setFilters] = useState<SearchFilters>(() => coerceFilters({ sort: sortFilter?.[0], status: statusFilter, format: formatFilter }));
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Word-boundary commit: the query fires when a word/sentence unit finishes
    // (trailing space/punctuation → quick confirm) or when typing pauses
    // mid-word. Enter still commits instantly. Cheaper than a flat debounce
    // under the temporary 30 req/min AniList cap.
    const delay = searchCommitDelayMs(normalizedInput);
    const timer = setTimeout(() => setQuery(normalizedInput), delay);
    return () => clearTimeout(timer);
  }, [normalizedInput]);

  const waitingForInput = normalizedInput.length > 1 && query !== normalizedInput;
  const hasCategory = Boolean(genreFilter || sortFilter || statusFilter || formatFilter);
  const isCategoryMode = hasCategory;
  const categoryLabel = categoryTitle || genreFilter || "BROWSE";
  const hasQuery = query.length > 1;
  const hasLocalFilters = hasActiveFilters(filters);
  const results = useInfiniteQuery({
    queryKey: ["search", query, genreFilter, sortFilter?.join(","), statusFilter, formatFilter, isAdultParam, filterSignature(filters)],
    queryFn: ({ pageParam }) => getAnimePage({
      search: hasQuery ? query : undefined,
      page: pageParam,
      perPage: 20,
      genre: genreFilter || undefined,
      sort: [filters.sort ?? sortFilter?.[0] ?? (hasQuery ? "SEARCH_MATCH" : "POPULARITY_DESC")],
      status: filters.status ?? statusFilter ?? undefined,
      format: filters.format ?? formatFilter ?? undefined,
      season: filters.season ?? undefined,
      seasonYear: filters.year ? Number(filters.year) : undefined,
      isAdult: isAdultParam,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage?.pageInfo?.hasNextPage ? (lastPage.pageInfo.currentPage ?? 1) + 1 : undefined),
    enabled: isCategoryMode || hasQuery || hasLocalFilters,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    retry: (failureCount, error) => !isAniListRateLimitError(error) && failureCount < 1,
    retryDelay: 1_200,
  });

  /** Deduped across pages — a refetch mid-scroll can overlap ids. */
  const media = useMemo(() => {
    const seen = new Set<number>();
    const merged: Anime[] = [];
    for (const page of results.data?.pages ?? []) {
      for (const item of page?.media ?? []) {
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  }, [results.data]);
  const rateLimitError = isAniListRateLimitError(results.error) ? results.error : null;
  const retryAfterMs = rateLimitError?.retryAfterMs ?? null;

  useEffect(() => {
    if (retryAfterMs === null) { setRetryAt(null); return; }
    setRetryAt((current) => current && current > Date.now() ? current : Date.now() + retryAfterMs);
  }, [retryAfterMs]);

  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [retryAt]);

  const retryIsBlocked = Boolean(retryAt && now < retryAt);
  const retrySeconds = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
  const retrySearch = () => {
    if (retryIsBlocked) return;
    setRetryAt(null);
    void results.refetch();
  };

  useEffect(() => {
    if (!results.isSuccess || query.length < 2) return;
    recordRecent(query);
  }, [query, results.isSuccess, recordRecent]);

  const deleteHistoryItem = useCallback((term: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showThemedDialog({
      kicker: "HISTORY",
      title: "Remove from history?",
      message: `"${term}" will leave your search history.`,
      confirmLabel: "DELETE",
      destructive: true,
      onConfirm: () => removeRecent(term),
    });
  }, []);

  const isIdle = !isCategoryMode && normalizedInput.length <= 1 && !hasLocalFilters;
  const activeFilterCount = countActiveFilters(filters);

  const openAnime = useCallback((id: number) => router.push((`/anime/${id}`) as never), []);
  const renderResult = useCallback(({ item }: { item: Anime }) => (
    <SearchResultRow anime={item} onPress={() => openAnime(item.id)} />
  ), [openAnime]);
  const refetchResults = results.refetch;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refetchResults().finally(() => setRefreshing(false));
  }, [refetchResults]);
  const loadMore = useCallback(() => {
    if (!results.hasNextPage || results.isFetchingNextPage || retryIsBlocked) return;
    void results.fetchNextPage().catch(() => {});
  }, [results.hasNextPage, results.isFetchingNextPage, results.fetchNextPage, retryIsBlocked]);

  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <AppIcon name="arrow-left" size={21} color={nothing.white} />
      </Pressable>
      <View style={styles.searchInputWrap}>
        <AppIcon name="magnify" size={18} color={nothing.muted} />
        <TextInput accessibilityRole="search" accessibilityLabel="Search anime" autoFocus={!isCategoryMode} value={input} onChangeText={setInput} onSubmitEditing={() => setQuery(normalizedInput)} placeholder={hasCategory ? `Search in ${categoryLabel}...` : "Search anime..."} placeholderTextColor={nothing.placeholder} style={styles.input} returnKeyType="search" />
        {hasCategory ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${categoryLabel} category`} onPress={() => router.back()} style={styles.genreClear}><Text style={styles.genreClearText}>{categoryLabel}</Text><AppIcon name="close" size={14} color={nothing.muted} /></Pressable> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeFilterCount ? `Filters, ${activeFilterCount} active` : "Open filters"}
        onPress={() => setFiltersVisible(true)}
        style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
        hitSlop={4}
      >
        <AppIcon name="tune-variant" size={17} color={activeFilterCount ? nothing.red : nothing.muted} />
        {activeFilterCount ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View> : null}
      </Pressable>
    </View>

    {isIdle ? (
      <View style={styles.idleContent}>
        {recent.length > 0 ? (
          <View style={styles.historySection}>
            <View style={styles.historyHead}>
              <Text style={styles.historyLabel}>Recent Searches</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => clearRecent()}>
                <Text style={styles.clearBtn}>Clear</Text>
              </Pressable>
            </View>
            {recent.map((entry) => (
              <Pressable key={entry.term} accessibilityRole="button" accessibilityLabel={`Recent search: ${entry.term}`} accessibilityHint="Searches again. Long press to remove from history." onPress={() => setInput(entry.term)} onLongPress={() => deleteHistoryItem(entry.term)} delayLongPress={400} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
                <AppIcon name="clock-counter" size={16} color={nothing.dim} />
                <View style={styles.historyBody}>
                  <Text style={styles.historyTerm}>{entry.term}</Text>
                  <Text style={styles.historyTime}>{relativeTime(entry.timestamp)}</Text>
                </View>
                <AppIcon name="arrow-top-right" size={14} color={nothing.dim} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.genreSection}>
          <Text style={styles.genreLabel}>Browse by genre</Text>
          <View style={styles.genreGrid}>
            {QUICK_GENRES.map((genre) => (
              <Pressable key={genre} accessibilityRole="button" accessibilityLabel={`Search ${genre}`} onPress={() => setInput(genre)} style={({ pressed }) => [styles.genreChip, pressed && styles.pressed]}>
                <Text style={styles.genreChipText}>{genre}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    ) : waitingForInput || results.isPending ? (
      <LoadingState label={isCategoryMode ? `Loading ${categoryLabel} anime` : hasQuery ? `Searching for "${normalizedInput}"` : "Loading browse results"} />
    ) : results.isError && media.length === 0 ? (
      <ErrorState message={results.error?.message ?? "Search is unavailable."} onRetry={retrySearch} retryDisabled={retryIsBlocked} retryLabel={retryIsBlocked ? `Try again in ${retrySeconds}s` : "Try again"} />
    ) : media.length === 0 ? (
      <View style={styles.emptyWrap}>
        <EmptyState
          label={isCategoryMode ? `No ${categoryLabel} anime found.` : hasQuery ? `No titles found for "${query}".` : "No titles match these filters."}
          action={
            activeFilterCount
              ? { label: "Clear filters", onPress: () => setFilters({ ...EMPTY_FILTERS }) }
              : !retryIsBlocked
                ? { label: "Retry", onPress: retrySearch }
                : undefined
          }
        />
        <View style={styles.genreSection}>
          <Text style={styles.genreLabel}>Try a genre instead</Text>
          <View style={styles.genreGrid}>
            {QUICK_GENRES.map((genre) => (
              <Pressable key={genre} accessibilityRole="button" accessibilityLabel={`Browse ${genre}`} onPress={() => setInput(genre)} style={({ pressed }) => [styles.genreChip, pressed && styles.pressed]}>
                <Text style={styles.genreChipText}>{genre}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    ) : (
      <View style={styles.resultsWrap}>
        <View style={styles.resultsHead}>
          <Text style={styles.resultsTitle}>{isCategoryMode ? categoryLabel : "Results"}</Text>
        </View>
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={media}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderResult}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={nothing.red} colors={[nothing.red]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            results.hasNextPage ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Load more results" onPress={loadMore} style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}>
                <Text style={styles.loadMoreText}>{results.isFetchingNextPage ? "Loading…" : "Load more"}</Text>
              </Pressable>
            ) : null
          }
        />
      </View>
    )}
    <SearchFilterSheet visible={filtersVisible} filters={filters} onClose={() => setFiltersVisible(false)} onApply={setFilters} />
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  searchInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  input: { flex: 1, minHeight: 44, color: nothing.white, fontSize: 15 },
  filterBtn: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface, alignItems: "center", justifyContent: "center" },
  filterBadge: { position: "absolute", top: 3, right: 3, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, backgroundColor: nothing.red, alignItems: "center", justifyContent: "center" },
  filterBadgeText: { color: nothing.white, fontSize: 11, fontWeight: "900" },
  genreClear: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: nothing.line },
  genreClearText: { color: nothing.white, fontSize: 12, fontWeight: "700" },
  resultsTitle: { color: nothing.muted, fontSize: 12.5, fontWeight: "700" },

  idleContent: { flex: 1, paddingHorizontal: 16, gap: 24 },
  historySection: { gap: 2 },
  historyHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  historyLabel: { color: nothing.white, fontSize: 15, fontWeight: "800" },
  clearBtn: { color: nothing.red, fontSize: 12, fontWeight: "800" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  historyBody: { flex: 1, gap: 1 },
  historyTerm: { color: nothing.white, fontSize: 14, fontWeight: "700" },
  historyTime: { color: nothing.muted, fontSize: 11, fontWeight: "600" },

  genreSection: { gap: 10 },
  genreLabel: { color: nothing.muted, fontSize: 12.5, fontWeight: "700" },
  genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genreChip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  genreChipText: { color: nothing.white, fontSize: 13, fontWeight: "700" },

  resultsWrap: { flex: 1 },
  resultsHead: { paddingHorizontal: 16, paddingBottom: 8 },
  resultsList: { paddingHorizontal: 16, paddingBottom: 112 },

  emptyWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 8, gap: 28 },
  loadMore: { minHeight: 46, marginTop: 10, marginBottom: 4, borderRadius: 10, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface, alignItems: "center", justifyContent: "center" },
  loadMoreText: { color: nothing.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },

  pressed: nothing.pressed,
});
