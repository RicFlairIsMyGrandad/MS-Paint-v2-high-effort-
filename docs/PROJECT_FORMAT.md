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
| `color2` | Optional exact upper-layer key colour; older files default to white |
| `layerTransparency` | `color2` for exact upper-layer keying, `alpha` for standard alpha; absent means legacy `color2` |
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

Version 1.0.3 adds `fontUnit: "pt"` and immutable `textRuns`, whose concatenated
text equals `text`. Each run has its own text/font/point size/colour/style fields.
Older font sizes without fontUnit retain pixel semantics and are presented as
equivalent points during editing. `lineGap` can be negative. Width controls remain
workspace preferences rather than undoable object edits.

Version 1.0.4 adds textBoxWidth, bubbleShadow and shadowOffset. textBoxWidth is
the wrapping/bubble width before adding shadow extent; width/height remain the
rendered source bounds. The renderer regenerates fixed corner/tail geometry.
Shadow colour is always #808080 rather than a stored or user-selected colour.
New fields are validated when reading projects. Clicking outside in default
Paint mode confirms editable objects to their layer raster; save before doing
so to retain their metadata.

Version 1.0.8 keeps container version 1. `layerTransparency` preserves the
document's alpha/keyed compositing mode. Raster/object source PNGs retain their
own RGBA pixels when switching this setting. Text `backgroundMode` accepts
`transparent`, `offwhite`, `custom`, and legacy `color2`; `opaque` and `background`
hold the actual fill behavior and RGB colour. Off-white is exactly #feffff.
Ribbon custom palette slots and the preferred mode for new documents are user
preferences, separate from project files. Earlier readers do not understand
alpha layer mode and may apply their legacy Color-2 key to upper layers.

Version 1.0.9 adds optional boolean `color2Transparent`. It defaults to false for
older projects. True disables the hidden RGB key when the secondary paint is the
transparent swatch; source alpha remains authoritative. New transparent text/run
and shape-ink colors use the CSS literal `transparent`; ordinary colors stay RGB
hex. Wand masks are transient selection geometry; selected pixels are embedded in
the existing floating source PNGs. The eight ribbon custom slots are deliberately
not saved between sessions. Shift shortcuts and export-matte preferences are
workspace settings, separate from project pixels. Old readers may ignore these
new fields, so their keyed appearance can differ.
