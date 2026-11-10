'use strict';
/* v12 (2/2) — Texte circulaire, noms de calques par IA, épreuve daltonisme, contrôle d'accessibilité (contraste WCAG),
   comparaison avant / après, teinte/saturation : inversion rapide. */

/* =================== Texte circulaire =================== */
MP.circleText = {
  points(cx, cy, r, mode) { const P = [], N = 240; let a0, a1; if (mode === 'bottom') { a0 = Math.PI; a1 = 0; } else if (mode === 'top') { a0 = Math.PI; a1 = Math.PI * 2; } else { a0 = Math.PI / 2; a1 = Math.PI / 2 + Math.PI * 2; } for (let i = 0; i <= N; i++) { const a = a0 + ((a1 - a0) * i) / N; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return P; },
  create(d, o) {
    const r = Math.round((Math.min(d.width, d.height) * o.diam) / 200), cx = Math.round(d.width / 2), cy = Math.round(d.height / 2);
    d.history.record('Texte circulaire', null); const l = d.addLayer(MP.i18n && MP.i18n.lang !== 'fr' ? MP.i18n.t('Texte circulaire') : 'Texte circulaire'); l.parent = null;
    l.text = { x: cx - r, y: cy - r, content: o.text, font: o.font, size: o.size, bold: !!o.bold, italic: false, underline: false, color: o.color, align: 'center', lineHeight: 1.15, spacing: o.spacing || 0, stroke: false, strokeColor: '#000000', strokeWidth: 2, shadow: false };
    l.text.pathPts = this.points(cx, cy, r, o.mode); l.text.arc = 0; l.text.vertical = false; l.text.circle = { mode: o.mode, r, cx, cy };
    MP.renderText(l); d.active = d.layers.indexOf(l); MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll(); return l;
  },
  dialog() {
    const d = MP.doc; if (!d) return; const o = MP.tools && MP.tools.text && MP.tools.text.opts ? MP.tools.text.opts : {};
    const v = { text: 'MULTIPIFY • PHOTO • ', mode: 'top', diam: 60, size: Math.max(12, Math.round(Math.min(d.width, d.height) / 14)), font: o.font || 'Arial', color: MP.colors ? MP.colors.fg : '#000000', bold: true, spacing: 2 };
    MP.ui.dialog({ title: 'Texte circulaire', width: 440, okLabel: 'Créer', values: v, fields: [{ k: 'text', label: 'Texte', type: 'text' }, { k: 'mode', label: 'Forme', type: 'select', options: [['top', 'Arc en haut (demi-cercle)'], ['bottom', 'Arc en bas (demi-cercle)'], ['full', 'Cercle complet']] }, { k: 'diam', label: 'Diamètre', type: 'range', min: 10, max: 100, unit: '%' }, { k: 'size', label: 'Taille du texte (px)', type: 'number', min: 4, max: 1000 }, { k: 'font', label: 'Police', type: 'text' }, { k: 'color', label: 'Couleur', type: 'color' }, { k: 'bold', label: 'Gras', type: 'check' }, { k: 'spacing', label: 'Espacement des lettres', type: 'range', min: -5, max: 60 }, { type: 'info', html: '<p class="muted">Le texte reste modifiable (Texte › Panneau Caractère) et se recentre automatiquement sur l\'arc quand vous le changez.</p>' }],
      onOk: (x) => { if (!x.text.trim()) return false; this.create(d, x); } });
  },
};

/* =================== Noms de calques par IA =================== */
MP.ai.nameLayers = () => {
  const d = MP.doc; if (!d) return;
  const generic = /^(Calque|Layer|Ebene|Capa|Livello|Camada|Laag|Warstwa|Слой|图层|レイヤー|Copie|Copy|Groupe|Group)(\s.*)?$/;
  const L = d.layers.filter((l) => !l.adjust && !l.text && d.layers.indexOf(l) > 0 && (generic.test(l.name) || /\d+$/.test(l.name))).slice(0, 24); if (!L.length) { MP.toast('Tous les calques ont déjà un nom parlant'); return; }
  return MP.ai.run('Noms des calques', async () => {
    const T = 220, cols = Math.min(4, L.length), rows = Math.ceil(L.length / cols), sheet = MP.createCanvas(cols * T, rows * T), x = sheet.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, sheet.width, sheet.height);
    L.forEach((l, i) => { const cx = (i % cols) * T, cy = Math.floor(i / cols) * T, src = l.isGroup ? d.composite(null, { noLive: true }) : MP.cloneCanvas(d.layerStatic(l)), b = MP.alphaBounds(src, 8) || { x: 0, y: 0, w: src.width, h: src.height }, k = Math.min((T - 30) / b.w, (T - 30) / b.h); x.save(); x.fillStyle = (i % 2) ? '#eef0f4' : '#f7f7f7'; x.fillRect(cx, cy, T, T); x.drawImage(src, b.x, b.y, b.w, b.h, cx + (T - b.w * k) / 2, cy + 24 + (T - 30 - b.h * k) / 2, b.w * k, b.h * k); x.fillStyle = '#d00'; x.font = 'bold 18px Arial'; x.fillText(String(i + 1), cx + 6, cy + 20); x.restore(); });
    const lang = (MP.i18n && MP.i18n.lang) || 'fr', names = { fr: 'French', en: 'English', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', ru: 'Russian', zh: 'Chinese', ja: 'Japanese' };
    const r = await MP.ai.chat({ system: `You name Photoshop layers. The image is a contact sheet: each numbered tile shows the content of one layer. Give each layer a short descriptive name (1-4 words, ${names[lang]}). Answer only JSON {"names": {"1": "...", "2": "..."}}.`, user: `There are ${L.length} tiles.`, image: sheet });
    d.history.record('Noms des calques (IA)', null); let n = 0; L.forEach((l, i) => { const nm = r.names && r.names[String(i + 1)]; if (nm && typeof nm === 'string') { l.name = nm.slice(0, 60); n++; } });
    MP.ui.refreshLayers && MP.ui.refreshLayers(); MP.toast(n + ' calque(s) renommé(s)'); return n;
  });
};

/* =================== Épreuve daltonisme + comparaison avant / après =================== */
{
  const L = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; L[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
  const S = (v) => { v = v <= 0 ? 0 : v >= 1 ? 1 : v; return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255); };
  MP.CVD = { protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998], deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881], tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039], achroma: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722] };
  MP.simulateCVD = (src, kind) => { const M = MP.CVD[kind]; if (!M) return src; const w = src.width, h = src.height, o = MP.createCanvas(w, h), x = o.getContext('2d'); x.drawImage(src, 0, 0); const id = x.getImageData(0, 0, w, h), a = id.data; for (let i = 0; i < a.length; i += 4) { const r = L[a[i]], g = L[a[i + 1]], b = L[a[i + 2]]; a[i] = S(M[0] * r + M[1] * g + M[2] * b); a[i + 1] = S(M[3] * r + M[4] * g + M[5] * b); a[i + 2] = S(M[6] * r + M[7] * g + M[8] * b); } x.putImageData(id, 0, 0); return o; };
  MP.compare = { on: false, pos: 0.5 };
  let cache = null;
  MP.viewPost = (d, comp) => {
    if (!MP.viewSim && !(MP.compare.on && d._before)) return comp;
    const key = d.id + ':' + d.rev + ':' + MP.viewSim + ':' + MP.compare.on + ':' + MP.compare.pos;
    if (cache && cache.key === key) return cache.c;
    let c = MP.viewSim ? MP.simulateCVD(comp, MP.viewSim) : comp;
    if (MP.compare.on && d._before && d._before.width === d.width && d._before.height === d.height) { const o = MP.createCanvas(d.width, d.height), x = o.getContext('2d'), sx = Math.round(d.width * MP.compare.pos); x.drawImage(c, 0, 0); x.save(); x.beginPath(); x.rect(0, 0, sx, d.height); x.clip(); x.clearRect(0, 0, sx, d.height); x.drawImage(MP.viewSim ? MP.simulateCVD(d._before, MP.viewSim) : d._before, 0, 0); x.restore(); const lw = Math.max(1, Math.round(Math.max(d.width, d.height) / 600)); x.fillStyle = '#ffffff'; x.fillRect(sx - lw, 0, lw * 2, d.height); const fs = Math.max(12, Math.round(Math.min(d.width, d.height) / 30)); x.font = `bold ${fs}px Arial`; x.textBaseline = 'top'; const tag = (t, px) => { const w = x.measureText(t).width + fs; x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px, fs * 0.5, w, fs * 1.5); x.fillStyle = '#fff'; x.fillText(t, px + fs / 2, fs * 0.75); }; const tr = (t) => (MP.i18n ? MP.i18n.t(t) : t); tag(tr('Avant'), Math.max(fs * 0.5, sx - x.measureText(tr('Avant')).width - fs * 2)); tag(tr('Après'), sx + fs * 0.5); c = o; }
    cache = { key, c }; return c;
  };
  // état « avant » : capturé juste avant la première modification du document
  const proto = Object.getPrototypeOf(new MP.Doc(1, 1, 'x').history), rec = proto.record;
  proto.record = function (label, ids) { const d = this.doc; if (d && !d._before && d.width * d.height <= 60e6) { try { d._before = MP.cloneCanvas(d.composite(null, { noLive: true })); } catch (_) { /* */ } } return rec.call(this, label, ids); };
  const crop = MP.cropDoc; MP.cropDoc = (...a) => { const d = MP.doc; crop(...a); if (d) d._before = null; };
  const rs = MP.resizeImage; MP.resizeImage = (...a) => { const d = MP.doc; rs(...a); if (d && d._before) { const b = MP.createCanvas(d.width, d.height), bx = b.getContext('2d'); bx.imageSmoothingQuality = 'high'; bx.drawImage(d._before, 0, 0, d.width, d.height); d._before = b; } };
  MP.compareToggle = () => { const d = MP.doc; if (!d) return; MP.compare.on = !MP.compare.on; if (MP.compare.on && !d._before) MP.toast('Aucune modification à comparer pour l\'instant'); let s = document.getElementById('cmp-slider'); if (MP.compare.on) { if (!s) { s = el('div', { id: 'cmp-slider' }, '<span>◀ ▶</span><input type="range" min="0" max="100" value="50">'); document.getElementById('viewport').appendChild(s); s.querySelector('input').addEventListener('input', (e) => { MP.compare.pos = +e.target.value / 100; MP.renderView(); }); } s.style.display = 'flex'; } else if (s) s.style.display = 'none'; MP.renderView(); };
  MP.setSim = (k) => { MP.viewSim = MP.viewSim === k ? null : k; MP.renderView(); MP.ui.refreshStatus && MP.ui.refreshStatus(); };
}

