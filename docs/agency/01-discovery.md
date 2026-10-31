# 01 — Discovery (Aniraku native transformation)

## Current state (evidence)
- **Stack:** Expo ~54 + RN, legacy architecture (`newArchEnabled: false`, app.config.ts:25 — kept deliberately for Snapdragon 680 compatibility; SDK 54 is the last legacy-arch release). expo-router v6, tRPC 11 + TanStack Query 5, drizzle + Supabase, react-native-video 6.1.2 (PiP enabled), no expo-dev-client, no ffmpeg dep. Sideloaded APK (REQUEST_INSTALL_PACKAGES, app.config.ts:37), versionCode 76, v5.7.9.
- **Downloads today:** in-app queue exists for progressive files only (lib/downloads.ts: jobs queued/downloading/done/failed; 1-concurrent; resumable single-file transfer lib/downloads.ts:447–490; offline index w/ prune). Android-only (`isOfflineSavingSupported()` → Platform.OS === "android", lib/downloads.ts:80–82; SAF folder picking). Settings: wifiOnly + quotaMb ("aniraku.download-settings.v1") + free-disk/quota checks.
- **Policy gate:** lib/download-policy.ts:23–27 refuses HLS (.m3u8), embeds, verification:"dead", non-HTTPS → HLS sources fall through to the **external-link path**: backend `downloads[]` are provider file-host *pages* (not files), opened after a "You're leaving Aniraku" Alert (app/watch/[id].tsx:1942–1975).
- **Variant parsing exists:** lib/hls-variants.ts:52–116 parses master-playlist renditions; variant media playlists are fetchable VOD; token-rot 403 handling exists (:168–174). Quality picker panels already in-app (`ActivePanel: … quality | download`, app/watch/[id].tsx:242).
- **Backend download proxy:** `/api/v1/download?url=…&headers=…` constructed client-side (lib/aniraku-api.ts:89–93) — unauthenticated relay, SSRF/abuse surface (server/routers.ts:1–28 is a stub; real endpoint outside repo). Progressive downloads currently pass Referer/UA/Auth headers to CDNs (lib/aniraku-api.ts:63–71).
- **Native surface:** expo-audio, notifications (configured), haptics, screen-orientation, keep-awake, secure-store (Android backup disabled), intent-launcher. Bottom-tabs x6 incl. "Random" tab.
- **Design system:** design.md "Afterimage" — monochrome editorial, #FF4D4D accent, 4–8px corners, 120–180ms motion, 48dp targets. English-only (TODO G3); font-scaling/reduce-motion pass not started (G2).
- **Hot spot:** app/watch/[id].tsx ≈ 2,965 lines; TODO says refactor last.

## Key insights
1. The user's "segments in mkv" resolves to **in-app offline playback** (confirmed): store chosen-variant playlist + segments (+ AES-128 keys) app-privately, play via local playlist in react-native-video. No remux, no MKV. Market-standard approach.
2. Removing external links entirely **also removes** the openBackendDownload exposure; the remaining server-side media risk is the unauthenticated download proxy — its usage must shrink to (at most) playback resolution only.
3. Background downloads need a native track: Android media3 DownloadService-style foreground service (dataSync type, Android 14+ permission) — legacy-arch compatible but a permanent fork from config-only Expo (acceptable: native prebuild already in use).
4. New scope from interview: universal themed-selector replacement (grep Alert.alert across app/), haptics/launch/tab/system-bar polish, auto-play next, skip intro, perceived-speed pass — all confirmed in-build.

## Constraints
- Legacy RN arch (no new-arch-only libs). Android-first; iOS streaming-only this build. Direct-CDN segment fetch with per-provider Referer/UA headers. Simple job semantics (restart from zero on failure). App-private storage only. Playback stability is the regression red line.

## Risks
1. Tokenized/rotting segment URLs mid-download (hls-variants.ts:168–174 pattern) — simple-job semantics accepts restart-from-zero risk.
2. watch screen size — new download/sheet UI must be separate components.
3. External-link removal strands file-host-page-only providers (user-accepted).
4. Persistent third-party copies change legal posture (DMCA.md:5,33) — app-private, no sharing, personal-use framing mitigates; no server media involvement.
5. Scope breadth (downloads + polish + 10x features) — sequenced as vertical slices behind one build.

## Resolved questions
All interview rounds closed; see 00-intake.md. Remaining open item for definition: skip-intro data source (provider markers/API vs manual recall) — feasibility checked in architecture phase.

## Evidence
See 00-intake.md evidence line; plus design.md:9–47, TODO.md:26–47, app/(tabs)/_layout.tsx:35–40.
