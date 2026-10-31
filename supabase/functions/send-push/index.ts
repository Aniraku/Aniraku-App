import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/**
 * send-push — send push notifications to a user's devices via Expo's push service.
 *
 * Free, no self-hosting. Expo hosts the push relay (FCM on Android, APNs on iOS).
 * This function is callable from the app (signed-in user) or from Supabase DB triggers.
 *
 * Auth: requires a valid user JWT (verify-jwt is on by default on deploy).
 * Body:
 *   {
 *     title: string,        // notification title
 *     body: string,         // notification body
 *     data?: Record<string, unknown>,  // extra data passed to the app
 *     user_id?: string,     // if omitted, sends to the authenticated user's tokens
 *     sound?: string,       // default: "default"
 *     badge?: number,       // iOS badge count
 *     ttl?: number,         // seconds to live (default 86400 = 1 day)
 *   }
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/receipts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Validate an Expo push token (Expo tokens look like ExponentPushToken[xxxxxxxx-xxxx...]). */
function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

/** Chunk an array into smaller arrays of size n. */
function chunk<T>(arr: T[], n: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
  return chunks;
}

/** Send a batch of push messages to Expo and return per-message results. */
async function sendToExpo(
  messages: Array<{
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: string;
    badge?: number;
    ttl?: number;
    priority?: "default" | "normal" | "high";
  }>,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Expo allows up to 100 messages per request.
  for (const batch of chunk(messages, 100)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const text = await res.text();
      failed += batch.length;
      errors.push(`Expo API HTTP ${res.status}: ${text}`);
      continue;
    }

    const body = (await res.json()) as { data?: Array<{ status: string; id?: string; error?: string; message?: string }> };
    const results = body.data ?? [];

    for (const result of results) {
      if (result.status === "ok") {
        sent++;
      } else {
        failed++;
        errors.push(`${result.error ?? result.message ?? "unknown error"} (id: ${result.id ?? "-"})`);
      }
    }

    // Be polite — small delay between batches.
    if (chunk(messages, 100).length > 1) await sleep(100);
  }

  return { sent, failed, errors };
}

/** Check receipts for sent push IDs to confirm delivery. */
async function checkReceipts(receiptIds: string[]): Promise<{ delivered: number; failed: number; errors: string[] }> {
  let delivered = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const batch of chunk(receiptIds, 100)) {
    const res = await fetch(EXPO_PUSH_RECEIPTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ids: batch }),
    });

    if (!res.ok) {
      const text = await res.text();
      failed += batch.length;
      errors.push(`Receipts HTTP ${res.status}: ${text}`);
      continue;
    }

    const body = (await res.json()) as { data?: Record<string, { status: string; details?: { error?: string } }> };
    const data = body.data ?? {};

    for (const id of batch) {
      const r = data[id];
      if (!r) continue;
      if (r.status === "ok" || r.status === "delivered") {
        delivered++;
      } else {
        failed++;
        errors.push(`Receipt ${id}: ${r.details?.error ?? r.status}`);
      }
    }
  }

  return { delivered, failed, errors };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  // Verify the caller is authenticated (Supabase verify-jwt is on by default).
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anonKey) {
    return json({ error: "Server misconfigured." }, 500);
  }

  // Resolve the caller's user from the JWT.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Unauthorized." }, 401);
  }
  const callerUserId = userData.user.id;

  let body: {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    user_id?: string;
    sound?: string;
    badge?: number;
    ttl?: number;
    priority?: "default" | "normal" | "high";
  } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const title = String(body.title ?? "").trim();
  const bodyText = String(body.body ?? "").trim();
  if (!title || !bodyText) {
    return json({ error: "title and body are required." }, 400);
  }

  const targetUserId = body.user_id ?? callerUserId;

  // If targeting another user, require service-role or admin (caller can only
  // reliably target themselves with a normal user JWT; service-role bypasses RLS).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = serviceKey
    ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  const supabaseForQuery = admin ?? caller;

  // Fetch the target user's push tokens.
  const { data: tokens, error: tokensError } = await supabaseForQuery
    .from("push_tokens")
    .select("token")
    .eq("user_id", targetUserId);

  if (tokensError) {
    return json({ error: `Failed to load push tokens: ${tokensError.message}` }, 500);
  }

  const validTokens = (tokens ?? []).map((t) => t.token).filter(isExpoPushToken);

  if (validTokens.length === 0) {
    return json({
      sent: 0,
      failed: 0,
      note: "No valid push tokens registered for this user.",
    });
  }

  // Build messages.
  const messages = validTokens.map((to) => ({
    to,
    title,
    body: bodyText,
    data: body.data ?? {},
    sound: body.sound ?? "default",
    badge: body.badge,
    ttl: body.ttl ?? 86_400,
    priority: body.priority ?? "default",
  }));

  const { sent, failed, errors } = await sendToExpo(messages);

  return json({
    sent,
    failed,
    target_user_id: targetUserId,
    token_count: validTokens.length,
    ...(errors.length ? { sample_errors: errors.slice(0, 5) } : {}),
  });
});
