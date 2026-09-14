import { describe, expect, it } from "vitest";
import {
  resolveResumeOnSwitch,
  isResumablePosition,
  streamCacheKey,
  resolveSkipFetchStatus,
  resolveHistoryResume,
  resolveMaxHistoryProgress,
  shouldRefreshSameProvider,
  isOfflinePlaybackSource,
  shouldApplyInitialHistoryResume,
  shouldMountReplacementSource,
} from "../lib/watch-engine";
import {
  filterExistingDownloadEntries,
  selectMaximumQualityDownload,
  selectDownloadSourceForQuality,
} from "../lib/download-policy";

// ── Track 4.1: Server-switch preserves position ──

describe("resolveResumeOnSwitch", () => {
  it("returns currentTime when both currentTime and duration are valid", () => {
    expect(resolveResumeOnSwitch(120, 1440)).toBe(120);
  });

  it("returns null when currentTime is 0 or negative", () => {
    expect(resolveResumeOnSwitch(0, 1440)).toBeNull();
    expect(resolveResumeOnSwitch(-10, 1440)).toBeNull();
  });

  it("returns null when duration is 0 or negative", () => {
    expect(resolveResumeOnSwitch(120, 0)).toBeNull();
    expect(resolveResumeOnSwitch(120, -1)).toBeNull();
  });

  it("returns null when either value is NaN or Infinity", () => {
    expect(resolveResumeOnSwitch(NaN, 1440)).toBeNull();
    expect(resolveResumeOnSwitch(120, Infinity)).toBeNull();
  });
});

describe("isResumablePosition", () => {
  it("returns true for positions above RESUME_MIN_TIME (30s)", () => {
    expect(isResumablePosition(31)).toBe(true);
    expect(isResumablePosition(300)).toBe(true);
  });

  it("returns false for positions at or below 30s", () => {
    expect(isResumablePosition(30)).toBe(false);
    expect(isResumablePosition(15)).toBe(false);
  });

  it("returns false for null, undefined, NaN, or non-finite", () => {
    expect(isResumablePosition(null)).toBe(false);
    expect(isResumablePosition(undefined)).toBe(false);
    expect(isResumablePosition(NaN)).toBe(false);
  });
});

describe("shouldApplyInitialHistoryResume", () => {
  it("returns true when there is a pending resume, source is fresh, and player is ready", () => {
    expect(shouldApplyInitialHistoryResume({
      currentTime: 0,
      hasPendingResume: true,
      isPlaying: true,
      resumeAppliedForSource: false,
      status: "playing",
    })).toBe(true);
  });

  it("returns true with readyToPlay status", () => {
    expect(shouldApplyInitialHistoryResume({
      currentTime: 0,
      hasPendingResume: true,
      isPlaying: false,
      resumeAppliedForSource: false,
      status: "readyToPlay",
    })).toBe(true);
  });

  it("returns false if already applied", () => {
    expect(shouldApplyInitialHistoryResume({
      currentTime: 0,
      hasPendingResume: true,
      isPlaying: true,
      resumeAppliedForSource: true,
    })).toBe(false);
  });

  it("returns false if no pending resume", () => {
    expect(shouldApplyInitialHistoryResume({
      currentTime: 0,
      hasPendingResume: false,
      isPlaying: true,
      resumeAppliedForSource: false,
    })).toBe(false);
  });

  it("returns false if currentTime is past 1s", () => {
    expect(shouldApplyInitialHistoryResume({
      currentTime: 5,
      hasPendingResume: true,
      isPlaying: true,
      resumeAppliedForSource: false,
    })).toBe(false);
  });
});

// ── Track 4.2: Stream cache key includes provider + lang + episode ──

describe("streamCacheKey", () => {
  it("includes provider name, id, language, and episode", () => {
    const key = streamCacheKey({ id: "p1", provider: "momo" }, 5, "sub");
    expect(key).toBe("aniraku-watch-stream:momo:p1:sub:5");
  });

  it("differentiates sub vs dub for same provider", () => {
    const subKey = streamCacheKey({ id: "p1", provider: "momo" }, 5, "sub");
    const dubKey = streamCacheKey({ id: "p1", provider: "momo" }, 5, "dub");
    expect(subKey).not.toBe(dubKey);
  });

  it("differentiates providers for same episode and lang", () => {
    const momoKey = streamCacheKey({ id: "p1", provider: "momo" }, 5, "sub");
    const nikoKey = streamCacheKey({ id: "p2", provider: "niko" }, 5, "sub");
    expect(momoKey).not.toBe(nikoKey);
  });

  it("differentiates episodes for same provider and lang", () => {
    const ep5 = streamCacheKey({ id: "p1", provider: "momo" }, 5, "sub");
    const ep6 = streamCacheKey({ id: "p1", provider: "momo" }, 6, "sub");
    expect(ep5).not.toBe(ep6);
  });

  it("falls back to defaults for missing provider fields", () => {
    const key = streamCacheKey({}, 1, "sub");
    expect(key).toBe("aniraku-watch-stream:unknown-provider:unknown-id:sub:1");
  });
});

// ── Track 4.3: AniSkip fetch status distinguishable ──

describe("resolveSkipFetchStatus", () => {
  it("returns 'cached' when fromCache is true", () => {
    expect(resolveSkipFetchStatus({ fromCache: true })).toBe("cached");
  });

  it("returns 'timeout' when timedOut is true", () => {
    expect(resolveSkipFetchStatus({ timedOut: true })).toBe("timeout");
  });

  it("returns 'error' when ok is false", () => {
    expect(resolveSkipFetchStatus({ ok: false })).toBe("error");
  });

  it("returns 'ok' when request succeeded with segments", () => {
    expect(resolveSkipFetchStatus({ ok: true, hasSegments: true })).toBe("ok");
  });

  it("returns 'empty' when request succeeded but no segments", () => {
    expect(resolveSkipFetchStatus({ ok: true, hasSegments: false })).toBe("empty");
  });
});

