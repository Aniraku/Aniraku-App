import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { getHomeAnime } from "@/lib/anilist";
import { nsfwFilterParam, useNsfwPreference } from "@/lib/nsfw-preference";
import { animeTitle } from "@/lib/types";
import { hapticLight } from "@/lib/haptics";
import { AnimeRail } from "@/components/anime-rail";
import { ErrorState } from "@/components/async-state";
import { nothing } from "@/components/nothing-ui";
import { SkeletonCard, SkeletonRail, SkeletonHero } from "@/components/skeleton";
import { NativeHeader, NativeScreen, SearchAction, NotificationAction } from "@/components/screen";
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
  return (
    <Pressable
      onPress={() => { hapticLight(); router.push({ pathname: "/watch/[id]", params: { id: String(entry.anime_id), episode: String(entry.episode_number), title: entry.anime_title || "", image: entry.anime_cover || "" } } as never); }}
      accessibilityRole="button"
      accessibilityLabel={`Continue ${entry.anime_title || "Untitled"} episode ${entry.episode_number}`}
      style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
    >
      <View style={styles.continueImageWrap}>
        {cover ? <Image source={{ uri: cover }} recyclingKey={cover} onError={() => setFailed(true)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" /> : <View style={styles.continueImageFallback}><Text style={styles.continueImageFallbackText}>{(entry.anime_title || "A").charAt(0)}</Text></View>}
        <View style={styles.continueOverlay}>
          <View style={styles.continuePlayBadge}><AppIcon name="play" size={14} color={nothing.white} /></View>
        </View>
        <View style={styles.continueProgress}><View style={[styles.continueProgressFill, { width: `${progress}%` }]} /></View>
      </View>
      <View style={styles.continueInfo}>
        <Text style={styles.continueTitle} numberOfLines={1}>{entry.anime_title || "Untitled"}</Text>
        <Text style={styles.continueMeta}>EP {String(entry.episode_number).padStart(2, "0")}{progress > 0 ? ` · ${Math.round(progress)}%` : ""}</Text>
      </View>
    </Pressable>
  );
}

function ContinueWatchingRail() {
  const { history } = useWatchHistory();
  if (!history.isSuccess) return null;
  if (!history.data?.length) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Continue Watching</Text>
        </View>
        <View style={styles.continueEmpty}>
          <Text style={styles.continueEmptyTitle}>Nothing here yet</Text>
          <Text style={styles.continueEmptyText}>Start watching to see progress here.</Text>
          <Pressable onPress={() => router.push("/catalog" as never)} style={({ pressed }) => [styles.browseBtn, pressed && styles.pressed]}>
            <Text style={styles.browseBtnText}>Browse anime</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  const recent = history.data.slice(0, 10);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Continue Watching</Text>
        <Pressable onPress={() => router.push("/library" as never)}><Text style={styles.seeAll}>See all</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.continueList}>
        {recent.map((entry) => <ContinueCard key={`${entry.anime_id}:${entry.episode_number}`} entry={entry} />)}
      </ScrollView>
    </View>
  );
}

