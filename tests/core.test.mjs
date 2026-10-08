import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import {
  canvas,
  setCanvasFactory,
  paintSegment,
  replaceColorSegment,
  floodFill,
  colorKey,
  bmpBytes,
} from "../src/core/raster.js";
import {
  PaintDocument,
  hitObject,
  worldPoint,
  localPoint,
} from "../src/core/document.js";
import { History } from "../src/core/history.js";
import { resamplePixels } from "../src/core/resample.worker.js";
import { drawShape } from "../src/core/shapes.js";
setCanvasFactory(() => createCanvas(1, 1));
const pixel = (c, x, y) => [
  ...c.getContext("2d").getImageData(x, y, 1, 1).data,
];
const stroke = (
  doc,
  a = { x: 10, y: 10 },
  b = { x: 35, y: 10 },
  width = 4,
  type = "brush",
) => {
  const edit = doc.beginRaster();
  edit.capture(0, 0, 50, 30);
  paintSegment(doc.activeLayer.canvas.getContext("2d"), a, b, {
    type,
    width,
    color: "#1847f1",
  });
  edit.commit(type);
};
test("one-pixel pencil is continuous and does not blur adjacent pixels", () => {
  const c = canvas(50, 30);
  paintSegment(
    c.getContext("2d"),
    { x: 5, y: 12 },
    { x: 40, y: 12 },
    { type: "pencil", width: 1, color: "#1847f1" },
  );
  for (let x = 5; x <= 40; x++)
    assert.deepEqual(pixel(c, x, 12), [24, 71, 241, 255]);
  assert.equal(pixel(c, 20, 11)[3], 0);
});
for (const width of [2, 4, 8, 16])
  test(`round brush has continuous ${width}px stroke with appropriate width`, () => {
    const c = canvas(60, 60);
    paintSegment(
      c.getContext("2d"),
      { x: 10, y: 30 },
      { x: 50, y: 30 },
      { type: "brush", width, color: "#1847f1" },
    );
    let rows = 0;
    for (let y = 0; y < 60; y++) if (pixel(c, 25, y)[3]) rows++;
    assert.equal(rows, width);
    for (let x = 11; x < 50; x++) assert.equal(pixel(c, x, 30)[3], 255);
    assert.ok(pixel(c, 10, 30)[3] > 0);
  });
