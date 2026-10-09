import { foregroundPixels } from "./alpha.js";
import * as ort from "onnxruntime-web/wasm";
let session;
self.onmessage = async ({ data: m }) => {
  try {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = m.runtime;
    ort.env.logLevel = "error";
    self.postMessage({ stage: "Loading local model…" });
    if (!session)
      session = await ort.InferenceSession.create(m.model, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    const side = 320,
      c = new OffscreenCanvas(side, side),
      ctx = c.getContext("2d");
    const image = new ImageData(
      new Uint8ClampedArray(m.pixels),
      m.width,
      m.height,
    );
    const src = new OffscreenCanvas(m.width, m.height);
    src.getContext("2d").putImageData(image, 0, 0);
    ctx.drawImage(src, 0, 0, side, side);
    const d = ctx.getImageData(0, 0, side, side).data,
      tensor = new Float32Array(3 * side * side);
    let max = 1;
    for (let i = 0; i < d.length; i += 4)
      max = Math.max(max, d[i], d[i + 1], d[i + 2]);
    const means = [0.485, 0.456, 0.406],
      stds = [0.229, 0.224, 0.225];
    for (let i = 0; i < side * side; i++)
      for (let k = 0; k < 3; k++)
        tensor[k * side * side + i] = (d[i * 4 + k] / max - means[k]) / stds[k];
    self.postMessage({ stage: "Removing background on CPU…" });
    const result = await session.run({
        [session.inputNames[0]]: new ort.Tensor("float32", tensor, [
          1,
          3,
          side,
          side,
        ]),
      }),
      mask = result[session.outputNames[0]].data;
    let low = Infinity,
      high = -Infinity;
    for (const v of mask) {
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
    const confidence = new Float32Array(m.width * m.height);
    const probability = (x, y) => (mask[Math.max(0, Math.min(side - 1, y)) * side + Math.max(0, Math.min(side - 1, x))] - low) / Math.max(0.000001, high - low);
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      const sx = (x + 0.5) * side / m.width - 0.5, sy = (y + 0.5) * side / m.height - 0.5,
        ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      confidence[y * m.width + x] = probability(ix, iy) * (1-fx) * (1-fy) + probability(ix+1, iy) * fx * (1-fy) + probability(ix, iy+1) * (1-fx) * fy + probability(ix+1, iy+1) * fx * fy;
    }
    const pixels = foregroundPixels(image.data, confidence, 0.1, 0);
    self.postMessage({ pixels: pixels.buffer, confidence: confidence.buffer, width: m.width, height: m.height }, [pixels.buffer, confidence.buffer]);
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
