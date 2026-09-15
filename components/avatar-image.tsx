import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { nothing } from "@/components/nothing-ui";

/**
 * Avatar that never renders a blank box: a broken/expired URL falls back to
 * an initial-letter tile. Uses React Native's built-in Image for maximum
 * compatibility across all devices and expo-image versions.
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
  const initial = (name?.trim().charAt(0) || "A").toUpperCase();
  const box = fill
    ? { width: "100%" as const, height: "100%" as const, borderRadius: rounded ? 999 : 4 }
    : { width: size ?? 40, height: size ?? 40, borderRadius: rounded ? (size ?? 40) / 2 : 4 };
  if (!uri || failed) {
    return (
      <View style={[styles.fallback, box, style]}>
        <Text style={[styles.initial, { fontSize: (fill ? 28 : (size ?? 40)) * 0.42 }]}>{initial}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={[box, style]}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#222220" },
  initial: { color: nothing.dim, fontWeight: "900" },
});
