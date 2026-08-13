import { supabase } from "@/lib/supabase";

export async function deleteCurrentAccount() {
  const { data, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>("delete-account", { method: "POST" });
  if (error || !data?.deleted) throw new Error(data?.error || error?.message || "Account deletion could not be completed.");
  await supabase.auth.signOut({ scope: "local" });
}
