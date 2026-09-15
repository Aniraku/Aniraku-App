import { describe, expect, it } from "vitest";
import { buildBackendDownloadOptions, downloadLabel, hasQualityBackendDownloads, isDownloadableSource, parseBackendDownloadQuality, selectMaximumQualityDownload, sortBackendDownloadOptions } from "@/lib/download-policy";
import { publicDownloadFilename } from "@/lib/download-policy";

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

  it("creates a safe public Downloads filename that preserves episode, language, and chosen quality", () => {
    expect(publicDownloadFilename("My Anime: Part / One", 7, "dub", "1080p")).toBe("My-Anime-Part-One-ep07-dub-1080p.mp4");
    expect(publicDownloadFilename("My Anime", 7, "sub", "SOURCE", { url: "https://cdn.example/episode.webm", type: "webm" })).toBe("My-Anime-ep07-sub-SOURCE.webm");
  });
});

describe("backend download options", () => {
  it("parses quality tags out of backend download labels", () => {
    expect(parseBackendDownloadQuality("Kiwi 1080p")).toBe("1080p");
    expect(parseBackendDownloadQuality("Kiwi 720p")).toBe("720p");
    expect(parseBackendDownloadQuality("1080P")).toBe("1080p");
    expect(parseBackendDownloadQuality("Zoko")).toBeNull();
    expect(parseBackendDownloadQuality("Download")).toBeNull();
    expect(parseBackendDownloadQuality(null)).toBeNull();
  });

  it("collects links across all providers, dedupes by URL, and tags quality", () => {
    const options = buildBackendDownloadOptions([
      { label: "NIKO", lang: "sub", downloads: [{ url: "https://pahe.example/a", label: "Kiwi 720p" }, { url: "https://pahe.example/b", label: "Kiwi 1080p" }] },
      { label: "MOMO", lang: "sub", downloads: [{ url: "https://pahe.example/b", label: "Kiwi 1080p" }] },
      { label: "ZOKO", lang: "sub", downloads: [{ url: "https://zoko.example/file", label: "Zoko" }] },
    ]);
    expect(options).toHaveLength(3);
    expect(options[0]).toMatchObject({ url: "https://pahe.example/a", quality: "720p", providerLabel: "NIKO" });
    expect(options[2]).toMatchObject({ quality: null });
    expect(hasQualityBackendDownloads(options)).toBe(true);
  });

  it("sorts quality options highest-first with default labels last", () => {
    const sorted = sortBackendDownloadOptions(buildBackendDownloadOptions([
      { label: "ZOKO", downloads: [{ url: "https://zoko.example/file", label: "Zoko" }] },
      { label: "NIKO", downloads: [{ url: "https://pahe.example/a", label: "Kiwi 720p" }, { url: "https://pahe.example/b", label: "Kiwi 1080p" }] },
    ]));
    expect(sorted.map((o) => o.quality)).toEqual(["1080p", "720p", null]);
  });

  it("reports no quality options when every label is a default", () => {
    const options = buildBackendDownloadOptions([{ label: "ZOKO", downloads: [{ url: "https://zoko.example/file", label: "Zoko" }] }]);
    expect(hasQualityBackendDownloads(options)).toBe(false);
  });
});
