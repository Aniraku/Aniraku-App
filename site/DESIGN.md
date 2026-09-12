# Aniraku Pages Site Design

## Product intent

The Pages site is the public, browser-native counterpart to the Android app. It is not a marketing-template landing page and it is not a mirrored README. It gives visitors one immediate job — understand the app and safely install the current Android build — through the same **near-black canvas, soft-white type, graphite dividers, dot-matrix utility labels, and signal-red state** used by Aniraku.

## Information architecture

| Surface | Purpose | Primary action |
| --- | --- | --- |
| Release banner + hero | Introduces the current stable release, package name (`aniraku.anime.app`), and Android 9+ compatibility. | Download the current APK or read release notes. |
| Architecture download grid | Offers one APK per device class: `arm64`, `arm32`, and `universal` (contains all architectures). | Download the matching APK from the named GitHub release. |
| Install sheet | Explains direct installation and the required legacy-package removal (`aniraku.anine.app` must be uninstalled first). | Open the GitHub release. |
| Native product rail | Shows real captures: Home, Catalog, Watch, Watch player, Random, and Anime detail. | Inspect a selected capture. |
| Playback / Watch section | Explains the native player surface, source console, and recovery states. | Read the playback notes. |
| Release archive | Lists past releases with version, date, and per-arch download links. | Download an older build. |
| Support section | Voluntary funding via Patreon and Binance Pay (UID). Support never gates features. | Open Patreon or copy the Binance UID. |
| FAQ | Answers installation, migration, streaming, account sync, and support questions. | Open a concise answer. |
| Trust and docs panel | States FOSS distribution, free-instance latency expectations, privacy boundaries, and project documentation. | Open legal or source documentation. |

## Visual and interaction rules

The primary desktop composition is an asymmetric command-console layout: an anchored top bar, compact release banner, wide editorial hero, narrow right-side status column, then full-width product rails. On mobile it becomes a one-handed vertical route with the download action at the top and sticky bottom navigation for the main sections.

The palette is fixed to `#090909` black, `#141414` surface, `#1C1C1C` raised, `#343434` graphite line, `#F6F6F2` soft white, `#A2A2A0` muted, `#666664` dim, `#FF4D4D` signal red, and `#96D37B` availability green. Typography pairs `Space Mono` for labels, metadata, controls, and version details with `Inter` for reading and display weights. CSS interactions stay within `opacity` and `transform`, complete in 120–240 ms, and disable non-essential motion for reduced-motion users.

## Content integrity

- The site uses only committed real app captures from `site/assets/screens/` and local source-controlled visual assets. No generated imagery, no mislabeled states.
- Release actions always target the named GitHub release (`https://github.com/Aniraku/Aniraku-app/releases/download/vX.Y.Z/aniraku-vX.Y.Z-<arch>.apk`). The `universal` APK contains all architectures.
- The package-migration warning (uninstall legacy `aniraku.anine.app`) and Android 9+ compatibility stay visible before the visitor scrolls.
- Support copy names only live routes: Patreon and Binance Pay. Removed routes (e.g. USDT) must not reappear in copy or QR assets served by the page.
- The banner describes only implemented behavior. Anything the app cannot do yet must not appear on the site.

## Release checklist

When cutting a new app release, update the site in the same pass:

1. Hero + nav version strings match the new tag.
2. All three APK routes (`arm64`, `arm32`, `universal`) resolve against the new release.
3. The release archive gains the new version entry; `README.md` and `CHANGELOG.md` are updated to match.
4. Captions still describe what the captures actually show (see `SCREENSHOT_QA.md`).

## Public deployment QA

The public URL `https://aniraku.github.io/Aniraku-app/` serves the static `site/` artifact via GitHub Pages. After each site change, verify on desktop and at the `720px` mobile breakpoint: hero version matches the latest tag, all three APK links download, the product rail renders real captures, support links resolve, and the FAQ single-open behavior still works.
