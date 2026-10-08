# Developer build instructions

These instructions are for developers. The Windows download needs no development
tools or command line.

Use Node.js 22.12+ or 24 and npm. Dependencies are pinned by package-lock.json.

```sh
npm ci
npm run dev
```

The dev server is on port 5173. It exercises the editor in a browser; native file
dialogs, Windows clipboard and remembered filesystem output folder use Electron:

```sh
npm run build
npm start
```

On Windows, build both a normal installer and self-contained portable launcher:

```sh
npm run package:win
```

Outputs go to `release/`. The NSIS installer is per-user, includes modern wizard
pages, project associations, shortcuts and an uninstaller generated on the target
machine. The custom script allows Linux cross-compilation without Wine. It installs
about 321 MB and leaves images, asset originals and user settings on uninstall.

The AI model is included at `assets/ai/u2netp.onnx`. Vite copies it, the original
demo assets, and the non-JSEP ONNX WASM runtime into the production bundle. The
model's SHA-256 is checked by the cloud setup script; provenance is documented in
THIRD_PARTY.md. There are no external CDN resources or runtime model downloads.

On this cloud machine, run `bash tools/setup-cloud.sh` to install pinned packages
and obtain checksum-verified Electron runtime archives through the provided HTTPS
proxy. This addresses environments in which Electron's postinstall downloader
does not automatically use that proxy. Package with:

```sh
ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder \
  npm run package:win -- --config.electronDist=/workspace/.cache/electron/win32
```

`signAndEditExecutable: false` avoids Wine-based resource signing on Linux. The
installer and portable launchers use the original PaintPlus icon, and installed
shortcuts use `resources/icon.ico`. The inner Electron application executable
retains its upstream executable icon; the window uses PaintPlus's icon.
Production signing is not configured. Add a certificate through a secure build
system if releasing publicly; never commit certificate credentials.

## Tests

```sh
npm test
npm run test:ui
```

The UI configuration uses `/usr/bin/chromium` on this Linux machine. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` for another system, or install Chromium through
Playwright. Playwright starts the Vite server automatically when needed. Node tests use @napi-rs/canvas to
exercise real raster operations. UI tests use real pointer/keyboard events, with
fixture setup and state inspection through the document model.

For desktop QA on the cloud machine, start the locally extracted Xvfb on display
99 using `tools/start-display.sh`; then run `node tools/desktop-qa.mjs`.
Container QA passes `--no-sandbox` only for the isolated Linux test process. The
Windows application does not ship a sandbox-disabling option in its launch path.

`tools/desktop-qa.mjs` captures actual Electron screenshots, an example flattened
PNG and an editable example project. `--desktop-test` performs native clipboard,
Quick Save collisions and local CPU inference, writing its result in `/tmp`.
It is a developer check, not a background service or startup registration.
`node tools/desktop-native-qa.mjs` checks native folder metadata/thumbnails,
atomic save/overwrite, and both cancellation and success of save-before-close.

Project details: PROJECT_FORMAT.md. Architecture: ARCHITECTURE.md. Current test
evidence and outstanding Windows checks: TESTING.md and LIMITATIONS.md.

`node tools/packaged-qa.mjs` runs from a copied ASAR installation in a directory
containing spaces and Unicode, tests startup/drawing/clipboard/Quick Save/offline
AI, captures a screenshot and records startup diagnostics. The Windows CI workflow
executes the normal installer, checks that installed payload, launches the portable
EXE, then uninstalls while checking that a user project remains. CI evidence is
published to a unique windows-evidence branch; main is not changed by CI.

When a `paintplus-candidate-<version>` branch supplies `downloads/Candidate.json`,
CI verifies the current application's Git input digest and both EXE hashes, then
tests those exact files. If there is no candidate, CI tests its native build.
A mismatched candidate fails validation instead of testing stale app code.
Build commands disable automatic release publishing; downloads are published
explicitly after validation.
