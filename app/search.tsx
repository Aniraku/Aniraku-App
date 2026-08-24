import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getAnimePage } from "@/lib/aniraku-api";
import { AnimeCard } from "@/components/anime-card";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { AnirakuMark, DotLabel, nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

export default function SearchScreen() {
  const [input, setInput] = useState("");
  const normalizedInput = input.trim().replace(/\s+/g, " ");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => { void AsyncStorage.getItem("aniraku.search.recent").then((stored) => { if (stored) setRecent(JSON.parse(stored)); }).catch(() => {}); }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(normalizedInput), 450);
    return () => clearTimeout(timer);
  }, [normalizedInput]);

  const waitingForInput = normalizedInput.length > 1 && query !== normalizedInput;
  const results = useQuery({
    queryKey: ["search", query],
    queryFn: () => getAnimePage({ search: query, perPage: 30, sort: "SEARCH_MATCH" }),
    enabled: query.length > 1,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    retry: (failureCount) => failureCount < 1,
    retryDelay: 1_200,
  });
  const retrySearch = () => {
    void results.refetch();
  };
  useEffect(() => {
    if (!results.isSuccess || query.length < 2) return;
    setRecent((current) => {
      const next = [query, ...current.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 6);
      void AsyncStorage.setItem("aniraku.search.recent", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [query, results.isSuccess]);
  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><AppIcon name="arrow-left" size={21} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel>SEARCH ANIME</DotLabel><Text style={styles.title}>Find something to watch</Text></View><AnirakuMark size={36} /></View>
    <View style={styles.inputRow}><AppIcon name="magnify" size={21} color={nothing.muted} /><TextInput autoFocus value={input} onChangeText={setInput} placeholder="Search anime or characters" placeholderTextColor={nothing.dim} style={styles.input} returnKeyType="search" clearButtonMode="while-editing" /></View>
    {normalizedInput.length <= 1 ? <View style={styles.idle}><DotLabel tone="live">START SEARCHING</DotLabel><Text style={styles.idleTitle}>What do you want to watch?</Text><Text style={styles.idleCopy}>Type an anime title, character, or genre.</Text>{recent.length ? <View style={styles.recent}><View style={styles.recentHead}><Text style={styles.recentLabel}>RECENT SEARCHES</Text><Pressable accessibilityRole="button" onPress={() => { setRecent([]); void AsyncStorage.removeItem("aniraku.search.recent"); }}><Text style={styles.clearRecent}>CLEAR</Text></Pressable></View><View style={styles.recentChoices}>{recent.map((item) => <Pressable key={item} accessibilityRole="button" onPress={() => setInput(item)} style={styles.recentChoice}><Text style={styles.recentChoiceText}>{item}</Text></Pressable>)}</View></View> : null}</View> : waitingForInput || results.isPending ? <LoadingState label={`Searching for “${normalizedInput}”`} /> : results.isError || !results.data ? <ErrorState message={results.error?.message ?? "Search is unavailable."} onRetry={retrySearch} retryLabel="TRY AGAIN" /> : results.data.media.length === 0 ? <EmptyState label={`No titles found for “${query}".`} /> : <FlatList data={results.data.media} numColumns={2} keyExtractor={(item) => String(item.id)} ListHeaderComponent={<View style={styles.resultHead}><DotLabel tone="live">SEARCH RESULTS</DotLabel><Text style={styles.resultTitle}>{results.data.media.length} titles found for “{query}”</Text></View>} renderItem={({ item }) => <View style={styles.cell}><AnimeCard anime={item} /></View>} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} />}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, header: { minHeight: 78, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 11 }, back: { width: 43, height: 43, alignItems: "center", justifyContent: "center", backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line, borderRadius: 14 }, titleBlock: { flex: 1, gap: 2 }, title: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.65 }, inputRow: { minHeight: 56, marginHorizontal: 16, paddingHorizontal: 14, gap: 10, flexDirection: "row", alignItems: "center", borderRadius: 17, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface }, input: { flex: 1, minHeight: 52, color: nothing.white, fontSize: 14 }, idle: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 8 }, idleTitle: { color: nothing.white, fontSize: 28, fontWeight: "900", letterSpacing: -0.7 }, idleCopy: { color: nothing.muted, fontSize: 14, lineHeight: 20, maxWidth: 260 }, recent: { marginTop: 16, gap: 9 }, recentHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, recentLabel: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 }, clearRecent: { color: nothing.red, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 }, recentChoices: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, recentChoice: { minHeight: 32, justifyContent: "center", paddingHorizontal: 10, borderRadius: 4, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface }, recentChoiceText: { color: nothing.white, fontSize: 11 }, resultHead: { paddingBottom: 14, gap: 4 }, resultTitle: { color: nothing.white, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 }, list: { padding: 16, paddingTop: 18, paddingBottom: 112 }, cell: { flex: 1, alignItems: "center", marginBottom: 14 }, pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
