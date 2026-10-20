// Extract the user's original PNG samples without tracing or smoothing.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {extractLetteringSheet,validateLetteringAtlas} from '../src/core/lettering.js';
const layout=JSON.parse(await readFile('assets/lettering/sheet-layout.json','utf8'));
const atlas={version:1,glyphs:{}};const sources=[];
async function image(bytes){const img=await loadImage(bytes),c=createCanvas(img.width,img.height);c.getContext('2d').drawImage(img,0,0);return c;}
for(const sheet of layout.sheets.filter(s=>s.cells)){
  const bytes=await readFile('assets/lettering/user-sheets/'+sheet.blank),blank=await readFile('assets/lettering/'+sheet.blank);
  Object.assign(atlas.glyphs,extractLetteringSheet(await image(bytes),await image(blank),sheet));
  sources.push({file:sheet.blank,sha256:createHash('sha256').update(bytes).digest('hex'),width:sheet.width,height:sheet.height});
}
validateLetteringAtlas(atlas);
await writeFile('assets/lettering/grade-mouse-samples.json',JSON.stringify(atlas)+'\n');
await writeFile('assets/lettering/sample-provenance.json',JSON.stringify({description:'Actual user mouse handwriting; native per-pixel alpha recovered against original template guides. No curve fitting, tracing or smoothing.',sources,characters:Object.keys(atlas.glyphs).length,variants:Object.values(atlas.glyphs).reduce((n,v)=>n+v.length,0)},null,2)+'\n');
console.log(`${Object.keys(atlas.glyphs).length} characters, ${Object.values(atlas.glyphs).reduce((n,v)=>n+v.length,0)} original variants extracted.`);
