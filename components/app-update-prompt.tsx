import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AnirakuMark, DotLabel, nothing, Signal } from "@/components/nothing-ui";
import { checkForAnirakuUpdate, updateDismissalKey, type AppRelease } from "@/lib/app-update";

const installedVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || "0.0.0";

export function AppUpdatePrompt() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [opening, setOpening] = useState(false);

  const check = useCallback(async () => {
    try {
      const result = await checkForAnirakuUpdate(installedVersion);
      if (!result.available || !result.release) return;
      const dismissed = await AsyncStorage.getItem(updateDismissalKey(result.release.version)).catch(() => null);
      if (!dismissed) setRelease(result.release);
    } catch {
      // A direct-distribution update check must never delay app startup or show
      // an offline error. Settings retains a deliberate manual check action.
    }
  }, []);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void check(); });
    return () => subscription.remove();
  }, [check]);

  const dismiss = async () => {
    if (release) await AsyncStorage.setItem(updateDismissalKey(release.version), "1").catch(() => {});
    setRelease(null);
  };

  const openRelease = async () => {
    if (!release) return;
    setOpening(true);
    try { await Linking.openURL(release.releaseUrl); } finally { setOpening(false); }
  };

  return <Modal transparent visible={Boolean(release)} animationType="fade" onRequestClose={() => { void dismiss(); }}>
    <View style={styles.backdrop}><View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.top}><DotLabel tone="signal">ANIRAKU / UPDATE READY</DotLabel><Signal label={`V${release?.version || ""}`} tone="live" /></View>
      <View style={styles.mark}><AnirakuMark size={38} inverted /></View>
      <Text style={styles.title}>A newer Aniraku build is ready.</Text>
      <Text style={styles.copy}>Your installed build is v{installedVersion}. The direct download page will open so you can install v{release?.version} when you are ready.</Text>
      <Pressable accessibilityRole="button" onPress={() => void openRelease()} style={styles.primary}><Text style={styles.primaryText}>{opening ? "OPENING DOWNLOAD" : "UPDATE NOW"}</Text>{opening ? <ActivityIndicator color={nothing.black} size="small" /> : null}</Pressable>
      <Pressable accessibilityRole="button" onPress={() => void dismiss()} style={styles.secondary}><Text style={styles.secondaryText}>LATER</Text></Pressable>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 20, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.76)" },
  sheet: { gap: 14, padding: 18, borderRadius: 6, borderWidth: 1, borderColor: nothing.line, borderBottomWidth: 3, borderBottomColor: nothing.red, backgroundColor: nothing.black },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, mark: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised },
  title: { color: nothing.white, fontSize: 27, fontWeight: "900", letterSpacing: -0.8, lineHeight: 31 }, copy: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  primary: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: nothing.white, borderRadius: 4 }, primaryText: { color: nothing.black, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 0.45 },
  secondary: { minHeight: 42, alignItems: "center", justifyContent: "center" }, secondaryText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.45 },
});
