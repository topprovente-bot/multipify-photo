'use strict';
/* v3 — Outils : correcteur, pièce, déplacement basé sur le contenu, suppression, tampon de motif, forme d'historique,
   gommes d'arrière-plan et magique, sélections ligne/colonne, lasso magnétique, sélection d'objet, recadrage perspective, règle, échantillonneur */

const T3 = (t) => { MP.tools[t.id] = t; t.opts = MP.settings.tools[t.id] = Object.assign({}, t.defaults || {}); if (!MP.toolOrder.includes(t.id)) MP.toolOrder.push(t.id); return t; };
const BR = [{ k: 'size', label: 'Taille', type: 'range', min: 1, max: 1000, unit: 'px' }, { k: 'hardness', label: 'Dureté', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'opacity', label: 'Opacité', type: 'range', min: 1, max: 100, unit: '%' }, { k: 'flow', label: 'Flux', type: 'range', min: 1, max: 100, unit: '%' }];
const selMode = (e, def) => (e.shiftKey && e.altKey ? 'inter' : e.shiftKey ? 'add' : e.altKey ? 'sub' : def || 'new');

/* ---------- Homographie (carré unité → quadrilatère) ---------- */
MP.homography = (q) => {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q.map((p) => [p.x, p.y]);
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0; const den = dx1 * dy2 - dx2 * dy1;
  if ((dx3 || dy3) && den) { g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return (u, v) => { const w = g * u + h * v + 1; return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w }; };
};

/* ---------- Fusion « sans raccord » (clonage Poisson approché par membrane) ---------- */
MP.seamless = (target, source, ox, oy, mask, margin = 8) => {
  const b = MP.alphaBounds(mask, 0); if (!b) return false;
  const W = target.width, H = target.height;
  const x0 = Math.max(0, b.x - margin), y0 = Math.max(0, b.y - margin), x1 = Math.min(W, b.x + b.w + margin), y1 = Math.min(H, b.y + b.h + margin), w = x1 - x0, h = y1 - y0;
  const tc = target.getContext('2d'), tid = tc.getImageData(x0, y0, w, h), T = tid.data;
  const S = source.getContext('2d').getImageData(x0 + ox, y0 + oy, w, h).data, M = mask.getContext('2d').getImageData(x0, y0, w, h).data;
  const D = new Uint8ClampedArray(w * h * 4), unk = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) { unk[p] = M[p * 4 + 3] > 0 ? 1 : 0; for (let c = 0; c < 3; c++) D[p * 4 + c] = (T[p * 4 + c] - S[p * 4 + c]) / 2 + 128; D[p * 4 + 3] = 255; }
  const F = MP.inpaint(D, w, h, unk);
  for (let p = 0; p < w * h; p++) {
    const a = M[p * 4 + 3] / 255; if (a <= 0) continue;
    for (let c = 0; c < 3; c++) T[p * 4 + c] = MP.lerp(T[p * 4 + c], S[p * 4 + c] + (F[p * 4 + c] - 128) * 2, a);
    T[p * 4 + 3] = MP.lerp(T[p * 4 + 3], Math.max(T[p * 4 + 3], S[p * 4 + 3]), a);
  }
  tc.putImageData(tid, x0, y0); return true;
};

