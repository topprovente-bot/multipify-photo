'use strict';
/* Licence Multipify Photo 1.0 : activation (1 ordinateur par clé), essai, abonnement, crédits IA (passerelle IA du serveur
   Multipify : aucune clé OpenAI nécessaire), achat de crédits, mises à jour. */
{
  const T = (s) => (MP.i18n ? MP.i18n.t(s) : s);
  const euros = (c) => (Number(c || 0) / 100).toLocaleString(MP.i18n && MP.i18n.lang !== 'fr' ? MP.i18n.lang : 'fr-FR', { style: 'currency', currency: 'EUR' });
  const N = MP.native;
  const LS = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* */ } } };

  const L = MP.license = {
    data: {}, machine: null, status: null, trial: null, locked: false, _timer: null,
    get token() { return this.data.token || null; },
    get credits() { return this.status && this.status.valid ? Number(this.status.credits || 0) : 0; },
    get costs() { return (this.status && this.status.costs) || { edit: 2, generate: 2, chat: 1, detect: 0 }; },
    get packs() { return (this.status && this.status.packs) || [{ id: 'p100', credits: 100, cents: 1000 }, { id: 'p550', credits: 550, cents: 5000 }]; },
    get salesUrl() { return (this.status && this.status.salesUrl) || (this.trial && this.trial.salesUrl) || (this.server + '/multipify-photo.html'); },
    server: 'https://multipify.eu',
    /** IA : uniquement via les crédits du serveur Multipify */
    get aiMode() { return 'credits'; },

    async machineInfo() {
      if (this.machine) return this.machine;
      if (N.licenseMachine) this.machine = await N.licenseMachine();
      else { let id = LS.get('mp.machine'); if (!id) { id = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join(''); LS.set('mp.machine', id); } this.machine = { id, name: 'Navigateur', platform: 'web', version: MP.version }; }
      return this.machine;
    },
    async load() { this.data = (N.licenseLoad ? await N.licenseLoad() : LS.get('mp.licence')) || {}; if (N.photoServer) this.server = await N.photoServer(); else this.server = (LS.get('mp.server') || this.server).replace(/\/+$/, ''); },
    async save() { if (N.licenseSave) await N.licenseSave(this.data); else LS.set('mp.licence', this.data); },
    async api(path, body = {}, method = 'POST', timeout) {
      if (N.photoApi) return N.photoApi({ path, body, method, token: this.token, timeout });
      const m = await this.machineInfo(), ac = new AbortController(), to = setTimeout(() => ac.abort(), timeout || 240000);
      try { const r = await fetch(this.server + path, { method, headers: { 'Content-Type': 'application/json', 'X-Photo-Machine': m.id, ...(this.token ? { 'X-Photo-Token': this.token } : {}) }, body: method === 'GET' ? undefined : JSON.stringify({ ...body, machineId: m.id }), signal: ac.signal }); let j = null; try { j = await r.json(); } catch (_) { j = {}; } return { status: r.status, json: j }; }
      catch (_) { return { status: 0, json: { error: T('Connexion au serveur Multipify impossible : vérifiez votre accès Internet.'), offline: true } }; } finally { clearTimeout(to); }
    },

    /* ---------- cycle de vie ---------- */
    async init() {
      await this.load(); const m = await this.machineInfo();
      if (this.token) await this.check(true); else await this.startTrial();
      this.renderBadge();
      clearInterval(this._timer); this._timer = setInterval(() => this.check(), 3 * 3600e3);
      let lastFocus = 0; window.addEventListener('focus', () => { if (Date.now() - lastFocus > 60e3 && this.token) { lastFocus = Date.now(); this.check(); } });
      void m;
    },
    async check(first = false) {
      const r = await this.api('/api/photo/check', { version: MP.version });
      if (r.status === 200 && r.json && r.json.success) { this.status = r.json; this.data.lastOk = Date.now(); this.data.cache = { state: r.json.state, credits: r.json.credits, license: r.json.license, offlineDays: r.json.offlineDays }; await this.save(); if (!r.json.valid) this.lock(r.json.state); else this.unlock(); this.updateCheck(); this.renderBadge(); return r.json; }
      if (r.status === 0) { // hors connexion : tolérance de quelques jours
        const days = (this.data.cache && this.data.cache.offlineDays) || 7;
        if (this.data.lastOk && Date.now() - this.data.lastOk < days * 864e5 && this.data.cache && this.data.cache.state !== 'expired') { this.status = { valid: true, offline: true, ...this.data.cache, credits: this.data.cache.credits }; this.unlock(); if (first) MP.toast(T('Hors connexion : licence vérifiée à la prochaine connexion'), 4000); this.renderBadge(); return this.status; }
        this.lock('offline'); return null;
      }
      const reason = (r.json && r.json.reason) || r.json.state || 'unknown';
      if (['moved', 'released', 'unknown', 'machine'].includes(reason)) { this.data.token = null; this.data.lostReason = reason; await this.save(); }
      this.status = { valid: false, state: reason, error: r.json && r.json.error }; this.lock(reason, r.json && r.json.error); this.renderBadge(); return null;
    },
    async startTrial() {
      const r = await this.api('/api/photo/trial', { machineName: this.machine.name, platform: this.machine.platform, version: MP.version });
      if (r.status === 200) { this.trial = r.json; if (r.json.active) { this.unlock(); const left = Math.max(0, Math.ceil((Date.parse(r.json.endsAt) - Date.now()) / 864e5)); setTimeout(() => MP.toast(T('Version d\'essai') + ' : ' + left + ' ' + T('jour(s) restant(s)') + ' — ' + T('IA : achetez un abonnement pour utiliser les crédits'), 6000), 1500); this.updateCheck(r.json.update); } else this.lock(this.data.lostReason || 'trial-ended'); }
      else if (r.status === 0) { const t = this.data.trialEnds; if (t && Date.parse(t) > Date.now()) this.unlock(); else this.lock('offline'); }
      else this.lock('no-licence');
      if (this.trial && this.trial.endsAt) { this.data.trialEnds = this.trial.endsAt; await this.save(); }
    },
    async activate(key) {
      const m = await this.machineInfo(), r = await this.api('/api/photo/activate', { key, machineName: m.name, platform: m.platform, version: MP.version });
      if (r.status === 200 && r.json.success) { this.data = { token: r.json.token, lastOk: Date.now(), cache: { state: r.json.state, credits: r.json.credits, license: r.json.license, offlineDays: r.json.offlineDays } }; await this.save(); this.status = r.json; this.unlock(); this.renderBadge(); MP.toast(T('Multipify Photo est activé sur cet ordinateur') + (r.json.movedFrom ? ' — ' + T('l\'ancien ordinateur a été désactivé') + ' (' + r.json.movedFrom + ')' : ''), 6000); return { ok: true }; }
      return { ok: false, error: (r.json && r.json.error) || T('Activation impossible.'), renewUrl: r.json && r.json.renewUrl };
    },
    async deactivate() { if (!confirm(T('Désactiver Multipify Photo sur cet ordinateur ? Vous pourrez activer la même clé sur un autre ordinateur.'))) return; await this.api('/api/photo/deactivate', {}); this.data = {}; await this.save(); this.status = null; this.lock('deactivated'); },

    /* ---------- écran de licence (bloquant) ---------- */
    lock(reason, error) {
      this.locked = true; document.body.classList.add('mp-locked'); let ov = document.getElementById('licence-overlay');
      const msgs = { moved: 'Cette clé a été activée sur un autre ordinateur : Multipify Photo est désactivé ici. Saisissez votre clé pour le réactiver sur ce PC (l\'autre ordinateur sera alors désactivé).', expired: 'Votre abonnement est arrivé à échéance. Réglez-le pour débloquer le logiciel : votre clé et vos crédits IA restent les mêmes.', revoked: 'Cette licence a été révoquée. Contactez le support Multipify.', 'trial-ended': 'Votre période d\'essai est terminée. Abonnez-vous pour continuer à utiliser Multipify Photo.', 'no-licence': 'Activez Multipify Photo avec votre clé, ou abonnez-vous.', offline: 'Impossible de vérifier votre licence : connectez-vous à Internet puis réessayez.', deactivated: 'Multipify Photo a été désactivé sur cet ordinateur.', machine: 'Cette activation appartient à un autre ordinateur. Saisissez votre clé.', unknown: 'Activation introuvable : saisissez de nouveau votre clé.', released: 'Licence désactivée sur cet ordinateur.', pending: 'Le paiement de votre licence n\'est pas encore confirmé.' };
      const text = T(msgs[reason] || error || msgs['no-licence']), price = this.status && this.status.priceCents || this.trial && this.trial.priceCents || 499;
      if (!ov) { ov = el('div', { id: 'licence-overlay' }); document.body.appendChild(ov); }
      ov.innerHTML = `<div class="lic-card"><img class="lic-logo" src="img/logo.png" alt=""><h1>Multipify <b class="mp-brand">Photo</b> <span class="lic-ver">${esc(MP.version)}</span></h1><p class="lic-msg">${esc(text)}</p>
        <label class="lic-lbl">${esc(T('Clé d\'activation'))}</label><input id="lic-key" class="lic-key" placeholder="MPH-XXXX-XXXX-XXXX-XXXX" spellcheck="false" autocomplete="off">
        <div class="lic-err" id="lic-err"></div><button class="lic-btn primary" id="lic-go">${esc(T('Activer sur cet ordinateur'))}</button>
        ${reason === 'expired' && this.status && this.status.license ? `<button class="lic-btn renew" id="lic-renew">${esc(T('Régler mon abonnement'))}</button>` : ''}
        <button class="lic-btn" id="lic-buy">${esc(T('S\'abonner'))} — ${esc(euros(price))} / ${esc(T('mois'))}</button>
        ${this.trial && this.trial.active ? `<button class="lic-btn ghost" id="lic-trial">${esc(T('Continuer l\'essai gratuit'))}</button>` : ''}
        <p class="lic-foot">${esc(T('Une clé = un ordinateur. Activer la clé sur un nouveau PC désactive automatiquement l\'ancien ; vos crédits IA suivent la clé.'))}</p>
        <button class="lic-link" id="lic-quit">${esc(T('Quitter'))}</button></div>`;
      const go = async () => { const k = ov.querySelector('#lic-key').value.trim(), e = ov.querySelector('#lic-err'), b = ov.querySelector('#lic-go'); if (!/^MPH/i.test(k.replace(/\s/g, ''))) { e.textContent = T('Saisissez une clé au format MPH-XXXX-XXXX-XXXX-XXXX.'); return; } b.disabled = true; b.textContent = T('Activation…'); const r = await this.activate(k); b.disabled = false; b.textContent = T('Activer sur cet ordinateur'); if (!r.ok) { e.textContent = r.error; if (r.renewUrl) { const a = el('button', { class: 'lic-btn renew' }, esc(T('Régler mon abonnement'))); a.onclick = () => this.open(r.renewUrl); e.appendChild(el('div')); e.appendChild(a); } } };
      ov.querySelector('#lic-go').onclick = go; ov.querySelector('#lic-key').onkeydown = (e) => { if (e.key === 'Enter') go(); };
      ov.querySelector('#lic-buy').onclick = () => this.open(this.salesUrl + '#tarifs');
      const rn = ov.querySelector('#lic-renew'); if (rn) rn.onclick = async () => { const r = await this.api('/api/photo/renew-checkout', {}); if (r.json && r.json.url) this.open(r.json.url); };
      const tr = ov.querySelector('#lic-trial'); if (tr) tr.onclick = () => this.unlock();
      ov.querySelector('#lic-quit').onclick = () => N.quit && N.quit();
      setTimeout(() => { const i = ov.querySelector('#lic-key'); i && i.focus(); }, 50);
    },
    unlock() { this.locked = false; document.body.classList.remove('mp-locked'); const ov = document.getElementById('licence-overlay'); if (ov) ov.remove(); },
    open(url) { if (N.openExternal) N.openExternal(url); else window.open(url, '_blank'); },

    /* ---------- crédits ---------- */
    renderBadge() {
      let b = document.getElementById('credit-badge'); const mb = document.getElementById('menubar'); if (!mb) return;
      if (!b) { b = el('button', { id: 'credit-badge', type: 'button', title: T('Licence et crédits IA') }); const brand = mb.querySelector('.langbtn') || mb.querySelector('.brand'); mb.insertBefore(b, brand); b.onclick = () => this.dialog(); }
      if (this.status && this.status.valid) b.textContent = '✨ ' + this.credits + ' ' + T('crédits');
      else if (this.trial && this.trial.active) b.textContent = '⏳ ' + T('Essai') + ' — ' + T('Activer');
      else b.textContent = '🔑 ' + T('Activer');
    },
    async buyCredits(packId) {
      if (!this.status || !this.status.valid) { MP.toast(T('Activez d\'abord votre licence (les crédits sont rattachés à votre clé)')); this.lock('no-licence'); return; }
      const before = this.credits, r = await this.api('/api/photo/credits/checkout', { pack: packId });
      if (!(r.status === 200 && r.json.checkoutUrl)) { MP.toast(T('Paiement indisponible') + ' : ' + ((r.json && r.json.error) || ''), 6000); return; }
      this.open(r.json.checkoutUrl); MP.toast(T('Page de paiement sécurisé Viva Wallet ouverte : les crédits s\'ajouteront automatiquement dès le paiement validé.'), 8000);
      const t0 = Date.now(), poll = async () => { if (Date.now() - t0 > 20 * 60e3) return; const s = await this.check(); if (s && s.credits > before) { MP.toast('✨ ' + (s.credits - before) + ' ' + T('crédits IA ajoutés') + ' — ' + T('solde') + ' : ' + s.credits, 7000); const d = document.querySelector('.modal-back .lic-acct'); if (d) { d.closest('.modal-back').remove(); this.dialog(); } return; } setTimeout(poll, 5000); };
      setTimeout(poll, 6000);
    },
    needCredits(cost) {
      const packs = this.packs;
      MP.ui.dialog({ title: '✨ ' + T('Crédits IA insuffisants'), width: 460, okLabel: T('Fermer'), noCancel: true, fields: [{ type: 'info', html: `<p>${esc(T('Cette action IA coûte'))} <b>${cost}</b> ${esc(T('crédits'))} — ${esc(T('solde'))} : <b>${this.credits}</b>.</p><p class="muted">${esc(T('Retouche photo IA'))} = ${this.costs.edit} ${esc(T('crédits'))}.</p>` },
        ...packs.map((p) => ({ type: 'button', label: `${T('Acheter')} ${p.credits} ${T('crédits')} — ${euros(p.cents)}`, action: () => { document.querySelectorAll('.modal-back').forEach((x) => x.querySelector('.lic-need') && x.remove()); this.buyCredits(p.id); } })), { type: 'info', html: '<span class="lic-need"></span>' }] });
    },
    async dialog() {
      if (this.token) await this.check(); const s = this.status, lic = s && s.license, packs = this.packs;
      const stTxt = { active: T('Active'), grace: T('Paiement en attente'), expired: T('Expirée'), revoked: T('Révoquée'), unused: T('Active') };
      const html = lic ? `<div class="lic-acct"><div class="lic-row"><span>${esc(T('Clé'))}</span><b>${esc(lic.keyMasked)}</b></div><div class="lic-row"><span>${esc(T('État'))}</span><b>${esc(stTxt[s.state] || s.state)}${s.offline ? ' (' + esc(T('hors connexion')) + ')' : ''}</b></div>
          ${lic.email ? `<div class="lic-row"><span>E-mail</span><b>${esc(lic.email)}</b></div>` : ''}<div class="lic-row"><span>${esc(T('Échéance'))}</span><b>${lic.periodEnd ? new Date(lic.periodEnd).toLocaleDateString() : esc(T('à vie'))}${lic.autoRenew ? ' — ' + esc(T('renouvellement automatique')) : ''}</b></div>
          <div class="lic-row big"><span>✨ ${esc(T('Crédits IA'))}</span><b>${s.credits}</b></div><p class="muted">${esc(T('Retouche photo IA'))} = ${this.costs.edit} ${esc(T('crédits'))} · ${esc(T('génération d\'image'))} = ${this.costs.generate} · ${esc(T('assistant IA'))} = ${this.costs.chat}. ${esc(T('Les crédits achetés s\'ajoutent automatiquement à cet ordinateur.'))}</p></div>`
        : `<div class="lic-acct"><p>${esc(T('Multipify Photo n\'est pas encore activé sur cet ordinateur.'))}${this.trial && this.trial.active ? ' ' + esc(T('Essai gratuit jusqu\'au')) + ' ' + new Date(this.trial.endsAt).toLocaleDateString() + '.' : ''}</p></div>`;
      MP.ui.dialog({ title: T('Licence et crédits IA'), width: 520, okLabel: T('Fermer'), noCancel: true, fields: [{ type: 'info', html },
        ...(lic ? packs.map((p) => ({ type: 'button', label: `✨ ${T('Acheter')} ${p.credits} ${T('crédits')} — ${euros(p.cents)}${p.badge ? ' (' + T(p.badge) + ')' : ''}`, action: () => this.buyCredits(p.id) })) : []),
        ...(lic && s.state === 'expired' ? [{ type: 'button', label: T('Régler mon abonnement'), action: async () => { const r = await this.api('/api/photo/renew-checkout', {}); if (r.json && r.json.url) this.open(r.json.url); } }] : []),
        { type: 'button', label: lic ? T('Changer de clé…') : T('Activer avec une clé…'), action: () => { document.querySelectorAll('.modal-back').forEach((x) => x.querySelector('.lic-acct') && x.remove()); this.lock(lic ? 'no-licence' : 'no-licence'); } },
        ...(lic ? [{ type: 'button', label: T('Désactiver sur cet ordinateur'), action: () => { document.querySelectorAll('.modal-back').forEach((x) => x.querySelector('.lic-acct') && x.remove()); this.deactivate(); } }] : []),
        { type: 'button', label: T('Page Multipify Photo (abonnement, téléchargements)'), action: () => this.open(this.salesUrl) }] });
    },

    /* ---------- mises à jour ---------- */
    updateCheck(u) {
      u = u || (this.status && this.status.update); if (!u || !u.latest) return; const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
      if (cmp(u.latest, MP.version) <= 0 || this._updShown === u.latest) return; this._updShown = u.latest;
      const plat = (this.machine && this.machine.platform || '').startsWith('darwin') ? (/arm64/.test(this.machine.platform) ? 'mac-arm64' : 'mac-x64') : 'win', f = u.files && (u.files[plat] || u.files.win);
      const forced = u.mandatory || (u.minVersion && cmp(MP.version, u.minVersion) < 0);
      MP.ui.dialog({ title: T('Mise à jour disponible') + ' — ' + u.latest, width: 480, okLabel: T('Télécharger la mise à jour'), noCancel: !!forced, fields: [{ type: 'info', html: `<p>${esc(T('Une nouvelle version de Multipify Photo est disponible. Votre licence et vos crédits sont conservés.'))}</p>${u.notes ? `<pre class="lic-notes">${esc(u.notes)}</pre>` : ''}` }], onOk: () => { this.open(f ? f.url : this.salesUrl + '#telecharger'); if (forced) return false; } });
    },
  };

  /* ---------- IA : passage par les crédits du serveur Multipify ---------- */
  const AI = MP.ai, r0 = AI.ready.bind(AI), req0 = AI.request.bind(AI), chat0 = AI.chat, det0 = MP.retouchAI && MP.retouchAI.detect.bind(MP.retouchAI);
  const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const shot = (c, max = 1024) => { const k = Math.min(1, max / Math.max(c.width, c.height)), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k)), t = MP.createCanvas(w, h), x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(c, 0, 0, w, h); return t.toDataURL('image/jpeg', 0.85); };
  const fail = (r) => { if (r.status === 402 && r.json && r.json.error === 'credits') { L.status && (L.status.credits = r.json.credits); L.renderBadge(); setTimeout(() => L.needCredits(r.json.cost || L.costs.edit), 50); throw new Error(T('crédits IA insuffisants')); } if (r.status === 401 || r.status === 403 || (r.status === 402 && r.json && r.json.reason)) { L.check(); throw new Error((r.json && r.json.error) || T('licence inactive')); } throw new Error((r.json && (r.json.message || r.json.error)) || T('service IA indisponible')); };
  const after = (j) => { if (j && typeof j.credits === 'number' && L.status) { L.status.credits = j.credits; if (L.data.cache) L.data.cache.credits = j.credits; L.renderBadge(); } };
  AI.enabled = () => !!(L.status && L.status.valid && !L.status.offline);
  AI.ready = () => {
    if (!L.status || !L.status.valid) { MP.toast(T('Les fonctions IA nécessitent une licence active (crédits IA rattachés à votre clé)'), 5000); L.lock(L.trial && L.trial.active ? 'no-licence' : 'no-licence'); return false; }
    if (L.status.offline) { MP.toast(T('Les fonctions IA nécessitent une connexion Internet')); return false; }
    if (L.credits < Math.min(L.costs.edit, L.costs.chat || L.costs.edit)) { L.needCredits(L.costs.edit); return false; }
    return true;
  };
  AI.request = async (endpoint, { json, form }) => {
    const body = endpoint === 'edits' ? { op: 'edit', prompt: form.prompt, size: form.size, quality: form.quality, background: form.background, image: toB64(form.image.data), mask: form.mask ? toB64(form.mask.data) : null } : { op: 'generate', prompt: json.prompt, size: json.size, quality: json.quality, background: json.background };
    const r = await L.api('/api/photo/ai/image', body, 'POST', 300000); if (r.status !== 200) fail(r); after(r.json);
    const j = r.json || {}, pick = (o) => { if (!o || typeof o !== 'object') return null; for (const v of [o.b64, o.b64_json, o.image, o.result, o.output, o.data && o.data[0] && (o.data[0].b64_json || o.data[0].b64), Array.isArray(o.images) && o.images[0] && (o.images[0].b64_json || o.images[0].b64 || o.images[0])]) if (typeof v === 'string' && v.length > 20 && !/^https?:/i.test(v)) return v; return o.data && !Array.isArray(o.data) ? pick(o.data) : null; };
    const raw = pick(j); if (!raw) throw new Error(T('le serveur n\'a pas renvoyé d\'image') + ' (' + (Object.keys(j).join(', ') || T('réponse vide')) + ')');
    const s = atob(raw.replace(/^data:image\/[a-z+.-]+;base64,/i, '').replace(/\s+/g, '')), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return MP.io.loadImage(a, 'ia.png');
  };
  if (chat0) AI.chat = async (o) => {
    const r = await L.api('/api/photo/ai/chat', { system: o.system, user: o.user, image: o.image ? shot(o.image) : null, history: o.history || [], json: o.json !== false, maxTokens: o.maxTokens }, 'POST', 150000); if (r.status !== 200) fail(r); after(r.json);
    const txt = r.json.content; if (o.json === false) return txt; const t = String(txt || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''); try { return JSON.parse(t); } catch (_) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); return JSON.parse(t.slice(a, b + 1)); }
  };
  if (det0) MP.retouchAI.detect = async (src) => {
    const r = await L.api('/api/photo/ai/detect', { image: shot(src) }, 'POST', 120000); if (r.status !== 200) fail(r); after(r.json);
    let j = {}; try { j = JSON.parse(r.json.content); } catch (_) { /* */ }
    const ok = (b) => b && [b.x, b.y, b.w, b.h].every((v) => typeof v === 'number' && isFinite(v)) && b.w > 0.005 && b.h > 0.005, norm = (a) => (Array.isArray(a) ? a.filter(ok).map((b) => ({ x: MP.clamp(b.x, 0, 1), y: MP.clamp(b.y, 0, 1), w: MP.clamp(b.w, 0, 1), h: MP.clamp(b.h, 0, 1) })) : []);
    return { faces: norm(j.faces), people: norm(j.people) };
  };
  // AI.run : message d'erreur déjà affiché pour les crédits
  const run0 = AI.run.bind(AI); AI.run = (label, fn) => run0(label, fn);

  /* ---------- Menu IA : crédits Multipify uniquement ---------- */
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), ia = (m.find((x) => x.label === 'IA') || { items: [] }).items;
    ia.unshift({ label: '✨ Crédits IA et licence…', act: () => L.dialog() });
    for (let i = ia.length - 1; i >= 0; i--) { const x = ia[i], lb = x && x.label ? String(x.label) : ''; if (/clé OpenAI|Modèles IA|clé API/.test(lb)) ia.splice(i, 1); }
    const help = (m.find((x) => x.label === 'Aide') || { items: [] }).items; help.push('-', { label: 'Licence et crédits IA…', act: () => L.dialog() }, { label: 'Rechercher des mises à jour', act: async () => { await L.check(); const u = L.status && L.status.update; if (!u || !u.latest || L._updShown === u.latest) MP.toast(T('Vous utilisez la dernière version') + ' (' + MP.version + ')'); } });
    return m;
  };
}
