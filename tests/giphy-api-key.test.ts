import { describe, expect, it } from "vitest";

describe("native GIPHY configuration", () => {
  it("retrieves one G-rated GIF metadata record with the configured public key", async () => {
    const apiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(
      `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(apiKey!)}&limit=1&rating=g`,
    );

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { data?: unknown[] };
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data?.length).toBeGreaterThan(0);
  }, 20_000);
});
