'use strict';
/* v3 — Commandes : échelle basée sur le contenu, déformation (grille), ciel, zone de mise au point, sélectionner et masquer,
   motifs, forme de pinceau, harmoniser, coloriser (IA), nettoyage des calques, duplication, presse-papiers, export ZIP, impression, Lanczos */
MP.cmd = {};

/* ---------- Échelle basée sur le contenu (seam carving) ---------- */
MP.cmd.contentScale = (newW, newH) => {
  const d = MP.doc; newW = Math.round(newW); newH = Math.round(newH);
  if (newW < 8 || newH < 8 || newW > d.width * 2 || newH > d.height * 2) { MP.toast('Taille hors limites (entre 8 px et 2 × la taille actuelle)'); return; }
  const targets = d.layers.filter((l) => !l.isGroup && !l.adjust);
  return MP.busy('Échelle basée sur le contenu… (calcul des coutures)', () => {
    d.history.record('Échelle basée sur le contenu', 'all');
    // travail sur des tableaux de pixels pour tous les calques en parallèle
    let W = d.width, H = d.height;
    let planes = targets.map((l) => ({ l, data: l.canvas.getContext('2d').getImageData(0, 0, W, H).data, mask: l.mask ? l.mask.getContext('2d').getImageData(0, 0, W, H).data : null }));
    let comp = d.composite(null, { noLive: true }).getContext('2d').getImageData(0, 0, W, H).data;
    const carve = (dw) => {
      // dw < 0 : retirer |dw| coutures verticales ; dw > 0 : en dupliquer dw
      const n = Math.abs(dw); if (!n) return;
      let gray = new Float32Array(W * H); for (let p = 0; p < W * H; p++) gray[p] = comp[p * 4] * 0.299 + comp[p * 4 + 1] * 0.587 + comp[p * 4 + 2] * 0.114;
      let idx = new Int32Array(W * H); for (let p = 0; p < W * H; p++) idx[p] = p % W; // colonne d'origine
      let cw = W; const seams = [];
      const M = new Float32Array(W * H), back = new Int8Array(W * H);
      for (let s = 0; s < n; s++) {
        const E = (x, y) => { const i = y * cw + x, l = gray[y * cw + Math.max(0, x - 1)], r = gray[y * cw + Math.min(cw - 1, x + 1)], u = gray[Math.max(0, y - 1) * cw + x], dn = gray[Math.min(H - 1, y + 1) * cw + x]; void i; return Math.abs(r - l) + Math.abs(dn - u); };
        for (let x = 0; x < cw; x++) M[x] = E(x, 0);
        for (let y = 1; y < H; y++) for (let x = 0; x < cw; x++) {
          const o = (y - 1) * cw; let best = M[o + x], b = 0;
          if (x > 0 && M[o + x - 1] < best) { best = M[o + x - 1]; b = -1; }
          if (x < cw - 1 && M[o + x + 1] < best) { best = M[o + x + 1]; b = 1; }
          M[y * cw + x] = best + E(x, y); back[y * cw + x] = b;
        }
        let x = 0, mn = Infinity; for (let i = 0; i < cw; i++) if (M[(H - 1) * cw + i] < mn) { mn = M[(H - 1) * cw + i]; x = i; }
        const seam = new Int32Array(H); for (let y = H - 1; y >= 0; y--) { seam[y] = x; x += back[y * cw + x]; }
        // retirer la couture des tableaux de travail
        const ng = new Float32Array((cw - 1) * H), ni = new Int32Array((cw - 1) * H);
        const orig = new Int32Array(H);
        for (let y = 0; y < H; y++) { const sx = seam[y]; orig[y] = idx[y * cw + sx]; let k = y * (cw - 1); for (let xx = 0; xx < cw; xx++) { if (xx === sx) continue; ng[k] = gray[y * cw + xx]; ni[k] = idx[y * cw + xx]; k++; } }
        gray = ng; idx = ni; cw--; seams.push(orig);
      }
      // appliquer aux calques (colonnes d'origine retirées ou dupliquées)
      const NW = W + dw;
      const remap = (src, chan) => {
        const out = new Uint8ClampedArray(NW * H * 4);
        for (let y = 0; y < H; y++) {
          const marks = new Uint8Array(W); for (const sm of seams) marks[sm[y]]++;
          let k = 0;
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (dw < 0) { if (marks[x]) continue; out.set(src.subarray(i, i + 4), (y * NW + k) * 4); k++; }
            else { for (let r = 0; r <= marks[x]; r++) { if (k >= NW) break; out.set(src.subarray(i, i + 4), (y * NW + k) * 4); k++; } }
          }
        }
        void chan; return out;
      };
      planes = planes.map((p) => ({ l: p.l, data: remap(p.data), mask: p.mask ? remap(p.mask) : null }));
      comp = remap(comp); W = NW;
    };
    const transpose = (a, w, h) => { const o = new Uint8ClampedArray(a.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, j = (x * h + y) * 4; o[j] = a[i]; o[j + 1] = a[i + 1]; o[j + 2] = a[i + 2]; o[j + 3] = a[i + 3]; } return o; };
    carve(newW - W);
    if (newH !== H) {
      planes = planes.map((p) => ({ l: p.l, data: transpose(p.data, W, H), mask: p.mask ? transpose(p.mask, W, H) : null })); comp = transpose(comp, W, H);
      [W, H] = [H, W]; carve(newH - W); [W, H] = [H, W];
      planes = planes.map((p) => ({ l: p.l, data: transpose(p.data, H, W), mask: p.mask ? transpose(p.mask, H, W) : null }));
    }
    const toCanvas = (data) => { const c = MP.createCanvas(W, H); c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0); return c; };
    for (const p of planes) { p.l.canvas = toCanvas(p.data); if (p.mask) p.l.mask = toCanvas(p.mask); p.l.text = null; }
    for (const l of d.layers) if ((l.isGroup || l.adjust) && l.mask) { const m = MP.createCanvas(W, H); m.getContext('2d').drawImage(l.mask, 0, 0, W, H); l.mask = m; }
    d.width = W; d.height = H; d.resizeBuffers(); MP.sel.none(d); MP.view.fit(); MP.ui.refreshAll(); MP.afterEdit();
  });
};

