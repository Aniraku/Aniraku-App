import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { NativeHeader, NativeScreen } from "@/components/screen";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";

export default function ProfileScreen() {
  const auth = useAnirakuAuth();
  if (auth.loading) return <NativeScreen><NativeHeader eyebrow="Your account" title="Profile" /><View style={styles.loading}><Text style={styles.loadingText}>RESTORING SESSION</Text></View></NativeScreen>;
  if (!auth.user) return <NativeScreen><NativeHeader eyebrow="Your account" title="Profile" /><NothingCard style={styles.card}><DotLabel>Cloud features</DotLabel><Text style={styles.title}>Sync your anime life.</Text><Text style={styles.copy}>Sign in to keep your history, episode ratings, bookmarks, comments, notifications, and playback preferences consistent across Aniraku.</Text><NothingButton label="Sign in or create account" onPress={() => router.push("/auth" as never)} /></NothingCard><NothingCard style={styles.card}><Signal label="GUEST MODE" /><Text style={styles.copy}>Discovery remains available without an account. Protected features appear only when a verified session exists.</Text></NothingCard></NativeScreen>;
  return <NativeScreen><NativeHeader eyebrow="Your account" title="Profile" /><NothingCard style={styles.card}><Signal label="VERIFIED SESSION" tone="live" /><Text style={styles.title}>{auth.user.user_metadata?.username || auth.user.email}</Text><Text style={styles.copy}>{auth.user.email}</Text><NothingButton label="Open library" onPress={() => router.push("/library" as never)} /><NothingButton label="Settings" variant="outline" onPress={() => router.push("/settings" as never)} /></NothingCard><NothingCard style={styles.card}><DotLabel>Library sync</DotLabel><Text style={styles.copy}>History, ratings, bookmarks, comments, and notifications use the existing Aniraku Supabase project with native encrypted session storage.</Text></NothingCard></NativeScreen>;
}

const styles = StyleSheet.create({ card: { padding: 18, gap: 12 }, title: { color: nothing.white, fontSize: 23, fontWeight: "900", letterSpacing: -0.4 }, copy: { color: nothing.muted, fontSize: 14, lineHeight: 20 }, loading: { flex: 1, alignItems: "center", justifyContent: "center" }, loadingText: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", letterSpacing: 1.3, fontSize: 11 }, });
