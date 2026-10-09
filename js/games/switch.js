'use strict';
/* Switch wave — WarioWare Get It Together! / Move It! inspired microgames.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/up/move}; set g.result = 'win'|'lose' */

/* ───────────── art kit for the switch games: the DUO look (docs/ART-STYLE.md). A local copy of the DUO drawing helpers.
   Everything draws on X, which can be swapped for an offscreen context so the same code bakes the static scene once.
   Cosmetic only: nothing here calls Math.random, so the game's own randomness (and the seeded party RNG) is never touched. ───────────── */
const SWK = (() => {
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
  const K = { TAU };
  K.cx = () => X;
  const clamp = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  K.lerp = (a, b, k) => a + (b - a) * k;
  K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
  const BK = {};   // baked scenes (VW x H, drawn at -OX): keyed by name + the current view width
  K.baked = (key, fn) => { const k = key + '@' + VW; if (!BK[k]) BK[k] = K.bake(VW, H, x => { x.translate(OX, 0); fn(); }); return BK[k]; };
  /* the outro clock: set in update() (shoot.js draws once), with a fallback in draw() */
  K.outro = () => { let t0 = -1; return { mark(g) { if (g.result && t0 < 0) t0 = now; }, t(g) { if (!g.result) return 0; if (t0 < 0) t0 = now; return Math.max(0, now - t0); } }; };
  const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const mkRR = K.mkRR = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  const PR = {}; K.rrP = (x, y, w, h, r) => { const k = x + ',' + y + ',' + w + ',' + h + ',' + r; return PR[k] || (PR[k] = mkRR(x, y, w, h, r)); };
  const PE = {}; K.elP = (x, y, rx, ry) => { const k = x + ',' + y + ',' + rx + ',' + ry; if (!PE[k]) { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); PE[k] = p; } return PE[k]; };
  const PD = {}; K.P = d => PD[d] || (PD[d] = new Path2D(d));
  const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const inkP = K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  const cel = K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  K.poly = (pts, fill, o = 4) => { X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.closePath(); ink(fill, o); };
  K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  K.curve = (a, b, c, d, e, f, w, col) => { X.beginPath(); X.moveTo(a, b); X.quadraticCurveTo(c, d, e, f); X.lineCap = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
  K.vg = (y0, y1, stops) => { const g = X.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
  /* a row of hills: a sine skyline from L to R sitting on `base` */
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
  /* blocky Caos arms (hippo.js): call with the origin at Caos's feet, before caos() */
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
  K.sun = (sx, sy, T) => {
    X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 40); X.lineTo(8, 40); X.lineTo(0, 70); X.fill(); }
    X.restore(); X.beginPath(); X.arc(sx, sy, 32, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 10, sy - 10, 12, 8, -.6); X.fill();
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
  /* feedback word: a coloured slab with a gloss and a drop shadow (hippo badge) */
  K.badge = (s, x, y, size, bg, fg, sc = 1, rot = 0) => {
    s = typeof t === 'function' ? t(s) : s; X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = X.measureText(s).width + size * .9, h = size * 1.25;
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .3); X.fill();
    rr(-w / 2, -h / 2, w, h, h * .3); ink(bg, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + 6, -h / 2 + 5, w - 12, h * .2, h * .1); X.fill();
    X.fillStyle = fg; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, 0, size * .05); X.restore();
  };
  /* the little pill with a bar inside (progress objects) */
  K.pillBar = (x, y, w, h, k, colA, colB) => {
    rr(x, y, w, h, h / 2); ink('#fff', 4);
    X.save(); rr(x + 2, y + 2, w - 4, h - 4, h / 2 - 2); X.clip(); X.fillStyle = k > .5 ? colB : colA; X.fillRect(x, y, w * k, h);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(x, y + 3, w * k, h * .28); X.restore();
  };
  return K;
})();

const swSad = (g) => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const swLose = () => { sfx.miss(); sfx.thud(); shake(8, .25); };
function swMix(a, b, k) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const x = p(a), y = p(b); k = Math.max(0, Math.min(1, k));
  return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',') + ')';
}
function swEllipse(x, y, rx, ry, fill, o = 4) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7);
  if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
function swPoly(pts, fill, o = 4) {
  ctx.beginPath(); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.lineJoin = 'round';
  if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
/* shared bits */
const swSkin = ['#ffcba4', '#f0a37e'];

/* ── 1 FREEZE: don't move while a truck bears down on you (a living statue on a country road, a cow at the wheel) ── */
function fzBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX, yb = 600 + OX * .933;
  X.fillStyle = K.vg(0, 262, [[0, '#3fb0ff'], [.6, '#8fdcff'], [1, '#e6fbff']]); X.fillRect(L, 0, VW, 262);
  K.hills(L, R, 252, 46, .006, 1, '#a9dfc6', null);
  K.hills(L, R, 256, 26, .011, 3, '#87d19b', '#4f9a6a', 3);
  // the barn and silo
  const BARN = K.rrP(600, 214, 84, 40, 5); K.cel(BARN, '#d94a4a', '#a83038', 6, 4, 3);
  K.poly([[592, 218], [642, 188], [692, 218]], '#7a4a2a', 3); K.rr(626, 232, 32, 22, 3); K.ink('#fff', 2); X.strokeStyle = '#a83038'; X.lineWidth = 2; X.beginPath(); X.moveTo(626, 232); X.lineTo(658, 254); X.moveTo(658, 232); X.lineTo(626, 254); X.stroke();
  const SILO = K.rrP(704, 190, 30, 64, 10); K.cel(SILO, '#dfe4ee', '#a9b2c6', 5, 3, 3);
  for (const [tx, tr] of [[90, 18], [140, 14], [250, 16], [320, 12]]) { K.line([[tx, 254], [tx, 254 - tr * 1.4]], 4, '#8a5a34'); X.beginPath(); X.arc(tx, 252 - tr * 2, tr, 0, K.TAU); K.ink('#43b366', 3); X.fillStyle = 'rgba(255,255,255,.28)'; K.el(tx - tr * .35, 252 - tr * 2.4, tr * .35, tr * .22, -.5); X.fill(); }
  // the windmill tower (its blades turn live)
  K.poly([[188, 254], [196, 196], [204, 254]], '#e8dcc0', 3);
  // field + road
  X.fillStyle = K.vg(250, 600, [[0, '#8fdc5c'], [1, '#5fb944']]); X.fillRect(L, 250, VW, 360);
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -6; i < 16; i++) { X.beginPath(); X.moveTo(i * 90, 250); X.lineTo(i * 90 + 40, 250); X.lineTo(i * 90 - 160, 610); X.lineTo(i * 90 - 240, 610); X.fill(); }
  K.horizon(250, L, R);
  K.poly([[375, 250], [425, 250], [R, yb], [L, yb]], '#55506b', 5);
  X.save(); X.beginPath(); X.moveTo(400, 250); X.lineTo(425, 250); X.lineTo(R, yb); X.lineTo(400, yb); X.clip(); X.fillStyle = 'rgba(20,16,28,.14)'; X.fillRect(L, 250, VW, 400); X.restore();
  X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 4; X.lineCap = 'round';
  for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(400 + sd * 22, 252); X.lineTo(400 + sd * (400 + OX) * .93, yb - 10); X.stroke(); }
  for (let i = 0; i < 14; i++) { const hx = (i * 61) % VW + L, hy = 330 + (i * 47) % 230; if (Math.abs(hx - 400) > 40 + (hy - 250) * 1.05) { X.fillStyle = '#3f8f35'; X.fillRect(hx, hy, 2.5, 9); X.fillRect(hx + 5, hy + 2, 2.5, 7); X.fillRect(hx - 5, hy + 2, 2.5, 7); } }
  // the jitter gauge post
  K.line([[70, 400], [70, 520]], 8, '#8a5a34');
  const SIGN = K.rrP(24, 150, 92, 250, 18); K.cel(SIGN, '#d9944f', '#a5622c', 5, 5, 4);
  X.fillStyle = 'rgba(255,255,255,.22)'; K.rr(32, 158, 14, 234, 6); X.fill();
}
function fzTruck(s, k, mood, T, nod) {
  const K = SWK, X = ctx;
  X.save(); X.scale(s, s); X.rotate(nod || 0);
  for (const sx of [-1, 1]) { K.rr(sx * 96 - 18, -34, 36, 34, 10); K.ink('#2b2640', 4); }
  const BODY = K.rrP(-112, -196, 224, 170, 20); K.cel(BODY, '#ef4438', '#b42a33', 8, 6, 5);
  X.save(); X.clip(BODY); X.fillStyle = '#ffd23f'; X.fillRect(-120, -196, 240, 14); X.restore(); K.glint(BODY, -70, -150, 30, 8, .4, -.3);
  const WIN = K.rrP(-86, -174, 172, 70, 12); K.cel(WIN, '#bfefff', '#8bc6e6', 5, 4, 4);
  X.save(); X.clip(WIN);
  for (const sx of [-1, 1]) { K.el(sx * 46, -114, 10, 17, sx * .4); K.ink('#f4f4f4', 3); }
  const HD = K.elP(0, -108, 44, 36); K.cel(HD, '#fff', '#d5dae6', 4, 4, 3.5);
  X.fillStyle = '#2b2640'; K.el(-25, -122, 14, 11, .3); X.fill();
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 24, -140); X.lineTo(sx * 34, -158); X.lineTo(sx * 40, -138); X.closePath(); K.ink('#f4d998', 2.5); }
  K.el(0, -92, 25, 14); K.ink('#ffb3c1', 3); X.fillStyle = INK; K.el(-8, -92, 3, 4); X.fill(); K.el(8, -92, 3, 4); X.fill();
  K.rr(-36, -152, 72, 16, 7); K.ink('#4d8fe8', 3);
  const em = mood === 'angry' ? 'idle' : mood;
  K.eye(-17, -117, 8.5, em, [0, .4], T, 0); K.eye(17, -117, 8.5, em, [0, .4], T, 1);
  if (mood === 'angry') { X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(-28, -134); X.lineTo(-8, -127); X.moveTo(28, -134); X.lineTo(8, -127); X.stroke(); }
  if (mood === 'panic') K.sweat(34, -128, 1.4, T);
  X.restore();
  for (const sx of [-1, 1]) { K.el(sx * 82, -62, 16 + k * 2, 16 + k * 2); K.ink('#ffe14d', 4); X.fillStyle = '#fff8c0'; K.el(sx * 82 - 4, -66, 5, 4); X.fill(); }
  const GR = K.rrP(-52, -90, 104, 44, 8); K.cel(GR, '#cfd8e6', '#8f9cb3', 4, 4, 4);
  X.strokeStyle = INK; X.lineWidth = 3; for (let i = -2; i <= 2; i++) { X.beginPath(); X.moveTo(i * 18, -84); X.lineTo(i * 18, -52); X.stroke(); }
  const BM = K.rrP(-124, -34, 248, 32, 12); K.cel(BM, '#5a5274', '#3b3550', 5, 4, 4); K.glint(BM, -80, -26, 30, 4, .3, 0);
  X.restore();
}
function swFreeze(sp) {
  const D = 4 / Math.sqrt(sp), lim = 22; let c = 0, ax = mouse.x, ay = mouse.y, dev = 0;
  let honk = false;
  const O = SWK.outro();
  const bust = () => { if (!g.result && c > .35) { g.result = 'lose'; swLose(); burst(400, 520, '#fff', 14); floatText('MOVED!', 400, 440, '#ff4d4d', 40); } };
  const g = {
    wide: true, cmd: 'FREEZE!', hint: 'DON\'T MOVE THE MOUSE OR KEYS', thint: 'DON\'T TOUCH THE SCREEN', dur: 4, timeWin: true,
    move(p) {
      if (g.result) return;
      if (c < .35) { ax = p.x; ay = p.y; return; }
      dev = Math.max(dev, Math.hypot(p.x - ax, p.y - ay)); if (dev > lim) bust();
    },
    down() { bust(); }, key() { bust(); },
    update(dt) {
      O.mark(g);
      if (g.result) return;
      c += dt; dev *= Math.pow(.6, dt);
      if (c > 1 && Math.random() < dt * 2) { sfx.thud(); noise(.2, .03, 120, 60, 'lowpass'); }
      if (!honk && c > D * .7) { honk = true; sfx.buzz(); sfx.zap(); shake(4, .3); }
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', L = -OX, R = W + OX;
      X.drawImage(K.baked('fz', fzBake), -OX, 0);
      // drifting clouds + the windmill
      for (let i = 0; i < 4; i++) K.cloud(((now * (5 + i * 2) + i * 260) % (VW + 200)) - 140 - OX, 70 + (i % 2) * 70 + (i * 13) % 30, .9 + (i % 3) * .2);
      X.save(); X.translate(196, 192); X.rotate(now * .7); for (let i = 0; i < 4; i++) { X.rotate(Math.PI / 2); K.poly([[0, 0], [5, -34], [-5, -34]], '#fff', 2.5); } X.restore(); X.beginPath(); X.arc(196, 192, 5, 0, 7); K.ink('#e4f5ff', 2.5);
      // the gauge: a thermometer on a roadside sign
      const jk = Math.min(1, dev / lim); K.rr(56, 176, 30, 172, 15); K.ink('#fff', 3);
      X.save(); K.rr(58, 178, 26, 168, 13); X.clip(); X.fillStyle = swMix('#5CFF7A', '#ff4d5e', jk); X.fillRect(56, 346 - 168 * Math.max(.06, jk), 34, 168); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(62, 182, 5, 160); X.restore();
      X.strokeStyle = INK; X.lineWidth = 3; for (let i = 1; i < 5; i++) { X.beginPath(); X.moveTo(92, 346 - i * 33); X.lineTo(104, 346 - i * 33); X.stroke(); }
      X.beginPath(); X.arc(70, 372, 13, 0, 7); K.ink(swMix('#5CFF7A', '#ff4d5e', jk), 3);
      txt('JITTER', 70, 405, 15, '#fff', 'center', 84);
      // the road dashes
      X.fillStyle = '#ffd23f'; for (let i = 0; i < 6; i++) { const k = ((i + (c * 1.2) % 1) / 6), y = 255 + k * k * 340, w = 3 + k * 16; K.rr(400 - w / 2, y, w, 8 + k * 40, 2); X.fill(); }
      // the truck: it lunges at you when you move, brakes in a cloud of smoke when you don't
      const k = Math.min(1, c / (D * .92)); let s = .12 + 1.15 * k * k;
      if (lost) s = K.lerp(s, 1.05, K.ease(ot / .22));
      let ty = 255 + 230 * s + (g.result ? 0 : Math.sin(now * 50) * k * 2);
      if (won) ty += Math.sin(Math.min(ot, .5) * 40) * 4 * Math.max(0, 1 - ot * 2);
      K.shade(400, ty + 4 * s, 140 * s, 24 * s, .3);
      if (won && ot > 0) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const pr = (16 + i * 7 + ot * 24) * s; K.puff(400 + sx * (150 + i * 44 + ot * 40) * s, Math.min(ty - 10 * s - i * 10, 535 - pr * .9), pr, Math.max(0, 1 - ot * 1.1)); }
      X.save(); X.translate(400, ty); fzTruck(s, k, lost ? 'happy' : (won || k > .75) ? 'panic' : 'angry', now, won ? Math.min(ot * 14, 1) * .05 * Math.max(0, 1 - ot) : 0); X.restore();
      if (k > .1 && !g.result) { X.strokeStyle = 'rgba(255,255,255,.6)'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i * .78 + .2, r1 = 160 + k * 60, r2 = r1 + 60 * k; X.beginPath(); X.moveTo(400 + Math.cos(a) * r1 * 1.4, 400 + Math.sin(a) * r1 * .8); X.lineTo(400 + Math.cos(a) * r2 * 1.4, 400 + Math.sin(a) * r2 * .8); X.stroke(); } }
      if (k > .7 && !g.result) { const hk = Math.sin(now * 30) > 0 ? 1 : .6; X.strokeStyle = '#ffe14d'; X.lineWidth = 5; X.lineCap = 'round'; for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(400 + sx * (170 + i * 14), ty - 190 * s - 6 + i * 14); X.lineTo(400 + sx * (200 + i * 18) * hk, ty - 200 * s - 16 + i * 18); X.stroke(); } }
      // Caos, the living statue (a hat for coins at his feet, a pigeon on his head)
      const fy = 506; let cx = 400, cy = fy, rot = 0;
      K.shade(400, fy + 20, 70, 9, .3);
      K.rr(352, fy, 96, 22, 5); X.save(); K.cel(K.rrP(352, fy, 96, 22, 5), '#d9944f', '#a5622c', 4, 4, 4); X.restore();
      K.el(334, fy + 26, 24, 8); K.ink('#8a5a34', 3); K.el(334, fy + 22, 18, 5); K.ink('#5a3a22', 2); for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(326 + i * 8, fy + 21, 4, 0, 7); K.ink('#ffd23f', 1.5); }
      if (lost && ot > .18) { const q = ot - .18; cx = 400 - q * 760; cy = fy - 330 * q + 900 * q * q; rot = -q * 14; }
      X.save(); X.translate(cx, cy); X.rotate(rot);
      const wob = lost ? 0 : Math.sin(now * 2) * .01;
      K.arms(5.4, won ? -.9 : -.5 + wob, won ? .9 : .5 - wob, 1, OR); X.restore();
      caos(cx, cy, 5.4, { mood: swSad(g) }); // (the arms are drawn first, then the body)
      if (!lost || ot < .22) {
        const sc = lost ? 1 : Math.min(1, 1 - Math.max(0, k - .6) * .3), pf = lost ? ot * 6 : 0, bx = cx + (lost ? pf * 90 : 0), by = cy - 55 - pf * 80 + (won ? -Math.abs(Math.sin(now * 7)) * 4 : 0), sh = k > .6 && !g.result ? Math.sin(now * 50) * 2 : 0;
        X.save(); X.translate(bx + sh, by); X.scale(sc * (lost ? 1.1 : 1), sc); K.el(0, 0, 14, 11); K.ink('#9aa3b8', 3); K.el(-3, 2, 8, 5); X.fillStyle = '#c9d0e0'; X.fill();
        K.el(11, -9, 8, 8); K.ink('#7e88a3', 3); X.beginPath(); X.moveTo(18, -9); X.lineTo(25, -7); X.lineTo(18, -5); X.closePath(); K.ink('#ffb347', 2); X.fillStyle = INK; X.beginPath(); X.arc(13, -11, 2.4, 0, 7); X.fill();
        X.restore();
        if (won && ot > .1) K.heart(cx + 20, cy - 90 - ot * 30, 1, 1 - ot);
      }
      if (lost && ot > .18) for (let i = 0; i < 3; i++) K.star(cx - 20 + i * 20, cy - 40 + Math.sin(now * 10 + i) * 6, 7, 3, 5, now * 5 + i, '#FFE14D', 2);
      if (won && ot > .1) for (let i = 0; i < 2; i++) K.heart(cx - 40 + i * 80, cy - 70 - ot * 40 - i * 14, .8, Math.max(0, 1 - ot));
      if (k > .5 && !g.result) K.sweat(cx + 40, cy - 40, 1.2, now);
      vignette(.2 + k * .25);
    }
  };
  return g;
}

