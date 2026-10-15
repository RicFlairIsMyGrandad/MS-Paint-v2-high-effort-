import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {setCanvasFactory,canvas} from '../src/core/raster.js';
import {PaintDocument} from '../src/core/document.js';
setCanvasFactory(()=>createCanvas(1,1));
const fill=(c,color,x=0,y=0,w=c.width,h=c.height)=>{const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
const pixel=(c,x,y)=>Array.from(c.getContext('2d').getImageData(x,y,1,1).data);
const layered=()=>{const d=new PaintDocument(60,40);fill(d.activeLayer.canvas,'#123456');const upper=d.addLayer('Upper');fill(upper.canvas,'#ffffff',5,5,10,10);fill(upper.canvas,'rgba(255,0,0,.5)',20,5,10,10);return d;};
test('alpha mode preserves opaque secondary colors and partial alpha; switching modes never alters source pixels',()=>{
 const d=layered(),raw=d.activeLayer.canvas.toDataURL();assert.deepEqual(pixel(d.composite(),8,8),[18,52,86,255]);
 d.action('Use alpha',()=>d.layerTransparency='alpha');assert.deepEqual(pixel(d.composite(),8,8),[255,255,255,255]);const mixed=pixel(d.composite(),23,8);assert.ok(mixed[0]>120&&mixed[0]<150);assert.ok(mixed[1]>20&&mixed[1]<35);assert.equal(d.activeLayer.canvas.toDataURL(),raw);
 d.history.undo();assert.equal(d.layerTransparency,'color2');assert.deepEqual(pixel(d.composite(),8,8),[18,52,86,255]);d.history.redo();assert.equal(d.layerTransparency,'alpha');assert.equal(d.activeLayer.canvas.toDataURL(),raw);
 d.color2='#ff0000';assert.deepEqual(pixel(d.composite(),8,8),[255,255,255,255]);
});
test('alpha region selections leave genuine transparent holes, preserve destination ink, and undo exactly',()=>{
 const d=layered();d.layerTransparency='alpha';fill(d.activeLayer.canvas,'#008000',35,5,10,10);const before=d.composite().toDataURL(),upper=d.activeLayer;
 const o=d.selectRegion({x:5,y:5,width:10,height:10});assert.equal(pixel(upper.canvas,8,8)[3],0);assert.deepEqual(pixel(o.source,3,3),[255,255,255,255]);o.x=35;d.deleteSelected();assert.deepEqual(pixel(d.activeLayer.canvas,38,8),[0,128,0,255]);d.history.undo();assert.equal(d.composite().toDataURL(),before);
});
test('alpha merge and object commit preserve white pixels and existing transparent areas',async()=>{
 const d=layered();d.layerTransparency='alpha';const src=canvas(5,5);fill(src,'#ffffff');d.insert(src,'White patch',false,{x:35,y:10});const before=d.composite().toDataURL();await d.rasterize(async source=>source);assert.equal(d.composite().toDataURL(),before);assert.deepEqual(pixel(d.activeLayer.canvas,36,11),[255,255,255,255]);d.mergeDown();assert.equal(d.composite().toDataURL(),before);d.history.undo();assert.equal(d.layerTransparency,'alpha');assert.equal(d.layers.length,2);
});
test('focus and group activation select no canvas content, allocate no raster copies and leave undo/dirty state alone',()=>{
 const d=layered(),a=d.activeLayer,b=d.addLayer('Second'),source=a.canvas;fill(b.canvas,'#000000',10,10,10,10);d.dirty=false;const count=d.history.undoStack.length;
 d.focusLayers([a.id,b.id]);assert.equal(d.selectedObjects.length,0);assert.equal(d.objects.length,0);assert.equal(d.activeLayer.canvas,b.canvas);assert.equal(d.layers.find(l=>l.id===a.id).canvas,source);assert.equal(d.history.undoStack.length,count);assert.equal(d.dirty,false);
 d.groupLayers([a.id,b.id]);assert.ok(d.editGroupId);assert.equal(d.selectedObjects.length,0);assert.equal(d.objects.length,0);const groupCount=d.history.undoStack.length;d.focusLayers([a.id]);assert.equal(d.editGroupId,null);assert.equal(d.selectedObjects.length,0);assert.equal(d.history.undoStack.length,groupCount);
});
test('cut into a new alpha layer leaves the surrounding raster transparent',()=>{
 const d=layered();d.layerTransparency='alpha';d.selectRegion({x:5,y:5,width:10,height:10});d.cutIntoLayer('#ffffff');assert.equal(pixel(d.activeLayer.canvas,0,0)[3],0);assert.deepEqual(pixel(d.composite(),8,8),[255,255,255,255]);
});
test('painting over a previously activated editable image merges visibly as one edit and undo restores its editable source',()=>{
 const d=layered();d.layerTransparency='alpha';const source=canvas(10,10);fill(source,'#1847f1');const o=d.insert(source,'Editable image',false,{x:35,y:20});d.selected=[];const before=d.composite().toDataURL(),count=d.history.undoStack.length;
 const edit=d.beginLinkedRaster();assert.equal(d.objects.length,0);const e=edit.edits[0];e.capture(37,22,2,2);fill(e.layer.canvas,'#000000',37,22,2,2);edit.commit('Paint over image');assert.equal(d.history.undoStack.length,count+1);assert.deepEqual(pixel(d.composite(),37,22),[0,0,0,255]);d.history.undo();assert.equal(d.composite().toDataURL(),before);assert.equal(d.objects[0].id,o.id);d.history.redo();assert.deepEqual(pixel(d.composite(),37,22),[0,0,0,255]);
});
test('manual pixel selection includes floating images and cancellation retains their original editable objects',()=>{
 const d=layered();d.layerTransparency='alpha';const source=canvas(10,10);fill(source,'#1847f1');const o=d.insert(source,'Editable image',false,{x:35,y:20});d.selected=[];const before=d.composite().toDataURL();
 const selected=d.selectRegion({x:30,y:15,width:20,height:20});assert.deepEqual(pixel(selected.source,8,8),[24,71,241,255]);assert.equal(d.composite().toDataURL(),before);d.cancelTransientSelection();assert.equal(d.objects[0].id,o.id);assert.equal(d.composite().toDataURL(),before);const e=d.beginLinkedRaster();e.cancel();assert.equal(d.objects[0].id,o.id);assert.equal(d.composite().toDataURL(),before);
});
