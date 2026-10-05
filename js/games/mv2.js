'use strict';
/* Move It! wave 2 - pose and rhythm microgames: PUNCH, WAVE, CLAP, STAND.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/move/up}; g.result = 'win'|'lose'
   Art: the DUO look (docs/ART-STYLE.md). A local kit draws on X, which can be swapped for an offscreen canvas so the static scenes
   bake once. Nothing in the art calls Math.random (the seeded game RNG must stay untouched): decor uses a hash of the index. */
(function () {

const MAG = '#E0399B', YEL = '#FFE14D', MINT = '#5CFF7A', RED = '#ff4d4d';
const mvMood = (g) => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const mvLose = () => { sfx.miss(); sfx.thud(); shake(8, .25); };
const mvWin = (x, y) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 36); ring(x, y, '#fff', 110); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ───────────── drawing kit (a local copy of the DUO helpers) ───────────── */
const K = (() => {
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;
  const K = { TAU };
  K.use = () => { X = ctx; };
  K.cx = () => X;
  const ease = K.ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const inkP = K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  const cel = K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  const MP = {};
  K.P = d => MP[d] || (MP[d] = new Path2D(d));
  K.PR = (x, y, w, h, r) => { const k = x + ',' + y + ',' + w + ',' + h + ',' + r; if (!MP[k]) { const p = new Path2D(); p.roundRect(x, y, w, h, r); MP[k] = p; } return MP[k]; };
  K.PE = (x, y, rx, ry) => { const k = 'e' + x + ',' + y + ',' + rx + ',' + ry; if (!MP[k]) { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); MP[k] = p; } return MP[k]; };
  K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  const star = K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
  K.heart = (x, y, s, a = 1) => {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  };
  K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
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
  /* blocky Claude arms (hippo.js): origin at Claude's feet, call before claude() */
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
  K.cloud = (x, y, s, col = '#e4f5ff') => {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = col; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
  };
  /* gold "that's you" pill with a star and a pointer (the solo games have no YOU word) */
  K.tag = (x, y, col = '#FFE14D') => {
    X.beginPath(); X.moveTo(x - 8, y + 10); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 10); X.closePath(); ink(col, 3);
    rr(x - 22, y - 12, 44, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - 16, y - 9, 32, 6, 3); X.fill();
    star(x, y + 1, 8.5, 4, 5, -Math.PI / 2, '#fff', 2);
  };
  /* a rounded progress bar with a glossy fill; v 0..1 */
  K.bar = (x, y, w, h, v, col) => {
    rr(x, y, w, h, h / 2); ink('#fff', 3);
    if (v > .01) { X.save(); rr(x, y, w, h, h / 2); X.clip(); X.fillStyle = col; X.fillRect(x, y, w * clamp(v, 0, 1), h); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x, y + 2, w * clamp(v, 0, 1), h * .28); X.restore(); }
  };
  /* wooden sign plate with depth */
  K.sign = (x, y, w, h, r = 12) => {
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 8, w, h, r); X.fill();
    rr(x, y + 6, w, h, r); ink('#a5622c', 4); rr(x, y, w, h, r); ink('#d9944f', 4);
  };
  /* bake a static scene to an offscreen canvas the first time it is needed (VW wide, drawn with the OX offset) */
  const LAY = {};
  K.layer = (key, fn) => {
    const o = LAY[key]; if (o && o.vw === VW) return o.c;
    const c = document.createElement('canvas'); c.width = VW; c.height = H; const prev = X; X = c.getContext('2d');
    try { X.translate(OX, 0); fn(); } finally { X = prev; }
    LAY[key] = { vw: VW, c }; return c;
  };
  K.blit = c => { X.drawImage(c, -OX, 0); };
  return K;
})();

/* ───────────── sentient snacks (cel shaded, inked, with faces). kind: 0 hot dog, 1 donut, 2 banana, 3 sock, 4 toaster, 5 cheese.
   x,y = feet, s = scale. o: {w wobble, mood idle|angry|happy|sad|bonk|panic|sleep|dizzy, lx, ly look, arms 'up'|'droop', bare, noshadow, rot} ───────────── */
const SNK_FACE = [[0, -58, 7, 6.5, 14], [0, -34, 0, 10, 24], [1, -54, 7, 6, 14], [0, -62, 7, 5.5, 13], [0, -28, 12, 7, 15], [0, -30, 8, 5.5, 14]];
const SNK_ARM = [[22, 40], [30, 26], [14, 46], [18, 36], [34, 26], [24, 24]];
const SNK_LEG = [8, 10, 6, 8, 14, 10];
const SNK_COL = ['#F0B35A', '#FF8FD0', '#FFE14D', '#ffffff', '#C9D2E0', '#FFC93C'];
const SPRK = ['#FFE14D', '#5CFF7A', '#4DB8FF', '#fff', '#ff4d5e'];
function snk(kind, x, y, s, T, o) {
  o = o || {};
  const X = K.cx(), w = o.w == null ? 1 : o.w, ph = x * .013 + kind, mood = o.mood || 'idle', look = [o.lx || 0, o.ly || 0];
  const hop = o.bare ? 0 : Math.abs(Math.sin(T * 6 + ph)) * 12 * s * w, sway = o.bare ? 0 : Math.sin(T * 6 + ph) * .2 * w;
  if (!o.noshadow && !o.bare) shadow(x, y + 2, 26 * s, 6 * s, .25);
  X.save(); X.translate(x, y - hop); X.rotate(sway + (o.rot || 0)); X.scale(s, s * (1 + (o.bare ? 0 : Math.sin(T * 12 + ph) * .05 * w)));
  const lc = SNK_COL[kind];
  if (!o.bare) {
    const [ax, ay] = SNK_ARM[kind], up = o.arms === 'up', dr = o.arms === 'droop';
    for (const dir of [-1, 1]) {
      const sw = Math.sin(T * 9 + ph + dir) * w, bx = dir * ax;
      let ex = bx + dir * 26, ey = -ay - 26 + sw * 22, cx = bx + dir * 16, cy = -ay - 12 + sw * 14;
      if (up) { ex = bx + dir * 16; ey = -ay - 46 + sw * 8; cx = bx + dir * 20; cy = -ay - 14; }
      else if (dr) { ex = bx + dir * 8; ey = -ay + 20; cx = bx + dir * 14; cy = -ay + 6; }
      X.lineCap = 'round'; X.beginPath(); X.moveTo(bx, -ay); X.quadraticCurveTo(cx, cy, ex, ey); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = kind === 3 ? '#cfd3ee' : lc; X.stroke();
      X.beginPath(); X.arc(ex, ey, 6.2, 0, K.TAU); K.ink('#fff', 2.5);
    }
    const lw = SNK_LEG[kind];
    for (const d of [-1, 1]) {
      const fx = d * lw + Math.sin(T * 12 + ph + d) * 6 * w;
      X.beginPath(); X.moveTo(d * lw, -8); X.lineTo(fx, 6); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = kind === 3 ? '#cfd3ee' : lc; X.stroke();
      K.el(fx + d * 3, 7, 8, 4.6); K.ink('#e8434f', 2.5);
    }
  }
  if (kind === 0) {
    K.cel(K.PR(-24, -72, 48, 72, 24), '#F0B35A', '#c98a3c', 5, 4, 4);
    const sau = K.PR(-16, -80, 32, 84, 16); K.cel(sau, '#E0402F', '#b82a20', 5, 4, 4); K.glint(sau, -8, -64, 3.4, 12, .45, .1);
    X.strokeStyle = '#FFE14D'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(-12, -30); X.bezierCurveTo(-4, -38, 2, -22, 12, -32); X.stroke();
  } else if (kind === 1) {
    const b = K.PE(0, -34, 35, 35); K.cel(b, '#f2b36b', '#c98a3c', 4, 4, 4);
    const ic = K.PE(0, -37, 30, 29); K.cel(ic, '#FF8FD0', '#d85fa0', 4, 4, 3);
    X.save(); X.clip(ic);
    for (let i = 0; i < 9; i++) { const a = i * .7 + .3, rx = Math.cos(a) * 22, ry = -37 + Math.sin(a) * 21; X.save(); X.translate(rx, ry); X.rotate(a * 3); X.fillStyle = SPRK[i % 5]; K.rr(-4, -1.6, 8, 3.2, 1.6); X.fill(); X.restore(); }
    X.restore(); K.glint(ic, -14, -52, 7, 4, .5, -.5);
    K.el(0, -34, 13, 13); K.ink('#3a1850', 3);
  } else if (kind === 2) {
    const b = K.P('M-8 4 C-44 -30 -22 -86 18 -84 C2 -62 6 -22 14 4 Z'); K.cel(b, '#FFE14D', '#e0b020', 5, 3, 4); K.glint(b, -14, -62, 3, 14, .5, .3);
    K.el(18, -85, 4, 3); K.ink('#6b4a2a', 2);
  } else if (kind === 3) {
    const b = K.P('M-18 -86 L14 -86 L14 -36 Q40 -10 22 4 L-24 4 Q-26 -20 -18 -40 Z'); K.cel(b, '#ffffff', '#cfd3ee', 5, 3, 4);
    X.save(); X.clip(b); X.fillStyle = '#FF3EA5'; X.fillRect(-24, -86, 44, 11); X.fillRect(-24, -20, 60, 6); X.restore();
  } else if (kind === 4) {
    const pop = Math.max(0, Math.sin(T * 6 + ph)) * 18 * (o.bare ? 0 : 1);
    K.cel(K.PR(-17, -72 - pop, 34, 36, 8), '#F2D18A', '#d9a85a', 3, 3, 3);
    const b = K.PR(-32, -54, 64, 54, 12); K.cel(b, '#C9D2E0', '#8f9cb3', 5, 4, 4); K.glint(b, -18, -42, 9, 4, .5, -.2);
    K.rr(-24, -58, 48, 10, 5); K.ink('#3b3550', 3);
    K.rr(34, -40, 8, 16, 3); K.ink('#ff4d5e', 2.5);
  } else {
    const b = K.P('M-36 2 L-4 -62 Q0 -69 4 -62 L36 2 Z'); K.cel(b, '#FFC93C', '#e09a10', 6, 3, 4); K.glint(b, -6, -42, 4, 14, .45, .35);
    X.save(); X.clip(b); X.fillStyle = '#d98e0c'; for (const h of [[-14, -14, 5], [14, -10, 4], [8, -44, 3.5]]) { K.el(h[0], h[1], h[2], h[2] * .85); X.fill(); } X.restore();
  }
  /* face */
  const [fcx, fcy, sp, r, md] = SNK_FACE[kind], em = mood === 'angry' || mood === 'sad' ? 'idle' : mood;
  if (sp === 0) K.eye(fcx, fcy, r, em, look, T, 0);
  else { K.eye(fcx - sp, fcy, r, em, look, T, 0); K.eye(fcx + sp, fcy, r, em, look, T, 1); }
  if (mood === 'angry' || mood === 'sad') {
    X.strokeStyle = INK; X.lineWidth = 3.6; X.lineCap = 'round'; X.beginPath();
    const d = mood === 'angry' ? 1 : -1, q = sp === 0 ? r * .6 : sp;
    X.moveTo(fcx - q - r, fcy - r * (1.7 + .5 * d)); X.lineTo(fcx - q + r * .9, fcy - r * (1.7 - .6 * d));
    if (sp) { X.moveTo(fcx + q + r, fcy - r * (1.7 + .5 * d)); X.lineTo(fcx + q - r * .9, fcy - r * (1.7 - .6 * d)); } X.stroke();
  }
  const my = fcy + md;
  X.strokeStyle = INK; X.lineWidth = 3.6; X.lineCap = 'round'; X.lineJoin = 'round';
  if (mood === 'happy') { X.beginPath(); X.moveTo(fcx - 7, my - 3); X.quadraticCurveTo(fcx, my + 12, fcx + 7, my - 3); X.closePath(); K.ink('#8a1f3d', 2.5); }
  else if (mood === 'panic') { K.el(fcx, my + 1, 4.6, 6); K.ink('#8a1f3d', 2.5); }
  else if (mood === 'angry' || mood === 'sad') { X.beginPath(); X.arc(fcx, my + 6, 6, Math.PI * 1.2, Math.PI * 1.8); X.stroke(); if (mood === 'angry') { X.fillStyle = '#fff'; X.fillRect(fcx - 3, my - .5, 6, 3); } }
  else if (mood === 'bonk' || mood === 'dizzy') { X.beginPath(); X.moveTo(fcx - 7, my); X.lineTo(fcx - 3, my + 3); X.lineTo(fcx + 1, my - 1); X.lineTo(fcx + 5, my + 3); X.lineTo(fcx + 8, my); X.stroke(); }
  else { X.beginPath(); X.moveTo(fcx - 4, my); X.lineTo(fcx + 4, my); X.stroke(); }
  if (mood === 'happy') { X.fillStyle = 'rgba(255,110,165,.6)'; K.el(fcx - sp - r * 1.1, fcy + r * 1.3, r * .7, r * .45); X.fill(); K.el(fcx + sp + r * 1.1, fcy + r * 1.3, r * .7, r * .45); X.fill(); }
  X.restore();
}
/* a rows of snacks across the whole screen (step 96, every other one nudged). ko picks which snack is which */
function crowd(y, T, w, s, off, ko, lx, ly, mood, arms) {
  const step = 96, m = Math.ceil(OX / step);
  for (let i = -m; i < 9 + m; i++) snk(((i + ko) % 6 + 12) % 6, 30 + i * step + off + (i & 1) * 14, y + ((i & 1) ? 10 : 0), s, T, { w, lx, ly, mood, arms });
}
/* Claude's pixel body is 12u wide: a few cosmetic extras drawn over it (u = scale, x,y = feet) */
function blush(x, y, u, a) { const X = K.cx(); X.fillStyle = `rgba(255,110,165,${a})`; K.rr(x - 5.9 * u, y - 4.6 * u, 1.8 * u, 1 * u, u * .4); X.fill(); K.rr(x + 4.1 * u, y - 4.6 * u, 1.8 * u, 1 * u, u * .4); X.fill(); }
/* round white cartoon glove (a clapping / waving hand), local coords at the glove centre */
function hand(x, y, r, rot, fingers) {
  const X = K.cx(); X.save(); X.translate(x, y); X.rotate(rot);
  const p = K.PE(0, 0, r, r * .95); K.cel(p, '#ffffff', '#cdd3ee', r * .2, r * .2, 3.5); K.glint(p, -r * .3, -r * .35, r * .3, r * .18, .7, -.5);
  if (fingers) { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (let i = -1; i <= 1; i++) { X.moveTo(i * r * .36, -r * .2); X.lineTo(i * r * .36, -r * .78); } X.stroke(); }
  X.restore();
}
/* little burst star used for impacts (kit star, drawn on the live canvas) */
function pow(x, y, r, rot, col) { K.star(x, y, r, r * .45, 8, rot, col, 3); }

