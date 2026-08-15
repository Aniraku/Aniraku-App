import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useEffect } from "react";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { deleteCurrentAccount } from "@/lib/account";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

function SettingRow({ label, detail, icon, onPress, danger = false }: { label: string; detail: string; icon: "history" | "bookmark-remove-outline" | "file-document-outline" | "delete-forever-outline"; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.settingRow, danger && styles.settingDanger, pressed && styles.pressed]}><View style={[styles.settingIcon, danger && styles.settingIconDanger]}><AppIcon name={icon} size={20} color={danger ? nothing.red : nothing.white} /></View><View style={styles.settingCopy}><Text style={[styles.settingLabel, danger && styles.dangerLabel]}>{label}</Text><Text style={styles.settingDetail}>{detail}</Text></View><AppIcon name="chevron-right" size={20} color={danger ? nothing.red : nothing.muted} /></Pressable>;
}

export default function SettingsScreen() {
  const auth = useAnirakuAuth();
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const close = () => router.back();
  useEffect(() => {
    if (!auth.loading && !auth.user) router.replace("/auth" as never);
  }, [auth.loading, auth.user]);
  if (auth.loading || !auth.user) return <NativeScreen><View style={styles.redirectState}><DotLabel>ACCOUNT REQUIRED</DotLabel><Text style={styles.redirectTitle}>Opening account controls</Text><Text style={styles.redirectCopy}>Settings are available after your verified Aniraku session has been restored.</Text></View></NativeScreen>;
  const clearHistory = () => Alert.alert("Clear watch history?", "This removes every synchronized history entry from your Aniraku account.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => void history.clear.mutateAsync().catch((error) => Alert.alert("Could not clear history", error.message)) }]);
  const clearBookmarks = () => Alert.alert("Clear bookmarks?", "This removes every synchronized bookmark from your Aniraku account.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => void bookmarks.clear.mutateAsync().catch((error) => Alert.alert("Could not clear bookmarks", error.message)) }]);
  const deleteAccount = () => Alert.alert("Delete Aniraku account?", "This permanently removes your profile, watch history, ratings, bookmarks, comments, notifications, preferences, and account. This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete account", style: "destructive", onPress: () => void deleteCurrentAccount().then(() => router.replace("/(tabs)" as never)).catch((error) => Alert.alert("Account not deleted", error.message)) }]);
  return <NativeScreen><View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={close} style={styles.close}><AppIcon name="arrow-left" size={21} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel>ACCOUNT / CONTROL ROOM</DotLabel><Text style={styles.title}>Settings</Text></View></View><NothingCard style={styles.session}><Signal label="VERIFIED SESSION" tone="live" /><Text style={styles.email}>{auth.user.email}</Text><NothingButton label="SIGN OUT" variant="outline" onPress={() => void auth.signOut().then(close)} /></NothingCard><View style={styles.group}><DotLabel>SYNCED LIBRARY</DotLabel><SettingRow label="Clear watch history" detail="Remove synced progress across your account" icon="history" onPress={clearHistory} /><SettingRow label="Clear saved titles" detail="Remove all synced bookmarks" icon="bookmark-remove-outline" onPress={clearBookmarks} /></View><View style={styles.group}><DotLabel>SUPPORT AND LEGAL</DotLabel><SettingRow label="Legal information" detail="Privacy, terms, copyright, and security" icon="file-document-outline" onPress={() => router.push("/legal" as never)} /></View><View style={styles.group}><DotLabel tone="signal">IRREVERSIBLE</DotLabel><Text style={styles.warning}>Deletion is completed through the protected account service. It clears your synchronized data before removing your authentication record.</Text><SettingRow label="Delete account" detail="Permanently erase your Aniraku account" icon="delete-forever-outline" onPress={deleteAccount} danger /></View></NativeScreen>;
}

const styles = StyleSheet.create({
  redirectState: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 9 }, redirectTitle: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 }, redirectCopy: { color: nothing.muted, fontSize: 13, lineHeight: 19, maxWidth: 290 }, top: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11 }, close: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised }, titleBlock: { gap: 2 }, title: { color: nothing.white, fontSize: 25, fontWeight: "900", letterSpacing: -0.65 }, session: { padding: 16, gap: 10 }, email: { color: nothing.white, fontWeight: "900", fontSize: 15 }, group: { gap: 8 }, settingRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderRadius: 16, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line }, settingDanger: { borderColor: "rgba(255,77,77,0.45)", backgroundColor: "rgba(255,77,77,0.055)" }, settingIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: nothing.raised }, settingIconDanger: { backgroundColor: "rgba(255,77,77,0.10)" }, settingCopy: { flex: 1, gap: 3 }, settingLabel: { color: nothing.white, fontSize: 14, fontWeight: "900" }, dangerLabel: { color: nothing.red }, settingDetail: { color: nothing.muted, fontSize: 11, lineHeight: 15 }, warning: { color: nothing.muted, fontSize: 12, lineHeight: 18 }, pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
