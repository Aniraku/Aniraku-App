import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, nothing } from "@/components/nothing-ui";
import { t } from "@/lib/i18n";

/**
 * Full-screen 18+ lock used when the SFW toggle is off but the title opened
 * is adult (deep links, history, saved items) — content stays hidden until
 * the user turns NSFW on with the 18+ confirmation in Settings.
 */
export function ContentLock({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <View style={styles.fill} accessibilityLiveRegion="polite" accessibilityLabel={t("nsfw.lockTitle")}>
      <View style={styles.badge}><AppIcon name="eye-off-outline" size={26} color={nothing.red} /></View>
      <DotLabel tone="signal">NSFW</DotLabel>
      <Text style={styles.title}>{t("nsfw.lockTitle")}</Text>
      <Text style={styles.body}>{t("nsfw.lockBody")}</Text>
      <Pressable accessibilityRole="button" onPress={onOpenSettings} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonLabel}>{t("nsfw.lockSettings")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: nothing.black, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  badge: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: nothing.line, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,77,77,0.08)", marginBottom: 6 },
  title: { color: nothing.white, fontSize: 19, fontWeight: "900", letterSpacing: -0.3 },
  body: { color: nothing.muted, fontSize: 13, lineHeight: 20, textAlign: "center", maxWidth: 320 },
  button: { marginTop: 12, minHeight: 46, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: nothing.red, paddingHorizontal: 22 },
  pressed: { opacity: 0.85 },
  buttonLabel: { color: nothing.black, fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
});
