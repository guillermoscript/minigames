'use strict';
/* CRITTER CLUB - farmyard animal microgames: SHOO, HERD, TEASE, RUN, WIGGLE, GRAB, LICK, PINCH.
   Input model (works on touch and desktop): everything is driven by down/move/up (pointer) plus optional keys.
   Pointer-follow games keep a persistent target so a lifted finger never "teleports" anything, and never rely on hover.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/move/up}; g.result = 'win'|'lose'
   Art: the DUO look (docs/ART-STYLE.md). Gameplay and RNG are untouched; all cosmetic motion is a function of `now` or a hash. */
(function () {

const GRASS = '#86DE5C', GRASS2 = '#78d34f', BARN = '#E8553D', BUTTER = '#FFD966', SKY = '#6EC6FF', PINK = '#FF9EC0',
  BROWN = '#A86B3C', CREAM = '#FFF3D6', YEL = '#FFE14D', MINT = '#5CFF7A', RED = '#ff4d4d', ORG = '#F5A84A';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const ccMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const ccLose = (x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 14); ring(x, y, RED, 80); };
const ccWin = (x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 34); ring(x, y, '#fff', 110); };
/* survive-the-clock games: win the moment the clock runs out (with fanfare) */
const survive = g => { if (!g.result && g.c >= g.dur) { g.result = 'win'; ccWin(); } };

/* ───────────── art kit (DUO look): a local copy of the DUO drawing helpers. Everything draws on X, which can be swapped for an
   offscreen context so the same code bakes the static scene once. Cosmetic only: nothing here calls Math.random. ───────────── */
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
const { rr, el, ink, ce, cr, gl } = K;

/* ── shared critters (y = feet; live drawing on ctx) ── */
function strawHat(u) {                                  // origin at caos()'s feet
  const y0 = -9 * u;
  el(0, y0 - 1.2 * u, 7.6 * u, 1.5 * u); ink('#f2c94c', 3);
  K.cr(-4.1 * u, y0 - 5.4 * u, 8.2 * u, 4.4 * u, 1.6 * u, '#f6d35e', '#d9a82c', 3, u * .5, 0);
  ctx.fillStyle = '#e8433a'; ctx.fillRect(-4.1 * u + 1.5, y0 - 2.6 * u, 8.2 * u - 3, 1.1 * u);
}
function carrot(x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  K.poly([[-9, 0], [9, 0], [0, 34]], '#ff8a2b', 3); ctx.strokeStyle = '#d96a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(2, 8); ctx.moveTo(-2, 18); ctx.lineTo(3, 18); ctx.stroke();
  for (const a of [-.5, 0, .5]) { ctx.save(); ctx.rotate(a); ce(0, -10, 4, 12, '#4ec65a', '#2f9a3a', 2.5); ctx.restore(); }
  ctx.restore();
}
function bunny(x, y, s, o) {
  o = o || {}; const sq = o.sq || 0, mood = o.mood || 'calm', sc = mood === 'scared', W0 = '#fbf6ee', S0 = '#d6cfe6', T = now, lk = o.look || [0, 0];
  K.shade(x, y + 2, 30 * s, 8 * s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 + sq * .15), s * (1 - sq * .15));
  const ea = sc ? .6 : .12 + Math.sin(T * 2 + x) * .05;
  for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 12, -72); ctx.rotate(sd * ea); ce(0, -14, 8, sc ? 18 : 24, W0, S0, 3.5, 0); ctx.fillStyle = '#ffb3c9'; el(0, -12, 3.6, sc ? 10 : 15); ctx.fill(); ctx.restore(); }
  ce(-27, -26, 10, 10, '#fff', '#e3dcee', 3);
  ce(0, -28, 27, 24, W0, S0, 4); K.gl(-9, -38, 8, 4.5, .45);
  ce(-12, -5, 11, 6.5, W0, S0, 3); ce(12, -5, 11, 6.5, W0, S0, 3);
  ce(0, -56, 20, 17, W0, S0, 4);
  ctx.fillStyle = 'rgba(255,110,165,.5)'; for (const sd of [-1, 1]) { el(sd * 13, -49, 5, 3); ctx.fill(); }
  const em = sc ? 'panic' : mood === 'happy' ? 'happy' : 'idle';
  K.eye(-8, -59, 5.6, em, lk, T, 0); K.eye(8, -59, 5.6, em, lk, T, 1);
  el(0, -52, 3.4, 2.6); ink('#ff8fb0', 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(0, -47); ctx.moveTo(-11, -52); ctx.lineTo(-24, -54); ctx.moveTo(-11, -49); ctx.lineTo(-24, -47); ctx.moveTo(11, -52); ctx.lineTo(24, -54); ctx.moveTo(11, -49); ctx.lineTo(24, -47); ctx.stroke();
  rr(-3.6, -47, 7.2, 6.4, 2); ink('#fff', 2);
  if (o.carrot) carrot(11, -44, .55, 1.9);
  if (sc) K.sweat(22, -78, .9, T + x);
  ctx.restore();
}
function pigA(x, y, s, dir, o) {                        // side view, feet at (x, y)
  o = o || {}; const T = now, mood = o.mood || 'calm', run = o.run ? Math.sin((o.t || 0) * 22) * 4 : 0, B = '#ffa3c2', S = '#e07aa0';
  K.shade(x, y + 2, 44 * s, 9 * s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  for (const [lx, w] of [[-26, run], [14, -run], [-12, -run], [26, run]]) K.cr(lx, -20 + w, 11, 20, 4, '#f57fa8', '#c95d86', 3, 2, 0);
  ctx.beginPath(); ctx.arc(-40, -42, 8, .5, 5.5); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#f57fa8'; ctx.stroke();
  ce(0, -36, 39, 28, B, S, 4.5); K.gl(-12, -48, 11, 5, .45);
  K.cp([[20, -62], [32, -84], [42, -58]], '#f57fa8', '#c95d86', 3, 2, 2);
  ce(32, -44, 22, 20, B, S, 4); K.gl(24, -54, 7, 3.5, .4);
  ce(50, -38, 10, 12, '#ff8fb5', '#e0678f', 3);
  ctx.fillStyle = INK; el(47, -38, 1.8, 3.2); ctx.fill(); el(53, -38, 1.8, 3.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,90,140,.45)'; el(26, -38, 5, 3.2); ctx.fill();
  K.eye(34, -50, 5.6, mood === 'fear' ? 'panic' : mood === 'happy' ? 'happy' : 'idle', [dir * .6, .2], T, 0);
  if (mood === 'happy') { ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(42, -33, 6, .2, 2.4); ctx.stroke(); }
  if (mood === 'fear') K.sweat(16, -64, .9, T);
  ctx.restore();
}
function dogA(x, y, s, dir, o) {
  o = o || {}; const T = now, w = Math.sin((o.t || 0) * 24) * 5, DK = '#8a4f24', mood = o.mood || 'mad';
  K.shade(x, y + 2, 40 * s, 8 * s);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  for (const [lx, ww] of [[-26, w], [14, -w], [-12, -w], [26, w]]) K.cr(lx, -22 + ww, 11, 22, 4, '#a8672f', DK, 3, 2, 0);
  ctx.save(); ctx.translate(-36, -46); ctx.rotate(-.7 + Math.sin(T * (mood === 'happy' ? 14 : 20)) * .25); ce(0, -12, 7, 15, BROWN, DK, 3); ctx.restore();
  ce(0, -38, 38, 24, '#c9803f', '#9b5d2a', 4.5); K.gl(-12, -48, 11, 5, .4);
  ce(34, -52, 22, 19, '#d99350', '#b06d33', 4);
  ce(50, -46, 13, 10, '#f3d9a8', '#d2aa72', 3); ce(61, -49, 4.5, 3.6, INK, INK, 0);
  const j = o.chomp ? 11 : o.mouth ? 5 : 0;
  if (j) { el(53, -38 + j * .3, 9, 3 + j); ink('#8b1d2c', 2.5); ctx.fillStyle = '#fff'; for (const tx of [48, 54, 60]) { ctx.beginPath(); ctx.moveTo(tx - 2, -41 - j * .2); ctx.lineTo(tx + 2, -41 - j * .2); ctx.lineTo(tx, -35 - j * .2); ctx.fill(); } }
  if (mood === 'happy' || o.tongue) { ce(54, -32 + Math.sin(T * 12) * 2, 5, 9, '#ff7a9a', '#d85078', 2.5); }
  ce(24, -54, 9, 18, BROWN, DK, 3, .3);
  K.eye(41, -58, 6, mood === 'happy' ? 'happy' : 'idle', [dir * .5, .3], T, 0);
  if (mood === 'mad') { ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(33, -69); ctx.lineTo(48, -63); ctx.stroke(); }
  if (mood === 'happy') K.sweat(22, -74, .9, T);
  ctx.restore();
}
function henA(x, y, s, o) {                             // front/side hen, feet at (x, y)
  o = o || {}; const T = now, bob = o.peck ? Math.sin(T * 14) * 3 : 0, W0 = '#fffdf8', S0 = '#e3dccb';
  ctx.save(); ctx.translate(x, y - (o.lift || 0)); ctx.scale(s, s);
  K.shade(0, (o.lift || 0) / s + 2, 56, 10, .22);
  ctx.save(); ctx.translate(-48, -62); ctx.rotate(-.3); ce(-6, -12, 14, 26, '#f1ead9', S0, 3.5, .2); ctx.restore();
  ce(0, -50, 52, 42, W0, S0, 5); K.gl(-18, -68, 16, 7, .55);
  ce(-6, -46, 28, 19, '#f3ecdb', '#d6ceb9', 3, .2);
  for (const lx of [-12, 14]) { K.line([[lx, -10], [lx, 0]], 4, '#ffb43a'); K.poly([[lx - 7, 2], [lx + 7, 2], [lx, -3]], '#ffb43a', 2.5); }
  ce(30, -96 + bob, 22, 20, W0, S0, 4.5);
  for (const [cx, cy, r] of [[26, -118, 7], [36, -119, 7], [31, -123, 8]]) { ctx.beginPath(); ctx.arc(cx, cy + bob, r, 0, 7); ink('#ff4d4d', 3); }
  K.poly([[46, -100 + bob], [68, -94 + bob], [46, -88 + bob]], '#ffb43a', 3);
  ce(48, -82 + bob, 5, 8, '#ff4d4d', '#c92a3a', 3);
  ctx.fillStyle = 'rgba(255,110,140,.5)'; el(38, -90 + bob, 5, 3); ctx.fill();
  K.eye(31, -102 + bob, 5.2, o.dizzy ? 'bonk' : o.happy ? 'happy' : o.panic ? 'panic' : 'idle', [.5, .3], T, 1);
  ctx.restore();
}
function eggA(x, y, r, glow) {
  if (glow) K.rays(x, y, 64, now, .5);
  ce(x, y, r * .8, r, '#ffe27a', '#e0a92c', 4); K.gl(x - r * .25, y - r * .35, r * .15, r * .3, .7, .3);
}

/* ───────── 1 SHOO: rabbits creep out of the garden; tap one to scare it back towards the centre ───────── */
const W0 = 800;
let BG_HARE = null;
function hareBG() {
  if (BG_HARE) return BG_HARE;
  return BG_HARE = K.bake(W, H, () => {
    const X = K.cx(), CX = 400, CY = 310, FA = 394, FB = 258;
    K.ground(0, '#9be36b', '#62bd48', 1, 26, 14);
    // the vegetable patch: soil, furrows, cabbages and carrot tops
    ce(CX, CY + 10, 122, 80, '#a06f44', '#7e5230', 4.5);
    X.save(); el(CX, CY + 10, 118, 76); X.clip(); X.strokeStyle = '#7e5230'; X.lineWidth = 3; X.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(CX - 120, CY + 10 + i * 20 - 10); X.quadraticCurveTo(CX, CY + 10 + i * 20 + 12, CX + 120, CY + 10 + i * 20 - 10); X.stroke(); }
    X.restore();
    for (let i = 0; i < 9; i++) {
      const a = i * .7, cx = CX + Math.cos(a) * (50 + i % 3 * 18), cy = CY + 14 + Math.sin(a) * (30 + i % 2 * 14);
      if (i % 3 === 0) { ce(cx, cy, 13, 11, '#6fd36a', '#3f9a4a', 3); K.gl(cx - 4, cy - 4, 4, 3, .5); }
      else { K.poly([[cx - 6, cy], [cx + 6, cy], [cx, cy - 14]], '#4ec65a', 2.5); K.poly([[cx - 3, cy], [cx + 3, cy], [cx, cy + 8]], '#ff8a2b', 2); }
    }
    // the fence ring: two rails and posts all round (the line the rabbits must not cross)
    const posts = (front) => { for (let i = 0; i < 34; i++) { const a = i * 6.2832 / 34 + .05, sn = Math.sin(a); if ((sn >= 0) !== front) continue; K.post(CX + Math.cos(a) * FA, CY + sn * FB + 6, 20 + sn * 6, 10); } };
    posts(false); K.ering(CX, CY, FA, FB - 4, 6, '#d9944f'); K.ering(CX, CY, FA, FB - 14, 6, '#e9a45f'); posts(true);
  });
}
function crow(x, y, T) {                               // perched on a fence post, watching
  const flap = Math.sin(T * .7) > .92 ? Math.sin(T * 30) : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(.9, .9);
  K.cp([[-18, -8], [-34, -2], [-16, -16]], '#3a3350', '#262038', 3, 1, 1);
  ce(0, -16, 17, 14, '#4a4266', '#2b2540', 3.5); ce(-2 + flap * 2, -18 + flap * -7, 11, 7, '#3a3350', '#262038', 3, -.5 + flap * .4);
  ce(13, -32, 10, 9, '#4a4266', '#2b2540', 3.5); K.poly([[21, -33], [31, -30], [21, -27]], '#ffb43a', 2.5);
  ctx.fillStyle = '#fff'; el(15, -35, 3.4, 3.4); ctx.fill(); ctx.fillStyle = INK; el(16, -35, 1.6, 1.6); ctx.fill();
  ctx.restore();
}
function butterfly(x, y, T, col) {
  const f = Math.abs(Math.sin(T * 14)); ctx.save(); ctx.translate(x, y);
  for (const sd of [-1, 1]) { ce(sd * 7 * f, -3, 8 * f + 2, 8, col, K.mix(col, '#14101c', .25), 2.5, sd * .5); ce(sd * 5 * f, 6, 5 * f + 1.5, 5, '#fff3a0', '#e8c860', 2, sd * -.4); }
  ctx.fillStyle = INK; el(0, 1, 2, 8); ctx.fill(); ctx.restore();
}

