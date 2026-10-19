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
generator. No existing app, EXE, font or 1.0.9 download is modified.

## Proposed tool, awaiting completed samples

A separate mouse-lettering tool can use bitmap glyphs from the completed sheets
and offer a box for typing, size, colour, negative or positive letter spacing,
word/line spacing and an upward offset range of 0 to X pixels per character.
Sample choices and offsets should be stored with the text, stable during edits,
saves and exports, with an explicit Shuffle command. A fixed style needs no font
dropdown. Setting X to zero disables added vertical variation.

Nearest-neighbour scaling keeps the rough pixel edges. Whole-number enlargement
preserves the source pixel pattern exactly; fractional scaling or reduction
cannot preserve every source pixel. Phrase samples help with spacing and joined
strokes; isolated glyphs alone cannot reproduce all connected handwriting.

This document describes a proposal. The separate lettering tool has not been
implemented, and no new installer is being built before receiving the samples.
