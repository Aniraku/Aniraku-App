import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getAnimePage } from "@/lib/anilist";
import { nsfwFilterParam, useNsfwPreference } from "@/lib/nsfw-preference";
import { animeTitle } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";
import { AppIcon } from "@/components/app-icon";

export default function RandomScreen() {
  const nsfw = useNsfwPreference();
  const isAdultParam = nsfwFilterParam(nsfw.enabled);
  const [seed, setSeed] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const suggestion = useQuery({
    queryKey: ["random", seed, selectedGenre, isAdultParam],
    queryFn: async () => {
      const page = await getAnimePage({
        page: (seed % 20) + 1,
        perPage: 20,
        sort: ["POPULARITY_DESC"],
        isAdult: isAdultParam,
        ...(selectedGenre ? { genre: selectedGenre } : {}),
      });
      if (!page.media.length) throw new Error("No anime found. Check your connection and try again.");
      return page.media[Math.floor(Math.random() * page.media.length)];
    },
    retry: 2,
    retryDelay: 1_500,
    // Keyed per seed/genre: cache so back-navigation is instant.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const pickAnother = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setSeed((v) => v + 1);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const pickGenre = useCallback((genre: string | null) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setSelectedGenre(genre);
      setSeed((v) => v + 1);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  return (
    <NativeScreen>
      <NativeHeader eyebrow="PICK FOR ME" title="Surprise me" />

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
          </View>

          <View style={styles.content}>
            <Text style={styles.title} accessibilityLabel={`Title: ${animeTitle(suggestion.data)}`}>
              {animeTitle(suggestion.data)}
            </Text>

            <Text style={styles.meta}>
              {(suggestion.data.genres || []).slice(0, 3).join(" · ") || "Anime for tonight"}
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
              <Text style={styles.againText}>Pick another</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 18 },
  art: { height: 460, marginHorizontal: -18, overflow: "hidden", backgroundColor: nothing.raised },
  artFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#242422" },
  fallbackInitial: { color: nothing.dim, fontSize: 100, fontWeight: "900" },
  artMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.17)" },
  content: { gap: 11 },
  title: { color: nothing.white, fontSize: 35, fontWeight: "900", lineHeight: 39, letterSpacing: -1.15 },
  meta: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  open: {
    minHeight: 52, paddingHorizontal: 16, borderRadius: 6,
    alignItems: "center", justifyContent: "space-between",
    flexDirection: "row", backgroundColor: nothing.white,
  },
  openText: { color: nothing.black, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  again: { minHeight: 36, alignItems: "flex-start", justifyContent: "center" },
  againText: { color: nothing.muted, fontSize: 13, fontWeight: "700" },
  pressed: nothing.pressedSubtle,
});
