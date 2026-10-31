import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { NetworkStateType, useNetworkState } from "expo-network";
import { estimateHlsSize, parseMediaPlaylist } from "@/lib/downloads-hls";
import { anirakuProxyRequestHeaders, anirakuProxyUrl } from "@/lib/aniraku-api";
import { downloadRequestHeaders, formatBytes, startMaximumQualityDownload } from "@/lib/downloads";
import { useDownloadSettings } from "@/hooks/use-download-settings";
import { originalStreamUrl } from "@/lib/hls-variants";
import type { StreamSource } from "@/lib/types";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

export type DownloadSheetOption = {
  key: string;
  /** Row label, e.g. "1080p" or "ORIGINAL". */
  label: string;
  /** Quality string recorded on the download entry ("1080p", "ORIGINAL DIRECT"). */
  quality: string;
  /** Base stream source handed to startMaximumQualityDownload. */
  source: StreamSource;
  /** Direct CDN variant playlist URL — present means an HLS bundle download. */
  variantUrl?: string | null;
  /** Variant bandwidth (bit/s) for the size estimate. */
  bandwidth?: number;
};

type Estimate = { bytes: number | null; live: boolean };

type DownloadSheetProps = {
  visible: boolean;
  onClose: () => void;
  animeId: number;
  episode: number;
  language: "sub" | "dub";
  title: string;
  options: DownloadSheetOption[];
  headers?: Record<string, string>;
  /** Quality label currently playing — gets the red "current" dot. */
  currentQuality?: string | null;
  onStarted: (option: DownloadSheetOption) => void;
  onError: (message: string) => void;
};

const ESTIMATE_TIMEOUT_MS = 8000;

/**
 * Estimate one variant's size by fetching its media playlist straight from
 * the CDN (the same request the native service will make) and summing
 * EXTINF durations × bandwidth. `null` bytes = estimate unavailable;
 * `live: true` = no ENDLIST, so it can never be saved.
 */
// PROXY-ONLY (operator decision): estimate fetches ride the Aniraku proxy —
// direct device fetches are 403'd by the picky CDNs.
async function fetchViaProxy(url: string, headers: Record<string, string>, signal?: AbortSignal, method?: string): Promise<Response> {
  const proxy = anirakuProxyUrl(originalStreamUrl(url), headers);
  return fetch(proxy, { method: method ?? "GET", headers: anirakuProxyRequestHeaders(), signal });
}

async function estimateVariant(variantUrl: string, bandwidth: number, headers: Record<string, string>): Promise<Estimate> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ESTIMATE_TIMEOUT_MS);
  try {
    const response = await fetchViaProxy(variantUrl, headers, controller.signal);
    if (!response.ok) return { bytes: null, live: false };
    const text = await response.text();
    const parsed = parseMediaPlaylist(text);
    if (!parsed) return { bytes: null, live: false };
    if (!parsed.endList) return { bytes: null, live: true };
    return { bytes: estimateHlsSize(text, bandwidth), live: false };
  } catch {
    return { bytes: null, live: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Progressive (non-HLS) rows have no playlist to measure — HEAD-probe the
 * file for Content-Length instead, with the exact headers the real download
 * will use. `null` = the host does not answer a HEAD cleanly (or blocks it).
 */
async function probeDirectSize(sourceUrl: string, headers: Record<string, string>): Promise<Estimate> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ESTIMATE_TIMEOUT_MS);
  try {
    const response = await fetchViaProxy(sourceUrl, headers, controller.signal, "HEAD");
    if (!response.ok) return { bytes: null, live: false };
    const length = Number(response.headers?.get?.("content-length") ?? NaN);
    return { bytes: Number.isFinite(length) && length > 0 ? length : null, live: false };
  } catch {
    return { bytes: null, live: false };
  } finally {
    clearTimeout(timer);
  }
}

function estimateLabel(estimate: Estimate | undefined): string {
  if (!estimate) return "ESTIMATING…";
  if (estimate.live) return "LIVE — CANNOT SAVE";
  return estimate.bytes ? `~${formatBytes(estimate.bytes)}` : "SIZE UNKNOWN";
}

/** Exact quality match for the "current" dot: compares the height token so
 *  "1080p", "1080p · SAVED", and "1080p · AVC" all read as the same row. */
function qualityHeightToken(value?: string | null): string | null {
  return String(value ?? "").toLowerCase().match(/(2160|1440|1080|720|480|360)p/)?.[1] ?? null;
}

/**
 * The themed download quality sheet (Afterimage style): one row per quality
 * with an honest size estimate, storage projection, and the Wi-Fi-only hold
 * notice. Starting a download hands the job to the in-app queue — progress
 * lives in the Downloads hub.
 */