/* ───────── 1 SHOO: rabbits creep out of the garden; tap one to scare it back towards the centre ───────── */
function ccHare(sp) {
  const rs = Math.sqrt(sp), N = sp > 1.8 ? 4 : 3, CX = 400, CY = 310, R0 = 130, ROUT = 330;
  const hares = []; let c = 0;
  for (let i = 0; i < N; i++) hares.push({ a: i * 6.283 / N + rnd(-.3, .3), r: R0 + rnd(0, 50), v: rnd(58, 70) * rs, hop: rnd(0, 6), back: 0, scared: 0, delay: .45 + i * .3 });
  const hp = h => ({ x: CX + Math.cos(h.a) * h.r * 1.15, y: CY + Math.sin(h.a) * h.r * .78 });
  let shooT = -9; const ot = K.outro();
  const scare = h => {
    if (g.result) return;
    const q = hp(h); h.back = Math.min(135, h.r - 45); h.scared = .45; h.delay = 0; shooT = now;
    sfx.pop(); burst(q.x, q.y - 30, '#fff', 8, 200); ring(q.x, q.y - 30, YEL, 56, .3); floatText('SHOO!', q.x, q.y - 90, YEL, 30);
  };
  const g = {
    get c() { return c; }, cmd: 'SHOO!', hint: 'CLICK THE RABBITS (OR SPACE) TO SHOO THEM BACK', thint: 'TAP THE RABBITS TO SHOO THEM BACK', dur: 5.6, timeWin: true,
    down(p) {
      if (g.result) return;
      let b = null, bd = 82;
      for (const h of hares) { const q = hp(h), d = Math.hypot(p.x - q.x, p.y - (q.y - 45)); if (d < bd) { bd = d; b = h; } }
      if (b) scare(b); else sfx.tick();
    },
    key(e) {
      if (e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return;
      let b = null; for (const h of hares) if (!b || h.r > b.r) b = h;
      if (b) scare(b);
    },
    update(dt) {
      ot.mark(g);
      c += dt; survive(g); if (g.result) return;
      for (const h of hares) {
        h.scared = Math.max(0, h.scared - dt);
        if (h.delay > 0) { h.delay -= dt; continue; }
        h.hop += dt * 7;
        if (h.back > 0) { const s = Math.min(h.back, 900 * dt); h.r -= s; h.back -= s; }
        else h.r += h.v * (.4 + 1.2 * Math.max(0, Math.sin(h.hop))) * dt;
        h.a += Math.sin(c * 1.3 + h.hop * .1) * .12 * dt;
        if (h.r >= ROUT) { const q = hp(h); g.result = 'lose'; ccLose(q.x, q.y); floatText('IT ESCAPED!', 400, 300, RED, 44); break; }
      }
    },
    draw(t) {
      const T = now, oT = ot.t(g), win = g.result === 'win', lose = g.result === 'lose';
      ctx.drawImage(hareBG(), 0, 0);
      ctx.fillStyle = 'rgba(20,16,28,.06)'; for (let i = 0; i < 3; i++) { el(((T * 14 + i * 330) % 1100) - 150, 130 + i * 190, 120, 36); ctx.fill(); }   // cloud shadows drift over the field
      crow(104, 126, T);
      const bf = T * .4; butterfly(400 + Math.sin(bf) * 330, 200 + Math.sin(bf * 1.7) * 60 + Math.cos(bf * .6) * 120, T, '#ff8fb0');
      const list = hares.map(h => ({ h, q: hp(h) }));
      const items = list.map(({ h, q }) => ({ y: q.y, f: () => {
        const hopY = h.delay > 0 || h.back > 0 ? 0 : Math.abs(Math.sin(h.hop)) * 16, near = h.r > ROUT - 70, esc = lose && h.r >= ROUT;
        const mood = win || esc ? 'happy' : (h.scared > 0 || near) ? 'scared' : 'calm', dy = esc ? -Math.abs(Math.sin(oT * 9)) * 26 : win ? -Math.abs(Math.sin(oT * 8 + h.hop)) * 14 : -hopY;
        bunny(q.x, q.y + dy, .95, { mood, carrot: esc, look: [(CX - q.x) / 260, (CY - q.y) / 160], sq: h.back > 0 ? .6 : (Math.sin(h.hop) < -.7 && h.delay <= 0 ? .5 : 0) });
      } }));
      items.push({ y: CY + 40, f: () => {
        const rec = clamp((T - shooT) / .5, 0, 1), up = shooT > 0 && rec < 1, jump = win ? Math.abs(Math.sin(oT * 9)) * 16 : 0;
        K.shade(CX, CY + 42, 36, 8, .3);
        ctx.save(); ctx.translate(CX, CY + 40 - jump);
        const sw = up ? Math.sin(T * 34) * .35 : 0;
        K.arms(6, win ? -.35 : up ? -.7 + sw : -2.55 + Math.sin(T * 1.4) * .08, win ? .35 : up ? .7 - sw : 2.55 - Math.sin(T * 1.4) * .08, 1);
        caos(0, 0, 6, { mood: ccMood(g) }); strawHat(6);
        if (lose) K.sweat(34, -56, 1, T);
        ctx.restore();
      } });
      items.sort((a, b) => a.y - b.y).forEach(i => i.f());
      K.pill(CX, CY - 80, 'YOU', YEL, true);
      for (const { h, q } of list) {
        const near = h.r > ROUT - 70, hopY = h.delay > 0 || h.back > 0 ? 0 : Math.abs(Math.sin(h.hop)) * 16;
        if (near && !g.result) { ctx.globalAlpha = .5 + .5 * Math.sin(now * 20); txt('!', clamp(q.x, 30, 770), Math.max(q.y - 118 - hopY, 100), 36, RED); ctx.globalAlpha = 1; }
        if (win && oT < .95) K.heart(q.x + 18, q.y - 104 - oT * 50, 1.1, 1 - oT / .95);
      }
      vignette(.2);
    }
  };
  return g;
}
reg('cc_hare', ccHare, 'Hare Scare');

/* ───────── 2 HERD: the pig flees you; drive it into the pen ───────── */
let BG_PIG = null;
function windmillBody(x, y) {
  K.cp([[x - 20, y], [x + 20, y], [x + 12, y - 30], [x - 12, y - 30]], '#f3e6c8', '#d3bd8c', 3.5, 4, 0);
  K.cr(x - 6, y - 18, 12, 18, 6, '#a86b3c', '#7a4a22', 3, 2, 0);
  K.cp([[x - 16, y - 28], [x + 16, y - 28], [x, y - 46]], '#e8553d', '#b8352a', 3.5, 3, 3);
}
function penFrame(back) {                                // the pen's wooden walls (collision rects: [548,188,224,12] [548,400,224,12] [760,188,12,224])
  if (back) {
    K.cr(548, 186, 224, 14, 4, '#e3a868', '#b87a3e', 3.5, 2, 3); for (let i = 0; i < 5; i++) K.post(560 + i * 52, 204, 32, 12);
  } else {
    K.cr(548, 398, 224, 14, 4, '#e3a868', '#b87a3e', 3.5, 2, 3); K.cr(758, 188, 14, 224, 4, '#e3a868', '#b87a3e', 3.5, 2, 3);
    for (let i = 0; i < 5; i++) K.post(560 + i * 52, 424, 34, 12); K.post(765, 214, 30, 12); K.post(765, 412, 34, 12);
    for (const py of [200, 392]) { K.cr(540, py - 22, 14, 44, 4, '#c4874e', '#8d5a2a', 3.5, 2, 2); }   // the gate posts
  }
}
function ccPig(sp) {
  const rs = Math.sqrt(sp), PR = 30, FR = 190, MINX = 40, MAXX = 760, MINY = 130, MAXY = 530;
  const walls = [[548, 188, 224, 12], [548, 400, 224, 12], [760, 188, 12, 224]];
  let held = false, c = 0, mx = 110, my = 500, tx = 110, ty = 500, px = 260, py = 300 + rnd(-110, 110), vx = 0, vy = 0, fear = 0, oinkT = 0, face = 1, pt = 0;
  const ot = K.outro();
  const g = {
    get c() { return c; }, cmd: 'HERD!', hint: 'MOUSE OR ARROWS: HERD THE PIG INTO THE PEN', thint: 'DRAG TO HERD THE PIG INTO THE PEN', dur: 6,
    down(p) { held = true; tx = p.x; ty = p.y; }, move(p) { if (!TOUCH || held) { tx = p.x; ty = p.y; } }, up() { held = false; },
    update(dt) {
      ot.mark(g);
      c += dt; pt += dt; oinkT -= dt; fear = Math.max(0, fear - dt);
      if (g.result) { vx *= .9; vy *= .9; return; }
      let kx = 0, ky = 0;
      if (keys.ArrowLeft || keys.KeyA) kx -= 1; if (keys.ArrowRight || keys.KeyD) kx += 1;
      if (keys.ArrowUp || keys.KeyW) ky -= 1; if (keys.ArrowDown || keys.KeyS) ky += 1;
      if (kx || ky) { const l = Math.hypot(kx, ky); mx += kx / l * 380 * dt; my += ky / l * 380 * dt; tx = mx; ty = my; }
      else { const d = Math.hypot(tx - mx, ty - my), s = Math.min(d, 650 * dt); if (d > .01) { mx += (tx - mx) / d * s; my += (ty - my) / d * s; } }
      mx = clamp(mx, 20, 780); my = clamp(my, 90, 548);
      const dx = px - mx, dy = py - my, d = Math.hypot(dx, dy) || 1;
      if (d < FR) {
        const k = 1 - d / FR, push = 250 * rs * (.4 + k), ux = dx / d, uy = dy / d;
        const side = Math.sign(300 - py) || 1, wx = -uy * side, wy = ux * side;
        const bx = ux * push + wx * 70 * k * (wy * side > 0 ? 1 : .3), by = uy * push + wy * 70 * k * .5;
        vx += (bx - vx) * Math.min(1, dt * 9); vy += (by - vy) * Math.min(1, dt * 9);
        fear = .25; if (oinkT <= 0 && k > .5) { oinkT = 1.2; sfx.boing(); }
      } else { vx *= 1 - Math.min(1, dt * 4); vy *= 1 - Math.min(1, dt * 4); }
      px += vx * dt; py += vy * dt;
      if (Math.abs(vx) > 8) face = vx > 0 ? 1 : -1;
      if (px < MINX) { px = MINX; vx = Math.max(0, vx); } if (px > MAXX) { px = MAXX; vx = Math.min(0, vx); }
      if (py < MINY) { py = MINY; vy = Math.max(0, vy); } if (py > MAXY) { py = MAXY; vy = Math.min(0, vy); }
      for (const w of walls) {
        const nx = clamp(px, w[0], w[0] + w[2]), ny = clamp(py - 20, w[1], w[1] + w[3]), ddx = px - nx, ddy = py - 20 - ny, dd = Math.hypot(ddx, ddy);
        if (dd < PR) {
          if (dd > .001) { px = nx + ddx / dd * PR; py = ny + 20 + ddy / dd * PR; const dv = vx * ddx / dd + vy * ddy / dd; if (dv < 0) { vx -= dv * ddx / dd; vy -= dv * ddy / dd; } }
          else { py -= PR; vy = -Math.abs(vy); }
        }
      }
      if (px > 585 && py > 218 && py < 392) {
        g.result = 'win'; ccWin(px, py); sfx.boing(); floatText('OINK!', px, py - 90, PINK, 46);
      }
    },
    draw(t) {
      const T = now, oT = ot.t(g), win = g.result === 'win', lose = g.result === 'lose';
      if (!BG_PIG) BG_PIG = K.bake(W, H, () => {
        const X = K.cx(); X.fillStyle = K.vg(0, 114, [[0, '#4cb4ee'], [.6, '#8fdbfb'], [1, '#dcf8ff']]); X.fillRect(0, 0, W, 114);
        K.hills(0, W, 112, 36, .006, 1.2, '#b9e5cf', null); K.hills(0, W, 112, 24, .009, 3, '#87d19b', '#4f9a6a', 3);
        windmillBody(250, 114);
        K.ground(114, '#9be36b', '#62bd48', 2, 20, 12); K.horizon(114, 0, W, 4);
        // a trodden path to the gate and the hay in the pen
        X.fillStyle = 'rgba(214,168,104,.55)'; X.beginPath(); X.ellipse(430, 300, 150, 34, -.04, 0, K.TAU); X.fill();
        K.cr(548, 196, 212, 208, 6, '#ffd966', '#e0b840', 3.5, 4, 4);
        X.strokeStyle = '#d9a82c'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 14; i++) { const hx = 560 + K.hash(i) * 190, hy = 212 + K.hash(i + 5) * 176; X.beginPath(); X.moveTo(hx, hy); X.lineTo(hx + 16, hy + 8); X.stroke(); }
        // the PEN sign on two posts
        K.post(604, 168, 40, 8); K.post(704, 168, 40, 8); K.cr(584, 128, 140, 42, 8, '#e9a35c', '#a5622c', 4, 3, 4);
      });
      ctx.drawImage(BG_PIG, 0, 0);
      for (const [cx0, cy0, s0, sp0] of [[80, 40, 1, 7], [330, 66, .8, 5], [580, 34, 1.1, 6]]) K.cloud(((cx0 + T * sp0) % 1000) - 150, cy0, s0);
      // windmill blades
      ctx.save(); ctx.translate(250, 76); ctx.rotate(T * (win ? 2.4 : .7));
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); K.cr(-3, -38, 6, 38, 3, '#fff', '#d6cfe6', 3, 2, 0); K.cr(-13, -37, 10, 22, 2, '#fffdf4', '#e3d8b0', 2.5, 1, 1); }
      ctx.restore(); ctx.beginPath(); ctx.arc(250, 76, 6, 0, 7); ink('#e8553d', 3);
      txt('PEN', 654, 150, 28, '#fff');
      // a hen pecking by the fence (background gag)
      henA(300 + Math.sin(T * .4) * 20, 150, .34, { peck: true });
      // dust trail hint arrow
      ctx.globalAlpha = .55 + .3 * Math.sin(now * 5); drawArrow(520, 300, 1, 18, '#fff'); ctx.globalAlpha = 1;
      // herder zone
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.arc(mx, my, FR, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const flee = fear > 0 && !g.result, run = Math.hypot(vx, vy) > 40, jump = win ? Math.abs(Math.sin(oT * 9)) * 14 : 0;
      const items = [{ y: 200, f: () => penFrame(true) },
        { y: py + 20, f: () => pigA(px, py + 20 - (win ? Math.abs(Math.sin(oT * 8)) * 10 : 0), 1.1, face, { run, t: pt, mood: win ? 'happy' : flee ? 'fear' : 'calm' }) },
        { y: my, f: () => {
          K.shade(mx, my + 2, 28, 8, .25); ctx.save(); ctx.translate(mx, my - jump);
          const ph = Math.hypot(tx - mx, ty - my) > 4 || kxy(); const sw = ph ? Math.sin(now * 18) * .5 : 0;
          K.arms(4.5, win ? -.4 : -2.2 + sw, win ? .4 : 2.2 - sw, 1); caos(0, 0, 4.5, { mood: ccMood(g) }); strawHat(4.5);
          if (lose) K.sweat(26, -42, .9, now); ctx.restore(); K.pill(mx, my - 76, 'YOU', YEL, true);
        } },
        { y: 412, f: () => penFrame(false) }];
      items.sort((a, b) => a.y - b.y).forEach(i => i.f());
      if (win && oT < .95) for (let i = 0; i < 3; i++) K.heart(px + (i - 1) * 24, py - 80 - oT * 46 - i * 8, 1.1, 1 - oT / .95);
      vignette(.2);
    }
  };
  const kxy = () => keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown || keys.KeyA || keys.KeyD || keys.KeyW || keys.KeyS;
  return g;
}
reg('cc_pig', ccPig, 'Bacon Patrol');

