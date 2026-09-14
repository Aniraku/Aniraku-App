import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, nothing, Signal } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";

type LibraryTab = "history" | "bookmarks";
const tabMeta: Record<LibraryTab, { label: string }> = { history: { label: "History" }, bookmarks: { label: "Saved" } };

export default function LibraryTabScreen() {
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const [tab, setTab] = useState<LibraryTab>("history");

  const data = tab === "history" ? history.history : bookmarks.bookmarks;
  const records = data.data ?? [];

  return <NativeScreen scroll={false} style={styles.fill}>
    <NativeHeader eyebrow="LIBRARY" title="My List" />
    <View style={styles.tabs}>
      {(["history", "bookmarks"] as LibraryTab[]).map((item) => (
        <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
          <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{tabMeta[item].label}</Text>
        </Pressable>
      ))}
    </View>
    {data.isPending ? <LoadingState label="Loading your library" /> : data.isError ? <ErrorState message="Could not load library." onRetry={() => void data.refetch()} /> : records.length === 0 ? <EmptyState label={tab === "history" ? "Watch something to see it here." : "Save anime to build your list."} /> : <FlatList data={records} keyExtractor={(item) => item.id ?? `${item.anime_id}:${item.episode_number}`} contentContainerStyle={styles.list} renderItem={({ item }) => tab === "history" ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/watch/[id]", params: { id: String(item.anime_id), episode: String(item.episode_number), title: item.anime_title ?? "Anime", image: item.anime_image ?? "" } } as never)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><Image source={{ uri: item.anime_image || "" }} style={styles.thumb} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.rowBody}><Signal label={`EP ${item.episode_number}`} tone="live" /><Text style={styles.rowTitle} numberOfLines={1}>{item.anime_title || "Anime"}</Text><View style={styles.progressTrack}><View style={[styles.progress, { width: `${Math.min(100, Math.round((item.progress / Math.max(item.duration, 1)) * 100))}%` }]} /></View><Text style={styles.rowMeta}>{Math.round((item.progress / Math.max(item.duration, 1)) * 100)}% watched</Text></View><AppIcon name="chevron-right" size={18} color={nothing.dim} /></Pressable> : <Pressable accessibilityRole="button" onPress={() => router.push((`/anime/${item.anime_id}`) as never)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><Image source={{ uri: item.image || "" }} style={styles.thumb} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.rowBody}><Signal label="SAVED" tone="live" /><Text style={styles.rowTitle} numberOfLines={1}>{item.anime_title || "Anime"}</Text><Text style={styles.rowMeta}>{item.format || "Anime"}{item.episodes ? ` · ${item.episodes} EP` : ""}</Text></View><AppIcon name="chevron-right" size={18} color={nothing.dim} /></Pressable>} showsVerticalScrollIndicator={false} />}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tabs: { flexDirection: "row", marginHorizontal: 16, gap: 18, borderBottomWidth: 1, borderBottomColor: nothing.line },
  tab: { minHeight: 36, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  tabActive: { borderBottomColor: nothing.red },
  tabText: { color: nothing.muted, fontWeight: "800", fontSize: 12 },
  tabTextActive: { color: nothing.white },
  list: { padding: 16, paddingTop: 8, paddingBottom: 112 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  thumb: { width: 44, height: 62, borderRadius: 6, backgroundColor: nothing.raised },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { color: nothing.white, fontSize: 14, fontWeight: "800", lineHeight: 17 },
  rowMeta: { color: nothing.dim, fontSize: 11, fontWeight: "700" },
  progressTrack: { height: 3, backgroundColor: nothing.line, borderRadius: 1.5, overflow: "hidden" },
  progress: { height: "100%", backgroundColor: nothing.red, borderRadius: 1.5 },
  pressed: nothing.pressed,
});
