import { textSource, textLayout } from '../core/editable.js';
import { runStyle, runStyleKeys, textRuns, coalesceRuns, formatRuns, fontCSS } from '../core/rich-text.js';
const defaults = { font: 'Segoe UI', fontSize: 12, fontUnit: 'pt', bold: false, italic: false, underline: false, strikeout: false, opaque: false, bubble: false, bubbleWidth: 3, padding: 12, lineGap: 0 };
const bundled = ['Caveat','Inter','Lora','Merriweather','Pacifico','Roboto Mono'];
const standard = ['Segoe UI','Arial','Calibri','Cambria','Candara','Consolas','Constantia','Corbel','Georgia','Times New Roman','Verdana','Tahoma','Trebuchet MS','Courier New','Comic Sans MS','Impact','Palatino Linotype','Book Antiqua','Century Gothic','Garamond','Lucida Console','Lucida Sans Unicode'];
export class TextEditor {
  constructor(app) {
    this.app = app;this.defaults = {...defaults};this.selection={start:0,end:0};
    const saved=app.prefs.textStyle;
    if(saved && typeof saved==='object')for(const key of Object.keys(defaults))if(typeof saved[key]===typeof defaults[key] && (typeof saved[key]!=='number'||Number.isFinite(saved[key])))this.defaults[key]=saved[key];
    if(saved?.fontSize && saved.fontUnit!=='pt')this.defaults.fontSize=Math.round(saved.fontSize*72/96*100)/100;
    this.defaults.fontUnit='pt';
    this.node=document.createElement('div');this.node.id='text-content';this.node.contentEditable='true';this.node.setAttribute('role','textbox');this.node.setAttribute('aria-label','Canvas text');this.node.setAttribute('aria-multiline','true');this.node.spellcheck=false;this.node.className='inline-text-editor hidden';app.editor.stage.append(this.node);
    this.node.addEventListener('input',()=>{const selection=this.captureSelection(),runs=this.readRuns();this.typingStyle=null;this.update({text:runs.map(run=>run.text).join(''),textRuns:runs});this.rebuild(selection);});
    this.node.addEventListener('beforeinput',event=>{if(['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();this.insertPlainText('\n');}});
    this.node.addEventListener('paste',event=>{event.preventDefault();this.insertPlainText(event.clipboardData.getData('text/plain'));});
    this.node.addEventListener('keydown',event=>{if(event.key==='Escape'||event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.stopPropagation();this.finish();}});
    document.addEventListener('selectionchange',()=>{if(this.active&&this.node.contains(window.getSelection()?.anchorNode)){this.captureSelection();this.syncControls();}});
    for(const[id,property]of[['text-font','font'],['text-size','fontSize'],['text-bubble-width','bubbleWidth'],['text-padding','padding'],['text-line-gap','lineGap']])document.getElementById(id).addEventListener('input',event=>this.changeStyle({[property]:property==='font'?event.target.value:Number(event.target.value)}));
    for(const[id,property]of[['text-opaque','opaque'],['text-bubble','bubble']])document.getElementById(id).addEventListener('change',event=>this.changeStyle({[property]:event.target.checked}));
    for(const button of document.querySelectorAll('[data-text-style]')){button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',()=>{const key=button.dataset.textStyle;this.changeStyle({[key]:!this.properties[key]});});}
    document.getElementById('text-font-favorite').addEventListener('click',()=>{const font=document.getElementById('text-font').value;app.prefs.favoriteFonts=app.prefs.favoriteFonts.includes(font)?app.prefs.favoriteFonts.filter(value=>value!==font):[...app.prefs.favoriteFonts,font];app.savePrefs();this.populateFonts();this.syncControls();});
    document.addEventListener('pointerdown',event=>{if(!this.active||event.target.closest('#text-content,#text-ribbon,.colors-group,#menu,#modal-root,.tabs'))return;this.finish();},true);
    this.systemFonts=standard;this.populateFonts();
    window.desktop?.fonts?.().then(fonts=>{if(Array.isArray(fonts)&&fonts.length)this.systemFonts=fonts;this.populateFonts();this.syncControls();}).catch(()=>{});
    this.syncControls();
  }
  get active(){return !!this.objectId;}
  get object(){return this.app.doc.objects.find(object=>object.id===this.objectId);}
  get properties(){
    const object=this.object||this.app.doc.selectedObjects.find(object=>object.type==='text');
    if(!object)return this.defaults;
    let offset=0;const index=this.selection.start===this.selection.end?Math.max(0,this.selection.start-1):this.selection.start;
    const run=this.active?textRuns(object).find(run=>{const match=index<offset+run.text.length;offset+=run.text.length;return match;}):null;
    const properties={...object,...run};if(properties.fontUnit!=='pt'){properties.fontSize=Math.round(properties.fontSize*72/96*100)/100;properties.fontUnit='pt';}return properties;
  }
  populateFonts(){
    const field=document.getElementById('text-font'),value=field.value||this.properties.font,favorites=this.app.prefs.favoriteFonts||[],fonts=[...new Set([...this.systemFonts,...bundled.map(name=>'PaintPlus '+name),value,...favorites])].filter(Boolean).sort((a,b)=>a.localeCompare(b));
    field.replaceChildren();
    for(const[label,list]of[['Favorites',favorites],['Available fonts',fonts.filter(font=>!favorites.includes(font))]]){
      if(!list.length)continue;const group=document.createElement('optgroup');group.label=label;
      for(const font of list){const option=document.createElement('option');option.value=font;option.textContent=font;group.append(option);}field.append(group);
    }
    field.value=value;
  }
  captureSelection(){
    const selected=window.getSelection();if(!selected?.rangeCount||!this.node.contains(selected.anchorNode)||!this.node.contains(selected.focusNode))return this.selection;
    const range=selected.getRangeAt(0),prefix=range.cloneRange();prefix.selectNodeContents(this.node);prefix.setEnd(range.startContainer,range.startOffset);
    const start=prefix.toString().replace(/\u200b/g,'').length;this.selection={start,end:start+range.toString().replace(/\u200b/g,'').length};return this.selection;
  }
  insertPlainText(text){
    this.restoreSelection(this.captureSelection());const selected=window.getSelection(),range=selected.getRangeAt(0),node=document.createTextNode(text);
    range.deleteContents();range.insertNode(node);range.setStart(node,text.length);range.collapse(true);selected.removeAllRanges();selected.addRange(range);
    this.node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
  }
  restoreSelection(selection){
    const nodes=[];const walk=document.createTreeWalker(this.node,NodeFilter.SHOW_TEXT);while(walk.nextNode())nodes.push(walk.currentNode);
    const find=offset=>{for(const node of nodes){if(offset<=node.textContent.length)return[node,offset];offset-=node.textContent.length;}return[nodes.at(-1)||this.node,nodes.at(-1)?.textContent.length||0];};
    const range=document.createRange(),[a,x]=find(selection.start),[b,y]=find(selection.end);range.setStart(a,x);range.setEnd(b,y);const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);this.selection={...selection};
  }
  readRuns(){
    const runs=[],base=runStyle(this.object||this.defaults);
    const visit=(node,style)=>{
      if(node.nodeType===Node.TEXT_NODE){runs.push({...style,text:node.textContent.replace(/\u200b/g,'')});return;}
      if(node.nodeName==='BR'){runs.push({...style,text:'\n'});return;}
      let next=style;if(node.dataset?.textStyle){try{next={...style,...JSON.parse(node.dataset.textStyle)};}catch{}}
      for(const child of node.childNodes){if(['DIV','P'].includes(child.nodeName)&&runs.length&&runs.at(-1).text.slice(-1)!=='\n')runs.push({...next,text:'\n'});visit(child,next);}
    };
    visit(this.node,base);return coalesceRuns(runs);
  }
  span(run){const span=document.createElement('span');span.textContent=run.text;span.dataset.textStyle=JSON.stringify(runStyle(run));span.style.font=fontCSS(run);span.style.lineHeight=`calc(1.15em + ${Number(this.object?.lineGap)||0}px)`;return span;}
  rebuild(selection=this.selection){if(!this.object)return;this.node.replaceChildren(...textRuns(this.object).map(run=>this.span(run)));if(!this.node.childNodes.length)this.node.append(this.span({...runStyle(this.object),text:''}));this.restoreSelection(selection);this.position();}
  begin(object=null,rect={x:20,y:20,width:260,height:60}){
    if(this.active&&this.objectId===object?.id){this.node.focus();return;}this.finish();
    const doc=this.app.doc,layer=object?doc.layers.find(layer=>layer.objects.includes(object)):doc.activeLayer;
    if(!layer||layer.locked||!layer.visible){this.app.toast('Show and unlock this layer before editing text.');return;}
    doc.activeLayerId=layer.id;this.creationBefore=object?null:doc.metadata();this.creationDirty=doc.dirty;
    if(!object){const props={...this.defaults,type:'text',text:'',textRuns:[],x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),minHeight:this.defaults.bubble?1:Math.round(rect.height),textColor:this.app.color1,background:this.app.color2,bubbleColor:this.app.color1,resampling:'nearest'};
      doc.assertAllocation(rect.width*rect.height*24);const source=textSource(props);props.height=source.height;doc.inTransaction=true;try{object=doc.insert(source,'Text',false,props);}finally{doc.inTransaction=false;}}
    doc.selected=[object.id];this.before=doc.metadata();this.objectId=object.id;this.modified=false;this.app.tool='text';this.node.classList.remove('hidden');this.selection={start:object.text?.length||0,end:object.text?.length||0};
    this.rebuild();this.app.switchTab('text');this.syncControls();this.app.changedUI();this.node.focus();this.restoreSelection(this.selection);
  }
  update(patch){
    const object=this.object;if(!object)return;
    try{const candidate={...object,...patch,x:Math.round(object.x),y:Math.round(object.y),resampling:'nearest'},layout=textLayout(candidate);this.app.doc.assertAllocation(layout.width*layout.height*24);const source=textSource(candidate);Object.assign(object,candidate,{source,width:source.width,height:source.height});this.modified=true;this.app.doc.dirty=true;this.position();this.syncControls();this.app.changedUI();}catch(error){this.app.toast(error.message);}
  }
  changeStyle(patch){
    if('fontSize'in patch){patch.fontSize=Math.max(1,Math.min(384,patch.fontSize||12));patch.fontUnit='pt';}
    if('padding'in patch)patch.padding=Math.max(0,Math.min(100,patch.padding||0));if('lineGap'in patch)patch.lineGap=Math.max(-100,Math.min(200,patch.lineGap||0));if('bubbleWidth'in patch)patch.bubbleWidth=Math.max(1,Math.min(32,patch.bubbleWidth||3));
    Object.assign(this.defaults,patch);this.app.prefs.textStyle={...this.defaults};this.app.savePrefs();
    const inline=Object.keys(patch).some(key=>runStyleKeys.includes(key));
    if(this.active){
      const selected=this.captureSelection(),object=this.object;
      const globalPatch=Object.fromEntries(Object.entries(patch).filter(([key])=>!runStyleKeys.includes(key)));
      if(inline && Object.keys(globalPatch).length)this.update(globalPatch);
      if(inline){
        if(selected.end>selected.start){const runs=formatRuns(textRuns(object),selected.start,selected.end,patch);this.update({textRuns:runs,...(selected.start===0&&selected.end===object.text.length?patch:{})});this.rebuild(selected);}
        else{
          const style={...runStyle(this.properties),...patch},span=this.span({...style,text:'\u200b'});this.restoreSelection(selected);const range=window.getSelection().getRangeAt(0);range.insertNode(span);range.setStart(span.firstChild,1);range.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
          this.typingStyle=style;this.position();this.syncControls();
        }
      }else{this.update({...patch,...(patch.bubble===true?{minHeight:1}:{})});this.rebuild(selected);}
    }else{
      const targets=this.app.doc.selectedObjects.filter(object=>object.type==='text');if(targets.length&&this.app.selectedEditable())this.app.doc.action('Format text',()=>{for(const object of targets){const candidate={...object,...patch,textRuns:inline?formatRuns(textRuns(object),0,object.text.length,patch):object.textRuns};if(patch.bubble)candidate.minHeight=1;const layout=textLayout(candidate);this.app.doc.assertAllocation(layout.width*layout.height*24);const source=textSource(candidate);Object.assign(object,candidate,{source,width:source.width,height:source.height});}});
    }
    this.syncControls();this.app.changedUI();
  }
  syncControls(){const props=this.typingStyle&&this.active&&this.selection.start===this.selection.end?{...this.properties,...this.typingStyle}:this.properties;
    for(const[id,key]of[['text-font','font'],['text-size','fontSize'],['text-bubble-width','bubbleWidth'],['text-padding','padding'],['text-line-gap','lineGap']]){const field=document.getElementById(id);if(document.activeElement!==field)field.value=props[key]??defaults[key];}
    document.getElementById('text-opaque').checked=!!props.opaque;document.getElementById('text-bubble').checked=!!props.bubble;
    for(const button of document.querySelectorAll('[data-text-style]')){const value=!!props[button.dataset.textStyle];button.classList.toggle('selected',value);button.setAttribute('aria-pressed',String(value));}
    const favorite=this.app.prefs.favoriteFonts.includes(props.font),button=document.getElementById('text-font-favorite');button.classList.toggle('selected',favorite);button.setAttribute('aria-pressed',String(favorite));button.title=favorite?'Unpin font':'Pin font to Favorites';
  }
  position(){const object=this.object;if(!object)return;const layout=textLayout(object),zoom=this.app.zoom,angle=(object.angle||0)*Math.PI/180,dx=-object.width/2,dy=-object.height/2,x=object.x+object.width/2+dx*Math.cos(angle)-dy*Math.sin(angle),y=object.y+object.height/2+dx*Math.sin(angle)+dy*Math.cos(angle);
    Object.assign(this.node.style,{left:x*zoom+'px',top:y*zoom+'px',width:object.width+'px',height:object.height*(object.bubble?.76:1)+'px',padding:layout.padding+'px',font:layout.font,lineHeight:`calc(1.15em + ${Number(object.lineGap)||0}px)`,color:'transparent',caretColor:this.properties.textColor||'#000000',transform:`rotate(${object.angle||0}deg) scale(${zoom})`,transformOrigin:'0 0'});
  }
  finish(){if(!this.active)return;const doc=this.app.doc,object=this.object;this.objectId=null;this.typingStyle=null;this.node.classList.add('hidden');this.node.blur();if(!object)return;
    if(!(object.text||'').trim()){if(this.creationBefore){doc.restore(this.creationBefore);doc.dirty=this.creationDirty;}else{doc.restore(this.before);doc.selected=[object.id];doc.deleteSelected();}}
    else if(this.modified||this.creationBefore){const before=this.creationBefore||this.before,after=doc.metadata();doc.history.push({label:this.creationBefore?'New text box':'Edit text',resources:[...new Set([...doc.resources(before),...doc.resources(after)])],undo:()=>doc.restore(before),redo:()=>doc.restore(after)});}
    this.creationBefore=null;this.app.tool=this.app.selectionOrigin||'select';this.app.switchTab('home');this.app.changedUI();
  }
}