/* ---------- Déformation (grille 4 × 4) dans la transformation manuelle ---------- */
{
  const T = MP.tools.transform;
  T.options.splice(4, 0, { k: 'warp', label: '⌗ Déformation', title: 'Grille de déformation 4 × 4', type: 'button', action: () => T.toggleWarp() });
  T.toggleWarp = function () {
    if (!this.src) return;
    if (this.grid) { this.grid = null; MP.render(); return; }
    this.quad = null;
    const s = this.st, N = 3; this.grid = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) this.grid.push(this.toWorld(((i / N - 0.5) * s.bw * s.sx), ((j / N - 0.5) * s.bh * s.sy)));
    const cw = this.src.width / N, ch = this.src.height / N; this.cells = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = MP.createCanvas(Math.ceil(cw) + 1, Math.ceil(ch) + 1); c.getContext('2d').drawImage(this.src, -i * cw, -j * ch); this.cells.push({ c, i, j }); }
    MP.toast('Déformation : glissez les points de la grille'); MP.render();
  };
  const paint0 = T.paint, down0 = T.down, move0 = T.move, overlay0 = T.overlay, start0 = T.start;
  T.start = function () { this.grid = null; return start0.call(this); };
  T.paint = function (ctx) {
    if (!this.grid) return paint0.call(this, ctx);
    const g = this.grid, N = 3; ctx.save(); ctx.imageSmoothingQuality = 'high';
    for (const { c, i, j } of this.cells) { const P = (a, b) => g[(j + b) * (N + 1) + i + a]; MP.drawQuad(ctx, c, [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], 6); }
    ctx.restore();
  };
  T.down = function (p) {
    if (!this.grid) return down0.call(this, p);
    const tol = 9 / MP.doc.zoom, i = this.grid.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < tol);
    this.drag = i >= 0 ? { type: 'gpt', i } : { type: 'gmove', p0: p, g0: this.grid.map((q) => ({ ...q })) };
  };
  T.move = function (p, e) {
    if (!this.grid) return move0.call(this, p, e);
    if (!this.drag) return;
    if (this.drag.type === 'gpt') this.grid[this.drag.i] = { x: p.x, y: p.y };
    else { const dx = p.x - this.drag.p0.x, dy = p.y - this.drag.p0.y; this.grid = this.drag.g0.map((q) => ({ x: q.x + dx, y: q.y + dy })); }
    MP.render();
  };
  T.overlay = function (ctx) {
    if (!this.grid) return overlay0.call(this, ctx);
    const z = MP.doc.zoom, g = this.grid, N = 3; MP.overlayDocTransform(ctx); ctx.lineWidth = 1 / z; ctx.strokeStyle = '#2d8cff'; ctx.beginPath();
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const q = g[j * (N + 1) + i]; if (i < N) { const r = g[j * (N + 1) + i + 1]; ctx.moveTo(q.x, q.y); ctx.lineTo(r.x, r.y); } if (j < N) { const b = g[(j + 1) * (N + 1) + i]; ctx.moveTo(q.x, q.y); ctx.lineTo(b.x, b.y); } }
    ctx.stroke(); for (const q of g) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 4 / z, 0, 7); ctx.fill(); ctx.stroke(); }
  };
  const commit0 = T.commit;
  T.commit = function () { if (this.grid) this.selSrc = null; commit0.call(this); this.grid = null; };
}

