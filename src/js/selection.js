'use strict';
/* Sélections : masque alpha de la taille du document + contour « fourmis » */
MP.sel = {
  /** mode : 'new' | 'add' | 'sub' | 'inter'. draw(ctx) dessine la forme en blanc opaque. */
  apply(doc, mode, draw, feather = 0) {
    const shape = MP.createCanvas(doc.width, doc.height), sc = shape.getContext('2d');
    sc.fillStyle = '#fff'; sc.strokeStyle = '#fff'; draw(sc);
    let src = shape;
    if (feather > 0) src = MP.sel.blurred(shape, feather);
    if (mode === 'new' || !doc.selection) {
      if (mode === 'sub') return; // rien à soustraire
      if (mode === 'inter') { doc.selection = null; MP.sel.updatePath(doc); return; }
      doc.selection = src;
    } else {
      const c = doc.selection.getContext('2d');
      c.globalCompositeOperation = mode === 'add' ? 'source-over' : mode === 'sub' ? 'destination-out' : 'destination-in';
      c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-over';
    }
    MP.sel.normalize(doc);
  },
  fromMask(doc, maskCanvas, mode = 'new') { MP.sel.apply(doc, mode, (c) => c.drawImage(maskCanvas, 0, 0)); },
  blurred(canvas, r) {
    const out = MP.createCanvas(canvas.width, canvas.height), c = out.getContext('2d');
    c.filter = `blur(${r}px)`; c.drawImage(canvas, 0, 0); c.filter = 'none'; return out;
  },
  normalize(doc) {
    if (doc.selection && !MP.alphaBounds(doc.selection, 2)) doc.selection = null;
    MP.sel.updatePath(doc);
  },
  all(doc) { MP.sel.apply(doc, 'new', (c) => c.fillRect(0, 0, doc.width, doc.height)); },
  none(doc) { doc.selection = null; doc.selPath = null; },
  invert(doc) {
    const m = MP.createCanvas(doc.width, doc.height), c = m.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, doc.width, doc.height);
    if (doc.selection) { c.globalCompositeOperation = 'destination-out'; c.drawImage(doc.selection, 0, 0); }
    doc.selection = m; MP.sel.normalize(doc);
  },
  feather(doc, r) { if (!doc.selection) return; doc.selection = MP.sel.blurred(doc.selection, r); MP.sel.normalize(doc); },
  /** Dilater (grow>0) ou contracter (grow<0) via flou + seuil. */
  modify(doc, grow) {
    if (!doc.selection || !grow) return;
    const r = Math.abs(grow), b = MP.sel.blurred(doc.selection, r / 2);
    const c = b.getContext('2d'), id = c.getImageData(0, 0, b.width, b.height), a = id.data;
    const th = grow > 0 ? 8 : 247;
    for (let i = 3; i < a.length; i += 4) { const v = a[i] > th ? 255 : 0; a[i - 3] = a[i - 2] = a[i - 1] = 255; a[i] = v; }
    c.putImageData(id, 0, 0); doc.selection = b; MP.sel.normalize(doc);
  },
  smooth(doc, r) {
    if (!doc.selection) return;
    const b = MP.sel.blurred(doc.selection, r), c = b.getContext('2d'), id = c.getImageData(0, 0, b.width, b.height), a = id.data;
    for (let i = 3; i < a.length; i += 4) { a[i - 3] = a[i - 2] = a[i - 1] = 255; a[i] = a[i] >= 128 ? 255 : 0; }
    c.putImageData(id, 0, 0); doc.selection = b; MP.sel.normalize(doc);
  },
  fromLayerAlpha(doc, layer, mode = 'new') { MP.sel.apply(doc, mode, (c) => c.drawImage(layer.canvas, 0, 0)); },
  bounds(doc) { return doc.selection ? MP.alphaBounds(doc.selection, 2) : null; },
  /** Construit un Path2D des bords de pixels (seuil 50 %). */
  updatePath(doc) {
    if (!doc.selection) { doc.selPath = null; return; }
    const w = doc.width, h = doc.height;
    const a = doc.selection.getContext('2d').getImageData(0, 0, w, h).data;
    const S = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] >= 128;
    const p = new Path2D();
    let segs = 0;
    for (let y = 0; y <= h; y++) {
      let run = -1;
      for (let x = 0; x <= w; x++) {
        const edge = x < w && S(x, y) !== S(x, y - 1);
        if (edge && run < 0) run = x;
        else if (!edge && run >= 0) { p.moveTo(run, y); p.lineTo(x, y); run = -1; segs++; }
      }
    }
    for (let x = 0; x <= w; x++) {
      let run = -1;
      for (let y = 0; y <= h; y++) {
        const edge = y < h && S(x, y) !== S(x - 1, y);
        if (edge && run < 0) run = y;
        else if (!edge && run >= 0) { p.moveTo(x, run); p.lineTo(x, y); run = -1; segs++; }
      }
    }
    doc.selPath = segs ? p : null;
    if (!segs) doc.selection = null;
  },
};

/** Dilate un masque de r pixels (puis l'adoucit légèrement). */
MP.dilate = (mask, r) => {
  const o = MP.createCanvas(mask.width, mask.height), c = o.getContext('2d'), n = Math.max(8, Math.round(r * 4));
  for (let i = 0; i < n; i++) c.drawImage(mask, Math.cos((i * 2 * Math.PI) / n) * r, Math.sin((i * 2 * Math.PI) / n) * r);
  c.drawImage(mask, 0, 0); return MP.sel.blurred(o, Math.max(1, r / 3));
};
/** Remplissage par diffusion (seuil de tolérance) — renvoie une toile masque blanche. */
MP.floodMask = (srcCanvas, sx, sy, tolerance, contiguous) => {
  const w = srcCanvas.width, h = srcCanvas.height;
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const data = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const i0 = (sy * w + sx) * 4, r0 = data[i0], g0 = data[i0 + 1], b0 = data[i0 + 2], a0 = data[i0 + 3];
  const tol = tolerance * 2.55;
  const match = (i) => Math.max(Math.abs(data[i] - r0), Math.abs(data[i + 1] - g0), Math.abs(data[i + 2] - b0), Math.abs(data[i + 3] - a0)) <= tol;
  const out = new Uint8Array(w * h);
  if (!contiguous) { for (let p = 0; p < w * h; p++) if (match(p * 4)) out[p] = 1; }
  else {
    const stack = [sx, sy];
    while (stack.length) {
      const y = stack.pop(); let x = stack.pop();
      let p = y * w + x;
      while (x >= 0 && !out[p] && match(p * 4)) { x--; p--; }
      x++; p++;
      let up = false, down = false;
      while (x < w && !out[p] && match(p * 4)) {
        out[p] = 1;
        if (y > 0) { const q = p - w; if (!out[q] && match(q * 4)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
        if (y < h - 1) { const q = p + w; if (!out[q] && match(q * 4)) { if (!down) { stack.push(x, y + 1); down = true; } } else down = false; }
        x++; p++;
      }
    }
  }
  const m = MP.createCanvas(w, h), mc = m.getContext('2d'), id = mc.createImageData(w, h), md = id.data;
  for (let p = 0; p < w * h; p++) if (out[p]) { const i = p * 4; md[i] = md[i + 1] = md[i + 2] = 255; md[i + 3] = 255; }
  mc.putImageData(id, 0, 0);
  return m;
};