test("100 consecutive strokes remain on one raster layer", () => {
  const d = new PaintDocument(80, 60);
  for (let i = 0; i < 100; i++)
    stroke(d, { x: 5, y: 5 + (i % 40) }, { x: 40, y: 5 + (i % 40) });
  assert.equal(d.layers.length, 1);
  assert.equal(d.objects.length, 0);
  assert.equal(d.history.undoStack.length, 80);
});
test("painting edits the selected layer and leaves background alone", () => {
  const d = new PaintDocument(80, 60);
  const bg = d.layers[0].canvas;
  d.addLayer("Ink");
  stroke(d);
  assert.deepEqual(pixel(bg, 20, 10), [255, 255, 255, 255]);
  assert.deepEqual(pixel(d.activeLayer.canvas, 20, 10), [24, 71, 241, 255]);
});
test("locked layer prevents painting", () => {
  const d = new PaintDocument(30, 30);
  d.activeLayer.locked = true;
  assert.throws(() => d.beginRaster(), /locked/);
});
test("eraser removes alpha on a transparent raster layer", () => {
  const c = canvas(40, 40),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#1847f1";
  ctx.fillRect(0, 0, 40, 40);
  paintSegment(
    ctx,
    { x: 10, y: 20 },
    { x: 30, y: 20 },
    { type: "eraser", width: 8 },
  );
  assert.equal(pixel(c, 20, 20)[3], 0);
  assert.equal(pixel(c, 20, 4)[3], 255);
});
test("fill is bounded by opaque walls and respects exact colors", () => {
  const c = canvas(40, 40),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 40, 40);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 24, 24);
  floodFill(c, 20, 20, "#1847f1");
  assert.deepEqual(pixel(c, 20, 20), [24, 71, 241, 255]);
  assert.deepEqual(pixel(c, 2, 2), [255, 255, 255, 255]);
});
test("tolerant fill terminates when replacement is within tolerance", () => {
  const c = canvas(20, 20),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 20, 20);
  floodFill(c, 5, 5, "#fefefe", 10);
  assert.deepEqual(pixel(c, 19, 19), [254, 254, 254, 255]);
});
test("asset insertion keeps original dimensions, (0,0), alpha and source", () => {
  const d = new PaintDocument(1000, 800),
    src = canvas(64, 80);
  src.getContext("2d").fillRect(5, 5, 10, 10);
  const obj = d.insert(src, "64 × 80 sprite");
  assert.equal(obj.x, 0);
  assert.equal(obj.y, 0);
  assert.equal(obj.width, 64);
  assert.equal(obj.height, 80);
  assert.equal(obj.source, src);
  assert.equal(pixel(obj.source, 0, 0)[3], 0);
  assert.equal(d.selected[0], obj.id);
});
test("assets can be inserted on active layer without a new layer", () => {
  const d = new PaintDocument(100, 100);
  d.insert(canvas(64, 80), "Sprite", false);
  assert.equal(d.layers.length, 1);
});
test("repeated transforms preserve immutable source dimensions and pixels", () => {
  const d = new PaintDocument(100, 100),
    source = canvas(64, 80),
    obj = d.insert(source);
  const original = source.toBuffer("image/png");
  for (let i = 0; i < 100; i++) {
    obj.width = i % 2 ? 20 : 90;
    obj.height = i % 2 ? 25 : 112;
    obj.angle = i * 7;
  }
  assert.equal(obj.source.width, 64);
  assert.equal(obj.source.height, 80);
  assert.deepEqual(obj.source.toBuffer("image/png"), original);
});
test("Color 2 transparency removes exact keyed color without altering source alpha", () => {
  const source = canvas(3, 1),
    ctx = source.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = "#fefefe";
  ctx.fillRect(1, 0, 1, 1);
  const result = colorKey(source, "#ffffff");
  assert.equal(pixel(result, 0, 0)[3], 0);
  assert.equal(pixel(result, 1, 0)[3], 255);
  assert.equal(pixel(result, 2, 0)[3], 0);
  assert.equal(pixel(source, 0, 0)[3], 255);
});
test("canvas resize extends boundary without stretching content and undoes", () => {
  const d = new PaintDocument(80, 60);
  stroke(d);
  d.resizeCanvas(120, 90);
  assert.equal(d.width, 120);
  assert.deepEqual(pixel(d.activeLayer.canvas, 20, 10), [24, 71, 241, 255]);
  assert.deepEqual(pixel(d.activeLayer.canvas, 110, 80), [255, 255, 255, 255]);
  d.history.undo();
  assert.equal(d.width, 80);
  assert.equal(d.height, 60);
  d.history.undo();
  assert.deepEqual(pixel(d.activeLayer.canvas, 20, 10), [255, 255, 255, 255]);
  d.history.redo();
  assert.deepEqual(pixel(d.activeLayer.canvas, 20, 10), [24, 71, 241, 255]);
});
test("raster undo works after layer metadata undo restores layer references", () => {
  const d = new PaintDocument(80, 60);
  stroke(d);
  d.action("Rename", () => (d.activeLayer.name = "Ink"));
  d.history.undo();
  d.history.undo();
  assert.deepEqual(pixel(d.activeLayer.canvas, 20, 10), [255, 255, 255, 255]);
  d.history.redo();
  assert.deepEqual(pixel(d.activeLayer.canvas, 20, 10), [24, 71, 241, 255]);
});
test("selection lifting and undo restore pixels and floating object", () => {
  const d = new PaintDocument(80, 60);
  d.addLayer("Ink");
  stroke(d);
  d.selectRegion({ x: 5, y: 5, width: 40, height: 20 });
  assert.equal(d.objects.length, 1);
  assert.equal(pixel(d.activeLayer.canvas, 20, 10)[3], 0);
  d.action("Move", () => (d.objects[0].x = 20));
  d.history.undo();
  d.history.undo();
  assert.equal(d.objects.length, 0);
  assert.deepEqual(pixel(d.activeLayer.canvas, 20, 10), [24, 71, 241, 255]);
  d.history.redo();
  assert.equal(d.objects.length, 1);
  assert.equal(pixel(d.activeLayer.canvas, 20, 10)[3], 0);
});
test("free-form selection preserves transparency outside polygon", () => {
  const d = new PaintDocument(40, 40);
  const obj = d.selectRegion({ x: 5, y: 5, width: 25, height: 25 }, [
    { x: 5, y: 5 },
    { x: 30, y: 5 },
    { x: 5, y: 30 },
  ]);
  assert.equal(pixel(obj.source, 24, 24)[3], 0);
  assert.equal(pixel(obj.source, 3, 3)[3], 255);
});
test("object movement undo preserves source and restores transform", () => {
  const d = new PaintDocument(100, 100),
    obj = d.insert(canvas(64, 80));
  d.action("Move", () => {
    obj.x = 30;
    obj.angle = -15;
  });
  d.history.undo();
  assert.equal(d.objects[0].x, 0);
  assert.equal(d.objects[0].angle, 0);
  d.history.redo();
  assert.equal(d.objects[0].x, 30);
});
test("grouping survives undo and duplicates retain shared immutable images", () => {
  const d = new PaintDocument(200, 200),
    a = d.insert(canvas(20, 30)),
    b = d.insert(canvas(30, 40));
  d.selected = [a.id, b.id];
  d.groupSelected();
  assert.equal(d.objects[0].group, d.objects[1].group);
  d.duplicateSelected();
  assert.equal(d.objects.length, 4);
  assert.equal(d.layers.length, 3);
  d.history.undo();
  assert.equal(d.objects.length, 2);
});
test("rotation geometry maps local points accurately", () => {
  const o = { x: 10, y: 20, width: 64, height: 80, angle: 37 };
  const w = worldPoint(o, 10, 15),
    local = localPoint(o, w.x, w.y);
  assert.ok(Math.abs(local.x - 10) < 1e-8);
  assert.ok(Math.abs(local.y - 15) < 1e-8);
  assert.ok(hitObject(o, w.x, w.y));
});
test("crop shifts objects and raster, and undo restores size", () => {
  const d = new PaintDocument(100, 80),
    obj = d.insert(canvas(20, 20));
  obj.x = 30;
  obj.y = 20;
  d.crop({ x: 10, y: 10, width: 50, height: 40 });
  assert.equal(d.width, 50);
  assert.equal(d.objects[0].x, 20);
  d.history.undo();
  assert.equal(d.width, 100);
  assert.equal(d.objects[0].x, 30);
});
test("merge down combines visible layers and undoes", () => {
  const d = new PaintDocument(80, 60);
  d.addLayer("Ink");
  stroke(d);
  d.mergeDown();
  assert.equal(d.layers.length, 1);
  assert.deepEqual(pixel(d.layers[0].canvas, 20, 10), [24, 71, 241, 255]);
  d.history.undo();
  assert.equal(d.layers.length, 2);
});
test("nearest-neighbour resize keeps exact source values", () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
  const out = resamplePixels(pixels, 2, 1, 4, 1, "nearest");
  assert.deepEqual(
    [...out],
    [255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255],
  );
});
test("Lanczos handles transparent edges without dark halos", () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]);
  const out = resamplePixels(pixels, 2, 1, 8, 1);
  for (let i = 0; i < out.length; i += 4)
    if (out[i + 3] > 0) {
      assert.equal(out[i], 255);
      assert.equal(out[i + 1], 255);
      assert.equal(out[i + 2], 255);
    }
});
test("BMP export has correct header, padded rows, white transparency matte", () => {
  const c = canvas(3, 2);
  c.getContext("2d").fillStyle = "#1847f1";
  c.getContext("2d").fillRect(0, 1, 1, 1);
  const bytes = bmpBytes(c),
    v = new DataView(bytes.buffer);
  assert.equal(bytes[0], 66);
  assert.equal(bytes[1], 77);
  assert.equal(v.getInt32(18, true), 3);
  assert.equal(v.getInt32(22, true), 2);
  assert.equal(v.getUint16(28, true), 24);
  assert.deepEqual([...bytes.slice(54, 57)], [241, 71, 24]);
  assert.deepEqual([...bytes.slice(57, 60)], [255, 255, 255]);
  assert.equal(bytes.length, 78);
});
test("shape fill and outline use Color 2 and Color 1", () => {
  const c = canvas(50, 50);
  drawShape(
    c.getContext("2d"),
    "rectangle",
    { x: 5, y: 5 },
    { x: 40, y: 40 },
    {
      width: 2,
      color: "#1847f1",
      background: "#ff7f27",
      outline: "solid",
      fill: "solid",
    },
  );
  assert.deepEqual(pixel(c, 20, 20), [255, 127, 39, 255]);
  assert.deepEqual(pixel(c, 5, 20), [24, 71, 241, 255]);
});
test("history bounds memory and count while keeping operation labels", () => {
  const h = new History(() => {}, 10);
  for (let i = 0; i < 10; i++)
    h.push({ label: "Stroke " + i, bytes: 4, undo() {}, redo() {} });
  assert.equal(h.undoStack.length, 2);
  assert.ok(h.bytes <= 10);
  assert.equal(h.undoStack[1].label, "Stroke 9");
});
test("right-click color eraser preserves alpha, skips invisible pixels, and covers the whole segment", () => {
  const c=canvas(40,10),ctx=c.getContext("2d");
  ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(5,2,20,4);
  const alpha=pixel(c,10,3)[3];
  replaceColorSegment(ctx,{x:1,y:3},{x:30,y:3},"#000000","#ff0000",2);
  assert.deepEqual(pixel(c,1,3),[0,0,0,0]);
  assert.deepEqual(pixel(c,10,3),[255,0,0,alpha]);
  assert.deepEqual(pixel(c,23,3),[255,0,0,alpha]);
  assert.deepEqual(pixel(c,10,5),[0,0,0,alpha]);
});
test("history caps undo and redo together and refuses an oversized single command", () => {
  const h=new History(()=>{},10);
  h.push({label:"Large image",bytes:11,undo(){},redo(){}});
  assert.equal(h.bytes,0);assert.equal(h.undoStack.length,0);assert.equal(h.droppedOperation,"Large image");
  for(let i=0;i<3;i++)h.push({label:"Small",bytes:3,undo(){},redo(){}});
  h.undo();h.undo();assert.equal(h.bytes,9);
  h.push({label:"New",bytes:5,undo(){},redo(){}});
  assert.equal(h.redoStack.length,0);assert.equal(h.bytes,8);
});
test("whole-canvas history counts distinct retained canvases and large transforms fail before mutation", () => {
  const d=new PaintDocument(20,20);d.history.maxBytes=20*20*4+1;
  d.resizeCanvas(21,21);assert.equal(d.history.bytes,20*20*4);
  d.history.undo();assert(d.history.bytes<=d.history.maxBytes);
  d.maxWorkingBytes=1;
  const before=d.activeLayer.canvas, count=d.layers.length;
  assert.throws(()=>d.resizeCanvas(50,50),/memory/);assert.equal(d.activeLayer.canvas,before);assert.equal(d.width,20);
  assert.throws(()=>d.addLayer(),/memory/);assert.equal(d.layers.length,count);
});
