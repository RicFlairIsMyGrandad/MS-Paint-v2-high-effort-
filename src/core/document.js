import { canvas, cloneCanvas, colorKey, polygonMask, hexRGB } from "./raster.js";
import { History, RasterEdit } from "./history.js";
import {resamplePixels} from './resample.worker.js';
export const id = () =>
  globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
export function createLayer(width, height, name = "Layer", background = null) {
  const c = canvas(width, height);
  if (background) {
    const ctx = c.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  return {
    id: id(),
    name,
    visible: true,
    locked: false,
    canvas: c,
    objects: [],
  };
}
export function quarterTurn(angle) {
  const turns=Math.round(angle/90);return Math.abs(angle-turns*90)<1e-8?((turns%4)+4)%4:null;
}
export function snapQuarterTurn(object) {
  const q=quarterTurn(object.angle||0);
  if(q===null){delete object.pixelSnapX;delete object.pixelSnapY;return object;}
  // Undo the previous half-pixel correction before calculating the next one.
  // This keeps mixed odd/even dimensions crisp without drifting after four turns.
  object.x-=object.pixelSnapX||0;object.y-=object.pixelSnapY||0;
  const w=q%2?object.height:object.width,h=q%2?object.width:object.height;
  object.pixelSnapX=Math.round(object.x+object.width/2-w/2)-(object.x+object.width/2-w/2);
  object.pixelSnapY=Math.round(object.y+object.height/2-h/2)-(object.y+object.height/2-h/2);
  object.x+=object.pixelSnapX;object.y+=object.pixelSnapY;return object;
}
export function objectMatrix(o) {
  const angle = (o.angle * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  return { cos, sin, cx: o.x + o.width / 2, cy: o.y + o.height / 2 };
}
export function localPoint(o, x, y) {
  const { cos, sin, cx, cy } = objectMatrix(o),
    dx = x - cx,
    dy = y - cy;
  return {
    x: dx * cos + dy * sin + o.width / 2,
    y: -dx * sin + dy * cos + o.height / 2,
  };
}
export function worldPoint(o, x, y) {
  const { cos, sin, cx, cy } = objectMatrix(o);
  return {
    x: cx + (x - o.width / 2) * cos - (y - o.height / 2) * sin,
    y: cy + (x - o.width / 2) * sin + (y - o.height / 2) * cos,
  };
}
export function hitObject(o, x, y) {
  const p = localPoint(o, x, y);
  return p.x >= 0 && p.y >= 0 && p.x <= o.width && p.y <= o.height;
}
export function drawObject(ctx, o, quality = true, layerKey = null) {
  ctx.save();
  const q=quarterTurn(o.angle||0),position=q===null?o:snapQuarterTurn({...o});
  ctx.translate(position.x + o.width / 2, position.y + o.height / 2);
  if(q===null)ctx.rotate((o.angle * Math.PI) / 180);
  else ctx.transform(...[[1,0,0,1,0,0],[0,1,-1,0,0,0],[-1,0,0,-1,0,0],[0,-1,1,0,0,0]][q]);
  ctx.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1);
  ctx.imageSmoothingEnabled =
    o.resampling !== "nearest" && o.smoothPreview !== false;
  ctx.imageSmoothingQuality = "high";
  let src = o.transparentColor ? keyedSource(o.source,o.transparentColor) : o.source;
  if(layerKey&&layerKey!==o.transparentColor)src=keyedSource(src,layerKey);
  if(quality&&o.resampling!=='nearest'&&o.smoothPreview!==false)src=resizeForDrawing(src,o.width,o.height);
  if(src.width===o.width&&src.height===o.height&&q!==null)ctx.imageSmoothingEnabled=false;
  ctx.drawImage(src, -o.width / 2, -o.height / 2, o.width, o.height);
  ctx.restore();
}
const keyed = new WeakMap();
const resized = new WeakMap();
const layerKeys = new WeakMap();
export function resizeForDrawing(source,width,height){
  const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
  if(w===source.width&&h===source.height)return source;
  const cached=resized.get(source);if(cached?.w===w&&cached.h===h)return cached.canvas;
  // Avoid an unbounded family of previews while dragging; retain one size.
  if(w*h*4+w*source.height*16+source.width*source.height*4>192*1024*1024)return source;
  const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
  const output=canvas(w,h),context=output.getContext('2d'),image=context.createImageData(w,h);
  image.data.set(resamplePixels(pixels,source.width,source.height,w,h,'lanczos'));context.putImageData(image,0,0);
  resized.set(source,{w,h,canvas:output});return output;
}
function keyedSource(source,color){
  const cached=keyed.get(source);if(cached?.color===color)return cached.canvas;
  const result=colorKey(source,color);keyed.set(source,{color,canvas:result});return result;
}
export function drawLayer(context,layer,key=null,revision){
  let source=layer.canvas;
  if(key){
    const cached=layerKeys.get(layer);
    if(revision!==undefined&&cached?.source===source&&cached.key===key&&cached.revision===revision)source=cached.canvas;
    else{const output=colorKey(source,key);if(revision!==undefined)layerKeys.set(layer,{source,key,revision,canvas:output});source=output;}
  }
  context.drawImage(source,0,0);
  for(const object of layer.objects)drawObject(context,object,true,key);
}
function colorKeyCached(o) {
  return keyedSource(o.source,o.transparentColor);
}
export class PaintDocument {
  constructor(width = 731, height = 411, onChange = () => {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 16384 || height > 16384 || width * height > 64000000 || width * height * 12 > 512 * 1024 * 1024)
      throw new Error("Canvas dimensions exceed the supported image memory budget.");
    this.width = width;
    this.height = height;
    this.layers = [createLayer(width, height, "Background", "#ffffff")];
    this.activeLayerId = this.layers[0].id;
    this.selected = [];
    this.onChange = onChange;
    this.dirty = false;
    this.color2='#ffffff';this.renderRevision=0;this.visibilityOverrides=new Map();
    this.transientSelection=null;this.selectedLayers=[];
    this.maxWorkingBytes = 512 * 1024 * 1024;
    this.history = new History(() => {
      this.dirty = true;
      this.onChange();
    }, 128 * 1024 * 1024, () => this.resources());
    this.history.beforeNavigate=()=>this.cancelTransientSelection();
  }
  resources(state = this) {
    return [...new Set([...state.layers.flatMap(l => [l.canvas, ...l.objects.map(o => o.source)]),...(state===this&&this.transientSelection?this.resources(this.transientSelection.before):[])])];
  }
  assertAllocation(extraBytes) {
    const live = this.resources().reduce((sum, c) => sum + c.width * c.height * 4, 0);
    // Budget two derived key/resampling canvases per source, the renderer's
    // buffers, undo and the requested operation before allocating.
    const estimate = live * 3 + this.history.bytes + this.width * this.height * 8 + extraBytes;
    if (!Number.isFinite(estimate) || estimate > this.maxWorkingBytes)
      throw new Error("This operation needs too much image memory. Use smaller dimensions, fewer layers, or clear undo history first.");
  }
  get activeLayer() {
    return (
      this.layers.find((l) => l.id === this.activeLayerId) || this.layers[0]
    );
  }
  get objects() {
    return this.layers.flatMap((l) => l.objects);
  }
  get selectedObjects() {
    return this.objects.filter((o) => this.selected.includes(o.id));
  }
  changed() {
    this.invalidateLayers();
    this.dirty = true;
    if(this.transientSelection)this.transientSelection.dirty=true;
    this.onChange();
  }
  invalidateLayers(){this.renderRevision++;}
  setLayerVisibility(layerId,visible){
    const layer=this.layers.find(layer=>layer.id===layerId);if(!layer)return;
    layer.visible=!!visible;this.visibilityOverrides.set(layerId,layer.visible);
    if(!layer.visible)this.selected=this.selected.filter(id=>!layer.objects.some(object=>object.id===id));
    this.changed();
  }
  metadata() {
    return {
      width: this.width,
      height: this.height,
      activeLayerId: this.activeLayerId,
      selected: [...this.selected],
      layers: this.layers.map((l) => ({
        ...l,
        objects: l.objects.map((o) => ({ ...o })),
      })),
    };
  }
  restore(state) {
    this.transientSelection=null;this.selectedLayers=[];
    this.width = state.width;
    this.height = state.height;
    this.activeLayerId = state.activeLayerId;
    this.selected = [...state.selected];
    this.layers = state.layers.map((l) => ({
      ...l,
      visible:this.visibilityOverrides.has(l.id)?this.visibilityOverrides.get(l.id):l.visible,
      objects: l.objects.map((o) => ({ ...o })),
    }));
    this.selected=this.selected.filter(id=>this.layers.some(layer=>layer.visible&&layer.objects.some(object=>object.id===id)));
    this.changed();
  }
  action(label, fn, bytes = 0) {
    const before = this.consumeSelectionBefore(this.metadata());
    const dirty = this.dirty;
    try { fn(); }
    catch (error) { this.restore(before);this.dirty = dirty;throw error; }
    const after = this.metadata();
    const command = {
      label, before, after,
      resources: [...new Set([...this.resources(before), ...this.resources(after)])],
      undo: () => this.restore(command.before), redo: () => this.restore(command.after),
    };
    if (!this.inTransaction) this.history.push(command);
    this.changed();
  }
  transaction(label, fn) {
    if (this.inTransaction) return fn();
    const before = this.consumeSelectionBefore(this.metadata()), dirty = this.dirty;
    this.inTransaction = true;
    try {
      const result = fn(), after = this.metadata();
      this.history.push({ label, resources: [...new Set([...this.resources(before), ...this.resources(after)])], undo: () => this.restore(before), redo: () => this.restore(after) });
      this.changed();return result;
    } catch (error) { this.restore(before);this.dirty = dirty;throw error; }
    finally { this.inTransaction = false; }
  }
  beginRaster() {
    if(!this.activeLayer.visible)throw new Error('Show the active layer before painting.');
    if (this.activeLayer.locked)
      throw new Error("This layer is locked. Unlock it before painting.");
    const layerId = this.activeLayer.id;
    return new RasterEdit(
      this.activeLayer,
      this.history,
      () => this.changed(),
      () => this.layers.find((l) => l.id === layerId),
    );
  }
  addLayer(name = "Layer " + (this.layers.length + 1)) {
    this.assertAllocation(this.width * this.height * 4);
    let layer;
    this.action("New layer", () => {
      layer = createLayer(this.width, this.height, name);
      this.layers.push(layer);
      this.activeLayerId = layer.id;
    });
    return layer;
  }
  insert(source, name = "Image", ownLayer = true, properties = {}) {
    this.assertAllocation((ownLayer ? this.width * this.height * 4 : 0) + (this.resources().includes(source) ? 0 : source.width * source.height * 4));
    if(!ownLayer&&!this.activeLayer.visible)throw new Error('Show the active layer before inserting an object.');
    if (this.activeLayer.locked && !ownLayer)
      throw new Error("This layer is locked.");
    let obj;
    this.action("Insert " + name, () => {
      if (ownLayer) {
        const l = createLayer(this.width, this.height, name);
        this.layers.push(l);
        this.activeLayerId = l.id;
      }
      obj = {
        id: id(),
        name,
        source,
        x: 0,
        y: 0,
        width: source.width,
        height: source.height,
        angle: 0,
        flipH: false,
        flipV: false,
        resampling: "lanczos",
        type: "image",
        ...properties,
      };
      this.activeLayer.objects.push(obj);
      this.selected = [obj.id];
    });
    return obj;
  }
  hit(x, y) {
    for (const l of [...this.layers].reverse())
      if (l.visible && !l.locked)
        for (const o of [...l.objects].reverse())
          if (hitObject(o, x, y)) return { layer: l, object: o };
    return null;
  }
  composite(background = null) {
    const out = canvas(this.width, this.height),
      ctx = out.getContext("2d");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    this.layers.forEach((layer,index)=>{if(layer.visible)drawLayer(ctx,layer,index?this.color2:null);});
    return out;
  }
  cutIntoLayer(background = '#ffffff') {
    const objects=this.selectedObjects;
    if(!objects.length)return;
    if(this.layers.some(layer=>layer.locked&&layer.objects.some(object=>objects.includes(object))))throw new Error('Unlock selected layers first.');
    this.assertAllocation(this.width*this.height*(this.layers.length+4)*4);
    this.action('Cut into new layer',()=>{
      for(const layer of this.layers)layer.objects=layer.objects.filter(object=>!objects.includes(object));
      const layer=createLayer(this.width,this.height,'Cut selection',background);layer.objects=objects;
      this.layers.push(layer);this.activeLayerId=layer.id;
    });
  }
  deleteSelected(background = null) {
    if (!this.selected.length) return;
    const locked = this.layers.some(
      (l) => l.locked && l.objects.some((o) => this.selected.includes(o.id)),
    );
    if (locked) throw new Error("Unlock selected layers first.");
    this.action("Delete objects", () => {
      for (const l of this.layers)
        l.objects = l.objects.filter((o) => !this.selected.includes(o.id));
      this.selected = [];
    });
  }
  resizeCanvas(w, h, fill = "#ffffff") {
    if (!Number.isFinite(w) || !Number.isFinite(h))
      throw new Error("Invalid canvas dimensions.");
    w = Math.max(1, Math.min(16384, Math.round(w)));
    h = Math.max(1, Math.min(16384, Math.round(h)));
    if (w * h > 64000000)
      throw new Error("Canvas is limited to 64 million pixels.");
    this.assertAllocation(w * h * (this.layers.length + 2) * 4);
    this.action(
      "Resize canvas",
      () => {
        this.layers = this.layers.map((l, index) => {
          const c = canvas(w, h),
            ctx = c.getContext("2d");
          if (index === 0) {
            ctx.fillStyle = fill;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.drawImage(l.canvas, 0, 0);
          return { ...l, canvas: c };
        });
        this.width = w;
        this.height = h;
      },
      this.width * this.height * this.layers.length * 4,
    );
  }
  crop(rect) {
    const x = Math.max(0, Math.floor(rect.x)),
      y = Math.max(0, Math.floor(rect.y)),
      w = Math.min(this.width - x, Math.round(rect.width)),
      h = Math.min(this.height - y, Math.round(rect.height));
    if (w < 1 || h < 1) return;
    this.assertAllocation(w * h * (this.layers.length + 2) * 4);
    this.action(
      "Crop",
      () => {
        this.layers = this.layers.map((l) => {
          const c = canvas(w, h);
          c.getContext("2d").drawImage(l.canvas, -x, -y);
          return {
            ...l,
            canvas: c,
            objects: l.objects.map((o) => ({ ...o, x: o.x - x, y: o.y - y })),
          };
        });
        this.width = w;
        this.height = h;
        this.selected = [];
      },
      this.width * this.height * this.layers.length * 4,
    );
  }
  selectRegion(
    rect,
    path = null,
    transparentColor = null,
    paintBackground = "#ffffff",
  ) {
    const x = Math.max(0, Math.floor(rect.x)),
      y = Math.max(0, Math.floor(rect.y)),
      w = Math.min(this.width - x, Math.ceil(rect.x + rect.width) - x),
      h = Math.min(this.height - y, Math.ceil(rect.y + rect.height) - y);
    if (w < 1 || h < 1) return null;
    this.cancelTransientSelection();
    const l = this.activeLayer;
    if (l.locked) throw new Error("This layer is locked.");
    this.assertAllocation(w*h*32+this.width*this.height*4);
    const selectionBefore=this.metadata(),selectionDirty=this.dirty;
    l.canvas=cloneCanvas(l.canvas);
    const src = canvas(w, h),
      ctx = src.getContext("2d");
    const mask = path ? polygonMask(w, h, path, x, y) : null;
    const before = l.canvas.getContext("2d").getImageData(x, y, w, h), lifted = new Uint8ClampedArray(before.data), erased = new Uint8ClampedArray(before.data);
    const replacement = [...hexRGB(paintBackground), 255];
    for (let pixel = 0; pixel < w * h; pixel++) {
      if (!mask || mask[pixel]) erased.set(replacement, pixel * 4);
      else lifted[pixel * 4 + 3] = 0;
    }
    const sourceImage = ctx.createImageData(w,h);sourceImage.data.set(lifted);ctx.putImageData(sourceImage,0,0);
    const erasedImage = l.canvas.getContext('2d').createImageData(w,h);erasedImage.data.set(erased);
    const erase = () => l.canvas.getContext('2d').putImageData(erasedImage,x,y);
    let obj;
    erase();
    obj = {
      id: id(),
      name: "Selection",
      source: src,
      x,
      y,
      width: w,
      height: h,
      angle: 0,
      flipH: false,
      flipV: false,
      resampling: "lanczos",
      type: "selection",
      transparentColor,
    };
    l.objects.push(obj);
    this.selected = [obj.id];
    this.transientSelection={before:selectionBefore,dirty:selectionDirty,ids:[...this.selected],initial:JSON.stringify(this.selectedObjects.map(selectionIdentity))};
    this.invalidateLayers();this.onChange();
    return obj;
  }
  consumeSelectionBefore(fallback) {
    const pending=this.transientSelection;this.transientSelection=null;
    return pending?.before||fallback;
  }
  cancelTransientSelection() {
    const pending=this.transientSelection;if(!pending)return false;
    this.restore(pending.before);this.dirty=pending.dirty;this.onChange();return true;
  }
  selectionUnchanged() {
    return !!this.transientSelection&&this.transientSelection.initial===JSON.stringify(this.objects.filter(object=>this.transientSelection.ids.includes(object.id)).map(selectionIdentity));
  }
  selectLayers(ids) {
    this.cancelTransientSelection();
    const targets=this.layers.filter(layer=>ids.includes(layer.id)&&layer.visible&&!layer.locked);
    const before=this.metadata(),dirty=this.dirty;
    this.assertAllocation(targets.length*this.width*this.height*8);
    for(const layer of targets) {
      // Key-colour pixels are the empty paper; retain the paper on the base layer.
      const source=colorKey(layer.canvas,this.color2),ctx=source.getContext('2d'),data=ctx.getImageData(0,0,this.width,this.height).data;
      let left=this.width,top=this.height,right=-1,bottom=-1;
      for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)if(data[(y*this.width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      if(right>=left) {
        const image=canvas(right-left+1,bottom-top+1);image.getContext('2d').drawImage(source,-left,-top);
        layer.canvas=canvas(this.width,this.height);
        if(layer===this.layers[0]){
          const original=before.layers.find(item=>item.id===layer.id).canvas.getContext('2d').getImageData(0,0,this.width,this.height),paper=layer.canvas.getContext('2d'),rgb=hexRGB(this.color2);
          for(let i=0;i<data.length;i+=4)if(data[i+3]){if(original.data[i+3]===255)original.data.set([...rgb,255],i);else original.data[i+3]=0;}
          paper.putImageData(original,0,0);
        }
        layer.objects.unshift({id:id(),name:layer.name+' pixels',type:'image',source:image,x:left,y:top,width:image.width,height:image.height,angle:0,flipH:false,flipV:false,resampling:'lanczos'});
      }
    }
    this.selectedLayers=targets.map(layer=>layer.id);
    this.selected=targets.flatMap(layer=>layer.objects.map(object=>object.id));
    if(targets.length)this.activeLayerId=targets.at(-1).id;
    if(this.selected.length)this.transientSelection={before,dirty,ids:[...this.selected],initial:JSON.stringify(this.selectedObjects.map(selectionIdentity))};
    this.invalidateLayers();this.onChange();
  }
  groupLayers(ids=this.selectedLayers) {
    const targets=this.layers.filter(layer=>ids.includes(layer.id));
    if(targets.length<2)throw new Error('Shift-click two or more layers, then choose Group.');
    if(targets.some(layer=>layer.locked))throw new Error('Unlock selected layers before grouping.');
    this.cancelTransientSelection();const group=id(),name='Group '+(new Set(this.layers.map(layer=>layer.group).filter(Boolean)).size+1);
    this.action('Group layers',()=>{for(const layer of this.layers)if(ids.includes(layer.id)){layer.group=group;layer.groupName=name;}});
    this.selectLayers(ids);return group;
  }
  ungroupLayers(ids=this.selectedLayers) {
    const groups=new Set(this.layers.filter(layer=>ids.includes(layer.id)).map(layer=>layer.group).filter(Boolean));
    this.cancelTransientSelection();
    this.action('Ungroup layers',()=>{for(const layer of this.layers)if(groups.has(layer.group)){delete layer.group;delete layer.groupName;}});
  }
  duplicateSelected() {
    const selected = this.selectedObjects;
    if (!selected.length) return;
    this.action("Duplicate objects", () => {
      const ids = [];
      const groups = new Map();
      for (const l of this.layers) {
        if (l.locked) continue;
        for (const o of [...l.objects])
          if (this.selected.includes(o.id)) {
            const c = { ...o, id: id(), x: o.x + 16, y: o.y + 16 };
            if (o.group) {
              if (!groups.has(o.group)) groups.set(o.group, id());
              c.group = groups.get(o.group);
            }
            l.objects.push(c);
            ids.push(c.id);
          }
      }
      this.selected = ids;
    });
  }
  groupSelected() {
    if(this.selectedLayers.length>1)return this.groupLayers([...this.selectedLayers]);
    if (this.selectedObjects.length < 2) return;
    const group = id();
    this.action("Group objects", () => {
      for (const o of this.selectedObjects) o.group = group;
    });
  }
  ungroupSelected() {
    if(this.selectedLayers.some(id=>this.layers.find(layer=>layer.id===id)?.group))return this.ungroupLayers([...this.selectedLayers]);
    this.action("Ungroup objects", () => {
      for (const o of this.selectedObjects) delete o.group;
    });
  }
  async rasterize(resample) {
    const targets = this.selectedObjects;
    if (!targets.length) return;
    const temporary = targets.reduce((sum, o) => sum + o.width * o.height * 8 + o.source.width * o.source.height * 4 + Math.round(o.width) * o.source.height * 16, 0);
    this.assertAllocation(temporary + this.width * this.height * this.layers.length * 4);
    for (const l of this.layers)
      if (l.locked && l.objects.some((o) => this.selected.includes(o.id)))
        throw new Error("Unlock selected layers first.");
    const resized = new Map();
    for (const o of targets) {
      let src = o.transparentColor ? colorKeyCached(o) : o.source;
      const layer=this.layers.find(layer=>layer.objects.includes(o));if(this.layers.indexOf(layer)>0&&o.transparentColor!==this.color2)src=keyedSource(src,this.color2);
      resized.set(
        o.id,
        await resample(
          src,
          Math.max(1, Math.round(o.width)),
          Math.max(1, Math.round(o.height)),
          o.resampling,
        ),
      );
    }
    this.action(
      "Rasterize objects",
      () => {
        for (const l of this.layers) {
          if (!l.objects.some((o) => this.selected.includes(o.id))) continue;
          l.canvas = cloneCanvas(l.canvas);
          for (const o of l.objects)
            if (resized.has(o.id))
              drawObject(l.canvas.getContext("2d"), {
                ...o,
                source: resized.get(o.id),
                transparentColor: null,
              });
          l.objects = l.objects.filter((o) => !resized.has(o.id));
        }
        this.selected = [];
      },
      this.width * this.height * this.layers.length * 4,
    );
  }
  mergeDown(layerId = this.activeLayerId) {
    const index = this.layers.findIndex((l) => l.id === layerId);
    if (index <= 0) return;
    const top = this.layers[index],
      bottom = this.layers[index - 1];
    if (top.locked || bottom.locked)
      throw new Error("Unlock both layers before merging.");
    if (!top.visible || !bottom.visible)
      throw new Error("Show both layers before merging.");
    this.assertAllocation(this.width * this.height * 4);
    this.action(
      "Merge down",
      () => {
        bottom.canvas = cloneCanvas(bottom.canvas);
        const ctx = bottom.canvas.getContext("2d");
        for (const o of bottom.objects) drawObject(ctx, o,true,index>1?this.color2:null);
        drawLayer(ctx,top,this.color2);
        bottom.objects = [];
        this.layers.splice(index, 1);
        this.activeLayerId = bottom.id;
        this.selected = [];
      },
      this.width * this.height * 4,
    );
  }
}

const selectionIdentity=object=>[object.id,object.x,object.y,object.width,object.height,object.angle,object.flipH,object.flipV,object.transparentColor];
