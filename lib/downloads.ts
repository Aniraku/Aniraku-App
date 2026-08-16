import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { nativePlaybackHeaders } from "@/lib/aniraku-api";
import { isAutoQuality } from "@/lib/watch-engine";
import type { StreamSource } from "@/lib/types";
import { downloadLabel, isDownloadableSource, publicDownloadFilename, selectMaximumQualityDownload } from "@/lib/download-policy";

export { downloadLabel, isDownloadableSource, publicDownloadFilename, selectMaximumQualityDownload } from "@/lib/download-policy";

const INDEX_KEY = "aniraku.offline-downloads.v1";
const PUBLIC_DOWNLOADS_DIRECTORY_KEY = "aniraku.public-downloads-directory.v1";

export type OfflineDownload = { id: string; animeId: number; episode: number; title: string; quality: string; language: "sub" | "dub"; uri: string; savedAt: number; size: number };

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

export async function startMaximumQualityDownload(input: { animeId: number; episode: number; language: "sub" | "dub"; title: string; source: StreamSource; headers?: Record<string, string>; onProgress?: (fraction: number) => void }) {
  if (!isDownloadableSource(input.source)) throw new Error("This provider only offers adaptive, embedded, or protected playback. A direct progressive source is required for downloading.");
  const id = downloadId(input.animeId, input.episode, input.language);
  const quality = isAutoQuality(input.source) ? "ORIGINAL DIRECT" : input.source.quality || "DIRECT";
  const filename = publicDownloadFilename(input.title, input.episode, input.language, quality, input.source);
  const saveInto = async (directory: Directory) => {
    const destination = new File(directory, filename);
    if (destination.exists) destination.delete();
    await File.downloadFileAsync(input.source.url, destination, { headers: nativePlaybackHeaders(input.headers), idempotent: true });
    if (!destination.exists || !destination.size) throw new Error("Android could not save the file to Downloads.");
    input.onProgress?.(1);
    return destination;
  };
  let selection = await publicDownloadsDirectory();
  let saved: File;
  try {
    saved = await saveInto(selection.directory);
  } catch (cause) {
    // A persisted Android Storage Access Framework grant can be revoked by the
    // operating system or file manager. Re-prompt once only for that case.
    if (!selection.reused || !storedDirectoryAccessError(cause)) throw cause;
    await AsyncStorage.removeItem(PUBLIC_DOWNLOADS_DIRECTORY_KEY).catch(() => {});
    selection = await publicDownloadsDirectory(true);
    saved = await saveInto(selection.directory);
  }
  const entry: OfflineDownload = { id, animeId: input.animeId, episode: input.episode, title: input.title, quality, language: input.language, uri: saved.uri, savedAt: Date.now(), size: saved.size };
  const index = await readIndex();
  await writeIndex([entry, ...index.filter((item) => item.id !== id)]);
  return entry;
}

export async function removeOfflineDownload(entry: OfflineDownload) {
  try { new File(entry.uri).delete(); } catch {}
  await writeIndex((await readIndex()).filter((item) => item.id !== entry.id));
}

export async function shareOfflineDownload(entry: OfflineDownload) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing downloaded episodes is unavailable on this device.");
  await Sharing.shareAsync(entry.uri, { mimeType: "video/mp4", dialogTitle: entry.title });
}
