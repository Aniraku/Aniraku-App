import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
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
      <View style={styles.row}>
        <AppIcon name="clock-outline" size={14} color={nothing.green} />
        <Text style={styles.label}>AIRING</Text>
      </View>
      <Text style={styles.episode}>EP {String(ep).padStart(2, "0")}{aired ? " FINALE" : ""}</Text>
      {countdown ? <Text style={styles.countdown}>IN {countdown}</Text> : <Text style={styles.countdown}>AIRING NOW</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: "rgba(150,211,123,0.3)", backgroundColor: "rgba(150,211,123,0.06)" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: nothing.green, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.6 },
  episode: { color: nothing.white, fontSize: 14, fontWeight: "900" },
  countdown: { color: nothing.muted, fontFamily: "monospace", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});
