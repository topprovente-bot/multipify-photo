'use strict';
/* v7 (1/4) — gestion des couleurs ICC (moteur de conversion complet : profils matrice/TRC et LUT v2/v4),
   profils de travail, épreuvage avec le profil de l'imprimeur, incorporation des profils à l'export,
   images 16 et 32 bits (développement en virgule flottante), HDR (Radiance, fusion HDR), PNG/TIFF 16 bits */

/* =================== Outils colorimétriques =================== */
MP.srgbToLin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
MP.linToSrgb = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const D50 = [0.9642, 1, 0.8249];
const labF = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116), labFi = (t) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27));
const xyz2lab = (X, Y, Z) => { const fx = labF(X / D50[0]), fy = labF(Y / D50[1]), fz = labF(Z / D50[2]); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]; };
const lab2xyz = (L, a, b) => { const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200; return [labFi(fx) * D50[0], labFi(fy) * D50[1], labFi(fz) * D50[2]]; };
const inv3 = (m) => { const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C; return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det]; };
const mul3 = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
MP.colorMath = { xyz2lab, lab2xyz, inv3, mul3 };

/* =================== Lecture des profils ICC =================== */
MP.icc = {
  parse(bytes) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), str = (o, n) => String.fromCharCode(...bytes.subarray(o, o + n));
    const s15 = (o) => dv.getInt32(o) / 65536, u16 = (o) => dv.getUint16(o), u32 = (o) => dv.getUint32(o);
    const P = { bytes, version: bytes[8], cls: str(12, 4), space: str(16, 4).trim(), pcs: str(20, 4).trim(), tags: {}, name: '' };
    const curveAt = (o) => {
      const ty = str(o, 4);
      if (ty === 'curv') { const n = u32(o + 8); if (n === 0) return { f: (x) => x, len: 12 }; if (n === 1) { const g = u16(o + 12) / 256; return { f: (x) => Math.pow(Math.max(0, x), g), len: 14 }; } const T = new Float32Array(n); for (let i = 0; i < n; i++) T[i] = u16(o + 12 + i * 2) / 65535; return { f: (x) => { const p = MP.clamp(x, 0, 1) * (n - 1), i = Math.min(n - 2, p | 0), t = p - i; return T[i] * (1 - t) + T[i + 1] * t; }, len: 12 + n * 2 }; }
      if (ty === 'para') {
        const fn = u16(o + 8), np = [1, 3, 4, 5, 7][fn], [g, a, b, c, d, e, f] = Array.from({ length: np }, (_, i) => s15(o + 12 + i * 4));
        const F = [(x) => Math.pow(x, g), (x) => (x >= -b / a ? Math.pow(a * x + b, g) : 0), (x) => (x >= -b / a ? Math.pow(a * x + b, g) + c : c), (x) => (x >= d ? Math.pow(a * x + b, g) : c * x), (x) => (x >= d ? Math.pow(a * x + b, g) + e : c * x + f)][fn];
        return { f: (x) => MP.clamp(F(Math.max(0, x)), 0, 1), len: 12 + np * 4 };
      }
      throw new Error('courbe ICC inconnue : ' + ty);
    };
    const curvesAt = (o, n) => { const r = []; for (let i = 0; i < n; i++) { const c = curveAt(o); r.push(c.f); o += (c.len + 3) & ~3; } return r; };
    const clut = (o, inC, outC, grid, prec) => { const g = Array.isArray(grid) ? grid : Array(inC).fill(grid), n = g.reduce((t, v) => t * v, 1) * outC, D = new Float32Array(n); for (let i = 0; i < n; i++) D[i] = prec === 1 ? bytes[o + i] / 255 : u16(o + i * 2) / 65535; return { g, D, inC, outC }; };
    const n = u32(128);
    for (let i = 0; i < n; i++) {
      const sig = str(132 + i * 12, 4), off = u32(136 + i * 12), len = u32(140 + i * 12), ty = str(off, 4);
      try {
        if (ty === 'XYZ ') P.tags[sig] = [s15(off + 8), s15(off + 12), s15(off + 16)];
        else if (ty === 'curv' || ty === 'para') P.tags[sig] = curveAt(off).f;
        else if (ty === 'desc') P.tags[sig] = str(off + 12, Math.max(0, u32(off + 8) - 1)).replace(/\0.*$/, '');
        else if (ty === 'mluc') { const rl = u32(off + 20), ro = u32(off + 24); let s2 = ''; for (let k = 0; k < rl; k += 2) s2 += String.fromCharCode(u16(off + ro + k)); P.tags[sig] = s2.replace(/\0.*$/, ''); }
        else if (ty === 'text') P.tags[sig] = str(off + 8, len - 8).replace(/\0.*$/, '');
        else if (ty === 'mft2' || ty === 'mft1') {
          const inC = bytes[off + 8], outC = bytes[off + 9], grid = bytes[off + 10], M = Array.from({ length: 9 }, (_, k) => s15(off + 12 + k * 4)), b16 = ty === 'mft2';
          const inE = b16 ? u16(off + 48) : 256, outE = b16 ? u16(off + 50) : 256; let o = off + (b16 ? 52 : 48);
          const tab = (cnt, ent) => { const r = []; for (let c = 0; c < cnt; c++) { const T = new Float32Array(ent); for (let k = 0; k < ent; k++) T[k] = b16 ? u16(o + (c * ent + k) * 2) / 65535 : bytes[o + c * ent + k] / 255; r.push((x) => { const p = MP.clamp(x, 0, 1) * (ent - 1), j = Math.min(ent - 2, p | 0), t = p - j; return T[j] * (1 - t) + T[j + 1] * t; }); } o += cnt * ent * (b16 ? 2 : 1); return r; };
          const inT = tab(inC, inE), C = clut(o, inC, outC, grid, b16 ? 2 : 1); o += C.D.length * (b16 ? 2 : 1); const outT = tab(outC, outE);
          P.tags[sig] = { kind: 'lut', b16, inC, outC, M, inT, C, outT, ident: M.join() === '1,0,0,0,1,0,0,0,1' };
        } else if (ty === 'mAB ' || ty === 'mBA ') {
          const inC = bytes[off + 8], outC = bytes[off + 9], oB = u32(off + 12), oM = u32(off + 16), oX = u32(off + 20), oC = u32(off + 24), oA = u32(off + 28), ab = ty === 'mAB ';
          const T = { kind: ab ? 'mAB' : 'mBA', inC, outC };
          T.B = curvesAt(off + oB, ab ? outC : inC);
          if (oM) T.Mc = curvesAt(off + oM, 3);
          if (oX) T.X = Array.from({ length: 12 }, (_, k) => s15(off + oX + k * 4));
          if (oC) { const g = Array.from(bytes.subarray(off + oC, off + oC + (ab ? inC : 3))); T.C = clut(off + oC + 20, ab ? inC : 3, ab ? (oM ? 3 : outC) : outC, g, bytes[off + oC + 16]); }
          if (oA) T.A = curvesAt(off + oA, ab ? inC : outC);
          P.tags[sig] = T;
        }
      } catch (e) { console.warn('ICC', sig, e.message); }
    }
    P.name = P.tags.desc || 'Profil sans nom';
    return P;
  },
  /** interpolation multilinéaire dans une CLUT */
  interp(C, x) {
    const n = C.inC, idx = [], fr = []; let stride = C.outC; const strides = new Array(n);
    for (let d = n - 1; d >= 0; d--) { strides[d] = stride; stride *= C.g[d]; }
    for (let d = 0; d < n; d++) { const p = MP.clamp(x[d], 0, 1) * (C.g[d] - 1), i = Math.min(C.g[d] - 2, Math.floor(p)); idx.push(Math.max(0, i)); fr.push(C.g[d] > 1 ? p - Math.max(0, i) : 0); }
    const out = new Float32Array(C.outC);
    for (let m = 0; m < 1 << n; m++) { let w = 1, o = 0; for (let d = 0; d < n; d++) { const b = (m >> d) & 1; w *= b ? fr[d] : 1 - fr[d]; o += (idx[d] + (C.g[d] > 1 ? b : 0)) * strides[d]; } if (w) for (let k = 0; k < C.outC; k++) out[k] += w * C.D[o + k]; }
    return out;
  },
  evalLut(T, x) {
    if (T.kind === 'lut') { let v = x; if (!T.ident && T.inC === 3) v = mul3(T.M, v); v = v.map((u, i) => T.inT[i](u)); v = this.interp(T.C, v); return Array.from(v, (u, i) => T.outT[i](u)); }
    if (T.kind === 'mAB') { let v = x; if (T.A) v = v.map((u, i) => T.A[i](u)); if (T.C) v = Array.from(this.interp(T.C, v)); if (T.Mc) v = v.map((u, i) => T.Mc[i](u)); if (T.X) { const m = T.X; v = [m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[9], m[3] * v[0] + m[4] * v[1] + m[5] * v[2] + m[10], m[6] * v[0] + m[7] * v[1] + m[8] * v[2] + m[11]]; } return v.map((u, i) => T.B[i](u)); }
    let v = x.map((u, i) => T.B[i](u)); if (T.X) { const m = T.X; v = [m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[9], m[3] * v[0] + m[4] * v[1] + m[5] * v[2] + m[10], m[6] * v[0] + m[7] * v[1] + m[8] * v[2] + m[11]]; } if (T.Mc) v = v.map((u, i) => T.Mc[i](u)); if (T.C) v = Array.from(this.interp(T.C, v)); if (T.A) v = v.map((u, i) => T.A[i](u)); return v;
  },
  /** décodage / encodage de l'espace de connexion (PCS) */
  pcsDecode(P, T, v) { if (P.pcs === 'XYZ') return { lab: false, v: v.map((u) => (u * 65535) / 32768) }; const leg = T.kind === 'lut' && T.b16; const k = leg ? 65535 / 65280 : 1; return { lab: true, v: [v[0] * 100 * k, v[1] * 255 * k - 128, v[2] * 255 * k - 128] }; },
  pcsEncode(P, T, lab) { if (P.pcs === 'XYZ') { const x = lab2xyz(...lab); return x.map((u) => MP.clamp((u * 32768) / 65535, 0, 1)); } const leg = T.kind === 'lut' && T.b16; const k = leg ? 65280 / 65535 : 1; return [MP.clamp((lab[0] / 100) * k, 0, 1), MP.clamp(((lab[1] + 128) / 255) * k, 0, 1), MP.clamp(((lab[2] + 128) / 255) * k, 0, 1)]; },
  /** fonction appareil → Lab D50 */
  toLab(P, intent = 0) {
    const t = P.tags, T = t['A2B' + intent] || t.A2B0 || t.A2B1;
    if (T) return (x) => { const r = this.pcsDecode(P, T, this.evalLut(T, x)); return r.lab ? r.v : xyz2lab(...r.v); };
    if (P.space === 'RGB' && t.rXYZ) { const M = [t.rXYZ[0], t.gXYZ[0], t.bXYZ[0], t.rXYZ[1], t.gXYZ[1], t.bXYZ[1], t.rXYZ[2], t.gXYZ[2], t.bXYZ[2]], R = t.rTRC, G = t.gTRC, B = t.bTRC; return (x) => xyz2lab(...mul3(M, [R(x[0]), G(x[1]), B(x[2])])); }
    if (P.space === 'GRAY' && t.kTRC) return (x) => { const Y = t.kTRC(x[0]); return xyz2lab(Y * D50[0], Y, Y * D50[2]); };
    throw new Error('profil non utilisable comme source');
  },
  /** fonction Lab D50 → appareil */
  fromLab(P, intent = 0) {
    const t = P.tags, T = t['B2A' + intent] || t.B2A0 || t.B2A1;
    if (T) return (lab) => this.evalLut(T, this.pcsEncode(P, T, lab)).map((u) => MP.clamp(u, 0, 1));
    if (P.space === 'RGB' && t.rXYZ) {
      const M = inv3([t.rXYZ[0], t.gXYZ[0], t.bXYZ[0], t.rXYZ[1], t.gXYZ[1], t.bXYZ[1], t.rXYZ[2], t.gXYZ[2], t.bXYZ[2]]), inv = [t.rTRC, t.gTRC, t.bTRC].map((f) => { const N = 4096, Tb = new Float32Array(N + 1); for (let i = 0; i <= N; i++) Tb[i] = f(i / N); return (y) => { y = MP.clamp(y, 0, 1); let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Tb[m] < y) lo = m; else hi = m; } const d = Tb[hi] - Tb[lo]; return (lo + (d > 0 ? (y - Tb[lo]) / d : 0)) / N; }; });
      return (lab) => { const v = mul3(M, lab2xyz(...lab)); return [inv[0](v[0]), inv[1](v[1]), inv[2](v[2])]; };
    }
    if (P.space === 'GRAY' && t.kTRC) { const N = 4096, Tb = new Float32Array(N + 1); for (let i = 0; i <= N; i++) Tb[i] = t.kTRC(i / N); return (lab) => { const Y = lab2xyz(...lab)[1]; let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Tb[m] < Y) lo = m; else hi = m; } return [lo / N]; }; }
    throw new Error('profil non utilisable comme destination');
  },
  channels(P) { return { RGB: 3, CMYK: 4, GRAY: 1, Lab: 3 }[P.space] || 3; },
  /** conversion complète source → destination avec compensation du point noir */
  transform(src, dst, intent = 0, bpc = true) {
    const a = this.toLab(src, intent), b = this.fromLab(dst, intent), dstToLab = (() => { try { return this.toLab(dst, intent); } catch (_) { return null; } })();
    let f = (x) => b(a(x));
    if (bpc && intent !== 3 && dstToLab) {
      const blackIn = src.space === 'CMYK' ? [1, 1, 1, 1] : src.space === 'GRAY' ? [0] : [0, 0, 0];
      const Ls = a(blackIn)[0], Ld = dstToLab(dst.space === 'CMYK' ? b([0, 0, 0]) : dst.space === 'GRAY' ? [0] : [0, 0, 0])[0];
      if (Math.abs(Ls - Ld) > 0.5) f = (x) => { const l = a(x), k = (100 - Ld) / Math.max(1, 100 - Ls); l[0] = Ld + (l[0] - Ls) * k; l[1] *= k; l[2] *= k; return b(l); };
    }
    return f;
  },
  /** table 3D (ou 4D) précalculée pour appliquer une conversion à une image entière */
  lut(src, dst, intent = 0, bpc = true, grid = 33) {
    const f = this.transform(src, dst, intent, bpc), inC = this.channels(src), outC = this.channels(dst);
    if (inC === 4) grid = 11;
    const n = grid ** inC, T = new Float32Array(n * outC), idx = new Array(inC).fill(0);
    for (let i = 0; i < n; i++) { let r = i; for (let d = inC - 1; d >= 0; d--) { idx[d] = r % grid; r = (r / grid) | 0; } const o = f(idx.map((v) => v / (grid - 1))); for (let k = 0; k < outC; k++) T[i * outC + k] = o[k]; }
    return { T, grid, inC, outC, C: { g: Array(inC).fill(grid), D: T, inC, outC } };
  },
  applyLut(L, src, dst) {
    const g = L.grid - 1, n = src.length / (L.inC === 4 ? 4 : 4), { T, outC } = L, gs = L.grid;
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      if (L.inC === 3) {
        const x = (src[i] / 255) * g, y = (src[i + 1] / 255) * g, z = (src[i + 2] / 255) * g, x0 = Math.min(g - 1, x | 0), y0 = Math.min(g - 1, y | 0), z0 = Math.min(g - 1, z | 0), fx = x - x0, fy = y - y0, fz = z - z0;
        const b = ((x0 * gs + y0) * gs + z0) * outC, sy = gs * outC, sx = gs * gs * outC;
        for (let k = 0; k < outC; k++) {
          const c00 = T[b + k] * (1 - fz) + T[b + outC + k] * fz, c01 = T[b + sy + k] * (1 - fz) + T[b + sy + outC + k] * fz, c10 = T[b + sx + k] * (1 - fz) + T[b + sx + outC + k] * fz, c11 = T[b + sx + sy + k] * (1 - fz) + T[b + sx + sy + outC + k] * fz;
          dst[p * (outC === 4 ? 4 : 4) + k] = Math.round(((c00 * (1 - fy) + c01 * fy) * (1 - fx) + (c10 * (1 - fy) + c11 * fy) * fx) * 255);
        }
      } else { const o = MP.icc.interp(L.C, [src[i] / 255, src[i + 1] / 255, src[i + 2] / 255, src[i + 3] / 255]); for (let k = 0; k < outC; k++) dst[p * 4 + k] = Math.round(o[k] * 255); }
    }
  },
  /** construit un profil ICC v2 matrice/TRC (pour l'incorporer aux exports) */
  build(name, M, gamma) {
    const tags = [], txt = (s) => { const b = new ByteW(); b.str('desc').u32(0, false).u32(s.length + 1, false).str(s).u8(0).u32(0, false).u32(0, false).u16(0, false).u8(0); for (let i = 0; i < 67; i++) b.u8(0); return b.out(); };
    const xyz = (v) => { const b = new ByteW(); b.str('XYZ ').u32(0, false); v.forEach((u) => b.u32(Math.round(u * 65536) >>> 0, false)); return b.out(); };
    const curv = () => { const b = new ByteW(); b.str('curv').u32(0, false); if (gamma === 'srgb') { b.u32(1024, false); for (let i = 0; i < 1024; i++) b.u16(Math.round(MP.srgbToLin(i / 1023) * 65535), false); } else { b.u32(1, false).u16(Math.round(gamma * 256), false); } return b.out(); };
    const cprt = (() => { const b = new ByteW(); b.str('text').u32(0, false).str('No copyright, use freely').u8(0); return b.out(); })();
    tags.push(['desc', txt(name)], ['cprt', cprt], ['wtpt', xyz(D50)], ['rXYZ', xyz([M[0], M[3], M[6]])], ['gXYZ', xyz([M[1], M[4], M[7]])], ['bXYZ', xyz([M[2], M[5], M[8]])]);
    const c = curv(); tags.push(['rTRC', c], ['gTRC', c], ['bTRC', c]);
    let off = 128 + 4 + tags.length * 12; const table = new ByteW(), data = new ByteW(), seen = new Map();
    table.u32(tags.length, false);
    for (const [sig, b] of tags) { let o = seen.get(b); if (o == null) { o = off; seen.set(b, o); data.bytes(b); while (data.length % 4) data.u8(0); off = 128 + 4 + tags.length * 12 + data.length; } table.str(sig).u32(o, false).u32(b.length, false); }
    const size = 128 + table.length + data.length, h = new ByteW();
    h.u32(size, false).str('none').u32(0x02100000, false).str('mntr').str('RGB ').str('XYZ ');
    for (let i = 0; i < 6; i++) h.u16([2026, 1, 1, 0, 0, 0][i], false);
    h.str('acsp').str('MSFT').u32(0, false).str('none').str('none').u32(0, false).u32(0, false).u32(0, false);
    D50.forEach((u) => h.u32(Math.round(u * 65536), false)); h.str('MPPH'); while (h.length < 128) h.u8(0);
    const out = new Uint8Array(size); out.set(h.out()); out.set(table.out(), 128); out.set(data.out(), 128 + table.length); return out;
  },
};

