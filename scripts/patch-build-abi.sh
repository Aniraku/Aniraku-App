#!/usr/bin/env bash
# ═══ patch-build-abi.sh ═══
# Patches build.gradle to target ONLY the specified ABI.
# Usage: bash scripts/patch-build-abi.sh arm64-v8a
#        bash scripts/patch-build-abi.sh armeabi-v7a
set -euo pipefail

ABI="${1:?Usage: $0 <abi>  (arm64-v8a or armeabi-v7a)}"
BUILD_GRADLE="android/app/build.gradle"
[ ! -f "$BUILD_GRADLE" ] && echo "ERROR: $BUILD_GRADLE not found" && exit 1

# Remove any existing ndk block from defaultConfig
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

# Inject ndk block into defaultConfig
sed -i "/defaultConfig {/a\\
            ndk {\\
                abiFilters \"$ABI\"\\
            }" "$BUILD_GRADLE"

# Also override react-native-video's abiFilters via gradle.properties
GP="android/gradle.properties"
if [ -f "$GP" ]; then
  sed -i '/reactNativeArchitectures/d' "$GP"
  # Ensure file ends with newline before appending
  [ -n "$(tail -c1 "$GP")" ] && printf '\n' >> "$GP"
  printf 'reactNativeArchitectures=%s\n' "$ABI" >> "$GP"
else
  printf 'reactNativeArchitectures=%s\n' "$ABI" > "$GP"
fi

echo "=== Build configured for: $ABI ==="
grep -A5 'ndk' "$BUILD_GRADLE"
echo "--- gradle.properties ---"
grep 'reactNativeArchitectures' "$GP"
