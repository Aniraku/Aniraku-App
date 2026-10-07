import { useEffect, useRef } from "react";
import { DeviceEventEmitter, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  airingReminderFireAt,
  airingReminderIdentifier,
  type AiringReminderCandidate,
  type AiringReminderRecord,
} from "@/lib/airing-reminders";
import {
  EPISODE_NOTIFICATION_STORAGE_KEY,
  buildEpisodeNotificationContent,
  parseScheduledEpisodeKeys,
  shouldScheduleEpisodeNotification,
  withScheduledEpisodeKey,
  type EpisodeNotificationInput,
} from "@/lib/episode-notifications";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

export type NotificationPrefs = {
  newEpisodes: boolean;
  commentReplies: boolean;
  systemAnnouncements: boolean;
};

const NOTIFICATION_PREFS_STORAGE_KEY = "aniraku.notificationprefs";
const NOTIFICATION_PREFS_CHANGED_EVENT = "aniraku.notification-prefs-changed";
export { NOTIFICATION_PREFS_CHANGED_EVENT };

/** Missing/corrupt prefs always behave as if everything is enabled. */
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { newEpisodes: true, commentReplies: true, systemAnnouncements: true };

// `type` hints for the two Settings toggles beyond `newEpisodes` (which gates
// local episode alerts). Unknown types are never suppressed.
const COMMENT_REPLY_TYPE_HINTS = ["reply", "comment_reply", "comment-reply"];
const SYSTEM_ANNOUNCEMENT_TYPE_HINTS = ["announce", "system", "maintenance", "notice"];

export async function readNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs> | null;
    return {
      newEpisodes: parsed?.newEpisodes ?? true,
      commentReplies: parsed?.commentReplies ?? true,
      systemAnnouncements: parsed?.systemAnnouncements ?? true,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

/** Settings calls this right after persisting `aniraku.notificationprefs`. */
export function emitNotificationPrefsChanged() {
  DeviceEventEmitter.emit(NOTIFICATION_PREFS_CHANGED_EVENT);
}

function isSuppressedNotificationType(type: unknown, prefs: NotificationPrefs): boolean {
  if (typeof type !== "string" || !type) return false;
  const value = type.toLowerCase();
  if (!prefs.commentReplies && COMMENT_REPLY_TYPE_HINTS.some((hint) => value.includes(hint))) return true;
  if (!prefs.systemAnnouncements && SYSTEM_ANNOUNCEMENT_TYPE_HINTS.some((hint) => value.includes(hint))) return true;
  return false;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Settings → Notifications: suppressed categories arrive silently.
    let suppressed = false;
    try {
      const prefs = await readNotificationPrefs();
      suppressed = isSuppressedNotificationType(
        (notification.request?.content?.data as { type?: unknown } | undefined)?.type,
        prefs,
      );
    } catch {
      // Unreadable prefs → fall back to showing the notification.
    }
    return {
      shouldShowAlert: !suppressed,
      shouldPlaySound: !suppressed,
      shouldSetBadge: false,
      shouldShowBanner: !suppressed,
      shouldShowList: !suppressed,
    };
  },
});

