'use strict';
/* MOVE IT! wave 1 — pose and rhythm microgames (WarioWare Move It! / Smooth Moves inspired).
   Poses are ArrowUp / ArrowDown / ArrowLeft / ArrowRight (or tap the on-screen pose buttons).
   Art: the DUO look (docs/ART-STYLE.md) — inked cel-shaded Claude + sentient snacks in four places: a snack-factory
   conveyor, a TV dance stage, a disco club and a tomato-soup swimming pool. Art only: decor never touches the game RNG (hr()). */
(function () {

const MAG = '#FF3EA5', PUR = '#7B3FE4', TEAL = '#19C6B7', GOLD = '#FFE14D';
const TAU = Math.PI * 2;
const mvMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const mvLose = (x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, '#ff4d4d', 14); ring(x, y, '#ff4d4d', 80); };
const mvWin = (x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 28); ring(x, y, '#fff', 110); shake(5, .2); };

/* ───────────── DUO-look kit (local copy; everything draws on X so scenes can be baked offscreen) ───────────── */
let X = null;
const hr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // decor randomness, never Math.random
const cl = k => Math.max(0, Math.min(1, k));
const ease = k => (k = cl(k), k * k * (3 - 2 * k));
const outBack = k => { k = cl(k) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const MIXC = {};
const mix = (a, b, k) => {
  const key = a + b + k; if (MIXC[key]) return MIXC[key];
  const p = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }, A = p(a), B = p(b);
  return MIXC[key] = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
/* flat base + one shade crescent: path() builds the shape; the base is re-filled shifted by (-sx,-sy) inside it */
function cel(path, base, shade, o = 4, sx = 4, sy = 5) {
  path(); ink(shade, o); X.save(); path(); X.clip(); X.translate(-sx, -sy); path(); X.fillStyle = base; X.fill(); X.restore();
}
function glint(x, y, rx, ry, a = .4, rot = -.5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function line(pts, w, col) {
  X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]));
  X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke();
}
function bake(fn) {            // paint once into a VW×600 layer (logical x from -OX), blit with layer(c)
  const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0);
  try { fn(); } finally { X = old; } return c;
}
const layer = c => X.drawImage(c, -OX, 0);
function eye(x, y, r, look, mood, T, k) {   // crane-style eye: sclera, pupil toward look, white dot, blink
  if (mood === 'happy') { X.beginPath(); X.arc(x, y + r * .3, r * .7, Math.PI * 1.1, Math.PI * 1.9); X.lineWidth = r * .45; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); return; }
  if (mood === 'dead') { X.lineWidth = r * .42; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .6, y - r * .6); X.lineTo(x + r * .6, y + r * .6); X.moveTo(x + r * .6, y - r * .6); X.lineTo(x - r * .6, y + r * .6); X.stroke(); return; }
  const pan = mood === 'panic', R = pan ? r * 1.3 : r;
  if (!pan && Math.sin(T * 1.9 + k) > .985) { X.lineWidth = r * .4; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - R, y); X.lineTo(x + R, y); X.stroke(); return; }
  el(x, y, R, R * 1.08); ink('#fff', Math.max(1.5, r * .28));
  const pr = pan ? r * .32 : r * .52, px = x + look[0] * R * .38, py = y + look[1] * R * .38;
  X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fillStyle = INK; X.fill();
  X.beginPath(); X.arc(px - pr * .35, py - pr * .4, Math.max(1, pr * .38), 0, TAU); X.fillStyle = '#fff'; X.fill();
}
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function drop(x, y, s, a = 1) {
  X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 1, 0, 6); X.quadraticCurveTo(-7, 1, 0, -9); X.closePath();
  ink('#9fe3ff', 2.5); X.fillStyle = '#fff'; el(-1.8, 0, 1.6, 2.4); X.fill(); X.restore();
}
function spark(x, y, r, col, rot = 0) {   // 4-point sparkle that also works while baking
  X.save(); X.translate(x, y); X.rotate(rot); X.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i & 1 ? r * .3 : r; X.lineTo(Math.cos(a) * q, Math.sin(a) * q); } X.closePath(); X.fillStyle = col; X.fill(); X.restore();
}
function starX(x, y, ro, col, rot = 0) {   // inked 5-point star on X
  X.save(); X.translate(x, y); X.rotate(rot); X.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i & 1 ? ro * .45 : ro; X.lineTo(Math.cos(a) * q, Math.sin(a) * q); } X.closePath(); ink(col, 2.5); X.restore();
}
function arrowG(cx, cy, dir, s, fill) {
  X.save(); X.translate(cx, cy); X.rotate(dir * Math.PI / 2);
  const p = [[0, -s], [s * .9, 0], [s * .35, 0], [s * .35, s], [-s * .35, s], [-s * .35, 0], [-s * .9, 0]];
  X.beginPath(); p.forEach(q => X.lineTo(q[0], q[1])); X.closePath(); ink(fill, 3); X.restore();
}
function pill(x, y, label, col, up = true) {   // name tag with a pointer: live only (uses txt)
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.max(54, X.measureText(t(label)).width + 26), h = 26;
  X.save(); X.translate(x, y);
  X.beginPath(); X.moveTo(-7, up ? h / 2 - 1 : -h / 2 + 1); X.lineTo(7, up ? h / 2 - 1 : -h / 2 + 1); X.lineTo(0, up ? h / 2 + 9 : -h / 2 - 9); X.closePath(); ink(col, 3);
  rr(-w / 2, -h / 2, w, h, h / 2); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(-w / 2 + 6, -h / 2 + 3, w - 12, 6, 3); X.fill(); X.restore();
  txt(label, x, y + 1, 15, INK, 'center', w - 8);
}
function badge(s, x, y, size, bg, fg, sc, rot) {   // feedback word pop (live only)
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(420, X.measureText(t(s)).width + size * .8), h = size * 1.2;
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .46); X.fill();
  rr(-w / 2, -h / 2, w, h, h * .46); ink(bg, 4); X.fillStyle = 'rgba(255,255,255,.35)'; rr(-w / 2 + 8, -h / 2 + 5, w - 16, h * .22, h * .1); X.fill();
  txt(s, 0, 2, size, fg, 'center', w - 14); X.restore();
}
function plate(x, y, w, h, col, dk, down, lit, r = 16) {   // chunky control slab with depth (face top = y)
  const d = down ? 3 : 9;
  rr(x, y + 9, w, h, r); ink(dk, 4); rr(x, y + 9 - d, w, h, r); ink(col, 4);
  X.fillStyle = 'rgba(255,255,255,.4)'; rr(x + 8, y + 9 - d + 5, w - 16, h * .16, h * .08); X.fill();
  if (lit) { X.strokeStyle = `rgba(255,255,255,${.35 + .35 * Math.sin(now * 9)})`; X.lineWidth = 3; rr(x + 5, y + 9 - d + 5, w - 10, h - 10, r - 4); X.stroke(); }
}
function keyCap(x, y, label) {   // white key with a letter (desktop only)
  rr(x - 15, y - 12, 30, 24, 6); ink('#fff', 2.5); txt(label, x, y + 1, 15, INK);
}
/* word pop beside the actor (the screen stamp stays the verdict) */
function slam(s, life, col, x, y, size = 50) {
  if (life <= 0) return;
  const k = outBack(1 - life), rot = Math.sin(now * 30) * .015 - .07;
  X.save(); X.globalAlpha = Math.min(1, life * 4); badge(s, x, y, size, col, '#fff', Math.max(.01, k), rot); X.restore();
}

/* ── Claude-shaped silhouettes in 5 poses: 0 up, 1 crouch, 2 left, 3 right, 4 neutral ── */
const KEYPOSE = { ArrowUp: 0, KeyW: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowRight: 3, KeyD: 3 };
const ARROW_DIR = [0, 2, 3, 1];           // pose index -> drawArrow dir (0 up, 1 right, 2 down, 3 left)
const LEGS = [[-5, -2, 1.2, 2], [-2.6, -2, 1.2, 2], [1.4, -2, 1.2, 2], [3.8, -2, 1.2, 2]];
const LEGC = [[-5.5, -2, 1.5, 2], [-2.8, -2, 1.5, 2], [1.3, -2, 1.5, 2], [4, -2, 1.5, 2]];
const BODY = [-6, -9, 12, 7];
const POSES = [
  { b: BODY, r: [[-8, -15, 2, 8], [6, -15, 2, 8]].concat(LEGS) },
  { b: [-7, -6, 14, 4], r: [[-9, -4.5, 2, 3], [7, -4.5, 2, 3]].concat(LEGC) },
  { b: BODY, r: [[-16, -7.5, 10, 2], [6, -6.5, 2, 2.4]].concat(LEGS) },
  { b: BODY, r: [[6, -7.5, 10, 2], [-8, -6.5, 2, 2.4]].concat(LEGS) },
  { b: BODY, r: [[-8, -6.5, 2, 2.4], [6, -6.5, 2, 2.4]].concat(LEGS) }
];
/* an inked, cel-shaded figure in one of the five poses. o: col/sh fill + shade, flat (silhouette), oc outline colour, bun (bun
   outline for the hot dog), face = idle|happy|sad|panic, look [lx,ly] */