/* ---------- Pinceaux « échantillonneurs » (correcteur, motif, historique) ---------- */
const sampleBrush = (cfg) => T3({
  ...cfg, cursor: 'none',
  defaults: { size: 40, hardness: 50, opacity: 100, flow: 100, aligned: true, ...(cfg.defaults || {}) },
  options: [...BR, ...(cfg.alt ? [{ k: 'aligned', label: 'Aligné', type: 'check' }] : []), ...(cfg.extra || [])],
  brushCursor() { return this.opts.size; },
  down(p, e) {
    const d = MP.doc;
    if (cfg.alt && e.altKey) { this.src = { x: p.x, y: p.y }; this.offset = null; MP.toast('Source définie'); return; }
    if (cfg.alt && !this.src) { MP.toast('Alt + clic pour définir la source'); return; }
    if (!MP.canEditPixels()) return;
    const snap = cfg.snap.call(this, d); if (!snap) return;
    const o = this.opts;
    if (cfg.alt) { if (!this.offset || !o.aligned) this.offset = { x: this.src.x - p.x, y: this.src.y - p.y }; } else this.offset = { x: 0, y: 0 };
    d.history.record(cfg.name, [d.layer.id]); MP.rasterize(d.layer);
    this.snap = snap; this.off = { ...this.offset };
    const stamp = MP.makeStamp(o.size, o.hardness / 100, '#ffffff'), tc = MP.createCanvas(stamp.width, stamp.height), tx = tc.getContext('2d'), off = this.off, half = stamp.width / 2;
    this.eng = new MP.StrokeEngine(d, o.size * 0.1, (c, x, y) => {
      tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, tc.width, tc.height); tx.drawImage(stamp, 0, 0);
      tx.globalCompositeOperation = 'source-in'; tx.drawImage(snap, -(x + off.x - half), -(y + off.y - half));
      c.globalAlpha = cfg.heal ? 1 : o.flow / 100; c.drawImage(tc, x - half, y - half);
    });
    const eng = this.eng;
    MP.live = { layer: d.layer, target: 'layer', draw: (ctx) => { ctx.globalAlpha = cfg.heal ? 1 : o.opacity / 100; ctx.drawImage(eng.clipped(), 0, 0); } };
    eng.to(p); MP.render();
  },
  move(p) { if (this.eng) { this.eng.to(p); MP.render(); } },
  up() {
    if (!this.eng) return;
    const d = MP.doc, l = d.layer;
    if (cfg.heal) { const m = this.eng.clipped(); MP.live = null; MP.seamless(l.canvas, this.snap, this.off.x, this.off.y, m, Math.ceil(this.opts.size / 2) + 4); }
    else { const c = l.ctx; c.save(); MP.live.draw(c); c.restore(); }
    this.eng = null; this.snap = null; MP.afterEdit();
  },
  overlay(ctx) {
    if (!cfg.alt) return; const v = MP.view; if (!this.src || !v.cursor) return;
    const sp = this.offset ? { x: v.cursor.x + this.offset.x, y: v.cursor.y + this.offset.y } : this.src, s = MP.docToScreen(sp), dpr = v.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s.x - 8, s.y); ctx.lineTo(s.x + 8, s.y); ctx.moveTo(s.x, s.y - 8); ctx.lineTo(s.x, s.y + 8); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x, s.y, (this.opts.size / 2) * MP.doc.zoom, 0, 7); ctx.setLineDash([3, 3]); ctx.stroke();
  },
  cancel() { this.eng = null; },
});
sampleBrush({ id: 'healbrush', name: 'Correcteur', icon: 'healbrush', alt: true, heal: true, hint: 'Alt + clic : source. Le résultat s\'adapte à la lumière et aux couleurs de la zone corrigée',
  snap(d) { return MP.cloneCanvas(d.layer.canvas); } });
sampleBrush({ id: 'patternstamp', name: 'Tampon de motif', icon: 'patternstamp', hint: 'Peint le motif défini avec Édition > Définir un motif',
  snap(d) { if (!MP.pattern) { MP.toast('Définissez d\'abord un motif : sélection puis Édition > Définir un motif'); return null; } const c = MP.createCanvas(d.width, d.height), x = c.getContext('2d'); x.fillStyle = x.createPattern(MP.pattern, 'repeat'); x.fillRect(0, 0, d.width, d.height); return c; } });
sampleBrush({ id: 'historybrush', name: 'Forme d\'historique', icon: 'historybrush', hint: 'Repeint l\'état d\'origine du calque (ou l\'instantané défini dans l\'Historique)',
  snap(d) { const s = d.histSrc && d.histSrc.get(d.layer.id); if (!s || s.width !== d.width || s.height !== d.height) { MP.toast('Aucun état source pour ce calque — Historique > Définir la source'); return null; } return s; } });
MP.setHistorySource = (d) => { d.histSrc = new Map(d.layers.filter((l) => !l.isGroup && !l.adjust).map((l) => [l.id, MP.cloneCanvas(l.canvas)])); };

