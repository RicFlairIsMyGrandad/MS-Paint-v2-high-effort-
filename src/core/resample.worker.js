const sinc = (x) =>
  Math.abs(x) < 1e-8 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
const kernel = (x) => (Math.abs(x) >= 3 ? 0 : sinc(x) * sinc(x / 3));
function weights(input, output) {
  const scale = input / output,
    spread = Math.max(1, scale),
    radius = 3 * spread,
    result = [];
  for (let x = 0; x < output; x++) {
    const center = (x + 0.5) * scale - 0.5,
      start = Math.ceil(center - radius),
      end = Math.floor(center + radius),
      list = [];
    let sum = 0;
    for (let k = start; k <= end; k++) {
      const w = kernel((center - k) / spread);
      if (w === 0) continue;
      list.push([Math.min(input - 1, Math.max(0, k)), w]);
      sum += w;
    }
    result.push(list.map(([i, w]) => [i, w / sum]));
  }
  return result;
}
export function resamplePixels(data, sw, sh, dw, dh, mode = "lanczos") {
  const out = new Uint8ClampedArray(dw * dh * 4);
  if (mode === "nearest") {
    for (let y = 0; y < dh; y++)
      for (let x = 0; x < dw; x++) {
        const i =
          (Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / dh)) * sw +
            Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / dw))) *
          4;
        out.set(data.subarray(i, i + 4), (y * dw + x) * 4);
      }
    return out;
  }
  // Separable Lanczos3 in premultiplied alpha avoids dark transparent halos.
  const wx = weights(sw, dw),
    wy = weights(sh, dh),
    temp = new Float32Array(dw * sh * 4);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < dw; x++) {
      const o = (y * dw + x) * 4;
      for (const [i, w] of wx[x]) {
        const s = (y * sw + i) * 4,
          a = data[s + 3] / 255;
        temp[o] += data[s] * a * w;
        temp[o + 1] += data[s + 1] * a * w;
        temp[o + 2] += data[s + 2] * a * w;
        temp[o + 3] += a * w;
      }
    }
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (const [i, w] of wy[y]) {
        const s = (i * dw + x) * 4;
        r += temp[s] * w;
        g += temp[s + 1] * w;
        b += temp[s + 2] * w;
        a += temp[s + 3] * w;
      }
      const o = (y * dw + x) * 4;
      if (a > 1e-6) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
        out[o + 3] = a * 255;
      }
    }
  return out;
}
if (
  typeof self !== "undefined" &&
  typeof WorkerGlobalScope !== "undefined" &&
  self instanceof WorkerGlobalScope
)
  self.onmessage = ({ data: m }) => {
    try {
      const pixels = resamplePixels(
        new Uint8ClampedArray(m.pixels),
        m.sw,
        m.sh,
        m.dw,
        m.dh,
        m.mode,
      );
      self.postMessage({ id: m.id, pixels: pixels.buffer }, [pixels.buffer]);
    } catch (e) {
      self.postMessage({ id: m.id, error: e.message });
    }
  };
