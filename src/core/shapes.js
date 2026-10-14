function polygon(ctx, points) {
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
}
export function shapePath(ctx, name, x, y, w, h) {
  const cx = x + w / 2,
    cy = y + h / 2;
  if (name === "line") {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    return;
  }
  if (name === "curve") {
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + w * 0.25,
      y + h * 1.2,
      x + w * 0.75,
      y - h * 0.2,
      x + w,
      y + h,
    );
    return;
  }
  if (name === "rectangle") ctx.rect(x, y, w, h);
  else if (name === "rounded")
    ctx.roundRect(x, y, w, h, Math.min(Math.abs(w), Math.abs(h)) * 0.15);
  else if (name === "ellipse")
    ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
  else if (name === "triangle")
    polygon(ctx, [
      [cx, y],
      [x + w, y + h],
      [x, y + h],
    ]);
  else if (name === "rightTriangle")
    polygon(ctx, [
      [x, y],
      [x + w, y + h],
      [x, y + h],
    ]);
  else if (name === "diamond")
    polygon(ctx, [
      [cx, y],
      [x + w, cy],
      [cx, y + h],
      [x, cy],
    ]);
  else if (["pentagon", "hexagon"].includes(name)) {
    const n = name === "pentagon" ? 5 : 6;
    polygon(
      ctx,
      Array.from({ length: n }, (_, i) => [
        cx + (Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / n) * w) / 2,
        cy + (Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / n) * h) / 2,
      ]),
    );
  } else if (name.startsWith("star")) {
    const n = Number(name.slice(4));
    polygon(
      ctx,
      Array.from({ length: n * 2 }, (_, i) => {
        const r = i % 2 ? 0.4 : 1;
        return [
          cx + ((Math.cos(-Math.PI / 2 + (i * Math.PI) / n) * w) / 2) * r,
          cy + ((Math.sin(-Math.PI / 2 + (i * Math.PI) / n) * h) / 2) * r,
        ];
      }),
    );
  } else if (name.startsWith("arrow")) {
    const points = [
      [0, 0.3],
      [0.6, 0.3],
      [0.6, 0],
      [1, 0.5],
      [0.6, 1],
      [0.6, 0.7],
      [0, 0.7],
    ];
    polygon(
      ctx,
      points.map(([a, b]) => {
        if (name === "arrowLeft") a = 1 - a;
        if (name === "arrowUp") [a, b] = [b, 1 - a];
        if (name === "arrowDown") [a, b] = [b, a];
        return [x + a * w, y + b * h];
      }),
    );
  } else if (name === "heart") {
    ctx.moveTo(cx, y + h);
    ctx.bezierCurveTo(
      x - w * 0.3,
      y + h * 0.5,
      x,
      y - h * 0.2,
      cx,
      y + h * 0.25,
    );
    ctx.bezierCurveTo(x + w, y - h * 0.2, x + w * 1.3, y + h * 0.5, cx, y + h);
  } else if (name === "cloud") {
    ctx.moveTo(x + w * 0.2, y + h * 0.8);
    ctx.bezierCurveTo(
      x - w * 0.1,
      y + h * 0.8,
      x,
      y + h * 0.3,
      x + w * 0.2,
      y + h * 0.4,
    );
    ctx.bezierCurveTo(
      x + w * 0.1,
      y - h * 0.1,
      x + w * 0.7,
      y - h * 0.1,
      x + w * 0.7,
      y + h * 0.3,
    );
    ctx.bezierCurveTo(
      x + w * 1.2,
      y + h * 0.1,
      x + w * 1.2,
      y + h * 0.9,
      x + w * 0.8,
      y + h * 0.8,
    );
    ctx.closePath();
  } else if (name === "callout") speechBubblePath(ctx, x, y, w, h);
}
export const bubbleGeometry = { radius: 9, tailWidth: 30, tailHeight: 46, tailInset: 40 };
export function speechBubblePath(ctx, x, y, w, h, fixed = false) {
  const bottom = y + (fixed ? Math.max(18, h - bubbleGeometry.tailHeight) : h * .76),
    r = fixed ? Math.min(bubbleGeometry.radius, w / 2, (bottom - y) / 2) : Math.min(w * .09, h * .14, 20);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, bottom - r); ctx.quadraticCurveTo(x + w, bottom, x + w - r, bottom);
  if (fixed) {
    const left = x + Math.max(r, Math.min(bubbleGeometry.tailInset, w - r - bubbleGeometry.tailWidth)),
      right = left + bubbleGeometry.tailWidth, tip = Math.max(x + 2, left - 35), tail = bubbleGeometry.tailHeight;
    ctx.lineTo(right, bottom);
    ctx.bezierCurveTo(right - 10, bottom + tail * .72, left - 5, bottom + tail * 1.12, tip, bottom + tail);
    ctx.bezierCurveTo(left - 20, bottom + tail * .9, left - 5, bottom + tail * .42, left, bottom);
  } else {
    ctx.lineTo(x + w * .28, bottom);
    ctx.bezierCurveTo(x + w * .23, y + h * .96, x + w * .13, y + h * 1.04, x + w * .02, y + h * .98);
    ctx.bezierCurveTo(x + w * .13, y + h * .95, x + w * .16, y + h * .87, x + w * .17, bottom);
  }
  ctx.lineTo(x + r, bottom); ctx.quadraticCurveTo(x, bottom, x, bottom - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
export function drawShape(ctx, name, a, b, opts) {
  if (!["line", "curve", "polygon"].includes(name)) {
    const start = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
      end = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
    a = start;
    b = end;
  }
  ctx.save();
  ctx.lineWidth = opts.width;
  ctx.strokeStyle = opts.color;
  ctx.fillStyle = opts.background;
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  ctx.beginPath();
  if (name === "polygon" && opts.points?.length) {
    polygon(
      ctx,
      opts.points.map((p) => [p.x, p.y]),
    );
  } else if (name === "curve" && opts.controls) {
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(
      opts.controls[0].x,
      opts.controls[0].y,
      opts.controls[1].x,
      opts.controls[1].y,
      b.x,
      b.y,
    );
  } else if (name === "curve") {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  } else shapePath(ctx, name, a.x, a.y, b.x - a.x, b.y - a.y);
  if (opts.fill !== "none" && !["line", "curve"].includes(name)) ctx.fill();
  if (opts.outline !== "none") ctx.stroke();
  ctx.restore();
}
