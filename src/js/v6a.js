'use strict';
/* v6 (moteur 1/2) — formats (TIFF, BMP, GIF animé, PDF, RAW, EXIF, métadonnées, ppp), modes couleur, épreuvage CMJN,
   nouveaux filtres, effet Satin, options de fusion conditionnelle, rotation de l'affichage */

/* =================== Utilitaires binaires =================== */
class ByteW {
  constructor() { this.a = []; }
  u8(v) { this.a.push(v & 255); return this; }
  u16(v, le = true) { return le ? this.u8(v).u8(v >> 8) : this.u8(v >> 8).u8(v); }
  u32(v, le = true) { return le ? this.u16(v & 0xffff).u16(v >>> 16) : this.u16(v >>> 16, false).u16(v & 0xffff, false); }
  bytes(b) { for (let i = 0; i < b.length; i++) this.a.push(b[i]); return this; }
  str(s) { for (const ch of s) this.a.push(ch.charCodeAt(0) & 255); return this; }
  get length() { return this.a.length; }
  out() { return Uint8Array.from(this.a); }
}
const latin1 = (s) => String(s || '').normalize('NFC').replace(/[^\x20-\xff]/g, '?');
const imgData = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height);
const flatComposite = (d, bg) => { const c = MP.createCanvas(d.width, d.height), x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); } x.drawImage(d.composite(null, { noLive: true }), 0, 0); return c; };
MP.flatComposite = flatComposite;

/* =================== Conversion RVB → CMJN (sans profil ICC : séparation standard GCR, encrage max 300 %) =================== */
MP.cmyk = {
  INK: { c: [0, 158, 224], m: [226, 0, 122], y: [255, 237, 0], k: [35, 31, 32] }, PAPER: [250, 250, 247],
  sep(r, g, b, tac = 3) {
    r /= 255; g /= 255; b /= 255; const K = 1 - Math.max(r, g, b); if (K >= 0.999) return [0, 0, 0, 1];
    let C = (1 - r - K) / (1 - K), M = (1 - g - K) / (1 - K), Y = (1 - b - K) / (1 - K);
    const sum = C + M + Y + K; if (sum > tac) { const f = (tac - K) / (C + M + Y); C *= f; M *= f; Y *= f; }
    return [C, M, Y, K];
  },
  /** simulation d'impression (encres + papier) */
  simulate(C, M, Y, K) {
    const P = this.PAPER, I = this.INK, out = [0, 0, 0];
    for (let ch = 0; ch < 3; ch++) out[ch] = P[ch] * (1 - C * (1 - I.c[ch] / 255)) * (1 - M * (1 - I.m[ch] / 255)) * (1 - Y * (1 - I.y[ch] / 255)) * (1 - K * (1 - I.k[ch] / 255));
    return out;
  },
  /** table 32×32×32 pour l'épreuvage écran */
  lut() {
    if (this._lut) return this._lut; const L = new Uint8Array(32768 * 3), G = new Uint8Array(32768);
    for (let i = 0; i < 32768; i++) { const r = ((i >> 10) & 31) * 8.23, g = ((i >> 5) & 31) * 8.23, b = (i & 31) * 8.23; const s = this.simulate(...this.sep(r, g, b)); L[i * 3] = s[0]; L[i * 3 + 1] = s[1]; L[i * 3 + 2] = s[2]; G[i] = Math.hypot(r - s[0], g - s[1], b - s[2]) > 62 ? 1 : 0; }
    return (this._lut = { L, G });
  },
  /** octets CMJN entrelacés (fond blanc) */
  bytes(canvas) {
    const id = imgData(canvas), a = id.data, n = canvas.width * canvas.height, out = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { const al = a[i * 4 + 3] / 255, r = a[i * 4] * al + 255 * (1 - al), g = a[i * 4 + 1] * al + 255 * (1 - al), b = a[i * 4 + 2] * al + 255 * (1 - al); const s = this.sep(r, g, b); for (let k = 0; k < 4; k++) out[i * 4 + k] = Math.round(s[k] * 255); }
    return out;
  },
};
{
  const cv0 = MP.channelView;
  MP.channelView = (d, comp) => {
    if (MP.viewChannel && cv0) comp = cv0(d, comp);
    if (!MP.proof && !MP.gamutWarn) return comp;
    const key = `${d.rev}|${MP.proof}|${MP.gamutWarn}|${MP.viewChannel}`; if (d._proofKey === key && d._proofC) return d._proofC;
    const { L, G } = MP.cmyk.lut(), out = d._proofC && d._proofC.width === d.width && d._proofC.height === d.height ? d._proofC : MP.createCanvas(d.width, d.height);
    const x = out.getContext('2d'); x.clearRect(0, 0, d.width, d.height); x.drawImage(comp, 0, 0);
    const id = x.getImageData(0, 0, d.width, d.height), a = id.data;
    for (let i = 0; i < a.length; i += 4) {
      const q = ((a[i] >> 3) << 10) | ((a[i + 1] >> 3) << 5) | (a[i + 2] >> 3);
      if (MP.gamutWarn && G[q]) { a[i] = a[i + 1] = a[i + 2] = 128; continue; }
      if (MP.proof) { a[i] = L[q * 3]; a[i + 1] = L[q * 3 + 1]; a[i + 2] = L[q * 3 + 2]; }
    }
    x.putImageData(id, 0, 0); d._proofC = out; d._proofKey = key; return out;
  };
}

/* =================== Quantification (coupe médiane) =================== */
MP.quantize = (data, maxColors = 256, dither = false, w = 0) => {
  const hist = new Uint32Array(32768), n = data.length / 4;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] >= 128) hist[((data[i * 4] >> 3) << 10) | ((data[i * 4 + 1] >> 3) << 5) | (data[i * 4 + 2] >> 3)]++;
  const cols = []; for (let i = 0; i < 32768; i++) if (hist[i]) cols.push(i);
  const boxes = [cols];
  const range = (b) => { let r0 = 31, r1 = 0, g0 = 31, g1 = 0, b0 = 31, b1 = 0; for (const c of b) { const r = c >> 10, g = (c >> 5) & 31, bb = c & 31; r0 = Math.min(r0, r); r1 = Math.max(r1, r); g0 = Math.min(g0, g); g1 = Math.max(g1, g); b0 = Math.min(b0, bb); b1 = Math.max(b1, bb); } return [r1 - r0, g1 - g0, b1 - b0]; };
  while (boxes.length < maxColors) {
    let bi = -1, best = 0; boxes.forEach((b, i) => { if (b.length < 2) return; const r = range(b), s = Math.max(...r) * Math.log2(1 + b.reduce((t, c) => t + hist[c], 0)); if (s > best) { best = s; bi = i; } });
    if (bi < 0) break;
    const b = boxes[bi], r = range(b), ax = r.indexOf(Math.max(...r)), sh = [10, 5, 0][ax];
    b.sort((p, q) => ((p >> sh) & 31) - ((q >> sh) & 31));
    const tot = b.reduce((t, c) => t + hist[c], 0); let acc = 0, cut = 1; for (let i = 0; i < b.length - 1; i++) { acc += hist[b[i]]; if (acc >= tot / 2) { cut = i + 1; break; } }
    boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
  }
  const pal = boxes.filter((b) => b.length).map((b) => { let r = 0, g = 0, bb = 0, t = 0; for (const c of b) { const h = hist[c]; r += (c >> 10) * h; g += ((c >> 5) & 31) * h; bb += (c & 31) * h; t += h; } return [Math.round((r / t) * 8.226), Math.round((g / t) * 8.226), Math.round((bb / t) * 8.226)]; });
  if (!pal.length) pal.push([0, 0, 0]);
  const cache = new Int16Array(32768).fill(-1);
  const near = (r, g, b) => { const q = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); if (cache[q] >= 0) return cache[q]; let bi = 0, bd = 1e9; for (let i = 0; i < pal.length; i++) { const p = pal[i], dd = (p[0] - r) ** 2 * 3 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 2; if (dd < bd) { bd = dd; bi = i; } } return (cache[q] = bi); };
  const idx = new Uint8Array(n), transparent = pal.length; let hasT = false;
  if (dither && w) {
    const err = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      if (data[i * 4 + 3] < 128) { idx[i] = transparent; hasT = true; continue; }
      const r = MP.clamp(data[i * 4] + err[i * 3], 0, 255), g = MP.clamp(data[i * 4 + 1] + err[i * 3 + 1], 0, 255), b = MP.clamp(data[i * 4 + 2] + err[i * 3 + 2], 0, 255);
      const k = near(r | 0, g | 0, b | 0), p = pal[k]; idx[i] = k; const e = [r - p[0], g - p[1], b - p[2]], x = i % w;
      const add = (j, f) => { if (j < n) for (let c = 0; c < 3; c++) err[j * 3 + c] += e[c] * f; };
      if (x < w - 1) add(i + 1, 7 / 16); if (x > 0) add(i + w - 1, 3 / 16); add(i + w, 5 / 16); if (x < w - 1) add(i + w + 1, 1 / 16);
    }
  } else for (let i = 0; i < n; i++) { if (data[i * 4 + 3] < 128) { idx[i] = transparent; hasT = true; } else idx[i] = near(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]); }
  return { pal, idx, transparent: hasT ? transparent : -1 };
};

