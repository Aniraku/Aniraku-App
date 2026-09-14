import { describe, expect, it } from "vitest";
import { buildDashQualityOptions, buildHlsQualityOptions, hlsLevelIndexForHeight, hlsVariantsCacheKey, originalStreamUrl, parseDashRepresentations, parseHlsMasterVariants, resolveVariantUrl, shouldRefetchVariants, shouldRefreshMasterOnVariantError, variantUrlForHeight, variantUrlForQuality, type HlsVariant, type VariantsCacheScope } from "../lib/hls-variants";

const MASTER = [
  "#EXTM3U",
  "#EXT-X-VERSION:6",
  '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=860000,RESOLUTION=1920x1080,URI="iframe.m3u8"',
  "#EXT-X-STREAM-INF:BANDWIDTH=5120000,RESOLUTION=1920x1080,CODECS=\"avc1.640028,mp4a.40.2\"",
  "1080/playlist.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=2470000,RESOLUTION=1280x720",
  "720/index.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=1116000,RESOLUTION=854x480",
  "480/index.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=256000",
  "audio/index.m3u8",
  "",
].join("\n");

describe("hls master variant parsing", () => {
  it("lists only video renditions from the Auto master, highest first", () => {
    const variants = parseHlsMasterVariants(MASTER, "https://cdn.example/hls/master.m3u8");
    expect(variants.map((variant) => variant.height)).toEqual([1080, 720, 480]);
    expect(variants[0]?.bandwidth).toBe(5_120_000);
    expect(variants[0]?.codecs).toContain("avc1");
  });

  it("resolves relative variant URIs against the unwrapped CDN base and keeps absolute ones", () => {
    const variants = parseHlsMasterVariants(MASTER, "https://cdn.example/hls/master.m3u8");
    expect(variants[0]?.url).toBe("https://cdn.example/hls/1080/playlist.m3u8");
    expect(variants[1]?.url).toBe("https://cdn.example/hls/720/index.m3u8");

    const absolute = parseHlsMasterVariants('#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\nhttps://other.example/v/720.m3u8', "https://cdn.example/master.m3u8");
    expect(absolute[0]?.url).toBe("https://other.example/v/720.m3u8");
  });

  it("skips audio-only renditions, malformed entries, and empty playlists", () => {
    expect(parseHlsMasterVariants("#EXTM3U\n", "https://cdn.example/m.m3u8")).toEqual([]);
    expect(parseHlsMasterVariants("#EXT-X-STREAM-INF:BANDWIDTH=abc,RESOLUTION=1280x720\n720.m3u8", "https://cdn.example/")).toEqual([]);
  });

  it("deduplicates identical renditions keeping the higher bandwidth", () => {
    const duplicated = '#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\na.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2600000,RESOLUTION=1280x720\nb.m3u8';
    const variants = parseHlsMasterVariants(duplicated, "https://cdn.example/");
    expect(variants).toHaveLength(1);
    expect(variants[0]?.bandwidth).toBe(2_600_000);
  });

  it("unwraps the real CDN URL out of proxied playback URLs", () => {
    const proxied = "https://api.example.com/api/v1/proxy?url=https%3A%2F%2Fcdn.example%2Fmaster.m3u8&rn=123";
    expect(originalStreamUrl(proxied)).toBe("https://cdn.example/master.m3u8");
    expect(originalStreamUrl("https://cdn.example/master.m3u8")).toBe("https://cdn.example/master.m3u8");
  });

  it("resolveVariantUrl resolves against the base directory and rejects garbage without throwing", () => {
    expect(resolveVariantUrl("rel.m3u8", "https://cdn.example/a/b/master.m3u8")).toBe("https://cdn.example/a/b/rel.m3u8");
    expect(resolveVariantUrl("https://[::z", "https://cdn.example/master.m3u8")).toBeNull();
  });
});

