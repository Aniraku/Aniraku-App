import { describe, expect, it } from "vitest";
import { SUPPORT_PROMPT_ACTIVE_MS, SUPPORT_PROMPT_DISMISS_MS, USDT_ASSET, USDT_BEP20_ADDRESS, USDT_NETWORK_SHORT, isSupportPromptExcluded, shouldShowSupportPrompt, supportDismissedUntil } from "../lib/support";

describe("Aniraku support surface logic", () => {
  it("publishes the supplied optional USDT BEP20 donation identity without network ambiguity", () => {
    expect(USDT_ASSET).toBe("USDT");
    expect(USDT_NETWORK_SHORT).toBe("BEP20");
    expect(USDT_BEP20_ADDRESS).toBe("0x0dc085fc880f2f67b4e200f125bc0de352da904e");
  });

  it("shows a reminder only after thirty minutes of active use, not during Watch, and suppresses it for seven days after dismissal", () => {
    const now = 1_000_000;
    expect(shouldShowSupportPrompt({ activeMs: SUPPORT_PROMPT_ACTIVE_MS - 1, pathname: "/catalog", now })).toBe(false);
    expect(shouldShowSupportPrompt({ activeMs: SUPPORT_PROMPT_ACTIVE_MS, pathname: "/watch/attack-on-titan-1", now })).toBe(false);
    expect(shouldShowSupportPrompt({ activeMs: SUPPORT_PROMPT_ACTIVE_MS, pathname: "/catalog", now })).toBe(true);
    const until = supportDismissedUntil(now);
    expect(until - now).toBe(SUPPORT_PROMPT_DISMISS_MS);
    expect(shouldShowSupportPrompt({ activeMs: SUPPORT_PROMPT_ACTIVE_MS, pathname: "/catalog", dismissedUntil: until, now })).toBe(false);
    expect(shouldShowSupportPrompt({ activeMs: SUPPORT_PROMPT_ACTIVE_MS, pathname: "/catalog", dismissedUntil: until, now: until + 1 })).toBe(true);
    expect(isSupportPromptExcluded("/watch/one-piece-1")).toBe(true);
  });
});
