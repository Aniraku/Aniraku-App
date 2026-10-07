import { useEffect, useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { NetworkStateType, useNetworkState } from "expo-network";
import { useDownloadQueue, useOfflineDownloads } from "@/hooks/use-downloads";
import { useDownloadSettings } from "@/hooks/use-download-settings";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import {
  cancelDownloadJob,
  dismissDownloadJob,
  formatBytes,
  isOfflineSavingSupported,
  retryDownloadJob,
  type OfflineDownload,
  type OfflineDownloadJob,
} from "@/lib/downloads";
import { AnirakuMark, DotLabel, Signal, nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import { Toggle } from "@/components/toggle";

const MEGABYTE = 1024 * 1024;
const quotaOptionsMb = [0, 1024, 2048, 5120];
const quotaLabels: Record<number, string> = { 0: "UNLIMITED", 1024: "1 GB", 2048: "2 GB", 5120: "5 GB" };

const jobStateLabel: Record<OfflineDownloadJob["state"], string> = {
  queued: "QUEUED",
  downloading: "DOWNLOADING",
  done: "SAVED",
  failed: "FAILED",
};

function jobStatusLabel(job: OfflineDownloadJob): string {
  if (job.state === "queued" && job.hold === "wifi") return "WAITING FOR WI-FI";
  if (job.state === "queued" && job.hold === "quota") return "STORAGE LIMIT REACHED";
  return jobStateLabel[job.state];
}

export default function DownloadsScreen() {
  const queue = useDownloadQueue();
  const saved = useOfflineDownloads();
  const prefs = useDownloadSettings();
  const network = useNetworkState();
  const { displayRows } = useWatchHistory();
  const supported = isOfflineSavingSupported();

  // New files change the storage readout; keep the bar in sync.
  useEffect(() => {
    void prefs.refresh();
  }, [prefs.refresh, saved.entries.length]);

  const posterByAnimeId = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of displayRows) {
      const id = Number(row?.anime_id);
      if (!Number.isInteger(id) || map.has(id)) continue;
      const uri = row?.episode_thumbnail || row?.anime_image;
      if (uri) map.set(id, String(uri));
    }
    return map;
  }, [displayRows]);

  const waitingForWifi = prefs.settings.wifiOnly && (network.type === NetworkStateType.CELLULAR || network.isConnected === false);

  const quotaBytes = prefs.settings.quotaMb > 0 ? prefs.settings.quotaMb * MEGABYTE : 0;
  const capacityBytes = quotaBytes > 0 ? quotaBytes : prefs.usedBytes + prefs.freeBytes;
  const fillRatio = capacityBytes > 0 ? Math.min(1, prefs.usedBytes / capacityBytes) : 0;
  const overQuota = quotaBytes > 0 && prefs.usedBytes >= quotaBytes;

  const confirmRemove = (entry: OfflineDownload) => {
    Alert.alert("Delete download?", `${entry.title} · EP ${entry.episode} will be removed from this device.`, [
      { text: "KEEP", style: "cancel" },
      { text: "DELETE", style: "destructive", onPress: () => void saved.remove(entry).catch(() => {
        Alert.alert("Could not delete", "That file is still on disk. Try again in a moment.");
        void saved.refresh();
      }) },
    ]);
  };

  const openEpisode = (animeId: number, episode: number, title: string, image: string) =>
    router.push({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(episode), title, image } } as never);

  const renderJob = (job: OfflineDownloadJob) => {
    const poster = posterByAnimeId.get(job.animeId) ?? "";
    const label = jobStatusLabel(job);
    const tone = job.state === "failed" || job.hold ? "signal" : job.state === "done" ? "muted" : "live";
    return (
      <View key={job.id} style={styles.job}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.thumb} contentFit="cover" transition={0} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.thumbFallback}><Text style={styles.thumbLetter}>{String(job.title || "A").charAt(0).toUpperCase()}</Text></View>
        )}
        <View style={styles.rowBody}>
          <Signal label={`EP ${job.episode} · ${job.quality.toUpperCase()}`} tone={tone} />
          <Text style={styles.rowTitle} numberOfLines={1}>{job.title}</Text>
          <Text style={[styles.rowMeta, (job.state === "failed" || job.hold) && styles.rowMetaAlert]}>{label}</Text>
          {job.state === "downloading" ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progress, { width: `${Math.round(Math.min(1, Math.max(0, job.progress)) * 100)}%` }]} />
            </View>
          ) : null}
          {job.state === "failed" && job.error ? <Text style={styles.jobError} numberOfLines={2}>{job.error}</Text> : null}
        </View>
        <View style={styles.jobActions}>
          {job.state === "failed" ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${job.title}`} onPress={() => retryDownloadJob(job.id)} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <AppIcon name="refresh" size={15} color={nothing.white} />
            </Pressable>
          ) : null}
          {job.state === "queued" || job.state === "downloading" ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Cancel ${job.title} download`} onPress={() => cancelDownloadJob(job.id)} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <AppIcon name="close" size={15} color={nothing.muted} />
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${job.title} from the queue`} onPress={() => dismissDownloadJob(job.id)} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <AppIcon name="trash-can-outline" size={15} color={nothing.dim} />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderSavedEntry = (entry: OfflineDownload) => {
    const poster = posterByAnimeId.get(entry.animeId) ?? "";
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${entry.title} episode ${entry.episode} offline`}
        onPress={() => openEpisode(entry.animeId, entry.episode, entry.title, poster)}
        onLongPress={() => confirmRemove(entry)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {poster ? (
          <Image source={{ uri: poster }} style={styles.thumb} contentFit="cover" transition={0} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.thumbFallback}><Text style={styles.thumbLetter}>{String(entry.title || "A").charAt(0).toUpperCase()}</Text></View>
        )}
        <View style={styles.rowBody}>
          <Signal label={`EP ${entry.episode} · ${entry.quality.toUpperCase()}`} />
          <Text style={styles.rowTitle} numberOfLines={1}>{entry.title}</Text>
          <Text style={styles.rowMeta}>{formatBytes(entry.size)} · SAVED ON THIS DEVICE</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${entry.title} episode ${entry.episode} download`}
          accessibilityHint="Long pressing the row does the same"
          hitSlop={8}
          onPress={() => confirmRemove(entry)}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <AppIcon name="trash-can-outline" size={16} color={nothing.dim} />
        </Pressable>
        <AppIcon name="play-circle-outline" size={20} color={nothing.red} />
      </Pressable>
    );
  };

  const header = (
    <View>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close downloads" onPress={() => router.back()} style={styles.close}>
          <AppIcon name="arrow-left" size={21} color={nothing.white} />
        </Pressable>
        <View style={styles.titleBlock}>
          <DotLabel>OFFLINE / SAVED EPISODES</DotLabel>
          <Text style={styles.title}>Downloads</Text>
        </View>
        <AnirakuMark size={36} />
      </View>

      {!supported ? (
        <View style={styles.banner}>
          <Signal label="NOT AVAILABLE ON THIS DEVICE" tone="signal" />
          <Text style={styles.bannerText}>
            Saving episodes for offline playback is Android-only right now. Everything you save on Android still shows up here.
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadText}>
            <DotLabel tone="live">STORAGE</DotLabel>
            <Text style={styles.sectionTitle}>Save settings</Text>
          </View>
          <Text style={styles.storageText}>
            {formatBytes(prefs.usedBytes)} USED{quotaBytes > 0 ? ` / ${formatBytes(quotaBytes)} LIMIT` : prefs.freeBytes > 0 ? ` · ${formatBytes(prefs.freeBytes)} FREE` : ""}
          </Text>
        </View>
        <View style={styles.storageTrack}>
          <View style={[styles.storageFill, { width: `${Math.max(2, Math.round(fillRatio * 100))}%` }, overQuota && styles.storageFillOver]} />
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Wi-Fi only</Text>
            <Text style={styles.settingHint}>Hold new downloads until Wi-Fi is back.</Text>
          </View>
          <Toggle enabled={prefs.settings.wifiOnly} onToggle={() => void prefs.toggleWifiOnly()} label="Wi-Fi only downloads" />
        </View>
        {waitingForWifi ? <Signal label="WAITING FOR WI-FI — QUEUE PAUSED" tone="signal" /> : null}
        <View style={styles.quotaRow}>
          {quotaOptionsMb.map((mb) => {
            const active = prefs.settings.quotaMb === mb;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Storage limit ${quotaLabels[mb]}`}
                accessibilityState={{ selected: active }}
                key={mb}
                onPress={() => prefs.setQuotaMb(mb)}
                style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{quotaLabels[mb]}</Text>
              </Pressable>
            );
          })}
        </View>
        {overQuota ? <Text style={styles.overQuota}>Over the limit — queued downloads wait here until you free space or raise the cap.</Text> : null}
      </View>

      {queue.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadText}>
              <DotLabel tone="live">QUEUE</DotLabel>
              <Text style={styles.sectionTitle}>Downloading</Text>
            </View>
            <Text style={styles.storageText}>{String(queue.length).padStart(2, "0")}</Text>
          </View>
          {queue.map(renderJob)}
        </View>
      ) : null}
    </View>
  );

  const body = saved.loading ? (
    <LoadingState label="Reading saved downloads" />
  ) : saved.error ? (
    <ErrorState message={saved.error} onRetry={() => void saved.refresh()} />
  ) : saved.entries.length === 0 ? (
    <EmptyState
      label="Episodes you save for offline play land here."
      action={{ label: "BROWSE CATALOG", onPress: () => router.push("/catalog" as never) }}
    />
  ) : (
    saved.entries.map(renderSavedEntry)
  );

  return (
    <NativeScreen>
      {header}
      <View style={styles.listSection}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadText}>
            <DotLabel>SAVED EPISODES</DotLabel>
            <Text style={styles.sectionTitle}>On this device</Text>
          </View>
          <Text style={styles.storageText}>{String(saved.entries.length).padStart(2, "0")}</Text>
        </View>
        {body}
      </View>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: 82, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  close: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1, gap: 2 },
  title: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.65 },
  banner: { gap: 8, padding: 14, marginBottom: 18, borderRadius: 12, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface, borderLeftWidth: 2, borderLeftColor: nothing.red },
  bannerText: { color: nothing.muted, fontSize: 13, lineHeight: 19, maxWidth: 330 },
  section: { marginBottom: 22, gap: 10 },
  sectionHead: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeadText: { gap: 4 },
  sectionTitle: { color: nothing.white, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  storageText: { color: nothing.dim, fontFamily: nothing.mono, fontWeight: "900", fontSize: 11, letterSpacing: 0.3 },
  storageTrack: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: nothing.line },
  storageFill: { height: "100%", backgroundColor: nothing.green },
  storageFillOver: { backgroundColor: nothing.red },
  settingRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { color: nothing.white, fontSize: 14, fontWeight: "800" },
  settingHint: { color: nothing.dim, fontSize: 12, lineHeight: 17 },
  quotaRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { minHeight: 32, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 4, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  chipActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.1)" },
  chipText: { color: nothing.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
  chipTextActive: { color: nothing.red },
  overQuota: { color: nothing.red, fontSize: 12, lineHeight: 17 },
  listSection: { gap: 4 },
  row: { minHeight: 96, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: nothing.line },
  job: { minHeight: 88, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: nothing.line },
  thumb: { width: 52, height: 74, borderRadius: 8, backgroundColor: nothing.raised },
  thumbFallback: { width: 52, height: 74, borderRadius: 8, backgroundColor: nothing.raised, alignItems: "center", justifyContent: "center" },
  thumbLetter: { color: nothing.dim, fontSize: 26, fontWeight: "900" },
  rowBody: { flex: 1, justifyContent: "center", gap: 5 },
  rowTitle: { color: nothing.white, fontWeight: "900", fontSize: 14, lineHeight: 18 },
  rowMeta: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.35 },
  rowMetaAlert: { color: nothing.red },
  jobError: { color: nothing.dim, fontSize: 11, lineHeight: 15 },
  progressTrack: { height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: nothing.line },
  progress: { height: "100%", backgroundColor: nothing.red },
  jobActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  pressed: nothing.pressed,
});
