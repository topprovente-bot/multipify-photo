'use strict';
/* v12 (1/2) — Production : studio photo produit e-commerce, détourage hors ligne (fond uni), filigrane,
   traitement par lots avancé (IA, détourage, studio, filigrane), collage / grille, générateur d'icônes et favicon. */

/* =================== Détourage hors ligne (fond uni / studio) =================== */
MP.localSubject = (src, o = {}) => {
  const W = src.width, H = src.height, k = Math.min(1, 700 / Math.max(W, H)), w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
  const t = MP.createCanvas(w, h), tx = t.getContext('2d'); tx.drawImage(src, 0, 0, w, h); const a = tx.getImageData(0, 0, w, h).data, n = w * h;
  // modèle du fond : pixels du bord (k-moyennes, 4 couleurs)
  const B = []; for (let x = 0; x < w; x++) { B.push(x, (h - 1) * w + x); } for (let y = 1; y < h - 1; y++) { B.push(y * w, y * w + w - 1); }
  const px = (i) => [a[i * 4], a[i * 4 + 1], a[i * 4 + 2]], dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  let C = [px(B[0]), px(B[Math.floor(B.length / 4)]), px(B[Math.floor(B.length / 2)]), px(B[Math.floor((3 * B.length) / 4)])];
  for (let it = 0; it < 8; it++) { const S = C.map(() => [0, 0, 0, 0]); for (const i of B) { const p = px(i); let bi = 0, bd = 1e9; C.forEach((q, j) => { const dd = dist(p, q); if (dd < bd) { bd = dd; bi = j; } }); S[bi][0] += p[0]; S[bi][1] += p[1]; S[bi][2] += p[2]; S[bi][3]++; } C = C.map((q, j) => (S[j][3] ? [S[j][0] / S[j][3], S[j][1] / S[j][3], S[j][2] / S[j][3]] : q)); }
  const bd = (i) => { const p = px(i); let m = 1e9; for (const q of C) m = Math.min(m, dist(p, q)); return m; };
  const bdist = B.map(bd).sort((x, y) => x - y), tol = (o.tol || 0) || MP.clamp(bdist[Math.floor(bdist.length * 0.9)] * 2.2 + 14, 18, 90);
  // remplissage depuis les bords : pixels proches du fond et connectés
  const bg = new Uint8Array(n), q = []; for (const i of B) if (bd(i) <= tol && !bg[i]) { bg[i] = 1; q.push(i); }
  while (q.length) { const i = q.pop(), x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !bg[j] && bd(j) <= tol) { bg[j] = 1; q.push(j); } }
  // îlots : ne garder que les composantes de premier plan significatives
  const lab = new Int32Array(n).fill(-1), sizes = []; for (let i = 0; i < n; i++) if (!bg[i] && lab[i] < 0) { let s = 0; const st = [i]; lab[i] = sizes.length; while (st.length) { const j = st.pop(); s++; const x = j % w, y = (j / w) | 0; for (const m of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (m >= 0 && !bg[m] && lab[m] < 0) { lab[m] = sizes.length; st.push(m); } } sizes.push(s); }
  const big = Math.max(0, ...sizes), keep = sizes.map((s) => s >= Math.max(20, big * 0.02));
  // trous intérieurs : fond non connecté au bord → reste du sujet (ex. intérieur d'une tasse : conservé)
  const m = MP.createCanvas(w, h), mx = m.getContext('2d'), id = mx.createImageData(w, h);
  for (let i = 0; i < n; i++) { const fg = !bg[i] && keep[lab[i]]; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = fg ? 255 : 0; }
  mx.putImageData(id, 0, 0);
  const out = MP.createCanvas(W, H), ox = out.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.filter = `blur(${Math.max(0.6, 0.7 / k)}px)`; ox.drawImage(m, 0, 0, W, H); ox.filter = 'none';
  // resserrer légèrement le bord adouci (évite le liseré de fond)
  const od = ox.getImageData(0, 0, W, H); for (let i = 3; i < od.data.length; i += 4) od.data[i] = MP.clamp((od.data[i] - 40) * 1.25, 0, 255); ox.putImageData(od, 0, 0);
  return out;
};
MP.localSubjectSelect = () => { const d = MP.doc; if (!d) return; const m = MP.localSubject(MP.cloneCanvas(d.composite(null, { noLive: true }))); d.history.record('Sujet (fond uni)', null); MP.sel.fromMask(d, m); MP.ui.refreshAll && MP.ui.refreshAll(); MP.render(); MP.toast('Sujet sélectionné (détourage hors ligne pour fonds unis — affinez avec Sélectionner et masquer)', 5000); };