/* ---------- Outil Suppression (Remove) ---------- */
T3({
  id: 'remove', name: 'Suppression', icon: 'remove', cursor: 'none',
  defaults: { size: 50, ai: false }, options: [{ k: 'size', label: 'Taille', type: 'range', min: 4, max: 600, unit: 'px' }, { k: 'ai', label: '✨ Utiliser l\'IA (objets volumineux)', type: 'check' }],
  hint: 'Peignez sur l\'objet ou la personne à faire disparaître',
  brushCursor() { return this.opts.size; },
  down(p) {
    const d = MP.doc; if (!MP.canEditPixels()) return;
    const stamp = MP.makeStamp(this.opts.size, 0.85, '#ffffff');
    this.eng = new MP.StrokeEngine(d, this.opts.size * 0.15, (c, x, y) => c.drawImage(stamp, x - stamp.width / 2, y - stamp.height / 2));
    const eng = this.eng; MP.live = { layer: d.layer, target: 'layer', draw: (ctx) => { ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'source-atop'; ctx.filter = 'sepia(1) saturate(6) hue-rotate(300deg)'; ctx.drawImage(eng.canvas, 0, 0); ctx.filter = 'none'; } };
    eng.to(p); MP.render();
  },
  move(p) { if (this.eng) { this.eng.to(p); MP.render(); } },
  up() {
    if (!this.eng) return; const d = MP.doc, m = MP.sel.blurred(this.eng.clipped(), 2); this.eng = null; MP.live = null;
    if (this.opts.ai && MP.prefs.aiKey) { const saved = d.selection; d.selection = m; MP.ai.generativeFill('').then(() => { if (saved && !d.selection) { d.selection = saved; MP.sel.updatePath(d); } MP.render(); }); return; }
    MP.busy('Suppression…', () => { d.history.record('Suppression', [d.layer.id]); MP.rasterize(d.layer); MP.healRegion(d.layer.canvas, m, Math.round(this.opts.size * 1.5) + 8); MP.afterEdit(); });
  },
  cancel() { this.eng = null; MP.live = null; },
});

/* ---------- Pièce & déplacement basé sur le contenu ---------- */
const dragSelTool = (cfg) => T3({
  ...cfg, cursor: 'default',
  down(p) {
    const d = MP.doc; if (!MP.canEditPixels()) return;
    if (!d.selection) { MP.toast(cfg.needSel); return; }
    const a = d.selection.getContext('2d').getImageData(MP.clamp(Math.floor(p.x), 0, d.width - 1), MP.clamp(Math.floor(p.y), 0, d.height - 1), 1, 1).data[3];
    if (a < 128) { MP.toast('Cliquez à l\'intérieur de la sélection puis faites-la glisser'); return; }
    this.p0 = p; this.dx = this.dy = 0; this.on = true;
  },
  move(p) { if (!this.on) return; this.dx = Math.round(p.x - this.p0.x); this.dy = Math.round(p.y - this.p0.y); MP.renderView(); },
  up() { if (!this.on) return; this.on = false; if (Math.abs(this.dx) + Math.abs(this.dy) < 2) return; MP.busy(cfg.name + '…', () => cfg.apply.call(this, MP.doc, this.dx, this.dy)); },
  overlay(ctx) {
    const d = MP.doc; if (!this.on || !d.selPath) return; MP.overlayDocTransform(ctx); const z = d.zoom;
    ctx.translate(this.dx, this.dy); ctx.lineWidth = 1.5 / z; ctx.setLineDash([5 / z, 4 / z]); ctx.strokeStyle = '#2d8cff'; ctx.stroke(d.selPath);
  },
  cancel() { this.on = false; },
});
dragSelTool({ id: 'patch', name: 'Pièce', icon: 'patch', defaults: { mode: 'source' }, options: [{ k: 'mode', label: 'Mode', type: 'select', options: [['source', 'Source (remplacer la zone sélectionnée)'], ['dest', 'Destination (copier la zone ailleurs)']] }],
  needSel: 'Entourez d\'abord la zone à réparer (lasso), puis faites glisser la sélection vers une zone propre', hint: 'Faites glisser la sélection vers la zone qui servira de modèle',
  apply(d, dx, dy) {
    const l = d.layer; d.history.record('Pièce', [l.id]); MP.rasterize(l); const snap = MP.cloneCanvas(l.canvas), m = MP.sel.blurred(d.selection, 1.5);
    if (this.opts.mode === 'source') MP.seamless(l.canvas, snap, dx, dy, m, 10);
    else { const sm = MP.createCanvas(d.width, d.height); sm.getContext('2d').drawImage(m, dx, dy); MP.seamless(l.canvas, snap, -dx, -dy, sm, 10); }
    MP.afterEdit();
  } });
dragSelTool({ id: 'camove', name: 'Déplacement basé sur le contenu', icon: 'camove', defaults: { mode: 'move' }, options: [{ k: 'mode', label: 'Mode', type: 'select', options: [['move', 'Déplacer'], ['extend', 'Étendre (dupliquer)']] }],
  needSel: 'Sélectionnez d\'abord l\'objet à déplacer', hint: 'Faites glisser l\'objet sélectionné : l\'arrière-plan est reconstruit automatiquement',
  apply(d, dx, dy) {
    const l = d.layer; d.history.record('Déplacement basé sur le contenu', [l.id]); MP.rasterize(l);
    const obj = MP.cloneCanvas(l.canvas), m = MP.sel.blurred(d.selection, 1.5);
    if (this.opts.mode === 'move') MP.healRegion(l.canvas, MP.dilate(d.selection, 5), 30);
    const sm = MP.createCanvas(d.width, d.height); sm.getContext('2d').drawImage(m, dx, dy);
    MP.seamless(l.canvas, obj, -dx, -dy, sm, 8);
    const ns = MP.createCanvas(d.width, d.height); ns.getContext('2d').drawImage(d.selection, dx, dy); d.selection = ns; MP.sel.updatePath(d);
    MP.afterEdit();
  } });