// ── Track 4.4: Downloads stale-index cleanup ──

describe("filterExistingDownloadEntries", () => {
  it("keeps entries whose files exist", () => {
    const entries = [{ uri: "file:///a.mp4" }, { uri: "file:///b.mp4" }];
    const result = filterExistingDownloadEntries(entries, () => true);
    expect(result.kept).toHaveLength(2);
    expect(result.removed).toHaveLength(0);
  });

  it("removes entries whose files are gone", () => {
    const entries = [{ uri: "file:///a.mp4" }, { uri: "file:///b.mp4" }];
    const result = filterExistingDownloadEntries(entries, (uri) => uri !== "file:///b.mp4");
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0].uri).toBe("file:///a.mp4");
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].uri).toBe("file:///b.mp4");
  });

  it("handles exists check throwing", () => {
    const entries = [{ uri: "file:///a.mp4" }];
    const result = filterExistingDownloadEntries(entries, () => { throw new Error("no access"); });
    expect(result.kept).toHaveLength(0);
    expect(result.removed).toHaveLength(1);
  });

  it("handles empty array", () => {
    const result = filterExistingDownloadEntries([], () => true);
    expect(result.kept).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });
});

// ── Track 4.5: History conflict — prefer max(local, server) ──

describe("resolveHistoryResume", () => {
  it("prefers the higher of local and server progress", () => {
    const result = resolveHistoryResume(
      { progress: 100, duration: 1440 },
      { progress: 200, duration: 1440 },
    );
    expect(result).toBe(200);
  });

  it("returns local when it is ahead of server", () => {
    const result = resolveHistoryResume(
      { progress: 500, duration: 1440 },
      { progress: 100, duration: 1440 },
    );
    expect(result).toBe(500);
  });

  it("returns null when best is at/near end (≥90%)", () => {
    const result = resolveHistoryResume(
      { progress: 1300, duration: 1440 },
      { progress: 1200, duration: 1440 },
    );
    expect(result).toBeNull();
  });

  it("returns null when progress is within 10s of duration", () => {
    const result = resolveHistoryResume(
      { progress: 1435, duration: 1440 },
      null,
    );
    expect(result).toBeNull();
  });

  it("returns null for both null", () => {
    expect(resolveHistoryResume(null, null)).toBeNull();
  });

  it("falls back to server when local is null", () => {
    const result = resolveHistoryResume(null, { progress: 200, duration: 1440 });
    expect(result).toBe(200);
  });

  it("returns null when progress is below RESUME_MIN_TIME", () => {
    const result = resolveHistoryResume({ progress: 10, duration: 1440 }, null);
    expect(result).toBeNull();
  });
});

describe("resolveMaxHistoryProgress", () => {
  it("returns max of local and server", () => {
    expect(resolveMaxHistoryProgress(100, 200)).toBe(200);
    expect(resolveMaxHistoryProgress(300, 200)).toBe(300);
  });

  it("returns the non-NaN value when one is NaN", () => {
    expect(resolveMaxHistoryProgress(NaN, 200)).toBe(200);
    expect(resolveMaxHistoryProgress(100, NaN)).toBe(100);
  });

  it("returns 0 when both are NaN", () => {
    expect(resolveMaxHistoryProgress(NaN, NaN)).toBe(0);
  });
});

// ── Track 4.7: Retry honesty ──

describe("shouldRefreshSameProvider", () => {
  it("returns true when refresh has NOT been attempted yet", () => {
    expect(shouldRefreshSameProvider("player", false)).toBe(true);
    expect(shouldRefreshSameProvider("stream", false)).toBe(true);
    expect(shouldRefreshSameProvider("startup", false)).toBe(true);
  });

  it("returns false when refresh was already attempted", () => {
    expect(shouldRefreshSameProvider("player", true)).toBe(false);
    expect(shouldRefreshSameProvider("stream", true)).toBe(false);
  });

  it("returns false for permanent reason regardless", () => {
    expect(shouldRefreshSameProvider("permanent", false)).toBe(false);
    expect(shouldRefreshSameProvider("permanent", true)).toBe(false);
  });
});

// ── Track 4.6: Offline playback ──

describe("isOfflinePlaybackSource", () => {
  it("detects file:// URIs", () => {
    expect(isOfflinePlaybackSource({ url: "file:///storage/emulated/0/video.mp4" })).toBe(true);
  });

  it("detects content:// URIs", () => {
    expect(isOfflinePlaybackSource({ url: "content://media/123" })).toBe(true);
  });

  it("detects SAVED quality marker", () => {
    expect(isOfflinePlaybackSource({ url: "https://example.com/v.mp4", quality: "1080p · SAVED" })).toBe(true);
  });

  it("returns false for normal HTTPS URLs", () => {
    expect(isOfflinePlaybackSource({ url: "https://cdn.example/video.m3u8", quality: "Auto" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isOfflinePlaybackSource(null)).toBe(false);
  });
});

// ── Integration: download policy + stale cleanup round-trip ──

describe("download stale-index integration", () => {
  it("pruneStaleDownloads logic drops only missing files", () => {
    const entries = [
      { uri: "file:///existing.mp4", id: "a" },
      { uri: "file:///deleted.mp4", id: "b" },
      { uri: "file:///also-gone.mp4", id: "c" },
    ];
    const existsMap = new Set(["file:///existing.mp4"]);
    const result = filterExistingDownloadEntries(entries, (uri) => existsMap.has(uri));
    expect(result.kept).toHaveLength(1);
    expect(result.removed).toHaveLength(2);
  });
});