/* =================== Encodeurs =================== */
MP.enc = {
  /** PNG avec résolution (pHYs) et métadonnées (tEXt) */
  async png(canvas, { dpi, meta } = {}) {
    const b = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/png'))).arrayBuffer());
    const chunks = [];
    const chunk = (type, data) => { const w = new ByteW(); w.u32(data.length, false).str(type).bytes(data); const c = w.out(); const crc = crc32(c.subarray(4)); const o = new ByteW(); o.bytes(c).u32(crc, false); return o.out(); };
    if (dpi) { const ppm = Math.round(dpi / 0.0254), w = new ByteW(); w.u32(ppm, false).u32(ppm, false).u8(1); chunks.push(chunk('pHYs', w.out())); }
    for (const [k, v] of Object.entries({ Title: meta && meta.title, Author: meta && meta.author, Copyright: meta && meta.copyright, Description: meta && meta.description, Software: 'Multipify Photo' })) if (v) { const w = new ByteW(); w.str(k).u8(0).str(latin1(v)); chunks.push(chunk('tEXt', w.out())); }
    const at = 33, out = new Uint8Array(b.length + chunks.reduce((t, c) => t + c.length, 0)); out.set(b.subarray(0, at)); let p = at; for (const c of chunks) { out.set(c, p); p += c.length; } out.set(b.subarray(at), p); return out;
  },
  /** JPEG avec densité (JFIF) et commentaire */
  async jpeg(canvas, quality = 0.9, { dpi, meta } = {}) {
    const b = new Uint8Array(await (await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))).arrayBuffer());
    if (dpi && b[2] === 0xff && b[3] === 0xe0 && b[6] === 0x4a) { b[13] = 1; b[14] = dpi >> 8; b[15] = dpi & 255; b[16] = dpi >> 8; b[17] = dpi & 255; }
    const txt = meta ? [meta.title, meta.author && '© ' + meta.author, meta.copyright].filter(Boolean).join(' — ') : '';
    if (!txt) return b;
    const enc = new TextEncoder().encode(txt.slice(0, 60000)), seg = new ByteW(); seg.u8(0xff).u8(0xfe).u16(enc.length + 2, false).bytes(enc);
    const at = b[3] === 0xe0 ? 4 + ((b[4] << 8) | b[5]) : 2, s = seg.out(), out = new Uint8Array(b.length + s.length); out.set(b.subarray(0, at)); out.set(s, at); out.set(b.subarray(at), at + s.length); return out;
  },
  bmp(canvas) {
    const w = canvas.width, h = canvas.height, a = imgData(canvas).data, size = 54 + w * h * 4, o = new ByteW();
    o.str('BM').u32(size).u32(0).u32(54).u32(40).u32(w).u32(h).u16(1).u16(32).u32(0).u32(w * h * 4).u32(2835).u32(2835).u32(0).u32(0);
    const px = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((h - 1 - y) * w + x) * 4, dd = (y * w + x) * 4; px[dd] = a[s + 2]; px[dd + 1] = a[s + 1]; px[dd + 2] = a[s]; px[dd + 3] = a[s + 3]; }
    const head = o.out(), out = new Uint8Array(size); out.set(head); out.set(px, 54); return out;
  },
  /** TIFF non compressé : RVBA ou CMJN, résolution, auteur, copyright */
  tiff(canvas, { cmyk = false, dpi = 72, meta = {} } = {}) {
    const w = canvas.width, h = canvas.height, spp = 4;
    const pix = cmyk ? MP.cmyk.bytes(canvas) : imgData(canvas).data;
    const strs = []; const T = [];
    const tag = (id, type, count, val) => T.push({ id, type, count, val });
    tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, 4, 'bps'); tag(259, 3, 1, 1); tag(262, 3, 1, cmyk ? 5 : 2);
    if (meta.description) { tag(270, 2, 0, 'desc'); strs.desc = latin1(meta.description) + '\0'; }
    tag(273, 4, 1, 'data'); tag(277, 3, 1, spp); tag(278, 4, 1, h); tag(279, 4, 1, w * h * spp); tag(282, 5, 1, 'xres'); tag(283, 5, 1, 'yres'); tag(284, 3, 1, 1); tag(296, 3, 1, 2);
    tag(305, 2, 0, 'sw'); strs.sw = 'Multipify Photo\0';
    if (meta.author) { tag(315, 2, 0, 'art'); strs.art = latin1(meta.author) + '\0'; }
    if (!cmyk) tag(338, 3, 1, 2);
    if (meta.copyright) { tag(33432, 2, 0, 'cpy'); strs.cpy = latin1(meta.copyright) + '\0'; }
    T.sort((p, q) => p.id - q.id);
    const ifdOff = 8, ifdLen = 2 + T.length * 12 + 4; let extra = ifdOff + ifdLen; const ext = {};
    const reserve = (k, n) => { ext[k] = extra; extra += n + (n & 1); };
    reserve('bps', 8); reserve('xres', 8); reserve('yres', 8); for (const k of Object.keys(strs)) if (strs[k].length > 4) reserve(k, strs[k].length);
    const dataOff = extra, o = new ByteW(); o.str('II').u16(42).u32(ifdOff).u16(T.length);
    for (const t of T) {
      o.u16(t.id).u16(t.type);
      if (t.type === 2) { const sv = strs[t.val]; o.u32(sv.length); if (sv.length <= 4) { o.str(sv.padEnd(4, '\0')); } else o.u32(ext[t.val]); continue; }
      o.u32(t.count);
      if (t.val === 'bps' || t.val === 'xres' || t.val === 'yres') o.u32(ext[t.val]);
      else if (t.val === 'data') o.u32(dataOff);
      else if (t.type === 3) o.u16(t.val).u16(0); else o.u32(t.val);
    }
    o.u32(0);
    const pad = (n) => { if (n & 1) o.u8(0); };
    o.u16(8).u16(8).u16(8).u16(8); o.u32(dpi).u32(1); o.u32(dpi).u32(1);
    for (const k of Object.keys(strs)) if (strs[k].length > 4) { o.str(strs[k]); pad(strs[k].length); }
    const head = o.out(), out = new Uint8Array(dataOff + pix.length); out.set(head); out.set(pix, dataOff); return out;
  },
  /** GIF (animé ou non) : frames = [{canvas, delay(ms)}] */
  gif(frames, { loop = 0, dither = true } = {}) {
    const W = frames[0].canvas.width, H = frames[0].canvas.height, o = new ByteW();
    o.str('GIF89a').u16(W).u16(H).u8(0).u8(0).u8(0);
    if (frames.length > 1) o.u8(0x21).u8(0xff).u8(11).str('NETSCAPE2.0').u8(3).u8(1).u16(loop).u8(0);
    for (const f of frames) {
      const q = MP.quantize(imgData(f.canvas).data, 255, dither, W); let ncol = q.pal.length + (q.transparent >= 0 ? 1 : 0), bits = 1; while ((1 << bits) < ncol) bits++; bits = Math.max(bits, 1);
      o.u8(0x21).u8(0xf9).u8(4).u8((2 << 2) | (q.transparent >= 0 ? 1 : 0)).u16(Math.round((f.delay || 100) / 10)).u8(q.transparent >= 0 ? q.transparent : 0).u8(0);
      o.u8(0x2c).u16(0).u16(0).u16(W).u16(H).u8(0x80 | (bits - 1));
      for (let i = 0; i < (1 << bits); i++) { const p = q.pal[i] || [0, 0, 0]; o.u8(p[0]).u8(p[1]).u8(p[2]); }
      const minCode = Math.max(2, bits); o.u8(minCode);
      const data = MP.enc.lzw(q.idx, minCode); for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); o.u8(n); o.bytes(data.subarray(i, i + n)); }
      o.u8(0);
    }
    o.u8(0x3b); return o.out();
  },
  lzw(idx, minCode) {
    const out = []; let cur = 0, nbits = 0;
    const emit = (code, size) => { cur |= code << nbits; nbits += size; while (nbits >= 8) { out.push(cur & 255); cur >>>= 8; nbits -= 8; } };
    const clear = 1 << minCode, eoi = clear + 1; let size = minCode + 1, next = eoi + 1, dict = new Map();
    emit(clear, size); let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], key = (prefix << 8) | k, v = dict.get(key);
      if (v !== undefined) { prefix = v; continue; }
      emit(prefix, size);
      if (next === 4096) { emit(clear, size); next = eoi + 1; size = minCode + 1; dict = new Map(); }
      else { if (next >= (1 << size)) size++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix, size); emit(eoi, size); if (nbits > 0) out.push(cur & 255);
    return Uint8Array.from(out);
  },
  /** PDF : pages = [{canvas, dpi}] ; options : cmyk, bleed (mm), marks (traits de coupe), meta */
  async pdf(pages, { cmyk = false, bleed = 0, marks = false, meta = {}, quality = 0.92, icc = null, outputIntent = null } = {}) {
    const objs = [], enc = new TextEncoder(), add = (body) => { objs.push(body); return objs.length; };
    const pdfStr = (s) => { s = String(s || ''); if (/^[\x20-\x7e]*$/.test(s)) return '(' + s.replace(/[\\()]/g, '\\$&') + ')'; let h = 'FEFF'; for (const ch of s) { const c = ch.codePointAt(0); if (c > 0xffff) { const v = c - 0x10000; h += ((0xd800 + (v >> 10)).toString(16) + (0xdc00 + (v & 1023)).toString(16)).toUpperCase(); } else h += c.toString(16).padStart(4, '0').toUpperCase(); } return '<' + h + '>'; };
    const catalog = add(null), pagesId = add(null), kids = [];
    let iccObj = null; if (icc) { const z = new Uint8Array(await new Response(new Blob([icc]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); iccObj = add({ dict: `<< /N ${cmyk ? 4 : 3} /Alternate /Device${cmyk ? 'CMYK' : 'RGB'} /Filter /FlateDecode /Length ${z.length} >>`, stream: z }); }
    const csName = (dev) => (iccObj ? `[/ICCBased ${iccObj} 0 R]` : dev);
    for (const pg of pages) {
      const dpi = pg.dpi || 72, mm = 72 / 25.4, bl = bleed * mm, mk = marks ? 12 * mm : 0;
      let img = pg.canvas;
      if (bleed > 0) { const bp = Math.round((bleed / 25.4) * dpi), c = MP.createCanvas(img.width + bp * 2, img.height + bp * 2), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, img.width, 1, bp, 0, img.width, bp); x.drawImage(img, 0, img.height - 1, img.width, 1, bp, bp + img.height, img.width, bp); x.drawImage(img, 0, 0, 1, img.height, 0, bp, bp, img.height); x.drawImage(img, img.width - 1, 0, 1, img.height, bp + img.width, bp, bp, img.height); x.drawImage(img, bp, bp); img = c; }
      const tw = (pg.canvas.width / dpi) * 72, th = (pg.canvas.height / dpi) * 72, iw = tw + bl * 2, ih = th + bl * 2, PW = iw + mk * 2, PH = ih + mk * 2;
      let imgObj;
      if (cmyk) { const raw = MP.cmyk.bytes(img), z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); imgObj = add({ dict: `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${csName('/DeviceCMYK')} /BitsPerComponent 8 /Filter /FlateDecode /Length ${z.length} >>`, stream: z }); }
      else { const flat = MP.createCanvas(img.width, img.height), fx = flat.getContext('2d'); fx.fillStyle = '#fff'; fx.fillRect(0, 0, flat.width, flat.height); fx.drawImage(img, 0, 0); const j = new Uint8Array(await (await new Promise((r) => flat.toBlob(r, 'image/jpeg', quality))).arrayBuffer()); imgObj = add({ dict: `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${csName('/DeviceRGB')} /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>`, stream: j }); }
      let cs = `q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${mk.toFixed(2)} ${mk.toFixed(2)} cm /Im0 Do Q\n`;
      if (marks) {
        const x0 = mk + bl, y0 = mk + bl, x1 = x0 + tw, y1 = y0 + th, g = 3 * mm, L = mk - g; cs += `${cmyk ? '0 0 0 1 K' : '0 G'} 0.25 w\n`;
        for (const [x, y, dx, dy] of [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]]) cs += `${(x + dx * (bl + g)).toFixed(2)} ${y.toFixed(2)} m ${(x + dx * (bl + g + L)).toFixed(2)} ${y.toFixed(2)} l S ${x.toFixed(2)} ${(y + dy * (bl + g)).toFixed(2)} m ${x.toFixed(2)} ${(y + dy * (bl + g + L)).toFixed(2)} l S\n`;
      }
      const cb = enc.encode(cs), content = add({ dict: `<< /Length ${cb.length} >>`, stream: cb });
      const box = (a, b, c, d2) => `[${a.toFixed(2)} ${b.toFixed(2)} ${c.toFixed(2)} ${d2.toFixed(2)}]`;
      kids.push(add({ dict: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox ${box(0, 0, PW, PH)} /BleedBox ${box(mk, mk, mk + iw, mk + ih)} /TrimBox ${box(mk + bl, mk + bl, mk + bl + tw, mk + bl + th)} /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /Contents ${content} 0 R >>` }));
    }
    const oi = outputIntent && iccObj ? ` /OutputIntents [<< /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier ${pdfStr(outputIntent.name)} /Info ${pdfStr(outputIntent.name)} /DestOutputProfile ${iccObj} 0 R >>]` : '';
    objs[catalog - 1] = { dict: `<< /Type /Catalog /Pages ${pagesId} 0 R${oi} >>` };
    objs[pagesId - 1] = { dict: `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>` };
    const info = add({ dict: `<< /Producer (Multipify Photo) /Creator (Multipify Photo)${meta.title ? ' /Title ' + pdfStr(meta.title) : ''}${meta.author ? ' /Author ' + pdfStr(meta.author) : ''}${meta.description || meta.copyright ? ' /Subject ' + pdfStr([meta.description, meta.copyright].filter(Boolean).join(' — ')) : ''}${meta.keywords ? ' /Keywords ' + pdfStr(meta.keywords) : ''} >>` });
    const parts = [enc.encode('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')], offs = []; let len = parts[0].length;
    objs.forEach((o, i) => { offs.push(len); const head = enc.encode(`${i + 1} 0 obj\n${o.dict}\n`); parts.push(head); len += head.length; if (o.stream) { const s1 = enc.encode('stream\n'), s2 = enc.encode('\nendstream\n'); parts.push(s1, o.stream, s2); len += s1.length + o.stream.length + s2.length; } const e = enc.encode('endobj\n'); parts.push(e); len += e.length; });
    const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${len}\n%%EOF\n`;
    parts.push(enc.encode(xref)); return new Uint8Array(await new Blob(parts).arrayBuffer());
  },
};

/* =================== Décodeurs : TIFF, aperçu RAW, EXIF =================== */
const readIFD = (dv, off, le) => {
  const n = dv.getUint16(off, le), tags = {}, SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 11: 4, 12: 8 };
  for (let i = 0; i < n; i++) {
    const e = off + 2 + i * 12, id = dv.getUint16(e, le), type = dv.getUint16(e + 2, le), cnt = dv.getUint32(e + 4, le), sz = (SZ[type] || 1) * cnt, vo = sz <= 4 ? e + 8 : dv.getUint32(e + 8, le);
    tags[id] = {
      type, cnt, vo,
      vals() { const r = []; for (let k = 0; k < Math.min(cnt, 1 << 20); k++) { const p = vo + k * (SZ[type] || 1); if (p + (SZ[type] || 1) > dv.byteLength) break; r.push(type === 3 ? dv.getUint16(p, le) : type === 8 ? dv.getInt16(p, le) : type === 4 ? dv.getUint32(p, le) : type === 9 ? dv.getInt32(p, le) : type === 5 ? dv.getUint32(p, le) / (dv.getUint32(p + 4, le) || 1) : type === 10 ? dv.getInt32(p, le) / (dv.getInt32(p + 4, le) || 1) : type === 11 ? dv.getFloat32(p, le) : type === 12 ? dv.getFloat64(p, le) : type === 6 ? dv.getInt8(p) : dv.getUint8(p)); } return r; },
      str() { let s = ''; for (let k = 0; k < cnt && vo + k < dv.byteLength; k++) { const c = dv.getUint8(vo + k); if (!c) break; s += String.fromCharCode(c); } return s.trim(); },
    };
  }
  return { tags, next: dv.getUint32(off + 2 + n * 12, le) };
};
MP.exif = (bytes) => {
  try {
    let tiff = -1;
    if (bytes[0] === 0xff && bytes[1] === 0xd8) { let p = 2; while (p < bytes.length - 4 && bytes[p] === 0xff) { const m = bytes[p + 1], len = (bytes[p + 2] << 8) | bytes[p + 3]; if (m === 0xe1 && bytes[p + 4] === 0x45 && bytes[p + 5] === 0x78) { tiff = p + 10; break; } if (m === 0xda) break; p += 2 + len; } }
    else if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d)) tiff = 0;
    if (tiff < 0) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset + tiff, bytes.length - tiff), le = dv.getUint16(0) === 0x4949, ifd0 = readIFD(dv, dv.getUint32(4, le), le).tags, r = {};
    const S = (t, k) => { if (t[k]) return t[k].str(); }, V = (t, k) => { if (t[k]) return t[k].vals()[0]; };
    Object.assign(r, { make: S(ifd0, 0x10f), model: S(ifd0, 0x110), date: S(ifd0, 0x132), artist: S(ifd0, 0x13b), copyright: S(ifd0, 0x8298), description: S(ifd0, 0x10e), orientation: V(ifd0, 0x112) });
    if (ifd0[0x8769]) { const ex = readIFD(dv, ifd0[0x8769].vals()[0], le).tags; const et = V(ex, 0x829a); Object.assign(r, { exposure: et ? (et < 1 ? '1/' + Math.round(1 / et) : et + '') + ' s' : undefined, fnumber: V(ex, 0x829d) ? 'f/' + V(ex, 0x829d).toFixed(1) : undefined, iso: V(ex, 0x8827), dateOriginal: S(ex, 0x9003), focal: V(ex, 0x920a) ? Math.round(V(ex, 0x920a)) + ' mm' : undefined, lens: S(ex, 0xa434) }); }
    for (const k of Object.keys(r)) if (r[k] == null || r[k] === '') delete r[k];
    return Object.keys(r).length ? r : null;
  } catch (_) { return null; }
};
MP.decodeTiff = async (bytes) => {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), le = dv.getUint16(0) === 0x4949;
  if (dv.getUint16(2, le) !== 42) throw new Error('TIFF non pris en charge (BigTIFF ?)');
  const t = readIFD(dv, dv.getUint32(4, le), le).tags, G = (k, d) => (t[k] ? t[k].vals() : d);
  const W = G(256)[0], H = G(257)[0], bps = G(258, [1])[0], comp = G(259, [1])[0], photo = G(262, [2])[0], spp = G(277, [1])[0], pred = G(317, [1])[0], planar = G(284, [1])[0];
  if (planar !== 1) throw new Error('TIFF à plans séparés non pris en charge');
  if (![8, 16, 1, 32].includes(bps)) throw new Error(bps + ' bits par couche non pris en charge');
  const sfmt = G(339, [1])[0]; if (bps === 32 && sfmt !== 3) throw new Error('TIFF 32 bits entiers non pris en charge');
  const tiled = !!t[322], tw = tiled ? G(322)[0] : W, th = tiled ? G(323)[0] : G(278, [H])[0], offs = tiled ? G(324) : G(273), cnts = tiled ? G(325) : G(279);
  const lzw = (src, outLen) => {
    const out = new Uint8Array(outLen); let op = 0, bp = 0, size = 9, tab = [], prev = null;
    const reset = () => { tab = []; for (let i = 0; i < 256; i++) tab.push([i]); tab.push(null, null); size = 9; };
    reset();
    const read = () => { let v = 0; for (let i = 0; i < size; i++) { const byte = src[(bp + i) >> 3]; v = (v << 1) | ((byte >> (7 - ((bp + i) & 7))) & 1); } bp += size; return v; };
    while ((bp + size) >> 3 <= src.length && op < outLen) {
      const c = read(); if (c === 257) break;
      if (c === 256) { reset(); prev = null; continue; }
      let e; if (c < tab.length && tab[c]) e = tab[c]; else if (prev) e = prev.concat(prev[0]); else break;
      for (const v of e) { if (op < outLen) out[op++] = v; }
      if (prev) tab.push(prev.concat(e[0]));
      prev = e; if (tab.length + 1 >= (1 << size) && size < 12) size++;
    }
    return out;
  };
  const packbits = (src, outLen) => { const out = new Uint8Array(outLen); let i = 0, o = 0; while (i < src.length && o < outLen) { const n = (src[i++] << 24) >> 24; if (n >= 0) { for (let k = 0; k <= n && o < outLen; k++) out[o++] = src[i++]; } else if (n !== -128) { const v = src[i++]; for (let k = 0; k < 1 - n && o < outLen; k++) out[o++] = v; } } return out; };
  const inflate = async (src) => new Uint8Array(await new Response(new Blob([src]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const Bpp = (spp * bps) / 8, rowLen = Math.ceil((tw * spp * bps) / 8), out = new Uint8ClampedArray(W * H * 4);
  const hp = bps >= 16 && (photo === 2 || photo <= 1) ? new Float32Array(W * H * 3) : null, cmykRaw = photo === 5 && bps === 8 ? new Uint8Array(W * H * 4) : null;
  const cmap = G(320, null);
  for (let s = 0; s < offs.length; s++) {
    const raw = bytes.subarray(offs[s], offs[s] + cnts[s]), need = rowLen * th;
    let px = comp === 1 ? raw : comp === 5 ? lzw(raw, need) : comp === 8 || comp === 32946 ? await inflate(raw) : comp === 32773 ? packbits(raw, need) : null;
    if (!px) throw new Error('compression TIFF ' + comp + ' non prise en charge (JPEG ?)');
    const pdv = new DataView(px.buffer, px.byteOffset, px.byteLength);
    if (pred === 2 && bps === 8) for (let y = 0; y < th; y++) for (let x = spp; x < tw * spp; x++) px[y * rowLen + x] = (px[y * rowLen + x] + px[y * rowLen + x - spp]) & 255;
    const ox = tiled ? (s % Math.ceil(W / tw)) * tw : 0, oy = tiled ? Math.floor(s / Math.ceil(W / tw)) * th : s * th;
    for (let y = 0; y < th && oy + y < H; y++) for (let x = 0; x < tw && ox + x < W; x++) {
      const di = ((oy + y) * W + ox + x) * 4, si = y * rowLen + x * Bpp;
      const F = (k) => (bps === 32 ? pdv.getFloat32(si + k * 4, le) : bps === 16 ? pdv.getUint16(si + k * 2, le) / 65535 : 0);
      const S = (k) => (bps === 32 ? MP.clamp(Math.round(MP.linToSrgb ? MP.linToSrgb(pdv.getFloat32(si + k * 4, le)) * 255 : pdv.getFloat32(si + k * 4, le) * 255), 0, 255) : bps === 16 ? px[si + k * 2 + (le ? 1 : 0)] : bps === 1 ? ((px[y * rowLen + (x >> 3)] >> (7 - (x & 7))) & 1) * 255 : px[si + k]);
      let r, g, b, a = 255;
      if (photo === 2) { r = S(0); g = S(1); b = S(2); if (spp > 3) a = S(3); }
      else if (photo === 5) { const C = S(0), M = S(1), Y = S(2), K = S(3); if (cmykRaw) { const q = ((oy + y) * W + ox + x) * 4; cmykRaw[q] = C; cmykRaw[q + 1] = M; cmykRaw[q + 2] = Y; cmykRaw[q + 3] = K; } r = 255 - Math.min(255, C + K); g = 255 - Math.min(255, M + K); b = 255 - Math.min(255, Y + K); }
      else if (photo === 3 && cmap) { const v = S(0), n = cmap.length / 3; r = cmap[v] >> 8; g = cmap[n + v] >> 8; b = cmap[2 * n + v] >> 8; }
      else { r = g = b = photo === 0 ? 255 - S(0) : S(0); if (spp > 1) a = S(1); }
      out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = a;
      if (hp) { const q = ((oy + y) * W + ox + x) * 3; if (photo === 2) { hp[q] = F(0); hp[q + 1] = F(1); hp[q + 2] = F(2); } else { const g0 = photo === 0 ? 1 - F(0) : F(0); hp[q] = hp[q + 1] = hp[q + 2] = g0; } }
    }
  }
  const iccT = t[34675]; c_icc: { var icc = iccT ? bytes.slice(iccT.vo, iccT.vo + iccT.cnt) : null; }
  if (cmykRaw && icc && MP.cms) { try { MP.cms.cmykToRgbInto(icc, cmykRaw, out); } catch (e) { console.warn(e); } }
  const c = MP.createCanvas(W, H); c.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
  c._icc = photo === 5 ? null : icc; if (hp) { if (bps === 16 && MP.srgbToLin) for (let i = 0; i < hp.length; i++) hp[i] = MP.srgbToLin(hp[i]); c._hp = { w: W, h: H, data: hp, bits: bps === 32 ? 32 : 16 }; }
  const res = G(282, null); c._dpi = res ? Math.round(res[0]) : null; return c;
};
/** RAW : extrait le plus grand aperçu JPEG intégré par le boîtier */
MP.rawPreview = (bytes) => {
  let best = null;
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] !== 0xff || bytes[i + 1] !== 0xd8 || bytes[i + 2] !== 0xff) continue;
    let p = i + 2, ok = false;
    while (p < bytes.length - 3) {
      if (bytes[p] !== 0xff) break; const m = bytes[p + 1]; if (m === 0xd9) { ok = true; p += 2; break; }
      const len = (bytes[p + 2] << 8) | bytes[p + 3]; p += 2 + len;
      if (m === 0xda) { while (p < bytes.length - 1 && !(bytes[p] === 0xff && bytes[p + 1] !== 0 && !(bytes[p + 1] >= 0xd0 && bytes[p + 1] <= 0xd7))) p++; }
    }
    if (ok && (!best || p - i > best[1] - best[0])) best = [i, p];
    if (ok) i = p - 1;
  }
  return best && best[1] - best[0] > 2000 ? bytes.subarray(best[0], best[1]) : null;
};
const RAW_EXT = ['dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'orf', 'rw2', 'raf', 'pef', 'srw', 'raw', 'rwl', '3fr', 'erf', 'kdc', 'mos', 'x3f'];
IMAGE_EXT.push('tif', 'tiff', ...RAW_EXT);
{
  const of0 = MP.io.openFile.bind(MP.io);
  MP.io.openFile = async (f) => {
    const e = ext(f.name);
    try {
      if (e === 'tif' || e === 'tiff' || RAW_EXT.includes(e)) {
        let c, info = '';
        if (e === 'tif' || e === 'tiff') c = await MP.busy('Ouverture du TIFF…', () => MP.decodeTiff(f.data));
        else {
          const jp = MP.rawPreview(f.data); if (!jp) throw new Error('aucun aperçu exploitable dans ce fichier RAW');
          c = await MP.io.loadImage(jp, 'apercu.jpg'); info = ' (aperçu développé par l\'appareil — utilisez Filtre > Camera Raw pour les réglages)';
        }
        const d = new MP.Doc(c.width, c.height, f.name), l = d.addLayer('Arrière-plan', 0); l.canvas = c; d.sourcePath = f.path; d.dpi = c._dpi || 72;
        d.meta = { exif: MP.exif(f.data) }; MP.addDoc(d); MP.io.addRecent(f.path); if (info) MP.toast(f.name + info, 5000);
        if (RAW_EXT.includes(e)) setTimeout(() => MP.smart && MP.doc === d && MP.smart.convert(), 50);
        return;
      }
    } catch (err) { MP.toast('Impossible d\'ouvrir ' + f.name + ' : ' + err.message, 5000); return; }
    await of0(f);
    if (MP.doc && /jpe?g|png|webp/.test(e)) { const ex = MP.exif(f.data); if (ex) MP.doc.meta = { ...(MP.doc.meta || {}), exif: ex, author: ex.artist || '', copyright: ex.copyright || '' }; }
  };
}

/* =================== Métadonnées et résolution dans les projets =================== */
const idsToIdx = (d, st) => { const o = {}; for (const [id, v] of Object.entries(st || {})) { const i = d.layers.findIndex((l) => l.id === +id); if (i >= 0) o[i] = v; } return o; };
const idxToIds = (d, st) => { const o = {}; for (const [i, v] of Object.entries(st || {})) { const l = d.layers[+i]; if (l) o[l.id] = v; } return o; };
{
  const ser = MP.io.serialize.bind(MP.io), op = MP.io.openProject.bind(MP.io);
  MP.io.serialize = (d) => {
    const j = JSON.parse(ser(d)); j.version = 6;
    Object.assign(j, { dpi: d.dpi || 72, meta: d.meta || null, mode: d.mode || null, artboards: d.artboards || [], paths: d.paths || [], comps: (d.comps || []).map((c) => ({ ...c, state: idsToIdx(d, c.state) })), frames: (d.frames || []).map((f) => ({ ...f, state: idsToIdx(d, f.state) })), anim: d.anim || null });
    return JSON.stringify(j);
  };
  MP.io.openProject = async (f) => {
    await op(f); const j = JSON.parse(new TextDecoder().decode(f.data)), d = MP.doc;
    Object.assign(d, { dpi: j.dpi || 72, meta: j.meta || null, mode: j.mode || null, artboards: j.artboards || [], paths: j.paths || [], comps: (j.comps || []).map((c) => ({ ...c, state: idxToIds(d, c.state) })), frames: (j.frames || []).map((fr) => ({ ...fr, state: idxToIds(d, fr.state) })), anim: j.anim || null });
    MP.fontCheck && MP.fontCheck(d); MP.ui.refreshAll();
  };
}

/* =================== Modes couleur (Image > Mode) =================== */
MP.colorMode = {
  flattenTo(label, fn) {
    const d = MP.doc; d.history.record(label, 'all');
    const c = flatComposite(d, '#ffffff'), x = c.getContext('2d'), id = x.getImageData(0, 0, c.width, c.height); fn(id.data, c.width, c.height); x.putImageData(id, 0, 0);
    const keep = d.layers[0]; d.layers = [keep]; Object.assign(keep, { name: 'Arrière-plan', canvas: c, mask: null, visible: true, opacity: 1, blend: 'source-over', parent: null, isGroup: false, adjust: null, fx: null, text: null, smart: null, clip: false, fill: 1, blendIf: null });
    d.active = 0; d.normalize(); MP.afterEdit(); MP.ui.refreshAll();
  },
  bitmap(v) {
    this.flattenTo('Mode bitmap', (a, w, h) => {
      const L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = a[i * 4] * 0.299 + a[i * 4 + 1] * 0.587 + a[i * 4 + 2] * 0.114;
      const B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, o = L[i]; let v1;
        if (v.method === 'threshold') v1 = o >= v.thr ? 255 : 0;
        else if (v.method === 'pattern') v1 = o > ((B[y & 3][x & 3] + 0.5) / 16) * 255 ? 255 : 0;
        else if (v.method === 'halftone') { const s = v.cell, cx = (Math.floor(x / s) + 0.5) * s, cy = (Math.floor(y / s) + 0.5) * s, r = Math.hypot(x - cx, y - cy) / (s * 0.71); v1 = r < Math.sqrt(1 - o / 255) ? 0 : 255; }
        else { v1 = o >= 128 ? 255 : 0; const e = o - v1; if (x < w - 1) L[i + 1] += (e * 7) / 16; if (y < h - 1) { if (x > 0) L[i + w - 1] += (e * 3) / 16; L[i + w] += (e * 5) / 16; if (x < w - 1) L[i + w + 1] += e / 16; } }
        a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = v1; a[i * 4 + 3] = 255;
      }
    });
    MP.doc.mode = 'bitmap';
  },
  indexed(v) {
    this.flattenTo('Couleurs indexées', (a, w) => { const q = MP.quantize(a, v.colors, v.dither, w); for (let i = 0; i < q.idx.length; i++) { const p = q.pal[q.idx[i]] || [255, 255, 255]; a[i * 4] = p[0]; a[i * 4 + 1] = p[1]; a[i * 4 + 2] = p[2]; a[i * 4 + 3] = 255; } });
    MP.doc.mode = 'indexed'; MP.doc.indexedColors = v.colors;
  },
  duotone(v) {
    const A = MP.hexToRgb(v.ink1), B = MP.hexToRgb(v.ink2), tri = v.ink3 && v.three ? MP.hexToRgb(v.ink3) : null;
    this.flattenTo('Bichromie', (a) => {
      for (let i = 0; i < a.length; i += 4) {
        const t = 1 - (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) / 255, t1 = Math.pow(t, 0.9), t2 = Math.pow(t, 1 + v.curve / 50), t3 = Math.pow(t, 2.4);
        for (const [k, c] of [[0, 'r'], [1, 'g'], [2, 'b']]) { let x = 255 * (1 - t1 * (1 - A[c] / 255)) * (1 - t2 * (1 - B[c] / 255)); if (tri) x *= 1 - t3 * (1 - tri[c] / 255); a[i + k] = x; }
      }
    });
    MP.doc.mode = 'duotone';
  },
  rgb() { const d = MP.doc; d.history.record('Couleurs RVB', null); d.mode = null; MP.toast('Document en couleurs RVB'); MP.ui.refreshAll(); },
};

