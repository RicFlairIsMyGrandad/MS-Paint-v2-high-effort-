export const zoomLevels = [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];
export function nearestZoom(value) {
  if (!Number.isFinite(value)) return 1;
  return zoomLevels.reduce((best, level) => Math.abs(level - value) < Math.abs(best - value) ? level : best);
}
export function stepZoom(value, direction) {
  const index = zoomLevels.indexOf(nearestZoom(value));
  return zoomLevels[Math.max(0, Math.min(zoomLevels.length - 1, index + Math.sign(direction)))];
}
export function fitZoom(value) {
  return [...zoomLevels].reverse().find(level => level <= value) || zoomLevels[0];
}
