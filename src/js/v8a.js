'use strict';
/* v8 (1/3) — RAW : NEF compressé Nikon (sans perte et avec perte), profils d'appareil Adobe (.dcp) avec recherche
   automatique, calibration de l'appareil avec une charte ColorChecker (profil exact par boîtier) */

/* =================== Profils d'appareil (mémoire + stockage local) =================== */
MP.camProfiles = {
  map: {},
  key(model) { return String(model || '').toLowerCase().replace(/\s+/g, ' ').trim(); },
  async load() { try { for (const p of await MP.idb.all('profiles')) if (p.key.startsWith('cam:')) this.map[p.key.slice(4)] = p; } catch (e) { console.warn(e); } },
  async save(model, prof) { const k = this.key(model), rec = { key: 'cam:' + k, model, ...prof, time: Date.now() }; this.map[k] = rec; await MP.idb.put('profiles', rec); },
  async remove(model) { const k = this.key(model); delete this.map[k]; await MP.idb.del('profiles', 'cam:' + k); },
  get(model) { return this.map[this.key(model)] || null; },
  /** lecture d'un profil DNG Camera Profile (.dcp) */
  parseDcp(bytes) {
    const { list } = MP.raw.ifds(bytes), t = list[0], G = (k) => (t[k] ? t[k].vals() : null), S = (k) => (t[k] ? t[k].str() : '');
    const cm1 = G(50721), cm2 = G(50722), il1 = (G(50778) || [0])[0], il2 = (G(50779) || [0])[0]; if (!cm1 && !cm2) throw new Error('profil sans matrice couleur');
    return { name: S(50936) || 'Profil DCP', camera: S(50708), cm: cm2 && il2 === 21 ? cm2 : cm1 && il1 === 21 ? cm1 : cm2 || cm1, source: 'dcp' };
  },
  async importDcp(file, model) { const p = this.parseDcp(file.data); await this.save(model || p.camera, p); MP.toast(`Profil d'appareil « ${p.name} » associé à ${model || p.camera}`, 5000); return p; },
  async autoFind(model, make) {
    if (!MP.native.findCameraProfiles || !model) return null;
    try { const paths = await MP.native.findCameraProfiles(model, make); for (const p of paths) { const f = await MP.native.readFile(p); if (!f) continue; try { const prof = this.parseDcp(f.data); const std = paths.find((x) => /adobe standard/i.test(x)); if (std && p !== std) continue; await this.save(model, prof); return prof; } catch (_) { /* suivant */ } } } catch (e) { console.warn(e); }
    return null;
  },
};

