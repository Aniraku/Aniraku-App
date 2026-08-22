import { describe, expect, it } from "vitest";
import { compareVersions, isReleaseNewer, normalizeVersion, parseGitHubRelease, updateDismissalKey } from "../lib/app-update";

describe("Aniraku direct-distribution update logic", () => {
  it("normalizes and compares release tags without treating a suffix as a newer build", () => {
    expect(normalizeVersion("v4.2.1 — Stability")).toBe("4.2.1");
    expect(compareVersions("4.2.1", "4.2")).toBe(1);
    expect(compareVersions("4.2", "4.2.0")).toBe(0);
    expect(isReleaseNewer("4.2.1", "v4.2.1")).toBe(false);
  });

  it("accepts only usable GitHub release metadata and namespaces dismissal by release", () => {
    expect(parseGitHubRelease({ tag_name: "v4.2.1", name: "v4.2.1", html_url: "https://github.com/Aniraku/Aniraku-App/releases/tag/v4.2.1" })).toMatchObject({ version: "4.2.1" });
    expect(parseGitHubRelease({ tag_name: "v4.2.1" })).toBeNull();
    expect(updateDismissalKey("v4.2.1")).toBe("aniraku.update.dismissed:4.2.1");
  });
});
