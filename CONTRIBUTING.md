`ANIRAKU / BUILD WITH INTENT`

# Contributing

Contributions should make the native product more trustworthy, not merely more complicated. Preserve the native-first boundary, the calm editorial interface, real service contracts, and explicit recovery states.

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 20 (matches CI) |
| pnpm | 9.12.0 (see `packageManager` in `package.json`) |
| Java | 17 (native Android builds only) |
| Device | Android 9+ device or emulator, or Expo Go for UI-only work |

## Quick start

```bash
git clone https://github.com/Aniraku/Aniraku-App.git
cd Aniraku-App
pnpm install --frozen-lockfile
```

Copy the public client configuration into `.env` (never commit this file):

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ANILIST_CLIENT_ID=
EXPO_PUBLIC_ANILIST_GRAPHQL_URL=
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_MAL_CLIENT_ID=
```

Run the app:

```bash
pnpm dev          # server + Metro together
pnpm android      # native Android build (needs prebuild)
pnpm ios          # iOS (macOS only)
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Concurrent backend server + Metro (`dev:server` + `dev:metro`) |
| `pnpm check` | Type-check (`tsc --noEmit`) — must pass before every PR |
| `pnpm lint` | Expo lint — must pass before every PR |
| `pnpm format` | Prettier write across the repo — run before committing |
| `pnpm test` | Vitest suite in `tests/` — must pass before every PR |
| `pnpm build` / `pnpm start` | Bundle and run the backend server (`dist/`) |
| `pnpm db:push` | Generate + run Drizzle migrations |
| `pnpm qr` | Generate a QR for device preview |

Verify config changes with:

```bash
npx expo config --type public --json
```

## Branching

`main` is the release line. Never push directly — open a pull request from a short-lived branch:

| Prefix | Use for |
| --- | --- |
| `feat/` | New behavior (e.g. `feat/sleep-timer`) |
| `fix/` | Bug corrections (e.g. `fix/vtt-spaced-arrow`) |
| `docs/` | Markdown-only changes (e.g. `docs/contributing-refresh`) |
| `chore/` | Tooling, CI, deps (e.g. `chore/bump-expo-54`) |
| `site/` | Marketing site under `site/` (e.g. `site/release-archive`) |

Keep branches rebased on `main` (`git pull --rebase`) so history stays linear.

## Commit convention

Use [Conventional Commits](https://www.conventionalcommits.org/) — `type: short imperative summary`:

```bash
feat: add sleep-timer preset row to Watch console
fix: trim VTT cue timestamps before splitting on arrow
docs: refresh CONTRIBUTING with governance and release flow
chore: remove EAS dependency from build workflow
test: cover proxy-of-proxy URL guard in aniraku-api
site: add Binance Pay support block to landing
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `site`, `revert`. One logical change per commit. Release commits (`v5.4.1 — ...`) are cut by maintainers only.

## Before you open a pull request

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm test
pnpm format
npx expo config --type public --json
```

| `KEEP` | `DO NOT ADD` |
| --- | --- |
| Native React Native views, accessible labels, real state handling, concise copy, documented migration notes, and deterministic tests where behavior can regress. | WebView wrappers for the app, provider scraping, private credential handling, placeholder content, fake availability states, unverified media fallbacks, or generated product screenshots. |

## A useful pull request

- Name the user problem first, then the native behavior you changed.
- List the checks you ran (`check` / `lint` / `test`, plus device or Expo Go verification).
- Call out any impact on authentication, playback, data contracts, Android package configuration (`app.config.ts`, `android/` via prebuild), or account deletion.
- Keep visual changes aligned with [`design.md`](./design.md): one focal action per screen, restrained signal red (`#FF4D4D`), real artwork, no repeated decorative cards, 48 dp touch targets.
- Keep the PR small enough to review in one pass. Split unrelated changes.
- Link the issue it closes (`Closes #123`).

Do not commit `.env` files, Android keystores (`*.jks`, `*.key`, `*.p12`), access tokens, signing material, `EXPO_PUBLIC_*` secrets you were given privately, personal screenshots, or durable provider URLs.

## Code review rules

Every PR needs one maintainer approval before merge. Reviewers check, in order:

1. **Correctness** — does it fix the stated problem without regressing `tests/` coverage? New behavior that can regress needs a Vitest case.
2. **Native boundary** — no WebView wrappers, no scraping, no private credential handling, no fake states.
3. **Design bar** — matches [`design.md`](./design.md): first focal point readable in one second, sections distinguishable without reading labels, one decisive action per view.
4. **Contracts** — tRPC / Supabase / AniList shapes unchanged, or migration notes included (`drizzle/`, `shared/`, `server/`).
5. **Hygiene** — `check` + `lint` + `test` green, Prettier applied, no secrets, no `console.log` leftovers in shipped code.

Be direct and specific in review comments. Suggest the fix, not just the flaw. The author owns the rebase; the reviewer owns the bar.

## Issues

Search existing issues before filing. A good report has: app version (e.g. `v5.4.1`), APK arch (`arm64` / `arm32` / `universal`), Android version + device, steps to reproduce, expected vs. actual, and logs or a screen recording where relevant.

| Label | Meaning |
| --- | --- |
| `bug` | Broken behavior on a supported release |
| `enhancement` | New feature or improvement request |
| `playback` | Watch player, sources, subtitles, buffering |
| `auth` | Login, session, account deletion |
| `ui` | Visual / editorial / accessibility issue |
| `docs` | README, guides, site copy |
| `good first issue` | Small, well-scoped, safe for first-time contributors |
| `needs repro` | Waiting on reproduction steps or logs |
| `security` | Handled privately — see [SECURITY.md](./SECURITY.md), do not post exploits |

Found a vulnerability? Do **not** open a public issue. Email `sho.islam0311@proton.me` per [SECURITY.md](./SECURITY.md).

## Release process (maintainers)

Releases ship from tags via [`.github/workflows/build.yml`](.github/workflows/build.yml). Contributors do not need to cut releases, but should know the contract:

1. Bump `version` and `versionCode` in [`app.config.ts`](./app.config.ts) (current: `5.4.2` / `53`).
2. Add a `CHANGELOG.md` entry describing the user-facing change and root cause.
3. Update `README.md` download table and version links.
4. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. CI verifies the tag matches `app.config.ts`, builds `arm64` + `arm32` + `universal` APKs with local Gradle (`newArchEnabled=false`), and publishes the GitHub Release with all three attached.

Never hand-edit `android/` — it is generated by `npx expo prebuild --platform android --clean` in CI.

---

`SIGNAL / CLEAR`

[README](./README.md) · [Design](./design.md) · [Security](./SECURITY.md) · [Support](./SUPPORT.md) · [MIT License](./LICENSE)