/* =================== NEF compressé Nikon =================== */
const NIKON_TREE = [
  [0, 1, 5, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 5, 4, 3, 6, 2, 7, 1, 0, 8, 9, 11, 10, 12],
  [0, 1, 5, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0x39, 0x5a, 0x38, 0x27, 0x16, 5, 4, 3, 2, 1, 0, 11, 12, 12],
  [0, 1, 4, 2, 3, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 4, 6, 3, 7, 2, 8, 1, 9, 0, 10, 11, 12],
  [0, 1, 4, 3, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 5, 6, 4, 7, 8, 3, 9, 2, 1, 0, 10, 11, 12, 13, 14],
  [0, 1, 5, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 8, 0x5c, 0x4b, 0x3a, 0x29, 7, 6, 5, 4, 3, 2, 1, 0, 13, 14],
  [0, 1, 4, 2, 2, 3, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 7, 6, 8, 5, 9, 4, 10, 3, 11, 12, 2, 0, 1, 13, 14],
];
const huffTable = (tree) => { const counts = tree.slice(0, 16), syms = tree.slice(16), maxcode = new Int32Array(18).fill(-1), valptr = new Int32Array(17), mincode = new Int32Array(17); let code = 0, k = 0; for (let l = 1; l <= 16; l++) { valptr[l] = k; mincode[l] = code; code += counts[l - 1]; k += counts[l - 1]; maxcode[l] = counts[l - 1] ? code - 1 : -1; code <<= 1; } return { maxcode, valptr, mincode, syms }; };
MP.raw.makernote = (bytes, list) => {
  const exif = list.map((t) => t[34665] && t[34665].vals()[0]).find(Boolean); if (!exif) return null;
  const dv0 = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), le0 = dv0.getUint16(0) === 0x4949, ex = readIFD(dv0, exif, le0).tags, mn = ex[37500]; if (!mn) return null;
  const o = mn.vo; if (String.fromCharCode(...bytes.subarray(o, o + 5)) !== 'Nikon') return null;
  const base = o + 10, dv = new DataView(bytes.buffer, bytes.byteOffset + base, bytes.byteLength - base), le = dv.getUint16(0) === 0x4949;
  return { base, dv, le, tags: readIFD(dv, dv.getUint32(4, le), le).tags };
};
MP.raw.nikon = (bytes, R, list, W, H, bps) => {
  const mn = MP.raw.makernote(bytes, list); if (!mn) throw new Error('note du fabricant Nikon introuvable');
  const meta = mn.tags[0x96] || mn.tags[0x8c]; if (!meta) throw new Error('table de compression Nikon absente');
  let mo = mn.base + meta.vo; const u8 = (i) => bytes[i], u16 = (i) => (mn.le ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]), s16 = (i) => (u16(i) << 16) >> 16;
  const ver0 = u8(mo), ver1 = u8(mo + 1); mo += 2; if (ver0 === 0x49 || ver1 === 0x58) mo += 2110;
  let tree = ver0 === 0x46 ? 2 : 0; if (bps === 14) tree += 3;
  const vpred = [[s16(mo), s16(mo + 2)], [s16(mo + 4), s16(mo + 6)]]; mo += 8;
  let max = (1 << bps) & 0x7fff; const curve = new Uint16Array(0x10000); for (let i = 0; i < curve.length; i++) curve[i] = i;
  const csize = u16(mo); mo += 2; let step = 0, split = 0; if (csize > 1) step = Math.floor(max / (csize - 1));
  if (ver0 === 0x44 && ver1 === 0x20 && step > 0) { for (let i = 0; i < csize; i++) curve[i * step] = u16(mo + i * 2); for (let i = 0; i < max; i++) { const r = i % step; curve[i] = (curve[i - r] * (step - r) + curve[i - r + step] * r) / step; } split = u16(mn.base + meta.vo + 562); }
  else if (ver0 !== 0x46 && csize <= 0x4001) { for (let i = 0; i < csize; i++) curve[i] = u16(mo + i * 2); max = csize; }
  let T = huffTable(NIKON_TREE[tree]); const off = R[273].vals()[0]; let p = off, bits = 0, nb = 0;
  const fill = () => { while (nb <= 24) { bits = (bits << 8) | (p < bytes.length ? bytes[p] : 0); p++; nb += 8; } };
  const get = (n) => { if (!n) return 0; if (n > nb) fill(); nb -= n; return (bits >>> nb) & ((1 << n) - 1); };
  const huff = () => { if (nb < 16) fill(); let code = 0; for (let l = 1; l <= 16; l++) { code = (code << 1) | ((bits >>> (nb - l)) & 1); if (code <= T.maxcode[l]) { nb -= l; return T.syms[T.valptr[l] + code - T.mincode[l]]; } } nb -= 16; return 0; };
  const raw = new Uint16Array(W * H), hpred = [0, 0]; let min = 0;
  for (let row = 0; row < H; row++) {
    if (split && row === split) { T = huffTable(NIKON_TREE[tree + 1]); max += (min = 16) << 1; }
    for (let col = 0; col < W; col++) {
      const i = huff(), len = i & 15, shl = i >> 4; let diff = (((get(len - shl) << 1) + 1) << shl) >> 1;
      if (len && (diff & (1 << (len - 1))) === 0) diff -= (1 << len) - (shl ? 0 : 1); else if (!len) diff = 0;
      if (col < 2) hpred[col] = vpred[row & 1][col] += diff; else hpred[col & 1] += diff;
      raw[row * W + col] = curve[MP.clamp((hpred[col & 1] << 16) >> 16, 0, 0x3fff)];
    }
  }
  void max;
  const bl = mn.tags[0x3d] ? mn.tags[0x3d].vals() : null; return { raw, black: bl ? bl.reduce((s, v) => s + v, 0) / bl.length : 0 };
};
{
  // intégration au décodeur RAW : NEF compressé + profils d'appareil
  const dec0 = MP.raw.decode.bind(MP.raw);
  MP.raw.decode = (bytes) => {
    let r;
    try { r = dec0(bytes); }
    catch (e) {
      if (!/NEF compressé/.test(e.message)) throw e;
      const { list } = MP.raw.ifds(bytes), t0 = list[0], G = (t, k, d) => (t[k] ? t[k].vals() : d), S = (t, k) => (t[k] ? t[k].str() : '');
      const R = list.filter((t) => G(t, 259, [0])[0] === 34713).sort((a, b) => G(b, 256)[0] * G(b, 257)[0] - G(a, 256)[0] * G(a, 257)[0])[0];
      const W = G(R, 256)[0], H = G(R, 257)[0], bps = G(R, 258, [12])[0], n = MP.raw.nikon(bytes, R, list, W, H, bps);
      let mx = 0; for (let i = 0; i < n.raw.length; i += 11) mx = Math.max(mx, n.raw[i]);
      r = { raw: n.raw, W, H, ax: 0, ay: 0, aw: W & ~1, ah: H & ~1, pat: [0, 1, 1, 2], pw: 2, black: n.black, white: Math.max(n.black + 1, mx < (1 << bps) * 0.6 ? mx : (1 << bps) - 1), cm: null, generic: true, neutral: null, make: S(t0, 271), model: S(t0, 272), isDng: false, comp: 34713 };
      if (R[33422]) { const v = R[33422].vals(); if (v.length >= 4) r.pat = v.slice(0, 4); }
    }
    if (!r.isDng) {
      const prof = MP.camProfiles.get(r.model);
      if (prof && prof.rgbCam) { r.rgbCam = prof.rgbCam; r.generic = false; r.profileName = prof.name; }
      else if (prof && prof.cm) { r.cm = prof.cm; r.generic = false; r.profileName = prof.name; }
      else if (!r.cm) r.cm = [6722, -635, -963, -4287, 12460, 2028, -908, 2162, 5668].map((v) => v / 10000);
    }
    return r;
  };
  // option : données appareil sans matrice (calibration) ou matrice directe (profil calibré)
  const dev0 = MP.raw.develop.bind(MP.raw);
  MP.raw.develop = (r, o = {}) => {
    if (!o.camera && !r.rgbCam) return dev0(r);
    const keep = r.cm; r.cm = [0.412453, 0.35758, 0.180423, 0.212671, 0.71516, 0.072169, 0.019334, 0.119193, 0.950227].length && MP.colorMath.inv3([0.412453, 0.35758, 0.180423, 0.212671, 0.71516, 0.072169, 0.019334, 0.119193, 0.950227]);
    const hp = dev0(r); r.cm = keep; // hp = valeurs appareil après balance des blancs
    if (o.camera) return hp;
    const M = r.rgbCam, d = hp.data; for (let i = 0; i < d.length; i += 3) { const a = d[i], b = d[i + 1], c = d[i + 2]; d[i] = Math.max(0, M[0] * a + M[1] * b + M[2] * c); d[i + 1] = Math.max(0, M[3] * a + M[4] * b + M[5] * c); d[i + 2] = Math.max(0, M[6] * a + M[7] * b + M[8] * c); }
    return hp;
  };
}

