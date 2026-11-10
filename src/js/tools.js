'use strict';
/* Outils : déplacement, sélections, recadrage, pinceaux, retouche, remplissage, dégradé, texte, formes, transformation */
MP.tools = {};
MP.toolOrder = [];
MP.live = null;

const defTool = (t) => {
  MP.tools[t.id] = t; MP.toolOrder.push(t.id);
  t.opts = MP.settings.tools[t.id] = Object.assign({}, t.defaults || {});
  return t;
};
MP.setTool = (id) => {
  const t = MP.tools[id]; if (!t) return;
  if (MP.tool && MP.tool !== t) { MP.tool.cancel && MP.tool.cancel(); }
  MP.tool = t; t.activate && t.activate();
  MP.ui && MP.ui.refreshTool(); MP.render();
};
/** Peut-on peindre sur la cible active (calque, masque ou masque rapide) ? */
MP.canEdit = () => {
  const d = MP.doc;
  if (!d || !d.layer) { MP.toast('Aucun calque actif'); return false; }
  if (d.quickMask && d.qmask) return true;
  const l = d.layer, onMask = d.editMask && l.mask;
  if ((l.isGroup || l.adjust) && !onMask) { MP.toast(l.isGroup ? 'Sélectionnez un calque (pas un groupe), ou son masque' : 'Sur un calque de réglage, seul le masque se peint'); return false; }
  if (l.locked) { MP.toast('Le calque est verrouillé'); return false; }
  if (!l.visible) { MP.toast('Le calque est masqué'); return false; }
  return true;
};
/** Outils qui modifient uniquement les pixels d'un calque. */
MP.canEditPixels = () => {
  const d = MP.doc; if (!d || !d.layer) { MP.toast('Aucun calque actif'); return false; }
  if (d.quickMask) { MP.toast('Quittez d\'abord le masque rapide (Q)'); return false; }
  const l = d.layer;
  if (l.isGroup || l.adjust) { MP.toast('Sélectionnez un calque de pixels'); return false; }
  if (l.locked) { MP.toast('Le calque est verrouillé'); return false; }
  if (!l.visible) { MP.toast('Le calque est masqué'); return false; }
  return true;
};
MP.target = () => { const d = MP.doc; if (d.quickMask && d.qmask) return 'qmask'; return d.editMask && d.layer.mask ? 'mask' : 'layer'; };
MP.canvasFor = (t) => { const d = MP.doc; return t === 'qmask' ? d.qmask : t === 'mask' ? d.layer.mask : d.layer.canvas; };
MP.targetCanvas = () => MP.canvasFor(MP.target());
MP.recordFor = (label) => { const d = MP.doc, t = MP.target(); d.history.record(label, t === 'qmask' ? null : [d.layer.id]); if (t === 'layer') MP.rasterize(d.layer); };
MP.rasterize = (l) => { if (l.text) l.text = null; };
MP.afterEdit = () => { if (MP.doc && MP.doc.layer) MP.doc.layer._v = (MP.doc.layer._v || 0) + 1; MP.live = null; MP.ui && MP.ui.refreshLayers(); MP.render(); };
const lumHex = (hex) => { const c = MP.hexToRgb(hex); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };

/* ---------- Tampons de pinceau ---------- */
const stampCache = new Map();
MP.makeStamp = (size, hardness, color, shape = 'round') => {
  size = Math.max(1, size);
  const key = `${size.toFixed(1)}|${hardness.toFixed(2)}|${color}|${shape}`;
  if (stampCache.has(key)) return stampCache.get(key);
  const d = Math.ceil(size) + 2, c = MP.createCanvas(d, d), x = c.getContext('2d'), cx = d / 2, r = size / 2;
  const { r: R, g: G, b: B } = MP.hexToRgb(color);
  if (shape.startsWith('custom') && MP.customBrush) { const cb = MP.customBrush, k = size / Math.max(cb.width, cb.height), w = Math.max(1, cb.width * k), h = Math.max(1, cb.height * k); x.drawImage(cb, cx - w / 2, cx - h / 2, w, h); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, d, d); x.globalCompositeOperation = 'source-over'; }
  else if (shape === 'square') { x.fillStyle = color; x.globalAlpha = 1; x.fillRect(cx - r * 0.85, cx - r * 0.85, r * 1.7, r * 1.7); }
  else if (shape === 'calli') { x.fillStyle = color; x.translate(cx, cx); x.rotate(-Math.PI / 4); x.beginPath(); x.ellipse(0, 0, r, Math.max(0.6, r * 0.22), 0, 0, 7); x.fill(); }
  else if (shape === 'chalk') {
    const id = x.createImageData(d, d);
    for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) { const dist = Math.hypot(i + 0.5 - cx, j + 0.5 - cx) / r; if (dist > 1) continue; const k = (j * d + i) * 4, a = Math.random() < 0.55 ? (1 - dist * dist) * 255 * (0.4 + Math.random() * 0.6) : 0; id.data[k] = R; id.data[k + 1] = G; id.data[k + 2] = B; id.data[k + 3] = a; }
    x.putImageData(id, 0, 0);
  } else if (shape === 'leaf') { x.fillStyle = color; x.translate(cx, cx); x.beginPath(); x.ellipse(0, 0, r, r * 0.45, 0, 0, 7); x.fill(); }
  else if (hardness >= 0.99 || size <= 2) { x.fillStyle = color; x.beginPath(); x.arc(cx, cx, Math.max(0.5, r), 0, Math.PI * 2); x.fill(); }
  else {
    const g = x.createRadialGradient(cx, cx, 0, cx, cx, r);
    g.addColorStop(0, `rgba(${R},${G},${B},1)`); g.addColorStop(hardness, `rgba(${R},${G},${B},1)`);
    for (let k = 1; k < 6; k++) { const t = hardness + ((1 - hardness) * k) / 6, a = 0.5 * (1 + Math.cos((Math.PI * k) / 6)); g.addColorStop(t, `rgba(${R},${G},${B},${a.toFixed(3)})`); }
    g.addColorStop(1, `rgba(${R},${G},${B},0)`);
    x.fillStyle = g; x.fillRect(0, 0, d, d);
  }
  if (stampCache.size > 60) stampCache.clear();
  stampCache.set(key, c); return c;
};

class StrokeEngine {
  constructor(doc, spacing, stamp) {
    this.doc = doc; this.canvas = MP.createCanvas(doc.width, doc.height); this.ctx = this.canvas.getContext('2d');
    this.spacing = Math.max(0.5, spacing); this.stamp = stamp; this.last = null; this.carry = 0;
    this.clipCanvas = null;
  }
  to(p, pr = 1) {
    if (!this.last) { this.stamp(this.ctx, p.x, p.y, pr); this.last = { x: p.x, y: p.y }; this.carry = 0; return; }
    const dx = p.x - this.last.x, dy = p.y - this.last.y, len = Math.hypot(dx, dy); if (len < 0.01) return;
    let need = this.spacing - this.carry, pos = 0; const c0 = this.carry;
    while (pos + need <= len) { pos += need; this.stamp(this.ctx, this.last.x + (dx * pos) / len, this.last.y + (dy * pos) / len, pr); need = this.spacing; }
    this.carry = pos > 0 ? len - pos : c0 + len;
    this.last = { x: p.x, y: p.y };
  }
  clipped() {
    if (!this.doc.selection) return this.canvas;
    if (!this.clipCanvas) this.clipCanvas = MP.createCanvas(this.doc.width, this.doc.height);
    const c = this.clipCanvas.getContext('2d');
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, this.doc.width, this.doc.height); c.drawImage(this.canvas, 0, 0);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(this.doc.selection, 0, 0); c.globalCompositeOperation = 'source-over';
    return this.clipCanvas;
  }
}
MP.StrokeEngine = StrokeEngine;

const brushOpts = (extra = []) => [
  { k: 'size', label: 'Taille', type: 'range', min: 1, max: 1000, step: 1, unit: 'px' },
  { k: 'hardness', label: 'Dureté', type: 'range', min: 0, max: 100, unit: '%' },
  { k: 'opacity', label: 'Opacité', type: 'range', min: 1, max: 100, unit: '%' },
  { k: 'flow', label: 'Flux', type: 'range', min: 1, max: 100, unit: '%' },
  ...extra,
  { k: 'pressure', label: 'Pression stylet', type: 'check' },
];
const brushShapeOpts = [{ k: 'shape', label: 'Forme', type: 'select', options: [['round', 'Rond'], ['square', 'Carré'], ['calli', 'Calligraphie'], ['chalk', 'Craie / texture'], ['spray', 'Aérographe (spray)'], ['leaf', 'Feuillage'], ['custom', 'Forme personnalisée (définie)']] },
  { k: 'smooth', label: 'Lissage', type: 'range', min: 0, max: 100, unit: '%' },
  { k: 'sym', label: 'Symétrie', type: 'select', options: [['', 'Aucune'], ['v', 'Verticale'], ['h', 'Horizontale'], ['quad', 'Quadruple'], ['rad6', 'Radiale ×6'], ['rad8', 'Radiale ×8'], ['mand', 'Mandala ×12']] },
  { k: 'scatter', label: 'Dispersion', type: 'range', min: 0, max: 200, unit: '%', adv: true },
  { k: 'spacing', label: 'Espacement', type: 'range', min: 1, max: 300, unit: '%', adv: true },
  { k: 'angle', label: 'Angle', type: 'range', min: -180, max: 180, unit: '°', adv: true },
  { k: 'round', label: 'Arrondi', type: 'range', min: 5, max: 100, unit: '%', adv: true },
  { k: 'sizeJit', label: 'Variation de taille', type: 'range', min: 0, max: 100, unit: '%', adv: true },
  { k: 'opJit', label: 'Variation d\'opacité', type: 'range', min: 0, max: 100, unit: '%', adv: true },
  { k: 'angJit', label: 'Variation d\'angle', type: 'range', min: 0, max: 100, unit: '%', adv: true },
  { k: 'air', label: 'Aérographe (accumulation)', type: 'check', adv: true }];
/** Points de symétrie autour du centre du document : [x, y, angle] */
MP.symPoints = (x, y, d, mode) => {
  if (!mode) return [[x, y, 0]];
  const cx = d.width / 2, cy = d.height / 2;
  if (mode === 'v') return [[x, y, 0], [2 * cx - x, y, 0]];
  if (mode === 'h') return [[x, y, 0], [x, 2 * cy - y, 0]];
  if (mode === 'quad') return [[x, y, 0], [2 * cx - x, y, 0], [x, 2 * cy - y, 0], [2 * cx - x, 2 * cy - y, 0]];
  const n = mode === 'rad6' ? 6 : mode === 'rad8' ? 8 : 12, out = [], dx = x - cx, dy = y - cy;
  for (let i = 0; i < n; i++) { const a = (i * 2 * Math.PI) / n, c = Math.cos(a), s = Math.sin(a); out.push([cx + dx * c - dy * s, cy + dx * s + dy * c, a]); if (mode === 'mand') out.push([cx - dx * c - dy * s, cy - dx * s + dy * c, -a]); }
  return out;
};