/* ---------- Ciel : sélection et remplacement ---------- */
MP.sky = {
  mask(d) {
    const W = d.width, H = d.height, src = MP.blurCanvas(MP.cloneCanvas(d.composite(null, { noLive: true })), Math.max(1, Math.min(W, H) / 400));
    const data = src.getContext('2d').getImageData(0, 0, W, H).data, m = MP.createCanvas(W, H), mc = m.getContext('2d');
    for (let k = 0; k < 12; k++) {
      const x = Math.round(((k + 0.5) / 12) * (W - 1)), y = 2, i = (y * W + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], l = r * 0.3 + g * 0.59 + b * 0.11;
      if (l < 70 && b < r) continue; // ce point du bord haut ne ressemble pas à du ciel
      if (mc.getImageData(x, y, 1, 1).data[3] > 0) continue;
      const f = MP.floodMask(src, x, y, 14, true); if (f) mc.drawImage(f, 0, 0);
    }
    const b = MP.sel.blurred(m, Math.max(2, Math.min(W, H) / 250));
    return MP.alphaBounds(b, 40) ? b : null;
  },
  select() { const d = MP.doc; return MP.busy('Recherche du ciel…', () => { const k = this.mask(d); if (!k) { MP.toast('Aucun ciel détecté en haut de l\'image'); return; } d.history.record('Sélectionner le ciel', null); MP.sel.fromMask(d, k); MP.ui.refreshAll(); MP.render(); }); },
  PRESETS: { bleu: ['#1f5fc8', '#7fb6ef', '#e3f2ff', true], coucher: ['#2b1b5a', '#c4557a', '#ffb46b', true], dore: ['#4a6fb5', '#f4c27a', '#ffe6b8', true], orage: ['#1f262f', '#4d5866', '#8e99a6', true], nuit: ['#03050f', '#0d1640', '#27407a', false], rose: ['#5468ff', '#c58bff', '#ffc2d6', true] },
  render(W, H, key) {
    const [a, b, c, clouds] = this.PRESETS[key] || this.PRESETS.bleu, cv = MP.createCanvas(W, H), x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, c); x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (clouds) { const n = MP.FILTERS.clouds.render(cv, { s: Math.max(W, H) / 3, seed: Math.floor(Math.random() * 900) }); const t = MP.createCanvas(W, H), tc = t.getContext('2d'); tc.drawImage(n, 0, 0); tc.globalCompositeOperation = 'destination-in'; const gm = tc.createLinearGradient(0, 0, 0, H); gm.addColorStop(0, 'rgba(0,0,0,.55)'); gm.addColorStop(1, 'rgba(0,0,0,.1)'); tc.fillStyle = gm; tc.fillRect(0, 0, W, H); x.globalCompositeOperation = key === 'orage' ? 'multiply' : 'screen'; x.drawImage(t, 0, 0); }
    else { x.fillStyle = '#fff'; for (let i = 0; i < (W * H) / 2500; i++) { x.globalAlpha = Math.random(); const r = Math.random() * 1.4; x.beginPath(); x.arc(Math.random() * W, Math.random() * H * 0.8, r, 0, 7); x.fill(); } x.globalAlpha = 1; }
    return cv;
  },
  replace(key, harmon) {
    const d = MP.doc;
    return MP.busy('Remplacement du ciel…', () => {
      const m = this.mask(d); if (!m) { MP.toast('Aucun ciel détecté en haut de l\'image'); return; }
      d.history.record('Remplacement du ciel', null);
      // le ciel est placé juste au-dessus du calque photo actif (les textes et logos restent au-dessus)
      const l = d.addLayer('Ciel (' + key + ')'); l.canvas = this.render(d.width, d.height, key); l.mask = m;
      if (harmon > 0) {
        const [, mid] = this.PRESETS[key] || this.PRESETS.bleu; const a = d.addLayer('Harmonisation du ciel'); a.canvas = MP.createCanvas(1, 1);
        a.adjust = { key: 'photoFilter', values: { c: mid, k: harmon, keep: true } };
        const inv = MP.createCanvas(d.width, d.height), ic = inv.getContext('2d'); ic.fillStyle = '#fff'; ic.fillRect(0, 0, d.width, d.height); ic.globalCompositeOperation = 'destination-out'; ic.drawImage(m, 0, 0); a.mask = inv;
      }
      d.normalize(); d.editMask = false; MP.afterEdit(); MP.ui.refreshAll();
    });
  },
};

