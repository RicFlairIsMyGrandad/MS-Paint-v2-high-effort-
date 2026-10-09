import { canvas } from "./raster.js";
import { drawShape, speechBubblePath } from "./shapes.js";

export function shapeProperties(name, a, b, options) {
  const points = [a, b, ...(options.controls || []), ...(options.points || [])];
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  const w = Math.max(1, Math.max(...points.map(p => p.x)) - x), h = Math.max(1, Math.max(...points.map(p => p.y)) - y);
  const normalize = p => ({ x: (p.x - x) / w, y: (p.y - y) / h });
  const pad = Math.ceil(options.width / 2) + 1;
  return { type: "shape", draft: true, shapeName: name, x: x - pad, y: y - pad,
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
  const point = p => ({ x: pad + p.x * Math.max(1, w - pad * 2), y: pad + p.y * Math.max(1, h - pad * 2) });
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
export function textLayout(object) {
  const fontSize = Math.max(4, Math.min(512, Number(object.fontSize) || 28));
  const padding = Math.max(0, Math.min(100, Number(object.padding) || 0)) + (object.bubble ? (Number(object.bubbleWidth) || 3) + 2 : 2);
  const family = object.font || 'Segoe UI', fallback = ['Times New Roman','Georgia'].includes(family) ? 'serif' : family === 'Consolas' ? 'monospace' : 'sans-serif';
  const font = `${object.italic ? 'italic ' : ''}${object.bold ? 'bold ' : ''}${fontSize}px "${family}", ${fallback}`;
  const context = canvas(1, 1).getContext('2d');context.font = font;
  const width = Math.max(30, Math.round(object.width || 260));
  const lines = wrapText(context, object.text || '', Math.max(fontSize, width - padding * 2));
  const lineHeight = fontSize * 1.2 + Math.max(0, Math.min(200, Number(object.lineGap) || 0));
  const bodyHeight = Math.max(fontSize * 1.2 + padding * 2, lines.length * lineHeight + padding * 2);
  const height = Math.ceil(Math.max(object.minHeight || 1, object.bubble ? bodyHeight / 0.76 : bodyHeight));
  return { width, height, lines, font, fontSize, padding, lineHeight };
}
export function textSource(object) {
  const layout = textLayout(object);checkDimensions(layout.width, layout.height);
  const source = canvas(layout.width, layout.height), context = source.getContext('2d');
  if (object.bubble) {
    const outline = Math.max(1, Math.min(32, Number(object.bubbleWidth) || 3)), inset = outline / 2 + 1;
    context.beginPath();speechBubblePath(context, inset, inset, layout.width - inset * 2, layout.height - inset * 2);
    if (object.opaque) { context.fillStyle = object.background || '#ffffff'; context.fill(); }
    context.lineWidth = outline;context.strokeStyle = object.bubbleColor || '#000000';context.stroke();
  } else if (object.opaque) { context.fillStyle = object.background || '#ffffff';context.fillRect(0, 0, source.width, source.height); }
  context.font = layout.font;context.textBaseline = 'top';context.fillStyle = object.textColor || '#000000';
  if (object.hideText) return source;
  layout.lines.forEach((line, index) => {
    const y = layout.padding + index * layout.lineHeight;context.fillText(line, layout.padding, y);
    const width = context.measureText(line).width;context.lineWidth = Math.max(1, layout.fontSize / 16);
    context.strokeStyle = context.fillStyle;
    for (const offset of [object.underline ? layout.fontSize * 1.04 : null, object.strikeout ? layout.fontSize * 0.53 : null])
      if (offset !== null) { context.beginPath();context.moveTo(layout.padding, y + offset);context.lineTo(layout.padding + width, y + offset);context.stroke(); }
  });
  return source;
}
export function refreshEditable(object) {
  if (object.type === 'shape') object.source = shapeSource(object);
  if (object.type === 'text') { object.source = textSource(object); object.width = object.source.width; object.height = object.source.height; }
}
