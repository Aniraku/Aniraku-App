import { createContext, useContext, useState, useEffect, type PropsWithChildren } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";

export type ThemeMode = "dark" | "light" | "system";

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = "aniraku.theme.v1";

const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  isDark: true,
  setMode: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
    }).catch(() => {});
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const isDark = mode === "system" ? systemScheme !== "light" : mode === "dark";

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const lightColors = {
  background: "#FFFFFF",
  surface: "#F5F5F5",
  raised: "#E8E8E8",
  line: "#D0D0D0",
  text: "#1A1A1A",
  muted: "#666666",
  dim: "#999999",
  accent: "#FF4D4D",
  card: "#FFFFFF",
  cardBorder: "#E0E0E0",
};

export const darkColors = {
  background: "#090909",
  surface: "#141414",
  raised: "#1E1E1E",
  line: "rgba(246,246,242,0.12)",
  text: "#F6F6F2",
  muted: "#888888",
  dim: "#555555",
  accent: "#FF4D4D",
  card: "#141414",
  cardBorder: "rgba(246,246,242,0.12)",
};
