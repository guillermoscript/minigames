'use strict';
/* MOVE IT! wave 1 — pose and rhythm microgames (WarioWare Move It! / Smooth Moves inspired).
   Poses are ArrowUp / ArrowDown / ArrowLeft / ArrowRight (or tap the on-screen pose buttons).
   Art: the DUO look (docs/ART-STYLE.md) — inked cel-shaded cast in a cursed disco. Static scenery is baked once per screen size. */
(function () {

const MAG = '#FF3EA5', PUR = '#7B3FE4', TEAL = '#19C6B7', GOLD = '#FFE14D';
const mvLose = (x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, '#ff4d4d', 14); ring(x, y, '#ff4d4d', 80); };
const mvWin = (x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 28); ring(x, y, '#fff', 110); shake(5, .2); };

/* ───────────── tiny drawing kit (X is swapped for an offscreen context while a scene is baked) ───────────── */
const TAU = Math.PI * 2;
let X = typeof ctx === 'undefined' ? null : ctx;   // draw() re-points it at the live ctx
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = Math.max(0, Math.min(1, k)) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const hr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // decor randomness: never the game RNG
function rr(x, y, w, h, r) { X.beginPath(); X.roundRect(x, y, w, h, r); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function glint(p, x, y, rx, ry, col, rot = -.4) { X.save(); X.clip(p); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
function rrP(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }
function ln(x1, y1, x2, y2, col, w) { X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = w + 6; X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function bulb(x, y, r, on, col) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(on ? col : '#4a3a6a', 2.5); if (on) { X.fillStyle = 'rgba(255,255,255,.7)'; el(x - r * .3, y - r * .35, r * .3, r * .2, -.5); X.fill(); } }
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function spark(x, y, r, col) { X.fillStyle = col; X.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i & 1 ? r * .3 : r; X.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } X.closePath(); X.fill(); }
function sweat(x, y, T, k = 0) { const f = (T * 1.4 + k) % 1; X.save(); X.globalAlpha = 1 - f * f; X.translate(x, y + f * 14); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(7, 0, 0, 6); X.quadraticCurveTo(-7, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); }
/* feedback word: coloured slab with a gloss and a drop shadow, pops in with outBack (draws on the live ctx) */
function badge(s, x, y, size, bg, fg, sc = 1, rot = 0) {
  ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  const w = Math.min(540, ctx.measureText(t(s)).width + size * .9), h = size * 1.15;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(20,16,28,.3)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 4, -h / 2 + 7, w, h, h * .46); ctx.fill();
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h * .46); ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -h / 2 + 6, w - 20, h * .2, h * .1); ctx.fill();
  txt(s, 0, size * .03, size, fg, 'center', w - 10); ctx.restore();
}
function pop(s, life, bg, fg, y = 170, size = 54, x = 400) { if (life <= 0) return; ctx.save(); ctx.globalAlpha = Math.min(1, life * 4); badge(s, x, y, size, bg, fg, outBack(1 - life), Math.sin(s.length * 1.7) * .07 - .03); ctx.restore(); }
function pill(x, y, label, col) {                    // name tag with a pointer (live only)
  ctx.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, ctx.measureText(t(label)).width + 26);
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - 9, y + 12); ctx.lineTo(x, y + 23); ctx.lineTo(x + 9, y + 12); ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 14, w, 28, 14); ctx.stroke(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.roundRect(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); ctx.fill(); ctx.restore();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
/* bake static scenery once per screen size (wide games fill -OX..W+OX). Never call txt/shadow/star/vignette inside fn */
const BK = {};
function bake(key, fn) {
  const kk = VW + '|' + OX + '|' + H; let b = BK[key];
  if (!b || b.k !== kk) {
    const c = document.createElement('canvas'); c.width = VW; c.height = H; const g = c.getContext('2d'), prev = X;
    X = g; g.save(); g.translate(OX, 0); try { fn(); } finally { g.restore(); X = prev; } b = BK[key] = { c, k: kk };
  }
  return b.c;
}
/* an eye: white sclera, inked, pupil that looks at the action, highlight dot, blink. m: idle|happy|bonk|panic|smug */
function eye(x, y, r, o = {}) {
  const m = o.m || 'idle', lx = o.lx || 0, ly = o.ly || 0, k = o.k || 0, w = Math.max(1.5, r * .2);
  X.lineCap = 'round'; X.lineJoin = 'round'; X.strokeStyle = INK;
  if (m === 'happy') { X.lineWidth = Math.max(3, r * .42); X.beginPath(); X.arc(x, y + r * .45, r * .8, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); return; }
  if (m === 'bonk') { X.lineWidth = Math.max(3, r * .4); const d = r * .7; X.beginPath(); X.moveTo(x - d, y - d); X.lineTo(x + d, y + d); X.moveTo(x + d, y - d); X.lineTo(x - d, y + d); X.stroke(); return; }
  if (Math.sin(now * 1.9 + k * 2.3) > .985 && m !== 'panic') { X.lineWidth = Math.max(3, r * .4); X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
  const R = m === 'panic' ? r * 1.3 : r, p = new Path2D(); p.ellipse(x, y, R, R * 1.08, 0, 0, TAU);
  inkP(p, '#fff', w);
  const pr = R * (m === 'panic' ? .3 : .52), l = Math.min(1, Math.hypot(lx, ly)), a = Math.atan2(ly, lx), px = x + Math.cos(a) * l * R * .38, py = y + Math.sin(a) * l * R * .38;
  X.fillStyle = INK; X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fill();
  X.fillStyle = '#fff'; X.beginPath(); X.arc(px - pr * .35, py - pr * .4, pr * .35, 0, TAU); X.fill();
  if (m === 'smug' || o.lid) {
    const lid = o.lid != null ? o.lid : .45, ly0 = y - R * 1.08 + R * 2.16 * lid * .5;
    X.save(); X.clip(p); X.fillStyle = o.lc || '#E8B020'; X.fillRect(x - R - 2, y - R * 1.1 - 2, R * 2 + 4, ly0 - (y - R * 1.1) + 2);
    X.lineWidth = Math.max(2.5, r * .2); X.beginPath(); X.moveTo(x - R, ly0); X.lineTo(x + R, ly0); X.stroke(); X.restore();
  }
}
function brow(x1, y1, x2, y2, w = 5) { X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = w; X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.stroke(); }

/* ── Caos-shaped figure in 5 poses: 0 up, 1 crouch, 2 left, 3 right, 4 neutral ── */
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
function figP(x, y, u, pi) {
  const P = POSES[pi], p = new Path2D(); let first = true;
  for (const s of [P.b].concat(P.r)) { p.roundRect(x + s[0] * u, y + s[1] * u, s[2] * u, s[3] * u, Math.min(s[2], s[3]) * u * (first ? .3 : .38)); first = false; }
  return p;
}
function mouth(x, y, u, m) {
  X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = Math.max(2, u * .5);
  if (m === 'happy') { X.beginPath(); X.moveTo(x - u * 1.3, y - u * .3); X.quadraticCurveTo(x, y + u * 1.6, x + u * 1.3, y - u * .3); X.closePath(); X.fillStyle = INK; X.fill(); X.stroke(); }
  else if (m === 'panic') { el(x, y + u * .2, u * .7, u * .9); X.fillStyle = INK; X.fill(); }
  else if (m === 'bonk') { X.beginPath(); X.moveTo(x - u, y + u * .5); X.quadraticCurveTo(x, y - u * .5, x + u, y + u * .5); X.stroke(); }
  else { X.beginPath(); X.moveTo(x - u * .7, y); X.quadraticCurveTo(x, y + u * .5, x + u * .7, y); X.stroke(); }
}
/* the figure. o.sil = flat silhouette (pose holes, button icons), o.oc = coloured outline, o.face = mood, o.col = body colour, o.lx/ly = look */
function mvFig(x, y, u, pi, fill, o = {}) {
  const p = figP(x, y, u, pi), ol = o.ol != null ? o.ol : Math.max(2.5, u * .5);
  if (o.sil) {
    if (o.oc) { X.lineJoin = 'round'; X.lineWidth = (ol + 3) * 2; X.strokeStyle = INK; X.stroke(p); X.lineWidth = ol * 2; X.strokeStyle = o.oc; X.stroke(p); X.fillStyle = fill; X.fill(p); }
    else inkP(p, fill, ol);
    return;
  }
  const col = o.col || OR; cel(p, col, mix(col, '#7a2a14', .42), u * .38, u * .5, ol);
  const b = POSES[pi].b; glint(p, x - 3.4 * u, y + (b[1] + 1.3) * u, 1.7 * u, .7 * u, 'rgba(255,255,255,.4)');
  if (o.face) {
    const m = o.face, ey = y + (b[1] + b[3] * .42) * u, lx = o.lx != null ? o.lx : 0, ly = o.ly || 0;
    for (const s of [-1, 1]) eye(x + s * 2.8 * u, ey, u * 1.4, { m, lx, ly, k: s });
    X.fillStyle = m === 'happy' ? 'rgba(255,110,165,.8)' : 'rgba(255,110,165,.5)'; for (const s of [-1, 1]) { el(x + s * 4.9 * u, ey + 1.5 * u, .8 * u, .55 * u); X.fill(); }
    if (b[3] > 5) mouth(x, ey + 2.7 * u, u, m);
    if (m === 'panic') sweat(x + 5.2 * u, ey - 1.6 * u, now);
  }
}
const poseKey = e => KEYPOSE[e.code] != null ? KEYPOSE[e.code] : -1;
/* a sentient hot dog wearing the dancer's pose: sausage body, bun rim, mustard squiggle, googly face */
function mvDog(x, y, u, pi, m, lx, ly) {
  const p = figP(x, y, u, pi), b = POSES[pi].b;
  X.lineJoin = 'round'; X.strokeStyle = INK; X.lineWidth = u * 1.4 + 10; X.stroke(p); X.strokeStyle = '#F0B35A'; X.lineWidth = u * 1.4 + 1; X.stroke(p);
  cel(p, '#E8503A', '#b02a1c', u * .38, u * .5, 0);
  glint(p, x - 3.4 * u, y + (b[1] + 1.3) * u, 1.7 * u, .7 * u, 'rgba(255,255,255,.4)');
  const my = y + (b[1] + b[3] * .85) * u; X.strokeStyle = GOLD; X.lineWidth = Math.max(2, u * .4); X.beginPath(); X.moveTo(x - 4 * u, my); X.bezierCurveTo(x - 2 * u, my - u, x + 2 * u, my + u, x + 4 * u, my); X.stroke();
  const ey = y + (b[1] + b[3] * .42) * u;
  for (const s of [-1, 1]) eye(x + s * 2.8 * u, ey, u * 1.5, { m, lx, ly, k: s + 3 });
  if (b[3] > 5) mouth(x, ey + 2.9 * u, u * .9, m === 'bonk' ? 'bonk' : m === 'happy' ? 'happy' : 'idle');
}
/* pose buttons (keyboard arrows + touch): chunky plates with the arrow and the little shape, they drop when pressed */
const BX = i => 400 + (i - 1.5) * 112, BY = 508;
function mvButtons(hl, done) {
  for (let i = 0; i < 4; i++) {
    const x = BX(i), down = hl === i, off = down ? 6 : 0, y0 = BY - 14;
    const face = done ? '#d3cfe0' : down ? '#ffd23f' : '#f6f4fb', base = done ? '#8f88a6' : down ? '#c99512' : '#7b6fb0';
    X.save(); rr(x - 48, y0 + 10, 96, 56, 14); ink(base, 4);
    rr(x - 48, y0 + off, 96, 56, 14); ink(face, 4);
    X.fillStyle = 'rgba(255,255,255,.55)'; rr(x - 40, y0 + off + 5, 80, 8, 4); X.fill();
    if (!done && !down && (now * 1.5 + i * .3) % 3 < .4) { X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 3; rr(x - 42, y0 + off + 4, 84, 48, 11); X.stroke(); }
    X.restore();
    drawArrow(x - 16, y0 + off + 28, ARROW_DIR[i], 11, done ? '#8f88a6' : down ? MAG : PUR);
    mvFig(x + 20, y0 + off + 46, 1.9, i, done ? '#8f88a6' : INK, { sil: 1, ol: 1.5 });
  }
}
function mvBtnHit(p) {
  if (p.y < BY - 8) return -1;
  const i = Math.round((p.x - 400) / 112 + 1.5);
  return i >= 0 && i < 4 && Math.abs(p.x - BX(i)) <= 56 ? i : -1;
}
/* the judgmental disco ball: inked cel sphere with facets, a face and a rope. m: idle|wow|sour */
function ball(x, y, r, t, m = 'idle', lx = 0, ly = 1) {
  ln(x, -10, x, y - r, '#5a4a7a', 3);
  const p = new Path2D(); p.arc(x, y, r, 0, TAU); cel(p, '#cfd8ee', '#8f9cb3', r * .16, r * .2, 4);
  X.save(); X.clip(p); const rot = t * 1.4;
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const u = (i + (rot % 1)) * r / 3.1, v = j * r / 3.1; if (u * u + v * v > r * r) continue; X.fillStyle = ((i + j + (rot | 0)) & 1) ? 'rgba(255,255,255,.75)' : 'rgba(111,126,170,.5)'; X.fillRect(x + u - r / 8, y + v - r / 8, r / 4.2, r / 4.2); }
  X.restore(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(p);
  X.fillStyle = 'rgba(255,255,255,.7)'; el(x - r * .4, y - r * .5, r * .22, r * .12, -.6); X.fill();
  const ex = m === 'wow' ? 1.25 : 1;
  for (const s of [-1, 1]) eye(x + s * r * .32, y + r * .05, r * .2 * ex, { m: m === 'sour' ? 'smug' : 'idle', lx, ly, k: s, lc: '#aab5d0', lid: m === 'sour' ? .7 : .35 });
  const by = m === 'wow' ? .3 : .18, bi = m === 'wow' ? .28 : .06;
  brow(x - r * .55, y - by * r, x - r * .14, y - bi * r, 4); brow(x + r * .55, y - by * r, x + r * .14, y - bi * r, 4);
  if (m === 'wow') { el(x, y + r * .52, r * .14, r * .17); X.fillStyle = INK; X.fill(); } else mouth(x, y + r * .5, r * .22, m === 'sour' ? 'bonk' : 'idle');
}
function beams(x, y, t, a = .12) {
  X.save(); X.globalAlpha = a; X.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) { const q = t * 1.1 + i * 1.256; X.beginPath(); X.moveTo(x, y); X.lineTo(x + Math.cos(q) * 900 - 40, y + Math.abs(Math.sin(q)) * 900); X.lineTo(x + Math.cos(q) * 900 + 40, y + Math.abs(Math.sin(q)) * 900); X.fill(); }
  X.restore();
}
function stars(x, y, rx, T) { for (let i = 0; i < 3; i++) { const a = T * 5 + i * 2.09; spark(x + Math.cos(a) * rx, y + Math.sin(a) * rx * .35, 8, GOLD); } }
function spot(x0, x1, y1, a) { X.save(); X.globalAlpha = a; X.fillStyle = '#fff'; X.beginPath(); X.moveTo(x0 - 24, 0); X.lineTo(x0 + 24, 0); X.lineTo(x1 + 130, y1); X.lineTo(x1 - 130, y1); X.closePath(); X.fill(); X.restore(); }
function neonTube(x, y, w, h, k, col, danger) {
  rr(x, y, w, h, h / 2); ink('#2b0f5e', 3.5);
  X.save(); rr(x, y, w, h, h / 2); X.clip(); X.fillStyle = danger ? '#ff4d5e' : col; X.fillRect(x, y, Math.max(0, w * k), h);
  X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x, y + 3, w, 4); X.restore();
  if (danger && (now * 6 | 0) % 2) { X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 3; rr(x - 2, y - 2, w + 4, h + 4, h / 2 + 2); X.stroke(); }
}

