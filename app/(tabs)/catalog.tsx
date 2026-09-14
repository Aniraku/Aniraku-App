import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { getAnimePage, isAniListRateLimitError } from "@/lib/anilist";
import { nsfwFilterParam, useNsfwPreference } from "@/lib/nsfw-preference";
import { animeTitle } from "@/lib/types";
import { usePrefetchAnime } from "@/lib/prefetch";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, NothingButton, nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";

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
    if (item && typeof item === "object" && "term" in item && "timestamp" in item) return item as HistoryEntry;
    return null;
  }).filter((e): e is HistoryEntry => e !== null);
}

const QUICK_GENRES = ["Action", "Romance", "Comedy", "Fantasy", "Sci-Fi", "Horror", "Slice of Life", "Sports"];

function SearchResultRow({ anime, onPress }: { anime: any; onPress: () => void }) {
  const title = animeTitle(anime);
  const image = anime.coverImage?.extraLarge || anime.coverImage?.large || "";
  const format = anime.format || "";
  const episodes = anime.episodes;
  const score = anime.averageScore;
  const meta = [format, episodes ? `${episodes} EP` : null, score ? `${score}%` : null].filter(Boolean).join(" · ");
  const prefetch = usePrefetchAnime();
  return (
    <Pressable onPress={() => { prefetch(anime.id); onPress(); }} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
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

export default function CatalogScreen() {
  const prefetch = usePrefetchAnime();
  const nsfw = useNsfwPreference();
  const isAdultParam = nsfwFilterParam(nsfw.enabled);
  const [input, setInput] = useState("");
  const normalizedInput = input.trim().replace(/\s+/g, " ");
  const [query, setQuery] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    const timer = setTimeout(() => setQuery(normalizedInput), 450);
    return () => clearTimeout(timer);
  }, [normalizedInput]);

  const waitingForInput = normalizedInput.length > 1 && query !== normalizedInput;
  const results = useQuery({
    queryKey: ["search", query, isAdultParam],
    queryFn: () => getAnimePage({ search: query, perPage: 20, sort: ["SEARCH_MATCH"], isAdult: isAdultParam }),
    enabled: query.length > 1,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    retry: (failureCount, error) => !isAniListRateLimitError(error) && failureCount < 1,
    retryDelay: 1_200,
  });

  const topSearches = useQuery({
    queryKey: ["top-searches", isAdultParam],
    queryFn: () => getAnimePage({ perPage: 12, sort: ["TRENDING_DESC", "POPULARITY_DESC"], isAdult: isAdultParam }),
    staleTime: 10 * 60_000,
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  const isIdle = normalizedInput.length <= 1;

  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.header}>
      <NativeHeader eyebrow="DISCOVER" title="Search" />
      <View style={styles.searchInputWrap}>
        <AppIcon name="magnify" size={18} color={nothing.muted} />
        <TextInput autoFocus value={input} onChangeText={setInput} placeholder="Search anime..." placeholderTextColor={nothing.dim} style={styles.input} returnKeyType="search" />
      </View>
    </View>

    {isIdle ? (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={<View style={styles.idleContent}>
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

          {topSearches.data?.media?.length ? (
            <View style={styles.topSection}>
              <DotLabel tone="live">TOP SEARCH</DotLabel>
              <Text style={styles.sectionTitle}>What's trending right now</Text>
              <View style={styles.topGrid}>
                {topSearches.data.media.slice(0, 8).map((anime, index) => {
                  const title = animeTitle(anime);
                  const image = anime.coverImage?.large || anime.coverImage?.extraLarge || "";
                  return (
                    <Pressable key={anime.id} onPress={() => { prefetch(anime.id); router.push(`/anime/${anime.id}` as never); }} style={({ pressed }) => [styles.topCard, pressed && styles.pressed]}>
                      <View style={styles.topCardImage}>
                        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
                        <View style={styles.topCardRank}><Text style={styles.topCardRankText}>{String(index + 1).padStart(2, "0")}</Text></View>
                      </View>
                      <Text style={styles.topCardTitle} numberOfLines={2}>{title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.genreSection}>
            <Text style={styles.genreLabel}>Browse by genre</Text>
            <View style={styles.genreGrid}>
              {QUICK_GENRES.map((genre) => (
                <Pressable key={genre} onPress={() => router.push({ pathname: "/search", params: { genre } } as never)} style={({ pressed }) => [styles.genreChip, pressed && styles.pressed]}>
                  <Text style={styles.genreChipText}>{genre}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>}
        contentContainerStyle={styles.idleList}
        showsVerticalScrollIndicator={false}
      />
    ) : waitingForInput || results.isPending ? (
      <LoadingState label={`Searching for "${normalizedInput}"`} />
    ) : results.isError || !results.data ? (
      <ErrorState message={results.error?.message ?? "Search is unavailable."} onRetry={retrySearch} retryDisabled={retryIsBlocked} retryLabel={retryIsBlocked ? `TRY AGAIN IN ${retrySeconds}S` : "TRY AGAIN"} />
    ) : results.data.media.length === 0 ? (
      <EmptyState label={`No titles found for "${query}".`} />
    ) : (
      <View style={styles.resultsWrap}>
        <View style={styles.resultsHead}>
          <DotLabel tone="live">TOP SEARCH</DotLabel>
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
  header: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  searchInputWrap: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  input: { flex: 1, minHeight: 44, color: nothing.white, fontSize: 15 },

  idleContent: { paddingHorizontal: 16, gap: 28 },
  idleList: { paddingBottom: 112 },

  historySection: { gap: 2 },
  historyHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  historyLabel: { color: nothing.white, fontSize: 15, fontWeight: "800" },
  clearBtn: { color: nothing.red, fontSize: 12, fontWeight: "800" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  historyBody: { flex: 1, gap: 1 },
  historyTerm: { color: nothing.white, fontSize: 14, fontWeight: "700" },
  historyTime: { color: nothing.dim, fontSize: 11, fontWeight: "600" },

  topSection: { gap: 12 },
  sectionTitle: { color: nothing.white, fontSize: 18, fontWeight: "900", marginTop: 4, letterSpacing: -0.3 },
  topGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  topCard: { width: "47%", gap: 6 },
  topCardImage: { width: "100%", aspectRatio: 3 / 4, borderRadius: 10, overflow: "hidden", backgroundColor: nothing.raised },
  topCardRank: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  topCardRankText: { color: nothing.red, fontSize: 11, fontWeight: "900", fontFamily: nothing.mono },
  topCardTitle: { color: nothing.white, fontSize: 13, fontWeight: "800", lineHeight: 17 },

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
