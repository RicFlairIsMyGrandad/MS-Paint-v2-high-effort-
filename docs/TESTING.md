# Validation of PaintPlus 1.0.5

100 Node tests and 107 Chromium workflows pass locally. New tests cover exact brush endpoint widths, all brush variants, opaque eraser preview, the Layers asset preference, in-place renaming, Color-2 display/export/project consistency, visibility independent of undo and redo, original-source smooth resizing, visible-area paste and canvas growth, fixed speech outline colour, contextual Text navigation, consecutive selections/shapes/text boxes, clear thin frames and hidden moving outlines.

The packaged Linux application passes those new checks and the existing startup, drawing, clipboard, fonts, save/export, collision and offline AI checks. No renderer errors or external requests were recorded. Screenshots come from the running packaged app.

The exact Windows executable checks are pending at this checkpoint. Final per-runner logs, source revision and checksums will replace this report after successful validation. Older evidence is not proof for this release.

Hosted Windows Server checks do not test the user's particular Windows Home laptop. Other limitations are in LIMITATIONS.md.