/* =================== Profils intégrés et paramètres de couleur =================== */
MP.cms = {
  BUILTIN: {
    sRGB: ['sRGB IEC61966-2.1', [0.4361, 0.3851, 0.1431, 0.2225, 0.7169, 0.0606, 0.0139, 0.0971, 0.7141], 'srgb'],
    AdobeRGB: ['Adobe RGB (1998) compatible', [0.6097, 0.2053, 0.1492, 0.3111, 0.6257, 0.0632, 0.0195, 0.0609, 0.7446], 563 / 256],
    DisplayP3: ['Display P3', [0.5151, 0.2920, 0.1571, 0.2412, 0.6922, 0.0666, -0.0011, 0.0419, 0.7841], 'srgb'],
    ProPhoto: ['ProPhoto RGB compatible', [0.7977, 0.1352, 0.0313, 0.2880, 0.7119, 0.0001, 0, 0, 0.8249], 1.8],
  },
  _p: {},
  get(key) { if (!key) key = 'sRGB'; if (typeof key === 'object') return key.parsed || (key.parsed = MP.icc.parse(key.bytes)); if (this._p[key]) return this._p[key]; const b = this.BUILTIN[key]; if (!b) return this.get('sRGB'); const bytes = MP.icc.build(b[0], b[1], b[2]); return (this._p[key] = MP.icc.parse(bytes)); },
  docProfile(d) { return this.get(d && d.profile ? d.profile : 'sRGB'); },
  isSRGB(d) { return !d || !d.profile || d.profile === 'sRGB'; },
  intent() { return MP.prefs.cmIntent ?? 0; },
  /** profil CMJN de l'imprimeur (chargé par l'utilisateur) */
  cmyk: null,
  async loadStored() { try { const all = await MP.idb.all('profiles'); const c = all.find((p) => p.key === 'cmyk'); if (c) this.cmyk = { name: c.name, bytes: c.bytes, parsed: MP.icc.parse(c.bytes) }; } catch (e) { console.warn(e); } },
  async loadCmykFile() {
    const f = (await MP.native.openFiles({ multi: false, accept: '.icc,.icm', filters: [{ name: 'Profils ICC', extensions: ['icc', 'icm'] }] }))[0]; if (!f) return;
    try { const P = MP.icc.parse(f.data); if (P.space !== 'CMYK') { MP.toast('Ce profil n\'est pas un profil CMJN (' + P.space + ')', 5000); return; } MP.icc.toLab(P); MP.icc.fromLab(P); this.cmyk = { name: P.name, bytes: f.data, parsed: P }; this._luts = {}; await MP.idb.put('profiles', { key: 'cmyk', name: P.name, bytes: f.data }); MP.toast('Profil CMJN chargé : ' + P.name, 4000); MP.ui.refreshAll(); }
    catch (e) { MP.toast('Profil illisible : ' + e.message, 5000); }
  },
  _luts: {},
  lutFor(key, src, dst, intent, bpc, grid) { const k = key + '|' + intent + '|' + bpc; return this._luts[k] || (this._luts[k] = MP.icc.lut(src, dst, intent, bpc, grid)); },
  rgbToCmykLut(d) { return this.lutFor('cmyk:' + (typeof d.profile === 'object' ? d.profile.name : d.profile || 'sRGB') + ':' + this.cmyk.name, this.docProfile(d), this.cmyk.parsed, this.intent(), MP.prefs.cmBpc !== false, 17); },
  cmykToRgbInto(iccBytes, cmyk, out) { const P = MP.icc.parse(iccBytes), L = MP.icc.lut(P, this.get('sRGB'), 0, true, 9); for (let i = 0; i < cmyk.length; i += 4) { const o = MP.icc.interp(L.C, [cmyk[i] / 255, cmyk[i + 1] / 255, cmyk[i + 2] / 255, cmyk[i + 3] / 255]); out[i] = o[0] * 255; out[i + 1] = o[1] * 255; out[i + 2] = o[2] * 255; out[i + 3] = 255; } },
  /** conversion des pixels de tous les calques vers un autre profil RVB */
  convertDoc(d, toKey) {
    const from = this.docProfile(d), to = this.get(toKey), L = MP.icc.lut(from, to, this.intent(), MP.prefs.cmBpc !== false, 33);
    d.history.record('Convertir en profil', 'all');
    for (const l of d.layers) { if (l.isGroup || l.adjust) continue; const x = l.canvas.getContext('2d'), id = x.getImageData(0, 0, l.canvas.width, l.canvas.height), a = id.data, alpha = a.filter((_, i) => i % 4 === 3); MP.icc.applyLut(L, a, a); for (let i = 0; i < alpha.length; i++) a[i * 4 + 3] = alpha[i]; x.putImageData(id, 0, 0); l._v = (l._v || 0) + 1; if (l.smart) { const sx = l.smart.src.getContext('2d'), sid = sx.getImageData(0, 0, l.smart.src.width, l.smart.src.height), sa = sid.data, al = sa.filter((_, i) => i % 4 === 3); MP.icc.applyLut(L, sa, sa); for (let i = 0; i < al.length; i++) sa[i * 4 + 3] = al[i]; sx.putImageData(sid, 0, 0); } }
    d.profile = toKey; this._luts = {}; MP.afterEdit(); MP.ui.refreshAll();
  },
  profileBytes(d) { const p = d && d.profile; if (p && typeof p === 'object') return p.bytes; return this.get(p || 'sRGB').bytes; },
  profileName(d) { const p = d && d.profile; return p && typeof p === 'object' ? p.name : this.BUILTIN[p || 'sRGB'][0]; },
};
{
  // séparation CMJN : moteur ICC si un profil d'imprimeur est chargé
  const bytes0 = MP.cmyk.bytes.bind(MP.cmyk);
  MP.cmyk.bytes = (canvas) => {
    if (!MP.cms.cmyk) return bytes0(canvas);
    const d = MP.doc, L = MP.cms.rgbToCmykLut(d), id = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height), a = id.data;
    for (let i = 0; i < a.length; i += 4) { const al = a[i + 3] / 255; a[i] = a[i] * al + 255 * (1 - al); a[i + 1] = a[i + 1] * al + 255 * (1 - al); a[i + 2] = a[i + 2] * al + 255 * (1 - al); }
    const out = new Uint8Array(a.length); MP.icc.applyLut(L, a, out); return out;
  };
  // affichage géré : profil du document → écran (sRGB), épreuvage ICC, alerte de gamut ICC
  const cv6 = MP.channelView;
  MP.channelView = (d, comp) => {
    const iccProof = MP.cms.cmyk && (MP.proof || MP.gamutWarn), manage = !MP.cms.isSRGB(d) && MP.prefs.cmDisplay !== false;
    if (!iccProof && !manage) return cv6(d, comp);
    const pr = MP.proof, gw = MP.gamutWarn; MP.proof = false; MP.gamutWarn = false; let c; try { c = cv6(d, comp); } finally { MP.proof = pr; MP.gamutWarn = gw; }
    const key = `${d.rev}|${pr}|${gw}|${MP.viewChannel}|${MP.cms.cmyk && MP.cms.cmyk.name}|${typeof d.profile === 'object' ? d.profile.name : d.profile}`; if (d._cmKey === key && d._cmC) return d._cmC;
    const src = MP.cms.docProfile(d), srgb = MP.cms.get('sRGB');
    let L; if (iccProof && pr) { const P = MP.cms.cmyk.parsed, a = MP.icc.transform(src, P, MP.cms.intent(), MP.prefs.cmBpc !== false), b = MP.icc.transform(P, srgb, 1, false); L = MP.cms.lutFor('proof:' + (typeof d.profile === 'object' ? d.profile.name : d.profile) + MP.cms.cmyk.name, { space: 'RGB', _f: (x) => b(a(x)) }, null, 0, 0, 25); }
    else L = MP.cms.lutFor('disp:' + (typeof d.profile === 'object' ? d.profile.name : d.profile), src, srgb, 1, false, 33);
    let G = null; if (iccProof && gw) G = MP.cms.lutFor('gamut:' + MP.cms.cmyk.name + (typeof d.profile === 'object' ? d.profile.name : d.profile), { space: 'RGB', _g: true, src }, null, 0, 0, 25);
    const out = d._cmC && d._cmC.width === d.width && d._cmC.height === d.height ? d._cmC : MP.createCanvas(d.width, d.height), x = out.getContext('2d'); x.clearRect(0, 0, d.width, d.height); x.drawImage(c, 0, 0);
    const id = x.getImageData(0, 0, d.width, d.height), a = id.data, tmp = new Uint8ClampedArray(a.length); MP.icc.applyLut(L, a, tmp);
    let gm = null; if (G) { gm = new Uint8ClampedArray(a.length); MP.icc.applyLut(G, a, gm); }
    for (let i = 0; i < a.length; i += 4) { if (gm && gm[i] > 127) { a[i] = a[i + 1] = a[i + 2] = 128; continue; } a[i] = tmp[i]; a[i + 1] = tmp[i + 1]; a[i + 2] = tmp[i + 2]; }
    x.putImageData(id, 0, 0); d._cmC = out; d._cmKey = key; return out;
  };
  // transformations « composées » utilisées pour les tables d'épreuvage et de gamut
  const lut0 = MP.icc.lut.bind(MP.icc);
  MP.icc.lut = (src, dst, intent, bpc, grid = 33) => {
    if (src && src._f) { const n = grid ** 3, T = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const o = src._f([Math.floor(i / grid / grid) / (grid - 1), (Math.floor(i / grid) % grid) / (grid - 1), (i % grid) / (grid - 1)]); T[i * 3] = o[0]; T[i * 3 + 1] = o[1]; T[i * 3 + 2] = o[2]; } return { T, grid, inC: 3, outC: 3, C: { g: [grid, grid, grid], D: T, inC: 3, outC: 3 } }; }
    if (src && src._g) { const P = MP.cms.cmyk.parsed, toLab = MP.icc.toLab(src.src, 1), fwd = MP.icc.transform(src.src, P, 1, false), back = MP.icc.toLab(P, 1), n = grid ** 3, T = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const x = [Math.floor(i / grid / grid) / (grid - 1), (Math.floor(i / grid) % grid) / (grid - 1), (i % grid) / (grid - 1)], l1 = toLab(x), l2 = back(fwd(x)), dE = Math.hypot(l1[0] - l2[0], l1[1] - l2[1], l1[2] - l2[2]); T[i * 3] = dE > 6 ? 1 : 0; } return { T, grid, inC: 3, outC: 3, C: { g: [grid, grid, grid], D: T, inC: 3, outC: 3 } }; }
    return lut0(src, dst, intent, bpc, grid);
  };
}

