'use strict';
/* Sports Day wave 1 - eight athletics microgames: HAMMER TOSS, SKI JUMP, SPARE ME, PRO CURLING,
   HIGH HOOPS, VOLLEY GIRL, JUMP FOREVER, STAR STRUCK.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), down/move/up/key/keyup}; g.result = 'win'|'lose'.
   Input rule: every game works with a touch (down/move/up with coordinates, move is only trusted while pressed)
   AND with mouse + keyboard.
   Art: the DUO look (docs/ART-STYLE.md). Every game is a place with a gag (a sheep at the hammer throw, penguin judges at the ski jump,
   a face-pulling pinsetter, curling aunties, a mascot in the gym, a crab at the beach, a dog at the park, an owl at the shooting gallery).
   The static scenes are baked once; all decorative motion is cosmetic and never calls Math.random (the games' own randomness is untouched). */
(function () {

const YEL = '#FFE14D', MINT = '#5CFF7A', RED = '#ff4d5e', CLAY = '#E8553A', GOLD = '#FFC93C';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const sdMood = (g) => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
/* end a game once: win = fanfare + confetti, lose = thud + shake; msg floats near the top */
function sdEnd(g, ok, msg, x, y) {
  if (g.result) return;
  g.result = ok ? 'win' : 'lose';
  if (ok) { sfx.coin(); sfx.sparkle(); confetti(x == null ? 400 : x, y == null ? 300 : y, 36); ring(x == null ? 400 : x, y == null ? 300 : y, '#fff', 110); floatText(msg, 400, 190, YEL, 46); }
  else { sfx.miss(); sfx.thud(); shake(8, .25); floatText(msg, 400, 190, RED, 44); }
}

/* ───────────── art kit: a local copy of the DUO drawing helpers. Everything draws on X, which can be swapped for an offscreen context
   so the same code bakes the static scene once. Nothing here calls Math.random. ───────────── */
const SDK = (() => {
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
  const K = { TAU };
  K.cx = () => X;
  const cl = K.clamp = clamp;
  K.ease = k => { k = cl(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = cl(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  K.lerp = lerp;
  K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  K.dk = (c, k = .78) => { const n = parseInt(c.slice(1), 16); return `rgb(${(n >> 16 & 255) * k | 0},${(n >> 8 & 255) * k | 0},${(n & 255) * k | 0})`; };
  K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
  const BK = {}; K.baked = (key, fn) => BK[key] || (BK[key] = K.bake(W, H, fn));
  /* the outro clock: set in update() (shoot.js draws once), with a fallback in draw() */
  K.outro = () => { let t0 = -1; return { mark(g) { if (g.result && t0 < 0) t0 = now; }, t(g) { if (!g.result) return 0; if (t0 < 0) t0 = now; return Math.max(0, now - t0); } }; };
  const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const mkRR = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  const PR = {}; K.rrP = (x, y, w, h, r) => { const k = x + ',' + y + ',' + w + ',' + h + ',' + r; return PR[k] || (PR[k] = mkRR(x, y, w, h, r)); };
  const PE = {}; K.elP = (x, y, rx, ry) => { const k = x + ',' + y + ',' + rx + ',' + ry; if (!PE[k]) { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); PE[k] = p; } return PE[k]; };
  const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const inkP = K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  const cel = K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  K.circ = (x, y, r, base, shade, o = 4) => { const p = K.elP(x, y, r, r); cel(p, base, shade, r * .22, r * .26, o); return p; };
  K.poly = (pts, fill, o = 4) => { X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.closePath(); ink(fill, o); };
  K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  K.curve = (a, b, c, d, e, f, w, col) => { X.beginPath(); X.moveTo(a, b); X.quadraticCurveTo(c, d, e, f); X.lineCap = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
  K.vg = (y0, y1, stops) => { const g = X.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
  K.hills = (L, R, base, amp, freq, ph, fill, line, lw = 3, y2 = base + 4) => {
    X.beginPath(); X.moveTo(L, y2); for (let x = L; x <= R + 8; x += 8) X.lineTo(x, base - amp * (.55 + .45 * Math.sin(x * freq + ph) * Math.cos(x * freq * .37 + ph * 2)));
    X.lineTo(R, y2); X.closePath(); X.fillStyle = fill; X.fill(); if (line) { X.lineWidth = lw; X.strokeStyle = line; X.lineJoin = 'round'; X.stroke(); }
  };
  K.horizon = (y, L, R, w = 4) => { X.fillStyle = INK; X.fillRect(L, y - w / 2, R - L, w); };
  K.daySky = (h) => { X.fillStyle = K.vg(0, h, [[0, '#3fb0ff'], [.55, '#8fdcff'], [1, '#e6fbff']]); X.fillRect(0, 0, W, h); };
  K.heart = (x, y, s, a = 1) => {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  };
  K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
  /* blocky Claude arms (hippo.js): origin at Claude's feet, drawn before claude(); an = 0 points up, + swings right */
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
  /* sports gear for Claude (origin = feet): a headband, goggles */
  K.band = (x, y, u, col = RED, T = 0) => {
    const ol = Math.max(2.5, u * .4); X.fillStyle = INK; X.fillRect(x - 6 * u - ol, y - 8.9 * u - ol, 12 * u + ol * 2, 1.25 * u + ol * 2);
    X.fillStyle = col; X.fillRect(x - 6 * u, y - 8.9 * u, 12 * u, 1.25 * u); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x - 6 * u, y - 8.9 * u, 12 * u, .35 * u);
    for (const d of [0, 1]) { X.save(); X.translate(x + 6 * u, y - 8.3 * u); X.rotate(.5 + d * .5 + Math.sin(T * 9 + d) * .12); X.fillStyle = INK; X.fillRect(-ol, -ol, 3 * u + ol * 2, .9 * u + ol * 2); X.fillStyle = col; X.fillRect(0, 0, 3 * u, .9 * u); X.restore(); }
  };
  K.goggles = (x, y, u) => {
    const ey = y - 6.2 * u, r = 1.9 * u;
    X.fillStyle = INK; X.fillRect(x - 6.6 * u, ey - .35 * u, 13.2 * u, .7 * u);
    for (const sx of [-1, 1]) { rr(x + sx * 2.8 * u - r, ey - r, r * 2, r * 2, r * .5); ink('rgba(159,227,255,.55)', Math.max(2, u * .5)); X.fillStyle = 'rgba(255,255,255,.7)'; el(x + sx * 2.8 * u - r * .35, ey - r * .4, r * .35, r * .2, -.5); X.fill(); }
  };
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
  /* a little person with a face (judges, kids, aunties): feet at (x, y). o: {shirt, pants, skin, hat, hair, shades, mood, look, la, ra, bob} (arm angle: 0 down, PI/2 out, PI up) */
  K.person = (x, y, s, o = {}) => {
    const skin = o.skin || '#ffcba4', skinS = o.skinS || K.dk(skin, .85), shirt = o.shirt || '#7A3FD1', T = o.T == null ? now : o.T;
    X.save(); X.translate(x, y - (o.bob || 0)); X.scale(s, s);
    for (const sx of [-1, 1]) { rr(sx * 7.5 - 5, -17, 10, 17, 4); ink(o.pants || '#3b3a5c', 3); }
    const arm = (sx, a) => { if (a == null) return; X.save(); X.translate(sx * 12, -45); X.rotate(-sx * a); rr(-4.5, -3, 9, 27, 4.5); ink(o.sleeve || skin, 3); el(0, 26, 5.5, 5.5); ink(skin, 3); X.restore(); };
    arm(-1, o.la == null ? .15 : o.la); arm(1, o.ra == null ? .15 : o.ra);
    cel(K.rrP(-14, -57, 28, 42, 12), shirt, K.dk(shirt, .76), 4, 3, 3.5);
    if (o.stripe) { X.save(); X.clip(K.rrP(-14, -57, 28, 42, 12)); X.fillStyle = o.stripe; X.fillRect(-16, -40, 32, 7); X.restore(); }
    if (o.scarf) { rr(-15, -60, 30, 9, 4.5); ink(o.scarf, 3); }
    cel(K.elP(0, -75, 18, 17), skin, skinS, 3, 3, 3.5);
    X.fillStyle = 'rgba(255,120,120,.28)'; for (const sx of [-1, 1]) { el(sx * 11, -69, 4.5, 3, 0); X.fill(); }
    const m = o.mood || 'idle', look = o.look || [0, 0];
    if (o.shades) { for (const sx of [-1, 1]) { rr(sx * 7 - 6.5, -80, 13, 9, 3); ink('#2b2640', 2.5); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(sx * 7 - 4, -78, 4, 2); } X.fillStyle = INK; X.fillRect(-2, -78, 4, 3); }
    else { K.eye(-7, -76, 4.8, m === 'cheer' ? 'happy' : m, look, T, 0); K.eye(7, -76, 4.8, m === 'cheer' ? 'happy' : m, look, T, 1); }
    X.strokeStyle = INK; X.lineWidth = 2.6; X.lineCap = 'round'; X.beginPath();
    if (m === 'happy' || m === 'cheer') { X.moveTo(-6, -66); X.quadraticCurveTo(0, -57, 6, -66); X.stroke(); X.fillStyle = '#ff7a9a'; X.beginPath(); X.moveTo(-5, -65); X.quadraticCurveTo(0, -58, 5, -65); X.fill(); }
    else if (m === 'panic' || m === 'bonk') { X.stroke(); el(0, -64, 3.4, 4.6); ink('#7a1f2a', 2); }
    else { X.moveTo(-4, -65); X.quadraticCurveTo(0, -62, 4, -65); X.stroke(); }
    if (o.hat === 'cap') { X.beginPath(); X.ellipse(0, -80, 19, 13, 0, Math.PI, 0); ink(o.hatc || '#2f4fd6', 3); rr(-3, -84, 26, 6, 3); ink(o.hatc || '#2f4fd6', 2.5); }
    else if (o.hat === 'knit') { X.beginPath(); X.ellipse(0, -81, 19, 14, 0, Math.PI, 0); ink(o.hatc || '#ff5c8a', 3); rr(-19, -84, 38, 8, 4); ink(K.dk(o.hatc || '#ff5c8a', .85), 3); el(0, -97, 5.5, 5.5); ink('#fff', 2.5); }
    else if (o.hat === 'visor') { rr(-19, -87, 38, 8, 4); ink(o.hatc || '#fff', 3); rr(-3, -84, 24, 5, 2.5); ink(o.hatc || '#fff', 2.5); }
    else if (o.hair) { X.beginPath(); X.ellipse(0, -80, 18.5, 12, 0, Math.PI, 0); ink(o.hair, 3); if (o.bun) { el(0, -97, 7, 7); ink(o.hair, 3); } if (o.pig) for (const sx of [-1, 1]) { el(sx * 21, -72, 5, 9); ink(o.hair, 3); } }
    X.restore();
  };
  K.cloud = (x, y, s, col = '#e4f5ff') => {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = col; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
  };
  K.sun = (sx, sy, T) => {
    X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 40); X.lineTo(8, 40); X.lineTo(0, 70); X.fill(); }
    X.restore(); X.beginPath(); X.arc(sx, sy, 32, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 10, sy - 10, 12, 8, -.6); X.fill();
  };
  K.shade = (x, y, rx, ry, a = .25) => { X.fillStyle = `rgba(20,16,28,${a})`; el(x, y, rx, ry); X.fill(); };
  K.puff = (x, y, r, a = 1, col = '#f4ead8') => {
    if (a <= 0) return; X.save(); X.globalAlpha = cl(a, 0, 1);
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
  /* feedback word: a coloured slab with a gloss and a drop shadow (hippo badge) */
  K.badge = (s, x, y, size, bg, fg, sc = 1, rot = 0) => {
    s = typeof t === 'function' ? t(s) : s; X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = X.measureText(s).width + size * .9, h = size * 1.25;
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .3); X.fill();
    rr(-w / 2, -h / 2, w, h, h * .3); ink(bg, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + 6, -h / 2 + 5, w - 12, h * .2, h * .1); X.fill();
    X.fillStyle = fg; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, 0, size * .05); X.restore();
  };
  /* a name tag with a little pointer (hippo pill) */
  K.tag = (x, y, label, col = '#ffe14d', up = false) => {
    X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = typeof t === 'function' ? t(label) : label, w = Math.min(170, X.measureText(s).width + 26), py = up ? -1 : 1;
    X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
    rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
    txt(label, x, y + 1, 17, INK, 'center', w - 14);
  };
  /* a themed gauge: an inked pill with a painted green zone, a thin fill and a knob (replaces the old flat bar) */
  K.meter = (x, y, w, h, v, col, label, z0, z1, T) => {
    X.save(); X.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 6, w, h, h / 2); X.fill(); X.restore();
    rr(x, y, w, h, h / 2); ink('#fff', 4);
    X.save(); rr(x + 2, y + 2, w - 4, h - 4, h / 2 - 2); X.clip();
    if (z0 != null) { X.fillStyle = MINT; X.fillRect(x + w * z0, y, w * (z1 - z0), h); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x + w * z0, y + 3, w * (z1 - z0), h * .22); }
    X.fillStyle = col; rr(x + 4, y + h * .32, Math.max(0, (w - 8) * cl(v, 0, 1)), h * .36, h * .18); X.fill();
    X.restore();
    if (label) txt(label, x + w / 2, y + h / 2 + 1, Math.round(h * .62), '#fff', 'center', w - 80);
    const kx = x + w * cl(v, 0, 1); X.beginPath(); X.arc(kx, y + h / 2, h * .46, 0, TAU); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.55)'; el(kx - 3, y + h / 2 - 4, 4, 2.4, -.5); X.fill();
  };
  return K;
})();
const K = SDK;
/* the Claude hero's finishing touches, drawn around claude(): shadow, arms then body then headband */
function sdHero(x, y, u, g, o) {
  o = o || {}; const X = ctx;
  K.shade(x, y + 3, 7.4 * u, 1.5 * u, .3);
  X.save(); X.translate(x, y); K.arms(u, o.la == null ? -.45 : o.la, o.ra == null ? .45 : o.ra, o.k == null ? 1 : o.k, o.col || OR); X.restore();
  claude(x, y, u, { mood: o.mood !== undefined ? o.mood : sdMood(g), col: o.col });
  if (o.band !== false) K.band(x, y, u, o.band || RED, now);
}

/* ═══════════════════ 1 HAMMER TOSS: hold to spin up, release so the throw lands in the zone ═══════════════════
   The athletics field: stands and floodlights far away, a throwing circle, two pennants on the zone, a sheep that graze-photobombs and a judge with scorecards. */