/* ───────────── 1 PUNCH: a dojo with three holes in the wall. Snacks pop out; punch the side they pop from ───────────── */
function dojoBg() {
  const X = K.cx(), L = -OX;
  const g = X.createLinearGradient(0, 0, 0, 470); g.addColorStop(0, '#6fcfbf'); g.addColorStop(1, '#c8f4e4'); X.fillStyle = g; X.fillRect(L, 0, VW, 470);
  for (let x = Math.floor(L / 64) * 64; x < W + OX + 64; x += 64) { X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(x, 0, 30, 470); X.fillStyle = 'rgba(30,120,110,.12)'; X.fillRect(x + 30, 0, 3, 470); }
  /* the three holes the snacks come out of: two arches and a high shelf */
  for (const ax of [130, 670]) {
    K.inkP(K.P(`M${ax - 58} 452 V 358 A 58 58 0 0 1 ${ax + 58} 358 V 452 Z`), '#a5622c', 5);
    K.inkP(K.P(`M${ax - 45} 446 V 360 A 45 45 0 0 1 ${ax + 45} 360 V 446 Z`), '#2b1a3a', 3);
    X.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 6; i++) { K.el(ax - 36 + K.hash(ax + i) * 72, 340 + K.hash(ax * 3 + i) * 96, 1.6, 1.6); X.fill(); }
    K.rr(ax - 68, 444, 136, 16, 6); K.ink('#d9944f', 4);
  }
  K.rr(316, 160, 168, 16, 6); K.ink('#d9944f', 4);
  for (const bx of [338, 462]) { X.beginPath(); X.moveTo(bx - 10, 176); X.lineTo(bx + 10, 176); X.lineTo(bx, 198); X.closePath(); K.ink('#a5622c', 3); }
  for (const [jx, col, lid] of [[330, '#ff8fb8', '#f7d297'], [470, '#8fe0a0', '#f7d297']]) {
    const p = K.PR(jx - 14, 128, 28, 32, 8); K.cel(p, col, 'rgba(0,0,0,.25)', 4, 3, 3); K.glint(p, jx - 6, 138, 3, 8, .55, .2);
    K.rr(jx - 11, 120, 22, 10, 4); K.ink(lid, 3);
  }
  /* windows (their clouds move in the live pass) */
  for (const wx of [205, 515]) { K.rr(wx, 126, 80, 80, 10); K.ink('#8fdcff', 4); K.rr(wx - 6, 120, 92, 92, 14); X.lineWidth = 8; X.strokeStyle = '#a5622c'; X.stroke(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.moveTo(wx + 40, 126); X.lineTo(wx + 40, 206); X.moveTo(wx, 166); X.lineTo(wx + 80, 166); X.lineWidth = 5; X.strokeStyle = '#a5622c'; X.stroke(); }
  /* floor */
  X.fillStyle = 'rgba(20,16,28,.14)'; X.fillRect(L, 440, VW, 26);
  const fg = X.createLinearGradient(0, 466, 0, 600); fg.addColorStop(0, '#d9944f'); fg.addColorStop(1, '#a5622c'); X.fillStyle = fg; X.fillRect(L, 466, VW, 134);
  X.strokeStyle = 'rgba(120,70,30,.5)'; X.lineWidth = 2;
  for (const y of [490, 518, 552]) { X.beginPath(); X.moveTo(L, y); X.lineTo(W + OX, y); X.stroke(); }
  for (let r = 0; r < 4; r++) { const y0 = [466, 490, 518, 552][r], y1 = [490, 518, 552, 600][r]; for (let x = Math.floor(L / 120) * 120 + (r & 1) * 60; x < W + OX; x += 120) { X.beginPath(); X.moveTo(x, y0); X.lineTo(x, y1); X.stroke(); } }
  X.fillStyle = 'rgba(255,255,255,.07)'; for (let x = Math.floor(L / 90) * 90; x < W + OX; x += 90) { X.beginPath(); X.moveTo(x, 466); X.lineTo(x + 30, 466); X.lineTo(x - 20, 600); X.lineTo(x - 50, 600); X.fill(); }
  X.fillStyle = INK; X.fillRect(L, 464, VW, 4);
  const mat = K.PR(236, 490, 328, 112, 28); K.cel(mat, '#5b7cf0', '#3a52b8', 0, 7, 4);
  X.strokeStyle = 'rgba(255,255,255,.75)'; X.lineWidth = 4; X.stroke(K.PR(250, 502, 300, 86, 20));
}
function senseiPoster(T, look, mood) {
  const X = K.cx(), x = 400, y = 236;
  K.rr(x - 52, y, 104, 128, 8); K.ink('#a5622c', 5); K.rr(x - 44, y + 8, 88, 112, 5); K.ink('#f7d297', 3);
  X.save(); K.rr(x - 44, y + 8, 88, 112, 5); X.clip();
  K.el(x, y + 56, 34, 34); X.fillStyle = '#ff4d5e'; X.fill();
  const bob = Math.sin(T * 2) * 1.2;
  snk(5, x, y + 118 + bob, .9, T, { bare: true, mood, lx: look[0], ly: look[1], w: 0 });
  X.strokeStyle = '#fff'; X.lineWidth = 3.5; X.lineCap = 'round'; const my = y + 100 + bob;
  X.beginPath(); X.moveTo(x, my); X.quadraticCurveTo(x - 14, my + 12, x - 24, my + 4); X.moveTo(x, my); X.quadraticCurveTo(x + 14, my + 12, x + 24, my + 4); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.4; X.strokeStyle = '#fff'; X.stroke();
  X.restore();
}
function glove(x, y, r, ang) {
  const X = K.cx(); X.save(); X.translate(x, y); X.rotate(ang);
  K.rr(-r * 1.55, -r * .62, r, r * 1.24, 4); K.ink('#fff', 3);
  const p = K.PE(0, 0, r, r * .92); K.cel(p, '#ff4d5e', '#b8283a', r * .22, r * .22, 3.5); K.glint(p, r * .1, -r * .4, r * .4, r * .18, .55, -.2);
  X.strokeStyle = 'rgba(0,0,0,.25)'; X.lineWidth = 2.5; X.beginPath(); X.arc(r * .1, r * .2, r * .5, .4, 2.2); X.stroke();
  X.restore();
}

