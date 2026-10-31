import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import tls from "node:tls";

/**
 * send-campaign — bulk email to verified Supabase Auth users, sent through
 * the project's own SMTP server (the same credentials configured for Auth).
 *
 * Why hand-rolled SMTP over node:tls instead of a library: full control of
 * MIME headers (UTF-8 subjects for the Bangla template need RFC 2047) and
 * zero dependency risk. Implicit TLS only (port 465) — Gmail and Brevo both
 * offer it; plain-socket STARTTLS dance is intentionally not supported.
 *
 * Design:
 *  - Auth: x-campaign-secret header must match the CAMPAIGN_SECRET env var.
 *    Deploy keeps verify-jwt on (default), so BOTH a valid JWT and the
 *    secret are required. Neither is ever logged.
 *  - Idempotent: every send is recorded in public.campaign_sends keyed by
 *    (campaign_id, user_id). Re-running the same campaign_id only sends to
 *    users who don't have a row yet — safe to retry after any failure.
 *  - Chunked: processes `batch` users per invocation (default 50), then
 *    reports `remaining`. Caller loops until remaining === 0. Keeps each
 *    invocation well inside function time limits.
 *  - Polite: CAMPAIGN_SEND_DELAY_MS (default 300) between messages so the
 *    SMTP server (and Gmail's per-day caps) never get slammed.
 */

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const b64 = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));

// ---------------------------------------------------------------------------
// Minimal SMTP client (implicit TLS, port 465)
// ---------------------------------------------------------------------------

class SmtpError extends Error {}

class SmtpSession {
  private sock!: tls.TLSSocket;
  private buf = "";
  private from = "";

  async connect(host: string, port: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.sock = tls.connect({ host, port, servername: host }, () => resolve());
      this.sock.on("data", (chunk: Buffer) => {
        this.buf += chunk.toString("utf8");
      });
      this.sock.on("error", reject);
    });
    const greet = await this.readReply();
    if (greet.code !== 220) throw new SmtpError(`SMTP greeting failed: ${greet.text}`);
  }

  private takeReply(): string | null {
    const lines = this.buf.endsWith("\r\n") ? this.buf.split("\r\n").slice(0, -1) : [];
    let i = 0;
    while (i < lines.length) {
      const start = lines[i];
      if (!/^\d{3}[ -]/.test(start)) {
        i++;
        continue;
      }
      const code = start.slice(0, 3);
      const collected: string[] = [];
      let j = i;
      let final = false;
      while (j < lines.length && lines[j].startsWith(code)) {
        collected.push(lines[j]);
        if (lines[j].startsWith(code + " ")) {
          final = true;
          break;
        }
        j++;
      }
      if (final) {
        const consumed = lines.slice(0, j + 1).join("\r\n").length + 2;
        this.buf = this.buf.slice(consumed);
        return collected.join("\n");
      }
      break; // multiline reply not complete yet
    }
    return null;
  }

  private async readReply(timeoutMs = 30_000): Promise<{ code: number; text: string }> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const reply = this.takeReply();
      if (reply) return { code: parseInt(reply.slice(0, 3), 10), text: reply };
      await sleep(25);
    }
    throw new SmtpError("SMTP reply timeout");
  }

  private async cmd(command: string, expect: number[]): Promise<string> {
    this.sock.write(command + "\r\n");
    const reply = await this.readReply();
    if (!expect.includes(reply.code)) {
      throw new SmtpError(`SMTP ${command.split(" ")[0]} rejected: ${reply.text}`);
    }
    return reply.text;
  }

  async handshake(ehlo: string, from: string, user: string, pass: string): Promise<void> {
    this.from = from;
    await this.cmd("EHLO " + ehlo, [250]);
    // AUTH PLAIN: single-command login, payload = base64(NUL user NUL pass).
    // Gmail requires auth before MAIL FROM; 235 = auth accepted.
    const payload = b64(String.fromCharCode(0) + user + String.fromCharCode(0) + pass);
    await this.cmd("AUTH PLAIN " + payload, [235]);
    // NOTE: MAIL FROM is deliberately NOT issued here. RFC 5321 requires a
    // fresh MAIL FROM before each message's RCPT/DATA — Gmail rejects a
    // second RCPT without one ("503 5.5.1 MAIL first"). deliver() opens the
    // per-message transaction.
  }

  /** Send one RFC 5322 message body (headers + blank line + body) to `to`. */
  async deliver(to: string, message: string): Promise<void> {
    // Each message is its own RFC 5321 transaction: MAIL FROM → RCPT TO →
    // DATA. Gmail rejects a reused sender state ("503 5.5.1 MAIL first").
    await this.cmd("MAIL FROM:<" + this.from + ">", [250]);
    await this.cmd(`RCPT TO:<${to}>`, [250, 251]);
    await this.cmd("DATA", [354]);
    // dot-stuffing: any line starting with "." must be escaped
    const stuffed = message.replace(/\r\n\./g, "\r\n..");
    this.sock.write(stuffed + "\r\n.\r\n");
    // read the 250 for the message terminator directly — cmd() would write
    // an extra CRLF first, which is ignorable but sloppy on the wire
    const reply = await this.readReply();
    if (reply.code !== 250) {
      throw new SmtpError(`SMTP message rejected: ${reply.text}`);
    }
  }

  async end(): Promise<void> {
    try {
      this.sock.write("QUIT\r\n");
      await this.readReply(10_000);
    } catch {
      // QUIT is best-effort; the batch already succeeded
    }
    this.sock.destroy();
  }

  get alive(): boolean {
    return !this.sock.destroyed;
  }
}

