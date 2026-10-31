import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import * as Network from "expo-network";
import { Platform } from "react-native";
import { anirakuProxyRequestHeaders, anirakuProxyUrl, BROWSER_UA, getPlaybackType, isAnirakuProxyUrl, nativePlaybackHeaders, sourceVerification } from "@/lib/aniraku-api";
import { APP_CONFIG } from "@/lib/app-config";
import { estimateHlsSize, parseMediaPlaylist, resolveSegmentUrl, rewritePlaylistUris, unsupportedPlaylistReason, verifyPlaylistIntegrity } from "@/lib/downloads-hls";
import { nativeDownloads } from "@/lib/downloads-native";
import { originalStreamUrl } from "@/lib/hls-variants";
import { isAutoQuality } from "@/lib/watch-engine";
import type { StreamSource } from "@/lib/types";
import { filterExistingDownloadEntries, isDownloadableSource, publicDownloadFilename } from "@/lib/download-policy";

export { filterExistingDownloadEntries, isDownloadableSource, publicDownloadFilename, selectDownloadSourceForQuality, selectMaximumQualityDownload } from "@/lib/download-policy";

const INDEX_KEY = "aniraku.offline-downloads.v1";
/** Wi-Fi-only + storage-quota preferences for the queue (see DownloadSettings). */
const DOWNLOAD_SETTINGS_KEY = "aniraku.download-settings.v1";
/** App-private folder for progressive saves and HLS bundles alike. */
const APP_DOWNLOADS_DIRECTORY_NAME = "aniraku-downloads";
/** Root for offline HLS bundles: aniraku-offline/{entryId}/playlist.m3u8 + seg-*.ts + key.bin. */
const OFFLINE_BUNDLE_ROOT = "aniraku-offline";

const MEGABYTE = 1024 * 1024;
/** The queue runs one heavy transfer at a time so progress stays legible. */
const MAX_CONCURRENT_DOWNLOADS = 1;
const QUEUE_RETRY_MS = 5000;
const MAX_FINISHED_JOBS = 12;
const STAGED_STEP_MS = 800;
const STAGED_STEP = 0.06;
const STAGED_CAP = 0.9;
/** Kill a native job that has made no progress for 3 minutes (worst single-segment retry chain ≈ 100s). */
const NATIVE_STALL_MS = 180_000;
const NATIVE_STALL_CHECK_MS = 15_000;

export type OfflineDownload = { id: string; animeId: number; episode: number; title: string; quality: string; language: "sub" | "dub"; uri: string; downloadUrl: string; savedAt: number; size: number; subtitles?: OfflineSubtitleTrack[] };

function downloadId(animeId: number, episode: number, language: "sub" | "dub") {
  return `${animeId}:${episode}:${language}`;
}

async function readIndex(): Promise<OfflineDownload[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY).catch(() => null);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is OfflineDownload => item && typeof item.uri === "string" && typeof item.id === "string") : [];
  } catch {
    return [];
  }
}

async function writeIndex(entries: OfflineDownload[]) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function isOfflineSavingSupported() {
  return Platform.OS === "android";
}

export async function findOfflineDownload(animeId: number, episode: number, language: "sub" | "dub") {
  const entry = (await readIndex()).find((item) => item.id === downloadId(animeId, episode, language));
  if (!entry) return null;
  return new File(entry.uri).exists ? entry : null;
}

export async function listOfflineDownloads(): Promise<OfflineDownload[]> {
  return readIndex();
}

/**
 * Stale-index cleanup: on library/download list load, drop index entries
 * whose files are gone (removed outside the app). Returns what was pruned
 * so callers can no-op when nothing changed.
 */
export async function pruneStaleDownloads(): Promise<{ kept: OfflineDownload[]; removed: OfflineDownload[] }> {
  const entries = await readIndex();
  const { kept, removed } = filterExistingDownloadEntries(entries, (uri) => {
    try {
      return new File(uri).exists;
    } catch {
      return false;
    }
  });
  if (removed.length) await writeIndex(kept);
  // Bundle directories without an index row (interrupted jobs, entries
  // removed elsewhere) would otherwise leak storage forever — but a job that
  // is queued/downloading owns its dir before the index row exists.
  try {
    const root = new Directory(Paths.document, OFFLINE_BUNDLE_ROOT);
    if (root.exists) {
      const known = new Set(kept.map((item) => item.id));
      const activeEntryIds = new Set(
        queueJobs
          .filter((job) => job.state === "queued" || job.state === "downloading")
          .map((job) => queueInternals.get(job.id)?.request.entryId)
          .filter((id): id is string => Boolean(id)),
      );
      for (const child of root.list()) {
        if (child instanceof Directory && !known.has(child.name) && !activeEntryIds.has(child.name)) {
          try { child.delete(); } catch { /* best effort */ }
        }
      }
    }
  } catch { /* best effort */ }
  return { kept, removed };
}

