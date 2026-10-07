import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import * as Network from "expo-network";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { anirakuDownloadUrl, nativePlaybackHeaders } from "@/lib/aniraku-api";
import { isAutoQuality } from "@/lib/watch-engine";
import type { StreamSource } from "@/lib/types";
import { downloadLabel, filterExistingDownloadEntries, isDownloadableSource, publicDownloadFilename, selectDownloadSourceForQuality, selectMaximumQualityDownload } from "@/lib/download-policy";

export { downloadLabel, filterExistingDownloadEntries, isDownloadableSource, publicDownloadFilename, selectDownloadSourceForQuality, selectMaximumQualityDownload } from "@/lib/download-policy";
export { buildBackendDownloadOptions, hasQualityBackendDownloads, parseBackendDownloadQuality, sortBackendDownloadOptions, type BackendDownloadOption } from "@/lib/download-policy";

const INDEX_KEY = "aniraku.offline-downloads.v1";
const PUBLIC_DOWNLOADS_DIRECTORY_KEY = "aniraku.public-downloads-directory.v1";
/** Wi-Fi-only + storage-quota preferences for the queue (see DownloadSettings). */
const DOWNLOAD_SETTINGS_KEY = "aniraku.download-settings.v1";
/** App-private folder used when the public Downloads folder rejects the write. */
const APP_DOWNLOADS_DIRECTORY_NAME = "aniraku-downloads";

const MEGABYTE = 1024 * 1024;
/** The queue runs one heavy transfer at a time so progress stays legible. */
const MAX_CONCURRENT_DOWNLOADS = 1;
const QUEUE_RETRY_MS = 5000;
const MAX_FINISHED_JOBS = 12;
const STAGED_STEP_MS = 800;
const STAGED_STEP = 0.06;
const STAGED_CAP = 0.9;

export type OfflineDownload = { id: string; animeId: number; episode: number; title: string; quality: string; language: "sub" | "dub"; uri: string; downloadUrl: string; savedAt: number; size: number };

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

async function publicDownloadsDirectory(forcePicker = false) {
  if (Platform.OS !== "android") throw new Error("Public Downloads saving is available on Android devices.");
  const storedUri = await AsyncStorage.getItem(PUBLIC_DOWNLOADS_DIRECTORY_KEY).catch(() => null);
  if (storedUri && !forcePicker) return { directory: new Directory(storedUri), reused: true };
  try {
    const picked = await Directory.pickDirectoryAsync();
    const chosen = new Directory(picked.uri);
    await AsyncStorage.setItem(PUBLIC_DOWNLOADS_DIRECTORY_KEY, chosen.uri);
    return { directory: chosen, reused: false };
  } catch {
    throw new Error("Choose your Android Downloads folder to save this video.");
  }
}

function storedDirectoryAccessError(cause: unknown) {
  const message = cause instanceof Error ? cause.message.toLowerCase() : String(cause).toLowerCase();
  return /permission|access|content uri|security|not found|does not exist/.test(message);
}

/**
 * SAF (content://) destinations only expose the whole-file `write` path in this
 * build of expo-file-system, so the direct transfer can refuse them. Detected
 * here so the save can degrade to app storage instead of failing outright.
 */
