# v3.0 Watch Upgrade Evidence

## Provider parity

The authoritative website commits the complete `/api/v1/servers` language array directly to its provider picker. Native v2.6 reintroduced a client-only `usableSub` / `usableDub` filter in `app/watch/[id].tsx`: it removes a server when its initial response has no source that native classifies as direct or verified embed. This conflicts with the website policy and can hide a provider whose usable stream is resolved only by `/api/v1/stream`.

Live One Piece evidence on 2026-08-16 confirms the backend exposes `ally` and `pewe` for episode 1 SUB, and `pewe` plus `ally` for DUB. Native must keep these server entries visible and let the existing direct → proxy → verified embed lifecycle determine playability after selection.

## AniSkip

The direct AniSkip request for MAL ID 21 / episode 1 returns HTTP 200 with both opening and ending intervals. Therefore the upstream service and parser format are valid. Native always performs an auxiliary AniList MAL-ID lookup but does not model backend metadata aliases such as `idMal`, `malId`, `mal_id`, or `myAnimeListId`. v3.0 will use a valid backend ID first, retain AniList only as a background fallback, add a bounded AniSkip request timeout, and continue treating no-result responses as a normal non-playback state.

## Heavy titles and episode information

The One Piece backend episode list currently contains 1,173 rows. Native currently loads the full canonical list and shows only its first 50 filtered entries; it lacks the website’s page/range/jump navigation and a selected-episode information route. v3.0 will retain canonical completeness but render a page-sized slice, expose direct range/page/jump navigation, and add a lightweight route for the selected episode’s title, thumbnail, description, filler state, adjacent navigation, and Watch action.
