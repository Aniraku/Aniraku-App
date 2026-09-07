import { useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { AppIcon } from "@/components/app-icon";
import type { Anime } from "@/lib/types";
import { animeTitle } from "@/lib/types";
import { nothing, Signal } from "@/components/nothing-ui";

type ActionItem = { label: string; icon: string; onPress: () => void };

function showQuickFeedback(message: string) {
  Alert.alert("", message, [{ text: "OK" }], { cancelable: true });
}

export function AnimeCard({ anime, compact = false }: { anime: Anime; compact?: boolean }) {
  const title = animeTitle(anime);
  const artwork = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const [menuVisible, setMenuVisible] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const actions: ActionItem[] = [
    {
      label: "Add to Library",
      icon: "bookmark",
      onPress: () => {
        showQuickFeedback(`Added "${title}" to your library`);
      },
    },
    {
      label: "Mark as Watched",
      icon: "check-circle",
      onPress: () => {
        showQuickFeedback(`"${title}" marked as watched`);
      },
    },
    {
      label: "Share",
      icon: "share",
      onPress: () => {
        showQuickFeedback(`Sharing "${title}"…`);
      },
    },
    {
      label: "Open in Browser",
      icon: "external-link",
      onPress: () => {
        const url = `https://anilist.co/anime/${anime.id}`;
        void Linking.openURL(url).catch(() => {
          showQuickFeedback("Unable to open browser");
        });
      },
    },
  ];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        accessibilityHint="Double tap to view anime details. Long press for more options."
        onPress={() => {
          cancelLongPress();
          void Haptics.selectionAsync();
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

      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuVisible(false)}>
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
                  setMenuVisible(false);
                  setTimeout(() => action.onPress(), 150);
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
    </>
  );
}

const styles = StyleSheet.create({
  card: { width: 144, gap: 8 },
  compactCard: { width: 124 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  media: { height: 204, borderRadius: 6, overflow: "hidden", backgroundColor: nothing.raised },
  artFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#242422" },
  fallbackInitial: { color: nothing.dim, fontSize: 54, fontWeight: "900" },
  poster: { ...StyleSheet.absoluteFillObject },
  topline: { position: "absolute", left: 7, top: 7, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4, backgroundColor: "rgba(9,9,9,0.74)" },
  meta: { gap: 3 },
  title: { color: nothing.white, fontSize: 13, fontWeight: "900", lineHeight: 17 },
  detail: { color: nothing.muted, fontFamily: "monospace", fontSize: 8, fontWeight: "800", letterSpacing: 0.35 },
  backdrop: { flex: 1, padding: 20, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.76)" },
  sheet: { gap: 0, padding: 4, borderRadius: 10, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  sheetHeader: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  sheetTitle: { color: nothing.white, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  divider: { height: 1, backgroundColor: nothing.line, marginHorizontal: 10 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  actionPressed: { backgroundColor: nothing.raised },
  actionLabel: { color: nothing.white, fontSize: 14, fontWeight: "700" },
});
