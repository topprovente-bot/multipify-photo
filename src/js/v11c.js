'use strict';
/* v11 (3/3) — Outils supplémentaires :
   - Flou d'objectif (bokeh réaliste, reflets, profondeur d'après la sélection ou un dégradé)
   - Recadrage intelligent (zone importante détectée) et export multi-formats pour les réseaux sociaux
   - Palette de couleurs extraite de l'image (k-moyennes) → nuancier / calque
   - Générateur de QR code (versions 1 à 40, correction L/M/Q/H) */

/* =================== Flou d'objectif =================== */
MP.lensDepth = (W, H, v) => {
  const dep = new Float32Array(W * H), rg = Math.max(0.02, (v.range || 30) / 100), d = MP.doc;
  const sel = v.mode === 'sel' && d && d.selection && d.selection.width === W && d.selection.height === H ? d.selection : null;
  if (sel) {
    const f = Math.max(2, Math.round(Math.min(W, H) * rg * 0.25)), b = MP.blurCanvas(sel, f).getContext('2d').getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) dep[i] = 1 - b[i * 4 + 3] / 255; return dep;
  }
  const fy = (v.fy ?? 50) / 100, fx = (v.fx ?? 50) / 100;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t; const ny = y / H, nx = x / W;
    if (v.mode === 'bottom') t = Math.max(0, (1 - ny) - rg) / (1 - rg + 1e-6);
    else if (v.mode === 'top') t = Math.max(0, ny - rg) / (1 - rg + 1e-6);
    else if (v.mode === 'band') t = Math.max(0, Math.abs(ny - fy) - rg / 2) / (0.5 + 1e-6);
    else { const dx = (nx - fx) * W / Math.max(W, H), dy = (ny - fy) * H / Math.max(W, H); t = Math.max(0, Math.sqrt(dx * dx + dy * dy) - rg / 2) / (0.6); }
    dep[y * W + x] = Math.min(1, t);
  }
  return dep;
};
MP.FILTERS.lensBlur = {
  title: 'Flou d\'objectif', heavy: true,
  fields: [{ k: 'r', label: 'Rayon (taille du flou)', type: 'range', min: 2, max: 120, unit: 'px' },
    { k: 'mode', label: 'Zone nette', type: 'select', options: [['sel', 'Sélection (sujet net)'], ['center', 'Point central'], ['bottom', 'Premier plan (bas net)'], ['top', 'Haut net'], ['band', 'Bande horizontale']] },
    { k: 'fx', label: 'Point net X', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'fy', label: 'Point net Y', type: 'range', min: 0, max: 100, unit: '%' },
    { k: 'range', label: 'Étendue de la zone nette', type: 'range', min: 2, max: 90, unit: '%' },
    { k: 'bright', label: 'Reflets (bokeh)', type: 'range', min: 0, max: 100 }, { k: 'thr', label: 'Seuil des reflets', type: 'range', min: 50, max: 254 },
    { k: 'shape', label: 'Forme du diaphragme', type: 'select', options: [['circle', 'Ronde'], ['hex', 'Hexagonale'], ['oct', 'Octogonale']] }, { k: 'noise', label: 'Grain (raccord)', type: 'range', min: 0, max: 20 }],
  values: { r: 24, mode: 'sel', fx: 50, fy: 50, range: 30, bright: 0, thr: 235, shape: 'circle', noise: 2 },
  render(src, v) {
    const W = src.width, H = src.height, R = Math.max(1, +v.r || 1), L = R < 8 ? 2 : 4;
    const s = Math.min(1, 10 / R), w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
    const sm = MP.createCanvas(w, h), sx = sm.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(src, 0, 0, w, h);
    const a = sx.getImageData(0, 0, w, h).data, n = w * h, lin = new Float32Array(n * 4), toL = (u) => Math.pow(u / 255, 2.2), boost = (+v.bright || 0) / 100 * 4, thr = (+v.thr || 210);
    for (let i = 0; i < n; i++) { const r = a[i * 4], g = a[i * 4 + 1], b = a[i * 4 + 2], al = a[i * 4 + 3] / 255, lum = 0.299 * r + 0.587 * g + 0.114 * b, k = lum > thr ? 1 + boost * ((lum - thr) / (255 - thr + 1e-6)) ** 2 : 1; lin[i * 4] = toL(r) * k * al; lin[i * 4 + 1] = toL(g) * k * al; lin[i * 4 + 2] = toL(b) * k * al; lin[i * 4 + 3] = al; }
    // points d'échantillonnage du diaphragme (spirale de Vogel, découpée en polygone si besoin)
    const sides = v.shape === 'hex' ? 6 : v.shape === 'oct' ? 8 : 0, taps = [];
    const inPoly = (x, y) => { if (!sides) return true; const ang = Math.atan2(y, x), rr = Math.hypot(x, y), seg = (2 * Math.PI) / sides, t = ((ang % seg) + seg) % seg - seg / 2, edge = Math.cos(seg / 2) / Math.cos(t); return rr <= edge; };
    for (let i = 0; i < 90; i++) { const rr = Math.sqrt((i + 0.5) / 90), th = i * 2.399963; const x = rr * Math.cos(th), y = rr * Math.sin(th); if (inPoly(x, y)) taps.push([x, y]); }
    const levels = [];
    for (let li = 1; li <= L; li++) {
      const rad = (R * s * li) / L, out = new Float32Array(n * 4), off = taps.map(([x, y]) => [Math.round(x * rad), Math.round(y * rad)]), T = off.length;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let r = 0, g = 0, b = 0, al = 0; for (let t = 0; t < T; t++) { let xx = x + off[t][0], yy = y + off[t][1]; if (xx < 0) xx = 0; else if (xx >= w) xx = w - 1; if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1; const j = (yy * w + xx) * 4; r += lin[j]; g += lin[j + 1]; b += lin[j + 2]; al += lin[j + 3]; } const o = (y * w + x) * 4; out[o] = r / T; out[o + 1] = g / T; out[o + 2] = b / T; out[o + 3] = al / T; }
      const c = MP.createCanvas(w, h), cx = c.getContext('2d'), id = cx.createImageData(w, h);
      for (let i = 0; i < n; i++) { const al = out[i * 4 + 3] || 1e-6; for (let k = 0; k < 3; k++) id.data[i * 4 + k] = Math.min(255, Math.pow(Math.max(0, out[i * 4 + k] / al), 1 / 2.2) * 255 + 0.5); id.data[i * 4 + 3] = out[i * 4 + 3] * 255; }
      cx.putImageData(id, 0, 0); const big = MP.createCanvas(W, H), bx = big.getContext('2d'); bx.imageSmoothingQuality = 'high'; bx.drawImage(c, 0, 0, W, H); levels.push(bx.getImageData(0, 0, W, H).data);
    }
    const o0 = src.getContext('2d').getImageData(0, 0, W, H), base = o0.data, dep = MP.lensDepth(W, H, v), gn = +v.noise || 0;
    for (let i = 0; i < W * H; i++) {
      const t = dep[i] * L; if (t <= 0.001) continue; const k = Math.min(L - 1, Math.floor(t)), f = t - k, A = k === 0 ? base : levels[k - 1], B = levels[k], j = i * 4, nz = gn ? (Math.random() - 0.5) * gn * dep[i] : 0;
      for (let c = 0; c < 4; c++) base[j + c] = A[j + c] + (B[j + c] - A[j + c]) * f + (c < 3 ? nz : 0);
    }
    const out = MP.createCanvas(W, H); out.getContext('2d').putImageData(o0, 0, 0); if (v.mode === 'sel') out._noSelMask = true; return out;
  },
};
{ const mr = MP.maskedResult; MP.maskedResult = (orig, out) => (out && out._noSelMask ? out : mr(orig, out)); }

