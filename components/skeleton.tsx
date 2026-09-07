import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { nothing } from "@/components/nothing-ui";

function usePulse() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

export function Skeleton({ style }: { style?: object }) {
  const opacity = usePulse();
  return <Animated.View style={[styles.base, style, { opacity }]} />;
}

export function SkeletonCard() {
  return (
    <View style={cardStyles.container}>
      <Skeleton style={cardStyles.poster} />
      <View style={cardStyles.body}>
        <Skeleton style={cardStyles.title} />
        <Skeleton style={cardStyles.subtitle} />
      </View>
    </View>
  );
}

export function SkeletonRail() {
  return (
    <View style={railStyles.container}>
      <Skeleton style={railStyles.poster} />
      <Skeleton style={railStyles.title} />
    </View>
  );
}

export function SkeletonEpisode() {
  return (
    <View style={epStyles.container}>
      <Skeleton style={epStyles.thumbnail} />
      <View style={epStyles.body}>
        <Skeleton style={epStyles.title} />
        <Skeleton style={epStyles.meta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: nothing.line, borderRadius: 4 },
});

const cardStyles = StyleSheet.create({
  container: { width: 140, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, borderRadius: 8, overflow: "hidden" },
  poster: { width: "100%", height: 196 },
  body: { padding: 10, gap: 6 },
  title: { width: "80%", height: 12 },
  subtitle: { width: "50%", height: 10 },
});

const railStyles = StyleSheet.create({
  container: { width: 110, alignItems: "flex-start", gap: 6 },
  poster: { width: 110, height: 154, borderRadius: 6 },
  title: { width: "70%", height: 10 },
});

const epStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, borderRadius: 8, padding: 8 },
  thumbnail: { width: 64, height: 40, borderRadius: 4 },
  body: { flex: 1, gap: 5 },
  title: { width: "75%", height: 11 },
  meta: { width: "45%", height: 9 },
});
