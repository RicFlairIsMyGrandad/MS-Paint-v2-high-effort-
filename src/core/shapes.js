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
export function tailGeometry(object,bodyWidth) {
  const custom=Number.isFinite(object.tailTipY),width=Math.max(2,Math.min(bodyWidth-20,Number(object.tailWidth)||(custom?18:30)));
  const left=Math.max(9,Math.min(bodyWidth-9-width,Number(object.tailPosition)||(custom?28:40)));
  return {width,left,tipX:Number.isFinite(object.tailTipX)?object.tailTipX:Math.max(2,left-(custom?14:35)),tipY:custom?Math.max(4,Math.min(1024,object.tailTipY)):46};
}
export function speechBubblePath(ctx, x, y, w, h, fixed = false) {
  const custom=typeof fixed==='object'?fixed:null,tail=custom?.tipY||bubbleGeometry.tailHeight;
  const bottom = y + (fixed ? Math.max(18, h - tail) : h * .76),
    r = fixed ? Math.min(bubbleGeometry.radius, w / 2, (bottom - y) / 2) : Math.min(w * .09, h * .14, 20);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, bottom - r); ctx.quadraticCurveTo(x + w, bottom, x + w - r, bottom);
  if(custom) {
    const left=x+custom.left,right=left+custom.width,tip=x+custom.tipX,depth=custom.tipY;
    ctx.lineTo(right,bottom);
    ctx.bezierCurveTo(right-depth*.12,bottom+depth*.5,tip+custom.width*.6,bottom+depth,tip,bottom+depth);
    ctx.bezierCurveTo(tip+custom.width*.35,bottom+depth*.85,left-depth*.08,bottom+depth*.35,left,bottom);
  } else if (fixed) {
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
  if(['handLine','handCurve'].includes(name)){drawPointingLine(ctx,name,a,b,opts);return;}
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

export function drawPointingLine(context,name,a,b,options) {
  const controls=options.controls,curve=name==='handCurve'&&controls?.length===2;
  const sample=t=>{
    if(!curve)return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    const u=1-t;return {x:u*u*u*a.x+3*u*u*t*controls[0].x+3*u*t*t*controls[1].x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*controls[0].y+3*u*t*t*controls[1].y+t*t*t*b.y};
  };
  const length=Math.hypot(b.x-a.x,b.y-a.y)+(curve?Math.hypot(controls[0].x-a.x,controls[0].y-a.y)+Math.hypot(controls[1].x-b.x,controls[1].y-b.y):0);
  const count=Math.max(8,Math.min(4096,Math.ceil(length/2))),amplitude=Math.max(.65,Math.min(2.2,options.width*.32));
  context.save();context.lineWidth=options.width;context.lineCap='round';context.lineJoin='round';context.strokeStyle=options.color;context.beginPath();
  for(let index=0;index<=count;index++){
    const t=index/count,point=sample(t),ahead=sample(Math.min(1,t+.001)),behind=sample(Math.max(0,t-.001)),dx=ahead.x-behind.x,dy=ahead.y-behind.y,distance=Math.hypot(dx,dy)||1;
    const wobble=options.handWobble?amplitude*Math.sin(Math.PI*t)*(Math.sin(t*length*.075)+.4*Math.sin(t*length*.21)):0;
    const x=point.x-dy/distance*wobble,y=point.y+dx/distance*wobble;index?context.lineTo(x,y):context.moveTo(x,y);
  }
  context.stroke();
  let tangent=curve?{x:b.x-controls[1].x,y:b.y-controls[1].y}:{x:b.x-a.x,y:b.y-a.y};
  if(Math.hypot(tangent.x,tangent.y)<.001){const near=sample(.98);tangent={x:b.x-near.x,y:b.y-near.y};}
  context.translate(b.x,b.y);context.rotate(Math.atan2(tangent.y,tangent.x));
  const scale=Math.max(.65,Math.min(5,options.width/3));context.scale(scale,scale);context.fillStyle='#000000';
  context.beginPath();context.moveTo(1,-1);context.quadraticCurveTo(2,-3,-.5,-3);context.lineTo(-6,-3);context.quadraticCurveTo(-9,-4,-10,-1);context.quadraticCurveTo(-13,3,-9,4);context.quadraticCurveTo(-5,5,-4,1);context.lineTo(0,1);context.quadraticCurveTo(2,1,1,-1);context.closePath();context.fill();context.restore();
}