/* ---------- Gommes ---------- */
T3({
  id: 'bgeraser', name: 'Gomme d\'arrière-plan', icon: 'bgeraser', cursor: 'none',
  defaults: { size: 50, tolerance: 30 }, options: [{ k: 'size', label: 'Taille', type: 'range', min: 2, max: 500, unit: 'px' }, { k: 'tolerance', label: 'Tolérance', type: 'range', min: 1, max: 100, unit: '%' }],
  hint: 'Efface la couleur située sous le centre du pinceau en préservant les contours',
  brushCursor() { return this.opts.size; },
  down(p) { const d = MP.doc; if (!MP.canEditPixels()) return; d.history.record(this.name, [d.layer.id]); MP.rasterize(d.layer); this.eng = new MP.StrokeEngine(d, this.opts.size * 0.2, (c, x, y) => this.dab(x, y)); this.eng.to(p); MP.render(); },
  dab(x, y) {
    const d = MP.doc, cv = d.layer.canvas, r = this.opts.size / 2, R = Math.ceil(r);
    const x0 = Math.max(0, Math.round(x) - R), y0 = Math.max(0, Math.round(y) - R), w = Math.min(cv.width, Math.round(x) + R + 1) - x0, h = Math.min(cv.height, Math.round(y) + R + 1) - y0; if (w <= 0 || h <= 0) return;
    const ctx = cv.getContext('2d'), id = ctx.getImageData(x0, y0, w, h), a = id.data;
    const ci = (MP.clamp(Math.round(y) - y0, 0, h - 1) * w + MP.clamp(Math.round(x) - x0, 0, w - 1)) * 4, sr = a[ci], sg = a[ci + 1], sb = a[ci + 2], tol = this.opts.tolerance * 2.55;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const dist = Math.hypot(x0 + xx + 0.5 - x, y0 + yy + 0.5 - y) / r; if (dist > 1) continue;
      const i = (yy * w + xx) * 4, cd = Math.max(Math.abs(a[i] - sr), Math.abs(a[i + 1] - sg), Math.abs(a[i + 2] - sb));
      if (cd > tol) continue; const f = (1 - Math.pow(dist, 4)) * (1 - Math.pow(cd / (tol + 1), 2));
      a[i + 3] = a[i + 3] * (1 - f);
    }
    ctx.putImageData(id, x0, y0); d.layer._v = (d.layer._v || 0) + 1;
  },
  move(p) { if (this.eng) { this.eng.to(p); MP.render(); } },
  up() { if (this.eng) { this.eng = null; MP.afterEdit(); } },
  cancel() { this.eng = null; },
});
T3({
  id: 'magiceraser', name: 'Gomme magique', icon: 'magiceraser', cursor: 'crosshair',
  defaults: { tolerance: 32, contiguous: true }, options: [{ k: 'tolerance', label: 'Tolérance', type: 'range', min: 0, max: 100 }, { k: 'contiguous', label: 'Pixels contigus', type: 'check' }],
  hint: 'Cliquez sur une couleur pour l\'effacer (fond uni, ciel…)',
  down(p) {
    const d = MP.doc; if (!MP.canEditPixels()) return;
    const m = MP.floodMask(d.layer.canvas, p.x, p.y, this.opts.tolerance, this.opts.contiguous); if (!m) return;
    d.clipToSelection(m); d.history.record(this.name, [d.layer.id]); MP.rasterize(d.layer);
    const c = d.layer.ctx; c.save(); c.globalCompositeOperation = 'destination-out'; c.drawImage(MP.sel.blurred(m, 0.6), 0, 0); c.restore(); MP.afterEdit();
  },
});

/* ---------- Sélections ligne / colonne unique ---------- */
for (const [id, name, icon, row] of [['rowmarquee', 'Sélection ligne unique', 'rowmarquee', true], ['colmarquee', 'Sélection colonne unique', 'colmarquee', false]]) {
  T3({ id, name, icon, cursor: 'crosshair', options: [], hint: 'Cliquez pour sélectionner une ' + (row ? 'ligne' : 'colonne') + ' de 1 pixel (Maj : ajouter)',
    down(p, e) { const d = MP.doc, x = Math.floor(p.x), y = Math.floor(p.y); d.history.record(name, null); MP.sel.apply(d, selMode(e), (c) => (row ? c.fillRect(0, y, d.width, 1) : c.fillRect(x, 0, 1, d.height))); MP.ui.refreshAll(); MP.render(); } });
}

