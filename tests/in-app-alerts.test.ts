import { describe, expect, it } from "vitest";
import { availableReleasedEpisode, shouldCreateEpisodeAlert } from "@/lib/in-app-alerts";

describe("in-app episode alerts", () => {
  it("uses the newest released episode immediately before the next scheduled airing", () => {
    expect(availableReleasedEpisode({ id: 1, title: {}, status: "RELEASING", nextAiringEpisode: { episode: 7, airingAt: 0 } })).toBe(6);
  });

  it("does not alert for completed titles or invalid episode metadata", () => {
    expect(availableReleasedEpisode({ id: 1, title: {}, status: "FINISHED", episodes: 12 })).toBeNull();
    expect(availableReleasedEpisode({ id: 1, title: {}, status: "RELEASING", episodes: 0 })).toBeNull();
  });

  it("deduplicates the same release during the six-hour refresh window", () => {
    const now = 1_000_000;
    expect(shouldCreateEpisodeAlert({ episode: 4, checkedAt: now - 1_000 }, 5, now)).toBe(false);
    expect(shouldCreateEpisodeAlert({ episode: 4, checkedAt: now - 21_600_001 }, 5, now)).toBe(true);
    expect(shouldCreateEpisodeAlert({ episode: 5, checkedAt: now - 21_600_001 }, 5, now)).toBe(false);
  });
});