/* ───────── 3 TEASE: dangle the toy; dodge the paw before it lands ───────── */
let BG_CAT = null;
function catA(x, y, s, o) {                              // front view, feet at (x, y)
  o = o || {}; const T = now, lx = o.lx || 0, ly = o.ly || 0, D = '#d98a2e', mood = o.mood || 'bored';
  K.shade(x, y + 3, 78 * s, 12 * s, .28);
  ctx.save(); ctx.translate(x + (o.sway || 0), y); ctx.scale(s, s * (1 - (o.crouch || 0) * .08));
  const wag = mood === 'smug' ? Math.sin(T * 9) * 30 : Math.sin(T * 4) * 20;
  ctx.beginPath(); ctx.moveTo(60, -30); ctx.bezierCurveTo(120, -20, 120 + wag, -110, 80, -120); ctx.lineCap = 'round'; ctx.lineWidth = 34; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 22; ctx.strokeStyle = D; ctx.stroke(); ctx.lineWidth = 14; ctx.strokeStyle = ORG; ctx.translate(-2, -3); ctx.stroke(); ctx.translate(2, 3);
  ce(0, -62, 62, 62, ORG, D, 5); K.gl(-26, -90, 16, 8, .4);
  ce(0, -46, 36, 44, CREAM, '#ecd9b0', 0);
  ce(-34, -6, 26, 13, ORG, D, 4); ce(34, -6, 26, 13, ORG, D, 4);
  for (const k of [-1, 1]) { K.cp([[k * 52, -156], [k * 34, -202], [k * 12, -164]], ORG, D, 4.5, 2, 2); K.poly([[k * 44, -164], [k * 34, -188], [k * 22, -168]], PINK, 0); }
  ce(0, -138, 56, 46, ORG, D, 5); K.gl(-26, -158, 14, 6, .4);
  ctx.strokeStyle = D; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(k * 14, -182); ctx.lineTo(k * 14, -168); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,110,150,.45)'; for (const k of [-1, 1]) { el(k * 38, -122, 9, 5.5); ctx.fill(); }
  for (const k of [-1, 1]) {
    const ex = k * 22, ey = -140;
    if (mood === 'sleep' || mood === 'smug') { ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); if (mood === 'sleep') ctx.arc(ex, ey - 4, 11, .15, Math.PI - .15); else ctx.arc(ex, ey + 6, 11, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); continue; }
    const foc = mood === 'focus';
    el(ex, ey, 13, foc ? 16 : 13); ink('#E6FF70', 3);
    ctx.save(); el(ex, ey, 13, foc ? 16 : 13); ctx.clip();
    ctx.fillStyle = INK; el(ex + lx * 5, ey + ly * 5, foc ? 8.5 : 3.8, foc ? 12 : 11); ctx.fill();
    ctx.fillStyle = '#fff'; el(ex + lx * 5 - 2.5, ey + ly * 5 - 5, 2.6, 2.6); ctx.fill();
    if (!foc) { ctx.fillStyle = ORG; ctx.fillRect(ex - 16, ey - 16, 32, 15); ctx.fillStyle = D; ctx.fillRect(ex - 16, ey - 3, 32, 3); }
    ctx.restore();
  }
  K.poly([[-6, -124], [6, -124], [0, -116]], PINK, 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -116); ctx.lineTo(0, -110);
  if (mood === 'smug') { ctx.moveTo(-16, -112); ctx.quadraticCurveTo(0, -92, 16, -112); }
  else { ctx.moveTo(0, -110); ctx.quadraticCurveTo(-8, -102, -14, -108); ctx.moveTo(0, -110); ctx.quadraticCurveTo(8, -102, 14, -108); }
  ctx.stroke();
  for (const k of [-1, 1]) for (const j of [-6, 4]) { ctx.beginPath(); ctx.moveTo(k * 30, -118 + j * .5); ctx.lineTo(k * 62, -118 + j * 2); ctx.stroke(); }
  ctx.restore();
}
function ccCat(sp) {
  const rs = Math.sqrt(sp), CATX = 400, CATY = 520, SHX = 400, SHY = 430, HIT = 68;
  const W = .7 / rs, LOCK = W - .3 / rs, STR = .09, HOLD = .24, RET = .2, GAP = .28 / rs;
  let held = false, c = 0, tx = 400, ty = 190, x = 400, y = 190, ph = 'idle', pt = .9, aim = { x: 400, y: 200 }, locked = false, ext = 0, caught = false, swipes = 0;
  const ot = K.outro();
  const g = {
    get c() { return c; }, cmd: 'TEASE!', hint: 'MOUSE OR ARROWS: KEEP THE TOY OUT OF THE PAW', thint: 'DRAG THE TOY AWAY FROM THE PAW', dur: 5.6, timeWin: true,
    down(p) { held = true; tx = p.x; ty = p.y; }, move(p) { if (!TOUCH || held) { tx = p.x; ty = p.y; } }, up() { held = false; },
    update(dt) {
      ot.mark(g);
      c += dt; survive(g);
      let kx = 0, ky = 0;
      if (keys.ArrowLeft || keys.KeyA) kx -= 1; if (keys.ArrowRight || keys.KeyD) kx += 1;
      if (keys.ArrowUp || keys.KeyW) ky -= 1; if (keys.ArrowDown || keys.KeyS) ky += 1;
      if (kx || ky) { tx += kx * 560 * dt; ty += ky * 560 * dt; }
      tx = clamp(tx, 50, 750); ty = clamp(ty, 120, 545);
      if (!caught) { x += (tx - x) * Math.min(1, dt * 14); y += (ty - y) * Math.min(1, dt * 14); }
      else { x += 300 * dt; y -= 200 * dt; }
      pt -= dt;
      if (ph === 'idle') { ext = Math.max(0, ext - dt * 6); if (pt <= 0 && !g.result) { ph = 'wind'; pt = W; locked = false; } }
      else if (ph === 'wind') {
        if (!locked) { aim.x += (x - aim.x) * Math.min(1, dt * 12); aim.y += (y - aim.y) * Math.min(1, dt * 12); }
        if (!locked && pt <= W - LOCK) { locked = true; aim.x = x; aim.y = y; sfx.tickHi(); }
        if (pt <= 0) { ph = 'strike'; pt = STR; sfx.whoosh(); }
      } else if (ph === 'strike') {
        ext = Math.min(1, 1 - pt / STR);
        if (pt <= 0) { ext = 1; ph = 'hold'; pt = HOLD; swipes++; sfx.thud(); shake(4, .12); g.hitCheck(); }
      } else if (ph === 'hold') { g.hitCheck(); if (pt <= 0) { ph = 'ret'; pt = RET; } }
      else if (ph === 'ret') { ext = Math.max(0, pt / RET); if (pt <= 0) { ph = 'idle'; pt = GAP; ext = 0; } }
    },
    hitCheck() {
      if (g.result || caught || Math.hypot(x - aim.x, y - aim.y) > HIT) return;
      caught = true; g.result = 'lose'; ccLose(x, y); floatText('CAUGHT!', 400, 300, RED, 48);
    },
    draw(t) {
      const T = now, oT = ot.t(g), win = g.result === 'win', lose = g.result === 'lose';
      if (!BG_CAT) BG_CAT = K.bake(W0, H, () => {
        const X = K.cx();
        X.fillStyle = K.vg(0, 296, [[0, '#ffe3b6'], [1, '#ffcf92']]); X.fillRect(0, 0, W0, 296);
        X.fillStyle = 'rgba(200,120,70,.16)'; for (let i = 0; i < 16; i++) X.fillRect(i * 52 + 26, 0, 26, 296);
        X.fillStyle = 'rgba(255,120,150,.4)'; for (let i = 0; i < 40; i++) { X.beginPath(); X.arc((i * 83) % 790 + 10, 20 + (i * 57) % 250, 3.2, 0, K.TAU); X.fill(); }
        X.fillStyle = K.vg(296, H, [[0, '#b97a46'], [1, '#8a5530']]); X.fillRect(0, 296, W0, H - 296);
        X.strokeStyle = 'rgba(60,30,10,.35)'; X.lineWidth = 3; for (const yy of [330, 376, 432, 500, 580]) { X.beginPath(); X.moveTo(0, yy); X.lineTo(W0, yy); X.stroke(); }
        for (let i = 0; i < 12; i++) for (const [yy, hh] of [[296, 34], [330, 46], [376, 56], [432, 68], [500, 80]]) if ((i + yy) % 3 === 0) { X.beginPath(); X.moveTo(i * 90 + (yy % 50), yy); X.lineTo(i * 90 + (yy % 50) - (yy - 290) * .05, yy + hh); X.stroke(); }
        K.cr(-10, 284, W0 + 20, 20, 5, '#fff3d6', '#e6cfa0', 3.5, 0, 3); K.horizon(284, 0, W0, 3);
        // rug
        K.ce(400, 330, 328, 208, '#e96a5a', '#c84a40', 5, 0, 8, 10); K.ering(400, 330, 270, 160, 5, '#f7a99c');
        X.strokeStyle = '#ffd6c8'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 18; i++) { const a = i * K.TAU / 18; X.beginPath(); X.moveTo(400 + Math.cos(a) * 292, 330 + Math.sin(a) * 182); X.lineTo(400 + Math.cos(a) * 308, 330 + Math.sin(a) * 194); X.stroke(); }
        // window with curtains
        K.cr(76, 88, 160, 118, 8, '#fff', '#d6cfe6', 4, 2, 2);
        X.save(); K.rr(86, 98, 140, 98, 4); X.clip(); X.fillStyle = K.vg(98, 196, [[0, '#6fcdf6'], [1, '#d6f7ff']]); X.fillRect(86, 98, 140, 98);
        X.fillStyle = '#9be36b'; X.beginPath(); X.ellipse(120, 205, 90, 30, 0, 0, K.TAU); X.fill(); X.beginPath(); X.ellipse(210, 208, 80, 28, 0, 0, K.TAU); X.fill(); X.restore();
        X.fillStyle = '#fff'; X.fillRect(154, 98, 6, 98); X.fillRect(86, 144, 140, 6);
        K.cp([[70, 84], [108, 84], [100, 214], [70, 214]], '#e8553d', '#b8352a', 3.5, 3, 0); K.cp([[242, 84], [204, 84], [212, 214], [242, 214]], '#e8553d', '#b8352a', 3.5, 3, 0);
        K.cr(64, 78, 184, 10, 5, '#d9944f', '#a5622c', 3, 0, 2);
        // shelf + the fish bowl
        K.cr(590, 214, 170, 12, 4, '#e3a868', '#b87a3e', 3.5, 0, 3); for (const bx of [604, 742]) K.cp([[bx - 6, 226], [bx + 6, 226], [bx, 246]], '#c4874e', '#8d5a2a', 3, 1, 0);
        K.ce(675, 188, 38, 30, '#bfeaff', '#8fd0f0', 4, 0, 3, 3); X.save(); X.beginPath(); X.ellipse(675, 188, 34, 26, 0, 0, K.TAU); X.clip(); X.fillStyle = 'rgba(80,190,240,.55)'; X.fillRect(630, 176, 90, 50); X.restore();
        K.gl(660, 176, 8, 4, .7); K.ce(678, 208, 14, 7, '#f2d28a', '#d2aa5a', 2.5);
        K.cr(644, 156, 62, 10, 4, '#fff3d6', '#e6cfa0', 3, 0, 2);
        // a framed portrait (the cat's hero), a toy basket, a ball of yarn
        K.cr(306, 74, 72, 88, 6, '#d9944f', '#a5622c', 4, 2, 2); K.cr(316, 84, 52, 68, 3, '#ffe9b8', '#e6cc88', 2, 1, 1);
        X.fillStyle = OR; X.fillRect(328, 112, 28, 22); X.fillStyle = INK; X.fillRect(334, 118, 4, 8); X.fillRect(346, 118, 4, 8);
        K.ce(92, 548, 32, 30, '#ff6b9a', '#d94a7a', 4.5); X.strokeStyle = 'rgba(255,255,255,.45)'; X.lineWidth = 3; for (const k of [-1, 0, 1]) { X.beginPath(); X.ellipse(92, 548, 30 + k * 2, 14, k * .5, 0, K.TAU); X.stroke(); }
        K.curve(118, 566, 160, 590, 210, 572, 4, '#ff6b9a');
      });
      ctx.drawImage(BG_CAT, 0, 0);
      // fish swimming in the bowl, a bird on the window sill
      const fx = 675 + Math.sin(T * 1.6) * 18, fd = Math.cos(T * 1.6) > 0 ? 1 : -1;
      ctx.save(); ctx.translate(fx, 186 + Math.sin(T * 3) * 3); ctx.scale(fd, 1); ce(0, 0, 9, 6, '#ff9a3a', '#d9701a', 2.5); K.poly([[-8, 0], [-15, -5], [-15, 5]], '#ff9a3a', 2); ctx.fillStyle = INK; el(4, -1, 1.5, 1.5); ctx.fill(); ctx.restore();
      const hop = Math.max(0, Math.sin(T * 2.4)) * 8; ctx.save(); ctx.translate(176, 210 - hop); ce(0, -8, 9, 8, '#4DB8FF', '#2f86c9', 2.5); ce(7, -16, 6, 6, '#4DB8FF', '#2f86c9', 2.5); K.poly([[12, -17], [18, -15], [12, -13]], '#ffb43a', 2); ctx.fillStyle = INK; el(9, -17, 1.4, 1.4); ctx.fill(); ctx.restore();
      const wind = ph === 'wind', look = clamp((x - CATX) / 300, -1, 1), lookY = clamp((y - 300) / 300, -1, 1);
      // the toy's rail across the ceiling, the carriage and the string
      K.cr(18, 52, 764, 12, 6, '#e3a868', '#b87a3e', 3.5, 0, 3);
      const cxr = clamp(x + (x - 400) * .15, 30, 770);
      K.cr(cxr - 13, 48, 26, 20, 5, '#ffd23f', '#c99512', 3, 2, 2);
      // lock marker
      if (wind || ph === 'strike') {
        const pul = locked ? 1 + Math.sin(now * 40) * .08 : 1, col = locked ? '#ff4d5e' : '#fff';
        ctx.globalAlpha = locked ? 1 : .55; K.ering(aim.x, aim.y, HIT * pul, HIT * pul, 4, col);
        K.line([[aim.x - 24, aim.y - 24], [aim.x + 24, aim.y + 24]], 5, col); K.line([[aim.x + 24, aim.y - 24], [aim.x - 24, aim.y + 24]], 5, col); ctx.globalAlpha = 1;
      }
      const mood = lose ? 'smug' : win ? 'sleep' : (wind || ph === 'strike' || ph === 'hold') ? 'focus' : 'bored';
      const bob = win ? Math.sin(T * 2) * 3 : 0;
      catA(CATX, CATY + bob, 1.35, { sway: wind ? Math.sin(now * 40) * 4 : 0, crouch: wind ? 1 : 0, mood, lx: look, ly: lookY });
      // rubber arm
      if (ext > 0) {
        const ex = SHX + (aim.x - SHX) * ext, ey = SHY + (aim.y - SHY) * ext;
        K.line([[SHX, SHY], [ex, ey]], 34, ORG); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(SHX - 8, SHY - 6); ctx.lineTo(ex - 8, ey - 6); ctx.stroke();
        ce(ex, ey, 38, 36, ORG, '#d98a2e', 5); ce(ex, ey + 8, 16, 13, PINK, '#e0709c', 2.5); for (const k of [-1, 0, 1]) ce(ex + k * 19, ey - 18, 7, 8.5, PINK, '#e0709c', 2.5);
      }
      // wand string + toy
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cxr, 66); ctx.quadraticCurveTo(x + Math.sin(now * 5) * 10, y * .5 + 30, x, y - 18); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(now * 6) * .3 + (caught ? now * 8 : 0));
      const fcol = ['#4DB8FF', '#FFE14D', '#ff4d9e'];
      for (let i = 0; i < 6; i++) { const a = -2.6 + i * .42; K.line([[0, 0], [Math.cos(a) * 36, Math.sin(a) * 36 + 10]], 4, fcol[i % 3]); }
      ce(0, 8, 15, 15, '#FF4D9E', '#c92a78', 4); K.gl(-5, 3, 5, 4, .8); ctx.restore();
      if (!caught) K.pill(x, Math.min(y + 44, 530), 'YOU', YEL, true);
      // Caos watches from the corner (nervous, then relieved or flattened)
      ctx.save(); ctx.translate(716, 508); K.shade(0, 2, 30, 7, .3);
      K.arms(3.6, win ? -.4 : -2.4, win ? .4 : 2.4, 1); caos(0, 0, 3.6, { mood: ccMood(g) }); if (wind && !g.result) K.sweat(24, -34, .8, T); ctx.restore();
      if (lose) K.badge('GOTCHA', 400, 94 + Math.sin(T * 14) * 2, 30, '#ff4d5e', '#fff', K.outBack(oT / .25), -.04);
      if (win) for (let i = 0; i < 3; i++) K.zee(488 + i * 22, 330 - i * 36 - ((oT * 40) % 18), .9 + i * .2, 1 - oT * .6);
      vignette(.2);
    }
  };
  return g;
}
reg('cc_cat', ccCat, 'Kit-tease');

