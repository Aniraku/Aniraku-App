# Security Policy

## Reporting a vulnerability

Please report security concerns privately to **security@aniraku.tech**. Include a clear description, reproduction steps, affected app version or endpoint, and a safe proof of concept where possible. Do not include credentials, user data, access tokens, private keys, or destructive payloads.

The supported release line is the latest production native Android build. Reports are assessed for impact, reproducibility, affected scope, and mitigation availability. Aniraku aims to acknowledge credible reports and coordinate a responsible resolution before public disclosure.

## Client security expectations

The native app includes only public client configuration. It must not ship Supabase service-role credentials, private backend keys, signing keys, or unverified provider secrets. Supabase sessions are stored through encrypted native storage, account removal is server-authorized, and direct stream URLs are treated as short-lived runtime values rather than durable client data.
