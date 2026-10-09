import { textSource, textLayout } from '../core/editable.js';
const defaults = { font: 'Segoe UI', fontSize: 20, bold: false, italic: false, underline: false, strikeout: false, opaque: false, bubble: false, bubbleWidth: 3, padding: 12, lineGap: 0 };
export class TextEditor {
  constructor(app) {
    this.app = app; this.defaults = { ...defaults };
    const saved = app.prefs.textStyle;
    if (saved && typeof saved === 'object') for (const key of Object.keys(defaults))
      if (typeof saved[key] === typeof defaults[key] && (typeof saved[key] !== 'number' || Number.isFinite(saved[key]))) this.defaults[key] = saved[key];
    this.node = document.createElement('textarea');this.node.id = 'text-content';
    this.node.setAttribute('aria-label', 'Canvas text');this.node.setAttribute('placeholder', 'Type here…');
    this.node.spellcheck = false;this.node.wrap = 'soft';this.node.className = 'inline-text-editor hidden';
    app.editor.stage.append(this.node);
    this.node.addEventListener('input', () => this.update({ text: this.node.value }));
    this.node.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault();event.stopPropagation();this.finish(); }
    });
    for (const [id, property] of [['text-font','font'],['text-size','fontSize'],['text-bubble-width','bubbleWidth'],['text-padding','padding'],['text-line-gap','lineGap']])
      document.getElementById(id).addEventListener('input', event => this.changeStyle({ [property]: property === 'font' ? event.target.value : Number(event.target.value) }));
    for (const [id, property] of [['text-opaque','opaque'],['text-bubble','bubble']])
      document.getElementById(id).addEventListener('change', event => this.changeStyle({ [property]: event.target.checked }));
    for (const button of document.querySelectorAll('[data-text-style]')) button.addEventListener('click', () => {
      const property = button.dataset.textStyle;this.changeStyle({ [property]: !this.properties[property] });
    });
    document.addEventListener('pointerdown', event => {
      if (!this.active || event.target.closest('#text-content,#text-ribbon,.colors-group,#menu,#modal-root,.tabs')) return;
      this.finish();
    }, true);
    this.syncControls();
  }
  get active() { return !!this.objectId; }
  get object() { return this.app.doc.objects.find(object => object.id === this.objectId); }
  get properties() { return this.object || this.app.doc.selectedObjects.find(object => object.type === 'text') || this.defaults; }
  begin(object = null, rect = { x: 20, y: 20, width: 260, height: 60 }) {
    if (this.active && this.objectId === object?.id) { this.node.focus();return; }
    this.finish();
    const doc = this.app.doc, layer = object ? doc.layers.find(layer => layer.objects.includes(object)) : doc.activeLayer;
    if (!layer || layer.locked || !layer.visible) { this.app.toast('Show and unlock this layer before editing text.');return; }
    doc.activeLayerId = layer.id;
    this.creationBefore = object ? null : doc.metadata();this.creationDirty = doc.dirty;
    if (!object) {
      const properties = { ...this.defaults, type: 'text', text: '', x: rect.x, y: rect.y, width: Math.round(rect.width), minHeight: Math.round(rect.height), textColor: this.app.color1, background: this.app.color2, bubbleColor: this.app.color1 };
      doc.assertAllocation(rect.width * rect.height * 12);
      const source = textSource(properties);properties.height = source.height;
      doc.inTransaction = true;
      try { object = doc.insert(source, 'Text', false, properties); }
      finally { doc.inTransaction = false; }
    }
    doc.selected = [object.id];this.before = doc.metadata();this.objectId = object.id;this.modified = false;
    this.app.tool = 'text';this.node.value = object.text || '';this.node.classList.remove('hidden');
    this.backgroundSource = textSource({ ...object, hideText: true });
    this.app.switchTab('text');this.syncControls();this.position();this.app.changedUI();this.node.focus();
  }
  update(patch) {
    const object = this.object;if (!object) return;
    try {
      const candidate = { ...object, ...patch }, layout = textLayout(candidate);
      this.app.doc.assertAllocation(layout.width * layout.height * 12);
      const source = textSource(candidate);
      Object.assign(object, candidate, { source, width: source.width, height: source.height });
      this.backgroundSource = textSource({ ...object, hideText: true });
      this.modified = true;this.app.doc.dirty = true;
      this.position();this.syncControls();this.app.changedUI();
    } catch (error) { this.app.toast(error.message); }
  }
  changeStyle(patch) {
    if ('fontSize' in patch) patch.fontSize = Math.max(4, Math.min(512, patch.fontSize || 20));
    if ('padding' in patch) patch.padding = Math.max(0, Math.min(100, patch.padding || 0));
    if ('lineGap' in patch) patch.lineGap = Math.max(0, Math.min(200, patch.lineGap || 0));
    if ('bubbleWidth' in patch) patch.bubbleWidth = Math.max(1, Math.min(32, patch.bubbleWidth || 3));
    Object.assign(this.defaults, patch);this.app.prefs.textStyle = { ...this.defaults };this.app.savePrefs();
    if (this.active) this.update(patch);
    else {
      const targets = this.app.doc.selectedObjects.filter(object => object.type === 'text');
      if (targets.length && this.app.selectedEditable()) this.app.doc.action('Format text', () => {
        for (const object of targets) {
          const candidate = { ...object, ...patch }, layout = textLayout(candidate);
          this.app.doc.assertAllocation(layout.width * layout.height * 8);
          const source = textSource(candidate);Object.assign(object, candidate, { source, width: source.width, height: source.height });
        }
      });
    }
    this.syncControls();this.app.changedUI();
  }
  syncControls() {
    const properties = this.properties;
    for (const [id, key] of [['text-font','font'],['text-size','fontSize'],['text-bubble-width','bubbleWidth'],['text-padding','padding'],['text-line-gap','lineGap']]) {
      const field = document.getElementById(id);
      if (document.activeElement !== field) field.value = properties[key] ?? defaults[key];
    }
    document.getElementById('text-opaque').checked = !!properties.opaque;
    document.getElementById('text-bubble').checked = !!properties.bubble;
    for (const button of document.querySelectorAll('[data-text-style]')) {
      const enabled = !!properties[button.dataset.textStyle];button.classList.toggle('selected', enabled);button.setAttribute('aria-pressed', String(enabled));
    }
  }
  position() {
    const object = this.object;if (!object) return;
    const layout = textLayout(object), zoom = this.app.zoom;
    const angle = (object.angle || 0) * Math.PI / 180, dx = -object.width / 2, dy = -object.height / 2;
    const x = object.x + object.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle), y = object.y + object.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle);
    Object.assign(this.node.style, { left: x * zoom + 'px', top: y * zoom + 'px', width: object.width + 'px', height: object.height * (object.bubble ? 0.76 : 1) + 'px', padding: layout.padding + 'px', font: layout.font, lineHeight: layout.lineHeight + 'px', color: object.textColor, textDecoration: `${object.underline ? 'underline' : ''} ${object.strikeout ? 'line-through' : ''}`.trim() || 'none', transform: `rotate(${object.angle || 0}deg) scale(${zoom})`, transformOrigin: '0 0' });
  }
  finish() {
    if (!this.active) return;
    const doc = this.app.doc, object = this.object;
    this.objectId = null;this.backgroundSource = null;this.node.classList.add('hidden');this.node.blur();
    if (!object) return;
    if (!(object.text || '').trim()) {
      if (this.creationBefore) { doc.restore(this.creationBefore);doc.dirty = this.creationDirty; }
      else { doc.restore(this.before);doc.selected = [object.id];doc.deleteSelected(); }
    } else if (this.modified || this.creationBefore) {
      const before = this.creationBefore || this.before, after = doc.metadata();
      doc.history.push({ label: this.creationBefore ? 'New text box' : 'Edit text', resources: [...new Set([...doc.resources(before), ...doc.resources(after)])], undo: () => doc.restore(before), redo: () => doc.restore(after) });
    }
    this.creationBefore = null;this.app.tool = this.app.selectionOrigin || 'select';this.app.changedUI();
  }
}
