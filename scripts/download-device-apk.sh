#!/usr/bin/env bash
set -euo pipefail

url="https://expo.dev/artifacts/eas/yobx3HnBSkI65arbJoLowpV6uh4wAhCzqrRx1YWLKnw.apk"
output="/home/ubuntu/aniraku-foss-release/device-test/Aniraku-watchjsx-e2e.apk"
workdir="${output}.parts"
size=51209719
parts=8

rm -rf "$workdir"
mkdir -p "$workdir"
for index in $(seq 0 $((parts - 1))); do
  start=$((index * size / parts))
  end=$((((index + 1) * size / parts) - 1))
  curl -fsSL --range "${start}-${end}" "$url" -o "${workdir}/${index}" &
done
wait
cat "${workdir}"/{0,1,2,3,4,5,6,7} > "$output"
rm -rf "$workdir"
test "$(wc -c < "$output")" -eq "$size"
unzip -tq "$output" >/dev/null
sha256sum "$output"
