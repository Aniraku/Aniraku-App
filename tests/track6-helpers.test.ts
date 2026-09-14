import { describe, expect, it } from "vitest";
import {
  buildEpisodeNotificationContent,
  episodeNotificationKey,
  parseScheduledEpisodeKeys,
  shouldScheduleEpisodeNotification,
  withScheduledEpisodeKey,
} from "../lib/episode-notifications";
import { parseFirstRunImportPrompted, shouldPromptFirstRunImport } from "../lib/first-run-import";
import {
  buildResumeRows,
  isResumeRowsStale,
  isWideLayout,
  resolveNextEpisode,
  resolvePrevEpisode,
} from "../lib/up-next";
import { t } from "../lib/i18n";

describe("episode notifications helper", () => {
  it("builds terse content with anime routing data", () => {
    const content = buildEpisodeNotificationContent({ animeId: 21, title: "One Piece", episode: 1156 });
    expect(content.title).toBe("One Piece");
    expect(content.body).toBe("Episode 1156 is now available");
    expect(content.data).toEqual({ animeId: 21, episode: 1156 });
  });

  it("dedupes to one notification per episode", () => {
    const scheduled = new Set([episodeNotificationKey(21, 5)]);
    expect(shouldScheduleEpisodeNotification(scheduled, 21, 5)).toBe(false);
    expect(shouldScheduleEpisodeNotification(scheduled, 21, 6)).toBe(true);
    expect(shouldScheduleEpisodeNotification(scheduled, 0, 6)).toBe(false);
    expect(parseScheduledEpisodeKeys(null)).toEqual(new Set());
    expect(parseScheduledEpisodeKeys(JSON.stringify(["21:5"]))).toEqual(new Set(["21:5"]));
    expect(withScheduledEpisodeKey(scheduled, 21, 6)).toContain("21:6");
  });
});

describe("first-run import prompt", () => {
  it("prompts once when signed in with a connected provider", () => {
    expect(
      shouldPromptFirstRunImport({ signedIn: true, verified: true, connectedProviders: ["anilist"], hasPrompted: false }),
    ).toBe(true);
    expect(
      shouldPromptFirstRunImport({ signedIn: true, verified: true, connectedProviders: ["anilist"], hasPrompted: true }),
    ).toBe(false);
    expect(
      shouldPromptFirstRunImport({ signedIn: true, verified: true, connectedProviders: [], hasPrompted: false }),
    ).toBe(false);
    expect(
      shouldPromptFirstRunImport({ signedIn: false, verified: false, connectedProviders: ["mal"], hasPrompted: false }),
    ).toBe(false);
  });

  it("reads the prompted flag tolerantly", () => {
    expect(parseFirstRunImportPrompted(null)).toBe(false);
    expect(parseFirstRunImportPrompted("1")).toBe(true);
    expect(parseFirstRunImportPrompted(JSON.stringify({ prompted: true }))).toBe(true);
  });
});

describe("up-next wiring", () => {
  it("resolves adjacent episodes without inventing numbers", () => {
    const episodes = [{ number: 1 }, { number: 2 }, { number: 4 }];
    expect(resolveNextEpisode(2, episodes)).toBe(4);
    expect(resolveNextEpisode(4, episodes)).toBeNull();
    expect(resolvePrevEpisode(4, episodes)).toBe(2);
    expect(resolvePrevEpisode(1, episodes)).toBeNull();
  });

  it("precomputes one resume row per anime, most recent first", () => {
    const rows = buildResumeRows([
      { anime_id: 1, anime_title: "A", anime_image: null, episode_number: 3, progress: 100, duration: 1400, updated_at: "2026-01-02T00:00:00.000Z" },
      { anime_id: 1, anime_title: "A", anime_image: null, episode_number: 4, progress: 10, duration: 1400, updated_at: "2026-01-03T00:00:00.000Z" },
      { anime_id: 2, anime_title: "B", anime_image: null, episode_number: 1, progress: 50, duration: 1400, updated_at: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(rows.map((row) => row.animeId)).toEqual([1, 2]);
    expect(rows[0]?.episode).toBe(4);
    expect(rows[0]?.percent).toBe(1);
  });

  it("treats missing timestamps as stale and honors the wide breakpoint", () => {
    expect(isResumeRowsStale(null)).toBe(true);
    expect(isResumeRowsStale(Date.now())).toBe(false);
    expect(isWideLayout(900)).toBe(true);
    expect(isWideLayout(800)).toBe(false);
  });
});

describe("i18n scaffolding", () => {
  it("returns English copy for player and settings keys", () => {
    expect(t("player.retry")).toBe("Try again");
    expect(t("settings.title")).toBe("Settings");
  });
});
