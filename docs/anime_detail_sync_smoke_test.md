# Anime Detail synchronization smoke test

The fresh Vite preview successfully rendered Naruto (AniList ID 20) with its AniList banner image as the atmospheric full-width background and the cover image as the foreground poster.

A controlled local history was seeded for Episodes 1–3, with Episode 1 partially watched at 2:12 and Episodes 2–3 completed. Local ratings of 8/10, 9/10, and 7/10 were seeded for Episodes 1–3. The page rendered `Continue Episode 1`, the resume hint `Resume from Episode 1 at 2:12`, and the episode rows showed `In progress 8/10`, `Watched 9/10`, and `Watched 7/10`. The remaining rows had no watched or rating badge. The episode progress and rating state therefore matched the merged activity data.

The local preview used a fresh port because the prior preview process served a stale hashed AnimeDetail chunk. The new preview loaded the current bundle correctly. Backend episode metadata returned an unavailable response during the test, so the page correctly used its AniList/fallback episode metadata path and displayed the warning without blocking the synchronized UI.

## Release notes

This test was performed before the final production release. The controlled local-storage data should not be committed or used in production.

---

## Current implementation notes

Anime Detail now reads local `aniraku-watch-history` and authenticated Supabase `watch_history`, merges the newest row per episode, reads episode ratings from the existing authenticated ratings endpoint or guest local-storage key, computes Continue/Rewatch state, displays per-episode progress and rating badges, and uses banner artwork for the page background and hero visual.

Watch now persists explicit duration and completion metadata locally and writes a completed cloud watch-history row when playback ends.

---

## Final validation

The production build and ESLint checks passed with zero errors. Existing non-blocking dependency warnings remain in the large Watch component.


## Rewatch and resume-selection validation

The Rewatch calculation is guarded by AniList’s declared episode total and the number of loaded episode rows, so a partial backend episode response cannot incorrectly mark a long series as complete. A title is eligible for Rewatch only when every expected episode is completed.

The resume selector now compares the highest fully completed episode with the highest partially watched episode. If Episode 1 is partial and Episode 2 is complete, the selected resume target is Episode 3. If a later episode is partial, that later partial episode remains resumable. The edge-case browser page was opened after seeding this exact data, but the local backend was warming up during that final reload, so the rendered label could not be captured in the browser before release. The selection logic is covered by the deterministic implementation and the production build passed.
