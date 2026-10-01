import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SyncProvider } from "@/components/provider-mark";
import { connectedProviders } from "@/lib/provider-sync-contract";
import {
  describeExport,
  describeImport,
  disconnectProvider,
  exportProviderLibrary,
  getExportJobs,
  getProviderAuthorizationUrl,
  getProviderSyncStatus,
  importProviderLibrary,
  pushProviderProgress,
  pushProviderScore,
  startExportJob,
  subscribeExportJobs,
  type ExportJobs,
} from "@/lib/provider-sync";
import { useAnirakuAuth } from "@/providers/auth-provider";

export function useProviderSync() {
  const { user, verified } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["provider-sync", user?.id];
  const status = useQuery({ queryKey, queryFn: getProviderSyncStatus, enabled: Boolean(user && verified), staleTime: 60_000, retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const authorize = useMutation({ mutationFn: (provider: SyncProvider) => getProviderAuthorizationUrl(provider) });
  const disconnect = useMutation({ mutationFn: disconnectProvider, onSuccess: refresh });
  const importLibrary = useMutation({
    mutationFn: importProviderLibrary,
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const exportLibrary = useMutation({
    mutationFn: exportProviderLibrary,
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  // Background export jobs (Miruro runner): progress renders in Settings,
  // terminal transitions invalidate library caches + the Alerts bell.
  const [exportJobs, setExportJobs] = useState<ExportJobs>(() => getExportJobs());
  const exportSeenRef = useRef<Record<string, string>>({});
  useEffect(
    () =>
      subscribeExportJobs((jobs) => {
        setExportJobs({ ...jobs });
        for (const [provider, job] of Object.entries(jobs)) {
          const prev = exportSeenRef.current[provider];
          exportSeenRef.current[provider] = job.status;
          if (prev !== "running") continue;
          if (job.status === "done" || job.status === "error") {
            refresh();
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );
  const startBackgroundExport = (provider: SyncProvider) => startExportJob(provider);
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
  return {
    status,
    refresh,
    authorize,
    disconnect,
    importLibrary,
    exportLibrary,
    exportJobs,
    startBackgroundExport,
    describeImport,
    describeExport,
    pushProgress,
    pushScore,
    connected: connectedProviders(status.data),
  };
}