/* ───────────── 1 POSE scenery: a hot-dog factory disco, wallpaper, lamp rail, conveyor ───────────── */
function bgPose() {
  const g = X.createLinearGradient(0, 0, 0, 470); g.addColorStop(0, '#3a0f5e'); g.addColorStop(.6, '#7a1f8e'); g.addColorStop(1, '#b02a9a');
  X.fillStyle = g; X.fillRect(-OX, 0, VW, H);
  X.fillStyle = 'rgba(255,255,255,.07)';
  for (let y = 80; y < 440; y += 56) for (let x = -OX - 20 + ((y / 56 & 1) ? 28 : 0); x < W + OX + 40; x += 56) { X.beginPath(); X.moveTo(x, y - 20); X.lineTo(x + 14, y); X.lineTo(x, y + 20); X.lineTo(x - 14, y); X.closePath(); X.fill(); }
  for (let x = -OX + 30; x < 500; x += 150) { X.fillStyle = 'rgba(77,255,236,.3)'; rr(x, 58, 8, 380, 4); X.fill(); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x + 1, 58, 2, 380, 1); X.fill(); }
  X.fillStyle = '#1b0a38'; X.fillRect(-OX, 0, VW, 48); X.fillStyle = INK; X.fillRect(-OX, 46, VW, 5);
  for (let x = 40 - Math.ceil(OX / 130) * 130; x < W + OX; x += 130) {
    const p = new Path2D(); p.moveTo(x - 24, 46); p.quadraticCurveTo(x - 24, 20, x, 18); p.quadraticCurveTo(x + 24, 20, x + 24, 46); p.closePath(); cel(p, '#ffe98a', '#e0a82a', 5, 6, 3);
    X.fillStyle = 'rgba(255,255,255,.7)'; el(x - 8, 30, 5, 8, .3); X.fill();
  }
  // wanted poster: the dancing hot dog (a background gag that never stops being weird)
  X.save(); X.translate(94, 190); X.rotate(-.05); rr(-62, -78, 124, 160, 8); ink('#ffe0f4', 4); rr(-52, -68, 104, 140, 4); X.fillStyle = '#ff9bd4'; X.fill();
  mvDog(0, 62, 5.4, 0, 'happy', 0, 0); X.restore();
  // floor + conveyor body
  X.fillStyle = '#2b0f5e'; X.fillRect(-OX, 494, VW, H - 494);
  for (let r = 0; 500 + r * 26 < H; r++) for (let x = -OX - 64 + (r & 1) * 32; x < W + OX; x += 64) { X.fillStyle = ((x / 32 | 0) + r) & 1 ? '#3b1d6e' : '#2b0f5e'; X.fillRect(x + 1, 500 + r * 26, 62, 24); }
  X.fillStyle = INK; X.fillRect(-OX, 490, VW, 6);
  rr(-OX - 20, 440, VW + 40, 54, 8); ink('#6b2a14', 4);
  X.fillStyle = '#8a3a1c'; X.fillRect(-OX, 446, VW, 6); X.fillStyle = 'rgba(0,0,0,.25)'; X.fillRect(-OX, 478, VW, 10);
}
/* ───────────── 1 POSE: feed the screaming cheese wall the shape of its hole before the hot-dog conveyor delivers you ───────────── */
reg('mv_pose', sp => {
  const rs = Math.sqrt(sp), R = sp >= 1.6 ? 2 : 1, DUR = 4.5, PASS = .25;
  const RT = (DUR / rs - .3 - R * PASS) / R;
  const SX = -OX + 100;   // conveyor start: left screen edge
  const HOLES = [[560, 110, 14], [780, 95, 20], [540, 250, 11], [790, 300, 16], [590, 410, 12], [760, 420, 10]], BELT = [0, 3, 2, 5];
  let r = 0, c = 0, c2 = 0, cur = 4, tgt = (Math.random() * 4) | 0, phase = 0, wallT = 0, flash = 0, snap = 0, belt = 0, slam = 0, slamS = '', jaw = 0, oT = 0;
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
      wallT = Math.max(0, wallT - dt); flash = Math.max(0, flash - dt); snap = Math.max(0, snap - dt); slam = Math.max(0, slam - dt * 1.5); jaw = Math.max(0, jaw - dt);
      if (g.result) { oT += dt; return; }
      belt += dt;
      if (phase === 0) {
        c += dt;
        if (c >= RT) {
          c = RT;
          if (cur === tgt) {
            phase = 1; c2 = 0; flash = .25; jaw = .3; slam = 1; slamS = 'NOM!'; sfx.hit(); sfx.stamp(); sfx.boing(); shake(7, .22);
            burst(520, 300, GOLD, 16, 320); ring(520, 330, '#fff', 120); floatText('MATCH!', 400, 250, '#5CFF7A', 46);
          } else {
            g.result = 'lose'; slam = 1; slamS = 'WHAT?!'; mvLose(500, 380); sfx.boing(); sfx.splat(); snd(900, .3, 'sawtooth', .05, 0, 120);
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
      const k = Math.min(1, c / RT), danger = k > .75 && !phase && !g.result, lose = g.result === 'lose', win = g.result === 'win';
      ctx.fillStyle = '#2b0f5e'; ctx.fillRect(-OX, 0, VW, H);
      mvWarp(danger ? 1.6 : .6, t);
      ctx.drawImage(bake('pose', bgPose), -OX, 0);
      const bx = 230, by = 120 + Math.sin(t * 2) * 8;
      beams(bx, by, t, .1); ball(bx, by, 40, t, win ? 'wow' : lose ? 'sour' : 'idle', 1, .6);
      // the wall (runs off the right screen edge): a screaming cheese wall with a mouth-shaped hole
      const WE = Math.max(820, W + OX + 10), ww = WE - 520 + 40, sx = danger ? Math.sin(t * 60) * 3 : 0, lunge = lose ? -Math.min(1, oT * 9) * 34 : 0;
      ctx.save(); ctx.translate(sx + lunge, 0);
      const wp = rrP(520, 70, ww, 380, 26); cel(wp, '#FFC93C', '#E09A10', 14, 10, 5);
      glint(wp, 575, 92, 46, 10, 'rgba(255,255,255,.4)');
      for (const h of HOLES) { el(h[0], h[1], h[2], h[2] * .88); ink('#E09A10', 2.5); X.fillStyle = '#c47e08'; el(h[0] + 2, h[1] + 2, h[2] * .6, h[2] * .5); X.fill(); }
      // the mouth
      const mry = lose ? 100 * (1 - Math.min(1, oT * 8) * .75) : 100 * (1 + jaw * .6 + (danger ? .15 : 0));
      el(660, 350, 108, mry + 6); ink(INK, 0); X.fillStyle = INK; X.fill();
      el(660, 350, 102, mry); X.fillStyle = '#7a0a38'; X.fill();
      X.save(); el(660, 350, 102, mry); X.clip(); el(660 + Math.sin(t * 5) * 6, 350 + mry * .8, 70, 22); ink('#ff6fa5', 3); X.fillStyle = '#ff9bc0'; el(660 + Math.sin(t * 5) * 6, 350 + mry * .75, 24, 6); X.fill(); X.restore();
      for (let i = 0; i < 7; i++) { const tx = 580 + i * 26.7, ty = 350 - mry * Math.sqrt(Math.max(0, 1 - Math.pow((tx - 660) / 102, 2))); X.beginPath(); X.moveTo(tx - 11, ty - 2); X.lineTo(tx, ty + 24); X.lineTo(tx + 11, ty - 2); X.closePath(); ink('#fff', 2.5); }
      // eyes track the conveyor
      const cx0 = phase ? 500 : SX + (500 - SX) * k, lk = (cx0 - 660) / 300, er = 26 * (1 + (danger ? .35 : 0) + jaw);
      const wm = win ? 'happy' : lose ? 'smug' : 'idle';
      eye(600, 190, er, { m: wm, lx: lk, ly: .5, k: 1, lc: '#FFC93C', lid: .5 }); eye(720, 190, er, { m: wm, lx: lk, ly: .5, k: 2, lc: '#FFC93C', lid: .5 });
      const bu = danger ? 10 : win ? -8 : 0;
      brow(570, 150 - bu, 626, (win ? 146 : lose ? 150 : 163), 6); brow(750, 150 - bu, 694, (win ? 146 : lose ? 150 : 163), 6);
      X.fillStyle = 'rgba(255,110,140,.5)'; for (const bxx of [580, 740]) { el(bxx, 232, 15, 9); X.fill(); }
      // the order sign: which pose?
      rr(626, 78, 68, 48, 12); ink('#2b0f5e', 4); drawArrow(660, 102, ARROW_DIR[tgt], 15, GOLD);
      if (!(phase || win)) { const hu = 7 * (1 + wallT * 1.2); mvFig(660, 444, hu, tgt, '#1b0a38', { sil: 1, oc: (now * 6 | 0) % 2 ? GOLD : '#fff', ol: 5 }); }
      if (flash > 0) { X.save(); X.globalAlpha = flash * 2; X.fillStyle = '#fff'; rr(520, 70, ww, 380, 26); X.fill(); X.restore(); }
      if (win) for (let i = 0; i < 4; i++) { const hy = 380 - oT * 150 - i * 46; if (hy > 120) heart(600 + i * 62 + Math.sin(oT * 6 + i) * 8, hy, 1.4 - i * .12); }
      ctx.restore();
      // belt chevrons (the belt body is baked)
      ctx.fillStyle = '#d9822b'; const off = (belt * 140) % 48;
      for (let x = -OX - 48 + off; x < W + OX; x += 48) { ctx.beginPath(); ctx.moveTo(x, 458); ctx.lineTo(x + 20, 467); ctx.lineTo(x, 476); ctx.lineTo(x + 8, 467); ctx.closePath(); ctx.fill(); }
      // hot dogs riding the factory belt
      const sp2 = VW + 100;
      for (let i = 0; i < 4; i++) mvFoodie(-OX - 50 + ((i * sp2 / 4 + belt * 140) % sp2), 446, .42, BELT[i], t, win ? 2 : .7, { lx: 1, ly: 0 });
      // caos
      const x = phase ? 500 + 160 * Math.min(1, c2 / PASS) : win ? 660 : SX + (500 - SX) * k;
      const bob = g.result ? 0 : Math.abs(Math.sin(belt * 14)) * 3, sq = snap > 0 ? 1 + snap * .5 : 1;
      const mood = win ? 'happy' : lose ? 'bonk' : danger ? 'panic' : cur === tgt ? 'eager' : 'idle';
      const fp = win || phase ? 0 : cur;
      const flat = lose ? 1 - Math.min(1, oT * 9) * .4 : 1;
      shadow(x, 446, 60, 10, .35);
      ctx.save(); ctx.translate(x, 444 - bob); ctx.scale(sq * (lose ? 2 - flat : 1), (2 - sq) * flat); ctx.translate(-x, -444 + bob);
      mvFig(x, 444 - bob, 7, fp, OR, { face: mood, lx: (660 - x) / 300, ly: -.1 });
      ctx.restore();
      if (lose && oT > .08) stars(x, 395, 26, oT);
      if (!lose) pill(x, 314 - bob, 'YOU', GOLD);
      if (danger && cur !== tgt) txt('!', x, 280, 60, '#ff4d4d');
      ctx.restore();   // mvWarp
      // timer: a neon tube (and the round counter)
      neonTube(290, 64, 220, 22, k, TEAL, danger);
      if (R > 1) txt((r + 1) + '/' + R, 262, 76, 26, '#fff');
      mvButtons(cur === 4 ? -1 : cur, !!g.result);
      pop(slamS, slam, slamS === 'NOM!' ? '#2fb85a' : '#ff4d5e', '#fff', 250, 46, 190);
      vignette(.2);
    }
  };
  return g;
}, 'POSE!');

/* ───────────── 2 COPY scenery: a velvet theatre, sunburst backdrop, two podiums, footlights ───────────── */
function bgMirror() {
  X.fillStyle = '#0f6f64'; X.fillRect(-OX, 0, VW, 436);
  for (let i = 0; i < 20; i++) { const a0 = i * TAU / 20, a1 = a0 + TAU / 40; X.fillStyle = i & 1 ? '#19C6B7' : '#12a89b'; X.beginPath(); X.moveTo(400, 330); X.lineTo(400 + Math.cos(a0) * 1500, 330 + Math.sin(a0) * 1500); X.lineTo(400 + Math.cos(a1) * 1500, 330 + Math.sin(a1) * 1500); X.fill(); }
  X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(-OX, 0, VW, 436);
  // side curtains
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -OX - 10 : W + OX + 10, wdt = 130 + OX * .0;
    for (let i = 0; i < 4; i++) { const cx = x0 + side * -i * 34 + (side < 0 ? 0 : -34); X.beginPath(); X.moveTo(cx, 0); X.lineTo(cx + 34, 0); X.lineTo(cx + 34 - side * 8, 436); X.lineTo(cx - side * 8, 436); X.closePath(); ink(i & 1 ? '#c42a52' : '#a01a3a', 3); }
    void wdt;
  }
  // valance with gold fringe
  X.fillStyle = '#8a1030'; X.fillRect(-OX, 0, VW, 40);
  for (let x = -OX; x < W + OX + 60; x += 60) { X.beginPath(); X.arc(x + 30, 40, 30, 0, Math.PI); ink('#a01a3a', 3); }
  X.fillStyle = INK; X.fillRect(-OX, 0, VW, 4);
  // stage boards
  const fl = X.createLinearGradient(0, 436, 0, H); fl.addColorStop(0, '#b97a46'); fl.addColorStop(1, '#8a5530'); X.fillStyle = fl; X.fillRect(-OX, 436, VW, H - 436);
  X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 3; for (let x = -OX - 20; x < W + OX; x += 90) { X.beginPath(); X.moveTo(x, 436); X.lineTo(x - 30 + (x - 400) * .25, H); X.stroke(); }
  X.fillStyle = INK; X.fillRect(-OX, 432, VW, 6);
  // podiums
  for (const sx of [200, 600]) {
    X.fillStyle = 'rgba(20,16,28,.3)'; el(sx, 440, 140, 14); X.fill();
    const p = rrP(sx - 130, 404, 260, 30, 6); cel(p, sx < 400 ? '#B98CFF' : '#FFC9E6', sx < 400 ? '#8a5fd0' : '#e58fb8', 6, 8, 4);
    glint(p, sx - 70, 412, 50, 5, 'rgba(255,255,255,.5)', 0);
  }
  // footlight sockets
  for (let x = -OX + 20; x < W + OX; x += 40) bulb(x, 470, 7, false, GOLD);
}
/* ───────────── 2 COPY: a dancing hot dog does 3 moves in front of a snack audience; repeat them ───────────── */
reg('mv_mirror', sp => {
  const rs = Math.sqrt(sp), B = .62 / rs, D0 = .45 / rs, seq = [];
  for (let i = 0; i < 3; i++) { let n; do { n = (Math.random() * 4) | 0; } while (i && n === seq[i - 1]); seq.push(n); }
  let c = 0, phase = 0, i = 0, tp = 4, pp = 4, pt = 0, lastStep = -1, bounce = 0, slam = 0, slamS = '', failAt = -1, cheer = 0, oT = 0;
  const press = pi => {
    if (g.result || phase !== 1 || pi < 0) return;
    pp = pi; pt = .5; bounce = .2;
    if (pi === seq[i]) {
      sfx.blip(i * 3 + 2); sfx.pop(); burst(600, 300, '#5CFF7A', 10); ring(600, 300, '#5CFF7A', 80, .35); cheer = .5;
      i++; floatText('OK!', 600, 170, '#5CFF7A', 34);
      if (i >= 3) { g.result = 'win'; mvWin(600, 300); slam = 1; slamS = 'NOM!'; confetti(200, 300, 24); }
    } else { g.result = 'lose'; failAt = c; slam = 1; slamS = 'WHAT?!'; mvLose(600, 300); sfx.boing(); sfx.splat(); }
  };
  const g = {
    wide: true, cmd: 'COPY THE DOG!', hint: 'ARROWS: REPEAT THE DANCE', thint: 'TAP THE POSES IN ORDER', dur: 6,
    key(e) { if (!e.repeat) press(poseKey(e)); },
    down(p) { press(mvBtnHit(p)); },
    update(dt) {
      c += dt; pt = Math.max(0, pt - dt); bounce = Math.max(0, bounce - dt); slam = Math.max(0, slam - dt * 1.5); cheer = Math.max(0, cheer - dt);
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
      const lost = g.result === 'lose', win = g.result === 'win';
      ctx.fillStyle = '#0f6f64'; ctx.fillRect(-OX, 0, VW, H);
      mvWarp(.7 + (cheer > 0 ? .6 : 0), t);
      ctx.drawImage(bake('mirror', bgMirror), -OX, 0);
      // spotlight on whoever is on duty, chase lights along the footlights
      spot(phase === 0 ? 200 : 600, phase === 0 ? 200 : 600, 436, lost ? .05 : .2);
      for (let x = -OX + 20, n = 0; x < W + OX; x += 40, n++) if ((n + (t * 6 | 0)) % 3 === 0) bulb(x, 470, 7, true, win ? MVC[n % 4] : GOLD);
      mvAudience(402, t, lost ? 0 : cheer > 0 || win ? 2.4 : .9, .62, lost ? 0 : Math.sin(t * 2), .3);
      // pads sit over the front row (baked); the dancers
      const bob = Math.abs(Math.sin(t * 8)) * (phase === 0 ? 4 : 2), fl = lost ? Math.min(1.5, (c - failAt) * 6) : 0;
      // the hot dog dancer (falls over laughing when you blow it)
      ctx.save(); ctx.translate(200, 404); ctx.rotate(-fl); ctx.translate(-200, -404);
      mvDog(200, 404 - bob, 9, tp, lost ? 'happy' : win ? 'happy' : 'idle', lost ? 0 : .6, lost ? -1 : .3);
      ctx.restore();
      const cm = win ? 'happy' : lost ? 'bonk' : phase === 1 ? 'eager' : 'idle';
      mvFig(600, 404 - (bounce > 0 ? 12 * Math.sin(bounce / .2 * 3.14) : win ? Math.abs(Math.sin(oT * 9)) * 16 : bob * .5), 9, win ? 0 : pp, OR, { face: cm, lx: -.8, ly: -.1 });
      if (lost) stars(600, 280, 30, oT);
      pill(200, 242, phase === 0 ? 'WATCH' : 'COPY', '#fff');
      pill(600, 242, phase === 1 && !g.result && (now * 4 | 0) % 2 ? 'YOU!' : 'YOU', GOLD);
      if (phase === 0 && tp !== 4) { rr(150, 150, 100, 66, 18); ink('#fff', 4); X.beginPath(); X.moveTo(188, 214); X.lineTo(200, 230); X.lineTo(214, 214); X.closePath(); ink('#fff', 4); rr(152, 152, 96, 62, 16); X.fillStyle = '#fff'; X.fill(); drawArrow(200, 183, ARROW_DIR[tp], 24, GOLD); }
      if (win) for (let h = 0; h < 6; h++) { const hy = 380 - oT * 150 - (h % 3) * 40; if (hy > 160) heart((h < 3 ? 70 + h * 80 : 480 + (h - 3) * 90) + Math.sin(oT * 5 + h) * 8, hy, 1.3); }
      ctx.restore();   // mvWarp
      // sequence marquee: three bulb-ringed windows
      rr(238, 66, 324, 78, 18); ink('#2b0f5e', 4);
      for (let b = 0; b < 15; b++) bulb(252 + b * 21.7, 70, 4, ((t * 5 | 0) + b) % 2 === 0, GOLD);
      for (let s = 0; s < 3; s++) {
        const sx = 400 + (s - 1) * 90, done = phase === 1 ? s < i : s <= lastStep;
        rr(sx - 31, 79, 62, 56, 10); ink(done ? '#fff' : '#12806f', 3.5);
        if (done) drawArrow(sx, 108, ARROW_DIR[seq[s]], 18, phase === 1 ? '#5CFF7A' : MAG); else txt('?', sx, 109, 36, '#fff');
      }
      mvButtons(pt > 0 ? pp : -1, !!g.result);
      pop(slamS, slam, slamS === 'NOM!' ? '#2fb85a' : '#ff4d5e', '#fff', 190, 44, 640);
      vignette(.2);
    }
  };
  return g;
}, 'COPY!');

