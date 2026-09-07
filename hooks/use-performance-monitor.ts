import { useEffect, useRef, useState } from "react";
import { InteractionManager, Platform } from "react-native";

const isDev = process.env.NODE_ENV !== "production";

const FRAME_BUDGET_MS = 16;
const SAMPLE_INTERVAL_MS = 1_000;

export function usePerformanceMonitor() {
  const [fps, setFps] = useState(0);
  const [isSlowFrame, setIsSlowFrame] = useState(false);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const slowFrameDetectedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memoryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isDev) return;

    const measureFrame = () => {
      frameCountRef.current += 1;
      rafIdRef.current = requestAnimationFrame(measureFrame);
    };

    const calcFps = () => {
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      if (elapsed > 0) {
        const currentFps = Math.round((frameCountRef.current * 1_000) / elapsed);
        setFps(currentFps);
        if (slowFrameDetectedRef.current) {
          setIsSlowFrame(true);
          slowFrameDetectedRef.current = false;
          setTimeout(() => setIsSlowFrame(false), 300);
        }
      }
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    };

    const handleSlowFrame = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => {
      if (deadline.didTimeout || deadline.timeRemaining() < FRAME_BUDGET_MS) {
        slowFrameDetectedRef.current = true;
        if (isDev) {
          console.log(`[PerfMonitor] Slow frame detected (~${Math.round(performance.now() - lastTimeRef.current)}ms)`);
        }
      }
    };

    InteractionManager.runAfterInteractions(() => {
      rafIdRef.current = requestAnimationFrame(measureFrame);
      intervalIdRef.current = setInterval(calcFps, SAMPLE_INTERVAL_MS);

      if (typeof globalThis.requestIdleCallback === "function") {
        globalThis.requestIdleCallback(handleSlowFrame, { timeout: FRAME_BUDGET_MS * 2 });
      }
    });

    // Android memory monitoring
    if (Platform.OS === "android" && isDev) {
      memoryTimerRef.current = setInterval(() => {
        const memInfo = (globalThis as Record<string, unknown>).__fbBatchedBridge;
        if (memInfo && typeof (memInfo as Record<string, unknown>)._getModuleConstants === "function") {
          try {
            const constants = (memInfo as Record<string, () => Record<string, unknown>>)._getModuleConstants();
            const devMenu = constants?.DevMenu;
            if (devMenu && typeof (devMenu as Record<string, unknown>).getMemoryInfo === "function") {
              console.log("[PerfMonitor] Memory query available via DevMenu");
            }
          } catch {
            // Memory info not accessible
          }
        }
      }, 10_000);
    }

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (intervalIdRef.current !== null) clearInterval(intervalIdRef.current);
      if (memoryTimerRef.current !== null) clearInterval(memoryTimerRef.current);
    };
  }, []);

  return { fps, isSlowFrame };
}
