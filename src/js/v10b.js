'use strict';
/* v10 (2/2) — interface multilingue (11 langues) : traduction automatique de toute l'interface affichée
   (menus, outils, panneaux, boîtes de dialogue, info-bulles, messages), changement de langue à chaud. */

MP.i18n = {
  LANGS: [['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Português'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['ru', 'Русский'], ['zh', '中文（简体）'], ['ja', '日本語']],
  ORDER: ['en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja'],
  dict: new Map(), lang: 'fr', orig: new WeakMap(), attrs: new WeakMap(),
  /** lignes « fr<TAB>en<TAB>es… » dans l'ordre de ORDER (cellule vide = non traduit) */
  add(lines, order = this.ORDER) { for (const ln of lines) { const c = ln.split('|'), fr = c[0]; let e = this.dict.get(fr); if (!e) this.dict.set(fr, (e = {})); order.forEach((l, i) => { if (c[i + 1]) e[l] = c[i + 1]; }); } },
  norm(s) { return s.replace(/\s+/g, ' ').trim(); },
  look(key) { const e = this.dict.get(key); if (!e) return null; return e[this.lang] || e.en || null; },
  /** traduit une chaîne (avec nombres variables, préfixes ✓ ✨…, suffixes « … » « : ») */
  t(src) {
    if (this.lang === 'fr' || !src || typeof src !== 'string') return src;
    const m = src.match(/^(\s*(?:[✓✨★▣🔴⚠👤💬🔗💾📷🖼⇲⤢•●🌐🔄⏸🔀↳]\s*)*)([\s\S]*?)(\s*(?:…|:|\.\.\.)?\s*)$/); if (!m) return src;
    const pre = m[1], core = this.norm(m[2]), post = m[3]; if (!core || !/[a-zA-Zà-ÿ]/.test(core)) return src;
    let r = this.look(core);
    if (!r) { const nums = []; const k = core.replace(/\d+(?:[.,]\d+)?/g, (x) => { nums.push(x); return '{n}'; }); if (nums.length) { const t = this.look(k); if (t) { let i = 0; r = t.replace(/\{n\}/g, () => nums[i++] ?? ''); } } }
    if (!r) for (const sep of [' › ', ' — ', ' : ', ' – ', ' / ']) if (core.includes(sep)) { const parts = core.split(sep), tr = parts.map((p) => this.t(p)); if (tr.some((x, i) => x !== parts[i])) { r = tr.join(sep === ' : ' ? ': ' : sep); break; } }
    if (!r && /^.+ \(.+\)$/.test(core)) { const mm = core.match(/^(.+?) \((.+)\)$/), a = this.t(mm[1]), b = this.t(mm[2]); if (a !== mm[1] || b !== mm[2]) r = `${a} (${b})`; }
    return r ? pre + r + post : src;
  },
  SKIP: '.lname, #tabs .tab > span:first-child, .cmt-t, .cmt-r, .fw-t, code, kbd, textarea, .rename, #infobox, .pc-hex, .tl-frame b, .exif td:last-child, .vitem b, script, style',
  textNode(n) {
    const p = n.parentElement; if (!p || p.closest(this.SKIP)) return;
    let o = this.orig.get(n); const cur = n.nodeValue;
    if (o === undefined || (cur !== o.tr && cur !== o.src)) { o = { src: cur, tr: null }; this.orig.set(n, o); }
    const tr = this.lang === 'fr' ? o.src : this.t(o.src); o.tr = tr; if (cur !== tr) n.nodeValue = tr;
  },
  attr(e, a) {
    if (e.closest && e.closest('.lname, .cmt, #tabs')) return; const v = e.getAttribute(a); if (!v) return;
    let m = this.attrs.get(e); if (!m) this.attrs.set(e, (m = {})); let o = m[a];
    if (!o || (v !== o.tr && v !== o.src)) o = m[a] = { src: v, tr: null };
    const tr = this.lang === 'fr' ? o.src : this.t(o.src); o.tr = tr; if (v !== tr) e.setAttribute(a, tr);
  },
  walk(root) {
    if (root.nodeType === 3) return this.textNode(root);
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n = root;
    do { if (n.nodeType === 3) this.textNode(n); else { if (n.hasAttribute('title')) this.attr(n, 'title'); if (n.hasAttribute('placeholder')) this.attr(n, 'placeholder'); } } while ((n = w.nextNode()));
  },
  observe() {
    this._busy = false;
    this.mo = new MutationObserver((list) => { if (this._busy) return; this._busy = true; try { for (const r of list) { if (r.type === 'childList') r.addedNodes.forEach((n) => this.walk(n)); else if (r.type === 'characterData') this.textNode(r.target); else if (r.type === 'attributes') this.attr(r.target, r.attributeName); } } finally { this._busy = false; } });
    this.mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder'] });
  },
  set(lang) {
    if (!this.LANGS.some((l) => l[0] === lang)) lang = 'en'; this.lang = lang; document.documentElement.lang = lang;
    try { localStorage.setItem('mp.lang', lang); } catch (_) { /* */ }
    this._busy = true; try { this.walk(document.body); } finally { this._busy = false; }
    document.title = this.t('Multipify Photo'); UI.buildMenus && UI.buildMenus(); UI.refreshAll && MP.ui && UI.refreshAll(); UI.refreshTool && MP.tool && UI.refreshTool();
    const lb = document.querySelector('.langbtn'); if (lb) lb.textContent = '🌐 ' + lang.toUpperCase();
  },
  detect() { let s = null; try { s = localStorage.getItem('mp.lang'); } catch (_) { /* */ } if (s) return s; const n = (navigator.language || 'fr').slice(0, 2).toLowerCase(); return this.LANGS.some((l) => l[0] === n) ? n : 'en'; },
  coverage(lang) { let n = 0; for (const e of this.dict.values()) if (e[lang]) n++; return Math.round((n / Math.max(1, this.dict.size)) * 100); },
};
{
  // textes dessinés sur la toile (commentaires, curseurs) et messages
  const toast = MP.toast; MP.toast = (msg, ms) => toast(MP.i18n.t(String(msg)), ms);
  const bm = UI.menus;
  UI.menus = () => {
    const m = bm(), ed = (m.find((x) => x.label === 'Édition') || { items: [] }).items, pi = ed.findIndex((x) => x && x !== '-' && String(typeof x.label === 'function' ? x.label() : x.label).startsWith('Préférences'));
    ed.splice(pi < 0 ? ed.length : pi + 1, 0, { label: 'Langue / Language', sub: () => MP.i18n.LANGS.map(([c, n]) => ({ label: (MP.i18n.lang === c ? '✓ ' : '') + n, act: () => MP.i18n.set(c) })) });
    return m;
  };
}
MP.v10init = () => {
  const i = MP.i18n; i.observe();
  const b = el('button', { class: 'langbtn', title: 'Langue / Language' }, '🌐 ' + i.detect().toUpperCase()); b.onclick = (e) => { const r = b.getBoundingClientRect(); UI.ctxMenu(r.left, r.bottom, i.LANGS.map(([c, n]) => ({ label: (i.lang === c ? '✓ ' : '') + n , act: () => { i.set(c); b.textContent = '🌐 ' + c.toUpperCase(); } }))); e.stopPropagation(); };
  const brand = document.querySelector('#menubar .brand'); if (brand) brand.before(b); else document.querySelector('#menubar').appendChild(b);
  i.set(i.detect()); b.textContent = '🌐 ' + i.lang.toUpperCase();
};
