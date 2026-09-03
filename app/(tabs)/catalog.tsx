import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getAnimePage } from "@/lib/anilist";
import { AnimeCard } from "@/components/anime-card";
import { ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";
import { AppIcon } from "@/components/app-icon";

const modes = [{ label: "Popular", signal: "POPULAR RIGHT NOW", sort: ["POPULARITY_DESC"] }, { label: "Trending", signal: "TRENDING TODAY", sort: ["TRENDING_DESC"] }, { label: "Newest", signal: "NEW THIS SEASON", sort: ["START_DATE_DESC"] }];

const genres = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];
const statuses = [{ label: "Airing", value: "RELEASING" }, { label: "Finished", value: "FINISHED" }, { label: "Upcoming", value: "NOT_YET_RELEASED" }];
const formats = [{ label: "TV", value: "TV" }, { label: "Movie", value: "MOVIE" }, { label: "OVA", value: "OVA" }, { label: "ONA", value: "ONA" }, { label: "Special", value: "SPECIAL" }];
const seasons = [{ label: "Winter", value: "WINTER" }, { label: "Spring", value: "SPRING" }, { label: "Summer", value: "SUMMER" }, { label: "Fall", value: "FALL" }];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 15 }, (_, i) => currentYear - i);

export default function CatalogScreen() {
  const [mode, setMode] = useState(0);
  const [input, setInput] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const search = useDeferredValue(input.trim());
  const hasFilters = selectedGenre || selectedStatus || selectedFormat || selectedSeason || selectedYear;
  const key = useMemo(() => ["catalog", mode, search, selectedGenre, selectedStatus, selectedFormat, selectedSeason, selectedYear], [mode, search, selectedGenre, selectedStatus, selectedFormat, selectedSeason, selectedYear]);
  const catalog = useQuery({
    queryKey: key,
    queryFn: () => getAnimePage({
      perPage: 30,
      sort: modes[mode].sort,
      search: search || undefined,
      genre: selectedGenre || undefined,
      status: selectedStatus || undefined,
      format: selectedFormat || undefined,
      season: selectedSeason || undefined,
      seasonYear: selectedYear || undefined,
    }),
  });
  const activeMode = modes[mode];

  const clearFilters = () => {
    setSelectedGenre(null);
    setSelectedStatus(null);
    setSelectedFormat(null);
    setSelectedSeason(null);
    setSelectedYear(null);
  };

  return <NativeScreen scroll={false} style={styles.fill}>
    <View style={styles.top}><NativeHeader eyebrow="BROWSE ANIME" title="Explore" action={<SearchAction />} /><View style={styles.searchShell}><AppIcon name="magnify" size={19} color={nothing.muted} /><TextInput accessibilityLabel="Filter catalog" value={input} onChangeText={setInput} placeholder="Search anime" placeholderTextColor={nothing.dim} style={styles.input} returnKeyType="search" /><Pressable onPress={() => setShowFilters((v) => !v)} style={[styles.filterBtn, showFilters && styles.filterBtnActive]}><AppIcon name="tune-variant" size={18} color={showFilters ? nothing.red : nothing.muted} /></Pressable></View><View style={styles.modeRow}>{modes.map((item, index) => <Pressable accessibilityRole="button" key={item.label} onPress={() => setMode(index)} style={[styles.mode, mode === index && styles.modeActive]}><Text style={[styles.modeLabel, mode === index && styles.modeLabelActive]}>{item.label}</Text></Pressable>)}</View></View>

    {showFilters ? <View style={styles.filterPanel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>GENRE</Text>
          <View style={styles.filterChips}>{genres.map((g) => <Pressable key={g} onPress={() => setSelectedGenre(selectedGenre === g ? null : g)} style={[styles.chip, selectedGenre === g && styles.chipActive]}><Text style={[styles.chipText, selectedGenre === g && styles.chipTextActive]}>{g.toUpperCase()}</Text></Pressable>)}</View>
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>STATUS</Text>
          <View style={styles.filterChips}>{statuses.map((s) => <Pressable key={s.value} onPress={() => setSelectedStatus(selectedStatus === s.value ? null : s.value)} style={[styles.chip, selectedStatus === s.value && styles.chipActive]}><Text style={[styles.chipText, selectedStatus === s.value && styles.chipTextActive]}>{s.label.toUpperCase()}</Text></Pressable>)}</View>
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>FORMAT</Text>
          <View style={styles.filterChips}>{formats.map((f) => <Pressable key={f.value} onPress={() => setSelectedFormat(selectedFormat === f.value ? null : f.value)} style={[styles.chip, selectedFormat === f.value && styles.chipActive]}><Text style={[styles.chipText, selectedFormat === f.value && styles.chipTextActive]}>{f.label.toUpperCase()}</Text></Pressable>)}</View>
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>SEASON</Text>
          <View style={styles.filterChips}>{seasons.map((s) => <Pressable key={s.value} onPress={() => setSelectedSeason(selectedSeason === s.value ? null : s.value)} style={[styles.chip, selectedSeason === s.value && styles.chipActive]}><Text style={[styles.chipText, selectedSeason === s.value && styles.chipTextActive]}>{s.label.toUpperCase()}</Text></Pressable>)}</View>
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>YEAR</Text>
          <View style={styles.filterChips}>{years.map((y) => <Pressable key={y} onPress={() => setSelectedYear(selectedYear === y ? null : y)} style={[styles.chip, selectedYear === y && styles.chipActive]}><Text style={[styles.chipText, selectedYear === y && styles.chipTextActive]}>{String(y)}</Text></Pressable>)}</View>
        </View>
      </ScrollView>
      {hasFilters ? <Pressable onPress={clearFilters} style={styles.clearFilters}><Text style={styles.clearFiltersText}>CLEAR FILTERS</Text></Pressable> : null}
    </View> : null}

    {catalog.isPending ? <LoadingState label="Loading anime" /> : catalog.isError || !catalog.data ? <ErrorState message={catalog.error?.message ?? "We could not load the catalog."} onRetry={() => void catalog.refetch()} /> : <FlatList data={catalog.data.media} numColumns={2} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <View style={styles.cell}><AnimeCard anime={item} /></View>} ListHeaderComponent={<View style={styles.listHead}><View><DotLabel tone="live">{activeMode.signal}</DotLabel><Text style={styles.listTitle}>{search ? `Results for "${search}"` : hasFilters ? "Filtered results" : `${activeMode.label} picks for you`}</Text></View><Text style={styles.count}>{String(catalog.data.media.length).padStart(2, "0")}</Text></View>} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} />}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, top: { paddingHorizontal: 16, gap: 10 },
  searchShell: { minHeight: 48, paddingHorizontal: 0, gap: 9, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: nothing.line },
  input: { flex: 1, minHeight: 50, color: nothing.white, fontSize: 14 },
  filterBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: nothing.line },
  filterBtnActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.1)" },
  modeRow: { flexDirection: "row", gap: 18, paddingBottom: 10 },
  mode: { minHeight: 30, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  modeActive: { borderBottomColor: nothing.red },
  modeLabel: { color: nothing.muted, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.3 },
  modeLabelActive: { color: nothing.white },
  filterPanel: { gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  filterScroll: { gap: 14 },
  filterGroup: { gap: 6, minWidth: 120 },
  filterGroupLabel: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: { minHeight: 28, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  chipActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.1)" },
  chipText: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.2 },
  chipTextActive: { color: nothing.red },
  clearFilters: { alignSelf: "flex-end", paddingVertical: 4 },
  clearFiltersText: { color: nothing.red, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },
  list: { padding: 16, paddingTop: 6, paddingBottom: 112 },
  listHead: { minHeight: 74, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  listTitle: { maxWidth: 250, color: nothing.white, marginTop: 4, fontSize: 19, fontWeight: "900", letterSpacing: -0.45 },
  count: { color: nothing.dim, fontFamily: "monospace", fontWeight: "800", fontSize: 12 },
  cell: { flex: 1, alignItems: "center", marginBottom: 14 },
});