/* =================== Recadrage intelligent =================== */
MP.smartCrop = {
  map(d) {
    const c = d.composite(null, { noLive: true }), k = Math.min(1, 160 / Math.max(d.width, d.height)), w = Math.max(2, Math.round(d.width * k)), h = Math.max(2, Math.round(d.height * k));
    const t = MP.createCanvas(w, h), x = t.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); x.drawImage(c, 0, 0, w, h);
    const a = x.getImageData(0, 0, w, h).data, n = w * h, lum = new Float32Array(n), sal = new Float32Array(n);
    let mr = 0, mg = 0, mb = 0; for (let i = 0; i < n; i++) { lum[i] = 0.299 * a[i * 4] + 0.587 * a[i * 4 + 1] + 0.114 * a[i * 4 + 2]; mr += a[i * 4]; mg += a[i * 4 + 1]; mb += a[i * 4 + 2]; } mr /= n; mg /= n; mb /= n;
    for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
      const i = y * w + xx, gx = lum[i + 1] - lum[i - 1], gy = lum[i + w] - lum[i - w], r = a[i * 4], g = a[i * 4 + 1], b = a[i * 4 + 2];
      const edge = Math.min(80, Math.hypot(gx, gy)), uniq = Math.hypot(r - mr, g - mg, b - mb) * 0.35, satur = (Math.max(r, g, b) - Math.min(r, g, b)) * 0.25;
      const skin = r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15 && Math.abs(r - g) > 15 ? 30 : 0;
      const cx = xx / w - 0.5, cy = y / h - 0.45, center = 1.15 - Math.min(1, Math.hypot(cx, cy) * 1.4);
      sal[i] = (edge + uniq + satur + skin) * center;
    }
    // lissage
    const sm = new Float32Array(n); for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { let s = 0, c2 = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = xx + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) { s += sal[Y * w + X]; c2++; } } sm[y * w + xx] = s / c2; }
    if (d.selection) { const sc = MP.createCanvas(w, h), sx = sc.getContext('2d'); sx.drawImage(d.selection, 0, 0, w, h); const sd = sx.getImageData(0, 0, w, h).data; let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, sm[i]); for (let i = 0; i < n; i++) sm[i] += (sd[i * 4 + 3] / 255) * (mx + 1) * 3; }
    return { w, h, k, sal: sm };
  },
  /** meilleur rectangle de proportions rw:rh (le plus grand possible), en pixels du document */
  best(d, rw, rh, m = null) {
    m = m || this.map(d); const { w, h, sal } = m, I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += sal[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    const S = (x0, y0, x1, y1) => I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
    const kd = Math.min(d.width / rw, d.height / rh), CW = Math.round(rw * kd), CH = Math.round(rh * kd), cw = Math.max(1, Math.round(CW * w / d.width)), ch = Math.max(1, Math.round(CH * h / d.height));
    let bx = 0, by = 0, bs = -1;
    for (let y = 0; y + ch <= h; y++) for (let x = 0; x + cw <= w; x++) { const s = S(x, y, x + cw, y + ch); if (s > bs + 1e-9) { bs = s; bx = x; by = y; } }
    const X = MP.clamp(Math.round(bx * d.width / w), 0, d.width - CW), Y = MP.clamp(Math.round(by * d.height / h), 0, d.height - CH);
    return { x: X, y: Y, w: CW, h: CH };
  },
  RATIOS: [['1:1', 'Carré 1:1'], ['4:5', 'Portrait 4:5'], ['3:2', 'Photo 3:2'], ['2:3', 'Photo portrait 2:3'], ['16:9', 'Paysage 16:9'], ['9:16', 'Story 9:16'], ['5:4', '5:4'], ['21:9', 'Cinéma 21:9']],
  dialog() {
    const d = MP.doc; if (!d) return;
    MP.ui.dialog({ title: 'Recadrage intelligent', width: 420, okLabel: 'Recadrer', values: { r: '4:5' }, fields: [{ k: 'r', label: 'Format', type: 'select', options: this.RATIOS }, { type: 'info', html: '<p class="muted">La zone la plus importante (sujet, visages, détails, sélection active) est conservée automatiquement.</p>' }],
      onOk: (o) => { const [a, b] = o.r.split(':').map(Number), r = this.best(d, a, b); MP.cropDoc(r.x, r.y, r.w, r.h); MP.view.fit && MP.view.fit(); MP.toast(`Recadré en ${o.r} : ${r.w} × ${r.h} px`); } });
  },
  SOCIAL: [['ig_sq', 'Instagram — publication carrée', 1080, 1080], ['ig_pt', 'Instagram — portrait', 1080, 1350], ['story', 'Story / Reels / TikTok', 1080, 1920], ['yt', 'Miniature YouTube', 1280, 720], ['fb', 'Facebook — lien / publication', 1200, 630], ['li', 'LinkedIn — publication', 1200, 627], ['x', 'X (Twitter) — publication', 1600, 900], ['pin', 'Pinterest — épingle', 1000, 1500], ['shop', 'Fiche produit (carré HD)', 2048, 2048]],
  async render(d, W, H, m) { const r = this.best(d, W, H, m), c = d.composite(null, { noLive: true }), t = MP.createCanvas(r.w, r.h); t.getContext('2d').drawImage(c, -r.x, -r.y); const o = MP.lanczos ? MP.lanczos(t, W, H) : (() => { const z = MP.createCanvas(W, H), zx = z.getContext('2d'); zx.imageSmoothingQuality = 'high'; zx.drawImage(t, 0, 0, W, H); return z; })(); return { rect: r, canvas: o }; },
  exportDialog() {
    const d = MP.doc; if (!d) return; const v = { fmt: 'jpeg', q: 90 }; this.SOCIAL.forEach(([k]) => (v[k] = ['ig_sq', 'ig_pt', 'story', 'yt', 'fb'].includes(k)));
    MP.ui.dialog({ title: 'Exporter pour les réseaux sociaux', width: 480, okLabel: 'Exporter', values: v,
      fields: [{ type: 'info', html: '<p class="muted">Chaque format est recadré automatiquement autour de la zone importante de l\'image (ou de la sélection active).</p>' }, ...this.SOCIAL.map(([k, l, W, H]) => ({ k, label: `${l} (${W} × ${H})`, type: 'check' })), { k: 'fmt', label: 'Format de fichier', type: 'select', options: [['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP']] }, { k: 'q', label: 'Qualité', type: 'range', min: 50, max: 100 }],
      onOk: (o) => { setTimeout(() => this.exportAll(o), 30); } });
  },
  async exportAll(o) {
    const d = MP.doc, sel = this.SOCIAL.filter(([k]) => o[k]); if (!sel.length) { MP.toast('Choisissez au moins un format'); return; }
    const files = await MP.busy('Export pour les réseaux sociaux…', async () => { const m = this.map(d), base = d.name.replace(/\.[^.]+$/, ''), out = []; for (const [k, , W, H] of sel) { const { canvas } = await this.render(d, W, H, m), e = o.fmt === 'png' ? 'png' : o.fmt === 'webp' ? 'webp' : 'jpg'; const data = o.fmt === 'png' ? await MP.enc.png(canvas, { meta: d.meta }) : o.fmt === 'webp' ? await new Promise((r) => canvas.toBlob(async (b) => r(new Uint8Array(await b.arrayBuffer())), 'image/webp', o.q / 100)) : await MP.enc.jpeg(canvas, o.q / 100, { meta: d.meta }); out.push({ name: `${base}-${k}-${W}x${H}.${e}`, data }); } return out; });
    await MP.outFiles(files, d.name.replace(/\.[^.]+$/, '') + '-reseaux-sociaux'); return files;
  },
};

