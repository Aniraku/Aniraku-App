import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { getAnimePage, isAniListRateLimitError, sanitizeMediaFormat, sanitizeMediaSortList, sanitizeMediaStatus } from "@/lib/anilist";
import { searchCommitDelayMs } from "@/lib/search-input";
import { nsfwFilterParam, useNsfwPreference } from "@/lib/nsfw-preference";
import { animeTitle } from "@/lib/types";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

type HistoryEntry = { term: string; timestamp: number };
const STORAGE_KEY = "aniraku.search.recent";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function pruneOldEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  return entries.filter((e) => e.timestamp > cutoff);
}

function upgradeLegacyEntries(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { term: item, timestamp: Date.now() };
    if (item && typeof item === "object" && "term" in item && "timestamp" in item) {
      return item as HistoryEntry;
    }
    return null;
  }).filter((e): e is HistoryEntry => e !== null);
}

const QUICK_GENRES = ["Action", "Romance", "Comedy", "Fantasy", "Sci-Fi", "Horror"];

function SearchResultRow({ anime, onPress }: { anime: any; onPress: () => void }) {
  const title = animeTitle(anime);
  const image = anime.coverImage?.extraLarge || anime.coverImage?.large || "";
  const format = anime.format || "";
  const episodes = anime.episodes;
  const score = anime.averageScore;
  const meta = [format, episodes ? `${episodes} EP` : null, score ? `${score}%` : null].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
      <View style={styles.resultThumb}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
        <View style={styles.resultPlayBadge}><AppIcon name="play" size={14} color={nothing.white} /></View>
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={2}>{title}</Text>
        {meta ? <Text style={styles.resultMeta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

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
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const entries = upgradeLegacyEntries(parsed);
          const pruned = pruneOldEntries(entries);
          setRecent(pruned);
          if (pruned.length !== entries.length) {
            void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruned)).catch(() => {});
          }
        } catch { /* ignore malformed */ }
      }
    }).catch(() => {});
  }, []);

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
  const isGenreMode = Boolean(genreFilter);
  const isCategoryMode = hasCategory;
  const categoryLabel = categoryTitle || genreFilter || "BROWSE";
  const searchQuery = isCategoryMode ? (query || " ") : query;
  const results = useQuery({
    queryKey: ["search", searchQuery, genreFilter, sortFilter?.join(","), statusFilter, formatFilter, isAdultParam],
    queryFn: () => getAnimePage({ search: isCategoryMode && !query ? undefined : searchQuery, genre: genreFilter || undefined, sort: sortFilter || ["SEARCH_MATCH"], status: statusFilter || undefined, format: formatFilter || undefined, perPage: 20, isAdult: isAdultParam }),
    enabled: isCategoryMode || query.length > 1,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    retry: (failureCount, error) => !isAniListRateLimitError(error) && failureCount < 1,
    retryDelay: 1_200,
  });
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
    setRecent((current) => {
      const now = Date.now();
      const filtered = current.filter((item) => item.term.toLowerCase() !== query.toLowerCase());
      const next = [{ term: query, timestamp: now }, ...filtered].slice(0, 6);
      const pruned = pruneOldEntries(next);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruned)).catch(() => {});
      return pruned;
    });
  }, [query, results.isSuccess]);

  const deleteHistoryItem = useCallback((term: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Delete", `Remove "${term}" from history?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        setRecent((current) => {
          const next = current.filter((e) => e.term.toLowerCase() !== term.toLowerCase());
          void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }},
    ]);
  }, []);

  const isIdle = !isCategoryMode && normalizedInput.length <= 1;

  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <AppIcon name="arrow-left" size={21} color={nothing.white} />
      </Pressable>
      <View style={styles.searchInputWrap}>
        <AppIcon name="magnify" size={18} color={nothing.muted} />
        <TextInput autoFocus={!isCategoryMode} value={input} onChangeText={setInput} onSubmitEditing={() => setQuery(normalizedInput)} placeholder={hasCategory ? `Search in ${categoryLabel}...` : "Search anime..."} placeholderTextColor={nothing.dim} style={styles.input} returnKeyType="search" />
        {hasCategory ? <Pressable onPress={() => router.back()} style={styles.genreClear}><Text style={styles.genreClearText}>{categoryLabel.toUpperCase()}</Text><AppIcon name="close" size={14} color={nothing.red} /></Pressable> : null}
      </View>
    </View>

    {isIdle ? (
      <View style={styles.idleContent}>
        {recent.length > 0 ? (
          <View style={styles.historySection}>
            <View style={styles.historyHead}>
              <Text style={styles.historyLabel}>Recent Searches</Text>
              <Pressable onPress={() => { setRecent([]); void AsyncStorage.removeItem(STORAGE_KEY); }}>
                <Text style={styles.clearBtn}>Clear</Text>
              </Pressable>
            </View>
            {recent.map((entry) => (
              <Pressable key={entry.term} onPress={() => setInput(entry.term)} onLongPress={() => deleteHistoryItem(entry.term)} delayLongPress={400} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
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
              <Pressable key={genre} onPress={() => setInput(genre)} style={({ pressed }) => [styles.genreChip, pressed && styles.pressed]}>
                <Text style={styles.genreChipText}>{genre}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    ) : waitingForInput || results.isPending ? (
      <LoadingState label={isCategoryMode ? `Loading ${categoryLabel} anime` : `Searching for "${normalizedInput}"`} />
    ) : results.isError || !results.data ? (
      <ErrorState message={results.error?.message ?? "Search is unavailable."} onRetry={retrySearch} retryDisabled={retryIsBlocked} retryLabel={retryIsBlocked ? `TRY AGAIN IN ${retrySeconds}S` : "TRY AGAIN"} />
    ) : results.data.media.length === 0 ? (
      <EmptyState label={isCategoryMode ? `No ${categoryLabel} anime found.` : `No titles found for "${query}".`} action={!retryIsBlocked ? { label: "Retry", onPress: retrySearch } : undefined} />
    ) : (
      <View style={styles.resultsWrap}>
        <View style={styles.resultsHead}>
          <DotLabel tone="live">{isCategoryMode ? categoryLabel?.toUpperCase() : "TOP SEARCH"}</DotLabel>
        </View>
        <FlatList
          data={results.data.media}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <SearchResultRow anime={item} onPress={() => router.push((`/anime/${item.id}`) as never)} />}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    )}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  searchInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  input: { flex: 1, minHeight: 44, color: nothing.white, fontSize: 15 },
  filterBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, alignItems: "center", justifyContent: "center" },
  genreClear: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,77,77,0.12)" },
  genreClearText: { color: nothing.red, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },

  idleContent: { flex: 1, paddingHorizontal: 16, gap: 24 },
  historySection: { gap: 2 },
  historyHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  historyLabel: { color: nothing.white, fontSize: 15, fontWeight: "800" },
  clearBtn: { color: nothing.red, fontSize: 12, fontWeight: "800" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  historyBody: { flex: 1, gap: 1 },
  historyTerm: { color: nothing.white, fontSize: 14, fontWeight: "700" },
  historyTime: { color: nothing.dim, fontSize: 11, fontWeight: "600" },

  genreSection: { gap: 10 },
  genreLabel: { color: nothing.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genreChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  genreChipText: { color: nothing.white, fontSize: 13, fontWeight: "700" },

  resultsWrap: { flex: 1 },
  resultsHead: { paddingHorizontal: 16, paddingBottom: 8 },
  resultsList: { paddingHorizontal: 16, paddingBottom: 112 },

  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  resultThumb: { width: 120, height: 68, borderRadius: 8, overflow: "hidden", backgroundColor: nothing.raised },
  resultPlayBadge: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  resultBody: { flex: 1, gap: 4 },
  resultTitle: { color: nothing.white, fontSize: 15, fontWeight: "800", lineHeight: 19 },
  resultMeta: { color: nothing.dim, fontSize: 12, fontWeight: "700" },

  pressed: nothing.pressed,
});
