'use strict';
/* v4 — Menus contextuels (clic droit), glisser-déposer complet, masques d'écrêtage & options de calque,
   nouveaux outils (pinceau mélangeur, plume libre, plume de courbure, masque de texte, comptage, notes),
   recherche de commandes, panneau Actions, menu Fenêtre, thème clair, filtres neuronaux locaux. */

/* =================== Opérations de calque supplémentaires =================== */
Object.assign(MP.layerOps, {
  toggleClip() {
    const d = MP.doc, l = d.layer, sib = d.children(l.parent), below = sib[sib.indexOf(l) - 1];
    if (!l.clip && !below) { MP.toast('Il faut un calque en dessous pour créer un masque d\'écrêtage'); return; }
    d.history.record(l.clip ? 'Libérer le masque d\'écrêtage' : 'Créer un masque d\'écrêtage', null); l.clip = !l.clip; MP.afterEdit();
  },
  toggleLockAlpha() { const d = MP.doc, l = d.layer; d.history.record('Verrouiller la transparence', null); l.lockAlpha = !l.lockAlpha; MP.afterEdit(); },
  setLabel(c) { const d = MP.doc; d.history.record('Couleur de calque', null); d.layer.label = c; MP.afterEdit(); },
  copyStyle() { const l = MP.doc.layer; if (!MP.fx.has(l)) { MP.toast('Ce calque n\'a pas de style'); return; } MP.styleClip = JSON.parse(JSON.stringify(l.fx)); MP.toast('Style copié'); },
  pasteStyle() { if (!MP.styleClip) { MP.toast('Aucun style copié'); return; } const d = MP.doc, l = d.layer; if (l.isGroup || l.adjust) return; d.history.record('Coller le style', null); l.fx = JSON.parse(JSON.stringify(MP.styleClip)); MP.afterEdit(); },
  viaCut() {
    const d = MP.doc; if (!d.selection) { MP.toast('Faites d\'abord une sélection'); return; } if (!MP.canEditPixels()) return;
    const src = MP.cloneCanvas(d.layer.canvas); d.clipToSelection(src);
    d.history.record('Calque par couper', 'all'); MP.rasterize(d.layer);
    const c = d.layer.ctx; c.save(); c.globalCompositeOperation = 'destination-out'; c.drawImage(d.selection, 0, 0); c.restore();
    const l = d.addLayer(d.layer.name + ' (coupé)'); l.canvas = src; MP.sel.none(d); MP.afterEdit();
  },
  async exportPng(l) {
    const d = MP.doc; l = l || d.layer; const c = this.bake(l), b = MP.alphaBounds(c, 0) || { x: 0, y: 0, w: d.width, h: d.height };
    const t = MP.createCanvas(b.w, b.h); t.getContext('2d').drawImage(c, -b.x, -b.y);
    const blob = await new Promise((r) => t.toBlob(r, 'image/png'));
    const p = await MP.native.saveFile({ defaultPath: l.name.replace(/[\\/:*?"<>|]/g, '_') + '.png', filters: [{ name: 'PNG', extensions: ['png'] }], data: new Uint8Array(await blob.arrayBuffer()) });
    if (p) MP.toast('Calque exporté (rogné à son contenu)');
  },
  /** Copie un calque (avec masque, style, texte) d'un document vers un autre. */
  copyTo(src, from, to) {
    const ox = Math.round((to.width - from.width) / 2), oy = Math.round((to.height - from.height) / 2);
    to.history.record('Copier le calque « ' + src.name + ' »', null);
    const l = new MP.Layer(to.width, to.height, src.name);
    if (src.isGroup) { l.canvas.getContext('2d').drawImage(MP.layerOps.bake(src), ox, oy); }
    else { Object.assign(l, src.props()); l.parent = null; l.clip = false; if (src.adjust) l.canvas = MP.createCanvas(1, 1); else l.canvas.getContext('2d').drawImage(src.canvas, ox, oy); if (l.text) { l.text.x += ox; l.text.y += oy; } }
    if (src.mask && !src.isGroup) { const m = MP.createCanvas(to.width, to.height), mc = m.getContext('2d'); mc.fillStyle = '#fff'; mc.fillRect(0, 0, to.width, to.height); mc.clearRect(ox, oy, from.width, from.height); mc.drawImage(src.mask, ox, oy); l.mask = m; }
    to.layers.push(l); to.normalize(); to.active = to.layers.indexOf(l); if (l.text) MP.renderText(l);
    to.markDirty(); return l;
  },
});

/* =================== Menus contextuels =================== */
UI.ctxMenu = (x, y, items) => {
  const close = () => document.querySelectorAll('.dropdown').forEach((e) => e.remove());
  close();
  const render = (list, px, py, level, altX) => {
    const dd = el('div', { class: 'dropdown ctx' }); dd.dataset.level = level;
    for (const it of list) {
      if (!it) continue;
      if (it === '-') { if (dd.lastChild && !dd.lastChild.classList.contains('sep')) dd.appendChild(el('div', { class: 'sep' })); continue; }
      const row = el('div', { class: 'item' + (it.disabled ? ' disabled' : '') + (it.sub ? ' has-sub' : '') }, `<span>${it.swatch ? `<i class="lsw" style="background:${it.swatch}"></i>` : ''}${esc(it.label)}</span><kbd>${it.sc ? esc(it.sc) : it.sub ? '▸' : ''}</kbd>`);
      row.addEventListener('mouseenter', () => {
        document.querySelectorAll('.dropdown').forEach((e) => { if (+e.dataset.level > level) e.remove(); });
        if (it.sub) { const r = row.getBoundingClientRect(); render(it.sub, r.right - 2, r.top - 4, level + 1, r.left + 2); }
      });
      if (!it.sub && !it.disabled) row.addEventListener('click', () => { close(); setTimeout(() => it.act(), 0); });
      dd.appendChild(row);
    }
    if (dd.lastChild && dd.lastChild.classList.contains('sep')) dd.lastChild.remove();
    dd.style.left = px + 'px'; dd.style.top = py + 'px'; document.body.appendChild(dd);
    const r = dd.getBoundingClientRect();
    if (r.right > innerWidth - 4) dd.style.left = Math.max(4, altX !== undefined ? altX - r.width : innerWidth - r.width - 6) + 'px';
    if (r.bottom > innerHeight - 4) dd.style.top = Math.max(4, innerHeight - r.height - 6) + 'px';
  };
  render(items, x, y, 0);
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!e.target.closest('.dropdown')) { close(); document.removeEventListener('mousedown', off); } }), 0);
};
const LABELS = [['Aucune', null], ['Rouge', '#e5484d'], ['Orange', '#f2994a'], ['Jaune', '#f5d90a'], ['Vert', '#46a758'], ['Bleu', '#3e8ef7'], ['Violet', '#8e4ec6'], ['Gris', '#8b8d98']];

