# Aniraku Supabase Email Templates

These are **Aniraku-branded Supabase Auth templates**, rebuilt from the live design system rather than a generic purple email style. They use the real application mark served from `https://www.aniraku.tech/icons/icon-512.png`, the live black/slate palette, silver primary accent, restrained violet glow, rounded cards, and the same uppercase `ANIRAKU` wordmark treatment used in `src/components/Logo.jsx`.

> **Brand source of truth:** the app uses a black base (`#000`), black secondary surface (`#0a0a0a`), card surface (`#111`), elevated surface (`#161616`), border (`#2a2a2a`), silver accent (`#e2e8f0`), muted text (`#8c8c8c`), and violet decorative glow (`#8b5cf6`). The visible app wordmark is `ANIRAKU` in the brand display style. Email clients cannot reliably load the site’s `Agbalumo` web font, so templates use a bold Georgia fallback for the wordmark while retaining the real Aniraku icon.

## Important setup before pasting

Use these HTML blocks in **Supabase Dashboard → Authentication → Email Templates**. Keep the supplied Supabase URL variable intact. The logo image must remain on a publicly reachable HTTPS URL. Do not use relative URLs in an email.

| Setting | Recommended value |
|---|---|
| Sender display name | `Aniraku` |
| Auth sender | `no-reply@auth.aniraku.tech` |
| Logo source | `https://www.aniraku.tech/icons/icon-512.png` |
| Link tracking | Disabled in the SMTP provider |
| Brand palette | Black / slate / silver, with restrained violet glow |
| Main call-to-action | Silver background with black text |

## Shared Aniraku email shell

Each template below is fully self-contained for direct paste. The design consistently uses the real app icon, an `ANIRAKU` wordmark, a black page background, a `#111` content card, `#2a2a2a` border, and the site’s silver action treatment.

---

## Confirm signup

**Subject:** Confirm your email — Aniraku

```html
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#000000;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">Confirm your email to finish creating your Aniraku account.</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;">
      <tr><td align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
          <tr><td style="height:3px;background:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:30px 28px 18px;background:#0a0a0a;border-bottom:1px solid #2a2a2a;">
            <img src="https://www.aniraku.tech/icons/icon-512.png" width="44" height="44" alt="Aniraku" style="display:block;width:44px;height:44px;border:0;border-radius:10px;" />
            <div style="margin-top:11px;color:#e2e8f0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:2px;line-height:1;">ANIRAKU</div>
            <div style="margin-top:7px;color:#8c8c8c;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Your next story starts here</div>
          </td></tr>
          <tr><td style="padding:32px 28px 12px;">
            <h1 style="margin:0 0 12px;color:#e2e8f0;font-size:26px;line-height:1.25;font-weight:700;">Confirm your email</h1>
            <p style="margin:0;color:#b8b8b8;font-size:16px;line-height:1.65;">Welcome to Aniraku. Confirm your email address to activate your account and continue watching.</p>
          </td></tr>
          <tr><td style="padding:18px 28px 24px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#e2e8f0" style="border-radius:10px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;color:#000000;font-size:15px;line-height:1;font-weight:700;text-decoration:none;border-radius:10px;">Confirm email address</a></td></tr></table>
          </td></tr>
          <tr><td style="padding:0 28px 30px;"><p style="margin:0;color:#808080;font-size:12px;line-height:1.6;">If you did not create an Aniraku account, you can safely ignore this email.</p></td></tr>
        </table>
        <p style="margin:15px 0 0;color:#666666;font-size:12px;line-height:1.5;text-align:center;">Secure account email from Aniraku</p>
      </td></tr>
    </table>
  </body>
</html>
```

---

## Magic link

**Subject:** Your secure sign-in link — Aniraku

```html
<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#000000;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;"><span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">Use this one-time sign-in link to continue to Aniraku.</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;"><tr><td style="height:3px;background:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td align="center" style="padding:30px 28px 18px;background:#0a0a0a;border-bottom:1px solid #2a2a2a;"><img src="https://www.aniraku.tech/icons/icon-512.png" width="44" height="44" alt="Aniraku" style="display:block;width:44px;height:44px;border:0;border-radius:10px;" /><div style="margin-top:11px;color:#e2e8f0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:2px;line-height:1;">ANIRAKU</div><div style="margin-top:7px;color:#8c8c8c;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Secure account access</div></td></tr><tr><td style="padding:32px 28px 12px;"><h1 style="margin:0 0 12px;color:#e2e8f0;font-size:26px;line-height:1.25;font-weight:700;">Sign in securely</h1><p style="margin:0;color:#b8b8b8;font-size:16px;line-height:1.65;">Use this short-lived, one-time link to continue to your Aniraku account.</p></td></tr><tr><td style="padding:18px 28px 24px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#e2e8f0" style="border-radius:10px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;color:#000000;font-size:15px;line-height:1;font-weight:700;text-decoration:none;border-radius:10px;">Continue to Aniraku</a></td></tr></table></td></tr><tr><td style="padding:0 28px 30px;"><p style="margin:0;color:#808080;font-size:12px;line-height:1.6;">If you did not request a sign-in link, you can safely ignore this email.</p></td></tr></table><p style="margin:15px 0 0;color:#666666;font-size:12px;line-height:1.5;text-align:center;">Secure account email from Aniraku</p></td></tr></table></body></html>
```

