import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SyncProvider } from "@/components/provider-mark";
import { connectedProviders } from "@/lib/provider-sync-contract";
import { disconnectProvider, exportProviderLibrary, getProviderAuthorizationUrl, getProviderSyncStatus, importProviderLibrary, pushProviderProgress, pushProviderScore } from "@/lib/provider-sync";
import { useAnirakuAuth } from "@/providers/auth-provider";

export function useProviderSync() {
  const { user, verified } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["provider-sync", user?.id];
  const status = useQuery({ queryKey, queryFn: getProviderSyncStatus, enabled: Boolean(user && verified), staleTime: 60_000, retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const authorize = useMutation({ mutationFn: (provider: SyncProvider) => getProviderAuthorizationUrl(provider) });
  const disconnect = useMutation({ mutationFn: disconnectProvider, onSuccess: refresh });
  const importLibrary = useMutation({ mutationFn: importProviderLibrary, onSuccess: refresh });
  const exportLibrary = useMutation({ mutationFn: exportProviderLibrary, onSuccess: refresh });
  const pushProgress = useMutation({
    mutationFn: async (input: { animeId: number; episode: number; progress: number; status: "watching" | "completed" }) => {
      const providers = connectedProviders(status.data);
      await Promise.allSettled(providers.map((provider) => pushProviderProgress({ provider, ...input })));
      return providers;
    },
    retry: false,
  });
  const pushScore = useMutation({
    mutationFn: async (input: { animeId: number; score: number }) => {
      const providers = connectedProviders(status.data);
      await Promise.allSettled(providers.map((provider) => pushProviderScore({ provider, ...input })));
      return providers;
    },
    retry: false,
  });
  return { status, refresh, authorize, disconnect, importLibrary, exportLibrary, pushProgress, pushScore, connected: connectedProviders(status.data) };
}
