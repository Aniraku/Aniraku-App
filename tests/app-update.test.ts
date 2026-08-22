import { describe, expect, it } from "vitest";
import { compareVersions, isReleaseNewer, normalizeVersion, parseGitHubRelease, trustedAnirakuApkAsset, updateDismissalKey } from "../lib/app-update";

describe("Aniraku direct-distribution update logic", () => {
  it("normalizes and compares release tags without treating a suffix as a newer build", () => {
    expect(normalizeVersion("v4.2.1 — Stability")).toBe("4.2.1");
    expect(compareVersions("4.2.1", "4.2")).toBe(1);
    expect(compareVersions("4.2", "4.2.0")).toBe(0);
    expect(isReleaseNewer("4.2.1", "v4.2.1")).toBe(false);
  });

  it("accepts only a trusted Aniraku GitHub APK asset and namespaces dismissal by release", () => {
    const asset = { name: "Aniraku-v4.2.4.apk", size: 88_000_000, content_type: "application/vnd.android.package-archive", browser_download_url: "https://github.com/Aniraku/Aniraku-App/releases/download/v4.2.4/Aniraku-v4.2.4.apk" };
    expect(trustedAnirakuApkAsset(asset)).toMatchObject({ name: "Aniraku-v4.2.4.apk", size: 88_000_000 });
    expect(trustedAnirakuApkAsset({ ...asset, browser_download_url: "https://example.com/Aniraku-v4.2.4.apk" })).toBeNull();
    expect(parseGitHubRelease({ tag_name: "v4.2.4", name: "v4.2.4", html_url: "https://github.com/Aniraku/Aniraku-App/releases/tag/v4.2.4", assets: [asset] })).toMatchObject({ version: "4.2.4", assetName: "Aniraku-v4.2.4.apk" });
    expect(parseGitHubRelease({ tag_name: "v4.2.1" })).toBeNull();
    expect(updateDismissalKey("v4.2.4")).toBe("aniraku.update.dismissed:4.2.4");
  });
});
