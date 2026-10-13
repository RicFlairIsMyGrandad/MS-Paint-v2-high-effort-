# Validation of PaintPlus 1.0.3

## Local checks

- **64 Node tests pass.** Coverage includes exact brush body widths and softened
  caps, pixel-snapped erasing, circular pencil stamps, sharp rectangle borders,
  hard free-form masks, point conversion, mixed text formatting, reduced line
  spacing, unclipped underlines, pure speech outlines, document history/memory,
  image transforms, alpha and packaged resource routing.
- **68 Chromium workflows** cover the earlier editor regressions and the new
  rendering, cursor, width, undo, rich-text, fonts/favorites, tab switching,
  outside-canvas selection and magnifier behaviour. Results are recorded in
  ui-test-results.json after the final combined run.
- The packaged Linux ASAR passes real pointer drawing, rich text and stable typing
  pixels, bundled and installed font checks, clipboard colour/alpha, PNG/project
  save bytes, collisions and offline CPU inference. It records zero renderer
  errors and zero external requests. The copied installation path contains spaces
  and Unicode; screenshots come from that running packaged application.
- The Windows PE branding hook was exercised against a real Electron executable.
  Its resources contain seven icon resolutions and PaintPlus version strings.

## Windows release checks

[Windows workflow run 38457947297](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/38457947297) validates source
`b46b0f1234bb8e2aa7ae680dacf5bdad30138bb4`. Both runners tested the exact published candidate downloads,
not only an unpacked development executable.

| Runner | OS/kernel | Core tests | UI workflows | Installer/packaged/portable/uninstall |
| --- | --- | --- | --- | --- |
| windows-2022 | Windows Server 2022 Datacenter 10.0.20348 | 64 | 68 | Passed |
| windows-latest | Windows Server 2025 Datacenter 10.0.26100 | 64 | 68 | Passed |

The normal Setup installer completed successfully. Desktop/Start menu shortcuts
and project associations target the installed executable. The installed ASAR
passed startup, pointer drawing, shape/text editing, unchanged typing pixels,
mixed formatting, installed/bundled fonts, seven branded executable icons,
clipboard colour/alpha, PNG/project saving, filename collisions and offline CPU
AI inference. Software rendering was active; renderer errors and external
requests were empty. The actual Portable launcher also passed. Uninstall removed
the app, helper and registry entry while preserving a user project.

Exact tested download SHA-256 values:

- `PaintPlus-Setup-1.0.3-x64.exe`: `8b0d95a68858ea3cfe6899b2edeae46b523033792643c3337473239bd1b37ced`
- `PaintPlus-Portable-1.0.3-x64.exe`: `c7a49bfe33ff67ddcf03689f6e8d1e1abe98f4cd8c01203005269e3656b2d64f`

Logs and JSON are retained in `docs/windows-ci/` for each runner. The summary is
`windows-test-evidence.json`. Current Windows screenshots are under
`docs/screenshots/packaged-windows*.png`; the larger chat/download screenshots are
from the same version's running Linux package. Archive integrity and matching
Setup/Portable ASAR checks are in `packaging-integrity-1.0.3.json`.

## Verification boundaries

Hosted Windows Server checks do not prove operation on the user's Windows 10 Home
or Windows 11 Home hardware. High-DPI/multiple-monitor and long-session behaviour
remain unverified on that laptop. Font point conversion is tested, but Microsoft's
GDI glyph pixels, every brush variant and exact Microsoft cursor assets are not
claimed identical. Bundled fonts provide Latin coverage, punctuation and currency
symbols; other characters use installed fallback fonts.

Source ZIP/TXT exports verify original file contents and ZIP CRC. Download files
are accompanied by SHA-256 checksums. Current differences and limits are in
LIMITATIONS.md, and issue-by-issue results are in RELEASE-1.0.3.md.
