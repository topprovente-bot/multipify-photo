'use strict';
/* v10 (1/2) — calques 32 bits flottants éditables (peinture HDR), exposition d'affichage 32 bits,
   sessions en direct par Internet (serveur relais), fusion au pixel près des modifications simultanées */

/* =================== 32 bits flottants éditables =================== */
MP.hpf = {
  ev(d) { return Math.pow(2, (d && d.viewEV) || 0); },
  make(l, d, lin) {
    const c = l.canvas, n = c.width * c.height, f = new Float32Array(n * 4);
    if (lin) f.set(lin); else { const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < n * 4; i += 4) { f[i] = MP.srgbToLin(a[i] / 255); f[i + 1] = MP.srgbToLin(a[i + 1] / 255); f[i + 2] = MP.srgbToLin(a[i + 2] / 255); f[i + 3] = a[i + 3] / 255; } }
    if (l.hp16) { const h = l.hp16; for (let i = 0; i < n * 4; i += 4) { f[i] = MP.srgbToLin(h[i] / 65535); f[i + 1] = MP.srgbToLin(h[i + 1] / 65535); f[i + 2] = MP.srgbToLin(h[i + 2] / 65535); f[i + 3] = h[i + 3] / 65535; } l.hp16 = null; }
    l.hpf = f; l._fw = c.width; this.preview(l, d); return l;
  },
  preview(l, d) {
    const c = l.canvas, W = c.width, H = c.height, x = c.getContext('2d'), id = x.createImageData(W, H), a = id.data, f = l.hpf, e = this.ev(d);
    for (let i = 0; i < a.length; i += 4) { const nz = (Math.random() + Math.random() - 1) * 0.5; a[i] = MP.linToSrgb(f[i] * e) * 255 + nz; a[i + 1] = MP.linToSrgb(f[i + 1] * e) * 255 + nz; a[i + 2] = MP.linToSrgb(f[i + 2] * e) * 255 + nz; a[i + 3] = f[i + 3] * 255; }
    x.putImageData(id, 0, 0); l._f8 = new Uint8ClampedArray(a); l._fc = c; l._fv = l._v; l._fh = (l._fh || 0) + 1;
  },
  sync(l, d) {
    const c = l.canvas; if (!l.hpf || (l._fc === c && l._fv === l._v)) return;
    const W = c.width, H = c.height; if (l._fw !== W || l.hpf.length !== W * H * 4 || !l._f8) { this.make(l, d); return; }
    const a = c.getContext('2d').getImageData(0, 0, W, H).data, p = l._f8, f = l.hpf, ie = 1 / this.ev(d), L = MP.srgbToLin;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] === p[i] && a[i + 1] === p[i + 1] && a[i + 2] === p[i + 2] && a[i + 3] === p[i + 3]) continue;
      for (let k = 0; k < 3; k++) if (a[i + k] !== p[i + k]) f[i + k] = Math.max(0, f[i + k] + (L(a[i + k] / 255) - L(p[i + k] / 255)) * ie);
      if (a[i + 3] !== p[i + 3]) f[i + 3] = MP.clamp(f[i + 3] + (a[i + 3] - p[i + 3]) / 255, 0, 1);
    }
    l._f8 = new Uint8ClampedArray(a); l._fc = c; l._fv = l._v; l._fh = (l._fh || 0) + 1; this.schedulePack(l);
  },
  syncDoc(d) { if (d) for (const l of d.layers) if (l.hpf) this.sync(l, d); },
  remap(l, W0, H0, W1, H1, fn) { const mv = (src, T) => { const dst = new T(W1 * H1 * 4); for (let y = 0; y < H1; y++) for (let x = 0; x < W1; x++) { const s = fn(x, y); if (!s || s[0] < 0 || s[1] < 0 || s[0] >= W0 || s[1] >= H0) continue; const i = (s[1] * W0 + s[0]) * 4, j = (y * W1 + x) * 4; for (let k = 0; k < 4; k++) dst[j + k] = src[i + k]; } return dst; }; l.hpf = mv(l.hpf, Float32Array); if (l._f8) l._f8 = mv(l._f8, Uint8ClampedArray); l._fw = W1; l._fc = null; },
  setBits32(d) {
    const ls = d.layers.filter((l) => !l.isGroup && !l.adjust && !l.text && !l.smart && !l.hpf);
    if (d.width * d.height > 30e6) { MP.toast('Image trop grande pour le 32 bits éditable (30 Mpx maximum)'); return; }
    MP.hp16.syncDoc(d); d.history.record('32 bits par couche', null); ls.forEach((l) => this.make(l, d)); d.bits = 32; d.viewEV = d.viewEV || 0; MP.afterEdit(); MP.ui.refreshAll();
    MP.toast(`Document en 32 bits flottants : ${ls.length} calque(s) éditables en HDR (Affichage › Exposition 32 bits pour voir les hautes lumières)`, 6000);
  },
  setViewEV(d, ev) { MP.hpf.syncDoc(d); d.viewEV = ev; for (const l of d.layers) if (l.hpf) this.preview(l, d); MP.render(); MP.ui.refreshStatus(); },
  schedulePack(l) { clearTimeout(l._fpT); l._fpT = setTimeout(() => this.pack(l), 3000); },
  async pack(l) { if (!l.hpf) return; const v = l._fh, n = l.hpf.length, h16 = new Uint16Array(n), f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer); for (let i = 0; i < n; i++) { f32[0] = l.hpf[i]; const x = u32[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff; h16[i] = e <= 0 ? s : e >= 31 ? s | 0x7c00 : s | (e << 10) | (m >>> 13); } const z = await zlib(new Uint8Array(h16.buffer)); let bin = ''; for (let i = 0; i < z.length; i += 0x8000) bin += String.fromCharCode(...z.subarray(i, i + 0x8000)); l._hpfpack = { v, w: l._fw, z: btoa(bin) }; },
  async flush(d) { for (const l of d.layers) if (l.hpf) { this.sync(l, d); if (!l._hpfpack || l._hpfpack.v !== l._fh) { clearTimeout(l._fpT); await this.pack(l); } } },
  async unpack(p) { const b = atob(p.z), z = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) z[i] = b.charCodeAt(i); const u = await unzlib(z), h = new Uint16Array(u.buffer, u.byteOffset, u.byteLength / 2), f = new Float32Array(h.length); for (let i = 0; i < h.length; i++) { const x = h[i], s = x & 0x8000 ? -1 : 1, e = (x >> 10) & 31, m = x & 1023; f[i] = e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? s * 65504 : s * Math.pow(2, e - 15) * (1 + m / 1024); } return f; },
};
{
  const ae = MP.afterEdit; MP.afterEdit = () => { MP.hpf.syncDoc(MP.doc); const d = MP.doc; if (d && d.bits === 32) for (const l of d.layers) if (l._want16 && !l.hpf && !l.isGroup && !l.adjust && !l.text && !l.smart) { l._want16 = false; MP.hpf.make(l, d); } ae(); };
  const proto = Object.getPrototypeOf(new MP.Doc(1, 1, 'x').history), cap = proto.capture, res = proto.restore, rec = proto.record;
  proto.record = function (label, ids) { MP.hpf.syncDoc(this.doc); return rec.call(this, label, ids); };
  proto.capture = function (ids) { const s = cap.call(this, ids), m = new Map(); for (const l of this.doc.layers) if (l.hpf && (ids === 'all' || (ids && ids.includes(l.id)))) m.set(l, { f: l.hpf.slice(), w: l._fw }); s.hpf = m; s.hpfFlag = new Map(this.doc.layers.map((l) => [l, !!l.hpf])); const st = this.undoStack; if (st && st.length > 6) for (const e of st.slice(0, st.length - 6)) if (e.state && e.state.hpf && e.state.hpf.size) e.state.hpf = new Map(); return s; };
  proto.restore = function (s) { res.call(this, s); for (const l of this.doc.layers) { const e = s.hpf && s.hpf.get(l); if (e) { l.hpf = e.f.slice(); l._fw = e.w; l._f8 = new Uint8ClampedArray(l.canvas.getContext('2d').getImageData(0, 0, l.canvas.width, l.canvas.height).data); l._fc = l.canvas; l._fv = l._v; } else if (s.hpfFlag && s.hpfFlag.get(l) === false) l.hpf = null; else if (l.hpf && (l._fw !== l.canvas.width || l.hpf.length !== l.canvas.width * l.canvas.height * 4)) MP.hpf.make(l, this.doc); } };
  const crop = MP.cropDoc; MP.cropDoc = (x, y, w, h) => { const d = MP.doc, W0 = d.width, H0 = d.height; MP.hpf.syncDoc(d); const ls = d.layers.filter((l) => l.hpf); crop(x, y, w, h); ls.forEach((l) => MP.hpf.remap(l, W0, H0, w, h, (xx, yy) => [xx + x, yy + y])); MP.hpf.syncDoc(d); };
  const cs = MP.canvasSize; MP.canvasSize = (w, h, ax, ay, fill) => { const d = MP.doc, W0 = d.width, H0 = d.height; MP.hpf.syncDoc(d); const ls = d.layers.filter((l) => l.hpf); cs(w, h, ax, ay, fill); const ox = Math.round((Math.round(w) - W0) * ax), oy = Math.round((Math.round(h) - H0) * ay); ls.forEach((l) => MP.hpf.remap(l, W0, H0, d.width, d.height, (xx, yy) => [xx - ox, yy - oy])); MP.hpf.syncDoc(d); };
  const fl = MP.flipImage; MP.flipImage = (hz, only) => { const d = MP.doc; MP.hpf.syncDoc(d); const ls = (only ? [d.layer] : d.layers).filter((l) => l.hpf), W = d.width, H = d.height; fl(hz, only); ls.forEach((l) => MP.hpf.remap(l, W, H, W, H, (x, y) => (hz ? [W - 1 - x, y] : [x, H - 1 - y]))); MP.hpf.syncDoc(d); };
  const ls0 = MP.fcomp.layerSrc;
  MP.fcomp.layerSrc = (d, l, linear) => {
    if (!l.hpf || MP.fx.has(l) || l.blendIf) return ls0(d, l, linear);
    MP.hpf.sync(l, d); const n = d.width * d.height, f = l.hpf, src = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i += 4) { for (let k = 0; k < 3; k++) src[i + k] = linear ? f[i + k] : MP.linToSrgb(f[i + k]); src[i + 3] = f[i + 3]; }
    const m = MP.fcomp.maskOf(l, n), fill = l.fill == null ? 1 : l.fill; if (m || fill < 1) for (let i = 0; i < n; i++) src[i * 4 + 3] *= (m ? m[i] : 1) * fill; return src;
  };
  const ser = MP.io.serialize, op = MP.io.openProject, sv = MP.io.save;
  MP.io.serialize = (d) => { const j = JSON.parse(ser(d)); j.viewEV = d.viewEV || 0; d.layers.forEach((l, i) => { if (l.hpf && l._hpfpack) j.layers[i].hpf = l._hpfpack; }); const out = JSON.stringify(j); d._lastSer = out; return out; };
  MP.io.save = async (as) => { if (MP.doc) await MP.hpf.flush(MP.doc); return sv(as); };
  MP.io.openProject = async (f) => { const before = MP.doc; await op(f); const d = MP.doc; if (!d || d === before) return; try { const j = JSON.parse(new TextDecoder().decode(f.data)); d.viewEV = j.viewEV || 0; for (const [i, s] of j.layers.entries()) { const l = d.layers[i]; if (!s.hpf || !l) continue; const fl2 = await MP.hpf.unpack(s.hpf); if (fl2.length === l.canvas.width * l.canvas.height * 4) { l.hpf = fl2; l._fw = l.canvas.width; l._hpfpack = s.hpf; MP.hpf.preview(l, d); } } MP.render(); } catch (e) { console.warn(e); } };
  const sb = MP.hp.setDocBits;
  MP.hp.setDocBits = (bits) => { const d = MP.doc; if (bits === 32) return MP.hpf.setBits32(d); if (d.layers.some((l) => l.hpf)) { d.history.record(bits + ' bits par couche', null); for (const l of d.layers) if (l.hpf) { const lin = l.hpf; l.hpf = null; if (bits === 16) { const n = lin.length / 4, f = new Float32Array(lin.length); for (let i = 0; i < n * 4; i += 4) { for (let k = 0; k < 3; k++) f[i + k] = MP.linToSrgb(lin[i + k] * MP.hpf.ev(d)); f[i + 3] = lin[i + 3]; } MP.hp16.make(l, f); } } } return sb(bits); };
  // les réglages destructifs sur un calque 32 bits passent par la différence (précision flottante conservée hors zone modifiée)
  const rs = UI.refreshStatus; UI.refreshStatus = () => { rs(); const d = MP.doc, s = $('#st-size'); if (d && s && d.bits === 32) s.textContent += ` — expo. ${(d.viewEV || 0) >= 0 ? '+' : ''}${(d.viewEV || 0).toFixed(1)} IL`; };
  const bm = UI.menus;
  UI.menus = () => { const m = bm(), af = (m.find((x) => x.label === 'Affichage') || { items: [] }).items; af.push('-', { label: 'Exposition d\'affichage 32 bits…', act: need(() => { const d = MP.doc; if (d.bits !== 32) { MP.toast('Disponible pour les documents 32 bits (Image › Mode › 32 bits)'); return; } MP.ui.dialog({ title: 'Exposition d\'affichage 32 bits', width: 380, preview: true, fields: [{ k: 'ev', label: 'Exposition (IL)', type: 'range', min: -8, max: 8, step: 0.1 }], values: { ev: d.viewEV || 0 }, onChange: (v) => MP.hpf.setViewEV(d, v.ev), onOk: (v) => MP.hpf.setViewEV(d, v.ev) }); }) }); return m; };
  const rl = UI.refreshLayers; UI.refreshLayers = () => { rl(); const d = MP.doc; if (!d) return; document.querySelectorAll('#layerlist .layer[data-id]').forEach((r) => { const l = d.byId(+r.dataset.id); if (l && l.hpf) { const nm = r.querySelector('.lname'); if (nm && !nm.querySelector('.b16')) nm.insertAdjacentHTML('beforeend', '<i class="b16" title="32 bits flottants">32</i>'); } }); };
}

