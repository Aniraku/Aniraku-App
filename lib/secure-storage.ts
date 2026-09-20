import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const webFallback = {
  // sessionStorage (not localStorage): the token lives only for the tab
  // lifetime, narrowing the XSS exfiltration window on web. Native still
  // uses expo-secure-store (Keychain/Keystore). Long-lived web sessions
  // should move to httpOnly cookies via the backend.
  getItem: (key: string) => {
    try {
      return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Private-mode quota errors must not break guest browsing.
    }
  },
  removeItem: (key: string) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // The session will be treated as absent on the next initialization.
    }
  },
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
