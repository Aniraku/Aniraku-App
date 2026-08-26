![Aniraku documentation signal](./assets/readme/documentation-signal.svg)

`ANIRAKU / RELEASE SIGNAL`

# Changelog

This is the public record of meaningful native Android releases. This `Beta` branch documents the [v4.7.Beta prerelease](https://github.com/Aniraku/Aniraku-App/releases/tag/v4.7.Beta); the public stable build remains separate.

## v4.7.Beta — MAL preview and release-aware scheduling

`PRE-RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Retains MAL-first discovery, search, and title metadata for the Beta validation branch, with verified AniList-ID mapping before existing detail, Watch, AniSkip, provider, and playback routes run.
- Routes only the visible Schedule and Next Airing surfaces through the existing `GET /api/v1/schedule` Aniraku API contract; schedule MAL IDs are mapped before the established routes consume them.
- Keeps future-release protection before provider or stream discovery for confirmed future episodes and not-yet-released movies.
- Does not replace the v4.6 stable APK or change production website behavior.

## v4.2 — Rebuffer continuity

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Fixes the periodic Watch-history refresh that could be treated as a new initial resume request after playback had already started.
- Prevents rebuffer recovery from explicitly seeking backward to an older synchronized position, preserving the active forward buffer and avoiding the associated repeated decoded frame.
- Applies persisted history only once during fresh source startup and uses Android's efficient single-player surface.
- Retains the 120-second time-priority reserve, 20-second recovery cushion, automatic byte allocator, adaptive persistent cache, provider parity, source recovery, Downloads eligibility, fullscreen, AniSkip, and Relations.

## v4.1.2 — Playback continuity

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Extends the native Media3 time-priority reserve to 120 seconds and raises the recovery cushion to 20 seconds before playback resumes after buffering.
- Retains automatic byte allocation rather than forcing a small application-level byte ceiling.
- Sizes Android persistent video caching from 256 MiB to 4 GiB based on available device storage while retaining 2 GiB free for Android.
- Preserves the no-corrective-seek rebuffer path, provider parity, source recovery, Downloads eligibility, fullscreen, AniSkip, and Relations.

## v2.0.Alpha — New package identity

`CURRENT / STANDARD RELEASE / ANDROID 9+ / ARM32 + ARM64`

- Migrates the Android application identity from `aniraku.anine.app` to `aniraku.anime.app`.
- Requires removal of the legacy alpha before installation; Android treats the new package as a separate app.
- Carries forward native playback continuity correction, direct quality selection, bounded forward preload, faster source startup, and the compact Nothing OS-inspired player surface.
- Publishes the universal release APK through GitHub and the public Orion Store path.

## v1.8.Alpha — Playback control and preload

- Added direct in-player quality selection for provider-supplied variants such as 1080p, 720p, and 480p.
- Increased bounded forward media preload to 45 seconds without deliberately delaying initial playback.

## v1.7.Alpha — Rebuffer continuity

- Added native rebuffer-resume correction to prevent an eligible buffering recovery from visibly replaying a prior frame.

## v1.0.Alpha — Native foundation

- Replaced the prior wrapper approach with a native Android application built with Expo and React Native.
- Shipped discovery, account synchronization, native playback coordination, library functions, and direct-distribution release tooling.

---

`SIGNAL / CURRENT BUILD FIRST`

[README](./README.md) · [v4.7.Beta prerelease](https://github.com/Aniraku/Aniraku-App/releases/tag/v4.7.Beta) · [Security](./SECURITY.md) · [Contributing](./CONTRIBUTING.md)
