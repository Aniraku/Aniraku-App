import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getAnimePage } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";
import { AppIcon } from "@/components/app-icon";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports",
  "Supernatural", "Thriller",
] as const;

export default function RandomScreen() {
  const [seed, setSeed] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [matchPercent, setMatchPercent] = useState(85);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const suggestion = useQuery({
    queryKey: ["random", seed, selectedGenre],
    queryFn: async () => {
      const page = await getAnimePage({
        page: (seed % 20) + 1,
        perPage: 20,
        sort: ["POPULARITY_DESC"],
        ...(selectedGenre ? { genre: selectedGenre } : {}),
      });
      if (!page.media.length) throw new Error("No anime found for this filter.");
      return page.media[Math.floor(Math.random() * page.media.length)];
    },
  });

  const pickAnother = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setSeed((v) => v + 1);
      setMatchPercent(Math.floor(Math.random() * 30) + 70);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const pickGenre = useCallback((genre: string | null) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setSelectedGenre(genre);
      setSeed((v) => v + 1);
      setMatchPercent(Math.floor(Math.random() * 30) + 70);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  return (
    <NativeScreen>
      <NativeHeader eyebrow="PICK FOR ME" title="Surprise me" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.genreRow}
        accessibilityLabel="Genre filter"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="All genres"
          accessibilityState={{ selected: selectedGenre === null }}
          onPress={() => pickGenre(null)}
          style={({ pressed }) => [
            styles.genrePill,
            selectedGenre === null && styles.genrePillActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.genreText, selectedGenre === null && styles.genreTextActive]}>All</Text>
        </Pressable>
        {GENRES.map((g) => (
          <Pressable
            key={g}
            accessibilityRole="button"
            accessibilityLabel={`${g} genre`}
            accessibilityState={{ selected: selectedGenre === g }}
            onPress={() => pickGenre(g)}
            style={({ pressed }) => [
              styles.genrePill,
              selectedGenre === g && styles.genrePillActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.genreText, selectedGenre === g && styles.genreTextActive]}>{g}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {suggestion.isPending ? (
        <LoadingState label="Finding something you might like" />
      ) : suggestion.isError || !suggestion.data ? (
        <ErrorState
          message={suggestion.error?.message ?? "We could not pick an anime right now."}
          onRetry={pickAnother}
        />
      ) : (
        <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
          <View style={styles.art}>
            <View style={styles.artFallback}>
              <Text style={styles.fallbackInitial}>{animeTitle(suggestion.data).charAt(0)}</Text>
            </View>
            <Image
              source={{ uri: suggestion.data.coverImage?.extraLarge || suggestion.data.coverImage?.large || "" }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              accessibilityLabel={`Cover image for ${animeTitle(suggestion.data)}`}
            />
            <View style={styles.artMask} />
            <View style={styles.artBottom}>
              <Text style={styles.artMeta}>{matchPercent}% MATCH</Text>
            </View>
          </View>

          <View style={styles.content}>
            <Text style={styles.title} accessibilityLabel={`Title: ${animeTitle(suggestion.data)}`}>
              {animeTitle(suggestion.data)}
            </Text>

            <View style={styles.tagRow} accessibilityLabel="Genres">
              {(suggestion.data.genres || []).slice(0, 5).map((genre) => (
                <View key={genre} style={styles.genreTag}>
                  <Text style={styles.genreTagText}>{genre}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.meta}>
              {suggestion.data.genres?.slice(0, 3).join(" · ") || "Anime for tonight"}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${animeTitle(suggestion.data)}`}
              onPress={() => router.push((`/anime/${suggestion.data.id}`) as never)}
              style={({ pressed }) => [styles.open, pressed && styles.pressed]}
            >
              <Text style={styles.openText}>VIEW ANIME</Text>
              <AppIcon name="arrow-top-right" size={18} color={nothing.black} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick another anime"
              onPress={pickAnother}
              style={({ pressed }) => [styles.again, pressed && styles.pressed]}
            >
              <Text style={styles.againText}>PICK ANOTHER</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  genreRow: { gap: 8, paddingHorizontal: 18, marginBottom: 14 },
  genrePill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line,
  },
  genrePillActive: { backgroundColor: nothing.white, borderColor: nothing.white },
  genreText: {
    color: nothing.muted, fontFamily: "monospace", fontSize: 10,
    fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase",
  },
  genreTextActive: { color: nothing.black },
  wrapper: { gap: 18 },
  art: { height: 460, marginHorizontal: -18, overflow: "hidden", backgroundColor: nothing.raised },
  artFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#242422" },
  fallbackInitial: { color: nothing.dim, fontSize: 100, fontWeight: "900" },
  artMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.17)" },
  artBottom: { position: "absolute", left: 18, bottom: 14, paddingLeft: 9, borderLeftWidth: 2, borderLeftColor: nothing.red },
  artMeta: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.5 },
  content: { gap: 11 },
  title: { color: nothing.white, fontSize: 35, fontWeight: "900", lineHeight: 39, letterSpacing: -1.15 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  genreTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: "rgba(255,77,77,0.12)", borderWidth: 1, borderColor: "rgba(255,77,77,0.25)",
  },
  genreTagText: {
    color: nothing.red, fontFamily: "monospace", fontSize: 9,
    fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase",
  },
  meta: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  open: {
    minHeight: 52, paddingHorizontal: 16, borderRadius: 6,
    alignItems: "center", justifyContent: "space-between",
    flexDirection: "row", backgroundColor: nothing.white,
  },
  openText: { color: nothing.black, fontFamily: "monospace", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  again: { minHeight: 36, alignItems: "flex-start", justifyContent: "center" },
  againText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  pressed: { opacity: 0.72 },
});
