'use strict';
/* v5 (moteur) — verrous, masques avec densité/contour progressif, objets dynamiques + filtres dynamiques,
   transformation numérique, couches (vues RVB + couches alpha), instantanés, préréglages (réglages, pinceaux, styles, dégradés, motifs), modèles */

/* =================== Verrous =================== */
{
  const ce = MP.canEdit, cep = MP.canEditPixels;
  MP.canEdit = () => { const d = MP.doc; if (d && d.layer && !(d.quickMask && d.qmask) && !(d.editMask && d.layer.mask)) { const l = d.layer; if (l.lockPixels) { MP.toast('Les pixels de ce calque sont verrouillés'); return false; } if (l.smart) { MP.toast('Objet dynamique : pixellisez-le pour peindre dessus (clic droit sur le calque)'); return false; } } return ce(); };
  MP.canEditPixels = () => { const d = MP.doc; if (d && d.layer) { const l = d.layer; if (l.lockPixels) { MP.toast('Les pixels de ce calque sont verrouillés'); return false; } if (l.smart) { MP.toast('Objet dynamique : pixellisez-le pour modifier ses pixels (clic droit sur le calque)'); return false; } } return cep(); };
  const mv = MP.tools.move, b0 = mv.begin;
  mv.begin = function (p) { const l = MP.doc && MP.doc.layer; if (l && l.lockPos) { MP.toast('La position de ce calque est verrouillée'); return false; } if (l && l.smart) return this.beginSmart(p); return b0.call(this, p); };
  mv.beginSmart = function (p) {
    const d = MP.doc, l = d.layer; this.start = p; this.dx = this.dy = 0; this.text = null; this.group = null;
    d.history.record('Déplacer l\'objet dynamique', [l.id]); this.smartM = { ...l.smart.m }; this.float = MP.cloneCanvas(l.canvas); this.base = null; this.selPath = null;
    MP.live = { layer: l, target: 'layer', draw: (ctx) => { ctx.clearRect(0, 0, d.width, d.height); ctx.drawImage(this.float, Math.round(this.dx), Math.round(this.dy)); } };
    return true;
  };
  const f0 = mv.finish;
  mv.finish = function () { const l = MP.doc.layer; if (this.smartM && l.smart) { l.smart.m.cx = this.smartM.cx + Math.round(this.dx); l.smart.m.cy = this.smartM.cy + Math.round(this.dy); this.smartM = null; MP.live = null; MP.smart.update(l); MP.afterEdit(); return; } this.smartM = null; return f0.call(this); };
}

/* =================== Masques : densité et contour progressif non destructifs =================== */
MP.effMask = (l) => {
  const dens = l.maskDensity == null ? 1 : l.maskDensity, fe = l.maskFeather || 0;
  if (!l.mask || (dens >= 1 && !fe)) return l.mask;
  const key = `${l._v || 0}|${dens}|${fe}|${l.mask.width}`;
  if (l._em && l._emKey === key) return l._em;
  const m = MP.createCanvas(l.mask.width, l.mask.height), c = m.getContext('2d');
  c.fillStyle = `rgba(255,255,255,${1 - dens})`; c.fillRect(0, 0, m.width, m.height);
  if (fe) c.filter = `blur(${fe}px)`; c.drawImage(l.mask, 0, 0); c.filter = 'none';
  l._em = m; l._emKey = key; return m;
};

/* =================== Exécution générique d'un réglage / filtre sur une toile =================== */
MP.applySpec = (canvas, spec, vals) => {
  if (spec.render) return spec.render(canvas, vals);
  const w = canvas.width, h = canvas.height, src = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let blur = null; if (spec.needsBlur) { const r = spec.needsBlur(vals); if (r) blur = MP.blurCanvas(canvas, r).getContext('2d').getImageData(0, 0, w, h).data; }
  const out = MP.createCanvas(w, h), oc = out.getContext('2d'), id = oc.createImageData(w, h);
  Object.defineProperty(vals, '__w', { value: w, configurable: true, enumerable: false, writable: true });
  spec.pixel(src, id.data, vals, blur); oc.putImageData(id, 0, 0); return out;
};

