import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";

import { useAnirakuAuth } from "@/providers/auth-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useProviderSync } from "@/hooks/use-provider-sync";
import { tokenHealth } from "@/lib/provider-sync-contract";
import { deleteCurrentAccount } from "@/lib/account";
import { checkForAnirakuUpdate, type AppRelease } from "@/lib/app-update";
import { downloadAndInstallAnirakuUpdate } from "@/lib/android-app-installer";
import { AppIcon } from "@/components/app-icon";
import { PROVIDER_LABELS, ProviderMark, type SyncProvider } from "@/components/provider-mark";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

function SettingRow({ label, detail, icon, onPress, danger = false }: { label: string; detail: string; icon: "history" | "bookmark-remove-outline" | "file-document-outline" | "delete-forever-outline" | "heart-outline"; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.settingRow, danger && styles.settingDanger, pressed && styles.pressed]}>
    <View style={[styles.settingIcon, danger && styles.settingIconDanger]}><AppIcon name={icon} size={20} color={danger ? nothing.red : nothing.white} /></View>
    <View style={styles.settingCopy}><Text style={[styles.settingLabel, danger && styles.dangerLabel]}>{label}</Text><Text style={styles.settingDetail}>{detail}</Text></View>
    <AppIcon name="chevron-right" size={20} color={danger ? nothing.red : nothing.muted} />
  </Pressable>;
}

function resultSummary(result: { imported?: number; already?: number; exported?: number; skipped?: number; limited?: boolean }, mode: "import" | "export") {
  if (mode === "import") return `${result.imported || 0} IMPORTED · ${result.already || 0} ALREADY IN LIBRARY`;
  return `${result.exported || 0} EXPORTED · ${result.skipped || 0} ALREADY SYNCED${result.limited ? " · MORE REMAIN" : ""}`;
}

