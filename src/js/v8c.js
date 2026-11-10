'use strict';
/* v8 (3/3) — coédition : identifiants de calques stables, fusion à trois voies des modifications de plusieurs
   personnes sur le même fichier (calque par calque, conflits conservés), synchronisation automatique,
   présence (qui est là, quel calque chacun modifie), protection contre l'écrasement */

const uid8 = () => 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; };
{
  // identifiants stables (uid) dans les .mpp
  const ser = MP.io.serialize.bind(MP.io), op = MP.io.openProject.bind(MP.io);
  MP.io.serialize = (d) => {
    const seen = new Set(); for (const l of d.layers) { if (!l.uid || seen.has(l.uid)) l.uid = uid8(); seen.add(l.uid); }
    const j = JSON.parse(ser(d)); j.layers.forEach((s, i) => { s.uid = d.layers[i].uid; s.editedBy = d.layers[i].editedBy || null; }); const out = JSON.stringify(j); d._lastSer = out; return out;
  };
  MP.io.openProject = async (f) => {
    const before = MP.doc; await op(f); const d = MP.doc; if (d === before) return;
    try { const j = JSON.parse(new TextDecoder().decode(f.data)); j.layers.forEach((s, i) => { if (d.layers[i]) { d.layers[i].uid = s.uid || uid8(); d.layers[i].editedBy = s.editedBy || null; } }); d._base = MP.coedit.hashes(j); } catch (e) { console.warn(e); }
  };
}
MP.coedit = {
  /** empreinte de chaque calque (contenu + propriétés), indexée par uid */
  hashes(j) { const byId = new Map(j.layers.map((s) => [s.id, s.uid])), h = {}; for (const s of j.layers) { const { id, parent, ...rest } = s; void id; h[s.uid] = fnv(JSON.stringify({ ...rest, parent: parent ? byId.get(parent) || null : null, editedBy: undefined })); } return h; },
  /** fusion à trois voies : base (dernière version commune), nous (document ouvert), eux (fichier sur disque) */
  merge(d, theirJ) {
    const ourJ = JSON.parse(MP.io.serialize(d)), base = d._base || {}, H1 = this.hashes(ourJ), H2 = this.hashes(theirJ);
    const ours = new Map(ourJ.layers.map((s) => [s.uid, s])), theirs = new Map(theirJ.layers.map((s) => [s.uid, s]));
    const idUid = (J) => new Map(J.layers.map((s) => [s.id, s.uid])), ou = idUid(ourJ), tu = idUid(theirJ);
    const report = { theirs: 0, ours: 0, conflicts: 0, added: 0, removed: 0 }, pick = new Map();
    const all = new Set([...ours.keys(), ...theirs.keys(), ...Object.keys(base)]);
    for (const u of all) {
      const inB = u in base, o = ours.get(u), t = theirs.get(u), oC = o && (!inB || H1[u] !== base[u]), tC = t && (!inB || H2[u] !== base[u]);
      if (o && t) { if (H1[u] === H2[u] || !tC) pick.set(u, { s: o, from: ou }); else if (!oC) { pick.set(u, { s: t, from: tu }); report.theirs++; } else { pick.set(u, { s: o, from: ou }); pick.set(u + '~', { s: { ...t, name: t.name + ' (version de ' + (t.editedBy || 'un collègue') + ')', visible: false, label: '#e53935' }, from: tu, conflictOf: u }); report.conflicts++; } }
      else if (o && !t) { if (inB && !oC) report.removed++; else pick.set(u, { s: o, from: ou }); }
      else if (!o && t) { if (inB && !tC) { /* supprimé chez nous */ } else { pick.set(u, { s: t, from: tu }); report.added++; } }
    }
    // ordre : le nôtre, avec les nouveautés « eux » insérées après leur voisin d'origine
    const order = ourJ.layers.map((s) => s.uid).filter((u) => pick.has(u));
    theirJ.layers.forEach((s, i) => { if (order.includes(s.uid) || !pick.has(s.uid)) return; let k = i - 1, at = -1; while (k >= 0 && (at = order.indexOf(theirJ.layers[k].uid)) < 0) k--; order.splice(at + 1, 0, s.uid); });
    for (const k of pick.keys()) if (k.endsWith('~')) { const at = order.indexOf(k.slice(0, -1)); order.splice(at + 1, 0, k); }
    let nid = 1; const newId = new Map(order.map((u) => [u, nid++]));
    const layers = order.map((u) => { const p = pick.get(u), s = { ...p.s }, pu = s.parent ? p.from.get(s.parent) : null; s.id = newId.get(u); s.uid = p.conflictOf ? uid8() : u; s.parent = pu && newId.has(pu) ? newId.get(pu) : null; return s; });
    return { json: { ...ourJ, layers, comments: MP.comments.list(d) }, report };
  },
  /** applique la fusion au document ouvert (annulable) */
  async apply(d, theirBytes, who) {
    const theirJ = JSON.parse(new TextDecoder().decode(theirBytes));
    if (theirJ.width !== d.width || theirJ.height !== d.height) { MP.toast('La taille de la zone de travail a changé chez votre collègue : sa version est ouverte dans un nouvel onglet', 6000); return MP.io.openProject({ name: d.name.replace(/\.mpp$/i, '') + ' (version partagée).mpp', path: null, data: theirBytes }); }
    const { json, report } = this.merge(d, theirJ);
    const add0 = MP.addDoc, coll = MP.collab.attach; let tmp = null; MP.addDoc = (x) => { tmp = x; MP.doc = x; }; MP.collab.attach = async () => {};
    try { await MP.io.openProject({ name: d.name, path: null, data: new TextEncoder().encode(JSON.stringify(json)) }); } finally { MP.addDoc = add0; MP.collab.attach = coll; MP.doc = d; }
    if (!tmp) return; const act = d.layer && d.layer.uid;
    d.history.record('Fusion des modifications de ' + (who || 'un collègue'), 'all');
    d.layers = tmp.layers; d.comps = tmp.comps; d.frames = tmp.frames; tmp.layers.forEach((l, i) => { l.uid = json.layers[i].uid; l.editedBy = json.layers[i].editedBy || null; });
    d.normalize(); d.active = Math.max(0, d.layers.findIndex((l) => l.uid === act)); d._base = this.hashes(theirJ); d.resizeBuffers && d.resizeBuffers(); MP.afterEdit(); MP.ui.refreshAll();
    MP.comments.merge(d, theirJ.comments || []);
    const parts = []; if (report.theirs) parts.push(report.theirs + ' calque(s) mis à jour'); if (report.added) parts.push(report.added + ' ajouté(s)'); if (report.removed) parts.push(report.removed + ' supprimé(s)'); if (report.conflicts) parts.push(report.conflicts + ' conflit(s) conservé(s) en calque masqué rouge');
    MP.toast(`🔀 Modifications de ${who || 'votre collègue'} fusionnées : ${parts.join(', ') || 'aucun changement de calque'}`, 7000);
    return report;
  },
};

