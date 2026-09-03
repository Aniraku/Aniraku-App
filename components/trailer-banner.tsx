import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

type TrailerBannerProps = {
  trailerId: string;
  thumbnail?: string | null;
  title: string;
};

export function TrailerBanner({ trailerId, thumbnail, title }: TrailerBannerProps) {
  const [pressed, setPressed] = useState(false);

  const youtubeUrl = `https://www.youtube.com/watch?v=${trailerId}`;
  const thumbUrl = thumbnail || `https://img.youtube.com/vi/${trailerId}/maxresdefault.jpg`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play trailer for ${title}`}
      onPress={() => WebBrowser.openBrowserAsync(youtubeUrl)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={({ pressed: p }) => [styles.container, (p || pressed) && styles.pressed]}
    >
      <Image source={{ uri: thumbUrl }} style={styles.thumbnail} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      <View style={styles.overlay} />
      <View style={styles.playButton}>
        <AppIcon name="play" size={28} color={nothing.white} />
      </View>
      <View style={styles.labelRow}>
        <AppIcon name="play-circle-outline" size={14} color={nothing.white} />
        <Text style={styles.label}>WATCH TRAILER</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: nothing.raised,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.25)",
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  playButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -28,
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,77,77,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  labelRow: {
    position: "absolute",
    bottom: 40,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    color: nothing.white,
    fontFamily: "monospace",
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 0.8,
  },
  title: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    color: nothing.white,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
