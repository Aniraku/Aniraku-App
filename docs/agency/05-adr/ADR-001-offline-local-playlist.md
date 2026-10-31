# ADR-001 — Offline deliverable: local playlist + segments (no MKV)

**Status:** Accepted (user-confirmed)
**Context:** User asked for "segments in mkv" downloads. Real MKV requires on-device remux; ffmpeg-kit is retired upstream (binaries removed 2025) — forks only, heavy native code, +30MB/ABI, permanent maintenance.
**Options:** (a) ffmpeg-kit remux → MKV files; (b) offline HLS bundle (playlist + segments + keys) played in-app; (c) server-side remux.
**Decision:** (b). Download pinned-variant playlist + segments (+ AES-128 key) app-privately; play via rewritten local `file://` playlist in react-native-video.
**Consequences:** No shareable files (aligned with legal posture + app-private decision). Same UX as market apps. If MKV export is ever wanted, it layers on top as a separate ADR.