/* =================== Contrôle d'accessibilité des textes (WCAG) =================== */
MP.a11y = {
  lum(r, g, b) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); },
  ratio(l1, l2) { const a = Math.max(l1, l2), b = Math.min(l1, l2); return (a + 0.05) / (b + 0.05); },
  check(d) {
    const res = [];
    for (const l of d.layers) {
      if (!l.text || !l.visible || !l.text._b) continue;
      const vis = l.visible; l.visible = false; d.rev++; const bg = MP.cloneCanvas(d.composite(null, { noLive: true })); l.visible = vis; d.rev++;
      const b = l.text._b, x0 = MP.clamp(Math.round(b.x), 0, d.width - 1), y0 = MP.clamp(Math.round(b.y), 0, d.height - 1), w = MP.clamp(Math.round(b.w), 1, d.width - x0), h = MP.clamp(Math.round(b.h), 1, d.height - y0);
      const a = bg.getContext('2d').getImageData(x0, y0, w, h).data, tl = MP.hexToRgb(l.text.color || '#000000'), Lt = this.lum(tl.r, tl.g, tl.b); let worst = Infinity, sum = 0, n = 0;
      for (let i = 0; i < a.length; i += 4 * 3) { const al = a[i + 3] / 255, r = a[i] * al + 255 * (1 - al), g = a[i + 1] * al + 255 * (1 - al), bb = a[i + 2] * al + 255 * (1 - al), rr = this.ratio(Lt, this.lum(r, g, bb)); worst = Math.min(worst, rr); sum += rr; n++; }
      const avg = n ? sum / n : 21, big = l.text.size >= 24 || (l.text.bold && l.text.size >= 19), helped = l.text.stroke || l.text.shadow || (l.fx && (l.fx.stroke && l.fx.stroke.on || l.fx.shadow && l.fx.shadow.on));
      const need = big ? 3 : 4.5, needAAA = big ? 4.5 : 7, val = Math.min(avg, worst * 1.35);
      res.push({ layer: l, name: l.name, text: String(l.text.content).slice(0, 40), ratio: val, big, aa: val >= need, aaa: val >= needAAA, helped });
    }
    MP.render(); return res;
  },
  dialog() {
    const d = MP.doc; if (!d) return; const r = this.check(d);
    if (!r.length) { MP.toast('Aucun calque de texte à vérifier'); return; }
    const row = (x) => `<tr><td>${esc(x.text)}</td><td style="text-align:right">${x.ratio.toFixed(1)} : 1</td><td>${x.aa ? '✅' : '❌'}</td><td>${x.aaa ? '✅' : '—'}</td><td class="muted">${x.big ? 'grand' : 'normal'}${x.helped && !x.aa ? ' (contour/ombre : à vérifier à l\'œil)' : ''}</td></tr>`;
    MP.ui.dialog({ title: 'Accessibilité des textes (contraste WCAG 2.2)', width: 600, okLabel: 'Fermer', noCancel: true, fields: [{ type: 'info', html: `<table class="a11y"><tr><th>Texte</th><th>Contraste</th><th>AA</th><th>AAA</th><th>Taille</th></tr>${r.map(row).join('')}</table><p class="muted">AA : 4,5 : 1 pour le texte normal, 3 : 1 pour le grand texte (≥ 24 px ou ≥ 19 px gras). Le contraste est mesuré sur le fond réel situé sous chaque texte, en tenant compte des zones les moins contrastées.</p>` }] });
    return r;
  },
};

