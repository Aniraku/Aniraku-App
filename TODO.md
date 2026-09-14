# Aniraku — Improvement To-Do

Goal: an anime app that looks **authored by a human**, plays better than
Anilab / Dantotsu / Hianime-class apps, and never reads as generated theming.
The design law is `design.md` ("Aniraku Afterimage") — this file turns it
into ordered, checkable work.

How to read this file:
- **P0** ship-blocking quality · **P1** visible wins · **P2** depth · **P3** nice-to-have
- Sizes: **S** ≤ half day · **M** a day or two · **L** multi-day
- Every item has an acceptance check. A task is done when the check passes,
  not when code exists.
- One rule above all: **if a screen needs explaining, the screen is wrong.**

Competitive bar (same episode, side-by-side):
- Faster to first frame than Anilab. Fewer taps to quality / subs / server.
- Calmer chrome than Hianime wrappers. No popups, no clutter, no dead buttons.
- Smarter resume than Dantotsu forks: position survives server, language,
  and quality switches; <90% entries resume, ≥90% mark complete.

---

## Track 0 — The de-slop bar (applies to every PR)

These are banned patterns. Grep-level checks, no judgement calls needed.

- [ ] No `fontFamily: "monospace"` outside timestamps, episode numbers, counts, source names (`design.md` allows exactly these)
- [ ] No text below 10px; body text 12–14px; titles are display / section / utility scale only — no 4th emphasis level
- [ ] No `letterSpacing` above ±1 outside the red utility labels
- [ ] One accent per view: signal red `#FF4D4D` marks **one** active intent; never a field of badges/dots
- [ ] No icon soup: Phosphor only, one weight per surface (`bold` on video chrome, `fill` only for play/pause states), consistent size per row (18 top bars, 20–24 rails)
- [ ] Touch targets ≥ 30px + hitSlop; rails ≥ 32px
- [ ] Space and rules instead of bordered boxes; corners 4–8px (12px only for media crops); no pill-everything
- [ ] No loading theater: no spinners where a 120–180ms opacity swap works; no fake progress bars (they must bind to real progress events)
- [ ] No decorative animation; motion only connects cause → effect
- [ ] Copy is terse: a button never narrates what it already says
- [ ] No AI-slop words in UI copy: no "delve", "elevate", "seamless", "vibrant", "unleash", "embark", "Oops", "!"-led hype. Error copy states what happened + what to do in one sentence.
- [ ] No emoji in UI. No gradient text. No glassmorphism panels over artwork.
- [ ] No nested bordered cards. No card inside a card. No section header that repeats what the content already shows.
- [ ] One primary action per view. Everything else is text, quiet icon, or 1px control.

**Done means:** a pass over `grep -n "monospace\|letterSpacing: [2-9]\|fontSize: [0-9][,}]"` in `app/` + `components/` returns nothing that breaks these rules.

**Status: swept.** 90 style declarations across 23 files converted (labels/buttons/copy/tags → sans, utility mono kept only for time/count/episode-number/meta/kickers per `design.md`, 10px floor everywhere, letter-spacing clamped to 1, tab bar de-monospaced). Remaining monospace is sanctioned utility at ≥10px — re-run the grep after every UI PR and keep it that way.

---

## Track 1 — Quality engine (provider-truth quality) · P0

The quality menu must show what the provider **actually serves**, decrypted
from the Auto (master) URL — never claimed labels, never invented resolutions.

Pipeline (this is the contract, `lib/hls-variants.ts` owns it):
1. Take the URL the player is **actually playing** (`videoSourceUri`).
2. If it is a proxy URL (`/api/v1/proxy?url=…`), unwrap `?url=` to get the
   real CDN base. Variant URIs inside the manifest are relative to the CDN,
   not to the proxy — resolving against the proxy 404s.
3. Fetch the master with the same headers the player uses (Referer / UA
   passthrough). Do not invent headers; do not drop them.
4. Parse `#EXT-X-STREAM-INF` entries: `RESOLUTION`, `BANDWIDTH`, `CODECS`
   + next non-comment URI line. Skip audio-only and `#EXT-X-I-FRAME` entries.
5. `resolveVariantUrl(uri, cdnBase)` each entry to an absolute CDN URL.
6. Dedupe per height, keep highest bandwidth (720p AV1 + 720p AVC → one 720p).
7. Sort desc by height, then bandwidth. Fewer than 2 distinct heights → no
   menu (silent fallback, never an empty sheet).
