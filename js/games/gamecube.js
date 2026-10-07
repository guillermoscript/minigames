'use strict';
/* GameCube wave — WarioWare Mega Party Game$ inspired microgames.
   Timelines run on "game seconds" (dt * sqrt(sp)) so they always fit inside dur (the engine uses dur / sqrt(sp)). */
const gcClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gcMood = g => g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null;
const gcLose = g => { if (!g.result) { g.result = 'lose'; g.t0 = now; sfx.buzz(); shake(7, .25); } };
const gcWin = g => { if (!g.result) { g.result = 'win'; g.t0 = now; sfx.coin(); } };
/* seconds since the verdict (art only): g.t0 is set when the game decides, or on the first drawn frame if main.js decided (timeout) */
const gcOut = g => g.result ? (g.t0 == null ? (g.t0 = now, 0) : now - g.t0) : -1;

/* ───────────── art kit for the stage-8 restyle (the DUO look, docs/ART-STYLE.md): a local copy of the drawing helpers.
   Everything draws on X, which can be swapped for an offscreen context so the same code bakes the static scene once.
   Cosmetic only: nothing here calls Math.random, so the seeded game RNG is never touched (variety comes from K.hash). ───────────── */
const GCK = (() => {
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
  const K = { TAU };
  K.use = () => { X = ctx; };
  const clamp = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  K.lerp = (a, b, k) => a + (b - a) * k;
  K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
  /* a wide static layer: baked once at the screen's real width (VW), offset by OX, re-baked only if the window shape changes */
  K.layer = fn => { let c = null, key = ''; return () => { const kk = OX + ',' + VW; if (!c || kk !== key) { key = kk; c = K.bake(VW, H, () => { X.translate(OX, 0); fn(); }); } ctx.drawImage(c, -OX, 0); }; };
  const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const inkP = K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  const cel = K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = 'rgba(255,255,255,' + a + ')'; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  const PC = {}; K.P = d => PC[d] || (typeof Path2D === 'undefined' ? null : PC[d] = new Path2D(d));   // (null in the catalog sandbox, which never draws)
  /* a rounded rect that is cel shaded (shade crescent bottom-right) + a glint: the workhorse prop */
  K.slab = (x, y, w, h, r, base, shade, o = 4, sh = 5) => { rr(x, y, w, h, r); ink(shade, o); X.save(); rr(x, y, w, h, r); X.clip(); X.translate(-sh, -sh); rr(x, y, w, h, r); X.fillStyle = base; X.fill(); X.restore(); X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 5, y + 4, Math.max(2, w - 10), Math.max(2, Math.min(7, h * .2)), 3); X.fill(); };
  K.ball = (x, y, r, base, shade, o = 4) => { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(shade, o); X.save(); X.beginPath(); X.arc(x, y, r, 0, TAU); X.clip(); X.fillStyle = base; X.beginPath(); X.arc(x - r * .18, y - r * .18, r, 0, TAU); X.fill(); X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .38, y - r * .42, r * .3, r * .18, -.6); X.fill(); X.restore(); };
  const line = K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  const starP = K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
  K.heart = (x, y, s, a = 1) => {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  };
  K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
  K.zee = (x, y, s, a) => {
    X.save(); X.globalAlpha = clamp(a, 0, 1); X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
    X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.restore();
  };
  /* blocky Claude arms (hippo.js): call with the origin at Claude's feet, before claude() */
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
  /* crane.js eye: sclera, pupil looking at the action, white dot, blink, moods */
  const eye = K.eye = (x, y, r, mood, look, T, k) => {
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
  /* a gold pill with a star and a pointer: "that's you" without words */
  K.tag = (x, y, col = '#FFE14D') => {
    X.beginPath(); X.moveTo(x - 8, y + 10); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 10); X.closePath(); ink(col, 3);
    rr(x - 22, y - 12, 44, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - 16, y - 9, 32, 6, 3); X.fill();
    starP(x, y + 1, 8.5, 4, 5, -Math.PI / 2, '#fff', 2);
  };
  K.shade = (x, y, rx, ry, a = .25) => { X.fillStyle = 'rgba(20,16,28,' + a + ')'; el(x, y, rx, ry); X.fill(); };
  K.keyCap = (s, x, y) => {
    X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.max(26, X.measureText(s).width + 14);
    rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, x, y + 1);
  };
  K.puff = (x, y, r, a = 1, col = '#f4ead8') => {
    if (a <= 0) return; X.save(); X.globalAlpha = clamp(a, 0, 1);
    const c = [[-r * .6, 0, r * .62], [0, -r * .35, r * .75], [r * .6, 0, r * .6], [0, r * .2, r * .6]];
    for (const [a2, b, q] of c) { X.beginPath(); X.arc(x + a2, y + b, q, 0, TAU); ink(null, 3); }
    for (const [a2, b, q] of c) { X.beginPath(); X.arc(x + a2, y + b, q, 0, TAU); X.fillStyle = col; X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .25, y - r * .5, r * .35, r * .2, -.4); X.fill(); X.restore();
  };
  K.rays = (x, y, r, T, a = .5, col = '255,240,150') => {
    X.save(); X.translate(x, y); X.rotate(T * .6); X.fillStyle = 'rgba(' + col + ',' + a + ')';
    for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(-r * .12, r * .25); X.lineTo(r * .12, r * .25); X.lineTo(0, r); X.fill(); }
    X.restore();
  };
  /* shouted words baked into a scene (same face as core txt) */
  K.stxt = (s, x, y, size, fill, rot = 0) => {
    s = t(s); X.save(); X.translate(x, y); X.rotate(rot); X.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round';
    X.lineWidth = size / 5; X.strokeStyle = INK; X.strokeText(s, 0, 0); X.fillStyle = fill; X.fillText(s, 0, 0); X.restore();
  };
  /* a feedback word on a coloured slab that pops in (badge()): sc/rot animate it, a = alpha */
  K.badge = (s, x, y, size, bg, fg, sc = 1, rot = 0, a = 1) => {
    s = t(s); X.save(); X.globalAlpha = clamp(a, 0, 1); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
    X.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; const w = Math.min(560, X.measureText(s).width + size * .9), h = size * 1.25;
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .46); X.fill();
    rr(-w / 2, -h / 2, w, h, h * .46); ink(bg, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + 10, -h / 2 + 5, w - 20, h * .2, h * .1); X.fill();
    X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round'; X.lineWidth = size / 6; X.strokeStyle = INK; X.strokeText(s, 0, 2); X.fillStyle = fg; X.fillText(s, 0, 2); X.restore();
  };
  /* the pop animation of a badge from the outro clock */
  K.pop = (oT, s, x, y, size, bg, fg, delay = 0, rot = -.06) => { const q = oT - delay; if (q < 0) return; K.badge(s, x, y, size, bg, fg, .6 + .4 * K.outBack(q / .25), rot, q > .75 ? 1 - (q - .75) / .2 : 1); };
  /* a name pill: Fredoka label, ink 3, gloss, pointer */
  K.pill = (x, y, label, col, up = false) => {
    label = t(label); X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = X.measureText(label).width + 22, h = 24;
    X.beginPath(); if (up) { X.moveTo(x - 7, y - h / 2); X.lineTo(x, y - h / 2 - 9); X.lineTo(x + 7, y - h / 2); } else { X.moveTo(x - 7, y + h / 2); X.lineTo(x, y + h / 2 + 9); X.lineTo(x + 7, y + h / 2); } X.closePath(); ink(col, 3);
    rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - h / 2 + 3, w - 12, 5, 2.5); X.fill();
    X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(label, x, y + 1);
  };
  /* a chunky control plate with depth: used for the LEFT / RIGHT pads and similar */
  K.plate = (x, y, w, h, face, base, down = 0) => {
    rr(x, y + 9, w, h, 18); ink(base, 4); const d = down ? 3 : 9; rr(x, y + 9 - d, w, h, 18); ink(face, 4);
    X.fillStyle = 'rgba(255,255,255,.32)'; rr(x + 8, y + 9 - d + 5, w - 16, 7, 3.5); X.fill();
  };

  K.cx = () => X;
  const PE = {}; K.pEl = (x, y, rx, ry) => { const k = x + ',' + y + ',' + rx + ',' + ry; if (!PE[k]) { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); PE[k] = p; } return PE[k]; };
  /* a grey house cat, sitting: (x, y) = the seat. mood: idle | sleep | happy | panic | smug. look = [lx, ly] for the pupils */
  K.cat = (x, y, s, mood, look, T, ph = 0) => {
    X.save(); X.translate(x, y); X.scale(s, s); X.lineCap = 'round'; X.lineJoin = 'round';
    const sw = Math.sin(T * 3 + ph) * (mood === 'panic' ? 16 : 9);
    X.beginPath(); X.moveTo(20, -8); X.quadraticCurveTo(54, -4 + sw * .5, 46 + sw, -52); X.lineWidth = 16; X.strokeStyle = INK; X.stroke(); X.lineWidth = 9; X.strokeStyle = '#8b93aa'; X.stroke();
    const B = K.P('M-26,0 Q-32,-40 -10,-54 Q10,-60 26,-40 Q34,-10 26,0 Z'); cel(B, '#a7afc4', '#7d85a0', 6, 3, 4); glint(B, -12, -42, 6, 11, .4, -.2);
    X.fillStyle = '#e4e8f2'; el(0, -20, 12, 17); X.fill();
    for (const sx of [-1, 1]) { el(sx * 14, -2, 10, 6); ink('#a7afc4', 3); }
    const H = K.pEl(0, -68, 23, 20); cel(H, '#a7afc4', '#7d85a0', 4, 3, 4); glint(H, -10, -78, 8, 4, .4, -.4);
    for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 21, -76); X.lineTo(sx * 15, -102); X.lineTo(sx * 3, -84); X.closePath(); ink('#a7afc4', 3); X.beginPath(); X.moveTo(sx * 17, -80); X.lineTo(sx * 14, -95); X.lineTo(sx * 8, -84); X.closePath(); X.fillStyle = '#ffb3c7'; X.fill(); }
    X.fillStyle = INK; X.beginPath(); X.moveTo(-3, -59); X.lineTo(3, -59); X.lineTo(0, -55); X.closePath(); X.fill();
    X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(0, -55); X.lineTo(0, -52);
    if (mood === 'panic') { X.moveTo(-5, -46); X.quadraticCurveTo(0, -52, 5, -46); } else if (mood === 'happy' || mood === 'smug') { X.moveTo(-6, -52); X.quadraticCurveTo(-3, -47, 0, -52); X.quadraticCurveTo(3, -47, 6, -52); } else { X.moveTo(-5, -50); X.quadraticCurveTo(-2, -47, 0, -52); X.quadraticCurveTo(2, -47, 5, -50); }
    X.stroke();
    for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 14, -56); X.lineTo(sx * 34, -60); X.moveTo(sx * 14, -52); X.lineTo(sx * 34, -50); X.lineWidth = 1.8; X.stroke(); }
    const em = mood === 'sleep' ? 'sleep' : mood === 'happy' ? 'happy' : mood === 'panic' ? 'panic' : 'idle';
    eye(-9, -70, 7, em, look, T, 0); eye(9, -70, 7, em, look, T, 1);
    if (mood === 'smug') { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(-16, -78); X.lineTo(-3, -75); X.moveTo(16, -78); X.lineTo(3, -75); X.stroke(); }
    X.restore();
  };
  return K;
})();

/* ───────── 1 ── SOLE MAN: dodge the giant stomping foot ───────── */
function gcSole(sp) {
  const k = Math.sqrt(sp), n = sp > 1.5 ? 3 : 2, gap = n === 2 ? 1.9 : 1.5;
  const me = { x: 400, y: 450 }; let tx = 400, ty = 450, c = 0, squash = 0;
  const stomps = [], rings = [];
  for (let i = 0; i < n; i++) stomps.push({ s: .5 + i * gap, x: 0, y: 0, init: false, hit: false, thoom: 0, w: false });
  const SNEAK = GCK.P('M-84,-24 L-84,-78 Q-84,-94 -66,-94 L-34,-94 Q-26,-72 -2,-64 Q40,-60 80,-50 Q100,-44 100,-24 Z');
  const BGL = GCK.layer(() => {   // a living room: wallpaper, window, shelf, framed sneaker, wooden floor and a big rug
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 330); gr.addColorStop(0, '#ffcf9a'); gr.addColorStop(1, '#ffe7c0'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 330);
    X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = Math.floor(-OX / 64) * 64; x < W + OX; x += 64) X.fillRect(x, 0, 28, 330);
    X.fillStyle = 'rgba(255,120,150,.4)'; for (let i = 0; i < 40; i++) { const x = -OX + K.hash(i + 3) * VW, y = 20 + K.hash(i + 90) * 270; K.el(x, y, 5, 5); X.fill(); K.el(x, y, 2, 2); X.fillStyle = '#ffd23f'; X.fill(); X.fillStyle = 'rgba(255,120,150,.4)'; }
    // window
    K.rr(560, 70, 160, 170, 10); X.fillStyle = '#6fd0fb'; X.fill(); X.save(); K.rr(560, 70, 160, 170, 10); X.clip();
    gr = X.createLinearGradient(0, 70, 0, 240); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(560, 70, 160, 170);
    X.fillStyle = '#87d19b'; K.el(600, 250, 120, 40); X.fill(); K.el(690, 256, 100, 36); X.fill(); X.restore();
    K.rr(560, 70, 160, 170, 10); K.ink(null, 5); X.beginPath(); X.moveTo(640, 70); X.lineTo(640, 240); X.moveTo(560, 155); X.lineTo(720, 155); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke();
    K.rr(548, 236, 184, 16, 6); K.ink('#e3ac66', 4);
    for (const sx of [0, 1]) { X.beginPath(); X.moveTo(sx ? 724 : 556, 62); X.quadraticCurveTo(sx ? 690 : 590, 140, sx ? 726 : 554, 236); X.lineTo(sx ? 764 : 516, 236); X.quadraticCurveTo(sx ? 740 : 540, 140, sx ? 764 : 516, 62); X.closePath(); K.ink('#ff7aa8', 4); }
    // framed portrait of a sneaker
    K.slab(340, 90, 112, 100, 6, '#d9944f', '#a5622c', 4, 5); X.fillStyle = '#bfe9ff'; K.rr(352, 102, 88, 76, 4); X.fill(); X.save(); K.rr(352, 102, 88, 76, 4); X.clip(); X.translate(396, 168); X.scale(.42, .42); X.fillStyle = INK; X.fill(SNEAK); X.restore();
    // bookshelf plank + books
    const bk = [['#ff4d6d', '#b8283a'], ['#4DB8FF', '#2a7fc0'], ['#ffd23f', '#c99512'], ['#5CFF7A', '#23a046'], ['#b58cff', '#7a5bc4']];
    for (let i = 0; i < 5; i++) { const h = 38 + K.hash(i + 7) * 24; K.slab(186 + i * 13, 252 - h, 14, h, 3, bk[i][0], bk[i][1], 3, 2); }
    K.slab(40, 252, 220, 16, 5, '#e3ac66', '#b98042', 4, 3);
    for (const x of [70, 230]) { X.beginPath(); X.moveTo(x - 10, 268); X.lineTo(x + 10, 268); X.lineTo(x - 10, 296); X.closePath(); K.ink('#b98042', 3); }
    // baseboard, horizon, floor
    K.slab(-OX - 10, 296, VW + 20, 30, 4, '#fff7e8', '#e8d6b0', 4, 3);
    X.fillStyle = INK; X.fillRect(-OX, 324, VW, 5);
    gr = X.createLinearGradient(0, 327, 0, 600); gr.addColorStop(0, '#d9985c'); gr.addColorStop(1, '#a56a38'); X.fillStyle = gr; X.fillRect(-OX, 327, VW, 280);
    X.strokeStyle = 'rgba(80,40,10,.3)'; X.lineWidth = 3; for (let y = 352; y < 600; y += 26 + (y - 352) * .08) { X.beginPath(); X.moveTo(-OX, y); X.lineTo(W + OX, y); X.stroke(); }
    for (let r = 0, y = 329; y < 600; r++, y += 26 + (y - 352) * .08) for (let x = Math.floor(-OX / 150) * 150 + (r % 2) * 75; x < W + OX; x += 150) { X.beginPath(); X.moveTo(x + K.hash(r) * 20, y); X.lineTo(x + K.hash(r) * 20, y + 26); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(-OX + i * 260, 330); X.lineTo(-OX + i * 260 + 70, 330); X.lineTo(-OX + i * 260 - 60, 600); X.lineTo(-OX + i * 260 - 130, 600); X.fill(); }
    // the rug
    K.el(400, 458, 360, 92); K.ink('#e0584a', 5); K.el(400, 458, 322, 76); X.fillStyle = '#ffe9c0'; X.fill(); K.el(400, 458, 296, 64); K.ink('#e0584a', 3); X.fillStyle = '#ffe9c0';
    for (let i = 0; i < 14; i++) { const a = i / 14 * K.TAU, x = 400 + Math.cos(a) * 250, y = 458 + Math.sin(a) * 52; X.save(); X.translate(x, y); X.rotate(Math.PI / 4); X.fillStyle = '#4DB8FF'; X.fillRect(-9, -9, 18, 18); X.fillStyle = '#ffd23f'; X.fillRect(-4, -4, 8, 8); X.restore(); }
    // toy blocks
    for (const [x, y, c1, c2] of [[70, 352, '#ff4d6d', '#b8283a'], [102, 356, '#4DB8FF', '#2a7fc0'], [740, 362, '#5CFF7A', '#23a046']]) { K.slab(x - 17, y - 34, 34, 34, 5, c1, c2, 3, 4); }
  });
  const g = {
    wide: true,
    cmd: 'MOVE!', hint: 'DODGE THE FOOT: MOUSE OR ARROWS', thint: 'DRAG TO DODGE THE FOOT', dur: 5, timeWin: true,
    move(p) { tx = p.x; ty = p.y; },
    update(dt) {
      const ts = dt * k; squash = g.result === 'lose' ? Math.min(1, squash + dt * 6) : 0;
      for (let i = rings.length - 1; i >= 0; i--) { rings[i].r += 380 * dt; rings[i].a -= dt * 1.6; if (rings[i].a <= 0) rings.splice(i, 1); }
      if (g.result) { for (const s of stomps) s.thoom = Math.max(0, s.thoom - dt); return; }
      c += ts;
      const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
      if (kx || ky) { tx = me.x += kx * 340 * ts; ty = me.y += ky * 340 * ts; }
      else { const dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 430 * ts); me.x += dx / d * m; me.y += dy / d * m; }
      me.x = gcClamp(me.x, 40 - OX, W - 40 + OX); me.y = gcClamp(me.y, 360, 535);
      for (const s of stomps) {
        const u = c - s.s; s.thoom = Math.max(0, s.thoom - dt);
        if (u < 0) continue;
        if (!s.init) { s.init = true; s.x = gcClamp(me.x + (me.x < 400 ? 160 : -160), 80 - OX, W - 80 + OX); s.y = gcClamp(me.y - 70, 380, 520); }
        if (u < 1.1) { s.x += (me.x - s.x) * Math.min(1, 3.4 * ts); s.y += (me.y - s.y) * Math.min(1, 3.4 * ts); }
        if (u >= 1.1 && !s.w) { s.w = true; sfx.whoosh(false); }
        if (u >= 1.55 && !s.hit) {
          s.hit = true; shake(12, .35); s.thoom = .7; rings.push({ x: s.x, y: s.y, r: 20, a: 1 }); sfx.thud(); burst(s.x, s.y, '#f6ead0', 12, 220);
          const dx = (me.x - s.x) / 66, dy = (me.y - s.y) / 40;
          if (dx * dx + dy * dy < 1) { gcLose(g); sfx.splat(); floatText('SQUISH!', me.x, me.y - 60, '#ff4d6d', 40); }
        }
      }
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      const danger = stomps.some(s => s.init && c - s.s > .9 && c - s.s < 1.62);
      K.cat(106, 252, 1, won ? 'happy' : lost || danger ? 'panic' : 'idle', [(me.x - 106) / 260, .35], t, 0);
      for (const s of stomps) {   // footprints left behind + the red warning ring
        const u = c - s.s; if (!s.init) continue;
        if (s.hit) { X.fillStyle = 'rgba(20,16,28,.16)'; K.el(s.x, s.y + 10, 82, 24); X.fill(); X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (const a of [-2.7, -1.6, -.5, .6]) { X.moveTo(s.x + Math.cos(a) * 66, s.y + 8 + Math.sin(a) * 18); X.lineTo(s.x + Math.cos(a) * 108, s.y + 8 + Math.sin(a) * 30); } X.stroke(); }
        if (u > 2 || u < 0) continue;
        const flash = u > 1.1 && u < 1.55 && Math.floor(u * 16) % 2 === 0;
        X.fillStyle = flash ? 'rgba(255,59,59,.85)' : 'rgba(20,16,28,.38)'; K.el(s.x, s.y, 70, 40); X.fill(); X.strokeStyle = INK; X.lineWidth = 4; X.stroke();
        X.strokeStyle = flash ? '#fff' : 'rgba(255,255,255,.5)'; X.lineWidth = 3; K.el(s.x, s.y, 36, 20); X.stroke();
      }
      for (const r of rings) { X.strokeStyle = INK; X.lineWidth = 14; X.globalAlpha = Math.max(0, r.a); X.beginPath(); X.ellipse(r.x, r.y, r.r, r.r * .55, 0, 0, 7); X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 7; X.stroke(); X.globalAlpha = 1; }
      // Claude
      const hop = won ? Math.abs(Math.sin(oT * 9)) * 18 : 0, up = lost ? 0 : won ? .35 + Math.sin(oT * 14) * .4 : danger ? .5 + Math.sin(t * 40) * .15 : 2.6;
      shadow(me.x, me.y + 6, 30 * (1 + squash * .5), 9, .3);
      X.save(); X.translate(me.x, me.y - hop); X.scale(1 + squash * .5, 1 - squash * .75); K.arms(4.5, -up, up, 1); claude(0, 0, 4.5, { mood: gcMood(g) }); X.restore();
      if (!g.result) K.tag(me.x, me.y - 72);
      if (won) for (let i = 0; i < 5; i++) { const q = ((oT - .1) * 1.2 + i * .2) % 1; if (oT > .1) K.heart(me.x + (i - 2) * 26, me.y - 70 - q * 90, 1.1 - q * .4, 1 - q * q); }
      // the giant sneaker + its sock
      for (const s of stomps) {
        const u = c - s.s; if (!s.init) continue;
        let h;
        if (u < 0) continue; else if (u < 1.1) h = 330 - 110 * (u / 1.1); else if (u < 1.55) h = 220 * (1 - gcClamp((u - 1.43) / .12, 0, 1)); else if (u < 1.95) h = 0; else h = (u - 1.95) * 1000;
        if (h > 700) continue;
        let wob = u > 1.1 && u < 1.43 ? Math.sin(now * 60) * 3 : 0;
        const x = s.x + wob, y = s.y - h + 28;
        // sock: a striped tube going up out of the frame
        X.save(); X.beginPath(); X.rect(x - 40, -40, 80, y - 94 + 44); X.clip();
        K.slab(x - 40, -40, 80, y - 94 + 50, 10, '#ffffff', '#cfd8ea', 4, 7);
        X.save(); K.rr(x - 40, -40, 80, y - 94 + 50, 10); X.clip(); X.fillStyle = '#ff4d6d'; for (let j = 0; j < 12; j++) { const yy = y - 100 - j * 42; if (yy < -50) break; X.fillRect(x - 44, yy, 88, 17); } X.restore(); X.restore();
        // sneaker
        X.save(); X.translate(x, y); K.cel(SNEAK, '#4DB8FF', '#2a7fc0', 7, 6, 5); K.glint(SNEAK, -40, -80, 18, 6, .5, -.2);
        X.beginPath(); X.moveTo(-84, -60); X.lineTo(-34, -66); X.lineWidth = 6; X.strokeStyle = '#fff'; X.stroke();
        K.el(70, -42, 28, 17, -.2); K.ink('#fff', 4);
        X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); for (let j = 0; j < 3; j++) { X.moveTo(-30 + j * 18, -76 + j * 4); X.lineTo(-18 + j * 18, -58 + j * 4); } X.stroke();
        K.slab(-92, -28, 198, 30, 12, '#ffffff', '#c9d2e4', 4, 6); X.fillStyle = INK; for (let j = 0; j < 7; j++) { K.rr(-78 + j * 26, -8, 12, 5, 2); X.fill(); }
        const emood = won ? 'panic' : lost ? 'happy' : s.thoom > 0 ? 'bonk' : 'idle';
        K.eye(-8, -44, 8.5, emood, [(me.x - s.x) / 200, .8], t, 0); K.eye(22, -42, 8.5, emood, [(me.x - s.x) / 200, .8], t, 1);
        if (emood === 'idle') { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-20, -57); X.lineTo(-1, -50); X.moveTo(34, -55); X.lineTo(15, -50); X.stroke(); }
        X.restore();
        if (s.thoom > 0) K.badge('THOOM!', s.x, s.y - 92, 36 + s.thoom * 14, '#FFE14D', INK, 1, -.06, Math.min(1, s.thoom * 3));
        if (lost && s.hit && u < 1.95 && Math.hypot(s.x - me.x, s.y - me.y) < 90) {   // Claude's hands wave out from under the sole, stars orbit the shoe
          for (const sx of [-1, 1]) { X.save(); X.translate(s.x + sx * 112, s.y + 22 + Math.sin(oT * 20 + sx) * 3); X.rotate(sx * .3 + Math.sin(oT * 22 + sx) * .35); X.fillStyle = INK; X.fillRect(-14, -14, 28, 28); X.fillStyle = OR; X.fillRect(-10, -10, 20, 20); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-10, -10, 8, 7); X.restore(); }
          for (let j = 0; j < 4; j++) { const a = oT * 5 + j * 1.57; K.star(s.x + Math.cos(a) * 80, s.y - 100 + Math.sin(a) * 18, 11, 5, 5, a, '#FFE14D', 3); }
        }
      }
    }
  };
  return g;
}

