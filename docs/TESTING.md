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

Windows 1.0.2 candidate validation is pending at this source checkpoint. The final
release evidence and downloads will be published after the hosted checks finish.
