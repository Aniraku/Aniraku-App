import { describe, expect, it } from "vitest";

const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

describe("Aniraku production service configuration", () => {
  it("reaches the Aniraku health endpoint and validates the Supabase public client key", async () => {
    expect(apiBase).toMatch(/^https:\/\//);
    expect(supabaseUrl).toMatch(/^https:\/\/[^/]+\.supabase\.co$/);
    expect(supabaseAnonKey).toBeTruthy();

    const [healthResponse, authSettingsResponse, metadataResponse] = await Promise.all([
      fetch(`${apiBase}/api/v1/health`),
      fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: supabaseAnonKey! },
      }),
      fetch(`${apiBase}/api/v1/anime/16498`),
    ]);

    expect(healthResponse.ok).toBe(true);
    await expect(healthResponse.json()).resolves.toMatchObject({ status: "ok" });

    expect(authSettingsResponse.ok).toBe(true);
    await expect(authSettingsResponse.json()).resolves.toHaveProperty("external");

    expect(metadataResponse.ok).toBe(true);
    await expect(metadataResponse.json()).resolves.toMatchObject({ id: 16498, title: expect.any(Object) });
  }, 20_000);
});
