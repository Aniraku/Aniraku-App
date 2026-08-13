import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { DotLabel, NothingCard, nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

const pages = [
  { label: "Privacy notice", detail: "Data categories, device storage, synchronization, and account deletion.", url: "https://aniraku.tech/privacy" },
  { label: "Terms of use", detail: "Account, community, provider-availability, and acceptable-use conditions.", url: "https://aniraku.tech/terms" },
  { label: "Copyright and DMCA", detail: "Copyright notice and counter-notice procedure.", url: "https://aniraku.tech/dmca" },
];

export default function LegalScreen() {
  return <NativeScreen><View style={styles.top}><Pressable onPress={() => router.back()}><Text style={styles.close}>CLOSE</Text></Pressable><DotLabel>Transparent service</DotLabel><Text style={styles.title}>Legal</Text></View>{pages.map((page) => <Pressable key={page.label} onPress={() => void Linking.openURL(page.url)}><NothingCard style={styles.card}><Text style={styles.cardTitle}>{page.label}</Text><Text style={styles.copy}>{page.detail}</Text><Text style={styles.open}>OPEN WEB PAGE</Text></NothingCard></Pressable>)}<NothingCard style={styles.card}><DotLabel>Contacts</DotLabel><Text style={styles.copy}>Privacy: privacy@aniraku.tech{"\n"}Copyright: dmca@aniraku.tech{"\n"}Security: security@aniraku.tech</Text></NothingCard></NativeScreen>;
}

const styles = StyleSheet.create({ top: { minHeight: 118, justifyContent: "center", gap: 7 }, close: { color: nothing.muted, fontFamily: "monospace", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { color: nothing.white, fontSize: 31, fontWeight: "900", letterSpacing: -0.8 }, card: { padding: 17, gap: 9 }, cardTitle: { color: nothing.white, fontWeight: "900", fontSize: 17 }, copy: { color: nothing.muted, fontSize: 14, lineHeight: 20 }, open: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }, });
