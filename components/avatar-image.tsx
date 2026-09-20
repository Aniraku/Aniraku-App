import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { nothing } from "@/components/nothing-ui";
import { AVATAR_CACHE_SUBDIR, avatarCacheFileName } from "@/lib/avatar-cache";

/**
 * Avatar that never renders a blank box AND never touches Coil/Fresco for
 * networking. The bytes are fetched with the app's own fetch stack (the same
 * one that reaches Supabase fine in V4) into the cache directory, then
 * rendered with React Native's native <Image> from a file:// URI.
 *
 * Two self-healing behaviors keep a single bad download from blanking an
 * avatar forever:
 * - a cached file that fails to decode is evicted (file + memory entry),
 *   so the next mount re-downloads instead of reusing poisoned bytes;
 * - when no usable cached file exists yet, the remote https URL renders
 *   directly instead of a permanent letter tile.
 *
 * The initial-letter tile is always mounted underneath — loading, error,
 * and empty states all read as intentional tiles, never holes.
 */

const memoryCache = new Map<string, string>();

async function resolveLocalAvatar(remoteUrl: string): Promise<string | null> {
  const hit = memoryCache.get(remoteUrl);
  if (hit) return hit;
  try {
    const directory = new Directory(Paths.cache, AVATAR_CACHE_SUBDIR);
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, avatarCacheFileName(remoteUrl));
    if (!destination.exists || destination.size === 0) {
      if (destination.exists) destination.delete();
      const downloaded = await File.downloadFileAsync(remoteUrl, destination, { idempotent: true });
      if (!downloaded.exists || downloaded.size === 0) {
        if (downloaded.exists) downloaded.delete();
        return null;
      }
    }
    memoryCache.set(remoteUrl, destination.uri);
    return destination.uri;
  } catch {
    return null;
  }
}

/** Drop a poisoned cache entry so the next mount re-downloads fresh bytes. */
async function evictLocalAvatar(remoteUrl: string): Promise<void> {
  memoryCache.delete(remoteUrl);
  try {
    const file = new File(new Directory(Paths.cache, AVATAR_CACHE_SUBDIR), avatarCacheFileName(remoteUrl));
    if (file.exists) file.delete();
  } catch {
    // Best effort — a leftover file just means one more fallback render.
  }
}

export function AvatarImage({ uri, name, size, rounded = false, fill = false, style }: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  rounded?: boolean;
  fill?: boolean;
  style?: any;
}) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    setRemoteFailed(false);
    if (!uri) return;
    void resolveLocalAvatar(uri).then((resolved) => {
      if (!cancelled && resolved) setLocalUri(resolved);
    });
    return () => { cancelled = true; };
  }, [uri]);
  const initial = (name?.trim().charAt(0) || "A").toUpperCase();
  const radius = rounded ? (fill ? 999 : (size ?? 40) / 2) : 4;
  const box = fill
    ? { width: "100%" as const, height: "100%" as const }
    : { width: size ?? 40, height: size ?? 40 };
  const imageProps = {
    style: StyleSheet.absoluteFill,
    resizeMode: "cover" as const,
    accessibilityLabel: name ? `${name} avatar` : "Avatar",
  };
  // Fast path: decoded bytes from the app cache directory.
  // Fallback path: the remote https URL directly — used while the download
  // is in flight or when the file pipeline failed on this device.
  const showRemote = !localUri && !remoteFailed && typeof uri === "string" && /^https:/i.test(uri);
  return (
    <View style={[styles.box, box, { borderRadius: radius }, style]}>
      <View style={styles.fallback}>
        <Text style={[styles.initial, { fontSize: (fill ? 28 : (size ?? 40)) * 0.42 }]}>{initial}</Text>
      </View>
      {localUri ? (
        <Image
          source={{ uri: localUri }}
          onError={() => { void evictLocalAvatar(uri ?? ""); setLocalUri(null); }}
          {...imageProps}
        />
      ) : showRemote ? (
        <Image
          source={{ uri }}
          onError={() => setRemoteFailed(true)}
          {...imageProps}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: "#222220" },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#222220" },
  initial: { color: nothing.dim, fontWeight: "900" },
});