---

## Reset password

**Subject:** Reset your password — Aniraku

```html
<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#000000;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;"><span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">Choose a new password for your Aniraku account.</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;"><tr><td style="height:3px;background:#e50914;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td align="center" style="padding:30px 28px 18px;background:#0a0a0a;border-bottom:1px solid #2a2a2a;"><img src="https://www.aniraku.tech/icons/icon-512.png" width="44" height="44" alt="Aniraku" style="display:block;width:44px;height:44px;border:0;border-radius:10px;" /><div style="margin-top:11px;color:#e2e8f0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:2px;line-height:1;">ANIRAKU</div><div style="margin-top:7px;color:#8c8c8c;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Account security</div></td></tr><tr><td style="padding:32px 28px 12px;"><h1 style="margin:0 0 12px;color:#e2e8f0;font-size:26px;line-height:1.25;font-weight:700;">Reset your password</h1><p style="margin:0;color:#b8b8b8;font-size:16px;line-height:1.65;">We received a request to change the password for your Aniraku account.</p></td></tr><tr><td style="padding:18px 28px 24px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#e2e8f0" style="border-radius:10px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;color:#000000;font-size:15px;line-height:1;font-weight:700;text-decoration:none;border-radius:10px;">Choose a new password</a></td></tr></table></td></tr><tr><td style="padding:0 28px 30px;"><p style="margin:0;color:#808080;font-size:12px;line-height:1.6;">If you did not request this change, you can safely ignore this email. Your password will not change unless the link is used.</p></td></tr></table><p style="margin:15px 0 0;color:#666666;font-size:12px;line-height:1.5;text-align:center;">Secure account email from Aniraku</p></td></tr></table></body></html>
```

---

## Invite user

**Subject:** You’re invited to Aniraku

```html
<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#000000;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;"><tr><td style="height:3px;background:#8b5cf6;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td align="center" style="padding:30px 28px 18px;background:#0a0a0a;border-bottom:1px solid #2a2a2a;"><img src="https://www.aniraku.tech/icons/icon-512.png" width="44" height="44" alt="Aniraku" style="display:block;width:44px;height:44px;border:0;border-radius:10px;" /><div style="margin-top:11px;color:#e2e8f0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:2px;line-height:1;">ANIRAKU</div><div style="margin-top:7px;color:#8c8c8c;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Your next story starts here</div></td></tr><tr><td style="padding:32px 28px 12px;"><h1 style="margin:0 0 12px;color:#e2e8f0;font-size:26px;line-height:1.25;font-weight:700;">You’re invited</h1><p style="margin:0;color:#b8b8b8;font-size:16px;line-height:1.65;">You have been invited to join Aniraku. Accept the invitation to create your account.</p></td></tr><tr><td style="padding:18px 28px 24px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#e2e8f0" style="border-radius:10px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;color:#000000;font-size:15px;line-height:1;font-weight:700;text-decoration:none;border-radius:10px;">Accept invitation</a></td></tr></table></td></tr><tr><td style="padding:0 28px 30px;"><p style="margin:0;color:#808080;font-size:12px;line-height:1.6;">If you were not expecting this invitation, you can safely ignore this email.</p></td></tr></table><p style="margin:15px 0 0;color:#666666;font-size:12px;line-height:1.5;text-align:center;">Secure account email from Aniraku</p></td></tr></table></body></html>
```

---

## Change email address

**Subject:** Confirm your new email — Aniraku

```html
<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#000000;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;"><tr><td style="height:3px;background:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td align="center" style="padding:30px 28px 18px;background:#0a0a0a;border-bottom:1px solid #2a2a2a;"><img src="https://www.aniraku.tech/icons/icon-512.png" width="44" height="44" alt="Aniraku" style="display:block;width:44px;height:44px;border:0;border-radius:10px;" /><div style="margin-top:11px;color:#e2e8f0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:2px;line-height:1;">ANIRAKU</div><div style="margin-top:7px;color:#8c8c8c;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Account security</div></td></tr><tr><td style="padding:32px 28px 12px;"><h1 style="margin:0 0 12px;color:#e2e8f0;font-size:26px;line-height:1.25;font-weight:700;">Confirm your new email</h1><p style="margin:0;color:#b8b8b8;font-size:16px;line-height:1.65;">Confirm this address to finish updating your Aniraku account.</p></td></tr><tr><td style="padding:18px 28px 24px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#e2e8f0" style="border-radius:10px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;color:#000000;font-size:15px;line-height:1;font-weight:700;text-decoration:none;border-radius:10px;">Confirm new email</a></td></tr></table></td></tr><tr><td style="padding:0 28px 30px;"><p style="margin:0;color:#808080;font-size:12px;line-height:1.6;">If you did not request this change, contact Aniraku support immediately.</p></td></tr></table><p style="margin:15px 0 0;color:#666666;font-size:12px;line-height:1.5;text-align:center;">Secure account email from Aniraku</p></td></tr></table></body></html>
```

