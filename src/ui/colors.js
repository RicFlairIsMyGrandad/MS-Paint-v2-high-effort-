import {basicColors,clamp,rgbToHsl,hslToRgb,rgbHex,hexChannels} from '../core/colors.js';

export function editColors(app, initial, apply) {
  let rgb=hexChannels(initial),hsl=rgbToHsl(...rgb),slot=0;if(hsl.s===0)hsl.h=160;
  const custom=Array.from({length:16},(_,index)=>app.prefs.customColors?.[index]||'#ffffff');
  const swatches=(colors,kind)=>colors.map((color,index)=>`<button type="button" class="classic-swatch" data-${kind}="${index}" style="background:${color}" aria-label="${kind==='basic'?'Basic':'Custom'} color ${index+1}: ${color}" title="${color}"></button>`).join('');
  const fields=[['Hue','h',239],['Sat','s',240],['Lum','l',240],['Red','r',255],['Green','g',255],['Blue','b',255]].map(([label,key,max])=>`<label class="color-field color-field-${key}">${label}: <input id="color-${key}" type="number" min="0" max="${max}" aria-label="${label==='Sat'?'Saturation':label==='Lum'?'Luminance':label}"></label>`).join('');
  const dialog=app.dialog('Edit Colors',`<div class="classic-colors"><div class="classic-left"><label>Basic colors:</label><div class="classic-swatches basic-colors">${swatches(basicColors,'basic')}</div><label>Custom colors:</label><div class="classic-swatches custom-colors">${swatches(custom,'custom')}</div><button type="button" class="define-colors" disabled>Define Custom Colors &gt;&gt;</button><div class="classic-confirm"><button id="colors-ok" type="button">OK</button><button id="colors-cancel" type="button">Cancel</button></div></div><div class="classic-right"><div class="color-spectrum"><canvas id="color-plane" width="176" height="188" role="slider" tabindex="0" aria-label="Hue and saturation" aria-valuemin="0" aria-valuemax="239"></canvas><i class="color-crosshair" aria-hidden="true"></i></div><div class="color-luminance"><canvas id="color-luminance" width="12" height="188" role="slider" tabindex="0" aria-label="Luminance slider" aria-valuemin="0" aria-valuemax="240"></canvas><i class="luminance-pointer" aria-hidden="true"></i></div><div class="color-preview"><div id="color-solid"></div><span>Color|Solid</span></div>${fields}<button id="colors-add" type="button">Add to Custom Colors</button></div></div>`);
  dialog.classList.add('classic-color-dialog');
  const find=selector=>dialog.querySelector(selector),plane=find('#color-plane'),ramp=find('#color-luminance');
  const planeContext=plane.getContext('2d'),image=planeContext.createImageData(plane.width,plane.height);
  for(let y=0;y<plane.height;y++)for(let x=0;x<plane.width;x++)image.data.set([...hslToRgb(x/(plane.width-1)*239,(1-y/(plane.height-1))*240,120),255],(y*plane.width+x)*4);
  planeContext.putImageData(image,0,0);
  const render=()=>{
    for(const[key,value]of Object.entries({...hsl,r:rgb[0],g:rgb[1],b:rgb[2]})){const field=find('#color-'+key);if(document.activeElement!==field)field.value=Math.round(Math.min(key==='h'?239:255,value));}
    find('#color-solid').style.background=rgbHex(rgb);
    const ctx=ramp.getContext('2d'),data=ctx.createImageData(1,ramp.height);
    for(let y=0;y<ramp.height;y++)data.data.set([...hslToRgb(hsl.h,hsl.s,(1-y/(ramp.height-1))*240),255],y*4);
    const strip=document.createElement('canvas');strip.width=1;strip.height=ramp.height;strip.getContext('2d').putImageData(data,0,0);ctx.drawImage(strip,0,0,ramp.width,ramp.height);
    find('.color-crosshair').style.left=Math.min(239,hsl.h)/239*175+'px';find('.color-crosshair').style.top=(1-hsl.s/240)*187+'px';
    find('.luminance-pointer').style.top=(1-hsl.l/240)*187+'px';
    plane.setAttribute('aria-valuenow',String(Math.round(hsl.h)));plane.setAttribute('aria-valuetext',`Hue ${Math.round(hsl.h)}, saturation ${Math.round(hsl.s)}`);ramp.setAttribute('aria-valuenow',String(Math.round(hsl.l)));
    for(const button of dialog.querySelectorAll('[data-basic]'))button.classList.toggle('chosen',button.style.backgroundColor===find('#color-solid').style.backgroundColor);
    for(const button of dialog.querySelectorAll('[data-custom]'))button.classList.toggle('chosen',Number(button.dataset.custom)===slot);
  };
  const fromRgb=()=>{const next=rgbToHsl(...rgb);if(next.s===0)next.h=hsl.h;hsl=next;render();};
  for(const key of ['h','s','l','r','g','b'])find('#color-'+key).addEventListener('input',event=>{
    if(event.target.value===''||!Number.isFinite(event.target.valueAsNumber))return;
    const value=Math.round(clamp(event.target.value,key==='h'?239:'sl'.includes(key)?240:255));event.target.value=value;
    if('hsl'.includes(key)){hsl[key]=value;rgb=hslToRgb(hsl.h,hsl.s,hsl.l);render();}else{rgb['rgb'.indexOf(key)]=value;fromRgb();}
  });
  const wireDrag=(node,update)=>{
    const change=event=>{const rect=node.getBoundingClientRect();update(clamp((event.clientX-rect.left)/rect.width,1),clamp((event.clientY-rect.top)/rect.height,1));rgb=hslToRgb(hsl.h,hsl.s,hsl.l);render();};
    node.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();node.focus();node.setPointerCapture(event.pointerId);change(event);});
    node.addEventListener('pointermove',event=>{if(node.hasPointerCapture(event.pointerId))change(event);});
    node.addEventListener('pointerup',event=>{if(node.hasPointerCapture(event.pointerId)){change(event);node.releasePointerCapture(event.pointerId);}});
  };
  wireDrag(plane,(x,y)=>{hsl.h=x*239;hsl.s=(1-y)*240;});wireDrag(ramp,(_,y)=>{hsl.l=(1-y)*240;});
  for(const node of [plane,ramp])node.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:1;
    if(node===ramp)hsl.l=event.key==='Home'?0:event.key==='End'?240:clamp(hsl.l+(['ArrowUp','ArrowRight'].includes(event.key)?step:-step),240);
    else if(event.key==='ArrowLeft'||event.key==='ArrowRight')hsl.h=clamp(hsl.h+(event.key==='ArrowRight'?step:-step),239);
    else hsl.s=event.key==='Home'?0:event.key==='End'?240:clamp(hsl.s+(event.key==='ArrowUp'?step:-step),240);
    rgb=hslToRgb(hsl.h,hsl.s,hsl.l);render();
  });
  dialog.addEventListener('click',event=>{const button=event.target.closest('[data-basic],[data-custom]');if(!button)return;if(button.dataset.custom!==undefined)slot=Number(button.dataset.custom);rgb=hexChannels(button.dataset.basic!==undefined?basicColors[Number(button.dataset.basic)]:custom[slot]);fromRgb();});
  find('#colors-add').onclick=()=>{custom[slot]=rgbHex(rgb);const button=find(`[data-custom="${slot}"]`);button.style.background=custom[slot];button.title=custom[slot];button.setAttribute('aria-label',`Custom color ${slot+1}: ${custom[slot]}`);app.prefs.customColors=[...custom];app.savePrefs();slot=(slot+1)%16;render();};
  find('#colors-ok').onclick=()=>{const value=rgbHex(rgb);app.closeDialog();apply(value);};find('#colors-cancel').onclick=()=>app.closeDialog();
  dialog.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase()))event.stopPropagation();if(event.key==='Enter'){event.preventDefault();event.stopPropagation();find('#colors-ok').click();}});
  render();return dialog;
}
