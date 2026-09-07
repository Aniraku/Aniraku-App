import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { getHomeAnime } from "@/lib/anilist";
import { animeTitle } from "@/lib/types";
import { AnimeRail } from "@/components/anime-rail";
import { ErrorState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { SkeletonCard, SkeletonRail } from "@/components/skeleton";
import { NativeHeader, NativeScreen, SearchAction } from "@/components/screen";
import { AppIcon } from "@/components/app-icon";
import { InAppEpisodeAlertMonitor } from "@/hooks/use-in-app-episode-alerts";
import { useWatchHistory } from "@/hooks/use-watch-history";

function titleFacts(format?: string | null, episodes?: number | null, score?: number | null) {
  return [format, episodes ? `${episodes} EP` : null, score ? `${Math.round(score)}%` : null].filter(Boolean).join(" · ");
}

function timeAgo(timestamp?: number | null): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function ContinueCard({ entry }: {
  entry: { anime_id: number; episode_number: number; progress: number; duration?: number | null; anime_title?: string | null; anime_cover?: string | null; timestamp?: number | null };
}) {
  const [failed, setFailed] = useState(false);
  const progress = entry.duration && entry.duration > 0 ? Math.min(100, (entry.progress / entry.duration) * 100) : 0;
  const cover = !failed && entry.anime_cover ? entry.anime_cover : null;
  const watched = timeAgo(entry.timestamp);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/watch/[id]", params: { id: String(entry.anime_id), episode: String(entry.episode_number), title: entry.anime_title || "", image: entry.anime_cover || "" } } as never)}
      accessibilityRole="button"
      accessibilityLabel={`Continue ${entry.anime_title || "Untitled"} episode ${entry.episode_number}`}
      accessibilityHint="Double tap to resume watching"
      style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
    >
      <View style={styles.continueImageWrap}>
        {cover ? <Image source={{ uri: cover }} recyclingKey={cover} onError={() => setFailed(true)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" /> : <View style={styles.continueImageFallback}><Text style={styles.continueImageFallbackText}>{(entry.anime_title || "A").charAt(0)}</Text></View>}
        <View style={styles.continuePlayBadge}><AppIcon name="play" size={16} color={nothing.white} /></View>
        <View style={styles.continueEpBadge}><Text style={styles.continueEpBadgeText}>EP {String(entry.episode_number).padStart(2, "0")}</Text></View>
        {progress > 0 ? <View style={styles.continuePctBadge}><Text style={styles.continuePctBadgeText}>{Math.round(progress)}%</Text></View> : null}
        <View style={styles.continueProgress}><View style={[styles.continueProgressFill, { width: `${progress}%` }]} /></View>
      </View>
      <Text style={styles.continueTitle} numberOfLines={2}>{entry.anime_title || "Untitled"}</Text>
      {watched ? <Text style={styles.continueTimestamp}>Last watched {watched}</Text> : null}
    </Pressable>
  );
}

function ContinueWatchingRail() {
  const { history, synced } = useWatchHistory();
  if (!history.isSuccess) return null;
  if (!history.data?.length) {
    return (
      <View style={styles.continueSection}>
        <View style={styles.continueHead}>
          <View style={styles.continueLabel}><AppIcon name="play-circle" size={14} color={nothing.red} /><Text style={styles.continueLabelText}>CONTINUE WATCHING</Text></View>
        </View>
        <View style={styles.continueEmpty}>
          <MaterialCommunityIcons name="play-circle-outline" size={40} color={nothing.dim} />
          <Text style={styles.continueEmptyTitle}>No watch history yet</Text>
          <Text style={styles.continueEmptyText}>Start watching to see your progress here</Text>
          <Pressable onPress={() => router.push("/catalog" as never)} style={({ pressed }) => [styles.continueBrowseBtn, pressed && styles.pressed]}>
            <Text style={styles.continueBrowseBtnText}>BROWSE ANIME</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  const recent = history.data.slice(0, 10);
  return (
    <View style={styles.continueSection}>
      <View style={styles.continueHead}>
        <View style={styles.continueLabel}>
          <AppIcon name="play-circle" size={14} color={nothing.red} />
          <Text style={styles.continueLabelText}>CONTINUE WATCHING</Text>
          {synced ? <View style={styles.continueSyncBadge}><MaterialCommunityIcons name="sync" size={8} color={nothing.green} /><Text style={styles.continueSyncBadgeText}>SYNCED</Text></View> : null}
        </View>
        <Pressable onPress={() => router.push("/library" as never)}><Text style={styles.continueSeeAll}>SEE ALL</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.continueList}>
        {recent.map((entry) => <ContinueCard key={`${entry.anime_id}:${entry.episode_number}`} entry={entry} />)}
      </ScrollView>
    </View>
  );
}

function TrendingGrid({ items }: { items: Array<{ id: number; coverImage?: { large?: string | null; extraLarge?: string | null } | null; averageScore?: number | null; [key: string]: any }> }) {
  const top8 = items.slice(0, 8);
  if (!top8.length) return null;
  return (
    <View style={styles.trendingSection}>
      <View style={styles.trendingHead}>
        <View style={styles.trendingLabel}>
          <MaterialCommunityIcons name="fire" size={16} color={nothing.red} />
          <Text style={styles.trendingLabelText}>TRENDING NOW</Text>
        </View>
        <Pressable onPress={() => router.push("/catalog" as never)}><Text style={styles.trendingSeeAll}>VIEW ALL</Text></Pressable>
      </View>
      <View style={styles.trendingGrid}>
        {top8.map((item, index) => (
          <Pressable key={item.id} onPress={() => router.push((`/anime/${item.id}`) as never)} style={({ pressed }) => [styles.trendingCard, pressed && styles.pressed]}>
            <View style={styles.trendingImageWrap}>
              <Image source={{ uri: item.coverImage?.extraLarge || item.coverImage?.large || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
              <View style={styles.trendingImageMask} />
              <View style={styles.trendingRankBadge}><Text style={styles.trendingRankText}>{`#${index + 1}`}</Text></View>
              {item.averageScore ? <View style={styles.trendingScoreBadge}><Text style={styles.trendingScoreText}>{Math.round(item.averageScore)}%</Text></View> : null}
            </View>
            <Text style={styles.trendingCardTitle} numberOfLines={2}>{animeTitle(item as any)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const home = useQuery({ queryKey: ["home-anime"], queryFn: getHomeAnime });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await home.refetch();
    setRefreshing(false);
  };

  if (home.isPending) return <NativeScreen><InAppEpisodeAlertMonitor /><NativeHeader eyebrow="FOR YOU" title="Home" action={<SearchAction />} /><ScrollView contentContainerStyle={styles.skeletonContainer} showsVerticalScrollIndicator={false}><View style={styles.skeletonHeroRow}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</View><Text style={styles.skeletonRailLabel}>TRENDING NOW</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRailRow}>{Array.from({ length: 6 }).map((_, i) => <SkeletonRail key={i} />)}</ScrollView></ScrollView></NativeScreen>;
  if (home.isError || !home.data) return <NativeScreen><InAppEpisodeAlertMonitor /><NativeHeader eyebrow="FOR YOU" title="Home" action={<SearchAction />} /><ErrorState message={home.error?.message ?? "We could not load anime right now."} onRetry={() => void home.refetch()} /></NativeScreen>;

  const hero = !home.isPending ? home.data.trending[0] : null;
  const next = !home.isPending ? home.data.upcoming[0] : null;
  return <NativeScreen><InAppEpisodeAlertMonitor />
    <NativeHeader eyebrow="ANIRAKU" title="Home" action={<SearchAction />} />
    {home.isPending ? <ScrollView contentContainerStyle={styles.skeletonContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.skeletonHeroRow}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</View>
      <Text style={styles.skeletonRailLabel}>TRENDING NOW</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRailRow}>{Array.from({ length: 6 }).map((_, i) => <SkeletonRail key={i} />)}</ScrollView>
    </ScrollView> : <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={nothing.red} />} showsVerticalScrollIndicator={false}>
      {hero ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${animeTitle(hero)}`} accessibilityHint="Double tap to view anime details" onPress={() => router.push((`/anime/${hero.id}`) as never)} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
        <View style={styles.heroFallback}><Text style={styles.heroFallbackText}>{animeTitle(hero).charAt(0)}</Text></View>
        <Image source={{ uri: hero.bannerImage || hero.coverImage?.extraLarge || hero.coverImage?.large || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
        <View style={styles.heroMask} />
        <View style={styles.heroTop}><Text style={styles.heroKicker}>FEATURED TONIGHT</Text><View style={styles.heroAction}><AppIcon name="arrow-top-right" size={15} color={nothing.black} /></View></View>
        <View style={styles.heroCopy}><Text style={styles.heroTitle} numberOfLines={3}>{animeTitle(hero)}</Text><Text style={styles.heroMeta}>{titleFacts(hero.format, hero.episodes, hero.averageScore)}</Text></View>
      </Pressable> : null}
      <View style={styles.contextRow}><View style={styles.contextMain}><Text style={styles.contextKicker}>KEEP EXPLORING</Text><Text style={styles.contextTitle}>Find your next favorite.</Text></View>{next ? <Pressable accessibilityRole="button" accessibilityLabel={`Open next release ${animeTitle(next)}`} accessibilityHint="Double tap to view upcoming anime" onPress={() => router.push((`/anime/${next.id}`) as never)} style={({ pressed }) => [styles.nextTile, pressed && styles.pressed]}><Image source={{ uri: next.coverImage?.large || next.coverImage?.extraLarge || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.nextMask} /><View style={styles.nextCopy}><Text style={styles.nextKicker}>UP NEXT</Text><Text style={styles.nextTitle} numberOfLines={2}>{animeTitle(next)}</Text></View></Pressable> : null}</View>
      <ContinueWatchingRail />
      <TrendingGrid items={home.data.trending.slice(1)} />
      <AnimeRail label="02" title="Popular releases" items={home.data.popular} />
      <AnimeRail label="03" title="Coming soon" items={home.data.upcoming} />
    </ScrollView>}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  scrollContent: { gap: 18 },
  skeletonContainer: { gap: 18, paddingHorizontal: 18 },
  skeletonHeroRow: { flexDirection: "row", gap: 10 },
  skeletonRailLabel: { color: nothing.muted, fontFamily: "monospace", fontWeight: "900", fontSize: 8, letterSpacing: 0.8, paddingHorizontal: 4 },
  skeletonRailRow: { gap: 10 },
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
  continueList: { gap: 12, paddingRight: 4 },
  continueCard: { width: 172, gap: 7 },
  continueImageWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 10, overflow: "hidden", backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line },
  continueImageFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#222220" },
  continueImageFallbackText: { color: nothing.dim, fontFamily: "Caveat-Bold", fontSize: 40 },
  continuePlayBadge: { position: "absolute", top: "50%", left: "50%", marginTop: -16, marginLeft: -16, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  continueEpBadge: { position: "absolute", top: 6, left: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: nothing.red },
  continueEpBadgeText: { color: nothing.black, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  continueProgress: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  continueProgressFill: { height: "100%", backgroundColor: nothing.red },
  continuePctBadge: { position: "absolute", top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  continuePctBadgeText: { color: nothing.white, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  continueTitle: { color: nothing.white, fontFamily: "Caveat-Bold", fontSize: 19, lineHeight: 21 },
  continueTimestamp: { color: nothing.dim, fontFamily: "monospace", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  continueEmpty: { alignItems: "center", paddingVertical: 28, gap: 8 },
  continueEmptyTitle: { color: nothing.white, fontFamily: "Caveat-Bold", fontSize: 18 },
  continueEmptyText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  continueBrowseBtn: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 6, backgroundColor: nothing.red },
  continueBrowseBtnText: { color: nothing.black, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  continueSyncBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: "rgba(150,211,123,0.15)" },
  continueSyncBadgeText: { color: nothing.green, fontFamily: "monospace", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  trendingSection: { gap: 12 },
  trendingHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trendingLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  trendingLabelText: { color: nothing.red, fontFamily: "monospace", fontWeight: "900", fontSize: 8, letterSpacing: 0.8 },
  trendingSeeAll: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },
  trendingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  trendingCard: { width: "47.5%", gap: 6 },
  trendingImageWrap: { width: "100%", aspectRatio: 3 / 4, borderRadius: 10, overflow: "hidden", backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line },
  trendingImageMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  trendingRankBadge: { position: "absolute", top: 6, left: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: nothing.red },
  trendingRankText: { color: nothing.black, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  trendingScoreBadge: { position: "absolute", top: 6, right: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  trendingScoreText: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  trendingCardTitle: { color: nothing.white, fontFamily: "Caveat-Bold", fontSize: 16, lineHeight: 19 },
});
