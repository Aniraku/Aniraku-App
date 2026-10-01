import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert: async () => ({}) }),
  },
}));

import {
  anilistToListStatus,
  deriveStatusAfterWatch,
  LIST_STATUS_LABELS,
  listStatusToAnilist,
  listStatusToMal,
  malToListStatus,
  normalizeListStatus,
  statusForNewBookmark,
} from "@/lib/list-status";
import {
  describeExport,
  describeImport,
  describeStatusBreakdown,
  exportPaceDelayMs,
  isRateLimitError,
  parseRetryAfterMs,
} from "@/lib/provider-sync";

describe("Miruro library transfer port", () => {
  it("normalizes list statuses like Miruro listStatus.ts", () => {
    expect(normalizeListStatus("watching")).toBe("CURRENT");
    expect(normalizeListStatus("COMPLETED")).toBe("COMPLETED");
    expect(normalizeListStatus("unknown")).toBeNull();
    expect(malToListStatus("on_hold")).toBe("PAUSED");
    expect(malToListStatus("plan_to_watch")).toBe("PLANNING");
    expect(anilistToListStatus("REPEATING")).toBe("REPEATING");
    expect(listStatusToAnilist("CURRENT")).toBe("CURRENT");
    expect(listStatusToMal("REPEATING")).toBe("watching");
    expect(listStatusToMal("PLANNING")).toBe("plan_to_watch");
    expect(LIST_STATUS_LABELS.CURRENT).toBe("Watching");
    expect(statusForNewBookmark()).toBe("PLANNING");
  });

  it("never auto-derives DROPPED / PAUSED and requires a known total for COMPLETED", () => {
    expect(deriveStatusAfterWatch({ previous: "DROPPED", watchedCount: 99, total: 12 })).toBe(
      "DROPPED",
    );
    expect(deriveStatusAfterWatch({ previous: "PAUSED", watchedCount: 99, total: 12 })).toBe(
      "PAUSED",
    );
    expect(deriveStatusAfterWatch({ previous: null, watchedCount: 12, total: 12 })).toBe(
      "COMPLETED",
    );
    expect(deriveStatusAfterWatch({ previous: null, watchedCount: 5, total: 0 })).toBe("CURRENT");
    expect(deriveStatusAfterWatch({ previous: "COMPLETED", watchedCount: 1, total: 0 })).toBe(
      "REPEATING",
    );
  });

  it("describes imports with statuses, scores, and limited continuations", () => {
    expect(
      describeImport({
        imported: 3,
        already: 2,
        episodes: 5,
        scores: 1,
        unmapped: 1,
        statuses: { CURRENT: 2, PLANNING: 1 },
        statuses_updated: 4,
        limited: true,
      }),
    ).toBe(
      "3 imported · 2 already in your library · 5 episodes of progress · 1 scores · 1 had no Aniraku match · 2 Watching · 1 Plan to Watch · 4 statuses refreshed · more episodes remain — import again to continue",
    );
    expect(describeImport({})).toBe("Nothing new to import");
    expect(describeImport({ error: "Import failed" })).toBe("Import failed");
  });

  it("describes exports as exact-match skips with status breakdown", () => {
    expect(
      describeExport({
        exported: 5,
        scores: 2,
        skipped: 3,
        failed: 1,
        statuses: { COMPLETED: 4 },
        limited: true,
      }),
    ).toBe(
      "5 titles updated · 2 scores · 3 already up to date · 1 failed · 4 Completed · more titles remain — export again to continue",
    );
    expect(describeExport({})).toBe("Nothing to export");
    expect(describeStatusBreakdown({ CURRENT: 2, BOGUS: 9 })).toBe("2 Watching");
    expect(describeStatusBreakdown(null)).toBe("");
  });

  it("detects provider throttling and parses Retry-After", () => {
    expect(isRateLimitError("429 Too Many Requests")).toBe(true);
    expect(isRateLimitError("AniList is rate-limiting requests")).toBe(true);
    expect(isRateLimitError("Export failed")).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(parseRetryAfterMs("120")).toBe(120000);
    expect(parseRetryAfterMs(null)).toBeNull();
  });

  it("paces export chunks at 10 batched req/min with 6s floor", () => {
    expect(exportPaceDelayMs(0)).toBe(6000);
    expect(exportPaceDelayMs(3)).toBe(6000);
    expect(exportPaceDelayMs(30)).toBe(60000);
    expect(exportPaceDelayMs(60)).toBe(120000);
    expect(exportPaceDelayMs(1000)).toBe(120000);
  });
});
