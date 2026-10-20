# Validation of PaintPlus 1.0.10

All 162 core tests and 175 browser workflows pass locally and on both hosted
Windows runners. No UI cases are skipped, flaky or unexpected. The copied,
packaged Linux application also passes all new and retained native checks.

During simultaneous Linux packaging, the 100-stroke UI stress case exceeded its
45-second timeout once. The final complete browser suite was rerun after packaging
with that same timeout and no retries. The stress case passed in that run.

The new coverage checks that wand controls stay hidden until an area is selected,
appear last on the far right of Home without moving earlier groups, show all
three tolerance digits, and hide on deselection. Pointer edge/corner resizing,
Undo/Redo and normal UI refreshes preserve manually typed canvas dimensions;
status reports actual dimensions. At 1024px and 1280px widths, Mouse writing, AI
Remove Background and Settings remain accessible in the scrollable Home ribbon.
The canvas properties dialog has independent
fields and applies its own entered values.

Mouse writing tests exercise the actual supplied PNG-derived atlas: 95 sampled
characters and 285 variants. Alpha extraction removes template guides without
curve fitting, native-size rendering retains each alpha sample, and 2x scaling
duplicates pixels without smoothing. Native desktop keyboard tests include
multiline entry, Enter, Backspace and deletion. Negative spacing, chosen colour,
size, stable character choices, Shuffle of both variants and 0–X lifts, and exact
Shuffle Undo/Redo are checked. Projects retain the actual atlas, text, choices
and pixels; local import rejects blank/resized/malformed samples. Existing
brush, layer/group, text, alpha, ruler, save/export and offline AI tests remain.

## Exact downloadable Windows executables

[Workflow run 39351224677](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/39351224677) validates source `726ff90d98006ed64ce09a1f60e90136559b9cbf`.
Both jobs install the exact checksummed Setup candidate, verify its shortcuts
and project association, launch and exercise the installed application, launch
the exact Portable candidate, then uninstall while retaining a user project.

| Runner | OS/kernel | Core tests | UI workflows | Install/app/portable/uninstall |
| --- | --- | --- | --- | --- |
| windows-2022 | Windows Server 2022 Datacenter 10.0.20348 | 162 | 175 | Passed |
| windows-latest | Windows Server 2025 Datacenter 10.0.26100 | 162 | 175 | Passed |

Installed app tests also launch a copied ASAR from a path containing spaces and
Unicode, exercise native clipboard and system fonts, save PNG/project files,
check collision handling, and run the bundled offline AI model. All new lettering,
Shuffle, wand and typed-canvas-field checks run inside the installed ASAR.
Both Windows font catalogs use GDI. Renderer errors and external HTTP requests
are empty. GPU compositing is disabled for Windows startup compatibility.

Both EXE archives and the portable inner archive pass integrity checks. Setup,
Portable and the tested Linux build contain the same application ASAR. The model
and seven existing outline-font resources are checked, along with the actual
user glyph data in the compiled application. The pixel atlas has 95 characters
and 285 variants; its source checksum and extraction provenance are included.

Exact tested executable SHA-256 values:

- `PaintPlus-Setup-1.0.10-x64.exe`: `6575553481a93adadf56595488c0d72fd3b5d76871ed49b8e9d04b53b06ee69e`
- `PaintPlus-Portable-1.0.10-x64.exe`: `127f9b3f5f5f00e7ef5123e50d026b3f4435e551fab23d053ef7c5edb6ee9666`

Per-runner results/logs are in docs/windows-ci. windows-test-evidence.json records
the source, run and tested EXE hashes. packaging-integrity-1.0.10.json records the
archive/ASAR/model/font/pixel-atlas checks. Screenshots come from the running
packaged application, including its Lettering ribbon. Public downloads are fetched
and checked against the published manifest before delivery; the source ZIP CRC,
source bytes and PNG/font/PDF files are verified.

## Remaining boundaries

Mouse writing uses the supplied individual glyphs with one size/colour per box.
It does not infer joined word shapes or invent missing characters. Unsupported
characters show a placeholder and a ribbon notice. Fractional enlargement or
reduction changes the pixel pattern; whole-number enlargement preserves it most
faithfully. Confirming a box to raster pixels ends its text editability; save an
editable project while the box is still editable to retain it. The earlier
Grade Wobble outline approximation remains a separate normal Text font.

Wand feathering/Refine Edge and subject recognition remain unimplemented. See
LIMITATIONS.md for other boundaries. Hosted Windows Server checks do not establish
behavior on the user's particular Windows 10 Home or Windows 11 Home hardware.
High DPI, multiple displays, touch/stylus and long hardware sessions remain
unverified there. The installer is unsigned.
