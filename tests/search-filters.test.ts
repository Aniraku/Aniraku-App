import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  FORMAT_OPTIONS,
  QUICK_GENRES,
  SEASON_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  YEAR_OPTIONS,
  coerceFilterValue,
  coerceFilters,
  countActiveFilters,
  filterSignature,
  hasActiveFilters,
} from "../lib/search-filters";

describe("search filter model", () => {
  it("keeps every option value on the AniList allowlists", async () => {
    // A single unknown enum slot 400s the whole GraphQL request, so the
    // option sets must exactly match lib/anilist.ts's validators.
    const { sanitizeMediaFormat, sanitizeMediaSortList, sanitizeMediaStatus } = await import("../lib/anilist");
    for (const option of SORT_OPTIONS) {
      expect(sanitizeMediaSortList(option.value)).toEqual([option.value]);
    }
    for (const option of STATUS_OPTIONS) {
      expect(sanitizeMediaStatus(option.value)).toBe(option.value);
    }
    for (const option of FORMAT_OPTIONS) {
      expect(sanitizeMediaFormat(option.value)).toBe(option.value);
    }
  });

  it("uses AniList season names for the season filter", () => {
    expect(SEASON_OPTIONS.map((option) => option.value)).toEqual(["WINTER", "SPRING", "SUMMER", "FALL"]);
  });

  it("lists the current year first in year options and never repeats", () => {
    expect(YEAR_OPTIONS[0].value).toBe(String(new Date().getFullYear()));
    const values = YEAR_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values.every((value) => /^\d{4}$/.test(value))).toBe(true);
  });

  it("shares one quick-genre list", () => {
    expect(QUICK_GENRES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(QUICK_GENRES).size).toBe(QUICK_GENRES.length);
  });

  it("counts and detects active filters", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS })).toBe(0);
    expect(hasActiveFilters({ ...EMPTY_FILTERS })).toBe(false);
    const active = { ...EMPTY_FILTERS, sort: "SCORE_DESC", year: "2024" };
    expect(countActiveFilters(active)).toBe(2);
    expect(hasActiveFilters(active)).toBe(true);
  });

  it("produces a stable signature that differs per filter set", () => {
    const a = filterSignature({ ...EMPTY_FILTERS, sort: "TRENDING_DESC" });
    const b = filterSignature({ ...EMPTY_FILTERS, sort: "TRENDING_DESC" });
    const c = filterSignature({ ...EMPTY_FILTERS, sort: "SCORE_DESC" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("coerces unknown or garbage values to null instead of passing them through", () => {
    expect(coerceFilterValue(STATUS_OPTIONS, "RELEASING")).toBe("RELEASING");
    expect(coerceFilterValue(STATUS_OPTIONS, "NOT_A_STATUS")).toBeNull();
    expect(coerceFilterValue(SORT_OPTIONS, { evil: true })).toBeNull();
    const currentYear = String(new Date().getFullYear());
    expect(coerceFilterValue(YEAR_OPTIONS, ` ${currentYear} `)).toBe(currentYear);
  });

  it("coerces partial/undefined filter payloads onto the safe shape", () => {
    expect(coerceFilters(undefined)).toEqual({ ...EMPTY_FILTERS });
    expect(coerceFilters(null)).toEqual({ ...EMPTY_FILTERS });
    expect(coerceFilters({ sort: "TRENDING_DESC", format: "HACK" })).toEqual({
      sort: "TRENDING_DESC",
      status: null,
      format: null,
      season: null,
      year: null,
    });
  });
});
