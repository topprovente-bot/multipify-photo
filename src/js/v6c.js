'use strict';
/* v6 (interface) — menus et boîtes de dialogue des nouvelles fonctions, panneaux Compositions / Bibliothèques,
   barre de Montage, export tous formats, raccourcis et barre d'outils personnalisables, espaces de travail */

const flt6 = (k, f = true) => need(() => MP.runAdjust(k, f));
const dlg6 = (cfg) => MP.ui.dialog(cfg);
const lbl = (x) => (x && x !== '-' ? (typeof x.label === 'function' ? x.label() : x.label) : '');
const after = (items, start, ...add) => { const i = items.findIndex((x) => lbl(x).startsWith(start)); items.splice(i < 0 ? items.length : i + 1, 0, ...add); };
const vis6 = (id) => { const s = document.getElementById(id); return s && !s.classList.contains('collapsed') && !s.closest('.pgroup.min'); };

/* =================== Boîtes de dialogue =================== */
Object.assign(UI.dialogs, {
  exportAs() {
    const d = MP.doc;
    dlg6({ title: 'Exporter sous', width: 440, okLabel: 'Exporter…',
      fields: [{ k: 'format', label: 'Format', type: 'select', options: [['png', 'PNG (sans perte, transparence)'], ['jpeg', 'JPEG (photos)'], ['webp', 'WebP (web)'], ['gif', 'GIF (256 couleurs)'], ['bmp', 'BMP'], ['tiff', 'TIFF (RVB, sans perte)'], ['tiff-cmyk', 'TIFF CMJN (impression)'], ['pdf', 'PDF'], ['pdf-cmyk', 'PDF CMJN (impression)']] }, { k: 'quality', label: 'Qualité', type: 'range', min: 1, max: 100, unit: '%' }, { k: 'scale', label: 'Échelle', type: 'range', min: 5, max: 400, unit: '%' }, { k: 'multi', label: 'Exporter aussi en @2x et @3x (écrans Retina)', type: 'check' }, { k: 'bg', label: 'Fond', type: 'select', options: [['keep', 'Conserver la transparence'], ['white', 'Blanc']] }, { k: 'meta', label: 'Inclure les métadonnées (titre, auteur, copyright)', type: 'check' }, { type: 'info', html: `<p class="muted">Document : ${d.width} × ${d.height} px, ${d.dpi || 72} ppp. Les données EXIF et de localisation de l'appareil ne sont jamais exportées.</p>` }],
      values: { format: 'png', quality: 90, scale: 100, multi: false, bg: 'keep', meta: true },
      onOk: (v) => MP.busy('Exportation…', async () => { const files = [], base = d.name.replace(/\.[^.]+$/, ''); for (const k of v.multi ? [1, 2, 3] : [1]) { const r = await MP.encodeDoc(d, { ...v, scale: v.scale * k }); files.push({ name: base + (k > 1 ? '@' + k + 'x' : '') + '.' + r.ext, data: r.data }); } MP.outFiles(files, base); }) });
  },
  printPdf() {
    const d = MP.doc;
    dlg6({ title: 'Exporter en PDF pour l\'impression', width: 440, okLabel: 'Créer le PDF…',
      fields: [{ k: 'dpi', label: 'Résolution d\'impression (ppp)', type: 'number', min: 36, max: 1200 }, { k: 'cmyk', label: 'Convertir en CMJN (séparation standard, sans profil ICC)', type: 'check' }, { k: 'bleed', label: 'Fond perdu', type: 'range', min: 0, max: 10, step: 0.5, unit: 'mm' }, { k: 'marks', label: 'Traits de coupe', type: 'check' }, { k: 'quality', label: 'Qualité JPEG (RVB)', type: 'range', min: 50, max: 100, unit: '%' }, { type: 'info', html: `<p class="muted">Format fini : ${((d.width / (d.dpi || 300)) * 25.4).toFixed(1)} × ${((d.height / (d.dpi || 300)) * 25.4).toFixed(1)} mm à ${d.dpi || 300} ppp. Vérifiez toujours les exigences de votre imprimeur (profil, encrage maximal).</p>` }],
      values: { dpi: d.dpi && d.dpi > 72 ? d.dpi : 300, cmyk: true, bleed: 3, marks: true, quality: 95 },
      onOk: (v) => MP.busy('Création du PDF…', async () => { const data = await MP.enc.pdf([{ canvas: MP.flatComposite(d), dpi: +v.dpi }], { cmyk: v.cmyk, bleed: +v.bleed, marks: v.marks, meta: d.meta || {}, quality: v.quality / 100 }); const p = await MP.native.saveFile({ defaultPath: d.name.replace(/\.[^.]+$/, '') + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }], data }); if (p) MP.toast(`PDF créé (${(data.length / 1048576).toFixed(1)} Mo)`); }) });
  },
  fileInfo() {
    const d = MP.doc, m = (d.meta = d.meta || {}), ex = m.exif;
    const exHtml = ex ? `<table class="exif">${Object.entries({ make: 'Marque', model: 'Appareil', lens: 'Objectif', dateOriginal: 'Prise de vue', exposure: 'Vitesse', fnumber: 'Ouverture', iso: 'ISO', focal: 'Focale', artist: 'Auteur (EXIF)', copyright: 'Copyright (EXIF)' }).filter(([k]) => ex[k]).map(([k, n]) => `<tr><td>${n}</td><td>${esc(String(ex[k]))}</td></tr>`).join('')}</table>` : '<p class="muted">Aucune donnée EXIF.</p>';
    dlg6({ title: 'Informations sur le fichier', width: 480, fields: [{ k: 'title', label: 'Titre', type: 'text' }, { k: 'author', label: 'Auteur', type: 'text' }, { k: 'copyright', label: 'Copyright', type: 'text' }, { k: 'description', label: 'Description', type: 'textarea', rows: 3 }, { k: 'keywords', label: 'Mots-clés', type: 'text' }, { type: 'header', label: 'Données de l\'appareil (EXIF)' }, { type: 'info', html: exHtml }],
      values: { title: m.title || '', author: m.author || '', copyright: m.copyright || '', description: m.description || '', keywords: m.keywords || '' },
      onOk: (v) => { Object.assign(m, v); d.markDirty(); MP.toast('Métadonnées enregistrées (incluses dans les exports PNG, JPEG, TIFF et PDF)'); } });
  },
  resolution() {
    const d = MP.doc, dpi0 = d.dpi || 72;
    dlg6({ title: 'Résolution', width: 400, fields: [{ k: 'dpi', label: 'Résolution (ppp)', type: 'number', min: 1, max: 4800 }, { k: 'resample', label: 'Rééchantillonner (garder la taille imprimée)', type: 'check' }, { type: 'info', html: `<p class="muted">Taille imprimée actuelle : ${((d.width / dpi0) * 2.54).toFixed(2)} × ${((d.height / dpi0) * 2.54).toFixed(2)} cm</p>` }],
      values: { dpi: dpi0, resample: false },
      onOk: (v) => { const n = +v.dpi; if (v.resample && n !== dpi0) MP.resizeImage((d.width * n) / dpi0, (d.height * n) / dpi0, 'details'); else d.history.record('Résolution', null); d.dpi = n; d.markDirty(); MP.ui.refreshAll(); MP.toast(`Résolution : ${n} ppp — ${((d.width / n) * 2.54).toFixed(1)} × ${((d.height / n) * 2.54).toFixed(1)} cm`); } });
  },
  modeBitmap() { dlg6({ title: 'Mode Bitmap (1 bit)', width: 400, fields: [{ k: 'method', label: 'Méthode', type: 'select', options: [['diffusion', 'Diffusion'], ['threshold', 'Seuil 50 %'], ['pattern', 'Motif tramé'], ['halftone', 'Trame de demi-teintes']] }, { k: 'thr', label: 'Seuil', type: 'range', min: 1, max: 254 }, { k: 'cell', label: 'Taille de trame', type: 'range', min: 3, max: 40, unit: 'px' }, { type: 'info', html: '<p class="muted">L\'image sera aplatie.</p>' }], values: { method: 'diffusion', thr: 128, cell: 8 }, onOk: (v) => MP.busy('Conversion…', () => MP.colorMode.bitmap(v)) }); },
  modeIndexed() { dlg6({ title: 'Couleurs indexées', width: 400, fields: [{ k: 'colors', label: 'Couleurs', type: 'range', min: 2, max: 256 }, { k: 'dither', label: 'Tramage (diffusion)', type: 'check' }, { type: 'info', html: '<p class="muted">Palette optimisée (coupe médiane). L\'image sera aplatie.</p>' }], values: { colors: 64, dither: true }, onOk: (v) => MP.busy('Conversion…', () => MP.colorMode.indexed(v)) }); },
  modeDuotone() { dlg6({ title: 'Bichromie', width: 400, fields: [{ k: 'ink1', label: 'Encre 1', type: 'color' }, { k: 'ink2', label: 'Encre 2', type: 'color' }, { k: 'three', label: 'Trichromie (3e encre)', type: 'check' }, { k: 'ink3', label: 'Encre 3', type: 'color' }, { k: 'curve', label: 'Courbe de l\'encre 2', type: 'range', min: -50, max: 100 }], values: { ink1: '#1a1a1a', ink2: '#c08a3e', three: false, ink3: '#3d6f9e', curve: 30 }, onOk: (v) => MP.busy('Conversion…', () => MP.colorMode.duotone(v)) }); },
  blendOptions() {
    const d = MP.doc, l = d.layer; if (l.isGroup || l.adjust) { MP.toast('Options de fusion : sélectionnez un calque de pixels ou de texte'); return; }
    d.history.record('Options de fusion', null);
    const keep = { blend: l.blend, opacity: l.opacity, fill: l.fill, bi: l.blendIf ? { ...l.blendIf } : null };
    const bi = l.blendIf || { ch: 'gray', tLo: 0, tLoS: 0, tHi: 255, tHiS: 0, uLo: 0, uLoS: 0, uHi: 255, uHiS: 0 };
    const vals = { blend: l.blend, opacity: Math.round(l.opacity * 100), fill: Math.round((l.fill == null ? 1 : l.fill) * 100), ...bi };
    const R = (k, label) => ({ k, label, type: 'range', min: 0, max: 255 });
    const apply = (v) => { l.blend = v.blend; l.opacity = v.opacity / 100; l.fill = v.fill / 100; const B = { ch: v.ch, tLo: v.tLo, tLoS: v.tLoS, tHi: v.tHi, tHiS: v.tHiS, uLo: v.uLo, uLoS: v.uLoS, uHi: v.uHi, uHiS: v.uHiS }; l.blendIf = B.tLo || B.tHi < 255 || B.uLo || B.uHi < 255 ? B : null; l._v = (l._v || 0) + 1; MP.render(); };
    dlg6({ title: 'Options de fusion — ' + l.name, width: 460, preview: true, values: vals,
      fields: [{ type: 'header', label: 'Fusion générale' }, { k: 'blend', label: 'Mode', type: 'select', options: MP.BLEND_MODES }, { k: 'opacity', label: 'Opacité', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'fill', label: 'Opacité du fond', type: 'range', min: 0, max: 100, unit: '%' },
        { type: 'header', label: 'Fusion conditionnelle (« Fusion si »)' }, { k: 'ch', label: 'Couche', type: 'select', options: [['gray', 'Gris'], ['r', 'Rouge'], ['g', 'Vert'], ['b', 'Bleu']] },
        { type: 'info', html: '<b>Ce calque</b>' }, R('tLo', 'Noirs à partir de'), R('tLoS', '  ↳ transition'), R('tHi', 'Blancs jusqu\'à'), R('tHiS', '  ↳ transition'),
        { type: 'info', html: '<b>Calque sous-jacent</b>' }, R('uLo', 'Noirs à partir de'), R('uLoS', '  ↳ transition'), R('uHi', 'Blancs jusqu\'à'), R('uHiS', '  ↳ transition')],
      onChange: apply, onOk: (v) => { apply(v); MP.afterEdit(); },
      onCancel: () => { Object.assign(l, { blend: keep.blend, opacity: keep.opacity, fill: keep.fill, blendIf: keep.bi }); d.history.undoStack.pop(); MP.render(); } });
  },
  newArtboard() {
    const P = [['1080x1080', 'Instagram 1080 × 1080'], ['1080x1350', 'Instagram portrait 1080 × 1350'], ['1080x1920', 'Story 1080 × 1920'], ['1200x628', 'Publicité Facebook / Meta 1200 × 628'], ['300x250', 'Bannière Google 300 × 250'], ['728x90', 'Bannière Google 728 × 90'], ['160x600', 'Bannière Google 160 × 600'], ['1280x720', 'Miniature YouTube 1280 × 720'], ['1440x900', 'Écran web 1440 × 900'], ['390x844', 'Mobile 390 × 844'], ['custom', 'Personnalisé']];
    const v0 = { preset: '1080x1080', w: 1080, h: 1080, name: '', bg: '#ffffff', transparent: false, useDoc: !(MP.doc.artboards || []).length };
    dlg6({ title: 'Nouveau plan de travail', width: 420, values: v0, fields: [{ k: 'preset', label: 'Format', type: 'select', options: P }, { k: 'w', label: 'Largeur', type: 'number', min: 1, max: 20000 }, { k: 'h', label: 'Hauteur', type: 'number', min: 1, max: 20000 }, { k: 'name', label: 'Nom', type: 'text' }, { k: 'bg', label: 'Fond', type: 'color' }, { k: 'transparent', label: 'Fond transparent', type: 'check' }, { k: 'useDoc', label: 'Le document actuel devient le premier plan de travail', type: 'check' }],
      onChange: (v, k) => { if (k === 'preset' && v.preset !== 'custom') { const [w, h] = v.preset.split('x').map(Number); v.w = w; v.h = h; document.querySelectorAll('.dialog .ctl').forEach((c) => c._sync && c._sync()); } },
      onOk: (v) => MP.artboards.add({ w: +v.w, h: +v.h, name: v.name, bg: v.transparent ? 'transparent' : v.bg, useDoc: v.useDoc }) });
  },
  batch() {
    dlg6({ title: 'Traitement par lots / Processeur d\'images', width: 460, okLabel: 'Choisir les fichiers…',
      fields: [{ k: 'action', label: 'Action à exécuter', type: 'select', options: [[-1, '(aucune — conversion seulement)'], ...MP.actions.list.map((a, i) => [i, a.name])] }, { type: 'header', label: 'Redimensionner (0 = sans)' }, { k: 'fitW', label: 'Largeur max.', type: 'number', min: 0, max: 30000 }, { k: 'fitH', label: 'Hauteur max.', type: 'number', min: 0, max: 30000 }, { type: 'header', label: 'Enregistrement' }, { k: 'format', label: 'Format', type: 'select', options: [['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP'], ['tiff', 'TIFF'], ['pdf', 'PDF'], ['gif', 'GIF'], ['bmp', 'BMP']] }, { k: 'quality', label: 'Qualité', type: 'range', min: 1, max: 100, unit: '%' }, { k: 'suffix', label: 'Suffixe du nom', type: 'text' }, { k: 'meta', label: 'Conserver les métadonnées', type: 'check' }],
      values: { action: -1, fitW: 0, fitH: 0, format: 'jpeg', quality: 85, suffix: '', meta: true },
      onOk: (v) => { setTimeout(() => MP.batch.run({ ...v, action: +v.action, fitW: +v.fitW, fitH: +v.fitH }), 50); } });
  },
  dataSets() {
    const d = MP.doc, vars = MP.dataSets.vars(d);
    dlg6({ title: 'Jeux de données (variables)', width: 560, okLabel: 'Générer les visuels…',
      fields: [{ type: 'info', html: `<p class="muted">Collez un tableau (CSV ou copié depuis Excel / Google Sheets). La première ligne contient les noms des variables : <b>nom d'un calque de texte</b> (son texte est remplacé), <b>{{variable}}</b> dans un texte, ou <b>nom d'un calque</b> (oui / non pour l'afficher).<br>Variables du document : ${vars.map((x) => '<code>' + esc(x) + '</code>').join(' ')}</p>` }, { k: 'csv', label: 'Données', type: 'textarea', rows: 9 }, { k: 'nameCol', label: 'Colonne pour le nom des fichiers (facultatif)', type: 'text' }, { k: 'format', label: 'Format', type: 'select', options: [['png', 'PNG'], ['jpeg', 'JPEG'], ['pdf', 'PDF'], ['webp', 'WebP']] }, { k: 'quality', label: 'Qualité', type: 'range', min: 1, max: 100, unit: '%' }],
      values: { csv: vars.slice(0, 3).join(';') + '\n' + vars.slice(0, 3).map(() => '').join(';'), nameCol: '', format: 'png', quality: 92 },
      onOk: (v) => { setTimeout(() => MP.dataSets.generate(v.csv, v), 50); } });
  },
  scriptConsole() {
    dlg6({ title: 'Console de script', width: 620, okLabel: 'Exécuter',
      fields: [{ type: 'info', html: '<p class="muted">JavaScript avec accès à <code>MP</code> (moteur), <code>UI</code>, <code>doc</code> (document actif) et <code>toast(message)</code>. Exemple : <code>doc.layers.forEach(l => l.opacity = 0.8)</code></p>' }, { k: 'code', label: 'Script', type: 'textarea', rows: 12 }],
      values: { code: localStorage.getItem('mp.script') || '// Exemple : renommer tous les calques\ndoc.layers.forEach((l, i) => l.name = "Calque " + (i + 1));\ntoast(doc.layers.length + " calques renommés");' },
      onOk: (v) => { try { localStorage.setItem('mp.script', v.code); } catch (_) { /* */ } MP.scripts.run(v.code, 'la console'); } });
  },
  async versions() {
    const d = MP.doc, list = await MP.versions.list(d ? d.name : null);
    if (!list.length) { MP.toast('Aucune version enregistrée pour ce document (les versions sont créées à chaque Ctrl+S)'); return; }
    const box = el('div', { class: 'vlist' });
    list.forEach((v) => { const r = el('div', { class: 'vitem' }, `<b>${esc(v.name)}</b><span>${new Date(v.time).toLocaleString('fr-FR')} — ${(v.size / 1048576).toFixed(1)} Mo</span>`); const b = el('button', { class: 'btn small' }, 'Ouvrir'); b.onclick = () => { UI.dialogOpen && UI.dialogOpen.close && UI.dialogOpen.close(); MP.versions.open(v); }; r.appendChild(b); box.appendChild(r); });
    dlg6({ title: 'Historique des versions', width: 520, noCancel: true, fields: [{ type: 'info', html: '<p class="muted">Les 15 dernières versions de chaque document sont conservées sur cet ordinateur.</p>' }], values: {} });
    setTimeout(() => { const body = document.querySelector('.dialog .dlg-info'); body && body.after(box); }, 0);
  },
  storagePrefs() {
    dlg6({ title: 'Préférences : enregistrement, IA, performances', width: 460,
      fields: [{ k: 'autosaveMin', label: 'Sauvegarde automatique (minutes, 0 = jamais)', type: 'range', min: 0, max: 30 }, { k: 'versions', label: 'Conserver un historique des versions à chaque enregistrement', type: 'check' }, { k: 'aiVariants', label: 'Variations par remplissage génératif (chacune est facturée par OpenAI)', type: 'range', min: 1, max: 4 }, { k: 'historyLimit', label: 'États d\'historique', type: 'range', min: 10, max: 200 }],
      values: { autosaveMin: MP.prefs.autosaveMin ?? 3, versions: MP.prefs.versions !== false, aiVariants: MP.prefs.aiVariants ?? 3, historyLimit: MP.prefs.historyLimit || 40 },
      onOk: (v) => { Object.assign(MP.prefs, v); MP.savePrefs(); MP.autosave.start(); MP.docs.forEach((d) => (d.history.limit = v.historyLimit)); MP.toast('Préférences enregistrées'); } });
  },
  shortcutsEdit() {
    let custom = {}; try { custom = JSON.parse(localStorage.getItem('mp.sc') || '{}'); } catch (_) { /* */ }
    const rows = []; const walk = (items, path) => items.forEach((it) => { if (!it || it === '-') return; const lb = lbl(it); if (it.sub) walk(it.sub(), [...path, lb]); else if (it.act) rows.push({ path: [...path, lb].join(' › '), sc: it.sc || '' }); });
    UI.menus().forEach((m) => walk(m.items, [m.label]));
    const box = el('div', { class: 'sclist' }), filter = el('input', { class: 'txt', placeholder: 'Filtrer les commandes…' });
    const fmt = (e) => { const k = e.key.length === 1 ? e.key.toUpperCase() : /^F\d+$/.test(e.key) ? e.key : { Delete: 'Suppr', Backspace: 'Retour', Enter: 'Entrée', Escape: '', ArrowUp: 'Haut', ArrowDown: 'Bas', ArrowLeft: 'Gauche', ArrowRight: 'Droite' }[e.key]; if (!k || ['CONTROL', 'SHIFT', 'ALT', 'META'].includes(k)) return null; return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Maj+' : '') + k; };
    const draw = () => {
      box.innerHTML = ''; const q = filter.value.toLowerCase();
      for (const r of rows) { if (q && !r.path.toLowerCase().includes(q)) continue; const cur = r.path in custom ? custom[r.path] : r.sc, line = el('div', { class: 'scrow' }, `<span>${esc(r.path)}</span>`), inp = el('input', { class: 'sckey', value: cur, placeholder: '—', readonly: true }); inp.title = 'Cliquez puis tapez le raccourci (Retour arrière pour effacer)';
        inp.addEventListener('keydown', (e) => { e.preventDefault(); e.stopPropagation(); if (e.key === 'Backspace' && !e.ctrlKey) { custom[r.path] = ''; inp.value = ''; return; } const s = fmt(e); if (!s) return; const clash = rows.find((o) => o !== r && (o.path in custom ? custom[o.path] : o.sc) === s); if (clash) MP.toast('Déjà utilisé par : ' + clash.path + ' (ce raccourci lui sera retiré)', 4000); if (clash) custom[clash.path] = ''; custom[r.path] = s; inp.value = s; });
        line.appendChild(inp); box.appendChild(line); }
    };
    filter.oninput = draw; draw();
    dlg6({ title: 'Raccourcis clavier', width: 640, okLabel: 'Enregistrer', fields: [{ type: 'info', html: '' }], values: {},
      onOk: () => { try { localStorage.setItem('mp.sc', JSON.stringify(custom)); } catch (_) { /* */ } UI.buildMenus(); MP.toast('Raccourcis enregistrés'); } });
    setTimeout(() => { const inf = document.querySelector('.dialog .dlg-info'); if (!inf) return; const reset = el('button', { class: 'btn small' }, 'Tout réinitialiser'); reset.onclick = () => { custom = {}; draw(); }; inf.append(filter, reset, box); }, 0);
  },
  toolbarEdit() {
    let hidden = []; try { hidden = JSON.parse(localStorage.getItem('mp.hiddenTools') || '[]'); } catch (_) { /* */ }
    const vals = {}; const fields = [{ type: 'info', html: '<p class="muted">Décochez les outils à masquer de la barre d\'outils (ils restent accessibles par la recherche Ctrl+F).</p>' }];
    for (const sl of UI._slots0) for (const id of sl.tools) { if (!MP.tools[id]) continue; vals[id] = !hidden.includes(id); fields.push({ k: id, label: `${MP.tools[id].name} (${sl.key})`, type: 'check' }); }
    dlg6({ title: 'Modifier la barre d\'outils', width: 420, fields, values: vals, onOk: (v) => { const h = Object.keys(v).filter((k) => !v[k]); try { localStorage.setItem('mp.hiddenTools', JSON.stringify(h)); } catch (_) { /* */ } UI.applyHiddenTools(); } });
  },
  oldPhoto() { dlg6({ title: 'Restaurer une photo ancienne', width: 420, fields: [{ k: 'dust', label: 'Retirer poussières et rayures', type: 'check' }, { k: 'noise', label: 'Réduire le bruit et le grain', type: 'check' }, { k: 'contrast', label: 'Rétablir le contraste', type: 'check' }, { k: 'sharp', label: 'Renforcer la netteté', type: 'check' }, { k: 'colorize', label: '✨ Coloriser ensuite (IA)', type: 'check' }], values: { dust: true, noise: true, contrast: true, sharp: true, colorize: false }, onOk: (v) => MP.retouch.oldPhoto(v) }); },
  freqSep() { dlg6({ title: 'Séparation de fréquences', width: 380, fields: [{ k: 'r', label: 'Rayon (détails à séparer)', type: 'range', min: 1, max: 40, unit: 'px' }], values: { r: 6 }, onOk: (v) => MP.retouch.frequencySeparation(v.r) }); },
  timelineExport(kind) {
    dlg6({ title: kind === 'gif' ? 'Exporter en GIF animé' : 'Exporter en vidéo', width: 400, values: { scale: 100, dither: true, loops: 1, bg: '' }, fields: [{ k: 'scale', label: 'Échelle', type: 'range', min: 10, max: 100, unit: '%' }, ...(kind === 'gif' ? [{ k: 'dither', label: 'Tramage', type: 'check' }] : [{ k: 'loops', label: 'Nombre de boucles', type: 'range', min: 1, max: 20 }])],
      onOk: (v) => (kind === 'gif' ? MP.anim.exportGif(v) : MP.anim.exportVideo(v)) });
  },
});

