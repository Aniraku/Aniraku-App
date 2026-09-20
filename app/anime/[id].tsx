import { useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { getAnimeById, getRecommendations } from "@/lib/anilist";
import { parseRouteId } from "@/lib/route-params";
import { getEpisodes } from "@/lib/aniraku-api";
import { enrichEpisodesWithTmdb } from "@/lib/tmdb-episodes";
import { groupAnimeRelations } from "@/lib/anime-relations";
import { animeTitle } from "@/lib/types";
import { chooseResumeEpisode } from "@/lib/watch-progress";
import { episodePageCount, episodePageSlice } from "@/lib/watch-engine";
import { isWideLayout } from "@/lib/up-next";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useEpisodeRatings } from "@/hooks/use-episode-ratings";
import { useNotifyMe } from "@/hooks/use-notify-me";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { AnimeComments } from "@/components/anime-comments";
import { ErrorState, LoadingState } from "@/components/async-state";
import { AppIcon } from "@/components/app-icon";
import { AiringSchedule } from "@/components/airing-schedule";
import { DotLabel, NothingButton, nothing, Signal } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";

export default function AnimeDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  // Malformed deep links used to hang on the loading skeleton forever:
  // disabled queries never leave `isPending`. -1 keeps query keys typed
  // while every query stays disabled; the invalid branch below renders.
  const id = parseRouteId(params.id) ?? -1;
  const invalidId = id <= 0;
  const auth = useAnirakuAuth();
  const anime = useQuery({ queryKey: ["anime", id], queryFn: () => getAnimeById(id), enabled: !invalidId });
  const episodes = useQuery({ queryKey: ["episodes", id], queryFn: () => getEpisodes(id), enabled: !invalidId });
  const canonicalEpisodeRows = useMemo(() => episodes.data ?? [], [episodes.data]);
  const episodeSignature = useMemo(() => canonicalEpisodeRows.map((item) => `${item.number}:${item.title ?? ""}:${item.thumbnail ?? ""}`).join("|"), [canonicalEpisodeRows]);
  const fallbackThumbnail = anime.data?.bannerImage || anime.data?.coverImage?.extraLarge || anime.data?.coverImage?.large || "";
  const fallbackTitle = anime.data ? animeTitle(anime.data) : "";
  const tmdbEpisodes = useQuery({
    queryKey: ["tmdb-episode-display", id, episodeSignature, fallbackThumbnail, fallbackTitle, anime.data?.format],
    queryFn: () => enrichEpisodesWithTmdb(id, canonicalEpisodeRows, { fallbackThumbnail, fallbackTitle, isMovie: anime.data?.format === "MOVIE" }),
    enabled: Number.isFinite(id) && id > 0 && episodes.isSuccess && canonicalEpisodeRows.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const ratings = useEpisodeRatings(id);
  const notifyMe = useNotifyMe(id);
  const [episodePage, setEpisodePage] = useState(0);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const { width } = useWindowDimensions();
  const recommendations = useQuery({
    queryKey: ["recommendations", id],
    queryFn: () => getRecommendations(id),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 10 * 60_000,
  });
  // Responsive breakpoint stub: >=900dp uses a two-column episode rhythm.
  // A full list+episodes two-pane is deferred — this keeps the existing
  // single-scroll composition intact on tablets and landscape.
  const twoPane = isWideLayout(width);
  // Match the main Aniraku detail page: preserve the whole canonical backend
  // episode list instead of silently truncating Watch entry points after 24.
  const episodeRows = useMemo(() => {
    const base = tmdbEpisodes.data ?? canonicalEpisodeRows;
    const term = episodeSearch.trim().toLowerCase();
    if (!term) return base;
    return base.filter((ep) => String(ep.number).includes(term) || (ep.title || "").toLowerCase().includes(term));
  }, [canonicalEpisodeRows, tmdbEpisodes.data, episodeSearch]);
  const totalEpisodePages = episodePageCount(episodeRows.length);
  const safeEpisodePage = Math.min(episodePage, totalEpisodePages - 1);
  const pagedEpisodeRows = useMemo(() => episodePageSlice(episodeRows, safeEpisodePage), [episodeRows, safeEpisodePage]);
  const episodePageStart = episodeRows.length ? safeEpisodePage * 50 + 1 : 0;
  const episodePageEnd = Math.min(episodeRows.length, (safeEpisodePage + 1) * 50);
  const animeHistory = useMemo(() => history.history.data?.filter((entry) => entry.anime_id === id) ?? [], [history.history.data, id]);
  const resumeEpisode = useMemo(() => chooseResumeEpisode(animeHistory), [animeHistory]);
  // This hook must run on loading, error, and success renders alike. Reading from
  // query data keeps the relationship list empty until the detail payload exists.
  const relationGroups = useMemo(() => groupAnimeRelations(anime.data?.relations?.edges), [anime.data?.relations?.edges]);

  useEffect(() => {
    setEpisodePage((current) => Math.min(current, totalEpisodePages - 1));
  }, [totalEpisodePages]);

  if (invalidId) return <NativeScreen><NativeHeader eyebrow="ANIME" title="Anime" /><ErrorState message="This anime link is invalid." onRetry={() => router.back()} retryLabel="GO BACK" /></NativeScreen>;
  if (anime.isPending) return <NativeScreen><NativeHeader eyebrow="ANIME" title="Anime" /><LoadingState label="Loading anime details" /></NativeScreen>;
  if (anime.isError || !anime.data) return <NativeScreen><NativeHeader eyebrow="ANIME" title="Anime" /><ErrorState message={anime.error?.message ?? "We could not load this anime."} onRetry={() => void anime.refetch()} /></NativeScreen>;
  const data = anime.data;
  const title = animeTitle(data);
  const openEpisode = (episode: number) => router.push({ pathname: "/watch/[id]", params: { id: String(id), episode: String(episode), title, image: data.coverImage?.extraLarge || data.coverImage?.large || "" } } as never);
  const lastAvailableEpisode = episodeRows.at(-1)?.number ?? Math.max(data.episodes ?? 1, 1);
  const displayedResume = Math.min(resumeEpisode, lastAvailableEpisode);

  return <NativeScreen>
    <View style={styles.backdrop}><Image source={{ uri: data.bannerImage || data.coverImage?.extraLarge || data.coverImage?.large || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.backdropMask} /></View>
    <NativeHeader eyebrow="ANIME" title="Details" />
    <View style={styles.hero}><Image source={{ uri: data.coverImage?.extraLarge || data.coverImage?.large || "" }} style={styles.poster} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.titleBlock}><Signal label={data.status || "ANIME"} tone="live" /><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{[data.format, data.episodes ? `${data.episodes} EP` : null, data.averageScore ? `${Math.round(data.averageScore)}% MATCH` : null].filter(Boolean).join(" · ")}</Text></View></View>
    <View style={styles.actions}><View style={styles.actionCell}><NothingButton label={animeHistory.length ? `Continue episode ${displayedResume}` : "Watch episode 1"} onPress={() => openEpisode(displayedResume)} /></View><Pressable accessibilityRole="button" onPress={() => auth.user ? bookmarks.toggle.mutate(data) : router.push("/auth" as never)} style={({ pressed }) => [styles.bookmark, bookmarks.isBookmarked(id) && styles.bookmarkActive, pressed && styles.pressed]}><Text style={[styles.bookmarkLabel, bookmarks.isBookmarked(id) && styles.bookmarkActiveLabel]}>{bookmarks.isBookmarked(id) ? "SAVED" : "SAVE"}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => auth.user ? notifyMe.toggle() : router.push("/auth" as never)} style={({ pressed }) => [styles.notifyBtn, notifyMe.enabled && styles.notifyBtnActive, pressed && styles.pressed]}><AppIcon name={notifyMe.enabled ? "bell" : "bell-outline"} size={16} color={notifyMe.enabled ? nothing.red : nothing.white} /></Pressable><Pressable accessibilityRole="button" onPress={() => { const deepLink = `aniraku://anime/${id}`; const webUrl = `https://aniraku.tech/anime/${id}`; Share.share({ title, message: `Watch ${title} on Aniraku\n${deepLink}`, url: Platform.OS === "ios" ? deepLink : webUrl }).catch(() => {}); }} style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}><AppIcon name="share-variant" size={18} color={nothing.white} /></Pressable></View>
    <AiringSchedule nextAiringEpisode={data.nextAiringEpisode} totalEpisodes={data.episodes} />
    {animeHistory.length ? <View style={styles.continueRow}><View style={styles.continueRule} /><Text style={styles.continueText}>Continue from episode {displayedResume}.</Text></View> : null}
    <View style={styles.summary}><Text style={styles.copy}>{(data.description || "No synopsis available.").replace(/<[^>]+>/g, "")}</Text>{data.genres?.length ? <View style={styles.genreRow}>{data.genres.map((genre) => <Pressable key={genre} onPress={() => router.push({ pathname: "/search", params: { genre } } as never)} style={({ pressed }) => [styles.genreChip, pressed && styles.pressed]}><Text style={styles.genreChipText}>{genre}</Text></Pressable>)}</View> : null}</View>
    {relationGroups.length ? <View style={styles.relationsSection}><View style={styles.relationsHeading}><View><DotLabel>RELATIONSHIPS</DotLabel><Text style={styles.heading}>Explore this universe</Text></View><Text style={styles.count}>{String(relationGroups.reduce((count, group) => count + group.relations.length, 0)).padStart(2, "0")}</Text></View>{relationGroups.map((group) => <View key={group.key} style={styles.relationGroup}><View style={styles.relationGroupHeading}><View style={styles.relationGroupCopy}><Text style={styles.relationGroupTitle}>{group.title}</Text><Text style={styles.relationGroupSubtitle}>{group.subtitle}</Text></View><Text style={styles.relationGroupCount}>{String(group.relations.length).padStart(2, "0")}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relationRailContent} accessibilityLabel={`${group.title}: ${group.subtitle}`}>{group.relations.map((relation) => { const relationTitle = animeTitle(relation.anime); const cover = relation.anime.coverImage?.large || relation.anime.coverImage?.extraLarge || ""; return <Pressable key={relation.id} accessibilityRole="button" accessibilityLabel={`Open ${relation.label}: ${relationTitle}`} onPress={() => router.push({ pathname: "/anime/[id]", params: { id: String(relation.id) } } as never)} style={({ pressed }) => [styles.relationTile, pressed && styles.pressed]}><View style={styles.relationPoster}>{cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /> : <Text style={styles.relationPosterFallback}>ANIME</Text>}</View><View style={styles.relationTileBody}><Text style={styles.relationLabel}>{relation.label}</Text><Text style={styles.relationTitle} numberOfLines={2}>{relationTitle}</Text><Text style={styles.relationMeta} numberOfLines={1}>{[relation.anime.format, relation.anime.episodes ? `${relation.anime.episodes} EP` : null, relation.anime.status].filter(Boolean).join(" · ") || "OPEN DETAILS"}</Text></View></Pressable>; })}</ScrollView></View>)}</View> : null}
    {recommendations.data?.length ? <View style={styles.recommendationsSection}><View style={styles.recommendationsHeading}><View><DotLabel tone="signal">RECOMMENDATIONS</DotLabel><Text style={styles.heading}>More like this</Text></View><Text style={styles.count}>{String(recommendations.data.length).padStart(2, "0")}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationsRail}>{recommendations.data.map((rec) => { const recTitle = animeTitle(rec); const cover = rec.coverImage?.extraLarge || rec.coverImage?.large || ""; return <Pressable key={rec.id} accessibilityRole="button" accessibilityLabel={`Open recommended: ${recTitle}`} onPress={() => router.push({ pathname: "/anime/[id]", params: { id: String(rec.id) } } as never)} style={({ pressed }) => [styles.recCard, pressed && styles.pressed]}><View style={styles.recPoster}>{cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /> : <Text style={styles.recPosterFallback}>ANIME</Text>}</View><Text style={styles.recTitle} numberOfLines={2}>{recTitle}</Text><Text style={styles.recMeta}>{[rec.format, rec.episodes ? `${rec.episodes} EP` : null, rec.averageScore ? `${Math.round(rec.averageScore)}%` : null].filter(Boolean).join(" · ")}</Text></Pressable>; })}</ScrollView></View> : null}
    <View style={styles.episodeHeading}><View><DotLabel>EPISODES</DotLabel><Text style={styles.heading}>Choose an episode</Text></View><Text style={styles.count}>{episodes.isPending ? "…" : String(episodeRows.length).padStart(2, "0")}</Text></View>
    <View style={styles.epSearch}><AppIcon name="magnify" size={14} color={nothing.muted} /><TextInput value={episodeSearch} onChangeText={setEpisodeSearch} placeholder="Search episode..." placeholderTextColor={nothing.dim} style={styles.epSearchInput} returnKeyType="done" /></View>
    {episodes.isPending ? <LoadingState label="Finding available episodes" /> : episodes.isError ? <ErrorState message={episodes.error?.message || "We could not load episodes right now."} onRetry={() => void episodes.refetch()} /> : !episodeRows.length ? <View style={styles.emptyEpisodes}><DotLabel tone="muted">NO EPISODES YET</DotLabel><Text style={styles.copy}>No episodes yet. Check back soon.</Text><NothingButton label="CHECK AGAIN" variant="outline" onPress={() => void episodes.refetch()} /></View> : <><View style={styles.episodePageBar}><Text style={styles.episodePageText}>{`SHOWING ${String(episodePageStart).padStart(2, "0")}–${String(episodePageEnd).padStart(2, "0")} · PAGE ${safeEpisodePage + 1}/${totalEpisodePages}`}</Text>{totalEpisodePages > 1 ? <View style={styles.episodePager}><Pressable accessibilityRole="button" accessibilityLabel="Previous episode page" disabled={safeEpisodePage === 0} onPress={() => setEpisodePage((value) => Math.max(0, value - 1))} style={[styles.episodePageButton, safeEpisodePage === 0 && styles.episodePageButtonDisabled]}><Text style={styles.episodePageButtonText}>PREV</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Next episode page" disabled={safeEpisodePage >= totalEpisodePages - 1} onPress={() => setEpisodePage((value) => Math.min(totalEpisodePages - 1, value + 1))} style={[styles.episodePageButton, safeEpisodePage >= totalEpisodePages - 1 && styles.episodePageButtonDisabled]}><Text style={styles.episodePageButtonText}>NEXT</Text></Pressable></View> : null}</View><View style={[styles.episodeList, twoPane && styles.episodeListWide]}>{pagedEpisodeRows.map((episode) => { const score = ratings.scoreFor(episode.number); const seen = animeHistory.find((entry) => entry.episode_number === episode.number); const progress = seen ? Math.min(100, Math.round((seen.progress / Math.max(seen.duration, 1)) * 100)) : 0; return <View key={episode.number} style={[styles.episode, twoPane && styles.twoPaneEpisode]}><Pressable accessibilityRole="button" accessibilityLabel={`Watch episode ${episode.number}: ${episode.title || "Untitled"}`} onPress={() => openEpisode(episode.number)} style={({ pressed }) => [styles.episodeMain, pressed && styles.pressed]}><View style={styles.episodeVisual}><Image source={{ uri: episode.thumbnail || "" }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" /><View style={styles.episodeVisualMask} /><Text style={styles.episodeNumber}>{String(episode.number).padStart(2, "0")}</Text></View><View style={styles.episodeBody}><Text style={styles.episodeTitle} numberOfLines={2}>{episode.title || `Episode ${episode.number}`}</Text><View style={styles.episodeStatus}><Text style={[styles.episodeMeta, episode.isFiller && styles.fillerMeta]}>{seen ? `${progress}% WATCHED${episode.isFiller ? " · FILLER" : ""}` : episode.isFiller ? "FILLER" : "READY TO WATCH"}</Text>{seen ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View> : null}</View></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Rate episode ${episode.number}`} onPress={(event) => { event.stopPropagation(); if (!auth.user) { router.push("/auth" as never); return; } ratings.setRating.mutate({ episode: episode.number, score: score ? score % 10 + 1 : 8 }); }} style={styles.rating}><Text style={styles.ratingText}>{score ? `${score}/10` : "RATE"}</Text></Pressable></View>; })}</View></>}
    <AnimeComments animeId={id} />
  </NativeScreen>;
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", left: 0, right: 0, top: 0, height: 354, opacity: 0.35 },
  backdropMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,9,9,0.62)" },
  hero: { flexDirection: "row", gap: 15, alignItems: "flex-end" },
  poster: { width: 122, height: 182, borderRadius: 12, backgroundColor: nothing.raised },
  titleBlock: { flex: 1, gap: 8, paddingBottom: 5 },
  title: { color: nothing.white, fontSize: 26, fontWeight: "900", lineHeight: 30, letterSpacing: -0.7 },
  meta: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 9 },
  actionCell: { flex: 1 },
  bookmark: { minWidth: 72, minHeight: 50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 8 },
  bookmarkActive: { borderColor: nothing.red },
  bookmarkLabel: { color: nothing.white, fontWeight: "800", fontSize: 10, letterSpacing: 0.8 },
  bookmarkActiveLabel: { color: nothing.red },
  notifyBtn: { minWidth: 50, minHeight: 50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 8 },
  notifyBtnActive: { borderColor: nothing.red, backgroundColor: "rgba(255,77,77,0.08)" },
  shareBtn: { minWidth: 50, minHeight: 50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 8 },
  pressed: nothing.pressed,
  continueRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  continueRule: { width: 18, height: 2, backgroundColor: nothing.red },
  continueText: { flex: 1, color: nothing.muted, fontSize: 13, lineHeight: 19 },
  summary: { gap: 9, paddingVertical: 4 },
  relationsSection: { gap: 15 },
  relationsHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  relationGroup: { gap: 8 },
  relationGroupHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  relationGroupCopy: { flex: 1, gap: 2 },
  relationGroupTitle: { color: nothing.white, fontSize: 14, fontWeight: "900", lineHeight: 18 },
  relationGroupSubtitle: { color: nothing.dim, fontSize: 10, lineHeight: 14 },
  relationGroupCount: { color: nothing.red, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  relationRailContent: { gap: 9, paddingRight: 8 },
  relationTile: { width: 142, gap: 8 },
  relationPoster: { width: "100%", height: 144, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: nothing.raised },
  relationPosterFallback: { color: nothing.dim, fontSize: 10, fontWeight: "800", letterSpacing: 0.55 },
  relationTileBody: { flex: 1, gap: 4 },
  relationLabel: { color: nothing.red, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
  relationTitle: { color: nothing.white, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  relationMeta: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 10, fontWeight: "700", letterSpacing: 0.45 },
  recommendationsSection: { gap: 12, marginTop: 4 },
  recommendationsHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  recommendationsRail: { gap: 12, paddingRight: 8 },
  recCard: { width: 128, gap: 6 },
  recPoster: { width: "100%", height: 180, borderRadius: 8, overflow: "hidden", backgroundColor: nothing.raised },
  recPosterFallback: { color: nothing.dim, fontSize: 10, fontWeight: "800", letterSpacing: 0.55 },
  recTitle: { color: nothing.white, fontSize: 12, fontWeight: "900", lineHeight: 16 },
  recMeta: { color: nothing.muted, fontFamily: nothing.mono, fontSize: 9, fontWeight: "700", letterSpacing: 0.35 },
  copy: { color: nothing.muted, fontSize: 14, lineHeight: 21 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  genreChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  genreChipText: { color: nothing.white, fontSize: 11, fontWeight: "700" },
  episodeHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  heading: { color: nothing.white, fontSize: 21, fontWeight: "900", marginTop: 4 },
  count: { color: nothing.dim, fontFamily: nothing.mono, fontSize: 12 },
  epSearch: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 4, paddingHorizontal: 10, minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  epSearchInput: { flex: 1, minHeight: 38, color: nothing.white, fontSize: 13 },
  episodeList: { gap: 0, borderTopWidth: 1, borderTopColor: nothing.line },
  episodeListWide: { flexDirection: "row", flexWrap: "wrap" },
  twoPaneEpisode: { flexBasis: "48%", flexGrow: 1 },
  episodePageBar: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9, paddingVertical: 6 },
  episodePageText: { flex: 1, color: nothing.dim, fontFamily: nothing.mono, fontSize: 10, fontWeight: "800", letterSpacing: 0.35 },
  episodePager: { flexDirection: "row", gap: 12 },
  episodePageButton: { minWidth: 51, minHeight: 30, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  episodePageButtonDisabled: { opacity: 0.32 },
  episodePageButtonText: { color: nothing.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.35 },
  emptyEpisodes: { gap: 10, paddingVertical: 12 },
  episode: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingVertical: 9, gap: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  episodeMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  episodeVisual: { width: 86, height: 58, borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: nothing.raised },
  episodeVisualMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  episodeNumber: { zIndex: 1, color: nothing.white, fontFamily: nothing.mono, fontWeight: "900", fontSize: 16 },
  episodeBody: { flex: 1, gap: 5 },
  episodeTitle: { color: nothing.white, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  episodeStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  episodeMeta: { color: nothing.muted, fontFamily: nothing.mono, fontWeight: "800", fontSize: 10, letterSpacing: 0.55 },
  fillerMeta: { color: nothing.muted },
  progressTrack: { flex: 1, maxWidth: 64, height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: nothing.line },
  progressFill: { height: "100%", backgroundColor: nothing.red },
  rating: { minWidth: 48, minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  ratingText: { color: nothing.muted, fontWeight: "800", fontSize: 10 },
});
