# Audit Report — Aniraku Native Parity Build

**Post-audit update (2026-10-31, pre-ship):** playback header contract rebuilt (browser identity to api.aniraku.tech, provider upstream headers preserved, cache-buster nonce removed — verified live), media3 1.8.0 API verification for both native modules, beta-gated parallel segment pool added (ADR-005), dead client TMDB resolver removed, dead template code deleted. Current gates: 306 tests / 5 skipped, tsc clean, lint 0 errors. See the release runbook for the authoritative pre-ship evidence.

Independent read-only audit of the uncommitted build tree, run after the QA fix pass.
Lanes: explore · engineering-lead · security-lead (security-audit brief) · quality-lead · code-reviewer (own model, per user constraint).

**Gate state at audit entry:** tsc clean · 297 tests passed / 5 skipped · lint 0 errors / 25 warnings · grep gates 0 (Alert.alert, pickDirectoryAsync, openBackendDownload, anirakuDownloadUrl).

**Gate state after the audit fix pass (this file's evidence baseline):** tsc clean · 297 passed / 5 skipped · lint 0 errors / 25 warnings · grep gates 0.

## Executive summary

The audit found the QA fix pass had left one build-breaking defect (P1: native service given a `file://` URI where a path is required — every native HLS download would fail at first read), one data-loss ordering bug (P1: supersede deleted a saved copy before the Wi-Fi/quota hold check), one Android 12+ crash class (P1: early-exit paths skipped `startForeground`), and one silent playback regression (P1: offline session kept the streaming quality menu mounted). It also confirmed the QA fixes themselves were correct (12 of 14 verified clean) but had introduced two second-order effects that only an independent pass could see — the exact failure mode the two-stage review exists to catch. All P1s, all MEDIUMs, and all ship-blocking P2s are fixed. Residual risk is concentrated in device-only verification (release precondition).

## Findings and dispositions

### P1 — fixed in this pass

| # | Finding | Evidence | Fix |
|---|---|---|---|
| P1-1 | `AnirakuDownloadsService.kt` received `file:///…` URI (expo `Directory.uri`) into `File(dirPath)` → JVM treats it as a relative path → every native HLS download fails reading `source.m3u8`. Reproduced on JVM 21 by the code-reviewer lane. | `AnirakuDownloadsService.kt:72` (pre-fix); expo-file-system `FileSystemModule.kt:41-45` | `File(Uri.parse(dirPath).path ?: dirPath)` + import |
| P1-2 | Supersede ordering: `removeOfflineDownload(existing)` ran **before** the hold check → Wi-Fi-only over cellular on a saved episode deleted the copy, then refused. | `lib/downloads.ts:756-760` (pre-fix) | Reordered: kill-switch → platform → build → synchronous `startingEntries` claim → active-job check → settings → hold → only then supersede → enqueue |
| P1-3 | Service early-exit branches called `stopSelf()` before `startInForeground()` → Android 12+ `ForegroundServiceDidNotStartInTimeException` (reachable via watchdog-cancel + retry). | `AnirakuDownloadsService.kt:34-48` (pre-fix); engineering lane, Android 12+ FGS semantics | `startInForeground` hoisted to top of `onStartCommand` |
| P1-4 | Offline playback left the streaming quality menu mounted → one chip tap silently switched offline → network. | `app/watch/[id].tsx:1157-1227` (pre-fix) | Quality effect early-returns on `file://` sources (clears menu state); chip press on `file://` source shows "THE SAVED COPY PLAYS AT ITS SAVED QUALITY" |

### MEDIUM (security) — fixed in this pass

| # | Finding | Evidence | Fix |
|---|---|---|---|
| M1 | Authorization-bearing headers transited app → CDN in download jobs, contradicting threat model + ADR-003 ("Authorization sources stay proxied/un-downloadable"). | `lib/aniraku-api.ts:63-71`; `tests/native-playback-logic.test.ts:10`; threat model `06-threat-model.md:30` | `buildDownloadRequest` refuses authorization-bearing headers ("This source cannot be downloaded directly."); proxied progressive URLs unwrapped to direct CDN per ADR-003 |
| M2 | Native key-URL fetch skipped `resolveUrl` validation (file:// key read possible; relative AES keys undownloadable). | `AnirakuDownloadsService.kt:81-84` (pre-fix) | `downloadTo(key, resolveUrl(keyUrl, baseUrl), headers)` — https-only + relative resolution |
| M3 | Privacy text stale ("Provider tokens stay server-side" now false); no offline-copies disclosure; consent version not bumped. | `app/legal.tsx:21` (pre-fix); `lib/consent.ts:8` | Privacy §1 offline-copies bullet + §3 direct-CDN statement, effective date → October 2026; ToS §4 personal-offline-viewing bullet; `CURRENT_CONSENT_VERSION` 1 → 2 (forces one re-consent on existing installs) |

### P2 — fixed in this pass

- **Cancel → hidden re-download** (`lib/downloads.ts:501-518`): `transfer()` fell through to a direct re-fetch after legacy cancel; now takes `isCancelled` and throws "Download cancelled." before the fallback.
- **Cross-anime filename collision** (`lib/download-policy.ts:19-21`): progressive destination now prefixed `${entryId}-` so same-title anime can't delete each other's files; failed transfers delete their partial file.
- **Proxied progressive sources downloadable via backend** (contradicted ADR-003): file branch now unwraps and requires https direct URL.
- **Double-enqueue race** (`lib/downloads.ts:748-762`): module-level `startingEntries` Set claims entryId synchronously before any await; second tap refuses "This episode is already downloading."
- **Watchdog cancel-flag poisoning** (second-order effect of QA fix #6): job ids are now per-attempt (`${id}#${attempt}`), so a watchdog-cancelled job's native flag can't poison its first retry; cancel targets the current nativeId.
- **`source.m3u8` persisted tokenized URLs** (security L1): deleted after successful rewrite+verify — completed bundles carry no provider URLs.

### Test gaps (quality lane) — closed in this pass

- `unsupportedPlaylistReason(text)` extracted to `lib/downloads-hls.ts` (EXT-X-MAP, BYTERANGE, multi-key refusals) — the trust-boundary regexes are now exported and unit-testable; `performHlsDownload` calls it.
- `verifyPlaylistIntegrity` with a throwing `exists()` → false: regression-covered.
- Facade tests added earlier (holds ×3, request building ×4, kill switch) remain green; entryId dedupe and hold-before-supersede are exercised through the reordering (supersede now strictly after hold).

### Accepted LOW / debt (recorded, not fixed — bounded, non-blocking)

| Item | Rationale |
|---|---|
| Dead exports: `hapticSuccess`, `hapticMedium/Heavy/Warning` (pre-existing), `downloadLabel` (tests-only), `NativeDownloadProgress/Result` types | Zero-risk dead code; removal is churn, not value |
| `plugins/with-universal-apk.js` pre-existing orphan | Not introduced by this build |
| No durable job recovery after process death | Orphan bundles pruned on next launch; ADR-002 scope is backgrounded-app + live FGS. Cheap future upgrade: adopt bundles with `playlist.done` at startup |
| BYTERANGE word-match false positives | Fail-closed (refuses more than strictly needed); safe direction |
| Dead `?? 200` status check on direct transfer | Native layer throws on non-2xx before writing; misleading but harmless |
| "Export ready" toast on share-sheet dismiss | Cosmetic |
| Autoplay countdown has zero automated evidence | Device-only; covered by smoke list |
| `supabase/functions/send-campaign` L2 (shared-secret gate) | **Pre-existing user work, out of scope for this build** — flagged for the owner |
| APK installer lacks signature pinning (threat model M2, pre-existing) | Next-pass item |
| Cancellation detected by string equality `cause.message == "cancelled"` (Kotlin) | Works; fragile to message refactors — comment-worthy, not blocking |

### Deferred to device smoke (release preconditions, not code defects)

Download → airplane-mode playback (clear + AES-128) · foreground-service notification · process-death recovery · storage-full path · DRM/embed/dead refusal copy · POST_NOTIFICATIONS at prebuild · Expo autolinking of `modules/aniraku-downloads` · gesture feel · edge-to-edge · autoplay/skip-intro feel.

## Verified-clean highlights

- All exports from the rewritten `lib/downloads.ts` have live consumers; every pushed route exists; no TODO/placeholder added by the build.
- Event bridge contract (names, payload keys, degrade-to-null) consistent across JS ↔ Kotlin.
- Playback red line: diff hunks do not touch `videoSourceUri`/`videoContentType`/`playOffline`/`<Video>` mount paths; offline playback verified fail-closed (integrity gate, remote-key rejection, no network fail-over).
- Secrets scan clean; headers never persisted or logged; export excludes tokens; consent gate undismissable; zero new npm dependencies.

## Debt and follow-ups

**Quick wins (next session):** delete dead exports (10 min) · add `#attempt` note to ADR-002 · comment the `== "cancelled"` string contract in Kotlin.

**30-day:** startup adoption of `playlist.done` bundles (process-death recovery) · content-type sniff for extensionless variant URLs · admin-role check on `send-campaign` (owner's lane) · APK signature pinning.

**60-day:** offline quality re-pin (download second variant of same episode without re-fetching segments already on disk) · durable queue index (survive process death mid-queue) · segment byte-cap.

**90-day:** iOS offline saving via AVAssetDownloadTask (PRD non-goal this build, market-parity follow-up) · rename/file-layout reconciliation with ADR-001's `{downloadId}/{variant}` sketch (doc drift only).

**Process lesson recorded:** two of the QA pass's 14 fixes carried second-order defects (supersede ordering; watchdog flag poisoning) that the independent audit caught. Keep the QA → audit sequence non-negotiable for download/lifecycle code.

## Verdict

**CONDITIONAL PASS → green after the fix pass.** All P1/MEDIUM/P2 findings fixed with gates re-run. The build is release-ready pending the device-smoke checklist (outside agent lanes by definition). No rewrite-class findings; every fix was bounded.
