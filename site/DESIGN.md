# Aniraku Pages Site Design

## Product intent

The Pages site is the public, browser-native counterpart to the Android app. It is not a marketing-template landing page and it is not a mirrored README. It gives visitors one immediate job—understand the app and safely install the current Android build—through the same **near-black canvas, soft-white type, graphite dividers, dot-matrix utility labels, and signal-red state** used by Aniraku.

## Information architecture

| Surface | Purpose | Primary action |
| --- | --- | --- |
| Hero / signal panel | Introduces the app, current alpha, package name, and device compatibility. | Download the current APK. |
| Install sheet | Explains direct installation and the required legacy-package removal. | Open GitHub Release or Orion Store. |
| Native product rail | Shows real Home, Catalog, Watch, and Random captures in a horizontal app-like gallery. | Inspect a selected capture. |
| Playback control panel | Explains direct-first recovery, audio/provider control, quality, auto actions, and fullscreen. | Read the technical policy. |
| Trust and availability panel | States FOSS distribution, free-instance latency expectations, privacy boundaries, and project documentation. | Open legal or source documentation. |

## Visual and interaction rules

The primary desktop composition is an asymmetric command-console layout: an anchored top bar, a wide editorial hero, a narrow right-side status column, then full-width product rails. On mobile it becomes a one-handed vertical route with the download action at the top and sticky bottom navigation for **Install**, **Screens**, and **System** sections.

The palette is fixed to `#090909` black, `#141414` surface, `#1C1C1C` raised, `#343434` graphite line, `#F6F6F2` soft white, `#A2A2A0` muted, `#666664` dim, `#FF4D4D` signal red, and `#96D37B` availability green. Typography pairs `Space Mono` for labels, metadata, controls, and version details with `Inter` for reading and display weights. CSS interactions stay within `opacity` and `transform`, complete in 120–240 ms, and disable non-essential motion for reduced-motion users.

## Content integrity

The site uses only committed real app captures and local source-controlled visual assets. It links the stable GitHub **latest release** route rather than hard-coding an asset version. The direct release action, Orion Store route, package migration warning, and Android compatibility information are visible before the visitor scrolls.

## Browser QA

Local browser inspection confirmed the desktop hero renders as an asymmetric app-like command surface with the real native Watch capture, immediate GitHub APK and Orion Store actions, current Android package identity, and the red feature signal. The site contains four real product captures, a mobile dock hook at the `720px` breakpoint, a copyable `aniraku.anime.app` package ID, and the verified v2.0.Alpha APK route.
