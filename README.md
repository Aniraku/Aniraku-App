<div align="center">

<img src="./assets/images/icon.png" width="96" alt="Aniraku Android app icon" />

# Aniraku Android

Native Android client for Aniraku.

<a href="https://aniraku.github.io/Aniraku-App/">Open the app site</a>
&nbsp; · &nbsp;
<a href="https://github.com/Aniraku/Aniraku-App/releases/latest">Download the latest APK</a>
&nbsp; · &nbsp;
<a href="https://github.com/Aniraku/Aniraku-App/releases/tag/v4.2">v4.2 release notes</a>
&nbsp; · &nbsp;
<a href="https://rookieenough.github.io/Orion-Data/redirect.html?id=aniraku">Orion Store</a>

</div>

---

## What this repository contains

This is the native Android client for Aniraku: anime discovery, playback, library, watch history, relationships, provider controls, and downloads where the source supports it.

The current standard release is **v4.2**, package `aniraku.anime.app`, version code `22`, and Android 9+ is supported. The universal APK and its integrity information are available on the [v4.2 release page](https://github.com/Aniraku/Aniraku-App/releases/tag/v4.2).

## Screens from the app

These images are stored in this repository under `site/assets/screens/`.

<p align="center">
  <img src="./site/assets/screens/home.jpg" width="31%" alt="Aniraku Android Home screen" />
  <img src="./site/assets/screens/catalog.jpg" width="31%" alt="Aniraku Android Catalog screen" />
  <img src="./site/assets/screens/watch.jpg" width="31%" alt="Aniraku Android Watch screen" />
</p>

<p align="center">
  <img src="./site/assets/screens/random.jpg" width="31%" alt="Aniraku Android Random screen" />
  <img src="./site/assets/screens/profile.jpg" width="31%" alt="Aniraku Android Profile screen" />
  <img src="./site/assets/screens/alerts-preview.png" width="31%" alt="Aniraku Android guest Alerts preview" />
</p>

More screens are available in [`site/assets/screens/`](site/assets/screens/), including Schedule, Details, Relationships, and the Watch player.

## Player and library

The native player includes:

- watch-history recovery after rebuffering;
- a persistent cache with a time-priority reserve and recovery cushion;
- direct Downloads for eligible progressive sources;
- provider and audio controls;
- direct, proxy, and verified-embed recovery paths;
- AniSkip, fullscreen playback, and list synchronization; and
- AniList and MyAnimeList linking through the protected browser flow used by `aniraku.tech`.

Adaptive HLS/DASH, embedded, DRM-protected, non-HTTPS, and unavailable sources remain streaming-only for Downloads.

Provider client secrets and tokens are not bundled into the APK.

## Install

1. Open the [latest GitHub release](https://github.com/Aniraku/Aniraku-App/releases/latest), or use the [v4.2 release page](https://github.com/Aniraku/Aniraku-App/releases/tag/v4.2).
2. Download the universal Android 9+ APK.
3. If an older alpha installed under `aniraku.anine.app` is present, uninstall it first because Android treats the package migration as a separate application.

The app site also contains compatibility, privacy, terms, integrity, and trust information: [aniraku.github.io/Aniraku-App](https://aniraku.github.io/Aniraku-App/).

## Development

This is an Expo/React Native project with a native playback and storage layer.

```bash
pnpm install
pnpm start
```

Before submitting a change, check the relevant tests and read [CONTRIBUTING.md](CONTRIBUTING.md). Architecture notes are in [`docs/`](docs/), and the project design decisions are recorded in [`design.md`](design.md).

## Important notes

The backend runs on a free cloud instance, so source discovery can take longer during busy periods. Provider availability can change. Use Aniraku only for media you are authorized to access, and read [TERMS.md](TERMS.md), [PRIVACY.md](PRIVACY.md), and [SECURITY.md](SECURITY.md) before using or contributing to the project.

<div align="center"><sub>Aniraku Android · Android 9+ · open source</sub></div>
