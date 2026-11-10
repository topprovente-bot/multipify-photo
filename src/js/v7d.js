'use strict';
/* v7 (4/4) — collaboration (commentaires partagés, documents dans le cloud, verrou d'édition, synchronisation),
   fenêtres flottantes (panneaux et documents), menus et boîtes de dialogue de la gestion des couleurs, 16/32 bits,
   RAW, panorama et alignement perspectifs */

const dlg7 = (cfg) => MP.ui.dialog(cfg);
const L7 = (x) => (x && x !== '-' ? (typeof x.label === 'function' ? x.label() : x.label) : '');
const vis7 = (id) => { const s = document.getElementById(id); return s && !s.classList.contains('collapsed') && !s.closest('.pgroup.min') || (s && s.closest('.floatwin')); };
const sep7 = (p) => (p.includes('\\') ? '\\' : '/');

/* =================== Commentaires =================== */
MP.comments = {
  list(d = MP.doc) { return (d.comments = d.comments || []); },
  author() { return MP.prefs.userName || MP._sysUser || 'Moi'; },
  add(x, y, text) { const d = MP.doc; const c = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), x: Math.round(x), y: Math.round(y), author: this.author(), text, time: Date.now(), resolved: false, replies: [] }; this.list(d).push(c); this.changed(d); UI.showPanel('panel-comments'); return c; },
  reply(c, text) { c.replies.push({ id: 'r' + Date.now().toString(36), author: this.author(), text, time: Date.now() }); c.time = Date.now(); this.changed(MP.doc); },
  resolve(c) { c.resolved = !c.resolved; c.time = Date.now(); this.changed(MP.doc); },
  remove(c) { const d = MP.doc; c.deleted = true; c.time = Date.now(); this.changed(d); },
  changed(d) { d.markDirty(); MP.renderView(); UI.refreshComments(); MP.collab.pushComments(d); },
  merge(d, incoming) {
    const L = this.list(d), byId = new Map(L.map((c) => [c.id, c])); let news = 0;
    for (const c of incoming || []) { const o = byId.get(c.id); if (!o) { L.push(c); news++; continue; } if (c.time > o.time) { const reps = new Map([...o.replies, ...c.replies].map((r) => [r.id, r])); Object.assign(o, c, { replies: [...reps.values()].sort((a, b) => a.time - b.time) }); news++; } }
    return news;
  },
  ask(x, y) { dlg7({ title: 'Nouveau commentaire', width: 420, okLabel: 'Publier', fields: [{ k: 't', label: 'Commentaire (' + this.author() + ')', type: 'textarea', rows: 4 }], values: { t: '' }, onOk: (v) => { if (!v.t.trim()) return false; this.add(x, y, v.t.trim()); } }); },
};
defTool({
  id: 'comment', name: 'Commentaire', icon: 'note', cursor: 'crosshair', defaults: {},
  hint: 'Cliquez sur l\'image pour ajouter un commentaire (partagé avec les personnes qui ouvrent le même fichier dans un dossier partagé)',
  options: [{ k: 'p', label: 'Panneau Commentaires', type: 'button', action: () => UI.showPanel('panel-comments') }, { k: 'n', label: 'Votre nom…', type: 'button', action: () => UI.dialogs.userName() }],
  down(p) { const d = MP.doc, hit = MP.comments.list(d).find((c) => !c.deleted && Math.hypot(c.x - p.x, c.y - p.y) * d.zoom < 14); if (hit) { UI.showPanel('panel-comments'); UI._focusComment = hit.id; UI.refreshComments(); return; } MP.comments.ask(p.x, p.y); },
});
{
  const islot = UI.SLOTS.find((s) => s.key === 'I'); if (islot) islot.tools.push('comment');
  const i0 = UI._slots0 && UI._slots0.find((s) => s.key === 'I'); if (i0) i0.tools.push('comment');
  const ds0 = MP.drawSamplers;
  MP.drawSamplers = (ctx, d) => {
    ds0 && ds0(ctx, d); if (MP.prefs.showComments === false) return;
    const L = (d.comments || []).filter((c) => !c.deleted && !c.resolved); if (!L.length) return;
    ctx.save(); ctx.font = 'bold 11px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    L.forEach((c, i) => { const p = MP.docToScreen(c); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x + 9, p.y - 9, 10, Math.PI * 0.6, Math.PI * 2.4); ctx.closePath(); ctx.fillStyle = UI._focusComment === c.id ? '#ffb300' : '#4f7cff'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(String(i + 1), p.x + 9, p.y - 9); });
    ctx.restore();
  };
}
UI.refreshComments = () => {
  if (!vis7('panel-comments')) return; const box = $('#panel-comments .body'), d = MP.doc; box.innerHTML = ''; if (!d) { box.innerHTML = '<p class="muted">Aucun document.</p>'; return; }
  const st = MP.collab.state(d); box.appendChild(el('div', { class: 'collab-st ' + (st.on ? 'on' : '') }, st.on ? `🔗 Partagé : ${esc(st.folder)}${st.lockedBy ? `<br>⚠ Ouvert aussi par <b>${esc(st.lockedBy)}</b>` : ''}` : '💾 Document local — Fichier > Partager pour travailler à plusieurs'));
  const showRes = !!UI._showResolved, all = MP.comments.list(d).filter((c) => !c.deleted), L = all.filter((c) => showRes || !c.resolved);
  const top = el('div', { class: 'prow' }); const add = el('button', { class: 'btn small' }, '+ Commentaire'); add.onclick = () => MP.setTool('comment'); const tg = el('button', { class: 'btn small' }, showRes ? 'Masquer les résolus' : `Afficher les résolus (${all.length - all.filter((c) => !c.resolved).length})`); tg.onclick = () => { UI._showResolved = !showRes; UI.refreshComments(); }; top.append(add, tg); box.appendChild(top);
  if (!L.length) box.appendChild(el('p', { class: 'muted' }, 'Aucun commentaire. Outil Commentaire (I) : cliquez sur l\'image pour en ajouter un.'));
  const open = all.filter((c) => !c.resolved);
  L.forEach((c) => {
    const n = open.indexOf(c) + 1, card = el('div', { class: 'cmt' + (c.resolved ? ' res' : '') + (UI._focusComment === c.id ? ' focus' : '') });
    const when = (t) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    card.innerHTML = `<div class="cmt-h"><b>${n ? n + '. ' : '✓ '}${esc(c.author)}</b><span>${when(c.replies.length ? c.replies[c.replies.length - 1].time : c.time)}</span></div><div class="cmt-t">${esc(c.text)}</div>` + c.replies.map((r) => `<div class="cmt-r"><b>${esc(r.author)}</b> ${esc(r.text)}</div>`).join('');
    const row = el('div', { class: 'prow' }), B = (t, f) => { const b = el('button', { class: 'btn small' }, t); b.onclick = (e) => { e.stopPropagation(); f(); }; row.appendChild(b); };
    B('Répondre', () => dlg7({ title: 'Répondre à ' + c.author, width: 400, okLabel: 'Répondre', fields: [{ k: 't', label: 'Réponse', type: 'textarea', rows: 3 }], values: { t: '' }, onOk: (v) => { if (v.t.trim()) MP.comments.reply(c, v.t.trim()); } }));
    B(c.resolved ? 'Rouvrir' : 'Résoudre', () => MP.comments.resolve(c)); B('Supprimer', () => MP.comments.remove(c));
    card.appendChild(row); card.onclick = () => { UI._focusComment = c.id; const v = MP.view; d.panX = v.w / 2 - c.x * d.zoom; d.panY = v.h / 2 - c.y * d.zoom; MP.renderView(); UI.refreshComments(); };
    box.appendChild(card);
  });
};
UI.dialogs.userName = () => dlg7({ title: 'Votre nom (affiché dans les commentaires)', width: 380, fields: [{ k: 'n', label: 'Nom', type: 'text' }], values: { n: MP.comments.author() }, onOk: (v) => { MP.prefs.userName = v.n.trim() || null; MP.savePrefs(); UI.refreshComments(); } });

