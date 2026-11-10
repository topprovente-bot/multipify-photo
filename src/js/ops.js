'use strict';
/* Réglages, filtres et opérations sur l'image / les calques */

/** Fusionne un résultat avec l'original selon la sélection active. */
MP.maskedResult = (orig, out) => {
  const d = MP.doc; if (!d.selection) return out;
  const r = MP.cloneCanvas(orig), rc = r.getContext('2d');
  rc.globalCompositeOperation = 'destination-out'; rc.drawImage(d.selection, 0, 0);
  const inside = MP.cloneCanvas(out); d.clipToSelection(inside);
  rc.globalCompositeOperation = 'source-over'; rc.drawImage(inside, 0, 0);
  return r;
};

MP.histogram = (canvas) => {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const h = { r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256), l: new Uint32Array(256) };
  const step = data.length > 16e6 ? 16 : 4;
  for (let i = 0; i < data.length; i += step) { if (data[i + 3] < 8) continue; h.r[data[i]]++; h.g[data[i + 1]]++; h.b[data[i + 2]]++; h.l[Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)]++; }
  return h;
};

/* Interpolation monotone pour les courbes */
MP.curveLUT = (pts) => {
  const p = [...pts].sort((a, b) => a[0] - b[0]), n = p.length, lut = new Uint8ClampedArray(256);
  if (n < 2) { for (let i = 0; i < 256; i++) lut[i] = i; return lut; }
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(p[i + 1][0] - p[i][0] || 1e-6); dy.push(p[i + 1][1] - p[i][1]); m.push(dy[i] / dx[i]); }
  const t = [m[0]]; for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2); t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; } const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
  for (let x = 0; x < 256; x++) {
    if (x <= p[0][0]) { lut[x] = p[0][1]; continue; } if (x >= p[n - 1][0]) { lut[x] = p[n - 1][1]; continue; }
    let i = 0; while (x > p[i + 1][0]) i++;
    const h = dx[i], u = (x - p[i][0]) / h, u2 = u * u, u3 = u2 * u;
    lut[x] = (2 * u3 - 3 * u2 + 1) * p[i][1] + (u3 - 2 * u2 + u) * h * t[i] + (-2 * u3 + 3 * u2) * p[i + 1][1] + (u3 - u2) * h * t[i + 1];
  }
  return lut;
};

const ident = () => { const a = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) a[i] = i; return a; };
const applyLUT = (src, dst, L) => { for (let i = 0; i < src.length; i += 4) { dst[i] = L.r[src[i]]; dst[i + 1] = L.g[src[i + 1]]; dst[i + 2] = L.b[src[i + 2]]; dst[i + 3] = src[i + 3]; } };
const lum = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;