/* ───────── 2 ── RAGING RHINO: whip the cape at the last moment ───────── */
function gcRhino(sp) {
  const k = Math.sqrt(sp), two = sp > 1.5, CX = 590, GY = 470;
  const starts = [.7, 3.1], vs = [240, 320], N = two ? 2 : 1, ZONE = 160; // ZONE: how far out (px) the cape still counts
  let c = 0, idx = 0, sw = 0, cd = 0, fling = 0, hopT = 0; const rh = { x: -190 - OX, swiped: false, gone: false }; const dust = [];
  const gapOf = () => (CX - 40) - (rh.x + 95);
  const RB = GCK.P('M-84,-70 Q-90,-124 -26,-128 Q34,-134 72,-108 Q82,-98 80,-62 Q78,-38 60,-38 L-70,-38 Q-84,-40 -84,-70 Z');
  const HORN = GCK.P('M106,-98 Q130,-122 152,-152 Q146,-112 130,-84 Z'), HORN2 = GCK.P('M80,-102 Q92,-120 100,-130 Q101,-110 98,-98 Z');
  const BGL = GCK.layer(() => {   // a bullring at sunset: stands full of fans, a red barrier, raked sand
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, '#ff9a5c'); gr.addColorStop(.5, '#ffc77a'); gr.addColorStop(1, '#fff0cf'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 360);
    X.fillStyle = 'rgba(255,255,255,.18)'; K.el(120, 120, 150, 26); X.fill(); K.el(640, 96, 120, 20); X.fill();
    X.beginPath(); X.arc(150, 150, 46, 0, K.TAU); K.ink('#fff3a0', 4);
    // the stands: stone tiers, then rows of fans (far rows first)
    K.slab(-OX - 10, 124, VW + 20, 190, 4, '#e9b77a', '#c98f52', 4, 5);
    for (let r = 0; r < 4; r++) {
      const y = 168 + r * 38; X.fillStyle = r % 2 ? '#d9a266' : '#e9b77a'; X.fillRect(-OX, y - 22, VW, 38); X.fillStyle = INK; X.fillRect(-OX, y + 14, VW, 4);
      for (let x = Math.floor(-OX / 34) * 34 - 20; x < W + OX + 20; x += 34) {
        const i = r * 200 + Math.round(x / 34), hx = x + 17 + (K.hash(i) - .5) * 10, hy = y - 4 + (K.hash(i + 5) - .5) * 6, v = Math.floor(K.hash(i + 11) * 6);
        const shirt = ['#ff4d6d', '#ffd23f', '#4DB8FF', '#5CFF7A', '#b58cff', '#fff'][Math.floor(K.hash(i + 31) * 6)], skin = ['#f5c9a0', '#e0a070', '#c68a5a', '#8d5a3c'][Math.floor(K.hash(i + 17) * 4)];
        K.rr(hx - 13, hy + 8, 26, 20, 8); K.ink(shirt, 3);
        X.beginPath(); X.arc(hx, hy, 11, 0, K.TAU); K.ink(skin, 3);
        X.fillStyle = INK; K.el(hx - 4, hy - 1, 1.8, 2.3); X.fill(); K.el(hx + 4, hy - 1, 1.8, 2.3); X.fill();
        if (v === 0) { X.beginPath(); X.moveTo(hx - 12, hy - 6); X.quadraticCurveTo(hx, hy - 20, hx + 12, hy - 6); X.closePath(); K.ink('#2a2438', 3); }
        else if (v === 1) { K.el(hx, hy - 8, 20, 5); K.ink('#ffd23f', 3); X.beginPath(); X.arc(hx, hy - 10, 8, Math.PI, 0); K.ink('#ffd23f', 3); }
        else if (v === 2) { X.beginPath(); X.arc(hx, hy - 4, 11, Math.PI, 0); K.ink('#ff4d5e', 3); K.rr(hx - 2, hy - 7, 16, 4, 2); K.ink('#ff4d5e', 2); }
        else if (v === 3) { K.rr(hx - 10, hy - 17, 20, 11, 4); K.ink('#fff', 3); }
        else if (v === 4) { X.beginPath(); X.arc(hx + 9, hy - 10, 6, 0, K.TAU); K.ink('#ff7aa8', 2.5); }
      }
    }
    // the barrier
    K.slab(-OX - 10, 304, VW + 20, 56, 6, '#e8434f', '#a8202c', 4, 5); X.fillStyle = '#fff'; X.fillRect(-OX, 322, VW, 12); X.fillStyle = INK; X.fillRect(-OX, 320, VW, 3); X.fillRect(-OX, 334, VW, 3);
    for (let x = Math.floor(-OX / 90) * 90; x < W + OX; x += 90) { X.fillStyle = 'rgba(20,16,28,.5)'; X.fillRect(x, 304, 4, 56); }
    K.slab(-OX - 10, 296, VW + 20, 12, 5, '#ffd23f', '#c99512', 4, 3);
    // sand
    X.fillStyle = INK; X.fillRect(-OX, 358, VW, 5);
    gr = X.createLinearGradient(0, 362, 0, 600); gr.addColorStop(0, '#f6dc96'); gr.addColorStop(1, '#e2b462'); X.fillStyle = gr; X.fillRect(-OX, 362, VW, 250);
    X.strokeStyle = 'rgba(150,100,40,.2)'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 9; i++) { X.beginPath(); X.ellipse(400, 330 + i * 34, 900 - i * 20, 70 + i * 10, 0, .2, 2.9); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 16; i++) { const x = -OX + K.hash(i + 40) * VW, y = 380 + K.hash(i + 70) * 200; K.el(x, y, 10 + K.hash(i) * 14, 3); X.fill(); }
    X.beginPath(); X.moveTo(-OX, GY - 4); X.lineTo(W + OX, GY - 4); X.lineWidth = 4; X.strokeStyle = 'rgba(150,100,40,.5)'; X.stroke();
  });
  const drawRhino = (x, y, lg, mood, T, steam) => {
    const X = ctx, K = GCK; X.save(); X.translate(x, y); X.lineCap = 'round'; X.lineJoin = 'round';
    for (const i of [1, 3]) { const lx = -62 + i * 38 + (i % 2 ? lg : -lg) * 12; K.slab(lx, -46, 24, 46, 8, '#7f8ba4', '#5f6b86', 4, 4); X.fillStyle = INK; K.rr(lx - 1, -9, 26, 10, 4); X.fill(); }
    X.beginPath(); X.moveTo(-82, -92); X.quadraticCurveTo(-112, -94 + lg * 7, -114, -58); X.lineWidth = 14; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = '#8794ad'; X.stroke(); K.ball(-114, -54, 8, '#5f6b86', '#3f4a62', 3);
    K.cel(RB, '#9aa6bd', '#6f7c96', 9, 7, 5); K.glint(RB, -40, -108, 40, 9, .35, -.1);
    X.save(); X.clip(RB); X.fillStyle = '#c4cde0'; K.el(-6, -40, 78, 18); X.fill(); X.restore();
    X.strokeStyle = '#6f7c96'; X.lineWidth = 4; X.beginPath(); X.arc(34, -78, 36, 1.9, 3.9); X.stroke(); X.beginPath(); X.arc(-62, -80, 26, -1.2, 1.2); X.stroke();
    for (const i of [0, 2]) { const lx = -62 + i * 38 + (i % 2 ? lg : -lg) * 12; K.slab(lx, -46, 24, 46, 8, '#9aa6bd', '#6f7c96', 4, 4); X.fillStyle = INK; K.rr(lx - 1, -9, 26, 10, 4); X.fill(); }
    // head
    const HD = K.pEl(96, -74, 40, 35); K.cel(HD, '#9aa6bd', '#6f7c96', 6, 5, 5); K.glint(HD, 84, -92, 14, 6, .4, -.4);
    const SN = K.pEl(122, -60, 24, 21); K.cel(SN, '#b6c0d4', '#8794ad', 4, 4, 4);
    X.beginPath(); X.moveTo(60, -100); X.lineTo(62, -134); X.lineTo(84, -108); X.closePath(); K.ink('#8794ad', 4); X.beginPath(); X.moveTo(64, -106); X.lineTo(65, -124); X.lineTo(76, -110); X.closePath(); X.fillStyle = '#ffb3c7'; X.fill();
    K.cel(HORN2, '#fff2d0', '#d8c498', 3, 2, 3); K.cel(HORN, '#fff2d0', '#d8c498', 5, 3, 4); K.glint(HORN, 124, -112, 4, 14, .6, .5);
    X.fillStyle = INK; K.el(134, -60, 3.5, 5, -.4); X.fill(); X.fillStyle = 'rgba(255,255,255,.7)'; K.el(133, -62, 1.2, 1.6); X.fill();
    X.strokeStyle = INK; X.lineWidth = 4;
    if (mood === 'smug') { X.beginPath(); X.moveTo(104, -46); X.quadraticCurveTo(122, -38, 142, -50); X.stroke(); K.eye(101, -80, 8, 'happy', [0, 0], T, 0); X.beginPath(); X.moveTo(88, -92); X.lineTo(112, -90); X.stroke(); }
    else if (mood === 'dizzy') { X.beginPath(); X.moveTo(108, -48); X.quadraticCurveTo(122, -52, 138, -46); X.stroke(); K.eye(101, -80, 9, 'dizzy', [0, 0], T, 0); }
    else { X.beginPath(); X.moveTo(108, -47); X.lineTo(138, -50); X.stroke(); K.eye(101, -80, 8.5, 'idle', [1, .3], T, 0); X.beginPath(); X.moveTo(86, -98); X.lineTo(113, -87); X.lineWidth = 5; X.stroke(); }
    X.fillStyle = 'rgba(255,110,165,.5)'; K.el(86, -62, 8, 5); X.fill();
    X.restore();
    if (steam) for (let i = 0; i < 2; i++) { const q = (T * 3 + i * .5) % 1; K.puff(x + 140 + q * 24, y - 62 - q * 12 - i * 8, 7 + q * 5, .8 * (1 - q)); }
  };
  const g = {
    wide: true,
    cmd: 'OLE!', hint: 'CLICK/SPACE WHEN THE RHINO IS IN THE ZONE', thint: 'TAP WHEN THE RHINO IS IN THE ZONE', dur: two ? 5.8 : 5,
    key(e) { if (e.code === 'Space') g.cape(); }, down() { g.cape(); },
    cape() {
      if (g.result || cd > 0 || idx >= N || c < starts[idx] || rh.swiped) return;
      cd = .3; sw = .001; sfx.whoosh();
      const gp = gapOf();
      if (gp > ZONE) { sfx.miss(); floatText('TOO EARLY!', CX - 60, GY - 170, '#fff', 30); }   // early swish is free: just wait and try again
      else { rh.swiped = true; hopT = .001; sfx.hit(); burst(CX - 60, GY - 60, '#e8232f', 12); ring(CX - 60, GY - 60, '#fff', 70); floatText(idx === N - 1 ? 'OLE!' : 'NICE!', CX, GY - 170, '#FFE14D', 38); if (idx === N - 1) gcWin(g); }
    },
    update(dt) {
      const ts = dt * k; c += ts; cd = Math.max(0, cd - ts);
      if (sw > 0) { sw += dt * 4; if (sw > 1) sw = 0; } if (hopT > 0) { hopT += dt * 1.6; if (hopT > 1) hopT = 0; }
      for (let i = dust.length - 1; i >= 0; i--) { dust[i].r += dt * 40; dust[i].a -= dt * 2; dust[i].y -= dt * 20; if (dust[i].a <= 0) dust.splice(i, 1); }
      if (idx < N && c >= starts[idx]) {
        rh.x += vs[idx] * ts * (645 + OX) / 645;   // wider run-up, scaled so it still reaches the cape in the same time
        if (Math.random() < .5) dust.push({ x: rh.x - 70, y: GY - 6, r: 10, a: .9 });
        if (!rh.swiped && !g.result && gapOf() <= -8) gcLose(g);
        if (g.result === 'lose' && rh.x + 95 >= CX - 40 && !fling) { fling = .001; sfx.thud(); sfx.boing(); shake(12, .35); burst(CX, GY - 40, '#fff', 16); }
        if (rh.x > W + OX + 200) { idx++; rh.x = -190 - OX; rh.swiped = false; }
      }
      if (fling) fling += dt;
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      // pennants on a string + fans waving flags (the crowd goes wild on a win)
      const pw = won ? 1 + oT * 2 : 1, ry = i => 78 + Math.sin(i * .5) * 8 + Math.sin(t * 2 + i) * 2;
      for (let i = 0, x = -OX - 20; x < W + OX + 20; i++, x += 46) { X.fillStyle = ['#ff4d5e', '#ffd23f', '#fff', '#4DB8FF'][i % 4]; X.beginPath(); X.moveTo(x, ry(i)); X.lineTo(x + 38, ry(i + .8)); X.lineTo(x + 19 + Math.sin(t * 3 + i) * 4, ry(i) + 34); X.closePath(); X.lineJoin = 'round'; X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.fill(); }
      X.beginPath(); for (let x = -OX - 20, i = 0; x < W + OX + 40; x += 46, i++) X.lineTo(x, ry(i)); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
      for (let i = 0; i < 9; i++) {
        const fx = -OX + (i + .5) * VW / 9 + (K.hash(i + 200) - .5) * 40, fy = 190 + (i % 3) * 38 - (won ? Math.abs(Math.sin(oT * 8 + i)) * 14 : 0), sw = Math.sin(t * 6 + i * 1.7) * (won ? .7 : .35);
        X.save(); X.translate(fx, fy); X.rotate(sw); X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 6); X.lineTo(0, -34); X.stroke(); X.strokeStyle = '#d9944f'; X.lineWidth = 4; X.stroke();
        X.beginPath(); X.moveTo(0, -34); X.lineTo(26, -28 + Math.sin(t * 9 + i) * 3); X.lineTo(0, -16); X.closePath(); K.ink(['#ff4d5e', '#ffd23f', '#5CFF7A'][i % 3], 3); X.restore();
      }
      X.lineCap = 'butt';
      const run = idx < N && c >= starts[idx], warn = idx < N && !run && c > starts[idx] - .55;
      const inZone = run && !rh.swiped && !g.result && gapOf() <= ZONE, zx = CX - 40 - ZONE;
      // the chalk strip on the sand that shows how close is close enough
      X.globalAlpha = inZone ? .8 + Math.sin(now * 30) * .15 : .5; K.rr(zx, GY + 10, ZONE, 28, 12); K.ink(inZone ? '#FFE14D' : '#fff7e0', 3); X.globalAlpha = 1;
      X.strokeStyle = inZone ? INK : 'rgba(150,100,40,.55)'; X.lineWidth = 4; X.lineCap = 'round'; for (let j = 0; j < 4; j++) { const x = zx + 22 + j * 36; X.beginPath(); X.moveTo(x, GY + 17); X.lineTo(x + 12, GY + 24); X.lineTo(x, GY + 31); X.stroke(); } X.lineCap = 'butt';
      if (inZone) K.badge('NOW!', zx + ZONE / 2, GY + 84, 34, '#ff4d5e', '#fff', 1 + Math.sin(now * 26) * .06, -.05);
      if (warn) K.badge('!', 70 - OX / 2, 330 + Math.sin(now * 40) * 4, 50, '#ff4d5e', '#fff', 1, 0);
      for (const d of dust) { X.globalAlpha = Math.max(0, d.a); X.beginPath(); X.arc(d.x, d.y, d.r, 0, 7); K.ink('#f6ead0', 3); } X.globalAlpha = 1;
      if (run) {
        X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 6; X.lineCap = 'round';
        for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(rh.x - 124 - i * 10, GY - 150 + i * 36); X.lineTo(rh.x - 200 - i * 10, GY - 150 + i * 36); X.stroke(); } X.lineCap = 'butt';
        shadow(rh.x + 20, GY + 4, 110, 14, .3);
        const lg = Math.sin(now * 30), rhy = GY - 8 + lg * 3, mood = rh.swiped ? 'dizzy' : (lost ? 'smug' : 'angry');
        drawRhino(rh.x, rhy, lg, mood, now, !rh.swiped);
        if (rh.swiped) for (let j = 0; j < 3; j++) { const a = now * 7 + j * 2.1; K.star(rh.x + 96 + Math.cos(a) * 34, rhy - 128 + Math.sin(a) * 9, 9, 4, 5, a, '#FFE14D', 2.5); }
      }
      if (!fling) shadow(CX, GY + 6, 46 - (hopT ? Math.sin(hopT * Math.PI) * 14 : 0), 10, .3);
      let cx = CX, cy = GY, rot = 0;
      if (fling) { cx += fling * 420; cy -= Math.sin(Math.min(1, fling * 1.1) * Math.PI) * 220 - 0; rot = fling * 9; }
      if (hopT) cy -= Math.sin(hopT * Math.PI) * 60;
      if (won) cy -= Math.abs(Math.sin(oT * 9)) * 22;
      X.save(); X.translate(cx, cy); X.rotate(rot);
      K.arms(7, -1.5 - Math.sin(sw * Math.PI) * .7, won ? .5 + Math.sin(oT * 14) * .3 : 2.5, 1);
      claude(0, 0, 7, { mood: gcMood(g) });
      K.slab(-26, -82, 52, 20, 7, '#3b3550', '#1f1a2e', 3, 3); K.ball(0, -86, 7, '#ff4d5e', '#b8283a', 2.5);
      X.restore();
      if (!g.result && !fling) K.tag(cx, cy - 120);
      // the cape (on the horn if the rhino won)
      const hx = cx - 52, hy = cy - 50;
      if (!fling) {
        X.save(); X.translate(hx, hy); X.rotate(-Math.sin(sw * Math.PI) * 1.0 + .1);
        const w1 = Math.sin(now * 9) * 4, w2 = Math.sin(now * 7 + 1) * 5; X.beginPath(); X.moveTo(-6, -8); X.lineTo(-100, -14 + w1); X.quadraticCurveTo(-114, 26, -104 + w2, 66); X.quadraticCurveTo(-56, 76 + w1, -6, 58); X.closePath();
        K.ink('#a8141f', 4); X.save(); X.clip(); X.translate(-8, -3); X.fillStyle = '#e8232f'; X.fillRect(-130, -40, 130, 130); X.restore();
        X.strokeStyle = '#ffd23f'; X.lineWidth = 5; X.beginPath(); X.moveTo(-8, -6); X.lineTo(-98, -12 + w1); X.stroke();
        X.fillStyle = 'rgba(255,255,255,.3)'; K.el(-60, 10, 26, 6, .25); X.fill();
        X.restore();
      } else if (rh.x > -OX) {
        const hx2 = rh.x + 140, hy2 = GY - 8 - 150; X.save(); X.translate(hx2, hy2); X.rotate(Math.sin(now * 12) * .1);
        X.beginPath(); X.moveTo(-6, 0); X.lineTo(34, 6); X.quadraticCurveTo(46, 50, 30, 78); X.quadraticCurveTo(0, 60, -14, 76); X.closePath(); K.ink('#e8232f', 4); X.restore();
      }
      if (won) {   // roses rain from the stands, olé!
        for (let i = 0; i < 12; i++) { const q = gcClamp(oT * 1.1 - K.hash(i + 50) * .5, 0, 1); if (q <= 0) continue; const rx = -OX + K.hash(i + 60) * VW, ry2 = 120 + q * 330; X.save(); X.translate(rx, ry2); X.rotate(oT * 4 + i); X.beginPath(); X.arc(0, 0, 8, 0, 7); K.ink('#e8232f', 3); X.beginPath(); X.arc(0, 0, 3, 0, 7); X.strokeStyle = '#a8141f'; X.lineWidth = 2; X.stroke(); X.restore(); }
        K.pop(oT, 'OLE!', 560, 165, 62, '#FFE14D', INK);
      }
      if (lost) K.pop(oT, 'OUCH!', 330, 165, 62, '#ff4d5e', '#fff');
    }
  };
  return g;
}

