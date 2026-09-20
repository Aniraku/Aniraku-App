import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://aniraku.tech",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/**
 * A table that was renamed or never created must not brick deletion forever.
 * PostgREST reports absent tables as PGRST205/42P01 (or a "not found" /
 * "does not exist" message) — those are skipped, while every real error
 * still aborts. Without this, one missing table fails EVERY attempt, the
 * auth record is never removed, and the user can never finish deleting.
 */
function isMissingTableError(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown } | null;
  const code = String(record?.code ?? "");
  const message = String(record?.message ?? error ?? "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

async function selectIds(
  admin: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string,
): Promise<Array<string | number>> {
  const { data, error } = await admin.from(table).select("id").eq(column, value);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => (row as { id: string | number }).id);
}

async function removeUserData(admin: ReturnType<typeof createClient>, userId: string) {
  const commentIds = await selectIds(admin, "comments", "user_id", userId);
  if (commentIds.length) {
    const replies = await admin.from("comments").update({ parent_id: null }).in("parent_id", commentIds);
    if (replies.error && !isMissingTableError(replies.error)) throw replies.error;
    const likes = await admin.from("comment_likes").delete().in("comment_id", commentIds);
    if (likes.error && !isMissingTableError(likes.error)) throw likes.error;
  }
  const groupIds = await selectIds(admin, "groups", "owner_id", userId);
  if (groupIds.length) {
    const members = await admin.from("group_members").delete().in("group_id", groupIds);
    if (members.error && !isMissingTableError(members.error)) throw members.error;
  }
  const requests = [
    admin.from("comment_likes").delete().eq("user_id", userId),
    admin.from("comments").delete().eq("user_id", userId),
    admin.from("group_members").delete().eq("user_id", userId),
    admin.from("groups").delete().eq("owner_id", userId),
    admin.from("notifications").delete().eq("user_id", userId),
    admin.from("activity").delete().eq("user_id", userId),
    admin.from("import_jobs").delete().eq("user_id", userId),
    admin.from("user_settings").delete().eq("user_id", userId),
    admin.from("favorites").delete().eq("user_id", userId),
    admin.from("anime_progress").delete().eq("user_id", userId),
    admin.from("manga_progress").delete().eq("user_id", userId),
    admin.from("episode_ratings").delete().eq("user_id", userId),
    admin.from("watch_history").delete().eq("user_id", userId),
    admin.from("bookmarks").delete().eq("user_id", userId),
    admin.from("user_roles").delete().eq("user_id", userId),
    admin.from("profiles").delete().eq("id", userId),
    admin.from("users").delete().eq("id", userId),
  ];
  const results = await Promise.all(requests);
  const fatal = results.find((result) => result.error && !isMissingTableError(result.error))?.error;
  if (fatal) throw fatal;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = request.headers.get("Authorization") ?? "";
  if (!url || !serviceKey || !authorization) return json({ error: "Unauthorized." }, 401);
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized." }, 401);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    await removeUserData(admin, userData.user.id);
    const { error } = await admin.auth.admin.deleteUser(userData.user.id, false);
    if (error) throw error;
    return json({ deleted: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return json({ error: "Your account could not be deleted safely. No confirmation was issued." }, 500);
  }
});