/* ---------- Sélection > Zone de mise au point ---------- */
MP.cmd.focusArea = (level) => {
  const d = MP.doc;
  return MP.busy('Analyse de la netteté…', () => {
    const W = d.width, H = d.height, s = d.composite(null, { noLive: true }).getContext('2d').getImageData(0, 0, W, H).data, g = MP.grayOf(s, W * H);
    const lap = MP.createCanvas(W, H), lc = lap.getContext('2d'), id = lc.createImageData(W, H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const p = y * W + x, v = Math.min(255, Math.abs(4 * g[p] - g[p - 1] - g[p + 1] - g[p - W] - g[p + W]) * 3); id.data[p * 4] = id.data[p * 4 + 1] = id.data[p * 4 + 2] = 255; id.data[p * 4 + 3] = v; }
    lc.putImageData(id, 0, 0);
    const b = MP.sel.blurred(lap, Math.max(4, Math.min(W, H) / 40)), bc = b.getContext('2d'), bd = bc.getImageData(0, 0, W, H), A = bd.data;
    const hist = new Uint32Array(256); for (let i = 3; i < A.length; i += 4) hist[A[i]]++;
    let acc = 0, th = 255; const target = (W * H * level) / 100; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= target) { th = v; break; } }
    for (let i = 3; i < A.length; i += 4) { A[i - 3] = A[i - 2] = A[i - 1] = 255; A[i] = A[i] >= th ? 255 : 0; }
    bc.putImageData(bd, 0, 0);
    d.history.record('Zone de mise au point', null); MP.sel.fromMask(d, MP.sel.blurred(b, 3)); MP.ui.refreshAll(); MP.render();
  });
};

