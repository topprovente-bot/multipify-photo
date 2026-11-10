'use strict';
/* v5 (interface) — dock de panneaux à onglets, panneaux Propriétés / Réglages / Pinceaux / Caractère / Styles / Dégradés /
   Motifs / Couches / Tracés, instantanés, calques avancés, barre de tâches contextuelle, écran d'accueil */

const FX_NAMES = { shadow: 'Ombre portée', glow: 'Lueur externe', stroke: 'Contour', inner: 'Ombre interne', bevel: 'Biseautage et estampage', overlay: 'Incrustation couleur', gradient: 'Incrustation en dégradé', satin: 'Satin' };
const ADJ_GLYPH = { light: '☼', colorVibrance: '🌡', clarity: '◇', grain: '⁘', brightness: '☀', levels: '▥', curves: '∿', exposure: '±', vibrance: 'V', hueSat: 'H', colorBalance: '⚖', blackWhite: '◐', photoFilter: '◍', shadowsHighlights: '◑', gradientMap: '▤', invert: '⊘', posterize: '▦', threshold: '◧', channelMixer: '⧉', selectiveColor: '◎', colorLookup: 'LUT', solidFill: '■', gradientFill: '▧', cameraRaw: 'RAW', replaceColor: '⇄' };
const burst = (label) => { const d = MP.doc; if (!UI._burst) d.history.record(label, null); clearTimeout(UI._burstT); UI._burst = true; UI._burstT = setTimeout(() => (UI._burst = false), 900); };
const sec = (box, title) => { const s = el('div', { class: 'psec' }); if (title) s.appendChild(el('div', { class: 'psec-t' }, esc(title))); box.appendChild(s); return s; };
const btn = (label, fn, title, cls = '') => { const b = el('button', { class: 'btn small ' + cls, title: title || '' }, label); b.onclick = (e) => { e.preventDefault(); fn(e); }; return b; };
const row = (...kids) => { const r = el('div', { class: 'prow' }); kids.forEach((k) => r.appendChild(k)); return r; };

/* =================== Dock de panneaux à onglets =================== */
UI.DOCK = [
  ['panel-props', 'panel-adjust', 'panel-nav', 'panel-info', 'panel-histo'],
  ['panel-color', 'panel-swatches', 'panel-gradients', 'panel-patterns', 'panel-styles'],
  ['panel-brushes', 'panel-char', 'panel-history', 'panel-actions'],
  ['panel-layers', 'panel-channels', 'panel-paths'],
];
UI.buildDock = () => {
  const host = $('#panels');
  const NEW = [['panel-props', 'Propriétés'], ['panel-adjust', 'Réglages'], ['panel-gradients', 'Dégradés'], ['panel-patterns', 'Motifs'], ['panel-styles', 'Styles'], ['panel-brushes', 'Pinceaux'], ['panel-char', 'Caractère'], ['panel-channels', 'Couches'], ['panel-paths', 'Tracés']];
  for (const [id, t] of NEW) host.appendChild(el('section', { class: 'panel collapsed', id }, `<h3>${t}</h3><div class="body"></div>`));
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('mp.dock') || '{}'); } catch (_) { /* */ }
  UI.DOCK.forEach((ids, gi) => {
    const g = el('div', { class: 'pgroup' + (gi === 3 ? ' grow' : '') + ((saved.min || [2]).includes(gi) ? ' min' : '') }), tabs = el('div', { class: 'ptabs' });
    g.appendChild(tabs);
    ids.forEach((id) => {
      const s = $('#' + id); if (!s) return; const t = el('button', { class: 'ptab', 'data-p': id }, esc(s.querySelector('h3').textContent));
      t.onclick = () => { if (!s.classList.contains('collapsed') && !g.classList.contains('min')) { g.classList.add('min'); UI.saveDock(); } else UI.showPanel(id); };
      tabs.appendChild(t); g.appendChild(s); s.classList.add('collapsed');
    });
    tabs.addEventListener('dblclick', (e) => { if (e.target === tabs) { g.classList.toggle('min'); UI.saveDock(); } });
    host.appendChild(g);
    const act = (saved.active || {})[gi] || ids[0]; UI.showPanel(act, true);
    if ((saved.min || [2]).includes(gi)) g.classList.add('min');
  });
};
UI.saveDock = () => {
  const groups = [...document.querySelectorAll('.pgroup')], st = { active: {}, min: [] };
  groups.forEach((g, i) => { const a = g.querySelector('.panel:not(.collapsed)'); if (a) st.active[i] = a.id; if (g.classList.contains('min')) st.min.push(i); });
  try { localStorage.setItem('mp.dock', JSON.stringify(st)); } catch (_) { /* */ }
};
UI.showPanel = (id, silent) => {
  const s = document.getElementById(id); if (!s) return; const g = s.closest('.pgroup'); if (!g) { s.classList.remove('collapsed'); return; }
  g.querySelectorAll('.panel').forEach((p) => p.classList.toggle('collapsed', p !== s));
  g.querySelectorAll('.ptab').forEach((t) => t.classList.toggle('on', t.dataset.p === id));
  g.classList.remove('min');
  if (!silent) { UI.saveDock(); s.scrollIntoView({ block: 'nearest' }); }
  UI.refreshPanel(id);
};
UI.refreshPanel = (id) => {
  const f = { 'panel-props': UI.refreshProps, 'panel-adjust': UI.buildAdjustPanel, 'panel-brushes': UI.buildBrushPanel, 'panel-char': UI.refreshChar, 'panel-styles': UI.buildStylesPanel, 'panel-gradients': UI.buildGradientsPanel, 'panel-patterns': UI.buildPatternsPanel, 'panel-channels': UI.refreshChannels, 'panel-paths': UI.refreshPaths, 'panel-nav': UI.drawNavigator, 'panel-info': UI.refreshInfo, 'panel-histo': UI.drawHistogram }[id];
  if (f) try { f(true); } catch (e) { console.warn(e); }
};
const visible = (id) => { const s = document.getElementById(id); return s && !s.classList.contains('collapsed') && !s.closest('.pgroup.min'); };

