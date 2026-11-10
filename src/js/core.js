'use strict';
/* Multipify Photo — cœur : utilitaires, calques, documents, historique, rendu */
const MP = (window.MP = {});

MP.uid = (() => { let i = 1; return () => i++; })();
MP.createCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
MP.cloneCanvas = (src) => { const c = MP.createCanvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); return c; };
MP.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
MP.lerp = (a, b, t) => a + (b - a) * t;

/* ---------- Couleurs ---------- */
MP.hexToRgb = (hex) => { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map((c) => c + c).join(''); const n = parseInt(hex, 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; };
MP.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => MP.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
MP.rgbToHsv = (r, g, b) => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0; if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s: max ? d / max : 0, v: max }; };
MP.hsvToRgb = (h, s, v) => { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }; };
MP.rgbToHsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2; if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; } return [h, s, l]; };
MP.hslToRgb = (h, s, l) => { if (s === 0) { const v = l * 255; return [v, v, v]; } const hue = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255]; };

MP.colors = { fg: '#000000', bg: '#ffffff' };
MP.settings = { tools: {}, showGrid: false };

MP.BLEND_MODES = [
  ['source-over', 'Normal'], ['multiply', 'Produit'], ['screen', 'Superposition (Écran)'], ['overlay', 'Incrustation'],
  ['darken', 'Obscurcir'], ['lighten', 'Éclaircir'], ['color-dodge', 'Densité couleur −'], ['color-burn', 'Densité couleur +'],
  ['hard-light', 'Lumière crue'], ['soft-light', 'Lumière tamisée'], ['difference', 'Différence'], ['exclusion', 'Exclusion'],
  ['hue', 'Teinte'], ['saturation', 'Saturation'], ['color', 'Couleur'], ['luminosity', 'Luminosité'],
];

/* ---------- Calque ---------- */
class Layer {
  constructor(w, h, name) {
    this.id = MP.uid();
    this.name = name || 'Calque';
    this.canvas = MP.createCanvas(w, h);
    this.visible = true;
    this.opacity = 1;
    this.blend = 'source-over';
    this.locked = false;
    this.mask = null; // canvas : alpha = visibilité
    this.maskEnabled = true;
    this.text = null; // propriétés si calque de texte
    this.parent = null; // id du groupe parent
    this.isGroup = false; this.collapsed = false;
    this.adjust = null; // calque de réglage { key, values }
    this.fx = null; // styles de calque non destructifs
    this.clip = false; // masque d'écrêtage (découpé par le calque du dessous)
    this.lockAlpha = false; // verrou des pixels transparents
    this.label = null; // couleur d'étiquette
    this.fill = 1; // opacité du fond (n'affecte pas les styles)
    this.lockPixels = false; this.lockPos = false;
    this.smart = null; // objet dynamique { src, m, filters }
  }
  get kind() { return this.isGroup ? 'group' : this.adjust ? 'adjust' : this.text ? 'text' : 'pixel'; }
  get ctx() { return this.canvas.getContext('2d'); }
  props() {
    const j = (o) => (o ? JSON.parse(JSON.stringify(o)) : null);
    return { name: this.name, visible: this.visible, opacity: this.opacity, blend: this.blend, locked: this.locked, maskEnabled: this.maskEnabled, text: this.text ? { ...this.text } : null,
      parent: this.parent, isGroup: this.isGroup, collapsed: this.collapsed, adjust: j(this.adjust), fx: j(this.fx), clip: this.clip, lockAlpha: this.lockAlpha, label: this.label, fill: this.fill, lockPixels: this.lockPixels, lockPos: this.lockPos,
      smart: this.smart ? { src: this.smart.src, m: { ...this.smart.m }, filters: j(this.smart.filters), link: this.smart.link || null } : null, blendIf: j(this.blendIf), vmask: j(this.vmask) };
  }
}
MP.Layer = Layer;

