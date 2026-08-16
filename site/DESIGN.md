# Aniraku Pages Site Design

## Product intent

The Pages site is the public, browser-native counterpart to the Android app. It is not a marketing-template landing page and it is not a mirrored README. It gives visitors one immediate job—understand the app and safely install the current Android build—through the same **near-black canvas, soft-white type, graphite dividers, dot-matrix utility labels, and signal-red state** used by Aniraku.

## Information architecture

| Surface | Purpose | Primary action |
| --- | --- | --- |
| Release banner + hero / signal panel | Introduces the v2.2.Alpha standard release, app, package name, device compatibility, and calmer native search recovery. | Download the current APK or read release notes. |
| Install sheet | Explains direct installation and the required legacy-package removal. | Open GitHub Release or Orion Store. |
| Native product rail | Shows real Home, Catalog, Watch, Random, signed-in Profile, and guest Alerts-preview captures. | Inspect a selected capture. |
| Playback control panel | Explains direct-first recovery, audio/provider control, quality, auto actions, and fullscreen. | Read the technical policy. |
| FAQ | Answers the installation, migration, streaming, player-control, sync, and support questions without leaving the product surface. | Open a concise answer. |
| Trust and availability panel | States FOSS distribution, free-instance latency expectations, privacy boundaries, and project documentation. | Open legal or source documentation. |

## Visual and interaction rules

The primary desktop composition is an asymmetric command-console layout: an anchored top bar, compact release banner, wide editorial hero, narrow right-side status column, then full-width product rails. On mobile it becomes a one-handed vertical route with the download action at the top and sticky bottom navigation for **Home**, **Screens**, **Player**, **FAQ**, and **Install** sections.

The palette is fixed to `#090909` black, `#141414` surface, `#1C1C1C` raised, `#343434` graphite line, `#F6F6F2` soft white, `#A2A2A0` muted, `#666664` dim, `#FF4D4D` signal red, and `#96D37B` availability green. Typography pairs `Space Mono` for labels, metadata, controls, and version details with `Inter` for reading and display weights. CSS interactions stay within `opacity` and `transform`, complete in 120–240 ms, and disable non-essential motion for reduced-motion users.

## Content integrity

The site uses only committed real app captures and local source-controlled visual assets. The v2.2 release actions use the named GitHub release and explicit universal-APK asset route, while the installation content also preserves the Orion Store route. The direct release action, package-migration warning, and Android compatibility information are visible before the visitor scrolls. The banner describes the native search improvement precisely: input settling, duplicate-request coalescing, short-lived response reuse, and a controlled HTTP 429 retry window. The Alerts asset is expressly a guest preview, not a fabricated authenticated feed.

## Browser QA

The v2.2 release candidate retains the verified asymmetric command surface with the real native Watch capture, named GitHub APK route, Orion Store action, current package identity, signal-red ticker, six real product captures, a concise FAQ, and a five-link mobile dock at the `720px` breakpoint. The v2.2 public verification must confirm the exact `Aniraku-v2.2.Alpha.apk` asset route, the updated rate-limit-resilience release copy, and the existing FAQ single-open behavior.

## Public deployment QA

GitHub Actions deployment `31926184437` completed successfully after GitHub Pages was enabled for the repository. The public URL `https://aniraku.github.io/Aniraku-App/` now serves the static `site/` artifact rather than branch-root README content. Live desktop inspection confirmed the real Watch hero capture, immediate GitHub APK and Orion Store actions, the four-screen product rail, current package identity, and the site’s black, white, graphite, and signal-red product treatment.