/* ── 2 PICK: drop the swinging finger into the open nostril (a barbershop, a big uncle, the hand of the ceiling) ── */
function pkBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 600, [[0, '#d9a86a'], [1, '#ffe0a8']]); X.fillRect(L, 0, VW, 600);
  X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = L - (L % 60); x < R; x += 60) X.fillRect(x, 0, 28, 600);
  X.fillStyle = 'rgba(255,120,150,.45)'; for (let i = 0; i < 40; i++) { const x = L + (i * 97) % VW, y = (i * 61) % 560 + 20; if (Math.abs(x - 400) > 250 || y < 200) { X.beginPath(); X.arc(x, y, 5, 0, K.TAU); X.fill(); } }
  // wooden shelf with towels + a framed fish
  const FR = K.rrP(R - 150, 130, 110, 96, 8); K.cel(FR, '#a5622c', '#7a4620', 4, 4, 4); K.rr(R - 140, 140, 90, 76, 4); K.ink('#7fd6e8', 3);
  K.el(R - 95, 178, 26, 14); K.ink('#ff9a4d', 2.5); K.poly([[R - 70, 178], [R - 54, 166], [R - 54, 190]], '#ff9a4d', 2.5);
  K.horizon(560, L, R, 4); X.fillStyle = K.vg(560, 600, [[0, '#b97a46'], [1, '#8a5530']]); X.fillRect(L, 562, VW, 40);
}
function pkFace() {
  const K = SWK, X = K.cx();
  const ear = (sx) => { K.el(400 + sx * 306, 430, 36, 44); K.ink('#f0a37e', 5); K.el(400 + sx * 306, 432, 15, 22); K.ink('#d98c66', 3); };
  ear(-1); ear(1);
  const HEAD = K.elP(400, 450, 300, 230); K.cel(HEAD, '#ffcba4', '#f0a37e', 12, 10, 6); K.glint(HEAD, 250, 280, 80, 26, .35, -.3);
  X.fillStyle = '#b4553a'; for (let i = 0; i < 70; i++) { const a = K.hash(i) * K.TAU, r = Math.sqrt(K.hash(i + 99)) * .55; const x = 400 + Math.cos(a) * 290 * r * 1.2, y = 600 + Math.abs(Math.sin(a)) * 40 - K.hash(i + 7) * 130; if (y > 540) { X.beginPath(); X.arc(x, y, 2, 0, K.TAU); X.fill(); } }
  X.strokeStyle = '#6b3a22'; X.lineWidth = 5; X.lineCap = 'round'; for (let i = 0; i < 7; i++) { X.beginPath(); X.moveTo(400 + (i - 3) * 26, 232); X.quadraticCurveTo(400 + (i - 3) * 30 + 14, 190 - (i % 2) * 14, 400 + (i - 3) * 36 + 30, 214); X.stroke(); }
  const NOSE = K.elP(400, 395, 92, 92); K.cel(NOSE, '#f5b18a', '#d98c66', 8, 7, 5); K.glint(NOSE, 365, 350, 28, 12, .4, -.5);
}
function swPick(sp) {
  const rs = Math.sqrt(sp), ph = Math.random() * 6, o0 = Math.random() < .5 ? 0 : 1, NX = [355, 445], NY = 426;
  let c = 0, fx = 400, fy = 110, drop = false, landed = false, sq = 0, lock = -1, hit = false;
  const O = SWK.outro();
  const open = () => lock >= 0 ? lock : (o0 + Math.floor(c * rs / 1.6)) % 2;
  // the outcome is decided on the tap (hole frozen), so a last-second tap still counts; the fall is just the show
  const go = () => { if (drop || g.result || c < .3) return; drop = true; lock = open(); hit = Math.abs(fx - NX[lock]) < 42; g.result = hit ? 'win' : 'lose'; sfx.whoosh(false); };
  const g = {
    wide: true, cmd: 'PICK!', hint: 'CLICK / SPACE: DROP IN THE OPEN HOLE', thint: 'TAP TO DROP INTO THE OPEN HOLE', dur: 5,
    key(e) { if (e.code === 'Space' || e.code === 'ArrowDown') go(); }, down() { go(); },
    update(dt) {
      O.mark(g);
      c += dt; sq = Math.max(0, sq - dt);
      if (!drop) fx = 400 + Math.sin(c * 1.1 * rs + ph) * 190;
      else if (!landed) {
        fy += 1500 * dt;
        if (fy >= 412) {
          fy = 412; landed = true; sq = .5;
          if (hit) { sfx.splat(); sfx.coin(); confetti(fx, 400, 20); burst(fx, 420, '#5CFF7A', 12); ring(fx, 420, '#fff', 80); floatText('+1', fx, 380, '#5CFF7A', 40); shake(6, .2); }
          else { swLose(); burst(fx, 420, '#ff4d4d', 10); ring(fx, 420, '#ff4d4d', 70); }
        }
      }
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), win = g.result === 'win', lose = g.result === 'lose', L = -OX, R = W + OX;
      X.drawImage(K.baked('pk', pkBake), -OX, 0);
      // the barber pole (turning stripes)
      const PO = K.rrP(-OX + 18, 120, 36, 330, 16); K.cel(PO, '#fff', '#d5dae6', 4, 0, 4);
      X.save(); X.clip(PO); X.fillStyle = '#e8434f'; for (let i = -2; i < 14; i++) { const y = 120 + i * 50 + (now * 30) % 50; X.beginPath(); X.moveTo(-OX + 10, y); X.lineTo(-OX + 60, y + 40); X.lineTo(-OX + 60, y + 62); X.lineTo(-OX + 10, y + 22); X.fill(); } X.restore();
      K.rr(-OX + 14, 104, 44, 22, 8); K.ink('#cfd8e6', 3); K.rr(-OX + 14, 444, 44, 22, 8); K.ink('#cfd8e6', 3);
      // the uncle (he shakes when the finger lands)
      const wob = sq > 0 ? Math.sin(now * 70) * 5 : 0;
      X.save(); X.translate(wob, 0);
      K.shade(400, 598, 290, 14, .2); X.drawImage(K.baked('pkface', pkFace), -OX, 0);
      const tx = drop ? fx : fx, look = [(tx - 400) / 200, .8];
      const worried = drop && !landed;
      for (const [ex, sx] of [[290, -1], [510, 1]]) {
        if (win) { X.strokeStyle = INK; X.lineWidth = 8; X.lineCap = 'round'; X.beginPath(); X.arc(ex, 312, 30, Math.PI * 1.12, Math.PI * 1.88); X.stroke(); }
        else {
          K.el(ex, 300, 42, 44); K.ink('#fff', 5);
          if (lose) { X.fillStyle = INK; K.el(ex + (fx - ex) * .02, 308, 8, 9); X.fill(); X.fillStyle = '#fff'; K.el(ex - 3, 304, 3, 3); X.fill(); }
          else { const pr = worried ? 12 : 17; X.fillStyle = INK; K.el(ex + K.clamp(fx - ex, -60, 60) * .12, 306 + (fy > 200 ? 6 : 0), pr, pr * 1.1); X.fill(); X.fillStyle = '#fff'; K.el(ex + K.clamp(fx - ex, -60, 60) * .12 - 5, 301 + (fy > 200 ? 6 : 0), 5, 4); X.fill(); }
          if (Math.sin(now * 1.7 + ex) > .985 && !drop) { X.fillStyle = '#f0a37e'; K.el(ex, 300, 44, 46); X.fill(); X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(ex - 36, 300); X.lineTo(ex + 36, 300); X.stroke(); }
        }
        // bushy brows
        X.strokeStyle = '#6b3a22'; X.lineWidth = 15; X.lineCap = 'round'; X.beginPath();
        const by = (lose ? 238 : worried ? 232 : 244) - (win ? 0 : 0); X.moveTo(ex - 40, by + (lose || worried ? sx * -2 : 0) + (lose ? 8 * sx : 0)); X.lineTo(ex + 40, by + (lose || worried ? sx * 6 : 0) - (lose ? 8 * sx : 0)); X.stroke();
        if (!win) { X.strokeStyle = 'rgba(180,85,58,.45)'; X.lineWidth = 5; X.beginPath(); X.arc(ex, 336, 40, .25, Math.PI - .25); X.stroke(); }
      }
      if (win || (lose && ot > .1)) { X.fillStyle = win ? 'rgba(255,110,165,.7)' : 'rgba(255,110,165,.5)'; K.el(215, 400, 36, 18); X.fill(); K.el(585, 400, 36, 18); X.fill(); }
      // the nostrils: one plugged by a booger, one open with a hair
      const o = open();
      NX.forEach((x, i) => {
        const bre = i === o ? 1 + Math.sin(now * 4) * .04 : 1;
        K.el(x, NY, 28 * bre, 22 * bre); K.ink(i === o ? INK : '#c9703f', 4);
        if (i !== o) { K.el(x, NY + 2, 24, 17); X.fillStyle = '#7fd34a'; X.fill(); X.save(); K.el(x, NY, 28, 22); X.clip(); X.fillStyle = '#b8f070'; K.el(x - 8, NY - 6, 8, 5); X.fill(); X.restore(); K.el(x, NY, 24, 17); X.lineWidth = 2.5; X.strokeStyle = '#3f8f35'; X.stroke(); }
        else { X.strokeStyle = '#6b3a22'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, NY + 6); X.quadraticCurveTo(x - 4 + Math.sin(now * 5) * 3, NY - 4, x - 8 + Math.sin(now * 5) * 4, NY - 14); X.moveTo(x + 6, NY + 8); X.quadraticCurveTo(x + 8, NY, x + 12 + Math.sin(now * 4) * 3, NY - 10); X.stroke(); }
      });
      if (lose && sq > 0 || lose) { X.fillStyle = 'rgba(255,60,70,.38)'; K.el(fx, 395, 54, 50); X.fill(); }
      // the mouth
      X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath();
      if (win) { X.arc(400, 502, 64, Math.PI * .12, Math.PI * .88); X.stroke(); X.beginPath(); X.arc(400, 502, 64, Math.PI * .12, Math.PI * .88); X.closePath(); X.fillStyle = '#7a1f2e'; X.fill(); X.stroke(); X.fillStyle = '#ff7aa8'; K.el(400, 556, 26, 11); X.fill(); }
      else if (lose) { X.arc(400, 568 + Math.sin(now * 40) * 2, 54, Math.PI * 1.12, Math.PI * 1.88); X.stroke(); }
      else if (worried) { K.el(400, 534, 22, 26); X.fillStyle = '#7a1f2e'; X.fill(); X.stroke(); }
      else { X.arc(400, 505, 60, Math.PI * .15, Math.PI * .85); X.stroke(); }
      if (lose) for (const sx of [-1, 1]) { X.save(); X.translate(290 + (sx > 0 ? 220 : 0) + sx * 20, 350 + (ot * 90) % 120); K.el(0, 0, 6, 10); K.ink('#9fe3ff', 2); X.restore(); }
      X.restore();
      // the hand from the ceiling (a cuff, a sausage finger)
      X.lineCap = 'round';
      const ARM = SWK.mkRR(fx - 22, -40, 44, fy + 40, 22); K.cel(ARM, '#ffcba4', '#e8946f', 7, 0, 5);
      X.save(); X.clip(ARM); X.strokeStyle = 'rgba(180,85,58,.35)'; X.lineWidth = 3; for (const yy of [fy - 46, fy - 62]) { X.beginPath(); X.moveTo(fx - 22, yy); X.quadraticCurveTo(fx, yy + 4, fx + 22, yy); X.stroke(); } X.restore();
      const CUFF = K.rrP(0, 0, 1, 1, 0); X.save(); X.translate(fx, 6); K.rr(-34, -30, 68, 54, 10); K.ink('#e8434f', 4); X.fillStyle = '#fff'; K.rr(-34, -10, 68, 12, 3); X.fill(); X.restore();
      K.rr(fx - 11, fy - 20, 22, 24, 9); K.ink('#ffe3d6', 2.5);
      if (!landed && !drop === false) K.shade(fx, 438, 22, 7, .3);
      if (!drop && c > .3) { K.el(fx + 30, fy + 50 + (now * 80 % 30), 5, 8); K.ink('#9fe3ff', 2); }
      if (!landed && !drop) K.shade(fx, 438, 20, 6, .3);
      // Caos helps from the corner
      const cm = win ? 'happy' : lose ? 'sad' : null;
      X.save(); X.translate(-OX + 58, 536); K.arms(3.4, win ? -2.6 : -.3, win ? 2.6 : .3, 1); X.restore(); caos(-OX + 58, 536, 3.4, { mood: cm });
      if (win) { for (let i = 0; i < 3; i++) K.heart(260 + i * 140 + Math.sin(ot * 4 + i) * 12, 190 - ot * 50 - (i % 2) * 24, 1.1, Math.max(0, 1 - ot * .9)); }
      if (lose && ot > .1) for (let i = 0; i < 3; i++) K.star(400 + Math.cos(now * 6 + i * 2.1) * 70, 440 + Math.sin(now * 6 + i * 2.1) * 20, 9, 4, 5, now * 4, '#FFE14D', 2.5);
      vignette(.18);
    }
  };
  return g;
}

/* ── 3 RUN: mash to outrun the monster (a candy-land path, a purple chomper, gummy-bear fans) ── */
function rnBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 520, [[0, '#ff8fc6'], [.6, '#ffc2e0'], [1, '#fff0e0']]); X.fillRect(L, 0, VW, 520);
  K.hills(L, R, 470, 90, .005, 2, '#f7b4e8', '#c97bb8', 3, 530);
  K.hills(L, R, 500, 40, .009, 5, '#d9a2f5', '#9b6bd1', 3, 530);
  X.fillStyle = K.vg(516, 600, [[0, '#a574de'], [1, '#7d4fb8']]); X.fillRect(L, 516, VW, 90);
  K.horizon(518, L, R, 5);
}
function swRun(sp) {
  let gap = 310, v = 0, c = 0, off = 0, taps = 0;
  const O = SWK.outro();
  const mash = () => { if (g.result) return; v += 58; taps++; sfx.blip((taps % 2) * 4 - 6); burst(520 + Math.random() * 30, 520, '#e8dcff', 3, 120); };
  const g = {
    wide: true, cmd: 'RUN!', hint: 'MASH SPACE / ARROWS / CLICK', thint: 'TAP AS FAST AS YOU CAN', dur: 5, timeWin: true,
    key(e) { if (!e.repeat && (e.code === 'Space' || /^(Arrow|Key)/.test(e.code))) mash(); }, down() { mash(); },
    update(dt) {
      O.mark(g);
      if (g.result) return;
      c += dt; v *= Math.pow(.35, dt);
      const ms = (150 + c * 16) * (.8 + .2 * sp);
      gap += (v - ms) * dt; off += v * dt; gap = Math.min(gap, 420);
      if (gap <= 40) { g.result = 'lose'; swLose(); sfx.splat(); burst(570, 440, '#8a4dff', 16); floatText('CAUGHT!', 400, 250, '#ff4d4d', 48); }
      else if (gap < 120 && Math.random() < dt * 3) sfx.thud();
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', L = -OX, R = W + OX;
      X.drawImage(K.baked('rn', rnBake), -OX, 0);
      // the donut sun + clouds
      K.sun(120 - OX * .3, 150, now); X.save(); K.el(120 - OX * .3, 150, 12, 12); X.fillStyle = '#ff8fc6'; X.fill(); X.restore();
      for (let i = 0; i < 3; i++) K.cloud(((now * (6 + i * 3) + i * 340) % (VW + 220)) - 160 - OX, 90 + i * 46, 1 + (i % 2) * .3, '#fff0f8');
      const sh = gap < 140 && !g.result ? Math.sin(now * 60) * (140 - gap) * .06 : 0;
      X.save(); X.translate(sh, -sh * .5);
      // candy trees + gummy-bear fans scroll by
      const pt = Math.ceil((VW + 200) / 300) * 300;
      for (let i = 0; i < pt / 300; i++) {
        const x = ((i * 300 - off * .5) % pt + pt) % pt - OX - 100;
        K.rr(x, 390, 24, 130, 8); K.ink('#fff', 4); X.save(); K.rr(x, 390, 24, 130, 8); X.clip(); X.fillStyle = '#ff5c8a'; for (let j = 0; j < 8; j++) { X.beginPath(); X.moveTo(x - 4, 396 + j * 22); X.lineTo(x + 30, 380 + j * 22); X.lineTo(x + 30, 392 + j * 22); X.lineTo(x - 4, 408 + j * 22); X.fill(); } X.restore();
        X.beginPath(); X.arc(x + 12, 370, 50, 0, K.TAU); K.ink(['#ffd23f', '#5CFF7A', '#4DB8FF'][i % 3], 5);
        X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 6; X.beginPath(); for (let a = 0; a < 18; a++) { const r = a * 2.3; X.lineTo(x + 12 + Math.cos(a * .9) * r, 370 + Math.sin(a * .9) * r); } X.stroke();
        const gx = x + 150, gy = 520, wv = Math.sin(now * 7 + i) * .2;
        X.save(); X.translate(gx, gy); const BEAR = K.rrP(-14, -36, 28, 32, 12); K.cel(BEAR, ['#ff4d5e', '#ffd23f', '#5CFF7A'][i % 3], ['#b8283a', '#c99512', '#23a046'][i % 3], 3, 3, 3);
        K.el(-12, -38, 6, 6); K.ink('#ff4d5e', 2); K.el(12, -38, 6, 6); K.ink('#ff4d5e', 2); X.fillStyle = INK; X.fillRect(-7, -28, 3, 4); X.fillRect(4, -28, 3, 4);
        X.save(); X.rotate(wv); K.rr(-30, -62, 4, 30, 2); K.ink('#fff', 2); X.restore(); X.restore();
      }
      // planks
      const pd = Math.ceil((VW + 160) / 120) * 120; X.fillStyle = '#c59af0'; for (let i = 0; i < pd / 120; i++) { K.rr(((i * 120 - off) % pd + pd) % pd - OX - 80, 556, 64, 10, 4); X.fill(); }
      // the monster
      const hx = 570, mx = hx - gap - 100, near = 1 - Math.max(0, Math.min(1, (gap - 40) / 260));
      let mrot = 0, mdy = 0, mouth = .35 + near * .65; if (won) { mrot = -K.ease(ot / .35) * .35; mdy = K.ease(ot / .35) * 30; mouth = .2; } if (lost) mouth = Math.abs(Math.sin(ot * 12)) * .18 + .08;
      const run = g.result ? ot : now, bob = Math.abs(Math.sin(run * 14)) * 8;
      K.shade(mx, 522, 120, 16, .3); K.shade(hx, 520, 58, 10, .3);
      X.save(); X.translate(mx, 516 + mdy); X.rotate(mrot); X.translate(0, -bob * (g.result ? 0 : 1));
      for (const sx of [-1, 1]) { const lw = Math.sin(run * 16 + sx) * 12; K.rr(sx * 52 - 18 + lw, -26, 36, 28, 12); K.ink('#5b2fb5', 4); }
      for (let i = 0; i < 4; i++) { K.poly([[-70 + i * 40, -176 - (i % 2) * 12], [-50 + i * 40, -214 + (i % 2) * 10], [-30 + i * 40, -176 - (i % 2) * 12]], '#ffd23f', 3.5); }
      const MB = K.elP(0, -116, 122, 116); K.cel(MB, '#8a4dff', '#5b2fb5', 12, 10, 6); K.glint(MB, -52, -190, 36, 14, .35, -.4);
      X.fillStyle = 'rgba(255,255,255,.25)'; for (const [a, b, r] of [[-66, -110, 8], [-80, -70, 6], [-40, -50, 9]]) { X.beginPath(); X.arc(a, b, r, 0, K.TAU); X.fill(); }
      // eye
      K.el(52, -186, 28, 30); K.ink('#fff', 5); X.fillStyle = INK; K.el(62 + near * 3, -180, 11, 13); X.fill(); X.fillStyle = '#fff'; K.el(58, -185, 4, 4); X.fill();
      X.strokeStyle = INK; X.lineWidth = 8; X.lineCap = 'round'; X.beginPath(); X.moveTo(24, -224); X.lineTo(80, -210 + near * 8); X.stroke();
      if (lost) { X.fillStyle = '#9fd6ff'; K.el(52, -186, 29, 31); X.fill(); X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.arc(52, -184, 20, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); }
      if (won) { X.fillStyle = '#fff'; K.el(52, -186, 29, 31); X.fill(); X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); for (let i = 0; i < 20; i++) { const a = i * .6 + now * 8, r = i / 20 * 22; X.lineTo(52 + Math.cos(a) * r, -186 + Math.sin(a) * r); } X.stroke(); }
      // the mouth
      const mh = 26 + 52 * mouth; K.el(80, -108, 54, mh); K.ink(INK, 4); X.fillStyle = '#e8434f'; K.el(80, -108 + mh * .45, 38, mh * .4); X.fill();
      X.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const a = -1.9 + i * .72; X.beginPath(); X.moveTo(80 + Math.cos(a) * 52, -108 + Math.sin(a) * (mh - 3)); X.lineTo(80 + Math.cos(a + .26) * 52, -108 + Math.sin(a + .26) * (mh - 3)); X.lineTo(80 + Math.cos(a + .13) * 28, -108 + Math.sin(a + .13) * mh * .55); X.closePath(); X.fill(); }
      if (lost) { for (const sx of [-1, 1]) { X.save(); X.translate(74 + sx * 9, -108 + mh * .5); X.rotate(Math.sin(ot * 22 + sx) * .35); K.rr(-5, -2, 10, 30, 4); K.ink(OR, 3); X.restore(); } for (let i = 0; i < 3; i++) K.star(10 + i * 34, -240 - Math.sin(now * 8 + i) * 6, 8, 3.5, 5, now * 4 + i, '#FFE14D', 2.5); K.puff(120 + ot * 30, -170 - ot * 30, 14, Math.max(0, 1 - ot), '#e8dcff'); }
      if (won) { K.el(86, -86, 18, 34); K.ink('#ff7aa8', 3); }
      else if (!lost) for (let i = 0; i < 2; i++) { const dk = (now * 1.5 + i * .5) % 1; X.save(); X.translate(66 + i * 30, -80 + dk * 30); K.el(0, 0, 4, 7); K.ink('#9fe3ff', 1.5); X.restore(); }
      X.restore();
      // Caos
      const fx = hx;
      if (!lost) {
        X.save(); X.translate(fx, 520 - (won ? Math.abs(Math.sin(ot * 9)) * 18 : 0)); K.arms(8, won ? -2.8 : -.9 + Math.sin(run * 16) * .5, won ? 2.8 : .9 - Math.sin(run * 16) * .5, 1); X.restore();
        caos(fx, 520 - (won ? Math.abs(Math.sin(ot * 9)) * 18 : 0), 8, { mood: swSad(g), run: g.result ? null : now });
        if (!g.result && near > .3) K.sweat(fx + 46, 440, 1.3, now);
        if (!g.result && gap > 300) K.heart(fx + 60 - OX * 0, 430, .8, .7);
      }
      X.restore();
      // the chase strip: the monster closes on the little Caos
      const kk = Math.max(0, Math.min(1, (gap - 40) / 380)), bx = 240, bw = 320, byb = 64;
      K.rr(bx - 14, byb - 6, bw + 28, 40, 20); K.ink('#fff', 4); X.fillStyle = 'rgba(155,107,209,.4)'; K.rr(bx + 2, byb + 8, bw - 4, 12, 6); X.fill();
      for (let i = 0; i <= 6; i++) { X.fillStyle = INK; X.fillRect(bx + 20 + i * (bw - 40) / 6 - 1, byb + 22, 2, 5); }
      const mp = bx + 24 + (1 - kk) * (bw - 120);
      X.beginPath(); X.arc(mp, byb + 14, 12, 0, K.TAU); K.ink('#8a4dff', 3); K.el(mp + 3, byb + 11, 4, 4); X.fillStyle = '#fff'; X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(mp + 4, byb + 11, 2, 0, K.TAU); X.fill();
      caos(bx + bw - 28, byb + 24, 1.5, { mood: swSad(g) });
      vignette(.16);
    }
  };
  return g;
}

