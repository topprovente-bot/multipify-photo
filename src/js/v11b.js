'use strict';
/* v11 (2/3) — Nouvelles fonctions IA :
   - MP.ai.chat : modèle de langage avec vision (via la passerelle Multipify, réponse JSON)
   - Assistant IA : retouche en langage naturel (« rends la photo plus chaude et ajoute un titre ») → actions
     non destructives (calques de réglage, texte, recadrage, filtres, fonctions génératives), annulables en un clic
   - Retouche automatique IA, filtres neuronaux IA (styles, saisons, jour/nuit, éclairage, restauration)
   - Description de l'image (titre, texte alternatif, mots-clés), rédaction de textes, traduction des calques de texte */
{
  const AI = MP.ai;
  if (!MP.prefs.aiTextModel) MP.prefs.aiTextModel = 'gpt-5.4-mini';
  const LANG_NAMES = { fr: 'French', en: 'English', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', ru: 'Russian', zh: 'Simplified Chinese', ja: 'Japanese' };
  const uiLang = () => (MP.i18n && MP.i18n.lang) || 'fr';
  const langName = (c) => LANG_NAMES[c] || 'French';

  /** aperçu JPEG (data URL) limité à max px pour la vision */
  const preview = (c, max = 1024) => { const k = Math.min(1, max / Math.max(c.width, c.height)), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k)), t = MP.createCanvas(w, h), x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, w, h); return t.toDataURL('image/jpeg', 0.85); };
  const parseJson = (txt) => { const s = String(txt || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''); try { return JSON.parse(s); } catch (_) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1)); throw new Error('réponse IA illisible'); } };

  /** Appel au modèle de langage. messages : historique facultatif [{role, content}] */
  AI.chat = async ({ system, user, image = null, json = true, history = [], maxTokens = 4000 }) => {
    const content = image ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: preview(image), detail: 'high' } }] : user;
    const body = { model: MP.prefs.aiTextModel || 'gpt-5.4-mini', messages: [{ role: 'system', content: system }, ...history, { role: 'user', content }], max_completion_tokens: maxTokens };
    if (json) body.response_format = { type: 'json_object' };
    const send = async () => ({ ok: false, status: 503, text: '' }); // remplacé par la passerelle Multipify (licence.js)
    let res = await send(body);
    if (!res.ok && res.status === 400 && /response_format|max_completion_tokens/i.test(res.text)) { delete body.response_format; body.max_tokens = maxTokens; delete body.max_completion_tokens; res = await send(body); }
    let j = null; try { j = JSON.parse(res.text); } catch (_) { /* */ }
    if (!res.ok) { const msg = j && j.error ? j.error.message : `erreur ${res.status}`; throw new Error(res.status === 503 ? 'service IA indisponible' : msg); }
    const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!txt) throw new Error('réponse vide du modèle (' + body.model + ')');
    return json ? parseJson(txt) : txt;
  };
  const composite = () => MP.cloneCanvas(MP.doc.composite(null, { noLive: true }));
  const clampV = (f, v) => { if (f.type === 'range' || f.type === 'number') { const n = +v; if (!isFinite(n)) return undefined; return MP.clamp(n, f.min ?? -1e9, f.max ?? 1e9); } if (f.type === 'check') return !!v; if (f.type === 'color') return /^#[0-9a-f]{6}$/i.test(v) ? v : undefined; if (f.type === 'select') return (f.options || []).some(([o]) => String(o) === String(v)) ? (typeof f.options[0][0] === 'number' ? +v : v) : undefined; return undefined; };
  const cleanValues = (spec, vals) => { const out = {}; for (const f of spec.fields || []) if (f.k && vals && vals[f.k] !== undefined) { const c = clampV(f, vals[f.k]); if (c !== undefined) out[f.k] = c; } return out; };

  /* =================== Assistant IA =================== */
  const ADJ_KEYS = ['light', 'colorVibrance', 'clarity', 'grain', 'cameraRaw', 'brightness', 'exposure', 'vibrance', 'hueSat', 'colorBalance', 'blackWhite', 'photoFilter', 'shadowsHighlights', 'gradientMap', 'colorLookup', 'selectiveColor', 'posterize', 'threshold', 'invert', 'solidFill'];
  const FILTER_KEYS = ['gaussian', 'motion', 'unsharp', 'smartSharpen', 'noise', 'median', 'vignette', 'tiltShift', 'glow', 'oil', 'watercolor', 'sketch', 'charcoal', 'cutout', 'halftone', 'pixelate', 'filmGrain', 'skin', 'jpeg', 'dust', 'surface', 'pointillism', 'neon', 'lensBlur'];
  const fieldDoc = (spec) => (spec.fields || []).filter((f) => f.k).map((f) => f.type === 'range' || f.type === 'number' ? `${f.k}[${f.min}..${f.max}]` : f.type === 'select' ? `${f.k}(${f.options.map((o) => o[0]).join('|')})` : f.type === 'color' ? `${f.k}(#rrggbb)` : f.type === 'check' ? `${f.k}(bool)` : f.k).join(', ');
  MP.assistant = {
    sessions: new WeakMap(),
    schema() {
      const adj = ADJ_KEYS.filter((k) => MP.ADJUST[k]).map((k) => `  ${k} — ${MP.ADJUST[k].title}: ${fieldDoc(MP.ADJUST[k]) || '(no values)'}`).join('\n');
      const fil = FILTER_KEYS.filter((k) => MP.FILTERS[k]).map((k) => `  ${k} — ${MP.FILTERS[k].title}: ${fieldDoc(MP.FILTERS[k])}`).join('\n');
      const lut = MP.ADJUST.colorLookup && (MP.ADJUST.colorLookup.fields || []).find((f) => f.k === 'lut');
      return { adj, fil, luts: lut ? lut.options.map((o) => o[0]).join(', ') : '' };
    },
    system(only) {
      const s = this.schema(), d = MP.doc;
      return `You are the built-in editing assistant of Multipify Photo, a professional image editor (like Photoshop).
The user describes what they want in any language. Look at the attached preview if present, then answer ONLY with a JSON object:
{"message": "<short explanation for the user, in ${langName(uiLang())}>", "actions": [ ... ]}
Document: ${d.width}x${d.height}px, ${d.layers.length} layers, active layer "${d.layer.name}"${d.selection ? ', a selection is active' : ''}.
Allowed actions${only ? ' (ONLY these types: ' + only.join(', ') + ')' : ''}:
- {"type":"adjust","key":<adjustment>,"values":{...}} → adds a NON-destructive adjustment layer. Omitted values keep defaults. Adjustments (key — name: values[min..max]):
${s.adj}
  colorLookup lut options: ${s.luts}
- {"type":"filter","key":<filter>,"values":{...}} → applies a pixel filter to the active image layer. Filters:
${s.fil}
- {"type":"text","content":"...","size":<px>,"color":"#rrggbb","font":"Arial|Georgia|Impact|Verdana|Times New Roman|Arial Black|Segoe UI","bold":bool,"italic":bool,"position":"top|center|bottom|top-left|top-right|bottom-left|bottom-right","shadow":bool,"stroke":bool}
- {"type":"crop","ratio":"1:1|4:5|3:2|16:9|9:16|2:3|5:4"} (keeps the most important area)
- {"type":"rotate","deg":90|-90|180} ; {"type":"flip","dir":"h|v"} ; {"type":"resize","width":<px>} (keeps proportions)
- {"type":"ai","op":"removeBackground|selectSubject|colorize|generativeFill|neural","prompt":"<english prompt, for generativeFill (needs selection) or neural (restyle the whole image)>"}
- {"type":"ai","op":"retouch","ids":[<retouch ids>],"intensity":"subtle|medium|strong","prompt":"<optional extra english instruction>"} → targeted portrait/photo retouch (face, skin, eyes, teeth, hair, body, light, background), applied only to the detected face/person on a new masked layer. Retouch ids: ${MP.retouchAI ? MP.retouchAI.PRESETS.map((p) => p[0]).join(', ') : ''}
Rules: prefer subtle, natural, professional results unless asked otherwise; use as few actions as needed (usually 1-4);
for any portrait, face, skin, eyes, teeth, hair or body retouch (acne, wrinkles, dark circles, beard, slimming…) ALWAYS use op "retouch" with the matching ids (put anything not covered in "prompt"), never "neural";
prefer "cameraRaw" or "light"+"colorVibrance" for general photo corrections; never invent other keys; numbers only, no units.
If the request is impossible, return an empty actions array and explain why in "message".`;
    },
    async ask(prompt, { image = true, only = null } = {}) {
      const d = MP.doc, hist = this.sessions.get(d) || [];
      const r = await AI.chat({ system: this.system(only), user: prompt, image: image ? composite() : null, history: hist.slice(-6) });
      hist.push({ role: 'user', content: prompt }, { role: 'assistant', content: JSON.stringify(r).slice(0, 2000) }); this.sessions.set(d, hist);
      let acts = Array.isArray(r.actions) ? r.actions : []; if (only) acts = acts.filter((a) => only.includes(a.type));
      return { message: String(r.message || ''), actions: acts };
    },
    order: { crop: 0, rotate: 0, flip: 0, resize: 0, filter: 1, ai: 2, adjust: 3, text: 4 },
    async apply(actions) {
      const d = MP.doc, log = [], base = d.layer, n0 = d.history.undoStack.length;
      const acts = actions.slice(0, 12).sort((a, b) => (this.order[a.type] ?? 9) - (this.order[b.type] ?? 9));
      for (const a of acts) {
        try {
          if (a.type === 'adjust') {
            const spec = MP.ADJUST[a.key]; if (!spec || !ADJ_KEYS.includes(a.key)) throw new Error('réglage inconnu ' + a.key);
            const ed = UI.editAdjustLayer; UI.editAdjustLayer = () => {}; try { MP.layerOps.addAdjust(a.key); } finally { UI.editAdjustLayer = ed; }
            const l = MP.doc.layer; Object.assign(l.adjust.values, cleanValues(spec, a.values)); l.name = '✨ ' + spec.title; l._v = (l._v || 0) + 1; d.editMask = false; MP.afterEdit(); log.push('✓ ' + spec.title);
          } else if (a.type === 'filter') {
            const spec = MP.FILTERS[a.key]; if (!spec) throw new Error('filtre inconnu ' + a.key);
            const i = d.layers.indexOf(base); if (i >= 0) d.active = i; const l = d.layer;
            if (l.adjust || l.text || l.isGroup || l.smart) throw new Error('le calque actif n\'est pas un calque de pixels');
            const vals = { ...JSON.parse(JSON.stringify(spec.values || {})), ...cleanValues(spec, a.values) };
            d.history.record(spec.title, [l.id]); const out = MP.maskedResult(l.canvas, MP.applySpec(l.canvas, spec, vals)); l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height); l.ctx.drawImage(out, 0, 0); l._v = (l._v || 0) + 1; MP.afterEdit(); log.push('✓ ' + spec.title);
          } else if (a.type === 'text') {
            const l = MP.assistant.addText(d, a); log.push('✓ Texte « ' + l.text.content.slice(0, 40) + ' »');
          } else if (a.type === 'crop') {
            const m = String(a.ratio || '').match(/^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/); if (!m) throw new Error('format ' + a.ratio);
            const r = MP.smartCrop ? MP.smartCrop.best(d, +m[1], +m[2]) : null, rr = r || (() => { const k = Math.min(d.width / +m[1], d.height / +m[2]), w = Math.round(+m[1] * k), h = Math.round(+m[2] * k); return { x: (d.width - w) >> 1, y: (d.height - h) >> 1, w, h }; })();
            MP.cropDoc(rr.x, rr.y, rr.w, rr.h); MP.view.fit && MP.view.fit(); log.push(`✓ Recadrage ${a.ratio}`);
          } else if (a.type === 'rotate') { const g = [90, -90, 180, 270].includes(+a.deg) ? +a.deg : 90; MP.rotateImage(g); MP.view.fit && MP.view.fit(); log.push('✓ Rotation ' + g + '°'); }
          else if (a.type === 'flip') { MP.flipImage(a.dir !== 'v'); log.push('✓ Symétrie'); }
          else if (a.type === 'resize') { const w = Math.round(MP.clamp(+a.width || d.width, 16, 12000)), h = Math.max(1, Math.round(d.height * w / d.width)); MP.resizeImage(w, h, w > d.width ? 'details' : 'high'); MP.view.fit && MP.view.fit(); log.push(`✓ Taille ${w} × ${h}`); }
          else if (a.type === 'ai') {
            if (a.op === 'removeBackground') await AI.removeBackground(); else if (a.op === 'selectSubject') await AI.selectSubject(); else if (a.op === 'colorize') await AI.colorize();
            else if (a.op === 'generativeFill') await AI.generativeFill(a.prompt || ''); else if (a.op === 'neural') await MP.neuralAI.apply(a.prompt || '', '✨ Assistant')
            else if (a.op === 'retouch' && MP.retouchAI) { const ids = (Array.isArray(a.ids) ? a.ids : []).filter((i) => MP.retouchAI.find(i)); await MP.retouchAI.apply({ ids, intensity: ['subtle', 'medium', 'strong'].includes(a.intensity) ? a.intensity : 'medium', extra: a.prompt || '' }); } else throw new Error('opération IA inconnue ' + a.op);
            log.push('✓ IA : ' + a.op);
          } else throw new Error('action inconnue ' + a.type);
        } catch (e) { log.push('✗ ' + (a.type || '?') + ' : ' + e.message); }
      }
      MP.ui.refreshAll && MP.ui.refreshAll(); MP.render();
      return { log, steps: d.history.undoStack.length - n0 };
    },
    addText(d, a) {
      const W = d.width, H = d.height, size = MP.clamp(+a.size || Math.round(Math.min(W, H) / 10), 6, 2000);
      d.history.record('Texte (assistant IA)', null);
      const l = d.addLayer('✨ Texte'); l.parent = null;
      l.text = { x: 0, y: 0, content: String(a.content || 'Texte').slice(0, 2000), font: a.font || 'Arial', size, bold: !!a.bold, italic: !!a.italic, underline: false, color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#ffffff', align: 'center', lineHeight: 1.15, spacing: 0, stroke: !!a.stroke, strokeColor: '#000000', strokeWidth: Math.max(1, Math.round(size / 24)), shadow: a.shadow !== false };
      MP.renderText(l); const b = l.text._b || { w: size * 4, h: size }, m = Math.round(Math.min(W, H) * 0.05), p = String(a.position || 'center');
      l.text.x = /left/.test(p) ? m : /right/.test(p) ? W - b.w - m : Math.round((W - b.w) / 2);
      l.text.y = /^top/.test(p) ? m : /^bottom/.test(p) ? H - b.h - m : Math.round((H - b.h) / 2);
      if (/left/.test(p)) l.text.align = 'left'; else if (/right/.test(p)) l.text.align = 'right';
      MP.renderText(l); d.active = d.layers.indexOf(l); MP.afterEdit(); return l;
    },
    undo(steps) { for (let i = 0; i < steps; i++) (MP.undo ? MP.undo() : MP.doc.history.undo()); MP.ui.refreshAll && MP.ui.refreshAll(); MP.render(); },
    EXAMPLES: ['Rends la photo plus lumineuse et plus chaude, naturellement', 'Look cinéma bleu-orangé avec un léger grain', 'Noir et blanc contrasté', 'Recadre au format Instagram 4:5', 'Ajoute le titre « SOLDES -50 % » en haut, en blanc et gras', 'Ambiance coucher de soleil', 'Supprime l\'arrière-plan'],
    dialog(pre) {
      if (!MP.doc) return; const v = { p: pre || '', img: true };
      MP.ui.dialog({ title: '✨ Assistant IA', width: 560, okLabel: 'Exécuter', values: v,
        fields: [{ type: 'info', html: '<p>Décrivez la retouche souhaitée, dans votre langue. L\'assistant crée des calques de réglage non destructifs, du texte, un recadrage… Vous pouvez enchaîner les demandes (« encore un peu plus chaud »).</p>' },
          { k: 'p', label: 'Votre demande', type: 'textarea', rows: 3 }, { k: 'img', label: 'Joindre un aperçu de l\'image (meilleurs résultats)', type: 'check' }],
        body: (b) => { const row = el('div', { class: 'ai-ex' }); for (const ex of this.EXAMPLES) { const t = MP.i18n ? MP.i18n.t(ex) : ex, x = el('button', { class: 'btn small', type: 'button' }, esc(t)); x.onclick = (e) => { e.preventDefault(); v.p = t; const ta = b.querySelector('textarea'); if (ta) ta.value = t; }; row.appendChild(x); } b.appendChild(row); setTimeout(() => { const ta = b.querySelector('textarea'); ta && ta.focus(); }, 30); },
        onOk: (vals) => { const p = vals.p.trim(); if (!p) return false; setTimeout(() => this.run(p, { image: vals.img }), 30); } });
    },
    async run(prompt, opt = {}) {
      const d = MP.doc; if (!d) return;
      const r = await AI.run('Assistant IA', () => this.ask(prompt, opt)); if (!r) return;
      const res = await this.apply(r.actions);
      const html = `<p>${esc(r.message || '')}</p>${res.log.length ? '<ul class="ai-log">' + res.log.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p class="muted">Aucune modification.</p>'}`;
      MP.ui.dialog({ title: '✨ Assistant IA', width: 520, okLabel: 'Garder', noCancel: true, fields: [{ type: 'info', html }, ...(res.steps ? [{ type: 'button', label: 'Tout annuler', action: () => { this.undo(res.steps); res.steps = 0; MP.ui.dialogOpen && MP.ui.dialogOpen.close && MP.ui.dialogOpen.close(); document.querySelectorAll('.modal-back').forEach((x) => x.querySelector('.ai-log') && x.remove()); MP.toast('Modifications de l\'assistant annulées'); } }] : []), { type: 'button', label: 'Nouvelle demande…', action: () => { document.querySelectorAll('.modal-back').forEach((x) => x.querySelector('.ai-log') && x.remove()); this.dialog(); } }] });
      return res;
    },
    autoEnhance() { return this.run('Correct and enhance this photo naturally like a professional retoucher: exposure, contrast, white balance, colors, clarity. Use a single "cameraRaw" adjustment.', { image: true, only: ['adjust'] }); },
  };

  /* =================== Filtres neuronaux IA =================== */
  const KEEP = ' Keep exactly the same composition, framing, perspective, subjects, faces and proportions; only change what is described.';
  MP.neuralAI = {
    PRESETS: [
      ['watercolor', 'Aquarelle', 'Repaint this image as a delicate watercolor painting on textured paper.'],
      ['oil', 'Peinture à l\'huile', 'Repaint this image as a rich oil painting with visible brush strokes.'],
      ['pencil', 'Croquis au crayon', 'Turn this image into a detailed graphite pencil sketch.'],
      ['comic', 'Bande dessinée', 'Turn this image into a clean comic book illustration with ink outlines and flat colors.'],
      ['popart', 'Pop art', 'Turn this image into colorful pop art with bold flat colors and halftone dots.'],
      ['clay', 'Rendu 3D (pâte à modeler)', 'Turn this image into a cute 3D claymation-style render.'],
      ['night', 'Jour → nuit', 'Transform this daytime scene into a realistic night scene with artificial lights and a dark blue sky.'],
      ['winter', 'Été → hiver', 'Transform this scene into winter with realistic snow on the ground and surfaces.'],
      ['autumn', 'Automne', 'Transform this scene into autumn with orange and red foliage.'],
      ['sunset', 'Coucher de soleil', 'Relight this scene with a warm golden-hour sunset light and sky.'],
      ['studio', 'Éclairage studio (portrait)', 'Relight the portrait with soft professional studio lighting, flattering and natural skin.'],
      ['restore', 'Restaurer une photo ancienne', 'Restore this old photograph: remove scratches, dust, stains and tears, fix fading, sharpen details, keep it photographic and authentic.'],
      ['enhance', 'Améliorer les détails (photo réaliste)', 'Enhance this photo: sharper fine details, less noise and blur, natural colors, photorealistic.'],
      ['clean', 'Désencombrer (retirer passants et objets parasites)', 'Remove passers-by, cars, trash, signs and distracting small objects from the background; reconstruct the background naturally.'],
    ],
    async apply(prompt, name = '✨ Filtre neuronal', sel = true) {
      const d = MP.doc; if (!d) return; const p = String(prompt || '').trim(); if (!p) { MP.toast('Décrivez la transformation souhaitée'); return; }
      return AI.run('Filtre neuronal IA', async () => {
        const src = composite(), out = await AI.edit(src, null, p + KEEP);
        d.history.record('Filtre neuronal IA', null);
        const l = d.addLayer(name); l.parent = null; l.ctx.imageSmoothingQuality = 'high'; l.ctx.drawImage(out, 0, 0, d.width, d.height);
        if (sel && d.selection) { l.mask = MP.cloneCanvas(d.selection); l.maskEnabled = true; }
        d.active = d.layers.indexOf(l); MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll();
        MP.toast('Résultat placé sur un nouveau calque : réglez son opacité ou peignez sur son masque pour doser l\'effet', 6000); return l;
      });
    },
    dialog() {
      if (!MP.doc) return; const v = { preset: 'watercolor', custom: '', sel: true };
      MP.ui.dialog({ title: '✨ Filtres neuronaux IA', width: 520, okLabel: 'Appliquer', values: v,
        fields: [{ k: 'preset', label: 'Effet', type: 'select', options: [...this.PRESETS.map(([k, l]) => [k, l]), ['custom', 'Personnalisé (décrire ci-dessous)']] }, { k: 'custom', label: 'Description personnalisée (facultative, complète l\'effet)', type: 'textarea', rows: 2 }, { k: 'sel', label: 'Limiter à la sélection active (masque du calque)', type: 'check' }, { type: 'info', html: '<p class="muted">Le résultat est placé sur un nouveau calque au-dessus de l\'image (non destructif). Consomme des crédits IA Multipify.</p>' }],
        onOk: (o) => { const pr = this.PRESETS.find((x) => x[0] === o.preset), p = [pr ? pr[2] : '', o.custom.trim()].filter(Boolean).join(' '); if (!p) { MP.toast('Décrivez l\'effet personnalisé'); return false; } setTimeout(() => this.apply(p, '✨ ' + (pr ? (MP.i18n ? MP.i18n.t(pr[1]) : pr[1]) : 'Filtre neuronal'), o.sel), 30); } });
    },
  };

  /* =================== Description, rédaction, traduction =================== */
  AI.describe = () => {
    const d = MP.doc; if (!d) return;
    return AI.run('Description de l\'image', async () => {
      const r = await AI.chat({ system: `You write image metadata for photographers and SEO. Answer only JSON: {"title": "...", "description": "2-3 sentences", "alt": "accessible alt text, max 125 chars", "keywords": ["10 to 20 keywords"]}. Language: ${langName(uiLang())}.`, user: 'Describe this image.', image: composite() });
      const kw = Array.isArray(r.keywords) ? r.keywords.join(', ') : String(r.keywords || ''), v = { title: String(r.title || ''), description: String(r.description || ''), alt: String(r.alt || ''), keywords: kw };
      MP.ui.dialog({ title: '✨ Description de l\'image', width: 560, okLabel: 'Enregistrer dans les informations du fichier', values: v,
        fields: [{ k: 'title', label: 'Titre', type: 'text' }, { k: 'description', label: 'Description', type: 'textarea', rows: 3 }, { k: 'alt', label: 'Texte alternatif (accessibilité, SEO)', type: 'text' }, { type: 'button', label: 'Copier le texte alternatif', action: () => { navigator.clipboard && navigator.clipboard.writeText(v.alt); MP.toast('Texte alternatif copié'); } }, { k: 'keywords', label: 'Mots-clés', type: 'textarea', rows: 2 }],
        onOk: (o) => { d.meta = { ...(d.meta || {}), title: o.title, description: o.description, keywords: o.keywords, alt: o.alt }; d.markDirty && d.markDirty(); MP.toast('Titre, description et mots-clés enregistrés (exportés dans les métadonnées)'); } });
      return r;
    });
  };
  const KINDS = [['slogan', 'Slogan publicitaire'], ['title', 'Titre accrocheur'], ['caption', 'Légende pour les réseaux sociaux (avec hashtags)'], ['product', 'Description de produit'], ['cta', 'Bouton d\'appel à l\'action'], ['quote', 'Citation inspirante']];
  const TONES = [['pro', 'Professionnel'], ['fun', 'Fun et décontracté'], ['luxe', 'Haut de gamme'], ['urgent', 'Urgent (promotion)'], ['warm', 'Chaleureux']];
  const LANG_OPTS = () => Object.keys(LANG_NAMES).map((c) => [c, (MP.i18n.LANGS.find((l) => l[0] === c) || [c, c])[1]]);
  AI.writeTextDialog = () => {
    if (!MP.doc) return; const v = { kind: 'slogan', subject: '', tone: 'pro', lang: uiLang(), img: true };
    MP.ui.dialog({ title: '✨ Rédiger un texte', width: 520, okLabel: 'Proposer', values: v,
      fields: [{ k: 'kind', label: 'Type de texte', type: 'select', options: KINDS }, { k: 'subject', label: 'Sujet, produit ou message (facultatif)', type: 'textarea', rows: 2 }, { k: 'tone', label: 'Ton', type: 'select', options: TONES }, { k: 'lang', label: 'Langue', type: 'select', options: LANG_OPTS() }, { k: 'img', label: 'S\'inspirer de l\'image', type: 'check' }],
      onOk: (o) => { setTimeout(() => AI.writeText(o), 30); } });
  };
  AI.writeText = (o) => AI.run('Rédaction', async () => {
    const kind = (KINDS.find((k) => k[0] === o.kind) || KINDS[0])[0], tone = (TONES.find((k) => k[0] === o.tone) || TONES[0])[0];
    const r = await AI.chat({ system: `You are a senior copywriter. Write 5 different proposals of type "${kind}" with a "${tone}" tone, in ${langName(o.lang)}. Keep them short enough for a visual (except product descriptions). Answer only JSON: {"proposals": ["...", "..."]}.`, user: (o.subject ? 'Subject: ' + o.subject : 'Write for the attached visual.'), image: o.img ? composite() : null });
    const props = (Array.isArray(r.proposals) ? r.proposals : []).map(String).filter(Boolean).slice(0, 8); if (!props.length) throw new Error('aucune proposition');
    MP.ui.dialog({ title: '✨ Propositions', width: 560, okLabel: 'Fermer', noCancel: true, fields: [{ type: 'info', html: '<p class="muted">Cliquez sur une proposition : elle remplace le texte du calque de texte actif, ou crée un nouveau calque de texte.</p>' }],
      body: (b) => { for (const p of props) { const x = el('button', { class: 'btn ai-prop', type: 'button' }, esc(p)); x.onclick = (e) => { e.preventDefault(); AI.useText(p); }; b.appendChild(x); } } });
    return props;
  });
  AI.useText = (txt) => { const d = MP.doc, l = d.layer; if (l && l.text) { d.history.record('Texte IA', [l.id]); const cx = l.text.x + ((l.text._b && l.text._b.w) || 0) / 2; l.text.content = txt; MP.renderText(l); if (l.text.align === 'center' && l.text._b) { l.text.x = Math.round(cx - l.text._b.w / 2); MP.renderText(l); } MP.afterEdit(); MP.toast('Texte remplacé'); } else { MP.assistant.addText(d, { content: txt, position: 'center', size: Math.round(Math.min(d.width, d.height) / (txt.length > 60 ? 22 : 12)) }); MP.ui.refreshAll && MP.ui.refreshAll(); MP.toast('Calque de texte ajouté'); } };
  AI.translateDialog = () => {
    const d = MP.doc; if (!d) return; if (!d.layers.some((l) => l.text && l.text.content)) { MP.toast('Ce document ne contient aucun calque de texte'); return; }
    const v = { lang: uiLang() === 'fr' ? 'en' : uiLang(), copy: true };
    MP.ui.dialog({ title: '✨ Traduire les textes du document', width: 460, okLabel: 'Traduire', values: v, fields: [{ k: 'lang', label: 'Traduire vers', type: 'select', options: LANG_OPTS() }, { k: 'copy', label: 'Créer une copie du document (garder l\'original)', type: 'check' }, { type: 'info', html: '<p class="muted">Idéal pour décliner une affiche ou un visuel publicitaire dans plusieurs langues. Les mises en forme (police, couleur, effets) sont conservées.</p>' }],
      onOk: (o) => { setTimeout(() => AI.translateTexts(o.lang, o.copy), 30); } });
  };
  AI.translateTexts = (lang, copy) => AI.run('Traduction des textes', async () => {
    let d = MP.doc; const items = d.layers.filter((l) => l.text && l.text.content).map((l, i) => ({ id: 't' + i, text: l.text.content }));
    const r = await AI.chat({ system: `Translate marketing/visual texts into ${langName(lang)}. Keep line breaks (\\n), numbers, prices, brand names and similar length when possible. Answer only JSON: {"translations": [{"id": "...", "text": "..."}]}.`, user: JSON.stringify({ texts: items }) });
    const tr = new Map((Array.isArray(r.translations) ? r.translations : []).map((t) => [String(t.id), String(t.text)]));
    if (copy) { const j = MP.io.serialize(d); await MP.io.openProject({ name: d.name.replace(/(\.[^.]+)?$/, '') + '-' + lang + '.mpp', data: new TextEncoder().encode(j) }); d = MP.doc; d.name = d.name.replace(/\.mpp$/, '') ; }
    d.history.record('Traduire les textes', null); let n = 0;
    const tl = d.layers.filter((l) => l.text && l.text.content); for (const [i, l] of tl.entries()) { const t = tr.get('t' + i); if (!t) continue; const w0 = (l.text._b && l.text._b.w) || 0; l.text.content = t; MP.renderText(l); if (l.text.align === 'center' && l.text._b) { l.text.x = Math.round(l.text.x + (w0 - l.text._b.w) / 2); MP.renderText(l); } else if (l.text.align === 'right' && l.text._b) { l.text.x = Math.round(l.text.x + w0 - l.text._b.w); MP.renderText(l); } n++; }
    MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll(); MP.toast(`${n} texte(s) traduit(s) en ${(MP.i18n.LANGS.find((x) => x[0] === lang) || [lang, lang])[1]}`, 5000); return n;
  });
  AI.modelsDialog = () => MP.ui.dialog({ title: 'Modèles IA', width: 500, values: { img: MP.prefs.aiModel || 'gpt-image-1.5', txt: MP.prefs.aiTextModel || 'gpt-5.4-mini' },
    fields: [{ k: 'img', label: 'Modèle d\'image (remplissage, extension, filtres neuronaux)', type: 'text' }, { type: 'info', html: '<p class="muted">Exemples : gpt-image-2, gpt-image-1.5, gpt-image-1</p>' }, { k: 'txt', label: 'Modèle de texte et de vision (assistant, description, rédaction, traduction)', type: 'text' }, { type: 'info', html: '<p class="muted">Exemples : gpt-5.4-mini (rapide, économique), gpt-5.5. La clé API se règle dans Paramètres IA.</p>' }],
    onOk: (o) => { MP.prefs.aiModel = o.img.trim() || 'gpt-image-1.5'; MP.prefs.aiTextModel = o.txt.trim() || 'gpt-5.4-mini'; MP.savePrefs(); MP.toast('Modèles IA enregistrés'); } });

  /* =================== Menus =================== */
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), ia = m.find((x) => x.label === 'IA');
    if (ia) { const at = ia.items.findIndex((x) => x && x.label && /^Paramètres IA/.test(x.label)); const add = [{ label: '✨ Assistant IA…', sc: 'Ctrl+Alt+A', act: need(() => MP.assistant.dialog()) }, { label: '✨ Retouche automatique (IA)', act: need(() => MP.assistant.autoEnhance()) }, { label: '✨ Filtres neuronaux IA…', act: need(() => MP.neuralAI.dialog()) }, '-', { label: '✨ Décrire l\'image (titre, texte alternatif, mots-clés)…', act: need(() => AI.describe()) }, { label: '✨ Rédiger un texte…', act: need(() => AI.writeTextDialog()) }, { label: '✨ Traduire les textes du document…', act: need(() => AI.translateDialog()) }, '-'];
      ia.items.splice(at >= 0 ? at : ia.items.length, 0, ...add); }
    const fi = m.find((x) => x.label === 'Filtre'), nf = fi && fi.items.find((x) => x && x.label === 'Filtres neuronaux');
    if (nf && typeof nf.sub === 'function') { const s0 = nf.sub; nf.sub = () => [{ label: '✨ Filtres neuronaux IA…', act: need(() => MP.neuralAI.dialog()) }, '-', ...s0()]; }
    return m;
  };
}
