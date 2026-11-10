'use strict';
/* Interface : menus, barre d'outils, options, panneaux, boîtes de dialogue, raccourcis */

const ICONS = {
  move: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>',
  marquee: '<rect x="4" y="5" width="16" height="14" stroke-dasharray="3 2.2"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7" stroke-dasharray="3 2.2"/>',
  lasso: '<path d="M8 17c-4-1.5-5-5-3-8s7-5 11-4 6 4 4 7-6 4-9 3"/><path d="M8 17c-1 2 0 4 2 4"/>',
  wand: '<path d="M4 20L14 10"/><path d="M15 3v3M18 6h3M19.5 3.5l-2 2M12.5 3.5l1.5 1.5M17.5 10.5l1.5 1.5"/>',
  crop: '<path d="M6 2v16h16"/><path d="M2 6h16v16"/>',
  eyedropper: '<path d="M14.5 6.5l3 3L8 19H5v-3z"/><path d="M13 5l6 6M16 4.5l1.5-1.5a2.1 2.1 0 013 3L19 7.5"/>',
  heal: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M10.5 10.5h.01M13.5 13.5h.01M10.5 13.5h.01M13.5 10.5h.01"/>',
  brush: '<path d="M19.5 3.5l1 1-8.5 9.5-2-2z"/><path d="M10 12c-2.5 0-4.5 1.5-4.5 4 0 1.5-1 2.5-2.5 3.5 3.5.5 8-.5 8.5-4.5"/>',
  pencil: '<path d="M4 20l1.2-4.8L16 4.4l3.6 3.6L8.8 18.8z"/><path d="M14 6.5l3.5 3.5"/>',
  clone: '<path d="M9 3h6v4.5L13.5 11H19v4H5v-4h5.5L9 7.5z"/><path d="M5 19h14"/>',
  eraser: '<path d="M3.5 16.5l9-9 7 7-5 5h-6.5z"/><path d="M8.5 11.5l7 7M14 20.5h7"/>',
  gradient: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 5v14" opacity=".35"/><path d="M12 5v14" opacity=".6"/><path d="M16 5v14" opacity=".85"/>',
  bucket: '<path d="M4.5 11.5L11 5l7 7-6.5 6.5a1.5 1.5 0 01-2 0L4.5 13.5a1.4 1.4 0 010-2z"/><path d="M4 12h14"/><path d="M20 14.5s1.8 2.4 1.8 3.5a1.8 1.8 0 01-3.6 0c0-1.1 1.8-3.5 1.8-3.5z"/>',
  blur: '<path d="M12 3c3 4.5 6 7.7 6 11a6 6 0 01-12 0c0-3.3 3-6.5 6-11z"/>',
  sharpen: '<path d="M12 3l7 17H5z"/>',
  smudge: '<path d="M9 13V5.5a1.5 1.5 0 013 0V12"/><path d="M12 11.5v-1a1.5 1.5 0 013 0V12M15 11.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a5 5 0 01-4-2l-2.5-3.5a1.5 1.5 0 012.3-1.9L9 15"/>',
  dodge: '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l7.5 7.5"/>',
  burn: '<path d="M7 21v-8a5 5 0 0110 0v8z"/><path d="M10 13v-2.5a2 2 0 014 0V13"/>',
  sponge: '<rect x="3.5" y="7" width="17" height="11" rx="3.5"/><circle cx="8.5" cy="11" r=".9"/><circle cx="13.5" cy="13.5" r=".9"/><circle cx="16" cy="10.5" r=".9"/>',
  text: '<path d="M5 5.5V4h14v1.5M12 4v16M9 20h6"/>',
  shape: '<rect x="3" y="3" width="10" height="10" rx="1"/><circle cx="16" cy="16" r="5"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 10.5V4a1.5 1.5 0 013 0v6.5M14 10.5V5.5a1.5 1.5 0 013 0V13c0 4.5-2.5 8-7 8-2.5 0-4.5-1.5-6-4l-1.5-2.5a1.5 1.5 0 012.5-1.6L8 15"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  mask: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" opacity=".75"/>',
  fx: '<path d="M10 4H7.5A2.5 2.5 0 005 6.5V20M3 11h6M13 10l7 9M20 10l-7 9"/>',
  swap: '<path d="M7 4h9a3 3 0 013 3v9"/><path d="M16 13l3 3 3-3M10 1L7 4l3 3"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 014.5 5H9l2 2.5h8.5A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 005 4.5v15A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  pen: '<path d="M12 3l6 9-6 9-6-9z"/><circle cx="12" cy="12" r="1.6"/><path d="M12 3v7.4"/>',
  quicksel: '<path d="M4 20c2-1 3-3 3-5a3 3 0 016 0c0 2-2 3-2 5"/><circle cx="16.5" cy="7.5" r="4" stroke-dasharray="2.4 1.6"/>',
  redeye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><path d="M18 3l3 3M21 3l-3 3"/>',
  colorrep: '<path d="M19.5 3.5l1 1-8.5 9.5-2-2z"/><path d="M10 12c-2.5 0-4.5 1.5-4.5 4 0 1.5-1 2.5-2.5 3.5 3.5.5 8-.5 8.5-4.5"/><circle cx="18" cy="17" r="3"/>',
  adjust: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor" stroke="none"/>',
  group: '<path d="M3 6.5A1.5 1.5 0 014.5 5H9l2 2.5h8.5A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  healbrush: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9 12h6M12 9v6"/>',
  patch: '<path d="M4 9c2-4 7-6 11-4l5 3-3 9c-4 2-9 1-11-2z" stroke-dasharray="2.5 1.8"/><path d="M8 13h8"/>',
  camove: '<rect x="3" y="3" width="9" height="9" stroke-dasharray="2.4 1.6"/><path d="M14 14h7v7h-7zM12 7h4v4"/>',
  remove: '<path d="M18.5 4.5l1 1-8 9-2-2z"/><path d="M9.5 12.5c-2.5 0-4.5 1.5-4.5 4 0 1.5-1 2.5-2.5 3.5 3.5.5 8-.5 8.5-4.5"/><path d="M15 15l5 5M20 15l-5 5"/>',
  patternstamp: '<path d="M9 3h6v4.5L13.5 11H19v4H5v-4h5.5L9 7.5z"/><path d="M5 19h3M10.5 19h3M16 19h3"/>',
  historybrush: '<path d="M19.5 3.5l1 1-8.5 9.5-2-2z"/><path d="M10 12c-2.5 0-4.5 1.5-4.5 4 0 1.5-1 2.5-2.5 3.5 3.5.5 8-.5 8.5-4.5"/><path d="M14 18a4 4 0 107-2.6M21 13v3h-3"/>',
  bgeraser: '<path d="M3.5 16.5l9-9 7 7-5 5h-6.5z"/><path d="M14 20.5h7"/><path d="M5 5l3 3M8 5L5 8"/>',
  magiceraser: '<path d="M3.5 16.5l9-9 7 7-5 5h-6.5z"/><path d="M14 20.5h7"/><path d="M17 2v3M15.5 3.5h3"/>',
  rowmarquee: '<path d="M3 12h18" stroke-dasharray="3 2"/><path d="M3 9v6M21 9v6"/>',
  colmarquee: '<path d="M12 3v18" stroke-dasharray="3 2"/><path d="M9 3h6M9 21h6"/>',
  maglasso: '<path d="M8 17c-4-1.5-5-5-3-8s7-5 11-4 6 4 4 7-6 4-9 3"/><path d="M8 17v4h3"/><path d="M16 15l4 4" stroke-width="2.4"/>',
  objsel: '<rect x="3" y="3" width="18" height="18" rx="1" stroke-dasharray="3 2"/><path d="M8 17c0-3 2-6 4-6s4 3 4 6z"/><circle cx="12" cy="8" r="2"/>',
  perspcrop: '<path d="M7 3l-2 15 15 2"/><path d="M3 7l14-2 2 15"/>',
  rulertool: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  sampler: '<path d="M14.5 6.5l3 3L8 19H5v-3z"/><path d="M13 5l6 6"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  mixer: '<path d="M19.5 3.5l1 1-8.5 9.5-2-2z"/><path d="M10 12c-2.5 0-4.5 1.5-4.5 4 0 1.5-1 2.5-2.5 3.5 3.5.5 8-.5 8.5-4.5"/><path d="M16 15c1.5 1 3 1 4 3"/><circle cx="18" cy="9" r="1.2"/>',
  freepen: '<path d="M12 3l6 9-6 9-6-9z"/><path d="M3 21c3-3 4 1 7-2"/>',
  curvpen: '<path d="M12 3l6 9-6 9-6-9z"/><path d="M4 8c2-4 6-4 8 0s6 4 8 0"/>',
  typemask: '<path d="M5 5.5V4h14v1.5M12 4v16M9 20h6" stroke-dasharray="2.5 1.8"/>',
  count: '<path d="M4 7h3v10M4 17h6"/><path d="M13 9a2.5 2.5 0 015 0c0 2-5 4-5 8h5"/>',
  note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 11h8M8 15h6"/>',
  textLayer: '<path d="M6 6V5h12v1M12 5v14M9.5 19h5"/>',
};
MP.icon = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, html) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const need = (fn) => () => { if (!MP.doc) { MP.toast('Ouvrez ou créez d\'abord un document'); return; } fn(); };

MP.ui = {};
const UI = MP.ui;

