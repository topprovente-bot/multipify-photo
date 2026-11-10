'use strict';
/* v7 (3/4) — alignement et panorama par points caractéristiques : détection de coins (Harris), descripteurs,
   appariement, RANSAC, homographie (perspective), similitude, projection cylindrique, compensation d'exposition,
   coutures optimales et remplissage des bords ; repères commentés (repères intelligents) pendant le déplacement */

/* =================== Points caractéristiques =================== */
MP.features = {
  gray(c, maxDim = 1000) {
    const k = Math.min(1, maxDim / Math.max(c.width, c.height)), w = Math.max(16, Math.round(c.width * k)), h = Math.max(16, Math.round(c.height * k));
    const t = MP.createCanvas(w, h), x = t.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, w, h);
    const a = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h), m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { g[i] = (a[i * 4] * 0.3 + a[i * 4 + 1] * 0.59 + a[i * 4 + 2] * 0.11) / 255; m[i] = a[i * 4 + 3] > 200 ? 1 : 0; }
    return { w, h, g, m, k };
  },
  blur(g, w, h, r) { const t = new Float32Array(g.length), o = new Float32Array(g.length), n = 2 * r + 1; for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += g[y * w + MP.clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { t[y * w + x] = s / n; s += g[y * w + Math.min(w - 1, x + r + 1)] - g[y * w + Math.max(0, x - r)]; } } for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[MP.clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = s / n; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } } return o; },
  detect(G, N = 700) {
    const { w, h, g, m } = G, Ixx = new Float32Array(w * h), Iyy = new Float32Array(w * h), Ixy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, ix = (g[i + 1] - g[i - 1]) * 2 + g[i - w + 1] - g[i - w - 1] + g[i + w + 1] - g[i + w - 1], iy = (g[i + w] - g[i - w]) * 2 + g[i + w - 1] - g[i - w - 1] + g[i + w + 1] - g[i - w + 1]; Ixx[i] = ix * ix; Iyy[i] = iy * iy; Ixy[i] = ix * iy; }
    const A = this.blur(this.blur(Ixx, w, h, 2), w, h, 1), B = this.blur(this.blur(Iyy, w, h, 2), w, h, 1), C = this.blur(this.blur(Ixy, w, h, 2), w, h, 1), R = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) R[i] = A[i] * B[i] - C[i] * C[i] - 0.04 * (A[i] + B[i]) ** 2;
    const cells = 12, per = Math.ceil(N / (cells * cells)) + 2, buckets = Array.from({ length: cells * cells }, () => []), mg = 12;
    for (let y = mg; y < h - mg; y++) for (let x = mg; x < w - mg; x++) {
      const i = y * w + x, v = R[i]; if (v <= 1e-5 || !m[i]) continue; let mx = true;
      for (let dy = -2; dy <= 2 && mx; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && R[i + dy * w + dx] > v) { mx = false; break; }
      if (mx) buckets[Math.floor((y / h) * cells) * cells + Math.floor((x / w) * cells)].push({ x, y, v });
    }
    const pts = []; for (const b of buckets) { b.sort((p, q) => q.v - p.v); pts.push(...b.slice(0, per)); }
    pts.sort((p, q) => q.v - p.v); return pts.slice(0, N);
  },
  describe(G, pts) {
    const { w, h } = G, b = this.blur(G.g, w, h, 1), out = [];
    for (const p of pts) { const d = new Float32Array(64); let s = 0, s2 = 0, k = 0; for (let j = -7; j <= 7; j += 2) for (let i = -7; i <= 7; i += 2) { const v = b[MP.clamp(p.y + j, 0, h - 1) * w + MP.clamp(p.x + i, 0, w - 1)]; d[k++] = v; s += v; s2 += v * v; } const mu = s / 64, sd = Math.sqrt(Math.max(1e-9, s2 / 64 - mu * mu)); for (let q = 0; q < 64; q++) d[q] = (d[q] - mu) / sd / 8; out.push({ x: p.x, y: p.y, d }); }
    return out;
  },
  extract(c, maxDim) { const G = this.gray(c, maxDim); return { G, f: this.describe(G, this.detect(G)) }; },
  match(A, B) {
    const best = (p, set) => { let b1 = 1e9, b2 = 1e9, bi = -1; for (let j = 0; j < set.length; j++) { const q = set[j].d; let s = 0; for (let k = 0; k < 64; k++) { const t = p.d[k] - q[k]; s += t * t; if (s > b2) break; } if (s < b1) { b2 = b1; b1 = s; bi = j; } else if (s < b2) b2 = s; } return { bi, ok: b1 < 0.64 * b2 }; };
    const out = []; A.forEach((p, i) => { const r = best(p, B); if (!r.ok) return; const back = best(B[r.bi], A); if (back.bi === i) out.push([p, B[r.bi]]); });
    return out;
  },
};