/* ---------- Pinceau / Crayon / Gomme ---------- */
const paintTool = (cfg) => defTool({
  ...cfg, cursor: 'none',
  options: cfg.options || brushOpts(),
  brushCursor() { return this.opts.size; },
  down(p, e) {
    const d = MP.doc; if (!MP.canEdit()) return;
    const o = this.opts, target = MP.target();
    MP.recordFor(cfg.name);
    const hard = cfg.forceHard ? 1 : o.hardness / 100;
    let color = MP.colors.fg, op = 'source-over';
    if (cfg.erase) { op = 'destination-out'; color = '#000000'; }
    else if (target !== 'layer') { if (lumHex(MP.colors.fg) < 128) op = 'destination-out'; color = '#ffffff'; }
    if (target === 'layer') {
      if (cfg.erase && d.layer.lockAlpha) { op = 'source-atop'; color = MP.colors.bg; }
      else if (op === 'source-over' && o.blend && o.blend !== 'source-over') op = o.blend;
      else if (op === 'source-over' && d.layer.lockAlpha) op = 'source-atop';
    }
    let shape = cfg.forceHard ? 'round' : o.shape || 'round'; if (shape === 'custom') shape = MP.customBrush ? 'custom' + MP.customBrushId : 'round';
    const stamp = MP.makeStamp(o.size, hard, color, shape);
    const usePr = o.pressure, scatter = (o.scatter || 0) / 100;
    const sp = o.spacing ? o.spacing / 100 : cfg.spacing || (shape === 'round' ? 0.12 : 0.18);
    const dab1 = (c, x, y, pr, ang) => {
      let s = usePr ? Math.max(0.05, pr) : 1; if (o.sizeJit) s *= 1 - (Math.random() * o.sizeJit) / 100;
      const w = stamp.width * s, h = stamp.height * s;
      c.globalAlpha = (o.flow / 100) * (o.opJit ? 1 - (Math.random() * o.opJit) / 100 : 1);
      if (cfg.forceHard) c.imageSmoothingEnabled = false;
      if (scatter) { x += (Math.random() - 0.5) * o.size * scatter * 2; y += (Math.random() - 0.5) * o.size * scatter * 2; }
      if (shape === 'spray') { c.fillStyle = color; const r = (o.size / 2) * s, n = Math.max(4, Math.round(r * 0.8)); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * r, ds = Math.max(0.7, o.size / 40); c.fillRect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, ds, ds); } return; }
      let a = ((o.angle || 0) * Math.PI) / 180 + ang; if (o.angJit) a += (Math.random() - 0.5) * 2 * Math.PI * (o.angJit / 100);
      if (shape === 'chalk' || shape === 'leaf' || (shape.startsWith('custom') && o.scatter)) a += Math.random() * 6.283;
      const rnd = (o.round == null ? 100 : o.round) / 100;
      if (a || rnd < 1) { c.save(); c.translate(x, y); c.rotate(a); c.scale(1, rnd); c.drawImage(stamp, -w / 2, -h / 2, w, h); c.restore(); return; }
      c.drawImage(stamp, x - w / 2, y - h / 2, w, h);
    };
    this.eng = new StrokeEngine(d, Math.max(0.5, o.size * sp), (c, x, y, pr) => { for (const [px, py, ang] of MP.symPoints(x, y, d, o.sym)) dab1(c, px, py, pr, ang); });
    const eng = this.eng;
    MP.live = { layer: d.layer, target, draw: (ctx) => { ctx.globalAlpha = o.opacity / 100; ctx.globalCompositeOperation = op; ctx.drawImage(eng.clipped(), 0, 0); } };
    if (e.shiftKey && MP.lastPaint) eng.to(MP.lastPaint);
    this.sm = { x: p.x, y: p.y }; this.lastP = p;
    eng.to(p, e.pressure || 1); MP.render();
    clearInterval(this.airT); if (o.air) this.airT = setInterval(() => { if (this.eng && this.lastP) { for (const [px, py, ang] of MP.symPoints(this.lastP.x, this.lastP.y, d, o.sym)) dab1(this.eng.ctx, px, py, 1, ang); MP.render(); } }, 70);
  },
  move(p, e) {
    if (!this.eng) return;
    const k = (this.opts.smooth || 0) / 100;
    if (k) { this.sm = { x: MP.lerp(this.sm.x, p.x, 1 - k * 0.9), y: MP.lerp(this.sm.y, p.y, 1 - k * 0.9) }; p = this.sm; }
    this.lastP = p; this.eng.to(p, e.pressure || 1); MP.render();
  },
  up(p) {
    if (!this.eng) return;
    const d = MP.doc, live = MP.live, c = MP.canvasFor(live.target).getContext('2d');
    c.save(); live.draw(c, d); c.restore();
    clearInterval(this.airT); MP.lastPaint = { x: p.x, y: p.y }; this.eng = null; MP.afterEdit();
  },
  cancel() { clearInterval(this.airT); if (this.eng) { this.eng = null; MP.live = null; if (MP.doc) { MP.doc.history.undo(); MP.doc.history.redoStack.pop(); } } },
});

paintTool({ id: 'brush', name: 'Pinceau', key: 'B', icon: 'brush', defaults: { size: 30, hardness: 70, opacity: 100, flow: 100, pressure: true, shape: 'round', scatter: 0, blend: 'source-over' }, options: brushOpts([{ k: 'blend', label: 'Mode', type: 'select', options: MP.BLEND_MODES }, ...brushShapeOpts]) });
paintTool({ id: 'pencil', name: 'Crayon', key: 'N', icon: 'pencil', forceHard: true, spacing: 0.05, defaults: { size: 4, hardness: 100, opacity: 100, flow: 100, pressure: false },
  options: [{ k: 'size', label: 'Taille', type: 'range', min: 1, max: 200, unit: 'px' }, { k: 'opacity', label: 'Opacité', type: 'range', min: 1, max: 100, unit: '%' }, { k: 'pressure', label: 'Pression stylet', type: 'check' }] });
paintTool({ id: 'eraser', name: 'Gomme', key: 'E', icon: 'eraser', erase: true, defaults: { size: 40, hardness: 60, opacity: 100, flow: 100, pressure: false, shape: 'round', scatter: 0 }, options: brushOpts(brushShapeOpts) });

/* ---------- Tampon de duplication ---------- */
defTool({
  id: 'clone', name: 'Tampon de duplication', key: 'S', icon: 'clone', cursor: 'none',
  defaults: { size: 40, hardness: 50, opacity: 100, flow: 100, aligned: true, sample: 'layer', pressure: false },
  options: brushOpts([{ k: 'aligned', label: 'Aligné', type: 'check' }, { k: 'sample', label: 'Échantillon', type: 'select', options: [['layer', 'Calque actif'], ['all', 'Tous les calques']] }]),
  hint: 'Alt + clic pour définir la source',
  brushCursor() { return this.opts.size; },
  down(p, e) {
    const d = MP.doc;
    if (e.altKey) { this.src = { x: p.x, y: p.y }; this.offset = null; MP.toast('Source définie'); return; }
    if (!this.src) { MP.toast('Alt + clic pour définir la source du tampon'); return; }
    if (!MP.canEditPixels()) return;
    const o = this.opts;
    if (!this.offset || !o.aligned) this.offset = { x: this.src.x - p.x, y: this.src.y - p.y };
    d.history.record('Tampon de duplication', [d.layer.id]); MP.rasterize(d.layer);
    const snap = o.sample === 'all' ? MP.cloneCanvas(d.composite(null, { noLive: true })) : MP.cloneCanvas(d.layer.canvas);
    const stamp = MP.makeStamp(o.size, o.hardness / 100, '#ffffff');
    const tc = MP.createCanvas(stamp.width, stamp.height), tx = tc.getContext('2d'), off = this.offset, half = stamp.width / 2;
    this.eng = new StrokeEngine(d, o.size * 0.1, (c, x, y) => {
      tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, tc.width, tc.height); tx.drawImage(stamp, 0, 0);
      tx.globalCompositeOperation = 'source-in'; tx.drawImage(snap, -(x + off.x - half), -(y + off.y - half));
      c.globalAlpha = o.flow / 100; c.drawImage(tc, x - half, y - half);
    });
    const eng = this.eng;
    MP.live = { layer: d.layer, target: 'layer', draw: (ctx) => { ctx.globalAlpha = o.opacity / 100; ctx.drawImage(eng.clipped(), 0, 0); } };
    eng.to(p); MP.render();
  },
  move(p) { if (this.eng) { this.eng.to(p); MP.render(); } },
  up() {
    if (!this.eng) return;
    const d = MP.doc, c = d.layer.ctx; c.save(); MP.live.draw(c); c.restore();
    this.eng = null; MP.afterEdit();
  },
  overlay(ctx) {
    const v = MP.view; if (!this.src || !v.cursor) return;
    const sp = this.offset ? { x: v.cursor.x + this.offset.x, y: v.cursor.y + this.offset.y } : this.src;
    const s = MP.docToScreen(sp), dpr = v.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s.x - 8, s.y); ctx.lineTo(s.x + 8, s.y); ctx.moveTo(s.x, s.y - 8); ctx.lineTo(s.x, s.y + 8); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x, s.y, (this.opts.size / 2) * MP.doc.zoom, 0, Math.PI * 2); ctx.setLineDash([3, 3]); ctx.stroke();
  },
  cancel() { this.eng = null; },
});

