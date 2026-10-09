# Remaining limitations — 1.0.2

These are differences or unverified areas, rather than completed acceptance claims.

- **Exact Microsoft assets are unfinished (request 3).** The ribbon has colored
  Paint-style SVG redraws, tighter spacing, adjacent selection buttons and a
  bordered palette. Icons and custom tool cursors are original approximations,
  not the exact Windows 10 Paint resource files. The palette and ribbon are not
  pixel-for-pixel clones of Microsoft's UI. The supplied reference screenshot
  was used for visual comparison. Text controls, layers, assets and AI necessarily
  add controls to that layout; narrow windows scroll the ribbon horizontally.
- **Laptop-specific verification is outstanding.** The exact Setup and Portable EXEs passed on Windows Server 2022
  (10.0.20348) and Server 2025 (10.0.26100), including the installed packaged app.
  They do not prove operation on the user's Windows 10 Home or Windows 11 Home
  laptop. High-DPI/multiple-display behavior, touch/stylus input and long sessions
  still need testing on that hardware. Software rendering and startup diagnostics
  are included to address the previous blank-window failure.
- **Unsigned installer and app.** No signing certificate or SmartScreen reputation
  is included. See the installation instructions.
- **AI is local CPU U2NetP and remains imperfect.** Hard silhouettes, lower
  thresholds and working softness controls improve edge adjustment. Complex
  backgrounds, hair and overlapping subjects can still need manual cleanup.
  No manual mask painting or GPU inference is implemented. The confidence mask
  is retained during the refinement session, not stored in .paintplus files for
  later reopening; the resulting pixels are stored.
- **Paint fidelity:** Round brush bodies and pencil pixels are tested, but no
  pixel-for-pixel comparison with mspaint.exe covers every brush or shape.
  Calligraphy, spray, oil, crayon, marker and watercolor remain approximations.
  Diagonal/curved brush edges and rounded stroke ends can be antialiased.
- **Selection scope:** Pixel selections lift the active raster layer. They do not
  combine multiple raster layers into one selection. Image and text objects can
  be selected and grouped across layers. Groups do not have Photoshop effects,
  nested hierarchies, blend modes or masks. In trail mode opaque selection margins
  also stamp, matching normal opaque selection behavior; enable Transparent to
  ignore exact Color-2 pixels.
- **Text:** Font availability depends on the computer. Inline text supports whole
  box formatting, wrapping, re-editing and speech bubbles; it does not support
  mixed fonts/styles within one box, vertical writing or rich paragraph alignment.
  Editable text sits above its layer's raster paint until explicitly committed.
  Text auto-grows vertically, while the width is set by the drag/resize handles.
- **Library index:** It is a saved index, not a live filesystem watcher. New or
  moved source files need re-importing. Removing library entries or categories
  never deletes original files. Category renaming does not rename disk folders.
- **Memory and dimensions:** Up to 16,384px per side and 64 million pixels, subject
  to a conservative 512MB image allocation estimate. Undo/redo together retain
  up to 80 commands and 128MB. Oversized operations are rejected or, if too large
  for history alone, a notice explains that they cannot be undone. Browser caches
  and runtime allocations can add memory; this is not a total OS RAM bound.
- **Other missing classic commands:** invert selection, printing/print preview,
  scanner/camera acquisition, skew and textured shape outlines/fills. PNG/JPEG/
  BMP/WebP export works; animated GIF, TIFF, color profiles/CMYK and EXIF workflows
  are not independently verified. Save .paintplus to preserve editable state.

Screenshots come from the running packaged application. The example scene uses
original artwork; it is not a screenshot mockup.
