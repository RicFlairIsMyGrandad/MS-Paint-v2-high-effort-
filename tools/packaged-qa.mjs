import { _electron as electron } from "@playwright/test";
import { mkdtemp, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import {paletteChecks} from './palette-packaged-qa.mjs';
import {precisionChecks} from './precision-packaged-qa.mjs';
import {linkedChecks} from './linked-packaged-qa.mjs';
import {alphaChecks} from './alpha-packaged-qa.mjs';
import {wandChecks} from './wand-packaged-qa.mjs';
import {letteringChecks} from './lettering-packaged-qa.mjs';
const windows = process.platform === "win32";
const version=JSON.parse(await readFile('package.json','utf8')).version;
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
  assert.deepEqual(await page.evaluate(()=>[paintplus.doc.width,paintplus.doc.height]),[731,411]);
  await page.locator(".asset-card img").evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  const runtime = await application.evaluate(({app})=>({isPackaged:app.isPackaged,appPath:app.getAppPath(),platform:process.platform,gpuStatus:app.getGPUFeatureStatus()}));
  assert(runtime.isPackaged);assert(runtime.appPath.endsWith("app.asar"));
  if(windows)assert.notEqual(runtime.gpuStatus.gpu_compositing,"enabled");
  await page.evaluate(async()=>{await paintplus.setTool("pencil");paintplus.width=1;});
  const box=await page.locator("#overlay").boundingBox();
  await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+80,box.y+30);await page.mouse.up();
  assert.deepEqual(await page.evaluate(()=>[...paintplus.doc.activeLayer.canvas.getContext("2d").getImageData(50,30,1,1).data]),[24,71,241,255]);
  const palette=await paletteChecks(page),precision=await precisionChecks(page),linked=await linkedChecks(page),alpha=await alphaChecks(page),wand=await wandChecks(page),lettering=await letteringChecks(page);
  // Exercise the revised editor in the installed ASAR, including the native
  // external clipboard path rather than the browser's in-app copy fallback.
  await page.evaluate(()=>{paintplus.width=3;paintplus.editor.createShape('rectangle',{x:140,y:60},{x:240,y:120},{width:3,color:'#000000',background:'#ffffff',outline:'solid',fill:'none'});});
  await page.keyboard.press('Control+NumpadAdd');
  assert.equal(await page.evaluate(()=>paintplus.doc.selectedObjects[0].shapeStyle.width),4);
  await page.evaluate(()=>paintplus.finishSelection());
  await page.evaluate(()=>paintplus.editText(null,{x:100,y:140}));
  await page.locator('#text-content').fill('Editable speech bubble\nInstalled Windows test');
  await page.locator('#text-bubble').check();
  await page.locator('#text-line-gap').fill('5');
  await page.locator('#text-background-white').check();
  await page.locator('#text-padding-x').fill('18');await page.locator('#text-padding-y').fill('8');
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}-text.png`});
  await page.locator('[data-action=finish-text]').click();
  assert.deepEqual(await page.evaluate(()=>{const o=paintplus.doc.selectedObjects[0];return[o.type,o.bubble,o.lineGap,o.text];}),['text',true,5,'Editable speech bubble\nInstalled Windows test']);
  await page.evaluate(()=>paintplus.editText(paintplus.doc.selectedObjects[0]));
  await page.locator('#text-content').fill('Re-edited on canvas');
  await page.locator('#text-content').press('Control+Enter');
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(()=>paintplus.doc.selectedObjects[0].text),'Editable speech bubble\nInstalled Windows test');
  await page.evaluate(()=>paintplus.editText(paintplus.doc.selectedObjects[0]));
  await page.evaluate(()=>paintplus.textEditor.restoreSelection({start:0,end:8}));
  await page.locator('#text-size').fill('');await page.locator('#text-size').press('2');await page.locator('#text-size').press('4');
  assert.equal(await page.locator('#text-size').evaluate(node=>document.activeElement===node),true);
  assert.equal(await page.evaluate(()=>paintplus.doc.selectedObjects[0].text),'Editable speech bubble\nInstalled Windows test');
  const richRuns=await page.evaluate(()=>paintplus.doc.selectedObjects[0].textRuns);
  assert.equal(richRuns[0].text,'Editable');assert.equal(richRuns[0].fontSize,24);
  assert.equal(await page.evaluate(()=>document.fonts.check('16px "PaintPlus Inter"')),true);
  await page.evaluate(()=>paintplus.editor.render());
  const typingPixels=await page.evaluate(()=>paintplus.editor.display.toDataURL());
  await page.locator('#text-content').press('Control+Enter');await page.evaluate(()=>paintplus.editor.render());
  assert.equal(await page.evaluate(()=>paintplus.editor.display.toDataURL()),typingPixels);
  const availableFonts=await page.evaluate(()=>desktop.fonts());assert(availableFonts.length>6);
  if(windows){
    const PE=await import('pe-library'),R=await import('resedit');
    const entries=PE.NtExecutableResource.from(PE.NtExecutable.from(await readFile(original),{ignoreCert:true})).entries;
    const strings=R.Resource.VersionInfo.fromEntries(entries)[0].getStringValues({lang:1033,codepage:1200});
    assert.equal(strings.ProductName,'PaintPlus');assert.equal(strings.FileVersion,`${version}.0`);
    const groups=R.Resource.IconGroupEntry.fromEntries(entries);assert(groups.every(group=>group.getIconItemsFromEntries(entries).length===7));
  }
  await page.evaluate(()=>paintplus.editText(paintplus.doc.selectedObjects[0]));
  await page.locator('#text-bubble-shadow').check();await page.locator('#text-shadow-offset').fill('3');
  assert.equal(await page.evaluate(()=>{const o=paintplus.doc.selectedObjects[0],pixels=o.source.getContext('2d').getImageData(0,0,o.source.width,o.source.height).data;return Array.from({length:pixels.length/4},(_,index)=>index*4).some(i=>pixels[i]===128&&pixels[i+1]===128&&pixels[i+2]===128&&pixels[i+3]===255);}),true);
  const imageBox=await page.locator('#display').boundingBox();await page.mouse.click(imageBox.x+400,imageBox.y+360);
  assert.equal(await page.evaluate(()=>paintplus.doc.objects.length),0);
  const eye=page.locator('.layer-row .visibility').first();await eye.click();assert.equal(await eye.getAttribute('aria-pressed'),'false');await eye.click();assert.equal(await eye.getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>paintplus.doc.selectRegion({x:140,y:60,width:100,height:60},null,null,paintplus.color2));
  await page.mouse.click(imageBox.x+160,imageBox.y+80,{button:'right'});
  await page.locator('#menu').getByRole('button',{name:'Cut into new layer',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>{const o=paintplus.doc.selectedObjects[0],layer=paintplus.doc.activeLayer;return[layer.canvas.width,layer.canvas.height,o.x,o.y,...layer.canvas.getContext('2d').getImageData(730,410,1,1).data];}),[731,411,140,60,255,255,255,255]);
  await page.evaluate(()=>paintplus.finishSelection());
  await page.evaluate(()=>paintplus.switchTab('home'));
  const externalCopy = await page.evaluate(async()=>{
    const source=document.createElement('canvas');source.width=20;source.height=20;
    const ctx=source.getContext('2d');ctx.fillStyle='#ffeedd';ctx.fillRect(0,0,20,20);
    paintplus.color2='#ffeedd';paintplus.doc.insert(source,'Color 2 clipboard',false,{transparentColor:'#ffeedd'});
    await paintplus.copy();const image=new Image();image.src=await desktop.pasteImage();await image.decode();
    ctx.clearRect(0,0,20,20);ctx.drawImage(image,0,0);paintplus.color2='#ffffff';return [...ctx.getImageData(10,10,1,1).data];
  });
  assert.deepEqual(externalCopy,[255,238,221,255]);
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
  if (!windows) {
    await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1920,1080));
    await page.waitForFunction(()=>innerWidth===1920);
  }
  await page.evaluate(()=>{paintplus.doc.dirty=false;return paintplus.demo();});
  assert.deepEqual(await page.evaluate(()=>[paintplus.doc.width,paintplus.doc.height]),[1200,800]);
  assert.equal(await page.evaluate(()=>paintplus.doc.layers.every(layer=>layer.canvas.width===paintplus.doc.width&&layer.canvas.height===paintplus.doc.height)),true);
  await page.evaluate(()=>{paintplus.editor.setZoom(1);paintplus.editor.viewport.scrollLeft=0;paintplus.editor.viewport.scrollTop=0;});
  await mkdir("docs/screenshots",{recursive:true});
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}.png`});
  await page.evaluate(()=>paintplus.resizeDialog());
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}-dialog.png`});
  await page.evaluate(x=>{paintplus.closeDialog();paintplus.doc.selected=[];paintplus.color1='#000000';paintplus.textEditor.defaults.fontSize=16;paintplus.doc.addLayer('Speech');paintplus.editText(null,{x,y:160});},windows?100:620);
  await page.locator('#text-content').fill('Fixed-size corners & tail.\nSharp text: fgjkpqrwyz');
  await page.locator('#text-bubble').check();await page.locator('#text-background-white').check();await page.locator('#text-bubble-shadow').check();await page.locator('#text-shadow-offset').fill('3');await page.locator('#text-content').press('Control+a');await page.locator('[data-text-style=bold]').click();await page.locator('[data-text-style=underline]').click();
  await page.evaluate(()=>{const length=paintplus.doc.selectedObjects[0].text.length;paintplus.textEditor.restoreSelection({start:length,end:length});});
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}-text.png`});
  await page.locator('[data-action=finish-text]').click();
  if (!windows) await writeFile('docs/SpeechExample.paintplus',await page.evaluate(async()=>new TextDecoder().decode(await paintplus.exportBytes('paintplus'))));
  await page.evaluate(()=>paintplus.colorDialog('#ffffff'));
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}-colors.png`});
  await page.evaluate(()=>paintplus.closeDialog());
  const log=await readFile(path.join(profile,"startup.log"),"utf8");
  assert(log.includes('"event":"renderer-ready"'));assert(!log.includes('"event":"resource-error"'));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const catalog=log.trim().split('\n').map(line=>JSON.parse(line)).find(event=>event.event==='font-catalog');
  assert(catalog?.count>6);assert.equal(catalog.count,availableFonts.length);
  const result={...runtime,version,installationPathHasSpacesAndUnicode:true,firstLaunchReady:true,defaultCanvasDimensions:true,pointerDrawing:true,editableShapes:true,inlineSpeechText:true,richTextFormatting:true,typingPixelsUnchanged:true,fontSizeInputTwoDigits:true,bubbleShadow:true,outsideClickCommits:true,selectionContextMenu:true,color2CutLayer:true,layerVisibilityOneClick:true,bundledFonts:true,systemFontCatalog:true,brandedExecutableIcons:windows,externalCopyPreservesColor2:true,clipboardAlpha:true,savedPNGBytes:true,savedEditableProject:true,...smoke,rendererErrors:errors,externalRequests:external};
  result.fontCatalogSource=catalog.source;result.fontCatalogCount=catalog.count;
  Object.assign(result,palette,precision,linked,alpha,wand,lettering);
  await writeFile(`docs/packaged-${windows?"windows":"linux"}-test-results.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} catch(error) {
  await page.evaluate(()=>paintplus.colorDialog('#ffffff'));
  await page.screenshot({path:`docs/screenshots/packaged-${windows?"windows":"linux"}-colors.png`});
  await page.evaluate(()=>paintplus.closeDialog());
  const log=await readFile(path.join(profile,"startup.log"),"utf8").catch(()=>"No startup log.");
  console.error(log);
  await writeFile(`docs/packaged-${windows?"windows":"linux"}-test-results.json`,JSON.stringify({error:error.message,stack:error.stack,log},null,2));
  await page.screenshot({path:"test-results/packaged-startup-failure.png"}).catch(()=>{});
  throw error;
} finally {
  await application.evaluate(({app})=>app.exit(0)).catch(()=>{});
}
