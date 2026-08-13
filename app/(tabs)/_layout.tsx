import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

const tabIcons = {
  index: "home-variant-outline",
  catalog: "view-grid-outline",
  schedule: "calendar-blank-outline",
  random: "shuffle-variant",
  profile: "account-circle-outline",
} as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 10);
  return (
    <Tabs
      screenOptions={({ route }) => {
        const name = route.name as keyof typeof tabIcons;
        const icon = tabIcons[name] ?? "circle-outline";
        return {
          headerShown: false,
          tabBarActiveTintColor: nothing.white,
          tabBarInactiveTintColor: nothing.dim,
          tabBarLabelStyle: { fontFamily: "monospace", fontSize: 9, fontWeight: "800", letterSpacing: 0.4, marginTop: 2 },
          tabBarStyle: { height: 64 + bottom, paddingTop: 8, paddingBottom: bottom, backgroundColor: nothing.black, borderTopColor: nothing.line, borderTopWidth: 1 },
          tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2 },
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <AppIcon name={icon} size={23} color={color} style={{ opacity: focused ? 1 : 0.86 }} />,
        };
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="catalog" options={{ title: "Catalog" }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule" }} />
      <Tabs.Screen name="random" options={{ title: "Random" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
