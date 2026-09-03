#!/usr/bin/env bash
# ═══ force-universal-apk.sh ═══
# Patches android/app/build.gradle AFTER expo prebuild to guarantee
# both armeabi-v7a and arm64-v8a ABIs are in the APK.

set -euo pipefail

BUILD_GRADLE="android/app/build.gradle"

if [ ! -f "$BUILD_GRADLE" ]; then
  echo "ERROR: $BUILD_GRADLE not found"
  exit 1
fi

echo "=== Current ndk/abiFilters section ==="
grep -n -A5 'ndk\|abiFilters' "$BUILD_GRADLE" || echo "(none found yet)"

# Remove any existing ndk block to avoid duplicates
sed -i '/ndk {/,/}/d' "$BUILD_GRADLE"

# Inject ndk block with both ABIs into defaultConfig
sed -i '/defaultConfig {/a\
            ndk {\
                abiFilters "armeabi-v7a", "arm64-v8a"\
            }' "$BUILD_GRADLE"

echo ""
echo "=== After patch ==="
grep -n -A5 'ndk\|abiFilters' "$BUILD_GRADLE"
echo ""
echo "=== Patch complete ==="
