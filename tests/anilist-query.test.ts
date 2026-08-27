import { afterEach, describe, expect, it, vi } from "vitest";
import { AniListRateLimitError, AniListUnavailableError, getAiringSchedule, getAnimeById, getAnimePage, getHomeAnime, resetAniListRequestStateForTests } from "../lib/anilist";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  resetAniListRequestStateForTests();
});

describe("AniList query construction", () => {
  it("uses the optional MediaSort list type and omits undefined filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: { Page: { media: [], pageInfo: { currentPage: 1, hasNextPage: false, total: 0 } } } }) });
    global.fetch = fetchMock as typeof fetch;

    await getAnimePage({ page: 1, perPage: 12, sort: ["TRENDING_DESC"] });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { query: string; variables: Record<string, unknown> };
    expect(body.query).toContain("$sort: [MediaSort]");
    expect(body.variables).toMatchObject({ page: 1, perPage: 12, sort: ["TRENDING_DESC"] });
    expect(body.variables).not.toHaveProperty("search");
    expect(body.variables).not.toHaveProperty("status");
    expect(body.variables).not.toHaveProperty("season");
  });

  it("uses the documented bounded AiringSchedule TIME sort for upcoming episodes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: { Page: { airingSchedules: [], pageInfo: { currentPage: 1, hasNextPage: false, total: 0 } } } }) });
    global.fetch = fetchMock as typeof fetch;

    await getAiringSchedule(1, 12);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { query: string; variables: Record<string, unknown> };
    expect(body.query).toContain("airingSchedules(notYetAired: true, airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME])");
    expect(body.query).not.toContain("NEXT_AIRING_EPISODE_ASC");
    expect(body.variables).toEqual({ page: 1, perPage: 12 });
  });

  it("uses a dedicated bounded NOT_YET_RELEASED title query for Home Coming Soon without replacing the weekly schedule source", async () => {
    const page = (media: Array<Record<string, unknown>>) => ({ ok: true, text: async () => JSON.stringify({ data: { Page: { media, pageInfo: { currentPage: 1, hasNextPage: false, total: media.length } } } }) });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(page([{ id: 1, title: { english: "Trending" } }]))
      .mockResolvedValueOnce(page([{ id: 2, title: { english: "Popular" } }]))
      .mockResolvedValueOnce(page([{ id: 3, status: "NOT_YET_RELEASED", title: { english: "Future title" } }]));
    global.fetch = fetchMock as typeof fetch;

    const home = await getHomeAnime();
    const finalRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const finalBody = JSON.parse(String(finalRequest.body)) as { variables: Record<string, unknown> };

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(finalBody.variables).toMatchObject({ page: 1, perPage: 12, status: "NOT_YET_RELEASED", sort: ["POPULARITY_DESC"] });
    expect(home.upcoming).toMatchObject([{ id: 3, status: "NOT_YET_RELEASED" }]);
  });

  it("requests AniList relationship edges only for a single Anime Detail query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: { Media: { id: 21, title: { english: "One Piece" }, relations: { edges: [] } } } }) });
    global.fetch = fetchMock as typeof fetch;

    await getAnimeById(21);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { query: string };
    expect(body.query).toContain("relations {");
    expect(body.query).toContain("relationType");
    expect(body.query).toContain("node {");
  });

  it("coalesces concurrent identical searches and reuses their short-lived response cache", async () => {
    let resolveResponse: ((value: unknown) => void) | undefined;
    const responsePromise = new Promise((resolve) => { resolveResponse = resolve; });
    const fetchMock = vi.fn().mockReturnValue(responsePromise);
    global.fetch = fetchMock as typeof fetch;

    const first = getAnimePage({ search: "Bleach", perPage: 30, sort: ["SEARCH_MATCH"] });
    const second = getAnimePage({ search: "Bleach", perPage: 30, sort: ["SEARCH_MATCH"] });
    resolveResponse?.({ ok: true, text: async () => JSON.stringify({ data: { Page: { media: [], pageInfo: { currentPage: 1, hasNextPage: false, total: 0 } } } }) });

    await Promise.all([first, second]);
    await getAnimePage({ search: "Bleach", perPage: 30, sort: ["SEARCH_MATCH"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies upstream HTTP 429 responses and preserves Retry-After timing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "12" }),
      text: async () => JSON.stringify({ errors: [{ message: "Too Many Requests." }] }),
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(getAnimePage({ search: "Bleach", perPage: 30, sort: ["SEARCH_MATCH"] })).rejects.toEqual(expect.objectContaining({
      name: "AniListRateLimitError",
      retryAfterMs: 12_000,
    }));
    await expect(getAnimePage({ search: "Bleach", perPage: 30, sort: ["SEARCH_MATCH"] })).rejects.toBeInstanceOf(AniListRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("classifies AniList’s confirmed temporary stability shutdown for a recovery banner", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
      text: async () => JSON.stringify({ errors: [{ message: "The AniList API has been temporarily disabled due to severe stability issues." }] }),
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(getAnimePage()).rejects.toBeInstanceOf(AniListUnavailableError);
  });
});