/* =================== Incorporation des profils dans les exports =================== */
const zlib = async (b) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
const unzlib = async (b) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
const pngChunk = (type, data) => { const w = new ByteW(); w.u32(data.length, false).str(type).bytes(data); const c = w.out(); const o = new ByteW(); o.bytes(c).u32(crc32(c.subarray(4)), false); return o.out(); };
const insertAfterIHDR = (png, chunks) => { const at = 33, extra = chunks.reduce((t, c) => t + c.length, 0), out = new Uint8Array(png.length + extra); out.set(png.subarray(0, at)); let p = at; for (const c of chunks) { out.set(c, p); p += c.length; } out.set(png.subarray(at), p); return out; };
{
  const png0 = MP.enc.png, jpg0 = MP.enc.jpeg, tif0 = MP.enc.tiff, pdf0 = MP.enc.pdf;
  const iccOf = () => (MP.prefs.embedICC === false || !MP.doc ? null : MP.cms.profileBytes(MP.doc));
  MP.enc.png = async (canvas, o = {}) => { const b = await png0(canvas, o), icc = o.icc === undefined ? iccOf() : o.icc; if (!icc) return b; const w = new ByteW(); w.str('ICC profile').u8(0).u8(0).bytes(await zlib(icc)); return insertAfterIHDR(b, [pngChunk('iCCP', w.out())]); };
  MP.enc.jpeg = async (canvas, q, o = {}) => {
    let b = await jpg0(canvas, q, o); const icc = o.icc === undefined ? iccOf() : o.icc; if (!icc) return b;
    { const keep = [b.subarray(0, 2)]; let p = 2; while (p < b.length - 4 && b[p] === 0xff && b[p + 1] !== 0xda) { const len = (b[p + 2] << 8) | b[p + 3]; if (!(b[p + 1] === 0xe2 && b[p + 4] === 0x49 && b[p + 5] === 0x43)) keep.push(b.subarray(p, p + 2 + len)); p += 2 + len; } keep.push(b.subarray(p)); const t = keep.reduce((s2, x) => s2 + x.length, 0), nb = new Uint8Array(t); let q2 = 0; for (const x of keep) { nb.set(x, q2); q2 += x.length; } b = nb; }
    const segs = [], max = 65519, n = Math.ceil(icc.length / max); for (let i = 0; i < n; i++) { const part = icc.subarray(i * max, (i + 1) * max), w = new ByteW(); w.u8(0xff).u8(0xe2).u16(part.length + 16, false).str('ICC_PROFILE').u8(0).u8(i + 1).u8(n).bytes(part); segs.push(w.out()); }
    const at = b[3] === 0xe0 ? 4 + ((b[4] << 8) | b[5]) : 2, tot = segs.reduce((t, s) => t + s.length, 0), out = new Uint8Array(b.length + tot); out.set(b.subarray(0, at)); let p = at; for (const s of segs) { out.set(s, p); p += s.length; } out.set(b.subarray(at), p); return out;
  };
  MP.enc.tiff = (canvas, o = {}) => MP.enc.tiffX({ canvas, ...o, icc: o.icc === undefined ? (o.cmyk ? (MP.cms.cmyk && MP.cms.cmyk.bytes) : iccOf()) : o.icc });
  MP.enc.pdf = (pages, o = {}) => pdf0(pages, { ...o, icc: o.icc === undefined ? (o.cmyk ? MP.cms.cmyk && MP.cms.cmyk.bytes : iccOf()) : o.icc, outputIntent: o.cmyk && MP.cms.cmyk ? MP.cms.cmyk : null });
  void tif0;
}
/** TIFF général : RVB(A) 8/16 bits, CMJN 8 bits, flottant 32 bits, profil ICC, métadonnées */
MP.enc.tiffX = ({ canvas, hp = null, bits = 8, cmyk = false, dpi = 72, meta = {}, icc = null, alpha = true }) => {
  const w = hp ? hp.w : canvas.width, h = hp ? hp.h : canvas.height;
  let spp, bps, pix;
  if (cmyk) { spp = 4; bps = 8; pix = MP.cmyk.bytes(canvas); }
  else if (hp && bits === 32) { spp = 3; bps = 32; pix = new Uint8Array(hp.data.buffer.slice(hp.data.byteOffset, hp.data.byteOffset + hp.data.byteLength)); }
  else if (bits === 16) {
    spp = alpha ? 4 : 3; bps = 16; const n = w * h, buf = new Uint16Array(n * spp);
    if (hp) { const dev = hp.devFn || ((r, g, b) => [MP.linToSrgb(r), MP.linToSrgb(g), MP.linToSrgb(b)]); for (let i = 0; i < n; i++) { const o = dev(hp.data[i * 3], hp.data[i * 3 + 1], hp.data[i * 3 + 2]); for (let k = 0; k < 3; k++) buf[i * spp + k] = MP.clamp(Math.round(o[k] * 65535), 0, 65535); if (spp === 4) buf[i * spp + 3] = 65535; } }
    else { const a = canvas.getContext('2d').getImageData(0, 0, w, h).data; for (let i = 0; i < n; i++) for (let k = 0; k < spp; k++) buf[i * spp + k] = a[i * 4 + k] * 257; }
    pix = new Uint8Array(buf.buffer);
  } else { spp = alpha ? 4 : 3; bps = 8; const a = canvas.getContext('2d').getImageData(0, 0, w, h).data; if (alpha) pix = new Uint8Array(a.buffer.slice(0)); else { pix = new Uint8Array(w * h * 3); for (let i = 0; i < w * h; i++) { pix[i * 3] = a[i * 4]; pix[i * 3 + 1] = a[i * 4 + 1]; pix[i * 3 + 2] = a[i * 4 + 2]; } } }
  const T = [], blobs = {}; const tag = (id, type, count, val) => T.push({ id, type, count, val });
  const str = (k, s) => { blobs[k] = new TextEncoder().encode(latin1(s) + '\0'); };
  tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, spp, 'bps'); tag(259, 3, 1, 1); tag(262, 3, 1, cmyk ? 5 : 2);
  if (meta.description) { str('desc', meta.description); tag(270, 2, 0, 'desc'); }
  tag(273, 4, 1, 'data'); tag(277, 3, 1, spp); tag(278, 4, 1, h); tag(279, 4, 1, pix.length); tag(282, 5, 1, 'xres'); tag(283, 5, 1, 'yres'); tag(284, 3, 1, 1); tag(296, 3, 1, 2);
  str('sw', 'Multipify Photo'); tag(305, 2, 0, 'sw'); if (meta.author) { str('art', meta.author); tag(315, 2, 0, 'art'); }
  if (spp === 4 && !cmyk) tag(338, 3, 1, 2); if (bps === 32) tag(339, 3, 1, 3);
  if (meta.copyright) { str('cpy', meta.copyright); tag(33432, 2, 0, 'cpy'); }
  if (icc) { blobs.icc = icc; tag(34675, 7, 0, 'icc'); }
  T.sort((p, q) => p.id - q.id);
  blobs.bps = new Uint8Array(new Uint16Array(Array(spp).fill(bps)).buffer); const rat = new Uint8Array(new Uint32Array([dpi, 1]).buffer); blobs.xres = rat; blobs.yres = rat.slice();
  const ifdLen = 2 + T.length * 12 + 4; let extra = 8 + ifdLen; const at = {};
  for (const t of T) { const b = blobs[t.val]; if (b && b.length > 4) { at[t.val] = extra; extra += b.length + (b.length & 1); } }
  const o = new ByteW(); o.str('II').u16(42).u32(8).u16(T.length);
  for (const t of T) {
    o.u16(t.id).u16(t.type); const b = blobs[t.val];
    if (b) { o.u32(t.type === 3 ? b.length / 2 : t.type === 5 ? 1 : b.length); if (b.length <= 4) { o.bytes(b); for (let k = b.length; k < 4; k++) o.u8(0); } else o.u32(at[t.val]); continue; }
    o.u32(t.count); if (t.val === 'data') o.u32(extra); else if (t.type === 3) o.u16(t.val).u16(0); else o.u32(t.val);
  }
  o.u32(0);
  for (const t of T) { const b = blobs[t.val]; if (b && b.length > 4) { o.bytes(b); if (b.length & 1) o.u8(0); } }
  const head = o.out(), out = new Uint8Array(extra + pix.length); out.set(head); out.set(pix, extra); return out;
};
/** PNG 16 bits (RVB ou RVBA) */
MP.enc.png16 = async (canvas, hp, { icc = null, dpi = 72 } = {}) => {
  const w = hp ? hp.w : canvas.width, h = hp ? hp.h : canvas.height, spp = hp ? 3 : 4, row = 1 + w * spp * 2, raw = new Uint8Array(row * h), a = hp ? null : canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const dev = hp && (hp.devFn || ((r, g, b) => [MP.linToSrgb(r), MP.linToSrgb(g), MP.linToSrgb(b)]));
  for (let y = 0; y < h; y++) { raw[y * row] = 0; for (let x = 0; x < w; x++) { const i = y * w + x, vals = hp ? dev(hp.data[i * 3], hp.data[i * 3 + 1], hp.data[i * 3 + 2]).map((v) => MP.clamp(Math.round(v * 65535), 0, 65535)) : [a[i * 4] * 257, a[i * 4 + 1] * 257, a[i * 4 + 2] * 257, a[i * 4 + 3] * 257]; for (let k = 0; k < spp; k++) { const p = y * row + 1 + (x * spp + k) * 2; raw[p] = vals[k] >> 8; raw[p + 1] = vals[k] & 255; } } }
  const ih = new ByteW(); ih.u32(w, false).u32(h, false).u8(16).u8(spp === 4 ? 6 : 2).u8(0).u8(0).u8(0);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ih.out())];
  if (icc) { const c = new ByteW(); c.str('ICC profile').u8(0).u8(0).bytes(await zlib(icc)); parts.push(pngChunk('iCCP', c.out())); }
  const ph = new ByteW(); const ppm = Math.round(dpi / 0.0254); ph.u32(ppm, false).u32(ppm, false).u8(1); parts.push(pngChunk('pHYs', ph.out()));
  parts.push(pngChunk('IDAT', await zlib(raw)), pngChunk('IEND', new Uint8Array(0)));
  return new Uint8Array(await new Blob(parts).arrayBuffer());
};
/** Radiance HDR (RGBE, 32 bits flottants) */
MP.enc.hdr = (hp) => {
  const head = new TextEncoder().encode(`#?RADIANCE\n# Multipify Photo\nFORMAT=32-bit_rle_rgbe\n\n-Y ${hp.h} +X ${hp.w}\n`), out = new Uint8Array(head.length + hp.w * hp.h * 4); out.set(head);
  for (let i = 0; i < hp.w * hp.h; i++) { const r = hp.data[i * 3], g = hp.data[i * 3 + 1], b = hp.data[i * 3 + 2], m = Math.max(r, g, b), o = head.length + i * 4; if (m < 1e-32) continue; const e = Math.ceil(Math.log2(m) + 1e-9), f = 256 / Math.pow(2, e); out[o] = Math.min(255, r * f); out[o + 1] = Math.min(255, g * f); out[o + 2] = Math.min(255, b * f); out[o + 3] = e + 128; }
  return out;
};
MP.decodeHdr = (bytes) => {
  let p = 0; const line = () => { let s = ''; while (p < bytes.length && bytes[p] !== 10) s += String.fromCharCode(bytes[p++]); p++; return s; };
  if (!line().startsWith('#?')) throw new Error('fichier HDR invalide'); let l; while ((l = line()) !== '');
  const m = line().match(/-Y (\d+) \+X (\d+)/); if (!m) throw new Error('orientation HDR non prise en charge'); const H = +m[1], W = +m[2], data = new Float32Array(W * H * 3), sc = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    if (W >= 8 && W < 32768 && bytes[p] === 2 && bytes[p + 1] === 2 && !(bytes[p + 2] & 0x80)) { p += 4; for (let c = 0; c < 4; c++) { let x = 0; while (x < W) { let n = bytes[p++]; if (n > 128) { n -= 128; const v = bytes[p++]; while (n--) sc[(x++) * 4 + c] = v; } else while (n--) sc[(x++) * 4 + c] = bytes[p++]; } } }
    else { for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) sc[x * 4 + c] = bytes[p++]; }
    for (let x = 0; x < W; x++) { const e = sc[x * 4 + 3], i = (y * W + x) * 3; if (!e) continue; const f = Math.pow(2, e - 136); data[i] = (sc[x * 4] + 0.5) * f; data[i + 1] = (sc[x * 4 + 1] + 0.5) * f; data[i + 2] = (sc[x * 4 + 2] + 0.5) * f; }
  }
  return { w: W, h: H, data, bits: 32 };
};
/** PNG 16 bits (le moteur du navigateur les réduit à 8 bits) */
MP.decodePng16 = async (bytes) => {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let p = 8, ihdr = null; const idat = []; let icc = null;
  while (p < bytes.length) { const len = dv.getUint32(p), type = String.fromCharCode(...bytes.subarray(p + 4, p + 8)), data = bytes.subarray(p + 8, p + 8 + len); if (type === 'IHDR') ihdr = { w: dv.getUint32(p + 8), h: dv.getUint32(p + 12), bd: data[8], ct: data[9], il: data[12] }; else if (type === 'IDAT') idat.push(data); else if (type === 'iCCP') { const z = data.indexOf(0); icc = await unzlib(data.subarray(z + 2)); } p += 12 + len; }
  if (!ihdr || ihdr.bd !== 16 || ihdr.il) return null;
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.ct]; if (!ch) return null;
  const raw = await unzlib(await new Blob(idat).arrayBuffer().then((b) => new Uint8Array(b))), bpp = ch * 2, row = ihdr.w * bpp, img = new Uint8Array(row * ihdr.h);
  for (let y = 0; y < ihdr.h; y++) { const f = raw[y * (row + 1)], s = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1)), o = y * row; for (let x = 0; x < row; x++) { const a = x >= bpp ? img[o + x - bpp] : 0, b = y ? img[o - row + x] : 0, c = x >= bpp && y ? img[o - row + x - bpp] : 0; let v = s[x]; if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } img[o + x] = v & 255; } }
  const n = ihdr.w * ihdr.h, data = new Float32Array(n * 3), alpha = ch === 2 || ch === 4 ? new Uint8ClampedArray(n) : null, V = (i, k) => ((img[(i * ch + k) * 2] << 8) | img[(i * ch + k) * 2 + 1]) / 65535;
  for (let i = 0; i < n; i++) { if (ch >= 3) { data[i * 3] = MP.srgbToLin(V(i, 0)); data[i * 3 + 1] = MP.srgbToLin(V(i, 1)); data[i * 3 + 2] = MP.srgbToLin(V(i, 2)); } else data[i * 3] = data[i * 3 + 1] = data[i * 3 + 2] = MP.srgbToLin(V(i, 0)); if (alpha) alpha[i] = V(i, ch - 1) * 255; }
  return { w: ihdr.w, h: ihdr.h, data, alpha, bits: 16, icc };
};
MP.extractIcc = async (bytes, name) => {
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) { const parts = []; let p = 2; while (p < bytes.length - 4 && bytes[p] === 0xff) { const m = bytes[p + 1], len = (bytes[p + 2] << 8) | bytes[p + 3]; if (m === 0xe2 && String.fromCharCode(...bytes.subarray(p + 4, p + 15)) === 'ICC_PROFILE') parts[bytes[p + 16] - 1] = bytes.subarray(p + 18, p + 2 + len); if (m === 0xda) break; p += 2 + len; } if (parts.length) { const t = parts.reduce((s, x) => s + x.length, 0), o = new Uint8Array(t); let q = 0; for (const x of parts) { o.set(x, q); q += x.length; } return o; } }
    if (bytes[0] === 0x89 && bytes[1] === 0x50) { const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let p = 8; while (p < bytes.length) { const len = dv.getUint32(p), type = String.fromCharCode(...bytes.subarray(p + 4, p + 8)); if (type === 'iCCP') { const d = bytes.subarray(p + 8, p + 8 + len), z = d.indexOf(0); return await unzlib(d.subarray(z + 2)); } if (type === 'IDAT') break; p += 12 + len; } }
  } catch (e) { console.warn(e); }
  void name; return null;
};

