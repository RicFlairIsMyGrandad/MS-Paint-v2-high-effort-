import { _electron as electron } from "@playwright/test";
import { mkdtemp, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const windows = process.platform === "win32";
const original = path.resolve(windows ? "release/win-unpacked/PaintPlus.exe" : "release/linux-unpacked/paintplus");
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
  const runtime = await application.evaluate(({app})=>({isPackaged:app.isPackaged,appPath:app.getAppPath(),platform:process.platform,hardwareAcceleration:app.isHardwareAccelerationEnabled()}));
  assert(runtime.isPackaged);assert(runtime.appPath.endsWith("app.asar"));
  if(windows)assert.equal(runtime.hardwareAcceleration,false);
  await page.evaluate(async()=>{await paintplus.setTool("pencil");paintplus.width=1;});
  const box=await page.locator("#overlay").boundingBox();
  await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+80,box.y+30);await page.mouse.up();
  assert.deepEqual(await page.evaluate(()=>[...paintplus.doc.activeLayer.canvas.getContext("2d").getImageData(50,30,1,1).data]),[24,71,241,255]);
  await application.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},output);
  await page.evaluate(()=>desktop.chooseFolder("output"));
  const smoke=await page.evaluate(()=>paintplus.desktopSmoke());
  assert(smoke.clipboardOK);assert(smoke.collisionOK);assert(smoke.aiInferenceOK);assert(smoke.aiModel);
  await page.evaluate(()=>paintplus.demo());
  await mkdir("docs/screenshots",{recursive:true});
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}.png`});
  const log=await readFile(path.join(profile,"startup.log"),"utf8");
  assert(log.includes('"event":"renderer-ready"'));assert(!log.includes('"event":"resource-error"'));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const result={...runtime,installationPathHasSpacesAndUnicode:true,firstLaunchReady:true,pointerDrawing:true,...smoke,rendererErrors:errors,externalRequests:external};
  await writeFile(`docs/packaged-${windows?"windows":"linux"}-test-results.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} catch(error) {
  console.error(await readFile(path.join(profile,"startup.log"),"utf8").catch(()=>"No startup log."));
  await page.screenshot({path:"test-results/packaged-startup-failure.png"}).catch(()=>{});
  throw error;
} finally {
  await application.evaluate(({app})=>app.exit(0)).catch(()=>{});
}
