# PaintPlus

A local desktop painting application inspired by classic Windows 10 Paint,
with raster layers, editable assets, high quality transforms and offline AI
background removal. This is an independent application, not a Microsoft product.

## Install on your laptop

**[Download the Windows installer](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/raw/refs/heads/main/downloads/PaintPlus-Setup-1.0.1-x64.exe)**
([portable version](https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/raw/refs/heads/main/downloads/PaintPlus-Portable-1.0.1-x64.exe)).
The [downloads folder](downloads/) also contains the complete source archive,
screenshots, example project, instructions, limitations and SHA-256 checksums.

1. Download **PaintPlus-Setup-1.0.1-x64.exe**.
2. Open it and follow the installer. It installs for your Windows user account.
3. Launch PaintPlus from your desktop or Start menu.

You need **64-bit Windows 10 or Windows 11**. No Python, Node.js, command line,
account or dependency installation is needed. The installed application uses
about **321 MB**. All editing and background removal work locally.

The installer is **unsigned**. Windows SmartScreen may say "Windows protected
your PC" because there is no purchased signing certificate. If you trust the
download, **More info → Run anyway** continues. You can scan the file first.
SHA-256 hashes are supplied in **SHA256SUMS.txt** alongside the downloads.

Alternatively, download **PaintPlus-Portable-1.0.1-x64.exe** and double-click it.
It extracts its own runtime temporarily and starts the app. It does not install
Start menu entries or a project-file association. Settings still live in your
Windows user profile. The installer is the recommended option.

Version 1.0.1 adds software rendering on Windows and a visible startup error screen.
If startup fails, the screen identifies the local startup.log, usually at
`%APPDATA%\PaintPlus\startup.log`. Close the old app before running the new installer.
See [the release notes](docs/RELEASE-1.0.1.md) for the startup, transparency and memory changes.

## Getting started

- **File → Open example scene** opens the scene shown in the screenshot. Use
  **File → New** for a blank image, or **File → Open** to edit a picture.
- Choose Pencil or a brush, select Color 1, and draw. Right-drag uses Color 2.
  Right-click a palette color to set Color 2. The final palette color is exactly
  **#1847F1 (RGB 24, 71, 241)**.
- **Size** controls line width. **Ctrl+Numpad Plus / Minus** changes it by exactly
  one pixel. Shift constrains drawing angles or shape proportions.
- Use the white handles on the right edge, bottom edge or bottom-right corner
  to change the **canvas boundary**. This does not stretch the picture.
- **Select** offers rectangular and free-form selection and Color-2 transparency.
  Draw a selection, then move or resize its floating object. The eraser replaces
  pixels with Color 2 on Background and removes alpha on transparent layers.
  Right-drag the eraser replaces only exact Color-1 pixels with Color 2.
- For Curve, draw its initial line, then drag two bend points. For Polygon, draw
  the first edge and click more corners; double-click or Enter finishes it.
- Double-click an asset to insert it. It starts at **(0,0)** at its **original
  pixel dimensions**, regardless of zoom. Drag its handles to transform it.
- **Resize** opens exact dimensions, percentage sizing, aspect locking, rotation,
  flips, Lanczos / nearest-neighbour choice and transparent-color controls.
  The original source is preserved until **Commit**, Enter, or switching to a
  drawing tool rasterizes the floating content on the active layer.
- Drawing modifies the active raster layer. Brush strokes do **not** create
  layers. The Layers panel can hide, lock, rename, duplicate, reorder and merge
  layers. Double-click a layer name to rename it. Ctrl-click objects or layer
  rows to select several; **Ctrl+G** groups and **Ctrl+Shift+G** ungroups.
- Use **Add Folder** to index an existing image folder, or the image button to
  import files. Use the gear menu for categories. Right-click assets for
  Favorites, insertion, category changes, Alt shortcuts or removal. Removing an
  asset only removes its library record; it never deletes its original file.
- Click the **×** on either panel to collapse it into a thin tab. Click the tab
  to restore it. Panel state, library entries and tool shortcut settings persist.
- **AI Remove Background** works on a selected image or the active raster layer.
  Its bundled U2NetP model runs on CPU, with no upload or first-run download.
  You can refine threshold and edge softness. Undo restores the original.

## Saving your work

Use **File → Save editable project** to preserve layers, original images,
transformations, text and groups. Projects end in **.paintplus**. Their source
images are embedded, so the project can reopen even if an original asset moves.

PNG, JPEG, BMP and WebP exports flatten visible layers. PNG and WebP preserve
alpha. JPEG and BMP use a white matte. Lanczos is applied from original object
sources during export, so export does not depend on a low-quality drag preview.

For **Quick Save**, choose a folder using the folder button at the upper-right,
type a name, choose a format, and click Quick Save. Existing files receive
`name (2).png`, `name (3).png` and so on; no repeated Save As dialog is shown.
The folder is remembered. **Ctrl+S** saves the current file; **Ctrl+Shift+S**
opens Save As. Save a project as well if you want to keep editability.

Number tool shortcuts are listed at the lower-right. **Edit Shortcuts** changes
them and flags duplicate assignments. Windows clipboard shortcuts, save
shortcuts and Ctrl+Numpad +/- remain reserved. Shortcuts do not interrupt typing
in text fields. Ctrl+wheel zooms; View also offers rulers, gridlines and zoom.

## What is tested, and what remains

The automated test results and complete limitations are in
[docs/TESTING.md](docs/TESTING.md) and [docs/LIMITATIONS.md](docs/LIMITATIONS.md).
The exact downloadable Setup and Portable EXEs passed native checks on hosted
Windows Server 2022 and 2025, including installation, startup, drawing, clipboard
alpha, file saving, offline AI, shortcuts, project association and uninstall.
All 35 core/resource tests and 36 UI tests passed on both Windows runners and Linux.
**The user's Windows 10 Home and Windows 11 Home laptops still need a retry.**
The original white-screen failure on that hardware has not been reproduced.

The interface closely follows the supplied concept layout. This release is
not an exact reproduction of every classic Paint behavior: textured brushes
are approximations, text entry uses a dialog, and some legacy Paint commands
are not included. Those differences are explicitly listed in the limitations.

The source download includes the application, automated tests, original demo
artwork, AI model, project-format documentation and developer build instructions.
Developer instructions are separate: [docs/BUILD.md](docs/BUILD.md).

## Privacy and removal

PaintPlus has no accounts, telemetry, advertising, cloud editing, auto-update
service, startup registration or unrelated bundled software. Projects and
images stay on your computer. Uninstall it from Windows **Settings → Apps**.
Your saved images, original assets and per-user settings are retained.

Application code is MIT-licensed. Third-party notices and model provenance are
in [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md). Demo artwork is original generated
artwork created for this application.
