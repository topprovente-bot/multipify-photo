'use strict';
/* Outils v2 : plume, sélection rapide, yeux rouges, remplacement de couleur, masque rapide, perspective/torsion */

MP.tools.burn.key = ''; // P est réservé à la plume (comme Photoshop)
const defTool2 = (t) => { MP.tools[t.id] = t; t.opts = MP.settings.tools[t.id] = Object.assign({}, t.defaults || {}); const i = MP.toolOrder.indexOf(t.after); MP.toolOrder.splice(i >= 0 ? i + 1 : MP.toolOrder.length, 0, t.id); return t; };

/* ---------- Plume (tracés de Bézier) ---------- */
MP.pathToPath2D = (P) => {
  const p = new Path2D(), a = P.pts; if (!a.length) return p;
  p.moveTo(a[0].x, a[0].y);
  for (let i = 1; i < a.length; i++) p.bezierCurveTo(a[i - 1].ox, a[i - 1].oy, a[i].ix, a[i].iy, a[i].x, a[i].y);
  if (P.closed && a.length > 2) { const l = a[a.length - 1], f = a[0]; p.bezierCurveTo(l.ox, l.oy, f.ix, f.iy, f.x, f.y); p.closePath(); }
  return p;
};
defTool2({
  id: 'pen', name: 'Plume', key: 'P', icon: 'pen', cursor: 'crosshair', after: 'text', snap: true,
  defaults: { width: 4 },
  hint: 'Clic = point, glisser = courbe, clic sur le 1er point = fermer. Entrée = sélection',
  options: [
    { k: 'sel', label: '→ Sélection', type: 'button', action: () => MP.tools.pen.toSelection() },
    { k: 'fill', label: 'Remplir', type: 'button', action: () => MP.tools.pen.paint('fill') },
    { k: 'stroke', label: 'Contour', type: 'button', action: () => MP.tools.pen.paint('stroke') },
    { k: 'width', label: 'Épaisseur', type: 'number', min: 1, max: 500 },
    { k: 'shape', label: '→ Forme (calque)', type: 'button', action: () => MP.tools.pen.paint('shape') },
    { k: 'clear', label: 'Effacer le tracé', type: 'button', action: () => { if (MP.doc) { MP.doc.path = null; MP.render(); } } },
  ],
  P() { const d = MP.doc; if (!d.path) d.path = { pts: [], closed: false }; return d.path; },
  hitPt(p) { const d = MP.doc, P = d.path; if (!P) return -1; const tol = 7 / d.zoom; return P.pts.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < tol); },
  down(p) {
    const P = this.P(), h = this.hitPt(p);
    if (h === 0 && !P.closed && P.pts.length > 2) { P.closed = true; this.drag = null; MP.render(); return; }
    if (h >= 0) { this.drag = { type: 'anchor', i: h, s: { ...P.pts[h] }, p0: p }; return; }
    if (P.closed) { P.pts = []; P.closed = false; }
    P.pts.push({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y });
    this.drag = { type: 'handle', i: P.pts.length - 1 }; MP.render();
  },
  move(p) {
    this.hover = p; const P = MP.doc.path;
    if (this.drag && P) {
      const q = P.pts[this.drag.i];
      if (this.drag.type === 'handle') { q.ox = p.x; q.oy = p.y; q.ix = 2 * q.x - p.x; q.iy = 2 * q.y - p.y; }
      else { const s = this.drag.s, dx = p.x - this.drag.p0.x, dy = p.y - this.drag.p0.y; Object.assign(q, { x: s.x + dx, y: s.y + dy, ix: s.ix + dx, iy: s.iy + dy, ox: s.ox + dx, oy: s.oy + dy }); }
    }
    if (P && P.pts.length) MP.renderView();
  },
  up() { this.drag = null; },
  toSelection() {
    const d = MP.doc; if (!d || !d.path || d.path.pts.length < 2) { MP.toast('Tracez d\'abord un chemin avec la plume'); return; }
    const path = MP.pathToPath2D({ ...d.path, closed: true });
    d.history.record('Tracé → sélection', null); MP.sel.apply(d, 'new', (c) => c.fill(path)); MP.ui.refreshAll(); MP.render();
  },
  paint(mode) {
    const d = MP.doc; if (!d || !d.path || d.path.pts.length < 2) { MP.toast('Tracez d\'abord un chemin avec la plume'); return; }
    let l;
    if (mode === 'shape') { d.history.record('Forme d\'après le tracé', null); l = d.addLayer('Forme tracée'); }
    else { if (!MP.canEditPixels()) return; d.history.record(mode === 'fill' ? 'Remplir le tracé' : 'Contour du tracé', [d.layer.id]); l = d.layer; MP.rasterize(l); }
    const t = MP.createCanvas(d.width, d.height), c = t.getContext('2d');
    const path = MP.pathToPath2D(mode === 'stroke' ? d.path : { ...d.path, closed: true });
    c.fillStyle = c.strokeStyle = MP.colors.fg; c.lineWidth = +this.opts.width; c.lineCap = c.lineJoin = 'round';
    if (mode === 'stroke') c.stroke(path); else c.fill(path);
    if (mode !== 'shape') d.clipToSelection(t);
    l.ctx.drawImage(t, 0, 0); MP.afterEdit();
  },
  onKey(e) {
    const d = MP.doc; if (!d || !d.path || !d.path.pts.length) return false;
    if (e.key === 'Enter') { this.toSelection(); return true; }
    if (e.key === 'Escape') { if (!d.path.closed) { d.path.closed = d.path.pts.length > 2; } else d.path = null; MP.render(); return true; }
    if (e.key === 'Backspace' || e.key === 'Delete') { d.path.pts.pop(); MP.render(); return true; }
    return false;
  },
  overlay(ctx) {
    const d = MP.doc, P = d.path; if (!P || !P.pts.length) return;
    const z = d.zoom; MP.overlayDocTransform(ctx);
    ctx.lineWidth = 1.5 / z; ctx.strokeStyle = '#2d8cff'; ctx.stroke(MP.pathToPath2D(P));
    const last = P.pts[P.pts.length - 1];
    if (!P.closed && this.hover && MP.tool === this && !this.drag) { ctx.setLineDash([4 / z, 4 / z]); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.bezierCurveTo(last.ox, last.oy, this.hover.x, this.hover.y, this.hover.x, this.hover.y); ctx.stroke(); ctx.setLineDash([]); }
    for (const [i, q] of P.pts.entries()) {
      if (i === P.pts.length - 1 || (this.drag && this.drag.i === i)) { ctx.strokeStyle = '#9ec2ff'; ctx.beginPath(); ctx.moveTo(q.ix, q.iy); ctx.lineTo(q.ox, q.oy); ctx.stroke(); [[q.ix, q.iy], [q.ox, q.oy]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.5 / z, 0, 7); ctx.fillStyle = '#2d8cff'; ctx.fill(); }); }
      ctx.fillStyle = i === 0 ? '#2d8cff' : '#fff'; ctx.strokeStyle = '#2d8cff'; ctx.fillRect(q.x - 3.5 / z, q.y - 3.5 / z, 7 / z, 7 / z); ctx.strokeRect(q.x - 3.5 / z, q.y - 3.5 / z, 7 / z, 7 / z);
    }
  },
  cancel() { this.drag = null; },
});