/* ---------- Lasso magnétique ---------- */
T3({
  id: 'maglasso', name: 'Lasso magnétique', icon: 'maglasso', cursor: 'crosshair',
  defaults: { width: 10, freq: 14, mode: 'new' },
  options: [{ k: 'width', label: 'Largeur de détection', type: 'range', min: 2, max: 40, unit: 'px' }, { k: 'freq', label: 'Fréquence', type: 'range', min: 4, max: 60, unit: 'px' }],
  hint: 'Cliquez sur le bord de l\'objet puis suivez-le sans cliquer. Double-clic ou Entrée pour fermer',
  edges() {
    const d = MP.doc, c = d.composite(null, { noLive: true }), s = c.getContext('2d').getImageData(0, 0, d.width, d.height).data;
    this.E = MP.sobel(MP.grayOf(s, d.width * d.height), d.width, d.height);
  },
  snap(p) {
    const d = MP.doc, R = this.opts.width, E = this.E; let best = -1, bx = p.x, by = p.y;
    for (let y = Math.max(0, Math.round(p.y) - R); y <= Math.min(d.height - 1, Math.round(p.y) + R); y++) for (let x = Math.max(0, Math.round(p.x) - R); x <= Math.min(d.width - 1, Math.round(p.x) + R); x++) {
      const v = E[y * d.width + x] - Math.hypot(x - p.x, y - p.y) * 2; if (v > best) { best = v; bx = x; by = y; }
    }
    return { x: bx + 0.5, y: by + 0.5 };
  },
  down(p, e) {
    if (!this.pts) { this.edges(); this.mode = selMode(e); this.pts = [this.snap(p)]; MP.render(); return; }
    const f = this.pts[0]; if (this.pts.length > 2 && Math.hypot(p.x - f.x, p.y - f.y) * MP.doc.zoom < 9) { this.finish(); return; }
    this.pts.push(this.snap(p));
  },
  move(p) {
    if (!this.pts) return; const q = this.snap(p), l = this.pts[this.pts.length - 1];
    if (Math.hypot(q.x - l.x, q.y - l.y) > this.opts.freq) this.pts.push(q);
    this.hover = q; MP.renderView();
  },
  dbl() { if (this.pts) this.finish(); },
  finish() {
    const pts = this.pts; this.pts = null; this.E = null; const d = MP.doc; if (!pts || pts.length < 3) { MP.render(); return; }
    d.history.record('Lasso magnétique', null);
    MP.sel.apply(d, this.mode, (c) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill(); });
    MP.ui.refreshAll(); MP.render();
  },
  onKey(e) { if (!this.pts) return false; if (e.key === 'Enter') { this.finish(); return true; } if (e.key === 'Escape') { this.pts = null; MP.render(); return true; } if (e.key === 'Backspace' || e.key === 'Delete') { this.pts.splice(-3, 3); if (!this.pts.length) this.pts = null; MP.render(); return true; } return false; },
  overlay(ctx) {
    if (!this.pts) return; MP.overlayDocTransform(ctx); const z = MP.doc.zoom;
    ctx.lineWidth = 1.5 / z; ctx.strokeStyle = '#2d8cff'; ctx.beginPath(); this.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); if (this.hover) ctx.lineTo(this.hover.x, this.hover.y); ctx.stroke();
    ctx.fillStyle = '#fff'; for (const q of this.pts) ctx.fillRect(q.x - 2 / z, q.y - 2 / z, 4 / z, 4 / z);
  },
  cancel() { this.pts = null; },
});

