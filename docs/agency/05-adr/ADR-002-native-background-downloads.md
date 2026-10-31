# ADR-002 — Native background downloads now (media3 DownloadService, legacy arch)

**Status:** Accepted (user-confirmed)
**Context:** Downloads must continue with the app closed. No RN/Expo SDK 54 package provides background HLS download; react-native-video 6.1.2 has no downloads API. App uses legacy RN architecture (`newArchEnabled:false`, app.config.ts:25 — kept for Snapdragon 680 compat) but already builds natively (`expo run:android|ios`).
**Options:** (a) JS-queue foreground-only v1; (b) native media3 `DownloadManager` + foreground `dataSync` service now.
**Decision:** (b). Classic-module bridge (~150 lines Kotlin), foreground service type `dataSync`, persistent notification, one-parallelism. iOS stays streaming-only this build.
**Consequences:** Permanent native code; prebuild needs a small local config-plugin so regen keeps the service. Legacy arch constrains us to the classic bridge (no TurboModule codegen).

## Amendment (QA pass)

Implemented as a hand-rolled `HttpURLConnection` foreground service rather than media3 `DownloadManager` — no extra dependency, ~290 lines, same decision (classic bridge, dataSync type, one job at a time). Segment orchestration stays in JS.