/* =================== Objets dynamiques =================== */
MP.smart = {
  specOf: (f) => (f.isFilter ? MP.FILTERS : MP.ADJUST)[f.key],
  convert() {
    const d = MP.doc, l = d.layer; if (!l || l.isGroup || l.adjust) { MP.toast('Sélectionnez un calque de pixels ou de texte'); return; }
    if (l.smart) { MP.toast('C\'est déjà un objet dynamique'); return; }
    const b = MP.alphaBounds(l.canvas, 0); if (!b) { MP.toast('Calque vide'); return; }
    d.history.record('Convertir en objet dynamique', [l.id]);
    const src = MP.createCanvas(b.w, b.h); src.getContext('2d').drawImage(l.canvas, -b.x, -b.y);
    l.smart = { src, m: { cx: b.x + b.w / 2, cy: b.y + b.h / 2, sx: 1, sy: 1, angle: 0 }, filters: [] }; l.text = null;
    this.update(l); MP.afterEdit(); MP.toast('Objet dynamique : redimensionnez-le sans perte, ses filtres restent modifiables');
  },
  transformed(d, l) {
    const s = l.smart, c = MP.createCanvas(d.width, d.height), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.translate(s.m.cx, s.m.cy); x.rotate(s.m.angle); x.scale(s.m.sx, s.m.sy); x.drawImage(s.src, -s.src.width / 2, -s.src.height / 2);
    return c;
  },
  base(l, upto) {
    const d = MP.doc; let c = this.transformed(d, l);
    l.smart.filters.slice(0, upto == null ? l.smart.filters.length : upto).forEach((f) => { if (f.on !== false) { const sp = this.specOf(f); if (sp) c = MP.applySpec(c, sp, JSON.parse(JSON.stringify(f.values || {}))); } });
    return c;
  },
  update(l) { if (!l.smart) return; l.canvas = this.base(l); l._v = (l._v || 0) + 1; MP.render(); },
  updateAll(d) { for (const l of d.layers) if (l.smart) { const keep = MP.doc; MP.doc = d; this.update(l); MP.doc = keep; } },
  rasterize() { const d = MP.doc, l = d.layer; if (!l.smart) return; d.history.record('Pixelliser l\'objet dynamique', null); l.smart = null; MP.afterEdit(); },
  /** Ajoute un filtre dynamique (au lieu de modifier les pixels). */
  addFilter(key, isFilter) {
    const d = MP.doc, l = d.layer, spec = (isFilter ? MP.FILTERS : MP.ADJUST)[key]; if (!spec) return;
    const base = this.base(l);
    const push = (values) => { l._preview = null; d.history.record('Filtre dynamique : ' + spec.title, [l.id]); l.smart.filters.push({ key, isFilter: !!isFilter, values: JSON.parse(JSON.stringify(values || {})), on: true }); this.update(l); MP.afterEdit(); };
    if (!spec.fields) { MP.busy(spec.title + '…', () => push({})); return; }
    const vals = JSON.parse(JSON.stringify(spec.values));
    MP.ui.dialog({ title: spec.title + ' (filtre dynamique)', fields: spec.fields, values: vals, preview: true, spec, orig: base,
      onChange: (v) => { l._preview = MP.applySpec(base, spec, v); MP.render(); }, onOk: (v) => push(v), onCancel: () => { l._preview = null; MP.render(); } });
  },
  editFilter(l, i) {
    const d = MP.doc, f = l.smart.filters[i], spec = this.specOf(f); if (!spec || !spec.fields) return;
    const before = this.base(l, i), vals = JSON.parse(JSON.stringify(f.values));
    const rest = (c) => { l.smart.filters.slice(i + 1).forEach((g) => { if (g.on !== false) c = MP.applySpec(c, this.specOf(g), JSON.parse(JSON.stringify(g.values))); }); return c; };
    MP.ui.dialog({ title: spec.title + ' (filtre dynamique)', fields: spec.fields, values: vals, preview: true, spec, orig: before,
      onChange: (v) => { l._preview = rest(MP.applySpec(before, spec, v)); MP.render(); },
      onOk: (v) => { l._preview = null; d.history.record('Modifier le filtre dynamique', [l.id]); f.values = JSON.parse(JSON.stringify(v)); this.update(l); MP.afterEdit(); },
      onCancel: () => { l._preview = null; MP.render(); } });
  },
  toggleFilter(l, i) { const d = MP.doc; d.history.record('Filtre dynamique activé/désactivé', [l.id]); const f = l.smart.filters[i]; f.on = f.on === false; this.update(l); MP.afterEdit(); },
  removeFilter(l, i) { const d = MP.doc; d.history.record('Supprimer le filtre dynamique', [l.id]); l.smart.filters.splice(i, 1); this.update(l); MP.afterEdit(); },
  async replace() {
    const d = MP.doc, l = d.layer; if (!l.smart) return;
    const files = await MP.native.openFiles({ multi: false, accept: 'image/*', filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }] }); if (!files || !files[0]) return;
    const c = await MP.io.loadImage(files[0].data, files[0].name), o = l.smart.src;
    d.history.record('Remplacer le contenu', [l.id]);
    const k = Math.min(o.width / c.width, o.height / c.height); l.smart.m.sx *= k; l.smart.m.sy *= k; l.smart.src = c; this.update(l); MP.afterEdit();
  },
};
{
  // filtres et réglages sur un objet dynamique = filtres dynamiques
  const ra = MP.runAdjust;
  MP.runAdjust = (key, isFilter) => { const l = MP.doc && MP.doc.layer; if (l && l.smart) return MP.smart.addFilter(key, isFilter); return ra(key, isFilter); };
  // transformation non destructive
  const T = MP.tools.transform, st0 = T.start, cm0 = T.commit, td = T.toggleDistort, tw = T.toggleWarp;
  T.start = function () {
    const d = MP.doc, l = d && d.layer;
    if (!(l && l.smart)) { this.smartL = null; return st0.call(this); }
    if (l.lockPos) { MP.toast('La position de ce calque est verrouillée'); return false; }
    d.history.record('Transformer l\'objet dynamique', [l.id]);
    const m = l.smart.m; this.smartL = l; this.quad = null; this.grid = null; this.selSrc = null; this.savedSel = d.selPath; d.selPath = null;
    this.src = l.smart.src; this.base = MP.createCanvas(d.width, d.height);
    this.st = { bw: this.src.width, bh: this.src.height, cx: m.cx, cy: m.cy, sx: m.sx, sy: m.sy, angle: m.angle };
    const self = this; MP.live = { layer: l, target: 'layer', draw(ctx) { ctx.clearRect(0, 0, d.width, d.height); self.paint(ctx); } };
    return true;
  };
  T.commit = function () {
    if (!this.smartL) return cm0.call(this);
    const l = this.smartL, s = this.st; l.smart.m = { cx: s.cx, cy: s.cy, sx: s.sx, sy: s.sy, angle: s.angle };
    this.smartL = null; MP.live = null; MP.smart.update(l); this.end();
  };
  T.toggleDistort = function () { if (this.smartL) { MP.toast('Perspective : pixellisez d\'abord l\'objet dynamique'); return; } return td.call(this); };
  T.toggleWarp = function () { if (this.smartL) { MP.toast('Déformation : pixellisez d\'abord l\'objet dynamique'); return; } return tw.call(this); };
  // opérations sur l'image : les objets dynamiques suivent (recadrage, taille, zone de travail, symétrie)
  const smartLayers = () => (MP.doc ? MP.doc.layers.filter((l) => l.smart) : []);
  const crop0 = MP.cropDoc; MP.cropDoc = (x, y, w, h) => { const sl = smartLayers(); crop0(x, y, w, h); sl.forEach((l) => { l.smart.m.cx -= x; l.smart.m.cy -= y; }); MP.smart.updateAll(MP.doc); };
  const rs0 = MP.resizeImage; MP.resizeImage = (w, h, q) => { const d = MP.doc, sx = w / d.width, sy = h / d.height, sl = smartLayers(); rs0(w, h, q); sl.forEach((l) => { const m = l.smart.m; m.cx *= sx; m.cy *= sy; m.sx *= sx; m.sy *= sy; }); MP.smart.updateAll(d); };
  const cs0 = MP.canvasSize; MP.canvasSize = (w, h, ax, ay, fill) => { const d = MP.doc, ox = Math.round((w - d.width) * ax), oy = Math.round((h - d.height) * ay), sl = smartLayers(); cs0(w, h, ax, ay, fill); sl.forEach((l) => { l.smart.m.cx += ox; l.smart.m.cy += oy; }); MP.smart.updateAll(d); };
  const fl0 = MP.flipImage; MP.flipImage = (hz, layerOnly) => { const d = MP.doc, sl = layerOnly ? smartLayers().filter((l) => l === d.layer) : smartLayers(); fl0(hz, layerOnly); sl.forEach((l) => { const m = l.smart.m; if (hz) { m.cx = d.width - m.cx; m.sx = -m.sx; } else { m.cy = d.height - m.cy; m.sy = -m.sy; } m.angle = -m.angle; }); MP.smart.updateAll(d); };
  const ro0 = MP.rotateImage; MP.rotateImage = (deg) => { const sl = smartLayers(); ro0(deg); sl.forEach((l) => (l.smart = null)); };
  const csc = MP.cmd.contentScale; MP.cmd.contentScale = (w, h) => { smartLayers().forEach((l) => (l.smart = null)); return csc(w, h); };
  const pc = MP.tools.perspcrop.apply; MP.tools.perspcrop.apply = function () { smartLayers().forEach((l) => (l.smart = null)); return pc.call(this); };
}

