import {
  drawObject,
  worldPoint,
  localPoint,
  hitObject,
} from "../core/document.js";
import { paintSegment, replaceColorSegment, floodFill, colorAt, canvas } from "../core/raster.js";
import { drawShape } from "../core/shapes.js";
const cursorSVG = (path, x = 1, y = 22) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='${path}' fill='white' stroke='#162e48' stroke-width='1.6'/></svg>`)}") ${x} ${y}, crosshair`;
export const cursors = {
  pencil: cursorSVG("m3 17 13-13 5 5L8 22H3v-5Z M13 7l5 5"),
  brush: cursorSVG("m9 14 10-12 4 4-12 10 M9 14c-7-2-3 6-8 9 12 3 13-5 8-9Z"),
  eraser: cursorSVG("m2 15 10-12 11 9-10 11H9l-7-8Z M7 10l10 8"),
  fill: cursorSVG("m3 8 8-6 11 10-11 10L1 12l2-4Z M3 8h17 M22 17l2 5h-4l2-5Z"),
  dropper: cursorSVG("m4 17 12-12 5 5-12 12H3v-5Z M14 3l9 9"),
  text: "text",
  select: "crosshair",
  free: "crosshair",
  crop: "crosshair",
  shape: "crosshair",
  move: "move",
  zoom: "zoom-in",
};
export function selectionBounds(objects) {
  if (!objects.length) return null;
  if (objects.length === 1) return objects[0];
  const points = objects.flatMap((o) =>
    [
      [0, 0],
      [o.width, 0],
      [o.width, o.height],
      [0, o.height],
    ].map(([x, y]) => worldPoint(o, x, y)),
  );
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y)),
    right = Math.max(...points.map((p) => p.x)),
    bottom = Math.max(...points.map((p) => p.y));
  return { x, y, width: right - x, height: bottom - y, angle: 0 };
}
export function axisBounds(objects) {
  if (!objects.length) return null;
  const points = objects.flatMap((o) =>
    [
      [0, 0],
      [o.width, 0],
      [o.width, o.height],
      [0, o.height],
    ].map(([x, y]) => worldPoint(o, x, y)),
  );
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y)),
    right = Math.max(...points.map((p) => p.x)),
    bottom = Math.max(...points.map((p) => p.y));
  return { x, y, width: right - x, height: bottom - y, angle: 0 };
}
const handlePoints = (o) =>
  [
    [0, 0],
    [o.width / 2, 0],
    [o.width, 0],
    [o.width, o.height / 2],
    [o.width, o.height],
    [o.width / 2, o.height],
    [0, o.height],
    [0, o.height / 2],
  ].map(([x, y]) => worldPoint(o, x, y));