/* ───────── 4 RUN: loop round the post so the dog never catches you ───────── */
let BG_DOG = null;
function ccDog(sp) {
  const rs = Math.sqrt(sp), POX = 400, POY = 330, PRAD = 46, MR = 20, DR = 26, MINX = 36, MAXX = 764, MINY = 120, MAXY = 530;
  const DSP = Math.min(255, 175 * rs), MSP = 290;
  let held = false, c = 0, mx = 670, my = 470, tx = 670, ty = 470, dx = 120, dy = 160, side = 0, face = 1, dt0 = 0, mface = -1;
  const ot = K.outro();
  const push = (x, y, r) => {
    const ddx = x - POX, ddy = y - POY, dd = Math.hypot(ddx, ddy) || 1, m = PRAD + r;
    return dd < m ? [POX + ddx / dd * m, POY + ddy / dd * m] : [x, y];
  };
  const g = {
    get c() { return c; }, cmd: 'RUN!', hint: 'MOUSE OR ARROWS: CIRCLE THE POST, DODGE THE DOG', thint: 'DRAG TO RUN ROUND THE POST AND DODGE THE DOG', dur: 5.6, timeWin: true,
    down(p) { held = true; tx = p.x; ty = p.y; }, move(p) { if (!TOUCH || held) { tx = p.x; ty = p.y; } }, up() { held = false; },
    update(dt) {
      ot.mark(g);
      c += dt; dt0 += dt; survive(g); if (g.result) return;
      let kx = 0, ky = 0;
      if (keys.ArrowLeft || keys.KeyA) kx -= 1; if (keys.ArrowRight || keys.KeyD) kx += 1;
      if (keys.ArrowUp || keys.KeyW) ky -= 1; if (keys.ArrowDown || keys.KeyS) ky += 1;
      if (kx || ky) { const l = Math.hypot(kx, ky); mx += kx / l * MSP * dt; my += ky / l * MSP * dt; tx = mx; ty = my; if (kx) mface = kx; }
      else { const d = Math.hypot(tx - mx, ty - my), s = Math.min(d, MSP * dt); if (d > 1) { mx += (tx - mx) / d * s; my += (ty - my) / d * s; if (Math.abs(tx - mx) > 4) mface = tx > mx ? 1 : -1; } }
      [mx, my] = push(clamp(mx, MINX, MAXX), clamp(my, MINY, MAXY), MR);
      if (c > .7) {
        let ux = mx - dx, uy = my - dy; const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
        const sd = (function () { const ax = dx, ay = dy, bx = mx, by = my, ddx = bx - ax, ddy = by - ay, l = ddx * ddx + ddy * ddy || 1, k = clamp(((POX - ax) * ddx + (POY - ay) * ddy) / l, 0, 1); return Math.hypot(POX - ax - k * ddx, POY - ay - k * ddy); })();
        if (sd < PRAD + DR + 10) {
          if (!side) side = ((mx - dx) * (POY - dy) - (my - dy) * (POX - dx)) > 0 ? -1 : 1;
          const a = side * .85, cs = Math.cos(a), sn = Math.sin(a), rx = ux * cs - uy * sn, ry = ux * sn + uy * cs; ux = rx; uy = ry;
        } else side = 0;
        dx += ux * DSP * dt; dy += uy * DSP * dt; if (Math.abs(ux) > .2) face = ux > 0 ? 1 : -1;
      }
      dx = clamp(dx, MINX, MAXX); dy = clamp(dy, MINY, MAXY); [dx, dy] = push(dx, dy, DR);
      if (c > .7 && Math.hypot(dx - mx, dy - my) < 44) { g.result = 'lose'; ccLose(mx, my); floatText('CHOMP!', 400, 250, RED, 50); }
    },
    draw(t) {
      const T = now, oT = ot.t(g), win = g.result === 'win', lose = g.result === 'lose';
      if (!BG_DOG) BG_DOG = K.bake(W, H, () => {
        const X = K.cx(); X.fillStyle = K.vg(0, 104, [[0, '#4cb4ee'], [.6, '#8fdbfb'], [1, '#dcf8ff']]); X.fillRect(0, 0, W, 104);
        K.hills(0, W, 104, 34, .007, 2.4, '#b9e5cf', null); K.hills(0, W, 104, 22, .01, .5, '#87d19b', '#4f9a6a', 3);
        K.ground(104, '#a8e67a', '#74c451', 3, 18, 12); K.horizon(104, 0, W, 4);
        // the picket fence along the back
        K.rail(0, 84, W, 84, 6); K.rail(0, 66, W, 66, 6);
        for (let x = 6; x < W + 20; x += 34) { K.cp([[x, 106], [x + 22, 106], [x + 22, 64], [x + 11, 54], [x, 64]], '#fff8e8', '#e3d4b0', 3, 3, 0); }
        // dirt ring round the post
        X.fillStyle = 'rgba(168,107,60,.4)'; X.beginPath(); X.ellipse(POX, POY + 6, 150, 130, 0, 0, K.TAU); X.fill();
        X.strokeStyle = 'rgba(255,255,255,.28)'; X.lineWidth = 4; X.setLineDash([10, 12]); X.beginPath(); X.arc(POX, POY, 118, 0, K.TAU); X.stroke(); X.setLineDash([]);
        // the kennel and a pile of bones
        K.cr(640, 124, 96, 62, 5, '#e9a35c', '#b87a3e', 4, 3, 3); K.cp([[630, 128], [688, 82], [746, 128]], '#e8553d', '#b8352a', 4, 3, 3);
        X.fillStyle = '#2a1d1a'; X.beginPath(); X.arc(688, 186, 22, Math.PI, 0); X.lineTo(710, 186); X.lineTo(666, 186); X.closePath(); ink('#2a1d1a', 3);
        K.cr(676, 108, 24, 14, 5, '#fff3d6', '#e6cfa0', 2.5, 1, 1);
        for (const [bx, by, r] of [[110, 176, .3], [150, 188, -.5]]) { X.save(); X.translate(bx, by); X.rotate(r); K.line([[-14, 0], [14, 0]], 6, '#fff3d6'); for (const sx of [-16, 16]) for (const sy of [-4, 4]) { X.beginPath(); X.arc(sx, sy, 4.5, 0, K.TAU); ink('#fff3d6', 2.5); } X.restore(); }
        // the stump (the post): side wall, top face with rings, an axe stuck in it
        K.ce(POX, POY + 14, PRAD, 42, '#8a5a34', '#5e3a1c', 5, 0, 0, 0);
        X.fillStyle = '#8a5a34'; X.fillRect(POX - PRAD, POY - 6, PRAD * 2, 20); X.strokeStyle = INK; X.lineWidth = 10; X.beginPath(); X.moveTo(POX - PRAD, POY - 6); X.lineTo(POX - PRAD, POY + 14); X.moveTo(POX + PRAD, POY - 6); X.lineTo(POX + PRAD, POY + 14); X.stroke();
        X.fillStyle = '#8a5a34'; X.fillRect(POX - PRAD + 4, POY - 6, PRAD * 2 - 8, 20);
        X.strokeStyle = '#6b4424'; X.lineWidth = 3; for (const x of [-26, -10, 8, 24]) { X.beginPath(); X.moveTo(POX + x, POY + 2); X.lineTo(POX + x + 3, POY + 22); X.stroke(); }
        K.ce(POX, POY - 4, PRAD, 42, '#e0b078', '#b88848', 5, 0, 4, 5);
        X.strokeStyle = '#a8763c'; X.lineWidth = 3; for (const [a, b] of [[14, 12], [28, 25]]) { X.beginPath(); X.ellipse(POX, POY - 4, a, b, 0, 0, K.TAU); X.stroke(); }
        K.line([[POX + 8, POY - 6], [POX + 38, POY - 44]], 7, '#a5622c'); K.cp([[POX + 26, POY - 54], [POX + 52, POY - 42], [POX + 44, POY - 28], [POX + 30, POY - 36]], '#d6dbe8', '#8f9cb3', 3, 2, 2);
        X.fillStyle = '#e8553d'; X.fillRect(POX - 8, POY - 10, 16, 12);
      });
      ctx.drawImage(BG_DOG, 0, 0);
      for (const [cx0, cy0, s0, sp0] of [[40, 30, .9, 6], [380, 50, .7, 4], [620, 24, 1, 7]]) K.cloud(((cx0 + T * sp0) % 1000) - 150, cy0, s0);
      // the neighbour's cat watches the chase from the fence
      catA(250, 104, .3, { mood: lose ? 'smug' : 'focus', lx: clamp((mx - 250) / 300, -1, 1), ly: .4 });
      if (!g.result && c < .9) { txt('GET READY', 400, 135, 26, '#fff'); }
      const run = Math.hypot(tx - mx, ty - my) > 4 || keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown;
      const dmood = win ? 'happy' : lose ? 'bite' : c > .6 ? 'mad' : 'calm';
      const items = [{ y: dy, f: () => dogA(dx, dy + 20 + (win ? Math.abs(Math.sin(oT * 8)) * -6 : 0), 1.05, face, { t: dt0, mouth: true, chomp: lose, mood: dmood === 'bite' ? 'mad' : dmood }) },
        { y: my, f: () => {
          K.shade(mx, my + 2, 26, 7, .25); ctx.save(); ctx.translate(mx, my - (win ? Math.abs(Math.sin(oT * 9)) * 14 : 0)); if (run && !g.result) ctx.rotate(Math.sin(now * 20) * .06);
          if (lose) ctx.scale(1.12, .86);
          const sw = run && !g.result ? Math.sin(now * 20) * .5 : 0; K.arms(4, win ? -.4 : lose ? -.9 : -2.3 + sw, win ? .4 : lose ? .9 : 2.3 - sw, 1); caos(0, 0, 4, { mood: ccMood(g) });
          if (lose) for (let i = 0; i < 3; i++) { const a = now * 5 + i * 2.1; K.star(Math.cos(a) * 24, -46 + Math.sin(a) * 7, 7, 3, 5, a, '#FFE14D', 2); }
          if (win) K.sweat(26, -38, .8, now); ctx.restore();
        } }];
      items.sort((a, b) => a.y - b.y).forEach(i => i.f());
      K.pill(mx, my - 62, 'YOU', YEL, true);
      if (win && oT < .95) for (let i = 0; i < 3; i++) K.heart(mx + (i - 1) * 24, my - 90 - oT * 46 - i * 8, 1.1, 1 - oT / .95);
      if (!TOUCH || (tx !== mx || ty !== my)) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, 10, 0, 7); ctx.stroke(); }
      vignette(.2);
    }
  };
  return g;
}
reg('cc_dog', ccDog, 'Beware of Dog');