/* =================== Transformation numérique (panneau Propriétés) =================== */
MP.layerOps.transformNumeric = (v) => {
  const d = MP.doc, l = d.layer; if (!l || l.isGroup || l.adjust) return;
  if (!MP.startTransform || (MP.startTransform(), MP.tool !== MP.tools.transform)) return;
  const T = MP.tools.transform, s = T.st;
  if (v.w) s.sx = (v.w / s.bw) * Math.sign(s.sx || 1); if (v.h) s.sy = (v.h / s.bh) * Math.sign(s.sy || 1);
  if (v.angle != null) s.angle = (v.angle * Math.PI) / 180;
  if (v.x != null) s.cx = v.x + Math.abs(s.bw * s.sx) / 2; if (v.y != null) s.cy = v.y + Math.abs(s.bh * s.sy) / 2;
  T.commit();
};
MP.layerBox = (l) => {
  const d = MP.doc;
  if (l.smart) { const m = l.smart.m, w = Math.abs(l.smart.src.width * m.sx), h = Math.abs(l.smart.src.height * m.sy); return { x: Math.round(m.cx - w / 2), y: Math.round(m.cy - h / 2), w: Math.round(w), h: Math.round(h), angle: Math.round((m.angle * 180) / Math.PI) }; }
  const b = l.isGroup || l.adjust ? null : MP.alphaBounds(l.canvas, 0); return b ? { ...b, angle: 0 } : null;
};

/* =================== Couches : vues R/V/B et couches alpha =================== */
MP.channelView = (d, comp) => {
  const key = d.rev + MP.viewChannel; if (d._chKey === key && d._ch) return d._ch;
  const c = d.buf('chview'), x = c.getContext('2d'), id = comp.getContext('2d').getImageData(0, 0, d.width, d.height), a = id.data, k = { r: 0, g: 1, b: 2 }[MP.viewChannel];
  for (let i = 0; i < a.length; i += 4) { const v = a[i + k]; a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255; }
  x.putImageData(id, 0, 0); d._ch = c; d._chKey = key; return c;
};
MP.channels = {
  save() { const d = MP.doc; if (!d.selection) { MP.toast('Aucune sélection à enregistrer'); return; } d.channels = d.channels || []; d.channels.push({ name: 'Alpha ' + (d.channels.length + 1), canvas: MP.cloneCanvas(d.selection) }); d.markDirty(); MP.ui.refreshChannels(); MP.toast('Sélection enregistrée comme couche alpha'); },
  load(i, mode = 'new') { const d = MP.doc, ch = d.channels[i]; if (!ch) return; d.history.record('Récupérer la sélection', null); MP.sel.fromMask(d, ch.canvas, mode); MP.ui.refreshAll(); MP.render(); },
  remove(i) { const d = MP.doc; d.channels.splice(i, 1); MP.ui.refreshChannels(); },
};

