# ADR-003 — Direct CDN segment fetch with per-provider headers

**Status:** Accepted (user-confirmed)
**Context:** Segment bytes must flow from somewhere. Proxying through the backend multiplies bandwidth cost ×N, creates SSRF/abuse surface, and makes the operator's server the party touching provider CDNs. Providers require Referer/UA (sometimes more) headers.
**Options:** (a) direct CDN fetch from device with per-provider headers; (b) route via Aniraku proxy.
**Decision:** (a). Headers centralized in `nativePlaybackHeaders` (lib/aniraku-api.ts:63); passed only into native task config in memory — never persisted, never logged. Authorization-bearing headers are NOT shipped to the client; such sources stay proxied for streaming and un-downloadable.
**Consequences:** User IP visible to provider CDNs (privacy text updated). Provider header changes can rot downloads → fail + re-resolve. `/api/v1/download` relay retires; SSRF surface narrows to the playback/subtitle proxy (keep allowlist + internal-IP denial).

## Amendment (2026-10, v5.8.0)

- Headers are still centralized, now at `nativePlaybackHeaders` + `downloadRequestHeaders` (lib/aniraku-api.ts, lib/downloads.ts). The download UA **fallback** (when a provider supplies none) is a browser identity — UA-locked CDNs reject app-style UAs; the `X-Requested-With` package marker stays.
- api.aniraku.tech itself now sits behind a browser gate (verified live): the JSON API and media proxy 403 header-less requests. The app's proxy calls carry `anirakuProxyRequestHeaders()` (browser UA + aniraku.tech referer); provider upstream headers are preserved in the proxy `headers` param.
- App-made proxy URLs no longer append a cache-buster nonce — tokenized URLs are unique per fetch and the proxy's edge cache answers repeats.
- The beta segment pool (ADR-005) fetches segments through the player's own data-source factory, so downloads and prefetch both keep the server out of the media path.