/* =================== Propriétés =================== */
UI.refreshProps = (force) => {
  if (!visible('panel-props')) return;
  const box = $('#panel-props .body'), d = MP.doc, l = d && d.layer;
  const key = d ? `${d.id}|${l && l.id}|${l && l.kind}|${d.editMask}|${!!d.selection}|${l && !!l.smart}|${d.width}x${d.height}` : 'none';
  if (!force && key === UI._propsKey && box.contains(document.activeElement)) return;
  if (!force && key === UI._propsKey && UI._burst) return;
  UI._propsKey = key; box.innerHTML = '';
  if (!d) { box.innerHTML = '<p class="muted">Aucun document ouvert.</p>'; return; }
  const kindName = l.isGroup ? 'Groupe' : l.adjust ? 'Calque de réglage' : l.smart ? 'Objet dynamique' : l.text ? 'Calque de texte' : 'Calque de pixels';
  box.appendChild(el('div', { class: 'ph' }, `<b>${esc(kindName)}</b><span>${esc(l.name)}</span>`));
  if (d.editMask && l.mask) {
    const s = sec(box, 'Masque de fusion'), v = { dens: Math.round((l.maskDensity == null ? 1 : l.maskDensity) * 100), fe: l.maskFeather || 0 };
    s.appendChild(UI.control({ k: 'dens', label: 'Densité', type: 'range', min: 0, max: 100, unit: '%' }, v, () => { burst('Densité du masque'); l.maskDensity = v.dens / 100; MP.render(); }));
    s.appendChild(UI.control({ k: 'fe', label: 'Contour progressif', type: 'range', min: 0, max: 250, step: 0.5, unit: 'px' }, v, () => { burst('Contour progressif du masque'); l.maskFeather = v.fe; MP.render(); }));
    s.appendChild(row(btn('Sélectionner et masquer…', () => { MP.sel.fromMask(d, l.mask); MP.cmd.selectAndMask(); }), btn('Inverser', () => MP.layerOps.invertMask()), btn(l.maskEnabled ? 'Désactiver' : 'Activer', () => MP.layerOps.toggleMask())));
  }
  if (l.adjust) {
    const spec = MP.ADJUST[l.adjust.key], s = sec(box, spec.title), vals = JSON.parse(JSON.stringify(l.adjust.values));
    const changed = () => { burst('Modifier ' + spec.title); l.adjust.values = JSON.parse(JSON.stringify(vals)); MP.render(); };
    (spec.fields || []).forEach((f) => s.appendChild(UI.control(f, vals, changed)));
    if (spec.histogram) UI.histogramWidget(s, MP.cloneCanvas(d._comp), vals);
    if (spec.curves) UI.curvesWidget(s, MP.cloneCanvas(d._comp), vals, changed);
    if (!spec.fields) s.appendChild(el('p', { class: 'muted' }, 'Ce réglage n\'a pas de paramètre.'));
    s.appendChild(row(btn('Réinitialiser', () => { d.history.record('Réinitialiser ' + spec.title, null); l.adjust.values = JSON.parse(JSON.stringify(spec.values || {})); MP.afterEdit(); UI.refreshProps(true); }), btn(l.visible ? 'Masquer' : 'Afficher', () => { d.history.record('Visibilité', null); l.visible = !l.visible; MP.afterEdit(); })));
  } else if (l.isGroup) {
    const s = sec(box, 'Groupe'); s.appendChild(el('p', { class: 'muted' }, `${d.descendants(l).length} élément(s) — mode ${l.blend === 'pass-through' ? 'Transfert' : l.blend}`));
    s.appendChild(row(btn('Fusionner le groupe', () => MP.layerOps.mergeGroup()), btn('Dissocier', () => MP.layerOps.ungroup())));
  } else {
    const b = MP.layerBox(l);
    if (b) {
      const s = sec(box, 'Transformation'), v = { w: b.w, h: b.h, x: b.x, y: b.y, angle: b.angle, keep: true }, ratio = b.w / b.h;
      const g = el('div', { class: 'pgrid' });
      [['w', 'L'], ['h', 'H'], ['x', 'X'], ['y', 'Y'], ['angle', '∠']].forEach(([k, lb]) => g.appendChild(UI.control({ k, label: lb, type: 'number', min: k === 'w' || k === 'h' ? 1 : -50000, max: 50000 }, v, (vv, kk) => { if (v.keep && kk === 'w') { v.h = Math.round(v.w / ratio); } if (v.keep && kk === 'h') { v.w = Math.round(v.h * ratio); } g.querySelectorAll('.ctl').forEach((c) => c._sync && c._sync()); })));
      g.appendChild(UI.control({ k: 'keep', label: 'Proportions', type: 'check' }, v, () => {}));
      s.appendChild(g);
      s.appendChild(row(btn('Appliquer', () => MP.layerOps.transformNumeric({ w: +v.w, h: +v.h, x: +v.x, y: +v.y, angle: +v.angle }), 'Appliquer la taille, la position et l\'angle', 'primary'), btn('⇋', () => MP.flipImage(true, true), 'Symétrie horizontale'), btn('⇵', () => MP.flipImage(false, true), 'Symétrie verticale'), btn('Ctrl+T', () => MP.startTransform(), 'Transformation manuelle')));
      const a = sec(box, 'Aligner sur le document'); a.appendChild(row(...[['left', '⇤'], ['hcenter', '↔'], ['right', '⇥'], ['top', '⤒'], ['vcenter', '↕'], ['bottom', '⤓']].map(([k, ic]) => btn(ic, () => MP.alignLayer(k), 'Aligner'))));
    }
    if (l.text) {
      const s = sec(box, 'Texte'), v = { font: l.text.font, size: l.text.size, color: l.text.color, bold: l.text.bold, italic: l.text.italic, align: l.text.align };
      const ch = () => { burst('Modifier le texte'); Object.assign(l.text, { ...v, size: +v.size }); MP.renderText(l); MP.render(); };
      s.appendChild(UI.control({ k: 'font', label: 'Police', type: 'select', options: MP.FONTS.map((f) => [f, f]) }, v, ch));
      s.appendChild(UI.control({ k: 'size', label: 'Taille', type: 'number', min: 2, max: 3000 }, v, ch));
      s.appendChild(UI.control({ k: 'color', label: 'Couleur', type: 'color' }, v, ch));
      s.appendChild(row(UI.control({ k: 'bold', label: 'Gras', type: 'check' }, v, ch), UI.control({ k: 'italic', label: 'Italique', type: 'check' }, v, ch)));
      s.appendChild(UI.control({ k: 'align', label: 'Alignement', type: 'select', options: [['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']] }, v, ch));
      s.appendChild(row(btn('Modifier le texte…', () => UI.textDialog(l, false)), btn('Panneau Caractère', () => UI.showPanel('panel-char'))));
    }
    if (l.smart) {
      const s = sec(box, 'Objet dynamique'); s.appendChild(el('p', { class: 'muted' }, `Contenu d'origine : ${l.smart.src.width} × ${l.smart.src.height} px — ${l.smart.filters.length} filtre(s) dynamique(s)`));
      s.appendChild(row(btn('Remplacer le contenu…', () => MP.smart.replace()), btn('Pixelliser', () => MP.smart.rasterize())));
    }
    const q = sec(box, 'Actions rapides');
    q.appendChild(row(btn('✨ Supprimer l\'arrière-plan', () => MP.ai.removeBackground()), btn('✨ Sélectionner le sujet', () => MP.ai.selectSubject())));
    q.appendChild(row(btn('Style de calque…', () => UI.dialogs.layerStyle()), l.smart ? btn('Filtre dynamique…', () => UI.showPanel('panel-adjust')) : btn('Objet dynamique', () => MP.smart.convert(), 'Convertir en objet dynamique')));
  }
  if (d.selection) {
    const b = MP.sel.bounds(d), s = sec(box, 'Sélection'); s.appendChild(el('p', { class: 'muted' }, b ? `${b.w} × ${b.h} px à (${b.x}, ${b.y})` : ''));
    s.appendChild(row(btn('Sélectionner et masquer…', () => MP.cmd.selectAndMask()), btn('Inverser', () => UI.selCmd('Intervertir', (dd) => MP.sel.invert(dd))), btn('Désélectionner', () => UI.selCmd('Désélectionner', (dd) => MP.sel.none(dd)))));
    s.appendChild(row(btn('✨ Remplissage génératif…', () => UI.dialogs.genFill()), btn('Calque par copier', () => UI.layerViaCopy())));
  }
  const s = sec(box, 'Document'); s.appendChild(el('p', { class: 'muted' }, `${d.width} × ${d.height} px — ${d.layers.length} calque(s)`));
  s.appendChild(row(btn('Taille de l\'image…', () => UI.dialogs.imageSize()), btn('Zone de travail…', () => UI.dialogs.canvasSize()), btn('Rogner', () => MP.trimImage())));
};

