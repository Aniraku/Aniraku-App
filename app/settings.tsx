import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { deleteCurrentAccount } from "@/lib/account";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

export default function SettingsScreen() {
  const auth = useAnirakuAuth();
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const close = () => router.back();
  if (!auth.user) { router.replace("/auth" as never); return null; }
  const clearHistory = () => Alert.alert("Clear watch history?", "This removes every synchronized history entry from your Aniraku account.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => void history.clear.mutateAsync().catch((error) => Alert.alert("Could not clear history", error.message)) }]);
  const clearBookmarks = () => Alert.alert("Clear bookmarks?", "This removes every synchronized bookmark from your Aniraku account.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => void bookmarks.clear.mutateAsync().catch((error) => Alert.alert("Could not clear bookmarks", error.message)) }]);
  const deleteAccount = () => Alert.alert("Delete Aniraku account?", "This permanently removes your profile, watch history, ratings, bookmarks, comments, notifications, preferences, and account. This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete account", style: "destructive", onPress: () => void deleteCurrentAccount().then(() => router.replace("/(tabs)" as never)).catch((error) => Alert.alert("Account not deleted", error.message)) }]);
  return <NativeScreen><View style={styles.top}><Pressable onPress={close}><Text style={styles.close}>CLOSE</Text></Pressable><DotLabel>Account control</DotLabel><Text style={styles.title}>Settings</Text></View><NothingCard style={styles.card}><Signal label="VERIFIED SESSION" tone="live" /><Text style={styles.email}>{auth.user.email}</Text><NothingButton label="Sign out" variant="outline" onPress={() => void auth.signOut().then(close)} /></NothingCard><NothingCard style={styles.card}><DotLabel>Synced library</DotLabel><Text style={styles.copy}>Manage the data that follows your verified Aniraku account across devices.</Text><NothingButton label="Clear watch history" variant="outline" onPress={clearHistory} /><NothingButton label="Clear bookmarks" variant="outline" onPress={clearBookmarks} /></NothingCard><NothingCard style={styles.card}><DotLabel>Legal</DotLabel><Text style={styles.copy}>Read privacy, terms, copyright, and security information.</Text><NothingButton label="Open legal information" variant="outline" onPress={() => router.push("/legal" as never)} /></NothingCard><NothingCard style={styles.danger}><DotLabel tone="signal">Irreversible</DotLabel><Text style={styles.copy}>Account deletion is completed through a protected server function which clears user data before removing the authentication record.</Text><NothingButton label="Delete account" variant="danger" onPress={deleteAccount} /></NothingCard></NativeScreen>;
}

const styles = StyleSheet.create({ top: { minHeight: 114, justifyContent: "center", gap: 7 }, close: { color: nothing.muted, fontFamily: "monospace", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { color: nothing.white, fontSize: 31, fontWeight: "900", letterSpacing: -0.8 }, card: { padding: 17, gap: 12 }, danger: { padding: 17, gap: 12, borderColor: "rgba(255,77,77,0.5)" }, email: { color: nothing.white, fontWeight: "800", fontSize: 15 }, copy: { color: nothing.muted, fontSize: 14, lineHeight: 20 }, });
