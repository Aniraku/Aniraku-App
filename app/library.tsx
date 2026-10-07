import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { AppIcon } from "@/components/app-icon";
import { LibraryView } from "@/components/library-view";
import { AnirakuMark, DotLabel, NothingButton, Signal, nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

export default function LibraryScreen() {
  const auth = useAnirakuAuth();

  if (auth.loading) {
    return (
      <NativeScreen scroll={false} style={styles.fill}>
        <View style={styles.redirectState}>
          <DotLabel>LIBRARY / SECURE SYNC</DotLabel>
          <Text style={styles.redirectTitle}>Opening your library</Text>
          <Text style={styles.redirectCopy}>Checking your private watch history, saved titles, and alert state.</Text>
        </View>
      </NativeScreen>
    );
  }

  if (!auth.user) {
    return (
      <NativeScreen scroll={false} style={styles.fill}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close library preview" onPress={() => router.back()} style={styles.close}>
            <AppIcon name="arrow-left" size={21} color={nothing.white} />
          </Pressable>
          <View style={styles.titleBlock}>
            <DotLabel>ALERTS / PREVIEW</DotLabel>
            <Text style={styles.title}>Stay in the loop</Text>
          </View>
          <AnirakuMark size={36} />
        </View>
        <View style={styles.guestAlert}>
          <Signal label="ACCOUNT SIGNAL" tone="live" />
          <Text style={styles.guestAlertTitle}>Your anime alerts,<br />kept in one place.</Text>
          <Text style={styles.guestAlertCopy}>Episode, comment, and library activity alerts appear here after you sign in.</Text>
          <NothingButton label="SIGN IN TO SYNC ALERTS" onPress={() => router.push("/auth" as never)} />
        </View>
      </NativeScreen>
    );
  }

  return (
    <NativeScreen scroll={false} style={styles.fill}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close library" onPress={() => router.back()} style={styles.close}>
          <AppIcon name="arrow-left" size={21} color={nothing.white} />
        </Pressable>
        <View style={styles.titleBlock}>
          <DotLabel>LIBRARY / VERIFIED SYNC</DotLabel>
          <Text style={styles.title}>Your collection</Text>
        </View>
        <AnirakuMark size={36} />
      </View>
      <LibraryView variant="route" />
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  redirectState: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 9 },
  redirectTitle: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 },
  redirectCopy: { color: nothing.muted, fontSize: 13, lineHeight: 19, maxWidth: 290 },
  top: { minHeight: 82, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  close: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1, gap: 2 },
  title: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.65 },
  guestAlert: { flex: 1, paddingHorizontal: 24, paddingBottom: 28, justifyContent: "center", gap: 14 },
  guestAlertTitle: { color: nothing.white, fontSize: 31, fontWeight: "900", letterSpacing: -0.9, lineHeight: 36 },
  guestAlertCopy: { color: nothing.muted, fontSize: 13, lineHeight: 20, maxWidth: 330 },
});