export function DownloadSheet({ visible, onClose, animeId, episode, language, title, options, headers, currentQuality, onStarted, onError }: DownloadSheetProps) {
  const prefs = useDownloadSettings();
  const network = useNetworkState();
  const [estimates, setEstimates] = useState<Record<string, Estimate>>({});
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const runIdRef = useRef(0);

  // Estimates use the exact headers the real download job will send
  // (downloadRequestHeaders), so a shown estimate can never diverge from the
  // fetch that actually runs.
  const estimateHeaders = useMemo(() => downloadRequestHeaders(headers), [headers]);
  const estimatedKeys = options.map((option) => option.key).join("|");

  useEffect(() => {
    if (!visible) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setEstimates({});
    void prefs.refresh();
    if (!options.length) return;
    void (async () => {
      const results = await Promise.all(options.map(async (option) => [
        option.key,
        option.variantUrl
          ? await estimateVariant(option.variantUrl, option.bandwidth ?? 0, estimateHeaders)
          : await probeDirectSize(option.source.url, estimateHeaders),
      ] as const));
      // A stale run (sheet reopened with new options) never overwrites fresh data.
      if (runIdRef.current !== runId) return;
      setEstimates(Object.fromEntries(results));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, estimatedKeys]);

  const start = async (option: DownloadSheetOption) => {
    if (startingKey) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStartingKey(option.key);
    try {
      await startMaximumQualityDownload({
        animeId, episode, language, title,
        source: option.source,
        variantUrl: option.variantUrl ?? null,
        variantQuality: option.quality,
        bandwidth: option.bandwidth,
        headers,
      });
      onStarted(option);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Download failed.");
    } finally {
      setStartingKey(null);
    }
  };

  const onCellular = network.type === NetworkStateType.CELLULAR || network.isConnected === false;
  const showWifiNotice = prefs.settings.wifiOnly && onCellular;
  const freeBytes = prefs.freeBytes;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, enter]);

  const estimateFor = (option: DownloadSheetOption): Estimate | undefined => estimates[option.key];
  const isLive = (option: DownloadSheetOption) => Boolean(option.variantUrl && estimateFor(option)?.live);

  return (
    <Modal visible={visible && options.length > 0} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.sheet, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] }]} accessibilityViewIsModal>
          <Text style={styles.kicker}>{`DOWNLOAD · EP ${episode} · ${language.toUpperCase()}`}</Text>
          <View style={styles.header}>
            <Text numberOfLines={2} style={styles.title}>{title}</Text>
            <Text style={styles.message}>Pick the quality to save for offline playback.</Text>
          </View>
          <View style={styles.divider} />
          {options.map((option) => {
            const estimate = estimateFor(option);
            const disabled = Boolean(startingKey) || isLive(option);
            const starting = startingKey === option.key;
            const currentToken = qualityHeightToken(currentQuality);
            const current = currentToken !== null && currentToken === qualityHeightToken(option.label);
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: current, disabled, busy: starting }}
                accessibilityLabel={`Download ${option.label} · ${estimateLabel(estimate)}`}
                disabled={disabled}
                onPress={() => void start(option)}
                style={({ pressed }) => [styles.optionRow, (pressed || starting) && styles.optionPressed, disabled && styles.optionDisabled]}
              >
                <Text numberOfLines={1} style={styles.optionLabel}>{option.label}</Text>
                <Text numberOfLines={1} style={[styles.optionSize, isLive(option) && styles.optionSizeAlert, starting && styles.optionSizeActive]}>
                  {starting ? "STARTING…" : estimateLabel(estimate)}
                </Text>
                {current ? <View style={styles.currentDot} /> : <AppIcon name="download" size={17} color={nothing.red} />}
              </Pressable>
            );
          })}
          <View style={styles.divider} />
          <View style={styles.footer}>
            <Text numberOfLines={1} style={styles.storageLine}>
              {freeBytes > 0 ? `${formatBytes(freeBytes)} FREE ON DEVICE` : "STORAGE SIZE UNAVAILABLE"}
            </Text>
            {showWifiNotice ? <Text numberOfLines={1} style={styles.wifiLine}>WI-FI ONLY — WILL START ON WI-FI</Text> : null}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 20, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.76)" },
  sheet: { gap: 0, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  kicker: { fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: nothing.red, paddingHorizontal: 14, paddingTop: 12 },
  header: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 5 },
  title: { color: nothing.white, fontSize: 16, fontWeight: "900", letterSpacing: -0.3, lineHeight: 21 },
  message: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  divider: { height: 1, backgroundColor: nothing.line, marginHorizontal: 10 },
  optionRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  optionPressed: { backgroundColor: nothing.raised },
  optionDisabled: { opacity: 0.5 },
  optionLabel: { flex: 1, color: nothing.white, fontSize: 15, fontWeight: "800" },
  optionSize: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  optionSizeAlert: { color: nothing.red },
  optionSizeActive: { color: nothing.white },
  currentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: nothing.red },
  footer: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, gap: 4 },
  storageLine: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  wifiLine: { color: nothing.red, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
});