/* ---------- Réglages (pixel à pixel) ---------- */
MP.ADJUST = {
  brightness: {
    title: 'Luminosité/Contraste', fields: [{ k: 'b', label: 'Luminosité', type: 'range', min: -150, max: 150 }, { k: 'c', label: 'Contraste', type: 'range', min: -100, max: 100 }], values: { b: 0, c: 0 },
    pixel(s, d, v) { const L = new Uint8ClampedArray(256), C = v.c * 2.55, f = (259 * (C + 255)) / (255 * (259 - C)); for (let i = 0; i < 256; i++) L[i] = f * (i + v.b - 128) + 128; applyLUT(s, d, { r: L, g: L, b: L }); },
  },
  levels: {
    title: 'Niveaux', histogram: true,
    fields: [{ k: 'ch', label: 'Couche', type: 'select', options: [['rgb', 'RVB'], ['r', 'Rouge'], ['g', 'Vert'], ['b', 'Bleu']] }, { k: 'inB', label: 'Entrée — noir', type: 'range', min: 0, max: 253 }, { k: 'gamma', label: 'Entrée — gamma', type: 'range', min: 0.1, max: 9.99, step: 0.01 }, { k: 'inW', label: 'Entrée — blanc', type: 'range', min: 2, max: 255 }, { k: 'outB', label: 'Sortie — noir', type: 'range', min: 0, max: 255 }, { k: 'outW', label: 'Sortie — blanc', type: 'range', min: 0, max: 255 }],
    values: { ch: 'rgb', inB: 0, gamma: 1, inW: 255, outB: 0, outW: 255 },
    pixel(s, d, v) {
      const L = new Uint8ClampedArray(256), span = Math.max(1, v.inW - v.inB);
      for (let i = 0; i < 256; i++) { const t = Math.pow(MP.clamp((i - v.inB) / span, 0, 1), 1 / v.gamma); L[i] = v.outB + t * (v.outW - v.outB); }
      const I = ident(); applyLUT(s, d, { r: v.ch === 'rgb' || v.ch === 'r' ? L : I, g: v.ch === 'rgb' || v.ch === 'g' ? L : I, b: v.ch === 'rgb' || v.ch === 'b' ? L : I });
    },
  },
  curves: {
    title: 'Courbes', curves: true, values: { ch: 'rgb', pts: { rgb: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] } },
    fields: [{ k: 'ch', label: 'Couche', type: 'select', options: [['rgb', 'RVB'], ['r', 'Rouge'], ['g', 'Vert'], ['b', 'Bleu']] }],
    pixel(s, d, v) {
      const m = MP.curveLUT(v.pts.rgb), c = (k) => { const a = MP.curveLUT(v.pts[k]), o = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) o[i] = m[a[i]]; return o; };
      applyLUT(s, d, { r: c('r'), g: c('g'), b: c('b') });
    },
  },
  exposure: {
    title: 'Exposition', fields: [{ k: 'e', label: 'Exposition', type: 'range', min: -5, max: 5, step: 0.01 }, { k: 'o', label: 'Décalage', type: 'range', min: -0.5, max: 0.5, step: 0.001 }, { k: 'g', label: 'Correction gamma', type: 'range', min: 0.1, max: 9.99, step: 0.01 }], values: { e: 0, o: 0, g: 1 },
    pixel(s, d, v) { const L = new Uint8ClampedArray(256), k = Math.pow(2, v.e); for (let i = 0; i < 256; i++) L[i] = Math.pow(MP.clamp((i / 255) * k + v.o, 0, 1), 1 / v.g) * 255; applyLUT(s, d, { r: L, g: L, b: L }); },
  },
  hueSat: {
    title: 'Teinte/Saturation', fields: [{ k: 'h', label: 'Teinte', type: 'range', min: -180, max: 180 }, { k: 's', label: 'Saturation', type: 'range', min: -100, max: 100 }, { k: 'l', label: 'Luminosité', type: 'range', min: -100, max: 100 }, { k: 'colorize', label: 'Redéfinir (coloriser)', type: 'check' }], values: { h: 0, s: 0, l: 0, colorize: false },
    pixel(s, d, v) {
      for (let i = 0; i < s.length; i += 4) {
        let [h, sa, l] = MP.rgbToHsl(s[i], s[i + 1], s[i + 2]);
        if (v.colorize) { h = (((v.h % 360) + 360) % 360) / 360; sa = v.s >= 0 ? 0.25 + (v.s / 100) * 0.75 : 0.25 * (1 + v.s / 100); }
        else { h = (h + v.h / 360 + 1) % 1; sa = v.s > 0 ? sa + (1 - sa) * (v.s / 100) * Math.min(1, sa * 4) : sa * (1 + v.s / 100); }
        l = v.l > 0 ? l + (1 - l) * (v.l / 100) : l * (1 + v.l / 100);
        const [r, g, b] = MP.hslToRgb(h, sa, l); d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = s[i + 3];
      }
    },
  },
  vibrance: {
    title: 'Vibrance', fields: [{ k: 'v', label: 'Vibrance', type: 'range', min: -100, max: 100 }, { k: 's', label: 'Saturation', type: 'range', min: -100, max: 100 }], values: { v: 0, s: 0 },
    pixel(s, d, v) {
      for (let i = 0; i < s.length; i += 4) {
        const r = s[i], g = s[i + 1], b = s[i + 2], sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255, y = lum(r, g, b);
        const k = (1 + v.s / 100) * (1 + (v.v / 100) * (1 - sat) * 1.2);
        d[i] = y + (r - y) * k; d[i + 1] = y + (g - y) * k; d[i + 2] = y + (b - y) * k; d[i + 3] = s[i + 3];
      }
    },
  },
  colorBalance: {
    title: 'Balance des couleurs', fields: [{ k: 'cr', label: 'Cyan ↔ Rouge', type: 'range', min: -100, max: 100 }, { k: 'mg', label: 'Magenta ↔ Vert', type: 'range', min: -100, max: 100 }, { k: 'yb', label: 'Jaune ↔ Bleu', type: 'range', min: -100, max: 100 }, { k: 'tone', label: 'Tons', type: 'select', options: [['mid', 'Tons moyens'], ['shadow', 'Tons foncés'], ['high', 'Tons clairs']] }, { k: 'keep', label: 'Conserver la luminosité', type: 'check' }],
    values: { cr: 0, mg: 0, yb: 0, tone: 'mid', keep: true },
    pixel(s, d, v) {
      const wt = (x) => { const t = x / 255; return v.tone === 'mid' ? 1 - Math.pow(2 * t - 1, 2) : v.tone === 'shadow' ? Math.pow(1 - t, 2) : t * t; };
      const mk = (amt) => { const L = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) L[i] = i + amt * 0.8 * wt(i); return L; };
      const L = { r: mk(v.cr), g: mk(v.mg), b: mk(v.yb) };
      for (let i = 0; i < s.length; i += 4) {
        let r = L.r[s[i]], g = L.g[s[i + 1]], b = L.b[s[i + 2]];
        if (v.keep) { const y0 = lum(s[i], s[i + 1], s[i + 2]), y1 = lum(r, g, b) || 1, dl = y0 - y1; r += dl; g += dl; b += dl; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = s[i + 3];
      }
    },
  },
  blackWhite: {
    title: 'Noir et blanc', fields: [{ k: 'r', label: 'Rouges', type: 'range', min: -200, max: 300, unit: '%' }, { k: 'g', label: 'Verts', type: 'range', min: -200, max: 300, unit: '%' }, { k: 'b', label: 'Bleus', type: 'range', min: -200, max: 300, unit: '%' }, { k: 'tint', label: 'Virage', type: 'check' }, { k: 'tc', label: 'Couleur du virage', type: 'color' }],
    values: { r: 40, g: 40, b: 20, tint: false, tc: '#b08850' },
    pixel(s, d, v) {
      const t = MP.hexToRgb(v.tc), tl = lum(t.r, t.g, t.b) || 1;
      for (let i = 0; i < s.length; i += 4) {
        const y = MP.clamp((s[i] * v.r + s[i + 1] * v.g + s[i + 2] * v.b) / 100, 0, 255);
        if (v.tint) { d[i] = (y * t.r) / tl; d[i + 1] = (y * t.g) / tl; d[i + 2] = (y * t.b) / tl; } else d[i] = d[i + 1] = d[i + 2] = y;
        d[i + 3] = s[i + 3];
      }
    },
  },
  photoFilter: {
    title: 'Filtre photo', fields: [{ k: 'c', label: 'Couleur', type: 'color' }, { k: 'k', label: 'Densité', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'keep', label: 'Conserver la luminosité', type: 'check' }], values: { c: '#ec8a00', k: 25, keep: true },
    pixel(s, d, v) {
      const f = MP.hexToRgb(v.c), k = v.k / 100;
      for (let i = 0; i < s.length; i += 4) {
        let r = MP.lerp(s[i], (s[i] * f.r) / 255 * 1.6, k), g = MP.lerp(s[i + 1], (s[i + 1] * f.g) / 255 * 1.6, k), b = MP.lerp(s[i + 2], (s[i + 2] * f.b) / 255 * 1.6, k);
        if (v.keep) { const dl = lum(s[i], s[i + 1], s[i + 2]) - lum(r, g, b); r += dl; g += dl; b += dl; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = s[i + 3];
      }
    },
  },
  shadowsHighlights: {
    title: 'Tons foncés/Tons clairs', fields: [{ k: 'sh', label: 'Tons foncés', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'hi', label: 'Tons clairs', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'rad', label: 'Rayon', type: 'range', min: 1, max: 200, unit: 'px' }], values: { sh: 35, hi: 0, rad: 30 },
    needsBlur: (v) => v.rad,
    pixel(s, d, v, blur) {
      const S = v.sh / 100, H = v.hi / 100;
      for (let i = 0; i < s.length; i += 4) {
        const L = lum(blur[i], blur[i + 1], blur[i + 2]) / 255;
        const up = 1 + S * Math.pow(1 - L, 2) * 2.2, down = 1 - H * Math.pow(L, 2) * 0.6;
        const k = up * down;
        d[i] = s[i] * k; d[i + 1] = s[i + 1] * k; d[i + 2] = s[i + 2] * k; d[i + 3] = s[i + 3];
      }
    },
  },
  threshold: { title: 'Seuil', fields: [{ k: 't', label: 'Seuil', type: 'range', min: 1, max: 255 }], values: { t: 128 }, pixel(s, d, v) { for (let i = 0; i < s.length; i += 4) { const y = lum(s[i], s[i + 1], s[i + 2]) >= v.t ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = y; d[i + 3] = s[i + 3]; } } },
  posterize: { title: 'Isohélie', fields: [{ k: 'n', label: 'Niveaux', type: 'range', min: 2, max: 64 }], values: { n: 4 }, pixel(s, d, v) { const L = new Uint8ClampedArray(256), n = v.n - 1; for (let i = 0; i < 256; i++) L[i] = Math.round((Math.round((i / 255) * n) / n) * 255); applyLUT(s, d, { r: L, g: L, b: L }); } },
  gradientMap: {
    title: 'Courbe de transfert de dégradé', fields: [{ k: 'a', label: 'Ombres', type: 'color' }, { k: 'b', label: 'Lumières', type: 'color' }, { k: 'rev', label: 'Inverser', type: 'check' }], values: { a: '#1a1040', b: '#ffd27a', rev: false },
    pixel(s, d, v) {
      let A = MP.hexToRgb(v.a), B = MP.hexToRgb(v.b); if (v.rev) [A, B] = [B, A];
      for (let i = 0; i < s.length; i += 4) { const t = lum(s[i], s[i + 1], s[i + 2]) / 255; d[i] = MP.lerp(A.r, B.r, t); d[i + 1] = MP.lerp(A.g, B.g, t); d[i + 2] = MP.lerp(A.b, B.b, t); d[i + 3] = s[i + 3]; }
    },
  },
  invert: { title: 'Négatif', pixel(s, d) { for (let i = 0; i < s.length; i += 4) { d[i] = 255 - s[i]; d[i + 1] = 255 - s[i + 1]; d[i + 2] = 255 - s[i + 2]; d[i + 3] = s[i + 3]; } } },
  desaturate: { title: 'Désaturation', pixel(s, d) { for (let i = 0; i < s.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = lum(s[i], s[i + 1], s[i + 2]); d[i + 3] = s[i + 3]; } } },
  sepia: { title: 'Sépia', pixel(s, d) { for (let i = 0; i < s.length; i += 4) { const r = s[i], g = s[i + 1], b = s[i + 2]; d[i] = r * 0.393 + g * 0.769 + b * 0.189; d[i + 1] = r * 0.349 + g * 0.686 + b * 0.168; d[i + 2] = r * 0.272 + g * 0.534 + b * 0.131; d[i + 3] = s[i + 3]; } } },
  autoContrast: {
    title: 'Contraste automatique',
    pixel(s, d) {
      const L = {};
      for (const [c, o] of [['r', 0], ['g', 1], ['b', 2]]) {
        const h = new Uint32Array(256); let n = 0; for (let i = 0; i < s.length; i += 4) if (s[i + 3] > 8) { h[s[i + o]]++; n++; }
        const cut = n * 0.001; let lo = 0, hi = 255, acc = 0; while (lo < 255 && (acc += h[lo]) <= cut) lo++; acc = 0; while (hi > 0 && (acc += h[hi]) <= cut) hi--;
        const T = new Uint8ClampedArray(256), sp = Math.max(1, hi - lo); for (let i = 0; i < 256; i++) T[i] = ((i - lo) * 255) / sp; L[c] = T;
      }
      applyLUT(s, d, L);
    },
  },
  equalize: {
    title: 'Égaliser',
    pixel(s, d) {
      const h = new Uint32Array(256); let n = 0; for (let i = 0; i < s.length; i += 4) if (s[i + 3] > 8) { h[Math.round(lum(s[i], s[i + 1], s[i + 2]))]++; n++; }
      const cdf = new Float32Array(256); let a = 0; for (let i = 0; i < 256; i++) { a += h[i]; cdf[i] = a / (n || 1); }
      for (let i = 0; i < s.length; i += 4) { const y = lum(s[i], s[i + 1], s[i + 2]), ny = cdf[Math.round(y)] * 255, k = y ? ny / y : 1; d[i] = s[i] * k; d[i + 1] = s[i + 1] * k; d[i + 2] = s[i + 2] * k; if (!y) d[i] = d[i + 1] = d[i + 2] = ny; d[i + 3] = s[i + 3]; }
    },
  },
};

