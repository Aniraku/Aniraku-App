# Embedded Provider Diagnosis

## Kwik provider check — 2026-08-15

The live Aniraku server payload for AniList 16498, Episode 1 exposes verified `embed` sources from `kwik.cx`. A header request with the Aniraku provider Referer returned HTTP 200 and session cookies, but the sandbox Chromium browser was served a Cloudflare block page. This means an Android WebView must not immediately mark an embed provider as permanently unavailable merely because individual resource requests return HTTP errors. It should preserve the WebView session, allow media and redirected navigation, and surface a user-visible fallback only after a main-frame navigation error or user-confirmed failure.
