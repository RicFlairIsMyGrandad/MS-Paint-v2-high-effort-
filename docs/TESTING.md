# Validation of PaintPlus 1.0.9

All 152 Node tests and 164 Chromium workflows pass locally.
Both hosted Windows runners pass the complete 152-test core suite and 164 browser
workflows. No Windows UI cases are skipped, flaky or unexpected. Production builds,
installed ASAR checks and the actual Portable launch pass.

New checks verify picker return after either button, all tool choices confirming
and deselecting existing content, scrollbars retaining pixel selections and active
text editing, eight session-only palette slots, the transparent swatch on Color 1/2,
true alpha brush/pencil/fill/eraser output and one-step undo. Transparent Color 2
cannot retain a hidden RGB layer key and is retained by projects. PNG/WebP alpha
or white matting changes only the output; project pixels remain unchanged.

Magic wand tests cover tolerance, contiguous versus all matches, active/all-layer
sampling, holes, Shift add, Alt subtract, Shift+Alt intersect, inversion, safe
movement/Delete, Shift-resize handles in Add mode, flipping and whole-canvas
Ctrl+A. Shortcut tests cover both banks, Shift preview, flip/rotate, asset-layer
toggling, saved mappings and inactive shortcuts while typing. Grade Wobble is
loaded from its bundled TTF and tested for case, size, colour and editable project
reopening. Existing image/text/group/layer/ruler/AI regressions remain.

The packaged Linux app passes the final new cases and native clipboard, fonts,
PNG/project saves, collision handling and offline AI. Renderer errors and external
requests are empty. Linux and Windows ASAR SHA-256 values match. The font TTF and
specimen/template PDFs are separate downloads and included in the source ZIP.

## Exact downloadable Windows EXEs

[Workflow run 39316173894](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/39316173894) validates source `ff6bb6c91171d8cad8293b6a656a711d9c55304e`.
It installs the exact checksummed Setup download and launches the exact Portable
EXE on both runners. This includes installed shortcuts and project associations.

| Runner | OS/kernel | Core tests | UI workflows | Install/packaged/portable/uninstall |
| --- | --- | --- | --- | --- |
| windows-2022 | Windows Server 2022 Datacenter 10.0.20348 | 152 | 164 | Passed |
| windows-latest | Windows Server 2025 Datacenter 10.0.26100 | 152 | 164 | Passed |

The installed ASAR is also copied to and launched from a path containing spaces
and Unicode. Native checks exercise the transparent swatch, real-alpha paint and
undo, picker return, wand masks/modifiers/handles and safe Delete, shifted transform
shortcuts, alpha/white exports and Grade Wobble, alongside the existing clipboard,
text/shapes, saves, startup/software rendering, system fonts and offline AI checks.
Both installed font catalogs use GDI. Uninstall removes shipped files, shortcuts
and registry entries while preserving a user project. No renderer errors or
external HTTP requests are recorded.

Both EXE archives and the portable inner payload pass 7-Zip integrity checks.
They contain the same ASAR with seven bundled font families (six WOFF2 plus the
original Grade Wobble TTF), the checked local model and 1.0.9 resources.

Exact tested download SHA-256 values:

- `PaintPlus-Setup-1.0.9-x64.exe`: `69ba8940d14414c1581a1ec15b42a52749f077c3c18ee37a7e8bda7a356ab455`
- `PaintPlus-Portable-1.0.9-x64.exe`: `54300ca1caef437261c5fca526e49ac30a6127dcbfb90a35a4800f9a3bb95ed6`

Per-runner logs/JSON are under docs/windows-ci. windows-test-evidence.json records
the run/source/checksums; packaging-integrity-1.0.9.json records the archive and
model/font hashes. Screenshots come from the running packaged app. Public downloads
are fetched and matched against downloads/SHA256SUMS.txt before delivery; the source
ZIP CRC and its source bytes, the TTF and both PDFs are checked as well.

## Boundaries

Grade Wobble is an original approximation from an incomplete sample. Missing
characters are designed; no exact reconstruction, training or contextual alternates
are claimed. A complete character sheet is needed for closer matching.
The wand uses hard, four-connected pixel masks. Feathering, Refine Edge and automatic
subject recognition are not implemented. Raster transparent paint is an eraser;
transparent vector/text ink does not create an editable negative mask. See
LIMITATIONS.md for other remaining features and memory/history bounds.

Hosted Windows Server checks cannot establish behavior on the user's particular
Windows 10 Home/Windows 11 Home hardware. High DPI, multiple displays, touch/stylus
and long sessions remain unverified on those machines. The installer is unsigned.
