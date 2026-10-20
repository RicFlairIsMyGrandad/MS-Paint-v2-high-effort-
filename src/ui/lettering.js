import sheets from '../../assets/lettering/sheet-layout.json';
import bundledSamples from '../../assets/lettering/grade-mouse-samples.json';
import {imageCanvas} from '../core/project.js';
import {extractLetteringSheet,validateLetteringAtlas,letteringLayout,letteringSource,reconcileLettering,shuffleLettering} from '../core/lettering.js';

const urls=[new URL('../../assets/lettering/01-Uppercase-BLANK.png',import.meta.url).href,new URL('../../assets/lettering/02-Lowercase-BLANK.png',import.meta.url).href,new URL('../../assets/lettering/03-Digits-Symbols-BLANK.png',import.meta.url).href];
const defaults={letterSize:36,letterSpacing:0,wordSpacing:12,lineGap:8,riseMax:0};
export class LetteringEditor{
  constructor(app){
    this.app=app;this.defaults={...defaults};
    for(const key of Object.keys(defaults))if(Number.isFinite(app.prefs.letteringStyle?.[key]))this.defaults[key]=app.prefs.letteringStyle[key];
    try{if(app.prefs.letteringSamples)validateLetteringAtlas(app.prefs.letteringSamples);}catch{app.prefs.letteringSamples=null;}
    app.prefs.letteringSamples??=bundledSamples;
    this.node=document.createElement('div');this.node.contentEditable='true';this.node.id='lettering-content';this.node.className='lettering-editor hidden';this.node.spellcheck=false;this.node.setAttribute('role','textbox');this.node.setAttribute('aria-multiline','true');this.node.setAttribute('aria-label','Canvas handwriting');app.editor.stage.append(this.node);
    this.range={start:0,end:0};
    Object.defineProperties(this.node,{value:{get:()=>this.node.innerText.replace(/\u200b/g,''),set:value=>{this.node.textContent=value+(value.endsWith('\n')?'\u200b':'');}},selectionStart:{get:()=>this.captureRange().start},selectionEnd:{get:()=>this.captureRange().end}});
    this.node.setSelectionRange=(start,end)=>{
      const nodes=[],walk=document.createTreeWalker(this.node,NodeFilter.SHOW_TEXT);while(walk.nextNode())nodes.push(walk.currentNode);
      const find=offset=>{for(const n of nodes){if(offset<=n.length)return[n,offset];offset-=n.length;}return nodes.length?[nodes.at(-1),nodes.at(-1).length]:[this.node,0];};
      const tail=start===end&&start===this.node.value.length&&this.node.value.endsWith('\n')&&nodes.length;
      const[a,x]=tail?[nodes.at(-1),nodes.at(-1).length]:find(start),[b,y]=tail?[a,x]:find(end),r=document.createRange();r.setStart(a,x);r.setEnd(b,y);window.getSelection().removeAllRanges();window.getSelection().addRange(r);this.range={start,end};
    };
    this.caret=document.createElement('div');this.caret.className='lettering-caret hidden';app.editor.stage.append(this.caret);
    this.node.addEventListener('input',()=>{const o=this.object;if(!o)return;const text=this.node.value;if(this.node.textContent.replace(/\u200b/g,'')!==text||this.node.textContent.includes('\u200b')&&!text.endsWith('\n')||text.endsWith('\n')&&!this.node.textContent.endsWith('\u200b')){this.node.value=text;this.node.setSelectionRange(text.length,text.length);}this.update({text,letteringChoices:reconcileLettering(o.text,text,o.letteringChoices,o.letteringAtlas)});});
    const insert=text=>{const{start,end}=this.captureRange(),value=this.node.value;this.node.value=value.slice(0,start)+text+value.slice(end);this.node.setSelectionRange(start+text.length,start+text.length);this.node.dispatchEvent(new Event('input',{bubbles:true}));};
    this.node.addEventListener('beforeinput',event=>{
      if(['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();insert('\n');}
      else if(event.inputType.startsWith('delete')){
        event.preventDefault();const value=this.node.value;let{start,end}=this.captureRange();
        if(start===end){
          if(/Backward$/.test(event.inputType))start-=event.inputType.includes('Word')?(value.slice(0,start).match(/\s*\S+\s*$/)?.[0].length||0):(Array.from(value.slice(0,start)).at(-1)?.length||0);
          else if(/Forward$/.test(event.inputType))end+=event.inputType.includes('Word')?(value.slice(end).match(/^\s*\S+\s*/)?.[0].length||0):(Array.from(value.slice(end))[0]?.length||0);
        }
        this.node.setSelectionRange(start,end);insert('');
      }
    });
    this.node.addEventListener('paste',event=>{event.preventDefault();insert(event.clipboardData.getData('text/plain').replace(/\r\n?/g,'\n'));});
    document.addEventListener('selectionchange',()=>{if(this.active&&this.node.contains(window.getSelection()?.anchorNode)){this.captureRange();this.position();app.editor.requestRender();}});
    for(const event of ['keyup','select','click','focus'])this.node.addEventListener(event,()=>{this.position();app.editor.requestRender();});
    this.node.addEventListener('keydown',event=>{if(event.key==='Escape'||event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.stopPropagation();this.finish();}});
    this.node.addEventListener('pointerdown',event=>{
      const o=this.object;if(!o)return;
      const p=app.editor.point(event),handle=app.editor.handleAt(p),local=app.editor.localTextPoint(o,p),edge=4/app.zoom;
      if(handle&&(handle.type!=='move'||local.x<edge||local.y<edge||local.x>o.width-edge||local.y>o.height-edge)){event.preventDefault();event.stopPropagation();app.editor.pointerDown(event);return;}
      event.preventDefault();const layout=letteringLayout(o);let best=Infinity,index=0;
      for(let i=0;i<layout.carets.length;i++){const c=layout.carets[i];if(!c)continue;const distance=(local.x-c.x)**2+4*(local.y-(c.baseline-layout.ascent/2))**2;if(distance<best){best=distance;index=i;}}
      this.node.focus({preventScroll:true});this.node.setSelectionRange(index,index);this.position();
    });
    for(const[id,key]of[['lettering-size','letterSize'],['lettering-spacing','letterSpacing'],['lettering-word-spacing','wordSpacing'],['lettering-line-gap','lineGap'],['lettering-rise','riseMax']])document.getElementById(id).addEventListener('input',event=>{const v=Number(event.target.value);if(event.target.value!==''&&Number.isFinite(v))this.changeStyle({[key]:v});});
    document.getElementById('lettering-shuffle').addEventListener('pointerdown',e=>e.preventDefault());
    document.getElementById('lettering-shuffle').addEventListener('click',()=>this.shuffle());
    document.getElementById('lettering-import').addEventListener('click',()=>this.importDialog());
    document.addEventListener('pointerdown',event=>{
      if(!this.active||event.target.closest('#lettering-content,#lettering-ribbon,.colors-group,#menu,#modal-root,.tabs,#canvas-stage,#viewport,.zoom-controls'))return;
      this.finish(app.prefs.selectionMode==='paint');
    },true);
    this.syncControls();
  }
  get active(){return !!this.object;}
  captureRange(){const s=window.getSelection();if(!s?.rangeCount||!this.node.contains(s.anchorNode)||!this.node.contains(s.focusNode))return this.range;const r=s.getRangeAt(0),prefix=r.cloneRange();prefix.selectNodeContents(this.node);prefix.setEnd(r.startContainer,r.startOffset);const start=prefix.toString().replace(/\u200b/g,'').length;return this.range={start,end:start+r.toString().replace(/\u200b/g,'').length};}
  get object(){return this.app.doc.objects.find(o=>o.id===this.objectId);}
  get target(){return this.object||this.app.doc.selectedObjects.find(o=>o.type==='lettering');}
  get ready(){return !!this.app.prefs.letteringSamples;}
  async importDialog(){
    const app=this.app,loaded=this.app.prefs.letteringSamples?.glyphs||{},pending={},kinds=['uppercase','lowercase','symbols'];
    app.dialog('Load your mouse lettering',`<p>Select your completed PNG sheets. Original pixels and rough edges are kept; the blue guides are removed automatically. This is a local import.</p>${['Uppercase A–Z','Lowercase a–z','Digits and punctuation'].map((name,i)=>`<div class="lettering-file-row"><label for="lettering-file-${kinds[i]}">${name}</label><input id="lettering-file-${kinds[i]}" type="file" accept="image/png"><span id="lettering-file-status-${i}"></span></div>`).join('')}<p id="lettering-import-status" role="status">${Object.keys(loaded).length} characters already loaded. Select one or more sheets; unchosen character sets are retained.</p><p>Use the original 1000 px-wide PNGs from the template pack, without resizing. Phrase sheets are references, not individual character sheets.</p>`,[{label:'Cancel',run:()=>app.closeDialog()},{label:'Use these samples',primary:true,run:()=>{
      if(Object.values(pending).some(v=>v?.loading))throw Error('Wait for the PNG sheets to finish loading.');
      if(Object.values(pending).some(v=>v?.error))throw Error('Choose a valid completed PNG for each selected sheet.');
      if(!Object.keys(pending).length)throw Error('Choose at least one completed PNG sheet.');
      const atlas={version:1,glyphs:{...loaded}};
      for(const[index,result]of Object.entries(pending)){for(const cell of sheets.sheets[Number(index)].cells)delete atlas.glyphs[cell.character];Object.assign(atlas.glyphs,result.glyphs);}
      validateLetteringAtlas(atlas);app.prefs.letteringSamples=atlas;app.savePrefs();app.closeDialog();this.syncControls();app.toast(`${Object.keys(atlas.glyphs).length} handwriting characters loaded. Draw a lettering box to type.`);
    }}]);
    for(let i=0;i<3;i++)document.getElementById('lettering-file-'+kinds[i]).addEventListener('change',async event=>{
      const file=event.target.files[0],status=document.getElementById('lettering-file-status-'+i);if(!file){delete pending[i];return;}
      pending[i]={loading:true};status.textContent='Reading…';let url;
      try{
        const header=new Uint8Array(await file.slice(0,8).arrayBuffer());if(![137,80,78,71,13,10,26,10].every((v,j)=>v===header[j]))throw Error('Choose a PNG file.');
        url=URL.createObjectURL(file);const source=await imageCanvas(url),blank=await imageCanvas(urls[i]),glyphs=extractLetteringSheet(source,blank,sheets.sheets[i]);
        pending[i]={glyphs};status.textContent=`${Object.keys(glyphs).length} characters ready`;
      }catch(error){pending[i]={error:error.message};status.textContent=error.message;}finally{if(url)URL.revokeObjectURL(url);}
    });
  }
  begin(object=null,rect={x:20,y:20,width:300,height:100}){
    if(this.active&&this.object===object){this.node.focus();return;}
    if(!object&&!this.ready){this.importDialog();return;}
    this.app.textEditor.finish();this.finish();const app=this.app,d=app.doc,layer=object?d.layers.find(l=>l.objects.includes(object)):d.activeLayer;
    if(!layer||layer.locked||!layer.visible)return app.toast('Show and unlock this layer before adding lettering.');
    this.creationBefore=object?null:d.metadata();this.before=d.metadata();this.creationDirty=d.dirty;d.activeLayerId=layer.id;
    if(!object){const props={...this.defaults,type:'lettering',draft:true,text:'',letteringChoices:[],letteringAtlas:app.prefs.letteringSamples,textBoxWidth:Math.max(30,Math.round(rect.width)),minHeight:Math.max(30,Math.round(rect.height)),x:Math.round(rect.x),y:Math.round(rect.y),ink:app.paintColor(1),resampling:'nearest'};
      const source=letteringSource(props);d.assertAllocation(source.width*source.height*12);d.inTransaction=true;try{object=d.insert(source,'Mouse lettering',false,props);}finally{d.inTransaction=false;}}
    else app.closeObjectSession();
    d.selected=[object.id];this.objectId=object.id;this.modified=false;this.node.value=object.text;this.node.classList.remove('hidden');app.tool='lettering';app.switchTab('lettering');this.syncControls();app.changedUI();this.node.focus({preventScroll:true});this.node.setSelectionRange(object.text.length,object.text.length);this.position();
  }
  update(patch){
    const o=this.object;if(!o)return;
    try{const candidate={...o,...patch,resampling:'nearest'},layout=letteringLayout(candidate);this.app.doc.assertAllocation(layout.width*layout.height*12);const source=letteringSource(candidate);Object.assign(o,candidate,{source,width:source.width,height:source.height});this.modified=true;this.app.doc.dirty=true;this.position();this.syncControls();this.app.changedUI();}
    catch(error){this.node.value=o.text;this.app.toast(error.message);}
  }
  changeStyle(patch){
    const bounds={letterSize:[1,288],letterSpacing:[-100,200],wordSpacing:[0,500],lineGap:[-100,500],riseMax:[0,100]};
    for(const[k,[min,max]]of Object.entries(bounds))if(k in patch)patch[k]=Math.max(min,Math.min(max,Math.round(patch[k])));
    Object.assign(this.defaults,Object.fromEntries(Object.entries(patch).filter(([k])=>k in defaults)));this.app.prefs.letteringStyle={...this.defaults};this.app.savePrefs();
    if(this.active)this.update(patch);
    else if(this.target&&this.app.selectedEditable())this.app.doc.action('Format mouse lettering',()=>{for(const o of this.app.doc.selectedObjects.filter(o=>o.type==='lettering')){const candidate={...o,...patch},layout=letteringLayout(candidate);this.app.doc.assertAllocation(layout.width*layout.height*12);const source=letteringSource(candidate);Object.assign(o,candidate,{source,width:source.width,height:source.height});}});
    this.syncControls();this.app.changedUI();
  }
  shuffle(){const o=this.target;if(!o||!o.text)return;const patch={letteringChoices:shuffleLettering(o)};
    if(this.active){
      if(this.creationBefore||this.modified)this.app.recordTransform(this.creationBefore||this.before,this.creationBefore?'New mouse lettering':'Edit mouse lettering');
      this.creationBefore=null;this.app.closeObjectSession();
      this.app.doc.action('Shuffle mouse lettering',()=>{const candidate={...o,...patch};Object.assign(o,candidate,{source:letteringSource(candidate)});});
      this.before=this.app.doc.metadata();this.modified=false;this.position();this.node.focus({preventScroll:true});
    }
    else this.app.doc.action('Shuffle mouse lettering',()=>{const candidate={...o,...patch};Object.assign(o,candidate,{source:letteringSource(candidate)});});this.app.changedUI();
  }
  syncControls(){const props=this.target||this.defaults;
    for(const[id,k]of[['lettering-size','letterSize'],['lettering-spacing','letterSpacing'],['lettering-word-spacing','wordSpacing'],['lettering-line-gap','lineGap'],['lettering-rise','riseMax']]){const field=document.getElementById(id);if(field&&document.activeElement!==field)field.value=props[k]??defaults[k];}
    const status=document.getElementById('lettering-status'),atlas=this.target?.letteringAtlas||this.app.prefs.letteringSamples;
    if(status){const missing=this.target?letteringLayout(this.target).missing:[];status.textContent=missing.length?'Missing samples: '+missing.join(' '):atlas?`${Object.keys(atlas.glyphs).length} sampled characters · original pixels`:'Load your completed PNG sheets to begin';}
    document.getElementById('lettering-shuffle').disabled=!this.target?.text;
  }
  position(){const o=this.object;if(!o){this.node.classList.add('hidden');this.caret.classList.add('hidden');this.objectId=null;return;}const zoom=this.app.zoom,layout=letteringLayout(o),caret=layout.carets[this.node.selectionStart]||layout.carets.at(-1)||{x:3,y:3};
    const radians=(o.angle||0)*Math.PI/180,tx=o.x+o.width/2-o.width/2*Math.cos(radians)+o.height/2*Math.sin(radians),ty=o.y+o.height/2-o.width/2*Math.sin(radians)-o.height/2*Math.cos(radians);
    Object.assign(this.node.style,{left:tx*zoom+'px',top:ty*zoom+'px',width:o.width+'px',height:o.height+'px',transform:`rotate(${o.angle||0}deg) scale(${zoom})`,transformOrigin:'0 0'});
    // A caret at the real bitmap character position; no substitute font is used.
    const angle=(o.angle||0)*Math.PI/180,dx=caret.x-o.width/2,dy=caret.y-o.height/2;
    Object.assign(this.caret.style,{left:(o.x+o.width/2+dx*Math.cos(angle)-dy*Math.sin(angle))*zoom+'px',top:(o.y+o.height/2+dx*Math.sin(angle)+dy*Math.cos(angle))*zoom+'px',height:Math.max(3,layout.ascent*zoom)+'px',background:o.ink==='transparent'?'#000':o.ink,transform:`rotate(${o.angle||0}deg)`});
    this.caret.classList.toggle('hidden',document.activeElement!==this.node||this.node.selectionStart!==this.node.selectionEnd);
  }
  paintSelection(ctx){if(!this.active||this.node.selectionStart===this.node.selectionEnd)return;const o=this.object,layout=letteringLayout(o);ctx.save();ctx.translate(o.x+o.width/2,o.y+o.height/2);ctx.rotate((o.angle||0)*Math.PI/180);ctx.translate(-o.width/2,-o.height/2);ctx.fillStyle='#087bea40';for(const p of layout.positions)if(p.index>=this.node.selectionStart&&p.index<this.node.selectionEnd)ctx.fillRect(p.x,p.y,p.width,p.height);ctx.restore();}
  finish(commit=false){if(!this.active)return;const app=this.app,d=app.doc,o=this.object;this.objectId=null;this.node.classList.add('hidden');this.caret.classList.add('hidden');this.node.blur();if(!o)return;
    if(!o.text.trim()){if(this.creationBefore){d.restore(this.creationBefore);d.dirty=this.creationDirty;}else d.restore(this.before);}
    else if(this.modified||this.creationBefore){
      const previous=d.history.undoStack.at(-1);
      if(this.creationBefore&&previous?.sessionOpen&&previous.sessionKey===app.sessionKey()){previous.before=this.creationBefore;previous.label='New mouse lettering';app.updateSession(previous);}
      else app.recordTransform(this.creationBefore||this.before,this.creationBefore?'New mouse lettering':'Edit mouse lettering');
    }
    this.creationBefore=null;app.tool='lettering';app.switchTab('home');app.changedUI();if(commit&&d.selectedObjects.length)app.finishSelection();
  }
}
