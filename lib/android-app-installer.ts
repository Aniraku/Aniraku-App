import { Directory, File, Paths } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

import type { AppRelease } from "@/lib/app-update";

const APK_MIME_TYPE = "application/vnd.android.package-archive";
const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;

function updateDirectory() {
  const directory = new Directory(Paths.cache, "aniraku-updates");
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

/** Download only the signed public GitHub release asset selected by app-update, then hand it to Android's package installer. */
export async function downloadAndInstallAnirakuUpdate(release: AppRelease) {
  if (Platform.OS !== "android") throw new Error("DIRECT APK INSTALLATION IS AVAILABLE ON ANDROID ONLY.");
  if (!release.downloadUrl || !release.assetName || !Number.isSafeInteger(release.assetSize) || release.assetSize <= 0) {
    throw new Error("THE PUBLISHED UPDATE ASSET COULD NOT BE VERIFIED.");
  }
  // Trust boundary: release metadata flows from the GitHub API into an
  // ACTION_VIEW intent that triggers the package installer. Re-validate
  // here (app-update already filters) so a compromised cache entry can't
  // redirect the download or smuggle a path traversal filename.
  let parsedDownload: URL;
  try {
    parsedDownload = new URL(release.downloadUrl);
  } catch {
    throw new Error("THE PUBLISHED UPDATE ASSET COULD NOT BE VERIFIED.");
  }
  const trustedDownload = parsedDownload.protocol === "https:"
    && parsedDownload.origin === "https://github.com"
    && parsedDownload.pathname.startsWith("/Aniraku/Aniraku-App/releases/download/");
  const trustedName = /^[A-Za-z0-9._-]+\.apk$/.test(release.assetName) && !release.assetName.includes("..");
  if (!trustedDownload || !trustedName) {
    throw new Error("THE PUBLISHED UPDATE ASSET COULD NOT BE VERIFIED.");
  }

  const destination = new File(updateDirectory(), release.assetName);
  if (destination.exists) destination.delete();
  const downloaded = await File.downloadFileAsync(release.downloadUrl, destination, { idempotent: true });
  if (!downloaded.exists || downloaded.size !== release.assetSize) {
    if (downloaded.exists) downloaded.delete();
    throw new Error("THE UPDATE DOWNLOAD DID NOT MATCH THE PUBLISHED ASSET.");
  }

  const contentUri = await FileSystemLegacy.getContentUriAsync(downloaded.uri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: APK_MIME_TYPE,
  });
}
