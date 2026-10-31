# 06 — Threat Model (native offline downloads build)

## Assets
- **A1** Downloaded segments + AES-128 key files — app-private storage.
- **A2** Provider header credentials (Referer/UA, occasionally Authorization) in stream responses and download-job configs.
- **A3** Auth session — server cookie (server/_core/cookies) + keychain token (lib/secure-storage.ts).
- **A4** User library data (progress, bookmarks, alerts) synced to backend.

## Trust boundaries
- **TB1** App ↔ provider CDNs (direct segment/key fetch — new).
- **TB2** App ↔ Aniraku backend (metadata/auth; **residual proxy**: proxied playback and subtitles route `/api/v1/proxy` — lib/hls-variants.ts, lib/hls-variants playbackUrl wrapper). **Identity contract (2026-10, verified live):** every request to api.aniraku.tech — JSON API, manifests, subtitles, every player-fetched segment — carries a browser UA + `aniraku.tech` referer (`anirakuProxyRequestHeaders`, lib/aniraku-api.ts); the CDN gate 403s header-less requests. Provider upstream headers ride in the proxy URL's `headers` param and are preserved, never clobbered. App-made proxy URLs carry no cache-buster nonce (edge cache answers repeats). Downloads stay off the server path per ADR-003 (`originalStreamUrl` unwrap, lib/downloads.ts).
- **TB3** App ↔ device (offline files; readable on rooted devices — accepted).

## STRIDE
| Boundary | Key threats | Posture |
|---|---|---|
| TB1 CDN | **Info-Disclosure**: header credentials in job configs — today `OfflineDownload.downloadUrl` embeds provider headers as query JSON into the AsyncStorage index (lib/downloads.ts:548 + lib/aniraku-api.ts:90-92). Post-change: headers live only in native task config in memory; never persisted, never logged. **Tampering/Inj**: malicious playlists — absolute https segment URLs only; reject `../`/`file:`/relative escapes; cap playlist size + per-episode byte/segment budget before enqueue (quotaMb is per-queue, not per-playlist). **EoP**: key files plaintext — acceptable (third-party-published content, lawful playback access); no DRM-grade claims. Token-rot: on 403, re-resolve stream → fresh headers; never reuse stale job creds (expiry check lib/aniraku-api.ts:60). |
| TB2 Backend | **SSRF residual narrows**: `/api/v1/download` retires (confirm callers deleted); `/api/v1/proxy` remains for proxied playback/subtitles — keep origin allowlist + internal-IP denial server-side. Spoofing: session cookie theft → standard web mitigations. |
| TB3 Device | Info-disclosure via root/file manager — accepted by design (app-private, unencrypted). Repudiation n/a (local-only). |

## Authz matrix
| Resource | Own | Others |
|---|---|---|
| Downloads | full (local-only, device-bound) | none — no server exposure |
| Bookmarks/progress/alerts | full via session | none — server-scoped per user (verify protectedProcedure on write routers) |
| Account data | delete/export self-service | none |

## Abuse cases
- **Mass-download**: quotaMb + wifiOnly + 1-concurrent are *self*-limits; direct CDN removes server-side visibility. Real risk: provider CDN bans that also break playback (red line). Mitigation: per-provider politeness delay, segment concurrency cap, retry backoff.
- **Header replay**: Referer/UA are replayable by design (not secrets) — low. Do not ship Authorization-bearing provider headers to the client; force proxied mode for those sources.
- **Background service**: wake-lock abuse — cap retries while backgrounded.

## OWASP Mobile (new surface only)
- M1: provider headers client-side (new) — minimize set.
- M4: playlist/segment URL parsing = primary new input boundary.
- M2: native download dependency vetting; app-update path pins github origin + size but **no APK signature check** (lib/android-app-installer.ts:33-47) — add signed-asset verification.
- M7: sideloaded, unobfuscated — accepted.
- M3/M5/M6/M8/M9/M10: no new surface; M10 positive — no analytics SDK (grep clean).

## Privacy
Leaves device: metadata/auth/library sync. **New**: user IP + Referer/UA now visible to provider CDNs directly (previously server-mediated for proxied sources). Update PRIVACY text in app/legal.tsx — "Provider tokens stay server-side and never enter the app" becomes stale; reword to "provider Referer/UA only, no credentials." No telemetry — keep (privacy-positive).

## DMCA posture (improved)
App-private-only + no share/export + external links removed strengthens the non-facilitation narrative: copies sandboxed, non-copyable by design, deleted with app data. Update DMCA.md Scope: offline copies are app-sandboxed; remedy remains delisting routes; no server hosting or caching of media.

## New consent/auth surfaces (round-6)
- Signup email validation runs client-side only (no pre-send server probe — avoids new abuse surface).
- Consent acceptance records: versioned string in user profile (server) + local; deletion/export endpoints must be auth-scoped to the owning session and rate-limited.
