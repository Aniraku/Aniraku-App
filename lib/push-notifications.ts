/**
 * Push notifications via Expo's free push service (FCM on Android, APNs on iOS).
 * No self-hosting: Expo hosts the relay. Device tokens are stored in Supabase
 * push_tokens so the backend can push to users even when the app is closed.
 *
 * Usage:
 *   import { registerPushToken, unregisterPushTokens } from "@/lib/push-notifications";
 *
 *   // On app launch / sign-in (providers/notifications-provider):
 *   await registerPushToken(user.id);
 *
 *   // On sign-out — before the session dies:
 *   await unregisterPushTokens(user.id);
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { APP_CONFIG } from "@/lib/app-config";

/**
 * Register the device's Expo push token for the given user.
 * Idempotent: re-registration upserts on token conflict.
 * Returns the token string, or null if registration failed / not granted.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: APP_CONFIG.easProjectId,
    });
    const tokenData = token.data;
    if (!tokenData) return null;

    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token: tokenData, platform: Platform.OS },
        { onConflict: "token" },
      );

    if (error) {
      console.error("[push-notifications] token upsert failed:", error.message);
      return null;
    }

    return tokenData;
  } catch (error) {
    console.error("[push-notifications] registration failed:", error);
    return null;
  }
}

/** Remove all push tokens for a user (e.g. on sign-out / account deletion). */
export async function unregisterPushTokens(userId: string): Promise<void> {
  try {
    await supabase.from("push_tokens").delete().eq("user_id", userId);
  } catch {
    // best effort
  }
}
