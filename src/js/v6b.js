'use strict';
/* v6 (moteur 2/2) — modes de fusion supplémentaires, compositions de calques, plans de travail, répartition, marionnette,
   alignement automatique et panorama, séparation de fréquences, montage/animation, lots, variables, scripts,
   sauvegarde automatique et versions, objets dynamiques liés, polices manquantes, texte (paragraphe, sur tracé, déformé),
   masques vectoriels, variations génératives, bibliothèques */

/* =================== Modes de fusion supplémentaires (27 au total, comme Photoshop) =================== */
const CUSTOM_BLENDS = {
  dissolve: null,
  'darker-color': (u, t) => { const lu = u[0] * 0.3 + u[1] * 0.59 + u[2] * 0.11, lt = t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11; return lt < lu ? t : u; },
  'linear-burn': (u, t) => u.map((v, i) => Math.max(0, v + t[i] - 255)),
  'lighter-color': (u, t) => { const lu = u[0] * 0.3 + u[1] * 0.59 + u[2] * 0.11, lt = t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11; return lt > lu ? t : u; },
  'linear-dodge': (u, t) => u.map((v, i) => Math.min(255, v + t[i])),
  'vivid-light': (u, t) => u.map((v, i) => { const b = t[i]; return b < 128 ? (b === 0 ? 0 : Math.max(0, 255 - ((255 - v) * 255) / (2 * b))) : b === 255 ? 255 : Math.min(255, (v * 255) / (2 * (255 - b))); }),
  'linear-light': (u, t) => u.map((v, i) => MP.clamp(v + 2 * t[i] - 255, 0, 255)),
  'pin-light': (u, t) => u.map((v, i) => { const b = t[i]; return b < 128 ? Math.min(v, 2 * b) : Math.max(v, 2 * b - 255); }),
  'hard-mix': (u, t) => u.map((v, i) => (v + t[i] >= 255 ? 255 : 0)),
  subtract: (u, t) => u.map((v, i) => Math.max(0, v - t[i])),
  divide: (u, t) => u.map((v, i) => (t[i] === 0 ? 255 : Math.min(255, (v * 255) / t[i]))),
};
{
  const br = MP.tools.brush && MP.tools.brush.options.find((o) => o.k === 'blend'); if (br) br.options = MP.BLEND_MODES.slice();
  const add = [['dissolve', 'Fondu', 1], ['darker-color', 'Couleur plus foncée', 5], ['linear-burn', 'Densité linéaire +', 8], ['lighter-color', 'Couleur plus claire', 9], ['linear-dodge', 'Densité linéaire − (Ajout)', 12], ['vivid-light', 'Lumière vive', 15], ['linear-light', 'Lumière linéaire', 16], ['pin-light', 'Lumière ponctuelle', 17], ['hard-mix', 'Mélange maximal', 18], ['subtract', 'Soustraction', 21], ['divide', 'Division', 22]];
  for (const [k, n, at] of add) MP.BLEND_MODES.splice(Math.min(at, MP.BLEND_MODES.length), 0, [k, n]);
  const P = MP.Doc.prototype, dl0 = P.drawLayer;
  P.drawLayer = function (ctx, l, opts, depth, atop) {
    if (!(l.blend in CUSTOM_BLENDS) || l.adjust || !l.visible) return dl0.call(this, ctx, l, opts, depth, atop);
    const W = this.width, H = this.height, t = this.buf('cb' + depth), tc = t.getContext('2d');
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalAlpha = 1; tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, W, H);
    const bl = l.blend; l.blend = 'source-over';
    try { dl0.call(this, tc, l, opts, depth + 1, false); } finally { l.blend = bl; }
    const T = tc.getImageData(0, 0, W, H).data, U0 = ctx.getImageData(0, 0, W, H), U = U0.data, f = CUSTOM_BLENDS[bl];
    for (let i = 0; i < U.length; i += 4) {
      const at = T[i + 3] / 255; if (!at) continue; const au = U[i + 3] / 255, tr = [T[i], T[i + 1], T[i + 2]], u = [U[i], U[i + 1], U[i + 2]];
      if (bl === 'dissolve') { if (Math.random() >= at) continue; U[i] = tr[0]; U[i + 1] = tr[1]; U[i + 2] = tr[2]; if (!atop) U[i + 3] = 255; continue; }
      const b = f(u, tr);
      if (atop) { for (let c = 0; c < 3; c++) U[i + c] = at * b[c] + (1 - at) * u[c]; continue; }
      const ao = at + au * (1 - at); for (let c = 0; c < 3; c++) U[i + c] = (at * (1 - au) * tr[c] + at * au * b[c] + (1 - at) * au * u[c]) / ao; U[i + 3] = ao * 255;
    }
    ctx.putImageData(U0, 0, 0);
  };
}