UI.canvasMenu = (x, y) => {
  const d = MP.doc, L = MP.layerOps;
  if (!d) { UI.ctxMenu(x, y, [{ label: 'Nouveau document…', act: () => UI.dialogs.newDoc() }, { label: 'Ouvrir…', act: () => MP.io.open() }, { label: 'Nouveau d\'après le presse-papiers', act: () => MP.cmd.newFromClipboard() }]); return; }
  const h = d.history, sel = !!d.selection, l = d.layer;
  const items = [
    { label: 'Annuler ' + (h.undoStack.at(-1)?.label || ''), sc: 'Ctrl+Z', disabled: !h.undoStack.length, act: () => UI.undo() },
    { label: 'Rétablir ' + (h.redoStack.at(-1)?.label || ''), sc: 'Ctrl+Y', disabled: !h.redoStack.length, act: () => UI.redo() },
    '-',
  ];
  if (sel) items.push(
    { label: 'Désélectionner', sc: 'Ctrl+D', act: () => UI.selCmd('Désélectionner', (dd) => MP.sel.none(dd)) },
    { label: 'Intervertir la sélection', sc: 'Ctrl+Maj+I', act: () => UI.selCmd('Intervertir', (dd) => MP.sel.invert(dd)) },
    { label: 'Contour progressif…', act: () => UI.selModDialog('Contour progressif', (dd, r) => MP.sel.feather(dd, r), 5) },
    { label: 'Sélectionner et masquer…', act: () => MP.cmd.selectAndMask() },
    '-',
    { label: 'Calque par copier', sc: 'Ctrl+J', act: () => UI.layerViaCopy() },
    { label: 'Calque par couper', sc: 'Ctrl+Maj+J', act: () => L.viaCut() },
    { label: 'Copier', sc: 'Ctrl+C', act: () => MP.edit.copy(false) },
    { label: 'Couper', sc: 'Ctrl+X', act: () => MP.edit.cut() },
    { label: 'Effacer', sc: 'Suppr', act: () => MP.edit.clear() },
    '-',
    { label: 'Remplir…', act: () => UI.dialogs.fill() },
    { label: 'Remplir d\'après le contenu', act: () => MP.edit.fill({ what: 'content' }) },
    { label: 'Contour…', act: () => UI.dialogs.stroke() },
    { label: '✨ Remplissage génératif…', act: () => UI.dialogs.genFill() },
    { label: 'Ajouter un masque de fusion', act: () => L.addMask(true) },
    { label: 'Transformation manuelle', sc: 'Ctrl+T', act: () => MP.startTransform() },
  );
  else items.push(
    { label: 'Coller', sc: 'Ctrl+V', act: () => UI.pasteFromAnywhere() },
    { label: 'Tout sélectionner', sc: 'Ctrl+A', act: () => UI.selCmd('Tout sélectionner', (dd) => MP.sel.all(dd)) },
    { label: 'Sélectionner les pixels du calque', act: () => UI.selCmd('Sélectionner les pixels', (dd) => MP.sel.fromLayerAlpha(dd, dd.layer)) },
    { label: '✨ Sélectionner le sujet', act: () => MP.ai.selectSubject() },
    { label: 'Sélectionner le ciel', act: () => MP.sky.select() },
    '-',
    { label: 'Nouveau calque', sc: 'Ctrl+Maj+N', act: () => L.add() },
    { label: 'Dupliquer le calque', sc: 'Ctrl+J', act: () => L.duplicate() },
    { label: 'Nouveau calque de réglage', sub: MP.ADJ_LAYER_KEYS.map((k) => ({ label: MP.ADJUST[k].title, act: () => L.addAdjust(k) })) },
    { label: 'Style de calque…', disabled: l.isGroup || !!l.adjust, act: () => UI.dialogs.layerStyle() },
    { label: 'Transformation manuelle', sc: 'Ctrl+T', act: () => MP.startTransform() },
  );
  items.push('-',
    { label: 'Affichage', sub: [{ label: 'Adapter à l\'écran', sc: 'Ctrl+0', act: () => MP.view.fit() }, { label: 'Taille réelle (100 %)', sc: 'Ctrl+1', act: () => MP.view.setZoom(1, null, true) }, { label: 'Zoom avant', act: () => MP.view.zoomStep(1) }, { label: 'Zoom arrière', act: () => MP.view.zoomStep(-1) }, '-', { label: (MP.prefs.rulers !== false ? '✓ ' : '') + 'Règles', act: () => { MP.prefs.rulers = MP.prefs.rulers === false; MP.savePrefs(); MP.guides.apply(); } }, { label: (MP.settings.showGrid ? '✓ ' : '') + 'Grille', act: () => { MP.settings.showGrid = !MP.settings.showGrid; MP.renderView(); } }] },
    { label: 'Exporter (PNG, JPEG, WebP)…', act: () => UI.dialogs.exportImg() },
  );
  UI.ctxMenu(x, y, items);
};
UI.layerMenu = (x, y, l) => {
  const d = MP.doc, L = MP.layerOps; d.active = d.layers.indexOf(l); d.editMask = !!(l.adjust && l.mask); UI.refreshLayers();
  const pix = !l.isGroup && !l.adjust;
  UI.ctxMenu(x, y, [
    { label: 'Renommer le calque…', act: () => UI.dialog({ title: 'Renommer le calque', fields: [{ k: 'n', label: 'Nom', type: 'text' }], values: { n: l.name }, onOk: (v) => { if (v.n.trim()) { d.history.record('Renommer le calque', null); l.name = v.n.trim(); MP.afterEdit(); } } }) },
    l.text ? { label: 'Modifier le texte…', act: () => UI.textDialog(l, false) } : null,
    l.adjust ? { label: 'Modifier le réglage…', act: () => UI.editAdjustLayer(l, false) } : null,
    pix ? { label: 'Options de fusion / Style de calque…', act: () => UI.dialogs.layerStyle() } : null,
    '-',
    { label: 'Dupliquer le calque', act: () => L.duplicate() },
    { label: 'Supprimer le calque', act: () => L.remove() },
    { label: 'Grouper le calque', sc: 'Ctrl+G', act: () => L.newGroup(true) },
    l.isGroup ? { label: 'Dissocier le groupe', sc: 'Ctrl+Maj+G', act: () => L.ungroup() } : null,
    l.isGroup ? { label: 'Fusionner le groupe', act: () => L.mergeGroup() } : null,
    '-',
    { label: l.clip ? 'Libérer le masque d\'écrêtage' : 'Créer un masque d\'écrêtage', sc: 'Ctrl+Alt+G', act: () => L.toggleClip() },
    { label: 'Masque de fusion', sub: l.mask ? [{ label: l.maskEnabled ? 'Désactiver le masque' : 'Activer le masque', act: () => L.toggleMask() }, { label: 'Inverser le masque', act: () => L.invertMask() }, { label: 'Appliquer le masque', disabled: !pix, act: () => L.applyMask() }, { label: 'Supprimer le masque', act: () => L.deleteMask() }, { label: 'Sélection d\'après le masque', act: () => UI.selCmd('Sélection d\'après le masque', (dd) => MP.sel.fromMask(dd, l.mask)) }] : [{ label: 'Tout faire apparaître', act: () => L.addMask(false, false) }, { label: 'Tout masquer', act: () => L.addMask(false, true) }, { label: 'D\'après la sélection', disabled: !d.selection, act: () => L.addMask(true) }] },
    pix ? { label: 'Sélectionner les pixels', act: () => UI.selCmd('Sélectionner les pixels', (dd) => MP.sel.fromLayerAlpha(dd, l)) } : null,
    '-',
    pix && MP.fx.has(l) ? { label: 'Copier le style de calque', act: () => L.copyStyle() } : null,
    pix && MP.styleClip ? { label: 'Coller le style de calque', act: () => L.pasteStyle() } : null,
    pix && l.fx ? { label: 'Effacer le style de calque', act: () => L.clearStyle() } : null,
    l.text || MP.fx.has(l) ? { label: l.text ? 'Pixelliser le texte' : 'Pixelliser le style', act: () => L.rasterize() } : null,
    '-',
    pix ? { label: (l.lockAlpha ? '✓ ' : '') + 'Verrouiller les pixels transparents', sc: '/', act: () => L.toggleLockAlpha() } : null,
    { label: (l.locked ? '✓ ' : '') + 'Verrouiller tout', act: () => { d.history.record('Verrouiller', null); l.locked = !l.locked; MP.afterEdit(); } },
    { label: 'Couleur', sub: LABELS.map(([n, c]) => ({ label: n, swatch: c || 'transparent', act: () => L.setLabel(c) })) },
    '-',
    { label: 'Fusionner vers le bas', sc: 'Ctrl+E', act: () => L.mergeDown() },
    { label: 'Fusionner les calques visibles', sc: 'Ctrl+Maj+E', act: () => L.mergeVisible() },
    { label: 'Aplatir l\'image', act: () => L.flatten() },
    '-',
    { label: 'Exporter le calque en PNG…', act: () => L.exportPng(l) },
  ]);
};
UI.tabMenu = (x, y, doc) => {
  MP.setDoc(doc);
  UI.ctxMenu(x, y, [
    { label: 'Enregistrer le projet', sc: 'Ctrl+S', act: () => MP.io.save(false) },
    { label: 'Enregistrer au format PSD…', act: () => MP.io.savePsd() },
    { label: 'Exporter…', act: () => UI.dialogs.exportImg() },
    '-',
    { label: 'Dupliquer l\'image', act: () => MP.cmd.duplicateImage() },
    { label: 'Taille de l\'image…', act: () => UI.dialogs.imageSize() },
    '-',
    { label: 'Fermer', sc: 'Ctrl+W', act: () => UI.closeDoc(doc) },
    { label: 'Fermer les autres', disabled: MP.docs.length < 2, act: async () => { for (const o of [...MP.docs]) if (o !== doc) await UI.closeDoc(o); } },
    { label: 'Tout fermer', act: async () => { for (const o of [...MP.docs]) await UI.closeDoc(o); } },
  ]);
};
/* Clic droit avec un outil de peinture : réglage rapide du pinceau (comme Photoshop) */
UI.brushPopup = (x, y) => {
  document.querySelectorAll('.brushpop').forEach((e) => e.remove());
  const t = MP.tool, box = el('div', { class: 'brushpop' });
  box.appendChild(el('div', { class: 'bp-title' }, esc(t.name)));
  for (const o of (t.options || []).filter((o) => ['size', 'hardness', 'shape', 'opacity', 'strength'].includes(o.k))) box.appendChild(UI.control(o, t.opts, () => { UI.refreshTool(); MP.renderView(); }));
  box.style.left = Math.min(x, innerWidth - 300) + 'px'; box.style.top = Math.min(y, innerHeight - 220) + 'px'; document.body.appendChild(box);
  const off = (e) => { if (!e.target.closest('.brushpop')) { box.remove(); document.removeEventListener('mousedown', off, true); } };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
};

