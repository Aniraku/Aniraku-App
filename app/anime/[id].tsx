import { useMemo, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getAnimeById } from "@/lib/anilist";
import { getEpisodes } from "@/lib/aniraku-api";
import { animeTitle } from "@/lib/types";
import { chooseResumeEpisode } from "@/lib/watch-progress";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useComments } from "@/hooks/use-comments";
import { useEpisodeRatings } from "@/hooks/use-episode-ratings";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, NothingButton, NothingCard, nothing, Signal } from "@/components/nothing-ui";
import { NativeHeader, NativeScreen } from "@/components/screen";

export default function AnimeDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const auth = useAnirakuAuth();
  const anime = useQuery({ queryKey: ["anime", id], queryFn: () => getAnimeById(id), enabled: Number.isFinite(id) });
  const episodes = useQuery({ queryKey: ["episodes", id], queryFn: () => getEpisodes(id), enabled: Number.isFinite(id) });
  const history = useWatchHistory();
  const bookmarks = useBookmarks();
  const ratings = useEpisodeRatings(id);
  const comments = useComments(id);
  const [comment, setComment] = useState("");
  const episodeRows = useMemo(() => episodes.data?.slice(0, 24) ?? [], [episodes.data]);
  const animeHistory = useMemo(() => history.history.data?.filter((entry) => entry.anime_id === id) ?? [], [history.history.data, id]);
  const resumeEpisode = useMemo(() => chooseResumeEpisode(animeHistory), [animeHistory]);

  if (anime.isPending) return <NativeScreen><NativeHeader eyebrow="Title signal" title="Anime" /><LoadingState label="Loading title metadata" /></NativeScreen>;
  if (anime.isError || !anime.data) return <NativeScreen><NativeHeader eyebrow="Title signal" title="Anime" /><ErrorState message={anime.error?.message ?? "Title unavailable."} onRetry={() => void anime.refetch()} /></NativeScreen>;
  const data = anime.data;
  const title = animeTitle(data);
  const openEpisode = (episode: number) => router.push({ pathname: "/watch/[id]", params: { id: String(id), episode: String(episode), title, image: data.coverImage?.extraLarge || data.coverImage?.large || "" } } as never);
  const sendComment = () => comments.add.mutate({ content: comment }, { onSuccess: () => setComment("") });
  const displayedResume = Math.min(resumeEpisode, Math.max(data.episodes ?? resumeEpisode, 1));

  return <NativeScreen>
    <View style={styles.backdrop}><Image source={data.bannerImage || data.coverImage?.extraLarge || data.coverImage?.large || undefined} style={StyleSheet.absoluteFill} contentFit="cover" /><View style={styles.backdropMask} /></View>
    <NativeHeader eyebrow="Aniraku / title" title="Detail" />
    <View style={styles.hero}><Image source={data.coverImage?.extraLarge || data.coverImage?.large || undefined} style={styles.poster} contentFit="cover" /><View style={styles.titleBlock}><Signal label={data.status || "ANIME"} /><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{[data.format, data.episodes ? `${data.episodes} EP` : null, data.averageScore ? `${Math.round(data.averageScore)}%` : null].filter(Boolean).join(" · ")}</Text></View></View>
    <View style={styles.actions}><View style={styles.actionCell}><NothingButton label={animeHistory.length ? `Continue episode ${displayedResume}` : "Watch episode 1"} onPress={() => openEpisode(displayedResume)} /></View><Pressable accessibilityRole="button" onPress={() => auth.user ? bookmarks.toggle.mutate(data) : router.push("/auth" as never)} style={({ pressed }) => [styles.bookmark, bookmarks.isBookmarked(id) && styles.bookmarkActive, pressed && styles.pressed]}><Text style={[styles.bookmarkLabel, bookmarks.isBookmarked(id) && styles.bookmarkActiveLabel]}>{bookmarks.isBookmarked(id) ? "SAVED" : "SAVE"}</Text></Pressable></View>
    {animeHistory.length ? <NothingCard style={styles.continueCard}><DotLabel tone="live">Continue watching</DotLabel><Text style={styles.continueText}>Your latest completed episode is honored before any earlier partial progress. Resume points always follow the furthest completed episode.</Text></NothingCard> : null}
    <NothingCard style={styles.summary}><DotLabel>Synopsis</DotLabel><Text style={styles.copy}>{(data.description || "No synopsis is currently available.").replace(/<[^>]+>/g, "")}</Text>{data.genres?.length ? <Text style={styles.genre}>{data.genres.join(" · ")}</Text> : null}</NothingCard>
    <View style={styles.episodeHeading}><View><DotLabel>Episode matrix</DotLabel><Text style={styles.heading}>Available episodes</Text></View><Text style={styles.count}>{episodes.isPending ? "…" : String(episodes.data?.length ?? 0).padStart(2, "0")}</Text></View>
    {episodes.isPending ? <LoadingState label="Checking real episode availability" /> : episodes.isError ? <ErrorState message="Episode availability is unavailable." onRetry={() => void episodes.refetch()} /> : <View style={styles.episodeList}>{episodeRows.map((episode) => { const score = ratings.scoreFor(episode.number); const seen = animeHistory.find((entry) => entry.episode_number === episode.number); return <Pressable key={episode.number} onPress={() => openEpisode(episode.number)} style={({ pressed }) => pressed && styles.pressed}><NothingCard style={styles.episode}><Text style={styles.episodeNumber}>{String(episode.number).padStart(2, "0")}</Text><View style={styles.episodeBody}><Text style={styles.episodeTitle} numberOfLines={1}>{episode.title || `Episode ${episode.number}`}</Text><Text style={styles.episodeMeta}>{seen ? `PROGRESS ${Math.round((seen.progress / Math.max(seen.duration, 1)) * 100)}%` : episode.isFiller ? "FILLER" : "READY TO WATCH"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Rate episode ${episode.number}`} onPress={(event) => { event.stopPropagation(); if (!auth.user) { router.push("/auth" as never); return; } ratings.setRating.mutate({ episode: episode.number, score: score ? score % 10 + 1 : 8 }); }} style={styles.rating}><Text style={styles.ratingText}>{score ? `${score}/10` : "RATE"}</Text></Pressable></NothingCard></Pressable>; })}</View>}
    <View style={styles.commentHeading}><DotLabel>Community</DotLabel><Text style={styles.heading}>Comments</Text></View>
    <NothingCard style={styles.commentComposer}>{auth.user ? <><TextInput value={comment} onChangeText={setComment} placeholder="Add a respectful comment" placeholderTextColor={nothing.dim} style={styles.commentInput} multiline maxLength={2000} /><NothingButton label={comments.add.isPending ? "Posting…" : "Post comment"} disabled={!comment.trim() || comments.add.isPending} onPress={sendComment} /></> : <><Text style={styles.copy}>Use a verified Aniraku account to join the discussion.</Text><NothingButton label="Sign in to comment" variant="outline" onPress={() => router.push("/auth" as never)} /></>}</NothingCard>
    {comments.comments.isPending ? <LoadingState label="Loading community comments" /> : comments.comments.data?.map((item) => <NothingCard key={item.id} style={styles.comment}><Text style={styles.commentMeta}>{item.episode_number ? `EP ${item.episode_number}` : "ANIME"} · {new Date(item.created_at).toLocaleDateString()}</Text><Text style={styles.commentText}>{item.content}</Text></NothingCard>)}
  </NativeScreen>;
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", left: 0, right: 0, top: 0, height: 330, opacity: 0.28 },
  backdropMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9,9,9,0.56)" },
  hero: { flexDirection: "row", gap: 15, alignItems: "flex-end" },
  poster: { width: 122, height: 180, borderRadius: 16, backgroundColor: nothing.raised, borderWidth: 1, borderColor: nothing.line },
  titleBlock: { flex: 1, gap: 8, paddingBottom: 5 },
  title: { color: nothing.white, fontSize: 26, fontWeight: "900", lineHeight: 30, letterSpacing: -0.7 },
  meta: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 9 },
  actionCell: { flex: 1 },
  bookmark: { minWidth: 72, minHeight: 50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, borderRadius: 14, backgroundColor: nothing.surface },
  bookmarkActive: { borderColor: nothing.white, backgroundColor: nothing.white },
  bookmarkLabel: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 10, letterSpacing: 0.8 },
  bookmarkActiveLabel: { color: nothing.black },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  continueCard: { padding: 16, gap: 7, borderColor: "rgba(150,211,123,0.38)" },
  continueText: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  summary: { padding: 17, gap: 9 },
  copy: { color: nothing.muted, fontSize: 14, lineHeight: 21 },
  genre: { color: nothing.white, fontFamily: "monospace", fontSize: 10, lineHeight: 15, letterSpacing: 0.4 },
  episodeHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  commentHeading: { gap: 4, marginTop: 4 },
  heading: { color: nothing.white, fontSize: 21, fontWeight: "900", marginTop: 4 },
  count: { color: nothing.dim, fontFamily: "monospace", fontSize: 12 },
  episodeList: { gap: 8 },
  episode: { minHeight: 66, flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  episodeNumber: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 16 },
  episodeBody: { flex: 1, gap: 3 },
  episodeTitle: { color: nothing.white, fontSize: 14, fontWeight: "700" },
  episodeMeta: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, letterSpacing: 0.7 },
  rating: { minWidth: 48, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line },
  ratingText: { color: nothing.white, fontFamily: "monospace", fontWeight: "800", fontSize: 9 },
  commentComposer: { padding: 14, gap: 12 },
  commentInput: { minHeight: 82, color: nothing.white, fontSize: 14, textAlignVertical: "top", borderBottomWidth: 1, borderBottomColor: nothing.line, paddingBottom: 12 },
  comment: { padding: 14, gap: 7 },
  commentMeta: { color: nothing.dim, fontFamily: "monospace", fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  commentText: { color: nothing.white, fontSize: 14, lineHeight: 20 },
});
