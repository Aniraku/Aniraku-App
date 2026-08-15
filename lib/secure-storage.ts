import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const webFallback = {
  getItem: (key: string) => (typeof localStorage === "undefined" ? null : localStorage.getItem(key)),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return webFallback.getItem(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      webFallback.setItem(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // A persistence failure must not prevent playback or guest browsing.
    }
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      webFallback.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // The session will be treated as absent on the next initialization.
    }
  },
};
