import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import { listLocalWatchEntries } from "@/hooks/use-watch-history";
import { listOfflineDownloads } from "@/lib/downloads";

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

/**
 * One JSON file with everything Aniraku holds for this user: identity,
 * bookmarks, watch history, offline index, and device preferences. Session
 * tokens are deliberately excluded — an export must not leak credentials.
 */
export async function exportAccountData(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("aniraku"));
  const preferences: Record<string, unknown> = {};
  for (const [key, value] of await AsyncStorage.multiGet(keys)) {
    if (value == null) continue;
    try { preferences[key] = JSON.parse(value); } catch { preferences[key] = value; }
  }

  const bookmarks = user ? (await supabase.from("bookmarks").select("*").eq("user_id", user.id)).data ?? [] : [];
  const payload = {
    app: "Aniraku",
    exportedAt: new Date().toISOString(),
    account: user ? { id: user.id, email: user.email, createdAt: user.created_at, lastSignInAt: user.last_sign_in_at } : null,
    bookmarks,
    watchHistory: await listLocalWatchEntries(),
    offlineDownloads: (await listOfflineDownloads()).map(({ uri, ...rest }) => rest),
    preferences,
  };

  const directory = new Directory(Paths.document, "exports");
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, `aniraku-data-${new Date().toISOString().slice(0, 10)}.json`);
  file.write(JSON.stringify(payload, null, 2));
  return file.uri;
}

/** Writes the export, then hands the JSON file to the OS share sheet.
 *  False when no share target exists — the file is still in app storage. */
export async function shareAccountData(): Promise<boolean> {
  const uri = await exportAccountData();
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Aniraku data export" });
  return true;
}