/* ---------- Historique ---------- */
class History {
  constructor(doc) { this.doc = doc; this.undoStack = []; this.redoStack = []; this.limit = (MP.prefs && MP.prefs.historyLimit) || 40; }
  capture(ids) {
    const d = this.doc;
    const all = ids === 'all';
    const pix = new Map();
    for (const l of d.layers) {
      if (all || (ids && ids.includes(l.id))) pix.set(l, { canvas: MP.cloneCanvas(l.canvas), mask: l.mask ? MP.cloneCanvas(l.mask) : null });
    }
    return {
      w: d.width, h: d.height, active: d.active, editMask: d.editMask,
      layers: d.layers.map((l) => ({ ref: l, props: l.props() })),
      selection: d.selection ? MP.cloneCanvas(d.selection) : null,
      qmask: d.qmask ? MP.cloneCanvas(d.qmask) : null, quickMask: d.quickMask,
      pix, ids: all ? 'all' : ids || [],
    };
  }
  restore(s) {
    const d = this.doc;
    d.width = s.w; d.height = s.h;
    d.layers = s.layers.map((e) => { Object.assign(e.ref, e.props); return e.ref; });
    for (const [l, p] of s.pix) { l.canvas = p.canvas; l.mask = p.mask; l._v = (l._v || 0) + 1; }
    d.active = MP.clamp(s.active, 0, d.layers.length - 1);
    d.editMask = s.editMask && !!d.layer?.mask;
    d.selection = s.selection; MP.sel.updatePath(d);
    d.qmask = s.qmask; d.quickMask = s.quickMask && !!s.qmask; d.rev++;
    d.resizeBuffers();
    d.layers.forEach((l) => l.text && MP.renderText(l));
  }
  /** À appeler AVANT de modifier : enregistre l'état précédent. ids = tableau d'id de calques dont les pixels changent, 'all', ou null (structure seule). */
  record(label, ids) {
    for (const l of this.doc.layers) if (ids === 'all' || (ids && ids.includes(l.id))) l._v = (l._v || 0) + 1;
    this.undoStack.push({ label, state: this.capture(ids) });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.doc.markDirty();
    MP.ui && MP.ui.refreshHistory();
  }
  undo() {
    const e = this.undoStack.pop(); if (!e) return false;
    const ids = e.state.ids === 'all' ? 'all' : e.state.ids;
    const cur = this.capture(ids);
    this.restore(e.state);
    this.redoStack.push({ label: e.label, state: cur });
    this.doc.markDirty(); return true;
  }
  redo() {
    const e = this.redoStack.pop(); if (!e) return false;
    const ids = e.state.ids === 'all' ? 'all' : e.state.ids;
    const cur = this.capture(ids);
    this.restore(e.state);
    this.undoStack.push({ label: e.label, state: cur });
    this.doc.markDirty(); return true;
  }
}
MP.History = History;

