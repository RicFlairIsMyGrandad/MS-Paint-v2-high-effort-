# PaintPlus architecture and acceptance plan

The only supplied visual reference is the PaintPlus concept image. Its title bar,
30 px tab strip, roughly 110 px ribbon, narrow group separators, dense two-row
palette, rulers, three-column asset grid and layer list are the layout targets.
No Microsoft artwork or branding is used.

The Electron main process owns dialogs, filesystem access, clipboard and user
settings. A context-isolated preload exposes a small, validated IPC API; renderer
Node integration is disabled. Everything runs locally and no telemetry is sent.

The renderer document owns canvas dimensions and ordered raster layers. Painting
edits the selected layer. Objects retain their immutable source canvas and store
position, size, angle and flips separately. Text stores its content and style.
Every preview renders from the original source. Rasterization uses a worker-based
Lanczos filter or nearest-neighbour, never a chain of resized images.

Undo uses commands. Raster strokes record changed 64 px tiles; transforms and
layer metadata share immutable source references. Whole-canvas operations need
larger snapshots. History is bounded by both count and retained byte size. UI,
asset indexing, project serialization and document history are separate modules.

The asset index references imported files on desktop. Removing an asset only
removes the index record. A library record never deletes a user's source file.
Bundled original demonstration artwork is separate from a new blank document.

CPU background removal runs U2NetP ONNX in a dedicated local Web Worker. Its
model and WASM runtime are bundled; it makes no runtime download or upload.

Validation: Node raster/model tests; Chromium integration tests for input,
transforms, panel persistence, exports and regressions; actual desktop launch
and native IPC checks on Linux; Windows packaging and executable inspection.
Linux tests do not establish that the installer has run on a Windows laptop.
Brush fidelity is a visual approximation until the absent Paint brush comparison
can be supplied and a Windows baseline measured.