/* ---------- Sélection rapide ---------- */
defTool2({
  id: 'quicksel', name: 'Sélection rapide', key: 'A', icon: 'quicksel', cursor: 'none', after: 'lasso',
  defaults: { size: 30, tolerance: 28, all: true },
  options: [{ k: 'size', label: 'Taille', type: 'range', min: 4, max: 300, unit: 'px' }, { k: 'tolerance', label: 'Tolérance', type: 'range', min: 1, max: 100 }, { k: 'all', label: 'Tous les calques', type: 'check' }],
  hint: 'Peignez sur l\'objet : la sélection s\'étend aux bords détectés (Alt = retirer)',
  brushCursor() { return this.opts.size; },
  down(p, e) {
    const d = MP.doc; this.mode = e.altKey ? 'sub' : d.selection ? 'add' : 'new';
    this.src = this.opts.all ? MP.cloneCanvas(d.composite(null, { noLive: true })) : MP.cloneCanvas(d.layer.canvas);
    this.work = MP.createCanvas(d.width, d.height); this.wc = this.work.getContext('2d');
    this.eng = new MP.StrokeEngine(d, this.opts.size * 0.45, (c, x, y) => this.dab(x, y));
    this.eng.to(p); MP.renderView();
  },
  dab(x, y) {
    const d = MP.doc, r = this.opts.size / 2, R = Math.ceil(r * 4);
    const x0 = Math.max(0, Math.round(x) - R), y0 = Math.max(0, Math.round(y) - R), x1 = Math.min(d.width, Math.round(x) + R), y1 = Math.min(d.height, Math.round(y) + R);
    if (x1 <= x0 || y1 <= y0) return;
    const win = MP.createCanvas(x1 - x0, y1 - y0); win.getContext('2d').drawImage(this.src, -x0, -y0);
    const m = MP.floodMask(win, x - x0, y - y0, this.opts.tolerance, true);
    if (m) this.wc.drawImage(m, x0, y0);
    this.wc.fillStyle = '#fff'; this.wc.beginPath(); this.wc.arc(x, y, r * 0.6, 0, 7); this.wc.fill();
  },
  move(p) { if (this.eng) { this.eng.to(p); MP.renderView(); } else if (MP.view.cursor) MP.renderView(); },
  up() {
    if (!this.eng) return; this.eng = null; const d = MP.doc;
    d.history.record('Sélection rapide', null);
    const w = MP.sel.blurred(this.work, 1.2); MP.sel.apply(d, this.mode, (c) => c.drawImage(w, 0, 0));
    this.work = null; this.src = null; MP.ui.refreshAll(); MP.render();
  },
  overlay(ctx) {
    if (!this.work) return; MP.overlayDocTransform(ctx);
    const t = MP.doc.buf('qs'), tc = t.getContext('2d'); tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, t.width, t.height); tc.drawImage(this.work, 0, 0);
    tc.globalCompositeOperation = 'source-in'; tc.fillStyle = this.mode === 'sub' ? '#ff3355' : '#2d8cff'; tc.fillRect(0, 0, t.width, t.height);
    ctx.globalAlpha = 0.4; ctx.drawImage(t, 0, 0); ctx.globalAlpha = 1;
  },
  cancel() { this.eng = null; this.work = null; },
});

