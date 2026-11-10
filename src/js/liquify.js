'use strict';
/* Filtre Fluidité (Liquify) : déformation interactive au pinceau */
MP.liquify = {
  open() {
    const d = MP.doc; if (!d || !MP.canEditPixels()) return;
    const l = d.layer, W = d.width, H = d.height, s = Math.min(1, 1400 / Math.max(W, H));
    const pw = Math.max(1, Math.round(W * s)), ph = Math.max(1, Math.round(H * s));
    const prev = MP.createCanvas(pw, ph), pc = prev.getContext('2d'); pc.imageSmoothingQuality = 'high'; pc.drawImage(l.canvas, 0, 0, pw, ph);
    const src = pc.getImageData(0, 0, pw, ph).data, dx = new Float32Array(pw * ph), dy = new Float32Array(pw * ph);
    const st = { tool: 'push', size: Math.round(Math.max(20, Math.min(pw, ph) / 8)), pressure: 50 };

    const back = document.createElement('div'); back.className = 'liq';
    back.innerHTML = `<div class="liq-side"><h3>Fluidité</h3>
      <div class="liq-tools">${[['push', 'Déformation avant', '↗'], ['recon', 'Reconstruction', '↺'], ['twirl', 'Tourbillon', '⟳'], ['twirlL', 'Tourbillon inverse', '⟲'], ['pucker', 'Contraction', '⊙'], ['bloat', 'Dilatation', '◎'], ['left', 'Décalage à gauche', '⇠']].map(([k, t, i]) => `<button data-t="${k}" title="${t}"><b>${i}</b><span>${t}</span></button>`).join('')}</div>
      <label>Taille <input type="range" min="5" max="600" class="lsz"> <span class="lszv"></span></label>
      <label>Pression <input type="range" min="1" max="100" class="lpr"> <span class="lprv"></span></label>
      <div class="liq-btns"><button class="btn lreset">Tout reconstruire</button></div>
      <p class="muted">Glissez sur l'image pour la déformer. Maintenez le clic pour tourbillon / contraction / dilatation.</p>
      <div class="liq-foot"><button class="btn lcancel">Annuler</button><button class="btn primary lok">OK</button></div></div>
      <div class="liq-stage"><canvas class="liq-canvas"></canvas></div>`;
    document.body.appendChild(back); MP.ui.dialogOpen = { close: () => back.remove() };
    const cv = back.querySelector('.liq-canvas'); cv.width = pw; cv.height = ph; const cx = cv.getContext('2d');
    const out = cx.createImageData(pw, ph), O = out.data;
    const sync = () => { back.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === st.tool)); back.querySelector('.lsz').value = st.size; back.querySelector('.lszv').textContent = st.size + ' px'; back.querySelector('.lpr').value = st.pressure; back.querySelector('.lprv').textContent = st.pressure + ' %'; };
    back.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { st.tool = b.dataset.t; sync(); }));
    back.querySelector('.lsz').oninput = (e) => { st.size = +e.target.value; sync(); };
    back.querySelector('.lpr').oninput = (e) => { st.pressure = +e.target.value; sync(); };
    sync();
    const draw = () => {
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        const i = y * pw + x, fx = MP.clamp(x + dx[i], 0, pw - 1.001), fy = MP.clamp(y + dy[i], 0, ph - 1.001), x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
        const a = (y0 * pw + x0) * 4, b = a + 4, c = a + pw * 4, e = c + 4, o = i * 4;
        for (let k = 0; k < 4; k++) O[o + k] = (src[a + k] * (1 - tx) + src[b + k] * tx) * (1 - ty) + (src[c + k] * (1 - tx) + src[e + k] * tx) * ty;
      }
      cx.putImageData(out, 0, 0);
      if (cursor) { cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(cursor.x, cursor.y, st.size / 2 * (pw / cv.getBoundingClientRect().width || 1), 0, 7); cx.stroke(); }
    };
    let queued = false, cursor = null, last = null, hold = null;
    const redraw = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; draw(); }); };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * pw, y: ((e.clientY - r.top) / r.height) * ph, k: pw / r.width }; };
    const apply = (p, mx, my) => {
      const r = (st.size / 2) * p.k, k = st.pressure / 100, R = Math.ceil(r);
      for (let y = Math.max(0, Math.floor(p.y - R)); y < Math.min(ph, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x < Math.min(pw, p.x + R); x++) {
        const ox = x - p.x, oy = y - p.y, q = (ox * ox + oy * oy) / (r * r); if (q >= 1) continue;
        const w = (1 - q) * (1 - q) * k, i = y * pw + x;
        switch (st.tool) {
          case 'push': dx[i] -= mx * w; dy[i] -= my * w; break;
          case 'left': dx[i] += my * w; dy[i] -= mx * w; break;
          case 'recon': dx[i] *= 1 - w * 0.25; dy[i] *= 1 - w * 0.25; break;
          case 'twirl': case 'twirlL': { const a = (st.tool === 'twirl' ? 1 : -1) * w * 0.06, c = Math.cos(a), s = Math.sin(a); dx[i] += ox * c - oy * s - ox; dy[i] += ox * s + oy * c - oy; break; }
          case 'pucker': dx[i] += ox * w * 0.04; dy[i] += oy * w * 0.04; break;
          case 'bloat': dx[i] -= ox * w * 0.04; dy[i] -= oy * w * 0.04; break;
        }
      }
      redraw();
    };
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); last = pos(e);
      if (!['push', 'left'].includes(st.tool)) { apply(last, 0, 0); hold = setInterval(() => last && apply(last, 0, 0), 40); }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e); cursor = p;
      if (last && e.buttons) { if (['push', 'left'].includes(st.tool)) apply(p, p.x - last.x, p.y - last.y); last = p; } else redraw();
    });
    const stop = () => { last = null; clearInterval(hold); hold = null; };
    cv.addEventListener('pointerup', stop); cv.addEventListener('pointerleave', () => { cursor = null; redraw(); });
    const close = () => { stop(); back.remove(); MP.ui.dialogOpen = null; document.removeEventListener('keydown', key, true); };
    const key = (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); if (e.key === '[' || e.key === ']') { st.size = MP.clamp(st.size + (e.key === ']' ? 10 : -10), 5, 600); sync(); } };
    document.addEventListener('keydown', key, true);
    back.querySelector('.lreset').onclick = () => { dx.fill(0); dy.fill(0); redraw(); };
    back.querySelector('.lcancel').onclick = close;
    back.querySelector('.lok').onclick = () => {
      close();
      MP.busy('Application de la fluidité…', () => {
        const S = l.canvas.getContext('2d').getImageData(0, 0, W, H).data, res = MP.createCanvas(W, H), rc = res.getContext('2d'), id = rc.createImageData(W, H), D = id.data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const px = MP.clamp(x * s, 0, pw - 1.001), py = MP.clamp(y * s, 0, ph - 1.001), x0 = px | 0, y0 = py | 0, tx = px - x0, ty = py - y0, a = y0 * pw + x0, b = a + 1, c = a + pw, e = c + 1;
          const DX = ((dx[a] * (1 - tx) + dx[b] * tx) * (1 - ty) + (dx[c] * (1 - tx) + dx[e] * tx) * ty) / s, DY = ((dy[a] * (1 - tx) + dy[b] * tx) * (1 - ty) + (dy[c] * (1 - tx) + dy[e] * tx) * ty) / s;
          const fx = MP.clamp(x + DX, 0, W - 1.001), fy = MP.clamp(y + DY, 0, H - 1.001), X0 = fx | 0, Y0 = fy | 0, u = fx - X0, v = fy - Y0;
          const A = (Y0 * W + X0) * 4, B = A + 4, C = A + W * 4, E = C + 4, o = (y * W + x) * 4;
          for (let k = 0; k < 4; k++) D[o + k] = (S[A + k] * (1 - u) + S[B + k] * u) * (1 - v) + (S[C + k] * (1 - u) + S[E + k] * u) * v;
        }
        rc.putImageData(id, 0, 0);
        d.history.record('Fluidité', [l.id]); MP.rasterize(l); l.canvas = res; MP.afterEdit();
      });
    };
    draw();
  },
};
