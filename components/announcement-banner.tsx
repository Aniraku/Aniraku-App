import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import {
  fetchAnnouncements,
  selectBannerAnnouncement,
  shouldShowAnnouncement,
  type Announcement,
} from "@/lib/announcements";

// Session-scoped dismissal: this Set lives for one app run (module state), so a
// close hides the banner until the app is reopened — never persisted to disk.
const dismissedThisSession = new Set<string>();

/**
 * Remote-driven donation/announcement prompt. Reads site/announcements.json from
 * GitHub (independent of the streaming backend) so announcements can be posted
 * and updated without a new Android release. It appears every time the app opens
 * and is dismissible for the current session only. Renders nothing offline.
 */
export function AnnouncementBanner() {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchAnnouncements();
        const banner = selectBannerAnnouncement(list);
        if (!banner || cancelled) return;
        const dismissedId = dismissedThisSession.has(banner.id) ? banner.id : null;
        if (shouldShowAnnouncement({ announcement: banner, dismissedId })) {
          setAnnouncement(banner);
          setVisible(true);
        }
      } catch {
        // Offline or GitHub unreachable — no banner. That's fine.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 9, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible, scale, opacity]);

  const close = (remember: boolean) => {
    if (remember && announcement) {
      dismissedThisSession.add(announcement.id);
    }
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const donate = () => {
    const target = announcement?.ctaApp || "/support";
    close(true);
    router.push(target as never);
  };

  const email = () => {
    if (!announcement?.email) return;
    close(true);
    void Linking.openURL(`mailto:${announcement.email}`).catch(() => {});
  };

  if (!visible || !announcement) return null;

  const { width: SCREEN_W } = Dimensions.get("window");

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close(true)} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={styles.backdropPress} onPress={() => close(true)} />
        <Animated.View style={[styles.card, { width: Math.min(SCREEN_W - 48, 380), transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <AppIcon name="heart-outline" size={26} color={nothing.red} />
          </View>
          {!!announcement.tag && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{announcement.tag}</Text>
            </View>
          )}
          <Text style={styles.title}>{announcement.title}</Text>
          {!!announcement.banner && <Text style={styles.body}>{announcement.banner}</Text>}
          <View style={styles.divider} />
          <Pressable onPress={donate} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>{(announcement.ctaLabel || "Donate now").toUpperCase()} →</Text>
          </Pressable>
          {!!announcement.email && (
            <Pressable onPress={email} style={({ pressed }) => [styles.emailBtn, pressed && styles.pressed]}>
              <Text style={styles.emailText}>{(announcement.emailLabel || "Email us").toUpperCase()} →</Text>
            </Pressable>
          )}
          <Pressable onPress={() => close(true)} hitSlop={8} style={styles.later}>
            <Text style={styles.laterText}>MAYBE LATER</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: "#1a1a18",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.28)",
    padding: 26,
    gap: 12,
    elevation: 16,
    shadowColor: "#FF4D4D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "rgba(255,77,77,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: nothing.red,
  },
  tagText: {
    color: nothing.black,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: nothing.white,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 25,
  },
  body: {
    color: nothing.muted,
    fontSize: 13.5,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: nothing.line,
    marginVertical: 2,
  },
  button: {
    marginTop: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: nothing.white,
    alignItems: "center",
  },
  buttonText: {
    color: nothing.black,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  emailBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: nothing.line,
    alignItems: "center",
  },
  emailText: {
    color: nothing.green,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  later: {
    alignItems: "center",
    paddingVertical: 6,
  },
  laterText: {
    color: nothing.dim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  pressed: nothing.pressedSubtle,
});
