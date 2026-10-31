import { EventEmitter, NativeModule, requireNativeModule } from "expo-modules-core";

/**
 * Thin typed wrapper over the AnirakuDownloads native module. The Android
 * service emits per-segment progress and a terminal state; lib/downloads.ts
 * maps them onto queue jobs. Absent module (web, or a binary built before
 * this module existed) degrades to null so callers can refuse gracefully.
 */

export type NativeDownloadProgress = { id: string; receivedBytes: number; totalBytes: number };
export type NativeDownloadResult = {
  id: string;
  state: "complete" | "failed";
  reason?: string;
  segments?: string[];
  keyPath?: string | null;
  bytes?: number;
};

type DownloadEvents = {
  onDownloadProgress: (progress: NativeDownloadProgress) => void;
  onDownloadState: (result: NativeDownloadResult) => void;
};

declare class AnirakuDownloadsNativeModule extends NativeModule<DownloadEvents> {
  enqueue(options: {
    id: string;
    dir: string;
    base: string;
    title: string;
    headers: string;
    estimatedBytes: number;
  }): void;
  cancel(id: string): void;
}

function resolveNativeModule(): AnirakuDownloadsNativeModule | null {
  try {
    return requireNativeModule<AnirakuDownloadsNativeModule>("AnirakuDownloads");
  } catch {
    return null;
  }
}

const nativeModule = resolveNativeModule();
const eventEmitter = nativeModule ? new EventEmitter<DownloadEvents>(nativeModule) : null;

export const nativeDownloads = {
  /** False on web and on binaries built before the module existed. */
  get available() {
    return nativeModule !== null;
  },
  enqueue: (options: Parameters<AnirakuDownloadsNativeModule["enqueue"]>[0]) => {
    if (!nativeModule) throw new Error("The download service is not available in this build.");
    nativeModule.enqueue(options);
  },
  cancel: (id: string) => {
    try { nativeModule?.cancel(id); } catch { /* the service may already be gone */ }
  },
  onProgress: (listener: (progress: NativeDownloadProgress) => void) => {
    const subscription = eventEmitter?.addListener("onDownloadProgress", listener);
    return () => subscription?.remove();
  },
  onState: (listener: (result: NativeDownloadResult) => void) => {
    const subscription = eventEmitter?.addListener("onDownloadState", listener);
    return () => subscription?.remove();
  },
};
