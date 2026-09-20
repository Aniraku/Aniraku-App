import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../lib/app-config";

// Read through the app's config (not raw process.env): APP_CONFIG trims
// pasted-secret whitespace, so this validates exactly what the app ships.
const apiBase = APP_CONFIG.apiBaseUrl;
const supabaseUrl = APP_CONFIG.supabaseUrl;
const supabaseAnonKey = APP_CONFIG.supabaseAnonKey;

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