/* =================== Modèles géométriques et RANSAC =================== */
const solve = (A, b) => { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-12) return null; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } } return M.map((r, i) => r[n] / r[i]); };
MP.geo = {
  apply(H, x, y) { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; },
  inv(H) { const [a, b, c, d, e, f, g, h, i] = H, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C; return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det]; },
  mul(A, B) { const r = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return r; },
  scale(s) { return [s, 0, 0, 0, s, 0, 0, 0, 1]; },
  /** ajustement d'un modèle (homographie, similitude ou translation) aux paires src→dst */
  fit(pairs, model) {
    if (model === 'translation') { let dx = 0, dy = 0; for (const [p, q] of pairs) { dx += q[0] - p[0]; dy += q[1] - p[1]; } return [1, 0, dx / pairs.length, 0, 1, dy / pairs.length, 0, 0, 1]; }
    if (model === 'similarity') { const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], b = [0, 0, 0, 0]; for (const [p, q] of pairs) { const rows = [[p[0], -p[1], 1, 0, q[0]], [p[1], p[0], 0, 1, q[1]]]; for (const r of rows) for (let i = 0; i < 4; i++) { b[i] += r[i] * r[4]; for (let j = 0; j < 4; j++) A[i][j] += r[i] * r[j]; } } const s = solve(A, b); return s && [s[0], -s[1], s[2], s[1], s[0], s[3], 0, 0, 1]; }
    // homographie normalisée (Hartley)
    const norm = (pts) => { let cx = 0, cy = 0; pts.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length; let d = 0; pts.forEach((p) => { d += Math.hypot(p[0] - cx, p[1] - cy); }); const s = Math.SQRT2 / Math.max(1e-9, d / pts.length); return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1]; };
    const Ts = norm(pairs.map((p) => p[0])), Td = norm(pairs.map((p) => p[1])), A = Array.from({ length: 8 }, () => new Array(8).fill(0)), b = new Array(8).fill(0);
    for (const [p0, q0] of pairs) { const p = this.apply(Ts, ...p0), q = this.apply(Td, ...q0); for (const r of [[p[0], p[1], 1, 0, 0, 0, -q[0] * p[0], -q[0] * p[1], q[0]], [0, 0, 0, p[0], p[1], 1, -q[1] * p[0], -q[1] * p[1], q[1]]]) for (let i = 0; i < 8; i++) { b[i] += r[i] * r[8]; for (let j = 0; j < 8; j++) A[i][j] += r[i] * r[j]; } }
    const h = solve(A, b); if (!h) return null; const Hn = [...h, 1];
    return this.mul(this.inv(Td), this.mul(Hn, Ts));
  },
  ransac(pairs, model = 'homography', thr = 3, iters = 1500) {
    const need = model === 'homography' ? 4 : model === 'similarity' ? 2 : 1; if (pairs.length < need + 2) return null;
    let best = null, bestIn = []; let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let it = 0; it < iters; it++) {
      const s = new Set(); while (s.size < need) s.add(Math.floor(rnd() * pairs.length)); const H = this.fit([...s].map((i) => pairs[i]), model); if (!H) continue;
      const inl = []; for (const pr of pairs) { const [x, y] = this.apply(H, ...pr[0]); if (Math.hypot(x - pr[1][0], y - pr[1][1]) < thr) inl.push(pr); }
      if (inl.length > bestIn.length) { bestIn = inl; best = H; if (inl.length > pairs.length * 0.9) break; }
    }
    if (!best || bestIn.length < Math.max(need + 4, 8)) return null;
    const H = this.fit(bestIn, model) || best; return { H, inliers: bestIn.length, total: pairs.length };
  },
  /** estime la transformation qui amène l'image B dans le repère de l'image A (pleine résolution) */
  estimate(ca, cb, model = 'homography', pre) {
    const A = (pre && pre.a) || MP.features.extract(ca), B = (pre && pre.b) || MP.features.extract(cb), m = MP.features.match(B.f, A.f);
    const pairs = m.map(([p, q]) => [[p.x / B.G.k, p.y / B.G.k], [q.x / A.G.k, q.y / A.G.k]]);
    const thr = 3 / Math.min(A.G.k, B.G.k); return this.ransac(pairs, model, thr);
  },
  /** applique H (repère source → repère destination) à une toile, sortie de taille W×H */
  warp(src, H, W, Hh, ox = 0, oy = 0) {
    const Hi = this.inv(H), sw = src.width, sh = src.height, s = src.getContext('2d').getImageData(0, 0, sw, sh).data, out = MP.createCanvas(W, Hh), x = out.getContext('2d'), od = x.createImageData(W, Hh), o = od.data;
    for (let y = 0; y < Hh; y++) for (let xx = 0; xx < W; xx++) {
      const X = xx + ox, Y = y + oy, w = Hi[6] * X + Hi[7] * Y + Hi[8], u = (Hi[0] * X + Hi[1] * Y + Hi[2]) / w, v = (Hi[3] * X + Hi[4] * Y + Hi[5]) / w;
      if (u < -0.5 || v < -0.5 || u > sw - 0.5 || v > sh - 0.5) continue;
      const x0 = MP.clamp(Math.floor(u), 0, sw - 2), y0 = MP.clamp(Math.floor(v), 0, sh - 2), fx = MP.clamp(u - x0, 0, 1), fy = MP.clamp(v - y0, 0, 1), i = (y0 * sw + x0) * 4, j = (y * W + xx) * 4;
      for (let c = 0; c < 4; c++) o[j + c] = (s[i + c] * (1 - fx) + s[i + 4 + c] * fx) * (1 - fy) + (s[i + sw * 4 + c] * (1 - fx) + s[i + sw * 4 + 4 + c] * fx) * fy;
    }
    x.putImageData(od, 0, 0); return out;
  },
  cylinder(c, f) {
    const w = c.width, h = c.height, cx = w / 2, cy = h / 2, tw = Math.round(2 * f * Math.atan(cx / f)), th = h, s = c.getContext('2d').getImageData(0, 0, w, h).data, out = MP.createCanvas(tw, th), x = out.getContext('2d'), od = x.createImageData(tw, th), o = od.data;
    for (let y = 0; y < th; y++) for (let xx = 0; xx < tw; xx++) {
      const th0 = (xx - tw / 2) / f, hh = (y - cy) / f, u = Math.tan(th0) * f + cx, v = (hh * f) / Math.cos(th0) + cy; if (u < 0 || v < 0 || u > w - 1.001 || v > h - 1.001) continue;
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0, i = (y0 * w + x0) * 4, j = (y * tw + xx) * 4;
      for (let k = 0; k < 4; k++) o[j + k] = (s[i + k] * (1 - fx) + s[i + 4 + k] * fx) * (1 - fy) + (s[i + w * 4 + k] * (1 - fx) + s[i + w * 4 + 4 + k] * fx) * fy;
    }
    x.putImageData(od, 0, 0); return out;
  },
};

