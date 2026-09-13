import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SubtitleCue } from "@/lib/subtitle-parser";
import type { SubtitlePreferences } from "@/lib/subtitle-preferences";
import { SUBTITLE_FONTS } from "@/lib/subtitle-preferences";

type Props = {
  cues: SubtitleCue[];
  preferences: SubtitlePreferences;
};

function resolveFont(pref: SubtitlePreferences["fontFamily"]): string | undefined {
  const match = SUBTITLE_FONTS.find((f) => f.id === pref);
  if (!match || match.id === "default") return undefined;
  return match.family;
}

export function SubtitleRenderer({ cues, preferences }: Props) {
  const activeCues = useMemo(() => cues.slice(0, 2), [cues]);

  if (!preferences.enabled || activeCues.length === 0) return null;

  const fontFamily = resolveFont(preferences.fontFamily);
  const bgAlpha = preferences.bgOpacity;
  const outline = preferences.outlineThickness;

  return (
    <View style={styles.container} pointerEvents="none">
      {activeCues.map((cue) => (
        <View
          key={cue.id}
          style={[
            styles.cueWrapper,
            {
              backgroundColor: `rgba(0,0,0,${bgAlpha})`,
              paddingHorizontal: outline > 0 ? 10 : 6,
            },
          ]}
        >
          <Text
            style={[
              styles.cueText,
              {
                fontSize: preferences.fontSize,
                fontFamily,
                textShadowRadius: outline,
              },
            ]}
          >
            {cue.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 8,
    left: 16,
    right: 16,
    alignItems: "center",
    gap: 4,
  },
  cueWrapper: {
    maxWidth: "95%",
    borderRadius: 3,
    paddingVertical: 2,
  },
  cueText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
  },
});
