import { useMemo } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getEpisodes } from "@/lib/aniraku-api";
import { getAnimeById } from "@/lib/anilist";
import { enrichEpisodesWithTmdb } from "@/lib/tmdb-episodes";
import { animeTitle } from "@/lib/types";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, NothingButton, NothingCard, nothing } from "@/components/nothing-ui";
import { ErrorState, LoadingState } from "@/components/async-state";
import { NativeHeader, NativeScreen } from "@/components/screen";

export default function EpisodeInfoScreen() {
  const params = useLocalSearchParams<{ id: string; episode?: string; title?: string; image?: string; episodeTitle?: string }>();
  const animeId = Number(params.id);
  const episodeNumber = Math.max(1, Number(params.episode ?? "1"));
  const episodes = useQuery({ queryKey: ["episode-info", animeId], queryFn: () => getEpisodes(animeId), enabled: Number.isFinite(animeId) && animeId > 0, staleTime: 60_000 });
  const anime = useQuery({ queryKey: ["episode-info-anime", animeId], queryFn: () => getAnimeById(animeId), enabled: Number.isFinite(animeId) && animeId > 0, staleTime: 10 * 60_000 });
  const canonicalRows = useMemo(() => episodes.data ?? [], [episodes.data]);
  const episodeSignature = useMemo(() => canonicalRows.map((item) => `${item.number}:${item.title ?? ""}:${item.thumbnail ?? ""}`).join("|"), [canonicalRows]);
  const fallbackThumbnail = anime.data?.bannerImage || anime.data?.coverImage?.extraLarge || anime.data?.coverImage?.large || params.image || "";
  const fallbackTitle = anime.data ? animeTitle(anime.data) : (params.title || "");
  const tmdbEpisodes = useQuery({
    queryKey: ["tmdb-episode-display", animeId, episodeSignature, fallbackThumbnail, fallbackTitle, anime.data?.format],
    queryFn: () => enrichEpisodesWithTmdb(animeId, canonicalRows, { fallbackThumbnail, fallbackTitle, isMovie: anime.data?.format === "MOVIE" }),
    enabled: Number.isFinite(animeId) && animeId > 0 && episodes.isSuccess && canonicalRows.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const rows = tmdbEpisodes.data ?? canonicalRows;
  const selected = rows.find((item) => item.number === episodeNumber);
  const previous = [...rows].reverse().find((item) => item.number < episodeNumber)?.number;
  const next = rows.find((item) => item.number > episodeNumber)?.number;
  const title = params.title || (anime.data ? animeTitle(anime.data) : "Aniraku");
  const image = selected?.thumbnail || params.image || anime.data?.coverImage?.extraLarge || anime.data?.coverImage?.large || "";
  const openWatch = (target = episodeNumber) => router.replace({ pathname: "/watch/[id]", params: { id: String(animeId), episode: String(target), title, image: params.image || anime.data?.coverImage?.extraLarge || anime.data?.coverImage?.large || "" } } as never);
  const goInfo = (target: number) => router.replace({ pathname: "/episode/[id]", params: { id: String(animeId), episode: String(target), title, image: params.image || "" } } as never);

  if (episodes.isPending && anime.isPending) return <NativeScreen><NativeHeader eyebrow="WATCH" title="Episode info" /><LoadingState label="Loading episode information" /></NativeScreen>;
  if (episodes.isError) return <NativeScreen><NativeHeader eyebrow="WATCH" title="Episode info" /><ErrorState message={episodes.error.message || "We could not load episode information."} onRetry={() => void episodes.refetch()} /></NativeScreen>;

  return <NativeScreen>
    <NativeHeader eyebrow="WATCH" title="Episode info" />
    <View style={styles.hero}>{image ? <Image source={{ uri: image }} style={styles.thumbnail} contentFit="cover" transition={0} cachePolicy="memory-disk" /> : <View style={styles.thumbnail} />}<View style={styles.heroCopy}><DotLabel tone="live">EPISODE {String(episodeNumber).padStart(2, "0")}</DotLabel><Text style={styles.animeTitle} numberOfLines={2}>{title}</Text><Text style={styles.meta}>{`EPISODE ${episodeNumber} OF ${rows.length || "?"}${selected?.isFiller ? " · FILLER" : ""}`}</Text></View></View>
    <NothingCard style={styles.detailCard}><DotLabel>EPISODE DETAILS</DotLabel><Text style={styles.episodeTitle}>{selected?.title || params.episodeTitle || `Episode ${episodeNumber}`}</Text><Text style={styles.description}>{selected?.description || "A description is not available from the current provider for this episode."}</Text>{selected?.isFiller ? <Text style={styles.filler}>FILLER / RECAP FLAGGED BY PROVIDER</Text> : null}</NothingCard>
    <NothingButton label={`WATCH EPISODE ${episodeNumber}`} onPress={() => openWatch()} />
    <View style={styles.navigation}><Pressable accessibilityRole="button" disabled={!previous} onPress={() => previous && goInfo(previous)} style={[styles.navigationButton, !previous && styles.disabled]}><AppIcon name="chevron-left" size={18} color={nothing.white} /><Text style={styles.navigationText}>PREVIOUS</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push((`/anime/${animeId}`) as never)} style={[styles.navigationButton, styles.animeButton]}><AppIcon name="movie-open-outline" size={18} color={nothing.black} /><Text style={[styles.navigationText, styles.animeButtonText]}>ALL EPISODES</Text></Pressable><Pressable accessibilityRole="button" disabled={!next} onPress={() => next && goInfo(next)} style={[styles.navigationButton, !next && styles.disabled]}><Text style={styles.navigationText}>NEXT</Text><AppIcon name="chevron-right" size={18} color={nothing.white} /></Pressable></View>
  </NativeScreen>;
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "flex-end", gap: 14 },
  thumbnail: { width: 122, height: 82, borderWidth: 1, borderColor: nothing.line, borderRadius: 5, backgroundColor: nothing.raised },
  heroCopy: { flex: 1, gap: 7 },
  animeTitle: { color: nothing.white, fontSize: 21, fontWeight: "900", lineHeight: 25 },
  meta: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.35 },
  detailCard: { gap: 10, padding: 15 },
  episodeTitle: { color: nothing.white, fontSize: 18, fontWeight: "900", lineHeight: 23 },
  description: { color: nothing.muted, fontSize: 14, lineHeight: 21 },
  filler: { color: nothing.red, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.35 },
  navigation: { flexDirection: "row", gap: 7 },
  navigationButton: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: nothing.line, borderRadius: 4 },
  disabled: { opacity: 0.28 },
  animeButton: { backgroundColor: nothing.white, borderColor: nothing.white },
  navigationText: { color: nothing.white, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.2 },
  animeButtonText: { color: nothing.black },
});