---

## Reauthentication code

**Subject:** Your Aniraku verification code: {{ .Token }}

```html
<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#000000;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#000000;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;"><tr><td style="height:3px;background:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td align="center" style="padding:30px 28px 18px;background:#0a0a0a;border-bottom:1px solid #2a2a2a;"><img src="https://www.aniraku.tech/icons/icon-512.png" width="44" height="44" alt="Aniraku" style="display:block;width:44px;height:44px;border:0;border-radius:10px;" /><div style="margin-top:11px;color:#e2e8f0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:2px;line-height:1;">ANIRAKU</div><div style="margin-top:7px;color:#8c8c8c;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Account security</div></td></tr><tr><td style="padding:32px 28px 12px;"><h1 style="margin:0 0 12px;color:#e2e8f0;font-size:26px;line-height:1.25;font-weight:700;">Verify your identity</h1><p style="margin:0;color:#b8b8b8;font-size:16px;line-height:1.65;">Use the following code to continue:</p></td></tr><tr><td style="padding:18px 28px 24px;"><div style="padding:18px;border:1px solid #2a2a2a;border-radius:10px;background:#000000;color:#e2e8f0;font-size:29px;font-weight:700;letter-spacing:8px;line-height:1;text-align:center;">{{ .Token }}</div></td></tr><tr><td style="padding:0 28px 30px;"><p style="margin:0;color:#808080;font-size:12px;line-height:1.6;">If you did not request this code, you can safely ignore this email.</p></td></tr></table><p style="margin:15px 0 0;color:#666666;font-size:12px;line-height:1.5;text-align:center;">Secure account email from Aniraku</p></td></tr></table></body></html>
```

## Security notification shell

Use the **same black Aniraku shell** above for password changed, email changed, phone changed, MFA factor changes, and identity linking/unlinking. Use a 3px `#e50914` top rule for security-impacting changes, `#e2e8f0` for normal account notices, and keep the sender as `Aniraku <no-reply@auth.aniraku.tech>`.

| Notification | Subject | Main heading | Required body variable |
|---|---|---|---|
| Password changed | Your Aniraku password was changed | Password changed | None |
| Email changed | Your Aniraku email address was changed | Email address changed | `{{ .OldEmail }}` and `{{ .Email }}` |
| Phone changed | Your Aniraku phone number was changed | Phone number changed | `{{ .OldPhone }}` and `{{ .Phone }}` |
| MFA added | A verification method was added to Aniraku | Verification method added | `{{ .FactorType }}` |
| MFA removed | A verification method was removed from Aniraku | Verification method removed | `{{ .FactorType }}` |
| Identity linked | A sign-in method was linked to Aniraku | Sign-in method linked | `{{ .Provider }}` and `{{ .Email }}` |
| Identity unlinked | A sign-in method was removed from Aniraku | Sign-in method removed | `{{ .Provider }}` and `{{ .Email }}` |

## Applying the templates

The prepared HTML must still be pasted into the hosted Supabase Dashboard because the connected database integration does not expose the hosted Auth template configuration endpoint.

1. Open **Supabase Dashboard → Authentication → Email Templates**.
2. Replace the matching subject and HTML for each template above.
3. Set the real sender display name and the verified address `no-reply@auth.aniraku.tech` after SMTP is configured.
4. Ensure `https://www.aniraku.tech` is in the Auth Site URL and redirect allow-list.
5. Disable provider click tracking, because tracking services can rewrite `{{ .ConfirmationURL }}` and invalidate Supabase action links.
6. Send confirmation, recovery, magic-link, and email-change tests to Gmail, Outlook, and a mobile mailbox before enabling production sending.

## SQL upgrade status

Yes—the database was upgraded in the live Aniraku Supabase project. The applied migration added indexes on `comment_likes(user_id)` and `group_members(user_id)`, and fixed the `SECURITY DEFINER` search path for `check_username_available(text)`. The live migration and the reproducible repository migration are named `20260813_safe_performance_and_rpc_hardening`.

The full, current SQL assessment remains in `docs/supabase_schema_audit.md`.