/* =================== Instantanés (Historique) =================== */
MP.snapshots = {
  clone(st) { const pix = new Map(); for (const [l, p] of st.pix) pix.set(l, { canvas: MP.cloneCanvas(p.canvas), mask: p.mask ? MP.cloneCanvas(p.mask) : null }); return { ...st, layers: st.layers.map((e) => { const p = e.props, j = (o) => (o ? JSON.parse(JSON.stringify(o)) : null); return { ref: e.ref, props: { ...p, adjust: j(p.adjust), fx: j(p.fx), text: p.text ? { ...p.text } : null, smart: p.smart ? { src: p.smart.src, m: { ...p.smart.m }, filters: j(p.smart.filters) } : null } }; }), pix, selection: st.selection ? MP.cloneCanvas(st.selection) : null, qmask: st.qmask ? MP.cloneCanvas(st.qmask) : null }; },
  take(name) { const d = MP.doc; d.snaps = d.snaps || []; d.snaps.push({ name: name || 'Instantané ' + (d.snaps.length + 1), st: d.history.capture('all') }); MP.ui.refreshHistory(); MP.toast('Instantané créé'); },
  go(i) { const d = MP.doc, s = d.snaps[i]; if (!s) return; d.history.record('Instantané : ' + s.name, 'all'); d.history.restore(this.clone(s.st)); MP.afterEdit(); MP.view.fit(); MP.ui.refreshAll(); },
};

