# Contributing to Aniraku Native Android

Contributions should preserve the native-first product boundary: do not add WebView wrappers, provider scraping, private credential handling, placeholder content, or unverified media fallbacks. Use the Nothing OS-inspired design tokens, real service contracts, accessible labels, and explicit loading/error states.

Before opening a pull request, install dependencies and run the release checks.

```bash
pnpm check
pnpm test
npx expo config --type public --json
```

Changes that affect authentication, playback, account deletion, database contracts, or Android build settings should include deterministic tests and a concise migration or operational note. Do not commit `.env` files, Android keystores, screenshots containing personal data, or token-bearing source URLs.