/* ---------- Yeux rouges ---------- */
defTool2({
  id: 'redeye', name: 'Œil rouge', key: '', icon: 'redeye', cursor: 'crosshair', after: 'heal',
  defaults: { size: 40, dark: 50 },
  options: [{ k: 'size', label: 'Taille de la pupille', type: 'range', min: 4, max: 300, unit: 'px' }, { k: 'dark', label: 'Assombrissement', type: 'range', min: 0, max: 100, unit: '%' }],
  hint: 'Cliquez sur chaque œil rouge',
  brushCursor() { return this.opts.size; },
  down(p) {
    const d = MP.doc; if (!MP.canEditPixels()) return;
    const r = this.opts.size / 2, x0 = Math.max(0, Math.floor(p.x - r)), y0 = Math.max(0, Math.floor(p.y - r));
    const w = Math.min(d.width, Math.ceil(p.x + r)) - x0, h = Math.min(d.height, Math.ceil(p.y + r)) - y0; if (w <= 0 || h <= 0) return;
    d.history.record('Œil rouge', [d.layer.id]); MP.rasterize(d.layer);
    const c = d.layer.ctx, id = c.getImageData(x0, y0, w, h), a = id.data, k = 1 - this.opts.dark / 100;
    let n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x0 + x + 0.5 - p.x, y0 + y + 0.5 - p.y) / r; if (dist > 1) continue;
      const i = (y * w + x) * 4, R = a[i], G = a[i + 1], B = a[i + 2], mx = Math.max(G, B);
      if (R > 60 && R > mx * 1.35) { const f = Math.min(1, (R / (mx + 1) - 1.35) * 2) * (dist > 0.8 ? (1 - dist) * 5 : 1), nv = ((G + B) / 2) * k; a[i] = MP.lerp(R, nv, f); a[i + 1] = MP.lerp(G, G * k, f); a[i + 2] = MP.lerp(B, B * k, f); n++; }
    }
    c.putImageData(id, x0, y0); MP.afterEdit(); if (!n) MP.toast('Aucun rouge détecté à cet endroit');
  },
});