/* ---------- Sélection d'objet ---------- */
T3({
  id: 'objsel', name: 'Sélection d\'objet', icon: 'objsel', cursor: 'crosshair',
  defaults: { mode: 'new', ai: false, tol: 40 },
  options: [{ k: 'tol', label: 'Sensibilité', type: 'range', min: 5, max: 100 }, { k: 'ai', label: '✨ IA (plus précis)', type: 'check' }],
  hint: 'Tracez un rectangle autour de l\'objet',
  down(p, e) { this.a = this.b = p; this.on = true; this.mode = selMode(e); },
  move(p) { if (this.on) { this.b = p; MP.renderView(); } },
  up() {
    if (!this.on) return; this.on = false; const d = MP.doc;
    const r = { x: Math.max(0, Math.round(Math.min(this.a.x, this.b.x))), y: Math.max(0, Math.round(Math.min(this.a.y, this.b.y))) };
    r.w = Math.min(d.width, Math.round(Math.max(this.a.x, this.b.x))) - r.x; r.h = Math.min(d.height, Math.round(Math.max(this.a.y, this.b.y))) - r.y;
    if (r.w < 6 || r.h < 6) { MP.renderView(); return; }
    if (this.opts.ai && MP.prefs.aiKey) { MP.ai.objectInRect(r, this.mode); return; }
    MP.busy('Détection de l\'objet…', () => {
      const src = d.composite(null, { noLive: true }), data = src.getContext('2d').getImageData(r.x, r.y, r.w, r.h).data, W = r.w, H = r.h;
      // modèle de l'arrière-plan : couleurs du bord du rectangle (k-moyennes)
      const border = []; const push = (x, y) => { const i = (y * W + x) * 4; border.push([data[i], data[i + 1], data[i + 2]]); };
      const st = Math.max(1, Math.round((W + H) / 200));
      for (let x = 0; x < W; x += st) { push(x, 0); push(x, H - 1); } for (let y = 0; y < H; y += st) { push(0, y); push(W - 1, y); }
      let cent = Array.from({ length: 6 }, (_, k) => border[Math.floor((k * border.length) / 6)].slice());
      for (let it = 0; it < 8; it++) { const acc = cent.map(() => [0, 0, 0, 0]); for (const b of border) { let bi = 0, bd = 1e9; cent.forEach((c, k) => { const dd = (c[0] - b[0]) ** 2 + (c[1] - b[1]) ** 2 + (c[2] - b[2]) ** 2; if (dd < bd) { bd = dd; bi = k; } }); const a = acc[bi]; a[0] += b[0]; a[1] += b[1]; a[2] += b[2]; a[3]++; } cent = cent.map((c, k) => (acc[k][3] ? [acc[k][0] / acc[k][3], acc[k][1] / acc[k][3], acc[k][2] / acc[k][3]] : c)); }
      const th = (this.opts.tol * 1.2) ** 2, m = MP.createCanvas(d.width, d.height), mc = m.getContext('2d'), id = mc.createImageData(W, H);
      for (let p = 0; p < W * H; p++) { const i = p * 4; let bd = 1e9; for (const c of cent) { const dd = (c[0] - data[i]) ** 2 + (c[1] - data[i + 1]) ** 2 + (c[2] - data[i + 2]) ** 2; if (dd < bd) bd = dd; } if (bd > th) { id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = 255; } }
      mc.putImageData(id, r.x, r.y);
      // nettoyage : fermeture morphologique approchée
      const b = MP.sel.blurred(m, Math.max(2, Math.min(r.w, r.h) / 60)), bc = b.getContext('2d'), bd = bc.getImageData(0, 0, d.width, d.height); for (let i = 3; i < bd.data.length; i += 4) { bd.data[i - 3] = bd.data[i - 2] = bd.data[i - 1] = 255; bd.data[i] = bd.data[i] > 100 ? 255 : 0; } bc.putImageData(bd, 0, 0);
      d.history.record('Sélection d\'objet', null); MP.sel.apply(d, this.mode, (c) => c.drawImage(b, 0, 0)); MP.ui.refreshAll(); MP.render();
    });
  },
  overlay(ctx) { if (!this.on) return; MP.overlayDocTransform(ctx); const z = MP.doc.zoom; ctx.lineWidth = 1 / z; ctx.setLineDash([4 / z, 4 / z]); ctx.strokeStyle = '#2d8cff'; ctx.strokeRect(Math.min(this.a.x, this.b.x), Math.min(this.a.y, this.b.y), Math.abs(this.b.x - this.a.x), Math.abs(this.b.y - this.a.y)); },
  cancel() { this.on = false; },
});