const constrain = (a, b) => {
  const angle =
      (Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * Math.PI) /
      4,
    d = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: a.x + Math.cos(angle) * d, y: a.y + Math.sin(angle) * d };
};
export class Editor {
  constructor(app) {
    this.app = app;
    this.stage = document.querySelector("#canvas-stage");
    this.display = document.querySelector("#display");
    this.overlay = document.querySelector("#overlay");
    this.viewport = document.querySelector("#viewport");
    this.drag = null;
    this.hover = null;
    this.pendingRender = false;
    this.selectionRect = null;
    this.paintActive = false;
    this.overlay.addEventListener("pointerdown", (e) => this.pointerDown(e));
    this.overlay.addEventListener("pointermove", (e) => this.pointerMove(e));
    this.overlay.addEventListener("pointerup", (e) => this.pointerUp(e));
    this.overlay.addEventListener("pointercancel", (e) => this.pointerUp(e));
    this.overlay.addEventListener("lostpointercapture", () => {
      if (this.drag) this.finishDrag();
    });
    this.overlay.addEventListener("contextmenu", (e) => e.preventDefault());
    this.overlay.addEventListener("pointerleave", () => {
      document.querySelector("#brush-cursor").style.display = "none";
    });
    this.overlay.addEventListener("dblclick", (e) => {
      if (this.pendingShape?.name === "polygon") {
        this.finishPending();
        return;
      }
      const p = this.point(e),
        hit = this.app.doc.hit(p.x, p.y);
      if (hit?.object.type === "text") this.app.editText(hit.object);
    });
    this.viewport.addEventListener("scroll", () => this.drawRulers());
    this.viewport.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          this.setZoom(this.app.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), {
            x: e.clientX,
            y: e.clientY,
          });
        }
      },
      { passive: false },
    );
    for (const h of this.stage.querySelectorAll("[data-canvas-handle]"))
      h.addEventListener("pointerdown", (e) => this.canvasResizeStart(e));
    new ResizeObserver(() => {
      this.drawRulers();
    }).observe(document.querySelector("#workspace"));
  }
  get doc() {
    return this.app.doc;
  }
  point(e) {
    const r = this.overlay.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / this.app.zoom,
      y: (e.clientY - r.top) / this.app.zoom,
    };
  }
  requestRender() {
    if (this.pendingRender) return;
    this.pendingRender = true;
    requestAnimationFrame(() => {
      this.pendingRender = false;
      this.render();
    });
  }
  render() {
    const d = this.doc,
      z = this.app.zoom;
    for (const c of [this.display, this.overlay]) {
      if (c.width !== d.width) c.width = d.width;
      if (c.height !== d.height) c.height = d.height;
      c.style.width = d.width * z + "px";
      c.style.height = d.height * z + "px";
    }
    this.stage.style.width = d.width * z + "px";
    this.stage.style.height = d.height * z + "px";
    const ctx = this.display.getContext("2d");
    ctx.clearRect(0, 0, d.width, d.height);
    for (const l of d.layers)
      if (l.visible) {
        ctx.drawImage(l.canvas, 0, 0);
        for (const o of l.objects) drawObject(ctx, o);
      }
    const over = this.overlay.getContext("2d");
    over.clearRect(0, 0, d.width, d.height);
    if (this.app.prefs.grid && z >= 2) {
      over.save();
      over.strokeStyle = "#64789235";
      over.lineWidth = 1 / z;
      over.beginPath();
      for (let x = 0; x <= d.width; x++) {
        over.moveTo(x, 0);
        over.lineTo(x, d.height);
      }
      for (let y = 0; y <= d.height; y++) {
        over.moveTo(0, y);
        over.lineTo(d.width, y);
      }
      over.stroke();
      over.restore();
    }
    if (this.drag?.type === "shape") {
      const c = this.drag.color;
      drawShape(over, this.app.shape, this.drag.start, this.drag.end, {
        width: this.app.width,
        color: c,
        background: this.drag.background,
        outline: this.app.outline,
        fill: this.app.shapeFill,
      });
    }
    if (this.pendingShape) {
      const s = this.pendingShape;
      drawShape(over, s.name, s.start, s.end, {
        ...s.options,
        controls: s.controls,
        points: s.points,
      });
    }
    if (this.drag?.type === "selection") {
      over.save();
      over.strokeStyle = "#006ce3";
      over.fillStyle = "#0078ff12";
      over.lineWidth = 1 / z;
      over.setLineDash([5 / z, 3 / z]);
      over.beginPath();
      if (this.drag.free) {
        this.drag.path.forEach((p, i) =>
          i ? over.lineTo(p.x, p.y) : over.moveTo(p.x, p.y),
        );
      } else {
        const r = this.rect(this.drag.start, this.drag.end);
        over.rect(r.x, r.y, r.width, r.height);
      }
      over.stroke();
      over.fill();
      over.restore();
    }
    const selected = d.selectedObjects;
    const bounds = selectionBounds(selected);
    if (bounds) {
      this.drawSelection(over, bounds);
      if (selected.length > 1)
        for (const o of selected) this.drawOutline(over, o, "#0078ed80");
    }
    if (this.selectionRect && this.app.tool === "crop") {
      over.save();
      over.strokeStyle = "#0078ed";
      over.lineWidth = 1 / z;
      over.setLineDash([5 / z, 4 / z]);
      const r = this.selectionRect;
      over.strokeRect(r.x, r.y, r.width, r.height);
      over.restore();
    }
    this.drawRulers();
    this.updateCursor(this.hover);
    document.querySelector("#dimensions-status span").textContent =
      d.width + " × " + d.height + " px";
    document.querySelector("#zoom-percent").textContent =
      Math.round(z * 100) + "%";
    document.querySelector("#zoom-slider").value = z * 100;
  }
  drawOutline(ctx, o, color = "#006ce8") {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / this.app.zoom;
    ctx.setLineDash([6 / this.app.zoom, 3 / this.app.zoom]);
    ctx.beginPath();
    [
      [0, 0],
      [o.width, 0],
      [o.width, o.height],
      [0, o.height],
    ].forEach(([x, y], i) => {
      const p = worldPoint(o, x, y);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  drawSelection(ctx, o) {
    this.drawOutline(ctx, o);
    const z = this.app.zoom,
      s = 7 / z;
    ctx.save();
    ctx.lineWidth = 1 / z;
    ctx.strokeStyle = "#243b58";
    ctx.fillStyle = "white";
    for (const p of handlePoints(o)) {
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    const top = worldPoint(o, o.width / 2, 0),
      rotate = worldPoint(o, o.width / 2, -25 / z);
    ctx.strokeStyle = "#0078ff";
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(rotate.x, rotate.y);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(rotate.x, rotate.y, 6 / z, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0078ff";
    ctx.beginPath();
    ctx.arc(rotate.x, rotate.y, 3 / z, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  handleAt(p) {
    const bounds = selectionBounds(this.doc.selectedObjects);
    if (!bounds) return null;
    const rotation = worldPoint(bounds, bounds.width / 2, -25 / this.app.zoom);
    if (Math.hypot(p.x - rotation.x, p.y - rotation.y) < 10 / this.app.zoom)
      return { type: "rotate", bounds };
    const hs = handlePoints(bounds);
    for (let i = 0; i < hs.length; i++)
      if (Math.hypot(p.x - hs[i].x, p.y - hs[i].y) < 8 / this.app.zoom)
        return { type: "resize", index: i, bounds };
    if (hitObject(bounds, p.x, p.y)) return { type: "move", bounds };
    return null;
  }
  updateCursor(p) {
    let cursor = cursors[this.app.tool] || "crosshair";
    if (p && ["select", "free", "move", "crop"].includes(this.app.tool)) {
      const h = this.handleAt(p);
      if (h) {
        cursor =
          h.type === "rotate"
            ? "grab"
            : h.type === "move"
              ? "move"
              : [
                  "nwse-resize",
                  "ns-resize",
                  "nesw-resize",
                  "ew-resize",
                  "nwse-resize",
                  "ns-resize",
                  "nesw-resize",
                  "ew-resize",
                ][h.index];
      } else if (this.doc.hit(p.x, p.y)) cursor = "move";
    }
    if (this.drag?.type === "rotate") cursor = "grabbing";
    this.overlay.style.cursor = cursor;
  }
  rect(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
  }
  pointerDown(e) {
    if ((e.button !== 0 && e.button !== 2) || this.app.busy) return;
    e.preventDefault();
    this.overlay.setPointerCapture(e.pointerId);
    const p = this.point(e);
    this.hover = p;
    const a = this.app,
      d = this.doc,
      color = e.button === 2 ? a.color2 : a.color1,
      background = e.button === 2 ? a.color1 : a.color2;
    try {
      if (a.tool === "shape" && this.pendingShape) {
        const s = this.pendingShape;
        if (s.name === "curve") {
          s.controls[s.phase] = p;
          this.drag = { type: "curve-bend", start: p, end: p };
        } else {
          if (Math.hypot(p.x - s.points.at(-1).x, p.y - s.points.at(-1).y) > 1)
            s.points.push(p);
          this.drag = { type: "polygon-point", start: p, end: p };
        }
        this.requestRender();
        return;
      }
      if (["select", "free", "move", "crop"].includes(a.tool)) {
        let handle = this.handleAt(p);
        const hit = d.hit(p.x, p.y);
        if (hit && !handle) {
          d.activeLayerId = hit.layer.id;
          const group = hit.object.group;
          if (e.ctrlKey || e.shiftKey) {
            d.selected = d.selected.includes(hit.object.id)
              ? d.selected.filter((id) => id !== hit.object.id)
              : [...d.selected, hit.object.id];
          } else {
            d.selected = group
              ? d.objects.filter((o) => o.group === group).map((o) => o.id)
              : [hit.object.id];
          }
          handle = this.handleAt(p);
          a.updateLayers();
        }
        if (handle && d.selectedObjects.length) {
          if (
            d.layers.some(
              (l) =>
                l.locked && l.objects.some((o) => d.selected.includes(o.id)),
            )
          )
            throw new Error("This layer is locked.");
          const originals = d.selectedObjects.map((o) => ({ ...o }));
          this.drag = {
            ...handle,
            bounds: { ...handle.bounds },
            start: p,
            originals,
            before: d.metadata(),
          };
          return;
        }
        if (a.tool === "move") {
          d.selected = [];
          a.changedUI();
          return;
        }
        d.selected = [];
        this.selectionRect = null;
        this.drag = {
          type: "selection",
          start: p,
          end: p,
          path: [p],
          free: a.tool === "free",
        };
      } else if (["pencil", "brush", "eraser"].includes(a.tool)) {
        if (d.activeLayer.locked) throw new Error("This layer is locked.");
        if (!d.activeLayer.visible)
          throw new Error("Show the active layer before painting.");
        this.drag = {
          type: "paint",
          start: p,
          last: p,
          edit: d.beginRaster(),
          color,
          background,
          right: e.button === 2,
        };
        this.stroke(p, p);
      } else if (a.tool === "fill") {
        const edit = d.beginRaster();
        edit.capture(0, 0, d.width, d.height);
        if (
          floodFill(
            d.activeLayer.canvas,
            p.x,
            p.y,
            color,
            a.prefs.fillTolerance,
          )
        )
          edit.commit("Fill");
      } else if (a.tool === "dropper") {
        const c = d.composite(a.color2);
        const picked = colorAt(c, p.x, p.y);
        if (e.button === 2) a.color2 = picked;
        else a.color1 = picked;
        a.updateColors();
      } else if (a.tool === "text") {
        a.editText(null, p);
      } else if (a.tool === "zoom") {
        this.setZoom(a.zoom * (e.button === 2 ? 0.5 : 2), {
          x: e.clientX,
          y: e.clientY,
        });
      } else if (a.tool === "shape") {
        if (d.activeLayer.locked) throw new Error("This layer is locked.");
        this.drag = { type: "shape", start: p, end: p, color, background };
      }
      this.requestRender();
    } catch (err) {
      a.toast(err.message);
    }
  }
  stroke(a, b) {
    const drag = this.drag,
      app = this.app,
      layer = this.doc.activeLayer,
      r = app.width / 2 + 3;
    drag.edit.capture(
      Math.min(a.x, b.x) - r,
      Math.min(a.y, b.y) - r,
      Math.abs(a.x - b.x) + 2 * r,
      Math.abs(a.y - b.y) + 2 * r,
    );
    const ctx = layer.canvas.getContext("2d");
    if (app.tool === "eraser" && drag.right) {
      replaceColorSegment(ctx, a, b, app.color1, app.color2, app.width);
    } else if (app.tool === "eraser" && this.doc.layers.indexOf(layer) === 0)
      paintSegment(ctx, a, b, {
        type: "brush",
        brush: "square",
        color: app.color2,
        width: app.width,
      });
    else
      paintSegment(ctx, a, b, {
        type: app.tool,
        brush: app.brush,
        color: drag.color,
        background: drag.background,
        width: app.width,
      });
  }
  pointerMove(e) {
    const p = this.point(e);
    this.hover = p;
    this.updateCursor(p);
    document.querySelector("#cursor-status span").textContent =
      Math.floor(p.x) + ", " + Math.floor(p.y) + " px";
    const ring = document.querySelector("#brush-cursor");
    if (["brush", "eraser"].includes(this.app.tool)) {
      ring.style.display = "block";
      ring.style.left = p.x * this.app.zoom + "px";
      ring.style.top = p.y * this.app.zoom + "px";
      ring.style.width = Math.max(3, this.app.width * this.app.zoom) + "px";
      ring.style.height = Math.max(3, this.app.width * this.app.zoom) + "px";
      ring.style.borderRadius =
        this.app.tool === "eraser" || this.app.brush === "square" ? "0" : "50%";
    } else ring.style.display = "none";
    const drag = this.drag;
    if (!drag) return;
    if (drag.type === "curve-bend") {
      this.pendingShape.controls[this.pendingShape.phase] = p;
    } else if (drag.type === "paint") {
      let next = p;
      if (e.shiftKey) next = constrain(drag.start, p);
      const samples = e.getCoalescedEvents?.() || [];
      if (samples.length && !e.shiftKey)
        for (const sample of samples) {
          const q = this.point(sample);
          this.stroke(drag.last, q);
          drag.last = q;
        }
      else {
        this.stroke(drag.last, next);
        drag.last = next;
      }
    } else if (drag.type === "shape") {
      let end = p;
      if (e.shiftKey) {
        if (["line", "curve"].includes(this.app.shape))
          end = constrain(drag.start, p);
        else {
          const s = Math.max(
            Math.abs(p.x - drag.start.x),
            Math.abs(p.y - drag.start.y),
          );
          end = {
            x: drag.start.x + Math.sign(p.x - drag.start.x) * s,
            y: drag.start.y + Math.sign(p.y - drag.start.y) * s,
          };
        }
      }
      drag.end = end;
    } else if (drag.type === "selection") {
      drag.end = p;
      if (drag.free) drag.path.push(p);
    } else if (drag.type === "move") {
      const dx = p.x - drag.start.x,
        dy = p.y - drag.start.y;
      for (const original of drag.originals) {
        const o = this.doc.objects.find((o) => o.id === original.id);
        o.x = original.x + dx;
        o.y = original.y + dy;
      }
    } else if (drag.type === "resize") this.resizeObjects(p, e.shiftKey);
    else if (drag.type === "rotate") {
      const b = drag.bounds,
        cx = b.x + b.width / 2,
        cy = b.y + b.height / 2,
        initial = Math.atan2(drag.start.y - cy, drag.start.x - cx),
        now = Math.atan2(p.y - cy, p.x - cx);
      let delta = ((now - initial) * 180) / Math.PI;
      if (e.shiftKey) delta = Math.round(delta / 15) * 15;
      const r = (delta * Math.PI) / 180;
      for (const original of drag.originals) {
        const o = this.doc.objects.find((o) => o.id === original.id);
        o.angle = original.angle + delta;
        if (drag.originals.length > 1) {
          const dx = original.x + original.width / 2 - cx,
            dy = original.y + original.height / 2 - cy;
          o.x = cx + dx * Math.cos(r) - dy * Math.sin(r) - o.width / 2;
          o.y = cy + dx * Math.sin(r) + dy * Math.cos(r) - o.height / 2;
        }
      }
    }
    this.requestRender();
  }
  resizeObjects(p, shift) {
    const d = this.drag,
      b = d.bounds,
      local = localPoint(b, p.x, p.y),
      i = d.index,
      affectsX = i !== 1 && i !== 5,
      affectsY = i !== 3 && i !== 7,
      left = [0, 6, 7].includes(i),
      top = [0, 1, 2].includes(i);
    let nw = affectsX
        ? Math.max(1, left ? b.width - local.x : local.x)
        : b.width,
      nh = affectsY
        ? Math.max(1, top ? b.height - local.y : local.y)
        : b.height;
    if (this.app.prefs.aspectLock || shift) {
      const ratio = b.width / b.height;
      if (!affectsX) nw = nh * ratio;
      else if (!affectsY) nh = nw / ratio;
      else if (nw / b.width > nh / b.height) nh = nw / ratio;
      else nw = nh * ratio;
    }
    const anchor = worldPoint(b, left ? b.width : 0, top ? b.height : 0);
    const angle = (b.angle * Math.PI) / 180,
      ax = left ? nw : 0,
      ay = top ? nh : 0;
    const newCx =
        anchor.x -
        (ax - nw / 2) * Math.cos(angle) +
        (ay - nh / 2) * Math.sin(angle),
      newCy =
        anchor.y -
        (ax - nw / 2) * Math.sin(angle) -
        (ay - nh / 2) * Math.cos(angle);
    const nx = newCx - nw / 2,
      ny = newCy - nh / 2;
    if (d.originals.length === 1) {
      const o = this.doc.objects.find((o) => o.id === d.originals[0].id);
      o.x = nx;
      o.y = ny;
      o.width = nw;
      o.height = nh;
    } else
      for (const original of d.originals) {
        const o = this.doc.objects.find((o) => o.id === original.id);
        o.x = nx + ((original.x - b.x) * nw) / b.width;
        o.y = ny + ((original.y - b.y) * nh) / b.height;
        o.width = (original.width * nw) / b.width;
        o.height = (original.height * nh) / b.height;
      }
  }
  pointerUp(e) {
    if (!this.drag) return;
    this.finishDrag();
    if (this.overlay.hasPointerCapture(e.pointerId))
      this.overlay.releasePointerCapture(e.pointerId);
  }
  finishDrag() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    const d = this.doc;
    try {
      if (drag.type === "paint")
        drag.edit.commit(
          this.app.tool === "eraser"
            ? "Erase"
            : this.app.tool === "pencil"
              ? "Pencil stroke"
              : "Brush stroke",
        );
      else if (drag.type === "curve-bend") {
        this.pendingShape.phase++;
        if (this.pendingShape.phase >= 2) this.finishPending();
      } else if (
        drag.type === "shape" &&
        ["curve", "polygon"].includes(this.app.shape)
      ) {
        this.pendingShape = {
          ...drag,
          name: this.app.shape,
          layerId: d.activeLayer.id,
          phase: 0,
          options: {
            width: this.app.width,
            color: drag.color,
            background: drag.background,
            outline: this.app.outline,
            fill: this.app.shapeFill,
          },
        };
        if (this.app.shape === "curve") {
          this.pendingShape.controls = [
            {
              x: drag.start.x + (drag.end.x - drag.start.x) / 3,
              y: drag.start.y + (drag.end.y - drag.start.y) / 3,
            },
            {
              x: drag.start.x + (2 * (drag.end.x - drag.start.x)) / 3,
              y: drag.start.y + (2 * (drag.end.y - drag.start.y)) / 3,
            },
          ];
          this.app.toast(
            "Drag two bend points to shape the curve. Enter commits early.",
          );
        } else {
          this.pendingShape.points = [drag.start, drag.end];
          this.app.toast(
            "Click polygon corners. Double-click or Enter to finish.",
          );
        }
      } else if (drag.type === "shape") {
        const edit = d.beginRaster(),
          r = this.rect(drag.start, drag.end),
          pad = this.app.width + 2;
        edit.capture(
          r.x - pad,
          r.y - pad,
          r.width + 2 * pad,
          r.height + 2 * pad,
        );
        drawShape(
          d.activeLayer.canvas.getContext("2d"),
          this.app.shape,
          drag.start,
          drag.end,
          {
            width: this.app.width,
            color: drag.color,
            background: drag.background,
            outline: this.app.outline,
            fill: this.app.shapeFill,
          },
        );
        edit.commit("Draw " + this.app.shape);
      } else if (drag.type === "selection") {
        let rect = this.rect(drag.start, drag.end);
        if (drag.free) {
          const xs = drag.path.map((p) => p.x),
            ys = drag.path.map((p) => p.y);
          rect = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          };
        }
        if (rect.width > 1 && rect.height > 1) {
          if (this.app.tool === "crop") {
            this.selectionRect = rect;
          } else {
            d.selectRegion(
              rect,
              drag.free ? drag.path : null,
              this.app.prefs.transparentSelection ? this.app.color2 : null,
              this.app.color2,
            );
            this.app.tool = "move";
            this.app.updateTools();
          }
        }
      } else if (["move", "resize", "rotate"].includes(drag.type)) {
        const after = d.metadata();
        if (
          JSON.stringify(
            drag.originals.map((o) => [o.x, o.y, o.width, o.height, o.angle]),
          ) !==
          JSON.stringify(
            d.selectedObjects.map((o) => [
              o.x,
              o.y,
              o.width,
              o.height,
              o.angle,
            ]),
          )
        ) {
          d.history.push({
            label:
              drag.type === "move"
                ? "Move objects"
                : drag.type === "resize"
                  ? "Resize objects"
                  : "Rotate objects",
            undo: () => d.restore(drag.before),
            redo: () => d.restore(after),
          });
          d.changed();
        }
      }
    } catch (err) {
      this.app.toast(err.message);
    }
    this.app.changedUI();
  }
  finishPending() {
    const s = this.pendingShape;
    if (!s) return;
    this.pendingShape = null;
    const layer = this.doc.layers.find((l) => l.id === s.layerId);
    if (!layer || layer.locked) {
      this.requestRender();
      return;
    }
    const active = this.doc.activeLayerId;
    this.doc.activeLayerId = layer.id;
    const points = s.points || [s.start, s.end, ...s.controls],
      xs = points.map((p) => p.x),
      ys = points.map((p) => p.y),
      pad = s.options.width + 2;
    const edit = this.doc.beginRaster();
    edit.capture(
      Math.min(...xs) - pad,
      Math.min(...ys) - pad,
      Math.max(...xs) - Math.min(...xs) + 2 * pad,
      Math.max(...ys) - Math.min(...ys) + 2 * pad,
    );
    drawShape(layer.canvas.getContext("2d"), s.name, s.start, s.end, {
      ...s.options,
      controls: s.controls,
      points: s.points,
    });
    edit.commit("Draw " + s.name);
    this.doc.activeLayerId = active;
    this.app.changedUI();
  }
  canvasResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget,
      kind = target.dataset.canvasHandle,
      start = {
        x: e.clientX,
        y: e.clientY,
        w: this.doc.width,
        h: this.doc.height,
      };
    target.setPointerCapture(e.pointerId);
    let w = start.w,
      h = start.h;
    const move = (ev) => {
      w =
        kind === "bottom"
          ? start.w
          : Math.max(
              1,
              Math.round(start.w + (ev.clientX - start.x) / this.app.zoom),
            );
      h =
        kind === "right"
          ? start.h
          : Math.max(
              1,
              Math.round(start.h + (ev.clientY - start.y) / this.app.zoom),
            );
      this.stage.style.width = w * this.app.zoom + "px";
      this.stage.style.height = h * this.app.zoom + "px";
      document.querySelector("#dimensions-status span").textContent =
        w + " × " + h + " px";
    };
    const up = (ev) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      if (target.hasPointerCapture(ev.pointerId))
        target.releasePointerCapture(ev.pointerId);
      try {
        if (w !== start.w || h !== start.h)
          this.doc.resizeCanvas(w, h, this.app.color2);
      } catch (err) {
        this.app.toast(err.message);
      }
      this.app.changedUI();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }
  setZoom(zoom, anchor = null) {
    const old = this.app.zoom,
      z = Math.min(8, Math.max(0.1, zoom));
    const r = this.viewport.getBoundingClientRect(),
      x = anchor ? anchor.x - r.left : r.width / 2,
      y = anchor ? anchor.y - r.top : r.height / 2,
      px = (this.viewport.scrollLeft + x - 7) / old,
      py = (this.viewport.scrollTop + y - 7) / old;
    this.app.zoom = z;
    this.render();
    this.viewport.scrollLeft = px * z - x + 7;
    this.viewport.scrollTop = py * z - y + 7;
    this.app.prefs.zoom = z;
    this.app.savePrefs();
  }
  fit() {
    const r = this.viewport.getBoundingClientRect();
    this.setZoom(
      Math.min(
        1,
        (r.width - 38) / this.doc.width,
        (r.height - 38) / this.doc.height,
      ),
    );
    this.viewport.scrollLeft = 0;
    this.viewport.scrollTop = 0;
  }
  drawRulers() {
    const z = this.app.zoom,
      v = this.viewport;
    for (const [id, vertical] of [
      ["ruler-x", false],
      ["ruler-y", true],
    ]) {
      const c = document.getElementById(id),
        len = vertical ? v.clientHeight : v.clientWidth;
      if (!len) continue;
      if (c.width !== (vertical ? 24 : len)) c.width = vertical ? 24 : len;
      if (c.height !== (vertical ? len : 24)) c.height = vertical ? len : 24;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#f9fafc";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = "11px Segoe UI, Arial";
      ctx.fillStyle = "#365b87";
      ctx.strokeStyle = "#a4b4c9";
      ctx.lineWidth = 1;
      const offset = (vertical ? v.scrollTop : v.scrollLeft) - 7,
        major = z < 0.3 ? 500 : z < 0.7 ? 200 : z < 1.5 ? 100 : z < 3 ? 50 : 20,
        step = major / 10,
        start = Math.floor(offset / z / step) * step;
      for (let n = start; n * z - offset < len; n += step) {
        const p = Math.round(n * z - offset) + 0.5;
        if (p < 0) continue;
        const big = Math.abs(n % major) < 0.001,
          medium = Math.abs(n % (major / 2)) < 0.001;
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(24 - (big ? 10 : medium ? 6 : 3), p);
          ctx.lineTo(24, p);
        } else {
          ctx.moveTo(p, 24 - (big ? 10 : medium ? 6 : 3));
          ctx.lineTo(p, 24);
        }
        ctx.stroke();
        if (big && n >= 0) {
          ctx.save();
          if (vertical) {
            ctx.translate(10, p + 3);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(n, 0, 0);
          } else ctx.fillText(n, p + 2, 12);
          ctx.restore();
        }
      }
    }
  }
}
