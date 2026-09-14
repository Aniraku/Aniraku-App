import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
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
    Animated.spring(thumbAnim, {
      toValue: enabled ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 12,
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
  trackOn: { borderColor: nothing.red, backgroundColor: nothing.red },
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
