import { describe, expect, it } from "vitest";
import { adaptiveBitrateCapOptions, selectedWatchQuality, watchQualityOptions } from "../lib/watch-quality";

describe("native Watch quality options", () => {
  it("shows only provider-returned source labels and preserves Auto as the default", () => {
    const response = { qualities: ["Auto", "720p", "480p"], sources: [{ url: "https://cdn.example/master.m3u8", quality: "Auto" }, { url: "https://cdn.example/720.m3u8", quality: "720p" }] };
    expect(watchQualityOptions(response, response.sources[0]).map((item) => item.label)).toEqual(["Auto", "720p", "480p"]);
    expect(selectedWatchQuality(response.sources[0], "auto")).toBe("Auto");
    expect(selectedWatchQuality(response.sources[0], "720p")).toBe("720p");
  });

  it("creates truthful adaptive ceilings from loaded supported variants without inventing renditions", () => {
    const source = { url: "https://cdn.example/master.m3u8", quality: "Auto" } as any;
    const options = adaptiveBitrateCapOptions(source, [
      { size: { height: 1080 }, bitrate: 5_100_000, isSupported: true },
      { size: { height: 720 }, bitrate: 2_700_000, isSupported: true },
      { size: { height: 480 }, bitrate: 1_250_000, isSupported: true },
      { size: { height: 720 }, bitrate: 2_100_000, isSupported: true },
    ]);

    expect(options.map((item) => item.label)).toEqual(["Auto", "1080p cap", "720p cap", "480p cap"]);
    expect(options[0]?.maxVideoBitrate).toBeNull();
    expect(options.find((item) => item.label === "720p cap")?.maxVideoBitrate).toBe(2_700_000);
    expect(options.every((item) => item.isAdaptiveCap)).toBe(true);
  });

  it("does not expose adaptive caps for fixed, embedded-like, single-track, or unsupported variants", () => {
    const tracks = [{ size: { height: 720 }, bitrate: 2_700_000, isSupported: true }];
    expect(adaptiveBitrateCapOptions({ url: "https://cdn.example/720.mp4", quality: "720p" } as any, tracks)).toEqual([]);
    expect(adaptiveBitrateCapOptions({ url: "https://embed.example/watch", quality: "Auto" } as any, tracks)).toEqual([]);
    expect(adaptiveBitrateCapOptions({ url: "https://cdn.example/master.m3u8", quality: "Auto" } as any, [
      { size: { height: 720 }, bitrate: 2_700_000, isSupported: false },
      { size: { height: 480 }, bitrate: 1_250_000, isSupported: false },
    ])).toEqual([]);
  });
});
