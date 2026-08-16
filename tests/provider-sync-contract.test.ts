import { describe, expect, it } from "vitest";
import { connectedProviders, normalizeSyncStatus, tokenHealth } from "@/lib/provider-sync-contract";

describe("provider sync contract", () => {
  it("only treats configured and connected services as automatic sync targets", () => {
    const status = normalizeSyncStatus({ mal: { configured: true, connected: true, username: "mio", expires_at: 4_102_444_800 }, anilist: { configured: true, connected: false } });
    expect(connectedProviders(status)).toEqual(["mal"]);
    expect(status.mal.username).toBe("mio");
    expect(status.anilist.connected).toBe(false);
  });

  it("normalizes incomplete server payloads and keeps token details secret", () => {
    const status = normalizeSyncStatus({ mal: { configured: "true", access_token: "must-not-leak" }, anilist: null });
    expect(status).toEqual({ mal: { configured: false, connected: false, username: undefined, expires_at: undefined }, anilist: { configured: false, connected: false, username: undefined, expires_at: undefined } });
    expect(tokenHealth()).toBe("TOKEN STATUS MANAGED SECURELY");
  });
});