/* ───────── 3 ── HOGAN'S ALLEY: shoot bandits, spare civilians ───────── */
function gcAlley(sp) {
  const k = Math.sqrt(sp), CXS = [160, 400, 640], WTOP = 190, WBOT = 400;
  const roles = shuffle(['B', 'B', 'B', 'C', 'C']);
  const T = roles.map((r, i) => ({ r, s: .5 + i * .85, slot: -1, u: -1, hit: 0, shot: false }));
  let c = 0, kills = 0, boom = 0, boomX = 0; const flashes = [];
  const BGL = GCK.layer(() => {   // a wild-west street: sky, mesas, the saloon front with three dark windows, a porch
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#ff9f5c'); gr.addColorStop(.6, '#ffd79a'); gr.addColorStop(1, '#fff0cf'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 340);
    X.beginPath(); X.arc(690, 150, 40, 0, K.TAU); K.ink('#fff3a0', 4);
    X.beginPath(); X.moveTo(-OX, 330); for (let x = -OX; x <= W + OX; x += 60) X.lineTo(x, 270 - K.hash(Math.round(x / 60) + 4) * 50); X.lineTo(W + OX, 330); X.closePath(); X.fillStyle = '#e8956a'; X.fill(); X.lineWidth = 4; X.strokeStyle = '#b86a3c'; X.stroke();
    // neighbour shop fronts on a wide screen
    for (const [x0, x1] of [[-OX - 20, 24], [776, W + OX + 20]]) { if (x1 - x0 < 60) continue; K.slab(x0, 150, x1 - x0, 290, 4, '#b98042', '#8a5a2a', 4, 6); X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 3; for (let x = x0 + 22; x < x1; x += 30) { X.beginPath(); X.moveTo(x, 156); X.lineTo(x, 436); X.stroke(); } }
    // the saloon: false front + planks
    K.slab(20, 100, 760, 342, 6, '#cf9158', '#a96b36', 4, 7); K.slab(240, 62, 320, 70, 8, '#cf9158', '#a96b36', 4, 6);
    X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 3; for (let x = 44; x < 780; x += 34) { X.beginPath(); X.moveTo(x, 138); X.lineTo(x, 438); X.stroke(); }
    X.fillStyle = 'rgba(20,16,28,.4)'; for (let x = 44; x < 780; x += 34) for (const y of [150, 430]) { K.el(x + 5, y, 2.4, 2.4); X.fill(); }
    // the hanging sign
    for (const sx of [292, 508]) { X.beginPath(); X.moveTo(sx, 122); X.lineTo(sx, 140); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); }
    K.slab(266, 76, 268, 56, 10, '#e3ac66', '#b98042', 4, 5); K.stxt('SALOON', 400, 105, 40, '#FFE14D');
    // the three windows: dark room, a bottle shelf and a lantern
    for (const cx of CXS) {
      X.save(); K.rr(cx - 95, WTOP, 190, WBOT - WTOP, 8); X.clip(); gr = X.createLinearGradient(0, WTOP, 0, WBOT); gr.addColorStop(0, '#3a2a4a'); gr.addColorStop(1, '#241a32'); X.fillStyle = gr; X.fillRect(cx - 95, WTOP, 190, WBOT - WTOP);
      X.fillStyle = 'rgba(255,200,120,.08)'; X.fillRect(cx - 95, WTOP + 20, 190, 8);
      K.slab(cx - 90, 262, 180, 8, 3, '#b98042', '#8a5a2a', 3, 2);
      for (let i = 0; i < 7; i++) { const bx = cx - 78 + i * 26, col = ['#5CFF7A', '#ff9f4d', '#4DB8FF', '#ff4d9e'][i % 4]; K.rr(bx - 6, 232, 12, 30, 5); K.ink(col, 2.5); K.rr(bx - 2.5, 222, 5, 12, 2); K.ink(col, 2); }
      X.restore(); K.rr(cx - 95, WTOP, 190, WBOT - WTOP, 8); K.ink(null, 6, '#6f4118');
    }
    // the porch deck
    X.fillStyle = INK; X.fillRect(-OX, 440, VW, 5); gr = X.createLinearGradient(0, 444, 0, 600); gr.addColorStop(0, '#c4894f'); gr.addColorStop(1, '#8a5530'); X.fillStyle = gr; X.fillRect(-OX, 444, VW, 160);
    X.strokeStyle = 'rgba(60,30,10,.35)'; X.lineWidth = 3; for (let y = 470; y < 600; y += 30 + (y - 470) * .1) { X.beginPath(); X.moveTo(-OX, y); X.lineTo(W + OX, y); X.stroke(); }
    // a cactus and a hay bale at the porch corners
    for (const [x, y, s] of [[-OX + 50, 470, 1], [W + OX - 50, 474, .9]]) { X.save(); X.translate(x, y); X.scale(s, s); K.rr(-12, -70, 24, 80, 12); K.ink('#4fbf6a', 4); K.rr(-34, -46, 14, 30, 7); K.ink('#4fbf6a', 3.5); K.rr(20, -56, 14, 34, 7); K.ink('#4fbf6a', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; K.rr(-8, -62, 5, 40, 3); X.fill(); X.restore(); }
  });
  const FGL = GCK.layer(() => {   // what stands in front of the targets: striped awnings and window sills
    const X = GCK.cx(), K = GCK;
    for (const cx of CXS) {
      for (let i = 0; i < 7; i++) { const x = cx - 105 + i * 30; X.beginPath(); X.moveTo(x, 154); X.lineTo(x + 30, 154); X.lineTo(x + 30, 176); X.arc(x + 15, 176, 15, 0, Math.PI); X.closePath(); K.ink(i % 2 ? '#fff' : '#e8434f', 3); }
      K.slab(cx - 112, 146, 224, 14, 6, '#8a5a2a', '#5a3418', 4, 3);
      K.slab(cx - 110, WBOT, 220, 18, 6, '#e3ac66', '#b98042', 4, 4);
    }
  });
  const vulture = (x, y, s, mood, look, T) => {
    const X = ctx, K = GCK; X.save(); X.translate(x, y); X.scale(s, s);
    X.beginPath(); X.moveTo(-8, -4); X.lineTo(-14, 0); X.moveTo(8, -4); X.lineTo(14, 0); X.lineWidth = 7; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke();
    K.ball(0, -34, 26, '#5a4a6a', '#3a2f48', 4);
    X.beginPath(); X.moveTo(-6, -48); X.quadraticCurveTo(-34, -40, -26, -6); X.quadraticCurveTo(-8, -20, -6, -48); K.ink('#3a2f48', 3);
    X.fillStyle = '#f2ead8'; K.el(0, -54, 17, 7); X.fill();
    const hx = look * 4; X.beginPath(); X.arc(hx, -72, 15, 0, K.TAU); K.ink('#ff9fb0', 3.5);
    X.beginPath(); X.moveTo(hx + 8, -70); X.quadraticCurveTo(hx + 30, -70, hx + 26, -56); X.quadraticCurveTo(hx + 18, -62, hx + 8, -62); K.ink('#ffd23f', 2.5);
    K.eye(hx - 3, -75, 5.5, mood, [look, .4], T, 0);
    if (mood !== 'happy') { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(hx - 10, -84); X.lineTo(hx + 2, -79); X.stroke(); }
    X.restore();
  };
  const g = {
    wide: true,
    cmd: 'SHOOT!', hint: 'CLICK BANDITS, NOT CIVILIANS', thint: 'TAP BANDITS, NOT CIVILIANS', dur: 5.6,
    down(p) {
      if (g.result) return; flashes.push({ x: p.x, y: p.y, a: 1 }); sfx.pop(); ring(p.x, p.y, '#fff', 30, .25);
      for (const q of T) {
        if (q.slot < 0 || q.hit || q.u < 0) continue;
        const pop = Math.min(1, q.u / .25), off = (1 - pop) * 170, lat = (q.r === 'C' && q.u > 1.5) ? Math.min(1, (q.u - 1.5) / .2) * 170 : 0;
        const cx = CXS[q.slot];
        if (Math.abs(p.x - cx) < 52 && p.y > WBOT - 150 + off + lat && p.y < WBOT && p.y > WTOP) {
          q.hit = .001; burst(p.x, p.y, q.r === 'B' ? '#FFE14D' : '#ff9fcd', 12);
          if (q.r === 'C') { sfx.miss(); shake(8, .25); floatText('OOPS!', cx, 250, '#ff4d6d'); gcLose(g); } else { sfx.hit(); floatText('+1', cx, 250, '#FFE14D', 44); if (++kills === 3) gcWin(g); }
          return;
        }
      }
    },
    update(dt) {
      const ts = dt * k; for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].a -= dt * 5; if (flashes[i].a <= 0) flashes.splice(i, 1); }
      boom = Math.max(0, boom - dt);
      for (const q of T) if (q.hit) q.hit += dt * 2.5;
      if (g.result) return;
      c += ts;
      for (const q of T) {
        if (q.slot < 0) {
          if (c >= q.s) {
            const free = [0, 1, 2].filter(s => !T.some(o => o.slot === s && o.u >= 0 && !o.hit && !o.gone));
            if (free.length) { q.slot = free[Math.random() * free.length | 0]; q.u = 0; sfx.blip(q.r === 'B' ? 0 : 7); }
          }
          continue;
        }
        if (q.hit) continue;
        q.u += ts;
        if (q.r === 'B' && q.u >= 1.1) { boom = .6; boomX = CXS[q.slot]; gcLose(g); sfx.zap(); shake(10, .3); burst(boomX, 300, '#FFE14D', 14); }
        if (q.r === 'C' && q.u > 1.75) { q.gone = true; q.u = -1; q.slot = 9; }
      }
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      // the vulture on the roof watches the mouse
      vulture(150, 102, .78, won ? 'panic' : lost ? 'happy' : 'idle', gcClamp((mouse.x - 150) / 400, -1, 1), t);
      for (let s = 0; s < 3; s++) {
        const cx = CXS[s];
        X.save(); K.rr(cx - 95, WTOP, 190, WBOT - WTOP, 8); X.clip();
        for (const q of T) {
          if (q.slot !== s || q.u < 0) continue;
          const pop = Math.min(1, q.u / .25), lat = (q.r === 'C' && q.u > 1.5) ? Math.min(1, (q.u - 1.5) / .2) * 170 : 0;
          const hitK = q.hit ? Math.min(1, q.hit) : 0;
          const off = (1 - pop) * 170 + lat + hitK * 170, by = WBOT + off, bob = q.hit ? 0 : Math.sin(now * 6 + s) * 2;
          X.save(); X.translate(cx, by + 4); X.rotate(hitK * .9 * (s - 1 || 1));
          K.slab(-6, -60, 12, 80, 4, '#c89a5a', '#8a5a2a', 3, 2);
          if (q.r === 'B') {
            K.slab(-44, -118 + bob, 88, 70, 14, '#7b7b8c', '#4f4f60', 5, 6); X.fillStyle = '#e8c15a'; K.el(0, -92 + bob, 6, 6); X.fill();
            X.beginPath(); X.moveTo(-26, -136 + bob); X.lineTo(26, -136 + bob); X.lineTo(0, -102 + bob); X.closePath(); K.ink('#e8434f', 3);
            K.slab(30, -112 + bob, 52, 16, 6, '#4a4a58', '#2a2a36', 4, 3); K.slab(30, -100 + bob, 14, 22, 5, '#4a4a58', '#2a2a36', 4, 3);
            X.beginPath(); X.arc(0, -148 + bob, 28, 0, K.TAU); K.ink('#f5c9a0', 5);
            const ang = q.u > 1.0 || q.hit;
            K.eye(-11, -152 + bob, 6.8, q.hit ? 'bonk' : ang ? 'panic' : 'idle', [(mouse.x - cx) / 300, .3], now, s);
            K.eye(11, -152 + bob, 6.8, q.hit ? 'bonk' : ang ? 'panic' : 'idle', [(mouse.x - cx) / 300, .3], now, s + 1);
            if (!q.hit) { X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(-22, -166 + bob); X.lineTo(-4, -159 + bob); X.moveTo(22, -166 + bob); X.lineTo(4, -159 + bob); X.stroke(); }
            K.el(0, -170 + bob, 46, 10); K.ink('#2a2438', 4); K.slab(-24, -204 + bob, 48, 36, 10, '#2a2438', '#14101c', 4, 4); X.fillStyle = '#e8c15a'; X.fillRect(-24, -176 + bob, 48, 6);
            const fl = q.u > .3 && Math.floor(q.u * 18) % 2 === 0; if (fl) { X.fillStyle = 'rgba(255,59,59,.5)'; K.rr(-52, -214 + bob, 104, 170, 16); X.fill(); }
          } else {
            K.slab(-42, -118 + bob, 84, 70, 22, '#ff9fcd', '#d9669f', 5, 6); X.fillStyle = '#fff'; for (const [a, b] of [[-20, -86], [0, -76], [18, -92], [-8, -102]]) { K.el(a, b + bob, 4, 4); X.fill(); }
            X.beginPath(); X.arc(0, -148 + bob, 28, 0, K.TAU); K.ink('#f5c9a0', 5);
            const sc = q.u > 1.0 || q.hit;
            K.eye(-11, -150 + bob, 6.8, q.hit ? 'bonk' : sc ? 'panic' : 'happy', [(mouse.x - cx) / 300, .3], now, s + 2); K.eye(11, -150 + bob, 6.8, q.hit ? 'bonk' : sc ? 'panic' : 'happy', [(mouse.x - cx) / 300, .3], now, s + 3);
            X.fillStyle = 'rgba(255,110,140,.6)'; K.el(-19, -140 + bob, 6, 3.5); X.fill(); K.el(19, -140 + bob, 6, 3.5); X.fill();
            X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); if (q.hit || sc) X.arc(0, -130 + bob, 6, Math.PI + .3, -.3); else X.arc(0, -138 + bob, 9, .2, Math.PI - .2); X.stroke();
            K.el(0, -170 + bob, 46, 10); K.ink('#e8c15a', 4); K.slab(-24, -200 + bob, 48, 34, 14, '#e8c15a', '#c99512', 4, 4);
            for (const [a, col] of [[-12, '#ff4d9e'], [4, '#fff'], [18, '#ffd23f']]) { X.beginPath(); X.arc(a, -194 + bob, 6, 0, K.TAU); K.ink(col, 2.5); }
          }
          X.restore();
        }
        X.restore();
      }
      FGL();
      // BANG: the gun flash out of the window
      if (boom > 0) { K.star(boomX + 30, 300, 70, 30, 8, now * 3, '#FFE14D', 5); K.badge('BANG!', boomX, 236, 50, '#ff4d5e', '#fff', 1, -.08); }
      // a tumbleweed rolls along the porch
      { const tx = ((t * 70) % (VW + 200)) - OX - 100, ty = 492 + Math.abs(Math.sin(t * 5)) * -10; X.save(); X.translate(tx, ty); X.rotate(t * 5); X.beginPath(); X.arc(0, 0, 22, 0, K.TAU); K.ink('#c9a063', 3.5); X.strokeStyle = '#8a6a3a'; X.lineWidth = 2.5; X.beginPath(); for (let i = 0; i < 4; i++) { X.moveTo(-18, -10 + i * 7); X.quadraticCurveTo(0, -18 + i * 9, 18, -6 + i * 7); } X.stroke(); X.restore(); }
      // sheriff Claude with a revolver aimed at the crosshair
      const m = TOUCH ? null : mouse, mx = flashes.length ? flashes[flashes.length - 1].x : mouse.x, my = flashes.length ? flashes[flashes.length - 1].y : mouse.y, cp = m || { x: mx, y: my };
      const CLX = 400, CLY = 534, shx = CLX + 33, shy = CLY - 26, aim = lost ? -.6 : Math.atan2(cp.y - shy, cp.x - shx);
      shadow(CLX, CLY + 5, 36, 9, .3);
      K.arms(5, 2.6, 0, 0); claude(CLX, CLY - (won ? Math.abs(Math.sin(oT * 9)) * 14 : 0), 5, { mood: gcMood(g) });
      X.save(); X.translate(shx, shy - (won ? Math.abs(Math.sin(oT * 9)) * 14 : 0)); X.rotate(won ? -1.2 + Math.sin(oT * 12) * .3 : aim);
      X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(26, 0); X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = OR; X.stroke();
      K.slab(22, -10, 20, 20, 4, '#f5c9a0', '#d9a070', 3, 2); K.slab(40, -9, 40, 12, 5, '#7b7b8c', '#4a4a58', 3.5, 2); K.slab(40, -1, 12, 18, 4, '#9a6a3a', '#6f4118', 3.5, 2); X.restore();
      K.slab(CLX - 36, CLY - 56, 72, 14, 5, '#e8c15a', '#c99512', 3.5, 3); K.slab(CLX - 22, CLY - 72, 44, 20, 8, '#e8c15a', '#c99512', 3.5, 3);
      K.star(CLX - 24, CLY - 24, 9, 4, 5, -Math.PI / 2, '#FFE14D', 2.5);
      if (won) { for (let i = 0; i < 3; i++) { const q = (oT * 1.3 + i * .33) % 1; K.puff(CLX + 80 + i * 12, CLY - 60 - q * 70, 8 + q * 8, 1 - q); } }
      if (lost) { K.sweat(CLX - 26, CLY - 60, 1.3, oT); K.sweat(CLX + 26, CLY - 56, 1.3, oT + .4); }
      if (!g.result) K.tag(CLX, CLY - 98);
      // the sheriff's badge counter: a wooden plate with three stars
      K.slab(26 - OX / 2, 468, 150, 50, 14, '#d9944f', '#a5622c', 4, 5);
      for (let i = 0; i < 3; i++) K.star(60 - OX / 2 + i * 44, 493, 17, 8, 5, -Math.PI / 2, i < kills ? '#FFE14D' : '#6f4118', 3);
      if (won) for (let i = 0; i < 3; i++) K.star(60 - OX / 2 + i * 44, 493 - Math.abs(Math.sin(oT * 8 + i)) * 12, 17, 8, 5, -Math.PI / 2, '#FFE14D', 3);
      if (won) { for (let s = 0; s < 3; s++) { const cx = CXS[s]; X.save(); X.translate(cx - 60 + s * 10, WBOT - 6); X.rotate(-.12 + Math.sin(oT * 8 + s) * .15); X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -96); X.stroke(); X.strokeStyle = '#c89a5a'; X.lineWidth = 4; X.stroke(); X.beginPath(); X.moveTo(0, -96); X.lineTo(46, -84 + Math.sin(oT * 10 + s) * 5); X.lineTo(0, -66); X.closePath(); K.ink('#fff', 3); X.restore(); } }
      for (const f of flashes) { X.globalAlpha = f.a; K.star(f.x, f.y, 22, 9, 8, f.a * 3, '#FFE14D', 3); } X.globalAlpha = 1;
      X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.arc(cp.x, cp.y, 22, 0, 7); X.moveTo(cp.x - 36, cp.y); X.lineTo(cp.x + 36, cp.y); X.moveTo(cp.x, cp.y - 36); X.lineTo(cp.x, cp.y + 36); X.stroke();
      X.strokeStyle = '#ff3b3b'; X.lineWidth = 4; X.stroke();
    }
  };
  return g;
}

/* ───────── 4 ── PINBALL: keep a ball in play ───────── */
function gcSegHit(b, ax, ay, bx, by, th, e, pv) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const kk = gcClamp(((b.x - ax) * dx + (b.y - ay) * dy) / l2, 0, 1), cx = ax + kk * dx, cy = ay + kk * dy;
  let nx = b.x - cx, ny = b.y - cy; const d = Math.hypot(nx, ny), R = b.r + th;
  if (d >= R) return false;
  if (d < 1e-6) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
  b.x = cx + nx * R; b.y = cy + ny * R;
  const sv = pv ? pv(cx, cy) : [0, 0], vn = (b.vx - sv[0]) * nx + (b.vy - sv[1]) * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
  return true;
}
function gcPinball(sp) {
  const k = Math.sqrt(sp), LX = 140, RX = 660, TOPY = 85, L = 118;
  const fl = [{ px: 272, py: 500, a: .5, dir: 1, on: false }, { px: 528, py: 500, a: .5, dir: -1, on: false }];
  const bumps = [{ x: 340, y: 230, r: 30, f: 0 }, { x: 460, y: 230, r: 30, f: 0 }, { x: 400, y: 330, r: 26, f: 0 }];
  const balls = []; let c = 0, spawned = 0, score = 0;
  const spawn = () => { balls.push({ x: 380 + Math.random() * 40, y: 112, vx: (Math.random() - .5) * 260, vy: 80, r: 12, alive: true }); spawned++; sfx.whoosh(); };
  const tipOf = f => [f.px + f.dir * L * Math.cos(f.a), f.py + L * Math.sin(f.a)];
  const setF = (i, v) => { if (v && !fl[i].on) sfx.click(); fl[i].on = v; };
  const POLY = (o = 0) => { const X = GCK.cx(); X.beginPath(); X.moveTo(LX - o, TOPY - o); X.lineTo(RX + o, TOPY - o); X.lineTo(RX + o, 395); X.lineTo(538 + o * .4, 495 + o); X.lineTo(262 - o * .4, 495 + o); X.lineTo(LX - o, 395); X.closePath(); };
  const BGL = GCK.layer(() => {   // an arcade at night: neon wall, carpet, and the table with its purple space playfield
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 600); gr.addColorStop(0, '#2b1a66'); gr.addColorStop(1, '#170d3a'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 600);
    X.fillStyle = 'rgba(255,255,255,.05)'; for (let x = Math.floor(-OX / 80) * 80; x < W + OX; x += 80) X.fillRect(x, 0, 38, 520);
    // neon tubes + posters on the wall
    for (const [x, y, col, kind] of [[44, 150, '#ff4d9e', 0], [756, 170, '#5ee6ff', 1], [-OX + 40, 260, '#ffd23f', 1], [W + OX - 40, 240, '#ff4d9e', 0]]) {
      X.save(); X.translate(x, y); X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); if (kind) { X.moveTo(-6, -34); X.lineTo(8, -4); X.lineTo(-8, 4); X.lineTo(6, 34); } else { X.arc(0, 0, 26, 0, K.TAU); X.moveTo(-12, -4); X.lineTo(12, -4); X.moveTo(-12, 10); X.lineTo(12, 10); }
      X.lineWidth = 16; X.strokeStyle = 'rgba(255,255,255,.08)'; X.stroke(); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = col; X.stroke(); X.restore();
    }
    // carpet with neon confetti
    X.fillStyle = INK; X.fillRect(-OX, 508, VW, 5); X.fillStyle = '#1b1342'; X.fillRect(-OX, 512, VW, 100);
    for (let i = 0; i < 46; i++) { const x = -OX + K.hash(i) * VW, y = 520 + K.hash(i + 30) * 70; X.save(); X.translate(x, y); X.rotate(K.hash(i + 9) * 6); X.fillStyle = ['#ff4d9e', '#5ee6ff', '#ffd23f', '#5CFF7A'][i % 4]; X.fillRect(-7, -2, 14, 4); X.restore(); }
    // the cabinet: wood, chrome rail, playfield
    POLY(34); K.ink('#d9944f', 5); X.save(); POLY(34); X.clip(); X.translate(0, 0); X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(LX, TOPY + 300, RX, 300); X.restore();
    POLY(10); X.lineJoin = 'round'; X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#d6dbe6'; X.fill(); X.save(); POLY(10); X.clip(); X.translate(-4, -4); POLY(4); X.fillStyle = '#f5f8ff'; X.fill(); X.restore();
    POLY(0); X.fillStyle = INK; X.fill(); X.save(); POLY(0); X.clip();
    gr = X.createLinearGradient(0, TOPY, 0, 500); gr.addColorStop(0, '#4a2fa0'); gr.addColorStop(1, '#271465'); X.fillStyle = gr; X.fillRect(LX, TOPY, RX - LX, 420);
    for (let i = 0; i < 40; i++) { const x = LX + 8 + K.hash(i + 5) * (RX - LX - 16), y = TOPY + 8 + K.hash(i + 55) * 330; X.fillStyle = 'rgba(255,255,255,' + (.25 + K.hash(i) * .4) + ')'; K.el(x, y, 1.8 + K.hash(i + 2) * 1.6, 1.8 + K.hash(i + 2) * 1.6); X.fill(); }
    X.beginPath(); X.arc(400, 175, 40, 0, K.TAU); K.ink('#ffd23f', 4); X.fillStyle = 'rgba(255,255,255,.35)'; K.el(388, 164, 14, 8, -.5); X.fill(); X.save(); X.translate(400, 175); X.rotate(-.35); K.el(0, 0, 74, 14); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#ff9fcd'; X.stroke(); X.restore();
    for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(400 + sx * 170, 360); X.lineTo(400 + sx * 150, 388); X.lineTo(400 + sx * 190, 388); X.closePath(); K.ink('#ff4d9e', 3); }
    X.restore();
    // slingshot rails
    for (const sx of [0, 1]) { const x0 = sx ? RX : LX, x1 = sx ? 538 : 262; K.line([[x0, 395], [x1, 495]], 8, '#ffd23f'); }
    // the rubber post at the top and the dark drain between the flippers
    K.ball(400, 100, 14, '#3a2f48', '#1f1a2e', 4);
    X.fillStyle = '#0d0820'; K.rr(266, 498, 268, 112, 8); X.fill(); X.strokeStyle = 'rgba(255,77,94,.5)'; X.lineWidth = 4; X.setLineDash([10, 10]); X.beginPath(); X.moveTo(280, 520); X.lineTo(520, 520); X.stroke(); X.setLineDash([]);
  });
  const ghost = (x, y, s, T, look) => {
    const X = ctx, K = GCK; X.save(); X.translate(x, y); X.scale(s, s);
    const P = K.P('M-26,24 L-26,-6 Q-26,-34 0,-34 Q26,-34 26,-6 L26,24 L16,16 L8,24 L0,16 L-8,24 L-16,16 Z'); K.cel(P, '#5ee6ff', '#2fa9c9', 4, 3, 4); K.glint(P, -10, -22, 8, 5, .5, -.4);
    K.eye(-9, -8, 7, 'idle', [look, .3], T, 0); K.eye(9, -8, 7, 'idle', [look, .3], T, 1); X.restore();
  };
  const g = {
    wide: true,
    cmd: 'BOUNCE!', hint: '← → (OR A D) FLIP: KEEP A BALL IN PLAY', thint: 'TAP LEFT / RIGHT HALF', dur: 5, timeWin: true,
    key(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') setF(0, true); if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') setF(1, true); if (e.code === 'Space') { setF(0, true); setF(1, true); } },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') setF(0, false); if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') setF(1, false); if (e.code === 'Space') { setF(0, false); setF(1, false); } },
    down(p) { setF(p.x < W / 2 ? 0 : 1, true); }, up() { setF(0, false); setF(1, false); },
    update(dt) {
      const ts = dt * k; if (!g.result) c += ts;
      if (c > .05 && spawned === 0) spawn(); if (c > .7 && spawned === 1) spawn();
      const om = [0, 0];
      fl.forEach((f, i) => {
        const tgt = f.on ? -.5 : .5, old = f.a, step = 17 * ts; f.a += gcClamp(tgt - f.a, -step, step);
        om[i] = ts > 0 ? (f.a - old) / ts * (f.dir === 1 ? 1 : -1) : 0;
      });
      for (const b of bumps) b.f = Math.max(0, b.f - dt * 4);
      const N = 5, h = ts / N;
      for (const b of balls) {
        if (!b.alive) continue;
        for (let s = 0; s < N; s++) {
          b.vy += 820 * h; b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < LX + b.r) { b.x = LX + b.r; b.vx = Math.abs(b.vx) * .8; } if (b.x > RX - b.r) { b.x = RX - b.r; b.vx = -Math.abs(b.vx) * .8; }
          if (b.y < TOPY + b.r) { b.y = TOPY + b.r; b.vy = Math.abs(b.vy) * .8; }
          gcSegHit(b, LX, 395, 262, 495, 4, .5); gcSegHit(b, RX, 395, 538, 495, 4, .5);
          fl.forEach((f, i) => { const t2 = tipOf(f); gcSegHit(b, f.px, f.py, t2[0], t2[1], 10, .35, (cx, cy) => [-om[i] * (cy - f.py), om[i] * (cx - f.px)]); });
          for (const bp of bumps) {
            const dx = b.x - bp.x, dy = b.y - bp.y, d = Math.hypot(dx, dy), R = b.r + bp.r;
            if (d < R) { const nx = dx / (d || 1), ny = dy / (d || 1); b.x = bp.x + nx * R; b.y = bp.y + ny * R; const sp2 = Math.max(430, Math.hypot(b.vx, b.vy)); b.vx = nx * sp2; b.vy = ny * sp2; bp.f = 1; score++; sfx.blip(5 + score % 5 * 2); burst(bp.x + nx * bp.r, bp.y + ny * bp.r, '#FFE14D', 6, 180); if (score % 5 === 0) floatText('+5', bp.x, bp.y - 40, '#fff', 30); }
          }
          const v = Math.hypot(b.vx, b.vy); if (v > 1000) { b.vx *= 1000 / v; b.vy *= 1000 / v; }
        }
        if (b.y > 585) { b.alive = false; sfx.miss(); shake(4, .15); }
      }
      if (!g.result && spawned >= 2 && !balls.some(b => b.alive)) gcLose(g);
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      // a ghost drifts behind the table and follows the ball with its eyes
      { const b0 = balls.find(b => b.alive), gx = ((t * 36) % (VW + 160)) - OX - 80; ghost(gx, 210 + Math.sin(t * 2) * 24, 1.1, t, b0 ? gcClamp((b0.x - gx) / 300, -1, 1) : 0); }
      if (lost) { X.fillStyle = 'rgba(255,40,70,.16)'; GCK.cx(); POLY(0); X.fill(); }
      for (const bp of bumps) {   // bumpers are round pink gumdrops with a face that watches the ball
        const b0 = balls.find(b => b.alive), lk = b0 ? [gcClamp((b0.x - bp.x) / 80, -1, 1), gcClamp((b0.y - bp.y) / 80, -1, 1)] : [0, 0], r = bp.r + bp.f * 6, hit = bp.f > .3;
        shadow(bp.x + 4, bp.y + 8, r, r * .4, .3);
        K.ball(bp.x, bp.y, r, won ? 'hsl(' + ((t * 300 + bp.x) % 360 | 0) + ',90%,62%)' : hit ? '#FFE14D' : '#ff4d9e', hit ? '#e0a800' : '#c42a74', 5);
        K.eye(bp.x - r * .33, bp.y - r * .1, r * .26, lost ? 'dizzy' : won || hit ? 'happy' : 'idle', lk, t, bp.x); K.eye(bp.x + r * .33, bp.y - r * .1, r * .26, lost ? 'dizzy' : won || hit ? 'happy' : 'idle', lk, t, bp.x + 1);
        X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); if (hit) X.arc(bp.x, bp.y + r * .22, r * .22, .1, Math.PI - .1); else X.arc(bp.x, bp.y + r * .3, r * .16, Math.PI + .5, -.5); X.stroke();
        X.fillStyle = 'rgba(255,255,255,.5)'; K.el(bp.x - r * .45, bp.y + r * .3, r * .14, r * .08); X.fill();
      }
      fl.forEach(f => {   // flippers: orange tapered paddles with a light stripe
        const t2 = tipOf(f); X.lineCap = 'round';
        X.strokeStyle = INK; X.lineWidth = 32; X.beginPath(); X.moveTo(f.px, f.py); X.lineTo(t2[0], t2[1]); X.stroke();
        X.strokeStyle = '#b4553a'; X.lineWidth = 20; X.stroke(); X.strokeStyle = OR; X.lineWidth = 15; X.beginPath(); X.moveTo(f.px - f.dir * 0, f.py - 2); X.lineTo(t2[0], t2[1] - 2); X.stroke();
        X.strokeStyle = 'rgba(255,255,255,.4)'; X.lineWidth = 4; X.beginPath(); X.moveTo(f.px + f.dir * 8, f.py - 7); X.lineTo(t2[0] - f.dir * 14, t2[1] - 7); X.stroke(); X.lineCap = 'butt';
        K.ball(f.px, f.py, 9, '#fff', '#c9ced6', 3);
      });
      for (const b of balls) if (b.alive) { shadow(b.x + 5, b.y + 9, b.r, b.r * .4, .3); K.ball(b.x, b.y, b.r, '#f0f4ff', '#9aa6bd', 3.5); }
      // Claude stands on a crate beside the table and pounds the buttons
      { const hop = won ? Math.abs(Math.sin(oT * 9)) * 16 : 0, cx = 64, cy = 372; K.slab(22, cy, 84, 52, 5, '#d9944f', '#a5622c', 4, 5); X.fillStyle = '#b06d33'; X.fillRect(30, cy + 18, 68, 6);
        shadow(cx, cy + 3, 40, 8, .3); X.save(); X.translate(cx, cy - hop); K.arms(6, won ? -.3 - Math.sin(oT * 14) * .4 : -2.6 + (fl[0].on ? .5 : 0), won ? .3 + Math.sin(oT * 14) * .4 : 2.6 - (fl[1].on ? .5 : 0), 1); claude(0, 0, 6, { mood: gcMood(g) }); X.restore();
        if (!g.result) K.tag(cx, cy - 92); if (lost) K.sweat(cx + 36, cy - 62, 1.3, oT); if (won) for (let i = 0; i < 4; i++) { const q = ((oT - .1) * 1.2 + i * .25) % 1; if (oT > .1) K.heart(cx + (i - 1.5) * 24, cy - 80 - q * 90, 1.1 - q * .4, 1 - q * q); } }
      // LEFT / RIGHT pads (they sink when held) and the score LED
      for (const [i, px, lab, cap] of [[0, 20, 'LEFT', '←'], [1, 680, 'RIGHT', '→']]) {
        K.plate(px, 430, 100, 56, fl[i].on ? '#5CFF7A' : '#4fd06a', '#24803a', fl[i].on);
        txt(lab, px + 50, 452 + (fl[i].on ? 6 : 0), 22, '#fff'); if (!TOUCH) K.keyCap(cap, px + 50, 476 + (fl[i].on ? 6 : 0));
      }
      K.slab(676, 340, 104, 56, 10, '#2a2438', '#14101c', 4, 3); X.fillStyle = '#1a0a14'; K.rr(684, 348, 88, 40, 6); X.fill();
      txt('' + score, 728, 369, 30, won && Math.floor(oT * 8) % 2 ? '#fff' : '#ff4d5e');
    }
  };
  return g;
}

