# 07 — QA Plan

## Risk-based scope
| Area | Risk | Priority |
|---|---|---|
| Download pipeline (enqueue→native→index) | New, complex, background native | P0 |
| Offline playback (local playlist + AES-128 keys) | New player source path | P0 |
| Selector replacement (20 Alert.alert sites / 8 files) | Behavior regression risk | P0 |
| Autoplay next / skip intro / perceived speed | Player-path changes | P0 |
| Signup validation + consent gate | New auth surface | P0 |
| Player gestures | Existing-player regression | P1 |
| Notifications deep-link | OS-integration flakiness | P1 |
| Badges + continue-watching | Low risk, visual | P1 |
| Account delete/export | Data-safety critical | P1 |
| Pixel pass | Visual consistency | P1 (screenshot gate) |
| Report broken episode | Small feature | P2 |

## Test levels
- **Vitest units (pure, FS-free):** playlist URL-rewrite; EXTINF size estimation; hold/quota gate; selection-for-quality; email validation + typo suggestion; consent versioning; download-policy updates (HLS now allowed, embed/DRM/dead still refused). Native service: manual device test in runbook.
- **Fixtures:** local HLS fixtures (clear + AES-128) served from a local server for facade-level tests of rewrite/estimate logic.
- **Device matrix:** emulator API 34 (foreground-service dataSync notification behavior), physical mid-range (Snapdragon 680 — the known compat constraint), low-storage state test.
- **Manual smoke (release gate):** download→offline play (airplane mode), failed-job retry, storage-full message, selector sweep across all converted dialogs, notification deep-link, autoplay countdown, skip intro, signup validation typo case, consent re-prompt on update, account export/delete.

## Acceptance matrix (PRD → verification)
| Criterion | Verification |
|---|---|
| P0-1 pinned download completes; storage-full fails with message; retry restarts at zero | Unit (gate/estimate) + device smoke |
| P0-2 offline play works with no network; partial never plays | Device smoke (airplane mode) + integrity unit |
| P0-3 zero `Alert.alert` remain on Android surfaces | Grep gate (0 matches in app/components, excluding Share/Linking) + manual sweep |
| P0-4 autoplay countdown cancellable; skip intro in window; skeletons >300ms | Component/unit + smoke |
| Signup validates/typo-checks before send; consent versioned | Unit + smoke |
| P1 gestures per spec; haptic events | Manual on device |
| Notifications fire for bookmarked titles, deep-link lands | Device smoke |
| Badges on completed downloads; continue-watching row renders | Smoke + screenshot |
| Download success ≥95%, offline start <2s, crash-free ≥99.5% | Log-event aggregation + device timing check |

## Regression scope (red line)
Streaming playback (all source types incl. proxied + AES-128), existing progressive-download path parity (until superseded), settings persistence, auth session. Any regression = build blocked.

## Flaky policy
Rerun once; if still flaky, quarantine + file an issue with repro; never ignore-repeat.

## Release gates
`npx tsc --noEmit` · `npm run lint` · `npm test` · `npx expo export` (web bundle sanity) + APK build via `expo run:android` on device · grep gate for `Alert.alert` · screenshot set (home, watch, downloads hub, signup, settings) reviewed by ui-reviewer.
