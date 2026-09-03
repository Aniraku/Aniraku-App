import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SubtitleCue } from "@/lib/subtitle-parser";
import {
  type SubtitlePreferences,
  fontFamilyToNative,
} from "@/lib/subtitle-preferences";

type Props = {
  cues: SubtitleCue[];
  preferences: SubtitlePreferences;
};

export function SubtitleRenderer({ cues, preferences }: Props) {
  const activeCues = useMemo(() => cues.slice(0, 3), [cues]);

  if (!preferences.enabled || activeCues.length === 0) return null;

  const fontFamily = fontFamilyToNative(preferences.fontFamily);

  return (
    <View style={styles.container} pointerEvents="none">
      {activeCues.map((cue) => (
        <View
          key={cue.id}
          style={[
            styles.cueWrapper,
            preferences.shadowEnabled && {
              shadowColor: preferences.strokeColor,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.8,
              shadowRadius: 2,
              elevation: 3,
            },
            preferences.backgroundOpacity > 0 && {
              backgroundColor: `rgba(0,0,0,${preferences.backgroundOpacity})`,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 4,
            },
          ]}
        >
          <Text
            style={[
              styles.cueText,
              {
                color: preferences.fontColor,
                fontSize: preferences.fontSize,
                fontFamily,
                opacity: preferences.opacity,
                ...(preferences.strokeWidth > 0
                  ? {
                      textShadowColor: preferences.strokeColor,
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: preferences.strokeWidth,
                    }
                  : {}),
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
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 28,
  },
});
