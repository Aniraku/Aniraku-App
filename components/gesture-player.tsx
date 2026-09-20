import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

const DOUBLE_TAP_DELAY = 280;
const SEEK_STEP = 10;
const HOLD_TO_FAST_FORWARD_MS = 400;

type Props = {
  currentTime: number;
  duration: number;
  onSeek: (delta: number) => void;
  onDoubleTapLeft?: () => void;
  onDoubleTapRight?: () => void;
  onBrightnessChange?: (value: number) => void;
  onVolumeChange?: (value: number) => void;
  brightness?: number;
  volume?: number;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  children: React.ReactNode;
};

function AnimatedOverlay({ show, children }: { show: boolean; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: show ? 1 : 0,
      duration: show ? 150 : 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [show]);
  return (
    <Animated.View pointerEvents={show ? "auto" : "none"} style={[StyleSheet.absoluteFillObject, { opacity }]}>
      {children}
    </Animated.View>
  );
}

function BrightnessBar({ value }: { value: number }) {
  const height = useRef(new Animated.Value(value * 120)).current;
  useEffect(() => {
    Animated.spring(height, { toValue: value * 120, useNativeDriver: false, damping: 15, stiffness: 200 }).start();
  }, [value]);
  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.track}>
        <Animated.View style={[sliderStyles.fill, { height }]} />
      </View>
      <AppIcon name="brightness-6" size={16} color={nothing.white} />
    </View>
  );
}

function VolumeBar({ value }: { value: number }) {
  const height = useRef(new Animated.Value(value * 120)).current;
  useEffect(() => {
    Animated.spring(height, { toValue: value * 120, useNativeDriver: false, damping: 15, stiffness: 200 }).start();
  }, [value]);
  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.track}>
        <Animated.View style={[sliderStyles.fill, { height }]} />
      </View>
      <AppIcon name={value === 0 ? "volume-mute" : value < 0.5 ? "volume-low" : "volume-high"} size={16} color={nothing.white} />
    </View>
  );
}

function SeekRipple({ side, visible }: { side: "left" | "right"; visible: boolean }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 300 }),
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]),
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.5, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[
      rippleStyles.container,
      side === "left" ? rippleStyles.left : rippleStyles.right,
      { transform: [{ scale }], opacity },
    ]}>
      <AppIcon name={side === "left" ? "rewind-10" : "fast-forward-10"} size={36} color={nothing.white} />
      <Text style={rippleStyles.text}>{SEEK_STEP}s</Text>
    </Animated.View>
  );
}

function FastForwardBadge({ active }: { active: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: active ? 1 : 0, duration: active ? 150 : 250, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: active ? 0 : -10, useNativeDriver: true, damping: 15 }),
    ]).start();
  }, [active]);
  if (!active) return null;
  return (
    <Animated.View pointerEvents="none" style={[ffStyles.badge, { opacity, transform: [{ translateY }] }]}>
      <AppIcon name="fast-forward" size={18} color={nothing.black} />
      <Text style={ffStyles.text}>2×</Text>
    </Animated.View>
  );
}

