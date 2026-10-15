# Validation of PaintPlus 1.0.8

All 143 Node tests and 149 Chromium UI workflows pass locally and on both hosted
Windows runners. No UI tests are skipped, flaky or unexpected. Production builds
and the installed ASAR checks pass.

New coverage verifies alpha/keyed layer switching without mutating source pixels,
partial alpha, upper-layer erasing, transparent selection holes, safe Delete,
commit/merge/cut behavior, saved projects and legacy migration. Layer activation
and group headers do not pre-select content or change the current tool. Double-clicking a name renames inline; eye double-click does not. Layer preference bars
are each 32px high. Painting or manually selecting an editable image after layer
activation acts on its visible pixels; undo restores the original editable object.

Colour checks cover nine initially empty ribbon slots plus fixed RGB 24/71/241,
OK/Add persistence, explicit slot replacement, restart, arrow/ramp dragging,
exact luminance endpoints, keyboard adjustment, and dialog focus remaining on
a field or slider already chosen by the user. Text background tests verify
exactly three mutually exclusive checkboxes, RGB 254/255/255 White, custom fills and colour-dialog Cancel,
and preserved legacy background colors. Existing drawing, grouping, text,
clipboard, ruler, transform, selection safety and offline AI regressions remain.

The packaged Linux app passes these interactions and native clipboard, fonts,
PNG/project saves, collision handling and offline AI. Renderer errors and external
requests are empty. Screenshots are captured from the running packaged app.

## Exact Windows installer and portable validation

[Workflow run 38800513773](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/38800513773) validates application source
`87ace3cd306a43e0b47b0540933942bac3cf40e8`. Both runners install the exact checksummed Setup download
and launch the exact Portable EXE, including the real installation and shortcuts.

| Runner | OS/kernel | Core tests | UI workflows | Installer/packaged/portable/uninstall |
| --- | --- | --- | --- | --- |
| windows-2022 | Windows Server 2022 Datacenter 10.0.20348 | 143 | 149 | Passed |
| windows-latest | Windows Server 2025 Datacenter 10.0.26100 | 143 | 149 | Passed |

Installed font catalogs: windows-2022: 126 families via GDI; windows-latest: 144 families via GDI.

Actual Setup installation succeeds. Desktop/Start-menu shortcuts and project
associations point to the installed executable. The installed ASAR also runs from
a copied path containing spaces and Unicode. Native checks cover the new layer,
colour and text-background controls plus startup/software rendering, drawing,
clipboard, saves, editable text/shapes, fonts, resize, selections and offline AI.
The exact Portable launcher passes its native startup/clipboard/AI checks.
Uninstall removes the app/helper/registry entry while preserving a user project.

Both binaries contain the same application ASAR. Their archives and the portable
inner payload pass integrity checks. Executable resources retain the palette icon
and 1.0.8 version strings. No renderer errors or external requests are recorded.

Exact tested download SHA-256 values:

- `PaintPlus-Setup-1.0.8-x64.exe`: `d9d9645ea3484f4a1fce59292c0bf8d2891233bd65e4c22a2ee746e53913159c`
- `PaintPlus-Portable-1.0.8-x64.exe`: `2a282c3b78ba75346b82f1d2db917998684aa965a516a2ea04c1481cced8074e`

Per-runner logs/JSON are under docs/windows-ci; windows-test-evidence.json records
the source, run and exact executable checksums. Archive checks are recorded in
packaging-integrity-1.0.8.json. Windows screenshots are under docs/screenshots;
larger download screenshots come from the same version's packaged Linux app.

## Scope and verification boundaries

The layer mode is document-wide; normal alpha does not disable an object's
explicit Transparent Selection color key. The bottom canvas remains paper.
Group editing links existing selected content and raster tools. New text/shapes/
assets go on the active layer; visibility, names and locks are per-layer. Raster
painting or area editing converts participating floating content to pixels;
undo restores it, and cancelled unchanged selections/no-op fills restore it
without history entries. See LIMITATIONS.md for other incomplete features.

Hosted Windows Server checks do not establish operation on the user's physical
Windows 10 Home or Windows 11 Home laptop. Multiple displays, high DPI, stylus
input and long sessions remain unverified there. The installer is unsigned.
The UI follows the references using original implementations; exact Microsoft
binary resources and every GDI pixel are not claimed.

Source ZIP/TXT exports verify original file contents and ZIP CRC. Download hashes
are listed in downloads/SHA256SUMS.txt. Public links are fetched and verified
against that manifest before delivery.
