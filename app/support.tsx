import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";

import { AppIcon } from "@/components/app-icon";
import { DotLabel, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { PATREON_URL, SUPPORT_FUNDING_COPY, USDT_ASSET, USDT_BEP20_ADDRESS, USDT_NETWORK, USDT_NETWORK_SHORT } from "@/lib/support";

const qr = require("../assets/images/usdt-bep20-support-qr.png");

export default function SupportScreen() {
  const [message, setMessage] = useState<string | null>(null);

  const openPatreon = async () => {
    setMessage(null);
    try {
      await WebBrowser.openBrowserAsync(PATREON_URL, { toolbarColor: nothing.black, controlsColor: nothing.white, showTitle: false });
    } catch {
      setMessage("PATREON COULD NOT OPEN. CHECK YOUR CONNECTION.");
    }
  };

  const copyAddress = async () => {
    try {
      await Clipboard.setStringAsync(USDT_BEP20_ADDRESS);
      setMessage("USDT BEP20 ADDRESS COPIED.");
    } catch {
      setMessage("ADDRESS COULD NOT BE COPIED.");
    }
  };

  return <NativeScreen>
    <View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Close support" onPress={() => router.back()} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><AppIcon name="arrow-left" size={21} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel tone="signal">COMMUNITY / SUPPORT</DotLabel><Text style={styles.title}>Support Aniraku</Text></View></View>
    <NothingCard style={styles.hero}><View style={styles.heroTop}><View style={styles.heart}><AppIcon name="heart-outline" size={25} color={nothing.black} /></View><Signal label="OPTIONAL" tone="live" /></View><Text style={styles.heroTitle}>Keep the project moving.</Text><Text style={styles.heroCopy}>Voluntary support funds {SUPPORT_FUNDING_COPY.toLowerCase()}</Text><Pressable accessibilityRole="link" onPress={() => void openPatreon()} style={({ pressed }) => [styles.patreon, pressed && styles.pressed]}><View style={styles.buttonIdentity}><AppIcon name="account-heart-outline" size={18} color={nothing.black} /><Text style={styles.patreonText}>SUPPORT ON PATREON</Text></View><AppIcon name="open-in-new" size={17} color={nothing.black} /></Pressable></NothingCard>
    <View style={styles.group}><DotLabel>CRYPTO / OPTIONAL</DotLabel><NothingCard style={styles.cryptoCard}><View style={styles.cryptoHead}><View><Text style={styles.cryptoTitle}>{USDT_ASSET} · {USDT_NETWORK_SHORT}</Text><Text style={styles.cryptoMeta}>{USDT_NETWORK}</Text></View><View style={styles.cryptoMark}><AppIcon name="currency-usd" size={20} color={nothing.white} /></View></View><Image source={qr} accessibilityLabel="USDT BNB Smart Chain payment QR code" style={styles.qr} /><Text style={styles.warning}>SEND USDT ON BNB SMART CHAIN (BEP20) ONLY. VERIFY THE NETWORK BEFORE SENDING.</Text><View style={styles.addressBox}><Text selectable style={styles.address}>{USDT_BEP20_ADDRESS}</Text></View><Pressable accessibilityRole="button" onPress={() => void copyAddress()} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}><AppIcon name="content-copy" size={16} color={nothing.white} /><Text style={styles.copyText}>COPY USDT BEP20 ADDRESS</Text></Pressable></NothingCard></View>
    {message ? <Text style={styles.status}>{message}</Text> : null}
    <Text style={styles.footnote}>Choose the method that works for you. Support is voluntary and does not change access to Aniraku features.</Text>
  </NativeScreen>;
}

const styles = StyleSheet.create({
  top: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11 }, close: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised }, titleBlock: { gap: 2 }, title: { color: nothing.white, fontSize: 25, fontWeight: "900", letterSpacing: -0.65 }, group: { gap: 8 }, hero: { gap: 14, padding: 16 }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heart: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: nothing.white }, heroTitle: { color: nothing.white, fontSize: 25, fontWeight: "900", letterSpacing: -0.7 }, heroCopy: { color: nothing.muted, fontSize: 13, lineHeight: 19 }, patreon: { minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 4, backgroundColor: nothing.white }, buttonIdentity: { flexDirection: "row", alignItems: "center", gap: 8 }, patreonText: { color: nothing.black, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 0.35 }, cryptoCard: { alignItems: "center", gap: 12, padding: 16 }, cryptoHead: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, cryptoTitle: { color: nothing.white, fontFamily: "monospace", fontSize: 12, fontWeight: "900", letterSpacing: 0.45 }, cryptoMeta: { color: nothing.muted, fontSize: 11, marginTop: 4 }, cryptoMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 4, backgroundColor: nothing.raised }, qr: { width: 196, height: 196, backgroundColor: nothing.white, borderRadius: 4 }, warning: { color: nothing.red, fontFamily: "monospace", fontSize: 9, fontWeight: "900", lineHeight: 14, letterSpacing: 0.25, textAlign: "center" }, addressBox: { width: "100%", padding: 11, borderRadius: 4, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.black }, address: { color: nothing.white, fontFamily: "monospace", fontSize: 10, lineHeight: 15, textAlign: "center" }, copyButton: { width: "100%", minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 }, copyText: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.35 }, status: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 }, footnote: { color: nothing.dim, fontSize: 11, lineHeight: 17 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
