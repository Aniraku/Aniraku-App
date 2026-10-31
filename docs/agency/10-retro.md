# Retro — Aniraku Native Parity Build (v5.8.0)

## Shipped scope

- **In-app offline downloads (flagship)**: quality-pinned HLS segment bundles (playlist + segments + AES-128 key) to app-private storage via a hand-rolled Kotlin foreground `dataSync` service; progressive direct-CDN single-file path; sequential queue with Wi-Fi/quota holds, retry-from-zero, watchdog, dedupe; integrity-gated local playlist playback. External download links removed entirely.
- **Themed selectors**: every OS `Alert.alert` (19 sites) replaced by house-styled ThemedDialog/ThemedToast on the choice-sheet bus, with bounded RETRY on failures.
- **Trust & account**: ToS checkbox at signup, client-side email typo hints, 60s resend cooldown, versioned consent gate (v2 forces one re-consent), JSON data export with share, privacy/terms text updated to match the direct-CDN reality.
- **Polish**: tab-bar haptics, DL badges on episode rows, Downloads hub states, AA contrast + 48dp targets + progressbar a11y on the new surfaces.
- **Already existed, verified not rebuilt**: autoplay-next (5s countdown), skip-intro chip, gesture suite, PiP, prefetch/skeletons.

## Evidence

tsc clean · 297 tests passed / 5 skipped · lint 0 errors / 25 warnings · grep gates 0 · real-CDN E2E 14 pass / 0 fail / 2 correct refusals · 4 new test suites (downloads-hls, downloads-facade, auth-validation, consent).

## Incidents and what they taught

1. **QA→audit second-order defects.** Two QA-pass fixes carried their own bugs (supersede-before-hold data loss; watchdog cancel-flag poisoning) that only the independent audit caught. Lesson: for stateful/lifecycle code, the QA → independent-audit sequence is load-bearing, not ceremony.
2. **The `file://` URI-as-path class.** expo-file-system v19 hands out URI strings; `java.io.File` needs paths. One JVM repro beat five static reads. Lesson: reproduce native claims on a JVM before ranking them.
3. **Provider reality beats spec.** Apple's own test streams use BYTERANGE/fMP4 — the "refuse unsupported formats" preflight (added as a P2) turned out to be load-bearing for real-world correctness, and the E2E proved the refusals fire on real manifests.
4. **Cloudflare is part of the test matrix.** Provider-source E2E cannot run from datacenter IPs (sandbox and CI alike); the harness ships to the owner with one command.

## Deviations from plan

- M5's `lib/autoplay-next.ts` never materialized — autoplay already existed inline; recorded instead of duplicated.
- media3 DownloadManager (ADR-002) → hand-rolled HttpURLConnection service; ADR + architecture doc amended.
- DevOps-lead spawn skipped at ship: CI was already fully understood; runbook content came from the pipeline itself.
- Pinch fit/fill gesture = deliberate non-build (settings chips already provide the capability; red-line risk avoided).
- Speculative next-episode source prefetch = deliberate non-build (duplicates provider requests against the stability red line).

## Debt (accepted, logged in 12-audit-report.md)

Dead exports (`hapticSuccess` et al., `downloadLabel`) · no durable queue recovery after process death (orphan bundles pruned) · "Export ready" toast on share dismiss · autoplay has no automated evidence (device-only) · pre-existing: send-campaign secret gate (owner's lane), APK installer signature pinning, `plugins/with-universal-apk.js` orphan.

## Follow-ups

- **Now:** owner runs `npx tsx scripts/e2e-downloads.ts` (residential IP) + the 10-item device smoke; then commit/push/tag v5.8.0.
- **30-day:** startup adoption of `playlist.done` bundles; segment byte-cap; delete dead exports; admin-role check on send-campaign.
- **60-day:** offline quality re-pin without re-fetching shared segments; durable queue index.
- **90-day:** iOS offline via AVAssetDownloadTask; instrument the PRD metrics (download success, offline start, crash-free).

## Metrics truth

Download success ≥95% / offline start <2s / crash-free ≥99.5% are PRD targets with no instrumentation shipped — the metrics gate is design-time only. First signal is GitHub issues + support email for week one.