function mvPunch(sp) {
  const rs = Math.sqrt(sp), N = 4, WIN = 1.0 / rs, GAP = .22 / rs;
  const L = 0, R = 1, U = 2;
  const POS = [[130, 430], [670, 430], [400, 160]], ARR = [3, 1, 0];
  const CX = 400, CY = 485;
  const dirs = []; let lastD = -1;
  for (let i = 0; i < N; i++) { let d; do { d = Math.floor(Math.random() * 3); } while (d === lastD); dirs.push(d); lastD = d; }
  const KINDS = []; for (let i = 0; i < N; i++) KINDS.push([4, 0, 5, 1][(Math.floor(Math.random() * 4) + i) % 4]);
  const ELX = [], ELY = []; for (let d = 0; d < 3; d++) { const dx = 400 - POS[d][0], dy = 485 - POS[d][1], l = Math.hypot(dx, dy); ELX.push(dx / l); ELY.push(dy / l); }
  const SX = [95, -95, 135], SY = [-70, -70, -10], SHR = ['AAAH!', 'EEEK!', 'NOOO!'];
  const ESC = [1.5, 1.5, 1.2];                 // art-only: snacks drawn a bit smaller on the high shelf so they clear the hint line
  let c = 0, gapT = .45 / rs, idx = 0, cnt = 0, cur = null, fist = null, hurt = 0, slamT = 0, sorry = 0, rT0 = -1; const dead = [];
  const lose = (msg) => {
    if (g.result) return; g.result = 'lose'; mvLose(); hurt = .5;
    floatText(msg, 400, 300, RED, 46); burst(CX, CY - 20, RED, 14); sorry = 1; snd(500, .5, 'sawtooth', .06, 0, 90); floatText('HA HA!', POS[cur ? cur.d : 2][0], POS[cur ? cur.d : 2][1] - 100, YEL, 34);
  };
  const punch = (d) => {
    if (g.result) return;
    fist = { d, t: 0 };
    if (!cur) { sfx.whoosh(); return; }
    if (d === cur.d) {
      const p = POS[d]; dead.push({ d, t: 0, k: KINDS[idx] }); cnt++; idx++; snd(800, .35, 'sawtooth', .07, 0, 140); sfx.boing();
      sfx.hit(); sfx.thud(); shake(6, .18); burst(p[0], p[1], YEL, 16); ring(p[0], p[1], '#fff', 90);
      floatText(['POW!', 'BAM!', 'WHAM!', 'KO!'][Math.min(3, cnt - 1)], p[0], p[1] - 70, YEL, 40);
      cur = null; gapT = GAP;
      if (cnt >= N) { g.result = 'win'; mvWin(400, 300); slamT = .9; }
    } else lose('WRONG WAY!');
  };
  const KM = { ArrowLeft: L, KeyA: L, ArrowRight: R, KeyD: R, ArrowUp: U, KeyW: U };
  const g = {
    wide: true, cmd: 'PUNCH THE SNACK!', hint: 'ARROWS: PUNCH THE ANGRY SNACK\'S SIDE', thint: 'TAP THE SIDE WHERE THEY POP UP', dur: 5.6,
    key(e) { if (!e.repeat && KM[e.code] != null) punch(KM[e.code]); },
    down(p) { const dx = p.x - 400; punch(Math.abs(dx) > 170 ? (dx < 0 ? L : R) : U); },
    update(dt) {
      c += dt; hurt = Math.max(0, hurt - dt); slamT = Math.max(0, slamT - dt);
      if (g.result && rT0 < 0) rT0 = now;
      if (fist) { fist.t += dt; if (fist.t > .25) fist = null; }
      for (let i = dead.length - 1; i >= 0; i--) { dead[i].t += dt; if (dead[i].t > .5) dead.splice(i, 1); }
      if (g.result) return;
      if (!cur) {
        gapT -= dt;
        if (gapT <= 0 && idx < N) { cur = { d: dirs[idx], t: 0 }; sfx.pop(); ring(POS[cur.d][0], POS[cur.d][1], '#fff', 70, .3); }
      } else {
        cur.t += dt;
        if (cur.t > WIN) lose('TOO SLOW!');
      }
    },
    draw(t) {
      K.use(); const X = ctx;
      if (g.result && rT0 < 0) rT0 = now;
      const oT = g.result ? now - rT0 : -1, win = g.result === 'win', lost = g.result === 'lose';
      K.blit(K.layer('dojo', dojoBg));
      /* windows: clouds drift past (the background gag, always moving) */
      for (const wx of [205, 515]) { X.save(); K.rr(wx, 126, 80, 80, 10); X.clip(); K.cloud(wx - 70 + ((t * 9 + wx) % 190), 160 + (wx > 400 ? 12 : 0), .7); X.restore(); K.rr(wx, 126, 80, 80, 10); X.lineWidth = 2; X.strokeStyle = 'rgba(255,255,255,.5)'; X.stroke(); }
      /* the sensei on the wall watches the snack, bows when you win */
      const lk = cur ? (cur.d === L ? [-1, 0] : cur.d === R ? [1, 0] : [0, -1]) : [0, .4];
      senseiPoster(t, lk, win ? 'happy' : lost ? 'bonk' : cur ? 'panic' : 'idle');
      if (win) for (let i = 0; i < 3; i++) K.heart(400 - 40 + i * 40, 226 - ((oT * 50 + i * 20) % 50), .8, 1 - ((oT * 50 + i * 20) % 50) / 50);
      const drawEnemy = (d, k, a, ko, kind, mood) => {
        const p = POS[d];
        X.save(); X.globalAlpha = a; X.translate(p[0], p[1]); X.scale(k * ESC[d], k * ESC[d]);
        if (ko) X.rotate(ko * (d === L ? -1 : 1));
        snk(kind, 0, 0, 1, now, { w: ko ? .3 : 1.3, lx: ELX[d], ly: ELY[d], mood, noshadow: true, arms: ko ? 'droop' : undefined });
        if (ko) for (let i = 0; i < 3; i++) { const aa = now * 9 + i * 2.1; K.star(Math.cos(aa) * 40, -92 + Math.sin(aa) * 10, 11, 5, 5, aa, YEL, 3); }
        X.restore();
      };
      for (const dd of dead) {
        const u = dd.t / .5;
        X.save(); X.translate((dd.d === L ? -1 : dd.d === R ? 1 : 0) * u * 260, (dd.d === U ? -1 : 0) * u * 180 - 60 * Math.sin(u * 3));
        drawEnemy(dd.d, 1, 1 - u, u * 8, dd.k, 'bonk'); X.restore();
      }
      if (cur) {
        const k = clamp(cur.t / .12, 0, 1), sc = k < 1 ? 1.25 * k : 1 + Math.max(0, .25 * (1 - (cur.t - .12) / .1));
        const p = POS[cur.d], left = 1 - cur.t / WIN, low = left < .35, blink = low && Math.sin(now * 40) > 0;
        shadow(p[0], p[1] + 2, 40, 9, .25);
        drawEnemy(cur.d, sc, 1, 0, KINDS[idx], lost ? 'happy' : low ? 'panic' : 'angry');
        if (low) K.sweat(p[0] + 34, p[1] - 118 * ESC[cur.d] / 1.5, 1.2, now);
        /* shout bubble */
        const bx = p[0] + SX[cur.d] + Math.sin(now * 55) * 3, by = p[1] + SY[cur.d];
        X.beginPath(); X.moveTo(bx - 14, by + 14); X.lineTo(bx + (cur.d === R ? 30 : -30), by + 30); X.lineTo(bx + 6, by + 14); X.closePath(); K.ink('#fff', 3);
        K.rr(bx - 58, by - 20, 116, 40, 20); K.ink('#fff', 3); txt(SHR[idx % 3], bx, by + 1, 26, INK);
        const ax = CX + (p[0] - CX) * .55, ay = CY - 20 + (p[1] - (CY - 20)) * .55 - (cur.d === U ? 0 : 20);
        if (!blink) drawArrow(ax, ay, ARR[cur.d], 30, YEL);
        K.bar(p[0] - 50, p[1] + 78, 100, 16, left, low ? '#ff4d5e' : '#5CFF7A');
      }
      if (win) {   // a tiny sock surrenders on the mat, off to the side of the stamp
        const sx = CX + 170, sw = Math.sin(now * 10) * 6;
        X.save(); X.translate(sx + 20, 520); X.rotate(Math.sin(now * 10) * .08);
        X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -62); X.lineWidth = 9; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#e3ac66'; X.stroke();
        X.beginPath(); X.moveTo(0, -62); X.quadraticCurveTo(22, -70 + sw * .3, 40 + sw, -56); X.quadraticCurveTo(24, -44 + sw * .3, 0, -42); X.closePath(); K.ink('#fff', 3);
        X.restore();
        snk(3, sx, 528, .6, now, { w: 1.6, mood: 'sad', lx: -1, ly: 0, arms: 'up' });
      }
      /* Claude: guard gloves, headband, reacts */
      const f = fist ? Math.sin(clamp(fist.t / .25, 0, 1) * Math.PI) : 0, pulse = oT >= 0 ? Math.abs(Math.sin(oT * 9)) * 16 : 0;
      shadow(CX, 528, 70, 14, .3);
      X.save(); if (hurt > 0) X.translate(Math.sin(now * 80) * 6, 0);
      if (win) X.translate(0, -pulse);
      const gx = [CX - 68, CX + 68], gy = win ? 440 : 480, nearD = cur ? Math.hypot(POS[cur.d][0] - CX, POS[cur.d][1] - CY) : 1;
      const GL = [];
      for (let i = 0; i < 2; i++) {
        let px = gx[i], py = gy, ang = i ? -.6 : -2.55;
        if (win) { px = CX + (i ? 84 : -84); py = 430 + Math.sin(now * 10 + i) * 6; ang = i ? -1.1 : -2.05; }
        else if (fist && ((fist.d === L && i === 0) || (fist.d !== L && i === 1))) {
          const p = POS[fist.d], tx = CX + (p[0] - CX) * .72, ty = CY - 5 + (p[1] - (CY - 5)) * .72; px += (tx - px) * f; py += (ty - py) * f; ang = Math.atan2(ty - gy, tx - px) * (f > .02 ? 1 : 0) + (f > .02 ? 0 : ang);
        }
        const sx = CX + (i ? 50 : -50), sy = 480;
        K.line([[sx, sy], [px, py]], 14, OR);
        GL.push([px, py, ang, fist && f > .8 && ((fist.d === L && i === 0) || (fist.d !== L && i === 1))]);
      }
      claude(CX, 524, 8, { mood: mvMood(g) });
      for (const q of GL) { glove(q[0], q[1], 19, q[2]); if (q[3]) pow(q[0] + Math.cos(q[2]) * 30, q[1] + Math.sin(q[2]) * 30, 34, now * 4, YEL); }
      X.fillStyle = '#ff4d5e'; K.rr(CX - 48, 458, 96, 10, 4); K.ink('#ff4d5e', 3);
      X.beginPath(); X.moveTo(CX + 48, 462); X.lineTo(CX + 78, 452 + Math.sin(now * 8) * 5); X.lineTo(CX + 70, 470); X.closePath(); K.ink('#ff4d5e', 3);
      if (win) blush(CX, 524, 8, .8);
      if (cur && !g.result && (1 - cur.t / WIN) < .45) K.sweat(CX + 38, 440, 1.1, now);
      if (lost) { for (let i = 0; i < 3; i++) { const aa = now * 8 + i * 2.1; K.star(CX + Math.cos(aa) * 46, 438 + Math.sin(aa) * 9, 10, 4.5, 5, aa, YEL, 3); } K.el(CX + 30, 450, 12, 9); K.ink('#f3a283', 3); }
      X.restore();
      if (!g.result) K.tag(CX, 424);
      /* score: four glove slots on a wooden sign (top, below the hint line) */
      K.sign(580, 60, 196, 44, 14);
      for (let i = 0; i < N; i++) {
        const sxx = 616 + i * 46, on = i < cnt;
        K.el(sxx, 82, 15, 15); K.ink(on ? YEL : '#f7d297', 3);
        if (on) K.star(sxx, 82, 11, 4.5, 5, now * .8, '#fff', 0);
      }
      mvSlam('WHAT?!', slamT / .9);
      vignette(.2);
    }
  };
  return g;
}
reg('mv_punch', mvPunch, 'Punch!');

