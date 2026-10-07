import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useNotifications } from "@/hooks/use-notifications";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { FirstRunImportPrompt } from "@/components/first-run-import-prompt";
import { DotLabel, nothing, Signal } from "@/components/nothing-ui";
import { RESUME_ROWS_STORAGE_KEY, buildResumeRows, type ResumeRow } from "@/lib/up-next";

export type LibraryTab = "history" | "bookmarks" | "alerts";
export type LibrarySort = "recent" | "title" | "score";
export type LibraryLayout = "list" | "grid";

const tabMeta: Record<LibraryTab, { label: string }> = { history: { label: "History" }, bookmarks: { label: "Saved" }, alerts: { label: "Alerts" } };
const sectionTitle: Record<LibraryTab, string> = { history: "Pick up where you left off", bookmarks: "Your locked signals", alerts: "Library activity" };
const emptyLabel: Record<LibraryTab, string> = {
  history: "Watch a title to begin your synchronized history.",
  bookmarks: "Save a title to begin your synchronized bookmarks.",
  alerts: "No account notifications yet.",
};
const sortLabels: Record<LibrarySort, string> = { recent: "RECENT", title: "TITLE", score: "SCORE" };

function sortOptionsFor(tab: LibraryTab): LibrarySort[] {
  if (tab === "history") return ["recent", "title"];
  if (tab === "bookmarks") return ["recent", "title", "score"];
  return ["recent"];
}

function searchText(tab: LibraryTab, row: any, query: string) {
  const haystack = tab === "history"
    ? `${row?.anime_title ?? ""} ${row?.episode_title ?? ""} ${row?.episode_number ?? ""}`
    : tab === "bookmarks"
      ? `${row?.title ?? ""} ${row?.anime_title ?? ""} ${row?.type ?? ""}`
      : `${row?.message ?? ""} ${row?.type ?? ""}`;
  return haystack.toLowerCase().includes(query);
}

/** Server order already is "recent"; only the other sorts reorder. */
function sortRecords(tab: LibraryTab, sort: LibrarySort, rows: any[]): any[] {
  if (tab === "alerts" || sort === "recent") return rows;
  const copy = rows.slice();
  if (sort === "title") {
    copy.sort((left, right) => String(left?.anime_title ?? left?.title ?? "").localeCompare(String(right?.anime_title ?? right?.title ?? "")));
  } else if (sort === "score") {
    copy.sort((left, right) => (Number(right?.score) || 0) - (Number(left?.score) || 0));
  }
  return copy;
}

function watchedPercent(row: any): number {
  const progress = Number(row?.progress);
  const duration = Number(row?.duration);
  if (!Number.isFinite(progress) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress / duration) * 100)));
}

type LibraryViewProps = { variant?: "tab" | "route" };

/**
 * The single Library experience (History / Saved / Alerts) shared by the
 * `(tabs)` tab and the pushed `/library` route so the two can no longer drift
 * apart. Chrome (headers, back buttons, auth gates) stays with each screen.
 */
