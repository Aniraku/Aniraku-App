import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "aniraku.subtitle-preferences.v1";

export type SubtitleFontFamily = "caveat" | "henny-penny" | "system";

export type SubtitlePreferences = {
  enabled: boolean;
  fontFamily: SubtitleFontFamily;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  strokeWidth: number;
  strokeColor: string;
  shadowEnabled: boolean;
  preferredLanguage: string;
  opacity: number;
};

const DEFAULTS: SubtitlePreferences = {
  enabled: true,
  fontFamily: "caveat",
  fontSize: 22,
  fontColor: "#FFFFFF",
  backgroundColor: "#000000",
  backgroundOpacity: 0.5,
  strokeWidth: 1.5,
  strokeColor: "#000000",
  shadowEnabled: true,
  preferredLanguage: "en",
  opacity: 1,
};

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

export function fontFamilyToNative(family: SubtitleFontFamily): string | undefined {
  switch (family) {
    case "caveat": return "Caveat-Bold";
    case "henny-penny": return "HennyPenny-Regular";
    case "system": return undefined;
  }
}

export const SUBTITLE_FONT_OPTIONS: { label: string; value: SubtitleFontFamily; nativeFamily?: string }[] = [
  { label: "Caveat", value: "caveat", nativeFamily: "Caveat-Bold" },
  { label: "Henny Penny", value: "henny-penny", nativeFamily: "HennyPenny-Regular" },
  { label: "System", value: "system" },
];

export const SUBTITLE_COLOR_PRESETS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Yellow", value: "#FFFF00" },
  { label: "Cyan", value: "#00FFFF" },
  { label: "Green", value: "#00FF00" },
  { label: "Magenta", value: "#FF00FF" },
  { label: "Red", value: "#FF4D4D" },
];