/* ───────────── 3 BEAT scenery: club wall of rings, speaker stacks, floor tiles ───────────── */
function bgBeat() {
  const g = X.createLinearGradient(0, 0, 0, 470); g.addColorStop(0, '#1d0b4a'); g.addColorStop(1, '#5a24a8'); X.fillStyle = g; X.fillRect(-OX, 0, VW, H);
  for (let i = 7; i >= 1; i--) { X.fillStyle = i & 1 ? 'rgba(255,255,255,.06)' : 'rgba(255,62,165,.1)'; el(400, 300, i * 80, i * 80 * .9); X.fill(); }
  for (let i = 0; i < 40; i++) spark(-OX + hr(i) * VW, 20 + hr(i + 50) * 400, 2 + hr(i + 90) * 3, 'rgba(255,255,255,.5)');
  // curtains
  for (const x0 of [-OX - 6, W + OX - 80]) for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(x0 + i * 28, 0); X.lineTo(x0 + i * 28 + 28, 0); X.lineTo(x0 + i * 28 + 22, 464); X.lineTo(x0 + i * 28 - 6, 464); X.closePath(); ink(i & 1 ? '#8a1c5e' : '#a8266e', 3); }
  // speaker stacks
  for (const sx of [34, 646]) {
    const p = rrP(sx, 252, 120, 214, 10); cel(p, '#4b4568', '#2e2a45', 8, 10, 4); glint(p, sx + 30, 262, 40, 5, 'rgba(255,255,255,.25)', 0);
    for (const cy of [300, 400]) { X.beginPath(); X.arc(sx + 60, cy, cy === 300 ? 24 : 40, 0, TAU); ink('#1c1830', 3); }
  }
  // floor
  X.fillStyle = '#2b0f5e'; X.fillRect(-OX, 464, VW, H - 464);
  for (let r = 0; 470 + r * 30 < H; r++) for (let x = -Math.ceil(OX / 64) * 64; x < W + OX; x += 64) { X.fillStyle = ((x / 64 | 0) + r) & 1 ? '#3b1d6e' : '#2b0f5e'; X.fillRect(x + 2, 470 + r * 30 + 2, 60, 26); }
  X.fillStyle = INK; X.fillRect(-OX, 460, VW, 6);
}
/* ───────────── 3 BEAT: the judgmental disco ball swings the tempo; land the ring on the giant eyeball and the snacks explode with joy ───────────── */
reg('mv_beat', sp => {
  const rs = Math.sqrt(sp), B = .8 / rs, T = 1.15 / rs, H0 = 1.3 / rs, GOODW = .19 - .04 * (sp - 1), PERF = .07;
  const hs = [H0, H0 + B, H0 + 2 * B], ticks = [H0 - B, hs[0], hs[1], hs[2]], ticked = [0, 0, 0, 0];
  const res = [0, 0, 0];     // 0 pending, 1 good, 2 perfect
  let c = 0, j = 0, pulse = 0, hop = 0, joy = 0, gasp = 0, slam = 0, slamS = '', oT = 0;
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
  const miss = s => { g.result = 'lose'; res[j] = -1; gasp = 1; slam = 1; slamS = 'WHAT?!'; mvLose(400, 300); sfx.splat(); snd(800, .35, 'sawtooth', .05, 0, 90); floatText(s || 'MISS!', 400, 190, '#ff4d4d', 48); };
  const g = {
    wide: true, cmd: 'OBEY THE BALL!', hint: 'SPACE / CLICK ON THE BEAT', thint: 'TAP WHEN THE RING LANDS', dur: 5,
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || /^Arrow/.test(e.code))) press(); },
    down() { press(); },
    update(dt) {
      pulse = Math.max(0, pulse - dt); hop = Math.max(0, hop - dt); joy = Math.max(0, joy - dt); slam = Math.max(0, slam - dt * 1.5);
      if (g.result) { oT += dt; return; }
      c += dt;
      for (let i = 0; i < 4; i++) if (!ticked[i] && c >= ticks[i]) { ticked[i] = 1; i ? sfx.tickHi() : sfx.tick(); pulse = .15; }
      if (j < 3 && c > hs[j] + GOODW) miss('MISS!');
    },
    draw(t) {
      X = ctx;
      const win = g.result === 'win', lose = g.result === 'lose', pu = pulse / .15;
      ctx.fillStyle = '#2b0f5e'; ctx.fillRect(-OX, 0, VW, H);
      mvWarp(.5 + joy * 1.5 + gasp, t);
      ctx.drawImage(bake('beat', bgBeat), -OX, 0);
      // lit floor tiles on the beat
      const bt = (t * (60 / B) / 60) | 0;
      for (let r = 0; 470 + r * 30 < H; r++) for (let x = -Math.ceil(OX / 64) * 64; x < W + OX; x += 64) {
        const lit = win || ((((x / 64) | 0) + r * 3 + bt) % 5 === 0 && !lose); if (!lit) continue;
        ctx.fillStyle = MVC[((((x / 64) | 0) + r + bt) % 4 + 4) % 4]; ctx.globalAlpha = win ? .85 : .75; ctx.fillRect(x + 2, 470 + r * 30 + 2, 60, 26); ctx.globalAlpha = 1;
      }
      // speaker woofers thump on the beat
      for (const sx of [34, 646]) for (const [cy, rad] of [[300, 24], [400, 40]]) { const z = 1 + pu * .14 + (win ? Math.sin(t * 20) * .05 : 0); X.beginPath(); X.arc(sx + 60, cy, rad * z, 0, TAU); ink(lose ? '#2a2540' : '#e8e2f6', 3); X.fillStyle = INK; X.beginPath(); X.arc(sx + 60, cy, rad * z * .4, 0, TAU); X.fill(); }
      // spotlight on the eyeball and a pool on the floor
      spot(400, 400, 476, .13); X.fillStyle = 'rgba(255,255,255,.14)'; el(400, 492, 120, 16); X.fill();
      // the snack audience: stops dead when you blow it, goes feral when you nail it
      mvAudience(468, t, gasp ? 0 : .7 + joy * 4, .85 + joy * .25, 0, -.2);
      // target: a giant judging eyeball
      const tr = 62 * (1 + pu * .12), ex = 400, ey = 300 + Math.sin(t * 2) * 3;
      shadow(400, 490, 80, 12, .3);
      const ep = new Path2D(); ep.arc(ex, ey, tr, 0, TAU); cel(ep, lose ? '#e8f3cf' : '#fff', lose ? '#b9cf93' : '#d6d0ee', 8, 10, 6);
      if (lose) { X.save(); X.clip(ep); X.strokeStyle = '#e8434f'; X.lineWidth = 2.5; for (let q = 0; q < 8; q++) { const a = q * .8 + .3; X.beginPath(); X.moveTo(ex + Math.cos(a) * tr, ey + Math.sin(a) * tr); X.quadraticCurveTo(ex + Math.cos(a + .4) * tr * .7, ey + Math.sin(a + .4) * tr * .7, ex + Math.cos(a) * tr * .45, ey + Math.sin(a) * tr * .45); X.stroke(); } X.restore(); }
      const lkx = lose ? 0 : Math.sin(t * 1.5) * .8, lky = lose ? -1 : 0, near = j < 3 && !g.result && Math.abs(hs[j] - c) < GOODW * 1.6;
      const ir = tr * (win ? .5 : .6), pr = tr * (lose ? .16 : near ? .4 : .32);
      const ix = ex + lkx * 12, iy = ey + lky * 20;
      X.fillStyle = win ? '#ff7bc2' : lose ? '#8fbf4a' : MAG; X.beginPath(); X.arc(ix, iy, ir, 0, TAU); X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
      X.fillStyle = INK; X.beginPath(); X.arc(ix, iy, pr, 0, TAU); X.fill();
      X.fillStyle = '#fff'; X.beginPath(); X.arc(ix - ir * .3, iy - ir * .3, ir * .2, 0, TAU); X.fill();
      if (win) { for (const s of [-1, 1]) heart(ex + s * 58, ey - 54, .9); }
      // eyelid: smug at rest, wide when pulsing, droopy when you blow it, lashes when you win
      X.save(); X.clip(ep); X.fillStyle = lose ? '#9fbd6e' : '#e04aa0'; const lid = win ? .1 : lose ? .55 : near ? 0 : .22 + Math.abs(Math.sin(t * .8)) * .06; X.fillRect(ex - tr, ey - tr - 2, tr * 2, tr * 2 * lid + 2); if (lid > 0) { X.lineWidth = 4; X.strokeStyle = INK; X.beginPath(); X.moveTo(ex - tr, ey - tr + tr * 2 * lid); X.lineTo(ex + tr, ey - tr + tr * 2 * lid); X.stroke(); } X.restore();
      X.strokeStyle = GOLD; X.lineWidth = 6; X.beginPath(); X.arc(ex, ey, tr - 8, 0, TAU); X.stroke();
      ctx.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 4; for (let q = -3; q <= 3; q++) { const a = -Math.PI / 2 + q * .28; X.beginPath(); X.moveTo(ex + Math.cos(a) * tr, ey + Math.sin(a) * tr); X.lineTo(ex + Math.cos(a) * (tr + 16), ey + Math.sin(a) * (tr + 16) - (win ? 6 : 0)); X.stroke(); }
      // rings
      for (let i = j; i < 3; i++) {
        const k = (hs[i] - c) / T; if (k > 1) continue;
        const r = 62 + 190 * Math.max(-.2, k), nr = Math.abs(hs[i] - c) < GOODW;
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(400, 300, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = nr ? GOLD : MAG; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(400, 300, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(400, 300, r - 2, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      }
      // metronome = the judgmental disco ball, swinging on the beat
      const sw = Math.sin((c - H0) / B * Math.PI) * .5, bx = 130 + sw * 260, by = 150 + Math.abs(sw) * -30 + (gasp ? 40 : 0);
      beams(bx, by, t, .1); ball(bx, by, 46, t, win ? 'wow' : lose ? 'sour' : 'idle', 1, .6);
      // caos: eyes on the eyeball, jumps with arms up on every hit
      const jump = hop > 0 ? Math.sin(hop / .25 * Math.PI) * 30 : pulse > 0 ? 6 * pu : win ? Math.abs(Math.sin(oT * 9)) * 18 : 0;
      const cm = win ? 'happy' : lose ? 'bonk' : near ? 'eager' : 'idle';
      shadow(400, 532, 50 - jump * .4, 9, .3);
      if (lose) { ctx.save(); ctx.translate(400, 532); ctx.rotate(Math.min(1, oT * 6) * .12); ctx.scale(1.2, .85); ctx.translate(-400, -532); mvFig(400, 532, 7, 1, OR, { face: 'bonk' }); ctx.restore(); if (oT > .08) stars(400, 480, 30, oT); }
      else mvFig(400, 532 - jump, 7, hop > 0 || win ? 0 : 4, OR, { face: cm, lx: 0, ly: -1 });
      if (!lose) pill(400, 532 - jump - 118, 'YOU', GOLD);
      ctx.restore();   // mvWarp
      // pips: a three-bulb marquee
      rr(318, 62, 164, 44, 22); ink('#2b0f5e', 4);
      for (let i = 0; i < 3; i++) { bulb(354 + i * 46, 84, 15, res[i] !== 0, res[i] === 2 ? GOLD : res[i] === 1 ? TEAL : '#ff4d4d'); }
      pop(slamS, slam, '#ff4d5e', '#fff', 200, 52);
      vignette(.2);
    }
  };
  return g;
}, 'BEAT!');

