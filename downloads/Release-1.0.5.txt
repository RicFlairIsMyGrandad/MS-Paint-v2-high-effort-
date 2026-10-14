# PaintPlus 1.0.5

This release addresses the latest palette, brush, layer, text and selection feedback.

| Request | Result |
| --- | --- |
| 1a | Round tips no longer paint outside the selected width. All brush variants constrain horizontal stroke coverage to that width; 1/3/5/7/9px round tips are checked with real pointer strokes. Soft edge pixels remain inside the footprint. |
| 1b | The eraser hover square is filled with Color 2, with its outline outside the square. It does not alter the canvas until pressed. |
| 2a | An “Insert assets on their own layer” checkbox sits below the layer list. It shares the persisted Settings preference and controls actual insertion. |
| 2b | Double-clicking layer names or eyes does not rename. Right-click → Rename layer replaces the name with an inline input. Enter/blur saves, Escape cancels; refresh preserves the input. Renaming remains undoable. |
| 3 | Exact Color-2 pixels on upper rasters and floating objects reveal layers underneath. The bottom canvas stays opaque. Preview, PNG export, merge and commit agree; editable projects store the key colour. Imported alpha remains supported. |
| 4 | Eye visibility has no undo command and does not clear redo. Per-layer visibility survives restoration of earlier edit snapshots, including deletion/creation undo. |
| 5 | Floating image and pixel-selection resize previews use Lanczos filtering from retained original pixels, rather than an unfiltered stretch. Commit/export preserve smooth results. Nearest neighbour remains available. Word-identical output is not claimed; very large previews use a bounded-memory browser fallback. |
| 6 | Paste uses the upper-left visible canvas position, accounting for zoom and scroll. Canvas growth includes that offset and remains one undo operation. Asset double-click insertion still starts at the canvas origin. |
| 7 | Bubble outline colour is captured from Color 1 when the text box is created. Later primary-colour changes format text and retain the outline colour. |
| 8a, 8b | Choosing Text keeps Home visible until a text box exists. Confirming outside returns to Home with Text selected. A simple outside click confirms without creating an empty replacement box. |
| 9 | An outside drag confirms the current pixels/shape/text and begins another using the same active tool. Empty text cancels cleanly; rectangular and free-form selections continue with their own tools. |
| 10 | The selection frame has a thin physical-pixel dashed line and compact four-pixel handles, padded five screen pixels away from content where canvas edges permit. The inline editor adds no duplicate border. Zoom retains frame/handle screen dimensions. |
| 11 | The selection frame, resize markers and rotate marker hide immediately on move mouse-down and return on release. Text remains editable while dragging its border. |
| 12 | A large transparent wooden painter's palette replaces the easel in the title bar, Windows executable resources and shortcuts. Seven ICO resolutions are included. |

The application retains local offline AI, Windows software rendering and startup
diagnostics. Exact Microsoft cursor resources, every brush/GDI pixel and the
user's laptop remain verification boundaries. Printing, skew, live folder
watching and manual AI mask painting remain unavailable. See LIMITATIONS.md
and TESTING.md for full details and final Windows validation evidence.

Validation: 100 core tests and 107 UI workflows passed locally and on both hosted
Windows runners. [Run 38624971626](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/38624971626) installed and launched
the exact Setup download, checked the new editor features, fonts/clipboard/AI,
launched Portable and verified uninstall while preserving a project. Both
archives contain the same application and pass integrity checks. TESTING.md
contains logs, hashes and the verification boundaries.
