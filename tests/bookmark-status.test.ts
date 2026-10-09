import { describe, expect, it } from "vitest";
import { bookmarkDisplayStatus, filterByListStatus, statusCounts } from "@/lib/bookmark-status";
import { isMissingStatusColumnError } from "@/lib/list-status";

describe("bookmarkDisplayStatus", () => {
  it("prefers the stored status regardless of watch history", () => {
    expect(bookmarkDisplayStatus({ anime_id: 1, status: "PAUSED" }, true)).toBe("PAUSED");
    expect(bookmarkDisplayStatus({ anime_id: 1, status: "DROPPED" }, false)).toBe("DROPPED");
    expect(bookmarkDisplayStatus({ anime_id: 1, status: "PLANNING" }, true)).toBe("PLANNING");
    // Canonical "CURRENT" must survive normalization (regression: the old
    // legacy-only lookup map null'd stored CURRENT rows out).
    expect(bookmarkDisplayStatus({ anime_id: 1, status: "CURRENT" }, false)).toBe("CURRENT");
  });

  it("normalizes legacy lowercase values", () => {
    expect(bookmarkDisplayStatus({ anime_id: 1, status: "watching" }, false)).toBe("CURRENT");
    expect(bookmarkDisplayStatus({ anime_id: 1, status: "Completed" }, false)).toBe("COMPLETED");
    expect(bookmarkDisplayStatus({ anime_id: 1, status: "repeating" }, false)).toBe("REPEATING");
  });

  it("derives CURRENT for legacy rows with history, PLANNING without", () => {
    expect(bookmarkDisplayStatus({ anime_id: 1, status: null }, true)).toBe("CURRENT");
    expect(bookmarkDisplayStatus({ anime_id: 1, status: null }, false)).toBe("PLANNING");
    expect(bookmarkDisplayStatus(undefined, false)).toBe("PLANNING");
    expect(bookmarkDisplayStatus(null, true)).toBe("CURRENT");
  });

  it("never derives explicit-only statuses (PAUSED / DROPPED)", () => {
    expect(bookmarkDisplayStatus({ anime_id: 1 }, true)).toBe("CURRENT");
    expect(bookmarkDisplayStatus({ anime_id: 1 }, false)).toBe("PLANNING");
  });

  it("falls back on unrecognized status strings", () => {
    expect(bookmarkDisplayStatus({ anime_id: 1, status: "banana" }, true)).toBe("CURRENT");
    expect(bookmarkDisplayStatus({ anime_id: 1, status: 42 }, false)).toBe("PLANNING");
  });
});

describe("statusCounts", () => {
  const watched = new Set([3]);
  const rows = [
    { anime_id: 1, status: "CURRENT" },
    { anime_id: 2, status: "CURRENT" },
    { anime_id: 3, status: null },
    { anime_id: 4, status: null },
    { anime_id: 5, status: "DROPPED" },
    { anime_id: 6 },
    { anime_id: 7, status: "COMPLETED" },
  ];

  it("counts stored statuses and derived fallbacks together", () => {
    expect(statusCounts(rows, watched)).toEqual({
      CURRENT: 3, // two stored + legacy row 3 (has history)
      PLANNING: 2, // legacy rows 4 and 6 with no history
      COMPLETED: 1,
      PAUSED: 0,
      DROPPED: 1,
      REPEATING: 0,
    });
  });

  it("returns an empty breakdown for an empty list", () => {
    expect(statusCounts([], new Set())).toEqual({
      CURRENT: 0, PLANNING: 0, COMPLETED: 0, PAUSED: 0, DROPPED: 0, REPEATING: 0,
    });
  });
});

describe("filterByListStatus", () => {
  const watched = new Set([2]);
  const rows = [
    { anime_id: 1, status: "PLANNING" },
    { anime_id: 2, status: null },
    { anime_id: 3, status: "PAUSED" },
    { anime_id: 4, status: "DROPPED" },
  ];

  it("passes everything through for ALL", () => {
    expect(filterByListStatus(rows, watched, "ALL")).toBe(rows);
  });

  it("keeps only rows matching the filter", () => {
    expect(filterByListStatus(rows, watched, "CURRENT").map((row) => row.anime_id)).toEqual([2]);
    expect(filterByListStatus(rows, watched, "PAUSED").map((row) => row.anime_id)).toEqual([3]);
    expect(filterByListStatus(rows, watched, "PLANNING").map((row) => row.anime_id)).toEqual([1]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterByListStatus(rows, watched, "REPEATING")).toEqual([]);
  });
});

describe("isMissingStatusColumnError", () => {
  it("recognizes postgres and PostgREST missing-column shapes", () => {
    expect(isMissingStatusColumnError({ code: "42703" })).toBe(true);
    expect(isMissingStatusColumnError({ code: "PGRST204" })).toBe(true);
    expect(isMissingStatusColumnError({ message: 'column "status" of relation "bookmarks" does not exist' })).toBe(true);
    expect(isMissingStatusColumnError({ message: "Could not find the 'status' column of 'bookmarks' in the schema cache" })).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isMissingStatusColumnError({ code: "XX000", message: "internal error" })).toBe(false);
    expect(isMissingStatusColumnError(new Error("network"))).toBe(false);
    expect(isMissingStatusColumnError(null)).toBe(false);
    expect(isMissingStatusColumnError(undefined)).toBe(false);
  });
});
