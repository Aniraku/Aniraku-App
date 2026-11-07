// verify-email — PUBLIC endpoint for the Aniraku sign-up page.
// Answers four questions before the user submits the form:
//   valid       — format is a deliverable-looking email (syntax + MX records)
//   exists      — an Aniraku account with this email is already registered
//   deliverable — the MAILBOX itself exists (SMTP-level). null = unknown:
//                 catch-all domain, provider not configured, or provider
//                 could not answer. Only a confirmed miss yields false.
//   suggestion  — a likely typo correction (gmial.com → gmail.com)
//
// Mailbox verification keeps Supabase's confirmation-email credits from
// burning on addresses that can never receive them (XXXXX212@gmail.com
// passes syntax + MX but no mailbox is listening).
//
// ── Mailbox provider setup (optional but recommended) ─────────────────────
// Any one of these free-tier APIs enables the `deliverable` answer. Set the
// provider name + its key as Supabase secrets (supabase secrets set ...):
//   • mailboxlayer (apilayer) — 250 free checks/month, `smtp_check` flag.
//       supabase secrets set EMAIL_VERIFIER=mailboxlayer MAILBOXLAYER_API_KEY=...
//   • emailable — 250 free checks/month, `state: deliverable|undeliverable`.
//       supabase secrets set EMAIL_VERIFIER=emailable EMAILABLE_API_KEY=...
//   • zerobounce — 100 free checks/month, `status: valid|invalid|catch-all`.
//       supabase secrets set EMAIL_VERIFIER=zerobounce ZEROBOUNCE_API_KEY=...
// Without a provider the endpoint still answers valid/exists/suggestion and
// reports `deliverable: null` (unknown) — the sign-up form only blocks on a
// confirmed false.
//
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

// ── mailbox-level verification (provider adapters) ────────────────────────

type MailboxAnswer = { deliverable: boolean | null; catchAll: boolean };

const PROVIDER_TIMEOUT_MS = 4_000;

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** mailboxlayer: smtp_check 1 = mailbox confirmed, 0 = confirmed missing. */
async function mailboxlayer(email: string): Promise<MailboxAnswer> {
  const key = Deno.env.get("MAILBOXLAYER_API_KEY") ?? "";
  const response = await fetchWithTimeout(
    `https://apilayer.net/api/check?access_key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&smtp=1&catch_all=1`,
  );
  if (!response?.ok) return { deliverable: null, catchAll: false };
  const data = await response.json().catch(() => null) as { smtp_check?: number; mx_found?: boolean | string; catch_all?: boolean | string } | null;
  if (!data || typeof data.smtp_check !== "number") return { deliverable: null, catchAll: false };
  const mxFound = data.mx_found === true || data.mx_found === "true";
  if (data.smtp_check === 1) return { deliverable: true, catchAll: data.catch_all === true || data.catch_all === "true" };
  // A 0 answer only counts as a miss when the domain itself was reachable.
  if (data.smtp_check === 0 && mxFound) return { deliverable: false, catchAll: false };
  return { deliverable: null, catchAll: false };
}

/** emailable: state deliverable | undeliverable | risky | unknown. */
async function emailable(email: string): Promise<MailboxAnswer> {
  const key = Deno.env.get("EMAILABLE_API_KEY") ?? "";
  const response = await fetchWithTimeout(
    `https://api.emailable.com/v1/verify?api_key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`,
  );
  if (!response?.ok) return { deliverable: null, catchAll: false };
  const data = await response.json().catch(() => null) as { state?: string; reason?: string } | null;
  if (!data?.state) return { deliverable: null, catchAll: false };
  if (data.state === "deliverable") return { deliverable: true, catchAll: false };
  if (data.state === "undeliverable") return { deliverable: false, catchAll: false };
  return { deliverable: null, catchAll: data.state === "risky" && /catch[- ]?all/i.test(data.reason ?? "") };
}

/** zerobounce: status valid | invalid | catch-all | unknown | ... */
async function zerobounce(email: string): Promise<MailboxAnswer> {
  const key = Deno.env.get("ZEROBOUNCE_API_KEY") ?? "";
  const response = await fetchWithTimeout(
    `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`,
  );
  if (!response?.ok) return { deliverable: null, catchAll: false };
  const data = await response.json().catch(() => null) as { status?: string } | null;
  if (!data?.status) return { deliverable: null, catchAll: false };
  if (data.status === "valid") return { deliverable: true, catchAll: false };
  if (data.status === "invalid") return { deliverable: false, catchAll: false };
  return { deliverable: null, catchAll: data.status === "catch-all" };
}

async function mailboxAnswer(email: string): Promise<MailboxAnswer> {
  const provider = (Deno.env.get("EMAIL_VERIFIER") ?? "").trim().toLowerCase();
  try {
    if (provider === "mailboxlayer") return await mailboxlayer(email);
    if (provider === "emailable") return await emailable(email);
    if (provider === "zerobounce") return await zerobounce(email);
  } catch {
    // provider hiccups must never break the endpoint — fall through to null
  }
  return { deliverable: null, catchAll: false };
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
  if (!email || email.length > 254) return json({ valid: false, exists: false, mx: false, deliverable: null, catch_all: false, reason: "empty" });

  if (!EMAIL_RE.test(email)) {
    return json({ valid: false, exists: false, mx: false, deliverable: null, catch_all: false, suggestion: suggestionFor(email), reason: "format" });
  }

  const domain = email.slice(email.lastIndexOf("@") + 1);
  const [mx, mailbox, suggestion] = await Promise.all([mxRecords(domain), mailboxAnswer(email), Promise.resolve(suggestionFor(email))]);

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

  // No MX ⇒ the domain cannot receive mail at all; a provider verdict about
  // the mailbox would be noise. A confirmed mailbox answer stands on its own.
  const deliverable = mx.length === 0 ? null : mailbox.deliverable;

  return json({
    email,
    valid: mx.length > 0,
    exists,
    mx: mx.slice(0, 3),
    deliverable,
    catch_all: mx.length === 0 ? false : mailbox.catchAll,
    suggestion: mx.length === 0 ? suggestion : null,
  });
});
