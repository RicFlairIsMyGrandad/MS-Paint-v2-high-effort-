// Apply the model confidence to the original pixels, allowing lost soft edges
// to be restored. Original image transparency is preserved independently.
export function foregroundPixels(original, confidence, threshold = 0.1, softness = 0) {
  if (original.length !== confidence.length * 4) throw new Error("Invalid foreground mask.");
  const output = new Uint8ClampedArray(original);
  for (let pixel = 0; pixel < confidence.length; pixel++) {
    const probability = confidence[pixel];
    let coverage = probability > threshold ? 1 : 0;
    if (softness > 0) {
      const t = Math.max(0, Math.min(1, (probability - threshold) / softness + 0.5));
      coverage = t * t * (3 - 2 * t);
    }
    output[pixel * 4 + 3] = Math.round(original[pixel * 4 + 3] * coverage);
  }
  return output;
}