/* ───────────── 4 SWIM scenery: a tiled swimming hall, bleachers, a pool of soup with lane ropes ───────────── */
function bgSwim(X1) {
  X.fillStyle = '#FFE29A'; X.fillRect(-OX, 0, VW, 78);
  for (let y = 0; y < 78; y += 26) for (let x = -OX - 20 + ((y / 26 & 1) ? 26 : 0); x < W + OX; x += 52) { X.fillStyle = 'rgba(200,140,70,.16)'; X.fillRect(x, y, 50, 24); }
  X.fillStyle = '#c98443'; X.fillRect(-OX, 52, VW, 24); X.fillStyle = INK; X.fillRect(-OX, 50, VW, 4);
  for (let x = -OX; x < W + OX; x += 60) { X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(x + 40, 54, 3, 22); }
  X.fillStyle = INK; X.fillRect(-OX, 74, VW, 6);
  // soup
  const sg = X.createLinearGradient(0, 80, 0, 490); sg.addColorStop(0, '#6fb83f'); sg.addColorStop(1, '#9fd85c'); X.fillStyle = sg; X.fillRect(-OX, 80, VW, 410);
  X.fillStyle = 'rgba(240,255,180,.3)';
  for (let i = 0; i < 60; i++) { const x = -OX + hr(i + 1) * VW, y = 96 + hr(i + 77) * 380; rr(x, y, 20 + hr(i + 9) * 14, 4, 2); X.fill(); }
  // pool deck
  X.fillStyle = '#F6D98C'; X.fillRect(-OX, 490, VW, H - 490);
  for (let r = 0; 494 + r * 28 < H; r++) for (let x = -OX - 56 + (r & 1) * 28; x < W + OX; x += 56) { X.fillStyle = ((x / 28 | 0) + r) & 1 ? '#FFE9AE' : '#F2CF7A'; X.fillRect(x + 1, 496 + r * 28, 54, 26); }
  X.fillStyle = INK; X.fillRect(-OX, 486, VW, 6);
  // lane ropes with buoys
  for (const ry of [130, 305, 485]) { X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(-OX, ry); X.lineTo(W + OX, ry); X.stroke(); for (let x = 24 - Math.ceil(OX / 24) * 24; x < W + OX; x += 24) { X.beginPath(); X.arc(x, ry, 7, 0, TAU); ink((x / 24) & 1 ? MAG : '#fff', 2.5); } }
  // start wall and the touch pad / finish
  const sp = rrP(-OX - 20, 130, 60, 355, 10); cel(sp, '#f6f4fb', '#c9c2dc', 6, 8, 4);
  for (let q = 0; q < 9; q++) { X.fillStyle = 'rgba(111,126,170,.25)'; X.fillRect(-OX + 4, 140 + q * 38, 30, 4); }
  const fp = rrP(X1 + 22, 130, 28, 355, 6); inkP(fp, '#fff', 4);
  for (let q = 0; q < 18; q++) for (let k = 0; k < 2; k++) { X.fillStyle = (q + k) & 1 ? INK : '#fff'; X.fillRect(X1 + 22 + k * 14, 130 + q * 19.7, 14, 19.7); }
  X.strokeStyle = INK; X.lineWidth = 4; X.stroke(fp);
  for (const yy of [130, 485]) { X.fillStyle = '#c9ced6'; rr(X1 + 28, yy - 10, 16, 14, 4); ink('#c9ced6', 3); }
}
/* ───────────── 4 SWIM: alternate left/right strokes through a pool of soup to beat the rival rubber duck ───────────── */
reg('mv_swim', sp => {
  const rs = Math.sqrt(sp), TR = 4.2 / rs, X0 = -OX + 80, X1 = W + OX - 100, LY = [215, 395], ks = (X1 - X0) / 620, boost = (1 + .25 * (sp - 1)) * ks;   // ks: stroke power scales with pool length so time-to-finish stays the same
  let c = 0, px = X0, v = 0, last = -1, lastT = -1, arm = 0, stumble = 0, pad = [0, 0], combo = 0, slam = 0, slamS = '', quack = 0, nextQ = 1.2, boom = 0, oT = 0;
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
  const duck = (rx, dy, mood, rot) => {
    X.save(); X.translate(rx, dy); X.rotate(rot);
    const bp = new Path2D(); bp.ellipse(0, 8, 32, 26, 0, 0, TAU); cel(bp, '#FFE14D', '#F2C300', 6, 8, 4);
    glint(bp, -12, -2, 12, 5, 'rgba(255,255,255,.55)');
    const wp = new Path2D(); wp.ellipse(-10, 10, 14, 9, -.4, 0, TAU); inkP(wp, '#F2C300', 3);
    const hp = new Path2D(); hp.arc(26, -14, 19, 0, TAU); cel(hp, '#FFE14D', '#F2C300', 4, 5, 4);
    const bl = rrP(40, -17 + (quack > 0 ? -2 : 0), 24 + quack * 30, 12, 6); inkP(bl, '#FF8A3D', 3);
    const cp = new Path2D(); cp.moveTo(8, -18); cp.quadraticCurveTo(12, -40, 28, -38); cp.quadraticCurveTo(44, -36, 46, -18); cp.closePath(); inkP(cp, '#ff7bc2', 3);
    X.fillStyle = '#ffd1ea'; el(30, -34, 5, 4); X.fill();
    eye(28, -18, 8, { m: mood, lx: 1, ly: .3, k: 5, lc: '#FFE14D', lid: .5 });
    X.restore();
  };
  const g = {
    wide: true, cmd: 'SOUP SWIM!', hint: 'ALTERNATE LEFT / RIGHT', thint: 'TAP LEFT, RIGHT, LEFT, RIGHT...', dur: 5,
    key(e) { if (e.repeat) return; if (e.code === 'ArrowLeft' || e.code === 'KeyA') stroke(0); else if (e.code === 'ArrowRight' || e.code === 'KeyD') stroke(1); },
    down(p) { stroke(p.x < W / 2 ? 0 : 1); },
    update(dt) {
      pad[0] = Math.max(0, pad[0] - dt); pad[1] = Math.max(0, pad[1] - dt); arm = Math.max(0, arm - dt * 5); stumble = Math.max(0, stumble - dt);
      slam = Math.max(0, slam - dt * 1.5); quack = Math.max(0, quack - dt); boom = Math.max(0, boom - dt);
      if (g.result) { oT += dt; return; }
      c += dt; v *= Math.pow(.082, dt); px += v * dt;
      if (c >= nextQ) { nextQ = c + 1.1; quack = .25; snd(620, .09, 'square', .04, 0, 900); snd(900, .07, 'square', .03, .08, 600); }
      if (px >= X1) { px = X1; g.result = 'win'; slam = 1; slamS = 'GLORP!'; boom = .5; mvWin(px, LY[1] - 20); floatText('FIRST!', 400, 120, GOLD, 56); confetti(rivalX(), LY[0], 30); sfx.splat(); }
      else if (rivalX() >= X1) { g.result = 'lose'; slam = 1; slamS = 'QUACK!'; mvLose(px, LY[1]); floatText('TOO SLOW!', 400, 120, '#ff4d4d', 50); snd(500, .3, 'square', .06, 0, 120); }
    },
    draw(t) {
      X = ctx;
      const win = g.result === 'win', lose = g.result === 'lose';
      ctx.fillStyle = '#6fb83f'; ctx.fillRect(-OX, 0, VW, H);
      mvWarp(.5 + (g.result ? 1 : 0), t);
      ctx.drawImage(bake('swim', () => bgSwim(X1)), -OX, 0);
      mvAudience(76, t, g.result ? 2.2 : 1, .55, 0, .5);
      // floating soup: eyeballs that watch the race, peas, croutons
      for (let i = 0; i < 4; i++) { const ex = ((i * 260 + 90 - t * 15) % (VW + 100)) - OX, ey = 150 + (i % 2) * 170 + Math.sin(t * 2 + i) * 6; if (ex > -OX + 40 && ex < X1 - 20) eye(ex, ey, 13, { lx: (px - ex) / 300, ly: (LY[1] - ey) / 300, k: i }); }
      for (let i = 0; i < 6; i++) { const ex = ((i * 170 + 40 + t * 22) % (VW + 60)) - OX, ey = 130 + (i * 53) % 340 + Math.sin(t * 3 + i) * 4; X.beginPath(); X.arc(ex, ey, 6, 0, TAU); ink('#3f8f35', 2); }
      for (let i = 0; i < 4; i++) { const ex = ((i * 230 + 150 + t * 18) % (VW + 60)) - OX, ey = 160 + (i * 97) % 300 + Math.sin(t * 2.4 + i) * 4; X.save(); X.translate(ex, ey); X.rotate(i + t * .3); rr(-8, -8, 16, 16, 3); ink('#e9b86a', 2.5); X.restore(); }
      // swimmers: the rival is a rubber duck in a flowery cap
      const rx = rivalX(), pyy = LY[1] + 10 + (stumble > 0 ? Math.sin(t * 60) * 3 : 0), dy = LY[0] + 14 + Math.sin(t * 9) * 3;
      shadow(rx, LY[0] + 52, 40, 7, .15);
      if (win && oT < 1.2) duck(rx + oT * 90, dy - 330 * oT + 260 * oT * oT, 'bonk', oT * 12);
      else duck(rx, dy + (lose ? Math.sin(t * 14) * 4 : 0), lose ? 'happy' : 'smug', 0);
      if (lose) { const cw = new Path2D(); cw.moveTo(rx + 12, dy - 38); cw.lineTo(rx + 16, dy - 54); cw.lineTo(rx + 26, dy - 44); cw.lineTo(rx + 34, dy - 56); cw.lineTo(rx + 40, dy - 40); cw.closePath(); inkP(cw, GOLD, 3); }
      // caos, goggles on, one arm over the head at a time
      const sink = lose ? Math.min(1, oT * 1.5) * 22 : 0, cy = pyy + 8 + sink, mood = win ? 'happy' : lose ? 'bonk' : stumble > 0 ? 'panic' : 'eager';
      mvFig(px, cy, 6, 4, OR, { face: mood, lx: 1, ly: .1 });
      const ey2 = cy + (-9 + 7 * .42) * 6;
      ln(px - 36, ey2, px - 28, ey2, '#2b2b55', 3); ln(px + 28, ey2, px + 36, ey2, '#2b2b55', 3);
      for (const s of [-1, 1]) { X.beginPath(); X.arc(px + s * 16.8, ey2, 12, 0, TAU); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); X.fillStyle = 'rgba(160,240,255,.3)'; X.fill(); }
      const up = arm * 20, front = last === 1 ? 1 : -1;
      for (const s of [-front, front]) {
        const raised = s === front, ax = px + 14 + (s === front ? 4 : -2), ay = raised ? pyy - 40 - up : pyy - 8, ap = rrP(ax, ay, raised ? 46 : 40, raised ? 18 : 16, 8);
        cel(ap, OR, '#b4553a', 4, 5, 3.5); glint(ap, ax + 12, ay + 4, 9, 3, 'rgba(255,255,255,.4)', 0);
        const hp = rrP(ax + (raised ? 38 : 32), ay - 1, 12, raised ? 20 : 18, 4); inkP(hp, '#f6f4fb', 3);
      }
      // soup cover + surface waves
      ctx.fillStyle = 'rgba(88,160,48,.3)';
      ctx.fillRect(-OX, LY[0] + 6, VW, 56); ctx.fillRect(-OX, LY[1] + 4, VW, 58);
      ctx.strokeStyle = '#eaffb8'; ctx.lineWidth = 3; ctx.beginPath();
      for (const wy of [LY[0] + 6, LY[1] + 4]) for (let x = -OX; x <= W + OX + 20; x += 20) { const yy = wy + Math.sin(x * .06 + t * 8) * 3; x > -OX ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
      // wake of bubbles
      for (let i = 1; i < 5; i++) { X.beginPath(); X.arc(px - 40 - i * 22, LY[1] + 6 - Math.sin(t * 10 + i) * 4, 6 / i + 2, 0, TAU); ink('rgba(234,255,184,.85)', 1.5); }
      if (win) { // gold medal around Caos's neck
        X.beginPath(); X.moveTo(px - 10, cy - 46); X.lineTo(px, cy - 22); X.lineTo(px + 10, cy - 46); ink('#ff4d5e', 2.5);
        X.beginPath(); X.arc(px, cy - 20, 10, 0, TAU); ink(GOLD, 3); spark(px, cy - 20, 5, '#fff3a0');
        for (let h = 0; h < 3; h++) { const hy = cy - 60 - oT * 120 - h * 30; if (hy > 120) heart(px - 40 + h * 40 + Math.sin(oT * 6 + h) * 6, hy, 1.1); }
      }
      if (lose) for (let z = 0; z < 3; z++) { X.beginPath(); X.arc(px - 20 + z * 18, cy - 70 - ((oT * 40 + z * 20) % 60), 5 + z, 0, TAU); ink('rgba(255,255,255,.8)', 1.5); }
      if (!lose) pill(px, pyy - 84 - up * .5, 'YOU', GOLD);
      ctx.restore();   // mvWarp
      // finish banner
      txt('FINISH', X1 + 36, 108, 24, GOLD);
      // controls: two chunky plates
      for (let s = 0; s < 2; s++) {
        const bw = 340 + OX, bx = s ? W / 2 + 20 : -OX + 40, on = pad[s] > 0, off = on ? 6 : 0, dn = !!g.result;
        const face = dn ? '#d3cfe0' : on ? '#ffd23f' : last === s ? '#d9c5ff' : '#f6f4fb', base = dn ? '#8f88a6' : on ? '#c99512' : '#7b6fb0';
        rr(bx, 504 + 8, bw, 38, 18); ink(base, 4); rr(bx, 500 + off, bw, 38, 18); ink(face, 4);
        X.fillStyle = 'rgba(255,255,255,.5)'; rr(bx + 14, 504 + off, bw - 28, 6, 3); X.fill();
        drawArrow(bx + bw / 2, 519 + off, s ? 1 : 3, 15, dn ? '#8f88a6' : on ? MAG : PUR);
      }
      // race tracker: a wooden plank with a Caos marker and a duck marker
      const prog = Math.max(0, Math.min(1, (px - X0) / (X1 - X0))), dpr = Math.max(0, Math.min(1, (rx - X0) / (X1 - X0)));
      rr(250, 82, 300, 16, 8); ink('#fff', 3.5);
      X.save(); rr(250, 82, 300, 16, 8); X.clip(); X.fillStyle = OR; X.fillRect(250, 82, 300 * prog, 16); X.restore();
      X.beginPath(); X.arc(250 + 300 * dpr, 90, 9, 0, TAU); ink('#FFE14D', 3); X.fillStyle = '#FF8A3D'; X.fillRect(250 + 300 * dpr + 5, 88, 8, 4);
      rr(250 + 300 * prog - 9, 80, 18, 20, 5); ink(OR, 3);
      pop(slamS, slam, slamS === 'QUACK!' ? '#FF8A3D' : '#2fb85a', '#fff', 150, 52);
      vignette(.2);
    }
  };
  return g;
}, 'SWIM!');

})();
