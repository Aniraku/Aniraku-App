import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ANIRAKU_API = "https://api.aniraku.tech";
const CHROME_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const ANDROID_APP_REFERER = "anime.aniraku.app";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

async function fetchTrack(animeId: number): Promise<{ sub: number; dub: number } | null> {
  try {
    const res = await fetch(`${ANIRAKU_API}/api/v1/anime/${animeId}/track`, {
      headers: {
        "User-Agent": CHROME_ANDROID_UA,
        Referer: ANDROID_APP_REFERER,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as { sub: number; dub: number };
  } catch {
    return null;
  }
}

/** Collect Expo push tokens for a list of user IDs. */
async function userTokens(admin: ReturnType<typeof createClient>, userIds: string[]): Promise<string[]> {
  const { data } = await admin.from("push_tokens").select("user_id, token").in("user_id", userIds);
  return (data ?? []).filter((t) => isExpoPushToken(t.token)).map((t) => t.token);
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
    const result = (await res.json()) as { data?: Array<{ status: string }> };
    for (const r of result.data ?? []) {
      if (r.status === "ok") sent++; else failed++;
    }
  }
  return { sent, failed };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized." }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json({ error: "Server misconfigured." }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Verify the caller is authenticated.
  const caller = createClient(url, serviceKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Unauthorized." }, 401);

  // Fetch every bookmark row (anime_id + user_id).
  const { data: bookmarks, error: bmError } = await admin.from("bookmarks").select("user_id, anime_id").not("anime_id", "is", null);
  if (bmError || !bookmarks?.length) return json({ checked: 0, newEpisodes: [], sent: 0, failed: 0 });

  // Group user IDs by anime_id.
  const animeToUsers = new Map<number, Set<string>>();
  for (const bm of bookmarks) {
    const animeId = Number(bm.anime_id);
    if (!Number.isFinite(animeId) || animeId <= 0) continue;
    if (!animeToUsers.has(animeId)) animeToUsers.set(animeId, new Set());
    animeToUsers.get(animeId)!.add(bm.user_id);
  }

  let totalSent = 0;
  let totalFailed = 0;
  const newEpisodes: Array<{ animeId: number; sub?: number; dub?: number }> = [];

  for (const [animeId, userIds] of animeToUsers) {
    const track = await fetchTrack(animeId);
    if (!track) continue;

    const { sub, dub } = track;

    // Read last known state.
    const { data: state } = await admin.from("anime_track_state").select("sub_count, dub_count").eq("anime_id", animeId).single();
    const prevSub = state?.sub_count ?? 0;
    const prevDub = state?.dub_count ?? 0;

    const subGrew = sub > prevSub;
    const dubGrew = dub > prevDub;

    // Always persist the latest counts (first check seeds the state).
    await admin
      .from("anime_track_state")
      .upsert({ anime_id: animeId, sub_count: sub, dub_count: dub, last_checked_at: new Date().toISOString() }, { onConflict: "anime_id" });

    if (!subGrew && !dubGrew) continue; // nothing new for this title

    newEpisodes.push({ animeId, sub: subGrew ? sub : undefined, dub: dubGrew ? dub : undefined });

    // Build notification content.
    const parts: string[] = [];
    if (subGrew) parts.push(`sub ${prevSub + 1}–${sub}`);
    if (dubGrew) parts.push(`dub ${prevDub + 1}–${dub}`);
    const body = `New ${parts.join(" + ")} episode(s) available`;
    const title = `New Episode`;
    const data = { type: "new_episode", animeId };

    const tokenList = await userTokens(admin, Array.from(userIds));
    const { sent, failed } = await pushToTokens(tokenList, title, body, data);
    totalSent += sent;
    totalFailed += failed;
  }

  return json({ checked: animeToUsers.size, newEpisodes, sent: totalSent, failed: totalFailed });
});
