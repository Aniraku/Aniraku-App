import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";

import { useAnirakuAuth } from "@/providers/auth-provider";
import { emitNotificationPrefsChanged } from "@/providers/notifications-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useProviderSync } from "@/hooks/use-provider-sync";
import { tokenHealth } from "@/lib/provider-sync-contract";
import { deleteCurrentAccount } from "@/lib/account";
import { checkForAnirakuUpdate, type AppRelease } from "@/lib/app-update";
import { downloadAndInstallAnirakuUpdate } from "@/lib/android-app-installer";
import { AppIcon } from "@/components/app-icon";
import { Toggle } from "@/components/toggle";
import { PROVIDER_LABELS, ProviderMark, type SyncProvider } from "@/components/provider-mark";
import { describeExport, describeImport, PROVIDER_LABELS as SYNC_LABELS } from "@/lib/provider-sync";
import { useNsfwPreference } from "@/lib/nsfw-preference";
import { DotLabel, nothing, Signal } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { t } from "@/lib/i18n";

export default function SettingsScreen() {
  const auth = useAnirakuAuth();
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const sync = useProviderSync();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  // Library import/export state (Miruro Profile.jsx:38-41): per-provider
  // inline results + export confirm, rendered under each provider row.
  const [syncResult, setSyncResult] = useState<
    Record<string, { type: "ok" | "error"; text: string } | null>
  >({});
  const [confirmExport, setConfirmExport] = useState<SyncProvider | "">("");
  const [transferBusy, setTransferBusy] = useState(""); // 'mal-import' | 'mal-export' | ...
  // Background export terminal → inline result (Miruro Profile exportSeenRef).
  const exportSeenRef = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const [provider, job] of Object.entries(sync.exportJobs)) {
      const prev = exportSeenRef.current[provider];
      exportSeenRef.current[provider] = job.status;
      if (prev !== "running") continue;
      if (job.status === "done") {
        const text =
          job.message ??
          describeExport({
            exported: job.exported,
            scores: job.scores,
            skipped: job.skipped,
            failed: job.failed,
            limited: false,
          });
        setSyncResult((r) => ({ ...r, [provider]: { type: "ok", text } }));
        setSyncMessage(text.toUpperCase());
      } else if (job.status === "error") {
        const text = job.message ?? "Export failed";
        setSyncResult((r) => ({ ...r, [provider]: { type: "error", text } }));
        setSyncMessage(text.toUpperCase());
      }
    }
  }, [sync.exportJobs]);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [availableRelease, setAvailableRelease] = useState<AppRelease | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const installedVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || "0.0.0";
  const nsfw = useNsfwPreference();

  const [notifPrefs, setNotifPrefs] = useState({ newEpisodes: true, commentReplies: true, systemAnnouncements: true });

  useEffect(() => {
    AsyncStorage.getItem("aniraku.notificationprefs").then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setNotifPrefs({ newEpisodes: parsed.newEpisodes ?? true, commentReplies: parsed.commentReplies ?? true, systemAnnouncements: parsed.systemAnnouncements ?? true });
        } catch { /* corrupted storage — keep defaults */ }
      }
    });
  }, []);

  const toggleNotifPref = (key: "newEpisodes" | "commentReplies" | "systemAnnouncements") => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void AsyncStorage.setItem("aniraku.notificationprefs", JSON.stringify(next)).then(() => emitNotificationPrefsChanged());
      return next;
    });
  };

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

  // ── Library import / export (Miruro Profile.jsx:267-315) ──
  // Import is a single chunk POST with inline describeImport result.
  // Export is a background paced loop (lib/provider-sync runner, ~30
  // entries/min): fire-and-forget, progress renders below, terminal state
  // inserts a notifications row so Alerts notifies even after navigating away.
  const runImport = async (provider: SyncProvider) => {
    const key = `${provider}-import`;
    if (transferBusy) return;
    setTransferBusy(key);
    setSyncResult((r) => ({ ...r, [provider]: null }));
    setSyncMessage(null);
    try {
      const data = await sync.importLibrary.mutateAsync(provider);
      const text = describeImport(data);
      setSyncResult((r) => ({ ...r, [provider]: { type: "ok", text } }));
      setSyncMessage(text.toUpperCase());
    } catch (error) {
      const text = error instanceof Error ? error.message : "Import failed";
      setSyncResult((r) => ({ ...r, [provider]: { type: "error", text } }));
      setSyncMessage(text.toUpperCase());
    } finally {
      setTransferBusy("");
    }
  };

  const runExport = (provider: SyncProvider) => {
    if (transferBusy) return;
    setConfirmExport("");
    const job = sync.exportJobs[provider];
    if (job?.status === "running") {
      const label = SYNC_LABELS[provider] ?? provider;
      const text = `Export to ${label} is already running in the background`;
      setSyncMessage(text.toUpperCase());
      return;
    }
    setSyncResult((r) => ({ ...r, [provider]: null }));
    setSyncMessage(null);
    sync.startBackgroundExport(provider);
  };

  const clearHistory = () => Alert.alert("Clear watch history?", "This removes every synchronized history entry from your Aniraku account.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => void history.clear.mutateAsync().catch((error) => Alert.alert("Could not clear history", error.message)) }]);
  const clearBookmarks = () => Alert.alert("Clear saved titles?", "This removes every synchronized bookmark from your Aniraku account.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => void bookmarks.clear.mutateAsync().catch((error) => Alert.alert("Could not clear bookmarks", error.message)) }]);
  const deleteAccount = () => Alert.alert("Delete Aniraku account?", "This permanently removes your profile, watch history, ratings, bookmarks, comments, notifications, preferences, and account. This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete account", style: "destructive", onPress: () => void deleteCurrentAccount().then(() => router.replace("/(tabs)" as never)).catch((error) => Alert.alert("Account not deleted", error.message)) }]);

  // Enabling adult content requires an explicit 18+ affirmation (one-time,
  // persisted). Disabling is always instant and never prompts.
  const requestNsfwChange = () => {
    if (nsfw.enabled) {
      nsfw.setEnabled(false);
      return;
    }
    if (nsfw.ageVerified) {
      nsfw.setEnabled(true);
      return;
    }
    Alert.alert(t("settings.nsfwAgeTitle"), t("settings.nsfwAgeMessage"), [
      { text: t("settings.nsfwAgeDecline"), style: "cancel" },
      {
        text: t("settings.nsfwAgeConfirm"),
        onPress: () => void nsfw.verifyAge().then(() => nsfw.setEnabled(true)).catch(() => {}),
      },
    ]);
  };

  return <NativeScreen>
    <View style={styles.top}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={() => router.back()} style={styles.close}>
        <AppIcon name="arrow-left" size={21} color={nothing.white} />
      </Pressable>
      <View style={styles.titleBlock}>
        <DotLabel>ACCOUNT / CONTROL ROOM</DotLabel>
        <Text style={styles.title}>{t("settings.title")}</Text>
      </View>
    </View>

    {/* ── Session ── */}
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="account" size={18} color={nothing.muted} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{auth.user.email}</Text>
        <Text style={styles.rowMeta}>VERIFIED SESSION</Text>
      </View>
      <Signal label="LIVE" tone="live" />
    </View>
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="logout" size={18} color={nothing.muted} /></View>
      <Pressable accessibilityRole="button" onPress={() => void auth.signOut().then(() => router.back())} style={styles.rowBody}>
        <Text style={styles.rowLabel}>{t("settings.signOut")}</Text>
      </Pressable>
    </View>

    {/* ── Application ── */}
    <View style={styles.section}><DotLabel>{t("settings.application")}</DotLabel></View>
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="cellphone-arrow-down" size={18} color={nothing.muted} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>ANIRAKU V{installedVersion}</Text>
        <Text style={styles.rowMeta}>{updateMessage || "CHECK FOR THE LATEST BUILD"}</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={checkingUpdate} onPress={() => void checkForUpdate()} style={styles.rowAction}>
        <Text style={styles.rowActionText}>{checkingUpdate ? "..." : t("settings.check")}</Text>
      </Pressable>
    </View>
    {availableRelease ? <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="download" size={18} color={nothing.red} /></View>
      <Pressable accessibilityRole="button" disabled={installingUpdate} onPress={() => void installAvailableRelease()} style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: nothing.red }]}>{installingUpdate ? "PREPARING INSTALL" : `INSTALL V${availableRelease.version}`}</Text>
      </Pressable>
    </View> : null}

    {/* ── Content ── */}
    <View style={styles.section}><DotLabel>{t("settings.content")}</DotLabel></View>
    <Pressable accessible accessibilityRole="switch" accessibilityState={{ checked: nsfw.enabled }} accessibilityLabel={t("settings.nsfwContent")} onPress={requestNsfwChange} style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="eye" size={18} color={nsfw.enabled ? nothing.red : nothing.muted} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{t("settings.nsfwContent")}</Text>
        <Text style={styles.rowMeta}>{t("settings.nsfwContentDetail")}</Text>
      </View>
      <Toggle enabled={nsfw.enabled} onToggle={requestNsfwChange} label={t("settings.nsfwContent")} />
    </Pressable>
    {nsfw.enabled ? <View style={styles.row}><View style={styles.rowIcon} /><Text style={styles.nsfwWarning}>{t("settings.nsfwWarning")}</Text></View> : null}

    {/* ── Notifications ── */}
    <View style={styles.section}><DotLabel>{t("settings.notifications")}</DotLabel></View>
    <Pressable accessible accessibilityRole="switch" accessibilityState={{ checked: notifPrefs.newEpisodes }} accessibilityLabel={t("settings.newEpisodes")} onPress={() => toggleNotifPref("newEpisodes")} style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="bell" size={18} color={notifPrefs.newEpisodes ? nothing.red : nothing.muted} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{t("settings.newEpisodes")}</Text>
        <Text style={styles.rowMeta}>{t("settings.newEpisodesDetail")}</Text>
      </View>
      <Toggle enabled={notifPrefs.newEpisodes} onToggle={() => toggleNotifPref("newEpisodes")} label={t("settings.newEpisodes")} />
    </Pressable>
    <Pressable accessible accessibilityRole="switch" accessibilityState={{ checked: notifPrefs.commentReplies }} accessibilityLabel={t("settings.commentReplies")} onPress={() => toggleNotifPref("commentReplies")} style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="reply" size={18} color={notifPrefs.commentReplies ? nothing.red : nothing.muted} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{t("settings.commentReplies")}</Text>
        <Text style={styles.rowMeta}>{t("settings.commentRepliesDetail")}</Text>
      </View>
      <Toggle enabled={notifPrefs.commentReplies} onToggle={() => toggleNotifPref("commentReplies")} label={t("settings.commentReplies")} />
    </Pressable>
    <Pressable accessible accessibilityRole="switch" accessibilityState={{ checked: notifPrefs.systemAnnouncements }} accessibilityLabel={t("settings.systemAnnouncements")} onPress={() => toggleNotifPref("systemAnnouncements")} style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="information" size={18} color={notifPrefs.systemAnnouncements ? nothing.red : nothing.muted} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{t("settings.systemAnnouncements")}</Text>
        <Text style={styles.rowMeta}>{t("settings.systemAnnouncementsDetail")}</Text>
      </View>
      <Toggle enabled={notifPrefs.systemAnnouncements} onToggle={() => toggleNotifPref("systemAnnouncements")} label={t("settings.systemAnnouncements")} />
    </Pressable>

    {/* ── Library sync ── */}
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <DotLabel>{t("settings.librarySync")}</DotLabel>
        <Pressable accessibilityRole="button" onPress={() => { setSyncMessage(null); void sync.status.refetch(); }} style={styles.refresh}>
          <AppIcon name="refresh" size={14} color={nothing.white} />
          <Text style={styles.refreshText}>{t("settings.refresh")}</Text>
        </Pressable>
      </View>
    </View>
    <Text style={styles.lead}>Move your list between Aniraku and your streaming accounts. Import pulls a provider&apos;s library into Aniraku — favorites with their list statuses (Watching, Plan to Watch, Completed, …), episode progress and scores (progress only advances, existing ratings are kept). Export writes each title&apos;s current status, watch progress and average score there, skipping titles that already match.</Text>

    {(["mal", "anilist"] as SyncProvider[]).map((provider) => {
      const item = sync.status.data?.[provider];
      const result = syncResult[provider];
      const job = sync.exportJobs[provider];
      const jobRunning = job?.status === "running";
      const busy =
        transferBusy === `${provider}-import` ||
        transferBusy === `${provider}-export` ||
        sync.authorize.isPending ||
        sync.disconnect.isPending ||
        jobRunning;
      const confirming = confirmExport === provider;
      const connected = Boolean(item?.configured && item?.connected);
      return <View key={provider}>
        <View style={styles.row}>
          <View style={styles.rowIcon}><ProviderMark provider={provider} size={18} muted={!connected} /></View>
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{PROVIDER_LABELS[provider]}</Text>
            <Text style={styles.rowMeta}>{connected ? item?.username ? `READY AS ${item.username.toUpperCase()}` : tokenHealth(item?.expires_at) : item?.configured ? "CONNECT THIS ACCOUNT TO IMPORT OR EXPORT" : "NOT CONFIGURED"}</Text>
          </View>
          <Signal label={connected ? "LIVE" : "OFF"} tone={connected ? "live" : "muted"} />
        </View>
        {connected ? <View style={styles.providerActions}>
          <Pressable disabled={busy} accessibilityRole="button" onPress={() => void runImport(provider)} style={[styles.providerBtn, busy && styles.btnDisabled]}>
            <Text style={styles.providerBtnText}>{transferBusy === `${provider}-import` ? "IMPORTING…" : t("settings.import")}</Text>
          </Pressable>
          <Pressable disabled={busy} accessibilityRole="button" onPress={() => setConfirmExport(provider)} style={[styles.providerBtn, busy && styles.btnDisabled]}>
            <Text style={styles.providerBtnText}>{jobRunning ? "EXPORTING…" : t("settings.export")}</Text>
          </Pressable>
          <Pressable disabled={busy} accessibilityRole="button" onPress={() => void sync.disconnect.mutateAsync(provider).then(() => setSyncMessage(`${PROVIDER_LABELS[provider].toUpperCase()} DISCONNECTED.`)).catch((error) => setSyncMessage(error.message.toUpperCase()))} style={[styles.providerBtn, styles.disconnectBtn, busy && styles.btnDisabled]}>
            <Text style={[styles.providerBtnText, styles.disconnectText]}>{t("settings.disconnect")}</Text>
          </Pressable>
        </View> : <View style={styles.providerActions}>
          <Pressable disabled={!item?.configured || busy} accessibilityRole="button" onPress={() => void connectProvider(provider)} style={[styles.providerBtn, styles.connectBtn, (!item?.configured || busy) && styles.btnDisabled]}>
            <Text style={styles.connectBtnText}>{busy ? "OPENING LINK" : `CONNECT ${PROVIDER_LABELS[provider].toUpperCase()}`}</Text>
          </Pressable>
        </View>}
        {result ? <Text style={result.type === "error" ? styles.syncError : styles.resultOk}>{result.type === "error" ? `⚠ ${result.text.toUpperCase()}` : `✓ ${result.text.toUpperCase()}`}</Text> : null}
        {jobRunning ? <Text style={styles.resultOk}>EXPORTING TO {(SYNC_LABELS[provider] ?? provider).toUpperCase()} IN THE BACKGROUND… {job.exported} TITLES SO FAR (CHUNK {job.chunks}) — YOU CAN LEAVE THIS PAGE, THE BELL WILL NOTIFY YOU WHEN IT FINISHES.{job.note ? ` ${job.note.toUpperCase()}` : ""}</Text> : null}
        {confirming ? <View style={styles.confirmBox}>
          <Text style={styles.confirmCopy}>Add your Aniraku favorites to your {SYNC_LABELS[provider]} library, preserving list status, watch progress and scores? Titles that already match are skipped.</Text>
          <View style={styles.confirmActions}>
            <Pressable disabled={busy} accessibilityRole="button" onPress={() => runExport(provider)} style={[styles.providerBtn, busy && styles.btnDisabled]}>
              <Text style={styles.providerBtnText}>{jobRunning ? "EXPORTING…" : "YES, EXPORT"}</Text>
            </Pressable>
            <Pressable disabled={busy} accessibilityRole="button" onPress={() => setConfirmExport("")} style={[styles.providerBtn, busy && styles.btnDisabled]}>
              <Text style={styles.providerBtnText}>CANCEL</Text>
            </Pressable>
          </View>
        </View> : null}
      </View>;
    })}
    {sync.status.isPending ? <Text style={styles.syncStatus}>CHECKING PROVIDER STATUS</Text> : sync.status.isError ? <Text style={styles.syncError}>{sync.status.error instanceof Error ? sync.status.error.message.toUpperCase() : "SYNC STATUS UNAVAILABLE"}</Text> : null}
    {syncMessage ? <Text style={styles.syncStatus}>{syncMessage}</Text> : null}
    <Text style={styles.footnote}>Connect in the browser while signed in, approve the provider, then return here and refresh.</Text>

    {/* ── Data ── */}
    <View style={styles.section}><DotLabel>{t("settings.syncedLibrary")}</DotLabel></View>
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="history" size={18} color={nothing.muted} /></View>
      <Pressable accessibilityRole="button" onPress={clearHistory} style={styles.rowBody}>
        <Text style={styles.rowLabel}>Clear watch history</Text>
        <Text style={styles.rowMeta}>Remove synced progress across your account</Text>
      </Pressable>
    </View>
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="bookmark-remove-outline" size={18} color={nothing.muted} /></View>
      <Pressable accessibilityRole="button" onPress={clearBookmarks} style={styles.rowBody}>
        <Text style={styles.rowLabel}>Clear saved titles</Text>
        <Text style={styles.rowMeta}>Remove all synced bookmarks</Text>
      </Pressable>
    </View>

    {/* ── Support / Legal ── */}
    <View style={styles.section}><DotLabel>{t("settings.supportLegal")}</DotLabel></View>
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="heart-outline" size={18} color={nothing.muted} /></View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/support" as never)} style={styles.rowBody}>
        <Text style={styles.rowLabel}>Support Aniraku</Text>
        <Text style={styles.rowMeta}>Patreon and optional USDT BEP20</Text>
      </Pressable>
    </View>
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="file-document-outline" size={18} color={nothing.muted} /></View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/legal" as never)} style={styles.rowBody}>
        <Text style={styles.rowLabel}>Legal information</Text>
        <Text style={styles.rowMeta}>Privacy, terms, copyright, and security</Text>
      </Pressable>
    </View>

    {/* ── Danger zone ── */}
    <View style={styles.section}><DotLabel tone="signal">IRREVERSIBLE</DotLabel></View>
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name="delete-forever-outline" size={18} color={nothing.red} /></View>
      <Pressable accessibilityRole="button" onPress={deleteAccount} style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: nothing.red }]}>Delete account</Text>
        <Text style={styles.rowMeta}>Permanently erase your Aniraku account</Text>
      </Pressable>
    </View>
    <Text style={styles.footnote}>Deletion removes your synchronized data before removing your authentication record.</Text>
  </NativeScreen>;
}

