import { useEffect, useState, type PropsWithChildren } from "react";
import * as Network from "expo-network";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/providers/auth-provider";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 2, refetchOnReconnect: true },
      mutations: { retry: 1 },
    },
  }));
  useEffect(() => {
    let mounted = true;
    void Network.getNetworkStateAsync()
      .then((state) => { if (mounted) onlineManager.setOnline(state.isInternetReachable ?? state.isConnected ?? true); })
      .catch(() => { if (mounted) onlineManager.setOnline(true); });
    const subscription = Network.addNetworkStateListener((state) => onlineManager.setOnline(state.isInternetReachable ?? state.isConnected ?? true));
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return <QueryClientProvider client={queryClient}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
