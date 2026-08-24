import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { DotLabel, NothingButton, nothing } from "@/components/nothing-ui";

export function LoadingState({ label = "Loading real anime data" }: { label?: string }) {
  return <View style={styles.container}><View style={styles.loadingLine}><View style={styles.loadingFill} /><ActivityIndicator color={nothing.red} size="small" /></View><DotLabel tone="signal">LOADING</DotLabel><Text style={styles.text}>{label}</Text></View>;
}

export function ErrorState({ message, onRetry, retryLabel = "TRY AGAIN", retryDisabled = false }: { message: string; onRetry: () => void; retryLabel?: string; retryDisabled?: boolean }) {
  const anilistOutage = /AniList is temporarily unavailable due to an upstream stability issue/i.test(message);
  const friendlyMessage = /api\.aniraku|backend|graphql|network request|failed to fetch/i.test(message) ? "Check your connection and try again." : message;
  return anilistOutage
    ? <View accessibilityRole="alert" style={[styles.container, styles.outageContainer]}><View style={styles.outageLine} /><DotLabel tone="signal">ANILIST TEMPORARILY UNAVAILABLE</DotLabel><Text style={styles.outageTitle}>Discovery is temporarily offline upstream.</Text><Text style={styles.text}>AniList has reported a stability issue. Your account and saved data are unaffected. Try again shortly; this notice clears automatically once AniList responds.</Text><NothingButton label="CHECK AGAIN" onPress={onRetry} variant="outline" disabled={retryDisabled} /></View>
    : <View style={styles.container}><View style={styles.errorLine} /><DotLabel tone="signal">COULDN’T LOAD THIS</DotLabel><Text style={styles.text}>{friendlyMessage}</Text><NothingButton label={retryLabel} onPress={onRetry} variant="outline" disabled={retryDisabled} /></View>;
}

export function EmptyState({ label }: { label: string }) {
  return <View style={styles.container}><View style={styles.emptyLine} /><DotLabel>NOTHING HERE YET</DotLabel><Text style={styles.text}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 198, paddingVertical: 24, gap: 10, alignItems: "flex-start", justifyContent: "center" },
  loadingLine: { width: "100%", height: 2, backgroundColor: nothing.line, position: "relative", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  loadingFill: { width: "34%", height: "100%", backgroundColor: nothing.red },
  errorLine: { width: 24, height: 2, backgroundColor: nothing.red },
  outageContainer: { borderLeftWidth: 2, borderLeftColor: nothing.red, paddingLeft: 14 },
  outageLine: { width: 44, height: 2, backgroundColor: nothing.red },
  outageTitle: { color: nothing.white, maxWidth: 300, fontSize: 17, lineHeight: 22, fontWeight: "900" },
  emptyLine: { width: 24, height: 1, backgroundColor: nothing.line },
  text: { color: nothing.muted, maxWidth: 290, fontSize: 13, lineHeight: 19 },
});
