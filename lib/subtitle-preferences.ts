import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "aniraku.subtitle-preferences.v2";

export type SubtitlePreferences = {
  enabled: boolean;
  preferredLanguage: string;
};

const DEFAULTS: SubtitlePreferences = {
  enabled: true,
  preferredLanguage: "en",
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
