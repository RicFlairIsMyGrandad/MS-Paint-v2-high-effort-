import { canvas } from "./raster.js";
import { PaintDocument } from "./document.js";
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
    activeLayerId: doc.activeLayerId,
    selected: doc.selected,
    sources,
    layers: doc.layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked,
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