/* ── 4 ARREST: pick the suspect that matches the poster (a police line-up, a security camera, a cop Caos) ── */
function swFaceDraw(x, y, s, tr, o) {
  o = o || {}; const K = SWK, X = ctx, HC = [null, '#E8433A', '#4DB8FF', '#5CFF7A'], HS = [null, '#b8283a', '#2a8fcb', '#23a046'], mood = o.mood || 'calm', T = o.T || 0;
  X.save(); X.translate(x, y); X.scale(s, s);
  // ears
  for (const sx of [-1, 1]) { K.el(sx * 40, 4, 8, 11); K.ink('#f0a37e', 3); }
  const HD = K.elP(0, 0, 40, 43); K.cel(HD, '#ffcba4', '#f0a37e', 5, 4, 3.5); K.glint(HD, -14, -22, 11, 5, .4, -.4);
  if (tr.mu) { X.beginPath(); X.moveTo(-26, 12); X.quadraticCurveTo(-14, 6, 0, 13); X.quadraticCurveTo(14, 6, 26, 12); X.quadraticCurveTo(14, 24, 0, 17); X.quadraticCurveTo(-14, 24, -26, 12); K.ink('#4a3426', 3); }
  // eyes
  const em = mood === 'panic' ? 'panic' : mood === 'smug' ? 'idle' : 'idle'; const lk = o.look || [0, 0];
  K.eye(-15, -7, 8.5, em, lk, T, 0); K.eye(15, -7, 8.5, em, lk, T, 1);
  if (tr.gl) { X.strokeStyle = INK; X.lineWidth = 3.4; for (const d of [-15, 15]) { X.beginPath(); X.arc(d, -7, 12.5, 0, 7); X.stroke(); } X.beginPath(); X.moveTo(-3, -7); X.lineTo(3, -7); X.stroke(); X.fillStyle = 'rgba(255,255,255,.35)'; X.beginPath(); X.arc(-15, -7, 12, 0, 7); X.arc(15, -7, 12, 0, 7); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 3.4; X.lineCap = 'round'; X.beginPath(); const br = mood === 'angry' ? 4 : mood === 'panic' ? -6 : 0;
  X.moveTo(-24, -22 - br * .4); X.lineTo(-8, -22 + br * .6); X.moveTo(24, -22 - br * .4); X.lineTo(8, -22 + br * .6); X.stroke();
  X.fillStyle = '#e8946f'; K.el(0, 6, 5, 6); X.fill();
  if (!tr.mu) { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); if (mood === 'panic') { X.arc(0, 26, 6, 0, 7); } else if (mood === 'smug') { X.arc(0, 18, 11, .2, 2.9); } else { X.moveTo(-9, 22); X.lineTo(9, 22); } X.stroke(); }
  if (mood === 'smug' || mood === 'panic') { X.fillStyle = 'rgba(255,110,140,.45)'; K.el(-27, 8, 6, 3.5); X.fill(); K.el(27, 8, 6, 3.5); X.fill(); }
  if (tr.scar) { X.strokeStyle = '#c0392b'; X.lineWidth = 3.5; X.beginPath(); X.moveTo(22, -16); X.lineTo(31, 14); X.stroke(); X.lineWidth = 2; X.beginPath(); X.moveTo(24, -3); X.lineTo(33, -1); X.moveTo(23, 5); X.lineTo(32, 7); X.stroke(); }
  if (tr.hat === 1) { // baseball cap
    const CAP = K.P('M-40,-18 C-42,-58 42,-58 40,-18 Z'); K.cel(CAP, HC[1], HS[1], 4, 4, 3.5); K.rr(-12, -26, 62, 10, 5); K.ink(HC[1], 3); K.el(0, -42, 8, 4); X.fillStyle = HS[1]; X.fill();
  } else if (tr.hat === 2) { // top hat
    K.rr(-52, -30, 104, 12, 6); K.ink(HS[2], 3.5); const TH = K.rrP(-30, -80, 60, 54, 6); K.cel(TH, HC[2], HS[2], 4, 3, 3.5); X.fillStyle = INK; X.fillRect(-30, -42, 60, 8); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(-24, -76, 7, 40);
  } else if (tr.hat === 3) { // bowler
    K.rr(-52, -32, 104, 11, 6); K.ink(HS[3], 3.5); const BW = K.P('M-36,-30 C-40,-72 40,-72 36,-30 Z'); K.cel(BW, HC[3], HS[3], 4, 4, 3.5); X.fillStyle = INK; X.fillRect(-36, -40, 72, 6);
  }
  X.restore();
}
function wnBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 520, [[0, '#9aa5f5'], [1, '#c3caff']]); X.fillRect(L, 0, VW, 520);
  X.strokeStyle = 'rgba(80,90,190,.2)'; X.lineWidth = 3; for (let x = L - (L % 100); x < R; x += 100) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, 520); X.stroke(); }
  // wainscot + floor
  X.fillStyle = '#6f7bd6'; X.fillRect(L, 470, VW, 50); K.horizon(470, L, R, 4);
  X.fillStyle = '#e8ecff'; X.fillRect(L, 520, VW, 90); for (let i = -2; i < 20; i++) for (let j = 0; j < 3; j++) { if ((i + j) % 2) { X.fillStyle = '#a8b1f5'; X.fillRect(L + i * 60, 520 + j * 30, 60, 30); } } K.horizon(520, L, R, 5);
  // cork board for the poster
  const CB = K.rrP(6, 112, 306, 380, 14); K.cel(CB, '#d9a066', '#b07a3e', 5, 5, 5); X.fillStyle = 'rgba(122,70,32,.35)'; for (let i = 0; i < 40; i++) { X.beginPath(); X.arc(20 + K.hash(i) * 280, 124 + K.hash(i + 50) * 356, 2.5, 0, 7); X.fill(); }
}
function swWanted(sp) {
  const all = []; for (let h = 0; h < 4; h++) for (let gl = 0; gl < 2; gl++) for (let mu = 0; mu < 2; mu++) for (let sc = 0; sc < 2; sc++) all.push({ hat: h, gl, mu, scar: sc });
  shuffle(all); const target = all.pop(), same = (a, b) => a.hat === b.hat && a.gl === b.gl && a.mu === b.mu && a.scar === b.scar;
  const people = shuffle([target, ...all.slice(0, 5)]);
  const cells = people.map((tr, i) => ({ tr, x: 380 + (i % 3) * 150, y: 230 + Math.floor(i / 3) * 190, ph: Math.random() * 6 }));
  let flash = 0, pick = -1;
  const O = SWK.outro();
  const g = {
    wide: true, cmd: 'ARREST!', hint: 'CLICK THE SUSPECT FROM THE POSTER', thint: 'TAP THE SUSPECT FROM THE POSTER', dur: 5,
    down(p) {
      if (g.result) return;
      const i = cells.findIndex(c => Math.abs(p.x - c.x) < 70 && Math.abs(p.y - c.y) < 85); if (i < 0) return;
      pick = i; flash = .3; sfx.stamp(); shake(5, .15); const c = cells[i];
      if (same(c.tr, target)) { g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(c.x, c.y, '#5CFF7A', 14); ring(c.x, c.y, '#fff', 90); floatText('BUSTED!', c.x, c.y - 70, '#5CFF7A', 38); confetti(c.x, c.y, 20); } else { g.result = 'lose'; swLose(); burst(c.x, c.y, '#ff4d4d', 10); }
    },
    update(dt) { O.mark(g); flash = Math.max(0, flash - dt); },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose';
      X.drawImage(K.baked('wn', wnBake), -OX, 0);
      // the security camera follows the cursor
      const cax = 560, cay = 112, ca = Math.atan2(mouse.y - cay, mouse.x - cax) * .4;
      K.line([[cax, 70], [cax, cay - 8]], 6, '#8f9cb3'); X.save(); X.translate(cax, cay); X.rotate(ca + .3);
      K.rr(-30, -14, 60, 28, 8); K.ink('#cfd8e6', 4); K.el(30, 0, 8, 12); K.ink('#2b2640', 3); X.fillStyle = Math.sin(now * 4) > 0 ? '#ff4d5e' : '#7a1f2e'; X.beginPath(); X.arc(-16, -4, 3.5, 0, 7); X.fill(); X.restore();
      // the poster: a wanted face on a pinned sheet
      X.save(); X.translate(30, 0); X.rotate(-.04);
      X.fillStyle = 'rgba(20,16,28,.28)'; K.rr(14, 138, 260, 360, 6); X.fill();
      const PS = K.rrP(8, 130, 260, 360, 6); K.cel(PS, '#f3dfa2', '#d9bf7a', 5, 5, 5);
      X.strokeStyle = '#a5622c'; X.lineWidth = 4; K.rr(22, 144, 232, 332, 4); X.stroke();
      txt('WANTED', 140, 166, 38, '#e8434f', 'center', 210);
      swFaceDraw(140, 338, 1.72, target, { mood: 'angry', T: now, look: [Math.sin(now) * .5, 0] });
      X.fillStyle = INK; X.font = '900 18px Arial Black'; txt('REWARD $$$', 140, 450, 24, INK, 'center', 220);
      for (const tx of [20, 256]) { X.beginPath(); X.arc(tx, 140, 7, 0, 7); K.ink('#e8434f', 2.5); }
      X.restore();
      // the line-up
      cells.forEach((c, i) => {
        const w = Math.sin(now * 3 + c.ph) * .035, mine = pick === i, fl = mine && flash > 0;
        const hover = !g.result && Math.abs(mouse.x - c.x) < 70 && Math.abs(mouse.y - c.y) < 85;
        X.save(); X.translate(c.x, c.y + (hover ? -4 : 0)); X.rotate(w);
        K.shade(0, 92, 62, 9, .25);
        const CARD = K.rrP(-65, -80, 130, 160, 12), face = mine ? (won ? '#5CFF7A' : '#ff4d4d') : '#fff';
        K.cel(CARD, face, mine ? (won ? '#23a046' : '#b8283a') : '#d8dcf0', 6, 6, 5);
        X.save(); K.rr(-55, -70, 110, 106, 6); X.fillStyle = mine ? 'rgba(255,255,255,.35)' : '#cfd8ff'; X.fill(); X.clip();
        X.strokeStyle = 'rgba(60,70,160,.45)'; X.lineWidth = 2; for (let k = 0; k < 6; k++) { X.beginPath(); X.moveTo(-55, -64 + k * 18); X.lineTo(-44 + (k % 2) * 6, -64 + k * 18); X.stroke(); }
        const look = lost || won ? [(cells[pick].x - c.x) / 150, (cells[pick].y - c.y) / 190] : [(mouse.x - c.x) / 200, (mouse.y - c.y) / 200];
        const mood = mine ? (won ? 'panic' : 'angry') : (hover ? 'panic' : (g.result && !mine && won ? 'smug' : 'calm'));
        // the mugshot sits in the frame (clipped to the photo window)
        X.restore();
        X.save(); K.rr(-55, -70, 110, 106, 6); X.clip(); swFaceDraw(0, -6, 1.1, c.tr, { mood, look, T: now + c.ph }); X.restore();
        K.rr(-55, 42, 110, 28, 6); K.ink('#2b2640', 3); X.fillStyle = '#fff'; for (let k = 0; k < 4; k++) X.fillRect(-42 + k * 12, 52, 8, 8); X.fillStyle = '#ffd23f'; X.fillRect(10 + 0, 52, 32, 8);
        if (mine && won) { // handcuffs
          K.el(-22, 30, 14, 14); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#cfd8e6'; X.stroke(); K.el(22, 30, 14, 14); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#cfd8e6'; X.stroke(); X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(-10, 30); X.lineTo(10, 30); X.stroke();
          if (ot < .9) for (let k = 0; k < 4; k++) K.star(Math.cos(now * 5 + k * 1.57) * 80, -10 + Math.sin(now * 5 + k * 1.57) * 30, 7, 3, 4, now * 3, '#FFE14D', 2);
        }
        if (mine && lost) { K.sweat(40, -30, 1.4, now); X.strokeStyle = '#ff4d5e'; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath(); X.moveTo(34, -64); X.lineTo(54, -44); X.moveTo(54, -64); X.lineTo(34, -44); X.stroke(); }
        if (fl) { X.fillStyle = 'rgba(255,255,255,' + Math.min(.9, flash * 3) + ')'; K.rr(-65, -80, 130, 160, 12); X.fill(); }
        X.restore();
      });
      // Caos the detective, magnifier in hand
      const cm = won ? 'happy' : lost ? 'sad' : null, hop = won ? Math.abs(Math.sin(ot * 9)) * 14 : 0;
      K.shade(98, 541, 38, 7, .3);
      X.save(); X.translate(98, 538 - hop); K.arms(5, won ? -2.7 : -.3, won ? 2.7 : .8, 1); X.restore();
      caos(98, 538 - hop, 5, { mood: cm });
      X.save(); X.translate(98, 538 - hop - 9); K.rr(-17, -48, 34, 9, 3); K.ink('#2b2640', 2.5); K.rr(-12, -62, 24, 16, 5); K.ink('#2b2640', 2.5); X.beginPath(); X.arc(0, -53, 3, 0, 7); X.fillStyle = '#ffd23f'; X.fill(); X.restore();
      K.curve(130, 502, 148, 486, 162, 480, 4, '#a5622c'); X.beginPath(); X.arc(170, 474, 12, 0, 7); K.ink('rgba(191,239,255,.7)', 3);
      if (lost) K.badge('WRONG!', 400, 100, 36, '#ff4d5e', '#fff', K.outBack(ot / .25), -.04);
      vignette(.16);
    }
  };
  return g;
}

