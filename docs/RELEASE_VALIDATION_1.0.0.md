# Aniraku for Android 1.0.0 Validation Record

**Validation date:** August 13, 2026  
**Package ID:** `tech.aniraku.app`  
**Version:** `1.0.0` (`versionCode 1`)  
**Android support:** API 24 minimum; API 36 target and compile SDK

## Automated checks

| Check | Result |
|---|---|
| `npm run lint` | Passed with 0 errors and 84 pre-existing warnings in shared source |
| `npm run build` | Passed |
| `npm run test:bots` | Passed: 25 of 25 requests returned 2xx against the live Aniraku site |
| `npm run test:e2e` | Passed: 8 of 8 cross-device tests |
| `npx cap sync android` | Passed |
| `./gradlew lintDebug` | Passed |
| `./gradlew assembleDebug` | Passed |
| `./gradlew assembleRelease` | Passed |
| `./gradlew bundleRelease` | Passed |
| `zipalign -c -v 4` | Passed |
| `apksigner verify --verbose --print-certs` | Passed; signed with the local 4096-bit RSA Aniraku release key |

## Signed artifacts

| Artifact | SHA-256 |
|---|---|
| `Aniraku-Android-v1.0.0-universal.apk` | `32e8aec8bb822980eef7266e241d168de1c5a86f3a05af6276e1182f3d7d0d87` |
| `Aniraku-Android-v1.0.0.aab` | `2c31a4f76043d52d5153376e8eed5f43cda460c89cdb49cb1aca45dd3fdffb6f` |

The release APK uses APK Signature Scheme v2 and one 4096-bit RSA signer. The APK contains no native `lib/` entries; it is a single Java/WebView runtime artifact rather than an ABI-split native binary. This is appropriate for direct installation across supported Android architectures that provide the system WebView. The AAB is included for Google Play’s device-specific delivery.

## Manifest and security review

The release manifest was inspected with Android Build Tools. The requested permissions are limited to `INTERNET`, `ACCESS_NETWORK_STATE`, and `WAKE_LOCK`, together with the platform-generated private dynamic-receiver permission. It does not request contacts, files/storage, camera, microphone, location, SMS, call log, or notifications.

The release has `usesCleartextTraffic=false`, explicit component export configuration, `aniraku://` deep-link handling, predictive-back support, unspecified orientation, keyboard resize behavior, and support for small, normal, large, and xlarge screens.

## Manual physical-device release gate

A physical-device check remains a release-gate activity because no Android device was connected to the build environment. Before broad distribution, install the signed APK on at least one compact phone and one tablet or large-screen device, then verify launch, splash, sign-in, password recovery, verified session behavior, catalog, anime detail, player startup, provider failover, quality changes, subtitles, system back, rotate/resume, keyboard resize, deep links, history/rating sync, comments, and offline feedback.

> The automated build, signing, static manifest, source, and cross-device browser checks are complete. Physical playback behavior must still be confirmed on actual target devices because the device WebView, codecs, network, and provider availability are outside a sandbox build environment.