/* =================== Nouveaux filtres =================== */
const sample4 = (a, w, h, x, y, ch) => { x = MP.clamp(x, 0, w - 1.001); y = MP.clamp(y, 0, h - 1.001); const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, i = (y0 * w + x0) * 4 + ch; return (a[i] * (1 - tx) + a[i + 4] * tx) * (1 - ty) + (a[i + w * 4] * (1 - tx) + a[i + w * 4 + 4] * tx) * ty; };
Object.assign(MP.FILTERS, {
  lensCorrect: {
    title: 'Correction de l\'objectif', heavy: true,
    fields: [{ type: 'header', label: 'Distorsion' }, { k: 'dist', label: 'Barillet / coussinet', type: 'range', min: -100, max: 100 }, { k: 'scale', label: 'Échelle', type: 'range', min: 70, max: 130, unit: '%' }, { type: 'header', label: 'Aberration chromatique' }, { k: 'car', label: 'Frange rouge / cyan', type: 'range', min: -100, max: 100 }, { k: 'cab', label: 'Frange bleue / jaune', type: 'range', min: -100, max: 100 }, { type: 'header', label: 'Vignetage' }, { k: 'vig', label: 'Quantité', type: 'range', min: -100, max: 100 }, { k: 'vmid', label: 'Point médian', type: 'range', min: 0, max: 100 }],
    values: { dist: 0, scale: 100, car: 0, cab: 0, vig: 0, vmid: 50 },
    render(src, v) {
      const w = src.width, h = src.height, s = imgData(src).data, out = MP.createCanvas(w, h), oc = out.getContext('2d'), od = oc.createImageData(w, h), o = od.data;
      const cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy), k = -v.dist / 250, sc = 100 / v.scale, kr = 1 + v.car / 4000, kb = 1 + v.cab / 4000;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x - cx) / R, dy = (y - cy) / R, r2 = dx * dx + dy * dy, f = (1 + k * r2) * sc, i = (y * w + x) * 4;
        const gx = cx + dx * f * R, gy = cy + dy * f * R;
        o[i] = sample4(s, w, h, cx + (gx - cx) * kr, cy + (gy - cy) * kr, 0); o[i + 1] = sample4(s, w, h, gx, gy, 1); o[i + 2] = sample4(s, w, h, cx + (gx - cx) * kb, cy + (gy - cy) * kb, 2); o[i + 3] = sample4(s, w, h, gx, gy, 3);
        if (v.vig) { const t = Math.pow(Math.min(1, Math.sqrt(r2) * 1.414), 1 + (100 - v.vmid) / 25), m = 1 + (v.vig / 100) * t; for (let c = 0; c < 3; c++) o[i + c] = MP.clamp(v.vig > 0 ? o[i + c] + (255 - o[i + c]) * (m - 1) : o[i + c] * m, 0, 255); }
      }
      oc.putImageData(od, 0, 0); return out;
    },
  },
  smartSharpen: {
    title: 'Netteté optimisée', fields: [{ k: 'amt', label: 'Gain', type: 'range', min: 1, max: 500, unit: '%' }, { k: 'r', label: 'Rayon', type: 'range', min: 0.2, max: 64, step: 0.1, unit: 'px' }, { k: 'nr', label: 'Réduire le bruit', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'sh', label: 'Atténuer dans les tons foncés', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'hi', label: 'Atténuer dans les tons clairs', type: 'range', min: 0, max: 100, unit: '%' }],
    values: { amt: 150, r: 1.2, nr: 10, sh: 0, hi: 0 },
    render(src, v) {
      const b = imgData(MP.blurCanvas(src, v.r)).data, out = MP.cloneCanvas(src), x = out.getContext('2d'), id = x.getImageData(0, 0, out.width, out.height), a = id.data, k = v.amt / 100, thr = v.nr * 0.3;
      for (let i = 0; i < a.length; i += 4) {
        const L = (a[i] + a[i + 1] + a[i + 2]) / 765, att = 1 - (v.sh / 100) * Math.max(0, 1 - L * 3) - (v.hi / 100) * Math.max(0, L * 3 - 2);
        for (let c = 0; c < 3; c++) { const dd = a[i + c] - b[i + c]; if (Math.abs(dd) > thr) a[i + c] = MP.clamp(a[i + c] + dd * k * att * (1 - thr / Math.max(thr + 1, Math.abs(dd))), 0, 255); }
      }
      x.putImageData(id, 0, 0); return out;
    },
  },
  shake: {
    title: 'Réduction du tremblement', fields: [{ k: 'a', label: 'Angle du flou', type: 'range', min: -180, max: 180, unit: '°' }, { k: 'd', label: 'Longueur du flou', type: 'range', min: 2, max: 60, unit: 'px' }, { k: 'k', label: 'Correction', type: 'range', min: 0, max: 300, unit: '%' }, { k: 'it', label: 'Passes', type: 'range', min: 1, max: 4 }],
    values: { a: 0, d: 8, k: 120, it: 2 },
    render(src, v) {
      let cur = src;
      for (let p = 0; p < v.it; p++) {
        const m = imgData(MP.FILTERS.motion.render(cur, { a: v.a, d: v.d })).data, out = MP.cloneCanvas(cur), x = out.getContext('2d'), id = x.getImageData(0, 0, out.width, out.height), a = id.data, k = v.k / 100 / v.it;
        for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) a[i + c] = MP.clamp(a[i + c] + (a[i + c] - m[i + c]) * k, 0, 255);
        x.putImageData(id, 0, 0); cur = out;
      }
      return cur;
    },
  },
  fibers: {
    title: 'Fibres', fields: [{ k: 'var', label: 'Variance', type: 'range', min: 1, max: 64 }, { k: 'str', label: 'Intensité', type: 'range', min: 1, max: 64 }, { k: 'seed', label: 'Variation', type: 'range', min: 1, max: 999 }], values: { var: 16, str: 4, seed: 3 },
    render(src, v) {
      const A = MP.hexToRgb(MP.colors.fg), B = MP.hexToRgb(MP.colors.bg);
      return pixelOp(src, (s, d, w, h) => { const fx = 1 / Math.max(2, 70 - v.var), fy = fx / (v.str * 2); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let n = 0, amp = 0.5, f = 1; for (let o = 0; o < 4; o++) { n += vnoise(x * fx * f, y * fy * f, v.seed + o) * amp; amp /= 2; f *= 2.3; } n = MP.clamp((n - 0.5) * 1.8 + 0.5, 0, 1); const i = (y * w + x) * 4; d[i] = MP.lerp(A.r, B.r, n); d[i + 1] = MP.lerp(A.g, B.g, n); d[i + 2] = MP.lerp(A.b, B.b, n); d[i + 3] = 255; } });
    },
  },
  spin: {
    title: 'Flou de rotation', fields: [{ k: 'a', label: 'Angle de flou', type: 'range', min: 1, max: 360, unit: '°' }, { k: 'cx', label: 'Centre X', type: 'range', min: 0, max: 100, unit: '%' }, { k: 'cy', label: 'Centre Y', type: 'range', min: 0, max: 100, unit: '%' }], values: { a: 15, cx: 50, cy: 50 },
    render(src, v) {
      const w = src.width, h = src.height, out = MP.createCanvas(w, h), x = out.getContext('2d'), n = Math.max(8, Math.min(60, Math.round(v.a * 1.5))), cx = (w * v.cx) / 100, cy = (h * v.cy) / 100;
      for (let i = 0; i < n; i++) { const t = ((i / (n - 1) - 0.5) * v.a * Math.PI) / 180; x.save(); x.globalAlpha = 1 / (i + 1); x.translate(cx, cy); x.rotate(t); x.translate(-cx, -cy); x.drawImage(src, 0, 0); x.restore(); }
      return out;
    },
  },
  fieldBlur: {
    title: 'Flou de champ (dégradé de flou)', fields: [{ k: 'top', label: 'Flou en haut', type: 'range', min: 0, max: 80, unit: 'px' }, { k: 'mid', label: 'Flou au centre', type: 'range', min: 0, max: 80, unit: 'px' }, { k: 'bot', label: 'Flou en bas', type: 'range', min: 0, max: 80, unit: 'px' }], values: { top: 0, mid: 0, bot: 20 },
    render(src, v) {
      const h = src.height, out = MP.cloneCanvas(src), x = out.getContext('2d'), levels = [...new Set([v.top, v.mid, v.bot])].sort((a, b) => a - b), blurs = Object.fromEntries(levels.map((r) => [r, r ? MP.blurCanvas(src, r) : src]));
      for (let y = 0; y < h; y += 4) { const t = y / h, r = t < 0.5 ? MP.lerp(v.top, v.mid, t * 2) : MP.lerp(v.mid, v.bot, t * 2 - 2 + 1); let lo = levels[0], hi = levels[levels.length - 1]; for (const l of levels) { if (l <= r) lo = l; if (l >= r) { hi = l; break; } } const f = hi === lo ? 0 : (r - lo) / (hi - lo); x.globalAlpha = 1; x.drawImage(blurs[lo], 0, y, src.width, 4, 0, y, src.width, 4); if (f > 0) { x.globalAlpha = f; x.drawImage(blurs[hi], 0, y, src.width, 4, 0, y, src.width, 4); } }
      x.globalAlpha = 1; return out;
    },
  },
  rawDetail: {
    title: 'Camera Raw : texture, détail, mélangeur de couleurs, optique', heavy: true,
    fields: [
      { type: 'header', label: 'Présence et détail' }, { k: 'tex', label: 'Texture', type: 'range', min: -100, max: 100 }, { k: 'sharp', label: 'Netteté', type: 'range', min: 0, max: 150 }, { k: 'srad', label: 'Rayon netteté', type: 'range', min: 0.5, max: 3, step: 0.1 }, { k: 'nr', label: 'Réduction du bruit (luminance)', type: 'range', min: 0, max: 100 }, { k: 'nrc', label: 'Réduction du bruit (couleur)', type: 'range', min: 0, max: 100 },
      { type: 'header', label: 'Mélangeur de couleurs — TSL' },
      ...['Rouges', 'Jaunes', 'Verts', 'Cyans', 'Bleus', 'Magentas'].flatMap((n, i) => [{ k: 'h' + i, label: n + ' : teinte', type: 'range', min: -100, max: 100 }, { k: 's' + i, label: n + ' : saturation', type: 'range', min: -100, max: 100 }, { k: 'l' + i, label: n + ' : luminance', type: 'range', min: -100, max: 100 }]),
      { type: 'header', label: 'Étalonnage' }, { k: 'shTint', label: 'Teinte des ombres', type: 'range', min: -100, max: 100 },
      { type: 'header', label: 'Optique' }, { k: 'dist', label: 'Distorsion', type: 'range', min: -100, max: 100 }, { k: 'ca', label: 'Supprimer l\'aberration chromatique', type: 'check' }, { k: 'vig', label: 'Vignetage de l\'objectif', type: 'range', min: -100, max: 100 },
    ],
    values: Object.assign({ tex: 0, sharp: 40, srad: 1, nr: 0, nrc: 25, shTint: 0, dist: 0, ca: false, vig: 0 }, ...[0, 1, 2, 3, 4, 5].map((i) => ({ ['h' + i]: 0, ['s' + i]: 0, ['l' + i]: 0 }))),
    render(src, v) {
      let c = src;
      if (v.nr > 0) c = MP.applySpec(c, MP.FILTERS.surface, { r: Math.round(1 + v.nr / 20), t: Math.round(5 + v.nr / 2) });
      if (v.nrc > 0) { const bl = MP.blurCanvas(c, 1 + v.nrc / 15), o = MP.cloneCanvas(c), x = o.getContext('2d'); x.globalCompositeOperation = 'color'; x.globalAlpha = Math.min(1, v.nrc / 60); x.drawImage(bl, 0, 0); x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(c, 0, 0); c = o; }
      if (v.tex) { const b = imgData(MP.blurCanvas(c, 4)).data, o = MP.cloneCanvas(c), x = o.getContext('2d'), id = x.getImageData(0, 0, o.width, o.height), a = id.data, k = v.tex / 60; for (let i = 0; i < a.length; i += 4) for (let q = 0; q < 3; q++) { const dd = a[i + q] - b[i + q]; a[i + q] = MP.clamp(a[i + q] + dd * k * (Math.abs(dd) < 40 ? 1 : 0.3), 0, 255); } x.putImageData(id, 0, 0); c = o; }
      const mix = [0, 1, 2, 3, 4, 5].some((i) => v['h' + i] || v['s' + i] || v['l' + i]) || v.shTint;
      if (mix) c = pixelOp(c, (s, d) => {
        for (let i = 0; i < s.length; i += 4) {
          let { h, s: sa, v: va } = MP.rgbToHsv(s[i], s[i + 1], s[i + 2]); let dh = 0, ds = 0, dl = 0;
          for (let b = 0; b < 6; b++) { const dist = Math.min(Math.abs(h - b * 60), 360 - Math.abs(h - b * 60)), wgt = Math.max(0, 1 - dist / 60) * Math.min(1, sa * 3); dh += v['h' + b] * 0.3 * wgt; ds += (v['s' + b] / 100) * wgt; dl += (v['l' + b] / 100) * wgt * sa; }
          h = (h + dh + 360) % 360; sa = MP.clamp(sa * (1 + ds), 0, 1); va = MP.clamp(va * (1 + dl * 0.6), 0, 1);
          const r = MP.hsvToRgb(h, sa, va); let R = r.r, G = r.g, B = r.b;
          if (v.shTint) { const t = Math.max(0, 1 - va * 2) * v.shTint * 0.25; G = MP.clamp(G - t, 0, 255); R = MP.clamp(R + t * 0.5, 0, 255); B = MP.clamp(B + t * 0.5, 0, 255); }
          d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = s[i + 3];
        }
      });
      if (v.dist || v.vig || v.ca) c = MP.FILTERS.lensCorrect.render(c, { dist: v.dist, scale: 100, car: v.ca ? -18 : 0, cab: v.ca ? 12 : 0, vig: -v.vig, vmid: 50 });
      if (v.sharp > 0) c = MP.FILTERS.smartSharpen.render(c, { amt: v.sharp * 1.5, r: v.srad, nr: 15, sh: 0, hi: 0 });
      return c;
    },
  },
});
{
  const pixelOpCheck = typeof pixelOp; if (pixelOpCheck !== 'function') console.warn('pixelOp indisponible');
}