export function LibraryView({ variant = "tab" }: LibraryViewProps) {
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const notifications = useNotifications();
  const [tab, setTab] = useState<LibraryTab>("history");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [layout, setLayout] = useState<LibraryLayout>("list");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
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
      void AsyncStorage.setItem(RESUME_ROWS_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), rows })).catch(() => {});
    } catch {
      // Precompute is best-effort; live rows still render.
    }
  }, [liveHistory]);

  const fallbackRows = history.history.isPending && !history.history.data && cachedResumeRows?.length
    ? cachedResumeRows.map((row) => ({ id: `${row.animeId}:${row.episode}`, anime_id: row.animeId, anime_title: row.animeTitle, anime_image: row.animeImage, episode_number: row.episode, progress: row.progress, duration: row.duration }))
    : null;
  const data = tab === "history" ? history.history : tab === "bookmarks" ? bookmarks.bookmarks : notifications.notifications;
  const allRecords: any[] = (tab === "history" && fallbackRows?.length ? fallbackRows : data.data ?? []);
  const canRemoveHistory = tab === "history" && Boolean(history.history.data) && !fallbackRows?.length;
  const activeSort = sortOptionsFor(tab).includes(sort) ? sort : "recent";
  const query = search.trim().toLowerCase();
  const searched = query ? allRecords.filter((row) => searchText(tab, row, query)) : allRecords;
  const records = tab === "alerts"
    ? (unreadOnly ? searched.filter((row) => !row.read) : searched)
    : sortRecords(tab, activeSort, searched);
  const isGrid = tab === "bookmarks" && layout === "grid";
  const pending = data.isPending && !(tab === "history" && fallbackRows?.length);

  const confirmRemoveHistory = (row: any) => {
    const animeId = Number(row?.anime_id);
    const episode = Number(row?.episode_number);
    if (!Number.isInteger(animeId) || !Number.isInteger(episode)) return;
    const key = `${animeId}:${episode}`;
    const title = String(row?.anime_title || "Anime");
    Alert.alert("Remove from history?", `${title} · EP ${episode} leaves your history and the Continue Watching rail.`, [
      { text: "KEEP", style: "cancel" },
      {
        text: "REMOVE",
        style: "destructive",
        onPress: () => {
          setRemovingKey(key);
          void history.remove
            .mutateAsync({ animeId, episode })
            .catch(() => Alert.alert("Could not remove", "That row is still in your history. Try again when you are online."))
            .finally(() => setRemovingKey(null));
        },
      },
    ]);
  };

  const renderHistoryRow = (item: any) => {
    const percent = watchedPercent(item);
    const key = `${Number(item?.anime_id)}:${Number(item?.episode_number)}`;
    const removing = removingKey === key;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Continue ${item.anime_title || "Anime"} episode ${item.episode_number}`}
        onPress={() => router.push({ pathname: "/watch/[id]", params: { id: String(item.anime_id), episode: String(item.episode_number), title: item.anime_title ?? "Anime", image: item.anime_image ?? "" } } as never)}
        onLongPress={() => canRemoveHistory && confirmRemoveHistory(item)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Image source={{ uri: (item.episode_thumbnail || item.anime_image) || "" }} style={styles.thumb} contentFit="cover" transition={0} cachePolicy="memory-disk" />
        <View style={styles.rowBody}>
          <Signal label={`EP ${item.episode_number}`} tone="live" />
          <Text style={styles.rowTitle} numberOfLines={1}>{item.anime_title || "Anime"}</Text>
          <View style={styles.progressTrack}><View style={[styles.progress, { width: `${percent}%` }]} /></View>
          <Text style={styles.rowMeta}>{percent}% WATCHED · RESUME</Text>
        </View>
        {canRemoveHistory ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.anime_title || "Anime"} episode ${item.episode_number} from history`}
            accessibilityHint="Long pressing the row does the same"
            disabled={removing}
            hitSlop={8}
            onPress={() => confirmRemoveHistory(item)}
            style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
          >
            <AppIcon name="trash-can-outline" size={16} color={removing ? nothing.red : nothing.dim} />
          </Pressable>
        ) : null}
        <AppIcon name="chevron-right" size={18} color={nothing.dim} />
      </Pressable>
    );
  };

  const openBookmark = (item: any) => router.push((`/anime/${item.anime_id}`) as never);

  const renderBookmarkRow = (item: any) => (
    <Pressable accessibilityRole="button" onPress={() => openBookmark(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Image source={{ uri: item.image || item.anime_image || "" }} style={styles.thumb} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      <View style={styles.rowBody}>
        <Signal label={item.type || "ANIME"} />
        <Text style={styles.rowTitle} numberOfLines={2}>{item.title || item.anime_title || "Anime"}</Text>
        <Text style={styles.rowMeta}>{item.type || item.format || "Anime"}{Number(item?.score) > 0 ? ` · ${Math.round(Number(item.score))}%` : ""}{item.episodes ? ` · ${item.episodes} EP` : ""}</Text>
      </View>
      <AppIcon name="chevron-right" size={18} color={nothing.dim} />
    </Pressable>
  );

  const renderBookmarkGrid = (item: any) => {
    const uri = item.image || item.anime_image || "";
    const score = Number(item?.score);
    return (
      <Pressable accessibilityRole="button" onPress={() => openBookmark(item)} style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}>
        <View style={styles.gridImage}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
          ) : (
            <Text style={styles.gridLetter}>{String(item.title || item.anime_title || "A").charAt(0).toUpperCase()}</Text>
          )}
          {Number.isFinite(score) && score > 0 ? (
            <View style={styles.gridBadge}><Text style={styles.gridBadgeText}>{Math.round(score)}%</Text></View>
          ) : null}
        </View>
        <Text style={styles.gridTitle} numberOfLines={2}>{item.title || item.anime_title || "Anime"}</Text>
        <Text style={styles.gridMeta} numberOfLines={1}>{item.type || item.format || "ANIME"}</Text>
      </Pressable>
    );
  };

  const renderAlertRow = (item: any) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void notifications.markRead.mutateAsync(item.id);
        if (item.anime_id) router.push((`/anime/${item.anime_id}`) as never);
      }}
      style={({ pressed }) => [styles.alert, pressed && styles.pressed]}
    >
      <Signal label={item.read ? "READ" : item.type?.toUpperCase() || "INFO"} tone={item.read ? "muted" : "live"} />
      <Text style={styles.alertText}>{item.message}</Text>
      {!item.read ? <View style={styles.unread} /> : null}
    </Pressable>
  );

  const renderItem = ({ item }: { item: any }) => {
    if (tab === "history") return renderHistoryRow(item);
    if (tab === "bookmarks") return isGrid ? renderBookmarkGrid(item) : renderBookmarkRow(item);
    return renderAlertRow(item);
  };

  const emptyMessage = query
    ? `Nothing in ${tabMeta[tab].label} matches “${search.trim()}”.`
    : emptyLabel[tab];
  const current = tabMeta[tab];

  const content = pending
    ? <LoadingState label="Synchronizing your library" />
    : data.isError
      ? <ErrorState message="Your library could not be synchronized." onRetry={() => void data.refetch()} />
      : records.length === 0
        ? <EmptyState label={emptyMessage} action={query ? { label: "CLEAR SEARCH", onPress: () => setSearch("") } : undefined} />
        : <FlatList
            key={`${tab}-${layout}`}
            data={records}
            numColumns={isGrid ? 2 : 1}
            columnWrapperStyle={isGrid ? styles.gridRow : undefined}
            keyExtractor={(item: any) => String(item?.id ?? `${item?.anime_id}:${item?.episode_number}`)}
            contentContainerStyle={[styles.list, isGrid && styles.gridList, { paddingBottom: variant === "route" ? 40 : 112 }]}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
          />;

  return (
    <View style={styles.fill}>
      <View style={styles.tabs}>
        {(["history", "bookmarks", "alerts"] as LibraryTab[]).map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tab, tab === item && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{tabMeta[item].label}</Text>
          </Pressable>
        ))}
      </View>
      <FirstRunImportPrompt />
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadText}>
          <DotLabel tone="live">{current.label}</DotLabel>
          <Text style={styles.sectionTitle}>{sectionTitle[tab]}</Text>
        </View>
        <Text style={styles.count}>{String(records.length).padStart(2, "0")}</Text>
      </View>
      <View style={styles.controlsRow}>
        {tab === "alerts" ? <View style={styles.flex} /> : (
          <View style={styles.searchBox}>
            <AppIcon name="magnify" size={16} color={nothing.dim} />
            <TextInput
              accessibilityRole="search"
              accessibilityLabel="Search within your library"
              value={search}
              onChangeText={setSearch}
              placeholder={tab === "history" ? "Search history…" : "Search saved anime…"}
              placeholderTextColor={nothing.dim}
              style={styles.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setSearch("")}>
                <AppIcon name="close" size={14} color={nothing.dim} />
              </Pressable>
            ) : null}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open offline downloads"
          onPress={() => router.push("/downloads" as never)}
          style={({ pressed }) => [styles.offlineBtn, pressed && styles.pressed]}
        >
          <AppIcon name="download" size={15} color={nothing.white} />
          <Text style={styles.offlineText}>OFFLINE</Text>
        </Pressable>
      </View>
      {tab !== "alerts" ? (
        <View style={styles.controlsRow}>
          <View style={styles.chipRow}>
            {sortOptionsFor(tab).map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: activeSort === option }}
                key={option}
                onPress={() => setSort(option)}
                style={[styles.chip, activeSort === option && styles.chipActive]}
              >
                <Text style={[styles.chipText, activeSort === option && styles.chipTextActive]}>{sortLabels[option]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.flex} />
          {tab === "bookmarks" ? (
            <View style={styles.chipRow}>
              {(["list", "grid"] as LibraryLayout[]).map((option) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={option === "grid" ? "Grid view" : "List view"}
                  accessibilityState={{ selected: layout === option }}
                  key={option}
                  onPress={() => setLayout(option)}
                  style={[styles.chip, styles.iconChip, layout === option && styles.chipActive]}
                >
                  <AppIcon name={option === "grid" ? "view-grid-outline" : "layers"} size={15} color={layout === option ? nothing.red : nothing.muted} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {tab === "alerts" ? (
        <View style={styles.alertActions}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: unreadOnly }}
            onPress={() => setUnreadOnly((value) => !value)}
            style={[styles.alertAction, unreadOnly && styles.alertActionActive]}
          >
            <Text style={[styles.alertActionText, unreadOnly && styles.alertActionTextActive]}>UNREAD</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={notifications.markAllRead.isPending || !allRecords.some((item) => !item.read)}
            onPress={() => void notifications.markAllRead.mutateAsync()}
            style={[styles.alertAction, (!allRecords.some((item) => !item.read) || notifications.markAllRead.isPending) && styles.alertActionDisabled]}
          >
            <Text style={styles.alertActionText}>{notifications.markAllRead.isPending ? "MARKING" : "MARK ALL READ"}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.content}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  tabs: { flexDirection: "row", marginHorizontal: 16, gap: 18, borderBottomWidth: 1, borderBottomColor: nothing.line },
  tab: { minHeight: 36, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  tabActive: { borderBottomColor: nothing.red },
  tabText: { color: nothing.muted, fontWeight: "800", fontSize: 12 },
  tabTextActive: { color: nothing.white },
  sectionHead: { minHeight: 74, marginHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeadText: { gap: 4 },
  sectionTitle: { color: nothing.white, marginTop: 4, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  count: { color: nothing.dim, fontFamily: nothing.mono, fontWeight: "900", fontSize: 12 },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 9 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  searchInput: { flex: 1, minHeight: 38, color: nothing.white, fontSize: 13 },
  offlineBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  offlineText: { color: nothing.white, fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { minHeight: 30, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  iconChip: { paddingHorizontal: 8, minWidth: 34 },
  chipActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.1)" },
  chipText: { color: nothing.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.2, textTransform: "uppercase" },
  chipTextActive: { color: nothing.red },
  alertActions: { flexDirection: "row", gap: 7, marginHorizontal: 16, marginBottom: 9 },
  alertAction: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line },
  alertActionActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.09)" },
  alertActionDisabled: { opacity: 0.35 },
  alertActionText: { color: nothing.white, fontWeight: "900", fontSize: 10, letterSpacing: 0.25 },
  alertActionTextActive: { color: nothing.red },
  content: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 30, gap: 0, borderTopWidth: 1, borderTopColor: nothing.line },
  gridList: { gap: 12, paddingTop: 12 },
  gridRow: { gap: 12 },
  row: { minHeight: 96, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: nothing.line },
  thumb: { width: 57, height: 82, borderRadius: 8, backgroundColor: nothing.raised },
  rowBody: { flex: 1, justifyContent: "center", gap: 5 },
  rowTitle: { color: nothing.white, fontWeight: "900", fontSize: 14, lineHeight: 18 },
  rowMeta: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.35 },
  progressTrack: { height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: nothing.line },
  progress: { height: "100%", backgroundColor: nothing.red },
  removeBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  gridCard: { flex: 1, gap: 6 },
  gridImage: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", backgroundColor: nothing.raised, alignItems: "center", justifyContent: "center" },
  gridLetter: { color: nothing.dim, fontSize: 34, fontWeight: "900" },
  gridBadge: { position: "absolute", top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.82)", borderWidth: 1, borderColor: nothing.line },
  gridBadgeText: { color: nothing.green, fontFamily: nothing.mono, fontSize: 10, fontWeight: "900" },
  gridTitle: { color: nothing.white, fontSize: 13, fontWeight: "800", lineHeight: 17 },
  gridMeta: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.35 },
  alert: { minHeight: 72, paddingVertical: 12, gap: 6, borderBottomWidth: 1, borderBottomColor: nothing.line },
  alertText: { color: nothing.white, fontSize: 13, lineHeight: 19 },
  unread: { width: 7, height: 7, borderRadius: 4, backgroundColor: nothing.red, position: "absolute", top: 13, right: 13 },
  pressed: nothing.pressed,
});
