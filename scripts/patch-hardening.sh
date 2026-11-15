#!/usr/bin/env bash
# ═══ patch-hardening.sh ═══
# Runs AFTER `expo prebuild`, BEFORE `gradlew assembleRelease` (same slot as
# patch-release-signing.sh). `expo prebuild` regenerates android/ from the
# template every build, so durable keep-rules must be appended here — not
# hand-edited into android/.
#
# With enableProguardInReleaseBuilds: true (expo-build-properties), R8
# obfuscates + shrinks the release DEX: class/method names that map the app's
# streaming pipeline (provider rotation, download orchestration, proxy
# headers) stop being readable via jadx-style tooling. Hermes already keeps
# the JS layer as bytecode, not source.
#
# The keep rules are DELIBERATE: only reflection-resolved surfaces stay
# unobfuscated. Everything else (business logic packages) obfuscates.
set -euo pipefail

RULES_FILE="${1:-android/app/proguard-rules.pro}"
[ -d android ] || { echo "ERROR: run after expo prebuild (android/ missing)"; exit 1; }
touch "$RULES_FILE"

append_rule() {
  local rule="$1"
  grep -qxF "$rule" "$RULES_FILE" || echo "$rule" >> "$RULES_FILE"
}

{
  echo ""
  echo "# ── Aniraku hardening (patch-hardening.sh — regenerated each prebuild) ──"
  echo "# Custom expo modules: registered reflectively, so their classes must"
  echo "# survive R8 or requireNativeModule(\"AnirakuDownloads\") fails at runtime."
  append_rule "-keep class expo.modules.anirakudownloads.** { *; }"
  append_rule "-keep class expo.modules.anirakustreampool.** { *; }"
  echo "# Expo modules core resolves Kotlin definitions reflectively."
  append_rule "-keep class expo.modules.kotlin.** { *; }"
  append_rule "-keepclassmembers class * extends expo.modules.kotlin.modules.Module { *; }"
  echo "# Playback stack (react-native-video surface + transport libs)."
  append_rule "-keep class com.brentvatne.react.** { *; }"
  append_rule "-dontwarn okhttp3.**"
  append_rule "-dontwarn okio.**"
  echo "# Kotlin metadata + generics for reflective callers."
  append_rule "-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod"
} >> "$RULES_FILE"

echo "ProGuard keep rules applied to $RULES_FILE"
