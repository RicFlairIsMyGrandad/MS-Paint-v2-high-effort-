import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {canvas,setCanvasFactory,paintRoundPath} from '../src/core/raster.js';
import {PaintDocument,drawObject,snapQuarterTurn} from '../src/core/document.js';
import {shapeProperties,shapeSource,textSource,textLayout} from '../src/core/editable.js';
setCanvasFactory(()=>createCanvas(1,1));
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
const fill=(c,color,x,y,w,h)=>{const context=c.getContext('2d');context.fillStyle=color;context.fillRect(x,y,w,h);};
for(const width of [1,3,5,7,9])test(`${width}px single-pass brush has rounded antialiased caps without extra rows`,()=>{
 const c=canvas(100,60);paintRoundPath(c.getContext('2d'),[{x:20,y:30},{x:70,y:30}],width,'#000000');
 const half=Math.floor(width/2);for(let y=0;y<60;y++)if(y<30-half||y>=30-half+width)for(let x=0;x<100;x++)assert.equal(pixel(c,x,y)[3],0);
 assert.equal(pixel(c,45,30)[3],255);assert.ok(pixel(c,20-half,30-half)[3]<pixel(c,45,30)[3]);
 if(width>1){assert.ok(pixel(c,20-half,30)[3]>0);assert.ok(pixel(c,70+half,30)[3]>0);}
 const redundant=canvas(100,60);paintRoundPath(redundant.getContext('2d'),[{x:20,y:30},{x:20,y:30},{x:40,y:30},{x:70,y:30}],width,'#000000');assert.equal(c.toDataURL(),redundant.toDataURL());
});
test('selecting or cancelling pixels leaves history, redo, saved state and visible pixels unchanged',()=>{
 const doc=new PaintDocument(60,50);fill(doc.activeLayer.canvas,'#ed1c24',5,5,10,10);doc.action('Test edit',()=>doc.activeLayer.name='Edit');doc.history.undo();doc.dirty=false;
 const before=doc.composite().toDataURL(),undo=doc.history.undoStack.length,redo=doc.history.redoStack.length;
 doc.selectRegion({x:4,y:4,width:14,height:14});assert.equal(doc.history.undoStack.length,undo);assert.equal(doc.history.redoStack.length,redo);assert.equal(doc.dirty,false);assert.equal(doc.composite().toDataURL(),before);
 assert.ok(doc.selectionUnchanged());doc.selected=[];assert.ok(doc.selectionUnchanged());doc.cancelTransientSelection();assert.equal(doc.composite().toDataURL(),before);assert.equal(doc.objects.length,0);assert.equal(doc.history.redoStack.length,redo);doc.history.redo();assert.equal(doc.activeLayer.name,'Edit');
});
test('undo while pixels are selected cancels the selection and undoes the last real painting action',()=>{
 const doc=new PaintDocument(40,30),edit=doc.beginRaster();edit.capture(5,5,10,10);fill(doc.activeLayer.canvas,'#000000',5,5,10,10);edit.commit('Paint');doc.selectRegion({x:4,y:4,width:12,height:12});doc.history.undo();assert.equal(doc.objects.length,0);assert.deepEqual(pixel(doc.activeLayer.canvas,8,8),[255,255,255,255]);doc.history.redo();assert.deepEqual(pixel(doc.activeLayer.canvas,8,8),[0,0,0,255]);
});
test('deleting a moved pixel selection preserves destination ink and undo restores the original pixels',()=>{
 const doc=new PaintDocument(80,50);fill(doc.activeLayer.canvas,'#ed1c24',5,5,10,10);fill(doc.activeLayer.canvas,'#1847f1',40,5,10,10);
 const before=doc.composite().toDataURL(),o=doc.selectRegion({x:5,y:5,width:10,height:10});o.x=40;doc.deleteSelected('#ffffff');assert.deepEqual(pixel(doc.activeLayer.canvas,45,10),[24,71,241,255]);assert.deepEqual(pixel(doc.activeLayer.canvas,10,10),[255,255,255,255]);doc.history.undo();assert.equal(doc.composite().toDataURL(),before);assert.equal(doc.objects.length,0);doc.history.redo();assert.deepEqual(pixel(doc.activeLayer.canvas,45,10),[24,71,241,255]);
});
test('grouped raster layers can move together, preserve their stacking, and undo to untouched rasters',()=>{
 const doc=new PaintDocument(100,80),bottom=doc.addLayer('Red');fill(bottom.canvas,'#ed1c24',10,10,10,10);const top=doc.addLayer('Blue');fill(top.canvas,'#1847f1',25,15,10,10);const before=doc.composite().toDataURL();
 doc.selectLayers([bottom.id,top.id]);const count=doc.history.undoStack.length;assert.equal(doc.selectedLayers.length,2);assert.equal(doc.selectedObjects.length,2);assert.equal(doc.composite().toDataURL(),before);assert.equal(doc.history.undoStack.length,count);
 const group=doc.groupSelected();assert.ok(group);assert.equal(doc.layers[1].group,doc.layers[2].group);doc.action('Move group',()=>{for(const object of doc.selectedObjects)object.x+=20;});assert.deepEqual(pixel(doc.composite(),35,15),[237,28,36,255]);assert.deepEqual(pixel(doc.composite(),50,20),[24,71,241,255]);doc.history.undo();assert.equal(doc.composite().toDataURL(),before);assert.equal(doc.objects.length,0);doc.history.redo();assert.equal(doc.objects.length,2);assert.equal(doc.layers[1].group,group);
});
test('individual grouped layers can be selected without lifting or moving the other group members',()=>{
 const doc=new PaintDocument(80,60),a=doc.addLayer('A');fill(a.canvas,'#000000',5,5,5,5);const b=doc.addLayer('B');fill(b.canvas,'#ed1c24',25,5,5,5);const group=doc.groupLayers([a.id,b.id]);doc.selectLayers([a.id]);assert.equal(doc.selectedObjects.length,1);doc.action('Move member',()=>doc.selectedObjects[0].y+=20);assert.deepEqual(pixel(doc.composite(),27,7),[237,28,36,255]);assert.equal(doc.layers[1].group,group);assert.equal(doc.layers[2].group,group);doc.selectedLayers=[a.id];doc.ungroupSelected();assert.ok(doc.layers.every(layer=>!layer.group));
});
for(const [w,h]of [[4,6],[5,6],[6,5],[5,7]])for(const angle of [90,180,270])test(`${w}x${h} image rotated ${angle} degrees keeps every pixel and alpha value`,()=>{
 const source=canvas(w,h),context=source.getContext('2d'),image=context.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)image.data.set([x*30,y*28,70,255],(y*w+x)*4);context.putImageData(image,0,0);
 const object=snapQuarterTurn({source,x:20,y:20,width:w,height:h,angle,resampling:'lanczos'}),out=canvas(60,60);drawObject(out.getContext('2d'),object);const swap=angle%180!==0,bw=swap?h:w,bh=swap?w:h,left=Math.round(object.x+w/2-bw/2),top=Math.round(object.y+h/2-bh/2);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=angle===90?h-1-y:angle===180?w-1-x:y,dy=angle===90?x:angle===180?h-1-y:w-1-x;assert.deepEqual(pixel(out,left+dx,top+dy),pixel(source,x,y));}assert.equal(out.getContext('2d').getImageData(0,0,60,60).data.filter((v,i)=>i%4===3&&v).length,w*h);
});
test('custom bubble tails are smaller by default and can extend left and right without clipping',()=>{
 const base={text:'Hello',font:'Arial',fontSize:12,fontUnit:'pt',bubble:true,bubbleWidth:3,padding:12,textBoxWidth:200,tailWidth:18,tailPosition:28,tailTipX:14,tailTipY:24};
 for(const tip of [-60,14,250]){const object={...base,tailTipX:tip},layout=textLayout(object),source=textSource(object);assert.equal(layout.tail.tipY,24);assert.equal(layout.tail.width,18);assert.ok(layout.bodyX+tip>=0);assert.ok(layout.bodyX+tip<source.width);assert.ok(pixel(source,Math.max(0,Math.round(layout.bodyX+tip)),Math.round(layout.bodyHeight+24-3))[3]>0);}
 assert.equal(textLayout({...base,tailTipY:64}).height-textLayout(base).height,40);
});
for(const name of ['handLine','handCurve'])test(`${name} retains editable endpoints, optional wobble and black hand at its final tangent`,()=>{
 const options={width:3,color:'#ed1c24',background:'#ffffff',outline:'solid',fill:'none',handWobble:false,...(name==='handCurve'?{controls:[{x:50,y:20},{x:100,y:90}]}:{})};
 const properties=shapeProperties(name,{x:10,y:50},{x:150,y:50},options),straight=shapeSource(properties),wobbly=shapeSource({...properties,shapeStyle:{...properties.shapeStyle,handWobble:true}});assert.notEqual(straight.toDataURL(),wobbly.toDataURL());const pixels=straight.getContext('2d').getImageData(0,0,straight.width,straight.height).data;let black=0,red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]){if(!pixels[i]&&!pixels[i+1]&&!pixels[i+2])black++;if(pixels[i]===237&&pixels[i+1]===28&&pixels[i+2]===36)red++;}assert.ok(black>10);assert.ok(red>100);assert.equal(properties.shapeGeometry.a.x,0);assert.equal(properties.shapeGeometry.b.x,1);
});
test('four quarter turns restore mixed-parity image positions without half-pixel drift',()=>{
 for(const[w,h]of [[5,8],[8,5],[5,7],[6,8]]){const o={x:30,y:40,width:w,height:h,angle:0};for(let i=0;i<4;i++){o.angle+=90;snapQuarterTurn(o);}assert.equal(o.x,30);assert.equal(o.y,40);}
});
test('quarter-turn rendering preserves partially transparent edge pixels exactly',()=>{
 const source=canvas(5,8),c=source.getContext('2d');c.fillStyle='rgba(20,90,180,.5)';c.fillRect(0,0,5,8);const object=snapQuarterTurn({source,x:10,y:10,width:5,height:8,angle:90,resampling:'lanczos'}),out=canvas(30,30);drawObject(out.getContext('2d'),object);const x=Math.round(object.x+2.5-4),y=Math.round(object.y+4-2.5);for(let j=0;j<5;j++)for(let i=0;i<8;i++)assert.deepEqual(pixel(out,x+i,y+j),pixel(source,j,7-i));
});
test('selecting grouped base raster content preserves alpha holes and partially transparent pixels',()=>{
 const doc=new PaintDocument(50,40),c=doc.activeLayer.canvas.getContext('2d');c.clearRect(0,0,50,40);c.fillStyle='rgba(20,90,180,.5)';c.fillRect(5,5,10,10);c.fillStyle='#ffffff';c.fillRect(20,5,10,10);const before=doc.composite().toDataURL();doc.selectLayers([doc.activeLayerId]);assert.equal(doc.composite().toDataURL(),before);doc.cancelTransientSelection();assert.equal(doc.composite().toDataURL(),before);
});
