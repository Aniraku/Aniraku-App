import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getAnimePage } from "@/lib/anilist";
import { AnimeCard } from "@/components/anime-card";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { DotLabel, nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

export default function SearchScreen() {
  const [input, setInput] = useState("");
  const query = useDeferredValue(input.trim());
  const results = useQuery({ queryKey: ["search", query], queryFn: () => getAnimePage({ search: query, perPage: 30, sort: ["SEARCH_MATCH"] }), enabled: query.length > 1 });
  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={22} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel>Live title index</DotLabel><Text style={styles.title}>Search</Text></View></View>
    <View style={styles.inputRow}><MaterialCommunityIcons name="magnify" size={21} color={nothing.muted} /><TextInput autoFocus value={input} onChangeText={setInput} placeholder="Search anime" placeholderTextColor={nothing.dim} style={styles.input} returnKeyType="search" clearButtonMode="while-editing" /></View>
    {query.length <= 1 ? <EmptyState label="Type at least two characters to query the live AniList catalog." /> : results.isPending ? <LoadingState label={`Searching for “${query}”`} /> : results.isError || !results.data ? <ErrorState message={results.error?.message ?? "Search is unavailable."} onRetry={() => void results.refetch()} /> : results.data.media.length === 0 ? <EmptyState label={`No titles found for “${query}”.`} /> : <FlatList data={results.data.media} numColumns={2} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <View style={styles.cell}><AnimeCard anime={item} /></View>} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} />}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { minHeight: 76, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 13 },
  back: { width: 45, height: 45, alignItems: "center", justifyContent: "center", backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, borderRadius: 23 },
  titleBlock: { gap: 3 },
  title: { color: nothing.white, fontSize: 27, fontWeight: "900", letterSpacing: -0.5 },
  inputRow: { height: 54, marginHorizontal: 18, paddingHorizontal: 15, gap: 10, flexDirection: "row", alignItems: "center", borderRadius: 15, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  input: { flex: 1, minHeight: 50, color: nothing.white, fontSize: 16 },
  list: { padding: 18, paddingBottom: 36 },
  cell: { flex: 1, alignItems: "center", marginBottom: 14 },
});