/* ───────────── 2 WAVE: Claude on a snack theatre stage waves at the crowd until they cheer ───────────── */
function theatreBg() {
  const X = K.cx(), L = -OX, R = W + OX;
  /* painted cardboard backdrop */
  const g = X.createLinearGradient(0, 0, 0, 290); g.addColorStop(0, '#2a2f8f'); g.addColorStop(1, '#8d7cf0'); X.fillStyle = g; X.fillRect(L, 0, VW, 290);
  X.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 40; i++) { K.star(L + K.hash(i) * VW, 20 + K.hash(i + 50) * 170, 3 + K.hash(i + 9) * 3, 1.4, 4, 0, '#fff7c2', 0); }
  for (const [hx, hc, hh] of [[250, '#4d4fb8', 70], [440, '#3f9a78', 90], [640, '#4d4fb8', 60]]) { X.beginPath(); X.moveTo(hx - 190, 288); X.quadraticCurveTo(hx, 288 - hh * 2, hx + 190, 288); X.closePath(); X.fillStyle = hc; X.fill(); }
  /* stage floor, footlights, pit */
  const fg = X.createLinearGradient(0, 288, 0, 372); fg.addColorStop(0, '#d9a066'); fg.addColorStop(1, '#a5622c'); X.fillStyle = fg; X.fillRect(L, 288, VW, 86);
  X.strokeStyle = 'rgba(110,60,25,.45)'; X.lineWidth = 2;
  for (const y of [306, 328, 352]) { X.beginPath(); X.moveTo(L, y); X.lineTo(R, y); X.stroke(); }
  for (let x = Math.floor(L / 100) * 100; x < R; x += 100) { X.beginPath(); X.moveTo(x + 30, 288); X.lineTo(x - 30, 372); X.stroke(); }
  X.fillStyle = INK; X.fillRect(L, 286, VW, 4);
  X.fillStyle = '#6b3b1a'; X.fillRect(L, 372, VW, 24); X.fillStyle = INK; X.fillRect(L, 372, VW, 4); X.fillRect(L, 394, VW, 4);
  for (let x = Math.floor(L / 46) * 46 + 23; x < R; x += 46) { K.el(x, 384, 9, 8); X.fillStyle = 'rgba(255,225,77,.35)'; K.el(x, 384, 17, 14); X.fill(); K.el(x, 384, 9, 8); K.ink('#ffe14d', 2.5); X.fillStyle = '#fff6b0'; K.el(x - 2, 382, 3, 2); X.fill(); }
  const ag = X.createLinearGradient(0, 398, 0, 600); ag.addColorStop(0, '#3b2170'); ag.addColorStop(1, '#170b30'); X.fillStyle = ag; X.fillRect(L, 398, VW, 202);
  X.fillStyle = 'rgba(255,255,255,.05)'; for (let x = Math.floor(L / 80) * 80; x < R; x += 80) { X.beginPath(); X.moveTo(x, 398); X.lineTo(x + 30, 398); X.lineTo(x - 90, 600); X.lineTo(x - 120, 600); X.fill(); }
  /* velvet curtains and a pelmet */
  const curtain = (sgn) => {
    const e = sgn < 0 ? 128 : 672, o = sgn < 0 ? L - 10 : R + 10;
    const p = new Path2D(); p.moveTo(o, 0); p.lineTo(e, 0); p.bezierCurveTo(e - sgn * 18, 120, e + sgn * 26, 250, e - sgn * 8, 376); p.lineTo(o, 376); p.closePath();
    K.cel(p, '#d02a44', '#8f1a2e', 0, 0, 4);
    X.save(); X.clip(p); X.strokeStyle = 'rgba(80,10,30,.35)'; X.lineWidth = 6; for (let i = 0; i < 12; i++) { const x = e - sgn * (i * 34 + 16); X.beginPath(); X.moveTo(x + sgn * 8, 0); X.quadraticCurveTo(x - sgn * 8, 190, x + sgn * 4, 376); X.stroke(); }
    X.strokeStyle = 'rgba(255,255,255,.14)'; X.lineWidth = 5; for (let i = 0; i < 12; i++) { const x = e - sgn * (i * 34 + 28); X.beginPath(); X.moveTo(x, 0); X.quadraticCurveTo(x - sgn * 8, 190, x, 376); X.stroke(); } X.restore();
    X.beginPath(); X.moveTo(e, 0); X.bezierCurveTo(e - sgn * 18, 120, e + sgn * 26, 250, e - sgn * 8, 376); X.lineWidth = 6; X.strokeStyle = '#ffd23f'; X.stroke();
    K.el(e - sgn * 8, 262, 9, 9); K.ink('#ffd23f', 3);
  };
  curtain(-1); curtain(1);
  const pm = K.PR(L - 10, -10, VW + 20, 56, 8); K.cel(pm, '#c0243c', '#8f1a2e', 0, 6, 4);
  for (let x = Math.floor(L / 40) * 40; x < R + 40; x += 40) { X.beginPath(); X.arc(x + 20, 46, 20, 0, Math.PI); K.ink('#c0243c', 3); X.fillStyle = '#ffd23f'; K.rr(x + 14, 62, 12, 10, 3); X.fill(); }
}
function card(x, y, m, T, k) {   // a critic's score card: sad face, flat face, or gold star
  const X = K.cx(); X.save(); X.translate(x, y); X.rotate(Math.sin(T * 4 + k) * .06);
  K.rr(-16, -16, 32, 32, 6); K.ink(m > 1 ? '#fff6b0' : '#fff', 3);
  if (m === 2) K.star(0, 1, 12, 5, 5, -Math.PI / 2, '#ffd23f', 2);
  else { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-6, -5); X.lineTo(-6, -2); X.moveTo(6, -5); X.lineTo(6, -2); X.stroke(); X.beginPath(); if (m === 0) X.arc(0, 11, 7, Math.PI * 1.15, Math.PI * 1.85); else { X.moveTo(-6, 8); X.lineTo(6, 8); } X.stroke(); }
  X.restore();
}

