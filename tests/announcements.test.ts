import { describe, expect, it, vi } from "vitest";
import {
  parseAnnouncements,
  selectBannerAnnouncement,
  shouldShowAnnouncement,
  sortAnnouncements,
  type Announcement,
} from "../lib/announcements";

const ann = (over: Partial<Announcement>): Announcement => ({
  id: "x",
  title: "Title",
  ...over,
});

describe("Aniraku announcement feed", () => {
  it("validates and normalizes entries, dropping malformed or inactive ones", () => {
    const parsed = parseAnnouncements({
      announcements: [
        { id: "a", title: "Active", body: ["one", 42, "two"], pinned: true, active: true },
        { id: "b", title: "Retired", active: false },
        { title: "No id" },
        "not-an-object",
        { id: "c", title: "No pin field" },
      ],
    });

    expect(parsed.map((a) => a.id)).toEqual(["a", "c"]);
    expect(parsed[0].pinned).toBe(true);
    // Non-string body members are filtered out.
    expect(parsed[0].body).toEqual(["one", "two"]);
    // Absent pinned normalizes to false, never undefined.
    expect(parsed[1].pinned).toBe(false);
  });

  it("returns an empty list for junk input instead of throwing", () => {
    expect(parseAnnouncements(null)).toEqual([]);
    expect(parseAnnouncements(undefined)).toEqual([]);
    expect(parseAnnouncements({})).toEqual([]);
    expect(parseAnnouncements({ announcements: "nope" })).toEqual([]);
  });

  it("sorts pinned first, then newest by date", () => {
    const sorted = sortAnnouncements([
      ann({ id: "old", date: "2026-01-01" }),
      ann({ id: "new", date: "2026-06-01" }),
      ann({ id: "pinned-old", date: "2025-01-01", pinned: true }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["pinned-old", "new", "old"]);
  });

  it("surfaces only the pinned announcement as the banner, else null", () => {
    expect(selectBannerAnnouncement([ann({ id: "a" })])).toBeNull();
    const banner = selectBannerAnnouncement([
      ann({ id: "a", date: "2026-01-01" }),
      ann({ id: "b", date: "2026-02-01", pinned: true }),
    ]);
    expect(banner?.id).toBe("b");
  });

  it("suppresses the banner only for the dismissed id, so a newer announcement shows again", () => {
    const current = ann({ id: "current" });
    expect(shouldShowAnnouncement({ announcement: null })).toBe(false);
    expect(shouldShowAnnouncement({ announcement: current })).toBe(true);
    expect(shouldShowAnnouncement({ announcement: current, dismissedId: "current" })).toBe(false);
    // A different (older) dismissal must not suppress a new announcement.
    expect(shouldShowAnnouncement({ announcement: current, dismissedId: "older" })).toBe(true);
  });

  it("parses a fetched payload and reports non-OK responses as errors", async () => {
    const payload = { announcements: [{ id: "a", title: "Live", pinned: true }] };

    const okFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", okFetch);
    const { fetchAnnouncements } = await import("../lib/announcements");
    const list = await fetchAnnouncements("https://example.test/announcements.json", 1000);
    expect(list.map((a) => a.id)).toEqual(["a"]);
    expect(okFetch).toHaveBeenCalledTimes(1);

    const badFetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    vi.stubGlobal("fetch", badFetch);
    await expect(fetchAnnouncements("https://example.test/announcements.json", 1000)).rejects.toThrow();

    vi.unstubAllGlobals();
  });
});
