import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { DotLabel, NothingButton, nothing } from "@/components/nothing-ui";

export function LoadingState({ label = "Loading real anime data" }: { label?: string }) {
  return <View style={styles.container}><View style={styles.loadingLine}><View style={styles.loadingFill} /><ActivityIndicator color={nothing.red} size="small" /></View><DotLabel tone="signal">LOADING</DotLabel><Text style={styles.text}>{label}</Text></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const friendlyMessage = /api\.aniraku|backend|graphql|network request|failed to fetch|could not reach/i.test(message) ? "Check your connection and try again." : message;
  return <View style={styles.container}><View style={styles.errorLine} /><DotLabel tone="signal">COULDN’T LOAD THIS</DotLabel><Text style={styles.text}>{friendlyMessage}</Text><NothingButton label="TRY AGAIN" onPress={onRetry} variant="outline" /></View>;
}

export function EmptyState({ label }: { label: string }) {
  return <View style={styles.container}><View style={styles.emptyLine} /><DotLabel>NOTHING HERE YET</DotLabel><Text style={styles.text}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 198, paddingVertical: 24, gap: 10, alignItems: "flex-start", justifyContent: "center" },
  loadingLine: { width: "100%", height: 2, backgroundColor: nothing.line, position: "relative", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  loadingFill: { width: "34%", height: "100%", backgroundColor: nothing.red },
  errorLine: { width: 24, height: 2, backgroundColor: nothing.red },
  emptyLine: { width: 24, height: 1, backgroundColor: nothing.line },
  text: { color: nothing.muted, maxWidth: 290, fontSize: 13, lineHeight: 19 },
});
