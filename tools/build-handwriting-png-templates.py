#!/usr/bin/env python3
"""Create native-size mouse-writing worksheets, not a font or an app build.

Requires Pillow. All sample strokes are drawn directly on the output pixel grid;
there is no supersampling, fitted font outline, or image rescaling. Illustrative
examples use the existing original centreline source, not the user's handwriting.
"""
from pathlib import Path
import hashlib
import json
import random
import string
import zipfile

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "downloads/handwriting-png"
OUT.mkdir(parents=True, exist_ok=True)
STROKES = json.loads((ROOT / "assets/fonts/grade-wobble-source.json").read_text())["strokes"]
WIDTH, HEADER, ROW, FOOTER = 1000, 166, 88, 72
INK, BORDER, GUIDE, CAP, MID = "#000000", "#d0dce6", "#81accb", "#d0e0ed", "#e1ebf3"


def font(size, bold=False):
    names = ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
             "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def label(draw, xy, text, size=13, color="#334155", bold=False):
    draw.text(xy, text, font=font(size, bold), fill=color)


def new_sheet(title, example=False, phrases=False):
    rows = 6 if phrases else (len(title[1]) + 3) // 4
    height = HEADER + rows * (108 if phrases else ROW) + FOOTER
    image = Image.new("RGB", (WIDTH, height), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH - 1, 5), fill="#7860a7" if example else "#287fac")
    label(draw, (24, 17), "MOUSE LETTERING / " + ("FILLED EXAMPLE" if example else "BLANK PNG"), 14, "#536577", True)
    label(draw, (24, 40), title[0], 25, "#162536", True)
    if example:
        lines = ["LAYOUT EXAMPLE ONLY - these are illustrative strokes, not your final lettering.",
                 "Black samples are drawn at native resolution: rough edges and imperfect repeats are intentional.",
                 "Fill the matching BLANK file in your own style. Do not trace or copy these sample shapes."]
    elif phrases:
        lines = ["Optional: write each phrase naturally, in black, with your mouse. Preserve your usual spacing and joins.",
                 "Open in MS Paint at 100%. Keep the image size unchanged. Use the same brush as your letter sheets.",
                 "Write below each printed prompt. The light-blue guides can stay; do not erase them."]
    else:
        lines = ["Open in MS Paint at 100%. Draw in black with your mouse; a 3 px round brush is a useful starting point.",
                 "Write ONE character in each box. Three natural versions help; avoid copy/pasting identical repeats.",
                 "Use the blue baseline loosely. Keep your wobble and pixel edges. Do not resize, smooth, or save as JPEG."]
    for i, line in enumerate(lines):
        label(draw, (24, 83 + i * 20), line, 13)
    return image, draw, height


def guides(draw, x, y, w=60, h=64):
    draw.rectangle((x, y, x + w - 1, y + h - 1), outline=BORDER)
    draw.line((x + 1, y + 9, x + w - 2, y + 9), fill=CAP)
    for a in range(x + 2, x + w - 2, 5):
        draw.line((a, y + 23, min(a + 2, x + w - 2), y + 23), fill=MID)
    draw.line((x + 1, y + 45, x + w - 2, y + 45), fill=GUIDE)


def sample_paths(char, variant):
    seed = int.from_bytes(hashlib.sha256(f"illustration/{char}/{variant}".encode()).digest()[:8], "big")
    rng = random.Random(seed)
    paths = []
    for path in STROKES[char].split("|"):
        points = [tuple(map(float, point.split(","))) for point in path.split()]
        # Deliberate native-pixel bends and slightly different repeats. No curve
        # fitting or smoothing of the existing centreline approximation.
        paths.append([(round(x * .36) + rng.choice([-1, 0, 0, 1]),
                       round(-y * .36) + rng.choice([-1, 0, 0, 1])) for x, y in points])
    return paths


