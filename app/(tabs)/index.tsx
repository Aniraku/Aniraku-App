import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getHomeAnime } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import { AnimeRail } from "@/components/anime-rail";
import { ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, NothingButton, nothing, Signal } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";

export default function HomeScreen() {
  const home = useQuery({ queryKey: ["home-anime"], queryFn: getHomeAnime });

  if (home.isPending) {
    return <NativeScreen><NativeHeader eyebrow="Aniraku / native" title="Home" action={<SearchAction />} /><LoadingState label="Loading live AniList releases" /></NativeScreen>;
  }
  if (home.isError || !home.data) {
    return <NativeScreen><NativeHeader eyebrow="Aniraku / native" title="Home" action={<SearchAction />} /><ErrorState message={home.error?.message ?? "Anime discovery is unavailable."} onRetry={() => void home.refetch()} /></NativeScreen>;
  }
  const hero = home.data.trending[0];
  return (
    <NativeScreen>
      <NativeHeader eyebrow="Aniraku / native" title="Home" action={<SearchAction />} />
      {hero ? <Pressable onPress={() => router.push((`/anime/${hero.id}`) as never)} style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
        <Image source={hero.bannerImage || hero.coverImage?.extraLarge || hero.coverImage?.large || undefined} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.heroMask} />
        <View style={styles.heroCopy}>
          <Signal label="TRENDING NOW" />
          <Text style={styles.heroTitle} numberOfLines={3}>{animeTitle(hero)}</Text>
          <Text style={styles.heroMeta}>{[hero.format, hero.episodes ? `${hero.episodes} EP` : null, hero.averageScore ? `${Math.round(hero.averageScore)}%` : null].filter(Boolean).join(" · ")}</Text>
          <NothingButton label="Open title" onPress={() => router.push((`/anime/${hero.id}`) as never)} />
        </View>
      </Pressable> : null}
      <View style={styles.protocol}><DotLabel>Discovery protocol</DotLabel><Text style={styles.protocolText}>Live metadata, real airing context, and a native experience that stays out of the way.</Text></View>
      <AnimeRail label="01 / MOMENTUM" title="Trending now" items={home.data.trending.slice(1)} />
      <AnimeRail label="02 / SIGNAL" title="Popular releases" items={home.data.popular} />
      <AnimeRail label="03 / NEXT" title="Upcoming schedule" items={home.data.upcoming} />
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 394, borderRadius: 22, overflow: "hidden", justifyContent: "flex-end", backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line },
  heroPressed: { opacity: 0.88 },
  heroMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)" },
  heroCopy: { gap: 12, padding: 19, backgroundColor: "rgba(7,7,7,0.76)" },
  heroTitle: { color: nothing.white, fontWeight: "900", fontSize: 30, letterSpacing: -1, lineHeight: 34 },
  heroMeta: { color: nothing.muted, fontFamily: "monospace", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  protocol: { gap: 6, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  protocolText: { color: nothing.muted, lineHeight: 20, fontSize: 13 },
});
