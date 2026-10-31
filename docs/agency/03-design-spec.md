# 03 — Design Spec (Aniraku native parity build)

## IA changes
- **Downloads hub** (`app/downloads.tsx`) = queue + storage management: active job card (title/EP, quality chip, byte progress, cancel), queued list, completed list, Wi-Fi-only switch, quota chips, storage bar (used/free) — already present (D2/D3); add failed-with-retry rows and per-item size.
- **Library badges**: saved rows gain small mono "DL" badge when an offline copy exists; episode rows on anime detail get a static Downloaded glyph (no tap affordance — navigates to hub only if the episode is downloadable).
- **Continue-watching**: stays Home-first (edge-to-edge hero + rail); long-press remove already there; badge mirrors "EP n" progress. No new screen — placement unchanged.

## Themed selector system
House pattern exists: `components/choice-sheet.tsx` — module-bus `showChoiceSheet()`, Modal bottom sheet, kicker/title/message, options with `primary|destructive|muted` variants, `isCurrent` red dot, haptics. Build on it:
- **ThemedDialog** — same bus pattern, centered card for confirmations: two-button (Cancel / destructive red). Replaces every confirm-category `Alert.alert`.
- **ThemedToast/Notice** — inline banner (not modal) for "Could not update My List" class errors: message + one Retry action; auto-dismiss 4s. Replaces nested error alerts.
- **ThemedSelect** — ChoiceSheet covers single-choice pickers; use for quality/download/server selection with `isCurrent`.

States: default (surface `#111`, 4–8px radius, thin border), pressed (opacity 0.85 + Light haptic), disabled (50% opacity, no haptic), destructive (`#FF4D4D` label). Microcopy: kicker "REMOVE", title "Delete download?", body `"Frieren" · EP 04 will be removed from this device.` Cancel / Delete.

## Download sheet flow
Trigger: Download button on episode row / player panel. Sheet shows: quality list (from `lib/hls-variants.ts` renditions) each with estimated size ("1080p · ~1.2 GB"), current pinned quality marked, storage bar with post-download projection ("1.2 GB · 8.4 GB free"), Wi-Fi notice if `wifiOnly` and offline, Start button. Queue states: **queued** ("WAITING"), **downloading** (progress + speed + cancel), **paused-wifi** ("WAITING FOR WI-FI"), **paused-storage** ("STORAGE LIMIT — free up space or raise the quota", one Retry), **failed** ("Download failed · RETRY"), **done** (moves to completed list). Storage-full copy: title "Not enough space", body "This download needs ~1.2 GB. Free up space or download a lower quality.", actions Cancel / Choose lower quality / Continue anyway (omit third if disk is short, not just quota).

## Player spec
- **Gestures**: double-tap left/right = ±10s (ripple indicator), single-tap = toggle overlay, vertical-left drag = brightness, vertical-right = volume, horizontal drag = seek with preview time chip, pinch = scale Fit/Fill. Lock mode disables all but overlay tap. All under 180ms press feedback.
- **Autoplay-next**: 5s countdown card bottom-right: "Next: EP 05 · Playing in 5s" + Cancel / Play now; progress ring; cancels on scrub/pause/lock.
- **Skip intro**: chip bottom-right during opening window: "SKIP INTRO", 48dp, appears ≤0.5s after window start, fades 150ms.

## Perceived speed
- **Skeletons**: poster-shaped blocks (12px radius) for rails/hero, row-shaped for lists; shimmer 120–180ms opacity pulse, no slide theater. Show only after >300ms.
- **Prefetch**: on rail focus/viewport entry prefetch anime detail (`staleTime` already 10–15min); prefetch next episode's source list when current playback reaches 80%.

## System / chrome polish
- **Edge-to-edge**: translucent status + nav bars, per-screen surface theming (player = black, lists = base black), safe-area insets respected.
- **Tab bar**: quiet integrated dock per Afterimage; red active indicator; press haptic Selection; 48dp.
- **Launch polish**: no splash theater — instant first frame, 150ms fade-in of Home hero.
- **Haptics**: Selection = tab/item choice, Light = press, Medium = destructive confirm, Success = download complete.

## Nothing-theme pixel pass (round-6 addition, scope confirming)
Audit every screen against design.md "Afterimage" tokens (type scale, spacing, radius, color tone, contrast, motion), fix deviations pixel-by-pixel. External token reference being pulled from nothing.tech via design MCP to calibrate the Nothing-style tone (dot-matrix accents, monochrome discipline).

## Nothing-token calibration (measured via design MCP on nothing.tech)
- Background: `#040404`/`#000000` pure blacks; surfaces `#3c3c3c`; muted text `#b1b3b3`/`#595a5a`; dividers `#d8d9d9` (light contexts only).
- Typography: NType82-style grotesque — Display 48/H1 40/H2 24/H3 20/Body 18, weights 700 for display heads, 400 body, line-height 1.2–1.5. Map onto existing font stack (closest available family; no new font download unless trivially cacheable).
- Accent: **Aniraku keeps `#FF4D4D` as the sole chroma** — Nothing's site accent is yellow `#ffc700` and is NOT adopted; what we adopt is the tone discipline (monochrome surfaces, technical/dot-matrix accents, generous black space).
- Motion stays 120–180ms per Afterimage; reduced-motion collapses to 0ms.

## A11y
48dp targets everywhere; sheet/dialog: focus trapped, Esc/backdrop dismiss, `accessibilityRole="alert"` for notices, announce download state changes; honor reduced-motion → skeletons static, transitions 0ms; captions/labels on all icon buttons; quality picker announces size per option.

## States matrix
New surfaces carry: loading (skeleton/sheet spinner), empty (Downloads: "Nothing downloaded yet · Find the download button on any episode"), error (toast + retry), partial (queue only — never playable), disabled (download button when source unsupported: "Not available for download").

## Signup / consent surfaces (round-6 addition, scope confirming)
- Signup form: strict email field validation + inline typo suggestion ("Did you mean gmail.com?") before submission; ToS + Privacy checkbox row with linked full documents.
- First-launch consent sheet for existing users after update (versioned acceptance), only when scope confirms.

## Appendix — Alert.alert inventory (20 call-sites / 8 files)
| Category | Count | Sites (file:line) |
|---|---|---|
| Destructive confirm | 11 | search.tsx:179; catalog.tsx:165; settings.tsx:177,178,179; downloads.tsx:73; library-view.tsx:169; anime-comments.tsx:100; index.tsx:68; watch:1964 (dies w/ external links), watch:2129 |
| Error alert | 8 | downloads.tsx:76; settings.tsx:177,178,179 (nested); index.tsx:72,134,245; library-view.tsx:178,243 |
| Info/toast | 1 | anime-card.tsx:26 |
| Option dialog | 1 | anime-comments.tsx:105 (spoiler reveal) |

OS surfaces: `Directory.pickDirectoryAsync` (lib/downloads.ts:56) — removed by app-private storage; `Share.share` (anime/[id].tsx:105, anime-card.tsx:42, watch:2137) — keep native share sheet; `Linking.openURL` mailto/oauth — keep.

Caveat: counts from grep categorized by message text; one or two confirmations may land better as toasts than dialogs — final disposition during build.
