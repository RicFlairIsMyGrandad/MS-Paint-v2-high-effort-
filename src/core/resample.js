import { canvas } from "./raster.js";
let worker;
let nextId = 0;
const pending = new Map();
export function resample(source, w, h, mode = "lanczos") {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (w === source.width && h === source.height) return Promise.resolve(source);
  if (w * h > 64000000) throw new Error("Object too large.");
  if (!worker) {
    worker = new Worker(new URL("./resample.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data: m }) => {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error));
      else {
        const c = canvas(p.w, p.h);
        c.getContext("2d").putImageData(
          new ImageData(new Uint8ClampedArray(m.pixels), p.w, p.h),
          0,
          0,
        );
        p.resolve(c);
      }
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message));
      pending.clear();
      worker.terminate();
      worker = null;
    };
  }
  const pixels = source
    .getContext("2d")
    .getImageData(0, 0, source.width, source.height).data;
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject, w, h });
    worker.postMessage(
      {
        id,
        pixels: pixels.buffer,
        sw: source.width,
        sh: source.height,
        dw: w,
        dh: h,
        mode,
      },
      [pixels.buffer],
    );
  });
}