/* =================== Présence : qui est là, quel calque chacun modifie =================== */
MP.presence = {
  others: new Map(), edits: new Map(),
  file(d) { return d.filePath + '.presence.' + MP._sessionId + '.json'; },
  touch(l) { if (l && l.uid) { this.edits.set(l.uid, Date.now()); l.editedBy = MP.comments.author(); } clearTimeout(this._t); this._t = setTimeout(() => this.write(), 2500); },
  async write() { for (const [d] of MP.collab.docs) { const now = Date.now(), editing = [...this.edits].filter(([, t]) => now - t < 90e3).map(([u]) => u).filter((u) => d.layers.some((l) => l.uid === u)); try { await MP.native.writeFile(this.file(d), new TextEncoder().encode(JSON.stringify({ id: MP._sessionId, user: MP.comments.author(), host: MP._host || '', time: now, editing, active: d.layer && d.layer.uid }))); } catch (_) { /* */ } } },
  async scan() {
    if (!MP.native.listFiles) return; let changed = false;
    for (const [d] of MP.collab.docs) {
      const dir = d.filePath.split(/[\\/]/).slice(0, -1).join(d.filePath.includes('\\') ? '\\' : '/'), base = d.filePath.split(/[\\/]/).pop(), files = await MP.native.listFiles(dir, base + '.presence.'), now = Date.now(), seen = new Set();
      for (const p of files) { if (p.includes(MP._sessionId)) continue; const f = await MP.native.readFile(p); if (!f) continue; try { const j = JSON.parse(new TextDecoder().decode(f.data)); if (now - j.time > 120e3) { if (now - j.time > 3600e3) MP.native.deleteFile(p); continue; } seen.add(j.id); const prev = this.others.get(j.id); if (!prev || prev.time !== j.time) changed = true; this.others.set(j.id, { ...j, doc: d }); } catch (_) { /* */ } }
      for (const [id, o] of this.others) if (o.doc === d && !seen.has(id)) { this.others.delete(id); changed = true; }
    }
    if (changed) { MP.ui.refreshLayers(); UI.refreshComments(); }
  },
  editorsOf(d, uid) { return [...this.others.values()].filter((o) => o.doc === d && (o.editing || []).includes(uid)).map((o) => o.user); },
  start() { setInterval(() => this.scan(), 5000); setInterval(() => this.write(), 30e3); },
};

