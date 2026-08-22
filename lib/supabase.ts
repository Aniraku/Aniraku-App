import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { APP_CONFIG, requirePublicConfig } from "@/lib/app-config";
import { secureStorage } from "@/lib/secure-storage";

const supabaseUrl = requirePublicConfig(APP_CONFIG.supabaseUrl, "EXPO_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = requirePublicConfig(APP_CONFIG.supabaseAnonKey, "EXPO_PUBLIC_SUPABASE_ANON_KEY");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
    flowType: "pkce",
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
