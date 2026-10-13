import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import {canvas,setCanvasFactory,paintSegment,softBrushCap,polygonMask,stampBounds} from '../src/core/raster.js';
import {PaintDocument} from '../src/core/document.js';
import {shapeProperties,shapeSource,textSource,textLayout} from '../src/core/editable.js';
import {formatRuns,pointsToPixels} from '../src/core/rich-text.js';
setCanvasFactory(()=>createCanvas(1,1));
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
test('brush endpoints soften while the middle of a 3px stroke remains exactly three opaque pixels',()=>{
 const c=canvas(100,100),ctx=c.getContext('2d');paintSegment(ctx,{x:20,y:40},{x:80,y:40},{type:'brush',width:3,color:'#000000'});softBrushCap(ctx,{x:20,y:40},3,'#000000');softBrushCap(ctx,{x:80,y:40},3,'#000000');
 const middle=Array.from({length:100},(_,y)=>pixel(c,50,y)[3]);assert.equal(middle.filter(a=>a===255).length,3);assert.equal(middle.filter(a=>a>0&&a<255).length,0);
 const cap=ctx.getImageData(17,36,7,9).data;assert.ok([...cap].some((alpha,index)=>index%4===3&&alpha>0&&alpha<255));
});
for(const width of [1,3,4,5])test(`eraser ${width}px snaps fractional positions and deletes entire pixels without soft edges`,()=>{
 const c=canvas(60,60),ctx=c.getContext('2d');ctx.fillStyle='#123456';ctx.fillRect(0,0,60,60);paintSegment(ctx,{x:20.9,y:20.2},{x:30.8,y:29.7},{type:'eraser',width});
 const values=ctx.getImageData(0,0,60,60).data;for(let i=3;i<values.length;i+=4)assert.ok([0,255].includes(values[i]));
 const bounds=stampBounds({x:20.9,y:20.2},width);assert.equal(bounds.x,20-Math.floor(width/2));assert.equal(pixel(c,bounds.x,bounds.y)[3],0);
});
test('a variable-width pencil stamps a hard circular mask rather than a square',()=>{
 const c=canvas(30,30);paintSegment(c.getContext('2d'),{x:10,y:10},{x:10,y:10},{type:'pencil',width:5,color:'#000000'});
 assert.equal(pixel(c,8,8)[3],0);assert.equal(pixel(c,10,8)[3],255);assert.equal(pixel(c,10,10)[3],255);
 for(let y=0;y<30;y++)for(let x=0;x<30;x++)assert.ok([0,255].includes(pixel(c,x,y)[3]));
});
for(const width of [1,2,3,4,5,8])test(`rectangle has exactly ${width}px borders and square corners`,()=>{
 const props=shapeProperties('rectangle',{x:20,y:20},{x:100,y:80},{width,color:'#000000',background:'#ffffff',outline:'solid',fill:'none'}),source=shapeSource(props);
 const row=Array.from({length:source.width},(_,x)=>pixel(source,x,source.height/2)[3]);assert.equal(row.filter(a=>a===255).length,width*2);
 const bounds=[];for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixel(source,x,y)[3])bounds.push([x,y]);
 const left=Math.min(...bounds.map(p=>p[0])),top=Math.min(...bounds.map(p=>p[1]));assert.equal(pixel(source,left,top)[3],255);
});
test('free-form selection deletion leaves only original and secondary colours',()=>{
 const doc=new PaintDocument(50,50),ctx=doc.activeLayer.canvas.getContext('2d');ctx.fillStyle='#000000';ctx.fillRect(0,0,50,50);
 doc.selectRegion({x:5,y:5,width:35,height:35},[{x:5.3,y:5.8},{x:39.7,y:12.2},{x:23.4,y:38.8}],null,'#ffffff');doc.deleteSelected();
 const d=doc.activeLayer.canvas.getContext('2d').getImageData(0,0,50,50).data;const colors=new Set();for(let i=0;i<d.length;i+=4)colors.add([...d.slice(i,i+4)].join(','));assert.deepEqual([...colors].sort(),['0,0,0,255','255,255,255,255']);doc.history.undo();doc.history.undo();assert.equal(pixel(doc.activeLayer.canvas,20,20)[0],0);
});
test('polygon mask includes pixels by their centres, without fractional coverage',()=>{
 const mask=polygonMask(20,20,[{x:1.2,y:1.2},{x:18.5,y:1.2},{x:1.2,y:18.5}]);assert.equal(mask[2*20+2],1);assert.equal(mask[18*20+18],0);assert.ok([...mask].every(v=>v===0||v===1));
});
test('font point sizes use the Paint 96-DPI conversion and plain text starts at the edge',()=>{
 assert.equal(pointsToPixels(12),16);assert.equal(pointsToPixels(36),48);const layout=textLayout({text:'THE BIBLE',font:'Arial',fontSize:36,fontUnit:'pt',width:400,padding:12});assert.equal(layout.padding,0);assert.match(layout.font,/48px/);
});
test('formatting a substring preserves adjacent fonts and sizes',()=>{
 const runs=[{text:'SMALL BIG SMALL',font:'Arial',fontSize:12,fontUnit:'pt'}];const result=formatRuns(runs,6,9,{font:'Georgia',fontSize:36,underline:true});assert.deepEqual(result.map(r=>[r.text,r.fontSize]),[['SMALL ',12],['BIG',36],[' SMALL',12]]);assert.equal(result[1].font,'Georgia');assert.equal(result.map(r=>r.text).join(''),'SMALL BIG SMALL');
});
test('negative line spacing tightens text and the last underline stays inside its source',()=>{
 const normal=textLayout({text:'First\nSecond',fontSize:12,fontUnit:'pt',width:150,lineGap:0}),tight=textLayout({text:'First\nSecond',fontSize:12,fontUnit:'pt',width:150,lineGap:-6});assert.ok(tight.rows[1].baseline<normal.rows[1].baseline);
 const source=textSource({text:'THE BIBLE',font:'Arial',fontSize:36,fontUnit:'pt',underline:true,width:400});const d=source.getContext('2d').getImageData(0,source.height-3,source.width,3).data;assert.ok([...d].some((value,index)=>index%4===3&&value===255));
});
test('speech bubble linework contains only its exact colour and no partial alpha',()=>{
 const source=textSource({text:'',fontSize:12,fontUnit:'pt',bubble:true,bubbleWidth:3,bubbleColor:'#123456',width:200,padding:12});const d=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
 for(let i=0;i<d.length;i+=4){assert.ok([0,255].includes(d[i+3]));if(d[i+3])assert.deepEqual([...d.slice(i,i+3)],[18,52,86]);}
});
