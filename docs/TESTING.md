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

The release workflow installs the exact checksummed candidate Setup EXE, checks
shortcuts and project association, launches the installed ASAR, tests the revised
editor/native clipboard/fonts/AI, verifies executable branding, launches Portable,
and uninstalls while preserving a user project. Run identifiers, source revision,
OS kernels, logs and file hashes are collected after these checks finish.

Windows 1.0.3 validation is pending at this source checkpoint. The final downloads
and reports will be published after native checks. The previous 1.0.2 evidence
remains in Git history; it is not proof for this version.

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
