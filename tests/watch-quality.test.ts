import { describe, expect, it } from "vitest";
import { adaptiveBitrateCapOptions, directSourceQualityOptions, selectedWatchQuality, watchQualityOptions } from "../lib/watch-quality";
import { codecFamilyLabel } from "../lib/hls-variants";

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

describe("direct source quality options (non-HLS playback)", () => {
  it("builds one chip per distinct real source, ranked tall→short, Auto on top", () => {
    const response = {
      sources: [
        { url: "https://cdn.example/1080.mp4", quality: "1080p", type: "mp4", verification: "verified" },
        { url: "https://cdn.example/720.mp4", quality: "720p", type: "mp4", verification: "verified" },
        { url: "https://cdn.example/720-dup.mp4", quality: "720p", type: "mp4", verification: "verified" },
      ],
    };
    const options = directSourceQualityOptions(response as never, null);
    expect(options[0]).toMatchObject({ label: "Auto", requestQuality: "auto" });
    expect(options.map((option) => option.label)).toEqual(["Auto", "1080p", "720p"]);
    // Every fixed chip mounts a REAL source — selection never gambles on a
    // quality re-request.
    expect(options[1].source?.url).toBe("https://cdn.example/1080.mp4");
    expect(options[2].source?.url).toBe("https://cdn.example/720.mp4");
  });

  it("mounts the auto source when only an auto source exists", () => {
    const response = { sources: [{ url: "https://cdn.example/auto.mp4", quality: "auto", verification: "verified" }] };
    const options = directSourceQualityOptions(response as never, null);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ label: "Auto", requestQuality: "auto", source: { url: "https://cdn.example/auto.mp4" } });
  });

  it("drops dead and embed sources, and appends unbacked provider claims last", () => {
    const response = {
      sources: [
        { url: "https://cdn.example/480.mp4", quality: "480p", verification: "verified" },
        { url: "https://cdn.example/dead.mp4", quality: "2160p", verification: "dead" },
        { url: "https://player.example/watch", type: "embed", verification: "embed" },
      ],
      qualities: ["1080p"],
    };
    const options = directSourceQualityOptions(response as never, null);
    expect(options.map((option) => option.label)).toEqual(["Auto", "480p", "1080p"]);
    // The unbacked "1080p" claim keeps the existing quality re-request path.
    expect(options[2].source).toBeUndefined();
  });

  it("returns nothing without sources", () => {
    expect(directSourceQualityOptions({ sources: [] }, null)).toEqual([]);
    expect(directSourceQualityOptions(null, null)).toEqual([]);
  });
});

describe("codecFamilyLabel", () => {
  it("maps HLS CODECS strings to short family labels", () => {
    expect(codecFamilyLabel("avc1.640028,mp4a.40.2")).toBe("AVC");
    expect(codecFamilyLabel("hvc1.1.6.L123.00")).toBe("HEVC");
    expect(codecFamilyLabel("av01.0.08M.08")).toBe("AV1");
    expect(codecFamilyLabel("vp09.00.10.08")).toBe("VP9");
    expect(codecFamilyLabel("")).toBeNull();
    expect(codecFamilyLabel(undefined)).toBeNull();
  });
});
