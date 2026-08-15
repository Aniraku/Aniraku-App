import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import type { Anime } from "@/lib/types";
import { animeTitle } from "@/lib/types";
import { nothing, Signal } from "@/components/nothing-ui";

export function AnimeCard({ anime, compact = false }: { anime: Anime; compact?: boolean }) {
  const title = animeTitle(anime);
  const artwork = anime.coverImage?.extraLarge || anime.coverImage?.large;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      onPress={() => {
        void Haptics.selectionAsync();
        router.push((`/anime/${anime.id}`) as never);
      }}
      style={({ pressed }) => [styles.card, compact && styles.compactCard, pressed && styles.pressed]}
    >
      <View style={styles.media}><View style={styles.artFallback}><Text style={styles.fallbackInitial}>{title.charAt(0)}</Text></View>{artwork ? <Image source={{ uri: artwork }} style={styles.poster} contentFit="cover" transition={0} cachePolicy="memory-disk" /> : null}{anime.nextAiringEpisode ? <View style={styles.topline}><Signal label={`EP ${anime.nextAiringEpisode.episode}`} /></View> : null}</View>
      <View style={styles.meta}><Text numberOfLines={2} style={styles.title}>{title}</Text><Text style={styles.detail}>{anime.format || "ANIME"}{anime.averageScore ? ` · ${Math.round(anime.averageScore)}%` : ""}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 144, gap: 8 },
  compactCard: { width: 124 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  media: { height: 204, borderRadius: 6, overflow: "hidden", backgroundColor: nothing.raised },
  artFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#242422" },
  fallbackInitial: { color: nothing.dim, fontSize: 54, fontWeight: "900" },
  poster: { ...StyleSheet.absoluteFillObject },
  topline: { position: "absolute", left: 7, top: 7, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.74)" },
  meta: { gap: 3 },
  title: { color: nothing.white, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  detail: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.35 },
});