function mvWave(sp) {
  const rs = Math.sqrt(sp), need = 8 + Math.round(sp - 1);
  let meter = 0, c = 0, s = 1, ha = 0, lx = null, dir = 0, ext = 0, lastKey = '', hearts = [], flash = 0, winT = -1, rT0 = -1;
  const wave = () => {
    if (g.result) return;
    meter = Math.min(1, meter + 1 / need); s = -s; flash = .12;
    sfx.blip(Math.round(meter * 14)); sfx.whoosh(s > 0); snd(260 + meter * 500, .09, 'square', .04, 0, 160 + meter * 700);
    const hx = 400 + 110 * Math.sin(s * .7) + 50, hy = 260 - 110 * Math.cos(s * .7);
    burst(hx, hy, '#fff', 4, 160);
    if (meter > .25 && Math.random() < .6) hearts.push({ x: 140 - OX + Math.random() * (520 + 2 * OX), y: 470, t: 0 });
    if (meter >= 1) { g.result = 'win'; mvWin(400, 300); floatText('CHEERS!', 400, 170, YEL, 50); sfx.boing(); winT = 0; }
  };
  const g = {
    wide: true, cmd: 'GREET THE SNACKS!', hint: 'WAVE THE MOUSE (OR ALTERNATE LEFT / RIGHT)', thint: 'SWIPE LEFT AND RIGHT FAST', dur: 5,
    key(e) {
      if (e.repeat) return;
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (k && k !== lastKey) { lastKey = k; wave(); }
    },
    move(p) {
      if (lx === null) { lx = p.x; return; }
      const dx = p.x - lx; if (Math.abs(dx) < 3) return; lx = p.x;
      const nd = dx > 0 ? 1 : -1;
      if (dir === 0) { dir = nd; ext = Math.abs(dx); return; }
      if (nd === dir) ext += Math.abs(dx);
      else { if (ext >= 35) wave(); dir = nd; ext = Math.abs(dx); }
    },
    update(dt) {
      c += dt; flash = Math.max(0, flash - dt); if (winT >= 0) winT += dt;
      if (g.result && rT0 < 0) rT0 = now;
      ha += (s * .7 - ha) * Math.min(1, dt * 18);
      if (!g.result) meter = Math.max(0, meter - .06 * dt * sp);
      for (let i = hearts.length - 1; i >= 0; i--) { hearts[i].t += dt; if (hearts[i].t > 1) hearts.splice(i, 1); }
    },
    draw(t) {
      K.use(); const X = ctx;
      if (g.result && rT0 < 0) rT0 = now;
      const oT = g.result ? now - rT0 : -1, win = g.result === 'win', lost = g.result === 'lose';
      K.blit(K.layer('theatre', theatreBg));
      /* stagehand sock holds up a cardboard moon on a stick (background gag) */
      { const mx = 222, my = 176 + Math.sin(t * 1.6) * 12, tilt = Math.sin(t * 1.6) * .08;
        X.beginPath(); X.moveTo(mx, my + 30); X.lineTo(mx + tilt * 120, 306); X.lineWidth = 11; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#c98443'; X.stroke();
        const mp = K.PE(mx, my, 38, 38); K.cel(mp, '#fff3b0', '#e8cf7a', 5, 4, 4); X.save(); X.clip(mp); X.fillStyle = '#e8cf7a'; for (const q of [[-12, -8, 7], [10, 6, 9], [-6, 16, 5]]) { K.el(mx + q[0], my + q[1], q[2], q[2]); X.fill(); } X.restore();
        K.eye(mx - 12, my - 4, 5, lost ? 'sleep' : 'idle', [0, .6], t, 0); K.eye(mx + 4, my - 4, 5, lost ? 'sleep' : 'idle', [0, .6], t, 1);
        snk(3, mx + tilt * 120, 322, .62, t, { w: .25, mood: lost ? 'sad' : win ? 'happy' : 'idle', ly: -1, noshadow: false, arms: 'up' }); }
      /* critics in the royal box */
      { const m = lost ? 0 : win ? 2 : meter < .34 ? 0 : meter < .67 ? 1 : 2, mood = lost ? 'sad' : win ? 'happy' : meter < .34 ? 'angry' : 'idle';
        K.rr(572, 84, 108, 84, 10); K.ink('#5b1230', 4);
        snk(5, 604, 148, .62, t, { w: win ? 1.2 : .15, mood, noshadow: true, lx: 0, ly: .8 }); snk(5, 648, 148, .62, t, { w: win ? 1.2 : .15, mood, noshadow: true, lx: 0, ly: .8 });
        K.rr(566, 140, 120, 30, 8); K.ink('#d02a44', 4); X.fillStyle = '#ffd23f'; K.rr(570, 144, 112, 5, 2); X.fill();
        card(604, 124, m, t, 0); card(648, 124, m, t, 1); }
      /* spotlights */
      X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = 'rgba(255,240,170,.13)';
      for (const [bx, k] of [[260, 1], [540, -1]]) { const sw = Math.sin(t * 1.3 + k) * 30; X.beginPath(); X.moveTo(bx - 10, 50); X.lineTo(bx + 10, 50); X.lineTo(400 + sw + 90, 330); X.lineTo(400 + sw - 90, 330); X.closePath(); X.fill(); }
      X.restore();
      /* the crowd goes nuts as the cheer meter fills; they stare at the waving hand */
      const lk = Math.sin(ha), cw = lost ? .12 : .3 + meter * 2.2, cm = lost ? 'sad' : meter > .3 || win ? 'happy' : 'idle', ca = lost ? 'droop' : (meter > .55 || win) ? 'up' : undefined;
      crowd(470, t, cw, 1, 0, 0, lk, -.6, cm, ca);
      crowd(545, t, cw, 1.1, 48, 3, lk, -.6, cm, ca);
      if (win) {   // one snack faints from pure joy, and the crowd throws roses
        const u = Math.min(1, oT / .5), fy = 350 + u * 4; X.save(); X.translate(640, fy); X.rotate(u * 1.5); snk(2, 0, 0, 1, t, { w: .2, mood: 'dizzy', noshadow: true, arms: 'droop' }); X.restore();
        for (let i = 0; i < 7; i++) {
          const u2 = clamp((oT - i * .05) / .55, 0, 1); if (oT < i * .05) continue;
          const sx = 120 + i * 96, tx = [160, 215, 270, 530, 585, 640, 300][i], ty = 336 + K.hash(i) * 14, rx = sx + (tx - sx) * u2, ry = 450 + (ty - 450) * u2 - Math.sin(u2 * Math.PI) * 150;
          X.save(); X.translate(rx, ry); X.rotate(u2 * 9 + i); X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 6); X.lineTo(0, 22); X.stroke(); X.strokeStyle = '#3f9a55'; X.lineWidth = 4; X.stroke();
          X.beginPath(); X.arc(0, 0, 9, 0, K.TAU); K.ink('#ff3a5e', 3); X.strokeStyle = '#a81c3a'; X.lineWidth = 2.5; X.beginPath(); X.arc(0, 0, 4.5, .4, 5); X.stroke(); X.restore();
        }
      }
      if (lost) {   // crickets: a sock rolls across the empty stage like a tumbleweed
        const tx = -OX - 40 + oT * 760; X.save(); X.translate(tx, 336); X.rotate(oT * 12); snk(3, 0, 0, .5, t, { w: 0, mood: 'dizzy', noshadow: true, arms: 'droop' }); X.restore();
      }
      /* Claude on stage */
      shadow(400, 316, 80, 14, .3);
      const base = { mood: mvMood(g) || (meter > .5 ? 'happy' : null) };
      const jump = win ? Math.abs(Math.sin(oT * 9)) * 18 : 0;
      X.save(); X.translate(0, -jump);
      claude(400, 312, 9, base);
      if (base.mood === 'happy') blush(400, 312, 9, .7);
      const sx = 448, sy = 262, L = 120, hx = sx + Math.sin(ha) * L, hy = sy - Math.cos(ha) * L;
      K.line([[sx, sy], [hx, hy]], 18, OR);
      hand(hx, hy, 30, ha * .6, true);
      if (!lost && meter < .2 && c > 2) K.sweat(386, 232, 1.2, c);
      X.restore();
      if (!g.result) K.tag(380, 196);
      if (flash > 0) { X.strokeStyle = '#fff'; X.lineWidth = 5; X.beginPath(); X.arc(sx, sy - 10, 150, -Math.PI * .5 - s * 1.2, -Math.PI * .5 - s * .5, s > 0); X.stroke(); }
      for (const h of hearts) K.heart(h.x + Math.sin(h.t * 8) * 10, h.y - h.t * 120, 1.3, 1 - h.t);
      /* applause-o-meter */
      K.heart(236, 78, 1.5);
      K.bar(258, 62, 296, 30, meter, meter > .7 ? '#5CFF7A' : '#FFE14D');
      txt('CHEER', 406, 77, 18, '#fff');
      vignette(.2);
    }
  };
  return g;
}
reg('mv_wave', mvWave, 'Wave!');

