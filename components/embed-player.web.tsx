import { StyleSheet, Text, View } from "react-native";
import { nothing } from "@/components/nothing-ui";

export function EmbedPlayer({ onError: _onError }: { uri: string; headers?: Record<string, string>; onError: () => void }) {
  return <View style={styles.fallback}><Text style={styles.title}>THIS SOURCE OPENS IN THE APP</Text><Text style={styles.copy}>Embedded providers use the native player for secure playback.</Text></View>;
}

const styles = StyleSheet.create({ fallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 28, backgroundColor: "#000000" }, title: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textAlign: "center" }, copy: { color: nothing.muted, fontSize: 12, lineHeight: 17, textAlign: "center" } });
