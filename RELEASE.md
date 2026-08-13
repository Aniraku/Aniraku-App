# Aniraku for Android Release Guide

This guide describes the release process for `tech.aniraku.app`. Follow it for every public APK or Android App Bundle release.

## 1. Preserve the signing identity

Android updates must be signed with the same upload key as the first release. Store the following together in an encrypted, access-controlled backup before distributing any release:

```text
android/app/aniraku-release.jks
android/keystore.properties
```

Neither file belongs in Git. The repository ignores both paths. If the key is lost, users cannot install a later build as an update to the existing application identity.

## 2. Validate source and native project

Run the complete validation sequence from a clean working tree.

```bash
npm ci
npm run lint
npm run build
npm run test:bots
npm run test:e2e
npm run android:sync
cd android
./gradlew lintRelease assembleRelease bundleRelease
```

The expected artifacts are:

| Artifact | Path | Use |
|---|---|---|
| Signed APK | `android/app/build/outputs/apk/release/app-release.apk` | Direct device installation and GitHub release attachment |
| Signed App Bundle | `android/app/build/outputs/bundle/release/app-release.aab` | Google Play Console upload |

## 3. Verify the APK

Use Android Build Tools to confirm the artifact is correctly aligned and signed.

```bash
$ANDROID_HOME/build-tools/36.0.0/zipalign -c -v 4 android/app/build/outputs/apk/release/app-release.apk
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --verbose --print-certs android/app/build/outputs/apk/release/app-release.apk
$ANDROID_HOME/build-tools/36.0.0/aapt dump badging android/app/build/outputs/apk/release/app-release.apk
```

The package name must be `tech.aniraku.app`, version code must increase for each public update, and the displayed certificate fingerprint must match the protected Aniraku upload key.

## 4. Perform a physical-device pass

Install the release APK on a clean Android device and verify launch, splash dismissal, sign-in, password recovery, session protection, catalog search, anime details, player start, provider switching, quality selection, subtitles, history synchronization, comments, ratings, bookmarks, Android system back, rotate/resume, deep links, keyboard resize, and offline feedback.

Test at least one compact phone and one wider layout. Test a title with a standard HLS source and a title that needs provider/source failover. Do not publish a release if the player shows an indefinite blank state or if signing and package identity cannot be verified.

## 5. Publish

Create a GitHub release in `Aniraku/Aniraku-App` with the tag `v<version>`, attach the signed APK, and summarize user-facing changes from `CHANGELOG.md`. For Google Play, upload the `.aab`, complete the current store disclosures, and use the Play pre-launch report before a broad rollout.

The hosted app and this Android app use external metadata and playback providers. Release notes should never promise universal title availability or device-independent playback; instead, describe the actual reliability and recovery improvements included in the build.
