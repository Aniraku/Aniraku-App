import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { Anime } from "@/lib/types";
import { AnimeCard } from "@/components/anime-card";
import { nothing } from "@/components/nothing-ui";

export function AnimeRail({ label, title, items }: { label: string; title: string; items: Anime[] }) {
  return <View style={styles.section}>
    <View style={styles.heading}>
      <View style={styles.headingCopy}><Text style={styles.label}>{label}</Text><Text style={styles.title}>{title}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title} catalog`} onPress={() => router.push("/catalog" as never)} style={styles.browse}><Text style={styles.browseText}>VIEW ALL</Text><Text style={styles.browseArrow}>↗</Text></Pressable>
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
    />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  headingCopy: { gap: 3 },
  label: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 8, letterSpacing: 0.8 },
  title: { color: nothing.white, marginTop: 3, fontSize: 24, fontWeight: "900", letterSpacing: -0.7 },
  browse: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  browseText: { color: nothing.white, fontFamily: "monospace", fontWeight: "800", fontSize: 8, letterSpacing: 0.4 },
  browseArrow: { color: nothing.red, fontSize: 14, fontWeight: "900" },
  rail: { gap: 14, paddingRight: 18 },
});