/* =================== Palette de couleurs =================== */
MP.palette = {
  extract(d, k = 6) {
    const c = d.composite(null, { noLive: true }), s = Math.min(1, 120 / Math.max(d.width, d.height)), w = Math.max(1, Math.round(d.width * s)), h = Math.max(1, Math.round(d.height * s));
    const t = MP.createCanvas(w, h), x = t.getContext('2d'); x.drawImage(c, 0, 0, w, h); const a = x.getImageData(0, 0, w, h).data, P = [];
    for (let i = 0; i < w * h; i++) if (a[i * 4 + 3] > 128) P.push([a[i * 4], a[i * 4 + 1], a[i * 4 + 2]]);
    if (!P.length) return [];
    const dist = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2, C = [P[Math.floor(P.length / 2)].slice()];
    while (C.length < Math.min(k, P.length)) { let bi = 0, bd = -1; for (let i = 0; i < P.length; i += 3) { let m = Infinity; for (const q of C) m = Math.min(m, dist(P[i], q)); if (m > bd) { bd = m; bi = i; } } C.push(P[bi].slice()); }
    let cnt = [];
    for (let it = 0; it < 12; it++) { const S = C.map(() => [0, 0, 0]); cnt = C.map(() => 0); for (const p of P) { let bi = 0, bd = Infinity; C.forEach((q, j) => { const dd = dist(p, q); if (dd < bd) { bd = dd; bi = j; } }); S[bi][0] += p[0]; S[bi][1] += p[1]; S[bi][2] += p[2]; cnt[bi]++; } C.forEach((q, j) => { if (cnt[j]) for (let z = 0; z < 3; z++) q[z] = S[j][z] / cnt[j]; }); }
    const hex = (q) => '#' + q.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    return C.map((q, j) => ({ hex: hex(q), share: cnt[j] / P.length })).filter((e) => e.share > 0).sort((p, q) => q.share - p.share);
  },
  toSwatches(list) { let u = []; try { u = JSON.parse(localStorage.getItem('mp.swatches') || '[]'); } catch (_) { /* */ } for (const e of list) if (!u.includes(e.hex)) u.push(e.hex); try { localStorage.setItem('mp.swatches', JSON.stringify(u)); } catch (_) { /* */ } UI.drawSwatches && UI.drawSwatches(); },
  toLayer(d, list) { d.history.record('Palette de couleurs', null); const l = d.addLayer('Palette'); l.parent = null; const H = Math.max(24, Math.round(d.height * 0.08)), y = d.height - H; let x = 0; list.forEach((e, i) => { const w = i === list.length - 1 ? d.width - x : Math.round(d.width * e.share); l.ctx.fillStyle = e.hex; l.ctx.fillRect(x, y, w, H); x += w; }); d.active = d.layers.indexOf(l); MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll(); },
  dialog() {
    const d = MP.doc; if (!d) return; const pal = this.extract(d, 6);
    MP.ui.dialog({ title: 'Palette de couleurs de l\'image', width: 460, okLabel: 'Ajouter au nuancier', values: {},
      fields: [{ type: 'info', html: '<div class="pal-row">' + pal.map((e) => `<div class="pal-sw" style="background:${e.hex}" title="${e.hex}"><span>${e.hex}<br>${Math.round(e.share * 100)} %</span></div>`).join('') + '</div>' }, { type: 'button', label: 'Créer un calque palette', action: () => this.toLayer(d, pal) }, { type: 'button', label: 'Copier les codes', action: () => { navigator.clipboard && navigator.clipboard.writeText(pal.map((e) => e.hex).join(', ')); MP.toast('Codes couleur copiés'); } }],
      onOk: () => { this.toSwatches(pal); MP.toast('Couleurs ajoutées au nuancier'); } });
    return pal;
  },
};

