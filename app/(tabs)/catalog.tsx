import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getAnimePage } from "@/lib/anilist";
import { AnimeCard } from "@/components/anime-card";
import { ErrorState, LoadingState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";

const modes = [{ label: "Popular", sort: ["POPULARITY_DESC"] }, { label: "Trending", sort: ["TRENDING_DESC"] }, { label: "Newest", sort: ["START_DATE_DESC"] }];

export default function CatalogScreen() {
  const [mode, setMode] = useState(0);
  const [search, setSearch] = useState("");
  const key = useMemo(() => ["catalog", mode, search.trim()], [mode, search]);
  const catalog = useQuery({ queryKey: key, queryFn: () => getAnimePage({ perPage: 30, sort: modes[mode].sort, search: search.trim() || undefined }) });
  return <NativeScreen scroll={false} style={styles.fill}><View style={styles.top}><NativeHeader eyebrow="All anime / live index" title="Catalog" action={<SearchAction />} /><TextInput accessibilityLabel="Filter catalog" value={search} onChangeText={setSearch} placeholder="Filter titles" placeholderTextColor={nothing.dim} style={styles.input} returnKeyType="search" /></View><View style={styles.modeRow}>{modes.map((item, index) => <Pressable key={item.label} onPress={() => setMode(index)} style={[styles.mode, mode === index && styles.modeActive]}><Text style={[styles.modeLabel, mode === index && styles.modeLabelActive]}>{item.label}</Text></Pressable>)}</View>{catalog.isPending ? <LoadingState label="Querying the live catalog" /> : catalog.isError || !catalog.data ? <ErrorState message={catalog.error?.message ?? "Catalog unavailable."} onRetry={() => void catalog.refetch()} /> : <FlatList data={catalog.data.media} numColumns={2} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <View style={styles.cell}><AnimeCard anime={item} /></View>} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} />}</NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, top: { paddingHorizontal: 18 }, input: { height: 50, color: nothing.white, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 }, modeRow: { paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", gap: 8 }, mode: { minHeight: 36, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 18 }, modeActive: { backgroundColor: nothing.white, borderColor: nothing.white }, modeLabel: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 10, letterSpacing: 0.7 }, modeLabelActive: { color: nothing.black }, list: { padding: 18, paddingTop: 0, paddingBottom: 110 }, cell: { flex: 1, alignItems: "center", marginBottom: 14 },
});