/* =================== Effet Satin (style de calque) =================== */
{
  const def0 = MP.fx.defaults.bind(MP.fx), r0 = MP.fx.render.bind(MP.fx);
  MP.fx.defaults = () => ({ ...def0(), satin: { on: false, color: '#000000', opacity: 50, angle: 19, dist: 11, size: 14, invert: false } });
  MP.fx.render = (doc, l, src) => {
    const out = r0(doc, l, src); const s = l.fx && l.fx.satin; if (!s || !s.on || out === src) return out;
    const W = doc.width, H = doc.height, r = (s.angle * Math.PI) / 180, dx = Math.cos(r) * s.dist, dy = -Math.sin(r) * s.dist;
    const m = MP.createCanvas(W, H), mc = m.getContext('2d'); mc.drawImage(src, dx, dy); mc.globalCompositeOperation = 'xor'; mc.drawImage(src, -dx, -dy);
    const b = MP.createCanvas(W, H), bc = b.getContext('2d'); bc.filter = `blur(${s.size / 2}px)`; bc.drawImage(m, 0, 0); bc.filter = 'none';
    if (s.invert) { const inv = MP.createCanvas(W, H), ic = inv.getContext('2d'); ic.fillStyle = '#000'; ic.fillRect(0, 0, W, H); ic.globalCompositeOperation = 'destination-out'; ic.drawImage(b, 0, 0); b.getContext('2d').clearRect(0, 0, W, H); b.getContext('2d').drawImage(inv, 0, 0); }
    bc.globalCompositeOperation = 'source-in'; bc.fillStyle = s.color; bc.fillRect(0, 0, W, H); bc.globalCompositeOperation = 'destination-in'; bc.drawImage(src, 0, 0);
    const c = out.getContext('2d'); c.save(); c.globalAlpha = s.opacity / 100; c.globalCompositeOperation = 'multiply'; c.drawImage(b, 0, 0); c.restore();
    return out;
  };
}

