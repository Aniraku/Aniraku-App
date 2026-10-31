# 04 — Architecture: Native Offline HLS Downloads (Android-first)

## 1. Component / data-flow design

**Ownership split (load-bearing decision):** segment fetch + storage lives in **native Android (Kotlin)**, orchestration in **JS**. A JS loop through expo-file-system must keep the JS bundle alive and burns bridge/battery; Android's `media3.exoplayer.offline.DownloadManager` already implements segment fetching, progress events, failure backoff, and cache persistence — rebuilding it worse in JS is waste. iOS this build = streaming-only; no native download code.

**Data flow:** JS `lib/downloads.ts` keeps its exact public shape (jobs, `subscribeDownloadQueue`, settings, index) but becomes a **thin façade over the native module**: `enqueue()` → native; native emits `onProgress/onComplete/onFail`; JS persists the offline index (AsyncStorage) on completion, where `performDownload` writes today (downloads.ts:548–551). Existing pump/hold logic (wifiOnly, quota — downloads.ts:176–190, 347–379) stays in JS as the *gating* layer: JS resolves holds before enqueueing; native enforces one-at-a-time. Retry = re-enqueue (restart-from-zero is native default with fresh cache key). Cancellation = native `DownloadManager.removeDownload()`.

**Legacy-arch bridge:** one `DownloadServiceModule` + one `DownloadService` (classic module + NativeEventEmitter, no TurboModule codegen — `newArchEnabled:false`, app.config.ts:25). ~150 lines Kotlin; config-plugin only for the service declaration.

## 2. Offline playback mechanics
- **Store layout:** `files/aniraku-offline/{downloadId}/{variant}/playlist.m3u8`, `seg-0001.ts…`, `key.bin`. Keyed by (animeId:ep:lang:height).
- **URL rewriting:** after the variant media playlist downloads, rewrite every segment URI to absolute `file://` path and `#EXT-X-KEY:URI=...` to the copied `key.bin`. Rewritten in JS at completion (pure function, vitest-covered). react-native-video/ExoPlayer accepts a `file://` .m3u8; local AES-128 keys load from the rewritten URI.
- **Resume-integrity:** completion = playlist exists + segment count matches playlist entries + each file size >0 (reuse `filterExistingDownloadEntries` pattern, download-policy.ts:135–151). Failed job deletes its directory (restart-from-zero).
- **Estimated size:** sum `#EXTINF` durations × variant `BANDWIDTH` (parsed master via hls-variants.ts) ÷ 8 + audio renditions; shown pre-enqueue, reconciled at completion. Pure function in `lib/download-policy.ts`.

## 3. Native module inventory (Android only)
- `DownloadService` with `android:foregroundServiceType="dataSync"`; permissions: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `POST_NOTIFICATIONS` (already declared). Notification channel `downloads`.
- Manifest service entry + `DOWNLOAD_MAX_PARALLELISM=1` in media3 `DownloadRequest`s.
- JS: `NativeModules.AirAnirakuDownloads` wrapper + event emitter; small local config-plugin so `expo prebuild` regen keeps the service.

## 4. Feature designs
- **Auto-play next:** player `onEnd` → next episode's stream pre-resolved via `prefetchQuery` during final 30s; 5s countdown overlay (cancellable); reuse watch-screen mount with new id.
- **Skip intro:** use provider skip-times already fetched (`skipSegments`, watch/[id].tsx:249); no manual recall editor this build. ~90% built already.
- **Perceived speed:** skeletons exist (`components/skeleton.tsx`) — apply to watch/library rails; `prefetchQuery` on card focus and library mount.
- **Signup hardening:** client-side email validation + typo suggestion before any send; resend cooldown; unverified accounts feature-limited. ToS/Privacy checkbox at signup + versioned re-consent sheet for existing users. Account delete + JSON export; report-broken-episode flow.

