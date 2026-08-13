import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";

export function NativeScreen({ children, scroll = true, style }: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  const content = scroll ? <ScrollView contentContainerStyle={[styles.scroll, style]} showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[styles.fill, style]}>{children}</View>;
  return <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>{content}</SafeAreaView>;
}

export function NativeHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <View style={styles.header}><View style={styles.headerText}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.headerTitle}>{title}</Text></View>{action}</View>;
}

export function SearchAction() {
  return <Pressable accessibilityRole="button" accessibilityLabel="Search anime" onPress={() => router.push("/search" as never)} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}><AppIcon name="magnify" color={nothing.white} size={22} /></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: nothing.black },
  scroll: { paddingHorizontal: 18, paddingBottom: 112, gap: 24 },
  fill: { flex: 1 },
  header: { minHeight: 72, paddingTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerText: { gap: 3 },
  eyebrow: { color: nothing.muted, fontFamily: "monospace", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  headerTitle: { color: nothing.white, fontSize: 28, fontWeight: "900", letterSpacing: -0.6 },
  searchButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.surface },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