/** Human-readable byte totals for the Downloads screen. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, exponent);
  const rounded = exponent === 0 || value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[exponent]}`;
}

// ── Wi-Fi-only + storage quota ────────────────────────────────────────────

export type DownloadSettings = { wifiOnly: boolean; quotaMb: number };
export const DEFAULT_DOWNLOAD_SETTINGS: DownloadSettings = { wifiOnly: false, quotaMb: 0 };

function normalizeSettings(raw: unknown): DownloadSettings {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<DownloadSettings>;
  const quotaMb = Number(parsed.quotaMb);
  return { wifiOnly: parsed.wifiOnly === true, quotaMb: Number.isFinite(quotaMb) && quotaMb > 0 ? Math.round(quotaMb) : 0 };
}

export async function getDownloadSettings(): Promise<DownloadSettings> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOAD_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_DOWNLOAD_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DOWNLOAD_SETTINGS };
  }
}

/** Persists under `aniraku.download-settings.v1` and re-evaluates the queue. */
export async function saveDownloadSettings(patch: Partial<DownloadSettings>): Promise<DownloadSettings> {
  const next = normalizeSettings({ ...(await getDownloadSettings()), ...patch });
  try { await AsyncStorage.setItem(DOWNLOAD_SETTINGS_KEY, JSON.stringify(next)); } catch { /* best effort */ }
  void pump();
  return next;
}

/** Bytes already committed to saved episodes — drives the quota display. */
export async function getOfflineStorageUsage(): Promise<number> {
  try {
    const entries = await listOfflineDownloads();
    return entries.reduce((total, entry) => total + (Number.isFinite(entry.size) && entry.size > 0 ? entry.size : 0), 0);
  } catch {
    return 0;
  }
}

/** Bytes still free on device (0 when the platform will not say). */
export function getFreeDiskSpace(): number {
  try {
    const free = Number(Paths.availableDiskSpace);
    return Number.isFinite(free) && free > 0 ? free : 0;
  } catch {
    return 0;
  }
}

/**
 * `quota` → already at/over the limit. `wifi` → Wi-Fi-only requested while the
 * connection is cellular or offline. Fail-open on lookup errors: a download
 * must never be bricked because AsyncStorage hiccupped.
 */
/** Quota/Wi-Fi hold resolver — exported for tests. */
export async function resolveDownloadHold(settings: DownloadSettings): Promise<DownloadJobHold> {
  if (settings.quotaMb > 0) {
    try {
      // Saved bytes plus what the running jobs will still write — a single
      // large download must not walk past the cap.
      const pending = [...pendingEstimates.values()].reduce((total, bytes) => total + bytes, 0);
      if (await getOfflineStorageUsage() + pending >= settings.quotaMb * MEGABYTE) return "quota";
    } catch { /* fail open */ }
  }
  if (settings.wifiOnly) {
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false) return "wifi";
      if (state.type === Network.NetworkStateType.CELLULAR) return "wifi";
    } catch { /* fail open */ }
  }
  return null;
}

function holdMessage(hold: Exclude<DownloadJobHold, null>) {
  return hold === "quota"
    ? "Storage limit reached. Raise or clear the limit in Downloads."
    : "Wi-Fi only downloads are on. Reconnect with Wi-Fi or turn it off in Downloads.";
}

// ── Queue ─────────────────────────────────────────────────────────────────

export type DownloadJobState = "queued" | "downloading" | "done" | "failed";
export type DownloadJobHold = "wifi" | "quota" | null;

export type OfflineDownloadJob = {
  id: string;
  animeId: number;
  episode: number;
  language: "sub" | "dub";
  title: string;
  quality: string;
  state: DownloadJobState;
  hold: DownloadJobHold;
  progress: number;
  receivedBytes: number;
  totalBytes: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  entry: OfflineDownload | null;
};

type DownloadRequest = {
  /** "hls" → native segment bundle; "file" → single progressive transfer. */
  kind: "file" | "hls";
  animeId: number;
  episode: number;
  language: "sub" | "dub";
  title: string;
  quality: string;
  filename: string;
  downloadUrl: string;
  /** CDN playback headers for the direct fetch (never persisted). */
  headers: Record<string, string>;
  /** The source's subtitle tracks, saved beside the video at download time. */
  subtitleTracks?: Array<{ url: string; label?: string; lang?: string }>;
  /** HLS only: direct CDN variant playlist URL and variant bandwidth. */
  playlistUrl?: string;
  bandwidth?: number;
  entryId: string;
  onProgress?: ((fraction: number) => void) | undefined;
};

type QueuedDownload = {
  job: OfflineDownloadJob;
  request: DownloadRequest;
  resolve: (entry: OfflineDownload) => void;
  reject: (error: Error) => void;
  cancelRequested: boolean;
  rampTimer: ReturnType<typeof setInterval> | null;
  legacyTask: { cancelAsync?: () => Promise<void> } | null;
  /** Native job id for the current attempt — fresh per retry so a stale
   * native cancel-flag can never poison the next attempt. */
  nativeId: string | null;
  attempt: number;
};

let queueJobs: OfflineDownloadJob[] = [];
const queueInternals = new Map<string, QueuedDownload>();
const queueListeners = new Set<() => void>();
let pumping = false;
let rerunPump = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let jobCounter = 0;

