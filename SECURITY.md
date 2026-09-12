# Security

If you find a vulnerability, report it privately before publishing details. Good reports help protect people’s accounts, watch history, and devices.

## Report a concern

Send a concise report to **[Aniraku@Security](mailto:sho.islam0311@proton.me)**. Include the affected version or endpoint, a clear description, reproduction steps, impact, and a safe proof of concept where possible. Do not include credentials, access tokens, private keys, user data, or destructive payloads.

| `SUPPORTED LINE` | `TRIAGE` | `DISCLOSURE` |
| --- | --- | --- |
| The latest production native Android release. | Reports are assessed for impact, reproducibility, affected scope, and a viable mitigation. | Credible findings are acknowledged and resolved responsibly before public disclosure where practical. |

## Client security boundary

The native app includes only public client configuration. It must never ship Supabase service-role credentials, private backend keys, signing keys, or provider secrets. Supabase sessions are held through encrypted native storage; account deletion is server-authorized; and direct stream URLs are treated as short-lived runtime values rather than durable client data.

---

`See also`

[README](./README.md) · [Privacy](./PRIVACY.md) · [Terms](./TERMS.md) · [Security](./SECURITY.md) · [DMCA](./DMCA.md) · [Contributing](./CONTRIBUTING.md)
