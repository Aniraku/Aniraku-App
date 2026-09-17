`ANIRAKU / RELEASE SIGNAL`

# Changelog

This is the public record of meaningful native Android releases. For the currently installable build, open [GitHub Releases](https://github.com/Aniraku/Aniraku-App/releases/latest).

## Unreleased

## v5.6.8 — Crash fix: startup prefetch guarded behind provider tree

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Fixed APPLICATION STATE crash on launch: `useStartupPrefetch` called `useQueryClient()` before `AppProviders` (QueryClientProvider) was mounted during the font loading phase. Prefetch is now guarded behind `fontsLoaded` — only fires after the provider tree renders.
- Bumps the Android versionCode to 65.

## v5.6.7 — Avatar file-cache, embed fix, duplicate UI cleanup, Random tab, speed

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- AvatarImage rewritten to bypass expo-image/Coil entirely: bytes are fetched with the app's own fetch stack into the cache directory and rendered from `file://` via React Native's native Image. Avatar changes sync immediately (new URI → re-download → re-render). Initial-letter fallback tile always mounted underneath — never a blank box.
- Embed player fix: the "PREPARING VIDEO" placeholder was sharing the layout with the WebView (in-flow flex shell split the area), leaving a permanent panel that also stole touches. Shell is now `absoluteFill` so the WebView owns the full area; placeholder is hidden during embed playback.
- Duplicate SKIP INTRO/OUTRO buttons removed — only the single floating overlay button renders now.
- Duplicate EPISODE ACTIVITY heading removed — `AnimeComments` owns the heading, the redundant `DotLabel` in the watch page was dropped.
- Random tab registered with dice icon (Phosphor `DiceOne`). Random is truly random: `ID_DESC` sort across pages 1–500 (no popularity bias, no genre clustering).
- Schedule and Random compact AniList queries: dropped description, banner, trailer, duration, score, popularity, nextAiringEpisode, relations — 50% payload reduction (164KB → 82KB for 150-title pool, 27KB for 7-day schedule).
- Startup prefetch fires on mount: schedule + random pool are warm before the user taps either tab.
- Bumps the Android versionCode to 64.

## v5.6.6 — NSFW fix: flixcloud kept when it is the only backend server

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Root-caused with title 113417: the backend lists exactly one server (Yuta/flixcloud, embed) and the app filtered it as unsupported → empty → "no streaming" while the website played it (embed page verified HTTP 200 live).
- `getServers` still filters flixcloud when alternatives exist, but keeps it as a last resort when it is the ONLY thing the backend lists — the v5.6.5 embed-first path then mounts it immediately.
- Bumps the Android versionCode to 63.

## v5.6.5 — Gestures restored, NSFW embed-first, Random/Schedule batch, avatar fix

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Double/triple-tap seek restored and hardened: ±10s / −20s / +30s fire on touch-UP (never touch-DOWN), hold-to-keep-skipping works via a 350ms hold timer, fast triple-tap chains never eat the third jump, swipes can no longer trigger seeks.
- NSFW plays like the website: server discovery polls with backoff (2s → 5s → 10s) for cold backend scrapes, and embed-only catalogs mount the first embed immediately without refresh/rotation rounds — no longer gated on the metadata flag.
- Random rewritten: one batched AniList request deals a 150-title pool, picks are instant client-side shuffle-bag deals (no repeats, no per-pick loading, no blank screen).
- Schedule loads in one batched AniList round trip (two aliased pages, one throttle slot).
- AvatarImage rebuilt: fallback tile always mounted underneath (never blank), error state resets on URI change, expo-image caching like all other art.
- Watch episode grid is numbers-only; episode thumbnails now surface in History rows.
- Player scrims slimmed and lightened (0.22/0.10 bands), loading shade 0.52 → 0.32 — no more black veil over the picture.
- Bumps the Android versionCode to 62.

## v5.6.4 — Gesture rewrite: seek deferred to release, avatar & fullscreen fixes

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Gesture rewrite: seek actions (double-tap ±10s, triple-tap −20s/+30s) are now deferred to touch-UP instead of firing on touch-DOWN — eliminates accidental seek when taps meant to toggle controls.
- Two quick taps (<200ms each) both toggle controls, no seek. Only a tap-then-hold (singleTapFired) triggers seek on release.
- 150ms cooldown between any gesture action (seek or toggle) prevents rapid double-fires.
- Stale pending seeks canceled on new touch-down; `seekFiredRef` prevents duplicate seeks during hold.
- AvatarImage rewritten to use React Native's built-in Image (removes expo-image recyclingKey/contentFit/transition/cachePolicy).
- getServers now propagates network errors instead of silently catching; test updated to `rejects.toThrow()`.
- Controls backdrop: removed hard backgroundColor — only edge scrims remain for button readability.
- Controls conditionally rendered via `controlsRendered` state (unmounted when hidden to avoid blocking gesture touches).
- Fullscreen restored: `lockPlatformAsync` for Android with try-catch fallback to `lockAsync`; exit locks portrait before unlock.
- NSFW retry: first empty server attempt waits 1.2s and retries once.
- Bumps the Android versionCode to 61.

## v5.6.3 — Embed parity, backend-only providers & player fixes

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Embed player wears the same frame as the native inline player: scrimmed top bar (back / title / EMBED pill) and scrimmed bottom deck (provider line / fullscreen).
- Providers strictly backend-listed: no fixed fallback names anywhere; server picker only shows servers carrying sources or download links.
- Embed routing fix: embed page URLs can no longer leak into the native direct/proxy chain; NSFW embed-only responses mount immediately.
- Tap show/hide fixed (stale tap coordinate), fullscreen forces landscape on entry, chrome auto-hide restored.
- Schedule/Random faster: AniList throttle 2.1s → 0.9s, 5-min cache on both tabs.
- Read episodes never re-trigger outside notifications (episode-stable dedupe, immune to Sub→Sub&Dub flip).
- Avatars never render blank: new AvatarImage with error fallback, used in profile, grid, and comments.
- Ships three builds: `arm64`, `arm32`, and `universal` (universal contains all architectures).
- Bumps the Android versionCode to 60.

## v5.6.2 — Player gestures, downloads & playback honesty

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Player gestures rewritten as a zoned state machine: outer-left swipe = brightness, outer-right swipe = volume, center hold = 2x, double/triple-tap = seek (−10s/+10s, −20s/+30s), center taps = play/pause. Gestures can no longer fire together.
- Downloads match the backend: quality picker (1080p/720p/…) when offered, direct open otherwise; external pages open in the browser behind a "You're leaving Aniraku" confirmation; SUB/DUB lists separate.
- NSFW embed fallback: embed-only titles no longer die at server discovery — the embed mounts inline in the WebView.
- Removed auto-next and auto-skip: a persistent UP NEXT card near the finish line waits for manual PLAY NOW or dismiss. Manual Skip Intro/Outro unchanged.
- Notification bell opens an in-app bottom sheet (unread/all, mark-read) instead of the profile page.
- VIEW ALL / See all open filtered search (Trending, Ongoing, Popular, Top Movies, Top in genre, Coming Soon).
- Ships three builds: `arm64`, `arm32`, and `universal` (universal contains all architectures).
- Bumps the Android versionCode to 59.

## v5.6.0 — Anilab successor: animated UI, GOATED player, onboarding

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Animated skeleton loading: pulse animation on all loading states (hero, cards, rails, episodes) — no more static gray blocks.
- GOATED video player: animated controls overlay with smooth fade/slide, brightness/volume gesture sliders with spring animation, animated double-tap seek ripples, fast-forward badge with spring transition, loading spinner.
- Haptic feedback on every key interaction: episode select, server switch, language toggle, play/pause, seek, hero card press, trending card press.
- Episode grid thumbnails: each episode button now shows its thumbnail image with a dark overlay when available.
- First-run onboarding: 3-page intro flow (Watch freely, Track everything, Make it yours) with dot indicators and skip option.
- Personality empty states: contextual empty states for search, episodes, library, history, schedule, and comments with icons and action buttons.
- Custom pull-to-refresh component with consistent theming.
- Smooth page transitions: fade animation between all screens (already in _layout.tsx).
- Ships three builds: `arm64`, `arm32`, and `universal` (universal contains all architectures).
- Bumps the Android versionCode to 57.

## v5.4.4 — Phosphor icons + compact player redesign

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Replaced all Ionicons/MaterialCommunityIcons in the player with Phosphor Icons for a polished, consistent look.
- Top bar: back, title, speed icon, subtitle icon, server pill, settings gear.
- Settings panel stripped to quality selection only — inline list, no modal.
- Speed and subtitle selection moved to top bar icon buttons.
- Action rail: volume, skip-10, prev-ep, play/pause, next-ep, skip-10, fullscreen.
- Chapter markers now yellow (#FFD600) for intro/outro.
- Backward/forward seek buttons: thin SkipBack/SkipForward icons.
- All control sizes trimmed ~15-20% for compact inline player.
- Bumps the Android versionCode to 55.

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
