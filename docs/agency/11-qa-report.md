# QA Report — Aniraku Native Parity Build

**Post-report update (2026-10-31):** see 12-audit-report addendum and the release runbook precondition table for current gate evidence.

Independent panel (quality-lead, code-reviewer, security-auditor, engineering-lead), all findings reconciled. Fix pass applied for P0/P1 before this report was finalized.

## Gate table

| Gate | Status | Evidence |
|---|---|---|
| `pnpm check` (tsc) | PASS | clean |
| `pnpm test` (vitest) | PASS | **297 passed / 5 skipped** (44 files; +11 tests added in fix pass) |
| `pnpm lint` | PASS | 0 errors, 26 warnings |
| Grep `Alert\.alert` (app+components) | PASS | 0 |
| Grep relay/picker symbols (`pickDirectoryAsync`, `openBackendDownload`, `anirakuDownloadUrl`, `backendDownloadOptions`) | PASS | 0 |
| Secrets scan | PASS | none in diff/untracked |
| Visual (screenshots, desktop+mobile) | **BLOCKED** | no emulator/device capture available in this lane |
| Device smoke (download→airplane-mode playback, retry, storage-full, selectors, autoplay, deep-link) | **BLOCKED** | requires a device — release precondition |

## Findings and dispositions

### Fixed in the QA fix pass
- **P0 — Native `enqueue` never sent `base`** (`AnirakuDownloadsModule.kt`): every HLS download with relative segment URIs failed with "Unsafe segment URL in playlist." → added `putExtra("base", …)`.
- **P1 — `verifyPlaylistIntegrity` rejected local `file://` keys** (`lib/downloads-hls.ts`): every AES-128 download failed at the final gate → local keys now allowed and their file presence is verified. Regression tests added (accept rewritten AES bundle, reject missing/remote key).
- **P1 — `pruneStaleDownloads` deleted in-flight bundles** (`lib/downloads.ts`): orphan sweep now skips dirs owned by queued/downloading jobs.
- **P1 — No entryId dedupe**: a second download of the same episode destroyed the first job's bundle → refuse while active; a finished download is cleanly superseded (old entry removed first).
- **P1 — Kill switch did not hide affordances**: `onDownloadPress` now shows "DOWNLOADS ARE TEMPORARILY DISABLED IN THIS BUILD" when `APP_CONFIG.downloadsNativeEnabled` is false.
- **P1 — No watchdog on `runNativeJob`**: a killed `START_NOT_STICKY` service left the job stuck `downloading` forever → 180s no-progress watchdog rejects, cancels, frees the queue slot.
- **P1 (functional) — cancel-flag leak** (`AnirakuDownloadsService.kt`): `complete()` now clears the cancelled id so a retry isn't insta-failed.
- **P2 — IV dropped on key rewrite**: rewrite now replaces only the `URI` value; `IV=`/`METHOD` survive (tested).
- **P2 — Un-representable playlists** (fMP4 `#EXT-X-MAP`, `BYTERANGE`, multi-key): preflight-refused with a clear reason instead of producing a broken bundle.
- **P2 — Progressive downloads saved HTTP error bodies**: `downloadFileAsync` status checked; error bodies deleted, job fails.
- **P2 (owed tweak) — Share flow**: Android share message now carries `https://aniraku.tech/anime/{id}` (Android `Share.share` ignores `url`; the `aniraku://` link is dead for recipients).
- **P2 — Missing facade tests** (F3): `tests/downloads-facade.test.ts` added — quota/Wi-Fi holds, HLS request build + refusals, progressive build, kill-switch throw.
- **P2 — Un-downloadable source UX**: empty option list now shows "THIS EPISODE CANNOT BE SAVED FOR OFFLINE VIEWING" instead of a silent no-op sheet.
- **P3 — dead `hapticSuccess` import** removed; **P3 — dead `anirakuDownloadUrl` relay helper** deleted (completes ADR-004).

### Resolved after user review (second fix pass — gates re-run green: tsc clean, 297 passed / 5 skipped)
- **P1 — Notification deep-link target**: user chose to KEEP the `/anime/[id]` target (episode list + DL badges render there; notification data carries only the anime id). PRD amended (02-prd.md:14,30,48) — deviation closed, not debt.
- **P2 — Progressive downloads had no free-space preflight** → `preflightProgressiveSpace` probes Content-Length via HEAD (fail-open when the CDN refuses), refuses at ×1.15 like HLS, and charges the estimate against the quota.
- **P2 — Quota counted saved bytes only** → `pendingEstimates` charges active jobs' estimated bytes (HLS manifest estimate, progressive HEAD length) against the hold; cleared in `runJob` finally.
- **P3 — Early toasts dropped before provider mount** → `showThemedToast` now queues like the dialog/choice buses.
- **P3 — `shareAccountData` silent no-op** → returns `false` when no share target; settings toast explains the file is in app storage.

