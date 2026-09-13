import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SubtitleCue } from "@/lib/subtitle-parser";
import type { SubtitlePreferences } from "@/lib/subtitle-preferences";

type Props = {
  cues: SubtitleCue[];
  preferences: SubtitlePreferences;
};

export function SubtitleRenderer({ cues, preferences }: Props) {
  const activeCues = useMemo(() => cues.slice(0, 2), [cues]);

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
    // Sits just above the timeline/mini-progress. The parent wrapper already
    // reserves bottom space, so keep this offset small to avoid pushing cues
    // behind the top bar on short inline players.
    bottom: 8,
    left: 16,
    right: 16,
    alignItems: "center",
    gap: 4,
  },
  cueWrapper: {
    maxWidth: "95%",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cueText: {
    color: "#FFFFFF",
    fontSize: 15,
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
