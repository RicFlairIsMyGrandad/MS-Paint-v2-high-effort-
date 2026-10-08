# Validation of PaintPlus 1.0.0

Validation was performed in the Linux cloud workspace on 8 October 2026.
The Windows build is an x64 cross-build, not a claim of native Windows testing.

## Automated checks

- **29 Node core tests** exercise actual raster canvases: integer pencil strokes,
  brush continuity at multiple widths, erase and fill, selected-layer painting,
  no layer creation for 100 strokes, locked layers, alpha, source preservation,
  original-size insertion, color-key selection, resizing/cropping, layer merges,
  grouped objects, undo/redo across metadata changes, project round trips,
  premultiplied-alpha Lanczos and nearest-neighbour resampling, and BMP encoding.
- **31 Chromium UI integration tests** use real pointer and keyboard events
  together with fixture setup and document assertions. They cover brush/shape
  choices, all tool cursors, canvas edge handles, 100 separate drawing gestures,
  active-layer behavior, double-click asset insertion at several zoom levels,
  rotated handles, exact/percentage resizing, invalid input and Cancel, free-form
  masks, two-bend curves, polygons, grouped transforms, layer controls, panels and
  shortcuts persistence, editable text, copy/paste, project reopening, and actual
  exported PNG/JPEG/BMP/WebP bytes. The AI tests execute the bundled CPU model on
  both an object and a raster layer and check that no external request is needed.
- The full **cloud setup script** was executed successfully: clean lockfile
  dependency installation, verification of official runtime and model hashes,
  extraction, production build and core tests. The display startup script was
  also executed and used for desktop checks.

Results are recorded in core-test-results.txt, ui-test-results.json and
desktop-test-results.json and desktop-extra-test-results.json. Tests that failed during development were corrected
and rerun. A final UI run interrupted by development-server shutdown was discarded;
the server was restarted before the final complete run.

## Actual desktop checks

The application was launched using Electron 38.2.0 and its production
`paintplus://app/` resource protocol with an isolated test profile. Checks include
native PNG clipboard round trips, native filesystem Quick Save with collision
suffixes, writing an editable project, and real CPU background removal loading
the local model and WASM runtime. These smoke checks passed.

Additional native checks passed for metadata-only folder indexing, 160 px
thumbnail IPC, normal save and atomic overwrite with no leftover temporary file,
cancelling a close-time Save As while retaining the dirty document/window, and
successfully writing an editable project before closing. Native dialog responses
were supplied by the test harness; the save and close code paths were real.

The example scene was opened in that running desktop application, its asset
thumbnails decoded, the numerical Resize and Rotate dialog opened, and screenshots
captured directly from its window. No screenshot mockup was substituted.
`screenshots/paintplus-final.png` includes the dialog and
`screenshots/paintplus-desktop.png` shows the editor unobstructed. The scene was
also exported as PNG and saved as Example.paintplus. No renderer page errors
were observed during this desktop capture.

Manual visual review checked ribbon groups, palette, rulers, white handles,
left asset thumbnails, right layer thumbnails, shortcuts, dialog geometry and
the example canvas against the attached PaintPlus concept screenshot. The artwork
and icons are original, and the UI is a close interpretation rather than a
pixel-identical copy. The separate classic Paint and issue-reference screenshots
mentioned in the specification were not attached.

## Windows build inspection

NSIS installer and portable launchers contain the Windows x64 Electron payload.
The inner executable is a PE32+ Windows GUI x86-64 binary. The application ASAR
contains the main process, isolated preload, bundled renderer, original demo
assets, U2NetP model, WASM runtime and license notices; it does not depend on a
development node_modules directory. Packaging completes without Wine, using the
custom per-user NSIS wizard. SHA256SUMS.txt identifies the exact downloads.

**Still outstanding:** execute installer/portable on Windows 10 and Windows 11,
verify shortcuts, project associations, uninstall, Windows clipboard alpha,
high-DPI/multiple-display layout, touch/stylus input and long sessions on a laptop.
No native Windows runner is available here. Do not interpret Linux desktop tests
or archive inspection as proof of those checks. Other known feature differences
are listed in LIMITATIONS.md.
