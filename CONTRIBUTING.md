![Aniraku documentation signal](./assets/readme/documentation-signal.svg)

`ANIRAKU / BUILD WITH INTENT`

# Contributing

Contributions should make the native product more trustworthy, not merely more complicated. Preserve the native-first boundary, the calm editorial interface, real service contracts, and explicit recovery states.

## Before you open a pull request

```bash
pnpm install
pnpm check
pnpm test
npx expo config --type public --json
```

| `KEEP` | `DO NOT ADD` |
| --- | --- |
| Native React Native views, accessible labels, real state handling, concise copy, documented migration notes, and deterministic tests where behavior can regress. | WebView wrappers for the app, provider scraping, private credential handling, placeholder content, fake availability states, unverified media fallbacks, or generated product screenshots. |

## A useful pull request

Name the user problem, explain the native behavior you changed, include the checks you ran, and call out any impact on authentication, playback, data contracts, Android package configuration, or account deletion. Keep visual changes aligned with the [Aniraku documentation and product system](./docs/DOCUMENTATION_SYSTEM.md): one focal action, restrained signal red, real artwork, and no repeated decorative cards.

Do not commit `.env` files, Android keystores, access tokens, signing material, personal screenshots, or durable provider URLs.

---

`SIGNAL / CLEAR`

[README](./README.md) · [Architecture](./docs/NATIVE_ARCHITECTURE.md) · [Security](./SECURITY.md) · [MIT License](./LICENSE)
