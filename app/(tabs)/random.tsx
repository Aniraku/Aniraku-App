import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getAnimePool, isAniListPageDepthError, isAniListRateLimitError } from "@/lib/anilist";
import { regenerateRandomPages, sessionRandomPages, shouldFallbackToFirstPages } from "@/lib/random-pool";
import type { Anime } from "@/lib/types";
import { nsfwFilterParam, useNsfwPreference } from "@/lib/nsfw-preference";
import { animeTitle } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";
import { AppIcon } from "@/components/app-icon";

function shuffledIndices(length: number) {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return order;
}

export default function RandomScreen() {
  const nsfw = useNsfwPreference();
  const isAdultParam = nsfwFilterParam(nsfw.enabled);
  // Session-stable pages: the startup prefetch and this tab share the exact
  // same triple, so the prefetched pool IS the pool shown here (its query key
  // matches — no wasted request under the temporary 30 req/min cap).
  const [batch, setBatch] = useState(() => sessionRandomPages());
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Shuffle bag: every title shows once before any repeat, so picks never
  // feel cached. Dealt client-side — zero network per pick, always instant.
  const bagRef = useRef<number[]>([]);
  // Last good pool, kept across background refetches so picks keep working
  // (from the old bag) while the fresh batch loads — never a dead button.
  const titlesRef = useRef<Anime[]>([]);
  const [cursor, setCursor] = useState(0);
  const [current, setCurrent] = useState<Anime | null>(null);

  const pool = useQuery({
    queryKey: ["random-pool", batch[0], batch[1], batch[2], isAdultParam],
    queryFn: async () => {
      try {
        const titles = await getAnimePool({
          pages: batch,
          perPage: 50,
          isAdult: isAdultParam,
        });
        // Deep random pages can legitimately return a thin pool (sparse tail of
        // the catalog). One known-good retry on pages [1,2,3] keeps the error
        // banner for real failures only — AniList unreachable or rate limited.
        if (shouldFallbackToFirstPages(titles.length)) {
          return getAnimePool({ pages: [1, 2, 3], perPage: 50, isAdult: isAdultParam });
        }
        if (!titles.length) throw new Error("No anime found. Check your connection and try again.");
        return titles;
      } catch (error) {
        // Belt and suspenders with the getAnimePool clamp: a stale deep
        // triple (or a future caller regression) falls back to known-good
        // front pages instead of surfacing AniList's raw page-depth message.
        if (isAniListPageDepthError(error)) {
          return getAnimePool({ pages: [1, 2, 3], perPage: 50, isAdult: isAdultParam });
        }
        throw error;
      }
    },
    // Depth errors are deterministic — retrying the same pages just burns
    // the 30 req/min budget. Rate-limit errors cool down via the global
    // slot instead of a blind retry here.
    retry: (failureCount, error) =>
      !isAniListRateLimitError(error) && !isAniListPageDepthError(error) && failureCount < 1,
    retryDelay: 1_500,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

  // Fresh pool (or first load): shuffle the bag and deal the top card.
  useEffect(() => {
    if (!pool.data?.length) return;
    titlesRef.current = pool.data;
    bagRef.current = shuffledIndices(pool.data.length);
    setCursor(0);
    setCurrent(pool.data[bagRef.current[0] as number] ?? null);
  }, [pool.data]);

  const crossfadeTo = useCallback((next: Anime | null) => {
    if (!next) return;
    setCurrent(next);
    // Single 0→1 flight that always completes — rapid taps restart it but can
    // never strand the card at opacity 0 (the old chained fade-out/in could).
    fadeAnim.stopAnimation();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const pickAnother = useCallback(() => {
    const titles = titlesRef.current.length ? titlesRef.current : pool.data;
    if (!titles?.length) {
      void pool.refetch();
      return;
    }
    const nextCursor = cursor + 1;
    if (nextCursor < bagRef.current.length) {
      setCursor(nextCursor);
      crossfadeTo(titles[bagRef.current[nextCursor] as number] ?? null);
      return;
    }
    // Bag exhausted after ~150 picks: deal a fresh pool in the background and
    // keep showing the current card — never a blank screen while it loads.
    setBatch(regenerateRandomPages());
  }, [cursor, crossfadeTo, pool]);

  const anime = current ?? pool.data?.[0] ?? null;

  return (
    <NativeScreen>
      <NativeHeader eyebrow="PICK FOR ME" title="Surprise me" />

      {pool.isPending && !anime ? (
        <LoadingState label="Finding something you might like" />
      ) : pool.isError && !anime ? (
        <ErrorState
          message={pool.error?.message ?? "We could not pick an anime right now."}
          onRetry={() => void pool.refetch()}
        />
      ) : anime ? (
        <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
          <View style={styles.art}>
            <View style={styles.artFallback}>
              <Text style={styles.fallbackInitial}>{animeTitle(anime).charAt(0)}</Text>
            </View>
            <Image
              source={{ uri: anime.coverImage?.extraLarge || anime.coverImage?.large || "" }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              accessibilityLabel={`Cover image for ${animeTitle(anime)}`}
            />
            <View style={styles.artMask} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title} accessibilityLabel={`Title: ${animeTitle(anime)}`}>
              {animeTitle(anime)}
            </Text>

            <Text style={styles.meta}>
              {(anime.genres || []).slice(0, 3).join(" · ") || "Anime for tonight"}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${animeTitle(anime)}`}
              onPress={() => router.push((`/anime/${anime.id}`) as never)}
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
      ) : (
        <LoadingState label="Finding something you might like" />
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