/* ───────── 5 WIGGLE: draw a path (or steer with arrows) so the worm reaches the pond ───────── */
let BG_WORM = null;
function boulder(r, T) {
  const X = ctx; ce(r.x, r.y + 4, r.r, r.r * .9, '#a9a3bd', '#6b6580', 5, 0, r.r * .2, r.r * .22); K.gl(r.x - r.r * .35, r.y - r.r * .3, r.r * .28, r.r * .14, .45);
  X.strokeStyle = '#6b6580'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(r.x + r.r * .2, r.y - r.r * .1); X.lineTo(r.x + r.r * .35, r.y + r.r * .25); X.moveTo(r.x + r.r * .35, r.y + r.r * .25); X.lineTo(r.x + r.r * .15, r.y + r.r * .4); X.stroke();
  for (const [mx, my] of [[-.55, .45], [-.3, .6], [-.75, .22]]) { X.fillStyle = '#6fd36a'; el(r.x + mx * r.r, r.y + my * r.r, 7, 5); X.fill(); }
}
function ccWorm(sp) {
  const rs = Math.sqrt(sp), SPEED = 225 * rs, POND = { x: 685, y: 330, r: 82 };
  const rocks = [{ x: 280 + rnd(-20, 20), y: 240 + rnd(-30, 30), r: 42 }, { x: 440 + rnd(-20, 20), y: 400 + rnd(-30, 20), r: 46 }, { x: 540 + rnd(-10, 10), y: 230 + rnd(-20, 30), r: 40 }];
  const head = { x: 90, y: 330 }, hist = [{ x: head.x, y: head.y }], queue = [];
  let c = 0, held = false, stall = 0, hx0 = 0, hy0 = 0, wig = 0;
  const ot = K.outro();
  const bad = (x, y, m) => { for (const r of rocks) if (Math.hypot(x - r.x, y - r.y) < r.r + m) return true; return x < 20 || x > 780 || y < 110 || y > 540; };
  const tail = () => queue.length ? queue[queue.length - 1] : head;
  const addPt = (p, first) => {
    const l = tail();
    if (bad(p.x, p.y, 16) || (!first && Math.hypot(p.x - l.x, p.y - l.y) < 16)) return;
    if (queue.length < 300) queue.push({ x: p.x, y: p.y });
  };
  const g = {
    get c() { return c; }, cmd: 'WIGGLE!', hint: 'DRAG (OR ARROWS) TO LEAD THE WORM TO THE POND', thint: 'DRAG A PATH TO THE POND', dur: 6,
    down(p) { if (g.result) return; held = true; addPt(p, true); }, move(p) { if (held && !g.result) addPt(p); }, up() { held = false; },
    update(dt) {
      ot.mark(g);
      c += dt; wig += dt; if (g.result) return;
      let kx = 0, ky = 0;
      if (keys.ArrowLeft || keys.KeyA) kx -= 1; if (keys.ArrowRight || keys.KeyD) kx += 1;
      if (keys.ArrowUp || keys.KeyW) ky -= 1; if (keys.ArrowDown || keys.KeyS) ky += 1;
      if ((kx || ky) && queue.length < 4) { const l = tail(), n = Math.hypot(kx, ky); addPt({ x: l.x + kx / n * 16, y: l.y + ky / n * 16 }, true); }
      let step = SPEED * dt; const sx = head.x, sy = head.y;
      while (step > 0 && queue.length) {
        const q = queue[0], d = Math.hypot(q.x - head.x, q.y - head.y);
        if (d <= step) { head.x = q.x; head.y = q.y; step -= d; queue.shift(); } else { head.x += (q.x - head.x) / d * step; head.y += (q.y - head.y) / d * step; step = 0; }
      }
      for (const r of rocks) { const ddx = head.x - r.x, ddy = head.y - r.y, dd = Math.hypot(ddx, ddy) || 1, m = r.r + 12; if (dd < m) { head.x = r.x + ddx / dd * m; head.y = r.y + ddy / dd * m; } }
      const mv = Math.hypot(head.x - sx, head.y - sy);
      if (queue.length && mv < SPEED * dt * .2) { stall += dt; if (stall > .45) { queue.length = 0; stall = 0; sfx.miss(); floatText('STUCK!', head.x, head.y - 50, '#fff', 26); } } else stall = 0;
      const lh = hist[hist.length - 1];
      if (Math.hypot(head.x - lh.x, head.y - lh.y) >= 7) { hist.push({ x: head.x, y: head.y }); if (hist.length > 80) hist.shift(); }
      if (Math.hypot(head.x - POND.x, head.y - POND.y) < POND.r - 14) {
        g.result = 'win'; ccWin(POND.x, POND.y); sfx.splat(); burst(POND.x, POND.y, '#4DB8FF', 18); floatText('SPLASH!', POND.x, POND.y - 100, '#fff', 44);
      }
    },
    draw(t) {
      const T = now, oT = ot.t(g), win = g.result === 'win', lose = g.result === 'lose';
      if (!BG_WORM) BG_WORM = K.bake(W, H, () => {
        const X = K.cx(); X.fillStyle = K.vg(0, H, [[0, '#d2a56b'], [1, '#b98856']]); X.fillRect(0, 0, W, H);
        X.fillStyle = 'rgba(110,70,30,.2)'; for (let i = 0; i < 70; i++) { X.beginPath(); X.ellipse(K.hash(i) * 790 + 5, K.hash(i + 50) * 590 + 5, 3 + K.hash(i + 9) * 3, 2 + K.hash(i + 3) * 2, 0, 0, K.TAU); X.fill(); }
        X.strokeStyle = 'rgba(110,70,30,.28)'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 9; i++) { const yy = 120 + i * 52; X.beginPath(); X.moveTo(0, yy); X.quadraticCurveTo(200, yy + 14, 400, yy); X.quadraticCurveTo(600, yy - 14, 800, yy + 4); X.stroke(); }
        for (let i = 0; i < 9; i++) { const px = K.hash(i + 70) * 700 + 40, py = 150 + K.hash(i + 90) * 380; if (Math.hypot(px - 685, py - 330) > 120) K.ce(px, py, 7, 5, '#d8d2e6', '#a69fbb', 2.5); }
        // sprouts and the sign of the road ("worms this way")
        for (const [sx, sy] of [[60, 500], [330, 540], [610, 520], [760, 160]]) { K.line([[sx, sy], [sx, sy - 14]], 3, '#3fae4a'); K.ce(sx - 8, sy - 16, 8, 4, '#5bcf72', '#3fae4a', 2.5, -.5); K.ce(sx + 8, sy - 16, 8, 4, '#5bcf72', '#3fae4a', 2.5, .5); }
        K.post(150, 440, 44, 8); K.cr(96, 392, 108, 38, 6, '#e9a35c', '#a5622c', 4, 3, 3); K.poly([[110, 411], [160, 411], [160, 400], [182, 411], [160, 422], [160, 411]], '#fff', 2.5);
        // the pond: sand rim, water, lily pad
        K.ce(685, 330, 96, 92, '#f4d998', '#d6b66c', 4.5, 0, 3, 3); X.beginPath(); X.arc(685, 330, 82, 0, K.TAU); X.fillStyle = K.vg(248, 412, [[0, '#62d3f0'], [1, '#2a8fcb']]); X.fill(); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
        K.ce(716, 292, 14, 9, '#5cd65c', '#32a43a', 3, -.3); X.fillStyle = '#ff8fb0'; X.beginPath(); X.arc(718, 289, 4, 0, K.TAU); X.fill();
      });
      ctx.drawImage(BG_WORM, 0, 0);
      // pond ripples + splash on a win
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(POND.x, POND.y, 24 + i * 22 + Math.sin(now * 3 + i) * 3, .3, 2.2); ctx.stroke(); }
      if (win) for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i - 3.5) * .3, d = Math.min(1, oT / .5) * 70 * (.7 + (i % 3) * .2); ctx.fillStyle = '#bff0ff'; el(POND.x + Math.sin(a + Math.PI / 2) * d * .9, POND.y - Math.cos(a + Math.PI / 2) * d + oT * oT * 160, 6, 8); ctx.fill(); }
      txt('POND', POND.x, POND.y - POND.r - 24, 26, '#fff');
      for (const r of rocks) boulder(r, T);
      // the sun (it gets cross as the worm dries out)
      const heat = win ? 0 : clamp(c / g.dur, 0, 1), hot = heat > .6;
      ctx.save(); ctx.translate(70, 160); ctx.rotate(T * .5); K.star(0, 0, 48, 34, 12, 0, hot ? '#ffab3d' : '#ffe14d', 4); ctx.rotate(-T * .5);
      el(0, 0, 28, 28); ink(hot ? '#ff8a2b' : '#ffd23f', 3.5); K.gl(-9, -9, 8, 5, .6);
      ctx.fillStyle = INK; for (const sx of [-9, 9]) { el(sx, -3, 3.4, hot ? 3 : 4.6); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath();
      if (lose) { ctx.moveTo(-12, 8); ctx.quadraticCurveTo(0, 20, 12, 8); } else if (hot) { ctx.moveTo(-8, 11); ctx.lineTo(8, 11); ctx.moveTo(-14, -11); ctx.lineTo(-4, -8); ctx.moveTo(14, -11); ctx.lineTo(4, -8); } else { ctx.arc(0, 4, 9, .3, 2.8); } ctx.stroke();
      if (lose) { K.cr(-20, -10, 40, 11, 5, '#3b3550', '#14101c', 3, 1, 1); K.gl(-12, -6, 6, 2, .4); }
      ctx.restore();
      // queued path
      if (queue.length) {
        ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(head.x, head.y); for (const q of queue) ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.strokeStyle = YEL; ctx.lineWidth = 5; ctx.setLineDash([2, 12]); ctx.beginPath(); ctx.moveTo(head.x, head.y); for (const q of queue) ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
      } else if (!g.result && c < 3.2) {
        ctx.globalAlpha = .7; drawArrow(head.x + 60, head.y - 56, 1, 18, '#fff'); ctx.globalAlpha = 1;
      }
      // worm body (older history = further back)
      const n = 13, base = lose ? '#c98a52' : PINK, alt = lose ? '#b9784a' : '#FF8FB0', shd = lose ? '#7a4e2a' : '#e0719c';
      const prev = hist[Math.max(0, hist.length - 4)], dxh = head.x - prev.x, dyh = head.y - prev.y, dl = Math.hypot(dxh, dyh) || 1, lk = [dxh / dl || 1, dyh / dl];
      for (let i = n; i >= 0; i--) {
        const k = Math.min(hist.length - 1, Math.max(0, hist.length - 1 - i * 2)), q = i === 0 ? head : hist[k];
        const wob = Math.sin(wig * 9 - i * .9) * 3, r = i === 0 ? 17 : 15 - i * .35;
        ce(q.x + wob * .6, q.y + wob, r, r, i % 2 ? alt : base, shd, 4, 0, r * .22, r * .25);
      }
      const hx = head.x, hy = head.y, em = win ? 'happy' : lose ? 'bonk' : hot ? 'panic' : 'idle';
      K.gl(hx - 6, hy - 9, 5, 3, .55);
      K.eye(hx - 6, hy - 4, 5, em, lk, now, 0); K.eye(hx + 6, hy - 4, 5, em, lk, now, 1);
      ctx.fillStyle = 'rgba(255,90,140,.5)'; for (const sx of [-1, 1]) { el(hx + sx * 11, hy + 4, 3.4, 2.4); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); if (lose) { ctx.moveTo(hx - 5, hy + 8); ctx.quadraticCurveTo(hx, hy + 4, hx + 5, hy + 8); } else ctx.arc(hx, hy + 4, 4.5, .4, 2.7); ctx.stroke();
      if (hot && !g.result) K.sweat(hx + 15, hy - 14, .8, now);
      if (lose) for (let i = 0; i < 3; i++) K.puff(hx - 4 + i * 8, hy - 30 - ((oT * 40 + i * 14) % 40), 7 + i * 2, .7 - ((oT * 40 + i * 14) % 40) / 70, '#d8d2e0');
      if (win) K.heart(hx + 12, hy - 38 - Math.min(oT, .9) * 30, 1.3, 1 - oT / .95);
      // Caos cheers the worm on
      ctx.save(); ctx.translate(60, 508); K.shade(0, 2, 26, 7, .28);
      K.arms(3.4, win ? -.4 : -2.3 + Math.sin(T * 5) * .3, win ? .4 : 2.3 - Math.sin(T * 5) * .3, 1); caos(0, 0, 3.4, { mood: ccMood(g) }); ctx.restore();
      K.pill(60, 462, 'YOU', YEL, true);
      vignette(.2);
    }
  };
  return g;
}
reg('cc_worm', ccWorm, 'Worm Squirm');

