# Skip Intro/Outro Research & Implementation Plan

## Data Source: AniSkip API (v2)
- **Endpoint:** `https://api.aniskip.com/v2/skip-times/{animeId}/{episodeNumber}`
- **Parameters:**
  - `types[]`: `op` (opening), `ed` (ending), `mixed_op`, `mixed_ed`, `recap`.
  - `episodeLength`: Duration of the episode in seconds (helps AniSkip find the right match).
- **Identifier:** Supports MAL IDs. AniList IDs can be mapped to MAL IDs via AniList's `idMal` field.

## Implementation Strategy
1. **Metadata Enhancement:**
   - Ensure AniList query retrieves `idMal`.
   - Fetch skip times from AniSkip when a stream starts or when metadata is available.
2. **Artplayer Integration:**
   - Use Artplayer's `video:timeupdate` event to monitor current playback time.
   - Show "Skip Intro" or "Skip Outro" buttons when `currentTime` is within the skip interval.
   - Automatically skip if a user setting (to be added) is enabled.
3. **User Interface:**
   - Aesthetic, minimal buttons that appear near the bottom-right of the player.
   - Smooth transitions for button appearance/disappearance.

## Technical Details
- **API Request:** `https://api.aniskip.com/v2/skip-times/${idMal}/${epNumber}?types[]=op&types[]=ed&types[]=mixed_op&types[]=mixed_ed&types[]=recap&episodeLength=${duration}`
- **Interval Check:** `currentTime >= interval.startTime && currentTime <= interval.endTime`
- **Action:** `art.video.currentTime = interval.endTime`

## Complementary Source: IntroDB
The official IntroDB documentation confirms a free, read-only API at `https://api.introdb.app` with no API key required for reads. The primary endpoint is `GET /segments?imdb_id=...&season=...&episode=...`; it returns intro, recap, and outro segments keyed by IMDb series ID. This is useful for broader TV coverage, but AniList metadata in the current app does not yet include IMDb IDs, so it is a secondary source unless the app adds an IMDb mapping. AniSkip remains the anime-first source because it accepts MAL IDs directly.

## Coverage Constraint
No public database can guarantee timestamps for literally every title and episode. The implementation must use a prioritized chain: provider-supplied timestamps first when valid, AniSkip by MAL ID second, IntroDB when an IMDb mapping is available, and no skip button when no verified interval exists. It must never invent a timestamp because an incorrect automatic jump is worse than a missing button.

## Verified AniSkip Response
A live request for MAL ID 21, episode 1 returned `found: true` with `results[]` entries containing `skipType`, `interval.startTime`, `interval.endTime`, and `episodeLength`. Opening and ending types are represented as `op` and `ed`.

## Implementation Decision
Replace the current Miruro-only skip state with a normalized, source-tagged interval model, fetch AniSkip after the episode duration is known or from cached provider metadata, normalize provider field variants, attach a guarded `video:timeupdate` listener to Artplayer, support manual and opt-in automatic skipping, and cache successful lookup results per MAL ID and episode. A missing result is a valid state and should leave the player unchanged.

Sources: [AniSkip API docs](https://api.aniskip.com/api-docs), [IntroDB API docs](https://introdb.app/docs/api), [IntroDB OpenAPI](https://api.introdb.app). 

Note: do not add a client-side CORS proxy without verifying the production backend. Direct AniSkip reads are tested from the sandbox, but browser CORS behavior must be validated in the local preview and, if blocked, routed through an existing server endpoint.

## Local Browser Check
The new local preview exposes the `Auto-skip ON` control on the Watch page. The chosen title's backend was still warming up and showed `Episodes (0)` at the first viewport snapshot, so the player was not yet ready for an end-to-end playback jump test. This is a backend/data-loading state, not evidence that AniSkip returned a segment; the next check must inspect browser console/network state after the page settles.

## Browser Validation Finding
A direct browser request returned HTTP 400 when the query included `mixed_op` and `mixed_ed`. The current AniSkip endpoint accepts the standard `op` and `ed` types verified by the earlier curl test, so the client request must not include unsupported mixed variants. This is a real integration bug to fix before release.

## Release Verification
The browser-origin request to AniSkip using only `types[]=op`, `types[]=ed`, and `episodeLength=0` returned HTTP 200 with real `op` and `ed` intervals. The production build completed successfully, and the player-menu update is released in commit `ab2a783` on `origin/main`.
