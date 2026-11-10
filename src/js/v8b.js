'use strict';
/* v8 (2/3) — composition haute précision (virgule flottante) de tout le document : calques 8 bits et calques
   16/32 bits, masques, opacité, fond, 27 modes de fusion, groupes, masques d'écrêtage et calques de réglage
   (appliqués par table 3D interpolée, sans arrondi à 8 bits) → exports TIFF/PNG 16 bits, TIFF 32 bits, HDR */

const SPATIAL_ADJ = new Set(['clarity', 'grain', 'shadowsHighlights', 'cameraRaw']);
MP.fcomp = {
  /** blend séparable sur un canal (valeurs 0..1, encodées) */
  B: {
    'source-over': (b, s) => s, multiply: (b, s) => b * s, screen: (b, s) => b + s - b * s,
    overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)), darken: Math.min, lighten: Math.max,
    'color-dodge': (b, s) => (b === 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s))), 'color-burn': (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)),
    'hard-light': (b, s) => (s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
    'soft-light': (b, s) => { if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b); const D = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b); return b + (2 * s - 1) * (D - b); },
    difference: (b, s) => Math.abs(b - s), exclusion: (b, s) => b + s - 2 * b * s,
    'linear-burn': (b, s) => Math.max(0, b + s - 1), 'linear-dodge': (b, s) => Math.min(1, b + s), 'linear-light': (b, s) => MP.clamp(b + 2 * s - 1, 0, 1),
    'vivid-light': (b, s) => (s < 0.5 ? (s <= 0 ? 0 : Math.max(0, 1 - (1 - b) / (2 * s))) : s >= 1 ? 1 : Math.min(1, b / (2 * (1 - s)))),
    'pin-light': (b, s) => (s < 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)), 'hard-mix': (b, s) => (b + s >= 1 ? 1 : 0),
    subtract: (b, s) => Math.max(0, b - s), divide: (b, s) => (s <= 0 ? 1 : Math.min(1, b / s)), dissolve: (b, s) => s,
  },
  lum: (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2],
  clip(c) { const L = this.lum(c), n = Math.min(...c), x = Math.max(...c); if (n < 0) c = c.map((v) => L + ((v - L) * L) / (L - n)); if (x > 1) c = c.map((v) => L + ((v - L) * (1 - L)) / (x - L)); return c; },
  setLum(c, l) { const d = l - this.lum(c); return this.clip(c.map((v) => v + d)); },
  sat: (c) => Math.max(...c) - Math.min(...c),
  setSat(c, s) { const mx = Math.max(...c), mn = Math.min(...c); if (mx === mn) return [0, 0, 0]; return c.map((v) => ((v - mn) * s) / (mx - mn)); },
  NS: {
    hue: (b, s, F) => F.setLum(F.setSat(s, F.sat(b)), F.lum(b)), saturation: (b, s, F) => F.setLum(F.setSat(b, F.sat(s)), F.lum(b)),
    color: (b, s, F) => F.setLum(s, F.lum(b)), luminosity: (b, s, F) => F.setLum(b, F.lum(s)),
    'darker-color': (b, s, F) => (F.lum(s) < F.lum(b) ? s : b), 'lighter-color': (b, s, F) => (F.lum(s) > F.lum(b) ? s : b),
  },
  /** compose src (Float32 RVBA, couleur non prémultipliée) sur acc avec mode, opacité, masque ; atop = écrêtage */
  composite(acc, src, mode, opacity, atop, n) {
    const f = this.B[mode] || (this.NS[mode] ? null : this.B['source-over']), g = this.NS[mode];
    for (let i = 0; i < n; i++) {
      const p = i * 4, as = src[p + 3] * opacity; if (as <= 0) continue; const ab = acc[p + 3];
      let bl; if (g) bl = g([acc[p], acc[p + 1], acc[p + 2]], [src[p], src[p + 1], src[p + 2]], this); else bl = [f(acc[p], src[p]), f(acc[p + 1], src[p + 1]), f(acc[p + 2], src[p + 2])];
      if (atop) { if (ab > 0) for (let c = 0; c < 3; c++) acc[p + c] = as * bl[c] + (1 - as) * acc[p + c]; continue; }
      const ao = as + ab * (1 - as); for (let c = 0; c < 3; c++) acc[p + c] = (as * (1 - ab) * src[p + c] + as * ab * bl[c] + (1 - as) * ab * acc[p + c]) / ao; acc[p + 3] = ao;
    }
  },
  /** toile 8 bits → flottants (option linéaire pour le 32 bits) */
  fromCanvas(c, linear) { const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, o = new Float32Array(a.length); for (let i = 0; i < a.length; i += 4) { for (let k = 0; k < 3; k++) o[i + k] = linear ? MP.srgbToLin(a[i + k] / 255) : a[i + k] / 255; o[i + 3] = a[i + 3] / 255; } return o; },
  /** calque haute précision échantillonné dans le repère du document */
  fromHp(d, l, linear) {
    const s = l.smart, hp = s.hp, m = s.m, W = d.width, H = d.height, o = new Float32Array(W * H * 4), dev = linear ? null : MP.hp.devFn(s.dev);
    const v = { ...MP.hp.DEV, ...s.dev }, E = Math.pow(2, v.exposure || 0), sw = s.src.width / hp.w, sh = s.src.height / hp.h, ca = Math.cos(-m.angle), sa = Math.sin(-m.angle);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - m.cx, dy = y + 0.5 - m.cy, ux = (dx * ca - dy * sa) / m.sx / sw + hp.w / 2, uy = (dx * sa + dy * ca) / m.sy / sh + hp.h / 2;
      if (ux < 0 || uy < 0 || ux >= hp.w || uy >= hp.h) continue;
      const x0 = Math.min(hp.w - 2, Math.max(0, Math.floor(ux - 0.5))), y0 = Math.min(hp.h - 2, Math.max(0, Math.floor(uy - 0.5))), fx = MP.clamp(ux - 0.5 - x0, 0, 1), fy = MP.clamp(uy - 0.5 - y0, 0, 1), q = (y * W + x) * 4;
      const S = (k) => { const a = hp.data[(y0 * hp.w + x0) * 3 + k], b = hp.data[(y0 * hp.w + x0 + 1) * 3 + k], c = hp.data[((y0 + 1) * hp.w + x0) * 3 + k], e = hp.data[((y0 + 1) * hp.w + x0 + 1) * 3 + k]; return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy; };
      const r = S(0), g = S(1), b = S(2); if (dev) { const e = dev(r, g, b); o[q] = e[0]; o[q + 1] = e[1]; o[q + 2] = e[2]; } else { o[q] = r * E; o[q + 1] = g * E; o[q + 2] = b * E; }
      o[q + 3] = hp.alpha ? hp.alpha[Math.floor(uy) * hp.w + Math.floor(ux)] / 255 : 1;
    }
    return o;
  },
  /** table 3D d'un calque de réglage (sondage de sa transformation, puis interpolation trilinéaire en flottant) */
  adjLut(d, l) {
    const key = JSON.stringify([l.adjust.key, l.adjust.values]); if (l._fl && l._fl.key === key) return l._fl.T;
    const G = 33, N = G * G * G, side = Math.ceil(Math.sqrt(N)), c = MP.createCanvas(side, side), x = c.getContext('2d'), id = x.createImageData(side, side);
    for (let i = 0; i < N; i++) { id.data[i * 4] = Math.round(((Math.floor(i / G / G)) / (G - 1)) * 255); id.data[i * 4 + 1] = Math.round(((Math.floor(i / G) % G) / (G - 1)) * 255); id.data[i * 4 + 2] = Math.round(((i % G) / (G - 1)) * 255); id.data[i * 4 + 3] = 255; }
    for (let i = N; i < side * side; i++) id.data[i * 4 + 3] = 255; x.putImageData(id, 0, 0);
    const res = MP.applyAdjustLayer({ ...d, buf: (k) => { const b = MP.createCanvas(side, side); return b; } }, c, l), a = res.getContext('2d').getImageData(0, 0, side, side).data, T = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { T[i * 3] = a[i * 4] / 255; T[i * 3 + 1] = a[i * 4 + 1] / 255; T[i * 3 + 2] = a[i * 4 + 2] / 255; }
    l._fl = { key, T }; return T;
  },
  applyLut(acc, T, n, linear) {
    const G = 33, g = G - 1, out = new Float32Array(acc.length);
    for (let i = 0; i < n; i++) {
      const p = i * 4; out[p + 3] = acc[p + 3]; if (!acc[p + 3]) continue;
      let r = acc[p], gg = acc[p + 1], b = acc[p + 2], k = 1; const mx = Math.max(r, gg, b); if (linear && mx > 1) { k = mx; r /= k; gg /= k; b /= k; }
      if (linear) { r = MP.linToSrgb(r); gg = MP.linToSrgb(gg); b = MP.linToSrgb(b); }
      const x = MP.clamp(r, 0, 1) * g, y = MP.clamp(gg, 0, 1) * g, z = MP.clamp(b, 0, 1) * g, x0 = Math.min(g - 1, x | 0), y0 = Math.min(g - 1, y | 0), z0 = Math.min(g - 1, z | 0), fx = x - x0, fy = y - y0, fz = z - z0;
      for (let c = 0; c < 3; c++) {
        const I = (a, bb, cc) => T[((a * G + bb) * G + cc) * 3 + c];
        const v = ((I(x0, y0, z0) * (1 - fz) + I(x0, y0, z0 + 1) * fz) * (1 - fy) + (I(x0, y0 + 1, z0) * (1 - fz) + I(x0, y0 + 1, z0 + 1) * fz) * fy) * (1 - fx) + ((I(x0 + 1, y0, z0) * (1 - fz) + I(x0 + 1, y0, z0 + 1) * fz) * (1 - fy) + (I(x0 + 1, y0 + 1, z0) * (1 - fz) + I(x0 + 1, y0 + 1, z0 + 1) * fz) * fy) * fx;
        out[p + c] = linear ? MP.srgbToLin(v) * k : v;
      }
    }
    return out;
  },
  maskOf(l, n) { if (!(l.mask && l.maskEnabled)) return null; const m = (MP.effMask ? MP.effMask(l) : l.mask).getContext('2d').getImageData(0, 0, l.mask.width, l.mask.height).data, o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = m[i * 4 + 3] / 255; return o; },
  layerSrc(d, l, linear) {
    let src;
    if (l.smart && l.smart.hp && !(l.smart.filters || []).some((f) => f.on !== false)) src = this.fromHp(d, l, linear);
    else src = this.fromCanvas(MP.fx.has(l) ? MP.fx.render(d, l, l.canvas) : l.canvas, linear);
    const n = d.width * d.height, m = this.maskOf(l, n), fill = l.fill == null ? 1 : l.fill, styled = MP.fx.has(l);
    if (m || (!styled && fill < 1)) for (let i = 0; i < n; i++) src[i * 4 + 3] *= (m ? m[i] : 1) * (styled ? 1 : fill);
    if (l.blendIf) { const c = MP.blendIfApply(l.canvas, null, l.blendIf).getContext('2d').getImageData(0, 0, d.width, d.height).data, a = l.canvas.getContext('2d').getImageData(0, 0, d.width, d.height).data; for (let i = 0; i < n; i++) if (a[i * 4 + 3]) src[i * 4 + 3] *= c[i * 4 + 3] / a[i * 4 + 3]; }
    return src;
  },
  /** applique un calque de réglage à l'accumulateur */
  adjust(d, acc, l, linear, atop) {
    const n = d.width * d.height; let res;
    if (SPATIAL_ADJ.has(l.adjust.key) || (MP.ADJUST[l.adjust.key] && MP.ADJUST[l.adjust.key].needsBlur)) {
      const c8 = this.toCanvas(acc, d.width, d.height, linear), r8 = MP.applyAdjustLayer(d, c8, l).getContext('2d').getImageData(0, 0, d.width, d.height).data, q = c8.getContext('2d').getImageData(0, 0, d.width, d.height).data; res = new Float32Array(acc);
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const dlt = (r8[i * 4 + k] - q[i * 4 + k]) / 255; res[i * 4 + k] = linear ? MP.srgbToLin(MP.clamp(MP.linToSrgb(acc[i * 4 + k]) + dlt, 0, 1)) : MP.clamp(acc[i * 4 + k] + dlt, 0, 1); }
    } else res = this.applyLut(acc, this.adjLut(d, l), n, linear);
    const m = this.maskOf(l, n); for (let i = 0; i < n; i++) res[i * 4 + 3] = acc[i * 4 + 3] * (m ? m[i] : 1);
    this.composite(acc, res, l.blend, l.opacity, true, n); void atop;
  },
  group(d, pid, linear) {
    const n = d.width * d.height, acc = new Float32Array(n * 4), kids = d.children(pid);
    for (let i = 0; i < kids.length; i++) {
      const l = kids[i]; if (!l.visible) { while (kids[i + 1] && kids[i + 1].clip) i++; continue; }
      const clipped = []; let j = i + 1; while (j < kids.length && kids[j].clip) { clipped.push(kids[j]); j++; }
      if (l.adjust) { this.adjust(d, acc, l, linear); continue; }
      let src;
      if (l.isGroup) { src = this.group(d, l.id, linear); const m = this.maskOf(l, n); if (m) for (let k = 0; k < n; k++) src[k * 4 + 3] *= m[k]; }
      else src = this.layerSrc(d, l, linear);
      if (clipped.length) {
        const base = src, alpha = new Float32Array(n); for (let k = 0; k < n; k++) alpha[k] = base[k * 4 + 3];
        for (const c of clipped) { if (!c.visible) continue; if (c.adjust) { this.adjust(d, base, c, linear); continue; } const cs = c.isGroup ? this.group(d, c.id, linear) : this.layerSrc(d, c, linear); this.composite(base, cs, c.blend === 'pass-through' ? 'source-over' : c.blend, c.opacity, true, n); }
        for (let k = 0; k < n; k++) base[k * 4 + 3] = alpha[k]; i = j - 1;
      }
      this.composite(acc, src, l.blend === 'pass-through' ? 'source-over' : l.blend, l.opacity, false, n);
    }
    return acc;
  },
  render(d, linear = (d.bits || 8) === 32) { return this.group(d, null, linear); },
  toCanvas(acc, W, H, linear) { const c = MP.createCanvas(W, H), x = c.getContext('2d'), id = x.createImageData(W, H); for (let i = 0; i < W * H * 4; i += 4) { for (let k = 0; k < 3; k++) id.data[i + k] = Math.round((linear ? MP.linToSrgb(acc[i + k]) : acc[i + k]) * 255); id.data[i + 3] = Math.round(acc[i + 3] * 255); } x.putImageData(id, 0, 0); return c; },
};

