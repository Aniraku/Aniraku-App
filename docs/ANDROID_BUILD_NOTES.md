# Android Build Notes

This repository packages the existing Aniraku Vite application through Capacitor rather than maintaining a second feature implementation. Capacitor’s official guidance supports adding its runtime to an existing web application that already has `package.json`, a built web-assets directory, and an `index.html` entry point.

The Android project targets Capacitor 8 with `minSdkVersion 24`, `compileSdkVersion 36`, and `targetSdkVersion 36`. Capacitor documents Android 7.0 (API 24) as the minimum Android platform for Capacitor 8. The build uses Android SDK Platform 36 and Build Tools 36.0.0.

| Resource | Purpose |
|---|---|
| [Capacitor: Add Capacitor to an existing web app](https://capacitorjs.com/docs/getting-started) | Core installation, `webDir`, platform creation, and sync workflow |
| [Capacitor Android documentation](https://capacitorjs.com/docs/android) | Android support floor, platform addition, device/emulator workflow, and native project handling |
| [Capacitor support policy](https://capacitorjs.com/docs/main/reference/support-policy) | Capacitor 8 maintenance status and compatibility table |
| [Android command-line tools](https://developer.android.com/tools) | Android SDK package roles, SDK environment variables, Build Tools, Platform Tools, and SDK manager |
| [Android Studio download page](https://developer.android.com/studio) | Official current command-line tools package and published SHA-256 verification data |

The Android command-line tools archive used for the local validation environment was verified against the SHA-256 value published on the Android Studio download page before extraction. Local SDK paths and signing material are intentionally excluded from version control.
