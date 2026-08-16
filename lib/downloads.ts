import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
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

async function publicDownloadsDirectory() {
  if (Platform.OS !== "android") throw new Error("Public Downloads saving is available on Android devices.");
  const storedUri = await AsyncStorage.getItem(PUBLIC_DOWNLOADS_DIRECTORY_KEY).catch(() => null);
  if (storedUri) {
    const stored = new Directory(storedUri);
    if (stored.exists) return stored;
  }
  try {
    const chosen = await Directory.pickDirectoryAsync();
    await AsyncStorage.setItem(PUBLIC_DOWNLOADS_DIRECTORY_KEY, chosen.uri);
    return chosen;
  } catch {
    throw new Error("Choose your Android Downloads folder to save this video.");
  }
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
  const directory = await publicDownloadsDirectory();
  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) throw new Error("Temporary download storage is unavailable on this device.");
  const filename = publicDownloadFilename(input.title, input.episode, input.language, quality);
  const temporaryUri = `${cacheRoot}${filename}.${Date.now()}.partial`;
  const task = FileSystem.createDownloadResumable(input.source.url, temporaryUri, { headers: nativePlaybackHeaders(input.headers) }, (progress) => {
    if (progress.totalBytesExpectedToWrite > 0) input.onProgress?.(Math.min(1, progress.totalBytesWritten / progress.totalBytesExpectedToWrite));
  });
  try {
    const result = await task.downloadAsync();
    if (!result?.uri) throw new Error("The download did not produce a playable file.");
    const temporary = new File(result.uri);
    if (!temporary.exists || !temporary.size) throw new Error("The downloaded file is empty.");
    const destination = new File(directory.uri, filename);
    if (destination.exists) destination.delete();
    temporary.copy(destination);
    if (!destination.exists || !destination.size) throw new Error("Android could not save the file to Downloads.");
    const entry: OfflineDownload = { id, animeId: input.animeId, episode: input.episode, title: input.title, quality, language: input.language, uri: destination.uri, savedAt: Date.now(), size: destination.size };
    const index = await readIndex();
    await writeIndex([entry, ...index.filter((item) => item.id !== id)]);
    return entry;
  } finally {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => {});
  }
}

export async function removeOfflineDownload(entry: OfflineDownload) {
  try { new File(entry.uri).delete(); } catch { await FileSystem.deleteAsync(entry.uri, { idempotent: true }).catch(() => {}); }
  await writeIndex((await readIndex()).filter((item) => item.id !== entry.id));
}

export async function shareOfflineDownload(entry: OfflineDownload) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing downloaded episodes is unavailable on this device.");
  await Sharing.shareAsync(entry.uri, { mimeType: "video/mp4", dialogTitle: entry.title });
}
