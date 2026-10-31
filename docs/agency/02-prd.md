# 02 — PRD (Aniraku Native Parity Build, v5.8.x)

> Status: core confirmed. Section "Round-6 additions (scoping in progress)" pending final user answers: email verification, ToS/Privacy consent, Nothing-theme pixel pass, AI-free naturalization, FOSS positioning.

## Problem
Aniraku streams well but behaves like a webview wrapper where it matters most: offline saving is missing for segmented streams (external download pages instead), system dialogs break immersion, and daily-use polish (autoplay, skip-intro, gestures, notifications) trails Anilab-class apps. Users who rely on offline viewing churn or sideload alternatives.

## Goals
1. True in-app offline downloads: pick quality → download HLS playlist + segments + AES-128 keys to app-private storage → play offline via local playlist. No MKV, no export.
2. Android-first release; iOS ships streaming-only (no offline saving) this build.
3. Remove all external download links; providers without direct sources are un-downloadable (accepted).
4. Replace every `Alert.alert`/OS picker with themed in-app selectors (Afterimage style: monochrome, #FF4D4D, 4–8px radius, 120–180ms, 48dp targets).
5. Market-parity player loop: gestures, autoplay next (short countdown), skip intro, perceived speed (skeletons + prefetch).
6. New-episode notifications for bookmarked titles, deep-linking to the anime page.

## Non-goals
MKV/export/share, bulk-season download, casting, Wi-Fi transfer, cross-device sync, DRM downloads (DRM sources stay stream-only with the download button hidden), iOS offline saving.

## Personas
- **Daily binge watcher (Android phone, metered data):** wants one-tap episodes, autoplay, skip intro; watches on cellular and Wi-Fi.
- **Commuter with patchy connectivity:** downloads specific episodes at chosen quality before travel; expects reliable offline playback and honest storage feedback.
- **Library curator:** bookmarks titles, returns via "new episode" notifications, keeps downloads tidy from a Downloads hub.

## Positioning
Modern FOSS anime streaming app — sponsor-facing credibility is a stated goal (hand-maintained code quality, privacy-positive defaults, no telemetry).

## Journeys
1. **Download-to-offline:** Episode → quality picker shows real renditions with estimated sizes → pick → job enters sequential queue (Wi-Fi/quota holds respected) → persistent notification (foreground dataSync service) → Downloads hub shows progress + storage bar → offline later, episode plays from local playlist.
2. **Daily watch:** Home → continue-watching → gestures (swipe-seek with preview, brightness/volume swipes, double-tap ±10s, long-press 2x) → skip intro → episode ends → autoplay countdown → next episode.
3. **Bookmark→notification:** Bookmark title → new episode releases → OS notification → tap deep-links to the anime page (episode list + download badges) → user watches or downloads.

## User stories

**P0-1 Quality-pinned offline download** — *Given* an episode with a clear or AES-128 HLS source, *When* the user picks a rendition and confirms, *Then* the pinned variant downloads (playlist + segments + keys) sequentially, shows progress only in the Downloads hub, and completes as "Downloaded".
- *Given* storage is full, *When* the job can't write, *Then* it fails with a storage message and the quota/hold state is visible in the hub.
- *Given* a job fails mid-transfer, *When* the user retries, *Then* it restarts from zero (no resume), honoring wifiOnly/quota settings.
- *Given* a DRM or dead or embed-only source, *When* the user opens the download sheet, *Then* download is hidden or disabled with a reason, and no external link is offered.
- *Given* iOS, *When* the user opens the download sheet, *Then* it explains downloads are Android-only.

**P0-2 Offline playback integrity** — *Given* a fully downloaded episode, *When* opened with no network, *Then* it plays from the local playlist at the chosen quality. *Given* a partial/failed download, *When* tapped offline, *Then* it is blocked with a clear state and never half-plays.

**P0-3 Themed selectors** — *Given* any flow using an OS dialog (download confirm, delete, report, quality/server pickers), *When* triggered, *Then* an in-app themed component appears (Afterimage tokens) with keyboard/screen-reader parity and no `Alert.alert` remains on Android.

**P0-4 Autoplay, skip-intro, perceived speed** — *Given* an episode ends, *When* autoplay is on, *Then* a short countdown starts next episode (cancellable). *Given* known intro timestamps, *When* playback is in intro range, *Then* Skip Intro appears. *Given* heavy screens, *When* loading, *Then* skeletons + prefetched next data keep taps responsive.

**P1-1 Gesture set** — audit existing player first; *Given* playback, *When* user swipes-seeks horizontally, then shows preview; vertical left/right adjusts brightness/volume; double-tap ±10s; long-press 2x; all with haptics.

**P1-2 New-episode notifications** — *Given* a bookmarked title releases an episode, *When* detected, *Then* one OS notification appears (POST_NOTIFICATIONS already declared) and deep-links to `/anime/[id]` (amended during QA: notification data carries only the anime id; the anime page lists episodes + download badges — user-approved deviation from the original `/watch/[id]` target); per-title toggle honored.

**P1-3 Library & badges** — *Given* episode rows, *When* a download is complete, *Then* a static "Downloaded" badge shows (no live chips outside the hub); *Given* Home, *When* history exists, *Then* a continue-watching row renders.

## Round-6 additions (scoping in progress)
- **Email verification hardening for sign-ups:** reduce bounced/wasted verification emails from mistyped addresses (client-side validation + typo suggestion, resend cooldown; mechanics being confirmed).
- **Terms & Privacy consent at signup:** new-user agreement flow + likely re-consent gate for existing users on update (mechanics being confirmed).
- **Nothing-theme pixel pass:** full-fidelity audit/fix of theme (layout, font, style, color tone) — scope being confirmed.
- **Codebase naturalization ("handwritten, sponsor-facing"):** remove AI-style artifacts, house-style consistency — scope being confirmed.
- **FOSS positioning:** LICENSE/README/contribution hygiene; Obtainium/F-Droid friendliness under consideration.

## NFRs
Sequential queue (one active job); downloads to app-private storage only; no foreground main-thread jank during segment writes; selectors 48dp/120–180ms; graceful degradation when notifications denied. **Red line: streaming playback stability must not regress.**

## Metrics & analytics
Targets: download success ≥95%, offline playback start <2s, crash-free sessions ≥99.5%. Events: `download_started` (quality, size_est), `download_completed`/`download_failed` (reason, bytes), `offline_playback_started`, `autoplay_next_shown`/`autoplay_next_fired`, `skip_intro_used`, `notification_opened`, `selector_opened` (surface), `gesture_used` (type). *(No third-party telemetry — privacy-positive FOSS posture; local metrics only unless user opts otherwise.)*

## Rollout
All-at-once, sideloaded Android APK; bump `versionCode` 76→77 in app.config.ts; smoke: one download→offline play on device, selector sweep, notification deep-link, autoplay E2E before release. Verify via crash reporting during the first week of installs.