## 5. ADR decisions
See 05-adr/ (ADR-001…005). Summary: local-playlist (no MKV/remux) · native hand-rolled download service on legacy arch · direct-CDN with per-provider headers · external links removed · localhost-free parallel segment pool (beta).

## 5b. Shipped additions (v5.8.0 — as built)

- **Downloads stack**: JS façade `lib/downloads.ts` (queue/holds/index) + pure mechanics `lib/downloads-hls.ts` + native binding `lib/downloads-native.ts` → `modules/aniraku-downloads/` (Kotlin `HttpURLConnection` foreground service, one job, https-only guard, 2 retries). UI: `components/download-sheet.tsx` (per-quality rows with real HEAD/EXTINF size estimates + codec labels), `app/downloads.tsx` hub. Offline playback mounts the rewritten `playlist.m3u8`; integrity gate in `lib/downloads-hls.ts`.
- **Parallel segment pool (beta, ADR-005)**: `modules/aniraku-stream-pool/` registers a react-native-video `RNVExoplayerPlugin`; reads through media3 `CacheDataSource`/`SimpleCache` (LRU 256 MB) and prefetches the next 8 segments with 3 workers via `CacheWriter`, driven by the player's own load events. JS gate `lib/stream-pool.ts` (flag `EXPO_PUBLIC_SEGMENT_POOL`, off in production builds). No localhost server, no ABR interference.
- **Push stack**: `lib/push-notifications.ts` (register/unregister) + `lib/check-new-episodes.ts` + `providers/notifications-provider.tsx` → Supabase edge functions (`check-new-episodes`, `send-push`, `send-campaign`) + migrations (`push_tokens`, `anime_track_state`). Tokens unregistered on sign-out, deleted on account deletion.
- **Consent & 18+**: `lib/consent.ts` + `components/consent-sheet.tsx` (versioned re-consent), `lib/nsfw-preference.ts` + `components/content-lock.tsx` (age gate).
- **Episode display**: `lib/episode-fallbacks.ts` — the backend merges AniZip + TMDB into `/episodes`; the client applies only display guards/fallbacks (the legacy client-side TMDB resolver is removed).

## 6. Budgets, observability, tests, rollout
- **Offline start <2s:** flat per-download directory, no index rebuild at play time (index in AsyncStorage); playlist rewrite <50ms; player load ≤1.2s on mid-range.
- **Observability:** log `download_completed {animeId,height,bytes,durationMs,outcome}` + `download_failed {reason,httpStatus}`; success = completed/(completed+failed) ≥95%. No PII.
- **Vitest units (pure, FS-free):** playlist URL-rewrite; EXTINF size estimation; hold/quota gate; selection-for-quality; email validation/typo check; consent versioning.
- **Rollout/rollback:** kill-switch flag `APP_CONFIG.downloadsNativeEnabled` (flag off → download button shows a status message; external links stay removed per decision). Native rollback = previous APK.

## 7. Risk register
| Risk | Mitigation |
|---|---|
| Tokenized segment URLs rot mid-job | Fresh key+manifest at job start; 403 mid-job → fail + one-tap re-resolve/re-enqueue |
| watch/[id].tsx bloat | All new logic in `lib/` + native; screen only wires state |
| Legacy-arch event timing (events before listener) | Native re-emits state on `getSnapshot()` after subscription (mirror `notifyQueue`) |
| Storage-full mid-write | Preflight vs `Paths.availableDiskSpace`; native disk-error → job fails, dir deleted |
| Provider CDN/header changes | Headers centralized in `nativePlaybackHeaders` (aniraku-api.ts:63) |
| Background wake-lock abuse | Cap retries while backgrounded; per-provider politeness delay |

## Amendment (QA pass)

The native download service is a hand-rolled `HttpURLConnection` foreground service (see ADR-002 amendment), not media3 DownloadManager as first sketched. Flag-off behavior: the watch-screen download button shows a status message instead of opening the sheet; the queue API refuses jobs.