/* ---------- Remplacement de couleur (pinceau) ---------- */
{
  const base = MP.tools.dodge; // réutilise le moteur des outils de retouche
  const t = Object.create(base);
  Object.assign(t, {
    id: 'colorrep', name: 'Remplacement de couleur', key: '', icon: 'colorrep',
    defaults: { size: 40, hardness: 60, strength: 80 },
    options: base.options.map((o) => (o.k === 'strength' ? { ...o, label: 'Intensité' } : o)),
    hint: 'Peint la couleur de premier plan en conservant ombres et lumières',
    dab(x, y) {
      const fg = MP.hexToRgb(MP.colors.fg), [H, S] = MP.rgbToHsl(fg.r, fg.g, fg.b);
      const d = MP.doc, o = this.opts, cv = d.layer.canvas, r = o.size / 2, R = Math.ceil(r);
      const x0 = Math.max(0, Math.round(x) - R), y0 = Math.max(0, Math.round(y) - R), x1 = Math.min(cv.width, Math.round(x) + R + 1), y1 = Math.min(cv.height, Math.round(y) + R + 1);
      const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return;
      const ctx = cv.getContext('2d'), id = ctx.getImageData(x0, y0, w, h), a = id.data, hard = o.hardness / 100, k = o.strength / 100;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const dist = Math.hypot(x0 + xx + 0.5 - x, y0 + yy + 0.5 - y) / r; if (dist > 1) continue;
        let f = dist <= hard ? 1 : 1 - (dist - hard) / (1 - hard + 1e-6); f *= k; if (this.selA) f *= this.selA[((y0 + yy) * d.width + x0 + xx) * 4 + 3] / 255; if (f <= 0) continue;
        const i = (yy * w + xx) * 4, [, , L] = MP.rgbToHsl(a[i], a[i + 1], a[i + 2]), [nr, ng, nb] = MP.hslToRgb(H, S, L);
        a[i] = MP.lerp(a[i], nr, f); a[i + 1] = MP.lerp(a[i + 1], ng, f); a[i + 2] = MP.lerp(a[i + 2], nb, f);
      }
      ctx.putImageData(id, x0, y0);
    },
  });
  t.down = function (p) { const d = MP.doc; if (!MP.canEditPixels()) return; d.history.record(this.name, [d.layer.id]); MP.rasterize(d.layer); this.selA = d.selection ? d.selection.getContext('2d').getImageData(0, 0, d.width, d.height).data : null; this.eng = new MP.StrokeEngine(d, this.opts.size * 0.2, (c, x, y) => this.dab(x, y)); this.eng.to(p); MP.render(); };
  t.opts = MP.settings.tools.colorrep = { ...t.defaults };
  MP.tools.colorrep = t; MP.toolOrder.splice(MP.toolOrder.indexOf('sponge') + 1, 0, 'colorrep');
}

/* ---------- Masque rapide ---------- */
MP.toggleQuickMask = () => {
  const d = MP.doc; if (!d) return;
  if (MP.tool && MP.tool.cancel) MP.tool.cancel();
  d.history.record(d.quickMask ? 'Quitter le masque rapide' : 'Mode masque rapide', null);
  if (!d.quickMask) {
    d.qmask = d.selection ? MP.cloneCanvas(d.selection) : MP.createCanvas(d.width, d.height);
    d.quickMask = true; d.selection = null; d.selPath = null;
    if (!['brush', 'eraser', 'pencil', 'gradient', 'bucket'].includes(MP.tool && MP.tool.id)) MP.setTool('brush');
    MP.toast('Masque rapide : peignez en blanc pour sélectionner, en noir pour retirer — Q pour terminer', 4500);
  } else { const m = d.qmask; d.quickMask = false; d.qmask = null; d.selection = m; MP.sel.normalize(d); }
  MP.ui.refreshAll(); MP.render();
};

