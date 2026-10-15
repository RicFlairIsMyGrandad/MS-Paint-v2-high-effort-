# Validation of PaintPlus 1.0.6

128 Node tests and 127 Chromium workflows pass locally. New regressions cover
all zoom levels at 1/1.25/2 device-pixel ratios, scrolling ruler alignment,
rounded single-pass brush tips, real raster layer groups and individual members,
pixel-snapped selections, safe moved-selection deletion, selection outside
history (including saving and redo), black eraser cursor without a halo,
adjustable speech-bubble tails with a draggable tip, straight/curved pointing
hands with optional wobble, single-selection paste and exact quarter-turn pixels
without repeated-rotation drift. Prior editor, file, text and AI checks also pass.
Legacy bubble-project tail controls and wobble changes on reselected hand lines
are also covered. The production build passes.

The packaged Linux app passes those new interactions and startup, drawing,
rich text with stable pixels, local fonts/native clipboard, PNG/project saves,
collisions and offline AI. Renderer errors and external requests are empty.
Screenshots come from the running packaged application.

## Exact Windows download checks

[Workflow run 38668076059](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/38668076059) validates source
`d38676e8a63d16b78a7c559253dc67fbe6e7cfec`. Both runners installed the exact checksummed Setup EXE
and launched the exact Portable download, rather than only a development build.

| Runner | OS/kernel | Core tests | UI workflows | Installer/packaged/portable/uninstall |
| --- | --- | --- | --- | --- |
| windows-2022 | Windows Server 2022 Datacenter 10.0.20348 | 128 | 127 | Passed |
| windows-latest | Windows Server 2025 Datacenter 10.0.26100 | 128 | 127 | Passed |

Installed font catalogs: windows-2022: 126 families via GDI; windows-latest: 144 families via GDI.

Setup completed successfully. Desktop and Start-menu shortcuts and project
associations target the installed executable. Its copied ASAR installation,
in a path with spaces and Unicode, passed startup, software rendering, drawing,
accurate rulers, rounded brush tips, real raster layer groups, individual members,
pixel-snapped selections, safe deletion, selection outside history, black eraser
cursor without a halo, adjustable bubble tails, both pointing-hand tools,
single-selection paste, crisp quarter turns, inline rename and asset preference,
Color-2 upper layers, visibility outside history, smooth resizing, scrolled paste,
bubble colours, contextual/successive text and shapes, thin frames, hidden moving
outlines, text/font/shadow changes, context menus and Color-2 cut layers,
native clipboard, saving and offline AI. Windows executable resources contain
seven palette icon resolutions and version 1.0.6 strings. No renderer errors or
external requests were recorded. Uninstall removed the application, shipped
helper and registry entry while preserving a user project.

Exact tested EXE SHA-256 values:

- `PaintPlus-Setup-1.0.6-x64.exe`: `7d73455d854f1faac73154a49d491d301573612a8d4320f5f042a5fc6ca3b2db`
- `PaintPlus-Portable-1.0.6-x64.exe`: `28c565ab893c149d425025a38b5026fe4a83eb84ef114bdeefc70aac711e301c`

Per-runner logs/JSON are retained under docs/windows-ci. The summary is
windows-test-evidence.json. Windows screenshots are under docs/screenshots;
larger chat/download screenshots come from the same version's Linux package.
Both executable archives and the portable inner payload pass integrity checks;
their application ASAR hashes match. Details are in packaging-integrity-1.0.6.json.

## Verification boundaries

Hosted Windows Server checks do not verify the user's particular Windows 10/11
Home laptop. High DPI, multiple displays, stylus input and long sessions remain
unverified on that hardware. Microsoft cursor resources, GDI glyph pixels and
every brush variant are not claimed identical. The installer is unsigned.
Other incomplete features are listed in LIMITATIONS.md.

Source ZIP/TXT exports verify original file contents and ZIP CRC. All downloads
have SHA-256 entries in downloads/SHA256SUMS.txt and are fetched back from their
public links before delivery.
