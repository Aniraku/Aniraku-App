import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, NothingButton, NothingCard, nothing } from "@/components/nothing-ui";
import { useComments, type SharedComment } from "@/hooks/use-comments";
import { useGiphyGifs } from "@/hooks/use-giphy-gifs";
import { APP_CONFIG } from "@/lib/app-config";
import { canSubmitSharedComment, commentAuthorLabel } from "@/lib/comment-content";
import { useAnirakuAuth } from "@/providers/auth-provider";

function authorName(comment: SharedComment) {
  return commentAuthorLabel(comment.author);
}

function elapsedTime(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "NOW";
  if (minutes < 60) return `${minutes}M`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}H`;
  return `${Math.floor(minutes / 1440)}D`;
}

function CommentAuthor({ comment }: { comment: SharedComment }) {
  const avatar = comment.author?.avatar_url;
  const name = authorName(comment);
  return <View style={styles.commentAuthor}>{avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={styles.initialAvatar}><Text style={styles.initialAvatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.authorCopy}><Text style={styles.authorName} numberOfLines={1}>{name}</Text><Text style={styles.authorMeta}>{comment.episode_number ? `EP ${comment.episode_number} · ` : ""}{elapsedTime(comment.created_at)}</Text></View></View>;
}

export function AnimeComments({ animeId }: { animeId: number }) {
  const auth = useAnirakuAuth();
  const comments = useComments(animeId);
  const [content, setContent] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const gifs = useGiphyGifs(pickerOpen, search);
  const canPost = canSubmitSharedComment(content, gifUrl);
  const giphyEnabled = Boolean(APP_CONFIG.giphyApiKey.trim());

  const post = () => comments.add.mutate({ content, gifUrl, spoiler }, { onSuccess: () => { setContent(""); setGifUrl(""); setSpoiler(false); } });
  const chooseGif = (url: string) => { setGifUrl(url); setPickerOpen(false); };
  const reveal = (id: string) => setRevealed((current) => new Set(current).add(id));

  return <View style={styles.section}>
    <View style={styles.heading}><View><DotLabel>COMMUNITY</DotLabel><Text style={styles.title}>Comments</Text></View><Text style={styles.count}>{String(comments.comments.data?.length ?? 0).padStart(2, "0")}</Text></View>
    {auth.user ? <NothingCard style={styles.composer}>
      <TextInput value={content} onChangeText={setContent} placeholder="Share a thought" placeholderTextColor={nothing.dim} style={styles.input} multiline maxLength={2000} textAlignVertical="top" />
      {gifUrl ? <View style={styles.selectedGif}><Image source={{ uri: gifUrl }} style={styles.selectedGifImage} /><Pressable accessibilityRole="button" accessibilityLabel="Remove selected GIF" onPress={() => setGifUrl("")} style={({ pressed }) => [styles.removeGif, pressed && styles.pressed]}><AppIcon name="close" size={16} color={nothing.white} /></Pressable></View> : null}
      <View style={styles.composerActions}>
        {giphyEnabled ? <Pressable accessibilityRole="button" accessibilityLabel="Choose GIF" onPress={() => setPickerOpen((open) => !open)} style={({ pressed }) => [styles.tool, pickerOpen && styles.toolActive, pressed && styles.pressed]}><AppIcon name="image-search-outline" size={16} color={pickerOpen ? nothing.red : nothing.white} /><Text style={[styles.toolText, pickerOpen && styles.toolTextActive]}>GIF</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={spoiler ? "Spoiler protection enabled" : "Mark comment as a spoiler"} accessibilityState={{ selected: spoiler }} onPress={() => setSpoiler((value) => !value)} style={({ pressed }) => [styles.tool, spoiler && styles.toolActive, pressed && styles.pressed]}><AppIcon name="eye-off-outline" size={16} color={spoiler ? nothing.red : nothing.white} /><Text style={[styles.toolText, spoiler && styles.toolTextActive]}>SPOILER</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Post comment" disabled={!canPost || comments.add.isPending} onPress={post} style={({ pressed }) => [styles.send, (!canPost || comments.add.isPending) && styles.sendDisabled, pressed && styles.pressed]}>{comments.add.isPending ? <ActivityIndicator size="small" color={nothing.black} /> : <AppIcon name="send" size={16} color={nothing.black} />}</Pressable>
      </View>
      {pickerOpen ? <View style={styles.picker} accessibilityLabel="GIF picker">
        <View style={styles.pickerHead}><Text style={styles.pickerTitle}>REACTION GIFS</Text><Pressable accessibilityRole="button" accessibilityLabel="Close GIF picker" onPress={() => setPickerOpen(false)} style={styles.pickerClose}><AppIcon name="close" size={16} color={nothing.muted} /></Pressable></View>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search reactions" placeholderTextColor={nothing.dim} style={styles.search} returnKeyType="search" />
        {gifs.isPending ? <View style={styles.gifStatus}><ActivityIndicator size="small" color={nothing.red} /><Text style={styles.gifStatusText}>Loading GIFs</Text></View> : gifs.isError ? <Text style={styles.gifStatusText}>GIFs are unavailable. Try again.</Text> : gifs.data?.length ? <View style={styles.gifGrid}>{gifs.data.map((gif) => <Pressable key={gif.id} accessibilityRole="button" accessibilityLabel={`Use GIF ${gif.label}`} accessibilityHint="Adds this reaction GIF to your comment" onPress={() => chooseGif(gif.url)} style={({ pressed }) => [styles.gifTile, pressed && styles.pressed]}><Image source={{ uri: gif.previewUrl }} style={styles.gifImage} /></Pressable>)}</View> : <Text style={styles.gifStatusText}>No G-rated GIFs found.</Text>}
        <Text style={styles.attribution}>POWERED BY GIPHY</Text>
      </View> : null}
      {comments.add.isError ? <Text style={styles.error}>{comments.add.error.message}</Text> : null}
    </NothingCard> : <NothingCard style={styles.guest}><Text style={styles.guestText}>Sign in with a verified Aniraku account to join the discussion.</Text><NothingButton label="SIGN IN TO COMMENT" variant="outline" onPress={() => router.push("/auth" as never)} /></NothingCard>}
    {comments.comments.isPending ? <LoadingState label="Loading community comments" /> : comments.comments.isError ? <ErrorState message="Comments could not load right now." onRetry={() => void comments.comments.refetch()} /> : !comments.comments.data?.length ? <NothingCard style={styles.empty}><Text style={styles.emptyTitle}>No discussion yet</Text><Text style={styles.emptyText}>Start the conversation without spoiling the story for everyone else.</Text></NothingCard> : <FlatList data={comments.comments.data} keyExtractor={(comment) => comment.id} scrollEnabled={false} contentContainerStyle={styles.list} renderItem={({ item: comment }) => { const hidden = comment.is_spoiler && !revealed.has(comment.id); return <NothingCard style={styles.commentCard}><CommentAuthor comment={comment} />{hidden ? <Pressable accessibilityRole="button" accessibilityLabel="Spoiler hidden. Reveal comment." onPress={() => reveal(comment.id)} style={({ pressed }) => [styles.spoilerShield, pressed && styles.pressed]}><AppIcon name="eye-off-outline" size={17} color={nothing.red} /><Text style={styles.spoilerText}>SPOILER HIDDEN · TAP TO REVEAL</Text></Pressable> : <>{comment.is_spoiler ? <Text style={styles.revealed}>SPOILER REVEALED</Text> : null}{comment.content ? <Text style={styles.commentText}>{comment.content}</Text> : null}{comment.gif_url ? <Image source={{ uri: comment.gif_url }} style={styles.commentGif} resizeMode="cover" /> : null}</>}</NothingCard>; }} />}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10, marginTop: 4 },
  heading: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" },
  title: { color: nothing.white, fontSize: 21, fontWeight: "900", marginTop: 4 },
  count: { color: nothing.dim, fontFamily: "monospace", fontSize: 12 },
  composer: { gap: 8, padding: 10 },
  input: { color: nothing.white, fontSize: 14, lineHeight: 20, minHeight: 48, padding: 0 },
  composerActions: { alignItems: "center", borderTopColor: nothing.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 7, paddingTop: 8 },
  tool: { alignItems: "center", borderColor: "transparent", borderRadius: 7, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 30, paddingHorizontal: 8 },
  toolActive: { backgroundColor: "rgba(255,77,77,0.10)", borderColor: "rgba(255,77,77,0.55)" },
  toolText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.45 },
  toolTextActive: { color: nothing.red },
  send: { alignItems: "center", backgroundColor: nothing.white, borderRadius: 7, height: 30, justifyContent: "center", marginLeft: "auto", width: 34 },
  sendDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  selectedGif: { alignItems: "center", alignSelf: "flex-start", borderColor: nothing.line, borderRadius: 7, borderWidth: 1, flexDirection: "row", gap: 5, overflow: "hidden", padding: 4 },
  selectedGifImage: { borderRadius: 4, height: 46, width: 80 },
  removeGif: { alignItems: "center", height: 28, justifyContent: "center", width: 26 },
  picker: { backgroundColor: nothing.raised, borderColor: nothing.line, borderRadius: 8, borderWidth: 1, gap: 7, padding: 8 },
  pickerHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  pickerTitle: { color: nothing.white, fontFamily: "monospace", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  pickerClose: { alignItems: "center", height: 28, justifyContent: "center", width: 28 },
  search: { backgroundColor: nothing.surface, borderColor: nothing.line, borderRadius: 6, borderWidth: 1, color: nothing.white, fontSize: 13, height: 34, paddingHorizontal: 9 },
  gifGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  gifTile: { aspectRatio: 1, backgroundColor: nothing.surface, borderRadius: 5, overflow: "hidden", width: "31.8%" },
  gifImage: { height: "100%", width: "100%" },
  gifStatus: { alignItems: "center", flexDirection: "row", gap: 7, minHeight: 62, justifyContent: "center" },
  gifStatusText: { color: nothing.muted, fontSize: 12, textAlign: "center" },
  attribution: { alignSelf: "flex-end", color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  error: { color: nothing.red, fontSize: 12, lineHeight: 17 },
  guest: { gap: 10, padding: 14 },
  guestText: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  empty: { gap: 5, padding: 14 },
  emptyTitle: { color: nothing.white, fontSize: 14, fontWeight: "900" },
  emptyText: { color: nothing.muted, fontSize: 13, lineHeight: 18 },
  list: { gap: 8 },
  commentCard: { gap: 9, padding: 11 },
  commentAuthor: { alignItems: "center", flexDirection: "row", gap: 8 },
  avatar: { backgroundColor: nothing.raised, borderRadius: 14, height: 28, width: 28 },
  initialAvatar: { alignItems: "center", backgroundColor: nothing.white, borderRadius: 14, height: 28, justifyContent: "center", width: 28 },
  initialAvatarText: { color: nothing.black, fontSize: 11, fontWeight: "900" },
  authorCopy: { flex: 1, gap: 1 },
  authorName: { color: nothing.white, fontSize: 13, fontWeight: "800" },
  authorMeta: { color: nothing.dim, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.45 },
  commentText: { color: nothing.white, fontSize: 14, lineHeight: 20 },
  commentGif: { alignSelf: "flex-start", borderRadius: 7, height: 144, maxWidth: "100%", width: 220 },
  spoilerShield: { alignItems: "center", backgroundColor: "rgba(255,77,77,0.07)", borderColor: "rgba(255,77,77,0.55)", borderRadius: 7, borderStyle: "dashed", borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 48, paddingHorizontal: 10 },
  spoilerText: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.35, textAlign: "center" },
  revealed: { color: nothing.red, fontFamily: "monospace", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
});