### Deferred to device smoke (release preconditions)
- Real-network AES-128 download → airplane-mode playback; foreground-service notification; process-death recovery; storage-full; DRM/embed/dead reasons; autoplay/gesture feel; edge-to-edge; `POST_NOTIFICATIONS` presence at prebuild; Expo autolinking of `modules/aniraku-downloads`.

## Flaky-test scan
PASS — timing logic uses fake timers; network tests are env-gated skips.

## Recommendation
**HOLD for device smoke.** Code gates are green; the two blocked gates need a device (`pnpm android`, then the smoke list above). No release without them.

---

# Post-QA user-directed passes (E2E + design)

## Real-URL E2E (`scripts/e2e-downloads.ts`)

Owner-run command: `npx tsx scripts/e2e-downloads.ts` (full provider path: health → trending → episodes → servers → stream → download classification → HLS/progressive download proof against real Aniraku backend sources). Sandbox runs are blocked by Cloudflare on `api.aniraku.tech` for datacenter IPs (same documented CI-runner behavior — not an app defect), so the sandbox ran `--public` mode against real public HLS CDNs:

**Result: 14 pass · 0 fail · 2 refused · 0 skipped.**

| Stream | Verdict | Detail |
|---|---|---|
| Mux x36xhzz (clear TS, 5 variants) | PASS ×6 | master parse (1080p@6222k…184p@246k), estimate 480.1 MB/64 segs, 3 real segment fetches w/ headers (5.2/12.9/6.4 MB), estimate honesty drift 6%, full rewrite 64 URIs → file://, integrity gate |
| Mux pts_shift (unusual timestamps) | PASS ×6 | 4 variants, estimate 46.7 MB/41 segs, segments 0.8/1.4/0.7 MB, drift 15% (inside the 50% gate — the 1.15× sizing factor is sound), rewrite + integrity |
| Apple bipbop TS (BYTERANGE) | REFUSED (correct) | real `#EXT-X-BYTERANGE` playlist — sequential downloader would fetch the whole file N×; fail-closed refusal is the right behavior |
| Apple bipbop fMP4 (EXT-X-MAP) | REFUSED (correct) | init-segment stream unsupported by design (v1 scope) |

Two harness bugs found and fixed during this pass (script only, no app changes): segment/key resolution and rewrite now use the **variant playlist URL** as base (mirroring `performHlsDownload`), and the trending payload type was corrected. A regex tightening also landed in the app: `unsupportedPlaylistReason` now anchors `#EXT-X-MAP`/`#EXT-X-BYTERANGE` to tag lines (`m` flag) so bare words in comments/paths no longer false-refuse — same real refusals kept.

## Design-quality pass (design-lead brief, applied)

WCAG contrast math drove the fixes: `dim #666664` on surface = 3.2:1 (fail); `muted #A2A2A0` = 7.2:1 (pass).

1. **Contrast** — storage text, row meta, job errors, sheet storage line: `dim` → `muted` (the exact numbers users trust before committing gigabytes now pass AA).
2. **48dp targets** — queue icon buttons +`hitSlop` 7 (34→48), quota chips +hitSlop (32→48), close +hitSlop 3, dialog buttons 44→48, toast dismiss hitSlop 17 (14+34=48), toggle track +hitSlop 11 (26→48).
3. **One chroma** — storage bar fill green → white (design.md admits exactly one chroma; red now appears only when a state is wrong).
4. **Haptic parity** — the download commitment (quality pick) gets a Light impact; it was the only silent consequential press.
5. **DL badge** — red border dropped for the house scrim chip (matches anime-card topline); 9px→10px (house floor).
6. **Quiet the red** — queue dots: only in-flight rows get `live`; failures stay loud via red status text. Kills the 9-red-dot queue.
7. **Toast** — tone-aware border (red = error only; info gets the line color) + 150ms opacity entrance (motion connects cause and effect).
8. **Assistive progress** — queue progress + storage bars now expose `accessibilityRole="progressbar"` with min/max/now values and labels; Wi-Fi notice copy shortened to fit ≤320dp.
9. **Consistency** — consent sheet kicker uses `nothing.mono` (was hardcoded "monospace"), title 17px→16px (house 16).

## Updated gate table