/* ============ Menus ============ */
const adj = (k) => need(() => MP.runAdjust(k, false));
const flt = (k) => need(() => MP.runAdjust(k, true));
UI.menus = () => [
  { label: 'Fichier', items: [
    { label: 'Nouveau…', sc: 'Ctrl+N', act: () => UI.dialogs.newDoc() },
    { label: 'Ouvrir…', sc: 'Ctrl+O', act: () => MP.io.open() },
    { label: 'Ouvrir récent', sub: () => { const r = MP.io.recent(); return r.length ? r.map((p) => ({ label: p.split(/[\\/]/).pop(), title: p, act: () => MP.io.openRecent(p) })) : [{ label: '(aucun)', disabled: true }]; } },
    { label: 'Nouveau d\'après le presse-papiers', sc: 'Ctrl+Alt+N', act: () => MP.cmd.newFromClipboard() },
    { label: 'Importer une image comme calque…', sc: 'Ctrl+Maj+O', act: () => MP.io.place() },
    '-',
    { label: 'Enregistrer le projet', sc: 'Ctrl+S', act: need(() => MP.io.save(false)) },
    { label: 'Enregistrer sous…', sc: 'Ctrl+Maj+S', act: need(() => MP.io.save(true)) },
    { label: 'Enregistrer au format Photoshop (PSD)…', sc: 'Ctrl+Alt+Maj+S', act: need(() => MP.io.savePsd()) },
    { label: 'Exporter (PNG, JPEG, WebP)…', sc: 'Ctrl+Alt+Maj+W', act: need(() => UI.dialogs.exportImg()) },
    { label: 'Exporter les calques en PNG (ZIP)…', act: need(() => MP.cmd.exportLayers(false)) },
    { label: 'Imprimer…', sc: 'Ctrl+P', act: need(() => MP.cmd.print()) },
    '-',
    { label: 'Fermer', sc: 'Ctrl+W', act: need(() => UI.closeDoc(MP.doc)) },
    { label: 'Quitter', sc: 'Ctrl+Q', act: () => MP.native.quit() },
  ] },
  { label: 'Édition', items: [
    { label: () => 'Annuler ' + (MP.doc?.history.undoStack.at(-1)?.label || ''), sc: 'Ctrl+Z', act: need(() => UI.undo()) },
    { label: () => 'Rétablir ' + (MP.doc?.history.redoStack.at(-1)?.label || ''), sc: 'Ctrl+Y', act: need(() => UI.redo()) },
    '-',
    { label: 'Couper', sc: 'Ctrl+X', act: need(() => MP.edit.cut()) },
    { label: 'Copier', sc: 'Ctrl+C', act: need(() => MP.edit.copy(false)) },
    { label: 'Copier avec fusion', sc: 'Ctrl+Maj+C', act: need(() => MP.edit.copy(true)) },
    { label: 'Coller', sc: 'Ctrl+V', act: () => UI.pasteFromAnywhere() },
    { label: 'Effacer', sc: 'Suppr', act: need(() => MP.edit.clear()) },
    '-',
    { label: 'Remplir…', sc: 'Maj+F5', act: need(() => UI.dialogs.fill()) },
    { label: 'Remplir d\'après le contenu (supprimer un objet)', act: need(() => MP.edit.fill({ what: 'content' })) },
    { label: 'Échelle basée sur le contenu…', sc: 'Ctrl+Alt+Maj+C', act: need(() => UI.dialogs.contentScale()) },
    { label: 'Déformation (grille)', act: need(() => { MP.startTransform(); if (MP.tool === MP.tools.transform) MP.tools.transform.toggleWarp(); }) },
    { label: 'Remplacement du ciel…', act: need(() => UI.dialogs.sky()) },
    '-',
    { label: 'Définir un motif', act: need(() => MP.cmd.definePattern()) },
    { label: 'Définir une forme de pinceau', act: need(() => MP.cmd.defineBrush()) },
    { label: 'Contour…', act: need(() => UI.dialogs.stroke()) },
    '-',
    { label: 'Transformation manuelle', sc: 'Ctrl+T', act: need(() => MP.startTransform()) },
    { label: 'Perspective / Torsion', act: need(() => { MP.startTransform(); if (MP.tool === MP.tools.transform) MP.tools.transform.toggleDistort(); }) },
    { label: 'Symétrie horizontale du calque', act: need(() => MP.flipImage(true, true)) },
    { label: 'Symétrie verticale du calque', act: need(() => MP.flipImage(false, true)) },
    '-',
    { label: 'Préférences…', sc: 'Ctrl+K', act: () => UI.dialogs.prefs() },
  ] },
  { label: 'Image', items: [
    { label: 'Réglages', sub: () => [
      { label: 'Luminosité/Contraste…', act: adj('brightness') }, { label: 'Niveaux…', sc: 'Ctrl+L', act: adj('levels') }, { label: 'Courbes…', sc: 'Ctrl+M', act: adj('curves') }, { label: 'Exposition…', act: adj('exposure') },
      '-', { label: 'Lumière… (2026)', act: adj('light') }, { label: 'Couleur et vibrance… (2026)', act: adj('colorVibrance') }, { label: 'Clarté et suppression de brume…', act: adj('clarity') }, { label: 'Grain…', act: adj('grain') },
      '-', { label: 'Vibrance…', act: adj('vibrance') }, { label: 'Teinte/Saturation…', sc: 'Ctrl+U', act: adj('hueSat') }, { label: 'Balance des couleurs…', sc: 'Ctrl+B', act: adj('colorBalance') }, { label: 'Noir et blanc…', sc: 'Ctrl+Alt+Maj+B', act: adj('blackWhite') }, { label: 'Filtre photo…', act: adj('photoFilter') },
      '-', { label: 'Mélangeur de couches…', act: adj('channelMixer') }, { label: 'Correction sélective…', act: adj('selectiveColor') }, { label: 'Correspondance de couleurs (LUT)…', act: adj('colorLookup') },
      '-', { label: 'Tons foncés/Tons clairs…', act: adj('shadowsHighlights') }, { label: 'Courbe de transfert de dégradé…', act: adj('gradientMap') }, { label: 'Harmoniser avec l\'arrière-plan…', act: need(() => MP.cmd.harmonize()) },
      '-', { label: 'Négatif', sc: 'Ctrl+I', act: adj('invert') }, { label: 'Isohélie…', act: adj('posterize') }, { label: 'Seuil…', act: adj('threshold') }, { label: 'Sépia', act: adj('sepia') }, { label: 'Désaturation', sc: 'Ctrl+Maj+U', act: adj('desaturate') }, { label: 'Égaliser', act: adj('equalize') },
    ] },
    { label: 'Contraste automatique', sc: 'Ctrl+Maj+L', act: adj('autoContrast') },
    { label: 'Dupliquer l\'image', act: need(() => MP.cmd.duplicateImage()) },
    '-',
    { label: 'Taille de l\'image…', sc: 'Ctrl+Alt+I', act: need(() => UI.dialogs.imageSize()) },
    { label: 'Taille de la zone de travail…', sc: 'Ctrl+Alt+C', act: need(() => UI.dialogs.canvasSize()) },
    { label: 'Rotation de l\'image', sub: () => [
      { label: '180°', act: need(() => MP.rotateImage(180)) }, { label: '90° horaire', act: need(() => MP.rotateImage(90)) }, { label: '90° antihoraire', act: need(() => MP.rotateImage(-90)) },
      { label: 'Paramétrée…', act: need(() => UI.dialog({ title: 'Rotation de l\'image', fields: [{ k: 'a', label: 'Angle (°)', type: 'number', min: -359, max: 359, step: 0.1 }], values: { a: 15 }, onOk: (v) => MP.rotateImage(+v.a) })) },
      '-', { label: 'Symétrie horizontale de l\'image', act: need(() => MP.flipImage(true)) }, { label: 'Symétrie verticale de l\'image', act: need(() => MP.flipImage(false)) },
    ] },
    '-',
    { label: 'Recadrer sur la sélection', act: need(() => { const b = MP.sel.bounds(MP.doc); if (!b) return MP.toast('Aucune sélection'); MP.cropDoc(b.x, b.y, b.w, b.h); }) },
    { label: 'Rogner (pixels transparents)', act: need(() => MP.trimImage()) },
  ] },
  { label: 'Calque', items: [
    { label: 'Nouveau calque', sc: 'Ctrl+Maj+N', act: need(() => MP.layerOps.add()) },
    { label: 'Nouveau groupe', act: need(() => MP.layerOps.newGroup(false)) },
    { label: 'Grouper le calque', sc: 'Ctrl+G', act: need(() => MP.layerOps.newGroup(true)) },
    { label: 'Dissocier le groupe', sc: 'Ctrl+Maj+G', act: need(() => MP.layerOps.ungroup()) },
    { label: 'Dupliquer / calque par copier', sc: 'Ctrl+J', act: need(() => UI.layerViaCopy()) },
    { label: 'Supprimer le calque', act: need(() => MP.layerOps.remove()) },
    '-',
    { label: 'Nouveau calque de réglage', sub: () => MP.ADJ_LAYER_KEYS.map((k) => ({ label: MP.ADJUST[k].title + (MP.ADJUST[k].fields ? '…' : ''), act: need(() => MP.layerOps.addAdjust(k)) })) },
    { label: 'Style de calque', sub: () => [{ label: 'Options de style (ombre, contour, biseau…)…', act: need(() => UI.dialogs.layerStyle()) }, { label: 'Effacer le style', act: need(() => MP.layerOps.clearStyle()) }, { label: 'Pixelliser le style', act: need(() => MP.layerOps.bakeStyle()) }] },
    { label: 'Masque de fusion', sub: () => [
      { label: 'Tout faire apparaître', act: need(() => MP.layerOps.addMask(false, false)) }, { label: 'Tout masquer', act: need(() => MP.layerOps.addMask(false, true)) }, { label: 'D\'après la sélection', act: need(() => MP.layerOps.addMask(true)) },
      '-', { label: 'Inverser le masque', act: need(() => MP.layerOps.invertMask()) }, { label: 'Activer / désactiver', act: need(() => MP.layerOps.toggleMask()) }, { label: 'Appliquer', act: need(() => MP.layerOps.applyMask()) }, { label: 'Supprimer', act: need(() => MP.layerOps.deleteMask()) },
    ] },
    { label: 'Pixelliser (texte ou style)', act: need(() => MP.layerOps.rasterize()) },
    '-',
    { label: 'Disposition', sub: () => [
      { label: 'Premier plan', sc: 'Ctrl+Maj+]', act: need(() => MP.layerOps.toTop()) }, { label: 'En avant', sc: 'Ctrl+]', act: need(() => MP.layerOps.move(1)) },
      { label: 'En arrière', sc: 'Ctrl+[', act: need(() => MP.layerOps.move(-1)) }, { label: 'Arrière-plan', sc: 'Ctrl+Maj+[', act: need(() => MP.layerOps.toBottom()) },
    ] },
    { label: 'Aligner', sub: () => [['left', 'Bords gauches'], ['hcenter', 'Centres horizontaux'], ['right', 'Bords droits'], ['top', 'Bords supérieurs'], ['vcenter', 'Centres verticaux'], ['bottom', 'Bords inférieurs']].map(([k, l]) => ({ label: l, act: need(() => MP.alignLayer(k)) })) },
    '-',
    { label: 'Fusionner vers le bas / le groupe', sc: 'Ctrl+E', act: need(() => MP.layerOps.mergeDown()) },
    { label: 'Fusionner les calques visibles', sc: 'Ctrl+Maj+E', act: need(() => MP.layerOps.mergeVisible()) },
    { label: 'Aplatir l\'image', act: need(() => MP.layerOps.flatten()) },
    { label: 'Nettoyer les calques (supprimer les vides)', act: need(() => MP.cmd.cleanupLayers()) },
  ] },
  { label: 'Sélection', items: [
    { label: 'Tout sélectionner', sc: 'Ctrl+A', act: need(() => UI.selCmd('Tout sélectionner', (d) => MP.sel.all(d))) },
    { label: 'Désélectionner', sc: 'Ctrl+D', act: need(() => UI.selCmd('Désélectionner', (d) => MP.sel.none(d))) },
    { label: 'Intervertir', sc: 'Ctrl+Maj+I', act: need(() => UI.selCmd('Intervertir', (d) => MP.sel.invert(d))) },
    '-',
    { label: '✨ Sujet (IA)', act: need(() => MP.ai.selectSubject()) },
    { label: 'Ciel', act: need(() => MP.sky.select()) },
    { label: 'Zone de mise au point…', act: need(() => UI.dialog({ title: 'Zone de mise au point', fields: [{ type: 'info', html: 'Sélectionne les parties nettes de la photo (sujet net sur fond flou).' }, { k: 'p', label: 'Part de l\'image nette', type: 'range', min: 5, max: 90, unit: '%' }], values: { p: 35 }, onOk: (v) => { MP.cmd.focusArea(v.p); } })) },
    { label: 'Sélectionner et masquer…', sc: 'Ctrl+Alt+R', act: need(() => MP.cmd.selectAndMask()) },
    { label: 'Pixels du calque', act: need(() => UI.selCmd('Sélectionner les pixels', (d) => MP.sel.fromLayerAlpha(d, d.layer))) },
    { label: 'Plage de couleurs (couleur de 1er plan)…', act: need(() => UI.dialog({ title: 'Plage de couleurs', fields: [{ k: 't', label: 'Tolérance', type: 'range', min: 0, max: 100 }], values: { t: 25 }, onOk: (v) => UI.colorRange(v.t) })) },
    { label: () => (MP.doc && MP.doc.quickMask ? '✓ ' : '') + 'Mode Masque rapide', sc: 'Q', act: need(() => MP.toggleQuickMask()) },
    '-',
    { label: 'Modifier', sub: () => [
      { label: 'Contour progressif…', sc: 'Maj+F6', act: need(() => UI.selModDialog('Contour progressif', (d, r) => MP.sel.feather(d, r), 5)) },
      { label: 'Dilater…', act: need(() => UI.selModDialog('Dilater', (d, r) => MP.sel.modify(d, r), 5)) },
      { label: 'Contracter…', act: need(() => UI.selModDialog('Contracter', (d, r) => MP.sel.modify(d, -r), 5)) },
      { label: 'Lisser…', act: need(() => UI.selModDialog('Lisser', (d, r) => MP.sel.smooth(d, r), 4)) },
    ] },
  ] },
  { label: 'Filtre', items: [
    { label: 'Filtre Camera Raw…', sc: 'Ctrl+Maj+A', act: adj('cameraRaw') },
    { label: 'Fluidité…', sc: 'Ctrl+Maj+X', act: need(() => MP.liquify.open()) },
    { label: 'Galerie de filtres', sub: () => [['sketch', 'Croquis au crayon'], ['watercolor', 'Aquarelle'], ['cutout', 'Découpage'], ['glowEdges', 'Contours lumineux'], ['posterEdges', 'Contours postérisés (BD)'], ['charcoal', 'Fusain'], ['filmGrain', 'Grain photo'], ['pointillism', 'Pointillisme'], ['neon', 'Néon']].map(([k, l]) => ({ label: l + '…', act: flt(k) })) },
    '-',
    { label: 'Flou', sub: () => [{ label: 'Flou gaussien…', act: flt('gaussian') }, { label: 'Flou de mouvement…', act: flt('motion') }, { label: 'Flou radial (zoom)…', act: flt('radial') }, { label: 'Tilt-shift (miniature)…', act: flt('tiltShift') }, { label: 'Flou de diaphragme…', act: flt('iris') }, { label: 'Flou de surface…', act: flt('surface') }] },
    { label: 'Renforcement', sub: () => [{ label: 'Accentuation…', act: flt('unsharp') }, { label: 'Plus net', act: flt('sharpen') }] },
    { label: 'Bruit', sub: () => [{ label: 'Ajout de bruit…', act: flt('noise') }, { label: 'Médiane (réduire le bruit)…', act: flt('median') }, { label: 'Antipoussière…', act: flt('dust') }, { label: 'Réduction du bruit (flou de surface)…', act: flt('surface') }] },
    { label: 'Déformation', sub: () => [{ label: 'Tourbillon…', act: flt('twirl') }, { label: 'Sphérisation…', act: flt('spherize') }, { label: 'Ondulation…', act: flt('wave') }, { label: 'Coordonnées polaires…', act: flt('polar') }] },
    { label: 'Pixellisation', sub: () => [{ label: 'Mosaïque…', act: flt('pixelate') }, { label: 'Demi-teintes…', act: flt('halftone') }, { label: 'Cristallisation…', act: flt('crystallize') }] },
    { label: 'Esthétiques', sub: () => [{ label: 'Estampage…', act: flt('emboss') }, { label: 'Contours (Sobel)…', act: flt('edges') }, { label: 'Peinture à l\'huile…', act: flt('oil') }, { label: 'Lueur douce (Orton)…', act: flt('glow') }] },
    { label: 'Rendu', sub: () => [{ label: 'Nuages…', act: flt('clouds') }, { label: 'Halo (reflet d\'objectif)…', act: flt('flare') }, { label: 'Vignettage…', act: flt('vignette') }] },
    { label: 'Divers', sub: () => [{ label: 'Passe-haut…', act: flt('highpass') }, { label: 'Minimum…', act: flt('minimum') }, { label: 'Maximum…', act: flt('maximum') }, { label: 'Décalage…', act: flt('offset') }] },
  ] },
  { label: 'IA', items: [
    { label: '✨ Remplissage génératif…', sc: 'Ctrl+Maj+F', act: need(() => UI.dialogs.genFill()) },
    { label: '✨ Extension générative…', act: need(() => UI.dialogs.genExpand()) },
    { label: '✨ Générer une image…', act: () => UI.dialogs.genImage() },
    '-',
    { label: '✨ Supprimer l\'arrière-plan', act: need(() => MP.ai.removeBackground()) },
    { label: '✨ Coloriser une photo noir et blanc', act: need(() => MP.ai.colorize()) },
    { label: '✨ Sélectionner le sujet', act: need(() => MP.ai.selectSubject()) },
    '-',
    { label: 'Paramètres IA (clé API)…', act: () => UI.dialogs.prefs('ai') },
  ] },
  { label: 'Affichage', items: [
    { label: 'Zoom avant', sc: 'Ctrl++', act: need(() => MP.view.zoomStep(1)) },
    { label: 'Zoom arrière', sc: 'Ctrl+-', act: need(() => MP.view.zoomStep(-1)) },
    { label: 'Adapter à l\'écran', sc: 'Ctrl+0', act: need(() => MP.view.fit()) },
    { label: 'Taille réelle (100 %)', sc: 'Ctrl+1', act: need(() => MP.view.setZoom(1, null, true)) },
    '-',
    { label: () => (MP.prefs.rulers !== false ? '✓ ' : '') + 'Règles', sc: 'Ctrl+R', act: () => { MP.prefs.rulers = MP.prefs.rulers === false; MP.savePrefs(); MP.guides.apply(); } },
    { label: () => (MP.guides.show ? '✓ ' : '') + 'Repères', sc: 'Ctrl+;', act: () => { MP.guides.show = !MP.guides.show; MP.renderView(); } },
    { label: () => (MP.guides.snapOn ? '✓ ' : '') + 'Magnétisme', act: () => { MP.guides.snapOn = !MP.guides.snapOn; } },
    { label: 'Nouveau repère…', act: need(() => UI.dialog({ title: 'Nouveau repère', fields: [{ k: 'dir', label: 'Orientation', type: 'select', options: [['h', 'Horizontale'], ['v', 'Verticale']] }, { k: 'pos', label: 'Position (px)', type: 'number', min: 0, max: 30000 }], values: { dir: 'v', pos: Math.round(MP.doc.width / 2) }, onOk: (v) => { MP.doc.guides.push({ dir: v.dir, pos: +v.pos }); MP.guides.show = true; MP.renderView(); } })) },
    { label: 'Effacer les repères', act: need(() => { MP.doc.guides = []; MP.renderView(); }) },
    '-',
    { label: () => (MP.settings.showGrid ? '✓ ' : '') + 'Grille', sc: 'Ctrl+\'', act: () => { MP.settings.showGrid = !MP.settings.showGrid; MP.renderView(); } },
    { label: () => (MP.showMaskOnly ? '✓ ' : '') + 'Afficher le masque seul', act: () => { MP.showMaskOnly = !MP.showMaskOnly; MP.renderView(); } },
    { label: 'Plein écran', sc: 'F11', act: () => MP.native.toggleFullscreen() },
  ] },
  { label: 'Aide', items: [{ label: 'Raccourcis clavier', sc: 'F1', act: () => UI.dialogs.shortcuts() }, { label: 'À propos de Multipify Photo', act: () => UI.dialogs.about() }] },
];