/* =================== Déplacement générique d'un calque =================== */
MP.moveLayerBy = (l, dx, dy) => {
  if (!dx && !dy) return;
  if (l.text) { l.text.x += dx; l.text.y += dy; MP.renderText(l); return; }
  if (l.smart) { l.smart.m.cx += dx; l.smart.m.cy += dy; MP.smart.update(l); return; }
  const sh = (c) => { const n = MP.createCanvas(c.width, c.height); n.getContext('2d').drawImage(c, dx, dy); return n; };
  l.canvas = sh(l.canvas); l._v = (l._v || 0) + 1;
};
const siblingsForArrange = () => {
  const d = MP.doc, a = d.layer, full = (l) => { const b = MP.alphaBounds(l.canvas, 8); return !b || (b.w >= d.width * 0.98 && b.h >= d.height * 0.98); }; let set = d.layers.filter((l) => l.parent === a.parent && !l.isGroup && !l.adjust && l.visible && !full(l));
  if (set.length < 3 && a.parent == null) set = d.layers.filter((l) => !l.isGroup && !l.adjust && l.visible && !d.isHiddenByParent(l) && !full(l));
  return set;
};
MP.distribute = (axis) => {
  const d = MP.doc, set = siblingsForArrange(); if (set.length < 3) { MP.toast('Il faut au moins 3 calques visibles dans le groupe (ou le document)'); return; }
  const items = set.map((l) => ({ l, b: MP.alphaBounds(l.canvas, 8) })), key = axis === 'h' ? (o) => o.b.x + o.b.w / 2 : (o) => o.b.y + o.b.h / 2;
  items.sort((p, q) => key(p) - key(q)); const a = key(items[0]), z = key(items[items.length - 1]);
  d.history.record('Répartir les calques', items.map((o) => o.l.id));
  items.forEach((o, i) => { const target = a + ((z - a) * i) / (items.length - 1), delta = Math.round(target - key(o)); MP.moveLayerBy(o.l, axis === 'h' ? delta : 0, axis === 'h' ? 0 : delta); });
  MP.afterEdit(); MP.toast(`${items.length} calques répartis`);
};
MP.alignSet = (where) => {
  const d = MP.doc, set = siblingsForArrange(); if (set.length < 2) { MP.toast('Il faut au moins 2 calques visibles dans le groupe'); return; }
  const items = set.map((l) => ({ l, b: MP.alphaBounds(l.canvas, 8) })), U = items.reduce((u, o) => ({ x0: Math.min(u.x0, o.b.x), y0: Math.min(u.y0, o.b.y), x1: Math.max(u.x1, o.b.x + o.b.w), y1: Math.max(u.y1, o.b.y + o.b.h) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
  d.history.record('Aligner les calques', items.map((o) => o.l.id));
  for (const { l, b } of items) {
    const dx = where === 'left' ? U.x0 - b.x : where === 'right' ? U.x1 - b.x - b.w : where === 'hcenter' ? Math.round((U.x0 + U.x1) / 2 - b.x - b.w / 2) : 0;
    const dy = where === 'top' ? U.y0 - b.y : where === 'bottom' ? U.y1 - b.y - b.h : where === 'vcenter' ? Math.round((U.y0 + U.y1) / 2 - b.y - b.h / 2) : 0;
    MP.moveLayerBy(l, dx, dy);
  }
  MP.afterEdit();
};

/* =================== Compositions de calques =================== */
MP.comps = {
  capture(d) { const st = {}; for (const l of d.layers) st[l.id] = { visible: l.visible, opacity: l.opacity, blend: l.blend, fx: l.fx ? Object.fromEntries(Object.entries(l.fx).map(([k, v]) => [k, !!(v && v.on)])) : null }; return st; },
  apply(d, st) { for (const l of d.layers) { const s = st[l.id]; if (!s) continue; l.visible = s.visible; l.opacity = s.opacity; l.blend = s.blend; if (s.fx && l.fx) for (const [k, on] of Object.entries(s.fx)) if (l.fx[k]) l.fx[k].on = on; l._v = (l._v || 0) + 1; } },
  add(name) { const d = MP.doc; d.comps = d.comps || []; d.comps.push({ name: name || 'Composition ' + (d.comps.length + 1), state: this.capture(d) }); d.markDirty(); MP.ui.refreshComps && MP.ui.refreshComps(); },
  go(i) { const d = MP.doc, c = d.comps[i]; if (!c) return; d.history.record('Composition : ' + c.name, null); this.apply(d, c.state); d.compSel = i; MP.afterEdit(); MP.ui.refreshComps && MP.ui.refreshComps(); },
  update(i) { const d = MP.doc; d.comps[i].state = this.capture(d); d.markDirty(); MP.toast('Composition mise à jour'); },
  remove(i) { const d = MP.doc; d.comps.splice(i, 1); d.markDirty(); MP.ui.refreshComps && MP.ui.refreshComps(); },
  async exportAll() { const d = MP.doc, cur = this.capture(d), files = []; for (const c of d.comps || []) { this.apply(d, c.state); d.rev++; files.push({ name: c.name.replace(/[\\/:*?"<>|]/g, '_') + '.png', data: await MP.enc.png(MP.flatComposite(d), { dpi: d.dpi, meta: d.meta }) }); } this.apply(d, cur); MP.render(); if (files.length) MP.outFiles(files, 'compositions'); },
};

/* =================== Plans de travail =================== */
MP.artboards = {
  list(d) { return (d.artboards = d.artboards || []); },
  add(v) {
    const d = MP.doc, A = this.list(d), gap = 120;
    let x = 0, y = 0;
    if (A.length) { const r = A.reduce((m, a) => Math.max(m, a.x + a.w), 0); x = r + gap; }
    else if (v.useDoc) { A.push({ name: 'Plan de travail 1', x: 0, y: 0, w: d.width, h: d.height, bg: '#ffffff' }); x = d.width + gap; }
    const W = Math.max(d.width, x + v.w), H = Math.max(d.height, y + v.h);
    if (W > d.width || H > d.height) MP.canvasSize(W, H, 0, 0, 'transparent');
    d.history.record('Nouveau plan de travail', null);
    const ab = { name: v.name || 'Plan de travail ' + (A.length + 1), x, y, w: v.w, h: v.h, bg: v.bg || '#ffffff' }; A.push(ab);
    if (v.bg !== 'transparent') { const l = d.addLayer('Fond — ' + ab.name, 0); l.ctx.fillStyle = ab.bg; l.ctx.fillRect(x, y, v.w, v.h); }
    MP.afterEdit(); MP.view.fit(); MP.toast('Plan de travail « ' + ab.name + ' » ajouté');
  },
  fromSelection(name) { const d = MP.doc, b = MP.sel.bounds(d); if (!b) { MP.toast('Faites une sélection rectangulaire'); return; } d.history.record('Plan de travail', null); this.list(d).push({ name: name || 'Plan de travail ' + (this.list(d).length + 1), x: b.x, y: b.y, w: b.w, h: b.h, bg: 'transparent' }); MP.sel.none(d); MP.render(); },
  remove(i) { const d = MP.doc; d.history.record('Supprimer le plan de travail', null); this.list(d).splice(i, 1); MP.render(); },
  async export(fmt = 'png', scale = 1) {
    const d = MP.doc, A = this.list(d); if (!A.length) { MP.toast('Aucun plan de travail'); return; }
    const comp = MP.flatComposite(d), files = [];
    for (const a of A) { const c = MP.createCanvas(Math.round(a.w * scale), Math.round(a.h * scale)), x = c.getContext('2d'); if (fmt === 'jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } x.imageSmoothingQuality = 'high'; x.drawImage(comp, a.x, a.y, a.w, a.h, 0, 0, c.width, c.height); files.push({ name: a.name.replace(/[\\/:*?"<>|]/g, '_') + (scale !== 1 ? '@' + scale + 'x' : '') + (fmt === 'jpeg' ? '.jpg' : '.png'), data: fmt === 'jpeg' ? await MP.enc.jpeg(c, 0.92, { dpi: d.dpi, meta: d.meta }) : await MP.enc.png(c, { dpi: d.dpi, meta: d.meta }) }); }
    MP.outFiles(files, 'plans-de-travail');
  },
};
{
  const ds0 = MP.drawSamplers;
  MP.drawSamplers = (ctx, d) => {
    ds0 && ds0(ctx, d);
    const A = d.artboards; if (!A || !A.length) return;
    ctx.save(); ctx.font = '12px "Segoe UI", sans-serif'; ctx.textBaseline = 'bottom';
    for (const a of A) { const p = MP.docToScreen({ x: a.x, y: a.y }), w = a.w * d.zoom, h = a.h * d.zoom; ctx.strokeStyle = 'rgba(120,150,255,.9)'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5, w, h); ctx.fillStyle = '#c9cfe0'; ctx.fillText(a.name, p.x, p.y - 3); }
    ctx.restore();
  };
}

/* =================== Sortie de plusieurs fichiers =================== */
MP.outFiles = async (files, zipName = 'export') => {
  if (files.length === 1) { const p = await MP.native.saveFile({ defaultPath: files[0].name, filters: [{ name: files[0].name.split('.').pop().toUpperCase(), extensions: [files[0].name.split('.').pop()] }], data: files[0].data }); if (p) MP.toast('Exporté : ' + files[0].name); return; }
  if (MP.native.pickFolder) { const dir = await MP.native.pickFolder(); if (!dir) return; for (const f of files) await MP.native.writeFile(dir + (dir.includes('\\') ? '\\' : '/') + f.name, f.data); MP.toast(`${files.length} fichiers enregistrés dans ${dir}`, 4000); return; }
  const z = MP.zip(files); await MP.native.saveFile({ defaultPath: zipName + '.zip', filters: [{ name: 'ZIP', extensions: ['zip'] }], data: z }); MP.toast(`${files.length} fichiers regroupés dans ${zipName}.zip`);
};

/* =================== Déformation de la marionnette =================== */
const drawTri = (ctx, img, s0, s1, s2, d0, d1, d2) => {
  const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y); if (Math.abs(den) < 1e-6) return;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den, b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den, dd = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
  const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / den, f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / den;
  const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3, g = (p) => { const vx = p.x - cx, vy = p.y - cy, L = Math.hypot(vx, vy) || 1; return { x: p.x + (vx / L) * 0.6, y: p.y + (vy / L) * 0.6 }; };
  const e0 = g(d0), e1 = g(d1), e2 = g(d2);
  ctx.save(); ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.closePath(); ctx.clip();
  ctx.transform(a, b, c, dd, e, f); ctx.drawImage(img, 0, 0); ctx.restore();
};
MP.mls = (pins, v) => {
  if (!pins.length) return v;
  let sw = 0, px = 0, py = 0, qx = 0, qy = 0; const W = [];
  for (const p of pins) { const d2 = (p.x - v.x) ** 2 + (p.y - v.y) ** 2; if (d2 < 1e-6) return { x: p.qx, y: p.qy }; const w = 1 / d2; W.push(w); sw += w; px += w * p.x; py += w * p.y; qx += w * p.qx; qy += w * p.qy; }
  px /= sw; py /= sw; qx /= sw; qy /= sw;
  if (pins.length === 1) return { x: v.x + qx - px, y: v.y + qy - py };
  const vx = v.x - px, vy = v.y - py; let fx = 0, fy = 0;
  pins.forEach((p, i) => { const hx = p.x - px, hy = p.y - py, qhx = p.qx - qx, qhy = p.qy - qy, a = hx * vx + hy * vy, b = hx * vy - hy * vx; fx += W[i] * (qhx * a - qhy * b); fy += W[i] * (qhx * b + qhy * a); });
  const L = Math.hypot(fx, fy), vl = Math.hypot(vx, vy); if (L < 1e-9) return { x: v.x + qx - px, y: v.y + qy - py };
  return { x: (vl * fx) / L + qx, y: (vl * fy) / L + qy };
};
MP.puppet = {
  open() {
    const d = MP.doc; if (!d || !MP.canEditPixels()) return; const l = d.layer;
    if (l.isGroup || l.adjust) { MP.toast('Sélectionnez un calque de pixels'); return; }
    const b0 = MP.alphaBounds(l.canvas, 4); if (!b0) { MP.toast('Calque vide'); return; }
    const st = { density: 24, expand: 6, pins: [], drag: null, mesh: true };
    const s = Math.min(1, 1300 / Math.max(d.width, d.height)), pw = Math.round(d.width * s), ph = Math.round(d.height * s);
    const vis = l.visible; l.visible = false; d.rev++; const below = MP.cloneCanvas(d.composite(null, { noLive: true })); l.visible = vis; d.rev++;
    const back = el('div', { class: 'liq' });
    back.innerHTML = `<div class="liq-side"><h3>Déformation de la marionnette</h3><p class="muted">Cliquez sur l'image pour poser des épingles, puis faites-les glisser. Alt + clic sur une épingle : la supprimer. Posez au moins 2 épingles pour plier sans déplacer.</p>
      <label>Densité <select class="pden"><option value="14">Moins de points</option><option value="24" selected>Normale</option><option value="40">Plus de points</option></select></label>
      <label>Extension <input type="range" min="0" max="60" value="6" class="pexp"></label>
      <label><input type="checkbox" class="pmesh" checked> Afficher le maillage</label>
      <div class="liq-btns"><button class="btn pclear">Retirer toutes les épingles</button></div>
      <div class="liq-foot"><button class="btn lcancel">Annuler</button><button class="btn primary lok">OK</button></div></div><div class="liq-stage"><canvas class="liq-canvas"></canvas></div>`;
    document.body.appendChild(back); MP.ui.dialogOpen = { close: () => back.remove() };
    const cv = back.querySelector('.liq-canvas'); cv.width = pw; cv.height = ph; const cx = cv.getContext('2d');
    const small = MP.createCanvas(pw, ph); small.getContext('2d').drawImage(l.canvas, 0, 0, pw, ph);
    let grid = null;
    const build = () => { const e = st.expand, b = { x: b0.x - e, y: b0.y - e, w: b0.w + 2 * e, h: b0.h + 2 * e }, n = st.density, m = Math.max(2, Math.round((n * b.h) / Math.max(b.w, b.h))), k = Math.max(2, Math.round((n * b.w) / Math.max(b.w, b.h))); grid = { b, nx: k, ny: m, pts: [] }; for (let j = 0; j <= m; j++) for (let i = 0; i <= k; i++) grid.pts.push({ x: b.x + (b.w * i) / k, y: b.y + (b.h * j) / m }); };
    const deform = () => grid.pts.map((p) => MP.mls(st.pins, p));
    const render = (ctx, img, scale, def) => {
      const { nx, ny, pts } = grid, Sp = (p) => ({ x: p.x * scale, y: p.y * scale }), ks = img.width / d.width;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1, S = (p) => ({ x: p.x * ks, y: p.y * ks });
        drawTri(ctx, img, S(pts[a]), S(pts[b]), S(pts[e]), Sp(def[a]), Sp(def[b]), Sp(def[e])); drawTri(ctx, img, S(pts[a]), S(pts[e]), S(pts[c]), Sp(def[a]), Sp(def[e]), Sp(def[c]));
      }
    };
    const draw = () => {
      cx.clearRect(0, 0, pw, ph); for (let j = 0; j < ph; j += 12) for (let i = 0; i < pw; i += 12) { cx.fillStyle = (i + j) % 24 ? '#cfcfcf' : '#fff'; cx.fillRect(i, j, 12, 12); }
      cx.drawImage(below, 0, 0, pw, ph); const def = deform(); render(cx, small, s, def);
      if (st.mesh) { cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 0.5; cx.beginPath(); const { nx, ny } = grid; for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const p = def[j * (nx + 1) + i]; if (i < nx) { const q = def[j * (nx + 1) + i + 1]; cx.moveTo(p.x * s, p.y * s); cx.lineTo(q.x * s, q.y * s); } if (j < ny) { const q = def[(j + 1) * (nx + 1) + i]; cx.moveTo(p.x * s, p.y * s); cx.lineTo(q.x * s, q.y * s); } } cx.stroke(); }
      for (const p of st.pins) { cx.beginPath(); cx.arc(p.qx * s, p.qy * s, 6, 0, 7); cx.fillStyle = p === st.drag ? '#ffd400' : '#fff'; cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 1.5; cx.stroke(); cx.beginPath(); cx.arc(p.qx * s, p.qy * s, 2, 0, 7); cx.fillStyle = '#000'; cx.fill(); }
    };
    let q = false; const redraw = () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; draw(); }); };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * pw / s, y: ((e.clientY - r.top) / r.height) * ph / s, k: pw / r.width / s }; };
    cv.addEventListener('pointerdown', (e) => {
      const p = pos(e), hit = st.pins.find((pp) => Math.hypot(pp.qx - p.x, pp.qy - p.y) < 10 * p.k / (pw / cv.getBoundingClientRect().width) + 8 / s);
      if (hit && e.altKey) { st.pins.splice(st.pins.indexOf(hit), 1); redraw(); return; }
      if (hit) st.drag = hit; else { const dp = MP.mls(st.pins, p), inv = st.pins.length ? { x: p.x - (dp.x - p.x), y: p.y - (dp.y - p.y) } : p; const np = { x: inv.x, y: inv.y, qx: p.x, qy: p.y }; st.pins.push(np); st.drag = np; }
      cv.setPointerCapture(e.pointerId); redraw();
    });
    cv.addEventListener('pointermove', (e) => { if (!st.drag || !e.buttons) return; const p = pos(e); st.drag.qx = p.x; st.drag.qy = p.y; redraw(); });
    cv.addEventListener('pointerup', () => { st.drag = null; redraw(); });
    back.querySelector('.pden').onchange = (e) => { st.density = +e.target.value; build(); redraw(); };
    back.querySelector('.pexp').oninput = (e) => { st.expand = +e.target.value; build(); redraw(); };
    back.querySelector('.pmesh').onchange = (e) => { st.mesh = e.target.checked; redraw(); };
    back.querySelector('.pclear').onclick = () => { st.pins = []; redraw(); };
    const close = () => { back.remove(); MP.ui.dialogOpen = null; };
    back.querySelector('.lcancel').onclick = close;
    back.querySelector('.lok').onclick = () => {
      close(); if (!st.pins.length) return;
      MP.busy('Déformation de la marionnette…', () => {
        d.history.record('Déformation de la marionnette', [l.id]); if (l.smart) l.smart = null; if (l.text) l.text = null;
        const out = MP.createCanvas(d.width, d.height), o = out.getContext('2d'); o.imageSmoothingQuality = 'high'; render(o, l.canvas, 1, deform());
        l.canvas = out; MP.afterEdit();
      });
    };
    build(); draw();
  },
};

/* =================== Alignement automatique et panorama =================== */
const gradImg = (c, W, H) => {
  const t = MP.createCanvas(W, H), x = t.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, W, H);
  const a = x.getImageData(0, 0, W, H).data, g = new Float32Array(W * H), m = new Uint8Array(W * H), L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { L[i] = a[i * 4] * 0.3 + a[i * 4 + 1] * 0.59 + a[i * 4 + 2] * 0.11; m[i] = a[i * 4 + 3] > 200 ? 1 : 0; }
  for (let y = 1; y < H - 1; y++) for (let x2 = 1; x2 < W - 1; x2++) { const i = y * W + x2; g[i] = Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + W] - L[i - W]); }
  return { g, m, W, H };
};
const matchScore = (A, B, dx, dy, minOverlap) => {
  let s = 0, n = 0; const x0 = Math.max(1, dx + 1), x1 = Math.min(A.W - 1, B.W + dx - 1), y0 = Math.max(1, dy + 1), y1 = Math.min(A.H - 1, B.H + dy - 1);
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) { const i = y * A.W + x, j = (y - dy) * B.W + (x - dx); if (A.m[i] && B.m[j]) { s += Math.abs(A.g[i] - B.g[j]); n++; } }
  return n < minOverlap ? Infinity : s / n;
};
/** Décalage (dx, dy) de B par rapport à A, en pixels pleine résolution */
MP.estimateShift = (ca, cb, { rx = [-0.3, 0.3], ry = [-0.3, 0.3], minOv = 0.25 } = {}) => {
  const base = Math.max(ca.width, ca.height); let best = null;
  for (const size of [96, 192, 384]) {
    const k = size / base, A = gradImg(ca, Math.max(8, Math.round(ca.width * k)), Math.max(8, Math.round(ca.height * k))), B = gradImg(cb, Math.max(8, Math.round(cb.width * k)), Math.max(8, Math.round(cb.height * k)));
    const minOverlap = minOv * Math.min(A.W * A.H, B.W * B.H);
    let range;
    if (!best) range = { x0: Math.round(rx[0] * A.W), x1: Math.round(rx[1] * A.W), y0: Math.round(ry[0] * A.H), y1: Math.round(ry[1] * A.H) };
    else { const cx = Math.round(best.dx * k), cy = Math.round(best.dy * k); range = { x0: cx - 3, x1: cx + 3, y0: cy - 3, y1: cy + 3 }; }
    let bs = Infinity, bx = 0, by = 0;
    for (let dy = range.y0; dy <= range.y1; dy++) for (let dx = range.x0; dx <= range.x1; dx++) { const sc = matchScore(A, B, dx, dy, minOverlap); if (sc < bs) { bs = sc; bx = dx; by = dy; } }
    if (!isFinite(bs)) return null; best = { dx: bx / k, dy: by / k, score: bs };
  }
  return { dx: Math.round(best.dx), dy: Math.round(best.dy), score: best.score };
};
MP.autoAlign = () => {
  const d = MP.doc, set = d.layers.filter((l) => !l.isGroup && !l.adjust && l.visible && !l.text && (l.parent === d.layer.parent) && MP.alphaBounds(l.canvas, 8));
  if (set.length < 2) { MP.toast('Placez au moins 2 calques de pixels visibles dans le même groupe'); return; }
  return MP.busy('Alignement automatique des calques…', () => {
    d.history.record('Alignement automatique', set.map((l) => l.id)); const ref = set[0]; let n = 0;
    for (const l of set.slice(1)) { const r = MP.estimateShift(ref.canvas, l.canvas); if (r && (r.dx || r.dy)) { MP.moveLayerBy(l, r.dx, r.dy); n++; } }
    MP.afterEdit(); MP.toast(n ? `${n} calque(s) aligné(s) sur « ${ref.name} » (translation)` : 'Les calques étaient déjà alignés');
  });
};
MP.panorama = async (files) => {
  if (!files || files.length < 2) { MP.toast('Choisissez au moins 2 photos qui se chevauchent (de gauche à droite)'); return; }
  files = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  await MP.busy('Photomerge : assemblage du panorama…', async () => {
    let imgs = []; for (const f of files) imgs.push(await MP.io.loadImage(f.data, f.name));
    const H = Math.min(...imgs.map((c) => c.height), 3000); imgs = imgs.map((c) => { if (c.height === H) return c; const n = MP.createCanvas(Math.round((c.width * H) / c.height), H); const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height); return n; });
    const pos = [{ x: 0, y: 0 }];
    for (let i = 1; i < imgs.length; i++) {
      const r = MP.estimateShift(imgs[i - 1], imgs[i], { rx: [0.25, 0.95], ry: [-0.12, 0.12], minOv: 0.04 });
      const prev = pos[i - 1]; pos.push(r ? { x: prev.x + r.dx, y: prev.y + r.dy } : { x: prev.x + Math.round(imgs[i - 1].width * 0.7), y: prev.y });
    }
    const minY = Math.min(...pos.map((p) => p.y)), maxY = Math.max(...pos.map((p, i) => p.y + imgs[i].height)), W = Math.max(...pos.map((p, i) => p.x + imgs[i].width));
    const d = new MP.Doc(W, maxY - minY, 'Panorama');
    imgs.forEach((c, i) => {
      const l = d.addLayer(files[i].name, i); l.ctx.drawImage(c, pos[i].x, pos[i].y - minY);
      if (i > 0) {
        const ov = pos[i - 1].x + imgs[i - 1].width - pos[i].x; if (ov > 4) {
          const m = MP.createCanvas(W, d.height), mx = m.getContext('2d'), g = mx.createLinearGradient(pos[i].x, 0, pos[i].x + ov, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, '#fff');
          mx.fillStyle = g; mx.fillRect(pos[i].x, 0, ov, d.height); mx.fillStyle = '#fff'; mx.fillRect(pos[i].x + ov, 0, W, d.height); l.mask = m; l.maskEnabled = true;
        }
      }
    });
    d.active = d.layers.length - 1; MP.addDoc(d); MP.toast('Panorama créé : chaque photo est un calque avec un masque de fondu (modifiable). Recadrez les bords avec C.', 6000);
  });
};