/* ───────── 5 ── BATTER UP: one swing ───────── */
function gcBatter(sp) {
  const k = Math.sqrt(sp), T = 1.35 + Math.random() * .4, S = .8, curve = sp > 1.3 ? (Math.random() < .5 ? -1 : 1) * Math.min(120, 40 + sp * 30) : 0;
  let c = 0, swung = false, swT = 0, hit = false, flyT = 0, crowd = 0, miss = false;
  const zOf = () => (c - S) / T;
  const swing = () => {
    if (swung || g.result || c < .15) return; swung = true; swT = .001; sfx.whoosh();
    const z = zOf();
    if (z >= .88 && z <= 1.02) { hit = true; crowd = 1; gcWin(g); sfx.hit(); sfx.stamp(); sfx.sparkle(); shake(14, .35); burst(400, 470, '#FFE14D', 22, 340); ring(400, 470, '#fff', 120); floatText('NICE!', 400, 400, '#FFE14D', 50); } else { miss = true; gcLose(g); sfx.miss(); floatText('WHIFF', 330, 420, '#fff', 36); }
  };
  const BGL = GCK.layer(() => {   // a ballpark on a sunny day: sky, stands full of fans, the outfield wall, striped grass and the infield dirt
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 260); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(.6, '#8fdcff'); gr.addColorStop(1, '#e6fbff'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 270);
    X.beginPath(); X.arc(690, 96, 30, 0, K.TAU); K.ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; K.el(680, 88, 10, 7, -.6); X.fill();
    // stands: tiers + two rows of fans (the front row is drawn live so it can jump)
    K.slab(-OX - 10, 128, VW + 20, 118, 4, '#c9d0fb', '#9aa3e0', 4, 5);
    for (let r = 0; r < 2; r++) {
      const y = 158 + r * 36; X.fillStyle = r % 2 ? '#b4bdf0' : '#c9d0fb'; X.fillRect(-OX, y - 20, VW, 36); X.fillStyle = INK; X.fillRect(-OX, y + 14, VW, 3);
      for (let x = Math.floor(-OX / 30) * 30 - 10; x < W + OX + 10; x += 30) fan(x + 15 + (K.hash(r * 200 + Math.round(x / 30)) - .5) * 8, y, r * 200 + Math.round(x / 30), 0);
    }
    // the outfield wall with painted panels, then the grass
    K.slab(-OX - 10, 236, VW + 20, 34, 5, '#2f9a55', '#1f6d3c', 4, 4); X.fillStyle = '#ffd23f'; X.fillRect(-OX, 232, VW, 8); X.fillStyle = INK; X.fillRect(-OX, 238, VW, 3);
    for (let x = Math.floor(-OX / 120) * 120 + 20; x < W + OX; x += 120) { const i = Math.round(x / 120); K.rr(x, 246, 80, 18, 5); K.ink(['#ff4d6d', '#4DB8FF', '#ffd23f', '#b58cff'][((i % 4) + 4) % 4], 2.5); X.fillStyle = 'rgba(255,255,255,.7)'; K.el(x + 20, 255, 5, 5); X.fill(); K.rr(x + 34, 252, 34, 6, 3); X.fill(); }
    X.fillStyle = INK; X.fillRect(-OX, 268, VW, 5); gr = X.createLinearGradient(0, 270, 0, 600); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944'); X.fillStyle = gr; X.fillRect(-OX, 270, VW, 340);
    X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = Math.floor(-OX / 100) * 100; x < W + OX; x += 100) { X.beginPath(); X.moveTo(x, 272); X.lineTo(x + 50, 272); X.lineTo(x + 20, 600); X.lineTo(x - 70, 600); X.fill(); }
    // infield dirt, the mound and the batter's box
    K.el(400, 478, 262, 98); K.ink('#d9a066', 4); X.fillStyle = '#e8b97e'; K.el(400, 470, 232, 80); X.fill(); K.el(400, 272, 78, 17); K.ink('#d9a066', 4);
    X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 4; for (const x of [292, 440]) { K.rr(x, 462, 68, 82, 6); X.stroke(); }
    X.beginPath(); X.moveTo(360, 490); X.lineTo(440, 490); X.lineTo(440, 510); X.lineTo(400, 530); X.lineTo(360, 510); X.closePath(); K.ink('#fff', 5);
    for (const [x, y, s] of [[-OX + 40, 330, 1], [W + OX - 40, 300, .9]]) { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -34); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#8a5a2a'; X.stroke(); X.beginPath(); X.arc(0, -46, 18, 0, K.TAU); K.ink('#2f9a55', 3.5); X.restore(); }
  });
  function fan(x, y, i, jump) {
    const X = ctx || GCK.cx(), K = GCK; const hx = x, hy = y - 4 - jump, v = Math.floor(K.hash(i + 11) * 6);
    const shirt = ['#ff4d6d', '#ffd23f', '#4DB8FF', '#5CFF7A', '#b58cff', '#fff'][Math.floor(K.hash(i + 31) * 6)], skin = ['#f5c9a0', '#e0a070', '#c68a5a', '#8d5a3c'][Math.floor(K.hash(i + 17) * 4)];
    const x2 = GCK.cx(); x2.save(); x2.translate(0, 0);
    K.rr(hx - 12, hy + 8, 24, 18, 8); K.ink(shirt, 3); x2.beginPath(); x2.arc(hx, hy, 11, 0, K.TAU); K.ink(skin, 3);
    x2.fillStyle = INK; K.el(hx - 4, hy - 1, 1.8, 2.3); x2.fill(); K.el(hx + 4, hy - 1, 1.8, 2.3); x2.fill();
    if (v === 0) { x2.beginPath(); x2.arc(hx, hy - 5, 11, Math.PI, 0); K.ink('#2a2438', 3); }
    else if (v === 1) { x2.beginPath(); x2.arc(hx, hy - 4, 11, Math.PI, 0); K.ink('#ff4d5e', 3); K.rr(hx - 1, hy - 7, 16, 4, 2); K.ink('#ff4d5e', 2); }
    else if (v === 2) { x2.beginPath(); x2.arc(hx, hy - 4, 11, Math.PI, 0); K.ink('#4DB8FF', 3); K.rr(hx - 1, hy - 7, 16, 4, 2); K.ink('#4DB8FF', 2); }
    else if (v === 3) { K.el(hx, hy - 8, 17, 5); K.ink('#fff', 3); }
    else if (v === 4) { x2.beginPath(); x2.arc(hx + 9, hy - 10, 6, 0, K.TAU); K.ink('#ff7aa8', 2.5); }
    x2.restore();
  }
  const g = {
    wide: true,
    cmd: 'SWING!', hint: 'CLICK/SPACE WHEN THE BALL REACHES THE BAT', thint: 'TAP WHEN THE BALL HITS THE ZONE', dur: 4.2,
    key(e) { if (e.code === 'Space') swing(); }, down() { swing(); },
    update(dt) {
      c += dt * k; if (swT) { swT += dt * 5; if (swT > 1) swT = 1; } if (hit) flyT += dt; crowd = Math.max(0, crowd - dt * 1.3);
      if (!swung && !g.result && zOf() > 1.04) { gcLose(g); }
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      for (let i = 0; i < 3; i++) K.cloud(((t * (6 + i * 3) + i * 330) % (VW + 300)) - OX - 120, 40 + i * 26, .8 + i * .1);
      { const bx = ((t * 22) % (VW + 360)) - OX - 180; X.save(); X.translate(bx, 150); K.el(0, 0, 70, 24); K.ink('#e8434f', 4); X.fillStyle = 'rgba(255,255,255,.4)'; K.el(-14, -9, 28, 5, -.1); X.fill(); K.rr(-18, 20, 36, 12, 5); K.ink('#fff', 3); X.beginPath(); X.moveTo(-70, 0); X.lineTo(-90, -14); X.lineTo(-90, 14); X.closePath(); K.ink('#ffd23f', 3); X.restore(); }
      // the front row of fans jumps when it's a hit and slumps when it's a miss
      for (let x = Math.floor(-OX / 30) * 30 - 10, j = 0; x < W + OX + 10; x += 30, j++) fan(x + 15, 194 + (lost ? 6 : 0), 400 + Math.round(x / 30), won ? Math.abs(Math.sin(oT * 11 + j)) * 16 : 0);
      // scoreboard: three bulbs
      K.slab(318, 62, 164, 46, 12, '#2f9a55', '#1f6d3c', 4, 4); for (let i = 0; i < 3; i++) { const lit = won || lost; X.beginPath(); X.arc(354 + i * 46, 85, 11, 0, K.TAU); K.ink(lit ? (won ? 'hsl(' + ((i * 60 + t * 500) % 360 | 0) + ',95%,60%)' : (i < 2 ? '#ff4d5e' : '#5a3a3a')) : '#4a4558', 3); }
      // the hot-dog mascot dances at the wall
      { const mx = 684, my = 330, dn = won ? Math.abs(Math.sin(oT * 11)) * 18 : Math.abs(Math.sin(t * 4)) * 5, sw = Math.sin(t * 4) * .12; X.save(); X.translate(mx, my - dn); X.rotate(sw); shadow(0, dn + 4, 28, 7, .25);
        K.slab(-24, -86, 48, 86, 22, '#e8b97e', '#c4915a', 4, 5); K.slab(-15, -90, 30, 92, 15, '#d9503f', '#a8301f', 4, 4); X.strokeStyle = '#ffd23f'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i < 5; i++) X.lineTo(i % 2 ? 8 : -8, -76 + i * 16); X.stroke();
        K.eye(-6, -60, 5.5, lost ? 'bonk' : won ? 'happy' : 'idle', [.5, .3], t, 0); K.eye(7, -60, 5.5, lost ? 'bonk' : won ? 'happy' : 'idle', [.5, .3], t, 1);
        X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(0, -48, 5, .2, Math.PI - .2); X.stroke();
        for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 20, -46); X.lineTo(s * 36, -62 + Math.sin(t * 8 + s) * 8 - (won ? 20 : 0)); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#e8b97e'; X.stroke(); }
        X.restore(); }
      // the pitching machine: a round-cornered robot whose mouth fires the ball
      { const lk = [gcClamp((250 - 400) / 300, -1, 1), .6], mood = won ? 'panic' : lost ? 'happy' : 'idle'; K.slab(352, 166, 96, 82, 20, '#9aa6bd', '#6f7c96', 5, 6);
        X.beginPath(); X.moveTo(366, 166); X.lineTo(434, 166); X.lineTo(420, 140); X.lineTo(380, 140); X.closePath(); K.ink('#7f8ba4', 4);
        X.beginPath(); X.moveTo(400, 140); X.lineTo(400, 120); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.arc(400, 114, 9, 0, K.TAU); K.ink(won ? '#FFE14D' : Math.floor(t * 3) % 2 ? '#ff4d5e' : '#8a3a3a', 3);
        K.eye(376, 192, 11, mood, [-.6, .5], t, 0); K.eye(424, 192, 11, mood, [-.6, .5], t, 1);
        if (mood === 'idle') { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(362, 177); X.lineTo(386, 183); X.moveTo(438, 177); X.lineTo(414, 183); X.stroke(); }
        K.el(400, 228, 15, 11); K.ink('#2a2438', 4); if (lost) { X.fillStyle = '#ff7aa8'; K.el(400, 232, 9, 5); X.fill(); } }
      const z = zOf();
      if (c >= S && !hit) {
        const zz = Math.max(0, z), yy = 215 + 255 * Math.pow(zz, 1.4), xx = 400 + curve * Math.sin(Math.min(1, zz) * Math.PI) * (1 - Math.min(1, zz) * .2), r = 5 + 30 * zz;
        if (zz < 1.1) { X.fillStyle = 'rgba(20,16,28,.25)'; X.beginPath(); X.ellipse(xx, 505 - 45 * (1 - zz), r * 1.2, r * .4, 0, 0, 7); X.fill(); }
        if (zz < 1.12) { K.ball(xx, yy, r, '#fff', '#d4d9e6', Math.max(2, r / 7)); X.strokeStyle = '#e8232f'; X.lineWidth = Math.max(1.5, r / 10); X.beginPath(); X.arc(xx - r * .75, yy, r * .7, -.9, .9); X.stroke(); X.beginPath(); X.arc(xx + r * .75, yy, r * .7, Math.PI - .9, Math.PI + .9); X.stroke(); }
      }
      if (hit) {
        const f = Math.min(1, flyT / 1.1), bx = 400 + f * 200, by = 470 - Math.sin(f * Math.PI * .8) * 320 - f * 60, r = Math.max(4, 36 * (1 - f * .85));
        K.ball(bx, by, r, '#fff', '#d4d9e6', 3);
        for (let i = 0; i < 6; i++) { const q = ((oT * 1.5) + i * .17) % 1; if (oT > .1) K.star(560 + Math.cos(i * 2) * 120, 150 + Math.sin(i * 3) * 40, 14 * (1 - q), 5 * (1 - q), 5, q * 4, ['#FFE14D', '#ff4d9e', '#5ee6ff'][i % 3], 2); }
        K.pop(oT, 'HOME RUN!', 400, 150, 52, '#FFE14D', INK);
      }
      if (miss) K.pop(oT, 'STRIKE!', 400, 150, 52, '#ff4d5e', '#fff');
      // the batter
      shadow(250, 546, 60, 14, .3); const hopB = won ? Math.abs(Math.sin(oT * 9)) * 16 : 0;
      claude(250, 540 - hopB, 8, { mood: gcMood(g) });
      K.slab(206, 444 - hopB, 88, 28, 14, '#4DB8FF', '#2a7fc0', 4.5, 5); K.slab(262, 462 - hopB, 52, 9, 4, '#4DB8FF', '#2a7fc0', 3.5, 3); K.slab(200, 454 - hopB, 20, 30, 7, '#4DB8FF', '#2a7fc0', 3.5, 3);
      if (!g.result) K.tag(250, 404);
      if (lost) { K.sweat(214, 480, 1.4, oT); K.sweat(290, 470, 1.4, oT + .4); }
      const sw = swT ? swT : 0, ang = swung ? -2.1 + sw * 3.2 : -2.1 + Math.sin(now * 3) * .08;
      if (swT && swT < 1) { X.strokeStyle = 'rgba(255,255,255,.75)'; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.arc(290, 470, 130, -2.1, ang); X.stroke(); X.lineCap = 'butt'; }
      X.save(); X.translate(290, 470 - hopB); X.rotate(ang); X.lineCap = 'round';
      X.beginPath(); X.moveTo(0, 0); X.lineTo(52, 0); X.lineTo(150, -2); X.lineWidth = 26; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.moveTo(0, 0); X.lineTo(52, 0); X.lineWidth = 12; X.strokeStyle = '#5a3a1a'; X.stroke();
      X.beginPath(); X.moveTo(52, 0); X.lineTo(146, -1); X.lineWidth = 20; X.strokeStyle = '#d9a066'; X.stroke(); X.beginPath(); X.moveTo(60, -4); X.lineTo(140, -5); X.lineWidth = 5; X.strokeStyle = 'rgba(255,255,255,.45)'; X.stroke();
      X.lineCap = 'butt'; K.slab(-10, -11, 22, 22, 5, OR, '#b4553a', 3.5, 3); X.restore();
    }
  };
  return g;
}

/* ───────── 6 ── PICTURE PERFECT: frame the UFO ───────── */
function gcSnap(sp) {
  const k = Math.sqrt(sp), dir = Math.random() < .5 ? 1 : -1, FW = 230, FH = 170;
  let c = 0, fx = 400, fy = 280, tx = 400, ty = 280, flash = 0, pol = 0, shot = 0;
  const ufo = { x: dir > 0 ? -80 - OX : 880 + OX, y: 260, base: 190 + Math.random() * 130 };
  const birds = [], clouds = [], vk = 1 + (VW - W) / 960 * .6;   // vk: faster UFO to cross the wider sky
  for (let i = 0; i < Math.round(4 * VW / W); i++) birds.push({ x: -OX + Math.random() * VW, y: 90 + Math.random() * 360, v: (Math.random() < .5 ? -1 : 1) * (120 + Math.random() * 120) * (sp > 1 ? 1.1 : 1), ph: Math.random() * 6 });
  for (let i = 0; i < Math.round(5 * VW / W); i++) clouds.push({ x: -OX + Math.random() * VW, y: 70 + Math.random() * 380, s: 36 + Math.random() * 30, v: 12 + Math.random() * 14 });
  const snap = () => {
    if (shot || g.result) return; shot = 1; flash = 1; pol = .001; sfx.click(); noise(.12, .05, 3000, 800, 'highpass', .02);
    if (c >= .15 && Math.abs(ufo.x - fx) < FW * .38 && Math.abs(ufo.y - fy) < FH * .38) { gcWin(g); sfx.sparkle(); burst(ufo.x, ufo.y, '#7cf7d4', 18); ring(ufo.x, ufo.y, '#fff', 100); floatText('PERFECT!', ufo.x, ufo.y - 50, '#7cf7d4', 40); } else { gcLose(g); sfx.miss(); }
  };
  const BGL = GCK.layer(() => {   // a farm field: sky, far hills, a barn and a silo, a fence and a grassy foreground
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 450); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(.55, '#8fdcff'); gr.addColorStop(1, '#e6fbff'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 460);
    X.beginPath(); X.moveTo(-OX, 450); for (let x = -OX; x <= W + OX + 60; x += 60) X.lineTo(x, 360 - Math.sin(x * .006) * 36 - K.hash(Math.round(x / 60) + 20) * 20); X.lineTo(W + OX, 450); X.closePath(); X.fillStyle = '#a9dfc6'; X.fill();
    X.beginPath(); X.moveTo(-OX, 450); for (let x = -OX; x <= W + OX + 40; x += 40) X.lineTo(x, 396 + Math.sin(x * .011 + 1) * 22); X.lineTo(W + OX, 450); X.closePath(); X.fillStyle = '#87d19b'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#4f9a6a'; X.stroke();
    // barn + silo on the near hill
    X.save(); X.translate(150, 402);
    K.rr(-48, -66, 96, 68, 4); K.ink('#e8434f', 4); X.beginPath(); X.moveTo(-56, -62); X.lineTo(0, -102); X.lineTo(56, -62); X.closePath(); K.ink('#9aa6bd', 4);
    K.rr(-18, -44, 36, 46, 3); K.ink('#fff7e8', 3); X.strokeStyle = '#e8434f'; X.lineWidth = 3; X.beginPath(); X.moveTo(-18, -44); X.lineTo(18, 2); X.moveTo(18, -44); X.lineTo(-18, 2); X.stroke(); X.restore();
    X.save(); X.translate(222, 402); K.rr(-18, -92, 36, 94, 8); K.ink('#cfd8e6', 4); X.beginPath(); X.arc(0, -92, 18, Math.PI, 0); K.ink('#e8434f', 4); X.restore();
    // the windmill tower (its blades turn live)
    X.save(); X.translate(690, 410); X.beginPath(); X.moveTo(-14, 0); X.lineTo(14, 0); X.lineTo(6, -96); X.lineTo(-6, -96); X.closePath(); K.ink('#e3ac66', 4); X.restore();
    // ground with a hard horizon and a fence
    X.fillStyle = INK; X.fillRect(-OX, 438, VW, 5); gr = X.createLinearGradient(0, 442, 0, 600); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944'); X.fillStyle = gr; X.fillRect(-OX, 442, VW, 170);
    X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 9; i++) { X.beginPath(); X.moveTo(-OX + i * 150, 444); X.lineTo(-OX + i * 150 + 60, 444); X.lineTo(-OX + i * 150 - 20, 600); X.lineTo(-OX + i * 150 - 80, 600); X.fill(); }
    for (let x = Math.floor(-OX / 60) * 60 + 10; x < W + OX; x += 60) K.slab(x, 420, 10, 34, 3, '#e3a868', '#c4874e', 3, 2);
    for (const y of [430, 442]) K.slab(-OX - 5, y, VW + 10, 5, 2, '#e3a868', '#c4874e', 2.5, 1.5);
    X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 26; i++) { const x = -OX + K.hash(i + 3) * VW, y = 470 + K.hash(i + 44) * 120; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 8, y - 12); X.moveTo(x, y); X.lineTo(x, y - 15); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 11); X.stroke(); }
    for (let i = 0; i < 12; i++) { const x = -OX + K.hash(i + 70) * VW, y = 480 + K.hash(i + 90) * 100; X.beginPath(); X.arc(x, y, 5, 0, K.TAU); K.ink(['#ff7aa8', '#fff', '#ffd23f'][i % 3], 2.5); }
  });
  const cow = (x, y, s, mood, look, T) => {
    const X = ctx, K = GCK; X.save(); X.translate(x, y); X.scale(s, s); X.lineCap = 'round'; X.lineJoin = 'round';
    for (const lx of [-34, 30]) { K.slab(lx - 8, -26, 16, 26, 5, '#fff', '#d8dfee', 4, 3); X.fillStyle = INK; K.rr(lx - 9, -7, 18, 8, 3); X.fill(); }
    X.beginPath(); X.moveTo(-50, -56); X.quadraticCurveTo(-72, -46 + Math.sin(T * 4) * 5, -66, -18); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#fff'; X.stroke(); K.ball(-66, -14, 7, '#3a2f48', '#14101c', 3);
    const B = K.pEl(0, -46, 54, 34); K.cel(B, '#fff', '#d8dfee', 6, 6, 5); X.save(); X.clip(B); X.fillStyle = '#3a2f48'; K.el(-22, -52, 14, 11); X.fill(); K.el(14, -34, 16, 10, .4); X.fill(); K.el(-6, -70, 12, 7); X.fill(); X.restore(); K.glint(B, -24, -66, 20, 6, .5, -.1);
    K.ball(-4, -18, 9, '#ffb3c7', '#e07a98', 3);
    const H = K.pEl(52, -58, 26, 23); K.cel(H, '#fff', '#d8dfee', 4, 4, 5); X.save(); X.clip(H); X.fillStyle = '#3a2f48'; K.el(40, -74, 10, 8); X.fill(); X.restore();
    const chew = Math.sin(T * 8) * 2; K.el(68, -48 + chew * .3, 18, 13); K.ink('#ffb3c7', 4); X.fillStyle = INK; K.el(63, -50, 2.2, 3); X.fill(); K.el(74, -50, 2.2, 3); X.fill();
    for (const sx of [0, 1]) { X.beginPath(); X.moveTo(sx ? 62 : 40, -78); X.lineTo(sx ? 64 : 36, -92); X.lineTo(sx ? 56 : 46, -80); X.closePath(); K.ink('#fff3c0', 3); }
    X.beginPath(); X.ellipse(30, -66, 11, 6, -.5, 0, K.TAU); K.ink('#fff', 3);
    K.eye(52, -64, 6.5, mood, look, T, 0);
    X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); if (mood === 'panic') { K.el(70, -41, 4, 5); X.fillStyle = INK; X.fill(); } else if (mood === 'smug') { X.moveTo(60, -40); X.quadraticCurveTo(70, -34, 80, -42); X.stroke(); } else { X.moveTo(62, -41); X.lineTo(76, -42); X.stroke(); }
    X.fillStyle = 'rgba(255,110,165,.5)'; K.el(44, -50, 6, 4); X.fill();
    X.restore();
  };
  const g = {
    wide: true,
    cmd: 'SNAP!', hint: 'FRAME THE UFO, THEN CLICK', thint: 'DRAG THE FRAME, LIFT TO SNAP', dur: 5,
    // touch: dragging moves the frame and lifting the finger snaps; mouse: click snaps
    move(p) { tx = p.x; ty = p.y; }, down(p) { tx = p.x; ty = p.y; if (!p.touch) snap(); }, up(p) { if (p.touch) snap(); },
    key(e) { if (e.code === 'Space') snap(); },
    update(dt) {
      const ts = dt * k; if (!shot) c += ts;
      const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
      if (kx || ky) { tx = fx + kx * 40; ty = fy + ky * 40; }
      fx += (gcClamp(tx, 115 - OX, 685 + OX) - fx) * Math.min(1, 14 * dt); fy += (gcClamp(ty, 95, 455) - fy) * Math.min(1, 14 * dt);
      flash = Math.max(0, flash - dt * 4); if (pol) pol = Math.min(1.5, pol + dt);
      for (const b of birds) { b.x += b.v * ts; if (b.x < -OX - 60) b.x = W + OX + 60; if (b.x > W + OX + 60) b.x = -OX - 60; }
      for (const cl of clouds) { cl.x += cl.v * dt; if (cl.x > W + OX + 100) cl.x = -OX - 100; }
      if (!shot) {
        if (c > .3) { ufo.x += dir * 255 * vk * ts; ufo.y = ufo.base + Math.sin(c * 2.4) * 55; }
        if ((dir > 0 && ufo.x > W + OX + 90) || (dir < 0 && ufo.x < -OX - 90)) gcLose(g);
      }
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL(); K.sun(640, 128, t);
      for (const cl of clouds) K.cloud(cl.x - cl.s * 1.4, 96 + (cl.y - 70) / 380 * 50, Math.min(cl.s / 34, 1));   // decor only: squeezed into the sky band, above the hills, barn and UFO lane
      X.save(); X.translate(690, 314); X.rotate(t * (won ? 4 : 1)); X.lineCap = 'round'; for (let i = 0; i < 4; i++) { X.rotate(Math.PI / 2); X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -62); X.lineWidth = 17; X.strokeStyle = INK; X.stroke(); X.lineWidth = 9; X.strokeStyle = '#fff7e8'; X.stroke(); } X.restore(); K.ball(690, 314, 8, '#e3ac66', '#b98042', 3);
      for (const b of birds) {
        const fl = Math.sin(now * 12 + b.ph) * 10; X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(b.x - 24, b.y - fl); X.lineTo(b.x, b.y + 6); X.lineTo(b.x + 24, b.y - fl); X.stroke(); X.lineCap = 'butt';
      }
      const showU = (!shot || g.result) && ufo.x > -OX - 100 && ufo.x < W + OX + 100;
      cow(500, 486, 1.15, won ? 'panic' : lost ? 'smug' : (showU && Math.abs(ufo.x - 500) < 150 ? 'panic' : 'idle'), [showU ? gcClamp((ufo.x - 500) / 160, -1, 1) : 0, -1], t);
      if (showU) {
        // a faint tractor beam, then the saucer with a little alien at the wheel
        X.save(); X.fillStyle = 'rgba(124,247,212,' + (.12 + .05 * Math.sin(t * 8)) + ')'; X.beginPath(); X.moveTo(ufo.x - 26, ufo.y + 14); X.lineTo(ufo.x + 26, ufo.y + 14); X.lineTo(ufo.x + 70, 468); X.lineTo(ufo.x - 70, 468); X.closePath(); X.fill(); X.restore();
        shadow(ufo.x, 470, 40, 8, .18);
        X.save(); X.translate(ufo.x, ufo.y); X.rotate(Math.sin(now * 5) * .08);
        const DOME = K.pEl(0, -14, 26, 24); K.cel(DOME, '#bfe9ff', '#8cc4e8', 3, 3, 4); X.save(); X.clip(DOME); K.el(0, -12, 13, 14); X.fillStyle = '#7cf7d4'; X.fill(); X.restore(); K.eye(-5, -14, 4.6, won ? 'panic' : lost ? 'happy' : 'idle', [0, .8], now, 0); K.eye(5, -14, 4.6, won ? 'panic' : lost ? 'happy' : 'idle', [0, .8], now, 1); K.glint(DOME, -10, -26, 5, 3, .7, -.4);
        const SC = K.pEl(0, 6, 60, 19); K.cel(SC, '#c9ced6', '#8f9cb3', 4, 4, 4.5); K.glint(SC, -24, -2, 22, 4, .55, -.1);
        for (let i = -2; i <= 2; i++) { X.beginPath(); X.arc(i * 21, 8, 4.5, 0, K.TAU); K.ink(Math.floor(now * 6 + i) % 2 ? '#ffd23f' : '#ff4d6d', 1.8); }
        X.restore();
      }
      // Claude with the camera, bottom-left
      { const cx = 84, cy = 534, pose = shot ? 1 : 0; shadow(cx, cy + 4, 34, 8, .3); X.save(); X.translate(cx, cy); K.arms(4.4, -.5 - pose * .2, .6 + pose * .2, 1); claude(0, 0, 4.4, { mood: gcMood(g) });
        K.slab(-8, -58, 44, 26, 6, '#3b3550', '#1f1a2e', 3.5, 3); K.ball(14, -45, 8, '#bfe9ff', '#6aa6c8', 3); K.slab(-4, -64, 14, 8, 3, '#e8434f', '#a8202c', 2.5, 2); X.restore(); if (!g.result) K.tag(cx, cy - 92); if (lost) K.sweat(cx + 34, cy - 40, 1.3, oT); if (won) for (let i = 0; i < 3; i++) { const q = ((oT - .1) * 1.2 + i * .33) % 1; if (oT > .1) K.heart(cx + (i - 1) * 24, cy - 80 - q * 80, 1.1 - q * .4, 1 - q * q); } }
      // viewfinder
      X.fillStyle = 'rgba(20,16,28,.28)';
      X.fillRect(-OX, 0, VW, fy - FH / 2); X.fillRect(-OX, fy + FH / 2, VW, H); X.fillRect(-OX, fy - FH / 2, fx - FW / 2 + OX, FH); X.fillRect(fx + FW / 2, fy - FH / 2, W + OX - (fx + FW / 2), FH);
      X.strokeStyle = 'rgba(255,255,255,.3)'; X.lineWidth = 1.5; X.beginPath(); for (let i = 1; i < 3; i++) { X.moveTo(fx - FW / 2 + FW * i / 3, fy - FH / 2); X.lineTo(fx - FW / 2 + FW * i / 3, fy + FH / 2); X.moveTo(fx - FW / 2, fy - FH / 2 + FH * i / 3); X.lineTo(fx + FW / 2, fy - FH / 2 + FH * i / 3); } X.stroke();
      const L = 34;
      for (const col of [INK, '#fff']) {
        X.strokeStyle = col; X.lineWidth = col === INK ? 12 : 5; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath();
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = fx + sx * FW / 2, y = fy + sy * FH / 2; X.moveTo(x - sx * L, y); X.lineTo(x, y); X.lineTo(x, y - sy * L); }
        X.moveTo(fx - 14, fy); X.lineTo(fx + 14, fy); X.moveTo(fx, fy - 14); X.lineTo(fx, fy + 14); X.stroke();
      }
      X.lineCap = 'butt';
      if (Math.floor(now * 2) % 2 === 0) { K.ball(fx - FW / 2 + 18, fy - FH / 2 - 22, 6, '#ff3b3b', '#a8202c', 2.5); }
      if (flash > 0) { X.fillStyle = 'rgba(255,255,255,' + Math.min(.85, flash * 1.2) + ')'; K.rr(fx - FW / 2, fy - FH / 2, FW, FH, 6); X.fill(); }   // the flash stays inside the frame
      if (pol) {
        const k2 = Math.min(1, pol / .5), py = 640 - k2 * 270;
        X.save(); X.translate(690 + OX * .6, py); X.rotate(.12);
        K.slab(-80, -100, 160, 200, 8, '#fff', '#e6e9f2', 4.5, 5); X.save(); K.rr(-68, -88, 136, 130, 4); X.clip();
        const gp = X.createLinearGradient(0, -88, 0, 42); gp.addColorStop(0, '#6fb8e8'); gp.addColorStop(1, '#d6f7ff'); X.fillStyle = gp; X.fillRect(-68, -88, 136, 130); X.fillStyle = '#87d19b'; K.el(-30, 44, 80, 22); X.fill(); K.el(40, 46, 70, 20); X.fill();
        if (g.result === 'win') { X.save(); X.translate(0, -34); X.scale(.9, .9); K.cel(K.pEl(0, 6, 40, 14), '#c9ced6', '#8f9cb3', 3, 3, 3.5); X.beginPath(); X.arc(0, -4, 14, Math.PI, 0); K.ink('#7cf7d4', 3); X.restore(); }
        else { K.rr(-28, -2, 44, 70, 20); K.ink('#ffb3a0', 4); X.fillStyle = 'rgba(255,255,255,.4)'; K.rr(-20, 8, 8, 30, 4); X.fill(); }   // a thumb over the lens
        X.restore(); txt(g.result === 'win' ? 'PERFECT' : 'OOPS', 0, 74, 26, g.result === 'win' ? '#2bb24c' : '#ff4d4d', 'center', 130);
        X.restore();
      }
    }
  };
  return g;
}

