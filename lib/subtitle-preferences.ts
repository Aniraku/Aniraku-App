import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "aniraku.subtitle-preferences.v2";

export type SubtitleFont = "default" | "monospace" | "serif" | "rounded";

export type SubtitlePreferences = {
  enabled: boolean;
  preferredLanguage: string;
  fontSize: number;
  bgOpacity: number;
  outlineThickness: number;
  fontFamily: SubtitleFont;
  /** Seconds of timing shift. Positive delays subtitles, negative advances them. */
  timeOffset: number;
};

const DEFAULTS: SubtitlePreferences = {
  enabled: true,
  preferredLanguage: "en",
  fontSize: 14,
  bgOpacity: 0.55,
  outlineThickness: 2,
  fontFamily: "default",
  timeOffset: 0,
};

export const SUBTITLE_OFFSET_MIN = -5;
export const SUBTITLE_OFFSET_MAX = 5;
export const SUBTITLE_OFFSET_STEP = 0.1;

/** Clamps to the supported range and snaps to 0.1s so float drift never
 * shows up as "0.30000000000000004s" in the panel. */
export function clampSubtitleOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const snapped = Math.round(value * 10) / 10;
  return Math.min(SUBTITLE_OFFSET_MAX, Math.max(SUBTITLE_OFFSET_MIN, snapped));
}

export function formatSubtitleOffset(value: number): string {
  const snapped = clampSubtitleOffset(value);
  return `${snapped > 0 ? "+" : ""}${snapped.toFixed(1)}s`;
}

let cached: SubtitlePreferences | null = null;

export async function loadSubtitlePreferences(): Promise<SubtitlePreferences> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { ...DEFAULTS, ...JSON.parse(raw) } as SubtitlePreferences;
      cached = parsed;
      return parsed;
    }
  } catch {}
  cached = DEFAULTS;
  return cached;
}

export async function saveSubtitlePreferences(prefs: Partial<SubtitlePreferences>): Promise<SubtitlePreferences> {
  const current = await loadSubtitlePreferences();
  const next = { ...current, ...prefs };
  cached = next;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

export function getSubtitlePreferencesSync(): SubtitlePreferences {
  return cached ?? DEFAULTS;
}

export const SUBTITLE_FONTS: { id: SubtitleFont; label: string; family: string }[] = [
  { id: "default", label: "System", family: "System" },
  { id: "monospace", label: "Mono", family: "monospace" },
  { id: "serif", label: "Serif", family: "serif" },
  { id: "rounded", label: "Rounded", family: "Caveat-Bold" },
];

export const FONT_SIZE_PRESETS = [10, 12, 14, 16, 18, 20];
export const BG_OPACITY_PRESETS = [0, 0.3, 0.55, 0.75, 0.9];
export const OUTLINE_PRESETS = [0, 1, 2, 3, 4];