8. Mounting a choice loads that variant playlist URL directly (re-wrapped
   through the proxy when playback is proxied). Auto remounts the master.
9. DASH (`.mpd`) cannot mount per-rendition → `Representation` heights become
   honest ExoPlayer bitrate caps, not URL swaps.

- [x] Parse `#EXT-X-STREAM-INF` variants out of the master playlist (`lib/hls-variants.ts`), resolve relative URIs against the **unwrapped** CDN URL (proxy URLs embed the real one as `?url=`), dedupe per height keeping the highest-bandwidth encode — 9 vitest cases green
- [x] Watch screen fetches the master it is actually playing and offers `Auto + 1080p/720p/…`; picking a variant mounts that playlist URL directly; Auto remounts the master; variant URLs re-wrap through the proxy when playback is proxied
- [x] Fallback chain preserved: HLS variants → ExoPlayer bitrate caps (Android) → provider labels; parse failure is silent
- [x] **S** — Remember the last manual quality per provider (`AsyncStorage`, keyed `provider:quality`), re-apply it when the same provider serves Auto again; show a 1-line note in the settings sheet
- [ ] **M** — Bind quality choice to downloads: "download 1080p" should fetch that variant URL, not the master's highest guess
- [x] **S** — DASH (`.mpd`) parity: parse `Representation` entries into honest bitrate caps (`parseDashRepresentations` + `buildDashQualityOptions`, tested)
- [ ] **S** — Web: feed parsed variants to hls.js as levels (`hls.levels`) instead of URL swapping, so ABR recovers instantly on "Auto"
- [x] **S** — Show what Auto means: the settings sheet reads `AUTO ADAPTS UP TO 1080P` from the parsed master (device-reporting the *current* rendition via ExoPlayer track events is still open — see the PiP/track item below) (from ExoPlayer track events / hls.js level), e.g. `Auto · 720p`, so "Auto" stops being a black box
- [ ] **S** — Token-expiry guard: if a variant URL 403s with an embedded timestamp (`hasExpiredEmbeddedToken`), refresh the master once and re-resolve before failing over to the next server — variant URLs rot faster than masters
- [ ] **S** — Cache parsed variants per master URL (`hlsVariantsCache`) and invalidate on provider / episode / refresh change only; never re-fetch the master on every settings open
- [ ] **S** — Quality sheet copy: `Auto · up to 1080p` header line, then one row per height (`1080p`, `720p`…), saved-server note as a single muted line. No "HD/SD/4K" marketing labels, no bitrate numbers in the row title.

**Done means:** on Momo + Niko + Ally, the sheet lists exactly the heights in
the served master (verified by curling the Auto URL), picking 720p mounts the
720p media playlist, Auto remounts the master, and a master with one rendition
shows no sheet at all.

---

## Track 2 — Player UI/UX · P0–P1

The player is the product. Bar: Netflix-level calm, Anilab-level features, zero gimmicks.

Chrome layout (fixed, do not reinvent per PR):
- Top bar: back · title (1 line, ellipsize) · speed · subs · server pill · settings gear. Inline hides PiP + orientation-lock + download; fullscreen shows all.
- Center: rewind · play/pause · forward + skip-intro pill only while inside the segment.
- Bottom rail: position / duration (utility mono), segmented track with chapter tint, fullscreen + lock.
- Source console (servers / quality / subs / speed) is a bottom sheet on demand. It never competes with the video plane.

