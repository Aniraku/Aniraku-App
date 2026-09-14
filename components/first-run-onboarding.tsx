import { useEffect, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { hapticLight } from "@/lib/haptics";

const ONBOARDING_KEY = "aniraku.onboarding.v1";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Page = {
  icon: string;
  title: string;
  description: string;
};

const PAGES: Page[] = [
  { icon: "play-circle-outline", title: "Watch freely", description: "Stream anime in HD with multiple servers. No ads, no subscriptions." },
  { icon: "bookmark-outline", title: "Track everything", description: "Sync with AniList to track your watch history, ratings, and favorites." },
  { icon: "cog-outline", title: "Make it yours", description: "Customize subtitles, quality, playback speed, and more." },
];

export function FirstRunOnboarding({ onComplete }: { onComplete: () => void }) {
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((seen) => {
      if (!seen) setVisible(true);
    });
  }, []);

  const finish = () => {
    hapticLight();
    AsyncStorage.setItem(ONBOARDING_KEY, "1").catch(() => {});
    setVisible(false);
    onComplete();
  };

  const next = () => {
    hapticLight();
    if (page < PAGES.length - 1) setPage(page + 1);
    else finish();
  };

  if (!visible) return null;
  const current = PAGES[page];

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <AppIcon name={current.icon} size={48} color={nothing.red} />
        </View>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.description}>{current.description}</Text>

        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.actions}>
          {page > 0 ? (
            <Pressable onPress={() => setPage(page - 1)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={next} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>{page < PAGES.length - 1 ? "Next" : "Get started"}</Text>
          </Pressable>
        </View>

        <Pressable onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", zIndex: 999 },
  card: { width: SCREEN_WIDTH - 48, alignItems: "center", gap: 20 },
  iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: nothing.surface, borderWidth: 1, borderColor: nothing.line, alignItems: "center", justifyContent: "center" },
  title: { color: nothing.white, fontSize: 26, fontWeight: "900", letterSpacing: -0.8, textAlign: "center" },
  description: { color: nothing.muted, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 300 },
  dots: { flexDirection: "row", gap: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: nothing.line },
  dotActive: { backgroundColor: nothing.red, width: 24 },
  actions: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 8 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: nothing.line },
  backBtnText: { color: nothing.white, fontSize: 14, fontWeight: "700" },
  nextBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: nothing.red },
  nextBtnText: { color: nothing.black, fontSize: 14, fontWeight: "800" },
  skipBtn: { marginTop: 4, padding: 8 },
  skipBtnText: { color: nothing.dim, fontSize: 12, fontWeight: "700" },
});
