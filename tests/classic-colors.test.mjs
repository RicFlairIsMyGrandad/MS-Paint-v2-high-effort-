import test from 'node:test';
import assert from 'node:assert/strict';
import {rgbToHsl,hslToRgb,rgbHex,basicColors} from '../src/core/colors.js';
test('classic HSL scale matches primary colors and white/black luminance endpoints',()=>{
 assert.deepEqual(rgbToHsl(255,0,0),{h:0,s:240,l:120});assert.deepEqual(rgbToHsl(0,255,0),{h:80,s:240,l:120});assert.deepEqual(rgbToHsl(0,0,255),{h:160,s:240,l:120});
 assert.deepEqual(hslToRgb(160,240,120),[0,0,255]);assert.equal(rgbHex(hslToRgb(40,240,120)),'#ffff00');assert.equal(rgbHex(hslToRgb(80,240,0)),'#000000');assert.equal(rgbHex(hslToRgb(80,240,240)),'#ffffff');assert.equal(rgbHex(hslToRgb(0,0,120)),'#808080');
});
test('classic color controls preserve every basic and sampled RGB color through precise HSL conversion',()=>{
 for(let r=0;r<256;r+=17)for(let g=0;g<256;g+=17)for(let b=0;b<256;b+=17){const {h,s,l}=rgbToHsl(r,g,b);assert.deepEqual(hslToRgb(h,s,l),[r,g,b]);}
 assert.equal(basicColors.length,48);assert.ok(basicColors.every(value=>/^#[0-9a-f]{6}$/.test(value)));
});
