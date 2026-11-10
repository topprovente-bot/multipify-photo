'use strict';
/* v9 (3/3) — sessions en direct sur le réseau local : plusieurs personnes modifient le même document en même temps ;
   chaque coup de pinceau, chaque modification de calque, de texte, de masque ou de structure est transmis aux autres
   en quelques dizaines de millisecondes, avec les curseurs des participants affichés en direct. */

const RT_COLORS = ['#ff5252', '#40c4ff', '#69f0ae', '#ffd740', '#e040fb', '#ff6e40', '#64ffda', '#b388ff'];
MP.rt = {
  ws: null, id: null, peers: new Map(), doc: null, sent: new Map(), queue: Promise.resolve(), applying: false, isHost: false,
  get on() { return !!(this.ws && this.ws.readyState === 1); },
  color() { return MP.prefs.rtColor || (MP.prefs.rtColor = RT_COLORS[Math.floor(Math.random() * RT_COLORS.length)]); },
  async host() {
    const d = MP.doc; if (!d) { MP.toast('Ouvrez le document à partager'); return; }
    if (!MP.native.rtHostStart) { MP.toast('Héberger une session nécessite l\'application installée (Windows / macOS)'); return; }
    const info = await MP.native.rtHostStart(41700); if (info.error) { MP.toast('Impossible de démarrer la session : ' + info.error, 6000); return; }
    this.doc = d; this.isHost = true; await this.connect(`ws://127.0.0.1:${info.port}/?code=${info.code}`, true);
    MP.ui.dialog({ title: '🔴 Session en direct démarrée', width: 480, noCancel: true, fields: [{ type: 'info', html: `<p>Vos collègues, sur le même réseau (bureau, Wi-Fi, VPN), choisissent <b>Fichier › Partager › Rejoindre une session en direct</b> et saisissent :</p><p style="font-size:16px">Adresse : <b>${info.ips.map((ip) => ip + ':' + info.port).join('</b> ou <b>') || '127.0.0.1:' + info.port}</b><br>Code : <b>${info.code}</b></p><p class="muted">Autorisez Multipify Photo dans le pare-feu si Windows le demande. Chaque modification est partagée instantanément ; vous restez propriétaire du fichier (enregistrez-le normalement).</p>` }, { type: 'button', label: 'Copier l\'invitation', action: () => { navigator.clipboard.writeText(`Session Multipify Photo — adresse ${info.ips[0] || '127.0.0.1'}:${info.port}, code ${info.code}`); MP.toast('Invitation copiée'); } }], values: {} });
  },
  join() {
    MP.ui.dialog({ title: 'Rejoindre une session en direct', width: 420, okLabel: 'Rejoindre', fields: [{ k: 'a', label: 'Adresse (ex. 192.168.1.20:41700)', type: 'text' }, { k: 'c', label: 'Code', type: 'text' }, { k: 'n', label: 'Votre nom', type: 'text' }], values: { a: MP.prefs.rtLast || '', c: '', n: MP.comments.author() },
      onOk: (v) => { const a = v.a.trim().replace(/^ws:\/\//, ''); if (!a) return false; MP.prefs.rtLast = a; if (v.n.trim()) MP.prefs.userName = v.n.trim(); MP.savePrefs(); this.isHost = false; this.connect(`ws://${a.includes(':') ? a : a + ':41700'}/?code=${encodeURIComponent(v.c.trim())}`, false); } });
  },
  connect(url, host) {
    return new Promise((resolve) => {
      if (this.ws) try { this.ws.close(); } catch (_) { /* */ }
      const ws = new WebSocket(url); this.ws = ws;
      ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', name: MP.comments.author(), color: this.color(), host })); };
      ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } this.queue = this.queue.then(() => this.handle(m)).catch((err) => console.warn('rt', err)); if (m.t === 'welcome') resolve(true); };
      ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.peers.clear(); MP.toast('Session en direct terminée'); this.ui(); MP.renderView(); } resolve(false); };
      ws.onerror = () => { MP.toast('Connexion impossible à la session (adresse, code ou pare-feu)', 6000); };
    });
  },
  leave() { if (this.ws) this.ws.close(); this.ws = null; if (this.isHost && MP.native.rtHostStop) MP.native.rtHostStop(); this.isHost = false; this.peers.clear(); this.doc = null; this.ui(); MP.renderView(); },
  send(m) { if (this.on) this.ws.send(JSON.stringify(m)); },
  ui() { UI.refreshComments && UI.refreshComments(); MP.ui.refreshLayers(); const s = $('#status'); if (!s) return; let b = s.querySelector('.rtb'); if (!b) { b = el('span', { class: 'rtb' }); s.appendChild(b); } b.innerHTML = this.on ? `🔴 En direct — ${this.peers.size + 1} participant(s)` : ''; },
  // ---------- réception ----------
  async handle(m) {
    switch (m.t) {
      case 'welcome': this.id = m.id; this.setRoster(m.roster); if (!this.isHost) this.send({ t: 'need-full' }); else this.snapshot(this.doc); MP.toast(this.isHost ? 'Session en direct ouverte' : 'Connecté — réception du document…'); break;
      case 'roster': { const before = new Set(this.peers.keys()); this.setRoster(m.roster); if (m.joined && !before.has(m.joined)) MP.toast('👤 ' + (this.peers.get(m.joined) || {}).name + ' a rejoint la session'); if (m.left) MP.toast('👤 Un participant a quitté la session'); break; }
      case 'need-full': if (this.isHost && this.doc) { await MP.hp16 && MP.hp16.flush(this.doc); this.send({ t: 'full', to: m.from, json: MP.io.serialize(this.doc) }); } break;
      case 'full': await this.loadFull(m); break;
      case 'patch': await this.applyPatch(m); break;
      case 'layer': await this.applyLayer(m); break;
      case 'order': this.applyOrder(m); break;
      case 'cursor': { const p = this.peers.get(m.from); if (p) { p.cursor = { x: m.x, y: m.y }; p.uid = m.uid; p.tool = m.tool; MP.renderView(); clearTimeout(this._lt); this._lt = setTimeout(() => MP.ui.refreshLayers(), 300); } break; }
      case 'comments': if (this.doc) { MP.comments.merge(this.doc, m.comments); UI.refreshComments(); MP.renderView(); } break;
    }
  },
  setRoster(list) { this.peers = new Map(list.filter((p) => p.id !== this.id).map((p) => [p.id, { ...p, ...(this.peers.get(p.id) || {}) }])); this.ui(); },
  async withTmpDoc(json, fn) { const add0 = MP.addDoc, cur = MP.doc, att = MP.collab.attach; let tmp = null; MP.addDoc = (x) => { tmp = x; MP.doc = x; }; MP.collab.attach = async () => {}; try { await MP.io.openProject({ name: 'tmp.mpp', path: null, data: new TextEncoder().encode(typeof json === 'string' ? json : JSON.stringify(json)) }); } finally { MP.addDoc = add0; MP.collab.attach = att; MP.doc = cur; } return fn(tmp); },
  async loadFull(m) {
    if (!this.isHost && (!this.doc || !MP.docs.includes(this.doc))) {
      await MP.io.openProject({ name: 'Session en direct — ' + (m.name || 'hôte') + '.mpp', path: null, data: new TextEncoder().encode(m.json) }); this.doc = MP.doc; this.doc.dirty = false; this.snapshot(this.doc); MP.toast('Document reçu : vous modifiez en direct avec ' + (m.name || 'l\'hôte')); this.ui(); return;
    }
    const d = this.doc; this.applying = true;
    try { await this.withTmpDoc(m.json, (tmp) => { d.width = tmp.width; d.height = tmp.height; d.layers = tmp.layers; d.normalize(); d.resizeBuffers && d.resizeBuffers(); d.rev++; }); MP.view.fit(); MP.afterEdit(); } finally { this.applying = false; }
    this.snapshot(d);
  },
  layerOf(uid) { return this.doc && this.doc.layers.find((l) => l.uid === uid); },
  async applyPatch(m) {
    const d = this.doc, l = this.layerOf(m.uid); if (!d || !l) return;
    this.applying = true;
    try {
      Object.assign(l, m.props); if (m.props.text) MP.renderText(l);
      const put = async (target, png, r) => { const im = new Image(); im.src = png; await im.decode(); const x = target.getContext('2d'); x.clearRect(r.x, r.y, r.w, r.h); x.drawImage(im, r.x, r.y); };
      if (m.png && m.rect) { await put(l.canvas, m.png, m.rect); if (l.hp16) { l._pc = null; } }
      if (m.mask === null) l.mask = null; else if (m.mask && m.mrect) { if (!l.mask) l.mask = MP.createCanvas(d.width, d.height); await put(l.mask, m.mask, m.mrect); }
      l._v = (l._v || 0) + 1; if (l.hp16) MP.hp16.sync(l); this.mark(l); MP.render(); clearTimeout(this._rl); this._rl = setTimeout(() => MP.ui.refreshLayers(), 150);
    } finally { this.applying = false; }
  },
  async applyLayer(m) {
    const d = this.doc; if (!d) return;
    const json = { app: 'Multipify Photo', version: 9, width: d.width, height: d.height, active: 0, guides: [], layers: [{ ...m.layer, id: 1, parent: null }] };
    await this.withTmpDoc(json, (tmp) => {
      const nl = tmp.layers[0]; if (!nl) return; nl.uid = m.uid; const old = this.layerOf(m.uid), pg = m.parentUid ? this.layerOf(m.parentUid) : null; nl.parent = pg ? pg.id : null;
      this.applying = true;
      try { if (old) { nl.id = old.id; d.layers[d.layers.indexOf(old)] = nl; d.layers.forEach((x) => { if (x.parent === old.id) x.parent = nl.id; }); } else { const after = m.afterUid ? this.layerOf(m.afterUid) : null; d.layers.splice(after ? d.layers.indexOf(after) + 1 : 0, 0, nl); } d.normalize(); MP.render(); MP.ui.refreshLayers(); } finally { this.applying = false; }
      this.mark(nl);
    });
  },
  applyOrder(m) {
    const d = this.doc; if (!d) return; this.applying = true;
    try {
      if (m.removed) for (const u of m.removed) { const l = this.layerOf(u); if (l) { d.layers.splice(d.layers.indexOf(l), 1); this.sent.delete(u); } }
      if (m.order) { const by = new Map(d.layers.map((l) => [l.uid, l])), list = []; for (const o of m.order) { const l = by.get(o.uid); if (!l) continue; const p = o.parentUid ? by.get(o.parentUid) : null; l.parent = p ? p.id : null; list.push(l); by.delete(o.uid); } d.layers = [...list, ...by.values()]; d.normalize(); }
      this.lastOrder = this.orderSig(d); MP.render(); MP.ui.refreshLayers();
    } finally { this.applying = false; }
  },
  // ---------- envoi ----------
  props(l) { return { name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked, fill: l.fill, clip: l.clip, lockAlpha: l.lockAlpha, label: l.label, maskEnabled: l.maskEnabled, fx: l.fx, blendIf: l.blendIf || null, collapsed: l.collapsed }; },
  kind(l) { return l.isGroup || l.adjust || l.text || l.smart ? 'full' : 'px'; },
  sig(l) { return JSON.stringify([this.props(l), l.text && { ...l.text, _b: 0 }, l.adjust, l.smart && [l.smart.m, l.smart.filters, l.smart.dev], !!l.mask]); },
  pix(c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; },
  mark(l) { if (!l.uid) return; this.sent.set(l.uid, { sig: this.sig(l), v: l._v, kind: this.kind(l), px: this.kind(l) === 'px' ? this.pix(l.canvas) : null, mk: l.mask ? this.pix(l.mask) : null, w: l.canvas.width, h: l.canvas.height }); },
  orderSig(d) { const by = new Map(d.layers.map((l) => [l.id, l.uid])); return JSON.stringify(d.layers.map((l) => [l.uid, l.parent ? by.get(l.parent) : null])); },
  snapshot(d) { if (!d) return; for (const l of d.layers) { if (!l.uid) l.uid = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); this.mark(l); } this.lastOrder = this.orderSig(d); this.lastSize = d.width + 'x' + d.height; },
  diffRect(a, b, W, H) { let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) { const r = y * W * 4; for (let x = 0; x < W; x++) { const i = r + x * 4; if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } } return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; },
  crop(c, r) { const t = MP.createCanvas(r.w, r.h); t.getContext('2d').drawImage(c, -r.x, -r.y); return t.toDataURL('image/png'); },
  layerJSON(d, l) { const fake = { width: d.width, height: d.height, active: 0, guides: [], notes: [], counts: [], layers: [l] }; return JSON.parse(MP.io.serialize(fake)).layers[0]; },
  flushSoon() { if (this.applying || !this.on || MP.doc !== this.doc) return; clearTimeout(this._ft); this._ft = setTimeout(() => this.flush(), 40); },
  flush() {
    const d = this.doc; if (!d || !this.on || this.applying) return;
    if (this.lastSize !== d.width + 'x' + d.height) { this.send({ t: 'full', json: MP.io.serialize(d) }); this.snapshot(d); return; }
    const by = new Map(d.layers.map((l) => [l.id, l])), puid = (l) => (l.parent && by.get(l.parent) ? by.get(l.parent).uid : null);
    for (const l of d.layers) if (!l.uid) l.uid = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const now = new Set(d.layers.map((l) => l.uid)), removed = [...this.sent.keys()].filter((u) => !now.has(u));
    d.layers.forEach((l, i) => {
      const s = this.sent.get(l.uid), k = this.kind(l), sig = this.sig(l);
      if (!s || s.kind !== k || (k === 'full' && (s.sig !== sig || s.v !== l._v))) { this.send({ t: 'layer', uid: l.uid, parentUid: puid(l), afterUid: i > 0 ? d.layers[i - 1].uid : null, layer: this.layerJSON(d, l) }); this.mark(l); return; }
      if (k !== 'px') return;
      if (s.v === l._v && s.sig === sig && (!!s.mk === !!l.mask)) return;
      const px = this.pix(l.canvas), r = this.diffRect(s.px, px, l.canvas.width, l.canvas.height), m = { t: 'patch', uid: l.uid, props: this.props(l) };
      if (r) { m.rect = r; m.png = this.crop(l.canvas, r); }
      if (l.mask) { const mk = this.pix(l.mask), mr = s.mk ? this.diffRect(s.mk, mk, l.mask.width, l.mask.height) : { x: 0, y: 0, w: l.mask.width, h: l.mask.height }; if (mr) { m.mrect = mr; m.mask = this.crop(l.mask, mr); } } else if (s.mk) m.mask = null;
      if (r || m.mask !== undefined || s.sig !== sig) this.send(m);
      this.sent.set(l.uid, { sig, v: l._v, kind: k, px, mk: l.mask ? this.pix(l.mask) : null, w: l.canvas.width, h: l.canvas.height });
    });
    const os = this.orderSig(d);
    if (removed.length || os !== this.lastOrder) { this.send({ t: 'order', removed, order: d.layers.map((l) => ({ uid: l.uid, parentUid: puid(l) })) }); removed.forEach((u) => this.sent.delete(u)); this.lastOrder = os; }
  },
};

