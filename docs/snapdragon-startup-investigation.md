# Snapdragon 680 Startup Investigation

## Rejected Device-Test Artifact

The latest legacy-architecture compatibility APK was EAS build `e779f001-06e2-47cc-9478-b296250e8dff`, built from checkpoint `5d5d2e97c96a6762946a23151188e785e23db03b`. Its EAS artifact URL was `https://expo.dev/artifacts/eas/_XkojsF2xlIV_m611_-USIJPu8mAd52ojaJJ-D76-I4.apk`.

The user tested this artifact on a Samsung One UI phone using a Snapdragon 680 and reported an immediate system dialog stating that Aniraku keeps stopping. This APK is rejected for release and must not be reused as a supported download.

## Confirmed Configuration

The rejected compatibility artifact used Expo SDK 54 with `newArchEnabled: false`, React Compiler disabled, Android `minSdkVersion: 24`, and both `armeabi-v7a` and `arm64-v8a` native libraries. NativeWind, Reanimated, and Worklets were removed from its dependency graph. Its remote EAS build completed successfully, which proves packaging but not runtime launch.

## Evidence-Based Next Steps

The device has no accessible USB logcat while the user is away from a PC. The remaining launch-risk mitigation is therefore limited to static release-hardening, generated-Android inspection, and removal or guarding of startup-time native and JavaScript initialization. A future device trace remains necessary to identify the precise fatal exception.

## Android 15 One UI 7 Bug Report Finding

The Samsung interactive bug report captured the actual fatal error for package `tech.aniraku.app`:

> `FATAL EXCEPTION: mqt_v_native` — `TypeError: Cannot read property 'hostname' of undefined`

The stack occurs while Expo Router builds its route tree, before the first screen is displayed. The error maps to `lib/app-config.ts`: React Native defines a global `window` alias, but it does not supply browser `window.location`. The previous `typeof window` check incorrectly treated native runtime as browser runtime and then destructured `window.location.hostname`.

The fix now reads `window.location?.hostname` only after checking for a real location object. A regression test simulates React Native's defined `window` without `location` and verifies that the app uses `https://api.aniraku.tech` directly. TypeScript passes and the test suite now has 14 passing tests with 1 intentional skip.