function pfig(x, y, u, pi, o = {}) {
  const P = POSES[pi], parts = [P.b].concat(P.r), col = o.col || OR, sh = o.sh || '#b4553a', ol = o.ol != null ? o.ol : Math.max(2.5, u * .45);
  const path = s => rr(x + s[0] * u, y + s[1] * u, s[2] * u, s[3] * u, Math.min(s[2], s[3]) * u * .42);
  X.lineJoin = 'round';
  if (o.bun) {
    for (const s of parts) { path(s); X.lineWidth = (ol + o.bunW) * 2; X.strokeStyle = INK; X.stroke(); }
    for (const s of parts) { path(s); X.lineWidth = o.bunW * 2; X.strokeStyle = o.bun; X.stroke(); }
  } else for (const s of parts) { path(s); X.lineWidth = ol * 2; X.strokeStyle = o.oc || INK; X.stroke(); }
  for (const s of parts) {
    if (o.flat) { path(s); X.fillStyle = col; X.fill(); }
    else { path(s); X.fillStyle = sh; X.fill(); X.save(); path(s); X.clip(); X.translate(-u * .45, -u * .55); path(s); X.fillStyle = col; X.fill(); X.restore(); }
  }
  if (!o.flat) glint(x - 3.6 * u, y + (P.b[1] + .9) * u, 1.8 * u, .55 * u, .4);
  if (o.face) {
    const b = P.b, ey = y + (b[1] + b[3] * .42) * u, r = Math.min(1.35 * u, b[3] * u * .3), lk = o.look || [0, 0], f = o.face;
    for (const k of [-2.8, 2.8]) eye(x + k * u, ey, r, lk, f === 'sad' ? 'dead' : f, now, k);
    if (f !== 'sad' && f !== 'panic') { X.fillStyle = f === 'happy' ? 'rgba(255,110,165,.8)' : 'rgba(255,110,165,.5)'; for (const k of [-4.6, 4.6]) { el(x + k * u, ey + r * 1.25, r * .7, r * .38); X.fill(); } }
    if (b[3] >= 6) {
      const my = ey + r * 2.2; X.strokeStyle = INK; X.lineWidth = Math.max(2, u * .5); X.lineCap = 'round'; X.beginPath();
      if (f === 'happy') { X.arc(x, my - u * .4, u * 1.1, .15 * Math.PI, .85 * Math.PI); X.stroke(); }
      else if (f === 'sad') { X.moveTo(x - u * 1.2, my + u * .5); X.quadraticCurveTo(x, my - u * .6, x + u * 1.2, my + u * .5); X.stroke(); }
      else if (f === 'panic') { X.ellipse(x, my, u * .7, u * .9, 0, 0, TAU); X.fillStyle = '#5a0a2e'; X.fill(); X.stroke(); }
      else { X.moveTo(x - u * .8, my); X.lineTo(x + u * .8, my); X.stroke(); }
    }
  }
}
/* the dancing hot dog: sausage in a bun outline, mustard smile, wide googly eyes */
function pdog(x, y, u, pi, look, face) {
  pfig(x, y, u, pi, { col: '#E0402F', sh: '#aa2a1e', bun: '#F0B35A', bunW: u * .7, face: face || 'panic', look });
  const b = POSES[pi].b, my = y + (b[1] + b[3] * .9) * u;
  if (b[3] >= 6) { X.strokeStyle = '#FFE14D'; X.lineWidth = Math.max(2, u * .4); X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 4.5 * u, my); X.bezierCurveTo(x - 2.5 * u, my - u, x + 2.5 * u, my + u, x + 4.5 * u, my); X.stroke(); }
}
/* sentient snacks (0 hot dog, 1 donut, 2 banana, 3 sock, 4 toaster, 5 cheese). x,y = feet, s = scale, w = wobble 0..2 */
function snack(x, y, s, kind, t, w = 1, lk = [0, 0], face) {
  const ph = x * .013 + kind, hop = Math.abs(Math.sin(t * 6 + ph)) * 14 * s * w, sway = Math.sin(t * 6 + ph) * .22 * w;
  X.fillStyle = 'rgba(20,16,28,.25)'; el(x, y + 2, 26 * s, 6 * s); X.fill();
  X.save(); X.translate(x, y - hop); X.rotate(sway); X.scale(s, s * (1 + Math.sin(t * 12 + ph) * .05 * w));
  const sw = a => Math.sin(t * 9 + ph + a) * w;
  const arm = (ax, ay, d, c) => line([[ax, ay], [ax + d * 16, ay - 12 + sw(d) * 14], [ax + d * 26, ay - 26 + sw(d) * 22]], 6, c);
  const legs = (lw, c) => { for (const d of [-1, 1]) line([[d * lw, -6], [d * lw + Math.sin(t * 12 + ph + d) * 6 * w, 8]], 6, c); };
  const E = (ex, ey, r) => eye(ex, ey, r, lk, face, t, ph);
  if (kind === 0) {
    arm(-22, -40, -1, '#F0B35A'); arm(22, -40, 1, '#F0B35A'); legs(8, '#E0402F');
    cel(() => rr(-24, -76, 48, 76, 24), '#F0B35A', '#d08f3a', 4, 6, 4);
    cel(() => rr(-12, -78, 24, 80, 12), '#E0402F', '#aa2a1e', 3, 4, 4);
    X.strokeStyle = '#FFE14D'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(-8, -40); X.bezierCurveTo(-2, -48, 2, -32, 8, -42); X.stroke();
    E(-6, -62, 6.5); E(7, -62, 6.5);
  } else if (kind === 1) {
    arm(-30, -26, -1, '#FF8FD0'); arm(30, -26, 1, '#FF8FD0'); legs(10, '#FF8FD0');
    cel(() => { X.beginPath(); X.arc(0, -34, 34, 0, TAU); }, '#FF8FD0', '#e060a8', 4, 5, 6);
    X.beginPath(); X.arc(0, -34, 12, 0, TAU); ink('#fff', 3);
    X.fillStyle = '#fff'; for (const a of [0, 1.3, 2.6, 3.9, 5.2]) { X.save(); X.translate(Math.cos(a) * 24, -34 + Math.sin(a) * 24); X.rotate(a); X.fillRect(-4, -1.5, 8, 3); X.restore(); }
    E(0, -34, 8);
  } else if (kind === 2) {
    arm(-14, -46, -1, '#FFE14D'); arm(14, -46, 1, '#FFE14D'); legs(6, '#FFE14D');
    cel(() => { X.beginPath(); X.moveTo(-8, 4); X.bezierCurveTo(-44, -30, -22, -86, 18, -84); X.bezierCurveTo(2, -62, 6, -22, 14, 4); X.closePath(); }, '#FFE14D', '#e0b61e', 4, 5, 4);
    E(-4, -52, 6.5); E(8, -56, 6.5);
  } else if (kind === 3) {
    arm(-18, -34, -1, '#fff'); arm(18, -40, 1, '#fff');
    cel(() => { X.beginPath(); X.moveTo(-16, -84); X.lineTo(14, -84); X.lineTo(14, -36); X.quadraticCurveTo(40, -10, 22, 4); X.lineTo(-24, 4); X.quadraticCurveTo(-26, -20, -16, -40); X.closePath(); }, '#fff', '#c9c4de', 4, 5, 4);
    X.fillStyle = MAG; X.fillRect(-14, -82, 26, 10); X.fillRect(-18, -50, 30, 6);
    E(-3, -62, 6); E(7, -62, 6);
  } else if (kind === 4) {
    arm(-34, -26, -1, '#C9D2E0'); arm(34, -26, 1, '#C9D2E0'); legs(14, '#8f9cb3');
    const up = Math.max(0, Math.sin(t * 6 + ph)) * 20;
    cel(() => rr(-8, -76 - up, 16, 30, 4), '#F2D79A', '#d9b061', 3, 3, 3);
    cel(() => rr(-30, -52, 60, 52, 10), '#C9D2E0', '#8f9cb3', 4, 6, 5);
    E(-12, -28, 8); E(12, -28, 8);
  } else {
    arm(-24, -24, -1, '#FFC93C'); arm(24, -24, 1, '#FFC93C'); legs(10, '#FFC93C');
    cel(() => { X.beginPath(); X.moveTo(-36, 2); X.lineTo(0, -66); X.lineTo(36, 2); X.closePath(); }, '#FFC93C', '#e09a10', 4, 6, 5);
    X.fillStyle = '#e09a10'; for (const h of [[-12, -18, 5], [8, -30, 4], [14, -10, 6]]) { X.beginPath(); X.arc(h[0], h[1], h[2], 0, TAU); X.fill(); }
    E(-7, -34, 6.5); E(7, -34, 6.5);
  }
  X.restore();
}
/* a row of snacks across the whole screen. y = feet, w = wobble */
function crowd(y, t, w = 1, s = .85, lk = [0, 0], face, step = 96, skip) {
  const m = Math.ceil(OX / step);
  for (let i = -m; i < 9 + m; i++) { const sx0 = 30 + i * step + (i & 1) * 14; if (skip && sx0 > skip[0] && sx0 < skip[1]) continue; snack(sx0, y + ((i & 1) ? 10 : 0), s, ((i % 6) + 6) % 6, t, w, lk, face); }
}
/* the judgmental disco ball (moods: judge, shock, happy); the rope hangs from y0 when given */
function ball(x, y, r, t, mood, y0) {
  if (y0 != null) line([[x, y0], [x, y - r]], 3, '#8f9cb3');
  cel(() => { X.beginPath(); X.arc(x, y, r, 0, TAU); }, '#dfe6f7', '#9fb0d6', 4, r * .16, r * .18);
  X.save(); X.beginPath(); X.arc(x, y, r - 1, 0, TAU); X.clip();
  const rot = t * 1.4;
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const u = (i + (rot % 1)) * r / 3.1, v = j * r / 3.1; if (u * u + v * v > r * r) continue;
    X.fillStyle = ((i + j + (rot | 0)) & 1) ? 'rgba(255,255,255,.55)' : 'rgba(120,140,190,.45)'; X.fillRect(x + u - r / 8, y + v - r / 8, r / 4.2, r / 4.2);
  }
  X.restore(); glint(x - r * .42, y - r * .45, r * .26, r * .14, .7, -.6);
  const sh = mood === 'shock', em = sh ? 'panic' : mood === 'happy' ? 'happy' : 'idle';
  eye(x - r * .32, y + r * .02, r * .2, [0, 1], em, t, 3); eye(x + r * .32, y + r * .02, r * .2, [0, 1], em, t, 4);
  X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();
  if (mood === 'happy') X.arc(x, y + r * .38, r * .2, .1 * Math.PI, .9 * Math.PI);
  else if (sh) { X.ellipse(x, y + r * .5, r * .12, r * .16, 0, 0, TAU); X.fillStyle = '#5a0a2e'; X.fill(); }
  else { X.moveTo(x - r * .52, y - r * .2); X.lineTo(x - r * .12, y - r * .1); X.moveTo(x + r * .52, y - r * .2); X.lineTo(x + r * .12, y - r * .1); X.moveTo(x - r * .2, y + r * .5); X.lineTo(x + r * .2, y + r * .5); }
  X.stroke();
}
function beams(x, y, t, a = .1) {
  X.save(); X.globalAlpha = a; X.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) { const an = t * 1.1 + i * 1.256; X.beginPath(); X.moveTo(x, y); X.lineTo(x + Math.cos(an) * 900 - 40, y + Math.abs(Math.sin(an)) * 900); X.lineTo(x + Math.cos(an) * 900 + 40, y + Math.abs(Math.sin(an)) * 900); X.fill(); }
  X.restore();
}
function shad(x, y, rx, ry, a = .3) { X.fillStyle = `rgba(20,16,28,${a})`; el(x, y, rx, ry); X.fill(); }
function stars3(x, y, rad, T) { for (let i = 0; i < 3; i++) { const a = T * 6 + i * TAU / 3; starX(x + Math.cos(a) * rad, y + Math.sin(a) * rad * .4, 8, '#FFE14D', a); } }

