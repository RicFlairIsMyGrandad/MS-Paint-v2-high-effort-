import {
  drawObject,
  worldPoint,
  localPoint,
  hitObject,
  drawLayer,
  snapQuarterTurn,
} from "../core/document.js";
import { paintSegment, replaceColorSegment, floodFill, colorAt, canvas, stampBounds, pixelSegment, softBrushCap, paintRoundPath, polygonMask, maskBoundary } from "../core/raster.js";
import { drawShape } from "../core/shapes.js";
import { toolIconBody } from "./icons.js";
import { zoomLevels, nearestZoom, stepZoom, fitZoom } from "../core/zoom.js";
import { shapeProperties, shapeSource, refreshEditable, resizeTextBox, textLayout } from "../core/editable.js";
const cursorSVG = (body, x=2,y=22) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>${body}</svg>`)}") ${x} ${y}, crosshair`;
const cross = cursorSVG("<path d='M14 2v24M2 14h24' stroke='white' stroke-width='3'/><path d='M14 2v24M2 14h24' stroke='#333' stroke-width='1'/><circle cx='14' cy='14' r='4' fill='white' stroke='#777'/><path d='M14 11v6M11 14h6' stroke='#777'/>",14,14);
export const cursors = {
  pencil: cursorSVG("<path d='m3 22 3-7L18 3l5 5L11 20Z' fill='#f7f7f7' stroke='#333'/><path d='m7 16 12-12M10 19 22 7' stroke='#999'/><path d='m3 22 2-5 3 3Z' fill='#333'/>",3,22),
  brush: cursorSVG("<path d='M14 3v7m0 8v7M3 14h7m8 0h7' stroke='white' stroke-width='3'/><path d='M14 3v7m0 8v7M3 14h7m8 0h7' stroke='#888'/>",14,14),
  eraser: 'none',
  fill: cursorSVG(`<g transform="translate(4 -1) scale(.9)">${toolIconBody('fill')}</g><path d="M3 21v6M0 24h6" stroke="white" stroke-width="3"/><path d="M3 21v6M0 24h6" stroke="#222"/>`,3,24),
  dropper: cursorSVG(`<g transform="scale(1.16)">${toolIconBody('dropper')}</g>`,2,25),
  text: 'text', select: cross, free: cross, shape: cross, move: 'move',
  zoom: cursorSVG("<path d='m18 18 7 7' stroke='#555' stroke-width='4'/><circle cx='12' cy='12' r='8' fill='#fafafa' stroke='#555' stroke-width='2'/><path d='M7 12a5 5 0 0 1 5-5' fill='none' stroke='#bbb' stroke-width='2'/>",12,12),
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
export function selectionFrame(object,zoom=1,width=Infinity,height=Infinity){const bounds=axisBounds([object]),pad=Math.max(0,Math.min(5/zoom,bounds.x,bounds.y,width-bounds.x-bounds.width,height-bounds.y-bounds.height));return {...object,x:object.x-pad,y:object.y-pad,width:object.width+2*pad,height:object.height+2*pad};}
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
    this.overlay.tabIndex = 0;
    this.viewport = document.querySelector("#viewport");
    this.drag = null;
    this.hover = null;
    this.pointerInside = false;
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
    this.overlay.addEventListener("contextmenu", (e) => this.contextMenu(e));
    this.overlay.addEventListener("pointerleave", () => {
      this.pointerInside = false;
      document.querySelector("#brush-cursor").style.display = "none";
    });
    this.overlay.addEventListener('pointerenter',()=>{this.pointerInside=true;});
    this.overlay.addEventListener("dblclick", (e) => {
      if (this.pendingShape?.name === "polygon") {
        this.finishPending();
        return;
      }
      const p = this.point(e),
        hit = this.app.doc.hit(p.x, p.y);
      if (hit?.object.type === "text") this.app.editText(hit.object);
    });
    this.viewport.addEventListener("scroll", () => this.requestRender());
    this.viewport.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          this.setZoom(stepZoom(this.app.zoom, e.deltaY < 0 ? 1 : -1), {
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
      this.requestRender();
    }).observe(document.querySelector("#workspace"));
  }
  get doc() {
    return this.app.doc;
  }
  localTextPoint(object, point) { return localPoint(object, point.x, point.y); }
  point(e) {
    const r = this.display.getBoundingClientRect();
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
    const c = this.display;
    if (c.width !== d.width) c.width = d.width;
    if (c.height !== d.height) c.height = d.height;
    c.style.width = d.width * z + "px";
    c.style.height = d.height * z + "px";
    // The overlay is a screen-resolution, visible-area canvas. It is never
    // magnified with the image, nor allocated at an enormous 800% image size.
    const ratio = window.devicePixelRatio || 1;
    const ox = Math.max(0, this.viewport.scrollLeft - 7), oy = Math.max(0, this.viewport.scrollTop - 7);
    const ow = Math.max(1, Math.min(d.width * z - ox, this.viewport.clientWidth - Math.max(0, 7 - this.viewport.scrollLeft)));
    const oh = Math.max(1, Math.min(d.height * z - oy, this.viewport.clientHeight - Math.max(0, 7 - this.viewport.scrollTop)));
    this.overlay.width = Math.ceil(ow * ratio); this.overlay.height = Math.ceil(oh * ratio);
    Object.assign(this.overlay.style, { width: ow + 'px', height: oh + 'px', left: ox + 'px', top: oy + 'px' });
    this.stage.style.width = d.width * z + "px";
    this.stage.style.height = d.height * z + "px";
    const ctx = this.display.getContext("2d");
    ctx.clearRect(0, 0, d.width, d.height);
    d.color2=this.app.color2;
    d.layers.forEach((layer,index)=>{if(layer.visible)drawLayer(ctx,layer,index?d.color2:null,d.renderRevision);});
    const over = this.overlay.getContext("2d");
    over.setTransform(1, 0, 0, 1, 0, 0);
    over.clearRect(0, 0, this.overlay.width, this.overlay.height);
    over.setTransform(ratio * z, 0, 0, ratio * z, -ox * ratio, -oy * ratio);
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
    if (this.drag?.type === 'shape') this.drawShapePreview(over,this.app.shape,this.drag.start,this.drag.end,{width:this.app.width,color:this.drag.color,background:this.drag.background,outline:this.app.outline,fill:this.app.shapeFill,handWobble:this.app.prefs.handWobble});
    if (this.pendingShape) { const shape=this.pendingShape;this.drawShapePreview(over,shape.name,shape.start,shape.end,{...shape.options,controls:shape.controls,points:shape.points}); }
    if (this.app.tool==='zoom' && this.hover) {
      const area=this.zoomArea(this.hover);over.save();over.lineWidth=1/z;over.strokeStyle='#fff';over.strokeRect(area.x,area.y,area.width,area.height);over.strokeStyle='#29394c';over.setLineDash([5/z,3/z]);over.strokeRect(area.x,area.y,area.width,area.height);over.restore();
    }
    if (this.drag?.type === "selection" || this.drag?.type === 'text-box') {
      over.save();
      over.strokeStyle = "#006ce3";
      over.fillStyle = "#0078ff12";
      over.lineWidth = 1 / z;
      over.setLineDash([5 / z, 3 / z]);
      over.beginPath();
      if (this.drag.free) {
        this.drawFreePreview(over,this.drag);
      } else {
        const r = this.rect(this.drag.start, this.drag.end);
        over.rect(r.x, r.y, r.width, r.height);
      }
      if(!this.drag.free){over.stroke();over.fill();}
      over.restore();
    }
    const selected = d.selectedObjects;
    const bounds = selectionBounds(selected);
    if (bounds && this.drag?.type!=='move') {
      this.drawSelection(over, bounds);
      if(selected.length===1&&selected[0].type==='text'&&selected[0].bubble){
        const tip=this.tailPoint(selected[0]),s=4/z;over.save();over.translate(tip.x,tip.y);over.rotate(Math.PI/4);over.fillStyle='#fff';over.strokeStyle='#0078ff';over.lineWidth=1/z;over.fillRect(-s,-s,2*s,2*s);over.strokeRect(-s,-s,2*s,2*s);over.restore();
      }
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
      z * 100 + "%";
    document.querySelector("#zoom-slider").value = zoomLevels.indexOf(nearestZoom(z));
    this.app.textEditor?.position();
  }
  drawShapePreview(context,name,start,end,options) {
    const key=JSON.stringify([name,start,end,options]);
    try {
      if(this.preview?.key!==key) {const properties=shapeProperties(name,start,end,options);this.doc.assertAllocation(properties.width*properties.height*12);this.preview={key,object:{...properties,source:shapeSource(properties),angle:0,flipH:false,flipV:false}};}
      drawObject(context,this.preview.object);
    } catch(error) { if(this.previewError!==error.message){this.previewError=error.message;this.app.toast(error.message);} }
  }
  contextMenu(event) {
    event.preventDefault();
    if(this.doc.selectedObjects.length && this.handleAt(this.point(event)))this.app.selectionMenu(event.clientX,event.clientY);
  }
  drawFreePreview(context,drag) {
    if(drag.path.length<3)return;
    const points=drag.path,x=Math.max(0,Math.floor(Math.min(...points.map(point=>point.x)))),y=Math.max(0,Math.floor(Math.min(...points.map(point=>point.y)))),
      width=Math.max(1,Math.min(this.doc.width-x,Math.ceil(Math.max(...points.map(point=>point.x)))-x)),height=Math.max(1,Math.min(this.doc.height-y,Math.ceil(Math.max(...points.map(point=>point.y)))-y));
    try {
      if(drag.pixelPreview?.count!==points.length) {
        this.doc.assertAllocation(width*height*6);
        const mask=polygonMask(width,height,points,x,y),source=canvas(width,height),ctx=source.getContext('2d'),pixels=ctx.createImageData(width,height);
        for(let index=0;index<mask.length;index++)if(mask[index])pixels.data.set([0,108,227,24],index*4);
        ctx.putImageData(pixels,0,0);drag.pixelPreview={count:points.length,source,mask,x,y,width,height,edges:maskBoundary(mask,width,height,x,y)};
      }
      const preview=drag.pixelPreview;context.save();context.imageSmoothingEnabled=false;context.drawImage(preview.source,preview.x,preview.y);context.setLineDash([]);context.fillStyle='#006ce3';
      const thickness=1/this.app.zoom;
      for(const[x1,y1,x2,y2]of preview.edges)context.fillRect(x1,y1,Math.max(thickness,x2-x1),Math.max(thickness,y2-y1));
      context.restore();
    } catch(error) {if(drag.previewError!==error.message){drag.previewError=error.message;this.app.toast(error.message);}}
  }
  zoomArea(point) {
    const target=nearestZoom(this.app.zoom*2),ratio=target/this.app.zoom,width=Math.min(this.doc.width,this.viewport.clientWidth/this.app.zoom)/ratio,height=Math.min(this.doc.height,this.viewport.clientHeight/this.app.zoom)/ratio;
    return {x:Math.max(0,Math.min(this.doc.width-width,point.x-width/2)),y:Math.max(0,Math.min(this.doc.height-height,point.y-height/2)),width,height,target};
  }
  drawOutline(ctx, o, color = "#4081b8") {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / (this.app.zoom*(window.devicePixelRatio||1));
    ctx.setLineDash([3 / this.app.zoom, 5 / this.app.zoom]);
    ctx.beginPath();
    [
      [0, 0],
      [o.width, 0],
      [o.width, o.height],
      [0, o.height],
    ].forEach(([x, y], i) => {
      const raw = worldPoint(o, x, y), factor = this.app.zoom * (window.devicePixelRatio || 1);
      const p = { x: (Math.round(raw.x * factor) + 0.5) / factor, y: (Math.round(raw.y * factor) + 0.5) / factor };
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  drawSelection(ctx, o) {
    o=selectionFrame(o,this.app.zoom,this.doc.width,this.doc.height);
    this.drawOutline(ctx, o);
    const z = this.app.zoom,
      s = 4 / z, factor=z*(window.devicePixelRatio||1),pixel=1/factor;
    ctx.save();
    ctx.lineWidth = pixel;
    ctx.strokeStyle = "#56788f";
    ctx.fillStyle = "white";
    for (const p of handlePoints(o)) {
      const x = Math.round((p.x-s/2)*factor)/factor, y = Math.round((p.y-s/2)*factor)/factor;
      ctx.fillRect(x,y,s,s);ctx.strokeRect(x+pixel/2,y+pixel/2,s-pixel,s-pixel);
    }
    const {anchor:top,point:rotate}=this.rotationHandle(o);
    ctx.strokeStyle = "#0078ff";
    ctx.beginPath();
    const distance=Math.hypot(rotate.x-top.x,rotate.y-top.y)||1;
    ctx.moveTo(top.x+(rotate.x-top.x)*s/2/distance,top.y+(rotate.y-top.y)*s/2/distance);
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
  tailPoint(object) {const layout=textLayout(object);return worldPoint(object,layout.bodyX+layout.tail.tipX,layout.bodyHeight+layout.tail.tipY-((Number(object.bubbleWidth)||3)/2+1));}
  handleAt(p) {
    const selected=this.doc.selectedObjects;
    if(selected.length===1&&selected[0].type==='text'&&selected[0].bubble){const tip=this.tailPoint(selected[0]);if(Math.hypot(p.x-tip.x,p.y-tip.y)<8/this.app.zoom)return {type:'tail',bounds:selected[0]};}
    const bounds = selectionBounds(this.doc.selectedObjects);
    if (!bounds) return null;
    const frame=selectionFrame(bounds,this.app.zoom,this.doc.width,this.doc.height),rotation = this.rotationHandle(frame).point;
    if (Math.hypot(p.x - rotation.x, p.y - rotation.y) < 10 / this.app.zoom)
      return { type: "rotate", bounds };
    const hs = handlePoints(frame);
    for (let i = 0; i < hs.length; i++)
      if (Math.hypot(p.x - hs[i].x, p.y - hs[i].y) < 8 / this.app.zoom)
        return { type: "resize", index: i, bounds };
    const local=localPoint(bounds,p.x,p.y),pad=4/this.app.zoom;
    if(local.x>=-pad&&local.y>=-pad&&local.x<=bounds.width+pad&&local.y<=bounds.height+pad)return {type:"move",bounds};
    return null;
  }
  rotationHandle(bounds) {
    const margin=7/this.app.zoom,gap=25/this.app.zoom;
    for(const[ax,ay,rx,ry]of [[bounds.width/2,0,bounds.width/2,-gap],[bounds.width/2,bounds.height,bounds.width/2,bounds.height+gap],[bounds.width,bounds.height/2,bounds.width+gap,bounds.height/2],[0,bounds.height/2,-gap,bounds.height/2]]) {
      const point=worldPoint(bounds,rx,ry);
      if(point.x>=margin&&point.y>=margin&&point.x<=this.doc.width-margin&&point.y<=this.doc.height-margin)return{point,anchor:worldPoint(bounds,ax,ay)};
    }
    const point=worldPoint(bounds,bounds.width/2,-gap),inset=14/this.app.zoom;
    return{anchor:worldPoint(bounds,bounds.width/2,0),point:{x:Math.max(inset,Math.min(this.doc.width-inset,point.x)),y:Math.max(inset,Math.min(this.doc.height-inset,point.y))}};
  }
  updateCursor(p) {
    let cursor = cursors[this.app.tool] || "crosshair";
    if (p && (this.doc.selectedObjects.length || ["select", "free", "move", "shape", "text"].includes(this.app.tool))) {
      const h = this.handleAt(p);
      if (h) {
        cursor =
          h.type === 'tail' ? 'crosshair' : h.type === "rotate"
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
    const ghost=document.querySelector('#brush-cursor');
    if(p && this.pointerInside && ['brush','pencil','eraser'].includes(this.app.tool) && !this.drag?.type?.includes('resize')) {
      const bounds=stampBounds(p,this.app.width),zoom=this.app.zoom;ghost.className=this.app.tool==='eraser'?'eraser-ghost':'round-ghost';
      Object.assign(ghost.style,{display:'block',left:bounds.x*zoom+'px',top:bounds.y*zoom+'px',width:bounds.width*zoom+'px',height:bounds.height*zoom+'px'});
      ghost.style.setProperty('--ink',this.app.tool==='eraser'?this.app.color2:this.app.color1);
    } else ghost.style.display='none';
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
    const pressed=this.point(e);
    if(e.button===2 && this.doc.selectedObjects.length && this.handleAt(pressed))return;
    e.preventDefault();
    this.overlay.focus({ preventScroll: true });
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
        if (['curve','handCurve'].includes(s.name)) {
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
      a.layerFocused = false;
      const existingHandle = this.handleAt(p);
      const replacingSelection=!!d.selectedObjects.length&&!existingHandle&&!e.ctrlKey&&a.prefs.selectionMode==='paint';
      if(replacingSelection)a.finishSelection();
      if(a.textEditor?.active&&!existingHandle)a.textEditor.finish();
      if (["select", "free", "move", "crop"].includes(a.tool) || existingHandle) {
        let handle = this.handleAt(p);
        const hit = d.hit(p.x, p.y);
        if (hit && !handle) {
          d.activeLayerId = hit.layer.id;
          const group = hit.object.group;
          if(hit.layer.group&&!e.ctrlKey&&!e.shiftKey){d.selectLayers(d.layers.filter(layer=>layer.group===hit.layer.group).map(layer=>layer.id));}
          else if (e.ctrlKey || e.shiftKey) {
            d.selected = d.selected.includes(hit.object.id)
              ? d.selected.filter((id) => id !== hit.object.id)
              : [...d.selected, hit.object.id];
          } else {
            d.selected = group
              ? d.objects.filter((o) => o.group === group).map((o) => o.id)
              : [hit.object.id];
          }
          handle = this.handleAt(p);
          if (hit.object.type === 'shape') {
            a.width = hit.object.shapeStyle.width;a.outline = hit.object.shapeStyle.outline;a.shapeFill = hit.object.shapeStyle.fill;
            document.querySelector('#outline').value = a.outline;document.querySelector('#shape-fill').value = a.shapeFill;
          }
          a.changedUI();
          a.updateLayers();
          if (hit.object.type === "text") a.switchTab("text");
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
            lastPosition: { x: 0, y: 0 }, trailLayers: new Set(),
          };
          this.requestRender();
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
          start: {x:Math.round(p.x),y:Math.round(p.y)},
          end: {x:Math.round(p.x),y:Math.round(p.y)},
          path: [{x:Math.floor(p.x),y:Math.floor(p.y)}],
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
          initialWidth: a.width, brush: a.brush, tool: a.tool,
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
        if (d.activeLayer.locked || !d.activeLayer.visible) throw new Error('Show and unlock the active layer before adding text.');
        this.drag = { type: 'text-box', start: p, end: p,replacingSelection };
      } else if (a.tool === "zoom") {
        const area=this.zoomArea(p);
        this.setZoom(nearestZoom(a.zoom * (e.button === 2 ? .5 : 2)), {
          x: e.clientX,
          y: e.clientY,
        });
        if(e.button===0){this.viewport.scrollLeft=area.x*this.app.zoom+7;this.viewport.scrollTop=area.y*this.app.zoom+7;this.requestRender();}
      } else if (a.tool === "shape") {
        if (d.activeLayer.locked) throw new Error("This layer is locked.");
        this.drag = { type: "shape", start: p, end: p, color, background,replacingSelection };
      }
      this.requestRender();
    } catch (err) {
      a.toast(err.message);
    }
  }
  stroke(a, b) {
    this.doc.invalidateLayers();
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
    if(app.tool==='brush'&&app.brush==='round'){
      drag.points||=[a];drag.points.push(b);drag.edit.restoreBefore();paintRoundPath(ctx,drag.points,app.width,drag.color);
    } else if (app.tool === "eraser" && drag.right) {
      replaceColorSegment(ctx, a, b, app.color1, app.color2, app.width);
    } else if (app.tool === 'eraser') {
      ctx.save();ctx.fillStyle=app.color2;pixelSegment(ctx,a,b,app.width);ctx.restore();
    }
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
    if (this.app.tool === 'zoom') this.requestRender();
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
        if (["line", "curve", "handLine", "handCurve"].includes(this.app.shape))
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
    } else if (drag.type === 'text-box') {
      drag.end = p;
    } else if (drag.type === "selection") {
      drag.end = drag.free?p:{x:Math.round(p.x),y:Math.round(p.y)};
      if(drag.free){const point={x:Math.floor(p.x),y:Math.floor(p.y)},last=drag.path.at(-1);if(point.x!==last.x||point.y!==last.y)drag.path.push(point);}
    } else if(drag.type==='tail') {
      const original=drag.originals[0],object=this.doc.objects.find(object=>object.id===original.id),layout=textLayout(original),local=localPoint(original,p.x,p.y),anchor=worldPoint(original,layout.bodyX,0);
      const candidate={...original,tailWidth:original.tailWidth??30,tailPosition:original.tailPosition??40,tailTipX:Math.max(-1024,Math.min(layout.boxWidth+1024,Math.round(local.x-layout.bodyX))),tailTipY:Math.max(4,Math.min(1024,Math.round(local.y-layout.bodyHeight+((Number(original.bubbleWidth)||3)/2+1))))};
      refreshEditable(candidate);this.doc.assertAllocation(candidate.width*candidate.height*24);
      const next=textLayout(candidate),angle=(candidate.angle||0)*Math.PI/180,dx=next.bodyX-candidate.width/2,dy=-candidate.height/2;
      candidate.x=anchor.x-candidate.width/2-dx*Math.cos(angle)+dy*Math.sin(angle);candidate.y=anchor.y-candidate.height/2-dx*Math.sin(angle)-dy*Math.cos(angle);
      Object.assign(object,candidate);if(this.app.textEditor.active)this.app.textEditor.modified=true;
    } else if (drag.type === "move") {
      const dx = Math.round(p.x - drag.start.x), dy = Math.round(p.y - drag.start.y);
      if (e.shiftKey) this.trail(drag, dx, dy);
      for (const original of drag.originals) {
        const o = this.doc.objects.find(o => o.id === original.id);
        if (o) { o.x = original.x + dx; o.y = original.y + dy; }
      }
      drag.lastPosition = { x: dx, y: dy };
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
      initial=localPoint(b,d.start.x,d.start.y),
      i = d.index,
      affectsX = i !== 1 && i !== 5,
      affectsY = i !== 3 && i !== 7,
      left = [0, 6, 7].includes(i),
      top = [0, 1, 2].includes(i);
    let nw = affectsX
        ? Math.max(1, b.width+(local.x-initial.x)*(left?-1:1))
        : b.width,
      nh = affectsY
        ? Math.max(1, b.height+(local.y-initial.y)*(top?-1:1))
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
      const candidate = { ...o, x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh),pixelSnapX:0,pixelSnapY:0 };
      if (o.type === 'text') {resizeTextBox(candidate,nw,nh);}
      if (o.type === 'shape') {
        this.doc.assertAllocation(Math.ceil(nw) * Math.ceil(nh) * 12);
        refreshEditable(candidate);
      }
      Object.assign(o, candidate);
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
    const drag=this.drag, clickText=drag.type==='move' && Math.hypot(drag.start.x-this.point(e).x,drag.start.y-this.point(e).y)<1 ? this.doc.selectedObjects.find(object=>object.type==='text') : null;
    this.finishDrag();
    if(clickText&&!this.app.textEditor.active)this.app.editText(clickText);
    if (this.overlay.hasPointerCapture(e.pointerId))
      this.overlay.releasePointerCapture(e.pointerId);
  }
  finishDrag() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    const d = this.doc;
    if(drag.replacingSelection&&['text-box','shape'].includes(drag.type)&&Math.hypot(drag.end.x-drag.start.x,drag.end.y-drag.start.y)<2/this.app.zoom){this.app.changedUI();return;}
    try {
      if (drag.type === "paint") {

        drag.edit.commit(
          this.app.tool === "eraser"
            ? "Erase"
            : this.app.tool === "pencil"
              ? "Pencil stroke"
              : "Brush stroke",
        );
      }
      else if (drag.type === "curve-bend") {
        this.pendingShape.phase++;
        if (this.pendingShape.phase >= 2) this.finishPending();
      } else if (
        drag.type === "shape" &&
        ["curve", "handCurve", "polygon"].includes(this.app.shape)
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
            handWobble:this.app.prefs.handWobble,
          },
        };
        if (["curve","handCurve"].includes(this.app.shape)) {
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
      } else if (drag.type === 'text-box') {
        const rect = this.rect(drag.start, drag.end);
        this.app.textEditor.begin(null, { x: rect.x, y: rect.y, width: Math.max(120, rect.width), height: Math.max(50, rect.height) });
      } else if (drag.type === "shape") {
        this.createShape(this.app.shape, drag.start, drag.end, { width: this.app.width, color: drag.color, background: drag.background, outline: this.app.outline, fill: this.app.shapeFill,handWobble:this.app.prefs.handWobble });
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
        if (rect.width >= 1 && rect.height >= 1) {
          if (this.app.tool === "crop") {
            this.selectionRect = rect;
          } else {
            d.selectRegion(
              rect,
              drag.free ? drag.path : null,
              this.app.prefs.transparentSelection ? this.app.color2 : null,
              this.app.color2,
            );
            this.app.selectionOrigin = drag.free ? 'free' : 'select';
            this.app.tool = this.app.prefs.selectionMode === 'persistent' ? 'move' : this.app.selectionOrigin;
            this.app.updateTools();
          }
        }
      } else if (drag.type==='tail') {
        if(this.doc.selectedObjects[0]?.source!==drag.originals[0].source)this.app.recordTransform(drag.before,'Aim speech bubble tail');
      } else if (["move", "resize", "rotate"].includes(drag.type)) {
        if(drag.type==='rotate')for(const object of d.selectedObjects)snapQuarterTurn(object);
        const after = d.metadata();
        if (drag.trailLayers?.size ||
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
          this.app.recordTransform(drag.before,drag.type === 'move' ? 'Move objects' : drag.type === 'resize' ? 'Resize objects' : 'Rotate objects');
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
    this.createShape(s.name, s.start, s.end, { ...s.options, controls: s.controls, points: s.points });
    this.doc.activeLayerId = active;
    this.app.changedUI();
  }
  createShape(name, start, end, options) {
    const properties = shapeProperties(name, start, end, options);
    this.doc.assertAllocation(properties.width * properties.height * 12);
    const source = shapeSource(properties);
    const object = this.doc.insert(source, name, false, properties),command=this.doc.history.undoStack.at(-1);
    command.sessionKey=object.id;command.sessionOpen=true;
    this.app.changedUI();
  }
  trail(drag, dx, dy) {
    this.doc.invalidateLayers();
    const targets = this.doc.layers.filter(l => l.objects.some(o => drag.originals.some(original => original.id === o.id)));
    for (const layer of targets) if (!drag.trailLayers.has(layer.id)) {
      this.doc.assertAllocation(this.doc.width * this.doc.height * 4);
      const previous = layer.canvas, next = canvas(previous.width, previous.height);
      next.getContext('2d').drawImage(previous, 0, 0); layer.canvas = next;
      drag.trailLayers.add(layer.id);
    }
    const from = drag.lastPosition, count = Math.max(Math.abs(dx - from.x), Math.abs(dy - from.y), 1);
    for (let step = 0; step <= count; step++) {
      const sx = Math.round(from.x + (dx - from.x) * step / count), sy = Math.round(from.y + (dy - from.y) * step / count);
      for (const original of drag.originals) {
        const layer = targets.find(l => l.objects.some(o => o.id === original.id));
        if (layer) drawObject(layer.canvas.getContext('2d'), { ...original, x: original.x + sx, y: original.y + sy });
      }
    }
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
      z = nearestZoom(zoom);
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
      fitZoom(Math.min(1, (r.width - 38) / this.doc.width, (r.height - 38) / this.doc.height)),
    );
    this.viewport.scrollLeft = 0;
    this.viewport.scrollTop = 0;
  }
  drawRulers() {
    const zoom=this.app.zoom,ratio=window.devicePixelRatio||1,display=this.display.getBoundingClientRect();
    for(const [id,vertical]of [['ruler-x',false],['ruler-y',true]]) {
      const canvas=document.getElementById(id),length=vertical?this.viewport.clientHeight:this.viewport.clientWidth;
      if(!length)continue;
      const width=vertical?24:length,height=vertical?length:24;
      canvas.style.width=width+'px';canvas.style.height=height+'px';
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
      const context=canvas.getContext('2d'),bounds=canvas.getBoundingClientRect(),origin=vertical?display.top-bounds.top:display.left-bounds.left;
      context.setTransform(ratio,0,0,ratio,0,0);context.fillStyle='#f9fafc';context.fillRect(0,0,width,height);
      context.font='11px Segoe UI, Arial';context.fillStyle='#365b87';context.strokeStyle='#a4b4c9';context.lineWidth=1/ratio;
      const major=zoom<.3?500:zoom<.7?200:zoom<1.5?100:zoom<3?50:20,step=major/10,start=Math.max(0,Math.floor(-origin/zoom/step)*step);
      for(let value=start;value*zoom+origin<length;value+=step) {
        const position=(Math.round((value*zoom+origin)*ratio)+.5)/ratio;
        if(position<0)continue;
        const big=value%major===0,medium=value%(major/2)===0,depth=big?10:medium?6:3;
        context.beginPath();if(vertical){context.moveTo(24-depth,position);context.lineTo(24,position);}else{context.moveTo(position,24-depth);context.lineTo(position,24);}context.stroke();
        if(big){context.save();if(vertical){context.translate(10,position+3);context.rotate(-Math.PI/2);context.fillText(value,0,0);}else context.fillText(value,position+2,12);context.restore();}
      }
    }
  }
}