/* ---------- Recadrage perspective ---------- */
T3({
  id: 'perspcrop', name: 'Recadrage perspective', icon: 'perspcrop', cursor: 'crosshair',
  hint: 'Tracez un cadre puis déplacez chaque coin sur les bords de l\'objet (façade, document…). Entrée pour redresser',
  options: [{ k: 'ok', label: '✔ Valider', type: 'button', action: () => MP.tools.perspcrop.apply() }, { k: 'no', label: '✖ Annuler', type: 'button', action: () => { MP.tools.perspcrop.q = null; MP.renderView(); } }],
  down(p) {
    const z = MP.doc.zoom;
    if (this.q) { const i = this.q.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) * z < 10); if (i >= 0) { this.drag = { i }; return; } }
    this.drag = { rect: p }; this.q = null;
  },
  move(p) {
    if (!this.drag) return;
    if (this.drag.rect) { const a = this.drag.rect; this.q = [{ x: a.x, y: a.y }, { x: p.x, y: a.y }, { x: p.x, y: p.y }, { x: a.x, y: p.y }]; }
    else this.q[this.drag.i] = { x: p.x, y: p.y };
    MP.renderView();
  },
  up() { this.drag = null; if (this.q && Math.abs(this.q[2].x - this.q[0].x) < 4) this.q = null; },
  dbl() { this.apply(); },
  onKey(e) { if (!this.q) return false; if (e.key === 'Enter') { this.apply(); return true; } if (e.key === 'Escape') { this.q = null; MP.renderView(); return true; } return false; },
  apply() {
    const q = this.q; if (!q) { MP.toast('Tracez d\'abord le cadre'); return; } this.q = null;
    const d = MP.doc, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const W = Math.max(1, Math.round((dist(q[0], q[1]) + dist(q[3], q[2])) / 2)), H = Math.max(1, Math.round((dist(q[0], q[3]) + dist(q[1], q[2])) / 2));
    const Hm = MP.homography(q);
    MP.busy('Redressement…', () => {
      d.history.record('Recadrage perspective', 'all');
      const warp = (cv) => {
        const s = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, sw = cv.width, sh = cv.height;
        const o = MP.createCanvas(W, H), oc = o.getContext('2d'), id = oc.createImageData(W, H), D = id.data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const p = Hm((x + 0.5) / W, (y + 0.5) / H); if (p.x < 0 || p.y < 0 || p.x > sw - 1 || p.y > sh - 1) continue;
          const x0 = Math.min(sw - 2, p.x | 0), y0 = Math.min(sh - 2, p.y | 0), tx = p.x - x0, ty = p.y - y0, a = (y0 * sw + x0) * 4, b = a + 4, c = a + sw * 4, e = c + 4, i = (y * W + x) * 4;
          for (let k = 0; k < 4; k++) D[i + k] = (s[a + k] * (1 - tx) + s[b + k] * tx) * (1 - ty) + (s[c + k] * (1 - tx) + s[e + k] * tx) * ty;
        }
        oc.putImageData(id, 0, 0); return o;
      };
      for (const l of d.layers) { if (!l.isGroup && !l.adjust) l.canvas = warp(l.canvas); if (l.mask) l.mask = warp(l.mask); l.text = null; }
      d.width = W; d.height = H; d.resizeBuffers(); MP.sel.none(d); MP.view.fit(); MP.ui.refreshAll(); MP.afterEdit();
    });
  },
  overlay(ctx) {
    const q = this.q; if (!q) return; const z = MP.doc.zoom; MP.overlayDocTransform(ctx);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.rect(-1e5, -1e5, 2e5, 2e5); q.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); ctx.fill('evenodd');
    const Hm = MP.homography(q); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1 / z; ctx.beginPath();
    for (let k = 1; k < 4; k++) { const a = Hm(k / 4, 0), b = Hm(k / 4, 1), c = Hm(0, k / 4), e = Hm(1, k / 4); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(c.x, c.y); ctx.lineTo(e.x, e.y); }
    ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / z; ctx.beginPath(); q.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); ctx.stroke();
    for (const c of q) { ctx.fillStyle = '#fff'; ctx.fillRect(c.x - 4 / z, c.y - 4 / z, 8 / z, 8 / z); }
  },
  cancel() { this.drag = null; },
});