/* ───────── 6 GRAB: aim the claw, drop it, lift a plush all the way up ───────── */
let BG_CLAW = null, FG_CLAW = null;
function plushA(x, y, r, col, mood) {
  const sh = K.mix(col, '#14101c', .28), T = now;
  for (const sd of [-1, 1]) { ce(x + sd * r * .7, y - r * .75, r * .38, r * .38, col, sh, 3.5); ce(x + sd * r * .7, y - r * .75, r * .2, r * .2, 'rgba(255,255,255,.55)', 'rgba(255,255,255,.55)', 0); }
  ce(x, y, r, r * .92, col, sh, 4.5); K.gl(x - r * .4, y - r * .5, r * .26, r * .13, .5);
  ce(x, y + r * .28, r * .46, r * .34, '#fff3d6', '#e6cfa0', 3);
  ctx.fillStyle = INK; el(x, y + r * .14, r * .13, r * .09); ctx.fill();
  for (const sd of [-1, 1]) {
    if (mood === 'happy') { ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x + sd * r * .38, y - r * .08, r * .14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else { ctx.fillStyle = INK; el(x + sd * r * .38, y - r * .12, r * .12, r * .16); ctx.fill(); ctx.fillStyle = '#fff'; el(x + sd * r * .38 - 1.5, y - r * .18, r * .045, r * .045); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,110,165,.5)'; el(x + sd * r * .62, y + r * .14, r * .13, r * .08); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + r * .22); ctx.lineTo(x, y + r * .3); ctx.moveTo(x, y + r * .3); ctx.quadraticCurveTo(x - r * .1, y + r * .4, x - r * .2, y + r * .33); ctx.moveTo(x, y + r * .3); ctx.quadraticCurveTo(x + r * .1, y + r * .4, x + r * .2, y + r * .33); ctx.stroke();
}
function ccClaw(sp) {
  const rs = Math.sqrt(sp), TOP = 130, BOT = 372, FLOOR = 420, LX = 150, RX = 650;
  const cols = ['#FF4D9E', '#4DB8FF', '#5CFF7A', '#FF8A2B', '#B67BFF'];
  const toys = cols.map((col, i) => ({ col, ph: i * 1.3 + rnd(0, .6), w: (.5 + i % 3 * .12) * rs, amp: 150 + i % 2 * 60, x: 400, y: FLOOR - 36, got: false }));
  let pdown = false, c = 0, cx = 400, tx = 400, cy = TOP, st = 'idle', stt = 0, grab = null, btn = '', open = 1, tries = 0;
  const ot = K.outro();
  const B = { L: [24, 482, 170, 62], R: [210, 482, 170, 62], D: [470, 482, 306, 62] };
  const hit = (p, b) => p.x >= b[0] - 6 && p.x <= b[0] + b[2] + 6 && p.y >= b[1] - 8 && p.y <= b[1] + b[3] + 8;
  const drop = () => { if (g.result || st !== 'idle') return; st = 'down'; stt = 0; sfx.whoosh(false); };
  const g = {
    get c() { return c; }, cmd: 'GRAB!', hint: 'MOUSE OR ARROWS: MOVE. CLICK OR SPACE: DROP THE CLAW', thint: 'MOVE THE CLAW, THEN TAP DROP', dur: 6,
    down(p) {
      if (g.result) return;
      btn = ''; pdown = true;
      for (const k in B) if (hit(p, B[k])) { btn = k; break; }
      if (btn === 'D') { drop(); return; }
      if (btn) return;
      tx = p.x; if (!TOUCH) drop();
    },
    move(p) { if (!btn && (!TOUCH || pdown)) tx = p.x; }, up() { btn = ''; pdown = false; },
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS')) drop(); },
    update(dt) {
      ot.mark(g);
      c += dt;
      for (const p of toys) if (!p.got || p !== grab) { p.x = 400 + Math.sin(c * p.w + p.ph) * p.amp; }
      if (g.result) return;
      let dir = 0; if (keys.ArrowLeft || keys.KeyA) dir -= 1; if (keys.ArrowRight || keys.KeyD) dir += 1; if (btn === 'L') dir -= 1; if (btn === 'R') dir += 1;
      if (st === 'idle') { if (dir) { tx = clamp(cx + dir * 400 * dt, LX, RX); cx = tx; } else { const d = clamp(tx, LX, RX) - cx; cx += clamp(d, -700 * dt, 700 * dt); } }
      stt += dt;
      if (st === 'down') { cy = Math.min(BOT, cy + 520 * dt); open = 1; if (cy >= BOT) { st = 'close'; stt = 0; sfx.click(); } }
      else if (st === 'close') {
        open = Math.max(.15, 1 - stt / .22);
        if (stt >= .26) {
          let b = null, bd = 46; for (const p of toys) { const d = Math.abs(p.x - cx); if (d < bd) { bd = d; b = p; } }
          if (b) { grab = b; b.got = true; sfx.coin(); burst(cx, BOT + 10, '#fff', 6, 160); floatText('GOT IT!', cx, BOT - 40, YEL, 28); }
          else { sfx.miss(); floatText('MISS!', cx, BOT - 40, '#fff', 28); }
          st = 'up'; stt = 0; tries++;
        }
      } else if (st === 'up') {
        cy = Math.max(TOP, cy - 400 * dt); if (grab) { grab.x = cx; grab.y = cy + 36; }
        if (cy <= TOP) {
          if (grab) { g.result = 'win'; ccWin(cx, 300); }
          else { st = 'idle'; open = 1; }
        }
      }
    },
    draw(t) {
      const T = now, oT = ot.t(g), win = g.result === 'win', lose = g.result === 'lose';
      if (!BG_CLAW) {
        BG_CLAW = K.bake(W0, H, () => {
          const X = K.cx(); X.fillStyle = K.vg(0, H, [[0, '#b58cff'], [1, '#8a64e0']]); X.fillRect(0, 0, W0, H);
          X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 40; i++) { const sx = (i * 97) % 800, sy = (i * 61) % 560; if (sx > 40 && sx < 760 && sy > 50 && sy < 480) continue; X.beginPath(); X.moveTo(sx, sy - 7); X.lineTo(sx + 2, sy - 2); X.lineTo(sx + 7, sy); X.lineTo(sx + 2, sy + 2); X.lineTo(sx, sy + 7); X.lineTo(sx - 2, sy + 2); X.lineTo(sx - 7, sy); X.lineTo(sx - 2, sy - 2); X.closePath(); X.fill(); }
          K.cr(44, 50, 712, 436, 18, '#ff6fa8', '#d94a82', 5, 5, 5);                      // the cabinet
          K.cr(60, 58, 680, 40, 10, '#ffd23f', '#e0a92c', 4, 2, 3);                        // marquee strip (bulbs are live)
          X.fillStyle = '#d9f4ff'; K.rr(86, 104, 628, 350, 8); ink('#d9f4ff', 4.5);
          X.save(); K.rr(86, 104, 628, 350, 8); X.clip();
          X.fillStyle = K.vg(104, 454, [[0, '#e8f9ff'], [1, '#bfe9ff']]); X.fillRect(86, 104, 628, 350);
          X.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 8; i++) X.fillRect(110 + i * 80, 104, 10, 350);
          X.fillStyle = '#e7d3ff'; X.fillRect(86, FLOOR, 628, 34); X.fillStyle = '#c9a8f5'; X.fillRect(86, FLOOR, 628, 5);
          X.fillStyle = INK; K.rr(96, FLOOR + 4, 70, 26, 6); X.fill();                      // the prize chute
          X.restore();
          K.cr(60, 466, 680, 14, 6, '#d94a82', '#a82a60', 3.5, 0, 3);
          K.cr(10, 470, 780, 90, 18, '#6c4bd1', '#4a2fa0', 5, 0, 7);                       // control deck
        });
        FG_CLAW = K.bake(W0, H, () => {
          const X = K.cx(); X.save(); K.rr(86, 104, 628, 350, 8); X.clip(); X.fillStyle = 'rgba(255,255,255,.2)';
          X.beginPath(); X.moveTo(120, 104); X.lineTo(200, 104); X.lineTo(120, 454); X.lineTo(40, 454); X.fill(); X.beginPath(); X.moveTo(260, 104); X.lineTo(290, 104); X.lineTo(210, 454); X.lineTo(180, 454); X.fill(); X.restore();
          K.rr(86, 104, 628, 350, 8); X.lineWidth = 9; X.strokeStyle = INK; X.stroke();
        });
      }
      ctx.drawImage(BG_CLAW, 0, 0);
      // marquee bulbs: chase while playing, rainbow on a win, dead red on a loss
      for (let i = 0; i < 24; i++) {
        const bx = 76 + i * 28.2, on = win ? true : lose ? false : ((i + Math.floor(T * 8)) % 3 === 0), col = win ? `hsl(${(i * 15 + T * 600) % 360},90%,60%)` : lose ? '#7a2a3a' : on ? '#fff7b0' : '#ffb03a';
        ctx.beginPath(); ctx.arc(bx, 78, 7, 0, 7); ink(col, 2.5); if (on && !lose) { ctx.fillStyle = 'rgba(255,255,255,.7)'; el(bx - 2, 76, 2.4, 2.4); ctx.fill(); }
      }
      // toys
      for (const p of toys) { if (p.got && grab === p) continue; K.shade(p.x, FLOOR - 2, 34, 8, .25); plushA(p.x, FLOOR - 36, 34, p.col, lose ? 'idle' : null); }
      // claw
      K.cr(86, 112, 628, 14, 4, '#d6dbe8', '#8f9cb3', 3.5, 0, 3);
      K.cr(cx - 24, 104, 48, 32, 6, '#ffd23f', '#c99512', 4, 3, 3); K.gl(cx - 12, 112, 8, 3, .6);
      K.line([[cx, 134], [cx, Math.max(134, cy)]], 4, '#b8b0cc');
      if (grab) plushA(grab.x, grab.y, 34, grab.col, win ? 'happy' : null);
      const o = 16 + open * 30;
      for (const s of [-1, 1]) K.line([[cx + s * 8, cy], [cx + s * o, cy + 24], [cx + s * (o - 12 - open * 6), cy + 54]], 9, '#ff6a6a');
      K.cr(cx - 15, cy - 9, 30, 22, 6, '#ffd23f', '#c99512', 4, 3, 3);
      if (st === 'idle' && !g.result) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(cx, cy + 56); ctx.lineTo(cx, FLOOR); ctx.stroke(); ctx.setLineDash([]); }
      if (win && oT < .95) for (let i = 0; i < 3; i++) K.heart(cx + (i - 1) * 34, 180 + i * 6 - oT * 30, 1.2, 1 - oT / .95);
      ctx.drawImage(FG_CLAW, 0, 0);
      // controls: chunky plates that press down and grey out after the verdict
      for (const k in B) {
        const b = B[k], on = btn === k, dis = (k === 'D' && st !== 'idle') || !!g.result, face = dis ? '#d3cfe0' : k === 'D' ? '#ff4d5e' : '#ffd23f', base = dis ? '#8f88a6' : k === 'D' ? '#b8283a' : '#c99512';
        K.rr(b[0], b[1] + 6, b[2], 56, 18); ink(base, 4);
        const dy = on ? 5 : 0; K.rr(b[0], b[1] + dy, b[2], 56, 18); ink(face, 4); ctx.fillStyle = 'rgba(255,255,255,.35)'; K.rr(b[0] + 10, b[1] + dy + 5, b[2] - 20, 9, 4); ctx.fill();
        const cxp = b[0] + b[2] / 2 - (TOUCH ? 0 : 22), cyp = b[1] + dy + 30;
        if (k === 'D') { ctx.globalAlpha = dis ? .8 : 1; txt('DROP', cxp, cyp, 34, dis ? '#f6f4fb' : '#fff'); ctx.globalAlpha = 1; }
        else { const d = k === 'L' ? -1 : 1; K.poly([[cxp + d * 16, cyp], [cxp - d * 12, cyp - 17], [cxp - d * 12, cyp + 17]], dis ? '#f6f4fb' : INK, 3); }
        if (!TOUCH) K.keyCap(b[0] + b[2] / 2 + (k === 'D' ? 92 : 40), cyp, k === 'D' ? 'SPACE' : k === 'L' ? '←' : '→');
      }
      // Caos, next to the cabinet
      ctx.save(); ctx.translate(772, 470); K.shade(0, 2, 22, 6, .3); K.arms(3, win ? -.4 : -2.4, win ? .4 : 2.4, 1); caos(0, 0, 3, { mood: ccMood(g) }); ctx.restore();
      vignette(.2);
    }
  };
  return g;
}
reg('cc_claw', ccClaw, 'The Claw');

