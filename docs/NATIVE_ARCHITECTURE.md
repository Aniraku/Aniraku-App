# Native Architecture — Aniraku Android

## Product boundary

This project is a genuine Expo/React Native Android application. It renders native screens, uses Android secure storage, native safe areas, native navigation, haptics, native image caching, and native media controls. It does not load `aniraku.tech` in a WebView and it does not rely on a browser shell.

## Service architecture

| Layer | Production responsibility |
|---|---|
| Expo Router UI | Native screens, Android navigation, accessibility labels, safe-area handling, Nothing OS design primitives, error boundaries, and action feedback. |
| AniList GraphQL client | Public discovery, search, seasonal views, schedules, title detail, relations, cover images, and external metadata. |
| Aniraku API client | Health checks, episode availability, verified server discovery, signed stream source requests, and backend-established source failover. |
| Supabase client | Email/password authentication, verified-session checks, password recovery, user profiles, bookmarks, watch history, episode ratings, comments, notifications, and real-time compatible data synchronization. |
| SecureStore | Encrypted native storage for the Supabase session; no passwords or service-role credentials are persisted locally. |
| AsyncStorage | Non-sensitive preferences such as playback choices, reduced motion, search history, cached utility state, and UI settings. |

## Security model

The native client includes only public, client-safe configuration: the Aniraku API origin, AniList GraphQL origin, Supabase project URL, and Supabase anonymous key. Supabase Row Level Security remains the authorization boundary for user data. The app does not ship a Supabase service-role key, database password, backend private credential, or Android signing material.

Supabase sessions use a SecureStore adapter on Android. The app validates the current session on launch, requires email confirmation for protected account features, clears invalid or recovery-only sessions outside the recovery flow, and treats all server responses as untrusted data until normalized.

## Domain model

| Model | Native fields used | Source |
|---|---|---|
| Anime | AniList ID, title, images, description, genres, format, status, popularity, score, episode count, next airing | AniList GraphQL |
| Episode | position, title, thumbnail, airing context, watched progress, user rating, source availability | Aniraku API plus Supabase user data |
| Playback source | provider, language, quality, type, verified URL, subtitles, skip intervals, headers, source health | Aniraku API |
| Watch history | user, anime, episode, position, duration, completion state, updated time | Supabase |
| Bookmark | user, anime, title, image, format, saved time | Supabase |
| Episode rating | user, anime, episode, score, updated time | Supabase |
| Comment | user, anime, body, created time, public profile fields | Supabase |
| Notification | user, title/body, type, deep-link payload, read time | Supabase |

## Native navigation

The lower native navigation contains **Home**, **Catalog**, **Schedule**, **Random**, and **Profile**. Search is a dedicated stack route instead of a tab. Anime detail and Watch are stack routes. Authentication and account recovery are presented as native modal/stack flows. Android system back first dismisses sheets and search, then returns through the route stack, and only exits from the root destinations.

## Playback responsibility

The Aniraku backend remains the authority for server discovery and source verification. Native playback requests `/api/v1/servers` and `/api/v1/stream`; the app does not scrape providers. The native player selects supported `hls`, `dash`, `mp4`, `webm`, `ogg`, `mpeg`, and native sources from backend output, ignores entries marked dead or with expired embedded tokens, stores only short-lived non-sensitive source metadata in memory, and persists watch progress through Supabase.

## Test strategy

Pure functions and service clients are covered through Vitest. Component state is tested with deterministic fixtures and mocked fetch/Supabase responses. Integration smoke tests validate the public production API health, Supabase public client configuration, AniList schema responses, navigation-critical paths, and signed Android package metadata. Physical-device verification remains required for final codec, network, PiP, biometric, and OEM WebView/device behavior.
