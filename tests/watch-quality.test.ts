import { describe, expect, it } from "vitest";
import { selectedWatchQuality, watchQualityOptions } from "../lib/watch-quality";

describe("native Watch quality options", () => {
  it("shows only provider-returned source labels and preserves Auto as the default", () => {
    const response = { qualities: ["Auto", "720p", "480p"], sources: [{ url: "https://cdn.example/master.m3u8", quality: "Auto" }, { url: "https://cdn.example/720.m3u8", quality: "720p" }] };
    expect(watchQualityOptions(response, response.sources[0]).map((item) => item.label)).toEqual(["Auto", "720p", "480p"]);
    expect(selectedWatchQuality(response.sources[0], "auto")).toBe("Auto");
    expect(selectedWatchQuality(response.sources[0], "720p")).toBe("720p");
  });
});
