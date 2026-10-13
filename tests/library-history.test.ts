import { describe, expect, it } from "vitest";
import {
  countWatchedEpisodes,
  groupLatestByAnime,
  rowRecencyMs,
  savedEpisodeMeta,
} from "@/lib/library-history";

const row = (
  animeId: number,
  episode: number,
  extra: { progress?: number; duration?: number; timestamp?: number | null; updated_at?: string | null } = {},
) => ({
  anime_id: animeId,
  episode_number: episode,
  progress: extra.progress ?? 1440,
  duration: extra.duration ?? 1440,
  timestamp: extra.timestamp ?? null,
  updated_at: extra.updated_at ?? null,
});

describe("library history presentation", () => {
  it("prefers the watch timestamp over updated_at (import backdates timestamp, updated_at is import time)", () => {
    expect(rowRecencyMs({ timestamp: 1791853329510, updated_at: "2026-10-13T09:02:28Z" })).toBe(
      1791853329510,
    );
    // No timestamp → updated_at fallback; neither → unknown.
    expect(rowRecencyMs({ updated_at: "2026-01-02T00:00:00.000Z" })).toBe(
      Date.parse("2026-01-02T00:00:00.000Z"),
    );
    expect(Number.isNaN(rowRecencyMs({}))).toBe(true);
  });

  it("groups to one row per title, newest watch first", () => {
    const rows = [
      row(7, 12, { timestamp: 500 }), // import batch, backdated
      row(9, 1, { timestamp: 900 }), // genuine recent watch
      row(7, 11, { timestamp: 400 }),
      row(9, 2, { timestamp: 800 }),
      row(11, 1, { timestamp: 600 }),
    ];
    const grouped = groupLatestByAnime(rows);
    expect(grouped.map((r) => [r.anime_id, r.episode_number])).toEqual([
      [9, 1],
      [11, 1],
      [7, 12],
    ]);
  });

  it("never lets an identical import-time updated_at decide order — timestamp breaks the tie", () => {
    // Every row of one import batch shares updated_at=now(); the backdated
    // timestamps must keep the list in real watch order.
    const rows = [
      row(1, 1, { timestamp: 100, updated_at: "2026-10-13T09:02:28Z" }),
      row(2, 1, { timestamp: 300, updated_at: "2026-10-13T09:02:28Z" }),
      row(3, 1, { timestamp: 200, updated_at: "2026-10-13T09:02:28Z" }),
    ];
    expect(groupLatestByAnime(rows).map((r) => r.anime_id)).toEqual([2, 3, 1]);
  });

  it("keeps the highest episode when recency is unknown", () => {
    const grouped = groupLatestByAnime([
      { anime_id: 4, episode_number: 3, progress: 10, duration: 100 },
      { anime_id: 4, episode_number: 7, progress: 10, duration: 100 },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.episode_number).toBe(7);
  });

  it("counts distinct episodes at ≥80% watched, never partials", () => {
    const counts = countWatchedEpisodes([
      row(7, 1, { progress: 1400, duration: 1440 }), // 97% ✓
      row(7, 1, { progress: 100, duration: 1440 }), // duplicate ep, partial
      row(7, 2, { progress: 1200, duration: 1440 }), // 83% ✓
      row(7, 3, { progress: 1000, duration: 1440 }), // 69% ✗
      row(9, 4, { progress: 5, duration: 0 }), // unknown duration, any progress ✓
      row(11, 2, { progress: 0, duration: 0 }), // nothing ✗
    ]);
    expect(counts.get(7)).toBe(2);
    expect(counts.get(9)).toBe(1);
    expect(counts.has(11)).toBe(false);
  });

  it("builds Saved-row episode meta", () => {
    expect(savedEpisodeMeta(6, 12)).toBe("6/12 EP");
    expect(savedEpisodeMeta(0, 12)).toBe("12 EP");
    expect(savedEpisodeMeta(6, 0)).toBe("6 EP WATCHED");
    expect(savedEpisodeMeta(0, 0)).toBeNull();
    expect(savedEpisodeMeta(NaN, NaN)).toBeNull();
  });
});