/* =================== Panneaux : Compositions de calques, Bibliothèques =================== */
UI.refreshComps = () => {
  if (!vis6('panel-comps')) return; const box = $('#panel-comps .body'), d = MP.doc; box.innerHTML = ''; if (!d) return;
  const C = d.comps || [];
  if (!C.length) box.appendChild(el('p', { class: 'muted' }, 'Mémorisez différents états de visibilité, d\'opacité, de mode et de styles des calques (ex. versions d\'une publicité), puis passez de l\'un à l\'autre.'));
  C.forEach((c, i) => {
    const r = el('div', { class: 'layer' + (d.compSel === i ? ' active' : '') }, `<span class="lname">▣ ${esc(c.name)}</span>`);
    const up = el('button', { class: 'ibtn', title: 'Mettre à jour avec l\'état actuel' }, '↻'); up.onclick = (e) => { e.stopPropagation(); MP.comps.update(i); };
    const del = el('button', { class: 'ibtn', title: 'Supprimer' }, MP.icon('trash', 14)); del.onclick = (e) => { e.stopPropagation(); MP.comps.remove(i); };
    r.append(up, del); r.onclick = () => MP.comps.go(i); box.appendChild(r);
  });
  const rw = el('div', { class: 'prow' }); const b1 = el('button', { class: 'btn small' }, '+ Nouvelle composition'); b1.onclick = () => MP.comps.add(); const b2 = el('button', { class: 'btn small' }, 'Exporter toutes'); b2.onclick = () => MP.comps.exportAll(); rw.append(b1, b2); box.appendChild(rw);
};
UI.refreshLibrary = async () => {
  if (!vis6('panel-library')) return; const box = $('#panel-library .body'), items = await MP.library.items(); box.innerHTML = '';
  const rw = el('div', { class: 'prow' }); [['graphic', '+ Graphique'], ['color', '+ Couleur'], ['style', '+ Style'], ['text', '+ Style de texte']].forEach(([t, n]) => { const b = el('button', { class: 'btn small' }, n); b.onclick = () => MP.library.add(t); rw.appendChild(b); }); box.appendChild(rw);
  if (!items.length) { box.appendChild(el('p', { class: 'muted' }, 'Rangez ici vos logos, couleurs de marque, styles de calque et styles de texte pour les réutiliser dans tous vos documents. Clic : utiliser — clic droit : supprimer.')); return; }
  for (const [t, title] of [['graphic', 'Graphiques'], ['color', 'Couleurs'], ['style', 'Styles de calque'], ['text', 'Styles de caractère']]) {
    const list = items.filter((i) => i.type === t); if (!list.length) continue; box.appendChild(el('div', { class: 'psec-t' }, title)); const g = el('div', { class: 'tilegrid' });
    list.forEach((it) => { const tile = el('div', { class: 'tile', title: it.name }); if (t === 'graphic') tile.appendChild(el('img', { src: it.data, class: 'libimg' })); else if (t === 'color') { const s = el('div', { class: 'libsw' }); s.style.background = it.data; tile.appendChild(s); } else tile.appendChild(el('div', { class: 'libsw txt' }, t === 'text' ? 'Aa' : 'fx')); tile.appendChild(el('span', {}, esc(it.name))); tile.onclick = () => MP.library.use(it); tile.oncontextmenu = (e) => { e.preventDefault(); MP.library.remove(it); }; g.appendChild(tile); });
    box.appendChild(g);
  }
};
{
  const bd = UI.buildDock;
  UI.buildDock = () => {
    const host = $('#panels');
    host.appendChild(el('section', { class: 'panel collapsed', id: 'panel-comps' }, '<h3>Compositions</h3><div class="body"></div>'));
    host.appendChild(el('section', { class: 'panel collapsed', id: 'panel-library' }, '<h3>Bibliothèques</h3><div class="body"></div>'));
    UI.DOCK[3].push('panel-comps'); UI.DOCK[1].push('panel-library');
    bd();
  };
  const rp = UI.refreshPanel; UI.refreshPanel = (id) => { if (id === 'panel-comps') return UI.refreshComps(); if (id === 'panel-library') return UI.refreshLibrary(); rp(id); };
}