/* ───────── 7 ── MOUSE TRAP: drop the trap on the mouse ───────── */
function gcTrap(sp) {
  const k = Math.sqrt(sp), FY = 500, TY0 = 140;
  const om = 2.0 + sp * .5, ph = Math.random() * 6;
  const mouse2 = { x: 120 - OX + Math.random() * (560 + 2 * OX), dir: Math.random() < .5 ? -1 : 1, v: 170, t: 0, pause: 0 };
  const cheese = { x: 140 - OX + Math.random() * (520 + 2 * OX) };
  let c = 0, tx = 400, ty = TY0, vy = 0, fall = false, landed = false, snapT = 0, wig = 0;
  const drop = () => { if (fall || g.result) return; fall = true; vy = 0; sfx.whoosh(false); };
  const BGL = GCK.layer(() => {   // a kitchen at night: tiles, a moon window, a clock, a shelf, the counter, a mouse hole and a plank floor
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, '#9fd8d0'); gr.addColorStop(1, '#c8efe6'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 500);
    X.strokeStyle = 'rgba(20,16,28,.14)'; X.lineWidth = 2; for (let x = Math.floor(-OX / 50) * 50; x < W + OX; x += 50) { X.beginPath(); X.moveTo(x, 70); X.lineTo(x, 500); X.stroke(); } for (let y = 70; y < 500; y += 50) { X.beginPath(); X.moveTo(-OX, y); X.lineTo(W + OX, y); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.22)'; for (let x = Math.floor(-OX / 100) * 100; x < W + OX; x += 100) for (let y = 70; y < 500; y += 100) { X.fillRect(x + 6, y + 6, 14, 5); }
    // night window with a moon + curtains
    K.rr(110, 96, 150, 126, 8); X.fillStyle = '#1d1840'; X.fill(); X.save(); K.rr(110, 96, 150, 126, 8); X.clip(); gr = X.createLinearGradient(0, 96, 0, 222); gr.addColorStop(0, '#1d1840'); gr.addColorStop(1, '#3d3480'); X.fillStyle = gr; X.fillRect(110, 96, 150, 126);
    X.beginPath(); X.arc(214, 140, 22, 0, K.TAU); X.fillStyle = '#fff3b0'; X.fill(); X.fillStyle = '#3d3480'; K.el(224, 134, 20, 20); X.fill(); X.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { K.el(120 + K.hash(i + 2) * 130, 104 + K.hash(i + 9) * 90, 1.8, 1.8); X.fill(); } X.restore();
    K.rr(110, 96, 150, 126, 8); K.ink(null, 5); X.beginPath(); X.moveTo(185, 96); X.lineTo(185, 222); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke(); K.slab(100, 220, 170, 14, 5, '#e3ac66', '#b98042', 4, 3);
    // wall clock
    X.beginPath(); X.arc(430, 150, 36, 0, K.TAU); K.ink('#fff7e8', 5); for (let i = 0; i < 12; i++) { const a = i / 12 * K.TAU; X.beginPath(); X.moveTo(430 + Math.cos(a) * 28, 150 + Math.sin(a) * 28); X.lineTo(430 + Math.cos(a) * 32, 150 + Math.sin(a) * 32); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
    // the cat's shelf + jars
    K.slab(626, 262, 170, 14, 5, '#e3ac66', '#b98042', 4, 3); for (const x of [650, 680]) { X.beginPath(); X.moveTo(x - 8, 276); X.lineTo(x + 8, 276); X.lineTo(x - 8, 298); X.closePath(); K.ink('#b98042', 3); }
    // the counter along the left wall with cabinet doors
    K.slab(-OX - 10, 442, OX + 200, 14, 5, '#f7d297', '#d9b070', 4, 3); K.slab(-OX - 10, 456, OX + 190, 44, 4, '#d9944f', '#a5622c', 4, 4);
    for (let x = -OX; x < 180; x += 66) { K.slab(x + 4, 462, 58, 34, 5, '#e3a868', '#c4874e', 3, 2); X.beginPath(); X.arc(x + 48, 478, 3.5, 0, K.TAU); K.ink('#ffd23f', 1.5); }
    // baseboard, a mouse hole, and the floor
    K.slab(-OX - 10, 466, VW + 20, 32, 4, '#fff7e8', '#e8d6b0', 4, 3); X.fillStyle = INK; X.fillRect(-OX, 496, VW, 5);
    X.beginPath(); X.moveTo(664, 498); X.lineTo(664, 482); X.quadraticCurveTo(664, 462, 690, 462); X.quadraticCurveTo(716, 462, 716, 482); X.lineTo(716, 498); X.closePath(); K.ink('#241a32', 4);
    gr = X.createLinearGradient(0, 500, 0, 600); gr.addColorStop(0, '#a56a38'); gr.addColorStop(1, '#6f4118'); X.fillStyle = gr; X.fillRect(-OX, 500, VW, 120);
    for (let i = -Math.ceil(OX / 110); i < 8 + Math.ceil(OX / 110); i++) { X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(i * 110, 500, 5, 120); } X.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 0; i < 4; i++) X.fillRect(-OX, 520 + i * 26, VW, 4);
    K.slab(-OX - 6, 54, VW + 12, 16, 5, '#c9ced6', '#8f9cb3', 4, 3); X.fillStyle = INK; for (let i = Math.floor(-OX / 40); i < 21 + Math.ceil(OX / 40); i++) X.fillRect(10 + i * 40, 72, 4, 6);
  });
  const mouseArt = (x, y, dir, mood, T, wig, look) => {
    const X = ctx, K = GCK; X.save(); X.translate(x, y); X.scale(dir, 1); X.lineCap = 'round'; X.lineJoin = 'round';
    X.beginPath(); X.moveTo(-26, -12); X.quadraticCurveTo(-52, -14 + Math.sin(wig * 9) * 8, -60, -34); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#ffb3c7'; X.stroke();
    for (const sx of [-12, 12]) { K.el(sx + Math.sin(wig * 18 + sx) * 3, -3, 9, 6); K.ink('#ffb3c7', 3); }
    const B = K.pEl(0, -18, 31, 21); K.cel(B, '#b8bcc8', '#8a8fa0', 5, 4, 4.5); K.glint(B, -10, -28, 11, 4, .5, -.2);
    const H = K.pEl(22, -22, 17, 15); K.cel(H, '#b8bcc8', '#8a8fa0', 3, 3, 4.5);
    X.beginPath(); X.arc(12, -38, 11, 0, K.TAU); K.ink('#b8bcc8', 3.5); X.beginPath(); X.arc(12, -38, 6.5, 0, K.TAU); X.fillStyle = '#ff9fbd'; X.fill();
    K.eye(26, -26, 5.8, mood, look, T, 0); K.ball(37, -20, 4.5, '#ff7aa8', '#c94a7a', 2.5);
    X.strokeStyle = INK; X.lineWidth = 1.8; X.beginPath(); X.moveTo(34, -17); X.lineTo(46, -22); X.moveTo(34, -15); X.lineTo(46, -12); X.stroke();
    X.fillStyle = 'rgba(255,110,165,.55)'; K.el(20, -15, 4, 2.6); X.fill();
    if (mood === 'happy') { X.fillStyle = '#ff7aa8'; K.el(34, -9, 4, 5); K.ink('#ff7aa8', 2); }
    X.restore();
  };
  const g = {
    wide: true,
    cmd: 'DROP!', hint: 'CLICK/SPACE TO DROP THE TRAP ON THE MOUSE', thint: 'TAP TO DROP THE TRAP', dur: 5.2,
    key(e) { if (e.code === 'Space') drop(); }, down() { drop(); },
    update(dt) {
      const ts = dt * k; c += ts; wig += dt;
      if (!landed) {
        const m = mouse2; m.t -= ts;
        if (m.t <= 0) { m.t = .4 + Math.random() * .8; const r = Math.random(); if (r < .25) m.pause = .35; else m.pause = 0; if (Math.random() < .5) m.dir *= -1; m.v = (130 + Math.random() * 150) * Math.sqrt(sp * .8 + .2); }
        if (m.x < 60 - OX) m.dir = 1; if (m.x > 740 + OX) m.dir = -1;
        if (!m.pause || m.t > .4) m.x += m.dir * m.v * ts * (m.pause ? 0 : 1);
        if (!fall) tx = 400 + (290 + OX) * Math.sin(c * om + ph);
        else {
          vy += 2600 * ts; ty += vy * ts;
          if (ty >= FY - 38) { ty = FY - 38; landed = true; snapT = .001; sfx.thud(); shake(11, .3); burst(tx, FY, '#f6ead0', 12, 240); if (Math.abs(tx - m.x) < 66) { gcWin(g); sfx.stamp(); floatText('GOTCHA!', tx, ty - 120, '#FFE14D', 40); } else { gcLose(g); sfx.boing(); floatText('MISSED', m.x, FY - 90, '#fff', 34); } }
        }
      }
      if (snapT) snapT += dt;
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      // the clock hands tick, the cat sleeps (and wakes up when the trap slams), a little mouse peeks from the hole
      X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(430, 150); X.lineTo(430 + Math.cos(t * .2 - 1.2) * 20, 150 + Math.sin(t * .2 - 1.2) * 20); X.stroke(); X.lineWidth = 2.5; X.strokeStyle = '#e8434f'; X.beginPath(); X.moveTo(430, 150); X.lineTo(430 + Math.cos(t * 3) * 28, 150 + Math.sin(t * 3) * 28); X.stroke(); X.lineCap = 'butt';
      const peek = Math.sin(t * .9) > .2;
      K.cat(724, 262, .9, landed ? 'panic' : 'sleep', [-.5, 1], t, 0);
      if (!landed) for (let i = 0; i < 2; i++) { const q = (t * .6 + i * .5) % 1; K.zee(690 - q * 20, 196 - q * 40, .8 + q * .5, 1 - q); }
      if (peek) { X.save(); K.eye(682, 482, 5, 'idle', [-1, 0], t, 0); K.eye(698, 482, 5, 'idle', [-1, 0], t, 1); X.restore(); }
      // the cheese
      X.beginPath(); X.moveTo(cheese.x - 34, FY - 2); X.lineTo(cheese.x + 34, FY - 2); X.lineTo(cheese.x - 34, FY - 38); X.closePath(); K.ink('#ffd23f', 4);
      X.save(); X.beginPath(); X.moveTo(cheese.x - 34, FY - 2); X.lineTo(cheese.x + 34, FY - 2); X.lineTo(cheese.x - 34, FY - 38); X.closePath(); X.clip(); X.fillStyle = '#e8a800'; X.beginPath(); X.moveTo(cheese.x + 34, FY - 2); X.lineTo(cheese.x - 34, FY - 38); X.lineTo(cheese.x + 34, FY - 38); X.fill(); X.restore();
      for (const [dx, dy, r] of [[-20, -10, 5], [-6, -6, 4], [-24, -24, 3.5]]) { X.beginPath(); X.arc(cheese.x + dx, FY + dy, r, 0, K.TAU); K.ink('#d99a00', 1.5); }
      const m = mouse2, fk = gcClamp((ty - TY0) / (FY - TY0), 0, 1);
      shadow(m.x, FY + 4, 34, 8, .25); shadow(cheese.x, FY + 2, 38, 8, .25); shadow(tx, FY + 6, 30 + 30 * fk, 6 + 6 * fk, .12 + .2 * fk);
      const flying = fall && !landed;
      if (!(g.result === 'win' && snapT > 0)) mouseArt(m.x, FY - 2, m.dir, lost ? 'happy' : flying ? 'panic' : 'idle', t, wig, [m.dir * .8, .2]);
      if (flying) K.sweat(m.x + 20 * m.dir, FY - 56, 1.2, t);
      // the trap: a hungry crate on a rope that trolleys along the ceiling rail
      const ropeTop = 70;
      if (!fall) { X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(tx, ropeTop); X.lineTo(tx, ty - 34); X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 3; X.stroke(); K.slab(tx - 16, ropeTop - 12, 32, 18, 6, '#c9ced6', '#8f9cb3', 3.5, 3); for (const sx of [-1, 1]) K.ball(tx + sx * 9, ropeTop + 8, 4, '#3b3550', '#14101c', 2); }
      else if (!landed) { X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = -1; i <= 1; i++) { X.beginPath(); X.moveTo(tx + i * 30, ty - 140); X.lineTo(tx + i * 30, ty - 50); X.stroke(); } X.lineCap = 'butt'; }
      const sq = landed ? Math.max(0, 1 - snapT * 6) * .08 : 0;
      X.save(); X.translate(tx, ty + 38); X.scale(1 + sq, 1 - sq); X.translate(-tx, -(ty + 38));
      X.fillStyle = INK; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(tx - 46 + i * 16, ty + 38); X.lineTo(tx - 38 + i * 16, ty + 56); X.lineTo(tx - 30 + i * 16, ty + 38); X.lineJoin = 'round'; X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#fff'; X.fill(); }
      K.slab(tx - 50, ty - 34, 100, 72, 6, '#d9944f', '#a5622c', 5, 6); X.fillStyle = '#b06d33'; X.fillRect(tx - 44, ty - 24, 88, 5); X.fillRect(tx - 44, ty + 20, 88, 5);
      for (const sx of [-1, 1]) { X.fillStyle = '#c9ced6'; K.rr(tx + sx * 38 - 6, ty - 34, 12, 72, 3); X.fill(); X.strokeStyle = INK; X.lineWidth = 2.5; X.stroke(); X.fillStyle = '#8f9cb3'; K.el(tx + sx * 38, ty - 24, 2.4, 2.4); X.fill(); K.el(tx + sx * 38, ty + 28, 2.4, 2.4); X.fill(); }
      const tm = landed ? (won ? 'happy' : 'bonk') : fall ? 'panic' : 'idle', lk = [gcClamp((m.x - tx) / 90, -1, 1), 1];
      K.eye(tx - 17, ty - 4, 10, tm, lk, t, 0); K.eye(tx + 17, ty - 4, 10, tm, lk, t, 1);
      if (tm === 'idle') { X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(tx - 30, ty - 20); X.lineTo(tx - 8, ty - 13); X.moveTo(tx + 30, ty - 20); X.lineTo(tx + 8, ty - 13); X.stroke(); }
      X.restore();
      if (landed) {
        if (won) { for (const sx of [-1, 1]) { K.el(tx + sx * 13, FY + 8, 5, 6); K.ink('#fff', 2); X.fillStyle = INK; K.el(tx + sx * 13, FY + 9, 2.2, 3); X.fill(); } X.beginPath(); X.moveTo(tx + 48, FY + 6); X.quadraticCurveTo(tx + 70, FY + 6 + Math.sin(oT * 14) * 6, tx + 82, FY - 6); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#ffb3c7'; X.stroke(); }
        K.star(tx, ty + 8, 78, 46, 9, snapT * 3, 'rgba(255,255,255,.3)', 0);
        K.badge('SNAP!', tx, ty - 84, 50 + Math.max(0, 16 - snapT * 40), '#FFE14D', INK, 1, -.05);
        if (lost) K.pop(oT, 'HA!', m.x, FY - 100, 36, '#fff', INK, .15, .06);
        if (won) for (let i = 0; i < 4; i++) { const q = ((oT - .1) * 1.2 + i * .25) % 1; if (oT > .1) K.heart(tx + (i - 1.5) * 28, ty - 130 - q * 40, 1 - q * .3, 1 - q * q); }
      }
      // Claude on the counter pulls the lever
      { const cx = 70, cy = 440, pull = fall ? 1 : 0; K.slab(104, 424, 22, 16, 4, '#8f9cb3', '#5f6b86', 3.5, 2); X.save(); X.translate(115, 428); X.rotate(pull ? .7 : -.7); X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -34); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#c9ced6'; X.stroke(); X.restore(); K.ball(115 + Math.sin(pull ? .7 : -.7) * 34, 428 - Math.cos(.7) * 34, 9, '#ff4d5e', '#b8283a', 3.5);
        shadow(cx, cy + 3, 36, 8, .3); X.save(); X.translate(cx, cy - (won ? Math.abs(Math.sin(oT * 9)) * 14 : 0)); K.arms(5, -2.6, won ? .4 + Math.sin(oT * 14) * .4 : pull ? 1.2 : 2.2, 1); claude(0, 0, 5, { mood: gcMood(g) }); X.restore(); if (!g.result) K.tag(cx, cy - 76); if (lost) K.sweat(cx + 32, cy - 44, 1.3, oT);
        for (let i = 0; i < 2; i++) { const q = (t * .7 + i * .5) % 1; K.puff(162 + Math.sin(q * 6) * 4, 410 - q * 40, 5 + q * 7, .8 * (1 - q)); } K.slab(150, 418, 26, 24, 6, '#c9ced6', '#8f9cb3', 3.5, 3); X.fillStyle = INK; X.fillRect(144, 426, 6, 4); }
    }
  };
  return g;
}

