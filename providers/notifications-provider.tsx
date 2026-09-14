import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  EPISODE_NOTIFICATION_STORAGE_KEY,
  buildEpisodeNotificationContent,
  parseScheduledEpisodeKeys,
  shouldScheduleEpisodeNotification,
  withScheduledEpisodeKey,
  type EpisodeNotificationInput,
} from "@/lib/episode-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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

  return <>{children}</>;
}

async function notificationPrefsAllowNewEpisodes(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem("aniraku.notificationprefs");
    if (!raw) return true;
    return (JSON.parse(raw) as { newEpisodes?: boolean }).newEpisodes ?? true;
  } catch {
    return true;
  }
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
