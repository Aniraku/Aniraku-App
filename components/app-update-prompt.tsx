import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { nothing } from "@/components/nothing-ui";
import { checkForAnirakuUpdate, updateDismissalKey, type AppRelease } from "@/lib/app-update";
import { downloadAndInstallAnirakuUpdate } from "@/lib/android-app-installer";

const installedVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || "0.0.0";

export function AppUpdatePrompt() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const result = await checkForAnirakuUpdate(installedVersion);
      if (!result.available || !result.release) return;
      const dismissed = await AsyncStorage.getItem(updateDismissalKey(result.release.version)).catch(() => null);
      if (!dismissed) setRelease(result.release);
    } catch {}
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void check(); });
    return () => sub.remove();
  }, [check]);

  const dismiss = async () => {
    if (release) await AsyncStorage.setItem(updateDismissalKey(release.version), "1").catch(() => {});
    setRelease(null);
    setStatus(null);
  };

  const install = async () => {
    if (!release) return;
    setInstalling(true);
    setStatus("Downloading...");
    try {
      await downloadAndInstallAnirakuUpdate(release);
      setStatus("Opening installer...");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Update failed");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Modal transparent visible={Boolean(release)} animationType="fade" onRequestClose={() => void dismiss()}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.header}>
            <View style={styles.badge}><Text style={styles.badgeText}>UPDATE</Text></View>
            <Pressable onPress={() => void dismiss()} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable>
          </View>
          <Text style={styles.title}>{release ? `v${release.version}` : ""}</Text>
          <Text style={styles.subtitle}>A new version of Aniraku is ready.</Text>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          <View style={styles.actions}>
            <Pressable disabled={installing} onPress={() => void install()} style={[styles.install, installing && { opacity: 0.5 }]}>
              {installing ? <ActivityIndicator size="small" color={nothing.black} /> : <Text style={styles.installText}>INSTALL</Text>}
            </Pressable>
            <Pressable onPress={() => void dismiss()} style={styles.later}>
              <Text style={styles.laterText}>LATER</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)", padding: 16 },
  sheet: { backgroundColor: nothing.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 12, borderWidth: 1, borderColor: nothing.line },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { backgroundColor: nothing.red, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: nothing.black, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  close: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  closeText: { color: nothing.muted, fontSize: 16 },
  title: { color: nothing.white, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: nothing.muted, fontFamily: "SpaceGrotesk-Regular", fontSize: 13, lineHeight: 18 },
  status: { color: nothing.dim, fontFamily: "monospace", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  install: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: nothing.white, borderRadius: 8 },
  installText: { color: nothing.black, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  later: { minWidth: 80, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 8 },
  laterText: { color: nothing.muted, fontFamily: "SpaceGrotesk-Medium", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
});
