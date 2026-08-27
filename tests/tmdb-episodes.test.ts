import { describe, expect, it, vi } from "vitest";
import { enrichEpisodesWithTmdb, mergeTmdbEpisodeMetadata } from "../lib/tmdb-episodes";

const poster = "https://cdn.aniraku.tech/poster.jpg";
const still = "https://image.tmdb.org/t/p/w780/verified-still.jpg";

function requestUrl(input: RequestInfo | URL) {
  return new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
}

describe("strict TMDB episode display enrichment", () => {
  it("replaces only verified display metadata while preserving Aniraku canonical identity and filler state", () => {
    const availability = [
      { number: 1, title: "Copied title", thumbnail: "https://cdn.aniraku.tech/wrong.jpg", description: "Wrong", isFiller: true, playbackId: "keep-me" },
    ];
    const result = mergeTmdbEpisodeMetadata(availability, [{ number: 1, title: "Exact TMDB title", thumbnail: still, description: "Exact TMDB description" }], { fallbackThumbnail: poster });

    expect(result).toEqual([{ number: 1, title: "Exact TMDB title", thumbnail: still, description: "Exact TMDB description", isFiller: true, playbackId: "keep-me" }]);
  });

  it("neutralizes mapped-but-missing and duplicate TMDB candidates, retaining only title-level fallback art", () => {
    const availability = [
      { number: 1, title: "Repeated", thumbnail: "https://cdn.aniraku.tech/one.jpg", description: "Wrong", isFiller: false },
      { number: 2, title: "Repeated", thumbnail: "https://cdn.aniraku.tech/two.jpg", description: "Wrong", isFiller: true },
    ];
    const result = mergeTmdbEpisodeMetadata(availability, [
      { number: 2, title: "Candidate one", thumbnail: still },
      { number: 2, title: "Candidate two", thumbnail: still },
    ], { fallbackThumbnail: poster, mappedNumbers: [1, 2] });

    expect(result).toEqual([
      { number: 1, title: null, thumbnail: poster, description: null, isFiller: false },
      { number: 2, title: null, thumbnail: poster, description: null, isFiller: true },
    ]);
  });

  it("keeps distinct exact Bleach resolver sequences isolated instead of leaking a related title’s display metadata", async () => {
    const availability = [{ number: 1, title: "Provider copy", thumbnail: "", isFiller: false }];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const anilistId = requestUrl(input).searchParams.get("anilistId");
      const episode = anilistId === "169755"
        ? { number: 1, title: "A", thumbnail: "https://image.tmdb.org/t/p/w780/calamity.jpg", description: "Calamity" }
        : { number: 1, title: "The Last 9 Days", thumbnail: "https://image.tmdb.org/t/p/w780/separation.jpg", description: "Separation" };
      return new Response(JSON.stringify({ anilistId: Number(anilistId), source: "tmdb", mapped: [1], episodes: [episode] }), { status: 200 });
    });

    const options = { fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: "https://www.aniraku.tech/api/tmdb-episodes" };
    const calamity = await enrichEpisodesWithTmdb(169755, availability, options);
    const separation = await enrichEpisodesWithTmdb(159322, availability, options);

    expect(calamity[0]).toMatchObject({ number: 1, title: "A", thumbnail: "https://image.tmdb.org/t/p/w780/calamity.jpg" });
    expect(separation[0]).toMatchObject({ number: 1, title: "The Last 9 Days", thumbnail: "https://image.tmdb.org/t/p/w780/separation.jpg" });
  });

  it("accepts the generic exact One Piece season-23 continuation at episode 1156 without a fixed season ceiling", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({
      anilistId: 21,
      source: "tmdb",
      mapped: [1156],
      episodes: [{ number: 1156, title: "The Long-sought Elbaph! The Big Reunion Banquet!", thumbnail: "https://image.tmdb.org/t/p/w780/one-piece-s23.jpg", description: "Exact continuation" }],
    }), { status: 200 }));

    const result = await enrichEpisodesWithTmdb(21, [{ number: 1156, title: "Provider title", thumbnail: "", isFiller: false }], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      baseUrl: "https://www.aniraku.tech/api/tmdb-episodes",
    });

    expect(result).toEqual([{ number: 1156, title: "The Long-sought Elbaph! The Big Reunion Banquet!", thumbnail: "https://image.tmdb.org/t/p/w780/one-piece-s23.jpg", description: "Exact continuation", isFiller: false }]);
    expect(requestUrl(fetchImpl.mock.calls[0][0]).searchParams.get("episodes")).toBe("1156");
  });

  it("covers every episode position in bounded 100-row batches through the public resolver without a client secret", async () => {
    const availability = Array.from({ length: 205 }, (_, index) => ({ number: index + 1, title: `Source ${index + 1}`, thumbnail: "", isFiller: false }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      const numbers = url.searchParams.get("episodes")!.split(",").map(Number);
      return new Response(JSON.stringify({
        anilistId: 21,
        source: "tmdb",
        mapped: numbers,
        episodes: numbers.map((number) => ({ number, title: `Exact ${number}`, thumbnail: `https://image.tmdb.org/t/p/w780/${number}.jpg`, description: `Description ${number}` })),
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const result = await enrichEpisodesWithTmdb(21, availability, { fetchImpl: fetchMock as unknown as typeof fetch, baseUrl: "https://www.aniraku.tech/api/tmdb-episodes" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => requestUrl(url).searchParams.get("episodes")!.split(",").length)).toEqual([100, 100, 5]);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("https://www.aniraku.tech/api/tmdb-episodes?anilistId=21&episodes="))).toBe(true);
    expect(result).toHaveLength(205);
    expect(result[0]).toMatchObject({ number: 1, title: "Exact 1", isFiller: false });
    expect(result[204]).toMatchObject({ number: 205, title: "Exact 205", isFiller: false });
  });

  it("uses verified movie title and title-level art only when an exact mapped movie row has no record", () => {
    const result = mergeTmdbEpisodeMetadata([{ number: 1, title: "Provider title", thumbnail: "", isFiller: false }], [], {
      isMovie: true,
      fallbackTitle: "Spirited Away",
      fallbackThumbnail: poster,
      mappedNumbers: [1],
    });

    expect(result).toEqual([{ number: 1, title: "Spirited Away", thumbnail: poster, description: null, isFiller: false }]);
  });
});
