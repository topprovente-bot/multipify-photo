'use strict';
/* v11 (1/3) — Noms de calques par défaut dans la langue de l'interface, bouton Assistant IA dans la barre contextuelle,
   métadonnées des RAW ouverts en aperçu (CR3, RAF compressé…). */
{
  const locName = (name) => {
    const i = MP.i18n; if (!i || i.lang === 'fr' || typeof name !== 'string' || !name) return name;
    const direct = i.look(name); if (direct) return direct;
    const nums = []; const k = name.replace(/\d+/g, (x) => { nums.push(x); return '{n}'; });
    if (nums.length && /^(Calque|Groupe|Copie de calque|Plan de travail) \{n\}$/.test(k)) { const t = i.look(k); if (t) { let j = 0; return t.replace(/\{n\}/g, () => nums[j++] ?? ''); } }
    return name;
  };
  MP.locLayerName = locName;
  const add0 = MP.Doc.prototype.addLayer;
  MP.Doc.prototype.addLayer = function (name, index) { const l = add0.call(this, name, index); l.name = locName(l.name); return l; };
  const L0 = MP.Layer;
  MP.Layer = class extends L0 { constructor(w, h, name) { super(w, h, locName(name)); } };
  // les nouveaux documents : « Arrière-plan » traduit
  const nd = MP.newDocument; if (nd) MP.newDocument = (...a) => { const r = nd(...a); const d = MP.doc; if (d) for (const l of d.layers) l.name = locName(l.name); MP.ui.refreshLayers && MP.ui.refreshLayers(); return r; };

  // Barre contextuelle : bouton Assistant IA
  if (UI.ctxbar) { const r0 = UI.ctxbar.render.bind(UI.ctxbar); UI.ctxbar.render = function () { r0(); const b = this.el; if (!b || !MP.doc || b.style.display === 'none') return; const more = [...b.querySelectorAll('button')].find((x) => x.textContent === '⋯'); const x = el('button', { class: 'cb ai', title: 'Assistant IA (Ctrl+Alt+A)' }, '✨ Assistant'); x.onclick = (e) => { e.preventDefault(); MP.assistant && MP.assistant.dialog(); }; b.insertBefore(x, more || null); if (MP.i18n && MP.i18n.lang !== 'fr') { x.textContent = MP.i18n.t('✨ Assistant'); x.title = MP.i18n.t('Assistant IA (Ctrl+Alt+A)'); } }; }

  // RAW ouverts en aperçu : nom de l'appareil d'après la boîte CMT1 (CR3) si l'EXIF n'a rien donné
  const of = MP.io.openFile;
  MP.io.openFile = async (f) => {
    const before = MP.doc; await of(f); const d = MP.doc;
    if (d && d !== before && /\.cr3$/i.test(f.name || '') && !(d.meta && d.meta.exif && d.meta.exif.model)) {
      try { const b = f.data; for (let i = 0; i < Math.min(b.length - 8, 4e6); i++) if (b[i] === 0x43 && b[i + 1] === 0x4d && b[i + 2] === 0x54 && b[i + 3] === 0x31) { const ex = MP.exif(b.subarray(i + 4, i + 4 + 65536)); if (ex) d.meta = { ...(d.meta || {}), exif: ex }; break; } } catch (_) { /* */ }
    }
  };
}