export default function SettingsScreen() {
  const auth = useAnirakuAuth();
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const sync = useProviderSync();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [availableRelease, setAvailableRelease] = useState<AppRelease | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const installedVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || "0.0.0";

  useEffect(() => {
    if (!auth.loading && !auth.user) router.replace("/auth" as never);
  }, [auth.loading, auth.user]);

  if (auth.loading || !auth.user) {
    return <NativeScreen><View style={styles.redirectState}><DotLabel>ACCOUNT REQUIRED</DotLabel><Text style={styles.redirectTitle}>Opening account controls</Text><Text style={styles.redirectCopy}>Settings are available after your verified Aniraku session has been restored.</Text></View></NativeScreen>;
  }

  const checkForUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    try {
      const result = await checkForAnirakuUpdate(installedVersion, { force: true });
      setAvailableRelease(result.available ? result.release : null);
      setUpdateMessage(result.available && result.release ? `V${result.release.version} IS READY TO INSTALL.` : "YOU ARE USING THE LATEST PUBLISHED BUILD.");
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message.toUpperCase() : "UPDATE STATUS IS UNAVAILABLE.");
    } finally { setCheckingUpdate(false); }
  };

  const installAvailableRelease = async () => {
    if (!availableRelease) return;
    setInstallingUpdate(true);
    setUpdateMessage("DOWNLOADING VERIFIED APK.");
    try {
      await downloadAndInstallAnirakuUpdate(availableRelease);
      setUpdateMessage("OPENING ANDROID INSTALLER.");
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message.toUpperCase() : "THE UPDATE COULD NOT START.");
    } finally { setInstallingUpdate(false); }
  };

  const connectProvider = async (provider: SyncProvider) => {
    try {
      setSyncMessage(null);
      const url = await sync.authorize.mutateAsync(provider);
      await WebBrowser.openBrowserAsync(url, { toolbarColor: nothing.black, controlsColor: nothing.white, showTitle: false });
      setSyncMessage(`FINISH ${PROVIDER_LABELS[provider].toUpperCase()} APPROVAL IN BROWSER, THEN TAP REFRESH.`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message.toUpperCase() : "PROVIDER CONNECTION COULD NOT START.");
    }
  };

  const runTransfer = async (provider: SyncProvider, mode: "import" | "export") => {
    try {
      setSyncMessage(null);
      const result = mode === "import" ? await sync.importLibrary.mutateAsync(provider) : await sync.exportLibrary.mutateAsync(provider);
      setSyncMessage(resultSummary(result, mode));
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message.toUpperCase() : "LIBRARY TRANSFER COULD NOT COMPLETE.");
    }
  };

  const clearHistory = () => Alert.alert("Clear watch history?", "This removes every synchronized history entry from your Aniraku account.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => void history.clear.mutateAsync().catch((error) => Alert.alert("Could not clear history", error.message)) }]);
  const clearBookmarks = () => Alert.alert("Clear saved titles?", "This removes every synchronized bookmark from your Aniraku account.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => void bookmarks.clear.mutateAsync().catch((error) => Alert.alert("Could not clear bookmarks", error.message)) }]);
  const deleteAccount = () => Alert.alert("Delete Aniraku account?", "This permanently removes your profile, watch history, ratings, bookmarks, comments, notifications, preferences, and account. This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete account", style: "destructive", onPress: () => void deleteCurrentAccount().then(() => router.replace("/(tabs)" as never)).catch((error) => Alert.alert("Account not deleted", error.message)) }]);

  const syncRows = (["mal", "anilist"] as SyncProvider[]).map((provider) => {
    const item = sync.status.data?.[provider];
    const busy = sync.authorize.isPending || sync.disconnect.isPending || sync.importLibrary.isPending || sync.exportLibrary.isPending;
    const connected = Boolean(item?.configured && item?.connected);
    return <NothingCard key={provider} style={styles.providerCard}>
      <View style={styles.providerTop}><View style={styles.providerIdentity}><View style={styles.providerIcon}><ProviderMark provider={provider} size={19} muted={!connected} /></View><View><Text style={styles.providerName}>{PROVIDER_LABELS[provider]}</Text><Text style={styles.providerMeta}>{connected ? item?.username ? `SYNCING AS ${item.username}` : tokenHealth(item?.expires_at) : item?.configured ? "NOT CONNECTED" : "NOT CONFIGURED ON SERVER"}</Text></View></View><Signal label={connected ? "CONNECTED" : "OFF"} tone={connected ? "live" : "muted"} /></View>
      {connected ? <><View style={styles.providerActions}><Pressable disabled={busy} accessibilityRole="button" onPress={() => void runTransfer(provider, "import")} style={[styles.providerButton, busy && styles.buttonDisabled]}><Text style={styles.providerButtonText}>IMPORT</Text></Pressable><Pressable disabled={busy} accessibilityRole="button" onPress={() => void runTransfer(provider, "export")} style={[styles.providerButton, busy && styles.buttonDisabled]}><Text style={styles.providerButtonText}>EXPORT</Text></Pressable><Pressable disabled={busy} accessibilityRole="button" onPress={() => void sync.disconnect.mutateAsync(provider).then(() => setSyncMessage(`${PROVIDER_LABELS[provider].toUpperCase()} DISCONNECTED.`)).catch((error) => setSyncMessage(error.message.toUpperCase()))} style={[styles.providerButton, styles.disconnectButton, busy && styles.buttonDisabled]}><Text style={[styles.providerButtonText, styles.disconnectText]}>DISCONNECT</Text></Pressable></View><Text style={styles.providerHint}>Progress and episode-rating summaries are pushed only after real playback or a deliberate rating.</Text></> : <Pressable disabled={!item?.configured || busy} accessibilityRole="button" onPress={() => void connectProvider(provider)} style={[styles.connectButton, (!item?.configured || busy) && styles.buttonDisabled]}><AppIcon name="link-variant" size={16} color={nothing.black} /><Text style={styles.connectText}>{busy ? "OPENING SECURE LINK" : `CONNECT ${PROVIDER_LABELS[provider].toUpperCase()}`}</Text></Pressable>}
    </NothingCard>;
  });

  return <NativeScreen>
    <View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={() => router.back()} style={styles.close}><AppIcon name="arrow-left" size={21} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel>ACCOUNT / CONTROL ROOM</DotLabel><Text style={styles.title}>Settings</Text></View></View>
    <NothingCard style={styles.session}><Signal label="VERIFIED SESSION" tone="live" /><Text style={styles.email}>{auth.user.email}</Text><NothingButton label="SIGN OUT" variant="outline" onPress={() => void auth.signOut().then(() => router.back())} /></NothingCard>
    <View style={styles.group}><DotLabel>APPLICATION</DotLabel><NothingCard style={styles.updateCard}><View><Text style={styles.updateVersion}>ANIRAKU V{installedVersion}</Text><Text style={styles.updateCopy}>{updateMessage || "CHECK FOR THE LATEST DIRECT-DISTRIBUTION BUILD."}</Text></View><Pressable accessibilityRole="button" disabled={checkingUpdate} onPress={() => void checkForUpdate()} style={[styles.updateButton, checkingUpdate && styles.buttonDisabled]}><Text style={styles.updateButtonText}>{checkingUpdate ? "CHECKING" : "CHECK"}</Text></Pressable></NothingCard>{availableRelease ? <Pressable accessibilityRole="button" disabled={installingUpdate} onPress={() => void installAvailableRelease()} style={[styles.releaseButton, installingUpdate && styles.buttonDisabled]}><Text style={styles.releaseButtonText}>{installingUpdate ? "PREPARING INSTALL" : `INSTALL V${availableRelease.version}`}</Text></Pressable> : null}</View>
    <View style={styles.group}><View style={styles.syncHeading}><View><DotLabel>LIBRARY SYNC</DotLabel><Text style={styles.groupTitle}>Your connected lists</Text></View><Pressable accessibilityRole="button" onPress={() => { setSyncMessage(null); void sync.status.refetch(); }} style={styles.refresh}><AppIcon name="refresh" size={16} color={nothing.white} /><Text style={styles.refreshText}>REFRESH</Text></Pressable></View><Text style={styles.syncLead}>The same protected Aniraku service connects your MyAnimeList and AniList libraries. Provider passwords and tokens never enter the Android app.</Text>{sync.status.isPending ? <Text style={styles.syncStatus}>CHECKING PROVIDER STATUS</Text> : sync.status.isError ? <Text style={styles.syncError}>{sync.status.error instanceof Error ? sync.status.error.message.toUpperCase() : "SYNC STATUS UNAVAILABLE"}</Text> : syncRows}{syncMessage ? <Text style={styles.syncStatus}>{syncMessage}</Text> : null}<Text style={styles.syncFootnote}>Connect in the browser while signed in to the same Aniraku account, approve the provider, then return here and refresh. Import and export are always deliberate actions.</Text></View>
    <View style={styles.group}><DotLabel>SYNCED LIBRARY</DotLabel><SettingRow label="Clear watch history" detail="Remove synced progress across your account" icon="history" onPress={clearHistory} /><SettingRow label="Clear saved titles" detail="Remove all synced bookmarks" icon="bookmark-remove-outline" onPress={clearBookmarks} /></View>
    <View style={styles.group}><DotLabel>SUPPORT AND LEGAL</DotLabel><SettingRow label="Support Aniraku" detail="Patreon and optional USDT BEP20" icon="heart-outline" onPress={() => router.push("/support" as never)} /><SettingRow label="Legal information" detail="Privacy, terms, copyright, and security" icon="file-document-outline" onPress={() => router.push("/legal" as never)} /></View>
    <View style={styles.group}><DotLabel tone="signal">IRREVERSIBLE</DotLabel><Text style={styles.warning}>Deletion is completed through the protected account service. It clears your synchronized data before removing your authentication record.</Text><SettingRow label="Delete account" detail="Permanently erase your Aniraku account" icon="delete-forever-outline" onPress={deleteAccount} danger /></View>
  </NativeScreen>;
}

