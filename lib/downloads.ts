import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { nativePlaybackHeaders } from "@/lib/aniraku-api";
import { isAutoQuality } from "@/lib/watch-engine";
import type { StreamSource } from "@/lib/types";
import { isDownloadableSource, selectMaximumQualityDownload, downloadLabel } from "@/lib/download-policy";

export { isDownloadableSource, selectMaximumQualityDownload, downloadLabel } from "@/lib/download-policy";

const INDEX_KEY = "aniraku.offline-downloads.v1";
const DOWNLOAD_DIRECTORY = "aniraku-downloads/";

export type OfflineDownload = { id: string; animeId: number; episode: number; title: string; quality: string; language: "sub" | "dub"; uri: string; savedAt: number; size: number };

function fileStem(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "aniraku-episode";
}

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

export async function findOfflineDownload(animeId: number, episode: number, language: "sub" | "dub") {
  const entry = (await readIndex()).find((item) => item.id === downloadId(animeId, episode, language));
  if (!entry) return null;
  const info = await FileSystem.getInfoAsync(entry.uri).catch(() => ({ exists: false }));
  return info.exists ? entry : null;
}

export async function startMaximumQualityDownload(input: { animeId: number; episode: number; language: "sub" | "dub"; title: string; source: StreamSource; headers?: Record<string, string>; onProgress?: (fraction: number) => void }) {
  if (!isDownloadableSource(input.source)) throw new Error("This provider only offers adaptive, embedded, or protected playback. A direct progressive source is required for offline saving.");
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error("Offline storage is unavailable on this device.");
  const directory = `${root}${DOWNLOAD_DIRECTORY}`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const id = downloadId(input.animeId, input.episode, input.language);
  const quality = isAutoQuality(input.source) ? "ORIGINAL DIRECT" : input.source.quality || "DIRECT";
  const uri = `${directory}${fileStem(input.title)}-ep${String(input.episode).padStart(2, "0")}-${input.language}-${fileStem(quality)}.mp4`;
  const task = FileSystem.createDownloadResumable(input.source.url, uri, { headers: nativePlaybackHeaders(input.headers) }, (progress) => {
    if (progress.totalBytesExpectedToWrite > 0) input.onProgress?.(Math.min(1, progress.totalBytesWritten / progress.totalBytesExpectedToWrite));
  });
  const result = await task.downloadAsync();
  if (!result?.uri) throw new Error("The download did not produce a playable file.");
  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || !info.size) throw new Error("The downloaded file is empty.");
  const entry: OfflineDownload = { id, animeId: input.animeId, episode: input.episode, title: input.title, quality, language: input.language, uri: result.uri, savedAt: Date.now(), size: info.size };
  const index = await readIndex();
  await writeIndex([entry, ...index.filter((item) => item.id !== id)]);
  return entry;
}

export async function removeOfflineDownload(entry: OfflineDownload) {
  await FileSystem.deleteAsync(entry.uri, { idempotent: true }).catch(() => {});
  await writeIndex((await readIndex()).filter((item) => item.id !== entry.id));
}

export async function shareOfflineDownload(entry: OfflineDownload) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing saved episodes is unavailable on this device.");
  await Sharing.shareAsync(entry.uri, { mimeType: "video/mp4", dialogTitle: entry.title });
}
