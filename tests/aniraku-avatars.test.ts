import { describe, expect, it } from "vitest";

// lib/aniraku-avatars calls requirePublicConfig() at import time, so a missing
// EXPO_PUBLIC_SUPABASE_URL would otherwise throw during collection and fail the
// whole suite instead of skipping it. Gate on the env first, import lazily.
const configured = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL?.trim());

describe.runIf(configured)("Aniraku main avatar library", () => {
  it("uses the same public Anixen Avatars Supabase bucket as the main frontend", async () => {
    const { ANIRAKU_AVATARS, avatarUrl } = await import("../lib/aniraku-avatars");
    expect(ANIRAKU_AVATARS).toHaveLength(27);
    expect(ANIRAKU_AVATARS[0].url).toContain("sbjdrjaovcgvttfnpfsz.supabase.co/storage/v1/object/public/Anixen%20Avatars/01.png");
    expect(avatarUrl("vegeta.png")).toBe(ANIRAKU_AVATARS.find((avatar) => avatar.name === "vegeta.png")?.url);
  });

  it("provides a deterministic non-empty fallback avatar for every profile seed", async () => {
    const { defaultAvatar } = await import("../lib/aniraku-avatars");
    expect(defaultAvatar(65)).toEqual(defaultAvatar(65));
    expect(defaultAvatar(-1).url).toMatch(/^https:\/\//);
  });
});

describe.skipIf(configured)("Aniraku main avatar library (env not configured)", () => {
  it.skip("requires EXPO_PUBLIC_SUPABASE_URL — skipped so local/CI runs stay green", () => {});
});