- [x] **S** — Buffering state: centered spinner veil over the video (visible with chrome hidden); play button no longer double-reports buffering (over a dimmed frame), not only inside the play button; users read "frozen" today
- [ ] **S** — Seek bar: add left/right arrow key + gesture fine-tuning already covered; add double-tap-and-hold to keep skipping (stack +10s every 400ms while held)
- [x] **S** — Controls fade: 180ms animated opacity, mounted for the whole source lifetime, `pointerEvents` follows visibility so gestures still reach the overlay when faded out (React state → Animated), and never flash controls when the auto-hide timer fires during a modal
- [x] **M** — Audio track picker in the settings sheet when `audioTracks.length > 1` (chips → `selectedAudioTrack` index) (state already exists: `selectedAudioTrack`) — needed for multi-audio servers
- [x] **M** — Intro skip countdown: `Skip Intro · 62s` on the overlay pill and the in-deck pill, live from the segment end of remaining seconds (`Skip Intro · 62s`), auto-dismiss after OP ends
- [x] **S** — Resume pill only shows when the entry is < 90% watched (near-end entries had nothing left to resume); position was already above the timeline (currently shows even near-end entries)
- [x] **S** — Lock mode: second tap within 1.6s required (pill flips to `Tap again to unlock` with a red border) — pocket taps stop unlocking the player with haptic (single tap shows a hint pill first) — prevents pocket unlocks
- [ ] **M** — PiP: verify `enterPictureInPicture` on a real Android 14 device; handle `onPictureInPictureStatusChanged` to pause UI updates; disable the button on devices where it throws. While at it, surface the live ExoPlayer video-track height into the `Auto · 720p` line so Auto reports the current rendition, not just the ceiling.
- [ ] **S** — Orientation: entering fullscreen should offer "landscape" (sensor), not hard `LANDSCAPE` — reversed-landscape phones exist
- [x] **S** — Error surface: `humanPlayerError()` maps the common engine codes to one honest sentence (tested); raw detail stays in the small diagnostic line (`BAD_HTTP_STATUS` → "This server refused the stream. Trying the next one…"), keep the diagnostic line only in the error card
- [x] **M** — Gestures: volume/brightness swipes snap to 5% steps and only update state on change (no more integer flicker) (5% volume steps) so the HUD doesn't flicker through every integer
- [ ] **L** — Chapter markers from real chapters (TMDB/AniSkip OP+ED already integrated) rendered as segmented track — visual, no new deps
- [ ] **S** — Double-tap sides: ±10s with a single flash label (`+10s` / `−10s`), no stacked ripples. Hold extends the skip (see seek-bar item). Haptic on each jump, none on hold ticks.
- [ ] **S** — Speed sheet: 0.5 / 0.75 / 1 / 1.25 / 1.5 / 1.75 / 2, persists per `aniraku.watch.preferences`, applies without remounting the source.
- [ ] **S** — Subtitle sheet: language list from `source.subtitles` via `matchSubtitleTrack` + Off + size control; preference persists; cue renderer stays above the timeline in fullscreen.
- [ ] **M** — "Up next" end-card: at 90% or on ended, a quiet 10s countdown card with next-episode poster + title, cancellable, respects `autoNext` off. Auto-next exists headless today — this makes it visible without noise.

**Done means:** tap every control once per release with chrome hidden and
shown; zero dead buttons; zero control flashes during modals; buffering is
unmistakable even with chrome hidden.

---

## Track 3 — Screen-by-screen humanization audit · P1

One PR per screen, each measured against `design.md` compositions. For each: remove containers,
let art carry hierarchy, one focal event, terse copy.

- [ ] **M** Home — edge-to-edge continue/discover image event + editorial list; kill any uniform card grid; catalog links are text-led
- [ ] **M** Catalog/Search — poster gallery with varied rhythm, temporary search field, red active sort line; no equal cells
- [ ] **S** Schedule — time-led list: times anchor the left in utility type; art strip right; no day cards
- [ ] **S** Random — one poster, one fact, one action; no dashboard
- [ ] **M** Anime detail — backdrop atmosphere → poster/title pair → action bar; episode rows keep list rhythm with real thumbnails; no boxed controls
- [ ] **M** Watch below-fold — "You are watching" block follows the same rules: tabs/servers quiet, episode grid dense and typographic; remove the duplicated technical labels
- [ ] **S** Library/profile — resume rows + saved art first; signed-out state is one calm welcome + one action
- [ ] **S** Settings (app-level) — precise grouped list, leading icons, rules between groups; no cards
- [ ] **S** Auth/support — same copy rules; no exclamation marks, no "Oops"
- [ ] **S** Episode sheet — utility-scale metadata, one continue action
- [ ] **S** Comments — text-only rows, no GIF / sticker rails; reply bar matches section type scale; no nested cards around each comment

**Done means:** side-by-side screenshot review per screen against the `design.md` composition table; anything that looks "themed" rather than "authored" goes back.

---

## Track 4 — Reliability · P0

No infinite spinners. Every wait has a deadline and a next step.