/* =================== Collaboration par dossier partagé =================== */
MP.collab = {
  docs: new Map(),
  state(d) { const s = this.docs.get(d); return s ? { on: true, folder: d.filePath.split(/[\\/]/).slice(0, -1).join(sep7(d.filePath)), lockedBy: s.lockedBy } : { on: false }; },
  side(d) { return d.filePath + '.comments.json'; }, lockPath(d) { return d.filePath + '.lock'; },
  async attach(d) {
    if (!MP.native.watchPath || !d.filePath || MP.prefs.collab === false) return;
    const prev = this.docs.get(d); if (prev && prev.path === d.filePath) return; if (prev) await this.detach(d, true);
    const s = { path: d.filePath, lockedBy: null, mtime: (await MP.native.stat(d.filePath) || {}).mtime || 0 }; this.docs.set(d, s);
    // verrou d'édition
    const lk = await MP.native.readFile(this.lockPath(d)); if (lk) { try { const j = JSON.parse(new TextDecoder().decode(lk.data)); if (j.id !== MP._sessionId && Date.now() - j.time < 12 * 3600e3) { s.lockedBy = `${j.user} (${j.host})`; MP.toast(`⚠ « ${d.name} » est aussi ouvert par ${j.user} sur ${j.host} — vos modifications pourraient se croiser. Utilisez les commentaires pour vous coordonner.`, 8000); } } catch (_) { /* */ } }
    await this.writeLock(d);
    // commentaires partagés
    const sd = await MP.native.readFile(this.side(d)); if (sd) { try { MP.comments.merge(d, JSON.parse(new TextDecoder().decode(sd.data)).comments); } catch (_) { /* */ } }
    await MP.native.watchPath(this.side(d)); await MP.native.watchPath(d.filePath); await MP.native.watchPath(this.lockPath(d));
    s.lockT = setInterval(() => this.writeLock(d), 5 * 60e3); UI.refreshComments(); MP.renderView();
  },
  async writeLock(d) { const s = this.docs.get(d); if (!s || !d.filePath) return; try { await MP.native.writeFile(this.lockPath(d), new TextEncoder().encode(JSON.stringify({ id: MP._sessionId, user: MP.comments.author(), host: MP._host || '', time: Date.now() }))); } catch (_) { /* */ } },
  async detach(d, keepComments) { const s = this.docs.get(d); if (!s) return; clearInterval(s.lockT); for (const p of [s.path + '.comments.json', s.path, s.path + '.lock']) MP.native.unwatchPath(p); try { const lk = await MP.native.readFile(s.path + '.lock'); if (lk && JSON.parse(new TextDecoder().decode(lk.data)).id === MP._sessionId) await MP.native.deleteFile(s.path + '.lock'); } catch (_) { /* */ } this.docs.delete(d); void keepComments; },
  async pushComments(d) { const s = this.docs.get(d); if (!s) return; s.selfWrite = Date.now(); try { await MP.native.writeFile(this.side(d), new TextEncoder().encode(JSON.stringify({ app: 'Multipify Photo', file: d.name, updated: Date.now(), comments: MP.comments.list(d) }, null, 1))); } catch (e) { MP.toast('Commentaires non synchronisés : ' + e.message); } },
  async changed(p, mtime) {
    for (const [d, s] of this.docs) {
      if (p === this.side(d)) { if (s.selfWrite && Date.now() - s.selfWrite < 2500) continue; const f = await MP.native.readFile(p); if (!f) continue; try { const n = MP.comments.merge(d, JSON.parse(new TextDecoder().decode(f.data)).comments); if (n) { MP.toast(`💬 ${n} nouveau(x) commentaire(s) sur « ${d.name} »`, 5000); UI.refreshComments(); MP.renderView(); } } catch (_) { /* */ } }
      else if (p === s.path) { if (Math.abs(mtime - s.mtime) < 1500 || (s.selfSave && Date.now() - s.selfSave < 4000)) continue; s.mtime = mtime; dlg7({ title: 'Document modifié par un autre utilisateur', width: 440, okLabel: 'Ouvrir la nouvelle version', fields: [{ type: 'info', html: `<p>« ${esc(d.name)} » vient d'être enregistré depuis un autre ordinateur (dossier partagé).</p><p class="muted">Votre version reste ouverte ; la nouvelle s'ouvre dans un autre onglet pour que vous puissiez comparer.</p>` }], values: {}, onOk: async () => { const f = await MP.native.readFile(p); if (f) { await MP.io.openProject({ ...f, name: d.name.replace(/\.mpp$/i, '') + ' (version partagée).mpp', path: null }); } } }); }
      else if (p === this.lockPath(d)) { const f = await MP.native.readFile(p); if (!f) { s.lockedBy = null; } else { try { const j = JSON.parse(new TextDecoder().decode(f.data)); if (j.id !== MP._sessionId) { if (!s.lockedBy) MP.toast(`👥 ${j.user} vient d'ouvrir « ${d.name} »`, 5000); s.lockedBy = `${j.user} (${j.host})`; } } catch (_) { /* */ } } UI.refreshComments(); }
    }
  },
  async saveToCloud() {
    const d = MP.doc, folders = MP.native.cloudFolders ? await MP.native.cloudFolders() : [];
    if (!folders.length) { MP.toast('Aucun dossier cloud détecté (OneDrive, Dropbox, Google Drive, iCloud). Enregistrez le projet dans n\'importe quel dossier partagé ou réseau : le partage fonctionnera de la même façon.', 8000); return MP.io.save(true); }
    dlg7({ title: 'Enregistrer dans le cloud', width: 460, okLabel: 'Enregistrer…', fields: [{ k: 'f', label: 'Dossier synchronisé', type: 'select', options: folders.map((f) => [f.path, `${f.label} — ${f.path}`]) }, { type: 'info', html: '<p class="muted">Le fichier .mpp est synchronisé par votre service cloud. Les personnes avec qui vous partagez ce dossier voient vos commentaires en direct, sont prévenues quand vous l\'ouvrez et quand une nouvelle version est enregistrée.</p>' }], values: { f: folders[0].path },
      onOk: async (v) => { const path = await MP.native.saveFile({ defaultPath: v.f + sep7(v.f) + d.name.replace(/\.[^.]+$/, '') + '.mpp', filters: [{ name: 'Projet Multipify Photo', extensions: ['mpp'] }], data: new TextEncoder().encode(MP.io.serialize(d)) }); if (path) { d.filePath = path; d.name = path.split(/[\\/]/).pop(); d.dirty = false; MP.io.addRecent(path); MP.ui.refreshTabs(); await this.attach(d); MP.toast('Enregistré dans le cloud et partagé : ' + path, 5000); } } });
  },
  share() {
    const d = MP.doc; if (!d.filePath || MP.native.browser) { MP.toast('Enregistrez d\'abord le projet dans un dossier cloud ou partagé (Fichier > Partager > Enregistrer dans le cloud)', 6000); return; }
    const mail = `mailto:?subject=${encodeURIComponent('Projet Multipify Photo : ' + d.name)}&body=${encodeURIComponent(`Bonjour,\n\nJe partage avec toi le projet « ${d.name} ».\nIl se trouve dans notre dossier partagé :\n${d.filePath}\n\nOuvre-le avec Multipify Photo : tu verras mes commentaires et pourras y répondre.\n`)}`;
    dlg7({ title: 'Partager « ' + d.name + ' »', width: 480, noCancel: true, fields: [{ type: 'info', html: `<p>Emplacement partagé :</p><p><code>${esc(d.filePath)}</code></p><p class="muted">Partagez ce dossier depuis OneDrive / Dropbox / Google Drive, puis invitez vos collaborateurs. Multipify Photo synchronise automatiquement les commentaires, signale qui a ouvert le fichier et propose la dernière version enregistrée.</p>` }, { type: 'button', label: 'Copier le chemin', action: () => { navigator.clipboard.writeText(d.filePath); MP.toast('Chemin copié'); } }, { type: 'button', label: 'Ouvrir le dossier', action: () => MP.native.showInFolder(d.filePath) }, { type: 'button', label: 'Inviter par e-mail…', action: () => window.open(mail) }], values: {} });
  },
};
{
  const op = MP.io.openProject; MP.io.openProject = async (f) => { await op(f); if (MP.doc && MP.doc.filePath) MP.collab.attach(MP.doc); };
  const sv = MP.io.save; MP.io.save = async (as) => { const d = MP.doc, s = d && MP.collab.docs.get(d); if (s) s.selfSave = Date.now(); const ok = await sv(as); if (ok && d && d.filePath) { await MP.collab.attach(d); const st = MP.collab.docs.get(d); if (st) { st.selfSave = Date.now(); st.mtime = (await MP.native.stat(d.filePath) || {}).mtime || st.mtime; MP.collab.pushComments(d); } } return ok; };
  const cd = UI.closeDoc; UI.closeDoc = async (d) => { const r = await cd(d); if (!MP.docs.includes(d)) { MP.collab.detach(d); MP.floating.closeFor(d); } return r; };
  window.addEventListener('beforeunload', () => { for (const d of MP.collab.docs.keys()) MP.collab.detach(d); });
}

