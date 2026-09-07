import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { nothing } from "@/components/nothing-ui";
import { APP_CONFIG } from "@/lib/app-config";

const DISMISS_KEY = "anilist-down-dismissed";

let lastCheckAt = 0;
const CHECK_INTERVAL_MS = 5 * 60_000;

export function AniListDownBanner() {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!APP_CONFIG.anilistGraphqlUrl) return;
    checkAniList();
    const interval = setInterval(checkAniList, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const checkAniList = async () => {
    const now = Date.now();
    if (now - lastCheckAt < CHECK_INTERVAL_MS) return;
    lastCheckAt = now;

    try {
      setChecking(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(APP_CONFIG.anilistGraphqlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: "{ __typename }" }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const text = await res.text();
      const isDown =
        res.status === 403 && /temporarily disabled|severe stability/i.test(text) ||
        !res.ok && /temporarily disabled|severe stability/i.test(text);

      if (isDown) {
        setVisible(true);
      }
    } catch {
      // Network error — don't show banner, could be user's connection
    } finally {
      setChecking(false);
    }
  };

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const show = () => {
    setVisible(true);
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 9, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (visible) show();
  }, [visible]);

  if (!visible) return null;

  const { width: SCREEN_W } = Dimensions.get("window");

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={styles.backdropPress} onPress={dismiss} />
        <Animated.View style={[styles.card, { width: Math.min(SCREEN_W - 48, 380), transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-offline-outline" size={28} color={nothing.red} />
          </View>
          <Text style={styles.title}>Streaming temporarily limited</Text>
          <Text style={styles.body}>
            {"AniList's API is currently down, which affects anime streaming. Browsing and discovery work normally via MyAnimeList.\n\nYour account, watch history, and saved data are all safe. Streaming will resume once AniList is back."}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.hint}>No action needed. This banner will clear itself once AniList responds.</Text>
          <Pressable onPress={dismiss} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>GOT IT</Text>
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.25)",
    padding: 28,
    gap: 14,
    elevation: 16,
    shadowColor: "#FF4D4D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,77,77,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: nothing.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 24,
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
  hint: {
    color: nothing.dim,
    fontSize: 11,
    lineHeight: 15,
    fontStyle: "italic",
  },
  button: {
    marginTop: 4,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: nothing.white,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: nothing.black,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
});
