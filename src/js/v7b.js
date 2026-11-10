'use strict';
/* v7 (2/4) — vrai développement RAW : lecture des données brutes du capteur (DNG, CR2, ARW, RAW TIFF non compressés),
   décodeur JPEG sans perte (LJ92), linéarisation, niveaux de noir/blanc, balance des blancs, dématriçage
   Malvar-He-Cutler, matrice de couleur de l'appareil → image 16 bits linéaire */

/* =================== JPEG sans perte (ITU T.81 processus 14) =================== */
MP.lj92 = (bytes) => {
  let p = 2; const H = {}; let F = null, S = null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('flux LJ92 invalide');
  while (p < bytes.length) {
    if (bytes[p] !== 0xff) { p++; continue; }
    const m = bytes[p + 1]; if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; } if (m === 0xff) { p++; continue; }
    const len = (bytes[p + 2] << 8) | bytes[p + 3], seg = bytes.subarray(p + 4, p + 2 + len);
    if (m === 0xc4) { let q = 0; while (q < seg.length) { const tc = seg[q], counts = seg.subarray(q + 1, q + 17), tot = counts.reduce((a, b) => a + b, 0), syms = seg.subarray(q + 17, q + 17 + tot); const maxcode = new Int32Array(18).fill(-1), valptr = new Int32Array(17), mincode = new Int32Array(17); let code = 0, k = 0; for (let l = 1; l <= 16; l++) { valptr[l] = k; mincode[l] = code; code += counts[l - 1]; k += counts[l - 1]; maxcode[l] = counts[l - 1] ? code - 1 : -1; code <<= 1; } maxcode[17] = 0x7fffffff; H[tc & 15] = { maxcode, valptr, mincode, syms }; q += 17 + tot; } }
    else if (m === 0xc3) { F = { P: seg[0], h: (seg[1] << 8) | seg[2], w: (seg[3] << 8) | seg[4], nc: seg[5], comps: [] }; for (let i = 0; i < F.nc; i++) F.comps.push({ id: seg[6 + i * 3], hv: seg[7 + i * 3] }); }
    else if (m === 0xc0 || m === 0xc1 || m === 0xc2) throw new Error('JPEG avec perte dans un RAW (non pris en charge)');
    else if (m === 0xda) { const ns = seg[0]; S = { tables: [], pred: seg[1 + ns * 2], pt: seg[3 + ns * 2] & 15 }; for (let i = 0; i < ns; i++) S.tables.push(seg[2 + i * 2] >> 4); p += 2 + len; break; }
    p += 2 + len;
  }
  if (!F || !S) throw new Error('en-tête LJ92 incomplet');
  const { w, h, nc } = F, out = new Uint16Array(w * h * nc); let bits = 0, nb = 0;
  const fill = () => { while (nb <= 24) { let b = 0; if (p < bytes.length) { b = bytes[p]; if (b === 0xff) { const n2 = bytes[p + 1]; if (n2 === 0) p += 2; else { b = 0; } } else p++; } bits = (bits << 8) | b; nb += 8; } };
  const get = (n) => { if (n > nb) fill(); nb -= n; return (bits >>> nb) & ((1 << n) - 1); };
  const huff = (T) => { if (nb < 16) fill(); let code = 0; for (let l = 1; l <= 16; l++) { code = (code << 1) | ((bits >>> (nb - l)) & 1); if (code <= T.maxcode[l]) { nb -= l; return T.syms[T.valptr[l] + code - T.mincode[l]]; } } nb -= 16; return 0; };
  const T = S.tables.map((t) => H[t] || H[0]), pred = S.pred, init = 1 << (F.P - S.pt - 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < nc; c++) {
    const s = huff(T[c]); let diff = 0;
    if (s === 16) diff = -32768; else if (s) { diff = get(s); if (diff < 1 << (s - 1)) diff -= (1 << s) - 1; }
    const i = (y * w + x) * nc + c, A = x ? out[i - nc] : 0, B = y ? out[i - w * nc] : 0, C = x && y ? out[i - w * nc - nc] : 0;
    let pv;
    if (!y && !x) pv = init; else if (!y) pv = A; else if (!x) pv = B;
    else switch (pred) { case 1: pv = A; break; case 2: pv = B; break; case 3: pv = C; break; case 4: pv = A + B - C; break; case 5: pv = A + ((B - C) >> 1); break; case 6: pv = B + ((A - C) >> 1); break; case 7: pv = (A + B) >> 1; break; default: pv = A; }
    out[i] = (pv + diff) & 0xffff;
  }
  return { w, h, nc, bits: F.P, data: out };
};

