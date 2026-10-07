import { memo, useEffect, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { AppIcon } from "@/components/app-icon";
import type { Anime } from "@/lib/types";
import { animeTitle } from "@/lib/types";
import { usePrefetchAnime } from "@/lib/prefetch";
import { POSTER_W, getOptimizedImageUri } from "@/lib/image-optimization";
import { nothing, Signal } from "@/components/nothing-ui";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { useAnirakuAuth } from "@/providers/auth-provider";

type ActionItem = { label: string; icon: string; onPress: () => void };

/** Fade-out time before the sheet's hooks tear down (matches the Modal fade). */
const MENU_CLOSE_FADE_MS = 260;
/** Safety cap: mark-as-watched never writes unbounded rows for 1000-episode franchises. */
const MARK_WATCHED_MAX_EPISODES = 24;

function showQuickFeedback(message: string) {
  Alert.alert("", message, [{ text: "OK" }], { cancelable: true });
}

/** Episodes that have already aired (never the ones still to come). */
function airedEpisodeCount(anime: Anime): number {
  const total = typeof anime.episodes === "number" && anime.episodes > 0 ? anime.episodes : null;
  const next = typeof anime.nextAiringEpisode?.episode === "number" && anime.nextAiringEpisode.episode > 0 ? anime.nextAiringEpisode.episode : null;
  // While airing, `nextAiringEpisode` is the next one TO AIR, so one less has aired.
  const aired = next !== null ? Math.max(0, next - 1) : (total ?? 1);
  return total !== null ? Math.min(aired, total) : aired;
}

/** Same deep-link/share pattern as the detail screen's share button. */
function shareAnime(anime: Anime, title: string) {
  const deepLink = `aniraku://anime/${anime.id}`;
  const webUrl = `https://aniraku.tech/anime/${anime.id}`;
  void Share.share({ title, message: `Watch ${title} on Aniraku\n${deepLink}`, url: Platform.OS === "ios" ? deepLink : webUrl })
    .then((result) => {
      if (result?.action !== "dismissedAction") showQuickFeedback(`Shared "${title}"`);
    })
    .catch(() => {
      showQuickFeedback("Unable to share right now");
    });
}

function AnimeCardBase({ anime, compact = false }: { anime: Anime; compact?: boolean }) {
  const title = animeTitle(anime);
  const rawArtwork = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const artwork = rawArtwork ? getOptimizedImageUri(rawArtwork, POSTER_W) : undefined;
  const [menuVisible, setMenuVisible] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetch = usePrefetchAnime();

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openMenu = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuVisible(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        accessibilityHint="Double tap to view anime details. Long press for more options."
        onPress={() => {
          cancelLongPress();
          void Haptics.selectionAsync();
          prefetch(anime.id);
          router.push((`/anime/${anime.id}`) as never);
        }}
        onPressIn={() => {
          longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null;
            openMenu();
          }, 500);
        }}
        onPressOut={cancelLongPress}
        style={({ pressed }) => [styles.card, compact && styles.compactCard, pressed && styles.pressed]}
      >
        <View style={styles.media}><View style={styles.artFallback}><Text style={styles.fallbackInitial}>{title.charAt(0)}</Text></View>{artwork ? <Image source={{ uri: artwork }} style={styles.poster} contentFit="cover" transition={0} cachePolicy="memory-disk" /> : null}{anime.nextAiringEpisode ? <View style={styles.topline}><Signal label={`EP ${anime.nextAiringEpisode.episode}`} /></View> : null}</View>
        <View style={styles.meta}><Text numberOfLines={2} style={styles.title}>{title}</Text><Text style={styles.detail}>{anime.format || "ANIME"}{anime.averageScore ? ` · ${Math.round(anime.averageScore)}%` : ""}</Text></View>
      </Pressable>

      {/* The sheet mounts its hooks (bookmarks/watch history/auth) only while open,
          so a rail full of cards never opens a realtime channel per card. */}
      {menuVisible ? <AnimeCardMenu anime={anime} title={title} onClose={() => setMenuVisible(false)} /> : null}
    </>
  );
}

/**
 * Memoized: rails render dozens of these and parent screens re-render on every
 * tick (timers, refresh spinners) — with a stable `anime` object from the
 * query cache this skips re-rendering the whole rail. The menu is mounted
 * conditionally inside, so memo cannot strand its internal state.
 */
export const AnimeCard = memo(AnimeCardBase);

