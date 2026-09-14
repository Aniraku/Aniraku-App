import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

type ControlsOverlayProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isFullscreen: boolean;
  speed: number;
  onBack: () => void;
  onPlayPause: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onSpeed: () => void;
  onSubtitles: () => void;
  onSettings: () => void;
  onFullscreen: () => void;
  onLock?: () => void;
};

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ControlsOverlay({
  visible, title, subtitle, currentTime, duration,
  isPlaying, isFullscreen, speed,
  onBack, onPlayPause, onSeekForward, onSeekBackward,
  onSpeed, onSubtitles, onSettings, onFullscreen, onLock,
}: ControlsOverlayProps) {
  const topOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const centerScale = useRef(new Animated.Value(0.8)).current;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  useEffect(() => {
    const config = { duration: visible ? 200 : 300, easing: visible ? Easing.out(Easing.ease) : Easing.in(Easing.ease), useNativeDriver: true };
    Animated.parallel([
      Animated.timing(topOpacity, { toValue: visible ? 1 : 0, ...config }),
      Animated.timing(bottomOpacity, { toValue: visible ? 1 : 0, ...config }),
      Animated.spring(centerScale, { toValue: visible ? 1 : 0.8, useNativeDriver: true, damping: 15, stiffness: 200 }),
    ]).start();
  }, [visible]);

  return (
    <Animated.View pointerEvents={visible ? "auto" : "none"} style={styles.container}>
      <Animated.View style={[styles.topBar, { opacity: topOpacity }]}>
        <Pressable onPress={onBack} style={styles.iconBtn}>
          <AppIcon name="arrow-left" size={22} color={nothing.white} />
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.title} numberOfLines={1}>{title || ""}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.topRight}>
          {speed !== 1 ? <View style={styles.speedBadge}><Text style={styles.speedText}>{speed}×</Text></View> : null}
          <Pressable onPress={onLock} style={styles.iconBtn}>
            <AppIcon name="lock-open-outline" size={20} color={nothing.white} />
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View style={[styles.centerControls, { opacity: bottomOpacity, transform: [{ scale: centerScale }] }]}>
        <Pressable onPress={onSeekBackward} style={styles.seekBtn}>
          <AppIcon name="rewind-10" size={32} color={nothing.white} />
          <Text style={styles.seekBtnText}>10</Text>
        </Pressable>
        <Pressable onPress={onPlayPause} style={styles.playBtn}>
          <AppIcon name={isPlaying ? "pause" : "play"} size={36} color={nothing.black} />
        </Pressable>
        <Pressable onPress={onSeekForward} style={styles.seekBtn}>
          <AppIcon name="fast-forward-10" size={32} color={nothing.white} />
          <Text style={styles.seekBtnText}>10</Text>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.bottomBar, { opacity: bottomOpacity }]}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </Animated.View>

      <Animated.View style={[styles.bottomActions, { opacity: bottomOpacity }]}>
        <Pressable onPress={onSpeed} style={styles.actionBtn}>
          <AppIcon name="play-speed" size={20} color={nothing.white} />
        </Pressable>
        <Pressable onPress={onSubtitles} style={styles.actionBtn}>
          <AppIcon name="subtitles-outline" size={20} color={nothing.white} />
        </Pressable>
        <Pressable onPress={onSettings} style={styles.actionBtn}>
          <AppIcon name="cog-outline" size={20} color={nothing.white} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onFullscreen} style={styles.actionBtn}>
          <AppIcon name={isFullscreen ? "fullscreen-exit" : "fullscreen"} size={20} color={nothing.white} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  topBar: { flexDirection: "row", alignItems: "center", paddingTop: 8, paddingHorizontal: 12, paddingBottom: 16, backgroundColor: "rgba(0,0,0,0.6)" },
  topCenter: { flex: 1, alignItems: "center", gap: 2 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { color: nothing.white, fontSize: 14, fontWeight: "800" },
  subtitle: { color: nothing.muted, fontSize: 10, fontFamily: nothing.mono, fontWeight: "700" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  speedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: nothing.red },
  speedText: { color: nothing.white, fontSize: 10, fontWeight: "900" },
  centerControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  seekBtn: { alignItems: "center", justifyContent: "center" },
  seekBtnText: { color: nothing.white, fontSize: 9, fontWeight: "800", marginTop: -2 },
  playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: nothing.white },
  bottomBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: "rgba(0,0,0,0.6)" },
  timeText: { color: nothing.white, fontSize: 11, fontFamily: nothing.mono, fontWeight: "800", minWidth: 42, textAlign: "center" },
  progressTrack: { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 },
  progressFill: { height: "100%", backgroundColor: nothing.red, borderRadius: 2 },
  bottomActions: { flexDirection: "row", alignItems: "center", gap: 0, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4, backgroundColor: "rgba(0,0,0,0.6)" },
  actionBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
