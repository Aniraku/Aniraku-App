import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File } from "expo-file-system";
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

/**
 * Downloads via the backend proxy endpoint which handles CDN headers, CORS,
 * and authentication. The backend streams the file through /api/v1/download
 * so the client never touches the raw CDN URL.
 *
 * When `variantUrl` carries the parsed HLS variant for the chosen height,
 * that exact rendition is fetched — never the master's highest guess. The
 * max-guess `source` remains the fallback (and still supplies the filename)
 * when no parsed variant is available.
 */
export async function startMaximumQualityDownload(input: { animeId: number; episode: number; language: "sub" | "dub"; title: string; source: StreamSource; variantUrl?: string | null; variantQuality?: string | null; headers?: Record<string, string>; onProgress?: (fraction: number) => void }) {
  const explicitUrl = String(input.variantUrl ?? "").trim() || null;
  const useExplicit = Boolean(explicitUrl && /^https:\/\//i.test(explicitUrl));
  if (explicitUrl && !useExplicit) throw new Error("The selected quality offered an unusable download URL.");
  if (!useExplicit && !isDownloadableSource(input.source)) throw new Error("This provider only offers adaptive, embedded, or protected playback. A direct progressive source is required for downloading.");
  const id = downloadId(input.animeId, input.episode, input.language);
  const quality = useExplicit
    ? (String(input.variantQuality ?? "").trim() || input.source.quality || "VARIANT")
    : (isAutoQuality(input.source) ? "ORIGINAL DIRECT" : input.source.quality || "DIRECT");
  const filename = publicDownloadFilename(input.title, input.episode, input.language, quality, input.source);
  const proxyHeaders = nativePlaybackHeaders(input.headers);
  const downloadUrl = anirakuDownloadUrl(useExplicit ? explicitUrl as string : input.source.url, proxyHeaders);

  const saveInto = async (directory: Directory) => {
    const destination = new File(directory, filename);
    if (destination.exists) destination.delete();
    await File.downloadFileAsync(downloadUrl, destination, { idempotent: true });
    if (!destination.exists || !destination.size) throw new Error("Android could not save the file to Downloads.");
    input.onProgress?.(1);
    return destination;
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

  const entry: OfflineDownload = { id, animeId: input.animeId, episode: input.episode, title: input.title, quality, language: input.language, uri: saved.uri, downloadUrl, savedAt: Date.now(), size: saved.size };
  const index = await readIndex();
  await writeIndex([entry, ...index.filter((item) => item.id !== id)]);
  return entry;
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