describe("hls quality option building", () => {
  const source = { url: "https://api.example.com/api/v1/proxy?url=https%3A%2F%2Fcdn.example%2Fmaster.m3u8", quality: "Auto", type: "hls" } as any;

  it("exposes Auto (remount the master) plus one option per real rendition", () => {
    const variants = parseHlsMasterVariants(MASTER, "https://cdn.example/master.m3u8");
    const options = buildHlsQualityOptions(source, variants, { proxied: false });
    expect(options.map((option) => option.label)).toEqual(["Auto", "1080p", "720p", "480p"]);
    expect(options[0]?.source?.quality).toBe("Auto");
    expect(options[1]?.source?.quality).toBe("1080p");
    expect(options[1]?.source?.url).toBe("https://cdn.example/1080/playlist.m3u8");
    expect(options[1]?.source?.type).toBe("hls");
  });

  it("re-wraps variant URLs through the proxy when playback is proxied", () => {
    const variants = parseHlsMasterVariants(MASTER, "https://cdn.example/master.m3u8");
    const options = buildHlsQualityOptions(source, variants, { proxied: true });
    expect(options[1]?.source?.url).toContain("/api/v1/proxy?");
    expect(options[1]?.source?.url).toContain(encodeURIComponent("https://cdn.example/1080/playlist.m3u8"));
  });

  it("stays silent for single-variant masters so fallbacks take over", () => {
    const variants = parseHlsMasterVariants('#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\n720.m3u8', "https://cdn.example/");
    expect(buildHlsQualityOptions(source, variants, { proxied: false })).toEqual([]);
  });
});

describe("dash representation parsing", () => {
  const MPD = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">',
    '  <Period>',
    '    <AdaptationSet contentType="video">',
    '      <Representation id="1" bandwidth="5100000" width="1920" height="1080" codecs="avc1.640028" />',
    '      <Representation id="2" bandwidth="2700000" width="1280" height="720" codecs="avc1.64001f" />',
    '      <Representation id="3" bandwidth="1250000" width="854" height="480" codecs="avc1.4d401f" />',
    '    </AdaptationSet>',
    '    <AdaptationSet contentType="audio">',
    '      <Representation id="4" bandwidth="128000" audioSamplingRate="48000" />',
    '    </AdaptationSet>',
    '  </Period>',
    '</MPD>',
  ].join("\n");

  it("lists video representations only, highest first", () => {
    const variants = parseDashRepresentations(MPD);
    expect(variants.map((variant) => variant.height)).toEqual([1080, 720, 480]);
    expect(variants[0]?.bandwidth).toBe(5_100_000);
  });

  it("builds honest bitrate caps (Auto + per-height), never URL swaps", () => {
    const options = buildDashQualityOptions({ url: "https://cdn.example/manifest.mpd", quality: "Auto" } as any, parseDashRepresentations(MPD));
    expect(options.map((option) => option.label)).toEqual(["Auto", "1080p", "720p", "480p"]);
    expect(options[0]?.maxVideoBitrate).toBeNull();
    expect(options.find((option) => option.label === "720p")?.maxVideoBitrate).toBe(2_700_000);
    expect(options.every((option) => option.isAdaptiveCap)).toBe(true);
    expect(options.every((option) => option.source === undefined)).toBe(true);
  });

  it("stays silent for single-representation manifests", () => {
    expect(buildDashQualityOptions({ url: "https://cdn.example/m.mpd" } as any, parseDashRepresentations('<Representation bandwidth="2000000" height="720" />'))).toEqual([]);
  });
});

describe("variant URL selection for downloads and refresh", () => {
  const variants = parseHlsMasterVariants(MASTER, "https://cdn.example/hls/master.m3u8");

  it("returns the exact variant URL for a chosen height, never the master's highest guess", () => {
    expect(variantUrlForHeight(variants, 1080)).toBe("https://cdn.example/hls/1080/playlist.m3u8");
    expect(variantUrlForHeight(variants, 720)).toBe("https://cdn.example/hls/720/index.m3u8");
    expect(variantUrlForHeight(variants, 480)).toBe("https://cdn.example/hls/480/index.m3u8");
  });

  it("returns null for unknown, non-positive, or non-finite heights so callers keep the max-guess fallback", () => {
    expect(variantUrlForHeight(variants, 2160)).toBeNull();
    expect(variantUrlForHeight(variants, 0)).toBeNull();
    expect(variantUrlForHeight(variants, -720)).toBeNull();
    expect(variantUrlForHeight(variants, Number.NaN)).toBeNull();
    expect(variantUrlForHeight([], 720)).toBeNull();
  });

  it("skips variants without a usable URL", () => {
    expect(variantUrlForHeight([{ height: 720, bandwidth: 1_000_000, url: "" }], 720)).toBeNull();
  });

  it("resolves quality labels to variant URLs and maps Auto to the master (null)", () => {
    expect(variantUrlForQuality(variants, "1080p")).toBe("https://cdn.example/hls/1080/playlist.m3u8");
    expect(variantUrlForQuality(variants, "720P")).toBe("https://cdn.example/hls/720/index.m3u8");
    expect(variantUrlForQuality(variants, "auto")).toBeNull();
    expect(variantUrlForQuality(variants, "Auto")).toBeNull();
    expect(variantUrlForQuality(variants, "highest")).toBeNull();
    expect(variantUrlForQuality(variants, null)).toBeNull();
  });

  it("maps heights onto hls.js level indexes for the web level API", () => {
    const levels = [{ height: 1080 }, { height: 720 }, { height: 480 }];
    expect(hlsLevelIndexForHeight(levels, 720)).toBe(1);
    expect(hlsLevelIndexForHeight(levels, 2160)).toBe(-1);
    expect(hlsLevelIndexForHeight([], 720)).toBe(-1);
  });
});

