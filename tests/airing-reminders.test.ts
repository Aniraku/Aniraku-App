import { describe, expect, it } from "vitest";
import {
  AIRING_REMINDER_DELAY_MS,
  AIRING_REMINDER_HORIZON_MS,
  airingReminderFireAt,
  airingReminderIdentifier,
  candidateFromAnime,
  parseAiringReminderRecords,
  pickAiringReminders,
  serializeAiringReminderRecords,
  type AiringReminderCandidate,
  type AiringReminderRecord,
} from "@/lib/airing-reminders";
import { episodeNotificationKey, withoutScheduledEpisodeKeys } from "@/lib/episode-notifications";

const NOW = 1_800_000_000_000; // fixed reference time (unix ms)
const HOUR = 3_600_000;

function candidate(overrides: Partial<AiringReminderCandidate> = {}): AiringReminderCandidate {
  return { animeId: 16498, title: "Attack on Titan", episode: 12, airingAt: (NOW + HOUR) / 1000, ...overrides };
}

function record(overrides: Partial<AiringReminderRecord> = {}): AiringReminderRecord {
  const base = candidate();
  return {
    identifier: airingReminderIdentifier(base.animeId, base.episode),
    animeId: base.animeId,
    episode: base.episode,
    fireAt: airingReminderFireAt(base.airingAt),
    ...overrides,
  };
}