| Gate | Status |
|---|---|
| tsc / vitest (297) / eslint 0 errors | PASS |
| grep gates (Alert.alert, pickDirectoryAsync, openBackendDownload, anirakuDownloadUrl) | PASS (0) |
| Real-CDN E2E (--public) | PASS 14/0/2-refused |
| Full provider E2E | **OWNER-RUN** (`npx tsx scripts/e2e-downloads.ts` on a residential IP) |
| Visual/device smoke | BLOCKED (device required — runbook list) |

**Recommendation: HOLD for device smoke + owner-run provider E2E.** Everything runnable in this lane is green.

---

# Polish pass (user-directed: mechanism · UX · frontend)

| # | Polish | Files | Type |
|---|---|---|---|
| 1 | **Native sheet motion** — bottom sheets now slide up (36px + fade, 180ms ease-out-cubic); dialogs scale in (0.96→1, 150ms); consent card slides up. Backdrop keeps its fade. The flagged design debt ("sheets fade in place") is closed. | choice-sheet, download-sheet, consent-sheet | Frontend |
| 2 | **≤300ms loading rule implemented** (owed build-gate tweak) — `LoadingState` delays its skeleton 300ms; fast loads no longer flash a spinner. | async-state | Mechanism/UX |
| 3 | **Upfront download affordance** (closes PRD P0-1 "partial") — embed/dead sources dim the download button in the player rail (`accessibilityState.disabled` + dimmed style) and pressing it says why ("THIS SOURCE CANNOT BE SAVED FOR OFFLINE VIEWING") instead of opening a doomed sheet. | watch/[id] | UX |
| 4 | **Share chooser** (closes owed share tweak) — share button now opens the themed sheet: SHARE (native share sheet, platform-correct link) / COPY LINK (clipboard + "LINK COPIED" toast). Both detail screen and anime cards. | anime/[id], anime-card | UX |
| 5 | **Live byte counts** — downloading rows in the hub now show `42% · 128 MB / 305 MB` style byte progress next to the status label. | downloads hub | Mechanism |
| 6 | **Token sweep** — 60+ exact-value hexes (`#FFF`×45, `#FF4D4D`, `#000`, `#090909`, `#F6F6F2`…) replaced with design tokens in watch, embed-web, banners. Zero visual change; colors now changeable from one file. Remaining hexes are brand colors (provider marks), pre-existing off-token surfaces, and 4 files without the token import — logged as debt, not churned. | watch/[id], embed-player.web, anilist-down-banner, announcement-banner | Frontend |

Gates after the pass: tsc clean · 297 passed / 5 skipped · lint 0 errors / 25 warnings · grep gates 0 · real-CDN E2E 14 pass / 0 fail / 2 refused (unchanged — polish touched no download logic).

---

# Polish phase (post-ship-prep, user-directed)

## Pass 1 — mechanism / UX / frontend
| # | Polish | Where |
|---|---|---|
| 1 | Sheets slide up (36px + fade, 180ms cubic); dialog card scales 0.96→1 (150ms) | choice-sheet, download-sheet, consent-sheet |
| 2 | LoadingState 300ms no-flash delay — closes the owed ≤300ms tweak for real | components/async-state.tsx |
| 3 | Un-downloadable sources dim the download button upfront with reason on press (no doomed sheet) | app/watch/[id].tsx |
| 4 | Share chooser: native Share or Copy Link, platform-correct URLs, themed toast | anime/[id].tsx, anime-card.tsx |
| 5 | Queue rows show live byte counts (`12.3 MB / 48.1 MB`) while downloading | app/downloads.tsx |
| 6 | 60+ hardcoded hexes → design tokens across watch/player/banners | token sweep |

## Pass 2 — watch-page anti-slop
- Chapter marker `#FFD600` → white; brightness-bar yellow fill → white (one-chroma rule).
- Settings success chip `#86efac`/green rgba → house `nothing.green` family.
- Shadow color tokenized. Scan: only 3 `console.log` (all `__DEV__` timing), zero TODO/FIXME/HACK.
- Kept deliberately: white skip-intro pill + white big-play circle (coherent high-contrast player affordances).

## Security verification audit (independent, own-model)
**Verdict: ✅ RELEASE-READY — no blockers, zero new findings.** 26 items verified with file:line (all prior P0/P1/security fixes present and correct; manifest least-privilege; no logging of URLs/headers; export excludes credentials; secrets scan 0 hits; no new deps/permissions). Key standing risk recorded: the Authorization-header refusal in `buildDownloadRequest` is the single control keeping provider credentials out of download jobs — future header sources must route through it.

**Final gates:** tsc clean · 297 passed / 5 skipped · lint 0 errors / 25 warnings · grep gates 0 · E2E --public 14 pass / 0 fail / 2 correct refusals.