/* =================== Fenêtres flottantes =================== */
MP.floating = {
  wins: [],
  frame(title, w, h, x, y) {
    const f = el('div', { class: 'floatwin' }); f.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    f.innerHTML = `<div class="fw-h"><span class="fw-t">${esc(title)}</span><span class="fw-b"></span><button class="fw-x" title="Fermer">×</button></div><div class="fw-c"></div>`; document.body.appendChild(f);
    const hd = f.querySelector('.fw-h'); hd.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; const sx = e.clientX - f.offsetLeft, sy = e.clientY - f.offsetTop; hd.setPointerCapture(e.pointerId); const mv = (ev) => { f.style.left = MP.clamp(ev.clientX - sx, 0, innerWidth - 60) + 'px'; f.style.top = MP.clamp(ev.clientY - sy, 0, innerHeight - 30) + 'px'; }; hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', () => hd.removeEventListener('pointermove', mv), { once: true }); });
    f.addEventListener('pointerdown', () => { document.querySelectorAll('.floatwin').forEach((o) => (o.style.zIndex = 60)); f.style.zIndex = 61; });
    return f;
  },
  /** détache un panneau du dock dans une fenêtre flottante */
  panel(id) {
    const s = document.getElementById(id); if (!s || s.closest('.floatwin')) return; const g = s.closest('.pgroup'), tab = g && g.querySelector(`.ptab[data-p="${id}"]`), r = s.getBoundingClientRect();
    const f = this.frame(s.querySelector('h3').textContent, 300, 380, Math.max(60, r.left - 320), Math.max(60, r.top)); f.querySelector('.fw-c').appendChild(s); s.classList.remove('collapsed'); if (tab) tab.style.display = 'none';
    const dock = el('button', { title: 'Ancrer dans le dock' }, '⇲'); f.querySelector('.fw-b').appendChild(dock);
    const back = () => { if (g) { g.appendChild(s); if (tab) tab.style.display = ''; UI.showPanel(id); const other = g.querySelector('.ptab:not([style*="none"])'); if (!g.querySelector('.panel:not(.collapsed)') && other) UI.showPanel(other.dataset.p); } f.remove(); };
    dock.onclick = back; f.querySelector('.fw-x').onclick = back;
    if (g && !g.querySelector('.panel:not(.collapsed)')) { const other = g.querySelector('.ptab:not([style*="none"])'); if (other) UI.showPanel(other.dataset.p); }
    UI.refreshPanel(id); if (id === 'panel-comments') UI.refreshComments();
  },
  /** fenêtre flottante de document (vue secondaire, zoom et défilement indépendants) */
  doc(d, x, y, w = 420, h = 320) {
    d = d || MP.doc; if (!d) return; const f = this.frame(d.name, w, h, x ?? innerWidth - w - 330, y ?? 120), cv = el('canvas', { class: 'fw-cv' }); f.querySelector('.fw-c').appendChild(cv); f.classList.add('docwin');
    const st = { d, f, cv, z: 0, px: 0, py: 0, rev: -1 }; this.wins.push(st);
    const act = el('button', { title: 'Activer ce document dans la fenêtre principale' }, '⤢'); f.querySelector('.fw-b').appendChild(act); act.onclick = () => MP.setDoc(d);
    f.querySelector('.fw-x').onclick = () => { f.remove(); this.wins = this.wins.filter((o) => o !== st); };
    cv.addEventListener('dblclick', () => MP.setDoc(d));
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, nz = MP.clamp(st.z * Math.exp(-e.deltaY * 0.0025), 0.02, 32); st.px = mx - ((mx - st.px) / st.z) * nz; st.py = my - ((my - st.py) / st.z) * nz; st.z = nz; this.draw(st, true); }, { passive: false });
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); const sx = e.clientX - st.px, sy = e.clientY - st.py, mv = (ev) => { st.px = ev.clientX - sx; st.py = ev.clientY - sy; this.draw(st, true); }; cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', () => cv.removeEventListener('pointermove', mv), { once: true }); });
    new ResizeObserver(() => this.draw(st, true)).observe(f); this.draw(st, true); return st;
  },
  draw(st, force) {
    const { d, cv, f } = st; if (!MP.docs.includes(d)) { f.remove(); this.wins = this.wins.filter((o) => o !== st); return; }
    const c = f.querySelector('.fw-c'), W = c.clientWidth, H = c.clientHeight; if (!W || !H) return;
    if (!force && st.rev === d.rev && cv.width === W) return; st.rev = d.rev;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (!st.z) { st.z = Math.min((W - 10) / d.width, (H - 10) / d.height); st.px = (W - d.width * st.z) / 2; st.py = (H - d.height * st.z) / 2; }
    const x = cv.getContext('2d'); x.fillStyle = '#1b1b1d'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.fillRect(st.px, st.py, d.width * st.z, d.height * st.z);
    x.imageSmoothingQuality = 'high'; x.drawImage(d.composite(null, { noLive: true }), st.px, st.py, d.width * st.z, d.height * st.z);
    f.querySelector('.fw-t').textContent = `${d.name} @ ${Math.round(st.z * 100)} %` + (d === MP.doc ? ' (actif)' : '');
  },
  tile() { const others = MP.docs; if (!others.length) return; this.wins.forEach((w) => w.f.remove()); this.wins = []; const vp = $('#viewport').getBoundingClientRect(), n = others.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), w = vp.width / cols, h = vp.height / rows; others.forEach((d, i) => this.doc(d, vp.left + (i % cols) * w, vp.top + Math.floor(i / cols) * h, w - 4, h - 4)); },
  closeAll() { this.wins.forEach((w) => w.f.remove()); this.wins = []; },
  closeFor(d) { this.wins.filter((w) => w.d === d).forEach((w) => w.f.remove()); this.wins = this.wins.filter((w) => w.d !== d); },
};
{
  const dv = MP.drawView; MP.drawView = () => { dv(); if (MP.floating.wins.length) { clearTimeout(MP.floating._t); MP.floating._t = setTimeout(() => MP.floating.wins.forEach((w) => MP.floating.draw(w)), 120); } };
}

