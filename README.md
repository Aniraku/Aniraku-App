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
  <a href="https://github.com/Aniraku/Aniraku-App/releases/tag/v5.4.0">v5.4 Notes</a>
  &nbsp;
  <a href="./SUPPORT.md">SUPPORT ANIRAKU</a>
</div>

<br>

---

<div align="center">

  ### v5.3.0 is out

  Minor bug fixes, including the watch-history realtime crash fix on Anime-detail / Watch screens.
  Three builds for full coverage. Chapter navigation, trending discovery,
  random anime with genre filters, spoiler tags, skeleton loading, swipe between episodes,
  pull to refresh, landscape auto-rotate, quick actions, performance monitoring, and more.

  | APK |
  |:--|
  | `aniraku-v5.3.0-arm64.apk` |
  | `aniraku-v5.3.0-arm32.apk` |
  | `aniraku-v5.3.0-universal.apk` |

  <sub>The universal APK contains all architectures · Enable *install from unknown sources* if prompted &middot; Android 9.0+</sub>

</div>

---

### Support Aniraku

Aniraku is open source. Voluntary support helps fund **hosting, releases, and open-source development** and never changes access to app features.

| Option | Details |
|:--|:--|
| Patreon | [patreon.com/ShoIslam](https://patreon.com/ShoIslam) |
| Binance | UID `1098400042` (Binance Pay) |
Read the full [Support Guide](./SUPPORT.md).

---

### What's new in v5.3

- Fixed `cannot add 'postgres_changes' callbacks for realtime:watch-history … after 'subscribe()'` crash (Anime-detail + Watch screens now use isolated realtime topics, failures no longer restart the screen)
- Removed the unused GIF picker and Giphy API integration from comments (comments are text-only now)
- Minor bug fixes and stability improvements

### What's new in v5.2

**Player**
- Chapter navigation with intro/outro markers on the timeline
- Swipe between episodes with spring-back gesture
- Landscape auto-rotate with manual toggle
- Player lock to prevent accidental touches
- Resume from last position with confirmation pill
- Playback speed control (0.5x to 3x)
- Subtitle language selection
- Picture-in-Picture support
- Download support when source allows
- Volume and brightness gesture controls
- Double-tap seek with visual feedback
- 2x hold-speed with HUD indicator

**Discovery**
- Trending Now section on home with rank badges
- Random Anime with 13 genre filters and fade transitions
- Quick actions on long-press (Add to Library, Mark Watched, Share, Open in Browser)
- Search history with timestamps and individual delete

**Library & History**
- Continue Watching with relative timestamps and progress badges
- Watch history real-time sync with Supabase (SYNCED badge)
- Notification preferences (episode alerts, comment replies, system announcements)

**Quality**
- Skeleton loading placeholders across all screens
- Pull to refresh on home and catalog
- Performance monitor (FPS counter, slow frame detection) in dev
- Image optimization with AniList CDN resizing
- Cache strategy with 5min stale time and 30min garbage collection
- Spoiler tags with global toggle and blur animation

**Privacy & Security**
- Provider secrets never live inside the APK
- CORS allowlist on API
- PostMessage origin validation
- HTTPS-only WebView
- Android backup disabled
- No console.log in production

---

### Screenshots

<p align="center">
  <img src="./site/assets/screens/home.jpg" width="29%" style="border-radius: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);" />
  &nbsp;
  <img src="./site/assets/screens/catalog.jpg" width="29%" style="border-radius: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);" />
  &nbsp;
  <img src="./site/assets/screens/watch.jpg" width="29%" style="border-radius: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);" />
</p>

---

### How to install

1. Open the [latest release](https://github.com/Aniraku/Aniraku-App/releases/latest)
2. Download the APK (`arm64`, `arm32`, or `universal` — universal contains all architectures).
3. Install

**Note:** If you had an older alpha under `aniraku.anine.app`, please uninstall it first. Android sees them as different apps.

Full info at [aniraku.github.io/Aniraku-App](https://aniraku.github.io/Aniraku-App/)

---

### For builders

Expo + React Native with a native playback layer.

```bash
pnpm install
pnpm start
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
    Made with care &middot; Android 9+ &middot; Open source<br>
    <i>Aniraku &middot; a quiet place for anime</i>
  </sub>
</div>
