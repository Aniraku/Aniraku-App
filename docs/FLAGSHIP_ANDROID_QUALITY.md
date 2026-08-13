# Flagship Android Quality Benchmark

Aniraku for Android should be judged by clarity, reliability, and responsive mobile behavior rather than by visual imitation of any other product. The application uses a **Nothing OS-inspired** visual language—monochrome surfaces, dot-grid texture, modular rounded controls, direct motion, and visible system feedback—on top of Android and Material accessibility expectations.

## Product standard

| Quality dimension | Implementation rule | Validation signal |
|---|---|---|
| Feature parity | The Capacitor shell bundles the maintained Aniraku frontend instead of a reduced mobile clone. | Auth, profiles, playback, history, ratings, bookmarks, comments, catalog, schedules, legal routes, and settings resolve through the shared application. |
| First response | Playback starts quickly from a previously verified source or communicates an active loading/failover state immediately. | No indefinite black player; current player skeleton, provider status, and failover messages remain visible. |
| Navigation | Android system back closes an active search sheet first, then navigates history, then minimizes only from the root route. | Back behavior is predictable on title, watch, catalog, search, and home screens. |
| Touch ergonomics | Custom Android controls use 48 dp-equivalent touch targets where practical and clear accessible labels. | Bottom navigation items are at least 44 px tall and carry labels and ARIA semantics in the WebView. |
| Visual personality | Nothing OS-inspired monochrome surfaces and dot texture are Android-only, retaining clear contrast and avoiding decorative noise. | Browser/Vercel layouts are unchanged; the packaged app uses native token overrides and clean state feedback. |
| Resilience | Connectivity changes, malformed deep links, unavailable providers, unsupported embeds, and plugin absence degrade gracefully. | Offline banner, source filtering, current player failover, and defensive native plugin handling work without app crashes. |
| Privacy and scope | The app requests only internet, network state, and wake-lock permissions; no contacts, storage, location, microphone, or notification permission is requested. | Manifest review confirms a narrow permission surface. |

## Research-informed guardrails

Android’s core quality guidance calls for state preservation on resume, predictable system-back behavior, responsive rendering or visible feedback when startup is delayed, minimal permissions, and secure WebView practices. It also expects functional parity across orientations and form factors where supported.[1]

Material guidance recommends clear navigation hierarchy, 48 × 48 dp touch targets, sufficient separation between targets, readable contrast, and visible feedback for actions. Android accessibility guidance specifies a 4.5:1 contrast ratio for small text and 3:1 for large text or graphics, while recommending 48 dp touch targets for interactive elements.[2] [3]

> The objective is not to add visual noise. It is to make every state—ready, loading, offline, selecting, playing, failing over, and returning—obvious and fast.

## References

[1]: https://developer.android.com/docs/quality-guidelines/core-app-quality "Android core app quality guidelines"

[2]: https://developer.android.com/guide/topics/ui/accessibility/apps "Make apps more accessible"

[3]: https://m3.material.io/foundations/designing/structure "Material Design structure and touch targets"

[4]: https://m3.material.io/components/progress-indicators/overview "Material Design 3 progress indicators"