/* =================== Boîtes de dialogue (couleurs, bits, export, panorama) =================== */
Object.assign(UI.dialogs, {
  colorSettings() {
    const c = MP.cms.cmyk;
    dlg7({ title: 'Paramètres des couleurs', width: 500,
      fields: [{ k: 'workingRGB', label: 'Espace de travail RVB (nouveaux documents)', type: 'select', options: Object.entries(MP.cms.BUILTIN).map(([k, v]) => [k, v[0]]) }, { type: 'info', html: `<p>Profil CMJN de l'imprimeur : <b>${c ? esc(c.name) : 'aucun (séparation générique)'}</b></p><p class="muted">Chargez le profil fourni par votre imprimeur (ex. Coated FOGRA39 / ISO Coated v2 / PSO Uncoated, téléchargeables gratuitement sur eci.org ou chez votre imprimeur).</p>` }, { type: 'button', label: 'Charger un profil CMJN (.icc / .icm)…', action: () => MP.cms.loadCmykFile() }, { k: 'cmIntent', label: 'Mode de rendu', type: 'select', options: [[0, 'Perceptif'], [1, 'Colorimétrie relative'], [2, 'Saturation']] }, { k: 'cmBpc', label: 'Compensation du point noir', type: 'check' }, { k: 'embedICC', label: 'Incorporer le profil dans les fichiers exportés', type: 'check' }, { k: 'cmDisplay', label: 'Gérer l\'affichage des documents non sRGB', type: 'check' }],
      values: { workingRGB: MP.prefs.workingRGB || 'sRGB', cmIntent: MP.prefs.cmIntent ?? 0, cmBpc: MP.prefs.cmBpc !== false, embedICC: MP.prefs.embedICC !== false, cmDisplay: MP.prefs.cmDisplay !== false },
      onOk: (v) => { Object.assign(MP.prefs, { ...v, cmIntent: +v.cmIntent }); MP.savePrefs(); MP.cms._luts = {}; if (MP.doc) { MP.doc.rev++; MP.renderView(); } MP.toast('Paramètres des couleurs enregistrés'); } });
  },
  assignProfile(convert) {
    const d = MP.doc, cur = typeof d.profile === 'object' ? 'file' : d.profile || 'sRGB';
    dlg7({ title: convert ? 'Convertir en profil' : 'Attribuer un profil', width: 460, okLabel: convert ? 'Convertir' : 'Attribuer',
      fields: [{ type: 'info', html: `<p class="muted">Profil actuel : <b>${esc(MP.cms.profileName(d))}</b><br>${convert ? 'Les couleurs sont recalculées pour rester visuellement identiques dans le nouveau profil.' : 'Les valeurs des pixels restent identiques ; seule leur interprétation change.'}</p>` }, { k: 'p', label: 'Profil', type: 'select', options: [...Object.entries(MP.cms.BUILTIN).map(([k, v]) => [k, v[0]]), ['file', 'Profil RVB depuis un fichier .icc…']] }],
      values: { p: cur },
      onOk: async (v) => {
        let target = v.p;
        if (v.p === 'file') { const f = (await MP.native.openFiles({ multi: false, accept: '.icc,.icm', filters: [{ name: 'Profils ICC', extensions: ['icc', 'icm'] }] }))[0]; if (!f) return; const P = MP.icc.parse(f.data); if (P.space !== 'RGB') { MP.toast('Profil RVB attendu'); return; } target = { name: P.name, bytes: f.data }; }
        if (convert) MP.busy('Conversion des couleurs…', () => MP.cms.convertDoc(d, target)); else { d.history.record('Attribuer un profil', null); d.profile = target; MP.cms._luts = {}; d.rev++; MP.render(); MP.ui.refreshAll(); }
        MP.toast((convert ? 'Converti en ' : 'Profil attribué : ') + MP.cms.profileName(d));
      } });
  },
  panorama() {
    dlg7({ title: 'Photomerge', width: 460, okLabel: 'Choisir les photos…',
      fields: [{ k: 'layout', label: 'Disposition', type: 'select', options: [['auto', 'Auto'], ['perspective', 'Perspective'], ['cylindrical', 'Cylindrique'], ['reposition', 'Repositionnement']] }, { k: 'focal', label: 'Focale équivalente 24×36 (mm, pour le cylindrique)', type: 'number', min: 8, max: 600 }, { k: 'blend', label: 'Fusionner les images (coutures optimales)', type: 'check' }, { k: 'exposure', label: 'Harmoniser l\'exposition', type: 'check' }, { k: 'edge', label: 'Bords', type: 'select', options: [['none', 'Laisser transparents'], ['fill', 'Remplir d\'après le contenu'], ['crop', 'Recadrer automatiquement']] }],
      values: { layout: 'auto', focal: 28, blend: true, exposure: true, edge: 'none' },
      onOk: async (v) => { const f = await MP.native.openFiles({ multi: true, accept: 'image/*', filters: [{ name: 'Images', extensions: IMAGE_EXT }] }); if (f && f.length) MP.panoramaPro(f, { layout: v.layout === 'reposition' ? 'similarity' : v.layout, focal: +v.focal, blend: v.blend, exposure: v.exposure, fill: v.edge === 'fill', crop: v.edge === 'crop' }); } });
  },
  autoAlign() { dlg7({ title: 'Alignement automatique des calques', width: 420, fields: [{ k: 'm', label: 'Projection', type: 'select', options: [['homography', 'Auto / Perspective'], ['similarity', 'Repositionnement (position, rotation, échelle)'], ['translation', 'Translation seule']] }, { type: 'info', html: '<p class="muted">Les calques visibles du groupe actif sont alignés sur le calque du bas.</p>' }], values: { m: 'homography' }, onOk: (v) => MP.autoAlignPro(v.m) }); },
  hdrMerge() { (async () => { const f = await MP.native.openFiles({ multi: true, accept: 'image/*', filters: [{ name: 'Images', extensions: IMAGE_EXT }] }); if (f && f.length) MP.hp.merge(f); })(); },
  export16(fmt) {
    const d = MP.doc, hpL = d.layers.filter((l) => l.visible && l.smart && l.smart.hp), single = hpL.length === 1 && d.layers.filter((l) => l.visible && !l.isGroup).length === 1 ? hpL[0] : null;
    if (fmt === 'hdr' && !single) { MP.toast('Le format Radiance HDR nécessite un document constitué d\'un seul calque 32 bits (Image > Mode > 32 bits)', 6000); return; }
    MP.busy('Export ' + (fmt === 'hdr' ? '32 bits' : '16 bits') + '…', async () => {
      const icc = MP.prefs.embedICC === false ? null : MP.cms.profileBytes(d), base = d.name.replace(/\.[^.]+$/, '');
      const hp = single ? { ...single.smart.hp, devFn: MP.hp.devFn(single.smart.dev) } : null; let data, e;
      if (fmt === 'hdr') { data = MP.enc.hdr(single.smart.hp); e = 'hdr'; }
      else if (fmt === 'png16') { data = await MP.enc.png16(MP.flatComposite(d), hp, { icc, dpi: d.dpi || 72 }); e = 'png'; }
      else if (fmt === 'tiff32') { if (!single) { MP.toast('TIFF 32 bits : un seul calque haute précision requis'); return; } data = MP.enc.tiffX({ canvas: null, hp: single.smart.hp, bits: 32, dpi: d.dpi || 72, meta: d.meta || {}, icc }); e = 'tif'; }
      else { data = MP.enc.tiffX({ canvas: MP.flatComposite(d), hp, bits: 16, dpi: d.dpi || 72, meta: d.meta || {}, icc, alpha: !hp }); e = 'tif'; }
      const p = await MP.native.saveFile({ defaultPath: base + '.' + e, filters: [{ name: e.toUpperCase(), extensions: [e] }], data }); if (p) MP.toast(`Exporté (${(data.length / 1048576).toFixed(1)} Mo)` + (hp ? ' depuis les données haute précision' : ' — composition 8 bits étendue en 16 bits (un seul calque 16 bits donne une vraie précision)'), 5000);
    });
  },
});

