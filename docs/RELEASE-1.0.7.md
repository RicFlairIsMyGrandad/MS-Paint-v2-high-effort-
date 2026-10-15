# PaintPlus 1.0.7

| Request | Implemented behavior |
| --- | --- |
| Eraser preview | The square uses the chosen secondary colour, the selected pixel width, and a thin black outline. Hover does not paint. |
| Pointing hand | A straight finger follows the shaft with a small rounded palm below it, matching the supplied reference more closely. The silhouette follows straight/curved endpoints and wobble remains optional. |
| Grouped edits | Choose the group header, then Select/Free-form Select to lift the same region on all visible, unlocked members. Move, resize, rotate, flip, cut, copy and delete operate on all lifted regions. Brush, pencil, eraser and flood fill also link across group members with one undo step. Click a member row for individual editing. |
| Bubble background | Background controls offer Color 2, off-white RGB 254/255/255, and a custom colour using Edit Colors. Changing text colour preserves the bubble outline and fill. Color 2 updates only boxes set to follow it, including mixed selections. |
| Padding | Separate horizontal and vertical bubble padding control wrapping and spacing. Older projects with a single padding value retain their original spacing. |
| Edit Colors | Classic compact two-pane layout: 48 basic swatches, 16 persistent custom slots, hue/saturation spectrum, luminance ramp, synchronized RGB and classic HSL fields, preview, OK/Cancel and Add to Custom Colors. The custom pane is open, so Define Custom Colors is disabled. |

The Windows setup upgrades earlier installations. Portable EXE, complete source
ZIP/TXT, screenshots and checksums are included in downloads. Startup diagnostics
and software rendering from the earlier blank-window fixes remain enabled.

Grouping preserves independent layers. It links operations on existing content;
new text/shapes/assets are inserted on the active layer, and layer visibility,
names and locking remain individual properties. A confirmed group area edit
renders participating floating content to pixels; an unchanged cancelled area
selection restores editable content. See LIMITATIONS.md for remaining features
and hardware verification boundaries.

Validation results will be recorded in TESTING.md after native package checks.