/* =================== Réglages (icônes + préréglages) =================== */
UI.buildAdjustPanel = () => {
  const box = $('#panel-adjust .body'); if (box.dataset.built) return; box.dataset.built = 1;
  box.appendChild(el('div', { class: 'psec-t' }, 'Ajouter un réglage'));
  const g = el('div', { class: 'adjgrid' });
  for (const k of MP.ADJ_LAYER_KEYS) { const b = el('button', { class: 'adjbtn', title: MP.ADJUST[k].title + ' (calque de réglage)' }, esc(ADJ_GLYPH[k] || '•')); b.onclick = need(() => MP.layerOps.addAdjust(k)); g.appendChild(b); }
  box.appendChild(g);
  box.appendChild(el('div', { class: 'psec-t' }, 'Préréglages (2026)'));
  const cats = [...new Set(MP.PRESETS.adjust.map((p) => p.cat))];
  for (const c of cats) {
    const det = el('details', { class: 'pcat', open: c === 'Portrait' || null }, `<summary>${esc(c)}</summary>`);
    MP.PRESETS.adjust.filter((p) => p.cat === c).forEach((p) => { const b = el('div', { class: 'preset-item', title: p.steps.map((s) => MP.ADJUST[s[0]].title).join(' + ') }, `<i>${esc(ADJ_GLYPH[p.steps[0][0]] || '•')}</i>${esc(p.name)}`); b.onclick = need(() => MP.applyAdjustPreset(p)); det.appendChild(b); });
    box.appendChild(det);
  }
  box.appendChild(el('p', { class: 'muted' }, 'Sur un objet dynamique, les filtres du menu Filtre deviennent des filtres dynamiques modifiables.'));
};

/* =================== Pinceaux =================== */
UI.brushThumb = (o) => {
  const c = el('canvas', { width: 220, height: 56, class: 'bthumb' }), x = c.getContext('2d'), col = '#e9e9ee';
  const size = Math.min(26, Math.max(6, (o.size || 20) / 2.5)), st = MP.makeStamp(size, (o.hardness == null ? 70 : o.hardness) / 100, col, o.shape === 'custom' ? 'round' : o.shape || 'round');
  const n = 60;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), px = 14 + t * 192, py = 28 + Math.sin(t * Math.PI * 2) * 12;
    if (o.spacing && i % Math.max(1, Math.round(o.spacing / 10)) !== 0) continue;
    let s = 1 - (o.sizeJit ? Math.random() * o.sizeJit / 100 : 0); if (o.pressure) s *= 0.35 + Math.sin(t * Math.PI) * 0.65;
    x.globalAlpha = Math.min(1, ((o.flow || 100) / 100) * (o.opJit ? 1 - Math.random() * o.opJit / 100 : 1));
    const ox = o.scatter ? (Math.random() - 0.5) * size * o.scatter / 50 : 0, oy = o.scatter ? (Math.random() - 0.5) * size * o.scatter / 50 : 0;
    x.save(); x.translate(px + ox, py + oy); x.rotate(((o.angle || 0) * Math.PI) / 180 + (o.angJit ? (Math.random() - 0.5) * 6.28 * o.angJit / 100 : 0)); x.scale(1, (o.round || 100) / 100);
    if (o.shape === 'spray') { x.fillStyle = col; for (let k = 0; k < 6; k++) x.fillRect((Math.random() - 0.5) * size, (Math.random() - 0.5) * size, 1, 1); } else x.drawImage(st, -st.width * s / 2, -st.height * s / 2, st.width * s, st.height * s);
    x.restore();
  }
  return c;
};
UI.buildBrushPanel = () => {
  const box = $('#panel-brushes .body');
  if (!box.dataset.built) {
    box.dataset.built = 1;
    box.appendChild(el('div', { class: 'psec-t' }, 'Formes prédéfinies'));
    const list = el('div', { class: 'blist' });
    MP.PRESETS.brushes.forEach((p) => { const it = el('div', { class: 'bitem', title: p.name }); it.appendChild(UI.brushThumb({ size: 30, hardness: 70, flow: 100, ...p.o })); it.appendChild(el('span', {}, esc(p.name))); it.onclick = () => { const t = MP.tool && ['brush', 'eraser'].includes(MP.tool.id) ? MP.tool : MP.tools.brush; Object.assign(t.opts, { spacing: 0, scatter: 0, sizeJit: 0, opJit: 0, angJit: 0, round: 100, angle: 0, air: false, sym: '' }, p.o); if (MP.tool !== t) MP.setTool(t.id); else UI.refreshTool(); UI.syncBrushPanel(); MP.toast('Pinceau : ' + p.name); }; list.appendChild(it); });
    box.appendChild(list);
    box.appendChild(el('div', { class: 'psec-t' }, 'Paramètres de la forme'));
    box.appendChild(el('div', { id: 'brushsettings' }));
  }
  UI.syncBrushPanel();
};
UI.syncBrushPanel = () => {
  const host = document.getElementById('brushsettings'); if (!host || !visible('panel-brushes')) return;
  const t = MP.tool && ['brush', 'eraser'].includes(MP.tool.id) ? MP.tool : MP.tools.brush; host.innerHTML = '';
  host.appendChild(el('p', { class: 'muted' }, 'Outil : ' + esc(t.name)));
  for (const o of t.options) if (o.type !== 'button') host.appendChild(UI.control(o, t.opts, () => { if (MP.tool === t) UI.refreshTool(); MP.renderView(); }));
};