async function registerForPushNotifications() {
  if (Platform.OS === "web") return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: "e96fc02e-d968-4f13-a688-0d553d855df7" });
  return token.data;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Push listeners are native-only: on web they warn and do nothing.
    if (Platform.OS === "web") return;
    registerForPushNotifications().catch(() => {});

    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.animeId) {
        router.push({ pathname: "/anime/[id]", params: { id: String(data.animeId) } } as never);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  // Settings → "Comment Replies" / "System Announcements": rows of suppressed
  // types are auto-marked read so they never badge the inbox or show up under
  // its Unread filter. Runs on mount, whenever Settings flips a pref, and for
  // rows that arrive live over realtime.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const instanceId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const notificationsQueryKey = ["notifications", userId];

    const sweepSuppressedUnread = async () => {
      try {
        const prefs = await readNotificationPrefs();
        if (cancelled || (prefs.commentReplies && prefs.systemAnnouncements)) return;
        const { data, error } = await supabase
          .from("notifications")
          .select("id, type, read")
          .eq("user_id", userId)
          .eq("read", false)
          .limit(50);
        if (cancelled || error) return;
        const ids = (data ?? [])
          .filter((row: { id?: unknown; type?: unknown; read?: unknown }) => !row.read && isSuppressedNotificationType(row.type, prefs))
          .map((row: { id?: unknown }) => row.id)
          .filter((id: unknown) => typeof id === "string" || typeof id === "number");
        if (!ids.length || cancelled) return;
        const { error: updateError } = await supabase.from("notifications").update({ read: true }).in("id", ids);
        if (updateError || cancelled) return;
        void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      } catch {
        // Suppression is best-effort; the inbox still works without it.
      }
    };

    void sweepSuppressedUnread();
    const prefsSubscription = DeviceEventEmitter.addListener(NOTIFICATION_PREFS_CHANGED_EVENT, () => {
      void sweepSuppressedUnread();
    });

    try {
      channel = supabase
        .channel(`notification-prefs:${userId}:${instanceId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as { id?: unknown; type?: unknown; read?: unknown } | null;
            if (!row?.id || row.read === true) return;
            void (async () => {
              try {
                const prefs = await readNotificationPrefs();
                if (cancelled || !isSuppressedNotificationType(row.type, prefs)) return;
                const { error } = await supabase.from("notifications").update({ read: true }).eq("id", row.id as string);
                if (error || cancelled) return;
                void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
              } catch {
                // Best-effort only.
              }
            })();
          }
        )
        .subscribe();
    } catch {
      // Realtime is best-effort; the mount/pref sweeps still apply.
      channel = null;
    }

    return () => {
      cancelled = true;
      prefsSubscription.remove();
      if (channel) void supabase.removeChannel(channel).catch(() => {});
    };
  }, [user?.id, queryClient]);

  return <>{children}</>;
}

async function notificationPrefsAllowNewEpisodes(): Promise<boolean> {
  return (await readNotificationPrefs()).newEpisodes;
}

/**
 * Local-only new-episode notification. Permission-guarded (never prompts from
 * the background) and deduped to one notification per episode.
 */
export async function scheduleEpisodeNotification(animeId: number, title: string, episode: number) {
  return scheduleNewEpisodeNotification({ animeId, title, episode });
}

export async function scheduleNewEpisodeNotification(input: EpisodeNotificationInput): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!Number.isInteger(input.animeId) || input.animeId <= 0) return false;
  if (!Number.isInteger(input.episode) || input.episode <= 0) return false;
  if (!(await notificationPrefsAllowNewEpisodes())) return false;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return false;
  const scheduled = parseScheduledEpisodeKeys(
    await AsyncStorage.getItem(EPISODE_NOTIFICATION_STORAGE_KEY).catch(() => null),
  );
  if (!shouldScheduleEpisodeNotification(scheduled, input.animeId, input.episode)) return false;
  const content = buildEpisodeNotificationContent(input);
  await Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body, data: content.data },
    trigger: null,
  });
  await AsyncStorage.setItem(
    EPISODE_NOTIFICATION_STORAGE_KEY,
    JSON.stringify(withScheduledEpisodeKey(scheduled, input.animeId, input.episode)),
  ).catch(() => {});
  return true;
}

/**
 * Schedules a FUTURE local notification for an episode's airing time — this is
 * the keyless "push while closed" path: Android's AlarmManager fires it with
 * the app not running. Same guards as the immediate scheduler (prefs +
 * permission + per-episode dedupe), plus the episode key is written up front
 * so the live foreground monitor never double-notifies the same episode.
 * Returns the managed record on success, null when skipped.
 */
export async function scheduleAiringReminder(input: AiringReminderCandidate): Promise<AiringReminderRecord | null> {
  if (Platform.OS === "web") return null;
  if (!Number.isInteger(input.animeId) || input.animeId <= 0) return null;
  if (!Number.isInteger(input.episode) || input.episode <= 0) return null;
  const fireAt = Number.isFinite(input.airingAt) && input.airingAt > 0
    ? airingReminderFireAt(input.airingAt)
    : Number.NaN;
  if (!Number.isFinite(fireAt) || fireAt <= Date.now() + 5_000) return null;
  if (!(await notificationPrefsAllowNewEpisodes())) return null;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return null;
  const scheduled = parseScheduledEpisodeKeys(
    await AsyncStorage.getItem(EPISODE_NOTIFICATION_STORAGE_KEY).catch(() => null),
  );
  if (!shouldScheduleEpisodeNotification(scheduled, input.animeId, input.episode)) return null;
  const identifier = airingReminderIdentifier(input.animeId, input.episode);
  const content = buildEpisodeNotificationContent({
    animeId: input.animeId,
    title: input.title,
    episode: input.episode,
  });
  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: content.title, body: content.body, data: content.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  } catch {
    return null;
  }
  await AsyncStorage.setItem(
    EPISODE_NOTIFICATION_STORAGE_KEY,
    JSON.stringify(withScheduledEpisodeKey(scheduled, input.animeId, input.episode)),
  ).catch(() => {});
  return { identifier, animeId: input.animeId, episode: input.episode, fireAt };
}

/** Cancels tracked reminders by identifier. Best-effort: already-fired ids no-op. */
export async function cancelAiringReminders(identifiers: readonly string[]): Promise<void> {
  if (Platform.OS === "web" || !identifiers.length) return;
  await Promise.allSettled(
    identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)),
  );
}