/* =================== Studio photo produit (e-commerce) =================== */
MP.productStudio = {
  PRESETS: [['amazon', 'Amazon (2000 × 2000, fond blanc pur, produit 85 %)', 2000, 2000, 0.85], ['cdiscount', 'Cdiscount (1500 × 1500, fond blanc)', 1500, 1500, 0.8], ['fnac', 'Fnac / Darty (1500 × 1500)', 1500, 1500, 0.8], ['shopify', 'Shopify (2048 × 2048)', 2048, 2048, 0.8], ['woo', 'WooCommerce / PrestaShop (1200 × 1200)', 1200, 1200, 0.8], ['etsy', 'Etsy (2700 × 2025)', 2700, 2025, 0.75], ['ebay', 'eBay (1600 × 1600)', 1600, 1600, 0.85], ['insta', 'Instagram Shopping (1080 × 1350)', 1080, 1350, 0.75], ['custom', 'Taille personnalisée', 0, 0, 0.8]],
  /** découpe du produit : calque transparent, sélection, IA ou fond uni */
  async cutout(d, method = 'auto') {
    const l = d.layer, src = MP.cloneCanvas(d.composite(null, { noLive: true }));
    if (method === 'auto' || method === 'layer') { if (l && !l.adjust && !l.isGroup && !l.text) { const c = MP.cloneCanvas(d.layerStatic(l)), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let tr = 0; for (let i = 3; i < x.length; i += 4 * 7) if (x[i] < 250) tr++; if (tr > x.length / 4 / 7 * 0.03) return c; } if (method === 'layer') throw new Error('le calque actif n\'a pas de transparence'); }
    if ((method === 'auto' || method === 'sel') && d.selection) { const c = MP.cloneCanvas(src), x = c.getContext('2d'); x.globalCompositeOperation = 'destination-in'; x.drawImage(d.selection, 0, 0); return c; }
    if (method === 'ai' || (method === 'auto' && MP.ai.enabled() && MP.prefs.studioAI !== false)) { const m = await MP.ai.subjectAlpha(src), c = MP.cloneCanvas(src), x = c.getContext('2d'); x.globalCompositeOperation = 'destination-in'; x.drawImage(m, 0, 0); return c; }
    const m = MP.localSubject(src), c = MP.cloneCanvas(src), x = c.getContext('2d'); x.globalCompositeOperation = 'destination-in'; x.drawImage(m, 0, 0); return c;
  },
  /** construit un nouveau document studio à partir d'un détourage */
  build(cut, o, name = 'Produit') {
    const W = o.w, H = o.h, b = MP.alphaBounds(cut, 16); if (!b) throw new Error('aucun produit détecté');
    const fill = MP.clamp(o.fill || 0.85, 0.3, 0.98), k = Math.min((W * fill) / b.w, (H * fill) / b.h), pw = Math.round(b.w * k), ph = Math.round(b.h * k);
    const px = Math.round((W - pw) / 2), py = o.shadow === 'reflection' ? Math.round((H - ph) * 0.38) : Math.round((H - ph) / 2);
    const d = new MP.Doc(W, H, name.replace(/\.[^.]+$/, '') + '-studio.mpp'); d.dpi = 72;
    const bgL = d.addLayer('Fond', 0), bx = bgL.ctx;
    if (o.bg === 'gradient') { const g = bx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.75); g.addColorStop(0, '#ffffff'); g.addColorStop(1, o.color || '#e6e9ef'); bx.fillStyle = g; bx.fillRect(0, 0, W, H); }
    else if (o.bg !== 'transparent') { bx.fillStyle = o.bg === 'white' ? '#ffffff' : o.bg === 'gray' ? '#f2f2f2' : (o.color || '#ffffff'); bx.fillRect(0, 0, W, H); }
    const prod = MP.createCanvas(W, H), pc = prod.getContext('2d'); pc.imageSmoothingQuality = 'high'; pc.drawImage(cut, b.x, b.y, b.w, b.h, px, py, pw, ph);
    if (o.shadow && o.shadow !== 'none') {
      const sh = d.addLayer('Ombre'); sh.opacity = (o.shadowOpacity ?? 35) / 100; const sx = sh.ctx;
      if (o.shadow === 'contact') { const cy = py + ph, rx = pw * 0.48, ry = Math.max(4, ph * 0.035); sx.save(); sx.translate(W / 2, cy); sx.scale(1, ry / rx); const g = sx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.55, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = g; sx.beginPath(); sx.arc(0, 0, rx, 0, Math.PI * 2); sx.fill(); sx.restore(); }
      else if (o.shadow === 'drop') { const s = MP.createCanvas(W, H), x = s.getContext('2d'); x.drawImage(prod, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, W, H); sx.filter = `blur(${Math.max(2, Math.round(Math.min(pw, ph) * 0.03))}px)`; sx.drawImage(s, Math.round(pw * 0.02), Math.round(ph * 0.025)); sx.filter = 'none'; }
      else if (o.shadow === 'reflection') { sx.save(); sx.translate(0, (py + ph) * 2); sx.scale(1, -1); sx.drawImage(prod, 0, 0); sx.restore(); sx.globalCompositeOperation = 'destination-in'; const g = sx.createLinearGradient(0, py + ph, 0, py + ph + ph * 0.45); g.addColorStop(0, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = g; sx.fillRect(0, 0, W, H); sx.globalCompositeOperation = 'source-over'; sh.name = 'Reflet'; }
    }
    const pl = d.addLayer('Produit'); pl.canvas = prod;
    d.active = d.layers.indexOf(pl); return d;
  },
  dialog() {
    const d = MP.doc; if (!d) return;
    const v = { preset: MP.prefs.studioPreset || 'amazon', w: 2000, h: 2000, fill: 85, method: 'auto', bg: 'white', color: '#ffffff', shadow: 'contact', shadowOpacity: 35 };
    MP.ui.dialog({ title: 'Studio photo produit (e-commerce)', width: 520, okLabel: 'Créer la photo produit', values: v,
      fields: [{ type: 'info', html: '<p class="muted">Détoure le produit, le centre à la bonne taille sur un fond conforme aux places de marché et ajoute une ombre réaliste. Le résultat est un nouveau document à calques (fond, ombre, produit) entièrement modifiable.</p>' },
        { k: 'preset', label: 'Place de marché', type: 'select', options: this.PRESETS.map((p) => [p[0], p[1]]) }, { k: 'w', label: 'Largeur (taille personnalisée)', type: 'number', min: 100, max: 10000 }, { k: 'h', label: 'Hauteur (taille personnalisée)', type: 'number', min: 100, max: 10000 },
        { k: 'fill', label: 'Place occupée par le produit', type: 'range', min: 30, max: 98, unit: '%' },
        { k: 'method', label: 'Détourage', type: 'select', options: [['auto', 'Automatique (calque transparent, sélection, IA ou fond uni)'], ['ai', 'IA (crédits Multipify)'], ['local', 'Hors ligne — fond uni (gratuit)'], ['sel', 'Sélection active'], ['layer', 'Calque déjà détouré']] },
        { k: 'bg', label: 'Fond', type: 'select', options: [['white', 'Blanc pur #FFFFFF (Amazon)'], ['gray', 'Gris très clair'], ['gradient', 'Dégradé studio'], ['color', 'Couleur'], ['transparent', 'Transparent (PNG)']] }, { k: 'color', label: 'Couleur du fond / du dégradé', type: 'color' },
        { k: 'shadow', label: 'Ombre', type: 'select', options: [['contact', 'Ombre de contact (posé)'], ['drop', 'Ombre portée douce'], ['reflection', 'Reflet (surface brillante)'], ['none', 'Aucune (Amazon : image principale)']] }, { k: 'shadowOpacity', label: 'Intensité de l\'ombre', type: 'range', min: 5, max: 100 }],
      onOk: (o) => { MP.prefs.studioPreset = o.preset; MP.savePrefs(); setTimeout(() => this.run(o), 30); } });
  },
  resolve(o) { const p = this.PRESETS.find((x) => x[0] === o.preset) || this.PRESETS[0]; return { ...o, w: p[2] || +o.w || 2000, h: p[3] || +o.h || 2000, fill: (+o.fill || p[4] * 100) / 100 }; },
  async run(o) {
    const d = MP.doc; const r = this.resolve(o);
    const go = async () => { const cut = await this.cutout(d, o.method === 'local' ? 'local' : o.method); const nd = this.build(cut, r, d.name); MP.addDoc(nd); MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll(); MP.toast(`Photo produit ${r.w} × ${r.h} créée — calques Fond, Ombre et Produit modifiables`, 5000); return nd; };
    try { return (o.method === 'ai' || (o.method === 'auto' && MP.ai.enabled())) ? await MP.ai.run('Studio produit', go) : await MP.busy('Studio produit…', go); } catch (e) { MP.toast('Studio produit : ' + e.message, 6000); }
  },
};