function hmBake() {
  const X = K.cx();
  K.daySky(392);
  K.hills(0, W, 372, 34, .008, 2, '#a9dfc6', null);
  K.hills(0, W, 384, 20, .013, 4, '#87d19b', '#4f9a6a', 3);
  // the far stands: a canopy, three rows of cheering dots
  K.rr(22, 312, 756, 76, 16); K.ink('#c9d0fb', 3, '#7b80c6');
  for (let r = 0; r < 3; r++) for (let i = 0; i < 38; i++) { const x = 42 + i * 19.6 + (r % 2) * 9, y = 340 + r * 16; if (x > 770) continue; X.beginPath(); X.arc(x, y, 6, 0, K.TAU); X.fillStyle = ['#ff4d9e', '#ffe14d', '#4DB8FF', '#5cff7a', '#fff', '#D97757', '#c78bff'][Math.floor(K.hash(i * 7 + r * 31) * 7)]; X.fill(); X.lineWidth = 2; X.strokeStyle = '#7b80c6'; X.stroke(); }
  K.rr(14, 306, 772, 16, 8); K.ink('#ff7a3d', 3); X.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 20; i++) X.fillRect(30 + i * 38, 309, 18, 10);
  // floodlight towers
  for (const fx of [52, 748]) { K.line([[fx, 392], [fx, 262]], 5, '#8f88a6'); K.rr(fx - 22, 236, 44, 28, 6); K.ink('#d8d4e6', 3); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { X.beginPath(); X.arc(fx - 12 + i * 12, 243 + j * 13, 4.5, 0, K.TAU); K.ink('#fff3a0', 1.5); } }
  // the pitch
  X.fillStyle = K.vg(392, 600, [[0, '#8fdc5c'], [1, '#5fb944']]); X.fillRect(0, 392, W, 208);
  X.fillStyle = 'rgba(255,255,255,.11)'; for (let i = 0; i < 8; i += 2) X.fillRect(i * 100, 392, 100, 208);
  X.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 1; i < 6; i++) X.fillRect(150 + i / 6 * 580 - 1, 392, 2.5, 208);
  K.horizon(392, 0, W);
  for (let i = 0; i < 18; i++) { const hx = (i * 83 + 20) % 780, hy = 410 + (i * 47) % 170; X.fillStyle = '#3f8f35'; X.fillRect(hx, hy, 2.5, 9); X.fillRect(hx + 5, hy + 2, 2.5, 7); X.fillRect(hx - 5, hy + 2, 2.5, 7); }
  // the throwing circle (sand ring with a white rim)
  K.el(130, 523, 88, 28); K.ink('#e8cf8d', 4); K.el(130, 523, 70, 20); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke();
}
function sdHammer(sp) {
  const rs = Math.sqrt(sp), rate = .55 * rs, zc = .55 + Math.random() * .3, zw = .17 / Math.pow(rs, .4);
  const DX = p => 150 + p * 580;
  let c = 0, held = false, hold = 0, spin = 0, fly = null;
  const O = K.outro();
  const power = () => Math.min(1, hold * rate);
  const start = () => { if (g.result || fly || held) return; held = true; hold = 0; sfx.click(); };
  const release = () => {
    if (!held) return; held = false;
    const p = power(); if (p < .12) { hold = 0; return; }
    fly = { t: 0, p }; sfx.whoosh(); sfx.thud();
    const ok = Math.abs(p - zc) <= zw / 2;
    sdEnd(g, ok, ok ? 'GREAT THROW!' : p < zc ? 'TOO SHORT!' : 'TOO FAR!', DX(p), 480);
  };
  const g = {
    cmd: 'THROW!', hint: 'HOLD SPACE / MOUSE, RELEASE IN THE GREEN ZONE', thint: 'HOLD, THEN LET GO IN THE GREEN ZONE', dur: 5.6,
    key(e) { if (!e.repeat && e.code === 'Space') start(); },
    keyup(e) { if (e.code === 'Space') release(); },
    down() { start(); },
    up() { release(); },
    update(dt) {
      O.mark(g);
      c += dt;
      if (held) { hold += dt; spin += dt * (4 + power() * 24); } else if (!fly) spin += dt * 2;
      if (fly) fly.t += dt;
    },
    draw(t) {
      const X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose';
      X.drawImage(K.baked('hm', hmBake), 0, 0);
      K.sun(612, 150, t);
      for (let i = 0; i < 3; i++) K.cloud(((now * (6 + i * 3) + i * 330) % 1000) - 150, 88 + i * 40, .9 + i * .15);
      // the green zone: a painted strip with a pennant on each post
      const zx = DX(zc - zw / 2), zx2 = DX(zc + zw / 2);
      X.fillStyle = 'rgba(255,225,77,.5)'; X.fillRect(zx, 392, zx2 - zx, 208);
      X.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 6; i++) { const yy = 410 + i * 34 + (now * 20 % 34); if (yy < 590) X.fillRect(zx + 6, yy, zx2 - zx - 12, 6); }
      for (const [px, sd] of [[zx, 1], [zx2, -1]]) {
        K.rr(px - 4, 340, 8, 256, 4); K.ink('#fff', 3);
        const wv = Math.sin(now * 5 + px) * 4; X.beginPath(); X.moveTo(px + 4, 340); X.quadraticCurveTo(px + 20 * sd + 4, 346 + wv, px + 34 * sd + 4, 354 + wv); X.quadraticCurveTo(px + 20 * sd + 4, 362 + wv, px + 4, 368); X.closePath(); K.ink(MINT, 3);
      }
      // the sheep grazing (hops when the hammer lands), and the judge
      const hop = fly ? Math.abs(Math.sin(Math.min(fly.t * 6, 3.14))) * 10 : 0, sx = 330, sy = 440 - hop;
      K.shade(sx, 442, 30, 6, .22);
      for (const lx of [-14, 12]) { K.rr(sx + lx - 3, sy - 8, 6, 14, 3); K.ink('#5b4a42', 2.5); }
      X.beginPath(); for (const [a, b, r] of [[-18, -18, 16], [0, -26, 18], [18, -18, 16], [0, -12, 18]]) X.arc(sx + a, sy + b, r, 0, K.TAU, false), X.closePath(); K.ink('#fff7e8', 3);
      for (const [a, b, r] of [[-22, -22, 9], [-2, -32, 10]]) { X.beginPath(); X.arc(sx + a, sy + b, r, 0, K.TAU); X.fillStyle = 'rgba(255,255,255,.9)'; X.fill(); }
      const hb = Math.sin(now * 1.8) > .4 && !fly ? 8 : 0;
      K.el(sx + 24, sy - 12 + hb, 11, 10); K.ink('#5b4a42', 3); X.fillStyle = INK; X.beginPath(); X.arc(sx + 28, sy - 15 + hb, 2.2, 0, K.TAU); X.fill();
      K.el(sx + 16, sy - 24 + hb, 4, 6, -.5); K.ink('#5b4a42', 2);
      // the judge in the shade of an umbrella
      const jx = 742, jy = 436;
      K.line([[jx - 36, jy - 118], [jx - 36, jy]], 4, '#e6c58c');
      X.beginPath(); X.moveTo(jx - 36, jy - 150); X.quadraticCurveTo(jx - 90, jy - 132, jx - 96, jy - 112); X.quadraticCurveTo(jx - 66, jy - 126, jx - 36, jy - 112); X.quadraticCurveTo(jx - 8, jy - 126, jx + 24, jy - 112); X.quadraticCurveTo(jx + 18, jy - 132, jx - 36, jy - 150); K.ink('#ff5c8a', 3);
      K.shade(jx, jy + 4, 26, 6, .25);
      K.person(jx, jy, .95, { shirt: '#fff', stripe: '#2f4fd6', pants: '#2b2640', hat: 'cap', hatc: '#2f4fd6', mood: lost ? 'panic' : won ? 'cheer' : 'idle', look: [-.8, .2], la: won || lost ? 3.0 : .15, ra: .15, bob: won ? Math.abs(Math.sin(now * 9)) * 8 : 0, T: now });
      if (won || lost) { const k = K.outBack(ot * 4); X.save(); X.translate(jx - 30, jy - 108 - (won ? Math.abs(Math.sin(now * 9)) * 8 : 0)); X.rotate(-.12); X.scale(k, k); K.rr(-20, -18, 40, 34, 6); K.ink(won ? '#fff' : '#ffd0d0', 3); X.fillStyle = won ? '#1f9e4a' : RED; X.font = '900 28px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(won ? '10' : '0', 0, 2); X.restore(); }
      // Claude in the circle: arms haul the chain, a headband flaps
      const p = power(), fl = fly ? Math.min(1, fly.t / .9) : 0;
      let la = 1.0, ra = .55, k = 1;
      if (held) { la = 1.0 + Math.sin(spin) * .2; ra = .55 + Math.cos(spin) * .18; k = 1.15; }
      else if (fly) { la = won ? -.7 : -.3; ra = won ? .7 : .3; k = won ? 1.1 : .5; }
      else { la = -.35; ra = .35; k = .8; }
      const lean = held ? Math.sin(spin) * 2 : 0, jump = won ? Math.abs(Math.sin(now * 9)) * 14 : 0;
      if (held && p > .1) { X.strokeStyle = `rgba(255,255,255,${.25 + p * .4})`; X.lineWidth = 6; X.lineCap = 'round'; X.setLineDash([22, 18]); X.lineDashOffset = -spin * 20; X.beginPath(); X.ellipse(130, 462, 86, 38, 0, 0, K.TAU); X.stroke(); X.setLineDash([]); }
      sdHero(130 + lean, 526 - jump, 6, g, { la, ra, k });
      if (held && p > .75) K.sweat(176, 478, 1.2, now);
      if (won) { K.heart(96, 440 - jump - ot * 24, 1, Math.max(0, 1 - ot)); K.heart(168, 424 - jump - ot * 30, .8, Math.max(0, 1 - ot * 1.1)); }
      if (lost) for (let i = 0; i < 3; i++) K.star(130 + Math.cos(now * 6 + i * 2.1) * 34, 468 + Math.sin(now * 6 + i * 2.1) * 8, 8, 3.5, 5, now * 4 + i, YEL, 2);
      // the hammer: orbits Claude while held; flies when released
      let bx = 130 + Math.cos(spin) * 82, by = 462 + Math.sin(spin) * 34, lx = 142, ly = 480;
      if (fly) {
        const u = Math.min(1, fly.t / .9), tx = DX(fly.p);
        bx = lerp(130, tx, u); by = lerp(462, 520, u) - 280 * Math.sin(Math.PI * u);
        if (u >= 1) { by = 520; K.shade(tx, 526, 34, 10, .3); X.fillStyle = '#7a4a2a'; K.el(tx, 528, 26, 7); X.fill(); }
      }
      if (!fly || fly.t < .9) K.curve(lx, ly, (lx + bx) / 2, (ly + by) / 2 - 8, bx, by, 3, '#cfd5e2');
      const HM = K.elP(0, 0, 18, 18); X.save(); X.translate(bx, by); X.rotate(spin * (fly && fly.t < .9 ? 3 : 0)); K.cel(HM, '#aab3c6', '#6f7890', 4, 5, 4); K.glint(HM, -6, -7, 6, 3.4, .7, -.6);
      X.fillStyle = '#6f7890'; for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(Math.cos(i * 2.1) * 9, Math.sin(i * 2.1) * 9 + 2, 1.8, 0, K.TAU); X.fill(); } X.restore();
      if (fly && fly.t >= .9) for (let i = 0; i < 3; i++) K.puff(DX(fly.p) + (i - 1) * 24, 514 - (fly.t - .9) * 26 - i * 6, 8 + i * 3, Math.max(0, .9 - (fly.t - .9) * 1.4));
      K.meter(200, 70, 400, 26, held ? p : fly ? fly.p : 0, held && p >= 1 ? RED : GOLD, 'POWER', zc - zw / 2, zc + zw / 2);
      vignette(.2);
    }
  };
  return g;
}
reg('sd_hammer', sdHammer, 'Hammer Toss');

/* ═══════════════════ 2 SKI JUMP: tap in the last stretch of the ramp, right before the lip ═══════════════════
   A snowy mountain with a ramp, a ski lodge dug into it, a ravine before the landing and three penguin judges with scorecards. */
