import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_DOWNLOAD_SETTINGS,
  getDownloadSettings,
  getFreeDiskSpace,
  getOfflineStorageUsage,
  saveDownloadSettings,
  type DownloadSettings,
} from "@/lib/downloads";

/**
 * Wi-Fi-only + storage-quota preferences (persisted under
 * `aniraku.download-settings.v1`) plus the usage numbers the Downloads screen
 * shows next to them.
 */
export function useDownloadSettings() {
  const [settings, setSettings] = useState<DownloadSettings>(DEFAULT_DOWNLOAD_SETTINGS);
  const [usedBytes, setUsedBytes] = useState(0);
  const [freeBytes, setFreeBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [next, usage] = await Promise.all([getDownloadSettings(), getOfflineStorageUsage()]);
    setSettings(next);
    setUsedBytes(usage);
    setFreeBytes(getFreeDiskSpace());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh().catch(() => { setLoading(false); });
  }, [refresh]);

  const update = useCallback(async (patch: Partial<DownloadSettings>) => {
    try {
      const next = await saveDownloadSettings(patch);
      setSettings(next);
      return next;
    } catch {
      return settings;
    }
  }, [settings]);

  const toggleWifiOnly = useCallback(() => void update({ wifiOnly: !settings.wifiOnly }), [settings.wifiOnly, update]);

  const setQuotaMb = useCallback((quotaMb: number) => void update({ quotaMb }), [update]);

  return { settings, usedBytes, freeBytes, loading, refresh, update, toggleWifiOnly, setQuotaMb };
}
