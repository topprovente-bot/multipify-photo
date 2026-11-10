'use strict';
/* v9 (2/3) — calques 16 bits éditables : chaque calque de pixels garde ses données en 16 bits par couche ;
   pinceaux, gommes, tampons, filtres et transformations modifient l'aperçu 8 bits, et la différence exacte est
   reportée sur les données 16 bits (la précision existante n'est jamais perdue). Réglages appliqués directement
   en 16 bits par table 3D. Historique, recadrage, zone de travail, symétries, export et .mpp gèrent le 16 bits. */

MP.hp16 = {
  /** crée les données 16 bits d'un calque (depuis son contenu 8 bits ou depuis des flottants) */
  make(l, floats) {
    const c = l.canvas, n = c.width * c.height, a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, h = new Uint16Array(n * 4);
    if (floats) for (let i = 0; i < n * 4; i++) h[i] = MP.clamp(Math.round(floats[i] * 65535), 0, 65535); else for (let i = 0; i < n * 4; i++) h[i] = a[i] * 257;
    l.hp16 = h; l._hw = c.width; this.preview(l); return l;
  },
  /** aperçu 8 bits tramé (évite les cassures de dégradé à l'écran) */
  preview(l) {
    const c = l.canvas, W = c.width, H = c.height, x = c.getContext('2d'), id = x.createImageData(W, H), a = id.data, h = l.hp16;
    for (let i = 0; i < a.length; i += 4) { const nz = (Math.random() + Math.random() - 1) * 0.5; a[i] = h[i] / 257 + nz; a[i + 1] = h[i + 1] / 257 + nz; a[i + 2] = h[i + 2] / 257 + nz; a[i + 3] = (h[i + 3] + 128) / 257; }
    x.putImageData(id, 0, 0); l._p8 = new Uint8ClampedArray(a); l._pc = c; l._pv = l._v; l._hv = (l._hv || 0) + 1;
  },
  /** reporte sur les données 16 bits ce qui a changé dans l'aperçu 8 bits */
  sync(l) {
    const c = l.canvas; if (!l.hp16 || (l._pc === c && l._pv === l._v)) return;
    const W = c.width, H = c.height; if (l._hw !== W || l.hp16.length !== W * H * 4 || !l._p8) { this.make(l); return; }
    const a = c.getContext('2d').getImageData(0, 0, W, H).data, p = l._p8, h = l.hp16, adj = MP._hpAdj && MP._hpAdj.l === l ? MP._hpAdj : null; MP._hpAdj = null;
    if (adj && adj.T) { this.applyLut(l, adj.T, adj.sel); }
    else for (let i = 0; i < a.length; i++) { const dlt = a[i] - p[i]; if (dlt) h[i] = MP.clamp(h[i] + dlt * 257, 0, 65535); }
    l._p8 = new Uint8ClampedArray(a); l._pc = c; l._pv = l._v; l._hv = (l._hv || 0) + 1; this.schedulePack(l);
    if (adj && adj.T) this.preview(l);
  },
  syncDoc(d) { if (d) for (const l of d.layers) if (l.hp16) this.sync(l); },
  applyLut(l, T, sel) {
    const h = l.hp16, G = 33, g = G - 1, n = h.length / 4;
    for (let i = 0; i < n; i++) {
      const p = i * 4; if (!h[p + 3]) continue; const w = sel ? sel[p + 3] / 255 : 1; if (w <= 0) continue;
      const x = (h[p] / 65535) * g, y = (h[p + 1] / 65535) * g, z = (h[p + 2] / 65535) * g, x0 = Math.min(g - 1, x | 0), y0 = Math.min(g - 1, y | 0), z0 = Math.min(g - 1, z | 0), fx = x - x0, fy = y - y0, fz = z - z0;
      for (let c = 0; c < 3; c++) { const I = (a, b, cc) => T[((a * G + b) * G + cc) * 3 + c]; const v = ((I(x0, y0, z0) * (1 - fz) + I(x0, y0, z0 + 1) * fz) * (1 - fy) + (I(x0, y0 + 1, z0) * (1 - fz) + I(x0, y0 + 1, z0 + 1) * fz) * fy) * (1 - fx) + ((I(x0 + 1, y0, z0) * (1 - fz) + I(x0 + 1, y0, z0 + 1) * fz) * (1 - fy) + (I(x0 + 1, y0 + 1, z0) * (1 - fz) + I(x0 + 1, y0 + 1, z0 + 1) * fz) * fy) * fx; h[p + c] = MP.clamp(Math.round((h[p + c] / 65535 * (1 - w) + v * w) * 65535), 0, 65535); }
    }
  },
  /** transformation géométrique exacte appliquée aux données 16 bits et à l'aperçu de référence */
  remap(l, W0, H0, W1, H1, fn) {
    const move = (src, T) => { const dst = new T(W1 * H1 * 4); for (let y = 0; y < H1; y++) for (let x = 0; x < W1; x++) { const s = fn(x, y); if (!s || s[0] < 0 || s[1] < 0 || s[0] >= W0 || s[1] >= H0) continue; const i = (s[1] * W0 + s[0]) * 4, j = (y * W1 + x) * 4; dst[j] = src[i]; dst[j + 1] = src[i + 1]; dst[j + 2] = src[i + 2]; dst[j + 3] = src[i + 3]; } return dst; };
    l.hp16 = move(l.hp16, Uint16Array); if (l._p8) l._p8 = move(l._p8, Uint8ClampedArray); l._hw = W1; l._pc = null;
  },
  // ---- conversion du document ----
  setBits16(d) {
    const ls = d.layers.filter((l) => !l.isGroup && !l.adjust && !l.text && !l.smart && !l.hp16); if (!ls.length && d.bits === 16) { MP.toast('Document déjà en 16 bits'); return; }
    if (d.width * d.height > 40e6) { MP.toast('Image trop grande pour le 16 bits éditable (40 Mpx maximum)'); return; }
    d.history.record('16 bits par couche', null); ls.forEach((l) => this.make(l)); d.bits = 16; MP.afterEdit(); MP.ui.refreshAll();
    MP.toast(`Document en 16 bits par couche : ${ls.length} calque(s) éditables en 16 bits (pinceaux, filtres et réglages conservent la précision)`, 5000);
  },
  setBits8(d) { d.history.record('8 bits par couche', null); d.layers.forEach((l) => { l.hp16 = null; l._p8 = null; l._hp16pack = null; }); d.bits = 8; MP.ui.refreshAll(); },
  /** pixellise un objet dynamique 16/32 bits en calque 16 bits éditable */
  rasterizeHp(d, l) {
    if (!l.smart || !l.smart.hp) return; d.history.record('Pixelliser en 16 bits', [l.id]);
    const f = MP.fcomp.fromHp(d, l, false); l.canvas = MP.createCanvas(d.width, d.height); l.smart = null; this.make(l, f); d.bits = Math.max(16, d.bits || 8); MP.afterEdit();
  },
  // ---- enregistrement compact ----
  schedulePack(l) { clearTimeout(l._packT); l._packT = setTimeout(() => this.pack(l), 2500); },
  async pack(l) { if (!l.hp16) return; const v = l._hv, z = await zlib(new Uint8Array(l.hp16.buffer, l.hp16.byteOffset, l.hp16.byteLength)); let bin = ''; for (let i = 0; i < z.length; i += 0x8000) bin += String.fromCharCode(...z.subarray(i, i + 0x8000)); l._hp16pack = { v, w: l._hw, z: btoa(bin) }; },
  async flush(d) { for (const l of d.layers) if (l.hp16) { this.sync(l); if (!l._hp16pack || l._hp16pack.v !== l._hv) { clearTimeout(l._packT); await this.pack(l); } } },
  async unpack(p) { const b = atob(p.z), z = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) z[i] = b.charCodeAt(i); const u = await unzlib(z); return new Uint16Array(u.buffer, u.byteOffset, u.byteLength / 2); },
};

