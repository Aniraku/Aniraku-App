import { describe, expect, it } from "vitest";
import { anirakuProxyUrl, getPlaybackType, hasExpiredEmbeddedToken, nativePlaybackHeaders, normalizeStreamResponse, playableSources } from "../lib/aniraku-api";
import { getKnownMalId } from "../lib/anilist";
import { directSources, episodePageCount, episodePageFor, episodePageSlice, FUTURE_RELEASE_MESSAGE, hasConfirmedPlaybackStart, isConfirmedFutureRelease, isProxySource, nativeSources, normalizeAniSkipSegments, proxySources, shouldApplyInitialHistoryResume, shouldHoldRebufferWatermark, shouldMountReplacementSource, shouldRetryProxiedSourceAfterDirect } from "../lib/watch-engine";

describe("Aniraku native playback coordination", () => {
  it("keeps only Android-safe transport headers for direct media", () => {
    expect(nativePlaybackHeaders({ Referer: "https://allmanga.to/", "User-Agent": "browser", Origin: "https://example.com", Authorization: "Bearer token" })).toEqual({ Referer: "https://allmanga.to/", Authorization: "Bearer token" });
  });

  it("uses the same Aniraku proxy request contract", () => {
    const proxied = anirakuProxyUrl("https://cdn.example/episode.m3u8", { Referer: "https://provider.example/", "User-Agent": "browser" });
    expect(proxied).toContain("https://api.aniraku.tech/api/v1/proxy?");
    expect(decodeURIComponent(proxied)).toContain("url=https://cdn.example/episode.m3u8");
    expect(decodeURIComponent(proxied)).toContain('headers={"Referer":"https://provider.example/","User-Agent":"browser"}');
  });

  it("normalizes the deployed backend skip segment fields", () => {
    const stream = normalizeStreamResponse({ sources: [], intro: { start: 47.3, end: 137.3 }, outro: { start: 1344.9, end: 1434.9 } });
    expect(stream.intro).toEqual({ startTime: 47.3, endTime: 137.3 });
    expect(stream.outro).toEqual({ startTime: 1344.9, endTime: 1434.9 });
  });

  it("classifies HLS, DASH, and native media correctly", () => {
    expect(getPlaybackType({ url: "https://cdn.example/stream.m3u8" })).toBe("hls");
    expect(getPlaybackType({ url: "https://cdn.example/stream.mpd" })).toBe("dash");
    expect(getPlaybackType({ url: "https://cdn.example/stream.webm" })).toBe("native");
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

  it("keeps direct and proxy sources separately eligible", () => {
    const response = {
      sources: [
        { url: "https://direct.example/720.m3u8", quality: "720p", verification: "verified" },
        { url: "https://cdn.example/720.m3u8", quality: "720p", verification: "proxy" },
        { url: "https://cdn.example/master.m3u8", quality: "Auto", Verification: "proxy" },
        { url: "https://cdn.example/1080.m3u8", quality: "1080p", verification: "proxy" },
      ],
    };
    expect(directSources(response).map((source) => source.url)).toEqual([
      "https://direct.example/720.m3u8",
    ]);
    expect(proxySources(response).map((source) => source.url)).toEqual([
      "https://cdn.example/master.m3u8",
      "https://cdn.example/1080.m3u8",
      "https://cdn.example/720.m3u8",
    ]);
    expect(nativeSources(response).map((source) => source.url)).toEqual([
      "https://direct.example/720.m3u8",
      "https://cdn.example/master.m3u8",
      "https://cdn.example/1080.m3u8",
      "https://cdn.example/720.m3u8",
    ]);
    expect(isProxySource(response.sources[1])).toBe(true);
  });

  it("blocks confirmed future episodes and movies", () => {
    const released = [{ number: 1 }, { number: 2 }, { number: 3 }];
    expect(isConfirmedFutureRelease({ episodeNumber: 4, episodes: released, status: "RELEASING", hasConfirmedEpisodeList: true })).toBe(true);
    expect(isConfirmedFutureRelease({ episodeNumber: 3, episodes: released, status: "RELEASING", hasConfirmedEpisodeList: true })).toBe(false);
    expect(isConfirmedFutureRelease({ episodeNumber: 1, status: "NOT_YET_RELEASED" })).toBe(true);
    expect(isConfirmedFutureRelease({ episodeNumber: 1, nextAiringEpisode: { episode: 1 } })).toBe(true);
    expect(isConfirmedFutureRelease({ episodeNumber: 1, status: "FINISHED" })).toBe(false);
    expect(FUTURE_RELEASE_MESSAGE).toContain("Time travel still has not been invented");
  });

  it("uses known backend or AniList metadata IDs", () => {
    expect(getKnownMalId({ idMal: 21 })).toBe(21);
    expect(getKnownMalId({ malId: 22 })).toBe(22);
    expect(getKnownMalId({ mal_id: 23 })).toBe(23);
    expect(getKnownMalId({ myAnimeListId: 24 })).toBe(24);
    expect(getKnownMalId({ idMal: 0 })).toBeNull();
  });

  it("normalizes AniSkip v2 opening and ending payloads", () => {
    const segments = normalizeAniSkipSegments({ results: [
      { skipType: "op", interval: { startTime: 28.783, endTime: 118.783 } },
      { skipType: "ed", interval: { startTime: 1387.996, endTime: 1500 } },
    ] });
    expect(segments).toEqual({
      intro: { startTime: 28.783, endTime: 118.783, source: "aniskip" },
      outro: { startTime: 1387.996, endTime: 1500, source: "aniskip" },
    });
  });

  it("paginates high-episode-count titles", () => {
    const episodes = Array.from({ length: 1173 }, (_, index) => index + 1);
    expect(episodePageCount(episodes.length)).toBe(24);
    expect(episodePageFor(1173)).toBe(23);
    expect(episodePageSlice(episodes, 0)).toHaveLength(50);
    expect(episodePageSlice(episodes, 23)).toEqual(episodes.slice(1150));
  });

  it("preserves an already-mounted initial source during background metadata refresh", () => {
    expect(shouldMountReplacementSource(false, false)).toBe(true);
    expect(shouldMountReplacementSource(true, false)).toBe(false);
    expect(shouldMountReplacementSource(true, true)).toBe(true);
  });

  it("does not mistake a ready-but-unrendered source for successful playback", () => {
    expect(hasConfirmedPlaybackStart({ isPlaying: false, currentTime: 0, firstFrameRendered: false })).toBe(false);
    expect(hasConfirmedPlaybackStart({ isPlaying: false, currentTime: 0, firstFrameRendered: true })).toBe(true);
    expect(hasConfirmedPlaybackStart({ isPlaying: true, currentTime: 0, firstFrameRendered: false })).toBe(false);
    expect(hasConfirmedPlaybackStart({ isPlaying: false, currentTime: 1, firstFrameRendered: false })).toBe(true);
    expect(shouldRetryProxiedSourceAfterDirect(false, false)).toBe(true);
    expect(shouldRetryProxiedSourceAfterDirect(true, false)).toBe(false);
    expect(shouldRetryProxiedSourceAfterDirect(false, true)).toBe(false);
  });

  it("holds only the UI/history watermark for small non-user rebuffer rollbacks", () => {
    expect(shouldHoldRebufferWatermark({ lastStableTime: 125.5, reportedTime: 125.2, wasBuffering: true, playbackStarted: true, intentionalSeek: false })).toBe(true);
    expect(shouldHoldRebufferWatermark({ lastStableTime: 125.5, reportedTime: 125.2, wasBuffering: true, playbackStarted: true, intentionalSeek: true })).toBe(false);
    expect(shouldHoldRebufferWatermark({ lastStableTime: 125.5, reportedTime: 110, wasBuffering: true, playbackStarted: true, intentionalSeek: false })).toBe(false);
    expect(shouldHoldRebufferWatermark({ lastStableTime: 125.5, reportedTime: 125.2, wasBuffering: false, playbackStarted: true, intentionalSeek: false })).toBe(false);
  });

  it("allows a saved history position only during a fresh source start", () => {
    expect(shouldApplyInitialHistoryResume({ currentTime: 0, hasPendingResume: true, isPlaying: false, resumeAppliedForSource: false, status: "readyToPlay" })).toBe(true);
    expect(shouldApplyInitialHistoryResume({ currentTime: 0.5, hasPendingResume: true, isPlaying: true, resumeAppliedForSource: false, status: "readyToPlay" })).toBe(true);
    expect(shouldApplyInitialHistoryResume({ currentTime: 58, hasPendingResume: true, isPlaying: false, resumeAppliedForSource: false, status: "readyToPlay" })).toBe(false);
    expect(shouldApplyInitialHistoryResume({ currentTime: 0, hasPendingResume: true, isPlaying: true, resumeAppliedForSource: true, status: "readyToPlay" })).toBe(false);
  });
});
