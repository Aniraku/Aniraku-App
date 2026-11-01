// verify-email — PUBLIC endpoint for the Aniraku sign-up page.
// Answers three questions before the user submits the form:
//   valid  — format is a deliverable-looking email (syntax + MX records)
//   exists — an Aniraku account with this email is already registered
//   suggestion — a likely typo correction (gmial.com → gmail.com)
// Public by design: no auth. Light in-memory per-IP rate limiting.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const GENERIC_DOMAINS = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "aol.com"]);

const KNOWN_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "outlook.sa",
  "yahoo.com", "yahoo.co.in", "icloud.com", "me.com", "proton.me", "protonmail.com",
  "aol.com", "gmx.com", "zoho.com", "yandex.com", "mail.ru",
];

function suggestionFor(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (KNOWN_DOMAINS.includes(domain)) return null;
  let best: { domain: string; score: number } | null = null;
  for (const known of KNOWN_DOMAINS) {
    const score = similarity(domain, known);
    if (!best || score > best.score) best = { domain: known, score };
  }
  return best && best.score >= 0.72 ? `${email.slice(0, at + 1)}${best.domain}` : null;
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

// ── lightweight per-IP rate limit (60 checks / minute / IP) ──
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    if (hits.size > 5_000) hits.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > 60;
}

async function mxRecords(domain: string): Promise<string[]> {
  try {
    const records = await Deno.resolveDns(domain, "MX");
    return records.map((record) => record.exchange);
  } catch {
    return [];
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return json({ error: "Too many checks. Try again in a minute." }, 429);

  let email = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!email || email.length > 254) return json({ valid: false, exists: false, mx: false, reason: "empty" });

  if (!EMAIL_RE.test(email)) {
    return json({ valid: false, exists: false, mx: false, suggestion: suggestionFor(email), reason: "format" });
  }

  const domain = email.slice(email.lastIndexOf("@") + 1);
  const [mx, suggestion] = await Promise.all([mxRecords(domain), Promise.resolve(suggestionFor(email))]);

  // Existence: an Aniraku account with this email is already registered?
  // The service role reads the users table without touching auth flows.
  let exists = false;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (supabaseUrl && serviceKey) {
    try {
      const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data } = await admin.from("users").select("id").eq("email", email).limit(1);
      exists = Boolean(data?.length);
    } catch {
      // existence is best-effort — format + MX are the hard answers
    }
  }

  return json({
    email,
    valid: mx.length > 0,
    exists,
    mx: mx.slice(0, 3),
    suggestion: mx.length === 0 ? suggestion : null,
  });
});