/* =================== Techniques de retouche =================== */
MP.retouch = {
  frequencySeparation(r = 6) {
    const d = MP.doc; return MP.busy('Séparation de fréquences…', () => {
      d.history.record('Séparation de fréquences', null);
      const src = MP.flatComposite(d), low = MP.blurCanvas(src, r), s = imgData(src).data, b = imgData(low).data, hi = MP.createCanvas(d.width, d.height), hx = hi.getContext('2d'), hd = hx.createImageData(d.width, d.height), h = hd.data;
      for (let i = 0; i < s.length; i += 4) { for (let c = 0; c < 3; c++) h[i + c] = MP.clamp((s[i + c] - b[i + c]) / 2 + 128, 0, 255); h[i + 3] = 255; }
      hx.putImageData(hd, 0, 0);
      const g = d.addLayer('Séparation de fréquences'); g.isGroup = true; g.blend = 'pass-through'; g.canvas = MP.createCanvas(1, 1);
      const L = d.addLayer('Basses fréquences (couleurs, tons)'); L.canvas = low; L.parent = g.id;
      const Hl = d.addLayer('Hautes fréquences (texture)'); Hl.canvas = hi; Hl.blend = 'linear-light'; Hl.parent = g.id;
      d.normalize(); d.active = d.layers.indexOf(L); MP.afterEdit(); MP.ui.refreshAll();
      MP.toast('Lissez les teintes sur « Basses fréquences » (flou, correcteur) et retouchez la texture sur « Hautes fréquences » (tampon)', 6000);
    });
  },
  dodgeBurn() {
    const d = MP.doc; d.history.record('Calque Densité (dodge & burn)', null);
    const l = d.addLayer('Dodge & Burn'); l.ctx.fillStyle = '#808080'; l.ctx.fillRect(0, 0, d.width, d.height); l.blend = 'soft-light';
    MP.afterEdit(); MP.setTool('brush'); Object.assign(MP.tools.brush.opts, { opacity: 8, hardness: 0 }); MP.colors.fg = '#ffffff'; MP.colors.bg = '#000000'; MP.ui.refreshColors(); MP.ui.refreshTool();
    MP.toast('Peignez en blanc pour éclaircir, en noir pour assombrir (X pour inverser les couleurs)', 5000);
  },
  oldPhoto(v) {
    const d = MP.doc; if (!MP.canEditPixels()) return;
    return MP.busy('Restauration de la photo…', () => {
      const l = d.layer; d.history.record('Restauration de photo ancienne', [l.id]); let c = l.canvas;
      if (v.dust) c = MP.applySpec(c, MP.FILTERS.dust, { ...MP.FILTERS.dust.values });
      if (v.noise) c = MP.applySpec(c, MP.FILTERS.surface, { r: 2, t: 12 });
      if (v.contrast) c = MP.applySpec(c, MP.ADJUST.autoContrast, {});
      if (v.sharp) c = MP.FILTERS.smartSharpen.render(c, { amt: 80, r: 1, nr: 20, sh: 0, hi: 0 });
      l.canvas = c; MP.afterEdit();
      if (v.colorize) MP.ai.colorize(); else MP.toast('Photo restaurée — utilisez Suppression (J) ou le Correcteur pour les plis et déchirures', 5000);
    });
  },
  superRes(k) { const d = MP.doc; if (d.width * k * d.height * k > 120e6) { MP.toast('Image trop grande pour cet agrandissement'); return; } return MP.busy('Super résolution ×' + k + '…', () => { MP.resizeImage(d.width * k, d.height * k, 'details'); MP.view.fit(); MP.toast(`Image agrandie à ${d.width} × ${d.height} px (rééchantillonnage Lanczos + accentuation)`); }); },
};