/* =================== Panneaux, propriétés, barre d'état =================== */
{
  const bd = UI.buildDock;
  UI.buildDock = () => { $('#panels').appendChild(el('section', { class: 'panel collapsed', id: 'panel-comments' }, '<h3>Commentaires</h3><div class="body"></div>')); UI.DOCK[0].push('panel-comments'); bd(); };
  const rp = UI.refreshPanel; UI.refreshPanel = (id) => (id === 'panel-comments' ? UI.refreshComments() : rp(id));
  const rp0 = UI.refreshProps;
  UI.refreshProps = (force) => {
    rp0(force); const box = document.querySelector('#panel-props .body'), d = MP.doc; if (!box || !d || box.querySelector('.v7sec') || !box.querySelector('.v6sec')) return; const l = d.layer;
    const S = (t) => { const s = el('div', { class: 'psec v7sec' }); s.appendChild(el('div', { class: 'psec-t' }, esc(t))); box.appendChild(s); return s; }, B = (n, f) => { const b = el('button', { class: 'btn small' }, n); b.onclick = f; return b; }, R = (...k) => { const r = el('div', { class: 'prow' }); r.append(...k); return r; };
    if (l.smart && l.smart.hp) { const hp = l.smart.hp, s = S(`Image ${hp.bits} bits (virgule flottante)`); s.appendChild(el('p', { class: 'muted' }, `${hp.w} × ${hp.h} — exposition ${(+l.smart.dev.exposure || 0).toFixed(2)} IL, virage ${({ filmic: 'filmique', reinhard: 'Reinhard', linear: 'linéaire' })[l.smart.dev.tone]}`)); s.appendChild(R(B('Développer (Camera Raw)…', () => MP.hp.develop(l)), B('Exporter TIFF 16 bits', () => UI.dialogs.export16('tiff16')))); }
    const s = S('Couleur'); s.appendChild(el('p', { class: 'muted' }, `Profil : ${esc(MP.cms.profileName(d))} — CMJN : ${esc(MP.cms.cmyk ? MP.cms.cmyk.name : 'générique')}`)); s.appendChild(R(B('Attribuer…', () => UI.dialogs.assignProfile(false)), B('Convertir…', () => UI.dialogs.assignProfile(true)), B('Paramètres…', () => UI.dialogs.colorSettings())));
  };
  const rs = UI.refreshStatus; UI.refreshStatus = () => { rs(); const d = MP.doc, s = $('#st-size'); if (d && s) s.textContent += ` — ${MP.cms.isSRGB(d) ? 'sRGB' : MP.cms.profileName(d)}, ${d.bits || 8} bits${d.viewAngle ? ` — vue ${d.viewAngle}°` : ''}`; };
}