/* ---------- Correcteur localisé (inpainting pull-push) ---------- */
MP.inpaint = (img, w, h, unknown) => {
  // img : Uint8ClampedArray RGBA ; unknown : Float32Array (0 = connu, 1 = à reconstruire)
  const levels = [];
  let lw = w, lh = h;
  const col = new Float32Array(w * h * 4), wt = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) { const k = 1 - unknown[p]; wt[p] = k; for (let c = 0; c < 4; c++) col[p * 4 + c] = img[p * 4 + c] * k; }
  for (let p = 0; p < w * h; p++) if (wt[p] > 0) for (let c = 0; c < 4; c++) col[p * 4 + c] /= wt[p];
  levels.push({ w, h, col, wt });
  while (lw > 1 || lh > 1) {
    const prev = levels[levels.length - 1], nw = Math.ceil(lw / 2), nh = Math.ceil(lh / 2);
    const nc = new Float32Array(nw * nh * 4), nwt = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let sw = 0; const acc = [0, 0, 0, 0];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const px = x * 2 + i, py = y * 2 + j; if (px >= lw || py >= lh) continue;
        const q = py * lw + px, a = prev.wt[q]; if (!a) continue; sw += a;
        for (let c = 0; c < 4; c++) acc[c] += prev.col[q * 4 + c] * a;
      }
      const o = y * nw + x; nwt[o] = Math.min(1, sw);
      if (sw > 0) for (let c = 0; c < 4; c++) nc[o * 4 + c] = acc[c] / sw;
    }
    levels.push({ w: nw, h: nh, col: nc, wt: nwt }); lw = nw; lh = nh;
  }
  for (let l = levels.length - 2; l >= 0; l--) {
    const L = levels[l], P = levels[l + 1];
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const o = y * L.w + x, a = L.wt[o]; if (a >= 1) continue;
      const fx = MP.clamp((x + 0.5) / 2 - 0.5, 0, P.w - 1), fy = MP.clamp((y + 0.5) / 2 - 0.5, 0, P.h - 1);
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(P.w - 1, x0 + 1), y1 = Math.min(P.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
      for (let c = 0; c < 4; c++) {
        const v = (P.col[(y0 * P.w + x0) * 4 + c] * (1 - tx) + P.col[(y0 * P.w + x1) * 4 + c] * tx) * (1 - ty) + (P.col[(y1 * P.w + x0) * 4 + c] * (1 - tx) + P.col[(y1 * P.w + x1) * 4 + c] * tx) * ty;
        L.col[o * 4 + c] = L.col[o * 4 + c] * a + v * (1 - a);
      }
    }
  }
  // Lissage (Jacobi) dans la zone inconnue
  const C = levels[0].col;
  for (let it = 0; it < 30; it++) {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x; if (unknown[p] <= 0) continue;
      for (let c = 0; c < 4; c++) { const v = (C[(p - 1) * 4 + c] + C[(p + 1) * 4 + c] + C[(p - w) * 4 + c] + C[(p + w) * 4 + c]) / 4; C[p * 4 + c] = MP.lerp(C[p * 4 + c], v, unknown[p]); }
    }
  }
  return C;
};
/** Reconstruit la zone (alpha de maskCanvas) dans la toile cible. */
MP.healRegion = (target, maskCanvas, margin, noise = true) => {
  const b = MP.alphaBounds(maskCanvas, 0); if (!b) return false;
  const W = target.width, H = target.height;
  const x0 = Math.max(0, b.x - margin), y0 = Math.max(0, b.y - margin), x1 = Math.min(W, b.x + b.w + margin), y1 = Math.min(H, b.y + b.h + margin);
  const w = x1 - x0, h = y1 - y0;
  const tc = target.getContext('2d'), id = tc.getImageData(x0, y0, w, h), px = id.data;
  const m = maskCanvas.getContext('2d').getImageData(x0, y0, w, h).data;
  const unk = new Float32Array(w * h); for (let p = 0; p < w * h; p++) unk[p] = m[p * 4 + 3] / 255;
  const fill = MP.inpaint(px, w, h, unk);
  // estimation du grain de l'image autour de la zone
  let sigma = 0;
  if (noise) {
    let n = 0, s = 0, s2 = 0;
    for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
      const p = y * w + x; if (unk[p] > 0) continue;
      const l = px[p * 4] * 0.3 + px[p * 4 + 1] * 0.59 + px[p * 4 + 2] * 0.11, l2 = px[(p + 1) * 4] * 0.3 + px[(p + 1) * 4 + 1] * 0.59 + px[(p + 1) * 4 + 2] * 0.11;
      const dd = l - l2; s += dd; s2 += dd * dd; n++;
    }
    if (n > 4) sigma = Math.min(18, Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) / Math.SQRT2);
  }
  for (let p = 0; p < w * h; p++) {
    const a = unk[p]; if (a <= 0) continue;
    const g = sigma ? (Math.random() + Math.random() + Math.random() - 1.5) * sigma * 1.4 : 0;
    for (let c = 0; c < 3; c++) px[p * 4 + c] = MP.lerp(px[p * 4 + c], fill[p * 4 + c] + g, a);
    px[p * 4 + 3] = MP.lerp(px[p * 4 + 3], fill[p * 4 + 3], a);
  }
  tc.putImageData(id, x0, y0); return true;
};

defTool({
  id: 'heal', name: 'Correcteur localisé', key: 'J', icon: 'heal', cursor: 'none',
  defaults: { size: 30, hardness: 80 },
  options: [{ k: 'size', label: 'Taille', type: 'range', min: 2, max: 400, unit: 'px' }, { k: 'hardness', label: 'Dureté', type: 'range', min: 0, max: 100, unit: '%' }],
  hint: 'Peignez sur une imperfection : elle est reconstruite à partir de son entourage',
  brushCursor() { return this.opts.size; },
  down(p) {
    const d = MP.doc; if (!MP.canEditPixels()) return;
    const o = this.opts, stamp = MP.makeStamp(o.size, o.hardness / 100, '#ffffff');
    this.eng = new StrokeEngine(d, o.size * 0.1, (c, x, y) => { c.globalAlpha = 1; c.drawImage(stamp, x - stamp.width / 2, y - stamp.height / 2); });
    const eng = this.eng;
    MP.live = { layer: d.layer, target: 'layer', draw: (ctx) => { ctx.globalAlpha = 0.45; ctx.globalCompositeOperation = 'source-atop'; ctx.filter = 'brightness(0)'; ctx.drawImage(eng.clipped(), 0, 0); ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.35; ctx.drawImage(eng.clipped(), 0, 0); } };
    eng.to(p); MP.render();
  },
  move(p) { if (this.eng) { this.eng.to(p); MP.render(); } },
  up() {
    if (!this.eng) return;
    const d = MP.doc, mask = this.eng.clipped(); this.eng = null; MP.live = null;
    d.history.record('Correcteur localisé', [d.layer.id]); MP.rasterize(d.layer);
    MP.healRegion(d.layer.canvas, mask, Math.round(this.opts.size * 1.2 + 6));
    MP.afterEdit();
  },
  cancel() { this.eng = null; MP.live = null; },
});

/* ---------- Outils de retouche directe (flou, netteté, doigt, densité, éponge) ---------- */
const retouchTool = (cfg) => defTool({
  ...cfg, cursor: 'none',
  defaults: { size: 40, hardness: 50, strength: 50, ...(cfg.defaults || {}) },
  options: [{ k: 'size', label: 'Taille', type: 'range', min: 2, max: 500, unit: 'px' }, { k: 'hardness', label: 'Dureté', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'strength', label: cfg.strengthLabel || 'Intensité', type: 'range', min: 1, max: 100, unit: '%' }, ...(cfg.extra || [])],
  brushCursor() { return this.opts.size; },
  down(p) {
    const d = MP.doc; if (!MP.canEditPixels()) return;
    d.history.record(cfg.name, [d.layer.id]); MP.rasterize(d.layer);
    this.selA = d.selection ? d.selection.getContext('2d').getImageData(0, 0, d.width, d.height).data : null;
    this.carried = null;
    const o = this.opts;
    this.eng = new StrokeEngine(d, o.size * 0.2, (c, x, y) => this.dab(x, y));
    this.eng.to(p); MP.render();
  },
  move(p) { if (this.eng) { this.eng.to(p); MP.render(); } },
  up() { if (this.eng) { this.eng = null; this.selA = null; MP.afterEdit(); } },
  cancel() { this.eng = null; },
  dab(x, y) {
    const d = MP.doc, o = this.opts, cv = d.layer.canvas, r = o.size / 2, R = Math.ceil(r), pad = 2;
    const x0 = Math.max(0, Math.round(x) - R - pad), y0 = Math.max(0, Math.round(y) - R - pad);
    const x1 = Math.min(cv.width, Math.round(x) + R + pad + 1), y1 = Math.min(cv.height, Math.round(y) + R + pad + 1);
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return;
    const ctx = cv.getContext('2d'), id = ctx.getImageData(x0, y0, w, h), dst = id.data, src = new Uint8ClampedArray(dst);
    const hard = o.hardness / 100, k = o.strength / 100;
    if (cfg.id === 'smudge' && !this.carried) {
      const RR = R + pad, S = RR * 2 + 1, data = new Float32Array(S * S * 4), valid = new Uint8Array(S * S);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const lx = x0 + xx - Math.round(x) + RR, ly = y0 + yy - Math.round(y) + RR; if (lx < 0 || ly < 0 || lx >= S || ly >= S) continue;
        const q = ly * S + lx, i = (yy * w + xx) * 4; valid[q] = 1; for (let c = 0; c < 4; c++) data[q * 4 + c] = src[i + c];
      }
      this.carried = { RR, S, data, valid }; return;
    }
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const gx = x0 + xx, gy = y0 + yy, dist = Math.hypot(gx + 0.5 - x, gy + 0.5 - y) / r;
      if (dist > 1) continue;
      let f = dist <= hard ? 1 : 1 - (dist - hard) / (1 - hard + 1e-6); f = f * f * (3 - 2 * f);
      let wgt = f * k; if (this.selA) wgt *= this.selA[(gy * d.width + gx) * 4 + 3] / 255;
      if (wgt <= 0.001) continue;
      cfg.op.call(this, src, dst, (yy * w + xx) * 4, wgt, xx, yy, w, h, gx, gy, x, y);
    }
    ctx.putImageData(id, x0, y0); d.layer._v = (d.layer._v || 0) + 1;
  },
});
const avg3 = (s, i, xx, yy, w, h, c) => {
  let t = 0, n = 0;
  for (let j = -1; j <= 1; j++) for (let q = -1; q <= 1; q++) { const X = xx + q, Y = yy + j; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; t += s[(Y * w + X) * 4 + c]; n++; }
  return t / n;
};
retouchTool({ id: 'blur', name: 'Goutte d\'eau (flou)', key: 'R', icon: 'blur', op(s, dd, i, wg, xx, yy, w, h) { for (let c = 0; c < 4; c++) dd[i + c] = MP.lerp(s[i + c], avg3(s, i, xx, yy, w, h, c), Math.min(1, wg * 1.5)); } });
retouchTool({ id: 'sharpen', name: 'Netteté', key: 'Y', icon: 'sharpen', defaults: { strength: 30 }, op(s, dd, i, wg, xx, yy, w, h) { for (let c = 0; c < 3; c++) { const a = avg3(s, i, xx, yy, w, h, c); dd[i + c] = s[i + c] + (s[i + c] - a) * wg * 1.5; } } });
retouchTool({
  id: 'smudge', name: 'Doigt', key: 'F', icon: 'smudge', op(s, dd, i, wg, xx, yy, w, h, gx, gy, x, y) {
    const C = this.carried, lx = gx - Math.round(x) + C.RR, ly = gy - Math.round(y) + C.RR;
    if (lx < 0 || ly < 0 || lx >= C.S || ly >= C.S) return;
    const q = ly * C.S + lx; if (!C.valid[q]) return;
    const ci = q * 4;
    for (let c = 0; c < 4; c++) { const v = MP.lerp(s[i + c], C.data[ci + c], wg); dd[i + c] = v; C.data[ci + c] = MP.lerp(C.data[ci + c], v, 0.2); }
  },
});
retouchTool({ id: 'dodge', name: 'Densité − (éclaircir)', key: 'O', icon: 'dodge', strengthLabel: 'Exposition', defaults: { strength: 30 }, op(s, dd, i, wg) { for (let c = 0; c < 3; c++) dd[i + c] = s[i + c] + (255 - s[i + c]) * wg * 0.35; } });
retouchTool({ id: 'burn', name: 'Densité + (assombrir)', key: 'P', icon: 'burn', strengthLabel: 'Exposition', defaults: { strength: 30 }, op(s, dd, i, wg) { for (let c = 0; c < 3; c++) dd[i + c] = s[i + c] * (1 - wg * 0.35); } });
retouchTool({
  id: 'sponge', name: 'Éponge', key: '', icon: 'sponge', strengthLabel: 'Débit', defaults: { mode: 'desat' },
  extra: [{ k: 'mode', label: 'Mode', type: 'select', options: [['desat', 'Désaturer'], ['sat', 'Saturer']] }],
  op(s, dd, i, wg) { const g = s[i] * 0.299 + s[i + 1] * 0.587 + s[i + 2] * 0.114, f = this.opts.mode === 'sat' ? wg * 0.5 : -wg * 0.5; for (let c = 0; c < 3; c++) dd[i + c] = s[i + c] + (s[i + c] - g) * f; },
});