/* =================== Montage : animation image par image, GIF animé, vidéo =================== */
MP.anim = {
  frames(d = MP.doc) { return (d.frames = d.frames || []); },
  capture(d) { const st = {}; for (const l of d.layers) st[l.id] = { visible: l.visible, opacity: l.opacity }; return st; },
  apply(d, st) { for (const l of d.layers) { const s = st[l.id]; if (s) { l.visible = s.visible; l.opacity = s.opacity; } } d.rev++; },
  ensure() { const d = MP.doc, F = this.frames(d); if (!F.length) { F.push({ state: this.capture(d), delay: 200 }); d.frameSel = 0; } },
  commit() { const d = MP.doc, F = this.frames(d); if (F.length && d.frameSel != null && F[d.frameSel]) F[d.frameSel].state = this.capture(d); },
  select(i) { const d = MP.doc, F = this.frames(d); if (!F[i]) return; this.commit(); d.frameSel = i; this.apply(d, F[i].state); MP.ui.refreshLayers(); MP.render(); MP.ui.refreshTimeline && MP.ui.refreshTimeline(); },
  add() { const d = MP.doc; this.ensure(); this.commit(); const F = this.frames(d), i = (d.frameSel ?? F.length - 1) + 1; F.splice(i, 0, { state: this.capture(d), delay: F[i - 1].delay }); d.frameSel = i; d.markDirty(); MP.ui.refreshTimeline && MP.ui.refreshTimeline(); },
  remove(i) { const d = MP.doc, F = this.frames(d); if (F.length <= 1) return; F.splice(i, 1); d.frameSel = Math.min(i, F.length - 1); this.apply(d, F[d.frameSel].state); MP.ui.refreshLayers(); MP.render(); MP.ui.refreshTimeline && MP.ui.refreshTimeline(); },
  fromLayers() {
    const d = MP.doc;
    const list = d.layers.filter((l) => !l.isGroup && !l.adjust); if (list.length < 2) { MP.toast('Il faut au moins 2 calques'); return; }
    const bg = list[0], F = (d.frames = []);
    list.slice(1).forEach((L) => { const st = {}; for (const l of d.layers) st[l.id] = { visible: l === L || l === bg || l.isGroup || !!l.adjust, opacity: l.opacity }; F.push({ state: st, delay: 150 }); });
    d.frameSel = 0; this.apply(d, F[0].state); MP.ui.refreshLayers(); MP.render(); MP.ui.refreshTimeline && MP.ui.refreshTimeline(); MP.toast(`${F.length} images créées à partir des calques`);
  },
  tween(i, n) {
    const d = MP.doc, F = this.frames(d); if (!F[i] || !F[i + 1]) { MP.toast('Sélectionnez une image suivie d\'une autre'); return; }
    this.commit(); const A = F[i].state, B = F[i + 1].state, ins = [];
    for (let k = 1; k <= n; k++) { const t = k / (n + 1), st = {}; for (const id of Object.keys({ ...A, ...B })) { const a = A[id] || B[id], b = B[id] || A[id], oa = a.visible ? a.opacity : 0, ob = b.visible ? b.opacity : 0, o = oa + (ob - oa) * t; st[id] = { visible: o > 0.001, opacity: Math.max(0.001, o) }; } ins.push({ state: st, delay: F[i].delay }); }
    F.splice(i + 1, 0, ...ins); d.markDirty(); MP.ui.refreshTimeline && MP.ui.refreshTimeline();
  },
  render(d, i) { const keep = this.capture(d); this.apply(d, this.frames(d)[i].state); const c = MP.flatComposite(d); this.apply(d, keep); d.rev++; return c; },
  play() {
    const d = MP.doc, F = this.frames(d); if (F.length < 2) { MP.toast('Ajoutez au moins 2 images dans le montage'); return; }
    if (this.timer) return this.stop(); this.commit(); let i = d.frameSel || 0, loops = 0;
    const step = () => { if (MP.doc !== d) return this.stop(); this.apply(d, F[i].state); d.frameSel = i; MP.render(); MP.ui.refreshTimeline && MP.ui.refreshTimeline(true); const delay = F[i].delay; i++; if (i >= F.length) { i = 0; loops++; if (d.anim && d.anim.loop && loops >= d.anim.loop) return this.stop(); } this.timer = setTimeout(step, delay); };
    this.timer = 1; step();
  },
  stop() { clearTimeout(this.timer); this.timer = null; const d = MP.doc; if (d && this.frames(d)[d.frameSel || 0]) { this.apply(d, this.frames(d)[d.frameSel || 0].state); MP.ui.refreshLayers(); MP.render(); } MP.ui.refreshTimeline && MP.ui.refreshTimeline(); },
  async exportGif(v) {
    const d = MP.doc; this.ensure(); this.commit(); const F = this.frames(d), k = (v.scale || 100) / 100;
    const data = await MP.busy('Création du GIF animé…', () => MP.enc.gif(F.map((f, i) => { const c = this.render(d, i), s = MP.createCanvas(Math.round(d.width * k), Math.round(d.height * k)), x = s.getContext('2d'); if (v.bg) { x.fillStyle = v.bg; x.fillRect(0, 0, s.width, s.height); } x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, s.width, s.height); return { canvas: s, delay: f.delay }; }), { loop: (d.anim && d.anim.loop) || 0, dither: v.dither !== false }));
    const p = await MP.native.saveFile({ defaultPath: d.name.replace(/\.[^.]+$/, '') + '.gif', filters: [{ name: 'GIF animé', extensions: ['gif'] }], data }); if (p) MP.toast(`GIF animé exporté (${F.length} images, ${(data.length / 1024).toFixed(0)} Ko)`);
  },
  async exportVideo(v) {
    const d = MP.doc; this.ensure(); this.commit(); const F = this.frames(d), k = (v.scale || 100) / 100;
    if (!window.MediaRecorder) { MP.toast('Export vidéo indisponible sur ce système'); return; }
    const c = MP.createCanvas(Math.round((d.width * k) / 2) * 2, Math.round((d.height * k) / 2) * 2), x = c.getContext('2d'), stream = c.captureStream(30);
    const mime = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)), rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }), chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const frames = F.map((f, i) => this.render(d, i));
    await MP.busy('Enregistrement de la vidéo…', () => new Promise((res) => {
      rec.onstop = res; rec.start(); let loops = Math.max(1, v.loops || 1), i = 0;
      const step = () => { x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.drawImage(frames[i], 0, 0, c.width, c.height); const dl = F[i].delay; i++; if (i >= frames.length) { i = 0; loops--; if (!loops) { setTimeout(() => rec.stop(), dl); return; } } setTimeout(step, dl); };
      step();
    }));
    const blob = new Blob(chunks, { type: mime }), data = new Uint8Array(await blob.arrayBuffer()), e = mime.includes('mp4') ? 'mp4' : 'webm';
    const p = await MP.native.saveFile({ defaultPath: d.name.replace(/\.[^.]+$/, '') + '.' + e, filters: [{ name: 'Vidéo', extensions: [e] }], data }); if (p) MP.toast('Vidéo exportée (' + e.toUpperCase() + ')');
  },
  async importVideo() {
    const f = (await MP.native.openFiles({ multi: false, accept: 'video/*', filters: [{ name: 'Vidéos', extensions: ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv'] }] }))[0]; if (!f) return;
    const url = URL.createObjectURL(new Blob([f.data])), vid = document.createElement('video'); vid.muted = true; vid.src = url;
    try { await new Promise((r, j) => { vid.onloadeddata = r; vid.onerror = () => j(new Error('format vidéo non lu par le moteur (essayez MP4 H.264 ou WebM)')); }); } catch (e) { MP.toast(e.message, 5000); return; }
    MP.ui.dialog({ title: 'Importer des images vidéo en calques', width: 420, fields: [{ type: 'info', html: `<p class="muted">${esc(f.name)} — ${vid.videoWidth} × ${vid.videoHeight}, ${vid.duration.toFixed(1)} s</p>` }, { k: 'from', label: 'Début (s)', type: 'number', min: 0, max: Math.floor(vid.duration) }, { k: 'to', label: 'Fin (s)', type: 'number', min: 0, max: Math.ceil(vid.duration) }, { k: 'every', label: 'Une image toutes les (images à 30 i/s)', type: 'range', min: 1, max: 30 }, { k: 'frames', label: 'Créer aussi les images du montage', type: 'check' }],
      values: { from: 0, to: Math.min(Math.ceil(vid.duration), 5), every: 6, frames: true },
      onOk: (v) => MP.busy('Extraction des images…', async () => {
        const step = v.every / 30, times = []; for (let t = +v.from; t <= Math.min(+v.to, vid.duration) && times.length < 150; t += step) times.push(t);
        const d = new MP.Doc(vid.videoWidth, vid.videoHeight, f.name.replace(/\.[^.]+$/, '') + '.mpp');
        for (const [i, t] of times.entries()) { vid.currentTime = t; await new Promise((r) => (vid.onseeked = r)); const l = d.addLayer('Image ' + (i + 1) + ' (' + t.toFixed(2) + ' s)', i); l.ctx.drawImage(vid, 0, 0); }
        URL.revokeObjectURL(url); MP.addDoc(d);
        if (v.frames) { d.frames = d.layers.map((L) => ({ state: Object.fromEntries(d.layers.map((l) => [l.id, { visible: l === L, opacity: 1 }])), delay: Math.round(step * 1000) })); d.frameSel = 0; this.apply(d, d.frames[0].state); MP.ui.refreshAll(); MP.ui.showTimeline && MP.ui.showTimeline(true); }
        MP.toast(`${times.length} image(s) importée(s) en calques`);
      }) });
  },
};

/* =================== Automatisation : lots, processeur d'images, variables, scripts =================== */
MP.encodeDoc = async (d, v) => {
  const k = (v.scale || 100) / 100; let c = MP.flatComposite(d, v.format === 'jpeg' || v.format === 'bmp' || v.bg === 'white' ? '#ffffff' : null);
  let w = Math.round(d.width * k), h = Math.round(d.height * k);
  if (v.fitW || v.fitH) { const f = Math.min((v.fitW || 1e9) / d.width, (v.fitH || 1e9) / d.height, v.upscale ? 1e9 : 1); w = Math.round(d.width * f); h = Math.round(d.height * f); }
  if (w !== c.width || h !== c.height) c = MP.lanczos ? MP.lanczos(c, w, h) : c;
  const meta = v.meta === false ? null : d.meta, dpi = d.dpi || 72, q = (v.quality || 90) / 100;
  switch (v.format) {
    case 'jpeg': return { ext: 'jpg', data: await MP.enc.jpeg(c, q, { dpi, meta }) };
    case 'webp': return { ext: 'webp', data: new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/webp', q))).arrayBuffer()) };
    case 'gif': return { ext: 'gif', data: MP.enc.gif([{ canvas: c, delay: 0 }], { dither: true }) };
    case 'bmp': return { ext: 'bmp', data: MP.enc.bmp(c) };
    case 'tiff': return { ext: 'tif', data: MP.enc.tiff(c, { dpi, meta: meta || {} }) };
    case 'tiff-cmyk': return { ext: 'tif', data: MP.enc.tiff(c, { dpi, meta: meta || {}, cmyk: true }) };
    case 'pdf': return { ext: 'pdf', data: await MP.enc.pdf([{ canvas: c, dpi: dpi * (c.width / d.width) }], { meta: meta || {}, quality: q }) };
    case 'pdf-cmyk': return { ext: 'pdf', data: await MP.enc.pdf([{ canvas: c, dpi: dpi * (c.width / d.width) }], { meta: meta || {}, cmyk: true }) };
    default: return { ext: 'png', data: await MP.enc.png(c, { dpi, meta }) };
  }
};
const waitIdle = () => new Promise((r) => { const t = setInterval(() => { if (!UI.dialogOpen && !document.querySelector('#busy.show') && !document.querySelector('.liq')) { clearInterval(t); r(); } }, 120); });
MP.batch = {
  async run(v) {
    const files = await MP.native.openFiles({ multi: true, accept: 'image/*,.psd,.mpp', filters: [{ name: 'Images', extensions: [...IMAGE_EXT, 'psd', 'mpp'] }] }); if (!files.length) return;
    let dir = null; if (MP.native.pickFolder) { MP.toast('Choisissez le dossier de destination'); dir = await MP.native.pickFolder(); if (!dir) return; }
    const out = [], action = v.action >= 0 ? MP.actions.list[v.action] : null; let done = 0, fail = 0;
    for (const f of files) {
      try {
        const before = MP.docs.length; await MP.io.openFile(f); if (MP.docs.length === before) { fail++; continue; }
        const d = MP.doc; if (action) { for (const step of action.steps) { const act = MP.actions.find(step); if (act) { await act(); await waitIdle(); } } }
        const r = await MP.encodeDoc(d, v), name = f.name.replace(/\.[^.]+$/, '') + (v.suffix || '') + '.' + r.ext;
        if (dir) await MP.native.writeFile(dir + (dir.includes('\\') ? '\\' : '/') + name, r.data); else out.push({ name, data: r.data });
        d.dirty = false; await MP.ui.closeDoc(d); done++;
      } catch (e) { console.warn(e); fail++; }
    }
    if (out.length) MP.outFiles(out, 'traitement-par-lots');
    MP.toast(`Traitement par lots terminé : ${done} fichier(s)` + (fail ? `, ${fail} échec(s)` : ''), 5000);
  },
};
MP.parseCSV = (txt) => {
  const rows = []; let row = [], cell = '', q = false; txt = txt.replace(/\r\n?/g, '\n'); const sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : txt.includes('\t') ? '\t' : ',';
  for (let i = 0; i < txt.length; i++) { const ch = txt[i]; if (q) { if (ch === '"' && txt[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; } else if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
};
MP.dataSets = {
  vars(d) { const v = new Set(); for (const l of d.layers) { if (l.text) { v.add(l.name); (l.text.content.match(/\{\{\s*([^}]+?)\s*\}\}/g) || []).forEach((m) => v.add(m.replace(/[{}\s]/g, ''))); } else if (!l.isGroup && !l.adjust) v.add(l.name); } return [...v]; },
  async generate(csv, v) {
    const d = MP.doc, rows = MP.parseCSV(csv); if (rows.length < 2) { MP.toast('Le tableau doit contenir une ligne d\'en-têtes et au moins une ligne de données'); return; }
    const head = rows[0].map((h) => h.trim()), texts = d.layers.filter((l) => l.text), keep = texts.map((l) => l.text.content), vis = d.layers.map((l) => l.visible), files = [];
    await MP.busy('Génération des visuels…', async () => {
      for (const [ri, r] of rows.slice(1).entries()) {
        const val = Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']));
        texts.forEach((l, i) => { let c = keep[i]; if (l.name in val) c = val[l.name]; c = c.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, k) => (k in val ? val[k] : m)); l.text.content = c; MP.renderText(l); });
        d.layers.forEach((l, i) => { if (l.name in val && !l.text) { const s = String(val[l.name]).toLowerCase(); l.visible = /^(oui|vrai|true|1|visible|x)$/.test(s) ? true : /^(non|faux|false|0|masqué|masque|-)$/.test(s) ? false : vis[i]; } });
        d.rev++; const res = await MP.encodeDoc(d, v), base = (v.nameCol && val[v.nameCol] ? val[v.nameCol] : (d.name.replace(/\.[^.]+$/, '') + '_' + String(ri + 1).padStart(3, '0'))).replace(/[\\/:*?"<>|]/g, '_');
        files.push({ name: base + '.' + res.ext, data: res.data });
      }
    });
    texts.forEach((l, i) => { l.text.content = keep[i]; MP.renderText(l); }); d.layers.forEach((l, i) => (l.visible = vis[i])); MP.render();
    MP.outFiles(files, 'jeux-de-donnees');
  },
};
MP.scripts = {
  run(code, name = 'script') {
    try { const r = new Function('MP', 'UI', 'doc', 'toast', '"use strict";\n' + code)(MP, UI, MP.doc, MP.toast); if (r && r.then) r.catch((e) => MP.toast('Erreur dans ' + name + ' : ' + e.message, 6000)); MP.render(); MP.ui.refreshAll(); return r; }
    catch (e) { MP.toast('Erreur dans ' + name + ' : ' + e.message, 6000); }
  },
  async open() { const f = (await MP.native.openFiles({ multi: false, accept: '.js,.jsx', filters: [{ name: 'Scripts', extensions: ['js', 'jsx'] }] }))[0]; if (f) this.run(new TextDecoder().decode(f.data), f.name); },
};

/* =================== Stockage local (IndexedDB) : sauvegarde automatique, versions, bibliothèques =================== */
MP.idb = {
  db() { return (this._db = this._db || new Promise((res, rej) => { const r = indexedDB.open('multipify-photo', 2); r.onupgradeneeded = () => { for (const s of ['autosave', 'versions', 'library', 'profiles']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'key' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async tx(store, mode, fn) { const db = await this.db(); return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); },
  put(store, val) { return this.tx(store, 'readwrite', (s) => s.put(val)); },
  del(store, key) { return this.tx(store, 'readwrite', (s) => s.delete(key)); },
  all(store) { return this.tx(store, 'readonly', (s) => s.getAll()); },
};
MP.autosave = {
  start() { clearInterval(this.t); const m = MP.prefs.autosaveMin ?? 3; if (!m) return; this.t = setInterval(() => this.tick(), m * 60000); },
  async tick() {
    if (UI.dialogOpen || document.querySelector('#busy.show') || MP.live) return;
    for (const d of MP.docs) if (d.dirty) { d.uid = d.uid || 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); try { await MP.idb.put('autosave', { key: d.uid, name: d.name, time: Date.now(), data: MP.io.serialize(d) }); MP.ui.flash && MP.ui.flash('Sauvegarde automatique'); } catch (e) { console.warn(e); } }
  },
  async clear(d) { if (d && d.uid) try { await MP.idb.del('autosave', d.uid); } catch (_) { /* */ } },
  async recover() {
    let list = []; try { list = (await MP.idb.all('autosave')) || []; } catch (_) { return; } if (!list.length) return;
    list.sort((a, b) => b.time - a.time);
    MP.ui.dialog({ title: 'Récupération après une fermeture inattendue', width: 480, okLabel: 'Récupérer', cancelLabel: 'Ignorer et supprimer',
      fields: [{ type: 'info', html: `<p>Des documents non enregistrés ont été sauvegardés automatiquement :</p><ul>${list.map((e) => `<li><b>${esc(e.name)}</b> — ${new Date(e.time).toLocaleString('fr-FR')}</li>`).join('')}</ul>` }], values: {},
      onOk: async () => { for (const e of list) { await MP.io.openProject({ name: e.name.replace(/\.[^.]+$/, '') + ' (récupéré).mpp', path: null, data: new TextEncoder().encode(e.data) }); MP.doc.dirty = true; MP.doc.uid = e.key; } MP.ui.refreshTabs(); },
      onCancel: () => { list.forEach((e) => MP.idb.del('autosave', e.key)); } });
  },
};
MP.versions = {
  async add(d) { const data = MP.io.serialize(d), name = d.name; try { await MP.idb.put('versions', { key: name + '|' + Date.now(), name, path: d.filePath || null, time: Date.now(), size: data.length, data }); const all = (await MP.idb.all('versions')).filter((v) => v.name === name).sort((a, b) => b.time - a.time); for (const v of all.slice(15)) await MP.idb.del('versions', v.key); } catch (e) { console.warn(e); } },
  async list(name) { try { return ((await MP.idb.all('versions')) || []).filter((v) => !name || v.name === name).sort((a, b) => b.time - a.time); } catch (_) { return []; } },
  open(v) { return MP.io.openProject({ name: v.name.replace(/\.[^.]+$/, '') + ' (version du ' + new Date(v.time).toLocaleString('fr-FR').replace(/[/:]/g, '-') + ').mpp', path: null, data: new TextEncoder().encode(v.data) }); },
};
{
  const sv = MP.io.save.bind(MP.io);
  MP.io.save = async (as) => { const d = MP.doc, ok = await sv(as); if (ok && d) { MP.autosave.clear(d); if (MP.prefs.versions !== false) MP.versions.add(d); } return ok; };
  const cd = UI.closeDoc; UI.closeDoc = async (d) => { const r = await cd(d); if (!MP.docs.includes(d)) MP.autosave.clear(d); return r; };
}

/* =================== Objets dynamiques liés, polices manquantes =================== */
Object.assign(MP.smart, {
  async placeLinked() {
    const d = MP.doc, f = (await MP.native.openFiles({ multi: false, accept: 'image/*', filters: [{ name: 'Images', extensions: IMAGE_EXT }] }))[0]; if (!f) return;
    const c = await MP.io.loadImage(f.data, f.name), k = Math.min(1, (d.width * 0.8) / c.width, (d.height * 0.8) / c.height);
    d.history.record('Importer et lier', null); const l = d.addLayer(f.name.replace(/\.[^.]+$/, ''));
    l.smart = { src: c, m: { cx: d.width / 2, cy: d.height / 2, sx: k, sy: k, angle: 0 }, filters: [], link: f.path || null }; this.update(l); MP.afterEdit();
    MP.toast(f.path ? 'Objet dynamique lié à ' + f.path : 'Objet dynamique importé (le lien vers le fichier n\'est disponible que dans l\'application installée)', 4500);
  },
  async updateLinked(all = false) {
    const d = MP.doc, list = all ? d.layers.filter((l) => l.smart && l.smart.link) : [d.layer].filter((l) => l.smart && l.smart.link);
    if (!list.length) { MP.toast('Aucun objet dynamique lié'); return; } let n = 0;
    for (const l of list) { const f = await MP.native.readFile(l.smart.link); if (!f) { MP.toast('Fichier lié introuvable : ' + l.smart.link, 5000); continue; } const c = await MP.io.loadImage(f.data, f.name || l.smart.link), o = l.smart.src; if (!n) d.history.record('Mettre à jour le contenu lié', list.map((x) => x.id)); const k = Math.min(o.width / c.width, o.height / c.height); l.smart.m.sx *= k; l.smart.m.sy *= k; l.smart.src = c; this.update(l); n++; }
    MP.afterEdit(); if (n) MP.toast(n + ' contenu(s) lié(s) mis à jour');
  },
  embed() { const l = MP.doc.layer; if (l.smart && l.smart.link) { MP.doc.history.record('Incorporer', null); l.smart.link = null; MP.toast('Le contenu est maintenant incorporé au document'); } },
});
MP.fontAvailable = (font) => {
  const c = (MP._fc = MP._fc || MP.createCanvas(10, 10)).getContext('2d'), s = 'mmmmmmmmmmlli WQ@#';
  return ['monospace', 'serif', 'sans-serif'].some((g) => { c.font = '40px ' + g; const a = c.measureText(s).width; c.font = `40px "${font}", ${g}`; return Math.abs(c.measureText(s).width - a) > 0.5; });
};
MP.fontCheck = (d) => { const miss = [...new Set(d.layers.filter((l) => l.text).map((l) => l.text.font))].filter((f) => f && !MP.fontAvailable(f)); if (miss.length) MP.toast('Police(s) manquante(s), remplacée(s) à l\'affichage : ' + miss.join(', '), 7000); return miss; };

/* =================== Texte : paragraphe, sur tracé, déformation, crénage, petites capitales =================== */
MP.TEXT_WARPS = [['none', 'Sans'], ['arc', 'Arc'], ['arch', 'Arche'], ['bulge', 'Renflement'], ['flag', 'Drapeau'], ['wave', 'Vague'], ['rise', 'Montée'], ['fish', 'Poisson'], ['squeeze', 'Contraction']];
{
  const rt0 = MP.renderText;
  const pathPoints = (t) => {
    const P = t.pathPts; if (!P || P.length < 2) return null; const seg = [], len = [0];
    for (let i = 1; i < P.length; i++) { const L = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(L); len.push(len[i - 1] + L); }
    return { at(s) { s = MP.clamp(s, 0, len[len.length - 1]); let i = 1; while (i < len.length - 1 && len[i] < s) i++; const f = seg[i - 1] ? (s - len[i - 1]) / seg[i - 1] : 0, a = P[i - 1], b = P[i]; return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; }, total: len[len.length - 1] };
  };
  MP.renderText = (l) => {
    const t = l.text; if (!t) return;
    const c = l.ctx; try { c.fontKerning = t.kern === 'none' ? 'none' : 'normal'; c.fontVariantCaps = t.caps || 'normal'; } catch (_) { /* */ }
    const P = t.pathPts && pathPoints(t);
    if (P) {
      c.clearRect(0, 0, l.canvas.width, l.canvas.height); c.save(); c.font = MP.textFont(t); c.textBaseline = 'alphabetic'; c.textAlign = 'center';
      try { c.letterSpacing = (t.spacing || 0) + 'px'; } catch (_) { /* */ }
      const s = String(t.content).replace(/\n/g, ' '), total = c.measureText(s).width; let acc = t.align === 'center' ? (P.total - total) / 2 : t.align === 'right' ? P.total - total : ((t.pathOffset || 0) / 100) * P.total;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const ch of s) { const w = c.measureText(ch).width + (t.spacing || 0), q = P.at(acc + w / 2); acc += w; if (acc > P.total + w) break; c.save(); c.translate(q.x, q.y); c.rotate(q.ang); c.translate(0, -(t.baseShift || 0)); if (t.stroke && t.strokeWidth > 0) { c.lineJoin = 'round'; c.lineWidth = t.strokeWidth * 2; c.strokeStyle = t.strokeColor; c.strokeText(ch, 0, 0); } c.fillStyle = t.color; c.fillText(ch, 0, 0); c.restore(); x0 = Math.min(x0, q.x - t.size); y0 = Math.min(y0, q.y - t.size); x1 = Math.max(x1, q.x + t.size); y1 = Math.max(y1, q.y + t.size); }
      c.restore(); l._v = (l._v || 0) + 1; t._b = isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: t.x, y: t.y, w: 10, h: 10 }; return;
    }
    if (t.boxW > 0 && !t.vertical && !t.arc) {
      c.save(); c.font = MP.textFont(t); try { c.letterSpacing = (t.spacing || 0) + 'px'; } catch (_) { /* */ }
      const out = []; for (const para of String(t.content).split('\n')) { const words = para.split(/(\s+)/); let line = ''; for (const w of words) { const test = line + w; if (line && c.measureText(test.trimEnd()).width > t.boxW) { out.push(line.trimEnd()); line = w.trimStart(); } else line = test; } out.push(line.trimEnd()); }
      c.restore();
      const keep = t.content, kx = t.x, w = Math.max(...out.map((s) => { c.save(); c.font = MP.textFont(t); const m = c.measureText(s).width; c.restore(); return m; }), 1);
      t.content = out.join('\n'); if (t.align === 'center') t.x = kx + (t.boxW - w) / 2; else if (t.align === 'right') t.x = kx + t.boxW - w;
      try { rt0(l); } finally { t.content = keep; t.x = kx; }
      t._b = { ...t._b, x: kx, w: t.boxW };
    } else rt0(l);
    const wp = t.warp; if (wp && wp.style && wp.style !== 'none' && wp.bend && t._b) {
      const b = t._b, pad = Math.ceil(Math.abs(wp.bend) / 100 * b.h * 1.2 + 4), R = { x: Math.floor(b.x - 4), y: Math.floor(b.y - pad), w: Math.ceil(b.w + 8), h: Math.ceil(b.h + pad * 2) };
      const src = MP.createCanvas(R.w, R.h); src.getContext('2d').drawImage(l.canvas, -R.x, -R.y);
      const k = wp.bend / 100, cy = R.h / 2, H2 = b.h / 2;
      const out = remap(src, (x, y) => {
        const u = MP.clamp((x - 4) / Math.max(1, b.w), 0, 1), s = u * 2 - 1, v = (y - cy) / Math.max(1, H2); let dy = 0, sy = 1;
        switch (wp.style) {
          case 'arc': dy = -k * H2 * 1.5 * (1 - s * s); break;
          case 'arch': dy = -k * H2 * 1.5 * (1 - s * s) * (1 - v) * 0.5; sy = 1 + k * (1 - s * s) * 0.5; break;
          case 'bulge': sy = 1 + k * (1 - s * s); break;
          case 'squeeze': sy = 1 - k * 0.6 * (1 - s * s); break;
          case 'flag': dy = k * H2 * Math.sin(u * Math.PI * 2); break;
          case 'wave': dy = k * H2 * Math.sin(u * Math.PI * 2) * v; sy = 1; break;
          case 'rise': dy = -k * H2 * s; break;
          case 'fish': dy = -k * H2 * (1 - s * s) * v * 0.8; sy = 1 + k * 0.3 * (1 - s * s); break;
        }
        return [x, cy + (y - cy - dy) / sy];
      });
      l.ctx.clearRect(R.x, R.y, R.w, R.h); l.ctx.drawImage(out, R.x, R.y); t._b = { x: R.x, y: R.y, w: R.w, h: R.h };
    }
  };
  MP.textOnPath = () => {
    const d = MP.doc; if (!d.path || !d.path.pts || d.path.pts.length < 2) { MP.toast('Tracez d\'abord un tracé avec la Plume (P), puis relancez la commande'); return; }
    const p2d = MP.pathToPath2D(d.path), pts = []; const c = MP.createCanvas(4, 4).getContext('2d'); void c;
    // échantillonnage du tracé par ses segments de Bézier
    const P = d.path.pts; for (let i = 0; i < P.length - 1 + (d.path.closed ? 1 : 0); i++) { const a = P[i], b = P[(i + 1) % P.length], c1 = { x: a.ox ?? a.x, y: a.oy ?? a.y }, c2 = { x: b.ix ?? b.x, y: b.iy ?? b.y }; for (let k = 0; k < 24; k++) { const t = k / 24, mt = 1 - t; pts.push([mt ** 3 * a.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * b.x, mt ** 3 * a.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * b.y]); } }
    const last = P[d.path.closed ? 0 : P.length - 1]; pts.push([last.x, last.y]); void p2d;
    const l = d.layer && d.layer.text ? d.layer : null;
    d.history.record('Texte sur un tracé', null);
    const L = l || d.addLayer('Texte sur tracé'); if (!l) { const o = MP.tools.text.opts; L.text = { x: pts[0][0], y: pts[0][1], content: 'Votre texte sur le tracé', font: o.font, size: Math.max(12, Math.round(+o.size / 2)), bold: o.bold, italic: o.italic, underline: false, color: MP.colors.fg, align: 'left', lineHeight: 1.2, spacing: 0, stroke: false, strokeColor: '#ffffff', strokeWidth: 2, shadow: false }; }
    L.text.pathPts = pts; L.text.arc = 0; L.text.vertical = false; MP.renderText(L); MP.afterEdit(); MP.ui.textDialog(L, false);
  };
}

/* =================== Masques vectoriels et opérations de tracés =================== */
MP.pathMask = (d, path) => { const m = MP.createCanvas(d.width, d.height), x = m.getContext('2d'); x.fillStyle = '#fff'; x.fill(MP.pathToPath2D(path), 'evenodd'); return m; };
MP.vmask = {
  fromPath() {
    const d = MP.doc, l = d.layer; if (!d.path || !d.path.pts || d.path.pts.length < 3) { MP.toast('Tracez d\'abord une forme fermée avec la Plume (P)'); return; }
    d.history.record('Masque vectoriel', [l.id]); l.vmask = JSON.parse(JSON.stringify(d.path)); l.mask = MP.pathMask(d, l.vmask); l.maskEnabled = true; MP.afterEdit(); MP.toast('Masque vectoriel ajouté — Calque > Masque vectoriel > Modifier le tracé pour le retoucher');
  },
  edit() { const d = MP.doc, l = d.layer; if (!l.vmask) { MP.toast('Ce calque n\'a pas de masque vectoriel'); return; } d.path = JSON.parse(JSON.stringify(l.vmask)); MP.setTool('pen'); MP.render(); MP.toast('Modifiez le tracé, puis Calque > Masque vectoriel > Mettre à jour'); },
  update() { const d = MP.doc, l = d.layer; if (!d.path) { MP.toast('Aucun tracé'); return; } d.history.record('Mettre à jour le masque vectoriel', [l.id]); l.vmask = JSON.parse(JSON.stringify(d.path)); l.mask = MP.pathMask(d, l.vmask); l.maskEnabled = true; MP.afterEdit(); },
  remove() { const d = MP.doc, l = d.layer; if (!l.vmask) return; d.history.record('Supprimer le masque vectoriel', [l.id]); l.vmask = null; l.mask = null; MP.afterEdit(); },
};
MP.pathToSelection = (path, mode = 'new') => { const d = MP.doc; d.history.record('Tracé → sélection', null); MP.sel.fromMask(d, MP.pathMask(d, path), mode); MP.ui.refreshAll(); MP.render(); };

/* =================== Variations génératives =================== */
{
  const ed0 = MP.ai.edit.bind(MP.ai);
  MP.ai.edit = (src, mask, prompt, extra = {}) => ed0(src, mask, prompt, { n: MP.ai._n || 1, ...extra });
  const gf0 = MP.ai.generativeFill.bind(MP.ai);
  MP.ai.generativeFill = async (prompt) => {
    const d = MP.doc, b = d && MP.sel.bounds(d); MP.ai._n = Math.max(1, Math.min(4, MP.prefs.aiVariants ?? 3));
    const before = d ? d.layers.length : 0;
    try { await gf0(prompt); } finally { MP.ai._n = 1; }
    const l = d && d.layers.length > before ? d.layer : null;
    if (l && MP.ai._lastAll && MP.ai._lastAll.length > 1 && b) {
      const m = Math.round(Math.max(32, Math.max(b.w, b.h) * 0.35)), R = { x: Math.max(0, b.x - m), y: Math.max(0, b.y - m) }; R.w = Math.min(d.width, b.x + b.w + m) - R.x; R.h = Math.min(d.height, b.y + b.h + m) - R.y;
      l.genVars = MP.ai._lastAll.slice(); l.genRect = R; l.genSel = 0; MP.ui.showPanel && MP.ui.showPanel('panel-props'); MP.toast(l.genVars.length + ' variations générées — choisissez-en une dans le panneau Propriétés', 5000);
    }
    MP.ai._lastAll = null;
  };
  MP.ai.pickVariant = (l, i) => { const d = MP.doc, R = l.genRect, v = l.genVars && l.genVars[i]; if (!v) return; d.history.record('Variation générative', [l.id]); l.ctx.clearRect(R.x, R.y, R.w, R.h); l.ctx.imageSmoothingQuality = 'high'; l.ctx.drawImage(v, R.x, R.y, R.w, R.h); l.genSel = i; MP.afterEdit(); };
}

/* =================== Bibliothèques =================== */
MP.library = {
  async items() { try { return ((await MP.idb.all('library')) || []).sort((a, b) => a.time - b.time); } catch (_) { return []; } },
  async add(type) {
    const d = MP.doc, l = d && d.layer, key = type + '|' + Date.now(); let item = null;
    if (type === 'color') item = { key, type, name: MP.colors.fg, data: MP.colors.fg };
    else if (!d) { MP.toast('Ouvrez un document'); return; }
    else if (type === 'graphic') { const b = MP.alphaBounds(l.canvas, 2); if (!b || l.isGroup || l.adjust) { MP.toast('Sélectionnez un calque avec du contenu'); return; } const c = MP.createCanvas(b.w, b.h); c.getContext('2d').drawImage(MP.fx.has(l) ? MP.fx.render(d, l, l.canvas) : l.canvas, -b.x, -b.y); item = { key, type, name: l.name, data: c.toDataURL('image/png') }; }
    else if (type === 'style') { if (!MP.fx.has(l)) { MP.toast('Le calque actif n\'a pas de style'); return; } item = { key, type, name: 'Style de ' + l.name, data: JSON.parse(JSON.stringify(l.fx)) }; }
    else if (type === 'text') { if (!l.text) { MP.toast('Sélectionnez un calque de texte'); return; } const { font, size, bold, italic, color, spacing, lineHeight, stroke, strokeColor, strokeWidth, shadow } = l.text; item = { key, type, name: `${font} ${size}px`, data: { font, size, bold, italic, color, spacing, lineHeight, stroke, strokeColor, strokeWidth, shadow } }; }
    item.time = Date.now(); await MP.idb.put('library', item); MP.ui.refreshLibrary && MP.ui.refreshLibrary(); MP.toast('Ajouté à la bibliothèque');
  },
  async use(it) {
    const d = MP.doc;
    if (it.type === 'color') { MP.colors.fg = it.data; MP.ui.refreshColors(); return; }
    if (!d) { MP.toast('Ouvrez un document'); return; }
    if (it.type === 'graphic') { const im = new Image(); im.src = it.data; await im.decode(); const c = MP.createCanvas(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); const k = Math.min(1, (d.width * 0.8) / c.width, (d.height * 0.8) / c.height); d.history.record('Graphique de bibliothèque', null); const l = d.addLayer(it.name); l.smart = { src: c, m: { cx: d.width / 2, cy: d.height / 2, sx: k, sy: k, angle: 0 }, filters: [] }; MP.smart.update(l); MP.afterEdit(); return; }
    const l = d.layer;
    if (it.type === 'style') { if (l.isGroup || l.adjust) return; d.history.record('Style de bibliothèque', null); l.fx = JSON.parse(JSON.stringify(it.data)); MP.afterEdit(); }
    if (it.type === 'text') { if (!l.text) { MP.toast('Sélectionnez un calque de texte'); return; } d.history.record('Style de caractère', null); Object.assign(l.text, it.data); MP.renderText(l); MP.afterEdit(); }
  },
  async remove(it) { await MP.idb.del('library', it.key); MP.ui.refreshLibrary && MP.ui.refreshLibrary(); },
};