/* =================== Branchements =================== */
{
  // synchronisation après chaque modification
  const ae = MP.afterEdit; MP.afterEdit = () => { MP.hp16.syncDoc(MP.doc); ae(); };
  // historique : instantanés 16 bits (10 derniers états pour limiter la mémoire)
  const proto = Object.getPrototypeOf(new MP.Doc(1, 1, 'x').history), cap = proto.capture, res = proto.restore, rec = proto.record;
  proto.record = function (label, ids) { MP.hp16.syncDoc(this.doc); return rec.call(this, label, ids); };
  proto.capture = function (ids) { const s = cap.call(this, ids), hp = new Map(); for (const l of this.doc.layers) if (l.hp16 && (ids === 'all' || (ids && ids.includes(l.id)))) hp.set(l, { h: l.hp16.slice(), w: l._hw }); s.hp16 = hp; s.hp16Flag = new Map(this.doc.layers.map((l) => [l, !!l.hp16])); const st = this.undoStack; if (st && st.length > 10) for (const e of st.slice(0, st.length - 10)) if (e.state && e.state.hp16 && e.state.hp16.size) e.state.hp16 = new Map(); return s; };
  proto.restore = function (s) { res.call(this, s); for (const l of this.doc.layers) { const e = s.hp16 && s.hp16.get(l); if (e) { l.hp16 = e.h.slice(); l._hw = e.w; l._p8 = new Uint8ClampedArray(l.canvas.getContext('2d').getImageData(0, 0, l.canvas.width, l.canvas.height).data); l._pc = l.canvas; l._pv = l._v; } else if (s.hp16Flag && s.hp16Flag.get(l) === false) { l.hp16 = null; } else if (l.hp16 && (l._hw !== l.canvas.width || l.hp16.length !== l.canvas.width * l.canvas.height * 4)) MP.hp16.make(l); } };
  // recadrage, zone de travail, symétries : transformation exacte des données 16 bits
  const crop = MP.cropDoc; MP.cropDoc = (x, y, w, h) => { const d = MP.doc, W0 = d.width, H0 = d.height; MP.hp16.syncDoc(d); const ls = d.layers.filter((l) => l.hp16); crop(x, y, w, h); ls.forEach((l) => MP.hp16.remap(l, W0, H0, w, h, (xx, yy) => [xx + x, yy + y])); MP.hp16.syncDoc(d); };
  const cs = MP.canvasSize; MP.canvasSize = (w, h, ax, ay, fill) => { const d = MP.doc, W0 = d.width, H0 = d.height; MP.hp16.syncDoc(d); const ls = d.layers.filter((l) => l.hp16); cs(w, h, ax, ay, fill); const ox = Math.round((Math.round(w) - W0) * ax), oy = Math.round((Math.round(h) - H0) * ay); ls.forEach((l) => MP.hp16.remap(l, W0, H0, d.width, d.height, (xx, yy) => [xx - ox, yy - oy])); MP.hp16.syncDoc(d); };
  const fl = MP.flipImage; MP.flipImage = (hz, only) => { const d = MP.doc; MP.hp16.syncDoc(d); const ls = (only ? [d.layer] : d.layers).filter((l) => l.hp16), W = d.width, H = d.height; fl(hz, only); ls.forEach((l) => MP.hp16.remap(l, W, H, W, H, (x, y) => (hz ? [W - 1 - x, y] : [x, H - 1 - y]))); MP.hp16.syncDoc(d); };
  // réglages : calculés directement en 16 bits (table 3D) au lieu d'arrondir à 8 bits
  const ra = MP.runAdjust;
  MP.runAdjust = (key, isFilter) => {
    const d = MP.doc, l = d && d.layer; if (!l || !l.hp16 || isFilter || l.smart || SPATIAL_ADJ.has(key) || (MP.ADJUST[key] && MP.ADJUST[key].needsBlur)) return ra(key, isFilter);
    const spec = MP.ADJUST[key], dlg = MP.ui.dialog; let vals = {};
    MP.ui.dialog = (cfg) => { MP.ui.dialog = dlg; vals = cfg.values; const ok = cfg.onOk; cfg.onOk = (v) => { MP._hpAdj = { l, T: MP.fcomp.adjLut(d, { adjust: { key, values: JSON.parse(JSON.stringify(v)) } }), sel: d.selection ? d.selection.getContext('2d').getImageData(0, 0, d.width, d.height).data : null }; return ok(v); }; return dlg(cfg); };
    try { ra(key, isFilter); } finally { if (MP.ui.dialog !== dlg) MP.ui.dialog = dlg; }
    if (!spec.fields) { /* réglage sans paramètres : appliqué immédiatement */ }
    void vals;
  };
  // composition haute précision : utilise les données 16 bits des calques
  const ls0 = MP.fcomp.layerSrc.bind(MP.fcomp);
  MP.fcomp.layerSrc = (d, l, linear) => {
    if (!l.hp16 || MP.fx.has(l) || l.blendIf) return ls0(d, l, linear);
    MP.hp16.sync(l); const n = d.width * d.height, h = l.hp16, src = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i += 4) { for (let k = 0; k < 3; k++) src[i + k] = linear ? MP.srgbToLin(h[i + k] / 65535) : h[i + k] / 65535; src[i + 3] = h[i + 3] / 65535; }
    const m = MP.fcomp.maskOf(l, n), fill = l.fill == null ? 1 : l.fill; if (m || fill < 1) for (let i = 0; i < n; i++) src[i * 4 + 3] *= (m ? m[i] : 1) * fill; return src;
  };
  // .mpp : données 16 bits compressées
  const ser = MP.io.serialize, op = MP.io.openProject, sv = MP.io.save;
  MP.io.serialize = (d) => { const j = JSON.parse(ser(d)); d.layers.forEach((l, i) => { if (l.hp16 && l._hp16pack) j.layers[i].hp16 = l._hp16pack; }); const out = JSON.stringify(j); d._lastSer = out; return out; };
  MP.io.save = async (as) => { if (MP.doc) await MP.hp16.flush(MP.doc); return sv(as); };
  MP.io.openProject = async (f) => {
    const before = MP.doc; await op(f); const d = MP.doc; if (!d || d === before) return;
    try { const j = JSON.parse(new TextDecoder().decode(f.data)); for (const [i, s] of j.layers.entries()) { const l = d.layers[i]; if (!s.hp16 || !l) continue; const h = await MP.hp16.unpack(s.hp16); if (h.length === l.canvas.width * l.canvas.height * 4) { l.hp16 = h; l._hw = l.canvas.width; l._hp16pack = s.hp16; MP.hp16.preview(l); } } MP.render(); } catch (e) { console.warn(e); }
  };
  // Image > Mode : 8 / 16 / 32 bits
  const sb = MP.hp.setDocBits.bind(MP.hp);
  MP.hp.setDocBits = (bits) => { const d = MP.doc; if (bits === 16) return MP.hp16.setBits16(d); if (bits === 8) { MP.hp16.setBits8(d); return sb(8); } return sb(bits); };
  // menus : pixelliser en 16 bits, indicateur 16 bits dans les calques
  const bm = UI.menus;
  UI.menus = () => { const m = bm(), ca = (m.find((x) => x.label === 'Calque') || { items: [] }).items, so = ca.find((x) => x && x !== '-' && x.label === 'Objets dynamiques'); if (so) { const s0 = so.sub; so.sub = () => [...s0(), { label: 'Pixelliser en calque 16 bits éditable', act: need(() => { const d = MP.doc; if (!d.layer.smart || !d.layer.smart.hp) { MP.toast('Sélectionnez un objet dynamique 16/32 bits (RAW, TIFF 16 bits, HDR)'); return; } MP.hp16.rasterizeHp(d, d.layer); }) }]; } return m; };
  const rl = UI.refreshLayers; UI.refreshLayers = () => { rl(); const d = MP.doc; if (!d) return; document.querySelectorAll('#layerlist .layer[data-id]').forEach((r) => { const l = d.byId(+r.dataset.id); if (l && (l.hp16 || (l.smart && l.smart.hp))) { const nm = r.querySelector('.lname'); if (nm && !nm.querySelector('.b16')) nm.insertAdjacentHTML('beforeend', `<i class="b16" title="Données haute précision">${l.hp16 ? '16' : l.smart.hp.bits}</i>`); } }); };
  // nouveaux calques dans un document 16 bits
  const add = MP.Doc.prototype.addLayer; MP.Doc.prototype.addLayer = function (name, index) { const l = add.call(this, name, index); if (this.bits === 16 && l && !this._noHp) { l._want16 = true; } return l; };
  const ae2 = MP.afterEdit; MP.afterEdit = () => { const d = MP.doc; if (d && d.bits === 16) for (const l of d.layers) if (l._want16 && !l.hp16 && !l.isGroup && !l.adjust && !l.text && !l.smart) { l._want16 = false; MP.hp16.make(l); } ae2(); };
}
