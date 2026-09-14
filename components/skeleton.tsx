import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";
import { nothing } from "@/components/nothing-ui";

function usePulse(duration = 1200) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.6, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [duration]);
  return opacity;
}

export function Skeleton({ style }: { style?: ViewStyle }) {
  const opacity = usePulse();
  return <Animated.View style={[styles.base, style, { opacity }]} />;
}

export function SkeletonCard() {
  const opacity = usePulse(1400);
  return (
    <View style={cardStyles.container}>
      <Animated.View style={[cardStyles.poster, { opacity }]} />
      <View style={cardStyles.body}>
        <Animated.View style={[cardStyles.title, { opacity }]} />
        <Animated.View style={[cardStyles.subtitle, { opacity }]} />
      </View>
    </View>
  );
}

export function SkeletonRail() {
  const opacity = usePulse(1300);
  return (
    <View style={railStyles.container}>
      <Animated.View style={[railStyles.poster, { opacity }]} />
      <Animated.View style={[railStyles.title, { opacity }]} />
    </View>
  );
}

export function SkeletonEpisode() {
  const opacity = usePulse(1100);
  return (
    <View style={epStyles.container}>
      <Animated.View style={[epStyles.thumbnail, { opacity }]} />
      <View style={epStyles.body}>
        <Animated.View style={[epStyles.title, { opacity }]} />
        <Animated.View style={[epStyles.meta, { opacity }]} />
      </View>
    </View>
  );
}

export function SkeletonHero() {
  const opacity = usePulse(1500);
  return (
    <View style={heroStyles.container}>
      <Animated.View style={[heroStyles.image, { opacity }]} />
      <View style={heroStyles.content}>
        <Animated.View style={[heroStyles.badge, { opacity }]} />
        <Animated.View style={[heroStyles.title, { opacity }]} />
        <Animated.View style={[heroStyles.meta, { opacity }]} />
        <View style={heroStyles.buttons}>
          <Animated.View style={[heroStyles.playBtn, { opacity }]} />
          <Animated.View style={[heroStyles.listBtn, { opacity }]} />
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
  playBtn: { width: 100, height: 36, backgroundColor: nothing.line, borderRadius: 20 },
  listBtn: { width: 100, height: 36, backgroundColor: nothing.line, borderRadius: 20 },
});

const gridStyles = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
});