/* =================== Caractère =================== */
UI.refreshChar = () => {
  if (!visible('panel-char')) return;
  const box = $('#panel-char .body'), d = MP.doc, l = d && d.layer && d.layer.text ? d.layer : null;
  const key = l ? 'L' + l.id : 'tool'; if (key === UI._charKey && box.contains(document.activeElement)) return; UI._charKey = key;
  box.innerHTML = '';
  const t = l ? l.text : MP.tools.text.opts, v = l ? { arc: 0, circle: false, vertical: false, ...t } : t;
  box.appendChild(el('p', { class: 'muted' }, l ? 'Calque de texte : ' + esc(l.name) : 'Réglages par défaut de l\'outil Texte (sélectionnez un calque de texte pour le modifier)'));
  const ch = () => { if (!l) return; burst('Caractère'); Object.assign(l.text, v, { size: +v.size }); MP.renderText(l); MP.render(); };
  const F = [{ k: 'font', label: 'Police', type: 'select', options: MP.FONTS.map((f) => [f, f]) }, { k: 'size', label: 'Taille (px)', type: 'number', min: 2, max: 3000 }];
  if (l) F.push({ k: 'color', label: 'Couleur', type: 'color' }, { k: 'lineHeight', label: 'Interlignage', type: 'range', min: 0.6, max: 3, step: 0.05 }, { k: 'spacing', label: 'Approche', type: 'range', min: -20, max: 100, unit: 'px' }, { k: 'align', label: 'Alignement', type: 'select', options: [['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']] });
  F.forEach((f) => box.appendChild(UI.control(f, v, ch)));
  box.appendChild(row(UI.control({ k: 'bold', label: 'Gras', type: 'check' }, v, ch), UI.control({ k: 'italic', label: 'Italique', type: 'check' }, v, ch), ...(l ? [UI.control({ k: 'underline', label: 'Souligné', type: 'check' }, v, ch)] : [])));
  if (l) {
    [{ k: 'stroke', label: 'Contour', type: 'check' }, { k: 'strokeColor', label: 'Couleur du contour', type: 'color' }, { k: 'strokeWidth', label: 'Épaisseur du contour', type: 'range', min: 1, max: 50, unit: 'px' }, { k: 'shadow', label: 'Ombre', type: 'check' }, { type: 'header', label: 'Texte dynamique' }, { k: 'arc', label: 'Arc', type: 'range', min: -100, max: 100, unit: '%' }, { k: 'circle', label: 'Cercle', type: 'check' }, { k: 'vertical', label: 'Vertical', type: 'check' }].forEach((f) => box.appendChild(UI.control(f, v, ch)));
    box.appendChild(row(btn('Modifier le contenu…', () => UI.textDialog(l, false)), btn('Pixelliser', () => MP.layerOps.rasterize())));
  }
  if (window.queryLocalFonts && !MP._fontsLoaded) box.appendChild(row(btn('Charger les polices de l\'ordinateur', async () => { await MP.loadSystemFonts(); UI._charKey = null; UI.refreshChar(); })));
};

/* =================== Styles, dégradés, motifs =================== */
UI.buildStylesPanel = () => {
  const box = $('#panel-styles .body'); if (box.dataset.built) return; box.dataset.built = 1;
  const g = el('div', { class: 'tilegrid' }), tdoc = new MP.Doc(64, 64, 'tmp');
  MP.PRESETS.styles.forEach((p, i) => {
    const t = el('div', { class: 'tile', title: p.name }), c = el('canvas', { width: 64, height: 64 }), x = c.getContext('2d');
    const src = MP.createCanvas(64, 64), sc = src.getContext('2d'); sc.fillStyle = '#7f8fa6'; sc.beginPath(); sc.roundRect(14, 14, 36, 36, 8); sc.fill();
    const fx = MP.fx.defaults(); for (const [k, v] of Object.entries(p.fx)) Object.assign(fx[k], v);
    for (let j = 0; j < 64; j += 8) for (let k = 0; k < 64; k += 8) { x.fillStyle = (j + k) % 16 ? '#3a3a40' : '#4a4a52'; x.fillRect(j, k, 8, 8); }
    x.drawImage(MP.fx.render(tdoc, { id: 'st' + i, fx, fill: 1, _v: 0 }, src), 0, 0);
    t.append(c, el('span', {}, esc(p.name))); t.onclick = need(() => MP.applyStylePreset(p)); g.appendChild(t);
  });
  box.appendChild(g); box.appendChild(el('p', { class: 'muted' }, 'Cliquez pour appliquer au calque actif (modifiable ensuite dans Style de calque).'));
};
UI.buildGradientsPanel = () => {
  const box = $('#panel-gradients .body'); if (box.dataset.built) return; box.dataset.built = 1;
  const g = el('div', { class: 'tilegrid grad' });
  MP.PRESETS.gradients.forEach(([n, stops]) => { const t = el('div', { class: 'tile', title: n }), sw = el('div', { class: 'gsw' }); sw.style.background = `linear-gradient(90deg, ${stops.map(([p, c]) => `${c} ${p * 100}%`).join(', ')}), repeating-conic-gradient(#999 0 25%, #ddd 0 50%) 0 0/10px 10px`; t.append(sw, el('span', {}, esc(n))); t.onclick = () => { const o = MP.tools.gradient.opts; o.mode = 'preset'; o.presetStops = stops; MP.setTool('gradient'); MP.toast('Dégradé « ' + n + ' » — tracez sur l\'image'); }; g.appendChild(t); });
  box.appendChild(g);
};
UI.buildPatternsPanel = () => {
  const box = $('#panel-patterns .body'); if (box.dataset.built) return; box.dataset.built = 1;
  const g = el('div', { class: 'tilegrid' });
  Object.keys(MP.PRESETS.patterns).forEach((n) => { const t = el('div', { class: 'tile', title: n }), c = el('canvas', { width: 64, height: 64 }), x = c.getContext('2d'); x.fillStyle = x.createPattern(MP.makePattern(n, 32), 'repeat'); x.fillRect(0, 0, 64, 64); t.append(c, el('span', {}, esc(n))); t.onclick = () => { MP.pattern = MP.makePattern(n, 64); g.querySelectorAll('.tile').forEach((e) => e.classList.toggle('on', e === t)); MP.toast('Motif « ' + n + ' » défini'); }; g.appendChild(t); });
  box.appendChild(g);
  box.appendChild(row(btn('Remplir', need(() => MP.edit.fill({ what: 'pattern', opacity: 100 })), 'Remplir le calque ou la sélection avec le motif'), btn('Tampon de motif', () => MP.setTool('patternstamp')), btn('Définir d\'après la sélection', need(() => MP.cmd.definePattern()))));
};

