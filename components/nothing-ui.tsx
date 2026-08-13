import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

export const nothing = {
  black: "#090909",
  surface: "#141414",
  raised: "#1C1C1C",
  line: "#343434",
  white: "#F6F6F2",
  muted: "#A2A2A0",
  dim: "#666664",
  red: "#FF4D4D",
  green: "#96D37B",
} as const;

export function DotLabel({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "signal" | "live" }) {
  const color = tone === "signal" ? nothing.red : tone === "live" ? nothing.green : nothing.muted;
  return <Text style={[styles.dotLabel, { color }]}>{children}</Text>;
}

export function NothingCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function NothingButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: "primary" | "outline" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={(event) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(event);
      }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.primaryButton,
        variant === "outline" && styles.outlineButton,
        variant === "danger" && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && styles.pressedButton,
      ]}
    >
      <Text style={[styles.buttonText, variant === "primary" ? styles.primaryButtonText : styles.outlineButtonText]}>{label}</Text>
    </Pressable>
  );
}

export function Signal({ label, tone = "live" }: { label: string; tone?: "live" | "signal" | "muted" }) {
  const color = tone === "signal" ? nothing.red : tone === "live" ? nothing.green : nothing.muted;
  return <View style={styles.signalRow}><View style={[styles.signalDot, { backgroundColor: color }]} /><Text style={[styles.signalText, { color }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  dotLabel: { fontFamily: "monospace", fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  card: { backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, borderRadius: 18, overflow: "hidden" },
  button: { alignItems: "center", justifyContent: "center", minHeight: 50, borderRadius: 14, paddingHorizontal: 18, borderWidth: 1 },
  primaryButton: { backgroundColor: nothing.white, borderColor: nothing.white },
  outlineButton: { backgroundColor: "transparent", borderColor: nothing.line },
  dangerButton: { backgroundColor: "rgba(255,77,77,0.12)", borderColor: "rgba(255,77,77,0.55)" },
  disabledButton: { opacity: 0.45 },
  pressedButton: { opacity: 0.8, transform: [{ scale: 0.975 }] },
  buttonText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
  primaryButtonText: { color: nothing.black },
  outlineButtonText: { color: nothing.white },
  signalRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  signalDot: { width: 7, height: 7, borderRadius: 4 },
  signalText: { fontFamily: "monospace", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
});
