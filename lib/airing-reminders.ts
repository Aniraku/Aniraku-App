import { episodeNotificationKey } from "@/lib/episode-notifications";

/**
 * Keyless closed-app episode reminders (J1+J2).
 *
 * Instead of a push service (FCM/Expo push → server → device), reminders are
 * LOCAL scheduled notifications: Android's AlarmManager fires them while the
 * app is fully closed. No keys, no server, no push credentials. The trade-off:
 * the schedule can only look as far ahead as the last time the app was opened,
 * so the scheduler re-tops the horizon on every foreground/launch.
 *
 * Pure decision logic lives here (unit-tested); native scheduling side effects
 * live in providers/notifications-provider.tsx and hooks/use-airing-reminders.ts.
 */

/** Emitted by use-notify-me when the user flips a title's bell. */
export const NOTIFY_ME_CHANGED_EVENT = "aniraku.notify-me-changed";

/** Native identifiers we own: `aniraku.airing.<animeId>.<episode>`. */
export const AIRING_REMINDER_IDENTIFIER_PREFIX = "aniraku.airing.";

/** AsyncStorage list of reminders this device has scheduled and not yet fired. */
export const AIRING_REMINDER_MANAGED_KEY = "aniraku.airing-reminders.v1";

/**
 * Fire this long AFTER the raw airingAt. The episode drops at airingAt, but
 * streaming sources usually appear a beat later — the live monitor verifies
 * sources before notifying, scheduled reminders cannot, so give them buffer.
 */
export const AIRING_REMINDER_DELAY_MS = 120_000;

/** Never schedule further out than this; re-syncs top the horizon back up. */
export const AIRING_REMINDER_HORIZON_MS = 60 * 24 * 60 * 60_000;

export type AiringReminderCandidate = {
  animeId: number;
  title: string;
  episode: number;
  /** AniList unix seconds. */
  airingAt: number;
};

export type AiringReminderRecord = {
  identifier: string;
  animeId: number;
  episode: number;
  /** Unix milliseconds — when the native notification is set to fire. */
  fireAt: number;
};

export type AiringReminderPick = {
  /** Desired + not yet scheduled + not already notified → schedule natively. */
  toSchedule: AiringReminderCandidate[];
  /** Desired and already scheduled → leave untouched. */
  toKeep: AiringReminderRecord[];
  /** No longer desired (title removed / episode superseded) → cancel natively. */
  toCancel: AiringReminderRecord[];
  /** Subset of toCancel still in the future → also release their dedupe keys. */
  clearKeys: AiringReminderRecord[];
};

export function airingReminderIdentifier(animeId: number, episode: number): string {
  return `${AIRING_REMINDER_IDENTIFIER_PREFIX}${animeId}.${episode}`;
}

/** Native fire time (unix ms) for an AniList airingAt (unix seconds). */
export function airingReminderFireAt(airingAtSeconds: number): number {
  return Math.floor(Number(airingAtSeconds) * 1000) + AIRING_REMINDER_DELAY_MS;
}

export function parseAiringReminderRecords(raw: string | null): AiringReminderRecord[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const records: AiringReminderRecord[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Partial<AiringReminderRecord>;
      const animeId = Number(record.animeId);
      const episode = Number(record.episode);
      const fireAt = Number(record.fireAt);
      if (typeof record.identifier !== "string" || !record.identifier.startsWith(AIRING_REMINDER_IDENTIFIER_PREFIX)) continue;
      if (!Number.isInteger(animeId) || animeId <= 0) continue;
      if (!Number.isInteger(episode) || episode <= 0) continue;
      if (!Number.isFinite(fireAt) || fireAt <= 0) continue;
      records.push({ identifier: record.identifier, animeId, episode, fireAt });
    }
    return records;
  } catch {
    // Corrupted storage → reschedule from scratch next sync.
    return [];
  }
}

export function serializeAiringReminderRecords(records: readonly AiringReminderRecord[]): string {
  return JSON.stringify(records);
}

/**
 * Builds a reminder candidate from batched AniList metadata, or null when the
 * title has no verified upcoming airing time (finished, on break, unknown).
 */
export function candidateFromAnime(anime: {
  id: number;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
  nextAiringEpisode?: { episode?: number | null; airingAt?: number | null } | null;
}): AiringReminderCandidate | null {
  const animeId = Number(anime.id);
  const next = anime.nextAiringEpisode;
  const episode = Number(next?.episode);
  const airingAt = Number(next?.airingAt);
  if (!Number.isInteger(animeId) || animeId <= 0) return null;
  if (!next || !Number.isInteger(episode) || episode <= 0) return null;
  if (!Number.isFinite(airingAt) || airingAt <= 0) return null;
  const title = anime.title?.english || anime.title?.romaji || anime.title?.native || "Your saved anime";
  return { animeId, title, episode, airingAt };
}

/**
 * Reconciles what SHOULD be scheduled (desired) against what this device has
 * scheduled (managed):
 *  - future + desired + managed → keep (no native churn)
 *  - future + desired + not managed + not already notified → schedule
 *  - managed + not desired → cancel; if still in the future it never fired, so
 *    its episode dedupe key is released too (re-adding the title can re-notify)
 *  - managed + fireAt in the past → it already fired → just prune the record
 *    (the dedupe key stays; the notification was delivered)
 */
export function pickAiringReminders(options: {
  now: number;
  desired: readonly AiringReminderCandidate[];
  managed: readonly AiringReminderRecord[];
  alreadyNotified: ReadonlySet<string>;
}): AiringReminderPick {
  const { now, desired, managed, alreadyNotified } = options;
  const desiredIdentifiers = new Set<string>();
  for (const candidate of desired) {
    desiredIdentifiers.add(airingReminderIdentifier(candidate.animeId, candidate.episode));
  }

  const managedIdentifiers = new Set<string>();
  const toKeep: AiringReminderRecord[] = [];
  const toCancel: AiringReminderRecord[] = [];
  const clearKeys: AiringReminderRecord[] = [];

  for (const record of managed) {
    if (managedIdentifiers.has(record.identifier)) continue; // persist dupes collapse
    managedIdentifiers.add(record.identifier);
    if (record.fireAt <= now) continue; // fired → prune, keep its dedupe key
    if (desiredIdentifiers.has(record.identifier)) {
      toKeep.push(record);
      continue;
    }
    toCancel.push(record);
    clearKeys.push(record);
  }

  const toSchedule: AiringReminderCandidate[] = [];
  for (const candidate of desired) {
    const fireAt = airingReminderFireAt(candidate.airingAt);
    if (fireAt <= now) continue; // already airing/airing-imminently — too late
    if (fireAt > now + AIRING_REMINDER_HORIZON_MS) continue; // beyond horizon
    const identifier = airingReminderIdentifier(candidate.animeId, candidate.episode);
    if (managedIdentifiers.has(identifier)) continue;
    if (alreadyNotified.has(episodeNotificationKey(candidate.animeId, candidate.episode))) continue;
    toSchedule.push(candidate);
  }

  return { toSchedule, toKeep, toCancel, clearKeys };
}
