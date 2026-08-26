import { afterEach, describe, expect, it, vi } from "vitest";
import { AniListUnavailableError, MetadataRateLimitError, getAiringSchedule, getAnimeById, getAnimePage, resetAniListRequestStateForTests } from "../lib/anilist";
import { APP_CONFIG } from "../lib/app-config";

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

  it("uses the Aniraku Schedule endpoint and falls back to its GraphQL proxy when that endpoint has no usable upcoming rows", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          pageInfo: { currentPage: 1, hasNextPage: true, total: 142 },
          schedule: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { Page: { pageInfo: { currentPage: 1, hasNextPage: true, total: 142 }, airingSchedules: [{ airingAt: 1_800_000_000, episode: 1148, media: { id: 21_000, idMal: 21, title: { english: "One Piece" }, coverImage: { large: "https://example.test/one-piece.jpg" }, format: "TV" } }] } } }) });
    global.fetch = fetchMock as typeof fetch;

    const schedule = await getAiringSchedule(1, 12);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${APP_CONFIG.apiBaseUrl}/api/v1/schedule?page=1&perPage=12`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(APP_CONFIG.metadataFallbackUrl);
    const fallbackRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(String(fallbackRequest.body)).toContain("airingSchedules(airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME])");
    expect(schedule.airingSchedules).toMatchObject([{ airingAt: 1_800_000_000, episode: 1148, media: { id: 21_000, idMal: 21, nextAiringEpisode: { episode: 1148, airingAt: 1_800_000_000 } } }]);
  });

  it("uses the existing Aniraku GraphQL proxy for a bounded full local week so past and future release rows are available together", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { Page: { pageInfo: { currentPage: 1, hasNextPage: false, total: 1 }, airingSchedules: [{ airingAt: 1_800_000_000, episode: 1148, media: { id: 21_000, idMal: 21, title: { english: "One Piece" }, coverImage: {}, format: "TV" } }] } } }) });
    global.fetch = fetchMock as typeof fetch;

    await getAiringSchedule(1, 100, { startAt: 1_799_000_000, endAt: 1_801_000_000 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(APP_CONFIG.metadataFallbackUrl);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { query: string; variables: Record<string, number> };
    expect(body.query).toContain("airingSchedules(airingAt_greater: $startAt, airingAt_lesser: $endAt, sort: [TIME])");
    expect(body.variables).toMatchObject({ page: 1, perPage: 100, startAt: 1_799_000_000, endAt: 1_801_000_000 });
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

  it("uses the website metadata resolver first and only falls back to the existing Aniraku API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, headers: new Headers(), text: async () => JSON.stringify({ error: { message: "Resolver unavailable" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ data: { Media: { id: 21, idMal: 21, title: { english: "One Piece" } } } }) });
    global.fetch = fetchMock as typeof fetch;

    const anime = await getAnimeById(21);

    expect(anime.id).toBe(21);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(APP_CONFIG.metadataResolverUrl);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(APP_CONFIG.metadataFallbackUrl);
  });

  it("uses direct MAL browse data only when the native direct-MAL build flag and public client ID are present", async () => {
    vi.resetModules();
    vi.stubEnv("EXPO_PUBLIC_DIRECT_MAL", "true");
    vi.stubEnv("EXPO_PUBLIC_MAL_CLIENT_ID", "test-mal-client-id");
    const directFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => ({ data: [{ node: { id: 21, title: "One Piece", media_type: "tv", status: "currently_airing" } }], paging: {} }) })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => ({ data: { Page: { media: [{ id: 21, idMal: 21 }] } } }) });
    global.fetch = directFetch as typeof fetch;
    const directClient = await import("../lib/anilist");

    const page = await directClient.getAnimePage({ page: 1, perPage: 12, sort: ["TRENDING_DESC"] });

    expect(page.media[0]).toMatchObject({ id: 21, idMal: 21, title: { english: "One Piece" } });
    expect(String(directFetch.mock.calls[0]?.[0])).toContain("https://api.myanimelist.net/v2/anime/ranking");
    expect((directFetch.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ "X-MAL-CLIENT-ID": "test-mal-client-id" });
    expect(directFetch.mock.calls[1]?.[0]).toBe("https://api.aniraku.tech/api/v1/anilist");
    vi.unstubAllEnvs();
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
      name: "MetadataRateLimitError",
      retryAfterMs: 12_000,
    }));
    await expect(getAnimePage({ search: "Bleach", perPage: 30, sort: ["SEARCH_MATCH"] })).rejects.toBeInstanceOf(MetadataRateLimitError);
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