/* =================== Menus v7 =================== */
{
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), M = (l) => (m.find((x) => x.label === l) || { items: [] }).items, find = (items, lab) => items.find((x) => L7(x) === lab);
    const fi = M('Fichier'), auto = find(fi, 'Automatisation');
    if (auto) { const s0 = auto.sub; auto.sub = () => s0().map((x) => (L7(x).startsWith('Photomerge') ? { label: 'Photomerge (panorama)…', act: () => UI.dialogs.panorama() } : x)).concat([{ label: 'Fusion HDR Pro (32 bits)…', act: () => UI.dialogs.hdrMerge() }]); }
    const ex = find(fi, 'Exporter'); if (ex) { const s0 = ex.sub; ex.sub = () => [...s0(), '-', { label: 'TIFF 16 bits…', act: need(() => UI.dialogs.export16('tiff16')) }, { label: 'PNG 16 bits…', act: need(() => UI.dialogs.export16('png16')) }, { label: 'TIFF 32 bits (flottant)…', act: need(() => UI.dialogs.export16('tiff32')) }, { label: 'Radiance HDR (32 bits)…', act: need(() => UI.dialogs.export16('hdr')) }]; }
    const ii = fi.findIndex((x) => L7(x) === 'Importer'); fi.splice(ii < 0 ? fi.length : ii, 0, { label: 'Partager', sub: () => [{ label: 'Enregistrer dans le cloud (OneDrive, Dropbox, Google Drive)…', act: need(() => MP.collab.saveToCloud()) }, { label: 'Partager / inviter…', act: need(() => MP.collab.share()) }, '-', { label: 'Commentaires', act: () => UI.showPanel('panel-comments') }, { label: 'Votre nom pour les commentaires…', act: () => UI.dialogs.userName() }] });
    const ed = M('Édition'); const ai = ed.findIndex((x) => L7(x) === 'Alignement automatique des calques'); if (ai >= 0) ed[ai] = { label: 'Alignement automatique des calques…', act: need(() => UI.dialogs.autoAlign()) };
    const pi = ed.findIndex((x) => L7(x).startsWith('Préférences')); ed.splice(pi < 0 ? ed.length : pi, 0, { label: 'Couleurs et profils', sub: () => [{ label: 'Paramètres des couleurs…', sc: 'Ctrl+Maj+K', act: () => UI.dialogs.colorSettings() }, { label: 'Attribuer un profil…', act: need(() => UI.dialogs.assignProfile(false)) }, { label: 'Convertir en profil…', act: need(() => UI.dialogs.assignProfile(true)) }, '-', { label: 'Charger le profil CMJN de l\'imprimeur…', act: () => MP.cms.loadCmykFile() }] }, '-');
    const im = M('Image'), mo = find(im, 'Mode'); if (mo) { const s0 = mo.sub; mo.sub = () => { const b = (MP.doc && MP.doc.bits) || 8; return [...s0().filter((x) => !(x && x.disabled)), '-', ...[8, 16, 32].map((n) => ({ label: (b === n ? '✓ ' : '') + n + ' bits par couche', act: need(() => MP.hp.setDocBits(n)) })), '-', { label: 'CMJN : ' + (MP.cms.cmyk ? MP.cms.cmyk.name : 'générique — chargez le profil de l\'imprimeur'), act: () => UI.dialogs.colorSettings() }]; }; }
    const rg = find(im, 'Réglages'); if (rg) { const s0 = rg.sub; rg.sub = () => [...s0(), '-', { label: 'Virage HDR / développement 16-32 bits…', act: need(() => MP.hp.develop()) }]; }
    const fl = M('Filtre'); fl.splice(1, 0, { label: 'Camera Raw 16/32 bits (développement)…', sc: 'Ctrl+Maj+A', act: need(() => MP.hp.develop()) });
    const af = M('Affichage'); af.push({ label: () => (MP.prefs.smartGuides !== false ? '✓ ' : '') + 'Repères commentés', act: () => { MP.prefs.smartGuides = MP.prefs.smartGuides === false; MP.savePrefs(); } }, { label: () => (MP.prefs.showComments !== false ? '✓ ' : '') + 'Commentaires', act: () => { MP.prefs.showComments = MP.prefs.showComments === false; MP.savePrefs(); MP.renderView(); } });
    const pr = af.findIndex((x) => L7(x).includes('Épreuve écran CMJN')); if (pr >= 0) af.splice(pr, 0, { label: 'Format d\'épreuve : ' + (MP.cms.cmyk ? MP.cms.cmyk.name : 'CMJN générique') + '…', act: () => UI.dialogs.colorSettings() });
    const fe = M('Fenêtre'), hi = fe.findIndex((x) => L7(x).includes('Bibliothèques'));
    fe.splice(hi < 0 ? fe.length : hi + 1, 0, { label: () => (vis7('panel-comments') ? '✓ ' : '') + 'Commentaires', act: () => UI.showPanel('panel-comments') }, { label: 'Réorganiser', sub: () => [{ label: 'Faire flotter le document dans une fenêtre', act: need(() => MP.floating.doc(MP.doc)) }, { label: 'Nouvelle fenêtre pour ' + (MP.doc ? MP.doc.name : '…'), act: need(() => { const w = MP.floating.doc(MP.doc); w.z = 1; w.px = 0; w.py = 0; MP.floating.draw(w, true); }) }, { label: 'Mosaïque (tous les documents)', act: need(() => MP.floating.tile()) }, { label: 'Tout regrouper dans des onglets', act: () => MP.floating.closeAll() }, '-', ...['panel-props', 'panel-layers', 'panel-history', 'panel-color', 'panel-brushes', 'panel-char', 'panel-adjust', 'panel-comments', 'panel-library', 'panel-nav'].map((id) => ({ label: 'Panneau flottant : ' + ($('#' + id + ' h3') ? $('#' + id + ' h3').textContent : id), act: () => MP.floating.panel(id) }))] });
    return m;
  };
}

