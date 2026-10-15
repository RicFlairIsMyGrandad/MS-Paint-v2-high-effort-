# PaintPlus 1.0.8

| Request | Implemented behavior |
| --- | --- |
| Layer transparency | **Use Color 2 as transparency**, immediately above the asset-layer checkbox, switches between exact secondary-colour keying and standard PNG alpha. Uncheck it to retain all painted colours and erase upper layers to real transparency. The bottom canvas remains the paper layer. Switching modes preserves source pixels; projects save the mode and new documents use the saved preference. Older projects keep their original keyed appearance. |
| Layer renaming | Double-click the layer **name** to edit it in place. Enter/blur saves; Escape cancels. The eye and other layer controls do not trigger renaming. Right-click → Rename layer remains available. |
| Layer activation | Layer rows and group headers activate their target without selecting or lifting canvas content and preserve the current drawing tool. Select canvas regions yourself. Shift/Ctrl still selects layer rows for grouping. |
| Compact layer options | Both preference rows have the same 32px height as Lock Background/Group/Commit. |
| Tone slider | Drag anywhere on the right-hand luminance ramp or its arrow. It reaches the exact black and white endpoints and synchronizes the RGB/HSL fields. Keyboard adjustments remain available. |
| Custom ribbon colours | The bottom palette row starts with nine empty custom slots and fixed RGB 24/71/241 at the right. Click an empty slot to define it. Edit Colors → OK applies and saves the colour to the ribbon; Add to Custom Colors saves it in the dialog and ribbon. Filled custom cells can be selected and edited again. Custom colours survive restart. |
| Text background | Exactly three exclusive checkboxes: **Transparent**, **White** (RGB 254/255/255), and **Custom**. Custom opens Edit Colors; the adjacent swatch reopens it. Text-colour changes preserve the bubble fill and outline. |

Selecting a layer alone never flattens its editable content. A subsequent raster
paint or area edit renders participating floating objects to pixels; one undo
restores the original objects. An unchanged cancelled selection or a fill that
changes nothing restores the original editable content without an undo entry.

The ninth custom slot is followed by the permanent blue cell. Once all nine
custom slots are full, a new shade uses a rotating replacement slot unless a
specific custom cell was selected for editing. Existing non-white custom colours
from earlier versions migrate to the ribbon. The dialog retains its separate
sixteen saved slots. A cancelled dialog does not apply a new paint colour;
colours explicitly added before Cancel remain saved.

The setup upgrades previous installations. All prior startup diagnostics and
software rendering fixes remain. See LIMITATIONS.md for incomplete features and
physical laptop verification boundaries.

Validation results will be recorded in TESTING.md after native package checks.
