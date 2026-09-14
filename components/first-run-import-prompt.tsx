import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFirstRunImport } from "@/hooks/use-first-run-import";
import { PROVIDER_LABELS } from "@/components/provider-mark";
import { nothing } from "@/components/nothing-ui";

export function FirstRunImportPrompt() {
  const firstRun = useFirstRunImport();
  if (!firstRun.shouldPrompt || !firstRun.provider) return null;
  const label = PROVIDER_LABELS[firstRun.provider];
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>Bring your {label} list here</Text>
        <Text style={styles.detail}>One import seeds your library. Skip keeps this device as-is.</Text>
        {firstRun.importError ? (
          <Text style={styles.error}>
            {firstRun.importError instanceof Error
              ? firstRun.importError.message.toUpperCase()
              : "IMPORT COULD NOT COMPLETE."}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={firstRun.importing}
          onPress={() => void firstRun.runImport().catch(() => {})}
          style={[styles.primary, firstRun.importing && styles.disabled]}
        >
          <Text style={styles.primaryText}>{firstRun.importing ? "IMPORTING" : "IMPORT"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={firstRun.dismiss} style={styles.skip}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: nothing.line,
    borderRadius: 8,
    backgroundColor: nothing.surface,
  },
  copy: { gap: 4 },
  title: { color: nothing.white, fontSize: 14, fontWeight: "900" },
  detail: { color: nothing.muted, fontSize: 12, lineHeight: 17 },
  error: { color: nothing.red, fontSize: 10, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8 },
  primary: {
    minHeight: 34,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: nothing.white,
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: nothing.black, fontSize: 10, fontWeight: "900" },
  skip: {
    minHeight: 34,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: nothing.line,
  },
  skipText: { color: nothing.white, fontSize: 10, fontWeight: "800" },
});
