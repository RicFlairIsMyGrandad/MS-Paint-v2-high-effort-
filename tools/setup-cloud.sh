#!/usr/bin/env bash
set -euo pipefail
cd /workspace/MS-Paint-v2-high-effort-
task_cache=/workspace/.cache
mkdir -p "$task_cache/npm" "$task_cache/electron"
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --cache "$task_cache/npm" --no-audit --no-fund
task_electron_version=$(node -p 'require("./package.json").devDependencies.electron')
if [[ "$task_electron_version" != 38.2.0 ]]; then
  echo 'Update the pinned runtime hashes before using a different Electron version.' >&2
  exit 1
fi
task_tmp=$(mktemp -d /tmp/paintplus-runtime.XXXXXX)
trap 'rm -rf "$task_tmp"' EXIT
for task_platform in linux win32; do
  task_archive="electron-v${task_electron_version}-${task_platform}-x64.zip"
  if [[ "$task_platform" == linux ]]; then
    task_hash=f0028975282a6f2946797175ac406a95096f29c5dcda98048148668dfa36eff8
  else
    task_hash=4382b317dbbbc0bbf8a301304749324b88207218aac240b670f1c1247c2a02b0
  fi
  task_file="$task_cache/electron/$task_archive"
  if [[ ! -f "$task_file" ]] || ! printf '%s  %s\n' "$task_hash" "$task_file" | sha256sum -c --status; then
    curl --fail --location --retry 2 "https://github.com/electron/electron/releases/download/v${task_electron_version}/$task_archive" -o "$task_tmp/$task_archive"
    printf '%s  %s\n' "$task_hash" "$task_tmp/$task_archive" | sha256sum -c -
    mv "$task_tmp/$task_archive" "$task_file"
  fi
done
mkdir -p node_modules/electron/dist "$task_cache/electron/win32"
unzip -qo "$task_cache/electron/electron-v38.2.0-linux-x64.zip" -d node_modules/electron/dist
printf 'electron' > node_modules/electron/path.txt
chmod +x node_modules/electron/dist/electron
unzip -qo "$task_cache/electron/electron-v38.2.0-win32-x64.zip" -d "$task_cache/electron/win32"
task_model=assets/ai/u2netp.onnx
task_model_hash=309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8
if [[ ! -f "$task_model" ]] || ! printf '%s  %s\n' "$task_model_hash" "$task_model" | sha256sum -c --status; then
  curl --fail --location --retry 2 https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx -o "$task_tmp/u2netp.onnx"
  printf '%s  %s\n' "$task_model_hash" "$task_tmp/u2netp.onnx" | sha256sum -c -
  mkdir -p assets/ai
  mv "$task_tmp/u2netp.onnx" "$task_model"
fi
npm run build
npm test
