import { useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useNotifications } from "@/hooks/use-notifications";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

type LibraryTab = "history" | "bookmarks" | "alerts";

export default function LibraryScreen() {
  const auth = useAnirakuAuth();
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const notifications = useNotifications();
  const [tab, setTab] = useState<LibraryTab>("history");
  if (!auth.user) { router.replace("/auth" as never); return null; }
  const data = tab === "history" ? history.history : tab === "bookmarks" ? bookmarks.bookmarks : notifications.notifications;
  const records = data.data ?? [];
  const content = data.isPending ? <LoadingState label="Synchronizing your library" /> : data.isError ? <ErrorState message="Your library could not be synchronized." onRetry={() => void data.refetch()} /> : records.length === 0 ? <EmptyState label={tab === "history" ? "Watch a title to begin your synchronized history." : tab === "bookmarks" ? "Save a title to begin your synchronized bookmarks." : "No account notifications yet."} /> : <FlatList data={records} keyExtractor={(item) => item.id ?? `${item.anime_id}:${item.episode_number}`} contentContainerStyle={styles.list} renderItem={({ item }) => tab === "history" ? <Pressable onPress={() => router.push({ pathname: "/watch/[id]", params: { id: String(item.anime_id), episode: String(item.episode_number), title: item.anime_title ?? "Anime", image: item.anime_image ?? "" } } as never)}><NothingCard style={styles.row}><Image source={item.anime_image || undefined} style={styles.thumb} contentFit="cover" /><View style={styles.rowBody}><Text style={styles.rowTitle} numberOfLines={1}>{item.anime_title || "Anime"}</Text><Text style={styles.rowMeta}>EP {item.episode_number} · {Math.round((item.progress / Math.max(item.duration, 1)) * 100)}% WATCHED</Text></View></NothingCard></Pressable> : tab === "bookmarks" ? <Pressable onPress={() => router.push((`/anime/${item.anime_id}`) as never)}><NothingCard style={styles.row}><Image source={item.image || undefined} style={styles.thumb} contentFit="cover" /><View style={styles.rowBody}><Text style={styles.rowTitle} numberOfLines={1}>{item.title || "Anime"}</Text><Text style={styles.rowMeta}>{item.type || "ANIME"}</Text></View></NothingCard></Pressable> : <Pressable onPress={() => { void notifications.markRead.mutateAsync(item.id); if (item.anime_id) router.push((`/anime/${item.anime_id}`) as never); }}><NothingCard style={styles.alert}><Signal label={item.read ? "READ" : item.type?.toUpperCase() || "INFO"} tone={item.read ? "muted" : "live"} /><Text style={styles.alertText}>{item.message}</Text></NothingCard></Pressable>} />;
  return <NativeScreen scroll={false} style={styles.fill}><View style={styles.top}><Pressable onPress={() => router.back()}><Text style={styles.close}>CLOSE</Text></Pressable><DotLabel>Cloud account</DotLabel><Text style={styles.title}>Library</Text></View><View style={styles.tabs}>{(["history", "bookmarks", "alerts"] as LibraryTab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text></Pressable>)}</View><View style={styles.content}>{content}</View></NativeScreen>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, top: { minHeight: 118, paddingHorizontal: 18, justifyContent: "center", gap: 7 }, close: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 11, letterSpacing: 1.4 }, title: { color: nothing.white, fontSize: 31, fontWeight: "900", letterSpacing: -0.8 }, tabs: { flexDirection: "row", paddingHorizontal: 18, gap: 8, paddingBottom: 14 }, tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: nothing.line }, tabActive: { backgroundColor: nothing.white, borderColor: nothing.white }, tabText: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }, tabTextActive: { color: nothing.black }, content: { flex: 1 }, list: { paddingHorizontal: 18, paddingBottom: 30, gap: 9 }, row: { flexDirection: "row", minHeight: 82, overflow: "hidden" }, thumb: { width: 56, height: "100%", backgroundColor: nothing.raised }, rowBody: { flex: 1, justifyContent: "center", paddingHorizontal: 13, gap: 6 }, rowTitle: { color: nothing.white, fontWeight: "800", fontSize: 15 }, rowMeta: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, letterSpacing: 0.6 }, alert: { padding: 14, gap: 8 }, alertText: { color: nothing.white, fontSize: 14, lineHeight: 20 }, });