UI.buildMenus = () => {
  const bar = $('#menus'); bar.innerHTML = '';
  let open = null;
  const close = () => { document.querySelectorAll('.dropdown').forEach((d) => d.remove()); bar.querySelectorAll('.menu').forEach((m) => m.classList.remove('open')); open = null; };
  const renderList = (items, x, y, level = 0, path = []) => {
    const dd = el('div', { class: 'dropdown' }); dd.style.left = x + 'px'; dd.style.top = y + 'px'; dd.dataset.level = level;
    for (const it of items) {
      if (it === '-') { dd.appendChild(el('div', { class: 'sep' })); continue; }
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const row = el('div', { class: 'item' + (it.disabled ? ' disabled' : '') + (it.sub ? ' has-sub' : ''), title: it.title || '' }, `<span>${esc(label)}</span><kbd>${it.sc ? esc(it.sc) : it.sub ? '▸' : ''}</kbd>`);
      row.addEventListener('mouseenter', () => {
        document.querySelectorAll('.dropdown').forEach((d) => { if (+d.dataset.level > level) d.remove(); });
        if (it.sub) { const r = row.getBoundingClientRect(); const sub = renderList(it.sub(), r.right - 2, r.top - 4, level + 1, [...path, label]); const sr = sub.getBoundingClientRect(); if (sr.right > innerWidth) sub.style.left = r.left - sr.width + 2 + 'px'; if (sr.bottom > innerHeight) sub.style.top = Math.max(0, innerHeight - sr.height - 4) + 'px'; }
      });
      if (!it.sub && !it.disabled) row.addEventListener('click', () => { close(); setTimeout(() => UI.exec([...path, label], it.act), 0); });
      dd.appendChild(row);
    }
    document.body.appendChild(dd); return dd;
  };
  for (const m of UI.menus()) {
    const b = el('div', { class: 'menu' }, esc(m.label));
    const show = () => { close(); b.classList.add('open'); open = b; const r = b.getBoundingClientRect(); renderList(UI.menus().find((x) => x.label === m.label).items, r.left, r.bottom, 0, [m.label]); };
    b.addEventListener('mousedown', (e) => { e.stopPropagation(); if (open === b) close(); else show(); });
    b.addEventListener('mouseenter', () => { if (open && open !== b) show(); });
    bar.appendChild(b);
  }
  document.addEventListener('mousedown', (e) => { if (open && !e.target.closest('.dropdown')) close(); });
  UI.closeMenus = close;
  // table des raccourcis
  UI.shortcutMap = new Map();
  const walk = (items, path) => items.forEach((it) => { if (it === '-') return; const lb = typeof it.label === 'function' ? it.label() : it.label; if (it.sc) UI.shortcutMap.set(normSc(it.sc), { act: it.act, path: [...path, lb] }); if (it.sub) walk(it.sub(), [...path, lb]); });
  UI.menus().forEach((m) => walk(m.items, [m.label]));
};
const normSc = (sc) => { const parts = sc.split('+'); let key = parts.pop() || '+'; if (key === '' ) key = '+'; const mods = parts.map((p) => p.toLowerCase()); return `${mods.includes('ctrl') ? 'c' : ''}${mods.includes('alt') ? 'a' : ''}${mods.includes('maj') ? 's' : ''}|${key.toLowerCase() === 'suppr' ? 'delete' : key.toLowerCase()}`; };
const evSc = (e) => { let k = e.key.toLowerCase(); if (k === '=') k = '+'; if (e.code === 'BracketRight') k = ']'; if (e.code === 'BracketLeft') k = '['; if (/^Digit\d$/.test(e.code)) k = e.code.slice(5); if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3).toLowerCase(); if (e.code === 'NumpadAdd') k = '+'; if (e.code === 'NumpadSubtract' || e.code === 'Minus' || e.code === 'Digit6' && e.key === '-') k = '-'; if (e.code === 'Quote' || e.code === 'Digit4' && e.key === "'") k = "'"; return `${e.ctrlKey || e.metaKey ? 'c' : ''}${e.altKey ? 'a' : ''}${e.shiftKey ? 's' : ''}|${k}`; };

UI.selCmd = (label, fn) => { const d = MP.doc; d.history.record(label, null); fn(d); UI.refreshAll(); MP.render(); };
UI.selModDialog = (title, fn, def) => { if (!MP.doc.selection) return MP.toast('Aucune sélection'); UI.dialog({ title, fields: [{ k: 'r', label: 'Rayon (px)', type: 'number', min: 1, max: 500 }], values: { r: def }, onOk: (v) => UI.selCmd(title, (d) => fn(d, +v.r)) }); };
UI.colorRange = (t) => { const d = MP.doc, src = MP.cloneCanvas(d.composite(null, { noLive: true })), c = src.getContext('2d'); const tmp = MP.createCanvas(1, 1); void tmp; const id = c.getImageData(0, 0, 1, 1); const col = MP.hexToRgb(MP.colors.fg); id.data.set([col.r, col.g, col.b, 255]); const saved = c.getImageData(0, 0, 1, 1); c.putImageData(id, 0, 0); const m = MP.floodMask(src, 0, 0, t, false); c.putImageData(saved, 0, 0); UI.selCmd('Plage de couleurs', (dd) => MP.sel.fromMask(dd, m)); };
UI.layerViaCopy = () => {
  const d = MP.doc; if (!d.selection) return MP.layerOps.duplicate();
  const src = MP.layerOps.bake(d.layer); d.clipToSelection(src);
  d.history.record('Calque par copier', null); const l = d.addLayer(d.layers[d.active].name + ' (copie)'); l.canvas = src; MP.afterEdit();
};
UI.undo = () => { const t = MP.tool; if (t && t.cancel && (t.eng || t.on || t.drag || t.dragging)) t.cancel(); if (MP.tool === MP.tools.transform) { MP.tools.transform.abort(); return; } if (MP.doc.history.undo()) { MP.live = null; MP.afterEdit(); UI.refreshAll(); } };
UI.redo = () => { if (MP.doc.history.redo()) { MP.afterEdit(); UI.refreshAll(); } };
UI.pasteFromAnywhere = async () => {
  if (MP.edit.clip) return MP.edit.paste();
  if (MP.native.readClipboardImage) { const data = await MP.native.readClipboardImage(); if (data) { const c = await MP.io.loadImage(data, 'collage.png'); MP.edit.pasteCanvas(c, 'Image collée'); return; } }
  try { const items = await navigator.clipboard.read(); for (const it of items) { const t = it.types.find((x) => x.startsWith('image/')); if (t) { const b = await it.getType(t); const c = await MP.io.loadImage(new Uint8Array(await b.arrayBuffer()), 'collage.png'); MP.edit.pasteCanvas(c, 'Image collée'); return; } } } catch (_) { /* accès refusé */ }
  MP.toast('Aucune image dans le presse-papiers');
};

/* ============ Barre d'outils ============ */
UI.SLOTS = [
  ['V', ['move']], ['M', ['marquee', 'ellipse', 'rowmarquee', 'colmarquee']], ['L', ['lasso', 'maglasso']], ['W', ['objsel', 'quicksel', 'wand']],
  ['C', ['crop', 'perspcrop']], ['I', ['eyedropper', 'sampler', 'ruler']], ['J', ['heal', 'remove', 'healbrush', 'patch', 'camove', 'redeye']],
  ['B', ['brush', 'pencil', 'colorrep']], ['S', ['clone', 'patternstamp']], ['Y', ['historybrush']], ['E', ['eraser', 'bgeraser', 'magiceraser']],
  ['G', ['gradient', 'bucket']], ['R', ['blur', 'sharpen', 'smudge']], ['O', ['dodge', 'burn', 'sponge']], ['P', ['pen']], ['T', ['text']], ['U', ['shape']], ['H', ['hand']], ['Z', ['zoom']],
].map(([key, tools]) => ({ key, tools: tools.filter((id) => MP.tools[id]), cur: tools[0] }));
UI.slotOf = (id) => UI.SLOTS.find((s) => s.tools.includes(id));
UI.buildToolbar = () => {
  const tb = $('#tools'); tb.innerHTML = '';
  for (const sl of UI.SLOTS) {
    for (const id of sl.tools) { MP.tools[id].key = sl.key; }
    const b = el('button', { class: 'tool' + (sl.tools.length > 1 ? ' multi' : ''), 'data-slot': sl.key });
    const paint = () => { const t = MP.tools[sl.cur]; b.innerHTML = MP.icon(t.icon); b.title = `${t.name} (${sl.key})` + (sl.tools.length > 1 ? ' — clic droit ou appui long : autres outils, Maj+' + sl.key + ' pour alterner' : ''); };
    sl.paint = paint; paint();
    let hold = null;
    b.addEventListener('pointerdown', (e) => { if (e.button === 0 && sl.tools.length > 1) hold = setTimeout(() => { hold = 'open'; UI.toolFlyout(sl, b); }, 380); });
    b.addEventListener('pointerup', (e) => { if (e.button !== 0) return; if (hold === 'open') { hold = null; return; } clearTimeout(hold); hold = null; MP.setTool(sl.cur); });
    b.addEventListener('pointerleave', () => { if (hold && hold !== 'open') { clearTimeout(hold); hold = null; } });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (sl.tools.length > 1) UI.toolFlyout(sl, b); });
    tb.appendChild(b);
  }
  const cs = $('#toolcolors');
  cs.innerHTML = `<div class="swatches"><div class="sw bg" title="Couleur d'arrière-plan"></div><div class="sw fg" title="Couleur de premier plan"></div></div>
  <div class="cbtns"><button class="mini" id="swapColors" title="Permuter (X)">${MP.icon('swap', 14)}</button><button class="mini" id="defColors" title="Couleurs par défaut (D)"><span class="defico"></span></button></div>`;
  cs.querySelector('.fg').onclick = () => { UI.colorTarget = 'fg'; UI.refreshColors(); UI.openColorDialog('fg'); };
  cs.querySelector('.bg').onclick = () => { UI.colorTarget = 'bg'; UI.refreshColors(); UI.openColorDialog('bg'); };
  $('#swapColors').onclick = () => { [MP.colors.fg, MP.colors.bg] = [MP.colors.bg, MP.colors.fg]; UI.refreshColors(); };
  $('#defColors').onclick = () => { MP.colors.fg = '#000000'; MP.colors.bg = '#ffffff'; UI.refreshColors(); };
};
UI.toolFlyout = (sl, btn) => {
  document.querySelectorAll('.dropdown').forEach((x) => x.remove());
  const r = btn.getBoundingClientRect(), dd = el('div', { class: 'dropdown flyout' });
  for (const id of sl.tools) { const t = MP.tools[id], row = el('div', { class: 'item' + (MP.tool && MP.tool.id === id ? ' cur' : '') }, `<span class="fi">${MP.icon(t.icon, 16)} ${esc(t.name)}</span><kbd>${sl.key}</kbd>`); row.onclick = () => { dd.remove(); sl.cur = id; MP.setTool(id); }; dd.appendChild(row); }
  dd.style.left = r.right + 4 + 'px'; dd.style.top = r.top + 'px'; document.body.appendChild(dd);
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!e.target.closest('.dropdown')) { dd.remove(); document.removeEventListener('mousedown', off); } }), 0);
};
UI.refreshTool = () => {
  const sl = MP.tool && UI.slotOf(MP.tool.id); if (sl && sl.cur !== MP.tool.id) { sl.cur = MP.tool.id; sl.paint && sl.paint(); }
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', !!sl && b.dataset.slot === sl.key));
  const t = MP.tool, ob = $('#options'); ob.innerHTML = '';
  if (!t) return;
  ob.appendChild(el('div', { class: 'opt-title' }, `${MP.icon(t.icon, 18)}<span>${esc(t.name)}</span>`));
  for (const o of t.options || []) if (!o.adv) ob.appendChild(UI.control(o, t.opts, () => { MP.render(); UI.syncBrushPanel && UI.syncBrushPanel(); }, true));
  if ((t.options || []).some((o) => o.adv)) { const b = el('button', { class: 'btn small', title: 'Paramètres avancés du pinceau (panneau Pinceaux)' }, '⚙ Pinceau…'); b.onclick = () => UI.showPanel && UI.showPanel('panel-brushes'); ob.appendChild(b); }
  if (t.hint) ob.appendChild(el('div', { class: 'opt-hint' }, esc(t.hint)));
  const cv = MP.view.canvas; if (cv) cv.style.cursor = t.cursor || 'default';
};

