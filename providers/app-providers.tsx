import { useEffect, type PropsWithChildren } from "react";
import * as Network from "expo-network";
import { onlineManager, QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { AuthProvider } from "@/providers/auth-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: "always",
    },
    mutations: { retry: 1 },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    let mounted = true;

    // Initial network state check
    void Network.getNetworkStateAsync()
      .then((state) => { if (mounted) onlineManager.setOnline(state.isInternetReachable ?? state.isConnected ?? true); })
      .catch(() => { if (mounted) onlineManager.setOnline(true); });

    // Listen for network changes and refetch on reconnect. Deliberately NOT a
    // blanket refetchQueries({type:"active"}): that stampedes every mounted
    // screen at once and burns the temporary 30 req/min AniList budget. Only
    // genuinely stale data (or failed queries) gets refetched; fresh data is
    // left alone until its normal staleTime lapses.
    let subscription: ReturnType<typeof Network.addNetworkStateListener> | undefined;
    let wasOffline = false;
    try {
      subscription = Network.addNetworkStateListener((state) => {
        const isOnline = state.isInternetReachable ?? state.isConnected ?? true;
        onlineManager.setOnline(isOnline);
        if (isOnline && wasOffline) {
          void queryClient.refetchQueries({
            type: "active",
            predicate: (query) =>
              query.state.status === "error" ||
              (query.state.dataUpdatedAt > 0 && Date.now() - query.state.dataUpdatedAt > 5 * 60_000),
          });
        }
        wasOffline = !isOnline;
      });
    } catch {
      onlineManager.setOnline(true);
    }

    // Handle app focus state for React Query (mobile-specific): refetch stale
    // queries when the app returns to the foreground.
    if (Platform.OS !== "web") {
      focusManager.setEventListener((handleFocus) => {
        const subscription = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
        return () => subscription.remove();
      });
    }

    return () => { mounted = false; subscription?.remove(); };
  }, []);

  return <QueryClientProvider client={queryClient}><AuthProvider><NotificationsProvider><ThemeProvider>{children}</ThemeProvider></NotificationsProvider></AuthProvider></QueryClientProvider>;
}
