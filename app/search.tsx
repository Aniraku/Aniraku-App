import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { getMalAnimePage as getAnimePage, isMalRateLimitError as isAniListRateLimitError } from "@/lib/mal-api";
import { AnimeCard } from "@/components/anime-card";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { AnirakuMark, DotLabel, nothing } from "@/components/nothing-ui";
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

export default function SearchScreen() {
  const [input, setInput] = useState("");
  const normalizedInput = input.trim().replace(/\s+/g, " ");
  const [query, setQuery] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const longPressRef = useRef<string | null>(null);

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
    queryKey: ["search", query],
    queryFn: () => getAnimePage({ search: query, perPage: 30, sort: ["SEARCH_MATCH"] }),
    enabled: query.length > 1,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    retry: (failureCount, error) => !isAniListRateLimitError(error) && failureCount < 1,
    retryDelay: 1_200,
  });
  const rateLimitError = isAniListRateLimitError(results.error) ? results.error : null;
  const retryAfterMs = rateLimitError ? 60_000 : null;

  useEffect(() => {
    if (retryAfterMs === null) {
      setRetryAt(null);
      return;
    }
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
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setRecent((current) => {
            const next = current.filter((e) => e.term.toLowerCase() !== term.toLowerCase());
            void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
            return next;
          });
        },
      },
    ]);
  }, []);

  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><AppIcon name="arrow-left" size={21} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel>SEARCH ANIME</DotLabel><Text style={styles.title}>Find something to watch</Text></View><AnirakuMark size={36} /></View>
    <View style={styles.inputRow}><AppIcon name="magnify" size={21} color={nothing.muted} /><TextInput autoFocus value={input} onChangeText={setInput} placeholder="Search anime or characters" placeholderTextColor={nothing.dim} style={styles.input} returnKeyType="search" clearButtonMode="while-editing" /></View>
    {normalizedInput.length <= 1 ? <View style={styles.idle}><DotLabel tone="live">START SEARCHING</DotLabel><Text style={styles.idleTitle}>What do you want to watch?</Text><Text style={styles.idleCopy}>Type an anime title, character, or genre.</Text>{recent.length ? <View style={styles.recent}><View style={styles.recentHead}><Text style={styles.recentLabel}>RECENT SEARCHES ({recent.length})</Text><Pressable accessibilityRole="button" onPress={() => { setRecent([]); void AsyncStorage.removeItem(STORAGE_KEY); }}><Text style={styles.clearRecent}>CLEAR</Text></Pressable></View><View style={styles.recentChoices}>{recent.map((entry) => <Pressable key={entry.term} accessibilityRole="button" accessibilityLabel={`${entry.term}, ${relativeTime(entry.timestamp)}. Long press to delete.`} onPress={() => setInput(entry.term)} onLongPress={() => deleteHistoryItem(entry.term)} delayLongPress={400} style={styles.recentChoice}><Text style={styles.recentChoiceText}>{entry.term}</Text><Text style={styles.recentChoiceTime}>{relativeTime(entry.timestamp)}</Text></Pressable>)}</View></View> : null}</View> : waitingForInput || results.isPending ? <LoadingState label={`Searching for "${normalizedInput}"`} /> : results.isError || !results.data ? <ErrorState message={results.error?.message ?? "Search is unavailable."} onRetry={retrySearch} retryDisabled={retryIsBlocked} retryLabel={retryIsBlocked ? `TRY AGAIN IN ${retrySeconds}S` : "TRY AGAIN"} /> : results.data.media.length === 0 ? <EmptyState label={`No titles found for "${query}".`} /> : <FlatList data={results.data.media} numColumns={2} keyExtractor={(item) => String(item.id)} ListHeaderComponent={<View style={styles.resultHead}><DotLabel tone="live">SEARCH RESULTS</DotLabel><Text style={styles.resultTitle}>{results.data.media.length} titles found for "{query}"</Text></View>} renderItem={({ item }) => <View style={styles.cell}><AnimeCard anime={item} /></View>} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} />}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, header: { minHeight: 78, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 11 }, back: { width: 43, height: 43, alignItems: "center", justifyContent: "center", backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line, borderRadius: 14 }, titleBlock: { flex: 1, gap: 2 }, title: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.65 }, inputRow: { minHeight: 56, marginHorizontal: 16, paddingHorizontal: 14, gap: 10, flexDirection: "row", alignItems: "center", borderRadius: 17, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface }, input: { flex: 1, minHeight: 52, color: nothing.white, fontSize: 14 }, idle: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 8 }, idleTitle: { color: nothing.white, fontSize: 28, fontWeight: "900", letterSpacing: -0.7 }, idleCopy: { color: nothing.muted, fontSize: 14, lineHeight: 20, maxWidth: 260 }, recent: { marginTop: 16, gap: 9 }, recentHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, recentLabel: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 }, clearRecent: { color: nothing.red, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },   recentChoices: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  recentChoice: { justifyContent: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  recentChoiceText: { color: nothing.white, fontSize: 11 },
  recentChoiceTime: { color: nothing.dim, fontFamily: "monospace", fontSize: 7, fontWeight: "800", letterSpacing: 0.3, marginTop: 2 }, resultHead: { paddingBottom: 14, gap: 4 }, resultTitle: { color: nothing.white, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 }, list: { padding: 16, paddingTop: 18, paddingBottom: 112 }, cell: { flex: 1, alignItems: "center", marginBottom: 14 }, pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