/* ── 5 FRY: hold to cook, release when golden (a night-market stall, a nugget with a face, a hungry cat) ── */
function fyBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 520, [[0, '#1d1840'], [.6, '#3d3480'], [1, '#6a4aa8']]); X.fillRect(L, 0, VW, 560);
  for (let i = 0; i < 30; i++) { X.fillStyle = 'rgba(255,255,255,' + (.25 + K.hash(i) * .4) + ')'; X.fillRect(L + K.hash(i + 3) * VW, 150 * K.hash(i + 9) + 40, 3, 3); }
  // back stalls with lit windows + striped awnings
  for (let i = 0; i < 8; i++) {
    const sx = L - 20 + i * (VW / 7), h = 150 + (i % 3) * 30, y = 400 - h; const ST = K.rrP(sx, y, 120, h + 40, 8); K.cel(ST, '#5b4a9a', '#43357a', 5, 4, 3.5);
    X.fillStyle = '#ffd77a'; K.rr(sx + 20, y + 40, 80, 50, 8); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
    X.save(); K.rr(sx - 6, y + 4, 132, 30, 6); X.clip(); X.fillStyle = '#ff5c8a'; X.fillRect(sx - 6, y + 4, 132, 30); X.fillStyle = '#fff'; for (let j = 0; j < 8; j++) X.fillRect(sx - 6 + j * 22, y + 4, 11, 30); X.restore(); K.rr(sx - 6, y + 4, 132, 30, 6); K.ink(null, 3);
  }
  K.horizon(400, L, R, 4); X.fillStyle = K.vg(400, 600, [[0, '#8a5530'], [1, '#5a3a22']]); X.fillRect(L, 402, VW, 200);
  X.strokeStyle = 'rgba(0,0,0,.2)'; X.lineWidth = 3; for (let x = L; x < R; x += 70) { X.beginPath(); X.moveTo(x, 402); X.lineTo(x - 30, 600); X.stroke(); }
  // string lights
  X.beginPath(); X.moveTo(L, 150); X.quadraticCurveTo(200, 210, 330, 168); X.moveTo(470, 168); X.quadraticCurveTo(600, 210, R, 150); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
}
function swFry(sp) {
  let p = 0, hold = false, done = false, by = 130, c = 0, inZ = false; const Z0 = .5, Z1 = .7, rate = .3 * sp;
  const O = SWK.outro();
  const start = () => { if (!done && !g.result && !hold) { hold = true; sfx.whoosh(false); } };
  const end = () => {
    if (!hold || g.result) return; hold = false; done = true; sfx.whoosh();
    if (p >= Z0 && p <= Z1) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(400, 300, 25); ring(400, 340, '#FFE14D', 120); burst(400, 340, '#FFE14D', 14); floatText('+1', 400, 250, '#FFE14D', 44); }
    else { g.result = 'lose'; swLose(); }
  };
  const col = k => k < .6 ? swMix('#F4E3B1', '#E3A02B', k / .6) : swMix('#E3A02B', '#3b2412', (k - .6) / .3);
  const g = {
    wide: true, cmd: 'FRY!', hint: 'HOLD SPACE / MOUSE, RELEASE ON GOLD', thint: 'HOLD, RELEASE ON GOLD', dur: 5,
    key(e) { if (e.code === 'Space') start(); }, keyup(e) { if (e.code === 'Space') end(); }, down() { start(); }, up() { end(); },
    update(dt) {
      O.mark(g);
      c += dt; by += ((hold ? 340 : 130) - by) * Math.min(1, 9 * dt);
      if (hold && !g.result) {
        p += rate * dt; if (Math.random() < .35) noise(.03, .025, 4000 + Math.random() * 3000, 7000, 'highpass');
        if (!inZ && p >= Z0) { inZ = true; sfx.blip(7); ring(400, 340, '#FFE14D', 70, .3); }
        if (p > Z1 + .03) { g.result = 'lose'; hold = false; swLose(); sfx.zap(); burst(400, 340, '#555', 12); }
      }
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', burnt = p > Z1, raw = p < Z0, L = -OX, R = W + OX;
      X.drawImage(K.baked('fy', fyBake), -OX, 0);
      // blinking bulbs + swaying lanterns
      for (const [bx0, bx1, side] of [[L, 330, 0], [470, R, 1]]) for (let i = 1; i < 8; i++) { const k = i / 8, x = K.lerp(bx0, bx1, k), y = (side ? K.lerp(150, 168, 1 - k) : K.lerp(150, 168, k)) + Math.sin(k * Math.PI) * 38 * (side ? 1 : 1); X.beginPath(); X.arc(x, y + 6, 6, 0, 7); K.ink(Math.sin(now * 3 + i * 1.3) > -.3 ? ['#ffe14d', '#ff5c8a', '#5CFF7A'][i % 3] : '#7a6a30', 2); }
      for (const lx of [L + 46, R - 46]) { const sw = Math.sin(now * 1.4 + lx) * .08; X.save(); X.translate(lx, 210); X.rotate(sw); K.line([[0, -40], [0, 0]], 3, '#8f9cb3'); K.rr(-22, 0, 44, 56, 18); K.ink('#e8434f', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; K.el(-8, 16, 5, 12, -.2); X.fill(); X.fillStyle = '#ffd23f'; X.fillRect(-12, 0, 24, 5); X.restore(); }
      // the chalkboard menu with the gold bar
      const bx = 150, bw = 500, by0 = 70;
      const BD = K.rrP(130, 58, 540, 84, 12); K.cel(BD, '#2c5a46', '#1f4234', 4, 4, 5); X.strokeStyle = '#d9944f'; X.lineWidth = 6; X.stroke(BD); X.strokeStyle = INK; X.lineWidth = 2; X.stroke(BD);
      X.save(); K.rr(bx, by0, bw, 24, 10); X.clip(); const n = 40; for (let i = 0; i < n; i++) { X.fillStyle = col(i / n * .9); X.fillRect(bx + i * bw / n, by0, bw / n + 1, 24); } X.fillStyle = 'rgba(255,255,255,.28)'; X.fillRect(bx, by0 + 3, bw, 6); X.restore(); K.rr(bx, by0, bw, 24, 10); K.ink(null, 3.5);
      const zx = bx + Z0 / .9 * bw, zw = (Z1 - Z0) / .9 * bw; K.rr(zx, by0 - 7, zw, 38, 8); X.strokeStyle = INK; X.lineWidth = 9; X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 3.5; X.stroke();
      txt('GOLD', zx + zw / 2, 124, 22, '#FFE14D');
      const mk = bx + p / .9 * bw; X.beginPath(); X.moveTo(mk - 12, 112); X.lineTo(mk + 12, 112); X.lineTo(mk, 96); X.closePath(); K.ink('#fff', 3);
      // the fryer
      const aby = by + 110, ny = aby - 52;
      K.shade(400, 578, 290, 14, .3);
      const VAT = K.rrP(180, 400, 440, 172, 18); K.cel(VAT, '#c9ced6', '#8f9cb3', 10, 8, 5); K.glint(VAT, 260, 440, 70, 10, .35, 0);
      X.fillStyle = INK; K.rr(212, 412, 376, 66, 14); X.fill();
      K.rr(200, 410, 400, 64, 14); X.save(); X.clip(); X.fillStyle = K.vg(410, 474, [[0, '#ffc93c'], [1, '#e08a00']]); X.fillRect(200, 410, 400, 64);
      X.fillStyle = '#ffe58a'; for (let i = 0; i < 10; i++) { const bxx = 215 + i * 40 + Math.sin(now * 3 + i) * 6, byy = 436 + Math.sin(now * 5 + i * 2) * 8, br = (6 + (i % 3) * 3) * (hold ? 1.3 : 1); X.beginPath(); X.arc(bxx, byy, br, 0, 7); X.fill(); X.strokeStyle = '#c47a00'; X.lineWidth = 2; X.stroke(); } X.restore(); K.rr(200, 410, 400, 64, 14); K.ink(null, 3);
      const RIM = K.rrP(150, 388, 500, 26, 12); K.cel(RIM, '#e6ebf3', '#a9b2c6', 4, 4, 5);
      // the hoist: chain from a pulley under the sign down to the basket
      K.el(400, 150, 14, 14); K.ink('#cfd8e6', 3); X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(400, 150); X.lineTo(400, aby - 12); X.stroke(); X.strokeStyle = '#aab3c4'; X.lineWidth = 5; X.setLineDash([7, 5]); X.stroke(); X.setLineDash([]);
      K.rr(342, aby - 14, 116, 26, 8); K.ink('#aab3c4', 4); X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); for (let i = 0; i < 6; i++) { X.moveTo(354 + i * 18, aby - 10); X.lineTo(354 + i * 18, aby + 8); } X.stroke();
      // the nugget (it has a face)
      const fc = col(p), NG = K.P('M-62,6 C-72,-22 -50,-48 -20,-44 C-6,-62 32,-60 42,-40 C70,-36 74,-4 56,10 C42,24 -40,26 -62,6Z');
      const cool = !lost && !won && p >= Z0 && p <= Z1, shades = cool || won;
      X.save(); X.translate(400, ny); const bump = hold ? Math.sin(now * 40) * 1.5 : 0; X.translate(bump, 0);
      K.cel(NG, fc, swMix(fc, '#3b2412', .38), 7, 6, 5); K.glint(NG, -26, -30, 22, 6, .38, -.3);
      X.fillStyle = 'rgba(255,255,255,.28)'; for (let i = 0; i < 9; i++) { X.beginPath(); X.arc(-44 + K.hash(i) * 90, -34 + K.hash(i + 20) * 50, 3, 0, 7); X.fill(); }
      const em = lost ? (burnt ? 'bonk' : 'dizzy') : (burnt ? 'panic' : 'idle');
      if (shades) { K.rr(-36, -22, 30, 18, 6); K.ink(INK, 2); K.rr(6, -22, 30, 18, 6); K.ink(INK, 2); X.fillStyle = INK; X.fillRect(-8, -20, 16, 5); X.fillStyle = 'rgba(255,255,255,.55)'; K.el(-26, -17, 5, 2, -.3); X.fill(); K.el(16, -17, 5, 2, -.3); X.fill(); }
      else { K.eye(-17, -14, 8.5, em, [0, .3], now, 0); K.eye(17, -14, 8.5, em, [0, .3], now, 1); }
      X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();
      if (burnt && !lost || (lost && burnt)) { X.arc(0, 10, 6, 0, 7); } else if (lost) { X.arc(0, 16, 9, Math.PI * 1.15, Math.PI * 1.85); } else if (shades) { X.arc(0, -2, 12, .15, Math.PI - .15); } else { X.arc(0, 0, 9, .2, Math.PI - .2); }
      X.stroke(); if (shades) { X.fillStyle = 'rgba(255,110,165,.55)'; K.el(-34, 4, 7, 4); X.fill(); K.el(34, 4, 7, 4); X.fill(); }
      if (lost && !burnt) { X.fillStyle = '#7fd34a'; K.el(0, 6, 40, 20); X.globalAlpha = .25; X.fill(); X.globalAlpha = 1; }
      if (burnt && !lost || burnt) K.sweat(40, -34, 1.2, now);
      X.restore();
      // the front lip of the oil (the nugget sinks into it)
      X.save(); K.rr(200, 410, 400, 64, 14); X.clip(); X.fillStyle = 'rgba(255,170,30,.62)'; X.fillRect(200, 430, 400, 48); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(206, 430, 388, 3); X.restore();
      if (hold || done) for (let i = 0; i < 5; i++) { const sx = 340 + i * 30, sy = 380 - ((now * 60 + i * 30) % 90); K.puff(sx, sy, 8 + (i % 2) * 3, 1 - ((now * 60 + i * 30) % 90) / 90 * .9, '#fff'); }
      if (burnt && !won) for (let i = 0; i < 4; i++) { const k = ((now * .6 + i * .25) % 1); K.puff(380 + i * 20 + Math.sin(k * 6 + i) * 14, ny - 40 - k * 120, 14 + k * 20, 1 - k, '#4a4458'); }
      if (won) { K.rays(400, ny - 10, 130, now, Math.max(0, .5 - ot * .4)); for (let i = 0; i < 4; i++) K.star(400 + Math.cos(now * 4 + i * 1.57) * 100, ny - 10 + Math.sin(now * 4 + i * 1.57) * 50, 10, 4, 4, now * 3, '#FFE14D', 2.5); }
      // the cat (a hungry fan)
      const cx = R - 88, cy = 548, nl = [(400 - cx) / 300, (ny - cy + 80) / 300];
      K.shade(cx, cy + 4, 46, 8, .3); X.save(); X.translate(cx, cy);
      K.curve(30, -4, 56 + Math.sin(now * 3) * 10, -30, 50 + Math.sin(now * 3) * 14, -64, 9, '#ff9a4d');
      const CB = K.rrP(-34, -64, 68, 64, 28); K.cel(CB, '#ffb86b', '#e08a3a', 5, 4, 4); K.el(0, -22, 18, 20); X.fillStyle = '#fff3d8'; X.fill();
      for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 22, -100); X.lineTo(sx * 30, -128); X.lineTo(sx * 6, -108); X.closePath(); K.ink('#ffb86b', 3); }
      const CH = K.elP(0, -88, 34, 28); K.cel(CH, '#ffb86b', '#e08a3a', 4, 4, 4); K.glint(CH, -12, -100, 10, 4, .4, -.4);
      const cm = won ? 'happy' : lost ? 'panic' : 'idle'; K.eye(-14, -90, 8, cm, nl, now, 3); K.eye(14, -90, 8, cm, nl, now, 4);
      X.beginPath(); X.moveTo(-4, -78); X.lineTo(4, -78); X.lineTo(0, -73); X.closePath(); K.ink('#ff7aa8', 1.5);
      X.strokeStyle = INK; X.lineWidth = 2.4; X.beginPath(); for (const sx of [-1, 1]) { X.moveTo(sx * 18, -78); X.lineTo(sx * 40, -82); X.moveTo(sx * 18, -74); X.lineTo(sx * 40, -72); } X.stroke();
      if (!g.result && hold) { X.fillStyle = '#9fe3ff'; K.el(10, -66 + (now * 40) % 14, 2.5, 4); X.fill(); }
      if (won) K.heart(26, -122 - ot * 20, 1, Math.max(0, 1 - ot));
      X.restore();
      // Caos the chef
      const fy = 536, hop = won ? Math.abs(Math.sin(ot * 9)) * 14 : 0, cmx = -OX + 92;
      K.shade(cmx, fy + 3, 40, 7, .3);
      X.save(); X.translate(cmx, fy - hop); K.arms(5.4, won ? -2.5 : hold ? -1.1 : -.25, won ? 2.5 : lost ? 2.2 : .5, 1); X.restore();
      caos(cmx, fy - hop, 5.4, { mood: swSad(g) });
      X.save(); X.translate(cmx, fy - hop - 5.4 * 9); for (const [a, b, r] of [[-14, -6, 11], [0, -14, 13], [14, -6, 11]]) { X.beginPath(); X.arc(a, b, r, 0, 7); K.ink('#fff', 3); } K.rr(-18, -6, 36, 10, 4); K.ink('#f4f4f4', 3); X.restore();
      if (hold && !g.result) K.sweat(cmx + 40, fy - 62, 1.2, now);
      if (lost) { const w = raw ? 'RAW!' : 'BURNT!'; K.badge(w, 400, 462, 46, '#ff4d5e', '#fff', K.outBack(ot / .25), -.05); }
      else if (won) K.badge('PERFECT!', 560, 200, 46, '#5CFF7A', INK, K.outBack(ot / .25), .05);
      vignette(.2);
    }
  };
  return g;
}

/* ── 6 FILL: hold to pump, release in the band (a roadside pit stop, a bug-eyed car with a thirst) ── */
function flBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 500, [[0, '#36b0ea'], [.55, '#86d8fb'], [1, '#d6f7ff']]); X.fillRect(L, 0, VW, 520);
  K.hills(L, R, 470, 90, .006, 1, '#a9dfc6', null); K.hills(L, R, 505, 36, .011, 4, '#87d19b', '#4f9a6a', 3, 520);
  X.fillStyle = '#c9ced6'; X.fillRect(L, 516, VW, 90); X.fillStyle = K.vg(516, 600, [[0, '#9aa3b8'], [1, '#6d7690']]); X.fillRect(L, 516, VW, 90); K.horizon(516, L, R, 5);
  X.fillStyle = '#ffd23f'; for (let x = L - (L % 120); x < R; x += 120) { K.rr(x, 566, 64, 8, 3); X.fill(); }
  // the pump
  const PU = K.rrP(60, 190, 150, 330, 16); K.cel(PU, '#e8434f', '#a8282a', 10, 8, 5); K.glint(PU, 90, 240, 12, 70, .3, 0);
  K.rr(46, 504, 178, 18, 6); K.ink('#6d7690', 4);
  K.rr(76, 150, 118, 46, 14); K.ink('#ffd23f', 4); X.beginPath(); X.moveTo(135, 160); X.quadraticCurveTo(160, 182, 135, 188); X.quadraticCurveTo(110, 182, 135, 160); K.ink('#e8434f', 2.5);
  K.rr(78, 214, 114, 62, 8); K.ink('#14101c', 3); for (let i = 0; i < 3; i++) { K.rr(88 + i * 36, 304, 28, 26, 6); K.ink(['#5CFF7A', '#ffd23f', '#4DB8FF'][i], 3); }
  K.rr(100, 350, 70, 40, 8); K.ink('#fff', 3); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(110, 362); X.lineTo(160, 362); X.moveTo(110, 376); X.lineTo(150, 376); X.stroke();
  // the oil-drop mascot sign
  const sx = R - 58; K.line([[sx, 250], [sx, 520]], 10, '#8f9cb3');
}
function swFill(sp) {
  let f = 0, hold = false, done = false, c = 0, inB = false; const B0 = .78, B1 = .9;
  const O = SWK.outro();
  const start = () => { if (!done && !g.result && !hold) { hold = true; sfx.click(); } };
  const end = () => {
    if (!hold || g.result) return; hold = false; done = true; sfx.click();
    if (f >= B0 && f <= B1) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(560, 400, 20); ring(560, 440, '#5CFF7A', 120); floatText('+1', 560, 360, '#5CFF7A', 44); } else { g.result = 'lose'; swLose(); }
  };
  const g = {
    wide: true, cmd: 'FILL!', hint: 'HOLD SPACE / MOUSE, RELEASE IN GREEN', thint: 'HOLD, RELEASE IN GREEN', dur: 5,
    key(e) { if (e.code === 'Space') start(); }, keyup(e) { if (e.code === 'Space') end(); }, down() { start(); }, up() { end(); },
    update(dt) {
      O.mark(g);
      c += dt;
      if (hold && !g.result) {
        f += .42 * sp * (1 - .35 * f) * dt; if (Math.random() < .4) noise(.04, .03, 300 + f * 1500, 600 + f * 2500, 'bandpass');
        if (!inB && f >= B0) { inB = true; sfx.blip(9); }
        if (f >= 1) { f = 1; g.result = 'lose'; hold = false; swLose(); sfx.splat(); burst(450, 410, '#4DB8FF', 18); }
      }
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', over = lost && f >= 1, L = -OX, R = W + OX;
      X.drawImage(K.baked('fl', flBake), -OX, 0);
      for (let i = 0; i < 3; i++) K.cloud(((now * (5 + i * 3) + i * 330) % (VW + 200)) - 140 - OX, 90 + i * 40, .9 + (i % 2) * .2);
      // the mascot sign: it reacts too
      const sx = R - 58, mm = over ? 'panic' : won ? 'happy' : lost ? 'sad' : 'idle';
      X.save(); X.translate(sx, 200 + Math.sin(now * 1.6) * 3); X.rotate(Math.sin(now * 1.3) * .04);
      X.beginPath(); X.moveTo(0, -52); X.bezierCurveTo(40, -6, 44, 34, 0, 42); X.bezierCurveTo(-44, 34, -40, -6, 0, -52); K.ink('#ffd23f', 4); X.fillStyle = 'rgba(255,255,255,.5)'; K.el(-14, -4, 6, 14, .4); X.fill();
      K.eye(-12, 6, 7, mm, [-1, .4], now, 5); K.eye(12, 6, 7, mm, [-1, .4], now, 6); X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); if (won) X.arc(0, 18, 8, .2, Math.PI - .2); else if (over) { X.arc(0, 28, 5, 0, 7); } else X.arc(0, 28, 8, Math.PI * 1.2, Math.PI * 1.8); X.stroke(); X.restore();
      K.shade(135, 524, 90, 12, .3); K.shade(565, 540, 150, 14, .3);
      txt(((f * 12) | 0) + '.' + ((f * 120) % 10 | 0) + 'L', 135, 246, 28, '#5CFF7A');
      // the hose
      K.curve(210, 340, 300, 520, 450, 432, 8, '#3b3550');
      // the car (it has a face and a thirst)
      const sh = hold ? Math.sin(now * 60) * 2 : 0, bl = Math.min(1, f);
      X.save(); X.translate(sh, over ? Math.sin(ot * 30) * 2 : 0);
      for (const wx of [506, 640]) { X.beginPath(); X.arc(wx, 512, 32, 0, 7); K.ink('#2b2640', 5); X.beginPath(); X.arc(wx, 512, 13, 0, 7); K.ink('#cfd8e6', 3); }
      const BODY = K.rrP(430, 436, 270, 76, 26); K.cel(BODY, '#4DB8FF', '#2a8fcb', 9, 8, 5); K.glint(BODY, 480, 456, 40, 7, .4, 0);
      const CAB = K.rrP(492, 380, 156, 70, 26); K.cel(CAB, '#4DB8FF', '#2a8fcb', 8, 8, 5);
      K.rr(502, 388, 136, 52, 18); K.ink('#bfefff', 3.5);
      const em = over ? 'dizzy' : won ? 'happy' : lost ? 'sad' : f > B1 ? 'panic' : 'idle', er = 10 + bl * 3;
      K.eye(540, 410, er, em === 'sad' ? 'bonk' : em, [-.6, .2], now, 0); K.eye(594, 410, er, em === 'sad' ? 'bonk' : em, [-.6, .2], now, 1);
      X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); if (won) X.arc(567, 424, 12, .15, Math.PI - .15); else if (over || f > B1) { K.el(567, 430, 8, 5 + bl * 3); } else if (lost) X.arc(567, 436, 9, Math.PI * 1.15, Math.PI * 1.85); else X.arc(567, 428, 10, .3, Math.PI - .3); X.stroke();
      if (bl > .5 || won) { X.fillStyle = 'rgba(255,110,165,' + (won ? .7 : .4) + ')'; K.el(520, 430, 8, 4); X.fill(); K.el(614, 430, 8, 4); X.fill(); }
      K.rr(642, 450, 40, 30, 8); K.ink('#ffd23f', 3); X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(646, 456, 10, 5);
      K.rr(436, 446, 26, 12, 4); K.ink('#cfd8e6', 3); X.restore();
      // the nozzle on the filler neck
      X.save(); X.translate(452, 432); X.rotate(-.5); K.rr(-6, -34, 14, 34, 5); K.ink('#e8434f', 3); K.rr(-12, -2, 26, 12, 4); K.ink('#cfd8e6', 3); X.restore();
      if (hold) { for (let i = 0; i < 5; i++) { K.el(450 + ((now * 200 + i * 17) % 30), 436 + ((now * 120 + i * 11) % 14), 3.5, 3.5); X.fillStyle = '#ffd23f'; X.fill(); } }
      if (over) { for (let i = 0; i < 9; i++) { const k = ((ot * 2.2 + i / 9) % 1), a = -1.9 + i * .1; X.fillStyle = 'rgba(255,200,40,' + (1 - k) + ')'; X.beginPath(); X.arc(452 + Math.cos(a) * k * 90 + k * 10, 432 + Math.sin(a) * k * 120 + k * k * 150, 7 - k * 3, 0, 7); X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.stroke(); } K.el(470, 522, 40 + Math.min(ot, .8) * 50, 7); X.fillStyle = 'rgba(255,200,40,.8)'; X.fill(); }
      // the gauge: a glass tube on a stand
      const gx = 320, gy = 130, gh = 340;
      K.rr(gx - 22, gy + gh + 2, 100, 22, 8); K.ink('#6d7690', 4);
      K.rr(gx, gy, 56, gh, 26); K.ink('#fff', 5);
      X.save(); K.rr(gx, gy, 56, gh, 26); X.clip(); X.fillStyle = 'rgba(92,255,122,.9)'; X.fillRect(gx, gy + gh * (1 - B1), 56, gh * (B1 - B0)); X.fillStyle = '#ffc93c'; X.fillRect(gx + 3, gy + gh * (1 - f), 50, gh * f + 4); X.fillStyle = '#fff3a0'; X.fillRect(gx + 3, gy + gh * (1 - f), 50, 6); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(gx + 8, gy + 8, 8, gh - 16); X.restore();
      K.rr(gx, gy, 56, gh, 26); K.ink(null, 5); X.strokeStyle = '#5CFF7A'; X.lineWidth = 3; X.strokeRect(gx - 3, gy + gh * (1 - B1), 62, gh * (B1 - B0));
      X.fillStyle = INK; X.fillRect(gx - 12, gy + gh * (1 - f) - 3, 80, 6); X.beginPath(); X.moveTo(gx + 74, gy + gh * (1 - f)); X.lineTo(gx + 90, gy + gh * (1 - f) - 9); X.lineTo(gx + 90, gy + gh * (1 - f) + 9); X.closePath(); K.ink('#fff', 2.5);
      txt('FULL', gx + 28, gy - 14, 20, '#fff');
      if (over) K.badge('OVERFLOW!', 590, 126, 40, '#ff4d5e', '#fff', K.outBack(ot / .25), -.04); else if (lost) K.badge(f < B0 ? 'NOT ENOUGH!' : 'TOO MUCH!', 590, 126, 36, '#ff4d5e', '#fff', K.outBack(ot / .25), -.04); else if (won) K.badge('PERFECT!', 560, 210, 44, '#5CFF7A', INK, K.outBack(ot / .25), .04);
      if (won) for (let i = 0; i < 3; i++) K.heart(540 + i * 50, 340 - ot * 40 - (i % 2) * 18, 1, Math.max(0, 1 - ot));
      if (lost && !over && ot < .8) { for (let i = 0; i < 3; i++) K.puff(660 + i * 14, 400 - ot * 60 - i * 20, 12 + i * 4, 1 - ot * 1.2, '#8c8a9e'); }
      // Caos with the pump handle
      const cmx = 262, fy = 536, hop = won ? Math.abs(Math.sin(ot * 9)) * 14 : 0;
      K.shade(cmx, fy + 3, 40, 7, .3);
      X.save(); X.translate(cmx, fy - hop); K.arms(5.4, won ? -2.5 : hold ? -1.0 : -.3, won ? 2.5 : hold ? 1.3 : .3, 1); X.restore();
      caos(cmx, fy - hop, 5.4, { mood: swSad(g) });
      if (hold && !g.result) K.sweat(cmx + 42, fy - 60, 1.2, now);
      vignette(.16);
    }
  };
  return g;
}