/* Contrôle générique (options d'outil et boîtes de dialogue) */
UI.control = (o, vals, onChange, compact) => {
  const wrap = el('label', { class: 'ctl ctl-' + o.type + (compact ? ' compact' : '') });
  if (o.title) wrap.title = o.title;
  const lab = o.label ? el('span', { class: 'lab' }, esc(o.label)) : null;
  const set = (v) => { vals[o.k] = v; onChange(vals, o.k); };
  let input;
  switch (o.type) {
    case 'range': {
      const step = o.step || 1;
      input = el('input', { type: 'range', min: o.min, max: o.max, step });
      const num = el('input', { type: 'number', min: o.min, max: o.max, step, class: 'num' });
      input.value = num.value = vals[o.k];
      input.addEventListener('input', () => { num.value = input.value; set(+input.value); });
      num.addEventListener('change', () => { const v = MP.clamp(+num.value, o.min, o.max); num.value = input.value = v; set(v); });
      if (lab) wrap.appendChild(lab); wrap.appendChild(input); wrap.appendChild(num); if (o.unit) wrap.appendChild(el('span', { class: 'unit' }, o.unit));
      wrap._sync = () => { input.value = num.value = vals[o.k]; };
      return wrap;
    }
    case 'number': input = el('input', { type: 'number', min: o.min, max: o.max, step: o.step || 1, class: 'num wide' }); input.value = vals[o.k]; input.addEventListener('change', () => set(+input.value)); input.addEventListener('input', () => { if (input.value !== '') set(+input.value); }); break;
    case 'password': case 'text': input = el('input', { type: o.type === 'password' ? 'password' : 'text', class: 'txt' }); input.value = vals[o.k]; input.addEventListener('input', () => set(input.value)); break;
    case 'textarea': input = el('textarea', { rows: o.rows || 4 }); input.value = vals[o.k]; input.addEventListener('input', () => set(input.value)); break;
    case 'select': input = el('select'); for (const [v, l] of o.options) { const op = el('option', { value: v }, esc(l)); input.appendChild(op); } input.value = vals[o.k]; input.addEventListener('change', () => set(typeof vals[o.k] === 'number' ? +input.value : input.value)); break;
    case 'check': input = el('input', { type: 'checkbox' }); input.checked = !!vals[o.k]; input.addEventListener('change', () => set(input.checked)); wrap.appendChild(input); if (lab) { if (o.bold) { lab.classList.add('strong'); wrap.classList.add('section'); } wrap.appendChild(lab); } wrap._sync = () => { input.checked = !!vals[o.k]; }; return wrap;
    case 'color': input = el('input', { type: 'color' }); input.value = vals[o.k]; input.addEventListener('input', () => set(input.value)); break;
    case 'button': { const b = el('button', { class: 'btn small', type: 'button', title: o.title || '' }, esc(o.label)); b.addEventListener('click', (e) => { e.preventDefault(); o.action(); }); return b; }
    case 'label': return el('span', { class: 'lab sep-left' }, esc(o.label));
    case 'header': return el('div', { class: 'dlg-header' }, esc(o.label));
    case 'info': return el('div', { class: 'dlg-info' }, o.html);
    default: input = el('span');
  }
  if (lab) wrap.appendChild(lab); wrap.appendChild(input);
  wrap._sync = () => { if (o.type === 'check') input.checked = !!vals[o.k]; else input.value = vals[o.k]; };
  return wrap;
};

