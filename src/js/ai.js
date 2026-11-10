'use strict';
/* Fonctions IA : remplissage génératif, extension générative, génération d'image, détourage, sélection du sujet.
   Utilise l'API Images d'OpenAI (clé configurée dans Édition > Préférences). */

MP.prefs = Object.assign({ aiKey: '', aiModel: 'gpt-image-1', aiQuality: 'medium', historyLimit: 40, rulers: true }, (() => { try { return JSON.parse(localStorage.getItem('mp.prefs') || '{}'); } catch (_) { return {}; } })());
MP.savePrefs = () => { try { localStorage.setItem('mp.prefs', JSON.stringify(MP.prefs)); } catch (_) { /* stockage indisponible */ } };

const b64ToBytes = (b64) => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
const canvasPng = (c) => new Promise((r) => c.toBlob(async (b) => r(new Uint8Array(await b.arrayBuffer())), 'image/png'));

MP.ai = {
  ready() {
    if (MP.prefs.aiKey) return true;
    MP.toast('Ajoutez votre clé API dans Édition > Préférences > IA', 4000);
    MP.ui.dialogs.prefs('ai'); return false;
  },
  size(w, h) { const r = w / h; return r > 1.25 ? [1536, 1024] : r < 0.8 ? [1024, 1536] : [1024, 1024]; },
  async request(endpoint, { json, form }) {
    const req = { url: 'https://api.openai.com/v1/images/' + endpoint, key: MP.prefs.aiKey, json, form };
    let res;
    if (MP.native.aiRequest) res = await MP.native.aiRequest(req);
    else {
      const headers = { Authorization: 'Bearer ' + req.key }; let body;
      if (form) { body = new FormData(); for (const [k, v] of Object.entries(form)) { if (v && v.data) body.append(k, new Blob([v.data], { type: v.type }), v.filename); else body.append(k, String(v)); } }
      else { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
      const r = await fetch(req.url, { method: 'POST', headers, body }); res = { ok: r.ok, status: r.status, text: await r.text() };
    }
    let j = null; try { j = JSON.parse(res.text); } catch (_) { /* réponse non JSON */ }
    if (!res.ok) { const msg = j && j.error ? j.error.message : `erreur ${res.status}`; throw new Error(res.status === 401 ? 'clé API invalide' : msg); }
    const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
    if (!b64) throw new Error('réponse inattendue du service IA');
    MP.ai._lastAll = j.data.length > 1 ? await Promise.all(j.data.filter((x) => x.b64_json).map((x) => MP.io.loadImage(b64ToBytes(x.b64_json), 'ia.png'))) : null;
    return MP.io.loadImage(b64ToBytes(b64), 'ia.png');
  },
  async run(label, fn) {
    if (!MP.ai.ready()) return;
    try { return await MP.busy(label + ' — l\'IA travaille (10 à 60 s)…', fn); }
    catch (e) { const m = /fetch|network|ERR_/i.test(e.message) ? 'connexion au service impossible — vérifiez votre accès Internet' : e.message; MP.toast('IA : ' + m, 6000); }
  },
  async edit(source, mask, prompt, extra = {}) {
    const [SW, SH] = this.size(source.width, source.height);
    const img = MP.createCanvas(SW, SH), ic = img.getContext('2d'); ic.imageSmoothingQuality = 'high'; ic.drawImage(source, 0, 0, SW, SH);
    const form = { model: MP.prefs.aiModel, prompt, size: `${SW}x${SH}`, n: 1, quality: MP.prefs.aiQuality, image: { data: await canvasPng(img), type: 'image/png', filename: 'image.png' }, ...extra };
    if (mask) { const m = MP.createCanvas(SW, SH), mc = m.getContext('2d'); mc.drawImage(mask, 0, 0, SW, SH); form.mask = { data: await canvasPng(m), type: 'image/png', filename: 'mask.png' }; }
    return this.request('edits', { form });
  },

  /** Remplissage génératif dans la sélection → nouveau calque masqué. */
  generativeFill(prompt) {
    const d = MP.doc; if (!d) return;
    const b = MP.sel.bounds(d); if (!b) { MP.toast('Faites d\'abord une sélection (lasso, rectangle…) autour de la zone à remplir'); return; }
    return this.run('Remplissage génératif', async () => {
      const m = Math.round(Math.max(32, Math.max(b.w, b.h) * 0.35));
      const R = { x: Math.max(0, b.x - m), y: Math.max(0, b.y - m) }; R.w = Math.min(d.width, b.x + b.w + m) - R.x; R.h = Math.min(d.height, b.y + b.h + m) - R.y;
      const src = MP.createCanvas(R.w, R.h); src.getContext('2d').drawImage(d.composite(null, { noLive: true }), -R.x, -R.y);
      const mask = MP.createCanvas(R.w, R.h), mc = mask.getContext('2d'); mc.fillStyle = '#000'; mc.fillRect(0, 0, R.w, R.h);
      mc.globalCompositeOperation = 'destination-out'; for (let a = 0; a < 8; a++) mc.drawImage(d.selection, -R.x + Math.cos(a) * 4, -R.y + Math.sin(a) * 4);
      const p = prompt && prompt.trim() ? prompt.trim() + '. Photorealistic, seamlessly blended with the surrounding image (lighting, perspective, grain).' : 'Fill the masked area naturally so it blends seamlessly with the surroundings, remove any object there, same lighting, perspective and texture.';
      const out = await this.edit(src, mask, p);
      d.history.record('Remplissage génératif', null);
      const l = d.addLayer('Génératif : ' + (prompt || 'remplissage').slice(0, 28));
      l.ctx.imageSmoothingQuality = 'high'; l.ctx.drawImage(out, R.x, R.y, R.w, R.h);
      l.mask = MP.sel.blurred(d.selection, 2); l.maskEnabled = true;
      MP.sel.none(d); MP.afterEdit(); MP.ui.refreshAll(); MP.toast('Calque génératif ajouté — son masque peut être retouché');
    });
  },

  /** Agrandit la zone de travail et la remplit par IA. */
  generativeExpand(w, h, ax = 0.5, ay = 0.5, prompt = '') {
    const d = MP.doc; if (!d) return;
    if (w <= d.width && h <= d.height) { MP.toast('La nouvelle taille doit être plus grande'); return; }
    return this.run('Extension générative', async () => {
      const ow = d.width, oh = d.height;
      MP.canvasSize(w, h, ax, ay, 'transparent');
      const ox = Math.round((w - ow) * ax), oy = Math.round((h - oh) * ay);
      const src = MP.cloneCanvas(d.composite(null, { noLive: true }));
      const mask = MP.createCanvas(w, h), mc = mask.getContext('2d'); mc.fillStyle = '#000'; mc.fillRect(ox + 6, oy + 6, ow - 12, oh - 12);
      const out = await this.edit(src, mask, prompt || 'Extend the image naturally beyond its borders, continuing the scene seamlessly with the same style, lighting and perspective.');
      const l = d.addLayer('Extension générative', 0); l.parent = null;
      l.ctx.imageSmoothingQuality = 'high'; l.ctx.drawImage(out, 0, 0, w, h);
      const lm = MP.createCanvas(w, h), lc = lm.getContext('2d'); lc.fillStyle = '#fff'; lc.fillRect(0, 0, w, h); lc.filter = 'blur(4px)'; lc.globalCompositeOperation = 'destination-out'; lc.fillRect(ox + 8, oy + 8, ow - 16, oh - 16); lc.filter = 'none';
      l.mask = lm; d.normalize(); d.active = d.layers.indexOf(l); MP.afterEdit(); MP.ui.refreshAll();
    });
  },

  /** Génère une image à partir d'un texte → nouveau calque. */
  generate(prompt, format, transparent) {
    const d = MP.doc;
    return this.run('Génération d\'image', async () => {
      const size = format === 'landscape' ? '1536x1024' : format === 'portrait' ? '1024x1536' : '1024x1024';
      const json = { model: MP.prefs.aiModel, prompt, size, n: 1, quality: MP.prefs.aiQuality };
      if (transparent) json.background = 'transparent';
      const out = await this.request('generations', { json });
      if (!d) { const nd = MP.newDocument(out.width, out.height, 'Image IA', 'transparent'); nd.layer.ctx.drawImage(out, 0, 0); nd.layer.name = prompt.slice(0, 30); MP.afterEdit(); return; }
      d.history.record('Générer une image', null);
      const l = d.addLayer('IA : ' + prompt.slice(0, 28)), k = Math.min(d.width / out.width, d.height / out.height);
      l.ctx.imageSmoothingQuality = 'high'; l.ctx.drawImage(out, (d.width - out.width * k) / 2, (d.height - out.height * k) / 2, out.width * k, out.height * k);
      MP.afterEdit(); MP.ui.refreshAll();
    });
  },

  /** Masque (alpha) du sujet principal d'une toile, à la taille du document. */
  async subjectAlpha(source) {
    const d = MP.doc, b = MP.alphaBounds(source, 8) || { x: 0, y: 0, w: d.width, h: d.height };
    const crop = MP.createCanvas(b.w, b.h), cc = crop.getContext('2d'); cc.fillStyle = '#fff'; cc.fillRect(0, 0, b.w, b.h); cc.drawImage(source, -b.x, -b.y);
    const out = await this.edit(crop, null, 'Keep the main subject exactly identical (same pose, position, size and framing). Remove the entire background, transparent background.', { background: 'transparent' });
    const m = MP.createCanvas(d.width, d.height), mc = m.getContext('2d'); mc.imageSmoothingQuality = 'high';
    mc.drawImage(out, b.x, b.y, b.w, b.h); mc.globalCompositeOperation = 'source-in'; mc.fillStyle = '#fff'; mc.fillRect(0, 0, d.width, d.height);
    return m;
  },
  removeBackground() {
    const d = MP.doc; if (!d || !MP.canEditPixels()) return;
    const l = d.layer;
    return this.run('Suppression de l\'arrière-plan', async () => {
      const m = await this.subjectAlpha(d.layerStatic(l));
      d.history.record('Supprimer l\'arrière-plan', [l.id]); l.mask = m; l.maskEnabled = true; d.editMask = true;
      MP.afterEdit(); MP.ui.refreshAll(); MP.toast('Arrière-plan masqué — peignez sur le masque pour affiner');
    });
  },
  selectSubject() {
    const d = MP.doc; if (!d) return;
    return this.run('Sélection du sujet', async () => {
      const m = await this.subjectAlpha(MP.cloneCanvas(d.composite(null, { noLive: true })));
      d.history.record('Sélectionner le sujet', null); MP.sel.fromMask(d, m); MP.ui.refreshAll(); MP.render();
    });
  },
};