/* =================== Images 16 et 32 bits : développement en virgule flottante =================== */
MP.hp = {
  DEV: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temp: 0, tint: 0, vibrance: 0, saturation: 0, tone: 'filmic', gamma: 1 },
  /** fonction de développement : RVB linéaire → valeurs encodées 0..1 (précision flottante) */
  devFn(dev) {
    const v = { ...this.DEV, ...(dev || {}) }, E = Math.pow(2, v.exposure), wr = Math.pow(2, v.temp / 100 * 0.6 + v.tint / 100 * 0.15), wg = Math.pow(2, -v.tint / 100 * 0.3), wb = Math.pow(2, -v.temp / 100 * 0.6 + v.tint / 100 * 0.15);
    const tm = v.tone === 'reinhard' ? (x) => x / (1 + x) * 1.1 : v.tone === 'linear' ? (x) => Math.min(1, x) : (x) => { const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return MP.clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1); };
    const C = v.contrast / 100, hi = v.highlights / 100, sh = v.shadows / 100, wh = v.whites / 100, bl = v.blacks / 100, vib = v.vibrance / 100, sat = v.saturation / 100, g = 1 / v.gamma;
    return (r, gg, b) => {
      r *= E * wr; gg *= E * wg; b *= E * wb;
      const Y = 0.2126 * r + 0.7152 * gg + 0.0722 * b, lY = Math.log2(Math.max(1e-6, Y) / 0.18);
      const k = Math.pow(2, sh * 1.5 * Math.max(0, Math.min(1, -lY / 4)) - hi * 1.5 * Math.max(0, Math.min(1, lY / 3 + 0.3)));
      r *= k; gg *= k; b *= k;
      let o = [tm(r), tm(gg), tm(b)].map((x) => Math.pow(MP.linToSrgb(x), g));
      if (C) o = o.map((x) => MP.clamp(x + C * 0.5 * Math.sin((x - 0.5) * Math.PI) * 0.6, 0, 1));
      if (wh || bl) o = o.map((x) => MP.clamp((x - bl * 0.15) / (1 + wh * 0.3 - bl * 0.15), 0, 1));
      if (vib || sat) { const m = (o[0] + o[1] + o[2]) / 3, s = Math.max(...o) - Math.min(...o), f = 1 + sat + vib * (1 - s); o = o.map((x) => MP.clamp(m + (x - m) * f, 0, 1)); }
      return o;
    };
  },
  /** rend une image haute précision en toile 8 bits (avec tramage pour éviter les cassures de dégradé) */
  render(hp, dev, scale = 1) {
    const W = Math.max(1, Math.round(hp.w * scale)), H = Math.max(1, Math.round(hp.h * scale)), c = MP.createCanvas(W, H), x = c.getContext('2d'), id = x.createImageData(W, H), a = id.data, f = this.devFn(dev);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const sx = Math.min(hp.w - 1, Math.floor(xx / scale)), sy = Math.min(hp.h - 1, Math.floor(y / scale)), i = (sy * hp.w + sx) * 3, o = f(hp.data[i], hp.data[i + 1], hp.data[i + 2]), j = (y * W + xx) * 4, n = Math.random() - 0.5;
      a[j] = o[0] * 255 + n; a[j + 1] = o[1] * 255 + n; a[j + 2] = o[2] * 255 + n; a[j + 3] = hp.alpha ? hp.alpha[sy * hp.w + sx] : 255;
    }
    x.putImageData(id, 0, 0); return c;
  },
  /** crée un calque objet dynamique haute précision */
  addLayer(d, hp, name, dev) {
    const l = d.addLayer(name || (hp.bits === 32 ? 'HDR 32 bits' : 'Image 16 bits'), d.layers.length);
    const src = this.render(hp, dev); l.smart = { src, m: { cx: hp.w / 2, cy: hp.h / 2, sx: d.width / hp.w, sy: d.height / hp.h, angle: 0 }, filters: [], hp, dev: { ...this.DEV, ...(dev || {}) } };
    const keep = MP.doc; MP.doc = d; try { MP.smart.update(l); } finally { MP.doc = keep; } this.pack(l); return l;
  },
  /** développement : boîte de dialogue avec aperçu rapide */
  develop(l) {
    const d = MP.doc; l = l || d.layer; if (!l.smart || !l.smart.hp) { MP.toast('Le calque actif n\'est pas une image 16/32 bits (ouvrez un RAW, un TIFF/PNG 16 bits ou un HDR)'); return; }
    const hp = l.smart.hp, vals = { ...this.DEV, ...l.smart.dev }, sc = Math.min(1, 900 / Math.max(hp.w, hp.h)), keep = l.smart.src;
    const prev = (v) => { const c = this.render(hp, v, sc), big = MP.createCanvas(hp.w, hp.h); big.getContext('2d').drawImage(c, 0, 0, hp.w, hp.h); l.smart.src = big; MP.smart.update(l); };
    d.history.record('Développement ' + hp.bits + ' bits', [l.id]);
    MP.ui.dialog({ title: `Camera Raw — développement ${hp.bits} bits (${hp.w} × ${hp.h})`, width: 460, preview: true, values: vals,
      fields: [{ k: 'exposure', label: 'Exposition (IL)', type: 'range', min: -5, max: 5, step: 0.05 }, { k: 'contrast', label: 'Contraste', type: 'range', min: -100, max: 100 }, { k: 'highlights', label: 'Hautes lumières', type: 'range', min: -100, max: 100 }, { k: 'shadows', label: 'Ombres', type: 'range', min: -100, max: 100 }, { k: 'whites', label: 'Blancs', type: 'range', min: -100, max: 100 }, { k: 'blacks', label: 'Noirs', type: 'range', min: -100, max: 100 }, { type: 'header', label: 'Couleur' }, { k: 'temp', label: 'Température', type: 'range', min: -100, max: 100 }, { k: 'tint', label: 'Teinte', type: 'range', min: -100, max: 100 }, { k: 'vibrance', label: 'Vibrance', type: 'range', min: -100, max: 100 }, { k: 'saturation', label: 'Saturation', type: 'range', min: -100, max: 100 }, { type: 'header', label: 'Virage HDR (32 bits → écran)' }, { k: 'tone', label: 'Méthode', type: 'select', options: [['filmic', 'Filmique (ACES)'], ['reinhard', 'Adaptation locale douce (Reinhard)'], ['linear', 'Exposition et gamma']] }, { k: 'gamma', label: 'Gamma', type: 'range', min: 0.5, max: 2, step: 0.01 }],
      onChange: (v) => prev(v),
      onOk: (v) => MP.busy('Développement en pleine résolution…', () => { l.smart.dev = { ...v }; l.smart.src = this.render(hp, v); MP.smart.update(l); MP.afterEdit(); }),
      onCancel: () => { l.smart.src = keep; MP.smart.update(l); d.history.undoStack.pop(); } });
  },
  /** conversion du document en 8 / 16 / 32 bits */
  setDocBits(bits) {
    const d = MP.doc;
    if (bits === 8) { const ls = d.layers.filter((l) => l.smart && l.smart.hp); if (!ls.length) { d.bits = 8; MP.toast('Le document est en 8 bits'); return; } d.history.record('8 bits par couche', null); ls.forEach((l) => { l.smart.hp = null; l.smart.hpPack = null; }); d.bits = 8; MP.ui.refreshAll(); MP.toast('Données haute précision supprimées : document en 8 bits'); return; }
    MP.busy('Conversion en ' + bits + ' bits…', () => {
      const l = d.layer; if (l.isGroup || l.adjust) { MP.toast('Sélectionnez un calque de pixels'); return; }
      if (l.smart && l.smart.hp) { l.smart.hp.bits = bits; d.bits = bits; MP.toast('Calque en ' + bits + ' bits'); return; }
      d.history.record(bits + ' bits par couche', [l.id]);
      const c = l.smart ? l.smart.src : l.canvas, a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, data = new Float32Array(n * 3), alpha = new Uint8ClampedArray(n);
      for (let i = 0; i < n; i++) { data[i * 3] = MP.srgbToLin(a[i * 4] / 255); data[i * 3 + 1] = MP.srgbToLin(a[i * 4 + 1] / 255); data[i * 3 + 2] = MP.srgbToLin(a[i * 4 + 2] / 255); alpha[i] = a[i * 4 + 3]; }
      const hp = { w: c.width, h: c.height, data, alpha, bits };
      if (l.smart) { l.smart.hp = hp; l.smart.dev = { ...this.DEV, tone: 'linear' }; } else { l.smart = { src: MP.cloneCanvas(c), m: { cx: c.width / 2, cy: c.height / 2, sx: 1, sy: 1, angle: 0 }, filters: [], hp, dev: { ...this.DEV, tone: 'linear' } }; MP.smart.update(l); }
      this.pack(l); d.bits = bits; MP.afterEdit(); MP.toast(`Calque converti en ${bits} bits — Filtre > Camera Raw ${bits} bits pour le développer sans perte`, 5000);
    });
  },
  /** fusion HDR (radiance 32 bits) à partir de plusieurs expositions */
  async merge(files) {
    if (!files || files.length < 2) { MP.toast('Choisissez au moins 2 photos de la même scène à des expositions différentes'); return; }
    await MP.busy('Fusion HDR Pro…', async () => {
      const imgs = []; for (const f of files) { const c = await MP.io.loadImage(f.data, f.name), ex = MP.exif(f.data); imgs.push({ c, t: ex && ex.exposure ? (ex.exposure.startsWith('1/') ? 1 / +ex.exposure.slice(2, -2) : parseFloat(ex.exposure)) : null }); }
      const W = imgs[0].c.width, H = imgs[0].c.height; imgs.forEach((o) => { if (o.c.width !== W || o.c.height !== H) { const n = MP.createCanvas(W, H); n.getContext('2d').drawImage(o.c, 0, 0, W, H); o.c = n; } });
      for (let i = 1; i < imgs.length; i++) { const r = MP.estimateShift(imgs[0].c, imgs[i].c, { rx: [-0.05, 0.05], ry: [-0.05, 0.05], minOv: 0.6 }); if (r && (r.dx || r.dy)) { const n = MP.createCanvas(W, H); n.getContext('2d').drawImage(imgs[i].c, r.dx, r.dy); imgs[i].c = n; } }
      const px = imgs.map((o) => o.c.getContext('2d').getImageData(0, 0, W, H).data), mean = px.map((a) => { let s = 0; for (let i = 0; i < a.length; i += 64) s += MP.srgbToLin((a[i] + a[i + 1] + a[i + 2]) / 765); return s; });
      if (imgs.some((o) => !o.t)) { const ref = mean[0]; imgs.forEach((o, i) => (o.t = mean[i] / Math.max(1e-6, ref))); }
      const data = new Float32Array(W * H * 3), w = (v) => { const x = v / 255; return Math.max(0.001, 1 - Math.pow(2 * x - 1, 12)); };
      for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) { let s = 0, ws = 0; for (let k = 0; k < imgs.length; k++) { const v = px[k][i * 4 + c], ww = w(v); s += ww * MP.srgbToLin(v / 255) / imgs[k].t; ws += ww; } data[i * 3 + c] = s / ws; }
      let Y = 0; for (let i = 0; i < data.length; i += 30) Y += data[i] + data[i + 1] + data[i + 2]; Y /= (data.length / 30) * 3; const norm = 0.18 / Math.max(1e-6, Y); for (let i = 0; i < data.length; i++) data[i] *= norm;
      const d = new MP.Doc(W, H, 'Fusion HDR.mpp'); d.bits = 32; this.addLayer(d, { w: W, h: H, data, bits: 32 }, 'HDR 32 bits (' + imgs.length + ' expositions)', { tone: 'filmic' }); d.layers = d.layers.filter((l) => l.smart); d.active = 0; MP.addDoc(d);
      setTimeout(() => this.develop(d.layers[0]), 300);
    });
  },
  /** sérialisation compacte (demi-flottants compressés) pour les fichiers .mpp */
  async pack(l) {
    const hp = l.smart && l.smart.hp; if (!hp) return; const n = hp.data.length, h16 = new Uint16Array(n), f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
    for (let i = 0; i < n; i++) { f32[0] = hp.data[i]; const x = u32[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff; h16[i] = e <= 0 ? s : e >= 31 ? s | 0x7c00 : s | (e << 10) | (m >>> 13); }
    const z = await zlib(new Uint8Array(h16.buffer)); let bin = ''; for (let i = 0; i < z.length; i += 0x8000) bin += String.fromCharCode(...z.subarray(i, i + 0x8000));
    l.smart.hpPack = { w: hp.w, h: hp.h, bits: hp.bits, z: btoa(bin), alpha: hp.alpha ? MP.cloneCanvas(l.smart.src).toDataURL('image/png') : null };
  },
  async unpack(p) {
    const bin = atob(p.z), z = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) z[i] = bin.charCodeAt(i);
    const h16 = new Uint16Array((await unzlib(z)).buffer), data = new Float32Array(h16.length);
    for (let i = 0; i < h16.length; i++) { const h = h16[i], s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; data[i] = e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? s * 65504 : s * Math.pow(2, e - 15) * (1 + m / 1024); }
    return { w: p.w, h: p.h, data, bits: p.bits };
  },
};
{
  // enregistrement des données haute précision, des profils et du mode dans les .mpp
  const ser = MP.io.serialize.bind(MP.io), op = MP.io.openProject.bind(MP.io);
  MP.io.serialize = (d) => {
    const j = JSON.parse(ser(d)); j.version = 7; j.bits = d.bits || 8; j.profile = typeof d.profile === 'object' ? { name: d.profile.name, b64: btoa(String.fromCharCode(...d.profile.bytes)) } : d.profile || 'sRGB'; j.comments = d.comments || [];
    d.layers.forEach((l, i) => { if (l.smart && l.smart.hp && l.smart.hpPack) { j.layers[i].smart.hp = l.smart.hpPack; j.layers[i].smart.dev = l.smart.dev; } });
    return JSON.stringify(j);
  };
  MP.io.openProject = async (f) => {
    await op(f); const j = JSON.parse(new TextDecoder().decode(f.data)), d = MP.doc; d.bits = j.bits || 8; d.comments = j.comments || [];
    if (j.profile && typeof j.profile === 'object') { const b = atob(j.profile.b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); d.profile = { name: j.profile.name, bytes: u }; } else d.profile = j.profile || 'sRGB';
    for (const [i, s] of j.layers.entries()) if (s.smart && s.smart.hp && d.layers[i] && d.layers[i].smart) { d.layers[i].smart.hp = await MP.hp.unpack(s.smart.hp); d.layers[i].smart.dev = s.smart.dev; d.layers[i].smart.hpPack = s.smart.hp; }
    MP.ui.refreshAll();
  };
}
