import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";

import { AppIcon } from "@/components/app-icon";
import { DotLabel, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { PATREON_URL, SUPPORT_FUNDING_COPY } from "@/lib/support";

const BINANCE_UID = "1098400042";
const binanceIcon = require("../assets/images/binance-icon.png");
const patreonIcon = require("../assets/images/patreon-icon.png");

export default function SupportScreen() {
  const [message, setMessage] = useState<string | null>(null);

  const openPatreon = async () => {
    setMessage(null);
    try {
      await WebBrowser.openBrowserAsync(PATREON_URL, { toolbarColor: nothing.black, controlsColor: nothing.white, showTitle: false });
    } catch {
      setMessage("PATREON COULD NOT OPEN.");
    }
  };

  const copyBinanceUID = async () => {
    try {
      await Clipboard.setStringAsync(BINANCE_UID);
      setMessage("BINANCE UID COPIED.");
    } catch {
      setMessage("COPY FAILED.");
    }
  };

  const copyPatreonLink = async () => {
    try {
      await Clipboard.setStringAsync(PATREON_URL);
      setMessage("PATREON LINK COPIED.");
    } catch {
      setMessage("COPY FAILED.");
    }
  };

  return <NativeScreen>
    <View style={styles.top}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <AppIcon name="arrow-left" size={21} color={nothing.white} />
      </Pressable>
      <View style={styles.titleBlock}>
        <DotLabel tone="signal">COMMUNITY</DotLabel>
        <Text style={styles.title}>Support</Text>
      </View>
    </View>

    {/* Hero */}
    <NothingCard style={styles.hero}>
      <Text style={styles.heroTitle}>Keep Aniraku alive.</Text>
      <Text style={styles.heroCopy}>{SUPPORT_FUNDING_COPY}</Text>
    </NothingCard>

    {/* Patreon */}
    <NothingCard style={styles.methodCard}>
      <View style={styles.methodHeader}>
        <View style={styles.methodIcon}>
          <Image source={patreonIcon} style={styles.patreonIconImage} />
        </View>
        <View style={styles.methodInfo}>
          <Text style={styles.methodTitle}>Patreon</Text>
          <Text style={styles.methodMeta}>Monthly support · Early access</Text>
        </View>
        <Signal label="RECURRING" tone="live" />
      </View>
      <View style={styles.methodActions}>
        <Pressable accessibilityRole="link" onPress={() => void openPatreon()} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
          <Text style={styles.primaryBtnText}>OPEN PATREON</Text>
          <AppIcon name="open-in-new" size={14} color={nothing.black} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void copyPatreonLink()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>COPY LINK</Text>
        </Pressable>
      </View>
    </NothingCard>

    {/* Binance */}
    <NothingCard style={styles.methodCard}>
      <View style={styles.methodHeader}>
        <View style={styles.methodIcon}>
          <Image source={binanceIcon} style={styles.binanceIconImage} />
        </View>
        <View style={styles.methodInfo}>
          <Text style={styles.methodTitle}>Binance Pay</Text>
          <Text style={styles.methodMeta}>One-time · USDT / any crypto</Text>
        </View>
      </View>
      <View style={styles.uidBox}>
        <Text style={styles.uidLabel}>BINANCE UID</Text>
        <View style={styles.uidRow}>
          <Text style={styles.uidValue}>{BINANCE_UID}</Text>
          <Pressable accessibilityRole="button" onPress={() => void copyBinanceUID()} style={styles.copyBtn}>
            <AppIcon name="content-copy" size={14} color={nothing.white} />
            <Text style={styles.copyBtnText}>COPY</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.uidHint}>Open Binance → Pay → send to UID · Any token accepted</Text>
    </NothingCard>

    {message ? <View style={styles.toast}><Text style={styles.toastText}>{message}</Text></View> : null}

    <Text style={styles.footnote}>Support is voluntary and does not change access to any Aniraku features.</Text>
  </NativeScreen>;
}

const styles = StyleSheet.create({
  top: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11 },
  close: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised },
  pressed: { opacity: 0.7 },
  titleBlock: { gap: 2 },
  title: { color: nothing.white, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 25, fontWeight: "900", letterSpacing: -0.65 },

  hero: { gap: 10, padding: 18 },
  heroTitle: { color: nothing.white, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  heroCopy: { color: nothing.muted, fontFamily: "SpaceGrotesk-Regular", fontSize: 13, lineHeight: 19 },

  methodCard: { gap: 14, padding: 16 },
  methodHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  methodIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line, overflow: "hidden" },
  patreonIconImage: { width: 28, height: 28 },
  binanceIconImage: { width: 28, height: 28 },
  methodInfo: { flex: 1 },
  methodTitle: { color: nothing.white, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 15, fontWeight: "800" },
  methodMeta: { color: nothing.muted, fontFamily: "SpaceGrotesk-Regular", fontSize: 11, marginTop: 2 },

  methodActions: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: nothing.white, borderRadius: 8 },
  primaryBtnText: { color: nothing.black, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  secondaryBtn: { minWidth: 90, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 8 },
  secondaryBtnText: { color: nothing.muted, fontFamily: "SpaceGrotesk-Medium", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  uidBox: { width: "100%", padding: 12, borderRadius: 8, backgroundColor: nothing.black, borderWidth: 1, borderColor: nothing.line },
  uidLabel: { color: nothing.dim, fontFamily: "SpaceGrotesk-Medium", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginBottom: 6 },
  uidRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  uidValue: { color: nothing.white, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: nothing.red },
  copyBtnText: { color: nothing.black, fontFamily: "SpaceGrotesk-SemiBold", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  uidHint: { color: nothing.dim, fontFamily: "SpaceGrotesk-Regular", fontSize: 11, lineHeight: 16 },

  toast: { alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line },
  toastText: { color: nothing.white, fontFamily: "SpaceGrotesk-Medium", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  footnote: { color: nothing.dim, fontFamily: "SpaceGrotesk-Regular", fontSize: 11, lineHeight: 16, marginTop: 4 },
});
