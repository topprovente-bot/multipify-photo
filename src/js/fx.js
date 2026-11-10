'use strict';
/* Styles de calque non destructifs + application des calques de réglage */

MP.fx = {
  defaults() {
    return {
      shadow: { on: false, color: '#000000', opacity: 60, angle: 120, dist: 12, size: 14 },
      glow: { on: false, color: '#ffe680', opacity: 75, size: 22 },
      stroke: { on: false, color: '#ffffff', opacity: 100, size: 4 },
      inner: { on: false, color: '#000000', opacity: 55, angle: 120, dist: 6, size: 10 },
      bevel: { on: false, angle: 120, depth: 6, size: 8, hi: 70, sh: 60 },
      overlay: { on: false, color: '#ff3366', opacity: 100 },
      gradient: { on: false, a: '#4f7cff', b: '#ff5ca8', angle: 90, opacity: 100 },
    };
  },
  has(l) { return !!(l.fx && Object.values(l.fx).some((e) => e && e.on)); },
  /** Renvoie la toile stylée du calque (ou src si aucun effet). */
  render(doc, l, src) {
    if (!this.has(l)) return src;
    // pendant qu'on peint sur ce calque, on affiche le calque brut (fluidité) ; sinon résultat mis en cache
    if (MP.live && (MP.live.layer === l || (MP.live.layers && MP.live.layers.includes(l))) && src !== l.canvas && !this.forceLive) return src;
    const W = doc.width, H = doc.height, fx = l.fx;
    const key = `${l._v || 0}|${l.fill == null ? 1 : l.fill}|${JSON.stringify(fx)}|${l.mask && l.maskEnabled ? 1 : 0}|${W}x${H}|${src === l.canvas || src === doc._tmp ? 'n' : 's'}`;
    if (!l._preview && l._fxKey === key && doc._bufs && doc._bufs['fx' + l.id]) return doc._bufs['fx' + l.id];
    l._fxKey = l._preview ? null : key;
    const out = doc.buf('fx' + l.id), c = out.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.clearRect(0, 0, W, H);
    const sil = (color, blur, spread) => {
      const s = doc.buf('fxs'), sc = s.getContext('2d');
      sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, W, H);
      if (spread > 0) { const n = Math.max(12, Math.min(48, Math.round(spread * 3))); for (let a = 0; a < n; a++) sc.drawImage(src, Math.cos((a * 2 * Math.PI) / n) * spread, Math.sin((a * 2 * Math.PI) / n) * spread); }
      sc.drawImage(src, 0, 0);
      sc.globalCompositeOperation = 'source-in'; sc.fillStyle = color; sc.fillRect(0, 0, W, H); sc.globalCompositeOperation = 'source-over';
      if (!blur) return s;
      const b = doc.buf('fxb'), bc = b.getContext('2d'); bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, 0, W, H); bc.filter = `blur(${blur / 2}px)`; bc.drawImage(s, 0, 0); bc.filter = 'none'; return b;
    };
    const off = (e) => { const r = (e.angle * Math.PI) / 180; return [-Math.cos(r) * e.dist, Math.sin(r) * e.dist]; };
    if (fx.shadow && fx.shadow.on) { const [dx, dy] = off(fx.shadow); c.globalAlpha = fx.shadow.opacity / 100; c.drawImage(sil(fx.shadow.color, fx.shadow.size, 0), dx, dy); }
    if (fx.glow && fx.glow.on) { c.globalAlpha = fx.glow.opacity / 100; c.drawImage(sil(fx.glow.color, fx.glow.size, fx.glow.size / 3), 0, 0); }
    if (fx.stroke && fx.stroke.on) { c.globalAlpha = fx.stroke.opacity / 100; c.drawImage(sil(fx.stroke.color, 0, fx.stroke.size), 0, 0); }
    c.globalAlpha = 1;
    // contenu + effets intérieurs
    const t = doc.buf('fxc'), tc = t.getContext('2d');
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalAlpha = 1; tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, W, H); tc.drawImage(src, 0, 0);
    if (fx.overlay && fx.overlay.on) { tc.globalCompositeOperation = 'source-atop'; tc.globalAlpha = fx.overlay.opacity / 100; tc.fillStyle = fx.overlay.color; tc.fillRect(0, 0, W, H); }
    if (fx.gradient && fx.gradient.on) {
      const g = fx.gradient, r = (g.angle * Math.PI) / 180, L = (Math.abs(Math.cos(r)) * W + Math.abs(Math.sin(r)) * H) / 2;
      const gr = tc.createLinearGradient(W / 2 - Math.cos(r) * L, H / 2 + Math.sin(r) * L, W / 2 + Math.cos(r) * L, H / 2 - Math.sin(r) * L);
      gr.addColorStop(0, g.a); gr.addColorStop(1, g.b);
      tc.globalCompositeOperation = 'source-atop'; tc.globalAlpha = g.opacity / 100; tc.fillStyle = gr; tc.fillRect(0, 0, W, H);
    }
    tc.globalAlpha = 1;
    if (fx.inner && fx.inner.on) {
      const e = fx.inner, [dx, dy] = off(e), inv = doc.buf('fxi'), ic = inv.getContext('2d');
      ic.globalAlpha = 1; ic.globalCompositeOperation = 'source-over'; ic.fillStyle = e.color; ic.fillRect(0, 0, W, H);
      ic.globalCompositeOperation = 'destination-out'; ic.drawImage(src, 0, 0); ic.globalCompositeOperation = 'source-over';
      const b = doc.buf('fxb'), bc = b.getContext('2d'); bc.clearRect(0, 0, W, H); bc.filter = `blur(${e.size / 2}px)`; bc.drawImage(inv, dx, dy); bc.filter = 'none';
      tc.globalCompositeOperation = 'source-atop'; tc.globalAlpha = e.opacity / 100; tc.drawImage(b, 0, 0); tc.globalAlpha = 1;
    }
    if (fx.bevel && fx.bevel.on) {
      const e = fx.bevel, r = (e.angle * Math.PI) / 180, lx = Math.cos(r) * e.depth, ly = -Math.sin(r) * e.depth;
      const edge = (sx, sy, color, mode, alpha) => {
        const m = doc.buf('fxi'), mc = m.getContext('2d'); mc.globalAlpha = 1; mc.globalCompositeOperation = 'source-over'; mc.clearRect(0, 0, W, H);
        mc.drawImage(src, 0, 0); mc.globalCompositeOperation = 'destination-out'; mc.drawImage(src, sx, sy);
        mc.globalCompositeOperation = 'source-in'; mc.fillStyle = color; mc.fillRect(0, 0, W, H); mc.globalCompositeOperation = 'source-over';
        const b = doc.buf('fxb'), bc = b.getContext('2d'); bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, 0, W, H); bc.filter = `blur(${e.size / 2}px)`; bc.drawImage(m, 0, 0); bc.filter = 'none';
        bc.globalCompositeOperation = 'destination-in'; bc.drawImage(src, 0, 0); bc.globalCompositeOperation = 'source-over';
        tc.globalCompositeOperation = mode; tc.globalAlpha = alpha; tc.drawImage(b, 0, 0); tc.globalAlpha = 1;
      };
      edge(-lx, -ly, '#ffffff', 'screen', e.hi / 100);
      edge(lx, ly, '#000000', 'multiply', e.sh / 100);
      // conserver l'alpha d'origine
      tc.globalCompositeOperation = 'destination-in'; tc.drawImage(src, 0, 0);
    }
    tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1;
    c.globalAlpha = l.fill == null ? 1 : l.fill; c.drawImage(t, 0, 0); c.globalAlpha = 1;
    return out;
  },
};

MP.ADJ_LAYER_KEYS = ['brightness', 'levels', 'curves', 'exposure', 'vibrance', 'hueSat', 'colorBalance', 'blackWhite', 'photoFilter', 'shadowsHighlights', 'gradientMap', 'invert', 'posterize', 'threshold'];

MP.applyAdjustLayer = (doc, canvas, l) => {
  const spec = MP.ADJUST[l.adjust.key]; if (!spec) return null;
  const w = canvas.width, h = canvas.height;
  const src = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = doc.buf('adj'), oc = out.getContext('2d'), id = oc.createImageData(w, h);
  let blur = null;
  if (spec.needsBlur) blur = MP.blurCanvas(canvas, spec.needsBlur(l.adjust.values)).getContext('2d').getImageData(0, 0, w, h).data;
  spec.pixel(src, id.data, l.adjust.values || {}, blur);
  oc.putImageData(id, 0, 0);
  return out;
};