/* =================== Initialisation v7 =================== */
MP.v7init = async () => {
  MP._sessionId = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (MP.native.userInfo) { try { const u = await MP.native.userInfo(); MP._sysUser = u.name; MP._host = u.host; } catch (_) { /* */ } }
  if (MP.native.onPathChanged) MP.native.onPathChanged((p, t) => MP.collab.changed(p, t));
  await MP.cms.loadStored();
  // onglets détachables : clic droit sur un onglet de panneau
  document.querySelectorAll('.ptab').forEach((t) => t.addEventListener('contextmenu', (e) => { e.preventDefault(); UI.ctxMenu(e.clientX, e.clientY, [{ label: 'Détacher dans une fenêtre flottante', act: () => MP.floating.panel(t.dataset.p) }]); }));
  document.querySelectorAll('.ptab').forEach((t) => { t.draggable = true; t.addEventListener('dragend', (e) => { const r = $('#panels').getBoundingClientRect(); if (e.clientX < r.left - 30 || e.clientY > innerHeight - 10) MP.floating.panel(t.dataset.p); }); });
  const tabs = $('#tabs'); if (tabs) tabs.addEventListener('dblclick', () => MP.doc && MP.floating.doc(MP.doc));
  const ad = MP.addDoc; MP.addDoc = (d) => { if (!d.profile) d.profile = MP.prefs.workingRGB && MP.prefs.workingRGB !== 'sRGB' && d.layers.length <= 1 && !d.sourcePath ? MP.prefs.workingRGB : 'sRGB'; return ad(d); };
  const ra = UI.refreshAll; UI.refreshAll = () => { ra(); UI.refreshComments(); };
  UI.buildMenus(); UI.refreshAll();
};
