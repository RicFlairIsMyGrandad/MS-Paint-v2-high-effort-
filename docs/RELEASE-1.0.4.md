# PaintPlus 1.0.4

This release implements the October 14 feedback. It keeps the earlier startup
diagnostics, Windows software rendering and bundled offline AI.

| Feedback | Result |
| --- | --- |
| 1 | Brush tips have a stronger, visible soft fringe, including thin strokes. The axis-aligned body keeps the selected opaque pixel width. |
| 2 | Free-form selection previews the exact binary pixel mask while dragging, with a staircase outline on pixel boundaries. The same mask is used when pixels are lifted. |
| 3a–3c | Tool icons follow the supplied reference more closely, including the blue paint stroke and brush tile. Fill has an explicitly marked cross at its active hotspot; the color-picker cursor uses the toolbar's eyedropper artwork. A large transparent easel replaces the blue tile app icon, including Windows executable and shortcut resources. |
| 5 | Active Outline/Fill controls have black text and fully visible icons. Disabled controls remain muted. |
| 6 | Startup, New image and the canvas dimension controls default to 731 × 411 pixels. The example scene retains its own 1200 × 800 dimensions. |
| 7 | Selection lifting, user-facing erasing, Cut and Delete replace removed pixels with Color 2 on upper layers as well as the base layer. Imported PNG alpha and AI background removal still support transparency. |
| 8a, 8b | Right-click a selected area to choose Cut, Copy, Delete or Cut into new layer. The last option fills a new full-canvas layer with Color 2 and keeps the cut content in its original position. The operation can be undone/redone. |
| 9 | Layer-row buttons keep their DOM identity during refreshes. One click toggles visibility, including when a refresh happens between mouse-down and mouse-up. |
| 10a | Underline thickness uses the supplied sizes: 8/12pt → 1px; 16/20pt → 2px; 24/28pt → 3px; 36pt → 4px; 48pt → 6px. Intermediate sizes scale by points. |
| 10b | Underlines skip glyph ink with a one-pixel gap around descenders. Letter pixels remain intact. |
| 10c, 13a | Font size has an editable box and dropdown with Paint's common sizes. Typing multiple digits or a decimal keeps focus in the box; digits never leak into the text. Text range/caret formatting survives returning from the controls. |
| 11 | Every active selection uses the same eight resize handles, rotate handle and interior/border dragging. The old Move shortcut is an alias for selection. In default Paint mode, clicking outside confirms selected pixels, pasted images, shapes and text onto their layers. Controls and menus remain usable. A rotation handle that would be clipped at the canvas origin moves to a visible side. |
| 12a | Text speech bubbles use fixed 9px corners and a fixed 30px-wide, 46px-high curved tail. Resizing regenerates the shape and changes straight edges without stretching those details. Extremely narrow bodies reposition the tail to keep it inside the body. |
| 12b | Optional speech-bubble shadow uses fixed #808080 grey. Its diagonal offset is adjustable from 0–100px, default 3px, and saved in editable projects. It does not use Color 2 or move the text origin. |
| 13b | Enter adds a new line and Delete edits characters while typing. Resize/rotate handles and dashed-border dragging keep text editing active. Delete after manipulating a text handle does not remove the box. Clicking outside confirms text; an empty new box cancels. One undo removes a newly confirmed text box. |

Ctrl+Enter or Finish text ends typing while leaving the box selected; Enter or an
outside click then confirms it. Save an editable project before confirmation if
you want to keep text/shape metadata. Confirmation deliberately produces raster
pixels, so confirmed text cannot be reopened as a text box. The optional persistent
selection setting retains floating objects when clicking outside.

The icon/cursor artwork is an original recreation rather than extracted Microsoft
resources. Text uses Canvas glyph rendering; exact GDI pixels, every brush variant
and laptop-specific behavior are not claimed identical. Full remaining limitations
and validation boundaries are in LIMITATIONS.md and TESTING.md.
