# PaintPlus 1.0.6 validation checkpoint

128 Node tests and 127 Chromium workflows pass locally, with zero failures,
skips or flaky cases. The production build passes. The packaged Linux ASAR
passes the new ruler, brush, raster-group, selection, bubble-tail, pointing-hand,
paste and quarter-turn checks plus startup, fonts, native clipboard, save/export
and offline AI checks. It records no renderer errors or external requests.
An additional browser regression opens a legacy bubble project and verifies
both tail sliders. Existing pointing-hand selections expose their wobble control.
Screenshots in docs/screenshots come from this running 1.0.6 package.

Exact Windows installer/portable validation is pending. Final reports will replace
this checkpoint after both hosted Windows runners install the published candidate,
exercise the packaged app, launch Portable and check uninstall. The user's
particular Windows 10/11 Home laptop has not been physically tested.
