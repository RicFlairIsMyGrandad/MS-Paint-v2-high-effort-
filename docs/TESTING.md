# Validation in progress — PaintPlus 1.0.7

The application changes pass 136 Node tests and 137 Chromium UI workflows locally.
The packaged Linux application also passes startup, native clipboard, saving,
offline AI and all new interactions, with no renderer errors or external requests.
The final mixed-background and group-focus checks pass all ten targeted UI workflows. Archive
integrity and exact-download Windows installer/portable validation are in progress. The previous Windows
reports under docs/windows-ci belong to 1.0.6 until replaced with fresh evidence;
they are not evidence for 1.0.7.

The new workflows exercise a secondary-colour eraser cursor with a thin border,
the reference pointing hand in four directions, linked rectangular/free-form
group selections and safe deletion, linked painting with one undo step, off-white
and custom speech fills, independent horizontal/vertical padding, a classic
RGB/HSL colour dialog and custom-slot persistence. Existing editor, clipboard,
text, file, offline AI and startup regressions remain in the full suites.

Unsigned binaries and untested physical Windows Home laptops remain limitations.
Final checks, hashes and public download verification will replace this checkpoint.
