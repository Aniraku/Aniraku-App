import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NSFW_KEY = "aniraku.nsfw.content.v1";
const NSFW_AGE_KEY = "aniraku.nsfw.age_verified.v1";

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

/** One-time 18+ affirmation. Stored separately so turning NSFW back on later never re-prompts. */
export async function readAgeVerified(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(NSFW_AGE_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function writeAgeVerified(): Promise<void> {
  try {
    await AsyncStorage.setItem(NSFW_AGE_KEY, "true");
  } catch { /* re-prompt next time is acceptable */ }
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
  const [enabled, setEnabledState] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    let active = true;
    void Promise.all([readNsfwPreference(), readAgeVerified()]).then(([content, age]) => {
      if (active) { setEnabledState(content); setAgeVerified(age); setReady(true); }
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    return refresh();
  }, [refresh]);

  const setEnabled = (next: boolean) => {
    setEnabledState(next);
    void writeNsfwPreference(next);
  };

  const toggle = () => {
    setEnabledState((prev) => {
      const next = !prev;
      void writeNsfwPreference(next);
      return next;
    });
  };

  /** Persist the 18+ affirmation. Call before setEnabled(true) in the age-gate flow. */
  const verifyAge = async () => {
    await writeAgeVerified();
    setAgeVerified(true);
  };

  return { enabled, ready, ageVerified, toggle, setEnabled, verifyAge, refresh };
}

/**
 * SFW gate for players and detail pages: `false` while the toggle is on (or
 * preferences are still loading), `true` otherwise — re-checked whenever the
 * screen regains focus so toggling it in Settings takes effect on return.
 */
export function useNsfwViewGate(): boolean {
  const { enabled, ready, refresh } = useNsfwPreference();
  useFocusEffect(refresh);
  return ready && !enabled;
}
