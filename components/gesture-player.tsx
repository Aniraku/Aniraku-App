import { useCallback, useEffect, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

const SWIPE_THRESHOLD = 40;
const SWIPE_VERTICAL_THRESHOLD = 30;
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
  /** th3-anime style: hold anywhere on the video to engage 2x, release to restore. */
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
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
  onHoldStart,
  onHoldEnd,
  brightness = 1,
  volume = 1,
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
  const doubleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdEngaged.current) {
      holdEngaged.current = false;
      setFastForward(false);
      onHoldEndRef.current?.();
    }
  }, []);

  const handleDoubleTap = useCallback(
    (x: number) => {
      // Single call path only — previously this ALSO fired onSeek(±10) and the
      // screen's onDoubleTap handler fired seek(±10) again (20s jumps).
      const isLeft = x < dimsRef.current.width / 2;
      setDoubleTapSide(isLeft ? "left" : "right");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (isLeft) {
        onDoubleTapLeftRef.current?.();
      } else {
        onDoubleTapRightRef.current?.();
      }
      if (doubleTapTimer.current) clearTimeout(doubleTapTimer.current);
      doubleTapTimer.current = setTimeout(() => {
        setDoubleTapSide(null);
      }, 600);
    },
    []
  );

  const handleDoubleTapRef = useRef(handleDoubleTap);
  handleDoubleTapRef.current = handleDoubleTap;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
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
        moved.current = false;

        // Hold-to-2x: fires only if the finger stays put.
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
        const distFromLastTap = Math.abs(gestureState.x0 - lastTapX.current);

        if (timeSinceLastTap < DOUBLE_TAP_DELAY && distFromLastTap < 80) {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          handleDoubleTapRef.current(gestureState.x0);
          lastTapTime.current = 0;
        } else {
          lastTapTime.current = now;
          lastTapX.current = gestureState.x0;
        }
      },
      onPanResponderMove: (_, gestureState) => {
        const { width: liveWidth, height: liveHeight } = dimsRef.current;
        const dx = gestureState.dx;
        const dy = gestureState.dy;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          moved.current = true;
          if (holdTimer.current && !holdEngaged.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
          }
        }
        if (holdEngaged.current) return;
        const isLeftSide = startX.current < liveWidth / 2;

        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          const seekDelta = (dx / liveWidth) * 30;
          seekAccum.current = seekDelta;
        }

        if (Math.abs(dy) > SWIPE_VERTICAL_THRESHOLD) {
          const delta = -dy / (liveHeight * 0.6);
          if (isLeftSide && onBrightnessChangeRef.current) {
            const next = Math.max(0, Math.min(1, brightness + delta));
            onBrightnessChangeRef.current(next);
          } else if (!isLeftSide && onVolumeChangeRef.current) {
            const next = Math.max(0, Math.min(1, volume + delta));
            onVolumeChangeRef.current(next);
          }
        }
      },
      onPanResponderRelease: () => {
        const wasHold = holdEngaged.current;
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }
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
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }
        if (holdEngaged.current) {
          holdEngaged.current = false;
          setFastForward(false);
          onHoldEndRef.current?.();
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
      {fastForward && (
        <View pointerEvents="none" style={styles.fastForwardBadge}>
          <AppIcon name="fast-forward" size={20} color={nothing.black} />
          <Text style={styles.fastForwardText}>2×</Text>
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
  fastForwardBadge: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: nothing.white,
  },
  fastForwardText: {
    color: nothing.black,
    fontFamily: "Caveat-Bold",
    fontSize: 18,
  },
});
