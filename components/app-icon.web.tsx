import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

const glyphs: Record<string, string> = {
  "home-variant-outline": "⌂",
  "view-grid-outline": "▦",
  "calendar-blank-outline": "▣",
  "shuffle-variant": "↔",
  "account-circle-outline": "◎",
  "circle-outline": "○",
  magnify: "⌕",
  "arrow-left": "←",
  "rewind-10": "↶",
  pause: "Ⅱ",
  play: "▶",
  "fast-forward-10": "↷",
  "skip-next": "⏭",
};

export function AppIcon({ name, size = 20, color, style }: { name: string; size?: number; color: string; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityElementsHidden style={[styles.icon, { color, fontSize: size, lineHeight: size + 2 }, style]}>{glyphs[name] ?? "•"}</Text>;
}

const styles = StyleSheet.create({ icon: { fontFamily: "monospace", fontWeight: "700", includeFontPadding: false, textAlign: "center" } });
