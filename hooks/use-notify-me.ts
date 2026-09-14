import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "aniraku.notify-me.v1";

export function useNotifyMe(animeId: number) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      try {
        const map = raw ? JSON.parse(raw) : {};
        setEnabled(Boolean(map[String(animeId)]));
      } catch {
        setEnabled(false);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [animeId]);

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (next) {
        map[String(animeId)] = true;
      } else {
        delete map[String(animeId)];
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }, [animeId, enabled]);

  return { enabled, loaded, toggle };
}