/* on-screen pose buttons (keyboard arrows + touch). Hit zone unchanged; the plates are drawn a little higher to clear the fuse band. */
const BX = i => 400 + (i - 1.5) * 112, BY = 508;
function mvButtons(hl, dead) {
  for (let i = 0; i < 4; i++) {
    const x = BX(i), on = hl === i, py = BY - 14;
    if (dead) plate(x - 48, py, 96, 60, '#d3cfe0', '#8f88a6', false, false, 14);
    else plate(x - 48, py, 96, 60, on ? GOLD : '#fff', on ? '#c99512' : '#b9b3d0', on, !on && hl === -2, 14);
    arrowG(x, py + 15 + (on ? 6 : 0), ARROW_DIR[i], 9.5, dead ? '#f6f4fb' : on ? MAG : PUR);
    pfig(x, py + 55 + (on ? 6 : 0), 2.1, i, { col: dead ? '#f6f4fb' : INK, flat: true, ol: 0 });
  }
}
function mvBtnHit(p) {
  if (p.y < BY - 8) return -1;
  const i = Math.round((p.x - 400) / 112 + 1.5);
  return i >= 0 && i < 4 && Math.abs(p.x - BX(i)) <= 56 ? i : -1;
}
const poseKey = e => KEYPOSE[e.code] != null ? KEYPOSE[e.code] : -1;