/* =================== Filigrane =================== */
MP.watermark = {
  defaults() { return { kind: 'text', text: '© ' + (MP.prefs.userName || 'Multipify') + ' ' + new Date().getFullYear(), pos: 'br', size: 4, opacity: 45, color: '#ffffff', shadow: true, logo: null }; },
  apply(d, o) {
    const W = d.width, H = d.height, base = Math.min(W, H), fs = Math.max(8, Math.round((base * o.size) / 100)), m = Math.round(base * 0.03);
    d.history.record('Filigrane', null);
    const l = d.addLayer('Filigrane'); l.parent = null; l.opacity = o.opacity / 100; const c = l.ctx;
    let mark; if (o.kind === 'logo' && o.logo) { const lw = Math.round((base * o.size * 4) / 100), lh = Math.round(lw * o.logo.height / o.logo.width); mark = MP.createCanvas(lw, lh); const mx = mark.getContext('2d'); mx.imageSmoothingQuality = 'high'; mx.drawImage(o.logo, 0, 0, lw, lh); }
    else { const t = MP.createCanvas(4, 4).getContext('2d'); t.font = `600 ${fs}px Arial`; const tw = Math.ceil(t.measureText(o.text).width) + 8; mark = MP.createCanvas(tw, Math.ceil(fs * 1.4)); const mx = mark.getContext('2d'); mx.font = `600 ${fs}px Arial`; mx.textBaseline = 'middle'; if (o.shadow) { mx.shadowColor = 'rgba(0,0,0,.55)'; mx.shadowBlur = Math.max(2, fs / 8); mx.shadowOffsetY = Math.max(1, fs / 16); } mx.fillStyle = o.color; mx.fillText(o.text, 4, mark.height / 2); }
    if (o.pos === 'tile') { c.save(); c.translate(W / 2, H / 2); c.rotate(-Math.PI / 6); const sx = mark.width * 1.8, sy = mark.height * 3.2, R = Math.hypot(W, H); for (let y = -R; y < R; y += sy) for (let x = -R + ((Math.round(y / sy) % 2) * sx) / 2; x < R; x += sx) c.drawImage(mark, x, y); c.restore(); }
    else { const p = o.pos, x = /l$/.test(p) ? m : /r$/.test(p) ? W - mark.width - m : (W - mark.width) / 2, y = /^t/.test(p) ? m : /^b/.test(p) ? H - mark.height - m : (H - mark.height) / 2; c.drawImage(mark, Math.round(x), Math.round(y)); }
    MP.afterEdit(); return l;
  },
  fields(v) { return [{ k: 'kind', label: 'Type', type: 'select', options: [['text', 'Texte'], ['logo', 'Logo (image)']] }, { k: 'text', label: 'Texte', type: 'text' }, { type: 'button', label: 'Choisir un logo…', action: async () => { const f = (await MP.native.openFiles({ multi: false, accept: 'image/*' }))[0]; if (f) { v.logo = await MP.io.loadImage(f.data, f.name); v.kind = 'logo'; MP.toast('Logo chargé : ' + f.name); } } },
    { k: 'pos', label: 'Position', type: 'select', options: [['br', 'En bas à droite'], ['bl', 'En bas à gauche'], ['tr', 'En haut à droite'], ['tl', 'En haut à gauche'], ['c', 'Au centre'], ['bc', 'En bas au centre'], ['tile', 'Mosaïque en diagonale (anti-copie)']] }, { k: 'size', label: 'Taille', type: 'range', min: 1, max: 20, unit: '%' }, { k: 'opacity', label: 'Opacité', type: 'range', min: 5, max: 100, unit: '%' }, { k: 'color', label: 'Couleur du texte', type: 'color' }, { k: 'shadow', label: 'Ombre (lisible sur tous les fonds)', type: 'check' }]; },
  dialog() { const d = MP.doc; if (!d) return; const v = { ...this.defaults(), ...(MP.prefs.watermark || {}), logo: MP.watermark._logo || null }; MP.ui.dialog({ title: 'Ajouter un filigrane', width: 460, okLabel: 'Ajouter', values: v, fields: this.fields(v), onOk: (o) => { MP.watermark._logo = o.logo; const { logo, ...rest } = o; void logo; MP.prefs.watermark = rest; MP.savePrefs(); this.apply(d, o); MP.ui.refreshAll && MP.ui.refreshAll(); } }); },
};