/* ---------- Sélectionner et masquer (affiner la sélection) ---------- */
MP.cmd.refine = (mask, v) => {
  const W = mask.width, H = mask.height;
  let m = mask;
  if (v.smooth > 0) { const b = MP.sel.blurred(m, v.smooth), c = b.getContext('2d'), id = c.getImageData(0, 0, W, H); for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] >= 128 ? 255 : 0; c.putImageData(id, 0, 0); m = b; }
  if (v.shift) { const r = Math.abs(v.shift) / 10 + 0.5, b = MP.sel.blurred(m, r), c = b.getContext('2d'), id = c.getImageData(0, 0, W, H), th = v.shift > 0 ? 40 : 215; for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > th ? 255 : 0; c.putImageData(id, 0, 0); m = b; }
  if (v.feather > 0) m = MP.sel.blurred(m, v.feather);
  if (v.contrast > 0) { const c2 = MP.cloneCanvas(m), c = c2.getContext('2d'), id = c.getImageData(0, 0, W, H), k = 1 + v.contrast / 12; for (let i = 3; i < id.data.length; i += 4) { id.data[i - 3] = id.data[i - 2] = id.data[i - 1] = 255; id.data[i] = MP.clamp((id.data[i] - 128) * k + 128, 0, 255); } c.putImageData(id, 0, 0); m = c2; }
  return m;
};
MP.cmd.selectAndMask = () => {
  const d = MP.doc; if (!d.selection) { MP.toast('Faites d\'abord une sélection'); return; }
  const orig = MP.cloneCanvas(d.selection), saved = { qm: d.quickMask, q: d.qmask };
  d.quickMask = true; d.qmask = orig; d.selPath = null; MP.render();
  MP.ui.dialog({
    title: 'Sélectionner et masquer', preview: true,
    fields: [{ type: 'info', html: 'Le rouge montre les zones exclues. Ajustez puis validez.' }, { k: 'smooth', label: 'Lisser', type: 'range', min: 0, max: 30, unit: 'px' }, { k: 'feather', label: 'Contour progressif', type: 'range', min: 0, max: 100, step: 0.5, unit: 'px' }, { k: 'contrast', label: 'Contraste', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'shift', label: 'Décaler le contour', type: 'range', min: -100, max: 100, unit: '%' }, { k: 'out', label: 'Sortie', type: 'select', options: [['sel', 'Sélection'], ['mask', 'Masque de fusion'], ['layer', 'Nouveau calque avec masque']] }],
    values: { smooth: 0, feather: 0, contrast: 0, shift: 0, out: 'sel' },
    onChange: (v) => { d.qmask = MP.cmd.refine(orig, v); MP.render(); },
    onOk: (v) => {
      const m = MP.cmd.refine(orig, v); d.quickMask = saved.qm; d.qmask = saved.q;
      if (v.out === 'sel') { d.history.record('Sélectionner et masquer', null); d.selection = m; MP.sel.normalize(d); }
      else if (v.out === 'mask') { if (d.layer.mask) MP.layerOps.deleteMask(); d.selection = m; MP.layerOps.addMask(true); }
      else { const src = MP.layerOps.bake(d.layer); d.history.record('Sélectionner et masquer', null); const l = d.addLayer(d.layer.name + ' (détouré)'); l.canvas = src; l.mask = m; MP.sel.none(d); }
      MP.afterEdit(); MP.ui.refreshAll();
    },
    onCancel: () => { d.quickMask = saved.qm; d.qmask = saved.q; MP.sel.updatePath(d); MP.render(); },
  });
};

/* ---------- Motifs et formes de pinceau ---------- */
MP.cmd.definePattern = () => {
  const d = MP.doc, b = MP.sel.bounds(d) || { x: 0, y: 0, w: d.width, h: d.height };
  if (b.w * b.h > 4e6) { MP.toast('Zone trop grande pour un motif (2000 × 2000 max)'); return; }
  const c = MP.createCanvas(b.w, b.h); c.getContext('2d').drawImage(d.composite(null, { noLive: true }), -b.x, -b.y); MP.pattern = c;
  MP.toast(`Motif défini (${b.w} × ${b.h} px) — Édition > Remplir > Motif, ou outil Tampon de motif`);
};
MP.cmd.defineBrush = () => {
  const d = MP.doc, b = MP.sel.bounds(d); if (!b) { MP.toast('Sélectionnez la zone qui servira de forme (sur fond clair)'); return; }
  const k = Math.min(1, 500 / Math.max(b.w, b.h)), w = Math.max(1, Math.round(b.w * k)), h = Math.max(1, Math.round(b.h * k));
  const c = MP.createCanvas(w, h), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(d.composite(null, { noLive: true }), b.x, b.y, b.w, b.h, 0, 0, w, h);
  const id = x.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { const v = 255 - (id.data[i] * 0.299 + id.data[i + 1] * 0.587 + id.data[i + 2] * 0.114); id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = v; }
  x.putImageData(id, 0, 0); MP.customBrush = c; MP.customBrushId = (MP.customBrushId || 0) + 1;
  for (const t of ['brush', 'eraser']) { MP.tools[t].opts.shape = 'custom'; }
  MP.setTool('brush'); MP.toast('Forme de pinceau définie et sélectionnée');
};

