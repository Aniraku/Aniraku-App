import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getAnimePage } from "@/lib/anilist";
import { AnimeCard } from "@/components/anime-card";
import { ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";
import { AppIcon } from "@/components/app-icon";

const modes = [{ label: "Popular", signal: "POPULAR RIGHT NOW", sort: ["POPULARITY_DESC"] }, { label: "Trending", signal: "TRENDING TODAY", sort: ["TRENDING_DESC"] }, { label: "Newest", signal: "NEW THIS SEASON", sort: ["START_DATE_DESC"] }];

export default function CatalogScreen() {
  const [mode, setMode] = useState(0);
  const [input, setInput] = useState("");
  const search = useDeferredValue(input.trim());
  const key = useMemo(() => ["catalog", mode, search], [mode, search]);
  const catalog = useQuery({ queryKey: key, queryFn: () => getAnimePage({ perPage: 30, sort: modes[mode].sort, search: search || undefined }) });
  const activeMode = modes[mode];

  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.top}><NativeHeader eyebrow="BROWSE ANIME" title="Explore" action={<SearchAction />} /><View style={styles.searchShell}><AppIcon name="magnify" size={19} color={nothing.muted} /><TextInput accessibilityLabel="Filter catalog" value={input} onChangeText={setInput} placeholder="Search anime" placeholderTextColor={nothing.dim} style={styles.input} returnKeyType="search" /></View><View style={styles.modeRow}>{modes.map((item, index) => <Pressable accessibilityRole="button" key={item.label} onPress={() => setMode(index)} style={[styles.mode, mode === index && styles.modeActive]}><Text style={[styles.modeLabel, mode === index && styles.modeLabelActive]}>{item.label}</Text></Pressable>)}</View></View>
    {catalog.isPending ? <LoadingState label="Loading anime" /> : catalog.isError || !catalog.data ? <ErrorState message={catalog.error?.message ?? "We could not load the catalog."} onRetry={() => void catalog.refetch()} /> : <FlatList data={catalog.data.media} numColumns={2} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <View style={styles.cell}><AnimeCard anime={item} /></View>} ListHeaderComponent={<View style={styles.listHead}><View><DotLabel tone="live">{activeMode.signal}</DotLabel><Text style={styles.listTitle}>{search ? `Results for “${search}”` : `${activeMode.label} picks for you`}</Text></View><Text style={styles.count}>{String(catalog.data.media.length).padStart(2, "0")}</Text></View>} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} />}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, top: { paddingHorizontal: 16, gap: 10 },
  searchShell: { minHeight: 48, paddingHorizontal: 0, gap: 9, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: nothing.line },
  input: { flex: 1, minHeight: 50, color: nothing.white, fontSize: 14 },
  modeRow: { flexDirection: "row", gap: 18, paddingBottom: 10 },
  mode: { minHeight: 30, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  modeActive: { borderBottomColor: nothing.red },
  modeLabel: { color: nothing.muted, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.3 },
  modeLabelActive: { color: nothing.white },
  list: { padding: 16, paddingTop: 6, paddingBottom: 112 },
  listHead: { minHeight: 74, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  listTitle: { maxWidth: 250, color: nothing.white, marginTop: 4, fontSize: 19, fontWeight: "900", letterSpacing: -0.45 },
  count: { color: nothing.dim, fontFamily: "monospace", fontWeight: "800", fontSize: 12 },
  cell: { flex: 1, alignItems: "center", marginBottom: 14 },
});