/* ============ Couleurs ============ */
UI.colorTarget = 'fg';
UI.refreshColors = () => {
  const fg = $('#toolcolors .fg'), bg = $('#toolcolors .bg');
  if (fg) { fg.style.background = MP.colors.fg; bg.style.background = MP.colors.bg; }
  UI.picker && UI.picker.sync();
  document.querySelectorAll('.pc-sw').forEach((s) => { s.style.background = MP.colors[s.dataset.t]; s.classList.toggle('sel', s.dataset.t === UI.colorTarget); });
};
UI.buildColorPanel = () => {
  const p = $('#panel-color .body');
  p.innerHTML = `<div class="pc-top"><div class="pc-sw" data-t="fg" title="Premier plan"></div><div class="pc-sw" data-t="bg" title="Arrière-plan"></div><input class="pc-hex" maxlength="7" spellcheck="false"><span class="pc-rgb"></span></div>
  <div class="pc-pick"><canvas class="pc-sv" width="236" height="120"></canvas><canvas class="pc-hue" width="236" height="12"></canvas></div>`;
  p.querySelectorAll('.pc-sw').forEach((s) => s.addEventListener('click', () => { UI.colorTarget = s.dataset.t; UI.refreshColors(); }));
  const sv = p.querySelector('.pc-sv'), hue = p.querySelector('.pc-hue'), hex = p.querySelector('.pc-hex'), rgbS = p.querySelector('.pc-rgb');
  let H = 0, S = 0, V = 0;
  const hc = hue.getContext('2d'); const g = hc.createLinearGradient(0, 0, hue.width, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`); hc.fillStyle = g; hc.fillRect(0, 0, hue.width, hue.height);
  const drawSV = () => {
    const c = sv.getContext('2d'), w = sv.width, h = sv.height;
    c.fillStyle = `hsl(${H},100%,50%)`; c.fillRect(0, 0, w, h);
    let gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = V > 0.5 ? '#000' : '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(S * w, (1 - V) * h, 5, 0, 7); c.stroke();
    hc.fillStyle = g; hc.fillRect(0, 0, hue.width, hue.height); hc.fillStyle = '#fff'; hc.fillRect((H / 360) * hue.width - 1.5, 0, 3, hue.height); hc.strokeStyle = '#000'; hc.strokeRect((H / 360) * hue.width - 2, 0, 4, hue.height);
  };
  const apply = () => { const c = MP.hsvToRgb(H, S, V); MP.colors[UI.colorTarget] = MP.rgbToHex(c.r, c.g, c.b); UI.refreshColors(); };
  const drag = (canvas, fn) => canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); const mv = (ev) => { const r = canvas.getBoundingClientRect(); fn(MP.clamp((ev.clientX - r.left) / r.width, 0, 1), MP.clamp((ev.clientY - r.top) / r.height, 0, 1)); apply(); }; mv(e); canvas.onpointermove = mv; canvas.onpointerup = () => { canvas.onpointermove = null; }; });
  drag(sv, (x, y) => { S = x; V = 1 - y; }); drag(hue, (x) => { H = x * 359.9; });
  hex.addEventListener('change', () => { let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) { const c = MP.hexToRgb(v); MP.colors[UI.colorTarget] = MP.rgbToHex(c.r, c.g, c.b); UI.refreshColors(); } });
  UI.picker = { sync() { const c = MP.hexToRgb(MP.colors[UI.colorTarget]), h = MP.rgbToHsv(c.r, c.g, c.b); if (h.s > 0.001 && h.v > 0.001) H = h.h; S = h.s; V = h.v; hex.value = MP.colors[UI.colorTarget]; rgbS.textContent = `R ${c.r}  V ${c.g}  B ${c.b}`; drawSV(); } };
  // nuancier
  const sw = $('#panel-swatches .body');
  const preset = ['#000000', '#404040', '#808080', '#c0c0c0', '#ffffff', '#ff0000', '#ff8000', '#ffd400', '#80ff00', '#00c853', '#00e5ff', '#2979ff', '#304ffe', '#aa00ff', '#ff00aa', '#7a3e1d', '#c49a6c', '#f5deb3', '#ffcdd2', '#b2dfdb', '#1a237e', '#004d40', '#3e2723', '#263238', '#ffebee', '#e8f5e9', '#e3f2fd', '#fff8e1', '#f3e5f5', '#fbe9e7'];
  const drawSw = () => {
    let user = []; try { user = JSON.parse(localStorage.getItem('mp.swatches') || '[]'); } catch (_) { /* stockage indisponible */ }
    sw.innerHTML = '';
    [...preset, ...user].forEach((c, i) => {
      const s = el('div', { class: 'swatch', title: c + (i >= preset.length ? ' — clic droit pour supprimer' : '') }); s.style.background = c;
      s.addEventListener('click', (e) => { MP.colors[e.altKey ? 'bg' : UI.colorTarget] = c; UI.refreshColors(); });
      if (i >= preset.length) s.addEventListener('contextmenu', (e) => { e.preventDefault(); user.splice(i - preset.length, 1); localStorage.setItem('mp.swatches', JSON.stringify(user)); drawSw(); });
      sw.appendChild(s);
    });
    const add = el('div', { class: 'swatch add', title: 'Ajouter la couleur active' }, '+');
    add.addEventListener('click', () => { user.push(MP.colors[UI.colorTarget]); try { localStorage.setItem('mp.swatches', JSON.stringify(user)); } catch (_) { /* */ } drawSw(); });
    sw.appendChild(add);
  };
  UI.drawSwatches = drawSw;
  drawSw();
};
UI.openColorDialog = (t) => { const p = $('#panel-color'); p.classList.remove('collapsed'); p.scrollIntoView({ block: 'nearest' }); UI.colorTarget = t; UI.refreshColors(); };

/* ============ Panneau Calques ============ */
const thumb = (src, w = 40, h = 30, checker = true) => {
  const c = el('canvas', { width: w * 2, height: h * 2, class: 'thumb' }); const x = c.getContext('2d');
  if (checker) { for (let j = 0; j < h * 2; j += 8) for (let i = 0; i < w * 2; i += 8) { x.fillStyle = (i + j) % 16 ? '#ddd' : '#fff'; x.fillRect(i, j, 8, 8); } }
  const k = Math.min((w * 2) / src.width, (h * 2) / src.height), dw = src.width * k, dh = src.height * k;
  x.imageSmoothingQuality = 'high'; x.drawImage(src, (w * 2 - dw) / 2, (h * 2 - dh) / 2, dw, dh); return c;
};
UI.refreshLayers = () => {
  const list = $('#layerlist'); if (!list) return;
  const d = MP.doc; list.innerHTML = '';
  const blend = $('#layerBlend'), op = $('#layerOpacity'), opn = $('#layerOpacityNum'), lock = $('#layerLock');
  if (!d) { [blend, op, opn, lock].forEach((e) => (e.disabled = true)); return; }
  [blend, op, opn, lock].forEach((e) => (e.disabled = false));
  const L = d.layer;
  blend.innerHTML = ''; if (L.isGroup) blend.appendChild(el('option', { value: 'pass-through' }, 'Transfert'));
  MP.BLEND_MODES.forEach(([v, n]) => blend.appendChild(el('option', { value: v }, esc(n))));
  blend.value = L.blend; op.value = opn.value = Math.round(L.opacity * 100); lock.checked = L.locked;
  const collapsedHidden = (l) => { let p = l.parent; while (p) { const g = d.byId(p); if (!g) break; if (g.collapsed) return true; p = g.parent; } return false; };
  for (let i = d.layers.length - 1; i >= 0; i--) {
    const l = d.layers[i]; if (collapsedHidden(l)) continue;
    const dim = !l.visible || d.isHiddenByParent(l);
    const row = el('div', { class: 'layer' + (i === d.active ? ' active' : '') + (dim ? ' hidden' : '') + (l.isGroup ? ' group' : '') + (l.clip ? ' clipped' : ''), draggable: 'true', 'data-id': l.id });
    row.style.paddingLeft = 6 + d.depthOf(l) * 16 + (l.clip ? 14 : 0) + 'px';
    if (l.label) row.style.boxShadow = `inset 4px 0 0 ${l.label}`;
    const eye = el('button', { class: 'eye', title: 'Afficher / masquer' }, MP.icon(l.visible ? 'eye' : 'eyeOff', 16));
    eye.addEventListener('click', (e) => { e.stopPropagation(); d.history.record(l.visible ? 'Masquer le calque' : 'Afficher le calque', null); l.visible = !l.visible; MP.afterEdit(); });
    row.appendChild(eye);
    if (l.isGroup) {
      const tg = el('button', { class: 'gtoggle', title: 'Déplier / replier' }, l.collapsed ? '▸' : '▾');
      tg.addEventListener('click', (e) => { e.stopPropagation(); l.collapsed = !l.collapsed; UI.refreshLayers(); });
      row.appendChild(tg); row.appendChild(el('span', { class: 'kicon' }, MP.icon('group', 20)));
    } else if (l.adjust) {
      const ic = el('span', { class: 'kicon adj', title: 'Calque de réglage — double-clic pour le modifier' }, MP.icon('adjust', 20));
      ic.addEventListener('click', (e) => { e.stopPropagation(); d.active = i; d.editMask = false; UI.refreshLayers(); MP.ui.editAdjustLayer(l, false); });
      row.appendChild(ic);
    } else {
      const t = thumb(l.canvas); t.title = 'Ctrl + clic : sélectionner les pixels du calque'; if (i === d.active && !d.editMask) t.classList.add('target');
      t.addEventListener('click', (e) => { if (e.ctrlKey || e.metaKey) { e.stopPropagation(); d.active = i; UI.selCmd('Sélectionner les pixels', (dd) => MP.sel.fromLayerAlpha(dd, l)); } else { d.active = i; d.editMask = false; UI.refreshLayers(); } });
      row.appendChild(t);
    }
    if (l.mask) {
      const m = thumb(l.mask, 40, 30, false); m.classList.add('maskthumb'); if (!l.maskEnabled) m.classList.add('off'); m.title = 'Masque — clic : le modifier, Maj + clic : désactiver';
      const mm = m.getContext('2d'); mm.globalCompositeOperation = 'destination-over'; mm.fillStyle = '#000'; mm.fillRect(0, 0, m.width, m.height);
      if (i === d.active && d.editMask) m.classList.add('target');
      m.addEventListener('click', (e) => { e.stopPropagation(); d.active = i; if (e.shiftKey) { MP.layerOps.toggleMask(); return; } d.editMask = true; UI.refreshLayers(); });
      row.appendChild(m);
    }
    const name = el('span', { class: 'lname' }, (l.text ? `<i class="tbadge">T</i>` : '') + esc(l.name));
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const inp = el('input', { class: 'rename', value: l.name }); name.replaceWith(inp); inp.focus(); inp.select();
      const done = (ok) => { if (ok && inp.value.trim() && inp.value !== l.name) { d.history.record('Renommer le calque', null); l.name = inp.value.trim(); } UI.refreshLayers(); };
      inp.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    });
    row.appendChild(name);
    if (MP.fx.has(l)) { const fx = el('span', { class: 'fxbadge', title: 'Styles de calque — clic pour modifier' }, 'fx'); fx.addEventListener('click', (e) => { e.stopPropagation(); d.active = i; UI.dialogs.layerStyle(); }); row.appendChild(fx); }
    if (l.locked) row.appendChild(el('span', { class: 'lk', title: 'Verrouillé' }, MP.icon('lock', 13)));
    if (l.lockAlpha) row.appendChild(el('span', { class: 'lk', title: 'Transparence verrouillée' }, '▦'));
    row.addEventListener('click', () => { d.active = i; d.editMask = !!(l.adjust && l.mask); UI.refreshLayers(); MP.renderView(); });
    row.addEventListener('dblclick', () => { d.active = i; if (l.text) UI.textDialog(l, false); else if (l.adjust) UI.editAdjustLayer(l, false); else if (!l.isGroup) UI.dialogs.layerStyle(); });
    row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-layer', String(l.id)); row.classList.add('dragging'); });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    const zone = (e) => { const r = row.getBoundingClientRect(), f = (e.clientY - r.top) / r.height; return l.isGroup && f > 0.3 && f < 0.7 ? 'into' : f < 0.5 ? 'above' : 'below'; };
    row.addEventListener('dragover', (e) => { if (![...e.dataTransfer.types].includes('text/x-layer')) return; e.preventDefault(); e.stopPropagation(); row.classList.remove('drop-above', 'drop-below', 'drop-into'); row.classList.add('drop-' + zone(e)); });
    row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below', 'drop-into'));
    row.addEventListener('drop', (e) => { const id = +e.dataTransfer.getData('text/x-layer'); if (!id) return; e.preventDefault(); e.stopPropagation(); const src = d.byId(id); if (src) MP.layerOps.place(src, l, zone(e)); });
    list.appendChild(row);
  }
  UI.refreshHistory(); UI.refreshStatus(); UI.navigatorDirty();
};
UI.buildLayerPanel = () => {
  const blend = $('#layerBlend');
  blend.addEventListener('change', () => { const d = MP.doc; if (!d) return; d.history.record('Mode de fusion', null); d.layer.blend = blend.value; MP.afterEdit(); });
  let recT = null;
  const setOp = (v) => { const d = MP.doc; if (!d) return; if (!recT) d.history.record('Opacité du calque', null); clearTimeout(recT); recT = setTimeout(() => (recT = null), 700); d.layer.opacity = MP.clamp(v, 0, 100) / 100; $('#layerOpacity').value = $('#layerOpacityNum').value = Math.round(d.layer.opacity * 100); MP.render(); clearTimeout(UI._lt); UI._lt = setTimeout(UI.refreshLayers, 300); };
  $('#layerOpacity').addEventListener('input', (e) => setOp(+e.target.value));
  $('#layerOpacityNum').addEventListener('change', (e) => setOp(+e.target.value));
  $('#layerLock').addEventListener('change', (e) => { const d = MP.doc; if (!d) return; d.history.record('Verrouiller', null); d.layer.locked = e.target.checked; MP.afterEdit(); });
  const btns = $('#layerbtns');
  const B = (icon, title, fn) => { const b = el('button', { class: 'ibtn', title }, MP.icon(icon, 17)); b.addEventListener('click', (e) => need(() => fn(e))()); btns.appendChild(b); return b; };
  B('fx', 'Style de calque', () => UI.dialogs.layerStyle());
  B('mask', 'Ajouter un masque de fusion (d\'après la sélection s\'il y en a une)', () => MP.layerOps.addMask(!!MP.doc.selection));
  B('adjust', 'Nouveau calque de réglage', (e) => UI.popupMenu(e.currentTarget, MP.ADJ_LAYER_KEYS.map((k) => ({ label: MP.ADJUST[k].title, act: () => MP.layerOps.addAdjust(k) }))));
  B('group', 'Nouveau groupe (Ctrl+G : grouper le calque actif)', () => MP.layerOps.newGroup(false));
  B('plus', 'Nouveau calque', () => MP.layerOps.add());
  B('copy', 'Dupliquer le calque', () => MP.layerOps.duplicate());
  B('trash', 'Supprimer le calque (ou le masque s\'il est actif)', () => (MP.doc.editMask && !MP.doc.layer.adjust ? MP.layerOps.deleteMask() : MP.layerOps.remove()));
};
UI.popupMenu = (anchor, items) => {
  document.querySelectorAll('.dropdown').forEach((x) => x.remove());
  const r = anchor.getBoundingClientRect(), dd = el('div', { class: 'dropdown' });
  for (const it of items) { const row = el('div', { class: 'item' }, `<span>${esc(it.label)}</span>`); row.onclick = () => { dd.remove(); it.act(); }; dd.appendChild(row); }
  document.body.appendChild(dd); const h = dd.getBoundingClientRect(); dd.style.left = Math.min(r.left, innerWidth - h.width - 6) + 'px'; dd.style.top = Math.max(4, r.top - h.height - 4) + 'px';
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!e.target.closest('.dropdown')) { dd.remove(); document.removeEventListener('mousedown', off); } }), 0);
};
UI.editAdjustLayer = (l, isNew) => {
  const d = MP.doc, spec = MP.ADJUST[l.adjust.key]; if (!spec.fields) return;
  if (!isNew) d.history.record('Modifier ' + spec.title, null);
  const before = JSON.parse(JSON.stringify(l.adjust.values)), vals = JSON.parse(JSON.stringify(l.adjust.values));
  UI.dialog({
    title: spec.title + ' (calque de réglage)', fields: spec.fields, values: vals, preview: true, spec, orig: MP.cloneCanvas(d._comp),
    onChange: (v) => { l.adjust.values = JSON.parse(JSON.stringify(v)); MP.render(); },
    onOk: (v) => { l.adjust.values = JSON.parse(JSON.stringify(v)); MP.afterEdit(); },
    onCancel: () => { if (isNew) { d.history.undo(); d.history.redoStack.pop(); } else { l.adjust.values = before; d.history.undoStack.pop(); } MP.afterEdit(); UI.refreshAll(); },
  });
};

/* ============ Historique ============ */
UI.refreshHistory = () => {
  const box = $('#historylist'); if (!box) return; box.innerHTML = '';
  const d = MP.doc; if (!d) return;
  const h = d.history;
  const add = (label, cls, fn) => { const r = el('div', { class: 'hitem ' + cls }, esc(label)); r.addEventListener('click', fn); box.appendChild(r); };
  add('Ouverture', h.undoStack.length === 0 ? 'cur' : '', () => { while (h.undoStack.length) h.undo(); MP.afterEdit(); UI.refreshAll(); });
  h.undoStack.forEach((e, i) => add(e.label, i === h.undoStack.length - 1 ? 'cur' : '', () => { while (h.undoStack.length > i + 1) h.undo(); MP.afterEdit(); UI.refreshAll(); }));
  [...h.redoStack].reverse().forEach((e, i) => add(e.label, 'redo', () => { for (let k = 0; k <= i; k++) h.redo(); MP.afterEdit(); UI.refreshAll(); }));
  const src = el('div', { class: 'hitem hsrc', title: 'La Forme d\'historique repeindra l\'état actuel' }, '📌 Définir l\'état actuel comme source de la forme d\'historique');
  src.onclick = () => { MP.setHistorySource(d); MP.toast('Source de la forme d\'historique définie'); }; box.appendChild(src);
  box.scrollTop = box.scrollHeight;
};

/* ============ Navigateur ============ */
UI.buildNavigator = () => {
  const c = $('#navcanvas');
  const go = (e) => { const d = MP.doc; if (!d || !UI.navK) return; const r = c.getBoundingClientRect(); const x = (e.clientX - r.left - UI.navOX) / UI.navK, y = (e.clientY - r.top - UI.navOY) / UI.navK; d.panX = MP.view.w / 2 - x * d.zoom; d.panY = MP.view.h / 2 - y * d.zoom; MP.renderView(); };
  c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); go(e); c.onpointermove = go; c.onpointerup = () => (c.onpointermove = null); });
  const z = $('#navzoom'); z.addEventListener('input', () => MP.doc && MP.view.setZoom(Math.pow(2, +z.value)));
};
UI.navigatorDirty = () => { clearTimeout(UI._navT); UI._navT = setTimeout(() => { UI.drawNavigator(); }, 120); clearTimeout(UI._hiT); UI._hiT = setTimeout(() => { UI.drawHistogram(); UI.refreshInfo(); }, 450); };
UI.drawNavigator = () => {
  const c = $('#navcanvas'); if (!c || $('#panel-nav').classList.contains('collapsed')) return;
  const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2;
  const x = c.getContext('2d'); x.fillStyle = '#1b1b1d'; x.fillRect(0, 0, c.width, c.height);
  const d = MP.doc; if (!d) return;
  const k = Math.min((c.width - 8) / d.width, (c.height - 8) / d.height), w = d.width * k, h = d.height * k, ox = (c.width - w) / 2, oy = (c.height - h) / 2;
  UI.navK = k / 2; UI.navOX = ox / 2; UI.navOY = oy / 2;
  x.fillStyle = '#fff'; x.fillRect(ox, oy, w, h); x.imageSmoothingQuality = 'high'; x.drawImage(d._comp, ox, oy, w, h);
  const vx = (-d.panX / d.zoom) * k + ox, vy = (-d.panY / d.zoom) * k + oy, vw = (MP.view.w / d.zoom) * k, vh = (MP.view.h / d.zoom) * k;
  x.strokeStyle = '#ff3b30'; x.lineWidth = 2; x.strokeRect(vx, vy, vw, vh);
  $('#navzoom').value = Math.log2(d.zoom);
};

/* ============ Onglets, statut ============ */
UI.refreshTabs = () => {
  const t = $('#tabs'); if (!t) return; t.innerHTML = '';
  for (const d of MP.docs) {
    const b = el('div', { class: 'tab' + (d === MP.doc ? ' active' : ''), title: d.filePath || d.name, draggable: 'true', 'data-doc': d.id }, `<span>${esc(d.name)}${d.dirty ? ' •' : ''} <small>@ ${Math.round(d.zoom * 100)} %</small></span>`);
    const x = el('button', { class: 'tabx', title: 'Fermer' }, '×'); x.addEventListener('click', (e) => { e.stopPropagation(); UI.closeDoc(d); });
    b.appendChild(x); b.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); UI.closeDoc(d); } else if (d !== MP.doc) MP.setDoc(d); });
    t.appendChild(b);
  }
  $('#welcome').style.display = MP.docs.length ? 'none' : 'flex';
  document.title = MP.doc ? `${MP.doc.name} — Multipify Photo` : 'Multipify Photo';
};
UI.refreshStatus = () => {
  const d = MP.doc, s = $('#status'); if (!s) return;
  $('#st-zoom').value = d ? Math.round(d.zoom * 1000) / 10 : '';
  $('#st-size').textContent = d ? `${d.width} × ${d.height} px` : '';
  $('#st-layers').textContent = d ? `${d.layers.length} calque${d.layers.length > 1 ? 's' : ''}` + (d.quickMask ? ' — masque rapide' : d.editMask && d.layer && d.layer.mask ? ' — édition du masque' : '') : '';
  UI.refreshTabs();
};
UI.setInfo = (t) => { const i = $('#st-info'); if (i) i.textContent = t; };
UI.refreshAll = () => { UI.refreshTabs(); UI.refreshLayers(); UI.refreshHistory(); UI.refreshStatus(); UI.refreshColors(); UI.refreshTool(); };

UI.closeDoc = async (d) => {
  if (d.dirty) {
    const r = await UI.confirm(`Enregistrer les modifications de « ${d.name} » avant de fermer ?`, ['Enregistrer', 'Ne pas enregistrer', 'Annuler']);
    if (r === 2 || r === -1) return;
    if (r === 0) { MP.setDoc(d); if (!(await MP.io.save(false))) return; }
  }
  const i = MP.docs.indexOf(d); MP.docs.splice(i, 1);
  MP.native.setDirty(MP.docs.some((x) => x.dirty));
  MP.setDoc(MP.docs[Math.min(i, MP.docs.length - 1)] || null);
};

/* ============ Boîtes de dialogue ============ */
UI.dialog = (cfg) => {
  UI.closeMenus && UI.closeMenus();
  const vals = cfg.values || {};
  const defaults = JSON.parse(JSON.stringify(vals));
  const back = el('div', { class: 'modal-back' + (cfg.preview ? ' see-through' : '') });
  const dlg = el('div', { class: 'dialog' }); if (cfg.width) dlg.style.width = cfg.width + 'px';
  const head = el('div', { class: 'dlg-title' }, esc(cfg.title)); dlg.appendChild(head);
  const body = el('div', { class: 'dlg-body' }); dlg.appendChild(body);
  let queued = false;
  const notify = (v, key) => {
    if (cfg.onField) cfg.onField(vals, key, api);
    if (!cfg.onChange || (cfg.spec && cfg.spec.heavy)) return;
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; cfg.onChange(vals, key); extra.forEach((x) => x.redraw && x.redraw()); });
  };
  const ctls = [];
  for (const f of cfg.fields || []) { const c = UI.control(f, vals, notify); body.appendChild(c); ctls.push(c); }
  const extra = [];
  if (cfg.spec && cfg.spec.histogram) extra.push(UI.histogramWidget(body, cfg.orig, vals));
  if (cfg.spec && cfg.spec.curves) extra.push(UI.curvesWidget(body, cfg.orig, vals, () => notify(vals, 'pts')));
  if (cfg.body) cfg.body(body, vals, notify);
  const foot = el('div', { class: 'dlg-foot' });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); UI.dialogOpen = null; };
  const ok = el('button', { class: 'btn primary' }, esc(cfg.okLabel || 'OK'));
  const cancel = el('button', { class: 'btn' }, 'Annuler');
  ok.addEventListener('click', () => { if (cfg.onOk && cfg.onOk(vals) === false) return; close(); });
  cancel.addEventListener('click', () => { close(); cfg.onCancel && cfg.onCancel(); });
  if (cfg.preview) {
    const reset = el('button', { class: 'btn left' }, 'Réinitialiser');
    reset.addEventListener('click', () => { Object.assign(vals, JSON.parse(JSON.stringify(defaults))); ctls.forEach((c) => c._sync && c._sync()); if (cfg.onChange) cfg.onChange(vals); extra.forEach((x) => x.redraw && x.redraw()); });
    foot.appendChild(reset);
    if (cfg.spec && cfg.spec.heavy) { const pv = el('button', { class: 'btn left' }, 'Aperçu'); pv.addEventListener('click', () => MP.busy('Calcul de l\'aperçu…', () => cfg.onChange(vals))); foot.appendChild(pv); }
  }
  if (!cfg.noCancel) foot.appendChild(cancel); foot.appendChild(ok); dlg.appendChild(foot);
  back.appendChild(dlg); document.body.appendChild(back);
  // déplaçable
  head.addEventListener('pointerdown', (e) => { const r = dlg.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; dlg.style.position = 'fixed'; dlg.style.margin = 0; const mv = (ev) => { dlg.style.left = ev.clientX - ox + 'px'; dlg.style.top = ev.clientY - oy + 'px'; }; head.setPointerCapture(e.pointerId); head.onpointermove = mv; head.onpointerup = () => (head.onpointermove = null); mv(e); });
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel.click(); } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); ok.click(); } else e.stopPropagation(); };
  document.addEventListener('keydown', onKey, true);
  const api = { vals, sync: () => ctls.forEach((c) => c._sync && c._sync()), close };
  UI.dialogOpen = api;
  if (cfg.onChange && (cfg.initialPreview || (cfg.spec && cfg.spec.render && !cfg.spec.heavy))) MP.busy('Aperçu…', () => cfg.onChange(vals));
  const first = body.querySelector('input:not([type=checkbox]):not([type=range]), textarea'); if (first && !cfg.preview) setTimeout(() => { first.focus(); first.select && first.select(); }, 30);
  return api;
};
UI.confirm = (msg, buttons) => new Promise((resolve) => {
  const back = el('div', { class: 'modal-back' }), dlg = el('div', { class: 'dialog' });
  dlg.appendChild(el('div', { class: 'dlg-title' }, 'Multipify Photo')); dlg.appendChild(el('div', { class: 'dlg-body' }, `<p>${esc(msg)}</p>`));
  const foot = el('div', { class: 'dlg-foot' });
  const done = (i) => { back.remove(); document.removeEventListener('keydown', k, true); resolve(i); };
  buttons.forEach((b, i) => { const bt = el('button', { class: 'btn' + (i === 0 ? ' primary' : '') }, esc(b)); bt.onclick = () => done(i); foot.appendChild(bt); });
  const k = (e) => { e.stopPropagation(); if (e.key === 'Escape') done(-1); if (e.key === 'Enter') done(0); };
  document.addEventListener('keydown', k, true);
  dlg.appendChild(foot); back.appendChild(dlg); document.body.appendChild(back);
});

UI.histogramWidget = (body, orig, vals) => {
  const c = el('canvas', { class: 'histo', width: 512, height: 140 }); body.insertBefore(c, body.children[1] || null);
  const H = MP.histogram(orig);
  const redraw = () => {
    const x = c.getContext('2d'), arr = H[vals.ch === 'rgb' ? 'l' : vals.ch]; x.clearRect(0, 0, c.width, c.height);
    let mx = 1; for (let i = 0; i < 256; i++) mx = Math.max(mx, arr[i]);
    x.fillStyle = vals.ch === 'r' ? '#e55' : vals.ch === 'g' ? '#5c5' : vals.ch === 'b' ? '#58f' : '#ccc';
    for (let i = 0; i < 256; i++) { const h = Math.sqrt(arr[i] / mx) * (c.height - 4); x.fillRect(i * 2, c.height - h, 2, h); }
    x.fillStyle = 'rgba(255,200,0,.9)'; [vals.inB, vals.inW].forEach((v) => x.fillRect(v * 2 - 1, 0, 2, c.height));
    x.fillStyle = 'rgba(160,160,160,.9)'; const mid = vals.inB + (vals.inW - vals.inB) * Math.pow(0.5, vals.gamma); x.fillRect(mid * 2 - 1, 0, 2, c.height);
  };
  redraw(); return { redraw };
};
UI.curvesWidget = (body, orig, vals, changed) => {
  const S = 256, c = el('canvas', { class: 'curves', width: S * 2, height: S * 2 }); body.appendChild(c);
  body.appendChild(el('div', { class: 'dlg-info' }, 'Cliquez pour ajouter un point, glissez pour le déplacer, faites-le sortir du cadre pour le supprimer.'));
  const H = MP.histogram(orig);
  const redraw = () => {
    const x = c.getContext('2d'), pts = vals.pts[vals.ch], lut = MP.curveLUT(pts); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, S, S);
    const arr = H[vals.ch === 'rgb' ? 'l' : vals.ch]; let mx = 1; for (let i = 0; i < 256; i++) mx = Math.max(mx, arr[i]);
    x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 256; i++) { const h = Math.sqrt(arr[i] / mx) * S; x.fillRect(i, S - h, 1, h); }
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; x.beginPath(); for (let i = 1; i < 4; i++) { x.moveTo((i * S) / 4, 0); x.lineTo((i * S) / 4, S); x.moveTo(0, (i * S) / 4); x.lineTo(S, (i * S) / 4); } x.moveTo(0, S); x.lineTo(S, 0); x.stroke();
    x.strokeStyle = vals.ch === 'r' ? '#ff5a5a' : vals.ch === 'g' ? '#5ad65a' : vals.ch === 'b' ? '#5a8cff' : '#eee'; x.lineWidth = 1.6; x.beginPath();
    for (let i = 0; i < 256; i++) { const y = S - lut[i]; i ? x.lineTo(i + 0.5, y) : x.moveTo(0.5, y); } x.stroke();
    x.fillStyle = '#fff'; for (const [px, py] of pts) { x.fillRect(px - 3, S - py - 3, 6, 6); }
  };
  let drag = null;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 255, (1 - (e.clientY - r.top) / r.height) * 255]; };
  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId); const [x, y] = pos(e), pts = vals.pts[vals.ch];
    drag = pts.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 10);
    if (drag < 0) { pts.push([Math.round(x), Math.round(y)]); pts.sort((a, b) => a[0] - b[0]); drag = pts.findIndex(([px]) => px === Math.round(x)); }
    redraw(); changed();
  });
  c.addEventListener('pointermove', (e) => {
    if (drag === null || drag < 0) return; const pts = vals.pts[vals.ch]; let [x, y] = pos(e);
    const out = (x < -20 || x > 275 || y < -20 || y > 275) && pts.length > 2 && drag > 0 && drag < pts.length - 1;
    if (out) { pts.splice(drag, 1); drag = null; redraw(); changed(); return; }
    x = MP.clamp(Math.round(x), 0, 255); y = MP.clamp(Math.round(y), 0, 255);
    const lo = drag > 0 ? pts[drag - 1][0] + 1 : 0, hi = drag < pts.length - 1 ? pts[drag + 1][0] - 1 : 255;
    pts[drag] = [MP.clamp(x, lo, hi), y]; redraw(); changed();
  });
  c.addEventListener('pointerup', () => (drag = null));
  redraw(); return { redraw };
};

UI.textDialog = (l, isNew) => {
  const d = MP.doc;
  if (!isNew) d.history.record('Modifier le texte', null);
  const before = { ...l.text };
  const vals = { arc: 0, circle: false, vertical: false, ...l.text };
  MP.loadSystemFonts && MP.loadSystemFonts();
  const update = () => { Object.assign(l.text, vals); MP.renderText(l); l.name = (vals.content.split('\n')[0] || 'Texte').slice(0, 30); MP.render(); };
  update();
  UI.dialog({
    title: isNew ? 'Nouveau texte' : 'Modifier le texte', width: 440,
    fields: [
      { k: 'content', label: 'Texte', type: 'textarea', rows: 4 },
      { k: 'font', label: 'Police', type: 'select', options: MP.FONTS.map((f) => [f, f]) }, { k: 'size', label: 'Taille (px)', type: 'number', min: 2, max: 3000 },
      { k: 'color', label: 'Couleur', type: 'color' }, { k: 'bold', label: 'Gras', type: 'check' }, { k: 'italic', label: 'Italique', type: 'check' }, { k: 'underline', label: 'Souligné', type: 'check' },
      { k: 'align', label: 'Alignement', type: 'select', options: [['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']] },
      { k: 'lineHeight', label: 'Interligne', type: 'range', min: 0.6, max: 3, step: 0.05 }, { k: 'spacing', label: 'Approche', type: 'range', min: -20, max: 100, unit: 'px' },
      { k: 'stroke', label: 'Contour', type: 'check' }, { k: 'strokeColor', label: 'Couleur du contour', type: 'color' }, { k: 'strokeWidth', label: 'Épaisseur du contour', type: 'range', min: 1, max: 50, unit: 'px' },
      { k: 'shadow', label: 'Ombre portée', type: 'check' },
      { type: 'header', label: 'Texte dynamique (2026)' },
      { k: 'arc', label: 'Courbure en arc', type: 'range', min: -100, max: 100, unit: '%' }, { k: 'circle', label: 'Cercle complet (avec la courbure)', type: 'check' }, { k: 'vertical', label: 'Texte vertical', type: 'check' },
    ],
    values: vals,
    onField: () => update(),
    onOk: () => { if (!vals.content.trim()) { d.layers.splice(d.layers.indexOf(l), 1); d.active = MP.clamp(d.active - 1, 0, d.layers.length - 1); } MP.afterEdit(); },
    onCancel: () => { if (isNew) { d.history.undo(); d.history.redoStack.pop(); } else { Object.assign(l.text, before); MP.renderText(l); d.history.undoStack.pop(); } MP.afterEdit(); UI.refreshAll(); },
  });
  setTimeout(() => { const ta = document.querySelector('.dialog textarea'); if (ta) { ta.focus(); ta.select(); } }, 40);
};

UI.dialogs = {
  newDoc() {
    const presets = [['custom', 'Personnalisé'], ['1920x1080', 'Full HD 1920 × 1080'], ['3840x2160', '4K 3840 × 2160'], ['1080x1080', 'Instagram carré 1080 × 1080'], ['1080x1350', 'Instagram portrait 1080 × 1350'], ['1080x1920', 'Story / Reel 1080 × 1920'], ['1280x720', 'Miniature YouTube 1280 × 720'], ['1200x630', 'Facebook / Open Graph 1200 × 630'], ['1500x500', 'Bannière X/Twitter 1500 × 500'], ['2480x3508', 'A4 300 dpi 2480 × 3508'], ['3508x4961', 'A3 300 dpi 3508 × 4961'], ['1000x1000', 'Produit e-commerce 1000 × 1000'], ['2000x2000', 'Produit Amazon 2000 × 2000']];
    UI.dialog({
      title: 'Nouveau document', width: 420,
      fields: [{ k: 'name', label: 'Nom', type: 'text' }, { k: 'preset', label: 'Format', type: 'select', options: presets }, { k: 'w', label: 'Largeur (px)', type: 'number', min: 1, max: 30000 }, { k: 'h', label: 'Hauteur (px)', type: 'number', min: 1, max: 30000 }, { k: 'bg', label: 'Arrière-plan', type: 'select', options: [['#ffffff', 'Blanc'], ['#000000', 'Noir'], ['transparent', 'Transparent'], ['bg', 'Couleur d\'arrière-plan']] }],
      values: { name: 'Sans titre ' + (MP.docs.length + 1), preset: '1920x1080', w: 1920, h: 1080, bg: '#ffffff' },
      onField: (v, k, api) => { if (k === 'preset' && v.preset !== 'custom') { [v.w, v.h] = v.preset.split('x').map(Number); api.sync(); } if (k === 'w' || k === 'h') { v.preset = 'custom'; api.sync(); } },
      onOk: (v) => { if (v.w * v.h > 400e6) { MP.toast('Image trop grande'); return false; } MP.newDocument(+v.w, +v.h, v.name, v.bg === 'bg' ? MP.colors.bg : v.bg); },
    });
  },
  imageSize() {
    const d = MP.doc, ratio = d.width / d.height;
    UI.dialog({
      title: 'Taille de l\'image', width: 380,
      fields: [{ k: 'w', label: 'Largeur (px)', type: 'number', min: 1, max: 30000 }, { k: 'h', label: 'Hauteur (px)', type: 'number', min: 1, max: 30000 }, { k: 'pct', label: 'Pourcentage', type: 'number', min: 1, max: 1000 }, { k: 'keep', label: 'Conserver les proportions', type: 'check' }, { k: 'q', label: 'Rééchantillonnage', type: 'select', options: [['high', 'Bicubique (meilleure qualité)'], ['details', 'Conserver les détails (agrandissement Lanczos)'], ['smooth', 'Bilinéaire'], ['nearest', 'Au plus proche (pixel art)']] }],
      values: { w: d.width, h: d.height, pct: 100, keep: true, q: 'high' },
      onField: (v, k, api) => { if (k === 'w' && v.keep) { v.h = Math.round(v.w / ratio); v.pct = Math.round((v.w / d.width) * 1000) / 10; } if (k === 'h' && v.keep) { v.w = Math.round(v.h * ratio); v.pct = Math.round((v.h / d.height) * 1000) / 10; } if (k === 'pct') { v.w = Math.round((d.width * v.pct) / 100); v.h = Math.round((d.height * v.pct) / 100); } api.sync(); },
      onOk: (v) => MP.busy('Redimensionnement…', () => MP.resizeImage(+v.w, +v.h, v.q)),
    });
  },
  canvasSize() {
    const d = MP.doc; let ax = 0.5, ay = 0.5;
    UI.dialog({
      title: 'Taille de la zone de travail', width: 380,
      fields: [{ k: 'w', label: 'Largeur (px)', type: 'number', min: 1, max: 30000 }, { k: 'h', label: 'Hauteur (px)', type: 'number', min: 1, max: 30000 }, { k: 'fill', label: 'Couleur d\'extension', type: 'select', options: [['transparent', 'Transparent'], ['#ffffff', 'Blanc'], ['#000000', 'Noir'], ['bg', 'Arrière-plan']] }],
      values: { w: d.width, h: d.height, fill: 'transparent' },
      body: (b) => {
        b.appendChild(el('div', { class: 'lab' }, 'Position'));
        const g = el('div', { class: 'anchor' });
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const c = el('button', { class: 'acell' + (i === 1 && j === 1 ? ' on' : '') }); c.onclick = (e) => { e.preventDefault(); g.querySelectorAll('.acell').forEach((x) => x.classList.remove('on')); c.classList.add('on'); ax = i / 2; ay = j / 2; }; g.appendChild(c); }
        b.appendChild(g);
      },
      onOk: (v) => MP.canvasSize(+v.w, +v.h, ax, ay, v.fill === 'bg' ? MP.colors.bg : v.fill),
    });
  },
  fill() {
    UI.dialog({
      title: 'Remplir', fields: [{ k: 'what', label: 'Contenu', type: 'select', options: [['fg', 'Couleur de premier plan'], ['bg', 'Couleur d\'arrière-plan'], ['color', 'Couleur…'], ['content', 'Contenu pris en compte (supprimer un objet)'], ['pattern', 'Motif (défini)'], ['white', 'Blanc'], ['black', 'Noir'], ['gray', 'Gris 50 %']] }, { k: 'color', label: 'Couleur', type: 'color' }, { k: 'blend', label: 'Mode', type: 'select', options: MP.BLEND_MODES }, { k: 'opacity', label: 'Opacité', type: 'range', min: 1, max: 100, unit: '%' }],
      values: { what: 'fg', color: '#ff0000', blend: 'source-over', opacity: 100 }, onOk: (v) => MP.edit.fill(v),
    });
  },
  stroke() {
    UI.dialog({
      title: 'Contour de la sélection', fields: [{ k: 'width', label: 'Épaisseur (px)', type: 'number', min: 1, max: 250 }, { k: 'color', label: 'Couleur', type: 'color' }, { k: 'pos', label: 'Position', type: 'select', options: [['inside', 'Intérieur'], ['center', 'Centre'], ['outside', 'Extérieur']] }, { k: 'opacity', label: 'Opacité', type: 'range', min: 1, max: 100, unit: '%' }],
      values: { width: 4, color: MP.colors.fg, pos: 'center', opacity: 100 }, onOk: (v) => MP.edit.strokeSel(v),
    });
  },
  layerStyle() {
    const d = MP.doc, l = d.layer;
    if (l.isGroup || l.adjust) { MP.toast('Les styles s\'appliquent aux calques de pixels et de texte'); return; }
    d.history.record('Style de calque', null);
    const before = l.fx ? JSON.parse(JSON.stringify(l.fx)) : null, cur = l.fx ? JSON.parse(JSON.stringify(l.fx)) : MP.fx.defaults();
    const def = MP.fx.defaults(); for (const k of Object.keys(def)) cur[k] = { ...def[k], ...(cur[k] || {}) };
    const vals = {}; for (const [e, o] of Object.entries(cur)) for (const [p, v] of Object.entries(o)) vals[e + '_' + p] = v;
    const sec = (e, title, fields) => [{ k: e + '_on', label: title, type: 'check', bold: true }, ...fields.map((f) => ({ ...f, k: e + '_' + f.k }))];
    const C = (k = 'color') => ({ k, label: 'Couleur', type: 'color' }), OP = { k: 'opacity', label: 'Opacité', type: 'range', min: 0, max: 100, unit: '%' }, ANG = { k: 'angle', label: 'Angle', type: 'range', min: -180, max: 180, unit: '°' };
    const fields = [
      ...sec('shadow', 'Ombre portée', [C(), OP, ANG, { k: 'dist', label: 'Distance', type: 'range', min: 0, max: 300, unit: 'px' }, { k: 'size', label: 'Taille', type: 'range', min: 0, max: 200, unit: 'px' }]),
      ...sec('stroke', 'Contour', [C(), { k: 'size', label: 'Taille', type: 'range', min: 1, max: 100, unit: 'px' }, OP]),
      ...sec('glow', 'Lueur externe', [C(), OP, { k: 'size', label: 'Taille', type: 'range', min: 1, max: 200, unit: 'px' }]),
      ...sec('inner', 'Ombre interne', [C(), OP, ANG, { k: 'dist', label: 'Distance', type: 'range', min: 0, max: 100, unit: 'px' }, { k: 'size', label: 'Taille', type: 'range', min: 0, max: 100, unit: 'px' }]),
      ...sec('bevel', 'Biseautage et estampage', [ANG, { k: 'depth', label: 'Profondeur', type: 'range', min: 1, max: 40, unit: 'px' }, { k: 'size', label: 'Adoucir', type: 'range', min: 0, max: 60, unit: 'px' }, { k: 'hi', label: 'Lumières', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'sh', label: 'Ombres', type: 'range', min: 0, max: 100, unit: '%' }]),
      ...sec('satin', 'Satin', [C(), OP, ANG, { k: 'dist', label: 'Distance', type: 'range', min: 1, max: 250, unit: 'px' }, { k: 'size', label: 'Taille', type: 'range', min: 0, max: 250, unit: 'px' }, { k: 'invert', label: 'Inverser', type: 'check' }]),
      ...sec('overlay', 'Incrustation couleur', [C(), OP]),
      ...sec('gradient', 'Incrustation en dégradé', [{ k: 'a', label: 'Couleur 1', type: 'color' }, { k: 'b', label: 'Couleur 2', type: 'color' }, ANG, OP]),
    ];
    const build = () => { const fx = {}; for (const [k, v] of Object.entries(vals)) { const [e, p] = k.split('_'); (fx[e] = fx[e] || {})[p] = v; } l.fx = fx; MP.render(); UI.refreshLayers(); };
    UI.dialog({
      title: 'Style de calque — ' + l.name, width: 460, fields, values: vals, preview: true,
      onField: (v, k) => { if (k && !k.endsWith('_on')) { const e = k.split('_')[0]; if (!vals[e + '_on']) { vals[e + '_on'] = true; UI.dialogOpen && UI.dialogOpen.sync(); } } build(); },
      onOk: () => { build(); if (!MP.fx.has(l)) l.fx = null; MP.afterEdit(); },
      onCancel: () => { l.fx = before; d.history.undoStack.pop(); MP.afterEdit(); },
    });
  },
  prefs(tab) {
    const p = MP.prefs;
    UI.dialog({
      title: 'Préférences', width: 460,
      fields: [
        { type: 'header', label: 'Intelligence artificielle' },
        { type: 'info', html: 'Les fonctions ✨ (remplissage génératif, extension, détourage, génération) utilisent l\'API Images d\'OpenAI. Créez une clé sur <b>platform.openai.com</b> → API keys. La clé reste sur cet ordinateur.' },
        { k: 'aiKey', label: 'Clé API OpenAI', type: 'password' }, { k: 'aiModel', label: 'Modèle', type: 'text' },
        { k: 'aiQuality', label: 'Qualité', type: 'select', options: [['low', 'Rapide (économique)'], ['medium', 'Moyenne'], ['high', 'Haute']] },
        { type: 'header', label: 'Général' },
        { k: 'historyLimit', label: 'Étapes d\'historique', type: 'number', min: 5, max: 200 },
        { k: 'rulers', label: 'Afficher les règles', type: 'check' },
      ],
      values: { aiKey: p.aiKey, aiModel: p.aiModel, aiQuality: p.aiQuality, historyLimit: p.historyLimit, rulers: p.rulers !== false },
      onOk: (v) => { Object.assign(MP.prefs, { aiKey: v.aiKey.trim(), aiModel: v.aiModel.trim() || 'gpt-image-1', aiQuality: v.aiQuality, historyLimit: MP.clamp(+v.historyLimit || 40, 5, 200), rulers: v.rulers }); MP.savePrefs(); MP.docs.forEach((d) => (d.history.limit = MP.prefs.historyLimit)); MP.guides.apply(); MP.toast('Préférences enregistrées'); },
    });
    if (tab === 'ai') setTimeout(() => { const i = document.querySelector('.dialog input[type=password]'); if (i) i.focus(); }, 50);
  },
  contentScale() {
    const d = MP.doc, ratio = d.width / d.height;
    UI.dialog({
      title: 'Échelle basée sur le contenu', width: 420,
      fields: [{ type: 'info', html: 'Redimensionne l\'image en préservant les éléments importants (personnes, bâtiments) : les zones uniformes (ciel, mer, murs) sont compressées ou étirées en priorité.' }, { k: 'w', label: 'Largeur (px)', type: 'number', min: 8, max: 20000 }, { k: 'h', label: 'Hauteur (px)', type: 'number', min: 8, max: 20000 }, { k: 'keep', label: 'Conserver les proportions', type: 'check' }],
      values: { w: Math.round(d.width * 0.75), h: d.height, keep: false },
      onField: (v, k, api) => { if (v.keep && k === 'w') { v.h = Math.round(v.w / ratio); api.sync(); } if (v.keep && k === 'h') { v.w = Math.round(v.h * ratio); api.sync(); } },
      onOk: (v) => { if (d.width * d.height > 6e6) MP.toast('Grande image : le calcul peut prendre une minute', 4000); setTimeout(() => MP.cmd.contentScale(+v.w, +v.h), 60); },
    });
  },
  sky() {
    UI.dialog({
      title: 'Remplacement du ciel', width: 400, okLabel: 'Remplacer',
      fields: [{ type: 'info', html: 'Le ciel est détecté automatiquement (zone claire et uniforme en haut de la photo) puis remplacé sur un nouveau calque avec masque, modifiable au pinceau.' }, { k: 'p', label: 'Ciel', type: 'select', options: [['bleu', 'Ciel bleu nuageux'], ['coucher', 'Coucher de soleil'], ['dore', 'Heure dorée'], ['rose', 'Pastel rose'], ['orage', 'Orageux'], ['nuit', 'Nuit étoilée']] }, { k: 'h', label: 'Harmoniser le premier plan', type: 'range', min: 0, max: 60, unit: '%' }],
      values: { p: 'coucher', h: 20 }, onOk: (v) => { MP.sky.replace(v.p, v.h); },
    });
  },
  genFill() {
    if (!MP.doc.selection) { MP.toast('Sélectionnez d\'abord la zone à remplir (lasso, rectangle, sélection rapide…)'); return; }
    UI.dialog({ title: '✨ Remplissage génératif', width: 460, okLabel: 'Générer', fields: [{ type: 'info', html: 'Décrivez ce qui doit apparaître dans la sélection, ou laissez vide pour <b>supprimer l\'objet</b> et reconstruire le décor.' }, { k: 'prompt', label: 'Description (facultative)', type: 'textarea', rows: 3 }], values: { prompt: '' }, onOk: (v) => { MP.ai.generativeFill(v.prompt); } });
  },
  genExpand() {
    const d = MP.doc; let ax = 0.5, ay = 0.5;
    UI.dialog({
      title: '✨ Extension générative', width: 420, okLabel: 'Étendre',
      fields: [{ k: 'w', label: 'Nouvelle largeur (px)', type: 'number', min: 1, max: 20000 }, { k: 'h', label: 'Nouvelle hauteur (px)', type: 'number', min: 1, max: 20000 }, { k: 'prompt', label: 'Description (facultative)', type: 'text' }],
      values: { w: Math.round(d.width * 1.5), h: d.height, prompt: '' },
      body: (b) => { b.appendChild(el('div', { class: 'lab' }, 'Position de l\'image actuelle')); const g = el('div', { class: 'anchor' }); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const c = el('button', { class: 'acell' + (i === 1 && j === 1 ? ' on' : '') }); c.onclick = (e) => { e.preventDefault(); g.querySelectorAll('.acell').forEach((x) => x.classList.remove('on')); c.classList.add('on'); ax = i / 2; ay = j / 2; }; g.appendChild(c); } b.appendChild(g); },
      onOk: (v) => { MP.ai.generativeExpand(+v.w, +v.h, ax, ay, v.prompt); },
    });
  },
  genImage() {
    UI.dialog({ title: '✨ Générer une image', width: 460, okLabel: 'Générer', fields: [{ k: 'prompt', label: 'Décrivez l\'image', type: 'textarea', rows: 4 }, { k: 'format', label: 'Format', type: 'select', options: [['square', 'Carré'], ['landscape', 'Paysage'], ['portrait', 'Portrait']] }, { k: 'tr', label: 'Fond transparent (objet détouré)', type: 'check' }], values: { prompt: '', format: 'square', tr: false }, onOk: (v) => { if (!v.prompt.trim()) { MP.toast('Décrivez l\'image à générer'); return false; } MP.ai.generate(v.prompt.trim(), v.format, v.tr); } });
  },
  exportImg() {
    UI.dialog({
      title: 'Exporter l\'image', width: 380,
      fields: [{ k: 'format', label: 'Format', type: 'select', options: [['png', 'PNG (sans perte, transparence)'], ['jpeg', 'JPEG (photos, léger)'], ['webp', 'WebP (web, très léger)']] }, { k: 'quality', label: 'Qualité', type: 'range', min: 1, max: 100, unit: '%' }, { k: 'scale', label: 'Échelle', type: 'range', min: 1, max: 400, unit: '%' }, { k: 'bg', label: 'Fond', type: 'select', options: [['keep', 'Conserver la transparence'], ['white', 'Blanc']] }],
      values: { format: 'png', quality: 90, scale: 100, bg: 'keep' }, okLabel: 'Exporter…',
      onOk: (v) => { MP.io.exportImage(v); },
    });
  },
  shortcuts() {
    const tools = MP.toolOrder.map((id) => MP.tools[id]).filter((t) => t.key && !t.hidden).map((t) => `<tr><td>${esc(t.name)}</td><td><kbd>${t.key}</kbd></td></tr>`).join('');
    const other = [['Taille du pinceau', '[ et ]'], ['Opacité de l\'outil', '1 … 0'], ['Permuter les couleurs', 'X'], ['Couleurs par défaut', 'D'], ['Main temporaire', 'Espace (maintenu)'], ['Zoom', 'Ctrl + molette / Alt + molette'], ['Déplacer d\'un pixel', 'Flèches (Maj : 10 px)'], ['Ajouter / soustraire à la sélection', 'Maj / Alt pendant la sélection'], ['Source du tampon', 'Alt + clic'], ['Pipette couleur d\'arrière-plan', 'Alt + clic'], ['Ligne droite au pinceau', 'Maj + clic'], ['Sélectionner les pixels d\'un calque', 'Ctrl + clic sur la vignette'], ['Valider / annuler', 'Entrée / Échap'], ['Masque rapide', 'Q'], ['Grouper / dissocier', 'Ctrl+G / Ctrl+Maj+G'], ['Fluidité', 'Ctrl+Maj+X'], ['Règles', 'Ctrl+R'], ['Repère', 'glisser depuis une règle'], ['Supprimer un repère', 'le ramener sur la règle (outil Déplacement)']].map(([a, b]) => `<tr><td>${a}</td><td><kbd>${b}</kbd></td></tr>`).join('');
    UI.dialog({ title: 'Raccourcis clavier', width: 560, noCancel: true, fields: [{ type: 'info', html: `<div class="cols"><table>${tools}</table><table>${other}</table></div><p class="muted">Les raccourcis des menus sont indiqués à droite de chaque commande.</p>` }], values: {} });
  },
  about() {
    UI.dialog({ title: 'À propos', noCancel: true, width: 420, fields: [{ type: 'info', html: `<div class="about"><div class="logo big">M</div><h2>Multipify Photo</h2><p>Version ${MP.version}</p><p>Éditeur d'images professionnel : calques et groupes, calques de réglage, styles, masques, PSD, IA générative, retouche, réglages et filtres.</p><p class="muted">© ${new Date().getFullYear()} Multipify — support@multipify.eu</p></div>` }], values: {} });
  },
};