/* =================== Synchronisation automatique et protection contre l'écrasement =================== */
{
  const ae = MP.afterEdit; MP.afterEdit = () => { ae(); const d = MP.doc; if (d && MP.collab.docs.has(d)) MP.presence.touch(d.layer); };
  // enregistrement : fusion préalable si le fichier a changé depuis notre dernière version commune
  const sv = MP.io.save;
  MP.io.save = async (as) => {
    const d = MP.doc, s = d && MP.collab.docs.get(d);
    if (s && !as && d.filePath && MP.native.stat) { const st = await MP.native.stat(d.filePath); if (st && st.mtime > s.mtime + 1500) { const f = await MP.native.readFile(d.filePath); if (f) { await MP.coedit.apply(d, f.data, 'un collègue'); } } }
    const ok = await sv(as); if (ok && d && d._lastSer) { try { d._base = MP.coedit.hashes(JSON.parse(d._lastSer)); } catch (_) { /* */ } } return ok;
  };
  // fichier modifié par quelqu'un d'autre : fusion (automatique si la synchro est active)
  const ch = MP.collab.changed.bind(MP.collab);
  MP.collab.changed = async (p, mtime) => {
    for (const [d, s] of MP.collab.docs) {
      if (p !== s.path) continue;
      if (Math.abs(mtime - s.mtime) < 1500 || (s.selfSave && Date.now() - s.selfSave < 4000)) return;
      s.mtime = mtime; const who = [...MP.presence.others.values()].filter((o) => o.doc === d).map((o) => o.user).join(', ') || 'un collègue';
      const f = await MP.native.readFile(p); if (!f) return;
      if (MP.prefs.autoSync !== false) { await MP.coedit.apply(d, f.data, who); if (d.dirty) MP.collab.syncSoon(d); return; }
      MP.ui.dialog({ title: 'Nouvelle version enregistrée par ' + who, width: 460, okLabel: 'Fusionner leurs modifications', fields: [{ type: 'info', html: `<p>« ${esc(d.name)} » a été modifié depuis un autre ordinateur.</p><p class="muted">La fusion intègre leurs calques modifiés, ajoutés ou supprimés sans toucher aux vôtres ; en cas de modification du même calque des deux côtés, leur version est ajoutée en calque masqué rouge. Annulable avec Ctrl+Z.</p>` }, { type: 'button', label: 'Ouvrir leur version dans un onglet', action: () => { UI.dialogOpen && UI.dialogOpen.close && UI.dialogOpen.close(); MP.io.openProject({ ...f, name: d.name.replace(/\.mpp$/i, '') + ' (version partagée).mpp', path: null }); } }], values: {}, onOk: () => MP.coedit.apply(d, f.data, who) });
      return;
    }
    return ch(p, mtime);
  };
  MP.collab.syncSoon = (d) => { clearTimeout(d._syncT); d._syncT = setTimeout(async () => { if (!MP.collab.docs.has(d) || !d.dirty || MP.prefs.autoSync === false) return; const keep = MP.doc; if (keep !== d) MP.doc = d; try { await MP.io.save(false); } finally { if (keep !== d) MP.doc = keep; MP.ui.refreshTabs(); } }, (MP.prefs.syncDelay || 20) * 1000); };
  const md = MP.Doc.prototype.markDirty;
  MP.Doc.prototype.markDirty = function () { md.call(this); if (MP.collab.docs.has(this) && MP.prefs.autoSync !== false && [...MP.presence.others.values()].some((o) => o.doc === this)) MP.collab.syncSoon(this); };
  const det = MP.collab.detach.bind(MP.collab); MP.collab.detach = async (d, k) => { if (MP.collab.docs.has(d) && d.filePath && MP.native.deleteFile) MP.native.deleteFile(MP.presence.file(d)); return det(d, k); };
  const att = MP.collab.attach.bind(MP.collab); MP.collab.attach = async (d) => { await att(d); if (MP.collab.docs.has(d)) { if (!d._base && d._lastSer) d._base = MP.coedit.hashes(JSON.parse(d._lastSer)); MP.presence.write(); MP.presence.scan(); } };
}