function skBake(RX0, RY0, LX, LY) {
  const X = K.cx();
  X.fillStyle = K.vg(0, 520, [[0, '#6cc4ff'], [.6, '#c4ecff'], [1, '#f2fbff']]); X.fillRect(0, 0, W, 520);
  K.hills(0, W, 400, 120, .006, 1, '#c9d0fb', '#7b80c6', 3, 520);
  K.hills(0, W, 430, 80, .009, 3, '#aab3f2', '#5b5fa8', 3, 520);
  for (const [mx, my] of [[212, 322], [600, 320]]) { X.beginPath(); X.moveTo(mx - 26, my + 28); X.lineTo(mx, my - 8); X.lineTo(mx + 26, my + 28); X.closePath(); X.fillStyle = '#f6f8ff'; X.fill(); }
  // the ravine between the lip and the landing
  X.fillStyle = K.vg(380, 600, [[0, '#6aa3e0'], [1, '#2f5fb0']]); X.fillRect(LX, LY + 10, 566 - LX, 600);
  X.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(LX + 6 + i * 9, 420 + i * 30); X.lineTo(LX + 12 + i * 9, 440 + i * 30); X.lineTo(LX + 16 + i * 9, 420 + i * 30); X.fill(); }
  // the mountain the ramp is cut into
  const MT = new Path2D(); MT.moveTo(-6, 170); MT.lineTo(LX + 8, LY - 4); MT.lineTo(LX + 8, 610); MT.lineTo(-6, 610); MT.closePath();
  K.cel(MT, '#f4faff', '#bcd2ee', 14, 12, 5);
  // snowy pines on the mountain face
  for (const [px, py, ps] of [[330, 470, 1], [392, 500, 1.15], [452, 452, .9], [300, 520, .8]]) { K.rr(px - 4 * ps, py - 6 * ps, 8 * ps, 16 * ps, 2); K.ink('#8a5a34', 2.5); for (let i = 0; i < 3; i++) { const yy = py - 6 * ps - i * 20 * ps, hw = (26 - i * 7) * ps; X.beginPath(); X.moveTo(px - hw, yy); X.lineTo(px, yy - 28 * ps); X.lineTo(px + hw, yy); X.closePath(); K.ink('#2f9a55', 3); X.beginPath(); X.moveTo(px - hw * .6, yy - 11 * ps); X.lineTo(px, yy - 28 * ps); X.lineTo(px + hw * .6, yy - 11 * ps); X.quadraticCurveTo(px, yy - 4 * ps, px - hw * .6, yy - 11 * ps); X.fillStyle = '#fff'; X.fill(); } }
  // ski lodge dug into the mountain
  const LOD = K.rrP(70, 430, 170, 100, 8); K.cel(LOD, '#d9944f', '#a5622c', 6, 5, 4); X.save(); X.clip(LOD); X.strokeStyle = '#c4874e'; X.lineWidth = 3; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(70, 450 + i * 17); X.lineTo(240, 450 + i * 17); X.stroke(); } X.restore();
  K.poly([[56, 436], [155, 376], [254, 436]], '#c94a4a', 4); X.fillStyle = '#fff'; K.rr(70, 420, 170, 18, 9); K.ink('#fff', 3);
  K.rr(94, 462, 60, 54, 6); K.ink('#ffe9a8', 3); K.rr(176, 470, 40, 60, 5); K.ink('#7a4a2a', 3); X.fillStyle = '#ffd23f'; X.beginPath(); X.arc(208, 500, 3, 0, K.TAU); X.fill();
  K.rr(196, 380, 20, 38, 3); K.ink('#a5622c', 3);
  // the ramp track: an icy groove with a wooden start gate
  X.save(); X.translate(0, 0); X.beginPath(); X.moveTo(-6, 170); X.lineTo(LX + 8, LY - 4); X.lineWidth = 14; X.strokeStyle = '#9fe3ff'; X.lineCap = 'round'; X.stroke(); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.9)'; X.beginPath(); X.moveTo(-6, 166); X.lineTo(LX + 8, LY - 8); X.stroke(); X.restore();
  K.line([[RX0 - 24, RY0 + 6], [RX0 - 24, RY0 - 80]], 7, '#a5622c'); K.line([[RX0 + 28, RY0 + 22], [RX0 + 28, RY0 - 64]], 7, '#a5622c'); K.line([[RX0 - 30, RY0 - 70], [RX0 + 34, RY0 - 54]], 8, '#d9944f');
  K.star(RX0 + 2, RY0 - 62, 11, 5, 5, -Math.PI / 2, YEL, 2.5);
  // the landing bank + distance flags
  const BK = new Path2D(); BK.moveTo(566, 610); BK.lineTo(566, 506); BK.lineTo(W + 6, 446); BK.lineTo(W + 6, 610); BK.closePath(); K.cel(BK, '#f4faff', '#bcd2ee', -10, 10, 5);
  for (let i = 0; i < 5; i++) { const fx = 600 + i * 40, fy = 498 - i * 12; K.rr(fx - 2, fy - 4, 4, 14, 2); K.ink(i % 2 ? CLAY : '#2f4fd6', 2); }
}
function sdSki(sp) {
  const rs = Math.sqrt(sp), tLip = 2.3 / rs, tol = .3 / Math.pow(rs, .6);
  const RX0 = 70, RY0 = 190, LX = 520, LY = 360, ang = Math.atan2(LY - RY0, LX - RX0);
  let c = 0, sk = null;                        // sk: {k:'fly'|'early'|'late', t, q}
  const O = K.outro();
  const sOf = (tt) => Math.min(1.5, (tt / tLip) * (tt / tLip));
  const jump = () => {
    if (g.result || sk) return;
    if (c < tLip - tol) { sk = { k: 'early', t: 0, s: sOf(c) }; sdEnd(g, false, 'TOO EARLY!'); return; }
    const q = clamp(1 - (tLip - c) / tol, 0, 1) * .5 + .5; sk = { k: 'fly', t: 0, q };
    sfx.whoosh(); sfx.boing(); sdEnd(g, true, q > .9 ? 'PERFECT!' : 'NICE JUMP!', 650, 380);
  };
  const g = {
    cmd: 'JUMP!', hint: 'SPACE / CLICK AT THE END OF THE RAMP', thint: 'TAP AT THE END OF THE RAMP', dur: 5.4,
    key(e) { if (!e.repeat && e.code === 'Space') jump(); },
    down() { jump(); },
    update(dt) {
      O.mark(g);
      c += dt;
      if (sk) sk.t += dt;
      else if (c > tLip + .08 && !g.result) { sk = { k: 'late', t: 0 }; sdEnd(g, false, 'TOO LATE!'); }
    },
    draw(t) {
      const X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose';
      X.drawImage(K.baked('sk', () => skBake(RX0, RY0, LX, LY)), 0, 0);
      K.sun(690, 150, t);
      for (let i = 0; i < 3; i++) K.cloud(((now * (5 + i * 2) + i * 320) % 1000) - 150, 100 + i * 36, .85 + i * .12);
      // falling snow
      X.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 26; i++) { const sx = (K.hash(i) * 900 + Math.sin(now + i) * 14) % 800, sy = (K.hash(i + 50) * 600 + now * (30 + (i % 4) * 8)) % 600; X.beginPath(); X.arc(sx, sy, 1.8 + (i % 3) * .5, 0, K.TAU); X.fill(); }
      // penguin judges on the far bank, each with a scorecard
      for (let i = 0; i < 3; i++) {
        const px = 724 + i * 28, py = 505 - (px - 566) * .248 + 2, flap = won ? Math.sin(now * 14 + i) * .6 : 0, fall = lost && i === 1 ? K.ease(ot * 3) : 0;
        K.shade(px, py + 2, 16, 4, .22);
        X.save(); X.translate(px, py); X.rotate(fall * 1.45); X.translate(0, -fall * 6);
        for (const s of [-1, 1]) { X.save(); X.translate(s * 13, -26); X.rotate(s * (.35 + flap + (won ? .9 : 0))); K.el(0, 8, 5, 13); K.ink('#2b2640', 2.5); X.restore(); }
        K.cel(K.elP(0, -24, 15, 24), '#3b3a5c', '#2b2640', -4, 3, 3.5); K.el(0, -20, 9, 15); K.ink('#fff', 2.5);
        K.el(-6, 0, 6, 3); K.ink('#ff9a4d', 2); K.el(6, 0, 6, 3); K.ink('#ff9a4d', 2);
        K.eye(-5, -38, 3.8, lost ? (i === 1 ? 'bonk' : 'panic') : won ? 'happy' : 'idle', [-.6, .3], now, i); K.eye(5, -38, 3.8, lost ? (i === 1 ? 'bonk' : 'panic') : won ? 'happy' : 'idle', [-.6, .3], now, i + 1);
        X.beginPath(); X.moveTo(-4, -33); X.lineTo(4, -33); X.lineTo(0, -28); X.closePath(); K.ink('#ff9a4d', 2);
        K.rr(-15, -48, 30, 8, 4); K.ink(['#ff5c8a', '#5cff7a', '#4DB8FF'][i], 2.5);
        X.restore();
        if (won && ot > .05) { const k = K.outBack(ot * 3); X.save(); X.translate(px, py - 62 - Math.abs(Math.sin(now * 12 + i)) * 5); X.scale(k, k); K.rr(-12, -11, 24, 22, 4); K.ink('#fff', 2.5); X.fillStyle = '#1f9e4a'; X.font = '900 15px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(['9', '10', '9'][i], 0, 1); X.restore(); }
        if (lost && ot > .05 && i !== 1) { K.rr(px - 12, py - 62, 24, 22, 4); K.ink('#ffd0d0', 2.5); X.strokeStyle = RED; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(px - 5, py - 56); X.lineTo(px + 5, py - 46); X.moveTo(px + 5, py - 56); X.lineTo(px - 5, py - 46); X.stroke(); }
      }
      // the green take-off window on the ramp
      const wa = sOf(tLip - tol), pa = [lerp(RX0, LX, wa), lerp(RY0, LY, wa)];
      X.strokeStyle = MINT; X.lineWidth = 12; X.lineCap = 'round'; X.beginPath(); X.moveTo(pa[0], pa[1] - 6); X.lineTo(LX, LY - 6); X.stroke();
      X.strokeStyle = 'rgba(255,255,255,.75)'; X.lineWidth = 3; X.setLineDash([2, 14]); X.lineDashOffset = -now * 30; X.beginPath(); X.moveTo(pa[0], pa[1] - 6); X.lineTo(LX, LY - 6); X.stroke(); X.setLineDash([]); X.lineCap = 'butt';
      if (!sk && c > tLip - tol) { X.globalAlpha = .6 + .4 * Math.sin(now * 20); K.badge('NOW!', LX - 30, LY - 76, 32, RED, '#fff', 1, -.06); X.globalAlpha = 1; }
      // the skier
      let x, y, r = ang;
      if (!sk) { const s = sOf(c); x = lerp(RX0, LX, s); y = lerp(RY0, LY, s); }
      else if (sk.k === 'fly') {
        const u = Math.min(1, sk.t / 1.1), tx = 650 + sk.q * 60;
        x = lerp(LX, tx, u); y = lerp(LY, 468 - (tx - 650) * .25, u) - 150 * Math.sin(Math.PI * u) * (.6 + sk.q * .4); r = lerp(ang, 0, Math.min(1, u * 3)) - .1 * Math.sin(Math.PI * u);
      } else if (sk.k === 'early') {
        const u = sk.t; x = lerp(RX0, LX, sk.s) + u * 40; y = lerp(RY0, LY, sk.s) - Math.max(0, 60 * Math.sin(Math.min(1, u * 3) * Math.PI)) + (u > .35 ? (u - .35) * 160 * (u - .35) : 0) * 0; r = ang + u * 9;
        if (u > .5) { x = lerp(RX0, LX, sk.s) + 20 + (u - .5) * 40; y = lerp(RY0, LY, sk.s) - 4; }
      } else {
        const u = sk.t; x = LX + u * 120; y = LY + u * u * 600; r = ang + u * 5;
      }
      X.save(); X.translate(x, y); X.rotate(r);
      K.shade(0, 4, 32, 6, .15);
      // skis (curled tips) + poles
      X.beginPath(); X.moveTo(-40, -2); X.lineTo(36, -2); X.quadraticCurveTo(48, -3, 52, -12); X.lineTo(46, -1); X.quadraticCurveTo(46, 5, 34, 5); X.lineTo(-38, 5); X.quadraticCurveTo(-44, 4, -40, -2); X.closePath(); K.ink(CLAY, 3);
      X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(-30, -1, 54, 2);
      if (!sk || sk.k !== 'fly') for (const s of [-1, 1]) K.line([[s * 20 - 4, -24], [s * 20 - 26, 8]], 3, '#8f88a6');
      sdHero(0, -4, 4.2, g, { la: -.9, ra: .9, k: 1.1, band: '#4DB8FF' });
      K.goggles(0, -4, 4.2);
      X.restore();
      if (!sk || sk.k !== 'fly') K.tag(clamp(x, 70, 730) + 4, y - 66, 'CLAUDE', '#ffe14d');
      if (lost && sk && sk.k === 'early' && sk.t > .5) for (let i = 0; i < 3; i++) K.star(x + (i - 1) * 24, y - 50 + Math.sin(now * 10 + i) * 5, 8, 3.5, 5, now * 4 + i, YEL, 2);
      if (won && ot > .1) K.heart(x + 20, y - 74 - ot * 20, 1, Math.max(0, 1 - ot));
      vignette(.2);
    }
  };
  return g;
}
reg('sd_ski', sdSki, 'Ski Jump');

/* ═══════════════════ 3 SPARE ME: lock the sliding position, then flick (or tap) to roll at the 3 pins ═══════════════════
   A retro bowling alley (confetti carpet, a ball return, an uncle in a bowling shirt) and a pinsetter that pulls faces; the pins have faces too. */
