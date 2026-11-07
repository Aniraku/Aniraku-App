import { describe, expect, it } from "vitest";
import { ANIRAKU_SITE_ORIGIN, animeInfoWebUrl, animeWatchWebUrl } from "../lib/site-links";

// The share contract: links point at the website's REAL routes (/info, /watch)
// — the retired /anime path 404s on the site — and the app's intent filters
// (app.config.ts) claim exactly these prefixes so App Links open the app.
describe("site links", () => {
  it("builds the info URL on the website's real route", () => {
    expect(animeInfoWebUrl(123)).toBe(`${ANIRAKU_SITE_ORIGIN}/info/123`);
  });

  it("builds watch URLs with and without an episode", () => {
    expect(animeWatchWebUrl(123)).toBe(`${ANIRAKU_SITE_ORIGIN}/watch/123`);
    expect(animeWatchWebUrl(123, 4)).toBe(`${ANIRAKU_SITE_ORIGIN}/watch/123?ep=4`);
    expect(animeWatchWebUrl(123, 0)).toBe(`${ANIRAKU_SITE_ORIGIN}/watch/123`);
    expect(animeWatchWebUrl(123, Number.NaN)).toBe(`${ANIRAKU_SITE_ORIGIN}/watch/123`);
  });

  it("never emits the retired /anime path", () => {
    expect(animeInfoWebUrl(1)).not.toContain("/anime/");
    expect(animeWatchWebUrl(1, 1)).not.toContain("/anime/");
  });
});
