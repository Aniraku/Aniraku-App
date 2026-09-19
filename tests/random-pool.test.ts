import { afterEach, describe, expect, it } from "vitest";
import {
  RANDOM_MAX_PAGE,
  randomPages,
  regenerateRandomPages,
  resetRandomPagesForTests,
  sessionRandomPages,
  shouldFallbackToFirstPages,
} from "../lib/random-pool";

afterEach(() => {
  resetRandomPagesForTests();
});

describe("random pool page selection", () => {
  it("deals three distinct pages within [1, RANDOM_MAX_PAGE]", () => {
    for (let i = 0; i < 50; i++) {
      const [a, b, c] = randomPages();
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(RANDOM_MAX_PAGE);
      expect(b).toBeLessThanOrEqual(RANDOM_MAX_PAGE);
      expect(c).toBeLessThanOrEqual(RANDOM_MAX_PAGE);
      expect(new Set([a, b, c]).size).toBe(3);
    }
  });

  it("is stable across calls within one session and changes on regenerate", () => {
    const first = sessionRandomPages();
    expect(sessionRandomPages()).toEqual(first);
    expect(sessionRandomPages()).toEqual(first);
    const regenerated = regenerateRandomPages();
    expect(sessionRandomPages()).toEqual(regenerated);
  });

  it("clamps a custom maxPage below the requested range", () => {
    for (let i = 0; i < 20; i++) {
      const [a, b, c] = randomPages(5);
      expect(a).toBeLessThanOrEqual(5);
      expect(b).toBeLessThanOrEqual(5);
      expect(c).toBeLessThanOrEqual(5);
    }
  });
});

describe("thin pool fallback decision", () => {
  it("falls back only when the pool is under the threshold", () => {
    expect(shouldFallbackToFirstPages(0)).toBe(true);
    expect(shouldFallbackToFirstPages(9)).toBe(true);
    expect(shouldFallbackToFirstPages(10)).toBe(false);
    expect(shouldFallbackToFirstPages(150)).toBe(false);
  });

  it("honors a custom threshold and rejects non-finite sizes", () => {
    expect(shouldFallbackToFirstPages(2, 3)).toBe(true);
    expect(shouldFallbackToFirstPages(3, 3)).toBe(false);
    expect(shouldFallbackToFirstPages(Number.NaN)).toBe(false);
  });
});
