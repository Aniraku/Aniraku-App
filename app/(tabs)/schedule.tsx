import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { getAiringScheduleWindow, type AiringScheduleWindow } from "@/lib/anilist";
import { APP_CONFIG } from "@/lib/app-config";
import { animeTitle } from "@/lib/types";
import type { AiringScheduleItem, AiringSchedulePage } from "@/lib/types";
import { useNotifyMe } from "@/hooks/use-notify-me";
import { ErrorState, LoadingState, EmptyState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";

/** Same slim media fragment lib/anilist.ts ships for schedule rows. */
const SCHEDULE_MEDIA_FIELDS = `id type title { romaji english native } coverImage { large extraLarge } format status`;

type ArchivePage = {
  pageInfo?: { currentPage?: number; hasNextPage?: boolean; total?: number | null };
  airingSchedules?: AiringScheduleItem[];
};

// Archive round trips are spaced so rapid "previous day" taps cannot burn the
// app's shared AniList request budget in a few seconds.
let nextArchiveRequestAt = 0;
const ARCHIVE_REQUEST_INTERVAL_MS = 2_500;

/**
 * Past windows need the identical schedule query WITHOUT AniList's
 * `notYetAired` filter — the shared helper hardcodes it, so any window that
 * reaches into the past comes back empty. One direct, throttled round trip
 * keeps yesterday browsable without touching the read-only lib layer.
 */
async function fetchAiringArchive(window: AiringScheduleWindow): Promise<AiringSchedulePage> {
  const query = `query AiringArchive($startAt: Int, $endAt: Int) {
    first: Page(page: 1, perPage: 50) { pageInfo { currentPage hasNextPage total } airingSchedules(airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME]) { airingAt episode media { ${SCHEDULE_MEDIA_FIELDS} } } }
    second: Page(page: 2, perPage: 50) { airingSchedules(airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME]) { airingAt episode media { ${SCHEDULE_MEDIA_FIELDS} } } }
  }`;
  const now = Date.now();
  const scheduledAt = Math.max(now, nextArchiveRequestAt);
  nextArchiveRequestAt = scheduledAt + ARCHIVE_REQUEST_INTERVAL_MS;
  if (scheduledAt > now) await new Promise<void>((resolve) => { setTimeout(resolve, scheduledAt - now); });
  const response = await fetch(APP_CONFIG.anilistGraphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { startAt: window.startAt, endAt: window.endAt } }),
  });
  if (response.status === 429) throw new Error("AniList asked us to slow down. Give it a minute, then try again.");
  const payload = (await response.json().catch(() => null)) as { data?: { first?: ArchivePage; second?: ArchivePage }; errors?: Array<{ message?: string }> } | null;
  if (!response.ok || payload?.errors?.length || !payload?.data?.first) {
    throw new Error(payload?.errors?.[0]?.message || "Past air dates could not be loaded right now.");
  }
  const first = payload.data.first;
  const airingSchedules = [...(first.airingSchedules ?? []), ...(payload.data.second?.airingSchedules ?? [])];
  return {
    pageInfo: {
      currentPage: first.pageInfo?.currentPage ?? 1,
      hasNextPage: Boolean(first.pageInfo?.hasNextPage),
      total: first.pageInfo?.total ?? airingSchedules.length,
    },
    airingSchedules,
  };
}

function startOfLocalDay(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  return start;
}

function localDayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
}

/** One virtualized row: memoized so scrolling a full window never re-renders the list. */
const ScheduleRow = memo(function ScheduleRow({ item }: { item: AiringScheduleItem }) {
  const notify = useNotifyMe(item.media.id);
  const date = new Date(item.airingAt * 1000);
  const anime = item.media;
  const title = animeTitle(anime);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} accessibilityHint="Opens the anime, where you can also manage episode alerts" onPress={() => router.push((`/anime/${anime.id}`) as never)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <Text style={styles.time}>{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text>
      <View style={styles.itemContent}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.meta}>EPISODE {item.episode} · {anime.format || "ANIME"}</Text>
      </View>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: notify.enabled }} accessibilityLabel={notify.enabled ? `Reminders on for ${title}` : `Remind me about ${title}`} hitSlop={8} onPress={() => void notify.toggle()} style={({ pressed }) => [styles.bell, notify.enabled && styles.bellActive, pressed && styles.pressed]}>
        <AppIcon name={notify.enabled ? "bell" : "bell-outline"} size={16} color={notify.enabled ? nothing.red : nothing.white} />
      </Pressable>
      <Image source={{ uri: anime.coverImage?.large || anime.coverImage?.extraLarge || "" }} style={styles.poster} contentFit="cover" transition={0} cachePolicy="memory-disk" />
    </Pressable>
  );
});

