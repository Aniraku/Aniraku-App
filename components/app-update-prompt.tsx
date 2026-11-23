import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { checkForAnirakuUpdate, updateDismissalKey, type AppRelease } from "@/lib/app-update";
import { downloadAndInstallAnirakuUpdate } from "@/lib/android-app-installer";

const installedVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || "0.0.0";

/**
 * Minimal, non-blocking update bar. It never opens a modal: a slim row offers
 * the install action, and Settings keeps the full check/install controls.
 * Dismissal is persisted per release version, so a version the user skipped
 * stays skipped.
 */
export function AppUpdatePrompt() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const enter = useRef(new Animated.Value(0)).current;

  const check = useCallback(async () => {
    try {
      const result = await checkForAnirakuUpdate(installedVersion);
      if (!result.available || !result.release) return;
      const dismissed = await AsyncStorage.getItem(updateDismissalKey(result.release.version)).catch(() => null);
      if (!dismissed) setRelease(result.release);
    } catch {}
  }, []);

  useEffect(() => {
    // The release check waits for first interactions to settle — startup
    // shouldn't spend its network/JS budget on a GitHub round trip.
    const interaction = InteractionManager.runAfterInteractions(() => { void check(); });
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void check(); });
    return () => { interaction.cancel(); sub.remove(); };
  }, [check]);

  useEffect(() => {
    if (!release) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [release, enter]);

  const dismiss = async () => {
    if (release) await AsyncStorage.setItem(updateDismissalKey(release.version), "1").catch(() => {});
    setRelease(null);
    setStatus(null);
  };

  const install = async () => {
    if (!release) return;
    setInstalling(true);
    setStatus("Downloading the verified APK…");
    try {
      await downloadAndInstallAnirakuUpdate(release);
      setStatus("Opening the Android installer…");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Update failed");
    } finally {
      setInstalling(false);
    }
  };

  if (!release) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      <View style={styles.badge}><Text style={styles.badgeText}>UPDATE</Text></View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>v{release.version} is ready</Text>
        <Text style={styles.meta} numberOfLines={1}>{status ?? "Install over the current build."}</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={installing} onPress={() => void install()} style={[styles.install, installing && { opacity: 0.6 }]}>
        {installing ? <ActivityIndicator size="small" color={nothing.black} /> : <Text style={styles.installText}>INSTALL</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss update" onPress={() => void dismiss()} hitSlop={10} style={styles.close}>
        <AppIcon name="close" size={14} color={nothing.muted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: nothing.line,
    backgroundColor: "#171715",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: nothing.red,
  },
  badgeText: {
    color: nothing.black,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  copy: { flex: 1, gap: 1 },
  title: { color: nothing.white, fontSize: 13, fontWeight: "800" },
  meta: { color: nothing.muted, fontSize: 11, lineHeight: 15 },
  install: {
    minHeight: 32,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: nothing.white,
    borderRadius: 6,
  },
  installText: { color: nothing.black, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  close: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