/* ───────────── 3 CLAP: a rooftop party at night. Watch the marquee bulbs, then echo the rhythm ───────────── */
function rooftopBg() {
  const X = K.cx(), L = -OX, R = W + OX;
  const g = X.createLinearGradient(0, 0, 0, 390); g.addColorStop(0, '#1d1840'); g.addColorStop(.55, '#5b2d95'); g.addColorStop(1, '#ff8fc8'); X.fillStyle = g; X.fillRect(L, 0, VW, 392);
  for (let i = 0; i < 46; i++) { X.fillStyle = `rgba(255,255,255,${.35 + K.hash(i + 7) * .5})`; K.el(L + K.hash(i) * VW, 10 + K.hash(i + 30) * 230, 1.6 + K.hash(i + 2) * 1.2, 1.6); X.fill(); }
  X.beginPath(); X.arc(650, 150, 40, 0, K.TAU); X.fillStyle = '#fff3b0'; X.fill(); X.lineWidth = 4; X.strokeStyle = '#c9b7ff'; X.stroke();
  X.fillStyle = '#e8cf7a'; for (const q of [[-12, -8, 8], [10, 8, 10], [-4, 18, 5]]) { K.el(650 + q[0], 150 + q[1], q[2], q[2]); X.fill(); }
  /* skyline: far (no ink, tinted) then near (coloured outline) */
  for (let x = Math.floor(L / 50) * 50, i = 0; x < R; x += 50, i++) { const h = 60 + K.hash(i + 11) * 90; X.fillStyle = '#4a2f8c'; X.fillRect(x, 386 - h, 46, h); X.fillStyle = 'rgba(255,225,77,.55)'; for (let wy = 396 - h; wy < 372; wy += 16) for (let wx = x + 7; wx < x + 40; wx += 14) if (K.hash(i * 31 + wy + wx) > .62) X.fillRect(wx, wy, 6, 8); }
  for (let x = Math.floor(L / 90) * 90 + 20, i = 0; x < R; x += 90, i++) { const h = 40 + K.hash(i + 61) * 60; K.rr(x, 388 - h, 70, h + 4, 6); K.ink('#2f1d66', 3, '#1e1245'); X.fillStyle = 'rgba(255,225,77,.7)'; for (let wy = 400 - h; wy < 378; wy += 18) for (let wx = x + 10; wx < x + 60; wx += 16) if (K.hash(i * 17 + wy + wx) > .55) X.fillRect(wx, wy, 7, 9); }
  /* party string lights between two poles */
  for (const px of [30, 770]) { K.rr(px - 5, 210, 10, 190, 4); K.ink('#8a5530', 3); }
  X.beginPath(); X.moveTo(30, 214); X.quadraticCurveTo(400, 300, 770, 214); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  for (let i = 1; i < 14; i++) { const u = i / 14, bx = 30 + u * 740, by = (1 - u) * (1 - u) * 214 + 2 * u * (1 - u) * 300 + u * u * 214; K.el(bx, by + 8, 6, 8); K.ink(['#ff5c8a', '#ffe14d', '#5CFF7A', '#4DB8FF'][i % 4], 2); }
  /* roof floor */
  X.fillStyle = '#3a2470'; X.fillRect(L, 384, VW, 10);
  const fg = X.createLinearGradient(0, 394, 0, 600); fg.addColorStop(0, '#7a4cb0'); fg.addColorStop(1, '#4a2c82'); X.fillStyle = fg; X.fillRect(L, 394, VW, 206);
  for (let r = 0; r < 7; r++) { const y0 = 394 + r * r * 4 + r * 14, y1 = 394 + (r + 1) * (r + 1) * 4 + (r + 1) * 14, st = 60 + r * 22; X.fillStyle = 'rgba(255,255,255,.07)'; for (let x = Math.floor(L / (st * 2)) * st * 2 + ((r & 1) ? st : 0); x < R; x += st * 2) X.fillRect(x, y0, st, y1 - y0); }
  X.fillStyle = INK; X.fillRect(L, 391, VW, 4);
}
function recordDeck(x, y, T, spin) {
  const X = K.cx(); K.rr(x - 54, y, 108, 26, 8); K.ink('#3b3550', 4);
  X.save(); X.translate(x - 22, y + 8); X.scale(1, .55); X.rotate(T * spin); K.el(0, 0, 18, 18); K.ink('#14101c', 2); X.strokeStyle = '#ff5c8a'; X.lineWidth = 3; X.beginPath(); X.arc(0, 0, 9, 0, 3.2); X.stroke(); X.restore();
  X.fillStyle = '#5CFF7A'; K.el(x + 24, y + 9, 5, 5); X.fill(); X.fillStyle = '#ff4d5e'; K.el(x + 40, y + 9, 5, 5); X.fill();
}

function mvClap(sp) {
  const rs = Math.sqrt(sp), b = .5 / rs, tol = .17 / Math.pow(sp, .35);
  const pats = [[0, 1, 2], [0, .5, 1.5], [0, 1, 1.5], [0, .5, 1]];
  const pat = pats[Math.floor(Math.random() * pats.length)];
  const D0 = .45, E0 = D0 + (pat[2] + 1.6) * b;
  const dem = pat.map(o => D0 + o * b), ech = pat.map(o => E0 + o * b);
  const BX = [300, 400, 500], hit = [false, false, false], demoDone = [false, false, false], lit = [false, false, false];
  let c = 0, pulse = 0, mine = 0, slamT = 0, rT0 = -1;
  const clapFx = (me) => { pulse = .16; if (me) mine = .16; snd(me ? 520 : 330, .07, 'square', .06, 0, me ? 260 : 180); noise(.05, .06, 2500, 5000, 'highpass'); };
  const press = () => {
    if (g.result) return;
    clapFx(true);
    if (c < E0 - tol) { sfx.tick(); return; }
    let bj = -1, bd = 9;
    for (let j = 0; j < 3; j++) if (!hit[j] && Math.abs(c - ech[j]) < bd) { bd = Math.abs(c - ech[j]); bj = j; }
    if (bj >= 0 && bd <= tol) {
      hit[bj] = true; lit[bj] = true; sfx.hit(); sfx.blip(bj * 3);
      const perf = bd < tol * .5; burst(BX[bj], 150, perf ? YEL : MINT, 10); ring(BX[bj], 150, '#fff', 60, .3);
      floatText(perf ? 'PERFECT' : 'GOOD', BX[bj], 215, perf ? YEL : MINT, 26);
      if (hit.every(Boolean)) { g.result = 'win'; mvWin(400, 300); sfx.boing(); }
    } else { g.result = 'lose'; mvLose(); floatText('OFF BEAT!', 400, 300, RED, 46); slamT = .9; snd(600, .4, 'sawtooth', .06, 0, 100); }
  };
  const g = {
    wide: true, cmd: 'CLAP FOR SNACKS!', hint: 'WATCH THE RHYTHM, THEN ECHO IT: SPACE / CLICK', thint: 'WATCH, THEN TAP THE BEATS', dur: 4.6,
    key(e) { if (!e.repeat && e.code === 'Space') press(); },
    down() { press(); },
    update(dt) {
      c += dt; pulse = Math.max(0, pulse - dt); mine = Math.max(0, mine - dt); slamT = Math.max(0, slamT - dt);
      if (g.result && rT0 < 0) rT0 = now;
      if (g.result) return;
      for (let j = 0; j < 3; j++) if (!demoDone[j] && c >= dem[j]) { demoDone[j] = true; clapFx(false); }
      for (let j = 0; j < 3; j++) if (!hit[j] && c > ech[j] + tol) { g.result = 'lose'; mvLose(); floatText('MISSED!', 400, 300, RED, 46); slamT = .9; snd(600, .4, 'sawtooth', .06, 0, 100); break; }
    },
    draw(t) {
      K.use(); const X = ctx;
      if (g.result && rT0 < 0) rT0 = now;
      const oT = g.result ? now - rT0 : -1, win = g.result === 'win', lost = g.result === 'lose';
      K.blit(K.layer('rooftop', rooftopBg));
      /* win: fireworks over the skyline */
      if (win) for (let k = 0; k < 2; k++) {
        const u = clamp(oT * 1.3 - k * .25, 0, 1), fx = k ? 640 : 150, fy = 190 + k * 20;
        if (u > 0) for (let i = 0; i < 12; i++) { const a = i * K.TAU / 12, r = 12 + 70 * K.ease(u); X.fillStyle = `hsla(${(i * 40 + k * 90) % 360},95%,65%,${1 - u})`; K.el(fx + Math.cos(a) * r, fy + Math.sin(a) * r, 5 * (1 - u * .5), 5 * (1 - u * .5)); X.fill(); }
      }
      /* the DJ banana behind his decks (background gag, bobs to the clap pulse) */
      snk(2, 92, 398, .78, t, { w: pulse > 0 ? 1.6 : .5, mood: lost ? 'sad' : 'happy', noshadow: true, arms: 'up' });
      X.strokeStyle = INK; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath(); X.arc(92, 372, 15, Math.PI, 0); X.stroke(); X.strokeStyle = '#ff5c8a'; X.lineWidth = 3.5; X.stroke(); K.el(77, 376, 5, 7); K.ink('#ff5c8a', 2); K.el(107, 376, 5, 7); K.ink('#ff5c8a', 2);
      recordDeck(92, 396, t, lost ? 0 : pulse > 0 ? 8 : 3);
      /* snacks clap along (arms flail on each clap) */
      const cw = pulse > 0 ? 2.6 : win ? 2.2 : lost ? .15 : .5, cm = lost ? 'angry' : win || pulse > 0 ? 'happy' : 'idle', ca = win ? 'up' : undefined;
      crowd(450, t, cw, 1, 0, 0, 0, 1, cm, ca);
      crowd(505, t, cw, 1.1, 48, 2, 0, 1, cm, ca);
      /* lose: a tomato from the crowd splats on Claude */
      if (lost) {
        const u = clamp(oT / .35, 0, 1);
        if (u < 1) { const tx = 180 + (366 - 180) * u, ty = 450 + (488 - 450) * u - Math.sin(u * Math.PI) * 90; X.save(); X.translate(tx, ty); X.rotate(u * 12); K.el(0, 0, 11, 10); K.ink('#e8434f', 3); X.fillStyle = '#3f9a55'; K.el(0, -9, 5, 3); X.fill(); X.restore(); }
      }
      /* Claude */
      const sp2 = mine > 0 ? 0 : 20, bob = win ? Math.abs(Math.sin(oT * 9)) * 14 : 0;
      shadow(400, 540, 80, 14, .3);
      X.save(); X.translate(0, -bob);
      for (const d of [-1, 1]) { const hx = 400 + d * (54 + sp2 + 14), hy = 500; K.line([[400 + d * 52, 508], [hx - d * 8, hy]], 14, OR); }
      claude(400, 538, 8, { mood: mvMood(g) });
      for (const d of [-1, 1]) hand(400 + d * (54 + sp2 + 14), 500, 18, d * (mine > 0 ? .3 : .6), false);
      if (win) blush(400, 538, 8, .8);
      if (lost) { const sx = 372, sy = 488; K.el(sx, sy, 17, 12, -.3); K.ink('#e8434f', 3); for (const dx of [-8, 4, 13]) { K.el(sx + dx, sy + 14 + K.hash(dx) * 6, 3.2, 6); X.fillStyle = '#e8434f'; X.fill(); } }
      X.restore();
      if (mine > 0) pow(400, 498, 36, now * 5, YEL);
      if (!g.result) K.tag(400, 446);
      /* the marquee: three bulbs light up as the crowd claps, then you echo them */
      const echoing = c >= E0 - b * 1.2;
      K.rr(236, 108, 328, 84, 22); K.ink('#2a1a5e', 5); K.rr(246, 118, 308, 64, 16); X.lineWidth = 3; X.strokeStyle = '#ffd23f'; X.stroke();
      for (let j = 0; j < 3; j++) {
        const lt = lit[j] || demoDone[j] && !echoing, col = win ? `hsl(${(j * 120 + now * 500) % 360},95%,62%)` : lost ? '#8f88a6' : hit[j] ? MINT : lt ? YEL : '#e9e3ff';
        if (!lost && (hit[j] || lt || win)) { X.fillStyle = 'rgba(255,240,150,.28)'; K.el(BX[j], 150, 40, 40); X.fill(); }
        K.el(BX[j], 150, 26, 26); K.ink(col, 5); X.fillStyle = 'rgba(255,255,255,.7)'; K.el(BX[j] - 8, 140, 7, 4.5, -.5); X.fill();
        if (echoing && !hit[j] && !g.result) {
          const k = clamp((ech[j] - c) / (b * 1.1), -.2, 1), r = 28 + k * 70;
          X.beginPath(); X.arc(BX[j], 150, r, 0, 7); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = k < .15 ? YEL : '#fff'; X.stroke();
        }
      }
      const word = echoing ? 'NOW!' : 'WATCH';
      K.rr(334, 62, 132, 38, 19); K.ink(echoing ? '#ff4d5e' : '#7A3FD1', 3); txt(word, 400, 81, 24, '#fff');
      mvSlam('WHAT?!', slamT / .9);
      vignette(.2);
    }
  };
  return g;
}
reg('mv_clap', mvClap, 'Clap!');

