# Contributing to Aniraku for Android

Thank you for contributing to Aniraku for Android. This repository contains the shared React frontend bundled through Capacitor, together with the Android project, native integration layer, release configuration, and Android-specific interface refinements.

## Local setup

Install Node.js 22 or later before installing project dependencies.

```bash
git clone https://github.com/Aniraku/Aniraku-App.git
cd Aniraku-App
npm install
npm run dev
```

For Android work, install Java 21, Android SDK Platform 36, and Android Build Tools 36.0.0. Configure an Android SDK path in the ignored `android/local.properties` file, then synchronize the web bundle into the native project.

```bash
npm run android:sync
```

If account, bookmarks, history, or comments need to be exercised against a non-production Supabase environment, create a local `.env` file. Do not commit it.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://127.0.0.1:43211
```

## Project structure

| Path | Responsibility |
|---|---|
| `src/` | Shared Aniraku React routes, player, authentication, library, and UI features |
| `src/lib/nativeAndroid.js` | Capacitor lifecycle, deep links, status bar, connectivity, splash, keyboard, and system-back behavior |
| `src/index.css` | Shared dark theme plus Android-only Material 3 × Nothing OS tokens |
| `android/` | Generated Capacitor Android project, manifest, resources, Gradle configuration, and release build setup |
| `scripts/generate_android_assets.py` | Reproducible launcher and splash asset generation from the approved Aniraku icon |
| `e2e/` | Cross-device browser regression tests for the shared frontend |

## Design and behavior expectations

The Android app must retain all maintained Aniraku flows. Do not replace a real feature with a native-only placeholder or a static screen. Authentication, verified-session protection, password recovery, playback, progress sync, history, ratings, bookmarks, comments, profile settings, catalog, schedule, and legal routes must continue to use the shared source paths.

Android-specific work should remain scoped to the Capacitor bridge, native manifest/resources, or `html.native-android` styling. The intended visual direction is Material 3 with Nothing OS restraint: monochrome surfaces, deliberate spacing, 44 px or larger touch targets, calm motion, and direct user feedback. Browser and Vercel layouts must remain unchanged unless a shared responsive fix is necessary.

## Validation

Run the checks appropriate to the change before opening a pull request.

```bash
npm run lint
npm run build
npm run test:bots
npm run test:e2e
npm run android:sync
cd android && ./gradlew lintDebug assembleDebug
```

For release-related changes, also validate a signed release build locally. Never commit a signing key, passwords, `.env` file, or `android/local.properties`.

```bash
npm run android:release
```

A physical-device pass should cover installation, launch splash, sign-in, catalog search, title detail, mobile search, playback provider changes, system back, keyboard resize, deep links, and offline feedback. Report the Android version, device model, app version, route, and concise reproduction steps with every Android issue.

## Pull requests

Keep changes focused and explain both the shared-web and Android effect. Include screenshots or a short recording for visual changes, especially on compact Android screens. Any modification to playback, authentication, or native configuration must include a clear validation note.

## License

By contributing, you agree that your contribution is licensed under the project [MIT License](LICENSE).
