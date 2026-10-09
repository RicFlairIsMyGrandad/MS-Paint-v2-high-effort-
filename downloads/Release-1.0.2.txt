# PaintPlus 1.0.2

This release addresses the numbered feedback in the October issue attachment.
The Windows installer and portable executable include all runtime files and the
offline background model. No developer tools or separate model download are needed.

| Feedback | Result |
| --- | --- |
| 1, 2 | Only 12.5, 25, 50, 100, 200, 300, 400, 500, 600, 700 and 800% zoom. Image display uses crisp pixels. |
| 3 | Ribbon overlap removed; smaller, bordered palette; colored Paint-style icons and completed cloud. Exact Microsoft icon/cursor assets and byte-identical proportions are **not implemented**. |
| 4, 14 | Adjacent rectangular/free-form selection buttons and transparency checkbox. Shortcut 8 toggles transparency; Crop is no longer a shortcut tool. Ctrl+A remains available. |
| 5 | Brush image selects round or the last brush used; lower arrow opens choices. Dark Size samples and bold pixel width, reflecting the current stroke. |
| 6 | Drag the Assets panel's right edge to change width, and the divider above thumbnails to change folder height. Both persist. Category gear/right-click menus add, rename and remove library categories without deleting original files. |
| 7 | Shapes remain editable after drawing. Drag their handles; adjust outline/fill and Ctrl+Numpad +/- before committing. |
| 8 | Row-level bin buttons and Delete after selecting a layer remove it immediately. Undo restores it. Deleting the final layer replaces it with a blank background. Locked layers require unlocking. |
| 10 | Ribbon Width/Height fields and Apply resize canvas boundaries without stretching the picture. |
| 11 | Larger pastes expand the canvas by default, grouped into a single undo action. Settings can keep the current canvas boundary. |
| 12, 13 | Drag a text box and type on the canvas. The Text ribbon has font/size, bold, italic, underline, strikeout, opaque background, speech bubble, outline width, padding and line spacing. Text wraps and the bubble grows as you type. Double-click finished text to edit it again; resizing reflows text. |
| 15 | Mask refinement is nonmodal: drag the panel aside and zoom. Threshold goes below zero; softness affects the edge. A hard silhouette is the default. Original pixels and model confidence are kept separately during refinement, allowing weak detail to be restored. Intrinsic source transparency is preserved. |
| 16 | Ctrl+Z/Y targets document history even with the filename field focused. Inline text editing is grouped into document history. |
| 17 | Copy uses the original selected colors, disregarding Color-2 masking, and mattes genuine transparency with Color 2 for external applications. PNG export still preserves transparency. |
| 18 | Paint selection behavior is the default: immediate handles/movement, click outside to commit, Enter returns to the originating selection tool. Settings also offers persistent floating selections. Text remains editable across ordinary outside clicks and tool changes. |
| 19 | Odd-width round brushes align to the pixel grid. Horizontal/vertical 3px and 5px stroke bodies have exactly that many opaque pixels with no side bleed. Rounded endpoints and diagonal strokes remain antialiased. |
| 20 | Shift-drag stamps a continuous trail; Shift-arrows stamp and move one pixel. Trail and movement undo together. Opaque selection margins stamp too; enable Transparent for Color-2 margins. |
| 21 | Selection outlines and handles are drawn at screen resolution, with constant screen size at all zoom levels; only the visible overlay area is allocated. |

There was no item 9 in the attachment. The earlier packaged startup fix, Windows
software rendering, visible startup diagnostics, eraser alpha fix and allocation
guards remain included. See TESTING.md for evidence and LIMITATIONS.md for the
remaining differences and hardware verification boundaries.

Validation: 46 core/resource tests and 53 UI tests passed locally and on both
hosted Windows runners. The exact checksummed Setup and Portable downloads passed
native installation/launch, the revised editor and clipboard checks, offline AI,
shortcuts, project association and uninstall preserving a user project.
