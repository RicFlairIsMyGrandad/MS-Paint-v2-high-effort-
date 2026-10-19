# Remaining limitations — 1.0.9

These are differences or unverified areas, rather than completed acceptance claims.

- **Microsoft resources are not copied.** The ribbon has colored
  refined SVG icons, tighter spacing, adjacent selection buttons and a
  bordered palette. Icons and custom tool cursors are original approximations,
  not the exact Windows 10 Paint resource files. The palette and ribbon are not
  pixel-for-pixel clones of Microsoft's UI. The supplied reference screenshot
  was used for visual comparison. Text controls, layers, assets and AI necessarily
  add controls to that layout; narrow windows scroll the ribbon horizontally.
- **Laptop-specific verification is outstanding.** Native release checks and their exact hashes are recorded in TESTING.md.
  Hosted Windows checks do not prove operation on the user's Windows 10 Home or Windows 11 Home
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
- **Layer transparency:** Check Use Color 2 as transparency for the older exact-key behavior, or uncheck it for standard alpha compositing. Keyed mode hides intentionally painted Color-2 matches on upper layers. Alpha mode preserves them and erases upper layers to transparent pixels; the bottom paper canvas still erases to Color 2. Projects store the mode, and older files without it keep keyed mode. Choosing transparent Color 2 disables its previous RGB key and stores that choice in the project. An object explicitly given Transparent Selection still has its own independent colour key, even in alpha mode.
- **Photo resizing:** Lanczos improves smoothness but is not claimed pixel-identical to Microsoft Word. Previews needing over 192MB of estimated filter buffers fall back to the browser's high-quality sampling; exports still use the worker. Original source pixels remain available while the object is floating.
- **Group editing:** A group header activates members without pre-selecting canvas content.
  Manually select a rectangular/free-form region to transform it on all visible,
  unlocked members. Brush/pencil/eraser strokes and flood fill also link across
  those members. Choose Select or Free-form Select after choosing the header
  to select the same canvas region on all members. Click a member row to edit it
  individually. Raster painting or area editing renders participating floating objects to
  pixels. Undo restores their original editable objects; cancelling an unchanged
  selection or a no-op fill also restores them without a history entry. Cut, Copy, Delete, resize, rotate
  and flip operate on all selected regions while preserving separate layers.
  New text/shapes/assets are inserted on the active layer; grouping does not
  duplicate new objects on every member. Layer properties such as visibility,
  locking and naming remain per-layer. Groups have no nested hierarchies,
  blend modes, effects or masks. Locked/hidden members are excluded from linked
  painting and selection. Stack order, including nonadjacent members, is preserved.
  In trail mode opaque selection margins also stamp; enable Transparent to
  ignore exact Color-2 pixels.
- **Text:** Mixed font/point-size/colour/style runs, favorites and re-editing are
  implemented. Font availability depends on the computer; six third-party Latin font families and the original Grade Wobble approximation
  are bundled. Other characters use installed fallback fonts. Install fonts
  before launching PaintPlus; the catalog is cached for that session. If GDI
  discovery fails, registry display names provide a fallback and custom font
  aliases may differ from GDI family names. Paragraph alignment,
  per-character baseline offsets and complex RTL/advanced typesetting are not
  independently verified. Source pixels are retained in older projects until
  their text is edited, when the new renderer regenerates them. Font substitution
  can change edited text when an original font is unavailable. Editable text sits
  above its layer's raster while selected. Default outside-click confirmation
  converts it to pixels; save an editable project beforehand. Bubble corners retain their pixel radius; new text bubbles have smaller tails,
  width/attachment sliders and a draggable tip below the body (up to 1,024px
  beyond its edges). Older projects keep their legacy tails until adjusted.
  New text backgrounds use Transparent, White (RGB 254/255/255), or Custom;
  horizontal/vertical bubble padding are independent. Older Color-2-following
  boxes retain that behavior until a new background option is chosen. Keyed
  layer mode still hides fills matching Color 2 on upper layers; choose alpha
  layer mode to retain those colours. Shadows follow the silhouette. The generic callout
  shape remains a proportional geometric shape.
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

- **Pointing-hand tools:** The shaft uses the chosen primary colour and width; the
  original hand silhouette stays black. Hand-drawn wobble is deterministic,
  rather than a recorded human stroke. Curves use two bend points like the existing
  curve tool. The tail handle and these shapes are editable while floating;
  confirming them into raster pixels ends that editability.

- **Magic wand:** Binary, four-connected pixel masks support tolerance, all-match
  sampling, add/subtract/intersect, inversion, move/resize/rotate and Delete.
  No feathering, antialiased selection edges, Refine Edge, subject recognition or
  separate saved wand masks are implemented. A confirmed area edit stores its
  pixel result; an unchanged cancelled selection restores the original objects.
  Sample all layers determines the matching mask; lifted pixels still come from
  the active layer or selected group members, not from a merged copy of every layer.
- **Transparent paint:** The checkerboard swatch clears alpha in raster Brush,
  Pencil, Eraser and Fill on either mouse button. Vector/text transparent ink is
  invisible ink, not an editable negative mask erasing older content. The bottom
  layer can now contain real alpha when explicitly painted with transparency.
  PNG/WebP can preserve it or use the chosen white matte; JPEG/BMP use white.
  Project files preserve RGBA regardless of this image-export preference.
- **Custom palette:** Eight ribbon slots are session-only. The dialog retains its
  separate sixteen saved slots. Colour 1/2 transparent paint choices are session
  state, except transparent Color 2 is also stored in projects because it changes
  layer-key compositing. Opening earlier projects defaults that field to false.
- **Grade Wobble:** A first original approximation based on the supplied word
  sample, not a perfect reconstruction or a trained handwriting model. Missing
  characters are designed. It includes A–Z, a–z, digits, ASCII punctuation, £ and
  typographic quotes/dashes. A full sample sheet with three natural examples per
  character would improve fidelity. There are no contextual glyph alternates,
  automatic font training or a font-creation UI in this version. The font can be
  used in PaintPlus and installed separately from its TTF download.
