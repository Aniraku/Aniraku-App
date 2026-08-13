# Changelog

All notable changes to Aniraku for Android are documented in this file.

## 1.0.0 — August 13, 2026

The first Android release packages the maintained Aniraku frontend through Capacitor 8 and targets Android 7.0 (API 24) through Android API 36.

| Area | Included in 1.0.0 |
|---|---|
| Shared Aniraku experience | Authentication, verified sessions, password recovery, profile, history, ratings, bookmarks, comments, notifications, catalog, schedule, anime detail, random discovery, legal routes, and settings |
| Playback | Provider selection, SUB/DUB context, quality choices, HLS, DASH, native stream routing, verified embeds, source filtering, source failover, intro/outro behavior, and progress synchronization |
| Android integration | Native system-back behavior, offline state feedback, status bar, splash, keyboard resize, deep links, secure local assets, and an adaptive launcher icon |
| Android interface | Nothing OS-inspired monochrome token layer, dot-grid texture, Material 3-sized touch targets, rounded compact navigation, safe-area handling, and touch feedback |
| Release quality | API 36 target, API 24 minimum, signed release configuration, ignored signing material, asset generation script, Android build notes, release documentation, and validation workflow |

The release does not request contacts, storage, location, microphone, camera, or notification permissions. Playback availability remains dependent on the underlying provider and device codec support.
