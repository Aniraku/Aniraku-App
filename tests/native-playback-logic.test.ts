import { describe, expect, it } from "vitest";
import { getPlaybackType, hasExpiredEmbeddedToken, playableSources } from "../lib/aniraku-api";
import { chooseResumeEpisode, progressFraction } from "../lib/watch-progress";

describe("Aniraku native playback coordination", () => {
  it("classifies HLS, DASH, direct media, and non-native embeds correctly", () => {
    expect(getPlaybackType({ url: "https://cdn.example/stream.m3u8" })).toBe("hls");
    expect(getPlaybackType({ url: "https://cdn.example/stream.mpd" })).toBe("dash");
    expect(getPlaybackType({ url: "https://cdn.example/stream.webm" })).toBe("native");
    expect(getPlaybackType({ url: "https://host.example/frame", type: "embed" })).toBe("embed");
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