/* ---------- Outils de filtre ---------- */
MP.blurCanvas = (src, r) => {
  if (r <= 0) return MP.cloneCanvas(src);
  const w = src.width, h = src.height, pad = Math.ceil(r * 3);
  const big = MP.createCanvas(w + pad * 2, h + pad * 2), bc = big.getContext('2d');
  // bords répliqués pour éviter le halo transparent
  bc.drawImage(src, 0, 0, w, 1, pad, 0, w, pad); bc.drawImage(src, 0, h - 1, w, 1, pad, h + pad, w, pad);
  bc.drawImage(src, 0, 0, 1, h, 0, pad, pad, h); bc.drawImage(src, w - 1, 0, 1, h, w + pad, pad, pad, h);
  bc.drawImage(src, 0, 0, 1, 1, 0, 0, pad, pad); bc.drawImage(src, w - 1, 0, 1, 1, w + pad, 0, pad, pad);
  bc.drawImage(src, 0, h - 1, 1, 1, 0, h + pad, pad, pad); bc.drawImage(src, w - 1, h - 1, 1, 1, w + pad, h + pad, pad, pad);
  bc.drawImage(src, pad, pad);
  const out = MP.createCanvas(w, h), oc = out.getContext('2d');
  oc.filter = `blur(${r}px)`; oc.drawImage(big, -pad, -pad); oc.filter = 'none';
  // conserver la transparence d'origine sur les calques détourés
  return out;
};
const remap = (src, fn) => {
  const w = src.width, h = src.height, s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = MP.createCanvas(w, h), oc = out.getContext('2d'), id = oc.createImageData(w, h), d = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = fn(x, y), i = (y * w + x) * 4; if (!p) continue;
    const fx = MP.clamp(p[0], 0, w - 1.001), fy = MP.clamp(p[1], 0, h - 1.001), x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
    const a = (y0 * w + x0) * 4, b = a + 4, c = a + w * 4, e = c + 4;
    for (let k = 0; k < 4; k++) d[i + k] = (s[a + k] * (1 - tx) + s[b + k] * tx) * (1 - ty) + (s[c + k] * (1 - tx) + s[e + k] * tx) * ty;
  }
  oc.putImageData(id, 0, 0); return out;
};
const pixelOp = (src, fn) => {
  const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h);
  const out = MP.createCanvas(w, h), oc = out.getContext('2d'), id = oc.createImageData(w, h);
  fn(sd.data, id.data, w, h); oc.putImageData(id, 0, 0); return out;
};
const conv3 = (s, d, w, h, k, bias = 0, gray = false) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; let r = 0, g = 0, b = 0;
    for (let j = -1; j <= 1; j++) for (let q = -1; q <= 1; q++) { const X = MP.clamp(x + q, 0, w - 1), Y = MP.clamp(y + j, 0, h - 1), o = (Y * w + X) * 4, kv = k[(j + 1) * 3 + q + 1]; r += s[o] * kv; g += s[o + 1] * kv; b += s[o + 2] * kv; }
    if (gray) { const v = lum(r, g, b) + bias; d[i] = d[i + 1] = d[i + 2] = v; } else { d[i] = r + bias; d[i + 1] = g + bias; d[i + 2] = b + bias; }
    d[i + 3] = s[i + 3];
  }
};
const hash = (x, y, s) => { let n = x * 374761393 + y * 668265263 + s * 2147483647; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) & 0xffff) / 0xffff; };
const vnoise = (x, y, s) => { const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); return MP.lerp(MP.lerp(hash(x0, y0, s), hash(x0 + 1, y0, s), sx), MP.lerp(hash(x0, y0 + 1, s), hash(x0 + 1, y0 + 1, s), sx), sy); };