/* ---------- Document ---------- */
class Doc {
  constructor(w, h, name) {
    this.id = MP.uid();
    this.width = Math.round(w); this.height = Math.round(h);
    this.name = name || 'Sans titre';
    this.layers = []; this.active = 0;
    this.selection = null; this.selPath = null;
    this.editMask = false;
    this.zoom = 1; this.panX = 0; this.panY = 0;
    this.history = new History(this);
    this.dirty = false; this.filePath = null;
    this.rev = 1; this._compRev = 0; this.guides = []; this.qmask = null; this.quickMask = false; this.path = null;
    this.resizeBuffers();
  }
  byId(id) { return this.layers.find((l) => l.id === id); }
  children(pid) { pid = pid || null; return this.layers.filter((l) => (l.parent || null) === pid); }
  descendants(g) { const out = []; const rec = (id) => { for (const c of this.children(id)) { out.push(c); if (c.isGroup) rec(c.id); } }; rec(g.id); return out; }
  depthOf(l) { let n = 0, p = l.parent; while (p) { n++; const g = this.byId(p); p = g ? g.parent : null; } return n; }
  isHiddenByParent(l) { let p = l.parent; while (p) { const g = this.byId(p); if (!g) break; if (!g.visible) return true; p = g.parent; } return false; }
  /** Remet le tableau à plat dans l'ordre de l'arbre (enfants juste sous leur groupe). */
  normalize() {
    const act = this.layer, ids = new Set(this.layers.map((l) => l.id));
    for (const l of this.layers) if (l.parent && (!ids.has(l.parent) || !this.byId(l.parent).isGroup)) l.parent = null;
    const out = [];
    const rec = (pid) => { for (const c of this.children(pid)) { if (c.isGroup) rec(c.id); out.push(c); } };
    rec(null);
    this.layers = out; this.active = Math.max(0, out.indexOf(act)); this.rev++;
  }
  buf(key) {
    this._bufs = this._bufs || {};
    let b = this._bufs[key];
    if (!b || b.width !== this.width || b.height !== this.height) b = this._bufs[key] = MP.createCanvas(this.width, this.height);
    return b;
  }
  maskFor(l) {
    const live = MP.live && MP.live.layer === l && MP.live.target === 'mask' ? MP.live : null;
    if (!live) return MP.effMask ? MP.effMask(l) : l.mask;
    const t = this.buf('mask'), c = t.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, t.width, t.height); c.drawImage(l.mask, 0, 0); live.draw(c, this, l); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    return t;
  }
  get layer() { return this.layers[this.active]; }
  resizeBuffers() {
    if (this.qmask && (this.qmask.width !== this.width || this.qmask.height !== this.height)) { this.qmask = null; this.quickMask = false; }
    this._comp = MP.createCanvas(this.width, this.height);
    this._tmp = MP.createCanvas(this.width, this.height);
    this._tmp2 = MP.createCanvas(this.width, this.height);
  }
  markDirty() { this.dirty = true; MP.ui && MP.ui.refreshTabs(); MP.native && MP.native.setDirty(MP.docs.some((d) => d.dirty)); }
  addLayer(name, index) {
    const l = new Layer(this.width, this.height, name || `Calque ${this.layers.length}`);
    const cur = this.layer; if (cur && index === undefined) l.parent = cur.parent || null;
    const i = index === undefined ? this.active + 1 : index;
    this.layers.splice(MP.clamp(i, 0, this.layers.length), 0, l);
    this.active = this.layers.indexOf(l); this.editMask = false;
    return l;
  }
  composite(target, opts = {}) {
    const out = target || this._comp;
    if (!target && !opts.noLive && this._compRev === this.rev) return out;
    const ctx = out.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, out.width, out.height);
    this.compositeChildren(ctx, null, opts, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (!target) this._compRev = opts.noLive ? -1 : this.rev;
    return out;
  }
  /** Dessine un calque (pixels, groupe ou réglage) sur ctx. */
  drawLayer(ctx, l, opts, depth, atop) {
    const hasMask = l.mask && l.maskEnabled;
    if (l.isGroup) {
      const pass = l.blend === 'pass-through';
      if (pass && !hasMask && l.opacity >= 1 && !atop) { this.compositeChildren(ctx, l.id, opts, depth); return; }
      const buf = this.buf('g' + (depth + 1)), bc = buf.getContext('2d');
      bc.setTransform(1, 0, 0, 1, 0, 0); bc.globalAlpha = 1; bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, 0, buf.width, buf.height);
      this.compositeChildren(bc, l.id, opts, depth + 1);
      if (hasMask) { bc.globalCompositeOperation = 'destination-in'; bc.drawImage(opts.noLive ? (MP.effMask ? MP.effMask(l) : l.mask) : this.maskFor(l), 0, 0); bc.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = atop ? 'source-atop' : pass ? 'source-over' : l.blend; ctx.drawImage(buf, 0, 0);
    } else if (l.adjust) {
      const res = MP.applyAdjustLayer ? MP.applyAdjustLayer(this, ctx.canvas, l) : null; if (!res) return;
      if (hasMask) { const rc = res.getContext('2d'); rc.globalCompositeOperation = 'destination-in'; rc.drawImage(opts.noLive ? (MP.effMask ? MP.effMask(l) : l.mask) : this.maskFor(l), 0, 0); rc.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = atop ? 'source-atop' : l.blend; ctx.drawImage(res, 0, 0);
    } else {
      let src = opts.noLive ? this.layerStatic(l) : this.layerSource(l);
      const fill = l.fill == null ? 1 : l.fill, styled = l.fx && MP.fx && MP.fx.has(l);
      if (styled) src = MP.fx.render(this, l, src);
      ctx.globalAlpha = l.opacity * (styled ? 1 : fill); ctx.globalCompositeOperation = atop && l.blend === 'source-over' ? 'source-atop' : l.blend; ctx.drawImage(src, 0, 0);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  compositeChildren(ctx, pid, opts, depth) {
    const kids = this.children(pid);
    for (let i = 0; i < kids.length; i++) {
      const l = kids[i], clipped = [];
      let j = i + 1; while (j < kids.length && kids[j].clip) { clipped.push(kids[j]); j++; }
      if (!clipped.length || l.clip) { if (l.visible) this.drawLayer(ctx, l, opts, depth, false); continue; }
      // calque de base + calques écrêtés au-dessus
      i = j - 1; if (!l.visible) continue;
      const buf = this.buf('clip' + depth), bc = buf.getContext('2d');
      bc.setTransform(1, 0, 0, 1, 0, 0); bc.globalAlpha = 1; bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, 0, buf.width, buf.height);
      const op = l.opacity, bl = l.blend; l.opacity = 1; if (!l.isGroup) l.blend = 'source-over';
      this.drawLayer(bc, l, opts, depth + 1, false); l.opacity = op; l.blend = bl;
      const base = this.buf('clipA' + depth), ac = base.getContext('2d'); ac.globalCompositeOperation = 'source-over'; ac.clearRect(0, 0, base.width, base.height); ac.drawImage(buf, 0, 0);
      for (const c of clipped) {
        if (!c.visible) continue;
        this.drawLayer(bc, c, opts, depth + 1, c.blend === 'source-over' || c.adjust || c.isGroup);
        if (c.blend !== 'source-over' && !c.adjust && !c.isGroup) { bc.globalCompositeOperation = 'destination-in'; bc.drawImage(base, 0, 0); bc.globalCompositeOperation = 'source-over'; }
      }
      ctx.globalAlpha = op; ctx.globalCompositeOperation = l.isGroup && bl === 'pass-through' ? 'source-over' : bl; ctx.drawImage(buf, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  layerStatic(l) {
    if (!(l.mask && l.maskEnabled)) return l.canvas;
    const t = this._tmp, c = t.getContext('2d');
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, t.width, t.height); c.drawImage(l.canvas, 0, 0);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(MP.effMask ? MP.effMask(l) : l.mask, 0, 0);
    c.globalCompositeOperation = 'source-over';
    return t;
  }
  /** Version « en direct » d'un calque (prévisualisation d'outil / réglage / masque). */
  layerSource(l) {
    const live = MP.live && (MP.live.layer === l || (MP.live.layers && MP.live.layers.includes(l))) ? MP.live : null;
    const base = l._preview || l.canvas;
    const hasMask = l.mask && l.maskEnabled;
    if (!live && !hasMask) return base;
    const t = this._tmp, c = t.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, t.width, t.height);
    c.drawImage(base, 0, 0);
    if (live && (live.target || 'layer') === 'layer') { live.draw(c, this, l); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    if (hasMask) {
      let m = MP.effMask ? MP.effMask(l) : l.mask;
      if (live && live.target === 'mask' && live.layer === l) {
        const t2 = this._tmp2, c2 = t2.getContext('2d');
        c2.globalAlpha = 1; c2.globalCompositeOperation = 'source-over';
        c2.clearRect(0, 0, t2.width, t2.height); c2.drawImage(l.mask, 0, 0);
        live.draw(c2, this, l); c2.globalAlpha = 1; c2.globalCompositeOperation = 'source-over';
        m = t2;
      }
      c.globalCompositeOperation = 'destination-in'; c.drawImage(m, 0, 0); c.globalCompositeOperation = 'source-over';
    }
    return t;
  }
  /** Masque la toile donnée par la sélection active (en place). */
  clipToSelection(canvas) {
    if (!this.selection) return canvas;
    const c = canvas.getContext('2d');
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.globalCompositeOperation = 'destination-in'; c.drawImage(this.selection, 0, 0); c.restore();
    return canvas;
  }
  /** Applique une toile « résultat » (même taille) sur le calque actif en respectant la sélection. */
  commitResult(layer, result, target) {
    const dst = target === 'mask' ? layer.mask : layer.canvas;
    const c = dst.getContext('2d');
    if (!this.selection) { c.clearRect(0, 0, dst.width, dst.height); c.drawImage(result, 0, 0); return; }
    const inside = MP.cloneCanvas(result); this.clipToSelection(inside);
    c.save(); c.globalCompositeOperation = 'destination-out'; c.drawImage(this.selection, 0, 0); c.restore();
    c.drawImage(inside, 0, 0);
  }
}
MP.Doc = Doc;

/* ---------- Gestion des documents ouverts ---------- */
MP.docs = [];
MP.doc = null;
MP.setDoc = (d) => { MP.doc = d; MP.live = null; MP.tool && MP.tool.cancel && MP.tool.cancel(); MP.ui && MP.ui.refreshAll(); MP.render(); };
MP.addDoc = (d) => { MP.docs.push(d); MP.doc = d; if (MP.setHistorySource) MP.setHistorySource(d); MP.view && MP.view.fit(); MP.setDoc(d); };
MP.newDocument = (w, h, name, bg) => {
  const d = new Doc(w, h, name);
  const l = d.addLayer(bg === 'transparent' ? 'Calque 1' : 'Arrière-plan', 0);
  if (bg && bg !== 'transparent') { const c = l.ctx; c.fillStyle = bg; c.fillRect(0, 0, w, h); }
  MP.addDoc(d); return d;
};

/* ---------- Vue / rendu ---------- */
MP.view = {
  canvas: null, ctx: null, dpr: 1, antsOffset: 0, cursor: null,
  init(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    const pc = MP.createCanvas(16, 16), p = pc.getContext('2d');
    p.fillStyle = '#ffffff'; p.fillRect(0, 0, 16, 16); p.fillStyle = '#cccccc'; p.fillRect(0, 0, 8, 8); p.fillRect(8, 8, 8, 8);
    this.checker = this.ctx.createPattern(pc, 'repeat');
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    setInterval(() => { if (MP.doc && MP.doc.selPath) { this.antsOffset = (this.antsOffset + 1) % 16; MP.renderView(); } }, 140);
  },
  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.max(1, r.width * this.dpr); this.canvas.height = Math.max(1, r.height * this.dpr);
    this.canvas.style.width = r.width + 'px'; this.canvas.style.height = r.height + 'px';
    MP.renderView(); MP.guides && MP.guides.drawRulers();
  },
  fit() {
    const d = MP.doc; if (!d || !this.w) return;
    const z = Math.min((this.w - 40) / d.width, (this.h - 40) / d.height, 1);
    this.setZoom(z, null, true);
  },
  setZoom(z, at, center) {
    const d = MP.doc; if (!d) return;
    z = MP.clamp(z, 0.01, 64);
    if (center) { d.zoom = z; d.panX = (this.w - d.width * z) / 2; d.panY = (this.h - d.height * z) / 2; }
    else {
      at = at || { x: this.w / 2, y: this.h / 2 };
      const px = (at.x - d.panX) / d.zoom, py = (at.y - d.panY) / d.zoom;
      d.zoom = z; d.panX = at.x - px * z; d.panY = at.y - py * z;
    }
    MP.ui && MP.ui.refreshStatus(); MP.renderView();
  },
  zoomStep(dir, at) {
    const steps = [0.01, 0.02, 0.03, 0.05, 0.0833, 0.125, 0.1667, 0.25, 0.333, 0.5, 0.667, 1, 1.5, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 48, 64];
    const z = MP.doc.zoom;
    let nz = dir > 0 ? steps.find((s) => s > z * 1.001) : [...steps].reverse().find((s) => s < z * 0.999);
    this.setZoom(nz || z, at);
  },
  toDoc(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect(), d = MP.doc;
    return { x: (clientX - r.left - d.panX) / d.zoom, y: (clientY - r.top - d.panY) / d.zoom, sx: clientX - r.left, sy: clientY - r.top };
  },
};

let renderQueued = false;
MP.renderView = () => { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; MP.drawView(); }); };
/** Le contenu a changé : invalide le cache de composition puis redessine. */
MP.render = () => { if (MP.doc) MP.doc.rev++; MP.renderView(); };

