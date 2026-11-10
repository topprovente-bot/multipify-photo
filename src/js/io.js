'use strict';
/* Fichiers : ouverture, enregistrement, export, import, presse-papiers, glisser-déposer */

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'ico', 'avif'];
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif' };

/* Pont natif (Electron) ou repli navigateur */
MP.native = window.native || {
  browser: true,
  openFiles({ accept, multi }) {
    return new Promise((resolve) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept || ''; inp.multiple = !!multi;
      inp.onchange = async () => resolve(await Promise.all([...inp.files].map(async (f) => ({ name: f.name, path: null, data: new Uint8Array(await f.arrayBuffer()) }))));
      inp.click();
    });
  },
  async saveFile({ defaultPath, data }) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = defaultPath; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); return defaultPath;
  },
  async writeFile(path, data) { return this.saveFile({ defaultPath: path.split(/[\\/]/).pop(), data }); },
  async readFile() { return null; },
  setDirty() {}, toggleFullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); },
  onOpenPaths() {}, quit() { window.close(); },
};
window.addEventListener('beforeunload', (e) => { if (MP.native.browser && MP.docs.some((d) => d.dirty)) { e.preventDefault(); e.returnValue = ''; } });

const ext = (name) => (name.split('.').pop() || '').toLowerCase();
const baseName = (name) => name.replace(/\.[^.]+$/, '');