describe("variant token-expiry guard wiring", () => {
  // hasExpiredEmbeddedToken reads 14-digit `20…` stamps embedded in the URL.
  const expiredVariant = "https://cdn.example/v/1080/index.m3u8?token=20200101000000";
  const freshStamp = (() => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${future.getUTCFullYear()}${pad(future.getUTCMonth() + 1)}${pad(future.getUTCDate())}${pad(future.getUTCHours())}${pad(future.getUTCMinutes())}${pad(future.getUTCSeconds())}`;
  })();
  const freshVariant = `https://cdn.example/v/1080/index.m3u8?token=${freshStamp}`;

  it("refreshes the master once when a variant URL 403s with a rotted embedded token", () => {
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "ERROR_CODE_IO_BAD_HTTP_STATUS 403", variantUrl: expiredVariant, refreshedAlready: false })).toBe(true);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "forbidden", variantUrl: expiredVariant, refreshedAlready: false })).toBe(true);
  });

  it("never loops and never refreshes for healthy URLs or unrelated errors", () => {
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "ERROR_CODE_IO_BAD_HTTP_STATUS 403", variantUrl: expiredVariant, refreshedAlready: true })).toBe(false);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "ERROR_CODE_IO_NETWORK_ERROR timeout", variantUrl: expiredVariant, refreshedAlready: false })).toBe(false);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "ERROR_CODE_IO_BAD_HTTP_STATUS 403", variantUrl: freshVariant, refreshedAlready: false })).toBe(false);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "403", variantUrl: null, refreshedAlready: false })).toBe(false);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: null, variantUrl: expiredVariant, refreshedAlready: false })).toBe(false);
  });
});

describe("variants cache key and invalidation", () => {
  const scope = { masterUrl: "https://cdn.example/master.m3u8", providerId: "momo:sub:0", episode: 3, refreshNonce: 0 };

  it("keys the cache per master playback URL", () => {
    expect(hlsVariantsCacheKey("https://cdn.example/master.m3u8")).toBe("https://cdn.example/master.m3u8");
    expect(hlsVariantsCacheKey(null)).toBeNull();
    expect(hlsVariantsCacheKey(undefined)).toBeNull();
    expect(hlsVariantsCacheKey("")).toBeNull();
  });

  it("keeps the held menu on a settings open (scope unchanged → no refetch)", () => {
    expect(shouldRefetchVariants(scope, { ...scope })).toBe(false);
  });

  it("refetches when the master, provider, episode, or refresh nonce rotates", () => {
    expect(shouldRefetchVariants(null, scope)).toBe(true);
    expect(shouldRefetchVariants(scope, { ...scope, masterUrl: "https://cdn.example/other.m3u8" })).toBe(true);
    expect(shouldRefetchVariants(scope, { ...scope, providerId: "niko:sub:0" })).toBe(true);
    expect(shouldRefetchVariants(scope, { ...scope, episode: 4 })).toBe(true);
    expect(shouldRefetchVariants(scope, { ...scope, refreshNonce: 1 })).toBe(true);
  });

  it("never fetches without a master URL", () => {
    expect(shouldRefetchVariants(scope, { ...scope, masterUrl: null })).toBe(false);
  });
});