/* =================== Exports haute précision du document entier =================== */
{
  const U16 = (acc, n, alpha) => { const spp = alpha ? 4 : 3, b = new Uint16Array(n * spp); for (let i = 0; i < n; i++) for (let k = 0; k < spp; k++) b[i * spp + k] = MP.clamp(Math.round(acc[i * 4 + k] * 65535), 0, 65535); return b; };
  MP.exportHigh = async (d, fmt) => {
    const n = d.width * d.height, linear = fmt === 'tiff32' || fmt === 'hdr', acc = await MP.busy('Composition haute précision…', () => MP.fcomp.render(d, linear));
    const icc = MP.prefs.embedICC === false ? null : MP.cms.profileBytes(d), hasA = (() => { for (let i = 3; i < acc.length; i += 4) if (acc[i] < 0.999) return true; return false; })();
    const hpOf = () => { const data = new Float32Array(n * 3); for (let i = 0; i < n; i++) { data[i * 3] = acc[i * 4]; data[i * 3 + 1] = acc[i * 4 + 1]; data[i * 3 + 2] = acc[i * 4 + 2]; } return { w: d.width, h: d.height, data, bits: 32 }; };
    if (fmt === 'hdr') return { ext: 'hdr', data: MP.enc.hdr(hpOf()) };
    if (fmt === 'tiff32') return { ext: 'tif', data: MP.enc.tiffX({ hp: hpOf(), bits: 32, dpi: d.dpi || 72, meta: d.meta || {}, icc }) };
    if (fmt === 'png16') {
      const W = d.width, H = d.height, spp = hasA ? 4 : 3, row = 1 + W * spp * 2, raw = new Uint8Array(row * H), v = U16(acc, n, hasA);
      for (let y = 0; y < H; y++) for (let x = 0; x < W * spp; x++) { const q = y * row + 1 + x * 2, val = v[y * W * spp + x]; raw[q] = val >> 8; raw[q + 1] = val & 255; }
      const ih = new ByteW(); ih.u32(W, false).u32(H, false).u8(16).u8(hasA ? 6 : 2).u8(0).u8(0).u8(0);
      const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ih.out())]; if (icc) { const c = new ByteW(); c.str('ICC profile').u8(0).u8(0).bytes(await zlib(icc)); parts.push(pngChunk('iCCP', c.out())); }
      const ph = new ByteW(), ppm = Math.round((d.dpi || 72) / 0.0254); ph.u32(ppm, false).u32(ppm, false).u8(1); parts.push(pngChunk('pHYs', ph.out()), pngChunk('IDAT', await zlib(raw)), pngChunk('IEND', new Uint8Array(0)));
      return { ext: 'png', data: new Uint8Array(await new Blob(parts).arrayBuffer()) };
    }
    // TIFF 16 bits
    const v = U16(acc, n, hasA), fake = { w: d.width, h: d.height, data: null }; void fake;
    const pixBytes = new Uint8Array(v.buffer), tif = MP.enc.tiffX({ canvas: MP.createCanvas(d.width, d.height), bits: 16, alpha: hasA, dpi: d.dpi || 72, meta: d.meta || {}, icc });
    // remplace les données 16 bits (même taille) par celles de la composition flottante
    tif.set(pixBytes, tif.length - pixBytes.length); return { ext: 'tif', data: tif };
  };
  UI.dialogs.export16 = (fmt) => {
    const d = MP.doc; MP.busy('Export ' + (fmt === 'hdr' || fmt === 'tiff32' ? '32' : '16') + ' bits…', async () => {
      const r = await MP.exportHigh(d, fmt), p = await MP.native.saveFile({ defaultPath: d.name.replace(/\.[^.]+$/, '') + '.' + r.ext, filters: [{ name: r.ext.toUpperCase(), extensions: [r.ext] }], data: r.data });
      if (p) MP.toast(`Document entier exporté en ${fmt === 'hdr' || fmt === 'tiff32' ? '32 bits flottants (linéaire)' : '16 bits'} (${(r.data.length / 1048576).toFixed(1)} Mo) — calques, masques, modes de fusion et réglages calculés sans arrondi 8 bits`, 6000);
    });
  };
  const enc0 = MP.encodeDoc;
  MP.encodeDoc = async (d, v) => (['tiff16', 'png16', 'tiff32', 'hdr'].includes(v.format) ? MP.exportHigh(d, v.format) : enc0(d, v));
}
