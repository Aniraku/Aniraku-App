import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/providers/app-providers";
import { nothing } from "@/components/nothing-ui";
import { ConnectivitySignal } from "@/components/connectivity-signal";
import { AppUpdatePrompt } from "@/components/app-update-prompt";
import { SupportPrompt } from "@/components/support-prompt";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Caveat-Bold": require("../assets/fonts/Caveat-Bold.ttf"),
    "Caveat-Medium": require("../assets/fonts/Caveat-Medium.ttf"),
    "Caveat-Regular": require("../assets/fonts/Caveat-Regular.ttf"),
    "Caveat-SemiBold": require("../assets/fonts/Caveat-SemiBold.ttf"),
    "HennyPenny-Regular": require("../assets/fonts/HennyPenny-Regular.ttf"),
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(nothing.black).catch(() => {});
  }, []);

  if (!fontsLoaded) {
    return <GestureHandlerRootView style={{ flex: 1, backgroundColor: nothing.black }}><StatusBar style="light" translucent backgroundColor="transparent" /><View style={{ flex: 1, backgroundColor: nothing.black }} /></GestureHandlerRootView>;
  }

  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: nothing.black }}><SafeAreaProvider><AppProviders><StatusBar style="light" translucent backgroundColor="transparent" /><Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: nothing.black } }}><Stack.Screen name="(tabs)" /><Stack.Screen name="anime/[id]" /><Stack.Screen name="watch/[id]" /><Stack.Screen name="search" options={{ presentation: "card" }} /><Stack.Screen name="auth" options={{ presentation: "modal" }} /><Stack.Screen name="settings" options={{ presentation: "modal" }} /><Stack.Screen name="support" options={{ presentation: "modal" }} /><Stack.Screen name="library" /><Stack.Screen name="legal" options={{ presentation: "modal" }} /></Stack><ConnectivitySignal /><AppUpdatePrompt /><SupportPrompt /></AppProviders></SafeAreaProvider></GestureHandlerRootView>;
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <GestureHandlerRootView style={{ flex: 1, padding: 24, gap: 14, alignItems: "center", justifyContent: "center", backgroundColor: nothing.black }}><StatusBar style="light" /><Text style={{ color: nothing.red, fontFamily: "monospace", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>APPLICATION STATE</Text><Text style={{ color: nothing.white, fontSize: 22, fontWeight: "900", textAlign: "center" }}>Aniraku needs to restart this screen.</Text><Text style={{ color: nothing.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }}>{error.message || "An unexpected state occurred."}</Text><Pressable onPress={retry} style={{ minHeight: 48, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", backgroundColor: nothing.white, borderRadius: 14 }}><Text style={{ color: nothing.black, fontWeight: "900" }}>Retry</Text></Pressable></GestureHandlerRootView>;
}
