'use strict';
/* Twisted wave 2 — WarioWare: Twisted! inspired tilt microgames.
   Tilt = mouse/touch X (centre level, edges +-35deg) or Left/Right / A/D. World is drawn rotated by the tilt. */
(function () {
  const MAXT = 35 * Math.PI / 180;
  const CREAM = '#FFF1D6', CREAM2 = '#FFE3B0', ORG = '#FF9F43', ORD = '#E8742B';

  /* shared tilt controller */
  function tiltCtl() {
    const s = { v: 0, n: 0, px: W / 2, kd: 0 };
    s.step = function (dt) {
      const l = keys.ArrowLeft || keys.KeyA, r = keys.ArrowRight || keys.KeyD;
      let tg;
      if (l || r) { s.kd = (r ? 1 : 0) - (l ? 1 : 0); tg = s.kd * MAXT; }
      else tg = Math.max(-1, Math.min(1, (s.px - W / 2) / (VW / 2 - 40))) * MAXT;
      s.v += (tg - s.v) * Math.min(1, dt * (l || r ? 7 : 12));
      s.n = s.v / MAXT;
    };
    s.ptr = p => { s.px = p.x; };
    return s;
  }
  const sad = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
  const lose = () => { sfx.miss(); sfx.thud(); shake(8, .25); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ───────────── art kit (the DUO look, docs/ART-STYLE.md): a local copy of the DUO drawing helpers.
     Everything draws on X, which can be swapped for an offscreen context so the same code bakes the static scene once.
     Cosmetic only: nothing here calls Math.random, so the game RNG (and party sync) is never touched. ───────────── */
  const K = (() => {
    const TAU = Math.PI * 2;
    let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
    const K = { TAU };
    K.use = () => { X = ctx; };
    const cl = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    K.ease = k => { k = cl(k, 0, 1); return k * k * (3 - 2 * k); };
    K.outBack = k => { k = cl(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
    K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
    const CA = {};
    K.cache = (key, w, h, fn) => { const k = key + '@' + w + 'x' + h; return CA[k] || (CA[k] = K.bake(w, h, fn)); };
    const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
    const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
    const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
    const inkP = K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
    const cel = K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
    K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
    const PM = {};
    K.P = (key, fn) => PM[key] || (PM[key] = (() => { const p = new Path2D(); fn(p); return p; })());
    K.rrP = (x, y, w, h, r) => K.P('r' + x + ',' + y + ',' + w + ',' + h + ',' + r, p => { p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); });
    K.elP = (x, y, rx, ry) => K.P('e' + x + ',' + y + ',' + rx + ',' + ry, p => p.ellipse(x, y, rx, ry, 0, 0, TAU));
    K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
    K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
    K.heart = (x, y, s, a = 1) => {
      X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
      ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
    };
    K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
    K.zee = (x, y, s, a) => {
      X.save(); X.globalAlpha = cl(a, 0, 1); X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
      X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.restore();
    };
    /* blocky Caos arms (hippo.js): origin at Caos's feet, drawn before caos() */
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
    /* crane.js eye: sclera, pupil looking at the action, white dot, blink, moods (idle, happy, bonk, sleep, panic, dizzy) */
    K.eye = (x, y, r, mood, look, T, k) => {
      X.lineCap = 'round';
      if (mood === 'happy') { X.lineWidth = r * .55; X.strokeStyle = INK; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
      if (mood === 'bonk' || mood === 'sleep') { X.lineWidth = r * .5; X.strokeStyle = INK; X.beginPath(); if (mood === 'sleep') X.arc(x, y - r * .2, r * .7, Math.PI * .15, Math.PI * .85); else { const d = k ? -1 : 1; X.moveTo(x - r * .7 * d, y - r * .5); X.lineTo(x + r * .4 * d, y); X.lineTo(x - r * .7 * d, y + r * .5); } X.stroke(); return; }
      const big = mood === 'panic' ? 1.3 : 1;
      el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(1.5, r * .28));
      if (mood === 'dizzy') { X.strokeStyle = INK; X.lineWidth = Math.max(1.5, r * .22); X.beginPath(); for (let i = 0; i < 24; i++) { const a = i * .55 * (k ? -1 : 1) + T * 9 * (k ? -1 : 1), q = i / 24 * r * .85; X.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } X.stroke(); return; }
      if (mood !== 'panic' && Math.sin(T * 1.9 + k * .2 + x * .01) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
      const pr = mood === 'panic' ? r * .32 : r * .52, lx = cl(look[0], -1, 1) * r * .38, ly = cl(look[1], -1, 1) * r * .38;
      X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
      X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .38, pr * .32); X.fill();
    };
    K.cloud = (x, y, s) => {
      X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
    };
    K.sun = (sx, sy, T) => {
      X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
      for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 40); X.lineTo(8, 40); X.lineTo(0, 70); X.fill(); }
      X.restore(); X.beginPath(); X.arc(sx, sy, 32, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 10, sy - 10, 12, 8, -.6); X.fill();
    };
    K.puff = (x, y, r, a = 1, col = '#f4ead8') => {
      if (a <= 0) return; X.save(); X.globalAlpha = cl(a, 0, 1);
      const c = [[-r * .6, 0, r * .62], [0, -r * .35, r * .75], [r * .6, 0, r * .6], [0, r * .2, r * .6]];
      for (const [a2, b, q] of c) { X.beginPath(); X.arc(x + a2, y + b, q, 0, TAU); ink(null, 3); }
      for (const [a2, b, q] of c) { X.beginPath(); X.arc(x + a2, y + b, q, 0, TAU); X.fillStyle = col; X.fill(); }
      X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .25, y - r * .5, r * .35, r * .2, -.4); X.fill(); X.restore();
    };
    K.shade = (x, y, rx, ry, a = .25) => { X.fillStyle = `rgba(20,16,28,${a})`; el(x, y, rx, ry); X.fill(); };
    /* the tilt readout, as a yellow spirit level with a bubble (replaces the flat tilt bar; UI in the world) */
    K.level = (n, T, dy = 0, al = 1) => {
      X.save(); X.globalAlpha = al; X.translate(0, dy);
      const P = K.rrP(296, 502, 208, 34, 15);
      X.fillStyle = 'rgba(20,16,28,.3)'; rr(300, 509, 208, 34, 15); X.fill();
      K.cel(P, '#ffd23f', '#d39b12', 2, 5, 4);
      rr(312, 509, 176, 20, 10); ink('#e6fff0', 3);
      X.strokeStyle = 'rgba(20,16,28,.55)'; X.lineWidth = 3; X.beginPath(); X.moveTo(386, 511); X.lineTo(386, 527); X.moveTo(414, 511); X.lineTo(414, 527); X.stroke();
      const bx = 400 + cl(n, -1, 1) * 74, ok = Math.abs(n) < .12;
      el(bx, 519, 12, 8.5); ink(ok ? '#6dff8c' : '#ffb347', 2.5); X.fillStyle = 'rgba(255,255,255,.7)'; el(bx - 4, 516, 4, 2.4, -.4); X.fill();
      X.fillStyle = '#fff3a0'; X.beginPath(); X.arc(306, 519, 2.5, 0, TAU); X.arc(494, 519, 2.5, 0, TAU); X.fill();
      X.restore();
    };
    return K;
  })();
  const { rr, el, ink, inkP, cel, glint, line, outBack, ease, hash, TAU } = K;
  const baked = (key, fn) => K.cache(key, VW, H, X => { X.translate(OX, 0); fn(X); });   // static scene, VW wide
  const vigH = () => vignette(.18);

  /* ── 1 SLIDE: slide the cheese into the mouse hole on the ice (inside a fridge) ── */
  function slideBg(X) {
    const gr = X.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#b5ece0'); gr.addColorStop(.5, '#e2fbf3'); gr.addColorStop(1, '#c4eadf');
    X.fillStyle = gr; X.fillRect(-OX, 0, VW, H);
    X.strokeStyle = 'rgba(70,160,150,.18)'; X.lineWidth = 3; for (let x = -OX - ((OX + 60) % 130) - 70; x < W + OX + 60; x += 130) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, H); X.stroke(); }
    const gl = X.createRadialGradient(400, 0, 10, 400, 0, 460); gl.addColorStop(0, 'rgba(255,250,200,.65)'); gl.addColorStop(1, 'rgba(255,250,200,0)'); X.fillStyle = gl; X.fillRect(-OX, 0, VW, H);
    // fridge lamp
    rr(352, -30, 96, 30, 12); ink('#e9eef3', 4); el(400, 0, 36, 13); ink('#fff7b8', 3);
    // glass shelf
    rr(-OX - 12, 248, VW + 24, 16, 6); ink('#d6f4ff', 4); X.fillStyle = 'rgba(255,255,255,.7)'; rr(-OX, 251, VW, 4, 2); X.fill();
    // pickle jar (left)
    const jar = K.rrP(108, 142, 96, 106, 18);
    X.fillStyle = 'rgba(20,16,28,.25)'; el(156, 250, 52, 7); X.fill();
    cel(jar, '#d6f7e8', '#9fdcc2', 4, 6, 4);
    for (const [px, py, r] of [[132, 176, 1], [160, 162, 1.1], [180, 184, .9]]) { X.save(); X.translate(px, py); X.rotate(.4 * r); el(0, 0, 9 * r, 21 * r); ink('#7ac043', 3); X.fillStyle = '#5ea232'; el(3, 4, 3, 12); X.fill(); X.restore(); }
    rr(112, 126, 88, 20, 7); ink('#ffd23f', 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(118, 130, 40, 5, 2.5); X.fill();
    rr(114, 188, 84, 50, 8); ink('#fff1d6', 3);
    glint(jar, 124, 164, 5, 22, .5, .1);
    // milk carton (right)
    X.fillStyle = 'rgba(20,16,28,.25)'; el(660, 250, 50, 7); X.fill();
    X.beginPath(); X.moveTo(616, 156); X.lineTo(660, 122); X.lineTo(704, 156); X.closePath(); ink('#9ac9f5', 4);
    rr(616, 150, 88, 98, 6); ink('#f4f9ff', 4); X.save(); X.clip(K.rrP(616, 150, 88, 98, 6)); X.fillStyle = '#cfe6fb'; X.fillRect(690, 150, 20, 100); X.fillStyle = '#4a86d8'; X.fillRect(616, 226, 90, 22); X.restore();
    X.fillStyle = INK; for (const [a, b, r] of [[630, 232, 4], [650, 236, 3], [676, 234, 4]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fill(); }
  }
  function twSlide(sp) {
    const hx = (Math.random() < .5 ? -1 : 1) * (120 + Math.random() * 80), HW = 46, LIM = 296;
    const tl = tiltCtl();
    let x = -hx * .5 + (Math.random() - .5) * 60, vx = 0, c = 0, sink = 0, fall = 0, ang = 0, ot = 0;
    const g = {
      cmd: 'SLIDE!', hint: 'MOUSE X / ARROWS: TILT THE CHEESE INTO THE HOLE', thint: 'DRAG LEFT / RIGHT TO TILT', dur: 5,
      wide: true, move: tl.ptr, down: tl.ptr,
      update(dt) {
        tl.step(dt); c += dt; if (g.result) ot += dt;
        if (g.result === 'win') { sink += dt; return; }
        if (g.result === 'lose') { fall += dt; return; }
        const G = 640 * (.85 + .15 * sp);
        vx += Math.sin(tl.v) * G * dt; vx *= Math.pow(.62, dt);   // ice: little friction
        x += vx * dt; ang += vx * dt / 40;
        if (x > LIM && vx > 0) { x = LIM; if (Math.abs(vx) > 160) sfx.thud(); vx = -vx * .35; }
        if (x < -LIM && vx < 0) { x = -LIM; if (Math.abs(vx) > 160) sfx.thud(); vx = -vx * .35; }
        if (Math.abs(x) > 252 && !g.result) {      // spiky walls
          g.result = 'lose'; lose(); sfx.zap(); burst(x + 24 * Math.sign(x) * 0, 0, '#FFC93C', 16); ring(400 + x, 300, '#ff4d4d', 80); floatText('OUCH!', 400, 200, '#ff4d4d', 44);
        } else if (Math.abs(x - hx) < HW / 2 - 6 && Math.abs(vx) < 330) {
          g.result = 'win'; vx = 0; sfx.pop(); sfx.coin(); jingleWin(); confetti(400 + hx, 300, 26); burst(400 + hx, 330, '#FFE14D', 14); ring(400 + hx, 340, '#fff', 90); floatText('SQUEAK!', 400, 180, '#5CFF7A', 46); shake(5, .2);
        }
      }, draw(t) {
        K.use(); const X = ctx, res = g.result, T = c;
        X.drawImage(baked('slideBg', slideBg), -OX, 0);
        // live fridge gags: the pickle jar and the milk carton watch the cheese
        const lk = clamp((400 + x - 156) / 300, -1, 1), jm = res === 'lose' ? 'panic' : res === 'win' ? 'happy' : 'idle';
        K.eye(138, 213, 8, jm, [lk, .2], T, 0); K.eye(174, 213, 8, jm, [lk, .2], T, 1);
        X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath();
        if (res === 'win') X.arc(156, 222, 8, .15 * Math.PI, .85 * Math.PI); else if (res === 'lose') { X.moveTo(150, 228); X.quadraticCurveTo(156, 220, 162, 228); } else { X.moveTo(150, 228); X.lineTo(162, 228); } X.stroke();
        const mm = res ? 'panic' : 'sleep';
        K.eye(642, 184, 7.5, mm, [-.5, .6], T, 0); K.eye(678, 184, 7.5, mm, [-.5, .6], T, 1);
        X.fillStyle = 'rgba(255,110,165,.5)'; el(634, 200, 6, 3.6); X.fill(); el(686, 200, 6, 3.6); X.fill();
        if (!res) { K.zee(704, 120 - (T * 18 % 30), .8, 1 - (T * 18 % 30) / 30); }
        X.save(); X.translate(W / 2, H / 2); X.rotate(tl.v);
        // fridge body under the shelf, with a drawer handle
        X.fillStyle = INK; X.fillRect(-1400, 50, 2800, 1000); X.fillStyle = '#7fc6e2'; X.fillRect(-1400, 58, 2800, 1000);
        X.fillStyle = 'rgba(255,255,255,.18)'; for (let i = -6; i < 7; i++) X.fillRect(i * 170 - 40, 196, 36, 800);
        X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = 4; X.beginPath(); X.moveTo(-1400, 196); X.lineTo(1400, 196); X.stroke();
        rr(-100, 226, 200, 30, 15); ink('#d7dde6', 4); X.fillStyle = 'rgba(255,255,255,.6)'; rr(-86, 231, 120, 7, 3.5); X.fill();
        // the ice slab
        const slab = K.rrP(-380, 50, 760, 140, 16);
        cel(slab, '#d8f4ff', '#9ed7f0', 3, 12, 4);
        X.save(); X.clip(slab); X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 3; X.lineCap = 'round';
        for (let i = 0; i < 7; i++) { const sx = -330 + i * 105 + hash(i) * 30, sy = 80 + hash(i + 9) * 70; X.beginPath(); X.moveTo(sx, sy); X.quadraticCurveTo(sx + 30, sy - 8 + hash(i + 3) * 16, sx + 66, sy + 2); X.stroke(); }
        X.strokeStyle = 'rgba(120,190,225,.55)'; X.lineWidth = 2; for (let i = 0; i < 5; i++) { const sx = -300 + i * 150; X.beginPath(); X.moveTo(sx, 60); X.lineTo(sx + 26, 100); X.lineTo(sx + 6, 128); X.stroke(); }
        X.restore(); glint(slab, -250, 74, 120, 7, .55, -.04);
        for (let i = 0; i < 6; i++) { const k = .5 + .5 * Math.sin(T * 3 + i * 1.7); if (k > .55) K.star(-300 + i * 120 + hash(i) * 40, 100 + hash(i + 5) * 60, 6 * k, 2.2 * k, 4, .3, '#fff', 0); }
        // side rails
        for (const sx of [-392, 370]) { const rl = K.rrP(sx, -140, 22, 330, 8); cel(rl, '#d3d9e2', '#8f9cb3', 4, 0, 4); glint(rl, sx + 6, -60, 3, 70, .55, 0); }
        // forks (the spikes)
        const forks = (s0, s1) => {
          const n = 4, w = (s1 - s0) / n; rr(s0, 38, s1 - s0, 14, 5); ink('#cfd6e2', 3);
          for (let i = 0; i < n; i++) { const tx = s0 + (i + .5) * w; X.beginPath(); X.moveTo(tx - w * .3, 40); X.lineTo(tx, 8); X.lineTo(tx + w * .3, 40); X.closePath(); ink('#eef2f8', 3); X.fillStyle = 'rgba(120,135,160,.55)'; X.beginPath(); X.moveTo(tx + 1, 12); X.lineTo(tx + w * .3 - 1, 38); X.lineTo(tx + 1, 38); X.fill(); }
        };
        forks(-372, -280); forks(280, 372);
        // mouse hole in a wooden arch
        X.beginPath(); X.ellipse(hx, 52, HW / 2 + 9, 44, 0, Math.PI, 0); ink('#c98443', 4);
        X.beginPath(); X.ellipse(hx, 52, HW / 2 + 1, 36, 0, Math.PI, 0); ink('#2a1832', 3);
        X.fillStyle = 'rgba(255,255,255,.35)'; X.beginPath(); X.ellipse(hx - 4, 52, HW / 2 + 6, 41, 0, Math.PI * 1.1, Math.PI * 1.35); X.lineWidth = 4; X.strokeStyle = 'rgba(255,255,255,.45)'; X.stroke();
        // the mouse: calm, eager, worried, done
        const near = Math.abs(x - hx), worry = !res && (Math.abs(vx) > 300 || Math.abs(x) > 200), mood = res === 'win' ? 'happy' : res === 'lose' ? 'bonk' : worry ? 'panic' : 'idle';
        const mb = res === 'win' ? -Math.abs(Math.sin(c * 10)) * 11 : res ? 0 : Math.sin(c * 3) * 1.2 - (near < 140 ? 2 : 0);
        const my = 34 + mb, mc = '#c9c1d8';
        for (const s of [-1, 1]) { el(hx + s * 15, my - 15, 8, 9); ink('#c9c1d8', 3); X.fillStyle = '#ffb3c6'; el(hx + s * 15, my - 14, 4.6, 5.6); X.fill(); }
        const head = K.elP(hx, my, 18, 17);
        X.save(); X.translate(hx, 0); X.translate(-hx, 0); cel(head, mc, '#968daf', 3, 4, 3.5); glint(head, hx - 7, my - 8, 6, 3, .5, -.5); X.restore();
        if (res === 'win' && sink > .3) { for (const s of [-1, 1]) { el(hx + s * 13, my + 7, 8, 7); ink(mc, 0); X.fillStyle = 'rgba(255,110,165,.55)'; X.fill(); } }
        const mlk = [clamp((x - hx) / 120, -1, 1), .3];
        K.eye(hx - 7, my - 2, 5.8, mood, mlk, T, 0); K.eye(hx + 7, my - 2, 5.8, mood, mlk, T, 1);
        el(hx, my + 6, 3.4, 2.8); ink('#ff8aa6', 2); X.strokeStyle = 'rgba(20,16,28,.6)'; X.lineWidth = 1.6; X.beginPath(); X.moveTo(hx - 18, my + 4); X.lineTo(hx - 28, my + 1); X.moveTo(hx - 18, my + 8); X.lineTo(hx - 28, my + 10); X.moveTo(hx + 18, my + 4); X.lineTo(hx + 28, my + 1); X.moveTo(hx + 18, my + 8); X.lineTo(hx + 28, my + 10); X.stroke();
        X.strokeStyle = INK; X.lineWidth = 2.6; X.lineCap = 'round'; X.beginPath();
        if (mood === 'happy') { X.arc(hx, my + 8, 5, .1 * Math.PI, .9 * Math.PI); } else if (mood === 'panic') { X.moveTo(hx - 5, my + 12); X.quadraticCurveTo(hx, my + 8, hx + 5, my + 12); } else if (mood === 'bonk') { X.moveTo(hx - 4, my + 12); X.lineTo(hx + 4, my + 10); } else { X.moveTo(hx - 4, my + 10); X.quadraticCurveTo(hx, my + 13, hx + 4, my + 10); } X.stroke();
        if (worry) K.sweat(hx + 15, my - 12, 1, T);
        if (res === 'lose') { X.fillStyle = '#9fe3ff'; for (const s of [-1, 1]) { el(hx + s * 9, my + 8 + (T * 30 % 14), 2, 4); X.fill(); } }
        for (const s of [-1, 1]) { el(hx + s * 13, 52, 5.5, 4.5); ink(mc, 2.5); }
        if (res === 'win') for (let i = 0; i < 3; i++) { const k = clamp(sink * 1.1 - i * .12, 0, 1); if (k > 0 && k < 1) K.heart(hx + (i - 1) * 44, my - 34 - k * 150, 2 + i * .15, 1 - k * k * k * .7); }
        // the cheese: a wedge with a face, scared near the forks
        const sc = res === 'win' ? Math.max(0, 1 - sink * 2.2) : 1, cy = 24 + (res === 'lose' ? Math.min(12, fall * 60) : 0);
        const cmood = res === 'lose' ? 'bonk' : res === 'win' ? 'happy' : (Math.abs(x) > 190 || Math.abs(vx) > 340) ? 'panic' : 'idle';
        K.shade(x, 52, 36 * sc, 7, .3);
        if (sc > .02) {
          X.save(); X.translate(x, cy); X.scale(sc, sc); X.rotate(res === 'lose' ? .4 * Math.sign(x) : Math.sin(ang) * .05);
          const wedge = K.P('wedge', p => { p.moveTo(-30, 24); p.lineTo(30, 24); p.lineTo(30, -14); p.lineTo(-4, -28); p.lineTo(-30, -14); p.closePath(); });
          cel(wedge, '#ffd23f', '#e89a1a', 5, 6, 4.5);
          X.fillStyle = '#f0a822'; for (const [a, b, r] of [[-21, -6, 4], [23, 12, 4.2], [0, -18, 3.4]]) { el(a, b, r, r * .85); ink('#f0a822', 2); }
          glint(wedge, -16, -14, 11, 4, .55, -.5);
          const lkc = [Math.sign(hx - x) * .8, 0];
          K.eye(-9, 3, 5.4, cmood, lkc, T, 0); K.eye(9, 3, 5.4, cmood, lkc, T, 1);
          X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath();
          if (cmood === 'happy') X.arc(0, 11, 7, .1 * Math.PI, .9 * Math.PI); else if (cmood === 'panic') { X.moveTo(-6, 17); X.quadraticCurveTo(0, 11, 6, 17); } else if (cmood === 'bonk') { X.moveTo(-6, 16); X.lineTo(6, 14); } else { X.moveTo(-5, 14); X.quadraticCurveTo(0, 18, 5, 14); } X.stroke();
          X.fillStyle = 'rgba(255,110,165,.45)'; el(-19, 11, 4, 2.4); X.fill(); el(19, 11, 4, 2.4); X.fill();
          if (cmood === 'panic') K.sweat(26, -8, 1, T);
          X.restore();
        }
        if (res === 'lose') { Math.sign(x) < 0 ? forks(-372, -280) : forks(280, 372); }   // the cheese is skewered: the tines are in front
        X.restore();
        // win: the jar and the carton cheer with hearts above them, outside the stamp
        if (res === 'win') for (const [hx2, i] of [[130, 0], [182, 1], [636, 2], [686, 3]]) { const k = clamp(ot * 1.1 - i * .08, 0, 1); if (k > 0) K.heart(hx2, 96 - k * 20 - Math.abs(Math.sin(ot * 6 + i)) * 10, 1.7, 1 - k * k * k * .6); }
        K.level(tl.n, T);
        vigH();
      }
    };
    return g;
  }

  /* ── 2 STEER: the tilt is the steering wheel (a country road full of sheep and cones) ── */
  function wheelTile(X) {
    const RL = 190, RR = 610;
    for (let i = 0; i < 2; i++) { X.fillStyle = i ? '#86d155' : '#93dc60'; X.fillRect(-OX, i * 135, VW, 135); }
    // tufts, flowers and rocks off the road (hashed, never the game RNG)
    for (let j = 0; j < 16; j++) {
      const side = j & 1 ? 1 : -1, y = 24 + hash(j * 3.7) * 222, w0 = side < 0 ? RL - 34 + OX : W + OX - RR - 34, x = side < 0 ? -OX + 14 + hash(j * 5.1) * w0 : RR + 30 + hash(j * 5.1) * w0, k = j % 3;
      if (k === 0) { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (const d of [-6, 0, 6]) { X.moveTo(x + d * .5, y); X.lineTo(x + d, y - 12 - Math.abs(d)); } X.stroke(); }
      else if (k === 1) { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.beginPath(); X.moveTo(x, y); X.lineTo(x, y - 12); X.stroke(); for (let a = 0; a < 5; a++) { X.beginPath(); X.arc(x + Math.cos(a * 1.26) * 6, y - 14 + Math.sin(a * 1.26) * 6, 4, 0, TAU); X.fillStyle = j % 2 ? '#fff' : '#ff9ac0'; X.fill(); } X.beginPath(); X.arc(x, y - 14, 3.4, 0, TAU); X.fillStyle = '#ffd23f'; X.fill(); }
      else { el(x, y, 11, 8); ink('#c9ced6', 3); X.fillStyle = 'rgba(255,255,255,.5)'; el(x - 3, y - 3, 4, 2.4, -.4); X.fill(); }
    }
    // the road: INK edges, asphalt, red/white curbs, yellow dashes, tyre marks
    X.fillStyle = INK; X.fillRect(RL - 14, 0, RR - RL + 28, 270);
    X.fillStyle = '#66627a'; X.fillRect(RL, 0, RR - RL, 270);
    X.fillStyle = 'rgba(20,16,28,.13)'; X.fillRect(300, 0, 34, 270); X.fillRect(466, 0, 34, 270);
    X.fillStyle = 'rgba(255,255,255,.06)'; X.fillRect(RL + 14, 0, 6, 270);
    for (let i = 0; i < 6; i++) { X.fillStyle = i & 1 ? '#fff' : '#ff4d5e'; X.fillRect(RL, i * 45, 14, 45); X.fillRect(RR - 14, i * 45, 14, 45); }
    X.fillStyle = INK; X.fillRect(RL + 14, 0, 3, 270); X.fillRect(RR - 17, 0, 3, 270);
    for (let i = 0; i < 3; i++) { rr(397, i * 90 + 8, 10, 46, 4); ink('#ffd23f', 2); }
  }
  function sheepAt(X, x, y, s, dir, look, mood, T, k) {
    X.save(); X.translate(x, y); X.scale(s, s);
    K.shade(0, 24, 26, 6, .22);
    for (const lx of [-9, 9]) { rr(lx - 3, 11, 6, 14, 2.5); ink('#4a3a55', 2.5); }
    const body = K.P('sheep', p => { for (const [a, b, r] of [[-12, 2, 14], [0, -5, 17], [12, 2, 14], [0, 7, 15]]) { p.moveTo(a + r, b); p.arc(a, b, r, 0, TAU); } });
    cel(body, '#fff', '#d3dcef', 3, 4, 3.5); glint(body, -8, -12, 9, 4, .6, -.4);
    const hx = dir * 22;
    X.beginPath(); X.ellipse(hx - dir * 11, -4, 5, 9, dir * .3, 0, TAU); ink('#4a3a55', 2.5);
    el(hx, 2, 11, 12.5); ink('#5b4a63', 3); X.fillStyle = 'rgba(255,255,255,.2)'; el(hx - 3, -4, 5, 2.4, -.5); X.fill();
    K.eye(hx - 4.2, 0, 3.8, mood, look, T, k); K.eye(hx + 4.2, 0, 3.8, mood, look, T, k + 1);
    X.strokeStyle = '#f0b8c8'; X.lineWidth = 2.6; X.lineCap = 'round'; X.beginPath();
    if (mood === 'happy') X.arc(hx, 6, 3.6, .1 * Math.PI, .9 * Math.PI); else if (mood === 'panic') { X.arc(hx, 9, 2.6, 0, TAU); } else { X.moveTo(hx - 3, 8); X.lineTo(hx + 3, 8); } X.stroke();
    X.restore();
  }
  function coneAt(X, q, car, T, spin) {
    X.save(); X.translate(q.x, q.y); if (q.hit) X.rotate(spin * .3);
    K.shade(0, 24, 24, 6, .3);
    const cone = K.P('cone', p => { p.moveTo(0, -28); p.lineTo(23, 22); p.lineTo(-23, 22); p.closePath(); });
    cel(cone, '#ff8a3d', '#d9611f', 4, 4, 4);
    X.save(); X.clip(cone); X.fillStyle = '#fff'; X.fillRect(-30, -8, 60, 16); X.fillStyle = '#ffd9bd'; X.fillRect(-30, 3, 60, 5); X.restore();
    rr(-28, 18, 56, 11, 4); cel(K.rrP(-28, 18, 56, 11, 4), '#e8651f', '#b8481a', 2, 3, 3.5);
    glint(cone, -6, -12, 3, 9, .5, .3);
    const dx = car.x - q.x, dy = 455 - q.y, nearCar = !q.hit && Math.hypot(dx, dy) < 190 && dy > -30, m = q.hit ? 'dizzy' : nearCar ? 'panic' : 'idle', lk = [clamp(dx / 80, -1, 1), clamp(dy / 120, -1, 1)];
    K.eye(-5.8, 0, 3.4, m, lk, T, q.x); K.eye(5.8, 0, 3.4, m, lk, T, q.x + 1);
    X.fillStyle = INK; if (nearCar) { el(0, 13, 3, 3.6); X.fill(); } else { el(0, 13, 3.4, 1.6); X.fill(); }
    X.restore();
  }
  function twWheel(sp) {
    const tl = tiltCtl(), RL = 190, RR = 610, rs = Math.sqrt(sp);
    let c = 0, x = 400, off = 0, spin = 0, cones = [], nxt = .5, near = 0, edge = 0, ot = 0;
    const g = {
      cmd: 'STEER!', hint: 'MOUSE X / ARROWS: TURN THE WHEEL, DODGE CONES', thint: 'DRAG LEFT / RIGHT TO STEER', dur: 5, timeWin: true,
      wide: true, move: tl.ptr, down: tl.ptr,
      update(dt) {
        tl.step(dt); c += dt; if (g.result) ot += dt;
        if (g.result) { spin += dt * 14; return; }
        const V = 330 * (.85 + .15 * sp); off += V * dt;
        x += tl.n * 420 * dt;
        if (x < RL + 24) { x = RL + 24; if (edge <= 0) { sfx.thud(); edge = .3; burst(x - 20, 460, '#fff', 4, 140); } }
        if (x > RR - 24) { x = RR - 24; if (edge <= 0) { sfx.thud(); edge = .3; burst(x + 20, 460, '#fff', 4, 140); } }
        edge -= dt;
        nxt -= dt;
        if (nxt <= 0) {
          nxt = (.5 + Math.random() * .25) / rs;
          let cx = RL + 36 + Math.random() * (RR - RL - 72);
          if (cones.length && Math.abs(cones[cones.length - 1].x - cx) > 260 && cones[cones.length - 1].y < 120) cx = cones[cones.length - 1].x + Math.sign(cx - cones[cones.length - 1].x) * 110;
          cones.push({ x: clamp(cx, RL + 30, RR - 30), y: -40, ok: false });
        }
        for (const q of cones) {
          q.y += V * dt;
          if (Math.hypot(q.x - x, q.y - 455) < 38 && !g.result) {
            g.result = 'lose'; lose(); sfx.splat(); burst(q.x, q.y, ORG, 14); ring(q.x, q.y, '#fff', 80); floatText('BONK!', q.x, 380, '#ff4d4d', 46); q.hit = 1;
          } else if (!q.ok && q.y > 500) { q.ok = true; near++; if (Math.abs(q.x - x) < 70) { sfx.blip(near % 7); floatText('NICE', q.x, 430, '#fff', 24); } }
        }
        cones = cones.filter(q => q.y < 680);
      }, draw(t) {
        K.use(); const X = ctx, res = g.result, T = c, car = { x };
        const tile = K.cache('wheelTile', VW, 270, X2 => { X2.translate(OX, 0); wheelTile(X2); }), o3 = off % 270;
        for (let i = -1; i < 3; i++) X.drawImage(tile, -OX, o3 + i * 270);
        // sheep in the pasture watch the car (hop when you win, gasp when you lose)
        for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 3; i++) {
          const sy = ((i * 250 + (side > 0 ? 120 : 0) + off) % 750) - 110, w0 = side < 0 ? RL - 70 + OX : W + OX - RR - 70, h = hash(i * 7 + side * 3);
          const sx = side < 0 ? -OX + 36 + h * w0 : RR + 40 + h * w0, hop = res === 'win' ? Math.abs(Math.sin(T * 9 + i)) * 9 : 0;
          const wd = Math.hypot(sx - (100 - OX * .8), sy - 455), sa = clamp((wd - 100) / 50, 0, 1); if (sa <= 0) continue;
          X.globalAlpha = sa;
          sheepAt(X, sx, sy - hop, .8 + h * .25, side < 0 ? 1 : -1, [clamp((x - sx) / 200, -1, 1), clamp((455 - sy) / 200, -1, 1)], res === 'win' ? 'happy' : res === 'lose' ? 'panic' : 'idle', T, i + side);
          X.globalAlpha = 1;
        }
        for (const q of cones) coneAt(X, q, car, T, spin);
        // the car (top view) with Caos at the wheel
        const lean = tl.n * .12 + (res ? Math.sin(spin) * .4 : 0), hop = res === 'win' ? Math.abs(Math.sin(c * 9)) * 9 : 0;
        if (!res) for (let i = 0; i < 3; i++) { const k = (c * 1.6 + i / 3) % 1; K.puff(x - tl.n * 14 * k, 506 + k * 44, 5 + k * 9, (1 - k) * .75, '#e8e4f0'); }
        X.save(); X.translate(x, 455 - hop); X.rotate(lean);
        if (!res || res === 'win') { X.fillStyle = 'rgba(255,245,170,.28)'; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 14 - 5, -46); X.lineTo(s * 14 + 5, -46); X.lineTo(s * 34, -140); X.lineTo(s * 14 - 22, -140); X.closePath(); X.fill(); } }
        K.shade(4, 8, 32, 46, .3);
        for (const [wx, wy] of [[-31, -34], [23, -34], [-31, 16], [23, 16]]) { rr(wx, wy, 8, 18, 3); ink('#2b2538', 2.5); }
        const body = K.rrP(-24, -42, 48, 84, 14); cel(body, '#ff5345', '#c0302a', 4, 5, 4.5);
        X.save(); X.clip(body); X.fillStyle = '#fff'; X.fillRect(-4, -44, 8, 90); X.fillStyle = 'rgba(255,255,255,.2)'; X.fillRect(-4, -44, 3, 90); X.restore();
        rr(-17, -22, 34, 26, 7); ink('#bfefff', 3.5); X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.moveTo(-12, -20); X.lineTo(-3, -20); X.lineTo(-12, 0); X.closePath(); X.fill();
        rr(-20, 14, 40, 14, 5); ink('#c0302a', 3);
        for (const s of [-1, 1]) { el(s * 14, -43, 6, 3.4); ink('#ffe14d', 2); el(s * 15, 41, 5, 2.8); ink('#ff2d3d', 2); }
        glint(body, -14, -30, 5, 2.6, .45, -.4);
        X.restore();
        caos(x, 462 - hop, 2.4, { mood: sad(g) });
        if (res === 'lose') { for (let i = 0; i < 3; i++) { const a = T * 5 + i * 2.1; K.star(x + Math.cos(a) * 30, 410 - hop + Math.sin(a) * 8, 8, 3.5, 5, a, '#FFE14D', 2.5); } K.puff(x + 24, 424, 11 + Math.min(10, ot * 14), 1 - clamp(ot * .9, 0, .6), '#9a96a8'); }
        if (res === 'win') for (let i = 0; i < 2; i++) { const k = clamp(ot * 1.2 - i * .25, 0, 1); if (k > 0 && k < 1) K.heart(x + (i ? 36 : -36), 420 - k * 60, .9, 1 - k * k); }
        // the steering wheel (the tilt readout): chunky ring, three spokes, a hub that watches
        X.save(); X.translate(100 - OX * .8, 455); X.rotate(res ? spin : tl.v * 2.6);
        K.shade(0, 86, 66, 10, .25);
        el(0, 0, 80, 80); ink('#3b3550', 4.5); X.save(); X.beginPath(); X.arc(0, 0, 80, 0, TAU); X.clip(); X.fillStyle = '#5a5274'; X.beginPath(); X.arc(-6, -6, 80, 0, TAU); X.arc(-6, -6, 58, 0, TAU, true); X.fill(); X.restore();
        el(0, 0, 58, 58); ink('#fff1d6', 4); X.fillStyle = 'rgba(255,255,255,.18)'; X.beginPath(); X.arc(0, 0, 70, 3.7, 4.5); X.lineWidth = 7; X.strokeStyle = 'rgba(255,255,255,.35)'; X.stroke();
        for (const a of [0, 2.1, 4.2]) { X.save(); X.rotate(a); rr(-8, 0, 16, 60, 6); ink('#ffb347', 3); X.restore(); }
        el(0, 0, 20, 20); ink('#ffd23f', 4); const hm = res === 'lose' ? 'dizzy' : res === 'win' ? 'happy' : 'idle';
        K.eye(-7, -2, 4.4, hm, [tl.n, 0], T, 0); K.eye(7, -2, 4.4, hm, [tl.n, 0], T, 1);
        rr(-6, -90, 12, 16, 3); ink('#ffd23f', 3);
        X.restore();
        // progress: a short road map with the car and the chequered flag
        const pr = clamp(c / (5 / Math.sqrt(sp)), 0, 1);
        rr(322, 62, 190, 20, 10); ink('#fff1d6', 3.5); X.save(); X.clip(K.rrP(322, 62, 190, 20, 10)); X.fillStyle = '#5CFF7A'; X.fillRect(322, 62, 190 * pr, 20); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(322, 64, 190 * pr, 5); X.restore();
        rr(318, 58, 198, 28, 14); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
        rr(336 + 160 * pr, 63, 22, 14, 5); ink('#ff5345', 2.5);
        X.fillStyle = INK; X.fillRect(520, 52, 4, 36); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { X.fillStyle = (i + j) & 1 ? INK : '#fff'; X.fillRect(524 + j * 8, 52 + i * 8, 8, 8); }
        K.level(tl.n, T, 8, .8);
        vigH();
      }
    };
    return g;
  }

  /* ── 3 COLLECT: roll the ball over every coin, skip the hungry holes (mini-golf course) ── */
  function coinsBg(X) {
    const sk = X.createLinearGradient(0, 0, 0, 330); sk.addColorStop(0, '#36b0ea'); sk.addColorStop(.55, '#86d8fb'); sk.addColorStop(1, '#d6f7ff'); X.fillStyle = sk; X.fillRect(-OX, 0, VW, H);
    X.fillStyle = '#c9d0fb'; X.beginPath(); X.moveTo(-OX, 300); for (let x = -OX; x <= W + OX + 40; x += 40) X.lineTo(x, 250 - 40 * Math.abs(Math.sin(x * .013 + 1)) - 10 * Math.sin(x * .05)); X.lineTo(W + OX, 300); X.closePath(); X.fill();
    X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(-OX, 310); for (let x = -OX; x <= W + OX + 40; x += 30) X.lineTo(x, 282 - 20 * Math.sin(x * .011 + 2)); X.lineTo(W + OX, 310); X.closePath(); X.fill();
    const gr = X.createLinearGradient(0, 300, 0, H); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944'); X.fillStyle = gr; X.fillRect(-OX, 300, VW, H - 300);
    X.fillStyle = INK; X.fillRect(-OX, 298, VW, 4);
    X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = -OX - 40; x < W + OX; x += 90) { X.beginPath(); X.moveTo(x, 302); X.lineTo(x + 40, 302); X.lineTo(x + 40 - 70, H); X.lineTo(x - 70, H); X.closePath(); X.fill(); }
    // lollipop trees
    for (const [tx, ty, s] of [[90, 296, 1], [250, 296, .8], [-OX + 40, 296, .9], [W + OX - 40, 296, .9]]) {
      rr(tx - 5 * s, ty - 40 * s, 10 * s, 44 * s, 3); ink('#8a5a34', 3);
      X.beginPath(); X.arc(tx, ty - 58 * s, 28 * s, 0, TAU); ink('#2f9a55', 4); X.fillStyle = '#43b366'; X.beginPath(); X.arc(tx - 5 * s, ty - 63 * s, 21 * s, 0, TAU); X.fill();
      X.fillStyle = 'rgba(255,255,255,.28)'; el(tx - 11 * s, ty - 70 * s, 8 * s, 5 * s, -.6); X.fill();
    }
    // windmill tower (the blades turn live)
    X.beginPath(); X.moveTo(612, 300); X.lineTo(668, 300); X.lineTo(656, 214); X.lineTo(624, 214); X.closePath(); cel(new Path2D('M612 300 L668 300 L656 214 L624 214 Z'), '#fff4dc', '#e2c895', 5, 0, 4);
    X.beginPath(); X.moveTo(616, 216); X.lineTo(640, 178); X.lineTo(664, 216); X.closePath(); ink('#e8434f', 4);
    X.beginPath(); X.moveTo(630, 300); X.lineTo(630, 280); X.arc(640, 280, 10, Math.PI, 0); X.lineTo(650, 300); X.closePath(); ink('#6b4a2b', 3);
    // flag + a tiny green
    X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(300, 302); X.lineTo(300, 238); X.stroke(); X.beginPath(); X.moveTo(300, 240); X.lineTo(330, 250); X.lineTo(300, 260); X.closePath(); ink('#ff4d5e', 3);
  }
  function twCoins(sp) {
    const tl = tiltCtl(), LIM = 330 + OX * .6;
    const nC = 4 + (Math.random() * 2 | 0);
    const holes = [-170, 120].map(h => h + (Math.random() - .5) * 40);
    const hx0 = holes[0], hx1 = holes[1];
    const coins = [];
    const zones = [-310, -240, -60, 40, 230, 310];
    shuffle(zones.slice()).slice(0, nC).forEach(z => coins.push({ x: z, got: false }));
    let x = (hx0 + hx1) / 2 - 20, vx = 0, c = 0, rot = 0, fall = 0, left = nC, pulse = 0, ot = 0;
    const g = {
      cmd: 'COLLECT!', hint: 'MOUSE X / ARROWS: TILT, GET ALL COINS, AVOID HOLES', thint: 'DRAG LEFT / RIGHT TO TILT', dur: 6,
      wide: true, move: tl.ptr, down: tl.ptr,
      update(dt) {
        tl.step(dt); c += dt; pulse = Math.max(0, pulse - dt); if (g.result) ot += dt;
        if (g.result === 'lose') { fall += dt; return; }
        if (g.result === 'win') return;
        const G = 660 * (.85 + .15 * sp);
        vx += Math.sin(tl.v) * G * dt; vx *= Math.pow(.55, dt); x += vx * dt; rot += vx * dt / 24;
        if (x > LIM && vx > 0) { x = LIM; vx = -vx * .5; sfx.thud(); }
        if (x < -LIM && vx < 0) { x = -LIM; vx = -vx * .5; sfx.thud(); }
        for (const q of coins) if (!q.got && Math.abs(q.x - x) < 36) {
          q.got = true; q.t0 = c; left--; pulse = .2; sfx.coin(); burst(400 + q.x, 300 + 0, '#FFE14D', 10); ring(400 + q.x, 300, '#fff', 50, .3); floatText('+1', 400 + q.x, 230, '#FFE14D', 30);
        }
        for (const h of holes) if (Math.abs(x - h) < 22 && Math.abs(vx) < 200 && !g.result) {
          g.result = 'lose'; x = h; lose(); sfx.whoosh(false); burst(400 + h, 340, '#fff', 10); floatText('PLOP!', 400 + h, 220, '#ff4d4d', 44);
        }
        if (left <= 0 && !g.result) { g.result = 'win'; jingleWin(); confetti(400, 300, 30); shake(5, .2); floatText('ALL COINS!', 400, 150, '#5CFF7A', 46); }
      }, draw(t) {
        K.use(); const X = ctx, res = g.result, T = c;
        X.drawImage(baked('coinsBg', coinsBg), -OX, 0);
        // live sky: turning sun, drifting clouds, windmill blades
        K.sun(110, 100, T);
        for (const [o, y, s, v] of [[0, 70, 1, 8], [420, 130, .8, 5], [800, 50, .9, 6]]) K.cloud(((T * v + o) % 1100) - 160, y, s);
        { const sm = res === 'win' ? 'happy' : res === 'lose' ? 'panic' : 'idle'; K.eye(100, 96, 5, sm, [.3, .3], T, 0); K.eye(120, 96, 5, sm, [.3, .3], T, 1);
          X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); if (res === 'win') X.arc(110, 104, 11, .05 * Math.PI, .95 * Math.PI); else if (res === 'lose') { X.arc(110, 118, 6, 0, TAU); } else { X.moveTo(103, 110); X.quadraticCurveTo(110, 114, 117, 110); } X.stroke();
          X.fillStyle = 'rgba(255,110,165,.5)'; el(92, 106, 5, 3); X.fill(); el(128, 106, 5, 3); X.fill(); }
        X.save(); X.translate(640, 214); X.rotate(T * 1.1 + (res === 'win' ? ot * ot * 14 + ot * 6 : 0)); for (let i = 0; i < 4; i++) { X.save(); X.rotate(i * Math.PI / 2); rr(-9, -78, 18, 74, 4); ink('#fff4dc', 3); X.fillStyle = '#e8434f'; X.fillRect(-9, -78, 18, 14); X.restore(); } X.restore(); el(640, 214, 9, 9); ink('#e8434f', 3);
        X.save(); X.translate(W / 2, H / 2); X.rotate(tl.v);
        // the green: dirt body with a grass lip, split by the hungry holes
        X.fillStyle = INK; X.fillRect(-1400, 58, 2800, 124); X.fillStyle = '#7a4a2a'; X.fillRect(-1400, 180, 2800, 700); X.fillStyle = INK; X.fillRect(-1400, 178, 2800, 5);
        const seg = (a, b) => {
          X.fillStyle = '#b97a46'; X.fillRect(a, 66, b - a, 104); X.fillStyle = '#a3663a'; X.fillRect(a, 142, b - a, 28);
          X.fillStyle = '#4fbf55'; X.fillRect(a, 66, b - a, 16); X.fillStyle = '#9af07a'; X.fillRect(a, 66, b - a, 6); X.fillStyle = '#35a043'; X.fillRect(a, 78, b - a, 4);
        };
        seg(-1400, hx0 - 30); seg(hx0 + 30, hx1 - 30); seg(hx1 + 30, 1400);
        for (let i = -12; i < 12; i++) { const px = i * 74 + hash(i) * 40; if (Math.abs(px - hx0) < 50 || Math.abs(px - hx1) < 50) continue; el(px, 108 + hash(i + 40) * 40, 8, 5.5); ink('#d9b48a', 2); }
        // a worm between the holes
        const wx = (hx0 + hx1) / 2, wy = 112;
        X.strokeStyle = INK; X.lineWidth = 14; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i <= 8; i++) X.lineTo(wx - 30 + i * 8, wy + Math.sin(T * 3 + i * .9) * 5); X.stroke();
        X.strokeStyle = '#ff9ab8'; X.lineWidth = 8; X.beginPath(); for (let i = 0; i <= 8; i++) X.lineTo(wx - 30 + i * 8, wy + Math.sin(T * 3 + i * .9) * 5); X.stroke();
        el(wx + 34, wy + Math.sin(T * 3 + 7.2) * 5 - 3, 2.4, 2.4); X.fillStyle = INK; X.fill();
        // the holes are monsters: eyes follow the ball, fangs, they nap when you win and chomp when you lose
        for (const h of holes) {
          rr(h - 36, 56, 72, 130, 8); ink('#2a1832', 4);
          const dz = Math.abs(x - h), mm = res === 'win' ? 'sleep' : res === 'lose' ? 'idle' : dz < 90 ? 'panic' : 'idle', lk = [clamp((x - h) / 90, -1, 1), -.4];
          if (mm !== 'sleep') { K.eye(h - 12, 118, 8.5, mm, lk, T, 0); K.eye(h + 12, 118, 8.5, mm, lk, T, 1); } else { K.eye(h - 12, 118, 8.5, 'sleep', lk, T, 0); K.eye(h + 12, 118, 8.5, 'sleep', lk, T, 1); K.zee(h + 6, 88 - (T * 16 % 24), .8, 1 - (T * 16 % 24) / 24); }
          for (let i = 0; i < 4; i++) { const tx = h - 27 + i * 18; X.beginPath(); X.moveTo(tx - 8, 182); X.lineTo(tx, 152 - (dz < 70 && !res ? 6 : 0)); X.lineTo(tx + 8, 182); X.closePath(); ink('#fff', 2.5); }
          const jaw = res === 'lose' && Math.abs(x - h) < 1 ? clamp(fall * 3, 0, 1) : 0;
          for (let i = 0; i < 4; i++) { const tx = h - 24 + i * 16; X.beginPath(); X.moveTo(tx - 7, 62); X.lineTo(tx, 82 + jaw * 50); X.lineTo(tx + 7, 62); X.closePath(); ink('#fff', 2.5); }
        }
        // coins: spinning gold, popping off when taken
        for (const q of coins) {
          if (q.got) { const k = clamp((c - (q.t0 || 0)) / .35, 0, 1); if (k < 1) { X.save(); X.globalAlpha = 1 - k; X.translate(q.x, 22 - k * 50); X.scale(1 + k * .5, 1 + k * .5); el(0, 0, 16, 16); ink('#ffd23f', 3.5); X.restore(); } continue; }
          K.shade(q.x, 64, 16, 4, .25);
          const cw = Math.abs(Math.cos(T * 3 + q.x * .05)) * .75 + .25, cy = 22 + Math.sin(T * 4 + q.x) * 4;
          X.save(); X.translate(q.x, cy); X.scale(cw, 1); el(0, 0, 16, 16); ink('#ffd23f', 4); el(0, 0, 10.5, 10.5); ink(null, 0); X.strokeStyle = '#d99a12'; X.lineWidth = 3; X.stroke(); X.fillStyle = 'rgba(255,255,255,.7)'; el(-5, -6, 3.5, 2, -.6); X.fill(); X.restore();
        }
        // the ball: a beach ball with a face
        const by = res === 'lose' ? 38 + fall * fall * 900 : 38 + (res === 'win' ? -Math.abs(Math.sin(c * 8)) * 14 : 0);
        K.shade(x, 64, 24, 6, res === 'lose' ? .1 : .3);
        X.save(); X.translate(x, by); X.rotate(rot);
        const ball = K.elP(0, 0, 24, 24); cel(ball, '#ff4d5e', '#c0283a', 4, 5, 4.5);
        X.save(); X.clip(ball); X.fillStyle = '#fff'; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 30, -.5, .55); X.closePath(); X.fill(); X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 30, 2.6, 3.7); X.closePath(); X.fill(); X.fillStyle = '#ffd23f'; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 30, 1.0, 1.5); X.closePath(); X.fill(); X.restore();
        glint(ball, -9, -10, 8, 4, .6, -.6);
        X.rotate(-rot);
        const dh = Math.min(Math.abs(x - hx0), Math.abs(x - hx1)), bm = res === 'win' ? 'happy' : res === 'lose' ? 'dizzy' : dh < 70 ? 'panic' : 'idle';
        let nc = null; for (const q of coins) if (!q.got && (!nc || Math.abs(q.x - x) < Math.abs(nc.x - x))) nc = q;
        const bl = [nc ? clamp((nc.x - x) / 80, -1, 1) : 0, .2];
        K.eye(-8, -3, 6.2, bm, bl, T, 0); K.eye(8, -3, 6.2, bm, bl, T, 1);
        X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath();
        if (bm === 'happy') X.arc(0, 8, 6, .1 * Math.PI, .9 * Math.PI); else if (bm === 'panic' || bm === 'dizzy') { X.moveTo(-5, 14); X.quadraticCurveTo(0, 8, 5, 14); } else { X.moveTo(-4, 10); X.quadraticCurveTo(0, 13, 4, 10); } X.stroke();
        X.fillStyle = 'rgba(255,255,255,.35)'; el(-17, 8, 3.6, 2.2); X.fill(); el(17, 8, 3.6, 2.2); X.fill();
        if (bm === 'panic') K.sweat(18, -14, .9, T);
        X.restore();
        if (res === 'lose') for (const h of holes) if (Math.abs(x - h) < 1) {   // the monster burps, past the stamp
          const sg = h < 0 ? -1 : 1, bk = clamp(ot / .9, 0, 1);
          for (let i = 0; i < 3; i++) { const k = clamp(bk * 1.2 - i * .12, 0, 1); if (k > 0) K.puff(h + sg * (60 + k * 120 + i * 34), 30 - k * 30 - i * 10, 14 + k * 22 - i * 3, 1 - k * k * .8, '#bfe8a0'); }
          if (bk < .5) for (let i = 0; i < 4; i++) { const tx = h - 27 + i * 18; X.beginPath(); X.moveTo(tx - 8, 66); X.lineTo(tx, 100 + Math.sin(ot * 40) * 3); X.lineTo(tx + 8, 66); X.closePath(); ink('#fff', 2.5); }
        }
        if (res === 'win') for (let i = 0; i < 3; i++) { const a = T * 4 + i * 2.1; K.star(x + Math.cos(a) * 34, by - 30 + Math.sin(a) * 6, 8, 3.5, 5, a, '#FFE14D', 2.5); }
        X.restore();
        // counter: a wooden scorecard with a coin slot per coin
        const pw = nC * 40 + 16, px0 = 400 - pw / 2;
        X.fillStyle = 'rgba(20,16,28,.3)'; rr(px0 + 4, 71, pw, 40, 12); X.fill();
        rr(px0, 64, pw, 40, 12); cel(K.rrP(px0, 64, pw, 40, 12), '#d9944f', '#a5622c', 2, 5, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(px0 + 8, 68, pw - 16, 5, 2.5); X.fill();
        for (let i = 0; i < nC; i++) {
          const cx = px0 + 28 + i * 40, got = i < nC - left; el(cx, 86, 15, 15); ink('#6b3f1c', 3);
          if (got) { const lastK = i === nC - left - 1 ? outBack(1 - pulse / .2) : 1, s = got ? (i === nC - left - 1 ? .6 + .4 * lastK : 1) : 0; X.save(); X.translate(cx, 86); X.scale(s, s); el(0, 0, 12, 12); ink('#ffd23f', 3); X.fillStyle = 'rgba(255,255,255,.7)'; el(-4, -5, 3, 2, -.6); X.fill(); X.restore(); }
        }
        K.level(tl.n, T);
        vigH();
      }
    };
    return g;
  }

  /* ── 4 BALANCE: keep Caos upright on a giant watermelon against gusts (ants on the rind) ── */
  function skateBg(X) {
    const sk = X.createLinearGradient(0, 0, 0, 340); sk.addColorStop(0, '#3fb0ff'); sk.addColorStop(.55, '#8fdcff'); sk.addColorStop(1, '#e6fbff'); X.fillStyle = sk; X.fillRect(-OX, 0, VW, H);
    X.fillStyle = '#c9d0fb'; X.beginPath(); X.moveTo(-OX, 330); for (let x = -OX; x <= W + OX + 40; x += 40) X.lineTo(x, 280 - 46 * Math.abs(Math.sin(x * .012 + .4))); X.lineTo(W + OX, 330); X.closePath(); X.fill();
    X.fillStyle = '#9be38a'; X.beginPath(); X.moveTo(-OX, 340); for (let x = -OX; x <= W + OX + 40; x += 30) X.lineTo(x, 318 - 18 * Math.sin(x * .014 + 1)); X.lineTo(W + OX, 340); X.closePath(); X.fill();
    X.strokeStyle = '#2f7a49'; X.lineWidth = 3; X.stroke();
    const gr = X.createLinearGradient(0, 340, 0, H); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944'); X.fillStyle = gr; X.fillRect(-OX, 340, VW, H - 340);
    X.fillStyle = INK; X.fillRect(-OX, 338, VW, 4);
    // picnic blanket on the far left and right of the lawn, and a basket
    for (const [bx, s] of [[-OX - 20, 1], [W + OX + 20, -1]]) {
      X.save(); X.translate(bx, 0); X.scale(s, 1); X.beginPath(); X.moveTo(0, 360); X.lineTo(150, 360); X.lineTo(190, 480); X.lineTo(0, 480); X.closePath(); ink('#fff', 3.5);
      X.save(); X.clip(); X.fillStyle = '#ff6b78'; for (let i = 0; i < 6; i++) X.fillRect(i * 36, 340, 18, 160); for (let j = 0; j < 4; j++) { X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(0, 360 + j * 36, 220, 18); } X.restore(); X.restore();
    }
    // the dome's shadow on the lawn
    X.fillStyle = 'rgba(20,16,28,.18)'; el(400, 570, 380, 26); X.fill();
  }
  const SURF = x => -110 + 270 * (x / 360) * (x / 360);
  function skateDome(X) {   // the giant melon rind, local coords: x -560..560 -> 0..1120, y -150..620 -> 0..770
    X.translate(560, 150);
    const top = new Path2D(); top.moveTo(-560, 700); for (let x = -560; x <= 560; x += 20) top.lineTo(x, SURF(x)); top.lineTo(560, 700); top.closePath();
    cel(top, '#46bb58', '#2c9244', 12, 12, 0);
    X.save(); X.clip(top);
    for (let k = -8; k <= 8; k++) {
      const x0 = k * 56, y0 = SURF(x0); X.beginPath();
      for (let y = y0 - 4; y < 640; y += 14) X.lineTo(x0 * (1 + (y - y0) / 420) + Math.sin(y * .045 + k) * 5, y);
      X.lineCap = 'round'; X.lineWidth = 16; X.strokeStyle = '#1f7d3a'; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#2c9244'; X.stroke();
    }
    X.fillStyle = 'rgba(255,255,255,.22)'; el(-150, -40, 130, 22, -.35); X.fill();
    X.restore();
    X.beginPath(); for (let x = -560; x <= 560; x += 20) X.lineTo(x, SURF(x)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = INK; X.stroke();
    X.beginPath(); for (let x = -540; x <= 540; x += 20) X.lineTo(x, SURF(x) + 9); X.lineWidth = 6; X.strokeStyle = '#a8f08a'; X.stroke();
  }
  function twSkate(sp) {
    const tl = tiltCtl();
    let c = 0, bal = 0, bv = 0, gust = 0, gt = 0, gtarget = 0, wind = [], ot = 0;
    const surf = x => -110 + 270 * (x / 360) * (x / 360);
    const dsurf = x => 540 * x / (360 * 360);
    gtarget = (Math.random() < .5 ? -1 : 1) * 2;
    const g = {
      cmd: 'BALANCE!', hint: 'MOUSE X / ARROWS: TILT AGAINST THE LEAN', thint: 'DRAG LEFT / RIGHT TO COUNTER LEAN', dur: 5, timeWin: true,
      wide: true, move: tl.ptr, down: tl.ptr,
      update(dt) {
        tl.step(dt); c += dt; if (g.result) ot += dt;
        if (g.result === 'lose') { bv += dt * 5; bal += bv * dt * Math.sign(bal || 1); return; }
        gt -= dt;
        if (gt <= 0) { gt = .55 + Math.random() * .4; gtarget = (Math.random() < .5 ? -1 : 1) * (1.8 + Math.random() * 1.8) * (.85 + .15 * sp); if (Math.random() < .5) { sfx.whoosh(gtarget > 0); wind.push({ y: 80 + Math.random() * 140, d: Math.sign(gtarget), t: 0 }); } }
        gust += (gtarget - gust) * Math.min(1, dt * 5);
        bv += (2.6 * bal + gust + 7.5 * tl.n) * dt; bv *= Math.pow(.35, dt); bal += bv * dt;
        for (const w of wind) w.t += dt; wind = wind.filter(w => w.t < .8);
        if (Math.abs(bal) > 1) { g.result = 'lose'; bv = 1; lose(); sfx.splat(); burst(400, 400, '#fff', 12); floatText('WIPEOUT!', 400, 180, '#ff4d4d', 46); }
        else if (Math.abs(bal) > .7 && Math.random() < dt * 8) sfx.tick();
      }, draw(t) {
        K.use(); const X = ctx, res = g.result, T = c;
        X.drawImage(baked('skateBg', skateBg), -OX, 0);
        K.sun(700, 96, T);
        for (const [o, y, s, v] of [[0, 90, 1, 8], [500, 150, .8, 5], [900, 60, .9, 6]]) K.cloud(((T * v + o) % 1100) - 160, y, s);
        X.save(); X.translate(W / 2, H / 2 + 20); X.rotate(tl.v);
        X.fillStyle = '#46bb58'; X.fillRect(-1400, 620, 2800, 700);
        X.drawImage(K.cache('skateDome', 1120, 770, skateDome), -560, -150);
        // ants marching along the rind with crumbs
        for (let i = 0; i < 5; i++) {
          const ax = ((T * 38 + i * 150) % 760) - 380, ay = surf(ax) + 40 + (i & 1) * 12, sl = Math.atan(dsurf(ax));
          X.save(); X.translate(ax, ay); X.rotate(sl); X.scale(.9, .9);
          for (const lx of [-6, 0, 6]) { X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(lx, 0); X.lineTo(lx + Math.sin(T * 20 + lx) * 3, 8); X.stroke(); }
          el(-9, 0, 5, 4); ink('#3b2a2a', 2); el(0, 0, 4.5, 4); ink('#3b2a2a', 2); el(9, -1, 5.5, 5); ink('#3b2a2a', 2);
          X.fillStyle = '#fff'; el(11, -2, 1.8, 1.8); X.fill(); X.fillStyle = INK; el(11.6, -2, .9, .9); X.fill();
          el(-2, -8, 4.4, 3.4); ink('#ff5c6a', 2); X.restore();
        }
        // skater
        const sx = res === 'lose' ? 0 : 200 * Math.sin(c * 1.5), sy = surf(sx), sl = Math.atan(dsurf(sx));
        K.shade(sx, sy + 12, 44, 8, .25);
        X.save(); X.translate(sx, sy); X.rotate(sl);
        const lsg = Math.sign(bal || 1), lox = ot * 320, loy = -Math.sin(Math.min(ot, .8) / .8 * Math.PI) * 160 + ot * ot * 200;
        X.save(); if (res === 'lose') { X.translate(-lsg * lox, loy); X.rotate(-lsg * ot * 6); }
        for (const wx of [-24, 24]) { X.beginPath(); X.arc(wx, 0, 11, 0, TAU); ink('#e8dcff', 3.5); X.fillStyle = '#9a8fbf'; X.beginPath(); X.arc(wx, 0, 3.4, 0, TAU); X.fill(); }
        const bd = K.rrP(-42, -16, 84, 10, 5); cel(bd, '#4DB8FF', '#2a86c9', 2, 3, 3); X.fillStyle = '#fff'; X.fillRect(-14, -14, 28, 3.5); glint(bd, -26, -13, 10, 1.8, .6, 0); X.restore();
        X.save(); X.translate(0, -16); X.rotate(bal * .65);
        if (res === 'lose') X.translate(lsg * lox * 1.25, loy * 1.3 - 40);
        const flail = Math.abs(bal), la = res === 'lose' ? -2.5 + Math.sin(T * 30) * .3 : -1.25 + bal * .45 - Math.sin(T * 13) * .18 * flail, ra = res === 'lose' ? 2.5 - Math.sin(T * 30) * .3 : 1.25 + bal * .45 + Math.sin(T * 13 + 1) * .18 * flail;
        K.arms(5.2, la, ra, 1);
        caos(0, 0, 5.2, { mood: sad(g) });
        rr(-31, -53, 62, 14, 7); ink('#ffd23f', 3.5); X.fillStyle = 'rgba(255,255,255,.4)'; rr(-22, -50, 26, 5, 2.5); X.fill();
        if (flail > .55 && !res) { K.sweat(40, -42, 1.2, T); K.sweat(-40, -40, 1.1, T + .4); }
        if (res === 'lose') for (let i = 0; i < 3; i++) { const a = T * 7 + i * 2.1; K.star(Math.cos(a) * 40, -59 + Math.sin(a) * 10, 9, 4, 5, a, '#FFE14D', 2.5); }
        if (res === 'win') for (const [hx3, hy, i] of [[-130, -70, 0], [130, -80, 1], [-190, -120, 2], [190, -130, 3]]) K.heart(hx3, hy - Math.abs(Math.sin(T * 6 + i)) * 12, 1.7);
        X.restore(); X.restore();
        X.restore();
        // wind streaks (the gusts)
        for (const w of wind) { const k = w.t / .8; X.globalAlpha = 1 - k; const x0 = w.d > 0 ? 80 - OX + k * (VW - 200) : W + OX - 80 - k * (VW - 200); line([[x0, w.y], [x0 + w.d * 60, w.y - 4], [x0 + w.d * 100, w.y]], 6, '#fff'); X.globalAlpha = 1; }
        // balance meter: a pill with a green sweet spot and a sliding marker (the lean)
        const bx0 = 310, bw = 180, mk = bx0 + bw / 2 + clamp(bal, -1, 1) * bw / 2;
        rr(bx0 - 4, 62, bw + 8, 26, 13); ink('#fff', 4); X.save(); X.clip(K.rrP(bx0 - 4, 62, bw + 8, 26, 13));
        const zs = [['#ff4d5e', 0, .15], ['#ffd23f', .15, .35], ['#5CFF7A', .35, .65], ['#ffd23f', .65, .85], ['#ff4d5e', .85, 1]]; for (const [col, a, b] of zs) { X.fillStyle = col; X.fillRect(bx0 - 4 + (bw + 8) * a, 62, (bw + 8) * (b - a), 26); }
        X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(bx0 - 4, 64, bw + 8, 5); X.restore();
        rr(mk - 7, 56, 14, 38, 6); ink('#fff', 3.5); X.fillStyle = INK; X.fillRect(mk - 1.5, 62, 3, 26);
        K.level(tl.n, T);
        vigH();
      }
    };
    return g;
  }

  reg('tw_slide', twSlide, 'SLIDE!');
  reg('tw_wheel', twWheel, 'STEER!');
  reg('tw_coins', twCoins, 'COLLECT!');
  reg('tw_skate', twSkate, 'BALANCE!');
})();
