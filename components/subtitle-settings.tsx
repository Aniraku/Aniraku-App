import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, nothing } from "@/components/nothing-ui";
import {
  type SubtitleFontFamily,
  type SubtitlePreferences,
  SUBTITLE_COLOR_PRESETS,
  SUBTITLE_FONT_OPTIONS,
  fontFamilyToNative,
  loadSubtitlePreferences,
  saveSubtitlePreferences,
} from "@/lib/subtitle-preferences";

type Props = {
  visible: boolean;
  onClose: () => void;
  onChanged: (prefs: SubtitlePreferences) => void;
};

export function SubtitleSettings({ visible, onClose, onChanged }: Props) {
  const [prefs, setPrefs] = useState<SubtitlePreferences | null>(null);

  useEffect(() => {
    if (visible) loadSubtitlePreferences().then(setPrefs);
  }, [visible]);

  if (!visible || !prefs) return null;

  const update = async (patch: Partial<SubtitlePreferences>) => {
    const next = await saveSubtitlePreferences(patch);
    setPrefs(next);
    onChanged(next);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.heading}>
          <DotLabel>SUBTITLE SETTINGS</DotLabel>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close subtitle settings"
            onPress={onClose}
            style={styles.closeBtn}
          >
            <AppIcon name="close" size={18} color={nothing.muted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.row}>
            <Text style={styles.label}>ENABLED</Text>
            <Switch
              value={prefs.enabled}
              onValueChange={(v) => update({ enabled: v })}
              trackColor={{ false: nothing.line, true: nothing.red }}
              thumbColor={nothing.white}
            />
          </View>

          <View style={styles.section}>
            <DotLabel>FONT</DotLabel>
            <View style={styles.chipRow}>
              {SUBTITLE_FONT_OPTIONS.map((opt) => {
                const active = prefs.fontFamily === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => update({ fontFamily: opt.value })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                        { fontFamily: opt.nativeFamily },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <DotLabel>SIZE</DotLabel>
            <View style={styles.chipRow}>
              {[16, 18, 20, 22, 24, 28, 32].map((size) => {
                const active = prefs.fontSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => update({ fontSize: size })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {size}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <DotLabel>COLOR</DotLabel>
            <View style={styles.chipRow}>
              {SUBTITLE_COLOR_PRESETS.map((preset) => {
                const active = prefs.fontColor === preset.value;
                return (
                  <Pressable
                    key={preset.value}
                    onPress={() => update({ fontColor: preset.value })}
                    style={[
                      styles.colorChip,
                      { backgroundColor: preset.value },
                      active && styles.colorChipActive,
                    ]}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <DotLabel>OUTLINE</DotLabel>
            <View style={styles.chipRow}>
              {[
                { label: "OFF", value: 0 },
                { label: "THIN", value: 1 },
                { label: "MED", value: 1.5 },
                { label: "THICK", value: 2.5 },
              ].map((opt) => {
                const active = prefs.strokeWidth === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => update({ strokeWidth: opt.value })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <DotLabel>BACKGROUND</DotLabel>
            <View style={styles.chipRow}>
              {[
                { label: "OFF", value: 0 },
                { label: "LIGHT", value: 0.25 },
                { label: "MED", value: 0.5 },
                { label: "DARK", value: 0.75 },
              ].map((opt) => {
                const active = prefs.backgroundOpacity === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => update({ backgroundOpacity: opt.value })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <DotLabel>OPACITY</DotLabel>
            <View style={styles.chipRow}>
              {[
                { label: "70%", value: 0.7 },
                { label: "80%", value: 0.8 },
                { label: "90%", value: 0.9 },
                { label: "100%", value: 1 },
              ].map((opt) => {
                const active = prefs.opacity === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => update({ opacity: opt.value })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.previewSection}>
            <DotLabel>PREVIEW</DotLabel>
            <View style={styles.previewBox}>
              <Text
                style={[
                  styles.previewText,
                  {
                    color: prefs.fontColor,
                    fontSize: prefs.fontSize,
                    fontFamily: fontFamilyToNative(prefs.fontFamily),
                    opacity: prefs.opacity,
                    ...(prefs.strokeWidth > 0
                      ? {
                          textShadowColor: prefs.strokeColor,
                          textShadowOffset: { width: 0, height: 0 },
                          textShadowRadius: prefs.strokeWidth,
                        }
                      : {}),
                  },
                ]}
              >
                This is how your subtitles will look
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panel: {
    width: "88%",
    maxWidth: 380,
    maxHeight: "80%",
    backgroundColor: "rgba(9,9,9,0.97)",
    borderWidth: 1,
    borderColor: nothing.line,
    borderRadius: 8,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: nothing.line,
  },
  closeBtn: { padding: 6 },
  content: { padding: 14, gap: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: nothing.white,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  section: { gap: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    minWidth: 44,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: nothing.line,
    borderRadius: 4,
  },
  chipActive: {
    borderColor: nothing.red,
    backgroundColor: "rgba(255,77,77,0.1)",
  },
  chipText: {
    color: nothing.muted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "900",
  },
  chipTextActive: { color: nothing.red },
  colorChip: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: nothing.line,
  },
  colorChipActive: {
    borderColor: nothing.red,
    borderWidth: 2,
  },
  previewSection: { gap: 8 },
  previewBox: {
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
    borderRadius: 6,
    alignItems: "center",
  },
  previewText: {
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 28,
  },
});
