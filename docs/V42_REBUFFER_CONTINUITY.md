# v4.2 rebuffer continuity correction

## What changed

v4.2 fixes an application-level resume-path issue. Watch history is synchronized periodically while playback is active. A history refresh could previously be mistaken for a new startup resume request; when Media3 reported `readyToPlay` after a rebuffer, the app could seek backward to that older saved timestamp.

That explicit seek discarded the current forward buffer, could re-present a decoded frame, and triggered unnecessary additional buffering. The player now permits a saved-history resume only once for a fresh source near time zero. Subsequent history refreshes and rebuffer recovery events cannot mutate the native playhead.

## Retained policy

The 120-second time-priority reserve, 20-second rebuffer recovery cushion, automatic Media3 byte allocation, and storage-aware Android persistent cache remain unchanged. v4.2 uses the efficient Android `surfaceView` for the single native player surface.

## Acceptance boundary

The implementation is covered by deterministic TypeScript regression tests. Real-device validation remains important because provider delivery and device decoder behavior vary by stream.
