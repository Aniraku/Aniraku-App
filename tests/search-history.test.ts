import { describe, expect, it } from "vitest";
import { entriesWithoutTerm, nextEntriesAfterSearch, pruneOldEntries, relativeTime, upgradeLegacyEntries, type SearchHistoryEntry } from "@/lib/search-history";

const DAY = 24 * 60 * 60 * 1000;

describe("search-history", () => {
  it("formats relative ages", () => {
    const now = Date.now();
    expect(relativeTime(now - 10_000)).toBe("Just now");
    expect(relativeTime(now - 5 * 60_000)).toBe("5m ago");
    expect(relativeTime(now - 3 * 3_600_000)).toBe("3h ago");
    expect(relativeTime(now - 2 * DAY)).toBe("2d ago");
  });

  it("prunes entries older than 30 days", () => {
    const entries: SearchHistoryEntry[] = [
      { term: "fresh", timestamp: Date.now() },
      { term: "stale", timestamp: Date.now() - 31 * DAY },
      { term: "edge", timestamp: Date.now() - 29 * DAY },
    ];
    const pruned = pruneOldEntries(entries);
    expect(pruned.map((e) => e.term)).toEqual(["fresh", "edge"]);
  });

  it("upgrades legacy string entries and drops junk", () => {
    const upgraded = upgradeLegacyEntries(["cowboy bebop", { term: "dandadan", timestamp: 42 }, 7, null]);
    expect(upgraded).toHaveLength(2);
    expect(upgraded[0]?.term).toBe("cowboy bebop");
    expect(upgraded[1]).toEqual({ term: "dandadan", timestamp: 42 });
  });

  it("records deduped, newest-first, capped at 6", () => {
    let entries: SearchHistoryEntry[] = ["a", "b", "c", "d", "e", "f"].map((term, i) => ({ term, timestamp: i }));
    entries = nextEntriesAfterSearch(entries, "g");
    expect(entries).toHaveLength(6);
    expect(entries[0]?.term).toBe("g");
    entries = nextEntriesAfterSearch(entries, "a");
    expect(entries[0]?.term).toBe("a");
    expect(entries.filter((e) => e.term === "a")).toHaveLength(1);
  });

  it("removes a term case-insensitively", () => {
    const entries: SearchHistoryEntry[] = [{ term: "Frieren", timestamp: 1 }, { term: "ascendance", timestamp: 2 }];
    expect(entriesWithoutTerm(entries, "frieren").map((e) => e.term)).toEqual(["ascendance"]);
  });
});
