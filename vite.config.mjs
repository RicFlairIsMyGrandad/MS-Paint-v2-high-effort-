import { defineConfig } from "vite";
import { cpSync, mkdirSync, readdirSync, existsSync } from "node:fs";
export default defineConfig({
  base: "./",
  build: { target: "es2022" },
  plugins: [
    {
      name: "bundle-local-ai",
      buildStart() {
        mkdirSync("public/ort", { recursive: true });
        const dir = "node_modules/onnxruntime-web/dist";
        if (existsSync(dir))
          for (const f of readdirSync(dir))
            if (
              f.startsWith("ort-wasm") &&
              !f.includes("jsep") &&
              (f.endsWith(".wasm") || f.endsWith(".mjs"))
            )
              cpSync(dir + "/" + f, "public/ort/" + f);
        mkdirSync("public/demo", { recursive: true });
        if (existsSync("assets/demo"))
          cpSync("assets/demo", "public/demo", { recursive: true });
        mkdirSync("public/models", { recursive: true });
        if (existsSync("assets/ai/u2netp.onnx"))
          cpSync("assets/ai/u2netp.onnx", "public/models/u2netp.onnx");
      },
    },
  ],
  server: { port: 5173, strictPort: true },
});