/* ---------- Perspective / torsion dans la transformation manuelle ---------- */
{
  const T = MP.tools.transform;
  T.options.splice(3, 0, { k: 'distort', label: '⬚ Perspective / Torsion', title: 'Déplacer librement chaque coin', type: 'button', action: () => T.toggleDistort() });
  const homography = (q) => {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q.map((p) => [p.x, p.y]);
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    let g = 0, h = 0; const den = dx1 * dy2 - dx2 * dy1;
    if ((dx3 || dy3) && den) { g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; }
    const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
    return (u, v) => { const w = g * u + h * v + 1; return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w }; };
  };
  const tri = (ctx, img, s0, s1, s2, d0, d1, d2) => {
    const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3, grow = (p) => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / l) * 1.2, y: p.y + (dy / l) * 1.2 }; };
    const e0 = grow(d0), e1 = grow(d1), e2 = grow(d2);
    const sa = s1.x - s0.x, sb = s2.x - s0.x, sc = s1.y - s0.y, sd = s2.y - s0.y, det = sa * sd - sb * sc; if (!det) return;
    const ia = sd / det, ib = -sb / det, ic = -sc / det, id = sa / det;
    const da = d1.x - d0.x, db = d2.x - d0.x, dc = d1.y - d0.y, dd = d2.y - d0.y;
    const A = da * ia + db * ic, B = da * ib + db * id, C = dc * ia + dd * ic, D = dc * ib + dd * id;
    const E = d0.x - A * s0.x - B * s0.y, F = d0.y - C * s0.x - D * s0.y;
    ctx.save(); ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.closePath(); ctx.clip();
    ctx.transform(A, C, B, D, E, F); ctx.drawImage(img, 0, 0); ctx.restore();
  };
  MP.drawQuad = (ctx, img, quad, n = 18) => {
    const H = homography(quad), w = img.width, h = img.height;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n;
      const s00 = { x: u0 * w, y: v0 * h }, s10 = { x: u1 * w, y: v0 * h }, s11 = { x: u1 * w, y: v1 * h }, s01 = { x: u0 * w, y: v1 * h };
      const d00 = H(u0, v0), d10 = H(u1, v0), d11 = H(u1, v1), d01 = H(u0, v1);
      tri(ctx, img, s00, s10, s11, d00, d10, d11); tri(ctx, img, s00, s11, s01, d00, d11, d01);
    }
  };
  T.toggleDistort = function () {
    if (!this.src) return;
    if (this.quad) { this.quad = null; MP.render(); MP.toast('Mode échelle / rotation'); return; }
    const s = this.st; this.quad = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => this.toWorld((a * s.bw * s.sx) / 2, (b * s.bh * s.sy) / 2));
    MP.toast('Perspective : glissez chaque coin librement'); MP.render();
  };
  const paint0 = T.paint;
  T.paint = function (ctx) { if (this.quad) { ctx.save(); ctx.imageSmoothingQuality = 'high'; MP.drawQuad(ctx, this.src, this.quad); ctx.restore(); } else paint0.call(this, ctx); };
  const handles0 = T.handles;
  T.handles = function () { return this.quad ? this.quad.map((p, i) => ({ i, p, ux: 0, uy: 0 })) : handles0.call(this); };
  const inQuad = (q, p) => { let ins = false; for (let i = 0, j = 3; i < 4; j = i++) { if ((q[i].y > p.y) !== (q[j].y > p.y) && p.x < ((q[j].x - q[i].x) * (p.y - q[i].y)) / (q[j].y - q[i].y) + q[i].x) ins = !ins; } return ins; };
  const down0 = T.down, move0 = T.move, overlay0 = T.overlay, start0 = T.start, commit0 = T.commit;
  T.start = function () { this.quad = null; return start0.call(this); };
  T.down = function (p) {
    if (!this.quad) return down0.call(this, p);
    const tol = 8 / MP.doc.zoom, i = this.quad.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < tol);
    if (i >= 0) this.drag = { type: 'corner', i }; else if (inQuad(this.quad, p)) this.drag = { type: 'qmove', p0: p, q0: this.quad.map((q) => ({ ...q })) }; else this.drag = null;
  };
  T.move = function (p, e) {
    if (!this.quad) return move0.call(this, p, e);
    if (!this.drag) { MP.view.canvas.style.cursor = this.quad.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 8 / MP.doc.zoom) ? 'crosshair' : inQuad(this.quad, p) ? 'move' : 'default'; return; }
    if (this.drag.type === 'corner') this.quad[this.drag.i] = { x: p.x, y: p.y };
    else { const dx = p.x - this.drag.p0.x, dy = p.y - this.drag.p0.y; this.quad = this.drag.q0.map((q) => ({ x: q.x + dx, y: q.y + dy })); }
    MP.render();
  };
  T.commit = function () {
    if (this.quad && this.selSrc) { const keep = this.selSrc; this.selSrc = null; const d = MP.doc, c = d.layer.ctx; c.save(); MP.live.draw(c); c.restore(); const m = MP.createCanvas(d.width, d.height); MP.drawQuad(m.getContext('2d'), keep, this.quad); d.selection = m; MP.sel.normalize(d); this.quad = null; this.end(); return; }
    commit0.call(this); this.quad = null;
  };
  T.overlay = function (ctx) {
    if (!this.quad) return overlay0.call(this, ctx);
    const z = MP.doc.zoom; MP.overlayDocTransform(ctx); ctx.lineWidth = 1 / z; ctx.strokeStyle = '#2d8cff';
    ctx.beginPath(); this.quad.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.stroke();
    for (const q of this.quad) { ctx.fillStyle = '#fff'; ctx.fillRect(q.x - 4 / z, q.y - 4 / z, 8 / z, 8 / z); ctx.strokeRect(q.x - 4 / z, q.y - 4 / z, 8 / z, 8 / z); }
  };
}
