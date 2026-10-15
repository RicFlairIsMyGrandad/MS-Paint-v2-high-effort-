import { textSource, textLayout } from '../core/editable.js';
import { runStyle, runStyleKeys, textRuns, coalesceRuns, formatRuns, fontCSS } from '../core/rich-text.js';
const defaults = { font: 'Segoe UI', fontSize: 12, fontUnit: 'pt', bold: false, italic: false, underline: false, strikeout: false, opaque: false, bubble: false, bubbleWidth: 3, padding: 12, lineGap: 0, bubbleShadow: false, shadowOffset: 3, tailWidth:18, tailPosition:28, tailTipX:14, tailTipY:24 };
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
    this.node.addEventListener('input',()=>{const selection=this.captureSelection(),runs=this.readRuns();this.typingStyle=null;this.typingAnchor=null;this.update({text:runs.map(run=>run.text).join(''),textRuns:runs});this.rebuild(selection);});
    this.node.addEventListener('focus',()=>{if(this.active&&!this.restoringRange)this.restoreSelection(this.selection);});
    this.node.addEventListener('beforeinput',event=>{if(['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();this.insertPlainText('\n');}});
    this.node.addEventListener('paste',event=>{event.preventDefault();this.insertPlainText(event.clipboardData.getData('text/plain'));});
    this.node.addEventListener('keydown',event=>{if(event.key==='Escape'||event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.stopPropagation();this.finish();}});
    document.addEventListener('selectionchange',()=>{if(this.active&&this.node.contains(window.getSelection()?.anchorNode)){this.captureSelection();this.syncControls();}});
    for(const[id,property]of[['text-font','font'],['text-size','fontSize'],['text-bubble-width','bubbleWidth'],['text-padding','padding'],['text-line-gap','lineGap'],['text-shadow-offset','shadowOffset'],['text-tail-width','tailWidth'],['text-tail-position','tailPosition']])document.getElementById(id).addEventListener('input',event=>{
      const value=property==='font'?event.target.value:Number(event.target.value);
      if(property!=='font'&&(!event.target.value.trim()||!Number.isFinite(value)))return;
      if(property==='fontSize')this.sizeNavigating=false;
      this.changeStyle({[property]:value});
    });
    for(const[id,property]of[['text-opaque','opaque'],['text-bubble','bubble'],['text-bubble-shadow','bubbleShadow']])document.getElementById(id).addEventListener('change',event=>this.changeStyle({[property]:event.target.checked}));
    this.setupSizeMenu();
    this.node.addEventListener('contextmenu',event=>this.app.editor.contextMenu(event));
    this.node.addEventListener('pointerdown',event=>{
      const point=this.app.editor.point(event),handle=this.app.editor.handleAt(point),object=this.object;
      if(!handle||!object||event.button!==0)return;
      const {x,y}=this.app.editor.localTextPoint(object,point),edge=4/this.app.zoom;
      if(handle.type!=='move'||x<edge||y<edge||x>object.width-edge||y>object.height-edge){event.stopPropagation();this.app.editor.pointerDown(event);}
    });
    this.node.addEventListener('pointermove',event=>{
      const point=this.app.editor.point(event),handle=this.app.editor.handleAt(point),object=this.object;
      if(!object)return;const{x,y}=this.app.editor.localTextPoint(object,point),edge=4/this.app.zoom;
      if(handle&&(handle.type!=='move'||x<edge||y<edge||x>object.width-edge||y>object.height-edge)){this.app.editor.updateCursor(point);this.node.style.cursor=this.app.editor.overlay.style.cursor;}
      else this.node.style.cursor='text';
    });
    for(const button of document.querySelectorAll('button[data-text-style]')){button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',()=>{const key=button.dataset.textStyle;this.changeStyle({[key]:!this.properties[key]});});}
    document.getElementById('text-font-favorite').addEventListener('click',()=>{const font=document.getElementById('text-font').value;app.prefs.favoriteFonts=app.prefs.favoriteFonts.includes(font)?app.prefs.favoriteFonts.filter(value=>value!==font):[...app.prefs.favoriteFonts,font];app.savePrefs();this.populateFonts();this.syncControls();});
    document.addEventListener('pointerdown',event=>{
      if(!event.target.closest('.font-size-combo,#text-size-options'))this.hideSizeMenu();
      if(!this.active||event.target.closest('#text-content,#text-ribbon,#text-size-options,.colors-group,#menu,#modal-root,.tabs'))return;
      if(event.target.closest('#canvas-stage'))return;
      this.finish(this.app.prefs.selectionMode==='paint');
    },true);
    this.systemFonts=standard;this.populateFonts();
    window.desktop?.fonts?.().then(fonts=>{if(Array.isArray(fonts)&&fonts.length)this.systemFonts=fonts;this.populateFonts();this.syncControls();}).catch(()=>{});
    this.syncControls();
  }
  setupSizeMenu() {
    this.sizes=[8,9,10,11,12,14,16,18,20,22,24,26,28,36,48,72];
    const field=document.getElementById('text-size'),toggle=document.getElementById('text-size-toggle');
    this.sizeMenu=document.createElement('div');this.sizeMenu.id='text-size-options';this.sizeMenu.className='font-size-options popup hidden';this.sizeMenu.setAttribute('role','listbox');this.sizeMenu.setAttribute('aria-label','Font sizes');document.body.append(this.sizeMenu);
    for(const size of this.sizes) {
      const option=document.createElement('button');option.type='button';option.textContent=size;option.dataset.size=size;option.setAttribute('role','option');
      option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>{field.value=size;this.changeStyle({fontSize:size});this.hideSizeMenu();this.node.focus();this.restoreSelection(this.selection);});this.sizeMenu.append(option);
    }
    field.addEventListener('click',()=>this.showSizeMenu());
    toggle.addEventListener('pointerdown',event=>event.preventDefault());toggle.addEventListener('click',()=>this.sizeMenu.classList.contains('hidden')?this.showSizeMenu():this.hideSizeMenu());
    field.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp') {
        event.preventDefault();if(this.sizeMenu.classList.contains('hidden'))this.showSizeMenu();else{this.sizeNavigating=true;this.sizeIndex=Math.max(0,Math.min(this.sizes.length-1,this.sizeIndex+(event.key==='ArrowDown'?1:-1)));this.markSize();}
      } else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.hideSizeMenu();}
      else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();const value=!this.sizeNavigating?Number(field.value):this.sizes[this.sizeIndex];if(Number.isFinite(value)&&value>0){field.value=value;this.changeStyle({fontSize:value});}this.hideSizeMenu();if(this.active){this.node.focus();this.restoreSelection(this.selection);}}
    });
  }
  markSize(){for(const option of this.sizeMenu.children){const selected=Number(option.dataset.size)===this.sizes[this.sizeIndex];option.classList.toggle('selected',selected);option.setAttribute('aria-selected',String(selected));}this.sizeMenu.children[this.sizeIndex]?.scrollIntoView({block:'nearest'});}
  showSizeMenu(){const field=document.getElementById('text-size'),rect=field.getBoundingClientRect();this.sizeNavigating=false;this.sizeIndex=Math.max(0,this.sizes.indexOf(Number(field.value)));this.sizeMenu.classList.remove('hidden');Object.assign(this.sizeMenu.style,{left:rect.left+'px',top:rect.bottom+'px',maxHeight:Math.max(80,Math.min(380,innerHeight-rect.bottom-12))+'px'});field.setAttribute('aria-expanded','true');this.markSize();}
  hideSizeMenu(){this.sizeMenu?.classList.add('hidden');document.getElementById('text-size').setAttribute('aria-expanded','false');}
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
    const find=offset=>{for(const node of nodes){const length=node.textContent.replace(/\u200b/g,'').length;if(offset<=length){let raw=0,visible=0;while(raw<node.textContent.length&&(visible<offset||node.textContent[raw]==='\u200b')){if(node.textContent[raw]!=='\u200b')visible++;raw++;}return[node,raw];}offset-=length;}return[nodes.at(-1)||this.node,nodes.at(-1)?.textContent.length||0];};
    const atTyping=selection.start===selection.end&&this.typingAnchor?.node.isConnected&&selection.start===this.typingAnchor.index,
      atEndLine=selection.start===selection.end&&this.endLineMarker?.isConnected&&selection.start===this.object?.text.length;
    const range=document.createRange(),[a,x]=atTyping?[this.typingAnchor.node,this.typingAnchor.node.textContent.length]:atEndLine?[this.endLineMarker,1]:find(selection.start),[b,y]=atTyping||atEndLine?[a,x]:find(selection.end);range.setStart(a,x);range.setEnd(b,y);const selected=window.getSelection();this.restoringRange=true;selected.removeAllRanges();selected.addRange(range);this.restoringRange=false;this.selection={...selection};
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
  rebuild(selection=this.selection){if(!this.object)return;const runs=textRuns(this.object);this.node.replaceChildren(...runs.map(run=>this.span(run)));this.endLineMarker=null;if(this.object.text.endsWith('\n')){const marker=this.span({...runStyle(runs.at(-1)||this.object),text:'\u200b'});this.node.append(marker);this.endLineMarker=marker.firstChild;}if(!this.node.childNodes.length)this.node.append(this.span({...runStyle(this.object),text:''}));this.restoreSelection(selection);this.position();}
  begin(object=null,rect={x:20,y:20,width:260,height:60}){
    if(this.active&&this.objectId===object?.id){this.node.focus();return;}this.finish();
    if(object)this.app.closeObjectSession();
    const doc=this.app.doc,layer=object?doc.layers.find(layer=>layer.objects.includes(object)):doc.activeLayer;
    if(!layer||layer.locked||!layer.visible){this.app.toast('Show and unlock this layer before editing text.');return;}
    doc.activeLayerId=layer.id;this.creationBefore=object?null:doc.metadata();this.creationDirty=doc.dirty;
    if(!object){const props={...this.defaults,type:'text',text:'',textRuns:[],x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),textBoxWidth:Math.round(rect.width),minHeight:this.defaults.bubble?1:Math.round(rect.height),textColor:this.app.color1,background:this.app.color2,bubbleColor:this.app.color1,resampling:'nearest'};
      doc.assertAllocation(rect.width*rect.height*24);const source=textSource(props);props.height=source.height;doc.inTransaction=true;try{object=doc.insert(source,'Text',false,props);}finally{doc.inTransaction=false;}}
    doc.selected=[object.id];this.before=doc.metadata();this.objectId=object.id;this.modified=false;this.app.tool='text';this.node.classList.remove('hidden');this.selection={start:object.text?.length||0,end:object.text?.length||0};
    this.rebuild();this.app.switchTab('text');this.syncControls();this.app.changedUI();this.node.focus();this.restoreSelection(this.selection);
  }
  update(patch){
    const object=this.object;if(!object)return;
    try{const candidate={...object,...patch,x:Math.round(object.x),y:Math.round(object.y),resampling:'nearest'},layout=textLayout(candidate);this.app.doc.assertAllocation(layout.width*layout.height*24);const source=textSource(candidate);Object.assign(object,candidate,{source,width:source.width,height:source.height});this.modified=true;this.app.doc.dirty=true;this.position();this.syncControls();this.app.changedUI();}catch(error){this.app.toast(error.message);}
  }
  changeStyle(patch){
    const focused=document.activeElement,keepFocus=focused?.closest('#text-ribbon')&&focused.matches('input,select'),caret=keepFocus&&focused.type==='text'?[focused.selectionStart,focused.selectionEnd]:null,rawValue=keepFocus?focused.value:null;
    if('fontSize'in patch){patch.fontSize=Math.max(1,Math.min(384,patch.fontSize||12));patch.fontUnit='pt';}
    if('tailWidth'in patch)patch.tailWidth=Math.max(2,Math.min(160,Math.round(patch.tailWidth||18)));
    if('tailPosition'in patch){const props=this.object||this.properties;patch.tailPosition=Math.max(9,Math.min(16384,Math.round(patch.tailPosition||28)));patch.tailTipX=(props.tailTipX??14)+patch.tailPosition-(props.tailPosition??28);}
    if('shadowOffset'in patch)patch.shadowOffset=Math.max(0,Math.min(100,Math.round(patch.shadowOffset||0)));
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
          this.typingStyle=style;this.typingAnchor={node:span.firstChild,index:selected.start};this.position();this.syncControls();
        }
      }else{this.update({...patch,...(patch.bubble===true?{minHeight:1}:{})});this.rebuild(selected);}
    }else{
      const targets=this.app.doc.selectedObjects.filter(object=>object.type==='text');if(targets.length&&this.app.selectedEditable())this.app.doc.action('Format text',()=>{for(const object of targets){const candidate={...object,...patch,textRuns:inline?formatRuns(textRuns(object),0,object.text.length,patch):object.textRuns};if(patch.bubble)candidate.minHeight=1;const layout=textLayout(candidate);this.app.doc.assertAllocation(layout.width*layout.height*24);const source=textSource(candidate);Object.assign(object,candidate,{source,width:source.width,height:source.height});}});
    }
    this.syncControls();this.app.changedUI();
    if(keepFocus){focused.value=rawValue;focused.focus({preventScroll:true});if(caret)focused.setSelectionRange(...caret);}
  }
  syncControls(){const props=this.typingStyle&&this.active&&this.selection.start===this.selection.end?{...this.properties,...this.typingStyle}:this.properties;
    for(const[id,key]of[['text-font','font'],['text-size','fontSize'],['text-bubble-width','bubbleWidth'],['text-padding','padding'],['text-line-gap','lineGap'],['text-shadow-offset','shadowOffset'],['text-tail-width','tailWidth'],['text-tail-position','tailPosition']]){const field=document.getElementById(id);if(document.activeElement!==field)field.value=props[key]??defaults[key];}
    const tailWidth=document.getElementById('text-tail-width'),tailPosition=document.getElementById('text-tail-position');
    const object=this.object||this.app.doc.selectedObjects.find(object=>object.type==='text'),boxWidth=object?textLayout(object).boxWidth:500;
    tailWidth.max=Math.max(2,Math.min(160,boxWidth-20));tailPosition.max=Math.max(9,boxWidth-9-Number(tailWidth.value));
    tailWidth.disabled=tailPosition.disabled=!props.bubble;document.getElementById('tail-width-value').textContent=tailWidth.value+' px';document.getElementById('tail-position-value').textContent=tailPosition.value+' px';
    document.getElementById('text-opaque').checked=!!props.opaque;document.getElementById('text-bubble').checked=!!props.bubble;document.getElementById('text-bubble-shadow').checked=!!props.bubbleShadow;document.getElementById('text-bubble-shadow').disabled=!props.bubble;document.getElementById('text-shadow-offset').disabled=!props.bubble||!props.bubbleShadow;
    for(const button of document.querySelectorAll('button[data-text-style]')){const value=!!props[button.dataset.textStyle];button.classList.toggle('selected',value);button.setAttribute('aria-pressed',String(value));}
    const favorite=this.app.prefs.favoriteFonts.includes(props.font),button=document.getElementById('text-font-favorite');button.classList.toggle('selected',favorite);button.setAttribute('aria-pressed',String(favorite));button.title=favorite?'Unpin font':'Pin font to Favorites';
  }
  position(){const object=this.object;if(!object)return;const layout=textLayout(object),zoom=this.app.zoom,angle=(object.angle||0)*Math.PI/180,dx=(layout.bodyX||0)-object.width/2,dy=-object.height/2,x=object.x+object.width/2+dx*Math.cos(angle)-dy*Math.sin(angle),y=object.y+object.height/2+dx*Math.sin(angle)+dy*Math.cos(angle);
    Object.assign(this.node.style,{left:x*zoom+'px',top:y*zoom+'px',width:layout.boxWidth+'px',height:layout.bodyHeight+'px',padding:layout.padding+'px',font:layout.font,lineHeight:`calc(1.15em + ${Number(object.lineGap)||0}px)`,color:'transparent',caretColor:this.properties.textColor||'#000000',transform:`rotate(${object.angle||0}deg) scale(${zoom})`,transformOrigin:'0 0'});
  }
  finish(commit=false){if(!this.active)return;this.hideSizeMenu();const doc=this.app.doc,object=this.object;this.objectId=null;this.typingStyle=null;this.typingAnchor=null;this.node.classList.add('hidden');this.node.blur();if(!object)return;
    if(!(object.text||'').trim()){if(this.creationBefore){doc.restore(this.creationBefore);doc.dirty=this.creationDirty;}else{doc.restore(this.before);doc.selected=[object.id];doc.deleteSelected();}}
    else if(this.modified||this.creationBefore){
      const before=this.creationBefore||this.before,previous=doc.history.undoStack.at(-1);
      if(this.creationBefore&&previous?.sessionOpen&&previous.sessionKey===this.app.sessionKey()){previous.before=before;previous.label='New text box';this.app.updateSession(previous);}
      else this.app.recordTransform(before,this.creationBefore?'New text box':'Edit text');
    }
    this.creationBefore=null;this.app.tool='text';this.app.switchTab('home');this.app.changedUI();if(commit&&doc.selectedObjects.length)this.app.finishSelection();
  }
}
