import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {canvas,setCanvasFactory,paintSegment,softBrushCap,polygonMask,maskBoundary} from '../src/core/raster.js';
import {PaintDocument} from '../src/core/document.js';
import {textSource,textLayout,resizeTextBox} from '../src/core/editable.js';
import {underlineThickness} from '../src/core/rich-text.js';
import {speechBubblePath} from '../src/core/shapes.js';
setCanvasFactory(()=>createCanvas(1,1));
const pixel=(source,x,y)=>[...source.getContext('2d').getImageData(x,y,1,1).data];
const textProps={type:'text',text:'',font:'Arial',fontSize:12,fontUnit:'pt',bubble:true,bubbleWidth:3,bubbleColor:'#123456',width:220,padding:12,minHeight:130};
test('new documents use the requested 731 by 411 dimensions',()=>{const doc=new PaintDocument();assert.deepEqual([doc.width,doc.height],[731,411]);});
test('thin brush caps stay within the chosen width, matching the revised endpoint requirement',()=>{
 const source=canvas(80,30),ctx=source.getContext('2d');paintSegment(ctx,{x:15,y:15},{x:60,y:15},{type:'brush',width:1,color:'#000000'});softBrushCap(ctx,{x:15,y:15},1,'#000000');softBrushCap(ctx,{x:60,y:15},1,'#000000');
 assert.ok(pixel(source,60,15)[3]>0);assert.equal(pixel(source,61,15)[3],0);assert.equal(pixel(source,35,15)[3],255);assert.equal(pixel(source,35,14)[3],0);
});
test('freeform preview boundary follows the exact binary pixel mask, including concave edges',()=>{
 const points=[{x:1,y:1},{x:9,y:2},{x:5,y:5},{x:9,y:9},{x:2,y:8}],mask=polygonMask(12,12,points),edges=maskBoundary(mask,12,12);
 assert.ok(edges.length);for(const edge of edges){assert.ok(edge.every(Number.isInteger));assert.equal(Math.abs(edge[2]-edge[0])+Math.abs(edge[3]-edge[1]),1);}
 const doc=new PaintDocument(12,12),ctx=doc.activeLayer.canvas.getContext('2d');ctx.fillStyle='#000000';ctx.fillRect(0,0,12,12);doc.selectRegion({x:0,y:0,width:12,height:12},points,null,'#ff0000');
 for(let y=0;y<12;y++)for(let x=0;x<12;x++){assert.equal(pixel(doc.objects[0].source,x,y)[3],mask[y*12+x]?255:0);assert.equal(pixel(doc.activeLayer.canvas,x,y)[0],mask[y*12+x]?255:0);}
});
test('freeform lifting on an upper layer replaces selected pixels with Color 2 without soft edges',()=>{
 const doc=new PaintDocument(30,30);doc.addLayer('Ink');const ctx=doc.activeLayer.canvas.getContext('2d');ctx.fillStyle='#000000';ctx.fillRect(0,0,30,30);doc.selectRegion({x:2,y:2,width:20,height:20},[{x:2,y:2},{x:22,y:8},{x:12,y:22}],null,'#ed1c24');doc.deleteSelected('#ed1c24');
 const pixels=doc.activeLayer.canvas.getContext('2d').getImageData(0,0,30,30).data,colors=new Set();for(let i=0;i<pixels.length;i+=4)colors.add([...pixels.slice(i,i+4)].join(','));assert.deepEqual([...colors].sort(),['0,0,0,255','237,28,36,255']);
});
test('deleting a floating image leaves the raster underneath intact and undoes',()=>{
 const doc=new PaintDocument(40,40);doc.addLayer('Assets');const image=canvas(10,10);image.getContext('2d').fillRect(2,2,6,6);doc.insert(image,'Item',false,{x:10,y:10});doc.deleteSelected('#00ff00');assert.deepEqual(pixel(doc.activeLayer.canvas,13,13),[0,0,0,0]);assert.equal(pixel(doc.activeLayer.canvas,10,10)[3],0);doc.history.undo();assert.equal(doc.objects.length,1);assert.equal(pixel(doc.activeLayer.canvas,13,13)[3],0);
});
test('cut into new layer retains position, fills both removal and the full new canvas with Color 2, and undo/redo works',()=>{
 const doc=new PaintDocument(60,50),ctx=doc.activeLayer.canvas.getContext('2d');ctx.fillStyle='#1847f1';ctx.fillRect(10,10,15,12);doc.selectRegion({x:10,y:10,width:15,height:12},null,null,'#ffff00');const id=doc.objects[0].id;doc.cutIntoLayer('#ffff00');assert.equal(doc.layers.length,2);assert.deepEqual([doc.activeLayer.canvas.width,doc.activeLayer.canvas.height],[60,50]);assert.deepEqual(pixel(doc.activeLayer.canvas,59,49),[255,255,0,255]);assert.deepEqual(pixel(doc.layers[0].canvas,12,12),[255,255,0,255]);assert.deepEqual(pixel(doc.composite(),12,12),[24,71,241,255]);assert.deepEqual([doc.selectedObjects[0].id,doc.selectedObjects[0].x,doc.selectedObjects[0].y],[id,10,10]);doc.history.undo();assert.equal(doc.layers.length,1);assert.equal(doc.objects.length,0);assert.deepEqual(pixel(doc.activeLayer.canvas,12,12),[24,71,241,255]);doc.history.redo();assert.equal(doc.layers.length,2);
});
test('cutting locked content or exceeding the image budget leaves document and history intact',()=>{
 const doc=new PaintDocument(30,30);doc.insert(canvas(5,5),'Item',false);const history=doc.history.undoStack.length;doc.activeLayer.locked=true;assert.throws(()=>doc.cutIntoLayer(),/Unlock/);doc.activeLayer.locked=false;doc.maxWorkingBytes=1;assert.throws(()=>doc.cutIntoLayer(),/memory/);assert.equal(doc.layers.length,1);assert.equal(doc.objects.length,1);assert.equal(doc.history.undoStack.length,history);
});
for(const[size,thickness]of [[8,1],[12,1],[16,2],[20,2],[24,3],[28,3],[36,4],[48,6]])test(`font ${size}pt underline is ${thickness}px thick`,()=>{
 assert.equal(underlineThickness({fontSize:size,fontUnit:'pt'}),thickness);const source=textSource({text:'MMMM',font:'Arial',fontSize:size,fontUnit:'pt',underline:true,width:500}),layout=textLayout({text:'MMMM',font:'Arial',fontSize:size,fontUnit:'pt',underline:true,width:500});const y=layout.rows[0].baseline+Math.max(1,Math.round(size*96/72*.1));for(let row=0;row<thickness;row++)assert.equal(pixel(source,5,y+row)[3],255);assert.equal(pixel(source,5,y+thickness)[3],0);
});
test('underlines preserve glyph pixels and leave a one-pixel halo around descenders',()=>{
 const props={text:'fgjkpqrwyz',font:'Arial',fontSize:48,fontUnit:'pt',width:500},plain=textSource(props),underlined=textSource({...props,underline:true}),layout=textLayout(props),lineY=layout.rows[0].baseline+Math.round(64*.1);let gaps=0,line=0;
 for(let y=0;y<plain.height;y++)for(let x=0;x<plain.width;x++)if(pixel(plain,x,y)[3])assert.deepEqual(pixel(underlined,x,y),pixel(plain,x,y));
 for(let x=0;x<300;x++){if(pixel(plain,x,lineY+1)[3]){gaps++;if(x>0&&pixel(plain,x-1,lineY+1)[3]===0)assert.equal(pixel(underlined,x-1,lineY+1)[3],0);}else if(pixel(underlined,x,lineY+1)[3])line++;}assert.ok(gaps>0&&line>0);
});
test('bubble corner raster pixels stay fixed when the text box changes width and height',()=>{
 const a=textSource({...textProps,textBoxWidth:220,minHeight:130}),b=textSource({...textProps,textBoxWidth:440,minHeight:260});assert.deepEqual([...a.getContext('2d').getImageData(0,0,20,20).data],[...b.getContext('2d').getImageData(0,0,20,20).data]);
});
test('fixed bubble tail control points retain their size as straight edges grow',()=>{
 const path=(width,height)=>{const calls=[];const ctx=Object.fromEntries(['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','closePath'].map(name=>[name,(...args)=>calls.push([name,...args])]));speechBubblePath(ctx,0,0,width,height,true);return calls.filter(call=>call[0]==='bezierCurveTo').map(call=>call.slice(1).map((value,index)=>Math.round((index%2?value-(height-46):value)*1e9)/1e9));};assert.deepEqual(path(150,120),path(500,350));
});
test('bubble shadow uses fixed grey, preserves the text origin, and adds only the configured extent',()=>{
 const normal=textLayout({...textProps,text:'Hello',opaque:true}),shadow=textLayout({...textProps,text:'Hello',opaque:true,bubbleShadow:true,shadowOffset:3});assert.equal(shadow.width,normal.width+3);assert.equal(shadow.height,normal.height+3);assert.equal(shadow.rows[0].baseline,normal.rows[0].baseline);
 const source=textSource({...textProps,text:'',opaque:true,background:'#ff0000',bubbleShadow:true,shadowOffset:3}),pixels=source.getContext('2d').getImageData(0,0,source.width,source.height).data;let grey=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]){assert.equal(pixels[i+3],255);if(pixels[i]===128&&pixels[i+1]===128&&pixels[i+2]===128)grey++;}assert.ok(grey>0);assert.deepEqual(pixel(source,100,30),[255,0,0,255]);
});
test('resizing a shadowed text box regenerates fixed geometry without growing its extents repeatedly',()=>{
 const object={...textProps,text:'Hello',bubbleShadow:true,shadowOffset:3};resizeTextBox(object,303,203);assert.equal(object.width,303);assert.equal(object.height,203);resizeTextBox(object,303,203);assert.equal(object.width,303);assert.equal(object.height,203);assert.equal(object.textBoxWidth,300);
});