/* ---------- Harmoniser (transfert de couleurs Lab, façon « Correspondance de la couleur ») ---------- */
const toLab = (r, g, b) => {
  const f = (c) => { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
  const R = f(r), G = f(g), B = f(b), X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116), fx = h(X), fy = h(Y), fz = h(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const fromLab = (L, a, b) => {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, h = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = h(fx) * 0.95047, Y = h(fy), Z = h(fz) * 1.08883;
  const g = (c) => (c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c) * 255;
  return [g(X * 3.2406 + Y * -1.5372 + Z * -0.4986), g(X * -0.9689 + Y * 1.8758 + Z * 0.0415), g(X * 0.0557 + Y * -0.204 + Z * 1.057)];
};
const labStats = (data, step = 4) => {
  const s = [0, 0, 0], q = [0, 0, 0]; let n = 0;
  for (let i = 0; i < data.length; i += 4 * step) { if (data[i + 3] < 128) continue; const L = toLab(data[i], data[i + 1], data[i + 2]); for (let c = 0; c < 3; c++) { s[c] += L[c]; q[c] += L[c] * L[c]; } n++; }
  if (!n) return null; return s.map((v, c) => ({ m: v / n, sd: Math.sqrt(Math.max(1e-6, q[c] / n - (v / n) ** 2)) }));
};
MP.cmd.harmonize = () => {
  const d = MP.doc, l = d.layer; if (!MP.canEditPixels()) return;
  const vis = l.visible; l.visible = false; const ref = MP.cloneCanvas(d.composite(null, { noLive: true })); l.visible = vis; d.rev++;
  const W = d.width, H = d.height, R = labStats(ref.getContext('2d').getImageData(0, 0, W, H).data, 7), src = l.canvas.getContext('2d').getImageData(0, 0, W, H).data, S = labStats(src, 3);
  if (!R || !S) { MP.toast('Il faut un calque au-dessus d\'une image'); return; }
  const orig = l.canvas;
  MP.ui.dialog({
    title: 'Harmoniser avec l\'arrière-plan', preview: true,
    fields: [{ type: 'info', html: 'Adapte la lumière et les couleurs du calque actif à celles de l\'image située en dessous (montages, détourages).' }, { k: 'lum', label: 'Luminance', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'col', label: 'Intensité des couleurs', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'fade', label: 'Atténuation', type: 'range', min: 0, max: 100, unit: '%' }],
    values: { lum: 60, col: 80, fade: 0 },
    onChange: (v) => {
      const o = MP.createCanvas(W, H), oc = o.getContext('2d'), id = oc.createImageData(W, H), D = id.data, k = [v.lum / 100, v.col / 100, v.col / 100], f = 1 - v.fade / 100;
      for (let i = 0; i < src.length; i += 4) {
        D[i + 3] = src[i + 3]; if (!src[i + 3]) continue;
        const L = toLab(src[i], src[i + 1], src[i + 2]), M = L.map((x, c) => { const t = ((x - S[c].m) / S[c].sd) * R[c].sd + R[c].m; return MP.lerp(x, t, k[c] * f); });
        const rgb = fromLab(M[0], M[1], M[2]); D[i] = rgb[0]; D[i + 1] = rgb[1]; D[i + 2] = rgb[2];
      }
      oc.putImageData(id, 0, 0); l._preview = MP.maskedResult(orig, o); MP.render();
    },
    initialPreview: true,
    onOk: () => { const res = l._preview; l._preview = null; if (!res) return; d.history.record('Harmoniser', [l.id]); MP.rasterize(l); l.canvas = res; MP.afterEdit(); },
    onCancel: () => { l._preview = null; MP.render(); },
  });
};

/* ---------- IA : coloriser, objet dans un rectangle ---------- */
MP.ai.colorize = function () {
  const d = MP.doc; if (!d) return;
  return this.run('Colorisation', async () => {
    const src = MP.cloneCanvas(d.composite(null, { noLive: true }));
    const out = await this.edit(src, null, 'Colorize this black and white photo with natural, realistic and historically plausible colors. Keep every detail, face and composition exactly identical.');
    d.history.record('Coloriser (IA)', null); d.active = d.layers.length - 1;
    const l = d.addLayer('Colorisation IA'); l.parent = null; l.blend = 'color'; l.ctx.imageSmoothingQuality = 'high'; l.ctx.drawImage(out, 0, 0, d.width, d.height);
    d.normalize(); MP.afterEdit(); MP.ui.refreshAll(); MP.toast('Couleurs ajoutées sur un calque en mode Couleur (ajustez son opacité)');
  });
};
MP.ai.objectInRect = function (r, mode = 'new') {
  const d = MP.doc;
  return this.run('Sélection d\'objet', async () => {
    const crop = MP.createCanvas(r.w, r.h); crop.getContext('2d').drawImage(d.composite(null, { noLive: true }), -r.x, -r.y);
    const out = await this.edit(crop, null, 'Keep only the main object exactly identical (same position, size and shape). Remove everything else, transparent background.', { background: 'transparent' });
    const m = MP.createCanvas(d.width, d.height), mc = m.getContext('2d'); mc.drawImage(out, r.x, r.y, r.w, r.h); mc.globalCompositeOperation = 'source-in'; mc.fillStyle = '#fff'; mc.fillRect(0, 0, d.width, d.height);
    d.history.record('Sélection d\'objet (IA)', null); MP.sel.apply(d, mode, (c) => c.drawImage(m, 0, 0)); MP.ui.refreshAll(); MP.render();
  });
};

/* ---------- Divers ---------- */
MP.cmd.cleanupLayers = () => {
  const d = MP.doc, empty = d.layers.filter((l) => !l.isGroup && !l.adjust && !l.text && !MP.fx.has(l) && !MP.alphaBounds(l.canvas, 0));
  let gone = new Set(empty);
  for (const g of d.layers.filter((l) => l.isGroup)) if (d.descendants(g).every((c) => gone.has(c) || c.isGroup)) gone.add(g);
  if (gone.size >= d.layers.length) gone = new Set([...gone].slice(0, d.layers.length - 1));
  if (!gone.size) { MP.toast('Aucun calque vide'); return; }
  d.history.record('Nettoyer les calques', null); d.layers = d.layers.filter((l) => !gone.has(l)); d.normalize(); d.active = MP.clamp(d.active, 0, d.layers.length - 1); MP.afterEdit(); MP.ui.refreshAll();
  MP.toast(`${gone.size} calque(s) vide(s) supprimé(s)`);
};
MP.cmd.duplicateImage = async () => { const d = MP.doc; await MP.io.openProject({ name: d.name.replace(/\.[^.]+$/, '') + ' copie', path: null, data: new TextEncoder().encode(MP.io.serialize(d)) }); MP.doc.filePath = null; MP.doc.dirty = true; MP.ui.refreshTabs(); };
MP.cmd.newFromClipboard = async () => {
  let c = null;
  if (MP.edit.clip) c = MP.edit.clip.canvas;
  else if (MP.native.readClipboardImage) { const data = await MP.native.readClipboardImage(); if (data) c = await MP.io.loadImage(data, 'p.png'); }
  else { try { for (const it of await navigator.clipboard.read()) { const t = it.types.find((x) => x.startsWith('image/')); if (t) { c = await MP.io.loadImage(new Uint8Array(await (await it.getType(t)).arrayBuffer()), 'p.png'); break; } } } catch (_) { /* refusé */ } }
  if (!c) { MP.toast('Aucune image dans le presse-papiers'); return; }
  const d = new MP.Doc(c.width, c.height, 'Presse-papiers'); const l = d.addLayer('Calque 1', 0); l.canvas = MP.cloneCanvas(c); MP.addDoc(d);
};
/* ZIP minimal (sans compression) */
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (a) => { let c = 0xffffffff; for (let i = 0; i < a.length; i++) c = crcTable[(c ^ a[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
MP.zip = (files) => {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const u16 = (v) => [v & 255, (v >> 8) & 255], u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0)]);
    parts.push(lh, name, f.data);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += lh.length + name.length + sz;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((s, a) => s + a.length, 0)); let p = 0; for (const a of all) { out.set(a, p); p += a.length; } return out;
};
MP.cmd.exportLayers = async (onlyVisible) => {
  const d = MP.doc, files = [], used = new Set();
  await MP.busy('Export des calques…', async () => {
    for (const [i, l] of d.layers.entries()) {
      if (l.isGroup || l.adjust || (onlyVisible && (!l.visible || d.isHiddenByParent(l)))) continue;
      const c = MP.layerOps.bake(l), blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      let n = `${String(i + 1).padStart(2, '0')} - ${l.name.replace(/[\\/:*?"<>|]/g, '_')}.png`; while (used.has(n)) n = n.replace('.png', '_.png'); used.add(n);
      files.push({ name: n, data: new Uint8Array(await blob.arrayBuffer()) });
    }
  });
  if (!files.length) { MP.toast('Aucun calque à exporter'); return; }
  const zip = MP.zip(files), base = d.name.replace(/\.[^.]+$/, '');
  const path = await MP.native.saveFile({ defaultPath: base + ' - calques.zip', filters: [{ name: 'Archive ZIP', extensions: ['zip'] }], data: zip });
  if (path) MP.toast(`${files.length} calque(s) exporté(s) en PNG dans le ZIP`);
};
MP.cmd.print = () => {
  const d = MP.doc, url = d.composite(null, { noLive: true }).toDataURL('image/png');
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-10px';
  document.body.appendChild(f);
  const doc = f.contentDocument; doc.open(); doc.write(`<!DOCTYPE html><html><head><title>${d.name}</title><style>@page{margin:10mm}html,body{margin:0;height:100%}img{max-width:100%;max-height:100%;display:block;margin:auto}</style></head><body><img src="${url}"></body></html>`); doc.close();
  const img = doc.querySelector('img'); const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); };
  if (img.complete) setTimeout(go, 50); else img.onload = go;
};

