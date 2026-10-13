import { canvas } from "./raster.js";
import { richLayout, paintRichText } from "./rich-text.js";
import { drawShape, speechBubblePath } from "./shapes.js";

export function shapeProperties(name, a, b, options) {
  const points = [a, b, ...(options.controls || []), ...(options.points || [])];
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  const w = Math.max(1, Math.max(...points.map(p => p.x)) - x), h = Math.max(1, Math.max(...points.map(p => p.y)) - y);
  const normalize = p => ({ x: (p.x - x) / w, y: (p.y - y) / h });
  const pad = Math.ceil(options.width / 2) + 1;
  return { type: "shape", draft: true, shapeName: name, x: Math.floor(x) - pad, y: Math.floor(y) - pad,
    width: Math.ceil(w + pad * 2), height: Math.ceil(h + pad * 2), resampling: "nearest",
    shapeStyle: { width: options.width, color: options.color, background: options.background, outline: options.outline, fill: options.fill },
    shapeGeometry: { a: normalize(a), b: normalize(b), controls: options.controls?.map(normalize), points: options.points?.map(normalize) } };
}
function checkDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 16384 || height > 16384 || width * height > 64000000)
    throw new Error("The editable object is too large.");
}
export function shapeSource(object) {
  const w = Math.max(1, Math.round(object.width)), h = Math.max(1, Math.round(object.height));
  checkDimensions(w, h);
  const source = canvas(w, h), context = source.getContext("2d"), style = object.shapeStyle;
  const pad = Math.min(Math.ceil(style.width / 2) + 1, (Math.min(w, h) - 1) / 2);
  const snap = value => Math.floor(value) + (style.width % 2 ? .5 : 0);
  const point = p => ({ x: snap(pad + p.x * Math.max(1, w - pad * 2)), y: snap(pad + p.y * Math.max(1, h - pad * 2)) });
  const geometry = object.shapeGeometry;
  drawShape(context, object.shapeName, point(geometry.a), point(geometry.b), { ...style,
    controls: geometry.controls?.map(point), points: geometry.points?.map(point) });
  // Classic Paint's shape boundaries are raster pixels, not smoothed display edges.
  const image = context.getImageData(0, 0, w, h), rgb = color => color.match(/\w\w/g).map(value => parseInt(value, 16));
  const stroke = rgb(style.color.replace('#', '')), fill = rgb(style.background.replace('#', ''));
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] < 128) { image.data[i + 3] = 0; continue; }
    image.data[i + 3] = 255;
    const distance = target => target.reduce((sum, value, channel) => sum + (value - image.data[i + channel]) ** 2, 0);
    const color = style.outline === 'none' ? fill : style.fill === 'none' || distance(stroke) <= distance(fill) ? stroke : fill;
    image.data.set(color, i);
  }
  context.putImageData(image, 0, 0); return source;
}
export function wrapText(context, text, availableWidth) {
  const lines = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const token of paragraph.split(/(\s+)/)) {
      if (line && context.measureText(line + token).width > availableWidth) { lines.push(line.trimEnd()); line = ''; }
      for (const character of token) {
        if (line && context.measureText(line + character).width > availableWidth) { lines.push(line.trimEnd()); line = ''; }
        if (line || !/\s/.test(character)) line += character;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}
export const textLayout = richLayout;
export function textSource(object) {
  const layout = textLayout(object);checkDimensions(layout.width, layout.height);
  const source = canvas(layout.width, layout.height), context = source.getContext('2d');
  if (object.bubble) {
    const outline = Math.max(1, Math.min(32, Number(object.bubbleWidth) || 3)), inset = outline / 2 + 1;
    const mask = canvas(source.width,source.height), ctx = mask.getContext('2d');
    ctx.beginPath();speechBubblePath(ctx,inset,inset,source.width-inset*2,source.height-inset*2);
    ctx.fillStyle='#ffffff';ctx.fill();const filling=ctx.getImageData(0,0,source.width,source.height).data;
    ctx.clearRect(0,0,source.width,source.height);ctx.beginPath();speechBubblePath(ctx,inset,inset,source.width-inset*2,source.height-inset*2);ctx.lineWidth=outline;ctx.strokeStyle='#ffffff';ctx.stroke();
    const line=ctx.getImageData(0,0,source.width,source.height).data, pixels=context.createImageData(source.width,source.height);
    const rgb=color=>[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)), stroke=rgb(object.bubbleColor||'#000000'), fill=rgb(object.background||'#ffffff');
    for(let index=0;index<pixels.data.length;index+=4) {
      if(line[index+3]>=128) {pixels.data.set(stroke,index);pixels.data[index+3]=255;}
      else if(object.opaque && filling[index+3]>=128){pixels.data.set(fill,index);pixels.data[index+3]=255;}
    }
    context.putImageData(pixels,0,0);
  } else if (object.opaque) { context.fillStyle=object.background||'#ffffff';context.fillRect(0,0,source.width,source.height); }
  if(!object.hideText)paintRichText(context,layout);
  return source;
}
export function refreshEditable(object) {
  if (object.type === 'shape') object.source = shapeSource(object);
  if (object.type === 'text') { object.source = textSource(object); object.width = object.source.width; object.height = object.source.height; }
}
