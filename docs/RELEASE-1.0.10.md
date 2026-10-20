# PaintPlus 1.0.10

- Mouse writing is a separate tool on Home. Draw a box to type; its Lettering
  ribbon offers pixel size, colour, negative/positive letter spacing, word
  spacing, line gap and a maximum upward offset X. No font dropdown is needed.
- The user's completed original PNGs supply 95 sampled characters and 285
  variants. Native per-pixel coverage is recovered against the original guides;
  no tracing, curve fitting or smoothing is applied. Colour uses the sample
  alpha mask. Nearest-neighbour size changes preserve rough edges; whole-number
  enlargements preserve the original pixel pattern most faithfully.
- Shuffle chooses a different available variant and a different upward offset
  in 0–X for each character. At X=0 the offset stays zero. Typing inserts new
  choices while retaining existing ones; editing colour/spacing does not reroll
  characters. Shuffle has its own exact Undo/Redo. Projects embed the samples,
  text and variation choices so reopening does not reshuffle.
- Load sheets can replace/add local PNG character sets. Blank/resized/invalid
  sheets are rejected. The supplied handwriting is already bundled and works
  offline without importing it again. The older Grade Wobble outline font
  remains available separately in the normal Text tool.
- Wand tolerance/contiguous/sample-layer controls stay hidden until a wand area
  is selected. Their group is last on the far right of Home. Earlier tools,
  palette, canvas controls and Quick Save retain their positions. Tolerance
  has a wide field showing values up to 255 in full.
- Mouse writing, AI Remove Background and Settings remain available in the
  horizontally scrollable Home ribbon on small laptop windows, including
  1024px and 1280px widths.
- Canvas dimension fields retain their manually typed values across edge/corner
  resizing, Undo/Redo and UI refreshes. The bottom status readout still shows
  the actual canvas dimensions. Apply uses the typed fields. Canvas properties
  uses its own separate input IDs and cannot accidentally read the ribbon.

Boundaries: lettering uses the submitted individual glyphs, with one colour and
size per box. Connected handwriting is not inferred from whole phrases. Missing
characters show a placeholder and are listed in the ribbon. Smaller/fractional
sizes necessarily change the pixel pattern. Confirming a box to the raster ends
text editability; save a project while the box is editable to retain it.

Validation: all 162 core tests and 175 browser workflows pass locally and on both
hosted Windows runners. [Run 39351224677](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/actions/runs/39351224677) installs and exercises the exact
Setup download, launches Portable and checks uninstall retention. Archives and
ASARs pass integrity checks; TESTING.md records hashes and hardware boundaries.
