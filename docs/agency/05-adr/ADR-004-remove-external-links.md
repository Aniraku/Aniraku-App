# ADR-004 — External download links removed entirely

**Status:** Accepted (user-confirmed)
**Context:** Backend `downloads[]` entries are provider file-host *pages*, opened via browser after a "You're leaving Aniraku" alert (app/watch/[id].tsx:1942–1975). In-app scraping of those hosts is ToS-fragile and captcha-bound.
**Options:** (a) keep as fallback for sources without direct files; (b) remove entirely.
**Decision:** (b). Downloads work in-app or not at all; providers without direct sources show a disabled download affordance with a reason.
**Consequences:** File-host-page-only providers become un-downloadable (accepted by user). Removes the last external-link exposure and simplifies the watch screen; `openBackendDownload` and its alert die with this ADR.