/* =================== QR code =================== */
MP.qr = (() => {
  const ECC = { L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30] };
  const BLK = { L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81] };
  const FMT = { L: 1, M: 0, Q: 3, H: 2 };
  const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; } return r; };
  const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - ECC[e][v] * BLK[e][v];
  const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; };
  const divisor = (deg) => { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; };
  const remainder = (data, div) => { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => (r[i] ^= gmul(c, f))); } return r; };
  const alignPos = (v) => { if (v === 1) return []; const n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6]; for (let p = v * 4 + 17 - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; };
  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  function encode(text, ecl = 'M') {
    const bytes = [...new TextEncoder().encode(String(text))]; let v = 1;
    for (; v <= 40; v++) { const cc = v <= 9 ? 8 : 16; if (bytes.length < (1 << cc) && 4 + cc + bytes.length * 8 <= dataCodewords(v, ecl) * 8) break; }
    if (v > 40) throw new Error('texte trop long pour un QR code');
    const bb = [], push = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, v <= 9 ? 8 : 16); bytes.forEach((b) => push(b, 8));
    const cap = dataCodewords(v, ecl) * 8; push(0, Math.min(4, cap - bb.length)); push(0, (8 - (bb.length % 8)) % 8);
    for (let p = 0xec; bb.length < cap; p ^= 0xec ^ 0x11) push(p, 8);
    const data = []; for (let i = 0; i < bb.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) b = (b << 1) | bb[i + k]; data.push(b); }
    // blocs + correction d'erreurs
    const nb = BLK[ecl][v], el = ECC[ecl][v], raw = Math.floor(rawModules(v) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = divisor(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length; const ec = remainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ec)); }
    const cw = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) cw.push(b[i]); });
    // matrice
    const N = v * 4 + 17, mod = Array.from({ length: N }, () => new Array(N).fill(false)), fn = Array.from({ length: N }, () => new Array(N).fill(false)), set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [N - 4, 3], [3, N - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < N && y >= 0 && y < N) set(x, y, dist !== 2 && dist !== 4); }
    const ap = alignPos(v), na = ap.length; for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) { if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    const drawFormat = (mask) => { const dd = (FMT[ecl] << 3) | mask; let r = dd; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const b = ((dd << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(b, i)); set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) set(N - 1 - i, 8, bit(b, i)); for (let i = 8; i < 15; i++) set(8, N - 15 + i, bit(b, i)); set(8, N - 8, true); };
    drawFormat(0);
    if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (v << 12) | r; for (let i = 0; i < 18; i++) { const bt = bit(b, i), a = N - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bt); set(c, a, bt); } }
    let bi = 0; for (let right = N - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < N; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? N - 1 - vert : vert; if (!fn[y][x] && bi < cw.length * 8) { mod[y][x] = bit(cw[bi >>> 3], 7 - (bi & 7)); bi++; } } }
    const applyMask = (m) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; };
    const penalty = () => { let p = 0; for (let pass = 0; pass < 2; pass++) for (let a = 0; a < N; a++) { let run = 1; for (let b = 1; b < N; b++) { const c0 = pass ? mod[b][a] : mod[a][b], c1 = pass ? mod[b - 1][a] : mod[a][b - 1]; if (c0 === c1) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
      const pat = [true, false, true, true, true, false, true]; for (let a = 0; a < N; a++) for (let b = 0; b + 7 <= N; b++) for (const pass of [0, 1]) { let ok = true; for (let k = 0; k < 7 && ok; k++) ok = (pass ? mod[b + k][a] : mod[a][b + k]) === pat[k]; if (!ok) continue; const lightAt = (s, e) => { for (let k = s; k < e; k++) { if (k < 0 || k >= N) continue; if (pass ? mod[k][a] : mod[a][k]) return false; } return true; }; if (lightAt(b - 4, b) || lightAt(b + 7, b + 11)) p += 40; }
      let dark = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (mod[y][x]) dark++; p += Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10; return p; };
    let best = 0, bp = Infinity; for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const p = penalty(); if (p < bp) { bp = p; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { version: v, size: N, modules: mod, mask: best };
  }
  function draw(q, scale = 8, fg = '#000000', bg = '#ffffff', quiet = 4) { const S = (q.size + quiet * 2) * scale, c = MP.createCanvas(S, S), x = c.getContext('2d'); if (bg && bg !== 'transparent') { x.fillStyle = bg; x.fillRect(0, 0, S, S); } x.fillStyle = fg; for (let y = 0; y < q.size; y++) for (let xx = 0; xx < q.size; xx++) if (q.modules[y][xx]) x.fillRect((xx + quiet) * scale, (y + quiet) * scale, scale, scale); return c; }
  function dialog() {
    const d = MP.doc; if (!d) return; const v = { text: 'https://multipify.eu', ecl: 'M', size: Math.round(Math.min(d.width, d.height) * 0.3), fg: '#000000', bg: '#ffffff', transparent: false };
    MP.ui.dialog({ title: 'Générer un QR code', width: 460, okLabel: 'Créer le calque', values: v,
      fields: [{ k: 'text', label: 'Lien ou texte', type: 'textarea', rows: 2 }, { k: 'ecl', label: 'Correction d\'erreurs', type: 'select', options: [['L', 'L — 7 % (plus compact)'], ['M', 'M — 15 % (recommandé)'], ['Q', 'Q — 25 %'], ['H', 'H — 30 % (logo au centre possible)']] }, { k: 'size', label: 'Taille (px)', type: 'number', min: 40, max: 8000 }, { k: 'fg', label: 'Couleur des modules', type: 'color' }, { k: 'bg', label: 'Couleur du fond', type: 'color' }, { k: 'transparent', label: 'Fond transparent', type: 'check' }, { type: 'info', html: '<p class="muted">Gardez un bon contraste (modules foncés sur fond clair) et testez le code avec un téléphone avant d\'imprimer.</p>' }],
      onOk: (o) => { if (!o.text.trim()) return false; try { MP.qr.addLayer(d, o.text, o); } catch (e) { MP.toast('QR code : ' + e.message, 5000); return false; } } });
  }
  function addLayer(d, text, o = {}) {
    const q = encode(text, o.ecl || 'M'), sz = Math.max(40, +o.size || 300), sc = Math.max(1, Math.floor(sz / (q.size + 8))), c = draw(q, sc, o.fg || '#000000', o.transparent ? 'transparent' : (o.bg || '#ffffff'));
    d.history.record('QR code', null); const l = d.addLayer('QR code'); l.parent = null; const x = Math.round((d.width - sz) / 2), y = Math.round((d.height - sz) / 2);
    l.ctx.imageSmoothingEnabled = false; l.ctx.drawImage(c, x, y, sz, sz); l.qr = { text, ecl: o.ecl || 'M' }; d.active = d.layers.indexOf(l); MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll();
    MP.toast(`QR code version ${q.version} (${q.size} × ${q.size} modules) ajouté`); return l;
  }
  return { encode, draw, dialog, addLayer };
})();

