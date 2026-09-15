import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { nothing } from "@/components/nothing-ui";

/**
 * Avatar that never renders a blank box. The initial-letter tile is ALWAYS
 * mounted underneath, so slow networks show a tile (never empty space) and a
 * broken/expired URL falls back to it. Uses expo-image like every other
 * remote image in the app (cover art, thumbnails) for consistent caching.
 */
export function AvatarImage({ uri, name, size, rounded = false, fill = false, style }: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  rounded?: boolean;
  fill?: boolean;
  style?: any;
}) {
  const [failed, setFailed] = useState(false);
  // A new URI retries the load — one failure must never pin the fallback.
  useEffect(() => { setFailed(false); }, [uri]);
  const initial = (name?.trim().charAt(0) || "A").toUpperCase();
  const radius = rounded ? (fill ? 999 : (size ?? 40) / 2) : 4;
  const box = fill
    ? { width: "100%" as const, height: "100%" as const }
    : { width: size ?? 40, height: size ?? 40 };
  const showImage = Boolean(uri) && !failed;
  return (
    <View style={[styles.box, box, { borderRadius: radius }, style]}>
      <View style={styles.fallback}>
        <Text style={[styles.initial, { fontSize: (fill ? 28 : (size ?? 40)) * 0.42 }]}>{initial}</Text>
      </View>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          accessibilityLabel={name ? `${name} avatar` : "Avatar"}
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
