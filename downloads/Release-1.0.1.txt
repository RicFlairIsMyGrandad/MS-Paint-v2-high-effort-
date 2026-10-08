# PaintPlus 1.0.1

A user reported an entirely white window after installing 1.0.0 on a Windows 11
Home laptop. The exact failure on that machine has not been reproduced in this
Linux cloud workspace. This update changes the startup paths that differed
between the earlier desktop checks and the installed Windows application.

- Local resources are read using Electron's ASAR-aware filesystem with explicit
  HTML, JavaScript and WASM MIME types, instead of loading Windows file URLs
  through Chromium's file protocol.
- Windows uses software rendering by default for compatibility with older GPU
  drivers. This also matches the application's CPU-only AI mode.
- Loading status appears immediately. Failed scripts, rejected startup promises,
  missing assets, preload errors and stopped renderer processes are recorded in
  a local startup.log. A startup failure presents an error screen or dialog.
- Resize & Rotate preserves each object's existing transparency key unless the
  user explicitly changes its checkbox. Mixed selections retain individual keys.
- The right-click color eraser preserves existing alpha, skips invisible pixels
  and replaces exact Color-1 pixels along the entire square stroke path.
- Whole-canvas history counts retained source/layer canvases without double
  counting shared live references. Undo and redo are capped together, oversized
  commands are dropped, and large allocations have an image-memory preflight.
- Invalid layer drag data is ignored. A real drag/drop test confirms the sidebar
  updates automatically through the existing document-change callback.
- Corrupt saved preference/library entries are sanitized at startup.
- Fresh-checkout assets are prepared before Vite indexes the public directory.
- The installer uses native paths when compiled on Windows, avoids implicit
  release publishing during builds, and removes shipped helpers on uninstall.
- Raster undo closures retain tiles and the layer resolver, instead of retaining
  an obsolete full-size layer canvas after whole-image transformations.

The layer reorder allegation in the supplied review was not reproduced: its
document command already calls changedUI indirectly. The pasted-key allegation
is narrower than stated: a single unchanged Color-2 key was already preserved by
the initially checked checkbox. Changing Color 2 or selecting mixed keyed objects
did cause unintended changes, and those cases now have regression tests.

Both hosted Windows jobs passed using the exact downloadable Setup and Portable
EXEs. They verified installation, packaged startup, drawing, clipboard alpha, native
saving, offline AI, shortcuts, the project association command and uninstall.
All 35 core/resource and 36 UI regressions passed on both runners and Linux.
Full validation evidence is in TESTING.md.
CI uses a hosted Windows machine; it does not establish behavior on the user's
specific Windows 10 Home or Windows 11 Home laptops. If startup still fails,
the visible error identifies the local startup.log location. The default installed
profile is usually %APPDATA%\PaintPlus\startup.log. No logs are uploaded by the app.
