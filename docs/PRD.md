# Aniraku — Product Requirements Document (PRD)

## 1. Product Overview

Aniraku is a free anime streaming web app: browse anime, view details, watch episodes with HLS, and manage a personal account (favorites, watch history, notifications, comments). It aggregates catalog data from AniList and episode streams from Miruro.

**Live deployments:**
- Frontend: Vercel (production from `main` branch)
- Backend: Azure VM (`https://api.aniraku.tech`)
- Database/Auth: Supabase (Postgres + GoTrue)

## 2. Goals

| Goal | Priority |
|---|---|
| Fast first paint (eager-loaded Home, skeleton loaders) | High |
| Reliable filtering: hentai titles appear **only when playable streams exist** | High |
| Per-account NSFW toggle (not device-local) | High |
| Cross-device sync of watch history, bookmarks, settings, notifications | High |
| Comments on anime detail + per-episode | Medium |
| Professional-grade docs & hardened backend (SSRF, JWT, rate limiting) | Medium |

## 3. Non-Goals (v1)

- No user-generated uploads; streams are proxied from Miruro only.
- No payment, subscriptions, or ad network.
- No PWA offline playback.

## 4. Personas

- **Viewer** — browses, searches, watches. Wants curated, non-broken content.
- **Returning user** — logs in for sync + comments.

## 5. Functional Requirements

### FR-1 Catalog browsing
- Home rails (Trending/Airing/Movies/TV), Discover filters (genre, year, season, status, sort), search with MAL→AniList ID resolution.
- Detail pages show synopsis, genres, stats, similar titles, relations.

### FR-2 NSFW handling (lock for prod)
- `isNsfw(item) = genres contains "hentai"` (case-insensitive). AniList `isAdult` alone is **not** used for blocking — it flags 18+ non-hentai titles.
- NSFW is a **per-account** preference stored in `user_settings` (`nsfw_enabled`). Signed-out users default to off.
- Hentai titles pass filtering **only if** `useStreamable` confirms playable Miruro streams (sub or dub non-empty).

### FR-3 Streaming
- Episode list per anime with sub/dub; HLS playback via Artplayer+Hls.js; 15s AbortController timeout; error + retry states.

### FR-4 Accounts & sync (Supabase)
- Auth: email/password, password reset, delete account (RPC `delete_my_account`).
- Tables: `profiles`, `user_settings`, `watch_history`, `bookmarks`, `notifications`, `comments`, `comment_likes`, `review_comments`.
- RLS: users read/write own rows; profiles public read; comments public read, own write; likes via RPC `toggle_comment_like`.
- Sync requirements: all client writes use `upsert` with **unique constraints present** (see Implementation Plan §3).

### FR-5 Comments
- Per-anime and per-episode comment threads (via `parent_id`), like/unlike, delete own, author info from `profiles`.

### FR-6 Settings & profile
- Route: `/profile/settings` (moved from `/settings`). NSFW toggle, avatar/profile, sign out, delete account with typed `DELETE` confirmation.

## 6. Quality Bar (definition of done)

1. `npm run build` (vite) passes; no console errors on load in Chrome/Firefox/Safari.
2. Hentai row verified: appears only when streams exist (checked against `/api/v1/miruro/episodes/{id}`).
3. Toggling NSFW in Settings reflects immediately across devices after login.
4. Watch progress resumes from another device (same account).
5. Comments render at bottom of AnimeDetail and Watch, like/unlike works.
6. Backend: unit tests pass, health check green, rate limiting + JWT validation enabled.

## 7. Out of Scope / Backlog

- Watchlist sharing/rooms, mobile apps, subtitles upload, download episodes, recommendations engine.