/* =================== Montage (timeline) =================== */
UI.showTimeline = (on) => { const t = $('#timeline'); if (!t) return; if (on == null) on = t.style.display === 'none'; t.style.display = on ? 'flex' : 'none'; MP.prefs.timeline = on; MP.savePrefs(); if (on && MP.doc) { MP.anim.ensure(); UI.refreshTimeline(); } MP.view.resize(); };
UI.refreshTimeline = (light) => {
  const t = $('#timeline'); if (!t || t.style.display === 'none') return; const d = MP.doc, strip = t.querySelector('.tl-strip');
  t.querySelector('.tl-play').textContent = MP.anim.timer ? '■' : '▶';
  if (!d) { strip.innerHTML = '<p class="muted">Aucun document.</p>'; return; }
  const F = MP.anim.frames(d);
  if (light) { strip.querySelectorAll('.tl-frame').forEach((f, i) => f.classList.toggle('on', i === d.frameSel)); return; }
  strip.innerHTML = '';
  F.forEach((f, i) => {
    const fr = el('div', { class: 'tl-frame' + (i === (d.frameSel || 0) ? ' on' : '') }), c = el('canvas', { width: 96, height: 64 }), x = c.getContext('2d');
    const img = MP.anim.render(d, i), k = Math.min(96 / d.width, 64 / d.height); x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 64); x.drawImage(img, (96 - d.width * k) / 2, (64 - d.height * k) / 2, d.width * k, d.height * k);
    const sel = el('select', { class: 'tl-delay', title: 'Durée de l\'image' }); for (const ms of [0, 50, 100, 150, 200, 300, 500, 1000, 2000, 5000]) sel.appendChild(el('option', { value: ms }, ms < 1000 ? (ms / 1000).toFixed(ms % 100 ? 2 : 1).replace('.', ',') + ' s' : ms / 1000 + ' s')); if (![0, 50, 100, 150, 200, 300, 500, 1000, 2000, 5000].includes(f.delay)) sel.appendChild(el('option', { value: f.delay }, (f.delay / 1000).toFixed(2) + ' s')); sel.value = f.delay;
    sel.onchange = () => { f.delay = +sel.value; d.markDirty(); }; sel.onclick = (e) => e.stopPropagation();
    fr.append(el('b', {}, String(i + 1)), c, sel); fr.onclick = () => MP.anim.select(i); strip.appendChild(fr);
  });
  t.querySelector('.tl-loop').value = (d.anim && d.anim.loop) || 0;
};
UI.buildTimeline = () => {
  const t = el('div', { id: 'timeline', style: 'display:none' });
  t.innerHTML = `<div class="tl-bar"><b>Montage</b><button class="tl-play" title="Lire / arrêter">▶</button><button data-a="add" title="Dupliquer l'image (nouvelle image)">＋</button><button data-a="del" title="Supprimer l'image">🗑</button><button data-a="tween" title="Interpoler (créer des images intermédiaires)">⋯ Interpoler</button><button data-a="layers" title="Créer une image par calque">Calques → images</button>
    <label>Boucle <select class="tl-loop"><option value="0">Toujours</option><option value="1">Une fois</option><option value="3">3 fois</option></select></label><span class="sp"></span><button data-a="video" title="Importer des images d'une vidéo">Importer une vidéo…</button><button data-a="gif">Exporter GIF…</button><button data-a="mp4">Exporter vidéo…</button><button data-a="close" title="Fermer le montage">×</button></div><div class="tl-strip"></div>`;
  $('#workspace').appendChild(t);
  t.querySelector('.tl-play').onclick = need(() => MP.anim.play());
  t.querySelector('.tl-loop').onchange = (e) => { const d = MP.doc; if (d) { d.anim = { ...(d.anim || {}), loop: +e.target.value }; d.markDirty(); } };
  t.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
    const a = b.dataset.a, d = MP.doc; if (a === 'close') return UI.showTimeline(false); if (a === 'video') return MP.anim.importVideo(); if (!d) return MP.toast('Ouvrez un document');
    if (a === 'add') MP.anim.add(); if (a === 'del') MP.anim.remove(d.frameSel || 0); if (a === 'layers') MP.anim.fromLayers();
    if (a === 'tween') dlg6({ title: 'Interpoler', width: 360, fields: [{ k: 'n', label: 'Images à ajouter', type: 'range', min: 1, max: 30 }], values: { n: 5 }, onOk: (v) => MP.anim.tween(d.frameSel || 0, v.n) });
    if (a === 'gif') UI.dialogs.timelineExport('gif'); if (a === 'mp4') UI.dialogs.timelineExport('video');
  }));
};

