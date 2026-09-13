`ANIRAKU / RELEASE SIGNAL`

# Changelog

This is the public record of meaningful native Android releases. For the currently installable build, open [GitHub Releases](https://github.com/Aniraku/Aniraku-App/releases/latest).

## v5.4.3 — Subtitle & fullscreen overhaul

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Fixed subtitle parser: accepts VTT/SRT/ASS timestamp formats (`hh:mm:ss`, `mm:ss`, `ss.mmm`), proxied URL format detection (decodes `%2F` paths), content-sniffing fallback when URL detection fails, language normalization (`english` → `en`, `en-US` → `en`), cue text cleaning (HTML entities, style tags).
- Fixed subtitle loading: HTTP status check before parsing, fetch headers for CORS, proxy URL detection, `matchSubtitleTrack` for language matching, subtitle preferences now persist via `saveSubtitlePreferences`, subtitle wrapper positioned above timeline in fullscreen.
- Fixed fullscreen: `enterFullscreen()` closes all modals and forces controls visible, back button exits fullscreen first before leaving screen, fullscreen shell gets `zIndex: 50` + black background, landscape padding wider, auto-hide reset includes fullscreen toggle.
- Fixed dead controls: SUB pill badge opens server modal, Settings QUALITY button opens quality modal, Settings SERVER button opens server modal, selections close modals properly.
- Server list accepts all servers from the backend (Momo, Niko, Ally, Pewe, etc.); only Flixcloud filtered out; deduplicates by display name.
- Embed player mounts only as last resort after ALL servers return no direct/proxy sources.
- Controls overflow fixed: top bar compact inline (speed/PiP only in fullscreen), gaps 10→2, buttons 36→32dp, title shrinks, bottom rail reduced, orientation-lock/download hidden in inline mode.
- Watch preferences (autoNext, autoSkip, speed) now persist correctly (autoSkip was missing from save dependency array).
- Ships three builds: `arm64`, `arm32`, and `universal` (universal contains all architectures).
- Bumps the Android versionCode to 54.

## v5.4.1 — Subtitle cue fix

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Fixes subtitles never showing on Watch: the VTT parser dropped every cue when the timestamp line uses the standard ` --> ` separator with spaces (end-time split produced an empty string → `NaN`). `lib/subtitle-parser.ts` now trims before splitting; verified live against a real proxied `eng-2.vtt` (304 cues parsed, correct active cue at 43s, empty at 10s, `enabled:false` stays hidden).
- Ships three builds: `arm64`, `arm32`, and `universal` (universal contains all architectures).
- Bumps the Android versionCode to 52.

## v5.4.0 — Watch playback fix + font unification

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Fixes `PLAYER · ExoPlaybackException: ERROR_CODE_IO_BAD_HTTP_STATUS` on `SERVER · MOMO · PROXY`.
- Root cause: the backend now returns pre-proxied stream URLs (`/api/v1/proxy?...`, `verification: "proxy"`) and the client wrapped them a second time. The backend rejects proxy-of-proxy targets with `403 {"error":"proxy target not allowed"}`. `lib/aniraku-api.ts` now detects already-proxied URLs (`isAnirakuProxyUrl`) and plays them as-is; `app/watch/[id].tsx` applies the same guard for the video source and headers.
- TRY AGAIN / SWITCH SERVER now recover instead of replaying the same 403: Momo and Niko resolve to the same upstream, so the fix is at URL construction, not provider hopping.
- Unifies the Watch page typography with the rest of the app: removes `Caveat-Bold` / `HennyPenny-Regular` headings on Watch (`You are watching`, `List of episodes`, player title, skip pill, quality/source rows) in favor of the standard SpaceGrotesk sizes (`21 / 900` section headings, `14 / 700` player title, `13 / 900` pills) plus monospace eyebrows — matching Anime-detail and other screens. Sleep-timer heading/pill and comment reply bar updated to match.
- Ships three builds: `arm64`, `arm32`, and `universal` (universal contains all architectures).
- Bumps the Android versionCode to 51.

## v5.3.0 — Minor bug fixes

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Fixes the `cannot add 'postgres_changes' callbacks for realtime:watch-history … after 'subscribe()'` crash that forced the "Aniraku needs to restart this screen" state.
- Root cause was in `useWatchHistory` (shared by Anime-detail `app/anime/[id].tsx` and Watch `app/watch/[id].tsx`): both screens stay mounted in the router stack and opened the same realtime topic, so the second subscription threw. Each screen now uses its own realtime topic and realtime failures degrade gracefully instead of crashing.
- Ships three builds: `arm64`, `arm32`, and `universal` (universal contains all architectures).
- Removes the unused GIF picker and Giphy API integration from comments (comments are text-only now).
- Minor bug fixes and stability improvements.
- Bumps the Android versionCode to 50.

## v4.8.1 — Niko and Momo Provider Support

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Adds native provider-family routing for Niko and Momo.
- Preserves direct, proxy, and verified embedded playback for both providers.
- Keeps the existing provider fallback and release build configuration intact.

## v4.8.0 — FlixCloud Provider Release

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Adds Yuta and Syota servers powered by FlixCloud, scraped from AnimeX watch pages.
- FlixCloud provides dual-audio embed sources with both Sub and Dub tracks selectable from the player's audio settings.
- Servers appear alongside existing Miruro providers (Bonk, Pewe, Ally) when the backend resolves sources from AnimeX.
- Fixes a routing issue where switching to FlixCloud servers sent the individual server name instead of the provider family to the stream endpoint.
- Retains future-release protection, exact episode metadata, AniList client, Schedule, buffering indicator, Downloads, fullscreen, AniSkip, and Relations.

## v4.6.2 — Stable direct-client release

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Moves public AniList metadata reads to the native client instead of sending them through the shared Aniraku backend IP.
- Adds client-side request coalescing, bounded pacing, response caching, stale-cache recovery, and Retry-After handling.
- Consolidates the Home AniList request into one GraphQL operation to reduce startup traffic.
- Increments the Android versionCode to 44 and preserves the compatibility-focused legacy architecture configuration.
- Publishes a universal APK with packaged JavaScript, ARM32/ARM64 libraries, and a SHA-256 verification sidecar.

## v4.2 — Rebuffer continuity

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Fixes the periodic Watch-history refresh that could be treated as a new initial resume request after playback had already started.
- Prevents rebuffer recovery from explicitly seeking backward to an older synchronized position, preserving the active forward buffer and avoiding the associated repeated decoded frame.
- Applies persisted history only once during fresh source startup and uses Android's efficient single-player surface.
- Retains the 120-second time-priority reserve, 20-second recovery cushion, automatic byte allocator, adaptive persistent cache, provider parity, source recovery, Downloads eligibility, fullscreen, AniSkip, and Relations.

## v4.1.2 — Playback continuity

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Extends the native Media3 time-priority reserve to 120 seconds and raises the recovery cushion to 20 seconds before playback resumes after buffering.
- Retains automatic byte allocation rather than forcing a small application-level byte ceiling.
- Sizes Android persistent video caching from 256 MiB to 4 GiB based on available device storage while retaining 2 GiB free for Android.
- Preserves the no-corrective-seek rebuffer path, provider parity, source recovery, Downloads eligibility, fullscreen, AniSkip, and Relations.

## v2.0.Alpha — New package identity

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Migrates the Android application identity from `aniraku.anine.app` to `aniraku.anime.app`.
- Requires removal of the legacy alpha before installation; Android treats the new package as a separate app.
- Carries forward native playback continuity correction, direct quality selection, bounded forward preload, faster source startup, and the compact Nothing OS-inspired player surface.
- Publishes the universal release APK through GitHub and the public Orion Store path.

## v1.8.Alpha — Playback control and preload

- Added direct in-player quality selection for provider-supplied variants such as 1080p, 720p, and 480p.
- Increased bounded forward media preload to 45 seconds without deliberately delaying initial playback.

## v1.7.Alpha — Rebuffer continuity

- Added native rebuffer-resume correction to prevent an eligible buffering recovery from visibly replaying a prior frame.

## v1.0.Alpha — Native foundation

- Replaced the prior wrapper approach with a native Android application built with Expo and React Native.
- Shipped discovery, account synchronization, native playback coordination, library functions, and direct-distribution release tooling.

---

`SIGNAL / CURRENT BUILD FIRST`

[README](./README.md) · [Latest release](https://github.com/Aniraku/Aniraku-App/releases/latest) · [Security](./SECURITY.md) · [Contributing](./CONTRIBUTING.md)