/* ───────── 9 ── DOUSE THE HOUSE: spray the flames ───────── */
function gcDouse(sp) {
  const k = Math.sqrt(sp), GRAV = 700, TF = .5;
  const wins = [{ x: 290, y: 200 }, { x: 510, y: 200 }, { x: 290, y: 350 }, { x: 510, y: 350 }];
  const fires = wins.map(w => ({ x: w.x, y: w.y + 20, hp: 1, steam: 0, sx: 0 }));
  const ps = [], steam = []; let spray = false, c = 0; const NZ = { x: 400, y: 520 };
  const FLAME = GCK.P('M0,-92 C26,-50 56,-30 50,4 C46,30 -46,30 -50,4 C-56,-30 -22,-50 0,-92 Z');
  const BGL = GCK.layer(() => {   // a street at dusk: skyline, a parked fire truck, a tree with a cat in it, and the burning brick house
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, '#2a1f55'); gr.addColorStop(.55, '#7b4a8a'); gr.addColorStop(1, '#ff9a5c'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 505);
    X.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { K.el(-OX + K.hash(i) * VW, 10 + K.hash(i + 40) * 200, 1.6, 1.6); X.fill(); }
    X.beginPath(); X.arc(130, 120, 30, 0, K.TAU); X.fillStyle = '#fff3b0'; X.fill(); X.fillStyle = '#7b4a8a'; K.el(142, 112, 27, 27); X.fill();
    for (let x = Math.floor(-OX / 70) * 70; x < W + OX; x += 70) { const i = Math.round(x / 70), h = 90 + K.hash(i + 8) * 120; X.fillStyle = '#4a2f70'; X.fillRect(x, 500 - h, 60, h); X.strokeStyle = '#3a2160'; X.lineWidth = 3; X.strokeRect(x, 500 - h, 60, h); X.fillStyle = '#ffd98a'; for (let k = 0; k < 8; k++) if (K.hash(i * 9 + k) > .55) X.fillRect(x + 8 + (k % 3) * 18, 500 - h + 12 + Math.floor(k / 3) * 24, 10, 12); }
    // street + curb
    X.fillStyle = INK; X.fillRect(-OX, 500, VW, 5); X.fillStyle = '#6c7a8a'; X.fillRect(-OX, 505, VW, 110); K.slab(-OX - 6, 506, VW + 12, 20, 4, '#c9ced6', '#8f9cb3', 4, 3);
    X.fillStyle = '#ffd23f'; for (let x = Math.floor(-OX / 120) * 120; x < W + OX; x += 120) K.rr(x + 20, 574, 70, 10, 4), X.fill();
    // the tree on the right
    K.slab(678, 300, 26, 205, 5, '#8a5a34', '#5a3a1a', 4, 4); for (const [x, y, r] of [[692, 262, 54], [650, 296, 40], [736, 292, 40], [692, 226, 38]]) { X.beginPath(); X.arc(x, y, r, 0, K.TAU); K.ink('#2f9a55', 4); } X.fillStyle = 'rgba(255,255,255,.2)'; K.el(676, 232, 20, 9, -.4); X.fill();
    K.slab(646, 330, 60, 8, 3, '#8a5a34', '#5a3a1a', 3, 2);
    // the fire truck
    X.save(); X.translate(8, 424); K.slab(0, 0, 150, 70, 10, '#e8434f', '#a8202c', 5, 6); K.slab(110, -22, 66, 92, 12, '#e8434f', '#a8202c', 5, 6); K.rr(120, -12, 46, 36, 6); K.ink('#bfe9ff', 3); X.fillStyle = '#fff'; X.fillRect(8, 30, 130, 8); K.slab(8, -16, 128, 10, 3, '#c9ced6', '#8f9cb3', 3, 2); for (let i = 0; i < 9; i++) { X.fillStyle = INK; X.fillRect(14 + i * 14, -16, 3, 10); }
    K.slab(0, 60, 170, 12, 4, '#3b3550', '#14101c', 3, 2); for (const x of [34, 134]) { X.beginPath(); X.arc(x, 74, 18, 0, K.TAU); K.ink('#3b3550', 4); X.beginPath(); X.arc(x, 74, 7, 0, K.TAU); K.ink('#c9ced6', 2); } X.restore();
  });
  const BRK = GCK.layer(() => {   // the house itself: baked on its own so the flames can burn in the windows in front of it
    const X = GCK.cx(), K = GCK;
    K.slab(200, 90, 400, 410, 8, '#c5513a', '#8a3a2a', 6, 8);
    X.save(); K.rr(200, 90, 400, 410, 8); X.clip(); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { X.fillStyle = 'rgba(20,16,28,.16)'; X.fillRect(206 + (i + j % 2 * .5) * 58, 98 + j * 52, 52, 4); X.fillStyle = 'rgba(20,16,28,.1)'; X.fillRect(206 + (i + j % 2 * .5) * 58 + 52, 98 + j * 52 - 48, 4, 48); } X.restore();
    K.slab(180, 62, 440, 36, 8, '#7a2f22', '#4a1a12', 6, 5); K.slab(520, 50, 40, 22, 4, '#8a3a2a', '#4a1a12', 4, 4);
    for (const [wx, wy] of [[290, 200], [510, 200], [290, 350], [510, 350]]) {
      K.rr(wx - 56, wy - 56, 112, 112, 6); X.fillStyle = '#2b1f35'; X.fill(); X.save(); K.rr(wx - 56, wy - 56, 112, 112, 6); X.clip(); const gr = X.createRadialGradient(wx, wy + 30, 8, wx, wy + 30, 90); gr.addColorStop(0, 'rgba(255,150,40,.55)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); X.fillStyle = gr; X.fillRect(wx - 56, wy - 56, 112, 112); X.restore();
      K.rr(wx - 56, wy - 56, 112, 112, 6); K.ink(null, 6, '#e8e0c8'); K.rr(wx - 56, wy - 56, 112, 112, 6); K.ink(null, 2.5);
      K.slab(wx - 68, wy + 56, 136, 14, 5, '#e8e0c8', '#b9b09a', 4, 3);
    }
    X.beginPath(); X.moveTo(355, 500); X.lineTo(355, 450); X.quadraticCurveTo(355, 418, 400, 418); X.quadraticCurveTo(445, 418, 445, 450); X.lineTo(445, 500); X.closePath(); K.ink('#9a6a3a', 5); X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(398, 424, 4, 76); X.beginPath(); X.arc(430, 462, 5, 0, K.TAU); K.ink('#ffd23f', 2);
    K.slab(340, 496, 120, 10, 3, '#c9ced6', '#8f9cb3', 3.5, 2);
  });
  const tenant = (i, x, y, mood, T, k) => {
    const X = ctx, K = GCK; X.save(); X.translate(x, y);
    K.arms(4.2, mood === 'sad' ? -(.5 + Math.sin(T * 9 + i) * .35) : -2.6, mood === 'sad' ? (.5 + Math.sin(T * 9 + i + 1) * .35) : 2.6, 1);
    claude(0, 0, 4.2, { mood });
    if (i === 0) { X.beginPath(); X.moveTo(-18, -38); X.quadraticCurveTo(-4, -78, 26, -58); X.lineTo(22, -38); X.closePath(); K.ink('#e8434f', 3); K.ball(26, -58, 5, '#fff', '#d8dfee', 2.5); }
    else if (i === 1) { for (let j = -1; j <= 1; j++) { K.slab(j * 13 - 5, -50, 10, 14, 5, '#ff9fcd', '#d9669f', 2.5, 2); } }
    else if (i === 2) { K.slab(-24, -52, 48, 18, 9, '#ffd23f', '#c99512', 3, 3); X.beginPath(); X.arc(0, -56, 12, Math.PI, 0); K.ink('#ffd23f', 3); }
    else { K.slab(-14, -64, 8, 28, 4, '#fff', '#d8dfee', 2.5, 2); K.slab(6, -64, 8, 28, 4, '#fff', '#d8dfee', 2.5, 2); }
    X.restore();
  };
  const g = {
    wide: true,
    cmd: 'EXTINGUISH!', hint: 'HOLD CLICK/SPACE + AIM AT THE FLAMES', thint: 'HOLD + DRAG ON THE FLAMES', dur: 6.2,
    down(p) { spray = true; }, up() { spray = false; },
    key(e) { if (e.code === 'Space') spray = true; }, keyup(e) { if (e.code === 'Space') spray = false; },
    update(dt) {
      const ts = dt * k; if (!g.result) c += ts;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]; p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt;
        let dead = p.l <= 0;
        for (const f of fires) if (f.hp > 0 && Math.hypot(p.x - f.x, p.y - f.y) < 46) { f.hp -= .045; f.steam += 1; dead = true; if (f.hp <= 0) { f.hp = 0; sfx.pop(); sfx.splat(); floatText('+1', f.x, f.y - 40, '#fff', 40); burst(f.x, f.y, '#4DB8FF', 12, 220); for (let j = 0; j < 8; j++) steam.push({ x: f.x + (Math.random() - .5) * 40, y: f.y, vy: -60 - Math.random() * 60, r: 14, a: 1 }); } break; }
        if (dead) { ps.splice(i, 1); }
      }
      for (let i = steam.length - 1; i >= 0; i--) { const s = steam[i]; s.y += s.vy * dt; s.r += dt * 30; s.a -= dt * 1.1; if (s.a <= 0) steam.splice(i, 1); }
      if (g.result) return;
      if (spray) {
        const tx = gcClamp(mouse.x, 120 - OX, 700 + OX), ty = gcClamp(mouse.y, 100, 450);
        for (let i = 0; i < Math.max(1, Math.round(ts * 120)); i++) {
          const jx = (Math.random() - .5) * 30, jy = (Math.random() - .5) * 30, dx = tx + jx - NZ.x, dy = ty + jy - NZ.y;
          const T2 = TF * (.8 + Math.random() * .4);
          ps.push({ x: NZ.x, y: NZ.y, vx: dx / T2, vy: dy / T2 - .5 * GRAV * T2, l: T2 + .15 });
        }
        if (Math.random() < .25) noise(.06, .025, 2500, 5000, 'bandpass');
      }
      let alive = 0;
      for (const f of fires) { if (f.hp > 0) { alive++; f.hp = Math.min(1, f.hp + dt * .035 * Math.sqrt(sp)); } }
      if (!alive) gcWin(g);
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      // the fire glow flickers behind the house; smoke rolls up from the roof
      const alive0 = fires.filter(f => f.hp > 0).length; if (alive0) { X.fillStyle = 'rgba(255,140,40,' + (.1 + .04 * Math.sin(t * 9)) * alive0 / 4 + ')'; K.el(400, 280, 330, 260); X.fill(); }
      for (let i = 0; i < 5 && alive0; i++) { const q = (t * .35 + i * .2) % 1; K.puff(540 + q * 120 + Math.sin(q * 5 + i) * 6, 56 - q * 12, 8 + q * 14, .75 * (1 - q), '#6b6280'); }
      // the cat in the tree keeps meowing at the firefighters
      K.cat(692, 338, .62, lost ? 'happy' : alive0 ? 'panic' : 'idle', [-.6, .5], t, 1);
      // the dalmatian-less cab: a siren on the truck roof
      for (const [sx, col] of [[120, '#ff4d5e'], [150, '#4DB8FF']]) { X.globalAlpha = Math.floor(t * 4 + (sx > 130 ? 1 : 0)) % 2 ? 1 : .35; K.rr(sx - 10 + 8, 392, 22, 14, 6); K.ink(col, 3); X.globalAlpha = 1; }
      BRK();
      wins.forEach((w, i) => { const f = fires[i], hp = f.hp, out = hp <= 0, mood = out || won ? 'happy' : lost ? 'sad' : 'sad';
        tenant(i, w.x, w.y + 50 - (won ? Math.abs(Math.sin(oT * 8 + i)) * 12 : 0), mood, t, i);
        if (lost) { X.fillStyle = 'rgba(20,16,28,.4)'; K.rr(w.x - 52, w.y - 52, 104, 104, 4); X.fill(); K.sweat(w.x + 30, w.y + 4, 1.2, oT + i * .3); } });
      for (const f of fires) {
        if (f.hp <= 0) continue;
        const s = (.35 + f.hp * .75) * (lost ? 1 + Math.min(.5, oT * .7) : 1), fl = Math.sin(now * 14 + f.x) * .08, mood = lost ? 'happy' : f.hp < .4 ? 'panic' : 'idle';
        X.save(); X.translate(f.x, f.y + 34); X.scale(s * (1 + fl), s * (1 - fl));
        K.cel(FLAME, '#ff7a1a', '#e8431a', -7, -4, 6); X.fillStyle = '#ffd23f'; K.el(0, 4, 28, 20); X.fill(); K.glint(FLAME, -14, -50, 8, 16, .35, .4);
        K.eye(-15, -8, 9, mood, [Math.sin(now * 3 + f.x) * .5, .6], now, 0); K.eye(15, -8, 9, mood, [Math.sin(now * 3 + f.x) * .5, .6], now, 1);
        X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath();
        if (mood === 'idle') { X.moveTo(-26, -22); X.lineTo(-6, -15); X.moveTo(26, -22); X.lineTo(6, -15); X.stroke(); X.beginPath(); X.moveTo(-8, 14); X.quadraticCurveTo(0, 8, 8, 14); X.stroke(); }
        else if (mood === 'happy') { X.moveTo(-10, 8); X.quadraticCurveTo(0, 22, 10, 8); X.stroke(); }
        else { K.el(0, 12, 5, 7); X.fillStyle = INK; X.fill(); K.sweat(24, -10, 1.6, now + f.x); }
        X.restore();
      }
      for (const s of steam) K.puff(s.x, s.y, s.r * .7, Math.max(0, s.a * .8), '#f4f7ff');
      for (const p of ps) { K.ball(p.x, p.y, 6, '#7fd6ff', '#2a8fcb', 2); }
      for (const f of fires) if (f.hp > 0 && f.hp < 1 && Math.floor(now * 12) % 3 === 0) { X.beginPath(); X.arc(f.x + Math.sin(now * 20 + f.x) * 30, f.y - 20 - (now * 90 + f.x) % 60, 3.5, 0, 7); X.fillStyle = '#fff'; X.fill(); }
      if (won) {   // a rainbow arches over the saved house, hearts float from the windows
        const q = gcClamp(oT * 2, 0, 1); X.save(); X.globalAlpha = q * .9; X.lineWidth = 11; X.lineCap = 'butt';
        ['#ff4d5e', '#ff9f4d', '#ffe14d', '#5CFF7A', '#4DB8FF', '#b58cff'].forEach((col, i) => { X.strokeStyle = col; X.beginPath(); X.arc(400, 250, 330 - i * 11, Math.PI + .08, Math.PI * 2 - .08 - (1 - q) * 1.5); X.stroke(); }); X.restore();
        wins.forEach((w, i) => { for (let j = 0; j < 2; j++) { const qq = ((oT - .1) * 1.1 + j * .5 + i * .13) % 1; if (oT > .1) K.heart(w.x + (j - .5) * 40, w.y - 20 - qq * 80, 1.1 - qq * .4, 1 - qq * qq); } });
      }
      // the hydrant (it shakes while it sprays) and Claude the firefighter next to it
      const sh = spray && !g.result ? Math.sin(now * 60) * 1.5 : 0;
      shadow(400, 546, 34, 8, .3); X.save(); X.translate(sh, 0);
      K.slab(380, 522, 40, 24, 5, '#e8434f', '#a8202c', 4, 3); K.slab(386, 504, 28, 22, 8, '#e8434f', '#a8202c', 4, 3); X.beginPath(); X.arc(400, 502, 14, Math.PI, 0); K.ink('#e8434f', 4); K.slab(366, 512, 14, 14, 4, '#c9ced6', '#8f9cb3', 3.5, 2); K.slab(420, 512, 14, 14, 4, '#c9ced6', '#8f9cb3', 3.5, 2); K.ball(400, 506, 6, '#ffd23f', '#c99512', 2.5); X.restore();
      { const cx = 326, cy = 534, aim = Math.atan2(gcClamp(mouse.y, 100, 450) - 500, gcClamp(mouse.x, 120 - OX, 700 + OX) - 380); shadow(cx, cy + 4, 34, 8, .3);
        X.save(); X.translate(cx, cy - (won ? Math.abs(Math.sin(oT * 9)) * 14 : 0)); K.arms(5, -1.6, won ? .4 + Math.sin(oT * 14) * .4 : spray ? 1.3 : 2.4, 1); claude(0, 0, 5, { mood: gcMood(g) });
        K.slab(-32, -54, 64, 18, 8, '#ffd23f', '#c99512', 3.5, 3); K.slab(-18, -66, 36, 18, 8, '#ffd23f', '#c99512', 3.5, 3); K.star(0, -57, 6, 3, 5, 0, '#e8434f', 2); X.restore(); if (!g.result) K.tag(cx, cy - 96); }
      const cx = gcClamp(mouse.x, 120 - OX, 700 + OX), cy = gcClamp(mouse.y, 100, 450);
      X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.arc(cx, cy, 16, 0, 7); X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 3; X.stroke();
    }
  };
  return g;
}

/* ───────── 10 ── PUTT FOR DOUGH: drag back and release ───────── */
function gcPutt(sp) {
  const k = Math.sqrt(sp), GX0 = 70 - OX, GX1 = 730 + OX, GY0 = 110, GY1 = 500;   // wider green; tee and hole move out only a bit so the shot stays reachable
  const ball = { x: 150 - OX * .3, y: 250 + Math.random() * 100, vx: 0, vy: 0, sunk: 0, rolling: false };
  const hole = { x: 600 + OX * .3 + Math.random() * 100, y: 190 + Math.random() * 220, r: 17 };
  const dxh = hole.x - ball.x, dyh = hole.y - ball.y, mid = .5;
  const bunk = { x: ball.x + dxh * mid + (Math.random() - .5) * 20, y: ball.y + dyh * mid + (Math.random() < .5 ? -1 : 1) * 10, rx: 62, ry: 48 };
  let drag = false, px = 0, py = 0, shot = false, still = 0, c = 0;
  const pullVec = () => { let dx = ball.x - px, dy = ball.y - py; const d = Math.hypot(dx, dy); if (d > 200) { dx *= 200 / d; dy *= 200 / d; } return [dx, dy, Math.min(200, d)]; };
  const TEE = { x: ball.x, y: ball.y };
  const BGL = GCK.layer(() => {   // a mini-golf course: sky and hills with a windmill, palms, wooden rails round a felt green with a sandy bunker, and a boardwalk
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 120); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 130);
    X.beginPath(); X.moveTo(-OX, 110); for (let x = -OX; x <= W + OX + 50; x += 50) X.lineTo(x, 84 - Math.sin(x * .012) * 14 - K.hash(Math.round(x / 50) + 7) * 10); X.lineTo(W + OX, 110); X.closePath(); X.fillStyle = '#a9dfc6'; X.fill();
    // windmill tower + two palms behind the top rail
    for (const [px, ph] of [[-OX + 50, 70], [W + OX - 50, 62], [560, 56]]) { X.save(); X.translate(px, 112); X.beginPath(); X.moveTo(-5, 0); X.quadraticCurveTo(6, -ph / 2, 2, -ph); X.lineWidth = 14; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = '#8a5a34'; X.stroke(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .6; X.beginPath(); X.moveTo(2, -ph); X.quadraticCurveTo(2 + Math.cos(a) * 22, -ph + Math.sin(a) * 22 - 8, 2 + Math.cos(a) * 40, -ph + Math.sin(a) * 36 + 10); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#2f9a55'; X.stroke(); } X.restore(); }
    // flower bed round the course and the boardwalk below
    X.fillStyle = '#87d19b'; X.fillRect(-OX, 112, VW, 400);
    X.fillStyle = INK; X.fillRect(-OX, 514, VW, 5); gr = X.createLinearGradient(0, 518, 0, 600); gr.addColorStop(0, '#c98443'); gr.addColorStop(1, '#8a5530'); X.fillStyle = gr; X.fillRect(-OX, 518, VW, 90);
    X.strokeStyle = 'rgba(60,30,10,.35)'; X.lineWidth = 3; for (let y = 540; y < 600; y += 24) { X.beginPath(); X.moveTo(-OX, y); X.lineTo(W + OX, y); X.stroke(); } for (let x = Math.floor(-OX / 90) * 90; x < W + OX; x += 90) { X.beginPath(); X.moveTo(x, 518); X.lineTo(x, 600); X.stroke(); }
    for (let i = 0; i < 24; i++) { const x = -OX + K.hash(i + 3) * VW, y = 470 + K.hash(i + 8) * 40; if (x > GX0 - 8 && x < GX1 + 8) continue; X.beginPath(); X.arc(x, 135 + K.hash(i + 60) * 360, 5, 0, K.TAU); K.ink(['#ff7aa8', '#fff', '#ffd23f'][i % 3], 2.5); }
    // the felt with mowing stripes, inside wooden rails
    K.slab(GX0 - 16, GY0 - 16, GX1 - GX0 + 32, GY1 - GY0 + 32, 14, '#d9944f', '#a5622c', 5, 6);
    X.beginPath(); X.moveTo(314, 108); X.lineTo(346, 108); X.lineTo(339, 85); X.lineTo(321, 85); X.closePath(); K.ink('#f7d297', 4); K.rr(324, 95, 12, 13, 3); K.ink('#8a5a34', 2.5);
    X.save(); K.rr(GX0, GY0, GX1 - GX0, GY1 - GY0, 6); X.clip(); gr = X.createLinearGradient(0, GY0, 0, GY1); gr.addColorStop(0, '#6ff07a'); gr.addColorStop(1, '#4fd65c'); X.fillStyle = gr; X.fillRect(GX0, GY0, GX1 - GX0, GY1 - GY0);
    for (let i = 0; i < Math.ceil((GX1 - GX0) / 66); i++) { X.fillStyle = i % 2 ? 'rgba(255,255,255,.1)' : 'rgba(20,16,28,.06)'; X.fillRect(GX0 + i * 66, GY0, 33, GY1 - GY0); }
    X.fillStyle = 'rgba(20,16,28,.22)'; X.fillRect(GX0, GY0, GX1 - GX0, 10); X.fillRect(GX0, GY0, 10, GY1 - GY0);
    X.restore(); K.rr(GX0, GY0, GX1 - GX0, GY1 - GY0, 6); K.ink(null, 3.5);
    // tee mat, sand bunker, the cup
    X.fillStyle = 'rgba(20,16,28,.14)'; K.el(TEE.x, TEE.y + 7, 20, 7); X.fill();
    K.el(bunk.x, bunk.y, bunk.rx, bunk.ry); K.ink('#f1d98a', 5); X.save(); K.el(bunk.x, bunk.y, bunk.rx, bunk.ry); X.clip(); X.strokeStyle = 'rgba(180,140,60,.45)'; X.lineWidth = 3; for (let i = 0; i < 6; i++) { X.beginPath(); X.ellipse(bunk.x, bunk.y, bunk.rx - 8 - i * 9, bunk.ry - 6 - i * 7, 0, 0, K.TAU); if (i % 2) X.stroke(); } X.restore();
    K.el(hole.x + 2, hole.y + 4, hole.r + 7, hole.r * .6 + 4); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill(); K.el(hole.x, hole.y, hole.r + 4, hole.r * .85 + 3); K.ink('#e8e0c8', 3.5); K.el(hole.x, hole.y + 1, hole.r, hole.r * .8); X.fillStyle = INK; X.fill();
  });
  let shotAt = -1;
  const duck = (x, y, s, mood, look, T) => {
    const X = ctx, K = GCK; X.save(); X.translate(x, y); X.scale(s, s); X.lineCap = 'round'; X.lineJoin = 'round';
    X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(22, -36); X.lineTo(22, -76); X.stroke(); X.strokeStyle = '#8a5a34'; X.lineWidth = 2.5; X.stroke();
    X.beginPath(); X.moveTo(22, -78); X.quadraticCurveTo(52, -78, 58, -58); X.quadraticCurveTo(22, -62, -14, -58); X.quadraticCurveTo(-8, -78, 22, -78); X.closePath(); K.ink('#ff4d6d', 3); X.save(); X.clip(); X.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(22, -80); X.lineTo(-14 + i * 18, -56); X.lineTo(-2 + i * 18, -56); X.closePath(); if (i % 2) X.fill(); } X.restore();
    const B = K.pEl(0, -16, 30, 20); K.cel(B, '#ffe14d', '#e0b020', 5, 4, 4); K.glint(B, -10, -26, 10, 4, .55, -.2);
    const H = K.pEl(20, -34, 15, 14); K.cel(H, '#ffe14d', '#e0b020', 3, 3, 4);
    X.beginPath(); X.moveTo(31, -32); X.quadraticCurveTo(48, -32, 46, -26); X.quadraticCurveTo(38, -23, 30, -26); X.closePath(); K.ink('#ff9f4d', 3);
    X.fillStyle = INK; K.rr(13, -42, 26, 8, 3); X.fill(); K.rr(9, -45, 8, 3, 1); X.fill();
    if (mood !== 'panic') { X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 2; X.beginPath(); X.moveTo(16, -41); X.lineTo(20, -41); X.stroke(); } else K.eye(24, -36, 6, 'panic', look, T, 0);
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); if (mood === 'sleep' || mood === 'idle') { X.moveTo(28, -26); X.lineTo(36, -27); } X.stroke();
    if (mood === 'idle') for (let i = 0; i < 2; i++) { const q = (T * .5 + i * .5) % 1; K.zee(8 - q * 6, -62 - q * 20, .6 + q * .4, 1 - q); }
    X.restore();
  };
  const g = {
    wide: true,
    cmd: 'PUTT!', hint: 'DRAG BACK FROM THE BALL, RELEASE', thint: 'DRAG BACK, LET GO', dur: 6.5,
    down(p) { if (shot || g.result) return; drag = true; px = p.x; py = p.y; },
    move(p) { px = p.x; py = p.y; },
    up(p) {
      if (!drag || shot || g.result) return; drag = false; px = p.x; py = p.y;
      const [dx, dy, d] = pullVec(); if (d < 22) return;
      shot = true; ball.rolling = true; ball.vx = dx / d * d * 3.5; ball.vy = dy / d * d * 3.5; sfx.hit(); burst(ball.x, ball.y, '#fff', 6, 140);
    },
    update(dt) {
      const ts = dt * k; c += ts;
      if (ball.sunk) { ball.sunk += dt * 2.2; ball.x += (hole.x - ball.x) * Math.min(1, 12 * dt); ball.y += (hole.y - ball.y) * Math.min(1, 12 * dt); return; }
      if (!ball.rolling) return;
      const inB = ((ball.x - bunk.x) / bunk.rx) ** 2 + ((ball.y - bunk.y) / bunk.ry) ** 2 < 1;
      const v = Math.hypot(ball.vx, ball.vy), dec = (230 + (inB ? 700 : 0)) * ts;
      if (v > 0) { const nv = Math.max(0, v - dec); ball.vx *= nv / v; ball.vy *= nv / v; }
      ball.x += ball.vx * ts; ball.y += ball.vy * ts;
      if (ball.x < GX0 + 8) { ball.x = GX0 + 8; ball.vx = Math.abs(ball.vx) * .7; sfx.click(); } if (ball.x > GX1 - 8) { ball.x = GX1 - 8; ball.vx = -Math.abs(ball.vx) * .7; sfx.click(); }
      if (ball.y < GY0 + 8) { ball.y = GY0 + 8; ball.vy = Math.abs(ball.vy) * .7; sfx.click(); } if (ball.y > GY1 - 8) { ball.y = GY1 - 8; ball.vy = -Math.abs(ball.vy) * .7; sfx.click(); }
      const hd = Math.hypot(ball.x - hole.x, ball.y - hole.y), sp2 = Math.hypot(ball.vx, ball.vy);
      if (hd < hole.r && sp2 < 330) { ball.sunk = .001; ball.rolling = false; gcWin(g); sfx.sparkle(); burst(hole.x, hole.y, '#FFE14D', 20, 300); ring(hole.x, hole.y, '#fff', 80); floatText('HOLE!', hole.x, hole.y - 50, '#FFE14D', 44); }
      else if (sp2 < 6) { still += ts; if (still > .25) { ball.rolling = false; gcLose(g); } } else still = 0;
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      if (shot && shotAt < 0) shotAt = now;
      BGL();
      for (let i = 0; i < 3; i++) K.cloud(((t * (7 + i * 3) + i * 290) % (VW + 300)) - OX - 120, 18 + i * 14, .55);
      X.save(); X.translate(330, 83); X.rotate(t * (won ? 5 : 1.1)); X.lineCap = 'round'; for (let i = 0; i < 4; i++) { X.rotate(Math.PI / 2); X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -26); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5.5; X.strokeStyle = '#fff7e8'; X.stroke(); } X.restore(); K.ball(330, 83, 5.5, '#e8434f', '#a8202c', 3);
      // the duck sunbathing in the bunker watches the ball
      const inB = ((ball.x - bunk.x) / bunk.rx) ** 2 + ((ball.y - bunk.y) / bunk.ry) ** 2 < 1.4;
      duck(bunk.x - 4, bunk.y + 14, 1.05, won ? 'idle' : lost ? 'smug' : (inB || ball.rolling && Math.hypot(ball.x - bunk.x, ball.y - bunk.y) < 130 ? 'panic' : 'idle'), [gcClamp((ball.x - bunk.x) / 60, -1, 1), gcClamp((ball.y - bunk.y) / 60, -1, 1)], t);
      // flag on the pole
      { const fx = hole.x + 2, fy = hole.y - 92, sag = lost ? Math.min(1, oT * 3) : 0; X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(fx, hole.y); X.lineTo(fx, fy); X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 4; X.stroke();
        X.beginPath(); X.moveTo(fx + 3, fy); X.quadraticCurveTo(fx + 26, fy - 4 + Math.sin(t * 6) * 4 + sag * 10, fx + 48, fy + 16 + sag * 20); X.quadraticCurveTo(fx + 26, fy + 30 + sag * 14, fx + 3, fy + 32); X.closePath(); K.ink('#e8434f', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; K.el(fx + 18, fy + 8, 12, 3, .2); X.fill(); K.ball(fx, fy - 4, 5, '#ffd23f', '#c99512', 2.5); }
      // aiming: a rubber band behind the ball and a dotted line where it will go
      if (drag && !shot) {
        const [dx, dy, d] = pullVec();
        K.line([[ball.x, ball.y], [ball.x - dx, ball.y - dy]], 5, '#ff4d9e'); K.ball(ball.x - dx, ball.y - dy, 8, '#ff4d9e', '#c42a74', 3);
        X.lineCap = 'round'; X.setLineDash([2, 14]); X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.moveTo(ball.x, ball.y); X.lineTo(ball.x + dx / (d || 1) * 130, ball.y + dy / (d || 1) * 130); X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 4; X.stroke(); X.setLineDash([]); X.lineCap = 'butt';
      }
      const sk = ball.sunk ? Math.max(.2, 1 - ball.sunk) : 1;
      shadow(ball.x + 3, ball.y + 7, 12 * sk, 5 * sk, .25); K.ball(ball.x, ball.y, 10 * sk, '#fff', '#d4d9e6', 3); X.fillStyle = 'rgba(190,200,220,.9)'; for (const [dx, dy] of [[-3, 1], [2, 3], [3, -2]]) { X.beginPath(); X.arc(ball.x + dx * sk, ball.y + dy * sk, 1.3 * sk, 0, 7); X.fill(); } X.fillStyle = '#fff'; X.beginPath(); X.arc(ball.x - 3.5 * sk, ball.y - 4 * sk, 2 * sk, 0, 7); X.fill();
      if (ball.sunk && ball.sunk > .1) { const q = gcClamp((ball.sunk - .1) * 1.6, 0, 1); X.save(); X.translate(hole.x, hole.y - 24 - q * 70); X.scale(q * 1.7, q * 1.7); K.slab(-18, -6, 36, 10, 3, '#ffd23f', '#c99512', 3.5, 2); X.beginPath(); X.moveTo(-14, -6); X.quadraticCurveTo(-18, -38, -6, -44); X.lineTo(6, -44); X.quadraticCurveTo(18, -38, 14, -6); X.closePath(); K.ink('#ffd23f', 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; K.el(-6, -30, 3, 9); X.fill(); X.restore(); for (let i = 0; i < 6; i++) { const a = oT * 4 + i * 1.05; K.star(hole.x + Math.cos(a) * 46, hole.y - 50 + Math.sin(a) * 18, 9, 4, 5, a, '#FFE14D', 2.5); } K.pop(oT, 'PLINK!', hole.x, hole.y - 130, 38, '#fff', INK); }
      // the power gauge lives on the boardwalk: a plate with a ball marker
      if (drag && !shot) { const [, , d] = pullVec(); K.slab(170, 523, 200, 26, 13, '#fff', '#d4d9e6', 4, 3); X.save(); K.rr(176, 529, 188, 14, 7); X.clip(); X.fillStyle = d > 160 ? '#ff4d4d' : '#FFE14D'; X.fillRect(176, 529, 188 * d / 200, 14); X.restore(); K.ball(176 + 188 * d / 200, 536, 8, '#fff', '#d4d9e6', 3); }
      // Claude with a putter and a golf bag
      { const cx = 70, cy = 534, age = shotAt >= 0 ? now - shotAt : 9, dsp = drag && !shot ? pullVec()[2] / 200 : 0, ang = .25 - dsp * .9 + (age < .3 ? Math.sin(age / .3 * Math.PI) * 1.1 : 0), hop = won ? Math.abs(Math.sin(oT * 9)) * 16 : 0;
        K.slab(116, 488, 30, 46, 8, '#4DB8FF', '#2a7fc0', 4, 4); for (let i = 0; i < 3; i++) { X.strokeStyle = INK; X.lineWidth = 8; X.beginPath(); X.moveTo(124 + i * 8, 490); X.lineTo(122 + i * 9, 470); X.stroke(); X.strokeStyle = ['#e8434f', '#ffd23f', '#c9ced6'][i]; X.lineWidth = 3.5; X.stroke(); }
        shadow(cx, cy + 4, 34, 8, .3); X.save(); X.translate(cx, cy - hop); K.arms(4.6, -2.6, won ? .4 + Math.sin(oT * 14) * .4 : 1.1, 1); claude(0, 0, 4.6, { mood: gcMood(g) }); X.restore();
        X.save(); X.translate(cx + 30, cy - hop - 24); X.rotate(ang); X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 66); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#c9ced6'; X.stroke(); K.slab(-4, 60, 26, 10, 3, '#c9ced6', '#8f9cb3', 3.5, 2); X.restore();
        if (!g.result) K.tag(cx, cy - 86); if (lost) K.sweat(cx + 34, cy - 54, 1.3, oT); if (won) for (let i = 0; i < 4; i++) { const q = ((oT - .1) * 1.2 + i * .25) % 1; if (oT > .1) K.heart(cx + (i - 1.5) * 24, cy - 90 - q * 80, 1.1 - q * .4, 1 - q * q); } }
    }
  };
  return g;
}