function bwBake(PY, BY) {
  const X = K.cx();
  // retro carpet
  X.fillStyle = '#5a2fb0'; X.fillRect(0, 0, W, H);
  const cols = ['#4DB8FF', '#ff4d9e', '#ffe14d', '#5cff7a'];
  for (let i = 0; i < 70; i++) { const x = K.hash(i) * W, y = K.hash(i + 70) * H; if (x > 196 && x < 604) continue; X.save(); X.translate(x, y); X.rotate(K.hash(i + 9) * 6); X.fillStyle = cols[i % 4]; if (i % 3) X.fillRect(-7, -3, 14, 6); else { X.beginPath(); X.moveTo(0, -8); X.lineTo(7, 5); X.lineTo(-7, 5); X.closePath(); X.fill(); } X.restore(); }
  // gutters + lane
  K.rr(208, 62, 384, 556, 14); K.ink('#6e6a86', 4); K.rr(220, 70, 360, 548, 8); K.ink('#2b2640', 0);
  X.fillStyle = '#3a3550'; X.fillRect(220, 70, 30, 548); X.fillRect(550, 70, 30, 548); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(224, 70, 5, 548); X.fillRect(554, 70, 5, 548);
  X.fillStyle = '#E9A75B'; X.fillRect(250, 70, 300, 548);
  for (let i = 0; i < 9; i++) { X.fillStyle = i % 2 ? 'rgba(255,255,255,.2)' : 'rgba(120,60,10,.12)'; X.fillRect(250 + i * 33.3, 70, 33.3, 548); X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(250 + i * 33.3, 70, 2, 548); }
  X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(262, 70, 276, 14);
  for (let i = 0; i < 7; i++) { const ax = 280 + i * 40, ay = 410 - Math.abs(i - 3) * 14; X.beginPath(); X.moveTo(ax, ay - 14); X.lineTo(ax + 7, ay + 6); X.lineTo(ax - 7, ay + 6); X.closePath(); X.fillStyle = '#7a3f1a'; X.fill(); }
  X.fillStyle = INK; X.fillRect(250, 478, 300, 6);
  for (const dx of [-34, 0, 34]) { K.el(400 + dx, PY, 15, 15); X.fillStyle = 'rgba(20,16,28,.18)'; X.fill(); }
  // the pinsetter on the back wall
  K.rr(236, -10, 328, 80, 14); K.ink('#9a96ad', 4); X.fillStyle = 'rgba(255,255,255,.3)'; K.rr(244, 0, 312, 12, 6); X.fill();
  X.fillStyle = INK; X.fillRect(250, 60, 300, 10);
  // the neon: two crossed pins
  for (const sx of [-1, 1]) { const nx = sx < 0 ? 104 : 696; X.save(); X.translate(nx, 120); X.rotate(sx * .5); K.rr(-14, -42, 28, 84, 14); K.ink('#fff', 3); X.fillStyle = RED; X.fillRect(-14, -10, 28, 10); X.restore(); }
  // the ball return (left)
  K.rr(58, 380, 108, 66, 12); K.cel(K.rrP(58, 380, 108, 66, 12), '#4d7cff', '#2f4fd6', 6, 5, 4); K.rr(70, 392, 84, 18, 9); K.ink('#2b2640', 2.5);
  for (let i = 0; i < 3; i++) { K.circ(88 + i * 24, 400, 10, [RED, '#ffe14d', '#5cff7a'][i], K.dk([RED, '#ffe14d', '#5cff7a'][i], .7), 2.5); }
}
function bwPin(X, f, u, fear, T, k) {
  K.cel(K.elP(0, -6, 11, 22), '#fff', '#d5dae6', 3, 3, 3); K.rr(-5, -30, 10, 14, 5); K.ink('#fff', 3);
  X.fillStyle = RED; X.fillRect(-9, -10, 18, 4); X.fillRect(-4, -22, 8, 3);
  const mood = f ? 'bonk' : fear > .6 ? 'panic' : 'idle'; K.eye(-3.6, -23, 3.2, mood, [0, fear * 1.2], T, k); K.eye(3.6, -23, 3.2, mood, [0, fear * 1.2], T, k + 1);
}
function sdBowl(sp) {
  const rs = Math.sqrt(sp), PX = 400, PY = 150, BY = 500;
  const ph = Math.random() * 6, sw = .3, swv = 3.2 * Math.pow(rs, .7);
  let c = 0, phase = 0, lockX = 400, aim = 0, grab = null, cur = null, ball = null; const pins = [-34, 0, 34].map(x => ({ x: PX + x, fall: 0, dx: 0 }));
  const O = K.outro();
  const baseA = () => Math.atan2(PX - lockX, BY - PY);
  const swing = () => baseA() + sw * Math.sin(c * swv + ph);
  const slideX = () => 400 + 125 * Math.sin(c * 1.9 * Math.pow(rs, .7) + ph);
  const lock = () => { if (g.result || phase !== 0) return; phase = 1; lockX = slideX(); sfx.click(); sfx.tickHi(); floatText('LOCKED!', lockX, 440, YEL, 28); };
  const roll = (a) => {
    if (g.result || phase !== 1) return; phase = 2;
    const dx = Math.sin(a), dy = -Math.cos(a), xp = lockX + dx / -dy * (BY - PY);
    ball = { x: lockX, y: BY, dx, dy, xp, t: 0, done: false }; sfx.whoosh(false);
  };
  const g = {
    cmd: 'BOWL!', hint: 'SPACE / CLICK TO LOCK, THEN SPACE OR DRAG UP + RELEASE TO ROLL', thint: 'TAP TO LOCK, THEN FLICK UP TO ROLL', dur: 5.8,
    key(e) { if (!e.repeat && e.code === 'Space') { if (phase === 0) lock(); else roll(swing()); } },
    down(p) { if (phase === 0) lock(); else if (phase === 1) { grab = { x: p.x, y: p.y }; cur = p; } },
    move(p) { if (grab) cur = p; },
    up(p) {
      if (!grab) return;
      const dx = p.x - grab.x, dy = p.y - grab.y, len = Math.hypot(dx, dy); grab = null; cur = null;
      if (len < 40) roll(swing());
      else if (dy < -20) roll(Math.atan2(dx, -dy));
    },
    update(dt) {
      O.mark(g);
      c += dt;
      for (const p of pins) if (p.fall > 0) { p.fall += dt; }
      if (ball && !ball.done) {
        ball.t += dt; const sp2 = 760; ball.x += ball.dx * sp2 * dt; ball.y += ball.dy * sp2 * dt;
        const gut = Math.abs(ball.x - 400) > 150; if (gut) ball.x = clamp(ball.x, 400 - 168, 400 + 168);
        if (ball.y <= PY + 14) {
          ball.done = true; const off = ball.xp - PX, hit = Math.abs(off) < 150;
          const cen = hit && Math.abs(off) < 38;
          if (cen) pins.forEach((p, i) => { p.fall = .01; p.dx = (i - 1) * 90 + off; });
          else if (hit && Math.abs(off) < 74) { const k = off < 0 ? 0 : 2; [k, 1].forEach(i => { pins[i].fall = .01; pins[i].dx = (i - 1) * 60; }); }
          if (cen) { sfx.hit(); sfx.thud(); }
          sdEnd(g, cen, cen ? 'SPARE!' : Math.abs(off) >= 150 ? 'GUTTER!' : Math.abs(off) < 74 ? 'SPLIT!' : 'MISSED!', PX, 200);
        }
      }
    },
    draw(t) {
      const X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose';
      X.drawImage(K.baked('bw', () => bwBake(PY, BY)), 0, 0);
      // the disco ball + the uncle in the next lane, who covers his eyes or whoops
      X.save(); X.translate(690, 0); K.line([[0, 0], [0, 54]], 3, '#8f88a6'); X.restore();
      const db = K.elP(0, 0, 22, 22); X.save(); X.translate(690, 76); X.rotate(now * .5); K.cel(db, '#dfe4ee', '#9aa3b8', 5, 6, 3.5); X.clip(db); X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { X.beginPath(); X.moveTo(i * 8, -22); X.lineTo(i * 8, 22); X.moveTo(-22, i * 8); X.lineTo(22, i * 8); X.stroke(); } X.fillStyle = 'rgba(255,255,255,.8)'; X.fillRect(-12, -14, 6, 6); X.restore();
      K.person(690, 530, 1.5, { shirt: '#e8553a', stripe: '#fff', pants: '#3b3a5c', hat: 'cap', hatc: '#ff5c8a', mood: lost ? 'panic' : won ? 'cheer' : 'idle', look: [-.9, -.2], la: lost ? 2.9 : won ? 3.0 : .2, ra: lost ? 2.9 : won ? 3.0 : .2, bob: won ? Math.abs(Math.sin(now * 9)) * 10 : 0 });
      // the pinsetter's face (it watches the ball, grins at a gutter, panics at a strike)
      const bxs = ball ? clamp((ball.x - 400) / 140, -1, 1) : phase < 2 ? clamp((lockX - 400) / 140, -1, 1) * (phase ? 1 : 0) + (phase ? 0 : (slideX() - 400) / 140) : 0;
      for (const sx of [-1, 1]) K.eye(400 + sx * 30, 54, 9, won ? 'bonk' : lost ? 'happy' : 'idle', [bxs, .6], now, sx);
      X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); if (won) { X.arc(400, 66, 5, 0, Math.PI * 2); } else { X.moveTo(390, 65); X.quadraticCurveTo(400, lost ? 71 : 67, 410, 65); } X.stroke();
      // pins
      for (const p of pins) {
        const f = p.fall, u = Math.min(1, f * 2.2), near = ball && !ball.done ? clamp(1 - (ball.y - PY) / 260, 0, 1) : phase < 2 ? .1 : 0;
        X.save(); X.translate(p.x + p.dx * u, PY + 16 + (f ? -u * 50 : 0)); X.rotate(f ? u * 3 * Math.sign(p.dx || 1) : 0); X.globalAlpha = f ? 1 - u * .7 : 1;
        K.shade(0, 14 - (f ? 0 : 0), 14, 4, .2); bwPin(X, f, 1, near, now, p.x * .1); X.restore();
      }
      if (won && ot > .05) for (let i = 0; i < 5; i++) K.star(PX + (i - 2) * 46, PY - 40 - ((ot * 90 + i * 14) % 60), 9, 4, 5, now * 5 + i, YEL, 2);
      // sliding / locked Claude, holding the ball over its head
      const x = phase === 0 ? slideX() : lockX;
      const hold = phase < 2, aimA = swing();
      sdHero(x, 574, 5, g, { la: hold ? -.25 : -.9, ra: hold ? .25 : .9, k: hold ? 1.5 : 1, band: '#4DB8FF' });
      if (hold) {
        const BL = K.elP(0, 0, 18, 18); X.save(); X.translate(x, BY + 6); K.cel(BL, '#4d7cff', '#23408E', 5, 6, 4); K.glint(BL, -6, -7, 6, 3.4, .6, -.6); X.fillStyle = INK; for (const [a, b] of [[-4, -2], [3, -4], [0, 5]]) { X.beginPath(); X.arc(a, b, 2.2, 0, K.TAU); X.fill(); } X.restore();
        if (phase === 0) { K.badge('LOCK IT!', 400, 108, 28, YEL, INK, 1, -.04); X.fillStyle = 'rgba(255,225,77,.5)'; X.fillRect(x - 3, PY + 30, 6, BY - PY - 40); }
        else {
          let a = aimA; if (grab && cur) { const dx = cur.x - grab.x, dy = cur.y - grab.y; if (Math.hypot(dx, dy) > 40 && dy < -20) a = Math.atan2(dx, -dy); }
          X.strokeStyle = MINT; X.lineWidth = 6; X.lineCap = 'round'; X.setLineDash([14, 12]); X.lineDashOffset = -now * 40; X.beginPath(); X.moveTo(x, BY); X.lineTo(x + Math.sin(a) * 340, BY - Math.cos(a) * 340); X.stroke(); X.setLineDash([]);
          K.badge('FLICK!', 400, 108, 28, MINT, INK, 1, .04);
          if (grab && cur) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.beginPath(); X.moveTo(grab.x, grab.y); X.lineTo(cur.x, cur.y); X.stroke(); }
        }
      } else if (ball) {
        const BL = K.elP(0, 0, 18, 18); X.save(); X.translate(ball.x, ball.y); X.rotate(ball.t * 8); K.shade(5, 8, 18, 8, .2); K.cel(BL, '#4d7cff', '#23408E', 5, 6, 4); K.glint(BL, -6, -7, 6, 3.4, .6, -.6); X.fillStyle = INK; for (const [a, b] of [[-4, -2], [3, -4], [0, 5]]) { X.beginPath(); X.arc(a, b, 2.2, 0, K.TAU); X.fill(); } X.restore();
      }
      if (lost) for (let i = 0; i < 3; i++) K.star(x + (i - 1) * 22, 540 + Math.sin(now * 10 + i) * 4, 7, 3, 5, now * 4 + i, YEL, 2);
      vignette(.22);
    }
  };
  return g;
}
reg('sd_bowl', sdBowl, 'Spare Me');

/* ═══════════════════ 4 PRO CURLING: scrub in front of the stone to carry it into the house, but stop before you overshoot ═══════════════════
   A curling hall: the sheet of ice in the middle, boards, a scrub meter on a wooden sign, and three aunties in knitted hats who know exactly how it should go. */
