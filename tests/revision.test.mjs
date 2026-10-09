import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { canvas, setCanvasFactory, paintSegment } from '../src/core/raster.js';
import { PaintDocument } from '../src/core/document.js';
import { zoomLevels, nearestZoom, stepZoom, fitZoom } from '../src/core/zoom.js';
import { foregroundPixels } from '../src/core/alpha.js';
import { shapeProperties, shapeSource, textSource, textLayout } from '../src/core/editable.js';
setCanvasFactory(() => createCanvas(1, 1));
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
test('all zoom inputs and boundaries resolve to the eleven Paint levels',()=>{
  assert.deepEqual(zoomLevels,[.125,.25,.5,1,2,3,4,5,6,7,8]);
  for(let input=-.5;input<12;input+=.071)assert.ok(zoomLevels.includes(nearestZoom(input)));
  assert.equal(nearestZoom(NaN),1);assert.equal(stepZoom(.125,-1),.125);assert.equal(stepZoom(8,1),8);
  assert.equal(stepZoom(1,1),2);assert.equal(stepZoom(1,-1),.5);assert.equal(fitZoom(.81),.5);
});
for(const width of [3,5]) for(const orientation of ['horizontal','vertical'])test(`round brush ${width}px ${orientation} has exactly ${width} opaque pixels with no side bleed`,()=>{
  const c=canvas(100,100),vertical=orientation==='vertical';
  paintSegment(c.getContext("2d"),vertical?{x:40,y:10}:{x:10,y:40},vertical?{x:40,y:90}:{x:90,y:40},{tool:'brush',brush:'round',width,color:'#123456'});
  const values=Array.from({length:100},(_,i)=>pixel(c,vertical?i:50,vertical?50:i)[3]);
  assert.equal(values.filter(v=>v===255).length,width);
  assert.equal(values.filter(v=>v>0&&v<255).length,0);
  assert.equal(values.filter(v=>v>0).length,width);
});
test('hard AI silhouette retains original RGB and intrinsic alpha; lowering threshold restores details',()=>{
  const original=new Uint8ClampedArray([50,100,150,255,60,110,160,128,70,120,170,0]);
  const confidence=new Float32Array([.07,.6,.9]);
  assert.deepEqual([...foregroundPixels(original,confidence,.1,0)],[50,100,150,0,60,110,160,128,70,120,170,0]);
  assert.equal(foregroundPixels(original,confidence,.01,0)[3],255);
});
test('softness changes mask edges independently of the original alpha',()=>{
  const data=new Uint8ClampedArray([1,2,3,255,4,5,6,128]);const mask=new Float32Array([.3,.5]);
  const hard=foregroundPixels(data,mask,.3,0),soft=foregroundPixels(data,mask,.3,.6);
  assert.ok(soft[3]>0&&soft[3]<255);assert.notEqual(soft[3],hard[3]);assert.ok(soft[7]<128);
});
test('paste transaction groups canvas growth and object insertion in one undo and redo',()=>{
  const doc=new PaintDocument(40,30),source=canvas(80,60);source.getContext('2d').fillRect(0,0,80,60);
  doc.transaction('Paste image',()=>{doc.resizeCanvas(80,60,'#ffffff');doc.insert(source,'Pasted image',true);});
  assert.equal(doc.history.undoStack.length,1);assert.equal(doc.layers.length,2);assert.equal(doc.width,80);
  doc.history.undo();assert.equal(doc.width,40);assert.equal(doc.height,30);assert.equal(doc.objects.length,0);assert.equal(doc.layers.length,1);
  doc.history.redo();assert.equal(doc.width,80);assert.equal(doc.objects[0].source,source);
});
test('a failed compound paste leaves document, history and redo intact',()=>{
  const doc=new PaintDocument(40,30);doc.addLayer();doc.history.undo();const redo=doc.history.redoStack.length;
  assert.throws(()=>doc.transaction('Paste',()=>{doc.resizeCanvas(80,60);throw new Error('Rejected image');}),/Rejected/);
  assert.equal(doc.width,40);assert.equal(doc.layers.length,1);assert.equal(doc.history.undoStack.length,0);assert.equal(doc.history.redoStack.length,redo);
});
test('editable ellipse has crisp pixels and can regenerate a thicker outline without changing original style',()=>{
  const props=shapeProperties('ellipse',{x:10,y:10},{x:80,y:70},{width:3,color:'#000000',background:'#ffffff',outline:'solid',fill:'none'});
  const first=shapeSource(props), second=shapeSource({...props,shapeStyle:{...props.shapeStyle,width:5}});
  const count=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4){assert.ok([0,255].includes(d[i]));if(d[i])n++;}return n;};
  assert.ok(count(second)>count(first));assert.equal(props.shapeStyle.width,3);
});
test('speech textbox wraps, adds line spacing, pads text and grows with content',()=>{
  const props={text:'This is an example of a speech bubble',width:145,fontSize:20,bubble:true,bubbleWidth:3,padding:10,lineGap:0};
  const base=textLayout(props),expanded=textLayout({...props,lineGap:8});
  assert.ok(base.lines.length>1);assert.ok(expanded.height>base.height);assert.equal(base.padding,15);
  const longer=textSource({...props,text:props.text.repeat(5)});assert.ok(longer.height>base.height);
  const source=textSource({...props,text:''});assert.equal(pixel(source,0,0)[3],0);
});
