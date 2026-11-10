'use strict';
/* Règles, repères et magnétisme */
MP.guides = {
  show: true, snapOn: true, R: 18,
  init() {
    const vp = document.getElementById('viewport');
    this.h = document.createElement('canvas'); this.h.className = 'ruler ruler-h';
    this.v = document.createElement('canvas'); this.v.className = 'ruler ruler-v';
    this.corner = document.createElement('div'); this.corner.className = 'ruler-corner';
    vp.append(this.h, this.v, this.corner);
    const startDrag = (dir) => (e) => {
      if (!MP.doc) return; e.preventDefault();
      const g = { dir, pos: 0 }; this.dragging = g;
      const mv = (ev) => { const p = MP.view.toDoc(ev.clientX, ev.clientY); g.pos = Math.round(dir === 'h' ? p.y : p.x); MP.renderView(); };
      const up = (ev) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); this.dragging = null;
        const r = MP.view.canvas.getBoundingClientRect(), inside = ev.clientX > r.left + this.R && ev.clientY > r.top + this.R && ev.clientX < r.right && ev.clientY < r.bottom;
        if (inside) { MP.doc.guides.push(g); this.show = true; }
        MP.renderView();
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); mv(e);
    };
    this.h.addEventListener('pointerdown', startDrag('h'));
    this.v.addEventListener('pointerdown', startDrag('v'));
    this.apply();
  },
  apply() { const on = MP.prefs.rulers !== false; [this.h, this.v, this.corner].forEach((e) => (e.style.display = on ? 'block' : 'none')); this.drawRulers(); },
  drawRulers() {
    if (!this.h || MP.prefs.rulers === false) return;
    const vp = this.h.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, R = this.R, d = MP.doc;
    for (const [cv, horiz] of [[this.h, true], [this.v, false]]) {
      const len = horiz ? vp.width - R : vp.height - R;
      cv.width = Math.max(1, len * dpr); cv.height = R * dpr; cv.style.width = len + 'px'; cv.style.height = R + 'px';
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#26262a'; c.fillRect(0, 0, len, R);
      c.strokeStyle = '#000'; c.beginPath(); c.moveTo(0, R - 0.5); c.lineTo(len, R - 0.5); c.stroke();
      if (!d) continue;
      const z = d.zoom, pan = horiz ? d.panX - R : d.panY - R;
      const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
      const step = steps.find((s) => s * z >= 60) || 10000, sub = step / (step % 5 === 0 || step === 25 ? 5 : 2);
      const v0 = Math.floor(-pan / z / sub) * sub, v1 = (len - pan) / z;
      c.fillStyle = '#9a9aa3'; c.strokeStyle = '#6b6b73'; c.font = '9px Segoe UI, sans-serif'; c.beginPath();
      for (let v = v0; v <= v1; v += sub) {
        const sp = Math.round(pan + v * z) + 0.5, major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
        c.moveTo(sp, R); c.lineTo(sp, major ? 2 : R - 5);
        if (major) c.fillText(String(Math.round(v)), sp + 3, 9);
      }
      c.stroke();
      if (MP.view.cursor) { const cp = pan + (horiz ? MP.view.cursor.x : MP.view.cursor.y) * z; c.strokeStyle = '#4f7cff'; c.beginPath(); c.moveTo(cp, 0); c.lineTo(cp, R); c.stroke(); }
      // la règle verticale est dessinée comme l'horizontale puis pivotée de 90° (voir styles.css)
    }
  },
  drawOverlay(ctx, d) {
    this.drawRulers();
    const list = [...(this.show ? d.guides : []), ...(this.dragging ? [this.dragging] : [])]; if (!list.length) return;
    const dpr = MP.view.dpr; ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = 1;
    for (const g of list) {
      ctx.strokeStyle = g === this.dragging || g === this.moving ? '#ff4fd8' : '#00d0ff'; ctx.beginPath();
      if (g.dir === 'h') { const y = Math.round(d.panY + g.pos * d.zoom) + 0.5; ctx.moveTo(0, y); ctx.lineTo(MP.view.w, y); }
      else { const x = Math.round(d.panX + g.pos * d.zoom) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, MP.view.h); }
      ctx.stroke();
    }
    ctx.restore();
  },
  /** Repère sous le pointeur (coordonnées écran), pour le déplacer avec l'outil Déplacement. */
  hit(p) { const d = MP.doc; if (!this.show || !d) return null; return d.guides.find((g) => Math.abs((g.dir === 'h' ? p.y : p.x) - g.pos) * d.zoom < 4) || null; },
  snap(p) {
    const d = MP.doc; if (!this.snapOn || !d) return p;
    const tol = 7 / d.zoom, xs = [0, d.width / 2, d.width], ys = [0, d.height / 2, d.height];
    if (this.show) for (const g of d.guides) (g.dir === 'h' ? ys : xs).push(g.pos);
    let { x, y } = p;
    const bx = xs.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), Infinity); if (Math.abs(bx - x) < tol) x = bx;
    const by = ys.reduce((b, v) => (Math.abs(v - y) < Math.abs(b - y) ? v : b), Infinity); if (Math.abs(by - y) < tol) y = by;
    return { ...p, x, y };
  },
};