/* =================== Branchements =================== */
{
  const ae = MP.afterEdit; MP.afterEdit = () => { ae(); MP.rt.flushSoon(); };
  const rd = MP.render; MP.render = () => { rd(); if (MP.rt.on && MP.rt.doc === MP.doc && !MP.rt.applying) { clearTimeout(MP.rt._rt); MP.rt._rt = setTimeout(() => MP.rt.flush(), 250); } };
  const ch = MP.comments.changed.bind(MP.comments); MP.comments.changed = (d) => { ch(d); if (MP.rt.on && d === MP.rt.doc) MP.rt.send({ t: 'comments', comments: MP.comments.list(d) }); };
  // curseurs des participants
  let lastC = 0;
  window.addEventListener('pointermove', (e) => { if (!MP.rt.on || MP.doc !== MP.rt.doc || e.target.id !== 'view') return; const t = performance.now(); if (t - lastC < 45) return; lastC = t; const p = MP.view.toDoc(e.clientX, e.clientY); MP.rt.send({ t: 'cursor', x: Math.round(p.x), y: Math.round(p.y), uid: MP.doc.layer && MP.doc.layer.uid, tool: MP.tool && MP.tool.name }); }, true);
  const ds = MP.drawSamplers;
  MP.drawSamplers = (ctx, d) => {
    ds && ds(ctx, d); if (!MP.rt.on || d !== MP.rt.doc) return; ctx.save(); ctx.font = 'bold 11px "Segoe UI", sans-serif';
    for (const p of MP.rt.peers.values()) { if (!p.cursor) continue; const s = MP.docToScreen(p.cursor); ctx.fillStyle = p.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 3, s.y + 15); ctx.lineTo(s.x + 7, s.y + 10); ctx.lineTo(s.x + 14, s.y + 10); ctx.closePath(); ctx.fill(); ctx.stroke(); const label = p.name + (p.tool ? ' · ' + p.tool : ''), w = ctx.measureText(label).width + 10; ctx.fillRect(s.x + 12, s.y + 14, w, 17); ctx.fillStyle = '#000'; ctx.fillText(label, s.x + 17, s.y + 26); }
    ctx.restore();
  };
  // badges : qui travaille sur quel calque
  const rl = UI.refreshLayers;
  UI.refreshLayers = () => { rl(); const d = MP.doc; if (!d || !MP.rt.on || d !== MP.rt.doc) return; document.querySelectorAll('#layerlist .layer[data-id]').forEach((r) => { const l = d.byId(+r.dataset.id); if (!l) return; for (const p of MP.rt.peers.values()) if (p.uid === l.uid) { const b = el('span', { class: 'coed', title: p.name + ' travaille sur ce calque' }, '● ' + esc(p.name.split(' ')[0])); b.style.background = p.color; b.style.color = '#000'; const nm = r.querySelector('.lname'); nm && nm.after(b); } }); };
  const rc = UI.refreshComments;
  UI.refreshComments = () => { rc(); const box = document.querySelector('#panel-comments .body'); if (!box || !MP.rt.on) return; const line = el('div', { class: 'coed-list' }, `🔴 <b>Session en direct</b> (${MP.rt.isHost ? 'vous êtes l\'hôte' : 'invité'}) : ` + [`<span style="color:${MP.rt.color()}">● ${esc(MP.comments.author())} (vous)</span>`, ...[...MP.rt.peers.values()].map((p) => `<span style="color:${p.color}">● ${esc(p.name)}</span>`)].join(', ')); box.insertBefore(line, box.firstChild); };
  const cd = UI.closeDoc; UI.closeDoc = async (d) => { const r = await cd(d); if (d === MP.rt.doc && !MP.docs.includes(d)) MP.rt.leave(); return r; };
  const bm = UI.menus;
  UI.menus = () => { const m = bm(), fi = (m.find((x) => x.label === 'Fichier') || { items: [] }).items, pa = fi.find((x) => x && x !== '-' && x.label === 'Partager'); if (pa) { const s0 = pa.sub; pa.sub = () => [{ label: MP.rt.on ? '🔴 Session en direct en cours' : 'Démarrer une session en direct (réseau local)…', disabled: MP.rt.on, act: need(() => MP.rt.host()) }, { label: 'Rejoindre une session en direct…', act: () => MP.rt.join() }, ...(MP.rt.on ? [{ label: 'Quitter la session en direct', act: () => MP.rt.leave() }] : []), '-', ...s0()]; } return m; };
}
