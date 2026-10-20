# Native pixel samples for mouse lettering

For the rough MS Paint style, use the PNGs in
[`downloads/handwriting-png`](../../downloads/handwriting-png), rather than
printing or scanning the earlier PDF. The user's own original pixels should
define the character shapes. There is no request to smooth or polish them.

The ZIP contains uppercase, lowercase, digit/punctuation and optional phrase
sheets, each with a blank and an illustrative filled example. Open a blank at
100% in MS Paint, draw in black with the mouse, and save at the original pixel
dimensions. Caps are about 36 px high; lowercase bodies about 22 px. A 3 px round
brush is a starting suggestion, not a requirement. Three independent samples per
character allow natural variation; one is enough for an initial trial. Leave
guides in place. The examples show placement, not the user's final style.

`tools/build-handwriting-png-templates.py` regenerates the pack using Pillow.
Example strokes are drawn directly on the output grid without supersampling,
outline-font rendering, curve fitting or resizing. `sheet-layout.json` records
sampling boxes and baselines. The ZIP and cell contents are checked by the
generator. The original template pack remains available alongside the application downloads.

## Implemented mouse-lettering tool in 1.0.10

Choose **Mouse writing** on Home and draw a box to type with the original bitmap
glyphs from the completed sheets. The Lettering ribbon controls size, colour,
negative or positive letter spacing, word spacing, line gap and an upward offset
range of 0 to X pixels per character. Choices and offsets stay stable during
edits, saves and exports. **Shuffle** changes both character variants and their
upward offsets, with its own Undo/Redo step. There is one lettering style, so
there is no font dropdown. Setting X to zero disables added vertical variation.

Nearest-neighbour scaling keeps the rough pixel edges. Whole-number enlargement
preserves the source pixel pattern exactly; fractional scaling or reduction
cannot preserve every source pixel. Phrase samples help with spacing and joined
strokes; isolated glyphs alone cannot reproduce all connected handwriting.

The completed PNGs are now supplied under `assets/lettering/user-sheets`.
`tools/extract-lettering-samples.mjs` produces the actual 95-character/285-variant
sample atlas and a source checksum record without outline fitting or smoothing.
The Mouse writing tool and Lettering ribbon are implemented in 1.0.10, including
local sheet import, Shuffle, negative spacing and saved vertical variation.
Full release validation is recorded in `docs/TESTING.md`.
