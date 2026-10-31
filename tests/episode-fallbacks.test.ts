import { describe, expect, it } from "vitest";
import { applyEpisodeFallbackMetadata } from "../lib/episode-fallbacks";

const TMDB_THUMB = "https://image.tmdb.org/t/p/w780/e363TDn4uP8jP7kHAXQfHAs6HTR.jpg";
const BANNER = "https://s4.anilist.co/file/anilistcdn/media/anime/banner.jpg";

describe("episode display fallbacks (backend AniZip+TMDB merge)", () => {
  it("keeps verified TMDB thumbnails and unique real titles from the merged backend payload", () => {
    const rows = [
      { number: 1, title: "To You, in 2000 Years", thumbnail: TMDB_THUMB },
      { number: 2, title: "That Day", thumbnail: TMDB_THUMB.replace("e363", "aaaa") },
    ];
    const out = applyEpisodeFallbackMetadata(rows, { fallbackThumbnail: BANNER });
    expect(out.map((row) => row.thumbnail)).toEqual([rows[0].thumbnail, rows[1].thumbnail]);
    expect(out.map((row) => row.title)).toEqual(["To You, in 2000 Years", "That Day"]);
  });

  it("backfills missing thumbnails with the title's poster art (https-only)", () => {
    const rows = [{ number: 1, title: "Real title", thumbnail: "" }];
    expect(applyEpisodeFallbackMetadata(rows, { fallbackThumbnail: BANNER })[0].thumbnail).toBe(BANNER);
    // A non-https or junk fallback never enters the app's image pipeline.
    expect(applyEpisodeFallbackMetadata(rows, { fallbackThumbnail: "http://insecure.example/x.jpg" })[0].thumbnail).toBeNull();
    expect(applyEpisodeFallbackMetadata(rows, { fallbackThumbnail: "not a url" })[0].thumbnail).toBeNull();
  });

  it("neutralizes generic or duplicated titles instead of trusting them", () => {
    const rows = [
      { number: 1, title: "Episode 1", thumbnail: TMDB_THUMB },
      { number: 2, title: "Same", thumbnail: TMDB_THUMB },
      { number: 3, title: "Same", thumbnail: TMDB_THUMB },
    ];
    const out = applyEpisodeFallbackMetadata(rows, {});
    expect(out.every((row) => row.title === null)).toBe(true);
  });

  it("applies the movie title fallback only for movies with a real title", () => {
    const rows = [{ number: 1, title: "", thumbnail: TMDB_THUMB }];
    expect(applyEpisodeFallbackMetadata(rows, { fallbackTitle: "Perfect Blue", isMovie: true })[0].title).toBe("Perfect Blue");
    expect(applyEpisodeFallbackMetadata(rows, { fallbackTitle: "Perfect Blue", isMovie: false })[0].title).toBeNull();
    expect(applyEpisodeFallbackMetadata(rows, { fallbackTitle: "Episode 1", isMovie: true })[0].title).toBeNull();
  });

  it("renumbers missing/invalid numbers positionally", () => {
    const rows = [{ number: 0, title: "A" }, { number: 3, title: "B" }] as never;
    const out = applyEpisodeFallbackMetadata(rows, {});
    expect(out.map((row) => row.number)).toEqual([1, 3]);
  });
});
