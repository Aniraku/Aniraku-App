import { afterEach, describe, expect, it, vi } from "vitest";
import { getEpisodes, getServers } from "../lib/aniraku-api";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("Aniraku episode contract", () => {
  it("normalizes the live backend episode object without replacing real metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        episodes: [
          { number: 10, title: "Real title", thumbnail: "https://cdn.aniraku.tech/episode.jpg", filler: true },
          { number: 20, title: "Second title", thumbnail: "https://cdn.aniraku.tech/episode-2.jpg" },
        ],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(getEpisodes(16498)).resolves.toEqual([
      { number: 1, title: "Real title", thumbnail: "https://cdn.aniraku.tech/episode.jpg", description: undefined, isFiller: true },
      { number: 2, title: "Second title", thumbnail: "https://cdn.aniraku.tech/episode-2.jpg", description: undefined, isFiller: false },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("https://api.aniraku.tech/api/v1/anime/16498/episodes"), expect.objectContaining({ headers: { Accept: "application/json" } }));
  });

  it("rejects malformed primary and fallback episode responses instead of treating them as empty availability", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ unexpected: [] }) }) as typeof fetch;
    await expect(getEpisodes(16498)).rejects.toThrow("Episode availability is temporarily unavailable from both sources");
  });

  it("recovers real numbered episodes through Miruro when the Aniraku episode origin cannot be reached", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("TLS connection closed"))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          providers: {
            ally: {
              episodes: {
                sub: [
                  { number: 1, title: "A real fallback episode", image: "https://cdn.example.test/one.jpg", fillerType: "manga_canon" },
                  { number: 2, title: "A real filler episode", image: "https://cdn.example.test/two.jpg", fillerType: "mixed_canon/filler" },
                ],
              },
            },
          },
        }),
      });
    global.fetch = fetchMock as typeof fetch;

    await expect(getEpisodes(16498)).resolves.toEqual([
      { number: 1, title: "A real fallback episode", thumbnail: "https://cdn.example.test/one.jpg", description: undefined, isFiller: false },
      { number: 2, title: "A real filler episode", thumbnail: "https://cdn.example.test/two.jpg", description: undefined, isFiller: true },
    ]);
    expect(fetchMock.mock.calls[1][0]).toContain("https://miruro-api-v3.onrender.com/episodes/16498");
  });

  it("maps real Aniraku public server names instead of exposing a duplicate adapter label", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify([
      { name: "ally", provider: "miruro", lang: "sub" },
      { name: "pewe", provider: "miruro", lang: "sub" },
    ]) }) as typeof fetch;

    await expect(getServers(16498, 1, "sub")).resolves.toEqual([
      { id: "sub:ally", provider: "ally", label: "ALLY", lang: "sub", verification: undefined, type: undefined },
      { id: "sub:pewe", provider: "pewe", label: "PEWE", lang: "sub", verification: undefined, type: undefined },
    ]);
  });

  it("returns no providers for an out-of-range episode without fabricating a stream", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "null" }) as typeof fetch;
    await expect(getServers(16498, 63, "sub")).resolves.toEqual([]);
  });
});