/* =================== Traitement par lots avancé =================== */
MP.batchPro = {
  dialog() {
    const v = { enhance: false, removeBg: false, removeMode: 'local', studio: false, preset: 'amazon', shadow: 'contact', bgc: 'white', wm: false, ...this.wmDefaults(), resize: false, maxW: 2000, maxH: 2000, prompt: '', format: 'jpeg', quality: 90, suffix: '' };
    MP.ui.dialog({ title: 'Traitement par lots avancé', width: 560, okLabel: 'Choisir les fichiers et lancer', values: v,
      fields: [{ type: 'info', html: '<p class="muted">Chaque fichier est ouvert, traité dans l\'ordre ci-dessous, exporté puis refermé. Idéal pour un catalogue produit complet.</p>' },
        { k: 'prompt', label: '✨ Consigne pour l\'assistant IA appliquée à chaque image (facultatif)', type: 'textarea', rows: 2 }, { k: 'enhance', label: '✨ Retouche automatique (IA)', type: 'check' },
        { k: 'removeBg', label: 'Supprimer l\'arrière-plan', type: 'check' }, { k: 'removeMode', label: 'Méthode', type: 'select', options: [['local', 'Hors ligne — fond uni (gratuit)'], ['ai', 'IA (crédits Multipify)']] },
        { k: 'studio', label: 'Studio photo produit', type: 'check' }, { k: 'preset', label: 'Place de marché', type: 'select', options: MP.productStudio.PRESETS.filter((p) => p[0] !== 'custom').map((p) => [p[0], p[1]]) }, { k: 'shadow', label: 'Ombre', type: 'select', options: [['contact', 'Contact'], ['drop', 'Portée douce'], ['reflection', 'Reflet'], ['none', 'Aucune']] }, { k: 'bgc', label: 'Fond', type: 'select', options: [['white', 'Blanc pur'], ['gray', 'Gris clair'], ['gradient', 'Dégradé studio'], ['transparent', 'Transparent']] },
        { k: 'wm', label: 'Filigrane (réglages du dernier filigrane utilisé)', type: 'check' },
        { k: 'resize', label: 'Limiter la taille', type: 'check' }, { k: 'maxW', label: 'Largeur max.', type: 'number', min: 16, max: 20000 }, { k: 'maxH', label: 'Hauteur max.', type: 'number', min: 16, max: 20000 },
        { k: 'format', label: 'Format', type: 'select', options: [['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP'], ['tiff', 'TIFF']] }, { k: 'quality', label: 'Qualité', type: 'range', min: 40, max: 100 }, { k: 'suffix', label: 'Suffixe du nom', type: 'text' }],
      onOk: (o) => { setTimeout(() => this.run(o), 30); } });
  },
  wmDefaults() { return {}; },
  async process(d, o) {
    if (o.prompt && o.prompt.trim() && MP.ai.enabled()) { const r = await MP.assistant.ask(o.prompt.trim(), { image: true }); await MP.assistant.apply(r.actions); }
    if (o.enhance && MP.ai.enabled()) { const r = await MP.assistant.ask('Correct and enhance this photo naturally. Use a single "cameraRaw" adjustment.', { image: true, only: ['adjust'] }); await MP.assistant.apply(r.actions); }
    let doc = d;
    if (o.studio) { const cut = await MP.productStudio.cutout(d, o.removeBg ? o.removeMode : 'auto'); const r = MP.productStudio.resolve({ preset: o.preset }); doc = MP.productStudio.build(cut, { ...r, bg: o.bgc, shadow: o.shadow, shadowOpacity: 35 }, d.name); MP.addDoc(doc); }
    else if (o.removeBg) { const cut = await MP.productStudio.cutout(d, o.removeMode === 'ai' ? 'ai' : 'local'); d.history.record('Supprimer l\'arrière-plan', null); const l = d.addLayer('Détouré'); l.canvas = cut; for (const x of d.layers) if (x !== l) x.visible = false; MP.afterEdit(); }
    if (o.wm) MP.watermark.apply(doc, { ...MP.watermark.defaults(), ...(MP.prefs.watermark || {}), logo: MP.watermark._logo || null });
    return doc;
  },
  async run(o) {
    const files = await MP.native.openFiles({ multi: true, accept: 'image/*,.psd,.mpp', filters: [{ name: 'Images', extensions: [...IMAGE_EXT, 'psd', 'mpp'] }] }); if (!files.length) return;
    let dir = null; if (MP.native.pickFolder) { MP.toast('Choisissez le dossier de destination'); dir = await MP.native.pickFolder(); if (!dir) return; }
    const out = [], log = []; let done = 0;
    const one = async (f, i) => {
      const bar = document.querySelector('#busy span'); if (bar) bar.textContent = `Lot : ${i + 1} / ${files.length} — ${f.name}`;
      const before = MP.docs.length; await MP.io.openFile(f); if (MP.docs.length === before) throw new Error('ouverture impossible');
      const d = MP.doc, doc = await this.process(d, o);
      const r = await MP.encodeDoc(doc, { format: o.format === 'png' && o.studio && o.bgc === 'transparent' ? 'png' : o.format, quality: o.quality, fitW: o.resize ? +o.maxW : 0, fitH: o.resize ? +o.maxH : 0, bg: o.format === 'jpeg' ? 'white' : null }), name = f.name.replace(/\.[^.]+$/, '') + (o.suffix || '') + '.' + r.ext;
      if (dir) await MP.native.writeFile(dir + (dir.includes('\\') ? '\\' : '/') + name, r.data); else out.push({ name, data: r.data });
      for (const x of new Set([doc, d])) { x.dirty = false; await MP.ui.closeDoc(x); }
      done++;
    };
    await MP.busy('Traitement par lots…', async () => { for (const [i, f] of files.entries()) { try { await one(f, i); } catch (e) { log.push(f.name + ' : ' + e.message); } } });
    if (out.length) await MP.outFiles(out, 'lot-multipify');
    MP.toast(`Lot terminé : ${done} / ${files.length} fichier(s)` + (log.length ? ' — échecs : ' + log.join(' ; ') : ''), 7000);
    return { done, log, out };
  },
};