function TrendingRow({ item, index }: { item: { id: number; coverImage?: { large?: string | null; extraLarge?: string | null } | null; bannerImage?: string | null; averageScore?: number | null; format?: string | null; episodes?: number | null; title?: { romaji?: string | null; english?: string | null; native?: string | null } | null }; index: number }) {
  return (
    <Pressable onPress={() => { hapticLight(); router.push((`/anime/${item.id}`) as never); }} style={({ pressed }) => [styles.trendingRow, pressed && styles.pressed]}>
      <View style={styles.trendingThumb}>
        <Image source={{ uri: item.coverImage?.extraLarge || item.coverImage?.large || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      </View>
      <View style={styles.trendingBody}>
        <Text style={styles.trendingTitle} numberOfLines={1}>{animeTitle(item as any)}</Text>
        <Text style={styles.trendingMeta}>{titleFacts(item.format, item.episodes, item.averageScore)}</Text>
      </View>
      <View style={styles.trendingBadge}>
        <Text style={styles.trendingBadgeText}>HD</Text>
      </View>
    </Pressable>
  );
}

function TrendingGrid({ items }: { items: Array<{ id: number; coverImage?: { large?: string | null; extraLarge?: string | null } | null; bannerImage?: string | null; averageScore?: number | null; format?: string | null; episodes?: number | null; [key: string]: any }> }) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <Pressable onPress={() => router.push("/catalog" as never)}><Text style={styles.seeAll}>See all</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingList}>
        {items.slice(0, 10).map((item, index) => (
          <Pressable key={item.id} onPress={() => { hapticLight(); router.push((`/anime/${item.id}`) as never); }} style={({ pressed }) => [styles.trendingCard, pressed && styles.pressed]}>
            <View style={styles.trendingCardImage}>
              <Image source={{ uri: item.coverImage?.extraLarge || item.coverImage?.large || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
              <View style={styles.trendingCardBadge}><Text style={styles.trendingCardBadgeText}>HD</Text></View>
            </View>
            <Text style={styles.trendingCardTitle} numberOfLines={1}>{animeTitle(item as any)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const nsfw = useNsfwPreference();
  const isAdultParam = nsfwFilterParam(nsfw.enabled);
  const home = useQuery({ queryKey: ["home-anime", isAdultParam], queryFn: () => getHomeAnime(isAdultParam) });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await home.refetch();
    setRefreshing(false);
  };

  if (home.isPending) return <NativeScreen><InAppEpisodeAlertMonitor /><NativeHeader eyebrow="ANIRAKU" title="Home" action={<View style={styles.topActions}><SearchAction /><NotificationAction /></View>} /><ScrollView contentContainerStyle={styles.skeletonContainer} showsVerticalScrollIndicator={false}><SkeletonHero /><Text style={styles.skeletonRailLabel}>TRENDING NOW</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRailRow}>{Array.from({ length: 6 }).map((_, i) => <SkeletonRail key={i} />)}</ScrollView><Text style={styles.skeletonRailLabel}>POPULAR RELEASES</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRailRow}>{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</ScrollView></ScrollView></NativeScreen>;
  if (home.isError || !home.data) return <NativeScreen><InAppEpisodeAlertMonitor /><NativeHeader eyebrow="ANIRAKU" title="Home" action={<View style={styles.topActions}><SearchAction /><NotificationAction /></View>} /><ErrorState message={home.error?.message ?? "We could not load anime right now."} onRetry={() => void home.refetch()} /></NativeScreen>;

  const hero = !home.isPending ? home.data.trending[0] : null;
  return <NativeScreen><InAppEpisodeAlertMonitor />
    <NativeHeader eyebrow="ANIRAKU" title="Home" action={<View style={styles.topActions}><SearchAction /><NotificationAction /></View>} />
    {home.isPending ? <ScrollView contentContainerStyle={styles.skeletonContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.skeletonHeroRow}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</View>
      <Text style={styles.skeletonRailLabel}>TRENDING NOW</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRailRow}>{Array.from({ length: 6 }).map((_, i) => <SkeletonRail key={i} />)}</ScrollView>
    </ScrollView> : <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={nothing.red} />} showsVerticalScrollIndicator={false}>
      {hero ?       <Pressable accessibilityRole="button" accessibilityLabel={`Open ${animeTitle(hero)}`} onPress={() => { hapticLight(); router.push((`/anime/${hero.id}`) as never); }} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
        <View style={styles.heroFallback}><Text style={styles.heroFallbackText}>{animeTitle(hero).charAt(0)}</Text></View>
        <Image source={{ uri: hero.bannerImage || hero.coverImage?.extraLarge || hero.coverImage?.large || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
        <View style={styles.heroMask} />
        <View style={styles.heroContent}>
          <View style={styles.heroTop}>
            <Text style={styles.heroFormat}>{hero.format || "TV"}</Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle} numberOfLines={2}>{animeTitle(hero)}</Text>
            <Text style={styles.heroMeta}>{titleFacts(hero.format, hero.episodes, hero.averageScore)}</Text>
            <View style={styles.heroActions}>
              <Pressable style={({ pressed }) => [styles.heroPlayBtn, pressed && styles.pressed]} onPress={() => { hapticLight(); router.push((`/anime/${hero.id}`) as never); }}>
                <AppIcon name="play" size={16} color={nothing.black} />
                <Text style={styles.heroPlayText}>Play</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.heroListBtn, pressed && styles.pressed]} onPress={() => router.push((`/anime/${hero.id}`) as never)}>
                <AppIcon name="plus" size={16} color={nothing.white} />
                <Text style={styles.heroListText}>My List</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable> : null}
      <ContinueWatchingRail />
      <TrendingGrid items={home.data.trending.slice(1)} />
      <AnimeRail label="02" title="Popular releases" items={home.data.popular} />
      <AnimeRail label="03" title="Coming soon" items={home.data.upcoming} />
    </ScrollView>}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  scrollContent: { gap: 20 },
  topActions: { flexDirection: "row", gap: 8 },
  skeletonContainer: { gap: 18, paddingHorizontal: 18 },
  skeletonHeroRow: { flexDirection: "row", gap: 10 },
  skeletonRailLabel: { color: nothing.muted, fontWeight: "800", fontSize: 10, letterSpacing: 0.8, paddingHorizontal: 4 },
  skeletonRailRow: { gap: 10 },

  hero: { minHeight: 420, marginHorizontal: -18, overflow: "hidden", backgroundColor: nothing.raised },
  heroFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#222220" },
  heroFallbackText: { color: nothing.dim, fontSize: 96, fontWeight: "900" },
  heroMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  heroContent: { flex: 1, justifyContent: "space-between" },
  heroTop: { zIndex: 1, padding: 16 },
  heroFormat: { color: nothing.white, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  heroBottom: { zIndex: 1, gap: 8, padding: 16, paddingTop: 80, backgroundColor: "rgba(9,9,9,0.72)" },
  heroTitle: { color: nothing.white, fontWeight: "900", fontSize: 32, letterSpacing: -1, lineHeight: 36 },
  heroMeta: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  heroPlayBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: nothing.red },
  heroPlayText: { color: nothing.black, fontSize: 13, fontWeight: "800" },
  heroListBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: nothing.line, backgroundColor: "transparent" },
  heroListText: { color: nothing.white, fontSize: 13, fontWeight: "800" },

  section: { gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: nothing.white, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  seeAll: { color: nothing.red, fontSize: 12, fontWeight: "800" },

  continueList: { gap: 10, paddingRight: 4 },
  continueCard: { width: 160, gap: 6 },
  continueImageWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 8, overflow: "hidden", backgroundColor: nothing.raised },
  continueImageFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#222220" },
  continueImageFallbackText: { color: nothing.dim, fontSize: 36, fontWeight: "900" },
  continueOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  continuePlayBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  continueProgress: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  continueProgressFill: { height: "100%", backgroundColor: nothing.red },
  continueInfo: { gap: 2 },
  continueTitle: { color: nothing.white, fontSize: 13, fontWeight: "800", lineHeight: 16 },
  continueMeta: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  continueEmpty: { alignItems: "flex-start", paddingVertical: 20, gap: 6 },
  continueEmptyTitle: { color: nothing.white, fontSize: 16, fontWeight: "900", letterSpacing: -0.4 },
  continueEmptyText: { color: nothing.muted, fontSize: 13, lineHeight: 18 },
  browseBtn: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: nothing.red },
  browseBtnText: { color: nothing.black, fontSize: 12, fontWeight: "800" },

  trendingList: { gap: 10, paddingRight: 4 },
  trendingCard: { width: 120, gap: 6 },
  trendingCardImage: { width: "100%", aspectRatio: 3 / 4, borderRadius: 8, overflow: "hidden", backgroundColor: nothing.raised },
  trendingCardBadge: { position: "absolute", top: 6, left: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, backgroundColor: nothing.red },
  trendingCardBadgeText: { color: nothing.white, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  trendingCardTitle: { color: nothing.white, fontSize: 12, fontWeight: "800", lineHeight: 15 },

  trendingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  trendingThumb: { width: 44, height: 62, borderRadius: 6, overflow: "hidden", backgroundColor: nothing.raised },
  trendingBody: { flex: 1, gap: 3 },
  trendingTitle: { color: nothing.white, fontSize: 14, fontWeight: "800", lineHeight: 17 },
  trendingMeta: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  trendingBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, backgroundColor: nothing.red },
  trendingBadgeText: { color: nothing.white, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },

  pressed: nothing.pressed,
});