/* =================== Fusion au pixel près des modifications simultanées =================== */
{
  const RT = MP.rt, fl0 = RT.flush.bind(RT);
  // remplace l'envoi de rectangles par rectangle + masque des pixels réellement modifiés
  RT.maskPng = (a, b, W, r) => { const c = MP.createCanvas(r.w, r.h), x = c.getContext('2d'), id = x.createImageData(r.w, r.h); for (let y = 0; y < r.h; y++) for (let xx = 0; xx < r.w; xx++) { const i = ((y + r.y) * W + xx + r.x) * 4; if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) id.data[(y * r.w + xx) * 4 + 3] = 255; } x.putImageData(id, 0, 0); return c.toDataURL('image/png'); };
  const send0 = RT.send.bind(RT);
  RT.send = (m) => {
    if (m.t === 'patch' && m.rect && !m.cm) { const l = RT.layerOf(m.uid), s = l && RT._prevPx && RT._prevPx.get(m.uid); if (s && s.length === l.canvas.width * l.canvas.height * 4) m.cm = RT.maskPng(s, RT.pix(l.canvas), l.canvas.width, m.rect); }
    if (m.t === 'patch' && m.mrect && m.mask) { const l = RT.layerOf(m.uid), s = l && RT._prevMk && RT._prevMk.get(m.uid); if (s && l.mask) m.mcm = RT.maskPng(s, RT.pix(l.mask), l.mask.width, m.mrect); }
    return send0(m);
  };
  RT.flush = () => { const d = RT.doc; if (d) { RT._prevPx = new Map(); RT._prevMk = new Map(); for (const [u, s] of RT.sent) { if (s.px) RT._prevPx.set(u, s.px); if (s.mk) RT._prevMk.set(u, s.mk); } } try { fl0(); } finally { RT._prevPx = RT._prevMk = null; } };
  const ap0 = RT.applyPatch.bind(RT);
  RT.applyPatch = async (m) => {
    // envoyer d'abord nos propres modifications en attente, sinon elles seraient absorbées par la réception
    if (RT.on && !RT.applying && RT.doc === MP.doc) { clearTimeout(RT._ft); clearTimeout(RT._rt); RT.flush(); }
    if (!m.cm && !m.mcm) return ap0(m);
    const d = RT.doc, l = RT.layerOf(m.uid); if (!d || !l) return; RT.applying = true;
    try {
      Object.assign(l, m.props); if (m.props.text) MP.renderText(l);
      const img = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
      const put = async (target, png, cm, r) => { const [p, k] = await Promise.all([img(png), img(cm)]), t = MP.createCanvas(r.w, r.h), tx = t.getContext('2d'); tx.drawImage(p, 0, 0); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(k, 0, 0); const x = target.getContext('2d'); x.save(); x.translate(r.x, r.y); x.globalCompositeOperation = 'destination-out'; x.drawImage(k, 0, 0); x.globalCompositeOperation = 'source-over'; x.drawImage(t, 0, 0); x.restore(); };
      if (m.png && m.rect) await put(l.canvas, m.png, m.cm, m.rect); if (l.hp16) l._pc = null; if (l.hpf) l._fc = null;
      if (m.mask === null) l.mask = null; else if (m.mask && m.mrect) { if (!l.mask) l.mask = MP.createCanvas(d.width, d.height); if (m.mcm) await put(l.mask, m.mask, m.mcm, m.mrect); else { const i = await img(m.mask), x = l.mask.getContext('2d'); x.clearRect(m.mrect.x, m.mrect.y, m.mrect.w, m.mrect.h); x.drawImage(i, m.mrect.x, m.mrect.y); } }
      l._v = (l._v || 0) + 1; if (l.hp16) MP.hp16.sync(l); if (l.hpf) MP.hpf.sync(l, d); RT.mark(l); MP.render(); clearTimeout(RT._rl); RT._rl = setTimeout(() => MP.ui.refreshLayers(), 150);
    } finally { RT.applying = false; }
  };
}