/* ============ Entrées clavier / souris ============ */
UI.bindKeys = () => {
  document.addEventListener('keydown', (e) => {
    if (UI.dialogOpen) return;
    const tag = e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
    if (MP.tool && MP.tool.onKey && MP.tool.onKey(e)) { e.preventDefault(); return; }
    if (e.code === 'Space' && !MP.spacePan) { MP.spacePan = true; MP.view.canvas.style.cursor = 'grab'; e.preventDefault(); return; }
    const sc = evSc(e);
    if (sc === 'c|v') { e.preventDefault(); UI.pasteFromAnywhere(); return; }
    if (sc === 'cs|z') { e.preventDefault(); if (MP.doc) UI.redo(); return; }
    if (sc === '|f1') { e.preventDefault(); UI.dialogs.shortcuts(); return; }
    if (sc === '|f11') { e.preventDefault(); MP.native.toggleFullscreen(); return; }
    if (sc === 's|f5') { e.preventDefault(); need(() => UI.dialogs.fill())(); return; }
    if (sc === 's|f6') { e.preventDefault(); need(() => UI.selModDialog('Contour progressif', (d, r) => MP.sel.feather(d, r), 5))(); return; }
    const act = UI.shortcutMap.get(sc);
    if (act) { e.preventDefault(); UI.exec(act.path, act.act); return; }
    if (e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if ((k === 'delete' || k === 'backspace') && MP.doc) { e.preventDefault(); MP.edit.clear(); return; }
    if (k === 'escape' && MP.doc && MP.doc.selection) { UI.selCmd('Désélectionner', (d) => MP.sel.none(d)); return; }
    if (e.key.startsWith('Arrow') && MP.doc && MP.tool === MP.tools.move) { e.preventDefault(); const s = e.shiftKey ? 10 : 1; MP.tools.move.nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0); return; }
    if (k === 'x') { [MP.colors.fg, MP.colors.bg] = [MP.colors.bg, MP.colors.fg]; UI.refreshColors(); return; }
    if (k === 'd') { MP.colors.fg = '#000000'; MP.colors.bg = '#ffffff'; UI.refreshColors(); return; }
    if ((e.key === '[' || e.key === ']' || e.code === 'BracketLeft' || e.code === 'BracketRight') && MP.tool && MP.tool.opts.size !== undefined) {
      const up = e.key === ']' || e.code === 'BracketRight', s = MP.tool.opts.size, st = s < 10 ? 1 : s < 50 ? 5 : s < 200 ? 10 : 25;
      MP.tool.opts.size = MP.clamp(s + (up ? st : -st), 1, 1000); UI.refreshTool(); MP.render(); return;
    }
    if (/^Digit\d$/.test(e.code) && MP.tool && MP.tool.opts.opacity !== undefined) { const n = +e.code.slice(5); MP.tool.opts.opacity = n === 0 ? 100 : n * 10; UI.refreshTool(); MP.toast('Opacité ' + MP.tool.opts.opacity + ' %', 900); return; }
    if (/^Key[A-Z]$/.test(e.code)) {
      const L = e.code.slice(3);
      if (L === 'Q') { if (MP.doc) MP.toggleQuickMask(); return; }
      const sl = UI.SLOTS.find((x) => x.key === L);
      if (sl) { let id = sl.cur; if (e.shiftKey && sl.tools.includes(MP.tool && MP.tool.id)) id = sl.tools[(sl.tools.indexOf(MP.tool.id) + 1) % sl.tools.length]; sl.cur = id; MP.setTool(id); }
    }
  });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') { MP.spacePan = false; if (MP.tool) MP.view.canvas.style.cursor = MP.tool.cursor || ''; } });
};