- [x] **M** — Startup watchdog covers the embed path: WebView `onLoadEnd` reports readiness, 15s dead-man switch falls through to the next server (today only direct/proxy sources get the 6s watchdog; a dead embed spins forever until its own onError)
- [x] **S** — Server switch mid-episode preserves position (works via `pendingResume`) — add a test for it (`watch-engine` pure function + integration smoke)
- [x] **S** — Stream cache: reuse across language switches only when the provider+lang matches (audit `streamCacheKey` usage)
- [x] **M** — AniSkip: cache negative results per (malId, episode) already done — add timeout telemetry line in diagnostics so "no skip data" vs "timeout" is distinguishable in the error card
- [x] **S** — Downloads: handle "file exists" from a previous partial attempt (delete + retry already handled — add a stale-index cleanup for files removed outside the app)
- [x] **M** — History sync: conflict rule when local progress > server progress on resume (prefer max, not last-write)
- [x] **S** — Auto-hide is suppressed while scrubbing (`dragPct !== null`) (drag > 3.5s must not hide chrome)
- [x] **S** — Offline open: Library + resume rows render from local cache with zero network; download playback never touches the stream path (`findOfflineDownload` first, no watchdog, no proxy)
- [x] **S** — Retry copy honesty: TRY AGAIN re-fetches the same provider once (`refresh: true`), SWITCH SERVER moves to the next unblocked provider. Never loop the same dead URL twice without a refresh flag.

---

## Track 5 — Performance · P1

Budgets, not vibes. Measure on a low-end Snapdragon 680-class device.

- [x] **M** — Measure cold start (tti via `expo-performance` or simple timestamps), log to console in dev only; fix the top offender. Budget: cold start < 2.5s, Watch mount-to-first-frame < 1.5s on cached server.
- [x] **S** — Episode grid: virtualize when `pagedEpisodes > 100` (page size is 50 today — keep paging, just verify no jank on 500-ep shows like One Piece/Detective Conan)
- [x] **S** — Poster images: enforce `cachePolicy: "memory-disk"` + low-res placeholder on every rail; audit any `<Image>` without it
- [x] **S** — Memo audit on Watch screen: `displayedQualityOptions`, `filteredEpisodes` recompute per second due to `currentTime` — split time-dependent state from list state (biggest render win on low-end phones)
- [x] **M** — Video reload on server switch should not remount the `<Video>` surface when only the URL changed (key it by provider to keep the player alive where possible)
- [x] **S** — Kill per-second re-renders: `currentTime` ticks must not re-run `watchQualityOptions`, `episodePageSlice`, or subtitle-track matching. Time flows through refs + the progress bar; lists memo on source/episode change only.

---

## Track 6 — Competitive features · P2

Picked against Anilab/Dantotsu/Hianime wrappers — only features that compound the core loop.

- [ ] **M** — New-episode notifications (background check of `nextAiringEpisode` + local notification; no push server needed)
- [ ] **S** — MAL/AniList import on first run (list import → library seeding)
- [ ] **M** — "Up next" card at episode end (auto-next exists; add a 10s visual countdown with poster, cancellable) — see Track 2 end-card; this item tracks the below-fold + Library wiring, not the overlay itself
- [ ] **S** — Continue-watching widget-grade speed: precompute resume rows locally so Library opens instantly offline
- [ ] **L** — Tablet/landscape two-pane layout for detail (list + episodes), per `design.md` navigation rules
- [ ] **S** — App language scaffolding (i18n keys for player + settings; strings today are inline)
- [ ] **S** — Filler + recap flags on episode rows (data exists via `isFiller`; surface it as one muted word, not a badge field)

---

## Track 7 — Process that keeps it handcrafted · ongoing

- [ ] **S** — Add the Track-0 de-slop list as a PR-template checklist
- [ ] **M** — Vitest for every pure engine (`watch-engine`, `watch-quality`, `hls-variants`, `subtitle-parser` are the spine — they must stay 100% covered; UI can stay manual)
- [ ] **S** — Screenshots in PRs for any `app/` route change (before/after), stored in the PR not the repo
- [ ] **S** — Version bump + CHANGELOG entry per shipped batch (existing convention: `chore: bump version …`)
- [ ] **S** — Zero-dead-button pass per release: tap every player control, every sheet row, every empty state action once on device before tagging.

---

## Definition of done (whole app)

1. Track 0 grep passes on every screen.
2. Every P0 checkbox across tracks is checked with its acceptance check demonstrated.
3. Player: quality menu = provider truth; fallback chain silent; zero dead buttons (tap every control once per release).
4. `npx tsc --noEmit` clean, `vitest run` green, ESLint 0 errors.
5. Side-by-side with Anilab on the same episode: faster to playing, fewer taps to quality/subs, calmer UI.