/* =================== Options de fusion conditionnelle (« Fusion si ») =================== */
MP.blendIfApply = (src, under, bi) => {
  const W = src.width, H = src.height, out = MP.createCanvas(W, H), x = out.getContext('2d'); x.drawImage(src, 0, 0);
  const id = x.getImageData(0, 0, W, H), a = id.data, u = under ? under.getContext('2d').getImageData(0, 0, W, H).data : null;
  const ch = { gray: (d, i) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114, r: (d, i) => d[i], g: (d, i) => d[i + 1], b: (d, i) => d[i + 2] }[bi.ch || 'gray'];
  const ramp = (v, lo, loS, hi, hiS) => { let f = 1; if (v < lo) f = loS > 0 && v > lo - loS ? (v - (lo - loS)) / loS : 0; if (v > hi) f = hiS > 0 && v < hi + hiS ? 1 - (v - hi) / hiS : 0; return f; };
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue;
    let f = ramp(ch(a, i), bi.tLo, bi.tLoS, bi.tHi, bi.tHiS);
    if (u && f > 0) f *= ramp(ch(u, i), bi.uLo, bi.uLoS, bi.uHi, bi.uHiS);
    a[i + 3] *= f;
  }
  x.putImageData(id, 0, 0); return out;
};
{
  const P = MP.Doc.prototype, dl0 = P.drawLayer;
  P.drawLayer = function (ctx, l, opts, depth, atop) {
    const bi = l.blendIf; if (!bi || l.isGroup || l.adjust || !l.visible) return dl0.call(this, ctx, l, opts, depth, atop);
    const base = (opts && opts.noLive) ? l.canvas : l._preview || l.canvas, saveC = l.canvas, saveP = l._preview;
    const res = MP.blendIfApply(base, ctx.canvas, bi); l._preview = res; if (opts && opts.noLive) l.canvas = res;
    try { dl0.call(this, ctx, l, opts, depth, atop); } finally { l.canvas = saveC; l._preview = saveP; }
  };
}

