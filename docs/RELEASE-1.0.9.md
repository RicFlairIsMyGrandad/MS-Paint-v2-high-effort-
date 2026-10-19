# PaintPlus 1.0.9

- The colour picker samples with either mouse button, including transparent pixels,
  then restores the previous tool and brush variant.
- Selecting a drawing/selection tool confirms and deselects the current area,
  including clicking the same tool again. Scrollbars and scrolling preserve the
  selection and active text editing. Insertion/paste still selects the new item.
- The bottom palette row has eight session-only custom cells. Empty cells use
  RGB 244/245/247 with a visible X. The ninth cell is checkerboard transparent
  paint; the tenth stays RGB 24/71/241. Click/right-click the transparent cell to
  assign it to Color 1/2. Brush, pencil, eraser and flood fill can remove alpha
  on any layer, including the bottom canvas. Undo restores the removed pixels.
  Standard colours restore normal painting. The dialog's separate saved custom
  colours remain available; the eight ribbon slots reset on app restart.
- Magic wand sits beside rectangle and free-form selection. Set tolerance 0–255,
  contiguous/all matching, active/all-layer sampling, and New/Add/Subtract/
  Intersect. Shift adds, Alt subtracts and Shift+Alt intersects. Invert is in the
  wand options. Transform or delete the actual masked pixels, preserving holes
  and untouched destination content. Groups lift matching regions on members.
  Ctrl+D deselects; Ctrl+Shift+D duplicates (the previous Ctrl+D assignment moves).
- Settings → Keep transparency in saved PNG/WebP images chooses actual alpha or
  an opaque white matte. JPEG/BMP always use white. Saving a .paintplus project
  always preserves editable RGBA data; the export choice does not alter it.
- Edit Shortcuts has independent number and Shift+number banks. Both accept
  tools, flip horizontally/vertically, rotate 90° left/right, and toggle asset
  layers. The sidebar previews the second bank while Shift is held. Default
  Shift+0/1 flips, Shift+2/3 rotates, Shift+4 toggles asset layers. Shortcuts do
  not run while typing; Windows/Ctrl shortcuts remain reserved.
- Grade Wobble is a new original, scalable handwriting approximation, selectable
  in the Text font list. It supports upper/lower case, digits, common punctuation,
  size and colour changes. The TTF, specimen PDF and blank sample template are
  separate downloads. Missing characters were designed, not learned from the
  screenshot. A full alphabet/digit/punctuation sheet with three natural examples
  each, a shared baseline and a clean 300dpi+ scan would improve the match. No
  exact reconstruction or perfect reproduction is claimed.

The wand currently uses hard pixel masks. Feathering, edge refinement, automatic
subject recognition and saved wand tool masks are not implemented. Confirming a
pixel edit renders participating floating content to pixels; undo restores its
editable sources. Transparent paint acts as an eraser in raster drawing tools;
vector/text transparent ink is invisible rather than an editable eraser mask.
See LIMITATIONS.md for other remaining differences and hardware boundaries.

Validation is pending final local and exact-executable Windows package checks.
