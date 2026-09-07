import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SubtitleCue } from "@/lib/subtitle-parser";
import type { SubtitlePreferences } from "@/lib/subtitle-preferences";

type Props = {
  cues: SubtitleCue[];
  preferences: SubtitlePreferences;
};

export function SubtitleRenderer({ cues, preferences }: Props) {
  const activeCues = useMemo(() => cues.slice(0, 3), [cues]);

  if (!preferences.enabled || activeCues.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {activeCues.map((cue) => (
        <View key={cue.id} style={styles.cueWrapper}>
          <Text style={styles.cueText}>{cue.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 60,
    left: 16,
    right: 16,
    alignItems: "center",
    gap: 4,
  },
  cueWrapper: {
    maxWidth: "95%",
  },
  cueText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 24,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