/* =================== Lecture RAW =================== */
const MAT_GENERIC = { Canon: [6722, -635, -963, -4287, 12460, 2028, -908, 2162, 5668], Sony: [5271, -712, -347, -6153, 13653, 2763, -1601, 2366, 7242], Nikon: [7191, -1564, -609, -4851, 12554, 2575, -1222, 2033, 6869] };
const XYZ_RGB = [0.412453, 0.35758, 0.180423, 0.212671, 0.71516, 0.072169, 0.019334, 0.119193, 0.950227];
MP.raw = {
  ifds(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), le = dv.getUint16(0) === 0x4949, list = [], seen = new Set();
    if (![42, 0x4f52, 0x55, 0x4352].includes(dv.getUint16(2, le))) throw new Error('structure TIFF absente');
    const walk = (off, depth) => { while (off && off < bytes.length - 2 && !seen.has(off) && depth < 6) { seen.add(off); const r = readIFD(dv, off, le); list.push(r.tags); if (r.tags[330]) r.tags[330].vals().forEach((o) => walk(o, depth + 1)); if (r.tags[34665]) { /* EXIF : ignoré pour les données */ } off = r.next; } };
    walk(dv.getUint32(4, le), 0); return { dv, le, list };
  },
  decode(bytes) {
    const { dv, le, list } = this.ifds(bytes), t0 = list[0], G = (t, k, d) => (t[k] ? t[k].vals() : d), S = (t, k) => (t[k] ? t[k].str() : '');
    const make = S(t0, 271), model = S(t0, 272), isDng = !!t0[50706];
    let R = null;
    if (isDng) R = list.find((t) => G(t, 254, [1])[0] === 0 && [32803, 34892].includes(G(t, 262, [0])[0]));
    else if (/canon/i.test(make) && list[3] && G(list[3], 259, [0])[0] === 6) R = list[3];
    if (!R) R = list.filter((t) => t[256] && t[257] && (G(t, 262, [0])[0] === 32803 || (G(t, 258, [8])[0] >= 12 && [1, 6, 7, 32767].includes(G(t, 259, [1])[0])) || G(t, 259, [1])[0] === 32767)).sort((a, b) => G(b, 256)[0] * G(b, 257)[0] - G(a, 256)[0] * G(a, 257)[0])[0];
    if (!R) throw new Error('données brutes introuvables');
    const comp = G(R, 259, [1])[0], bps = G(R, 258, [16])[0], photo = G(R, 262, [32803])[0];
    if (photo === 34892) throw new Error('DNG linéaire (déjà dématricé) : ouvert via l\'aperçu');
    if (comp === 34713) throw new Error('NEF compressé Nikon : format propriétaire non pris en charge (utilisez Adobe DNG Converter, gratuit)');
    if (![1, 6, 7, 32767].includes(comp)) throw new Error('compression RAW ' + comp + ' non prise en charge');
    let W = G(R, 256)[0], Hh = G(R, 257)[0], raw;
    if (comp === 6 && R[50752]) {
      // CR2 : JPEG sans perte découpé en tranches
      const off = G(R, 273)[0], cnt = G(R, 279)[0], j = MP.lj92(bytes.subarray(off, off + cnt)), sl = G(R, 50752), rw = sl[0] * sl[1] + sl[2], rh = j.h; raw = new Uint16Array(rw * rh); W = rw; Hh = rh;
      const jw = j.w * j.nc; let row = 0, col = 0;
      for (let jrow = 0; jrow < j.h; jrow++) for (let jcol = 0; jcol < jw; jcol++) {
        let jidx = jrow * jw + jcol, i = Math.floor(jidx / (sl[1] * rh)), last = 0; if (i >= sl[0]) { i = sl[0]; last = 1; }
        jidx -= i * sl[1] * rh; const sw = last ? sl[2] : sl[1]; row = Math.floor(jidx / sw); col = (jidx % sw) + i * sl[1];
        if (row < rh && col < rw) raw[row * rw + col] = j.data[jrow * jw + jcol];
      }
    } else if (comp === 6 || comp === 7) {
      raw = new Uint16Array(W * Hh); const tiled = !!R[322], tw = tiled ? G(R, 322)[0] : W, th = tiled ? G(R, 323)[0] : G(R, 278, [Hh])[0], offs = tiled ? G(R, 324) : G(R, 273), cnts = tiled ? G(R, 325) : G(R, 279), across = Math.ceil(W / tw);
      offs.forEach((o, k) => { const j = MP.lj92(bytes.subarray(o, o + cnts[k])), ox = tiled ? (k % across) * tw : 0, oy = tiled ? Math.floor(k / across) * th : k * th, jw = j.w * j.nc; for (let y = 0; y < j.h; y++) for (let x = 0; x < jw; x++) { const X = ox + x, Y = oy + y; if (X < W && Y < Hh && x < tw) raw[Y * W + X] = j.data[y * jw + x]; } });
    } else if (comp === 32767) {
      // Sony ARW2 : blocs de 16 octets → 16 pixels
      const off = G(R, 273)[0], data = bytes.subarray(off); raw = new Uint16Array(W * Hh);
      const curve = new Uint16Array(0x4001); for (let i = 0; i < curve.length; i++) curve[i] = i;
      const sc = [0, 0, 0, 0, 0, 4095]; if (R[28688]) { const v = R[28688].vals(); for (let c = 0; c < 4; c++) sc[c + 1] = (v[c] >> 2) & 0xfff; for (let i = 0; i < 5; i++) for (let j = sc[i] + 1; j <= sc[i + 1]; j++) curve[j] = curve[j - 1] + (1 << i); }
      const rowB = W, pix = new Uint16Array(16);
      if (bps === 8) for (let row = 0; row < Hh; row++) {
        const rp = row * rowB; let col = 0;
        for (let dp = rp; col < W - 30; dp += 16) {
          const val = data[dp] | (data[dp + 1] << 8) | (data[dp + 2] << 16) | (data[dp + 3] << 24), max = val & 0x7ff, min = (val >>> 11) & 0x7ff, imax = (val >>> 22) & 15, imin = (val >>> 26) & 15; let sh = 0; while (sh < 4 && 0x80 << sh <= max - min) sh++;
          for (let bit = 30, i = 0; i < 16; i++) { if (i === imax) pix[i] = max; else if (i === imin) pix[i] = min; else { const q = dp + (bit >> 3); pix[i] = Math.min(0x7ff, ((((data[q] | (data[q + 1] << 8)) >> (bit & 7)) & 0x7f) << sh) + min); bit += 7; } }
          for (let i = 0; i < 16; i++, col += 2) raw[row * W + col] = curve[pix[i] << 1] >> 2;
          col -= col & 1 ? 1 : 31;
        }
      } else throw new Error('variante ARW non prise en charge');
    } else {
      // non compressé (8, 10, 12, 14 ou 16 bits ; empaquetage MSB comme le DNG)
      raw = new Uint16Array(W * Hh); const offs = G(R, 273), cnts = G(R, 279), rps = G(R, 278, [Hh])[0];
      let y0 = 0; for (let k = 0; k < offs.length; k++) { const o = offs[k], rows = Math.min(rps, Hh - y0); if (bps === 16) { for (let i = 0; i < rows * W; i++) raw[y0 * W + i] = dv.getUint16(o + i * 2, le); } else if (bps === 8) { for (let i = 0; i < rows * W; i++) raw[y0 * W + i] = bytes[o + i]; } else { let bit = 0; const base = o * 8; for (let i = 0; i < rows * W; i++) { let v = 0; for (let b = 0; b < bps; b++, bit++) { const q = base + bit; v = (v << 1) | ((bytes[q >> 3] >> (7 - (q & 7))) & 1); } raw[y0 * W + i] = v; } } y0 += rows; void cnts; }
    }
    // linéarisation (DNG)
    if (R[50712]) { const L = R[50712].vals(); for (let i = 0; i < raw.length; i++) raw[i] = L[Math.min(L.length - 1, raw[i])]; }
    // motif CFA
    let pat = [0, 1, 1, 2], pw = 2, xtrans = false;
    if (R[33422]) { const dim = G(R, 33421, [2, 2]); pw = dim[1]; const v = R[33422].vals(); if (dim[0] === 2 && dim[1] === 2) pat = v.slice(0, 4); else if (dim[0] === 6 && dim[1] === 6) { pat = v.slice(0, 36); xtrans = true; } else throw new Error('motif de capteur ' + dim.join('×') + ' non pris en charge'); }
    // zone active / recadrage
    let ax = 0, ay = 0, aw = W, ah = Hh;
    if (R[50829]) { const a = G(R, 50829); ay = a[0]; ax = a[1]; ah = a[2] - a[0]; aw = a[3] - a[1]; }
    else if (!isDng) { const exw = list.map((t) => t[40962] && t[40962].vals()[0]).find(Boolean); const exh = list.map((t) => t[40963] && t[40963].vals()[0]).find(Boolean); if (exw && exh && exw <= W && exh <= Hh) { ax = W - exw; ay = Hh - exh; aw = exw; ah = exh; } }
    if (R[50719] && R[50720]) { const o = G(R, 50719), s = G(R, 50720); ax += Math.round(o[0]); ay += Math.round(o[1]); aw = Math.round(s[0]); ah = Math.round(s[1]); }
    if (!xtrans) { ax &= ~1; ay &= ~1; }
    // niveaux de noir et de blanc
    let black = 0, white = (1 << Math.min(16, bps === 8 && comp === 32767 ? 12 : bps)) - 1;
    if (R[50714]) { const b = G(R, 50714); black = b.reduce((s, v) => s + v, 0) / b.length; }
    else if (!isDng && ax > 8) { const vals = []; for (let y = ay; y < ay + ah; y += 7) for (let x = 2; x < ax - 2; x += 3) vals.push(raw[y * W + x]); vals.sort((a, b) => a - b); black = vals[vals.length >> 1] || 0; }
    else if (comp === 32767) black = 128;
    if (R[50717]) white = G(R, 50717)[0]; else { let mx = 0; for (let i = 0; i < raw.length; i += 13) if (raw[i] > mx) mx = raw[i]; if (mx > black && mx < white * 0.6) white = mx; }
    // matrice couleur
    let cm = null; const ill2 = G(t0, 50779, [0])[0] || G(R, 50779, [0])[0];
    const CM1 = t0[50721] || R[50721], CM2 = t0[50722] || R[50722];
    if (CM2 && ill2 === 21) cm = CM2.vals(); else if (CM1) cm = CM1.vals(); else if (CM2) cm = CM2.vals();
    const generic = !cm; if (!cm) cm = (MAT_GENERIC[Object.keys(MAT_GENERIC).find((k) => new RegExp(k, 'i').test(make))] || MAT_GENERIC.Canon).map((v) => v / 10000);
    const neutral = t0[50728] ? t0[50728].vals() : R[50728] ? R[50728].vals() : null;
    return { raw, W, H: Hh, ax, ay, aw, ah, pat, pw, xtrans, black, white, cm, generic, neutral, make, model, isDng, comp };
  },
  /** développement : RVB linéaire (espace sRGB / D65) en virgule flottante */
  develop(r) {
    const { raw, W, ax, ay, aw, ah, pat, black, white, cm } = r, n = aw * ah, cfa = new Float32Array(n), col = (x, y) => pat[((y + ay) & 1) * 2 + ((x + ax) & 1)];
    // matrice appareil → sRGB (méthode dcraw)
    const camRgb = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += cm[i * 3 + k] * XYZ_RGB[k * 3 + j]; camRgb.push(s); }
    const pre = [0, 1, 2].map((i) => { const s = camRgb[i * 3] + camRgb[i * 3 + 1] + camRgb[i * 3 + 2]; for (let j = 0; j < 3; j++) camRgb[i * 3 + j] /= s; return 1 / s; });
    const rgbCam = MP.colorMath.inv3(camRgb);
    let mul = r.neutral ? r.neutral.map((v) => 1 / v) : null;
    const scale = 1 / Math.max(1, white - black);
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) cfa[y * aw + x] = Math.max(0, (raw[(y + ay) * W + x + ax] - black) * scale);
    if (!mul) {
      // balance des blancs automatique (monde gris, hors hautes lumières)
      const s = [0, 0, 0], c = [0, 0, 0]; for (let y = 0; y < ah; y += 3) for (let x = 0; x < aw; x += 3) { const v = cfa[y * aw + x]; if (v < 0.9 && v > 0.01) { const k = col(x, y); s[k] += v; c[k]++; } }
      const avg = s.map((v, i) => v / Math.max(1, c[i])); mul = avg.map((v) => (avg[1] || 1) / Math.max(1e-6, v)); r.autoWB = true;
    } else void pre;
    const mn = Math.min(...mul); mul = mul.map((v) => v / mn);
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { const i = y * aw + x; cfa[i] = Math.min(1, cfa[i] * mul[col(x, y)]); }
    // dématriçage Malvar-He-Cutler
    const V = (x, y) => cfa[MP.clamp(y, 0, ah - 1) * aw + MP.clamp(x, 0, aw - 1)], out = new Float32Array(n * 3);
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
      const c = col(x, y), C0 = V(x, y), o = (y * aw + x) * 3; let R, Gg, B;
      if (c === 1) {
        const rowIsR = col(x + 1, y) === 0;
        const h = (5 * C0 + 4 * (V(x - 1, y) + V(x + 1, y)) - (V(x - 2, y) + V(x + 2, y)) - (V(x - 1, y - 1) + V(x + 1, y - 1) + V(x - 1, y + 1) + V(x + 1, y + 1)) + 0.5 * (V(x, y - 2) + V(x, y + 2))) / 8;
        const v = (5 * C0 + 4 * (V(x, y - 1) + V(x, y + 1)) - (V(x, y - 2) + V(x, y + 2)) - (V(x - 1, y - 1) + V(x + 1, y - 1) + V(x - 1, y + 1) + V(x + 1, y + 1)) + 0.5 * (V(x - 2, y) + V(x + 2, y))) / 8;
        Gg = C0; if (rowIsR) { R = h; B = v; } else { B = h; R = v; }
      } else {
        const g = (4 * C0 + 2 * (V(x - 1, y) + V(x + 1, y) + V(x, y - 1) + V(x, y + 1)) - (V(x - 2, y) + V(x + 2, y) + V(x, y - 2) + V(x, y + 2))) / 8;
        const dg = (6 * C0 + 2 * (V(x - 1, y - 1) + V(x + 1, y - 1) + V(x - 1, y + 1) + V(x + 1, y + 1)) - 1.5 * (V(x - 2, y) + V(x + 2, y) + V(x, y - 2) + V(x, y + 2))) / 8;
        Gg = g; if (c === 0) { R = C0; B = dg; } else { B = C0; R = dg; }
      }
      R = Math.max(0, R); Gg = Math.max(0, Gg); B = Math.max(0, B);
      out[o] = Math.max(0, rgbCam[0] * R + rgbCam[1] * Gg + rgbCam[2] * B); out[o + 1] = Math.max(0, rgbCam[3] * R + rgbCam[4] * Gg + rgbCam[5] * B); out[o + 2] = Math.max(0, rgbCam[6] * R + rgbCam[7] * Gg + rgbCam[8] * B);
    }
    return { w: aw, h: ah, data: out, bits: 16 };
  },
};