function cuBake(Y0, HX, hy) {
  const X = K.cx();
  X.fillStyle = K.vg(0, 600, [[0, '#cdeeff'], [1, '#e9f8ff']]); X.fillRect(0, 0, W, H);
  // the hall: wall panels + a banner of pennants
  X.fillStyle = 'rgba(77,184,255,.14)'; for (let i = 0; i < 8; i++) X.fillRect(i * 100 + 20, 0, 50, 330);
  K.line([[0, 96], [W, 116]], 2.5, '#fff'); for (let i = 0; i < 14; i++) { const px = 20 + i * 58, py = 96 + (px / W) * 20; X.beginPath(); X.moveTo(px - 12, py); X.lineTo(px + 12, py); X.lineTo(px, py + 26); X.closePath(); K.ink(['#ff5c8a', '#ffe14d', '#4DB8FF', '#5cff7a'][i % 4], 2.5); }
  // the boards (wooden) and the sheet
  K.rr(226, -20, 348, 650, 10); K.ink('#d9944f', 6); X.fillStyle = '#c4874e'; X.fillRect(232, 0, 4, 600); X.fillRect(564, 0, 4, 600);
  X.fillStyle = '#eefaff'; X.fillRect(250, 0, 300, 600);
  X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(256, 0, 14, 600);
  // lines + the house (target)
  X.fillStyle = 'rgba(20,16,28,.5)'; X.fillRect(398, 0, 4, 600); X.fillRect(250, hy - 2, 300, 4);
  X.fillStyle = RED; X.fillRect(250, Y0 + 22, 300, 6); X.fillStyle = INK; X.fillRect(250, Y0 + 20, 300, 2);
  for (const [r, col] of [[78, '#2B6CE0'], [54, '#fff'], [32, CLAY], [10, '#fff']]) { const p = K.elP(HX, hy, r, r); K.cel(p, col, K.dk(col === '#fff' ? '#d5dae6' : col, col === '#fff' ? 1 : .8), 0, 3, 3); }
  // the scrub-o-meter board (left)
  K.rr(26, 92, 84, 330, 18); K.cel(K.rrP(26, 92, 84, 330, 18), '#d9944f', '#a5622c', 5, 5, 4); X.fillStyle = 'rgba(255,255,255,.2)'; K.rr(34, 100, 10, 314, 5); X.fill();
  K.line([[50, 70], [50, 96]], 3, '#e6c58c'); K.line([[86, 70], [86, 96]], 3, '#e6c58c');
  // the hall's far side: a stack of spare stones
  for (let i = 0; i < 3; i++) K.circ(660 + i * 44, 560, 18, '#8A93A6', '#6f7890', 3.5);
}
function sdCurl(sp) {
  const rs = Math.sqrt(sp), SH = 300, TOL = 70, Y0 = 540, HX = 400;
  const v0 = 190 * rs, mu = (v0 * v0) / (2 * 170);
  let c = 0, s = 0, v = 0, sweep = 0, down = false, last = null, brush = null, ended = false, lastKey = '', spark = 0;
  const O = K.outro();
  const addSweep = (k) => { sweep = Math.min(1, sweep + k); };
  const g = {
    cmd: 'SWEEP!', hint: 'HOLD MOUSE AND SCRUB IN FRONT OF THE STONE (OR ALTERNATE LEFT / RIGHT)', thint: 'SCRUB BACK AND FORTH IN FRONT OF THE STONE', dur: 5.6,
    key(e) {
      if (e.repeat || g.result) return;
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (k && k !== lastKey) { lastKey = k; addSweep(.34); sfx.tick(); }
    },
    down(p) { down = true; last = p; brush = p; },
    move(p) {
      brush = p;
      if (!down || !last) return;
      const stoneY = Y0 - s, d = stoneY - p.y;
      if (!g.result && v > 0 && d > -30 && d < 230 && Math.abs(p.x - HX) < 160) addSweep(Math.min(.5, Math.hypot(p.x - last.x, p.y - last.y) / 55));
      last = p;
    },
    up() { down = false; last = null; brush = null; },
    update(dt) {
      O.mark(g);
      c += dt; sweep = Math.max(0, sweep - 2.2 * dt); spark -= dt;
      if (c > .4 && v === 0 && s === 0) v = v0;
      if (v > 0) {
        v -= mu * (1 - .7 * sweep) * dt; s += Math.max(0, v) * dt;
        if (sweep > .15 && spark <= 0) { spark = .06; burst(HX + (Math.random() - .5) * 40, Y0 - s - 50, '#fff', 2, 90); }
        if (!g.result && s > SH + TOL) sdEnd(g, false, 'TOO FAR!');
        if (v <= 2 && !ended) {
          v = -1; ended = true;
          const ok = Math.abs(s - SH) <= TOL; sdEnd(g, ok, ok ? 'IN THE HOUSE!' : s < SH ? 'TOO SHORT!' : 'TOO FAR!', HX, Y0 - SH);
        }
      }
    },
    draw(t) {
      const X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', hy = Y0 - SH;
      X.drawImage(K.baked('cu', () => cuBake(Y0, HX, hy)), 0, 0);
      X.fillStyle = 'rgba(77,184,255,.22)'; for (let i = 0; i < 6; i++) X.fillRect(250, i * 110 + ((c * 20) % 110) - 50, 300, 3);
      // the sweep zone hint
      const sy = Y0 - Math.max(s, 0);
      if (v > 0 || s === 0) { X.fillStyle = 'rgba(255,225,77,' + (.12 + sweep * .25) + ')'; K.rr(HX - 150, sy - 230, 300, 200, 16); X.fill(); }
      // the scrub meter: a thermometer on the wooden board
      K.rr(50, 130, 36, 262, 18); K.ink('#fff', 3);
      X.save(); K.rr(52, 132, 32, 258, 16); X.clip(); X.fillStyle = sweep > .8 ? RED : MINT; X.fillRect(40, 388 - 254 * sweep, 60, 260); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(58, 136, 6, 250); X.restore();
      txt('SWEEP', 68, 112, 18, '#fff');
      // the aunties on the right: each has an opinion
      for (let i = 0; i < 3; i++) {
        const ax = 636 + i * 70, bob = won ? Math.abs(Math.sin(now * 9 + i)) * 10 : 0;
        K.shade(ax, 524, 28, 6, .22);
        K.person(ax, 520, 1.35, { shirt: ['#ff5c8a', '#7A3FD1', '#2EC4B6'][i], scarf: ['#ffe14d', '#fff', '#ff9a4d'][i], pants: '#3b3a5c', hat: 'knit', hatc: ['#4DB8FF', '#ff5c8a', '#ffe14d'][i], mood: lost ? 'panic' : won ? 'cheer' : 'idle', look: [-.9, .3], la: lost ? 2.7 : won ? 3.0 : .2, ra: won ? 3.0 : .2 + (i === 1 ? .5 * Math.sin(now * 3) : 0), bob });
      }
      // the stone
      const sx = HX; K.shade(sx, sy + 14, 36, 11, .25);
      const ST = K.elP(0, 0, 31, 31); X.save(); X.translate(sx, sy); K.cel(ST, '#8A93A6', '#5d6580', 5, 7, 4); X.fillStyle = '#a9b2c6'; K.el(0, -1, 21, 21); X.fill(); K.glint(ST, -11, -13, 11, 5, .5, -.6);
      K.rr(-6, -17, 12, 8, 3); K.ink(CLAY, 2.5); K.rr(-16, -7, 32, 11, 5); K.ink(CLAY, 2.5); X.restore();
      // Claude beside the sheet with a knitted hat, the broom when the pointer holds one
      const cx0 = HX - 130, cy0 = Math.max(sy + 36, 120);
      sdHero(cx0, cy0, 4, g, { la: -.7, ra: .7, band: false });
      const ky = cy0 - 8.8 * 4; X.beginPath(); X.ellipse(cx0, ky + 4, 25, 12, 0, Math.PI, 0); K.ink('#ff5c8a', 3); K.rr(cx0 - 26, ky + 1, 52, 8, 4); K.ink('#d93a68', 2.5); K.el(cx0, ky - 11, 6, 6); K.ink('#fff', 2.5);
      if (c < 1.5 || s < 5) K.tag(cx0, cy0 - 74, 'CLAUDE', '#ffe14d');
      // broom
      let bx = null, by = null;
      if (brush) { bx = brush.x; by = brush.y; } else if (sweep > .05) { bx = HX + Math.sin(now * 30) * 40; by = sy - 70; }
      if (bx != null) { X.save(); X.translate(bx, by); X.rotate(.3); K.line([[0, -2], [0, -84]], 6, '#8a5a2b'); K.rr(-32, -10, 64, 20, 8); K.ink(GOLD, 3); X.strokeStyle = '#d99b1a'; X.lineWidth = 2; for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(i * 8, -6); X.lineTo(i * 8, 6); X.stroke(); } X.restore(); }
      if (s === 0 && c < 1.8) { X.globalAlpha = .6 + .4 * Math.sin(now * 14); K.badge('SCRUB!', 400, sy - 120, 32, '#4DB8FF', '#fff', 1, -.05); X.globalAlpha = 1; }
      if (won) { for (let i = 0; i < 6; i++) K.star(HX + Math.cos(now * 3 + i) * 60, hy + Math.sin(now * 3 + i) * 60, 8, 3.5, 5, now * 4 + i, YEL, 2); }
      vignette(.15);
    }
  };
  return g;
}
reg('sd_curl', sdCurl, 'Pro Curling');

/* ═══════════════════ 5 HIGH HOOPS: hold to charge, release so the ball lands in the moving hoop. Two balls. ═══════════════════
   A school gym: stepped bleachers full of fans, a ceiling track the hoop rides on, a ball cart for the spare ball and a cat mascot who loses it at every swish. */
function hpBake() {
  const X = K.cx();
  X.fillStyle = K.vg(0, 470, [[0, '#ffe9c4'], [1, '#ffcf8f']]); X.fillRect(0, 0, W, 470);
  X.fillStyle = 'rgba(217,148,79,.18)'; for (let i = 0; i < 9; i++) X.fillRect(i * 100, 0, 3, 470);
  // bleachers: three wooden steps with fans
  const cols = ['#ff4d9e', '#4DB8FF', '#5cff7a', '#c78bff', '#ffe14d', '#fff'];
  for (let r = 0; r < 3; r++) {
    const y = 300 + r * 52;
    for (let i = 0; i < 20; i++) { const fx = 24 + i * 40 + (r % 2) * 18, k = i + r * 20; K.rr(fx - 13, y + 8, 26, 30, 9); K.ink(cols[Math.floor(K.hash(k) * 6)], 2.5); K.el(fx, y - 2, 11, 11); K.ink(['#ffcba4', '#f0a37e', '#d98c66'][Math.floor(K.hash(k + 5) * 3)], 2.5); if (K.hash(k + 9) > .5) { K.rr(fx - 11, y - 14, 22, 8, 4); K.ink(cols[Math.floor(K.hash(k + 3) * 6)], 2); } }
    K.rr(-10, y + 32, W + 20, 22, 6); K.cel(K.rrP(-10, y + 32, W + 20, 22, 6), '#d9944f', '#a5622c', 0, 5, 3.5);
  }
  // pennants + a ceiling beam
  K.line([[0, 108], [W, 128]], 2.5, '#fff'); for (let i = 0; i < 13; i++) { const px = 30 + i * 62, py = 108 + px / W * 20; X.beginPath(); X.moveTo(px - 13, py); X.lineTo(px + 13, py); X.lineTo(px, py + 28); X.closePath(); K.ink(['#ff5c8a', '#ffe14d', '#4DB8FF', '#5cff7a'][i % 4], 2.5); }
  // the court
  X.fillStyle = K.vg(470, 600, [[0, '#d9944f'], [1, '#a5622c']]); X.fillRect(0, 470, W, 130);
  X.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 14; i++) X.fillRect(i * 62, 470, 30, 130);
  K.horizon(470, 0, W, 5);
  X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 505); X.lineTo(W, 505); X.stroke(); X.beginPath(); X.ellipse(430, 570, 190, 60, 0, Math.PI, 0); X.stroke();
  // the ceiling track
  K.rr(280, 114, 520, 14, 6); K.cel(K.rrP(280, 114, 520, 14, 6), '#cfd8e6', '#8f9cb3', 0, 4, 3.5);
  X.fillStyle = '#8f9cb3'; for (let i = 0; i < 12; i++) X.fillRect(300 + i * 44, 118, 3, 8);
}
function sdHoops(sp) {
  const rs = Math.sqrt(sp), rate = .85 * rs, w = 1.9 * Math.pow(rs, .7), T = .75 / Math.pow(rs, .3), ph = Math.random() * 6, HY = 215, RW = 56;
  const hx = (tt) => 540 + 165 * Math.sin(tt * w + ph);
  const lx = (p) => 200 + p * 560;
  let c = 0, held = false, hold = 0, balls = 2, shot = null, cd = 0, last = 0, swishT = -9;
  const O = K.outro();
  const power = () => { const m = (hold * rate) % 2; return m < 1 ? m : 2 - m; };
  const start = () => { if (g.result || (shot && !shot.done) || held || cd > 0 || balls <= 0) return; held = true; hold = 0; sfx.click(); };
  const release = () => {
    if (!held) return; held = false;
    const p = power(); if (hold * rate < .08) { hold = 0; return; }
    balls--; const ok = Math.abs(lx(p) - hx(c + T)) < RW;
    shot = { t: 0, xl: lx(p), ok }; last = p; sfx.whoosh();
  };
  const g = {
    cmd: 'SHOOT!', hint: 'HOLD SPACE / MOUSE, RELEASE TO SHOOT AT THE HOOP', thint: 'HOLD TO CHARGE, LET GO TO SHOOT', dur: 5.6,
    key(e) { if (!e.repeat && e.code === 'Space') start(); },
    keyup(e) { if (e.code === 'Space') release(); },
    down() { start(); },
    up() { release(); },
    update(dt) {
      O.mark(g);
      c += dt; cd -= dt; if (held) hold += dt;
      if (shot) {
        shot.t += dt;
        if (!shot.done && shot.t >= T) {
          shot.done = true;
          if (shot.ok) { sfx.pop(); sfx.hit(); swishT = now; sdEnd(g, true, 'SWISH!', shot.xl, HY); }
          else { sfx.thud(); if (balls <= 0) sdEnd(g, false, 'MISSED!'); else floatText('MISS!', shot.xl, HY - 30, '#fff', 30); }
        }
        if (shot.t > T + .45) { shot = null; cd = .1; }
      }
    },
    draw(t) {
      const X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose';
      X.drawImage(K.baked('hp', hpBake), 0, 0);
      const sw = now - swishT < .8 ? 1 - (now - swishT) / .8 : 0;
      // the cat mascot at the sideline
      { const mx = 718, my = 486, hopm = (won || sw > 0) ? Math.abs(Math.sin(now * 11)) * 14 : lost ? 0 : Math.abs(Math.sin(now * 2.2)) * 3;
        K.shade(mx, my + 2, 34, 7, .25); X.save(); X.translate(mx, my - hopm);
        for (const sx of [-1, 1]) { K.rr(sx * 14 - 8, -14, 16, 16, 6); K.ink('#e8553a', 3); }
        K.cel(K.elP(0, -34, 28, 26), '#ff9a3d', '#d9701a', 5, 4, 4); K.el(0, -30, 15, 15); K.ink('#fff', 2.5);
        for (const sx of [-1, 1]) { X.save(); X.translate(sx * 34, -48); X.rotate(sx * (1.0 + (won || sw > 0 ? Math.sin(now * 16 + sx) * .5 : lost ? -.9 : 0))); K.el(0, -10, 8, 15); K.ink('#ff9a3d', 3); K.el(0, -24, 10, 10); K.ink('#ffe14d', 2.5); X.restore(); }
        for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 10, -76); X.lineTo(sx * 28, -92); X.lineTo(sx * 28, -66); X.closePath(); K.ink('#ff9a3d', 3); X.beginPath(); X.moveTo(sx * 15, -76); X.lineTo(sx * 24, -85); X.lineTo(sx * 24, -71); X.closePath(); X.fillStyle = '#ffb3c1'; X.fill(); }
        K.cel(K.elP(0, -64, 31, 27), '#ff9a3d', '#d9701a', 5, 4, 4); K.el(0, -56, 14, 11); K.ink('#fff', 2.5);
        const mood = won || sw > 0 ? 'happy' : lost ? 'panic' : 'idle'; K.eye(-12, -68, 7, mood, [-.8, .3], now, 0); K.eye(12, -68, 7, mood, [-.8, .3], now, 1);
        X.beginPath(); X.moveTo(-4, -58); X.lineTo(4, -58); X.lineTo(0, -53); X.closePath(); K.ink('#ff5c8a', 2); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(0, -53); X.quadraticCurveTo(0, -47, -6, -47); X.moveTo(0, -53); X.quadraticCurveTo(0, -47, 6, -47); X.stroke();
        X.lineWidth = 2; X.beginPath(); for (const sx of [-1, 1]) for (const dy of [-3, 3]) { X.moveTo(sx * 14, -54 + dy); X.lineTo(sx * 30, -54 + dy * 2.2); } X.stroke(); X.restore(); }
      // the hoop rides the ceiling track
      const x = hx(c);
      K.rr(x - 14, 108, 28, 26, 6); K.ink('#8f9cb3', 3); K.line([[x, 132], [x, 160]], 5, '#8f9cb3');
      const BB = K.rrP(x - 50, 150, 100, 50, 6); K.cel(BB, '#e9f8ff', '#b9d8ec', 6, 5, 4); K.glint(BB, x - 30, 160, 24, 5, .7, -.2);
      X.strokeStyle = CLAY; X.lineWidth = 5; X.strokeRect(x - 20, 168, 40, 28);
      const swayN = (shot && shot.ok && shot.t > T) ? Math.sin((shot.t - T) * 40) * 6 * Math.max(0, 1 - (shot.t - T) * 2.2) : 0;
      X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { X.beginPath(); X.moveTo(x + i * 22, HY + 2); X.lineTo(x + i * 12 + swayN, HY + 52); X.stroke(); }
      X.beginPath(); X.moveTo(x - 36, HY + 18); X.lineTo(x + 36, HY + 18); X.moveTo(x - 24, HY + 34); X.lineTo(x + 24 + swayN, HY + 34); X.stroke();
      X.strokeStyle = INK; X.lineWidth = 12; X.beginPath(); X.ellipse(x, HY, 44, 11, 0, 0, 7); X.stroke();
      X.strokeStyle = CLAY; X.lineWidth = 6; X.beginPath(); X.ellipse(x, HY, 44, 11, 0, 0, 7); X.stroke();
      // the ball cart with the spare balls
      K.rr(196, 494, 82, 36, 10); K.cel(K.rrP(196, 494, 82, 36, 10), '#4d7cff', '#2f4fd6', 5, 4, 4);
      for (const wx of [212, 262]) K.circ(wx, 536, 8, '#3a3550', '#2b2640', 3);
      for (let i = 0; i < 2; i++) { const bx2 = 220 + i * 34; if (i < balls) { K.circ(bx2, 488, 15, '#ff8a3d', '#d95f1a', 3.5); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(bx2 - 15, 488); X.lineTo(bx2 + 15, 488); X.stroke(); } else { K.el(bx2, 496, 14, 6); X.fillStyle = 'rgba(20,16,28,.2)'; X.fill(); } }
      // Claude: crouches while charging, the ball above the raised hands
      const sq = held ? .94 : 1;
      X.save(); X.translate(110, 520); X.scale(2 - sq, sq); X.translate(-110, -520);
      const upBall = !g.result && balls > 0 && !(shot && !shot.done);
      sdHero(110, 520, 7, g, { la: won ? -.7 : -.3, ra: won ? .7 : upBall ? .1 : .3, k: won ? 1.2 : upBall ? 1.4 : .8, band: '#4DB8FF' });
      X.restore();
      if (lost) for (let i = 0; i < 3; i++) K.star(110 + (i - 1) * 26, 442 + Math.sin(now * 10 + i) * 4, 8, 3.5, 5, now * 4 + i, YEL, 2);
      if (won) K.heart(78, 436 - ot * 26, 1, Math.max(0, 1 - ot));
      if (held && power() > .8) K.sweat(150, 458, 1.1, now);
      // charge marker where the ball would land
      if (held) { const p = power(); X.strokeStyle = MINT; X.lineWidth = 5; X.beginPath(); X.arc(lx(p), HY, 22, 0, 7); X.stroke(); X.fillStyle = MINT; X.beginPath(); X.arc(lx(p), HY, 5, 0, 7); X.fill(); X.strokeStyle = 'rgba(92,255,122,.6)'; X.lineWidth = 3; X.setLineDash([4, 10]); X.beginPath(); X.moveTo(lx(p), HY + 24); X.lineTo(lx(p), 468); X.stroke(); X.setLineDash([]); }
      // the ball
      const BALL = (bx, by, rot) => { const P = K.elP(0, 0, 18, 18); X.save(); X.translate(bx, by); X.rotate(rot); K.cel(P, '#ff8a3d', '#d95f1a', 5, 6, 4); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-18, 0); X.lineTo(18, 0); X.moveTo(0, -18); X.lineTo(0, 18); X.stroke(); X.beginPath(); X.arc(-17, 0, 12, -1.2, 1.2); X.stroke(); X.beginPath(); X.arc(17, 0, 12, Math.PI - 1.2, Math.PI + 1.2); X.stroke(); K.glint(P, -6, -8, 6, 3.4, .55, -.6); X.restore(); };
      if (shot && shot.t < T + .3) {
        const u = Math.min(1, shot.t / T);
        let bx = lerp(150, shot.xl, u), by = lerp(420, HY, u) - 190 * Math.sin(Math.PI * u);
        if (shot.t > T) { const k = (shot.t - T); if (shot.ok) { bx = shot.xl; by = HY + k * 260; } else { bx = shot.xl + k * 220 * Math.sign(shot.xl - hx(c)); by = HY - 40 * k + k * k * 900; } }
        BALL(bx, by, shot.t * 12);
      } else if (!g.result && balls > 0) BALL(150, 420, Math.sin(now * 2) * .1);
      K.meter(200, 70, 400, 26, held ? power() : last, GOLD, 'POWER');
      vignette(.2);
    }
  };
  return g;
}
reg('sd_hoops', sdHoops, 'High Hoops');

