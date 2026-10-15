import { icon, shapeIcon, shapeNames } from "./icons.js";
export const tools = [
  "select",
  "free",
  "brush",
  "pencil",
  "fill",
  "text",
  "shape",
  "dropper",
  "transparent",
  "move",
  "eraser",
  "zoom",
];
export const labels = {
  select: "Rectangular select",
  free: "Free-form select",
  brush: "Brush",
  pencil: "Pencil",
  fill: "Fill with color",
  text: "Text",
  shape: "Shape",
  dropper: "Color picker",
  crop: "Crop",
  transparent: "Toggle transparent selection",
  move: "Select / transform",
  eraser: "Eraser",
  zoom: "Magnifier",
};
export const palette = [
  "#000000",
  "#7f7f7f",
  "#880015",
  "#ed1c24",
  "#ff7f27",
  "#fff200",
  "#22b14c",
  "#00a2e8",
  "#3f48cc",
  "#a349a4",
  "#ffffff",
  "#c3c3c3",
  "#b97a57",
  "#ffaec9",
  "#ffc90e",
  "#efe4b0",
  "#b5e61d",
  "#99d9ea",
  "#7092be",
  "#c8bfe7",
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  "#1847F1",
];
export function button(action, label, ico, cls = "", title = label) {
  return `<button class="${cls}" data-action="${action}" title="${title}" aria-label="${title}">${ico ? icon(ico) : ""}${label ? `<span>${label}</span>` : ""}</button>`;
}
export function layout() {
  return `
 <header class="titlebar"><div class="brand" title="PaintPlus"><img src="icon.png" width="24" height="24" alt="PaintPlus"></div><div class="quick-access">${button("save", "", "save")}${button("undo", "", "undo", "blue", "Undo · Ctrl+Z")}${button("redo", "", "redo", "blue", "Redo · Ctrl+Y")}<span class="title-divider"></span></div><span id="window-title">Untitled — PaintPlus</span><div class="window-buttons">${button("minimize", "−", "")}${button("maximize", "□", "")}${button("close", "×", "")}</div></header>
 <nav class="tabs"><button data-action="file" class="file-tab">File</button><button data-tab="home" class="tab active">Home</button><button data-tab="view" class="tab">View</button><button data-tab="text" class="tab text-tab hidden">Text</button><div class="tabs-right"><button data-action="toggle-ribbon" title="Collapse ribbon">⌃</button><button data-action="help" class="help" title="PaintPlus help">?</button></div></nav>
 <section class="ribbon" id="home-ribbon">
   <div class="ribbon-group clipboard"><div class="group-content">${button("paste", "Paste", "paste", "ribbon-large")}<div class="ribbon-stack">${button("cut", "Cut", "cut")}${button("copy", "Copy", "duplicate")}</div></div><div class="group-label">Clipboard</div></div>
   <div class="ribbon-group image-group"><div class="group-content"><div class="selection-controls"><div class="selection-buttons">${button("tool:select", "", "select", "tool-button selected", "Rectangular selection")}${button("tool:free", "", "free", "tool-button", "Free-form selection")}</div><label class="transparent-toggle"><input id="selection-transparent" type="checkbox">Transparent</label></div><div class="ribbon-stack">${button("crop", "Crop", "crop")}${button("resize", "Resize", "resize")}${button("rotate-menu", "Rotate ▾", "rotate")}</div></div><div class="group-label">Image</div></div>
   <div class="ribbon-group tools-group"><div class="tool-grid">${["pencil", "fill", "text", "eraser", "dropper", "zoom"].map((t) => button("tool:" + t, "", t, "tool-button", labels[t])).join("")}</div><div class="group-label">Tools</div></div>
   <div class="ribbon-group brush-group"><div class="group-content"><div class="brush-split">${button("tool:brush", "", "brush", "brush-button tool-button", "Brush")}${button("brush-menu", "Brushes ▾", null, "brush-menu-button", "Choose brush type")}</div></div><div class="group-label">Brushes</div></div>
   <div class="ribbon-group shapes-group"><div class="group-content"><div class="shape-gallery">${shapeNames.map((s) => `<button data-shape="${s}" title="${s==='handLine'?'Pointing hand line':s==='handCurve'?'Pointing hand curve':s}" aria-label="${s==='handLine'?'Pointing hand line':s==='handCurve'?'Pointing hand curve':s}">${shapeIcon(s)}</button>`).join("")}</div><div class="ribbon-stack shape-options"><label>${icon("pencil", 17)}<select id="outline" title="Shape outline"><option value="solid">Outline</option><option value="none">No outline</option></select></label><label>${icon("fill", 17)}<select id="shape-fill" title="Shape fill"><option value="none">No fill</option><option value="solid">Solid fill</option></select></label></div></div><div class="group-label">Shapes</div><label class="hand-wobble hidden"><input type="checkbox" id="hand-wobble"> Hand-drawn wobble</label></div>
   <div class="ribbon-group size-group"><button class="ribbon-large" data-action="size-menu" title="Line width"><span class="line-sample"><i></i><i></i><i></i></span><span>Size ▾</span></button><div class="group-label" id="width-label">4 px</div></div>
   <div class="ribbon-group colors-group"><div class="group-content"><button data-action="color1" class="color-button selected"><i id="color1-swatch"></i><span>Color<br>1</span></button><button data-action="color2" class="color-button"><i id="color2-swatch"></i><span>Color<br>2</span></button><div class="palette">${palette.map((c,i)=>`<button class="color-chip ${i>=20&&i<29?'custom-color-slot empty-color':''} ${i===29?'special-color':''}" ${i>=20&&i<29?`data-palette-slot="${i-20}"`:''} ${c?`data-color="${c}"`:''} style="--chip:${c||'#f5f5f5'}" title="${c||'Choose a custom color'}${i===29?' · Signature blue':''}" aria-label="${c?'Color '+c:'Empty custom color '+(i-19)}"></button>`).join("")}</div>${button("custom-color", "Edit<br>colors", null, "ribbon-large edit-colors")}</div><div class="group-label">Colors</div></div>
   <div class="ribbon-group extra-group"><div class="group-content">${button("background-remove", "AI Remove<br>Background", "ai", "ribbon-large ai-button")}${button("settings", "Settings", "gear", "ribbon-large settings-button")}</div></div>
   <div class="ribbon-group canvas-dimensions"><label>Width <input id="canvas-width" type="number" min="1" max="16384" value="731" aria-label="Canvas width"></label><label>Height <input id="canvas-height" type="number" min="1" max="16384" value="411" aria-label="Canvas height"></label>${button("apply-canvas-size", "Apply", "resize", "", "Apply canvas dimensions")}<div class="group-label">Canvas · px</div></div><div class="quick-save"><label for="filename">File name:</label><div class="filename-row"><input id="filename" value="Untitled" maxlength="120" aria-label="File name">${button("choose-output", "", "folder", "folder-button", "Choose output folder")}</div><div class="save-row"><select id="export-format" aria-label="Output format"><option value="png">PNG (*.png)</option><option value="jpg">JPEG (*.jpg)</option><option value="bmp">BMP (*.bmp)</option><option value="webp">WebP (*.webp)</option><option value="paintplus">Project (*.paintplus)</option></select>${button("quick-save", "Quick Save", "save", "primary")}</div><span id="output-folder" title="Choose a folder">Choose output folder</span></div>
 </section>
 <section class="ribbon hidden" id="text-ribbon"><div class="ribbon-group text-font-group"><div class="font-controls"><div class="font-picker"><select id="text-font" aria-label="Font"></select><button id="text-font-favorite" title="Pin font to Favorites" aria-label="Favorite font" aria-pressed="false">${icon("star",16)}</button></div><div><span class="font-size-combo"><input id="text-size" type="text" inputmode="decimal" value="12" maxlength="6" title="Font size in points" aria-label="Font size" aria-haspopup="listbox" aria-expanded="false" aria-controls="text-size-options"><button id="text-size-toggle" type="button" title="Choose font size" aria-label="Choose font size" tabindex="-1">▾</button></span>${['bold','italic','underline','strikeout'].map((style,i)=>`<button data-text-style="${style}" aria-label="${style[0].toUpperCase()+style.slice(1)}" aria-pressed="false" class="text-style-button ${style}">${['B','I','U','abc'][i]}</button>`).join('')}</div></div><div class="group-label">Font</div></div><div class="ribbon-group text-background-group" role="group" aria-label="Text background"><label><input id="text-background-transparent" type="checkbox" checked> Transparent</label><label title="RGB 254, 255, 255"><input id="text-background-white" type="checkbox"> White</label><label><input id="text-background-custom" type="checkbox"> Custom <button id="text-background-edit" type="button" aria-label="Choose custom text background" title="Edit custom background colour"><i></i>…</button></label><div class="group-label">Background</div></div><div class="ribbon-group speech-options"><label><input id="text-bubble" type="checkbox"> Speech bubble</label><div><label>Outline <input id="text-bubble-width" type="number" min="1" max="32" value="3" aria-label="Speech bubble outline width"> px</label><label>Horizontal <input id="text-padding-x" type="number" min="0" max="100" value="12" aria-label="Horizontal text padding"> px</label><label>Vertical <input id="text-padding-y" type="number" min="0" max="100" value="12" aria-label="Vertical text padding"> px</label><label>Line gap <input id="text-line-gap" type="number" min="-100" max="200" value="0" aria-label="Text line spacing"> px</label></div><div class="bubble-shadow-controls"><label><input id="text-bubble-shadow" type="checkbox"> Shadow</label><label>Offset <input id="text-shadow-offset" type="number" min="0" max="100" value="3" aria-label="Speech bubble shadow offset"> px</label></div><div class="group-label">Text and speech bubble</div></div><div class="ribbon-group tail-options"><label>Tail width <input id="text-tail-width" type="range" min="2" max="160" value="18" aria-label="Speech bubble tail width"><output id="tail-width-value">18 px</output></label><label>Tail position <input id="text-tail-position" type="range" min="9" max="500" value="28" aria-label="Speech bubble tail position"><output id="tail-position-value">28 px</output></label><span>Drag the blue diamond to aim the tip</span><div class="group-label">Speech bubble tail</div></div><div id="text-color-slot"></div><div class="ribbon-group"><div class="group-content">${button('finish-text','Finish text','check','ribbon-large')}${button('settings','Settings','gear','ribbon-large')}</div></div></section>
 <section class="ribbon hidden" id="view-ribbon"><div class="ribbon-group"><div class="group-content">${button("zoom-in", "Zoom in", "zoom", "ribbon-large")}${button("zoom-out", "Zoom out", "zoom", "ribbon-large")}${button("zoom-reset", "100%", "image", "ribbon-large")}${button("zoom-fit", "Fit to window", "resize", "ribbon-large")}</div><div class="group-label">Zoom</div></div><div class="ribbon-group view-toggles"><label><input type="checkbox" id="show-rulers" checked> Rulers</label><label><input type="checkbox" id="show-grid"> Gridlines</label><label><input type="checkbox" id="show-status" checked> Status bar</label><div class="group-label">Show or hide</div></div><div class="ribbon-group"><div class="group-content">${button("toggle-assets", "Assets", "folder", "ribbon-large")}${button("toggle-layers", "Layers", "duplicate", "ribbon-large")}${button("lock-background", "Lock Background", "lock", "ribbon-large")}${button("fullscreen", "Full screen", "image", "ribbon-large")}</div><div class="group-label">Workspace</div></div></section>
 <main class="editor-shell"><aside class="assets-panel" id="assets-panel"><header class="panel-heading"><strong>Assets</strong>${button("toggle-assets", "", "close", "", "Collapse Assets")}</header><div class="asset-search"><label>${icon("search", 17)}<input id="asset-search" placeholder="Search assets…" aria-label="Search assets"></label>${button("asset-grid", "", "grid", "active", "Grid view")}${button("asset-list", "", "list", "", "List view")}${button("asset-settings", "", "gear", "", "Library options")}</div><div class="categories" id="categories"></div><div class="asset-folder-actions">${button("add-folder", "Add Folder", "plus")}${button("add-assets", "", "image", "", "Import images")}</div><div id="asset-splitter" class="asset-splitter" role="separator" tabindex="0" aria-label="Resize folder section" aria-orientation="horizontal"></div><div class="asset-grid" id="asset-grid"></div><footer class="asset-footer"><label>Thumbnail size: <input id="thumb-size" type="range" min="70" max="150" value="96" aria-label="Thumbnail size"></label><div class="asset-hint" id="asset-hint">Double-click to insert · Right-click for options</div></footer></aside><div id="assets-width-splitter" role="separator" tabindex="0" aria-label="Resize Assets panel" aria-orientation="vertical"></div><button class="edge-tab hidden" id="assets-tab" data-action="toggle-assets" title="Expand Assets">${icon("folder", 16)}<span>Assets</span></button>
 <section class="workspace" id="workspace"><div class="ruler-corner"></div><canvas class="ruler horizontal" id="ruler-x"></canvas><canvas class="ruler vertical" id="ruler-y"></canvas><div class="viewport" id="viewport"><div class="canvas-stage" id="canvas-stage"><canvas id="display"></canvas><canvas id="overlay"></canvas><button class="canvas-handle handle-right" data-canvas-handle="right" aria-label="Resize canvas width" title="Resize canvas width"></button><button class="canvas-handle handle-bottom" data-canvas-handle="bottom" aria-label="Resize canvas height" title="Resize canvas height"></button><button class="canvas-handle handle-corner" data-canvas-handle="corner" aria-label="Resize canvas" title="Resize canvas"></button><div id="brush-cursor"></div></div></div></section>
 <button class="edge-tab hidden" id="layers-tab" data-action="toggle-layers" title="Expand Layers">${icon("duplicate", 16)}<span>Layers</span></button><aside class="layers-panel" id="layers-panel"><header class="panel-heading"><strong>Layers</strong>${button("toggle-layers", "", "close", "", "Collapse Layers")}</header><div class="layer-actions">${button("new-layer", "", "plus", "", "New layer")}${button("layer-up", "", "up", "", "Move layer up")}${button("layer-down", "", "down", "", "Move layer down")}${button("duplicate-layer", "", "duplicate", "", "Duplicate layer")}${button("delete-layer", "", "trash", "", "Delete layer")}${button("merge-layer", "", "merge", "", "Merge layer down")}</div><div class="layer-list" id="layer-list"></div><div id="layer-group-hint" class="layer-group-hint hidden">Group editing · choose Select or Free-form Select to edit the same area on every member. Click a member row to edit it alone.</div><label class="layer-transparency" title="Checked: exact Color 2 pixels reveal lower layers. Unchecked: standard alpha transparency preserves painted colours."><input type="checkbox" id="layer-color2-transparency" checked> Use Color 2 as transparency</label><label class="layer-own-assets"><input type="checkbox" id="layer-own-assets"> Insert assets on their own layer</label><div class="layer-extras">${button("lock-background", "Lock Background", "lock")}${button("group", "Group", "group", "", "Group selected layers or objects · Ctrl+G")}${button("ungroup", "", "group", "", "Ungroup · Ctrl+Shift+G")}${button("rasterize", "Commit", "check", "", "Rasterize selected objects")}</div><section class="shortcuts-panel"><header><strong>Shortcuts</strong>${button("shortcuts", "", "gear", "", "Edit shortcuts")}</header><span>Tool shortcuts (number keys)</span><div class="shortcut-table" id="shortcut-table"></div><button data-action="shortcuts" class="wide">Edit Shortcuts…</button></section></aside></main>
 <footer class="statusbar" id="statusbar"><span id="cursor-status">${icon("plus", 16)}<span>Ready</span></span><span id="dimensions-status">${icon("resize", 16)}<span>731 × 411 px</span></span><span id="size-status">${icon("image", 16)}<span>New image</span></span><div class="zoom-controls"><button data-action="zoom-reset" id="zoom-percent">100%</button>${button("zoom-out", "−", null, "zoom-step", "Zoom out")}<input type="range" id="zoom-slider" min="0" max="10" step="1" value="3" aria-label="Zoom">${button("zoom-in", "+", null, "zoom-step", "Zoom in")}</div></footer><div id="toast" role="status"></div><div id="menu" class="popup hidden"></div><div id="modal-root"></div><input type="file" id="open-input" accept=".paintplus,image/*" hidden><input type="file" id="asset-input" accept="image/*" multiple hidden><input id="color-picker" type="color" hidden>`;
}