function notifyQueue() {
  queueListeners.forEach((listener) => {
    try { listener(); } catch { /* a broken subscriber must not stop the queue */ }
  });
}

export function getDownloadQueue(): OfflineDownloadJob[] {
  return queueJobs;
}

export function subscribeDownloadQueue(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => { queueListeners.delete(listener); };
}

function patchJob(id: string, patch: Partial<OfflineDownloadJob>) {
  const index = queueJobs.findIndex((job) => job.id === id);
  if (index < 0) return;
  const internal = queueInternals.get(id);
  const current = internal ? internal.job : queueJobs[index];
  const patched: OfflineDownloadJob = { ...current, ...patch };
  const changed = (Object.keys(patch) as (keyof OfflineDownloadJob)[]).some((key) => current[key] !== patched[key]);
  if (!changed) return;
  const next: OfflineDownloadJob = { ...patched, updatedAt: Date.now() };
  const copy = queueJobs.slice();
  copy[index] = next;
  queueJobs = copy;
  if (internal) internal.job = next;
  notifyQueue();
}

function removeJob(id: string) {
  const next = queueJobs.filter((job) => job.id !== id);
  if (next.length === queueJobs.length) return;
  queueJobs = next;
  queueInternals.delete(id);
  notifyQueue();
}

function trimFinishedJobs() {
  const finished = queueJobs.filter((job) => job.state === "done" || job.state === "failed");
  if (finished.length <= MAX_FINISHED_JOBS) return;
  const stale = new Set(finished.slice(0, finished.length - MAX_FINISHED_JOBS).map((job) => job.id));
  queueJobs = queueJobs.filter((job) => !stale.has(job.id));
  stale.forEach((id) => queueInternals.delete(id));
  notifyQueue();
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; void pump(); }, QUEUE_RETRY_MS);
}

function stopStagedProgress(internal: QueuedDownload) {
  if (!internal.rampTimer) return;
  clearInterval(internal.rampTimer);
  internal.rampTimer = null;
}

/**
 * expo-file-system only reports bytes for resumable (legacy) transfers. While
 * a direct transfer is running, walk a determinate-looking bar toward 90% so
 * the row never looks frozen; real byte counts stop it immediately.
 */
function startStagedProgress(internal: QueuedDownload) {
  stopStagedProgress(internal);
  let step = 0;
  internal.rampTimer = setInterval(() => {
    step += 1;
    applyProgress(internal, Math.min(STAGED_CAP, 0.08 + step * STAGED_STEP), 0, 0);
  }, STAGED_STEP_MS);
}

/**
 * `fraction` is undefined while bytes arrive without a known total: the bar
 * keeps its staged position but the byte counters still move.
 */
function applyProgress(internal: QueuedDownload, fraction: number | undefined, received: number, total: number) {
  const staged = internal.job.progress;
  const next = fraction !== undefined && Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : staged;
  if (received > 0 && total > 0) stopStagedProgress(internal);
  try { internal.request.onProgress?.(next); } catch { /* caller progress is best effort */ }
  patchJob(internal.job.id, {
    progress: next,
    receivedBytes: received > 0 ? received : internal.job.receivedBytes,
    totalBytes: total > 0 ? total : internal.job.totalBytes,
  });
}

function schedulePump() {
  if (pumping) { rerunPump = true; return; }
  void pump();
}

async function pump() {
  if (pumping) { rerunPump = true; return; }
  pumping = true;
  try {
    let hold = await resolveDownloadHold(await getDownloadSettings());
    for (;;) {
      if (hold) {
        const waiting = queueJobs.filter((job) => job.state === "queued");
        waiting.forEach((job) => patchJob(job.id, { hold }));
        if (waiting.length) scheduleRetry();
        break;
      }
      const active = queueJobs.filter((job) => job.state === "downloading").length;
      const batch = queueJobs.filter((job) => job.state === "queued").slice(0, Math.max(0, MAX_CONCURRENT_DOWNLOADS - active));
      if (!batch.length) break;
      await Promise.all(batch.map((job) => runJob(job.id)));
      hold = await resolveDownloadHold(await getDownloadSettings());
    }
  } catch {
    // A queue bookkeeping failure must never take the screen down.
  } finally {
    pumping = false;
    if (rerunPump) {
      rerunPump = false;
      schedulePump();
    } else if (queueJobs.some((job) => job.state === "queued" || job.state === "downloading")) {
      scheduleRetry();
    } else if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }
}