describe("variant-URL-for-download selection", () => {
  const variants: HlsVariant[] = [
    { height: 1080, bandwidth: 5_120_000, url: "https://cdn.example/hls/1080/playlist.m3u8" },
    { height: 720, bandwidth: 2_470_000, url: "https://cdn.example/hls/720/index.m3u8" },
    { height: 480, bandwidth: 1_116_000, url: "https://cdn.example/hls/480/index.m3u8" },
  ];

  it("selects the exact variant for the chosen height, not the master's highest", () => {
    expect(variantUrlForHeight(variants, 720)).toBe("https://cdn.example/hls/720/index.m3u8");
    expect(variantUrlForHeight(variants, 480)).toBe("https://cdn.example/hls/480/index.m3u8");
  });

  it("rounds non-integer heights via Math.round to the nearest matching variant", () => {
    expect(variantUrlForHeight(variants, 720.4)).toBe("https://cdn.example/hls/720/index.m3u8");
    expect(variantUrlForHeight(variants, 721.6)).toBeNull();
  });

  it("resolves quality labels to variant URLs for download wiring", () => {
    expect(variantUrlForQuality(variants, "1080p")).toBe("https://cdn.example/hls/1080/playlist.m3u8");
    expect(variantUrlForQuality(variants, "720p")).toBe("https://cdn.example/hls/720/index.m3u8");
    expect(variantUrlForQuality(variants, "480P")).toBe("https://cdn.example/hls/480/index.m3u8");
  });

  it("maps Auto / null / unknown labels to master (null) so download skips variant URL", () => {
    expect(variantUrlForQuality(variants, "auto")).toBeNull();
    expect(variantUrlForQuality(variants, "highest")).toBeNull();
    expect(variantUrlForQuality(variants, null)).toBeNull();
    expect(variantUrlForQuality(variants, "")).toBeNull();
  });
});

describe("token-expiry detection wiring", () => {
  const expiredUrl = "https://cdn.example/v/1080/playlist.m3u8?token=20200101000000";
  const freshStamp = (() => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (v: number) => String(v).padStart(2, "0");
    return `${future.getUTCFullYear()}${pad(future.getUTCMonth() + 1)}${pad(future.getUTCDate())}${pad(future.getUTCHours())}${pad(future.getUTCMinutes())}${pad(future.getUTCSeconds())}`;
  })();
  const freshUrl = `https://cdn.example/v/1080/playlist.m3u8?token=${freshStamp}`;

  it("triggers refresh on 403 + expired token + first attempt", () => {
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "BAD_HTTP_STATUS 403", variantUrl: expiredUrl, refreshedAlready: false })).toBe(true);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "forbidden", variantUrl: expiredUrl, refreshedAlready: false })).toBe(true);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "UNAUTHORIZED", variantUrl: expiredUrl, refreshedAlready: false })).toBe(true);
  });

  it("skips refresh when already attempted (single-refresh flag)", () => {
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "403", variantUrl: expiredUrl, refreshedAlready: true })).toBe(false);
  });

  it("skips refresh for non-HTTP errors even with expired token", () => {
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "NETWORK_ERROR timeout", variantUrl: expiredUrl, refreshedAlready: false })).toBe(false);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "SOURCE_NOT_FOUND", variantUrl: expiredUrl, refreshedAlready: false })).toBe(false);
  });

  it("allows refresh on any HTTP-status error with expired token (BAD_HTTP_STATUS is broad)", () => {
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "BAD_HTTP_STATUS 500", variantUrl: expiredUrl, refreshedAlready: false })).toBe(true);
  });

  it("skips refresh for fresh tokens even on 403", () => {
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "403", variantUrl: freshUrl, refreshedAlready: false })).toBe(false);
  });

  it("skips refresh when variantUrl is missing", () => {
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "403", variantUrl: null, refreshedAlready: false })).toBe(false);
    expect(shouldRefreshMasterOnVariantError({ errorDetail: "403", variantUrl: "", refreshedAlready: false })).toBe(false);
  });
});

describe("cache key invalidation logic", () => {
  const base: VariantsCacheScope = { masterUrl: "https://cdn.example/master.m3u8", providerId: "momo:sub:0", episode: 3, refreshNonce: 0 };

  it("does not refetch when only irrelevant fields change (e.g. settings opened)", () => {
    expect(shouldRefetchVariants(base, { ...base })).toBe(false);
    expect(shouldRefetchVariants(base, { masterUrl: base.masterUrl, providerId: base.providerId, episode: base.episode, refreshNonce: base.refreshNonce })).toBe(false);
  });

  it("refetches on provider switch", () => {
    expect(shouldRefetchVariants(base, { ...base, providerId: "niko:sub:0" })).toBe(true);
  });

  it("refetches on episode change", () => {
    expect(shouldRefetchVariants(base, { ...base, episode: 5 })).toBe(true);
  });

  it("refetches on manual refresh", () => {
    expect(shouldRefetchVariants(base, { ...base, refreshNonce: 1 })).toBe(true);
  });

  it("refetches on master URL change (server switch)", () => {
    expect(shouldRefetchVariants(base, { ...base, masterUrl: "https://cdn2.example/master.m3u8" })).toBe(true);
  });

  it("returns false when next masterUrl is null (no source)", () => {
    expect(shouldRefetchVariants(base, { ...base, masterUrl: null })).toBe(false);
  });

  it("always refetches from null previous scope", () => {
    expect(shouldRefetchVariants(null, base)).toBe(true);
  });
});
