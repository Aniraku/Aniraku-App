import { APP_CONFIG } from "@/lib/app-config";
import { getPlaybackType, sourceVerification } from "@/lib/aniraku-api";
import { isOfflinePlaybackSource } from "@/lib/watch-engine";
import type { StreamSource } from "@/lib/types";
import { streamPoolNative } from "@/lib/stream-pool-native";

export type StreamPoolGateInput = {
  source: StreamSource | null;
  /** Injectable for tests; defaults to the build flag (beta-gated). */
  flagEnabled?: boolean;
  /** Injectable for tests; defaults to native module presence. */
  moduleAvailable?: boolean;
};

/**
 * Pure gate for the parallel segment pool: the native driver only engages
 * for streamed HLS that is not an offline copy, not an embed, and not dead.
 * Everything else keeps stock playback — the pool is a pure accelerator,
 * never a requirement (worst case equals stock playback, site parity).
 */
export function isSegmentPoolEligible(gate: StreamPoolGateInput): boolean {
  if (!(gate.flagEnabled ?? APP_CONFIG.segmentPoolEnabled)) return false;
  if (!(gate.moduleAvailable ?? streamPoolNative.available)) return false;
  const source = gate.source;
  if (!source) return false;
  const url = source.url ?? "";
  if (!url) return false;
  if (isOfflinePlaybackSource(source)) return false;
  if (getPlaybackType(source) !== "hls") return false;
  if (sourceVerification(source) === "dead") return false;
  return true;
}
