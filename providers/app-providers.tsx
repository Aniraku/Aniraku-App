import { useEffect, useState, type PropsWithChildren } from "react";
import * as Network from "expo-network";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/providers/auth-provider";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Anime metadata changes slowly; keep it warm between tab switches
        // without refetching every time a screen remounts.
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: { retry: 1 },
    },
  }));
  useEffect(() => {
    let mounted = true;
    void Network.getNetworkStateAsync()
      .then((state) => { if (mounted) onlineManager.setOnline(state.isInternetReachable ?? state.isConnected ?? true); })
      .catch(() => { if (mounted) onlineManager.setOnline(true); });
    let subscription: ReturnType<typeof Network.addNetworkStateListener> | undefined;
    try {
      subscription = Network.addNetworkStateListener((state) => onlineManager.setOnline(state.isInternetReachable ?? state.isConnected ?? true));
    } catch {
      onlineManager.setOnline(true);
    }
    return () => { mounted = false; subscription?.remove(); };
  }, []);
  return <QueryClientProvider client={queryClient}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