/* ---------- Pot de peinture ---------- */
defTool({
  id: 'bucket', name: 'Pot de peinture', key: 'K', icon: 'bucket', cursor: 'crosshair',
  defaults: { tolerance: 32, contiguous: true, all: false, opacity: 100 },
  options: [{ k: 'tolerance', label: 'Tolérance', type: 'range', min: 0, max: 100 }, { k: 'opacity', label: 'Opacité', type: 'range', min: 1, max: 100, unit: '%' }, { k: 'contiguous', label: 'Pixels contigus', type: 'check' }, { k: 'all', label: 'Tous les calques', type: 'check' }],
  down(p) {
    const d = MP.doc; if (!MP.canEdit()) return;
    const o = this.opts, target = MP.target();
    const src = o.all ? MP.cloneCanvas(d.composite(null, { noLive: true })) : MP.targetCanvas();
    const region = MP.floodMask(src, p.x, p.y, o.tolerance, o.contiguous); if (!region) return;
    MP.recordFor('Pot de peinture');
    const fill = MP.createCanvas(d.width, d.height), fc = fill.getContext('2d');
    let op = 'source-over';
    if (target !== 'layer') { fc.fillStyle = '#fff'; if (lumHex(MP.colors.fg) < 128) op = 'destination-out'; } else fc.fillStyle = MP.colors.fg;
    if (target === 'layer' && d.layer.lockAlpha) op = 'source-atop';
    fc.fillRect(0, 0, d.width, d.height); fc.globalCompositeOperation = 'destination-in'; fc.drawImage(region, 0, 0);
    d.clipToSelection(fill);
    const c = MP.targetCanvas().getContext('2d'); c.save(); c.globalAlpha = o.opacity / 100; c.globalCompositeOperation = op; c.drawImage(fill, 0, 0); c.restore();
    MP.afterEdit();
  },
});

/* ---------- Dégradé ---------- */
defTool({
  id: 'gradient', name: 'Dégradé', key: 'G', icon: 'gradient', cursor: 'crosshair',
  defaults: { type: 'linear', mode: 'fgbg', opacity: 100, reverse: false },
  options: [
    { k: 'type', label: 'Type', type: 'select', options: [['linear', 'Linéaire'], ['radial', 'Radial'], ['angle', 'Angulaire'], ['reflected', 'Réfléchi'], ['diamond', 'Losange']] },
    { k: 'mode', label: 'Couleurs', type: 'select', options: [['fgbg', 'Premier plan → Arrière-plan'], ['fgtr', 'Premier plan → Transparent'], ['rainbow', 'Spectre'], ['preset', 'Préréglage (panneau Dégradés)']] },
    { k: 'opacity', label: 'Opacité', type: 'range', min: 1, max: 100, unit: '%' }, { k: 'reverse', label: 'Inverser', type: 'check' },
  ],
  stops() {
    const o = this.opts, f = MP.hexToRgb(MP.colors.fg), b = MP.hexToRgb(MP.colors.bg);
    let s;
    if (o.mode === 'preset' && o.presetStops) s = o.presetStops.map((x) => [...x]);
    else if (o.mode === 'rainbow') s = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'].map((c, i, a) => [i / (a.length - 1), c]);
    else if (o.mode === 'fgtr') s = [[0, `rgba(${f.r},${f.g},${f.b},1)`], [1, `rgba(${f.r},${f.g},${f.b},0)`]];
    else s = [[0, MP.colors.fg], [1, `rgb(${b.r},${b.g},${b.b})`]];
    if (o.reverse) s = s.map(([t, c]) => [1 - t, c]).reverse();
    return s;
  },
  build(a, b) {
    const d = MP.doc, o = this.opts, cv = MP.createCanvas(d.width, d.height), c = cv.getContext('2d');
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const stops = this.stops(); let g;
    const add = (g, list) => list.forEach(([t, col]) => g.addColorStop(MP.clamp(t, 0, 1), col));
    if (o.type === 'radial') { g = c.createRadialGradient(a.x, a.y, 0, a.x, a.y, len); add(g, stops); }
    else if (o.type === 'angle') { g = c.createConicGradient(Math.atan2(dy, dx), a.x, a.y); add(g, stops); }
    else if (o.type === 'reflected') { g = c.createLinearGradient(a.x - dx, a.y - dy, b.x, b.y); add(g, [...stops.map(([t, col]) => [0.5 - t / 2, col]).reverse(), ...stops.map(([t, col]) => [0.5 + t / 2, col])]); }
    else if (o.type === 'diamond') {
      // losange : distance de Manhattan dans le repère tourné
      const id = c.createImageData(d.width, d.height), px = id.data, tmp = MP.createCanvas(256, 1), tc = tmp.getContext('2d');
      const lg = tc.createLinearGradient(0, 0, 256, 0); add(lg, stops); tc.fillStyle = lg; tc.fillRect(0, 0, 256, 1);
      const lut = tc.getImageData(0, 0, 256, 1).data, ux = dx / len, uy = dy / len;
      for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
        const rx = x - a.x, ry = y - a.y, t = Math.min(1, (Math.abs(rx * ux + ry * uy) + Math.abs(-rx * uy + ry * ux)) / len), k = Math.min(255, Math.round(t * 255)) * 4, i = (y * d.width + x) * 4;
        px[i] = lut[k]; px[i + 1] = lut[k + 1]; px[i + 2] = lut[k + 2]; px[i + 3] = lut[k + 3];
      }
      c.putImageData(id, 0, 0); return d.clipToSelection(cv);
    } else { g = c.createLinearGradient(a.x, a.y, b.x, b.y); add(g, stops); }
    c.fillStyle = g; c.fillRect(0, 0, d.width, d.height);
    return d.clipToSelection(cv);
  },
  down(p) {
    if (!MP.canEdit()) return;
    this.a = p; this.b = p; this.active = true;
  },
  move(p, e) {
    if (!this.active) return;
    if (e.shiftKey) { const dx = p.x - this.a.x, dy = p.y - this.a.y, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(dx, dy); p = { x: this.a.x + Math.cos(ang) * l, y: this.a.y + Math.sin(ang) * l }; }
    this.b = p; MP.render();
  },
  up() {
    if (!this.active) return; this.active = false;
    const d = MP.doc; if (Math.hypot(this.b.x - this.a.x, this.b.y - this.a.y) < 1) { MP.render(); return; }
    MP.recordFor('Dégradé');
    const g = this.build(this.a, this.b), c = MP.targetCanvas().getContext('2d');
    c.save(); c.globalAlpha = this.opts.opacity / 100; if (MP.target() === 'layer' && d.layer.lockAlpha) c.globalCompositeOperation = 'source-atop'; c.drawImage(g, 0, 0); c.restore();
    MP.afterEdit();
  },
  overlay(ctx) {
    if (!this.active) return;
    const a = MP.docToScreen(this.a), b = MP.docToScreen(this.b), dpr = MP.view.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.stroke();
    [a, b].forEach((q) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 7); ctx.fill(); ctx.stroke(); });
  },
  cancel() { this.active = false; },
});

/* ---------- Pipette ---------- */
defTool({
  id: 'eyedropper', name: 'Pipette', key: 'I', icon: 'eyedropper', cursor: 'crosshair',
  defaults: { sample: 1, all: true }, hint: 'Alt + clic : couleur d\'arrière-plan',
  options: [{ k: 'sample', label: 'Échantillon', type: 'select', options: [[1, 'Pixel'], [3, 'Moyenne 3 × 3'], [5, 'Moyenne 5 × 5'], [11, 'Moyenne 11 × 11']] }, { k: 'all', label: 'Tous les calques', type: 'check' }],
  pick(p, e) {
    const d = MP.doc, src = this.opts.all ? d.composite(null, { noLive: true }) : d.layer.canvas;
    const n = +this.opts.sample, h = (n - 1) / 2, x0 = MP.clamp(Math.floor(p.x) - h, 0, d.width - 1), y0 = MP.clamp(Math.floor(p.y) - h, 0, d.height - 1);
    const w = Math.min(n, d.width - x0), hh = Math.min(n, d.height - y0);
    const data = src.getContext('2d').getImageData(x0, y0, w, hh).data;
    let r = 0, g = 0, b = 0, a = 0;
    for (let i = 0; i < data.length; i += 4) { const al = data[i + 3]; r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += al; }
    if (!a) return;
    const hex = MP.rgbToHex(r / a, g / a, b / a);
    if (e.altKey) MP.colors.bg = hex; else MP.colors.fg = hex;
    MP.ui.refreshColors();
  },
  down(p, e) { this.on = true; this.pick(p, e); },
  move(p, e) { if (this.on) this.pick(p, e); },
  up() { this.on = false; },
});

