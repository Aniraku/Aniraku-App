import { useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageStyle } from "expo-image";
import { nothing } from "@/components/nothing-ui";

/**
 * Avatar that never renders a blank box: a broken/expired URL falls back to
 * an initial-letter tile, and recyclingKey keeps FlatList cells from flashing
 * a recycled image.
 */
export function AvatarImage({ uri, name, size, rounded = false, fill = false, style }: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  rounded?: boolean;
  fill?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim().charAt(0) || "A").toUpperCase();
  const box = fill
    ? { width: "100%" as const, height: "100%" as const, borderRadius: rounded ? 999 : 4 }
    : { width: size ?? 40, height: size ?? 40, borderRadius: rounded ? (size ?? 40) / 2 : 4 };
  if (!uri || failed) {
    return <View style={[styles.fallback, box as ViewStyle, style as ViewStyle]}><Text style={[styles.initial, { fontSize: (fill ? 28 : (size ?? 40)) * 0.42 }]}>{initial}</Text></View>;
  }
  return <Image source={{ uri }} recyclingKey={uri} onError={() => setFailed(true)} style={[box, style]} contentFit="cover" transition={0} cachePolicy="memory-disk" />;
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#222220" },
  initial: { color: nothing.dim, fontWeight: "900" },
});