async function runJob(id: string) {
  const internal = queueInternals.get(id);
  if (!internal || internal.job.state !== "queued") return;
  // A fresh native id per attempt: the native service keys cancel-flags by
  // id, so reusing the queue id across retries would trip a leftover flag.
  internal.attempt += 1;
  internal.nativeId = `${id}#${internal.attempt}`;
  patchJob(id, { state: "downloading", hold: null, error: null, progress: 0, startedAt: Date.now() });
  try {
    const saved = internal.request.kind === "hls"
      ? await performHlsDownload(internal, {
        onStart: () => startStagedProgress(internal),
        onProgress: (fraction, received, total) => applyProgress(internal, fraction, received, total),
      })
      : await performDownload(internal, {
        onStart: () => startStagedProgress(internal),
        onProgress: (fraction, received, total) => applyProgress(internal, fraction, received, total),
      });
    if (internal.cancelRequested) {
      try {
        if (internal.request.kind === "hls") bundleDirectory(internal.request.entryId).delete();
        else new File(saved.uri).delete();
      } catch { /* already gone */ }
      throw new Error("Download cancelled.");
    }
    const size = Number(saved.size) || 0;
    patchJob(id, { state: "done", progress: 1, receivedBytes: size, totalBytes: size, entry: saved, finishedAt: Date.now() });
    try { internal.request.onProgress?.(1); } catch { /* best effort */ }
    internal.resolve(saved);
  } catch (cause) {
    const message = internal.cancelRequested ? "Download cancelled." : cause instanceof Error ? cause.message : "Download failed.";
    patchJob(id, { state: "failed", error: message, finishedAt: Date.now() });
    internal.reject(cause instanceof Error && !internal.cancelRequested ? cause : new Error(message));
  } finally {
    stopStagedProgress(internal);
    internal.legacyTask = null;
    pendingEstimates.delete(internal.request.entryId);
    trimFinishedJobs();
    notifyQueue();
  }
}

/** Cancel a queued job immediately; an in-flight transfer stops at completion. */
export function cancelDownloadJob(id: string) {
  const internal = queueInternals.get(id);
  if (!internal) return;
  if (internal.job.state === "done" || internal.job.state === "failed") return;
  internal.cancelRequested = true;
  if (internal.job.state === "queued") {
    internal.reject(new Error("Download cancelled."));
    removeJob(id);
    schedulePump();
    return;
  }
  if (internal.request.kind === "hls") {
    nativeDownloads.cancel(internal.nativeId ?? id);
    return;
  }
  const task = internal.legacyTask;
  if (task && typeof task.cancelAsync === "function") void task.cancelAsync().catch(() => {});
}

export function retryDownloadJob(id: string) {
  const internal = queueInternals.get(id);
  if (!internal || internal.job.state !== "failed") return;
  internal.cancelRequested = false;
  internal.nativeId = null;
  patchJob(id, { state: "queued", hold: null, error: null, progress: 0, receivedBytes: 0, totalBytes: 0, startedAt: null, finishedAt: null, entry: null });
  schedulePump();
}

export function dismissDownloadJob(id: string) {
  const job = queueJobs.find((item) => item.id === id);
  if (!job || job.state === "queued" || job.state === "downloading") return;
  removeJob(id);
}

// ── Transfers ─────────────────────────────────────────────────────────────

/**
 * `expo-file-system/legacy` still ships the resumable transfer that reports
 * incremental bytes. It is resolved lazily (and defensively): any bundling or
 * runtime problem degrades to the direct transfer instead of breaking saves.
 */
let legacyModule: { createDownloadResumable?: (...args: any[]) => any } | null = null;
let legacyResolved = false;
function legacyFileSystem() {
  if (!legacyResolved) {
    legacyResolved = true;
    try {
      legacyModule = require("expo-file-system/legacy");
    } catch {
      legacyModule = null;
    }
  }
  return legacyModule;
}

async function legacyDownload(legacy: NonNullable<typeof legacyModule>, url: string, destination: File, headers: Record<string, string>, onBytes: (received: number, total: number) => void, onTask: (task: QueuedDownload["legacyTask"]) => void) {
  const task = legacy.createDownloadResumable!(url, destination.uri, { headers }, (progress: { totalBytesWritten?: number; expectedTotalBytes?: number } | null | undefined) => {
    const received = Number(progress?.totalBytesWritten);
    const total = Number(progress?.expectedTotalBytes);
    if (Number.isFinite(received) && received > 0) onBytes(received, Number.isFinite(total) && total > 0 ? total : 0);
  });
  onTask(task);
  const result = await task.downloadAsync?.();
  const status = Number(result?.status);
  if (!result?.uri || !(status >= 200 && status < 300) || !destination.exists || !destination.size) {
    throw new Error("The transfer did not finish.");
  }
}

/**
 * Best-effort progress: real byte counts when the resumable API can write to
 * the destination, otherwise the plain transfer (staged progress upstream).
 * A cancel that lands between the two transfer paths must stop the job —
 * falling through would start a second, un-cancellable download.
 */
async function transfer(url: string, destination: File, headers: Record<string, string>, onBytes: (received: number, total: number) => void, onTask: (task: QueuedDownload["legacyTask"]) => void, isCancelled: () => boolean) {
  // PROXY-ONLY (operator decision): provider CDNs 403 direct device fetches,
  // so the bytes stream through the Aniraku proxy with the browser identity.
  // The proxy hop has no resume support — progress streams from the body.
  const proxied = anirakuProxyUrl(url, headers);
  const response = await fetch(proxied, { headers: anirakuProxyRequestHeaders() });
  if (!response.ok) {
    throw new Error(`Source returned ${response.status}.`);
  }
  if (!response.body) throw new Error("The source sent an empty response.");
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  await destination.create({ intermediates: true });
  let received = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      if (isCancelled()) { reader.cancel(); throw new Error("Download cancelled."); }
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onBytes(received, total);
    }
    destination.write(new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer()));
    if (received <= 0) throw new Error("A segment arrived empty.");
  } catch (cause) {
    try { if (destination.exists) destination.delete(); } catch { /* best effort */ }
    throw cause;
  }
}

