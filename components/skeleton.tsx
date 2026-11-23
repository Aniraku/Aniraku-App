import { StyleSheet, View, type ViewStyle } from "react-native";
import { nothing } from "@/components/nothing-ui";

// House loading rule: placeholders are flat bars at real size — no shimmer loop.
export function Skeleton({ style }: { style?: ViewStyle }) {
  return <View style={[styles.base, style]} />;
}

export function SkeletonCard() {
  return (
    <View style={cardStyles.container}>
      <View style={cardStyles.poster} />
      <View style={cardStyles.body}>
        <View style={cardStyles.title} />
        <View style={cardStyles.subtitle} />
      </View>
    </View>
  );
}

export function SkeletonRail() {
  return (
    <View style={railStyles.container}>
      <View style={railStyles.poster} />
      <View style={railStyles.title} />
    </View>
  );
}

export function SkeletonEpisode() {
  return (
    <View style={epStyles.container}>
      <View style={epStyles.thumbnail} />
      <View style={epStyles.body}>
        <View style={epStyles.title} />
        <View style={epStyles.meta} />
      </View>
    </View>
  );
}

export function SkeletonHero() {
  return (
    <View style={heroStyles.container}>
      <View style={heroStyles.image} />
      <View style={heroStyles.content}>
        <View style={heroStyles.badge} />
        <View style={heroStyles.title} />
        <View style={heroStyles.meta} />
        <View style={heroStyles.buttons}>
          <View style={heroStyles.playBtn} />
          <View style={heroStyles.listBtn} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <View style={gridStyles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: nothing.line, borderRadius: 4 },
});

const cardStyles = StyleSheet.create({
  container: { width: 140, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, borderRadius: 8, overflow: "hidden" },
  poster: { width: "100%", height: 196, backgroundColor: nothing.line },
  body: { padding: 10, gap: 6 },
  title: { width: "80%", height: 12, backgroundColor: nothing.line, borderRadius: 4 },
  subtitle: { width: "50%", height: 10, backgroundColor: nothing.line, borderRadius: 4 },
});

const railStyles = StyleSheet.create({
  container: { width: 110, alignItems: "flex-start", gap: 6 },
  poster: { width: 110, height: 154, borderRadius: 6, backgroundColor: nothing.line },
  title: { width: "70%", height: 10, backgroundColor: nothing.line, borderRadius: 4 },
});

const epStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, borderRadius: 8, padding: 8 },
  thumbnail: { width: 64, height: 40, borderRadius: 4, backgroundColor: nothing.line },
  body: { flex: 1, gap: 5 },
  title: { width: "75%", height: 11, backgroundColor: nothing.line, borderRadius: 4 },
  meta: { width: "45%", height: 9, backgroundColor: nothing.line, borderRadius: 4 },
});

const heroStyles = StyleSheet.create({
  container: { minHeight: 420, marginHorizontal: -18, overflow: "hidden", backgroundColor: nothing.raised },
  image: { ...StyleSheet.absoluteFillObject, backgroundColor: nothing.line },
  content: { flex: 1, justifyContent: "flex-end", padding: 16, gap: 8 },
  badge: { width: 40, height: 14, backgroundColor: nothing.line, borderRadius: 4 },
  title: { width: "80%", height: 28, backgroundColor: nothing.line, borderRadius: 4 },
  meta: { width: "50%", height: 12, backgroundColor: nothing.line, borderRadius: 4 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 4 },
  playBtn: { width: 100, height: 36, backgroundColor: nothing.line, borderRadius: 8 },
  listBtn: { width: 100, height: 36, backgroundColor: nothing.line, borderRadius: 8 },
});

const gridStyles = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
});
