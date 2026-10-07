import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  cancelDownloadJob,
  dismissDownloadJob,
  getDownloadQueue,
  listOfflineDownloads,
  pruneStaleDownloads,
  removeOfflineDownload,
  retryDownloadJob,
  subscribeDownloadQueue,
  type OfflineDownload,
  type OfflineDownloadJob,
} from "@/lib/downloads";

/** Live snapshot of the in-app download queue (queued/downloading/done/failed). */
export function useDownloadQueue(): OfflineDownloadJob[] {
  return useSyncExternalStore(subscribeDownloadQueue, getDownloadQueue, getDownloadQueue);
}

/**
 * Saved episodes list: prunes index rows whose files vanished outside the
 * app, then serves what is really on disk. Read errors degrade to an empty
 * list with a message instead of throwing into the screen's ErrorBoundary.
 */
export function useOfflineDownloads() {
  const [entries, setEntries] = useState<OfflineDownload[]>([]);
  const [removedCount, setRemovedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { kept, removed } = await pruneStaleDownloads();
      setEntries(Array.isArray(kept) ? kept : []);
      setRemovedCount(removed.length);
      setError(null);
    } catch {
      try {
        setEntries(await listOfflineDownloads());
        setError(null);
      } catch {
        setError("Saved downloads could not be read.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(async (entry: OfflineDownload) => {
    await removeOfflineDownload(entry);
    setEntries((current) => current.filter((item) => item.id !== entry.id));
  }, []);

  return { entries, removedCount, loading, error, refresh, remove };
}