/* ═══════════════════ 6 VOLLEY GIRL: bump the serve with good timing, then block the spike in the lane it comes down ═══════════════════
   Beach volleyball: sea, palms, a lifeguard tower, a crab strolling the sand, and a big sunglasses guy behind the net who spikes. */
function vbBake() {
  const X = K.cx();
  K.daySky(128);
  K.hills(0, W, 132, 12, .02, 1, '#a9dfc6', null, 3, 136);
  X.fillStyle = K.vg(128, 172, [[0, '#4cc4e8'], [1, '#2a8fcb']]); X.fillRect(0, 128, W, 44);
  X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 12; i++) { const wx = 20 + i * 68 + K.hash(i) * 20, wy = 140 + (i % 3) * 11; X.beginPath(); X.moveTo(wx, wy); X.quadraticCurveTo(wx + 10, wy - 5, wx + 22, wy); X.stroke(); }
  X.fillStyle = K.vg(172, 600, [[0, '#f6d58e'], [1, '#f0c274']]); X.fillRect(0, 172, W, 428);
  X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 5; X.beginPath(); X.moveTo(0, 172); for (let x = 0; x <= W; x += 20) X.lineTo(x, 172 + Math.sin(x * .05) * 3); X.stroke(); K.horizon(176, 0, W, 4);
  // lifeguard tower (left) and palms
  K.line([[84, 186], [70, 232]], 5, '#a5622c'); K.line([[132, 186], [146, 232]], 5, '#a5622c'); K.rr(70, 128, 76, 60, 8); K.cel(K.rrP(70, 128, 76, 60, 8), '#fff', '#d5dae6', 5, 5, 4); K.rr(80, 142, 56, 22, 5); K.ink('#7fd6e8', 3);
  K.poly([[62, 130], [108, 106], [154, 130]], RED, 3.5);
  for (const [px, pr] of [[40, -1], [752, 1]]) { K.curve(px, 240, px + pr * 12, 180, px + pr * 6, 112, 12, '#8a5a34'); for (let i = 0; i < 6; i++) { const a = -1.4 + i * .56 + (pr > 0 ? .1 : -.1); X.save(); X.translate(px + pr * 6, 112); X.rotate(a); X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(26, -22, 58, 6); X.quadraticCurveTo(26, -6, 0, 0); K.ink('#2f9a55', 3); X.restore(); } }
  // an umbrella + towel
  K.line([[690, 280], [690, 236]], 4, '#e6c58c'); X.beginPath(); X.moveTo(640, 238); X.quadraticCurveTo(690, 190, 740, 238); X.closePath(); K.ink('#ff5c8a', 3.5); X.fillStyle = 'rgba(255,255,255,.7)'; X.beginPath(); X.moveTo(690, 208); X.lineTo(668, 236); X.lineTo(690, 236); X.closePath(); X.fill();
  K.rr(626, 270, 110, 30, 8); K.ink('#4DB8FF', 3); X.fillStyle = '#fff'; for (let i = 0; i < 4; i++) X.fillRect(644 + i * 24, 270, 10, 30);
  // lane paint on the sand
  X.strokeStyle = 'rgba(160,110,40,.35)'; X.lineWidth = 3; X.setLineDash([12, 12]); for (const lx2 of [267, 533]) { X.beginPath(); X.moveTo(lx2, 250); X.lineTo(lx2, 560); X.stroke(); } X.setLineDash([]);
  X.fillStyle = 'rgba(160,110,40,.25)'; for (let i = 0; i < 22; i++) { X.beginPath(); X.arc(K.hash(i) * W, 260 + K.hash(i + 40) * 300, 3, 0, K.TAU); X.fill(); }
}
function sdVolley(sp) {
  const rs = Math.sqrt(sp), t1 = 1.25 / rs, tol = .2 / Math.pow(rs, .5), RISE = .5 / rs, TEL = .85 / rs, FALL = .36 / rs, JUMP = .6;
  const LX = [170, 400, 630], FY = 520, lane = Math.floor(Math.random() * 3);
  let c = 0, phase = 0, tB = 0, tA = 0, whiff = 0, bl = -1, tapT = -9, cx = 400, over = false;
  const O = K.outro();
  const bump = () => {
    if (g.result || phase !== 0) return;
    if (whiff > 0) return;
    if (Math.abs(c - t1) <= tol) {
      phase = 1; tB = c; tA = c + RISE + TEL; sfx.hit(); sfx.thud();
      floatText(Math.abs(c - t1) < tol * .4 ? 'PERFECT!' : 'BUMP!', 400, 380, YEL, 34); burst(400, 440, '#fff', 8);
    } else { whiff = .3; sfx.whoosh(); }
  };
  const block = (l) => { if (g.result || phase < 1 || c < tB + RISE * .4) return; bl = l; tapT = c; sfx.boing(); };
  const g = {
    cmd: 'VOLLEY!', hint: 'SPACE / CLICK TO BUMP, THEN LEFT / UP / RIGHT TO BLOCK', thint: 'TAP TO BUMP, THEN TAP THE SPIKE LANE TO BLOCK', dur: 5.4,
    key(e) {
      if (e.repeat) return;
      if (e.code === 'Space') { bump(); return; }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') block(0);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowDown' || e.code === 'KeyS') block(1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') block(2);
    },
    down(p) { if (phase === 0) bump(); else block(p.x < 267 ? 0 : p.x < 533 ? 1 : 2); },
    update(dt) {
      O.mark(g);
      c += dt; whiff = Math.max(0, whiff - dt);
      const tx = bl >= 0 ? LX[bl] : 400; cx += (tx - cx) * Math.min(1, dt * 16);
      if (g.result) return;
      if (phase === 0 && c > t1 + tol) sdEnd(g, false, 'DROPPED!');
      if (phase === 1 && c >= tA && !over) {
        over = true; const ok = bl === lane && c - tapT <= JUMP;
        if (ok) { sfx.hit(); shake(5, .15); burst(LX[lane], 440, '#fff', 12); }
        sdEnd(g, ok, ok ? 'BLOCKED!' : 'SPIKED!', LX[lane], 420);
      }
    },
    draw(t) {
      const X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose';
      X.drawImage(K.baked('vb', vbBake), 0, 0);
      K.sun(560, 84, t);
      for (let i = 0; i < 3; i++) K.cloud(((now * (5 + i * 2) + i * 320) % 1000) - 150, 62 + i * 22, .8 + i * .12);
      // a crab on patrol, in sunglasses; it waves when you win and ducks when you lose
      { const cp = (now * 26) % 1360, cxb = cp < 680 ? 60 + cp : 60 + 1360 - cp, hide = lost ? 1 : 0;
        X.save(); X.translate(cxb, 452 + hide * 8); K.shade(0, 14, 26, 5, .2);
        for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { X.beginPath(); X.moveTo(s * 10, 6); X.lineTo(s * (22 + j * 4), 12 + Math.sin(now * 14 + j * 2) * 3); X.lineCap = 'round'; X.lineWidth = 10; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#e8553a'; X.stroke(); }
        for (const s of [-1, 1]) { X.save(); X.translate(s * 28, -4 - (won ? 10 + Math.sin(now * 12) * 6 : 0)); K.el(0, 0, 11, 9); K.ink('#ff6a4d', 3); X.fillStyle = INK; X.beginPath(); X.moveTo(0, 0); X.lineTo(s * 12, -4); X.lineTo(s * 12, 4); X.closePath(); X.fill(); X.restore(); }
        K.cel(K.elP(0, 0, 24, 15), '#ff6a4d', '#d94a30', 4, 4, 3.5);
        for (const s of [-1, 1]) K.line([[s * 8, -10], [s * 8, -20]], 3, '#ff6a4d');
        K.rr(-17, -29, 34, 11, 5); K.ink('#2b2640', 2.5); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(-13, -27, 8, 3); X.fillRect(5, -27, 8, 3);
        X.restore(); }
      // the opponent behind the net: sunglasses, a visor, a huge spike
      const tx = phase === 1 ? lerp(400, LX[lane], clamp((c - tB - RISE) / TEL, 0, 1)) : 400;
      const jump = phase === 1 && c > tB + RISE ? Math.abs(Math.sin(clamp((c - tB - RISE) / TEL, 0, 1) * Math.PI)) * 30 : 0;
      const spike = phase === 1 && c > tB + RISE;
      K.person(tx, 232 - jump, 1.55, { shirt: '#7A3FD1', stripe: '#ffe14d', pants: '#2b2640', skin: '#f0a37e', shades: true, hat: 'visor', hatc: '#ff5c8a', mood: lost ? 'cheer' : won ? 'bonk' : spike ? 'panic' : 'idle', la: spike ? 2.3 : .4, ra: spike ? 3.0 : .4 });
      // the net
      X.fillStyle = 'rgba(20,16,28,.28)'; K.rr(0, 250, W, 8, 4); X.fill();
      for (const px of [10, 790]) { K.rr(px - 9, 170, 18, 140, 6); K.cel(K.rrP(px - 9, 170, 18, 140, 6), '#e6e8f2', '#9aa3b8', 3, 3, 4); }
      K.rr(-6, 200, W + 12, 44, 4); K.ink('#fff', 4); X.save(); K.rr(-2, 204, W + 4, 36, 2); X.clip(); X.strokeStyle = 'rgba(20,16,28,.5)'; X.lineWidth = 2; for (let i = 0; i < 44; i++) { X.beginPath(); X.moveTo(i * 19, 204); X.lineTo(i * 19, 240); X.stroke(); } for (let j = 0; j < 4; j++) { X.beginPath(); X.moveTo(0, 210 + j * 9); X.lineTo(W, 210 + j * 9); X.stroke(); } X.restore();
      K.rr(-6, 196, W + 12, 12, 5); K.ink('#fff', 3.5); X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(0, 200, W, 3);
      // lane tells
      if (phase === 1 && c > tB + RISE && !over) {
        const k = (c - tB - RISE) / TEL; X.globalAlpha = .55 + .45 * Math.sin(now * 24); drawArrow(LX[lane], 380, 2, 26, RED); X.globalAlpha = 1;
        X.fillStyle = 'rgba(255,77,77,' + (.12 + k * .2) + ')'; K.rr(LX[lane] - 85, 262, 170, 168, 14); X.fill();
      }
      // Claude
      const up = bl >= 0 && c - tapT <= JUMP, jh = up ? Math.sin((c - tapT) / JUMP * Math.PI) * 34 : 0;
      const bumping = phase === 0 && !g.result;
      sdHero(cx, FY - jh, 8, g, { mood: sdMood(g) || (up ? 'happy' : null), la: up || won ? .08 : bumping ? .6 : -.4, ra: up || won ? -.08 : bumping ? -.6 : .4, k: up ? 1.6 : won ? 1.3 : bumping ? 1.15 : .85, band: '#4DB8FF' });
      if (lost) for (let i = 0; i < 3; i++) K.star(cx + (i - 1) * 28, FY - 86 + Math.sin(now * 10 + i) * 5, 9, 4, 5, now * 4 + i, YEL, 2);
      if (won) K.heart(cx - 54, FY - 100 - ot * 24, 1.1, Math.max(0, 1 - ot));
      // ball
      let bx = 400, by;
      if (phase === 0) { by = -40 + (FY - 105 + 40) * Math.pow(c / t1, 2); if (whiff > 0 && c < t1 - tol) { /* swing, ball keeps falling */ } }
      else if (c < tB + RISE) { const u = (c - tB) / RISE; by = lerp(FY - 105, 120, 1 - (1 - u) * (1 - u)); }
      else if (!over) { const k = clamp((c - tA + FALL) / FALL, 0, 1); bx = LX[lane]; by = k <= 0 ? 150 - 20 * Math.sin(now * 20) : lerp(150, FY - 60, k * k); }
      else { bx = LX[lane]; by = g.result === 'win' ? FY - 150 - (c - tA) * 40 : FY - 40; if (g.result === 'win') bx += (c - tA) * 140; }
      K.shade(bx, FY + 8, 24, 7, .2);
      { const VP = K.elP(0, 0, 22, 22); X.save(); X.translate(bx, by); X.rotate(now * 3 * (phase ? 1 : .3)); K.cel(VP, '#fff', '#c9d0e0', 6, 7, 4); X.save(); X.clip(VP); X.strokeStyle = '#2f6fe0'; X.lineWidth = 5; X.beginPath(); X.arc(-16, -10, 22, -.3, 1.5); X.stroke(); X.strokeStyle = '#ffd23f'; X.beginPath(); X.arc(18, -8, 22, 1.7, 3.5); X.stroke(); X.restore(); K.glint(VP, -8, -9, 7, 4, .6, -.6); X.restore(); }
      if (phase === 0) {   // bump timing ring on the hands
        const k = clamp((t1 - c) / (t1 * .5), -.2, 1), ok = Math.abs(c - t1) <= tol;
        X.strokeStyle = ok ? MINT : '#fff'; X.lineWidth = 6; X.beginPath(); X.arc(400, FY - 105, 30 + k * 60, 0, 7); X.stroke();
        K.badge('BUMP!', 400, 80, 28, YEL, INK, 1, -.04);
      } else if (!g.result) K.badge(c > tB + RISE ? 'BLOCK!' : 'SET!', 400, 80, 28, c > tB + RISE ? RED : YEL, c > tB + RISE ? '#fff' : INK, 1, .04);
      vignette(.2);
    }
  };
  return g;
}
reg('sd_volley', sdVolley, 'Volley Girl');

/* ═══════════════════ 7 JUMP FOREVER: tap to hop the rope as it speeds up; clear it enough times to win ═══════════════════
   A park: a fence, a swing set, two kids turning the rope, hopscotch in chalk and a dog who follows every hop. */
function rpBake() {
  const X = K.cx();
  K.daySky(300);
  K.hills(0, W, 330, 50, .007, 5, '#a9dfc6', null, 3, 400);
  K.hills(0, W, 380, 34, .011, 2, '#87d19b', '#4f9a6a', 3, 470);
  for (const [tx, tr] of [[70, 34], [190, 26], [610, 30], [738, 38]]) { K.line([[tx, 440], [tx, 440 - tr * 1.6]], 7, '#8a5a34'); X.beginPath(); X.arc(tx, 430 - tr * 2.3, tr, 0, K.TAU); K.ink('#2f9a55', 3.5); X.fillStyle = 'rgba(255,255,255,.28)'; K.el(tx - tr * .35, 430 - tr * 2.7, tr * .35, tr * .22, -.5); X.fill(); }
  // swing set
  for (const sx of [300, 500]) { K.line([[sx, 458], [sx + (sx < 400 ? 18 : -18), 360]], 6, '#d94a4a'); }
  K.line([[318, 360], [482, 360]], 7, '#d94a4a'); K.line([[360, 360], [360, 428]], 2.5, '#8f88a6'); K.rr(346, 428, 28, 7, 3); K.ink('#ffe14d', 2.5);
  // the fence along the horizon + the lawn
  X.fillStyle = K.vg(470, 600, [[0, '#8fdc5c'], [1, '#5fb944']]); X.fillRect(0, 486, W, 114);
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -2; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, 486); X.lineTo(i * 90 + 40, 486); X.lineTo(i * 90 - 120, 600); X.lineTo(i * 90 - 200, 600); X.fill(); }
  for (let i = 0; i < 24; i++) { K.rr(i * 36 + 4, 448, 24, 40, 5); K.cel(K.rrP(i * 36 + 4, 448, 24, 40, 5), '#e3a868', '#c4874e', 4, 3, 3); }
  K.rr(-6, 458, W + 12, 8, 3); K.ink('#c4874e', 2.5); K.rr(-6, 474, W + 12, 8, 3); K.ink('#c4874e', 2.5);
  K.horizon(488, 0, W, 4);
  for (let i = 0; i < 16; i++) { const hx = (i * 61 + 11) % 790, hy = 506 + (i * 47) % 70; X.fillStyle = '#3f8f35'; X.fillRect(hx, hy, 2.5, 9); X.fillRect(hx + 5, hy + 2, 2.5, 7); X.fillRect(hx - 5, hy + 2, 2.5, 7); }
  // hopscotch in chalk
  X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 4; X.lineJoin = 'round'; for (let i = 0; i < 3; i++) { X.strokeRect(364, 560 - i * 20, 34, 20); X.strokeRect(402, 560 - i * 20, 34, 20); }
}
function sdRope(sp) {
  const rs = Math.sqrt(sp), N = 5, P0 = .95 / Math.pow(rs, .6), AIR = .5 / Math.pow(rs, .4), T0 = .85 / Math.pow(rs, .5);
  const pass = [T0]; for (let k = 1; k <= N; k++) pass.push(pass[k - 1] + P0 * Math.pow(.92, k - 1));
  let c = 0, jt = -1, cleared = 0, nextK = 0, tripped = false;
  const O = K.outro();
  const hop = () => { if (g.result || jt >= 0) return; jt = 0; sfx.boing(); };
  const hOf = () => jt >= 0 && jt < AIR ? 98 * Math.sin(Math.PI * jt / AIR) : 0;
  const theta = () => {
    // rope angle: 0 = at the feet; each period is one full turn
    let k = 0; while (k < N && c >= pass[k + 1]) k++;
    const a = k === 0 && c < pass[0] ? pass[0] - (pass[1] - pass[0]) : pass[k], b = k === 0 && c < pass[0] ? pass[0] : (k >= N ? pass[N] + P0 : pass[k + 1]);
    return k >= N ? .0001 : 2 * Math.PI * (c - a) / (b - a);
  };
  const g = {
    cmd: 'SKIP!', hint: 'SPACE / CLICK TO JUMP THE ROPE', thint: 'TAP TO JUMP THE ROPE', dur: 5.8,
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW')) hop(); },
    down() { hop(); },
    update(dt) {
      O.mark(g);
      c += dt; if (jt >= 0) { jt += dt; if (jt >= AIR) jt = -1; }
      if (g.result) return;
      while (nextK <= N - 1 && c >= pass[nextK]) {
        if (hOf() > 22) { cleared++; sfx.blip(cleared * 2); floatText('+1', 400, 330, YEL, 34); burst(400, 480, '#fff', 4, 120); nextK++; if (cleared >= N) sdEnd(g, true, 'JUMP FOREVER!', 400, 300); }
        else { tripped = true; sfx.buzz(); sdEnd(g, false, 'TRIPPED!'); break; }
      }
    },
    draw(t) {
      const X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose';
      X.drawImage(K.baked('rp', rpBake), 0, 0);
      K.sun(120, 130, t);
      for (let i = 0; i < 3; i++) K.cloud(((now * (5 + i * 2) + i * 320) % 1000) - 150, 100 + i * 34, .85 + i * .12);
      // one swing swings by itself (nobody there)
      { const a = Math.sin(now * 1.6) * .35; X.save(); X.translate(440, 360); X.rotate(a); K.line([[0, 0], [0, 68]], 2.5, '#8f88a6'); K.rr(-14, 68, 28, 7, 3); K.ink('#5cff7a', 2.5); X.restore(); }
      // the kids turn the rope (hands at the rope ends)
      const th = theta(), mid = 369 + 109 * Math.cos(th), cy = 2 * mid - 408;
      const hj = hOf(), kmood = lost ? 'panic' : won ? 'cheer' : 'idle';
      for (const [px, sdx, shirt, hair, extra] of [[170, 1, '#7A3FD1', '#6b3a22', { pig: true }], [630, -1, '#2EC4B6', '#2b2640', {}]]) {
        const kb = won ? Math.abs(Math.sin(now * 9 + px)) * 8 : 0, wob = Math.sin(th) * 3;
        K.shade(px, 504, 30, 7, .25);
        const hx2 = px + sdx * 35, hy2 = 408 + wob * .5, shx = px + sdx * 17.4, shy = 500 - 45 * 1.45 - kb;
        K.person(px, 500, 1.45, Object.assign({ shirt, hair, pants: '#3b3a5c', mood: kmood, look: [-sdx, .3], bob: kb, la: sdx > 0 ? .25 : null, ra: sdx > 0 ? null : .25 }, extra));
        K.line([[shx, shy], [hx2, hy2]], 9, '#ffcba4'); K.el(hx2, hy2, 8, 8); K.ink('#ffcba4', 3);
      }
      // the dog follows every hop with its eyes
      { const dx = 744, dy = 526, up = hj > 10 || won ? 1 : 0; K.shade(dx, dy + 2, 26, 6, .22); X.save(); X.translate(dx, dy - (won ? Math.abs(Math.sin(now * 12)) * 12 : 0));
        K.rr(-18, -34, 36, 34, 14); K.cel(K.rrP(-18, -34, 36, 34, 14), '#ffe0b0', '#e0b27a', 3, 3, 3.5); K.curve(-16, -10, -34, -22, -28 + Math.sin(now * 14) * 6, -38, 7, '#e0b27a');
        K.cel(K.elP(0, -46, 20, 18), '#ffe0b0', '#e0b27a', 3, 3, 3.5); for (const s of [-1, 1]) { K.el(s * 17, -50 + up * -6, 7, 13, s * -.3); K.ink('#8a5a34', 2.5); }
        K.eye(-8, -48, 5, lost ? 'panic' : won ? 'happy' : 'idle', [-.8, hj > 10 ? -.9 : 0], now, 3); K.eye(8, -48, 5, lost ? 'panic' : won ? 'happy' : 'idle', [-.8, hj > 10 ? -.9 : 0], now, 4);
        K.el(-7, -38, 6, 4.5); K.ink('#fff', 2); K.el(-10, -40, 3.4, 2.6); K.ink(INK, 1); if (won) { K.el(-7, -32, 4, 6); K.ink('#ff7a9a', 2); } X.restore(); }
      K.shade(400, 490, 56 - hj * .2, 12, .3);
      const ropeDraw = (front) => {
        X.strokeStyle = INK; X.lineWidth = 11; X.lineCap = 'round'; X.beginPath(); X.moveTo(205, 408); X.quadraticCurveTo(400, cy, 595, 408); X.stroke();
        X.strokeStyle = front ? GOLD : '#d9a91f'; X.lineWidth = 6; X.beginPath(); X.moveTo(205, 408); X.quadraticCurveTo(400, cy, 595, 408); X.stroke(); X.lineCap = 'butt';
        if (front) { X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 2; X.setLineDash([6, 12]); X.beginPath(); X.moveTo(205, 406); X.quadraticCurveTo(400, cy - 2, 595, 406); X.stroke(); X.setLineDash([]); }
      };
      const behind = Math.sin(th) >= 0;   // rope passes behind her on the way up
      if (behind) ropeDraw(false);
      sdHero(400, 488 - hj, 8, g, { mood: sdMood(g) || (hj > 0 ? 'happy' : null), la: hj > 0 || won ? -1.0 : -.35, ra: hj > 0 || won ? 1.0 : .35, k: hj > 0 || won ? 1.2 : .9, band: '#ff5c8a' });
      if (!behind) ropeDraw(true);
      if (tripped) for (let i = 0; i < 3; i++) K.star(400 + (i - 1) * 30, 410 + Math.sin(now * 10 + i) * 5, 9, 4, 5, now * 4 + i, YEL, 2);
      if (won) { K.heart(350, 396 - ot * 26, 1.1, Math.max(0, 1 - ot)); K.heart(452, 384 - ot * 30, .9, Math.max(0, 1 - ot * 1.1)); }
      // progress: a wooden plate with five round slots
      K.rr(286, 62, 228, 46, 16); X.fillStyle = INK; X.fill(); K.rr(286, 59, 228, 44, 16); K.cel(K.rrP(286, 59, 228, 44, 16), '#d9944f', '#a5622c', 4, 5, 4);
      for (let i = 0; i < N; i++) { const px = 322 + i * 39, py = 81; K.circ(px, py, 14, i < cleared ? GOLD : '#f7d297', i < cleared ? '#d99b1a' : '#c98443', 3.5); if (i < cleared) K.star(px, py, 10, 4.5, 5, 0, '#fff', 2); }
      vignette(.2);
    }
  };
  return g;
}
reg('sd_rope', sdRope, 'Jump Forever');

