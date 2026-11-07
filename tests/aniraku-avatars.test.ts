import { describe, expect, it } from "vitest";

// lib/aniraku-avatars calls requirePublicConfig() at import time, so a missing
// EXPO_PUBLIC_SUPABASE_URL would otherwise throw during collection and fail the
// whole suite instead of skipping it. Gate on the env first, import lazily.
const configured = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL?.trim());

describe.runIf(configured)("Aniraku main avatar library", () => {
  it("uses the same public Anixen Avatars Supabase bucket as the main frontend", async () => {
    const { ANIRAKU_AVATARS, avatarUrl } = await import("../lib/aniraku-avatars");
    // Same visible set as the website: 113 bucket files minus the 17 the
    // site hides (10 link_click + 7 smoking_behind presets).
    expect(ANIRAKU_AVATARS).toHaveLength(96);
    // New presets adopted from the website are present…
    expect(ANIRAKU_AVATARS.some((avatar) => avatar.name === "demon_slayer_infinity_castle_01_avatar_01.png")).toBe(true);
    expect(ANIRAKU_AVATARS.some((avatar) => avatar.name === "mushoku_tensei_s3_01_rudeus.png")).toBe(true);
    expect(ANIRAKU_AVATARS.some((avatar) => avatar.name === "blue_lock_season_2_15_avatar_15.png")).toBe(true);
    // …and the website's hidden presets stay hidden.
    expect(ANIRAKU_AVATARS.some((avatar) => avatar.name.startsWith("link_click_"))).toBe(false);
    expect(ANIRAKU_AVATARS.some((avatar) => avatar.name === "smoking_behind_supermarket_03_avatar_03.png")).toBe(false);
    expect(ANIRAKU_AVATARS.some((avatar) => avatar.name === "smoking_behind_supermarket_01_avatar_01.png")).toBe(true);
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
