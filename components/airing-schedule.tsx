import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { nothing } from "@/components/nothing-ui";

type AiringScheduleProps = {
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  totalEpisodes?: number | null;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "NOW";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function AiringSchedule({ nextAiringEpisode, totalEpisodes }: AiringScheduleProps) {
  const countdown = useMemo(() => {
    if (!nextAiringEpisode?.airingAt) return null;
    const ms = nextAiringEpisode.airingAt * 1000 - Date.now();
    return formatCountdown(ms);
  }, [nextAiringEpisode?.airingAt]);

  if (!nextAiringEpisode) return null;

  const ep = nextAiringEpisode.episode;
  const aired = totalEpisodes ? ep > totalEpisodes : false;

  return (
    <View style={styles.container}>
      <View style={styles.rule} />
      <Text style={styles.line}>EP {String(ep).padStart(2, "0")}{aired ? " · FINALE" : ""} · {countdown ? `IN ${countdown}` : "AIRING NOW"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  rule: { width: 18, height: 2, backgroundColor: nothing.red },
  line: { flex: 1, color: nothing.muted, fontFamily: nothing.mono, fontWeight: "800", fontSize: 10, letterSpacing: 0.5 },
});
