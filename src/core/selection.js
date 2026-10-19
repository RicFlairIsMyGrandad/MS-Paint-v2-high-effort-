// Binary pixel masks keep selection geometry independent of image alpha.
export function colorSelection(source, x, y, tolerance=0, contiguous=true) {
  const {width,height}=source, result=new Uint8Array(width*height);
  x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=width||y>=height)return result;
  tolerance=Math.max(0,Math.min(255,Number(tolerance)||0));
  const pixels=source.getContext('2d').getImageData(0,0,width,height).data,index=(y*width+x)*4,target=pixels.slice(index,index+4);
  const matches=position=>{const i=position*4;if(!target[3]&&!pixels[i+3])return true;return Math.abs(pixels[i]-target[0])<=tolerance&&Math.abs(pixels[i+1]-target[1])<=tolerance&&Math.abs(pixels[i+2]-target[2])<=tolerance&&Math.abs(pixels[i+3]-target[3])<=tolerance;};
  if(!contiguous){for(let p=0;p<result.length;p++)if(matches(p))result[p]=1;return result;}
  const stack=[x,y];
  while(stack.length){const row=stack.pop(),column=stack.pop();let left=column;
    while(left>=0&&!result[row*width+left]&&matches(row*width+left))left--;left++;
    let above=false,below=false;
    for(let px=left;px<width&&!result[row*width+px]&&matches(row*width+px);px++){
      result[row*width+px]=1;
      if(row>0){const p=(row-1)*width+px,m=!result[p]&&matches(p);if(m&&!above)stack.push(px,row-1);above=m;}
      if(row+1<height){const p=(row+1)*width+px,m=!result[p]&&matches(p);if(m&&!below)stack.push(px,row+1);below=m;}
    }
  }
  return result;
}
export function combineMasks(previous,next,mode='new') {
  const out=new Uint8Array(next.length);
  for(let i=0;i<out.length;i++){const a=!!previous?.[i],b=!!next[i];out[i]=Number(mode==='add'?a||b:mode==='subtract'?a&&!b:mode==='intersect'?a&&b:b);}
  return out;
}
export function maskBounds(mask,width,height) {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return right<left?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};
}
