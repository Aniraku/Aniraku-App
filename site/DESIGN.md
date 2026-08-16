# Aniraku Pages Site Design

## Product intent

The Pages site is the public, browser-native counterpart to the Android app. It is not a marketing-template landing page and it is not a mirrored README. It gives visitors one immediate job—understand the app and safely install the current Android build—through the same **near-black canvas, soft-white type, graphite dividers, dot-matrix utility labels, and signal-red state** used by Aniraku.

## Information architecture

| Surface | Purpose | Primary action |
| --- | --- | --- |
| Release banner + hero / signal panel | Introduces the v2.5.Alpha standard release, app, package name, device compatibility, offline direct-source saving, and protected provider sync. | Download the current APK or read release notes. |
| Install sheet | Explains direct installation and the required legacy-package removal. | Open GitHub Release or Orion Store. |
| Native product rail | Shows real Home, Catalog, Watch, Random, signed-in Profile, and guest Alerts-preview captures. | Inspect a selected capture. |
| Playback control panel | Explains direct-first recovery, audio/provider control, quality, auto actions, fullscreen, and the in-player Offline settings section. | Read the technical policy. |
| FAQ | Answers the installation, migration, streaming, player-control, sync, and support questions without leaving the product surface. | Open a concise answer. |
| Trust and availability panel | States FOSS distribution, free-instance latency expectations, privacy boundaries, and project documentation. | Open legal or source documentation. |

## Visual and interaction rules

The primary desktop composition is an asymmetric command-console layout: an anchored top bar, compact release banner, wide editorial hero, narrow right-side status column, then full-width product rails. On mobile it becomes a one-handed vertical route with the download action at the top and sticky bottom navigation for **Home**, **Screens**, **Player**, **FAQ**, and **Install** sections.

The palette is fixed to `#090909` black, `#141414` surface, `#1C1C1C` raised, `#343434` graphite line, `#F6F6F2` soft white, `#A2A2A0` muted, `#666664` dim, `#FF4D4D` signal red, and `#96D37B` availability green. Typography pairs `Space Mono` for labels, metadata, controls, and version details with `Inter` for reading and display weights. CSS interactions stay within `opacity` and `transform`, complete in 120–240 ms, and disable non-essential motion for reduced-motion users.

## Content integrity

The site uses only committed real app captures and local source-controlled visual assets. The v2.5 release actions use the named GitHub release and explicit universal-APK asset route, while the installation content also preserves the Orion Store route. The direct release action, package-migration warning, and Android compatibility information are visible before the visitor scrolls. The banner describes only implemented behavior: eligible maximum-quality direct saves and browser-based AniList/MyAnimeList linking through the established Aniraku service. The Offline control lives inside the player settings sheet so the player overlay stays uncluttered; adaptive HLS/DASH, embedded, protected, unavailable, and non-HTTPS sources are streaming-only. The Alerts asset is expressly a guest preview, not a fabricated authenticated feed.

## Browser QA

The v2.5 release candidate retains the verified asymmetric command surface with the real native Watch capture, named GitHub APK route, Orion Store action, current package identity, signal-red ticker, six real product captures, a concise FAQ, and a five-link mobile dock at the `720px` breakpoint. The v2.5 public verification must confirm the exact `Aniraku-v2.5.Alpha.apk` asset route, the eligible-source download and provider-sync release copy, and the existing FAQ single-open behavior.

## Public deployment QA

GitHub Actions deployment `31926184437` completed successfully after GitHub Pages was enabled for the repository. The public URL `https://aniraku.github.io/Aniraku-App/` now serves the static `site/` artifact rather than branch-root README content. Live desktop inspection confirmed the real Watch hero capture, immediate GitHub APK and Orion Store actions, the four-screen product rail, current package identity, and the site’s black, white, graphite, and signal-red product treatment.
