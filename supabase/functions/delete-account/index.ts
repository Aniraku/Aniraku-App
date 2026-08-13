import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function removeUserData(admin: ReturnType<typeof createClient>, userId: string) {
  const comments = await admin.from("comments").select("id").eq("user_id", userId);
  if (comments.error) throw comments.error;
  const commentIds = (comments.data ?? []).map((comment) => comment.id);
  if (commentIds.length) {
    const replies = await admin.from("comments").update({ parent_id: null }).in("parent_id", commentIds);
    if (replies.error) throw replies.error;
    const likes = await admin.from("comment_likes").delete().in("comment_id", commentIds);
    if (likes.error) throw likes.error;
  }
  const ownedGroups = await admin.from("groups").select("id").eq("owner_id", userId);
  if (ownedGroups.error) throw ownedGroups.error;
  const groupIds = (ownedGroups.data ?? []).map((group) => group.id);
  if (groupIds.length) {
    const members = await admin.from("group_members").delete().in("group_id", groupIds);
    if (members.error) throw members.error;
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
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw failure;
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
