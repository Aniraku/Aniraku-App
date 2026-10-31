import { describe, expect, it } from "vitest";
import { estimateHlsSize, parseMediaPlaylist, resolveSegmentUrl, rewritePlaylistUris, verifyPlaylistIntegrity } from "@/lib/downloads-hls";

const CLEAR_PLAYLIST = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:6",
  "#EXTINF:6.0,",
  "seg-0001.ts",
  "#EXTINF:6.0,",
  "seg-0002.ts",
  "#EXTINF:4.5,",
  "seg-0003.ts",
  "#EXT-X-ENDLIST",
].join("\n");

const AES_PLAYLIST = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  '#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/key.bin",IV=0x1',
  "#EXTINF:6.0,",
  "seg-0001.ts",
  "#EXTINF:6.0,",
  "https://cdn.example.com/seg-0002.ts",
  "#EXT-X-ENDLIST",
].join("\n");

const LIVE_PLAYLIST = CLEAR_PLAYLIST.replace("#EXT-X-ENDLIST", "");

describe("parseMediaPlaylist", () => {
  it("reads segments, durations, key, and VOD marker", () => {
    const parsed = parseMediaPlaylist(AES_PLAYLIST);
    expect(parsed?.segments).toEqual([
      { uri: "seg-0001.ts", duration: 6 },
      { uri: "https://cdn.example.com/seg-0002.ts", duration: 6 },
    ]);
    expect(parsed?.keyUri).toBe("https://cdn.example.com/key.bin");
    expect(parsed?.endList).toBe(true);
  });

  it("rejects a playlist whose EXTINF never got its URI", () => {
    expect(parseMediaPlaylist("#EXTM3U\n#EXTINF:6.0,\n#EXT-X-ENDLIST")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(parseMediaPlaylist("")).toBeNull();
  });
});

describe("resolveSegmentUrl", () => {
  const base = "https://cdn.example.com/v/ep1/playlist.m3u8";

  it("resolves relative segment paths to absolute https URLs", () => {
    expect(resolveSegmentUrl("seg-0001.ts", base)).toBe("https://cdn.example.com/v/ep1/seg-0001.ts");
    expect(resolveSegmentUrl("../keys/k.bin", base)).toBe("https://cdn.example.com/v/keys/k.bin");
  });

  it("keeps absolute https URLs", () => {
    expect(resolveSegmentUrl("https://other.example.net/s.ts", base)).toBe("https://other.example.net/s.ts");
  });

  it("rejects non-https schemes, credentials, and junk", () => {
    expect(resolveSegmentUrl("http://cdn.example.com/s.ts", base)).toBeNull();
    expect(resolveSegmentUrl("file:///etc/passwd", base)).toBeNull();
    expect(resolveSegmentUrl("https://u:p@cdn.example.com/s.ts", base)).toBeNull();
    expect(resolveSegmentUrl("javascript:alert(1)", base)).toBeNull();
    expect(resolveSegmentUrl("  ", base)).toBeNull();
  });
});

describe("estimateHlsSize", () => {
  it("sums EXTINF durations against the variant bandwidth", () => {
    // 16.5 s at 2_000_000 bps = 4_125_000 B, +2% overhead.
    expect(estimateHlsSize(CLEAR_PLAYLIST, 2_000_000)).toBe(Math.round(16.5 * 2_000_000 / 8 * 1.02));
  });

  it("returns null for unknown bandwidth or empty playlists", () => {
    expect(estimateHlsSize(CLEAR_PLAYLIST, 0)).toBeNull();
    expect(estimateHlsSize("", 2_000_000)).toBeNull();
  });
});

describe("rewritePlaylistUris", () => {
  const input = {
    baseUrl: "https://cdn.example.com/v/ep1/playlist.m3u8",
    mapUri: (url: string) => (url.endsWith("key.bin") ? "file:///d/key.bin" : `file:///d/${url.split("/").pop()}`),
  };

  it("maps segments and the AES key to local file URIs", () => {
    const rewritten = rewritePlaylistUris(AES_PLAYLIST, input);
    expect(rewritten).toContain('URI="file:///d/key.bin"');
    expect(rewritten).toContain("file:///d/seg-0001.ts");
    expect(rewritten).toContain("file:///d/seg-0002.ts");
    expect(rewritten).not.toContain("https://");
  });

  it("keeps the key's IV and other attributes while swapping the URI", () => {
    const rewritten = rewritePlaylistUris(AES_PLAYLIST, input);
    expect(rewritten).toContain("IV=0x1");
    expect(rewritten).toContain("METHOD=AES-128");
  });

  it("fails the whole rewrite when one segment is missing locally", () => {
    expect(rewritePlaylistUris(CLEAR_PLAYLIST, {
      baseUrl: "https://cdn.example.com/v/ep1/playlist.m3u8",
      mapUri: (url) => (url.includes("seg-0002") ? null : "file:///d/x.ts"),
    })).toBeNull();
  });

  it("fails when the key did not download", () => {
    expect(rewritePlaylistUris(AES_PLAYLIST, {
      baseUrl: "https://cdn.example.com/v/ep1/playlist.m3u8",
      mapUri: (url) => (url.endsWith("key.bin") ? null : "file:///d/x.ts"),
    })).toBeNull();
  });
});

describe("verifyPlaylistIntegrity", () => {
  const rewritten = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXTINF:6.0,",
    "file:///d/seg-0001.ts",
    "#EXTINF:6.0,",
    "file:///d/seg-0002.ts",
    "#EXT-X-ENDLIST",
  ].join("\n");

  it("accepts a complete local VOD bundle", () => {
    expect(verifyPlaylistIntegrity(rewritten, () => true)).toBe(true);
  });

  it("rejects a missing segment file", () => {
    expect(verifyPlaylistIntegrity(rewritten, (uri) => !uri.includes("seg-0002"))).toBe(false);
  });

  it("rejects live playlists and leftover remote URIs", () => {
    expect(verifyPlaylistIntegrity(LIVE_PLAYLIST.replace("seg-0001.ts", "file:///d/seg-0001.ts"), () => true)).toBe(false);
    expect(verifyPlaylistIntegrity(rewritten.replace("file:///d/seg-0001.ts", "https://cdn.example.com/s.ts"), () => true)).toBe(false);
  });

  it("accepts a rewritten AES bundle with its local key file", () => {
    const rewrittenAes = rewritePlaylistUris(AES_PLAYLIST, {
      baseUrl: "https://cdn.example.com/v/ep1/playlist.m3u8",
      mapUri: (url) => (url.endsWith("key.bin") ? "file:///d/key.bin" : `file:///d/${url.split("/").pop()}`),
    })!;
    expect(verifyPlaylistIntegrity(rewrittenAes, () => true)).toBe(true);
  });

  it("rejects an AES bundle whose key file is missing or still remote", () => {
    const rewrittenAes = rewritePlaylistUris(AES_PLAYLIST, {
      baseUrl: "https://cdn.example.com/v/ep1/playlist.m3u8",
      mapUri: (url) => (url.endsWith("key.bin") ? "file:///d/key.bin" : `file:///d/${url.split("/").pop()}`),
    })!;
    expect(verifyPlaylistIntegrity(rewrittenAes, (uri) => !uri.includes("key.bin"))).toBe(false);
    expect(verifyPlaylistIntegrity(rewrittenAes.replace('URI="file:///d/key.bin"', 'URI="https://cdn.example.com/key.bin"'), () => true)).toBe(false);
  });
});
