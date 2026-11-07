import { describe, expect, it } from "vitest";
import { upcomingSeasonTarget } from "../lib/anilist";
import { animeHasStarted } from "../lib/types";

// The Coming-soon rail pins the NEXT broadcast season (site parity) — the
// year only wraps when Fall rolls into Winter.
describe("upcomingSeasonTarget", () => {
  it("moves Winter → Spring → Summer → Fall inside the same year", () => {
    expect(upcomingSeasonTarget(new Date("2026-01-15T00:00:00Z"))).toEqual({ season: "SPRING", year: 2026 });
    expect(upcomingSeasonTarget(new Date("2026-04-20T00:00:00Z"))).toEqual({ season: "SUMMER", year: 2026 });
    expect(upcomingSeasonTarget(new Date("2026-07-10T00:00:00Z"))).toEqual({ season: "FALL", year: 2026 });
  });

  it("wraps Fall into next year's Winter (FALL 2026 → WINTER 2027)", () => {
    expect(upcomingSeasonTarget(new Date("2026-10-05T00:00:00Z"))).toEqual({ season: "WINTER", year: 2027 });
    expect(upcomingSeasonTarget(new Date("2026-12-31T00:00:00Z"))).toEqual({ season: "WINTER", year: 2027 });
  });

  it("keeps January–March in the same year's Spring target", () => {
    // March is still Winter season on AniList (Jan–Mar) — the next season
    // is Spring, starting April 1 of the same year.
    expect(upcomingSeasonTarget(new Date("2027-03-01T00:00:00Z"))).toEqual({ season: "SPRING", year: 2027 });
  });
});

// AniList's status flag can lag a title that just began airing — the rail
// drops anything whose start date has already passed.
describe("animeHasStarted", () => {
  const now = new Date("2026-11-07T12:00:00Z");

  it("flags titles whose start date has passed", () => {
    expect(animeHasStarted({ startDate: { year: 2026, month: 11, day: 5 } }, now)).toBe(true);
    expect(animeHasStarted({ startDate: { year: 2020 } }, now)).toBe(true);
  });

  it("keeps future and same-day titles", () => {
    expect(animeHasStarted({ startDate: { year: 2026, month: 11, day: 7 } }, now)).toBe(false);
    expect(animeHasStarted({ startDate: { year: 2027, month: 1, day: 10 } }, now)).toBe(false);
  });

  it("treats missing parts as the start of that month/year", () => {
    // Year-only 2026 degrades to Jan 1 2026 — long past.
    expect(animeHasStarted({ startDate: { year: 2026 } }, now)).toBe(true);
    // Year+month only: Nov 2026 starts Nov 1 — already begun.
    expect(animeHasStarted({ startDate: { year: 2026, month: 11 } }, now)).toBe(true);
    expect(animeHasStarted({ startDate: { year: 2026, month: 12 } }, now)).toBe(false);
  });

  it("never flags titles without any start date", () => {
    expect(animeHasStarted({}, now)).toBe(false);
    expect(animeHasStarted({ startDate: null }, now)).toBe(false);
  });
});
