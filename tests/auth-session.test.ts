import { describe, expect, it } from "vitest";
import { serverUserCanStartSession, sessionIsVerified } from "../lib/auth-session";

describe("verified native session policy", () => {
  it("rejects an absent or unverified email session", () => {
    expect(sessionIsVerified(null)).toBe(false);
    expect(sessionIsVerified({ user: { email_confirmed_at: null, app_metadata: { provider: "email" } } })).toBe(false);
  });

  it("accepts confirmed email sessions", () => {
    expect(sessionIsVerified({ user: { email_confirmed_at: "2026-08-13T00:00:00.000Z", app_metadata: { provider: "email" } } })).toBe(true);
  });

  it("requires Supabase to return the same confirmed user before granting an app session", () => {
    const stored = { user: { id: "user-1", email_confirmed_at: "2026-08-13T00:00:00.000Z", app_metadata: { provider: "email" } } };
    expect(serverUserCanStartSession(stored, stored.user)).toBe(true);
    expect(serverUserCanStartSession(stored, { ...stored.user, email_confirmed_at: null })).toBe(false);
    expect(serverUserCanStartSession(stored, { ...stored.user, id: "deleted-or-replaced-user" })).toBe(false);
    expect(serverUserCanStartSession(stored, null)).toBe(false);
  });
});
