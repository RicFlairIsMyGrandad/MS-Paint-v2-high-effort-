import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
const { resolveAsset, assetHandler, CSP } = createRequire(import.meta.url)("../desktop/resources.cjs");
test("resource resolver supports Windows drive letters, ASAR, spaces and Unicode", () => {
  const root = String.raw`C:\Users\Owner\PaintPlus Ω\resources\app.asar\dist`;
  assert.equal(resolveAsset(root,"paintplus://app/assets/editor.js",path.win32),root+String.raw`\assets\editor.js`);
  assert.equal(resolveAsset(root,"paintplus://app/demo/My%20asset%20%CE%A9.png",path.win32),root+String.raw`\demo\My asset Ω.png`);
  assert.equal(resolveAsset(root,"paintplus://app/%5c..%5csecret",path.win32),null);
  assert.equal(resolveAsset(root,"paintplus://elsewhere/index.html",path.win32),null);
});
test("ASAR asset responses set explicit JavaScript, WASM and HTML MIME types with CSP", async () => {
  const requests=[];
  const handler=assetHandler("/tmp/app.asar/dist",()=>{},async file=>{requests.push(file);return Buffer.from("asset");});
  for(const [name,type] of [["index.html","text/html; charset=utf-8"],["assets/editor.js","text/javascript; charset=utf-8"],["ort/runtime.mjs","text/javascript; charset=utf-8"],["ort/runtime.wasm","application/wasm"]]){
    const response=await handler({url:"paintplus://app/"+name});
    assert.equal(response.status,200); assert.equal(response.headers.get("Content-Type"),type);
    assert.equal(response.headers.get("Content-Security-Policy"),CSP); assert.equal(await response.text(),"asset");
  }
  assert.equal(requests.length,4);
  assert(!CSP.includes("'unsafe-eval'"));
});
test("missing packaged files return a diagnostic 404 rather than rejecting the protocol request", async () => {
  const messages=[];
  const handler=assetHandler("/tmp/app.asar/dist",(...args)=>messages.push(args),async()=>{const e=new Error("missing script");e.code="ENOENT";throw e;});
  const response=await handler({url:"paintplus://app/assets/missing.js"});
  assert.equal(response.status,404);assert.equal(messages[0][0],"resource-error");
  assert.equal((await handler({url:"paintplus://other/index.html"})).status,403);
});