/* =================== Préréglages =================== */
MP.PRESETS = {
  adjust: [
    { name: 'Portrait chaud', cat: 'Portrait', steps: [['light', { exposure: 8, contrast: 5, highlights: -15, shadows: 25, whites: 0, blacks: 0 }], ['colorVibrance', { temp: 18, tint: 4, vibrance: 15, saturation: 0 }], ['clarity', { clarity: -15, dehaze: 0 }]] },
    { name: 'Peau éclatante', cat: 'Portrait', steps: [['light', { exposure: 12, contrast: -5, highlights: -10, shadows: 15, whites: 5, blacks: 0 }], ['colorVibrance', { temp: 6, tint: 6, vibrance: 8, saturation: -5 }]] },
    { name: 'Paysage éclatant', cat: 'Paysage', steps: [['light', { exposure: 0, contrast: 20, highlights: -30, shadows: 30, whites: 5, blacks: -5 }], ['colorVibrance', { temp: 0, tint: 0, vibrance: 40, saturation: 5 }], ['clarity', { clarity: 35, dehaze: 20 }]] },
    { name: 'Matin brumeux', cat: 'Paysage', steps: [['clarity', { clarity: -10, dehaze: -35 }], ['colorVibrance', { temp: -10, tint: 0, vibrance: -10, saturation: 0 }], ['light', { exposure: 10, contrast: -10, highlights: 0, shadows: 10, whites: 0, blacks: 20 }]] },
    { name: 'Coucher de soleil', cat: 'Paysage', steps: [['colorLookup', { lut: 'sunset', k: 100 }], ['light', { exposure: 0, contrast: 10, highlights: -20, shadows: 10, whites: 0, blacks: 0 }]] },
    { name: 'Noir et blanc intense', cat: 'Noir et blanc', steps: [['blackWhite', { r: 50, g: 30, b: 20, tint: false, tc: '#b08850' }], ['curves', { ch: 'rgb', pts: { rgb: [[0, 0], [64, 46], [192, 212], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] } }]] },
    { name: 'Noir et blanc doux', cat: 'Noir et blanc', steps: [['blackWhite', { r: 40, g: 40, b: 20, tint: false, tc: '#b08850' }], ['light', { exposure: 5, contrast: -15, highlights: -10, shadows: 20, whites: 0, blacks: 15 }]] },
    { name: 'Virage sépia', cat: 'Noir et blanc', steps: [['blackWhite', { r: 40, g: 40, b: 20, tint: true, tc: '#a87b4f' }]] },
    { name: 'Cinéma bleu-orangé', cat: 'Créatif', steps: [['colorLookup', { lut: 'tealorange', k: 90 }], ['clarity', { clarity: 15, dehaze: 5 }], ['light', { exposure: 0, contrast: 15, highlights: -10, shadows: 5, whites: 0, blacks: -5 }]] },
    { name: 'Vintage délavé', cat: 'Créatif', steps: [['colorLookup', { lut: 'vintage', k: 80 }], ['grain', { amount: 30, size: 2, rough: 60 }], ['light', { exposure: 0, contrast: -10, highlights: 0, shadows: 0, whites: -10, blacks: 30 }]] },
    { name: 'Pop couleur', cat: 'Créatif', steps: [['colorVibrance', { temp: 0, tint: 0, vibrance: 60, saturation: 20 }], ['light', { exposure: 0, contrast: 25, highlights: 0, shadows: 0, whites: 10, blacks: -10 }]] },
    { name: 'Nuit froide', cat: 'Créatif', steps: [['colorVibrance', { temp: -40, tint: 10, vibrance: 0, saturation: -10 }], ['light', { exposure: -25, contrast: 15, highlights: 0, shadows: 0, whites: 0, blacks: 0 }]] },
    { name: 'Mat doux', cat: 'Créatif', steps: [['colorLookup', { lut: 'matte', k: 100 }], ['light', { exposure: 0, contrast: -15, highlights: 0, shadows: 0, whites: 0, blacks: 0 }]] },
    { name: 'Cyberpunk', cat: 'Créatif', steps: [['colorLookup', { lut: 'cyber', k: 100 }], ['clarity', { clarity: 25, dehaze: 10 }]] },
  ],
  brushes: [
    { name: 'Rond dur', o: { shape: 'round', size: 20, hardness: 100, opacity: 100, flow: 100, spacing: 0, scatter: 0, sizeJit: 0, opJit: 0, angJit: 0, round: 100, angle: 0, air: false, pressure: true } },
    { name: 'Rond flou', o: { shape: 'round', size: 60, hardness: 0, opacity: 100, flow: 60, spacing: 0, scatter: 0, sizeJit: 0, opJit: 0, angJit: 0, round: 100, angle: 0, air: false } },
    { name: 'Encre (pression)', o: { shape: 'round', size: 12, hardness: 95, opacity: 100, flow: 100, spacing: 5, pressure: true, sizeJit: 0, round: 100, angle: 0 } },
    { name: 'Crayon gras', o: { shape: 'chalk', size: 10, hardness: 80, opacity: 90, flow: 80, spacing: 15, sizeJit: 10, opJit: 20 } },
    { name: 'Marqueur', o: { shape: 'square', size: 26, hardness: 100, opacity: 70, flow: 100, spacing: 8, round: 45, angle: 30 } },
    { name: 'Calligraphie', o: { shape: 'round', size: 34, hardness: 95, opacity: 100, flow: 100, spacing: 4, round: 18, angle: 45, angJit: 0 } },
    { name: 'Craie', o: { shape: 'chalk', size: 40, hardness: 50, opacity: 100, flow: 90, spacing: 18, sizeJit: 15, opJit: 30, angJit: 100 } },
    { name: 'Pastel sec', o: { shape: 'chalk', size: 55, hardness: 30, opacity: 80, flow: 50, spacing: 20, sizeJit: 25, opJit: 40, scatter: 15, angJit: 100 } },
    { name: 'Aérographe', o: { shape: 'round', size: 90, hardness: 0, opacity: 100, flow: 12, spacing: 10, air: true } },
    { name: 'Aquarelle', o: { shape: 'round', size: 80, hardness: 10, opacity: 45, flow: 25, spacing: 12, sizeJit: 20, opJit: 30 } },
    { name: 'Spray', o: { shape: 'spray', size: 70, hardness: 50, opacity: 100, flow: 100, spacing: 15 } },
    { name: 'Feuillage', o: { shape: 'leaf', size: 45, hardness: 90, opacity: 100, flow: 100, spacing: 60, scatter: 90, sizeJit: 60, angJit: 100, opJit: 20 } },
    { name: 'Herbe', o: { shape: 'calli', size: 40, hardness: 90, opacity: 100, flow: 100, spacing: 35, scatter: 40, sizeJit: 50, angle: 90, angJit: 20, round: 25 } },
    { name: 'Mandala', o: { shape: 'round', size: 8, hardness: 90, opacity: 100, flow: 100, spacing: 5, sym: 'mand' } },
  ],
  styles: [
    { name: 'Ombre douce', fx: { shadow: { on: true, color: '#000000', opacity: 45, angle: 120, dist: 8, size: 24 } } },
    { name: 'Ombre forte', fx: { shadow: { on: true, color: '#000000', opacity: 85, angle: 135, dist: 14, size: 2 } } },
    { name: 'Autocollant', fx: { stroke: { on: true, color: '#ffffff', opacity: 100, size: 10 }, shadow: { on: true, color: '#000000', opacity: 40, angle: 120, dist: 5, size: 10 } } },
    { name: 'Contour noir', fx: { stroke: { on: true, color: '#000000', opacity: 100, size: 6 } } },
    { name: 'Néon bleu', fx: { overlay: { on: true, color: '#e6fbff', opacity: 100 }, glow: { on: true, color: '#18c8ff', opacity: 100, size: 30 }, stroke: { on: true, color: '#18c8ff', opacity: 100, size: 2 } } },
    { name: 'Néon rose', fx: { overlay: { on: true, color: '#fff0fb', opacity: 100 }, glow: { on: true, color: '#ff2fb4', opacity: 100, size: 30 }, stroke: { on: true, color: '#ff2fb4', opacity: 100, size: 2 } } },
    { name: 'Or', fx: { gradient: { on: true, a: '#fff2a8', b: '#b8860b', angle: 90, opacity: 100 }, bevel: { on: true, angle: 120, depth: 8, size: 6, hi: 80, sh: 60 }, shadow: { on: true, color: '#3a2500', opacity: 50, angle: 120, dist: 6, size: 10 } } },
    { name: 'Chrome', fx: { gradient: { on: true, a: '#ffffff', b: '#5c6670', angle: 90, opacity: 100 }, bevel: { on: true, angle: 120, depth: 10, size: 4, hi: 90, sh: 70 }, stroke: { on: true, color: '#2b3036', opacity: 100, size: 1 } } },
    { name: 'Relief', fx: { bevel: { on: true, angle: 120, depth: 6, size: 8, hi: 70, sh: 60 } } },
    { name: 'Verre', fx: { overlay: { on: true, color: '#ffffff', opacity: 25 }, inner: { on: true, color: '#ffffff', opacity: 60, angle: -60, dist: 4, size: 12 }, stroke: { on: true, color: '#ffffff', opacity: 60, size: 1 }, shadow: { on: true, color: '#000000', opacity: 25, angle: 120, dist: 6, size: 18 } } },
    { name: 'Rétro 80', fx: { gradient: { on: true, a: '#ffe259', b: '#ff2e88', angle: 90, opacity: 100 }, stroke: { on: true, color: '#2a0845', opacity: 100, size: 4 }, shadow: { on: true, color: '#00e5ff', opacity: 100, angle: 135, dist: 10, size: 0 } } },
    { name: 'Coucher de soleil', fx: { gradient: { on: true, a: '#ff9a3c', b: '#ff2f6e', angle: 90, opacity: 100 } } },
    { name: 'Lueur chaude', fx: { glow: { on: true, color: '#ffb347', opacity: 85, size: 26 } } },
    { name: 'Bouton', fx: { gradient: { on: true, a: '#6fa3ff', b: '#2b5cd6', angle: 90, opacity: 100 }, bevel: { on: true, angle: 90, depth: 4, size: 6, hi: 60, sh: 40 }, shadow: { on: true, color: '#000000', opacity: 35, angle: 90, dist: 4, size: 8 } } },
  ],
  gradients: [
    ['Arc-en-ciel', [[0, '#ff0000'], [0.17, '#ff9900'], [0.33, '#ffff00'], [0.5, '#00cc44'], [0.67, '#00aaff'], [0.83, '#4b00ff'], [1, '#cc00ff']]],
    ['Coucher de soleil', [[0, '#2b1b5a'], [0.5, '#c4557a'], [1, '#ffb46b']]], ['Océan', [[0, '#0f2027'], [0.5, '#203a43'], [1, '#2c9bb3']]],
    ['Pêche', [[0, '#ffecd2'], [1, '#fcb69f']]], ['Néon', [[0, '#00f5ff'], [1, '#ff00e5']]], ['Forêt', [[0, '#134e5e'], [1, '#71b280']]],
    ['Or', [[0, '#7a5c00'], [0.45, '#ffe680'], [0.55, '#fff6c9'], [1, '#8c6a00']]], ['Chrome', [[0, '#e8e8e8'], [0.48, '#7d848c'], [0.52, '#2c3036'], [1, '#d5d8dc']]],
    ['Pastel', [[0, '#a1c4fd'], [1, '#c2e9fb']]], ['Feu', [[0, '#200000'], [0.4, '#c81d00'], [0.75, '#ff9a00'], [1, '#fff3a0']]],
    ['Aurore', [[0, '#00c9ff'], [1, '#92fe9d']]], ['Nuit', [[0, '#0f0c29'], [0.5, '#302b63'], [1, '#24243e']]],
    ['Noir → transparent', [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]], ['Blanc → transparent', [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]],
  ],
  patterns: {
    'Damier': (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = '#222'; c.fillRect(0, 0, s / 2, s / 2); c.fillRect(s / 2, s / 2, s / 2, s / 2); },
    'Rayures': (c, s) => { c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, s, s); c.strokeStyle = '#3e8ef7'; c.lineWidth = s / 6; for (let i = -s; i < 2 * s; i += s / 2) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + s, s); c.stroke(); } },
    'Pois': (c, s) => { c.fillStyle = '#ffe9ef'; c.fillRect(0, 0, s, s); c.fillStyle = '#ff4d79'; [[s / 4, s / 4], [3 * s / 4, 3 * s / 4]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, s / 9, 0, 7); c.fill(); }); },
    'Briques': (c, s) => { c.fillStyle = '#e6e0d8'; c.fillRect(0, 0, s, s); c.fillStyle = '#b5532f'; const h = s / 4; for (let r = 0; r < 4; r++) for (let k = -1; k < 2; k++) c.fillRect(k * s / 2 + (r % 2 ? s / 4 : 0) + 2, r * h + 2, s / 2 - 4, h - 4); },
    'Grille': (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.strokeStyle = '#9fb3c8'; c.lineWidth = 1; for (let i = 0; i <= s; i += s / 4) { c.beginPath(); c.moveTo(i + 0.5, 0); c.lineTo(i + 0.5, s); c.moveTo(0, i + 0.5); c.lineTo(s, i + 0.5); c.stroke(); } },
    'Losanges': (c, s) => { c.fillStyle = '#1e2a44'; c.fillRect(0, 0, s, s); c.fillStyle = '#e8c76a'; c.beginPath(); c.moveTo(s / 2, 0); c.lineTo(s, s / 2); c.lineTo(s / 2, s); c.lineTo(0, s / 2); c.closePath(); c.fill(); },
    'Tissu': (c, s) => { c.fillStyle = '#c9b79c'; c.fillRect(0, 0, s, s); c.strokeStyle = 'rgba(80,60,40,.35)'; for (let i = 0; i < s; i += 3) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.stroke(); c.beginPath(); c.moveTo(0, i + 1); c.lineTo(s, i + 1); c.stroke(); } },
    'Papier': (c, s) => { const id = c.createImageData(s, s); for (let i = 0; i < id.data.length; i += 4) { const v = 236 + Math.random() * 19; id.data[i] = v; id.data[i + 1] = v - 3; id.data[i + 2] = v - 10; id.data[i + 3] = 255; } c.putImageData(id, 0, 0); },
    'Bois': (c, s) => { for (let y = 0; y < s; y++) { const v = Math.sin(y * 0.35 + Math.sin(y * 0.05) * 4) * 0.5 + 0.5; c.fillStyle = `rgb(${150 + v * 40},${95 + v * 30},${55 + v * 20})`; c.fillRect(0, y, s, 1); } },
    'Étoiles': (c, s) => { c.fillStyle = '#0b1030'; c.fillRect(0, 0, s, s); c.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { c.globalAlpha = Math.random(); c.beginPath(); c.arc(Math.random() * s, Math.random() * s, Math.random() * 1.6, 0, 7); c.fill(); } c.globalAlpha = 1; },
  },
};
MP.makePattern = (name, s = 64) => { const c = MP.createCanvas(s, s); MP.PRESETS.patterns[name](c.getContext('2d'), s); return c; };
MP.applyAdjustPreset = (p) => {
  const d = MP.doc; if (!d) return;
  d.history.record('Préréglage : ' + p.name, null);
  const g = new MP.Layer(1, 1, 'Préréglage – ' + p.name); g.isGroup = true; g.blend = 'pass-through'; g.parent = d.layer ? d.layer.parent : null;
  d.layers.splice(d.active + 1, 0, g);
  for (const [key, values] of p.steps) { const spec = MP.ADJUST[key]; const l = new MP.Layer(1, 1, spec.title); l.adjust = { key, values: JSON.parse(JSON.stringify(values)) }; l.parent = g.id; const m = MP.createCanvas(d.width, d.height), mc = m.getContext('2d'); mc.fillStyle = '#fff'; mc.fillRect(0, 0, d.width, d.height); l.mask = m; d.layers.splice(d.layers.indexOf(g), 0, l); }
  d.normalize(); d.active = d.layers.indexOf(g); d.editMask = false; MP.afterEdit(); MP.ui.refreshAll(); MP.toast('Préréglage appliqué (groupe de calques de réglage modifiables)');
};
MP.applyStylePreset = (p) => {
  const d = MP.doc; if (!d) return; const l = d.layer; if (!l || l.isGroup || l.adjust) { MP.toast('Sélectionnez un calque de pixels ou de texte'); return; }
  d.history.record('Style : ' + p.name, null); const fx = MP.fx.defaults(); for (const [k, v] of Object.entries(p.fx)) Object.assign(fx[k], v); l.fx = fx; MP.afterEdit();
};