/* ───────────── 4 STAND: a windy seaside pier. Keep your balance on a giant rolling donut ───────────── */
function pierBg() {
  const X = K.cx(), L = -OX, R = W + OX;
  const g = X.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#3fb0ff'); g.addColorStop(.6, '#8fdcff'); g.addColorStop(1, '#e6fbff'); X.fillStyle = g; X.fillRect(L, 0, VW, 300);
  X.save(); X.translate(150, 150); X.fillStyle = 'rgba(255,248,200,.14)'; X.beginPath(); X.arc(0, 0, 100, 0, K.TAU); X.fill(); X.fillStyle = 'rgba(255,248,200,.2)'; X.beginPath(); X.arc(0, 0, 70, 0, K.TAU); X.fill(); X.restore();
  X.beginPath(); X.arc(150, 150, 34, 0, K.TAU); K.ink('#ffd84a', 4); X.fillStyle = '#fff3a0'; K.el(140, 140, 12, 8, -.6); X.fill();
  /* far lighthouse (coloured outline, no ink) */
  { const p = K.P('M538 300 L548 214 L572 214 L582 300 Z'); X.fillStyle = '#fff'; X.fill(p); X.save(); X.clip(p); X.fillStyle = '#e8434f'; for (const y of [226, 262]) X.fillRect(530, y, 60, 18); X.restore(); X.lineWidth = 3; X.strokeStyle = '#8f5a5a'; X.stroke(p);
    K.rr(546, 198, 28, 18, 4); X.fillStyle = '#fff3a0'; X.fill(); X.strokeStyle = '#8f5a5a'; X.stroke(); X.beginPath(); X.moveTo(542, 198); X.lineTo(560, 182); X.lineTo(578, 198); X.closePath(); X.fillStyle = '#e8434f'; X.fill(); X.stroke(); }
  /* sea */
  const sg = X.createLinearGradient(0, 300, 0, 486); sg.addColorStop(0, '#62d3f0'); sg.addColorStop(1, '#2a8fcb'); X.fillStyle = sg; X.fillRect(L, 300, VW, 190);
  X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(L, 298, VW, 3);
  /* railing */
  for (let x = Math.floor(L / 100) * 100 + 20; x < R; x += 100) { K.rr(x - 8, 420, 16, 68, 5); K.ink('#d9944f', 3); }
  K.rr(L - 10, 424, VW + 20, 16, 7); K.ink('#e3a868', 4); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(L, 427, VW, 3);
  K.rr(L - 10, 456, VW + 20, 10, 5); K.ink('#c4874e', 3);
  /* deck */
  const dg = X.createLinearGradient(0, 486, 0, 600); dg.addColorStop(0, '#dcae70'); dg.addColorStop(1, '#a5622c'); X.fillStyle = dg; X.fillRect(L, 486, VW, 114);
  X.strokeStyle = 'rgba(110,60,25,.5)'; X.lineWidth = 2;
  for (const y of [512, 542, 576]) { X.beginPath(); X.moveTo(L, y); X.lineTo(R, y); X.stroke(); }
  const rows = [486, 512, 542, 576, 600]; for (let r = 0; r < 4; r++) for (let x = Math.floor(L / 130) * 130 + (r & 1) * 65; x < R; x += 130) { X.beginPath(); X.moveTo(x, rows[r]); X.lineTo(x, rows[r + 1]); X.stroke(); }
  X.fillStyle = INK; X.fillRect(L, 484, VW, 4);
}
function gull(x, y, T, laugh, s) {
  const X = K.cx(); X.save(); X.translate(x, y); X.scale(s, s);
  const bob = laugh ? Math.sin(T * 24) * 2 : 0;
  X.beginPath(); X.moveTo(-6, 0); X.lineTo(-6, 12); X.moveTo(6, 0); X.lineTo(6, 12); X.lineWidth = 3.5; X.strokeStyle = '#ff9a3d'; X.lineCap = 'round'; X.stroke();
  const body = K.PE(0, -14 + bob, 24, 17); K.cel(body, '#ffffff', '#cdd8ea', 4, 4, 3.5);
  const wing = K.P('M-4 -18 Q-26 -22 -30 -6 Q-12 -8 -4 -4 Z'); K.cel(wing, '#cdd8ea', '#9fb0cc', 2, 2, 2.5);
  const head = K.PE(14, -36 + bob, 11, 10.5); K.cel(head, '#ffffff', '#cdd8ea', 2, 3, 3);
  const bk = laugh ? Math.abs(Math.sin(T * 24)) * 5 : 0;
  X.beginPath(); X.moveTo(23, -38 + bob); X.lineTo(36, -36 + bob - bk * .4); X.lineTo(23, -34 + bob); X.closePath(); K.ink('#ff9a3d', 2.5);
  X.beginPath(); X.moveTo(23, -33 + bob); X.lineTo(34, -31 + bob + bk); X.lineTo(22, -30 + bob); X.closePath(); K.ink('#ff9a3d', 2.5);
  K.eye(16, -40 + bob, 4.4, laugh ? 'happy' : 'idle', [-1, .5], T, 0);
  X.restore();
}