/* ═════════════ 1 POSE · the snack-factory conveyor and the cheese bouncer ═════════════ */
let PBG = null, PBW = -1;
function poseBg() {
  if (PBG && PBW === VW) return PBG; PBW = VW;
  return PBG = bake(() => {
    const L = -OX - 2, R = W + OX + 2;
    let g = X.createLinearGradient(0, 0, 0, 446); g.addColorStop(0, '#ffc6e2'); g.addColorStop(1, '#ff98c8'); X.fillStyle = g; X.fillRect(L, 0, R - L, 446);
    X.strokeStyle = 'rgba(255,255,255,.35)'; X.lineWidth = 3; X.beginPath();
    for (let x = Math.floor(L / 60) * 60; x < R; x += 60) { X.moveTo(x, 58); X.lineTo(x, 446); }
    for (let y = 118; y < 446; y += 60) { X.moveTo(L, y); X.lineTo(R, y); }
    X.stroke();
    X.fillStyle = '#7c2a78'; X.fillRect(L, 0, R - L, 58); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 58); X.lineTo(R, 58); X.stroke();
    X.fillStyle = 'rgba(255,255,255,.1)'; X.fillRect(L, 4, R - L, 8);
    // night windows
    for (const wx of [30, -300]) {
      rr(wx, 118, 120, 130, 12); ink('#e8f4ff', 4);
      X.save(); rr(wx + 8, 126, 104, 114, 7); X.clip(); g = X.createLinearGradient(0, 126, 0, 240); g.addColorStop(0, '#1d1840'); g.addColorStop(1, '#3d3480'); X.fillStyle = g; X.fillRect(wx, 126, 120, 120);
      X.beginPath(); X.arc(wx + 78, 160, 17, 0, TAU); X.fillStyle = '#fff3b0'; X.fill(); X.beginPath(); X.arc(wx + 85, 155, 15, 0, TAU); X.fillStyle = '#2a2460'; X.fill();
      for (let i = 0; i < 6; i++) spark(wx + 14 + hr(i + wx) * 90, 134 + hr(i * 3 + wx) * 90, 3 + hr(i) * 3, '#fff3b0');
      X.restore();
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(wx + 60, 126); X.lineTo(wx + 60, 240); X.moveTo(wx + 8, 183); X.lineTo(wx + 112, 183); X.stroke();
      glint(wx + 30, 150, 8, 24, .35, .5);
    }
    // wainscot
    g = X.createLinearGradient(0, 340, 0, 446); g.addColorStop(0, '#d6489a'); g.addColorStop(1, '#a02a78'); X.fillStyle = g; X.fillRect(L, 340, R - L, 106);
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 340); X.lineTo(R, 340); X.stroke();
    X.strokeStyle = 'rgba(20,16,28,.2)'; X.lineWidth = 3; X.beginPath(); for (let x = Math.floor(L / 90) * 90; x < R; x += 90) { X.moveTo(x, 346); X.lineTo(x, 446); } X.stroke();
    X.fillStyle = 'rgba(255,255,255,.28)'; X.fillRect(L, 344, R - L, 4);
    // pipe rail for the swinging ball
    rr(L, 58, R - L, 12, 6); ink('#cfd8e6', 3); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(L, 61, R - L, 3);
    // belt frame, hazard stripe and the checker floor
    X.fillStyle = '#c9ced6'; X.fillRect(L, 494, R - L, 14); X.strokeStyle = INK; X.lineWidth = 4; X.strokeRect(L, 494, R - L, 14);
    X.save(); X.beginPath(); X.rect(L, 510, R - L, 12); X.clip(); X.fillStyle = '#ffd23f'; X.fillRect(L, 510, R - L, 12); X.fillStyle = INK;
    for (let x = Math.floor(L / 28) * 28; x < R + 30; x += 28) { X.beginPath(); X.moveTo(x, 522); X.lineTo(x + 14, 522); X.lineTo(x + 26, 510); X.lineTo(x + 12, 510); X.fill(); }
    X.restore(); X.strokeStyle = INK; X.lineWidth = 4; X.strokeRect(L, 510, R - L, 12);
    for (let r = 0; 522 + r * 26 < H; r++) for (let x = Math.floor(L / 64) * 64; x < R; x += 64) { X.fillStyle = ((x / 64 | 0) + r) & 1 ? '#2b0f5e' : '#3b1d6e'; X.fillRect(x, 522 + r * 26, 64, 26); }
    X.fillStyle = 'rgba(255,255,255,.1)'; X.fillRect(L, 526, R - L, 4);
  });
}
reg('mv_pose', sp => {
  const rs = Math.sqrt(sp), R = sp >= 1.6 ? 2 : 1, DUR = 4.5, PASS = .25;
  const RT = (DUR / rs - .3 - R * PASS) / R;
  const SX = -OX + 100;   // conveyor start: left screen edge
  const HOLES = [[560, 110, 14], [780, 95, 20], [540, 250, 11], [790, 300, 16], [590, 410, 12], [760, 420, 10]], BELT = [0, 3, 2, 5];
  let r = 0, c = 0, c2 = 0, cur = 4, tgt = (Math.random() * 4) | 0, phase = 0, wallT = 0, flash = 0, snap = 0, belt = 0, slamT = 0, slamS = '', jaw = 0, oT = 0;
  const press = pi => {
    if (g.result || phase || pi < 0) return;
    cur = pi; snap = .2; sfx.blip(pi * 2 + 3); snd(500 + pi * 120, .09, 'sine', .06, 0, 900);
    const x = SX + (500 - SX) * Math.min(1, c / RT);
    ring(x, 400, '#fff', 60, .3); burst(x, 420, GOLD, 6, 160);
  };
  const g = {
    wide: true, cmd: 'FEED THE WALL!', hint: 'ARROWS: MATCH THE HOLE', thint: 'TAP THE POSE THAT FITS', dur: DUR,
    key(e) { if (!e.repeat) press(poseKey(e)); },
    down(p) { press(mvBtnHit(p)); },
    update(dt) {
      wallT = Math.max(0, wallT - dt); flash = Math.max(0, flash - dt); snap = Math.max(0, snap - dt); slamT = Math.max(0, slamT - dt * 1.5); jaw = Math.max(0, jaw - dt);
      if (g.result) { oT += dt; return; }
      belt += dt;
      if (phase === 0) {
        c += dt;
        if (c >= RT) {
          c = RT;
          if (cur === tgt) {
            phase = 1; c2 = 0; flash = .25; jaw = .3; slamT = 1; slamS = 'NOM!'; sfx.hit(); sfx.stamp(); sfx.boing(); shake(7, .22);
            burst(520, 300, GOLD, 16, 320); ring(520, 330, '#fff', 120); floatText('MATCH!', 400, 250, '#5CFF7A', 46);
          } else {
            g.result = 'lose'; slamT = 1; slamS = 'WHAT?!'; mvLose(500, 380); sfx.boing(); sfx.splat(); snd(900, .3, 'sawtooth', .05, 0, 120);
            floatText('BONK!', 440, 250, '#ff4d4d', 50);
          }
        }
      } else {
        c2 += dt;
        if (c2 >= PASS) {
          r++;
          if (r >= R) { g.result = 'win'; mvWin(560, 360); confetti(660, 300, 24); }
          else {
            let n; do { n = (Math.random() * 4) | 0; } while (n === tgt);
            tgt = n; cur = 4; c = 0; phase = 0; wallT = .3; sfx.whoosh(true); snd(300, .25, 'sine', .06, 0, 600);
          }
        }
      }
    },
    draw(t) {
      X = ctx;
      const k = Math.min(1, c / RT), danger = k > .75 && !phase && !g.result, win = g.result === 'win', lose = g.result === 'lose';
      layer(poseBg());
      // the judgmental disco ball swings on its pipe trolley
      const bx = 255 + Math.sin(t * .9) * 45, by = 152 + Math.sin(t * 2) * 8 + (lose ? 22 : 0);
      rr(bx - 17, 56, 34, 18, 6); ink('#8f9cb3', 3);
      ball(bx, by, 40, t, danger || lose ? 'shock' : win ? 'happy' : 'judge', 72);
      beams(bx, by, t, .07);
      // the wall: a screaming cheese bouncer with a mouth-shaped hole (runs off the right screen edge)
      const WE = Math.max(820, W + OX + 10), sx = danger ? Math.sin(t * 60) * 3 : 0;
      X.save(); X.translate(sx, 0);
      cel(() => rr(520, 70, WE - 520 + 40, 380, 24), '#FFC93C', '#e09a10', 5, -16, 8);
      for (const h of HOLES) { el(h[0], h[1], h[2], h[2] * .85); ink('#d98a0c', 2.5); X.fillStyle = 'rgba(255,255,255,.3)'; el(h[0] - h[2] * .3, h[1] - h[2] * .3, h[2] * .3, h[2] * .2, -.5); X.fill(); }
      glint(560, 90, 26, 7, .45, -.2);
      const mry = 100 * (1 + jaw * .6 + (danger ? .15 : 0) + (lose ? .1 : 0));
      el(660, 350, 102, mry); ink('#6a0a38', 6); X.save(); el(660, 350, 102, mry); X.clip();
      X.fillStyle = '#4a062a'; X.fillRect(540, 350 - mry, 240, mry * .5);
      el(660 + Math.sin(t * 5) * 6, 350 + mry * .85, 72, 24); ink('#ff6fa5', 3); glint(640, 350 + mry * .8, 22, 5, .4, -.1);
      X.restore();
      X.fillStyle = '#fff'; X.strokeStyle = INK; X.lineWidth = 3; X.lineJoin = 'round';
      for (let i = 0; i < 7; i++) { const tx = 580 + i * 26.7, ty = 350 - mry * Math.sqrt(Math.max(0, 1 - Math.pow((tx - 660) / 102, 2))); X.beginPath(); X.moveTo(tx - 12, ty - 3); X.lineTo(tx, ty + 24); X.lineTo(tx + 12, ty - 3); X.closePath(); X.fill(); X.stroke(); }
      // eyes track the conveyor
      const cx0 = phase ? 500 : SX + (500 - SX) * k, lk = (cx0 - 660) / 300, er = 26 * (1 + (danger ? .2 : 0) + jaw * .5), em = win || lose ? 'happy' : danger ? 'panic' : 'idle';
      X.fillStyle = 'rgba(255,110,165,.5)'; el(572, 205, 22, 10); X.fill(); el(748, 205, 22, 10); X.fill();
      eye(600, 165, er, [lk, .5], em, t, 1); eye(720, 165, er, [lk, .5], em, t, 2);
      X.strokeStyle = INK; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath();
      const bw = lose ? -6 : danger ? 12 : 0; X.moveTo(580, 125 - bw); X.lineTo(628, 138 + bw * .3); X.moveTo(752, 125 - bw); X.lineTo(692, 138 + bw * .3); X.stroke();
      if (lose) { drop(572, 192 + (oT * 60) % 26, 1.2, 1 - ((oT * 60) % 26) / 26); drop(748, 192 + (oT * 60 + 9) % 26, 1.2, 1 - ((oT * 60 + 9) % 26) / 26); }
      // the hole shape to match (a silhouette that blinks)
      const hu = 7 * (1 + wallT * 1.2);
      pfig(660, 444, hu, tgt, { col: '#1b0a38', flat: true, oc: (now * 6 | 0) % 2 ? GOLD : '#fff', ol: 5 });
      // neon target sign
      X.fillStyle = 'rgba(20,16,28,.3)'; X.beginPath(); X.arc(564, 107, 31, 0, TAU); X.fill();
      X.beginPath(); X.arc(560, 100, 29, 0, TAU); ink(GOLD, 4); glint(550, 88, 10, 5, .6, -.5);
      arrowG(560, 100, ARROW_DIR[tgt], 15, PUR);
      if (flash > 0) { X.globalAlpha = flash * 1.6; X.fillStyle = '#fff'; rr(520, 70, WE - 520, 380, 24); X.fill(); X.globalAlpha = 1; }
      X.restore();
      // the conveyor belt
      rr(-OX - 12, 440, VW + 24, 56, 12); ink('#3b3550', 4); X.fillStyle = '#5a5274'; X.fillRect(-OX, 446, VW, 5);
      X.fillStyle = '#6b6290'; const off = (belt * 140) % 48;
      for (let x = -OX - 48 + off; x < W + OX; x += 48) { X.beginPath(); X.moveTo(x, 460); X.lineTo(x + 20, 469); X.lineTo(x, 478); X.lineTo(x + 8, 469); X.closePath(); X.fill(); }
      X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(-OX, 442, VW, 3);
      for (let x = -OX + 20; x < W + OX; x += 120) { X.beginPath(); X.arc(x, 496, 7, 0, TAU); ink('#c9ced6', 3); }
      // snacks riding the factory belt
      const sp2 = VW + 100;
      for (let i = 0; i < 4; i++) snack(-OX - 50 + ((i * sp2 / 4 + belt * 140) % sp2), 446, .5, BELT[i], t, .7, [1, 0], win ? 'happy' : lose ? 'panic' : undefined);
      // claude rides the belt
      const x = phase ? 500 + 160 * Math.min(1, c2 / PASS) : SX + (500 - SX) * k;
      const bob = g.result ? 0 : Math.abs(Math.sin(belt * 14)) * 3, sq = snap > 0 ? 1 + snap * .5 : 1, fl = lose ? ease(oT / .15) : 0;
      shad(x, 446, 60, 10, .35);
      X.save(); X.translate(x, 444 - bob); X.scale(sq * (1 - fl * .22), (2 - sq) * (1 + fl * .06)); X.translate(-x, -444 + bob);
      pfig(x, 444 - bob, 7, cur, { face: lose ? 'sad' : win ? 'happy' : danger ? 'panic' : 'idle', look: [(660 - x) / 300, 0] });
      X.restore();
      if (lose) stars3(x, 444 - 9 * 7 - 12, 30, t);
      pill(x, 444 - bob - 9 * 7 - 26, 'YOU', OR);
      if (danger && cur !== tgt) badge('!', x, 316, 46, '#ff4d5e', '#fff', 1 + Math.sin(t * 20) * .06, 0);
      if (win) for (let i = 0; i < 3; i++) { const q = ((oT * 1.1 + i * .33) % 1); heart(610 + i * 50 + Math.sin(i + oT * 6) * 8, 232 - q * 100, .9 * (1 - q * .4)); }
      // the timer: a hot dog riding a track to the cheese
      rr(20, 86, 230, 22, 11); ink('#fff', 3);
      X.save(); rr(22, 88, 226, 18, 9); X.clip(); X.fillStyle = k > .75 ? '#ff4d5e' : TEAL; X.fillRect(22, 88, 226 * k, 18); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(22, 90, 226 * k, 5); X.restore();
      const mx = 24 + 200 * k; rr(mx - 3, 82, 30, 26, 8); ink(OR, 3); eye(mx + 12, 94, 4, [1, 0], danger ? 'panic' : 'idle', t, 5);
      X.beginPath(); X.moveTo(244, 112); X.lineTo(264, 96); X.lineTo(264, 112); X.closePath(); ink('#FFC93C', 2.5);
      if (R > 1) txt((r + 1) + '/' + R, 290, 98, 24, '#fff');
      mvButtons(cur === 4 ? -1 : cur, !!g.result);
      slam(slamS, slamT, slamS === 'NOM!' ? '#4fd06a' : '#ff4d5e', 440, 104, 40);
      vignette(.2);
    }
  };
  return g;
}, 'POSE!');