/* =================== Modèles (écran d'accueil) =================== */
{
  const addText = (d, t, center) => {
    const l = d.addLayer(t.name || 'Texte'); l.parent = null;
    l.text = Object.assign({ x: 0, y: 0, content: 'Texte', font: 'Arial', size: 60, bold: false, italic: false, underline: false, color: '#ffffff', align: 'center', lineHeight: 1.15, spacing: 0, stroke: false, strokeColor: '#000000', strokeWidth: 2, shadow: false }, t);
    delete l.text.name; MP.renderText(l);
    if (center) { l.text.x = Math.round((d.width - l.text._b.w) / 2); MP.renderText(l); }
    return l;
  };
  const shape = (d, name, fn) => { const l = d.addLayer(name); l.parent = null; fn(l.ctx); return l; };
  const shp = (c, kind, a, b, color) => { const k = MP.colors.fg; MP.colors.fg = color; MP.drawShape(c, kind, a, b, { fill: true, strokeWidth: 0 }); MP.colors.fg = k; };
  const grad = (c, w, h, stops, vertical) => { const g = vertical ? c.createLinearGradient(0, 0, 0, h) : c.createLinearGradient(0, 0, w, h); stops.forEach(([t, col]) => g.addColorStop(t, col)); c.fillStyle = g; c.fillRect(0, 0, w, h); };
  const fx = (l, name) => { const p = MP.PRESETS.styles.find((s) => s.name === name); const f = MP.fx.defaults(); for (const [k, v] of Object.entries(p.fx)) Object.assign(f[k], v); l.fx = f; };
  MP.TEMPLATES = [
    { name: 'Affiche promo', w: 1080, h: 1350, build(d) {
      grad(d.layers[0].ctx, d.width, d.height, [[0, '#0f2027'], [0.5, '#203a43'], [1, '#2c5364']]);
      shape(d, 'Cercle', (c) => { const g = c.createRadialGradient(760, 520, 30, 760, 520, 380); g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#ef476f'); c.fillStyle = g; c.beginPath(); c.arc(760, 520, 380, 0, 7); c.fill(); });
      const t = addText(d, { name: 'Titre', content: 'SOLDES\nD\'HIVER', font: 'Arial Black', size: 170, bold: true, y: 380, lineHeight: 1 }, true); fx(t, 'Ombre douce');
      addText(d, { name: 'Sous-titre', content: 'Jusqu\'à -50 % sur toute la boutique', size: 48, color: '#ffd166', y: 800 }, true);
      shape(d, 'Bouton', (c) => { c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(340, 1000, 400, 110, 55); c.fill(); });
      addText(d, { name: 'Texte du bouton', content: 'J\'EN PROFITE', size: 44, bold: true, color: '#203a43', y: 1028 }, true);
    } },
    { name: 'Post Instagram citation', w: 1080, h: 1080, build(d) {
      grad(d.layers[0].ctx, d.width, d.height, [[0, '#fbe3d6'], [1, '#f3b3c3']]);
      addText(d, { name: 'Guillemets', content: '“', font: 'Georgia', size: 300, color: '#d0567a', y: 120 }, true);
      addText(d, { name: 'Citation', content: 'Le succès, c\'est tomber\nsept fois et se relever\nhuit.', font: 'Georgia', size: 70, italic: true, color: '#3a2233', y: 420 }, true);
      addText(d, { name: 'Auteur', content: '— Proverbe japonais', size: 38, color: '#7a4a5e', y: 820 }, true);
    } },
    { name: 'Miniature YouTube', w: 1280, h: 720, build(d) {
      grad(d.layers[0].ctx, d.width, d.height, [[0, '#ff512f'], [1, '#dd2476']]);
      shape(d, 'Bandeau', (c) => { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 430, 1280, 230); });
      const t = addText(d, { name: 'Titre', content: 'TUTO EN 5 MIN', font: 'Impact', size: 150, color: '#ffffff', stroke: true, strokeColor: '#000000', strokeWidth: 8, x: 60, y: 460, align: 'left' }); fx(t, 'Ombre forte');
      shape(d, 'Flèche', (c) => shp(c, 'arrowblock', { x: 860, y: 130 }, { x: 1180, y: 330 }, '#ffe600'));
      addText(d, { name: 'Badge', content: 'NOUVEAU', size: 46, bold: true, color: '#ffe600', x: 70, y: 70, align: 'left' });
    } },
    { name: 'Fiche produit e-commerce', w: 2000, h: 2000, build(d) {
      d.layers[0].ctx.fillStyle = '#ffffff'; d.layers[0].ctx.fillRect(0, 0, 2000, 2000);
      shape(d, 'Zone photo produit', (c) => { c.fillStyle = '#f2f3f5'; c.beginPath(); c.roundRect(200, 200, 1600, 1600, 60); c.fill(); c.setLineDash([30, 20]); c.lineWidth = 6; c.strokeStyle = '#c4c8cf'; c.stroke(); });
      addText(d, { name: 'Consigne', content: 'Glissez-déposez votre photo produit ici', size: 64, color: '#8a909a', y: 960 }, true);
      shape(d, 'Pastille promo', (c) => shp(c, 'badge', { x: 1500, y: 120 }, { x: 1880, y: 500 }, '#e5484d'));
      addText(d, { name: 'Remise', content: '-30%', size: 120, bold: true, color: '#ffffff', x: 1555, y: 245, align: 'left' });
    } },
    { name: 'Carte de visite', w: 1050, h: 600, build(d) {
      d.layers[0].ctx.fillStyle = '#ffffff'; d.layers[0].ctx.fillRect(0, 0, 1050, 600);
      shape(d, 'Bande', (c) => { grad(c, 260, 600, [[0, '#4f7cff'], [1, '#7b5cff']], true); });
      addText(d, { name: 'Nom', content: 'Prénom Nom', size: 64, bold: true, color: '#1f1f24', x: 320, y: 150, align: 'left' });
      addText(d, { name: 'Fonction', content: 'Consultant SEO & e-commerce', size: 34, color: '#4f7cff', x: 320, y: 240, align: 'left' });
      addText(d, { name: 'Coordonnées', content: 'contact@exemple.fr\n06 00 00 00 00\nwww.exemple.fr', size: 28, color: '#55555f', x: 320, y: 360, align: 'left', lineHeight: 1.5 });
    } },
    { name: 'Bannière web', w: 1500, h: 500, build(d) {
      grad(d.layers[0].ctx, d.width, d.height, [[0, '#141e30'], [1, '#243b55']]);
      const t = addText(d, { name: 'Titre', content: 'Lancez votre boutique en ligne', size: 84, bold: true, color: '#ffffff', y: 130 }, true); fx(t, 'Ombre douce');
      addText(d, { name: 'Accroche', content: 'Création Shopify & WordPress — référencement inclus', size: 38, color: '#a8c6ff', y: 260 }, true);
      shape(d, 'Bouton', (c) => { c.fillStyle = '#4f7cff'; c.beginPath(); c.roundRect(600, 350, 300, 84, 42); c.fill(); });
      addText(d, { name: 'Texte du bouton', content: 'Découvrir', size: 36, bold: true, y: 370 }, true);
    } },
  ];
  MP.buildTemplate = (t, add = true) => {
    const d = new MP.Doc(t.w, t.h, t.name); const bg = d.addLayer('Arrière-plan', 0); bg.ctx.fillStyle = '#ffffff'; bg.ctx.fillRect(0, 0, t.w, t.h);
    const keep = MP.doc; MP.doc = d; t.build(d); d.normalize(); d.active = d.layers.length - 1; if (!add) MP.doc = keep;
    if (add) { MP.doc = keep; MP.addDoc(d); }
    return d;
  };
}