describe("airing reminders", () => {
  it("builds deterministic identifiers and delays the fire time past the raw airing", () => {
    expect(airingReminderIdentifier(16498, 12)).toBe("aniraku.airing.16498.12");
    const airingAt = 1_800_000_000; // unix seconds
    expect(airingReminderFireAt(airingAt)).toBe(airingAt * 1000 + AIRING_REMINDER_DELAY_MS);
    expect(airingReminderFireAt(airingAt)).toBeGreaterThan(airingAt * 1000);
  });

  it("round-trips records through storage and rejects corrupt payloads", () => {
    const records = [record()];
    expect(parseAiringReminderRecords(serializeAiringReminderRecords(records))).toEqual(records);
    expect(parseAiringReminderRecords(null)).toEqual([]);
    expect(parseAiringReminderRecords("{not json")).toEqual([]);
    expect(parseAiringReminderRecords('"a string"')).toEqual([]);
    // Entries with wrong prefix / bogus numbers are dropped, valid ones survive.
    const mixed = JSON.stringify([
      record(),
      { ...record(), identifier: "evil.identifier.1.1" },
      { ...record(), animeId: -5 },
      { ...record(), episode: 0 },
      { ...record(), fireAt: Number.NaN },
      null,
      "junk",
    ]);
    expect(parseAiringReminderRecords(mixed)).toEqual([record()]);
  });

  it("derives candidates from batched AniList metadata with title fallbacks", () => {
    expect(
      candidateFromAnime({
        id: 16498,
        title: { english: "Attack on Titan", romaji: "Shingeki no Kyojin" },
        nextAiringEpisode: { episode: 12, airingAt: 1_800_000_100 },
      }),
    ).toEqual({ animeId: 16498, title: "Attack on Titan", episode: 12, airingAt: 1_800_000_100 });
    expect(candidateFromAnime({ id: 9, title: { romaji: "Romaji Only" }, nextAiringEpisode: { episode: 2, airingAt: 100 } })?.title).toBe("Romaji Only");
    expect(candidateFromAnime({ id: 9, title: { native: "日本語" }, nextAiringEpisode: { episode: 2, airingAt: 100 } })?.title).toBe("日本語");
    expect(candidateFromAnime({ id: 9, title: {}, nextAiringEpisode: { episode: 2, airingAt: 100 } })?.title).toBe("Your saved anime");
    // No upcoming airing (finished / on break) or broken metadata → no reminder.
    expect(candidateFromAnime({ id: 9, title: {}, nextAiringEpisode: null })).toBeNull();
    expect(candidateFromAnime({ id: 9, title: {}, nextAiringEpisode: { episode: 0, airingAt: 100 } })).toBeNull();
    expect(candidateFromAnime({ id: 9, title: {}, nextAiringEpisode: { episode: 2, airingAt: Number.NaN } })).toBeNull();
    expect(candidateFromAnime({ id: -1, title: {}, nextAiringEpisode: { episode: 2, airingAt: 100 } })).toBeNull();
  });

  it("schedules future desired reminders that are not managed yet", () => {
    const cand = candidate();
    const pick = pickAiringReminders({ now: NOW, desired: [cand], managed: [], alreadyNotified: new Set() });
    expect(pick.toSchedule).toEqual([cand]);
    expect(pick.toKeep).toEqual([]);
    expect(pick.toCancel).toEqual([]);
    expect(pick.clearKeys).toEqual([]);
  });

  it("keeps already-managed reminders without native churn", () => {
    const cand = candidate();
    const managed = record();
    const pick = pickAiringReminders({ now: NOW, desired: [cand], managed: [managed], alreadyNotified: new Set([episodeNotificationKey(cand.animeId, cand.episode)]) });
    expect(pick.toSchedule).toEqual([]);
    expect(pick.toKeep).toEqual([managed]);
    expect(pick.toCancel).toEqual([]);
  });

  it("cancels + releases dedupe keys for future reminders that are no longer desired", () => {
    const stale = record({ identifier: airingReminderIdentifier(555, 4), animeId: 555, episode: 4, fireAt: NOW + 2 * HOUR });
    const pick = pickAiringReminders({ now: NOW, desired: [candidate()], managed: [stale], alreadyNotified: new Set() });
    expect(pick.toCancel).toEqual([stale]);
    expect(pick.clearKeys).toEqual([stale]);
    expect(pick.toSchedule).toEqual([candidate()]);
  });

  it("prunes fired records silently — no cancel, no key release", () => {
    const fired = record({ fireAt: NOW - HOUR });
    const pick = pickAiringReminders({ now: NOW, desired: [], managed: [fired], alreadyNotified: new Set() });
    expect(pick.toCancel).toEqual([]);
    expect(pick.clearKeys).toEqual([]);
    expect(pick.toKeep).toEqual([]);
  });

  it("never schedules episodes already notified, past-due airings, or beyond the horizon", () => {
    const notified = candidate({ animeId: 1, episode: 3 });
    const alreadyAired = candidate({ animeId: 2, episode: 3, airingAt: (NOW - HOUR) / 1000 });
    const tooFarOut = candidate({ animeId: 3, episode: 3, airingAt: (NOW + AIRING_REMINDER_HORIZON_MS + HOUR) / 1000 });
    const ok = candidate({ animeId: 4, episode: 3 });
    const pick = pickAiringReminders({
      now: NOW,
      desired: [notified, alreadyAired, tooFarOut, ok],
      managed: [],
      alreadyNotified: new Set([episodeNotificationKey(notified.animeId, notified.episode)]),
    });
    expect(pick.toSchedule).toEqual([ok]);
  });

  it("collapses duplicate managed records instead of persisting them forever", () => {
    const first = record();
    const dupe = record({ fireAt: NOW + 9 * HOUR });
    const pick = pickAiringReminders({ now: NOW, desired: [candidate()], managed: [first, dupe], alreadyNotified: new Set() });
    expect(pick.toKeep).toEqual([first]);
  });

  it("releases only the requested dedupe keys when a cancelled reminder never fired", () => {
    const scheduled = new Set([episodeNotificationKey(1, 5), episodeNotificationKey(2, 6)]);
    const released = withoutScheduledEpisodeKeys(scheduled, [episodeNotificationKey(1, 5)]);
    expect(released).toEqual([episodeNotificationKey(2, 6)]);
    expect(withoutScheduledEpisodeKeys(new Set(), [episodeNotificationKey(1, 5)])).toEqual([]);
  });
});
