# Screenshot QA

Living checklist for the public capture gallery in `site/assets/` (served by `site/index.html`).

## Current gallery

All captures are real Android renders from **Aniraku V5.8.10.2** (`app.config.ts` version), 1080 px wide, ~9:19.4.

| File         | Caption (as used in `index.html`) | Section shown                            | Status                                                          |
| ------------ | --------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `home.jpg`   | Home / Discover                   | Home tab — hero, Continue Watching, Trending | Live — also used by `README.md`                              |
| `catalog.jpg`| Search / Find it                  | **Search tab** (filters, top searches, trending grid) | Live — also used by `README.md`. Filename says catalog; caption must say Search |
| `watch.jpg`  | Schedule / Next 7 days            | **Schedule tab** (7-day episode list, air times, reminders) | Live. Filename says watch; caption must say Schedule       |
| `library.jpg`| Library / My list                 | Library → Saved — status chips, offline filter, sort | Live                                                  |
| `history.jpg`| History / Resume                  | Library → History — per-episode progress, resume, delete | Live                                                |
| `alerts.jpg` | Alerts / Episode feed             | Library → Alerts — unread feed, mark all read | Live                                                      |
| `profile.jpg`| Profile / Your space              | Profile — account, watch stats, top anime | Live                                                      |
| `avatar.jpg` | Profile / Avatars                 | Profile with the avatar picker expanded (preset grid) | Live, **not currently used** on the site. Wire it in only with an avatar-specific caption |
| `setting.jpg`| Settings / Control room           | Settings — session, avatar, app version, NSFW, notifications, sync | Live                                          |
| `random.jpg` | Random / Surprise me              | Random tab — single pick with genres and VIEW ANIME | Live                                               |

No mockups, no generated imagery, and no captures of removed screens (the old detail and fullscreen-player shots are gone; there is no trailer screen in V5.8.10.2).

## Caption rules

- Caption what the capture **is**, never what it resembles. `catalog.jpg` is the Search tab and `watch.jpg` is the Schedule tab — keep the captions that way.
- A signed-out screen is never captioned as signed-in, and vice versa. `library.jpg`, `history.jpg`, `alerts.jpg`, `profile.jpg`, `avatar.jpg` and `setting.jpg` were captured signed in with a real account and show that account's handle — never caption them as a guest view.
- The gallery must not claim to show a downloaded media file or a linked provider state until a real native capture of that state is verified.
- `README.md` screenshots (`home.jpg`, `catalog.jpg`) must stay in sync with the files the site serves — same asset, same screen.

## Adding a capture

1. Capture from a real device or a real Expo render of the implemented screen. No mockups, no generated imagery, no relabeling of another screen.
2. Save under `site/assets/` with a descriptive lowercase name (e.g. `downloads.jpg`).
3. Reference it in `site/index.html` with a truthful caption and explicit `width`/`height` attributes matching the file.
4. Record it in the table above with its status and the section it actually shows.
5. Re-check `site/DESIGN.md` content-integrity rules before publishing.
