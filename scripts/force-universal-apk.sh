#!/usr/bin/env bash
# ═══ force-universal-apk.sh ═══
# Patches android/app/build.gradle AFTER expo prebuild to guarantee
# both armeabi-v7a and arm64-v8a ABIs are in the APK.
# This runs as a CI step, not a config plugin, so it always has the final word.

set -euo pipefail

BUILD_GRADLE="android/app/build.gradle"

if [ ! -f "$BUILD_GRADLE" ]; then
  echo "ERROR: $BUILD_GRADLE not found"
  exit 1
fi

echo "=== Current ndk/abiFilters section ==="
grep -n -A5 'ndk\|abiFilters\|splits' "$BUILD_GRADLE" || echo "(none found yet)"

# ── Step 1: Remove any existing ndk block so we can inject a clean one ──
sed -i '/ndk {/,/}/d' "$BUILD_GRADLE"

# ── Step 2: Inject ndk block with both ABIs into defaultConfig ──
# Find "defaultConfig {" and inject right after it
sed -i '/defaultConfig {/a\
            ndk {\
                abiFilters "armeabi-v7a", "arm64-v8a"\
            }' "$BUILD_GRADLE"

# ── Step 3: Remove any splits/abi block that enables ABI splitting ──
# Replace entire splits block with disabled
if grep -q 'splits' "$BUILD_GRADLE"; then
  # Use python for multi-line replacement
  python3 -c "
import re
with open('$BUILD_GRADLE', 'r') as f:
    content = f.read()
content = re.sub(
    r'splits\s*\{[^}]*abi\s*\{[^}]*\}[^}]*\}',
    'splits {\n        abi {\n            enable false\n            universalApk true\n        }\n    }',
    content,
    flags=re.DOTALL
)
with open('$BUILD_GRADLE', 'w') as f:
    f.write(content)
"
fi

# ── Step 4: If no splits block, add one ──
if ! grep -q 'splits' "$BUILD_GRADLE"; then
  cat >> "$BUILD_GRADLE" << 'GRADLE_EOF'

android {
    splits {
        abi {
            enable false
            universalApk true
        }
    }
}
GRADLE_EOF
fi

echo ""
echo "=== After patch ==="
grep -n -A5 'ndk\|abiFilters\|splits' "$BUILD_GRADLE"
echo ""
echo "=== Patch complete ==="
