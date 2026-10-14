import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {canvas,setCanvasFactory,paintSegment,softBrushCap} from '../src/core/raster.js';
import {PaintDocument,drawObject,resizeForDrawing} from '../src/core/document.js';
import {resamplePixels} from '../src/core/resample.worker.js';
import {selectionFrame} from '../src/ui/editor.js';
setCanvasFactory(()=>createCanvas(1,1));
const pixel=(source,x,y)=>[...source.getContext('2d').getImageData(x,y,1,1).data];
for(const width of [1,3,5,7,9])test(`${width}px round brush never adds endpoint rows or columns`,()=>{
 const source=canvas(90,70),context=source.getContext('2d'),start={x:20,y:30},end={x:65,y:30},offset=Math.floor(width/2);
 paintSegment(context,start,end,{type:'brush',brush:'round',width,color:'#000000'});softBrushCap(context,start,width,'#000000');softBrushCap(context,end,width,'#000000');
 for(let y=0;y<70;y++)for(let x=0;x<90;x++)if(y<30-offset||y>=30-offset+width||x<20-offset||x>=65-offset+width)assert.equal(pixel(source,x,y)[3],0,`${x},${y}`);
 for(const x of [20,40,65])assert.equal(Array.from({length:70},(_,y)=>pixel(source,x,y)[3]).filter(Boolean).length,width);
});
test('all brush variants constrain horizontal stroke coverage to the selected pixel width',()=>{
 for(const brush of ['round','square','airbrush','crayon','oil','watercolor','calligraphy','marker']){
  const source=canvas(80,50);paintSegment(source.getContext('2d'),{x:20,y:25},{x:60,y:25},{type:'brush',brush,width:5,color:'#000000'});
  for(let y=0;y<50;y++)if(y<23||y>=28)for(let x=0;x<80;x++)assert.equal(pixel(source,x,y)[3],0,brush);
 }
});
test('upper raster and floating image Color 2 pixels reveal the layer underneath',()=>{
 const doc=new PaintDocument(20,20),bottom=doc.activeLayer.canvas.getContext('2d');bottom.fillStyle='#123456';bottom.fillRect(0,0,20,20);
 const upper=doc.addLayer('Upper'),context=upper.canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,20,20);context.fillStyle='#ed1c24';context.fillRect(2,2,3,3);
 const image=canvas(4,4),ink=image.getContext('2d');ink.fillStyle='#ffffff';ink.fillRect(0,0,4,4);ink.fillStyle='#000000';ink.fillRect(1,1,1,1);doc.insert(image,'Image',false,{x:10,y:10});
 const result=doc.composite();assert.deepEqual(pixel(result,0,0),[18,52,86,255]);assert.deepEqual(pixel(result,3,3),[237,28,36,255]);assert.deepEqual(pixel(result,10,10),[18,52,86,255]);assert.deepEqual(pixel(result,11,11),[0,0,0,255]);
 assert.deepEqual(pixel(upper.canvas,0,0),[255,255,255,255]);assert.deepEqual(pixel(image,0,0),[255,255,255,255]);
 doc.color2='#ed1c24';assert.deepEqual(pixel(doc.composite(),3,3),[18,52,86,255]);assert.deepEqual(pixel(doc.composite(),0,0),[255,255,255,255]);
});
test('Color 2 remains opaque on the bottom canvas and unrelated alpha remains intact',()=>{
 const doc=new PaintDocument(20,20);assert.deepEqual(pixel(doc.composite(),1,1),[255,255,255,255]);
 const upper=doc.addLayer('Alpha');upper.canvas.getContext('2d').fillStyle='rgba(255,0,0,.5)';upper.canvas.getContext('2d').fillRect(0,0,20,20);assert.deepEqual(pixel(doc.composite(),1,1),[255,128,128,255]);
});
test('eye visibility changes create no undo command and survive unrelated undo and redo',()=>{
 const doc=new PaintDocument(20,20),layer=doc.addLayer('Before');doc.action('Rename',()=>layer.name='After');const length=doc.history.undoStack.length;
 doc.setLayerVisibility(layer.id,false);assert.equal(doc.history.undoStack.length,length);doc.history.undo();assert.equal(doc.activeLayer.name,'Before');assert.equal(doc.activeLayer.visible,false);const redo=doc.history.redoStack.length;
 doc.setLayerVisibility(layer.id,true);assert.equal(doc.history.redoStack.length,redo);doc.history.redo();assert.equal(doc.activeLayer.name,'After');assert.equal(doc.activeLayer.visible,true);
 doc.setLayerVisibility(layer.id,false);doc.history.undo();doc.history.undo();doc.history.redo();assert.equal(doc.activeLayer.visible,false);
});
test('smooth object drawing resamples from the original and matches premultiplied Lanczos pixels',()=>{
 const source=canvas(32,32),context=source.getContext('2d');for(let y=0;y<32;y++)for(let x=0;x<32;x++){context.fillStyle=(x+y)%2?'#ffffff':'#000000';context.fillRect(x,y,1,1);}
 const object={source,x:0,y:0,width:9,height:9,angle:0,resampling:'lanczos'},output=canvas(9,9);drawObject(output.getContext('2d'),object);
 const original=context.getImageData(0,0,32,32).data,expected=resamplePixels(original,32,32,9,9,'lanczos');assert.deepEqual(output.getContext('2d').getImageData(0,0,9,9).data,expected);
 assert.ok(pixel(output,4,4)[0]>100&&pixel(output,4,4)[0]<155);resizeForDrawing(source,5,5);const restored=resizeForDrawing(source,9,9);assert.deepEqual(restored.getContext('2d').getImageData(0,0,9,9).data,expected);assert.equal(source.width,32);
 object.resampling='nearest';const nearest=canvas(9,9);drawObject(nearest.getContext('2d'),object);assert.ok([0,255].includes(pixel(nearest,4,4)[0]));
});
test('selection frames provide constant screen padding without shifting rotated object centres',()=>{
 const object={x:40,y:50,width:170,height:30,angle:25};for(const zoom of [.5,1,4,8]){const frame=selectionFrame(object,zoom);assert.equal((object.x-frame.x)*zoom,5);assert.equal((frame.width-object.width)*zoom,10);assert.equal(frame.x+frame.width/2,object.x+object.width/2);assert.equal(frame.y+frame.height/2,object.y+object.height/2);assert.equal(frame.angle,25);}
});
test('merging Color 2 upper layer holes preserves the visible composite and undo restores its layers',()=>{
 const doc=new PaintDocument(20,20),base=doc.activeLayer.canvas.getContext('2d');base.fillStyle='#123456';base.fillRect(0,0,20,20);const layer=doc.addLayer('Upper'),ctx=layer.canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,20,20);ctx.fillStyle='#000000';ctx.fillRect(4,4,3,3);const before=doc.composite().toDataURL();doc.mergeDown();assert.equal(doc.composite().toDataURL(),before);doc.history.undo();assert.equal(doc.layers.length,2);assert.equal(doc.composite().toDataURL(),before);
});
test('rasterizing upper objects retains Color 2 holes and the same visible pixels',async()=>{
 const doc=new PaintDocument(20,20),ctx=doc.activeLayer.canvas.getContext('2d');ctx.fillStyle='#123456';ctx.fillRect(0,0,20,20);const upper=doc.addLayer('Upper');upper.canvas.getContext('2d').fillStyle='#ffff00';upper.canvas.getContext('2d').fillRect(0,0,20,20);const image=canvas(6,6),ink=image.getContext('2d');ink.fillStyle='#ffffff';ink.fillRect(0,0,6,6);ink.fillStyle='#000000';ink.fillRect(2,2,2,2);doc.insert(image,'Picture',false,{x:4,y:4});const before=doc.composite().toDataURL();await doc.rasterize(async(source)=>source);assert.equal(doc.composite().toDataURL(),before);doc.history.undo();assert.equal(doc.composite().toDataURL(),before);
});
