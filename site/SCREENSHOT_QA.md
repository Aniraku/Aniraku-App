# Screenshot QA

Living checklist for the public capture gallery in `site/assets/screens/` (served by `site/index.html`).

## Current gallery

| File                         | Caption                    | Status                                                  |
| ---------------------------- | -------------------------- | ------------------------------------------------------- |
| `home.jpg`                   | Home / continue + discover | Live — genuine Home render, also used by `README.md`    |
| `catalog.jpg`                | Catalog / poster gallery   | Live — genuine Catalog render, also used by `README.md` |
| `watch.jpg`                  | Watch / media plane        | Live                                                    |
| `watch-player.jpg`           | Watch / player console     | Live                                                    |
| `random.jpg`                 | Random / one-pick sleeve   | Live                                                    |
| `details-v411-relations.jpg` | Anime detail / relations   | Live                                                    |

Additional committed captures (`alerts-preview.png`, `catalog-explore.jpg`, `home-feature.jpg`, `profile.jpg`, `profile-space.jpg`, `random-pick.jpg`, `schedule.jpg`) are verified real renders kept in reserve. Wire one into `index.html` only with a truthful caption, then move it to the table above.

## Caption rules

- Caption what the capture **is**, never what it resembles: a guest Alerts preview is captioned **Alerts / guest preview**, never as an authenticated notification feed.
- A signed-out screen is never captioned as signed-in, and vice versa.
- The gallery must not claim to show a downloaded media file or a linked provider state until a real native capture of that state is verified.
- `README.md` screenshots (`home.jpg`, `catalog.jpg`) must stay in sync with the files the site serves — same asset, same screen.

## Adding a capture

1. Capture from a real device or a real Expo render of the implemented screen. No mockups, no generated imagery, no relabeling of another screen.
2. Save under `site/assets/screens/` with a descriptive lowercase name (e.g. `schedule.jpg`).
3. Reference it in `site/index.html` with a truthful caption.
4. Record it in the table above with its status.
5. Re-check `site/DESIGN.md` content-integrity rules before publishing.
