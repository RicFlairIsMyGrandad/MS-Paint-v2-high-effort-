# Validation of PaintPlus 1.0.5

100 Node tests and 107 Chromium workflows pass locally. New regressions cover
brush endpoint widths, all brush variants, opaque eraser preview, asset-layer
preferences, inline renaming, Color-2 display/export/project/merge consistency,
visibility outside undo/redo, original-source Lanczos resizing, scrolled paste
and growth, fixed bubble outline colour, contextual Text navigation, successive
objects, padded thin frames and hidden moving outlines. The production build passes.

The packaged Linux app passes those new interactions and startup, drawing,
rich text with stable pixels, local fonts/native clipboard, PNG/project saves,
collisions and offline AI. Renderer errors and external requests are empty.
Screenshots come from the running packaged application.

## Exact Windows download checks

[Workflow run 38624971626](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/38624971626) validates source
`3d2c2c9a82ae8a625850585a268d035132c11472`. Both runners installed the exact checksummed Setup EXE
and launched the exact Portable download, rather than only a development build.

| Runner | OS/kernel | Core tests | UI workflows | Installer/packaged/portable/uninstall |
| --- | --- | --- | --- | --- |
| windows-2022 | Windows Server 2022 Datacenter 10.0.20348 | 100 | 107 | Passed |
| windows-latest | Windows Server 2025 Datacenter 10.0.26100 | 100 | 107 | Passed |

Installed font catalogs: windows-2022: 126 families via GDI; windows-latest: 144 families via GDI.

Setup completed successfully. Desktop and Start-menu shortcuts and project
associations target the installed executable. Its copied ASAR installation,
in a path with spaces and Unicode, passed startup, software rendering, drawing,
exact brush tips, opaque eraser cursor, inline rename and asset preference,
Color-2 upper layers, visibility outside history, smooth resizing, scrolled paste,
bubble colours, contextual/successive text and shapes, thin frames, hidden moving
outlines, text/font/shadow changes, context menus and Color-2 cut layers,
native clipboard, saving and offline AI. Windows executable resources contain
seven palette icon resolutions and version 1.0.5 strings. No renderer errors or
external requests were recorded. Uninstall removed the application, shipped
helper and registry entry while preserving a user project.

Exact tested EXE SHA-256 values:

- `PaintPlus-Setup-1.0.5-x64.exe`: `10c2db8047f670a1ad7f0768fe1de16e385b3a66dc2ecdc35bbf3f70d9de1241`
- `PaintPlus-Portable-1.0.5-x64.exe`: `851f98df36e0e427612a709957d1b5a016381a4523ea25abcebfcc71fb9407ec`

Per-runner logs/JSON are retained under docs/windows-ci. The summary is
windows-test-evidence.json. Windows screenshots are under docs/screenshots;
larger chat/download screenshots come from the same version's Linux package.
Both executable archives and the portable inner payload pass integrity checks;
their application ASAR hashes match. Details are in packaging-integrity-1.0.5.json.

## Verification boundaries

Hosted Windows Server checks do not verify the user's particular Windows 10/11
Home laptop. High DPI, multiple displays, stylus input and long sessions remain
unverified on that hardware. Microsoft cursor resources, GDI glyph pixels and
every brush variant are not claimed identical. The installer is unsigned.
Other incomplete features are listed in LIMITATIONS.md.

Source ZIP/TXT exports verify original file contents and ZIP CRC. All downloads
have SHA-256 entries in downloads/SHA256SUMS.txt and are fetched back from their
public links before delivery.
