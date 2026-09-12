import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

type SleepTimerProps = {
  /** Countdown seconds owned by the watch screen so it survives settings close. */
  remaining: number | null;
  onSetRemaining: (value: number | null) => void;
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

export function SleepTimer({ remaining, onSetRemaining, onClear }: SleepTimerProps) {
  const setTimer = (minutes: number) => onSetRemaining(minutes * 60);

  const clearTimer = () => {
    onSetRemaining(null);
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

/** Persistent on-video countdown pill (Anilab style). Tap opens settings. */
export function SleepTimerPill({ remaining, onPress }: { remaining: number; onPress: () => void }) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <Pressable onPress={onPress} style={styles.pill}>
      <AppIcon name="sleep" size={13} color={nothing.black} />
      <Text style={styles.pillText}>{`${mins}:${String(secs).padStart(2, "0")}`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  heading: { color: nothing.white, fontFamily: "monospace", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  presetBtn: { minWidth: 50, minHeight: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderWidth: 1, borderColor: nothing.line, borderRadius: 8 },
  presetText: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 9, letterSpacing: 0.3 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  activeTimer: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(255,77,77,0.12)", borderWidth: 1, borderColor: "rgba(255,77,77,0.3)" },
  timerText: { color: nothing.red, fontFamily: "monospace", fontWeight: "900", fontSize: 14, letterSpacing: 0.5, flex: 1 },
  cancelBtn: { padding: 4 },
  pill: { position: "absolute", zIndex: 4, top: 52, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: nothing.white },
  pillText: { color: nothing.black, fontFamily: "monospace", fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
});
