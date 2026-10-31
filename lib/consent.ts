import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Versioned Terms/Privacy consent. Bump CURRENT_CONSENT_VERSION whenever the
 * ToS or Privacy policy materially changes — every signed-in-install older
 * than the new version gets one re-consent sheet on next launch.
 */
export const CURRENT_CONSENT_VERSION = 2;
const CONSENT_KEY = "aniraku.legal-consent.v1";

export type ConsentRecord = { version: number; acceptedAt: string };

export async function readConsent(): Promise<ConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    return typeof parsed?.version === "number" && typeof parsed?.acceptedAt === "string" ? { version: parsed.version, acceptedAt: parsed.acceptedAt } : null;
  } catch {
    return null;
  }
}

export async function consentOutdated(): Promise<boolean> {
  const record = await readConsent();
  return !record || record.version < CURRENT_CONSENT_VERSION;
}

export async function acceptCurrentConsent(): Promise<void> {
  const record: ConsentRecord = { version: CURRENT_CONSENT_VERSION, acceptedAt: new Date().toISOString() };
  try { await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch { /* best effort */ }
}