MP.FILTERS = {
  gaussian: { title: 'Flou gaussien', fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 0.1, max: 250, step: 0.1, unit: 'px' }], values: { r: 4 }, render: (src, v) => MP.blurCanvas(src, v.r) },
  motion: {
    title: 'Flou de mouvement', fields: [{ k: 'a', label: 'Angle', type: 'range', min: -180, max: 180, unit: '°' }, { k: 'd', label: 'Distance', type: 'range', min: 1, max: 500, unit: 'px' }], values: { a: 0, d: 20 },
    render(src, v) {
      const out = MP.createCanvas(src.width, src.height), c = out.getContext('2d'), n = Math.min(64, Math.max(4, Math.round(v.d))), rad = (v.a * Math.PI) / 180;
      for (let i = 0; i < n; i++) { const t = (i / (n - 1) - 0.5) * v.d; c.globalAlpha = 1 / (i + 1); c.drawImage(src, Math.cos(rad) * t, -Math.sin(rad) * t); }
      return out;
    },
  },
  radial: {
    title: 'Flou radial (zoom)', fields: [{ k: 'k', label: 'Intensité', type: 'range', min: 1, max: 100 }, { k: 'cx', label: 'Centre X', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'cy', label: 'Centre Y', type: 'range', min: 0, max: 100, unit: '%' }], values: { k: 20, cx: 50, cy: 50 },
    render(src, v) {
      const w = src.width, h = src.height, out = MP.createCanvas(w, h), c = out.getContext('2d'), n = 32, cx = (w * v.cx) / 100, cy = (h * v.cy) / 100;
      for (let i = 0; i < n; i++) { const s = 1 + (i / n) * (v.k / 100) * 0.6; c.globalAlpha = 1 / (i + 1); c.setTransform(s, 0, 0, s, cx - cx * s, cy - cy * s); c.drawImage(src, 0, 0); }
      return out;
    },
  },
  tiltShift: {
    title: 'Tilt-shift (effet miniature)', fields: [{ k: 'pos', label: 'Position de la zone nette', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'size', label: 'Hauteur de la zone nette', type: 'range', min: 2, max: 90, unit: '%' }, { k: 'r', label: 'Flou', type: 'range', min: 1, max: 60, unit: 'px' }, { k: 'sat', label: 'Saturation +', type: 'range', min: 0, max: 100, unit: '%' }], values: { pos: 55, size: 20, r: 12, sat: 30 },
    render(src, v) {
      const w = src.width, h = src.height, b = MP.blurCanvas(src, v.r), m = MP.createCanvas(w, h), mc = m.getContext('2d');
      const c0 = (v.pos / 100) * h, half = ((v.size / 100) * h) / 2, fade = h * 0.18;
      const g = mc.createLinearGradient(0, 0, 0, h); const st = (y, a) => g.addColorStop(MP.clamp(y / h, 0, 1), `rgba(0,0,0,${a})`);
      st(c0 - half - fade, 1); st(c0 - half, 0); st(c0 + half, 0); st(c0 + half + fade, 1); mc.fillStyle = g; mc.fillRect(0, 0, w, h);
      mc.globalCompositeOperation = 'source-in'; mc.drawImage(b, 0, 0);
      const out = MP.cloneCanvas(src), oc = out.getContext('2d'); oc.drawImage(m, 0, 0);
      if (v.sat) { const t = MP.cloneCanvas(out), tc = t.getContext('2d'); tc.clearRect(0, 0, w, h); tc.filter = `saturate(${1 + v.sat / 100}) contrast(1.05)`; tc.drawImage(out, 0, 0); return t; }
      return out;
    },
  },
  unsharp: {
    title: 'Accentuation', fields: [{ k: 'a', label: 'Gain', type: 'range', min: 1, max: 500, unit: '%' }, { k: 'r', label: 'Rayon', type: 'range', min: 0.1, max: 100, step: 0.1, unit: 'px' }, { k: 't', label: 'Seuil', type: 'range', min: 0, max: 255 }], values: { a: 100, r: 1.5, t: 0 },
    render(src, v) {
      const bl = MP.blurCanvas(src, v.r).getContext('2d').getImageData(0, 0, src.width, src.height).data, k = v.a / 100;
      return pixelOp(src, (s, d) => { for (let i = 0; i < s.length; i += 4) { for (let c = 0; c < 3; c++) { const diff = s[i + c] - bl[i + c]; d[i + c] = Math.abs(diff) >= v.t ? s[i + c] + diff * k : s[i + c]; } d[i + 3] = s[i + 3]; } });
    },
  },
  sharpen: { title: 'Plus net', render: (src) => pixelOp(src, (s, d, w, h) => conv3(s, d, w, h, [0, -1, 0, -1, 5, -1, 0, -1, 0])) },
  noise: {
    title: 'Ajout de bruit', fields: [{ k: 'a', label: 'Quantité', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'mono', label: 'Monochromatique', type: 'check' }], values: { a: 12, mono: true },
    render(src, v) { const A = v.a * 2.2; return pixelOp(src, (s, d) => { for (let i = 0; i < s.length; i += 4) { const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * A; const n = g(); d[i] = s[i] + n; d[i + 1] = s[i + 1] + (v.mono ? n : g()); d[i + 2] = s[i + 2] + (v.mono ? n : g()); d[i + 3] = s[i + 3]; } }); },
  },
  median: {
    title: 'Médiane (réduction du bruit)', heavy: true, fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 1, max: 4, unit: 'px' }], values: { r: 1 },
    render(src, v) {
      const R = v.r;
      return pixelOp(src, (s, d, w, h) => {
        const buf = [[], [], []];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          buf[0].length = buf[1].length = buf[2].length = 0;
          for (let j = -R; j <= R; j++) for (let q = -R; q <= R; q++) { const o = (MP.clamp(y + j, 0, h - 1) * w + MP.clamp(x + q, 0, w - 1)) * 4; buf[0].push(s[o]); buf[1].push(s[o + 1]); buf[2].push(s[o + 2]); }
          const i = (y * w + x) * 4, m = buf[0].length >> 1;
          for (let c = 0; c < 3; c++) d[i + c] = buf[c].sort((a, b) => a - b)[m];
          d[i + 3] = s[i + 3];
        }
      });
    },
  },
  pixelate: {
    title: 'Mosaïque', fields: [{ k: 's', label: 'Taille des cellules', type: 'range', min: 2, max: 200, unit: 'px' }], values: { s: 12 },
    render(src, v) { const w = src.width, h = src.height, sw = Math.max(1, Math.ceil(w / v.s)), sh = Math.max(1, Math.ceil(h / v.s)), sm = MP.createCanvas(sw, sh), sc = sm.getContext('2d'); sc.imageSmoothingQuality = 'medium'; sc.drawImage(src, 0, 0, sw, sh); const out = MP.createCanvas(w, h), oc = out.getContext('2d'); oc.imageSmoothingEnabled = false; oc.drawImage(sm, 0, 0, sw * v.s, sh * v.s); return out; },
  },
  emboss: {
    title: 'Estampage', fields: [{ k: 'a', label: 'Angle', type: 'range', min: -180, max: 180, unit: '°' }, { k: 'k', label: 'Gain', type: 'range', min: 1, max: 500, unit: '%' }], values: { a: 135, k: 100 },
    render(src, v) { const r = (v.a * Math.PI) / 180, dx = Math.round(Math.cos(r)), dy = Math.round(-Math.sin(r)), k = v.k / 100, K = [0, 0, 0, 0, 0, 0, 0, 0, 0]; K[(1 - dy) * 3 + 1 - dx] = -k; K[(1 + dy) * 3 + 1 + dx] = k; K[4] = 0; return pixelOp(src, (s, d, w, h) => conv3(s, d, w, h, K, 128, true)); },
  },
  edges: {
    title: 'Contours (Sobel)', fields: [{ k: 'inv', label: 'Tracé sur fond blanc', type: 'check' }], values: { inv: true },
    render(src, v) {
      return pixelOp(src, (s, d, w, h) => {
        const L = new Float32Array(w * h); for (let p = 0; p < w * h; p++) L[p] = lum(s[p * 4], s[p * 4 + 1], s[p * 4 + 2]);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const g = (X, Y) => L[MP.clamp(Y, 0, h - 1) * w + MP.clamp(X, 0, w - 1)];
          const gx = -g(x - 1, y - 1) - 2 * g(x - 1, y) - g(x - 1, y + 1) + g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1);
          const gy = -g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1) + g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1);
          let m = Math.min(255, Math.hypot(gx, gy)); if (v.inv) m = 255 - m; const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = m; d[i + 3] = s[i + 3];
        }
      });
    },
  },
  glow: {
    title: 'Lueur douce (effet Orton)', fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 1, max: 100, unit: 'px' }, { k: 'k', label: 'Intensité', type: 'range', min: 0, max: 100, unit: '%' }], values: { r: 12, k: 50 },
    render(src, v) { const b = MP.blurCanvas(src, v.r), out = MP.cloneCanvas(src), c = out.getContext('2d'); c.globalAlpha = v.k / 100; c.globalCompositeOperation = 'screen'; c.drawImage(b, 0, 0); c.globalCompositeOperation = 'destination-in'; c.globalAlpha = 1; c.drawImage(src, 0, 0); return out; },
  },
  vignette: {
    title: 'Vignettage', fields: [{ k: 'k', label: 'Quantité', type: 'range', min: -100, max: 100 }, { k: 's', label: 'Taille', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'f', label: 'Douceur', type: 'range', min: 1, max: 100, unit: '%' }], values: { k: 60, s: 50, f: 60 },
    render(src, v) {
      const w = src.width, h = src.height, out = MP.cloneCanvas(src), c = out.getContext('2d'), R = Math.hypot(w, h) / 2, inner = R * (0.2 + (v.s / 100) * 0.7);
      const g = c.createRadialGradient(w / 2, h / 2, inner * (1 - v.f / 100), w / 2, h / 2, Math.max(inner + 1, R * (0.5 + v.f / 200)));
      const col = v.k >= 0 ? '0,0,0' : '255,255,255'; g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${Math.abs(v.k) / 100})`);
      c.globalCompositeOperation = 'source-atop'; c.fillStyle = g; c.fillRect(0, 0, w, h); return out;
    },
  },
  twirl: {
    title: 'Tourbillon', fields: [{ k: 'a', label: 'Angle', type: 'range', min: -999, max: 999, unit: '°' }], values: { a: 120 },
    render(src, v) { const w = src.width, h = src.height, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, A = (v.a * Math.PI) / 180; return remap(src, (x, y) => { const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); if (r >= R) return [x, y]; const t = A * Math.pow(1 - r / R, 2), c = Math.cos(t), s = Math.sin(t); return [cx + dx * c - dy * s, cy + dx * s + dy * c]; }); },
  },
  spherize: {
    title: 'Sphérisation', fields: [{ k: 'k', label: 'Quantité', type: 'range', min: -100, max: 100, unit: '%' }], values: { k: 60 },
    render(src, v) { const w = src.width, h = src.height, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, k = v.k / 100; return remap(src, (x, y) => { const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) / R; if (r >= 1 || r === 0) return [x, y]; const nr = k >= 0 ? Math.pow(r, 1 + k * 0.8) : Math.pow(r, 1 / (1 - k * 0.8)); const f = nr / r; return [cx + dx * f, cy + dy * f]; }); },
  },
  wave: {
    title: 'Ondulation', fields: [{ k: 'a', label: 'Amplitude', type: 'range', min: 1, max: 100, unit: 'px' }, { k: 'l', label: 'Longueur d\'onde', type: 'range', min: 4, max: 500, unit: 'px' }, { k: 'dir', label: 'Direction', type: 'select', options: [['h', 'Horizontale'], ['v', 'Verticale'], ['both', 'Les deux']] }], values: { a: 10, l: 80, dir: 'both' },
    render(src, v) { const k = (Math.PI * 2) / v.l; return remap(src, (x, y) => [x + (v.dir !== 'v' ? Math.sin(y * k) * v.a : 0), y + (v.dir !== 'h' ? Math.sin(x * k) * v.a : 0)]); },
  },
  clouds: {
    title: 'Nuages (couleurs 1er plan / arrière-plan)', fields: [{ k: 's', label: 'Échelle', type: 'range', min: 10, max: 1000, unit: 'px' }, { k: 'seed', label: 'Variation', type: 'range', min: 1, max: 999 }], values: { s: 200, seed: 7 },
    render(src, v) {
      const A = MP.hexToRgb(MP.colors.fg), B = MP.hexToRgb(MP.colors.bg);
      return pixelOp(src, (s, d, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let n = 0, amp = 0.5, f = 1 / v.s; for (let o = 0; o < 6; o++) { n += vnoise(x * f, y * f, v.seed + o) * amp; amp /= 2; f *= 2; } const i = (y * w + x) * 4; d[i] = MP.lerp(A.r, B.r, n); d[i + 1] = MP.lerp(A.g, B.g, n); d[i + 2] = MP.lerp(A.b, B.b, n); d[i + 3] = 255; } });
    },
  },
  oil: {
    title: 'Peinture à l\'huile', heavy: true, fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 1, max: 6, unit: 'px' }, { k: 'lv', label: 'Niveaux', type: 'range', min: 5, max: 40 }], values: { r: 3, lv: 20 },
    render(src, v) {
      return pixelOp(src, (s, d, w, h) => {
        const L = v.lv, cnt = new Uint32Array(L), sr = new Float32Array(L), sg = new Float32Array(L), sb = new Float32Array(L);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          cnt.fill(0); sr.fill(0); sg.fill(0); sb.fill(0);
          for (let j = -v.r; j <= v.r; j++) for (let q = -v.r; q <= v.r; q++) { const o = (MP.clamp(y + j, 0, h - 1) * w + MP.clamp(x + q, 0, w - 1)) * 4, b = Math.min(L - 1, ((s[o] + s[o + 1] + s[o + 2]) / 3 / 256) * L | 0); cnt[b]++; sr[b] += s[o]; sg[b] += s[o + 1]; sb[b] += s[o + 2]; }
          let m = 0; for (let b = 1; b < L; b++) if (cnt[b] > cnt[m]) m = b;
          const i = (y * w + x) * 4; d[i] = sr[m] / cnt[m]; d[i + 1] = sg[m] / cnt[m]; d[i + 2] = sb[m] / cnt[m]; d[i + 3] = s[i + 3];
        }
      });
    },
  },
  halftone: {
    title: 'Demi-teintes (trame)', fields: [{ k: 's', label: 'Taille de trame', type: 'range', min: 3, max: 60, unit: 'px' }], values: { s: 8 },
    render(src, v) {
      const w = src.width, h = src.height, data = src.getContext('2d').getImageData(0, 0, w, h).data, out = MP.createCanvas(w, h), c = out.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#000';
      for (let y = 0; y < h; y += v.s) for (let x = 0; x < w; x += v.s) { const i = (Math.min(h - 1, Math.round(y + v.s / 2)) * w + Math.min(w - 1, Math.round(x + v.s / 2))) * 4, l = 1 - lum(data[i], data[i + 1], data[i + 2]) / 255; if (l <= 0.02) continue; c.beginPath(); c.arc(x + v.s / 2, y + v.s / 2, (v.s / 2) * Math.sqrt(l) * 1.25, 0, 7); c.fill(); }
      return out;
    },
  },
};

/* ---------- Exécution des réglages / filtres avec aperçu ---------- */
MP.runAdjust = (key, isFilter) => {
  const d = MP.doc; if (!d || !MP.canEditPixels()) return;
  const spec = (isFilter ? MP.FILTERS : MP.ADJUST)[key]; if (!spec) return;
  const l = d.layer, orig = l.canvas, w = orig.width, h = orig.height;
  let srcData = null, blurCache = null;
  const compute = (vals) => {
    let out;
    if (spec.render) out = spec.render(orig, vals);
    else {
      srcData = srcData || orig.getContext('2d').getImageData(0, 0, w, h).data;
      let blur = null;
      if (spec.needsBlur) { const r = spec.needsBlur(vals); if (!blurCache || blurCache.r !== r) blurCache = { r, data: MP.blurCanvas(orig, r).getContext('2d').getImageData(0, 0, w, h).data }; blur = blurCache.data; }
      out = MP.createCanvas(w, h); const oc = out.getContext('2d'), id = oc.createImageData(w, h);
      Object.defineProperty(vals, '__w', { value: w, configurable: true, enumerable: false, writable: true });
      spec.pixel(srcData, id.data, vals, blur); oc.putImageData(id, 0, 0);
    }
    return MP.maskedResult(orig, out);
  };
  const commit = (res) => { l._preview = null; d.history.record(spec.title, [l.id]); MP.rasterize(l); l.canvas = res; MP.afterEdit(); };
  if (!spec.fields) { MP.busy(spec.title + '…', () => commit(compute({}))); return; }
  const vals = JSON.parse(JSON.stringify(spec.values));
  let last = null;
  MP.ui.dialog({
    title: spec.title, fields: spec.fields, values: vals, preview: true, spec, orig,
    onChange: (v) => { last = compute(v); l._preview = last; MP.render(); },
    onOk: (v) => { const res = last || compute(v); commit(res); },
    onCancel: () => { l._preview = null; MP.render(); },
  });
};

/* ---------- Opérations Image ---------- */
MP.resizeImage = (w, h, quality = 'high') => {
  const d = MP.doc; w = Math.round(w); h = Math.round(h); if (w < 1 || h < 1) return;
  d.history.record('Taille de l\'image', 'all');
  const sx = w / d.width, sy = h / d.height;
  const scale = (cv) => {
    if (quality === 'details') { const o = MP.lanczos(cv, w, h); return sx > 1.05 || sy > 1.05 ? MP.FILTERS.unsharp.render(o, { a: 35, r: 1, t: 2 }) : o; }
    // réduction progressive pour une meilleure qualité
    let cur = cv, cw = cv.width, ch = cv.height;
    while (quality === 'high' && (cw / 2 > w || ch / 2 > h)) { cw = Math.max(w, Math.round(cw / 2)); ch = Math.max(h, Math.round(ch / 2)); const t = MP.createCanvas(cw, ch), tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(cur, 0, 0, cw, ch); cur = t; }
    const o = MP.createCanvas(w, h), oc = o.getContext('2d'); oc.imageSmoothingEnabled = quality !== 'nearest'; oc.imageSmoothingQuality = 'high'; oc.drawImage(cur, 0, 0, w, h); return o;
  };
  for (const l of d.layers) { if (!l.isGroup && !l.adjust) l.canvas = scale(l.canvas); if (l.mask) l.mask = scale(l.mask); if (l.text) { l.text.x *= sx; l.text.y *= sy; l.text.size = Math.max(1, l.text.size * Math.min(sx, sy)); } }
  d.width = w; d.height = h; d.resizeBuffers(); MP.sel.none(d);
  d.layers.forEach((l) => l.text && MP.renderText(l));
  MP.view.fit(); MP.ui.refreshAll(); MP.render();
};
MP.canvasSize = (w, h, ax, ay, fill) => {
  const d = MP.doc; w = Math.round(w); h = Math.round(h); if (w < 1 || h < 1) return;
  d.history.record('Taille de la zone de travail', 'all');
  const ox = Math.round((w - d.width) * ax), oy = Math.round((h - d.height) * ay);
  d.layers.forEach((l, i) => {
    if (l.isGroup || l.adjust) { if (l.mask) { const m = MP.createCanvas(w, h), mc = m.getContext('2d'); mc.fillStyle = '#fff'; mc.fillRect(0, 0, w, h); mc.clearRect(ox, oy, d.width, d.height); mc.drawImage(l.mask, ox, oy); l.mask = m; } return; }
    const c = MP.createCanvas(w, h), cc = c.getContext('2d');
    if (i === 0 && fill && fill !== 'transparent') { cc.fillStyle = fill; cc.fillRect(0, 0, w, h); }
    cc.drawImage(l.canvas, ox, oy); l.canvas = c;
    if (l.mask) { const m = MP.createCanvas(w, h), mc = m.getContext('2d'); mc.fillStyle = '#fff'; mc.fillRect(0, 0, w, h); mc.clearRect(ox, oy, d.width, d.height); mc.drawImage(l.mask, ox, oy); l.mask = m; }
    if (l.text) { l.text.x += ox; l.text.y += oy; MP.renderText(l); }
  });
  d.width = w; d.height = h; d.resizeBuffers(); MP.sel.none(d); MP.view.fit(); MP.ui.refreshAll(); MP.render();
};
MP.rotateImage = (deg) => {
  const d = MP.doc, rad = (deg * Math.PI) / 180, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  const W = Math.round(d.width * c + d.height * s), H = Math.round(d.width * s + d.height * c);
  d.history.record('Rotation de l\'image', 'all');
  const rot = (cv, fillWhite) => { const o = MP.createCanvas(W, H), oc = o.getContext('2d'); if (fillWhite) { oc.fillStyle = '#fff'; oc.fillRect(0, 0, W, H); oc.globalCompositeOperation = 'destination-out'; } oc.translate(W / 2, H / 2); oc.rotate(rad); oc.drawImage(cv, -d.width / 2, -d.height / 2); return o; };
  for (const l of d.layers) { if (!l.isGroup && !l.adjust) l.canvas = rot(l.canvas); if (l.mask) { const m = rot(l.mask); l.mask = m; } l.text = null; }
  d.width = W; d.height = H; d.resizeBuffers(); MP.sel.none(d); MP.view.fit(); MP.ui.refreshAll(); MP.render();
};
MP.flipImage = (horizontal, layerOnly) => {
  const d = MP.doc; const targets = layerOnly ? [d.layer] : d.layers;
  if (layerOnly && !MP.canEditPixels()) return;
  d.history.record(horizontal ? 'Symétrie horizontale' : 'Symétrie verticale', layerOnly ? [d.layer.id] : 'all');
  const flip = (cv) => { const o = MP.createCanvas(cv.width, cv.height), oc = o.getContext('2d'); oc.translate(horizontal ? cv.width : 0, horizontal ? 0 : cv.height); oc.scale(horizontal ? -1 : 1, horizontal ? 1 : -1); oc.drawImage(cv, 0, 0); return o; };
  for (const l of targets) { if (!l.isGroup && !l.adjust) l.canvas = flip(l.canvas); if (l.mask) l.mask = flip(l.mask); l.text = null; }
  if (!layerOnly && d.selection) { d.selection = flip(d.selection); MP.sel.updatePath(d); }
  MP.afterEdit();
};
MP.trimImage = () => {
  const d = MP.doc, b = MP.alphaBounds(d.composite(null, { noLive: true }), 0);
  if (!b) { MP.toast('Image entièrement transparente'); return; }
  MP.cropDoc(b.x, b.y, b.w, b.h);
};

/* ---------- Opérations Calques ---------- */
MP.layerOps = {
  add() { const d = MP.doc; d.history.record('Nouveau calque', null); d.addLayer(); MP.afterEdit(); },
  cloneLayer(s, parent) {
    const d = MP.doc, l = new MP.Layer(d.width, d.height, s.name);
    Object.assign(l, s.props()); l.parent = parent; l.name = s.name;
    l.canvas = MP.cloneCanvas(s.canvas); if (s.mask) l.mask = MP.cloneCanvas(s.mask);
    return l;
  },
  duplicate() {
    const d = MP.doc, s = d.layer; d.history.record('Dupliquer le calque', null);
    const copy = this.cloneLayer(s, s.parent); copy.name = s.name + ' copie';
    const extra = [];
    if (s.isGroup) { const map = new Map([[s.id, copy.id]]); for (const c of d.descendants(s)) { const n = this.cloneLayer(c, map.get(c.parent)); map.set(c.id, n.id); extra.push(n); } }
    const i = d.layers.indexOf(s); d.layers.splice(i + 1, 0, ...extra, copy); d.normalize(); d.active = d.layers.indexOf(copy); d.editMask = false; MP.afterEdit();
  },
  remove() {
    const d = MP.doc, l = d.layer;
    const gone = new Set([l, ...(l.isGroup ? d.descendants(l) : [])]);
    if (d.layers.length - gone.size < 1) { MP.toast('Le document doit contenir au moins un calque'); return; }
    d.history.record('Supprimer le calque', null);
    const i = d.active; d.layers = d.layers.filter((x) => !gone.has(x)); d.active = MP.clamp(i - gone.size, 0, d.layers.length - 1); d.editMask = false; MP.afterEdit();
  },
  /** Déplace le calque (et son contenu s'il s'agit d'un groupe) parmi ses voisins. */
  move(dir) {
    const d = MP.doc, l = d.layer, sib = d.children(l.parent), i = sib.indexOf(l), j = i + dir;
    if (j < 0 || j >= sib.length) {
      if (dir > 0 && l.parent) { const g = d.byId(l.parent); return this.place(l, g, 'above'); } // sortir du groupe
      return;
    }
    this.place(l, sib[j], dir > 0 ? 'above' : 'below');
  },
  /** Place src au-dessus / en dessous de target, ou dans le groupe target ('into'). */
  place(src, target, mode) {
    const d = MP.doc; if (!target || src === target) return;
    if (src.isGroup && (target === src || d.descendants(src).includes(target))) return;
    d.history.record('Ordre des calques', null);
    const block = src.isGroup ? [...d.descendants(src), src] : [src];
    d.layers = d.layers.filter((x) => !block.includes(x));
    let idx;
    if (mode === 'into') { src.parent = target.id; target.collapsed = false; idx = d.layers.indexOf(target); }
    else { src.parent = target.parent || null; const tb = target.isGroup && mode === 'below' ? d.descendants(target) : []; idx = mode === 'above' ? d.layers.indexOf(target) + 1 : d.layers.indexOf(tb[0] || target); }
    d.layers.splice(idx, 0, ...block); d.normalize(); d.active = d.layers.indexOf(src); MP.afterEdit();
  },
  toTop() { const d = MP.doc, l = d.layer, sib = d.children(l.parent); if (sib.at(-1) !== l) this.place(l, sib.at(-1), 'above'); },
  toBottom() { const d = MP.doc, l = d.layer, sib = d.children(l.parent); if (sib[0] !== l) this.place(l, sib[0], 'below'); },
  /** Pixels finaux d'un calque (masque + styles), ou rendu d'un groupe. */
  bake(l) {
    const d = MP.doc;
    if (l.isGroup) {
      const c = MP.createCanvas(d.width, d.height), x = c.getContext('2d'); d.compositeChildren(x, l.id, { noLive: true }, 10);
      if (l.mask && l.maskEnabled) { x.globalCompositeOperation = 'destination-in'; x.drawImage(l.mask, 0, 0); }
      return c;
    }
    if (l.adjust) return MP.createCanvas(d.width, d.height);
    let src = MP.cloneCanvas(d.layerStatic(l));
    if (MP.fx.has(l)) src = MP.cloneCanvas(MP.fx.render(d, l, src));
    return src;
  },
  newGroup(fromActive) {
    const d = MP.doc, l = d.layer; d.history.record(fromActive ? 'Grouper les calques' : 'Nouveau groupe', null);
    const g = new MP.Layer(1, 1, 'Groupe ' + (d.layers.filter((x) => x.isGroup).length + 1)); g.isGroup = true; g.blend = 'pass-through';
    g.parent = l ? l.parent : null;
    const i = l ? d.layers.indexOf(l) : d.layers.length - 1;
    d.layers.splice(i + 1, 0, g);
    if (fromActive && l) l.parent = g.id;
    d.normalize(); d.active = d.layers.indexOf(g); d.editMask = false; MP.afterEdit();
  },
  ungroup() {
    const d = MP.doc, g = d.layer; if (!g.isGroup) { MP.toast('Sélectionnez un groupe'); return; }
    d.history.record('Dissocier le groupe', null);
    for (const c of d.children(g.id)) c.parent = g.parent;
    d.layers = d.layers.filter((x) => x !== g); d.normalize(); d.active = MP.clamp(d.active, 0, d.layers.length - 1); MP.afterEdit();
  },
  mergeGroup() {
    const d = MP.doc, g = d.layer; if (!g.isGroup) return;
    d.history.record('Fusionner le groupe', null);
    const l = new MP.Layer(d.width, d.height, g.name); l.canvas = this.bake(g); l.parent = g.parent;
    l.opacity = g.opacity; l.blend = g.blend === 'pass-through' ? 'source-over' : g.blend; l.visible = g.visible;
    const gone = new Set([g, ...d.descendants(g)]), i = d.layers.indexOf(g);
    d.layers.splice(i, 1, l); d.layers = d.layers.filter((x) => !gone.has(x)); d.normalize(); d.active = d.layers.indexOf(l); MP.afterEdit();
  },
  mergeDown() {
    const d = MP.doc, top = d.layer;
    if (top.isGroup) return this.mergeGroup();
    const sib = d.children(top.parent), bot = sib[sib.indexOf(top) - 1];
    if (!bot) { MP.toast('Aucun calque en dessous dans ce niveau'); return; }
    if (bot.isGroup || bot.adjust || top.adjust) { MP.toast('Fusion impossible avec un groupe ou un calque de réglage — utilisez « Fusionner les calques visibles »'); return; }
    d.history.record('Fusionner vers le bas', [top.id, bot.id]);
    const bc = MP.createCanvas(d.width, d.height), c = bc.getContext('2d');
    c.drawImage(this.bake(bot), 0, 0); if (top.visible) { c.globalAlpha = top.opacity; c.globalCompositeOperation = top.blend; c.drawImage(this.bake(top), 0, 0); }
    bot.canvas = bc; bot.mask = null; bot.text = null; bot.fx = null;
    d.layers.splice(d.layers.indexOf(top), 1); d.active = d.layers.indexOf(bot); d.editMask = false; MP.afterEdit();
  },
  mergeVisible() {
    const d = MP.doc; d.history.record('Fusionner les calques visibles', 'all');
    const merged = MP.cloneCanvas(d.composite(null, { noLive: true }));
    const l = new MP.Layer(d.width, d.height, 'Fusion'); l.canvas = merged;
    const keep = d.layers.filter((x) => !x.visible && !x.isGroup); keep.forEach((x) => (x.parent = null));
    d.layers = [...keep, l]; d.active = d.layers.length - 1; d.editMask = false; MP.afterEdit();
  },
  flatten() {
    const d = MP.doc; d.history.record('Aplatir l\'image', 'all');
    const c = MP.createCanvas(d.width, d.height), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, d.width, d.height); x.drawImage(d.composite(null, { noLive: true }), 0, 0);
    const l = new MP.Layer(d.width, d.height, 'Arrière-plan'); l.canvas = c; d.layers = [l]; d.active = 0; d.editMask = false; MP.afterEdit();
  },
  addMask(fromSel, hideAll) {
    const d = MP.doc, l = d.layer; if (l.mask) { MP.toast('Ce calque a déjà un masque'); return; }
    d.history.record('Ajouter un masque', [l.id]);
    const m = MP.createCanvas(d.width, d.height), c = m.getContext('2d'); c.fillStyle = '#fff';
    if (fromSel && d.selection) c.drawImage(d.selection, 0, 0); else if (!hideAll) c.fillRect(0, 0, d.width, d.height);
    l.mask = m; l.maskEnabled = true; d.editMask = true; if (fromSel) MP.sel.none(d); MP.afterEdit();
  },
  applyMask() { const d = MP.doc, l = d.layer; if (!l.mask || l.isGroup || l.adjust) return; d.history.record('Appliquer le masque', [l.id]); l.canvas = MP.cloneCanvas(d.layerStatic(l)); l.mask = null; d.editMask = false; MP.afterEdit(); },
  deleteMask() { const d = MP.doc, l = d.layer; if (!l.mask) return; d.history.record('Supprimer le masque', [l.id]); l.mask = null; d.editMask = false; MP.afterEdit(); },
  toggleMask() { const d = MP.doc, l = d.layer; if (!l.mask) return; d.history.record('Activer/désactiver le masque', null); l.maskEnabled = !l.maskEnabled; MP.afterEdit(); },
  invertMask() { const d = MP.doc, l = d.layer; if (!l.mask) return; d.history.record('Inverser le masque', [l.id]); const m = MP.createCanvas(d.width, d.height), c = m.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, d.width, d.height); c.globalCompositeOperation = 'destination-out'; c.drawImage(l.mask, 0, 0); l.mask = m; MP.afterEdit(); },
  rasterize() {
    const d = MP.doc, l = d.layer;
    if (l.text) { d.history.record('Pixelliser le texte', null); l.text = null; MP.afterEdit(); return; }
    if (MP.fx.has(l)) return this.bakeStyle();
  },
  bakeStyle() { const d = MP.doc, l = d.layer; if (!MP.fx.has(l)) return; d.history.record('Pixelliser le style', [l.id]); const m = l.mask; l.mask = null; l.canvas = this.bake(l); l.mask = m; l.fx = null; l.text = null; MP.afterEdit(); },
  clearStyle() { const d = MP.doc, l = d.layer; if (!l.fx) return; d.history.record('Effacer le style', null); l.fx = null; MP.afterEdit(); },
  addAdjust(key) {
    const d = MP.doc, spec = MP.ADJUST[key]; if (!spec) return;
    d.history.record('Calque de réglage ' + spec.title, null);
    const l = d.addLayer(spec.title); l.canvas = MP.createCanvas(1, 1);
    l.adjust = { key, values: JSON.parse(JSON.stringify(spec.values || {})) };
    const m = MP.createCanvas(d.width, d.height), mc = m.getContext('2d'); mc.fillStyle = '#fff';
    if (d.selection) mc.drawImage(d.selection, 0, 0); else mc.fillRect(0, 0, d.width, d.height);
    l.mask = m; d.editMask = true; MP.afterEdit();
    if (spec.fields) MP.ui.editAdjustLayer(l, true);
  },
  /** Ancien style « appliqué » (conservé pour compatibilité) */
  styleCanvas(src, kind, v) {
    const d = MP.doc, l = { id: 'tmp', fx: MP.fx.defaults() };
    Object.assign(l.fx[kind === 'shadow' ? 'shadow' : kind === 'stroke' ? 'stroke' : 'glow'], v, { on: true });
    return MP.cloneCanvas(MP.fx.render(d, l, src));
  },
  style(kind, v) {
    const d = MP.doc, l = d.layer; if (!MP.canEditPixels()) return;
    d.history.record('Style de calque', null);
    l.fx = l.fx || MP.fx.defaults(); const k = kind === 'shadow' ? 'shadow' : kind === 'stroke' ? 'stroke' : 'glow';
    Object.assign(l.fx[k], v, { on: true }); MP.afterEdit();
  },
};

/* ---------- Édition ---------- */
MP.edit = {
  clip: null,
  copy(merged) {
    const d = MP.doc; if (!d) return;
    const src = merged ? MP.cloneCanvas(d.composite(null, { noLive: true })) : MP.layerOps.bake(d.layer);
    const b = d.selection ? MP.sel.bounds(d) : { x: 0, y: 0, w: d.width, h: d.height }; if (!b) return;
    d.clipToSelection(src);
    const c = MP.createCanvas(b.w, b.h); c.getContext('2d').drawImage(src, -b.x, -b.y);
    this.clip = { canvas: c, x: b.x, y: b.y };
    try {
      c.toBlob(async (blob) => {
        if (MP.native.writeClipboardImage) MP.native.writeClipboardImage(new Uint8Array(await blob.arrayBuffer()));
        else if (navigator.clipboard && window.ClipboardItem) navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
      });
    } catch (_) { /* presse-papiers système indisponible */ }
    MP.toast('Copié');
  },
  cut() { const d = MP.doc; if (!d || !MP.canEdit()) return; this.copy(false); this.clear('Couper'); },
  clear(label = 'Effacer') {
    const d = MP.doc; if (!MP.canEdit()) return;
    MP.recordFor(label);
    const c = MP.targetCanvas().getContext('2d');
    if (d.selection) { c.save(); c.globalCompositeOperation = 'destination-out'; c.drawImage(d.selection, 0, 0); c.restore(); } else c.clearRect(0, 0, d.width, d.height);
    MP.afterEdit();
  },
  pasteCanvas(canvas, name = 'Calque collé', x, y) {
    let d = MP.doc;
    if (!d) { d = MP.newDocument(canvas.width, canvas.height, 'Collage', 'transparent'); d.layer.ctx.drawImage(canvas, 0, 0); MP.afterEdit(); return; }
    d.history.record('Coller', null);
    const l = d.addLayer(name);
    const px = x !== undefined ? x : Math.round((d.width - canvas.width) / 2), py = y !== undefined ? y : Math.round((d.height - canvas.height) / 2);
    l.ctx.drawImage(canvas, px, py); MP.sel.none(d); MP.afterEdit();
  },
  paste() { if (this.clip) this.pasteCanvas(this.clip.canvas, 'Calque collé', this.clip.x, this.clip.y); else MP.toast('Presse-papiers vide — vous pouvez aussi coller une image avec Ctrl+V'); },
  fill(v) {
    const d = MP.doc; if (!MP.canEdit()) return;
    if (v.what === 'content') {
      if (!MP.canEditPixels()) return;
      if (!d.selection) { MP.toast('Faites d\'abord une sélection autour de l\'objet à supprimer'); return; }
      return MP.busy('Remplissage d\'après le contenu…', () => { d.history.record('Remplir d\'après le contenu', [d.layer.id]); MP.rasterize(d.layer); MP.healRegion(d.layer.canvas, MP.dilate(d.selection, 3), 24); MP.afterEdit(); });
    }
    if (v.what === 'pattern' && !MP.pattern) { MP.toast('Définissez d\'abord un motif (Édition > Définir un motif)'); return; }
    MP.recordFor('Remplir');
    const f = MP.createCanvas(d.width, d.height), fc = f.getContext('2d');
    if (v.what === 'pattern') { fc.fillStyle = fc.createPattern(MP.pattern, 'repeat'); fc.fillRect(0, 0, d.width, d.height); d.clipToSelection(f); const c = MP.targetCanvas().getContext('2d'); c.save(); c.globalAlpha = v.opacity / 100; c.globalCompositeOperation = v.blend || 'source-over'; c.drawImage(f, 0, 0); c.restore(); MP.afterEdit(); return; }
    fc.fillStyle = v.what === 'fg' ? MP.colors.fg : v.what === 'bg' ? MP.colors.bg : v.what === 'white' ? '#fff' : v.what === 'black' ? '#000' : v.what === 'gray' ? '#808080' : v.color;
    fc.fillRect(0, 0, d.width, d.height); d.clipToSelection(f);
    const c = MP.targetCanvas().getContext('2d'); c.save(); c.globalAlpha = v.opacity / 100; c.globalCompositeOperation = (v.blend || 'source-over') === 'source-over' && MP.target() === 'layer' && d.layer.lockAlpha ? 'source-atop' : v.blend || 'source-over'; c.drawImage(f, 0, 0); c.restore(); MP.afterEdit();
  },
  strokeSel(v) {
    const d = MP.doc; if (!d.selPath) { MP.toast('Aucune sélection'); return; } if (!MP.canEditPixels()) return;
    d.history.record('Contour de la sélection', [d.layer.id]); MP.rasterize(d.layer);
    // contour = dilatation (ou érosion) de la sélection moins la sélection d'origine
    const m = d.selection, w = +v.width;
    const grow = (src, r) => { const t = MP.createCanvas(d.width, d.height), tc = t.getContext('2d'); for (let a = 0; a < 24; a++) tc.drawImage(src, Math.cos((a * Math.PI) / 12) * r, Math.sin((a * Math.PI) / 12) * r); tc.drawImage(src, 0, 0); return t; };
    const ring = MP.createCanvas(d.width, d.height), rc = ring.getContext('2d');
    if (v.pos === 'outside') { rc.drawImage(grow(m, w), 0, 0); rc.globalCompositeOperation = 'destination-out'; rc.drawImage(m, 0, 0); }
    else if (v.pos === 'inside') { const inv = MP.createCanvas(d.width, d.height), ic = inv.getContext('2d'); ic.fillStyle = '#fff'; ic.fillRect(0, 0, d.width, d.height); ic.globalCompositeOperation = 'destination-out'; ic.drawImage(m, 0, 0); rc.drawImage(grow(inv, w), 0, 0); rc.globalCompositeOperation = 'destination-in'; rc.drawImage(m, 0, 0); }
    else { rc.drawImage(grow(m, w / 2), 0, 0); const inv = MP.createCanvas(d.width, d.height), ic = inv.getContext('2d'); ic.fillStyle = '#fff'; ic.fillRect(0, 0, d.width, d.height); ic.globalCompositeOperation = 'destination-out'; ic.drawImage(m, 0, 0); const g2 = grow(inv, w / 2), c2 = MP.createCanvas(d.width, d.height), x2 = c2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, d.width, d.height); x2.globalCompositeOperation = 'destination-out'; x2.drawImage(g2, 0, 0); rc.globalCompositeOperation = 'destination-out'; rc.drawImage(c2, 0, 0); }
    rc.globalCompositeOperation = 'source-in'; rc.fillStyle = v.color; rc.fillRect(0, 0, d.width, d.height);
    const c = d.layer.ctx; c.save(); c.globalAlpha = v.opacity / 100; c.drawImage(ring, 0, 0); c.restore(); MP.afterEdit();
  },
};
