# Aniraku Native Android — Design Specification

## Product direction

Aniraku Native Android is a portrait-first anime discovery and viewing application. It is not a browser shell. Its interface is a **Nothing OS-inspired media system** built on Android usability conventions: calm black surfaces, typographic precision, dot-matrix utility detail, clear state feedback, low-noise motion, and direct manipulation.

The design deliberately separates **content energy** from **system calm**. Anime artwork provides the color and emotion; application controls remain monochrome, highly legible, and consistent. This makes titles, playback health, authentication state, and sync status easier to understand at a glance.

## Screen list

| Screen | Primary content and functionality |
|---|---|
| Launch and recovery | Branded splash, session restoration, network-aware startup, and safe transition to authentication or home. |
| Home | Real trending, airing, popular, and upcoming anime from AniList; continue-watching rail from synced history; concise release-time labels; search entry. |
| Catalog | Native filter chips, paginated real search results, sort controls, adult-content protection, and fast poster grid/list switching. |
| Anime detail | Poster and backdrop, synopsis, genres, format, release context, favorite/bookmark actions, episode list, ratings, watch progress, comments, and provider availability. |
| Watch | Native video shell, source and quality selector, subtitle context, progress persistence, next episode path, playback state, provider failover, manual intro/outro actions, and Android fullscreen/PiP coordination. |
| Schedule | Daily airing schedule with real time-zone aware release times and direct title navigation. |
| Random | Minimal Nothing OS-style recommendation controls with real AniList selections and an immediate detail/watch path. |
| Search | Full-screen focused search with delayed network query, recent searches, result states, and keyboard-safe layout. |
| Authentication | Sign in, sign up, verified-email state, password recovery, new-password completion, and clear session errors using the existing Supabase project. |
| Profile and library | User identity, watch history, continue watching, episode ratings, bookmarks, history item removal, and cross-device sync state. |
| Comments | Anime- and movie-compatible comment list, composer, reporting guidance, and empty/error states. |
| Notifications | Authenticated notification inbox with read state and direct title/deep-link navigation. |
| Settings and legal | Playback preferences, NSFW privacy gate, account management, delete account path, terms, privacy, DMCA, community guidance, and license. |
| Offline and failure surfaces | Native connectivity banner, retryable content states, source failures, expired sessions, and non-blocking diagnostic copy. |

## Portrait layout and one-handed use

The base layout assumes a 9:16 Android phone. Primary navigation sits in a floating lower navigation bar inside thumb reach. The active destination is an outlined pill with a label; inactive destinations use quiet glyphs. Title-level actions stay in the upper-right control zone, while primary actions such as **Watch**, **Continue**, **Sign in**, and **Retry** occupy a single full-width lower action when possible.

Large-screen and foldable layouts preserve the same tasks. The phone navigation bar expands into a left-side compact rail only when there is sufficient horizontal space, while media and detail content use a two-column information hierarchy. No feature is removed at a larger width.

## Nothing OS-inspired visual system

| Element | Design rule |
|---|---|
| Background | Matte black `#090909` with a very subtle charcoal dot-grid texture, never a busy wallpaper. |
| Surfaces | Layered graphite `#141414` and `#1C1C1C`, using 1 px low-contrast outlines rather than heavy shadows. |
| Typography | Geometric display treatment for numbers and utility labels; readable system sans for narrative text. Numeric metadata uses tabular figures. |
| Accent | Signal red `#FF4D4D` is reserved for active playback, errors, destructive confirmation, and a restrained live/status indicator. White is the primary active state. |
| Shape | Rectangular modules with 12–20 px rounded corners, compact outlined chips, and circular utility controls with 48 dp touch areas. |
| Artwork | Posters and backdrops remain full-color; all application chrome stays monochrome so content is the visual focus. |
| Loading | Minimal segmented/dot progress treatment plus clear status text. Never present an ambiguous empty black screen. |
| Motion | 120–240 ms fades, position shifts, and press compression. Motion explains state change and never loops merely for decoration. |
| Feedback | Light haptic feedback for committed actions, clear selected states, connected/offline badges, and explicit provider/source status. |

## Key user flows

| Flow | Steps |
|---|---|
| Start watching | Home or Catalog → Anime detail → choose episode → native Watch screen → select a verified source if needed → player loads → progress sync begins. |
| Continue watching | Home continue rail → title detail or Watch → resume from saved position → completion threshold advances to the next eligible episode. |
| Account sign-in | Profile tab → sign in → Supabase password flow → verified session is checked → profile/library and notifications hydrate. |
| Password recovery | Authentication → forgot password → email link/deep link → new password screen → session is cleared or refreshed safely → return to sign in. |
| Add a bookmark | Detail screen → save action → authenticated Supabase write → immediate native confirmation → profile library updates. |
| Rate an episode | Detail episode row or Watch completion → rating sheet → authenticated write → rating appears in detail and profile history. |
| Source recovery | Player detects an unavailable source → concise source status → compatible verified alternatives appear → user or automatic selection continues playback without reloading the entire title. |
| Offline recovery | Network is lost → pinned offline state → cached UI remains readable → retry triggers once connection returns. |

## Production interaction rules

Every interactive control has a visible label or accessibility hint, a minimum 48 dp touch target where practical, a pressed state, and a defined success/failure response. Every remote data section has loading, empty, error, and retry states. Authentication tokens are stored only through native secure storage. The player must not claim support for a source that the backend has already marked unavailable.