function AnimeCardMenu({ anime, title, onClose }: { anime: Anime; title: string; onClose: () => void }) {
  const auth = useAnirakuAuth();
  const bookmarks = useBookmarks();
  const history = useWatchHistory();
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Flip on the next tick so the Modal still plays its fade-in animation.
    const openTimer = setTimeout(() => setVisible(true), 0);
    return () => {
      clearTimeout(openTimer);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const close = (then?: () => void) => {
    setVisible(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onClose();
      then?.();
    }, MENU_CLOSE_FADE_MS);
  };

  const requireAccount = () => {
    if (auth.user) return true;
    router.push("/auth" as never);
    return false;
  };

  const toggleLibrary = () => {
    if (!requireAccount()) return;
    bookmarks.toggle.mutate(anime, {
      onSuccess: (added) => showQuickFeedback(added ? `Added "${title}" to your library` : `Removed "${title}" from your library`),
      onError: (error) => showQuickFeedback(error instanceof Error ? error.message : "Could not update your library"),
    });
  };

  const markAsWatched = () => {
    if (!requireAccount()) return;
    const airedTotal = airedEpisodeCount(anime);
    const episodeCount = Math.min(airedTotal, MARK_WATCHED_MAX_EPISODES);
    if (episodeCount <= 0) {
      showQuickFeedback(`"${title}" has no aired episodes yet`);
      return;
    }
    const episodeDuration = Math.max(1, Math.round((anime.duration || 24) * 60));
    const image = anime.coverImage?.extraLarge || anime.coverImage?.large || null;
    void (async () => {
      try {
        // Bounded concurrency: a whole cour lands in a couple of round trips
        // instead of one serial request per episode.
        const CONCURRENCY = 6;
        for (let start = 1; start <= episodeCount; start += CONCURRENCY) {
          const chunk: Array<Promise<void>> = [];
          const end = Math.min(start + CONCURRENCY - 1, episodeCount);
          for (let episode = start; episode <= end; episode++) {
            chunk.push(history.save.mutateAsync({ animeId: anime.id, animeTitle: title, animeImage: image, episode, progress: episodeDuration, duration: episodeDuration }));
          }
          await Promise.all(chunk);
        }
        showQuickFeedback(episodeCount < airedTotal ? `${episodeCount} episodes of "${title}" marked as watched` : `"${title}" marked as watched`);
      } catch (error) {
        showQuickFeedback(error instanceof Error ? error.message : `"${title}" could not be marked as watched`);
      }
    })();
  };

  const openInBrowser = () => {
    const url = `https://anilist.co/anime/${anime.id}`;
    void Linking.openURL(url).catch(() => {
      showQuickFeedback("Unable to open browser");
    });
  };

  const actions: ActionItem[] = [
    {
      label: "Add to Library",
      icon: "bookmark",
      onPress: () => close(toggleLibrary),
    },
    {
      label: "Mark as Watched",
      icon: "check-circle",
      onPress: () => close(markAsWatched),
    },
    {
      label: "Share",
      icon: "share",
      onPress: () => close(() => shareAnime(anime, title)),
    },
    {
      label: "Open in Browser",
      icon: "external-link",
      onPress: () => close(openInBrowser),
    },
  ];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => close()}>
      <Pressable style={styles.backdrop} onPress={() => close()}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.sheetHeader}>
            <Text numberOfLines={1} style={styles.sheetTitle}>{title}</Text>
          </View>
          <View style={styles.divider} />
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                void Haptics.selectionAsync();
                action.onPress();
              }}
              style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
            >
              <AppIcon name={action.icon as any} size={18} color={nothing.white} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { width: 144, gap: 8 },
  compactCard: { width: 124 },
  pressed: nothing.pressed,
  media: { height: 204, borderRadius: 6, overflow: "hidden", backgroundColor: nothing.raised },
  artFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#242422" },
  fallbackInitial: { color: nothing.dim, fontSize: 54, fontWeight: "900" },
  poster: { ...StyleSheet.absoluteFillObject },
  topline: { position: "absolute", left: 7, top: 7, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.74)" },
  meta: { gap: 3 },
  title: { color: nothing.white, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  detail: { color: nothing.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.35 },
  backdrop: { flex: 1, padding: 20, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.76)" },
  sheet: { gap: 0, padding: 4, borderRadius: 10, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  sheetHeader: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  sheetTitle: { color: nothing.white, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  divider: { height: 1, backgroundColor: nothing.line, marginHorizontal: 10 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  actionPressed: { backgroundColor: nothing.raised },
  actionLabel: { color: nothing.white, fontSize: 14, fontWeight: "700" },
});
