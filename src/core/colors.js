// Windows' classic colour picker uses H=0..239 and S/L=0..240.
export const clamp = (value, max) => Math.max(0, Math.min(max, Number(value) || 0));
export function rgbToHsl(red, green, blue) {
  const r=clamp(red,255)/255,g=clamp(green,255)/255,b=clamp(blue,255)/255;
  const high=Math.max(r,g,b),low=Math.min(r,g,b),delta=high-low,l=(high+low)/2;
  let h=0,s=0;
  if(delta){s=delta/(1-Math.abs(2*l-1));h=high===r?((g-b)/delta+6)%6:high===g?(b-r)/delta+2:(r-g)/delta+4;h/=6;}
  return {h:h*240,s:s*240,l:l*240};
}
export function hslToRgb(hue, saturation, luminance) {
  const h=((Number(hue)||0)%240+240)%240/40,s=clamp(saturation,240)/240,l=clamp(luminance,240)/240;
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(h%2-1)),m=l-c/2;
  const channels=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return channels.map(value=>Math.round((value+m)*255));
}
export const rgbHex = channels => '#'+channels.map(value=>Math.round(clamp(value,255)).toString(16).padStart(2,'0')).join('');
export const hexChannels = hex => [1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
export const basicColors = [
  '#ff8080','#ffff80','#80ff80','#00ff80','#80ffff','#0080ff','#ff80c0','#ff80ff',
  '#ff0000','#ffff00','#80ff00','#00ff40','#00ffff','#0080c0','#8080c0','#ff00ff',
  '#804040','#ff8040','#00ff00','#008080','#004080','#8080ff','#800040','#ff0080',
  '#800000','#ff8000','#008000','#008040','#0000ff','#0000a0','#800080','#8000ff',
  '#400000','#804000','#004000','#004040','#000080','#000040','#400040','#400080',
  '#000000','#808000','#808040','#808080','#408080','#c0c0c0','#400040','#ffffff',
];
