<div align="center">
  <img src="./assets/images/icon.png" width="110" alt="Aniraku icon" style="border-radius: 28px; box-shadow: 0 8px 32px rgba(139, 92, 246, 0.25);" />

  <br><br>

  # Aniraku Android

  <p>
    <i>A quiet anime companion for your phone</i>
  </p>

  <p>
    <a href="https://github.com/Aniraku/Aniraku-App/releases/latest">
      <img src="https://img.shields.io/github/downloads/Aniraku/Aniraku-App/total?style=for-the-badge&logo=github&label=Downloads&color=c4b5fd&labelColor=1e1b4b" />
    </a>
    <a href="https://github.com/Aniraku/Aniraku-App/releases/latest">
      <img src="https://img.shields.io/github/v/release/Aniraku/Aniraku-App?style=for-the-badge&color=a78bfa&labelColor=1e1b4b" />
    </a>
    <img src="https://img.shields.io/badge/Android-9%2B-a5b4fc?style=for-the-badge&logo=android&logoColor=white&labelColor=1e1b4b" />
    <img src="https://img.shields.io/badge/Open%20Source-c4b5fd?style=for-the-badge&labelColor=1e1b4b" />
  </p>
  <br>
  <a href="https://github.com/Aniraku/Aniraku-App/releases/latest">Download APK</a>
  &nbsp;
  <a href="https://aniraku.github.io/Aniraku-App/">App Site</a>
  &nbsp;
  <a href="https://github.com/Aniraku/Aniraku-App/releases/tag/v5.6.9">v5.6.9 Notes</a
  &nbsp;
  <a href="./SUPPORT.md">SUPPORT ANIRAKU</a>
</div>

<br>

---

### How Aniraku Compares

| Feature | Aniraku | Old Anilab | Th3-Anime | AniStream | Animyx |
|:--|:--:|:--:|:--:|:--:|:--:|
| **Open Source** | Yes | No | No | No | No |
| **Multi-Provider** | Yes | Yes | Yes | Limited | Yes |
| **Skip Intro/Outro** | Yes (AniSkip) | Yes | No | No | No |
| **Quality Selection** | Auto + Manual | Auto only | Manual | Manual | Auto |
| **Subtitle Customization** | Font, Size, BG, Outline | Basic | Basic | None | Basic |
| **Download/Offline** | Yes | Yes | No | No | Yes |
| **PiP (Picture-in-Picture)** | Yes | Yes | No | No | No |
| **Sleep Timer** | Yes | No | No | No | No |
| **Volume/Brightness Gestures** | Yes | Yes | No | No | Partial |
| **Hold for 2x Speed** | Yes | No | No | No | No |
| **Server Fallback Chain** | Yes (4-layer) | No | No | No | No |
| **Episode Notifications** | Yes (stream-verified) | Yes | No | No | Partial |
| **MAL/AniList Sync** | Yes | Yes | No | No | No |
| **Watch Statistics** | Yes | No | No | No | No |
| **Recommendations** | Yes | No | No | No | Partial |
| **Notify Me (per-anime)** | Yes | No | No | No | No |
| **Onboarding Flow** | Yes | No | No | No | No |
| **NSFW Toggle** | Yes | Yes | No | No | No |
| **Episode Thumbnails** | Yes (TMDB) | Yes | No | No | Partial |
| **Comments/Ratings** | Yes | No | No | No | No |
| **Bookmark Sync** | Yes (cloud) | Local only | No | No | Local |
| **Design System** | "Nothing" (custom) | Material | Basic | Basic | Material |

---

### v5.6.9 is out

Rate-limit optimization for AniList's temporary 30 req/min cap: Home now costs 2 requests total (merged rails incl. a new "Just finished" shelf), notifications batch 50 bookmarks per request, search commits on word finish, and Random is fixed (pool pages 1–300, aligned startup prefetch). Dead code removed.

| APK |
|:--|
| [Aniraku-v5.6.9-arm64.apk](https://github.com/Aniraku/Aniraku-App/releases/download/v5.6.9/aniraku-v5.6.9-arm64.apk) |
| [Aniraku-v5.6.9-arm32.apk](https://github.com/Aniraku/Aniraku-App/releases/download/v5.6.9/aniraku-v5.6.9-arm32.apk) |
| [Aniraku-v5.6.9-universal.apk](https://github.com/Aniraku/Aniraku-App/releases/download/v5.6.9/aniraku-v5.6.9-universal.apk) |

<sub>The universal APK contains all architectures · Enable *install from unknown sources* if prompted &middot; Android 9.0+</sub>

---

### Coming Soon

| Feature | Status | Notes |
|:--|:--|:--|
| **Watch Party** | Planned | Social co-watching with synced playback. Requires backend infrastructure and real-time sync layer. |
| **Chromecast/Casting** | Planned | Google Cast SDK integration for TV playback. |
| **Background Audio** | Planned | Listen to anime audio while the app is backgrounded. |
| **Light Theme** | Planned | Full light mode with the same "Nothing" design language. |

---

### Support Aniraku

Aniraku is open source. Voluntary support helps fund **hosting, releases, and open-source development** and never changes access to app features.

| Option | Details |
|:--|:--|
| Patreon | [ShoIslam](https://patreon.com/ShoIslam) |
| Binance | UID `1098400042` (Binance Pay) |
Read the full [Support Guide](./SUPPORT.md).

### Screenshots

<p align="center">
  <img src="./site/assets/screens/home.jpg" width="29%" style="border-radius: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);" />
  &nbsp;
  <img src="./site/assets/screens/catalog.jpg" width="29%" style="border-radius: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);" />
  &nbsp;
</p>

---

### How to install

1. Open the [latest release](https://github.com/Aniraku/Aniraku-App/releases/latest)
2. Download the APK (`arm64`, `arm32`, or `universal` — universal contains all architectures).
3. Install

**Note:** If you had an older alpha under `aniraku.anine.app`, please uninstall it first. Android sees them as different apps.

Full info at [Aniraku-App](https://aniraku.github.io/Aniraku-App/)

---

### For builders

Expo + React Native with a native playback layer.

```bash
pnpm install
pnpm dev
```

Build the server:
```bash
pnpm build
pnpm start
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.
Design notes in [`design.md`](design.md).

---

### Gentle notes

- Backend runs on a free cloud instance, so discovery can be slower during busy hours
- Providers can come and go
- Only use media you are allowed to watch
- Read [TERMS.md](TERMS.md) | [PRIVACY.md](PRIVACY.md) | [SECURITY.md](SECURITY.md)

<br>

<div align="center">
  <sub>
    Made with care &middot; Android 9+ &middot; Open source under the [MIT License](./LICENSE)<br>
    <i>Aniraku &middot; a quiet place for anime</i><br>
    The Aniraku name and icon aren't covered by the license — please don't distribute copies that present themselves as Aniraku.
  </sub>
</div>
