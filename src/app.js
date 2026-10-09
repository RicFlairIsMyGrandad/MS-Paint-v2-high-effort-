import "./ui/styles.css";
import { layout, labels, tools, button } from "./ui/layout.js";
import { icon } from "./ui/icons.js";
import { PaintDocument, createLayer, drawObject, id } from "./core/document.js";
import { canvas, cloneCanvas, bmpBytes, colorKey } from "./core/raster.js";
import { serialize, deserialize, imageCanvas } from "./core/project.js";
import { resample } from "./core/resample.js";
import { Editor, selectionBounds, axisBounds } from "./ui/editor.js";
import { Library } from "./ui/library.js";
import { TextEditor } from "./ui/text.js";
import { nearestZoom, stepZoom, zoomLevels } from "./core/zoom.js";
import { refreshEditable } from "./core/editable.js";
import { foregroundPixels } from "./core/alpha.js";
const defaultPrefs = {
  assetsOpen: true,
  layersOpen: true,
  thumbSize: 96,
  assetList: false,
  category: "all",
  assetOwnLayer: true,
  aspectLock: true,
  transparentSelection: false,
  rulers: true,
  grid: false,
  zoom: 1,
  fillTolerance: 0,
  shortcuts: [
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
  ],
  smoothPreview: true,
  selectionMode: "paint",
  growCanvasOnPaste: true,
  assetsWidth: 280,
  categoriesHeight: 246,
  textStyle: {},
};
export class PaintPlus {
  constructor() {
    this.doc = new PaintDocument(1200, 800, () => this.changedUI());
    this.color1 = "#1847f1";
    this.color2 = "#ffffff";
    this.activeColor = 1;
    this.width = 4;
    this.tool = "select";
    this.brush = "round";
    this.shape = "rectangle";
    this.outline = "solid";
    this.shapeFill = "none";
    this.zoom = 1;
    this.busy = false;
    this.currentFile = null;
    this.outputHandle = null;
    this.clipboard = null;
    this.fileName = "Untitled";
    this.modalCleanup = null;
    this.renderLayersPending = false;
    this.persistChain = Promise.resolve();
  }
  async init() {
    window.desktop?.onSaveBeforeClose(async () => {
      try {
        await this.save(false, "paintplus");
        window.desktop.closeAfterSave(!this.doc.dirty);
      } catch (e) {
        this.toast(e.message);
      }
    });
    let settings = {};
    try {
      settings = window.desktop
        ? await window.desktop.getSettings()
        : JSON.parse(localStorage.getItem("paintplus-settings") || "{}");
    } catch {}
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) settings = {};
    this.settings = settings;
    this.prefs = { ...defaultPrefs };
    for (const [key, value] of Object.entries(settings.preferences || {})) {
      if (typeof value === typeof defaultPrefs[key] && !Array.isArray(value) && (typeof value !== "number" || Number.isFinite(value))) this.prefs[key] = value;
    }
    const savedShortcuts = settings.preferences?.shortcuts;
    this.prefs.shortcuts = Array.isArray(savedShortcuts) ? savedShortcuts.map(tool => tool === "crop" ? "transparent" : tool) : null;
    this.prefs.shortcuts =
      Array.isArray(this.prefs.shortcuts) && this.prefs.shortcuts.length === 10 && this.prefs.shortcuts.every(tool => tools.includes(tool))
        ? this.prefs.shortcuts
        : [...defaultPrefs.shortcuts];
    this.zoom = nearestZoom(this.prefs.zoom);
    document.querySelector("#app").innerHTML = layout();
    this.editor = new Editor(this);
    this.library = new Library(this, settings);
    this.selectionOrigin = "select";
    this.textEditor = new TextEditor(this);
    this.bind();
    this.applyPrefs();
    this.changedUI();
    window.desktop?.onProject(async (text) => {
      try {
        this.doc = await deserialize(text, () => this.changedUI());
        this.changedUI();
        this.editor.fit();
      } catch (e) {
        this.toast(e.message);
      }
    });
    return this;
  }
  escape(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  toast(message, duration = 3600) {
    const el = document.querySelector("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove("show"), duration);
  }
  async persist(patch) {
    this.settings = { ...this.settings, ...patch };
    this.persistChain = this.persistChain
      .catch(() => {})
      .then(async () => {
        try {
          if (window.desktop) await window.desktop.saveSettings(patch);
          else
            localStorage.setItem(
              "paintplus-settings",
              JSON.stringify(this.settings),
            );
        } catch (e) {
          this.toast("Could not save settings: " + e.message);
        }
      });
    return this.persistChain;
  }
  savePrefs() {
    return this.persist({ preferences: { ...this.prefs } });
  }
  changedUI() {
    if (!this.editor) return;
    if (this.doc.history.droppedOperation) {
      this.doc.history.droppedOperation = null;
      this.toast("This operation was too large to keep in undo history.", 7000);
    }
    this.editor.requestRender();
    this.updateTools();
    this.updateTitle();
    if (!this.renderLayersPending) {
      this.renderLayersPending = true;
      setTimeout(() => {
        this.renderLayersPending = false;
        this.updateLayers();
      }, 80);
    }
    window.desktop?.setDirty(this.doc.dirty);
  }
  updateTitle() {
    document.querySelector("#window-title").textContent =
      this.fileName + (this.doc.dirty ? " *" : "") + " — PaintPlus";
    document.title = this.fileName + " — PaintPlus";
  }
  updateTools() {
    document
      .querySelectorAll(".tool-button")
      .forEach((b) =>
        b.classList.toggle(
          "selected",
          b.dataset.action === "tool:" + this.tool,
        ),
      );
    document
      .querySelector(".brush-button")
      .classList.toggle("selected", this.tool === "brush");
    document
      .querySelectorAll("[data-shape]")
      .forEach((b) =>
        b.classList.toggle(
          "selected",
          this.tool === "shape" && b.dataset.shape === this.shape,
        ),
      );
    document.querySelector("#width-label").textContent = this.width + " px";
    document.querySelector(".line-sample").style.setProperty("--current-stroke", Math.min(18, this.width) + "px");
    document.querySelector("[data-action=undo]").disabled =
      !this.doc.history.undoStack.length;
    document.querySelector("[data-action=redo]").disabled =
      !this.doc.history.redoStack.length;
    for (const action of ["cut", "copy"])
      document.querySelector(`[data-action=${action}]`).disabled =
        !this.doc.selectedObjects.length;
    this.editor?.updateCursor(this.editor.hover);
    const shape = this.doc.selectedObjects.find(o => o.type === 'shape');
    const shapeActive = this.tool === 'shape' || !!shape;
    document.querySelector('#outline').disabled = !shapeActive;
    document.querySelector('#shape-fill').disabled = !shapeActive;
    document.querySelector('#selection-transparent').checked = this.prefs.transparentSelection;
    for (const key of ['width', 'height']) {
      const field = document.querySelector('#canvas-' + key);
      if (document.activeElement !== field) field.value = this.doc[key];
    }
    document.querySelector('[data-tab=text]').classList.toggle('hidden', this.tool !== 'text' && !this.doc.selectedObjects.some(o => o.type === 'text'));
    document.querySelector('.line-sample').classList.toggle('pencil-sample', this.tool === 'pencil');
    this.textEditor?.syncControls();
    this.updateColors();
  }
  updateColors() {
    document.querySelector("#color1-swatch").style.background = this.color1;
    document.querySelector("#color2-swatch").style.background = this.color2;
    document
      .querySelector("[data-action=color1]")
      .classList.toggle("selected", this.activeColor === 1);
    document
      .querySelector("[data-action=color2]")
      .classList.toggle("selected", this.activeColor === 2);
  }
  switchTab(tab) {
    const colors = document.querySelector('.colors-group');
    if (tab === 'text') document.querySelector('#text-color-slot').append(colors);
    else document.querySelector('#home-ribbon').insertBefore(colors, document.querySelector('.extra-group'));
    for (const button of document.querySelectorAll('[data-tab]')) button.classList.toggle('active', button.dataset.tab === tab);
    for (const name of ['home', 'view', 'text']) document.querySelector('#' + name + '-ribbon').classList.toggle('hidden', name !== tab);
    this.editor.requestRender();
  }
  toggleTransparency(value = !this.prefs.transparentSelection) {
    this.prefs.transparentSelection = value;
    const selected = this.doc.selectedObjects.filter(o => !['shape','text'].includes(o.type));
    if (selected.length && this.selectedEditable()) this.doc.action('Selection transparency', () => {
      for (const object of selected) object.transparentColor = value ? this.color2 : null;
    });
    this.savePrefs();this.changedUI();
  }
  finishSelection() {
    const objects = this.doc.selectedObjects.filter(o => o.type === 'selection' || o.draft);
    this.doc.assertAllocation(this.doc.layers.filter(layer => layer.objects.some(o => objects.includes(o))).length * this.doc.width * this.doc.height * 4);
    if (objects.length && this.selectedEditable()) this.doc.action('Commit selection', () => {
      for (const layer of this.doc.layers) {
        const committing = layer.objects.filter(o => objects.includes(o));
        if (!committing.length) continue;
        layer.canvas = cloneCanvas(layer.canvas);
        for (const object of committing) drawObject(layer.canvas.getContext('2d'), object);
        layer.objects = layer.objects.filter(o => !committing.includes(o));
      }
      this.doc.selected = [];
    });
    this.doc.selected = [];this.tool = this.selectionOrigin || 'select';this.changedUI();
  }
  updateShapeStyle(patch = {}) {
    const objects = this.doc.selectedObjects.filter(o => o.type === 'shape');
    if (objects.length && this.selectedEditable()) this.doc.action('Format shape', () => {
      for (const object of objects) {
        this.doc.assertAllocation(object.width * object.height * 12);
        const candidate = { ...object, shapeStyle: { ...object.shapeStyle, ...patch } };
        refreshEditable(candidate);Object.assign(object, candidate);
      }
    });
    this.changedUI();
  }
  setStrokeWidth(width) {
    this.width = Math.max(1, Math.min(256, Math.round(width)));
    this.updateShapeStyle({ width: this.width });
  }
  colorChanged(slot = this.activeColor) {
    this.updateColors();this.updateShapeStyle(slot === 1 ? { color: this.color1 } : { background: this.color2 });
    if (this.doc.selectedObjects.some(o => o.type === 'text')) this.textEditor.changeStyle(slot === 1 ? { textColor: this.color1, bubbleColor: this.color1 } : { background: this.color2 });
  }
  deleteLayer(layer = this.doc.activeLayer) {
    if (layer.locked) throw new Error('Unlock this layer before deleting it.');
    if (this.doc.layers.length === 1) this.doc.assertAllocation(this.doc.width * this.doc.height * 4);
    this.doc.action('Delete layer', () => {
      this.doc.layers = this.doc.layers.filter(l => l.id !== layer.id);
      if (!this.doc.layers.length) this.doc.layers.push(createLayer(this.doc.width, this.doc.height, 'Background', this.color2));
      this.doc.activeLayerId = this.doc.layers.at(-1).id;this.doc.selected = [];
    });
    this.changedUI();
  }
  async setTool(tool) {
    if (tool === 'transparent') { this.toggleTransparency();return; }
    if (tool !== 'text') this.textEditor?.finish();
    if (tool === 'select' || tool === 'free') this.selectionOrigin = tool;
    this.editor.finishPending();
    if (this.editor.drag) this.editor.finishDrag();
    if (!tools.includes(tool)) return;
    if (["pencil", "brush", "eraser", "fill", "shape"].includes(tool) && !this.doc.activeLayer.locked && this.doc.activeLayer.visible) {
      const editable=this.doc.layers.filter(l=>l.visible&&!l.locked).flatMap(l=>l.objects.filter(o=>o.type !== 'text' && (this.doc.selected.includes(o.id)||l.id===this.doc.activeLayerId)).map(o=>o.id));
      if(editable.length){this.doc.selected=editable;try{await this.runBusy('Committing floating content…',()=>this.doc.rasterize(resample));}catch(e){this.toast(e.message);}}
    }
    this.tool = tool;
    if (tool === "text") this.switchTab("text");
    else if (!document.querySelector("#text-ribbon").classList.contains("hidden")) this.switchTab("home");
    this.updateTools();
    this.editor.requestRender();
  }
  applyPrefs() {
    for (const [key, panel, tab] of [
      ["assetsOpen", "assets-panel", "assets-tab"],
      ["layersOpen", "layers-panel", "layers-tab"],
    ]) {
      document
        .getElementById(panel)
        .classList.toggle("hidden", !this.prefs[key]);
      document.getElementById(tab).classList.toggle("hidden", this.prefs[key]);
    }
    document
      .querySelector("#workspace")
      .classList.toggle("no-rulers", !this.prefs.rulers);
    document.querySelector("#show-rulers").checked = this.prefs.rulers;
    document.querySelector("#show-grid").checked = this.prefs.grid;
    document.querySelector("#thumb-size").value = this.prefs.thumbSize;
    document.querySelector('#assets-panel').style.width = Math.max(180, Math.min(600, this.prefs.assetsWidth)) + 'px';
    document.querySelector('#categories').style.height = Math.max(65, Math.min(650, this.prefs.categoriesHeight)) + 'px';
    document.querySelector('#assets-width-splitter').classList.toggle('hidden', !this.prefs.assetsOpen);
    this.updateShortcutTable();
    this.editor.requestRender();
  }
  updateShortcutTable() {
    const short = [
      "Rec sel",
      "Fr.form sel",
      "Brush",
      "Pencil",
      "Fill",
      "Text",
      "Shape",
      "Eyedropper",
      "Transparent",
      "Move/Transform",
    ];
    document.querySelector("#shortcut-table").innerHTML = this.prefs.shortcuts
      .map(
        (t, i) =>
          `<div class="shortcut-cell"><b>${i}</b><span>${this.escape(short[defaultPrefs.shortcuts.indexOf(t)] || labels[t] || t)}</span></div>`,
      )
      .join("");
  }
  bind() {
    document.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]");
      if (action) {
        this.action(action.dataset.action, action).catch((err) =>
          this.toast(err.message),
        );
      }
      const shape = e.target.closest("[data-shape]");
      if (shape) {
        this.shape = shape.dataset.shape;
        this.setTool("shape");
      }
      const color = e.target.closest("[data-color]");
      if (color) {
        if (this.activeColor === 1) this.color1 = color.dataset.color;
        else this.color2 = color.dataset.color;
        this.colorChanged();
      }
      const tab = e.target.closest("[data-tab]");
      if (tab) this.switchTab(tab.dataset.tab);
      if (!e.target.closest("#menu") && !e.target.closest("[data-action]"))
        this.closeMenu();
    });
    document.querySelectorAll("[data-color]").forEach((b) =>
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.color2 = b.dataset.color;
        this.colorChanged(2);
      }),
    );
    document.querySelector("#outline").onchange = (e) => { this.outline = e.target.value;this.updateShapeStyle({ outline: this.outline }); };
    document.querySelector("#shape-fill").onchange = (e) => { this.shapeFill = e.target.value;this.updateShapeStyle({ fill: this.shapeFill }); };
    document.querySelector("#selection-transparent").onchange = e => this.toggleTransparency(e.target.checked);
    document.querySelector("#filename").oninput = (e) => {
      this.fileName = e.target.value || "Untitled";
      this.updateTitle();
    };
    document.querySelector("#filename").onkeydown = (e) => {
      if (e.key === "Enter") this.quickSave();
    };
    document.querySelector("#zoom-slider").oninput = (e) =>
      this.editor.setZoom(zoomLevels[Number(e.target.value)]);
    document.querySelector("#show-rulers").onchange = (e) => {
      this.prefs.rulers = e.target.checked;
      this.applyPrefs();
      this.savePrefs();
    };
    document.querySelector("#show-grid").onchange = (e) => {
      this.prefs.grid = e.target.checked;
      this.editor.requestRender();
      this.savePrefs();
    };
    document.querySelector("#show-status").onchange = (e) =>
      document
        .querySelector("#statusbar")
        .classList.toggle("hidden", !e.target.checked);
    document.querySelector("#color-picker").oninput = (e) => {
      if (this.activeColor === 1) this.color1 = e.target.value;
      else this.color2 = e.target.value;
      this.colorChanged();
    };
    document.querySelector("#open-input").onchange = async (e) => {
      const file = e.target.files[0];
      if (file) await this.openBrowserFile(file);
      e.target.value = "";
    };
    document.querySelector("#asset-input").onchange = async (e) => {
      const images = [];
      for (const f of e.target.files) {
        if (!f.type.startsWith("image/")) continue;
        images.push({
          name: f.name.replace(/\.[^.]+$/, ""),
          url: await this.fileURL(f),
        });
      }
      await this.library.addFiles(images);
      e.target.value = "";
      e.target.removeAttribute("webkitdirectory");
    };
    document.addEventListener("keydown", (e) => this.keyDown(e));
    this.editor.viewport.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      this.editor.viewport.classList.add("drop-zone");
    });
    this.editor.viewport.addEventListener("dragleave", () =>
      this.editor.viewport.classList.remove("drop-zone"),
    );
    this.editor.viewport.addEventListener("drop", async (e) => {
      e.preventDefault();
      this.editor.viewport.classList.remove("drop-zone");
      try {
        const ids = e.dataTransfer.getData("application/paintplus-assets");
        if (ids) {
          for (const id of JSON.parse(ids)) await this.library.insert(id);
        } else
          for (const file of e.dataTransfer.files) {
            if (file.name.endsWith(".paintplus"))
              await this.openBrowserFile(file);
            else if (file.type.startsWith("image/")) {
              const source = await imageCanvas(await this.fileURL(file));
              this.doc.insert(source, file.name, this.prefs.assetOwnLayer);
              this.setTool("move");
              this.changedUI();
            }
          }
      } catch (err) {
        this.toast(err.message);
      }
    });
    const list = document.querySelector("#layer-list");
    list.addEventListener("click", (e) => {
      const row = e.target.closest(".layer-row");
      if (!row) return;
      const layer = this.doc.layers.find((l) => l.id === row.dataset.id);
      this.layerFocused = true;row.focus();
      if (e.target.closest(".delete-layer-row")) { try { this.deleteLayer(layer); } catch (error) { this.toast(error.message); } }
      else if (e.target.closest(".visibility"))
        this.doc.action(
          "Toggle layer visibility",
          () => {layer.visible = !layer.visible;if(!layer.visible)this.doc.selected=this.doc.selected.filter(id=>!layer.objects.some(o=>o.id===id));},
        );
      else if (e.target.closest(".lock-layer"))
        this.doc.action("Toggle layer lock", () => {
          layer.locked = !layer.locked;
          if (layer.locked)
            this.doc.selected = this.doc.selected.filter(
              (id) => !layer.objects.some((o) => o.id === id),
            );
        });
      else {
        this.doc.activeLayerId = layer.id;
        const ids = layer.locked || !layer.visible ? [] : layer.objects.map((o) => o.id);
        if (e.ctrlKey || e.shiftKey)
          this.doc.selected = [...new Set([...this.doc.selected, ...ids])];
        else this.doc.selected = ids;
        this.tool = "move";
        this.changedUI();
      }
      this.updateLayers();
    });
    list.addEventListener("dblclick", async (e) => {
      const row = e.target.closest(".layer-row");
      if (!row) return;
      const layer = this.doc.layers.find((l) => l.id === row.dataset.id);
      const name = await this.prompt("Rename layer", "Layer name", layer.name);
      if (name) this.doc.action("Rename layer", () => (layer.name = name));
    });
    list.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const row = e.target.closest(".layer-row");
      if (!row) return;
      this.doc.activeLayerId = row.dataset.id;
      this.updateLayers();
      this.menuAt(e.clientX, e.clientY, [
        {
          label: "Rename layer…",
          icon: "pencil",
          run: () =>
            row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
        },
        {
          label: "Duplicate layer",
          icon: "duplicate",
          run: () => this.action("duplicate-layer"),
        },
        {
          label: "Merge down",
          icon: "merge",
          run: () => this.action("merge-layer"),
        },
        {
          label: "Group selected objects",
          icon: "group",
          run: () => this.action("group"),
        },
        {
          label: "Ungroup selected objects",
          icon: "group",
          run: () => this.action("ungroup"),
        },
        {
          label: "Delete layer",
          icon: "trash",
          run: () => this.action("delete-layer"),
        },
      ]);
    });
    list.addEventListener("dragstart", (e) => {
      const row = e.target.closest(".layer-row");
      if (row) {
        e.dataTransfer.setData("application/paintplus-layer", row.dataset.id);
        e.dataTransfer.effectAllowed = "move";
      }
    });
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = e.dataTransfer.getData("application/paintplus-layer"),
        row = e.target.closest(".layer-row");
      if (!from || !row || from === row.dataset.id) return;
      const i = this.doc.layers.findIndex((l) => l.id === from),
        j = this.doc.layers.findIndex((l) => l.id === row.dataset.id);
      if (i < 0 || j < 0) return;
      this.doc.action("Reorder layers", () => {
        this.doc.layers.splice(j, 0, ...this.doc.layers.splice(i, 1));
      });
    });
    for (const [id, property, axis, minimum, maximum] of [['assets-width-splitter', 'assetsWidth', 'clientX', 180, 600], ['asset-splitter', 'categoriesHeight', 'clientY', 65, 650]]) {
      const splitter = document.getElementById(id);
      splitter.addEventListener('pointerdown', event => {
        event.preventDefault();const start = event[axis], size = this.prefs[property];splitter.setPointerCapture(event.pointerId);
        splitter.onpointermove = moving => { this.prefs[property] = Math.max(minimum, Math.min(maximum, size + moving[axis] - start));this.applyPrefs(); };
        splitter.onpointerup = () => { splitter.onpointermove = null;this.savePrefs(); };
      });
      splitter.addEventListener('keydown', event => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault();this.prefs[property] = Math.max(minimum, Math.min(maximum, this.prefs[property] + (['ArrowLeft','ArrowUp'].includes(event.key) ? -10 : 10)));this.applyPrefs();this.savePrefs();
      });
    }
    document.addEventListener('pointerdown', event => { if (!event.target.closest('#layer-list,.layer-actions')) this.layerFocused = false; });
    if (this.settings.outputFolder)
      document.querySelector("#output-folder").textContent =
        this.settings.outputFolder;
  }
  updateLayers() {
    const list = document.querySelector("#layer-list");
    if (!list) return;
    list.innerHTML = [...this.doc.layers]
      .reverse()
      .map(
        (l) =>
          `<div class="layer-row ${l.id === this.doc.activeLayerId ? "active" : ""} ${l.locked ? "locked" : ""} ${!l.visible ? "hidden-layer" : ""}" data-id="${l.id}" draggable="true" tabindex="0"><button class="visibility" title="${l.visible ? "Hide" : "Show"} layer" aria-label="${l.visible ? "Hide" : "Show"} ${this.escape(l.name)}">${icon("eye", 16)}</button><img alt="${this.escape(l.name)} thumbnail"><span class="layer-name">${this.escape(l.name)}${l.objects.some((o) => o.group) ? '<span class="group-badge">▧</span>' : ""}</span><button class="lock-layer" title="${l.locked ? "Unlock" : "Lock"} layer" aria-label="${l.locked ? "Unlock" : "Lock"} ${this.escape(l.name)}">${icon("lock", 15)}</button><button class="delete-layer-row" title="Delete layer" aria-label="Delete ${this.escape(l.name)}">${icon("trash", 15)}</button></div>`,
      )
      .join("");
    for (const l of this.doc.layers) {
      const thumb = canvas(42, 42),
        ctx = thumb.getContext("2d"),
        b = l.objects.length
          ? selectionBounds(l.objects)
          : { x: 0, y: 0, width: this.doc.width, height: this.doc.height },
        scale = Math.min(40 / b.width, 40 / b.height);
      ctx.translate(
        (42 - b.width * scale) / 2 - b.x * scale,
        (42 - b.height * scale) / 2 - b.y * scale,
      );
      ctx.scale(scale, scale);
      ctx.drawImage(l.canvas, 0, 0);
      for (const o of l.objects) drawObject(ctx, o);
      list.querySelector(`[data-id="${l.id}"] img`).src = thumb.toDataURL();
    }
  }
  menu(anchor, items) {
    const r = anchor?.getBoundingClientRect() || { left: 70, bottom: 62 };
    this.menuAt(r.left, r.bottom, items);
  }
  menuAt(x, y, items) {
    const el = document.querySelector("#menu");
    el.replaceChildren();
    for (const item of items) {
      if (item === null) {
        el.append(document.createElement("hr"));
        continue;
      }
      const b = document.createElement("button");
      b.innerHTML =
        (item.icon ? icon(item.icon, 17) : "") +
        `<span>${this.escape(item.label)}</span>`;
      b.disabled = !!item.disabled;
      b.onclick = async (e) => {
        e.stopPropagation();
        this.closeMenu();
        try {
          await item.run();
        } catch (err) {
          this.toast(err.message);
        }
      };
      el.append(b);
    }
    el.classList.remove("hidden");
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(0, Math.min(x, innerWidth - r.width - 8)) + "px";
    el.style.top = Math.max(0, Math.min(y, innerHeight - r.height - 8)) + "px";
  }
  closeMenu() {
    document.querySelector("#menu").classList.add("hidden");
  }
  dialog(title, content, actions = [], options = {}) {
    this.closeDialog();
    const root = document.querySelector("#modal-root");
    root.classList.toggle("floating-dialog", !!options.floating);
    root.classList.toggle('nonmodal', !!options.nonmodal);
    root.innerHTML = `<div class="modal-shade"><section class="dialog" role="dialog" aria-label="${this.escape(title)}"><header><span>${this.escape(title)}</span><button class="dialog-close" title="Close" aria-label="Close dialog">${icon("close", 17)}</button></header><div class="dialog-body">${content}</div>${actions.length ? '<div class="dialog-actions"></div>' : ""}</section></div>`;
    const close = () => {
      options.onCancel?.();
      this.closeDialog();
    };
    root.querySelector(".dialog-close").onclick = close;
    for (const action of actions) {
      const b = document.createElement("button");
      b.textContent = action.label;
      if (action.primary) b.className = "primary";
      b.onclick = async () => {
        try {
          await action.run();
        } catch (e) {
          this.toast(e.message);
        }
      };
      root.querySelector(".dialog-actions").append(b);
    }
    const el = root.querySelector(".dialog"),
      head = el.querySelector("header");
    head.onpointerdown = (e) => {
      if (e.target.closest("button")) return;
      const r = el.getBoundingClientRect(),
        start = { x: e.clientX, y: e.clientY };
      el.style.position = "fixed";
      el.style.left = r.left + "px";
      el.style.top = r.top + "px";
      el.style.right = "auto";
      el.style.margin = "0";
      head.setPointerCapture(e.pointerId);
      head.onpointermove = (ev) => {
        el.style.left =
          Math.min(
            innerWidth - 100,
            Math.max(0, r.left + ev.clientX - start.x),
          ) + "px";
        el.style.top =
          Math.min(
            innerHeight - 50,
            Math.max(0, r.top + ev.clientY - start.y),
          ) + "px";
      };
      head.onpointerup = () => {
        head.onpointermove = null;
      };
    };
    this.modalCleanup = options.cleanup || null;
    this.modalCancel = close;
    setTimeout(
      () =>
        root
          .querySelector("input:not([type=checkbox]),textarea,select")
          ?.focus(),
      30,
    );
    return el;
  }
  closeDialog() {
    if (this.modalCleanup) {
      const cleanup = this.modalCleanup;
      this.modalCleanup = null;
      cleanup();
    }
    const root = document.querySelector("#modal-root");
    if (root) {
      root.replaceChildren();
      root.classList.remove("floating-dialog");
      root.classList.remove('nonmodal');
    }
    this.modalCancel = null;
  }
  async confirm(title, text) {
    return new Promise((resolve) => {
      this.dialog(
        title,
        `<p>${this.escape(text)}</p>`,
        [
          {
            label: "Cancel",
            run: () => {
              this.closeDialog();
              resolve(false);
            },
          },
          {
            label: "Continue",
            primary: true,
            run: () => {
              this.closeDialog();
              resolve(true);
            },
          },
        ],
        { onCancel: () => resolve(false) },
      );
    });
  }
  async prompt(title, label, value = "") {
    return new Promise((resolve) => {
      this.dialog(
        title,
        `<label>${this.escape(label)}</label><input id="prompt-input" value="${this.escape(value)}" maxlength="120">`,
        [
          {
            label: "Cancel",
            run: () => {
              this.closeDialog();
              resolve(null);
            },
          },
          {
            label: "OK",
            primary: true,
            run: () => {
              const v = document.querySelector("#prompt-input").value.trim();
              this.closeDialog();
              resolve(v);
            },
          },
        ],
        { onCancel: () => resolve(null) },
      );
      document.querySelector("#prompt-input").onkeydown = (e) => {
        if (e.key === "Enter") {
          const v = e.target.value.trim();
          this.closeDialog();
          resolve(v);
        }
      };
    });
  }
  async runBusy(message, fn) {
    if (this.busy) throw new Error("Please wait for the current operation.");
    this.busy = true;
    document.body.classList.add("busy");
    this.toast(message, 600000);
    try {
      return await fn();
    } finally {
      this.busy = false;
      document.body.classList.remove("busy");
      document.querySelector("#toast").classList.remove("show");
      this.changedUI();
    }
  }
  async action(action, anchor) {
    if (this.busy && !["minimize", "maximize", "close"].includes(action)) {
      this.toast("Please wait for the current operation.");
      return;
    }
    this.closeMenu();
    if (this.editor.pendingShape) {
      if (action === "undo") {
        this.editor.pendingShape = null;
        this.editor.requestRender();
        return;
      }
      this.editor.finishPending();
    }
    const doc = this.doc;
    const layer = doc.activeLayer;
    if (action.startsWith("tool:")) return this.setTool(action.slice(5));
    switch (action) {
      case "minimize":
      case "maximize":
      case "close":
        if (window.desktop) await window.desktop.windowAction(action);
        else if (action === "maximize")
          document.body.classList.toggle("fullscreen");
        else if (action === "close")
          this.toast(
            "Use your browser window to close this development preview.",
          );
        break;
      case "file":
        this.menu(anchor, [
          {
            label: "New · Ctrl+N",
            icon: "plus",
            run: () => this.newDocument(),
          },
          { label: "Open… · Ctrl+O", icon: "folder", run: () => this.open() },
          { label: "Save · Ctrl+S", icon: "save", run: () => this.save() },
          {
            label: "Save As… · Ctrl+Shift+S",
            icon: "save",
            run: () => this.save(true),
          },
          {
            label: "Save editable project…",
            icon: "duplicate",
            run: () => this.save(true, "paintplus"),
          },
          null,
          {
            label: "Open example scene",
            icon: "image",
            run: () => this.demo(),
          },
          {
            label: "Image properties…",
            icon: "resize",
            run: () => this.canvasDialog(),
          },
          null,
          { label: "Help", icon: "gear", run: () => this.help() },
        ]);
        break;
      case "new":
        await this.newDocument();
        break;
      case "open":
        await this.open();
        break;
      case "save":
        await this.save();
        break;
      case "save-as":
        await this.save(true);
        break;
      case "quick-save":
        await this.quickSave();
        break;
      case "choose-output":
        await this.chooseOutput();
        break;
      case "undo":
        this.textEditor.finish();
        if (document.querySelector("#modal-root.floating-dialog")) this.modalCancel?.();
        this.editor.selectionRect = null;
        doc.history.undo();
        this.changedUI();
        break;
      case "redo":
        this.textEditor.finish();
        if (document.querySelector("#modal-root.floating-dialog")) this.modalCancel?.();
        doc.history.redo();
        this.changedUI();
        break;
      case "paste":
        await this.paste();
        break;
      case "copy":
        if (!doc.selectedObjects.length) {
          this.toast("Select pixels or objects to copy.");
          break;
        }
        await this.copy();
        break;
      case "cut":
        if (!doc.selectedObjects.length) {
          this.toast("Select pixels or objects to cut.");
          break;
        }
        if (await this.copy()) doc.deleteSelected();
        break;
      case "crop":
        {
          const b =
            this.editor.selectionRect || axisBounds(doc.selectedObjects);
          if (b) {
            doc.crop(b);
            this.editor.selectionRect = null;
          } else {
            await this.setTool("select");
            this.toast("Select a rectangle, then click Crop.");
          }
        }
        break;
      case "resize":
        this.resizeDialog();
        break;
      case "finish-text":
        this.textEditor.finish();break;
      case "apply-canvas-size":
        doc.resizeCanvas(Number(document.querySelector('#canvas-width').value), Number(document.querySelector('#canvas-height').value), this.color2);break;
      case "canvas-size":
        this.canvasDialog();
        break;
      case "rotate-menu":
        this.menu(anchor, [
          {
            label: "Resize & Rotate…",
            icon: "resize",
            run: () => this.resizeDialog(),
          },
          {
            label: "Rotate left 90°",
            icon: "rotate",
            run: () => this.rotate(-90),
          },
          {
            label: "Rotate right 90°",
            icon: "rotateRight",
            run: () => this.rotate(90),
          },
          { label: "Rotate 180°", icon: "rotate", run: () => this.rotate(180) },
          {
            label: "Flip horizontal",
            icon: "flipH",
            run: () => this.flip("H"),
          },
          { label: "Flip vertical", icon: "flipV", run: () => this.flip("V") },
        ]);
        break;
      case "brush-menu":
        this.menu(
          anchor,
          [
            "round",
            "square",
            "calligraphy",
            "airbrush",
            "oil",
            "crayon",
            "marker",
            "watercolor",
          ].map((brush) => ({
            label: brush[0].toUpperCase() + brush.slice(1) + " brush",
            icon: "brush",
            run: () => {
              this.brush = brush;
              this.setTool("brush");
            },
          })),
        );
        break;
      case "size-menu":
        this.sizeMenu(anchor);
        break;
      case "color1":
        this.activeColor = 1;
        this.updateColors();
        break;
      case "color2":
        this.activeColor = 2;
        this.updateColors();
        break;
      case "custom-color":
        this.colorDialog();
        break;
      case "new-layer":
        doc.addLayer();
        doc.selected = [];
        break;
      case "layer-up":
      case "layer-down":
        {
          const i = doc.layers.indexOf(layer),
            j = i + (action === "layer-up" ? 1 : -1);
          if (j >= 0 && j < doc.layers.length)
            doc.action("Reorder layer", () => {
              [doc.layers[i], doc.layers[j]] = [doc.layers[j], doc.layers[i]];
            });
        }
        break;
      case "duplicate-layer":
        doc.assertAllocation(doc.width * doc.height * 4);
        doc.action(
          "Duplicate layer",
          () => {
            const c = {
              ...layer,
              id: id(),
              name: layer.name + " copy",
              canvas: cloneCanvas(layer.canvas),
              objects: layer.objects.map((o) => ({ ...o, id: id() })),
            };
            doc.layers.splice(doc.layers.indexOf(layer) + 1, 0, c);
            doc.activeLayerId = c.id;
            doc.selected = c.objects.map((o) => o.id);
          },
          doc.width * doc.height * 4,
        );
        break;
      case "delete-layer":
        this.deleteLayer(layer);break;
      case "merge-layer":
        doc.mergeDown();
        break;
      case "lock-background":
        doc.action(
          "Lock Background",
          () => (doc.layers[0].locked = !doc.layers[0].locked),
        );
        break;
      case "group":
        doc.groupSelected();
        break;
      case "ungroup":
        doc.ungroupSelected();
        break;
      case "rasterize":
        this.textEditor.finish();
        await this.runBusy("Rendering from original pixels…", () =>
          doc.rasterize(resample),
        );
        this.tool = this.selectionOrigin || "select";
        break;
      case "duplicate":
        doc.duplicateSelected();
        break;
      case "delete":
        doc.deleteSelected();
        break;
      case "toggle-assets":
        this.prefs.assetsOpen = !this.prefs.assetsOpen;
        this.applyPrefs();
        this.savePrefs();
        break;
      case "toggle-layers":
        this.prefs.layersOpen = !this.prefs.layersOpen;
        this.applyPrefs();
        this.savePrefs();
        break;
      case "toggle-ribbon":
        document.querySelector("#app").classList.toggle("ribbon-collapsed");
        break;
      case "asset-grid":
        this.prefs.assetList = false;
        this.library.render();
        this.savePrefs();
        break;
      case "asset-list":
        this.prefs.assetList = true;
        this.library.render();
        this.savePrefs();
        break;
      case "add-folder":
        await this.library.addFolder();
        break;
      case "add-assets":
        if (window.desktop)
          await this.library.addFiles(await window.desktop.chooseAssets());
        else document.querySelector("#asset-input").click();
        break;
      case "asset-settings":
        this.menu(anchor, [
          {
            label: "New category…",
            icon: "plus",
            run: () => this.library.createCategory(),
          },
          {
            label: "Import image files…",
            icon: "image",
            run: () => this.action("add-assets"),
          },
          {
            label: "Add existing folder…",
            icon: "folder",
            run: () => this.library.addFolder(),
          },
          {
            label: "Insert selected assets",
            icon: "plus",
            run: () => this.library.insertSelected(),
          },
          {
            label: "Remove selected from library",
            icon: "trash",
            run: () => this.library.removeSelected(),
          },
        ]);
        break;
      case "shortcuts":
        this.shortcutsDialog();
        break;
      case "settings":
        this.settingsDialog();
        break;
      case "help":
        this.help();
        break;
      case "zoom-in":
        this.editor.setZoom(stepZoom(this.zoom, 1));
        break;
      case "zoom-out":
        this.editor.setZoom(stepZoom(this.zoom, -1));
        break;
      case "zoom-reset":
        this.editor.setZoom(1);
        break;
      case "zoom-fit":
        this.editor.fit();
        break;
      case "fullscreen":
        document.body.classList.toggle("fullscreen");
        break;
      case "background-remove":
        await this.removeBackground();
        break;
    }
    this.changedUI();
  }
  keyDown(e) {
    const target = e.target;
    if ((e.ctrlKey || e.metaKey) && ['z','y'].includes(e.key.toLowerCase())) {
      e.preventDefault();this.action(e.key.toLowerCase() === 'y' || e.shiftKey ? 'redo' : 'undo').catch(error => this.toast(error.message));return;
    }
    if (target.closest("input,textarea,select,[contenteditable=true]")) {
      if (e.key === "Escape") this.modalCancel?.();
      return;
    }
    if (e.key === "Escape") {
      this.editor.pendingShape = null;
      if (this.modalCancel) {
        this.modalCancel();
        return;
      }
      this.closeMenu();
      this.doc.selected = [];
      this.editor.selectionRect = null;
      this.editor.requestRender();
      return;
    }
    if (document.querySelector("#modal-root:not(.floating-dialog) .dialog")) return;
    if (this.busy) return;
    if (e.key === "Enter" && this.editor.pendingShape) {
      e.preventDefault();
      this.editor.finishPending();
      return;
    }
    if (e.ctrlKey && (e.code === "NumpadAdd" || e.code === "NumpadSubtract")) {
      e.preventDefault();
      this.setStrokeWidth(this.width + (e.code === "NumpadAdd" ? 1 : -1));
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase();
    let action;
    if (ctrl) {
      action = {
        n: "new",
        o: "open",
        s: e.shiftKey ? "save-as" : "save",
        z: e.shiftKey ? "redo" : "undo",
        y: "redo",
        c: "copy",
        x: "cut",
        v: "paste",
        d: "duplicate",
        g: e.shiftKey ? "ungroup" : "group",
      }[key];
      if (key === "a") {
        e.preventDefault();
        this.selectAll();
        return;
      }
    } else if (e.altKey) {
      const asset = this.library.assets.find((a) => a.shortcut === key);
      if (asset) {
        e.preventDefault();
        this.library.insert(asset.id);
        return;
      }
    } else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      this.setTool(this.prefs.shortcuts[Number(e.key)]);
      return;
    } else if (e.key === "Delete") action = this.layerFocused || target.closest(".layer-row") ? "delete-layer" : "delete";
    else if (e.key === "Enter" && this.doc.selected.length)
      action = "rasterize";
    else if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
      this.doc.selected.length
    ) {
      e.preventDefault();
      if (!this.selectedEditable()) return;
      const step = 1,
        dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
        dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      this.doc.action(e.shiftKey ? "Smear selection" : "Nudge objects", () => {
        if (e.shiftKey) for (const layer of this.doc.layers) {
          const objects = layer.objects.filter(o => this.doc.selected.includes(o.id));
          if (!objects.length) continue;
          this.doc.assertAllocation(this.doc.width * this.doc.height * 4);
          layer.canvas = cloneCanvas(layer.canvas);
          for (const object of objects) drawObject(layer.canvas.getContext('2d'), object);
        }
        for (const o of this.doc.selectedObjects) {
          o.x += dx;
          o.y += dy;
        }
      });
      return;
    }
    if (action) {
      e.preventDefault();
      this.action(action).catch((err) => this.toast(err.message));
    }
  }
  sizeMenu(anchor) {
    this.menu(
      anchor,
      [1, 2, 3, 4, 5, 8, 10, 16, 24, 32]
        .map((width) => ({
          label: width + " px",
          run: () => {
            this.setStrokeWidth(width);
          },
        }))
        .concat([
          {
            label: "Exact width…",
            icon: "gear",
            run: async () => {
              const v = await this.prompt(
                "Line width",
                "Width in pixels (1–256)",
                String(this.width),
              );
              if (v !== null) {
                if (
                  !Number.isInteger(Number(v)) ||
                  Number(v) < 1 ||
                  Number(v) > 256
                )
                  throw new Error("Enter a whole number from 1 to 256.");
                this.setStrokeWidth(Number(v));
              }
            },
          },
        ]),
    );
    const el = document.querySelector("#menu");
    el.querySelectorAll("button").forEach((b, i) => {
      if (i < 10) {
        b.classList.add("size-option");
        const line = document.createElement("i");
        line.style.height =
          Math.min(10, [1, 2, 3, 4, 5, 8, 10, 16, 24, 32][i]) + "px";
        b.append(line);
      }
    });
  }
  colorDialog() {
    this.dialog(
      "Edit colors",
      `<div class="form-row"><label>Color</label><input id="custom-picker" type="color" value="${this.activeColor === 1 ? this.color1 : this.color2}"><input id="custom-hex" value="${this.activeColor === 1 ? this.color1 : this.color2}" maxlength="7" style="width:120px"></div><p>Signature blue is RGB 24, 71, 241 — the last palette color.</p>`,
      [
        { label: "Cancel", run: () => this.closeDialog() },
        {
          label: "Add color",
          primary: true,
          run: () => {
            const value = document.querySelector("#custom-hex").value;
            if (!/^#[0-9a-f]{6}$/i.test(value))
              throw new Error("Enter a hex color such as #1847F1.");
            if (this.activeColor === 1) this.color1 = value;
            else this.color2 = value;
            this.prefs.customColors = [
              ...new Set([...(this.prefs.customColors || []), value]),
            ].slice(-16);
            this.savePrefs();
            this.updateColors();
            this.closeDialog();
          },
        },
      ],
    );
    document.querySelector("#custom-picker").oninput = (e) =>
      (document.querySelector("#custom-hex").value = e.target.value);
    document.querySelector("#custom-hex").oninput = (e) => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value))
        document.querySelector("#custom-picker").value = e.target.value;
    };
    if (this.prefs.customColors?.length) {
      const el = document.createElement("div");
      el.style.display = "flex";
      el.innerHTML = this.prefs.customColors
        .map(
          (c) =>
            `<button class="color-chip" data-value="${c}" style="--chip:${c}" title="${c}"></button>`,
        )
        .join("");
      el.onclick = (e) => {
        const c = e.target.closest("[data-value]");
        if (c) {
          document.querySelector("#custom-picker").value = c.dataset.value;
          document.querySelector("#custom-hex").value = c.dataset.value;
        }
      };
      document.querySelector(".dialog-body").append(el);
    }
  }
  settingsDialog() {
    const previousTransparency = this.prefs.transparentSelection;
    this.dialog(
      "PaintPlus settings",
      `<label class="check-row"><input id="pref-own-layer" type="checkbox" ${this.prefs.assetOwnLayer ? "checked" : ""}> Insert assets on their own layer</label><label class="check-row"><input id="pref-aspect" type="checkbox" ${this.prefs.aspectLock ? "checked" : ""}> Maintain aspect ratio while resizing objects</label><label class="check-row"><input id="pref-transparent" type="checkbox" ${this.prefs.transparentSelection ? "checked" : ""}> Transparent selection (Color 2)</label><label class="check-row"><input id="pref-smooth" type="checkbox" ${this.prefs.smoothPreview ? "checked" : ""}> Smooth preview while resizing</label><div class="prefs-row"><label>Selection behavior</label><select id="pref-selection-mode"><option value="paint" ${this.prefs.selectionMode === "paint" ? "selected" : ""}>Paint: click outside to commit</option><option value="persistent" ${this.prefs.selectionMode === "persistent" ? "selected" : ""}>Keep floating selections editable</option></select></div><label class="check-row"><input id="pref-grow-paste" type="checkbox" ${this.prefs.growCanvasOnPaste ? "checked" : ""}> Expand the canvas to fit larger pasted images</label><div class="prefs-row"><label>Fill tolerance (0 = exact)</label><input id="pref-tolerance" type="number" min="0" max="100" value="${this.prefs.fillTolerance}"></div><p>True PNG alpha is always preserved. Color-2 transparency removes only exact matches and applies to floating pixel selections. Right-click a palette color to set Color 2.</p>`,
      [
        { label: "Cancel", run: () => this.closeDialog() },
        {
          label: "Save settings",
          primary: true,
          run: () => {
            this.prefs.assetOwnLayer =
              document.querySelector("#pref-own-layer").checked;
            this.prefs.aspectLock =
              document.querySelector("#pref-aspect").checked;
            this.prefs.transparentSelection =
              document.querySelector("#pref-transparent").checked;
            this.prefs.selectionMode = document.querySelector("#pref-selection-mode").value;
            this.prefs.growCanvasOnPaste = document.querySelector("#pref-grow-paste").checked;
            this.prefs.smoothPreview =
              document.querySelector("#pref-smooth").checked;
            this.prefs.fillTolerance = Math.max(
              0,
              Math.min(
                100,
                Number(document.querySelector("#pref-tolerance").value),
              ),
            );
            const selected = this.doc.selectedObjects;
            if (selected.length && previousTransparency !== this.prefs.transparentSelection)
              this.doc.action("Selection transparency", () => {
                for (const o of selected)
                  o.transparentColor = this.prefs.transparentSelection
                    ? this.color2
                    : null;
              });
            this.savePrefs();
            this.closeDialog();
            this.changedUI();
          },
        },
      ],
    );
  }
  shortcutsDialog() {
    this.dialog(
      "Edit Shortcuts",
      `<p>Choose an action for each number key. Number shortcuts are inactive while typing.</p><div class="shortcut-edit">${Array.from({ length: 10 }, (_, i) => `<b>${i}</b><select data-shortcut="${i}">${tools.map((t) => `<option value="${t}" ${this.prefs.shortcuts[i] === t ? "selected" : ""}>${labels[t]}</option>`).join("")}</select>`).join("")}</div><p class="warning">Windows shortcuts (Ctrl+S, Ctrl+C, Ctrl+V and others) and Ctrl+Numpad +/- stay reserved. Duplicate tool assignments will be flagged before saving.</p>`,
      [
        {
          label: "Reset defaults",
          run: () => {
            document
              .querySelectorAll("[data-shortcut]")
              .forEach((el, i) => (el.value = defaultPrefs.shortcuts[i]));
          },
        },
        { label: "Cancel", run: () => this.closeDialog() },
        {
          label: "Save",
          primary: true,
          run: () => {
            const mapping = [
              ...document.querySelectorAll("[data-shortcut]"),
            ].map((el) => el.value);
            if (new Set(mapping).size !== mapping.length) {
              this.toast(
                "Each tool should have one number shortcut. Change duplicate assignments.",
              );
              return;
            }
            this.prefs.shortcuts = mapping;
            this.savePrefs();
            this.updateShortcutTable();
            this.closeDialog();
          },
        },
      ],
    );
  }
  async newDocument() {
    if (
      this.doc.dirty &&
      !(await this.confirm(
        "New image?",
        "Discard unsaved changes? Save a project first to keep your editable scene.",
      ))
    )
      return;
    this.doc = new PaintDocument(1200, 800, () => this.changedUI());
    this.currentFile = null;
    this.fileName = "Untitled";
    document.querySelector("#filename").value = this.fileName;
    this.editor.selectionRect = null;
    this.editor.viewport.scrollLeft = 0;
    this.editor.viewport.scrollTop = 0;
    this.changedUI();
  }
  fileURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Cannot read file."));
      r.readAsDataURL(file);
    });
  }
  async openBrowserFile(file) {
    try {
      if (
        this.doc.dirty &&
        !(await this.confirm(
          "Open image?",
          "Discard unsaved changes and open this file?",
        ))
      )
        return;
      if (file.name.endsWith(".paintplus"))
        this.doc = await deserialize(await file.text(), () => this.changedUI());
      else await this.loadImage(await this.fileURL(file));
      this.currentFile = null;
      this.fileName = file.name.replace(/\.[^.]+$/, "");
      document.querySelector("#filename").value = this.fileName;
      this.doc.dirty = false;
      this.editor.selectionRect = null;
      this.changedUI();
      this.editor.fit();
    } catch (e) {
      this.toast(e.message);
    }
  }
  async loadImage(url) {
    const c = await imageCanvas(url);
    if (c.width * c.height > 64000000)
      throw new Error("Image exceeds the 64 million pixel limit.");
    this.doc = new PaintDocument(c.width, c.height, () => this.changedUI());
    this.doc.activeLayer.canvas = c;
    this.doc.dirty = false;
  }
  async open() {
    if (!window.desktop) {
      document.querySelector("#open-input").click();
      return;
    }
    if (
      this.doc.dirty &&
      !(await this.confirm(
        "Open image?",
        "Discard unsaved changes and open another file?",
      ))
    )
      return;
    const file = await window.desktop.open();
    if (!file) return;
    if (file.project)
      this.doc = await deserialize(file.project, () => this.changedUI());
    else await this.loadImage(file.url);
    this.currentFile = file.path;
    this.fileName = file.path
      .split(/[\\/]/)
      .pop()
      .replace(/\.[^.]+$/, "");
    document.querySelector("#filename").value = this.fileName;
    document.querySelector("#export-format").value = file.project
      ? "paintplus"
      : /\.jpe?g$/i.test(file.path)
        ? "jpg"
        : /\.bmp$/i.test(file.path)
          ? "bmp"
          : /\.webp$/i.test(file.path)
            ? "webp"
            : "png";
    this.doc.dirty = false;
    this.editor.selectionRect = null;
    this.changedUI();
    this.editor.fit();
  }
  async exportBytes(format) {
    this.textEditor.finish();
    if (format === "paintplus")
      return new TextEncoder().encode(serialize(this.doc));
    const out = canvas(this.doc.width, this.doc.height),
      ctx = out.getContext("2d");
    if (format === "jpg" || format === "bmp") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
    }
    for (const l of this.doc.layers)
      if (l.visible) {
        ctx.drawImage(l.canvas, 0, 0);
        for (const o of l.objects) {
          const source = o.transparentColor
            ? colorKey(o.source, o.transparentColor)
            : o.source;
          const resized = await resample(
            source,
            o.width,
            o.height,
            o.resampling,
          );
          drawObject(ctx, {
            ...o,
            source: resized,
            transparentColor: null,
            smoothPreview: true,
  selectionMode: "paint",
  growCanvasOnPaste: true,
  assetsWidth: 280,
  categoriesHeight: 246,
  textStyle: {},
          });
        }
      }
    if (format === "bmp") return bmpBytes(out);
    const mime =
      format === "jpg"
        ? "image/jpeg"
        : format === "webp"
          ? "image/webp"
          : "image/png";
    const blob = await new Promise((resolve) =>
      out.toBlob(resolve, mime, 0.94),
    );
    if (!blob) throw new Error("Could not encode image.");
    return new Uint8Array(await blob.arrayBuffer());
  }
  download(bytes, name, format) {
    const blob = new Blob([bytes], {
        type:
          format === "paintplus"
            ? "application/json"
            : format === "jpg"
              ? "image/jpeg"
              : "image/" + format,
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name + "." + format;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async save(saveAs = false, forceFormat = null) {
    const format =
        forceFormat || document.querySelector("#export-format").value,
      name = document.querySelector("#filename").value.trim() || "Untitled",
      bytes = await this.exportBytes(format);
    if (window.desktop) {
      const result = await window.desktop.save({
        format,
        name,
        bytes,
        quick: false,
        path: !saveAs ? this.currentFile : null,
      });
      if (!result) return;
      this.currentFile = result.path;
      this.toast("Saved " + result.name);
    } else {
      this.download(bytes, name, format);
      this.toast("Downloaded " + name + "." + format);
    }
    this.doc.dirty = false;
    this.changedUI();
  }
  async chooseOutput() {
    if (window.desktop) {
      const dir = await window.desktop.chooseFolder("output");
      if (dir) {
        this.settings.outputFolder = dir.path;
        document.querySelector("#output-folder").textContent = dir.path;
        document.querySelector("#output-folder").title = dir.path;
      }
    } else if ("showDirectoryPicker" in window) {
      try {
        this.outputHandle = await showDirectoryPicker({ mode: "readwrite" });
        document.querySelector("#output-folder").textContent =
          this.outputHandle.name;
      } catch (e) {
        if (e.name !== "AbortError") this.toast(e.message);
      }
    } else
      this.toast(
        "Folder-based Quick Save is available in the Windows desktop application. This preview downloads images.",
      );
  }
  async quickSave() {
    const format = document.querySelector("#export-format").value,
      name = document.querySelector("#filename").value.trim();
    if (
      !name ||
      /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
      /[. ]$/.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    ) {
      this.toast("Enter a valid Windows filename.");
      return;
    }
    if (window.desktop && !this.settings.outputFolder) {
      await this.chooseOutput();
      if (!this.settings.outputFolder) return;
    }
    const bytes = await this.exportBytes(format);
    if (window.desktop) {
      const result = await window.desktop.save({
        format,
        name,
        bytes,
        quick: true,
      });
      this.toast("Quick Saved " + result.name);
    } else if (this.outputHandle) {
      let index = 1,
        fileName = name + "." + format;
      for (;;) {
        try {
          await this.outputHandle.getFileHandle(fileName);
          fileName = name + " (" + ++index + ")." + format;
        } catch (e) {
          if (e.name !== "NotFoundError") throw e;
          break;
        }
      }
      const handle = await this.outputHandle.getFileHandle(fileName, {
          create: true,
        }),
        stream = await handle.createWritable();
      await stream.write(bytes);
      await stream.close();
      this.toast("Quick Saved " + fileName);
    } else {
      this.download(bytes, name, format);
      this.toast(
        "Downloaded " +
          name +
          "." +
          format +
          " · Choose a folder in the desktop app for Quick Save.",
      );
    }
    document.querySelector("#size-status span").textContent =
      "Saved · " + (bytes.length / 1024 / 1024).toFixed(2) + " MB";
    if (format === "paintplus") {
      this.doc.dirty = false;
      this.changedUI();
    }
    return bytes;
  }
  async copy() {
    let source;
    if (this.doc.selectedObjects.length) {
      const b = axisBounds(this.doc.selectedObjects);
      source = canvas(
        Math.max(1, Math.ceil(b.width)),
        Math.max(1, Math.ceil(b.height)),
      );
      const ctx = source.getContext("2d");
      ctx.translate(-b.x, -b.y);
      for (const o of this.doc.selectedObjects) drawObject(ctx, { ...o, transparentColor: null });
    } else {
      source = this.doc.composite();
    }
    this.clipboard = cloneCanvas(source);
    const external = canvas(source.width, source.height), externalContext = external.getContext('2d');
    externalContext.fillStyle = this.color2;externalContext.fillRect(0, 0, source.width, source.height);externalContext.drawImage(source, 0, 0);
    if (window.desktop) await window.desktop.copyImage(external.toDataURL());
    else if (navigator.clipboard?.write) {
      try {
        const blob = await new Promise((r) => external.toBlob(r));
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      } catch {
        this.toast(
          "Copied inside PaintPlus. System clipboard access is available in the desktop application.",
        );
      }
    }
    this.toast("Copied image");
    return true;
  }
  async paste() {
    let source;
    if (window.desktop) {
      const data = await window.desktop.pasteImage();
      if (data) source = await imageCanvas(data);
    } else if (navigator.clipboard?.read) {
      try {
        for (const item of await navigator.clipboard.read())
          for (const type of item.types)
            if (type.startsWith("image/")) {
              source = await imageCanvas(
                await this.fileURL(await item.getType(type)),
              );
              break;
            }
      } catch {}
    }
    source = source || this.clipboard;
    if (!source) {
      this.toast("The clipboard does not contain an image.");
      return;
    }
    this.doc.transaction('Paste image', () => {
      if (this.prefs.growCanvasOnPaste && (source.width > this.doc.width || source.height > this.doc.height))
        this.doc.resizeCanvas(Math.max(source.width, this.doc.width), Math.max(source.height, this.doc.height), this.color2);
      this.doc.insert(source, "Pasted image", this.prefs.assetOwnLayer, { transparentColor: this.prefs.transparentSelection ? this.color2 : null });
    });
    this.setTool("move");
    this.changedUI();
  }
  resizeDialog() {
    const selected = this.doc.selectedObjects;
    if (!selected.length) {
      this.resizeImageDialog();
      return;
    }
    if (
      this.doc.layers.some(
        (l) =>
          l.locked && l.objects.some((o) => this.doc.selected.includes(o.id)),
      )
    ) {
      this.toast("Unlock selected layers before transforming.");
      return;
    }
    const b = { ...selectionBounds(selected) },
      originals = selected.map((o) => ({ ...o })),
      before = this.doc.metadata();
    let applied = false, transparencyEdited = false;
    const keyColor = this.color2;
    const restore = () => {
      if (!applied) {
        for (const original of originals) {
          const o = this.doc.objects.find((o) => o.id === original.id);
          if (o) Object.assign(o, original);
        }
        this.editor.requestRender();
      }
    };
    this.dialog(
      "Resize & Rotate",
      `<div class="form-row"><label for="resize-width">Width:</label><input id="resize-width" type="number" min="1" max="16384" value="${Math.round(b.width)}"><span id="width-unit" hidden>px</span><select id="resize-units" aria-label="Resize units"><option value="pixels">px</option><option value="percent">%</option></select></div><div class="form-row"><label for="resize-height">Height:</label><input id="resize-height" type="number" min="1" max="16384" value="${Math.round(b.height)}"><span id="height-unit">px</span></div><label class="check-row"><input id="resize-aspect" type="checkbox" ${this.prefs.aspectLock ? "checked" : ""}> Maintain aspect ratio</label><div class="form-row"><label>Rotate:</label><input id="resize-angle" type="number" step="1" value="${Math.round(b.angle)}"><span>°</span></div><div class="rotate-buttons">${[
        ["rotate", "90° left", -90],
        ["rotateRight", "90° right", 90],
        ["rotate", "180°", 180],
      ]
        .map(
          ([i, t, v]) =>
            `<button data-angle="${v}">${icon(i, 25)}<span>${t}</span></button>`,
        )
        .join(
          "",
        )}<button id="resize-flipH">${icon("flipH", 25)}<span>Flip H</span></button><button id="resize-flipV">${icon("flipV", 25)}<span>Flip V</span></button></div><div class="form-row"><label>Resampling:</label><select id="resize-quality"><option value="lanczos">High quality (Lanczos)</option><option value="nearest">Nearest neighbour</option></select></div><label class="check-row"><input id="resize-smooth" type="checkbox" ${this.prefs.smoothPreview ? "checked" : ""}> Smooth preview while resizing</label><label class="check-row"><input id="resize-key" type="checkbox" ${selected.every((o) => o.transparentColor) ? "checked" : ""}> Color 2 is transparent</label>`,
      [
        {
          label: "Cancel",
          run: () => {
            restore();
            this.closeDialog();
          },
        },
        {
          label: "Apply",
          primary: true,
          run: () => {
            const w = Number(document.querySelector("#resize-width").value),
              h = Number(document.querySelector("#resize-height").value);
            const pixelWidth =
              document.querySelector("#resize-units").value === "percent"
                ? (b.width * w) / 100
                : w;
            const pixelHeight =
              document.querySelector("#resize-units").value === "percent"
                ? (b.height * h) / 100
                : h;
            if (
              !Number.isFinite(pixelWidth) ||
              !Number.isFinite(pixelHeight) ||
              pixelWidth < 1 ||
              pixelHeight < 1 ||
              pixelWidth > 16384 ||
              pixelHeight > 16384 ||
              pixelWidth * pixelHeight > 64000000
            )
              throw new Error(
                "Enter valid dimensions, up to 16,384 px per side and 64 million pixels.",
              );
            preview();
            const after = this.doc.metadata();
            applied = true;
            this.doc.history.push({
              label: "Resize & Rotate",
              undo: () => this.doc.restore(before),
              redo: () => this.doc.restore(after),
            });
            this.doc.changed();
            this.prefs.aspectLock =
              document.querySelector("#resize-aspect").checked;
            this.prefs.smoothPreview =
              document.querySelector("#resize-smooth").checked;
            this.savePrefs();
            this.closeDialog();
          },
        },
      ],
      { floating: true, onCancel: restore, cleanup: restore },
    );
    const w = document.querySelector("#resize-width"),
      h = document.querySelector("#resize-height"),
      angle = document.querySelector("#resize-angle"),
      units = document.querySelector("#resize-units"),
      ratio = b.width / b.height;
    document.querySelector("#resize-quality").value =
      selected[0].resampling || "lanczos";
    const keyControl = document.querySelector("#resize-key");
    keyControl.indeterminate = selected.some(o => !!o.transparentColor) && !selected.every(o => !!o.transparentColor);
    const preview = () => {
      let nw = Number(w.value),
        nh = Number(h.value);
      if (units.value === "percent") {
        nw = (b.width * nw) / 100;
        nh = (b.height * nh) / 100;
      }
      if (
        !Number.isFinite(nw) ||
        !Number.isFinite(nh) ||
        nw < 1 ||
        nh < 1 ||
        nw > 16384 ||
        nh > 16384 ||
        nw * nh > 64000000
      )
        return;
      const newAngle = Number(angle.value) || 0,
        delta = ((newAngle - b.angle) * Math.PI) / 180;
      for (const original of originals) {
        const o = this.doc.objects.find((o) => o.id === original.id);
        if (!o) continue;
        if (originals.length === 1) {
          o.width = nw;
          o.height = nh;
          o.angle = newAngle;
        } else {
          const cx = b.x + b.width / 2,
            cy = b.y + b.height / 2,
            dx = ((original.x + original.width / 2 - cx) * nw) / b.width,
            dy = ((original.y + original.height / 2 - cy) * nh) / b.height;
          o.width = (original.width * nw) / b.width;
          o.height = (original.height * nh) / b.height;
          o.x =
            b.x +
            nw / 2 +
            dx * Math.cos(delta) -
            dy * Math.sin(delta) -
            o.width / 2;
          o.y =
            b.y +
            nh / 2 +
            dx * Math.sin(delta) +
            dy * Math.cos(delta) -
            o.height / 2;
          o.angle = original.angle + newAngle;
        }
        o.resampling = document.querySelector("#resize-quality").value;
        o.transparentColor = transparencyEdited
          ? (keyControl.checked ? keyColor : null)
          : original.transparentColor;
        o.smoothPreview = document.querySelector("#resize-smooth").checked;
        if (["shape", "text"].includes(o.type)) {
          this.doc.assertAllocation(Math.ceil(nw) * Math.ceil(nh) * 12);
          if (o.type === "text") o.minHeight = Math.round(nh);
          refreshEditable(o);
        }
      }
      this.editor.requestRender();
    };
    w.oninput = () => {
      if (document.querySelector("#resize-aspect").checked)
        h.value =
          units.value === "percent"
            ? w.value
            : Math.max(1, Math.round(Number(w.value) / ratio));
      preview();
    };
    h.oninput = () => {
      if (document.querySelector("#resize-aspect").checked)
        w.value =
          units.value === "percent"
            ? h.value
            : Math.max(1, Math.round(Number(h.value) * ratio));
      preview();
    };
    angle.oninput = preview;
    units.onchange = () => {
      w.value = units.value === "percent" ? 100 : Math.round(b.width);
      h.value = units.value === "percent" ? 100 : Math.round(b.height);
      document.querySelector("#width-unit").textContent =
        units.value === "percent" ? "%" : "px";
      document.querySelector("#height-unit").textContent =
        units.value === "percent" ? "%" : "px";
      preview();
    };
    for (const btn of document.querySelectorAll("[data-angle]"))
      btn.onclick = () => {
        angle.value = Number(angle.value) + Number(btn.dataset.angle);
        preview();
      };
    document.querySelector("#resize-flipH").onclick = () => {
      for (const o of this.doc.selectedObjects) o.flipH = !o.flipH;
      this.editor.requestRender();
    };
    document.querySelector("#resize-flipV").onclick = () => {
      for (const o of this.doc.selectedObjects) o.flipV = !o.flipV;
      this.editor.requestRender();
    };
    keyControl.onchange = () => {
      transparencyEdited = true;
      keyControl.indeterminate = false;
      preview();
    };
    for (const control of ["resize-quality", "resize-smooth"])
      document.querySelector("#" + control).onchange = preview;
  }
  canvasDialog() {
    this.dialog(
      "Canvas properties",
      `<div class="form-row"><label>Width:</label><input id="canvas-width" type="number" min="1" max="16384" value="${this.doc.width}"> px</div><div class="form-row"><label>Height:</label><input id="canvas-height" type="number" min="1" max="16384" value="${this.doc.height}"> px</div><p>Changes the canvas boundary. Image content retains its size. New background pixels use Color 2.</p>`,
      [
        { label: "Cancel", run: () => this.closeDialog() },
        {
          label: "Resize canvas",
          primary: true,
          run: () => {
            const w = Number(document.querySelector("#canvas-width").value),
              h = Number(document.querySelector("#canvas-height").value);
            if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1)
              throw new Error("Enter positive whole pixel dimensions.");
            this.doc.resizeCanvas(w, h, this.color2);
            this.closeDialog();
          },
        },
      ],
    );
  }
  resizeImageDialog() {
    const sw = this.doc.width,
      sh = this.doc.height;
    this.dialog(
      "Resize image",
      `<div class="form-row"><label>Width:</label><input id="image-width" type="number" min="1" max="16384" value="${sw}"> px</div><div class="form-row"><label>Height:</label><input id="image-height" type="number" min="1" max="16384" value="${sh}"> px</div><label class="check-row"><input id="image-aspect" type="checkbox" checked> Maintain aspect ratio</label><div class="form-row"><label>Resampling:</label><select id="image-resample"><option value="lanczos">Lanczos</option><option value="nearest">Nearest neighbour</option></select></div><p>Resizes all layers and the canvas. For canvas boundaries only, use File → Image properties.</p>`,
      [
        { label: "Cancel", run: () => this.closeDialog() },
        {
          label: "Resize",
          primary: true,
          run: async () => {
            const w = Math.round(
                Number(document.querySelector("#image-width").value),
              ),
              h = Math.round(
                Number(document.querySelector("#image-height").value),
              ),
              quality = document.querySelector("#image-resample").value;
            if (w < 1 || h < 1 || w > 16384 || h > 16384 || w * h > 64000000)
              throw new Error("Invalid image size.");
            this.closeDialog();
            await this.runBusy("Resizing image…", async () => {
              this.doc.assertAllocation(w * h * (this.doc.layers.length + 2) * 4 + sw * sh * 4 + w * sh * (quality === "nearest" ? 0 : 16) + w * h * 4);
              const layers = [];
              for (const l of this.doc.layers)
                layers.push({
                  ...l,
                  canvas: await resample(l.canvas, w, h, quality),
                  objects: l.objects.map((o) => ({
                    ...o,
                    x: (o.x * w) / sw,
                    y: (o.y * h) / sh,
                    width: (o.width * w) / sw,
                    height: (o.height * h) / sh,
                  })),
                });
              this.doc.action(
                "Resize image",
                () => {
                  this.doc.width = w;
                  this.doc.height = h;
                  this.doc.layers = layers;
                },
                sw * sh * this.doc.layers.length * 4,
              );
            });
          },
        },
      ],
    );
    const w = document.querySelector("#image-width"),
      h = document.querySelector("#image-height");
    w.oninput = () => {
      if (document.querySelector("#image-aspect").checked)
        h.value = Math.round((Number(w.value) * sh) / sw);
    };
    h.oninput = () => {
      if (document.querySelector("#image-aspect").checked)
        w.value = Math.round((Number(h.value) * sw) / sh);
    };
  }
  rotate(degrees) {
    if (!this.selectedEditable()) return;
    if (this.doc.selectedObjects.length) {
      const b = selectionBounds(this.doc.selectedObjects),
        cx = b.x + b.width / 2,
        cy = b.y + b.height / 2,
        r = (degrees * Math.PI) / 180;
      this.doc.action("Rotate objects", () => {
        for (const o of this.doc.selectedObjects) {
          const dx = o.x + o.width / 2 - cx,
            dy = o.y + o.height / 2 - cy;
          o.x = cx + dx * Math.cos(r) - dy * Math.sin(r) - o.width / 2;
          o.y = cy + dx * Math.sin(r) + dy * Math.cos(r) - o.height / 2;
          o.angle += degrees;
        }
      });
    } else {
      const oldW = this.doc.width,
        oldH = this.doc.height,
        swap = Math.abs(degrees) % 180 === 90,
        w = swap ? oldH : oldW,
        h = swap ? oldW : oldH;
      this.doc.assertAllocation(w * h * (this.doc.layers.length + 2) * 4);
      this.doc.action(
        "Rotate image",
        () => {
          this.doc.layers = this.doc.layers.map((l) => {
            const c = canvas(w, h),
              ctx = c.getContext("2d");
            ctx.translate(w / 2, h / 2);
            ctx.rotate((degrees * Math.PI) / 180);
            ctx.drawImage(l.canvas, -oldW / 2, -oldH / 2);
            return {
              ...l,
              canvas: c,
              objects: l.objects.map((o) => {
                const r = (degrees * Math.PI) / 180,
                  dx = o.x + o.width / 2 - oldW / 2,
                  dy = o.y + o.height / 2 - oldH / 2;
                return {
                  ...o,
                  x: w / 2 + dx * Math.cos(r) - dy * Math.sin(r) - o.width / 2,
                  y: h / 2 + dx * Math.sin(r) + dy * Math.cos(r) - o.height / 2,
                  angle: o.angle + degrees,
                };
              }),
            };
          });
          this.doc.width = w;
          this.doc.height = h;
        },
        oldW * oldH * this.doc.layers.length * 4,
      );
    }
    this.changedUI();
  }
  flip(axis) {
    if (!this.selectedEditable()) return;
    if (this.doc.selectedObjects.length) {
      const bounds = selectionBounds(this.doc.selectedObjects);
      this.doc.action("Flip objects", () => {
        for (const o of this.doc.selectedObjects) {
          if (axis === "H") {
            o.flipH = !o.flipH;
            o.x = bounds.x + bounds.width - (o.x - bounds.x) - o.width;
          } else {
            o.flipV = !o.flipV;
            o.y = bounds.y + bounds.height - (o.y - bounds.y) - o.height;
          }
        }
      });
    } else {
      this.doc.assertAllocation(this.doc.width * this.doc.height * this.doc.layers.length * 4);
      this.doc.action(
        "Flip image",
        () => {
          this.doc.layers = this.doc.layers.map((l) => {
            const c = canvas(this.doc.width, this.doc.height),
              ctx = c.getContext("2d");
            ctx.translate(
              axis === "H" ? this.doc.width : 0,
              axis === "V" ? this.doc.height : 0,
            );
            ctx.scale(axis === "H" ? -1 : 1, axis === "V" ? -1 : 1);
            ctx.drawImage(l.canvas, 0, 0);
            return {
              ...l,
              canvas: c,
              objects: l.objects.map((o) => ({
                ...o,
                x: axis === "H" ? this.doc.width - o.x - o.width : o.x,
                y: axis === "V" ? this.doc.height - o.y - o.height : o.y,
                flipH: axis === "H" ? !o.flipH : o.flipH,
                flipV: axis === "V" ? !o.flipV : o.flipV,
              })),
            };
          });
        },
        this.doc.width * this.doc.height * this.doc.layers.length * 4,
      );
    }
    this.changedUI();
  }
  editText(object = null, point = { x: 20, y: 20 }) {
    this.textEditor.begin(object, { ...point, width: 260, height: 60 });
  }
  async removeBackground() {
    this.textEditor.finish();
    let object = this.doc.selectedObjects[0];
    if (this.doc.selectedObjects.length > 1) {
      this.toast("Select one image or selection to remove its background.");
      return;
    }
    if (!object) {
      if (this.doc.activeLayer.locked) {
        this.toast("Unlock the active layer or select an image object.");
        return;
      }
      const layer = this.doc.activeLayer;
      object = {};
      Object.defineProperty(object, "source", {
        get: () => layer.canvas,
        set: (c) => {
          layer.canvas = c;
        },
      });
    }
    if (this.doc.layers.some((l) => l.locked && l.objects.includes(object))) {
      this.toast("Unlock this layer first.");
      return;
    }
    try {
      this.doc.assertAllocation(object.source.width * object.source.height * 32 + 96 * 1024 * 1024);
      const original = object.source;
      const { source, confidence } = await this.runBusy(
        "Preparing offline background removal…",
        () =>
          new Promise((resolve, reject) => {
            const worker = new Worker(
              new URL("./core/ai.worker.js", import.meta.url),
              { type: "module" },
            );
            const data = object.source
              .getContext("2d")
              .getImageData(
                0,
                0,
                object.source.width,
                object.source.height,
              ).data;
            worker.onmessage = ({ data: m }) => {
              if (m.stage) {
                this.toast(m.stage, 600000);
                return;
              }
              worker.terminate();
              if (m.error) reject(new Error(m.error));
              else {
                const c = canvas(m.width, m.height);
                c.getContext("2d").putImageData(
                  new ImageData(
                    new Uint8ClampedArray(m.pixels),
                    m.width,
                    m.height,
                  ),
                  0,
                  0,
                );
                resolve({ source: c, confidence: new Float32Array(m.confidence) });
              }
            };
            worker.onerror = (e) => {
              worker.terminate();
              reject(new Error(e.message));
            };
            worker.postMessage(
              {
                pixels: data.buffer,
                width: object.source.width,
                height: object.source.height,
                model: new URL("models/u2netp.onnx", document.baseURI).href,
                runtime: new URL("ort/", document.baseURI).href,
              },
              [data.buffer],
            );
          }),
      );
      this.doc.action("AI Remove Background", () => {
        object.source = source;
        object.transparentColor = null;
      });
      this.tool = "move";
      this.changedUI();
      this.toast("Background removed locally. Undo restores the original.");
      this.refineAlphaDialog(object, original, confidence);
    } catch (e) {
      this.toast("Background removal failed: " + e.message, 9000);
    }
  }
  refineAlphaDialog(object, originalPixels, confidence) {
    const initial = object.source, originalData = originalPixels.getContext('2d').getImageData(0, 0, originalPixels.width, originalPixels.height);
    let applied = false;
    this.dialog('Refine background mask',
      `<p>Drag this panel aside and zoom the canvas to inspect the edges. Lower the threshold to recover weak details. The local model may need manual cleanup.</p><div class="prefs-row"><label>Threshold <output id="alpha-threshold-value">10%</output></label><input id="alpha-threshold" type="range" min="-1" max="100" step="0.01" value="10"></div><div class="prefs-row"><label>Softness <output id="alpha-softness-value">0%</output></label><input id="alpha-softness" type="range" min="0" max="100" step="0.1" value="0"></div><label class="check-row"><input id="alpha-hard" type="checkbox" checked> Hard opaque edges</label><p>Refinement always starts from the original pixels and model confidence. Cancel keeps the initial result.</p>`,
      [{ label: 'Cancel', run: () => { this.closeDialog();this.changedUI(); } },
       { label: 'Apply', primary: true, run: () => { const output = object.source;object.source = initial;this.doc.action('Refine alpha', () => { object.source = output; });applied = true;this.closeDialog(); } }],
      { floating: true, nonmodal: true, cleanup: () => { if (!applied) object.source = initial;this.editor.requestRender(); } });
    const refine = () => {
      const threshold = Number(document.querySelector('#alpha-threshold').value) / 100,
        softness = document.querySelector('#alpha-hard').checked ? 0 : Number(document.querySelector('#alpha-softness').value) / 100;
      document.querySelector('#alpha-threshold-value').value = (threshold * 100).toFixed(2) + '%';
      document.querySelector('#alpha-softness-value').value = (softness * 100).toFixed(1) + '%';
      const source = canvas(initial.width, initial.height);
      source.getContext('2d').putImageData(new ImageData(foregroundPixels(originalData.data, confidence, threshold, softness), source.width, source.height), 0, 0);
      object.source = source;this.editor.requestRender();
    };
    document.querySelector('#alpha-threshold').oninput = refine;
    document.querySelector('#alpha-softness').oninput = () => { document.querySelector('#alpha-hard').checked = Number(document.querySelector('#alpha-softness').value) === 0;refine(); };
    document.querySelector('#alpha-hard').onchange = refine;
  }
  selectedEditable() {
    if (
      this.doc.layers.some(
        (l) =>
          l.locked && l.objects.some((o) => this.doc.selected.includes(o.id)),
      )
    ) {
      this.toast("Unlock selected layers first.");
      return false;
    }
    return true;
  }
  selectAll() {
    this.doc.selected = this.doc.layers
      .filter((l) => !l.locked && l.visible)
      .flatMap((l) => l.objects.map((o) => o.id));
    if (!this.doc.selected.length) {
      if (this.doc.activeLayer.locked) {
        this.toast("Unlock the active layer before selecting its pixels.");
        return;
      }
      this.doc.selectRegion(
        { x: 0, y: 0, width: this.doc.width, height: this.doc.height },
        null,
        this.prefs.transparentSelection ? this.color2 : null,
        this.color2,
      );
    }
    this.tool = "move";
    this.changedUI();
  }
  async demo() {
    if (
      this.doc.dirty &&
      !(await this.confirm(
        "Open example scene?",
        "Discard unsaved changes and load the bundled example?",
      ))
    )
      return;
    await this.runBusy("Opening example scene…", async () => {
      const landscape = await imageCanvas(
        new URL("demo/landscape.png", document.baseURI).href,
      );
      const c = await resample(landscape, 1200, 800);
      this.doc = new PaintDocument(1200, 800, () => this.changedUI());
      this.doc.activeLayer.canvas = c;
      this.doc.activeLayer.locked = true;
      const hero = await this.library.insert("hero");
      if (hero) {
        hero.x = 180;
        hero.y = 285;
        hero.width = 260;
        hero.height = (hero.source.height * 260) / hero.source.width;
      }
      const cat = await this.library.insert("cat");
      if (cat) {
        cat.x = 820;
        cat.y = 565;
        cat.width = 180;
        cat.height = (cat.source.height * 180) / cat.source.width;
        cat.angle = 9;
      }
      const foreground = this.doc.addLayer("Foreground");
      foreground.objects = [];
      this.doc.layers.splice(this.doc.layers.indexOf(foreground), 1);
      this.doc.layers.splice(1, 0, foreground);
      if (hero) {
        this.doc.activeLayerId = this.doc.layers.find((l) =>
          l.objects.includes(hero),
        ).id;
        this.doc.selected = [hero.id];
      }
      this.doc.history.clear();
      this.doc.dirty = false;
      this.fileName = "MyScene";
      document.querySelector("#filename").value = this.fileName;
      this.tool = "move";
      this.currentFile = null;
    });
    this.editor.fit();
    this.changedUI();
  }
  help() {
    this.dialog(
      "Welcome to PaintPlus",
      `<div class="help-copy"><p>A local Paint-style editor with raster layers and editable images. Start with a blank canvas, open a picture, or explore File → Open example scene.</p><dl><dt>Draw</dt><dd>Choose a tool, a palette color and Size. Right-drag uses Color 2.</dd><dt>Insert an asset</dt><dd>Double-click its thumbnail. It starts at (0,0), at its original size.</dd><dt>Transform</dt><dd>Drag handles to resize, the circular handle to rotate. Resize opens exact dimensions.</dd><dt>Canvas boundary</dt><dd>Drag the right, bottom, or bottom-right white handle.</dd><dt>Keep editable work</dt><dd>File → Save editable project stores layers, original images and text.</dd><dt>Export</dt><dd>Choose PNG, JPEG, BMP or WebP near Quick Save. Image exports flatten visible layers.</dd><dt>Group</dt><dd>Ctrl-click objects or layers, then Group. Ctrl+G groups; Ctrl+Shift+G ungroups.</dd><dt>Brush width</dt><dd>Ctrl+Numpad Plus / Minus changes width by exactly one pixel.</dd><dt>Commit object</dt><dd>Press Enter or click Commit. Future resize then edits raster pixels.</dd><dt>Undo / redo</dt><dd>Ctrl+Z / Ctrl+Y. History holds up to 80 actions and 128 MB.</dd><dt>Asset removal</dt><dd>Right-click → Remove from library. Original files are never deleted.</dd><dt>Offline AI</dt><dd>Select an image and click AI Remove Background. CPU inference stays on your computer.</dd></dl><p>PNG preserves alpha; JPEG and BMP use a white matte. Save an editable project before closing.</p></div>`,
      [{ label: "Close", primary: true, run: () => this.closeDialog() }],
    );
  }
  async desktopSmoke() {
    const c = canvas(64, 80);
    c.getContext("2d").fillStyle = "#1847f1";
    c.getContext("2d").fillRect(0, 0, 64, 80);
    this.doc.insert(c, "Native clipboard smoke");
    await this.copy();
    const data = await window.desktop.pasteImage();
    const pasted = await imageCanvas(data);
    const clipboardOK = pasted.width === 64 && pasted.height === 80;
    const bytes = await this.exportBytes("png");
    const first = await window.desktop.save({
      name: "PaintPlus-smoke",
      format: "png",
      bytes,
      quick: true,
    });
    const second = await window.desktop.save({
      name: "PaintPlus-smoke",
      format: "png",
      bytes,
      quick: true,
    });
    const hero = await imageCanvas(
      new URL("demo/hero.png", document.baseURI).href,
    );
    const aiInput = canvas(256, 256),
      aiContext = aiInput.getContext("2d");
    aiContext.fillStyle = "#ffffff";
    aiContext.fillRect(0, 0, 256, 256);
    aiContext.drawImage(hero, 45, 12, 165, 230);
    this.doc.insert(aiInput, "Packaged AI smoke");
    await this.removeBackground();
    const aiOutput = this.doc.selectedObjects[0].source;
    const aiInferenceOK =
      aiOutput.getContext("2d").getImageData(0, 0, 1, 1).data[3] < 10 &&
      !!document.querySelector('[aria-label="Refine background mask"]');
    this.closeDialog();
    const project = await this.exportBytes("paintplus");
    const savedProject = await window.desktop.save({
      name: "PaintPlus-project-smoke",
      format: "paintplus",
      bytes: project,
      quick: true,
    });
    return {
      clipboardOK,
      aiInferenceOK,
      first,
      second,
      collisionOK: first.path !== second.path,
      project: savedProject,
      projectBytes: project.length,
      protocol: location.protocol,
      aiModel: await fetch(
        new URL("models/u2netp.onnx", document.baseURI),
      ).then((r) => r.ok),
    };
  }
}
const app = await new PaintPlus().init();
window.paintplus = app;
window.dispatchEvent(new Event("paintplus:ready"));