/* ── 7 DUCK: crouch under UFOs (a beach luau at sunset, saucers as the limbo bar, a cheering crab) ── */
function lmBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 400, [[0, '#ff7a5c'], [.5, '#ffb347'], [1, '#ffe09a']]); X.fillRect(L, 0, VW, 400);
  X.fillStyle = 'rgba(255,240,170,.12)'; for (const r of [150, 120, 100]) { X.beginPath(); X.arc(560, 392, r, 0, K.TAU); X.fill(); }
  X.save(); X.beginPath(); X.rect(L, 0, VW, 396); X.clip(); X.beginPath(); X.arc(560, 396, 92, 0, K.TAU); K.ink('#ffd84a', 4); X.fillStyle = '#fff3a0'; K.el(530, 360, 30, 16, -.5); X.fill(); X.restore();
  X.fillStyle = K.vg(392, 472, [[0, '#4cc4e8'], [1, '#2a8fcb']]); X.fillRect(L, 392, VW, 80); K.horizon(392, L, R, 3);
  X.fillStyle = K.vg(470, 600, [[0, '#f4d9a0'], [1, '#e2b96f']]); X.fillRect(L, 470, VW, 140); K.horizon(471, L, R, 4);
  for (let i = 0; i < 14; i++) { const x = L + K.hash(i + 4) * VW, y = 500 + K.hash(i + 30) * 80; X.fillStyle = 'rgba(160,110,50,.28)'; K.el(x, y, 5, 2); X.fill(); }
  X.beginPath(); X.moveTo(0, 0); for (const [sx, sy] of [[R - 190, 520]]) { X.save(); X.translate(sx, sy); K.star(0, 0, 11, 5, 5, .3, '#ff7a5c', 2.5); X.restore(); }
  // palms
  for (const [px, flip] of [[L + 110, 1], [R - 120, -1]]) {
    K.curve(px, 474, px + flip * 24, 370, px + flip * 6, 290, 14, '#a5622c');
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .55 + flip * .1; X.save(); X.translate(px + flip * 6, 290); X.rotate(a + Math.PI / 2); X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(26, -34, 8, -92); X.quadraticCurveTo(-4, -50, 0, 0); K.ink(i % 2 ? '#2f9a55' : '#3fb260', 3.5); X.restore(); }
    for (const [cx2, cy2] of [[-6, 292], [8, 298]]) { X.beginPath(); X.arc(px + flip * 6 + cx2, cy2, 8, 0, K.TAU); K.ink('#8a5a34', 2.5); }
  }
}
function swLimbo(sp) {
  const sq = [0, 1, 0, 0].map((d, i) => ({ x: Math.max(900, W + OX + 80) + i * (330 - OX * .25), decoy: d, ph: Math.random() * 6, pass: false }));
  let crouch = 0, tgt = 0, held = false, c = 0;
  const O = SWK.outro();
  const g = {
    wide: true, cmd: 'DUCK!', hint: 'HOLD ↓ / SPACE / MOUSE TO CROUCH', thint: 'HOLD TO CROUCH, RELEASE TO STAND', dur: 5, timeWin: true,
    key(e) { if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') { if (!held) sfx.whoosh(false); held = true; } },
    keyup(e) { if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') held = false; },
    down() { if (!held) sfx.whoosh(false); held = true; }, up() { held = false; },
    update(dt) {
      O.mark(g);
      c += dt; tgt = held ? 1 : 0; crouch += (tgt - crouch) * Math.min(1, 16 * dt);
      if (g.result) return;
      for (const u of sq) {
        u.x -= 380 * sp * dt;
        if (!u.decoy && Math.abs(u.x - 200) < 62 && crouch < .75) { g.result = 'lose'; swLose(); burst(200, 400, '#FFE14D', 14); floatText('BONK!', 200, 330, '#ff4d4d', 40); }
        else if (!u.pass && u.x < 140) { u.pass = true; if (!u.decoy) { sfx.whoosh(); sfx.blip(7); floatText('+1', 200, 350, '#5CFF7A', 32); } }
      }
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', L = -OX, R = W + OX;
      X.drawImage(K.baked('lm', lmBake), -OX, 0);
      // live: gulls, waves, torches
      for (let i = 0; i < 2; i++) { const gx = ((now * (30 + i * 12) + i * 400) % (VW + 100)) - 60 - OX, gy = 120 + i * 40 + Math.sin(now * 3 + i) * 6; X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(gx - 12, gy); X.quadraticCurveTo(gx - 6, gy - 8 - Math.sin(now * 8 + i) * 4, gx, gy); X.quadraticCurveTo(gx + 6, gy - 8 - Math.sin(now * 8 + i) * 4, gx + 12, gy); X.stroke(); }
      X.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < Math.ceil(VW / 110); i++) { K.rr(i * 110 - OX + Math.sin(now * 2 + i) * 10, 410 + (i % 2) * 22, 54, 6, 3); X.fill(); }
      for (const x of [60 - OX, 740 + OX]) {
        K.line([[x, 480], [x, 330]], 11, '#8a5a34'); const fl = Math.sin(now * 12 + x) * 3;
        X.beginPath(); X.moveTo(x - 12, 316); X.quadraticCurveTo(x - 20 + fl, 280, x + fl, 252); X.quadraticCurveTo(x + 22 + fl, 282, x + 12, 316); X.closePath(); K.ink('#ff7a3d', 3.5);
        X.beginPath(); X.moveTo(x - 6, 316); X.quadraticCurveTo(x - 8, 292, x + fl * .6, 278); X.quadraticCurveTo(x + 10, 296, x + 6, 316); X.closePath(); X.fillStyle = '#ffe14d'; X.fill(); K.rr(x - 13, 308, 26, 10, 4); K.ink('#5a3a22', 3);
      }
      // the crab on the beach cheers on
      const cbx = R - 250 - OX * 0, cby = 524, cj = won ? Math.abs(Math.sin(ot * 9)) * 16 : 0, cs = lost ? 'happy' : 'idle';
      K.shade(cbx, cby + 4, 30, 6, .25); X.save(); X.translate(cbx, cby - cj);
      for (const sx of [-1, 1]) { K.line([[sx * 16, -4], [sx * 28, 4]], 3.5, '#e8434f'); K.curve(sx * 20, -20, sx * 38, -40 - (won || lost ? Math.abs(Math.sin(now * 10)) * 10 : 0), sx * 30, -52, 4, '#e8434f'); X.beginPath(); X.arc(sx * 30, -56, 8, 0, 7); K.ink('#e8434f', 3); }
      const CRB = K.elP(0, -14, 26, 18); K.cel(CRB, '#ff5a4a', '#c93a34', 4, 3, 3.5); K.eye(-9, -34, 6, cs, [-.6, 0], now, 8); K.eye(9, -34, 6, cs, [-.6, 0], now, 9); K.line([[-9, -26], [-9, -30]], 2, '#ff5a4a'); X.restore();
      // the saucers (the limbo bars); the aliens inside look at Caos
      for (const u of sq) {
        const y = u.decoy ? 190 : 360, bob = Math.sin(now * 4 + u.ph) * 4, near = !u.decoy && Math.abs(u.x - 200) < 140;
        if (!u.decoy) { X.beginPath(); X.moveTo(u.x - 22, y + 20); X.lineTo(u.x + 22, y + 20); X.lineTo(u.x + 52, 472); X.lineTo(u.x - 52, 472); X.closePath(); X.fillStyle = 'rgba(120,255,160,.4)'; X.fill(); X.strokeStyle = 'rgba(70,200,110,.8)'; X.lineWidth = 3; X.beginPath(); X.moveTo(u.x - 22, y + 20); X.lineTo(u.x - 52, 472); X.moveTo(u.x + 22, y + 20); X.lineTo(u.x + 52, 472); X.stroke(); }
        K.shade(u.x, 470, 56, 9, u.decoy ? .12 : .22);
        X.save(); X.translate(u.x, y + bob); const sc = u.decoy ? .86 : 1; X.scale(sc, sc);
        const DM = K.elP(0, -18, 24, 24); K.cel(DM, '#bfefff', '#8bc6e6', 3, 3, 4);
        const am = lost && near ? 'happy' : u.pass ? 'happy' : 'idle';
        X.fillStyle = '#7fd34a'; K.el(0, -14, 13, 14); K.ink('#7fd34a', 2.5); K.eye(-6, -17, 5, am, [-.9, .6], now, u.ph); K.eye(6, -17, 5, am, [-.9, .6], now, u.ph + 1);
        X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-5, -6); X.quadraticCurveTo(0, am === 'happy' ? -1 : -6, 5, -6); X.stroke();
        const DS = K.elP(0, 0, 60, 20); K.cel(DS, '#cfd8e6', '#8f9cb3', 4, 5, 4); K.glint(DS, -24, -8, 18, 4, .5, -.1);
        for (let d = -1; d <= 1; d++) { X.beginPath(); X.arc(d * 30, 4, 5.5, 0, 7); K.ink(['#ff5c8a', '#ffe14d', '#5CFF7A'][((d + 1 + Math.floor(now * 4)) % 3 + 3) % 3], 2); }
        X.restore();
      }
      // Caos, the limbo champion (a flower lei)
      const cr = crouch; let ang = 0, lx = 200, ly = 470; if (lost) { ang = -1.35 * K.ease(ot / .25); lx = 200 - K.ease(ot / .25) * 20; }
      K.shade(200, 472, 55 + cr * 14, 10, .3);
      X.save(); X.translate(lx, ly); X.rotate(ang); X.scale(1 + .12 * cr, 1 - .45 * cr);
      const hop = won ? Math.abs(Math.sin(ot * 9)) * 14 : 0; X.translate(0, -hop);
      K.arms(9, won ? -2.6 : -1.0 + cr * .7, won ? 2.6 : 1.0 - cr * .7, 1);
      caos(0, 0, 9, { mood: swSad(g) });
      for (let i = 0; i < 9; i++) { const k = i / 8, fx = -50 + k * 100, fy2 = -38 + Math.sin(k * Math.PI) * 14; X.beginPath(); X.arc(fx, fy2, 7, 0, 7); K.ink(['#ff5c8a', '#ffe14d', '#fff'][i % 3], 2.5); }
      X.restore();
      if (lost) for (let i = 0; i < 3; i++) K.star(lx - 20 + i * 24, ly - 120 + Math.sin(now * 9 + i * 2) * 8, 8, 3.5, 5, now * 5 + i, '#FFE14D', 2.5);
      if (won) for (let i = 0; i < 3; i++) K.heart(150 + i * 50, 340 - ot * 40 - (i % 2) * 18, 1, Math.max(0, 1 - ot));
      if (c < 1.2 && !g.result) txt('GET LOW!', 400, 90, 44, '#fff');
      vignette(.18);
    }
  };
  return g;
}