/* =================== Couches & tracés =================== */
UI.refreshChannels = () => {
  if (!visible('panel-channels')) return; const box = $('#panel-channels .body'), d = MP.doc; box.innerHTML = ''; if (!d) return;
  const comp = d._comp, mk = (ch) => { const c = el('canvas', { width: 80, height: 60, class: 'thumb' }), x = c.getContext('2d'); x.drawImage(comp, 0, 0, 80, 60); if (ch) { const id = x.getImageData(0, 0, 80, 60), a = id.data, k = { r: 0, g: 1, b: 2 }[ch]; for (let i = 0; i < a.length; i += 4) { a[i] = a[i + 1] = a[i + 2] = a[i + k]; a[i + 3] = 255; } x.putImageData(id, 0, 0); } return c; };
  [[null, 'RVB', 'Ctrl+2'], ['r', 'Rouge', 'Ctrl+3'], ['g', 'Vert', 'Ctrl+4'], ['b', 'Bleu', 'Ctrl+5']].forEach(([ch, n, sc]) => {
    const r = el('div', { class: 'layer' + ((MP.viewChannel || null) === ch ? ' active' : '') }); r.appendChild(el('span', { class: 'eye' }, MP.icon('eye', 16))); r.appendChild(mk(ch)); r.appendChild(el('span', { class: 'lname' }, n)); r.appendChild(el('kbd', {}, sc));
    r.onclick = () => { MP.viewChannel = ch; d._chKey = null; MP.renderView(); UI.refreshChannels(); }; box.appendChild(r);
  });
  (d.channels || []).forEach((c, i) => {
    const r = el('div', { class: 'layer', title: 'Clic : récupérer comme sélection — Maj : ajouter — Alt : soustraire' }), t = el('canvas', { width: 80, height: 60, class: 'thumb' }), x = t.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 80, 60); x.drawImage(c.canvas, 0, 0, 80, 60);
    r.append(el('span', { class: 'eye' }, '⬚'), t, el('span', { class: 'lname' }, esc(c.name))); const del = el('button', { class: 'ibtn', title: 'Supprimer la couche' }, MP.icon('trash', 14)); del.onclick = (e) => { e.stopPropagation(); MP.channels.remove(i); }; r.appendChild(del);
    r.onclick = (e) => MP.channels.load(i, e.shiftKey ? 'add' : e.altKey ? 'sub' : 'new'); box.appendChild(r);
  });
  box.appendChild(row(btn('Enregistrer la sélection', () => MP.channels.save(), 'Mémorise la sélection actuelle dans une couche alpha')));
};
UI.refreshPaths = () => {
  if (!visible('panel-paths')) return; const box = $('#panel-paths .body'), d = MP.doc; box.innerHTML = ''; if (!d) return;
  const thumb = (p) => { const c = el('canvas', { width: 80, height: 60, class: 'thumb' }), x = c.getContext('2d'), k = Math.min(80 / d.width, 60 / d.height); x.fillStyle = '#fff'; x.fillRect(0, 0, 80, 60); x.scale(k, k); x.lineWidth = 2 / k; x.strokeStyle = '#2d8cff'; x.stroke(MP.pathToPath2D(p)); return c; };
  const add = (p, name, i) => {
    const r = el('div', { class: 'layer' + (d.path === p ? ' active' : '') }); r.append(thumb(p), el('span', { class: 'lname' }, esc(name)));
    if (i != null) { const del = el('button', { class: 'ibtn', title: 'Supprimer' }, MP.icon('trash', 14)); del.onclick = (e) => { e.stopPropagation(); d.paths.splice(i, 1); UI.refreshPaths(); }; r.appendChild(del); }
    r.onclick = () => { d.path = JSON.parse(JSON.stringify(p)); MP.setTool('pen'); MP.render(); UI.refreshPaths(); }; box.appendChild(r);
  };
  if (d.path && d.path.pts.length) add(d.path, 'Tracé de travail');
  (d.paths || []).forEach((p, i) => add(p.path, p.name, i));
  if (!d.path && !(d.paths || []).length) box.appendChild(el('p', { class: 'muted' }, 'Dessinez un tracé avec la Plume (P), la Plume libre ou la Plume de courbure.'));
  box.appendChild(row(btn('Enregistrer', () => { if (!d.path) return MP.toast('Aucun tracé de travail'); d.paths = d.paths || []; d.paths.push({ name: 'Tracé ' + (d.paths.length + 1), path: JSON.parse(JSON.stringify(d.path)) }); d.markDirty(); UI.refreshPaths(); }), btn('→ Sélection', () => MP.tools.pen.toSelection()), btn('Remplir', () => MP.tools.pen.paint('fill')), btn('Contour', () => MP.tools.pen.paint('stroke'))));
};

