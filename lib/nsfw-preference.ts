import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NSFW_KEY = "aniraku.nsfw.content.v1";

export async function readNsfwPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NSFW_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

export async function writeNsfwPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NSFW_KEY, enabled ? "true" : "false");
  } catch { /* preference loss is acceptable */ }
}

/**
 * Returns the AniList `isAdult` query parameter:
 * - `false` → exclude adult content (default)
 * - `null` → include all content (when NSFW toggle is on)
 */
export function nsfwFilterParam(nsfwEnabled: boolean): boolean | null {
  return nsfwEnabled ? null : false;
}

export function useNsfwPreference() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void readNsfwPreference().then((value) => {
      if (active) { setEnabled(value); setReady(true); }
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      void writeNsfwPreference(next);
      return next;
    });
  };

  return { enabled, ready, toggle };
}
