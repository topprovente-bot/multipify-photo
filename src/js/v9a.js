'use strict';
/* v9 (1/3) — RAW : capteurs Fujifilm X-Trans (dématriçage 6×6), RAF non compressés, et conversion automatique
   des formats fermés (Canon CR3, RAF compressés, NEF HE…) via Adobe DNG Converter (gratuit) puis développement
   des données du capteur */

/* =================== RAF (Fujifilm) =================== */
MP.raw.raf = (bytes) => {
  const str = (o, n) => String.fromCharCode(...bytes.subarray(o, o + n)).replace(/\0.*$/, '').trim(), be32 = (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0, be16 = (o) => (bytes[o] << 8) | bytes[o + 1];
  if (str(0, 8) !== 'FUJIFILM') throw new Error('RAF invalide');
  const model = str(28, 32), hdr = be32(92), dataOff = be32(100);
  let pat = null, wb = null, rw = 0, rh = 0;
  let n = be32(hdr), p = hdr + 4; if (n > 255) n = 0;
  while (n--) { const tag = be16(p), len = be16(p + 2), v = p + 4; if (tag === 0x100) { rh = be16(v); rw = be16(v + 2); } else if (tag === 0x131) { pat = new Array(36); for (let c = 0; c < 36; c++) pat[35 - c] = bytes[v + c] & 3; } else if (tag === 0x2ff0) { const g = be16(v), r = be16(v + 2), b = be16(v + 6); wb = [g / r, 1, g / b]; } p = v + len; }
  // bloc de données : TIFF interne (balises 0xF00x) ou données directes
  let W = rw, H = rh, bps = 16, off = dataOff, cnt = 0, black = 0, le = false;
  const sig = String.fromCharCode(bytes[dataOff], bytes[dataOff + 1]);
  if (sig === 'II' || sig === 'MM') {
    const sub = bytes.subarray(dataOff), dv = new DataView(sub.buffer, sub.byteOffset, sub.byteLength); le = sig === 'II';
    const t0 = readIFD(dv, dv.getUint32(4, le), le).tags, st = t0[0xf000] ? readIFD(dv, t0[0xf000].vals()[0], le).tags : t0, G = (k, d) => (st[k] ? st[k].vals() : d);
    W = G(0xf001, [rw])[0]; H = G(0xf002, [rh])[0]; bps = G(0xf003, [16])[0]; off = dataOff + G(0xf007, [0])[0]; cnt = G(0xf008, [0])[0];
    const bl = G(0xf00a, null); if (bl) black = bl.reduce((s, x) => s + x, 0) / bl.length; const w2 = G(0xf00e, null); if (w2 && w2.length >= 3 && !wb) wb = [w2[1] / w2[0], 1, w2[1] / w2[2]];
  }
  if (!W || !H) throw new Error('dimensions RAF introuvables');
  if (cnt && cnt < W * H * 2 * 0.9) throw new Error('RAF compressé (format Fujifilm propriétaire)');
  const raw = new Uint16Array(W * H); for (let i = 0; i < W * H; i++) { const q = off + i * 2; raw[i] = le ? bytes[q] | (bytes[q + 1] << 8) : (bytes[q] << 8) | bytes[q + 1]; }
  let mx = 0; for (let i = 0; i < raw.length; i += 7) mx = Math.max(mx, raw[i]);
  if (!black) { black = 1024 >> (16 - Math.min(16, bps === 16 ? 14 : bps)); }
  const r = { raw, W, H, ax: 0, ay: 0, aw: W, ah: H, pat: pat || [0, 1, 1, 2], pw: pat ? 6 : 2, xtrans: !!pat, black, white: Math.max(black + 1, mx), cm: null, generic: true, neutral: wb ? wb.map((v) => 1 / v) : null, make: 'FUJIFILM', model, isDng: false, comp: 1 };
  const prof = MP.camProfiles.get(model); if (prof && prof.rgbCam) { r.rgbCam = prof.rgbCam; r.generic = false; } else if (prof && prof.cm) { r.cm = prof.cm; r.generic = false; } else r.cm = [8458, -2451, -855, -4597, 12447, 2407, -1475, 2482, 6526].map((v) => v / 10000);
  return r;
};
{
  const dec = MP.raw.decode;
  MP.raw.decode = (bytes) => { if (MP.raw._cache && MP.raw._cache.bytes === bytes) return MP.raw._cache.r; if (bytes[0] === 0x46 && bytes[1] === 0x55 && bytes[2] === 0x4a && bytes[3] === 0x49) return MP.raw.raf(bytes); return dec(bytes); };
}

/* =================== Dématriçage X-Trans =================== */
MP.raw.developXtrans = (r, o = {}) => {
  const { raw, W, ax, ay, aw, ah, pat, black, white } = r, n = aw * ah, col = (x, y) => pat[((y + ay) % 6) * 6 + ((x + ax) % 6)], cfa = new Float32Array(n), sc = 1 / Math.max(1, white - black);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) cfa[y * aw + x] = Math.max(0, (raw[(y + ay) * W + x + ax] - black) * sc);
  let mul = r.neutral ? r.neutral.map((v) => 1 / v) : null;
  if (!mul) { const s = [0, 0, 0], c = [0, 0, 0]; for (let y = 0; y < ah; y += 2) for (let x = 0; x < aw; x += 2) { const v = cfa[y * aw + x]; if (v > 0.01 && v < 0.9) { const k = col(x, y); s[k] += v; c[k]++; } } const a = s.map((v, i) => v / Math.max(1, c[i])); mul = a.map((v) => a[1] / Math.max(1e-6, v)); r.autoWB = true; }
  const mn = Math.min(...mul); mul = mul.map((v) => v / mn);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) { const i = y * aw + x; cfa[i] = Math.min(1, cfa[i] * mul[col(x, y)]); }
  // 1) vert partout (moyenne pondérée des verts voisins), 2) R et B par différences de couleur
  const G = new Float32Array(n), out = new Float32Array(n * 3), cl = (v, m) => (v < 0 ? 0 : v >= m ? m - 1 : v);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x; if (col(x, y) === 1) { G[i] = cfa[i]; continue; }
    let s = 0, w = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (!dx && !dy) continue; const xx = cl(x + dx, aw), yy = cl(y + dy, ah); if (col(xx, yy) !== 1) continue; const ww = 1 / (dx * dx + dy * dy); s += cfa[yy * aw + xx] * ww; w += ww; } G[i] = w ? s / w : cfa[i];
  }
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const i = y * aw + x, c0 = col(x, y), v = [0, 0, 0]; v[1] = G[i];
    for (const c of [0, 2]) { if (c === c0) { v[c] = cfa[i]; continue; } let s = 0, w = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = cl(x + dx, aw), yy = cl(y + dy, ah); if (col(xx, yy) !== c) continue; const j = yy * aw + xx, ww = 1 / (1 + dx * dx + dy * dy); s += (cfa[j] - G[j]) * ww; w += ww; } v[c] = Math.max(0, G[i] + (w ? s / w : 0)); }
    out[i * 3] = v[0]; out[i * 3 + 1] = v[1]; out[i * 3 + 2] = v[2];
  }
  // matrice couleur
  let M;
  if (o.camera) M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  else if (r.rgbCam) M = r.rgbCam;
  else { const X = [0.412453, 0.35758, 0.180423, 0.212671, 0.71516, 0.072169, 0.019334, 0.119193, 0.950227], cr = []; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { let s = 0; for (let k = 0; k < 3; k++) s += r.cm[a * 3 + k] * X[k * 3 + b]; cr.push(s); } for (let a = 0; a < 3; a++) { const s = cr[a * 3] + cr[a * 3 + 1] + cr[a * 3 + 2]; for (let b = 0; b < 3; b++) cr[a * 3 + b] /= s; } M = MP.colorMath.inv3(cr); }
  for (let i = 0; i < n * 3; i += 3) { const a = out[i], b = out[i + 1], c = out[i + 2]; out[i] = Math.max(0, M[0] * a + M[1] * b + M[2] * c); out[i + 1] = Math.max(0, M[3] * a + M[4] * b + M[5] * c); out[i + 2] = Math.max(0, M[6] * a + M[7] * b + M[8] * c); }
  return { w: aw, h: ah, data: out, bits: 16 };
};
{
  const dv = MP.raw.develop;
  MP.raw.develop = (r, o = {}) => (r.xtrans ? MP.raw.developXtrans(r, o) : dv(r, o));
}