/* ---------- Déplacement ---------- */
defTool({
  id: 'move', name: 'Déplacement', key: 'V', icon: 'move', cursor: 'move',
  defaults: { autoSelect: false },
  options: [{ k: 'autoSelect', label: 'Sélection auto. du calque', type: 'check' }, { k: 'transform', label: 'Transformation (Ctrl+T)', type: 'button', action: () => MP.startTransform() },
    { k: 'al', label: 'Aligner :', type: 'label' },
    { k: 'aL', label: '⇤', title: 'Aligner à gauche', type: 'button', action: () => MP.alignLayer('left') }, { k: 'aC', label: '↔', title: 'Centrer horizontalement', type: 'button', action: () => MP.alignLayer('hcenter') }, { k: 'aR', label: '⇥', title: 'Aligner à droite', type: 'button', action: () => MP.alignLayer('right') },
    { k: 'aT', label: '⤒', title: 'Aligner en haut', type: 'button', action: () => MP.alignLayer('top') }, { k: 'aM', label: '↕', title: 'Centrer verticalement', type: 'button', action: () => MP.alignLayer('vcenter') }, { k: 'aB', label: '⤓', title: 'Aligner en bas', type: 'button', action: () => MP.alignLayer('bottom') }],
  pickLayer(p) {
    const d = MP.doc, x = Math.floor(p.x), y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= d.width || y >= d.height) return;
    for (let i = d.layers.length - 1; i >= 0; i--) {
      const l = d.layers[i]; if (!l.visible || l.isGroup || l.adjust || d.isHiddenByParent(l)) continue;
      if (l.canvas.getContext('2d').getImageData(x, y, 1, 1).data[3] > 10) { d.active = i; d.editMask = false; MP.ui.refreshLayers(); return; }
    }
  },
  begin(p) {
    const d = MP.doc; if (!d || !d.layer) return false;
    const l = d.layer; this.start = p; this.dx = 0; this.dy = 0;
    if (l.isGroup) return this.beginGroup(p);
    if (!MP.canEditPixels()) return false;
    if (l.text && !d.selection) { d.history.record('Déplacer le texte', null); this.text = { x: l.text.x, y: l.text.y }; return true; }
    this.text = null;
    d.history.record('Déplacement', [l.id]); MP.rasterize(l);
    const w = d.width, h = d.height;
    if (d.selection) {
      this.float = MP.cloneCanvas(l.canvas); d.clipToSelection(this.float);
      this.base = MP.cloneCanvas(l.canvas); const bc = this.base.getContext('2d'); bc.globalCompositeOperation = 'destination-out'; bc.drawImage(d.selection, 0, 0);
      this.selPath = d.selPath; d.selPath = null;
    } else { this.float = MP.cloneCanvas(l.canvas); this.base = null; this.selPath = null; }
    MP.live = { layer: l, target: 'layer', draw: (ctx) => { ctx.clearRect(0, 0, w, h); if (this.base) ctx.drawImage(this.base, 0, 0); ctx.drawImage(this.float, Math.round(this.dx), Math.round(this.dy)); } };
    return true;
  },
  beginGroup() {
    const d = MP.doc, g = d.layer, ls = d.descendants(g).filter((l) => !l.isGroup && !l.adjust && !l.locked);
    if (!ls.length) { MP.toast('Groupe vide'); return false; }
    d.history.record('Déplacer le groupe', ls.filter((l) => !l.text).map((l) => l.id));
    this.group = ls.map((l) => ({ l, float: l.text ? null : MP.cloneCanvas(l.canvas), tx: l.text ? { x: l.text.x, y: l.text.y } : null }));
    this.text = null; this.base = null; this.selPath = null;
    const map = new Map(this.group.map((e) => [e.l, e]));
    MP.live = { layer: null, layers: ls.filter((l) => !l.text), target: 'layer', draw: (ctx, doc, l) => { const e = map.get(l); if (!e) return; ctx.clearRect(0, 0, doc.width, doc.height); ctx.drawImage(e.float, Math.round(this.dx), Math.round(this.dy)); } };
    return true;
  },
  update(dx, dy) {
    this.dx = dx; this.dy = dy;
    if (this.group) { for (const e of this.group) if (e.tx) { e.l.text.x = e.tx.x + Math.round(dx); e.l.text.y = e.tx.y + Math.round(dy); MP.renderText(e.l); } MP.render(); return; }
    if (this.text) { const l = MP.doc.layer; l.text.x = this.text.x + Math.round(dx); l.text.y = this.text.y + Math.round(dy); MP.renderText(l); }
    MP.render();
  },
  finish() {
    const d = MP.doc, l = d.layer, dx = Math.round(this.dx), dy = Math.round(this.dy);
    if (this.group) { for (const e of this.group) if (e.float) { e.l._v = (e.l._v || 0) + 1; const c = e.l.ctx; c.clearRect(0, 0, d.width, d.height); c.drawImage(e.float, dx, dy); } this.group = null; MP.afterEdit(); return; }
    if (this.text) { this.text = null; MP.afterEdit(); return; }
    const c = l.ctx; c.save(); MP.live.draw(c); c.restore();
    if (d.selection) {
      const s = MP.createCanvas(d.width, d.height); s.getContext('2d').drawImage(d.selection, dx, dy); d.selection = s; MP.sel.updatePath(d);
    } else if (l.mask) {
      const m = MP.createCanvas(d.width, d.height), mc = m.getContext('2d'); mc.fillStyle = '#fff'; mc.fillRect(0, 0, d.width, d.height);
      mc.globalCompositeOperation = 'destination-out'; mc.fillRect(dx, dy, d.width, d.height); mc.globalCompositeOperation = 'source-over';
      mc.clearRect(dx, dy, d.width, d.height); mc.drawImage(l.mask, dx, dy); l.mask = m;
    }
    this.float = this.base = null; MP.afterEdit();
  },
  down(p, e) {
    if (this.opts.autoSelect || e.ctrlKey || e.metaKey) this.pickLayer(p);
    this.dragging = this.begin(p);
  },
  move(p, e) {
    if (!this.dragging) return;
    let dx = p.x - this.start.x, dy = p.y - this.start.y;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    this.update(dx, dy);
  },
  up() { if (this.dragging) { this.dragging = false; this.finish(); } },
  nudge(dx, dy) { if (this.begin({ x: 0, y: 0 })) { this.update(dx, dy); this.finish(); } },
  overlay(ctx) {
    if (!this.dragging || !this.selPath) return;
    MP.overlayDocTransform(ctx); ctx.translate(Math.round(this.dx), Math.round(this.dy));
    ctx.lineWidth = 1 / MP.doc.zoom; ctx.setLineDash([4 / MP.doc.zoom, 4 / MP.doc.zoom]); ctx.strokeStyle = '#000'; ctx.stroke(this.selPath);
    ctx.strokeStyle = '#fff'; ctx.lineDashOffset = 4 / MP.doc.zoom; ctx.stroke(this.selPath);
  },
  cancel() { if (this.dragging) { this.dragging = false; this.finish(); } },
});

MP.alignLayer = (where) => {
  const d = MP.doc; if (!d || !MP.canEdit()) return;
  const l = d.layer, b = MP.alphaBounds(l.canvas); if (!b) return;
  const area = MP.sel.bounds(d) || { x: 0, y: 0, w: d.width, h: d.height };
  let dx = 0, dy = 0;
  if (where === 'left') dx = area.x - b.x; if (where === 'right') dx = area.x + area.w - (b.x + b.w); if (where === 'hcenter') dx = Math.round(area.x + area.w / 2 - (b.x + b.w / 2));
  if (where === 'top') dy = area.y - b.y; if (where === 'bottom') dy = area.y + area.h - (b.y + b.h); if (where === 'vcenter') dy = Math.round(area.y + area.h / 2 - (b.y + b.h / 2));
  if (!dx && !dy) return;
  const sel = d.selection; d.selection = null; d.selPath = null;
  MP.tools.move.nudge(dx, dy);
  d.selection = sel; MP.sel.updatePath(d); MP.render();
};

/* ---------- Sélections ---------- */
const selModeOpt = { k: 'mode', label: 'Mode', type: 'select', options: [['new', 'Nouvelle'], ['add', 'Ajouter (Maj)'], ['sub', 'Soustraire (Alt)'], ['inter', 'Intersection']] };
const marquee = (id, name, key, icon, ellipse) => defTool({
  id, name, key, icon, cursor: 'crosshair',
  defaults: { mode: 'new', feather: 0, style: 'normal', rw: 1, rh: 1 },
  options: [selModeOpt, { k: 'feather', label: 'Contour progressif', type: 'range', min: 0, max: 250, unit: 'px' }, { k: 'style', label: 'Style', type: 'select', options: [['normal', 'Normal'], ['ratio', 'Proportions fixes'], ['size', 'Taille fixe']] }, { k: 'rw', label: 'L', type: 'number', min: 1 }, { k: 'rh', label: 'H', type: 'number', min: 1 }],
  down(p, e) { this.mode = e.shiftKey && e.altKey ? 'inter' : e.shiftKey ? 'add' : e.altKey ? 'sub' : this.opts.mode; this.shift0 = e.shiftKey; this.a = p; this.b = p; this.on = true; MP.render(); },
  rect(e) {
    let { a, b } = this, w = b.x - a.x, h = b.y - a.y; const o = this.opts;
    if (o.style === 'size') { w = +o.rw; h = +o.rh; return { x: Math.round(b.x - w / 2), y: Math.round(b.y - h / 2), w, h }; }
    if (o.style === 'ratio' || (e && e.shiftKey && !this.shift0)) { const rw = o.style === 'ratio' ? +o.rw : 1, rh = o.style === 'ratio' ? +o.rh : 1; const s = Math.max(Math.abs(w) / rw, Math.abs(h) / rh); w = Math.sign(w || 1) * s * rw; h = Math.sign(h || 1) * s * rh; }
    if (e && e.altKey && !(this.mode === 'sub')) { return { x: a.x - w, y: a.y - h, w: 2 * w, h: 2 * h }; }
    return { x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + h), w: Math.abs(w), h: Math.abs(h) };
  },
  move(p, e) { if (!this.on) return; this.b = p; this.lastE = { shiftKey: e.shiftKey, altKey: e.altKey }; MP.render(); },
  up(p, e) {
    if (!this.on) return; this.on = false;
    const d = MP.doc, r = this.rect(this.lastE);
    const nr = { x: Math.round(Math.min(r.x, r.x + r.w)), y: Math.round(Math.min(r.y, r.y + r.h)), w: Math.round(Math.abs(r.w)), h: Math.round(Math.abs(r.h)) };
    if ((nr.w < 1 || nr.h < 1) && this.opts.style !== 'size') {
      if (this.mode === 'new' && d.selection) { d.history.record('Désélectionner', null); MP.sel.none(d); MP.ui.refreshAll(); }
      MP.render(); return;
    }
    d.history.record(name, null);
    MP.sel.apply(d, this.mode, (c) => { c.beginPath(); if (ellipse) c.ellipse(nr.x + nr.w / 2, nr.y + nr.h / 2, nr.w / 2, nr.h / 2, 0, 0, Math.PI * 2); else c.rect(nr.x, nr.y, nr.w, nr.h); c.fill(); }, +this.opts.feather);
    this.lastE = null; MP.ui.refreshAll(); MP.render();
  },
  overlay(ctx) {
    if (!this.on) return; const r = this.rect(this.lastE);
    MP.overlayDocTransform(ctx); const z = MP.doc.zoom;
    ctx.lineWidth = 1 / z; ctx.setLineDash([4 / z, 4 / z]); ctx.beginPath();
    if (ellipse) ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.abs(r.w / 2), Math.abs(r.h / 2), 0, 0, Math.PI * 2); else ctx.rect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#000'; ctx.stroke(); ctx.lineDashOffset = 4 / z; ctx.strokeStyle = '#fff'; ctx.stroke();
    MP.ui.setInfo(`${Math.round(Math.abs(r.w))} × ${Math.round(Math.abs(r.h))} px`);
  },
  cancel() { this.on = false; },
});
marquee('marquee', 'Rectangle de sélection', 'M', 'marquee', false);
marquee('ellipse', 'Ellipse de sélection', 'M', 'ellipse', true);