MP.io = {
  recent() { try { return JSON.parse(localStorage.getItem('mp.recent') || '[]'); } catch (_) { return []; } },
  addRecent(path) { if (!path) return; try { const r = this.recent().filter((p) => p !== path); r.unshift(path); localStorage.setItem('mp.recent', JSON.stringify(r.slice(0, 10))); } catch (_) { /* stockage indisponible */ } },

  loadImage(bytes, name) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: MIME[ext(name)] || 'image/png' }));
      const img = new Image();
      img.onload = () => { const c = MP.createCanvas(img.naturalWidth || 800, img.naturalHeight || 600); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Format d\'image non reconnu')); };
      img.src = url;
    });
  },

  async openFile(f) {
    const e = ext(f.name);
    try {
      if (e === 'mpp') { await this.openProject(f); }
      else if (e === 'psd') { const d = await MP.busy('Ouverture du PSD…', () => MP.psd.toDoc(f.data, f.name)); d.sourcePath = f.path; MP.addDoc(d); MP.toast(`PSD ouvert : ${d.layers.length} calque(s)`); }
      else if (IMAGE_EXT.includes(e)) {
        const c = await this.loadImage(f.data, f.name);
        const d = new MP.Doc(c.width, c.height, f.name);
        const l = d.addLayer('Arrière-plan', 0); l.canvas = c;
        d.filePath = null; d.sourcePath = f.path; MP.addDoc(d);
      }
      else { MP.toast('Format non pris en charge : .' + e); return; }
      this.addRecent(f.path);
    } catch (err) { MP.toast('Impossible d\'ouvrir ' + f.name + ' : ' + err.message, 4000); }
  },

  async open() {
    const files = await MP.native.openFiles({ multi: true, accept: '.mpp,.psd,image/*', filters: [{ name: 'Images, PSD et projets', extensions: ['mpp', 'psd', ...IMAGE_EXT] }] });
    for (const f of files || []) await this.openFile(f);
  },
  async openRecent(path) {
    const f = await MP.native.readFile(path);
    if (!f) { MP.toast('Fichier introuvable : ' + path); return; }
    await this.openFile(f);
  },

  async place() {
    if (!MP.doc) return this.open();
    const files = await MP.native.openFiles({ multi: true, accept: 'image/*', filters: [{ name: 'Images', extensions: IMAGE_EXT }] });
    for (const f of files || []) {
      try {
        let c = await this.loadImage(f.data, f.name); const d = MP.doc;
        const k = Math.min(1, d.width / c.width, d.height / c.height);
        if (k < 1) { const s = MP.createCanvas(c.width * k, c.height * k); const sc = s.getContext('2d'); sc.imageSmoothingQuality = 'high'; sc.drawImage(c, 0, 0, s.width, s.height); c = s; }
        MP.edit.pasteCanvas(c, baseName(f.name));
      } catch (err) { MP.toast(err.message); }
    }
  },

  serialize(d) {
    return JSON.stringify({
      app: 'Multipify Photo', version: 4, width: d.width, height: d.height, active: d.active, guides: d.guides, notes: d.notes || [], counts: d.counts || [],
      layers: d.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked, maskEnabled: l.maskEnabled,
        parent: l.parent, isGroup: l.isGroup, collapsed: l.collapsed, adjust: l.adjust, fx: l.fx, clip: l.clip, lockAlpha: l.lockAlpha, label: l.label, fill: l.fill, lockPixels: l.lockPixels, lockPos: l.lockPos,
        smart: l.smart ? { src: l.smart.src.toDataURL('image/png'), m: l.smart.m, filters: l.smart.filters, link: l.smart.link || null } : null, blendIf: l.blendIf || null, vmask: l.vmask || null,
        text: l.text ? Object.fromEntries(Object.entries(l.text).filter(([k]) => k !== '_b')) : null,
        png: l.canvas.toDataURL('image/png'), mask: l.mask ? l.mask.toDataURL('image/png') : null })),
    });
  },
  async openProject(f) {
    const j = JSON.parse(new TextDecoder().decode(f.data));
    if (j.app !== 'Multipify Photo') throw new Error('fichier de projet invalide');
    const d = new MP.Doc(j.width, j.height, f.name);
    const load = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = MP.createCanvas(j.width, j.height); c.getContext('2d').drawImage(i, 0, 0); res(c); }; i.onerror = rej; i.src = url; });
    const idMap = new Map();
    for (const s of j.layers) {
      const l = new MP.Layer(j.width, j.height, s.name); idMap.set(s.id, l.id);
      Object.assign(l, { visible: s.visible, opacity: s.opacity, blend: s.blend, locked: s.locked, maskEnabled: s.maskEnabled !== false, text: s.text, isGroup: !!s.isGroup, collapsed: !!s.collapsed, adjust: s.adjust || null, fx: s.fx || null, clip: !!s.clip, lockAlpha: !!s.lockAlpha, label: s.label || null, fill: s.fill == null ? 1 : s.fill, lockPixels: !!s.lockPixels, lockPos: !!s.lockPos });
      if (s.smart) { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s.smart.src; }); const c = MP.createCanvas(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); l.smart = { src: c, m: s.smart.m, filters: s.smart.filters || [], link: s.smart.link || null }; }
      l.blendIf = s.blendIf || null; l.vmask = s.vmask || null;
      l._oldParent = s.parent || null;
      l.canvas = l.isGroup || l.adjust ? MP.createCanvas(1, 1) : await load(s.png); if (s.mask) l.mask = await load(s.mask);
      if (l.text) MP.renderText(l);
      d.layers.push(l);
    }
    for (const l of d.layers) { l.parent = l._oldParent ? idMap.get(l._oldParent) || null : null; delete l._oldParent; }
    d.guides = j.guides || []; d.notes = j.notes || []; d.counts = j.counts || []; d.normalize();
    d.active = MP.clamp(j.active || 0, 0, d.layers.length - 1);
    d.filePath = f.path; MP.addDoc(d);
  },
  async save(as) {
    const d = MP.doc; if (!d) return;
    const data = new TextEncoder().encode(this.serialize(d));
    let path = d.filePath;
    if (as || !path || MP.native.browser) {
      path = await MP.native.saveFile({ defaultPath: baseName(d.name) + '.mpp', filters: [{ name: 'Projet Multipify Photo', extensions: ['mpp'] }], data });
      if (!path) return false;
    } else await MP.native.writeFile(path, data);
    d.filePath = path; d.name = path.split(/[\\/]/).pop(); d.dirty = false; this.addRecent(path);
    MP.native.setDirty(MP.docs.some((x) => x.dirty)); MP.ui.refreshTabs(); MP.toast('Projet enregistré'); return true;
  },
  async savePsd() {
    const d = MP.doc; if (!d) return;
    const data = await MP.busy('Création du fichier PSD…', () => MP.psd.write(d));
    const path = await MP.native.saveFile({ defaultPath: baseName(d.name) + '.psd', filters: [{ name: 'Photoshop (PSD)', extensions: ['psd'] }], data });
    if (path) MP.toast(`PSD enregistré (${(data.length / 1048576).toFixed(1)} Mo)` + (d.layers.some((l) => l.adjust) ? ' — les calques de réglage ont été ignorés' : ''), 4000);
  },
  async exportImage(v) {
    const d = MP.doc; if (!d) return;
    const mime = v.format === 'jpeg' ? 'image/jpeg' : v.format === 'webp' ? 'image/webp' : 'image/png';
    const k = v.scale / 100, w = Math.max(1, Math.round(d.width * k)), h = Math.max(1, Math.round(d.height * k));
    const c = MP.createCanvas(w, h), x = c.getContext('2d');
    if (v.format === 'jpeg' || v.bg === 'white') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.imageSmoothingQuality = 'high'; x.drawImage(d.composite(null, { noLive: true }), 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, mime, v.quality / 100));
    const data = new Uint8Array(await blob.arrayBuffer());
    const e = v.format === 'jpeg' ? 'jpg' : v.format;
    const path = await MP.native.saveFile({ defaultPath: baseName(d.name) + '.' + e, filters: [{ name: v.format.toUpperCase(), extensions: [e] }], data });
    if (path) MP.toast(`Exporté (${(data.length / 1024).toFixed(0)} Ko)`);
  },
};

/* Glisser-déposer (la logique détaillée est dans v4.js : MP.dnd) */
window.addEventListener('dragover', (e) => { e.preventDefault(); if (MP.dnd) MP.dnd.over(e); });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
window.addEventListener('drop', async (e) => {
  e.preventDefault(); document.body.classList.remove('dropping');
  if (MP.dnd && (await MP.dnd.drop(e))) return;
  for (const file of [...(e.dataTransfer.files || [])]) await MP.io.openFile({ name: file.name, path: file.path || null, data: new Uint8Array(await file.arrayBuffer()) });
});

/* Collage d'images depuis le presse-papiers système */
window.addEventListener('paste', async (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (MP.edit.clip) { e.preventDefault(); MP.edit.paste(); return; }
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); const b = item.getAsFile(); const c = await MP.io.loadImage(new Uint8Array(await b.arrayBuffer()), 'collage.png'); MP.edit.pasteCanvas(c, 'Image collée'); }
});
// une copie faite dans un autre logiciel remplace le presse-papiers interne
window.addEventListener('blur', () => { if (MP.edit) MP.edit.clip = null; });