export default function ScheduleScreen() {
  const [dayOffset, setDayOffset] = useState(0);
  // The 7-day anchor is local midnight. Re-derive it on every window build and
  // poll for the date flip, so a screen left open past midnight never serves a
  // stale window (the old mount-time useMemo did).
  const [todayKey, setTodayKey] = useState(() => localDayKey(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      setTodayKey((prev) => {
        const next = localDayKey(new Date());
        return next === prev ? prev : next;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const window = useMemo(() => {
    // `todayKey` is the midnight trigger: when the local date flips this runs
    // again against a fresh `new Date()`, shifting the whole window forward.
    const start = startOfLocalDay(new Date());
    start.setDate(start.getDate() + dayOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { startAt: Math.floor(start.getTime() / 1000), endAt: Math.floor(end.getTime() / 1000) };
  }, [dayOffset, todayKey]);

  const schedule = useQuery({
    queryKey: ["schedule", window.startAt, window.endAt],
    queryFn: () => (dayOffset < 0 ? fetchAiringArchive(window) : getAiringScheduleWindow(window)),
    // A 7-day window barely moves minute to minute — cache so tab switches
    // are instant instead of re-paying the backend round.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const sections = useMemo(() => {
    const result = new Map<string, AiringScheduleItem[]>();
    schedule.data?.airingSchedules.forEach((item) => { const key = new Date(item.airingAt * 1000).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }); const current = result.get(key) ?? []; result.set(key, [...current, item]); });
    return [...result.entries()].map(([title, data]) => ({ title, data }));
  }, [schedule.data]);

  const isToday = dayOffset === 0;
  const rangeLabel = useMemo(() => {
    const start = new Date(window.startAt * 1000);
    const end = new Date((window.endAt - 1) * 1000);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
    return `${startLabel} – ${endLabel}`;
  }, [window.startAt, window.endAt]);
  const offsetLabel = isToday ? "TODAY" : dayOffset < 0 ? `${Math.abs(dayOffset)} DAY${dayOffset === -1 ? "" : "S"} AGO` : `${dayOffset} DAY${dayOffset === 1 ? "" : "S"} AHEAD`;
  const showList = !schedule.isPending && !schedule.isError && Boolean(schedule.data) && sections.length > 0;

  return (
    <NativeScreen scroll={false} style={styles.fill}>
      <View style={styles.top}>
        <NativeHeader eyebrow={isToday ? "NEXT 7 DAYS" : dayOffset < 0 ? "BROWSING PAST" : "BROWSING AHEAD"} title="Episode schedule" action={<SearchAction />} />
        <View style={styles.legend}><View style={styles.legendLine} /><Text style={styles.legendCopy}>{isToday ? "Today appears first, followed by the next six local dates." : `Seven local dates from ${rangeLabel}, grouped by the day each episode airs.`}</Text></View>
        <View style={styles.dateNav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => setDayOffset((value) => value - 1)} style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
            <AppIcon name="chevron-left" size={18} color={nothing.white} />
          </Pressable>
          <View style={styles.rangeBox}><Text style={styles.rangeText}>{rangeLabel}</Text><Text style={styles.rangeSub}>{offsetLabel}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => setDayOffset((value) => value + 1)} style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
            <AppIcon name="chevron-right" size={18} color={nothing.white} />
          </Pressable>
          {isToday ? null : <Pressable accessibilityRole="button" accessibilityLabel="Jump to today" onPress={() => setDayOffset(0)} style={({ pressed }) => [styles.todayBtn, pressed && styles.pressed]}><Text style={styles.todayText}>TODAY</Text></Pressable>}
        </View>
        {schedule.isPending ? <LoadingState label={isToday ? "Checking the next seven days" : `Loading air dates for ${rangeLabel}`} /> : schedule.isError || !schedule.data ? <ErrorState message={schedule.error?.message ?? (isToday ? "We could not load the next seven days." : `We could not load air dates for ${rangeLabel}.`)} onRetry={() => void schedule.refetch()} /> : !sections.length ? <EmptyState label={isToday ? "No episodes scheduled for the next seven days." : `No episodes scheduled for ${rangeLabel}.`} /> : null}
      </View>
      {showList ? (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.media?.id ?? "anime"}:${item.episode}:${item.airingAt}:${index}`}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <View style={styles.dayHead}><Text style={styles.dayText}>{section.title}</Text><View style={styles.dayRule} /></View>}
          renderItem={({ item }) => <ScheduleRow item={item} />}
          refreshControl={<RefreshControl refreshing={schedule.isFetching && !schedule.isPending} onRefresh={() => void schedule.refetch()} tintColor={nothing.red} colors={[nothing.red]} />}
        />
      ) : null}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, top: { paddingHorizontal: 18, gap: 28 }, legend: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 8 }, legendLine: { width: 18, height: 2, backgroundColor: nothing.red }, legendCopy: { color: nothing.muted, fontSize: 12 }, dateNav: { flexDirection: "row", alignItems: "center", gap: 10 }, navBtn: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, backgroundColor: "transparent" }, rangeBox: { flex: 1, alignItems: "center", gap: 3 }, rangeText: { color: nothing.white, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 }, rangeSub: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }, todayBtn: { minHeight: 42, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 8 }, todayText: { color: nothing.white, fontFamily: nothing.mono, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }, list: { flex: 1 }, listContent: { paddingHorizontal: 18, paddingBottom: 110 }, dayHead: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 8 }, dayText: { color: nothing.white, fontSize: 20, fontWeight: "900", letterSpacing: -0.45 }, dayRule: { flex: 1, height: 1, backgroundColor: nothing.line }, item: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 3, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: nothing.line }, poster: { width: 39, height: 57, borderRadius: 4, backgroundColor: nothing.raised }, itemContent: { flex: 1, justifyContent: "center", gap: 4 }, time: { width: 56, color: nothing.white, fontFamily: nothing.mono, fontSize: 11, fontWeight: "800" }, title: { color: nothing.white, fontSize: 14, fontWeight: "900", lineHeight: 18 }, meta: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 }, bell: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 8 }, bellActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" }, pressed: nothing.pressedSubtle,
});