// ---------------------------------------------------------------------------
// Email templates — professional, no guilt-trip, donations stay voluntary.
// ---------------------------------------------------------------------------

const PAY_ID = "{{PAY_ID}}";

const templates: Record<string, { subject: string; html: string }> = {
  en: {
    subject: "Aniraku needs your help to stay alive",
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:Georgia,'Times New Roman',serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Where things stand, and a real ask — no pressure either way.</div>
<div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#ffffff">
  <p style="font-size:20px;font-weight:bold;margin:0 0 24px;color:#1a1a2e">🌸 Aniraku</p>
  <p style="font-size:16px;line-height:1.7;color:#333344">Dear community member,</p>
  <p style="font-size:16px;line-height:1.7;color:#333344">I'm writing to you directly — you're one of the people Aniraku was built for, and this is something I'd rather you hear from me than discover on your own.</p>
  <p style="font-size:16px;line-height:1.7;color:#333344"><b>Where things stand.</b> Aniraku's promise has never changed: fast, reliable streaming — completely free. No ads, no paywalls, no premium tiers, no data selling. But the servers and bandwidth that keep every episode streaming now cost <b>over $60 a month</b> — and with the community growing every day, current usage puts it on track for <b>$70+ per month</b>. The free hosting credit that has been covering this is running out, and without help, Aniraku will have to scale back or shut down.</p>
  <p style="font-size:16px;line-height:1.7;color:#333344"><b>What I'm asking.</b> If Aniraku has ever saved you money on subscriptions, or simply made your week a little better — please support it through <b>Binance&nbsp;Pay</b>:</p>
  <div style="background:#f7f7fb;border:1px solid #e2e2ea;border-radius:8px;padding:16px 20px;margin:16px 0;text-align:center">
    <p style="margin:0;font-size:13px;color:#777788;letter-spacing:1px">BINANCE PAY · UID</p>
    <p style="margin:6px 0 0;font-size:24px;font-weight:bold;color:#1a1a2e;font-family:monospace">1098400042</p>
    <p style="margin:8px 0 0;font-size:12px;color:#9999aa">Binance app → Pay → Send → enter this UID</p>
  </div>
  <p style="font-size:16px;line-height:1.7;color:#333344">Arrives instantly, zero sender fee. Any amount helps — <b>$3–5 covers a full day of servers, $10–15 covers a full week.</b> And if enough people give even a small <b>monthly</b> amount, the service is secured for the long run — monthly supporters get a special Discord role and priority on feature requests.</p>
  <p style="font-size:16px;line-height:1.7;color:#333344"><b>This is not a paywall</b> — Aniraku stays free for everyone, always. But honestly? It survives because its community keeps it alive. You are that community.</p>
  <p style="font-size:16px;line-height:1.7;color:#333344"><b>Can't pay? You still help more than you know:</b></p>
  <ul style="font-size:16px;line-height:1.8;color:#333344;padding-left:24px">
    <li><b>Reply to this email with your feedback</b> — what's working, what's broken, what you wish Aniraku had. I read every single reply, and your feedback directly decides what gets built next.</li>
    <li>Share Aniraku with one friend</li>
    <li>Star the project on GitHub</li>
  </ul>
  <p style="font-size:16px;line-height:1.7;color:#333344">Thank you for using Aniraku — and thank you in advance, even for reading this far.</p>
  <p style="font-size:16px;line-height:1.7;color:#333344">Warm regards,<br>The Aniraku team</p>
  <p style="font-size:16px;line-height:1.7;color:#333344"><b>P.S.</b> Questions about where the money goes, or anything at all — just reply to this email. It comes straight to me.</p>
  <hr style="border:none;border-top:1px solid #e8e8ee;margin:28px 0 16px">
  <p style="font-size:12px;line-height:1.6;color:#9999aa;margin:0">aniraku.tech · You're receiving this because you created an Aniraku account. Reply "unsubscribe" and you won't hear from us again.</p>
</div></body></html>`,
  },
  bn: {
    subject: "Aniraku চালিয়ে যেতে আপনার সহায়তা চাইছি",
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:'Noto Sans Bengali','SolaimanLipi',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">বর্তমান অবস্থা এবং একটি ছোট অনুরোধ — কোনো চাপ নেই।</div>
<div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#ffffff">
  <p style="font-size:20px;font-weight:bold;margin:0 0 24px;color:#1a1a2e">🌸 Aniraku</p>
  <p style="font-size:16px;line-height:1.8;color:#333344">প্রিয় Aniraku কমিউনিটি,</p>
  <p style="font-size:16px;line-height:1.8;color:#333344">আপনাকে সরাসরি লিখছি — কারণ আপনি সেই দর্শকদের একজন যাদের জন্যই Aniraku বানানো হয়েছিল, আর আগাম কিছু বিষয়ে আপনি যেন আমার কাছ থেকেই শুনেন, পরে নিজে বুঝতে না পারেন।</p>
  <p style="font-size:16px;line-height:1.8;color:#333344"><b>বর্তমান অবস্থা.</b> Aniraku-র অঙ্গীকার একটাই ছিল — দ্রুত ও ঝামেলাহীন স্ট্রিমিং, সম্পূর্ণ ফ্রি: কোনো বিজ্ঞাপন নেই, কোনো পেওয়াল নেই, কোনো প্রিমিয়াম টিয়ার নেই, ডেটা বিক্রি নেই। ওই অঙ্গীকার একদমই বদলায়নি। বদলেছে শুধু পেছনের অবকাঠামো — সার্ভার ও ব্যান্ডউইথ বিল আসে মাসে প্রায় <b>$৩৫–৪০ (≈ ৳৪০০–৪৫০)</b>, যেটা এখন ফ্রি হোস্টিং ক্রেডিট দিয়ে চলছিল, আর ওই ক্রেডিট শেষ হয়ে আসছে।</p>
  <p style="font-size:16px;line-height:1.8;color:#333344"><b>আমি যা চাইছি.</b> Aniraku আপনার সাবস্ক্রিপশনের টাকা বাঁচিয়েছে, অথবা শুধু সপ্তাহটা একটু ভালো করেছে — তাহলে <b>Binance&nbsp;Pay</b> দিয়ে একটু সাপোর্ট করার কথা ভাবেন:</p>
  <div style="background:#f7f7fb;border:1px solid #e2e2ea;border-radius:8px;padding:16px 20px;margin:16px 0;text-align:center">
    <p style="margin:0;font-size:13px;color:#777788;letter-spacing:1px">BINANCE PAY ID</p>
    <p style="margin:6px 0 0;font-size:22px;font-weight:bold;color:#1a1a2e;font-family:monospace">${PAY_ID}</p>
  </div>
  <p style="font-size:16px;line-height:1.8;color:#333344">টাকা পৌঁছায় সেকেন্ডের মধ্যে, আর পাঠানোর কোনো ফি লাগে না। এক কাপ চায়ের টাকা (~$৩–৫) দিলেই একদিনের সার্ভার বিল হয়ে যায়। <b>মাসিক</b> দিতে পারলে তা সবচেয়ে বেশি কাজে লাগে — মাসিক সাপোর্টারদের Discord-এ স্পেশাল রোল এবং নতুন ফিচারে অগ্রাধিকার থাকছে।</p>
  <p style="font-size:16px;line-height:1.8;color:#333344"><b>আর্থিকভাবে সাহায্য করতে পারছেন না? একদম ঠিক আছে</b> — কেউ বাধ্য না। একজন বন্ধুকে Aniraku শেয়ার করে দিলে, অথবা GitHub-এ প্রজেক্টে ⭐ দিলেও সেটাই সমান বড় সাহায্য।</p>
  <p style="font-size:16px;line-height:1.8;color:#333344">Aniraku সবার জন্য এখনও ফ্রিই থাকবে। এটা কোনো পেওয়াল নয় — এটা কমিউনিটির নিজের কিছু ধরে রাখার চেষ্টা।</p>
  <p style="font-size:16px;line-height:1.8;color:#333344">আপনি এর অংশ বলে ধন্যবাদ।</p>
  <p style="font-size:16px;line-height:1.8;color:#333344">শুভেচ্ছান্তে,<br>Aniraku টিম</p>
  <hr style="border:none;border-top:1px solid #e8e8ee;margin:28px 0 16px">
  <p style="font-size:12px;line-height:1.6;color:#9999aa;margin:0">aniraku.tech · আপনি এই ইমেইলটি পাচ্ছেন কারণ আপনি Aniraku অ্যাকাউন্ট খুলেছেন। আরও কিছু পেতে চাইলে "unsubscribe" রিপ্লাই করুন।</p>
</div></body></html>`,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AuthUser {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
}

/** Page through the GoTrue admin API; keep only confirmed users, dedupe by email. */
async function fetchVerifiedUsers(url: string, serviceKey: string): Promise<AuthUser[]> {
  const byEmail = new Map<string, AuthUser>();
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) throw new Error(`admin users page ${page}: HTTP ${res.status}`);
    const body = (await res.json()) as { users?: AuthUser[] };
    const users = body.users ?? [];
    for (const u of users) {
      if (u.email && u.email_confirmed_at && !byEmail.has(u.email)) byEmail.set(u.email, u);
    }
    if (users.length < 200) break;
  }
  return [...byEmail.values()];
}