def sample(draw, char, x, baseline, variant):
    paths = sample_paths(char, variant)
    xmin = min(px for path in paths for px, _ in path)
    xmax = max(px for path in paths for px, _ in path)
    for path in paths:
        points = [(x + px - xmin + 2, baseline + py) for px, py in path]
        draw.line(points, fill=INK, width=3)
        for px, py in points:
            draw.ellipse((px - 1, py - 1, px + 1, py + 1), fill=INK)
    return xmax - xmin + 6


def footer(draw, height, example=False, phrases=False):
    y = height - FOOTER + 8
    text = "Save as PNG, keep the original pixel dimensions, and return the filled BLANK files. No scan is needed."
    if example:
        text = "This example demonstrates placement and separate variants. Your own samples should supply the final shapes."
    label(draw, (24, y), text, 13)
    label(draw, (24, y + 22),
          "Guides: upper pale line = caps/ascenders (~36 px); dotted line = lowercase body (~22 px); blue = baseline.", 12, "#64748b")
    label(draw, (24, y + 42), "Let g, j, p, q and y extend below the baseline. Neatness and perfectly uniform heights are not required.", 12, "#64748b")


manifest = {"format": "PaintPlus mouse-lettering sample sheets v1", "nativeBrushSuggestionPx": 3,
            "approximateCapHeightPx": 36, "approximateLowercaseBodyPx": 22,
            "examples": "Illustrations only; not an exact reconstruction of the user's sample", "sheets": []}

sets = [("01-Uppercase", "Uppercase / A-Z", list(string.ascii_uppercase)),
        ("02-Lowercase", "Lowercase / a-z", list(string.ascii_lowercase)),
        ("03-Digits-Symbols", "Digits and punctuation / fill the symbols you use", list(string.digits + string.punctuation + "£"))]
created = []
for slug, title, chars in sets:
    cells = []
    for example in [False, True]:
        image, draw, height = new_sheet((title, chars), example)
        for index, char in enumerate(chars):
            gx, gy = 24 + index % 4 * 238, HEADER + index // 4 * ROW
            label(draw, (gx, gy + 27), char, 20, "#334155", True)
            for variant in range(3):
                x, y = gx + 28 + variant * 68, gy + 18
                label(draw, (x + 25, gy - 1), str(variant + 1), 11, "#64748b")
                guides(draw, x, y)
                if example:
                    sample(draw, char, x + 11, y + 45, variant)
                else:
                    cells.append({"character": char, "variant": variant + 1,
                                  "insideBox": [x + 1, y + 1, 58, 62], "baselineY": y + 45})
        footer(draw, height, example)
        name = f"{slug}-{'EXAMPLE' if example else 'BLANK'}.png"
        image.save(OUT / name, optimize=True)
        created.append(name)
    manifest["sheets"].append({"blank": f"{slug}-BLANK.png", "example": f"{slug}-EXAMPLE.png",
                               "width": WIDTH, "height": height, "cells": cells})

phrases = ["So Predictable", "All-Female Cast Remake", "Kevin Hart", "The Rock", "So Boring", "Crowbar In Woke Agenda"]
phrase_regions = []
for example in [False, True]:
    image, draw, height = new_sheet(("Natural word spacing / optional phrase samples", []), example, phrases=True)
    for row, phrase in enumerate(phrases):
        y = HEADER + row * 108
        label(draw, (24, y - 1), phrase, 13, "#334155", True)
        x, top = 24, y + 23
        guides(draw, x, top, 952, 68)
        if example:
            pen = x + 16
            for index, char in enumerate(phrase):
                pen += 12 if char == " " else sample(draw, char, pen, top + 45, index % 3) - 1
        else:
            phrase_regions.append({"prompt": phrase, "insideBox": [x + 1, top + 1, 950, 66], "baselineY": top + 45})
    footer(draw, height, example, phrases=True)
    name = "04-Phrases-" + ("EXAMPLE" if example else "BLANK") + ".png"
    image.save(OUT / name, optimize=True)
    created.append(name)
manifest["sheets"].append({"blank": "04-Phrases-BLANK.png", "example": "04-Phrases-EXAMPLE.png",
                           "width": WIDTH, "height": height, "phrases": phrase_regions})
