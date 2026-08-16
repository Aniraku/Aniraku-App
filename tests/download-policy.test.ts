import { describe, expect, it } from "vitest";
import { downloadLabel, isDownloadableSource, selectMaximumQualityDownload } from "@/lib/download-policy";

describe("offline download policy", () => {
  it("chooses the highest eligible direct progressive quality even when Auto playback is also available", () => {
    const chosen = selectMaximumQualityDownload([
      { url: "https://cdn.example/auto.m3u8", quality: "AUTO", type: "hls" },
      { url: "https://cdn.example/480.mp4", quality: "480p", type: "mp4" },
      { url: "https://cdn.example/1080.mp4", quality: "1080p", type: "mp4" },
      { url: "https://cdn.example/720.mp4", quality: "720p", type: "mp4" },
    ]);
    expect(chosen?.url).toBe("https://cdn.example/1080.mp4");
    expect(downloadLabel(chosen ?? null)).toBe("1080p MAX");
  });

  it("refuses adaptive, embedded, dead, and non-HTTPS sources", () => {
    expect(isDownloadableSource({ url: "https://cdn.example/master.m3u8", type: "hls" })).toBe(false);
    expect(isDownloadableSource({ url: "https://player.example/watch", type: "embed" })).toBe(false);
    expect(isDownloadableSource({ url: "https://cdn.example/file.mp4", verification: "dead" })).toBe(false);
    expect(isDownloadableSource({ url: "http://cdn.example/file.mp4", type: "mp4" })).toBe(false);
    expect(selectMaximumQualityDownload([{ url: "https://cdn.example/master.m3u8", type: "hls" }])).toBeNull();
  });
});
