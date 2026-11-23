import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { AppUpdatePrompt } from "@/components/app-update-prompt";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { hapticSelection } from "@/lib/haptics";

const tabIcons = {
  index: "home",
  catalog: "magnify",
  schedule: "calendar",
  library: "bookmark",
  random: "dice",
  profile: "account",
} as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 10);
  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={({ route }) => {
          const name = route.name as keyof typeof tabIcons;
          const icon = tabIcons[name] ?? "circle-outline";
          return {
            headerShown: false,
            tabBarActiveTintColor: nothing.red,
            tabBarInactiveTintColor: nothing.dim,
            tabBarLabelStyle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.1, marginTop: 3 },
            tabBarStyle: { height: 66 + bottom, paddingTop: 8, paddingBottom: bottom, backgroundColor: nothing.black, borderTopColor: "#202020", borderTopWidth: 1 },
            tabBarItemStyle: { borderRadius: 0, marginHorizontal: 1 },
            tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <AppIcon name={icon} size={22} color={color} style={{ opacity: focused ? 1 : 0.62 }} />,
            tabBarOnPress: ({ defaultHandler }: { defaultHandler?: () => void }) => { hapticSelection(); defaultHandler?.(); },
          };
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="catalog" options={{ title: "Search" }} />
        <Tabs.Screen name="schedule" options={{ title: "Schedule" }} />
        <Tabs.Screen name="library" options={{ title: "Library" }} />
        <Tabs.Screen name="random" options={{ title: "Random" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
      {/* Slim, non-blocking notices — never modals, never on top of the player.
          Anchored above the tab bar so they never cover screen headers. */}
      <View pointerEvents="box-none" style={[styles.noticeRail, { bottom: 66 + bottom + 8 }]}>
        <AppUpdatePrompt />
        <AnnouncementBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  noticeRail: {
    position: "absolute",
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 60,
    elevation: 60,
  },
});
