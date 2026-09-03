import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

type SleepTimerProps = {
  onExpire: () => void;
  onClear: () => void;
};

const PRESETS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "1h", minutes: 60 },
  { label: "1.5h", minutes: 90 },
  { label: "2h", minutes: 120 },
];

export function SleepTimer({ onExpire, onClear }: SleepTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const hasFired = useRef(false);

  useEffect(() => {
    if (remaining === null || remaining <= 0) {
      if (remaining === 0 && !hasFired.current) {
        hasFired.current = true;
        onExpire();
      }
      return;
    }
    hasFired.current = false;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, onExpire]);

  const setTimer = (minutes: number) => setRemaining(minutes * 60);

  const clearTimer = () => {
    setRemaining(null);
    hasFired.current = false;
    onClear();
  };

  if (remaining !== null && remaining > 0) {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return (
      <View style={styles.activeTimer}>
        <AppIcon name="sleep" size={16} color={nothing.red} />
        <Text style={styles.timerText}>{`${mins}:${String(secs).padStart(2, "0")}`}</Text>
        <Pressable onPress={clearTimer} style={styles.cancelBtn}>
          <AppIcon name="close" size={14} color={nothing.muted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppIcon name="sleep" size={16} color={nothing.white} />
        <Text style={styles.heading}>SLEEP TIMER</Text>
      </View>
      <View style={styles.presets}>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset.minutes}
            onPress={() => setTimer(preset.minutes)}
            style={({ pressed }) => [styles.presetBtn, pressed && styles.pressed]}
          >
            <Text style={styles.presetText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  heading: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.5 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  presetBtn: { minWidth: 50, minHeight: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderColor: nothing.line, borderRadius: 8 },
  presetText: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.3 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  activeTimer: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(255,77,77,0.12)", borderWidth: 1, borderColor: "rgba(255,77,77,0.3)" },
  timerText: { color: nothing.red, fontFamily: "monospace", fontWeight: "900", fontSize: 14, letterSpacing: 0.5, flex: 1 },
  cancelBtn: { padding: 4 },
});
