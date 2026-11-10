'use strict';
/* Format Photoshop PSD : lecture (RVB / niveaux de gris 8 bits, calques, groupes, masques, RLE / ZIP) et écriture (RLE) */

const PSD_BLEND = { 'source-over': 'norm', multiply: 'mul ', screen: 'scrn', overlay: 'over', darken: 'dark', lighten: 'lite', 'color-dodge': 'div ', 'color-burn': 'idiv', 'hard-light': 'hLit', 'soft-light': 'sLit', difference: 'diff', exclusion: 'smud', hue: 'hue ', saturation: 'sat ', color: 'colr', luminosity: 'lum ', 'pass-through': 'pass' };
const PSD_BLEND_IN = Object.fromEntries(Object.entries(PSD_BLEND).map(([a, b]) => [b, a]));
Object.assign(PSD_BLEND_IN, { dsso: 'darken', lbrn: 'color-burn', dkCl: 'darken', lddg: 'color-dodge', lgCl: 'lighten', vLit: 'hard-light', lLit: 'hard-light', pLit: 'hard-light', hMix: 'hard-light', fsub: 'difference', fdiv: 'color-dodge', diss: 'source-over' });
const PSD_ADJ_KEYS = ['levl', 'curv', 'hue2', 'hue ', 'brit', 'blnc', 'expA', 'vibA', 'mixr', 'nvrt', 'post', 'thrs', 'grdm', 'phfl', 'selc', 'blwh', 'clrL', 'SoCo', 'GdFl', 'PtFl'];