/* =================== Ouverture : RAW, TIFF/PNG 16 bits, HDR, profils incorporés =================== */
IMAGE_EXT.push('hdr');
{
  const of6 = MP.io.openFile;
  const assignIcc = (d, icc) => { if (!icc || !d) return; try { const P = MP.icc.parse(icc); if (P.space !== 'RGB') return; if (/srgb/i.test(P.name)) { d.profile = 'sRGB'; return; } const key = Object.keys(MP.cms.BUILTIN).find((k) => P.name === MP.cms.BUILTIN[k][0]); d.profile = key || { name: P.name, bytes: icc }; MP.toast('Profil incorporé conservé : ' + P.name + ' (affichage géré)', 4000); } catch (e) { console.warn(e); } };
  const hpDoc = (f, hp, label) => { const d = new MP.Doc(hp.w, hp.h, f.name.replace(/\.[^.]+$/, '') + '.mpp'); d.bits = hp.bits; d.sourcePath = f.path; MP.hp.addLayer(d, hp, label, hp.bits === 32 ? { tone: 'filmic' } : { tone: 'linear' }); d.active = 0; d.meta = { exif: MP.exif(f.data) }; MP.addDoc(d); MP.io.addRecent(f.path); return d; };
  MP.io.openFile = async (f) => {
    const e = ext(f.name);
    try {
      if (RAW_EXT.includes(e) && MP.prefs.rawDecode !== false) {
        const res = await MP.busy('Développement RAW (données du capteur)…', async () => { try { const r = MP.raw.decode(f.data); return { r, hp: MP.raw.develop(r) }; } catch (err) { return { err }; } });
        if (res.hp) {
          const r = res.r, d = hpDoc(f, res.hp, 'RAW ' + (r.model || e.toUpperCase())); d.layers[0].smart.raw = r; d.layers[0].smart.dev = { ...MP.hp.DEV, tone: 'filmic', exposure: 0.3 }; d.layers[0].smart.src = MP.hp.render(res.hp, d.layers[0].smart.dev); MP.smart.update(d.layers[0]); MP.render();
          MP.toast(`RAW développé depuis le capteur : ${r.make} ${r.model} — ${res.hp.w} × ${res.hp.h}, 16 bits${r.generic ? ' (profil couleur générique ; un DNG donne les couleurs exactes)' : ''}${r.autoWB ? ', balance des blancs automatique' : ''}. Filtre > Camera Raw 16/32 bits pour régler.`, 7000);
          setTimeout(() => MP.hp.develop(d.layers[0]), 400); return;
        }
        MP.toast('Données brutes illisibles (' + res.err.message + ') — ouverture de l\'aperçu intégré', 6000);
      }
      if (e === 'hdr') { const hp = await MP.busy('Ouverture HDR 32 bits…', () => MP.decodeHdr(f.data)); hpDoc(f, hp, 'HDR 32 bits'); setTimeout(() => MP.hp.develop(MP.doc.layers[0]), 300); return; }
      if (e === 'png' && f.data[24] === 16) { const hp = await MP.decodePng16(f.data); if (hp) { const d = hpDoc(f, hp, 'PNG 16 bits'); assignIcc(d, hp.icc); return; } }
      if (e === 'tif' || e === 'tiff') { const c = await MP.busy('Ouverture du TIFF…', () => MP.decodeTiff(f.data)); if (c._hp) { const d = hpDoc(f, c._hp, 'TIFF ' + c._hp.bits + ' bits'); d.dpi = c._dpi || 72; assignIcc(d, c._icc); return; } const d = new MP.Doc(c.width, c.height, f.name), l = d.addLayer('Arrière-plan', 0); l.canvas = c; d.sourcePath = f.path; d.dpi = c._dpi || 72; d.meta = { exif: MP.exif(f.data) }; MP.addDoc(d); MP.io.addRecent(f.path); assignIcc(d, c._icc); return; }
    } catch (err) { MP.toast('Impossible d\'ouvrir ' + f.name + ' : ' + err.message, 5000); return; }
    const before = MP.doc; await of6(f);
    if (MP.doc && MP.doc !== before) { if (/^(jpe?g|png)$/.test(e)) assignIcc(MP.doc, await MP.extractIcc(f.data, f.name)); }
  };
}
