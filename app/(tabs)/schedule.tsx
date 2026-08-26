import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { getAiringSchedule } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import type { AiringScheduleItem } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";

export default function ScheduleScreen() {
  const window = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { startAt: Math.floor(start.getTime() / 1000), endAt: Math.floor(end.getTime() / 1000) };
  }, []);
  const schedule = useQuery({ queryKey: ["schedule", window.startAt, window.endAt], queryFn: () => getAiringSchedule(1, 100, window) });
  const groups = useMemo(() => {
    const result = new Map<string, AiringScheduleItem[]>();
    schedule.data?.airingSchedules.forEach((item) => { const key = new Date(item.airingAt * 1000).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }); const current = result.get(key) ?? []; result.set(key, [...current, item]); });
    return [...result.entries()];
  }, [schedule.data]);
  return <NativeScreen><NativeHeader eyebrow="NEXT 7 DAYS" title="Episode schedule" action={<SearchAction />} /><View style={styles.legend}><View style={styles.legendLine} /><Text style={styles.legendCopy}>Today appears first, followed by the next six local dates.</Text></View>{schedule.isPending ? <LoadingState label="Checking the next seven days" /> : schedule.isError || !schedule.data ? <ErrorState message={schedule.error?.message ?? "We could not load the next seven days."} onRetry={() => void schedule.refetch()} /> : <View style={styles.groups}>{groups.map(([day, entries]) => <View key={day} style={styles.group}><View style={styles.dayHead}><Text style={styles.dayText}>{day}</Text><View style={styles.dayRule} /></View>{entries.map((item) => { const date = new Date(item.airingAt * 1000); const anime = item.media; return <Pressable accessibilityRole="button" key={`${anime.id}:${item.episode}:${item.airingAt}`} onPress={() => router.push((`/anime/${anime.id}`) as never)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}><Text style={styles.time}>{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text><Image source={{ uri: anime.coverImage?.large || anime.coverImage?.extraLarge || "" }} style={styles.poster} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.itemContent}><Text style={styles.title} numberOfLines={2}>{animeTitle(anime)}</Text><Text style={styles.meta}>EPISODE {item.episode} · {anime.format || "ANIME"}</Text></View></Pressable>; })}</View>)}</View>}</NativeScreen>;
}

const styles = StyleSheet.create({
  legend: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 8 }, legendLine: { width: 18, height: 2, backgroundColor: nothing.red }, legendCopy: { color: nothing.muted, fontSize: 12 }, groups: { gap: 27 }, group: { gap: 3 }, dayHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }, dayText: { color: nothing.white, fontSize: 20, fontWeight: "900", letterSpacing: -0.45 }, dayRule: { flex: 1, height: 1, backgroundColor: nothing.line }, item: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#202020" }, poster: { width: 39, height: 57, backgroundColor: nothing.raised }, itemContent: { flex: 1, justifyContent: "center", gap: 4 }, time: { width: 48, color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900" }, title: { color: nothing.white, fontSize: 14, fontWeight: "900", lineHeight: 18 }, meta: { color: nothing.red, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 }, pressed: { opacity: 0.68 },
});
