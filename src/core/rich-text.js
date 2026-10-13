import { canvas } from './raster.js';
export const runStyleKeys = ['font','fontSize','fontUnit','bold','italic','underline','strikeout','textColor'];
export const pointsToPixels = value => value * 96 / 72;
export function runStyle(object) {
  return Object.fromEntries(runStyleKeys.map(key => [key, object[key]]));
}
export function fontCSS(style) {
  const family = style.font || 'Segoe UI', pixels = style.fontUnit === 'pt' ? pointsToPixels(Number(style.fontSize) || 12) : Number(style.fontSize) || 20;
  const fallback = /Serif|Roman|Georgia|Garamond|Cambria|Baskerville|Book Antiqua|Palatino|Lora|Merriweather/i.test(family) ? 'serif' : /Mono|Consolas|Courier/i.test(family) ? 'monospace' : 'sans-serif';
  return `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${Math.max(1,Math.min(512,pixels))}px "${family}", ${fallback}`;
}
export function coalesceRuns(runs) {
  const result = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = result.at(-1);
    if (previous && runStyleKeys.every(key => previous[key] === run[key])) previous.text += run.text;
    else result.push({ ...run });
  }
  return result;
}
export function textRuns(object) {
  const base = runStyle(object);
  if (Array.isArray(object.textRuns) && object.textRuns.map(run => run.text).join('') === (object.text || '')) return coalesceRuns(object.textRuns.map(run => ({ ...base, ...run })));
  return [{ ...base, text: object.text || '' }];
}
export function formatRuns(runs, start, end, patch) {
  let offset = 0;const result = [];
  for (const run of runs) {
    const left = Math.max(0,start-offset), right = Math.min(run.text.length,end-offset);
    if (right > left) {
      result.push({ ...run, text: run.text.slice(0,left) });
      result.push({ ...run, ...patch, text: run.text.slice(left,right) });
      result.push({ ...run, text: run.text.slice(right) });
    } else result.push({ ...run });
    offset += run.text.length;
  }
  return coalesceRuns(result);
}
export function richLayout(object) {
  const width = Math.max(30,Math.round(object.width || 260)), padding = object.bubble ? Math.max(0,Math.min(100,Number(object.padding)||0)) + (Number(object.bubbleWidth)||3) + 2 : 0;
  const available = Math.max(1,width-padding*2), context=canvas(1,1).getContext('2d'), base=runStyle(object), runs=textRuns(object), characters=[];
  for(const run of runs) for(const character of Array.from(run.text.replace(/\r\n?/g,'\n'))) characters.push({character,style:run});
  const groups = chars => coalesceRuns(chars.map(item=>({...item.style,text:item.character})));
  const measure = chars => groups(chars).reduce((sum,run)=>{context.font=fontCSS(run);return sum+context.measureText(run.text).width;},0);
  const lines=[];let line=[], lastBreak=-1;
  for(const item of characters) {
    if(item.character==='\n'){lines.push(line);line=[];lastBreak=-1;continue;}
    line.push(item);
    if(/\s/.test(item.character))lastBreak=line.length-1;
    if(line.length>1 && measure(line)>available) {
      const cut=lastBreak>=0 && lastBreak<line.length-1?lastBreak+1:line.length-1;
      lines.push(line.slice(0,cut));line=line.slice(cut);
      while(line[0] && /\s/.test(line[0].character))line.shift();
      lastBreak=-1;line.forEach((item,index)=>{if(/\s/.test(item.character))lastBreak=index;});
    }
  }
  lines.push(line);
  let baseline=0,previousDescent=0,previousLeading=0,bottom=0;const rows=[];
  for(const chars of lines) {
    const segments=groups(chars);if(!segments.length)segments.push({...base,text:''});
    let ascent=0,descent=0,actualDescent=0,pixels=0;
    for(const segment of segments) {
      context.font=fontCSS(segment);const metrics=context.measureText('Mg'),actual=context.measureText(segment.text||'Mg');
      segment.font=fontCSS(segment);segment.pixels=segment.fontUnit==='pt'?pointsToPixels(Number(segment.fontSize)||12):Number(segment.fontSize)||20;
      segment.width=context.measureText(segment.text).width;
      ascent=Math.max(ascent,metrics.fontBoundingBoxAscent||metrics.actualBoundingBoxAscent||segment.pixels*.8);
      descent=Math.max(descent,metrics.fontBoundingBoxDescent||metrics.actualBoundingBoxDescent||segment.pixels*.2);
      actualDescent=Math.max(actualDescent,actual.actualBoundingBoxDescent||0);pixels=Math.max(pixels,segment.pixels);
    }
    const leading=Math.max(0,pixels*1.15-ascent-descent), gap=Math.max(-100,Math.min(200,Number(object.lineGap)||0));
    baseline=rows.length?baseline+Math.max(1,previousDescent+ascent+(previousLeading+leading)/2+gap):padding+ascent;
    const row={segments,baseline:Math.round(baseline),ascent,descent,text:chars.map(item=>item.character).join('')};
    rows.push(row);bottom=Math.max(bottom,row.baseline+actualDescent);
    for(const segment of segments)if(segment.underline)bottom=Math.max(bottom,row.baseline+Math.max(1,Math.round(segment.pixels*.1))+Math.max(1,Math.round(segment.pixels/24)));
    previousDescent=descent;previousLeading=leading;
  }
  const bodyHeight=Math.max(1,Math.ceil(bottom+padding+1));
  const height=Math.ceil(Math.max(object.minHeight||1,object.bubble?(bodyHeight+2)/.76:bodyHeight));
  const pixels=base.fontUnit==='pt'?pointsToPixels(Number(base.fontSize)||12):Number(base.fontSize)||20;
  return {width,height,padding,rows,lines:rows.map(row=>row.text),font:fontCSS(base),fontSize:pixels,lineHeight:Math.max(1,pixels*1.15+(Number(object.lineGap)||0))};
}
export function paintRichText(context,layout) {
  context.textBaseline='alphabetic';
  for(const row of layout.rows) {
    let x=layout.padding;
    for(const run of row.segments) {
      context.font=run.font;context.fillStyle=run.textColor||'#000000';const left=Math.round(x);
      context.fillText(run.text,left,row.baseline);
      const thickness=Math.max(1,Math.round(run.pixels/24));
      for(const y of [run.underline?row.baseline+Math.max(1,Math.round(run.pixels*.1)):null,run.strikeout?row.baseline-Math.round(run.pixels*.3):null])
        if(y!==null) context.fillRect(left,Math.round(y),Math.max(1,Math.round(run.width)),thickness);
      x+=run.width;
    }
  }
}
