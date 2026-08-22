import { describe, expect, it } from "vitest";
import { ANIRAKU_AUTH_REDIRECT_URL, readCallbackValue, signUpVerificationNotice, verificationResentNotice } from "../lib/auth-redirect";

describe("Aniraku Android email verification redirect", () => {
  it("uses the exact registered Android auth callback and gives actionable inbox plus Spam/Junk guidance", () => {
    expect(ANIRAKU_AUTH_REDIRECT_URL).toBe("aniraku://auth");
    expect(signUpVerificationNotice("member@aniraku.tech")).toContain("member@aniraku.tech");
    expect(signUpVerificationNotice("member@aniraku.tech")).toContain("Spam or Junk");
    expect(signUpVerificationNotice("member@aniraku.tech")).toContain("Confirm email address");
    expect(verificationResentNotice("member@aniraku.tech")).toContain("another confirmation email");
    expect(verificationResentNotice("member@aniraku.tech")).toContain("member@aniraku.tech");
  });

  it("reads scalar and repeated Android callback query values safely", () => {
    expect(readCallbackValue("confirmed")).toBe("confirmed");
    expect(readCallbackValue(["confirmed", "ignored"])).toBe("confirmed");
    expect(readCallbackValue(undefined)).toBeUndefined();
  });
});
