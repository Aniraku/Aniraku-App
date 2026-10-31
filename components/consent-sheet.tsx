import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import * as Haptics from "expo-haptics";
import { AppIcon } from "@/components/app-icon";
import { AnirakuMark, nothing } from "@/components/nothing-ui";
import { acceptCurrentConsent, consentOutdated } from "@/lib/consent";

/**
 * One-shot legal gate: shows whenever the stored consent version is behind
 * the current one (first launch included). Cannot be dismissed without
 * accepting — the links open the full legal screen in place.
 */
export function ConsentGate({ children }: { children?: ReactNode }) {
  const [required, setRequired] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);
  // The legal screen is a navigation-screen under this native Modal — the
  // gate must yield while it is open or the pushed screen renders behind
  // the dimmed backdrop.
  const pathname = usePathname();
  const viewingLegal = pathname === "/legal";
  const effectiveRequired = required && !viewingLegal;

  useEffect(() => {
    let active = true;
    void consentOutdated().then((outdated) => {
      if (active) setRequired(outdated);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!effectiveRequired) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [effectiveRequired, enter]);

  const accept = () => {
    setBusy(true);
    void Haptics.selectionAsync().catch(() => {});
    void acceptCurrentConsent().finally(() => {
      setBusy(false);
      setRequired(false);
    });
  };

  return (
    <>
      {children}
      <Modal transparent visible={effectiveRequired} animationType="fade" onRequestClose={() => { /* must choose */ }}>
        <View style={styles.backdrop}>
          <Animated.View style={[styles.card, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] }]} accessibilityViewIsModal>
            <View style={styles.mark}><AnirakuMark size={40} inverted /></View>
            <Text style={styles.kicker}>LEGAL</Text>
            <Text style={styles.title}>Before you continue</Text>
            <Text style={styles.body}>Aniraku is a playback-coordination interface. It hosts no video, and availability depends on third parties. Continuing means you accept the current Terms and Privacy policy.</Text>
            <View style={styles.links}>
              <Pressable accessibilityRole="link" onPress={() => void router.push("/legal")} style={styles.linkRow}>
                <AppIcon name="open-in-new" size={15} color={nothing.white} />
                <Text style={styles.link}>READ TERMS & PRIVACY</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Accept Terms and Privacy policy" onPress={accept} disabled={busy} style={({ pressed }) => [styles.accept, pressed && styles.pressed]}>
              <Text style={styles.acceptLabel}>{busy ? "SAVING…" : "I ACCEPT"}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 28, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.86)" },
  card: { borderRadius: 12, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface, padding: 18, gap: 8 },
  mark: { marginBottom: 4 },
  kicker: { color: nothing.red, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: nothing.white, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  body: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  links: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: nothing.line, marginVertical: 6 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 12, minHeight: 44 },
  link: { color: nothing.white, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  accept: { marginTop: 6, minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: nothing.red, paddingVertical: 12 },
  pressed: { opacity: 0.85 },
  acceptLabel: { color: nothing.black, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
});
