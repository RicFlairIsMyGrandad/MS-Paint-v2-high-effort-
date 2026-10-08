export class History {
  constructor(onChange = () => {}, maxBytes = 128 * 1024 * 1024) {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
    this.maxBytes = maxBytes;
    this.onChange = onChange;
  }
  push(command) {
    this.redoStack = [];
    this.undoStack.push(command);
    this.bytes += command.bytes || 0;
    while (
      this.undoStack.length > 80 ||
      (this.bytes > this.maxBytes && this.undoStack.length > 1)
    ) {
      this.bytes -= this.undoStack.shift().bytes || 0;
    }
    this.onChange();
  }
  undo() {
    const c = this.undoStack.pop();
    if (!c) return false;
    c.undo();
    this.bytes -= c.bytes || 0;
    this.redoStack.push(c);
    this.onChange();
    return true;
  }
  redo() {
    const c = this.redoStack.pop();
    if (!c) return false;
    c.redo();
    this.undoStack.push(c);
    this.bytes += c.bytes || 0;
    this.onChange();
    return true;
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
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
    const apply = (key) => {
      const layer = this.resolveLayer();
      if (!layer) return;
      for (const t of tiles)
        layer.canvas.getContext("2d").putImageData(t[key], t.x, t.y);
      this.onChange();
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
