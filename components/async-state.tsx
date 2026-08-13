import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NothingButton, nothing } from "@/components/nothing-ui";

export function LoadingState({ label = "Loading real anime data" }: { label?: string }) {
  return <View style={styles.container}><ActivityIndicator color={nothing.white} /><Text style={styles.text}>{label}</Text></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.container}><Text style={styles.error}>SERVICE STATE</Text><Text style={styles.text}>{message}</Text><NothingButton label="Retry" onPress={onRetry} variant="outline" /></View>;
}

export function EmptyState({ label }: { label: string }) {
  return <View style={styles.container}><Text style={styles.text}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 180, padding: 24, gap: 14, alignItems: "center", justifyContent: "center" },
  text: { color: nothing.muted, textAlign: "center", fontSize: 14, lineHeight: 20 },
  error: { color: nothing.red, fontFamily: "monospace", fontSize: 11, letterSpacing: 1.5, fontWeight: "800" },
});