/* ───────── 7 LICK: flick the frog's tongue at hearts, avoid the bees ───────── */
let BG_FROG = null;
function beeA(x, y, s, ph, hurt) {
  const T = now, fl = Math.sin(T * 60 + ph) * .4;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ce(-8, -16, 8, 14 + fl * 8, 'rgba(255,255,255,.9)', 'rgba(185,225,255,.9)', 2.8, -.4); ce(8, -16, 8, 14 - fl * 8, 'rgba(255,255,255,.9)', 'rgba(185,225,255,.9)', 2.8, .4);
  ce(0, 0, 22, 16, YEL, '#e0a800', 3.5); ctx.save(); el(0, 0, 22, 16); ctx.clip(); ctx.fillStyle = INK; for (const bx of [-6, 6]) ctx.fillRect(bx - 2.5, -20, 5, 40); ctx.restore();
  K.gl(-9, -8, 7, 3.5, .55);
  K.poly([[22, -3], [22, 3], [34, 0]], INK, 2);
  ctx.fillStyle = '#fff'; el(-13, -4, 5, 5.5); ctx.fill(); ctx.fillStyle = INK; el(-12, -3, 2.4, 2.8); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-19, -12); ctx.lineTo(-8, -8); ctx.stroke();
  ctx.restore();
}
function ccFrog(sp) {
  const rs = Math.sqrt(sp), FX = 400, FY = 545, MX = 400, MY = 508, NEED = 3, NB = sp > 1.5 ? 3 : 2;
  const ents = []; let c = 0, got = 0, tg = null, tt = 0, aimA = -Math.PI / 2, mstick = null;
  for (let i = 0; i < NEED + NB; i++) {
    const heartE = i < NEED, a = rnd(0, 6.283), v = (heartE ? rnd(55, 85) : rnd(85, 120)) * rs;
    ents.push({ k: heartE ? 'h' : 'b', x: 120 + (i * 137) % 560 + rnd(-20, 20), y: 160 + (i * 71) % 190 + rnd(0, 30), vx: Math.cos(a) * v, vy: Math.sin(a) * v * .6, ph: rnd(0, 6), dead: false });
  }
  const ot = K.outro(); const popT = [-9, -9, -9];
  const flick = (x, y, ent) => {
    if (g.result || tg) return;
    tg = { x, y, ent }; tt = 0; sfx.whoosh(true);
  };
  const near = (px, py, rad) => {
    let b = null, bd = rad;
    for (const e of ents) { if (e.dead) continue; const d = Math.hypot(e.x - px, e.y - py) * (rad / (e.k === 'h' ? rad : 50)); if (d < bd) { bd = d; b = e; } }
    return b;
  };
  const g = {
    get c() { return c; }, cmd: 'LICK!', hint: 'CLICK A HEART (OR AIM WITH ARROWS, SPACE): AVOID BEES', thint: 'TAP THE HEARTS, NOT THE BEES', dur: 6,
    down(p) { if (g.result) return; const e = near(p.x, p.y, 72); aimA = Math.atan2(p.y - MY, p.x - MX); flick(e ? e.x : p.x, e ? e.y : p.y, e); },
    key(e) {
      if (e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return;
      const dx = Math.cos(aimA), dy = Math.sin(aimA); let b = null, bp = 1e9;
      for (const en of ents) { if (en.dead) continue; const rx = en.x - MX, ry = en.y - MY, pr = rx * dx + ry * dy, pe = Math.abs(rx * dy - ry * dx); if (pr > 0 && pe < 50 && pr < bp) { bp = pr; b = en; } }
      flick(b ? b.x : MX + dx * 380, b ? b.y : MY + dy * 380, b);
    },
    update(dt) {
      ot.mark(g);
      c += dt;
      if (!g.result && (keys.ArrowLeft || keys.KeyA)) aimA -= 1.5 * dt;
      if (!g.result && (keys.ArrowRight || keys.KeyD)) aimA += 1.5 * dt;
      aimA = clamp(aimA, -Math.PI * .96, -Math.PI * .04);
      for (const e of ents) {
        if (e.dead) continue;
        if (!g.result && !(tg && tg.ent === e && tt > .08)) {
          e.x += e.vx * dt; e.y += e.vy * dt + Math.sin(c * 2 + e.ph) * 12 * dt;
          if (e.x < 60) { e.x = 60; e.vx = Math.abs(e.vx); } if (e.x > 700) { e.x = 700; e.vx = -Math.abs(e.vx); }
          if (e.y < 150) { e.y = 150; e.vy = Math.abs(e.vy); } if (e.y > 390) { e.y = 390; e.vy = -Math.abs(e.vy); }
          if (e.k === 'b') { e.vx += Math.sin(c * 3 + e.ph) * 40 * dt; }
        }
      }
      if (tg) {
        tt += dt; if (tg.ent && !tg.ent.dead) { tg.x = tg.ent.x; tg.y = tg.ent.y; }
        if (tt >= .12 && !tg.done) {
          tg.done = true;
          if (tg.ent && !tg.ent.dead && Math.hypot(tg.ent.x - tg.x, tg.ent.y - tg.y) < 60) {
            const e = tg.ent;
            if (e.k === 'h') { e.dead = true; popT[got] = now; got++; sfx.coin(); sfx.blip(got * 3); burst(e.x, e.y, '#ff4d9e', 12); ring(e.x, e.y, '#fff', 60, .3); floatText('YUM!', e.x, e.y - 40, '#ff4d9e', 32); if (got >= NEED) { g.result = 'win'; ccWin(400, 300); } }
            else { e.dead = true; g.result = 'lose'; ccLose(e.x, e.y); floatText('OUCH!', e.x, e.y - 40, RED, 44); }
          } else sfx.miss();
        }
        if (tt >= .26) tg = null;
      }
    },
    draw(t) {
      const T = now, oT = ot.t(g), win = g.result === 'win', lose = g.result === 'lose';
      if (!BG_FROG) BG_FROG = K.bake(W, H, () => {
        const X = K.cx(); X.fillStyle = K.vg(0, 250, [[0, '#4cb4ee'], [.6, '#8fdbfb'], [1, '#dcf8ff']]); X.fillRect(0, 0, W, 250);
        K.hills(0, W, 250, 56, .006, 1.7, '#c9d0fb', '#7b80c6', 3, 252); K.hills(0, W, 252, 30, .01, 4, '#87d19b', '#4f9a6a', 3, 254);
        for (const [tx0, ty0] of [[90, 236], [610, 232], [740, 238]]) { K.rail(tx0, ty0, tx0, ty0 - 30, 8); X.beginPath(); X.arc(tx0, ty0 - 46, 22, 0, K.TAU); ink('#3fb260', 3); K.gl(tx0 - 8, ty0 - 54, 8, 4.5, .35); }
        X.fillStyle = K.vg(250, H, [[0, '#62d3f0'], [.45, '#3fb2e6'], [1, '#2a8fcb']]); X.fillRect(0, 250, W, H - 250); K.horizon(250, 0, W, 4);
        X.strokeStyle = 'rgba(255,255,255,.3)'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 16; i++) { const rx = K.hash(i) * 700, ry = 270 + K.hash(i + 30) * 280; X.beginPath(); X.moveTo(rx, ry); X.lineTo(rx + 40 + K.hash(i + 7) * 40, ry); X.stroke(); }
        for (const [px, py, r] of [[90, 380, 36], [700, 330, 30], [640, 470, 38], [170, 500, 32], [300, 330, 26]]) { K.ce(px, py, r, r * .38, '#5CD65C', '#32a43a', 3.5, 0, 2, 3); X.fillStyle = INK; X.beginPath(); X.moveTo(px, py); X.lineTo(px + r * .9, py - r * .2); X.lineTo(px + r * .9, py + r * .2); X.closePath(); X.fill(); }
        for (const [px, py] of [[72, 372], [716, 326]]) { X.beginPath(); X.arc(px, py - 4, 6, 0, K.TAU); ink('#ff8fb0', 2.5); }
        for (const [rx0, ry0] of [[20, 300], [770, 290], [36, 350], [752, 340]]) { K.line([[rx0, ry0 + 60], [rx0, ry0]], 4, '#3fae4a'); K.cr(rx0 - 6, ry0 - 28, 12, 30, 6, '#8a5a34', '#5e3a1c', 3, 1, 0); }
        K.ce(400, 556, 150, 32, '#5CD65C', '#32a43a', 4.5, 0, 4, 5);
        K.post(300, 252, 128, 10); K.post(500, 252, 128, 10); K.cr(276, 62, 248, 68, 10, '#e9a35c', '#a5622c', 4, 3, 4);
        for (let i = 0; i < 3; i++) K.ce(330 + i * 70, 98, 18, 18, '#7a4a22', '#5e3a1c', 3, 0, 0, 0);
      });
      ctx.drawImage(BG_FROG, 0, 0);
      for (const [cx0, cy0, s0, sp0] of [[60, 120, 1, 6], [450, 180, .8, 4], [700, 100, .9, 5]]) K.cloud(((cx0 + T * sp0) % 1000) - 150, cy0, s0);
      // dragonfly gag over the water
      const dfx = 400 + Math.sin(T * .7) * 330, dfy = 300 + Math.sin(T * 1.9) * 24;
      ctx.save(); ctx.translate(dfx, dfy); K.line([[-14, 0], [12, 0]], 4, '#3dd6c4'); for (const sd of [-1, 1]) { ce(sd * 3, -5, 12, 3.4, 'rgba(255,255,255,.85)', 'rgba(190,225,255,.9)', 2, sd * (.2 + Math.abs(Math.sin(T * 40)) * .3)); } ctx.restore();
      // sign hearts
      for (let i = 0; i < NEED; i++) if (i < got) K.heart(330 + i * 70, 98, 1.5 * (1 + Math.max(0, .3 - (T - popT[i])) * 1.2), 1);
      // reticle (keyboard)
      if (!TOUCH && !g.result) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(MX, MY); ctx.lineTo(MX + Math.cos(aimA) * 420, MY + Math.sin(aimA) * 420); ctx.stroke(); ctx.setLineDash([]); }
      for (const e of ents) {
        if (e.dead) continue;
        if (e.k === 'h') { const s = 1 + Math.sin(now * 5 + e.ph) * .08; K.heart(e.x, e.y + 2, 2.1 * s); }
        else beeA(e.x, e.y + Math.sin(now * 8 + e.ph) * 3, 1.4, e.ph);
      }
      // frog + tongue
      let tip = null;
      if (tg) { const u = tt < .12 ? tt / .12 : 1 - (tt - .12) / .14, k = clamp(u, 0, 1); tip = { x: MX + (tg.x - MX) * k, y: MY + (tg.y - MY) * k }; }
      if (tip) { K.line([[MX, MY], [tip.x, tip.y]], 11, '#FF6F91'); ce(tip.x, tip.y, 14, 13, '#FF6F91', '#d8456c', 4); K.gl(tip.x - 4, tip.y - 4, 4, 3, .6); }
      const full = win ? 1 : got / NEED, T2 = now;
      K.shade(FX, FY + 24, 96, 16, .25);
      for (const sd of [-1, 1]) ce(FX + sd * 66, FY + 12, 26, 13, '#4ADE5A', '#2fa83e', 4);
      ce(FX, FY - 20, 74 + full * 6, 54 + full * 6, '#4ADE5A', '#2fa83e', 5.5); K.gl(FX - 28, FY - 52, 18, 7, .4);
      ce(FX, FY - 8, 46 + full * 6, 32 + full * 5, '#c8f7a0', '#98d870', 0);
      ctx.fillStyle = 'rgba(255,110,150,.5)'; for (const sd of [-1, 1]) { el(FX + sd * 52, FY - 30, 8, 5); ctx.fill(); }
      const em = win ? 'happy' : lose ? 'dizzy' : 'idle';
      for (const sd of [-1, 1]) { ce(FX + sd * 36, FY - 74, 22, 22, '#4ADE5A', '#2fa83e', 4.5); K.eye(FX + sd * 36, FY - 76, 14, em, [Math.cos(aimA), Math.sin(aimA)], T2, sd > 0 ? 1 : 0); }
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      if (lose) { ctx.moveTo(FX - 28, FY - 22); ctx.quadraticCurveTo(FX, FY - 40, FX + 28, FY - 22); }
      else if (tip) { ctx.ellipse(FX, FY - 36, 18, 8, 0, 0, 7); } else if (win) { ctx.moveTo(FX - 32, FY - 40); ctx.quadraticCurveTo(FX, FY - 14, FX + 32, FY - 40); } else { ctx.moveTo(FX - 32, FY - 36); ctx.quadraticCurveTo(FX, FY - 20, FX + 32, FY - 36); }
      ctx.stroke();
      if (lose) { ce(FX + 30, FY - 28, 11, 8, '#ff6a6a', '#c92a3a', 3); beeA(FX + 62, FY - 78 + Math.sin(T2 * 12) * 5, 1.1, 0); }
      K.pill(FX, FY - 128, 'YOU', YEL, false);
      if (win && oT < .95) for (let i = 0; i < 3; i++) K.heart(FX + (i - 1) * 46, FY - 150 - oT * 40 - i * 10, 1.4, 1 - oT / .95);
      vignette(.2);
    }
  };
  return g;
}
reg('cc_frog', ccFrog, 'Lickety-Split');

