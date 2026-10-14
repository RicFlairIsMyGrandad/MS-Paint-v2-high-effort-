# Validation of PaintPlus 1.0.4

87 Node tests and 89 Chromium workflows pass locally. New regressions cover
visible brush caps, exact free-form previews, Color-2 erasing/deletion and cut
into new layer, stable visibility clicks, shared transformation handles,
outside confirmation, text Enter/Delete handling, two-digit/fractional font
sizes, dropdowns, scaled underlines with descender gaps, fixed bubble geometry,
grey shadows and example-project save/reopen. The production build passes.

The packaged Linux app passes startup, pointer drawing, shapes, rich text and
unchanged typing pixels, font-size input, shadows, outside confirmation,
selection menus, Color-2 cut layers, visibility clicks, local fonts/clipboard,
PNG/project saves, collisions and offline AI. Renderer errors and external
requests are empty. Screenshots are captured from the running packaged app.

## Exact Windows download checks

[Workflow run 38602118193](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/38602118193) validates source
`b80796d05f1be8d48dc09ce405e40ef9e9ce28f8`. Both runners installed the exact checksummed Setup EXE
and launched the exact Portable download, rather than only a development build.

| Runner | OS/kernel | Core tests | UI workflows | Installer/packaged/portable/uninstall |
| --- | --- | --- | --- | --- |
| windows-2022 | Windows Server 2022 Datacenter 10.0.20348 | 87 | 89 | Passed |
| windows-latest | Windows Server 2025 Datacenter 10.0.26100 | 87 | 89 | Passed |

Installed font catalogs: windows-2022: 126 families via GDI; windows-latest: 144 families via GDI.

Setup completed successfully. Desktop and Start-menu shortcuts and project
associations target the installed executable. Its copied ASAR installation,
in a path with spaces and Unicode, passed startup, software rendering, drawing,
text/font/shadow changes, context menus, Color-2 cut layers, visibility clicks,
native clipboard, saving and offline AI. Windows executable resources contain
seven easel icon resolutions and version 1.0.4 strings. No renderer errors or
external requests were recorded. Uninstall removed the application, shipped
helper and registry entry while preserving a user project.

Exact tested EXE SHA-256 values:

- `PaintPlus-Setup-1.0.4-x64.exe`: `b8f59693bd20cc0b2cf706b2b18cc553b082283235a22e3bec98da2866d4dfff`
- `PaintPlus-Portable-1.0.4-x64.exe`: `f2fc6421366626dae6eee7b13157c4eac11e5532750a43c1f06d9b3a78cf4915`

Per-runner logs/JSON are retained under docs/windows-ci. The summary is
windows-test-evidence.json. Windows screenshots are under docs/screenshots;
larger chat/download screenshots come from the same version's Linux package.
Both executable archives and the portable inner payload pass integrity checks;
their application ASAR hashes match. Details are in packaging-integrity-1.0.4.json.

## Verification boundaries

Hosted Windows Server checks do not verify the user's particular Windows 10/11
Home laptop. High DPI, multiple displays, stylus input and long sessions remain
unverified on that hardware. Microsoft cursor resources, GDI glyph pixels and
every brush variant are not claimed identical. The installer is unsigned.
Other incomplete features are listed in LIMITATIONS.md.

Source ZIP/TXT exports verify original file contents and ZIP CRC. All downloads
have SHA-256 entries in downloads/SHA256SUMS.txt and are fetched back from their
public links before delivery.