/* ── 8 STEER: broom through a scrolling night canyon (a witch hat, a nervous cat, a moon with a face) ── */
function stBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 600, [[0, '#1c0e46'], [.45, '#4a2a8a'], [.8, '#b8508f'], [1, '#ff9a7a']]); X.fillRect(L, 0, VW, 600);
  // far hills with a crooked castle (coloured outline, no ink: distance)
  X.beginPath(); X.moveTo(L, 600); for (let x = L; x <= R; x += 20) X.lineTo(x, 470 - Math.sin(x * .011) * 26 - Math.sin(x * .027) * 12); X.lineTo(R, 600); X.closePath(); X.fillStyle = '#5a2f8c'; X.fill(); X.strokeStyle = '#3a1f66'; X.lineWidth = 3; X.stroke();
  const cx = 150, cy = 452;
  for (const [dx, w, h] of [[-46, 26, 70], [0, 34, 104], [46, 24, 58]]) { X.beginPath(); X.moveTo(cx + dx - w / 2, cy); X.lineTo(cx + dx - w / 2, cy - h); X.lineTo(cx + dx, cy - h - 30); X.lineTo(cx + dx + w / 2, cy - h); X.lineTo(cx + dx + w / 2, cy); X.closePath(); K.ink('#43297a', 2.5); }
  for (const [dx, y] of [[0, -70], [-46, -44], [46, -30], [0, -40]]) { X.fillStyle = '#ffd86a'; K.rr(cx + dx - 3, cy + y, 6, 10, 2); X.fill(); }
}
function swSteer(sp) {
  const ph = Math.random() * 6, spd = 300 * sp; let s = 0, py = 300, tgt = 300, vy = 0, sp8 = 0;
  const O = SWK.outro();
  const cen = w => 300 + Math.min(1, Math.max(0, w) / 500) * (95 * Math.sin(w * .0075 + ph) + 40 * Math.sin(w * .017 + ph * 2));
  const hh = w => 205 - Math.min(1, Math.max(0, w) / 700) * (75 + 10 * Math.min(sp, 2));
  const top = w => cen(w) - hh(w) + (Math.sin(w * .05) + 1) * 7;
  const bot = w => cen(w) + hh(w) - Math.abs(Math.sin(w * .045)) * 24;
  const g = {
    wide: true, cmd: 'STEER!', hint: 'MOUSE UP/DOWN OR ↑ ↓ TO FLY', thint: 'DRAG UP AND DOWN', dur: 4.5, timeWin: true,
    move(p) { tgt = p.y; },
    update(dt) {
      O.mark(g);
      if (g.result) return;
      if (keys.ArrowUp || keys.KeyW) tgt -= 520 * dt; if (keys.ArrowDown || keys.KeyS) tgt += 520 * dt;
      tgt = Math.max(60, Math.min(540, tgt)); const o = py; py += (tgt - py) * Math.min(1, 14 * dt); vy = (py - o) / Math.max(dt, .001);
      s += spd * dt;
      if (s === spd * dt) sfx.whoosh();
      if ((sp8 -= dt) < 0) { sp8 = .07; burst(130, py + 8, '#FFE14D', 1, 60); }
      for (const dx of [-24, 0, 24]) if (py - 16 < top(s + 170 + dx) || py + 14 > bot(s + 170 + dx)) { g.result = 'lose'; swLose(); burst(170, py, '#fff', 14); ring(170, py, '#ff4d4d', 80); break; }
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', L = -OX, R = W + OX;
      X.drawImage(K.baked('st', stBake), -OX, 0);
      // twinkling stars + a flock of tiny bats crossing the sky
      for (let i = 0; i < 16; i++) { const tw = Math.sin(now * 3 + i * 1.7); K.star(L + K.hash(i + 200) * VW, 30 + K.hash(i + 230) * 330, 5 + tw * 1.5, 2.2, 4, now * .5, 'rgba(255,248,200,' + (.55 + tw * .3) + ')', 0); }
      for (let i = 0; i < 4; i++) { const bx2 = ((now * (46 + i * 7) + i * 230) % (VW + 160)) - 80 - OX, by2 = 90 + i * 34 + Math.sin(now * 2 + i) * 10, fl = Math.sin(now * 14 + i * 2) * 5; X.strokeStyle = '#2a1650'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(bx2 - 13, by2 - fl); X.quadraticCurveTo(bx2 - 6, by2 - 8, bx2, by2); X.quadraticCurveTo(bx2 + 6, by2 - 8, bx2 + 13, by2 - fl); X.stroke(); }
      // the moon has a face and watches the broom
      const mx = 580, my = 190, mm = lost ? 'panic' : won ? 'happy' : 'idle', lk = [(170 - mx) / 200, (py - my) / 200];
      X.fillStyle = 'rgba(255,243,176,.14)'; X.beginPath(); X.arc(mx, my, 140, 0, 7); X.fill();
      const MN = K.elP(mx, my, 100, 100); K.cel(MN, '#fff3b0', '#e8d27a', 10, 9, 6); for (const [a, b, r] of [[-38, -40, 17], [34, 26, 24], [44, -52, 10], [-26, 46, 12]]) { X.beginPath(); X.arc(mx + a, my + b, r, 0, 7); X.fillStyle = 'rgba(200,170,70,.4)'; X.fill(); }
      K.glint(MN, mx - 40, my - 50, 26, 10, .5, -.5);
      K.eye(mx - 28, my - 6, 14, mm, lk, now, 1); K.eye(mx + 28, my - 6, 14, mm, lk, now, 2);
      X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); if (won) X.arc(mx, my + 24, 20, .2, Math.PI - .2); else if (lost) X.arc(mx, my + 46, 10, 0, 7); else X.arc(mx, my + 34, 16, Math.PI * 1.2, Math.PI * 1.8); X.stroke();
      X.fillStyle = 'rgba(255,110,165,.45)'; K.el(mx - 52, my + 22, 12, 7); X.fill(); K.el(mx + 52, my + 22, 12, 7); X.fill();
      // CEILING: a grumpy storm cloud with a scalloped belly; sleepy bats hang in its edge (all inside the wall, never in the gap)
      X.lineJoin = 'round';
      X.beginPath(); X.moveTo(-OX - 10, 0); for (let x = -OX - 10; x <= W + OX + 10; x += 8) X.lineTo(x, top(s + x)); X.lineTo(W + OX + 10, 0); X.closePath(); X.fillStyle = '#8a74d8'; X.fill();
      X.save(); X.clip(); X.translate(0, -14); X.fillStyle = '#b9a6f5'; X.fillRect(-OX - 10, -20, VW + 30, 620); X.restore();
      X.save(); X.beginPath(); X.moveTo(-OX - 10, 0); for (let x = -OX - 10; x <= W + OX + 10; x += 8) X.lineTo(x, top(s + x)); X.lineTo(W + OX + 10, 0); X.closePath(); X.clip();
      for (let i = -1; i < Math.ceil(VW / 90) + 2; i++) { const wi = Math.floor(s / 90) + i, wx = wi * 90 + K.hash(wi + 4) * 40, sx = wx - s, ty = top(wx), r = 22 + K.hash(wi) * 14; X.beginPath(); X.arc(sx, ty - r * 1.1, r, 0, 7); X.strokeStyle = 'rgba(90,70,170,.5)'; X.lineWidth = 3; X.stroke(); X.fillStyle = 'rgba(255,255,255,.2)'; X.beginPath(); X.arc(sx - r * .25, ty - r * 1.3, r * .55, 0, 7); X.fill(); }
      X.restore();
      for (let i = -1; i < Math.ceil(VW / 230) + 2; i++) { const wi = Math.floor(s / 230) + i, wx = wi * 230 + 60 + K.hash(wi + 9) * 90, sx = wx - s, ty = top(wx); if (sx < -OX - 30 || sx > W + OX + 30) continue; const by3 = ty - 15, bm = (!g.result && Math.abs(sx - 170) < 110 && py - 16 - ty < 60) || lost ? 'panic' : won ? 'happy' : 'sleepy';
        X.save(); X.translate(sx, by3); K.el(0, 0, 11, 13); K.ink('#3d2a6e', 3); for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(sd * 8, -6); X.lineTo(sd * 15, -22); X.lineTo(sd * 3, -12); X.closePath(); K.ink('#3d2a6e', 2.5); } K.eye(-4, 0, 3.6, bm, [(170 - sx) / 300, .6], now, wi); K.eye(4, 0, 3.6, bm, [(170 - sx) / 300, .6], now, wi + 1); X.restore(); }
      X.beginPath(); for (let x = -OX - 10; x <= W + OX + 10; x += 8) X.lineTo(x, top(s + x)); X.strokeStyle = INK; X.lineWidth = 6; X.stroke();
      // FLOOR: pumpkin patch. A lit grass rim, dark plum earth, jack-o-lanterns buried in the dirt
      X.beginPath(); X.moveTo(-OX - 10, H); for (let x = -OX - 10; x <= W + OX + 10; x += 8) X.lineTo(x, bot(s + x)); X.lineTo(W + OX + 10, H); X.closePath(); X.fillStyle = '#2d1b57'; X.fill();
      X.save(); X.clip(); X.fillStyle = '#231544'; X.fillRect(-OX - 10, 0, VW + 30, 700);
      X.beginPath(); for (let x = -OX - 10; x <= W + OX + 10; x += 8) { const yy = bot(s + x) + 9; x === -OX - 10 ? X.moveTo(x, yy) : X.lineTo(x, yy); } X.strokeStyle = '#5fd36a'; X.lineWidth = 16; X.stroke();
      X.beginPath(); for (let x = -OX - 10; x <= W + OX + 10; x += 8) { const yy = bot(s + x) + 3; x === -OX - 10 ? X.moveTo(x, yy) : X.lineTo(x, yy); } X.strokeStyle = '#8bef7a'; X.lineWidth = 4; X.stroke();
      for (let i = -1; i < Math.ceil(VW / 150) + 2; i++) { const wi = Math.floor(s / 150) + i, wx = wi * 150 + 30 + K.hash(wi + 2) * 70, sx = wx - s, py2 = bot(wx) + 46 + K.hash(wi + 6) * 22; if (py2 > 590) continue; const lit = .75 + Math.sin(now * 7 + wi) * .25;
        X.save(); X.translate(sx, py2); X.fillStyle = 'rgba(255,170,60,' + (.22 * lit) + ')'; X.beginPath(); X.arc(0, 0, 44, 0, 7); X.fill();
        const PK = K.elP(0, 0, 25, 21); K.cel(PK, '#ff8a2a', '#c2561a', 3, 3, 3.5); X.strokeStyle = 'rgba(194,86,26,.8)'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-9, -18); X.quadraticCurveTo(-14, 0, -9, 18); X.moveTo(9, -18); X.quadraticCurveTo(14, 0, 9, 18); X.stroke(); K.line([[0, -20], [2, -28]], 5, '#3f9a45');
        swPoly([[-13, -6], [-5, -6], [-9, -13]], '#ffe14d', 2); swPoly([[13, -6], [5, -6], [9, -13]], '#ffe14d', 2); X.beginPath(); X.moveTo(-12, 5); X.lineTo(-6, 11); X.lineTo(0, 6); X.lineTo(6, 11); X.lineTo(12, 5); X.lineTo(8, 13); X.lineTo(-8, 13); X.closePath(); K.ink('#ffe14d', 2); X.restore(); }
      X.restore();
      X.beginPath(); for (let x = -OX - 10; x <= W + OX + 10; x += 8) X.lineTo(x, bot(s + x)); X.strokeStyle = INK; X.lineWidth = 6; X.stroke();
      // the witch and her cat on the broom (a lantern swings off the handle)
      let bx = 170, by = py, rot = Math.max(-.4, Math.min(.4, vy / 1200)); const wallNear = !g.result && (py - 16 - top(s + 170) < 38 || bot(s + 170) - (py + 14) < 38);
      if (won) { rot = ot * 7.5; by = py - Math.sin(Math.min(1, ot / .8) * Math.PI) * 40; }
      if (lost) { const q = Math.min(1.2, ot); by = py + 520 * q * q; bx = 170 - q * 40; rot = q * 7; }
      if (!lost) for (let i = 1; i < 7; i++) K.star(bx - 82 - i * 18, by + 8 + Math.sin(now * 20 + i) * 4, 8 - i, 3 - i * .3, 4, now * 6 + i, ['#FFE14D', '#ff7ab8', '#7fe0ff'][i % 3], 0);
      X.save(); X.translate(bx, by); X.rotate(rot); X.scale(1.1, 1.1);
      if (lost) { X.save(); X.rotate(.4 * Math.min(1, ot * 4)); K.line([[-50, 8], [-4, 8]], 8, '#b5793a'); X.restore(); X.save(); X.translate(40, 4 + ot * 40); X.rotate(-.5 * Math.min(1, ot * 4)); K.line([[0, 8], [44, 8]], 8, '#b5793a'); X.restore(); }
      else { K.line([[-50, 8], [50, 8]], 8, '#b5793a'); X.save(); X.translate(-62, 8); for (let i = -2; i <= 2; i++) { X.beginPath(); X.moveTo(14, 0); X.lineTo(-18, i * 7 + Math.sin(now * 14 + i) * 3); X.strokeStyle = INK; X.lineWidth = 6; X.stroke(); X.strokeStyle = '#e8c06a'; X.lineWidth = 2.5; X.stroke(); } X.restore(); K.rr(-50, 1, 12, 14, 3); K.ink('#d9944f', 3);
        const sw = Math.sin(now * 5) * 4; K.line([[50, 8], [58 + sw, 22]], 2.5, '#6d7690'); X.fillStyle = 'rgba(255,225,77,.35)'; X.beginPath(); X.arc(58 + sw, 30, 18, 0, 7); X.fill(); K.rr(52 + sw, 22, 13, 16, 4); K.ink('#ffe14d', 2.5); }
      // cat: bigger, with a swishing tail and ears that read
      X.save(); X.translate(40, -12); const cE = lost ? 'panic' : wallNear ? 'panic' : won ? 'happy' : 'idle';
      X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(-10, 8); X.quadraticCurveTo(-26, 10 + Math.sin(now * 6) * 5, -22, -12); X.stroke(); X.strokeStyle = '#3d3158'; X.lineWidth = 4; X.stroke();
      const CT = K.rrP(-13, -8, 26, 26, 11); K.cel(CT, '#4a3d6e', '#2c2346', 3, 3, 3.5); for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 12, -22); X.lineTo(sx * 11, -39); X.lineTo(sx * 1, -24); X.closePath(); K.ink('#4a3d6e', 2.5); X.fillStyle = '#ff9ec2'; X.beginPath(); X.moveTo(sx * 10, -26); X.lineTo(sx * 9.5, -34); X.lineTo(sx * 4, -26); X.closePath(); X.fill(); }
      K.el(0, -15, 15, 13); K.ink('#4a3d6e', 3); K.eye(-6, -16, 6.5, cE, [.9, -.1], now, 3); K.eye(6, -16, 6.5, cE, [.9, -.1], now, 4); X.fillStyle = '#ff9ec2'; K.el(0, -9, 2.4, 1.8); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.6; for (const sx of [-1, 1]) for (const dy of [-1, 1]) { X.beginPath(); X.moveTo(sx * 6, -9); X.lineTo(sx * 17, -9 + dy * 4); X.stroke(); } X.restore();
      K.arms(5.1, won ? -2.4 : -.5, won ? 2.4 : .5, 1);
      X.save(); X.translate(0, 4); caos(0, 0, 5.1, { mood: swSad(g) }); X.restore();
      // witch hat: crooked tip, buckle, a star
      X.save(); X.translate(0, -5); X.beginPath(); X.moveTo(-17, -36); X.quadraticCurveTo(-4, -62, 10, -86); X.quadraticCurveTo(14, -80, 9, -74); X.quadraticCurveTo(16, -52, 17, -36); X.closePath(); K.ink('#6a32a0', 3); K.rr(-26, -41, 52, 9, 4); K.ink('#6a32a0', 3); X.fillStyle = '#ffd23f'; K.rr(-10, -42, 20, 7, 2); X.fill(); K.star(4, -58, 6, 2.6, 5, 0, '#ffe14d', 1.5); X.restore();
      X.restore();
      if (lost) for (let i = 0; i < 3; i++) K.star(bx - 30 + i * 30, by - 50 + Math.sin(now * 9 + i) * 6, 7, 3, 5, now * 5 + i, '#FFE14D', 2);
      if (won) for (let i = 0; i < 4; i++) K.star(bx + Math.cos(ot * 8 + i * 1.57) * 60, by + Math.sin(ot * 8 + i * 1.57) * 40, 8, 3.5, 5, now * 4, '#FFE14D', 2.5);
      vignette(.3);
    }
  };
  return g;
}

/* ── 9 SHHH: quiet everything that is waking the sleeper (a bedroom at night, a snore bubble, a yelling alarm clock) ── */
function slBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 490, [[0, '#2b2d6e'], [1, '#4a3f90']]); X.fillRect(L, 0, VW, 490);
  X.fillStyle = 'rgba(160,140,255,.14)'; for (let x = L - (L % 70); x < R; x += 70) X.fillRect(x, 0, 30, 490);
  X.fillStyle = 'rgba(255,150,180,.28)'; for (let i = 0; i < 40; i++) { const x = L + K.hash(i) * VW, y = 20 + K.hash(i + 40) * 440; if (x < 300 || x > 500 || y > 260) { X.beginPath(); X.arc(x, y, 4, 0, K.TAU); X.fill(); } }
  X.fillStyle = K.vg(486, 600, [[0, '#b97a46'], [1, '#7a4a28']]); X.fillRect(L, 486, VW, 120); K.horizon(486, L, R, 4);
  X.strokeStyle = 'rgba(0,0,0,.2)'; X.lineWidth = 3; for (let x = L - 40; x < R; x += 90) { X.beginPath(); X.moveTo(x, 488); X.lineTo(x - 40, 600); X.stroke(); }
  // window (the moon lives inside it)
  const WN = K.rrP(322, 70, 156, 150, 12); K.cel(WN, '#a5622c', '#7a4620', 4, 4, 5); K.rr(336, 84, 128, 122, 6); K.ink(null, 3); X.save(); K.rr(336, 84, 128, 122, 6); X.clip(); X.fillStyle = K.vg(84, 206, [[0, '#1d1840'], [1, '#3d3480']]); X.fillRect(336, 84, 128, 122); for (let i = 0; i < 9; i++) { X.fillStyle = 'rgba(255,255,255,.8)'; X.fillRect(342 + K.hash(i) * 116, 90 + K.hash(i + 8) * 70, 2.5, 2.5); } X.restore();
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(400, 84); X.lineTo(400, 206); X.moveTo(336, 145); X.lineTo(464, 145); X.stroke();
  for (const sx of [-1, 1]) { const cx = 400 + sx * 96; X.beginPath(); X.moveTo(cx - sx * 30, 64); X.quadraticCurveTo(cx + sx * 6, 130, cx - sx * 4, 236); X.lineTo(cx + sx * 40, 236); X.quadraticCurveTo(cx + sx * 48, 130, cx + sx * 22, 64); X.closePath(); K.ink('#ff7aa8', 4); X.strokeStyle = 'rgba(180,40,90,.5)'; X.lineWidth = 3; X.beginPath(); X.moveTo(cx + sx * 8, 80); X.quadraticCurveTo(cx + sx * 16, 150, cx + sx * 12, 230); X.stroke(); }
  // rug
  K.el(400, 540, 300, 36); K.ink('#e8434f', 4); K.el(400, 540, 250, 24); X.strokeStyle = '#ffd23f'; X.lineWidth = 4; X.stroke();
  // nightstand + stool
  const NS = K.rrP(36, 446, 154, 92, 10); K.cel(NS, '#d9944f', '#a5622c', 6, 5, 4); K.rr(56, 470, 114, 34, 6); K.ink(null, 3); X.beginPath(); X.arc(113, 487, 5, 0, 7); K.ink('#ffd23f', 2);
  K.rr(640, 508, 90, 24, 8); K.ink('#d9944f', 4);
  // floor lamp stand
  K.line([[690, 340], [690, 486]], 9, '#8f9cb3'); K.el(690, 488, 34, 8); K.ink('#6d7690', 3);
  // the bed frame behind Caos
  const HB = K.rrP(222, 246, 356, 252, 26); K.cel(HB, '#a5622c', '#7a4620', 8, 6, 5);
}
function swSleep(sp) {
  const items = [
    { k: 'alarm', x: 110, y: 410, r: 55, on: true },
    { k: 'lamp', x: 690, y: 300, r: 60, on: true },
    { k: 'fly', x: 400, y: 200, r: 38, on: true, a: Math.random() * 6 }
  ];
  if (sp > 1.5) items.push({ k: 'phone', x: 680, y: 480, r: 48, on: true });
  let z = 1, c = 0, rt = 0;
  const O = SWK.outro();
  const g = {
    wide: true, cmd: 'SHHH!', hint: 'CLICK EVERY NOISY THING', thint: 'TAP EVERY NOISY THING', dur: 5,
    down(p) {
      if (g.result) return;
      let best = null, bd = 1e9;
      for (const o of items) { const d = Math.hypot(p.x - o.x, p.y - o.y); if (o.on && d < o.r + 12 && d < bd) { best = o; bd = d; } }
      if (!best) return;
      best.on = false; (best.k === 'fly' ? sfx.hit : sfx.pop)(); burst(best.x, best.y, '#FFE14D', 8); ring(best.x, best.y, '#fff', 50, .3); floatText('SHH!', best.x, best.y - 40, '#fff', 26);
      if (items.every(o => !o.on)) { g.result = 'win'; sfx.coin(); sfx.sparkle(); floatText('NICE!', 400, 200, '#5CFF7A', 50); }
    },
    update(dt) {
      O.mark(g);
      c += dt; if (g.result) return;
      const n = items.filter(o => o.on).length; z -= n * .14 * sp * dt;
      if (n && (rt -= dt) < 0) { rt = .45; snd(1800, .04, 'square', .015); snd(1500, .04, 'square', .015, .08); }
      const f = items[2]; if (f.on) { f.a += (Math.random() - .5) * 8 * dt; f.x += Math.cos(f.a + c * 3) * 190 * dt; f.y += Math.sin(f.a * 1.3 + c * 4) * 150 * dt; f.x = Math.max(250 - OX * .5, Math.min(550 + OX * .5, f.x)); f.y = Math.max(110, Math.min(280, f.y)); }
      if (z <= 0) { z = 0; g.result = 'lose'; swLose(); sfx.buzz(); floatText('WOKE UP!', 400, 200, '#ff4d4d', 44); }
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', awake = g.result === 'lose', L = -OX, R = W + OX;
      X.drawImage(K.baked('sl', slBake), -OX, 0);
      const lamp = items[1], al = items[0], fl = items[2], ph = items[3], half = !g.result && z < .45;
      // the moon in the window peeks in, sleepy
      X.save(); K.rr(336, 84, 128, 122, 6); X.clip(); X.beginPath(); X.arc(420, 130, 30, 0, 7); K.ink('#fff3b0', 3.5); X.fillStyle = 'rgba(200,170,70,.4)'; K.el(410, 140, 6, 6); X.fill(); K.el(430, 122, 4, 4); X.fill();
      K.eye(410, 130, 5.5, won || !awake && !half ? 'sleep' : 'idle', [.5, .5], now, 1); K.eye(430, 130, 5.5, won || !awake && !half ? 'sleep' : 'idle', [.5, .5], now, 2); X.restore();
      // the bed + Caos
      const PIL = K.rrP(304, 280, 192, 90, 32); K.cel(PIL, '#fff', '#d5dae6', 6, 5, 4);
      const jolt = awake ? -K.outBack(ot / .2) * 22 : 0;
      K.shade(400, 492, 200, 12, .25);
      const sc = won ? 1 + Math.sin(now * 1.6) * .02 : half ? 1 + Math.sin(now * 20) * .01 : 1 + Math.sin(now * 1.6) * .015;
      X.save(); X.translate(400, 380 + jolt); X.scale(1, sc); X.translate(-400, -380);
      if (awake) { X.save(); X.translate(400, 380); K.arms(11, -1.2, 1.2, 1); X.restore(); } else { X.save(); X.translate(400, 380); K.arms(11, won ? 2.6 : 2.8, won ? -2.6 : -2.8, .5); X.restore(); }
      caos(400, 380, 11, { mood: awake ? null : half ? null : 'happy' });
      X.restore();
      X.save(); X.translate(0, jolt);
      if (!awake && half) { X.strokeStyle = '#e8434f'; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(342, 288); X.lineTo(372, 300); X.moveTo(458, 288); X.lineTo(428, 300); X.stroke(); K.sweat(472, 310, 1.4, now); }
      if (awake) { X.strokeStyle = '#e8434f'; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath(); X.moveTo(340, 286); X.lineTo(376, 304); X.moveTo(460, 286); X.lineTo(424, 304); X.stroke(); }
      // the nightcap with a pom-pom
      const capFlap = awake ? ot * 360 : 0, capRot = Math.sin(now * 1.6) * .03;
      X.save(); X.translate(400 - capFlap * .3, 282 - capFlap * .5); X.rotate(capRot - (awake ? ot * 3 : 0)); X.beginPath(); X.moveTo(-58, 4); X.quadraticCurveTo(-30, -34, 20, -26); X.quadraticCurveTo(52, -20, 66, 12); X.lineTo(60, 14); X.lineTo(-58, 12); X.closePath(); K.ink('#4DB8FF', 4); K.rr(-62, 4, 124, 16, 8); K.ink('#fff', 3.5); X.beginPath(); X.arc(70, 18, 11, 0, 7); K.ink('#fff', 3); X.restore();
      // snore bubble
      if (!awake) { const br = (won ? 9 : 6 + (Math.sin(now * 1.4) * .5 + .5) * (half ? 8 : 18)); X.beginPath(); X.arc(472, 352, br, 0, 7); X.fillStyle = 'rgba(191,239,255,.7)'; X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.stroke(); X.fillStyle = 'rgba(255,255,255,.8)'; K.el(472 - br * .35, 352 - br * .35, br * .25, br * .15, -.6); X.fill(); }
      X.restore();
      // the quilt in front
      const QU = K.rrP(226, 396, 348, 104, 24); K.cel(QU, '#7C4DFF', '#5a32c9', 9, 8, 5);
      X.save(); X.clip(QU); X.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 5; i++) { K.rr(240 + i * 70, 410, 36, 80, 12); X.fill(); } X.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) { K.star(275 + i * 82, 452 + (i % 2) * 14, 9, 4, 5, .3, '#ffd23f', 0); } X.restore(); K.glint(QU, 280, 410, 60, 6, .35, 0);
      // the lamp: the light is on until you shush it
      if (lamp.on) { X.fillStyle = 'rgba(255,225,77,.2)'; X.beginPath(); X.moveTo(662, 330); X.lineTo(718, 330); X.lineTo(850, 520); X.lineTo(480, 520); X.fill(); }
      X.beginPath(); X.moveTo(646, 340); X.lineTo(734, 340); X.lineTo(712, 266); X.lineTo(668, 266); X.closePath(); K.ink(lamp.on ? '#FFE14D' : '#8a8a60', 4); X.fillStyle = 'rgba(255,255,255,.4)'; K.el(682, 296, 6, 20, .1); X.fill();
      if (lamp.on) { const lm = Math.sin(now * 3) > .96 ? 'panic' : 'idle'; K.eye(678, 310, 5, lm, [-.8, .5], now, 1); K.eye(702, 310, 5, lm, [-.8, .5], now, 2); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.arc(690, 322, 6, 0, Math.PI); X.stroke(); } else { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(678, 312, 5, .3, Math.PI - .3); X.arc(702, 312, 5, .3, Math.PI - .3); X.stroke(); }
      // the alarm clock yells; once shushed it dozes
      const sh = al.on ? Math.sin(now * 60) * 4 : 0;
      X.save(); X.translate(al.x + sh, al.y);
      for (const sx of [-1, 1]) { X.save(); X.translate(sx * 30, -38); X.rotate(sx * .5); X.beginPath(); X.arc(0, 0, 14, Math.PI, 0); K.ink('#FFD23F', 3.5); X.restore(); }
      const AL = K.elP(0, 0, 42, 42); K.cel(AL, al.on ? '#E8433A' : '#b9605b', al.on ? '#a8282a' : '#7a3a3a', 6, 5, 5); K.el(0, 2, 30, 30); K.ink('#fff', 3);
      K.eye(-11, -4, 6.5, al.on ? 'panic' : 'sleep', [0, .2], now, 3); K.eye(11, -4, 6.5, al.on ? 'panic' : 'sleep', [0, .2], now, 4);
      if (al.on) { K.el(0, 14, 9, 7 + Math.abs(Math.sin(now * 40)) * 4); K.ink(INK, 1.5); } else { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(-6, 15); X.lineTo(6, 15); X.stroke(); K.zee(30, -44, .7, .9); }
      X.restore();
      if (al.on) { K.badge('RIIING!', al.x + 6, al.y - 92, 22, '#FFE14D', INK, 1, Math.sin(now * 30) * .05); }
      // the phone
      if (ph) { const s2 = ph.on ? Math.sin(now * 70) * 4 : 0; const PH = K.rrP(-22, -38, 44, 76, 10); X.save(); X.translate(ph.x + s2, ph.y); K.cel(PH, ph.on ? '#4DB8FF' : '#58687a', ph.on ? '#2a8fcb' : '#3a4658', 4, 4, 5); K.rr(-17, -31, 34, 58, 5); K.ink(ph.on ? '#fff3a0' : '#2b3340', 2); if (ph.on) { for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(-8 + i * 8, 0, 3 + Math.sin(now * 12 + i) * 1.5, 0, 7); X.fillStyle = INK; X.fill(); } } X.restore(); if (ph.on) K.badge('BZZ', ph.x - 40, ph.y - 62, 18, '#fff', INK, 1, -.1); }
      // the fly
      if (fl.on) { const fx = fl.x, fy = fl.y, wf = Math.sin(now * 90) * .5; X.fillStyle = 'rgba(255,255,255,.85)'; X.strokeStyle = INK; X.lineWidth = 2; for (const sx of [-1, 1]) { K.el(fx + sx * 14, fy - 14, 13, 7, sx * (-.5 + wf)); X.fill(); X.stroke(); } const FB = K.elP(0, 0, 14, 12); X.save(); X.translate(fx, fy); K.cel(FB, '#3b3550', '#14101c', 3, 3, 3); X.fillStyle = '#ff4d5e'; X.beginPath(); X.arc(-5, -3, 4, 0, 7); X.arc(5, -3, 4, 0, 7); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(-4, -3, 1.6, 0, 7); X.arc(6, -3, 1.6, 0, 7); X.fill(); X.restore(); K.badge('bzz', fx + 40, fy - 24, 16, '#fff', INK, 1, .1); }
      if (!awake) { for (let i = 0; i < 3; i++) { const k = ((now * .5 + i / 3) % 1); K.zee(470 + k * 80 + i * 6, 290 - k * 130, (.8 + i * .3) * (won ? 1.3 : 1), 1 - k); } }
      else K.badge('!', 400, 180, 60, '#ff4d5e', '#fff', K.outBack(ot / .2), 0);
      if (won || !lamp.on) { X.fillStyle = 'rgba(10,8,40,' + (won ? .16 : .1) + ')'; X.fillRect(L, 0, VW, 600); }
      if (won) for (let i = 0; i < 3; i++) K.heart(330 + i * 70 + Math.sin(ot * 4 + i) * 10, 250 - ot * 50 - (i % 2) * 20, 1.2, Math.max(0, 1 - ot * .9));
      // the sleep meter: a pill with a moon
      K.pillBar(250, 64, 300, 24, z, swMix('#ff4d4d', '#5CFF7A', z), swMix('#ff4d4d', '#5CFF7A', z));
      X.beginPath(); X.arc(232, 76, 15, 0, 7); K.ink('#fff3b0', 3); X.fillStyle = '#2b2d6e'; K.el(240, 72, 12, 12); X.fill(); txt('Zzz', 584, 76, 22, '#fff', 'left');
      vignette(.2);
    }
  };
  return g;
}