function appStorageDirectory(): Directory {
  const directory = new Directory(Paths.document, APP_DOWNLOADS_DIRECTORY_NAME);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

type TransferCallbacks = { onStart: () => void; onProgress: (fraction: number | undefined, received: number, total: number) => void };

/** App-private bundle directory for one offline HLS download. */
function bundleDirectory(entryId: string): Directory {
  return new Directory(new Directory(Paths.document, OFFLINE_BUNDLE_ROOT), entryId);
}

/**
 * Progressive sources have no manifest to size from — probe Content-Length
 * with HEAD. A CDN that refuses the probe fails open; the transfer's own
 * error handling covers the rest.
 */
async function preflightProgressiveSpace(request: DownloadRequest) {
  try {
    const response = await fetch(anirakuProxyUrl(request.downloadUrl, request.headers), { method: "HEAD", headers: anirakuProxyRequestHeaders() });
    const length = Number(response.headers.get("content-length"));
    if (!response.ok || !Number.isFinite(length) || length <= 0) return;
    pendingEstimates.set(request.entryId, length);
    const free = getFreeDiskSpace();
    if (free > 0 && free < length * 1.15) throw new Error("Not enough space for this download. Free up space or pick a lower quality.");
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Not enough space")) throw cause;
  }
}

async function performDownload(internal: QueuedDownload, callbacks: TransferCallbacks): Promise<OfflineDownload> {
  const request = internal.request;
  const onBytes = (received: number, total: number) => callbacks.onProgress(total > 0 ? Math.min(0.99, received / total) : undefined, received, total);
  const onTask = (task: QueuedDownload["legacyTask"]) => { internal.legacyTask = task; };

  callbacks.onStart();
  const directory = appStorageDirectory();
  // The entryId prefix keeps same-title anime from colliding on one file.
  const destination = new File(directory, `${request.entryId}-${request.filename}`);
  if (destination.exists) destination.delete();
  await preflightProgressiveSpace(request);
  try {
    await transfer(request.downloadUrl, destination, request.headers, onBytes, onTask, () => internal.cancelRequested);
  } catch (cause) {
    try { if (destination.exists) destination.delete(); } catch { /* best effort */ }
    throw cause;
  }
  if (!destination.exists || !destination.size) throw new Error("The download could not be saved on this device.");
  callbacks.onProgress(1, Number(destination.size) || 0, Number(destination.size) || 0);

  const subtitles = await saveSubtitleTracks({ tracks: request.subtitleTracks, entryId: request.entryId, headers: request.headers, directory });
  const entry: OfflineDownload = { id: request.entryId, animeId: request.animeId, episode: request.episode, title: request.title, quality: request.quality, language: request.language, uri: destination.uri, downloadUrl: "", savedAt: Date.now(), size: Number(destination.size) || 0, subtitles };
  const index = await readIndex();
  await writeIndex([entry, ...index.filter((item) => item.id !== entry.id)]);
  return entry;
}

// ── Native HLS bundle jobs ─────────────────────────────────────────────────

type NativeJobHandle = {
  resolve: (result: { segments: string[]; keyPath: string | null; bytes: number }) => void;
  reject: (error: Error) => void;
  onProgress: (received: number, total: number) => void;
  cleanup: () => void;
};

const nativeJobs = new Map<string, NativeJobHandle>();
/** Estimated bytes of active jobs — charged against the quota hold while they run. */
const pendingEstimates = new Map<string, number>();

function runNativeJob(id: string, options: { dir: string; base: string; title: string; headers: string; estimatedBytes: number; proxyBase?: string }, hooks: { onProgress: (received: number, total: number) => void }): Promise<{ segments: string[]; keyPath: string | null; bytes: number }> {
  return new Promise((resolve, reject) => {
    let lastProgressAt = Date.now();
    const progressUnsub = nativeDownloads.onProgress((progress) => {
      if (progress.id !== id) return;
      lastProgressAt = Date.now();
      try { hooks.onProgress(progress.receivedBytes, progress.totalBytes); } catch { /* best effort */ }
    });
    const stateUnsub = nativeDownloads.onState((result) => {
      if (result.id !== id) return;
      const handle = nativeJobs.get(id);
      if (!handle) return;
      handle.cleanup();
      if (result.state === "complete" && result.segments) {
        handle.resolve({ segments: result.segments, keyPath: result.keyPath ?? null, bytes: result.bytes ?? 0 });
      } else {
        handle.reject(new Error(result.reason || "Download failed."));
      }
    });
    const handle: NativeJobHandle = {
      resolve,
      reject,
      onProgress: hooks.onProgress,
      cleanup: () => { progressUnsub(); stateUnsub(); nativeJobs.delete(id); clearInterval(watchdog); },
    };
    nativeJobs.set(id, handle);
    // START_NOT_STICKY means a killed service never sends a terminal event —
    // the promise must not stay pending and block the single queue slot.
    const watchdog = setInterval(() => {
      if (Date.now() - lastProgressAt <= NATIVE_STALL_MS) return;
      handle.cleanup();
      nativeDownloads.cancel(id);
      reject(new Error("The download stopped responding."));
    }, NATIVE_STALL_CHECK_MS);
    try {
      nativeDownloads.enqueue({ id, ...options });
    } catch (cause) {
      handle.cleanup();
      reject(cause instanceof Error ? cause : new Error("The download service is not available in this build."));
    }
  });
}

/**
 * Offline HLS bundle: JS validates + stages the variant playlist, the native
 * service fetches key + segments straight from the CDN with the playback
 * headers, then JS rewrites every URI to file:// and verifies the bundle.
 * Any failure deletes the directory — a half-pointing playlist never exists.
 */
async function performHlsDownload(internal: QueuedDownload, callbacks: TransferCallbacks): Promise<OfflineDownload> {
  const request = internal.request;
  const playlistUrl = request.playlistUrl ?? "";
  const dir = bundleDirectory(request.entryId);
  try {
    callbacks.onStart();
    if (dir.exists) dir.delete();
    dir.create({ intermediates: true, idempotent: true });

    // PROXY-ONLY (operator decision): fetch the playlist through the Aniraku
    // proxy with the browser identity.
    const response = await fetch(anirakuProxyUrl(playlistUrl, request.headers), { headers: anirakuProxyRequestHeaders() });
    if (!response.ok) throw new Error(`Source returned ${response.status}.`);
    const text = await response.text();
    const parsed = parseMediaPlaylist(text);
    if (!parsed) throw new Error("This stream could not be read for download.");
    if (!parsed.endList) throw new Error("Live or endless streams cannot be saved.");
    const unsupported = unsupportedPlaylistReason(text);
    if (unsupported) throw new Error(unsupported);

    const estimated = estimateHlsSize(text, request.bandwidth ?? 0);
    if (estimated) pendingEstimates.set(request.entryId, estimated);
    if (estimated) {
      const free = getFreeDiskSpace();
      if (free > 0 && free < estimated * 1.15) throw new Error("Not enough space for this download. Free up space or pick a lower quality.");
    }

    new File(dir, "source.m3u8").write(text);
    // Subtitles are tiny — stage them beside the bundle while the video runs.
    const savedSubtitles = await saveSubtitleTracks({ tracks: request.subtitleTracks, entryId: request.entryId, headers: request.headers, directory: dir });
    const result = await runNativeJob(internal.nativeId ?? internal.job.id, {
      dir: dir.uri,
      base: playlistUrl,
      title: internal.job.title,
      headers: JSON.stringify(request.headers),
      estimatedBytes: estimated ?? 0,
      proxyBase: APP_CONFIG.apiBaseUrl,
    }, {
      onProgress: (received, total) => callbacks.onProgress(total > 0 ? Math.min(0.99, received / total) : undefined, received, total),
    });

    // Map absolute CDN URIs → the native writer's file paths, in playlist order.
    const map = new Map<string, string>();
    parsed.segments.forEach((segment, position) => {
      const absolute = resolveSegmentUrl(segment.uri, playlistUrl);
      const local = result.segments[position];
      if (absolute && local) map.set(absolute, local);
    });
    if (parsed.keyUri) {
      const absoluteKey = resolveSegmentUrl(parsed.keyUri, playlistUrl);
      if (absoluteKey && result.keyPath) map.set(absoluteKey, result.keyPath);
    }
    const rewritten = rewritePlaylistUris(text, { baseUrl: playlistUrl, mapUri: (url) => map.get(url) ?? null });
    if (!rewritten) throw new Error("The saved copy is incomplete.");

    const playlistFile = new File(dir, "playlist.m3u8");
    playlistFile.write(rewritten);
    if (!verifyPlaylistIntegrity(rewritten, (uri) => {
      try { return new File(uri).exists; } catch { return false; }
    })) {
      throw new Error("The saved copy failed its integrity check.");
    }
    // source.m3u8 carries provider URLs (possibly tokenized) — the rewritten
    // playlist replaces it, so the provider copy does not stay on disk.
    try { new File(dir, "source.m3u8").delete(); } catch { /* best effort */ }

    callbacks.onProgress(1, result.bytes, result.bytes);
    const entry: OfflineDownload = { id: request.entryId, animeId: request.animeId, episode: request.episode, title: request.title, quality: request.quality, language: request.language, uri: playlistFile.uri, downloadUrl: "", savedAt: Date.now(), size: result.bytes, subtitles: savedSubtitles };
    const index = await readIndex();
    await writeIndex([entry, ...index.filter((item) => item.id !== entry.id)]);
    return entry;
  } catch (cause) {
    try { dir.delete(); } catch { /* best effort cleanup */ }
    throw cause instanceof Error ? cause : new Error("Download failed.");
  }
}

// ── Public entry point ────────────────────────────────────────────────────

export type StartDownloadInput = { animeId: number; episode: number; language: "sub" | "dub"; title: string; source: StreamSource; variantUrl?: string | null; variantQuality?: string | null; bandwidth?: number; headers?: Record<string, string>; onProgress?: (fraction: number) => void };

/** Request builder — exported for tests. */
export function buildDownloadRequest(input: StartDownloadInput): DownloadRequest {
  const explicitUrl = String(input.variantUrl ?? "").trim() || null;
  const useExplicit = Boolean(explicitUrl && /^https:\/\//i.test(explicitUrl));
  if (explicitUrl && !useExplicit) throw new Error("The selected quality offered an unusable download URL.");
  const headers = downloadRequestHeaders(input.headers);
  // Provider credentials must never ride a download job to the CDN — such
  // sources stay proxied for playback and are not downloadable (threat model).
  if (Object.keys(headers).some((key) => key.toLowerCase() === "authorization")) {
    throw new Error("This source cannot be downloaded directly.");
  }
  const entryId = downloadId(input.animeId, input.episode, input.language);

  // HLS variants become segment bundles via the native service — this is the
  // capability the old policy refused; embed/dead sources stay refused.
  const directUrl = useExplicit ? explicitUrl as string : input.source.url;
  const isHls = /\.m3u8($|[?#])/i.test(directUrl) || /mpegurl/i.test(String(input.source.mime || input.source.type || ""));
  if (isHls) {
    // The URL/mime gate above already establishes this is an HLS stream —
    // requiring getPlaybackType === "native" here refused EVERY HLS download
    // (an m3u8 source types as "hls", never "native"). Embed/dead stay refused.
    if (sourceVerification(input.source) === "dead") {
      throw new Error("This provider's stream cannot be downloaded.");
    }
    // A proxied wrapper hides the real CDN URL — unwrap it so the service
    // fetches segments directly (ADR-003); headers stay in memory only.
    const playlistUrl = originalStreamUrl(directUrl);
    if (!/^https:\/\//i.test(playlistUrl)) throw new Error("This source cannot be downloaded directly.");
    const quality = String(input.variantQuality ?? "").trim() || input.source.quality || "VARIANT";
    return { kind: "hls", animeId: input.animeId, episode: input.episode, language: input.language, title: input.title, quality, filename: "", downloadUrl: "", headers, subtitleTracks: input.source.subtitles, playlistUrl, bandwidth: Math.max(0, Math.round(Number(input.bandwidth ?? 0)) || 0), entryId, onProgress: input.onProgress };
  }

  if (!useExplicit && !isDownloadableSource(input.source)) throw new Error("This provider only offers adaptive, embedded, or protected playback. A direct progressive source is required for downloading.");
  // Proxied progressive sources unwrap to their CDN URL so the server stays
  // out of the download path (ADR-003).
  const fileUrl = originalStreamUrl(directUrl);
  if (!/^https:\/\//i.test(fileUrl)) throw new Error("This source cannot be downloaded directly.");
  const quality = useExplicit
    ? (String(input.variantQuality ?? "").trim() || input.source.quality || "VARIANT")
    : (isAutoQuality(input.source) ? "ORIGINAL DIRECT" : input.source.quality || "DIRECT");
  const filename = publicDownloadFilename(input.title, input.episode, input.language, quality, input.source);
  // Direct CDN fetch with playback headers — the download relay retires (ADR-003).
  return { kind: "file", animeId: input.animeId, episode: input.episode, language: input.language, title: input.title, quality, filename, downloadUrl: fileUrl, headers, subtitleTracks: input.source.subtitles, entryId, onProgress: input.onProgress };
}

/**
 * Starts an offline download through the in-app queue. HLS variants become
 * native segment bundles (playlist + segments + AES-128 key, app-private);
 * progressive sources keep the single-file transfer, now fetched straight
 * from the CDN with the playback headers (ADR-003). External download links
 * are gone — in-app or not at all (ADR-004).
 */
export async function startMaximumQualityDownload(input: StartDownloadInput): Promise<OfflineDownload> {
  if (!APP_CONFIG.downloadsNativeEnabled) throw new Error("Downloads are temporarily disabled in this build.");
  if (!isOfflineSavingSupported()) throw new Error("Downloads are available on Android devices.");
  // Fire-and-forget: Android 13+ needs POST_NOTIFICATIONS granted or the
  // progress affordance is silently dropped; waiting is not worth it.
  void requestDownloadNotificationPermission().catch(() => { /* best effort */ });
  const request = buildDownloadRequest(input);
  // Synchronous claim so two rapid taps cannot both pass the active check
  // below and cross-delete each other's bundle directory.
  if (startingEntries.has(request.entryId)) throw new Error("This episode is already downloading.");
  startingEntries.add(request.entryId);
  try {
    // One bundle directory per entryId — a second concurrent job would delete
    // the first job's files. Refuse while active; a finished download supersedes.
    const active = queueJobs.find((job) => (job.state === "queued" || job.state === "downloading") && queueInternals.get(job.id)?.request.entryId === request.entryId);
    if (active) throw new Error("This episode is already downloading.");
    const settings = await getDownloadSettings();
    const hold = await resolveDownloadHold(settings);
    // The hold check must precede the supersede: a refusal must never have
    // destroyed the episode's existing offline copy.
    if (hold) throw new Error(holdMessage(hold));
    const existing = await findOfflineDownload(input.animeId, input.episode, input.language);
    if (existing) await removeOfflineDownload(existing);
    return await enqueueDownload(request);
  } finally {
    startingEntries.delete(request.entryId);
  }
}

/** Runtime app identity for the download header fallbacks (app.config.ts stays the source of truth). */
const ANDROID_PACKAGE_ID = "aniraku.anime.app";

/**
 * Download requests identify the app the same way playback does: the
 * provider's playback headers ride along, plus the app package marker and a
 * browser UA fallback — UA-locked CDNs reject app-style UAs
 * ("Aniraku/x.y") outright, while the browser identity passes (verified live
 * against settlar-style hosts).
 */
export function downloadRequestHeaders(providerHeaders?: Record<string, string>) {
  const headers = { ...(nativePlaybackHeaders(providerHeaders) ?? {}) };
  const keys = Object.keys(headers);
  const hasHeader = (name: string) => keys.some((key) => key.toLowerCase() === name);
  if (!hasHeader("x-requested-with")) headers["X-Requested-With"] = ANDROID_PACKAGE_ID;
  if (!hasHeader("user-agent")) headers["User-Agent"] = BROWSER_UA;
  return headers;
}

/**
 * Android 13+ drops the download-service progress notification until
 * POST_NOTIFICATIONS is granted. A denial never blocks the download — it
 * only means no progress affordance.
 */
async function requestDownloadNotificationPermission() {
  if (Platform.OS !== "android") return;
  const version = typeof Platform.Version === "number" ? Platform.Version : parseFloat(String(Platform.Version ?? ""));
  if (!Number.isFinite(version) || version < 33) return;
  const Notifications = await import("expo-notifications");
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return;
  await Notifications.requestPermissionsAsync();
}

export type OfflineSubtitleTrack = { lang?: string; label?: string; file: string };

/**
 * Offline bundles carry the episode's subtitle tracks so saved copies keep
 * captions. Fetched with the same download headers (Referer/UA apply); a
 * failed track is skipped — subtitles are optional, video is not.
 */
async function saveSubtitleTracks(options: {
  tracks: Array<{ url: string; label?: string; lang?: string }> | undefined;
  entryId: string;
  headers: Record<string, string>;
  directory: Directory;
  onProgress?: (fraction: number) => void;
}): Promise<OfflineSubtitleTrack[]> {
  const saved: OfflineSubtitleTrack[] = [];
  for (const [position, track] of (options.tracks ?? []).entries()) {
    if (!track?.url || !/^https?:\/\//i.test(track.url)) continue;
    const extension = /\.srt(?:$|[?#])/i.test(track.url) ? "srt" : "vtt";
    try {
      const alreadyProxied = isAnirakuProxyUrl(track.url);
      const response = await fetch(alreadyProxied ? track.url : anirakuProxyUrl(track.url, options.headers)).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); });
      const file = new File(options.directory, `${options.entryId}-sub-${position}.${extension}`);
      file.write(response);
      saved.push({ lang: track.lang, label: track.label, file: file.uri });
    } catch { /* skipped track */ }
  }
  return saved;
}

/** entryIds claimed by in-flight start calls — closes the double-enqueue race. */
const startingEntries = new Set<string>();

function enqueueDownload(request: DownloadRequest): Promise<OfflineDownload> {
  jobCounter += 1;
  const id = `job-${Date.now().toString(36)}-${jobCounter}`;
  let resolveJob!: (entry: OfflineDownload) => void;
  let rejectJob!: (error: Error) => void;
  const promise = new Promise<OfflineDownload>((resolve, reject) => { resolveJob = resolve; rejectJob = reject; });
  const internal: QueuedDownload = {
    job: { id, animeId: request.animeId, episode: request.episode, language: request.language, title: request.title, quality: request.quality, state: "queued", hold: null, progress: 0, receivedBytes: 0, totalBytes: 0, error: null, createdAt: Date.now(), updatedAt: Date.now(), startedAt: null, finishedAt: null, entry: null },
    request,
    resolve: resolveJob,
    reject: rejectJob,
    cancelRequested: false,
    rampTimer: null,
    legacyTask: null,
    nativeId: null,
    attempt: 0,
  };
  queueInternals.set(id, internal);
  queueJobs = [...queueJobs, internal.job];
  notifyQueue();
  schedulePump();
  // The queue can reject a job (cancel, gate, transfer error) before the
  // caller attaches its handlers — keep one handler resident so a rejected
  // queue promise never surfaces as an unhandled rejection.
  promise.catch(() => {});
  return promise;
}

export async function removeOfflineDownload(entry: OfflineDownload) {
  try {
    if (entry.uri.endsWith(".m3u8")) {
      // An HLS bundle owns its whole directory — remove it as one unit.
      const bundle = new File(entry.uri).parentDirectory;
      if (bundle.exists) bundle.delete();
    } else {
      new File(entry.uri).delete();
    }
  } catch {}
  await writeIndex((await readIndex()).filter((item) => item.id !== entry.id));
}
