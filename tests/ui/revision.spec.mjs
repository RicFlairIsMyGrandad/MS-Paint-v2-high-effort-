import { test, expect } from '@playwright/test';
async function reset(page,w=400,h=300){
  await page.goto('/');await page.waitForFunction(()=>window.paintplus);
  await page.evaluate(async({w,h})=>{const {PaintDocument}=await import('/src/core/document.js');paintplus.doc=new PaintDocument(w,h,()=>paintplus.changedUI());paintplus.zoom=1;paintplus.prefs.aspectLock=false;paintplus.changedUI();},{w,h});
  await expect.poll(()=>page.locator('#display').evaluate(e=>e.width)).toBe(w);
}
async function drag(page,a,b){const r=await page.locator('#display').boundingBox(),z=await page.evaluate(()=>paintplus.zoom);await page.mouse.move(r.x+a[0]*z,r.y+a[1]*z);await page.mouse.down();await page.mouse.move(r.x+b[0]*z,r.y+b[1]*z,{steps:10});await page.mouse.up();}
const pixel=(page,x,y)=>page.evaluate(({x,y})=>[...paintplus.doc.composite().getContext('2d').getImageData(x,y,1,1).data],{x,y});
async function selection(page){await page.evaluate(()=>{const ctx=paintplus.doc.activeLayer.canvas.getContext('2d');ctx.fillStyle='#1847f1';ctx.fillRect(35,35,15,15);});await drag(page,[30,30],[60,60]);}
test('zoom buttons, wheel and slider use only fixed Paint levels and pixelated image display',async({page})=>{
  await reset(page);const expected=['12.5%','25%','50%','100%','200%','300%','400%','500%','600%','700%','800%'];
  for(let i=0;i<expected.length;i++){await page.locator('#zoom-slider').fill(String(i));await expect(page.locator('#zoom-percent')).toHaveText(expected[i]);}
  await page.locator('[data-action=zoom-in]').last().click();await expect(page.locator('#zoom-percent')).toHaveText('800%');
  await page.locator('[data-action=zoom-out]').last().click();await expect(page.locator('#zoom-percent')).toHaveText('700%');
  await expect(page.locator('#display')).toHaveCSS('image-rendering','pixelated');
  const r=await page.locator('#viewport').boundingBox();await page.mouse.move(r.x+80,r.y+80);await page.keyboard.down('Control');await page.mouse.wheel(0,-80);await page.keyboard.up('Control');await expect(page.locator('#zoom-percent')).toHaveText('800%');
});
test('screen overlay keeps seven-pixel handles at 100% and 400%, without huge allocations',async({page})=>{
  await reset(page);await selection(page);
  const samples=[];for(const zoom of [1,4]){await page.evaluate(z=>{paintplus.editor.setZoom(z);paintplus.editor.viewport.scrollLeft=0;paintplus.editor.viewport.scrollTop=0;paintplus.editor.render();},zoom);await expect(page.locator('#zoom-percent')).toHaveText(zoom*100+'%');
    samples.push(await page.evaluate(()=>{const canvas=paintplus.editor.overlay,ctx=canvas.getContext('2d'),o=paintplus.doc.selectedObjects[0],z=paintplus.zoom;let n=0;for(let x=Math.round((o.x+o.width/2)*z)-10;x<Math.round((o.x+o.width/2)*z)+10;x++){const d=ctx.getImageData(x,Math.round(o.y*z),1,1).data;if(d[3]===255&&d[0]===255&&d[1]===255)n++;}return{n,width:canvas.width,css:canvas.clientWidth};}));
  }
  expect(samples.map(s=>s.n)).toEqual([5,5]);expect(samples[1].width).toBe(samples[1].css);expect(samples[1].width).toBeLessThan(1600);
});
test('brush main button selects default or last brush and only its arrow opens the menu',async({page})=>{
  await reset(page);await page.locator('.brush-button').click();expect(await page.evaluate(()=>paintplus.brush)).toBe('round');await expect(page.locator('#menu')).toBeHidden();
  await page.locator('.brush-menu-button').click();await page.getByRole('button',{name:'Marker brush',exact:true}).click();await page.keyboard.press('3');await page.locator('.brush-button').click();expect(await page.evaluate(()=>[paintplus.tool,paintplus.brush])).toEqual(['brush','marker']);await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#width-label')).toHaveCSS('font-weight','700');
});
test('selection buttons are equal, transparency has a number shortcut and Crop is absent from mappings',async({page})=>{
  await reset(page);const boxes=await page.locator('.selection-buttons button').evaluateAll(buttons=>buttons.map(b=>[b.clientWidth,b.clientHeight]));expect(boxes[0]).toEqual(boxes[1]);
  await page.keyboard.press('8');await expect(page.locator('#selection-transparent')).toBeChecked();await page.keyboard.press('8');await expect(page.locator('#selection-transparent')).not.toBeChecked();
  await page.locator('.shortcuts-panel [data-action=shortcuts]').first().click();expect(await page.locator('[data-shortcut="8"]').inputValue()).toBe('transparent');await expect(page.locator('[data-shortcut] option[value=crop]')).toHaveCount(0);
});
test('editable shapes transform, change stroke width/fill and retain exact undo state',async({page})=>{
  await reset(page);await expect(page.locator('#outline')).toBeDisabled();await page.locator('[data-shape=rectangle]').click();await drag(page,[50,50],[150,110]);
  expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].type)).toBe('shape');await expect(page.locator('#outline')).toBeEnabled();
  await page.keyboard.press('Control+NumpadAdd');expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].shapeStyle.width)).toBe(5);
  await page.locator('[data-color="#ff7f27"]').click({button:'right'});await page.locator('#shape-fill').selectOption('solid');expect(await pixel(page,100,80)).toEqual([255,127,39,255]);
  const bounds=await page.evaluate(()=>{const o=paintplus.doc.selectedObjects[0];return[o.x+o.width,o.y+o.height];});await drag(page,bounds,[bounds[0]+40,bounds[1]+25]);
  expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].width)).toBeGreaterThan(140);
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].width)).toBeLessThan(130);
  await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>paintplus.doc.objects.length)).toBe(0);expect(await page.evaluate(()=>paintplus.tool)).toBe('select');
});
test('Paint selections move immediately, click outside commits, and Enter returns the originating tool',async({page})=>{
  await reset(page);await selection(page);expect(await page.evaluate(()=>paintplus.tool)).toBe('select');await drag(page,[43,43],[143,43]);expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].x)).toBe(130);
  const r=await page.locator('#display').boundingBox();await page.mouse.click(r.x+250,r.y+200);expect(await page.evaluate(()=>[paintplus.doc.objects.length,paintplus.tool])).toEqual([0,'select']);expect(await pixel(page,140,40)).toEqual([24,71,241,255]);
  await page.keyboard.press('1');await drag(page,[130,30],[165,65]);await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>paintplus.doc.objects.length)).toBe(0);expect(await page.evaluate(()=>paintplus.tool)).toBe('free');
});
test('persistent selection mode keeps floating content after clicking outside',async({page})=>{
  await reset(page);await page.locator('#home-ribbon [data-action=settings]').click();await page.locator('#pref-selection-mode').selectOption('persistent');await page.getByRole('button',{name:'Save settings',exact:true}).click();await selection(page);
  const r=await page.locator('#display').boundingBox();await page.mouse.click(r.x+250,r.y+200);expect(await page.evaluate(()=>paintplus.doc.objects.length)).toBe(1);expect(await page.evaluate(()=>paintplus.doc.selected.length)).toBe(0);
  await page.mouse.click(r.x+45,r.y+45);expect(await page.evaluate(()=>paintplus.doc.selected.length)).toBe(1);
});
test('Shift arrow moves one pixel and stamps a trail with undo; Shift drag leaves a continuous trail',async({page})=>{
  await reset(page);await page.locator('#selection-transparent').check();await selection(page);await page.keyboard.press('Shift+ArrowRight');expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].x)).toBe(31);
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].x)).toBe(30);expect(await pixel(page,36,36)).toEqual([24,71,241,255]);
  await page.keyboard.down('Shift');await drag(page,[43,43],[143,43]);await page.keyboard.up('Shift');expect(await pixel(page,90,40)).toEqual([24,71,241,255]);
  await page.keyboard.press('Control+z');expect(await pixel(page,90,40)).toEqual([255,255,255,255]);expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].x)).toBe(30);
});
test('row bin and Delete remove layers instantly, including clearing the last layer, with undo',async({page})=>{
  await reset(page);await page.locator('[data-action=new-layer]').click();await expect(page.locator('.layer-row')).toHaveCount(2);await page.locator('.layer-row.active .delete-layer-row').click();await expect(page.locator('.layer-row')).toHaveCount(1);await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Control+z');await expect(page.locator('.layer-row')).toHaveCount(2);await page.locator('.layer-row.active .layer-name').click();await page.keyboard.press('Delete');await expect(page.locator('.layer-row')).toHaveCount(1);
  await page.locator('.layer-row .layer-name').click();const id=await page.evaluate(()=>paintplus.doc.activeLayerId);await page.keyboard.press('Delete');expect(await page.evaluate(()=>paintplus.doc.layers.length)).toBe(1);expect(await page.evaluate(()=>paintplus.doc.activeLayerId)).not.toBe(id);await page.keyboard.press('Control+z');expect(await page.evaluate(()=>paintplus.doc.activeLayerId)).toBe(id);
});
test('canvas ribbon dimensions extend boundaries without scaling and undo does not edit the filename',async({page})=>{
  await reset(page);await page.keyboard.press('3');await drag(page,[20,30],[100,30]);await page.locator('#canvas-width').fill('450');await page.locator('#canvas-height').fill('350');await page.locator('[data-action=apply-canvas-size]').click();expect(await page.evaluate(()=>[paintplus.doc.width,paintplus.doc.height])).toEqual([450,350]);expect(await pixel(page,60,30)).toEqual([24,71,241,255]);
  await page.locator('#filename').fill('Keep this filename');await page.locator('#filename').press('Control+z');expect(await page.evaluate(()=>[paintplus.doc.width,paintplus.doc.height])).toEqual([400,300]);await expect(page.locator('#filename')).toHaveValue('Keep this filename');await page.locator('#filename').press('Control+y');expect(await page.evaluate(()=>paintplus.doc.width)).toBe(450);
});
test('large paste expands by default as one undo action and the setting preserves canvas bounds',async({page})=>{
  await reset(page);await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=500;c.height=420;paintplus.clipboard=c;await paintplus.paste();});expect(await page.evaluate(()=>[paintplus.doc.width,paintplus.doc.height,paintplus.doc.history.undoStack.length])).toEqual([500,420,1]);await page.keyboard.press('Control+z');expect(await page.evaluate(()=>[paintplus.doc.width,paintplus.doc.objects.length])).toEqual([400,0]);
  await page.locator('#home-ribbon [data-action=settings]').click();await page.locator('#pref-grow-paste').uncheck();await page.getByRole('button',{name:'Save settings',exact:true}).click();await page.evaluate(()=>paintplus.paste());expect(await page.evaluate(()=>[paintplus.doc.width,paintplus.doc.selectedObjects[0].width])).toEqual([400,500]);
});
test('inline textbox uses contextual formatting, rounded bubble padding/spacing and grows while typing',async({page})=>{
  await reset(page);await page.keyboard.press('5');await drag(page,[30,30],[210,90]);await expect(page.locator('#text-content')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('#text-ribbon')).toBeVisible();
  await page.locator('#text-content').fill('This is an example of the kind of spacing I want within a speech bubble.');await page.locator('#text-bubble').check();await page.locator('[data-text-style=bold]').click();await page.locator('#text-padding').fill('14');await page.locator('#text-line-gap').fill('6');const first=await page.evaluate(()=>paintplus.doc.selectedObjects[0].height);
  await page.locator('#text-content').fill('This is an example of the kind of spacing I want within a speech bubble.\nNow another line of words to expand it.');expect(await page.evaluate(()=>paintplus.doc.selectedObjects[0].height)).toBeGreaterThan(first);
  await page.locator('[data-action=finish-text]').click();const properties=await page.evaluate(()=>{const o=paintplus.doc.selectedObjects[0];return[o.type,o.bubble,o.padding,o.lineGap,o.bold,o.text];});expect(properties.slice(0,5)).toEqual(['text',true,14,6,true]);
  await page.evaluate(()=>paintplus.editText(paintplus.doc.selectedObjects[0]));await expect(page.locator('#text-content')).toHaveValue(properties[5]);await page.locator('#text-content').fill('Edited after finishing');await page.locator('#text-content').press('Control+Enter');expect(await page.evaluate(()=>paintplus.doc.objects[0].text)).toBe('Edited after finishing');await page.keyboard.press('Control+z');expect(await page.evaluate(()=>paintplus.doc.objects[0].text)).toBe(properties[5]);
});
test('text remains editable after outside click and resizing; project reopen retains all formatting',async({page})=>{
  await reset(page);await page.keyboard.press('5');await drag(page,[30,30],[230,90]);await page.locator('#text-content').fill('Editable words that should wrap neatly when resized.');await page.locator('#text-bubble').check();const r=await page.locator('#display').boundingBox();await page.mouse.click(r.x+350,r.y+250);
  const box=await page.evaluate(()=>{const o=paintplus.doc.objects[0];paintplus.doc.selected=[o.id];paintplus.changedUI();return[o.x+o.width,o.y+o.height];});await drag(page,box,[box[0]-70,box[1]+20]);expect(await page.evaluate(()=>paintplus.doc.objects[0].text)).toContain('Editable words');
  const restored=await page.evaluate(async()=>{const{serialize,deserialize}=await import('/src/core/project.js');const doc=await deserialize(serialize(paintplus.doc));paintplus.doc=doc;paintplus.changedUI();return[doc.objects[0].text,doc.objects[0].bubble,doc.objects[0].width];});expect(restored[1]).toBe(true);expect(restored[2]).toBeLessThan(200);await page.evaluate(()=>paintplus.editText(paintplus.doc.objects[0]));await expect(page.locator('#text-content')).toHaveValue(restored[0]);
});
test('asset width and folder splitters resize and persist, categories can be removed',async({page})=>{
  await reset(page);for(const [id,dx,dy]of[['assets-width-splitter',90,0],['asset-splitter',0,-70]]){const r=await page.locator('#'+id).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:5});await page.mouse.up();}
  expect(await page.evaluate(()=>[paintplus.prefs.assetsWidth,paintplus.prefs.categoriesHeight])).toEqual([370,176]);await page.reload();await page.waitForFunction(()=>window.paintplus);expect((await page.locator('#assets-panel').boundingBox()).width).toBe(370);expect((await page.locator('#categories').boundingBox()).height).toBe(176);
  await page.locator('[data-category=characters]').click();await page.locator('[data-category=characters]').click({button:'right'});await page.getByRole('button',{name:'Remove category from library',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('[data-category=characters]')).toHaveCount(0);await page.reload();await page.waitForFunction(()=>window.paintplus);await expect(page.locator('[data-category=all]')).toHaveClass(/active/);await expect(page.locator('.asset-card')).toHaveCount(8);
});
test('external copy preserves secondary-color pixels as opaque colors instead of black',async({page})=>{
  await reset(page);const result=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=20;c.height=20;const ctx=c.getContext('2d');ctx.fillStyle='#ffeedd';ctx.fillRect(0,0,20,20);paintplus.color2='#ffeedd';paintplus.doc.insert(c,'Keyed image',false,{transparentColor:'#ffeedd'});let copied;window.desktop={copyImage:async url=>{copied=url;}};await paintplus.copy();const{imageCanvas}=await import('/src/core/project.js');const output=await imageCanvas(copied);delete window.desktop;return[...output.getContext('2d').getImageData(10,10,1,1).data];});expect(result).toEqual([255,238,221,255]);
});
test('refinement is nonmodal, threshold can restore details and softness changes pixels',async({page})=>{
  await reset(page);await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=40;const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,40,40);const o=paintplus.doc.insert(c,'Mask test',false),probability=new Float32Array(1600).fill(.07);const initial=document.createElement('canvas');initial.width=40;initial.height=40;o.source=initial;paintplus.refineAlphaDialog(o,c,probability);paintplus.changedUI();});
  await page.locator('#alpha-threshold').fill('1');expect((await pixel(page,10,10))[0]).toBe(255);expect(await page.evaluate(()=>paintplus.doc.objects[0].source.getContext('2d').getImageData(0,0,1,1).data[3])).toBe(255);
  await page.locator('#alpha-softness').fill('50');expect(await page.evaluate(()=>paintplus.doc.objects[0].source.getContext('2d').getImageData(0,0,1,1).data[3])).toBeLessThan(255);await page.locator('[data-action=zoom-in]').last().click();await expect(page.locator('#zoom-percent')).toHaveText('200%');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>paintplus.doc.objects[0].source.getContext('2d').getImageData(0,0,1,1).data[3])).toBe(0);
});

test('malformed saved shortcut preferences recover to defaults without a blank startup',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('paintplus-settings',JSON.stringify({preferences:{shortcuts:'broken old setting',zoom:.73}})));
  await page.goto('/');await page.waitForFunction(()=>window.paintplus);
  expect(await page.evaluate(()=>paintplus.prefs.shortcuts)).toEqual(['select','free','brush','pencil','fill','text','shape','dropper','transparent','move']);
  await expect(page.locator('#zoom-percent')).toHaveText('50%');await expect(page.locator('#startup-status')).toHaveCount(0);
});