defTool({
  id: 'lasso', name: 'Lasso', key: 'L', icon: 'lasso', cursor: 'crosshair',
  defaults: { mode: 'new', feather: 0, poly: false },
  options: [selModeOpt, { k: 'feather', label: 'Contour progressif', type: 'range', min: 0, max: 250, unit: 'px' }, { k: 'poly', label: 'Polygonal (clics, double-clic pour fermer)', type: 'check' }],
  down(p, e) {
    if (this.opts.poly) {
      if (!this.pts) { this.pts = [p]; this.mode = e.shiftKey ? 'add' : e.altKey ? 'sub' : this.opts.mode; }
      else {
        const f = this.pts[0], close = Math.hypot(p.x - f.x, p.y - f.y) * MP.doc.zoom < 8;
        if (close) { this.finish(); return; }
        this.pts.push(p);
      }
      this.hover = p; MP.render(); return;
    }
    this.mode = e.shiftKey ? 'add' : e.altKey ? 'sub' : this.opts.mode; this.pts = [p]; this.on = true;
  },
  move(p) { if (this.opts.poly) { this.hover = p; if (this.pts) MP.render(); return; } if (this.on) { this.pts.push(p); MP.render(); } },
  up() { if (!this.opts.poly && this.on) { this.on = false; this.finish(); } },
  dbl() { if (this.opts.poly && this.pts && this.pts.length > 3) { const a = this.pts.at(-1), b = this.pts.at(-2); if (Math.hypot(a.x - b.x, a.y - b.y) * MP.doc.zoom < 8) { this.pts.pop(); this.finish(); } } },
  finish() {
    const pts = this.pts; this.pts = null; const d = MP.doc;
    if (!pts || pts.length < 3) { MP.render(); return; }
    d.history.record('Lasso', null);
    MP.sel.apply(d, this.mode, (c) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill(); }, +this.opts.feather);
    MP.ui.refreshAll(); MP.render();
  },
  onKey(e) { if (this.pts && this.opts.poly) { if (e.key === 'Enter') { this.finish(); return true; } if (e.key === 'Escape') { this.pts = null; MP.render(); return true; } } return false; },
  overlay(ctx) {
    if (!this.pts) return; MP.overlayDocTransform(ctx); const z = MP.doc.zoom;
    ctx.lineWidth = 1 / z; ctx.setLineDash([4 / z, 4 / z]); ctx.beginPath();
    this.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    if (this.opts.poly && this.hover) ctx.lineTo(this.hover.x, this.hover.y);
    ctx.strokeStyle = '#000'; ctx.stroke(); ctx.lineDashOffset = 4 / z; ctx.strokeStyle = '#fff'; ctx.stroke();
  },
  cancel() { this.pts = null; this.on = false; },
});

defTool({
  id: 'wand', name: 'Baguette magique', key: 'W', icon: 'wand', cursor: 'crosshair',
  defaults: { mode: 'new', tolerance: 32, contiguous: true, all: false },
  options: [selModeOpt, { k: 'tolerance', label: 'Tolérance', type: 'range', min: 0, max: 100 }, { k: 'contiguous', label: 'Pixels contigus', type: 'check' }, { k: 'all', label: 'Tous les calques', type: 'check' }],
  down(p, e) {
    const d = MP.doc, o = this.opts;
    const src = o.all ? MP.cloneCanvas(d.composite(null, { noLive: true })) : d.layer.canvas;
    const m = MP.floodMask(src, p.x, p.y, o.tolerance, o.contiguous); if (!m) return;
    const mode = e.shiftKey ? 'add' : e.altKey ? 'sub' : o.mode;
    d.history.record('Baguette magique', null); MP.sel.fromMask(d, m, mode); MP.ui.refreshAll(); MP.render();
  },
});

/* ---------- Recadrage ---------- */
defTool({
  id: 'crop', name: 'Recadrage', key: 'C', icon: 'crop', cursor: 'crosshair',
  defaults: { ratio: 'free' }, hint: 'Entrée pour valider, Échap pour annuler',
  options: [{ k: 'ratio', label: 'Ratio', type: 'select', options: [['free', 'Libre'], ['1:1', '1:1 (carré)'], ['4:3', '4:3'], ['3:2', '3:2'], ['16:9', '16:9'], ['9:16', '9:16 (story)'], ['4:5', '4:5 (portrait)']] },
    { k: 'ok', label: '✔ Valider', type: 'button', action: () => MP.tools.crop.apply() }, { k: 'no', label: '✖ Annuler', type: 'button', action: () => { MP.tools.crop.r = null; MP.render(); } }],
  down(p) {
    const r = this.r;
    if (r && p.x > r.x && p.y > r.y && p.x < r.x + r.w && p.y < r.y + r.h) { this.drag = 'move'; this.off = { x: p.x - r.x, y: p.y - r.y }; return; }
    this.drag = 'new'; this.a = p; this.r = { x: p.x, y: p.y, w: 0, h: 0 };
  },
  move(p) {
    if (!this.drag) return; const d = MP.doc;
    if (this.drag === 'move') { this.r.x = MP.clamp(p.x - this.off.x, 0, d.width - this.r.w); this.r.y = MP.clamp(p.y - this.off.y, 0, d.height - this.r.h); }
    else {
      let w = p.x - this.a.x, h = p.y - this.a.y; const rt = this.opts.ratio;
      if (rt !== 'free') { const [rw, rh] = rt.split(':').map(Number); const s = Math.max(Math.abs(w) / rw, Math.abs(h) / rh); w = Math.sign(w || 1) * s * rw; h = Math.sign(h || 1) * s * rh; }
      this.r = { x: Math.min(this.a.x, this.a.x + w), y: Math.min(this.a.y, this.a.y + h), w: Math.abs(w), h: Math.abs(h) };
    }
    MP.render();
  },
  up() { this.drag = null; if (this.r && (this.r.w < 2 || this.r.h < 2)) this.r = null; MP.render(); },
  dbl() { this.apply(); },
  apply() {
    const r = this.r; if (!r) { MP.toast('Tracez d\'abord un cadre'); return; }
    this.r = null; MP.cropDoc(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h));
  },
  onKey(e) { if (!this.r) return false; if (e.key === 'Enter') { this.apply(); return true; } if (e.key === 'Escape') { this.r = null; MP.render(); return true; } return false; },
  overlay(ctx) {
    const r = this.r; if (!r) return; const d = MP.doc;
    MP.overlayDocTransform(ctx);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.rect(-1e5, -1e5, 2e5, 2e5); ctx.rect(r.x, r.y, r.w, r.h); ctx.fill('evenodd');
    ctx.lineWidth = 1 / d.zoom; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath();
    for (let i = 1; i < 3; i++) { ctx.moveTo(r.x + (r.w * i) / 3, r.y); ctx.lineTo(r.x + (r.w * i) / 3, r.y + r.h); ctx.moveTo(r.x, r.y + (r.h * i) / 3); ctx.lineTo(r.x + r.w, r.y + (r.h * i) / 3); }
    ctx.stroke(); ctx.lineWidth = 2 / d.zoom; ctx.strokeStyle = '#fff'; ctx.strokeRect(r.x, r.y, r.w, r.h);
    MP.ui.setInfo(`${Math.round(r.w)} × ${Math.round(r.h)} px`);
  },
  cancel() { this.r = null; this.drag = null; },
});

MP.cropDoc = (x, y, w, h) => {
  const d = MP.doc; if (w < 1 || h < 1) return;
  d.history.record('Recadrer', 'all');
  for (const l of d.layers) {
    if (!l.isGroup && !l.adjust) { const c = MP.createCanvas(w, h); c.getContext('2d').drawImage(l.canvas, -x, -y); l.canvas = c; }
    if (l.mask) { const m = MP.createCanvas(w, h), mc = m.getContext('2d'); mc.fillStyle = '#fff'; mc.fillRect(0, 0, w, h); mc.clearRect(-x, -y, d.width, d.height); mc.drawImage(l.mask, -x, -y); l.mask = m; }
    if (l.text) { l.text.x -= x; l.text.y -= y; }
  }
  d.width = w; d.height = h; d.resizeBuffers(); MP.sel.none(d);
  MP.view.fit(); MP.ui.refreshAll(); MP.render();
};

/* ---------- Texte ---------- */
MP.FONTS = ['Arial', 'Segoe UI', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Georgia', 'Times New Roman', 'Cambria', 'Garamond', 'Courier New', 'Consolas', 'Impact', 'Comic Sans MS', 'Arial Black', 'Palatino Linotype', 'Franklin Gothic Medium', 'Lucida Console', 'Brush Script MT'];
MP.textFont = (t) => `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.size}px "${t.font}"`;
MP.renderText = (l) => {
  const t = l.text, c = l.ctx; c.clearRect(0, 0, l.canvas.width, l.canvas.height);
  c.save(); c.font = MP.textFont(t); c.textBaseline = 'top';
  try { c.letterSpacing = (t.spacing || 0) + 'px'; } catch (_) { /* ancien moteur */ }
  const lines = String(t.content).split('\n'), lh = t.size * (t.lineHeight || 1.2);
  const widths = lines.map((s) => c.measureText(s).width), W = Math.max(1, ...widths);
  if (t.shadow) { c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = t.size * 0.15; c.shadowOffsetX = c.shadowOffsetY = Math.max(1, t.size * 0.06); }
  const paintGlyph = (s, x, y) => { if (t.stroke && t.strokeWidth > 0) { c.lineJoin = 'round'; c.lineWidth = t.strokeWidth * 2; c.strokeStyle = t.strokeColor; c.strokeText(s, x, y); } c.fillStyle = t.color; c.fillText(s, x, y); };
  if (t.vertical) {
    // texte vertical : colonnes de droite à gauche, caractères empilés
    c.textAlign = 'center'; let maxH = 0;
    lines.forEach((s, i) => { const cx = t.x + (lines.length - 1 - i) * lh + t.size / 2; [...s].forEach((ch, k) => paintGlyph(ch, cx, t.y + k * t.size * 1.05)); maxH = Math.max(maxH, s.length * t.size * 1.05); });
    c.restore(); l._v = (l._v || 0) + 1; t._b = { x: t.x, y: t.y, w: lines.length * lh, h: maxH }; return;
  }
  if (t.arc) {
    // texte dynamique en arc / cercle (comme Photoshop 2026)
    const s = lines.join(' '), total = Math.max(1, c.measureText(s).width), th = Math.min(2 * Math.PI * 0.98, (Math.abs(t.arc) / 100) * (t.circle ? 2 * Math.PI * 0.98 : Math.PI)), R = Math.max(t.size * 0.8, total / Math.max(0.05, th)), up = t.arc > 0;
    const cx = t.x + R * Math.sin(Math.min(th / 2, Math.PI / 2)), cy = up ? t.y + R + t.size : t.y - R * Math.cos(Math.min(th / 2, Math.PI)) + t.size * 0.1;
    c.textAlign = 'center'; c.textBaseline = up ? 'alphabetic' : 'hanging';
    let acc = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ch of s) {
      const w = c.measureText(ch).width, psi = -th / 2 + (acc + w / 2) / R; acc += w;
      const px = cx + R * Math.sin(psi), py = up ? cy - R * Math.cos(psi) : cy + R * Math.cos(psi);
      c.save(); c.translate(px, py); c.rotate(up ? psi : -psi); paintGlyph(ch, 0, 0); c.restore();
      minX = Math.min(minX, px - t.size); maxX = Math.max(maxX, px + t.size); minY = Math.min(minY, py - t.size); maxY = Math.max(maxY, py + t.size);
    }
    c.restore(); l._v = (l._v || 0) + 1; t._b = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }; return;
  }
  lines.forEach((s, i) => {
    const x = t.x + (t.align === 'center' ? (W - widths[i]) / 2 : t.align === 'right' ? W - widths[i] : 0), y = t.y + i * lh;
    if (t.stroke && t.strokeWidth > 0) { c.lineJoin = 'round'; c.lineWidth = t.strokeWidth * 2; c.strokeStyle = t.strokeColor; c.strokeText(s, x, y); c.shadowColor = 'transparent'; }
    c.fillStyle = t.color; c.fillText(s, x, y);
    if (t.underline) { c.fillRect(x, y + t.size * 1.02, widths[i], Math.max(1, t.size / 15)); }
  });
  c.restore(); l._v = (l._v || 0) + 1;
  t._b = { x: t.x, y: t.y, w: W, h: lines.length * lh };
};
defTool({
  id: 'text', name: 'Texte', key: 'T', icon: 'text', cursor: 'text',
  defaults: { font: 'Arial', size: 72, bold: false, italic: false },
  options: [{ k: 'font', label: 'Police', type: 'select', options: MP.FONTS.map((f) => [f, f]) }, { k: 'size', label: 'Taille', type: 'number', min: 4, max: 2000 }, { k: 'bold', label: 'Gras', type: 'check' }, { k: 'italic', label: 'Italique', type: 'check' }],
  hint: 'Cliquez pour ajouter un texte, cliquez sur un texte existant pour le modifier',
  down(p) {
    const d = MP.doc;
    for (let i = d.layers.length - 1; i >= 0; i--) {
      const l = d.layers[i], b = l.text && l.text._b;
      if (l.visible && b && p.x >= b.x - 4 && p.y >= b.y - 4 && p.x <= b.x + b.w + 4 && p.y <= b.y + b.h + 4) { d.active = i; d.editMask = false; MP.ui.refreshLayers(); MP.ui.textDialog(l, false); return; }
    }
    const o = this.opts;
    d.history.record('Nouveau texte', null);
    const l = d.addLayer('Texte');
    l.text = { x: Math.round(p.x), y: Math.round(p.y), content: 'Votre texte', font: o.font, size: +o.size, bold: o.bold, italic: o.italic, underline: false, color: MP.colors.fg, align: 'left', lineHeight: 1.2, spacing: 0, stroke: false, strokeColor: '#ffffff', strokeWidth: 2, shadow: false };
    MP.renderText(l); MP.ui.refreshLayers(); MP.render();
    MP.ui.textDialog(l, true);
  },
});

