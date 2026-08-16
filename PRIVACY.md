![Aniraku documentation signal](./assets/readme/documentation-signal.svg)

`ANIRAKU / YOUR DATA, IN CONTEXT`

# Privacy Notice

**Effective date: August 16, 2026**

Aniraku provides anime discovery, playback coordination, and optional account synchronization. This notice explains the information used when you use the native Android application.

| `INFORMATION` | `WHY IT IS USED` | `WHERE IT LIVES` |
| --- | --- | --- |
| Account email and verification state | Sign-in, recovery, and verified-account enforcement. | The Aniraku Supabase authentication service until account deletion. |
| Encrypted session token | Maintains an authenticated session on your device. | Device keychain/keystore; removed on sign-out or app uninstall. |
| Progress, bookmarks, ratings, comments, alerts, and preferences | Synchronizes optional library and community features. | Account-scoped Supabase records until you remove them or delete the account. |
| Title and provider metadata | Renders discovery and coordinates a selected playback route. | AniList and the Aniraku API; short-lived data remains in app memory and query cache. |
| Technical error context | Shows understandable in-app recovery and retry states. | The native release does not intentionally transmit advertising identifiers or behavioral analytics. |

## Your controls

You can sign out from Settings, clear watch history and bookmarks, remove individual history items where the feature is offered, and delete your account. Account deletion invokes a protected server function that removes user-scoped records before removing the authentication record. It is intended to be irreversible.

## Services involved

Aniraku uses AniList for public anime metadata, the Aniraku API for source coordination, and Supabase for authentication and account-scoped synchronization. Each service processes requests needed for its own function. Review their independent notices for details about their respective practices.

For privacy questions or account-data requests, contact **privacy@aniraku.tech**. This notice will be revised when the application’s data practices materially change.

---

`SIGNAL / YOU DECIDE WHAT STAYS`

[README](./README.md) · [Terms](./TERMS.md) · [Security](./SECURITY.md) · [DMCA](./DMCA.md)
