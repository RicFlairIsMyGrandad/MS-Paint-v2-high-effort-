# PaintPlus 1.0.3

This release addresses the October 13 feedback. It retains the startup fixes,
Windows software rendering and local-only AI from previous releases.

| Feedback | Changes |
| --- | --- |
| 1 | Round brush tips have a softened fringe. The middle of an axis-aligned stroke keeps its exact opaque width. |
| 3a, 3c, 3d | Refined tool and gear icons, a wider Colors group without the Edit colors overlap, and a new generated app logo. The new logo is included in the title bar, window, shortcuts, installer, portable launcher and Windows executable resources. |
| 3b, 4 | Reference-style cursors, a visible brush/pencil centre and size footprint, and an eraser consisting only of a size square. Erasing snaps to pixel boundaries and has no partial edge pixels. The base layer uses Color 2; transparent upper layers clear alpha. |
| 5 | The pencil uses circular, hard pixel stamps at larger widths. A one-pixel pencil occupies one raster pixel. |
| 6 | Shapes use the same raster renderer while dragging and after release. Rectangle borders have the chosen pixel width and square corners. |
| 7 | Brush variants, pencil, eraser and each shape remember their own width, including after reopening. |
| 8 | Brush and pencil Size indicators use a growing circle. The pixel label sits directly under Size. |
| 9 | Outline/fill controls are enabled for a shape being drawn or selected, and disabled before there is a shape. |
| 10 | Width changes do not create undo entries. Unfinished shape adjustments update one draw action. Repeated moves/resizes of a selection retain its original and final state until another operation or deselection ends that session. |
| 11a, 11b | Plain text starts at the box edge. Finishing typing returns to Home; clicking finished text opens the Text ribbon and editor. |
| 11c | Installed fonts are listed locally. Six additional offline font families are bundled: PaintPlus Caveat, Inter, Lora, Merriweather, Pacifico and Roboto Mono. Favorite fonts are pinned first and saved. |
| 11d | Selected words can have independent font, point size, colour, bold, italic, underline and strikeout. Formatting at a collapsed caret affects subsequently typed text. Ctrl+A inside the text box formats the whole text. Mixed formatting survives project saving/reopening. |
| 11g, 12 | Typing and finished text share one rendered canvas. Font sizes use points, with 12pt corresponding to 16 document pixels at 96 DPI. Whole-pixel positioning avoids the old resize blur and finalization shift. Underlines use the same baseline before and after typing. |
| 11h, 11i, 11j | Negative line gaps allow tighter lines. Speech outlines use one exact solid colour with no partial alpha. Bubble height accounts for the last glyph/underline rather than adding a spare line-height below it. |
| 13 | Free-form masks either include or exclude a complete pixel, leaving no softened selection/deletion boundary. |
| 14 | The magnifier outlines its target area and centres the magnified view on that area. It doubles zoom where a permitted level exists, and respects the 800% maximum. |
| 15 | Clicking grey workspace outside the canvas finishes and deselects a Paint-mode pixel selection. Selection controls remain usable without prematurely deselecting it. |
| 16 | Mouse wheel over the ribbon/title/tab area moves left or right through the available Home, View and Text tabs. |

The font and cursor rendering is an original implementation. This is not a
pixel-for-pixel reproduction of Microsoft's executable or GDI text renderer.
Advanced paragraph alignment, per-character baseline offsets and manual AI mask
painting remain outside this release. Hosted Windows evidence is recorded in
TESTING.md; it does not replace testing on the user's specific Home-edition laptop.
