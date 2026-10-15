# Validation of PaintPlus 1.0.7

136 Node tests and 137 Chromium UI workflows pass locally. The final mixed-background and group-focus
checks also pass all ten targeted workflows. Both hosted Windows runners pass
the full 136/137 suites against the final application sources.

New checks cover the secondary-colour eraser cursor with its thin black outline,
the reference hand silhouette in four directions, linked rectangular/free-form
group regions, movement and safe destination deletion, linked painting/erasing
with one undo step, individual member editing, whole-group deletion after member
selection, off-white/custom bubble backgrounds, independent horizontal/vertical
padding, legacy spacing, the classic RGB/HSL dialog, spectrum/luminance controls,
Cancel, mixed selected background modes, and custom-slot persistence across restart. Existing startup, file,
clipboard, text, rulers, transforms, layer and offline AI regressions remain.

The packaged Linux app passes all new interactions and startup, drawing, native
clipboard, local fonts, PNG/project saves, collision handling and offline AI.
Renderer errors and external requests are empty. Production builds pass.
Screenshots are captured from the running packaged application.

## Exact Windows installer and portable validation

[Workflow run 38780667059](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/38780667059) validates source
`57752854afd3425fc4b886d5c0feeb80e5dc41c9`. Both runners install the exact checksummed Setup download
and launch the exact Portable EXE rather than only testing a development build.

| Runner | OS/kernel | Core tests | UI workflows | Installer/packaged/portable/uninstall |
| --- | --- | --- | --- | --- |
| windows-2022 | Windows Server 2022 Datacenter 10.0.20348 | 136 | 137 | Passed |
| windows-latest | Windows Server 2025 Datacenter 10.0.26100 | 136 | 137 | Passed |

Installed font catalogs: windows-2022: 126 families via GDI; windows-latest: 144 families via GDI.

Actual Setup installation succeeds, and desktop/Start-menu shortcuts and project
associations point to the installed executable. The installed ASAR application
also runs from a copied path containing spaces and Unicode. Native checks cover
all new grouped edits, cursor and text/background controls, colour dialog,
startup/software rendering, pointer drawing, clipboard, file saves, text/shape
editing, fonts, image resizing, pixel selections and offline AI. Both binaries
contain the same application ASAR. Their archives and the portable inner payload
pass integrity checks. Executable resources retain the palette icon and 1.0.7
version strings. No renderer errors or external requests are recorded. Uninstall
removes the application/helper/registry entry and preserves a user project.

Exact tested download SHA-256 values:

- `PaintPlus-Setup-1.0.7-x64.exe`: `9736dc8f9fbdbfb9f1e662d6e21c0617f791c90c4196d202053f2c348d3a0ce3`
- `PaintPlus-Portable-1.0.7-x64.exe`: `10f0e44380f96a0dc783f38cd4b00b917b0291b0188b69fa29502446f0053cbb`

Per-runner logs and JSON are retained under docs/windows-ci; the summary is
windows-test-evidence.json. Archive checks are in packaging-integrity-1.0.7.json.
Windows screenshots are under docs/screenshots; larger download screenshots come
from the same version's packaged Linux application.

## Scope and verification boundaries

Group editing links existing selected content and raster tools. New text, shapes
and assets are inserted on the active layer, and layer visibility/names/locking
remain individual properties. A confirmed group area edit converts participating
floating objects to pixels; cancelling an unchanged selection restores them.
See LIMITATIONS.md for other incomplete features.

Hosted Windows Server checks do not establish operation on the user's physical
Windows 10 Home or Windows 11 Home laptop. Multiple displays, high DPI, stylus
input and long sessions remain unverified on that hardware. The installer is
unsigned. The colour dialog and hand are original implementations following the
reference; exact Microsoft binary resources and every GDI pixel are not claimed.

Source ZIP/TXT exports verify original file contents and ZIP CRC. Download hashes
are listed in downloads/SHA256SUMS.txt. Public links are fetched and checked
against that manifest before delivery.
