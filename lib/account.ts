import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

/** Device keys scoped to the signed-in account's viewing progress. */
const ACCOUNT_SCOPED_KEY_PREFIXES = ["aniraku-watch-local:"];

async function clearLocalAccountCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const scoped = keys.filter((key) => ACCOUNT_SCOPED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)));
    if (scoped.length) await AsyncStorage.multiRemove(scoped);
  } catch {
    // Best effort — server data is already gone; leftovers expire on next sync.
  }
}

export async function deleteCurrentAccount() {
  const { data, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>("delete-account", { method: "POST" });
  if (error || !data?.deleted) throw new Error(data?.error || error?.message || "Account deletion could not be completed.");
  await clearLocalAccountCaches();
  await supabase.auth.signOut({ scope: "local" });
}
