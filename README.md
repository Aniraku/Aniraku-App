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
  <a href="https://github.com/Aniraku/Aniraku-App/releases/tag/v5.4.3">v5.4.3 Notes</a>
  &nbsp;
  <a href="./SUPPORT.md">SUPPORT ANIRAKU</a>
</div>

<br>

---

<div align="center">

  ### v5.4.3 is out

  Subtitle parser overhaul, fullscreen controls fix, dead control buttons restored, all servers accepted from backend, embed only as last resort. Three builds for full coverage. Chapter navigation, trending discovery, random anime with genre filters, spoiler tags, skeleton loading, swipe between episodes, pull to refresh, landscape auto-rotate, quick actions, performance monitoring, and more.

  | APK |
  |:--|
  | [Aniraku-v5.4.3-arm64.apk](https://github.com/Aniraku/Aniraku-App/releases/download/v5.4.3/aniraku-v5.4.3-arm64.apk) |
  | [Aniraku-v5.4.3-arm32.apk](https://github.com/Aniraku/Aniraku-App/releases/download/v5.4.3/aniraku-v5.4.3-arm32.apk) |
  | [Aniraku-v5.4.3-universal.apk](https://github.com/Aniraku/Aniraku-App/releases/download/v5.4.3/aniraku-v5.4.3-universal.apk) |

  <sub>The universal APK contains all architectures · Enable *install from unknown sources* if prompted &middot; Android 9.0+</sub>

</div>

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
