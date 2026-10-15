# Validation checkpoint — PaintPlus 1.0.8

All 143 Node tests and 149 Chromium UI workflows pass locally, with no skipped,
flaky or unexpected results. The packaged Linux ASAR passes the new layer,
palette and text-background checks plus the existing native clipboard, fonts,
PNG/project saves, transforms, selection safety and offline AI checks. Renderer
errors and external requests are empty. A regression that failed before the fix
now confirms opening a dialog cannot steal focus from a chosen RGB field or
luminance slider. Screenshots are from the running app.

Windows 1.0.8 installer/portable checks are pending. Existing Windows JSON/logs
currently describe the preceding 1.0.7 release and are not 1.0.8 evidence. Final
TESTING.md and downloads will be published after exact-candidate Windows checks.

The user's physical Windows 10 Home and Windows 11 Home laptops remain untested;
hosted Windows Server checks cannot establish those hardware-specific results.
The installer and application are unsigned. See LIMITATIONS.md.
