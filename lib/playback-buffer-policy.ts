const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

/**
 * Media3's byte allocator stays automatic while time-based buffering keeps a
 * meaningful forward reserve. The longer recovery threshold prevents a short
 * rebuffer from immediately decoding the just-rendered keyframe again.
 */
export const NATIVE_STREAM_BUFFER_OPTIONS = {
  maxBufferBytes: 0,
  minBufferForPlayback: 20,
  preferredForwardBufferDuration: 120,
  prioritizeTimeOverSizeThreshold: true,
  waitsToMinimizeStalling: true,
} as const;

const MIN_VIDEO_CACHE_BYTES = 256 * MIB;
const FALLBACK_VIDEO_CACHE_BYTES = GIB;
const MAX_VIDEO_CACHE_BYTES = 4 * GIB;
const RESERVED_FREE_STORAGE_BYTES = 2 * GIB;

/**
 * Persistent stream caching is intentionally device-aware: reserve two GiB
 * for Android and use up to one quarter of the remainder. This prevents a
 * fixed 1 GiB cache from crowding small devices while permitting up to 4 GiB
 * on devices that have enough free storage.
 */
export function adaptiveVideoCacheBytes(freeStorageBytes: number | null | undefined) {
  if (!Number.isFinite(freeStorageBytes) || !freeStorageBytes || freeStorageBytes <= 0) {
    return FALLBACK_VIDEO_CACHE_BYTES;
  }
  const availableAfterReserve = Math.max(0, freeStorageBytes - RESERVED_FREE_STORAGE_BYTES);
  const desired = Math.floor(availableAfterReserve * 0.25);
  return Math.max(MIN_VIDEO_CACHE_BYTES, Math.min(MAX_VIDEO_CACHE_BYTES, desired));
}
