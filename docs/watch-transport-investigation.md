# Watch Transport Investigation

## 2026-08-15: Persistent Android 0:00 buffering

The live Aniraku stream payload for AniList title `16498`, Episode `1`, SUB provider `ally` returned a Wix HLS master stream and a verified OK.ru embed fallback. The Aniraku proxy returned a valid rewritten HLS master playlist with variant URLs routed back through `/api/v1/proxy`.

> The main playlist was reachable through the proxy, but `HEAD` requests against both nested proxy playlist and segment URLs returned HTTP `405 Method Not Allowed`. This does not by itself prove GET media delivery fails, because Android media playback uses GET/range requests; the next probe must validate actual GET/range responses and codec-compatible variant delivery.

The native player previously considered `playingChange` sufficient proof of startup. The observed device screenshot proves that a request to play can coexist with a 0:00 buffering surface, so startup now requires either first-frame rendering or advancing playback time.

## 2026-08-15: Samsung Android 15 bug report

The supplied `a05sddxx` Android 15 bug report records the Aniraku Media3 session in `BUFFERING` at `position=0`, `buffered position=0`, and `speed=0.0`, with no media-session error. This confirms that the affected device can remain in a silent buffering state without generating a native error callback.

The live proxy was checked with a real Aniraku HLS variant and returned a readable playlist plus a range-capable MPEG-TS segment (`206 Partial Content`, `video/mp2t`). The correction therefore treats lack of first-frame/time progress as a recoverable transport failure instead of waiting for a nonexistent player error: it gives proxy delivery and direct delivery one short attempt each, then switches to the provider’s verified embed, where Audio & Provider remains visible for another server or language choice.

## 2026-08-15: Live backend and Miruro contract validation

The deployed Aniraku backend was reachable for the screenshot titles. For Attack on Titan (AniList `16498`), the canonical episodes endpoint, SUB/DUB server discovery, `ally` stream resolution, proxy HLS response, and verified embed all returned successfully. The representative three-title probe completed six language checks with six successful proxy responses. The tested Attack on Titan HLS master returned HTTP 200 with `application/vnd.apple.mpegurl` using Referer-only, full browser, and Android-style user-agent requests.

For Black Torch (AniList `187538`), live Aniraku metadata and seven canonical episodes returned successfully. Its SUB server discovery returned Bonk, Ally, and Pewe. The Bonk stream response supplied proxy HLS, direct HLS, and embed candidates; its primary HLS path returned HTTP 200 through the Aniraku proxy.

The selected Miruro v3 source repository and its public API (`https://miruro-api-v3.onrender.com/`) returned Attack on Titan and Black Torch episode contracts plus provider watch sources. Miruro emits the same kinds of HLS/MP4/embed URLs and Referer metadata that Aniraku returns. Its implementation explicitly requires a browser-aware ViperTLS session because Miruro's upstream may block some data-center environments, but it was not globally unavailable during this validation.

These checks rule out a general Aniraku or Miruro discovery outage at test time. They do not prove Android Media3 can decode every third-party source, and the Samsung bug report still shows a silent native buffering state without a player error. The next correction must therefore focus on source replacement/lifecycle behavior or move verified embeds earlier for sources that Media3 does not start.