/* =================== Teinte/Saturation : inverser (rotation de 180°) =================== */
MP.invertHue = () => { const d = MP.doc; if (!d) return; const ed = UI.editAdjustLayer; UI.editAdjustLayer = () => {}; try { MP.layerOps.addAdjust('hueSat'); } finally { UI.editAdjustLayer = ed; } const l = d.layer; l.adjust.values.h = 180; l._v = (l._v || 0) + 1; d.editMask = false; MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll(); MP.toast('Teintes inversées (calque Teinte/Saturation à 180°)'); };

/* =================== Menus =================== */
{
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), M = (n) => (m.find((x) => x.label === n) || { items: [] }).items;
    const tx = M('Texte'); tx.splice(2, 0, { label: 'Texte circulaire (cercle, demi-cercle)…', act: need(() => MP.circleText.dialog()) }, { label: 'Vérifier l\'accessibilité des textes (contraste)…', act: need(() => MP.a11y.dialog()) });
    const ia = M('IA'), at = ia.findIndex((x) => x && x.label && /Traduire les textes/.test(x.label)); ia.splice(at >= 0 ? at + 1 : ia.length, 0, { label: '✨ Nommer les calques automatiquement', act: need(() => MP.ai.nameLayers()) });
    const af = M('Affichage'); af.push('-', { label: () => (MP.compare.on ? '✓ ' : '') + 'Avant / après (comparaison)', sc: 'Ctrl+Alt+B', act: need(() => MP.compareToggle()) }, { label: 'Épreuve daltonisme', sub: () => [['protan', 'Protanopie (rouge)'], ['deutan', 'Deutéranopie (vert)'], ['tritan', 'Tritanopie (bleu)'], ['achroma', 'Achromatopsie (aucune couleur)']].map(([k, n]) => ({ label: (MP.viewSim === k ? '✓ ' : '') + n, act: need(() => MP.setSim(k)) })) });
    const ca = M('Calque'), adj = ca.find((x) => x && x.label === 'Préréglages de réglage'); void adj;
    const im = M('Image'), rg = im.find((x) => x && x.label === 'Réglages'); if (rg && typeof rg.sub === 'function') { const s0 = rg.sub; rg.sub = () => [...s0(), '-', { label: 'Inverser les teintes (Teinte/Saturation 180°)', act: need(() => MP.invertHue()) }]; }
    return m;
  };
}
