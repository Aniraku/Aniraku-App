import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiringSchedule, getAnimePage } from "../lib/anilist";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
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

  it("uses the documented AiringSchedule TIME sort for upcoming episodes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: { Page: { airingSchedules: [], pageInfo: { currentPage: 1, hasNextPage: false, total: 0 } } } }) });
    global.fetch = fetchMock as typeof fetch;

    await getAiringSchedule(1, 12);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { query: string; variables: Record<string, unknown> };
    expect(body.query).toContain("airingSchedules(notYetAired: true, sort: [TIME])");
    expect(body.query).not.toContain("NEXT_AIRING_EPISODE_ASC");
    expect(body.variables).toEqual({ page: 1, perPage: 12 });
  });
});