/* =================== Interface : badges de calques, panneau, menus =================== */
{
  const rl = UI.refreshLayers;
  UI.refreshLayers = () => {
    rl(); const d = MP.doc; if (!d || !MP.collab.docs.has(d)) return;
    document.querySelectorAll('#layerlist .layer[data-id]').forEach((r) => { const l = d.byId(+r.dataset.id); if (!l || !l.uid) return; const who = MP.presence.editorsOf(d, l.uid); if (who.length) { const b = el('span', { class: 'coed', title: 'En cours de modification par ' + who.join(', ') }, '👤 ' + esc(who[0].split(' ')[0])); r.querySelector('.lname') && r.querySelector('.lname').after(b); } });
  };
  const rc = UI.refreshComments;
  UI.refreshComments = () => {
    rc(); const box = document.querySelector('#panel-comments .body'), d = MP.doc; if (!box || !d || !MP.collab.docs.has(d)) return;
    const others = [...MP.presence.others.values()].filter((o) => o.doc === d), st = box.querySelector('.collab-st'); if (!st) return;
    const line = el('div', { class: 'coed-list' }, (others.length ? '👥 En ligne : ' + others.map((o) => `<b>${esc(o.user)}</b>${o.editing && o.editing.length ? ' (modifie ' + o.editing.map((u) => esc((d.layers.find((l) => l.uid === u) || {}).name || '?')).slice(0, 2).join(', ') + ')' : ''}`).join(', ') : 'Personne d\'autre en ce moment') + `<br>${MP.prefs.autoSync !== false ? '🔄 Synchronisation automatique active' : '⏸ Synchronisation manuelle'}`);
    st.after(line);
  };
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), fi = (m.find((x) => x.label === 'Fichier') || { items: [] }).items, pa = fi.find((x) => x && x !== '-' && x.label === 'Partager');
    if (pa) { const s0 = pa.sub; pa.sub = () => [...s0(), '-', { label: (MP.prefs.autoSync !== false ? '✓ ' : '') + 'Synchronisation automatique (coédition)', act: () => { MP.prefs.autoSync = MP.prefs.autoSync === false; MP.savePrefs(); UI.refreshComments(); MP.toast(MP.prefs.autoSync !== false ? 'Coédition : vos modifications et celles des autres sont fusionnées automatiquement' : 'Synchronisation manuelle : une fenêtre vous proposera la fusion'); } }, { label: 'Fusionner maintenant avec la version partagée', act: need(async () => { const d = MP.doc; if (!d.filePath || !MP.collab.docs.has(d)) { MP.toast('Document non partagé'); return; } const f = await MP.native.readFile(d.filePath); if (f) MP.coedit.apply(d, f.data, 'la version partagée'); }) }, { label: 'Délai de synchronisation…', act: () => MP.ui.dialog({ title: 'Synchronisation automatique', width: 380, fields: [{ k: 's', label: 'Enregistrer mes modifications après (secondes)', type: 'range', min: 5, max: 120 }], values: { s: MP.prefs.syncDelay || 20 }, onOk: (v) => { MP.prefs.syncDelay = v.s; MP.savePrefs(); } }) }]; }
    // RAW : profils d'appareil
    const ed = (m.find((x) => x.label === 'Édition') || { items: [] }).items, cp = ed.find((x) => x && x !== '-' && x.label === 'Couleurs et profils');
    if (cp) { const s0 = cp.sub; cp.sub = () => [...s0(), '-', { label: 'Profils d\'appareil photo (RAW)…', act: () => UI.dialogs.camProfiles() }, { label: 'Calibrer l\'appareil avec une charte ColorChecker…', act: () => MP.calibrate.open() }]; }
    return m;
  };
  UI.dialogs.camProfiles = async () => {
    const list = Object.values(MP.camProfiles.map), d = MP.doc, raw = d && d.layers.find((l) => l.smart && l.smart.raw), model = raw ? raw.smart.raw.model : '';
    MP.ui.dialog({ title: 'Profils d\'appareil photo', width: 520, noCancel: true,
      fields: [{ type: 'info', html: list.length ? '<table class="exif">' + list.map((p) => `<tr><td><b>${esc(p.model)}</b></td><td>${esc(p.name)} <span class="muted">(${p.source === 'charte' ? 'calibré' : 'Adobe DCP'})</span></td></tr>`).join('') + '</table>' : '<p class="muted">Aucun profil. Les RAW non DNG utilisent une matrice générique par marque.</p>' },
        { type: 'info', html: '<p class="muted">• <b>Profil Adobe (.dcp)</b> : recherché automatiquement dans les dossiers d\'Adobe Camera Raw / DNG Converter (gratuit) ; vous pouvez aussi en choisir un.<br>• <b>Calibration</b> : photographiez une charte ColorChecker en RAW, ouvrez-la puis lancez la calibration.</p>' },
        { type: 'button', label: 'Importer un profil .dcp' + (model ? ' pour ' + model : '') + '…', action: async () => { const f = (await MP.native.openFiles({ multi: false, accept: '.dcp', filters: [{ name: 'Profils DNG', extensions: ['dcp'] }] }))[0]; if (f) { try { await MP.camProfiles.importDcp(f, model || null); } catch (e) { MP.toast('Profil illisible : ' + e.message); } } } },
        { type: 'button', label: 'Calibrer avec une charte…', action: () => { UI.dialogOpen && UI.dialogOpen.close && UI.dialogOpen.close(); MP.calibrate.open(); } },
        ...(model && MP.camProfiles.get(model) ? [{ type: 'button', label: 'Supprimer le profil de ' + model, action: () => MP.camProfiles.remove(model) }] : [])], values: {} });
  };
}
MP.v8init = async () => { await MP.camProfiles.load(); MP.presence.start(); UI.buildMenus(); };
