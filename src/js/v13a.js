'use strict';
/* v13 — Retouche IA : bibliothèque de prompts prêts à l'emploi (visage, peau, yeux, sourire, cheveux, maquillage,
   corps, vêtements, lumière, arrière-plan, restauration), détection automatique des visages, zone de travail
   (visage / personne / sélection / image), intensité, combinaison de plusieurs retouches en un seul passage,
   favoris et prompts personnels. Résultat toujours non destructif (nouveau calque masqué). */
{
  const AI = MP.ai;
  // [id, catégorie, libellé, prompt (anglais), zone par défaut : face | person | whole]
  const P = [
    // ---------- Peau ----------
    ['wrinkles', 'skin', 'Enlever les rides', 'reduce wrinkles and fine lines on the face', 'face'],
    ['forehead', 'skin', 'Rides du front', 'smooth the horizontal forehead wrinkles', 'face'],
    ['crowsfeet', 'skin', 'Pattes d\'oie', 'soften the crow\'s feet wrinkles around the eyes', 'face'],
    ['frown', 'skin', 'Rides du lion', 'soften the frown lines between the eyebrows', 'face'],
    ['nasolabial', 'skin', 'Sillons nasogéniens', 'soften the nasolabial folds (smile lines from nose to mouth)', 'face'],
    ['neckwr', 'skin', 'Rides du cou', 'smooth the neck wrinkles and lines', 'person'],
    ['acne', 'skin', 'Boutons et acné', 'remove pimples, acne spots and blemishes', 'face'],
    ['acnescars', 'skin', 'Cicatrices d\'acné', 'reduce acne scars and uneven skin texture', 'face'],
    ['spots', 'skin', 'Taches pigmentaires', 'remove dark spots, age spots and hyperpigmentation', 'face'],
    ['redness', 'skin', 'Rougeurs et couperose', 'reduce skin redness, rosacea and visible capillaries', 'face'],
    ['smooth', 'skin', 'Lisser la peau (texture conservée)', 'smooth the skin while keeping natural pores and texture, no plastic look', 'face'],
    ['pores', 'skin', 'Pores dilatés', 'minimize enlarged pores', 'face'],
    ['shine', 'skin', 'Brillance / peau grasse', 'remove oily shine and specular hotspots from the skin, matte natural finish', 'face'],
    ['darkcircles', 'skin', 'Cernes', 'reduce dark circles under the eyes', 'face'],
    ['eyebags', 'skin', 'Poches sous les yeux', 'reduce puffy eye bags under the eyes', 'face'],
    ['moles', 'skin', 'Grains de beauté', 'remove moles and beauty marks from the face', 'face'],
    ['scars', 'skin', 'Cicatrices', 'remove scars from the skin', 'person'],
    ['tattoo', 'skin', 'Retirer les tatouages', 'remove tattoos, show natural skin instead', 'person'],
    ['stretch', 'skin', 'Vergetures', 'remove stretch marks', 'person'],
    ['eventone', 'skin', 'Unifier le teint', 'even out the skin tone, remove blotchiness', 'face'],
    ['glow', 'skin', 'Peau éclatante', 'give the skin a healthy natural glow', 'face'],
    ['tan', 'skin', 'Léger bronzage', 'give the skin a light natural sun tan', 'person'],
    ['peachfuzz', 'skin', 'Duvet du visage', 'remove facial peach fuzz hair', 'face'],
    ['sunburn', 'skin', 'Coups de soleil', 'remove sunburn redness and peeling skin', 'person'],
    ['veins', 'skin', 'Veines visibles', 'reduce visible veins', 'person'],
    ['cellulite', 'skin', 'Cellulite', 'smooth cellulite on the skin', 'person'],
    // ---------- Yeux & sourcils ----------
    ['eyewhite', 'eyes', 'Blanchir le blanc des yeux', 'whiten the whites of the eyes and remove red veins in the eyes', 'face'],
    ['redeye', 'eyes', 'Yeux rouges (flash)', 'fix red-eye from camera flash, natural pupils', 'face'],
    ['eyesparkle', 'eyes', 'Éclat du regard', 'brighten the irises and add subtle natural catchlights in the eyes', 'face'],
    ['eyesharp', 'eyes', 'Netteté des yeux', 'sharpen the eyes and eyelashes', 'face'],
    ['openeyes', 'eyes', 'Ouvrir les yeux fermés', 'open the closed eyes naturally, matching the person\'s real eye shape and color', 'face'],
    ['eyeblue', 'eyes', 'Yeux bleus', 'change the iris color to natural blue', 'face'],
    ['eyegreen', 'eyes', 'Yeux verts', 'change the iris color to natural green', 'face'],
    ['eyebrown', 'eyes', 'Yeux marron', 'change the iris color to natural brown', 'face'],
    ['eyehazel', 'eyes', 'Yeux noisette', 'change the iris color to natural hazel', 'face'],
    ['browsfull', 'eyes', 'Sourcils plus fournis', 'make the eyebrows slightly fuller and well-groomed', 'face'],
    ['browsgroom', 'eyes', 'Discipliner les sourcils', 'groom the eyebrows, remove stray brow hairs', 'face'],
    ['lashes', 'eyes', 'Cils plus longs', 'make the eyelashes slightly longer and fuller', 'face'],
    ['glassglare', 'eyes', 'Reflets sur les lunettes', 'remove glare and reflections from the eyeglasses lenses, eyes clearly visible', 'face'],
    ['noglasses', 'eyes', 'Retirer les lunettes', 'remove the eyeglasses, reconstruct the eyes and skin naturally', 'face'],
    // ---------- Bouche & sourire ----------
    ['teeth', 'mouth', 'Blanchir les dents', 'whiten the teeth naturally (not pure white)', 'face'],
    ['teethalign', 'mouth', 'Aligner les dents', 'straighten the teeth slightly, natural look', 'face'],
    ['teethgap', 'mouth', 'Combler l\'espace entre les dents', 'close the gap between the front teeth naturally', 'face'],
    ['smile', 'mouth', 'Sourire naturel', 'give the person a gentle natural smile, same identity', 'face'],
    ['lipsmoist', 'mouth', 'Lèvres hydratées', 'fix dry chapped lips, healthy moisturized lips', 'face'],
    ['lipsfull', 'mouth', 'Lèvres légèrement plus pleines', 'make the lips slightly fuller, natural', 'face'],
    ['lipred', 'mouth', 'Rouge à lèvres rouge', 'apply classic red lipstick', 'face'],
    ['lipnude', 'mouth', 'Rouge à lèvres nude', 'apply a natural nude lipstick', 'face'],
    ['lippink', 'mouth', 'Rouge à lèvres rose', 'apply a soft pink lipstick', 'face'],
    // ---------- Visage & forme ----------
    ['slimface', 'face', 'Affiner le visage', 'slim the face slightly, natural proportions', 'face'],
    ['doublechin', 'face', 'Réduire le double menton', 'reduce the double chin, defined jawline', 'person'],
    ['jaw', 'face', 'Mâchoire plus dessinée', 'define the jawline slightly', 'face'],
    ['symmetry', 'face', 'Symétrie du visage', 'make the face slightly more symmetrical', 'face'],
    ['nose', 'face', 'Affiner le nez', 'make the nose slightly narrower, natural', 'face'],
    ['younger', 'face', 'Rajeunir (5 à 10 ans)', 'make the person look 5 to 10 years younger, same identity', 'face'],
    ['older', 'face', 'Vieillir (20 ans)', 'age the person by about 20 years realistically, same identity', 'face'],
    ['relax', 'face', 'Expression détendue', 'relax the facial expression, softer and friendlier', 'face'],
    ['tired', 'face', 'Effacer la fatigue', 'make the face look rested: fewer dark circles, brighter eyes, healthier skin', 'face'],
    // ---------- Cheveux & barbe ----------
    ['flyaways', 'hair', 'Cheveux rebelles', 'remove flyaway hairs and frizz, tidy hair outline', 'person'],
    ['hairfill', 'hair', 'Combler les zones dégarnies', 'fill thinning or balding areas with natural matching hair', 'person'],
    ['hairshine', 'hair', 'Cheveux brillants', 'make the hair healthier and shinier', 'person'],
    ['greyhair', 'hair', 'Couvrir les cheveux blancs', 'cover grey hair with the person\'s natural hair color', 'person'],
    ['hairvolume', 'hair', 'Plus de volume', 'add natural volume to the hair', 'person'],
    ['hblond', 'hair', 'Cheveux blonds', 'change the hair color to natural blonde', 'person'],
    ['hbrown', 'hair', 'Cheveux châtains', 'change the hair color to natural chestnut brown', 'person'],
    ['hblack', 'hair', 'Cheveux noirs', 'change the hair color to natural black', 'person'],
    ['hred', 'hair', 'Cheveux roux', 'change the hair color to natural copper red', 'person'],
    ['hsilver', 'hair', 'Cheveux gris argenté', 'change the hair color to elegant silver grey', 'person'],
    ['beardtrim', 'hair', 'Tailler la barbe', 'neatly trim and shape the beard', 'face'],
    ['beardfill', 'hair', 'Barbe plus fournie', 'fill patchy areas of the beard naturally', 'face'],
    ['shave', 'hair', 'Rasage net', 'make the face clean-shaven', 'face'],
    // ---------- Maquillage ----------
    ['mkupnatural', 'makeup', 'Maquillage naturel', 'apply subtle natural no-makeup makeup', 'face'],
    ['mkupevening', 'makeup', 'Maquillage de soirée', 'apply elegant evening makeup', 'face'],
    ['mkupmatte', 'makeup', 'Teint mat', 'apply a matte foundation finish', 'face'],
    ['blush', 'makeup', 'Blush', 'add a soft natural blush on the cheeks', 'face'],
    ['eyeliner', 'makeup', 'Eye-liner', 'add a thin elegant eyeliner', 'face'],
    ['smoky', 'makeup', 'Smoky eyes', 'apply smoky eye makeup', 'face'],
    ['nomakeup', 'makeup', 'Démaquiller', 'remove the makeup, natural bare skin', 'face'],
    // ---------- Corps & vêtements ----------
    ['slimbody', 'body', 'Affiner la silhouette', 'slim the body slightly, natural proportions', 'person'],
    ['flatbelly', 'body', 'Ventre plus plat', 'flatten the belly slightly, natural', 'person'],
    ['posture', 'body', 'Posture plus droite', 'straighten the posture slightly, shoulders back', 'person'],
    ['nails', 'body', 'Mains et ongles soignés', 'make the hands and nails look well-groomed', 'person'],
    ['wrinkleclothes', 'body', 'Repasser les vêtements', 'remove wrinkles and creases from the clothes, as if freshly ironed', 'person'],
    ['lint', 'body', 'Peluches et poils sur les vêtements', 'remove lint, fluff, dust and pet hair from the clothes', 'person'],
    ['stains', 'body', 'Taches sur les vêtements', 'remove stains from the clothes', 'person'],
    ['sweat', 'body', 'Auréoles de transpiration', 'remove sweat marks from the clothes', 'person'],
    ['jewels', 'body', 'Retirer les bijoux', 'remove the jewelry', 'person'],
    ['suit', 'body', 'Tenue professionnelle', 'dress the person in a smart professional suit, same face and pose', 'person'],
    // ---------- Lumière ----------
    ['studio', 'light', 'Éclairage studio doux', 'relight with soft flattering studio portrait lighting', 'whole'],
    ['golden', 'light', 'Lumière dorée', 'relight with warm golden-hour light', 'whole'],
    ['backlit', 'light', 'Visage sombre (contre-jour)', 'brighten the face that is too dark because of backlight, balanced exposure', 'whole'],
    ['hardshadow', 'light', 'Ombres dures sur le visage', 'soften harsh shadows on the face', 'face'],
    ['flashsoft', 'light', 'Adoucir le flash', 'soften the harsh on-camera flash look, natural light', 'whole'],
    ['deblur', 'light', 'Photo floue → nette', 'make the blurry portrait sharp and in focus, realistic details', 'whole'],
    ['denoise', 'light', 'Photo de nuit bruitée', 'remove the noise and grain from this low-light photo, keep details', 'whole'],
    ['dslr', 'light', 'Rendu appareil pro', 'make it look like a professional DSLR portrait with shallow depth of field', 'whole'],
    // ---------- Arrière-plan ----------
    ['bokeh', 'bg', 'Flouter l\'arrière-plan', 'blur the background with a natural lens bokeh, person stays sharp', 'whole'],
    ['bggrey', 'bg', 'Fond studio gris', 'replace the background with a seamless grey studio backdrop', 'whole'],
    ['bgwhite', 'bg', 'Fond blanc', 'replace the background with a clean white background', 'whole'],
    ['bgoffice', 'bg', 'Fond bureau (LinkedIn)', 'replace the background with a softly blurred modern office', 'whole'],
    ['bgpeople', 'bg', 'Retirer les personnes derrière', 'remove the other people in the background, reconstruct the background', 'whole'],
    ['bgclutter', 'bg', 'Retirer les objets gênants', 'remove distracting objects, signs, wires and clutter from the background', 'whole'],
    // ---------- Restauration ----------
    ['oldphoto', 'restore', 'Restaurer une photo ancienne', 'restore this old photo: remove scratches, dust, stains, fix fading and sharpen, keep it authentic', 'whole'],
    ['colorize', 'restore', 'Coloriser (noir et blanc)', 'colorize this black and white photo with realistic natural colors', 'whole'],
    ['scratches', 'restore', 'Rayures et poussières', 'remove scratches, dust and specks', 'whole'],
    ['facerestore', 'restore', 'Visage flou ou abîmé', 'restore the damaged or blurry face, sharp natural details, same identity', 'face'],
    // ---------- Retouches complètes ----------
    ['magazine', 'combo', 'Retouche portrait magazine', 'professional magazine-quality portrait retouch: even skin with natural texture, remove blemishes, reduce dark circles, brighten eyes, whiten teeth slightly, tidy flyaway hairs', 'face'],
    ['linkedin', 'combo', 'Photo de profil LinkedIn / CV', 'professional headshot retouch: remove blemishes, reduce shine, soften dark circles, tidy hair, flattering soft light, neutral softly blurred background', 'whole'],
    ['wedding', 'combo', 'Retouche mariage', 'romantic wedding retouch: flawless natural skin, bright eyes, soft glow, gentle warm light, remove distractions', 'whole'],
    ['selfie', 'combo', 'Selfie amélioré', 'improve this selfie: correct wide-angle face distortion, even skin, brighter eyes, better light', 'whole'],
    ['natural', 'combo', 'Retouche très naturelle', 'very light natural retouch: remove temporary blemishes only, keep moles, freckles, wrinkles and character', 'face'],
  ];
  const CATS = [['fav', '★ Favoris'], ['combo', 'Retouches complètes'], ['skin', 'Peau'], ['eyes', 'Yeux et sourcils'], ['mouth', 'Bouche et sourire'], ['face', 'Forme du visage'], ['hair', 'Cheveux et barbe'], ['makeup', 'Maquillage'], ['body', 'Corps et vêtements'], ['light', 'Lumière'], ['bg', 'Arrière-plan'], ['restore', 'Restauration'], ['mine', 'Mes prompts']];
  const INT = { subtle: 'Very subtle and natural, barely noticeable.', medium: 'Natural-looking result.', strong: 'Clearly visible effect, but still photorealistic.' };
  const KEEP = 'This is an edit of the provided photo, not a new image: it must stay the same photo of the same real person. Keep the person\'s identity, facial features, expression, pose, hair, clothing, background, framing and lighting identical except for the requested change. Keep natural skin texture (no plastic or airbrushed look). Photorealistic, same resolution and grain.';
  const T = (s) => (MP.i18n ? MP.i18n.t(s) : s);

  MP.retouchAI = {
    PRESETS: P, CATS,
    custom() { return Array.isArray(MP.prefs.retouchCustom) ? MP.prefs.retouchCustom : []; },
    favs() { return new Set(Array.isArray(MP.prefs.retouchFav) ? MP.prefs.retouchFav : ['wrinkles', 'acne', 'teeth', 'darkcircles', 'magazine', 'eyewhite']); },
    find(id) { const p = P.find((x) => x[0] === id); if (p) return p; const c = this.custom().find((x) => x.id === id); return c ? [c.id, 'mine', c.label, c.prompt, c.zone || 'whole'] : null; },
    buildPrompt(ids, intensity, extra) {
      const items = ids.map((i) => this.find(i)).filter(Boolean), list = items.map((p) => p[3]); if (extra && extra.trim()) list.push(extra.trim());
      if (!list.length) return '';
      return `Retouch this photo: ${list.join('; ')}. ${INT[intensity] || INT.medium} ${KEEP}`;
    },
    zoneFor(ids) { const z = ids.map((i) => (this.find(i) || [])[4]); return z.includes('whole') ? 'whole' : z.includes('person') ? 'person' : 'face'; },

    /** Détecte visages et personnes (boîtes normalisées 0–1) avec le modèle de vision. */
    async detect(src) {
      const r = await AI.chat({ system: 'You are a precise face and person detector. Answer only JSON: {"faces":[{"x":0,"y":0,"w":0,"h":0}],"people":[{"x":0,"y":0,"w":0,"h":0}]} where x,y is the top-left corner and w,h the size, all as fractions (0 to 1) of the image width and height. Face boxes include forehead to chin and ear to ear. Return empty arrays if none.', user: 'Detect every human face and every person in this image.', image: src, maxTokens: 1500 });
      const ok = (b) => b && [b.x, b.y, b.w, b.h].every((v) => typeof v === 'number' && isFinite(v)) && b.w > 0.005 && b.h > 0.005;
      const norm = (a) => (Array.isArray(a) ? a.filter(ok).map((b) => ({ x: MP.clamp(b.x, 0, 1), y: MP.clamp(b.y, 0, 1), w: MP.clamp(b.w, 0, 1), h: MP.clamp(b.h, 0, 1) })) : []);
      return { faces: norm(r.faces), people: norm(r.people) };
    },
    /** Zone de travail : rectangle à envoyer à l'IA + masque des pixels modifiables (taille document). */
    async region(d, zone, src) {
      const W = d.width, H = d.height, full = { R: { x: 0, y: 0, w: W, h: H }, mask: null, label: 'image entière' };
      if (zone === 'sel') { const b = MP.sel.bounds(d); if (!b) throw new Error('aucune sélection active'); const m = Math.round(Math.max(48, Math.max(b.w, b.h) * 0.3)); const R = this.clampR({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m }, W, H); return { R, mask: MP.cloneCanvas(d.selection), label: 'sélection' }; }
      if (zone === 'whole') return full;
      const det = await this.detect(src), boxes = zone === 'person' ? (det.people.length ? det.people : det.faces.map((f) => ({ x: f.x - f.w * 0.8, y: f.y - f.h * 0.5, w: f.w * 2.6, h: f.h * 4 }))) : det.faces;
      if (!boxes.length) { MP.toast(T('Aucun visage détecté : la retouche s\'applique à toute l\'image'), 4500); return full; }
      const mask = MP.createCanvas(W, H), mx = mask.getContext('2d'); let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (const b of boxes) {
        const cx = (b.x + b.w / 2) * W, cy = (b.y + b.h / 2) * H, rw = (b.w * W) / 2 * (zone === 'face' ? 1.35 : 1.12), rh = (b.h * H) / 2 * (zone === 'face' ? 1.45 : 1.08);
        if (zone === 'face') { const g = mx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, '#fff'); g.addColorStop(0.82, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); mx.save(); mx.translate(cx, cy); mx.scale(rw, rh); mx.fillStyle = g; mx.beginPath(); mx.arc(0, 0, 1, 0, Math.PI * 2); mx.fill(); mx.restore(); }
        else { mx.fillStyle = '#fff'; mx.fillRect(cx - rw, cy - rh, rw * 2, rh * 2); }
        x0 = Math.min(x0, cx - rw); y0 = Math.min(y0, cy - rh); x1 = Math.max(x1, cx + rw); y1 = Math.max(y1, cy + rh);
      }
      if (zone === 'person') { const b = MP.blurCanvas(mask, Math.max(4, Math.round(Math.min(W, H) * 0.02))); mx.clearRect(0, 0, W, H); mx.drawImage(b, 0, 0); }
      const m = Math.max(40, Math.round(Math.max(x1 - x0, y1 - y0) * 0.25));
      return { R: this.clampR({ x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m }, W, H), mask, label: zone === 'face' ? boxes.length + ' visage(s)' : boxes.length + ' personne(s)', boxes };
    },
    clampR(r, W, H) { const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y)); return { x, y, w: Math.min(W, Math.round(r.x + r.w)) - x, h: Math.min(H, Math.round(r.y + r.h)) - y }; },

    /** Lance une retouche : ids de préréglages + texte libre. */
    async apply({ ids = [], intensity = 'medium', zone = 'auto', extra = '', name = '' } = {}) {
      const d = MP.doc; if (!d) return; const prompt = this.buildPrompt(ids, intensity, extra); if (!prompt) { MP.toast(T('Choisissez au moins une retouche ou écrivez un prompt')); return; }
      const z = zone === 'auto' ? (d.selection ? 'sel' : this.zoneFor(ids.length ? ids : ['x'])) : zone;
      const label = name || (ids.length === 1 ? T((this.find(ids[0]) || [])[2] || 'Retouche') : ids.length ? T('Retouche IA') + ' (' + ids.length + ')' : T('Retouche IA'));
      return AI.run(T('Retouche IA'), async () => {
        const src = MP.cloneCanvas(d.composite(null, { noLive: true }));
        const reg = await this.region(d, z, src), R = reg.R;
        const crop = MP.createCanvas(R.w, R.h); crop.getContext('2d').drawImage(src, -R.x, -R.y);
        // Retouche = modification de CETTE photo : aucun masque d'inpainting n'est envoyé (avec un masque, le modèle
        // régénère tout le visage et invente une autre personne). La zone (visage / personne / sélection) est limitée
        // ensuite par le masque du calque, côté logiciel.
        const out = await AI.edit(crop, null, prompt);
        d.history.record(T('Retouche IA'), null);
        const l = d.addLayer('✨ ' + label); l.parent = null; l.ctx.imageSmoothingQuality = 'high'; l.ctx.drawImage(out, R.x, R.y, R.w, R.h);
        const lm = MP.createCanvas(d.width, d.height), lx = lm.getContext('2d');
        if (reg.mask) lx.drawImage(MP.blurCanvas(reg.mask, Math.max(2, Math.round(Math.min(R.w, R.h) * 0.012))), 0, 0);
        else if (R.w < d.width || R.h < d.height) { lx.fillStyle = '#fff'; lx.fillRect(R.x + 8, R.y + 8, R.w - 16, R.h - 16); const b = MP.blurCanvas(lm, 6); lx.clearRect(0, 0, d.width, d.height); lx.drawImage(b, 0, 0); }
        else { lx.fillStyle = '#fff'; lx.fillRect(0, 0, d.width, d.height); }
        l.mask = lm; l.maskEnabled = true; l.retouch = { ids, intensity, zone: z, extra };
        d.active = d.layers.indexOf(l); MP.afterEdit(); MP.ui.refreshAll && MP.ui.refreshAll();
        MP.toast(T('Retouche placée sur un nouveau calque') + ' (' + T(reg.label) + ') — ' + T('opacité pour doser, masque pour affiner, Ctrl+Alt+B pour comparer'), 6500);
        return l;
      });
    },
    /** Détecte les visages et en fait une sélection (pour vérifier ou ajuster la zone avant retouche). */
    selectFaces() {
      const d = MP.doc; if (!d) return;
      return AI.run(T('Détection des visages'), async () => { const reg = await this.region(d, 'face', MP.cloneCanvas(d.composite(null, { noLive: true }))); if (!reg.mask) return 0; d.history.record(T('Sélectionner les visages'), null); MP.sel.fromMask(d, reg.mask); MP.render(); MP.toast(T(reg.label) + ' — ' + T('sélection modifiable avant la retouche'), 4500); return reg.boxes.length; });
    },

    /* ---------- Panneau de retouche ---------- */
    dialog(preset) {
      if (!MP.doc) return; const self = this, picked = new Set(preset ? [preset] : []), fav = this.favs();
      const v = { intensity: MP.prefs.retouchIntensity || 'medium', zone: 'auto', extra: '' };
      let cat = preset ? (this.find(preset) || [])[1] : 'fav', query = '';
      MP.ui.dialog({ title: '✨ ' + T('Retouche IA (visage, peau, corps…)'), width: 760, okLabel: T('Appliquer la retouche'), values: v,
        fields: [{ k: 'intensity', label: 'Intensité', type: 'select', options: [['subtle', 'Subtile (très naturelle)'], ['medium', 'Moyenne'], ['strong', 'Forte']] }, { k: 'zone', label: 'Zone', type: 'select', options: [['auto', 'Automatique (visage, personne ou image selon la retouche ; sélection si active)'], ['face', 'Visage(s) détecté(s)'], ['person', 'Personne(s) détectée(s)'], ['sel', 'Sélection active'], ['whole', 'Image entière']] }, { k: 'extra', label: 'Prompt libre (facultatif, s\'ajoute aux retouches cochées)', type: 'textarea', rows: 2 }],
        body: (b) => {
          const box = el('div', { class: 'rt-wrap' }), bar = el('div', { class: 'rt-bar' }), search = el('input', { type: 'search', class: 'rt-search', placeholder: T('Rechercher une retouche (rides, dents, cernes…)') }), cats = el('div', { class: 'rt-cats' }), grid = el('div', { class: 'rt-grid' }), info = el('div', { class: 'rt-info muted' }), tools = el('div', { class: 'rt-tools' });
          bar.appendChild(search); box.append(bar, cats, grid, info, tools); b.insertBefore(box, b.firstChild);
          const drawInfo = () => { info.textContent = picked.size ? T('Sélectionnées') + ' : ' + [...picked].map((i) => T((self.find(i) || [])[2] || i)).join(', ') : T('Cliquez sur une ou plusieurs retouches (elles sont combinées en un seul passage IA).'); };
          const list = () => { const mine = self.custom().map((c) => [c.id, 'mine', c.label, c.prompt, c.zone || 'whole']), all = [...P, ...mine]; if (query) { const q = query.toLowerCase(); const nf = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), qq = nf(q); return all.filter((p) => nf(T(p[2]) + ' ' + p[2] + (p[1] === 'mine' ? ' ' + p[3] : '')).includes(qq)); } return cat === 'fav' ? all.filter((p) => fav.has(p[0])) : all.filter((p) => p[1] === cat); };
          const draw = () => {
            cats.innerHTML = ''; for (const [k, n] of CATS) { const c = el('button', { type: 'button', class: 'rt-cat' + (k === cat && !query ? ' on' : '') }, esc(T(n))); c.onclick = (e) => { e.preventDefault(); cat = k; query = ''; search.value = ''; draw(); }; cats.appendChild(c); }
            grid.innerHTML = ''; const L = list();
            if (!L.length) grid.appendChild(el('div', { class: 'muted' }, esc(cat === 'mine' ? T('Aucun prompt personnel : écrivez un prompt libre puis « Enregistrer dans Mes prompts ».') : T('Aucun résultat'))));
            for (const p of L) { const it = el('div', { class: 'rt-item' + (picked.has(p[0]) ? ' on' : '') }), lab = el('span', { class: 'rt-l' }, esc(T(p[2]))), st = el('span', { class: 'rt-star' + (fav.has(p[0]) ? ' on' : ''), title: T('Favori') }, fav.has(p[0]) ? '★' : '☆');
              it.title = p[3]; it.append(lab, st); if (p[1] === 'mine') { const del = el('span', { class: 'rt-del', title: T('Supprimer') }, '✕'); del.onclick = (e) => { e.stopPropagation(); MP.prefs.retouchCustom = self.custom().filter((c) => c.id !== p[0]); MP.savePrefs(); picked.delete(p[0]); draw(); }; it.appendChild(del); }
              it.onclick = () => { if (picked.has(p[0])) picked.delete(p[0]); else picked.add(p[0]); draw(); };
              st.onclick = (e) => { e.stopPropagation(); if (fav.has(p[0])) fav.delete(p[0]); else fav.add(p[0]); MP.prefs.retouchFav = [...fav]; MP.savePrefs(); draw(); };
              grid.appendChild(it); }
            drawInfo();
          };
          search.oninput = () => { query = search.value.trim(); draw(); };
          const save = el('button', { type: 'button', class: 'btn small' }, esc(T('Enregistrer dans Mes prompts'))), detect = el('button', { type: 'button', class: 'btn small' }, esc(T('Voir les visages détectés (sélection)'))), clear = el('button', { type: 'button', class: 'btn small' }, esc(T('Tout décocher')));
          save.onclick = (e) => { e.preventDefault(); const ta = b.querySelector('textarea'), txt = ta ? ta.value.trim() : ''; if (!txt) { MP.toast(T('Écrivez d\'abord un prompt libre')); return; } const sels = b.querySelectorAll('select'), zv = sels[1] ? sels[1].value : 'auto'; const c = { id: 'u' + Date.now().toString(36), label: txt.slice(0, 40), prompt: txt, zone: ['face', 'person', 'whole'].includes(zv) ? zv : 'whole' }; MP.prefs.retouchCustom = [...self.custom(), c]; MP.savePrefs(); cat = 'mine'; query = ''; draw(); MP.toast(T('Prompt enregistré dans « Mes prompts »')); };
          detect.onclick = (e) => { e.preventDefault(); document.querySelectorAll('.modal-back').forEach((x) => x.querySelector('.rt-wrap') && x.remove()); self.selectFaces(); };
          clear.onclick = (e) => { e.preventDefault(); picked.clear(); draw(); };
          tools.append(clear, save, detect); draw();
        },
        onOk: (o) => { if (!picked.size && !o.extra.trim()) { MP.toast(T('Choisissez au moins une retouche ou écrivez un prompt')); return false; } MP.prefs.retouchIntensity = o.intensity; MP.savePrefs(); const ids = [...picked]; setTimeout(() => self.apply({ ids, intensity: o.intensity, zone: o.zone, extra: o.extra }), 30); } });
    },
    QUICK: ['magazine', 'wrinkles', 'acne', 'darkcircles', 'eyebags', 'smooth', 'shine', 'eyewhite', 'teeth', 'flyaways', 'glassglare', 'openeyes', 'doublechin', 'wrinkleclothes', 'backlit', 'bokeh', 'oldphoto', 'linkedin'],
  };

  // Menus : IA › Retouche IA… + sous-menu de retouches en un clic ; bouton de la barre contextuelle
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), ia = (m.find((x) => x.label === 'IA') || { items: [] }).items, at = ia.findIndex((x) => x && x.label === '✨ Assistant IA…');
    ia.splice(at >= 0 ? at + 1 : 0, 0, { label: '✨ Retouche IA (visage, peau, corps…)…', sc: 'Ctrl+Alt+R', act: need(() => MP.retouchAI.dialog()) },
      { label: '✨ Retouches en un clic', sub: () => MP.retouchAI.QUICK.map((id) => { const p = MP.retouchAI.find(id); return { label: p[2], act: need(() => MP.retouchAI.apply({ ids: [id], intensity: MP.prefs.retouchIntensity || 'medium', zone: 'auto' })) }; }) },
      { label: '✨ Sélectionner les visages (IA)', act: need(() => MP.retouchAI.selectFaces()) });
    return m;
  };
  if (UI.ctxbar) { const r0 = UI.ctxbar.render.bind(UI.ctxbar); UI.ctxbar.render = function () { r0(); const b = this.el; if (!b || !MP.doc || b.style.display === 'none') return; const ai = b.querySelector('.cb.ai'); const x = el('button', { class: 'cb ai rt', title: T('Retouche IA (Ctrl+Alt+R)') }, '✨ ' + T('Retouche')); x.onclick = (e) => { e.preventDefault(); MP.retouchAI.dialog(); }; b.insertBefore(x, ai ? ai.nextSibling : null); }; }
}
