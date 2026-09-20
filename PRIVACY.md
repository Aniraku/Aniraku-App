# Privacy Notice

**Effective date: September 20th of 2026**

Aniraku provides anime discovery, playback coordination, and optional account synchronization through the native Android application. This notice explains what information is used, why, where it lives, and the controls available to you.

| `INFORMATION` | `WHY IT IS USED` | `WHERE IT LIVES` |
| --- | --- | --- |
| Account email and verification state | Sign-in, password recovery, and verified-account enforcement. | The Aniraku Supabase authentication service until account deletion. |
| Encrypted session token | Maintains an authenticated session on your device. | Device keychain/keystore via encrypted native storage; removed on sign-out. Never placed in backups. |
| Profile (username, display name, avatar choice) | Identifies you in community features such as comments. | Account-scoped Supabase profile records until you change or delete them. |
| Progress, bookmarks, ratings, comments, alerts, and notification subscriptions | Synchronizes library and community features across your devices. | Account-scoped Supabase records until you remove them or delete the account. |
| Content preferences (NSFW toggle and the one-time 18+ affirmation) | Controls whether adult titles appear in browse, search, and random. | On your device only; never transmitted to any server. |
| Search history and notification display preferences | Recent searches, alert toggles, and display options. | On your device only. |
| Title, episode, and provider metadata | Renders discovery screens and coordinates a selected playback route. | Requested from AniList and the Aniraku API per screen; short-lived data remains in app memory and query cache. |
| Technical error context | Shows understandable in-app recovery and retry states. | The native release does not intentionally transmit advertising identifiers or behavioral analytics. |

## Your controls

You can sign out from Settings, clear watch history and bookmarks (individually where offered), change or remove your avatar, and delete your account from Settings. Account deletion invokes a protected server function that removes user-scoped records before removing the authentication record. It is intended to be irreversible. You may also request a copy of your account data using the contact below.

## Security measures

Traffic to Aniraku services is encrypted in transit (TLS). Sessions are held in encrypted native storage rather than plain app storage. Provider tokens for linked libraries are kept server-side and never enter the app. Access to account records is scoped to the signed-in user.

## Children and adult content

Aniraku is not intended for children under 13, and accounts or data known to belong to children are not knowingly retained. Titles flagged as adult are hidden by default; enabling them requires an explicit affirmation that the viewer is 18 or older.

## Services involved

Aniraku uses AniList for public anime metadata, the Aniraku API for source coordination, and Supabase for authentication and account-scoped synchronization. Each service processes the requests needed for its own function. Review their independent notices for details about their respective practices.

For privacy questions or account-data requests, contact **[privacy@aniraku.tech](mailto:privacy@aniraku.tech)**. This notice will be revised when the application's data practices materially change.

---

`See also`

[README](./README.md) · [Privacy](./PRIVACY.md) · [Terms](./TERMS.md) · [Security](./SECURITY.md) · [DMCA](./DMCA.md) · [Contributing](./CONTRIBUTING.md)