/* =================== Collage / grille =================== */
MP.collage = {
  SIZES: [['1080x1080', 'Carré 1080 × 1080'], ['1080x1350', 'Portrait 1080 × 1350'], ['1080x1920', 'Story 1080 × 1920'], ['1920x1080', 'Paysage 1920 × 1080'], ['2480x3508', 'A4 portrait 300 ppp'], ['3508x2480', 'A4 paysage 300 ppp']],
  cells(n, W, H, layout, g) {
    const r = [], add = (x, y, w, h) => r.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    if (layout === 'hero' && n >= 3) { const hh = (H - 3 * g) * 0.62; add(g, g, W - 2 * g, hh); const m = n - 1, cw = (W - (m + 1) * g) / m; for (let i = 0; i < m; i++) add(g + i * (cw + g), 2 * g + hh, cw, H - 3 * g - hh); return r; }
    if (layout === 'row') { const cw = (W - (n + 1) * g) / n; for (let i = 0; i < n; i++) add(g + i * (cw + g), g, cw, H - 2 * g); return r; }
    if (layout === 'col') { const ch = (H - (n + 1) * g) / n; for (let i = 0; i < n; i++) add(g, g + i * (ch + g), W - 2 * g, ch); return r; }
    const cols = Math.ceil(Math.sqrt(n * W / H)), rows = Math.ceil(n / cols), ch = (H - (rows + 1) * g) / rows;
    for (let k = 0; k < n; k++) { const row = Math.floor(k / cols), inRow = row === rows - 1 ? n - row * cols : cols, cw = (W - (inRow + 1) * g) / inRow, col = k - row * cols; add(g + col * (cw + g), g + row * (ch + g), cw, ch); }
    return r;
  },
  fit(img, cell) { const fake = { width: img.width, height: img.height, composite: () => img, selection: null }, b = MP.smartCrop.best(fake, cell.w, cell.h); return b; },
  build(imgs, o) {
    const [W, H] = o.size.split('x').map(Number), g = Math.round(Math.min(W, H) * (o.gap / 1000)), cells = this.cells(imgs.length, W, H, o.layout, g);
    const d = new MP.Doc(W, H, 'Collage.mpp'); const bgL = d.addLayer('Fond', 0); bgL.ctx.fillStyle = o.bg; bgL.ctx.fillRect(0, 0, W, H);
    imgs.forEach((im, i) => { const c = cells[i]; if (!c) return; const s = this.fit(im, c), l = d.addLayer(im._name || ('Photo ' + (i + 1))), x = l.ctx; x.save(); const rr = Math.round(Math.min(c.w, c.h) * (o.radius / 100)); x.beginPath(); if (x.roundRect) x.roundRect(c.x, c.y, c.w, c.h, rr); else x.rect(c.x, c.y, c.w, c.h); x.clip(); x.imageSmoothingQuality = 'high'; x.drawImage(im, s.x, s.y, s.w, s.h, c.x, c.y, c.w, c.h); x.restore(); });
    d.active = d.layers.length - 1; return d;
  },
  async dialog() {
    const files = await MP.native.openFiles({ multi: true, accept: 'image/*', filters: [{ name: 'Images', extensions: IMAGE_EXT }] }); if (!files.length) return; if (files.length > 16) { MP.toast('16 images maximum'); return; }
    const imgs = []; for (const f of files) { try { const im = await MP.io.loadImage(f.data, f.name); const c = MP.createCanvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); c._name = f.name.replace(/\.[^.]+$/, ''); imgs.push(c); } catch (_) { /* */ } }
    const v = { size: '1080x1080', layout: 'grid', gap: 15, radius: 0, bg: '#ffffff' };
    MP.ui.dialog({ title: `Collage (${imgs.length} images)`, width: 440, okLabel: 'Créer le collage', values: v, fields: [{ k: 'size', label: 'Format', type: 'select', options: this.SIZES }, { k: 'layout', label: 'Disposition', type: 'select', options: [['grid', 'Grille automatique'], ['hero', 'Une grande + petites'], ['row', 'Bandes verticales'], ['col', 'Bandes horizontales']] }, { k: 'gap', label: 'Espacement', type: 'range', min: 0, max: 60 }, { k: 'radius', label: 'Coins arrondis', type: 'range', min: 0, max: 50, unit: '%' }, { k: 'bg', label: 'Couleur du fond', type: 'color' }, { type: 'info', html: '<p class="muted">Chaque photo est recadrée intelligemment dans sa case et placée sur son propre calque.</p>' }],
      onOk: (o) => { const d = this.build(imgs, o); MP.addDoc(d); MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll(); } });
  },
};

