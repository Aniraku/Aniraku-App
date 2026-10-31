import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => { store.set(key, value); },
  },
}));

import { acceptCurrentConsent, consentOutdated, CURRENT_CONSENT_VERSION, readConsent } from "@/lib/consent";

describe("consent versioning", () => {
  beforeEach(() => store.clear());

  it("requires consent when nothing is stored", async () => {
    await expect(consentOutdated()).resolves.toBe(true);
  });

  it("accepts and then stays current", async () => {
    await acceptCurrentConsent();
    const record = await readConsent();
    expect(record?.version).toBe(CURRENT_CONSENT_VERSION);
    expect(record?.acceptedAt).toBeTruthy();
    await expect(consentOutdated()).resolves.toBe(false);
  });

  it("re-prompts when the stored version is behind", async () => {
    await store.set("aniraku.legal-consent.v1", JSON.stringify({ version: CURRENT_CONSENT_VERSION - 1, acceptedAt: "2026-01-01T00:00:00.000Z" }));
    await expect(consentOutdated()).resolves.toBe(true);
  });

  it("treats corrupt records as no consent", async () => {
    await store.set("aniraku.legal-consent.v1", "{not json");
    await expect(consentOutdated()).resolves.toBe(true);
  });
});
