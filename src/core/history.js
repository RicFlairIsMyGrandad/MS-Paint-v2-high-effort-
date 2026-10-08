export class History {
  constructor(onChange = () => {}, maxBytes = 128 * 1024 * 1024, liveResources = () => []) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxBytes = maxBytes;
    this.onChange = onChange;
    this.liveResources = liveResources;
    this.droppedOperation = null;
  }
  get bytes() {
    const live = new Set(this.liveResources()), retained = new Set();
    let bytes = 0;
    for (const command of [...this.undoStack, ...this.redoStack]) {
      bytes += command.bytes || 0;
      for (const resource of command.resources || []) if (!live.has(resource)) retained.add(resource);
    }
    for (const resource of retained) bytes += resource.width * resource.height * 4;
    return bytes;
  }
  trim() {
    while (this.undoStack.length + this.redoStack.length > 80 || this.bytes > this.maxBytes) {
      if (this.undoStack.length) this.undoStack.shift();
      else if (this.redoStack.length) this.redoStack.shift();
      else break;
    }
  }
  push(command) {
    this.redoStack = [];
    this.undoStack.push(command);
    this.trim();
    this.droppedOperation = this.undoStack.includes(command) ? null : command.label;
    this.onChange();
  }
  undo() {
    const c = this.undoStack.pop();
    if (!c) return false;
    c.undo();
    this.redoStack.push(c);
    this.trim();
    this.onChange();
    return true;
  }
  redo() {
    const c = this.redoStack.pop();
    if (!c) return false;
    c.redo();
    this.undoStack.push(c);
    this.trim();
    this.onChange();
    return true;
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.droppedOperation = null;
    this.onChange();
  }
}
export class RasterEdit {
  constructor(layer, history, onChange, resolveLayer = () => layer) {
    this.layer = layer;
    this.resolveLayer = resolveLayer;
    this.history = history;
    this.onChange = onChange;
    this.tiles = new Map();
  }
  capture(x, y, w, h) {
    const c = this.layer.canvas,
      ctx = c.getContext("2d");
    let x0 = Math.max(0, Math.floor(x / 64) * 64),
      y0 = Math.max(0, Math.floor(y / 64) * 64),
      x1 = Math.min(c.width, x + w),
      y1 = Math.min(c.height, y + h);
    for (let ty = y0; ty < y1; ty += 64)
      for (let tx = x0; tx < x1; tx += 64) {
        const key = tx + ":" + ty;
        if (!this.tiles.has(key))
          this.tiles.set(key, {
            x: tx,
            y: ty,
            before: ctx.getImageData(
              tx,
              ty,
              Math.min(64, c.width - tx),
              Math.min(64, c.height - ty),
            ),
          });
      }
  }
  commit(label = "Draw") {
    const ctx = this.layer.canvas.getContext("2d"),
      tiles = [...this.tiles.values()].map((t) => ({
        ...t,
        after: ctx.getImageData(t.x, t.y, t.before.width, t.before.height),
      }));
    if (!tiles.length) return;
    // Do not retain this RasterEdit and its original full-size layer canvas.
    // Commands need the tiled buffers and current-layer resolver only.
    const resolveLayer = this.resolveLayer, onChange = this.onChange;
    const apply = (key) => {
      const layer = resolveLayer();
      if (!layer) return;
      for (const t of tiles)
        layer.canvas.getContext("2d").putImageData(t[key], t.x, t.y);
      onChange();
    };
    this.history.push({
      label,
      bytes: tiles.reduce((n, t) => n + t.before.data.byteLength * 2, 0),
      undo: () => apply("before"),
      redo: () => apply("after"),
    });
    this.onChange();
  }
}
