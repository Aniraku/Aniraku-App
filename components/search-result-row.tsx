import { memo } from "react";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { getOptimizedImageUri, THUMBNAIL_W } from "@/lib/image-optimization";
import { usePrefetchAnime } from "@/lib/prefetch";
import { animeTitle, type Anime } from "@/lib/types";

export type SearchRowAnime = Pick<Anime, "id" | "title"> & Partial<Pick<Anime, "format" | "episodes" | "averageScore" | "coverImage">>;

type Props = {
  anime: SearchRowAnime;
  onPress: () => void;
};

/**
 * Shared result row for both search screens. Memoized so the parent's
 * per-render timers (rate-limit countdown, debounce ticks) do not re-render
 * every visible row, and stable in identity so FlatList recycling behaves.
 */
function SearchResultRowImpl({ anime, onPress }: Props) {
  const prefetch = usePrefetchAnime();
  const title = animeTitle(anime);
  const rawImage = anime.coverImage?.extraLarge || anime.coverImage?.large || "";
  const image = rawImage ? getOptimizedImageUri(rawImage, THUMBNAIL_W) : "";
  const format = anime.format || "";
  const episodes = anime.episodes;
  const score = anime.averageScore;
  const meta = [format, episodes ? `${episodes} EP` : null, score ? `${score}%` : null].filter(Boolean).join(" · ");
  const hint = [meta || null, "Open details"].filter(Boolean).join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      onPress={() => {
        prefetch(anime.id);
        onPress();
      }}
      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
    >
      <View style={styles.resultThumb}>
        {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} cachePolicy="memory-disk" /> : null}
        <View style={styles.resultPlayBadge}><AppIcon name="play" size={14} color={nothing.white} /></View>
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle} numberOfLines={2}>{title}</Text>
        {meta ? <Text style={styles.resultMeta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

export const SearchResultRow = memo(SearchResultRowImpl);

const styles = StyleSheet.create({
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: nothing.line },
  resultThumb: { width: 120, height: 68, borderRadius: 8, overflow: "hidden", backgroundColor: nothing.raised },
  resultPlayBadge: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  resultBody: { flex: 1, gap: 4 },
  resultTitle: { color: nothing.white, fontSize: 15, fontWeight: "800", lineHeight: 19 },
  resultMeta: { color: nothing.dim, fontSize: 12, fontWeight: "700" },
  pressed: nothing.pressed,
});