/* =================== Calques : filtre, verrous, fond, effets et filtres dynamiques =================== */
UI.layerFilter = { kind: 'all', q: '' };
UI.enhanceLayers = () => {
  const props = document.querySelector('.lprops');
  const fb = el('div', { class: 'lfilter' }, `<select id="lf-kind" title="Filtrer par type"><option value="all">Tous</option><option value="pixel">Pixels</option><option value="adjust">Réglages</option><option value="text">Texte</option><option value="smart">Objets dynamiques</option><option value="group">Groupes</option><option value="fx">Avec effets</option></select><input id="lf-q" placeholder="Rechercher un calque…">`);
  props.parentElement.insertBefore(fb, props);
  fb.querySelector('#lf-kind').onchange = (e) => { UI.layerFilter.kind = e.target.value; UI.refreshLayers(); };
  fb.querySelector('#lf-q').oninput = (e) => { UI.layerFilter.q = e.target.value.toLowerCase(); UI.refreshLayers(); };
  const lk = el('div', { class: 'llocks' }, `<span class="muted">Verrou :</span><button data-lk="lockAlpha" title="Verrouiller les pixels transparents (/)">▦</button><button data-lk="lockPixels" title="Verrouiller les pixels de l'image">🖌</button><button data-lk="lockPos" title="Verrouiller la position">✥</button><button data-lk="locked" title="Tout verrouiller">🔒</button><label class="opac">Remplissage <input type="range" id="layerFill" min="0" max="100"><input type="number" id="layerFillNum" min="0" max="100" class="num"></label>`);
  props.parentElement.insertBefore(lk, props.nextSibling);
  lk.querySelectorAll('[data-lk]').forEach((b) => (b.onclick = () => { const d = MP.doc; if (!d) return; const k = b.dataset.lk; d.history.record('Verrou', null); d.layer[k] = !d.layer[k]; MP.afterEdit(); }));
  const setFill = (v) => { const d = MP.doc; if (!d) return; burst('Opacité du fond'); d.layer.fill = MP.clamp(v, 0, 100) / 100; $('#layerFill').value = $('#layerFillNum').value = Math.round(d.layer.fill * 100); d.layer._v = (d.layer._v || 0) + 1; MP.render(); };
  $('#layerFill').addEventListener('input', (e) => setFill(+e.target.value)); $('#layerFillNum').addEventListener('change', (e) => setFill(+e.target.value));
  const old = document.querySelector('label.lock'); if (old) old.style.display = 'none';
  const rl = UI.refreshLayers;
  UI.refreshLayers = () => {
    rl(); const d = MP.doc; if (!d) return; const L = d.layer;
    lk.querySelectorAll('[data-lk]').forEach((b) => b.classList.toggle('on', !!L[b.dataset.lk]));
    $('#layerFill').value = $('#layerFillNum').value = Math.round((L.fill == null ? 1 : L.fill) * 100);
    const f = UI.layerFilter;
    document.querySelectorAll('#layerlist .layer[data-id]').forEach((r) => {
      const l = d.byId(+r.dataset.id); if (!l) return;
      const kind = l.smart ? 'smart' : l.kind, okKind = f.kind === 'all' || f.kind === kind || (f.kind === 'fx' && MP.fx.has(l)), okQ = !f.q || l.name.toLowerCase().includes(f.q);
      if (!(okKind && okQ)) { r.style.display = 'none'; return; }
      if (l.smart) { const nm = r.querySelector('.lname'); nm && nm.insertAdjacentHTML('afterbegin', '<i class="smbadge" title="Objet dynamique">⧉</i>'); }
      let after = r;
      const sub = (html, cls, on, act, dbl, ctx) => { const s = el('div', { class: 'subrow ' + cls + (on === false ? ' off' : '') }, html); s.style.paddingLeft = parseInt(r.style.paddingLeft || 6) + 46 + 'px'; if (act) s.querySelector('.se')?.addEventListener('click', (e) => { e.stopPropagation(); act(); }); if (dbl) s.addEventListener('dblclick', dbl); if (ctx) s.addEventListener('contextmenu', ctx); after.after(s); after = s; };
      if (MP.fx.has(l)) {
        sub('<span class="st">Effets</span>', 'fxhead', true, null, () => { d.active = d.layers.indexOf(l); UI.dialogs.layerStyle(); });
        for (const [k, n] of Object.entries(FX_NAMES)) if (l.fx[k] && (l.fx[k].on || l.fx[k]._shown)) { l.fx[k]._shown = true; sub(`<span class="se">${l.fx[k].on ? '👁' : '◌'}</span>${esc(n)}`, 'fxrow', l.fx[k].on, () => { d.history.record('Effet ' + n, null); l.fx[k].on = !l.fx[k].on; MP.afterEdit(); }, () => { d.active = d.layers.indexOf(l); UI.dialogs.layerStyle(); }); }
      }
      if (l.smart && l.smart.filters.length) {
        sub('<span class="st">Filtres dynamiques</span>', 'fxhead', true);
        l.smart.filters.forEach((fl, i) => { const sp = MP.smart.specOf(fl); sub(`<span class="se">${fl.on !== false ? '👁' : '◌'}</span>${esc(sp ? sp.title : fl.key)}`, 'fxrow', fl.on !== false, () => MP.smart.toggleFilter(l, i), () => { d.active = d.layers.indexOf(l); MP.smart.editFilter(l, i); }, (e) => { e.preventDefault(); e.stopPropagation(); UI.ctxMenu(e.clientX, e.clientY, [{ label: 'Modifier le filtre…', act: () => MP.smart.editFilter(l, i) }, { label: fl.on !== false ? 'Désactiver' : 'Activer', act: () => MP.smart.toggleFilter(l, i) }, { label: 'Supprimer le filtre', act: () => MP.smart.removeFilter(l, i) }]); }); });
      }
    });
    if (visible('panel-props')) UI.refreshProps(); if (visible('panel-channels')) UI.refreshChannels(); if (visible('panel-paths')) UI.refreshPaths(); if (visible('panel-char')) UI.refreshChar();
  };
};

/* =================== Historique : instantanés =================== */
{
  const rh = UI.refreshHistory;
  UI.refreshHistory = () => {
    rh(); const box = $('#historylist'), d = MP.doc; if (!box || !d) return;
    const top = el('div', { class: 'snaps' }); const b = el('div', { class: 'hitem hsnap' }, '📷 Nouvel instantané'); b.onclick = () => MP.snapshots.take(); top.appendChild(b);
    (d.snaps || []).forEach((s, i) => { const r = el('div', { class: 'hitem hsnapi', title: 'Revenir à cet instantané' }, '🖼 ' + esc(s.name)); r.onclick = () => MP.snapshots.go(i); top.appendChild(r); });
    box.insertBefore(top, box.firstChild);
  };
}

