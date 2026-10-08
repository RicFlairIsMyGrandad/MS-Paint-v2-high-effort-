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
    const md = new Uint8ClampedArray(side * side * 4);
    for (let i = 0; i < mask.length; i++) {
      const a = Math.round(
        ((mask[i] - low) / Math.max(0.000001, high - low)) * 255,
      );
      md.set([255, 255, 255, a], i * 4);
    }
    const mc = new OffscreenCanvas(side, side);
    mc.getContext("2d").putImageData(new ImageData(md, side, side), 0, 0);
    const full = new OffscreenCanvas(m.width, m.height),
      fctx = full.getContext("2d");
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = "high";
    fctx.drawImage(mc, 0, 0, m.width, m.height);
    const alpha = fctx.getImageData(0, 0, m.width, m.height).data,
      pixels = image.data;
    for (let i = 0; i < pixels.length; i += 4)
      pixels[i + 3] = Math.round((pixels[i + 3] * alpha[i + 3]) / 255);
    self.postMessage(
      { pixels: pixels.buffer, width: m.width, height: m.height },
      [pixels.buffer],
    );
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