/* ═════════════ 2 COPY · a TV dance show: a hot dog dances, the bleachers watch, you copy ═════════════ */
let SBG = null, SBW = -1;
function stageBg() {
  if (SBG && SBW === VW) return SBG; SBW = VW;
  return SBG = bake(() => {
    const L = -OX - 2, R = W + OX + 2;
    let g = X.createLinearGradient(0, 0, 0, 392); g.addColorStop(0, '#2a1a6e'); g.addColorStop(1, '#5b36b8'); X.fillStyle = g; X.fillRect(L, 0, R - L, 396);
    for (let i = 0; i < 40; i++) spark(L + hr(i + 7) * (R - L), 50 + hr(i * 5 + 1) * 280, 3 + hr(i + 2) * 5, 'rgba(255,240,150,.35)', hr(i) * 3);
    // bleachers with the audience standing on the top tier
    X.fillStyle = '#4b2fa0'; X.fillRect(L, 330, R - L, 66); X.fillStyle = '#6a46c4'; X.fillRect(L, 330, R - L, 8);
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 330); X.lineTo(R, 330); X.stroke();
    X.fillStyle = 'rgba(20,16,28,.25)'; X.fillRect(L, 362, R - L, 4);
    // stage floor
    g = X.createLinearGradient(0, 392, 0, H); g.addColorStop(0, '#c98a4b'); g.addColorStop(1, '#8a5530'); X.fillStyle = g; X.fillRect(L, 392, R - L, H - 392);
    X.strokeStyle = 'rgba(80,40,20,.35)'; X.lineWidth = 2; X.beginPath();
    for (let y = 410, i = 0; y < H; y += 26 + i * 3, i++) { X.moveTo(L, y); X.lineTo(R, y); }
    for (let y = 410, i = 0; y < H; y += 26 + i * 3, i++) for (let x = Math.floor(L / 150) * 150 + (i & 1) * 75; x < R; x += 150) { X.moveTo(x, y); X.lineTo(x, y + 26 + i * 3); }
    X.stroke(); X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(L + i * 220, H); X.lineTo(L + i * 220 + 70, H); X.lineTo(L + i * 220 + 170, 395); X.lineTo(L + i * 220 + 130, 395); X.fill(); }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 392); X.lineTo(R, 392); X.stroke();
    // spotlight cones
    for (const sx of [200, 600]) {
      X.fillStyle = 'rgba(255,248,200,.13)'; X.beginPath(); X.moveTo(sx - 30, 54); X.lineTo(sx + 30, 54); X.lineTo(sx + 150, 432); X.lineTo(sx - 150, 432); X.closePath(); X.fill();
      X.fillStyle = 'rgba(255,248,200,.2)'; el(sx, 426, 160, 22); X.fill();
      rr(sx - 22, 44, 44, 20, 8); ink('#8f9cb3', 3);
    }
    // curtains on both sides, tied back with a gold rope
    for (const side of [-1, 1]) {
      const edge = side < 0 ? 170 : 630, far = side < 0 ? L : R, w = Math.abs(far - edge);
      X.save(); X.beginPath(); X.moveTo(far, 0); X.lineTo(edge, 0); X.bezierCurveTo(edge - side * 50, 150, edge + side * 20, 260, edge - side * 10, 396); X.lineTo(far, 396); X.closePath();
      X.fillStyle = '#9a2a6e'; X.fill(); X.clip();
      const n = Math.ceil(w / 34) + 1;
      for (let i = 0; i < n; i++) { const fx = far - side * i * 34; X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(Math.min(fx, fx - side * 12), 0, 12, 396); X.fillStyle = 'rgba(20,16,28,.22)'; X.fillRect(Math.min(fx - side * 14, fx - side * 26), 0, 12, 396); }
      X.restore();
      X.beginPath(); X.moveTo(far, 0); X.lineTo(edge, 0); X.bezierCurveTo(edge - side * 50, 150, edge + side * 20, 260, edge - side * 10, 396); X.lineWidth = 8; X.strokeStyle = INK; X.stroke();
      line([[edge - side * 8, 250], [edge - side * 40, 262]], 5, '#ffd23f'); X.beginPath(); X.arc(edge - side * 44, 266, 8, 0, TAU); ink('#ffd23f', 3);
    }
    // valance
    X.fillStyle = '#7a1a5c'; X.fillRect(L, 0, R - L, 46); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 46); X.lineTo(R, 46); X.stroke();
    X.fillStyle = '#ffd23f'; for (let x = Math.floor(L / 40) * 40; x < R; x += 40) { X.beginPath(); X.arc(x + 20, 46, 20, 0, Math.PI); ink('#ffd23f', 3); }
    // pad shadows
    for (const sx of [200, 600]) shad(sx, 440, 140, 14, .3);
  });
}
reg('mv_mirror', sp => {
  const rs = Math.sqrt(sp), B = .62 / rs, D0 = .45 / rs, seq = [];
  for (let i = 0; i < 3; i++) { let n; do { n = (Math.random() * 4) | 0; } while (i && n === seq[i - 1]); seq.push(n); }
  let c = 0, phase = 0, i = 0, tp = 4, pp = 4, pt = 0, lastStep = -1, bounce = 0, slamT = 0, slamS = '', failAt = -1, cheer = 0, oT = 0;
  const press = pi => {
    if (g.result || phase !== 1 || pi < 0) return;
    pp = pi; pt = .5; bounce = .2;
    if (pi === seq[i]) {
      sfx.blip(i * 3 + 2); sfx.pop(); burst(600, 300, '#5CFF7A', 10); ring(600, 300, '#5CFF7A', 80, .35); cheer = .5;
      i++; floatText('OK!', 600, 170, '#5CFF7A', 34);
      if (i >= 3) { g.result = 'win'; mvWin(600, 300); slamT = 1; slamS = 'NOM!'; confetti(200, 300, 24); }
    } else { g.result = 'lose'; failAt = c; slamT = 1; slamS = 'WHAT?!'; mvLose(600, 300); sfx.boing(); sfx.splat(); }
  };
  const g = {
    wide: true, cmd: 'COPY THE DOG!', hint: 'ARROWS: REPEAT THE DANCE', thint: 'TAP THE POSES IN ORDER', dur: 6,
    key(e) { if (!e.repeat) press(poseKey(e)); },
    down(p) { press(mvBtnHit(p)); },
    update(dt) {
      c += dt; pt = Math.max(0, pt - dt); bounce = Math.max(0, bounce - dt); slamT = Math.max(0, slamT - dt * 1.5); cheer = Math.max(0, cheer - dt);
      if (pt <= 0 && pp !== 4 && !g.result) pp = 4;
      if (g.result) { oT += dt; return; }
      if (phase === 0) {
        const s = Math.floor((c - D0) / B);
        if (s >= 3) { phase = 1; tp = 4; sfx.sparkle(); floatText('GO!', 400, 250, GOLD, 56); ring(600, 300, GOLD, 100); }
        else if (s >= 0) {
          if (s !== lastStep) { lastStep = s; sfx.blip(seq[s] * 2 + 3); sfx.hit(); snd(700 + seq[s] * 90, .1, 'sine', .06, 0, 1300); burst(200, 290, GOLD, 8); ring(200, 300, '#fff', 70, .3); cheer = .3; }
          tp = (c - D0) - s * B < B * .75 ? seq[s] : 4;
        }
      }
    },
    draw(t) {
      X = ctx;
      const lost = g.result === 'lose', won = g.result === 'win';
      layer(stageBg());
      crowd(384, t, lost ? 0 : cheer > 0 || won ? 2.4 : .9, .62, [lost ? 0 : Math.sin(t * 2), .3], lost ? 'panic' : won ? 'happy' : undefined);
      // boom mic sweeping over the stage
      const mxp = 640 + Math.sin(t * 1.3) * 22, myp = 190 + Math.cos(t * 1.7) * 6;
      line([[W + OX + 30, 150], [mxp, myp]], 5, '#8f9cb3');
      rr(mxp - 11, myp - 6, 22, 38, 11); ink('#5a5274', 3); glint(mxp - 4, myp + 6, 3, 8, .5, 0);
      // stage pads
      for (const sx of [200, 600]) {
        rr(sx - 130, 404 + 9, 260, 28, 12); ink(sx < 400 ? '#8a5fd4' : '#e59ac4', 4); rr(sx - 130, 404, 260, 28, 12); ink(sx < 400 ? '#B98CFF' : '#FFC9E6', 4);
        X.fillStyle = 'rgba(255,255,255,.45)'; rr(sx - 118, 409, 236, 6, 3); X.fill();
      }
      const bob = Math.abs(Math.sin(t * 8)) * (phase === 0 ? 4 : 2), fl = lost ? Math.min(1.5, (c - failAt) * 6) : 0;
      // the hot dog dancer (falls over when you blow it)
      const hop = won ? Math.abs(Math.sin(t * 9)) * 16 : 0;
      X.save(); X.translate(200, 404); X.rotate(-fl); X.translate(-200, -404);
      pdog(200, 404 - bob - hop, 9, tp, [lost ? 0 : .6, lost ? -1 : .3], lost ? 'sad' : won ? 'happy' : 'panic');
      X.restore();
      const cy = 404 - (bounce > 0 ? 12 * Math.sin(bounce / .2 * 3.14) : bob * .5) - (won ? Math.abs(Math.sin(t * 9 + 1)) * 14 : 0);
      pfig(600, cy, 9, pp, { face: lost ? 'sad' : won ? 'happy' : phase === 0 ? 'idle' : 'panic', look: [-1, 0] });
      if (phase === 1 && !g.result) { pill(600, 214, (now * 4 | 0) % 2 ? 'YOU!' : 'YOU', GOLD); }
      else pill(600, 214, 'YOU', OR);
      pill(200, 214, phase === 0 ? 'WATCH' : 'COPY', '#fff');
      if (phase === 0 && tp !== 4) { X.beginPath(); X.arc(200, 150, 38, 0, TAU); ink('#fff', 4); arrowG(200, 150, ARROW_DIR[tp], 24, GOLD); }
      if (lost) { // a rotten tomato from the crowd lands on Claude's chest
        const q = cl(oT / .32), tx = lerp(740, 606, q), ty = lerp(380, 340, q) - Math.sin(q * Math.PI) * 50;
        if (q < 1) { X.beginPath(); X.arc(tx, ty, 14, 0, TAU); ink('#ff4d3d', 3); glint(tx - 5, ty - 5, 4, 2.5, .6); X.fillStyle = '#4fd06a'; X.beginPath(); X.arc(tx, ty - 13, 4, 0, TAU); X.fill(); }
        else { const sq = outBack((oT - .32) / .2); X.save(); X.translate(606, 340); X.scale(sq, sq); X.beginPath(); for (let a = 0; a < 10; a++) { const rad = a & 1 ? 12 : 22; X.lineTo(Math.cos(a * Math.PI / 5) * rad, Math.sin(a * Math.PI / 5) * rad * .8); } X.closePath(); ink('#ff4d3d', 3); X.fillStyle = '#ffb3a3'; X.beginPath(); X.arc(-5, -5, 4, 0, TAU); X.fill(); X.restore(); line([[600, 354], [600, 354 + Math.min(20, (oT - .4) * 60)]], 4, '#ff4d3d'); }
      }
      if (won) for (let h = 0; h < 4; h++) { const q = ((oT * 1.1 + h * .25) % 1); heart(150 + h * 150 + Math.sin(h * 2 + oT * 5) * 10, 330 - q * 130, .9 * (1 - q * .4)); }
      // sequence slots: bulb-lit plates
      for (let s = 0; s < 3; s++) {
        const sx = 400 + (s - 1) * 90, done = phase === 1 ? s < i : s <= lastStep, pop = done ? 1 + .12 * Math.sin(cl(((phase === 1 ? 0 : 0) + ((now * 3) % 1)) * 0)) : 1;
        rr(sx - 34, 72 + 8, 68, 68, 14); ink('#3a1f7a', 4); rr(sx - 34, 72, 68, 68, 14); ink(done ? '#fff' : '#6a46c4', 4);
        X.fillStyle = 'rgba(255,255,255,.3)'; rr(sx - 26, 77, 52, 8, 4); X.fill();
        for (let b = 0; b < 8; b++) { const a = b * TAU / 8; X.beginPath(); X.arc(sx + Math.cos(a) * 29, 106 + Math.sin(a) * 29, 3, 0, TAU); X.fillStyle = (((now * 4) | 0) + b) % 2 ? '#ffd23f' : '#fff3a0'; X.fill(); }
        if (done) arrowG(sx, 106, ARROW_DIR[seq[s]], 20, phase === 1 ? '#4fd06a' : MAG); else txt('?', sx, 108, 40, '#fff');
      }
      mvButtons(pt > 0 ? pp : -1, !!g.result);
      slam(slamS, slamT, slamS === 'NOM!' ? '#4fd06a' : '#ff4d5e', slamS === 'NOM!' ? 690 : 120, slamS === 'NOM!' ? 230 : 200, 40);
      vignette(.2);
    }
  };
  return g;
}, 'COPY!');