/* =================== Menus =================== */
{
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), M = (n) => (m.find((x) => x.label === n) || { items: [] }).items;
    const fi = M('Filtre'), fl = fi.find((x) => x && x.label === 'Flou');
    if (fl && typeof fl.sub === 'function') { const s0 = fl.sub; fl.sub = () => [...s0(), '-', { label: 'Flou d\'objectif (bokeh)…', act: need(() => MP.runAdjust('lensBlur', true)) }]; }
    const im = M('Image'), at = im.findIndex((x) => x && x.label === 'Recadrer sur la sélection');
    im.splice(at >= 0 ? at + 1 : im.length, 0, { label: 'Recadrage intelligent…', act: need(() => MP.smartCrop.dialog()) }, { label: 'Palette de couleurs de l\'image…', act: need(() => MP.palette.dialog()) });
    const ex = M('Fichier').find((x) => x && x.label === 'Exporter');
    const item = { label: 'Pour les réseaux sociaux (multi-formats)…', act: need(() => MP.smartCrop.exportDialog()) };
    if (ex && typeof ex.sub === 'function') { const s0 = ex.sub; ex.sub = () => [...s0(), '-', item]; } else if (ex && Array.isArray(ex.sub)) ex.sub.push('-', item); else M('Fichier').splice(5, 0, item);
    const ca = M('Calque'), ai = ca.findIndex((x) => x && x.label === 'Nouveau calque de réglage');
    ca.splice(ai >= 0 ? ai : ca.length, 0, { label: 'Nouveau QR code…', act: need(() => MP.qr.dialog()) });
    return m;
  };
}