function buildMessage(fromName: string, fromAddr: string, to: string, subject: string, html: string): string {
  const headers = [
    `From: ${fromName} <${fromAddr}>`,
    `To: ${to} <${to}>`,
    // RFC 2047: required for the Bangla subject line
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@aniraku.tech>`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  return headers.join("\r\n") + "\r\n\r\n" + html.replace(/\r?\n/g, "\r\n");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  // Two gates: deploy-time verify-jwt (default on) + this shared secret.
  const secret = Deno.env.get("CAMPAIGN_SECRET") ?? "";
  if (!secret || request.headers.get("x-campaign-secret") !== secret) {
    return json({ error: "Unauthorized." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
  const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "465");
  const smtpUser = Deno.env.get("SMTP_USER") ?? "";
  const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
  const smtpFrom = Deno.env.get("SMTP_FROM") ?? smtpUser;
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Aniraku";
  const replyTo = Deno.env.get("SMTP_REPLY_TO") ?? "";
  const delayMs = Number(Deno.env.get("CAMPAIGN_SEND_DELAY_MS") ?? "300");
  if (!url || !serviceKey || !smtpHost || !smtpUser || !smtpPass) {
    return json({ error: "Server email configuration incomplete." }, 500);
  }

  let body: {
    campaign_id?: string;
    template?: string;
    lang?: string;
    pay_id?: string;
    subject?: string;
    html?: string;
    batch?: number;
    dry_run?: boolean;
    test_to?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine for dry runs; validated below where needed
  }

  const campaignId = body.campaign_id ?? "";
  const batch = Math.min(Math.max(Number(body.batch ?? 50), 1), 100);
  const testTo = body.test_to?.trim() ?? "";

  // --- render ------------------------------------------------------------
  const tpl = templates[body.template ?? "donation"] ?? templates.en;
  const lang = body.lang === "bn" ? "bn" : "en";
  const chosen = body.template ? tpl : templates[lang];
  const subject = body.subject?.trim() || chosen.subject;
  const html = body.html || chosen.html.replaceAll(PAY_ID, (body.pay_id ?? "").trim());

  // --- single test send (not recorded, not part of any campaign) ---------
  if (testTo) {
    const session = new SmtpSession();
    try {
      await session.connect(smtpHost, smtpPort);
      await session.handshake("aniraku.tech", smtpFrom, smtpUser, smtpPass);
      await session.deliver(testTo, buildMessage(fromName, smtpFrom, testTo, subject, html));
      await session.end();
      return json({ test_sent_to: testTo, subject });
    } catch (error) {
      return json({ error: `Test send failed: ${(error as Error).message}` }, 502);
    }
  }

  if (!campaignId) return json({ error: "campaign_id required." }, 400);

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const users = await fetchVerifiedUsers(url, serviceKey);

    const { data: sentRows, error: sentErr } = await admin
      .from("campaign_sends")
      .select("user_id")
      .eq("campaign_id", campaignId);
    if (sentErr) throw new Error(`campaign_sends lookup: ${sentErr.message}`);
    const alreadySent = new Set((sentRows ?? []).map((r) => (r as { user_id: string }).user_id));

    const remaining = users.filter((u) => !alreadySent.has(u.id));

    if (body.dry_run) {
      return json({
        campaign_id: campaignId,
        verified_total: users.length,
        already_sent: alreadySent.size,
        remaining: remaining.length,
        next_up: remaining.slice(0, 3).map((u) => u.email),
        note: "dry_run — nothing sent.",
      });
    }

    const todo = remaining.slice(0, batch);
    if (todo.length === 0) {
      return json({ campaign_id: campaignId, sent: 0, failed: 0, remaining: 0, note: "campaign complete." });
    }

    const session = new SmtpSession();
    await session.connect(smtpHost, smtpPort);
    await session.handshake("aniraku.tech", smtpFrom, smtpUser, smtpPass);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const user of todo) {
      let status = "sent";
      let errMsg: string | null = null;
      try {
        if (!session.alive) throw new SmtpError("connection dropped");
        const message = buildMessage(fromName, smtpFrom, user.email, subject, html);
        await session.deliver(user.email, message);
        sent++;
        void replyTo; // reserved: per-user Reply-To when we add reply tracking
      } catch (error) {
        status = "failed";
        errMsg = (error as Error).message;
        failed++;
        if (errors.length < 5) errors.push(`${user.email}: ${errMsg}`);
      }
      // record per email: re-runs skip these users forever (idempotency)
      const { error: upsertErr } = await admin.from("campaign_sends").upsert(
        { campaign_id: campaignId, user_id: user.id, email: user.email, status, error: errMsg },
        { onConflict: "campaign_id,user_id", ignoreDuplicates: true },
      );
      if (upsertErr) console.error("campaign_sends upsert failed", upsertErr);
      await sleep(delayMs);
    }

    await session.end();

    const { count } = await admin
      .from("campaign_sends")
      .select("user_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "sent");

    return json({
      campaign_id: campaignId,
      batch_size: todo.length,
      sent,
      failed,
      remaining: Math.max(remaining.length - todo.length, 0),
      campaign_sent_total: count ?? 0,
      ...(errors.length ? { sample_errors: errors } : {}),
    });
  } catch (error) {
    console.error("campaign failed", error);
    return json({ error: `Campaign failed: ${(error as Error).message}` }, 500);
  }
});
