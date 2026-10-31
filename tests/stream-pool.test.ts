import { describe, expect, it, vi } from "vitest";

// The native binding resolves expo-modules-core, whose entry is TypeScript
// that the vitest transform cannot parse — every suite in this repo mocks
// its native bindings instead (see downloads-facade.test.ts).
vi.mock("@/lib/stream-pool-native", () => ({
  streamPoolNative: { available: true, begin: vi.fn(), end: vi.fn() },
}));

import { isSegmentPoolEligible } from "../lib/stream-pool";

const FLAG_ON = true;
const MODULE_ON = true;

describe("segment pool eligibility", () => {
  it("engages for a healthy proxied HLS source when the flag and module are live", () => {
    const source = {
      url: "https://api.aniraku.tech/api/v1/proxy?url=https%3A%2F%2Fmedia.settlar.io%2Fmaster.m3u8&headers=%7B%7D",
      type: "hls",
      verification: "proxy",
    };
    expect(isSegmentPoolEligible({ source, flagEnabled: FLAG_ON, moduleAvailable: MODULE_ON })).toBe(true);
  });

  it("stays off unless both the build flag and the native module are live", () => {
    const source = { url: "https://cdn.example/master.m3u8", type: "hls" };
    expect(isSegmentPoolEligible({ source, flagEnabled: false, moduleAvailable: MODULE_ON })).toBe(false);
    expect(isSegmentPoolEligible({ source, flagEnabled: FLAG_ON, moduleAvailable: false })).toBe(false);
    expect(isSegmentPoolEligible({ source, flagEnabled: false, moduleAvailable: false })).toBe(false);
  });

  it("refuses everything that is not streamed HLS", () => {
    const flagAndModule = { flagEnabled: FLAG_ON, moduleAvailable: MODULE_ON };
    // progressive MP4
    expect(isSegmentPoolEligible({ source: { url: "https://cdn.example/ep.mp4" }, ...flagAndModule })).toBe(false);
    // DASH
    expect(isSegmentPoolEligible({ source: { url: "https://cdn.example/ep.mpd", type: "dash" }, ...flagAndModule })).toBe(false);
    // embed
    expect(isSegmentPoolEligible({ source: { url: "https://player.example/watch", type: "embed" }, ...flagAndModule })).toBe(false);
    // dead source
    expect(isSegmentPoolEligible({ source: { url: "https://cdn.example/ep.m3u8", verification: "dead" }, ...flagAndModule })).toBe(false);
    // offline copies
    expect(isSegmentPoolEligible({ source: { url: "file:///data/playlist.m3u8", quality: "1080p · SAVED" }, ...flagAndModule })).toBe(false);
    expect(isSegmentPoolEligible({ source: { url: "content://media/playlist.m3u8" }, ...flagAndModule })).toBe(false);
    // nothing mounted
    expect(isSegmentPoolEligible({ source: null, ...flagAndModule })).toBe(false);
    expect(isSegmentPoolEligible({ source: { url: "" }, ...flagAndModule })).toBe(false);
  });

  it("is purely a gate — no side effects, safe to call during render", () => {
    const source = { url: "https://cdn.example/master.m3u8", type: "hls" };
    const first = isSegmentPoolEligible({ source, flagEnabled: FLAG_ON, moduleAvailable: MODULE_ON });
    const second = isSegmentPoolEligible({ source, flagEnabled: FLAG_ON, moduleAvailable: MODULE_ON });
    expect(first).toBe(second);
  });
});
