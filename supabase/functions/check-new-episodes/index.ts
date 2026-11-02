import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Push relay for the backend's notification pipeline ──
// The Go backend (Aniraku-Backend, internal/api/v1/notify.go) owns episode
// detection: when sources resolve (on-demand trigger) or ~75 minutes after a
// bookmarked RELEASING show's airtime (scheduled airing book), it writes
// `notifications` rows — type "new_episode", message "Episode N of X is now
// available" — for every bookmarked user, deduped in the database and using
// the exact wording the web client dedupes against.
//
// This function is ONLY the mobile push relay for those rows: it selects
// unread backend-written episode notifications, fans them out to each
// user's Expo push tokens, and stamps them pushed. No episode detection
// happens here — the backend is the source of truth. Callers: the Supabase
// function scheduler (service-role JWT, automatic), a signed-in user (app
// pull), or an explicit x-cron-secret match.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const RELAY_LIMIT = 500;

function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

/** Send one push message to a list of Expo tokens. Returns sent/failed counts. */
async function pushToTokens(tokens: string[], title: string, body: string, data: Record<string, unknown>): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((to) => ({ to, title, body, data, sound: "default", ttl: 86_400, priority: "high" as const }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) { failed += batch.length; continue; }
    const result = (await res.json()) as { data?: Array<{ status: string; id?: string; error?: string; message?: string }> };
    for (const r of result.data ?? []) {
      if (r.status === "ok" || r.status === "delivered") sent += 1;
      else failed += 1;
    }
  }
  return { sent, failed };
}

/** Collect Expo push tokens for a list of user IDs. */
async function userTokens(admin: ReturnType<typeof createClient>, userIds: string[]): Promise<string[]> {
  const { data } = await admin.from("push_tokens").select("user_id, token").in("user_id", userIds);
  return (data ?? []).filter((t) => isExpoPushToken(t.token)).map((t) => t.token);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "Server misconfigured." }, 500);

  // Caller gates, in order: x-cron-secret (the pg_cron relay firing — no
  // Bearer by design), the service-role JWT (Supabase's function scheduler —
  // the gateway already verified the signature), or a signed-in user JWT
  // (app pull). Anything else → 401 before any work.
  const authHeader = request.headers.get("Authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const isCron = Boolean(cronSecret) && request.headers.get("x-cron-secret") === cronSecret;

  const jwtPayload = !isCron && authHeader.startsWith("Bearer ")
    ? (() => {
      try {
        const payload = authHeader.slice(7).split(".")[1];
        return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
      } catch {
        return null;
      }
    })()
    : null;
  const isServiceScheduler = jwtPayload?.role === "service_role";

  if (!isCron && !isServiceScheduler) {
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized." }, 401);
    const caller = createClient(url, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized." }, 401);
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // ── Relay pending backend-written episode notifications ──
  try {
  const { data: rows, error: relayError } = await admin
    .from("notifications")
    .select("id, user_id, message, anime_id, created_at")
    .eq("type", "new_episode")
    .is("pushed_at", null)
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(RELAY_LIMIT);
  if (relayError) return json({ error: `notifications query: ${relayError.message}` }, 500);

  // Collapse to the latest pending row per user — one push per user per pass.
  const byUser = new Map<string, { id: string; message: string; animeId: number | null; createdAt: string }>();
  for (const row of rows ?? []) {
    const prev = byUser.get(row.user_id);
    if (!prev || String(row.created_at) >= String(prev.created_at)) byUser.set(row.user_id, row);
  }

  const { data: tokenRows } = await admin
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", [...byUser.keys()]);
  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows ?? []) {
    if (!isExpoPushToken(row.token)) continue;
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.token);
    tokensByUser.set(row.user_id, list);
  }

  let pushes = 0;
  let failed = 0;
  for (const [userId, row] of byUser) {
    const tokens = tokensByUser.get(userId) ?? [];
    if (tokens.length === 0) continue;
    try {
      const { sent } = await pushToTokens(tokens, "New episode", row.message, { type: "new_episode", animeId: row.anime_id ?? undefined });
      pushes += sent;
      if (sent === 0) failed += tokens.length;
    } catch {
      failed += tokens.length;
    }
  }

  // Stamp everything relayed this pass — including users without tokens —
  // so the next run only sees genuinely new announcements.
  if ((rows ?? []).length > 0) {
    const stampIds = (rows ?? []).map((row) => row.id);
    for (let i = 0; i < stampIds.length; i += 200) {
      await admin.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", stampIds.slice(i, i + 200));
    }
  }

  return json({ relayed: (rows ?? []).length, users: byUser.size, pushes, failed });
  } catch (cause) {
    // Surface the real relay failure — an opaque 500 helps nobody.
    return json({ error: `relay: ${cause instanceof Error ? cause.message : String(cause)}` }, 500);
  }
});