/* =================== Glisser-déposer =================== */
MP.dnd = {
  entry: async (file) => ({ name: file.name, path: (MP.native.pathForFile && MP.native.pathForFile(file)) || file.path || null, data: new Uint8Array(await file.arrayBuffer()) }),
  zone(e) { const t = document.elementFromPoint(e.clientX, e.clientY) || e.target; if (t && t.closest && t.closest('#layerlist') && MP.doc) return 'layers'; if (t && t.closest && t.closest('#viewport') && MP.doc) return 'canvas'; return 'open'; },
  over(e) {
    const types = [...(e.dataTransfer.types || [])];
    if (!types.includes('Files')) return;
    const z = this.zone(e), msg = { canvas: 'Déposez pour placer les images comme calques (Maj : ouvrir dans un nouvel onglet)', layers: 'Déposez pour insérer les images dans la pile de calques', open: 'Déposez pour ouvrir les images (nouveaux onglets)' }[z];
    document.body.classList.add('dropping'); const dz = document.getElementById('dropzone'); if (dz.textContent !== msg) dz.textContent = msg;
  },
  async placeImage(c, name, at) {
    const d = MP.doc; let img = c;
    const k = Math.min(1, (d.width * 0.95) / c.width, (d.height * 0.95) / c.height);
    if (k < 1) { img = MP.createCanvas(c.width * k, c.height * k); const x = img.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, img.width, img.height); }
    const px = at ? Math.round(at.x - img.width / 2) : Math.round((d.width - img.width) / 2), py = at ? Math.round(at.y - img.height / 2) : Math.round((d.height - img.height) / 2);
    MP.edit.pasteCanvas(img, name.replace(/\.[^.]+$/, ''), MP.clamp(px, -img.width / 2, d.width - img.width / 2), MP.clamp(py, -img.height / 2, d.height - img.height / 2));
  },
  async drop(e) {
    const dt = e.dataTransfer, types = [...(dt.types || [])];
    if (types.includes('text/x-layer') || types.includes('text/x-doc') || types.includes('text/x-color')) return true; // gérés par leurs zones
    const files = [...(dt.files || [])], z = e.shiftKey && this.zone(e) === 'canvas' ? 'open' : this.zone(e);
    if (!files.length) {
      const txt = dt.getData('text/plain');
      if (txt && MP.doc && z === 'canvas') { const p = MP.view.toDoc(e.clientX, e.clientY); this.textLayer(txt, p); return true; }
      return false;
    }
    if (z === 'open') return false;
    if (z === 'layers') { const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('.layer'); if (row) { MP.doc.active = MP.doc.layers.indexOf(MP.doc.byId(+row.dataset.id)); } }
    const at = z === 'canvas' ? MP.view.toDoc(e.clientX, e.clientY) : null;
    for (const f of files) {
      const en = await this.entry(f), ext = (f.name.split('.').pop() || '').toLowerCase();
      if (['mpp', 'psd'].includes(ext)) { await MP.io.openFile(en); continue; }
      try { await this.placeImage(await MP.io.loadImage(en.data, f.name), f.name, at); } catch (err) { MP.toast('Impossible d\'importer ' + f.name); }
    }
    MP.toast(files.length > 1 ? files.length + ' images placées comme calques' : 'Image placée comme calque — Ctrl+T pour la redimensionner');
    return true;
  },
  textLayer(txt, p) {
    const d = MP.doc; d.history.record('Texte déposé', null);
    const l = d.addLayer('Texte');
    l.text = { x: Math.round(p.x), y: Math.round(p.y), content: txt.slice(0, 2000), font: 'Arial', size: Math.max(16, Math.round(d.width / 30)), bold: false, italic: false, underline: false, color: MP.colors.fg, align: 'left', lineHeight: 1.2, spacing: 0, stroke: false, strokeColor: '#ffffff', strokeWidth: 2, shadow: false };
    MP.renderText(l); MP.afterEdit();
  },
  fillAt(color, p) {
    const d = MP.doc; if (!MP.canEditPixels()) return;
    const region = MP.floodMask(d.layer.canvas, p.x, p.y, MP.tools.bucket.opts.tolerance, true); if (!region) return;
    d.history.record('Remplissage (glisser-déposer)', [d.layer.id]); MP.rasterize(d.layer);
    const f = MP.createCanvas(d.width, d.height), fc = f.getContext('2d'); fc.fillStyle = color; fc.fillRect(0, 0, d.width, d.height); fc.globalCompositeOperation = 'destination-in'; fc.drawImage(region, 0, 0); d.clipToSelection(f);
    d.layer.ctx.drawImage(f, 0, 0); MP.afterEdit();
  },
  init() {
    const list = $('#layerlist'), tabs = $('#tabs'), view = MP.view.canvas;
    // calques : mémoriser le document source ; dépôt d'une couleur = calque de remplissage
    list.addEventListener('dragstart', () => { this.dragDoc = MP.doc; }, true);
    list.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('text/x-color')) e.preventDefault(); });
    list.addEventListener('drop', (e) => {
      const c = e.dataTransfer.getData('text/x-color'); if (!c || !MP.doc) return; e.preventDefault(); e.stopPropagation();
      const row = e.target.closest('.layer'); if (row) MP.doc.active = MP.doc.layers.indexOf(MP.doc.byId(+row.dataset.id));
      MP.layerOps.addAdjust('solidFill'); const l = MP.doc.layer; l.adjust.values.c = c; MP.ui.dialogOpen && MP.ui.dialogOpen.close(); MP.afterEdit(); MP.toast('Calque de couleur unie ajouté');
    });
    // onglets : réordonner, recevoir un calque d'un autre document
    tabs.addEventListener('dragstart', (e) => { const t = e.target.closest('.tab'); if (t) { e.dataTransfer.setData('text/x-doc', t.dataset.doc); e.dataTransfer.effectAllowed = 'move'; } });
    tabs.addEventListener('dragover', (e) => { const ty = [...e.dataTransfer.types]; if (ty.includes('text/x-doc') || ty.includes('text/x-layer') || ty.includes('Files')) { e.preventDefault(); const t = e.target.closest('.tab'); tabs.querySelectorAll('.tab').forEach((x) => x.classList.toggle('dropover', x === t)); if (t && ty.includes('text/x-layer')) { const doc = MP.docs.find((x) => x.id === +t.dataset.doc); if (doc && doc !== MP.doc) { clearTimeout(this._tt); this._tt = setTimeout(() => {}, 400); } } } });
    tabs.addEventListener('dragleave', () => tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('dropover')));
    tabs.addEventListener('drop', (e) => {
      tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('dropover'));
      const t = e.target.closest('.tab'), ty = [...e.dataTransfer.types]; if (!t) return;
      const target = MP.docs.find((x) => x.id === +t.dataset.doc); if (!target) return;
      if (ty.includes('text/x-doc')) { e.preventDefault(); e.stopPropagation(); const src = MP.docs.find((x) => x.id === +e.dataTransfer.getData('text/x-doc')); if (src && src !== target) { MP.docs.splice(MP.docs.indexOf(src), 1); MP.docs.splice(MP.docs.indexOf(target), 0, src); MP.ui.refreshTabs(); } return; }
      if (ty.includes('text/x-layer')) {
        e.preventDefault(); e.stopPropagation(); const from = this.dragDoc || MP.doc, l = from.byId(+e.dataTransfer.getData('text/x-layer'));
        if (!l || target === from) return; MP.layerOps.copyTo(l, from, target); MP.setDoc(target); MP.toast(`Calque « ${l.name} » copié dans ${target.name}`);
      }
    });
    // la zone de travail accepte une couleur (remplissage) ou un calque d'un autre document
    view.addEventListener('dragover', (e) => { const ty = [...e.dataTransfer.types]; if (ty.includes('text/x-color') || (ty.includes('text/x-layer') && this.dragDoc && this.dragDoc !== MP.doc)) e.preventDefault(); });
    view.addEventListener('drop', (e) => {
      const ty = [...e.dataTransfer.types]; if (!MP.doc) return;
      if (ty.includes('text/x-color')) { e.preventDefault(); e.stopPropagation(); this.fillAt(e.dataTransfer.getData('text/x-color'), MP.view.toDoc(e.clientX, e.clientY)); }
      else if (ty.includes('text/x-layer') && this.dragDoc && this.dragDoc !== MP.doc) { e.preventDefault(); e.stopPropagation(); const l = this.dragDoc.byId(+e.dataTransfer.getData('text/x-layer')); if (l) { MP.layerOps.copyTo(l, this.dragDoc, MP.doc); MP.afterEdit(); } }
    });
    // couleurs glissables (nuancier, couleurs de premier plan / arrière-plan)
    document.addEventListener('dragstart', (e) => {
      const sw = e.target.closest && e.target.closest('.swatch:not(.add), .sw, .pc-sw');
      if (!sw) return; const c = sw.classList.contains('fg') || sw.dataset.t === 'fg' ? MP.colors.fg : sw.classList.contains('bg') || sw.dataset.t === 'bg' ? MP.colors.bg : sw.title.split(' ')[0];
      e.dataTransfer.setData('text/x-color', c); e.dataTransfer.effectAllowed = 'copy';
    });
    const swatchTargets = () => document.querySelectorAll('#toolcolors .sw, .pc-sw');
    document.addEventListener('dragover', (e) => { if (e.target.closest && e.target.closest('#toolcolors .sw, .pc-sw') && [...e.dataTransfer.types].includes('text/x-color')) e.preventDefault(); });
    document.addEventListener('drop', (e) => {
      const t = e.target.closest && e.target.closest('#toolcolors .sw, .pc-sw'); if (!t) return; const c = e.dataTransfer.getData('text/x-color'); if (!c) return;
      e.preventDefault(); e.stopPropagation(); MP.colors[t.classList.contains('bg') || t.dataset.t === 'bg' ? 'bg' : 'fg'] = c; MP.ui.refreshColors();
    }, true);
    void swatchTargets;
    const mark = () => { document.querySelectorAll('.swatch:not(.add), #toolcolors .sw, .pc-sw').forEach((s) => s.setAttribute('draggable', 'true')); };
    mark(); new MutationObserver(mark).observe(document.getElementById('panels'), { childList: true, subtree: true });
  },
};