/* ── 10 CONNECT: link the stars in order (a hilltop campsite, a telescope, the constellation wakes up) ── */
function stsBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 560, [[0, '#0b0726'], [.55, '#1c0e46'], [1, '#2a2a7a']]); X.fillRect(L, 0, VW, 560);
  X.beginPath(); X.arc(R - 140, 120, 34, 0, K.TAU); K.ink('#fff3b0', 4); X.fillStyle = '#1c0e46'; K.el(R - 124, 112, 30, 30); X.fill();
  K.hills(L, R, 520, 70, .005, 3, '#252a7a', '#4a52b0', 3, 600); K.hills(L, R, 560, 40, .009, 1, '#1a2160', '#3a42a0', 3, 610);
  X.fillStyle = '#12184a'; X.fillRect(L, 548, VW, 60); K.horizon(548, L, R, 4);
  // the tent
  X.beginPath(); X.moveTo(L + 200, 548); X.lineTo(L + 262, 490); X.lineTo(L + 324, 548); X.closePath(); K.ink('#e8434f', 4); X.beginPath(); X.moveTo(L + 262, 490); X.lineTo(L + 246, 548); X.lineTo(L + 278, 548); X.closePath(); K.ink('#7a1f2e', 3);
}
function swStars(sp) {
  const n = sp > 1.6 ? 5 : 4, pts = [];
  for (let tries = 0; pts.length < n && tries < 400; tries++) {
    const q = { x: 100 - OX * .7 + Math.random() * (600 + OX * 1.4), y: 140 + Math.random() * 360 };
    if (pts.every(p => Math.hypot(p.x - q.x, p.y - q.y) > (tries > 300 ? 90 : 160))) pts.push(q);
  }
  while (pts.length < n) pts.push({ x: 100 + pts.length * 100, y: 300 });
  let next = 0, wob = 0, cur = { x: 0, y: 0 }, started = false;
  const O = SWK.outro();
  const move = p => {
    cur = p; started = true; if (g.result || next >= n) return;
    for (let i = 0; i < n; i++) {
      if (Math.hypot(p.x - pts[i].x, p.y - pts[i].y) < 54) {
        if (i === next) { next++; sfx.blip(next * 2); burst(pts[i].x, pts[i].y, '#FFE14D', 8); ring(pts[i].x, pts[i].y, '#fff', 60, .3); if (next === n) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(400, 300, 30); floatText('NICE!', 400, 300, '#FFE14D', 54); } }
        else if (i > next) { if (wob <= 0) sfx.miss(); wob = .25; }
      }
    }
  };
  const g = {
    wide: true, cmd: 'CONNECT!', hint: 'MOUSE OVER THE STARS 1, 2, 3...', thint: 'DRAG THROUGH THE STARS IN ORDER', dur: 7,
    move, update(dt) { O.mark(g); wob = Math.max(0, wob - dt); },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', L = -OX, R = W + OX;
      X.drawImage(K.baked('sts', stsBake), -OX, 0);
      for (let i = 0, ns = Math.round(30 * VW / W); i < ns; i++) { X.fillStyle = 'rgba(255,255,255,' + (.4 + .4 * Math.sin(now * 3 + i)) + ')'; X.fillRect((i * 97) % VW - OX, (i * 53) % 440, 3, 3); }
      { const k = (now * .22) % 1.6; if (k < .5) { const sx = 90 + k * 900 - OX, sy = 40 + k * 240; X.strokeStyle = 'rgba(255,255,255,' + (1 - k * 2) + ')'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(sx, sy); X.lineTo(sx - 46, sy - 14); X.stroke(); } }
      // camp: fire, Caos and the telescope
      const fxx = L + 392, fyy = 548;
      K.shade(fxx, fyy + 4, 40, 7, .35); for (const sx of [-1, 1]) K.line([[fxx + sx * 24, fyy + 2], [fxx - sx * 6, fyy - 10]], 6, '#8a5a34');
      for (let i = 0; i < 3; i++) { const fh = 34 - i * 8 + Math.sin(now * 11 + i * 2) * 6; X.beginPath(); X.moveTo(fxx - 16 + i * 4, fyy - 4); X.quadraticCurveTo(fxx - 18 + i * 8, fyy - fh, fxx + (i - 1) * 6, fyy - fh - 12); X.quadraticCurveTo(fxx + 18 - i * 4, fyy - fh * .5, fxx + 16 - i * 4, fyy - 4); X.closePath(); K.ink(['#ff7a3d', '#ffb347', '#ffe14d'][i], 3 - i * .5); }
      const cmx = L + 120, cfy = 546, ch = won ? Math.abs(Math.sin(ot * 9)) * 16 : 0;
      K.shade(cmx, cfy + 3, 40, 7, .3);
      K.line([[cmx + 70, cfy], [cmx + 88, cfy - 56]], 5, '#8f9cb3'); K.line([[cmx + 106, cfy], [cmx + 88, cfy - 56]], 5, '#8f9cb3'); K.line([[cmx + 88, cfy], [cmx + 88, cfy - 56]], 5, '#8f9cb3');
      X.save(); X.translate(cmx + 88, cfy - 60); X.rotate(-.9); K.rr(-12, -52, 24, 60, 8); K.ink('#e8434f', 3.5); K.rr(-9, -64, 18, 16, 5); K.ink('#cfd8e6', 3); X.restore();
      X.save(); X.translate(cmx, cfy - ch); K.arms(5.2, won ? -2.6 : -.2, won ? 2.6 : 1.0, 1); X.restore();
      caos(cmx, cfy - ch, 5.2, { mood: swSad(g) });
      // the constellation
      X.lineCap = 'round'; X.lineJoin = 'round';
      const path = () => { X.beginPath(); for (let i = 0; i < next; i++) X.lineTo(pts[i].x, pts[i].y); if (g.result === 'win') X.closePath(); };
      if (next > 0) {
        X.strokeStyle = INK; X.lineWidth = 14; path(); X.stroke(); X.strokeStyle = '#FFE14D'; X.lineWidth = 7; path(); X.stroke();
        if (!g.result && started) { X.beginPath(); X.moveTo(pts[next - 1].x, pts[next - 1].y); X.lineTo(cur.x, cur.y); X.strokeStyle = 'rgba(255,225,77,.5)'; X.lineWidth = 5; X.stroke(); }
      }
      if (won) { X.fillStyle = 'rgba(255,225,77,.3)'; path(); X.fill(); }
      X.lineCap = 'butt';
      pts.forEach((p, i) => {
        const done = i < next, sx = (i > next && wob > 0) ? Math.sin(now * 80) * 5 : 0;
        if (done) { X.fillStyle = 'rgba(255,225,77,.18)'; X.beginPath(); X.arc(p.x, p.y, 52 + Math.sin(now * 5 + i) * 4, 0, 7); X.fill(); }
        star(p.x + sx, p.y, 36 + (i === next ? Math.sin(now * 8) * 4 : 0), 17, 5, now * (done ? 1 : .3), done ? '#FFE14D' : '#fff', 4);
        txt(String(i + 1), p.x + sx, p.y + 2, 26, INK);
      });
      // the finished constellation wakes up and winks
      if (won) {
        let mx = 0, my = 0; for (const p of pts) { mx += p.x; my += p.y; } mx /= n; my /= n; const k = K.outBack(ot / .3), wink = Math.sin(now * 6) > .6;
        X.save(); X.translate(mx, my); X.scale(k, k); K.eye(-20, -8, 11, 'idle', [0, .4], now, 1); if (wink) { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(8, -8); X.lineTo(32, -8); X.stroke(); } else K.eye(20, -8, 11, 'idle', [0, .4], now, 2);
        X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.arc(0, 12, 20, .2, Math.PI - .2); X.stroke(); X.fillStyle = 'rgba(255,110,165,.7)'; K.el(-34, 12, 8, 5); X.fill(); K.el(34, 12, 8, 5); X.fill(); X.restore();
      }
      // the cursor is a little comet
      if (started && !g.result) { X.fillStyle = 'rgba(255,255,255,.25)'; X.beginPath(); X.arc(cur.x, cur.y, 16, 0, 7); X.fill(); X.beginPath(); X.arc(cur.x, cur.y, 7, 0, 7); K.ink('#fff', 2.5); }
      vignette(.2);
    }
  };
  return g;
}