function mvBalance(sp) {
  const rs = Math.sqrt(sp), K_ = 2.4, DAMP = .9, ZONE = .4;
  const p1 = Math.random() * 6, p2 = Math.random() * 6, A = .75 * rs;
  let a = (Math.random() < .5 ? -1 : 1) * .28, w = 0, c = 0, md = 0, fall = 0, warn = 0, lastDir = 0, rT0 = -1;
  const push = (d) => { if (g.result) return; w += d * 1.4; sfx.click(); burst(400 - d * -20, 470, '#fff', 3, 120); lastDir = d; };
  const g = {
    get lean() { return a; }, wide: true, cmd: 'STAND ON DONUT!', hint: 'LEFT / RIGHT AGAINST THE LEAN', thint: 'TAP THE SIDE OPPOSITE THE LEAN', dur: 5, timeWin: true,
    key(e) {
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') push(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') push(1);
    },
    down(p) { md = p.x < 400 ? -1 : 1; push(md); },
    up() { md = 0; },
    update(dt) {
      c += dt; warn = Math.max(0, warn - dt);
      if (g.result && rT0 < 0) rT0 = now;
      if (g.result === 'lose') { fall += dt; a += Math.sign(a || 1) * dt * 3; return; }
      if (g.result) return;
      let u = 0;
      if (keys.ArrowLeft || keys.KeyA) u -= 4; if (keys.ArrowRight || keys.KeyD) u += 4; u += md * 4;
      const wind = A * (Math.sin(c * 2.1 + p1) + .7 * Math.sin(c * 3.7 + p2)) * Math.min(1, c / .5);
      const acc = K_ * a + wind - DAMP * w + u;
      w += acc * dt; a += w * dt;
      if (Math.abs(a) > .75 && warn <= 0) { warn = .3; sfx.tick(); }
      if (Math.abs(a) >= 1) {
        g.result = 'lose'; a = Math.sign(a) * 1; mvLose(); sfx.splat(); sfx.boing(); burst(400 + a * 120, 460, RED, 16); floatText('TIMBER!', 400, 250, RED, 50);
      }
    },
    draw(t) {
      K.use(); const X = ctx;
      if (g.result && rT0 < 0) rT0 = now;
      const oT = g.result ? now - rT0 : -1, win = g.result === 'win', lost = g.result === 'lose', sg = Math.sign(a || 1);
      K.blit(K.layer('pier', pierBg));
      /* wind-driven clouds and waves (the wind is the same sum the physics uses, read only) */
      const wind = A * (Math.sin(c * 2.1 + p1) + .7 * Math.sin(c * 3.7 + p2)) * Math.min(1, c / .5);
      for (let i = 0; i < 3; i++) K.cloud(((t * (38 + i * 20) + i * 330) % 1000) - 160 - OX * 0, 70 + i * 62 + (i & 1) * 20, .9 - i * .12);
      X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 5; X.lineCap = 'round';
      for (let r = 0; r < 3; r++) for (let x = -OX - 40; x < W + OX; x += 120) { const wx = x + ((t * 30 * (r + 1) + r * 40) % 120), wy = 340 + r * 40; X.beginPath(); X.moveTo(wx, wy); X.quadraticCurveTo(wx + 14, wy - 7, wx + 28, wy); X.stroke(); }
      /* windsock (reads the wind) and a seagull on the railing */
      { const px = 700, py = 330; X.beginPath(); X.moveTo(px, 428); X.lineTo(px, py); X.lineWidth = 10; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#c9ced6'; X.stroke();
        const dirx = wind >= 0 ? 1 : -1, lift = clamp(Math.abs(wind) / (A * 1.2), 0, 1), ang = (1 - lift) * 1.25, flut = Math.sin(t * 14) * .05;
        X.save(); X.translate(px, py); X.scale(dirx, 1); X.rotate(ang + flut);
        for (let i = 0; i < 4; i++) { const x0 = i * 17, x1 = x0 + 17, h0 = 15 - i * 3, h1 = 15 - (i + 1) * 3; X.beginPath(); X.moveTo(x0, -h0); X.lineTo(x1, -h1); X.lineTo(x1, h1); X.lineTo(x0, h0); X.closePath(); K.ink(i & 1 ? '#fff' : '#ff8a3d', 3); }
        X.restore(); }
      gull(112, 428, t, lost, 1);
      /* the donut: a giant rolling eyeball donut (Claude's unicycle) */
      X.save(); X.translate(0, -50);   // art-only: lifts donut + Claude so the face clears the fuse band
      const dx = lost ? fall * 380 * sg : 0, rot = a * 3 + c * .6 + dx * .02, DR = 78, DY = 540;
      shadow(400 + dx, 604, 110, 14, .3);
      X.save(); X.translate(400 + dx, DY); X.rotate(rot);
      const dough = K.PE(0, 0, DR, DR); K.cel(dough, '#f2b36b', '#c98a3c', 6, 6, 5);
      const ic = K.PE(0, -2, 68, 66); K.cel(ic, '#FF8FD0', '#d85fa0', 6, 6, 4);
      X.save(); X.clip(ic); for (let i = 0; i < 13; i++) { const aa = i * .5 + .2, rr_ = 44 + (i % 3) * 8; X.save(); X.translate(Math.cos(aa * 1.7) * rr_, Math.sin(aa * 1.7) * rr_); X.rotate(aa * 3); X.fillStyle = SPRK[i % 5]; K.rr(-6, -2.2, 12, 4.4, 2.2); X.fill(); X.restore(); } X.restore();
      K.glint(ic, -30, -42, 16, 7, .5, -.5);
      K.el(0, 0, 30, 30); K.ink('#3a1850', 4);
      X.restore();
      const em = lost ? 'dizzy' : win ? 'happy' : Math.abs(a) > .6 ? 'panic' : 'idle';
      K.eye(400 + dx, DY, 24, em, [lost ? 0 : -a * 2, lost ? 1 : .6], t, 0);
      { const mx = 400 + dx, my = DY + 50 - (lost ? 0 : Math.abs(a) * 4); X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath();
        if (win) X.arc(mx, my - 8, 14, .2, Math.PI - .2); else if (lost) { X.moveTo(mx - 16, my); X.lineTo(mx - 8, my + 4); X.lineTo(mx, my - 2); X.lineTo(mx + 8, my + 4); X.lineTo(mx + 16, my); } else if (Math.abs(a) > .6) { K.el(mx, my, 8, 10); X.fillStyle = '#8a1f3d'; X.fill(); } else { X.moveTo(mx - 14, my); X.lineTo(mx + 14, my); } X.stroke(); }
      /* a lonely sock tumbles through the wind */
      { const sw = VW + 200, sxx = ((c * 140 + 100) % sw) - OX - 100; X.save(); X.translate(sxx, 230 + Math.sin(c * 3) * 30); X.rotate(c * 4); snk(3, 0, 30, .55, t, { w: .2, noshadow: true, mood: 'panic' }); X.restore(); }
      /* Claude on one leg */
      const wk = win ? K.ease(oT / .3) : 0, ar = a * (1 - wk);
      const ly = lost ? Math.min(fall * fall * 700, 44) : win ? -Math.abs(Math.sin(oT * 9)) * 14 : 0;
      shadow(400 + (lost ? Math.min(fall * 380, 260) * sg : 0), 528, 60, 9, .25 * (lost ? 1 : 0));
      X.save();
      X.translate(400 + (lost ? Math.min(fall * 380, 260) * sg : 0), 462 + ly); X.rotate(ar * .55 + (lost ? sg * Math.min(fall * 4, 1.45) : 0));
      const fl = Math.sin(now * 12) * .3 * Math.min(1, Math.abs(a) * 2), amp = Math.min(1, Math.abs(a) * 1.6);
      if (win) K.arms(8, -.55, .55, 1);
      else if (lost) K.arms(8, -2.2 + Math.sin(now * 20) * .3, 2.2 - Math.sin(now * 20) * .3, 1);
      else K.arms(8, -(.5 + amp * 1.0) - fl, (.5 + amp * 1.0) + fl, .9);
      claude(0, 0, 8, { mood: mvMood(g) });
      K.rr(46, -26 + fl * 20, 28, 12, 4); K.ink(OR, 3); K.rr(-74, -26 - fl * 20, 28, 12, 4); K.ink(OR, 3);
      if (win) blush(0, 0, 8, .8);
      X.restore();
      if (!lost && !win && Math.abs(a) > .6) K.sweat(400 + a * 100 + 30, 380, 1.3, now);
      if (lost && fall > .12) for (let i = 0; i < 3; i++) { const aa = now * 8 + i * 2.1; K.star(400 + Math.min(fall * 380, 260) * sg + Math.cos(aa) * 46, 436 + Math.min(fall * fall * 700, 44) + Math.sin(aa) * 8, 10, 4.5, 5, aa, YEL, 3); }
      X.restore();
      /* wind streaks */
      X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 4; X.lineCap = 'round';
      for (let i = 0; i < 4 + Math.floor(OX / 150); i++) { const sw2 = VW + 100, x = ((now * 200 * (i % 2 ? 1 : -1) + i * 230) % sw2 + sw2) % sw2 - OX - 50, y = 200 + (i % 4) * 55; X.beginPath(); X.moveTo(x, y); X.lineTo(x + 46, y); X.stroke(); }
      /* sway meter: a wooden plaque with a red/green gauge */
      const mx = 210, mw = 380, my = 70;
      K.sign(mx - 18, my - 10, mw + 36, 52, 16);
      X.save(); K.rr(mx, my, mw, 32, 16); X.clip(); X.fillStyle = '#ff4d5e'; X.fillRect(mx, my, mw, 32); X.fillStyle = '#5CFF7A'; X.fillRect(mx + mw * (.5 - ZONE / 2), my, mw * ZONE, 32);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(mx, my + 3, mw, 7); X.fillStyle = INK; X.fillRect(mx + mw / 2 - 2, my, 4, 32); X.restore();
      K.rr(mx, my, mw, 32, 16); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
      for (const d of [-1, 1]) { const tx = mx + mw / 2 + d * (mw / 2 - 22); X.beginPath(); X.moveTo(tx + d * 8, my + 16); X.lineTo(tx - d * 6, my + 7); X.lineTo(tx - d * 6, my + 25); X.closePath(); K.ink(YEL, 2.5); }
      const px = mx + mw / 2 + clamp(a, -1, 1) * mw / 2;
      X.beginPath(); X.moveTo(px, my + 36); X.lineTo(px - 14, my + 66); X.lineTo(px + 14, my + 66); X.closePath(); X.lineWidth = 8; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke(); X.fillStyle = YEL; X.fill();
      X.fillStyle = INK; X.fillRect(px - 4, my - 4, 8, 40);
      vignette(.2);
    }
  };
  return g;
}
reg('mv_balance', mvBalance, 'Stand!');

})();