(OUT / "sheet-layout.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
created.append("sheet-layout.json")

instructions = """MOUSE LETTERING - NATIVE PIXEL PNG SAMPLES

These PNGs replace the high-resolution scan request for this mouse-drawn style.
They are worksheets only. No new application or EXE is included.

1. Open each file ending -BLANK.png in MS Paint at 100% zoom.
2. Use black and your mouse with the same normal Brush that produced the style
   you like. Try 3 px to start; choose your own width if that better matches it.
   Pencil is an option for harder edges, but is not required.
3. Draw one character in each numbered box, with three naturally different
   versions if possible. Do not copy/paste identical repeats or trace EXAMPLE.
   Start with the alphabet and digits; unused punctuation can remain blank.
   One sample per character is enough for a first trial; more variants help.
4. Caps/ascenders are roughly 36 pixels high and lowercase bodies roughly 22.
   Follow the baseline loosely. Keep your natural wobble and messy proportions.
   The descenders of g/j/p/q/y go below the blue baseline.
5. Leave the guides and labels in place. They can be removed by comparing your
   completed file with the original blank; you do not need to clean around them.
6. Optionally fill 04-Phrases-BLANK.png to show your usual word spacing and joins.
7. Save as PNG, keep the original dimensions, and return the filled blank files.
   Do not resize, smooth, trace, export to JPEG, or scan the completed images.

Files ending -EXAMPLE.png show the expected layout, not your final handwriting.
Their deliberately rough black strokes are drawn directly on the pixel grid.
The typed grey labels are instructions, not shapes to imitate.

PROPOSED SEPARATE MOUSE-LETTERING TOOL - NOT IMPLEMENTED IN THIS DOWNLOAD

Drag a text box and type. A dedicated ribbon would offer size, colour, letter
spacing (including negative values), word/line spacing, and a maximum upward
offset X. Each typed character would get an offset from 0 to X and optionally
one of your sample variants. Store those choices so typing, saving or reopening
does not randomly move existing letters; a Shuffle action can intentionally
change them. X=0 disables the extra upward variation.

The intended renderer keeps the actual sample pixel shapes. Nearest-neighbour
scaling avoids blur; whole-number enlargement preserves the original pixel
pattern most faithfully. Smaller or fractional sizes necessarily change which
pixels fit and cannot preserve every original pixel unchanged. Exact joined
handwriting needs phrase/connection samples in addition to isolated letters.
The completed lettering sheets are needed before implementing the real style.
"""
(OUT / "READ-ME.txt").write_text(instructions)
created.append("READ-ME.txt")

# Verify that empty worksheets contain no dark ink inside any sampling cell,
# filled examples have ink in every requested cell, and nothing was enlarged.
for sheet in manifest["sheets"]:
    blank = Image.open(OUT / sheet["blank"])
    example = Image.open(OUT / sheet["example"])
    assert blank.size == example.size == (sheet["width"], sheet["height"])
    for cell in sheet.get("cells", sheet.get("phrases", [])):
        x, y, width, height = cell["insideBox"]
        bounds = (x, y, x + width, y + height)
        assert not any(max(pixel) < 100 for _, pixel in blank.crop(bounds).getcolors(width * height))
        assert any(pixel == (0, 0, 0) for _, pixel in example.crop(bounds).getcolors(width * height))

bundle = OUT / "Mouse-Lettering-PNG-Pack.zip"
with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in created:
        archive.write(OUT / name, "Mouse-Lettering/" + name)
with zipfile.ZipFile(bundle) as archive:
    assert archive.testzip() is None
created.append(bundle.name)
(OUT / "SHA256SUMS.txt").write_text("".join(f"{hashlib.sha256((OUT / name).read_bytes()).hexdigest()}  {name}\n" for name in created))
for name in created:
    print(f"{name}: {(OUT / name).stat().st_size:,} bytes")
print("Verified: native dimensions, blank cells, filled sample cells and ZIP integrity.")
