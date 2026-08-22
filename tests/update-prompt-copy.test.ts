import { describe, expect, it } from "vitest";
import { updatePromptCopy } from "../lib/update-prompt-copy";

describe("Aniraku update prompt copy", () => {
  it("names the installed and verified release versions without a stale generic CTA", () => {
    expect(updatePromptCopy("4.2.3", "4.2.4")).toEqual({
      label: "ANIRAKU V4.2.4 / UPDATE READY",
      title: "Aniraku v4.2.4 is ready.",
      body: "You are using v4.2.3. Download the verified official v4.2.4 APK and let Android’s system installer complete the update.",
      installLabel: "INSTALL V4.2.4",
    });
  });
});