const styles = StyleSheet.create({
  redirectState: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 9 }, redirectTitle: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 }, redirectCopy: { color: nothing.muted, fontSize: 13, lineHeight: 19, maxWidth: 290 }, top: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11 }, close: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised }, titleBlock: { gap: 2 }, title: { color: nothing.white, fontSize: 25, fontWeight: "900", letterSpacing: -0.65 }, session: { padding: 16, gap: 10 }, email: { color: nothing.white, fontWeight: "900", fontSize: 15 }, group: { gap: 8 }, groupTitle: { color: nothing.white, fontSize: 18, fontWeight: "900", marginTop: 4 }, syncHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }, syncLead: { color: nothing.muted, fontSize: 12, lineHeight: 18 }, refresh: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 }, refreshText: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 8, letterSpacing: 0.3 }, syncStatus: { color: nothing.white, fontFamily: "monospace", fontWeight: "800", fontSize: 9, lineHeight: 14, letterSpacing: 0.3 }, syncError: { color: nothing.red, fontFamily: "monospace", fontWeight: "800", fontSize: 9, lineHeight: 14, letterSpacing: 0.3 }, syncFootnote: { color: nothing.dim, fontSize: 11, lineHeight: 16 }, providerCard: { gap: 10, padding: 12 }, providerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, providerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }, providerIcon: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 4, backgroundColor: nothing.raised }, providerName: { color: nothing.white, fontSize: 14, fontWeight: "900" }, providerMeta: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.2, marginTop: 3 }, providerActions: { flexDirection: "row", gap: 6 }, providerButton: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 4 }, providerButtonText: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 8, letterSpacing: 0.25 }, disconnectButton: { borderColor: "rgba(255,77,77,0.5)" }, disconnectText: { color: nothing.red }, connectButton: { minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 4, backgroundColor: nothing.white }, connectText: { color: nothing.black, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.3 }, providerHint: { color: nothing.dim, fontSize: 10, lineHeight: 15 }, buttonDisabled: { opacity: 0.42 }, updateCard: { minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12 }, updateVersion: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 }, updateCopy: { maxWidth: 210, marginTop: 4, color: nothing.muted, fontSize: 10, lineHeight: 14 }, updateButton: { minWidth: 64, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: nothing.white }, updateButtonText: { color: nothing.black, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 }, releaseButton: { minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: nothing.white }, releaseButtonText: { color: nothing.black, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 }, settingRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderRadius: 16, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line }, settingDanger: { borderColor: "rgba(255,77,77,0.45)", backgroundColor: "rgba(255,77,77,0.055)" }, settingIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: nothing.raised }, settingIconDanger: { backgroundColor: "rgba(255,77,77,0.10)" }, settingCopy: { flex: 1, gap: 3 }, settingLabel: { color: nothing.white, fontSize: 14, fontWeight: "900" }, dangerLabel: { color: nothing.red }, settingDetail: { color: nothing.muted, fontSize: 11, lineHeight: 15 }, warning: { color: nothing.muted, fontSize: 12, lineHeight: 18 }, pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