export function GestureLayer({
  currentTime, duration, onSeek,
  onDoubleTapLeft, onDoubleTapRight,
  onBrightnessChange, onVolumeChange,
  onHoldStart, onHoldEnd,
  brightness = 1, volume = 1,
  children,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const dimsRef = useRef({ width: screenWidth, height: screenHeight });
  dimsRef.current = { width: screenWidth, height: screenHeight };

  const startX = useRef(0);
  const startY = useRef(0);
  const seekAccum = useRef(0);
  const lastTapTime = useRef(0);
  const lastTapX = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdEngaged = useRef(false);
  const moved = useRef(false);

  const [doubleTapSide, setDoubleTapSide] = useState<"left" | "right" | null>(null);
  const [fastForward, setFastForward] = useState(false);
  const [showBrightness, setShowBrightness] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const doubleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sliderHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSeekRef = useRef(onSeek);
  const onDoubleTapLeftRef = useRef(onDoubleTapLeft);
  const onDoubleTapRightRef = useRef(onDoubleTapRight);
  const onBrightnessChangeRef = useRef(onBrightnessChange);
  const onVolumeChangeRef = useRef(onVolumeChange);
  const onHoldStartRef = useRef(onHoldStart);
  const onHoldEndRef = useRef(onHoldEnd);

  onSeekRef.current = onSeek;
  onDoubleTapLeftRef.current = onDoubleTapLeft;
  onDoubleTapRightRef.current = onDoubleTapRight;
  onBrightnessChangeRef.current = onBrightnessChange;
  onVolumeChangeRef.current = onVolumeChange;
  onHoldStartRef.current = onHoldStart;
  onHoldEndRef.current = onHoldEnd;

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (doubleTapTimer.current) clearTimeout(doubleTapTimer.current);
    if (sliderHideTimer.current) clearTimeout(sliderHideTimer.current);
  }, []);

  const hideSliders = useCallback(() => {
    if (sliderHideTimer.current) clearTimeout(sliderHideTimer.current);
    sliderHideTimer.current = setTimeout(() => {
      setShowBrightness(false);
      setShowVolume(false);
    }, 1500);
  }, []);

  const handleDoubleTap = useCallback((x: number) => {
    const isLeft = x < dimsRef.current.width / 2;
    setDoubleTapSide(isLeft ? "left" : "right");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isLeft) onDoubleTapLeftRef.current?.();
    else onDoubleTapRightRef.current?.();
    if (doubleTapTimer.current) clearTimeout(doubleTapTimer.current);
    doubleTapTimer.current = setTimeout(() => setDoubleTapSide(null), 600);
  }, []);

  const handleDoubleTapRef = useRef(handleDoubleTap);
  handleDoubleTapRef.current = handleDoubleTap;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10,
      onPanResponderGrant: (_, gs) => {
        startX.current = gs.x0;
        startY.current = gs.y0;
        seekAccum.current = 0;
        moved.current = false;

        if (holdTimer.current) clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => {
          if (!moved.current) {
            holdEngaged.current = true;
            setFastForward(true);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onHoldStartRef.current?.();
          }
        }, HOLD_TO_FAST_FORWARD_MS);

        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime.current;
        const distFromLastTap = Math.abs(gs.x0 - lastTapX.current);

        if (timeSinceLastTap < DOUBLE_TAP_DELAY && distFromLastTap < 80) {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          handleDoubleTapRef.current(gs.x0);
          lastTapTime.current = 0;
        } else {
          lastTapTime.current = now;
          lastTapX.current = gs.x0;
        }
      },
      onPanResponderMove: (_, gs) => {
        const { width: w, height: h } = dimsRef.current;
        const dx = gs.dx;
        const dy = gs.dy;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          moved.current = true;
          if (holdTimer.current && !holdEngaged.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
        }
        if (holdEngaged.current) return;
        const isLeftSide = startX.current < w / 2;

        if (Math.abs(dx) > 40) {
          seekAccum.current = (dx / w) * 30;
        }

        if (Math.abs(dy) > 30) {
          const delta = -dy / (h * 0.6);
          if (isLeftSide && onBrightnessChangeRef.current) {
            const next = Math.max(0, Math.min(1, brightness + delta));
            onBrightnessChangeRef.current(next);
            setShowBrightness(true);
            hideSliders();
          } else if (!isLeftSide && onVolumeChangeRef.current) {
            const next = Math.max(0, Math.min(1, volume + delta));
            onVolumeChangeRef.current(next);
            setShowVolume(true);
            hideSliders();
          }
        }
      },
      onPanResponderRelease: () => {
        const wasHold = holdEngaged.current;
        if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
        if (wasHold) {
          holdEngaged.current = false;
          setFastForward(false);
          onHoldEndRef.current?.();
        } else if (Math.abs(seekAccum.current) > 1) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onSeekRef.current(seekAccum.current);
        }
        seekAccum.current = 0;
      },
      onPanResponderTerminate: () => {
        if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
        if (holdEngaged.current) { holdEngaged.current = false; setFastForward(false); onHoldEndRef.current?.(); }
        seekAccum.current = 0;
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
      <AnimatedOverlay show={!!doubleTapSide}>
        <SeekRipple side="left" visible={doubleTapSide === "left"} />
        <SeekRipple side="right" visible={doubleTapSide === "right"} />
      </AnimatedOverlay>
      <AnimatedOverlay show={showBrightness}>
        <View style={sliderStyles.leftWrap}>
          <BrightnessBar value={brightness} />
        </View>
      </AnimatedOverlay>
      <AnimatedOverlay show={showVolume}>
        <View style={sliderStyles.rightWrap}>
          <VolumeBar value={volume} />
        </View>
      </AnimatedOverlay>
      <FastForwardBadge active={fastForward} />
    </View>
  );
}

export function SeekIndicator({ delta }: { delta: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    if (Math.abs(delta) > 1) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 300 }),
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]),
        Animated.delay(500),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [delta]);
  if (Math.abs(delta) < 1) return null;
  const isForward = delta > 0;
  return (
    <Animated.View style={[seekStyles.indicator, isForward ? seekStyles.right : seekStyles.left, { opacity, transform: [{ scale }] }]}>
      <AppIcon name={isForward ? "fast-forward-10" : "rewind-10"} size={28} color={nothing.white} />
      <Text style={seekStyles.text}>{Math.abs(Math.round(delta))}s</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject },
});

const rippleStyles = StyleSheet.create({
  container: { position: "absolute", top: "35%", width: 80, height: 80, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 40 },
  left: { left: 30 },
  right: { right: 30 },
  text: { color: nothing.white, fontSize: 11, fontWeight: "900", marginTop: 2 },
});

const sliderStyles = StyleSheet.create({
  leftWrap: { position: "absolute", left: 20, top: "25%", bottom: "25%", justifyContent: "center" },
  rightWrap: { position: "absolute", right: 20, top: "25%", bottom: "25%", justifyContent: "center" },
  container: { alignItems: "center", justifyContent: "flex-end", gap: 6 },
  track: { width: 32, height: 120, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden", justifyContent: "flex-end" },
  fill: { width: "100%", backgroundColor: nothing.white, borderRadius: 16 },
});

const ffStyles = StyleSheet.create({
  badge: { position: "absolute", top: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: nothing.white },
  text: { color: nothing.black, fontSize: 18, fontWeight: "900" },
});

const seekStyles = StyleSheet.create({
  indicator: { position: "absolute", top: "40%", width: 70, height: 70, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 35 },
  left: { left: 40 },
  right: { right: 40 },
  text: { color: nothing.white, fontSize: 11, fontWeight: "800", marginTop: 2 },
});

const loadingStyles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
