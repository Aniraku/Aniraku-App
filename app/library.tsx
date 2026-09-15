import { router } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useNotifications } from "@/hooks/use-notifications";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { AnirakuMark, DotLabel, NothingButton, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { FirstRunImportPrompt } from "@/components/first-run-import-prompt";
import { RESUME_ROWS_STORAGE_KEY, buildResumeRows, type ResumeRow } from "@/lib/up-next";

type LibraryTab = "history" | "bookmarks" | "alerts";
const tabMeta: Record<LibraryTab, { label: string; icon: "history" | "bookmark-multiple-outline" | "bell-outline" }> = { history: { label: "History", icon: "history" }, bookmarks: { label: "Saved", icon: "bookmark-multiple-outline" }, alerts: { label: "Alerts", icon: "bell-outline" } };

export default function LibraryScreen() {
  const auth = useAnirakuAuth();
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const notifications = useNotifications();
  const [tab, setTab] = useState<LibraryTab>("history");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [cachedResumeRows, setCachedResumeRows] = useState<ResumeRow[] | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(RESUME_ROWS_STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { rows?: ResumeRow[] };
          if (active && Array.isArray(parsed.rows)) setCachedResumeRows(parsed.rows);
        } catch {
          // Corrupted cache reads as empty; live query repopulates it.
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const liveHistory = history.history.data;
  useEffect(() => {
    if (!liveHistory) return;
    try {
      const rows = buildResumeRows(
        liveHistory.map((item) => ({
          anime_id: item.anime_id,
          anime_title: item.anime_title,
          anime_image: item.anime_image,
          episode_number: item.episode_number,
          progress: item.progress,
          duration: item.duration,
          updated_at: item.updated_at ?? null,
        })),
      );
      void AsyncStorage.setItem(
        RESUME_ROWS_STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), rows }),
      ).catch(() => {});
    } catch {
      // Precompute is best-effort; live rows still render.
    }
  }, [liveHistory]);
  if (auth.loading) return <NativeScreen scroll={false} style={styles.fill}><View style={styles.redirectState}><DotLabel>LIBRARY / SECURE SYNC</DotLabel><Text style={styles.redirectTitle}>Opening your library</Text><Text style={styles.redirectCopy}>Checking your private watch history, saved titles, and alert state.</Text></View></NativeScreen>;
  if (!auth.user) return <NativeScreen scroll={false} style={styles.fill}><View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Close alerts preview" onPress={() => router.back()} style={styles.close}><AppIcon name="arrow-left" size={21} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel>ALERTS / PREVIEW</DotLabel><Text style={styles.title}>Stay in the loop</Text></View><AnirakuMark size={36} /></View><View style={styles.guestAlert}><Signal label="ACCOUNT SIGNAL" tone="live" /><Text style={styles.guestAlertTitle}>Your anime alerts,<br />kept in one place.</Text><Text style={styles.guestAlertCopy}>Episode, comment, and library activity alerts appear here after you sign in.</Text><NothingButton label="SIGN IN TO SYNC ALERTS" onPress={() => router.push("/auth" as never)} /></View></NativeScreen>;
  const cachedHistoryFallback = history.history.isPending && !history.history.data && cachedResumeRows?.length
    ? cachedResumeRows.map((row) => ({ id: `${row.animeId}:${row.episode}`, anime_id: row.animeId, anime_title: row.animeTitle, anime_image: row.animeImage, episode_number: row.episode, progress: row.progress, duration: row.duration }))
    : null;
  const data = tab === "history" ? history.history : tab === "bookmarks" ? bookmarks.bookmarks : notifications.notifications;
  const allRecords = (tab === "history" && cachedHistoryFallback?.length ? cachedHistoryFallback : data.data) ?? [];
  const records = tab === "alerts" && unreadOnly ? allRecords.filter((item) => !item.read) : allRecords;
  const content = data.isPending && !(tab === "history" && cachedHistoryFallback?.length) ? <LoadingState label="Synchronizing your library" /> : data.isError ? <ErrorState message="Your library could not be synchronized." onRetry={() => void data.refetch()} /> : records.length === 0 ? <EmptyState label={tab === "history" ? "Watch a title to begin your synchronized history." : tab === "bookmarks" ? "Save a title to begin your synchronized bookmarks." : "No account notifications yet."} /> : <FlatList data={records} keyExtractor={(item) => item.id ?? `${item.anime_id}:${item.episode_number}`} contentContainerStyle={styles.list} renderItem={({ item }) => tab === "history" ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/watch/[id]", params: { id: String(item.anime_id), episode: String(item.episode_number), title: item.anime_title ?? "Anime", image: item.anime_image ?? "" } } as never)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><Image source={{ uri: (item.episode_thumbnail || item.anime_image) || "" }} style={styles.thumb} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.rowBody}><Signal label={`EP ${item.episode_number}`} tone="live" /><Text style={styles.rowTitle} numberOfLines={1}>{item.anime_title || "Anime"}</Text><View style={styles.progressTrack}><View style={[styles.progress, { width: `${Math.min(100, Math.round((item.progress / Math.max(item.duration, 1)) * 100))}%` }]} /></View><Text style={styles.rowMeta}>{Math.round((item.progress / Math.max(item.duration, 1)) * 100)}% WATCHED · RESUME</Text></View><AppIcon name="chevron-right" size={20} color={nothing.muted} /></Pressable> : tab === "bookmarks" ? <Pressable accessibilityRole="button" onPress={() => router.push((`/anime/${item.anime_id}`) as never)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><Image source={{ uri: item.image || "" }} style={styles.thumb} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.rowBody}><Signal label={item.type || "ANIME"} /><Text style={styles.rowTitle} numberOfLines={2}>{item.title || "Anime"}</Text><Text style={styles.rowMeta}>SAVED TO LIBRARY</Text></View><AppIcon name="chevron-right" size={20} color={nothing.muted} /></Pressable> : <Pressable accessibilityRole="button" onPress={() => { void notifications.markRead.mutateAsync(item.id); if (item.anime_id) router.push((`/anime/${item.anime_id}`) as never); }} style={({ pressed }) => [styles.alert, pressed && styles.pressed]}><Signal label={item.read ? "READ" : item.type?.toUpperCase() || "INFO"} tone={item.read ? "muted" : "live"} /><Text style={styles.alertText}>{item.message}</Text>{!item.read ? <View style={styles.unread} /> : null}</Pressable>}/>;
  const current = tabMeta[tab];
  return <NativeScreen scroll={false} style={styles.fill}><View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Close library" onPress={() => router.back()} style={styles.close}><AppIcon name="arrow-left" size={21} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel>LIBRARY / VERIFIED SYNC</DotLabel><Text style={styles.title}>Your collection</Text></View><AnirakuMark size={36} /></View><View style={styles.tabs}>{(["history", "bookmarks", "alerts"] as LibraryTab[]).map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === item }} key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{tabMeta[item].label}</Text></Pressable>)}</View><FirstRunImportPrompt /><View style={styles.sectionHead}><View><DotLabel tone="live">{current.label}</DotLabel><Text style={styles.sectionTitle}>{current.label === "History" ? "Pick up where you left off" : current.label === "Saved" ? "Your locked signals" : "Library activity"}</Text></View><Text style={styles.count}>{String(records.length).padStart(2, "0")}</Text></View>{tab === "alerts" ? <View style={styles.alertActions}><Pressable accessibilityRole="switch" accessibilityState={{ checked: unreadOnly }} onPress={() => setUnreadOnly((value) => !value)} style={[styles.alertAction, unreadOnly && styles.alertActionActive]}><Text style={[styles.alertActionText, unreadOnly && styles.alertActionTextActive]}>UNREAD</Text></Pressable><Pressable accessibilityRole="button" disabled={notifications.markAllRead.isPending || !allRecords.some((item) => !item.read)} onPress={() => void notifications.markAllRead.mutateAsync()} style={[styles.alertAction, (!allRecords.some((item) => !item.read) || notifications.markAllRead.isPending) && styles.alertActionDisabled]}><Text style={styles.alertActionText}>{notifications.markAllRead.isPending ? "MARKING" : "MARK ALL READ"}</Text></Pressable></View> : null}<View style={styles.content}>{content}</View></NativeScreen>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, redirectState: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 9 }, redirectTitle: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 }, redirectCopy: { color: nothing.muted, fontSize: 13, lineHeight: 19, maxWidth: 290 }, top: { minHeight: 82, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }, close: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised, alignItems: "center", justifyContent: "center" }, titleBlock: { flex: 1, gap: 2 }, title: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.65 }, guestAlert: { flex: 1, paddingHorizontal: 24, paddingBottom: 28, justifyContent: "center", gap: 14 }, guestAlertTitle: { color: nothing.white, fontSize: 31, fontWeight: "900", letterSpacing: -0.9, lineHeight: 36 }, guestAlertCopy: { color: nothing.muted, fontSize: 13, lineHeight: 20, maxWidth: 330 }, guestAlertCard: { padding: 15, flexDirection: "row", gap: 12, borderRadius: 14, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line }, guestAlertCardCopy: { flex: 1, gap: 5 }, guestAlertCardTitle: { color: nothing.white, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }, guestAlertCardText: { color: nothing.muted, fontSize: 12, lineHeight: 17 }, guestAlertFoot: { color: nothing.dim, fontSize: 11, lineHeight: 16, textAlign: "center", paddingHorizontal: 18 }, tabs: { flexDirection: "row", marginHorizontal: 16, gap: 18, borderBottomWidth: 1, borderBottomColor: nothing.line }, tab: { minHeight: 36, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 }, tabActive: { borderBottomColor: nothing.red }, tabText: { color: nothing.muted, fontWeight: "800", fontSize: 12 }, tabTextActive: { color: nothing.white }, sectionHead: { minHeight: 74, marginHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: nothing.white, marginTop: 4, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 }, count: { color: nothing.dim, fontFamily: nothing.mono, fontWeight: "900", fontSize: 12 }, content: { flex: 1 }, list: { paddingHorizontal: 16, paddingBottom: 30, gap: 0, borderTopWidth: 1, borderTopColor: nothing.line }, row: { minHeight: 96, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: nothing.line }, thumb: { width: 57, height: 82, borderRadius: 8, backgroundColor: nothing.raised }, rowBody: { flex: 1, justifyContent: "center", gap: 5 }, rowTitle: { color: nothing.white, fontWeight: "900", fontSize: 14, lineHeight: 18 }, rowMeta: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.35 }, progressTrack: { height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: nothing.line }, progress: { height: "100%", backgroundColor: nothing.red }, alert: { minHeight: 72, paddingVertical: 12, gap: 6, borderBottomWidth: 1, borderBottomColor: nothing.line }, alertText: { color: nothing.white, fontSize: 13, lineHeight: 19 }, unread: { width: 7, height: 7, borderRadius: 4, backgroundColor: nothing.red, position: "absolute", top: 13, right: 13 }, pressed: nothing.pressed,
  alertActions: { flexDirection: "row", gap: 7, marginHorizontal: 16, marginBottom: 9 }, alertAction: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line }, alertActionActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.09)" }, alertActionDisabled: { opacity: 0.35 }, alertActionText: { color: nothing.white, fontWeight: "900", fontSize: 10, letterSpacing: 0.25 }, alertActionTextActive: { color: nothing.red },
});
