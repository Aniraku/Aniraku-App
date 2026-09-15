import { describe, expect, it } from "vitest";
import { AVATAR_CACHE_SUBDIR, avatarCacheFileName, hashAvatarUrl } from "../lib/avatar-cache";

describe("Avatar file cache", () => {
  it("derives a stable filename that preserves the real image extension", () => {
    const url = "https://sbjdrjaovcgvttfnpfsz.supabase.co/storage/v1/object/public/Anixen%20Avatars/vegeta.png";
    expect(avatarCacheFileName(url)).toBe(`${hashAvatarUrl(url)}.png`);
    expect(avatarCacheFileName(url)).toBe(avatarCacheFileName(url));
  });

  it("gives distinct files to distinct URLs and normalizes jpeg", () => {
    const a = avatarCacheFileName("https://cdn.example/a/user-00.jpeg");
    const b = avatarCacheFileName("https://cdn.example/a/user-01.jpeg");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}\.jpg$/);
  });

  it("falls back to jpg when the URL carries no image extension", () => {
    expect(avatarCacheFileName("https://cdn.example/avatar?id=7")).toMatch(/^[0-9a-f]{8}\.jpg$/);
  });

  it("uses a dedicated cache subdirectory", () => {
    expect(AVATAR_CACHE_SUBDIR).toBe("aniraku-avatars");
  });
});
