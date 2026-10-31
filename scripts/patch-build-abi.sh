#!/usr/bin/env bash
# ═══ patch-build-abi.sh ═══
# Patches the PREBUILT android/app/build.gradle so the APK packages ONLY the
# given ABI(s). `-PreactNativeArchitectures` alone never filters packaged
# jniLibs — every dependency ships .so files for all ABIs, which is how the
# "arm32"/"arm64" CI builds ended up containing every ABI under the sun.
#
# Usage:
#   bash scripts/patch-build-abi.sh arm64-v8a [path/to/build.gradle]
#   bash scripts/patch-build-abi.sh "armeabi-v7a,arm64-v8a,x86_64" [path]
#
# Runs AFTER `expo prebuild` and BEFORE `gradlew assembleRelease`.
set -euo pipefail

ARCHS="${1:?Usage: $0 <abi-list-comma-separated> [path/to/build.gradle]}"
BUILD_GRADLE="${2:-android/app/build.gradle}"
[ ! -f "$BUILD_GRADLE" ] && echo "ERROR: $BUILD_GRADLE not found" && exit 1

# Build the Gradle filter list: one quoted entry per ABI.
FILTERS=""
IFS=',' read -ra PARTS <<< "$ARCHS"
for part in "${PARTS[@]}"; do
  part="$(echo "$part" | tr -d ' ')"
  [ -z "$part" ] && continue
  [ -n "$FILTERS" ] && FILTERS="$FILTERS, "
  FILTERS="$FILTERS\"$part\""
done
[ -z "$FILTERS" ] && echo "ERROR: no ABIs parsed from '$ARCHS'" && exit 1

# Remove any existing ndk block from defaultConfig (idempotent re-runs)
sed -i '/ndk {/,/}/d' "$BUILD_GRADLE"

# Remove any splits block
python3 -c "
import re
with open('$BUILD_GRADLE', 'r') as f:
    content = f.read()
content = re.sub(r'splits\s*\{[^}]*\}', '', content, flags=re.DOTALL)
with open('$BUILD_GRADLE', 'w') as f:
    f.write(content)
"

# Inject the ndk block into defaultConfig
sed -i "/defaultConfig {/a\\
            ndk {\\
                abiFilters $FILTERS\\
            }" "$BUILD_GRADLE"

# RN's own C++ compile follows the same arch list via gradle.properties
GP="$(dirname "$(dirname "$BUILD_GRADLE")")/gradle.properties"
if [ -f "$GP" ]; then
  sed -i '/reactNativeArchitectures/d' "$GP"
  [ -n "$(tail -c1 "$GP")" ] && printf '\n' >> "$GP"
  printf 'reactNativeArchitectures=%s\n' "$ARCHS" >> "$GP"
else
  printf 'reactNativeArchitectures=%s\n' "$ARCHS" > "$GP"
fi

echo "=== Build configured for: $ARCHS ==="
grep -A3 'ndk' "$BUILD_GRADLE"
echo "--- gradle.properties ---"
grep 'reactNativeArchitectures' "$GP"