/* =================== Barre de tâches contextuelle =================== */
UI.ctxbar = {
  init() { this.el = el('div', { id: 'ctxbar' }); $('#viewport').appendChild(this.el); setInterval(() => this.check(), 350); },
  sig() { const d = MP.doc; return d ? [d.id, d.layer && d.layer.id, d.layer && d.layer.kind, d.layer && !!d.layer.smart, !!d.selection, MP.tool && MP.tool.id, d.quickMask, d.editMask, MP.prefs.ctxbar].join('|') : 'none' + MP.prefs.ctxbar; },
  check() { const s = this.sig(); if (s !== this.last) { this.last = s; this.render(); if (visible('panel-props')) UI.refreshProps(); } },
  render() {
    const b = this.el, d = MP.doc; b.innerHTML = '';
    if (!d || MP.prefs.ctxbar === false || document.querySelector('.liq')) { b.style.display = 'none'; return; }
    b.style.display = 'flex';
    const B = (label, fn, title, cls = '') => { const x = el('button', { class: 'cb ' + cls, title: title || '' }, label); x.onclick = (e) => { e.preventDefault(); fn(e); }; b.appendChild(x); return x; };
    const sep = () => b.appendChild(el('span', { class: 'cbsep' }));
    const l = d.layer;
    if (MP.tool === MP.tools.transform) { B('✔ Valider', () => MP.tools.transform.commit(), 'Entrée', 'pri'); B('✖ Annuler', () => MP.tools.transform.abort(), 'Échap'); sep(); B('Perspective', () => MP.tools.transform.toggleDistort()); B('Déformation', () => MP.tools.transform.toggleWarp()); B('⇋', () => { MP.tools.transform.st.sx *= -1; MP.render(); }, 'Symétrie horizontale'); }
    else if (d.quickMask) { B('Quitter le masque rapide (Q)', () => MP.toggleQuickMask(), '', 'pri'); }
    else if (d.selection) {
      const inp = el('input', { class: 'cbin', placeholder: 'Décrivez le contenu à générer (facultatif)…' }); inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') MP.ai.generativeFill(inp.value); }); b.appendChild(inp);
      B('✨ Générer', () => MP.ai.generativeFill(inp.value), 'Remplissage génératif dans la sélection', 'pri'); sep();
      B('Masque', () => MP.layerOps.addMask(true), 'Créer un masque d\'après la sélection'); B('Inverser', () => UI.selCmd('Intervertir', (dd) => MP.sel.invert(dd))); B('Affiner', () => MP.cmd.selectAndMask(), 'Sélectionner et masquer'); B('Remplir', () => UI.dialogs.fill()); B('Copier', () => UI.layerViaCopy(), 'Calque par copier'); B('✕', () => UI.selCmd('Désélectionner', (dd) => MP.sel.none(dd)), 'Désélectionner');
    } else if (l.text) { B('Modifier le texte', () => UI.textDialog(l, false), '', 'pri'); B('A−', () => { burst('Taille du texte'); l.text.size = Math.max(4, Math.round(l.text.size * 0.9)); MP.renderText(l); MP.render(); }); B('A+', () => { burst('Taille du texte'); l.text.size = Math.round(l.text.size * 1.1); MP.renderText(l); MP.render(); }); B('Caractère', () => UI.showPanel('panel-char')); B('Style…', () => UI.dialogs.layerStyle()); B('Transformer', () => MP.startTransform()); }
    else if (l.adjust) { B('Modifier le réglage', () => UI.showPanel('panel-props'), '', 'pri'); B('Réinitialiser', () => { d.history.record('Réinitialiser', null); l.adjust.values = JSON.parse(JSON.stringify(MP.ADJUST[l.adjust.key].values || {})); MP.afterEdit(); }); B('Peindre le masque', () => { d.editMask = true; MP.setTool('brush'); MP.ui.refreshLayers(); }); }
    else if (l.isGroup) { B('Fusionner le groupe', () => MP.layerOps.mergeGroup()); B('Dissocier', () => MP.layerOps.ungroup()); }
    else {
      B('✨ Sélectionner le sujet', () => MP.ai.selectSubject(), '', 'pri'); B('✨ Supprimer l\'arrière-plan', () => MP.ai.removeBackground()); sep();
      B('Transformer', () => MP.startTransform()); const r = B('Réglage ▾', () => UI.popupMenu(r, MP.ADJ_LAYER_KEYS.map((k) => ({ label: MP.ADJUST[k].title, act: () => MP.layerOps.addAdjust(k) }))), 'Ajouter un calque de réglage');
      B('Style…', () => UI.dialogs.layerStyle()); if (!l.smart) B('Objet dynamique', () => MP.smart.convert(), 'Convertir en objet dynamique (redimensionnement sans perte)');
    }
    const more = B('⋯', (e) => { const r = more.getBoundingClientRect(); UI.canvasMenu(r.left, r.top - 380 > 0 ? r.top - 380 : r.bottom); }, 'Plus de commandes');
    B('×', () => { MP.prefs.ctxbar = false; MP.savePrefs(); this.render(); MP.toast('Barre contextuelle masquée — Fenêtre > Barre de tâches contextuelle pour la rétablir'); }, 'Masquer la barre', 'x');
  },
};

/* =================== Écran d'accueil =================== */
UI.buildHome = () => {
  const w = $('#welcome');
  w.innerHTML = `<div class="home"><aside class="home-nav"><div class="logo big">M</div><button class="btn primary" id="h-new">Nouveau fichier</button><button class="btn" id="h-open">Ouvrir…</button><button class="btn" id="h-clip">Depuis le presse-papiers</button><button class="btn" id="h-gen">✨ Générer une image</button><div class="muted" style="margin-top:auto">Ctrl+F : rechercher une commande</div></aside>
  <main class="home-main"><h1>Bienvenue dans Multipify <b>Photo</b></h1><p class="muted">Retouchez, composez, créez — ou partez d'un modèle prêt à l'emploi.</p>
  <h3>Démarrage rapide</h3><div class="h-grid" id="h-presets"></div><h3>Modèles</h3><div class="h-grid" id="h-templates"></div><div id="h-rec"></div>
  <p class="muted">Astuce : glissez-déposez vos images ici pour les ouvrir.</p></main></div>`;
  $('#h-new').onclick = () => UI.dialogs.newDoc(); $('#h-open').onclick = () => MP.io.open(); $('#h-clip').onclick = () => MP.cmd.newFromClipboard(); $('#h-gen').onclick = () => UI.dialogs.genImage();
  const P = [['Photo 3:2', 3000, 2000], ['A4 300 dpi', 2480, 3508], ['Full HD', 1920, 1080], ['Instagram', 1080, 1080], ['Story', 1080, 1920], ['YouTube', 1280, 720], ['Produit', 2000, 2000]];
  const hp = $('#h-presets');
  P.forEach(([n, ww, hh]) => { const k = 54 / Math.max(ww, hh), c = el('div', { class: 'hcard' }, `<div class="hshape" style="width:${ww * k}px;height:${hh * k}px"></div><b>${n}</b><small>${ww} × ${hh}</small>`); c.onclick = () => MP.newDocument(ww, hh, n, '#ffffff'); hp.appendChild(c); });
  const ht = $('#h-templates');
  MP.TEMPLATES.forEach((t) => {
    const c = el('div', { class: 'hcard tpl' }), cv = el('canvas', { width: 160, height: 110 }); c.append(cv, el('b', {}, esc(t.name)), el('small', {}, `${t.w} × ${t.h}`)); c.onclick = () => MP.buildTemplate(t); ht.appendChild(c);
    setTimeout(() => { try { const d = MP.buildTemplate(t, false), x = cv.getContext('2d'), k = Math.min(160 / d.width, 110 / d.height); x.fillStyle = '#1b1b1d'; x.fillRect(0, 0, 160, 110); x.drawImage(d.composite(null, { noLive: true }), (160 - d.width * k) / 2, (110 - d.height * k) / 2, d.width * k, d.height * k); } catch (e) { console.warn(e); } }, 200);
  });
  const rec = MP.io.recent(); let thumbs = {}; try { thumbs = JSON.parse(localStorage.getItem('mp.thumbs') || '{}'); } catch (_) { /* */ }
  if (rec.length && !MP.native.browser) {
    const box = $('#h-rec'); box.innerHTML = '<h3>Récents</h3>'; const g = el('div', { class: 'h-grid' });
    rec.slice(0, 8).forEach((p) => { const c = el('div', { class: 'hcard tpl', title: p }, `${thumbs[p] ? `<img src="${thumbs[p]}">` : '<div class="hshape" style="width:60px;height:44px"></div>'}<b>${esc(p.split(/[\\/]/).pop())}</b>`); c.onclick = () => MP.io.openRecent(p); g.appendChild(c); });
    box.appendChild(g);
  }
};
{
  const ar = MP.io.addRecent.bind(MP.io);
  MP.io.addRecent = (path) => { ar(path); if (!path || !MP.doc) return; setTimeout(() => { try { const d = MP.doc, k = Math.min(160 / d.width, 110 / d.height), c = MP.createCanvas(d.width * k, d.height * k); c.getContext('2d').drawImage(d.composite(null, { noLive: true }), 0, 0, c.width, c.height); const t = JSON.parse(localStorage.getItem('mp.thumbs') || '{}'); t[path] = c.toDataURL('image/jpeg', 0.7); const keys = Object.keys(t); if (keys.length > 20) delete t[keys[0]]; localStorage.setItem('mp.thumbs', JSON.stringify(t)); } catch (_) { /* */ } }, 300); };
}