/* ───────── 11 ── PARKING PROWESS ───────── */
function gcPark(sp) {
  const k = Math.sqrt(sp), BX = [100, 250, 400, 550, 700], BW = 110, BT = 100, BB = 285, HW = 22, HL = 36;
  const free = Math.random() * 5 | 0, cols = ['#4DB8FF', '#ffd23f', '#5CFF7A', '#ff4d9e', '#b58cff'];
  const car = { x: 400, y: 495, a: -Math.PI / 2, v: 0 }; let ptr = false, px = 400, py = 300, stop = 0, c = 0, honk = 0, evalDone = false;
  const corners = () => { const f = [Math.cos(car.a), Math.sin(car.a)], r = [-f[1], f[0]], o = []; for (const sl of [-1, 0, 1]) for (const sw of [-1, 0, 1]) if (sl || sw) o.push([car.x + f[0] * sl * HL + r[0] * sw * HW, car.y + f[1] * sl * HL + r[1] * sw * HW]); return o; };
  const inRect = (p, x0, y0, x1, y1) => p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1;
  const crash = () => {
    const cs = corners();
    for (let i = 0; i < 5; i++) if (i !== free) { const nx = BX[i]; for (const p of cs) if (inRect(p, nx - 24, BT + 30, nx + 24, BB - 10)) return true; }
    for (const p of cs) if (p[1] < BT - 2 || p[0] < 8 - OX || p[0] > W - 8 + OX) return true;
    return false;
  };
  const inBay = () => corners().every(p => inRect(p, BX[free] - BW / 2 + 2, BT, BX[free] + BW / 2 - 2, BB + 8));
  const BGL = GCK.layer(() => {   // a car park: asphalt, painted bays with wheel stops, zebra aisles, a concrete wall with a yellow kerb
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 600); gr.addColorStop(0, '#7c8199'); gr.addColorStop(1, '#656a82'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 610);
    X.fillStyle = 'rgba(20,16,28,.07)'; for (let i = 0; i < 50; i++) { K.el(-OX + K.hash(i) * VW, 300 + K.hash(i + 30) * 300, 6 + K.hash(i + 5) * 22, 3 + K.hash(i + 9) * 6); X.fill(); }
    X.fillStyle = 'rgba(20,16,28,.2)'; K.el(300, 440, 36, 14); X.fill(); K.el(318, 432, 18, 9); X.fill();
    // the wall at the top, a yellow kerb
    K.slab(-OX - 10, 0, VW + 20, BT - 18, 4, '#aab1c8', '#838aa6', 4, 6); X.strokeStyle = 'rgba(20,16,28,.2)'; X.lineWidth = 3; for (let x = Math.floor(-OX / 90) * 90; x < W + OX; x += 90) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, BT - 20); X.stroke(); }
    K.slab(-OX - 10, BT - 20, VW + 20, 20, 5, '#ffd23f', '#c99512', 4, 4); X.fillStyle = INK; for (let x = Math.floor(-OX / 40) * 40; x < W + OX; x += 40) { X.beginPath(); X.moveTo(x, BT - 16); X.lineTo(x + 16, BT - 16); X.lineTo(x + 8, BT - 2); X.lineTo(x - 8, BT - 2); X.closePath(); X.fill(); }
    // bays
    for (let i = 0; i < 5; i++) {
      const x = BX[i]; X.strokeStyle = '#fff'; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - BW / 2, BT + 4); X.lineTo(x - BW / 2, BB); if (i === 4) { X.moveTo(x + BW / 2, BT + 4); X.lineTo(x + BW / 2, BB); } X.stroke(); X.lineCap = 'butt';
      K.slab(x - 26, BT + 4, 52, 10, 4, '#c9ced6', '#8f9cb3', 3, 2);
      if (i < 4) { const zx = x + 75; X.save(); K.rr(zx - 12, BT + 20, 24, 150, 4); X.clip(); X.fillStyle = 'rgba(255,210,63,.75)'; for (let j = -3; j < 12; j++) { X.beginPath(); X.moveTo(zx - 20, BT + 20 + j * 24); X.lineTo(zx + 20, BT + 4 + j * 24); X.lineTo(zx + 20, BT + 16 + j * 24); X.lineTo(zx - 20, BT + 32 + j * 24); X.fill(); } X.restore(); }
    }
    X.save(); X.translate(BX[free], 195); X.fillStyle = 'rgba(255,255,255,.9)'; X.font = '900 78px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineWidth = 9; X.strokeStyle = INK; X.lineJoin = 'round'; X.strokeText('P', 0, 0); X.fillText('P', 0, 0); X.restore();
    // painted arrows in the lane
    for (let i = 0; i < 4; i++) { const x = 130 + i * 180; X.save(); X.translate(x, 400 + (i % 2) * 40); X.beginPath(); X.moveTo(0, -22); X.lineTo(16, 0); X.lineTo(6, 0); X.lineTo(6, 22); X.lineTo(-6, 22); X.lineTo(-6, 0); X.lineTo(-16, 0); X.closePath(); X.fillStyle = 'rgba(255,255,255,.55)'; X.fill(); X.restore(); }
  });
  const carArt = (col, shade, win, eyes, mood, look, T) => {   // a car seen from above, nose towards -y (0,0 = centre, 44 x 72)
    const X = ctx, K = GCK;
    K.slab(-HW, -HL, HW * 2, HL * 2, 14, col, shade, 4, 5); K.slab(-HW + 5, -HL + 12, HW * 2 - 10, 18, 5, win, '#7ab8d8', 2.5, 2); K.slab(-HW + 6, HL - 22, HW * 2 - 12, 12, 4, win, '#7ab8d8', 2.5, 2);
    X.fillStyle = 'rgba(255,255,255,.28)'; K.rr(-HW + 5, -HL + 33, HW * 2 - 10, 6, 3); X.fill(); X.fillStyle = shade; K.rr(-HW + 7, -HL + 40, HW * 2 - 14, 18, 4); X.fill();
    for (const sx of [-1, 1]) { K.rr(sx * (HW + 3) - 3, -HL + 18, 6, 10, 3); K.ink(shade, 2); }
    if (eyes) { for (const sx of [-1, 1]) K.eye(sx * 11, -HL + 5, 6.5, mood, look, T, sx); }
    else for (const sx of [-1, 1]) { X.fillStyle = '#FFE14D'; K.rr(sx * 12 - 5, -HL - 1, 10, 7, 3); X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.stroke(); }
  };
  const pigeon = (x, y, s, T, dir) => {
    const X = ctx, K = GCK; X.save(); X.translate(x, y); X.scale(s * dir, s); const st = Math.sin(T * 9) * 3;
    X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(-4, -8); X.lineTo(-4 + st, 0); X.moveTo(6, -8); X.lineTo(6 - st, 0); X.stroke();
    K.ball(0, -22, 16, '#aab1c8', '#7d85a0', 3.5); X.beginPath(); X.moveTo(-10, -18); X.lineTo(-26, -12); X.lineTo(-12, -28); X.closePath(); K.ink('#7d85a0', 3);
    X.beginPath(); X.arc(14, -36, 9, 0, K.TAU); K.ink('#aab1c8', 3); X.beginPath(); X.moveTo(21, -38); X.lineTo(31, -35); X.lineTo(21, -33); X.closePath(); K.ink('#ffb347', 2.5); K.eye(16, -38, 3.6, 'idle', [1, 0], T, 0);
    X.fillStyle = '#4DB8FF'; K.el(8, -28, 6, 3, .3); X.fill(); X.restore();
  };
  const g = {
    wide: true,
    cmd: 'PARK!', hint: 'HOLD ↑ + STEER ← →, RELEASE TO STOP IN THE BAY', thint: 'HOLD TO DRIVE TO FINGER, LET GO TO STOP', dur: 6,
    down(p) { ptr = true; px = p.x; py = p.y; }, move(p) { px = p.x; py = p.y; }, up() { ptr = false; },
    update(dt) {
      const ts = dt * k; if (!g.result) c += ts; honk = Math.max(0, honk - dt);
      if (g.result) { car.v *= .9; return; }
      const up = keys.ArrowUp || keys.KeyW, dn = keys.ArrowDown || keys.KeyS; let st = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), drive = up || ptr;
      if (ptr && !st) { const dx = px - car.x, dy = py - car.y; if (Math.hypot(dx, dy) > 24) { let d = Math.atan2(dy, dx) - car.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; st = gcClamp(d * 2.5, -1, 1); } }
      const tv = drive ? 235 : dn ? -120 : 0; car.v += (tv - car.v) * Math.min(1, (tv ? 6 : 14) * ts);
      car.a += st * 2.3 * ts * (car.v / 235); car.x += Math.cos(car.a) * car.v * ts; car.y += Math.sin(car.a) * car.v * ts;
      car.y = Math.min(car.y, 560);
      if (crash()) { gcLose(g); honk = .8; sfx.thud(); shake(12, .35); burst(car.x, car.y, '#FFE14D', 14); return; }
      if (!drive && !dn && Math.abs(car.v) < 14 && car.y < 330) { stop += ts; if (stop > .25 && !evalDone) { evalDone = true; if (inBay()) { gcWin(g); sfx.sparkle(); burst(car.x, car.y, '#5CFF7A', 18); ring(car.x, car.y, '#fff', 100); floatText('NICE!', car.x, car.y - 70, '#5CFF7A', 44); } else { gcLose(g); sfx.boing(); } } } else stop = 0;
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      pigeon(((t * 26) % (VW + 120)) - OX - 40, 92, .72, t, 1);
      const sh = ['#2a7fc0', '#c99512', '#23a046', '#c42a74', '#7a5bc4'];
      for (let i = 0; i < 5; i++) {
        const x = BX[i];
        if (i === free) { const pls = .25 + .15 * Math.sin(now * 8); X.fillStyle = 'rgba(92,255,122,' + (won ? .55 : pls) + ')'; K.rr(x - BW / 2 + 5, BT + 4, BW - 10, BB - BT - 4, 8); X.fill(); X.strokeStyle = 'rgba(92,255,122,.9)'; X.lineWidth = 4; X.stroke(); if (won) K.rays(x, 190, 120, oT * 2, .35, '255,255,200'); }
        else {
          const near = honk > 0 || (Math.abs(car.x - x) < 120 && car.y < 330 && Math.floor(now * 4) % 2 === 0);
          X.save(); X.translate(x, BT + 73); X.rotate(Math.PI); X.scale(1, 1); X.scale(46 / (HW * 2), 76 / (HL * 2)); carArt(cols[i], sh[i], '#bfe9ff', true, won ? 'happy' : near ? 'panic' : 'idle', [gcClamp((car.x - x) / 120, -1, 1), gcClamp((car.y - BB) / 200, -.2, 1)], now + i); X.restore();
          if (near) { X.save(); X.translate(x, BT + 6); K.badge('BEEP!', 0, 0, 20, '#FFE14D', INK, 1, (i - 2) * .05); X.restore(); }
        }
      }
      // our car: orange, with Claude through the sunroof
      X.save(); X.translate(car.x, car.y); X.rotate(car.a + Math.PI / 2); X.fillStyle = 'rgba(20,16,28,.28)'; K.rr(-HW + 6, -HL + 7, HW * 2, HL * 2, 14); X.fill();
      const bump = lost ? Math.sin(oT * 40) * 1.5 : 0; X.translate(bump, 0);
      carArt(lost ? '#a8303c' : OR, lost ? '#701c28' : '#b4553a', '#bfe9ff', false, 'idle', [0, 0], now);
      if (lost) { X.fillStyle = INK; X.beginPath(); X.moveTo(-18, -HL + 2); X.lineTo(-6, -HL + 14); X.lineTo(-2, -HL + 4); X.fill(); }
      X.save(); X.translate(0, 8); X.scale(.9, .9); claude(0, 0, 1.9, { mood: gcMood(g) }); X.restore();
      if (won) { K.arms(1.9, -.5 - Math.sin(oT * 12) * .3, .5 + Math.sin(oT * 12) * .3, .8); }
      X.restore();
      if (lost) { for (let i = 0; i < 3; i++) { const q = (oT * 1.3 + i * .33) % 1; K.puff(car.x + (i - 1) * 10, car.y - 30 - q * 70, 8 + q * 12, 1 - q, '#7b7b8c'); } for (let j = 0; j < 4; j++) { const a = oT * 6 + j * 1.57; K.star(car.x + Math.cos(a) * 40, car.y - 52 + Math.sin(a) * 12, 10, 4, 5, a, '#FFE14D', 2.5); } }
      if (won) { for (let i = 0; i < 5; i++) { const q = ((oT - .05) * 1.4 + i * .2) % 1; if (oT > .05) K.heart(car.x + (i - 2) * 24, car.y - 40 - q * 90, 1.1 - q * .4, 1 - q * q); } K.pop(oT, 'PERFECT!', 400, 452, 56, '#FFE14D', INK); }
      if (lost) K.pop(oT, 'CRUNCH!', 400, 452, 56, '#ff4d5e', '#fff');
      // the attendant, with two glowing wands, and a cone
      { const cx = 70, cy = 534, wv = won ? 1.1 + Math.sin(oT * 14) * .5 : lost ? 2.4 : .7 + Math.sin(t * 3) * .25;
        shadow(cx, cy + 4, 34, 8, .3); X.beginPath(); X.moveTo(130, cy); X.lineTo(160, cy); X.lineTo(150, cy - 40); X.lineTo(140, cy - 40); X.closePath(); K.ink('#ff9f4d', 4); K.slab(128, cy - 6, 34, 8, 3, '#3b3550', '#14101c', 3, 2); X.fillStyle = '#fff'; X.fillRect(141, cy - 28, 8, 7);
        X.save(); X.translate(cx, cy - (won ? Math.abs(Math.sin(oT * 9)) * 14 : 0)); K.arms(4.4, -wv, wv, 1); claude(0, 0, 4.4, { mood: gcMood(g) });
        K.slab(-26, -44, 52, 12, 4, '#ff9f4d', '#c26a1f', 3, 2); X.fillStyle = '#fff'; X.fillRect(-26, -40, 52, 3); X.restore(); if (!g.result) K.tag(cx, cy - 92); }
    }
  };
  return g;
}

