import { canvas } from "./raster.js";
import { PaintDocument } from "./document.js";
import { shapeNames } from '../ui/icons.js';
export async function imageCanvas(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  if (
    img.naturalWidth < 1 ||
    img.naturalHeight < 1 ||
    img.naturalWidth > 16384 ||
    img.naturalHeight > 16384 ||
    img.naturalWidth * img.naturalHeight > 64000000
  )
    throw new Error("Image exceeds the supported pixel limits.");
  const c = canvas(img.naturalWidth, img.naturalHeight);
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}
export function serialize(doc) {
  const sources = [],
    map = new Map();
  const ref = (c) => {
    if (!map.has(c)) {
      map.set(c, sources.length);
      sources.push(c.toDataURL("image/png"));
    }
    return map.get(c);
  };
  return JSON.stringify({
    format: "PaintPlus",
    version: 1,
    width: doc.width,
    height: doc.height,
    color2:doc.color2,
    layerTransparency:doc.layerTransparency,
    activeLayerId: doc.activeLayerId,
    selected: doc.selected,
    sources,
    layers: doc.layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      ...(l.group?{group:l.group,groupName:l.groupName||'Group'}:{}),
      raster: ref(l.canvas),
      objects: l.objects.map((o) => {
        const { source, ...rest } = o;
        return { ...rest, source: ref(source) };
      }),
    })),
  });
}
export async function deserialize(text, onChange = () => {}) {
  const p = JSON.parse(text);
  if(p.layerTransparency!==undefined&&!['color2','alpha'].includes(p.layerTransparency))throw new Error('Invalid layer transparency mode.');
  if(p.color2!==undefined&&!/^#[0-9a-f]{6}$/i.test(p.color2))throw new Error('Invalid layer key colour.');
  if (p.format !== "PaintPlus" || p.version !== 1)
    throw new Error("This is not a supported PaintPlus project.");
  if (
    !Number.isInteger(p.width) ||
    !Number.isInteger(p.height) ||
    p.width < 1 ||
    p.height < 1 ||
    p.width * p.height > 64000000 ||
    p.width > 16384 ||
    p.height > 16384
  )
    throw new Error("Invalid project dimensions.");
  if (
    !Array.isArray(p.layers) ||
    !p.layers.length ||
    p.layers.length > 256 ||
    !Array.isArray(p.sources)
  )
    throw new Error("Invalid project layers.");
  if (
    p.sources.some(
      (s) => typeof s !== "string" || !s.startsWith("data:image/png;base64,"),
    )
  )
    throw new Error("Project images must be embedded PNGs.");
  let imageBytes = p.width * p.height * 8;
  for (const source of p.sources) {
    const header = Uint8Array.from(atob(source.slice(22, 22 + 44)), c => c.charCodeAt(0));
    if (header.length < 24 || ![137,80,78,71,13,10,26,10].every((v,i) => header[i] === v)) throw new Error("Invalid embedded PNG.");
    const view = new DataView(header.buffer), width = view.getUint32(16), height = view.getUint32(20);
    imageBytes += width * height * 4;
    if (!width || !height || imageBytes > 512 * 1024 * 1024) throw new Error("Project exceeds the image memory budget. Use fewer layers or smaller source images.");
  }
  const sources = await Promise.all(p.sources.map(imageCanvas));
  const validId = (value) =>
      typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value),
    seenIds = new Set();
  for (const l of p.layers) {
    if (
      !validId(l.id) ||
      seenIds.has(l.id) ||
      typeof l.name !== "string" ||
      (l.group!==undefined&&!validId(l.group)) ||
      (l.groupName!==undefined&&(typeof l.groupName!=='string'||l.groupName.length>200)) ||
      !Array.isArray(l.objects)
    )
      throw new Error("Invalid layer metadata.");
    seenIds.add(l.id);
    for (const o of l.objects) {
      if (
        !validId(o.id) ||
        seenIds.has(o.id) ||
        typeof o.name !== "string" ||
        (o.group && !validId(o.group))
      )
        throw new Error("Invalid object metadata.");
      seenIds.add(o.id);
    }
  }
  const doc = new PaintDocument(p.width, p.height, onChange);
  doc.color2=p.color2||'#ffffff';doc.layerTransparency=p.layerTransparency||'color2';
  doc.layers = p.layers.map((l) => {
    if (
      !sources[l.raster] ||
      sources[l.raster].width !== p.width ||
      sources[l.raster].height !== p.height
    )
      throw new Error("Invalid layer raster.");
    return {
      ...l,
      canvas: sources[l.raster],
      objects: (l.objects || []).map((o) => {
        if (
          !sources[o.source] ||
          ![o.x, o.y, o.width, o.height, o.angle].every(Number.isFinite) ||
          o.width < 1 ||
          o.height < 1 ||
          o.width > 16384 ||
          o.height > 16384 ||
          o.width * o.height > 64000000
        )
          throw new Error("Invalid object transform.");
        for(const key of ['pixelSnapX','pixelSnapY'])if(o[key]!==undefined&&(!Number.isFinite(o[key])||Math.abs(o[key])>1))throw new Error('Invalid pixel alignment.');
        if (o.type === 'shape') {
          const style = o.shapeStyle, geometry = o.shapeGeometry;
          const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.y) && Math.abs(value.x) <= 100 && Math.abs(value.y) <= 100;
          if (style?.handWobble!==undefined&&typeof style.handWobble!=='boolean')throw new Error('Invalid pointing line style.');
          if (!shapeNames.includes(o.shapeName) || !style || !Number.isInteger(style.width) || style.width < 1 || style.width > 256 || ![style.color, style.background].every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) || !['none','solid'].includes(style.outline) || !['none','solid'].includes(style.fill) || !geometry || !point(geometry.a) || !point(geometry.b) || (geometry.controls && (!Array.isArray(geometry.controls) || geometry.controls.length > 2 || !geometry.controls.every(point))) || (geometry.points && (!Array.isArray(geometry.points) || geometry.points.length > 10000 || !geometry.points.every(point))))
            throw new Error('Invalid editable shape.');
        }
        if (o.type === 'text') {
          if (typeof o.text !== 'string' || o.text.length > 1000000 || typeof o.font !== 'string' || o.font.length > 100 || !Number.isFinite(o.fontSize) || o.fontSize < 1 || o.fontSize > (o.fontUnit === "pt" ? 384 : 512))
            throw new Error('Invalid editable text.');
          if (o.textRuns !== undefined && (!Array.isArray(o.textRuns) || o.textRuns.length > 10000 || o.textRuns.map(run => run.text).join('') !== o.text)) throw new Error('Invalid text runs.');
          for (const run of o.textRuns || []) {
            if (typeof run.text !== 'string' || (run.font !== undefined && (typeof run.font !== 'string' || run.font.length > 100)) || (run.fontSize !== undefined && (!Number.isFinite(run.fontSize) || run.fontSize < 1 || run.fontSize > 512)) || (run.textColor !== undefined && !/^#[0-9a-f]{6}$/i.test(run.textColor))) throw new Error('Invalid rich text style.');
          }
          if(o.tailTipX!==undefined&&(!Number.isFinite(o.tailTipX)||Math.abs(o.tailTipX)>17408))throw new Error('Invalid speech bubble tip.');
          if(o.backgroundMode!==undefined&&!['transparent','color2','offwhite','custom'].includes(o.backgroundMode))throw new Error('Invalid text background mode.');
          if(o.background!==undefined&&(typeof o.background!=='string'||!/^#[0-9a-f]{6}$/i.test(o.background)))throw new Error('Invalid text background color.');
          if(o.bubbleShadow!==undefined&&typeof o.bubbleShadow!=='boolean')throw new Error('Invalid bubble shadow.');
          for (const [key, limit] of [['paddingX',100],['paddingY',100],['padding',100],['lineGap',200],['bubbleWidth',32],['minHeight',16384],['textBoxWidth',16384],['shadowOffset',100],['tailWidth',160],['tailPosition',16384],['tailTipY',1024]])
            if (o[key] !== undefined && (!Number.isFinite(o[key]) || o[key] < (key === 'lineGap' ? -100 : 0) || o[key] > limit)) throw new Error('Invalid text layout.');
        }
        return { ...o, source: sources[o.source] };
      }),
    };
  });
  doc.activeLayerId = doc.layers.some((l) => l.id === p.activeLayerId)
    ? p.activeLayerId
    : doc.layers[0].id;
  doc.selected = (p.selected || []).filter((i) =>
    doc.objects.some((o) => o.id === i),
  );
  doc.dirty = false;
  return doc;
}
