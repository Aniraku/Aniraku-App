import { describe, expect, it } from "vitest";
import { sessionIsVerified } from "../lib/auth-session";

describe("verified native session policy", () => {
  it("rejects an absent or unverified email session", () => {
    expect(sessionIsVerified(null)).toBe(false);
    expect(sessionIsVerified({ user: { email_confirmed_at: null, app_metadata: { provider: "email" } } })).toBe(false);
  });

  it("accepts confirmed email sessions", () => {
    expect(sessionIsVerified({ user: { email_confirmed_at: "2026-08-13T00:00:00.000Z", app_metadata: { provider: "email" } } })).toBe(true);
  });
});
