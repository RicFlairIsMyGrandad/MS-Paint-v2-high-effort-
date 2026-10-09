let factory = () => document.createElement("canvas");
export function setCanvasFactory(fn) {
  factory = fn;
}
export function canvas(width, height) {
  const c = factory();
  c.width = width;
  c.height = height;
  return c;
}
export function cloneCanvas(c) {
  const out = canvas(c.width, c.height);
  out.getContext("2d").drawImage(c, 0, 0);
  return out;
}
export function hexRGB(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
export function replaceColorSegment(ctx, a, b, from, to, width = 1) {
  const size = Math.max(1, Math.round(width)), radius = Math.floor(size / 2);
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x)) - radius),
    y0 = Math.max(0, Math.floor(Math.min(a.y, b.y)) - radius),
    x1 = Math.min(ctx.canvas.width, Math.floor(Math.max(a.x, b.x)) - radius + size),
    y1 = Math.min(ctx.canvas.height, Math.floor(Math.max(a.y, b.y)) - radius + size);
  if (x1 <= x0 || y1 <= y0) return;
  const image = ctx.getImageData(x0, y0, x1 - x0, y1 - y0), rgb = hexRGB(from), replacement = hexRGB(to);
  let x = Math.floor(a.x), y = Math.floor(a.y);
  const bx = Math.floor(b.x), by = Math.floor(b.y), dx = Math.abs(bx - x), dy = -Math.abs(by - y), sx = x < bx ? 1 : -1, sy = y < by ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    for (let py = Math.max(y0, y - radius); py < Math.min(y1, y - radius + size); py++)
      for (let px = Math.max(x0, x - radius); px < Math.min(x1, x - radius + size); px++) {
        const i = ((py - y0) * image.width + px - x0) * 4;
        if (image.data[i + 3] > 0 && rgb.every((v, k) => image.data[i + k] === v)) image.data.set(replacement, i);
      }
    if (x === bx && y === by) break;
    const e = 2 * err;
    if (e >= dy) { err += dy; x += sx; }
    if (e <= dx) { err += dx; y += sy; }
  }
  ctx.putImageData(image, x0, y0);
}
export function colorAt(c, x, y) {
  const d = c
    .getContext("2d")
    .getImageData(
      Math.min(c.width - 1, Math.max(0, Math.floor(x))),
      Math.min(c.height - 1, Math.max(0, Math.floor(y))),
      1,
      1,
    ).data;
  return (
    "#" +
    [...d.slice(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("")
  );
}
export function floodFill(c, x, y, color, tolerance = 0) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return false;
  const ctx = c.getContext("2d"),
    image = ctx.getImageData(0, 0, c.width, c.height),
    d = image.data;
  const idx = (y * c.width + x) * 4,
    target = [...d.slice(idx, idx + 4)],
    replacement = [...hexRGB(color), 255];
  if (target.every((v, i) => v === replacement[i])) return false;
  const visited = new Uint8Array(c.width * c.height);
  const matches = (i) =>
    !visited[i / 4] &&
    Math.abs(d[i] - target[0]) <= tolerance &&
    Math.abs(d[i + 1] - target[1]) <= tolerance &&
    Math.abs(d[i + 2] - target[2]) <= tolerance &&
    Math.abs(d[i + 3] - target[3]) <= tolerance;
  // Scanline flood fill: no recursive stack overflow on large solid images.
  const stack = [x, y];
  while (stack.length) {
    const sy = stack.pop(),
      sx = stack.pop();
    let left = sx;
    while (left >= 0 && matches((sy * c.width + left) * 4)) left--;
    left++;
    let above = false,
      below = false;
    for (
      let xx = left;
      xx < c.width && matches((sy * c.width + xx) * 4);
      xx++
    ) {
      const i = (sy * c.width + xx) * 4;
      d.set(replacement, i);
      visited[i / 4] = 1;
      if (sy > 0) {
        const m = matches(i - c.width * 4);
        if (m && !above) stack.push(xx, sy - 1);
        above = m;
      }
      if (sy < c.height - 1) {
        const m = matches(i + c.width * 4);
        if (m && !below) stack.push(xx, sy + 1);
        below = m;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return true;
}
export function colorKey(source, hex) {
  const c = cloneCanvas(source),
    ctx = c.getContext("2d"),
    image = ctx.getImageData(0, 0, c.width, c.height),
    [r, g, b] = hexRGB(hex);
  for (let i = 0; i < image.data.length; i += 4)
    if (
      image.data[i] === r &&
      image.data[i + 1] === g &&
      image.data[i + 2] === b
    )
      image.data[i + 3] = 0;
  ctx.putImageData(image, 0, 0);
  return c;
}
export function bmpBytes(c) {
  const w = c.width,
    h = c.height,
    stride = Math.ceil((w * 3) / 4) * 4,
    buf = new ArrayBuffer(54 + stride * h),
    v = new DataView(buf),
    d = c.getContext("2d").getImageData(0, 0, w, h).data;
  v.setUint16(0, 0x4d42, true);
  v.setUint32(2, buf.byteLength, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, w, true);
  v.setInt32(22, h, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, stride * h, true);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4,
        t = 54 + y * stride + x * 3,
        a = d[s + 3] / 255;
      v.setUint8(t, Math.round(d[s + 2] * a + 255 * (1 - a)));
      v.setUint8(t + 1, Math.round(d[s + 1] * a + 255 * (1 - a)));
      v.setUint8(t + 2, Math.round(d[s] * a + 255 * (1 - a)));
    }
  return new Uint8Array(buf);
}
export function paintSegment(ctx, a, b, opts) {
  const {
    width = 1,
    color = "#000000",
    type = "brush",
    brush = "round",
    background = "#ffffff",
  } = opts;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = type === "pencil" ? "butt" : "round";
  ctx.lineJoin = "round";
  if (type === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "square";
  }
  if (type === "pencil") {
    // Integer Bresenham produces the continuous, un-antialiased pencil.
    let x = Math.floor(a.x),
      y = Math.floor(a.y),
      bx = Math.floor(b.x),
      by = Math.floor(b.y),
      dx = Math.abs(bx - x),
      dy = -Math.abs(by - y),
      sx = x < bx ? 1 : -1,
      sy = y < by ? 1 : -1,
      err = dx + dy;
    for (;;) {
      ctx.fillRect(
        x - Math.floor(width / 2),
        y - Math.floor(width / 2),
        width,
        width,
      );
      if (x === bx && y === by) break;
      const e = 2 * err;
      if (e >= dy) {
        err += dy;
        x += sx;
      }
      if (e <= dx) {
        err += dx;
        y += sy;
      }
    }
  } else if (
    type === "brush" &&
    [
      "airbrush",
      "crayon",
      "oil",
      "watercolor",
      "calligraphy",
      "marker",
    ].includes(brush)
  ) {
    const distance = Math.hypot(b.x - a.x, b.y - a.y),
      n = Math.max(1, Math.ceil(distance / Math.max(1, width / 6)));
    for (let step = 0; step <= n; step++) {
      const x = a.x + ((b.x - a.x) * step) / n,
        y = a.y + ((b.y - a.y) * step) / n;
      if (brush === "calligraphy") {
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          width * 0.6,
          Math.max(1, width * 0.16),
          -Math.PI / 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else if (brush === "marker") {
        ctx.globalAlpha = 0.2;
        ctx.fillRect(x - width / 2, y - width / 2, width, width);
      } else if (brush === "watercolor") {
        ctx.globalAlpha = 0.08;
        ctx.beginPath();
        ctx.arc(x, y, width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const count = brush === "airbrush" ? width * 2 : width * 3;
        ctx.globalAlpha = brush === "oil" ? 0.7 : 0.4;
        for (let j = 0; j < count; j++) {
          const angle = Math.random() * Math.PI * 2,
            r = (Math.sqrt(Math.random()) * width) / 2;
          ctx.fillRect(
            Math.floor(x + Math.cos(angle) * r),
            Math.floor(y + Math.sin(angle) * r),
            brush === "oil" ? 2 : 1,
            brush === "oil" ? 2 : 1,
          );
        }
      }
    }
  } else {
    // Odd widths are centred on a pixel centre; even widths on a pixel edge.
    // Axis-aligned strokes then occupy exactly N solid pixels, without side bleed.
    const align = value => Math.floor(value) + (width % 2 ? 0.5 : 0);
    a = { x: align(a.x), y: align(a.y) };
    b = { x: align(b.x), y: align(b.y) };
    if (brush === "square" && type === "brush") ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (a.x === b.x && a.y === b.y) {
      if (type === "eraser" || brush === "square")
        ctx.fillRect(a.x - width / 2, a.y - width / 2, width, width);
      else {
        ctx.beginPath();
        ctx.arc(a.x, a.y, width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