/* =================== Nouveaux outils =================== */
{
  const T4 = (t) => { MP.tools[t.id] = t; t.opts = MP.settings.tools[t.id] = Object.assign({}, t.defaults || {}); MP.toolOrder.push(t.id); return t; };
  /* Pinceau mélangeur */
  T4({
    id: 'mixer', name: 'Pinceau mélangeur', icon: 'mixer', cursor: 'none',
    defaults: { size: 40, wet: 50, load: 50, mix: 50, clean: true },
    options: [{ k: 'size', label: 'Taille', type: 'range', min: 2, max: 400, unit: 'px' }, { k: 'wet', label: 'Humide', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'load', label: 'Charge', type: 'range', min: 1, max: 100, unit: '%' }, { k: 'mix', label: 'Mélange', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'clean', label: 'Nettoyer le pinceau après chaque tracé', type: 'check' }],
    hint: 'Mélange la couleur de premier plan avec les couleurs de l\'image, comme de la peinture fraîche',
    brushCursor() { return this.opts.size; },
    down(p) {
      const d = MP.doc; if (!MP.canEditPixels()) return;
      d.history.record(this.name, [d.layer.id]); MP.rasterize(d.layer);
      if (this.opts.clean || !this.car) { const R = Math.ceil(this.opts.size / 2) + 2, S = R * 2 + 1, c = MP.hexToRgb(MP.colors.fg), a = new Float32Array(S * S * 4); for (let i = 0; i < S * S; i++) { a[i * 4] = c.r; a[i * 4 + 1] = c.g; a[i * 4 + 2] = c.b; a[i * 4 + 3] = 255; } this.car = { R, S, a }; }
      this.eng = new MP.StrokeEngine(d, this.opts.size * 0.15, (c, x, y) => this.dab(x, y)); this.eng.to(p); MP.render();
    },
    dab(x, y) {
      const d = MP.doc, cv = d.layer.canvas, r = this.opts.size / 2, C = this.car, R = C.R;
      const x0 = Math.max(0, Math.round(x) - R), y0 = Math.max(0, Math.round(y) - R), w = Math.min(cv.width, Math.round(x) + R + 1) - x0, h = Math.min(cv.height, Math.round(y) + R + 1) - y0; if (w <= 0 || h <= 0) return;
      const ctx = cv.getContext('2d'), id = ctx.getImageData(x0, y0, w, h), A = id.data, wet = this.opts.wet / 100, load = this.opts.load / 100, mix = this.opts.mix / 100, fg = MP.hexToRgb(MP.colors.fg);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const gx = x0 + xx, gy = y0 + yy, dist = Math.hypot(gx + 0.5 - x, gy + 0.5 - y) / r; if (dist > 1) continue;
        const f = (1 - dist * dist) * 0.6, i = (yy * w + xx) * 4, lx = gx - Math.round(x) + R, ly = gy - Math.round(y) + R; if (lx < 0 || ly < 0 || lx >= C.S || ly >= C.S) continue;
        const q = (ly * C.S + lx) * 4;
        for (let k = 0; k < 3; k++) { const paint = MP.lerp(C.a[q + k], [fg.r, fg.g, fg.b][k], (1 - wet) * load * 0.15); const out = MP.lerp(A[i + k], paint, f * (1 - mix * 0.7)); A[i + k] = out; C.a[q + k] = MP.lerp(paint, A[i + k], wet * 0.35); }
        A[i + 3] = Math.max(A[i + 3], 255 * f * load);
      }
      ctx.putImageData(id, x0, y0); d.layer._v = (d.layer._v || 0) + 1;
    },
    move(p) { if (this.eng) { this.eng.to(p); MP.render(); } },
    up() { if (this.eng) { this.eng = null; MP.afterEdit(); } },
    cancel() { this.eng = null; },
  });
  /* Plumes libre et de courbure (créent le même tracé que la Plume) */
  const pathOpts = () => MP.tools.pen.options;
  const smoothPath = (pts, closed) => {
    const n = pts.length, P = (i) => pts[closed ? (i + n) % n : MP.clamp(i, 0, n - 1)];
    return pts.map((p, i) => { const a = P(i - 1), b = P(i + 1), tx = (b.x - a.x) / 6, ty = (b.y - a.y) / 6; return { x: p.x, y: p.y, ix: p.x - tx, iy: p.y - ty, ox: p.x + tx, oy: p.y + ty }; });
  };
  const rdp = (pts, eps) => {
    if (pts.length < 3) return pts; const a = pts[0], b = pts[pts.length - 1]; let mx = 0, mi = 0;
    for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], dd = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / (Math.hypot(b.y - a.y, b.x - a.x) || 1); if (dd > mx) { mx = dd; mi = i; } }
    return mx > eps ? [...rdp(pts.slice(0, mi + 1), eps).slice(0, -1), ...rdp(pts.slice(mi), eps)] : [a, b];
  };
  T4({
    id: 'freepen', name: 'Plume libre', icon: 'freepen', cursor: 'crosshair', hint: 'Dessinez librement : le tracé est lissé en courbes de Bézier (Entrée = sélection)',
    get options() { return pathOpts(); },
    down(p) { this.pts = [p]; MP.renderView(); },
    move(p) { if (!this.pts) return; const l = this.pts[this.pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) * MP.doc.zoom > 2) { this.pts.push(p); MP.renderView(); } },
    up() {
      if (!this.pts) return; const d = MP.doc, raw = this.pts; this.pts = null; if (raw.length < 3) return;
      const f = raw[0], l = raw[raw.length - 1], closed = Math.hypot(f.x - l.x, f.y - l.y) * d.zoom < 14;
      const s = rdp(raw, 1.8 / Math.min(1, d.zoom)); if (closed) s.pop();
      d.path = { pts: smoothPath(s, closed), closed }; MP.render();
    },
    onKey(e) { return MP.tools.pen.onKey(e); },
    overlay(ctx) { if (this.pts) { MP.overlayDocTransform(ctx); ctx.lineWidth = 1.5 / MP.doc.zoom; ctx.strokeStyle = '#2d8cff'; ctx.beginPath(); this.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); } else MP.tools.pen.overlay.call(MP.tools.pen, ctx); },
  });
  T4({
    id: 'curvpen', name: 'Plume de courbure', icon: 'curvpen', cursor: 'crosshair', hint: 'Cliquez des points : les courbes se forment automatiquement. Clic sur le 1er point = fermer, glisser un point = le déplacer',
    get options() { return pathOpts(); },
    rebuild() { const d = MP.doc; d.path = { pts: smoothPath(this.raw, this.closed), closed: this.closed }; },
    down(p) {
      const d = MP.doc, z = d.zoom;
      if (!this.raw || !d.path || this.doc !== d) { this.raw = []; this.closed = false; this.doc = d; }
      const i = this.raw.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) * z < 8);
      if (i === 0 && !this.closed && this.raw.length > 2) { this.closed = true; this.rebuild(); MP.render(); return; }
      if (i >= 0) { this.drag = i; return; }
      if (this.closed) { this.raw = []; this.closed = false; }
      this.raw.push({ x: p.x, y: p.y }); this.rebuild(); MP.render();
    },
    move(p) { if (this.drag != null) { this.raw[this.drag] = { x: p.x, y: p.y }; this.rebuild(); MP.renderView(); } },
    up() { this.drag = null; },
    dbl() { if (this.raw && this.raw.length > 1) { this.raw = null; MP.toast('Tracé terminé — Entrée pour le convertir en sélection'); } },
    onKey(e) { if (e.key === 'Backspace' && this.raw && this.raw.length) { this.raw.pop(); this.raw.length ? this.rebuild() : (MP.doc.path = null); MP.render(); return true; } if (e.key === 'Escape') { this.raw = null; } return MP.tools.pen.onKey(e); },
    overlay(ctx) { MP.tools.pen.overlay.call(MP.tools.pen, ctx); },
  });
  /* Masque de texte (sélection en forme de texte) */
  T4({
    id: 'typemask', name: 'Masque de texte horizontal', icon: 'typemask', cursor: 'text', hint: 'Cliquez pour écrire : le texte devient une sélection (à remplir, à masquer…)',
    defaults: { font: 'Arial Black', size: 120, bold: true },
    options: [{ k: 'font', label: 'Police', type: 'select', options: MP.FONTS.map((f) => [f, f]) }, { k: 'size', label: 'Taille', type: 'number', min: 4, max: 3000 }, { k: 'bold', label: 'Gras', type: 'check' }],
    down(p, e) {
      const d = MP.doc, o = this.opts, mode = e.shiftKey ? 'add' : e.altKey ? 'sub' : 'new';
      UI.dialog({ title: 'Masque de texte', fields: [{ k: 't', label: 'Texte', type: 'textarea', rows: 3 }, { k: 'vertical', label: 'Vertical', type: 'check' }], values: { t: 'TEXTE', vertical: false }, onOk: (v) => {
        if (!v.t.trim()) return; const l = new MP.Layer(d.width, d.height, 'tmp');
        l.text = { x: Math.round(p.x), y: Math.round(p.y), content: v.t, font: o.font, size: +o.size, bold: o.bold, italic: false, underline: false, color: '#fff', align: 'left', lineHeight: 1.1, spacing: 0, stroke: false, strokeColor: '#000', strokeWidth: 0, shadow: false, vertical: v.vertical };
        MP.renderText(l); d.history.record('Masque de texte', null); MP.sel.fromMask(d, l.canvas, mode); MP.ui.refreshAll(); MP.render();
      } });
    },
  });
  /* Comptage */
  T4({
    id: 'count', name: 'Comptage', icon: 'count', cursor: 'crosshair', hint: 'Cliquez pour numéroter des éléments (Alt + clic : retirer)',
    defaults: { color: '#ff3b30', size: 14 },
    options: [{ k: 'color', label: 'Couleur', type: 'color' }, { k: 'size', label: 'Taille', type: 'number', min: 8, max: 80 }, { k: 'clr', label: 'Effacer', type: 'button', action: () => { if (MP.doc) { MP.doc.counts = []; MP.renderView(); MP.ui.refreshInfo(); } } }],
    down(p, e) {
      const d = MP.doc; d.counts = d.counts || [];
      if (e.altKey) { const i = d.counts.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) * d.zoom < 12); if (i >= 0) d.counts.splice(i, 1); }
      else d.counts.push({ x: p.x, y: p.y });
      d.markDirty(); MP.renderView(); MP.ui.refreshInfo(); MP.ui.setInfo(`Total : ${d.counts.length}`);
    },
  });
  /* Notes */
  T4({
    id: 'note', name: 'Note', icon: 'note', cursor: 'crosshair', hint: 'Cliquez pour ajouter une note (non imprimée, enregistrée dans le projet)',
    options: [{ k: 'clr', label: 'Supprimer toutes les notes', type: 'button', action: () => { if (MP.doc) { MP.doc.notes = []; MP.renderView(); } } }],
    down(p) {
      const d = MP.doc; d.notes = d.notes || [];
      const n = d.notes.find((x) => Math.hypot(x.x - p.x, x.y - p.y) * d.zoom < 14);
      UI.dialog({ title: n ? 'Modifier la note' : 'Nouvelle note', fields: [{ k: 't', label: 'Note', type: 'textarea', rows: 5 }, ...(n ? [{ k: 'del', label: 'Supprimer cette note', type: 'check' }] : [])], values: { t: n ? n.text : '', del: false },
        onOk: (v) => { if (n) { if (v.del || !v.t.trim()) d.notes.splice(d.notes.indexOf(n), 1); else n.text = v.t; } else if (v.t.trim()) d.notes.push({ x: p.x, y: p.y, text: v.t }); d.markDirty(); MP.renderView(); } });
    },
  });
  // ranger les nouveaux outils dans les groupes de la barre
  const add = (key, ids) => { const s = UI.SLOTS.find((x) => x.key === key); if (s) s.tools.push(...ids); };
  add('B', ['mixer']); add('P', ['freepen', 'curvpen']); add('T', ['typemask']); add('I', ['count', 'note']);
}
/* dessin des comptages et des notes */
{
  const ds = MP.drawSamplers;
  MP.drawSamplers = (ctx, d) => {
    ds(ctx, d);
    const dpr = MP.view.dpr;
    if (d.counts && d.counts.length) {
      const o = MP.tools.count.opts; ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = `bold ${o.size}px Segoe UI, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      d.counts.forEach((c, i) => { const q = MP.docToScreen(c); ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(q.x, q.y, o.size * 0.28, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(String(i + 1), q.x + o.size * 0.8, q.y - o.size * 0.6); ctx.fillText(String(i + 1), q.x + o.size * 0.8, q.y - o.size * 0.6); });
      ctx.restore();
    }
    if (d.notes && d.notes.length) {
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = '12px Segoe UI, sans-serif';
      for (const n of d.notes) {
        const q = MP.docToScreen(n); ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#7a5d00'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + 16, q.y); ctx.lineTo(q.x + 22, q.y + 6); ctx.lineTo(q.x + 22, q.y + 20); ctx.lineTo(q.x, q.y + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
        const c = MP.view.cursor; if (c && Math.hypot(c.x - n.x - 11 / d.zoom, c.y - n.y - 10 / d.zoom) * d.zoom < 16) {
          const lines = n.text.split('\n').slice(0, 8), w = Math.min(320, Math.max(...lines.map((s) => ctx.measureText(s).width)) + 16);
          ctx.fillStyle = 'rgba(30,30,34,.95)'; ctx.fillRect(q.x + 26, q.y, w, lines.length * 16 + 10); ctx.fillStyle = '#fff'; lines.forEach((s, i) => ctx.fillText(s, q.x + 34, q.y + 18 + i * 16));
        }
      }
      ctx.restore();
    }
  };
  const ri = UI.refreshInfo;
  UI.refreshInfo = () => { ri(); const d = MP.doc, box = $('#infobox'); if (d && box && d.counts && d.counts.length) box.insertAdjacentHTML('beforeend', `<div class="ir"><b>Comptage</b> ${d.counts.length}</div>`); };
}

/* =================== Filtres neuronaux locaux, remplacement de couleur, mode niveaux de gris =================== */
Object.assign(MP.FILTERS, {
  skin: { title: 'Peau lisse', heavy: true, fields: [{ k: 'k', label: 'Lissage', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'r', label: 'Flou', type: 'range', min: 1, max: 6, unit: 'px' }], values: { k: 70, r: 3 },
    render(src, v) {
      const w = src.width, h = src.height, sm = MP.FILTERS.surface.render(src, { r: v.r, t: 14 }).getContext('2d').getImageData(0, 0, w, h).data, s = src.getContext('2d').getImageData(0, 0, w, h).data;
      const m = MP.createCanvas(w, h), mc = m.getContext('2d'), id = mc.createImageData(w, h);
      for (let i = 0; i < s.length; i += 4) { const r = s[i], g = s[i + 1], b = s[i + 2], cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b; const skin = cb > 77 && cb < 127 && cr > 133 && cr < 173 ? 255 : 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = skin; }
      mc.putImageData(id, 0, 0); const mk = MP.sel.blurred(m, 4).getContext('2d').getImageData(0, 0, w, h).data;
      const o = MP.createCanvas(w, h), oc = o.getContext('2d'), od = oc.createImageData(w, h), k = v.k / 100;
      for (let i = 0; i < s.length; i += 4) { const a = (mk[i + 3] / 255) * k; for (let c = 0; c < 3; c++) od.data[i + c] = MP.lerp(s[i + c], sm[i + c], a); od.data[i + 3] = s[i + 3]; }
      oc.putImageData(od, 0, 0); return o;
    } },
  jpeg: { title: 'Suppression des artefacts JPEG', heavy: true, fields: [{ k: 't', label: 'Intensité', type: 'range', min: 1, max: 40 }], values: { t: 10 }, render: (src, v) => MP.FILTERS.surface.render(src, { r: 2, t: v.t }) },
});
MP.ADJUST.replaceColor = {
  title: 'Remplacement de couleur', values: { c: '#d03030', tol: 40, h: 120, s: 0, l: 0 },
  fields: [{ k: 'c', label: 'Couleur à remplacer', type: 'color' }, { k: 'tol', label: 'Tolérance', type: 'range', min: 1, max: 100 }, { k: 'h', label: 'Teinte', type: 'range', min: -180, max: 180 }, { k: 's', label: 'Saturation', type: 'range', min: -100, max: 100 }, { k: 'l', label: 'Luminosité', type: 'range', min: -100, max: 100 }],
  pixel(s, d, v) {
    const c = MP.hexToRgb(v.c), T = v.tol * 2.2;
    for (let i = 0; i < s.length; i += 4) {
      const dist = Math.hypot(s[i] - c.r, s[i + 1] - c.g, s[i + 2] - c.b), w = dist >= T ? 0 : 1 - Math.pow(dist / T, 2);
      if (w <= 0) { d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3]; continue; }
      let [H, S, L] = MP.rgbToHsl(s[i], s[i + 1], s[i + 2]); H = (H + v.h / 360 + 1) % 1; S = MP.clamp(S * (1 + v.s / 100), 0, 1); L = MP.clamp(L + (v.l / 100) * (v.l > 0 ? 1 - L : L), 0, 1);
      const [r, g, b] = MP.hslToRgb(H, S, L); d[i] = MP.lerp(s[i], r, w); d[i + 1] = MP.lerp(s[i + 1], g, w); d[i + 2] = MP.lerp(s[i + 2], b, w); d[i + 3] = s[i + 3];
    }
  },
};
MP.ADJ_LAYER_KEYS.push('replaceColor');
MP.cmd.grayscale = () => {
  const d = MP.doc; d.history.record('Mode Niveaux de gris', 'all');
  for (const l of d.layers) if (!l.isGroup && !l.adjust) { const c = l.ctx, id = c.getImageData(0, 0, d.width, d.height), a = id.data; for (let i = 0; i < a.length; i += 4) { const y = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114; a[i] = a[i + 1] = a[i + 2] = y; } c.putImageData(id, 0, 0); l.text = null; }
  MP.afterEdit(); MP.toast('Image convertie en niveaux de gris');
};
MP.ai.generateBackground = function (prompt) {
  const d = MP.doc;
  return this.run('Générer un arrière-plan', async () => {
    const src = MP.cloneCanvas(d.composite(null, { noLive: true })), subject = await this.subjectAlpha(src);
    const keep = MP.createCanvas(d.width, d.height), kc = keep.getContext('2d'); kc.fillStyle = '#000'; kc.globalAlpha = 1; kc.drawImage(subject, 0, 0); kc.globalCompositeOperation = 'source-in'; kc.fillRect(0, 0, d.width, d.height);
    const out = await this.edit(src, keep, (prompt || 'A beautiful, realistic background') + '. Keep the main subject exactly identical; replace only the background with matching lighting and perspective.');
    d.history.record('Générer un arrière-plan', null); d.active = d.layers.length - 1;
    const l = d.addLayer('Arrière-plan IA : ' + (prompt || '').slice(0, 24)); l.parent = null; l.ctx.imageSmoothingQuality = 'high'; l.ctx.drawImage(out, 0, 0, d.width, d.height);
    const inv = MP.createCanvas(d.width, d.height), ic = inv.getContext('2d'); ic.fillStyle = '#fff'; ic.fillRect(0, 0, d.width, d.height); ic.globalCompositeOperation = 'destination-out'; ic.drawImage(subject, 0, 0); l.mask = inv;
    d.normalize(); MP.afterEdit(); MP.ui.refreshAll();
  });
};

/* =================== Recherche de commandes (Ctrl+F) =================== */
UI.allCommands = () => {
  const out = [], walk = (items, path) => items.forEach((it) => { if (!it || it === '-') return; const lb = typeof it.label === 'function' ? it.label() : it.label; if (it.sub) walk(it.sub(), [...path, lb]); else if (!it.disabled && it.act) out.push({ path: [...path, lb], act: it.act, sc: it.sc }); });
  UI.menus().forEach((m) => walk(m.items, [m.label]));
  for (const id of MP.toolOrder) { const t = MP.tools[id]; if (!t.hidden) out.push({ path: ['Outil', t.name], act: () => MP.setTool(id), sc: t.key }); }
  return out;
};
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
UI.commandSearch = () => {
  if (document.querySelector('.cmdsearch')) return;
  const all = UI.allCommands(), back = el('div', { class: 'modal-back' }), box = el('div', { class: 'cmdsearch' }), inp = el('input', { placeholder: 'Rechercher une commande, un outil, un filtre… (ex. « flou », « ciel », « courbes »)' }), list = el('div', { class: 'cs-list' });
  box.append(inp, list); back.appendChild(box); document.body.appendChild(back);
  let res = [], sel = 0;
  const draw = () => {
    const q = norm(inp.value.trim()).split(/\s+/).filter(Boolean);
    res = all.filter((c) => { const t = norm(c.path.join(' ')); return q.every((w) => t.includes(w)); }).slice(0, 40); sel = Math.min(sel, Math.max(0, res.length - 1));
    list.innerHTML = ''; res.forEach((c, i) => { const r = el('div', { class: 'cs-item' + (i === sel ? ' on' : '') }, `<span>${esc(c.path.at(-1))}</span><small>${esc(c.path.slice(0, -1).join(' › '))}</small><kbd>${c.sc ? esc(c.sc) : ''}</kbd>`); r.onclick = () => run(i); list.appendChild(r); });
    if (!res.length) list.innerHTML = '<div class="cs-empty">Aucun résultat</div>';
  };
  const close = () => back.remove();
  const run = (i) => { const c = res[i]; if (!c) return; close(); setTimeout(() => UI.exec(c.path, c.act), 0); };
  inp.addEventListener('input', () => { sel = 0; draw(); });
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } else if (e.key === 'Enter') run(sel); else if (e.key === 'Escape') close(); });
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  draw(); setTimeout(() => inp.focus(), 20);
};

/* =================== Panneau Actions (enregistrement / lecture de commandes) =================== */
MP.actions = {
  list: (() => { try { const s = JSON.parse(localStorage.getItem('mp.actions') || 'null'); if (s) return s; } catch (_) { /* */ } return [
    { name: 'Retouche rapide (contraste + netteté)', steps: [['Image', 'Contraste automatique'], ['Filtre', 'Renforcement', 'Plus net']] },
    { name: 'Noir et blanc contrasté', steps: [['Image', 'Réglages', 'Désaturation'], ['Image', 'Contraste automatique']] },
    { name: 'Vintage sépia', steps: [['Image', 'Réglages', 'Sépia'], ['Filtre', 'Rendu', 'Vignettage…']] },
    { name: 'Look cinéma (LUT + grain)', steps: [['Calque', 'Nouveau calque de réglage', 'Correspondance de couleurs (LUT)…'], ['Calque', 'Nouveau calque de réglage', 'Grain…']] },
  ]; })(),
  sel: 0,
  save() { try { localStorage.setItem('mp.actions', JSON.stringify(this.list)); } catch (_) { /* */ } },
  find(path) {
    let items = UI.menus().find((m) => m.label === path[0]); if (!items) return null; items = items.items;
    for (let i = 1; i < path.length; i++) {
      const it = items.find((x) => x && x !== '-' && (typeof x.label === 'function' ? x.label() : x.label) === path[i]); if (!it) return null;
      if (i === path.length - 1) return it.act; items = it.sub ? it.sub() : [];
    }
    return null;
  },
  async play(a) {
    if (!MP.doc) { MP.toast('Ouvrez une image avant de lancer une action'); return; }
    for (const step of a.steps) {
      const act = this.find(step); if (!act) { MP.toast('Étape introuvable : ' + step.join(' › '), 4000); return; }
      await act();
      // attendre la fermeture des boîtes de dialogue et des calculs
      await new Promise((r) => { const t = setInterval(() => { if (!UI.dialogOpen && !document.querySelector('#busy.show') && !document.querySelector('.liq')) { clearInterval(t); r(); } }, 120); });
    }
    MP.toast('Action terminée : ' + a.name);
  },
  render() {
    const box = $('#actionslist'); if (!box) return; box.innerHTML = '';
    this.list.forEach((a, i) => {
      const r = el('div', { class: 'act-item' + (i === this.sel ? ' on' : '') }, `<b>${esc(a.name)}</b><small>${a.steps.map((s) => esc(s.at(-1))).join(' → ') || '(vide)'}</small>`);
      r.onclick = () => { this.sel = i; this.render(); }; r.ondblclick = () => this.play(a); box.appendChild(r);
    });
    $('#act-rec').classList.toggle('rec', !!UI.rec);
  },
  init() {
    const p = el('section', { class: 'panel collapsed', id: 'panel-actions' }, `<h3>Actions</h3><div class="body"><div id="actionslist"></div><div class="act-btns">
      <button class="ibtn" id="act-play" title="Exécuter l'action sélectionnée">▶</button><button class="ibtn" id="act-rec" title="Enregistrer les commandes de menu dans une nouvelle action">●</button><button class="ibtn" id="act-stop" title="Arrêter l'enregistrement">■</button><button class="ibtn" id="act-del" title="Supprimer l'action">${MP.icon('trash', 15)}</button></div></div>`);
    $('#panels').insertBefore(p, $('#panel-history'));
    p.querySelector('h3').addEventListener('click', () => p.classList.toggle('collapsed'));
    $('#act-play').onclick = () => { const a = this.list[this.sel]; if (a) this.play(a); };
    $('#act-rec').onclick = () => UI.dialog({ title: 'Nouvelle action', fields: [{ k: 'n', label: 'Nom', type: 'text' }, { type: 'info', html: 'Toutes les commandes lancées depuis les menus (ou leurs raccourcis) seront enregistrées jusqu\'à ce que vous cliquiez sur ■.' }], values: { n: 'Action ' + (this.list.length + 1) }, onOk: (v) => { UI.rec = []; this.recName = v.n; this.render(); MP.toast('Enregistrement en cours…'); } });
    $('#act-stop').onclick = () => { if (!UI.rec) return; if (UI.rec.length) { this.list.push({ name: this.recName, steps: UI.rec }); this.sel = this.list.length - 1; this.save(); MP.toast(`Action enregistrée (${UI.rec.length} étape(s))`); } UI.rec = null; this.render(); };
    $('#act-del').onclick = () => { if (!this.list[this.sel]) return; this.list.splice(this.sel, 1); this.sel = Math.max(0, this.sel - 1); this.save(); this.render(); };
    this.render();
  },
};

/* =================== Menus : ajouts v4 + menu Fenêtre =================== */
{
  const find = (items, start) => items.findIndex((x) => x && x !== '-' && (typeof x.label === 'function' ? x.label() : x.label).startsWith(start));
  const menus0 = UI.menus;
  const panelToggle = (id, name) => ({ label: () => (document.getElementById(id) && !document.getElementById(id).classList.contains('collapsed') ? '✓ ' : '') + name, act: () => { const p = document.getElementById(id); p.classList.toggle('collapsed'); p.scrollIntoView({ block: 'nearest' }); MP.ui.navigatorDirty(); } });
  UI.menus = () => {
    const m = menus0(), M = (l) => m.find((x) => x.label === l).items;
    const ed = M('Édition'); ed.splice(find(ed, 'Couper'), 0, { label: 'Rechercher une commande…', sc: 'Ctrl+F', act: () => UI.commandSearch() }, '-');
    ed.splice(find(ed, 'Transformation manuelle'), 1, { label: 'Transformation', sub: () => [{ label: 'Transformation manuelle', sc: 'Ctrl+T', act: need(() => MP.startTransform()) }, { label: 'Perspective / Torsion', act: need(() => { MP.startTransform(); if (MP.tool === MP.tools.transform) MP.tools.transform.toggleDistort(); }) }, { label: 'Déformation (grille)', act: need(() => { MP.startTransform(); if (MP.tool === MP.tools.transform) MP.tools.transform.toggleWarp(); }) }, '-', { label: 'Symétrie horizontale du calque', act: need(() => MP.flipImage(true, true)) }, { label: 'Symétrie verticale du calque', act: need(() => MP.flipImage(false, true)) }] });
    const im = M('Image'); im.splice(0, 0, { label: 'Mode', sub: () => [{ label: 'Couleurs RVB (actuel)', disabled: true }, { label: 'Convertir en niveaux de gris', act: need(() => MP.cmd.grayscale()) }] }, '-');
    const reg = im.find((x) => x && x.label === 'Réglages'); const regSub = reg.sub; reg.sub = () => [...regSub(), '-', { label: 'Remplacement de couleur…', act: need(() => MP.runAdjust('replaceColor')) }];
    const ca = M('Calque'), gi = find(ca, 'Supprimer le calque');
    ca.splice(gi + 1, 0, { label: 'Calque par couper', sc: 'Ctrl+Maj+J', act: need(() => MP.layerOps.viaCut()) }, { label: 'Créer / libérer un masque d\'écrêtage', sc: 'Ctrl+Alt+G', act: need(() => MP.layerOps.toggleClip()) }, { label: 'Verrouiller les pixels transparents', sc: '/', act: need(() => MP.layerOps.toggleLockAlpha()) }, { label: 'Couleur d\'étiquette', sub: () => LABELS.map(([n, c]) => ({ label: n, act: need(() => MP.layerOps.setLabel(c)) })) });
    const st = ca.find((x) => x && x.label === 'Style de calque'); const stSub = st.sub; st.sub = () => [...stSub(), '-', { label: 'Copier le style de calque', act: need(() => MP.layerOps.copyStyle()) }, { label: 'Coller le style de calque', act: need(() => MP.layerOps.pasteStyle()) }];
    ca.push('-', { label: 'Exporter le calque en PNG…', act: need(() => MP.layerOps.exportPng()) });
    const fi = M('Filtre'); fi.splice(find(fi, 'Galerie de filtres') + 1, 0, { label: 'Filtres neuronaux', sub: () => [{ label: 'Peau lisse…', act: need(() => MP.runAdjust('skin', true)) }, { label: 'Suppression des artefacts JPEG…', act: need(() => MP.runAdjust('jpeg', true)) }, '-', { label: '✨ Coloriser (IA)', act: need(() => MP.ai.colorize()) }, { label: '✨ Générer un arrière-plan (IA)…', act: need(() => UI.dialogs.genBg()) }] });
    const ia = M('IA'); ia.splice(find(ia, '✨ Supprimer'), 0, { label: '✨ Générer un arrière-plan…', act: need(() => UI.dialogs.genBg()) });
    const aide = m.findIndex((x) => x.label === 'Aide');
    m.splice(aide, 0, { label: 'Fenêtre', items: [
      { label: 'Rechercher une commande…', sc: 'Ctrl+F', act: () => UI.commandSearch() }, '-',
      panelToggle('panel-actions', 'Actions'), panelToggle('panel-nav', 'Navigation'), panelToggle('panel-info', 'Info'), panelToggle('panel-histo', 'Histogramme'), panelToggle('panel-color', 'Couleur'), panelToggle('panel-swatches', 'Nuancier'), panelToggle('panel-history', 'Historique'), panelToggle('panel-layers', 'Calques'),
      '-', { label: () => (document.body.classList.contains('light') ? '✓ ' : '') + 'Thème clair', act: () => { document.body.classList.toggle('light'); MP.prefs.theme = document.body.classList.contains('light') ? 'light' : 'dark'; MP.savePrefs(); MP.renderView(); } },
      { label: 'Réinitialiser l\'espace de travail', act: () => { ['panel-nav', 'panel-info', 'panel-histo', 'panel-swatches', 'panel-actions'].forEach((id) => document.getElementById(id)?.classList.add('collapsed')); ['panel-color', 'panel-history', 'panel-layers'].forEach((id) => document.getElementById(id)?.classList.remove('collapsed')); } },
    ] });
    return m;
  };
  UI.dialogs.genBg = () => UI.dialog({ title: '✨ Générer un arrière-plan', width: 440, okLabel: 'Générer', fields: [{ type: 'info', html: 'Le sujet principal est conservé, le décor derrière lui est remplacé par celui que vous décrivez (nouveau calque avec masque).' }, { k: 'p', label: 'Décor souhaité', type: 'textarea', rows: 3 }], values: { p: 'Studio photo, fond dégradé doux, lumière professionnelle' }, onOk: (v) => { MP.ai.generateBackground(v.p); } });
}

/* =================== Initialisation v4 =================== */
MP.v4init = () => {
  if (MP.prefs.theme === 'light') document.body.classList.add('light');
  MP.dnd.init(); MP.actions.init();
  const cv = MP.view.canvas;
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (MP.doc && MP.tool && MP.tool.brushCursor && !e.shiftKey) UI.brushPopup(e.clientX, e.clientY); else UI.canvasMenu(e.clientX, e.clientY); });
  $('#viewport').addEventListener('contextmenu', (e) => { if (e.target === cv) return; e.preventDefault(); UI.canvasMenu(e.clientX, e.clientY); });
  $('#layerlist').addEventListener('contextmenu', (e) => { const row = e.target.closest('.layer'); if (!row || !MP.doc) return; e.preventDefault(); UI.layerMenu(e.clientX, e.clientY, MP.doc.byId(+row.dataset.id)); });
  $('#tabs').addEventListener('contextmenu', (e) => { const t = e.target.closest('.tab'); if (!t) return; e.preventDefault(); const d = MP.docs.find((x) => x.id === +t.dataset.doc); if (d) UI.tabMenu(e.clientX, e.clientY, d); });
  document.addEventListener('keydown', (e) => {
    if (UI.dialogOpen || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === '/' && !e.ctrlKey && MP.doc) { e.preventDefault(); MP.layerOps.toggleLockAlpha(); }
  });
};