const styles = StyleSheet.create({
  redirectState: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 9 },
  redirectTitle: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 },
  redirectCopy: { color: nothing.muted, fontSize: 13, lineHeight: 19, maxWidth: 290 },

  top: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11 },
  close: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  titleBlock: { gap: 2 },
  title: { color: nothing.white, fontSize: 25, fontWeight: "900", letterSpacing: -0.65 },

  section: { paddingTop: 18, paddingBottom: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: nothing.line,
  },
  rowIcon: { width: 28, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { color: nothing.white, fontSize: 14, fontWeight: "800" },
  rowMeta: { color: nothing.muted, fontSize: 11, lineHeight: 15 },
  rowAction: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  rowActionText: { color: nothing.white, fontWeight: "800", fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },

  lead: { color: nothing.muted, fontSize: 12, lineHeight: 17, paddingHorizontal: 4, paddingBottom: 8 },
  footnote: { color: nothing.dim, fontSize: 11, lineHeight: 16, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8 },

  refresh: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  refreshText: { color: nothing.white, fontWeight: "800", fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },

  providerActions: { flexDirection: "row", gap: 6, paddingHorizontal: 40, paddingBottom: 10 },
  providerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  providerBtnText: { color: nothing.white, fontWeight: "800", fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  connectBtn: { backgroundColor: nothing.white, borderColor: nothing.white },
  connectBtnText: { color: nothing.black, fontWeight: "800", fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  disconnectBtn: { borderColor: "rgba(255,77,77,0.4)" },
  disconnectText: { color: nothing.red },
  btnDisabled: { opacity: 0.4 },

  syncStatus: { color: nothing.white, fontWeight: "800", fontSize: 10, lineHeight: 14, letterSpacing: 0.3, paddingHorizontal: 4, paddingVertical: 4 },
  syncError: { color: nothing.red, fontWeight: "800", fontSize: 10, lineHeight: 14, letterSpacing: 0.3, paddingHorizontal: 4, paddingVertical: 4 },
  resultOk: { color: "#86efac", fontWeight: "800", fontSize: 10, lineHeight: 15, letterSpacing: 0.3, paddingHorizontal: 4, paddingVertical: 4, marginTop: 6, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 8 },
  confirmBox: { marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: "rgba(234,179,8,0.08)", borderWidth: 1, borderColor: "rgba(234,179,8,0.3)", gap: 10 },
  confirmCopy: { color: nothing.white, fontSize: 12, lineHeight: 18 },
  confirmActions: { flexDirection: "row", gap: 8 },

  nsfwWarning: { flex: 1, color: nothing.red, fontSize: 11, lineHeight: 16, fontWeight: "700" },
});