/* =================== Icônes d'application et favicon =================== */
MP.icons = {
  ico(pngs) { // ICO contenant des images PNG (Windows Vista et plus, tous les navigateurs)
    const n = pngs.length, head = 6 + 16 * n, total = head + pngs.reduce((s, p) => s + p.data.length, 0), b = new Uint8Array(total), dv = new DataView(b.buffer);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, n, true); let off = head;
    pngs.forEach((p, i) => { const e = 6 + 16 * i; b[e] = p.size >= 256 ? 0 : p.size; b[e + 1] = p.size >= 256 ? 0 : p.size; b[e + 2] = 0; b[e + 3] = 0; dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true); dv.setUint32(e + 8, p.data.length, true); dv.setUint32(e + 12, off, true); b.set(p.data, off); off += p.data.length; });
    return b;
  },
  square(d, pad) { const c = d.composite(null, { noLive: true }), r = MP.smartCrop.best(d, 1, 1), S = 1024, o = MP.createCanvas(S, S), x = o.getContext('2d'), p = Math.round(S * pad / 100); x.imageSmoothingQuality = 'high'; x.drawImage(c, r.x, r.y, r.w, r.h, p, p, S - 2 * p, S - 2 * p); return o; },
  scale(src, s, bg, radius) { const c = MP.createCanvas(s, s), x = c.getContext('2d'); if (radius) { x.beginPath(); if (x.roundRect) x.roundRect(0, 0, s, s, s * radius / 100); else x.rect(0, 0, s, s); x.clip(); } if (bg) { x.fillStyle = bg; x.fillRect(0, 0, s, s); } x.imageSmoothingQuality = 'high'; let cur = src; while (cur.width / 2 >= s) { const h = MP.createCanvas(Math.round(cur.width / 2), Math.round(cur.height / 2)); h.getContext('2d').drawImage(cur, 0, 0, h.width, h.height); cur = h; } x.drawImage(cur, 0, 0, s, s); return c; },
  async generate(d, o) {
    const src = this.square(d, o.pad), files = [], png = async (c) => MP.enc.png(c, {});
    const ico = []; for (const s of [16, 32, 48, 64, 128, 256]) ico.push({ size: s, data: await png(this.scale(src, s, o.bgIco ? o.bg : null, 0)) });
    files.push({ name: 'favicon.ico', data: this.ico(ico.filter((p) => p.size <= 48)) }, { name: 'app.ico', data: this.ico(ico) });
    for (const s of [16, 32, 48, 96, 192, 512]) files.push({ name: `favicon-${s}x${s}.png`, data: await png(this.scale(src, s, null, o.radius)) });
    files.push({ name: 'apple-touch-icon.png', data: await png(this.scale(src, 180, o.bg || '#ffffff', 0)) });
    for (const s of [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]) files.push({ name: `ios/AppIcon-${s}.png`, data: await png(this.scale(src, s, o.bg || '#ffffff', 0)) });
    for (const [n, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) files.push({ name: `android/mipmap-${n}/ic_launcher.png`, data: await png(this.scale(src, s, null, o.radius || 22)) });
    files.push({ name: 'android/play-store-512.png', data: await png(this.scale(src, 512, o.bg || '#ffffff', 0)) });
    const man = { name: o.name || 'Mon application', short_name: (o.name || 'App').slice(0, 12), icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' }], theme_color: o.bg || '#ffffff', background_color: o.bg || '#ffffff', display: 'standalone' };
    files.push({ name: 'site.webmanifest', data: new TextEncoder().encode(JSON.stringify(man, null, 2)) });
    files.push({ name: 'a-coller-dans-head.html', data: new TextEncoder().encode('<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n') });
    return files;
  },
  dialog() {
    const d = MP.doc; if (!d) return; const v = { name: d.name.replace(/\.[^.]+$/, ''), pad: 6, radius: 0, bg: '#ffffff', bgIco: false };
    MP.ui.dialog({ title: 'Icônes d\'application et favicon', width: 460, okLabel: 'Générer', values: v, fields: [{ type: 'info', html: '<p class="muted">Génère favicon.ico, les PNG du site (PWA), app.ico pour Windows, les icônes iOS et Android et le code HTML à coller. Partez d\'un logo carré de préférence.</p>' }, { k: 'name', label: 'Nom de l\'application', type: 'text' }, { k: 'pad', label: 'Marge', type: 'range', min: 0, max: 30, unit: '%' }, { k: 'radius', label: 'Coins arrondis (PNG du site)', type: 'range', min: 0, max: 50, unit: '%' }, { k: 'bg', label: 'Fond (iOS, Apple, Play Store)', type: 'color' }, { k: 'bgIco', label: 'Fond plein aussi pour les .ico', type: 'check' }],
      onOk: (o) => { setTimeout(async () => { const files = await MP.busy('Génération des icônes…', () => this.generate(d, o)); const z = MP.zip(files); await MP.native.saveFile({ defaultPath: (o.name || 'icones') + '-icones.zip', filters: [{ name: 'ZIP', extensions: ['zip'] }], data: z }); MP.toast(files.length + ' fichiers d\'icônes générés'); }, 30); } });
  },
};

/* =================== Menus =================== */
{
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), M = (n) => (m.find((x) => x.label === n) || { items: [] }).items;
    const fi = M('Fichier'), au = fi.find((x) => x && x.label === 'Automatisation');
    const extra = [{ label: 'Traitement par lots avancé (IA, détourage, studio, filigrane)…', act: () => MP.batchPro.dialog() }, { label: 'Collage / grille de photos…', act: () => MP.collage.dialog() }];
    if (au && typeof au.sub === 'function') { const s0 = au.sub; au.sub = () => [...s0(), '-', ...extra]; } else if (au && Array.isArray(au.sub)) au.sub.push('-', ...extra); else fi.splice(4, 0, ...extra);
    const ex = fi.find((x) => x && x.label === 'Exporter'), ic = { label: 'Icônes d\'application et favicon…', act: need(() => MP.icons.dialog()) };
    if (ex && typeof ex.sub === 'function') { const s0 = ex.sub; ex.sub = () => [...s0(), ic]; } else if (ex && Array.isArray(ex.sub)) ex.sub.push(ic);
    const im = M('Image'); im.splice(Math.max(0, im.findIndex((x) => x && x.label === 'Recadrage intelligent…') + 1), 0, { label: 'Studio photo produit (e-commerce)…', act: need(() => MP.productStudio.dialog()) }, { label: 'Ajouter un filigrane…', act: need(() => MP.watermark.dialog()) });
    const se = M('Sélection'), si = se.findIndex((x) => x && /Sujet \(IA\)/.test(x.label || ''));
    se.splice(si >= 0 ? si + 1 : 3, 0, { label: 'Sujet — hors ligne (fond uni)', act: need(() => MP.localSubjectSelect()) });
    return m;
  };
}
