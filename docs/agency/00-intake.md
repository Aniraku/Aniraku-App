# 00 — Intake (Aniraku native transformation)

## Goal
Transform Aniraku (Expo ~54 + RN anime streaming app) into a fully native-feeling app matching Anilab-class market features, with **in-app downloads**: pick quality → download segmented (HLS) stream → watch offline inside the app. No external-link fallback.

## User constraints
- Subagent API limit reached → all subagents run on the lead's own model (`console-ckey-vn/glm-5.3-flash-ckey`), proportional roster, not all 17 roles.
- No deploy/publish/push/infra mutation/credential export by the agent; user executes release steps.
- Ponytail mode (full): smallest complete change.

## Round 1 decisions (user-confirmed)
| Decision | Choice |
| --- | --- |
| Download deliverable | **In-app offline playback** (HLS segments → app storage → offline play). Real MKV export rejected (ffmpeg-kit retired 2025). |
| "Native" scope | Player polish + episode notifications + library coherence, **plus** in-app downloads. |
| Platforms | **Android-first**; iOS keeps streaming-only this build. |
| Quality bar | **Anilab-class features with Aniraku's own style/owned features** (not a clone). |
| External links | **Remove entirely.** Downloads work in-app or not at all. Accepted tradeoff: provider file-host-page providers (backend `downloads[]` pages) become un-downloadable. |

## Assumptions (reversible, not user-confirmed)
- Android-dominant user base; app is sideloaded (REQUEST_INSTALL_PACKAGES present; app.config.ts:37).
- Streams are mostly clear HLS, served with tokenized URLs that expire (hls-variants.ts:168–174 pattern).
- Single-maintainer hobby project; design.md "Afterimage" style (monochrome, #FF4D4D, 4–8px, 120–180ms) governs new UI.
- Legacy RN arch stays (newArchEnabled: false, app.config.ts:25 — kept for Snapdragon 680 compatibility).

## Risks
1. Segment URLs expire mid-download → downloader must re-resolve manifest/tokens mid-job.
2. `app/watch/[id].tsx` is ~2,965 lines; new download UI must be its own module.
3. Removing external links strands file-host-page-only providers.
4. Persistent local copies of third-party streams change legal posture (DMCA.md:5,33); no server-side media involvement desired.

## Round 2–3 decisions (user-confirmed)
| Decision | Choice |
| --- | --- |
| Background downloads | **Native background now** — Android foreground service (dataSync), persistent download notification. |
| Segment fetch path | **Direct from provider CDN** with required Referer/UA/headers per provider. Server stays out of the media path. |
| Downloadable streams | **Clear + AES-128 HLS**; DRM sources stream-only, download button hidden. |
| Quality semantics | **Pin chosen variant** — picker lists real renditions (hls-variants) with estimated sizes. |
| Storage | **App-private only** (sandbox; uninstall removes; no share sheet). |
| Progress UI | **Downloads hub only**; episode rows get a static "Downloaded" badge, no live progress chips. |
| Player polish | **Full gesture set** — audit existing first, implement gaps (swipe-seek, brightness/volume, double-tap, long-press speed). |
| Notifications | New-episode alerts for **bookmarked titles**, deep-link to watch screen. |
| Library | **Downloaded badges + continue-watching row**; no cross-device sync this build. |

## Round 4 decisions (user-confirmed)
| Decision | Choice |
| --- | --- |
| Download job bar | **Simple** — sequential download, restart from zero on failure (no mid-job token refresh/resume engineering). |
| Storage full | **Fail the job** with a storage message; user decides. |
| Non-goals | No MKV/export/share · no bulk-season download · no casting · no Wi-Fi transfer. |
| Metrics | Core set: download success ≥95%, offline start <2s, crash-free ≥99.5%. |
| Regression red line | **Playback stability** — streaming + existing behavior must not regress. |

## Round 5 final decisions (user-confirmed) — INTERVIEW COMPLETE
| Decision | Choice |
| --- | --- |
| Native selector swap | **All of them** — every Alert.alert() dialog, OS picker/dropdown becomes themed in-app (Afterimage style). |
| Native-feel items | **All four in this build:** haptic feedback, launch polish (splash→home, no white flash), tab bar polish, system-bar theming (edge-to-edge, themed bars). |
| 10x additions | **Auto-play next episode + Skip intro + Perceived speed** (skeleton loaders, prefetch). |
| Landing | **All at once** — one build, then QA. |

## Interview summary
5 rounds, ~21 decisions. P0 = in-app offline HLS downloads (Android-first, background native, direct CDN w/ headers, pinned variant, app-private, hub-only progress, no external links) + native selector replacement. P1 = player gestures, notifications (bookmarked), library badges + continue row, haptics/launch/tab/system-bar polish. P2 (in scope per user): auto-play next, skip intro, perceived-speed pass. Non-goals: MKV/export/share, bulk-season, casting, Wi-Fi transfer, cross-device sync, DRM downloads.

## Round-6 decisions (user-confirmed) — scope additions
| Decision | Choice |
| --- | --- |
| Email verification | **Client-side validate + typo-check before any send** ("did you mean gmail.com?"), resend cooldown, unverified accounts feature-limited. |
| ToS/Privacy consent | **Signup checkbox + versioned re-consent sheet** for existing users. |
| Extra features | **Account delete + JSON export, report-broken-episode flow, F-Droid/Obtainium prep.** Library backup file → backlog (not selected). |
| Code naturalization | **New code + touched files only** (house style); no repo-wide sweep. |
| Pixel pass | **Full audit + fix** across all screens vs Afterimage tokens; screenshot-verified at QA gate. |
| FOSS posture | App positioned as one of the few modern FOSS anime streaming apps (MIT LICENSE + CONTRIBUTING + SECURITY already present). |
| REA feature-scouting | Available if user supplies competitor APK binaries; otherwise skip. |

## Open questions
None blocking. Skip-intro data source resolved (provider skip-times already fetched). Next: delivery plan → build gate.

## Evidence
app.config.ts:25,37,51,56 · lib/download-policy.ts:23–27 · lib/downloads.ts:23,80–82,447–590 · lib/hls-variants.ts:52–116,168–174 · lib/aniraku-api.ts:63–93 · app/watch/[id].tsx:1942–2016 · DMCA.md:5,33 · server/routers.ts:1–28 (stub).
