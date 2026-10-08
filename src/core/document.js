import { canvas, cloneCanvas, colorKey } from "./raster.js";
import { History, RasterEdit } from "./history.js";
export const id = () =>
  globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
export function createLayer(width, height, name = "Layer", background = null) {
  const c = canvas(width, height);
  if (background) {
    const ctx = c.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  return {
    id: id(),
    name,
    visible: true,
    locked: false,
    canvas: c,
    objects: [],
  };
}
export function objectMatrix(o) {
  const angle = (o.angle * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  return { cos, sin, cx: o.x + o.width / 2, cy: o.y + o.height / 2 };
}
export function localPoint(o, x, y) {
  const { cos, sin, cx, cy } = objectMatrix(o),
    dx = x - cx,
    dy = y - cy;
  return {
    x: dx * cos + dy * sin + o.width / 2,
    y: -dx * sin + dy * cos + o.height / 2,
  };
}
export function worldPoint(o, x, y) {
  const { cos, sin, cx, cy } = objectMatrix(o);
  return {
    x: cx + (x - o.width / 2) * cos - (y - o.height / 2) * sin,
    y: cy + (x - o.width / 2) * sin + (y - o.height / 2) * cos,
  };
}
export function hitObject(o, x, y) {
  const p = localPoint(o, x, y);
  return p.x >= 0 && p.y >= 0 && p.x <= o.width && p.y <= o.height;
}
export function drawObject(ctx, o, quality = true) {
  ctx.save();
  ctx.translate(o.x + o.width / 2, o.y + o.height / 2);
  ctx.rotate((o.angle * Math.PI) / 180);
  ctx.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1);
  ctx.imageSmoothingEnabled =
    o.resampling !== "nearest" && o.smoothPreview !== false;
  ctx.imageSmoothingQuality = "high";
  const src = o.transparentColor ? colorKeyCached(o) : o.source;
  ctx.drawImage(src, -o.width / 2, -o.height / 2, o.width, o.height);
  ctx.restore();
}
const keyed = new WeakMap();
function colorKeyCached(o) {
  let map = keyed.get(o.source);
  if (!map) {
    map = new Map();
    keyed.set(o.source, map);
  }
  if (!map.has(o.transparentColor))
    map.set(o.transparentColor, colorKey(o.source, o.transparentColor));
  return map.get(o.transparentColor);
}
export class PaintDocument {
  constructor(width = 1200, height = 800, onChange = () => {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 16384 || height > 16384 || width * height > 64000000 || width * height * 12 > 512 * 1024 * 1024)
      throw new Error("Canvas dimensions exceed the supported image memory budget.");
    this.width = width;
    this.height = height;
    this.layers = [createLayer(width, height, "Background", "#ffffff")];
    this.activeLayerId = this.layers[0].id;
    this.selected = [];
    this.onChange = onChange;
    this.dirty = false;
    this.maxWorkingBytes = 512 * 1024 * 1024;
    this.history = new History(() => {
      this.dirty = true;
      this.onChange();
    }, 128 * 1024 * 1024, () => this.resources());
  }
  resources(state = this) {
    return [...new Set(state.layers.flatMap(l => [l.canvas, ...l.objects.map(o => o.source)]))];
  }
  assertAllocation(extraBytes) {
    const live = this.resources().reduce((sum, c) => sum + c.width * c.height * 4, 0);
    // Include the renderer's composite/display buffers as well as undo and the
    // requested operation. Reject before allocating, preserving the document.
    const estimate = live + this.history.bytes + this.width * this.height * 8 + extraBytes;
    if (!Number.isFinite(estimate) || estimate > this.maxWorkingBytes)
      throw new Error("This operation needs too much image memory. Use smaller dimensions, fewer layers, or clear undo history first.");
  }
  get activeLayer() {
    return (
      this.layers.find((l) => l.id === this.activeLayerId) || this.layers[0]
    );
  }
  get objects() {
    return this.layers.flatMap((l) => l.objects);
  }
  get selectedObjects() {
    return this.objects.filter((o) => this.selected.includes(o.id));
  }
  changed() {
    this.dirty = true;
    this.onChange();
  }
  metadata() {
    return {
      width: this.width,
      height: this.height,
      activeLayerId: this.activeLayerId,
      selected: [...this.selected],
      layers: this.layers.map((l) => ({
        ...l,
        objects: l.objects.map((o) => ({ ...o })),
      })),
    };
  }
  restore(state) {
    this.width = state.width;
    this.height = state.height;
    this.activeLayerId = state.activeLayerId;
    this.selected = [...state.selected];
    this.layers = state.layers.map((l) => ({
      ...l,
      objects: l.objects.map((o) => ({ ...o })),
    }));
    this.changed();
  }
  action(label, fn, bytes = 0) {
    const before = this.metadata();
    fn();
    const after = this.metadata();
    this.history.push({
      label,
      resources: [...new Set([...this.resources(before), ...this.resources(after)])],
      undo: () => this.restore(before),
      redo: () => this.restore(after),
    });
    this.changed();
  }
  beginRaster() {
    if(!this.activeLayer.visible)throw new Error('Show the active layer before painting.');
    if (this.activeLayer.locked)
      throw new Error("This layer is locked. Unlock it before painting.");
    const layerId = this.activeLayer.id;
    return new RasterEdit(
      this.activeLayer,
      this.history,
      () => this.changed(),
      () => this.layers.find((l) => l.id === layerId),
    );
  }
  addLayer(name = "Layer " + (this.layers.length + 1)) {
    this.assertAllocation(this.width * this.height * 4);
    let layer;
    this.action("New layer", () => {
      layer = createLayer(this.width, this.height, name);
      this.layers.push(layer);
      this.activeLayerId = layer.id;
    });
    return layer;
  }
  insert(source, name = "Image", ownLayer = true, properties = {}) {
    this.assertAllocation((ownLayer ? this.width * this.height * 4 : 0) + (this.resources().includes(source) ? 0 : source.width * source.height * 4));
    if(!ownLayer&&!this.activeLayer.visible)throw new Error('Show the active layer before inserting an object.');
    if (this.activeLayer.locked && !ownLayer)
      throw new Error("This layer is locked.");
    let obj;
    this.action("Insert " + name, () => {
      if (ownLayer) {
        const l = createLayer(this.width, this.height, name);
        this.layers.push(l);
        this.activeLayerId = l.id;
      }
      obj = {
        id: id(),
        name,
        source,
        x: 0,
        y: 0,
        width: source.width,
        height: source.height,
        angle: 0,
        flipH: false,
        flipV: false,
        resampling: "lanczos",
        type: "image",
        ...properties,
      };
      this.activeLayer.objects.push(obj);
      this.selected = [obj.id];
    });
    return obj;
  }
  hit(x, y) {
    for (const l of [...this.layers].reverse())
      if (l.visible && !l.locked)
        for (const o of [...l.objects].reverse())
          if (hitObject(o, x, y)) return { layer: l, object: o };
    return null;
  }
  composite(background = null) {
    const out = canvas(this.width, this.height),
      ctx = out.getContext("2d");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    for (const l of this.layers)
      if (l.visible) {
        ctx.drawImage(l.canvas, 0, 0);
        for (const o of l.objects) drawObject(ctx, o);
      }
    return out;
  }
  deleteSelected() {
    if (!this.selected.length) return;
    const locked = this.layers.some(
      (l) => l.locked && l.objects.some((o) => this.selected.includes(o.id)),
    );
    if (locked) throw new Error("Unlock selected layers first.");
    this.action("Delete objects", () => {
      for (const l of this.layers)
        l.objects = l.objects.filter((o) => !this.selected.includes(o.id));
      this.selected = [];
    });
  }
  resizeCanvas(w, h, fill = "#ffffff") {
    if (!Number.isFinite(w) || !Number.isFinite(h))
      throw new Error("Invalid canvas dimensions.");
    w = Math.max(1, Math.min(16384, Math.round(w)));
    h = Math.max(1, Math.min(16384, Math.round(h)));
    if (w * h > 64000000)
      throw new Error("Canvas is limited to 64 million pixels.");
    this.assertAllocation(w * h * (this.layers.length + 2) * 4);
    this.action(
      "Resize canvas",
      () => {
        this.layers = this.layers.map((l, index) => {
          const c = canvas(w, h),
            ctx = c.getContext("2d");
          if (index === 0) {
            ctx.fillStyle = fill;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.drawImage(l.canvas, 0, 0);
          return { ...l, canvas: c };
        });
        this.width = w;
        this.height = h;
      },
      this.width * this.height * this.layers.length * 4,
    );
  }
  crop(rect) {
    const x = Math.max(0, Math.floor(rect.x)),
      y = Math.max(0, Math.floor(rect.y)),
      w = Math.min(this.width - x, Math.round(rect.width)),
      h = Math.min(this.height - y, Math.round(rect.height));
    if (w < 1 || h < 1) return;
    this.assertAllocation(w * h * (this.layers.length + 2) * 4);
    this.action(
      "Crop",
      () => {
        this.layers = this.layers.map((l) => {
          const c = canvas(w, h);
          c.getContext("2d").drawImage(l.canvas, -x, -y);
          return {
            ...l,
            canvas: c,
            objects: l.objects.map((o) => ({ ...o, x: o.x - x, y: o.y - y })),
          };
        });
        this.width = w;
        this.height = h;
        this.selected = [];
      },
      this.width * this.height * this.layers.length * 4,
    );
  }
  selectRegion(
    rect,
    path = null,
    transparentColor = null,
    paintBackground = "#ffffff",
  ) {
    const x = Math.max(0, Math.floor(rect.x)),
      y = Math.max(0, Math.floor(rect.y)),
      w = Math.min(this.width - x, Math.ceil(rect.width)),
      h = Math.min(this.height - y, Math.ceil(rect.height));
    if (w < 1 || h < 1) return null;
    const l = this.activeLayer;
    if (l.locked) throw new Error("This layer is locked.");
    this.assertAllocation(w * h * 16);
    const src = canvas(w, h),
      ctx = src.getContext("2d");
    if (path) {
      ctx.beginPath();
      path.forEach((p, i) =>
        i ? ctx.lineTo(p.x - x, p.y - y) : ctx.moveTo(p.x - x, p.y - y),
      );
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(l.canvas, -x, -y);
    const before = l.canvas.getContext("2d").getImageData(x, y, w, h);
    let obj;
    const erase = () => {
      const c = l.canvas.getContext("2d");
      c.save();
      if (path) {
        c.beginPath();
        path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.closePath();
        c.clip();
      }
      c.clearRect(x, y, w, h);
      if (this.layers.indexOf(l) === 0) {
        c.fillStyle = paintBackground;
        c.fillRect(x, y, w, h);
      }
      c.restore();
    };
    erase();
    obj = {
      id: id(),
      name: "Selection",
      source: src,
      x,
      y,
      width: w,
      height: h,
      angle: 0,
      flipH: false,
      flipV: false,
      resampling: "lanczos",
      type: "selection",
      transparentColor,
    };
    // One command includes both lifting pixels and creation of the floating object.
    const after = l.canvas.getContext("2d").getImageData(x, y, w, h);
    l.objects.push(obj);
    this.selected = [obj.id];
    this.history.push({
      label: "Select pixels",
      bytes: w * h * 8,
      undo: () => {
        const layer = this.layers.find((layer) => layer.id === l.id);
        layer.canvas.getContext("2d").putImageData(before, x, y);
        layer.objects = layer.objects.filter((o) => o.id !== obj.id);
        this.selected = [];
        this.changed();
      },
      redo: () => {
        const layer = this.layers.find((layer) => layer.id === l.id);
        layer.canvas.getContext("2d").putImageData(after, x, y);
        layer.objects.push({ ...obj });
        this.selected = [obj.id];
        this.changed();
      },
    });
    this.changed();
    return obj;
  }
  duplicateSelected() {
    const selected = this.selectedObjects;
    if (!selected.length) return;
    this.action("Duplicate objects", () => {
      const ids = [];
      const groups = new Map();
      for (const l of this.layers) {
        if (l.locked) continue;
        for (const o of [...l.objects])
          if (this.selected.includes(o.id)) {
            const c = { ...o, id: id(), x: o.x + 16, y: o.y + 16 };
            if (o.group) {
              if (!groups.has(o.group)) groups.set(o.group, id());
              c.group = groups.get(o.group);
            }
            l.objects.push(c);
            ids.push(c.id);
          }
      }
      this.selected = ids;
    });
  }
  groupSelected() {
    if (this.selectedObjects.length < 2) return;
    const group = id();
    this.action("Group objects", () => {
      for (const o of this.selectedObjects) o.group = group;
    });
  }
  ungroupSelected() {
    this.action("Ungroup objects", () => {
      for (const o of this.selectedObjects) delete o.group;
    });
  }
  async rasterize(resample) {
    const targets = this.selectedObjects;
    if (!targets.length) return;
    const temporary = targets.reduce((sum, o) => sum + o.width * o.height * 8 + o.source.width * o.source.height * 4 + Math.round(o.width) * o.source.height * 16, 0);
    this.assertAllocation(temporary + this.width * this.height * this.layers.length * 4);
    for (const l of this.layers)
      if (l.locked && l.objects.some((o) => this.selected.includes(o.id)))
        throw new Error("Unlock selected layers first.");
    const resized = new Map();
    for (const o of targets) {
      const src = o.transparentColor ? colorKeyCached(o) : o.source;
      resized.set(
        o.id,
        await resample(
          src,
          Math.max(1, Math.round(o.width)),
          Math.max(1, Math.round(o.height)),
          o.resampling,
        ),
      );
    }
    this.action(
      "Rasterize objects",
      () => {
        for (const l of this.layers) {
          if (!l.objects.some((o) => this.selected.includes(o.id))) continue;
          l.canvas = cloneCanvas(l.canvas);
          for (const o of l.objects)
            if (resized.has(o.id))
              drawObject(l.canvas.getContext("2d"), {
                ...o,
                source: resized.get(o.id),
                transparentColor: null,
              });
          l.objects = l.objects.filter((o) => !resized.has(o.id));
        }
        this.selected = [];
      },
      this.width * this.height * this.layers.length * 4,
    );
  }
  mergeDown(layerId = this.activeLayerId) {
    const index = this.layers.findIndex((l) => l.id === layerId);
    if (index <= 0) return;
    const top = this.layers[index],
      bottom = this.layers[index - 1];
    if (top.locked || bottom.locked)
      throw new Error("Unlock both layers before merging.");
    if (!top.visible || !bottom.visible)
      throw new Error("Show both layers before merging.");
    this.assertAllocation(this.width * this.height * 4);
    this.action(
      "Merge down",
      () => {
        bottom.canvas = cloneCanvas(bottom.canvas);
        const ctx = bottom.canvas.getContext("2d");
        for (const o of bottom.objects) drawObject(ctx, o);
        ctx.drawImage(top.canvas, 0, 0);
        for (const o of top.objects) drawObject(ctx, o);
        bottom.objects = [];
        this.layers.splice(index, 1);
        this.activeLayerId = bottom.id;
        this.selected = [];
      },
      this.width * this.height * 4,
    );
  }
}
