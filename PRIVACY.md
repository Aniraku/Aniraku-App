# Aniraku Native Android Privacy Notice

**Effective date: August 13, 2026**

Aniraku Native Android provides anime discovery, playback coordination, and optional account synchronization. This notice describes how the application handles information when a person uses the native application.

| Information category | Purpose | Storage and retention |
|---|---|---|
| Account email and verification state | Sign-in, recovery, and verified account enforcement. | Managed by the Aniraku Supabase authentication service until the account is deleted. |
| Encrypted session token | Keeps a verified session active on the device. | Stored through the platform keychain/keystore; removed on sign-out or Android app uninstall. |
| Watch progress, bookmarks, ratings, comments, notifications, and preferences | Synchronizes optional library and community features. | Stored in the Aniraku Supabase project under account-scoped access controls until removed by the user or account deletion. |
| Title and provider metadata | Renders discovery and coordinates playback. | Retrieved from AniList and the Aniraku API; short-lived data is held in app memory and query cache. |
| Technical error context | Shows actionable in-app errors and supports safe retry behavior. | The current native release does not intentionally transmit advertising identifiers or behavioral analytics. |

## Controls

The user can sign out from Settings, clear watch history, clear bookmarks, remove individual history entries where offered, and delete the account. Account deletion calls a protected server function that clears user-scoped records before removing the authentication record. This action is designed to be irreversible.

## Third-party services

The app uses AniList for public anime metadata, the Aniraku API for source coordination, and Supabase for authentication and account-scoped synchronization. Those services process requests necessary to provide their respective functions. Users should review the applicable service notices for details of their independent processing practices.

## Contact

For privacy questions or account data requests, contact **privacy@aniraku.tech**. This notice may be updated when the app’s data practices materially change; the effective date will be revised with the update.
