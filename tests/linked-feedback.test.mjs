import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {setCanvasFactory,canvas} from '../src/core/raster.js';
import {PaintDocument} from '../src/core/document.js';
import {textLayout,textSource,shapeProperties,shapeSource} from '../src/core/editable.js';
setCanvasFactory(()=>createCanvas(1,1));
const fill=(c,color,x,y,w,h)=>{const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
const grouped=()=>{const d=new PaintDocument(100,80),face=d.addLayer('Face'),beard=d.addLayer('Beard');fill(face.canvas,'#ed1c24',15,15,20,20);fill(beard.canvas,'#000000',20,25,12,5);fill(face.canvas,'#1847f1',70,20,10,10);fill(beard.canvas,'#008000',70,30,10,10);d.groupLayers([face.id,beard.id]);d.cancelTransientSelection();return d;};
for(const free of [false,true])test(`a ${free?'freeform':'rectangular'} region lifts the same pixels on every group layer and Delete preserves destination ink`,()=>{
 const d=grouped(),before=d.composite().toDataURL(),count=d.history.undoStack.length;
 d.selectRegion({x:10,y:10,width:30,height:30},free?[{x:10,y:10},{x:40,y:10},{x:40,y:40},{x:10,y:40}]:null);
 assert.equal(d.selectedObjects.length,2);assert.equal(d.history.undoStack.length,count);assert.equal(d.composite().toDataURL(),before);
 for(const o of d.selectedObjects)o.x+=55;d.deleteSelected();assert.deepEqual(pixel(d.composite(),75,25),[24,71,241,255]);assert.deepEqual(pixel(d.composite(),75,35),[0,128,0,255]);
 d.history.undo();assert.equal(d.composite().toDataURL(),before);assert.equal(d.objects.length,0);d.history.redo();assert.deepEqual(pixel(d.composite(),75,25),[24,71,241,255]);
});
test('grouped area selections include floating content and cancel without losing its editability',()=>{
 const d=grouped(),source=canvas(5,5);fill(source,'#ffaa00',0,0,5,5);d.insert(source,'Floating feature',false,{x:20,y:20});const before=d.composite().toDataURL(),id=d.objects[0].id;
 d.selectRegion({x:10,y:10,width:30,height:30});assert.equal(d.selectedObjects.length,2);assert.equal(d.composite().toDataURL(),before);d.cancelTransientSelection();assert.equal(d.composite().toDataURL(),before);assert.ok(d.objects.some(o=>o.id===id));
});
test('linked painting retains a single tiled undo command and respects hidden members and individual selection',()=>{
 const d=grouped(),before=d.composite().toDataURL(),count=d.history.undoStack.length,edit=d.beginLinkedRaster();assert.equal(edit.edits.length,2);
 for(const e of edit.edits){e.capture(40,45,5,5);fill(e.layer.canvas,'#ff00ff',40,45,5,5);}edit.commit('Linked brush');assert.equal(d.history.undoStack.length,count+1);for(const l of d.editingLayers)assert.deepEqual(pixel(l.canvas,42,47),[255,0,255,255]);
 d.history.undo();assert.equal(d.composite().toDataURL(),before);d.history.redo();for(const l of d.editingLayers)assert.deepEqual(pixel(l.canvas,42,47),[255,0,255,255]);
 d.setLayerVisibility(d.layers[1].id,false);d.selectLayers([d.layers[1].id,d.layers[2].id]);assert.ok(d.editGroupId);d.cancelTransientSelection();assert.equal(d.beginLinkedRaster().edits.length,1);d.selectLayers([d.layers[2].id]);assert.equal(d.editGroupId,null);assert.equal(d.beginLinkedRaster().edits.length,1);
});
const bubble={type:'text',text:'This line wraps within a speech bubble',font:'Arial',fontSize:12,fontUnit:'pt',textColor:'#000000',background:'#feffff',backgroundMode:'offwhite',bubble:true,opaque:true,bubbleColor:'#000000',bubbleWidth:3,padding:12,textBoxWidth:220,tailWidth:18,tailPosition:28,tailTipX:14,tailTipY:24};
test('horizontal and vertical text padding independently control wrapping and baseline spacing; legacy padding is preserved',()=>{
 const original=textLayout(bubble),horizontal=textLayout({...bubble,paddingX:45,paddingY:12}),vertical=textLayout({...bubble,paddingX:12,paddingY:31});
 assert.ok(horizontal.rows.length>original.rows.length);assert.deepEqual(vertical.lines,original.lines);assert.equal(vertical.rows[0].baseline-original.rows[0].baseline,19);assert.equal(vertical.bodyHeight-original.bodyHeight,38);
 assert.equal(original.paddingX,17);assert.equal(original.paddingY,17);assert.equal(textSource({...bubble,paddingX:12,paddingY:12}).toDataURL(),textSource(bubble).toDataURL());assert.deepEqual(pixel(textSource(bubble),190,15),[254,255,255,255]);
});
test('pointing-hand reference has a level finger and a rounded palm below the shaft in each cardinal direction',()=>{
 for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){
  const a={x:70,y:70},b={x:70+dx*60,y:70+dy*60},o=shapeProperties('handLine',a,b,{width:3,color:'#ed1c24',background:'#ffffff',outline:'solid',fill:'none'}),c=shapeSource(o);
  const world=canvas(150,150),ctx=world.getContext('2d');ctx.drawImage(c,o.x,o.y);
  const sample=(along,below)=>pixel(world,Math.round(b.x+dx*along-dy*below),Math.round(b.y+dy*along+dx*below));
  // A black fingertip runs level with the line and a palm hangs underneath.
  assert.ok(sample(1,0)[3]>0);assert.ok(sample(-8,3)[3]>150);assert.equal(sample(-8,-5)[3],0);
 }
});