/* =================== Alignement automatique (perspective) =================== */
MP.autoAlignPro = (model = 'homography') => {
  const d = MP.doc, set = d.layers.filter((l) => !l.isGroup && !l.adjust && l.visible && !l.text && l.parent === d.layer.parent && MP.alphaBounds(l.canvas, 8));
  if (set.length < 2) { MP.toast('Placez au moins 2 calques de pixels visibles dans le même groupe'); return; }
  return MP.busy('Alignement automatique (points caractéristiques)…', () => {
    d.history.record('Alignement automatique', set.map((l) => l.id)); const ref = set[0], fr = MP.features.extract(ref.canvas); let ok = 0, fb = 0;
    for (const l of set.slice(1)) {
      const r = MP.geo.estimate(ref.canvas, l.canvas, model, { a: fr });
      if (r) { l.canvas = MP.geo.warp(l.canvas, r.H, d.width, d.height); if (l.smart) l.smart = null; l._v = (l._v || 0) + 1; ok++; }
      else { const t = MP.estimateShift(ref.canvas, l.canvas); if (t) { MP.moveLayerBy(l, t.dx, t.dy); fb++; } }
    }
    MP.afterEdit(); MP.toast(`${ok} calque(s) aligné(s) (${{ homography: 'perspective', similarity: 'position, rotation, échelle', translation: 'translation' }[model]})` + (fb ? `, ${fb} par simple décalage (trop peu de points communs)` : ''), 5000);
  });
};

