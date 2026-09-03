import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = 40;
const SWIPE_VERTICAL_THRESHOLD = 30;
const DOUBLE_TAP_DELAY = 280;
const SEEK_STEP = 10;

type Props = {
  currentTime: number;
  duration: number;
  onSeek: (delta: number) => void;
  onDoubleTapLeft?: () => void;
  onDoubleTapRight?: () => void;
  onBrightnessChange?: (value: number) => void;
  onVolumeChange?: (value: number) => void;
  children: React.ReactNode;
};

export function GestureLayer({
  currentTime,
  duration,
  onSeek,
  onDoubleTapLeft,
  onDoubleTapRight,
  onBrightnessChange,
  onVolumeChange,
  children,
}: Props) {
  const startX = useRef(0);
  const startY = useRef(0);
  const seekAccum = useRef(0);
  const lastTapTime = useRef(0);
  const lastTapX = useRef(0);
  const [doubleTapSide, setDoubleTapSide] = useState<"left" | "right" | null>(null);
  const [doubleTapCount, setDoubleTapCount] = useState(0);
  const doubleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSeekRef = useRef(onSeek);
  const onDoubleTapLeftRef = useRef(onDoubleTapLeft);
  const onDoubleTapRightRef = useRef(onDoubleTapRight);
  const onBrightnessChangeRef = useRef(onBrightnessChange);
  const onVolumeChangeRef = useRef(onVolumeChange);

  onSeekRef.current = onSeek;
  onDoubleTapLeftRef.current = onDoubleTapLeft;
  onDoubleTapRightRef.current = onDoubleTapRight;
  onBrightnessChangeRef.current = onBrightnessChange;
  onVolumeChangeRef.current = onVolumeChange;

  const handleDoubleTap = useCallback(
    (x: number) => {
      const isLeft = x < SCREEN_WIDTH / 2;
      setDoubleTapSide(isLeft ? "left" : "right");
      setDoubleTapCount((c) => c + 1);
      if (isLeft) {
        onSeekRef.current(-SEEK_STEP);
        onDoubleTapLeftRef.current?.();
      } else {
        onSeekRef.current(SEEK_STEP);
        onDoubleTapRightRef.current?.();
      }
      if (doubleTapTimer.current) clearTimeout(doubleTapTimer.current);
      doubleTapTimer.current = setTimeout(() => {
        setDoubleTapSide(null);
        setDoubleTapCount(0);
      }, 600);
    },
    []
  );

  const handleDoubleTapRef = useRef(handleDoubleTap);
  handleDoubleTapRef.current = handleDoubleTap;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 10 ||
          Math.abs(gestureState.dy) > 10
        );
      },
      onPanResponderGrant: (_, gestureState) => {
        startX.current = gestureState.x0;
        startY.current = gestureState.y0;
        seekAccum.current = 0;

        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime.current;
        const distFromLastTap = Math.abs(gestureState.x0 - lastTapX.current);

        if (timeSinceLastTap < DOUBLE_TAP_DELAY && distFromLastTap < 80) {
          handleDoubleTapRef.current(gestureState.x0);
          lastTapTime.current = 0;
        } else {
          lastTapTime.current = now;
          lastTapX.current = gestureState.x0;
        }
      },
      onPanResponderMove: (_, gestureState) => {
        const dx = gestureState.dx;
        const dy = gestureState.dy;
        const isLeftSide = startX.current < SCREEN_WIDTH / 2;

        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          const seekDelta = (dx / SCREEN_WIDTH) * 30;
          seekAccum.current = seekDelta;
        }

        if (Math.abs(dy) > SWIPE_VERTICAL_THRESHOLD) {
          const delta = -dy / (SCREEN_HEIGHT * 0.6);
          if (isLeftSide && onBrightnessChangeRef.current) {
            onBrightnessChangeRef.current(Math.max(0, Math.min(1, delta)));
          } else if (!isLeftSide && onVolumeChangeRef.current) {
            onVolumeChangeRef.current(Math.max(0, Math.min(1, delta)));
          }
        }
      },
      onPanResponderRelease: () => {
        if (Math.abs(seekAccum.current) > 1) {
          onSeekRef.current(seekAccum.current);
        }
        seekAccum.current = 0;
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
      {doubleTapSide && (
        <View
          style={[
            styles.doubleTapRipple,
            doubleTapSide === "left" ? styles.rippleLeft : styles.rippleRight,
          ]}
        >
          <AppIcon
            name={doubleTapSide === "left" ? "rewind-10" : "fast-forward-10"}
            size={36}
            color={nothing.white}
          />
          <Text style={styles.doubleTapText}>{SEEK_STEP}s</Text>
        </View>
      )}
    </View>
  );
}

export function SeekIndicator({ delta }: { delta: number }) {
  if (Math.abs(delta) < 1) return null;
  const isForward = delta > 0;
  const seconds = Math.abs(Math.round(delta));
  return (
    <View style={[styles.seekIndicator, isForward ? styles.seekRight : styles.seekLeft]}>
      <AppIcon
        name={isForward ? "fast-forward-10" : "rewind-10"}
        size={28}
        color={nothing.white}
      />
      <Text style={styles.seekText}>{seconds}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  seekIndicator: {
    position: "absolute",
    top: "40%",
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 35,
  },
  seekLeft: { left: 40 },
  seekRight: { right: 40 },
  seekText: {
    color: nothing.white,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  doubleTapRipple: {
    position: "absolute",
    top: "35%",
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 40,
  },
  rippleLeft: { left: 30 },
  rippleRight: { right: 30 },
  doubleTapText: {
    color: nothing.white,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
});