/* ───────── 12 ── GIFTED GOALIE: block the shots ───────── */
function gcGoalie(sp) {
  const k = Math.sqrt(sp), GL = 180, GR = 620, GYL = 285, need = sp > 1.5 ? 2 : 3, N = 3;
  const shots = []; for (let i = 0; i < N; i++) shots.push({ s: .35 + i * 1.45, tgt: (i === 0 ? (Math.random() < .5 ? 215 : 585) : 215 + Math.random() * 370), x0: 400, res: 0, ph: 0 });
  let gx = 400, tx = 400, c = 0, blocks = 0, done = 0, lastT = 0, lastR = 0, netRip = 0;
  const BGL = GCK.layer(() => {   // a floodlit stadium: stands of fans, ad boards, striped pitch, and the goal frame with its net
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#1d1840'); gr.addColorStop(1, '#4a2f8a'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, 300);
    X.fillStyle = '#fff'; for (let i = 0; i < 24; i++) { K.el(-OX + K.hash(i) * VW, 4 + K.hash(i + 40) * 56, 1.5, 1.5); X.fill(); }
    // the stands
    K.slab(-OX - 10, 124, VW + 20, 140, 4, '#5b4a9a', '#3f3178', 4, 5);
    for (let r = 0; r < 3; r++) { const y = 156 + r * 34; X.fillStyle = r % 2 ? '#4b3a88' : '#5b4a9a'; X.fillRect(-OX, y - 20, VW, 34); X.fillStyle = INK; X.fillRect(-OX, y + 12, VW, 3);
      for (let x = Math.floor(-OX / 28) * 28 - 8; x < W + OX + 8; x += 28) { const i = r * 300 + Math.round(x / 28), hx = x + 14 + (K.hash(i) - .5) * 8, skin = ['#f5c9a0', '#e0a070', '#c68a5a', '#8d5a3c'][Math.floor(K.hash(i + 5) * 4)], shirt = ['#ff4d6d', '#ffd23f', '#4DB8FF', '#5CFF7A', '#b58cff', '#fff'][Math.floor(K.hash(i + 9) * 6)];
        K.rr(hx - 11, y + 4, 22, 16, 7); K.ink(shirt, 2.5); X.beginPath(); X.arc(hx, y - 4, 10, 0, K.TAU); K.ink(skin, 3); X.fillStyle = INK; K.el(hx - 3.5, y - 5, 1.6, 2); X.fill(); K.el(hx + 3.5, y - 5, 1.6, 2); X.fill(); if (K.hash(i + 21) > .7) { X.beginPath(); X.arc(hx, y - 8, 10, Math.PI, 0); K.ink(shirt, 2.5); } } }
    // ad boards, the pitch
    for (let x = Math.floor(-OX / 100) * 100; x < W + OX; x += 100) { const i = Math.round(x / 100); K.slab(x, 262, 100, 26, 4, ['#ff4d9e', '#4DB8FF', '#ffd23f', '#5CFF7A'][((i % 4) + 4) % 4], ['#c42a74', '#2a7fc0', '#c99512', '#23a046'][((i % 4) + 4) % 4], 3.5, 3); X.fillStyle = 'rgba(255,255,255,.75)'; K.el(x + 24, 275, 6, 6); X.fill(); K.rr(x + 38, 271, 48, 8, 4); X.fill(); }
    X.fillStyle = INK; X.fillRect(-OX, 290, VW, 5); gr = X.createLinearGradient(0, 294, 0, 600); gr.addColorStop(0, '#3fbf5f'); gr.addColorStop(1, '#2f9a55'); X.fillStyle = gr; X.fillRect(-OX, 294, VW, 320);
    for (let i = 0; i < 9; i++) { X.fillStyle = 'rgba(255,255,255,.08)'; X.fillRect(-OX, 300 + i * 40, VW, 20); }
    X.strokeStyle = 'rgba(255,255,255,.6)'; X.lineWidth = 4; K.rr(120, 300, 560, 170, 6); X.stroke(); X.beginPath(); X.arc(400, 470, 70, Math.PI, 0); X.stroke();
    // the goal: net, posts, crossbar
    X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(GL, 160, GR - GL, GYL - 160); X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 2; for (let x = GL; x <= GR; x += 22) { X.beginPath(); X.moveTo(x, 160); X.lineTo(x, GYL); X.stroke(); } for (let y = 160; y <= GYL; y += 22) { X.beginPath(); X.moveTo(GL, y); X.lineTo(GR, y); X.stroke(); }
  });
  const goalFrame = () => { const X = ctx, K = GCK; X.lineCap = 'square'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(GL, GYL + 6); X.lineTo(GL, 160); X.lineTo(GR, 160); X.lineTo(GR, GYL + 6); X.lineWidth = 16; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#fff'; X.stroke(); X.lineCap = 'butt'; };
  const sball = (x, y, r) => { const X = ctx, K = GCK; K.ball(x, y, r, '#fff', '#d4d9e6', Math.max(2.5, r / 6)); X.fillStyle = INK; X.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * K.TAU / 5; X.lineTo(x + Math.cos(a) * r * .38, y + Math.sin(a) * r * .38); } X.closePath(); X.fill(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * K.TAU / 5; X.beginPath(); X.arc(x + Math.cos(a) * r * .85, y + Math.sin(a) * r * .85, r * .16, 0, K.TAU); X.fill(); } };
  const g = {
    wide: true,
    cmd: 'BLOCK!', hint: 'MOUSE OR ← → TO MOVE THE GOALIE', thint: 'DRAG LEFT / RIGHT', dur: 5.4,
    move(p) { tx = p.x; }, down(p) { tx = p.x; },
    update(dt) {
      const ts = dt * k; netRip = Math.max(0, netRip - dt * 2); lastT = Math.max(0, lastT - dt);
      const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0); if (kx) tx = gx + kx * 60;
      const mv = gcClamp(gcClamp(tx, 175, 625) - gx, -560 * ts, 560 * ts); gx += mv; g.vx = mv / (ts || 1);
      if (g.result) return; c += ts;
      for (const s of shots) {
        const u = c - s.s; if (u < 0 || s.res) continue;
        if (u >= .45 && !s.k) { s.k = 1; sfx.thud(); }
        if (u >= .45) {
          const f = (u - .45) / .6;
          if (f >= 1) {
            if (Math.abs(gx - s.tgt) < 62) { s.res = 1; blocks++; lastR = 1; sfx.hit(); burst(s.tgt, GYL - 10, '#5CFF7A', 14); ring(s.tgt, GYL - 10, '#fff', 70); floatText('+1', s.tgt, GYL - 60, '#5CFF7A', 40); } else { s.res = 2; netRip = 1; lastR = 2; sfx.miss(); shake(8, .25); burst(s.tgt, GYL - 40, '#fff', 10); }
            lastT = .8; done++; s.fx = s.tgt;
            if (blocks >= need) gcWin(g); else if (done - blocks > N - need) gcLose(g);
          }
        }
      }
    },
    draw(tm) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL();
      // fans wave glow sticks (they leap on a win, sag on a loss)
      for (let i = 0; i < 20; i++) { const fx = -OX + (i + .5) * VW / 20 + (K.hash(i + 300) - .5) * 20, fy = 150 + (i % 3) * 34 - (won ? Math.abs(Math.sin(oT * 9 + i)) * 12 : 0), a = Math.sin(tm * 5 + i * 1.3) * (lost ? .1 : .5); X.save(); X.translate(fx, fy); X.rotate(a); X.beginPath(); X.moveTo(0, 6); X.lineTo(0, -24); X.lineWidth = 9; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4.5; X.strokeStyle = lost ? '#8a8aa0' : ['#ff4d9e', '#5ee6ff', '#ffe14d', '#5CFF7A'][i % 4]; X.stroke(); X.restore(); }
      // the disco ball and its sweeping beams
      const cols = ['rgba(255,77,158,.2)', 'rgba(77,184,255,.2)', 'rgba(255,225,77,.2)'];
      for (let i = 0; i < 3; i++) { const sw = Math.sin(now * 2 + i * 2) * 120; X.fillStyle = won ? 'hsla(' + ((tm * 200 + i * 120) % 360 | 0) + ',95%,60%,.25)' : cols[i]; X.beginPath(); X.moveTo(612, 100); X.lineTo(612 - 330 + i * 190 + sw, 600); X.lineTo(612 - 230 + i * 190 + sw, 600); X.closePath(); X.fill(); }
      { const dy = lost ? Math.min(1, oT * 3) * 20 : 0; X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(612, 0); X.lineTo(612, 62 + dy); X.stroke(); K.ball(612, 84 + dy, 24, '#dfe4f2', '#9aa6bd', 4);
        X.save(); X.beginPath(); X.arc(612, 84 + dy, 24, 0, K.TAU); X.clip(); X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(612 + i * 8, 58 + dy); X.lineTo(612 + i * 8, 110 + dy); X.moveTo(588, 84 + dy + i * 8); X.lineTo(636, 84 + dy + i * 8); X.stroke(); } X.restore();
        for (let i = 0; i < 5; i++) { X.fillStyle = '#fff'; K.rr(600 + Math.sin(tm * 3 + i * 1.3) * 14, 74 + dy + (i * 7) % 24, 5, 5, 1.5); X.fill(); }
        if (lost) { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(604, 70 + dy); X.lineTo(614, 84 + dy); X.lineTo(608, 96 + dy); X.stroke(); } }
      // the jumbotron scoreboard: NEED n, three result bulbs
      K.slab(300, 62, 200, 62, 12, '#2a2438', '#14101c', 4, 4); X.fillStyle = '#0d0a18'; K.rr(308, 70, 184, 46, 8); X.fill();
      txt(window.t('NEED {n}', { n: need }), 400, 84, 20, '#FFE14D');
      for (let i = 0; i < N; i++) { X.beginPath(); X.arc(364 + i * 36, 104, 9, 0, K.TAU); K.ink(shots[i].res === 1 ? '#5CFF7A' : shots[i].res === 2 ? '#ff4d5e' : '#4a4558', 2.5); }
      // goal net ripples when a ball hits it
      X.save(); if (netRip > 0) { X.translate(Math.sin(tm * 50) * netRip * 3, 0); } X.fillStyle = 'rgba(255,77,77,' + netRip * .3 + ')'; X.fillRect(GL, 160, GR - GL, GYL - 160); X.restore();
      goalFrame();
      // the goalie: Claude with two huge mitts
      const lean = gcClamp((g.vx || 0) / 1400, -.5, .5), lastShot = shots.find(s => !s.res && c - s.s > .3), look = lastShot ? gcClamp((lastShot.tgt - gx) / 200, -1, 1) : 0;
      const up = won ? .5 + Math.sin(oT * 12) * .3 : lost ? 2.4 : .7 - look * .15;
      shadow(gx, GYL + 34, 44, 10, .3); X.save(); X.translate(gx, GYL + 30 - (won ? Math.abs(Math.sin(oT * 9)) * 18 : 0)); X.rotate(lean);
      K.arms(7, -(lost ? 2.4 : up), (lost ? 2.4 : up), 1);
      claude(0, 0, 7, { mood: gcMood(g) });
      for (const sx of [-1, 1]) { const an = sx * (lost ? 2.4 : up), L = 3.3 * 7 + .35 * 7 + 7; K.ball(sx * 6.6 * 7 + Math.sin(an) * L, -5.2 * 7 - Math.cos(an) * L, 15, sx < 0 ? '#ff4d9e' : '#4DB8FF', sx < 0 ? '#c42a74' : '#2a7fc0', 4); }
      X.fillStyle = INK; K.rr(-36, -46, 72, 10, 3); X.fill(); X.fillStyle = '#FFE14D'; K.rr(-34, -44, 68, 6, 2); X.fill();
      X.restore();
      if (!g.result) K.tag(gx, GYL + 30 - 98);
      if (lost) K.sweat(gx + 40, GYL - 50, 1.4, oT);
      if (won) for (let i = 0; i < 5; i++) { const q = ((oT - .1) * 1.2 + i * .2) % 1; if (oT > .1) K.heart(gx + (i - 2) * 26, GYL - 90 - q * 70, 1.1 - q * .4, 1 - q * q); }
      // the shots: a striker in blue kicks, the ball flies in
      for (const s of shots) {
        const u = c - s.s;
        if (u < 0) continue;
        let bx, by, r;
        if (u < .45) {
          const sw = u / .45, dr = s.tgt > 400 ? 1 : -1;
          shadow(400, 536, 34, 8, .3); X.save(); X.translate(400, 534); K.arms(5, -2.4, 2.4, 1); claude(0, 0, 5, { col: '#4DB8FF' }); X.restore();
          X.beginPath(); X.moveTo(380, 520); X.lineTo(380 - 20 + sw * 50, 540 - Math.sin(sw * Math.PI) * 24); X.lineWidth = 12; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#2a7fc0'; X.stroke(); X.lineCap = 'butt';
          bx = 400; by = 515; r = 20;
          X.beginPath(); X.moveTo(400 + dr * 54, 466); X.lineTo(400 + dr * 84, 490); X.lineTo(400 + dr * 54, 514); X.closePath(); K.ink('#ffd23f', 3.5);
        } else {
          const f = gcClamp((u - .45) / .6, 0, 1);
          if (s.res === 1) { const rf = gcClamp((u - 1.05) / .5, 0, 1); bx = s.tgt + (s.tgt > 400 ? 1 : -1) * rf * 90; by = GYL - 5 + rf * 160; r = 12 + rf * 6; if (rf >= 1 && u > 1.7) continue; }
          else { bx = 400 + (s.tgt - 400) * f; by = 510 + (GYL - 5 - 510) * f; r = 20 - 9 * f; }
          if (f < 1 && !s.res) { X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(bx, by); X.lineTo(bx - (s.tgt - 400) * (f * .25) * .5, by + 60 * (1 - f * .5)); X.stroke(); X.lineCap = 'butt'; }
        }
        shadow(bx + 3, by + r * .9, r, r * .35, .2); sball(bx, by, r);
      }
      if (won) for (const fx of [150, 650]) for (let i = 0; i < 9; i++) { const a = i / 9 * K.TAU + oT * 2, rd = 14 + Math.min(1, oT * 2.5) * 56; K.star(fx + Math.cos(a) * rd, 190 + Math.sin(a) * rd * .8, 10 - Math.min(1, oT) * 3, 4, 5, a * 2, ['#FFE14D', '#ff4d9e', '#5ee6ff', '#5CFF7A'][i % 4], 2.5); }
      if (lastT > 0) K.badge(lastR === 1 ? 'SAVE!' : 'GOAL!', 400, 214, 54, lastR === 1 ? '#5CFF7A' : '#ff4d5e', lastR === 1 ? INK : '#fff', .8 + .2 * K.outBack((.8 - lastT) / .25), lastR === 1 ? -.05 : .05, Math.min(1, lastT * 3));
    }
  };
  return g;
}

/* ───────── 13 ── NAIL CALL: hammer when the thumb is clear ───────── */
function gcNail(sp) {
  const k = Math.sqrt(sp), PY = 440, NX = 400, SEG = 50, om = 3.2 + sp * .8, ph = Math.random() * 6;
  let c = 0, hits = 0, hT = -1, cool = 0, thumbX = 400, ouch = 0, dust = 0, bump = 0;
  const headY = () => PY - (3 - hits) * SEG - 6;
  const tpos = () => NX + 205 * Math.sin(c * om + ph) * (1 + .12 * hits);
  const swing = () => { if (g.result || cool > 0 || hT >= 0) return; hT = 0; sfx.whoosh(false); };
  const THUMB = typeof Path2D === 'undefined' ? null : (() => { const p = new Path2D(); p.moveTo(-46, 250); p.arc(0, 250, 46, Math.PI, 0); p.lineTo(46, PY + 4); p.lineTo(-46, PY + 4); p.closePath(); return p; })();
  const BGL = GCK.layer(() => {   // a workshop: pegboard wall with painted tool outlines, a window, a shelf, and the workbench
    const X = GCK.cx(), K = GCK;
    let gr = X.createLinearGradient(0, 0, 0, PY); gr.addColorStop(0, '#f5c78a'); gr.addColorStop(1, '#ffdcaa'); X.fillStyle = gr; X.fillRect(-OX, 0, VW, PY);
    X.fillStyle = 'rgba(120,70,20,.4)'; for (let x = Math.floor(-OX / 24) * 24 + 8; x < W + OX; x += 24) for (let y = 12; y < PY - 4; y += 24) { K.el(x, y, 2.2, 2.2); X.fill(); }
    X.strokeStyle = 'rgba(120,70,20,.35)'; X.lineWidth = 6; X.lineCap = 'round'; X.lineJoin = 'round';   // painted tool outlines
    X.save(); X.translate(560, 190); X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 70); X.moveTo(-26, 0); X.lineTo(26, 0); X.lineTo(26, -20); X.lineTo(-26, -20); X.closePath(); X.stroke(); X.restore();
    X.save(); X.translate(690, 150); X.beginPath(); X.moveTo(0, 0); X.lineTo(70, 20); X.lineTo(70, 40); X.lineTo(0, 24); X.closePath(); X.moveTo(0, 12); X.lineTo(-30, 12); X.stroke(); X.restore();
    X.save(); X.translate(120, 120); X.beginPath(); X.arc(0, 0, 22, 0, K.TAU); X.moveTo(22, 0); X.lineTo(80, 0); X.stroke(); X.restore();
    // window
    K.rr(100, 180, 150, 120, 8); X.fillStyle = '#6fd0fb'; X.fill(); X.save(); K.rr(100, 180, 150, 120, 8); X.clip(); gr = X.createLinearGradient(0, 180, 0, 300); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(100, 180, 150, 120); X.fillStyle = '#87d19b'; K.el(150, 310, 100, 34); X.fill(); X.restore();
    K.rr(100, 180, 150, 120, 8); K.ink(null, 5); X.beginPath(); X.moveTo(175, 180); X.lineTo(175, 300); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#fff'; X.stroke(); K.slab(90, 296, 170, 12, 4, '#e3ac66', '#b98042', 4, 3);
    // shelf with paint cans + the radio
    K.slab(540, 330, 240, 12, 4, '#e3ac66', '#b98042', 4, 3); for (const [x, c1, c2] of [[560, '#ff4d6d', '#b8283a'], [596, '#4DB8FF', '#2a7fc0'], [630, '#5CFF7A', '#23a046']]) { K.slab(x - 14, 296, 28, 34, 4, '#c9ced6', '#8f9cb3', 3.5, 3); X.fillStyle = c1; X.fillRect(x - 13, 304, 26, 8); X.strokeStyle = INK; X.lineWidth = 2; X.strokeRect(x - 13, 304, 26, 8); }
    // the bench: thick top, front with drawers, a vise
    K.slab(-OX - 10, PY - 2, VW + 20, 36, 5, '#d9985c', '#a56a38', 5, 5); X.fillStyle = INK; X.fillRect(-OX, PY - 4, VW, 4);
    gr = X.createLinearGradient(0, PY + 34, 0, 600); gr.addColorStop(0, '#b97a3c'); gr.addColorStop(1, '#8a5530'); X.fillStyle = gr; X.fillRect(-OX, PY + 34, VW, 180);
    for (let x = Math.floor(-OX / 200) * 200 + 20; x < W + OX; x += 200) { K.slab(x, PY + 52, 170, 70, 6, '#d9944f', '#a5622c', 4, 4); K.ball(x + 85, PY + 87, 6, '#ffd23f', '#c99512', 2.5); }
    X.strokeStyle = 'rgba(60,30,10,.35)'; X.lineWidth = 2.5; for (let i = 0; i < 5; i++) { X.beginPath(); X.moveTo(-OX, PY + 6 + i * 6); X.lineTo(W + OX, PY + 6 + i * 6); X.stroke(); }
    K.slab(680, PY - 36, 80, 32, 6, '#8f9cb3', '#5f6b86', 4, 4); K.slab(706, PY - 54, 26, 20, 4, '#c9ced6', '#8f9cb3', 3.5, 2); X.beginPath(); X.moveTo(690, PY - 40); X.lineTo(690, PY - 66); X.lineWidth = 10; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#c9ced6'; X.stroke();
    X.fillStyle = 'rgba(255,240,200,.7)'; for (let i = 0; i < 20; i++) { K.el(-OX + K.hash(i + 2) * VW, PY + 8 + K.hash(i + 30) * 16, 4, 1.8); X.fill(); }
  });
  const radio = (x, y, T, won, lost) => {
    const X = ctx, K = GCK; K.slab(x - 30, y - 34, 60, 34, 8, '#4DB8FF', '#2a7fc0', 4, 4); X.beginPath(); X.arc(x - 14, y - 15, 10, 0, K.TAU); K.ink('#fff', 3); X.beginPath(); X.arc(x - 14, y - 15, 3, 0, K.TAU); X.fillStyle = INK; X.fill();
    for (let i = 0; i < 4; i++) { const h = lost ? 3 : 6 + Math.abs(Math.sin(T * (won ? 14 : 6) + i * 1.7)) * (won ? 16 : 11); X.fillStyle = ['#5CFF7A', '#ffe14d', '#ff9f4d', '#ff4d5e'][i]; K.rr(x + 2 + i * 7, y - 8 - h, 5, h, 2); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.5; X.stroke(); }
    X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(x + 18, y - 34); X.lineTo(x + 36, y - 58); X.stroke();
    if (!lost) for (let i = 0; i < 2; i++) { const q = (T * .6 + i * .5) % 1; X.save(); X.globalAlpha = 1 - q; X.translate(x - 20 + q * 20 + i * 12, y - 44 - q * 40); X.fillStyle = INK; X.beginPath(); X.ellipse(0, 0, 5, 3.6, -.4, 0, K.TAU); X.fill(); X.fillRect(3, -14, 2.5, 14); X.restore(); }
  };
  const g = {
    wide: true,
    cmd: 'HAMMER!', hint: 'CLICK/SPACE WHEN THE THUMB IS CLEAR', thint: 'TAP WHEN THE THUMB IS CLEAR', dur: 6,
    key(e) { if (e.code === 'Space') swing(); }, down() { swing(); },
    update(dt) {
      const ts = dt * k; if (!g.result) c += ts; thumbX = tpos(); cool = Math.max(0, cool - ts); ouch = Math.max(0, ouch - dt); dust = Math.max(0, dust - dt * 3); bump = Math.max(0, bump - dt * 4);
      if (hT >= 0) {
        hT += ts;
        if (hT >= .1 && !g.hitDone) {
          g.hitDone = true;
          if (Math.abs(thumbX - NX) < 78) { ouch = 1; gcLose(g); sfx.thud(); sfx.splat(); shake(12, .35); burst(thumbX, 330, '#ff5a5a', 14); ring(thumbX, 330, '#fff', 80); }
          else { hits++; dust = 1; bump = 1; sfx.hit(); sfx.thud(); sfx.blip(hits * 3); shake(6, .2); burst(NX, headY(), '#FFE14D', 10); floatText('+1', NX + 70, headY() - 40, '#5CFF7A', 38); if (hits >= 3) gcWin(g); }
        }
        if (hT >= .35) { hT = -1; g.hitDone = false; cool = .12; }
      }
    },
    draw(t) {
      GCK.use(); const K = GCK, X = ctx, oT = gcOut(g), won = oT >= 0 && g.result === 'win', lost = oT >= 0 && g.result === 'lose';
      BGL(); radio(700, 330, t, won, lost);
      const hy = headY(), dn = hT >= 0 && hT < .1;
      // the nail: a steel shaft and a cel-shaded head that sinks into the bench
      K.slab(NX - 8, hy, 16, PY - hy, 3, '#c9ced6', '#8f9cb3', 4, 3);
      K.slab(NX - 34, hy - 14 + bump * 5, 68, 16, 7, '#dfe4ee', '#9aa6bd', 4, 4);
      // Mr. Thumb: a face, a thumbnail, sweats when the hammer is up and he is near the nail
      const tx = thumbX, tTop = 220, danger = Math.abs(tx - NX) < 110 && !g.result, tm = (ouch > 0 || lost) ? 'bonk' : won ? 'happy' : danger && (hT >= 0 || hy < PY) ? 'panic' : 'idle';
      const col = ouch > 0 || lost ? '#ff6a5a' : '#ffbfa0', shd = ouch > 0 || lost ? '#c4303a' : '#e8987a', sw = lost ? 1.1 + Math.sin(oT * 20) * .03 : 1;
      shadow(tx, PY + 8, 78, 12, .25);
      X.save(); X.translate(tx, PY); X.scale(sw, sw); X.translate(-tx, -PY);
      K.el(tx, PY - 14, 68, 30); K.ink(shd, 5); X.save(); K.el(tx, PY - 14, 68, 30); X.clip(); K.el(tx - 6, PY - 20, 68, 30); X.fillStyle = col; X.fill(); X.restore(); X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); for (const dx of [-40, -14, 14, 40]) { X.moveTo(tx + dx, PY - 36); X.lineTo(tx + dx * 1.05, PY - 4); } X.stroke();
      X.save(); X.translate(tx, 0); K.cel(THUMB, col, shd, 8, 0, 5); K.glint(THUMB, -26, 270, 8, 30, .45, .1); X.restore();
      K.slab(tx - 24, tTop + 6, 48, 38, 12, '#fff0e0', '#f0d4bc', 3.5, 3); X.strokeStyle = shd; X.lineWidth = 3; X.beginPath(); X.moveTo(tx - 20, tTop + 106); X.lineTo(tx - 4, tTop + 100); X.moveTo(tx + 4, tTop + 100); X.lineTo(tx + 20, tTop + 106); X.stroke();
      const lk = [gcClamp((NX - tx) / 160, -1, 1), -.4]; K.eye(tx - 18, tTop + 77, 12, tm, lk, t, 0); K.eye(tx + 18, tTop + 77, 12, tm, lk, t, 1);
      X.fillStyle = 'rgba(255,110,140,.5)'; K.el(tx - 28, tTop + 98, 8, 4.5); X.fill(); K.el(tx + 28, tTop + 98, 8, 4.5); X.fill();
      X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath();
      if (tm === 'idle') { X.arc(tx, tTop + 118, 12, .25, Math.PI - .25); X.stroke(); X.beginPath(); X.moveTo(tx - 28, tTop + 60); X.lineTo(tx - 8, tTop + 66); X.moveTo(tx + 28, tTop + 60); X.lineTo(tx + 8, tTop + 66); X.stroke(); }
      else if (tm === 'panic') { K.el(tx, tTop + 122, 9, 8); X.fillStyle = INK; X.fill(); K.sweat(tx + 40, tTop + 60, 1.6, t); K.sweat(tx - 44, tTop + 70, 1.4, t + .4); X.beginPath(); X.moveTo(tx - 32, tTop + 56); X.lineTo(tx - 8, tTop + 62); X.moveTo(tx + 32, tTop + 56); X.lineTo(tx + 8, tTop + 62); X.stroke(); }
      else if (tm === 'happy') { X.arc(tx, tTop + 112, 14, .15, Math.PI - .15); X.stroke(); K.sweat(tx + 44, tTop + 66, 1.4, oT); }
      else { K.rr(tx - 20, tTop + 110, 40, 22, 8); K.ink('#fff', 3); X.beginPath(); X.moveTo(tx - 12, tTop + 110); X.lineTo(tx - 12, tTop + 132); X.moveTo(tx, tTop + 110); X.lineTo(tx, tTop + 132); X.moveTo(tx + 12, tTop + 110); X.lineTo(tx + 12, tTop + 132); X.lineWidth = 3; X.stroke(); }
      X.restore();
      if (tm === 'bonk') for (let j = 0; j < 4; j++) { const a = t * 6 + j * 1.57; K.star(tx + Math.cos(a) * 62, tTop - 4 + Math.sin(a) * 14, 11, 5, 5, a, '#FFE14D', 2.5); }
      if (won) for (let i = 0; i < 4; i++) { const q = ((oT - .1) * 1.2 + i * .25) % 1; if (oT > .1) K.heart(tx + (i - 1.5) * 26, tTop - 10 - q * 70, 1.1 - q * .4, 1 - q * q); }
      // the hammer: wooden handle, steel head with a claw
      let hh = hy - 190;
      if (hT >= 0) { const f = hT / .1; hh = hT < .1 ? hy - 190 + (190 - 28) * Math.min(1, f * f) : hy - 28 - Math.min(1, (hT - .1) / .25) * 150; }
      const hx = NX;
      X.lineCap = 'round'; X.beginPath(); X.moveTo(hx, hh); X.lineTo(hx + 190, hh - 260); X.lineWidth = 28; X.strokeStyle = INK; X.stroke(); X.lineWidth = 17; X.strokeStyle = '#d9a066'; X.stroke(); X.lineWidth = 4; X.strokeStyle = 'rgba(255,255,255,.4)'; X.beginPath(); X.moveTo(hx + 6, hh - 8); X.lineTo(hx + 180, hh - 250); X.stroke(); X.lineCap = 'butt';
      K.slab(hx - 62, hh - 36, 124, 56, 10, '#9aa6bd', '#6f7c96', 5, 6); X.fillStyle = 'rgba(255,255,255,.4)'; K.rr(hx - 54, hh - 30, 108, 9, 4); X.fill();
      X.beginPath(); X.moveTo(hx - 60, hh - 24); X.quadraticCurveTo(hx - 98, hh - 30, hx - 98, hh + 6); X.lineTo(hx - 82, hh + 8); X.quadraticCurveTo(hx - 82, hh - 8, hx - 60, hh - 8); X.closePath(); K.ink('#9aa6bd', 4);
      K.slab(hx - 62, hh + 16, 124, 8, 3, '#6f7c96', '#4f5a74', 3, 2);
      if (dust > 0) { K.star(NX, hy - 20, 50 * dust + 20, 14, 8, now * 4, '#FFE14D', 3); K.badge('BONK!', NX + 100, hy - 36, 34, '#fff', INK, .8 + .2 * K.outBack(1 - dust), .08, Math.min(1, dust * 3)); }
      if (ouch > 0) K.badge('AAAH!', tx, 168, 54, '#ff4d5e', '#fff', .8 + .2 * K.outBack(1 - ouch), -.05, Math.min(1, ouch * 3));
      // the nail rack: three nails turn gold as they go in
      K.slab(520, 66, 130, 40, 12, '#8a5a34', '#5a3a1a', 4, 4); for (let i = 0; i < 3; i++) { const x = 548 + i * 40, got = i < hits; X.beginPath(); X.moveTo(x, 78); X.lineTo(x, 100); X.lineWidth = 6; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = got ? '#5CFF7A' : '#8f9cb3'; X.stroke(); K.rr(x - 9, 74, 18, 7, 3); K.ink(got ? '#5CFF7A' : '#c9ced6', 2.5); }
      // Claude, in goggles, on the bench
      { const cx = 110, cy = PY - 4, up = hT >= 0 ? 1 : 0; shadow(cx, cy + 4, 46, 10, .3); X.save(); X.translate(cx, cy - (won ? Math.abs(Math.sin(oT * 9)) * 18 : 0)); K.arms(6, -2.5 + up * 1.9, won ? .4 + Math.sin(oT * 14) * .4 : 2.5 - up * 1.9, 1); claude(0, 0, 6, { mood: gcMood(g) });
        K.slab(-34, -64, 68, 12, 5, '#4DB8FF', '#2a7fc0', 3.5, 3); K.slab(-22, -78, 44, 18, 8, '#ffd23f', '#c99512', 3.5, 3); X.restore(); if (!g.result) K.tag(cx, cy - 104); if (lost) K.sweat(cx + 40, cy - 50, 1.4, oT); }
    }
  };
  return g;
}

reg('gc_sole', gcSole, 'MOVE');
reg('gc_rhino', gcRhino, 'OLE');
reg('gc_alley', gcAlley, 'SHOOT');
reg('gc_pinball', gcPinball, 'BOUNCE');
reg('gc_batter', gcBatter, 'SWING');
reg('gc_snap', gcSnap, 'SNAP');
reg('gc_trap', gcTrap, 'DROP');
reg('gc_douse', gcDouse, 'EXTINGUISH');
reg('gc_putt', gcPutt, 'PUTT');
reg('gc_park', gcPark, 'PARK');
reg('gc_goalie', gcGoalie, 'BLOCK');
reg('gc_nail', gcNail, 'HAMMER');