/* ═══════════════════ 8 STAR STRUCK: drag back and let go (or Up/Down + hold Space) to flick a star at the moving target ═══════════════════
   A night funfair shooting gallery: a turning ferris wheel, string lights, a striped booth with a smug bullseye on a track, a slingshot and an owl who judges. */
function stBake(TX) {
  const X = K.cx();
  X.fillStyle = K.vg(0, 540, [[0, '#17236b'], [.6, '#3558B8'], [1, '#5a7fe0']]); X.fillRect(0, 0, W, 540);
  // far tents + hills
  K.hills(0, W, 470, 40, .009, 2, '#2a3a8c', '#1b2a6b', 3, 545);
  for (const [tx, tw] of [[110, 80], [560, 90]]) { X.beginPath(); X.moveTo(tx - tw, 500); X.lineTo(tx, 430); X.lineTo(tx + tw, 500); X.closePath(); K.ink('#d94a6b', 3.5, '#1b2a6b'); X.fillStyle = 'rgba(255,255,255,.22)'; X.beginPath(); X.moveTo(tx, 430); X.lineTo(tx - 20, 500); X.lineTo(tx - 6, 500); X.closePath(); X.fill(); X.beginPath(); X.moveTo(tx, 430); X.lineTo(tx + 24, 500); X.lineTo(tx + 38, 500); X.closePath(); X.fill(); }
  // the ground: a boardwalk
  X.fillStyle = '#2d8f48'; X.fillRect(0, 540, W, 60); X.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 0; i < 10; i++) X.fillRect(i * 90, 548, 44, 52);
  X.fillStyle = CLAY; X.fillRect(0, 540, W, 8); K.horizon(540, 0, W, 4);
  // the booth: posts + a back track for the target
  for (const px of [TX - 92, TX + 92]) { K.rr(px - 9, 104, 18, 440, 6); K.cel(K.rrP(px - 9, 104, 18, 440, 6), '#d9944f', '#a5622c', 4, 3, 4); }
  K.rr(TX - 8, 120, 16, 352, 8); K.ink('#2b2640', 3.5); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(TX - 2, 126, 3, 340);
  K.rr(TX - 104, 470, 208, 34, 8); K.cel(K.rrP(TX - 104, 470, 208, 34, 8), '#d9944f', '#a5622c', 4, 5, 4); X.fillStyle = 'rgba(255,255,255,.2)'; X.fillRect(TX - 98, 476, 196, 4);
}
function sdStar(sp) {
  const rs = Math.sqrt(sp), SX = 150, SY = 440, K0 = 5.2, G = 800, MAXP = 150, TX = 650, w = 2.3 * Math.pow(rs, .6), ph = Math.random() * 6;
  const ty = (tt) => 290 + 140 * Math.sin(tt * w + ph);
  let c = 0, stars = 2, proj = null, anchor = null, cur = null, kbAng = .8, kbHold = -1, kbMode = false, rest = 0, spin = 0;
  const O = K.outro();
  const pullVec = () => {
    if (anchor && cur) { let dx = anchor.x - cur.x, dy = anchor.y - cur.y; const l = Math.hypot(dx, dy); if (l > MAXP) { dx *= MAXP / l; dy *= MAXP / l; } return { x: dx, y: dy, l: Math.min(l, MAXP) }; }
    if (kbMode) { const pw = kbHold >= 0 ? (() => { const m = ((c - kbHold) * 1.1 * rs) % 2; return m < 1 ? m : 2 - m; })() : .6, l = 40 + 110 * pw; return { x: Math.cos(kbAng) * l, y: -Math.sin(kbAng) * l, l, kb: true }; }
    return null;
  };
  const fire = (v) => {
    if (g.result || proj || stars <= 0 || v.l < 30) return;
    stars--; proj = { x: SX, y: SY, vx: v.x * K0, vy: v.y * K0, t: 0 }; sfx.whoosh(); sfx.zap();
  };
  const g = {
    cmd: 'FLICK!', hint: 'DRAG BACK AND RELEASE (OR UP / DOWN + HOLD SPACE)', thint: 'DRAG BACK, THEN LET GO TO FLICK THE STAR', dur: 5.8,
    key(e) {
      if (g.result) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { kbMode = true; kbAng = Math.min(1.3, kbAng + .07); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { kbMode = true; kbAng = Math.max(.1, kbAng - .07); }
      else if (e.code === 'Space' && !e.repeat) { kbMode = true; if (!proj) kbHold = c; }
    },
    keyup(e) { if (e.code === 'Space' && kbHold >= 0) { const v = pullVec(); kbHold = -1; if (v) fire(v); } },
    down(p) { if (g.result || proj) return; anchor = { x: p.x, y: p.y }; cur = p; kbMode = false; },
    move(p) { if (anchor) cur = p; },
    up(p) { if (!anchor) return; cur = p; const v = pullVec(); anchor = null; cur = null; if (v) fire(v); },
    update(dt) {
      O.mark(g);
      c += dt; spin += dt * 3; rest = Math.max(0, rest - dt);
      if (!proj) return;
      proj.t += dt; proj.vy += G * dt; proj.x += proj.vx * dt; proj.y += proj.vy * dt;
      if (!g.result && Math.hypot(proj.x - TX, proj.y - ty(c)) < 60) {
        sfx.hit(); sfx.thud(); burst(TX, proj.y, YEL, 20); sdEnd(g, true, 'BULLSEYE!', TX, ty(c)); proj.stuck = true; proj.vx = proj.vy = 0; proj.y = ty(c); proj.x = TX - 10;
      }
      if (!proj.stuck && (proj.y > 560 || proj.x > 860 || proj.x < -60)) {
        proj = null; rest = .3; if (!g.result) { sfx.miss(); if (stars <= 0) sdEnd(g, false, 'MISSED!'); else floatText('MISS!', 400, 300, '#fff', 34); }
      }
    },
    draw(t) {
      const X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', Y = ty(c);
      X.drawImage(K.baked('st', () => stBake(TX)), 0, 0);
      X.fillStyle = '#fff'; for (let i = 0; i < 22; i++) { const x = (i * 97) % 800, y = (i * 53) % 260 + 20, tw = .5 + .5 * Math.sin(now * 3 + i * 1.7); X.globalAlpha = .45 + tw * .5; X.fillRect(x, y, 3 + tw * 2, 3 + tw * 2); } X.globalAlpha = 1;
      // the moon (a pale disc with a bite)
      { const mp = K.elP(0, 0, 34, 34); X.save(); X.translate(118, 158); K.cel(mp, '#fff3a0', '#e6cf63', -6, 4, 4); X.restore(); X.fillStyle = '#2a3f98'; X.beginPath(); X.arc(134, 148, 26, 0, K.TAU); X.fill(); }
      // the turning ferris wheel
      { const fx = 330, fy = 360, fr = 118; X.save(); X.translate(fx, fy); K.line([[-40, 140], [0, 0], [40, 140]], 6, '#2a3a8c'); X.rotate(now * .2); X.strokeStyle = '#1b2a6b'; X.lineWidth = 10; X.beginPath(); X.arc(0, 0, fr, 0, K.TAU); X.stroke(); X.strokeStyle = '#4d6fd0'; X.lineWidth = 5; X.stroke();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; X.strokeStyle = '#4d6fd0'; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a) * fr, Math.sin(a) * fr); X.stroke();
          X.save(); X.translate(Math.cos(a) * fr, Math.sin(a) * fr); X.rotate(-now * .2); K.rr(-11, 0, 22, 18, 5); K.ink(['#ff5c8a', '#ffe14d', '#5cff7a', '#4DB8FF'][i % 4], 2.5); X.restore(); }
        K.circ(0, 0, 10, '#ffe14d', '#d99b1a', 3); X.restore(); }
      // string lights
      K.curve(0, 96, 250, 134, 520, 100, 3, '#2b2640'); for (let i = 0; i < 12; i++) { const u = i / 11, bx = u * 520, by = (1 - u) * (1 - u) * 96 + 2 * u * (1 - u) * 134 + u * u * 100 + 6, on = won ? ['#ff5c8a', '#ffe14d', '#5cff7a', '#4DB8FF'][(i + (now * 8 | 0)) % 4] : lost ? '#6b6b8c' : ['#ff5c8a', '#ffe14d', '#5cff7a', '#4DB8FF'][i % 4]; if (!lost) { X.fillStyle = 'rgba(255,255,255,.2)'; X.beginPath(); X.arc(bx, by + 8, 11 + Math.sin(now * 4 + i) * 2, 0, K.TAU); X.fill(); } X.fillStyle = on; X.beginPath(); X.arc(bx, by + 8, 6, 0, K.TAU); X.fill(); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke(); }
      // the booth awning, and the owl on the left post who follows the target
      { const ax0 = TX - 130, ax1 = TX + 130, ay = 82; K.poly([[ax0, ay + 40], [ax0 + 14, ay], [ax1 - 14, ay], [ax1, ay + 40]], '#fff', 4); X.save(); X.beginPath(); X.moveTo(ax0, ay + 40); X.lineTo(ax0 + 14, ay); X.lineTo(ax1 - 14, ay); X.lineTo(ax1, ay + 40); X.closePath(); X.clip(); for (let i = 0; i < 9; i += 2) { X.fillStyle = '#e8553a'; X.fillRect(ax0 + i * 29, ay - 2, 29, 46); } X.restore();
        for (let i = 0; i < 9; i++) { X.beginPath(); X.arc(ax0 + 14.5 + i * 29, ay + 40, 14.5, 0, Math.PI); K.ink(i % 2 ? '#fff' : '#e8553a', 3); }
        const ox = TX - 92, oy = 104; X.save(); X.translate(ox, oy + 8); const look = clamp((Y - 290) / 140, -1, 1);
        K.cel(K.elP(0, -18, 17, 22), '#a5622c', '#7a4620', 4, 3, 3.5); K.el(0, -14, 10, 14); K.ink('#e6c58c', 2.5);
        X.beginPath(); X.moveTo(-14, -34); X.lineTo(-10, -48); X.lineTo(-3, -38); X.closePath(); K.ink('#a5622c', 2.5); X.beginPath(); X.moveTo(14, -34); X.lineTo(10, -48); X.lineTo(3, -38); X.closePath(); K.ink('#a5622c', 2.5);
        K.eye(-7, -28, 6.5, won ? 'happy' : lost ? 'bonk' : 'idle', [.2, look], now, 5); K.eye(7, -28, 6.5, won ? 'happy' : lost ? 'bonk' : 'idle', [.2, look], now, 6);
        X.beginPath(); X.moveTo(-3, -22); X.lineTo(3, -22); X.lineTo(0, -16); X.closePath(); K.ink('#ffb347', 2); X.restore(); }
      // the target: a bullseye with a face, it dodges
      { const P = K.elP(0, 0, 60, 60); X.save(); X.translate(TX, Y); K.cel(P, '#fff', '#c9d0e0', 7, 8, 5); K.el(0, 0, 44, 44); X.fillStyle = CLAY; X.fill(); K.el(0, 0, 28, 28); X.fillStyle = '#fff'; X.fill(); K.el(0, 0, 14, 14); X.fillStyle = GOLD; X.fill(); K.el(0, 0, 14, 14); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
        const lk = [clamp((SX - TX) / 300, -1, 1), clamp((SY - Y) / 200, -1, 1)], md = won ? 'happy' : lost ? 'panic' : 'idle';
        K.eye(-16, -8, 8.5, won ? 'bonk' : md, lk, now, 7); K.eye(16, -8, 8.5, won ? 'bonk' : md, lk, now, 8);
        X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();
        if (won) { X.moveTo(-9, 20); X.quadraticCurveTo(0, 14, 9, 20); X.stroke(); }
        else if (lost) { X.moveTo(-12, 17); X.quadraticCurveTo(0, 30, 12, 17); X.stroke(); K.el(8, 25, 5, 6); K.ink('#ff7a9a', 2); }
        else { X.moveTo(-11, 19); X.quadraticCurveTo(0, 25, 11, 17); X.stroke(); }
        X.restore(); }
      // Claude with the slingshot
      sdHero(90, 538, 7, g, { la: .7, ra: 1.15, k: 1.25, band: '#ffe14d' });
      K.line([[158, 538], [158, 478]], 8, '#a5622c'); K.line([[158, 478], [144, 450]], 7, '#a5622c'); K.line([[158, 478], [174, 452]], 7, '#a5622c');
      const starF = (sx2, sy2, r, rot) => { K.star(sx2, sy2, r, r * .46, 5, rot, GOLD, 4); X.save(); X.translate(sx2, sy2); X.fillStyle = INK; for (const sd of [-1, 1]) { X.beginPath(); X.arc(sd * 6, -2, 2.6, 0, K.TAU); X.fill(); } X.strokeStyle = INK; X.lineWidth = 2.4; X.beginPath(); X.arc(0, 2, 5, .2, Math.PI - .2); X.stroke(); X.restore(); };
      const v = pullVec();
      if (!proj && stars > 0 && !g.result) {
        const px = v ? SX - v.x * .35 : SX, py = v ? SY - v.y * .35 : SY;
        K.curve(144, 450, (144 + px) / 2, (450 + py) / 2 + 6, px, py, 3, '#ff5c8a'); K.curve(174, 452, (174 + px) / 2, (452 + py) / 2 + 6, px, py, 3, '#ff5c8a');
        starF(px, py, 26, spin);
        if (v) {
          if (anchor && cur) { X.strokeStyle = 'rgba(255,255,255,.6)'; X.lineWidth = 4; X.beginPath(); X.moveTo(anchor.x, anchor.y); X.lineTo(cur.x, cur.y); X.stroke(); }
          let x = SX, y = SY, vx = v.x * K0, vy = v.y * K0;
          X.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { vy += G * .06; x += vx * .06; y += vy * .06; X.globalAlpha = 1 - i / 10; X.beginPath(); X.arc(x, y, 5, 0, 7); X.fill(); } X.globalAlpha = 1;
          if (v.kb) K.meter(250, 506, 300, 22, v.l > 0 ? (v.l - 40) / 110 : 0, GOLD, null);
        }
      } else if (!g.result) K.curve(144, 450, 159, 454, 174, 452, 3, '#ff5c8a');
      if (proj) starF(proj.x, proj.y, 26, spin * 3);
      // the star crate: one star per shot left
      K.rr(212, 498, 84, 40, 6); K.cel(K.rrP(212, 498, 84, 40, 6), '#d9944f', '#a5622c', 5, 4, 4); X.fillStyle = '#b06d33'; X.fillRect(212, 512, 84, 4);
      for (let i = 0; i < 2; i++) { if (i < stars) K.star(238 + i * 34, 494, 18, 8.5, 5, Math.sin(now * 2 + i) * .15, GOLD, 3); else { K.el(238 + i * 34, 498, 14, 5); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill(); } }
      if (won) { for (let i = 0; i < 3; i++) K.heart(64 + i * 28, 440 - ot * 24 - i * 4, .9, Math.max(0, 1 - ot * 1.1)); }
      if (lost) for (let i = 0; i < 3; i++) K.star(90 + (i - 1) * 26, 468 + Math.sin(now * 10 + i) * 4, 8, 3.5, 5, now * 4 + i, YEL, 2);
      vignette(.2);
    }
  };
  return g;
}
reg('sd_star', sdStar, 'Star Struck');


})();
