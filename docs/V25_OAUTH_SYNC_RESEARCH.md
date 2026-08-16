# v2.5 OAuth and Sync Research

## Official provider contracts

AniList documents OAuth 2.0 authorization-code and implicit flows. Native clients must not embed a client secret; its authorization-code flow requires a server-side token exchange, exactly matching the registered redirect URI. AniList access tokens are long-lived for one year and the provider does not support refresh tokens.

> Source: [AniList authentication guide](https://docs.anilist.co/guide/auth/) and [AniList authorization-code guide](https://docs.anilist.co/guide/auth/authorization-code).

MyAnimeList documents an OAuth 2.0 authorization-code flow with PKCE. Each authorization request needs a unique verifier, state validation, and a matching redirect URI. Its access tokens expire after one hour and refresh tokens expire after one month; token exchange and refresh require client authentication on the server.

> Source: [MyAnimeList authorization guide](https://myanimelist.net/apiconfig/references/authorization) and [MyAnimeList API v2 reference](https://myanimelist.net/apiconfig/references/api/v2).

## Existing Aniraku website model

The website already defines the app-wide provider sync protocol in `src/lib/sync.js`: authenticated `GET /api/v1/sync` retrieves status; authenticated `GET /api/v1/sync/{provider}/authorize` returns a browser authorization URL; the website posts the returned `code` and `state` to `POST /api/v1/sync/callback`; `DELETE /api/v1/sync/{provider}` disconnects; and `POST /api/v1/sync/update` pushes anime, episode, progress, and status. It pushes only when meaningful playback occurred, and only to providers that the authenticated status reports as connected and configured.

The website displays real Simple Icons glyphs for AniList and MyAnimeList as restrained provider icons. The native app should preserve this behavior, bundle those SVG marks locally, and keep the overall visual treatment in its monochrome Nothing OS language.

The deployed API returns HTTP 401 for unauthenticated `GET /api/v1/sync`, confirming provider linking is protected by the user’s Aniraku/Supabase session.
