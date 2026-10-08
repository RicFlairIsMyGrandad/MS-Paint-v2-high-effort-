# Validation of PaintPlus 1.0.1

The original laptop's white-screen failure has not been reproduced on that
hardware. Version 1.0.1 changes Windows startup resource loading and uses software
rendering by default. It also presents startup diagnostics instead of a silent
blank editor. This report distinguishes executed checks from remaining checks.

## Automated regression checks

- **35 Node tests passed:** 32 real-canvas/document/history tests and 3 packaged
  resource tests. Coverage includes integer pencil continuity, painting on the
  active layer, locked layers, erasing and exact-color replacement, alpha,
  selections, source preservation, transforms, grouping, merging, undo/redo,
  project round trips, Lanczos/nearest-neighbour resampling and BMP encoding.
  New cases check full-path color replacement without changing alpha, combined
  undo/redo limits, oversized commands, retained canvas accounting and rejection
  of large allocations before changing the document. Resource tests cover
  Windows drive letters, ASAR paths, spaces/Unicode, explicit JavaScript/WASM
  MIME types, path containment and diagnostic 404 responses.
- **36 Playwright UI tests passed on Linux Chromium.** The existing pointer,
  keyboard, selection, transform, panel, shortcut, project, export and local AI
  checks are joined by regressions for transparency when Color 2 changes,
  mixed transparency keys, real layer drag/drop, transparent-layer color erasing,
  and a visible startup error when the application module cannot load.
- Tests use real canvases and real pointer/keyboard events, with fixture setup
  and state inspection. AI checks execute the bundled CPU model without external
  downloads. Missing-script startup errors are deliberately simulated.

Local results: core-test-results.txt and ui-test-results.json. The Windows
workflow runs these same suites from a fresh checkout on two hosted OS images.
A fresh-checkout image-serving failure discovered in Windows CI was corrected
by preparing public assets before Vite indexes that directory.

## Actual packaged desktop checks

`tools/packaged-qa.mjs` launches the packaged executable and asserts
`app.isPackaged` and a resource path ending in `app.asar`. It copies the
installation into a path containing spaces and Unicode and uses a fresh profile.
It verifies:

- First launch reaches the ready editor and asset thumbnails decode.
- A real pointer stroke changes the expected canvas pixel.
- Native clipboard PNG round trips preserve opaque, transparent and half-alpha
  pixels, as well as normal copy/paste dimensions.
- Native Quick Save writes valid PNG bytes and preserves existing files using
  collision suffixes. Both saved images have the expected bytes.
- An editable project is written to disk and parses with its layers.
- Actual CPU background removal loads the bundled U2NetP model and WASM runtime
  and produces a transparent background.
- The example scene and Resize & Rotate dialog render for actual window captures.
- The local log contains renderer-ready and no resource-error entry; no renderer
  page errors or HTTP(S) requests occur during these checks.

The packaged Linux checks passed. See packaged-linux-test-results.json and
screenshots/packaged-linux.png / packaged-linux-dialog.png. Linux container
launches use --no-sandbox for the isolated test process. Windows launches use
the normal sandbox configuration and do not pass --disable-gpu: the application
itself chooses software rendering, which the harness verifies.

Earlier 1.0.0 Linux native dialog tests also exercised folder indexing, thumbnails,
atomic overwrite and save-before-close cancellation/success. Their archived
results remain in desktop-extra-test-results.json; they are supplemental evidence,
not a substitute for the 1.0.1 packaged Windows checks.

## Windows installation and release evidence

Both jobs in [GitHub Actions run 37837045680](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/37837045680)
passed, testing application source revision
`927db8f44beb6dfffe1081b6b14c5e6c7021cbca`.

| Native runner | OS kernel | Core/resource | UI | Exact EXE installation and desktop checks |
| --- | --- | --- | --- | --- |
| Windows Server 2022 Datacenter | 10.0.20348 | 35 passed | 36 passed | Passed |
| Windows Server 2025 Datacenter | 10.0.26100 | 35 passed | 36 passed | Passed |

The actual Setup installed successfully on both runners. Desktop and Start menu
shortcut targets and the registered project command were correct. Both installed
ASAR launches passed drawing, native clipboard alpha, saved PNG/project bytes,
Quick Save collisions and offline CPU AI. Both actual Portable EXEs launched and
passed native smoke checks. Uninstall removed the app, shipped helper and uninstall
entry while retaining a user project. The software GPU status was verified. There
were no renderer errors, resource errors or external HTTP(S) requests in packaged QA.

The exact tested download SHA-256 values are:

```text
5e04b1151a58a8e4d9564ac67be2a7557819054afd87221a92a6866e0b515c98  PaintPlus-Setup-1.0.1-x64.exe
cf96f94752306b319d0dc00a4e87aa9dc2964ee5b5366532ac9fd811a2a5ffa6  PaintPlus-Portable-1.0.1-x64.exe
```

See windows-test-evidence.json for the summary and windows-ci/windows-2022 /
windows-ci/windows-latest for full runner metadata, core/UI/build logs and structured
installation, packaged, portable and uninstall results. CI also publishes isolated
windows-evidence branches; those branches do not modify main. The supplied screenshots
packaged-windows.png and packaged-windows-dialog.png are actual installed-package
captures from the Server 2022 run.

The preview downloads PaintPlus-Screenshot.png and PaintPlus-Editor.png use the
1680 × 980 packaged Linux captures. The hosted Windows desktop is 1024 × 768;
its separate captures show the app's smaller-window layout and scrolling ribbon.

The workflow builds both formats natively. When a matching versioned candidate
exists, it verifies the application's Git input digest and downloads/checksums
those exact EXEs for execution. That lets the Windows job test the same bytes
provided to the user, including a Linux cross-compiled installer.

It executes Setup /S, checks the installed payload, desktop and Start menu
shortcut targets and project association command, launches that installed
payload through packaged QA, then launches the actual portable wrapper.
Uninstall checks that the application and shipped helper are removed, the
uninstall registry entry is removed, and a user project remains.

## Visual review and outstanding checks

Screenshots are captured from running desktop windows. The original demo artwork
and icons are included in the source; no screenshot mockup is substituted.
Visual review checks the ribbon, palette, rulers, transform handles, asset/layer
panels, shortcut grid and numerical transform dialog against the supplied concept.
The layout is a close interpretation, with original artwork. Separate classic
Paint and brush-comparison screenshots mentioned in the prompt were not supplied.

**Still outstanding:** retry on the user's Windows 10 Home and Windows 11 Home
laptops, especially the machine that showed a white window; high-DPI and multiple
monitors; touch/stylus input; SmartScreen reputation; long sessions and very large
multi-layer images on a low-memory laptop. Hosted Windows Server checks do not
prove behavior on those specific Home-edition machines. The installer is unsigned.
See LIMITATIONS.md for incomplete classic Paint features and other known limits.

If startup still fails, the visible error identifies the local startup.log path,
usually %APPDATA%\PaintPlus\startup.log. The app never uploads that log.
