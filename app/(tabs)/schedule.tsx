import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { getAiringSchedule } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";

export default function ScheduleScreen() {
  const schedule = useQuery({ queryKey: ["schedule"], queryFn: () => getAiringSchedule() });
  return <NativeScreen><NativeHeader eyebrow="Time-zone aware" title="Schedule" action={<SearchAction />} /><View style={styles.info}><DotLabel>Next signals</DotLabel><Text style={styles.infoText}>Release times are calculated from live AniList airing data in your device time zone.</Text></View>{schedule.isPending ? <LoadingState label="Reading the next release window" /> : schedule.isError || !schedule.data ? <ErrorState message={schedule.error?.message ?? "Schedule unavailable."} onRetry={() => void schedule.refetch()} /> : <View style={styles.list}>{schedule.data.media.filter((anime) => anime.nextAiringEpisode).map((anime) => { const date = anime.nextAiringEpisode ? new Date(anime.nextAiringEpisode.airingAt * 1000) : null; return <Pressable key={anime.id} onPress={() => router.push((`/anime/${anime.id}`) as never)}><NothingCard style={styles.item}><View style={styles.itemTop}><Signal label={`EP ${anime.nextAiringEpisode?.episode ?? "?"}`} /><Text style={styles.time}>{date?.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</Text></View><Text style={styles.title}>{animeTitle(anime)}</Text><Text style={styles.meta}>{anime.format || "ANIME"}{anime.episodes ? ` · ${anime.episodes} episodes` : ""}</Text></NothingCard></Pressable>; })}</View>}</NativeScreen>;
}

const styles = StyleSheet.create({ info: { padding: 16, borderWidth: 1, borderColor: nothing.line, borderRadius: 16, gap: 6, backgroundColor: nothing.surface }, infoText: { color: nothing.muted, fontSize: 13, lineHeight: 19 }, list: { gap: 10 }, item: { padding: 15, gap: 8 }, itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, time: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "700" }, title: { color: nothing.white, fontSize: 16, fontWeight: "800" }, meta: { color: nothing.dim, fontFamily: "monospace", fontSize: 10, letterSpacing: 0.5 }, });