/* =================== Photomerge (perspective, cylindrique, repositionnement) =================== */
MP.panoramaPro = async (files, o = {}) => {
  if (!files || files.length < 2) { MP.toast('Choisissez au moins 2 photos qui se chevauchent'); return; }
  const layout = o.layout || 'auto';
  await MP.busy('Photomerge : détection des points communs…', async () => {
    let imgs = []; for (const f of files) imgs.push({ name: f.name, c: await MP.io.loadImage(f.data, f.name), ex: MP.exif(f.data) });
    const maxH = Math.min(...imgs.map((i) => i.c.height), 2400); imgs = imgs.map((i) => { if (i.c.height <= maxH) return i; const n = MP.createCanvas(Math.round((i.c.width * maxH) / i.c.height), maxH), x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i.c, 0, 0, n.width, n.height); return { ...i, c: n }; });
    let mode = layout === 'auto' ? (imgs.length <= 3 ? 'homography' : 'cylindrical') : layout === 'perspective' ? 'homography' : layout;
    if (mode === 'cylindrical') { const foc = o.focal || (imgs[0].ex && parseFloat(imgs[0].ex.focal)) || 28; imgs = imgs.map((i) => ({ ...i, c: MP.geo.cylinder(i.c, (i.c.width * foc) / 36) })); }
    const model = mode === 'homography' ? 'homography' : 'similarity';
    const F = imgs.map((i) => MP.features.extract(i.c, 900)), n = imgs.length, E = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const r = MP.geo.estimate(imgs[i].c, imgs[j].c, model, { a: F[i], b: F[j] }); if (r) E.push({ i, j, H: r.H, w: r.inliers }); }
    // arbre couvrant maximal depuis l'image la plus connectée
    const deg = new Array(n).fill(0); E.forEach((e) => { deg[e.i] += e.w; deg[e.j] += e.w; }); const ref = deg.indexOf(Math.max(...deg)), T = new Array(n).fill(null); T[ref] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    let grew = true; while (grew) { grew = false; let best = null; for (const e of E) { const a = T[e.i], b = T[e.j]; if (a && !b && (!best || e.w > best.w)) best = { ...e, dir: 'ij' }; if (!a && b && (!best || e.w > best.w)) best = { ...e, dir: 'ji' }; } if (best) { if (best.dir === 'ij') T[best.j] = MP.geo.mul(T[best.i], best.H); else T[best.i] = MP.geo.mul(T[best.j], MP.geo.inv(best.H)); grew = true; } }
    const used = T.map((t, i) => (t ? i : -1)).filter((i) => i >= 0); if (used.length < 2) throw new Error('pas assez de points communs entre les photos (chevauchement d\'au moins 25 % conseillé)');
    // limites
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const i of used) { const c = imgs[i].c; for (const [x, y] of [[0, 0], [c.width, 0], [0, c.height], [c.width, c.height]]) { const p = MP.geo.apply(T[i], x, y); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } }
    const W = Math.round(x1 - x0), H = Math.round(y1 - y0); if (W * H > 150e6 || W > 30000 || H > 30000) throw new Error('panorama trop étendu en perspective — choisissez la disposition Cylindrique');
    const Tt = T.map((t) => t && MP.geo.mul([1, 0, -x0, 0, 1, -y0, 0, 0, 1], t));
    const warped = used.map((i) => MP.geo.warp(imgs[i].c, Tt[i], W, H));
    // compensation d'exposition (gains par image dans les recouvrements)
    const px = warped.map((c) => c.getContext('2d').getImageData(0, 0, W, H).data), gain = new Array(used.length).fill(1);
    if (o.exposure !== false) { const ri = used.indexOf(ref); for (let pass = 0; pass < 3; pass++) for (let a = 0; a < used.length; a++) { if (a === ri) continue; let sa = 0, sb = 0; for (let b = 0; b < used.length; b++) { if (b === a) continue; for (let q = 0; q < W * H * 4; q += 4 * 37) if (px[a][q + 3] > 250 && px[b][q + 3] > 250) { sa += px[a][q] + px[a][q + 1] + px[a][q + 2]; sb += (px[b][q] + px[b][q + 1] + px[b][q + 2]) * gain[b]; } } if (sa > 1000) gain[a] = MP.clamp(sb / sa, 0.6, 1.6); } }
    // coutures : chaque pixel revient à l'image dont il est le plus au centre, puis fondu
    const Hi = used.map((i) => MP.geo.inv(Tt[i])), masks = used.map(() => new Uint8ClampedArray(W * H));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let bi = -1, bw = 0; for (let a = 0; a < used.length; a++) { if (px[a][(y * W + x) * 4 + 3] < 128) continue; const c = imgs[used[a]].c, p = MP.geo.apply(Hi[a], x, y), w = Math.min(p[0], c.width - p[0], p[1], c.height - p[1]) / Math.min(c.width, c.height); if (w > bw) { bw = w; bi = a; } } if (bi >= 0) for (let a2 = 0; a2 <= bi; a2++) if (px[a2][(y * W + x) * 4 + 3] >= 128) masks[a2][y * W + x] = 255; }
    const d = new MP.Doc(W, H, 'Panorama.mpp'), fe = Math.max(4, Math.round(Math.min(W, H) * 0.02));
    used.forEach((i, a) => {
      const l = d.addLayer(imgs[i].name, a), lc = warped[a], lx = lc.getContext('2d');
      if (gain[a] !== 1) { const id = lx.getImageData(0, 0, W, H), q = id.data; for (let k = 0; k < q.length; k += 4) { q[k] *= gain[a]; q[k + 1] *= gain[a]; q[k + 2] *= gain[a]; } lx.putImageData(id, 0, 0); }
      l.canvas = lc;
      if (a > 0 && o.blend !== false) { const m = MP.createCanvas(W, H), mx = m.getContext('2d'), mid = mx.createImageData(W, H); for (let k = 0; k < W * H; k++) { mid.data[k * 4] = mid.data[k * 4 + 1] = mid.data[k * 4 + 2] = 255; mid.data[k * 4 + 3] = masks[a][k]; } mx.putImageData(mid, 0, 0); const b = MP.blurCanvas(m, fe), fm = MP.createCanvas(W, H), fx = fm.getContext('2d'); fx.drawImage(b, 0, 0); fx.globalCompositeOperation = 'destination-in'; fx.drawImage(lc, 0, 0); l.mask = fm; l.maskEnabled = true; }
    });
    d.active = d.layers.length - 1; MP.addDoc(d);
    if (o.fill || o.crop) {
      const flat = MP.flatComposite(d), fa = flat.getContext('2d').getImageData(0, 0, W, H).data;
      if (o.crop) { const r = MP.maxRect(fa, W, H); if (r) MP.cropDoc(r.x, r.y, r.w, r.h); }
      else { const l = d.addLayer('Bords remplis (contenu)'), m = MP.createCanvas(W, H), mx = m.getContext('2d'), mi = mx.createImageData(W, H); for (let k = 0; k < W * H; k++) mi.data[k * 4 + 3] = fa[k * 4 + 3] < 250 ? 255 : 0; mx.putImageData(mi, 0, 0); l.ctx.drawImage(flat, 0, 0); MP.healRegion(l.canvas, m, 24, true); MP.render(); }
    }
    MP.ui.refreshAll(); MP.toast(`Panorama ${W} × ${H} : ${used.length}/${n} photos assemblées (${mode === 'homography' ? 'perspective' : mode === 'cylindrical' ? 'cylindrique' : 'repositionnement'}), coutures et exposition harmonisées`, 6000);
  }).catch((e) => MP.toast('Photomerge : ' + e.message, 6000));
};