class PsdWriter {
  constructor() { this.buf = new Uint8Array(1 << 16); this.n = 0; }
  ensure(k) { if (this.n + k <= this.buf.length) return; let s = this.buf.length * 2; while (s < this.n + k) s *= 2; const b = new Uint8Array(s); b.set(this.buf.subarray(0, this.n)); this.buf = b; }
  u8(v) { this.ensure(1); this.buf[this.n++] = v & 255; }
  u16(v) { this.ensure(2); this.buf[this.n++] = (v >> 8) & 255; this.buf[this.n++] = v & 255; }
  u32(v) { this.ensure(4); this.buf[this.n++] = (v >>> 24) & 255; this.buf[this.n++] = (v >>> 16) & 255; this.buf[this.n++] = (v >>> 8) & 255; this.buf[this.n++] = v & 255; }
  i32(v) { this.u32(v >>> 0); }
  i16(v) { this.u16(v & 0xffff); }
  str(s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  bytes(a) { this.ensure(a.length); this.buf.set(a, this.n); this.n += a.length; }
  pad(m) { while (this.n % m) this.u8(0); }
  out() { return this.buf.slice(0, this.n); }
}

const packBits = (src, off, len, out) => {
  let i = 0;
  while (i < len) {
    let j = i; while (j + 1 < len && src[off + j + 1] === src[off + i] && j - i < 127) j++;
    const run = j - i + 1;
    if (run >= 3) { out.push((257 - run) & 255, src[off + i]); i = j + 1; continue; }
    let k = i;
    while (k < len && k - i < 128) { if (k + 2 < len && src[off + k] === src[off + k + 1] && src[off + k] === src[off + k + 2]) break; k++; }
    out.push(k - i - 1); for (let m = i; m < k; m++) out.push(src[off + m]); i = k;
  }
};
/** Encode un plan w×h en RLE : renvoie { counts:Uint16 par ligne, data:Uint8Array } */
const rlePlane = (plane, w, h) => {
  const counts = new Array(h), all = [];
  for (let y = 0; y < h; y++) { const before = all.length; packBits(plane, y * w, w, all); counts[y] = all.length - before; }
  return { counts, data: Uint8Array.from(all) };
};
const planes = (canvas, x, y, w, h) => {
  const id = canvas.getContext('2d').getImageData(x, y, w, h).data, n = w * h;
  const p = [new Uint8Array(n), new Uint8Array(n), new Uint8Array(n), new Uint8Array(n)];
  for (let i = 0; i < n; i++) { p[0][i] = id[i * 4]; p[1][i] = id[i * 4 + 1]; p[2][i] = id[i * 4 + 2]; p[3][i] = id[i * 4 + 3]; }
  return p;
};

MP.psd = {
  /* ---------------- Écriture ---------------- */
  write(d) {
    const W = d.width, H = d.height, recs = [];
    const emit = (pid) => {
      for (const l of d.children(pid)) {
        if (l.isGroup) {
          recs.push({ name: '</Layer group>', section: 3, hidden: false, opacity: 255, blend: 'norm' });
          emit(l.id);
          recs.push({ name: l.name, section: l.collapsed ? 2 : 1, hidden: !l.visible, opacity: Math.round(l.opacity * 255), blend: PSD_BLEND[l.blend] || 'pass', mask: l.mask, maskOff: !l.maskEnabled });
        } else if (l.adjust) {
          // les calques de réglage ne sont pas exportables : ils sont ignorés dans le PSD
        } else {
          let src = l.canvas, mask = l.mask;
          if (MP.fx.has(l)) { src = MP.cloneCanvas(MP.fx.render(d, l, d.layerStatic(l))); mask = null; }
          recs.push({ name: l.name, hidden: !l.visible, opacity: Math.round(l.opacity * 255), blend: PSD_BLEND[l.blend] || 'norm', canvas: src, mask, maskOff: !l.maskEnabled, clip: l.clip });
        }
      }
    };
    emit(null);
    // pixels de chaque calque (rognés à leur contenu)
    for (const r of recs) {
      r.chans = [];
      const b = r.canvas ? MP.alphaBounds(r.canvas, 0) : null;
      r.rect = b ? { t: b.y, l: b.x, b: b.y + b.h, r: b.x + b.w } : { t: 0, l: 0, b: 0, r: 0 };
      if (b) {
        const p = planes(r.canvas, b.x, b.y, b.w, b.h);
        [[-1, 3], [0, 0], [1, 1], [2, 2]].forEach(([id, k]) => r.chans.push({ id, ...rlePlane(p[k], b.w, b.h) }));
      } else [-1, 0, 1, 2].forEach((id) => r.chans.push({ id, empty: true }));
      if (r.mask) { const p = planes(r.mask, 0, 0, W, H); r.chans.push({ id: -2, ...rlePlane(p[3], W, H) }); }
    }
    const L = new PsdWriter();
    L.i16(recs.length);
    for (const r of recs) {
      L.i32(r.rect.t); L.i32(r.rect.l); L.i32(r.rect.b); L.i32(r.rect.r);
      L.u16(r.chans.length);
      for (const c of r.chans) { L.i16(c.id); L.u32(c.empty ? 2 : 2 + c.counts.length * 2 + c.data.length); }
      L.str('8BIM'); L.str(r.blend); L.u8(r.opacity); L.u8(r.clip ? 1 : 0);
      L.u8((r.hidden ? 2 : 0) | (r.section ? 0x18 : 0x08)); L.u8(0);
      const X = new PsdWriter();
      if (r.mask) { X.u32(20); X.i32(0); X.i32(0); X.i32(H); X.i32(W); X.u8(0); X.u8(r.maskOff ? 2 : 0); X.u16(0); } else X.u32(0);
      X.u32(0); // plages de fusion
      const ascii = r.name.replace(/[^\x20-\x7e]/g, '?').slice(0, 255);
      X.u8(ascii.length); X.str(ascii); X.pad(4);
      // nom Unicode
      const lu = new PsdWriter(); lu.u32(r.name.length); for (const ch of r.name) { const code = ch.charCodeAt(0); lu.u16(code); } lu.pad(4);
      X.str('8BIM'); X.str('luni'); X.u32(lu.n); X.bytes(lu.out());
      if (r.section) { X.str('8BIM'); X.str('lsct'); if (r.section === 3) { X.u32(4); X.u32(3); } else { X.u32(12); X.u32(r.section); X.str('8BIM'); X.str(r.blend); } }
      const xb = X.out(); L.u32(xb.length); L.bytes(xb);
    }
    for (const r of recs) for (const c of r.chans) {
      if (c.empty) { L.u16(0); continue; }
      L.u16(1); for (const n of c.counts) L.u16(n); L.bytes(c.data);
    }
    L.pad(2);
    const layerInfo = L.out();
    // image fusionnée (sur fond blanc) pour la compatibilité
    const flat = MP.createCanvas(W, H), fc = flat.getContext('2d'); fc.fillStyle = '#fff'; fc.fillRect(0, 0, W, H); fc.drawImage(d.composite(null, { noLive: true }), 0, 0);
    const fp = planes(flat, 0, 0, W, H), enc = [0, 1, 2].map((k) => rlePlane(fp[k], W, H));
    const F = new PsdWriter();
    F.str('8BPS'); F.u16(1); F.bytes(new Uint8Array(6)); F.u16(3); F.u32(H); F.u32(W); F.u16(8); F.u16(3);
    F.u32(0); // données du mode couleur
    F.u32(0); // ressources d'image
    F.u32(4 + layerInfo.length + 4); F.u32(layerInfo.length); F.bytes(layerInfo); F.u32(0);
    F.u16(1); for (const e of enc) for (const n of e.counts) F.u16(n); for (const e of enc) F.bytes(e.data);
    return F.out();
  },

  /* ---------------- Lecture ---------------- */
  async read(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let p = 0;
    const u8 = () => bytes[p++], u16 = () => { const v = dv.getUint16(p); p += 2; return v; }, i16 = () => { const v = dv.getInt16(p); p += 2; return v; };
    const u32 = () => { const v = dv.getUint32(p); p += 4; return v; }, i32 = () => { const v = dv.getInt32(p); p += 4; return v; };
    const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[p++]); return s; };
    if (str(4) !== '8BPS') throw new Error('ce n\'est pas un fichier PSD');
    const version = u16(); if (version !== 1) throw new Error('les fichiers PSB (très grand format) ne sont pas pris en charge');
    p += 6; const nch = u16(), H = u32(), W = u32(), depth = u16(), mode = u16();
    if (depth !== 8) throw new Error(`profondeur ${depth} bits non prise en charge (8 bits uniquement)`);
    if (mode !== 3 && mode !== 1) throw new Error('mode couleur non pris en charge (RVB ou niveaux de gris uniquement)');
    const gray = mode === 1;
    const skip = () => { const n = u32(); p += n; };
    skip(); skip();
    const lmLen = u32(), lmEnd = p + lmLen, layers = [];
    if (lmLen > 0) {
      const liLen = u32(), liEnd = p + liLen;
      if (liLen > 0) {
        const count = Math.abs(i16());
        for (let i = 0; i < count; i++) {
          const r = { t: i32(), l: i32(), b: i32(), r: i32(), chans: [] };
          const nc = u16(); for (let c = 0; c < nc; c++) r.chans.push({ id: i16(), len: u32() });
          str(4); r.blend = str(4); r.opacity = u8(); r.clip = u8() === 1; r.flags = u8(); u8();
          const exLen = u32(), exEnd = p + exLen;
          const mLen = u32(), mEnd = p + mLen;
          if (mLen >= 18) { r.mask = { t: i32(), l: i32(), b: i32(), r: i32(), def: u8(), flags: u8() }; }
          p = mEnd; skip();
          const nl = u8(); r.name = str(nl); p += (4 - ((nl + 1) % 4)) % 4;
          while (p + 12 <= exEnd) {
            const sig = str(4); if (sig !== '8BIM' && sig !== '8B64') break;
            const key = str(4), len = u32(), end = p + len;
            if (key === 'luni') { const n = u32(); let s = ''; for (let k = 0; k < n; k++) s += String.fromCharCode(u16()); r.name = s.replace(/\0+$/, ''); }
            else if (key === 'lsct' || key === 'lsdk') { r.section = u32(); if (len >= 12) { str(4); r.blend = str(4); } }
            else if (PSD_ADJ_KEYS.includes(key)) r.adjustment = key;
            p = end + (len % 2);
          }
          p = exEnd; layers.push(r);
        }
        // données des couches
        for (const r of layers) {
          for (const c of r.chans) {
            const start = p, comp = u16();
            const isMask = c.id === -2 && r.mask, w = isMask ? r.mask.r - r.mask.l : r.r - r.l, h = isMask ? r.mask.b - r.mask.t : r.b - r.t;
            if (c.id < -2 || w <= 0 || h <= 0) { p = start + c.len; continue; }
            c.w = w; c.h = h;
            c.plane = await this.decode(bytes, p, start + c.len - p, comp, w, h);
            p = start + c.len;
          }
        }
      }
      p = liEnd;
    }
    p = lmEnd;
    // image fusionnée
    let merged = null;
    if (!layers.length) {
      const comp = u16(), n = W * H, ps = [];
      if (comp === 1) {
        const counts = []; for (let i = 0; i < nch * H; i++) counts.push(u16());
        for (let c = 0; c < nch; c++) { const pl = new Uint8Array(n); for (let y = 0; y < H; y++) { const cnt = counts[c * H + y]; this.unpack(bytes, p, cnt, pl, y * W, W); p += cnt; } ps.push(pl); }
      } else if (comp === 0) { for (let c = 0; c < nch; c++) { ps.push(bytes.slice(p, p + n)); p += n; } }
      else throw new Error('compression de l\'image fusionnée non prise en charge');
      merged = this.toCanvas(W, H, gray ? ps[0] : ps[0], gray ? ps[0] : ps[1], gray ? ps[0] : ps[2], !gray && nch > 3 ? null : null);
    }
    return { width: W, height: H, gray, layers, merged };
  },
  unpack(src, off, len, out, o, max) {
    let i = off; const end = off + len; let k = o; const lim = o + max;
    while (i < end && k < lim) {
      let n = src[i++]; if (n > 127) n -= 256;
      if (n >= 0) { for (let j = 0; j <= n && k < lim; j++) out[k++] = src[i++]; }
      else if (n !== -128) { const v = src[i++]; for (let j = 0; j < 1 - n && k < lim; j++) out[k++] = v; }
    }
  },
  async decode(bytes, off, len, comp, w, h) {
    const n = w * h, out = new Uint8Array(n);
    if (comp === 0) { out.set(bytes.subarray(off, off + n)); return out; }
    if (comp === 1) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), counts = [];
      for (let y = 0; y < h; y++) counts.push(dv.getUint16(off + y * 2));
      let q = off + h * 2;
      for (let y = 0; y < h; y++) { this.unpack(bytes, q, counts[y], out, y * w, w); q += counts[y]; }
      return out;
    }
    if (comp === 2 || comp === 3) {
      const ds = new DecompressionStream('deflate');
      const raw = new Uint8Array(await new Response(new Blob([bytes.slice(off, off + len)]).stream().pipeThrough(ds)).arrayBuffer());
      out.set(raw.subarray(0, n));
      if (comp === 3) for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) out[y * w + x] = (out[y * w + x] + out[y * w + x - 1]) & 255;
      return out;
    }
    return out;
  },
  toCanvas(w, h, r, g, b, a) {
    const c = MP.createCanvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h), D = id.data;
    for (let i = 0; i < w * h; i++) { D[i * 4] = r[i]; D[i * 4 + 1] = g[i]; D[i * 4 + 2] = b[i]; D[i * 4 + 3] = a ? a[i] : 255; }
    x.putImageData(id, 0, 0); return c;
  },
  /** Construit un document Multipify Photo à partir d'un PSD. */
  async toDoc(bytes, name) {
    const ps = await this.read(bytes), W = ps.width, H = ps.height;
    const d = new MP.Doc(W, H, name);
    if (!ps.layers.length) { const l = new MP.Layer(W, H, 'Arrière-plan'); l.canvas = ps.merged; d.layers.push(l); return d; }
    const stack = [null], out = [];
    for (const r of ps.layers) {
      if (r.section === 3) { const g = new MP.Layer(1, 1, 'Groupe'); g.isGroup = true; g.parent = stack.at(-1); stack.push(g.id); g._pending = true; out.push(g); continue; }
      let l;
      if (r.section === 1 || r.section === 2) {
        const gid = stack.length > 1 ? stack.pop() : null;
        l = out.find((x) => x.id === gid) || new MP.Layer(1, 1, r.name);
        const idx = out.indexOf(l); if (idx >= 0) out.splice(idx, 1);
        l.isGroup = true; l.collapsed = r.section === 2; delete l._pending;
      } else {
        l = new MP.Layer(W, H, r.name); l.parent = stack.at(-1);
        const ch = Object.fromEntries(r.chans.filter((c) => c.plane).map((c) => [c.id, c.plane]));
        const w = r.r - r.l, h = r.b - r.t;
        if (w > 0 && h > 0 && (ch[0] || ch[-1])) {
          const z = new Uint8Array(w * h), R = ch[0] || z, G = ps.gray ? R : ch[1] || z, B = ps.gray ? R : ch[2] || z;
          const tile = this.toCanvas(w, h, R, G, B, ch[-1] || null); l.ctx.drawImage(tile, r.l, r.t);
        }
      }
      l.name = r.name || l.name; if (r.adjustment) l.name += ' (réglage non pris en charge)';
      l.parent = stack.at(-1); l.visible = !(r.flags & 2); l.opacity = r.opacity / 255; l.clip = !!r.clip && !l.isGroup;
      l.blend = PSD_BLEND_IN[r.blend] || (l.isGroup ? 'pass-through' : 'source-over'); if (!l.isGroup && l.blend === 'pass-through') l.blend = 'source-over';
      const mc = r.chans.find((c) => c.id === -2 && c.plane);
      if (r.mask && mc) {
        const m = MP.createCanvas(W, H), mx = m.getContext('2d');
        if (r.mask.def >= 128) { mx.fillStyle = '#fff'; mx.fillRect(0, 0, W, H); }
        const t = MP.createCanvas(mc.w, mc.h), tx = t.getContext('2d'), id = tx.createImageData(mc.w, mc.h);
        for (let i = 0; i < mc.w * mc.h; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = mc.plane[i]; }
        tx.putImageData(id, 0, 0); mx.clearRect(r.mask.l, r.mask.t, mc.w, mc.h); mx.drawImage(t, r.mask.l, r.mask.t);
        l.mask = m; l.maskEnabled = !(r.mask.flags & 2);
      }
      out.push(l);
    }
    for (const l of out) if (l._pending) { delete l._pending; }
    d.layers = out; d.normalize(); d.active = d.layers.length - 1;
    return d;
  },
};