MP.drawView = () => {
  const v = MP.view, ctx = v.ctx; if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1b1b1d'; ctx.fillRect(0, 0, v.canvas.width, v.canvas.height);
  const d = MP.doc; if (!d) return;
  const dpr = v.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const x = d.panX, y = d.panY, w = d.width * d.zoom, h = d.height * d.zoom;
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.shadowBlur = 0;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = v.checker; ctx.fillRect(x, y, w, h); ctx.restore();
  let comp = d.composite(); if ((MP.viewChannel || MP.proof || MP.gamutWarn) && MP.channelView) comp = MP.channelView(d, comp); if (MP.viewPost) comp = MP.viewPost(d, comp);
  ctx.save();
  ctx.setTransform(dpr * d.zoom, 0, 0, dpr * d.zoom, dpr * x, dpr * y);
  ctx.imageSmoothingEnabled = d.zoom < 2; ctx.imageSmoothingQuality = 'high';
  if (d.editMask && MP.showMaskOnly && d.layer.mask) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, d.width, d.height); ctx.drawImage(d.layer.mask, 0, 0); }
  else ctx.drawImage(comp, 0, 0);
  ctx.restore();
  // Grille de pixels à fort zoom / grille utilisateur
  if (d.zoom >= 8 || MP.settings.showGrid) {
    const step = d.zoom >= 8 && !MP.settings.showGrid ? 1 : Math.max(1, Math.round(Math.max(d.width, d.height) / 16));
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = MP.settings.showGrid ? 'rgba(0,170,255,.35)' : 'rgba(128,128,128,.35)'; ctx.lineWidth = 1; ctx.beginPath();
    const x0 = Math.max(0, Math.floor(-x / d.zoom / step) * step), x1 = Math.min(d.width, Math.ceil((v.w - x) / d.zoom));
    const y0 = Math.max(0, Math.floor(-y / d.zoom / step) * step), y1 = Math.min(d.height, Math.ceil((v.h - y) / d.zoom));
    for (let i = x0; i <= x1; i += step) { const sx = Math.round(x + i * d.zoom) + 0.5; ctx.moveTo(sx, y + y0 * d.zoom); ctx.lineTo(sx, y + y1 * d.zoom); }
    for (let j = y0; j <= y1; j += step) { const sy = Math.round(y + j * d.zoom) + 0.5; ctx.moveTo(x + x0 * d.zoom, sy); ctx.lineTo(x + x1 * d.zoom, sy); }
    ctx.stroke(); ctx.restore();
  }
  // Sélection (fourmis)
  if (d.selPath) {
    ctx.save(); ctx.setTransform(dpr * d.zoom, 0, 0, dpr * d.zoom, dpr * x, dpr * y);
    ctx.lineWidth = 1 / d.zoom;
    ctx.setLineDash([4 / d.zoom, 4 / d.zoom]);
    ctx.strokeStyle = '#000'; ctx.lineDashOffset = -v.antsOffset / 2 / d.zoom; ctx.stroke(d.selPath);
    ctx.strokeStyle = '#fff'; ctx.lineDashOffset = -v.antsOffset / 2 / d.zoom + 4 / d.zoom; ctx.stroke(d.selPath);
    ctx.restore();
  }
  // Masque rapide (rouge sur les zones non sélectionnées)
  if (d.quickMask && d.qmask) {
    const t = d.buf('qm'), tc = t.getContext('2d');
    tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1; tc.fillStyle = '#ff0033'; tc.fillRect(0, 0, t.width, t.height);
    let m = d.qmask;
    if (MP.live && MP.live.target === 'qmask') { const q = d.buf('qm2'), qc = q.getContext('2d'); qc.globalAlpha = 1; qc.globalCompositeOperation = 'source-over'; qc.clearRect(0, 0, q.width, q.height); qc.drawImage(d.qmask, 0, 0); MP.live.draw(qc, d); qc.globalAlpha = 1; qc.globalCompositeOperation = 'source-over'; m = q; }
    tc.globalCompositeOperation = 'destination-out'; tc.drawImage(m, 0, 0); tc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(dpr * d.zoom, 0, 0, dpr * d.zoom, dpr * x, dpr * y); ctx.globalAlpha = 0.5; ctx.imageSmoothingEnabled = d.zoom < 2; ctx.drawImage(t, 0, 0); ctx.restore();
  }
  MP.guides && MP.guides.drawOverlay(ctx, d);
  MP.drawSamplers && MP.drawSamplers(ctx, d);
  // Sur-impression de l'outil
  if (MP.tool && MP.tool.overlay) { ctx.save(); MP.tool.overlay(ctx, d); ctx.restore(); }
  // Curseur pinceau
  if (v.cursor && MP.tool && MP.tool.brushCursor) {
    const s = MP.tool.brushCursor();
    if (s) {
      const cx = x + v.cursor.x * d.zoom, cy = y + v.cursor.y * d.zoom, r = Math.max(1, (s / 2) * d.zoom);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.75; ctx.stroke();
    }
  }
  MP.ui && MP.ui.navigatorDirty && MP.ui.navigatorDirty();
};

/** Helpers pour dessiner en coordonnées document dans la sur-impression. */
MP.docToScreen = (p) => { const d = MP.doc; return { x: d.panX + p.x * d.zoom, y: d.panY + p.y * d.zoom }; };
MP.overlayDocTransform = (ctx) => { const d = MP.doc, dpr = MP.view.dpr; ctx.setTransform(dpr * d.zoom, 0, 0, dpr * d.zoom, dpr * d.panX, dpr * d.panY); };

/** Bornes des pixels non transparents d'une toile (ou null). */
MP.alphaBounds = (canvas, threshold = 0) => {
  const w = canvas.width, h = canvas.height, data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) { const row = y * w * 4; for (let x = 0; x < w; x++) { if (data[row + x * 4 + 3] > threshold) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; } } }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

MP.toast = (msg, ms = 2400) => {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
};
MP.busy = async (msg, fn) => {
  const b = document.getElementById('busy'); b.querySelector('span').textContent = msg; b.classList.add('show');
  await new Promise((r) => setTimeout(r, 30));
  try { return await fn(); } finally { b.classList.remove('show'); }
};