UI.bindView = () => {
  const cv = MP.view.canvas;
  let pan = null, down = false, guideDrag = null;
  const P = (e) => MP.view.toDoc(e.clientX, e.clientY);
  cv.addEventListener('pointerdown', (e) => {
    if (!MP.doc) return; cv.setPointerCapture(e.pointerId); cv.focus();
    let p = P(e);
    if (e.button === 1 || MP.spacePan || (e.button === 0 && MP.tool.id === 'hand')) { pan = { x: e.clientX, y: e.clientY, px: MP.doc.panX, py: MP.doc.panY }; cv.style.cursor = 'grabbing'; return; }
    if (e.button !== 0) return;
    const g = MP.tool.id === 'move' && MP.guides.hit(p);
    if (g) { guideDrag = g; MP.guides.moving = g; return; }
    if (MP.tool.snap) p = MP.guides.snap(p);
    down = true; MP.tool.down && MP.tool.down(p, e);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!MP.doc) return; let p = P(e);
    if (guideDrag) { guideDrag.pos = Math.round(guideDrag.dir === 'h' ? p.y : p.x); MP.renderView(); return; }
    if (MP.tool.snap && (down || MP.tool.id === 'pen')) p = MP.guides.snap(p);
    if (MP.tool.id === 'move' && !down) cv.style.cursor = MP.guides.hit(p) ? (MP.guides.hit(p).dir === 'h' ? 'row-resize' : 'col-resize') : 'move';
    MP.view.cursor = p; if (!UI._ciQ) { UI._ciQ = true; setTimeout(() => { UI._ciQ = false; if (MP.doc && MP.view.cursor) UI.cursorInfo(MP.view.cursor); }, 60); }
    if (pan) { MP.doc.panX = pan.px + e.clientX - pan.x; MP.doc.panY = pan.py + e.clientY - pan.y; MP.renderView(); return; }
    if (MP.tool.move) {
      if (down && e.getCoalescedEvents && MP.tool.eng) { for (const ce of e.getCoalescedEvents()) MP.tool.move(P(ce), ce); }
      else MP.tool.move(p, e);
    }
    if (MP.tool.brushCursor) MP.renderView(); else if (MP.prefs.rulers !== false) MP.guides.drawRulers();
  });
  const up = (e) => {
    if (guideDrag) { const r = cv.getBoundingClientRect(); if (e.clientX - r.left < MP.guides.R || e.clientY - r.top < MP.guides.R) MP.doc.guides = MP.doc.guides.filter((x) => x !== guideDrag); guideDrag = null; MP.guides.moving = null; MP.renderView(); return; }
    if (pan) { pan = null; cv.style.cursor = MP.spacePan ? 'grab' : MP.tool.cursor || ''; return; }
    if (!down) return; down = false;
    MP.tool.up && MP.tool.up(MP.tool.snap ? MP.guides.snap(P(e)) : P(e), e);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('dblclick', (e) => { if (MP.doc && MP.tool.dbl) MP.tool.dbl(P(e), e); });
  cv.addEventListener('pointerleave', () => { MP.view.cursor = null; MP.renderView(); });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => {
    if (!MP.doc) return; e.preventDefault();
    const r = cv.getBoundingClientRect(), at = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.ctrlKey || e.altKey || e.metaKey) MP.view.setZoom(MP.doc.zoom * Math.exp(-e.deltaY * (e.ctrlKey && Math.abs(e.deltaY) < 50 ? 0.01 : 0.0025)), at);
    else { MP.doc.panX -= e.shiftKey ? e.deltaY : e.deltaX; MP.doc.panY -= e.shiftKey ? 0 : e.deltaY; MP.renderView(); }
  }, { passive: false });
};
UI.refreshInfo = () => {
  const box = $('#infobox'); if (!box || $('#panel-info').classList.contains('collapsed')) return;
  const d = MP.doc; if (!d) { box.innerHTML = ''; return; }
  const px = (x, y) => (x >= 0 && y >= 0 && x < d.width && y < d.height ? d._comp.getContext('2d').getImageData(x, y, 1, 1).data : null);
  const fmt = (c) => (c ? `<i style="background:rgb(${c[0]},${c[1]},${c[2]})"></i>R ${c[0]} · V ${c[1]} · B ${c[2]} <span class="muted">${MP.rgbToHex(c[0], c[1], c[2])}</span>` : '—');
  const cur = MP.view.cursor ? { x: Math.floor(MP.view.cursor.x), y: Math.floor(MP.view.cursor.y) } : null, sb = MP.sel.bounds(d);
  let h = `<div class="ir"><b>Pointeur</b> ${cur ? `X ${cur.x} · Y ${cur.y}` : '—'}</div><div class="ir">${cur ? fmt(px(cur.x, cur.y)) : ''}</div>`;
  h += `<div class="ir"><b>Sélection</b> ${sb ? `${sb.w} × ${sb.h} px (à ${sb.x}, ${sb.y})` : 'aucune'}</div>`;
  if (MP.measure) h += `<div class="ir"><b>Règle</b> ${MP.measure.len.toFixed(1)} px · ${MP.measure.angle.toFixed(1)}° · ΔX ${MP.measure.dx.toFixed(0)} ΔY ${MP.measure.dy.toFixed(0)}</div>`;
  (d.samplers || []).forEach((s, i) => { h += `<div class="ir"><b>#${i + 1}</b> ${fmt(px(s.x, s.y))}</div>`; });
  box.innerHTML = h;
};
UI.drawHistogram = () => {
  const c = $('#histcanvas'); if (!c || $('#panel-histo').classList.contains('collapsed')) return;
  const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2; const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  const d = MP.doc; if (!d) return; const H = MP.histogram(d._comp); let mx = 1; for (const k of ['r', 'g', 'b']) for (let i = 1; i < 255; i++) mx = Math.max(mx, H[k][i]);
  x.globalCompositeOperation = 'screen';
  for (const [k, col] of [['r', '#ff3b3b'], ['g', '#3bdb4b'], ['b', '#3b7bff']]) { x.fillStyle = col; x.beginPath(); x.moveTo(0, c.height); for (let i = 0; i < 256; i++) x.lineTo((i / 255) * c.width, c.height - Math.min(1, H[k][i] / mx) * (c.height - 4)); x.lineTo(c.width, c.height); x.closePath(); x.fill(); }
};
UI.cursorInfo = (p) => {
  UI.refreshInfo();
  const d = MP.doc, x = Math.floor(p.x), y = Math.floor(p.y);
  $('#st-pos').textContent = `X ${x}  Y ${y}`;
  if (x >= 0 && y >= 0 && x < d.width && y < d.height) {
    const c = d._comp.getContext('2d').getImageData(x, y, 1, 1).data;
    $('#st-color').innerHTML = `<i style="background:rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})"></i> R ${c[0]} V ${c[1]} B ${c[2]} A ${Math.round((c[3] / 255) * 100)} %`;
  } else $('#st-color').textContent = '';
};

