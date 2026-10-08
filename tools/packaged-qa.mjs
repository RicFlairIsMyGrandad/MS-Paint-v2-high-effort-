import { _electron as electron } from "@playwright/test";
import { mkdtemp, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const windows = process.platform === "win32";
const original = path.resolve(process.env.PAINTPLUS_TEST_EXECUTABLE || (windows ? "release/win-unpacked/PaintPlus.exe" : "release/linux-unpacked/paintplus"));
const directory = await mkdtemp(path.join(os.tmpdir(), "PaintPlus packaged Ω "));
const installation = path.join(directory, "installed app with spaces");
await cp(path.dirname(original), installation, { recursive: true });
const profile = path.join(directory, "profile"), output = path.join(directory, "images");
await mkdir(output);
const application = await electron.launch({
  executablePath: path.join(installation, path.basename(original)),
  args: [...(windows ? [] : ["--no-sandbox"]), "--user-data-dir=" + profile],
  cwd: directory, timeout: 45000,
  env: { ...process.env, ...(!windows ? { DISPLAY: ":99", XDG_CACHE_HOME: "/workspace/.cache" } : {}) },
});
const page = await application.firstWindow();
const errors=[], external=[];
page.on("pageerror", e=>errors.push(e.message));
page.on("request", request=>{if(/^https?:/.test(request.url()))external.push(request.url());});
try {
  await page.waitForFunction(()=>window.paintplus,{},{timeout:45000});
  await page.locator(".asset-card img").evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  const runtime = await application.evaluate(({app})=>({isPackaged:app.isPackaged,appPath:app.getAppPath(),platform:process.platform,gpuStatus:app.getGPUFeatureStatus()}));
  assert(runtime.isPackaged);assert(runtime.appPath.endsWith("app.asar"));
  if(windows)assert.notEqual(runtime.gpuStatus.gpu_compositing,"enabled");
  await page.evaluate(async()=>{await paintplus.setTool("pencil");paintplus.width=1;});
  const box=await page.locator("#overlay").boundingBox();
  await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+80,box.y+30);await page.mouse.up();
  assert.deepEqual(await page.evaluate(()=>[...paintplus.doc.activeLayer.canvas.getContext("2d").getImageData(50,30,1,1).data]),[24,71,241,255]);
  const clipboardPixels = await page.evaluate(async()=>{
    const source=document.createElement('canvas');source.width=3;source.height=1;
    const context=source.getContext('2d');context.fillStyle='#ff0000';context.fillRect(0,0,1,1);
    context.fillStyle='rgba(0,0,255,0.5)';context.fillRect(2,0,1,1);
    await desktop.copyImage(source.toDataURL('image/png'));
    const image=new Image();image.src=await desktop.pasteImage();await image.decode();
    context.clearRect(0,0,3,1);context.drawImage(image,0,0);
    return [...context.getImageData(0,0,3,1).data];
  });
  assert.deepEqual(clipboardPixels.slice(0,4),[255,0,0,255]);
  assert.equal(clipboardPixels[7],0);assert.deepEqual(clipboardPixels.slice(8,11),[0,0,255]);
  assert(clipboardPixels[11]>=127&&clipboardPixels[11]<=129);
  await application.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},output);
  await page.evaluate(()=>desktop.chooseFolder("output"));
  const smoke=await page.evaluate(()=>paintplus.desktopSmoke());
  assert(smoke.clipboardOK);assert(smoke.collisionOK);assert(smoke.aiInferenceOK);assert(smoke.aiModel);
  const savedPNG=await readFile(smoke.first.path);assert.deepEqual([...savedPNG.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.deepEqual(await readFile(smoke.second.path),savedPNG);
  const savedProject=JSON.parse(await readFile(smoke.project.path,'utf8'));assert.equal(savedProject.version,1);assert(savedProject.layers.length>1);
  await page.evaluate(()=>{paintplus.doc.dirty=false;return paintplus.demo();});
  await mkdir("docs/screenshots",{recursive:true});
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}.png`});
  await page.evaluate(()=>paintplus.resizeDialog());
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}-dialog.png`});
  const log=await readFile(path.join(profile,"startup.log"),"utf8");
  assert(log.includes('"event":"renderer-ready"'));assert(!log.includes('"event":"resource-error"'));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const result={...runtime,installationPathHasSpacesAndUnicode:true,firstLaunchReady:true,pointerDrawing:true,clipboardAlpha:true,savedPNGBytes:true,savedEditableProject:true,...smoke,rendererErrors:errors,externalRequests:external};
  await writeFile(`docs/packaged-${windows?"windows":"linux"}-test-results.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} catch(error) {
  const log=await readFile(path.join(profile,"startup.log"),"utf8").catch(()=>"No startup log.");
  console.error(log);
  await writeFile(`docs/packaged-${windows?"windows":"linux"}-test-results.json`,JSON.stringify({error:error.message,stack:error.stack,log},null,2));
  await page.screenshot({path:"test-results/packaged-startup-failure.png"}).catch(()=>{});
  throw error;
} finally {
  await application.evaluate(({app})=>app.exit(0)).catch(()=>{});
}
