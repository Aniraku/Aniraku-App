import { Platform } from "react-native";
import { setVideoCacheSizeAsync } from "expo-video";
import * as FileSystem from "expo-file-system/legacy";
import { adaptiveVideoCacheBytes } from "@/lib/playback-buffer-policy";

let configured = false;

/**
 * Expo Video only accepts cache-size changes before any VideoPlayer exists.
 * RootLayout awaits this once during native boot, then all Watch players can
 * use the same device-aware persistent cache safely.
 */
export async function configureAdaptiveVideoCache() {
  if (configured || Platform.OS !== "android") return;
  const freeStorageBytes = await FileSystem.getFreeDiskStorageAsync();
  await setVideoCacheSizeAsync(adaptiveVideoCacheBytes(freeStorageBytes));
  configured = true;
}