/* ---------- Rééchantillonnage Lanczos (« Conserver les détails ») ---------- */
MP.lanczos = (src, W, H) => {
  const sw = src.width, sh = src.height, s = src.getContext('2d').getImageData(0, 0, sw, sh).data, A = 3;
  const L = (x) => (x === 0 ? 1 : Math.abs(x) >= A ? 0 : (A * Math.sin(Math.PI * x) * Math.sin((Math.PI * x) / A)) / (Math.PI * Math.PI * x * x));
  const pass = (inp, iw, ih, ow, horiz) => {
    const oh = horiz ? ih : ow, owidth = horiz ? ow : iw, out = new Float32Array(owidth * oh * 4), n = horiz ? iw : ih, m = horiz ? ow : ow, scale = n / m, sup = Math.max(1, scale) * A;
    for (let o = 0; o < m; o++) {
      const c = (o + 0.5) * scale - 0.5, lo = Math.max(0, Math.floor(c - sup)), hi = Math.min(n - 1, Math.ceil(c + sup)), ws = []; let wsum = 0;
      for (let k = lo; k <= hi; k++) { const w = L((k - c) / Math.max(1, scale)); ws.push(w); wsum += w; }
      const lines = horiz ? ih : iw;
      for (let t = 0; t < lines; t++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = lo; k <= hi; k++) { const w = ws[k - lo], i = horiz ? (t * iw + k) * 4 : (k * iw + t) * 4, al = inp[i + 3]; r += inp[i] * al * w; g += inp[i + 1] * al * w; b += inp[i + 2] * al * w; a += al * w; }
        const j = horiz ? (t * ow + o) * 4 : (o * iw + t) * 4, aa = a / wsum;
        out[j] = a ? r / a : 0; out[j + 1] = a ? g / a : 0; out[j + 2] = a ? b / a : 0; out[j + 3] = aa;
      }
    }
    return out;
  };
  const h1 = pass(s, sw, sh, W, true), v = pass(h1, W, sh, H, false);
  const o = MP.createCanvas(W, H), id = o.getContext('2d').createImageData(W, H); for (let i = 0; i < v.length; i++) id.data[i] = v[i]; o.getContext('2d').putImageData(id, 0, 0); return o;
};
