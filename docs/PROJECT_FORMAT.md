# PaintPlus project format, version 1

A `.paintplus` file is UTF-8 JSON. It is self-contained, with no runtime network
references. This format is designed for editable local projects, not efficient
bulk archival: embedded base64 PNGs make large projects larger than image exports.

Top-level fields:

| Field | Meaning |
| --- | --- |
| `format` | Literal `PaintPlus` |
| `version` | Integer `1` |
| `width`, `height` | Canvas pixel dimensions |
| `activeLayerId` | Selected raster layer |
| `selected` | Floating object IDs that were selected |
| `sources` | Array of base64 PNG data URLs, deduplicated by source reference |
| `layers` | Array in bottom-to-top compositing order |

Each layer contains `id`, `name`, `visible`, `locked`, `raster` (index into sources)
and `objects`. Every raster matches canvas dimensions. Objects render above that
layer's raster in their array order.

Objects contain `id`, `name`, `type`, `source` (the immutable original PNG index),
`x`, `y`, `width`, `height`, `angle` in degrees, `flipH`, `flipV`, `resampling`, and
optional `transparentColor`, `group`, `assetId`, `assetPath`, `smoothPreview`.
`x,y` are the unrotated bounding rectangle's upper-left coordinates; rotation
is around its center. A group's shared identifier links members across layers.
No nested groups or external data are required to render a saved project.

Text additionally stores `text`, `font`, `fontSize`, `bold`, `italic`, `opaque`
and `textColor`, with a PNG rendering in `source`. Font substitution can change
its rendering if text is edited on a computer without the original font.

Alpha is part of each embedded PNG. `transparentColor` separately removes exact
RGB matches during rendering, without overwriting source alpha. Selections are
floating image objects with `type: selection`.

Undo history and workspace preferences are deliberately not serialized. Opening
a project creates a fresh undo history. Library indexes, Quick Save output folder,
panel states and number shortcuts are per-user settings, separate from projects.

Version 1.0.2 keeps container version 1. New `type: "shape"` objects include
`shapeName`, immutable `shapeStyle` (width/colors/outline/fill), normalized
`shapeGeometry` (endpoints, optional curve controls/polygon vertices) and `draft`.
Their embedded source PNG is regenerated after shape/style transforms.

Text objects add `underline`, `strikeout`, `padding`, `lineGap`, `minHeight`,
`bubble`, `bubbleWidth`, `bubbleColor` and `background`. Width sets wrapping;
height grows to fit the content and bubble body. Whole-box formatting and source
PNG are stored together. The source PNG remains useful to old readers, while
1.0.2 validates new editable geometry/layout fields before accepting a project.
AI confidence arrays are transient; only the resulting PNG pixels are saved.