function isContentUriWriteError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /content uri/i.test(message);
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
async function resolveDownloadHold(settings: DownloadSettings): Promise<DownloadJobHold> {
  if (settings.quotaMb > 0) {
    try {
      if (await getOfflineStorageUsage() >= settings.quotaMb * MEGABYTE) return "quota";
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
  animeId: number;
  episode: number;
  language: "sub" | "dub";
  title: string;
  quality: string;
  filename: string;
  downloadUrl: string;
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
  patchJob(id, { state: "downloading", hold: null, error: null, progress: 0, startedAt: Date.now() });
  try {
    const saved = await performDownload(internal, {
      onStart: () => startStagedProgress(internal),
      onProgress: (fraction, received, total) => applyProgress(internal, fraction, received, total),
    });
    if (internal.cancelRequested) {
      try { new File(saved.uri).delete(); } catch { /* already gone */ }
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
  const task = internal.legacyTask;
  if (task && typeof task.cancelAsync === "function") void task.cancelAsync().catch(() => {});
}

export function retryDownloadJob(id: string) {
  const internal = queueInternals.get(id);
  if (!internal || internal.job.state !== "failed") return;
  internal.cancelRequested = false;
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

async function legacyDownload(legacy: NonNullable<typeof legacyModule>, url: string, destination: File, onBytes: (received: number, total: number) => void, onTask: (task: QueuedDownload["legacyTask"]) => void) {
  const task = legacy.createDownloadResumable!(url, destination.uri, undefined, (progress: { totalBytesWritten?: number; expectedTotalBytes?: number } | null | undefined) => {
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
 */
async function transfer(url: string, destination: File, onBytes: (received: number, total: number) => void, onTask: (task: QueuedDownload["legacyTask"]) => void) {
  const legacy = legacyFileSystem();
  if (destination.uri.startsWith("file://") && legacy && typeof legacy.createDownloadResumable === "function") {
    try {
      await legacyDownload(legacy, url, destination, onBytes, onTask);
      return;
    } catch {
      try { if (destination.exists) destination.delete(); } catch { /* partial file dropped */ }
    }
  }
  await File.downloadFileAsync(url, destination, { idempotent: true });
}

function appStorageDirectory(): Directory {
  const directory = new Directory(Paths.document, APP_DOWNLOADS_DIRECTORY_NAME);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

type TransferCallbacks = { onStart: () => void; onProgress: (fraction: number | undefined, received: number, total: number) => void };

async function performDownload(internal: QueuedDownload, callbacks: TransferCallbacks): Promise<OfflineDownload> {
  const request = internal.request;
  const onBytes = (received: number, total: number) => callbacks.onProgress(total > 0 ? Math.min(0.99, received / total) : undefined, received, total);
  const onTask = (task: QueuedDownload["legacyTask"]) => { internal.legacyTask = task; };

  const saveInto = async (directory: Directory): Promise<File> => {
    callbacks.onStart();
    const destination = new File(directory, request.filename);
    if (destination.exists) destination.delete();
    try {
      await transfer(request.downloadUrl, destination, onBytes, onTask);
    } catch (cause) {
      if (!isContentUriWriteError(cause)) throw cause;
      return saveToAppStorage(cause);
    }
    if (!destination.exists || !destination.size) throw new Error("Android could not save the file to Downloads.");
    callbacks.onProgress(1, Number(destination.size) || 0, Number(destination.size) || 0);
    return destination;
  };

  // The public folder cannot accept this write (SAF content URI): keep the
  // episode offline in app storage rather than failing the whole download.
  const saveToAppStorage = async (cause: unknown): Promise<File> => {
    try {
      callbacks.onStart();
      const directory = appStorageDirectory();
      const destination = new File(directory, request.filename);
      if (destination.exists) destination.delete();
      await transfer(request.downloadUrl, destination, onBytes, onTask);
      if (!destination.exists || !destination.size) throw new Error("The download could not be saved on this device.");
      callbacks.onProgress(1, Number(destination.size) || 0, Number(destination.size) || 0);
      return destination;
    } catch (fallbackCause) {
      throw fallbackCause instanceof Error ? fallbackCause : cause instanceof Error ? cause : new Error("Download failed.");
    }
  };

  let selection = await publicDownloadsDirectory();
  let saved: File;
  try {
    saved = await saveInto(selection.directory);
  } catch (cause) {
    if (!selection.reused || !storedDirectoryAccessError(cause)) throw cause;
    await AsyncStorage.removeItem(PUBLIC_DOWNLOADS_DIRECTORY_KEY).catch(() => {});
    selection = await publicDownloadsDirectory(true);
    saved = await saveInto(selection.directory);
  }

  const entry: OfflineDownload = { id: request.entryId, animeId: request.animeId, episode: request.episode, title: request.title, quality: request.quality, language: request.language, uri: saved.uri, downloadUrl: request.downloadUrl, savedAt: Date.now(), size: Number(saved.size) || 0 };
  const index = await readIndex();
  await writeIndex([entry, ...index.filter((item) => item.id !== entry.id)]);
  return entry;
}

// ── Public entry point ────────────────────────────────────────────────────

export type StartDownloadInput = { animeId: number; episode: number; language: "sub" | "dub"; title: string; source: StreamSource; variantUrl?: string | null; variantQuality?: string | null; headers?: Record<string, string>; onProgress?: (fraction: number) => void };

function buildDownloadRequest(input: StartDownloadInput): DownloadRequest {
  const explicitUrl = String(input.variantUrl ?? "").trim() || null;
  const useExplicit = Boolean(explicitUrl && /^https:\/\//i.test(explicitUrl));
  if (explicitUrl && !useExplicit) throw new Error("The selected quality offered an unusable download URL.");
  if (!useExplicit && !isDownloadableSource(input.source)) throw new Error("This provider only offers adaptive, embedded, or protected playback. A direct progressive source is required for downloading.");
  const quality = useExplicit
    ? (String(input.variantQuality ?? "").trim() || input.source.quality || "VARIANT")
    : (isAutoQuality(input.source) ? "ORIGINAL DIRECT" : input.source.quality || "DIRECT");
  const filename = publicDownloadFilename(input.title, input.episode, input.language, quality, input.source);
  const proxyHeaders = nativePlaybackHeaders(input.headers);
  const downloadUrl = anirakuDownloadUrl(useExplicit ? explicitUrl as string : input.source.url, proxyHeaders);
  return { animeId: input.animeId, episode: input.episode, language: input.language, title: input.title, quality, filename, downloadUrl, entryId: downloadId(input.animeId, input.episode, input.language), onProgress: input.onProgress };
}

/**
 * Downloads via the backend proxy endpoint which handles CDN headers, CORS,
 * and authentication. The backend streams the file through /api/v1/download
 * so the client never touches the raw CDN URL.
 *
 * When `variantUrl` carries the parsed HLS variant for the chosen height,
 * that exact rendition is fetched — never the master's highest guess. The
 * max-guess `source` remains the fallback (and still supplies the filename)
 * when no parsed variant is available.
 *
 * The transfer itself runs through the in-app queue (one at a time) so the
 * Downloads screen can show queued/downloading/done state, hold jobs that are
 * blocked by the Wi-Fi-only or storage-quota setting, and report byte totals.
 */
export async function startMaximumQualityDownload(input: StartDownloadInput): Promise<OfflineDownload> {
  const request = buildDownloadRequest(input);
  // iOS (and web) have no public Downloads directory: report it up front
  // instead of queueing a job that can never run.
  if (!isOfflineSavingSupported()) throw new Error("Public Downloads saving is available on Android devices.");
  const settings = await getDownloadSettings();
  const hold = await resolveDownloadHold(settings);
  if (hold) throw new Error(holdMessage(hold));
  return enqueueDownload(request);
}

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

/**
 * Returns the backend-served download URL for a source. This can be opened
 * in a browser, shared, or used with expo-sharing directly.
 */
export function getDownloadLink(source: StreamSource, headers?: Record<string, string>): string {
  return anirakuDownloadUrl(source.url, nativePlaybackHeaders(headers));
}

export async function removeOfflineDownload(entry: OfflineDownload) {
  try { new File(entry.uri).delete(); } catch {}
  await writeIndex((await readIndex()).filter((item) => item.id !== entry.id));
}

export async function shareOfflineDownload(entry: OfflineDownload) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing downloaded episodes is unavailable on this device.");
  await Sharing.shareAsync(entry.uri, { mimeType: "video/mp4", dialogTitle: entry.title });
}
