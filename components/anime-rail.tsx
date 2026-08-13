import { FlatList, StyleSheet, Text, View } from "react-native";
import type { Anime } from "@/lib/types";
import { AnimeCard } from "@/components/anime-card";
import { nothing } from "@/components/nothing-ui";

export function AnimeRail({ label, title, items }: { label: string; title: string; items: Anime[] }) {
  return <View style={styles.section}><View style={styles.heading}><View><Text style={styles.label}>{label}</Text><Text style={styles.title}>{title}</Text></View><Text style={styles.count}>{String(items.length).padStart(2, "0")}</Text></View><FlatList horizontal data={items} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <AnimeCard anime={item} />} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} /></View>;
}

const styles = StyleSheet.create({
  section: { gap: 13 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  label: { color: nothing.muted, fontFamily: "monospace", fontWeight: "800", fontSize: 10, letterSpacing: 1.5 },
  title: { color: nothing.white, marginTop: 4, fontSize: 21, fontWeight: "900", letterSpacing: -0.3 },
  count: { color: nothing.dim, fontFamily: "monospace", fontWeight: "700", fontSize: 12 },
  rail: { gap: 12, paddingRight: 18 },
});