/* =================== Rotation de l'affichage =================== */
{
  const dv0 = MP.drawView;
  MP.drawView = () => {
    dv0(); const d = MP.doc, v = MP.view; if (!d || !d.viewAngle) return;
    const c = v.canvas, t = MP.view._rot && MP.view._rot.width === c.width && MP.view._rot.height === c.height ? MP.view._rot : (MP.view._rot = MP.createCanvas(c.width, c.height));
    const tx = t.getContext('2d'); tx.clearRect(0, 0, t.width, t.height); tx.drawImage(c, 0, 0);
    const x = v.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#1b1b1d'; x.fillRect(0, 0, c.width, c.height);
    x.translate(c.width / 2, c.height / 2); x.rotate((d.viewAngle * Math.PI) / 180); x.translate(-c.width / 2, -c.height / 2); x.drawImage(t, 0, 0); x.setTransform(1, 0, 0, 1, 0, 0);
  };
  const td0 = MP.view.toDoc.bind(MP.view);
  MP.view.toDoc = (cx, cy) => {
    const d = MP.doc; if (!d || !d.viewAngle) return td0(cx, cy);
    const r = MP.view.canvas.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2, a = (-d.viewAngle * Math.PI) / 180, dx = cx - ox, dy = cy - oy;
    const p = td0(ox + dx * Math.cos(a) - dy * Math.sin(a), oy + dx * Math.sin(a) + dy * Math.cos(a)); p.sx = cx - r.left; p.sy = cy - r.top; return p;
  };
  MP.setViewAngle = (a) => { const d = MP.doc; if (!d) return; d.viewAngle = Math.round(((a % 360) + 540) % 360) - 180; if (Math.abs(d.viewAngle) < 1) d.viewAngle = 0; MP.renderView(); MP.ui && MP.ui.refreshStatus && MP.ui.refreshStatus(); };
  defTool({
    id: 'rotview', name: 'Rotation de l\'affichage', icon: 'hand', cursor: 'grab', defaults: {},
    hint: 'Glissez pour faire pivoter la vue (Maj : par pas de 15°) — double-cliquez sur l\'outil ou Échap pour la remettre droite',
    options: [{ k: 'reset', label: 'Réinitialiser la vue', type: 'button', action: () => MP.setViewAngle(0) }, { k: 'l', label: '↺ 15°', type: 'button', action: () => MP.setViewAngle((MP.doc.viewAngle || 0) - 15) }, { k: 'r', label: '↻ 15°', type: 'button', action: () => MP.setViewAngle((MP.doc.viewAngle || 0) + 15) }],
    down(p, e) { const r = MP.view.canvas.getBoundingClientRect(); this.c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; this.a0 = MP.doc.viewAngle || 0; this.s = Math.atan2(e.clientY - this.c.y, e.clientX - this.c.x); },
    move(p, e) { if (this.s == null || !e.buttons) return; let a = this.a0 + ((Math.atan2(e.clientY - this.c.y, e.clientX - this.c.x) - this.s) * 180) / Math.PI; if (e.shiftKey) a = Math.round(a / 15) * 15; MP.setViewAngle(a); },
    up() { this.s = null; },
    onKey(e) { if (e.key === 'Escape') { MP.setViewAngle(0); return true; } },
  });
  const hs = UI.SLOTS.find((s) => s.key === 'H'); if (hs) hs.tools.push('rotview');
}