/* =================== Conversion automatique via Adobe DNG Converter =================== */
{
  const of = MP.io.openFile;
  MP.io.openFile = async (f) => {
    const e = ext(f.name);
    if (RAW_EXT.includes(e) && e !== 'dng' && MP.prefs.rawDecode !== false) {
      let ok = false; try { const r = MP.raw.decode(f.data); MP.raw._cache = { bytes: f.data, r }; ok = true; } catch (err) { MP.raw._lastErr = err.message; }
      if (!ok && MP.native.dngConvert && f.path && MP.prefs.dngConverter !== false) {
        const res = await MP.busy('Conversion en DNG (Adobe DNG Converter)…', () => MP.native.dngConvert(f.path));
        if (res && res.path) { const g = await MP.native.readFile(res.path); if (g) { MP.toast('Converti en DNG pour lire les données du capteur : ' + f.name, 4000); await of({ ...g, name: f.name.replace(/\.[^.]+$/, '') + '.dng', path: f.path }); MP.raw._cache = null; return; } }
        else if (res && res.error === 'absent') {
          MP.ui.dialog({ title: 'Format RAW fermé : ' + e.toUpperCase(), width: 480, okLabel: 'Ouvrir l\'aperçu', fields: [{ type: 'info', html: `<p>Les données du capteur de ce fichier (${esc(MP.raw._lastErr || '')}) ne sont pas documentées publiquement.</p><p>Installez <b>Adobe DNG Converter</b> (gratuit) : Multipify Photo l'utilisera automatiquement pour développer ces fichiers depuis le capteur. En attendant, l'aperçu intégré peut être ouvert.</p>` }, { type: 'button', label: 'Télécharger Adobe DNG Converter', action: () => MP.native.openExternal('https://helpx.adobe.com/camera-raw/using/adobe-dng-converter.html') }], values: {}, onOk: () => { MP.prefs.rawDecode = false; of(f).finally(() => { MP.prefs.rawDecode = true; }); } });
          return;
        }
      }
    }
    try { await of(f); } finally { MP.raw._cache = null; }
  };
}
