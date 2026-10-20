import {canvas} from './raster.js';

const checked=new WeakSet(),cache=new WeakMap();
export function validateLetteringAtlas(atlas){
  if(!atlas||typeof atlas!=='object'||atlas.version!==1||!atlas.glyphs||typeof atlas.glyphs!=='object')throw Error('Load completed lettering PNG sheets first.');
  if(checked.has(atlas))return atlas;
  const entries=Object.entries(atlas.glyphs);let bytes=0;
  if(!entries.length||entries.length>200)throw Error('Invalid lettering character set.');
  for(const[char,variants]of entries){
    if(Array.from(char).length!==1||!Array.isArray(variants)||!variants.length||variants.length>6)throw Error('Invalid lettering variants.');
    for(const g of variants){
      if(!g||![g.width,g.height,g.baseline].every(Number.isInteger)||g.width<1||g.width>80||g.height<1||g.height>80||Math.abs(g.baseline)>100||typeof g.alpha!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(g.alpha)||g.alpha.length>8600)throw Error('Invalid lettering sample.');
      const decoded=atob(g.alpha);if(decoded.length!==g.width*g.height)throw Error('Invalid lettering pixels.');bytes+=decoded.length;
    }
  }
  if(bytes>2000000)throw Error('Lettering samples exceed the pixel budget.');
  checked.add(atlas);return atlas;
}
export function extractLetteringSheet(filled,blank,sheet){
  if(filled.width!==sheet.width||filled.height!==sheet.height||blank.width!==sheet.width||blank.height!==sheet.height)throw Error(`Use the original ${sheet.width} × ${sheet.height} PNG without resizing.`);
  const out={};
  for(const cell of sheet.cells){
    const[x,y,w,h]=cell.insideBox,a=filled.getContext('2d').getImageData(x,y,w,h).data,b=blank.getContext('2d').getImageData(x,y,w,h).data;
    const alpha=new Uint8Array(w*h);let left=w,top=h,right=-1,bottom=-1;
    for(let p=0;p<alpha.length;p++){
      const i=p*4;let numerator=0,denominator=0;
      for(let k=0;k<3;k++){const background=b[i+k],value=255+(a[i+k]-255)*a[i+3]/255;numerator+=background*(background-value);denominator+=background*background;}
      // Recover the coverage of black ink over the known guide colour. Matching
      // guides contribute zero; native antialiased mouse strokes keep their alpha.
      const v=Math.max(0,Math.min(255,Math.round(255*numerator/Math.max(1,denominator))));
      alpha[p]=v;if(v){const px=p%w,py=Math.floor(p/w);left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}
    }
    if(right<left)continue;
    const width=right-left+1,height=bottom-top+1,parts=[];
    for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++)parts.push(String.fromCharCode(alpha[py*w+px]));
    (out[cell.character]??=[]).push({width,height,baseline:cell.baselineY-y-top,alpha:btoa(parts.join(''))});
  }
  if(!Object.keys(out).length)throw Error('This sheet has no black lettering inside its boxes. Choose your completed PNG.');
  return out;
}
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export const liftPixels=(choice,max)=>Math.floor(choice.rise/4294967296*(max+1));
function choice(char,atlas,rng=random,old=null,max=0){
  const count=atlas.glyphs[char]?.length||1;
  const variant=old&&count>1?(old.variant+1+rng()%(count-1))%count:rng()%count;
  let rise=rng();if(old&&max>0&&liftPixels({rise},max)===liftPixels(old,max)){
    const target=(liftPixels(old,max)+1+rng()%max)%(max+1);rise=Math.floor((target+.5)*4294967296/(max+1));
  }
  return{variant,rise};
}
export function reconcileLettering(oldText,text,oldChoices,atlas,rng=random){
  const a=Array.from(oldText),b=Array.from(text);let prefix=0,suffix=0;
  while(prefix<a.length&&prefix<b.length&&a[prefix]===b[prefix])prefix++;
  while(suffix<a.length-prefix&&suffix<b.length-prefix&&a[a.length-1-suffix]===b[b.length-1-suffix])suffix++;
  return b.map((char,i)=>i<prefix&&oldChoices[i]?oldChoices[i]:i>=b.length-suffix&&oldChoices[a.length-b.length+i]?oldChoices[a.length-b.length+i]:choice(char,atlas,rng));
}
export function shuffleLettering(object,rng=random){return Array.from(object.text).map((char,i)=>choice(char,object.letteringAtlas,rng,object.letteringChoices[i],object.riseMax));}
export function validateLettering(object){
  validateLetteringAtlas(object.letteringAtlas);
  if(typeof object.text!=='string'||object.text.length>10000||!Array.isArray(object.letteringChoices)||object.letteringChoices.length!==Array.from(object.text).length)throw Error('Invalid lettering text.');
  for(const c of object.letteringChoices)if(!c||!Number.isInteger(c.variant)||c.variant<0||c.variant>5||!Number.isInteger(c.rise)||c.rise<0||c.rise>4294967295)throw Error('Invalid lettering choices.');
  for(const[k,min,max]of [['letterSize',1,288],['letterSpacing',-100,200],['wordSpacing',0,500],['lineGap',-100,500],['riseMax',0,100],['textBoxWidth',20,16384],['minHeight',1,16384]])if(!Number.isFinite(object[k])||object[k]<min||object[k]>max)throw Error('Invalid lettering layout.');
  if(!/^(?:#[0-9a-f]{6}|transparent)$/i.test(object.ink))throw Error('Invalid lettering colour.');
}
export function letteringLayout(object){
  validateLettering(object);
  const atlas=object.letteringAtlas,chars=Array.from(object.text),scale=object.letterSize/36,width=Math.round(object.textBoxWidth),pad=3;
  const variants=Object.values(atlas.glyphs).flat(),ascent=Math.ceil(Math.max(36,...variants.map(g=>g.baseline))*scale),descent=Math.ceil(Math.max(12,...variants.map(g=>g.height-g.baseline))*scale);
  const lineHeight=Math.max(1,ascent+descent+object.riseMax+object.lineGap),start=pad+ascent+object.riseMax;
  let x=pad,baseline=start,index=0;const positions=[],carets=[{x,y:baseline-ascent,baseline}],missing=new Set();
  const glyph=(char,i)=>{const gs=atlas.glyphs[char];if(!gs){if(!/\s/.test(char))missing.add(char);return null;}return gs[object.letteringChoices[i].variant%gs.length];};
  const advance=(char,i)=>/\s/.test(char)?Math.max(1,object.wordSpacing):Math.max(1,Math.round((glyph(char,i)?.width||18)*scale)+object.letterSpacing);
  const newline=()=>{x=pad;baseline+=lineHeight;};
  for(let i=0;i<chars.length;i++){
    const char=chars[i],n=char.length;
    if(char==='\n'){newline();index+=n;carets[index]={x,y:baseline-ascent,baseline};continue;}
    if(!/\s/.test(char)&&(i===0||/\s/.test(chars[i-1]))){let run=0;for(let j=i;j<chars.length&&!/\s/.test(chars[j]);j++)run+=advance(chars[j],j);if(x>pad&&run<=width-2*pad&&x+run>width-pad)newline();}
    const g=glyph(char,i),w=Math.max(1,Math.round((g?.width||18)*scale)),h=Math.max(1,Math.round((g?.height||36)*scale));
    if(!/\s/.test(char)&&x>pad&&x+w>width-pad)newline();
    const raise=liftPixels(object.letteringChoices[i],object.riseMax),y=baseline-Math.round((g?.baseline||36)*scale)-raise;
    carets[index]={x,y:baseline-ascent-raise,baseline};
    if(!/\s/.test(char))positions.push({char,glyph:g,x,y,width:w,height:h,index,raise});
    x+=advance(char,i);index+=n;carets[index]={x,y:baseline-ascent-raise,baseline};
  }
  const height=Math.max(Math.round(object.minHeight),baseline+descent+pad,1);
  if(width<1||height>16384||width*height>64000000)throw Error('The lettering box is too large. Use a smaller size or fewer lines.');
  return{width,height,positions,carets,ascent,lineHeight,missing:[...missing]};
}
function glyphSource(atlas,g,color){
  let entries=cache.get(atlas);if(!entries)cache.set(atlas,entries=new Map());
  const key=g.alpha+':'+g.width+':'+color;if(entries.has(key))return entries.get(key);
  if(entries.size>600)entries.clear();
  const source=canvas(g.width,g.height),ctx=source.getContext('2d'),pixels=ctx.createImageData(g.width,g.height),alpha=atob(g.alpha),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  for(let i=0;i<alpha.length;i++){pixels.data.set(rgb,i*4);pixels.data[i*4+3]=alpha.charCodeAt(i);}
  ctx.putImageData(pixels,0,0);entries.set(key,source);return source;
}
export function letteringSource(object){
  const layout=letteringLayout(object),source=canvas(layout.width,layout.height),ctx=source.getContext('2d');ctx.imageSmoothingEnabled=false;
  if(object.ink==='transparent')return source;
  for(const p of layout.positions){if(p.glyph)ctx.drawImage(glyphSource(object.letteringAtlas,p.glyph,object.ink),p.x,p.y,p.width,p.height);else{ctx.strokeStyle=object.ink;ctx.lineWidth=1;ctx.strokeRect(p.x+.5,p.y+.5,Math.max(1,p.width-1),Math.max(1,p.height-1));}}
  return source;
}
