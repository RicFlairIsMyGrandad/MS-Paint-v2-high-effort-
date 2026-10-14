# Validation of PaintPlus 1.0.4

84 Node tests and 87 Chromium workflows pass locally. New regressions cover
visible brush caps, binary freeform previews, Color-2 layer removal, cut into
new layer with undo, stable visibility clicks, universal handles, outside-click
confirmation, text key handling, two-digit/fractional font sizes, dropdowns,
underline thickness/descender gaps, fixed bubble geometry and grey shadows.
The production Vite build passes.

The packaged Linux app passes startup, default dimensions, pointer drawing,
shapes, mixed text formatting, stable typing pixels, two-digit font size entry,
bubble shadows, outside confirmation, selection context menu, Color-2 cut layer,
visibility clicks, native fonts/clipboard, PNG/project saves and offline AI.
It reports no renderer errors or external requests.

Exact Windows candidate validation is in progress at this source checkpoint. Final native logs, screenshots, source revision and file
hashes will be published after those checks complete. Older evidence is retained
in Git history and is not proof for this release.

Hosted Windows Server tests do not verify the user's particular Windows 10/11
Home laptop. High DPI, multiple monitors, stylus input and long sessions remain
unverified on that hardware. Microsoft cursor resources and GDI glyph pixels
are approximated; known incomplete features are listed in LIMITATIONS.md.
