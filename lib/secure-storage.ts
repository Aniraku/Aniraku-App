import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const webFallback = {
  getItem: (key: string) => (typeof localStorage === "undefined" ? null : localStorage.getItem(key)),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export const secureStorage = {
  async getItem(key: string) {
    return Platform.OS === "web" ? webFallback.getItem(key) : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      webFallback.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      webFallback.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