/* ---------- Formes ---------- */
MP.drawShape = (c, s, a, b, o) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
  c.beginPath();
  if (s === 'rect') c.rect(x, y, w, h);
  else if (s === 'round') c.roundRect(x, y, w, h, Math.min(+o.radius, w / 2, h / 2));
  else if (s === 'ellipse') c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (s === 'line') { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
  else if (s === 'arrow') { const ang = Math.atan2(b.y - a.y, b.x - a.x), L = Math.max(10, +o.strokeWidth * 4); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.moveTo(b.x - L * Math.cos(ang - 0.45), b.y - L * Math.sin(ang - 0.45)); c.lineTo(b.x, b.y); c.lineTo(b.x - L * Math.cos(ang + 0.45), b.y - L * Math.sin(ang + 0.45)); }
  else if (s === 'triangle') { c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); }
  else if (s === 'polygon' || s === 'star') {
    const n = Math.max(3, +o.sides), cx = x + w / 2, cy = y + h / 2;
    const pts = s === 'star' ? n * 2 : n;
    for (let i = 0; i < pts; i++) { const ang = -Math.PI / 2 + (i * Math.PI * 2) / pts, k = s === 'star' && i % 2 ? 0.45 : 1; const px = cx + Math.cos(ang) * (w / 2) * k, py = cy + Math.sin(ang) * (h / 2) * k; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath();
  } else if (s === 'bubble') { const r = Math.min(w, h) * 0.18; c.roundRect(x, y, w, h * 0.75, r); c.moveTo(x + w * 0.22, y + h * 0.75); c.lineTo(x + w * 0.15, y + h); c.lineTo(x + w * 0.42, y + h * 0.75); }
  else if (s === 'check') { c.moveTo(x, y + h * 0.55); c.lineTo(x + w * 0.38, y + h); c.lineTo(x + w, y + h * 0.1); c.lineTo(x + w * 0.86, y); c.lineTo(x + w * 0.38, y + h * 0.72); c.lineTo(x + w * 0.14, y + h * 0.4); c.closePath(); }
  else if (s === 'cross') { const t = Math.min(w, h) * 0.18; c.moveTo(x + t, y); c.lineTo(x + w / 2, y + h / 2 - t); c.lineTo(x + w - t, y); c.lineTo(x + w, y + t); c.lineTo(x + w / 2 + t, y + h / 2); c.lineTo(x + w, y + h - t); c.lineTo(x + w - t, y + h); c.lineTo(x + w / 2, y + h / 2 + t); c.lineTo(x + t, y + h); c.lineTo(x, y + h - t); c.lineTo(x + w / 2 - t, y + h / 2); c.lineTo(x, y + t); c.closePath(); }
  else if (s === 'bolt') { [[0.55, 0], [0.1, 0.55], [0.45, 0.55], [0.3, 1], [0.9, 0.38], [0.55, 0.38], [0.75, 0]].forEach(([a, b], i) => (i ? c.lineTo(x + a * w, y + b * h) : c.moveTo(x + a * w, y + b * h))); c.closePath(); }
  else if (s === 'cloud') { c.moveTo(x + w * 0.2, y + h); c.arc(x + w * 0.2, y + h * 0.7, h * 0.3, Math.PI / 2, Math.PI * 1.5); c.arc(x + w * 0.42, y + h * 0.4, h * 0.35, Math.PI, Math.PI * 1.85); c.arc(x + w * 0.7, y + h * 0.45, h * 0.32, Math.PI * 1.15, Math.PI * 1.95); c.arc(x + w * 0.82, y + h * 0.72, h * 0.28, -Math.PI / 2, Math.PI / 2); c.closePath(); }
  else if (s === 'diamond') { c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h / 2); c.lineTo(x + w / 2, y + h); c.lineTo(x, y + h / 2); c.closePath(); }
  else if (s === 'arrowblock') { c.moveTo(x, y + h * 0.3); c.lineTo(x + w * 0.6, y + h * 0.3); c.lineTo(x + w * 0.6, y); c.lineTo(x + w, y + h / 2); c.lineTo(x + w * 0.6, y + h); c.lineTo(x + w * 0.6, y + h * 0.7); c.lineTo(x, y + h * 0.7); c.closePath(); }
  else if (s === 'moon') { c.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, Math.PI * 0.3, Math.PI * 1.7); c.arc(x + w * 0.72, y + h / 2, Math.min(w, h) * 0.42, Math.PI * 1.5, Math.PI * 0.5, true); c.closePath(); }
  else if (s === 'badge') { const n = 24, cx = x + w / 2, cy = y + h / 2; for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n, k = i % 2 ? 0.88 : 1, px = cx + Math.cos(a) * (w / 2) * k, py = cy + Math.sin(a) * (h / 2) * k; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
  else if (s === 'heart') {
    c.moveTo(x + w / 2, y + h * 0.3);
    c.bezierCurveTo(x + w / 2, y, x, y, x, y + h * 0.3); c.bezierCurveTo(x, y + h * 0.6, x + w / 2, y + h * 0.8, x + w / 2, y + h);
    c.bezierCurveTo(x + w / 2, y + h * 0.8, x + w, y + h * 0.6, x + w, y + h * 0.3); c.bezierCurveTo(x + w, y, x + w / 2, y, x + w / 2, y + h * 0.3);
  }
  const line = s === 'line' || s === 'arrow';
  if (o.fill && !line) { c.fillStyle = MP.colors.fg; c.fill(); }
  if ((o.stroke || line) && +o.strokeWidth > 0) { c.lineWidth = +o.strokeWidth; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = line && !o.stroke ? MP.colors.fg : o.strokeColor; c.stroke(); }
};
defTool({
  id: 'shape', name: 'Formes', key: 'U', icon: 'shape', cursor: 'crosshair',
  defaults: { shape: 'rect', fill: true, stroke: false, strokeColor: '#000000', strokeWidth: 4, radius: 24, sides: 5, newLayer: true },
  options: [
    { k: 'shape', label: 'Forme', type: 'select', options: [['rect', 'Rectangle'], ['round', 'Rectangle arrondi'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['polygon', 'Polygone'], ['star', 'Étoile'], ['heart', 'Cœur'], ['bubble', 'Bulle de dialogue'], ['check', 'Coche'], ['cross', 'Croix'], ['bolt', 'Éclair'], ['cloud', 'Nuage'], ['diamond', 'Losange'], ['arrowblock', 'Flèche pleine'], ['moon', 'Lune'], ['badge', 'Badge / sceau'], ['line', 'Ligne'], ['arrow', 'Flèche']] },
    { k: 'fill', label: 'Fond (couleur 1er plan)', type: 'check' }, { k: 'stroke', label: 'Contour', type: 'check' }, { k: 'strokeColor', label: '', type: 'color' },
    { k: 'strokeWidth', label: 'Épaisseur', type: 'number', min: 0, max: 500 }, { k: 'radius', label: 'Rayon', type: 'number', min: 0, max: 2000 }, { k: 'sides', label: 'Côtés', type: 'number', min: 3, max: 64 },
    { k: 'newLayer', label: 'Nouveau calque', type: 'check' },
  ],
  pts(e) {
    let b = this.b; const a = this.a;
    if (e && e.shiftKey) {
      if (this.opts.shape === 'line' || this.opts.shape === 'arrow') { const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(b.x - a.x, b.y - a.y); b = { x: a.x + Math.cos(ang) * l, y: a.y + Math.sin(ang) * l }; }
      else { const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); b = { x: a.x + Math.sign(b.x - a.x || 1) * s, y: a.y + Math.sign(b.y - a.y || 1) * s }; }
    }
    return [a, b];
  },
  down(p, e) { if (!this.opts.newLayer && !MP.canEdit()) return; this.a = p; this.b = p; this.on = true; this.e = e; },
  move(p, e) { if (!this.on) return; this.b = p; this.e = { shiftKey: e.shiftKey }; MP.render(); },
  up() {
    if (!this.on) return; this.on = false;
    const [a, b] = this.pts(this.e), d = MP.doc;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 2) { MP.render(); return; }
    let l;
    if (this.opts.newLayer) { d.history.record('Forme', null); l = d.addLayer('Forme ' + (d.layers.length)); }
    else { d.history.record('Forme', [d.layer.id]); l = d.layer; MP.rasterize(l); }
    const tmp = MP.createCanvas(d.width, d.height); MP.drawShape(tmp.getContext('2d'), this.opts.shape, a, b, this.opts);
    d.clipToSelection(tmp); l.ctx.drawImage(tmp, 0, 0);
    MP.afterEdit();
  },
  overlay(ctx) {
    if (!this.on) return; const [a, b] = this.pts(this.e);
    MP.overlayDocTransform(ctx); ctx.globalAlpha = 0.85; MP.drawShape(ctx, this.opts.shape, a, b, this.opts);
    ctx.globalAlpha = 1; MP.ui.setInfo(`${Math.round(Math.abs(b.x - a.x))} × ${Math.round(Math.abs(b.y - a.y))} px`);
  },
  cancel() { this.on = false; },
});

