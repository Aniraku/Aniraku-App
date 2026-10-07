import { useCallback, useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  AIRING_REMINDER_MANAGED_KEY,
  NOTIFY_ME_CHANGED_EVENT,
  candidateFromAnime,
  parseAiringReminderRecords,
  pickAiringReminders,
  serializeAiringReminderRecords,
  type AiringReminderRecord,
} from "@/lib/airing-reminders";
import {
  EPISODE_NOTIFICATION_STORAGE_KEY,
  episodeNotificationKey,
  parseScheduledEpisodeKeys,
  withoutScheduledEpisodeKeys,
} from "@/lib/episode-notifications";
import { getAnimeByIds } from "@/lib/anilist";
import {
  NOTIFICATION_PREFS_CHANGED_EVENT,
  cancelAiringReminders,
  readNotificationPrefs,
  scheduleAiringReminder,
} from "@/providers/notifications-provider";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

const NOTIFY_ME_KEY = "aniraku.notify-me.v1";
const SYNC_INTERVAL_MS = 6 * 60 * 60_000;

async function getNotifyMeAnimeIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFY_ME_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw);
    if (!map || typeof map !== "object") return [];
    return Object.keys(map).map(Number).filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

async function releaseReminderKeys(records: readonly AiringReminderRecord[]): Promise<void> {
  if (!records.length) return;
  const raw = await AsyncStorage.getItem(EPISODE_NOTIFICATION_STORAGE_KEY).catch(() => null);
  const keys = records.map((record) => episodeNotificationKey(record.animeId, record.episode));
  const released = withoutScheduledEpisodeKeys(parseScheduledEpisodeKeys(raw), keys);
  await AsyncStorage.setItem(EPISODE_NOTIFICATION_STORAGE_KEY, JSON.stringify(released)).catch(() => {});
}

/**
 * Keyless closed-app episode reminders. Nothing here talks to a push service:
 * each upcoming airing time becomes a LOCAL scheduled notification that
 * Android fires even when Aniraku is closed (J1+J2). The schedule is re-topped
 * on launch, foreground, notify-me/bell/pref changes, and every 6 hours —
 * reminders can only reach as far ahead as the last time the app was opened.
 */
export function AiringReminderScheduler() {
  const { user } = useAnirakuAuth();
  const runningRef = useRef(false);

  const disarm = useCallback(async (managed: readonly AiringReminderRecord[]) => {
    if (!managed.length) {
      await AsyncStorage.removeItem(AIRING_REMINDER_MANAGED_KEY).catch(() => {});
      return;
    }
    await cancelAiringReminders(managed.map((record) => record.identifier));
    // Cancelled-before-firing reminders must give their dedupe keys back, or
    // re-enabling notifications later could never re-notify those episodes.
    await releaseReminderKeys(managed.filter((record) => record.fireAt > Date.now()));
    await AsyncStorage.removeItem(AIRING_REMINDER_MANAGED_KEY).catch(() => {});
  }, []);

  const syncReminders = useCallback(async () => {
    if (Platform.OS === "web" || runningRef.current) return;
    runningRef.current = true;
    try {
      const managed = parseAiringReminderRecords(
        await AsyncStorage.getItem(AIRING_REMINDER_MANAGED_KEY).catch(() => null),
      );

      const prefs = await readNotificationPrefs().catch(() => null);
      const notifyMeIds = await getNotifyMeAnimeIds();

      let bookmarkIds: number[] = [];
      if (user) {
        const { data, error } = await supabase.from("bookmarks").select("anime_id").eq("user_id", user.id);
        // Transient backend failure: keep the existing schedule instead of
        // destructively cancelling reminders we cannot reason about.
        if (error) return;
        bookmarkIds = (data ?? [])
          .map((row: { anime_id?: unknown }) => Number(row.anime_id))
          .filter((id: number) => Number.isInteger(id) && id > 0);
      }

      const ids = [...new Set([...notifyMeIds, ...bookmarkIds])];
      // prefs === null (unreadable) behaves as enabled, matching the repo-wide
      // "missing = default-on" rule — only an explicit opt-out disarms.
      if (!ids.length || prefs?.newEpisodes === false) {
        await disarm(managed);
        return;
      }
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await disarm(managed);
        return;
      }

      let anime;
      try {
        anime = await getAnimeByIds(ids);
      } catch {
        return; // Mirror unreachable: keep whatever is already scheduled.
      }

      const desired = anime
        .map(candidateFromAnime)
        .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
      const alreadyNotified = parseScheduledEpisodeKeys(
        await AsyncStorage.getItem(EPISODE_NOTIFICATION_STORAGE_KEY).catch(() => null),
      );
      const pick = pickAiringReminders({ now: Date.now(), desired, managed, alreadyNotified });

      if (pick.toCancel.length) {
        await cancelAiringReminders(pick.toCancel.map((record) => record.identifier));
      }
      await releaseReminderKeys(pick.clearKeys);

      const created: AiringReminderRecord[] = [];
      for (const candidate of pick.toSchedule) {
        const record = await scheduleAiringReminder(candidate);
        if (record) created.push(record);
      }
      await AsyncStorage.setItem(
        AIRING_REMINDER_MANAGED_KEY,
        serializeAiringReminderRecords([...pick.toKeep, ...created]),
      ).catch(() => {});
    } finally {
      runningRef.current = false;
    }
  }, [disarm, user]);

  useEffect(() => {
    void syncReminders();
    // First-ever launch requests notification permission on mount — re-sync
    // twice afterwards so reminders land without waiting for the next
    // foreground. AniList responses are cached 5 min, so these are near-free.
    const kickoff = [setTimeout(() => void syncReminders(), 15_000), setTimeout(() => void syncReminders(), 90_000)];
    const interval = setInterval(() => void syncReminders(), SYNC_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncReminders();
    });
    const notifyMeSubscription = DeviceEventEmitter.addListener(NOTIFY_ME_CHANGED_EVENT, () => void syncReminders());
    const prefsSubscription = DeviceEventEmitter.addListener(NOTIFICATION_PREFS_CHANGED_EVENT, () => void syncReminders());
    return () => {
      kickoff.forEach(clearTimeout);
      clearInterval(interval);
      appStateSubscription.remove();
      notifyMeSubscription.remove();
      prefsSubscription.remove();
    };
  }, [syncReminders]);

  return null;
}
