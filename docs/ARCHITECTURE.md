# PaintPlus architecture

The supplied concept and annotated Paint comparison images guide the title bar,
tab strip, ribbon groups, palette, rulers, asset browser and layer list. Colored
SVG icons and custom cursors are original Paint-style redraws; exact Microsoft
resource files and pixel-identical geometry are not supplied by this project.

The Electron main process owns filesystem dialogs, native clipboard and settings.
The context-isolated preload exposes a validated IPC API; renderer Node integration
is disabled. The application and AI run locally without telemetry.

The document owns dimensions and ordered raster layers. Raster paint edits the
active layer. Floating image objects preserve their source canvases and carry
position, dimensions, angle, flips and sampling properties. Editable shapes also
store normalized geometry and style; resizing regenerates the raster preview
rather than stretching a stroke. Text stores content and whole-box formatting,
wrap width, padding, line gap and optional speech-bubble style. A stage textarea
supports inline editing over a background-only preview; finished text uses its
rendered source canvas and remains editable in project files.

The image display remains at document pixel resolution with pixelated CSS scaling.
A separate device-pixel-resolution overlay covers only the visible viewport.
Selection outlines and handles divide by zoom to maintain constant screen size.
Fixed zoom levels live in core/zoom.js. Pointer coordinates derive from the image
canvas, independent of the clipped overlay's position.

Undo commands record changed 64px raster tiles or immutable canvas/metadata
references. Paste expansion and insertion form one transaction. Live text editing
forms one document command when the typing session finishes. Shape formatting,
layer deletion, transforms and Shift trails are undoable. History bounds both
command count and distinct retained image bytes. Allocation estimates reject
oversized operations before creating full-image buffers.

The asset library is an index of imported paths or embedded browser imports.
Removing an entry never deletes a source file. Panel width and folder/thumbnail
proportions are saved preferences. Categories can be renamed and removed.

U2NetP runs in a dedicated offline ONNX WASM worker. The worker returns original
RGB with a hard mask and a separate floating-point foreground confidence array.
Refinement combines that confidence with original source alpha, so lowering the
threshold can restore weak edges and increasing softness creates smooth coverage.
The nonmodal refinement panel allows zoom/inspection. Applied pixel results are
saved; the transient confidence array is not serialized.

Node tests cover real raster pixels, document/history, editable rendering, zoom,
mask functions and packaged resource routing. Chromium tests exercise actual
pointer/keyboard workflows. Packaged Electron checks and Windows CI exercise the
installed ASAR and exact candidate EXEs, including native clipboard and offline AI.
See TESTING.md for current results and LIMITATIONS.md for remaining differences.
