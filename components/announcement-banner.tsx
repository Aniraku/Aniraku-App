import { useEffect, useRef, useState } from "react";
import { Animated, InteractionManager, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import {
  ANNOUNCEMENT_DISMISS_KEY,
  fetchAnnouncements,
  selectBannerAnnouncement,
  shouldShowAnnouncement,
  type Announcement,
} from "@/lib/announcements";

// Same-run guard so a dismissal hides the banner immediately, before the
// AsyncStorage write settles.
const dismissedThisSession = new Set<string>();

/**
 * Minimal, non-blocking announcement bar. Reads site/announcements.json from
 * GitHub (independent of the streaming backend) so announcements can be posted
 * without a new Android release.
 *
 * Shown once per announcement id: closing it persists the dismissal, so the
 * same announcement never re-opens on later launches. A new announcement id
 * shows once more. Renders nothing offline.
 */
export function AnnouncementBanner() {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    // The GitHub round trip waits for first interactions to settle — startup
    // keeps its budget for the home feed and auth chain.
    const interaction = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const [stored, list] = await Promise.all([
            AsyncStorage.getItem(ANNOUNCEMENT_DISMISS_KEY).catch(() => null),
            fetchAnnouncements(),
          ]);
          const banner = selectBannerAnnouncement(list);
          if (!banner || cancelled) return;
          const dismissedId = dismissedThisSession.has(banner.id) ? banner.id : stored;
          if (shouldShowAnnouncement({ announcement: banner, dismissedId })) {
            setAnnouncement(banner);
            setVisible(true);
          }
        } catch {
          // Offline or GitHub unreachable — no banner. That's fine.
        }
      })();
    });
    return () => {
      cancelled = true;
      interaction.cancel();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [visible, enter]);

  const dismiss = () => {
    if (announcement) {
      dismissedThisSession.add(announcement.id);
      void AsyncStorage.setItem(ANNOUNCEMENT_DISMISS_KEY, announcement.id).catch(() => {});
    }
    setVisible(false);
  };

  const open = () => {
    if (!announcement) return;
    dismiss();
    if (announcement.ctaApp) {
      router.push(announcement.ctaApp as never);
    } else if (announcement.ctaWeb) {
      void Linking.openURL(announcement.ctaWeb).catch(() => {});
    }
  };

  if (!visible || !announcement) return null;

  const hasTarget = Boolean(announcement.ctaApp || announcement.ctaWeb);

  return (
    <Animated.View
      style={[
        styles.banner,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      <Pressable
        accessibilityRole={hasTarget ? "button" : undefined}
        disabled={!hasTarget}
        onPress={open}
        style={styles.body}
      >
        {!!announcement.tag && (
          <View style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={1}>{announcement.tag}</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>{announcement.title}</Text>
      </Pressable>
      {hasTarget ? <AppIcon name="chevron-right" size={16} color={nothing.dim} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss announcement" onPress={dismiss} hitSlop={10} style={styles.close}>
        <AppIcon name="close" size={14} color={nothing.muted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.28)",
    backgroundColor: "#171715",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: nothing.red,
  },
  tagText: {
    color: nothing.black,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: {
    flex: 1,
    color: nothing.white,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  close: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
