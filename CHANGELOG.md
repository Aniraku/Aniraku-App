`ANIRAKU / RELEASE SIGNAL`

# Changelog

This is the public record of meaningful native Android releases. For the currently installable build, open [GitHub Releases](https://github.com/Aniraku/Aniraku-App/releases/latest).

## Unreleased

## v5.8.4 — Offline subtitles hardened through the proxy gate

`CURRENT / HOTFIX / INSTALLS OVER v5.8.0–v5.8.3`

Offline downloads carry the episode's subtitle tracks beside the video — but the subtitle fetch rode the Aniraku proxy **without the browser identity headers**, and the backend gate 403s header-less requests. Failed fetches were silently skipped, so some offline bundles saved without subtitles. Every subtitle fetch now carries the same identity as every other proxy hop.

### Fixed
- **Offline subtitles could be silently skipped**: subtitle downloads through the proxy now send the browser UA + Aniraku referer, matching every other proxied byte in the app.

## v5.8.3 — Proxy-only playback and downloads

## v5.8.3 — Proxy-only playback and downloads

`CURRENT / OPERATOR POLICY / INSTALLS OVER v5.8.0–v5.8.2`

Operator decision: provider CDNs 403 direct device fetches (non-browser TLS fingerprints), so the app now rides the Aniraku proxy for every remote byte — the same policy the website has always used. No more direct attempts, watchdog churn, or 403 toasts on SORA-class providers.

### Changed
- **Proxy-only playback**: every remote source mounts through the Aniraku proxy (provider upstream headers travel in the proxy URL's `headers` param; the player presents the browser identity to api.aniraku.tech).
- **Proxy-only downloads — progressive MP4s**: bytes stream through the proxy into the destination file (no more `downloadFileAsync` 403s on SORA-class CDNs).
- **Proxy-only HLS downloads**: playlist, key, and every segment/key fetch in the native pipeline ride the proxy.
- **Proxy-only size estimates**: the download sheet's playlist estimates and HEAD probes ride the proxy — real sizes on picky CDNs.

### Why the direct path is gone
Direct device fetches were 403'd by the picky CDNs regardless of headers (TLS-fingerprint blocking) — verified against settlar-class and SORA-class hosts. Every direct attempt only wasted the 6-second startup watchdog and produced failed downloads. The proxy hop is the one path that works everywhere, and it is the website's own policy.

## v5.8.2 — Downloads for every HLS provider + email-verification relay

## v5.8.2 — Downloads for every HLS provider + email-verification relay

`CURRENT / HOTFIX / INSTALLS OVER v5.8.0–v5.8.1`

Two field reports fixed in one pass: HLS downloads were refused on providers without a multi-rendition master (the "direct progressive source is required" message), and sign-up email verification could dead-end when the confirmation link opened the website instead of the app.

### Fixed
- **HLS downloads refused**: the download gate required a "native" (progressive) source type for the HLS branch — an m3u8 source types as "hls", so every HLS download was refused before starting. The gate now keys off the URL/mime itself; dead sources stay refused.
- **Single-rendition + direct media playlists are downloadable**: providers whose master has one rendition (or serves a media playlist directly) expose the playlist itself to the downloader — the same input the website's downloader accepts.
- **Proxy fallback for downloads**: CDNs that block non-browser TLS fingerprints (the settlar class) fall back to the Aniraku proxy per segment/key — the website's direct→proxy ladder, now in the native pipeline.
- **Email verification relay**: aniraku.tech/auth/confirm verifies the confirmation token server-side and bounces back into the app via the deep link; the app also auto-detects a web-confirmed account when you return and signs you in.

## v5.8.1 — Hotfix: watch-screen episode list crash + diagnosable error screen

## v5.8.1 — Hotfix: watch-screen episode list crash + diagnosable error screen

`CURRENT / HOTFIX / INSTALLS OVER v5.8.0`

Fixes a crash reported minutes after the v5.8.0 release, and makes any future crash instantly diagnosable.

### Fixed
- **Watch screen crash** ("Text strings must be rendered within a <Text> component"): the episode selector rendered the episode number as a bare number inside a View — any episode-list open killed the screen. Now wrapped in Text.

### Added
- **Error screen DETAILS**: the "needs to restart" screen now exposes the full component stack behind a SHOW DETAILS toggle — a screenshot of it pinpoints any future crash to the exact component.

### Note
- v5.8.1 installs directly over v5.8.0 (same stable signing key — no uninstall needed).

## v5.8.0 — Offline downloads, push notifications, the playback-header fix

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

The largest gap-closer yet: real in-app offline downloads, new-episode push notifications, and a fix for the proxied-playback header contract that quietly degraded streaming behind the CDN gate.

### Added
- **Offline downloads (Android)**: per-quality in-app downloads on a native foreground-service pipeline — HLS bundles (AES-128 keys included) and progressive files, honest per-row size estimates, storage preflight, a Wi-Fi-only hold, integrity-verified bundles, and offline playback with the saved subtitles (`modules/aniraku-downloads/`, `components/download-sheet.tsx`, `app/downloads.tsx`).
- **Push notifications**: new-episode alerts for tracked anime, comment replies, and system announcements — Expo push relayed through the Supabase edge functions (`check-new-episodes`, `send-push`, `send-campaign`), with per-category settings and tokens cleaned up on sign-out and account deletion.
- **Parallel segment pool (beta)**: the player's native twin of the website's hlsPrefetch — ExoPlayer reads through a disk cache while upcoming segments prefetch 8-ahead / 3-in-flight. Off in production builds; enabled in preview builds via `EXPO_PUBLIC_SEGMENT_POOL=1` (`modules/aniraku-stream-pool/`, ADR-005).
- **Non-HLS quality menus**: quality chips built from the sources the provider actually returned and mounted directly, multi-quality download rows for progressive episodes, and codec-labeled HLS download rows.
- **18+ content locks**: first-run consent flow and an age gate for adult titles.

### Fixed
- **Proxied playback 403s**: every request to api.aniraku.tech — JSON API, manifests, subtitles, and every player-fetched segment — now carries the browser identity the CDN gate requires, while provider upstream headers (e.g. settlar's ani.pm referer) are preserved instead of clobbered. Verified live end-to-end on multiple providers.
- **Cache-defeating nonce**: app-made proxy URLs no longer append a unique cache-buster, so the proxy's edge cache answers repeat requests (repeat fetch ~3× faster).
- **Icons that rendered as "X"**: missing glyphs (history, bookmark, comment, dice, fire, logout) added or corrected.
- **Push token leaks**: tokens are unregistered on sign-out and deleted with the account.
- **Dead TMDB resolver removed**: episode metadata and thumbnails are merged server-side (AniZip + TMDB) in `/api/v1/anime/:id/episodes`; the client's legacy per-mount resolver call — which had been silently receiving the website's HTML instead of JSON — is gone, so episodes now load with one request instead of three.
- **INFO panel mislabeling**: progressive MP4 sources no longer show as "HLS"; the Source row states Proxied/Direct honestly.
- Removed dead template code (OAuth portal callback, tRPC remnants) and dead exports.

## v5.7.9 — App-styled popups, trending quick actions, gesture fixes

`STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

Replaces the stock Android dialogs with themed in-app sheets, adds a long-press quick-action overlay on Home trending, and fixes player-gesture edge cases.

### Changed
- **Themed pickers everywhere**: the save-to-list picker, the Saved-tab change-status picker, and the NSFW age-verification prompt in Settings now render as in-app "nothing"-styled bottom sheets (dark surface, mono kicker, red accents) instead of stock Android alert dialogs; tap the backdrop to dismiss (`components/choice-sheet.tsx`).
- **Home Trending quick actions**: long-press a trending card for a minimal themed overlay — Save to My List (opens the list picker; already-saved titles offer Remove) or Watch (resumes your progress, else episode 1).

### Fixed
- **Accidental double-tap seeks**: a gesture cancelled mid-touch (finger drifting sideways, or a 2x-hold drifting off) left a stale tap behind — the next tap could fire an unintended ±10s jump. The tap chain now resets on every cancelled gesture.
- **Episode grid stuck mid-swipe**: swiping episodes with the touch stolen (call, notification) could leave the grid parked off-center with no release to spring it back. A terminate handler now resets it.
- **Pre-load seeks**: double-tap seeking before the video's duration was known sought against a fake 999999s ceiling; those taps are now ignored until the video is ready.

### Housekeeping
- tsc clean; tests green; ESLint 0 errors / 69 warnings (at baseline).
- Android versionCode: 76.

## v5.7.8 — Save-time list picker (AniList/MAL-style)

`STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

Refines the v5.7.7 Saved-category picker into the AniList/MAL "add to list" flow.

### Changed
- **Pick the list as you save**: tapping Save on a title now asks which list it should go to — Watching, Plan to Watch, Completed, or Dropped — before adding it, instead of silently filing it under Plan to Watch. Works from the anime page, the Home hero, and the card menu. You can still change a saved title's list later by long-pressing its row (or tapping its status badge) in the Saved tab (`hooks/use-bookmarks.ts`).

### Housekeeping
- tsc clean; tests green; ESLint 0 errors / 69 warnings (at baseline).
- Android versionCode: 75.

## v5.7.7 — Saved categories + Support announcements & Binance Pay QR

`STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

A user-requested list-organization release, plus the announcement + donation work prepared as v5.7.6 (folded in here — v5.7.6 was never published).

### Added
- **Category-wise Saved statuses**: a status picker on the Saved list so each saved title can be set to Watching, Plan to Watch, Completed, or Dropped. Long-press a saved row — or tap its status badge in list or grid view — to choose a category. The choice persists to the `bookmarks.status` column and drives the existing Saved filter chips and badges (`lib/list-status.ts`, `hooks/use-bookmarks.ts`).
- **In-app announcement prompt**: a dismissible support dialog (`components/announcement-banner.tsx`) that fetches `site/announcements.json` from raw GitHub — independent of the streaming backend — so announcements can be posted and edited without a new Android release. Dismissal is session-only (in-memory), so the prompt returns on every app open, and nothing renders when offline.
- **Binance Pay QR code** on the Support screen (`app/support.tsx`), beside the existing UID + copy button, so donors can scan to pay in one step (original QR, Binance logo intact).
- **Website announcement system**: a dismissible top banner plus a News archive section, both driven by `site/announcements.json`; dismissal is session-scoped (`sessionStorage`).
- **Docs**: `README.md` and `SUPPORT.md` now carry the backend-limit donation appeal and the Binance Pay QR.

### Notes
- **MAL / AniList sync**: both run entirely through the Aniraku backend (`api.aniraku.tech/api/v1/sync/...`); there is no app-side MAL client. They error only when that backend is down or MAL isn't configured server-side — so the failure is a backend issue, not an app bug, and the Settings option stays.
- Single source of truth: edit `site/announcements.json` and push to update the website banner, the News section, and the in-app prompt — no rebuild required.
- Removed the orphaned, unreferenced `usdt-bep20-support-qr.png` assets.

### Housekeeping
- tsc clean; tests green; ESLint 0 errors / 69 warnings (at baseline).
- Android versionCode: 74.

## v5.7.5 — Watch History, Saved progress & import reconciliation

`STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

The sync-truth release: Watch History, Saved titles, and Export-Import now match the reconciling backend (which trims stale import rows and exports only episodes you actually watched).

### Fixed
- **Watch History ordering after imports.** History and Continue Watching now order by the row's watch `timestamp` instead of `updated_at`. Import backdates `timestamp` to the real watch window but stamps `updated_at` with import time, so a bulk import used to flood the top of History and Continue Watching with titles you never watched that day.
- **History no longer renders one row per episode.** The History tab and the Home Continue Watching rail show one row/card per title (the most recent watch) — an imported 148-episode title can no longer bury the entire list. Long-pressing a history row removes that title's whole episode history, and the confirm dialog says exactly that.
- **Import immediately refreshes History.** Running an Import now invalidates the watch-history cache, so History, resume rails, and Saved progress update the moment the import lands instead of waiting for a later refetch.
- **Saved episode totals actually render.** Saved rows and grid cards read the bookmark's `total_episodes` field (they previously read a field that never existed, so the `N EP` meta never showed).

### Added
- **Saved progress display.** Saved rows and grid cards now show real progress — `6/12 EP` — from distinct episodes ≥80% watched vs. the title's total (the same rule the automatic status advancement uses, so badge and progress can never disagree).
- **Trimmed count surfaced.** Import results now show the backend's reconciliation ("N stale episode rows trimmed"), so a fixing import visibly heals the account.
- **Docs updated** for the reconciling semantics: import syncs local progress exactly to the provider (stale imported rows trimmed, real watches untouched, existing ratings kept); export writes your current status and only the episodes you actually watched (Plan to Watch exports 0 episodes).

### Changed
- **App icon URL** now points at this repository's `assets/images/icon.png` on GitHub raw instead of Manus platform storage — the icon no longer depends on an external host.
- **Version**: 5.7.5 (Android versionCode 72).

### Housekeeping
- 255 tests green (8 new); tsc clean; ESLint 0 errors / 69 warnings (at baseline).

## v5.7.4 — Gesture controls + Saved list statuses

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- **Player gestures overhauled** for consistency and stability: one tap window (300ms) now drives the controls toggle, follow-up-tap detection, and the tap-chain reset — double-taps can no longer race the toggle and come out as "controls flashed, no seek". One zone map for every gesture (the old 40% seek / 35% swipe split left a dead band where taps seek but swipes did nothing). Hold-for-2x survives normal finger wobble, can no longer get stuck at 2x, and no longer writes 2x into the saved speed preference when the app dies mid-hold. The gesture responder is created once (no handler swaps under the active touch = no jank), stale tap state resets on swipe/hold/terminate (the cause of accidental double/triple seeks), the HUD hide timer is tracked (no stuck or mid-gesture self-clearing HUDs), triple-tap center no longer double-toggles play/pause, brightness/volume swipes use a calmer mapping, and slow deliberate taps register again.
- **Saved titles now show their list status**: Watching / Plan to Watch / Completed / Paused / Dropped / Rewatching badges on every Saved row (list chip + grid pill), status filter chips with live counts, and a history-based fallback for legacy rows that predate the status column (Paused/Dropped stay explicit-only — never derived). New saves start as Plan to Watch and carry the episode total.
- **Watch events advance Saved statuses automatically** (Miruro parity): distinct episodes watched at ≥80% move Plan to Watch → Watching → Completed once the total is known; Paused/Dropped pass through untouched; imported statuses always win. Saved badges refresh live when a row changes.
- Fixed the list-status port rejecting stored `CURRENT` rows (canonical values now pass normalization first) — AniList-imported "Watching" rows could be silently mis-derived.
- 247 tests green (12 new); ESLint 0 errors / 69 warnings (below the 70 baseline).
- Bumps the Android versionCode to 71.

## v5.7.3 — Offline AniList mirror + keyless closed-app notifications

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Metadata now reads from **`graphql.aniraku.tech`, Aniraku's offline AniList mirror** — same database as AniList, no rate limits, verified field-identical against official for every query shape the app sends. The request governor relaxes from 2.1s spacing to 300ms; 429/`Retry-After` backoff stays as a safety net for endpoint overrides.
- **Closed-app episode reminders with ZERO keys**: upcoming airings for Notify Me + bookmarked titles become local Android scheduled notifications (`aniraku.airing.<id>.<ep>`, firing at airing + 2min) that fire while the app is fully closed — no FCM, no push service, no server, no credentials. The schedule re-tops on launch/foreground/6h/first-run permission/bell toggle, dedupes per episode against the live stream-verified monitor, and disarms cleanly (releasing dedupe keys) when permission, prefs, or titles go away.
- Search 2.0: infinite scroll via cursor pagination, filter + sort bottom sheet (genre/status/format/sort unified with Catalog), pull-to-refresh, helpful empty-state suggestions, shared memoized result rows.
- Library reimagined: History / Saved / Alerts share one `LibraryView` (search, sort, grid/list toggle) with per-row history delete and Home Continue-rail long-press delete; new **Downloads screen** with queue, byte-level progress, Wi-Fi-only and quota settings.
- Player: auto-play next episode (5s countdown, default off), subtitle timing offset, Fit/Crop aspect toggle, report-a-broken-source action.
- Schedule: full day navigation including a past-day archive, midnight rollover fix, per-title remind-me bells, SectionList rendering.
- Profile: inline display-name edit, sign-out, empty-stats encouragement state.
- Home & detail polish: My List quick-toggle on cards, genre summary, long-press quick actions, incremental comments, image optimization across rails/hero/poster, query staleTimes (Home 10min / detail 15min / episodes 10min) with no-refetch stampede on reconnect or foreground.
- **"More like this" restored**: recommendations used a root query field that no longer exists on official AniList either — rewritten against nested `Media.recommendations` and verified on both endpoints. Batched lookups now include `nextAiringEpisode` (release detection previously fell back to total episode count).
- Accessibility pass: labels/roles/switch semantics across search, home, detail, settings, and onboarding.
- Housekeeping: 794 lines of dead player code removed, unused `expo-video` dep + patch script removed, duplicate `package-lock.json` deleted (pnpm-only), ESLint config migrated to `eslint.config.mjs` (config load was crashing), CI validate job made blocking (`continue-on-error: false` + `needs: validate`), logout test un-skipped. 235 tests green; env-dependent suites skip cleanly without `EXPO_PUBLIC_*`.
- Bumps the Android versionCode to 70.

## v5.7.2 — Miruro library import/export parity

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Library transfer matches `~/Miruro` exactly: full `ImportResult/ExportResult` (`imported/already/episodes/scores/unmapped/limited/statuses/statuses_updated`), `describeImport/describeExport` with status breakdown (`Watching · Plan to Watch · Completed …`), 5-attempt export with `Retry-After` + backoff.
- Export runs in the background: paced chunk loop (~30 entries/min, 6s floor), rate-limit wait-and-retry instead of failing, progress inline, terminal `export_complete/export_failed` notification so Alerts fires even after leaving Settings.
- Settings gains the Miruro Library rows: per-provider inline `✓/⚠` result, amber export confirm (`preserving list status, watch progress and scores — already-matched titles skipped`), `Exporting… N titles so far (chunk k)` progress.
- New `lib/list-status.ts` (6-status model: `CURRENT/PLANNING/COMPLETED/PAUSED/DROPPED/REPEATING` + converters + `deriveStatusAfterWatch`); first-run import keeps prompting while `limited:true` so large libraries continue.
- Bumps the Android versionCode to 69.

## v5.7.1 — Saved list + embed overlay fixes

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Saved list fixed: `My List > Saved` read `anime_title/format` while bookmarks save `title/type/image` — every row fell back to "Anime / Anime". Now reads `title || anime_title`, `type || format`, `image || anime_image`.
- Embed overlay no longer an unbreakable wall: top bar + `YUTA · EMBEDDED STREAM` deck + scrims auto-hide after 3.5s like native chrome, tap EMBED pill to hide instantly, floating button to re-show. Bar containers use `box-none` so WebView controls receive touches.
- Black overlay without reason fixed: `OPENING EMBED PLAYER` veil now clears on error/HTTP error plus an 8s fallback (some embeds never fire `onLoadEnd`), and resets per URI.
- Bumps the Android versionCode to 68.

## v5.7.0 — Reliability, trust, and legal refresh

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- Random fixed at the root: the pool exceeded AniList's 5,000-entry page-depth limit (300 × 50). Pages capped at 90, every request clamped, deep-pool failures auto-recover to safe front pages with a friendly message instead of the raw API error.
- Home rails restored: the "Just finished" filter used an invalid `FINISHED_AIRING` status that failed the whole batched request — Ongoing, Top Movies, and Just Finished all blanked together. Now `FINISHED`, verified live; rails also show shimmer placeholders while loading.
- Search hardened for deep links: sort/status/format params are allowlisted, so stale or crafted links degrade to default browse instead of erroring the screen.
- Malformed anime/episode/watch links no longer hang on infinite loaders or render "EPISODE NaN" — invalid routes show an error with a go-back action (new `lib/route-params` + tests).
- Avatars self-heal: poisoned cache entries are evicted on decode failure, and the remote image renders while the file cache catches up. Storage URLs verified healthy (HTTP 200).
- NSFW toggle gated behind a one-time 18+ affirmation; disabling stays instant.
- Account deletion hardened: the edge function skips missing tables instead of bricking deletion forever, the deploy artifact is resynced, and local watch caches clear on delete.
- Comments fixed: guest like/reply buttons route to sign-in instead of dying silently, deletes ask first, malformed timestamps no longer render "NaND".
- Schedule shows an empty state when the 7-day window has no airings.
- Legal refresh: full §512 DMCA procedure (agent, takedown elements, counter-notice, repeat-infringer, misrepresentation), expanded Privacy Notice and Terms of Use, unified contacts, matching in-app legal screen, MIT licensing attribution aligned.

## v5.6.9 — Rate-limit optimization: AniList 30 req/min cap

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM64 + ARM32 + UNIVERSAL`

- AniList is temporarily rate-limited to 30 req/min (down from 90). The request governor retuned to 2.1s spacing (~28/min worst case) with a flat cooldown when the remaining budget runs low — fixes the 429 cascade that error-bannered the Random tab.
- Home now costs 2 AniList requests total: Trending/Popular/Upcoming plus ONE merged aliased request for Ongoing, Top Movies, and Just Finished. Top Movies loads with the hero instead of seconds later.
- "Top in {your genre}" replaced by a "Just finished" rail (FINISHED_AIRING, newest finale first). Removes the hidden genre hook that fired up to 30 parallel AniList requests on every Home mount.
- Notification checks batched: one aliased `id_in` AniList request per 50 bookmarks instead of one full-detail request per bookmark — a 30-bookmark library no longer burns a third of the minute's budget on a single foreground.
- Search commits when a word or sentence finishes (trailing space/punctuation commits fast, mid-word pauses wait, Enter is instant) instead of a flat 450ms debounce — fewer wasted queries under the cap.
- Random fixed: pool pages capped at 1–300 (inside the real catalog — page 500 overshot and returned empty pools), a thin pool retries once on known-good front pages before showing the error banner, and the startup prefetch now requests the exact pages and NSFW flag the tab uses (the old prefetch warmed a query key nothing read).
- Dead code removed: unused `getSubDubEpisodeCounts`, test-only single-page `getAiringSchedule`, and the `use-user-top-genre` hook.
- Bumps the Android versionCode to 66.

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