/* ============ Panneaux repliables ============ */
UI.bindPanels = () => {
  document.querySelectorAll('.panel > h3').forEach((h) => h.addEventListener('click', () => { h.parentElement.classList.toggle('collapsed'); UI.navigatorDirty(); }));
  $('#st-zoom').addEventListener('change', (e) => MP.doc && MP.view.setZoom(+e.target.value / 100));
  $('#welcome-new').onclick = () => UI.dialogs.newDoc();
  $('#welcome-open').onclick = () => MP.io.open();
  const rec = MP.io.recent(), wr = $('#welcome-recent');
  if (rec.length && !MP.native.browser) { wr.innerHTML = '<h4>Récents</h4>'; rec.slice(0, 6).forEach((p) => { const a = el('a', { href: '#', title: p }, esc(p.split(/[\\/]/).pop())); a.onclick = (e) => { e.preventDefault(); MP.io.openRecent(p); }; wr.appendChild(a); }); }
};

UI.init = () => {
  ['marquee', 'ellipse', 'crop', 'shape', 'gradient', 'pen'].forEach((id) => MP.tools[id] && (MP.tools[id].snap = true));
  UI.buildMenus(); UI.buildToolbar(); UI.buildColorPanel(); UI.buildLayerPanel(); UI.buildNavigator(); UI.bindKeys(); UI.bindView(); UI.bindPanels();
  MP.setTool('brush'); UI.refreshAll();
};

/* Polices installées sur l'ordinateur (API Local Font Access de Chromium / Electron) */
MP.loadSystemFonts = async () => {
  if (MP._fontsLoaded || !window.queryLocalFonts) return; MP._fontsLoaded = true;
  try {
    const fams = [...new Set((await window.queryLocalFonts()).map((f) => f.family))].sort((a, b) => a.localeCompare(b, 'fr'));
    if (fams.length) { MP.FONTS.splice(0, MP.FONTS.length, ...new Set([...MP.FONTS.slice(0, 6), ...fams])); const t = MP.tools.text.options.find((o) => o.k === 'font'); if (t) t.options = MP.FONTS.map((f) => [f, f]); }
  } catch (_) { MP._fontsLoaded = false; }
};

UI.exec = (path, act) => { if (UI.rec && path && path[0] !== 'Fenêtre') UI.rec.push(path); UI.lastCmd = path; return act(); };