/* ───────── 8 PINCH: shell game with hens - follow the golden egg, then pinch the right hen ───────── */
let BG_HEN = null;
function cowHead(x, y, T) {
  const ch = Math.sin(T * 5) * 1.6;
  for (const sd of [-1, 1]) { ce(x + sd * 36, y - 20, 17, 8, '#fff', '#d6cfe6', 3, sd * (.3 + Math.sin(T * 2.2 + sd) * .1)); }
  for (const sd of [-1, 1]) K.cp([[x + sd * 14, y - 34], [x + sd * 22, y - 52], [x + sd * 26, y - 34]], '#fff3d6', '#d9c18a', 3, 1, 1);
  ce(x, y, 36, 32, '#fff', '#d6cfe6', 4.5); ctx.fillStyle = '#3b3340'; el(x - 20, y - 14, 11, 9, .4); ctx.fill();
  ce(x, y + 17 + ch * .4, 23, 15, '#ffb3c9', '#e0809f', 3.5); ctx.fillStyle = INK; for (const sd of [-1, 1]) { el(x + sd * 8, y + 15 + ch * .4, 2.6, 3.4); ctx.fill(); }
  K.eye(x - 15, y - 6, 6.2, 'idle', [Math.sin(T * .8), .2], T, 0); K.eye(x + 15, y - 6, 6.2, 'idle', [Math.sin(T * .8), .2], T, 1);
}
function mouseA(x, y, dir, T) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.beginPath(); ctx.moveTo(-16, -6); ctx.quadraticCurveTo(-34, -4 + Math.sin(T * 14) * 4, -42, -14); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffb3c9'; ctx.stroke();
  ce(0, -9, 17, 10, '#cfc8d8', '#9d96ad', 3.5); ce(14, -12, 9, 7, '#cfc8d8', '#9d96ad', 3); ce(10, -20, 5, 6, '#ffb3c9', '#e0809f', 2.5);
  ctx.fillStyle = INK; el(16, -14, 1.8, 1.8); ctx.fill(); el(22, -11, 1.8, 1.4); ctx.fill();
  const st = Math.sin(T * 24) * 2; ctx.fillRect(-6, -2, 3, 2 + st); ctx.fillRect(6, -2, 3, 2 - st);
  ctx.restore();
}
function ccHen(sp) {
  const rs = Math.sqrt(sp), SX = [190, 400, 610], SY = 400, ST = .42 / rs, SHOW = .95;
  const hens = [0, 1, 2].map(i => ({ id: i, slot: i, fx: SX[i], fy: 0, lift: 0 }));
  const eggHen = Math.floor(Math.random() * 3), NSW = Math.max(3, Math.min(7, 4 + Math.round((sp - 1) * 1.5), Math.floor((5.8 - SHOW - 2.1) / ST)));
  let c = 0, ph = 'show', pt = SHOW, swaps = 0, sw = null, cur = 1, chosen = -1, last = [-1, -1];
  const ot = K.outro();
  const slotOf = id => hens.find(h => h.id === id);
  const startSwap = () => {
    let a, b; do { a = Math.floor(Math.random() * 3); b = (a + 1 + Math.floor(Math.random() * 2)) % 3; } while ((a === last[0] && b === last[1]) || (a === last[1] && b === last[0]));
    last = [a, b];
    const ha = hens.find(h => h.slot === a), hb = hens.find(h => h.slot === b);
    sw = { ha, hb, a, b, t: 0 }; sfx.tick();
  };
  const pick = slot => {
    if (g.result || ph !== 'pick') return;
    const h = hens.find(h => h.slot === slot); chosen = h.id; ph = 'reveal'; pt = .3;
    if (h.id === eggHen) { g.result = 'win'; ccWin(SX[slot], 300); sfx.boing(); floatText('PINCH!', SX[slot], 220, YEL, 44); }
    else { g.result = 'lose'; ccLose(SX[slot], 360); floatText('EMPTY!', SX[slot], 220, RED, 44); }
  };
  const g = {
    get c() { return c; }, cmd: 'PINCH!', hint: 'WATCH THE EGG, THEN CLICK OR PRESS 1 2 3 TO PICK THE HEN', thint: 'WATCH THE EGG, THEN TAP ITS HEN', dur: 6,
    down(p) {
      if (ph !== 'pick') return;
      let b = 0, bd = 1e9; for (let i = 0; i < 3; i++) { const d = Math.abs(p.x - SX[i]); if (d < bd) { bd = d; b = i; } }
      cur = b; pick(b);
    },
    key(e) {
      if (e.repeat || ph !== 'pick') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') cur = (cur + 2) % 3;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') cur = (cur + 1) % 3;
      else if (e.code === 'Digit1' || e.code === 'Numpad1') { cur = 0; pick(0); }
      else if (e.code === 'Digit2' || e.code === 'Numpad2') { cur = 1; pick(1); }
      else if (e.code === 'Digit3' || e.code === 'Numpad3') { cur = 2; pick(2); }
      else if (e.code === 'Space' || e.code === 'Enter') pick(cur);
    },
    update(dt) {
      ot.mark(g);
      c += dt; pt -= dt;
      if (ph === 'show') {
        const hh = slotOf(eggHen); hh.lift = Math.sin(clamp((SHOW - pt) / SHOW, 0, 1) * Math.PI) * 70;
        if (pt <= 0) { hh.lift = 0; ph = 'shuffle'; startSwap(); }
      } else if (ph === 'shuffle') {
        sw.t += dt; const u = clamp(sw.t / ST, 0, 1), e = u * u * (3 - 2 * u);
        sw.ha.fx = SX[sw.a] + (SX[sw.b] - SX[sw.a]) * e; sw.hb.fx = SX[sw.b] + (SX[sw.a] - SX[sw.b]) * e;
        sw.ha.fy = -Math.sin(u * Math.PI) * 46; sw.hb.fy = Math.sin(u * Math.PI) * 30;
        if (u >= 1) {
          sw.ha.slot = sw.b; sw.hb.slot = sw.a; sw.ha.fx = SX[sw.b]; sw.hb.fx = SX[sw.a]; sw.ha.fy = sw.hb.fy = 0; swaps++; sfx.blip(swaps);
          if (swaps >= NSW) { ph = 'pick'; sw = null; sfx.tickHi(); } else startSwap();
        }
      } else if (ph === 'reveal') {
        const h = slotOf(chosen); h.lift = Math.min(70, h.lift + 400 * dt);
        if (g.result === 'lose') { const e = slotOf(eggHen); e.lift = Math.min(70, e.lift + 300 * dt); }
      }
    },
    draw(t) {
      const T = now, oT = ot.t(g), win = g.result === 'win', lose = g.result === 'lose';
      if (!BG_HEN) BG_HEN = K.bake(W0, H, () => {
        const X = K.cx(); X.fillStyle = '#e8553d'; X.fillRect(0, 0, W0, 230); X.fillStyle = 'rgba(0,0,0,.14)'; for (let i = 0; i < 16; i++) X.fillRect(i * 50 + 8, 0, 4, 230);
        X.fillStyle = '#c7402e'; X.fillRect(0, 0, W0, 14); K.cr(-10, 206, W0 + 20, 22, 4, '#8a5a34', '#5e3a1c', 3.5, 0, 3);
        X.fillStyle = K.vg(230, H, [[0, '#ffd966'], [1, '#f0c14a']]); X.fillRect(0, 230, W0, H - 230); K.horizon(230, 0, W0, 5);
        X.fillStyle = 'rgba(20,16,28,.08)'; X.fillRect(0, 232, W0, 14);
        X.strokeStyle = '#e0b840'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 30; i++) { const sx = K.hash(i) * 780 + 10, sy = 250 + K.hash(i + 20) * 320, a = K.hash(i + 40) * 1.2 - .6; X.beginPath(); X.moveTo(sx, sy); X.lineTo(sx + Math.cos(a) * 20, sy + Math.sin(a) * 10); X.stroke(); }
        // hay bales and a pitchfork against the wall
        for (const [bx, by, bw] of [[28, 150, 96], [64, 96, 80]]) { K.cr(bx, by, bw, 56, 8, '#f6d35e', '#d9a82c', 4, 3, 4); X.strokeStyle = '#b8862a'; X.lineWidth = 2.5; for (let i = 1; i < 5; i++) { X.beginPath(); X.moveTo(bx + i * bw / 5, by + 6); X.lineTo(bx + i * bw / 5 - 3, by + 50); X.stroke(); } K.line([[bx + 12, by + 28], [bx + bw - 12, by + 28]], 4, '#e8553d'); }
        K.line([[700, 218], [740, 70]], 6, '#a5622c'); for (const k of [-10, 0, 10]) K.line([[728 + k * .9 + 12, 76], [731 + k * 1.5 + 16, 42]], 3.5, '#d6dbe8');
        K.line([[717 + 10, 82], [750, 78]], 4.5, '#8f9cb3');
      });
      ctx.drawImage(BG_HEN, 0, 0);
      // the loft window with a cow peeking over the sill
      ctx.save(); K.rr(330, 70, 140, 140, 10); ctx.clip(); ctx.fillStyle = K.vg(70, 210, [[0, '#4a2f2a'], [1, '#6b4636']]); ctx.fillRect(330, 70, 140, 140); cowHead(400, 190 + Math.sin(T * 1.1) * 4, T); ctx.restore();
      K.rr(330, 70, 140, 140, 10); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.stroke();
      mouseA(((T * 70) % 1000) - 100, 242, 1, T);
      // nests (+ egg when revealed)
      const eggShown = ph === 'show' || g.result === 'lose' || (g.result === 'win' && ph === 'reveal');
      for (let i = 0; i < 3; i++) {
        const sx = SX[i]; ce(sx, SY + 6, 88, 28, '#c8913e', '#9a6a28', 4.5, 0, 6, 6); ce(sx, SY + 2, 76, 20, '#e8c070', '#c4903f', 0, 0, 4, 4);
        ctx.strokeStyle = '#f2d27a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let j = 0; j < 7; j++) { const a = Math.PI * (.1 + j * .8 / 6), q = Math.cos(a) * 80; ctx.beginPath(); ctx.moveTo(sx + q, SY + 6 + Math.sin(a) * 10); ctx.lineTo(sx + q * 1.08, SY - 6 + Math.sin(a) * 4); ctx.stroke(); }
        if (ph === 'pick' && cur === i && !TOUCH) { ctx.strokeStyle = YEL; ctx.lineWidth = 6; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.ellipse(sx, SY - 40, 110, 80, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      }
      if (eggShown) { const h = slotOf(eggHen); eggA(h.fx, SY - 4, 24, ph === 'show' || win); }
      const order = hens.slice().sort((a, b) => (a.fy + SY) - (b.fy + SY));
      for (const h of order) {
        const isCh = h.id === chosen;
        henA(h.fx, SY + h.fy, 1.05, { lift: h.lift, peck: ph === 'shuffle' || (ph === 'pick' && Math.sin(now * 3 + h.id) > .9), dizzy: lose && isCh, happy: win && isCh, panic: ph === 'shuffle' && Math.abs(h.fy) > 10 });
        if (lose && isCh) for (let i = 0; i < 3; i++) { const a = now * 6 + i * 2.1; K.star(h.fx + 32 + Math.cos(a) * 26, SY - h.lift * 1.05 - 134 + Math.sin(a) * 7, 7, 3, 5, a, '#FFE14D', 2); }
        if (win && isCh && oT < .95) K.heart(h.fx + 54, SY - 150 - oT * 40, 1.3, 1 - oT / .95);
        if (ph === 'pick' && !TOUCH) K.keyCap(SX[h.slot], SY + 54, String(h.slot + 1));
      }
      if (ph === 'show' || ph === 'shuffle') K.badge('WATCH', 400, 244, 32, '#4DB8FF', '#fff', 1, -.03);
      else if (ph === 'pick') { const p = .75 + .25 * Math.sin(now * 8); ctx.globalAlpha = p; K.badge('PICK!', 400, 244, 36, YEL, INK, 1 + .04 * Math.sin(now * 8), .03); ctx.globalAlpha = 1; }
      // the egg tray: one gold egg per swap done
      const tw = NSW * 40 + 18; K.cr(400 - tw / 2, 490, tw, 44, 12, '#e9a35c', '#a5622c', 4, 3, 4);
      for (let i = 0; i < NSW; i++) { const ex = 400 - (NSW - 1) * 20 + i * 40; ce(ex, 513, 13, 14, '#7a4a22', '#5e3a1c', 2.5, 0, 0, 0); if (i < swaps) eggA(ex, 512, 12, false); }
      vignette(.2);
    }
  };
  return g;
}
reg('cc_hen', ccHen, 'Chicken Pinch');

})();
