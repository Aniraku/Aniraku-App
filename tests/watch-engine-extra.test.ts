import { describe, expect, it } from "vitest";
import {
  activeSkipKind,
  isAutoQuality,
  isVerifiedEmbedSource,
  mergeSkipSegments,
  parseQualityOptions,
  providerSkipSegments,
  qualityRank,
} from "../lib/watch-engine";

describe("watch-engine uncovered pure functions", () => {
  it("ranks Auto first, then numeric heights, then unknowns", () => {
    expect(qualityRank("Auto")).toBe(10_000);
    expect(qualityRank(undefined)).toBe(10_000);
    expect(qualityRank("1080p")).toBeGreaterThan(qualityRank("720p"));
    expect(qualityRank("weird-label")).toBe(1);
  });

  it("detects Auto quality labels", () => {
    expect(isAutoQuality(null)).toBe(true);
    expect(isAutoQuality({ url: "https://cdn.example/a.m3u8", quality: "Auto" })).toBe(true);
    expect(isAutoQuality({ url: "https://cdn.example/a.m3u8", quality: "720p" })).toBe(false);
  });

  it("accepts embed sources by type or verification", () => {
    expect(isVerifiedEmbedSource({ url: "https://e.example/1", type: "embed" })).toBe(true);
    expect(isVerifiedEmbedSource({ url: "https://e.example/2", verification: "embed" })).toBe(true);
    expect(isVerifiedEmbedSource({ url: "https://cdn.example/a.mp4", type: "mp4" })).toBe(false);
  });

  it("keeps provider skip segments and prefers provider over aniskip on merge", () => {
    const provider = providerSkipSegments({
      sources: [],
      intro: { startTime: 10, endTime: 90 },
      outro: { startTime: 1300, endTime: 1400 },
    });
    expect(provider.intro?.source).toBe("provider");
    const merged = mergeSkipSegments(
      { intro: { startTime: 1, endTime: 50, source: "aniskip" }, outro: null },
      provider,
    );
    expect(merged.intro?.source).toBe("provider");
    expect(merged.outro?.source).toBe("provider");
  });

  it("reports the active skip kind by playback position", () => {
    const segments = {
      intro: { startTime: 10, endTime: 90, source: "provider" as const },
      outro: { startTime: 1300, endTime: 1400, source: "provider" as const },
    };
    expect(activeSkipKind(segments, 20)).toBe("intro");
    expect(activeSkipKind(segments, 1350)).toBe("outro");
    expect(activeSkipKind(segments, 500)).toBeNull();
  });

  it("returns ranked native sources for fixed quality switching", () => {
    const options = parseQualityOptions({
      sources: [
        { url: "https://cdn.example/720.m3u8", quality: "720p" },
        { url: "https://cdn.example/master.m3u8", quality: "Auto" },
      ],
    });
    expect(options.map((source) => source.quality)).toEqual(["Auto", "720p"]);
  });
});
