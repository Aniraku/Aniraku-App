import { describe, expect, it } from "vitest";

const anilistClientId = process.env.ANIRAKU_ANILIST_CLIENT_ID;
const malClientId = process.env.ANIRAKU_MAL_CLIENT_ID;
const redirectUri = process.env.ANIRAKU_OAUTH_REDIRECT_URL;
const anilistClientSecret = process.env.ANIRAKU_ANILIST_CLIENT_SECRET;
const malClientSecret = process.env.ANIRAKU_MAL_CLIENT_SECRET;
const stateSecret = process.env.ANIRAKU_OAUTH_STATE_SECRET;

const configured = Boolean(anilistClientId && malClientId && redirectUri && anilistClientSecret && malClientSecret && stateSecret);

describe("provider OAuth registration", () => {
  it.skipIf(!configured)("keeps all server-only OAuth settings present and accepts the registered redirect at both authorization endpoints", async () => {
    expect(anilistClientSecret).toHaveLength(40);
    expect(malClientSecret).toHaveLength(64);
    expect(stateSecret).toMatch(/^[a-f0-9]{64}$/i);

    const anilistUrl = new URL("https://anilist.co/api/v2/oauth/authorize");
    anilistUrl.searchParams.set("client_id", anilistClientId!);
    anilistUrl.searchParams.set("redirect_uri", redirectUri!);
    anilistUrl.searchParams.set("response_type", "code");

    const malUrl = new URL("https://myanimelist.net/v1/oauth2/authorize");
    malUrl.searchParams.set("response_type", "code");
    malUrl.searchParams.set("client_id", malClientId!);
    malUrl.searchParams.set("redirect_uri", redirectUri!);
    malUrl.searchParams.set("state", "aniraku-registration-check");
    malUrl.searchParams.set("code_challenge", "aniraku-registration-check-000000000000000000000000000000000000000");
    malUrl.searchParams.set("code_challenge_method", "plain");

    const [anilistResponse, malResponse] = await Promise.all([
      fetch(anilistUrl, { redirect: "manual" }),
      fetch(malUrl, { redirect: "manual" }),
    ]);

    expect(anilistResponse.status).toBeGreaterThanOrEqual(200);
    expect(anilistResponse.status).toBeLessThan(400);
    expect(malResponse.status).toBeGreaterThanOrEqual(200);
    expect(malResponse.status).toBeLessThan(400);
  }, 20_000);
});