/* =================== Propriétés et Caractère : sections supplémentaires =================== */
{
  const rp0 = UI.refreshProps;
  UI.refreshProps = (force) => {
    rp0(force); if (!vis6('panel-props')) return; const box = $('#panel-props .body'), d = MP.doc; if (!d || box.querySelector('.v6sec')) return;
    const l = d.layer, S = (title) => { const s = el('div', { class: 'psec v6sec' }); s.appendChild(el('div', { class: 'psec-t' }, esc(title))); box.appendChild(s); return s; };
    const B = (n, fn, t) => { const b = el('button', { class: 'btn small', title: t || '' }, n); b.onclick = fn; return b; }, R = (...k) => { const r = el('div', { class: 'prow' }); r.append(...k); return r; };
    if (l.genVars && l.genVars.length > 1) { const s = S('Variations génératives'), g = el('div', { class: 'tilegrid' }); l.genVars.forEach((v, i) => { const c = el('canvas', { width: 64, height: 64 }), k = Math.min(64 / v.width, 64 / v.height); c.getContext('2d').drawImage(v, (64 - v.width * k) / 2, (64 - v.height * k) / 2, v.width * k, v.height * k); const t = el('div', { class: 'tile' + (l.genSel === i ? ' on' : '') }); t.append(c, el('span', {}, 'Variation ' + (i + 1))); t.onclick = () => { MP.ai.pickVariant(l, i); UI.refreshProps(true); }; g.appendChild(t); }); s.appendChild(g); }
    if (!l.isGroup && !l.adjust) { const s = S('Fusion'); s.appendChild(el('p', { class: 'muted' }, `Mode : ${esc((MP.BLEND_MODES.find((b) => b[0] === l.blend) || [0, l.blend])[1])}${l.blendIf ? ' — fusion conditionnelle active' : ''}`)); s.appendChild(R(B('Options de fusion…', () => UI.dialogs.blendOptions()), B('Marionnette…', () => MP.puppet.open(), 'Déformation de la marionnette'))); }
    if (l.vmask) { const s = S('Masque vectoriel'); s.appendChild(R(B('Modifier le tracé', () => MP.vmask.edit()), B('Mettre à jour', () => MP.vmask.update()), B('Supprimer', () => MP.vmask.remove()))); }
    if (l.smart && l.smart.link) { const s = S('Objet dynamique lié'); s.appendChild(el('p', { class: 'muted' }, esc(l.smart.link))); s.appendChild(R(B('Mettre à jour', () => MP.smart.updateLinked()), B('Incorporer', () => MP.smart.embed()))); }
    const s = S('Impression et fichier'); s.appendChild(el('p', { class: 'muted' }, `${d.dpi || 72} ppp — ${((d.width / (d.dpi || 72)) * 2.54).toFixed(1)} × ${((d.height / (d.dpi || 72)) * 2.54).toFixed(1)} cm — mode ${{ bitmap: 'Bitmap', indexed: 'Couleurs indexées', duotone: 'Bichromie', gray: 'Niveaux de gris' }[d.mode] || 'RVB'}`));
    s.appendChild(R(B('Résolution…', () => UI.dialogs.resolution()), B('Infos fichier…', () => UI.dialogs.fileInfo()), B('PDF impression…', () => UI.dialogs.printPdf())));
    if ((d.artboards || []).length) { const a = S('Plans de travail'); d.artboards.forEach((ab, i) => { const r = el('div', { class: 'prow' }, `<span class="muted" style="flex:1">${esc(ab.name)} — ${ab.w} × ${ab.h}</span>`); r.appendChild(B('×', () => { MP.artboards.remove(i); UI.refreshProps(true); }, 'Supprimer')); a.appendChild(r); }); a.appendChild(R(B('+ Plan de travail', () => UI.dialogs.newArtboard()), B('Exporter tous', () => MP.artboards.export('png')))); }
  };
  const rc0 = UI.refreshChar;
  UI.refreshChar = () => {
    rc0(); if (!vis6('panel-char')) return; const box = $('#panel-char .body'), d = MP.doc, l = d && d.layer && d.layer.text ? d.layer : null; if (!l || box.querySelector('.v6sec')) return;
    const t = l.text, v = { boxW: t.boxW || 0, warpS: (t.warp && t.warp.style) || 'none', bend: (t.warp && t.warp.bend) || 50, kern: t.kern || 'normal', caps: t.caps || 'normal', pathOffset: t.pathOffset || 0, baseShift: t.baseShift || 0 };
    const sec = el('div', { class: 'psec v6sec' }); box.appendChild(sec);
    const ch = () => { if (!UI._burst) d.history.record('Texte', null); clearTimeout(UI._burstT); UI._burst = true; UI._burstT = setTimeout(() => (UI._burst = false), 900); t.boxW = +v.boxW || 0; t.warp = v.warpS === 'none' ? null : { style: v.warpS, bend: +v.bend }; t.kern = v.kern; t.caps = v.caps; t.pathOffset = +v.pathOffset; t.baseShift = +v.baseShift; MP.renderText(l); MP.render(); };
    [{ type: 'header', label: 'Paragraphe et typographie' }, { k: 'boxW', label: 'Largeur du bloc de paragraphe (0 = texte ponctuel)', type: 'number', min: 0, max: 20000 }, { k: 'kern', label: 'Crénage', type: 'select', options: [['normal', 'Métrique (auto)'], ['none', 'Aucun']] }, { k: 'caps', label: 'Capitales', type: 'select', options: [['normal', 'Normales'], ['small-caps', 'Petites capitales'], ['all-small-caps', 'Tout en petites capitales']] }, { type: 'header', label: 'Déformation du texte' }, { k: 'warpS', label: 'Style', type: 'select', options: MP.TEXT_WARPS }, { k: 'bend', label: 'Inflexion', type: 'range', min: -100, max: 100, unit: '%' }, ...(t.pathPts ? [{ type: 'header', label: 'Texte sur tracé' }, { k: 'pathOffset', label: 'Position de départ', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'baseShift', label: 'Décalage de la ligne de base', type: 'range', min: -200, max: 200, unit: 'px' }] : [])].forEach((f) => sec.appendChild(UI.control(f, v, ch)));
    const r = el('div', { class: 'prow' });
    const b1 = el('button', { class: 'btn small' }, t.pathPts ? 'Détacher du tracé' : 'Placer sur le tracé actuel'); b1.onclick = () => { if (t.pathPts) { d.history.record('Détacher du tracé', null); t.pathPts = null; MP.renderText(l); MP.afterEdit(); UI._charKey = null; UI.refreshChar(); } else MP.textOnPath(); };
    const b2 = el('button', { class: 'btn small', title: 'Enregistrer ce style de caractère dans la bibliothèque' }, 'Enregistrer le style'); b2.onclick = () => MP.library.add('text');
    r.append(b1, b2); sec.appendChild(r);
  };
}

