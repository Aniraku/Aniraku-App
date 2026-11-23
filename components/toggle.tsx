import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { nothing } from "@/components/nothing-ui";

type ToggleProps = {
  enabled: boolean;
  onToggle: () => void;
  label?: string;
};

export function Toggle({ enabled, onToggle, label }: ToggleProps) {
  const thumbAnim = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  useEffect(() => {
    // Only translateX animates (colors swap instantly), so the thumb rides the
    // native driver; tension/friction ≈ critically damped — no press-response overshoot.
    Animated.spring(thumbAnim, {
      toValue: enabled ? 1 : 0,
      useNativeDriver: true,
      tension: 200,
      friction: 26,
    }).start();
  }, [enabled, thumbAnim]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onToggle();
  };

  const translateX = thumbAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={label}
      onPress={handlePress}
      hitSlop={{ top: 11, bottom: 11 }}
      style={({ pressed }) => [styles.track, enabled && styles.trackOn, pressed && styles.trackPressed]}
    >
      <Animated.View style={[styles.thumb, enabled && styles.thumbOn, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: nothing.line,
    backgroundColor: nothing.surface,
    justifyContent: "center",
    overflow: "hidden",
  },
  trackOn: { borderColor: nothing.white, backgroundColor: nothing.white },
  trackPressed: { opacity: 0.85 },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: nothing.muted,
    position: "absolute",
  },
  thumbOn: { backgroundColor: nothing.black },
});
