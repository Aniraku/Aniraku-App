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
 * Ids of episodes with a completed offline copy (`animeId:episode:language`),
 * for static "Downloaded" badges on episode rows. One index read per mount;
 * queue completions are merged in live.
 */
export function useOfflineDownloadIds(): Set<string> {
  const queue = useDownloadQueue();
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;
    void listOfflineDownloads()
      .then((entries) => { if (alive) setIds(new Set(entries.map((entry) => entry.id))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const finished = queue.filter((job) => job.state === "done" && job.entry);
    if (!finished.length) return;
    setIds((current) => {
      const next = new Set(current);
      let changed = false;
      for (const job of finished) {
        if (!next.has(job.entry!.id)) { next.add(job.entry!.id); changed = true; }
      }
      return changed ? next : current;
    });
  }, [queue]);

  return ids;
}

/**
 * Saved episodes list: prunes index rows whose files vanished outside the
 * app, then serves what is really on disk. Read errors degrade to an empty
 * list with a message instead of throwing into the screen's ErrorBoundary.
 */
export function useOfflineDownloads() {
  const [entries, setEntries] = useState<OfflineDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { kept } = await pruneStaleDownloads();
      setEntries(Array.isArray(kept) ? kept : []);
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

  return { entries, loading, error, refresh, remove };
}