/* ---------- Main / Zoom ---------- */
defTool({
  id: 'hand', name: 'Main', key: 'H', icon: 'hand', cursor: 'grab', options: [{ k: 'fit', label: 'Adapter à l\'écran', type: 'button', action: () => MP.view.fit() }, { k: 'z100', label: '100 %', type: 'button', action: () => MP.view.setZoom(1, null, true) }],
  down(p) { this.s = { x: p.sx, y: p.sy, px: MP.doc.panX, py: MP.doc.panY }; },
  move(p) { if (!this.s) return; MP.doc.panX = this.s.px + p.sx - this.s.x; MP.doc.panY = this.s.py + p.sy - this.s.y; MP.renderView(); },
  up() { this.s = null; },
});
defTool({
  id: 'zoom', name: 'Zoom', key: 'Z', icon: 'zoom', cursor: 'zoom-in', hint: 'Clic : zoom avant — Alt + clic : zoom arrière',
  options: [{ k: 'fit', label: 'Adapter à l\'écran', type: 'button', action: () => MP.view.fit() }, { k: 'z100', label: '100 %', type: 'button', action: () => MP.view.setZoom(1, null, true) }],
  down(p, e) { MP.view.zoomStep(e.altKey ? -1 : 1, { x: p.sx, y: p.sy }); },
});

/* ---------- Transformation manuelle (Ctrl+T) ---------- */
defTool({
  id: 'transform', name: 'Transformation manuelle', icon: 'move', cursor: 'default', hidden: true,
  hint: 'Glissez les poignées pour redimensionner (Maj = proportions), à l\'extérieur pour pivoter. Entrée = valider',
  options: [
    { k: 'flipH', label: '⇋ Symétrie H', type: 'button', action: () => { MP.tools.transform.st.sx *= -1; MP.render(); } },
    { k: 'flipV', label: '⇵ Symétrie V', type: 'button', action: () => { MP.tools.transform.st.sy *= -1; MP.render(); } },
    { k: 'r90', label: '↻ 90°', type: 'button', action: () => { MP.tools.transform.st.angle += Math.PI / 2; MP.render(); } },
    { k: 'ok', label: '✔ Valider', type: 'button', action: () => MP.tools.transform.commit() },
    { k: 'no', label: '✖ Annuler', type: 'button', action: () => MP.tools.transform.abort() },
  ],
  start() {
    const d = MP.doc; if (!MP.canEditPixels()) return false;
    const l = d.layer; let b;
    if (d.selection) b = MP.sel.bounds(d); else b = MP.alphaBounds(l.canvas);
    if (!b) { MP.toast('Rien à transformer sur ce calque'); return false; }
    d.history.record('Transformation manuelle', [l.id]); MP.rasterize(l);
    const src = MP.createCanvas(b.w, b.h), sc = src.getContext('2d');
    if (d.selection) { const t = MP.cloneCanvas(l.canvas); d.clipToSelection(t); sc.drawImage(t, -b.x, -b.y); }
    else sc.drawImage(l.canvas, -b.x, -b.y);
    this.base = MP.cloneCanvas(l.canvas);
    if (d.selection) { const bc = this.base.getContext('2d'); bc.globalCompositeOperation = 'destination-out'; bc.drawImage(d.selection, 0, 0); }
    else this.base.getContext('2d').clearRect(0, 0, d.width, d.height);
    this.selSrc = null;
    if (d.selection) { this.selSrc = MP.createCanvas(b.w, b.h); this.selSrc.getContext('2d').drawImage(d.selection, -b.x, -b.y); }
    this.src = src; this.st = { bw: b.w, bh: b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2, sx: 1, sy: 1, angle: 0 };
    this.savedSel = d.selPath; d.selPath = null;
    const self = this;
    MP.live = { layer: l, target: 'layer', draw(ctx) { ctx.clearRect(0, 0, d.width, d.height); ctx.drawImage(self.base, 0, 0); self.paint(ctx); } };
    return true;
  },
  paint(ctx) {
    const s = this.st; ctx.save(); ctx.translate(s.cx, s.cy); ctx.rotate(s.angle); ctx.scale(s.sx, s.sy);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(this.src, -s.bw / 2, -s.bh / 2); ctx.restore();
  },
  toWorld(lx, ly) { const s = this.st, c = Math.cos(s.angle), n = Math.sin(s.angle); return { x: s.cx + lx * c - ly * n, y: s.cy + lx * n + ly * c }; },
  toLocal(p) { const s = this.st, c = Math.cos(-s.angle), n = Math.sin(-s.angle), dx = p.x - s.cx, dy = p.y - s.cy; return { x: dx * c - dy * n, y: dx * n + dy * c }; },
  handles() { const s = this.st, r = []; for (const uy of [-1, 0, 1]) for (const ux of [-1, 0, 1]) { if (!ux && !uy) continue; r.push({ ux, uy, p: this.toWorld((ux * s.bw * s.sx) / 2, (uy * s.bh * s.sy) / 2) }); } return r; },
  hit(p) {
    const z = MP.doc.zoom, tol = 7 / z;
    for (const h of this.handles()) if (Math.hypot(p.x - h.p.x, p.y - h.p.y) < tol) return { type: 'scale', h };
    const s = this.st, l = this.toLocal(p);
    if (Math.abs(l.x) <= Math.abs((s.bw * s.sx) / 2) && Math.abs(l.y) <= Math.abs((s.bh * s.sy) / 2)) return { type: 'move' };
    return { type: 'rotate' };
  },
  down(p) {
    const h = this.hit(p), s = this.st; this.drag = h; this.p0 = p; this.s0 = { ...s };
    if (h.type === 'scale') this.anchor = this.toWorld((-h.h.ux * s.bw * s.sx) / 2, (-h.h.uy * s.bh * s.sy) / 2);
    if (h.type === 'rotate') this.a0 = Math.atan2(p.y - s.cy, p.x - s.cx);
  },
  move(p, e) {
    const cv = MP.view.canvas;
    if (!this.drag) { const h = this.hit(p); cv.style.cursor = h.type === 'move' ? 'move' : h.type === 'scale' ? 'nwse-resize' : 'alias'; return; }
    const s = this.st, s0 = this.s0, h = this.drag;
    if (h.type === 'move') { s.cx = s0.cx + p.x - this.p0.x; s.cy = s0.cy + p.y - this.p0.y; }
    else if (h.type === 'rotate') { let a = s0.angle + Math.atan2(p.y - s0.cy, p.x - s0.cx) - this.a0; if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); s.angle = a; }
    else {
      const { ux, uy } = h.h, an = this.anchor, c = Math.cos(-s.angle), n = Math.sin(-s.angle);
      const dx = p.x - an.x, dy = p.y - an.y, lx = dx * c - dy * n, ly = dx * n + dy * c;
      let sx = ux ? (lx * ux) / s.bw : s0.sx, sy = uy ? (ly * uy) / s.bh : s0.sy;
      if (ux && uy && e.shiftKey) { const k = Math.max(Math.abs(sx / s0.sx), Math.abs(sy / s0.sy)); sx = Math.sign(sx || 1) * Math.abs(s0.sx) * k; sy = Math.sign(sy || 1) * Math.abs(s0.sy) * k; }
      if (Math.abs(sx) < 0.005) sx = 0.005 * Math.sign(sx || 1); if (Math.abs(sy) < 0.005) sy = 0.005 * Math.sign(sy || 1);
      s.sx = sx; s.sy = sy;
      const off = this.toWorldVec((ux * s.bw * sx) / 2, (uy * s.bh * sy) / 2);
      s.cx = an.x + off.x; s.cy = an.y + off.y;
    }
    MP.ui.setInfo(`L ${Math.round(Math.abs(s.sx) * 100)} %  H ${Math.round(Math.abs(s.sy) * 100)} %  ${Math.round((s.angle * 180) / Math.PI)}°`);
    MP.render();
  },
  toWorldVec(lx, ly) { const a = this.st.angle; return { x: lx * Math.cos(a) - ly * Math.sin(a), y: lx * Math.sin(a) + ly * Math.cos(a) }; },
  up() { this.drag = null; },
  dbl() { this.commit(); },
  onKey(e) { if (e.key === 'Enter') { this.commit(); return true; } if (e.key === 'Escape') { this.abort(); return true; } return false; },
  commit() {
    const d = MP.doc, l = d.layer, c = l.ctx;
    c.save(); MP.live.draw(c); c.restore();
    if (this.selSrc) { const m = MP.createCanvas(d.width, d.height), mc = m.getContext('2d'), st = this.st; mc.translate(st.cx, st.cy); mc.rotate(st.angle); mc.scale(st.sx, st.sy); mc.drawImage(this.selSrc, -st.bw / 2, -st.bh / 2); d.selection = m; MP.sel.normalize(d); }
    this.end();
  },
  abort() { MP.live = null; MP.doc.history.undo(); MP.doc.history.redoStack.pop(); MP.sel.updatePath(MP.doc); this.end(); },
  end() { MP.live = null; this.src = this.base = null; MP.view.canvas.style.cursor = ''; const prev = this.prev || 'move'; this.prev = null; MP.tool = null; MP.setTool(prev); MP.afterEdit(); },
  overlay(ctx) {
    if (!this.st || !this.src) return; const z = MP.doc.zoom;
    MP.overlayDocTransform(ctx); const s = this.st;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => this.toWorld((a * s.bw * s.sx) / 2, (b * s.bh * s.sy) / 2));
    ctx.lineWidth = 1 / z; ctx.strokeStyle = '#2d8cff'; ctx.beginPath(); corners.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.stroke();
    for (const h of this.handles()) { ctx.fillStyle = '#fff'; ctx.fillRect(h.p.x - 4 / z, h.p.y - 4 / z, 8 / z, 8 / z); ctx.strokeRect(h.p.x - 4 / z, h.p.y - 4 / z, 8 / z, 8 / z); }
    ctx.beginPath(); ctx.arc(s.cx, s.cy, 3 / z, 0, 7); ctx.stroke();
  },
  cancel() { if (this.src) { this.commit(); } },
});
MP.startTransform = () => {
  if (!MP.doc) return;
  const t = MP.tools.transform; if (MP.tool === t) return;
  const prev = MP.tool ? MP.tool.id : 'move';
  if (MP.tool && MP.tool.cancel) MP.tool.cancel();
  if (!t.start()) return;
  t.prev = prev; MP.tool = t; MP.ui.refreshTool(); MP.render();
};
