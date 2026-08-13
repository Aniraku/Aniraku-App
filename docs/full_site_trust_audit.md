# Full-site trust and usability audit

## Scope

The route map exposes Home, Catalog, Schedule, Watch, Anime Detail, Auth, Profile, Settings, Random, Sync Callback, Admin, and dedicated DMCA, Privacy, License, and Terms pages. Shared trust surfaces include the desktop and mobile Footer, NavBar, MobileBottomNav, global ErrorBoundary, loading skeletons, and route-specific error states.

## Findings

| Surface | Current strength | Priority gap |
| --- | --- | --- |
| Home | Editorial spotlight, live episode ledger, direct watch/detail actions, and purpose-led discovery paths are now present. | Needs a visible trust strip explaining metadata, stream resolution, account sync, and support/report paths without overwhelming the landing experience. |
| Catalog | Search, filters, loading/error states, full-card links, and responsive browsing are present. | Needs clearer content provenance, stable empty-state language, and a visible report/feedback escape route. |
| Schedule | Date-aware weekly tabs, next-release cue, local times, relative countdowns, search, and retry state are present. | Needs a clearer stale-data explanation, a refresh affordance, and a stronger “what the time means” explanation on mobile. |
| Anime Detail | Uses AniList metadata and synced watch history/ratings. | Needs an obvious report-metadata/source issue path and concise explanation of what is controlled by Aniraku versus third-party providers. |
| Watch | Has player settings, provider failover, progress persistence, and skip controls. | Needs stronger provider/source labeling, a non-destructive report playback button, and a clearer message when a source fails. |
| Comments/Community | Comments, replies, likes, and a working frontend GIF fallback are implemented. | Needs visible community rules, report/delete expectations, abuse/spam guidance, and clearer media reaction limitations. |
| Profile | Includes history, bookmarks, ratings, and external library sync. | Needs clearer sync privacy language, export/delete discoverability, and consistent non-emoji status messaging. |
| Settings | Includes NSFW, password, account deletion, sign-out, and sync controls. | Needs a trust-oriented data controls section that links to Privacy, export/delete behavior, and account retention expectations. |
| Auth | Login, signup, username checks, and password reset exist. | Needs concise data-use and age expectations near account creation plus clearer recovery/error copy. |
| Random | Has loading, empty, error, and retry states. | Needs a route back to Catalog and a short explanation of selection/source behavior. |
| Footer | Desktop shows an ownership disclaimer and social links; resourceLinks is declared but not rendered. | Mobile omits Privacy; both layouts lack a visible report/support link and provenance summary. |
| Legal pages | Terms, DMCA, Privacy, and AGPL pages exist and contain useful initial disclosures. | Copy is too compressed, inconsistent in dates/contact details, and does not clearly distinguish the hosted service, open-source client, third-party metadata, user content, deletion, reports, or designated notice workflow. |
| Global shell | Skip link, route titles, scroll reset, and an error boundary exist. | Error fallback is generic and does not give a report/diagnostic path; loading state is not page-specific for all routes. |

## Immediate trust priorities

The first implementation pass should make the service boundaries explicit at the moment users need them: a compact trust strip on Home, provenance/report affordances on Detail and Watch, community rules and report language near Comments, and a complete legal/resource cluster in both desktop and mobile footers. The policy pages should then be rewritten to match the actual client architecture and data behavior rather than making unsupported claims.

## Community research signals

Two public community discussions were inspected for recurring, non-provider-specific needs.

| Signal | Evidence | Product implication for Aniraku |
| --- | --- | --- |
| Watchlists need useful filters and ordering, especially a way to distinguish never-started titles from in-progress or completed ones. | A Crunchyroll community feature request explicitly asks for filtering a saved list by titles that were added but never started, plus date-based ordering. [1] | Improve bookmark/progress visibility, make status understandable, and provide a direct route to profile history/bookmarks rather than relying only on a generic library. |
| Cross-device progress is valuable but users lose trust when tracking is unclear or buggy. | A community thread identifies cross-device episode progress as the key requirement; replies note that tracking may depend on being signed in, while separate replies call out player bugs and ad-related reliability concerns. [2] | Surface the signed-in sync state, clarify local versus account-backed history, keep resume logic explicit, retain provider failover, and add a non-destructive playback/source report path. |

[1]: https://www.reddit.com/r/Crunchyroll/comments/1iyveey/feature_requests/
[2]: https://www.reddit.com/r/animepiracy/comments/vkdq7v/any_anime_streaming_sites_that_track_episode/

| Signal | Evidence | Product implication for Aniraku |
| --- | --- | --- |
| A clean mobile interface, separate source choices, lightweight comments, and account/progress sync are repeatedly named as practical improvements by a streaming-site builder; a community reply additionally identifies private/public watch rooms as a valued but much larger social feature. [3] | The discussion is a small qualitative sample, not a roadmap vote. It reinforces existing priorities: protect the player from clutter, make source failures actionable, keep comments constrained and understandable, and preserve account sync. Watch-party rooms require real-time architecture and moderation and will not be represented as a shipped feature until it can be implemented safely. | Implement clear source/report pathways, community expectations, bookmark/history clarity, and a visible feedback route now; treat real-time watch rooms as a future, separately scoped proposal. |

[3]: https://www.reddit.com/r/webdev/comments/1q9733s/feedback_needed_on_anime_streaming_site_features/

## Production-preview validation

The rebuilt Privacy Policy and new Community Guidelines routes were opened from the production preview on August 13, 2026. Both pages rendered the shared legal header, revision metadata, section navigation, policy content, cross-links to the other trust pages, GitHub reporting route, desktop footer trust cluster, and mobile-safe responsive legal layout. The preview also confirmed that the public route titles resolve as `Privacy Policy | Aniraku` and `Community Guidelines | Aniraku`.
The production preview also confirmed that Home and Catalog both expose the reusable four-link trust strip without replacing their primary page purpose. Home retains its editorial watch-programme structure and intent-based discovery cards; Catalog retains its featured title, search, filters, quick links, and browse rails. Each trust item links to the corresponding License, DMCA, Privacy, or Community Guidelines route, while the shared footer exposes all policy links and the GitHub issue route.
Schedule production-preview validation confirmed the calendar-correct weekday tabs, local-time notice, next-release cue, relative countdowns, clickable release cards, and shared trust strip render together with live AniList results. No route or layout regression was observed in the desktop preview.
Anime Detail production-preview validation confirmed the trust strip renders above Comments and the temporary episode-data state now distinguishes AniList metadata from separately resolved playback sources. The Watch route opened to its intended content-shaped loading skeleton; no route crash or error boundary occurred during initial player loading, so the added playback transparency note will be rechecked once the player data settles.
A second Watch-page inspection confirmed the intended backend-warmup state rather than a crash: playback controls, 10-second seek actions, episode-rating controls, anime-page navigation, and the new third-party-source/report note remain visible while provider data loads. The page explicitly tells users that some features are limited while the backend warms up, preserving an honest recovery state.
