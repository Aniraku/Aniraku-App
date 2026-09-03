import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getHomeAnime } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import { AnimeRail } from "@/components/anime-rail";
import { ErrorState, LoadingState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";
import { AppIcon } from "@/components/app-icon";
import { InAppEpisodeAlertMonitor } from "@/hooks/use-in-app-episode-alerts";
import { useWatchHistory } from "@/hooks/use-watch-history";

function titleFacts(format?: string | null, episodes?: number | null, score?: number | null) {
  return [format, episodes ? `${episodes} EP` : null, score ? `${Math.round(score)}%` : null].filter(Boolean).join(" · ");
}

function ContinueWatchingRail() {
  const { history } = useWatchHistory();
  if (!history.isSuccess || !history.data?.length) return null;
  const recent = history.data.slice(0, 10);
  return (
    <View style={styles.continueSection}>
      <View style={styles.continueHead}>
        <View style={styles.continueLabel}><AppIcon name="play-circle" size={14} color={nothing.red} /><Text style={styles.continueLabelText}>CONTINUE WATCHING</Text></View>
        <Pressable onPress={() => router.push("/library" as never)}><Text style={styles.continueSeeAll}>SEE ALL</Text></Pressable>
      </View>
      <View style={styles.continueList}>
        {recent.map((entry) => {
          const progress = entry.duration > 0 ? Math.min(100, (entry.progress / entry.duration) * 100) : 0;
          return (
            <Pressable
              key={`${entry.anime_id}:${entry.episode_number}`}
              onPress={() => router.push({ pathname: "/watch/[id]", params: { id: String(entry.anime_id), episode: String(entry.episode_number), title: entry.anime_title || "", image: entry.anime_cover || "" } } as never)}
              style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
            >
              <View style={styles.continueImageWrap}>
                {entry.anime_cover ? <Image source={{ uri: entry.anime_cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /> : <View style={styles.continueImageFallback}><Text style={styles.continueImageFallbackText}>{(entry.anime_title || "A").charAt(0)}</Text></View>}
                <View style={styles.continueProgress}><View style={[styles.continueProgressFill, { width: `${progress}%` }]} /></View>
              </View>
              <View style={styles.continueCopy}>
                <Text style={styles.continueTitle} numberOfLines={1}>{entry.anime_title || "Untitled"}</Text>
                <Text style={styles.continueEpisode}>EP {String(entry.episode_number).padStart(2, "0")}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const home = useQuery({ queryKey: ["home-anime"], queryFn: getHomeAnime });

  if (home.isPending) return <NativeScreen><InAppEpisodeAlertMonitor /><NativeHeader eyebrow="FOR YOU" title="Home" action={<SearchAction />} /><LoadingState label="Finding something to watch" /></NativeScreen>;
  if (home.isError || !home.data) return <NativeScreen><InAppEpisodeAlertMonitor /><NativeHeader eyebrow="FOR YOU" title="Home" action={<SearchAction />} /><ErrorState message={home.error?.message ?? "We could not load anime right now."} onRetry={() => void home.refetch()} /></NativeScreen>;

  const hero = home.data.trending[0];
  const next = home.data.upcoming[0];
  return <NativeScreen><InAppEpisodeAlertMonitor />
    <NativeHeader eyebrow="ANIRAKU" title="Home" action={<SearchAction />} />
    {hero ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${animeTitle(hero)}`} onPress={() => router.push((`/anime/${hero.id}`) as never)} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
      <View style={styles.heroFallback}><Text style={styles.heroFallbackText}>{animeTitle(hero).charAt(0)}</Text></View>
      <Image source={{ uri: hero.bannerImage || hero.coverImage?.extraLarge || hero.coverImage?.large || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      <View style={styles.heroMask} />
      <View style={styles.heroTop}><Text style={styles.heroKicker}>FEATURED TONIGHT</Text><View style={styles.heroAction}><AppIcon name="arrow-top-right" size={15} color={nothing.black} /></View></View>
      <View style={styles.heroCopy}><Text style={styles.heroTitle} numberOfLines={3}>{animeTitle(hero)}</Text><Text style={styles.heroMeta}>{titleFacts(hero.format, hero.episodes, hero.averageScore)}</Text></View>
    </Pressable> : null}
    <View style={styles.contextRow}><View style={styles.contextMain}><Text style={styles.contextKicker}>KEEP EXPLORING</Text><Text style={styles.contextTitle}>Find your next favorite.</Text></View>{next ? <Pressable accessibilityRole="button" accessibilityLabel={`Open next release ${animeTitle(next)}`} onPress={() => router.push((`/anime/${next.id}`) as never)} style={({ pressed }) => [styles.nextTile, pressed && styles.pressed]}><Image source={{ uri: next.coverImage?.large || next.coverImage?.extraLarge || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.nextMask} /><View style={styles.nextCopy}><Text style={styles.nextKicker}>UP NEXT</Text><Text style={styles.nextTitle} numberOfLines={2}>{animeTitle(next)}</Text></View></Pressable> : null}</View>
    <ContinueWatchingRail />
    <AnimeRail label="01" title="Trending now" items={home.data.trending.slice(1)} />
    <AnimeRail label="02" title="Popular releases" items={home.data.popular} />
    <AnimeRail label="03" title="Coming soon" items={home.data.upcoming} />
  </NativeScreen>;
}

const styles = StyleSheet.create({
  hero: { minHeight: 430, marginHorizontal: -18, overflow: "hidden", justifyContent: "space-between", backgroundColor: nothing.raised },
  heroFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#222220" },
  heroFallbackText: { color: nothing.dim, fontSize: 96, fontWeight: "900" },
  heroMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.23)" },
  heroTop: { zIndex: 1, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroKicker: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  heroAction: { width: 34, height: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: nothing.white },
  heroCopy: { zIndex: 1, gap: 9, padding: 18, paddingTop: 66, backgroundColor: "rgba(9,9,9,0.7)" },
  heroTitle: { color: nothing.white, fontWeight: "900", fontSize: 36, letterSpacing: -1.35, lineHeight: 39 },
  heroMeta: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "800", letterSpacing: 0.55 },
  contextRow: { flexDirection: "row", alignItems: "flex-end", gap: 16 },
  contextMain: { flex: 1, minHeight: 126, justifyContent: "flex-end", gap: 7 },
  contextKicker: { color: nothing.red, fontFamily: "monospace", fontWeight: "900", fontSize: 8, letterSpacing: 0.8 },
  contextTitle: { color: nothing.white, fontSize: 25, fontWeight: "900", letterSpacing: -0.75, lineHeight: 29 },
  nextTile: { width: 112, minHeight: 146, overflow: "hidden", backgroundColor: nothing.raised },
  nextMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  nextCopy: { flex: 1, justifyContent: "flex-end", padding: 9, gap: 5 },
  nextKicker: { color: nothing.red, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  nextTitle: { color: nothing.white, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  continueSection: { gap: 10, marginBottom: 8 },
  continueHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  continueLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  continueLabelText: { color: nothing.red, fontFamily: "monospace", fontWeight: "900", fontSize: 8, letterSpacing: 0.8 },
  continueSeeAll: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },
  continueList: { gap: 10 },
  continueCard: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64, paddingVertical: 6 },
  continueImageWrap: { width: 80, height: 52, borderRadius: 4, overflow: "hidden", backgroundColor: nothing.raised },
  continueImageFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#222220" },
  continueImageFallbackText: { color: nothing.dim, fontSize: 22, fontWeight: "900" },
  continueProgress: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  continueProgressFill: { height: "100%", backgroundColor: nothing.red },
  continueCopy: { flex: 1, gap: 3 },
  continueTitle: { color: nothing.white, fontSize: 13, fontWeight: "800" },
  continueEpisode: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
});
