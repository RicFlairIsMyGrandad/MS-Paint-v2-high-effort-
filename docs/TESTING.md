# Validation of PaintPlus 1.0.2

This document distinguishes browser, packaged-desktop and hosted Windows evidence
from testing on the user's Windows 10/11 Home laptop.

## Local automated checks

- **46 Node tests:** the original 35 core/resource checks plus fixed zoom levels,
  exact 3px/5px horizontal/vertical round-brush bodies, hard/soft mask behavior,
  restoring weak AI detail while retaining intrinsic alpha, compound paste
  undo/redo and rollback, editable shape regeneration and text wrapping/spacing.
- **53 Chromium UI tests:** the existing 36 workflows plus fixed zoom/nearest
  display, constant selection handle size, split Brush button, transparency
  shortcut, editable shape transforms/styles, default and persistent selection
  modes, Shift trails and one-pixel nudges, immediate layer deletion/undo, exact
  canvas dimensions, filename-independent undo, paste expansion toggle, inline
  text/bubbles/re-edit/reflow/project roundtrip, persisted asset splitters/category
  removal, external Color-2 copy and nonmodal mask refinement and recovery from malformed saved shortcut settings.

Commands: `npm test`, `npm run test:ui`. Machine-readable browser results are in
`ui-test-results.json`. All 46 Node and 53 Chromium tests passed locally with zero failures or skips.
The core output is in core-test-results.txt. Passing source tests alone is not an
installer startup claim.

## Packaged application checks

`tools/packaged-qa.mjs` runs a copied ASAR installation from a directory containing
spaces and Unicode with a fresh profile. It tests readiness, real pointer drawing,
editable shape widths, inline speech text and undo, original Color-2 colors through
the native clipboard, low-level clipboard alpha, real PNG/project file bytes,
Quick Save collisions, bundled model availability and offline CPU inference.
It records renderer errors, external requests, Windows software-rendering state
and startup diagnostics. Screenshots are taken from the running packaged app.

Windows CI installs and launches the exact checksummed release candidate Setup
and Portable EXEs. It checks desktop/Start-menu shortcut targets and the .paintplus
association command, runs packaged QA, launches the portable wrapper and uninstalls
while confirming that a user's project remains. The unique evidence branches do
not modify main. See windows-test-evidence.json for run/source/OS identifiers and
exact EXE hashes after these checks have completed.

## Hardware and visual boundaries

Hosted Windows Server runs are useful Windows executable checks, but do not prove
that either Home-edition laptop starts on its specific hardware. Software rendering
and visible startup diagnostics are included. High-DPI/multiple monitors,
touch/stylus and long sessions remain unverified on the user's laptop.

The provided issue image guides ribbon/selection/speech-bubble comparisons. Icons
and cursors are original approximations rather than exact Microsoft assets.
Round brush body pixels and selection handle dimensions have automated assertions;
not every classic Paint brush is compared pixel-for-pixel with mspaint.exe.

Current limitations are in LIMITATIONS.md; issue-by-issue results are in
RELEASE-1.0.2.md. The ZIP/TXT source export script verifies original file contents
and a SHA-256 manifest accompanies every downloadable file.

## Local packaged results

The Linux ASAR checks passed with zero renderer errors and zero external requests.
See packaged-linux-test-results.json. Additional native checks passed for folder
metadata, 160px thumbnails, atomic save/overwrite, cancelled save-before-close
retaining the window, and successful project save before close. Captured packaged
screenshots include the editor, Resize & Rotate panel and contextual speech text.

## Exact Windows installer results

[Windows CI run 37971775432](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/37971775432)
completed successfully for application source revision
`8a9bb8c59adb93307e1444addd48510ecadf5a3e`.

| Native runner | Kernel | Core/resource | UI | Installed Setup and Portable |
| --- | --- | --- | --- | --- |
| Windows Server 2022 Datacenter | 10.0.20348 | 46 passed | 53 passed | Passed |
| Windows Server 2025 Datacenter | 10.0.26100 | 46 passed | 53 passed | Passed |

Both runners used the exact published release-candidate EXEs, verified against the
application input digest and file checksums. They passed silent Setup installation,
shortcut targets, project association command, startup and drawing from the
installed ASAR, editable shape widths, inline speech text and undo, original
Color-2 clipboard colors, clipboard alpha, PNG/project save bytes, save collisions,
local AI inference and portable launch. Uninstall removed the shipped application
and helper while preserving a user project. Packaged runs recorded zero renderer
errors and zero external requests, with Windows GPU compositing disabled.

Reports, logs, source and OS identifiers are in `windows-ci/` and
`windows-test-evidence.json`. The root packaged Windows JSON and screenshots come
from the Windows Server 2022 run. The evidence branches are linked in the summary.

Exact download checksums:

```text
03d22ff3376ce2e8b34756631cf378ef49d10228350a0fd055e1bbcf9a7a605d  PaintPlus-Setup-1.0.2-x64.exe
68516fd31e1d3b3d39edd9893ef89af9cd8fcfc908404e6dc6f4d6ac9e77007d  PaintPlus-Portable-1.0.2-x64.exe
```

Local archive tests also passed for Setup, Portable and the Portable inner payload.
Their extracted ASAR hashes match the packaged candidate. See
`packaging-integrity-1.0.2.json`. Complete source ZIP/TXT export verifies each
original text file and ZIP CRC; all deliveries include a SHA-256 manifest.