/* =================== Barre d'outils et raccourcis personnalisés, espaces de travail =================== */
UI._slots0 = UI.SLOTS.map((s) => ({ key: s.key, tools: s.tools.slice() }));
UI.applyHiddenTools = () => {
  let hidden = []; try { hidden = JSON.parse(localStorage.getItem('mp.hiddenTools') || '[]'); } catch (_) { /* */ }
  UI.SLOTS.forEach((s, i) => { s.tools = UI._slots0[i].tools.filter((id) => MP.tools[id] && !hidden.includes(id)); if (!s.tools.length) s.tools = [UI._slots0[i].tools[0]]; if (!s.tools.includes(s.cur)) s.cur = s.tools[0]; });
  UI.buildToolbar(); MP.tool && UI.refreshTool();
};
UI.WORKSPACES = {
  'Essentiel': { active: { 0: 'panel-props', 1: 'panel-color', 2: 'panel-history', 3: 'panel-layers' }, min: [2], timeline: false },
  'Photographie': { active: { 0: 'panel-histo', 1: 'panel-color', 2: 'panel-history', 3: 'panel-layers' }, min: [], timeline: false },
  'Peinture': { active: { 0: 'panel-nav', 1: 'panel-swatches', 2: 'panel-brushes', 3: 'panel-layers' }, min: [], timeline: false },
  'Typographie': { active: { 0: 'panel-props', 1: 'panel-library', 2: 'panel-char', 3: 'panel-layers' }, min: [], timeline: false },
  'Graphisme et web': { active: { 0: 'panel-props', 1: 'panel-library', 2: 'panel-history', 3: 'panel-comps' }, min: [2], timeline: false },
  'Animation': { active: { 0: 'panel-props', 1: 'panel-color', 2: 'panel-history', 3: 'panel-layers' }, min: [1, 2], timeline: true },
};
UI.applyWorkspace = (ws) => {
  const groups = [...document.querySelectorAll('.pgroup')];
  groups.forEach((g, i) => { const id = ws.active[i]; if (id) UI.showPanel(id, true); g.classList.toggle('min', (ws.min || []).includes(i)); });
  UI.saveDock(); UI.showTimeline(!!ws.timeline);
};
UI.userWorkspaces = () => { try { return JSON.parse(localStorage.getItem('mp.ws') || '{}'); } catch (_) { return {}; } };
UI.saveWorkspace = () => dlg6({ title: 'Nouvel espace de travail', width: 360, fields: [{ k: 'n', label: 'Nom', type: 'text' }], values: { n: 'Mon espace' }, onOk: (v) => { const st = JSON.parse(localStorage.getItem('mp.dock') || '{}'), all = UI.userWorkspaces(); all[v.n] = { active: st.active || {}, min: st.min || [], timeline: $('#timeline').style.display !== 'none' }; localStorage.setItem('mp.ws', JSON.stringify(all)); MP.toast('Espace de travail « ' + v.n + ' » enregistré'); } });
{
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), M = (l) => (m.find((x) => x.label === l) || { items: [] }).items;
    let custom = {}; try { custom = JSON.parse(localStorage.getItem('mp.sc') || '{}'); } catch (_) { /* */ }
    // Fichier
    const fi = M('Fichier');
    after(fi, 'Enregistrer au format Photoshop', { label: 'Exporter', sub: () => [{ label: 'Exportation rapide en PNG', sc: 'Ctrl+Alt+Maj+E', act: need(async () => { const d = MP.doc; const data = await MP.enc.png(MP.flatComposite(d), { dpi: d.dpi, meta: d.meta }); const p = await MP.native.saveFile({ defaultPath: d.name.replace(/\.[^.]+$/, '') + '.png', filters: [{ name: 'PNG', extensions: ['png'] }], data }); if (p) MP.toast('PNG exporté'); }) }, { label: 'Exporter sous (tous formats)…', act: need(() => UI.dialogs.exportAs()) }, { label: 'PDF pour l\'impression (CMJN, fond perdu, traits de coupe)…', act: need(() => UI.dialogs.printPdf()) }, '-', { label: 'Plans de travail en fichiers', act: need(() => MP.artboards.export('png')) }, { label: 'Compositions de calques en fichiers', act: need(() => MP.comps.exportAll()) }, { label: 'Montage en GIF animé…', act: need(() => UI.dialogs.timelineExport('gif')) }, { label: 'Montage en vidéo…', act: need(() => UI.dialogs.timelineExport('video')) }] },
      { label: 'Importer', sub: () => [{ label: 'Images vidéo en calques…', act: () => MP.anim.importVideo() }, { label: 'Importer et lier (objet dynamique lié)…', act: need(() => MP.smart.placeLinked()) }] },
      { label: 'Automatisation', sub: () => [{ label: 'Traitement par lots / Processeur d\'images…', act: () => UI.dialogs.batch() }, { label: 'Photomerge (panorama)…', act: async () => { const f = await MP.native.openFiles({ multi: true, accept: 'image/*', filters: [{ name: 'Images', extensions: IMAGE_EXT }] }); if (f && f.length) MP.panorama(f); } }, { label: 'Jeux de données (variables)…', act: need(() => UI.dialogs.dataSets()) }] },
      { label: 'Scripts', sub: () => [{ label: 'Exécuter un script…', act: () => MP.scripts.open() }, { label: 'Console de script…', act: () => UI.dialogs.scriptConsole() }] }, '-',
      { label: 'Informations sur le fichier…', sc: 'Ctrl+Alt+Maj+I', act: need(() => UI.dialogs.fileInfo()) }, { label: 'Historique des versions…', act: () => UI.dialogs.versions() });
    // Édition
    const ed = M('Édition');
    after(ed, 'Remplacement du ciel', { label: 'Déformation de la marionnette…', act: need(() => MP.puppet.open()) }, { label: 'Alignement automatique des calques', act: need(() => MP.autoAlign()) });
    const pi = ed.findIndex((x) => lbl(x).startsWith('Préférences')); ed.splice(pi < 0 ? ed.length : pi + 1, 0, { label: 'Enregistrement, IA et performances…', act: () => UI.dialogs.storagePrefs() }, { label: 'Raccourcis clavier…', sc: 'Ctrl+Alt+Maj+K', act: () => UI.dialogs.shortcutsEdit() }, { label: 'Barre d\'outils…', act: () => UI.dialogs.toolbarEdit() });
    // Image
    const im = M('Image'), mi = im.findIndex((x) => lbl(x) === 'Mode');
    if (mi >= 0) im[mi] = { label: 'Mode', sub: () => { const md = MP.doc && MP.doc.mode; const ck = (k, n) => (md === k || (!md && k === 'rgb') ? '✓ ' : '') + n; return [{ label: ck('bitmap', 'Bitmap…'), act: need(() => UI.dialogs.modeBitmap()) }, { label: ck('gray', 'Niveaux de gris'), act: need(() => { MP.cmd.grayscale(); MP.doc.mode = 'gray'; }) }, { label: ck('duotone', 'Bichromie / trichromie…'), act: need(() => UI.dialogs.modeDuotone()) }, { label: ck('indexed', 'Couleurs indexées…'), act: need(() => UI.dialogs.modeIndexed()) }, { label: ck('rgb', 'Couleurs RVB'), act: need(() => MP.colorMode.rgb()) }, '-', { label: 'CMJN : épreuve écran (Affichage) et export TIFF/PDF CMJN', disabled: true }, { label: '8 bits par couche', disabled: true }]; } };
    after(im, 'Taille de la zone de travail', { label: 'Résolution…', act: need(() => UI.dialogs.resolution()) }, { label: 'Super résolution', sub: () => [{ label: 'Agrandir × 2', act: need(() => MP.retouch.superRes(2)) }, { label: 'Agrandir × 4', act: need(() => MP.retouch.superRes(4)) }] });
    // Calque
    const ca = M('Calque');
    after(ca, 'Nouveau groupe', { label: 'Nouveau plan de travail…', act: need(() => UI.dialogs.newArtboard()) }, { label: 'Plan de travail d\'après la sélection', act: need(() => MP.artboards.fromSelection()) });
    after(ca, 'Masque de fusion', { label: 'Masque vectoriel', sub: () => [{ label: 'D\'après le tracé actuel', act: need(() => MP.vmask.fromPath()) }, { label: 'Modifier le tracé', act: need(() => MP.vmask.edit()) }, { label: 'Mettre à jour d\'après le tracé', act: need(() => MP.vmask.update()) }, { label: 'Supprimer le masque vectoriel', act: need(() => MP.vmask.remove()) }] });
    const st = ca.find((x) => lbl(x) === 'Style de calque'); if (st) { const s0 = st.sub; st.sub = () => [{ label: 'Options de fusion…', act: need(() => UI.dialogs.blendOptions()) }, ...s0()]; }
    const so = ca.find((x) => lbl(x) === 'Objets dynamiques'); if (so) { const s0 = so.sub; so.sub = () => [...s0(), '-', { label: 'Importer et lier…', act: need(() => MP.smart.placeLinked()) }, { label: 'Mettre à jour le contenu lié', act: need(() => MP.smart.updateLinked()) }, { label: 'Mettre à jour tous les contenus liés', act: need(() => MP.smart.updateLinked(true)) }, { label: 'Incorporer le contenu lié', act: need(() => MP.smart.embed()) }]; }
    after(ca, 'Aligner', { label: 'Aligner les calques du groupe', sub: () => [['left', 'Bords gauches'], ['hcenter', 'Centres horizontaux'], ['right', 'Bords droits'], ['top', 'Bords supérieurs'], ['vcenter', 'Centres verticaux'], ['bottom', 'Bords inférieurs']].map(([k, n]) => ({ label: n, act: need(() => MP.alignSet(k)) })) }, { label: 'Répartir les calques du groupe', sub: () => [{ label: 'Horizontalement (centres)', act: need(() => MP.distribute('h')) }, { label: 'Verticalement (centres)', act: need(() => MP.distribute('v')) }] }, { label: 'Compositions de calques', sub: () => [{ label: 'Nouvelle composition', act: need(() => { MP.comps.add(); UI.showPanel('panel-comps'); }) }, ...((MP.doc && MP.doc.comps) || []).map((c, i) => ({ label: '▣ ' + c.name, act: () => MP.comps.go(i) }))] });
    // Texte (nouveau menu)
    const si = m.findIndex((x) => x.label === 'Sélection');
    m.splice(si < 0 ? m.length : si, 0, { label: 'Texte', items: [{ label: 'Panneau Caractère et paragraphe', act: () => UI.showPanel('panel-char') }, { label: 'Texte sur le tracé actuel', act: need(() => MP.textOnPath()) }, { label: 'Texte de paragraphe (bloc de largeur fixe)…', act: need(() => { const l = MP.doc.layer; if (!l.text) { MP.toast('Sélectionnez un calque de texte'); return; } dlg6({ title: 'Texte de paragraphe', width: 380, fields: [{ k: 'w', label: 'Largeur du bloc (px, 0 = texte ponctuel)', type: 'number', min: 0, max: 20000 }], values: { w: l.text.boxW || Math.round(MP.doc.width * 0.6) }, onOk: (v) => { MP.doc.history.record('Texte de paragraphe', null); l.text.boxW = +v.w; MP.renderText(l); MP.afterEdit(); } }); }) }, { label: 'Déformer le texte…', act: need(() => { const l = MP.doc.layer; if (!l.text) { MP.toast('Sélectionnez un calque de texte'); return; } const v = { s: (l.text.warp && l.text.warp.style) || 'arc', b: (l.text.warp && l.text.warp.bend) || 50 }; MP.doc.history.record('Déformer le texte', null); dlg6({ title: 'Déformer le texte', width: 380, preview: true, fields: [{ k: 's', label: 'Style', type: 'select', options: MP.TEXT_WARPS }, { k: 'b', label: 'Inflexion', type: 'range', min: -100, max: 100, unit: '%' }], values: v, onChange: (vv) => { l.text.warp = vv.s === 'none' ? null : { style: vv.s, bend: vv.b }; MP.renderText(l); MP.render(); }, onOk: () => MP.afterEdit(), onCancel: () => MP.undo ? MP.undo() : MP.doc.history.undo() }); }) }, '-', { label: 'Pixelliser le calque de texte', act: need(() => MP.layerOps.rasterize()) }, { label: 'Charger les polices de l\'ordinateur', act: () => MP.loadSystemFonts && MP.loadSystemFonts() }, { label: 'Vérifier les polices manquantes', act: need(() => { if (!MP.fontCheck(MP.doc).length) MP.toast('Toutes les polices du document sont disponibles'); }) }] });
    // Filtre
    const fl = M('Filtre'), sub = (n, ...add) => { const it = fl.find((x) => lbl(x) === n); if (it) { const s0 = it.sub; it.sub = () => [...s0(), ...add]; } };
    after(fl, 'Fluidité', { label: 'Correction de l\'objectif…', act: flt6('lensCorrect') }, { label: 'Camera Raw : détail, mélangeur, optique…', act: flt6('rawDetail') });
    sub('Flou', '-', { label: 'Flou de rotation…', act: flt6('spin') }, { label: 'Flou de champ…', act: flt6('fieldBlur') });
    sub('Renforcement', { label: 'Netteté optimisée…', act: flt6('smartSharpen') }, { label: 'Réduction du tremblement…', act: flt6('shake') });
    sub('Rendu', { label: 'Fibres…', act: flt6('fibers') });
    fl.push('-', { label: 'Retouche', sub: () => [{ label: 'Séparation de fréquences…', act: need(() => UI.dialogs.freqSep()) }, { label: 'Calque Dodge & Burn', act: need(() => MP.retouch.dodgeBurn()) }, { label: 'Restaurer une photo ancienne…', act: need(() => UI.dialogs.oldPhoto()) }] });
    // Affichage
    const af = M('Affichage');
    af.push('-', { label: () => (MP.proof ? '✓ ' : '') + 'Épreuve écran CMJN', sc: 'Ctrl+Y', act: need(() => { MP.proof = !MP.proof; MP.doc.rev++; MP.renderView(); MP.toast(MP.proof ? 'Épreuve CMJN (simulation encres + papier, sans profil ICC)' : 'Épreuve désactivée'); }) }, { label: () => (MP.gamutWarn ? '✓ ' : '') + 'Couleurs non imprimables', sc: 'Ctrl+Maj+Y', act: need(() => { MP.gamutWarn = !MP.gamutWarn; MP.doc.rev++; MP.renderView(); }) },
      { label: 'Rotation de l\'affichage', sub: () => [{ label: 'Outil Rotation (glisser)', act: need(() => MP.setTool('rotview')) }, { label: '↺ 15°', act: need(() => MP.setViewAngle((MP.doc.viewAngle || 0) - 15)) }, { label: '↻ 15°', act: need(() => MP.setViewAngle((MP.doc.viewAngle || 0) + 15)) }, { label: '90°', act: need(() => MP.setViewAngle(90)) }, { label: 'Réinitialiser la vue', sc: 'Échap', act: need(() => MP.setViewAngle(0)) }] });
    // Fenêtre
    const fe = M('Fenêtre'), hi = fe.findIndex((x) => lbl(x).endsWith('Histogramme'));
    fe.splice(hi < 0 ? fe.length : hi + 1, 0, { label: () => (vis6('panel-comps') ? '✓ ' : '') + 'Compositions de calques', act: () => UI.showPanel('panel-comps') }, { label: () => (vis6('panel-library') ? '✓ ' : '') + 'Bibliothèques', act: () => UI.showPanel('panel-library') }, { label: () => ($('#timeline') && $('#timeline').style.display !== 'none' ? '✓ ' : '') + 'Montage (animation)', act: () => UI.showTimeline() },
      { label: 'Espaces de travail', sub: () => [...Object.entries(UI.WORKSPACES).map(([n, w]) => ({ label: n, act: () => UI.applyWorkspace(w) })), ...Object.entries(UI.userWorkspaces()).map(([n, w]) => ({ label: '★ ' + n, act: () => UI.applyWorkspace(w) })), '-', { label: 'Nouvel espace de travail…', act: () => UI.saveWorkspace() }] });
    // raccourcis personnalisés
    const walk = (items, path) => items.forEach((it) => { if (!it || it === '-') return; const lb = lbl(it), p = [...path, lb]; if (it.sub) { const s0 = it.sub; it.sub = () => { const r = s0(); walk(r, p); return r; }; } else if (p.join(' › ') in custom) it.sc = custom[p.join(' › ')] || undefined; });
    m.forEach((mm) => walk(mm.items, [mm.label]));
    return m;
  };
}

/* =================== Initialisation v6 =================== */
MP.v6init = () => {
  UI.buildTimeline(); UI.applyHiddenTools();
  const ra = UI.refreshAll; UI.refreshAll = () => { ra(); if (vis6('panel-comps')) UI.refreshComps(); if (vis6('panel-library')) UI.refreshLibrary(); UI.refreshTimeline(); };
  const sd = MP.setDoc; if (sd) MP.setDoc = (d) => { if (MP.anim.timer) MP.anim.stop(); sd(d); UI.refreshTimeline(); };
  if (MP.prefs.timeline) UI.showTimeline(true);
  MP.autosave.start(); setTimeout(() => MP.autosave.recover(), 1200);
  UI.flash = (msg) => { const s = $('#status'); if (!s) return; let f = s.querySelector('.flash'); if (!f) { f = el('span', { class: 'flash muted' }); s.appendChild(f); } f.textContent = msg + ' — ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  UI.buildMenus(); UI.refreshAll();
};