/* =================== Calibration avec une charte ColorChecker =================== */
MP.COLORCHECKER = [[115, 82, 68], [194, 150, 130], [98, 122, 157], [87, 108, 67], [133, 128, 177], [103, 189, 170], [214, 126, 44], [80, 91, 166], [193, 90, 99], [94, 60, 108], [157, 188, 64], [224, 163, 46], [56, 61, 150], [70, 148, 73], [175, 54, 60], [231, 199, 31], [187, 86, 149], [8, 133, 161], [243, 243, 242], [200, 200, 200], [160, 160, 160], [122, 122, 121], [85, 85, 85], [52, 52, 52]];
MP.calibrate = {
  /** matrice 3×3 (moindres carrés) appareil → sRGB linéaire, normalisée sur les gris */
  solve(cam, ref) {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    cam.forEach((c, i) => { const w = i >= 18 ? 3 : 1; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { A[a][b] += w * c[a] * c[b]; B[a][b] += w * c[a] * ref[i][b]; } });
    const Ai = MP.colorMath.inv3(A.flat()), M = []; for (let o = 0; o < 3; o++) for (let k = 0; k < 3; k++) M.push(Ai[k * 3] * B[0][o] + Ai[k * 3 + 1] * B[1][o] + Ai[k * 3 + 2] * B[2][o]);
    return M;
  },
  async open() {
    const d = MP.doc, l = d && d.layers.find((x) => x.smart && x.smart.raw);
    if (!l) { MP.toast('Ouvrez d\'abord la photo RAW d\'une charte ColorChecker (24 cases), prise sous une lumière homogène', 6000); return; }
    const r = l.smart.raw, cam = MP.raw.develop(r, { camera: true }), W = cam.w, H = cam.h, s = Math.min(1, 1100 / Math.max(W, H)), pw = Math.round(W * s), ph = Math.round(H * s);
    const prev = MP.hp.render({ w: W, h: H, data: cam.data, bits: 16 }, { tone: 'linear', exposure: 0.5 }, s), pts = [];
    const back = el('div', { class: 'liq' });
    back.innerHTML = `<div class="liq-side"><h3>Calibrer l'appareil</h3><p class="muted">Cliquez au centre des 4 cases d'angle de la charte, dans cet ordre :<br>1. <b>Peau foncée</b> (en haut à gauche)<br>2. <b>Vert bleuté</b> (en haut à droite)<br>3. <b>Noir</b> (en bas à droite)<br>4. <b>Blanc</b> (en bas à gauche)</p><p class="muted">Appareil : <b>${esc(r.make + ' ' + r.model)}</b></p><div class="cal-st muted"></div><div class="liq-btns"><button class="btn creset">Recommencer</button></div><div class="liq-foot"><button class="btn lcancel">Annuler</button><button class="btn primary lok" disabled>Créer le profil</button></div></div><div class="liq-stage"><canvas class="liq-canvas"></canvas></div>`;
    document.body.appendChild(back); MP.ui.dialogOpen = { close: () => back.remove() };
    const cv = back.querySelector('.liq-canvas'); cv.width = pw; cv.height = ph; const x = cv.getContext('2d');
    const grid = () => { if (pts.length < 4) return null; const H2 = MP.homography(pts.map((p) => ({ x: p[0], y: p[1] }))), cells = []; for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) cells.push(H2(i / 5, j / 3)); return cells; };
    const draw = () => { x.drawImage(prev, 0, 0, pw, ph); x.strokeStyle = '#ffeb3b'; x.lineWidth = 2; pts.forEach((p, i) => { x.beginPath(); x.arc(p[0] * s, p[1] * s, 7, 0, 7); x.stroke(); x.fillStyle = '#ffeb3b'; x.fillText(String(i + 1), p[0] * s + 9, p[1] * s - 9); }); const g = grid(); if (g) { const rad = Math.max(3, Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / 5 * 0.18); g.forEach((c, k) => { x.strokeStyle = k >= 18 ? '#fff' : '#0f0'; x.strokeRect((c.x - rad) * s, (c.y - rad) * s, rad * 2 * s, rad * 2 * s); }); } back.querySelector('.cal-st').textContent = pts.length < 4 ? `Point ${pts.length + 1} / 4` : 'Vérifiez que les 24 carrés tombent bien dans les cases'; back.querySelector('.lok').disabled = pts.length < 4; };
    cv.addEventListener('pointerdown', (e) => { if (pts.length >= 4) return; const rc = cv.getBoundingClientRect(); pts.push([((e.clientX - rc.left) / rc.width) * pw / s, ((e.clientY - rc.top) / rc.height) * ph / s]); draw(); });
    back.querySelector('.creset').onclick = () => { pts.length = 0; draw(); };
    back.querySelector('.lcancel').onclick = () => { back.remove(); MP.ui.dialogOpen = null; };
    back.querySelector('.lok').onclick = async () => {
      const g = grid(), rad = Math.max(2, Math.round(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / 5 * 0.18)), camVals = g.map((c) => { const v = [0, 0, 0]; let n = 0; for (let yy = Math.round(c.y) - rad; yy <= Math.round(c.y) + rad; yy++) for (let xx = Math.round(c.x) - rad; xx <= Math.round(c.x) + rad; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = (yy * W + xx) * 3; v[0] += cam.data[q]; v[1] += cam.data[q + 1]; v[2] += cam.data[q + 2]; n++; } return v.map((u) => u / Math.max(1, n)); });
      const ref = MP.COLORCHECKER.map((c) => c.map((u) => MP.srgbToLin(u / 255))), gray = camVals[19], k = ref[19][1] / Math.max(1e-6, (gray[0] + gray[1] + gray[2]) / 3);
      const M = this.solve(camVals.map((c) => c.map((u) => u * k)), ref).map((u) => u * k);
      let err = 0; camVals.forEach((c, i) => { const o = [0, 1, 2].map((a) => M[a * 3] * c[0] + M[a * 3 + 1] * c[1] + M[a * 3 + 2] * c[2]).map((u) => MP.linToSrgb(Math.max(0, u)) * 255); err += Math.hypot(o[0] - MP.COLORCHECKER[i][0], o[1] - MP.COLORCHECKER[i][1], o[2] - MP.COLORCHECKER[i][2]); });
      back.remove(); MP.ui.dialogOpen = null;
      await MP.camProfiles.save(r.model, { name: 'Calibré avec charte (' + new Date().toLocaleDateString('fr-FR') + ')', rgbCam: M, source: 'charte' });
      MP.toast(`Profil de l'appareil ${r.model} créé (écart moyen ${(err / 24).toFixed(1)} niveaux). Il sera utilisé pour tous les RAW de ce boîtier.`, 7000);
    };
    draw();
  },
};
{
  // conserver les données RAW sur le calque pour la calibration et le redéveloppement
  const of = MP.io.openFile;
  MP.io.openFile = async (f) => {
    const e = ext(f.name);
    if (RAW_EXT.includes(e) && !MP.native.browser && MP.prefs.rawDecode !== false) {
      try { const { list } = MP.raw.ifds(f.data), t0 = list[0], model = t0[272] && t0[272].str(), make = t0[271] && t0[271].str(); if (model && !t0[50706] && !MP.camProfiles.get(model)) { const p = await MP.camProfiles.autoFind(model, make); if (p) MP.toast('Profil Adobe trouvé et associé : ' + p.name, 4000); } } catch (_) { /* */ }
    }
    await of(f);
  };
}