/* ── 11 DRAW: wait for the "!" then click (a sunset duel under a torii gate against an onigiri samurai) ── */
function dwBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 470, [[0, '#ff7a5c'], [.5, '#ffb347'], [1, '#ffe09a']]); X.fillRect(L, 0, VW, 470);
  X.fillStyle = 'rgba(255,240,170,.14)'; for (const r of [150, 118]) { X.beginPath(); X.arc(400, 330, r, 0, K.TAU); X.fill(); }
  X.beginPath(); X.arc(400, 330, 90, 0, K.TAU); K.ink('#ff7a3d', 4); X.fillStyle = 'rgba(255,255,255,.35)'; K.el(366, 292, 28, 14, -.5); X.fill();
  X.beginPath(); X.moveTo(L - 90, 470); X.lineTo(L + 120, 286); X.lineTo(L + 150, 300); X.lineTo(L + 182, 282); X.lineTo(L + 400, 470); X.closePath(); X.fillStyle = '#d9a0e8'; X.fill(); X.strokeStyle = '#8f64b8'; X.lineWidth = 4; X.lineJoin = 'round'; X.stroke();
  X.beginPath(); X.moveTo(L + 120, 286); X.lineTo(L + 150, 300); X.lineTo(L + 182, 282); X.lineTo(L + 166, 316); X.lineTo(L + 144, 304); X.lineTo(L + 130, 320); X.closePath(); X.fillStyle = '#fff'; X.fill();
  X.fillStyle = K.vg(470, 600, [[0, '#E8B27A'], [1, '#B98042']]); X.fillRect(L, 470, VW, 140); K.horizon(471, L, R, 4);
  X.strokeStyle = 'rgba(122,70,32,.45)'; X.lineWidth = 3; for (let x = L; x < R; x += 80) { X.beginPath(); X.moveTo(x, 474); X.lineTo(x - 36, 600); X.stroke(); } for (const y of [510, 550]) { X.beginPath(); X.moveTo(L, y); X.lineTo(R, y); X.stroke(); }
  // torii gate
  for (const px of [338, 438]) { const P = K.rrP(px, 296, 24, 176, 6); K.cel(P, '#e8434f', '#a8282a', 5, 0, 4); }
  X.beginPath(); X.moveTo(300, 296); X.quadraticCurveTo(400, 280, 500, 296); X.lineTo(492, 282); X.quadraticCurveTo(400, 262, 308, 282); X.closePath(); K.ink('#2b2640', 4); K.rr(330, 316, 140, 12, 4); K.ink('#e8434f', 3.5);
  // bamboo at the edges
  for (const bx of [L + 24, L + 56, R - 30, R - 62]) { K.line([[bx, 472], [bx + 4, 30]], 12, '#4fa85a'); for (let j = 0; j < 7; j++) { X.fillStyle = INK; X.fillRect(bx - 8 + (j % 2) * .5, 440 - j * 62, 16, 5); } }
}
function dwRice(x, y, o) {
  const K = SWK, X = ctx, mood = o.mood, T = o.T;
  X.save(); X.translate(x, y);
  const BODY = K.P('M-70,0 C-82,-50 -44,-132 0,-164 C44,-132 82,-50 70,0 Z');
  for (const sx of [-1, 1]) { K.rr(sx * 32 - 16, -6, 32, 14, 6); K.ink('#2b2640', 3.5); }
  K.cel(BODY, '#fff', '#d5dae6', 8, 6, 5); K.glint(BODY, -30, -110, 14, 30, .5, -.3);
  X.save(); X.clip(BODY); X.fillStyle = '#2b2640'; X.fillRect(-90, -62, 180, 70); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(-90, -58, 180, 6); X.restore();
  X.save(); X.clip(BODY); X.fillStyle = '#e8434f'; X.fillRect(-90, -134, 180, 16); X.restore(); K.rr(-1, -134, 2, 16, 0);
  X.beginPath(); X.moveTo(56, -126); X.quadraticCurveTo(84, -122 + Math.sin(T * 6) * 6, 100, -108 + Math.sin(T * 6) * 8); X.strokeStyle = INK; X.lineWidth = 9; X.stroke(); X.strokeStyle = '#e8434f'; X.lineWidth = 4; X.stroke();
  const em = mood === 'calm' ? 'sleep' : mood === 'twitch' ? 'idle' : mood === 'fierce' ? 'panic' : mood === 'smug' ? 'happy' : 'dizzy';
  const lk = [-1, .2];
  if (mood === 'twitch') { K.eye(-18, -98, 8, 'sleep', lk, T, 0); K.eye(18, -98, 8, 'idle', lk, T, 1); K.sweat(40, -120, 1.2, T); }
  else if (mood === 'fierce') { for (const sx of [-1, 1]) { K.el(sx * 18, -98, 10, 10); K.ink('#fff', 3); X.fillStyle = '#e8434f'; X.fillRect(sx * 18 - 3, -106, 6, 16); } }
  else { K.eye(-18, -98, 8, em, lk, T, 0); K.eye(18, -98, 8, em, lk, T, 1); }
  X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath();
  if (mood === 'fierce') { X.moveTo(-34, -118); X.lineTo(-8, -108); X.moveTo(34, -118); X.lineTo(8, -108); } else if (mood === 'twitch') { X.moveTo(-32, -112); X.lineTo(-8, -112); X.moveTo(34, -122); X.lineTo(8, -112); } X.stroke();
  X.beginPath(); if (mood === 'fierce') { X.moveTo(-12, -80); X.lineTo(12, -80); } else if (mood === 'smug') { X.arc(0, -86, 12, .2, Math.PI - .2); } else { X.arc(0, -78, 8, Math.PI * 1.2, Math.PI * 1.8); } X.stroke();
  if (mood === 'smug') { X.fillStyle = 'rgba(255,110,140,.5)'; K.el(-34, -86, 8, 5); X.fill(); K.el(34, -86, 8, 5); X.fill(); }
  X.restore();
}
function swDraw(sp) {
  const rs = Math.sqrt(sp), t1 = (.8 + Math.random() * .5) / rs, fakeLen = .45 / rs, t2 = t1 + fakeLen + (.7 + Math.random() * .6) / rs, win = .62 / rs;
  let c = 0, slash = 0, early = false;
  const O = SWK.outro();
  const phase = () => c < t1 ? 0 : c < t1 + fakeLen ? 1 : c < t2 ? 0 : 2;
  const g = {
    wide: true, cmd: 'DRAW!', hint: 'CLICK ONLY WHEN YOU SEE "!"', thint: 'TAP ONLY WHEN YOU SEE "!"', dur: 5,
    key(e) { if (e.code === 'Space') fire(); }, down() { fire(); },
    update(dt) {
      O.mark(g);
      if (g.result) { slash = Math.max(0, slash - dt); return; }
      const o = c; c += dt;
      if (o < t1 && c >= t1) { sfx.blip(-7); sfx.click(); }
      if (o < t2 && c >= t2) { sfx.zap(); sfx.blip(12); shake(3, .12); }
      if (c > t2 + win) { g.result = 'lose'; swLose(); }
    }
  };
  function fire() {
    if (g.result) return;
    if (phase() === 2) { g.result = 'win'; slash = .4; sfx.whoosh(); sfx.hit(); sfx.coin(); shake(10, .25); burst(580, 380, '#fff', 16, 340); ring(580, 380, '#FFE14D', 120); floatText('+1', 400, 220, '#5CFF7A', 44); }
    else { g.result = 'lose'; early = true; swLose(); }
  }
  g.draw = function (t) {
    const K = SWK, X = ctx, ot = O.t(g), ph = phase(), lose = g.result === 'lose', won = g.result === 'win', L = -OX, R = W + OX;
    X.drawImage(K.baked('dw', dwBake), -OX, 0);
    // falling cherry petals
    for (let i = 0; i < 16; i++) { const px = (K.hash(i) * (VW + 100) + now * (18 + K.hash(i + 5) * 22) + Math.sin(now + i) * 20) % (VW + 100) - 50 - OX, py = (K.hash(i + 9) * 600 + now * (36 + K.hash(i + 2) * 30)) % 620 - 10; X.save(); X.translate(px, py); X.rotate(now * 2 + i); K.el(0, 0, 6, 3.4); X.fillStyle = '#ffb3d1'; X.fill(); X.strokeStyle = '#d9658c'; X.lineWidth = 1.5; X.stroke(); X.restore(); }
    // the samurai onigiri
    let fx = 580, mood = ph === 2 ? 'fierce' : ph === 1 ? 'twitch' : 'calm', sword = ph === 2 && !won;
    if (lose) { mood = 'smug'; sword = true; fx = early ? 580 : 580 - K.ease(ot / .15) * 430; }
    K.shade(fx, 474, 82, 12, .3);
    if (won) {
      const q = K.ease(ot / .45), x0 = 580, cutY = -82;
      for (const top of [true, false]) {
        X.save(); if (top) { X.translate(x0 + q * 56, 470 - q * 44); X.rotate(q * .55); X.translate(-x0, -470); } else { X.translate(0, q * 4); }
        X.beginPath(); if (top) { X.moveTo(x0 - 200, 470 + cutY + 28); X.lineTo(x0 + 200, 470 + cutY - 28); X.lineTo(x0 + 200, 0); X.lineTo(x0 - 200, 0); } else { X.moveTo(x0 - 200, 470 + cutY + 28); X.lineTo(x0 + 200, 470 + cutY - 28); X.lineTo(x0 + 200, 620); X.lineTo(x0 - 200, 620); } X.closePath(); X.clip();
        dwRice(x0, 470, { mood: top ? 'dizzy' : 'calm', T: now }); X.restore();
      }
      X.strokeStyle = '#fff'; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(x0 - 62, 470 + cutY + 22); X.lineTo(x0 + 62, 470 + cutY - 22); X.stroke();
      X.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { const k = Math.min(1, ot * 1.4); X.beginPath(); X.arc(x0 - 50 + i * 14 + Math.sin(i * 3) * 10, 470 + cutY + 20 + k * (30 + i * 4), 3.6, 0, 7); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.5; X.stroke(); }
    } else {
      dwRice(fx, 470, { mood, T: now });
      if (sword) { X.save(); X.translate(fx - 62, 470 - 88); K.rr(-120, -5, 126, 10, 4); K.ink('#e6ebf3', 2.5); K.rr(-2, -9, 10, 18, 3); K.ink('#ffd23f', 2.5); K.rr(6, -6, 34, 12, 5); K.ink('#2b2640', 2.5); X.restore(); }
    }
    // Caos, the other duellist: a headband, a sheathed katana at his hip
    let cx = 220, cy = 470, cm = swSad(g);
    if (won) cx = 220 + K.ease(ot / .15) * 440; if (lose) cx = 220 - K.ease(ot / .3) * 30;
    const cdy = lose ? -Math.abs(Math.sin(ot * 10)) * 4 : won ? -Math.abs(Math.sin(Math.max(0, ot - .3) * 9)) * 14 : 0;
    K.shade(cx, 472, 55, 10, .3);
    X.save(); X.translate(cx, cy + cdy); if (lose) X.rotate(-.25 * K.ease(ot / .3));
    K.arms(9, won ? -2.6 : -.35, won ? 2.6 : .7, 1);
    caos(0, 0, 9, { mood: cm });
    K.rr(-56, -80, 112, 12, 4); K.ink('#e8434f', 3); X.beginPath(); X.moveTo(-54, -76); X.quadraticCurveTo(-82, -68 + Math.sin(now * 6) * 8, -96, -52 + Math.sin(now * 6) * 12); X.strokeStyle = INK; X.lineWidth = 10; X.stroke(); X.strokeStyle = '#e8434f'; X.lineWidth = 4.5; X.stroke();
    if (!won) { K.rr(34, -48, 96, 12, 5); K.ink('#7a1f2e', 3); K.rr(30, -52, 16, 20, 4); K.ink('#fff', 3); X.beginPath(); X.arc(48, -42, 6, 0, 7); K.ink('#ffd23f', 2); }
    X.restore();
    if (ph === 0 && !g.result) { X.save(); X.translate(0, 0); for (const sx of [-1, 1]) K.sweat(cx + sx * 60, 400, 1.2, now + sx); X.restore(); }
    // the signals: calm dots, a '?' bubble (fake-out), a red '!' burst
    if (ph === 1 && !g.result) { K.rr(340, 90, 120, 110, 24); K.ink('#fff', 5); X.beginPath(); X.moveTo(380, 198); X.lineTo(400, 226); X.lineTo(412, 198); X.closePath(); K.ink('#fff', 4); K.rr(342, 92, 116, 104, 22); X.fillStyle = '#fff'; X.fill(); txt('?', 400, 146, 100, '#4DB8FF'); }
    if (ph === 2 && !g.result) { K.star(400, 160, 100, 70, 12, now * 3, '#ff4d4d', 6); txt('!', 400, 160, 110, '#fff'); }
    if (ph === 0 && !g.result) txt('...', 400, 150, 60, '#fff');
    if (slash > 0) { X.strokeStyle = 'rgba(255,255,255,' + Math.min(1, slash * 2.5) + ')'; X.lineWidth = 14; X.lineCap = 'round'; X.beginPath(); X.moveTo(260, 380); X.lineTo(620, 330); X.stroke(); X.lineWidth = 5; X.beginPath(); X.moveTo(280, 400); X.lineTo(600, 350); X.stroke(); }
    if (lose) K.badge(early ? 'TOO EARLY!' : 'TOO SLOW!', 400, 150, 48, '#ff4d5e', '#fff', K.outBack(ot / .25), -.04); else if (won) K.badge('CLEAN CUT!', 400, 150, 48, '#5CFF7A', INK, K.outBack(ot / .25), .04);
    if (won && ot > .15) for (let i = 0; i < 3; i++) K.heart(cx - 30 + i * 30, 360 - (ot - .15) * 50 - (i % 2) * 16, 1, Math.max(0, 1 - (ot - .15)));
    vignette(.2);
  };
  return g;
}

/* ── 12 PROTECT: shoot down meteors before they hit the flowers (a pink garden, flowers with faces, a gnome) ── */
function prBake() {
  const K = SWK, X = K.cx(), L = -OX, R = W + OX;
  X.fillStyle = K.vg(0, 500, [[0, '#ff9ec7'], [.55, '#ffc9e0'], [1, '#fff0f6']]); X.fillRect(L, 0, VW, 520);
  K.hills(L, R, 470, 80, .005, 2, '#ffc2e0', null); K.hills(L, R, 506, 34, .01, 5, '#a8e6a1', '#6cbf7a', 3, 530);
  for (let x = L - (L % 44) + 6; x < R; x += 44) { const P = K.rrP(x, 470, 26, 56, 8); K.cel(P, '#fff', '#d5dae6', 4, 3, 3); }
  X.fillStyle = INK; X.fillRect(L, 488, VW, 5); X.fillStyle = '#fff'; X.fillRect(L, 490, VW, 2);
  X.fillStyle = K.vg(524, 600, [[0, '#9be37f'], [1, '#5fb944']]); X.fillRect(L, 524, VW, 90); K.horizon(525, L, R, 5);
  for (let i = 0; i < 26; i++) { const tx = L + K.hash(i) * VW, ty = 540 + K.hash(i + 30) * 50; X.fillStyle = '#3f8f35'; X.fillRect(tx, ty, 2.5, 9); X.fillRect(tx + 5, ty + 2, 2.5, 7); X.fillRect(tx - 5, ty + 2, 2.5, 7); }
}
function swProtect(sp) {
  const rs = Math.sqrt(sp), nm = sp > 1.5 ? 5 : 4, sp1 = (sp > 1.5 ? .6 : .75) / rs, fall = 1.7 / rs, nf = 5 + 2 * Math.floor(OX / 140), fl = Array.from({ length: nf }, (_, i) => ({ x: 400 + (i - (nf - 1) / 2) * 140, hurt: false }));
  const mets = []; for (let i = 0; i < nm; i++) { const tx = fl[(Math.random() * nf) | 0].x; mets.push({ at: (.4 + i * sp1 * 1) , sx: tx + (Math.random() - .5) * 500, tx, alive: true, x: 0, y: -50, hit: false }); }
  let c = 0, killed = 0, swing = -9;
  const O = SWK.outro();
  const g = {
    wide: true, cmd: 'PROTECT!', hint: 'CLICK THE METEORS', thint: 'TAP THE METEORS', dur: 5, timeWin: true,
    down(p) {
      swing = now;
      if (g.result) return;
      let b = null, bd = 1e9;
      for (const m of mets) { if (!m.alive || c < m.at) continue; const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < 55 && d < bd) { b = m; bd = d; } }
      if (b) { b.alive = false; killed++; sfx.pop(); sfx.hit(); confetti(b.x, b.y, 10); burst(b.x, b.y, '#FF8A3D', 12); ring(b.x, b.y, '#fff', 60, .3); floatText('+1', b.x, b.y - 30, '#fff', 30); if (killed === nm) { g.result = 'win'; sfx.coin(); sfx.sparkle(); } }
      else sfx.click();
    },
    update(dt) {
      O.mark(g);
      c += dt; if (g.result) return;
      for (const m of mets) {
        if (!m.alive || c < m.at) continue;
        const k = (c - m.at) / fall; m.x = m.sx + (m.tx - m.sx) * k; m.y = -40 + k * 520;
        if (k >= 1) { m.alive = false; fl.find(f => f.x === m.tx).hurt = true; g.result = 'lose'; swLose(); sfx.splat(); shake(12, .35); burst(m.tx, 480, '#FF8A3D', 20, 340); ring(m.tx, 500, '#ff4d4d', 110); }
      }
    },
    draw(t) {
      const K = SWK, X = ctx, ot = O.t(g), won = g.result === 'win', lost = g.result === 'lose', L = -OX, R = W + OX;
      X.drawImage(K.baked('pr', prBake), -OX, 0);
      K.sun(130 - OX * .3, 200, now); for (let i = 0; i < 3; i++) K.cloud(((now * (5 + i * 3) + i * 330) % (VW + 200)) - 140 - OX, 100 + i * 36, .9 + (i % 2) * .2, '#fff0f8');
      // the gnome watches the sky (and covers his eyes when it goes wrong)
      const gx = R - 40, gy = 534, near = mets.filter(m => m.alive && c >= m.at).sort((a, b) => b.y - a.y)[0], gl = near ? [(near.x - gx) / 400, (near.y - gy) / 400] : [0, -.3];
      K.shade(gx, gy + 2, 30, 6, .3); const GB = K.rrP(-20, -54, 40, 54, 14); X.save(); X.translate(gx, gy); K.cel(GB, '#4DB8FF', '#2a8fcb', 4, 4, 4); X.beginPath(); X.moveTo(-26, -66); X.lineTo(0, -122); X.lineTo(26, -66); X.closePath(); K.ink('#e8434f', 3.5);
      K.el(0, -58, 18, 16); K.ink('#ffcba4', 3); const gm = lost ? 'panic' : won ? 'happy' : 'idle'; K.eye(-7, -62, 5.5, gm, gl, now, 5); K.eye(7, -62, 5.5, gm, gl, now, 6);
      X.beginPath(); X.moveTo(-16, -50); X.quadraticCurveTo(0, -20, 16, -50); X.quadraticCurveTo(0, -42, -16, -50); X.closePath(); K.ink('#fff', 3); X.restore();
      // flowers with faces
      const threat = (f) => { let k = 0; for (const m of mets) if (m.alive && c >= m.at && m.tx === f.x) k = Math.max(k, (c - m.at) / fall); return k; };
      for (const f of fl) {
        const dy = f.hurt ? 14 : 0, tk = threat(f), fm = f.hurt ? 'bonk' : won ? 'happy' : tk > .45 ? 'panic' : 'idle';
        K.shade(f.x, 540, 34, 7, .25);
        K.line([[f.x, 540], [f.x, 470 + dy]], 5, '#3aa34a'); X.save(); X.translate(f.x, 518); for (const sx of [-1, 1]) { X.save(); X.rotate(sx * .9); X.beginPath(); X.ellipse(sx * 14, -4, 14, 6, 0, 0, 7); K.ink('#5CC24A', 2.5); X.restore(); } X.restore();
        const bob = !f.hurt && !won ? Math.sin(now * 2 + f.x) * 2 : 0, fy2 = 456 + dy + bob;
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + (won ? now * .5 : 0); X.beginPath(); X.arc(f.x + Math.cos(a) * 24, fy2 + Math.sin(a) * 24, 15, 0, 7); K.ink(f.hurt ? '#9a8a99' : '#FF4D9E', 3); }
        const FC = K.elP(f.x, fy2, 19, 19); K.cel(FC, f.hurt ? '#a7a7a0' : '#FFE14D', f.hurt ? '#777' : '#e0a82a', 2, 2, 3.5);
        X.save(); X.translate(f.x, fy2); X.scale(.62, .62); K.eye(-10, -3, 7, fm, [0, -.6], now, f.x); K.eye(10, -3, 7, fm, [0, -.6], now, f.x + 1);
        X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); if (won) X.arc(0, 6, 8, .2, Math.PI - .2); else if (f.hurt) X.arc(0, 14, 7, Math.PI * 1.2, Math.PI * 1.8); else if (tk > .45) K.el(0, 10, 4, 5); else X.arc(0, 6, 6, .3, Math.PI - .3); X.stroke(); X.restore();
        if (f.hurt) { for (let i = 0; i < 3; i++) { const k = ((ot * .8 + i / 3) % 1); K.puff(f.x + (i - 1) * 30, 524 - k * 60, 7 + k * 8, (1 - k) * .75, '#6d6a78'); } K.el(f.x, 540, 36, 9); X.fillStyle = 'rgba(40,24,20,.55)'; X.fill(); }
        else if (tk > .45) K.sweat(f.x + 26, fy2 - 20, 1.1, now);
        if (won) K.heart(f.x + 4, fy2 - 40 - ((ot * 40) % 30), .7, Math.max(0, 1 - ot * .7));
      }
      // meteors: fireballs with a scream
      for (const m of mets) {
        if (!m.alive || c < m.at) continue;
        const dx = (m.tx - m.sx) * .2; K.shade(m.tx + (m.x - m.tx) * .1, 536, 10 + (m.y + 40) / 520 * 24, 5, .2);
        X.beginPath(); X.moveTo(m.x - 18, m.y - 10); X.lineTo(m.x + 18, m.y - 10); X.lineTo(m.x - dx + Math.sin(now * 20) * 6, m.y - 118); X.closePath(); X.fillStyle = '#FFC93C'; X.fill(); X.beginPath(); X.moveTo(m.x - 9, m.y - 10); X.lineTo(m.x + 9, m.y - 10); X.lineTo(m.x - dx * .5, m.y - 66); X.closePath(); X.fillStyle = '#fff3a0'; X.fill();
        const MB = K.elP(0, 0, 27, 27); X.save(); X.translate(m.x, m.y); K.cel(MB, '#FF8A3D', '#c0501d', 5, 4, 4.5); K.glint(MB, -10, -10, 8, 4, .45, -.5);
        K.eye(-9, -4, 7, 'idle', [(m.tx - m.x) / 300, 1], now, 2); K.eye(9, -4, 7, 'idle', [(m.tx - m.x) / 300, 1], now, 3);
        X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(-17, -14); X.lineTo(-3, -9); X.moveTo(17, -14); X.lineTo(3, -9); X.stroke(); K.el(0, 12, 7, 5 + Math.abs(Math.sin(now * 14)) * 3); K.ink(INK, 1.5); X.restore();
      }
      // Caos on the left with a swatting arm that follows the cursor
      const cmx = -OX + 72, cfy = 535, aim = Math.atan2(mouse.x - cmx, -(mouse.y - (cfy - 28))), sw = Math.max(0, 1 - (now - swing) * 5), hop = won ? Math.abs(Math.sin(ot * 9)) * 14 : 0;
      K.shade(cmx, cfy + 3, 36, 7, .3);
      X.save(); X.translate(cmx, cfy - hop); K.arms(5, won ? -2.6 : -.3, won ? 2.6 : K.clamp(aim, -.4, 2.2) + sw * .7, 1); X.restore();
      caos(cmx, cfy - hop, 5, { mood: swSad(g) });
      if (lost) K.sweat(cmx + 40, cfy - 55, 1.2, now);
      vignette(.16);
    }
  };
  return g;
}
reg('sw_freeze', swFreeze, 'FREEZE');
reg('sw_pick', swPick, 'PICK');
reg('sw_run', swRun, 'RUN');
reg('sw_wanted', swWanted, 'ARREST');
reg('sw_fry', swFry, 'FRY');
reg('sw_fill', swFill, 'FILL');
reg('sw_limbo', swLimbo, 'DUCK');
reg('sw_steer', swSteer, 'STEER');
reg('sw_sleep', swSleep, 'SHHH');
reg('sw_stars', swStars, 'CONNECT');
reg('sw_draw', swDraw, 'DRAW');
reg('sw_protect', swProtect, 'PROTECT');