/** plus grand rectangle entièrement opaque (méthode de l'histogramme, sur une grille réduite) */
MP.maxRect = (a, W, H) => {
  const k = Math.max(1, Math.ceil(Math.max(W, H) / 700)), gw = Math.floor(W / k), gh = Math.floor(H / k), hgt = new Int32Array(gw); let best = null;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) { let ok = true; for (let y = gy * k; y < (gy + 1) * k && ok; y++) for (let x = gx * k; x < (gx + 1) * k; x++) if (a[(y * W + x) * 4 + 3] < 250) { ok = false; break; } hgt[gx] = ok ? hgt[gx] + 1 : 0; }
    const st = []; for (let x = 0; x <= gw; x++) { const h = x < gw ? hgt[x] : 0; let start = x; while (st.length && st[st.length - 1][1] >= h) { const [s0, h0] = st.pop(); const area = h0 * (x - s0); if (!best || area > best.area) best = { area, x: s0, y: gy - h0 + 1, w: x - s0, h: h0 }; start = s0; } st.push([start, h]); }
  }
  return best && best.area > 0 ? { x: best.x * k, y: best.y * k, w: best.w * k, h: best.h * k } : null;
};

/* =================== Repères commentés (repères intelligents) =================== */
{
  const mv = MP.tools.move, b0 = mv.begin, u0 = mv.update, f0 = mv.finish, ov0 = mv.overlay;
  const boxOf = (l) => { const d = MP.doc; if (l.text && l.text._b) return { ...l.text._b }; const b = MP.alphaBounds(l.canvas, 8); return b; };
  mv.begin = function (p) {
    const ok = b0.call(this, p); this._sg = null; if (!ok || MP.prefs.smartGuides === false) return ok;
    const d = MP.doc, l = d.layer, mine = l.isGroup ? d.descendants(l).map(boxOf).filter(Boolean).reduce((u, b) => (u ? { x: Math.min(u.x, b.x), y: Math.min(u.y, b.y), w: Math.max(u.x + u.w, b.x + b.w) - Math.min(u.x, b.x), h: Math.max(u.y + u.h, b.y + b.h) - Math.min(u.y, b.y) } : b), null) : d.selection ? MP.sel.bounds(d) : boxOf(l);
    if (!mine) return ok;
    const others = d.layers.filter((o) => o !== l && !o.isGroup && !o.adjust && o.visible && !(l.isGroup && d.descendants(l).includes(o))).slice(-40).map(boxOf).filter((b) => b && !(b.w >= d.width * 0.98 && b.h >= d.height * 0.98));
    const X = [{ v: 0 }, { v: d.width / 2 }, { v: d.width }], Y = [{ v: 0 }, { v: d.height / 2 }, { v: d.height }];
    for (const b of others) { X.push({ v: b.x, b }, { v: b.x + b.w / 2, b }, { v: b.x + b.w, b }); Y.push({ v: b.y, b }, { v: b.y + b.h / 2, b }, { v: b.y + b.h, b }); }
    (d.guides || []).forEach((g) => (g.dir === 'v' || g.v ? X : Y).push({ v: g.pos ?? g.x ?? g.y ?? 0 }));
    this._sg = { mine, X, Y, others, lines: [] }; return ok;
  };
  mv.update = function (dx, dy) {
    const s = this._sg;
    if (s && this.dragging !== false && !(MP._kbd && MP._kbd.ctrl)) {
      const tol = 6 / MP.doc.zoom, m = s.mine, cand = (vals, pos) => { let best = null; for (const t of vals) for (const [k, off] of pos) { const dd = t.v - off; if (Math.abs(dd) < tol && (!best || Math.abs(dd) < Math.abs(best.d))) best = { d: dd, v: t.v, b: t.b, k }; } return best; };
      const bx = cand(s.X, [['l', m.x + dx], ['c', m.x + m.w / 2 + dx], ['r', m.x + m.w + dx]]), by = cand(s.Y, [['t', m.y + dy], ['c', m.y + m.h / 2 + dy], ['b', m.y + m.h + dy]]);
      s.lines = []; if (bx) { dx += bx.d; s.lines.push({ v: bx.v, dir: 'x', b: bx.b }); } if (by) { dy += by.d; s.lines.push({ v: by.v, dir: 'y', b: by.b }); }
      s.cur = { x: m.x + dx, y: m.y + dy, w: m.w, h: m.h };
      // espacements égaux : distance au voisin le plus proche
      s.gaps = []; const c = s.cur;
      for (const b of s.others) { if (b.y < c.y + c.h && b.y + b.h > c.y) { if (b.x + b.w <= c.x) s.gaps.push({ dir: 'h', a: b.x + b.w, z: c.x, at: Math.max(b.y, c.y) + Math.min(b.h, c.h) / 2 }); else if (b.x >= c.x + c.w) s.gaps.push({ dir: 'h', a: c.x + c.w, z: b.x, at: Math.max(b.y, c.y) + Math.min(b.h, c.h) / 2 }); } if (b.x < c.x + c.w && b.x + b.w > c.x) { if (b.y + b.h <= c.y) s.gaps.push({ dir: 'v', a: b.y + b.h, z: c.y, at: Math.max(b.x, c.x) + Math.min(b.w, c.w) / 2 }); else if (b.y >= c.y + c.h) s.gaps.push({ dir: 'v', a: c.y + c.h, z: b.y, at: Math.max(b.x, c.x) + Math.min(b.w, c.w) / 2 }); } }
      const pick = (dir) => s.gaps.filter((g) => g.dir === dir).sort((p, q) => p.z - p.a - (q.z - q.a)).slice(0, 2); s.gaps = [...pick('h'), ...pick('v')];
    }
    return u0.call(this, dx, dy);
  };
  mv.finish = function () { if (this._sg) this._sg = null; MP.renderView(); return f0.call(this); };
  mv.overlay = function (ctx) {
    ov0 && ov0.call(this, ctx); const s = this._sg; if (!s || !this.dragging || !s.cur) return;
    const d = MP.doc; ctx.save(); MP.overlayDocTransform(ctx); const z = d.zoom; ctx.lineWidth = 1 / z; ctx.strokeStyle = '#ff2fd0'; ctx.fillStyle = '#ff2fd0'; ctx.font = `${11 / z}px "Segoe UI", sans-serif`;
    for (const L of s.lines) { ctx.beginPath(); if (L.dir === 'x') { const ys = [s.cur.y, s.cur.y + s.cur.h, ...(L.b ? [L.b.y, L.b.y + L.b.h] : [0, d.height])]; ctx.moveTo(L.v, Math.min(...ys)); ctx.lineTo(L.v, Math.max(...ys)); } else { const xs = [s.cur.x, s.cur.x + s.cur.w, ...(L.b ? [L.b.x, L.b.x + L.b.w] : [0, d.width])]; ctx.moveTo(Math.min(...xs), L.v); ctx.lineTo(Math.max(...xs), L.v); } ctx.stroke(); }
    for (const g of s.gaps || []) { const len = Math.round(g.z - g.a); if (len <= 0) continue; ctx.beginPath(); if (g.dir === 'h') { ctx.moveTo(g.a, g.at); ctx.lineTo(g.z, g.at); ctx.stroke(); ctx.fillText(len + ' px', (g.a + g.z) / 2 - 12 / z, g.at - 4 / z); } else { ctx.moveTo(g.at, g.a); ctx.lineTo(g.at, g.z); ctx.stroke(); ctx.fillText(len + ' px', g.at + 4 / z, (g.a + g.z) / 2); } }
    const c = s.cur; ctx.fillText(`X ${Math.round(c.x)}  Y ${Math.round(c.y)}`, c.x, c.y - 6 / z); ctx.restore();
  };
  window.addEventListener('keydown', (e) => { MP._kbd = { ctrl: e.ctrlKey || e.metaKey }; }, true); window.addEventListener('keyup', (e) => { MP._kbd = { ctrl: e.ctrlKey || e.metaKey }; }, true);
}
