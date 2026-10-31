#!/usr/bin/env bash
# ═══ patch-release-signing.sh ═══
# Patches the PREBUILT android/app/build.gradle so assembleRelease signs with
# the STABLE release keystore instead of the runner's auto-generated debug
# key (CI runners generate a fresh one per run — that is why every release
# used to have a different signature and updates failed with
# "App not installed").
#
# Reads from gradle.properties (written by CI):
#   ANIRAKU_UPLOAD_STORE_FILE / STORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD
# Runs AFTER `expo prebuild`, BEFORE `gradlew assembleRelease`.
set -euo pipefail

STORE_FILE="${1:?Usage: $0 <store-file-name-relative-to-app-module> [path/to/build.gradle]}"
BUILD_GRADLE="${2:-android/app/build.gradle}"
[ ! -f "$BUILD_GRADLE" ] && echo "ERROR: $BUILD_GRADLE not found" && exit 1
: "${ANIRAKU_STORE_PASSWORD:?ANIRAKU_STORE_PASSWORD not set}"
: "${ANIRAKU_KEY_PASSWORD:?ANIRAKU_KEY_PASSWORD not set}"
ANIRAKU_KEY_ALIAS="${ANIRAKU_KEY_ALIAS:-aniraku}"

python3 - "$BUILD_GRADLE" "$STORE_FILE" "$ANIRAKU_STORE_PASSWORD" "$ANIRAKU_KEY_ALIAS" "$ANIRAKU_KEY_PASSWORD" <<'PY'
import sys
path, store_file, store_pw, alias, key_pw = sys.argv[1:6]
src = open(path).read()

if "ANIRAKU_UPLOAD_STORE_FILE" not in src:
    block = (
        "    signingConfigs {\n"
        "        release {\n"
        f'            storeFile file("{store_file}")\n'
        "            storePassword ANIRAKU_UPLOAD_STORE_PASSWORD\n"
        "            keyAlias ANIRAKU_UPLOAD_KEY_ALIAS\n"
        "            keyPassword ANIRAKU_UPLOAD_KEY_PASSWORD\n"
        "        }\n"
        "    }\n\n"
    )
    marker = "    buildTypes {"
    assert marker in src, "buildTypes block not found"
    src = src.replace(marker, block + marker, 1)

# Point the release build type at the stable signing config.
src = src.replace("signingConfig signingConfigs.debug", "signingConfig signingConfigs.release")

props = (
    f"ANIRAKU_UPLOAD_STORE_FILE={store_file}\n"
    f"ANIRAKU_UPLOAD_STORE_PASSWORD={store_pw}\n"
    f"ANIRAKU_UPLOAD_KEY_ALIAS={alias}\n"
    f"ANIRAKU_UPLOAD_KEY_PASSWORD={key_pw}\n"
)
open(path, "w").write(src)
print("signing config patched (stable release keystore)")
PY

GP="$(dirname "$(dirname "$BUILD_GRADLE")")/gradle.properties"
# Write to a temp file FIRST — redirecting into $GP directly would truncate
# it before grep reads it and wipe every other property (hermesEnabled etc).
TMP_GP="$(mktemp)"
{
  grep -v "^ANIRAKU_UPLOAD_" "$GP" 2>/dev/null || true
  printf 'ANIRAKU_UPLOAD_STORE_FILE=%s\n' "$STORE_FILE"
  printf 'ANIRAKU_UPLOAD_STORE_PASSWORD=%s\n' "$ANIRAKU_STORE_PASSWORD"
  printf 'ANIRAKU_UPLOAD_KEY_ALIAS=%s\n' "$ANIRAKU_KEY_ALIAS"
  printf 'ANIRAKU_UPLOAD_KEY_PASSWORD=%s\n' "$ANIRAKU_KEY_PASSWORD"
} > "$TMP_GP"
mv "$TMP_GP" "$GP"
echo "gradle.properties signing props written"
