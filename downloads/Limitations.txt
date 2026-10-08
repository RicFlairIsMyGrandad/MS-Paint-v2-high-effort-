# Remaining limitations — 1.0.1

These are known differences or unverified areas, not completed acceptance claims.

1. **Home-edition laptop verification is outstanding.** The exact downloadable
   Setup and Portable EXEs passed on hosted Windows Server 2022 (10.0.20348)
   and Windows Server 2025 (10.0.26100). Checks include installation, packaged
   startup/drawing, clipboard alpha, native saving, offline AI, shortcut targets,
   the project association command, portable launch and uninstall preserving a
   user project. These checks do not prove that the user's Windows 10 Home or
   Windows 11 Home laptop now starts successfully. The original laptop failure
   has not been reproduced on that hardware. High-DPI/multiple-display behavior,
   touch/stylus input, launching projects through Explorer's default-app choice,
   long sessions and SmartScreen reputation remain unverified on a laptop.
2. **The app and installer are unsigned.** A signing certificate and reputation
   are not included. This is disclosed in the installation instructions.
3. **Paint fidelity is close in layout, not exact in all behavior.** Only the
   PaintPlus concept screenshot was attached. The separate Windows 10 Paint and
   brush-comparison / issue images described in the specification were not supplied.
   Pencil uses integer raster lines and the round brush uses continuous rounded
   strokes. Calligraphy, spray, oil, crayon, marker and watercolor are original
   approximations, without pixel-for-pixel validation against mspaint.exe.
4. **Text uses an editing dialog**, rather than Paint's inline text box and
   contextual text ribbon. Text content, font, size, bold/italic style and opaque
   background are editable and preserved in projects. Advanced typography and
   automatic line wrapping are not implemented.
5. **Some classic Paint commands are absent:** invert selection, print / print
   preview, scanner / camera acquisition, skew, and brush-textured shape outlines
   or fills. Shapes support solid outline, no outline, solid fill and no fill.
   The main requested pencil/brush/eraser/fill/picker/selection/transform workflow
   is implemented; this is not a claim of every classic Paint command.
6. **Raster selections operate on the active layer**, not a merged selection
   across several raster layers. Image/text objects can be selected and grouped
   across layers; group transforms, flips, duplicates and project persistence work.
   Only raster layers and simple groups are supported, without Photoshop effects,
   masks, blending modes or nested group hierarchies.
7. **The asset index is a saved index**, not a live filesystem watcher. Imports
   reference files without copying them. New or moved files require re-importing
   the folder or files. Removing assets never deletes originals. Only the library
   category names are renamed; source filesystem directories are not renamed.
8. **AI is CPU-only U2NetP.** It is genuinely local and tested, but imperfect on
   hair, fine edges, overlapping subjects and complex scenes. Threshold and softness
   refinement are provided; manual mask painting and GPU acceleration are absent.
9. **Limits:** nominal dimensions are capped at 16,384 px per side and 64 million
   pixels, subject to a conservative 512 MB image working-memory estimate.
   Operations that exceed this estimate are rejected before allocation. The
   estimate includes primary layer/source canvases, display buffers, undo and
   transform buffers. Browser caches, color-key copies and runtime allocations
   can add memory; it is not a hard bound on total operating-system RAM.
   Undo and redo together retain up to 80 commands and 128 MB, including distinct
   historical canvas references. A single larger operation is not retained in
   history and displays a notice. Very large files and extended long-session
   memory use have not been stress-tested on a Windows laptop.
10. **Formats:** PNG, JPEG, BMP and WebP export are supported. GIF opens as a static
    image. Animated GIF, TIFF, color profiles / CMYK and EXIF-orientation workflows
    are not independently verified. Flattened export does not preserve editable
    state; use .paintplus projects for that.

The demonstration scene uses original artwork and a blank Foreground layer
reserved for painting. It is illustrative content, not a copied screenshot.
The final screenshot is captured from the running desktop application.
