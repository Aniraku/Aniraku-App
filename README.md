# Aniraku Native Android

<p align="center">
  <img src="./assets/images/icon.png" width="112" height="112" alt="Aniraku launcher icon" />
</p>

> **A native Android anime experience for discovery, verified-source playback coordination, and a synchronized personal library.**

Aniraku Native Android is built with **Expo and React Native**, not a browser wrapper. It uses native screens, Android-safe encrypted session storage, native media controls, safe areas, haptics, and a restrained **Nothing OS-inspired** visual system. The application reads discovery metadata from AniList, coordinates verified sources through the Aniraku API, and syncs approved account data with the existing Aniraku Supabase project.

| Area | Native implementation |
|---|---|
| Discovery | Home, catalog, full-text search, schedule, random selection, and AniList title detail. |
| Playback | Aniraku backend provider coordination, direct HLS/DASH/media routing, quality/source selection, manual and auto skip controls, auto-next, 10-second seek, and Android Picture-in-Picture. |
| Account | Email verification, encrypted Supabase sessions, recovery flow, account deletion, and user data cleanup. |
| Library | Watch history, resume rules, bookmarks, episode ratings, comments, notifications, and settings synchronization. |
| Android release | API 24 minimum, `armeabi-v7a` and `arm64-v8a` release ABIs, APK preview profile, and App Bundle production profile. |

## Local development

Use a current Node 22 environment and pnpm 9. Install dependencies, configure the required public runtime values, then start the native project.

```bash
pnpm install
pnpm check
pnpm test
pnpm android
```

The app requires these **public client** variables. Do not put service-role keys, database passwords, signing keys, or provider private credentials in the client build.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Aniraku API origin, normally `https://api.aniraku.tech`. |
| `EXPO_PUBLIC_ANILIST_GRAPHQL_URL` | AniList GraphQL endpoint. |
| `EXPO_PUBLIC_SUPABASE_URL` | Existing Aniraku Supabase project URL. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Existing Aniraku Supabase publishable/anonymous client key. |

## Release workflow

The app configuration uses the package identifier `tech.aniraku.app`, the deep-link scheme `aniraku://`, API 24 minimum support, and Android 32/64-bit ARM release architectures. The preview profile produces an installable APK; production emits an Android App Bundle.

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

Signing is intentionally managed through the release service or a controlled local keystore process. Private signing keys must never be committed to this repository. The CI workflow validates TypeScript, automated tests, and the public Expo configuration on each pull request and main-branch update.

## Playback boundary

The Aniraku backend is the authority for provider discovery and stream verification. The native client requests verified servers and then plays **direct** sources that its native media stack supports. It does not scrape providers, manufacture unverified stream URLs, embed unsupported third-party pages, or include dead provider entries as playable choices.

## Project documentation

| Document | Scope |
|---|---|
| [Architecture](./docs/NATIVE_ARCHITECTURE.md) | Service boundaries, domain model, session security, and playback responsibilities. |
| [Privacy](./PRIVACY.md) | Data categories, retention, deletion behavior, and user controls. |
| [Terms](./TERMS.md) | Acceptable use, source responsibilities, and service limitations. |
| [DMCA](./DMCA.md) | Copyright notice procedure and repeat-infringer policy. |
| [Security](./SECURITY.md) | Reporting route and client security expectations. |
| [Contributing](./CONTRIBUTING.md) | Development and pull-request expectations. |
| [Changelog](./CHANGELOG.md) | Release notes. |

## License

This repository is made available under the [MIT License](./LICENSE). Anime metadata, artwork, streams, trademarks, and other third-party materials remain subject to their respective rights holders and provider terms.
