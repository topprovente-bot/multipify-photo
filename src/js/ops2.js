'use strict';
/* v3 — Réglages Photoshop 2026 (Lumière, Couleur et vibrance, Clarté/Brume, Grain…), Camera Raw, galerie de filtres, filtres supplémentaires */
{
  const lum = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;
  const C = MP.clamp;
  const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 982451653) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) & 0xffff) / 0xffff; };
  const smooth = (e0, e1, x) => { const t = C((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  /* ---- courbe tonale « Lumière » (exposition, contraste, hautes lumières, ombres, blancs, noirs) ---- */
  const lightLUT = (v) => {
    const L = new Uint8ClampedArray(256), ex = Math.pow(2, (v.exposure || 0) / 100 * 2), ct = (v.contrast || 0) / 100;
    for (let i = 0; i < 256; i++) {
      let x = (i / 255) * ex;
      x = x + ct * (x - 0.5) * (1 - Math.abs(2 * x - 1)) * 1.4;
      x += ((v.highlights || 0) / 100) * 0.35 * smooth(0.45, 1, x) * (1 - x * 0.5);
      x += ((v.shadows || 0) / 100) * 0.35 * (1 - smooth(0, 0.55, x)) * (0.5 + x);
      x += ((v.whites || 0) / 100) * 0.2 * smooth(0.7, 1, x);
      x += ((v.blacks || 0) / 100) * 0.2 * (1 - smooth(0, 0.3, x));
      L[i] = C(x, 0, 1) * 255;
    }
    return L;
  };
  const wbVib = (s, d, v) => {
    const t = (v.temp || 0) / 100, ti = (v.tint || 0) / 100, vib = (v.vibrance || 0) / 100, sat = (v.saturation || 0) / 100;
    for (let i = 0; i < s.length; i += 4) {
      let r = s[i] * (1 + t * 0.18), g = s[i + 1] * (1 - ti * 0.15), b = s[i + 2] * (1 - t * 0.18);
      if (vib || sat) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), st = (mx - mn) / 255, y = lum(r, g, b), k = (1 + sat) * (1 + vib * (1 - st) * 1.2); r = y + (r - y) * k; g = y + (g - y) * k; b = y + (b - y) * k; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = s[i + 3];
    }
  };
  const clarityDehaze = (s, d, v, blur) => {
    const k = (v.clarity || 0) / 100, h = (v.dehaze || 0) / 100;
    for (let i = 0; i < s.length; i += 4) {
      const y = lum(s[i], s[i + 1], s[i + 2]) / 255, mid = 1 - Math.pow(2 * y - 1, 2);
      const haze = Math.min(blur[i], blur[i + 1], blur[i + 2]) / 255;
      for (let c = 0; c < 3; c++) {
        let x = s[i + c] + (s[i + c] - blur[i + c]) * k * 1.6 * mid;
        if (h > 0) { const a = h * 0.85 * haze; x = (x - a * 235) / Math.max(0.15, 1 - a); }
        else if (h < 0) x = x + (220 - x) * -h * 0.45;
        d[i + c] = x;
      }
      d[i + 3] = s[i + 3];
    }
  };
  const grain = (s, d, v) => {
    const a = (v.amount || 0) * 0.9, sz = Math.max(1, v.size || 1), w = v.__w || 1, rough = (v.rough == null ? 50 : v.rough) / 100;
    for (let p = 0, i = 0; i < s.length; i += 4, p++) {
      const x = p % w, y = (p / w) | 0, gx = Math.floor(x / sz), gy = Math.floor(y / sz);
      let n = hash(gx, gy, 7) - 0.5; if (rough < 1) n = n * rough + (hash(gx >> 1, gy >> 1, 9) - 0.5) * (1 - rough);
      const y0 = lum(s[i], s[i + 1], s[i + 2]) / 255, m = 1 - Math.pow(2 * y0 - 1, 4) * 0.6, g = n * a * m;
      d[i] = s[i] + g; d[i + 1] = s[i + 1] + g; d[i + 2] = s[i + 2] + g; d[i + 3] = s[i + 3];
    }
  };
  const LUTS = {
    warm: (r, g, b) => [r * 1.08 + 6, g * 1.02 + 2, b * 0.9],
    cool: (r, g, b) => [r * 0.92, g * 1.0, b * 1.1 + 6],
    tealorange: (r, g, b) => { const y = lum(r, g, b) / 255; return [r + (y > 0.5 ? 18 : -10) * 1, g + (y > 0.5 ? 6 : 4), b + (y > 0.5 ? -18 : 16)]; },
    vintage: (r, g, b) => { const y = lum(r, g, b); return [r * 0.8 + y * 0.2 + 20, g * 0.8 + y * 0.2 + 10, b * 0.7 + y * 0.15 + 18]; },
    bleach: (r, g, b) => { const y = lum(r, g, b), k = 0.55; const c = (x) => (x - 128) * 1.25 + 128; return [c(r * (1 - k) + y * k), c(g * (1 - k) + y * k), c(b * (1 - k) + y * k)]; },
    noir: (r, g, b) => { const y = lum(r, g, b), v = (y - 128) * 1.5 + 118; return [v, v, v]; },
    sunset: (r, g, b) => [r * 1.12 + 10, g * 0.98 + 4, b * 0.82 + 12],
    matte: (r, g, b) => [r * 0.86 + 26, g * 0.86 + 24, b * 0.86 + 28],
    film: (r, g, b) => { const y = lum(r, g, b) / 255; return [r * 1.04 + 8 * (1 - y), g * 1.02 + 4, b * 0.95 + 14 * (1 - y)]; },
    cyber: (r, g, b) => [r * 1.05 + 20 * (b / 255), g * 0.85, b * 1.18 + 10],
  };

  Object.assign(MP.ADJUST, {
    light: { title: 'Lumière', fields: [['exposure', 'Exposition'], ['contrast', 'Contraste'], ['highlights', 'Hautes lumières'], ['shadows', 'Ombres'], ['whites', 'Blancs'], ['blacks', 'Noirs']].map(([k, l]) => ({ k, label: l, type: 'range', min: -100, max: 100 })), values: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 },
      pixel(s, d, v) { const L = lightLUT(v); for (let i = 0; i < s.length; i += 4) { d[i] = L[s[i]]; d[i + 1] = L[s[i + 1]]; d[i + 2] = L[s[i + 2]]; d[i + 3] = s[i + 3]; } } },
    colorVibrance: { title: 'Couleur et vibrance', fields: [{ k: 'temp', label: 'Température', type: 'range', min: -100, max: 100 }, { k: 'tint', label: 'Teinte (vert ↔ magenta)', type: 'range', min: -100, max: 100 }, { k: 'vibrance', label: 'Vibrance', type: 'range', min: -100, max: 100 }, { k: 'saturation', label: 'Saturation', type: 'range', min: -100, max: 100 }], values: { temp: 0, tint: 0, vibrance: 0, saturation: 0 }, pixel: wbVib },
    clarity: { title: 'Clarté et suppression de brume', fields: [{ k: 'clarity', label: 'Clarté', type: 'range', min: -100, max: 100 }, { k: 'dehaze', label: 'Suppression de brume', type: 'range', min: -100, max: 100 }], values: { clarity: 30, dehaze: 0 }, needsBlur: () => 24, pixel: clarityDehaze },
    grain: { title: 'Grain', fields: [{ k: 'amount', label: 'Quantité', type: 'range', min: 0, max: 100 }, { k: 'size', label: 'Taille', type: 'range', min: 1, max: 8 }, { k: 'rough', label: 'Rugosité', type: 'range', min: 0, max: 100 }], values: { amount: 25, size: 1, rough: 50 }, pixel: grain },
    channelMixer: {
      title: 'Mélangeur de couches', values: { rr: 100, rg: 0, rb: 0, gr: 0, gg: 100, gb: 0, br: 0, bg: 0, bb: 100, mono: false },
      fields: [{ type: 'header', label: 'Sortie Rouge' }, { k: 'rr', label: 'Rouge', type: 'range', min: -200, max: 200, unit: '%' }, { k: 'rg', label: 'Vert', type: 'range', min: -200, max: 200, unit: '%' }, { k: 'rb', label: 'Bleu', type: 'range', min: -200, max: 200, unit: '%' },
        { type: 'header', label: 'Sortie Vert' }, { k: 'gr', label: 'Rouge', type: 'range', min: -200, max: 200, unit: '%' }, { k: 'gg', label: 'Vert', type: 'range', min: -200, max: 200, unit: '%' }, { k: 'gb', label: 'Bleu', type: 'range', min: -200, max: 200, unit: '%' },
        { type: 'header', label: 'Sortie Bleu' }, { k: 'br', label: 'Rouge', type: 'range', min: -200, max: 200, unit: '%' }, { k: 'bg', label: 'Vert', type: 'range', min: -200, max: 200, unit: '%' }, { k: 'bb', label: 'Bleu', type: 'range', min: -200, max: 200, unit: '%' }, { k: 'mono', label: 'Monochrome (sortie rouge)', type: 'check' }],
      pixel(s, d, v) { for (let i = 0; i < s.length; i += 4) { const r = s[i], g = s[i + 1], b = s[i + 2], R = (r * v.rr + g * v.rg + b * v.rb) / 100; d[i] = R; d[i + 1] = v.mono ? R : (r * v.gr + g * v.gg + b * v.gb) / 100; d[i + 2] = v.mono ? R : (r * v.br + g * v.bg + b * v.bb) / 100; d[i + 3] = s[i + 3]; } },
    },
    selectiveColor: {
      title: 'Correction sélective', values: { range: 'reds', c: 0, m: 0, y: 0, k: 0 },
      fields: [{ k: 'range', label: 'Couleurs', type: 'select', options: [['reds', 'Rouges'], ['yellows', 'Jaunes'], ['greens', 'Verts'], ['cyans', 'Cyans'], ['blues', 'Bleus'], ['magentas', 'Magentas'], ['whites', 'Blancs'], ['neutrals', 'Neutres'], ['blacks', 'Noirs']] }, { k: 'c', label: 'Cyan', type: 'range', min: -100, max: 100, unit: '%' }, { k: 'm', label: 'Magenta', type: 'range', min: -100, max: 100, unit: '%' }, { k: 'y', label: 'Jaune', type: 'range', min: -100, max: 100, unit: '%' }, { k: 'k', label: 'Noir', type: 'range', min: -100, max: 100, unit: '%' }],
      pixel(s, d, v) {
        const hues = { reds: 0, yellows: 60, greens: 120, cyans: 180, blues: 240, magentas: 300 };
        for (let i = 0; i < s.length; i += 4) {
          const r = s[i], g = s[i + 1], b = s[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / 255, y = lum(r, g, b) / 255;
          let w;
          if (v.range in hues) { const h = MP.rgbToHsv(r, g, b).h; let dh = Math.abs(h - hues[v.range]); dh = Math.min(dh, 360 - dh); w = Math.max(0, 1 - dh / 60) * sat; }
          else if (v.range === 'whites') w = smooth(0.6, 1, y) * (1 - sat); else if (v.range === 'blacks') w = (1 - smooth(0, 0.4, y)) * (1 - sat); else w = (1 - Math.abs(2 * y - 1)) * (1 - sat);
          const k = (v.k / 100) * w * 255 * 0.5;
          d[i] = r - (v.c / 100) * w * 255 * 0.5 - k; d[i + 1] = g - (v.m / 100) * w * 255 * 0.5 - k; d[i + 2] = b - (v.y / 100) * w * 255 * 0.5 - k; d[i + 3] = s[i + 3];
        }
      },
    },
    colorLookup: {
      title: 'Correspondance de couleurs (LUT)', values: { lut: 'tealorange', k: 100 },
      fields: [{ k: 'lut', label: 'Préréglage', type: 'select', options: [['tealorange', 'Ciné bleu-orangé'], ['warm', 'Chaud'], ['cool', 'Froid'], ['vintage', 'Vintage'], ['bleach', 'Sans blanchiment'], ['noir', 'Noir intense'], ['sunset', 'Coucher de soleil'], ['matte', 'Mat'], ['film', 'Pellicule'], ['cyber', 'Cyberpunk']] }, { k: 'k', label: 'Intensité', type: 'range', min: 0, max: 100, unit: '%' }],
      pixel(s, d, v) { const f = LUTS[v.lut] || LUTS.warm, k = v.k / 100; for (let i = 0; i < s.length; i += 4) { const o = f(s[i], s[i + 1], s[i + 2]); d[i] = MP.lerp(s[i], o[0], k); d[i + 1] = MP.lerp(s[i + 1], o[1], k); d[i + 2] = MP.lerp(s[i + 2], o[2], k); d[i + 3] = s[i + 3]; } },
    },
    solidFill: { title: 'Couleur unie', fields: [{ k: 'c', label: 'Couleur', type: 'color' }], values: { c: '#3a6df0' }, pixel(s, d, v) { const c = MP.hexToRgb(v.c); for (let i = 0; i < s.length; i += 4) { d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = 255; } } },
    gradientFill: {
      title: 'Dégradé (remplissage)', values: { a: '#0b1d51', b: '#ff7a59', angle: 90, style: 'linear' },
      fields: [{ k: 'a', label: 'Couleur 1', type: 'color' }, { k: 'b', label: 'Couleur 2', type: 'color' }, { k: 'style', label: 'Style', type: 'select', options: [['linear', 'Linéaire'], ['radial', 'Radial']] }, { k: 'angle', label: 'Angle', type: 'range', min: -180, max: 180, unit: '°' }],
      pixel(s, d, v) {
        const w = v.__w || 1, h = (s.length / 4 / w) | 0, A = MP.hexToRgb(v.a), B = MP.hexToRgb(v.b), r = (v.angle * Math.PI) / 180, ux = Math.cos(r), uy = -Math.sin(r), L = Math.abs(ux) * w / 2 + Math.abs(uy) * h / 2 || 1, R = Math.hypot(w, h) / 2;
        for (let p = 0, i = 0; i < s.length; i += 4, p++) { const x = (p % w) - w / 2, y = ((p / w) | 0) - h / 2, t = v.style === 'radial' ? C(Math.hypot(x, y) / R, 0, 1) : C(((x * ux + y * uy) / L + 1) / 2, 0, 1); d[i] = MP.lerp(A.r, B.r, t); d[i + 1] = MP.lerp(A.g, B.g, t); d[i + 2] = MP.lerp(A.b, B.b, t); d[i + 3] = 255; }
      },
    },
    cameraRaw: {
      title: 'Filtre Camera Raw', values: { temp: 0, tint: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, clarity: 0, dehaze: 0, vibrance: 0, saturation: 0, vignette: 0, amount: 0, size: 1, rough: 50 },
      fields: [{ type: 'header', label: 'Balance des blancs' }, { k: 'temp', label: 'Température', type: 'range', min: -100, max: 100 }, { k: 'tint', label: 'Teinte', type: 'range', min: -100, max: 100 },
        { type: 'header', label: 'Lumière' }, ...['exposure:Exposition', 'contrast:Contraste', 'highlights:Hautes lumières', 'shadows:Ombres', 'whites:Blancs', 'blacks:Noirs'].map((x) => { const [k, l] = x.split(':'); return { k, label: l, type: 'range', min: -100, max: 100 }; }),
        { type: 'header', label: 'Effets' }, { k: 'clarity', label: 'Clarté', type: 'range', min: -100, max: 100 }, { k: 'dehaze', label: 'Suppression de brume', type: 'range', min: -100, max: 100 }, { k: 'vignette', label: 'Vignettage', type: 'range', min: -100, max: 100 }, { k: 'amount', label: 'Grain', type: 'range', min: 0, max: 100 },
        { type: 'header', label: 'Couleur' }, { k: 'vibrance', label: 'Vibrance', type: 'range', min: -100, max: 100 }, { k: 'saturation', label: 'Saturation', type: 'range', min: -100, max: 100 }],
      needsBlur: (v) => (v.clarity || v.dehaze ? 24 : 0),
      pixel(s, d, v, blur) {
        const t = new Uint8ClampedArray(s.length); wbVib(s, t, { temp: v.temp, tint: v.tint });
        const L = lightLUT(v); for (let i = 0; i < t.length; i += 4) { t[i] = L[t[i]]; t[i + 1] = L[t[i + 1]]; t[i + 2] = L[t[i + 2]]; }
        let u = t; if ((v.clarity || v.dehaze) && blur) { u = new Uint8ClampedArray(s.length); clarityDehaze(t, u, v, blur); }
        wbVib(u, d, { vibrance: v.vibrance, saturation: v.saturation });
        const w = v.__w || 1, h = (s.length / 4 / w) | 0;
        if (v.vignette) { const k = -v.vignette / 100; for (let p = 0, i = 0; i < d.length; i += 4, p++) { const x = (p % w) / w - 0.5, y = ((p / w) | 0) / h - 0.5, f = smooth(0.25, 0.75, Math.hypot(x, y) * 1.414) * k; for (let c = 0; c < 3; c++) d[i + c] = f > 0 ? d[i + c] * (1 - f * 0.9) : d[i + c] + (255 - d[i + c]) * -f * 0.9; } }
        if (v.amount) { const g = new Uint8ClampedArray(d); grain(g, d, v); }
        for (let i = 3; i < d.length; i += 4) d[i] = s[i];
      },
    },
  });
  MP.ADJ_LAYER_KEYS.splice(0, 0, 'light', 'colorVibrance', 'clarity', 'grain');
  MP.ADJ_LAYER_KEYS.push('channelMixer', 'selectiveColor', 'colorLookup', 'solidFill', 'gradientFill', 'cameraRaw');

  /* ---- filtres supplémentaires ---- */
  const pixelOp = (src, fn) => { const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h); const out = MP.createCanvas(w, h), oc = out.getContext('2d'), id = oc.createImageData(w, h); fn(sd.data, id.data, w, h); oc.putImageData(id, 0, 0); return out; };
  const remap = (src, fn) => pixelOp(src, (s, d, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = fn(x, y, w, h), i = (y * w + x) * 4; if (!p) continue; const fx = C(p[0], 0, w - 1.001), fy = C(p[1], 0, h - 1.001), x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, a = (y0 * w + x0) * 4, b = a + 4, c = a + w * 4, e = c + 4; for (let k = 0; k < 4; k++) d[i + k] = (s[a + k] * (1 - tx) + s[b + k] * tx) * (1 - ty) + (s[c + k] * (1 - tx) + s[e + k] * tx) * ty; } });
  const gray = (s, n) => { const g = new Float32Array(n); for (let p = 0; p < n; p++) g[p] = lum(s[p * 4], s[p * 4 + 1], s[p * 4 + 2]); return g; };
  const sobel = (g, w, h) => { const m = new Float32Array(w * h), G = (x, y) => g[C(y, 0, h - 1) * w + C(x, 0, w - 1)]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = -G(x - 1, y - 1) - 2 * G(x - 1, y) - G(x - 1, y + 1) + G(x + 1, y - 1) + 2 * G(x + 1, y) + G(x + 1, y + 1), gy = -G(x - 1, y - 1) - 2 * G(x, y - 1) - G(x + 1, y - 1) + G(x - 1, y + 1) + 2 * G(x, y + 1) + G(x + 1, y + 1); m[y * w + x] = Math.hypot(gx, gy); } return m; };
  MP.sobel = sobel; MP.grayOf = gray;
  const morph = (src, r, fn) => pixelOp(src, (s, d, w, h) => {
    const t = new Uint8ClampedArray(s.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) { let v = s[i + c]; for (let k = -r; k <= r; k++) v = fn(v, s[(y * w + C(x + k, 0, w - 1)) * 4 + c]); t[i + c] = v; } t[i + 3] = s[i + 3]; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) { let v = t[i + c]; for (let k = -r; k <= r; k++) v = fn(v, t[(C(y + k, 0, h - 1) * w + x) * 4 + c]); d[i + c] = v; } d[i + 3] = s[i + 3]; }
  });

  Object.assign(MP.FILTERS, {
    iris: { title: 'Flou de diaphragme', fields: [{ k: 'cx', label: 'Centre X', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'cy', label: 'Centre Y', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'r', label: 'Zone nette', type: 'range', min: 2, max: 100, unit: '%' }, { k: 'b', label: 'Flou', type: 'range', min: 1, max: 80, unit: 'px' }], values: { cx: 50, cy: 50, r: 30, b: 14 },
      render(src, v) { const w = src.width, h = src.height, bl = MP.blurCanvas(src, v.b), m = MP.createCanvas(w, h), mc = m.getContext('2d'), R = (Math.min(w, h) * v.r) / 100, cx = (w * v.cx) / 100, cy = (h * v.cy) / 100, g = mc.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); mc.fillStyle = g; mc.fillRect(0, 0, w, h); mc.globalCompositeOperation = 'source-in'; mc.drawImage(bl, 0, 0); const out = MP.cloneCanvas(src); out.getContext('2d').drawImage(m, 0, 0); return out; } },
    surface: { title: 'Flou de surface (réduction du bruit)', heavy: true, fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 1, max: 6, unit: 'px' }, { k: 't', label: 'Seuil', type: 'range', min: 2, max: 100 }], values: { r: 3, t: 20 },
      render(src, v) { const R = v.r, T = v.t * 2.55; return pixelOp(src, (s, d, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) { const c0 = s[i + c]; let sum = 0, ws = 0; for (let j = -R; j <= R; j++) { const yy = C(y + j, 0, h - 1); for (let q = -R; q <= R; q++) { const v2 = s[(yy * w + C(x + q, 0, w - 1)) * 4 + c], wt = Math.max(0, 1 - Math.abs(v2 - c0) / (T * 2.5)); sum += v2 * wt; ws += wt; } } d[i + c] = sum / ws; } d[i + 3] = s[i + 3]; } }); } },
    highpass: { title: 'Passe-haut', fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 0.5, max: 100, step: 0.5, unit: 'px' }], values: { r: 4 }, render(src, v) { const b = MP.blurCanvas(src, v.r).getContext('2d').getImageData(0, 0, src.width, src.height).data; return pixelOp(src, (s, d) => { for (let i = 0; i < s.length; i += 4) { for (let c = 0; c < 3; c++) d[i + c] = 128 + s[i + c] - b[i + c]; d[i + 3] = s[i + 3]; } }); } },
    minimum: { title: 'Minimum', fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 1, max: 20, unit: 'px' }], values: { r: 2 }, render: (src, v) => morph(src, v.r, Math.min) },
    maximum: { title: 'Maximum', fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 1, max: 20, unit: 'px' }], values: { r: 2 }, render: (src, v) => morph(src, v.r, Math.max) },
    offset: { title: 'Décalage', fields: [{ k: 'dx', label: 'Horizontal', type: 'range', min: -2000, max: 2000, unit: 'px' }, { k: 'dy', label: 'Vertical', type: 'range', min: -2000, max: 2000, unit: 'px' }], values: { dx: 100, dy: 0 },
      render(src, v) { const w = src.width, h = src.height, o = MP.createCanvas(w, h), c = o.getContext('2d'), dx = ((v.dx % w) + w) % w, dy = ((v.dy % h) + h) % h; for (const ox of [dx - w, dx]) for (const oy of [dy - h, dy]) c.drawImage(src, ox, oy); return o; } },
    polar: { title: 'Coordonnées polaires', fields: [{ k: 'mode', label: 'Conversion', type: 'select', options: [['r2p', 'Rectangulaires → polaires'], ['p2r', 'Polaires → rectangulaires']] }], values: { mode: 'r2p' },
      render(src, v) { return remap(src, (x, y, w, h) => { const cx = w / 2, cy = h / 2; if (v.mode === 'r2p') { const dx = x - cx, dy = y - cy, a = (Math.atan2(dx, -dy) + Math.PI) / (2 * Math.PI), r = Math.hypot(dx, dy) / Math.hypot(cx, cy); return [a * (w - 1), r * (h - 1)]; } const a = (x / w) * 2 * Math.PI - Math.PI, r = (y / h) * Math.hypot(cx, cy); return [cx + Math.sin(a) * r, cy - Math.cos(a) * r]; }); } },
    flare: { title: 'Halo (reflet d\'objectif)', fields: [{ k: 'cx', label: 'Position X', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'cy', label: 'Position Y', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'k', label: 'Luminosité', type: 'range', min: 10, max: 300, unit: '%' }], values: { cx: 25, cy: 25, k: 100 },
      render(src, v) {
        const w = src.width, h = src.height, o = MP.cloneCanvas(src), c = o.getContext('2d'), x = (w * v.cx) / 100, y = (h * v.cy) / 100, s = (Math.min(w, h) / 4) * (v.k / 100), cxm = w / 2, cym = h / 2;
        c.globalCompositeOperation = 'screen';
        const glow = (gx, gy, r, col, a) => { const g = c.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(gx, gy, r, 0, 7); c.fill(); };
        glow(x, y, s, '255,250,230', 1); glow(x, y, s * 2.4, '255,190,120', 0.35);
        c.globalAlpha = 0.7; c.strokeStyle = 'rgba(255,240,220,.6)'; c.lineWidth = Math.max(1, s / 60); for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * s * 1.6, y + Math.sin(a) * s * 1.6); c.stroke(); }
        c.globalAlpha = 1; [[0.4, 0.18, '120,200,255'], [0.7, 0.08, '200,255,160'], [1.1, 0.26, '255,140,200'], [1.5, 0.12, '160,180,255']].forEach(([t, r, col]) => { const gx = x + (cxm - x) * 2 * t, gy = y + (cym - y) * 2 * t; glow(gx, gy, s * r, col, 0.4); });
        c.globalCompositeOperation = 'destination-in'; c.drawImage(src, 0, 0); return o;
      } },
    dust: { title: 'Antipoussière', heavy: true, fields: [{ k: 'r', label: 'Rayon', type: 'range', min: 1, max: 4, unit: 'px' }, { k: 't', label: 'Seuil', type: 'range', min: 0, max: 128 }], values: { r: 2, t: 20 },
      render(src, v) { const med = MP.FILTERS.median.render(src, { r: v.r }).getContext('2d').getImageData(0, 0, src.width, src.height).data; return pixelOp(src, (s, d) => { for (let i = 0; i < s.length; i += 4) { const diff = Math.abs(s[i] - med[i]) + Math.abs(s[i + 1] - med[i + 1]) + Math.abs(s[i + 2] - med[i + 2]); for (let c = 0; c < 3; c++) d[i + c] = diff > v.t * 3 ? med[i + c] : s[i + c]; d[i + 3] = s[i + 3]; } }); } },
    crystallize: { title: 'Cristallisation', fields: [{ k: 's', label: 'Taille des cellules', type: 'range', min: 3, max: 200, unit: 'px' }], values: { s: 18 },
      render(src, v) {
        const S = v.s; return pixelOp(src, (s, d, w, h) => {
          const gw = Math.ceil(w / S) + 1, gh = Math.ceil(h / S) + 1, sx = new Float32Array(gw * gh), sy = new Float32Array(gw * gh);
          for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { sx[j * gw + i] = (i + hash(i, j, 3)) * S; sy[j * gw + i] = (j + hash(i, j, 5)) * S; }
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const ci = (x / S) | 0, cj = (y / S) | 0; let best = 1e18, bi = 0;
            for (let j = Math.max(0, cj - 1); j <= Math.min(gh - 1, cj + 1); j++) for (let i = Math.max(0, ci - 1); i <= Math.min(gw - 1, ci + 1); i++) { const k = j * gw + i, dd = (sx[k] - x) ** 2 + (sy[k] - y) ** 2; if (dd < best) { best = dd; bi = k; } }
            const o = (C(sy[bi] | 0, 0, h - 1) * w + C(sx[bi] | 0, 0, w - 1)) * 4, t = (y * w + x) * 4; d[t] = s[o]; d[t + 1] = s[o + 1]; d[t + 2] = s[o + 2]; d[t + 3] = s[t + 3];
          }
        });
      } },
    /* --- galerie de filtres (artistiques) --- */
    sketch: { title: 'Croquis au crayon', fields: [{ k: 'r', label: 'Finesse du trait', type: 'range', min: 1, max: 30, unit: 'px' }, { k: 'k', label: 'Intensité', type: 'range', min: 10, max: 300, unit: '%' }], values: { r: 6, k: 100 },
      render(src, v) { const w = src.width, h = src.height, s = src.getContext('2d').getImageData(0, 0, w, h).data, g = gray(s, w * h), inv = pixelOp(src, (a, d) => { for (let p = 0; p < w * h; p++) { const x = 255 - g[p]; d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = x; d[p * 4 + 3] = 255; } }), b = MP.blurCanvas(inv, v.r).getContext('2d').getImageData(0, 0, w, h).data; return pixelOp(src, (a, d) => { for (let p = 0; p < w * h; p++) { const base = g[p], bl = b[p * 4]; let x = bl >= 255 ? 255 : Math.min(255, (base * 255) / (255 - bl)); x = 255 - (255 - x) * (v.k / 100); d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = x; d[p * 4 + 3] = s[p * 4 + 3]; } }); } },
    watercolor: { title: 'Aquarelle', fields: [{ k: 'r', label: 'Diffusion', type: 'range', min: 1, max: 20, unit: 'px' }, { k: 'e', label: 'Contours', type: 'range', min: 0, max: 100, unit: '%' }], values: { r: 4, e: 50 },
      render(src, v) { const w = src.width, h = src.height, sm = MP.FILTERS.median.render(MP.blurCanvas(src, v.r / 2), { r: Math.min(3, Math.ceil(v.r / 3)) }), sd = sm.getContext('2d').getImageData(0, 0, w, h).data, e = sobel(gray(sd, w * h), w, h); return pixelOp(sm, (s, d) => { for (let p = 0; p < w * h; p++) { const k = Math.min(1, e[p] / 200) * (v.e / 100); for (let c = 0; c < 3; c++) { const q = Math.round(s[p * 4 + c] / 24) * 24; d[p * 4 + c] = MP.lerp(q, s[p * 4 + c], 0.4) * (1 - k * 0.5) + 12; } d[p * 4 + 3] = s[p * 4 + 3]; } }); } },
    cutout: { title: 'Découpage', fields: [{ k: 'n', label: 'Nombre de niveaux', type: 'range', min: 2, max: 8 }, { k: 'r', label: 'Simplicité', type: 'range', min: 1, max: 20, unit: 'px' }], values: { n: 4, r: 4 },
      render(src, v) { const sm = MP.blurCanvas(src, v.r); return pixelOp(sm, (s, d) => { const n = v.n - 1; for (let i = 0; i < s.length; i += 4) { for (let c = 0; c < 3; c++) d[i + c] = Math.round(Math.round((s[i + c] / 255) * n) / n * 255); d[i + 3] = s[i + 3]; } }); } },
    glowEdges: { title: 'Contours lumineux', fields: [{ k: 'k', label: 'Luminosité', type: 'range', min: 10, max: 400, unit: '%' }], values: { k: 150 },
      render(src, v) { const w = src.width, h = src.height, s0 = MP.blurCanvas(src, 1).getContext('2d').getImageData(0, 0, w, h).data; return pixelOp(src, (s, d) => { for (let c = 0; c < 3; c++) { const g = new Float32Array(w * h); for (let p = 0; p < w * h; p++) g[p] = s0[p * 4 + c]; const e = sobel(g, w, h); for (let p = 0; p < w * h; p++) d[p * 4 + c] = e[p] * (v.k / 100) * 0.6; } for (let p = 0; p < w * h; p++) d[p * 4 + 3] = s[p * 4 + 3]; }); } },
    posterEdges: { title: 'Contours postérisés (BD)', fields: [{ k: 'n', label: 'Postérisation', type: 'range', min: 2, max: 8 }, { k: 'e', label: 'Épaisseur des contours', type: 'range', min: 0, max: 100, unit: '%' }], values: { n: 5, e: 60 },
      render(src, v) { const w = src.width, h = src.height, s0 = MP.blurCanvas(src, 1.2).getContext('2d').getImageData(0, 0, w, h).data, e = sobel(gray(s0, w * h), w, h), th = 260 - v.e * 2; return pixelOp(src, (s, d) => { const n = v.n - 1; for (let p = 0; p < w * h; p++) { const ed = e[p] > th; for (let c = 0; c < 3; c++) d[p * 4 + c] = ed ? 15 : Math.round(Math.round((s0[p * 4 + c] / 255) * n) / n * 255); d[p * 4 + 3] = s[p * 4 + 3]; } }); } },
    charcoal: { title: 'Fusain', fields: [{ k: 'k', label: 'Épaisseur du fusain', type: 'range', min: 1, max: 10 }], values: { k: 3 },
      render(src, v) { const w = src.width, h = src.height, s0 = MP.blurCanvas(src, v.k / 2).getContext('2d').getImageData(0, 0, w, h).data, g = gray(s0, w * h), e = sobel(g, w, h); return pixelOp(src, (s, d) => { for (let p = 0; p < w * h; p++) { const x = p % w, y = (p / w) | 0, n = hash((x + y) >> 1, (y - x) >> 2, 1) * 40; const val = C(255 - e[p] * 0.9 - (255 - g[p]) * 0.45 - n * (1 - g[p] / 255), 0, 255); d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = val; d[p * 4 + 3] = s[p * 4 + 3]; } }); } },
    filmGrain: { title: 'Grain photo (pellicule)', fields: [{ k: 'amount', label: 'Grain', type: 'range', min: 0, max: 100 }, { k: 'size', label: 'Taille', type: 'range', min: 1, max: 6 }], values: { amount: 35, size: 1 }, render(src, v) { return pixelOp(src, (s, d, w) => grain(s, d, { ...v, rough: 70, __w: w })); } },
    pointillism: { title: 'Pointillisme', fields: [{ k: 's', label: 'Taille des points', type: 'range', min: 3, max: 40, unit: 'px' }], values: { s: 8 },
      render(src, v) { const w = src.width, h = src.height, data = src.getContext('2d').getImageData(0, 0, w, h).data, o = MP.createCanvas(w, h), c = o.getContext('2d'); c.fillStyle = MP.colors.bg; c.fillRect(0, 0, w, h); const S = v.s, n = Math.round((w * h) / (S * S) * 1.6); for (let k = 0; k < n; k++) { const x = Math.random() * w, y = Math.random() * h, i = ((y | 0) * w + (x | 0)) * 4; c.fillStyle = `rgb(${C(data[i] + (Math.random() - 0.5) * 40, 0, 255)},${C(data[i + 1] + (Math.random() - 0.5) * 40, 0, 255)},${C(data[i + 2] + (Math.random() - 0.5) * 40, 0, 255)})`; c.beginPath(); c.arc(x, y, S * (0.4 + Math.random() * 0.3), 0, 7); c.fill(); } c.globalCompositeOperation = 'destination-in'; c.drawImage(src, 0, 0); return o; } },
    neon: { title: 'Néon', fields: [{ k: 'c', label: 'Couleur', type: 'color' }, { k: 'k', label: 'Lueur', type: 'range', min: 1, max: 40, unit: 'px' }], values: { c: '#3cf2ff', k: 8 },
      render(src, v) { const w = src.width, h = src.height, s0 = MP.blurCanvas(src, 1).getContext('2d').getImageData(0, 0, w, h).data, e = sobel(gray(s0, w * h), w, h), col = MP.hexToRgb(v.c); const edges = pixelOp(src, (s, d) => { for (let p = 0; p < w * h; p++) { const k = Math.min(1, e[p] / 160); d[p * 4] = col.r * k + 255 * k * k * 0.5; d[p * 4 + 1] = col.g * k + 255 * k * k * 0.5; d[p * 4 + 2] = col.b * k + 255 * k * k * 0.5; d[p * 4 + 3] = 255; } }); const o = MP.createCanvas(w, h), c = o.getContext('2d'); c.fillStyle = '#05060a'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'screen'; c.drawImage(MP.blurCanvas(edges, v.k), 0, 0); c.drawImage(edges, 0, 0); c.globalCompositeOperation = 'destination-in'; c.drawImage(src, 0, 0); return o; } },
  });
}

/* Les fonctions pixel reçoivent la largeur (__w) pour les effets dépendant de la position */
{
  const apply0 = MP.applyAdjustLayer;
  MP.applyAdjustLayer = (doc, canvas, l) => { if (l.adjust && l.adjust.values) { Object.defineProperty(l.adjust.values, '__w', { value: canvas.width, configurable: true, enumerable: false, writable: true }); } return apply0(doc, canvas, l); };
}
