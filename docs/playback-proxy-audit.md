# Playback Proxy Audit

## Authoritative Sources

- [Aniraku main Watch page](https://github.com/Aniraku/Aniraku/blob/main/src/pages/Watch.jsx)
- [Aniraku main configuration](https://github.com/Aniraku/Aniraku/blob/main/src/config.js)
- [Expo Video documentation](https://docs.expo.dev/versions/latest/sdk/video/)
- [Expo WebView documentation](https://docs.expo.dev/versions/latest/sdk/webview/)

## Main Frontend Strategy

The main frontend defines `PROXY_BASE` as `${API_BASE}/api/v1` by default and constructs browser media proxy URLs as `/proxy?url=<encoded-source>&headers=<encoded-json>&rn=<nonce>`. The nonce is deliberately refreshed for each player build so that browser-edge cache variants cannot be reused. Browser playback tries the proxy before direct media because CORS and provider header restrictions apply in browser video elements.

The web Watch page classifies HLS, DASH, MP4, WebM, Ogg, MPEG, extensionless direct media, and page/embed sources. It keeps non-dead, non-expired direct media sources, prefers an Auto/adaptive source before higher numeric quality variants, and uses provider failover when a selected source cannot begin. Embed/page sources are identified separately rather than passed to the direct decoder.

## Native Application Decision

Android Expo Video uses the platform media engine and can attach retained request headers directly to HLS, DASH, MP4, WebM, and other directly decodable URLs. The native client should therefore prefer the direct real `api.aniraku.tech` source with Android-safe headers; it must not unnecessarily route direct media through the browser proxy. Browser-only headers such as `User-Agent`, `Host`, `Origin`, and connection-managed headers must remain stripped.

Verified provider page/embed URLs are not direct media and are routed to a dedicated native WebView fallback. This preserves a playable option without pretending an HTML page is an ExoPlayer media source. Embed availability remains provider- and host-policy-dependent.

## Live Contract Sample

On 2026-08-14, `GET https://api.aniraku.tech/api/v1/servers?animeId=21&episode=1&lang=sub` returned live initial sources for `ally` as MP4 and `pewe` as HLS. The `ally` stream response returned an MP4 URL, `Referer: https://allanime.day/`, a browser `User-Agent`, and provider intro/outro intervals. The native transport should retain the Referer while allowing ExoPlayer to supply its own user agent.

## Mobile Streaming Interaction Lessons

Research of current mainstream anime-streaming product material reinforces that the visible viewer flow should lead with the show, an obvious play action, audio language, captions, playback speed, save/watchlist, episode continuation, and short recovery actions. Technical source names and transport states should be secondary and appear only when a user opens the playback options. [Crunchyroll product listing](https://apps.apple.com/us/app/crunchyroll/id329913454)

Playback settings should remain accessible and persistent: language choice, caption track, playback speed, intro/outro skipping, and accessible control labels are practical controls—not developer diagnostics. [Crunchyroll accessibility guidance](https://help.crunchyroll.com/hc/en-us/articles/38490084665108-Accessibility-Features-on-Crunchyroll)
