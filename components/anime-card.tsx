import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import type { Anime } from "@/lib/types";
import { animeTitle } from "@/lib/types";
import { nothing, Signal } from "@/components/nothing-ui";

export function AnimeCard({ anime, compact = false }: { anime: Anime; compact?: boolean }) {
  const title = animeTitle(anime);
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
      <Image source={anime.coverImage?.extraLarge || anime.coverImage?.large || undefined} style={styles.poster} contentFit="cover" transition={180} />
      <View style={styles.scrim} />
      <View style={styles.meta}>
        <Text numberOfLines={2} style={styles.title}>{title}</Text>
        <View style={styles.footer}>
          <Text style={styles.detail}>{anime.format || "ANIME"}</Text>
          {anime.nextAiringEpisode ? <Signal label={`EP ${anime.nextAiringEpisode.episode}`} /> : <Text style={styles.detail}>{anime.averageScore ? `${Math.round(anime.averageScore)}%` : ""}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 152, height: 222, borderRadius: 16, overflow: "hidden", backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line },
  compactCard: { width: 128, height: 188 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  poster: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.20)" },
  meta: { flex: 1, justifyContent: "flex-end", padding: 11, backgroundColor: "rgba(0,0,0,0.34)" },
  title: { color: nothing.white, fontSize: 13, fontWeight: "800", lineHeight: 17 },
  footer: { marginTop: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detail: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
});
