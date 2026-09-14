import { describe, expect, it } from "vitest";
import {
  autoQualityLine,
  chapterTrackSegments,
  liveRenditionHeight,
  mergeSkipSegments,
  type SkipSegments,
} from "../lib/watch-engine";

const SEGMENTS: SkipSegments = {
  intro: { startTime: 85, endTime: 175, source: "aniskip" },
  outro: { startTime: 1320, endTime: 1410, source: "provider" },
};

describe("chapterTrackSegments", () => {
  it("maps intro/outro ranges to timeline percentages", () => {
    const segments = chapterTrackSegments(SEGMENTS, 1440);
    expect(segments).toHaveLength(2);
    expect(segments[0].kind).toBe("intro");
    expect(segments[0].leftPct).toBeCloseTo((85 / 1440) * 100);
    expect(segments[0].widthPct).toBeCloseTo((90 / 1440) * 100);
    expect(segments[1].kind).toBe("outro");
  });

  it("sorts by start time and skips missing segments", () => {
    const segments = chapterTrackSegments({ intro: null, outro: SEGMENTS.outro }, 1440);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe("outro");
  });

  it("clamps out-of-range segments to the duration", () => {
    const segments = chapterTrackSegments(
      { intro: { startTime: -30, endTime: 99999, source: "provider" }, outro: null },
      1440,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].leftPct).toBe(0);
    expect(segments[0].widthPct).toBe(100);
  });

  it("returns nothing without a usable duration", () => {
    expect(chapterTrackSegments(SEGMENTS, 0)).toEqual([]);
    expect(chapterTrackSegments(SEGMENTS, NaN)).toEqual([]);
  });
});

describe("liveRenditionHeight", () => {
  it("reads the selected ExoPlayer video track height", () => {
    expect(
      liveRenditionHeight([
        { height: 1080, bitrate: 5_000_000, selected: false },
        { height: 720, bitrate: 2_800_000, selected: true },
      ]),
    ).toBe(720);
  });

  it("returns null when nothing is selected or no tracks exist", () => {
    expect(liveRenditionHeight([{ height: 720, selected: false }])).toBeNull();
    expect(liveRenditionHeight([])).toBeNull();
    expect(liveRenditionHeight(null)).toBeNull();
    expect(liveRenditionHeight(undefined)).toBeNull();
  });
});

describe("autoQualityLine", () => {
  it("prefers the live rendition over the manifest ceiling", () => {
    expect(autoQualityLine({ ceilingLabel: "1080p", liveHeight: 720 })).toBe("AUTO · 720P");
  });

  it("falls back to the ceiling note when no live height is known", () => {
    expect(autoQualityLine({ ceilingLabel: "1080p", liveHeight: null })).toBe("AUTO ADAPTS UP TO 1080P");
    expect(autoQualityLine({ ceilingLabel: null, liveHeight: null })).toBeNull();
  });
});

describe("mergeSkipSegments", () => {
  it("keeps provider segments over AniSkip ones", () => {
    const merged = mergeSkipSegments(
      { intro: { startTime: 1, endTime: 90, source: "aniskip" }, outro: null },
      { intro: { startTime: 5, endTime: 95, source: "provider" }, outro: null },
    );
    expect(merged.intro?.source).toBe("provider");
    expect(merged.intro?.startTime).toBe(5);
  });
});
