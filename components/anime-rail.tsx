import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { Anime } from "@/lib/types";
import { AnimeCard } from "@/components/anime-card";
import { nothing } from "@/components/nothing-ui";

export function AnimeRail({ title, items, seeAllParams }: { title: string; items: Anime[]; seeAllParams?: Record<string, string> }) {
  return <View style={styles.section}>
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title} catalog`} accessibilityHint="Double tap to browse the full catalog" onPress={() => { if (seeAllParams) router.push({ pathname: "/search", params: seeAllParams } as never); else router.push("/catalog" as never); }} style={styles.browse}><Text style={styles.browseText}>View all</Text><Text style={styles.browseArrow}>↗</Text></Pressable>
    </View>
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <AnimeCard anime={item} />}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={3}
      removeClippedSubviews
      accessibilityHint="Swipe to see more items"
    />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: nothing.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.7 },
  browse: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 4 },
  browseText: { color: nothing.muted, fontWeight: "700", fontSize: 12.5 },
  browseArrow: { color: nothing.muted, fontSize: 14, fontWeight: "900" },
  rail: { gap: 14, paddingRight: 18 },
});
