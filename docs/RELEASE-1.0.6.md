# PaintPlus 1.0.6

This release addresses the latest ruler, brush, grouping, selection and speech-bubble feedback and adds two pointing-hand drawing tools.

| Request | Result |
| --- | --- |
| 1 | Ruler canvases use explicit CSS dimensions, display-density backing buffers and measured canvas origins. Tick positions align with pixels through all 11 zoom levels, scrolling and 100/125/200% browser display scales. |
| 2 | The round brush draws a stroke once from its original raster tiles. Round, antialiased tips avoid repeated opaque stamp buildup; horizontal 1/3/5/7/9px strokes keep the selected width. |
| 3 | Shift-click a range of layer rows, or Ctrl-click individual rows, then Group. Painted raster content and floating objects move together. Grey headers select whole groups; indented child rows select individual layers. Ctrl+Shift+G or the adjacent Ungroup button separates members. Projects retain membership and stack order. |
| 4 | Removed the per-folder gear buttons. Right-click a category for its existing management commands; Library options remain available. |
| 5 | Rectangular selection previews and lifted bounds use integer pixel edges, including one-pixel-wide selections. |
| 6 | Deleting or cutting floating selections removes the floating content without painting over the destination raster. The original lift remains a real edit when moved or deleted; undo restores original pixels. |
| 7 | Pixel/layer selection and unchanged deselection add no undo command, do not clear redo, and do not dirty a saved document. Undo during a fresh selection cancels it and undoes the preceding actual edit. Repeated movement remains one edit session. |
| 8 | The eraser cursor is a solid black square with no outline or white halo. Actual erasing still uses Color 2. |
| 9 | New bubble tails default to 18px wide and 24px deep. Text ribbon sliders control base width and attachment position. Drag the blue diamond at the tip to aim it below the bubble, including outside its width; text stays anchored. Shadows and project saves retain the geometry. Older projects keep their original tails until a tail control is adjusted. |
| 10a | Shapes → Pointing hand line creates a brush-style shaft and a black hand pointing along its endpoint tangent. Toggle Hand-drawn wobble for a less straight shaft, including when reselecting the line with the selection tool. |
| 10b | Shapes → Pointing hand curve uses the existing two-bend workflow, with the same endpoint hand and wobble option. Enter finishes early. Both shapes remain editable while floating. |
| 11 | Paste confirms the old selection before inserting the copied content. Only the pasted object is interactive; the original pixels remain on their layer. |
| 12 | Exact quarter-turn transforms preserve raster pixels, including partial alpha and mixed odd/even image dimensions. Pixel alignment corrections do not accumulate when rotated repeatedly. Arbitrary-angle rotation may still need smoothing. |

See [LIMITATIONS.md](LIMITATIONS.md) for remaining differences and hardware verification limits. The Windows downloads are unsigned x64 builds for Windows 10/11. Native release-validation results are appended after the exact installer and portable files pass hosted Windows checks.
