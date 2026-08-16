# v3.0 Snapdragon 680 Watch Acceptance

Install `Aniraku-v3.0.apk` over the v2.6 package. Confirm Android reports package `aniraku.anime.app` and version 3.0. Use a reliable Wi-Fi or cellular connection, then record a short screen capture for any failed step.

| Check | Device action | Expected result |
|---|---|---|
| Provider parity | Open the same anime, episode, and audio language in aniraku.tech and in v3.0. Open the headphones control in native. | Every provider returned by the backend is visible in native; a provider may fail playback, but it must not be silently omitted before selection. |
| AniSkip | Play an episode known to have opening and ending markers, such as One Piece episode 1. | The player exposes `SKIP INTRO` and `SKIP OUTRO` when their intervals begin. With Auto Skip enabled, it advances once per interval without blocking provider playback. |
| Heavy title | Open One Piece, open **EPISODES**, then search, jump to episode `1173`, and move between pages. | The Watch page stays responsive. The list shows the selected 50-episode page rather than a truncated first page; search, direct jump, Previous, and Next reach the complete catalog. |
| Episode information | Tap **EP INFO** for the current episode. Long-press another episode entry. | The episode-information route shows the available title, image, description, filler flag, adjacent controls, all-episodes action, and a Watch action. |
| Playback continuity | Allow a weak-network rebuffer during an active episode. | Playback resumes without a forced corrective seek or visible replay of a prior frame. |

When reporting an issue, include the anime ID or title, episode number, SUB/DUB selection, provider label, Android version, network type, exact time of failure, and a screen recording if possible. Do not include account credentials or OAuth tokens.