/* ═════════════ 3 BEAT · the disco club: a judging eyeball on a pedestal, a judgmental ball, an audience of snacks ═════════════ */
let BBG = null, BBW = -1;
const SPK = () => [-OX + 14, W + OX - 98];
function clubBg() {
  if (BBG && BBW === VW) return BBG; BBW = VW;
  return BBG = bake(() => {
    const L = -OX - 2, R = W + OX + 2;
    let g = X.createLinearGradient(0, 0, 0, 470); g.addColorStop(0, '#1d1840'); g.addColorStop(1, '#4a2f9a'); X.fillStyle = g; X.fillRect(L, 0, R - L, 472);
    for (let i = 0; i < 36; i++) spark(L + hr(i + 11) * (R - L), 70 + hr(i * 7 + 3) * 330, 2 + hr(i + 5) * 4, 'rgba(255,240,170,.4)', hr(i) * 3);
    // neon wall stripes
    for (const [y, col] of [[430, MAG], [446, TEAL]]) { X.fillStyle = col; X.globalAlpha = .55; X.fillRect(L, y, R - L, 5); X.globalAlpha = 1; }
    // pipe rail
    rr(L, 58, R - L, 12, 6); ink('#8f9cb3', 3); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(L, 61, R - L, 3);
    // dance floor: dark tiles, the lit ones flash live
    X.fillStyle = INK; X.fillRect(L, 464, R - L, H - 464);
    for (let r = 0; 470 + r * 30 < H; r++) for (let x = Math.floor(L / 64) * 64; x < R; x += 64) { X.fillStyle = ((x / 64 | 0) + r) & 1 ? '#2b0f5e' : '#3b1d6e'; X.fillRect(x + 2, 470 + r * 30 + 2, 60, 26); }
    // speaker stacks
    for (const sx of SPK()) { rr(sx, 296, 84, 176, 10); ink('#3b3550', 4); X.fillStyle = '#5a5274'; X.fillRect(sx + 6, 302, 72, 6); glint(sx + 18, 330, 4, 24, .22, 0); }
  });
}
function bigEye(cx, cy, tr, t, o) {   // the giant judging eyeball: veins, iris, pupil, glint, lid
  cel(() => { X.beginPath(); X.arc(cx, cy, tr, 0, TAU); }, '#fff', '#dcdff2', 6, 7, 9);
  X.save(); X.beginPath(); X.arc(cx, cy, tr - 2, 0, TAU); X.clip(); X.strokeStyle = 'rgba(255,90,110,.55)'; X.lineWidth = 2.5; X.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const a = i * 0.7 + 1.2, rx = Math.cos(a), ry = Math.sin(a); X.beginPath(); X.moveTo(cx + rx * tr, cy + ry * tr); X.quadraticCurveTo(cx + rx * tr * .72 + ry * 8, cy + ry * tr * .72 - rx * 8, cx + rx * tr * (.5 + hr(i) * .15), cy + ry * tr * (.5 + hr(i) * .15)); X.stroke(); }
  const ix = cx + o.look * 12, iy = cy + o.lookY;
  X.beginPath(); X.arc(ix, iy, tr * .6, 0, TAU); X.fillStyle = '#c21f78'; X.fill(); X.beginPath(); X.arc(ix - 2, iy - 3, tr * .52, 0, TAU); X.fillStyle = MAG; X.fill();
  if (o.heart) { heart(ix, iy + 4, tr * .052); }
  else { X.beginPath(); X.arc(ix, iy, tr * .32 * o.pup, 0, TAU); X.fillStyle = INK; X.fill(); glint(ix - tr * .12, iy - tr * .14, tr * .1, tr * .06, .9, -.5); }
  X.restore();
  // eyelid: judging at idle, wide on a perfect, slammed when you blow it
  if (o.lid > 0) {
    const ly = cy - tr + 2 * tr * o.lid, sl = o.slant * tr * .35;
    X.save(); X.beginPath(); X.arc(cx, cy, tr + 1, 0, TAU); X.clip();
    X.beginPath(); X.moveTo(cx - tr - 6, cy - tr - 6); X.lineTo(cx + tr + 6, cy - tr - 6); X.lineTo(cx + tr + 6, ly + sl); X.lineTo(cx - tr - 6, ly - sl); X.closePath(); ink('#e8a07a', 4);
    X.fillStyle = '#c9805a'; X.beginPath(); X.moveTo(cx - tr - 6, ly - sl - 12); X.lineTo(cx + tr + 6, ly + sl - 12); X.lineTo(cx + tr + 6, ly + sl - 5); X.lineTo(cx - tr - 6, ly - sl - 5); X.fill();
    X.restore();
  }
  X.beginPath(); X.arc(cx, cy, tr, 0, TAU); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
}
reg('mv_beat', sp => {
  const rs = Math.sqrt(sp), B = .8 / rs, T = 1.15 / rs, H0 = 1.3 / rs, GOODW = .19 - .04 * (sp - 1), PERF = .07;
  const hs = [H0, H0 + B, H0 + 2 * B], ticks = [H0 - B, hs[0], hs[1], hs[2]], ticked = [0, 0, 0, 0];
  const res = [0, 0, 0];     // 0 pending, 1 good, 2 perfect
  let c = 0, j = 0, pulse = 0, hop = 0, joy = 0, gasp = 0, slamT = 0, slamS = '', oT = 0;
  const press = () => {
    if (g.result || j >= 3) return;
    const d = c - hs[j];
    if (d < -GOODW * 2.2) return;
    if (Math.abs(d) > GOODW) { miss(d < 0 ? 'EARLY!' : 'LATE!'); return; }
    const perfect = Math.abs(d) < PERF;
    res[j] = perfect ? 2 : 1; hop = .25;
    if (perfect) {
      sfx.coin(); sfx.hit(); sfx.boing(); burst(400, 300, GOLD, 18, 320); ring(400, 300, GOLD, 130); floatText('PERFECT!', 400, 190, GOLD, 44);
      joy = .6; confetti(120 + Math.random() * 560, 400, 12); burst(120 + Math.random() * 560, 420, MVC[j], 10, 300);
    } else { sfx.pop(); sfx.blip(5); burst(400, 300, TEAL, 10, 240); ring(400, 300, '#fff', 100); floatText('GOOD', 400, 190, '#7dfff0', 38); joy = .3; }
    j++;
    if (j >= 3) { g.result = 'win'; mvWin(400, 300); confetti(200, 380, 20); confetti(600, 380, 20); joy = 1; }
  };
  const miss = s => { g.result = 'lose'; res[j] = -1; gasp = 1; slamT = 1; slamS = 'WHAT?!'; mvLose(400, 300); sfx.splat(); snd(800, .35, 'sawtooth', .05, 0, 90); floatText(s || 'MISS!', 400, 190, '#ff4d4d', 48); };
  const g = {
    wide: true, cmd: 'OBEY THE BALL!', hint: 'SPACE / CLICK ON THE BEAT', thint: 'TAP WHEN THE RING LANDS', dur: 5,
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || /^Arrow/.test(e.code))) press(); },
    down() { press(); },
    update(dt) {
      pulse = Math.max(0, pulse - dt); hop = Math.max(0, hop - dt); joy = Math.max(0, joy - dt); slamT = Math.max(0, slamT - dt * 1.5);
      if (g.result) { oT += dt; return; }
      c += dt;
      for (let i = 0; i < 4; i++) if (!ticked[i] && c >= ticks[i]) { ticked[i] = 1; i ? sfx.tickHi() : sfx.tick(); pulse = .15; }
      if (j < 3 && c > hs[j] + GOODW) miss('MISS!');
    },
    draw(t) {
      X = ctx;
      const win = g.result === 'win', lose = g.result === 'lose', pu = pulse / .15;
      layer(clubBg());
      // flashing floor tiles
      const beatN = (t * 60 / B | 0);
      for (let r = 0; 470 + r * 30 < H; r++) for (let x = -Math.ceil(OX / 64) * 64; x < W + OX; x += 64) {
        const ci = (x / 64 | 0), lit = (ci + r * 3 + beatN) % 5 === 0 && !lose; if (!lit) continue;
        X.fillStyle = MVC[(((ci + r + beatN) % 4) + 4) % 4]; X.globalAlpha = .85; X.fillRect(x + 2, 470 + r * 30 + 2, 60, 26); X.globalAlpha = 1;
      }
      // speaker woofers thump on the beat
      for (const sx of SPK()) for (const [cy, rad] of [[345, 26], [420, 30]]) {
        const rp = rad * (1 + pu * .14 + joy * .1 * Math.sin(t * 40));
        X.beginPath(); X.arc(sx + 42, cy, rad + 5, 0, TAU); ink('#14101c', 2); X.beginPath(); X.arc(sx + 42, cy, rp, 0, TAU); ink('#3b3550', 3); X.beginPath(); X.arc(sx + 42, cy, rp * .45, 0, TAU); ink('#6b6290', 2.5); glint(sx + 36, cy - 6, rp * .2, rp * .1, .5);
      }
      // the snack audience: stops dead when you blow it, goes feral when you nail it
      crowd(468, t, gasp ? 0 : .7 + joy * 4, .85 + joy * .25, [0, -.2], lose ? 'panic' : win ? 'happy' : undefined, 96, [340, 460]);
      // the pedestal and the giant judging eyeball
      const tr = 62 * (1 + pu * .12);
      shad(400, 438, 90, 10, .3);
      rr(384, 366, 32, 64, 8); ink('#ffd23f', 4); X.fillStyle = '#c9971a'; X.fillRect(406, 372, 8, 54); rr(350, 414, 100, 22, 11); ink('#ffd23f', 4); glint(372, 422, 16, 4, .5, 0);
      el(400, 372, 82, 17); ink('#c8283a', 4); glint(366, 368, 24, 5, .45, -.1);
      const lk = Math.sin(t * 1.5) * .8;
      bigEye(400, 300, tr, t, { look: lk, lookY: lose ? 6 : 0, pup: lose ? .55 : 1 + pu * .2, heart: win, lid: lose ? .46 : win || joy > 0 ? .02 : .2 + .03 * Math.sin(t * 2), slant: lose ? 1 : .15 });
      if (lose) { for (let i = 0; i < 2; i++) { const q = (oT * 1.4 + i * .5) % 1; drop(332 + i * 136, 360 + q * 40, 1.4, 1 - q); } }
      // the timing rings, inked neon
      for (let i = j; i < 3; i++) {
        const k = (hs[i] - c) / T; if (k > 1) continue;
        const r = 62 + 190 * Math.max(-.2, k), near = Math.abs(hs[i] - c) < GOODW;
        X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 18; X.beginPath(); X.arc(400, 300, r, 0, TAU); X.stroke();
        X.strokeStyle = near ? GOLD : MAG; X.lineWidth = 10; X.beginPath(); X.arc(400, 300, r, 0, TAU); X.stroke();
        X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 3; X.beginPath(); X.arc(400, 300, r - 2, 3.7, 4.6); X.stroke();
      }
      // the metronome: the judgmental disco ball, swinging on a trolley on the beat
      const sw = Math.sin((c - H0) / B * Math.PI) * .5, bx = 130 + sw * 260, by = 150 + Math.abs(sw) * -30 + (gasp ? 40 : 0);
      rr(bx - 17, 56, 34, 18, 6); ink('#8f9cb3', 3);
      ball(bx, by, 46, t, gasp ? 'shock' : win ? 'happy' : 'judge', 70);
      beams(bx, by, t, .08);
      // claude on the dance floor
      const jump = hop > 0 ? Math.sin(hop / .25 * Math.PI) * 30 : pulse > 0 ? 6 * pu : 0, cp = lose ? 1 : (hop > 0 || win || joy > .3) ? 0 : 4;
      shad(400, 538, 50 - jump * .4, 9, .3);
      pfig(400, 536 - jump, 7, cp, { face: lose ? 'sad' : win ? 'happy' : pu > 0 || joy > 0 ? 'happy' : 'idle', look: [0, -.4] });
      if (lose) stars3(400, 536 - 4 * 7 - 14, 30, t);
      pill(400, 536 - (lose ? 4 : 9) * 7 - 24 - jump, 'YOU', OR);
      // pips: three bulbs on a marquee
      rr(318, 52 + 7, 164, 44, 22); ink('#3a1f7a', 4); rr(318, 52, 164, 44, 22); ink('#6a46c4', 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(332, 56, 136, 6, 3); X.fill();
      for (let i = 0; i < 3; i++) {
        const col = res[i] === 2 ? GOLD : res[i] === 1 ? TEAL : res[i] < 0 ? '#ff4d5e' : '#2b0f5e';
        if (res[i]) { X.fillStyle = col; X.globalAlpha = .35; X.beginPath(); X.arc(360 + i * 40 + 0, 74, 21, 0, TAU); X.fill(); X.globalAlpha = 1; }
        X.beginPath(); X.arc(360 + i * 40, 74, 14, 0, TAU); ink(col, 3.5); if (res[i]) glint(355 + i * 40, 69, 4, 2.5, .7);
      }
      slam(slamS, slamT, '#ff4d5e', 660, 160, 40);
      vignette(.2);
    }
  };
  return g;
}, 'BEAT!');

