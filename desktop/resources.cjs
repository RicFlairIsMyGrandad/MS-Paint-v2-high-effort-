const fs = require("node:fs/promises");
const path = require("node:path");
const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'";
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".wasm": "application/wasm", ".onnx": "application/octet-stream",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};
function resolveAsset(root, address, paths = path) {
  const url = new URL(address);
  if (url.protocol !== "paintplus:" || url.hostname !== "app") return null;
  const route = decodeURIComponent(url.pathname);
  if (route.includes("\0")) return null;
  const file = paths.resolve(root, "." + route);
  return file === root || file.startsWith(root + paths.sep) ? file : null;
}
function assetHandler(root, log = () => {}, readFile = fs.readFile) {
  return async request => {
    try {
      const file = resolveAsset(root, request.url);
      if (!file) return new Response("Forbidden", { status: 403 });
      // Electron's filesystem supports app.asar on every platform. Avoid routing
      // Windows drive-letter/ASAR paths through Chromium's file URL loader.
      const bytes = await readFile(file);
      return new Response(bytes, { headers: {
        "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff",
      } });
    } catch (error) {
      log("resource-error", { url: request.url, message: error.message });
      return new Response("Cannot load local application resource.", { status: error.code === "ENOENT" ? 404 : 500 });
    }
  };
}
module.exports = { resolveAsset, assetHandler, CSP };