/* =================== Menus v5 =================== */
{
  const menus0 = UI.menus, find = (items, start) => items.findIndex((x) => x && x !== '-' && (typeof x.label === 'function' ? x.label() : x.label).startsWith(start));
  const ALL = [['panel-props', 'Propriétés'], ['panel-adjust', 'Réglages'], ['panel-layers', 'Calques'], ['panel-channels', 'Couches'], ['panel-paths', 'Tracés'], ['panel-history', 'Historique'], ['panel-actions', 'Actions'], ['panel-brushes', 'Pinceaux'], ['panel-char', 'Caractère'], ['panel-color', 'Couleur'], ['panel-swatches', 'Nuancier'], ['panel-gradients', 'Dégradés'], ['panel-patterns', 'Motifs'], ['panel-styles', 'Styles'], ['panel-nav', 'Navigation'], ['panel-info', 'Info'], ['panel-histo', 'Histogramme']];
  UI.menus = () => {
    const m = menus0(), M = (l) => m.find((x) => x.label === l).items;
    const fi = M('Fichier'); fi.splice(1, 0, { label: 'Nouveau à partir d\'un modèle', sub: () => MP.TEMPLATES.map((t) => ({ label: t.name, act: () => MP.buildTemplate(t) })) });
    const ed = M('Édition'); ed.splice(find(ed, 'Couper'), 0, { label: 'Nouvel instantané', act: need(() => MP.snapshots.take()) });
    const ca = M('Calque'); ca.splice(find(ca, 'Nouveau calque de réglage') + 1, 0, { label: 'Préréglages de réglage', sub: () => MP.PRESETS.adjust.map((p) => ({ label: p.cat + ' — ' + p.name, act: need(() => MP.applyAdjustPreset(p)) })) }, { label: 'Objets dynamiques', sub: () => [{ label: 'Convertir en objet dynamique', act: need(() => MP.smart.convert()) }, { label: 'Remplacer le contenu…', act: need(() => MP.smart.replace()) }, { label: 'Pixelliser l\'objet dynamique', act: need(() => MP.smart.rasterize()) }] });
    const se = M('Sélection'); se.push('-', { label: 'Enregistrer la sélection (couche alpha)', act: need(() => MP.channels.save()) }, { label: 'Récupérer la sélection', sub: () => ((MP.doc && MP.doc.channels) || []).length ? MP.doc.channels.map((c, i) => ({ label: c.name, act: () => MP.channels.load(i) })) : [{ label: '(aucune couche alpha)', disabled: true }] });
    const af = M('Affichage'); af.push('-', { label: 'Couches', sub: () => [[null, 'RVB'], ['r', 'Rouge'], ['g', 'Vert'], ['b', 'Bleu']].map(([c, n]) => ({ label: ((MP.viewChannel || null) === c ? '✓ ' : '') + n, act: () => { MP.viewChannel = c; if (MP.doc) MP.doc._chKey = null; MP.renderView(); UI.refreshChannels(); } })) });
    const fe = M('Fenêtre'), keep = fe.filter((x) => x && x !== '-' && /Rechercher|Thème|Réinitialiser/.test(typeof x.label === 'function' ? x.label() : x.label));
    fe.splice(0, fe.length, keep[0], '-', ...ALL.map(([id, n]) => ({ label: () => (visible(id) ? '✓ ' : '') + n, act: () => UI.showPanel(id) })), '-', { label: () => (MP.prefs.ctxbar !== false ? '✓ ' : '') + 'Barre de tâches contextuelle', act: () => { MP.prefs.ctxbar = MP.prefs.ctxbar === false; MP.savePrefs(); UI.ctxbar.render(); } }, ...keep.slice(1));
    return m;
  };
  // menu contextuel des calques : objets dynamiques
  const lm = UI.layerMenu;
  UI.layerMenu = (x, y, l) => {
    const ctx = UI.ctxMenu;
    UI.ctxMenu = (xx, yy, items) => {
      UI.ctxMenu = ctx;
      const i = items.findIndex((it) => it && it !== '-' && it.label === 'Dupliquer le calque');
      const add = l.isGroup || l.adjust ? [] : l.smart ? [{ label: 'Remplacer le contenu…', act: () => MP.smart.replace() }, { label: 'Pixelliser l\'objet dynamique', act: () => MP.smart.rasterize() }] : [{ label: 'Convertir en objet dynamique', act: () => MP.smart.convert() }];
      items.splice(i, 0, ...add, '-');
      ctx(xx, yy, items);
    };
    lm(x, y, l);
  };
}

/* =================== Initialisation v5 =================== */
MP.v5init = () => {
  UI.buildDock(); UI.enhanceLayers(); UI.buildHome(); UI.ctxbar.init();
  const rt = UI.refreshTool; UI.refreshTool = () => { rt(); if (visible('panel-brushes')) UI.syncBrushPanel(); };
  document.addEventListener('keydown', (e) => {
    if (UI.dialogOpen || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && /^Digit[2-5]$/.test(e.code)) { e.preventDefault(); MP.viewChannel = { 2: null, 3: 'r', 4: 'g', 5: 'b' }[e.code.slice(5)]; if (MP.doc) MP.doc._chKey = null; MP.renderView(); UI.refreshChannels(); }
  }, true);
  UI.buildMenus(); UI.refreshAll();
};