/* ---------- Règle (mesure + redressement) ---------- */
T3({
  id: 'ruler', name: 'Règle', icon: 'rulertool', cursor: 'crosshair',
  hint: 'Tracez une ligne pour mesurer une distance et un angle',
  options: [{ k: 'st', label: 'Redresser l\'image', type: 'button', action: () => MP.tools.ruler.straighten() }, { k: 'clr', label: 'Effacer', type: 'button', action: () => { MP.measure = null; MP.tools.ruler.ln = null; MP.renderView(); MP.ui.refreshInfo && MP.ui.refreshInfo(); } }],
  down(p) { const z = MP.doc.zoom; if (this.ln) { const i = [this.ln.a, this.ln.b].findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) * z < 8); if (i >= 0) { this.drag = i ? 'b' : 'a'; return; } } this.ln = { a: p, b: p }; this.drag = 'b'; },
  move(p, e) {
    if (!this.drag) return; let q = p;
    if (e.shiftKey) { const o = this.drag === 'b' ? this.ln.a : this.ln.b, ang = Math.round(Math.atan2(p.y - o.y, p.x - o.x) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(p.x - o.x, p.y - o.y); q = { x: o.x + Math.cos(ang) * l, y: o.y + Math.sin(ang) * l }; }
    this.ln[this.drag] = q; this.upd(); MP.renderView();
  },
  up() { this.drag = null; },
  upd() { const { a, b } = this.ln, dx = b.x - a.x, dy = b.y - a.y; MP.measure = { x: a.x, y: a.y, dx, dy, len: Math.hypot(dx, dy), angle: (-Math.atan2(dy, dx) * 180) / Math.PI }; MP.ui.setInfo(`L ${MP.measure.len.toFixed(1)} px  A ${MP.measure.angle.toFixed(1)}°`); MP.ui.refreshInfo && MP.ui.refreshInfo(); },
  straighten() {
    if (!this.ln) { MP.toast('Tracez d\'abord une ligne le long de l\'horizon ou d\'un bord'); return; }
    let a = MP.measure.angle; while (a > 45) a -= 90; while (a < -45) a += 90;
    const d = MP.doc, W = d.width, H = d.height, t = Math.abs((a * Math.PI) / 180), s = 1 / (Math.cos(t) + Math.sin(t) * Math.max(W / H, H / W));
    this.ln = null; MP.measure = null;
    MP.rotateImage(a);
    const cw = Math.round(W * s), ch = Math.round(H * s); MP.cropDoc(Math.round((d.width - cw) / 2), Math.round((d.height - ch) / 2), cw, ch);
    MP.toast(`Image redressée de ${a.toFixed(1)}°`);
  },
  overlay(ctx) {
    if (!this.ln) return; const { a, b } = this.ln, A = MP.docToScreen(a), B = MP.docToScreen(b), dpr = MP.view.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = '#ffd400'; ctx.stroke();
    [A, B].forEach((q) => { ctx.beginPath(); ctx.moveTo(q.x - 6, q.y); ctx.lineTo(q.x + 6, q.y); ctx.moveTo(q.x, q.y - 6); ctx.lineTo(q.x, q.y + 6); ctx.stroke(); });
    if (MP.measure) { const t = `${MP.measure.len.toFixed(0)} px · ${MP.measure.angle.toFixed(1)}°`; ctx.font = '12px Segoe UI, sans-serif'; const w = ctx.measureText(t).width; ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(B.x + 10, B.y + 8, w + 10, 20); ctx.fillStyle = '#fff'; ctx.fillText(t, B.x + 15, B.y + 22); }
  },
  cancel() { this.drag = null; },
});

/* ---------- Échantillonnage de couleur ---------- */
T3({
  id: 'sampler', name: 'Échantillonnage de couleur', icon: 'sampler', cursor: 'crosshair',
  hint: 'Cliquez pour poser jusqu\'à 4 points de mesure (panneau Info). Alt + clic : supprimer',
  options: [{ k: 'clr', label: 'Tout effacer', type: 'button', action: () => { if (MP.doc) { MP.doc.samplers = []; MP.renderView(); MP.ui.refreshInfo(); } } }],
  down(p, e) {
    const d = MP.doc; d.samplers = d.samplers || []; const z = d.zoom, i = d.samplers.findIndex((s) => Math.hypot(s.x - p.x, s.y - p.y) * z < 9);
    if (i >= 0) { if (e.altKey) { d.samplers.splice(i, 1); MP.renderView(); MP.ui.refreshInfo(); return; } this.drag = i; return; }
    if (d.samplers.length >= 4) { MP.toast('4 points maximum — Alt + clic pour en supprimer un'); return; }
    d.samplers.push({ x: Math.floor(p.x), y: Math.floor(p.y) }); MP.renderView(); MP.ui.refreshInfo();
  },
  move(p) { if (this.drag == null) return; MP.doc.samplers[this.drag] = { x: Math.floor(p.x), y: Math.floor(p.y) }; MP.renderView(); MP.ui.refreshInfo(); },
  up() { this.drag = null; },
});
MP.drawSamplers = (ctx, d) => {
  if (!d.samplers || !d.samplers.length) return; const dpr = MP.view.dpr; ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = 'bold 11px Segoe UI, sans-serif';
  d.samplers.forEach((s, i) => { const q = MP.docToScreen({ x: s.x + 0.5, y: s.y + 0.5 }); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, 7); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(q.x - 10, q.y); ctx.lineTo(q.x + 10, q.y); ctx.moveTo(q.x, q.y - 10); ctx.lineTo(q.x, q.y + 10); ctx.stroke(); ctx.fillStyle = '#000'; ctx.fillText(String(i + 1), q.x + 9, q.y + 15); ctx.fillStyle = '#fff'; ctx.fillText(String(i + 1), q.x + 8, q.y + 14); });
  ctx.restore();
};
