import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Animated, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { ErrorState, LoadingState } from "@/components/async-state";
import { DotLabel, NothingButton, NothingCard, nothing } from "@/components/nothing-ui";
import { useComments, type SharedComment } from "@/hooks/use-comments";
import { avatarUrl } from "@/lib/aniraku-avatars";
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
  const avatar = avatarUrl(comment.author?.avatar_url);
  const name = authorName(comment);
  return <View style={styles.commentAuthor}>{avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={styles.initialAvatar}><Text style={styles.initialAvatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.authorCopy}><Text style={styles.authorName} numberOfLines={1}>{name}</Text><Text style={styles.authorMeta}>{comment.episode_number ? `EP ${comment.episode_number} · ` : ""}{elapsedTime(comment.created_at)}</Text></View></View>;
}

function SpoilerContent({ children }: { children: React.ReactNode }) {
  const blurAnim = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.timing(blurAnim, { toValue: 0, duration: 500, useNativeDriver: false }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: blurAnim.interpolate({ inputRange: [0, 10], outputRange: [1, 0.6] }) }}>
      <Animated.View style={{ opacity: blurAnim.interpolate({ inputRange: [0, 10], outputRange: [1, 0.3] }) }}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

export function AnimeComments({ animeId, episodeNumber }: { animeId: number; episodeNumber?: number }) {
  const auth = useAnirakuAuth();
  const comments = useComments(animeId, episodeNumber);
  const [content, setContent] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [hideAllSpoilers, setHideAllSpoilers] = useState(false);
  const [sort, setSort] = useState<"popular" | "newest">("newest");
  const [replyTo, setReplyTo] = useState<SharedComment | null>(null);
  const canPost = canSubmitSharedComment(content);
  const sortedComments = useMemo(() => {
    const rows = [...(comments.comments.data ?? [])];
    if (sort === "popular") rows.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    return rows;
  }, [comments.comments.data, sort]);
  const repliesByParent = useMemo(() => {
    const grouped = new Map<string, typeof sortedComments>();
    for (const reply of comments.replies.data ?? []) {
      if (!reply.parent_id) continue;
      const list = grouped.get(reply.parent_id) ?? [];
      list.push(reply);
      grouped.set(reply.parent_id, list);
    }
    return grouped;
  }, [comments.replies.data]);
  useEffect(() => {
    if (replyTo && !sortedComments.some((comment) => comment.id === replyTo.id)) setReplyTo(null);
  }, [replyTo, sortedComments]);

  const post = () => comments.add.mutate({ content, spoiler, episode: episodeNumber, parentId: replyTo?.id ?? null }, { onSuccess: () => { setContent(""); setSpoiler(false); setReplyTo(null); } });
  const reveal = (id: string) => {
    Alert.alert("Spoiler Warning", "This comment contains spoilers. Reveal?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reveal", onPress: () => setRevealed((current) => new Set(current).add(id)) },
    ]);
  };

  return <View style={styles.section}>
    <View style={styles.heading}><View><DotLabel>{episodeNumber ? "EPISODE ACTIVITY" : "COMMUNITY"}</DotLabel><Text style={styles.title}>{episodeNumber ? "Episode discussion" : "Comments"}</Text></View><View style={styles.headingRight}><Pressable accessibilityRole="button" accessibilityLabel={hideAllSpoilers ? "Show all spoilers" : "Hide all spoilers"} accessibilityHint="Toggles visibility of all spoiler comments" onPress={() => setHideAllSpoilers((v) => !v)} style={({ pressed }) => [styles.spoilerToggle, pressed && styles.pressed]}><AppIcon name={hideAllSpoilers ? "eye-off-outline" : "eye-outline"} size={18} color={hideAllSpoilers ? nothing.red : nothing.muted} /></Pressable><Text style={styles.count}>{String(comments.comments.data?.length ?? 0).padStart(2, "0")}</Text></View></View>
    <View style={styles.sortRow}><Text style={styles.sortLabel}>Sort by</Text>
      {(["popular", "newest"] as const).map((option) => <Pressable key={option} accessibilityRole="button" onPress={() => setSort(option)} style={[styles.sortPill, sort === option && styles.sortPillActive]}><Text style={[styles.sortPillText, sort === option && styles.sortPillTextActive]}>{option === "popular" ? "Popular" : "Newest"}</Text></Pressable>)}
    </View>
    {auth.user ? <NothingCard style={styles.composer}>
      {replyTo ? <View style={styles.replyBar}><Text style={styles.replyBarText} numberOfLines={1}>Replying to {authorName(replyTo)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyTo(null)} style={styles.replyBarClose}><AppIcon name="close" size={14} color={nothing.muted} /></Pressable></View> : null}
      <TextInput value={content} onChangeText={setContent} placeholder={replyTo ? "Write a reply" : "Share a thought"} placeholderTextColor={nothing.dim} style={styles.input} multiline maxLength={2000} textAlignVertical="top" />
      <View style={styles.composerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={spoiler ? "Spoiler protection enabled" : "Mark comment as a spoiler"} accessibilityState={{ selected: spoiler }} onPress={() => setSpoiler((value) => !value)} style={({ pressed }) => [styles.tool, spoiler && styles.toolActive, pressed && styles.pressed]}><AppIcon name="eye-off-outline" size={16} color={spoiler ? nothing.red : nothing.white} /><Text style={[styles.toolText, spoiler && styles.toolTextActive]}>SPOILER</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Post comment" disabled={!canPost || comments.add.isPending} onPress={post} style={({ pressed }) => [styles.send, (!canPost || comments.add.isPending) && styles.sendDisabled, pressed && styles.pressed]}>{comments.add.isPending ? <ActivityIndicator size="small" color={nothing.black} /> : <AppIcon name="send" size={16} color={nothing.black} />}</Pressable>
      </View>
      {comments.add.isError ? <Text style={styles.error}>{comments.add.error.message}</Text> : null}
    </NothingCard> : <NothingCard style={styles.guest}><Text style={styles.guestText}>Sign in with a verified Aniraku account to join the discussion.</Text><NothingButton label="SIGN IN TO COMMENT" variant="outline" onPress={() => router.push("/auth" as never)} /></NothingCard>}
    {comments.comments.isPending ? <LoadingState label="Loading community comments" /> : comments.comments.isError ? <ErrorState message="Comments could not load right now." onRetry={() => void comments.comments.refetch()} /> : !sortedComments.length ? <NothingCard style={styles.empty}><Text style={styles.emptyTitle}>No discussion yet</Text><Text style={styles.emptyText}>Start the conversation without spoiling the story for everyone else.</Text></NothingCard> : <FlatList data={sortedComments} keyExtractor={(comment) => comment.id} scrollEnabled={false} contentContainerStyle={styles.list} renderItem={({ item: comment }) => { const hidden = comment.is_spoiler && (hideAllSpoilers || !revealed.has(comment.id)); const isLiked = comments.likedIds.has(comment.id); const isOwn = Boolean(auth.user) && auth.user!.id === comment.user_id; const thread = repliesByParent.get(comment.id) ?? []; return <NothingCard style={styles.commentCard}><CommentAuthor comment={comment} />{hidden ? <Pressable accessibilityRole="button" accessibilityLabel="Spoiler hidden. Reveal comment." onPress={() => reveal(comment.id)} style={({ pressed }) => [styles.spoilerShield, pressed && styles.pressed]}><AppIcon name="eye-off-outline" size={17} color={nothing.red} /><Text style={styles.spoilerText}>SPOILER HIDDEN · TAP TO REVEAL</Text></Pressable> : <>{comment.is_spoiler ? <SpoilerContent><Text style={styles.revealed}>SPOILER REVEALED</Text>{comment.content ? <Text style={styles.commentText}>{comment.content}</Text> : null}{comment.gif_url ? <Image source={{ uri: comment.gif_url }} style={styles.commentGif} resizeMode="contain" /> : null}</SpoilerContent> : <>{comment.content ? <Text style={styles.commentText}>{comment.content}</Text> : null}{comment.gif_url ? <Image source={{ uri: comment.gif_url }} style={styles.commentGif} resizeMode="contain" /> : null}</>}</>}
      <View style={styles.commentActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={isLiked ? "Unlike comment" : "Like comment"} disabled={comments.toggleLike.isPending} onPress={() => void comments.toggleLike.mutate(comment)} style={styles.commentAction}><AppIcon name={isLiked ? "heart" : "heart-outline"} size={16} color={isLiked ? nothing.red : nothing.muted} /><Text style={[styles.commentActionText, isLiked && styles.commentActionTextActive]}>{comment.likes ?? 0}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Reply to comment" onPress={() => setReplyTo(comment)} style={styles.commentAction}><AppIcon name="reply-outline" size={16} color={nothing.muted} /><Text style={styles.commentActionText}>Reply</Text></Pressable>
        {isOwn ? <Pressable accessibilityRole="button" accessibilityLabel="Delete comment" disabled={comments.remove.isPending} onPress={() => void comments.remove.mutate(comment.id)} style={styles.commentAction}><AppIcon name="trash-can-outline" size={16} color={nothing.muted} /></Pressable> : null}
      </View>
      {thread.map((reply) => { const replyHidden = reply.is_spoiler && (hideAllSpoilers || !revealed.has(reply.id)); const replyOwn = Boolean(auth.user) && auth.user!.id === reply.user_id; return <View key={reply.id} style={styles.replyRow}><CommentAuthor comment={reply} />{replyHidden ? <Pressable accessibilityRole="button" accessibilityLabel="Spoiler hidden. Reveal reply." onPress={() => reveal(reply.id)} style={({ pressed }) => [styles.spoilerShield, pressed && styles.pressed]}><AppIcon name="eye-off-outline" size={15} color={nothing.red} /><Text style={styles.spoilerText}>SPOILER HIDDEN · TAP TO REVEAL</Text></Pressable> : <>{reply.content ? <Text style={styles.commentText}>{reply.content}</Text> : null}{reply.gif_url ? <Image source={{ uri: reply.gif_url }} style={styles.commentGif} resizeMode="contain" /> : null}</>}
        <View style={styles.commentActions}>
          {replyOwn ? <Pressable accessibilityRole="button" accessibilityLabel="Delete reply" disabled={comments.remove.isPending} onPress={() => void comments.remove.mutate(reply.id)} style={styles.commentAction}><AppIcon name="trash-can-outline" size={15} color={nothing.muted} /></Pressable> : null}
        </View>
      </View>; })}
    </NothingCard>; }} />}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10, marginTop: 4 },
  heading: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" },
  headingRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  spoilerToggle: { padding: 4 },
  sortRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 2 },
  sortLabel: { color: nothing.white, fontSize: 14, fontWeight: "700" },
  sortPill: { borderColor: nothing.line, borderRadius: 16, borderWidth: 1, minHeight: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  sortPillActive: { borderColor: nothing.red },
  sortPillText: { color: nothing.muted, fontSize: 13, fontWeight: "700" },
  sortPillTextActive: { color: nothing.red },
  title: { color: nothing.white, fontSize: 21, fontWeight: "900", marginTop: 4 },
  count: { color: nothing.dim, fontFamily: "monospace", fontSize: 12 },
  composer: { gap: 8, padding: 10 },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 7, backgroundColor: "rgba(255,77,77,0.10)", borderWidth: 1, borderColor: "rgba(255,77,77,0.45)" },
  replyBarText: { flex: 1, color: nothing.white, fontSize: 14, fontWeight: "700" },
  replyBarClose: { padding: 4 },
  commentActions: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 2 },
  commentAction: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 28, paddingHorizontal: 2 },
  commentActionText: { color: nothing.muted, fontFamily: "monospace", fontSize: 11, fontWeight: "800" },
  commentActionTextActive: { color: nothing.red },
  replyRow: { gap: 7, marginTop: 4, marginLeft: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: nothing.line },
  input: { color: nothing.white, fontSize: 14, lineHeight: 20, minHeight: 48, padding: 0 },
  composerActions: { alignItems: "center", borderTopColor: nothing.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 7, paddingTop: 8 },
  tool: { alignItems: "center", borderColor: "transparent", borderRadius: 7, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 30, paddingHorizontal: 8 },
  toolActive: { backgroundColor: "rgba(255,77,77,0.10)", borderColor: "rgba(255,77,77,0.55)" },
  toolText: { color: nothing.muted, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.45 },
  toolTextActive: { color: nothing.red },
  send: { alignItems: "center", backgroundColor: nothing.white, borderRadius: 7, height: 30, justifyContent: "center", marginLeft: "auto", width: 34 },
  sendDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
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