/* ═════════════ 4 SWIM · the tomato-soup swimming pool: race the rubber duck ═════════════ */
let WBG = null, WBW = -1;
function poolBg(X1) {
  if (WBG && WBW === VW) return WBG; WBW = VW;
  return WBG = bake(() => {
    const L = -OX - 2, R = W + OX + 2;
    // tiled deck wall
    X.fillStyle = '#fff4cf'; X.fillRect(L, 0, R - L, 110);
    X.strokeStyle = '#e6d29a'; X.lineWidth = 2; X.beginPath(); for (let x = Math.floor(L / 40) * 40; x < R; x += 40) { X.moveTo(x, 0); X.lineTo(x, 110); } for (let y = 0; y < 110; y += 40) { X.moveTo(L, y); X.lineTo(R, y); } X.stroke();
    // pennant string
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(L, 62); for (let x = L; x <= R; x += 20) X.lineTo(x, 62 + Math.sin(x * .02) * 4 + 8 * Math.sin(x * .006)); X.stroke();
    for (let x = Math.floor(L / 46) * 46; x < R; x += 46) { const y = 62 + Math.sin(x * .02) * 4 + 8 * Math.sin(x * .006); X.beginPath(); X.moveTo(x, y); X.lineTo(x + 22, y); X.lineTo(x + 11, y + 20); X.closePath(); ink(['#FF3EA5', '#19C6B7', '#FFE14D', '#7B3FE4'][(x / 46 | 0) & 3 & 3], 2.5); }
    // pool coping
    X.fillStyle = '#f6e3a8'; X.fillRect(L, 100, R - L, 16); X.strokeStyle = INK; X.lineWidth = 4; X.strokeRect(L - 4, 100, R - L + 8, 16); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(L, 103, R - L, 4);
    // soup
    let g = X.createLinearGradient(0, 116, 0, 510); g.addColorStop(0, '#f2713a'); g.addColorStop(1, '#d9482a'); X.fillStyle = g; X.fillRect(L, 116, R - L, 394);
    X.fillStyle = 'rgba(255,226,154,.28)'; for (let y = 134, i = 0; y < 500; y += 26, i++) for (let x = ((i & 1) * 30) + Math.floor(L / 60) * 60; x < R; x += 60) { rr(x, y, 24, 5, 2.5); X.fill(); }
    // pool front wall
    g = X.createLinearGradient(0, 510, 0, H); g.addColorStop(0, '#4cc4e8'); g.addColorStop(1, '#2a8fcb'); X.fillStyle = g; X.fillRect(L, 510, R - L, H - 510);
    X.strokeStyle = 'rgba(255,255,255,.4)'; X.lineWidth = 2; X.beginPath(); for (let x = Math.floor(L / 50) * 50; x < R; x += 50) { X.moveTo(x, 510); X.lineTo(x, H); } for (let y = 540; y < H; y += 30) { X.moveTo(L, y); X.lineTo(R, y); } X.stroke();
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 510); X.lineTo(R, 510); X.stroke();
    // start block + finish arch
    rr(-OX - 14, 130, 44, 355, 10); ink('#fff', 4); X.fillStyle = 'rgba(20,16,28,.15)'; X.fillRect(-OX + 18, 134, 8, 347);
    for (let i = 0; i < 18; i++) for (let k = 0; k < 2; k++) { X.fillStyle = (i + k) & 1 ? INK : '#fff'; X.fillRect(X1 + 22 + k * 14, 130 + i * 19.7, 14, 19.7); }
    X.strokeStyle = INK; X.lineWidth = 4; X.strokeRect(X1 + 22, 130, 28, 355);
    // lane ropes
    for (const ry of [130, 305, 485]) {
      X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(L, ry); X.lineTo(R, ry); X.stroke();
      for (let x = 24 - Math.ceil(OX / 24) * 24; x < W + OX; x += 24) { X.beginPath(); X.arc(x, ry, 7, 0, TAU); ink((x / 24) & 1 ? MAG : '#fff', 3); }
    }
  });
}
function duck(x, y, t, quack, mode) {   // mode 0 swim, 1 sinking, 2 belly-up, 3 crowned
  X.save(); X.translate(x, y); if (mode === 2) X.rotate(Math.PI);
  cel(() => { X.beginPath(); X.moveTo(-30, 2); X.lineTo(-46, -8); X.lineTo(-38, 14); X.closePath(); }, '#FFE14D', '#e6b800', 3, 2, 2);
  cel(() => el(0, 8, 34, 26), '#FFE14D', '#e6b800', 4, 6, 7);
  X.beginPath(); X.ellipse(-8, 10, 15, 10, -.4, 0, TAU); ink('#F2C300', 2.5); glint(-14, 2, 8, 3, .5, -.4);
  cel(() => { X.beginPath(); X.arc(26, -14, 19, 0, TAU); }, '#FFE14D', '#e6b800', 4, 4, 5);
  rr(40, -17, 24 + quack * 30, 13, 6); ink('#FF8A3D', 3);
  eye(26, -20, 9, [1, .3], mode === 1 ? 'panic' : mode === 2 ? 'dead' : 'idle', t, 9);
  X.fillStyle = 'rgba(255,110,165,.5)'; el(30, -6, 6, 3); X.fill();
  if (mode === 3) { X.beginPath(); X.moveTo(14, -30); X.lineTo(16, -48); X.lineTo(22, -38); X.lineTo(28, -52); X.lineTo(34, -38); X.lineTo(40, -48); X.lineTo(40, -30); X.closePath(); ink('#ffd23f', 3); X.fillStyle = '#ff4d5e'; X.beginPath(); X.arc(28, -42, 3, 0, TAU); X.fill(); }
  X.restore();
}
reg('mv_swim', sp => {
  const rs = Math.sqrt(sp), TR = 4.2 / rs, X0 = -OX + 80, X1 = W + OX - 100, LY = [215, 395], ks = (X1 - X0) / 620, boost = (1 + .25 * (sp - 1)) * ks;   // ks: stroke power scales with pool length so time-to-finish stays the same
  let c = 0, px = X0, v = 0, last = -1, lastT = -1, arm = 0, stumble = 0, pad = [0, 0], combo = 0, slamT = 0, slamS = '', quack = 0, nextQ = 1.2, boom = 0, oT = 0;
  const rivalX = () => X0 + (X1 - X0) * Math.min(1, c / TR + .025 * Math.sin(c * 6));
  const stroke = side => {
    if (g.result) return;
    pad[side] = .15;
    if (side === last) { v *= .75; stumble = .25; combo = 0; sfx.tick(); burst(px, LY[1], '#fff', 3, 100); return; }
    const gap = lastT < 0 ? .22 : c - lastT, bonus = Math.max(0, 1 - Math.abs(gap - .22) / .25);
    v += (75 + 55 * bonus) * boost; last = side; lastT = c; arm = 1;
    combo = bonus > .6 ? combo + 1 : 0;
    sfx.blip((side ? 4 : 0) + Math.round(bonus * 5)); noise(.07, .03, 2000, 4000, 'bandpass');
    burst(px + 30, LY[1] - 8, '#FFC24D', 4, 160);
    if (combo === 4) { floatText('RHYTHM!', px, LY[1] - 80, GOLD, 30); sfx.sparkle(); }
  };
  const g = {
    wide: true, cmd: 'SOUP SWIM!', hint: 'ALTERNATE LEFT / RIGHT', thint: 'TAP LEFT, RIGHT, LEFT, RIGHT...', dur: 5,
    key(e) { if (e.repeat) return; if (e.code === 'ArrowLeft' || e.code === 'KeyA') stroke(0); else if (e.code === 'ArrowRight' || e.code === 'KeyD') stroke(1); },
    down(p) { stroke(p.x < W / 2 ? 0 : 1); },
    update(dt) {
      pad[0] = Math.max(0, pad[0] - dt); pad[1] = Math.max(0, pad[1] - dt); arm = Math.max(0, arm - dt * 5); stumble = Math.max(0, stumble - dt);
      slamT = Math.max(0, slamT - dt * 1.5); quack = Math.max(0, quack - dt); boom = Math.max(0, boom - dt);
      if (g.result) { oT += dt; return; }
      c += dt; v *= Math.pow(.082, dt); px += v * dt;
      if (c >= nextQ) { nextQ = c + 1.1; quack = .25; snd(620, .09, 'square', .04, 0, 900); snd(900, .07, 'square', .03, .08, 600); }
      if (px >= X1) { px = X1; g.result = 'win'; slamT = 1; slamS = 'GLORP!'; boom = .5; mvWin(px, LY[1] - 20); floatText('FIRST!', 400, 120, GOLD, 56); confetti(rivalX(), LY[0], 30); sfx.splat(); }
      else if (rivalX() >= X1) { g.result = 'lose'; slamT = 1; slamS = 'QUACK!'; mvLose(px, LY[1]); floatText('TOO SLOW!', 400, 120, '#ff4d4d', 50); snd(500, .3, 'square', .06, 0, 120); }
    },
    draw(t) {
      X = ctx;
      const win = g.result === 'win', lose = g.result === 'lose';
      layer(poolBg(X1));
      // the deck crowd cheers (small snacks lined up on the pool edge)
      crowd(110, t, win ? 2.2 : 1, .5, [0, .5], lose ? 'happy' : win ? 'panic' : undefined, 80, [220, 580]);
      // floating soup: croutons, peas, noodles and watching eyeballs
      for (let i = 0; i < 5; i++) { const ex = ((i * 190 + 60 + t * 12) % (VW + 80)) - OX, ey = 150 + (i * 71) % 330; X.save(); X.translate(ex, ey + Math.sin(t * 2 + i) * 3); X.rotate(i); rr(-9, -9, 18, 18, 4); ink('#e6b25a', 2.5); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(-6, -6, 6, 3); X.restore(); }
      for (let i = 0; i < 4; i++) { const ex = ((i * 260 + 90 - t * 15) % (VW + 100)) - OX, ey = 150 + (i % 2) * 170 + Math.sin(t * 2 + i) * 6; if (ex > -OX + 40 && ex < X1 - 20) eye(ex, ey, 13, [cl(Math.abs(px - ex) / 300) * Math.sign(px - ex), (LY[1] - ey) / 300], lose ? 'happy' : win ? 'panic' : 'idle', t, i); }
      X.fillStyle = '#7ad14f'; for (let i = 0; i < 6; i++) { const ex = ((i * 170 + 40 + t * 22) % (VW + 60)) - OX, ey = 130 + (i * 53) % 340 + Math.sin(t * 3 + i) * 4; X.beginPath(); X.arc(ex, ey, 6, 0, TAU); ink('#7ad14f', 1.5); }
      txt('FINISH', X1 + 36, 108, 24, GOLD);
      // swimmers: the rival is a rubber duck
      const rx = rivalX(), pyy = LY[1] + 10 + (stumble > 0 ? Math.sin(t * 60) * 3 : 0), dy = LY[0] + 14 + Math.sin(t * 9) * 3;
      shad(rx, LY[0] + 52, 40, 7, .15);
      if (win) { const sk = boom > 0 ? 1 - boom / .5 : 1; duck(rx, dy + (boom > 0 ? ease(sk) * 14 : 8), t, 0, boom > 0 ? 1 : 2); }
      else duck(rx, dy, t, quack, lose ? 3 : 0);
      const sink = lose ? ease(oT / .5) * 26 : 0, bobY = Math.sin(t * 5) * 2;
      shad(px, LY[1] + 52, 46, 8, .15);
      X.save(); if (lose) X.translate(0, sink); const cy = pyy + 14 + bobY;
      pfig(px, cy, 6, 4, { face: lose ? 'sad' : win ? 'happy' : 'idle', look: [1, 0] });
      rr(px - 28, cy - 9 * 6 - 12, 56, 17, 8); ink(MAG, 3); X.fillStyle = '#fff'; X.fillRect(px - 8, cy - 9 * 6 - 10, 8, 13); glint(px - 17, cy - 9 * 6 - 7, 8, 3, .5, 0);
      const up = arm * 20; line([[px + 12, cy - 30], [px + 38, cy - 46 - up * .5], [px + 62, cy - 44 - up]], 11, OR); X.beginPath(); X.arc(px + 64, cy - 44 - up, 8, 0, TAU); ink('#f3a283', 3);
      X.restore();
      // soup cover + surface waves
      X.fillStyle = 'rgba(232,106,42,.55)'; X.fillRect(-OX, LY[0] + 14, VW, 48); X.fillRect(-OX, LY[1] + 14 + sink * .2, VW, 48);
      X.strokeStyle = '#FFE29A'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath();
      for (const wy of [LY[0] + 14, LY[1] + 14]) for (let x = -OX; x <= W + OX + 20; x += 20) { const yy = wy + Math.sin(x * .06 + t * 8) * 3; x > -OX ? X.lineTo(x, yy) : X.moveTo(x, yy); }
      X.stroke();
      // wake of bubbles
      X.fillStyle = 'rgba(255,226,154,.75)';
      for (let i = 1; i < 5; i++) { X.beginPath(); X.arc(px - 40 - i * 22, LY[1] + 10 - Math.sin(t * 10 + i) * 4, 6 / i + 2, 0, TAU); X.fill(); }
      if (lose) { stars3(px, LY[1] - 44 + sink * .6, 30, t); for (let i = 0; i < 4; i++) { const q = (oT * 1.2 + i * .25) % 1; X.beginPath(); X.arc(px - 20 + i * 14, LY[1] + 20 - q * 50, 4 + i, 0, TAU); X.strokeStyle = '#FFE29A'; X.lineWidth = 2.5; X.stroke(); } }
      if (win && boom > 0) for (let i = 0; i < 5; i++) { const q = 1 - boom / .5; X.beginPath(); X.arc(rx + 10 + i * 9, LY[0] + 6 - q * 60 * (1 + i * .15), 5 + i, 0, TAU); X.strokeStyle = '#FFE29A'; X.lineWidth = 2.5; X.stroke(); }
      pill(px, pyy + 14 - 9 * 6 - 34 + sink * .6, 'YOU', OR);
      // controls
      for (let s = 0; s < 2; s++) {
        const bw = 340 + OX, bx = s ? W / 2 + 20 : -OX + 40, on = pad[s] > 0, dead = !!g.result;
        plate(bx, 488, bw, 50, dead ? '#d3cfe0' : on ? GOLD : last === s ? '#d9c5ff' : '#fff', dead ? '#8f88a6' : on ? '#c99512' : '#b9b3d0', on, !on && !dead && last !== s && c < 1.2, 18);
        const ay = 488 + 25 + (on ? 6 : 0);
        arrowG(bx + bw / 2 - (TOUCH ? 0 : 18), ay, s ? 1 : 3, 18, dead ? '#f6f4fb' : on ? MAG : PUR);
        if (!TOUCH && !dead) keyCap(bx + bw / 2 + 34, ay, s ? 'D' : 'A');
      }
      // the swim track: you and the duck racing to the checkered flag
      const prog = (px - X0) / (X1 - X0), dprog = (rx - X0) / (X1 - X0);
      rr(250, 74, 300, 24, 12); ink('#fff', 3); X.save(); rr(252, 76, 296, 20, 10); X.clip(); X.fillStyle = OR; X.fillRect(252, 76, 296 * cl(prog), 20); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(252, 78, 296, 5); X.restore();
      for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) { X.fillStyle = (i + k) & 1 ? INK : '#fff'; X.fillRect(538 + k * 6, 74 + i * 6, 6, 6); }
      X.beginPath(); X.arc(256 + 280 * cl(dprog), 86, 10, 0, TAU); ink('#FFE14D', 2.5); X.fillStyle = '#FF8A3D'; X.fillRect(256 + 280 * cl(dprog) + 6, 85, 8, 4);
      rr(250 + 276 * cl(prog), 76, 22, 20, 6); ink(OR, 2.5); eye(250 + 276 * cl(prog) + 11, 86, 3.4, [1, 0], 'idle', t, 2);
      slam(slamS, slamT, slamS === 'QUACK!' ? '#FF8A3D' : '#4fd06a', win ? 540 : 400, win ? 250 : 130, 46);
      vignette(.18);
    }
  };
  return g;
}, 'SWIM!');

})();