/* =================== Sessions par Internet (serveur relais) =================== */
{
  const RT = MP.rt;
  RT.relayHost = async () => {
    const d = MP.doc; if (!d) { MP.toast('Ouvrez le document à partager'); return; }
    const relay = (MP.prefs.rtRelay || '').trim().replace(/\/+$/, ''); if (!relay) { RT.relaySettings(true); return; }
    const room = Math.random().toString(36).slice(2, 8), code = String(Math.floor(100000 + Math.random() * 900000));
    RT.doc = d; RT.isHost = true; const ok = await RT.connect(`${relay}/r/${room}?code=${code}`, true); if (!ok) return;
    const inv = `${relay}/r/${room}#${code}`; RT.invite = inv;
    MP.ui.dialog({ title: '🌐 Session en direct par Internet', width: 500, noCancel: true, fields: [{ type: 'info', html: `<p>Envoyez cette invitation à vos collaborateurs (où qu'ils soient) :</p><p style="font-size:14px;word-break:break-all"><b>${esc(inv)}</b></p><p class="muted">Ils choisissent Fichier › Partager › Rejoindre une session en direct et collent l'invitation. Les échanges passent par votre serveur relais.</p>` }, { type: 'button', label: 'Copier l\'invitation', action: () => { navigator.clipboard.writeText(inv); MP.toast('Invitation copiée'); } }], values: {} });
  };
  RT.relaySettings = (thenHost) => MP.ui.dialog({ title: 'Serveur relais pour les sessions par Internet', width: 520, okLabel: thenHost ? 'Enregistrer et démarrer' : 'Enregistrer',
    fields: [{ k: 'u', label: 'Adresse du serveur relais (wss://…)', type: 'text' }, { type: 'info', html: '<p class="muted">Installez le relais fourni (<code>collab-server.js</code>, sans dépendance) sur n\'importe quel serveur Node.js — par exemple celui de multipify.eu — derrière HTTPS (nginx, Caddy ou Plesk) : <code>node collab-server.js 41700 --relay</code>. Voir le fichier RELAIS.md du projet.</p>' }],
    values: { u: MP.prefs.rtRelay || 'wss://' }, onOk: (v) => { MP.prefs.rtRelay = v.u.trim(); MP.savePrefs(); if (thenHost) setTimeout(() => RT.relayHost(), 50); } });
  const join0 = RT.join.bind(RT);
  RT.join = () => MP.ui.dialog({ title: 'Rejoindre une session en direct', width: 460, okLabel: 'Rejoindre', fields: [{ k: 'a', label: 'Invitation (Internet) ou adresse réseau local (ex. 192.168.1.20:41700)', type: 'text' }, { k: 'c', label: 'Code (réseau local uniquement)', type: 'text' }, { k: 'n', label: 'Votre nom', type: 'text' }], values: { a: MP.prefs.rtLast || '', c: '', n: MP.comments.author() },
    onOk: (v) => { const a = v.a.trim(); if (!a) return false; MP.prefs.rtLast = a; if (v.n.trim()) MP.prefs.userName = v.n.trim(); MP.savePrefs(); RT.isHost = false;
      if (/^wss?:\/\/.+\/r\/[^#?]+#\d+$/.test(a)) { const [u, code] = a.split('#'); RT.connect(`${u}?code=${code}`, false); } else { const h = a.replace(/^ws:\/\//, ''); RT.connect(`ws://${h.includes(':') ? h : h + ':41700'}/?code=${encodeURIComponent(v.c.trim())}`, false); } } });
  void join0;
  const bm = UI.menus;
  UI.menus = () => { const m = bm(), fi = (m.find((x) => x.label === 'Fichier') || { items: [] }).items, pa = fi.find((x) => x && x !== '-' && x.label === 'Partager'); if (pa) { const s0 = pa.sub; pa.sub = () => { const it = s0(); const i = it.findIndex((x) => x && x !== '-' && String(typeof x.label === 'function' ? x.label() : x.label).startsWith('Rejoindre')); it.splice(i < 0 ? 1 : i, 0, { label: 'Démarrer une session par Internet (serveur relais)…', disabled: RT.on, act: need(() => RT.relayHost()) }); it.splice(it.findIndex((x) => x === '-'), 0, { label: 'Serveur relais…', act: () => RT.relaySettings(false) }); return it; }; } return m; };
}
