import { describe, expect, it } from "vitest";
import { anirakuProxyUrl, getPlaybackType, hasExpiredEmbeddedToken, nativePlaybackHeaders, normalizeStreamResponse, playableSources } from "../lib/aniraku-api";
import { chooseResumeEpisode, progressFraction } from "../lib/watch-progress";
import { directSources, embedSources, hasConfirmedPlaybackStart, nextProviderIndex, shouldMountReplacementSource, shouldRetryUnproxiedDirectSource } from "../lib/watch-engine";

describe("Aniraku native playback coordination", () => {
  it("keeps only Android-safe transport headers for direct media", () => {
    expect(nativePlaybackHeaders({ Referer: "https://allmanga.to/", "User-Agent": "browser", Origin: "https://example.com", Authorization: "Bearer token" })).toEqual({ Referer: "https://allmanga.to/", Authorization: "Bearer token" });
  });

  it("uses the same Aniraku proxy request contract as Watch.jsx before direct-media fallback", () => {
    const proxied = anirakuProxyUrl("https://cdn.example/episode.m3u8", { Referer: "https://provider.example/", "User-Agent": "browser" });
    expect(proxied).toContain("https://api.aniraku.tech/api/v1/proxy?");
    expect(decodeURIComponent(proxied)).toContain("url=https://cdn.example/episode.m3u8");
    expect(decodeURIComponent(proxied)).toContain('headers={"Referer":"https://provider.example/","User-Agent":"browser"}');
  });

  it("normalizes the deployed backend skip segment fields used by Watch.jsx", () => {
    const stream = normalizeStreamResponse({ sources: [], intro: { start: 47.3, end: 137.3 }, outro: { start: 1344.9, end: 1434.9 } });
    expect(stream.intro).toEqual({ startTime: 47.3, endTime: 137.3 });
    expect(stream.outro).toEqual({ startTime: 1344.9, endTime: 1434.9 });
  });

  it("classifies HLS, DASH, direct media, and non-native embeds correctly", () => {
    expect(getPlaybackType({ url: "https://cdn.example/stream.m3u8" })).toBe("hls");
    expect(getPlaybackType({ url: "https://cdn.example/stream.mpd" })).toBe("dash");
    expect(getPlaybackType({ url: "https://cdn.example/stream.webm" })).toBe("native");
    expect(getPlaybackType({ url: "https://host.example/frame", type: "embed" })).toBe("embed");
    expect(getPlaybackType({ url: "https://host.example/watch/episode", type: "page" })).toBe("embed");
  });

  it("keeps only verified, non-expired sources", () => {
    const sources = playableSources([
      { url: "https://cdn.example/alive.m3u8", verification: "verified" },
      { url: "https://cdn.example/dead.m3u8", verification: "dead" },
      { url: "" },
      { url: "https://cdn.example/token?expires=20200101000000" },
    ]);
    expect(sources).toEqual([{ url: "https://cdn.example/alive.m3u8", verification: "verified" }]);
    expect(hasExpiredEmbeddedToken("https://cdn.example/token?expires=20200101000000")).toBe(true);
  });

  it("matches Watch.jsx source choices: provider Auto first, verified embeds separate, and uppercase verification supported", () => {
    const response = {
      sources: [
        { url: "https://cdn.example/720.m3u8", quality: "720p", verification: "proxy" },
        { url: "https://cdn.example/master.m3u8", quality: "Auto", Verification: "proxy" },
        { url: "https://cdn.example/1080.m3u8", quality: "1080p", verification: "proxy" },
        { url: "https://embed.example/watch", type: "embed", verification: "embed" },
        { url: "https://page.example/watch", type: "page", Verification: "embed" },
      ],
    };
    expect(directSources(response).map((source) => source.url)).toEqual([
      "https://cdn.example/master.m3u8",
      "https://cdn.example/1080.m3u8",
      "https://cdn.example/720.m3u8",
    ]);
    expect(embedSources(response).map((source) => source.url)).toEqual(["https://embed.example/watch", "https://page.example/watch"]);
  });

  it("preserves an already-mounted initial source during background metadata refresh", () => {
    expect(shouldMountReplacementSource(false, false)).toBe(true);
    expect(shouldMountReplacementSource(true, false)).toBe(false);
    expect(shouldMountReplacementSource(true, true)).toBe(true);
  });

  it("does not mistake a ready-but-unrendered source for successful playback", () => {
    expect(hasConfirmedPlaybackStart({ isPlaying: false, currentTime: 0, firstFrameRendered: false })).toBe(false);
    expect(hasConfirmedPlaybackStart({ isPlaying: false, currentTime: 0, firstFrameRendered: true })).toBe(true);
    expect(hasConfirmedPlaybackStart({ isPlaying: true, currentTime: 0, firstFrameRendered: false })).toBe(true);
    expect(shouldRetryUnproxiedDirectSource(true, false)).toBe(true);
    expect(shouldRetryUnproxiedDirectSource(false, false)).toBe(false);
    expect(shouldRetryUnproxiedDirectSource(true, true)).toBe(false);
  });

  it("fails over to the next provider in the selected language before giving up", () => {
    const providers = [
      { id: "sub:ally", provider: "ally", label: "ALLY", lang: "sub" as const },
      { id: "sub:pewe", provider: "pewe", label: "PEWE", lang: "sub" as const },
      { id: "dub:ally", provider: "ally", label: "ALLY", lang: "dub" as const },
    ];
    expect(nextProviderIndex(providers, 0, new Set([providers[0].id]), true)).toBe(1);
    expect(nextProviderIndex(providers, 1, new Set([providers[0].id, providers[1].id]), true)).toBe(-1);
  });

  it("resumes after the furthest completed episode before earlier partial playback", () => {
    const entries = [
      { episode_number: 7, progress: 450, duration: 600 },
      { episode_number: 8, progress: 600, duration: 600 },
      { episode_number: 2, progress: 599, duration: 600 },
    ];
    expect(progressFraction(entries[0])).toBe(0.75);
    expect(chooseResumeEpisode(entries)).toBe(9);
    expect(chooseResumeEpisode([{ episode_number: 4, progress: 222, duration: 600 }])).toBe(4);
    expect(chooseResumeEpisode([])).toBe(1);
  });
});
