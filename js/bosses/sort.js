'use strict';
/* SORT boss (CRITTER CLUB): critters waddle out of the barn one at a time; send each to its pen, SHEEP left, PIGS right.
   After Smooth Moves' "Toilet Training" (point each person to the right door). 12 sorted wins; one critter in the wrong
   pen (chaos!) or one left waiting too long loses. The last three may come disguised: a pig in a wool coat, a sheep with
   a pink bow. The FACE always tells the truth (dark face = sheep, pink snout = pig).
   Art: the DUO look (docs/ART-STYLE.md); gameplay, timings and RNG are untouched. */
(function () {
  /* art kit (DUO look): a local copy of the DUO drawing helpers; draws on X, which can be swapped for an offscreen canvas to bake the scene once */
  const K = (() => {
    const TAU = Math.PI * 2;
    let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
    const K = { TAU };
    const clamp = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    K.ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
    K.outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
    K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    K.mix = (a, b, k) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const x = p(a), y = p(b); k = clamp(k, 0, 1); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',') + ')'; };
    K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
    /* the outro clock: set in update() (shoot.js draws once), with a fallback in draw() */
    K.outro = () => { let t0 = -1; return { mark(g) { if (g.result && t0 < 0) t0 = now; }, t(g) { if (!g.result) return 0; if (t0 < 0) t0 = now; return Math.max(0, now - t0); } }; };
    const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
    const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
    const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
    /* cel-shaded ellipse / rounded rect / polygon: shade fill, then the base shifted up-left inside the clip leaves a crescent of shade */
    K.ce = (x, y, rx, ry, base, shade, o = 4, rot = 0, sx = rx * .2, sy = ry * .24) => {
      el(x, y, rx, ry, rot); ink(shade, o); X.save(); el(x, y, rx, ry, rot); X.clip(); el(x - sx, y - sy, rx, ry, rot); X.fillStyle = base; X.fill(); X.restore();
    };
    K.cr = (x, y, w, h, r, base, shade, o = 4, sx = 3, sy = 3) => {
      rr(x, y, w, h, r); ink(shade, o); X.save(); rr(x, y, w, h, r); X.clip(); rr(x - sx, y - sy, w, h, r); X.fillStyle = base; X.fill(); X.restore();
    };
    K.cp = (pts, base, shade, o = 4, sx = 3, sy = 3) => {
      const path = () => { X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.closePath(); };
      path(); ink(shade, o); X.save(); path(); X.clip(); X.translate(-sx, -sy); path(); X.fillStyle = base; X.fill(); X.restore();
    };
    K.poly = (pts, fill, o = 4) => { X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.closePath(); ink(fill, o); };
    K.gl = (x, y, rx, ry, a = .5, rot = -.5) => { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); };
    K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
    K.curve = (a, b, c, d, e, f, w, col) => { X.beginPath(); X.moveTo(a, b); X.quadraticCurveTo(c, d, e, f); X.lineCap = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
    K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
    K.vg = (y0, y1, stops) => { const g = X.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
    K.hills = (L, R, base, amp, freq, ph, fill, line, lw = 3, y2 = base + 4) => {
      X.beginPath(); X.moveTo(L, y2); for (let x = L; x <= R + 8; x += 8) X.lineTo(x, base - amp * (.55 + .45 * Math.sin(x * freq + ph) * Math.cos(x * freq * .37 + ph * 2)));
      X.lineTo(R, y2); X.closePath(); X.fillStyle = fill; X.fill(); if (line) { X.lineWidth = lw; X.strokeStyle = line; X.lineJoin = 'round'; X.stroke(); }
    };
    K.horizon = (y, L, R, w = 4) => { X.fillStyle = INK; X.fillRect(L, y - w / 2, R - L, w); };
    K.heart = (x, y, s, a = 1) => {
      X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
      ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
    };
    K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
    K.zee = (x, y, s, a) => {
      X.save(); X.globalAlpha = clamp(a, 0, 1); X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
      X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.restore();
    };
    K.arms = (u, la, ra, k, col = OR) => {
      if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
      const one = (sx, an) => {
        X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
        X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
        X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
        X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
      };
      one(-1, la); one(1, ra);
    };
    K.eye = (x, y, r, mood, look, T, k) => {
      X.lineCap = 'round';
      if (mood === 'happy') { X.lineWidth = r * .55; X.strokeStyle = INK; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
      if (mood === 'bonk' || mood === 'sleep') { X.lineWidth = r * .5; X.strokeStyle = INK; X.beginPath(); if (mood === 'sleep') X.arc(x, y - r * .2, r * .7, Math.PI * .15, Math.PI * .85); else { const d = k ? -1 : 1; X.moveTo(x - r * .7 * d, y - r * .5); X.lineTo(x + r * .4 * d, y); X.lineTo(x - r * .7 * d, y + r * .5); } X.stroke(); return; }
      const big = mood === 'panic' ? 1.3 : 1;
      el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(1.5, r * .28));
      if (mood === 'dizzy') { X.strokeStyle = INK; X.lineWidth = Math.max(1.5, r * .22); X.beginPath(); for (let i = 0; i < 24; i++) { const a = i * .55 * (k ? -1 : 1) + T * 9 * (k ? -1 : 1), q = i / 24 * r * .85; X.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } X.stroke(); return; }
      if (mood !== 'panic' && Math.sin(T * 1.9 + k * .2 + x * .01) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
      const pr = mood === 'panic' ? r * .32 : r * .52, lx = clamp(look[0], -1, 1) * r * .38, ly = clamp(look[1], -1, 1) * r * .38;
      X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
      X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .38, pr * .32); X.fill();
    };
    K.cloud = (x, y, s, col = '#e4f5ff') => {
      X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = col; X.fill(); }
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
    };
    K.shade = (x, y, rx, ry, a = .25) => { X.fillStyle = `rgba(20,16,28,${a})`; el(x, y, rx, ry); X.fill(); };
    K.puff = (x, y, r, a = 1, col = '#f4ead8') => {
      if (a <= 0) return; X.save(); X.globalAlpha = clamp(a, 0, 1);
      const c = [[-r * .6, 0, r * .62], [0, -r * .35, r * .75], [r * .6, 0, r * .6], [0, r * .2, r * .6]];
      for (const [a2, b, q] of c) { X.beginPath(); X.arc(x + a2, y + b, q, 0, TAU); ink(null, 3); }
      for (const [a2, b, q] of c) { X.beginPath(); X.arc(x + a2, y + b, q, 0, TAU); X.fillStyle = col; X.fill(); }
      X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .25, y - r * .5, r * .35, r * .2, -.4); X.fill(); X.restore();
    };
    K.rays = (x, y, r, T, a = .5, col = '255,240,150') => {
      X.save(); X.translate(x, y); X.rotate(T * .6); X.fillStyle = `rgba(${col},${a})`;
      for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(-r * .12, r * .25); X.lineTo(r * .12, r * .25); X.lineTo(0, r); X.fill(); }
      X.restore();
    };
    K.badge = (s, x, y, size, bg, fg, sc = 1, rot = 0) => {
      s = typeof t === 'function' ? t(s) : s; X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
      X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = X.measureText(s).width + size * .9, h = size * 1.25;
      X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .3); X.fill();
      rr(-w / 2, -h / 2, w, h, h * .3); ink(bg, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + 6, -h / 2 + 5, w - 12, h * .2, h * .1); X.fill();
      X.fillStyle = fg; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, 0, size * .05); X.restore();
    };
    /* name tag: a round pill with a pointer (up = pointer on top, the tag hangs below its owner) */
    K.pill = (x, y, label, col, up = false) => {
      label = typeof t === 'function' ? t(label) : label; X.save(); X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif';
      const w = X.measureText(label).width + 24, h = 26, d = up ? -1 : 1;
      X.beginPath(); X.moveTo(x - 6, y + d * (h / 2 - 2)); X.lineTo(x, y + d * (h / 2 + 8)); X.lineTo(x + 6, y + d * (h / 2 - 2)); X.closePath(); ink(col, 3);
      rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - h / 2 + 4, w - 12, h * .26, h * .13); X.fill();
      X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(label, x, y + 1); X.restore();
    };
    K.keyCap = (x, y, label) => {
      label = typeof t === 'function' ? t(label) : label; X.save(); X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif';
      const w = Math.max(26, X.measureText(label).width + 16), h = 24; rr(x - w / 2, y - h / 2, w, h, 6); ink('#fff', 2.5);
      X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(label, x, y + 1); X.restore();
    };
    K.tuft = (x, y, s = 1, col = '#3f8f35') => { X.strokeStyle = col; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 7 * s, y); X.lineTo(x - 3 * s, y - 10 * s); X.moveTo(x, y); X.lineTo(x, y - 13 * s); X.moveTo(x + 7 * s, y); X.lineTo(x + 3 * s, y - 10 * s); X.stroke(); };
    /* grass ground from y0 down: gradient, light stripes, tufts and a few flowers (a hash decides where; seed varies the scene) */
    K.ground = (y0, c0, c1, seed = 0, tufts = 22, flowers = 10) => {
      X.fillStyle = K.vg(y0, H, [[0, c0], [1, c1]]); X.fillRect(0, y0, W, H - y0);
      X.fillStyle = 'rgba(255,255,255,.1)'; for (let i = -2; i < 9; i++) { X.beginPath(); X.moveTo(i * 120 + 40, y0); X.lineTo(i * 120 + 100, y0); X.lineTo(i * 120 - 20, H); X.lineTo(i * 120 - 80, H); X.closePath(); X.fill(); }
      for (let i = 0; i < tufts; i++) K.tuft(K.hash(i + seed * 17) * 780 + 10, y0 + 24 + K.hash(i * 3 + seed * 5) * (H - y0 - 40), .8 + K.hash(i + 9) * .5);
      const fc = ['#fff', '#ffe14d', '#ff8fb0', '#c8a8ff'];
      for (let i = 0; i < flowers; i++) { const fx = K.hash(i * 7 + seed * 3 + 40) * 770 + 15, fy = y0 + 30 + K.hash(i * 11 + seed + 2) * (H - y0 - 60);
        X.fillStyle = fc[i % 4]; for (let j = 0; j < 5; j++) { el(fx + Math.cos(j * 1.256) * 4, fy + Math.sin(j * 1.256) * 4, 2.6, 2.6); X.fill(); } X.fillStyle = '#f2a30f'; el(fx, fy, 2.4, 2.4); X.fill(); }
    };
    K.cx = () => X;
    K.ering = (cx, cy, a, b, w, col) => { X.beginPath(); X.ellipse(cx, cy, a, b, 0, 0, TAU); X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
    K.post = (x, y, h = 30, w = 10) => K.cr(x - w / 2, y - h, w, h, 3, '#d9944f', '#a5622c', 3, 2.5, 0);
    K.rail = (xa, ya, xb, yb, w = 7) => K.line([[xa, ya], [xb, yb]], w, '#d9944f');
    return K;
  })();
  const FX = 400, FY = 440, DY = 238, NEED = 12, RUSH = 6, SLOTS = [1, .56, .27, .05], CY = 548;
  const PINK = '#FFA3C2', P2 = '#F57FA8', FACE = '#3b3340', DIRT = '#dcaa6e', WOOD = '#d9944f';
  const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R' };
  const GATE = { L: [250, 478], R: [550, 478] };
  const at = u => [FX, DY + (FY - DY) * u, .42 + .58 * u];                       // path point + perspective scale
  const pen = sd => sd === 'L' ? [-OX + 24, 250] : [550, W + OX - 24];             // pen x-range (y 300..540)
  const WOOL = [[0, -50, 30], [-27, -44, 19], [27, -44, 19], [-20, -66, 18], [20, -66, 18], [0, -74, 18], [-19, -27, 17], [19, -27, 17], [0, -24, 19]];
  const el = K.el, ink = K.ink, ce = K.ce, cr = K.cr;
  const raw = (s, x, y, size, fill) => { ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = size / 5; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y); };
  const baa = () => { for (let i = 0; i < 4; i++) snd(470 + (i % 2) * 45, .07, 'sawtooth', .04, i * .055); snd(490, .2, 'sawtooth', .035, .22, 400); };
  const oink = () => { snd(260, .07, 'square', .05, 0, 170); snd(235, .11, 'square', .05, .09, 140); noise(.07, .05, 500, 300, 'bandpass', .09); };

  const wool = (pts, base, shade) => {                                              // union of puffs: one outline pass, a shade fill, then the lit puffs
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }
    ctx.fillStyle = shade; for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = base; for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x - r * .13, y - r * .16, r * .84, 0, 7); ctx.fill(); }
  };
  /* front-facing critter, feet at (x, y) */
  function critter(c, x, y, s, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0); const sq = c.sq || 0; ctx.scale(s * (1 + sq * .22), s * (1 - sq * .2));
    const w = o.walk != null ? Math.sin(o.walk * 17) : 0; ctx.translate(0, -Math.abs(w) * 6);
    const sheep = c.kind === 'sheep', leg = sheep ? FACE : P2, legS = sheep ? '#2a2430' : '#c95d86', mood = o.mood, T = now;
    const em = mood === 'happy' ? 'happy' : mood === 'scared' ? 'panic' : 'idle';
    cr(-24, -24 - Math.max(0, w) * 7, 12, 24, 4, leg, legS, 3, 2, 0); cr(12, -24 - Math.max(0, -w) * 7, 12, 24, 4, leg, legS, 3, 2, 0);
    if (sheep || c.dis) wool(WOOL, '#fff', '#d9e0f0'); else { ce(0, -44, 41, 35, PINK, '#e07aa0', 4.5); ce(0, -36, 24, 16, '#ffc2d6', '#ffc2d6', 0); }
    if (sheep) {
      ce(-30, -72, 15, 7, FACE, '#2a2430', 3, -.45); ce(30, -72, 15, 7, FACE, '#2a2430', 3, .45);
      ce(0, -68, 20, 25, '#4a4152', '#2a2430', 4);
      wool([[-11, -90, 10], [0, -95, 11], [11, -90, 10]], '#fff', '#d9e0f0');
      K.eye(-8, -72, 5.2, em, [0, .2], T, 0); K.eye(8, -72, 5.2, em, [0, .2], T, 1);
      ctx.fillStyle = '#ff8fb0'; for (const sd of [-1, 1]) { el(sd * 12, -58, 4, 2.5); ctx.fill(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -55, 4, .3, Math.PI - .3); ctx.stroke();
      if (c.dis) { ce(-13, -97, 13, 9, '#ff5fa2', '#c92a78', 3, .4); ce(13, -97, 13, 9, '#ff5fa2', '#c92a78', 3, -.4); ce(0, -97, 6, 6, '#ff8fc0', '#e0609c', 3); }   // the pink bow
    } else {
      for (const sd of [-1, 1]) K.cp([[sd * 12, -88], [sd * 32, -104], [sd * 30, -78]], P2, '#c95d86', 3, 2, 2);
      ce(0, -68, 30, 27, PINK, '#e07aa0', 4.5); K.gl(-10, -80, 9, 4, .45);
      if (c.dis) wool([[-12, -94, 9], [0, -98, 10], [12, -94, 9]], '#fff', '#d9e0f0');                    // fake wool wig
      K.eye(-9, -76, 5, em, [0, .2], T, 0); K.eye(9, -76, 5, em, [0, .2], T, 1);
      ctx.fillStyle = 'rgba(255,111,154,.55)'; for (const sd of [-1, 1]) { el(sd * 21, -63, 5, 3); ctx.fill(); }
      ce(0, -60, 15, 11, P2, '#d9658f', 3); ctx.fillStyle = INK; for (const sd of [-1, 1]) { el(sd * 5, -60, 2.6, 4); ctx.fill(); }
    }
    if (o.sweat) K.sweat(32, -96, .9, T);
    ctx.restore();
  }
  const rail = (xa, ya, xb, yb) => K.rail(xa, ya, xb, yb, 7);
  const post = (x, y) => K.post(x, y + 4, 34, 12);
  function fenceH(x0, x1, y) { rail(x0, y - 18, x1, y - 18); rail(x0, y - 6, x1, y - 6); for (let x = x0; x <= x1 + 1; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 56))) post(x, y); }
  function fenceV(x, y0, y1) { rail(x, y0 - 12, x, y1 - 12); for (let y = y0; y <= y1 + 1; y += (y1 - y0) / Math.max(1, Math.round((y1 - y0) / 44))) post(x, y); }

  let BG = null, BGK = '';
  function scene() {
    const key = VW + ':' + OX; if (BG && BGK === key) return BG;
    BGK = key;
    return BG = K.bake(VW, H, () => {
      const X = K.cx(); X.translate(OX, 0);
      X.fillStyle = K.vg(0, 232, [[0, '#4cb4ee'], [.6, '#8fdbfb'], [1, '#dcf8ff']]); X.fillRect(-OX, 0, VW, 232);
      K.hills(-OX, W + OX, 232, 62, .005, 1.1, '#c9d0fb', '#7b80c6', 3, 236); K.hills(-OX, W + OX, 236, 40, .008, 3.4, '#87d19b', '#4f9a6a', 3, 240);
      X.fillStyle = K.vg(232, H, [[0, '#8fdc5c'], [1, '#5fb944']]); X.fillRect(-OX, 232, VW, H - 232); K.horizon(232, -OX, W + OX, 5);
      X.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 262; y < H; y += 64) X.fillRect(-OX, y, VW, 30);
      for (let i = 0; i < 36; i++) K.tuft(-OX + K.hash(i + 3) * (VW - 20) + 10, 262 + K.hash(i * 3 + 1) * 300, .9);
      // the barn the critters come out of
      K.cr(338, 172, 124, 66, 4, '#E8553D', '#b8352a', 5, 5, 5); X.strokeStyle = 'rgba(0,0,0,.16)'; X.lineWidth = 3; for (let x = 354; x < 462; x += 16) { X.beginPath(); X.moveTo(x, 176); X.lineTo(x, 234); X.stroke(); }
      K.cp([[322, 178], [FX, 130], [478, 178]], '#c0402f', '#8a2a22', 5, 3, 3); K.cr(386, 152, 28, 20, 4, '#3a1f1a', '#2a1410', 3, 0, 0);
      K.cr(374, 194, 52, 44, 4, '#3a1f1a', '#241210', 4, 0, 0); X.strokeStyle = '#fff'; X.lineWidth = 4; X.lineCap = 'round'; X.strokeRect(350, 186, 20, 20); X.strokeRect(430, 186, 20, 20);
      X.beginPath(); X.moveTo(378, 198); X.lineTo(422, 234); X.moveTo(422, 198); X.lineTo(378, 234); X.stroke();
      // scoreboard posts
      K.post(FX - 168, 234, 100, 11); K.post(FX + 168, 234, 100, 11);
      // dirt path: trunk from the barn, then the fork to both gates (all outlines first, then the fills)
      const trunk = () => { X.beginPath(); X.moveTo(FX - 18, DY); X.lineTo(FX + 18, DY); X.lineTo(FX + 66, FY + 18); X.lineTo(FX - 66, FY + 18); X.closePath(); };
      const branch = sd => { const [gx, gy] = GATE[sd]; X.beginPath(); X.moveTo(FX, FY); X.quadraticCurveTo(FX + (sd === 'L' ? -60 : 60), FY + 55, gx + (sd === 'L' ? -20 : 20), gy); };
      X.lineJoin = 'round'; X.lineCap = 'round';
      X.strokeStyle = INK; X.lineWidth = 70; branch('L'); X.stroke(); branch('R'); X.stroke(); X.lineWidth = 10; trunk(); X.stroke();
      X.strokeStyle = DIRT; X.lineWidth = 56; branch('L'); X.stroke(); branch('R'); X.stroke(); X.fillStyle = DIRT; trunk(); X.fill(); X.lineCap = 'butt';
      X.fillStyle = 'rgba(20,16,28,.12)'; for (let i = 0; i < 9; i++) { const u = (i + .5) / 9, [x, y, sc] = at(u); X.beginPath(); X.ellipse(x + (i % 2 ? 14 : -14) * sc, y, 6 * sc, 3 * sc, 0, 0, 7); X.fill(); }
      // pens: floor, back fence, inner fence with a gate gap, signs
      for (const sd of ['L', 'R']) {
        const [x0, x1] = pen(sd), inner = sd === 'L' ? x1 : x0;
        K.cr(x0, 300, x1 - x0, 240, 6, sd === 'L' ? '#c4f29a' : '#d4a46c', sd === 'L' ? '#a8dc7a' : '#b98350', 0, 0, 0);
        if (sd === 'R') { K.ce(x0 + (x1 - x0) * .55, 470, (x1 - x0) * .32, 34, '#8a5a32', '#6b4424', 0, 0, 0, 0); K.ce(x0 + (x1 - x0) * .5, 380, (x1 - x0) * .2, 20, '#8a5a32', '#6b4424', 0, 0, 0, 0); K.gl(x0 + (x1 - x0) * .45, 466, 30, 6, .25, -.05); }
        else for (const [hx, hy] of [[x0 + 40, 330], [x0 + (x1 - x0) * .6, 512]]) { K.cr(hx - 26, hy - 18, 52, 30, 6, '#f6d35e', '#d9a82c', 4, 3, 3); X.strokeStyle = '#b8862a'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(hx - 9, hy - 16); X.lineTo(hx - 9, hy + 10); X.moveTo(hx + 9, hy - 16); X.lineTo(hx + 9, hy + 10); X.stroke(); }
        fenceH(x0, x1, 300); fenceV(inner, 300, 430); fenceV(inner, 520, 540);
        const bx = (sd === 'L' ? Math.max(x0 + 105, 130) : Math.min(x1 - 105, 670));
        K.post(bx, 304, 64, 14); K.cr(bx - 98, 208, 196, 62, 8, '#f3d9a4', '#d6b476', 4.5, 3, 4);
      }
    });
  }
  const hatU = u => { const y0 = -9 * u; el(0, y0 - 1.2 * u, 7.6 * u, 1.5 * u); ink('#f2c94c', 3); K.cr(-4.1 * u, y0 - 5.4 * u, 8.2 * u, 4.4 * u, 1.6 * u, '#f6d35e', '#d9a82c', 3, u * .5, 0); ctx.fillStyle = '#e8433a'; ctx.fillRect(-4.1 * u + 1.5, y0 - 2.6 * u, 8.2 * u - 3, 1.1 * u); };

  BOSSES.sort = function (sp, s) {
    const k = Math.sqrt(Math.min(sp, 1.8));
    let f = 0, sorted = 0, clk = 0, point = 0, pointT = 0, hop = 0, knock = 0, ptr = null, ticked = false, why = null;
    const pops = [], buf = [];                                                        // buf: early presses, one per critter, in order
    const crits = []; let last = null, run = 0;
    for (let i = 0; i < NEED; i++) {
      let kind = Math.random() < .5 ? 'sheep' : 'pig'; if (kind === last && run >= 2) kind = kind === 'sheep' ? 'pig' : 'sheep';
      run = kind === last ? run + 1 : 1; last = kind;
      crits.push({ kind, dis: i >= NEED - 3 && Math.random() < .55, st: 'q', u: i === 0 ? .3 : SLOTS[i] || 0, sq: 0, walk: null, ph: Math.random() * 6 });
    }
    if (!crits.slice(-3).some(c => c.dis)) crits[NEED - 2].dis = true;
    crits[RUSH].rush = true;                                                          // mid-run twist: this one comes sprinting
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 260, y: 30 + (i * 37) % 90, v: 12 + i * 3, s: .7 + (i % 3) * .2 }));
    const front = () => crits[f];
    const ready = c => c && !g.result && (c.st === 'wait' || (c.st === 'q' && c.u > .72));
    const choose = side => {                                                         // every press sends one critter; early ones wait their turn
      const c = front(); if (!c || g.result) return false;
      if (ready(c) && !buf.length) { decide(side); return true; }
      if (buf.length >= 2) return false;
      buf.push(side); point = side === 'L' ? -1 : 1; pointT = .35; sfx.tick(); return true;
    };
    const decide = side => {
      const c = front(); if (!ready(c)) return;
      [c.x, c.y, c.s] = at(c.u); c.from = [c.x, c.y, c.s]; c.st = 'go'; c.side = side; c.t = 0; c.walk = 0;
      c.ok = (side === 'L') === (c.kind === 'sheep'); point = side === 'L' ? -1 : 1; pointT = .35; sfx.whoosh(); ticked = false;
      if (c.ok) {
        sorted++; f++; hop = .25; c.sq = .4; (c.kind === 'sheep' ? baa : oink)(); sfx.blip(sorted * 1.5);
        const [x0, x1] = pen(side); c.tx = x0 + 45 + Math.random() * (x1 - x0 - 90); c.ty = 350 + Math.random() * 165;
        pops.push({ s: window.t(c.kind === 'sheep' ? 'BAA!' : 'OINK!'), x: c.tx, y: Math.max(320, c.ty - 100), t: 0 }); burst(FX, FY - 50, '#FFE14D', 10); ring(FX, FY - 50, '#fff', 80, .3);
        if (sorted >= NEED) { g.result = 'win'; why = 'ALL SORTED!'; sfx.sparkle(); confetti(FX, 300, 60); ring(FX, 300, '#FFE14D', 220, .6); shake(8, .3); }
      } else { g.result = 'lose'; why = 'WRONG PEN!'; sfx.buzz(); }
    };
    const chaos = c => {                                                              // the wrong critter wrecks the pen
      c.st = 'bad'; c.vx = (c.side === 'L' ? -1 : 1) * 420; c.vy = -300; shake(14, .45); sfx.thud(); sfx.splat(); noise(.4, .15, 500, 150, 'lowpass');
      (c.kind === 'sheep' ? baa : oink)(); burst(c.x, c.y - 40, c.kind === 'pig' ? '#fff' : '#7a4a26', 26, 440); burst(c.x, c.y - 40, WOOD, 10, 360); ring(c.x, c.y - 40, '#ff4d4d', 130, .5);
      for (const r of crits) if (r.st === 'in' && r.side === c.side) { r.scared = 1; r.vx = (Math.random() - .5) * 500; r.vy = -200 - Math.random() * 200; }
    };
    const g = {
      cmd: 'BOSS!', hint: 'SORT: ← SHEEP · PIGS →', thint: 'TAP: ← SHEEP · PIGS →', dur: 14, boss: true, wide: true, swipe: true,
      key(e) { const d = KEYS[e.code]; if (!d || (ptr && ptr.used)) return; if (choose(d) && ptr) ptr.used = true; },   // one swipe = one decision
      down(p) { ptr = { x: p.x, used: false }; },
      up(p) { if (ptr && !ptr.used) { const dx = p.x - ptr.x; choose(Math.abs(dx) < 40 ? (ptr.x < FX ? 'L' : 'R') : dx < 0 ? 'L' : 'R'); } ptr = null; },   // tap = half, flick = direction
      update(dt) {
        clk += dt; pointT = Math.max(0, pointT - dt); hop = Math.max(0, hop - dt); knock *= Math.pow(.05, dt);
        for (const c of clouds) c.x += c.v * dt;
        for (let i = pops.length - 1; i >= 0; i--) if ((pops[i].t += dt) > .8) pops.splice(i, 1);
        crits.forEach((c, i) => {
          c.sq *= Math.pow(.003, dt);
          if (c.st === 'q') {
            const rush = c.rush && i === f, tgt = i - f < SLOTS.length ? SLOTS[i - f] : 0, d = tgt - c.u, v = (.85 + f * .11) * k * (rush ? 2.6 : 1) * dt;
            if (Math.abs(d) > .001) { c.u += Math.sign(d) * Math.min(Math.abs(d), v); c.walk = (c.walk || 0) + dt * (rush ? 1.6 : 1);
              if (rush && Math.random() < dt * 25) { const [x, y] = at(c.u); burst(x + (Math.random() - .5) * 40, y - 6, '#f0dcb4', 2, 90); } } else c.walk = null;
            if (i === f && c.u >= .999 && !g.result) { c.st = 'wait'; c.win = c.wt = Math.max(.85, 1.75 - f * .15) / k * (f ? 1 : 1.25) * (c.dis ? 1.12 : 1); c.sq = .5; c.walk = null; sfx.pop(); }
          } else if (c.st === 'go') {
            c.walk += dt;
            if (c.t < 1) { c.t = Math.min(1, c.t + dt / .32); const u = c.t, [ax, ay] = c.from, [gx, gy] = GATE[c.side], qx = FX + (c.side === 'L' ? -60 : 60), qy = FY + 55;
              c.x = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * qx + u * u * gx; c.y = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * qy + u * u * gy; c.s = 1 - u * .3;
              if (c.t >= 1 && !c.ok) chaos(c); }
            else { const dx = c.tx - c.x, dy = c.ty - c.y, l = Math.hypot(dx, dy), m = 380 * dt; c.s += (.62 - c.s) * Math.min(1, 6 * dt);
              if (l <= m) { c.x = c.tx; c.y = c.ty; c.st = 'in'; c.walk = null; c.sq = .4; burst(c.x, c.y - 40, '#ff6fa8', 6, 160); } else { c.x += dx / l * m; c.y += dy / l * m; } }
          } else if (c.st === 'bad' || (c.st === 'in' && c.scared)) {                 // bouncing around the wrecked pen
            const [x0, x1] = pen(c.side); c.walk = (c.walk || 0) + dt; c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
            if (c.x < x0 + 30 || c.x > x1 - 30) { c.vx *= -1; c.x = Math.max(x0 + 30, Math.min(x1 - 30, c.x)); }
            if (c.y > 520) { c.y = 520; c.vy = -260 - Math.random() * 260; c.vx += (Math.random() - .5) * 300; }
          } else if (c.st === 'off') { c.walk += dt;                                    // ambles down, bonks Caos, wanders off sideways
            if (!c.bump) { c.y += 300 * dt; c.s += .4 * dt; c.x += Math.sin(c.walk * 3) * 40 * dt; if (c.y > CY - 40) { c.bump = 1; knock = 60; sfx.thud(); shake(6, .2); } }
            else c.x += (c.kind === 'sheep' ? -1 : 1) * 260 * dt; }
        });
        if (g.result) return;
        const c = front();
        if (buf.length && ready(c)) decide(buf.shift());
        if (c && c.st === 'wait') {
          c.wt -= dt; if (!ticked && c.wt < c.win * .4) { ticked = true; sfx.tickHi(); }
          if (c.wt <= 0) {                                                             // got bored and wanders off
            g.result = 'lose'; why = 'TOO SLOW!'; [c.x, c.y, c.s] = at(1); c.st = 'off'; c.walk = 0; sfx.miss(); sfx.buzz();
          }
        }
      },
      draw(t) {
        const win = g.result === 'win', lose = g.result === 'lose';
        ctx.drawImage(scene(), -OX, 0);
        for (const c of clouds) { const x = ((c.x % (VW + 300)) + VW + 300) % (VW + 300) - OX - 150; K.cloud(x, c.y, c.s * 1.05); }      // drifting clouds
        for (let i = 0; i < 3; i++) { const bx = ((clk * 46 + i * 380) % (VW + 200)) - OX - 100, by = 120 + i * 24 + Math.sin(clk * 3 + i) * 6, fl = Math.sin(clk * 12 + i) * 5;   // birds
          ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx - 10, by - fl); ctx.quadraticCurveTo(bx - 4, by - 4, bx, by); ctx.quadraticCurveTo(bx + 4, by - 4, bx + 10, by - fl); ctx.stroke(); }
        // the scoreboard sign: a plank with a slot per critter (rainbow on a win, dull on a loss)
        K.cr(FX - 190, 62, 380, 66, 12, '#e9a35c', '#a5622c', 4.5, 3, 5);
        raw(window.t('SORTED {n} / {need}', { n: sorted, need: NEED }), FX, 82, 22, '#fff');
        for (let i = 0; i < NEED; i++) { const d = crits[i], on = i < sorted, x = FX + (i - (NEED - 1) / 2) * 28, pp = 1;
          const col = !on ? '#7a4a22' : win ? `hsl(${(i * 30 + clk * 500) % 360},85%,62%)` : d.kind === 'sheep' ? '#fff' : PINK;
          ctx.beginPath(); ctx.arc(x, 108, 10 * pp, 0, 7); ink(col, 3); if (on) { ctx.fillStyle = d.kind === 'sheep' ? FACE : P2; ctx.beginPath(); ctx.arc(x, 110, 4, 0, 7); ctx.fill(); } }
        for (const sd of ['L', 'R']) {                                                  // pen signs (the board is baked; icon and word are live)
          const [x0, x1] = pen(sd), bx = (sd === 'L' ? Math.max(x0 + 105, 130) : Math.min(x1 - 105, 670));
          critter({ kind: sd === 'L' ? 'sheep' : 'pig' }, bx - 58, 262, .46, {});
          txt(sd === 'L' ? 'SHEEP' : 'PIGS', bx + 28, 240, 28, sd === 'L' ? '#fff' : PINK, 'center', 120);
        }
        // critters + Caos, back to front
        const items = [];
        crits.forEach((c, i) => { if (c.st === 'q' && i - f >= SLOTS.length) return;
          const [x, y, sc] = c.st === 'q' || c.st === 'wait' ? at(c.u) : [c.x, c.y, c.s]; items.push({ y, fn: () => {
            const w = c.st === 'in' && !c.scared ? null : c.walk;
            if (i === f && !g.result && ready(c)) { const p = 1 + .06 * Math.sin(clk * 14);                    // spotlight on the decider
              ctx.beginPath(); ctx.ellipse(x, y + 2, 62 * sc * p, 17 * sc * p, 0, 0, 7); ctx.fillStyle = 'rgba(255,225,77,.5)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#FFE14D'; ctx.stroke(); }
            K.shade(x, y + 2, 40 * sc, 9 * sc, .25);
            const mood = c.st === 'bad' || c.scared ? 'scared' : c.st === 'in' || (c.st === 'go' && c.ok) ? 'happy' : c.st === 'off' ? 'happy' : null;
            const yy = y - (c.st === 'in' && win ? Math.abs(Math.sin(clk * 12 + c.ph)) * 20 : c.st === 'in' ? Math.abs(Math.sin(clk * 3 + c.ph)) * 3 : 0);
            critter(c, x, yy, sc, { walk: w, mood, tilt: c.st === 'go' ? (c.side === 'L' ? -.18 : .18) : c.st === 'bad' ? Math.sin(clk * 30) * .3 : 0, sweat: c.st === 'wait' && c.wt < c.win * .5 });
            if (c.st === 'wait' && !g.result) {                                      // "?" bubble with a draining timer ring
              const bx = x + 86, by = y - 72, u = c.wt / c.win;                      // beside the decider's own head
              ctx.beginPath(); ctx.moveTo(bx - 18, by - 10); ctx.lineTo(bx - 40, by + 6); ctx.lineTo(bx - 16, by + 12); ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.fill(); ctx.stroke();
              circ(bx, by, 24, '#fff', 4); raw('?', bx, by + 2, 34 + Math.sin(clk * 20) * 3, u < .4 ? '#ff4d4d' : '#4DB8FF');
              ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.arc(bx, by, 34, -Math.PI / 2, -Math.PI / 2 + u * 6.283); ctx.stroke();
              ctx.strokeStyle = u < .4 ? '#ff4d4d' : '#FFE14D'; ctx.lineWidth = 6; ctx.stroke(); ctx.lineCap = 'butt';
            }
            if (c.st === 'off') { raw('♪', x + 40 * sc, y - 120 * sc + Math.sin(clk * 8) * 6, 30, '#fff'); }
          } }); });
        items.push({ y: CY, fn: () => {                                                   // Caos the farmer, pointing the way
          const cx = FX + knock + point * pointT * 30, cy = CY - (win ? Math.abs(Math.sin(clk * 10)) * 18 : hop > 0 ? Math.sin(hop / .25 * Math.PI) * 14 : 0), pa = pointT > 0 ? 1 : 0;
          K.shade(FX + knock, CY + 2, 34, 7, .3);
          ctx.save(); ctx.translate(cx, cy); ctx.transform(1, 0, -point * pointT * .9, 1, 0, 0);
          const la = win ? -.4 : pa && point < 0 ? -1.45 : -2.5, ra = win ? .4 : pa && point > 0 ? 1.45 : 2.5;
          K.arms(4, la, ra, 1); caos(0, 0, 4, { mood: lose ? 'sad' : win || hop > 0 ? 'happy' : null }); hatU(4);
          if (lose) K.sweat(26, -40, .9, clk);
          ctx.restore();
          if (pointT > 0) drawArrow(FX + point * 74, CY - 30, point < 0 ? 3 : 1, 24 * (1 + pointT), '#FFE14D');
        } });
        items.sort((a, b) => a.y - b.y).forEach(it => it.fn());
        for (const sd of ['L', 'R']) { const [x0, x1] = pen(sd); fenceH(x0, x1, 548); }   // front rails over the pens
        const c = front();                                                               // big L/R arrows by the waiting critter
        if (ready(c)) { const p = 1 + .08 * Math.sin(clk * 16), live = c.st === 'wait' ? 1 : .55;
          ctx.globalAlpha = live; drawArrow(FX - 112, FY + 22, 3, 32 * p, '#fff'); drawArrow(FX + 112, FY + 22, 1, 32 * p, '#fff'); ctx.globalAlpha = 1; }
        for (const q of pops) { ctx.globalAlpha = 1 - q.t * q.t * 1.5; raw(q.s, q.x, q.y - q.t * 50, 30 * (1 + Math.max(0, .15 - q.t) * 2), '#fff'); ctx.globalAlpha = 1; }
        if (why) raw(window.t(why), FX, 482 + Math.sin(clk * 16) * 4, why === 'ALL SORTED!' ? 50 : 42, g.result === 'win' ? '#FFE14D' : '#ff6b6b');   // below the NICE!/FAIL! stamp
        vignette(.3);
      },
      probe: () => { const c = front(), side = c ? (c.kind === 'sheep' ? 'L' : 'R') : null, r = ready(c);
        return { phase: c ? c.st : 'done', front: f, kind: c ? c.kind : null, disguised: c ? !!c.dis : null, side, ready: !!r, u: c ? +(c.u || 0).toFixed(3) : null,
          press: r ? (side === 'L' ? 'ArrowLeft' : 'ArrowRight') : null, tap: r ? (side === 'L' ? [200, 420] : [600, 420]) : null,
          left: c && c.st === 'wait' ? +c.wt.toFixed(3) : null, window: c && c.win ? +c.win.toFixed(3) : null, rush: c ? !!c.rush : null, buffered: buf.join(''), sorted, need: NEED, result: g.result || null, why }; }
    };
    return g;
  };
})();
