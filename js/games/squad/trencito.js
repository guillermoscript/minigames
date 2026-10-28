'use strict';
/* ═════════ SQUAD · TRENCITO (sq_trencito) ═════════
   A family rumba: the whole family is a conga line crossing the living room to the tequeño buffet.
   Seat 0 UNCLE (JUDGE) is the head: steers the line up / down the floor (arrows / W S / drag) to dodge the sofa, the styrofoam cooler and the hen.
   He is tipsy, so a seeded sway keeps pushing him sideways. Every hard swerve whips the tail and every hit stretches the chain.
   Seat 1 AUNT (and seat 3 COUSIN when there are 4) is a connector: taps on the beat of her own lane (arepas sliding to the plate) to match the stride.
   Seat 2 GRANDMA is the tail: she sees the tension gauge and taps to pull; the line stretches by itself, a tap while it is slack yanks it.
   The judge owns the tension: it integrates stretch + whip + bumps + pulls and declares the snap at > 1. At the buffet it checks the hits.
   Win: the train goes through the kitchen door with a tequeño in everyone's mouth. Lose: the chain snaps and grandma flies into the cooler.
   Netcode: head publishes y (<=10/s), judge publishes tension (<=10/s), connectors publish cumulative [hits, off, miss], grandma cumulative pulls.
   The level (obstacles, sway, beats) is drawn from the seeded mkR() so every screen sees the same world; everything is a function of S. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const HX = 420, LY0 = 352, LY1 = 536;                 // the head's screen x, the floor lane (feet baseline) the head can walk
const SPD = 230, SEND = 15.5;                         // floor px per sim second, the sim second the buffet is reached
const P = .9, B0 = 1.7, NB = 14, HITW = .17, PERF = .07;   // beat period, first beat, number of beats, hit window / perfect window
const SP = 70, STRETCH = 30;                          // link spacing, extra spacing at full tension
const BASE = .08, BUMP = .5, PULL = .1;              // tension: stretch per sim s, a bump, a pull
const CHAIN = n => n === 4 ? [0, 1, 3, 2] : [0, 1, 2];   // head to tail
const COLS = ['#FF8A3D', '#FF8FB1', '#9AD5FF', '#B6E388'];
const INKC = '#14101c', GOLD = '#ffcf33', CHEESE = '#ffe9a0', TEQ = '#e8a93a';

/* ───────────── tiny drawing kit (caos/txt/shadow/star draw on the global ctx) ───────────── */
const X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col, oc) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; if (oc !== null) { X.lineWidth = w + 5; X.strokeStyle = oc || INK; X.stroke(); } X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(280, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 280);
  X.restore();
}
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 24);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
const hash = k => { let h = (Math.floor(k) * 2654435761) >>> 0; h ^= h >>> 15; return (h % 1000) / 1000; };
const mixc = (a, b, k) => { const A = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); k = clamp(k, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

/* ───────────── the living room ───────────── */
function tequeno(x, y, s, rot) {                      // a golden breaded cheese stick
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(s, s);
  rr(-16, -4.5, 32, 9, 4.5); ink(TEQ, 2.5); X.fillStyle = 'rgba(255,255,255,.4)'; rr(-12, -3, 18, 2.5, 1.2); X.fill();
  X.beginPath(); X.arc(16, 0, 3.4, 0, TAU); ink(CHEESE, 1.8);
  X.restore();
}
function arepa(x, y, r, col) { el(x, y, r, r * .9); ink(col || '#e8c06a', 3); X.fillStyle = 'rgba(255,255,255,.4)'; el(x - r * .3, y - r * .35, r * .4, r * .22, -.5); X.fill(); }
function parrot(x, y, T) {
  const fl = Math.sin(T * 22) * 12;
  X.save(); X.translate(x, y);
  X.beginPath(); X.moveTo(-6, 0); X.quadraticCurveTo(-30, 8 + fl * .5, -42, 22 + fl); X.quadraticCurveTo(-18, 6, -2, 8); X.closePath(); ink('#ff3d3d', 2.5);
  el(0, 0, 18, 11); ink('#2fbf5b', 3); X.beginPath(); X.arc(14, -6, 9, 0, TAU); ink('#ffd23f', 3);
  X.beginPath(); X.moveTo(21, -8); X.lineTo(31, -4); X.lineTo(22, -1); X.closePath(); ink('#ff8a3d', 2);
  X.beginPath(); X.arc(16, -8, 2.2, 0, TAU); X.fillStyle = INK; X.fill();
  X.beginPath(); X.moveTo(-4, 0); X.quadraticCurveTo(0, -18 - fl, 10, -8); X.quadraticCurveTo(4, 2, -4, 0); ink('#4db8ff', 2.5);
  X.restore();
}
function tv(x, y, T) {
  rr(x, y + 100, 170, 100, 6); ink('#6b3f22', 4); rr(x + 8, y + 108, 74, 82, 4); ink('#8a5a3c', 3); rr(x + 90, y + 108, 72, 36, 4); ink('#8a5a3c', 3);
  rr(x + 18, y, 134, 100, 10); ink('#2c2a3a', 5);
  rr(x + 28, y + 10, 114, 72, 5); ink('#cfe9ff', 3);
  // the telenovela: two faces, a slap every few seconds
  const ph = (T % 3.2) / 3.2, slap = ph > .55 && ph < .75;
  X.save(); X.beginPath(); rr(x + 28, y + 10, 114, 72, 5); X.clip();
  X.fillStyle = '#ffb3c6'; X.fillRect(x + 28, y + 10, 114, 72);
  el(x + 62 + (slap ? 20 : 0), y + 50, 20, 22); ink('#f4c79a', 2.5); el(x + 112, y + 50, 20, 22); ink('#e8b184', 2.5);
  for (const [ex, ey] of [[x + 56 + (slap ? 20 : 0), y + 44], [x + 68 + (slap ? 20 : 0), y + 44], [x + 106, y + 44], [x + 118, y + 44]]) { X.beginPath(); X.arc(ex, ey, 2.4, 0, TAU); X.fillStyle = INK; X.fill(); }
  if (slap) { star(x + 90, y + 40, 14, 6, 8, T * 5, '#fff35c', 2.5); }
  else { X.fillStyle = '#7ad4ff'; for (let i = 0; i < 2; i++) { const k = (T * 1.6 + i * .5) % 1; el(x + 62, y + 58 + k * 18, 2.2, 3.6); X.fill(); } }
  X.restore();
  X.fillStyle = '#ff4d4d'; X.beginPath(); X.arc(x + 138, y + 92, 3, 0, TAU); X.fill();
}
function window_(x, y, T) {
  rr(x, y, 130, 150, 6); ink('#e9d6a6', 4); rr(x + 10, y + 10, 110, 130, 3); ink('#9ad8ff', 3);
  X.save(); rr(x + 10, y + 10, 110, 130, 3); X.clip();
  X.beginPath(); X.arc(x + 98, y + 36, 15, 0, TAU); ink('#ffe14d', 2.5);
  X.fillStyle = '#7a4a2a'; X.fillRect(x + 48, y + 80, 12, 60);
  for (const [dx, dy, r] of [[54, 70, 32], [30, 82, 22], [78, 84, 22], [54, 52, 20]]) { X.beginPath(); X.arc(x + dx, y + dy + Math.sin(T * 1.4 + dx) * 1.5, r, 0, TAU); ink('#3fb14a', 2.5); }
  for (const [dx, dy] of [[40, 90], [66, 74], [54, 100]]) { el(x + dx, y + dy, 6, 8); ink('#ffb23d', 2); }   // mangos
  X.restore();
  X.fillStyle = INK; X.fillRect(x + 63, y + 10, 4, 130); X.fillRect(x + 10, y + 72, 110, 4);
  tri(x - 14, y - 6, x + 28, y - 6, x + 6, y + 120, '#ff6b3d', 3);
}
function portrait(x, y) {
  rr(x, y, 78, 98, 4); ink('#d99a12', 4); rr(x + 8, y + 8, 62, 82, 2); ink('#d9f0ff', 2.5);
  el(x + 39, y + 42, 17, 20); ink('#f1c9a0', 2.5); el(x + 39, y + 24, 21, 11); ink('#cfcfe0', 2.5);
  X.fillStyle = INK; X.beginPath(); X.arc(x + 32, y + 42, 2, 0, TAU); X.arc(x + 46, y + 42, 2, 0, TAU); X.fill();
  X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.arc(x + 39, y + 50, 6, .2, Math.PI - .2); X.stroke();
  rr(x + 12, y + 66, 54, 22, 6); ink('#7a5ab8', 2.5);
}
function room(c, T, doorX) {
  X.fillStyle = '#f3d29a'; X.fillRect(0, 0, W, 336);
  const so = (c * .5) % 80; X.fillStyle = '#e8b878'; for (let x = -80 - so; x < W + 80; x += 80) X.fillRect(x, 0, 28, 336);
  X.fillStyle = 'rgba(255,255,255,.18)'; for (let x = -80 - so; x < W + 80; x += 80) X.fillRect(x + 4, 0, 6, 336);
  // the flag string (birthday)
  const fo = (c * .8) % 160;
  X.beginPath(); for (let x = -170; x <= W + 170; x += 20) { const y = 32 + 16 * Math.sin((x + fo) / 80 * Math.PI); x === -170 ? X.moveTo(x - fo, y) : X.lineTo(x - fo, y); }
  X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  for (let i = -2; i < 12; i++) { const x = i * 80 - fo + 40, y = 32 + 16 * Math.sin((x + fo) / 80 * Math.PI), sw = Math.sin(T * 3 + i) * 3; tri(x - 14, y, x + 14, y, x + sw, y + 30, ['#ff4d6d', '#ffd23f', '#4db8ff', '#7CE08A'][((i % 4) + 4) % 4], 2.5); }
  // wall furniture, parallax .5 (period 1000)
  const po = (c * .5) % 1000;
  for (let k = -1; k < 2; k++) {
    const ox = k * 1000 - po;
    window_(ox + 70, 96, T); portrait(ox + 300, 90); tv(ox + 470, 112, T);
    X.save(); X.translate(ox + 700, 232); rr(-8, 0, 56, 96, 6); ink('#8a5a3c', 3); X.restore();
    X.beginPath(); X.arc(ox + 720, 190, 26, 0, TAU); ink('#3fb14a', 3); X.beginPath(); X.arc(ox + 746, 208, 22, 0, TAU); ink('#2fa04c', 3);   // the matera plant
    // the birthday sign
    X.save(); X.translate(ox + 900, 120); X.rotate(-.04); badge('HAPPY BIRTHDAY!', 0, 0, 22, '#ff6b3d', '#fff', 1); X.restore();
  }
  parrot(((T * 90) % 1000) - 100, 118 + Math.sin(T * 3) * 14, T);
  // baseboard and floor
  X.fillStyle = '#7a4a2a'; X.fillRect(0, 318, W, 22); X.fillStyle = INK; X.fillRect(0, 316, W, 4); X.fillRect(0, 338, W, 3);
  const g = X.createLinearGradient(0, 340, 0, H); g.addColorStop(0, '#c98a4b'); g.addColorStop(1, '#a8672f'); X.fillStyle = g; X.fillRect(0, 341, W, H - 341);
  X.strokeStyle = 'rgba(60,30,10,.35)'; X.lineWidth = 3;
  for (const y of [372, 410, 454, 506, 566]) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  const jo = c % 150; for (let x = -150 - jo; x < W + 150; x += 150) for (let r = 0; r < 5; r++) { const y0 = [341, 372, 410, 454, 506][r], y1 = [372, 410, 454, 506, 566][r], dx = (r % 2) * 75; X.beginPath(); X.moveTo(x + dx, y0); X.lineTo(x + dx, y1); X.stroke(); }
  // the rug, scrolls with the floor
  const ro = c % 560;
  for (let x = -560 - ro; x < W + 560; x += 560) {
    rr(x + 40, 372, 440, 160, 12); ink('#b6313f', 4); rr(x + 58, 386, 404, 132, 8); ink('#f6e7c1', 2.5); rr(x + 72, 398, 376, 108, 6); ink('#d9435a', 2.5);
    for (let i = 0; i < 6; i++) { tri(x + 100 + i * 60, 452, x + 130 + i * 60, 408, x + 160 + i * 60, 452, GOLD, 2); tri(x + 100 + i * 60, 452, x + 130 + i * 60, 496, x + 160 + i * 60, 452, '#f6e7c1', 2); }
  }
}
function buffet(x, T, gone) {                          // table against the back wall + the kitchen door; x = table centre
  // kitchen door
  const dx = x + 175;
  rr(dx - 52, 170, 104, 172, 8); ink('#7a4a2a', 5); rr(dx - 40, 182, 80, 160, 4); ink('#fff2c2', 3);
  X.fillStyle = 'rgba(255,200,80,.5)'; X.fillRect(dx - 40, 182, 80, 160);
  for (let i = 0; i < 3; i++) { const k = (T * .8 + i / 3) % 1; el(dx - 14 + i * 14 + Math.sin(T * 2 + i) * 4, 300 - k * 90, 7, 11); X.fillStyle = `rgba(255,255,255,${.55 * (1 - k)})`; X.fill(); }   // steam
  rr(dx - 52, 140, 104, 26, 8); ink('#e8343d', 3); txt('KITCHEN DOOR', dx, 154, 16, '#fff', 'center', 96);
  // the table
  rr(x - 118, 262, 236, 18, 5); ink('#fff', 3);
  X.beginPath(); X.moveTo(x - 126, 276); X.lineTo(x + 126, 276); X.lineTo(x + 138, 340); X.lineTo(x - 138, 340); X.closePath(); ink('#e8343d', 4);
  X.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 6; i++) X.fillRect(x - 108 + i * 40, 280, 14, 56);
  // the pile of tequeños, a bowl of cachapas, a jug of papelón
  for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - r; i++) if (!(gone && (r + i) % 2)) tequeno(x - 40 + i * 24 + r * 12, 258 - r * 11, .62, ((i + r) % 3 - 1) * .12);
  el(x + 70, 256, 30, 10); ink('#ffd23f', 3); el(x + 70, 252, 24, 7); ink('#f4a21d', 2);
  rr(x - 96, 218, 30, 44, 8); ink('#ffb23d', 3); rr(x - 92, 210, 22, 10, 3); ink('#fff', 2);
  badge('TEQUEÑOS', x, 190, 18, '#ffb23d', INK, 1, -.03);
}

/* ───────────── the obstacles ───────────── */
function sofa(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s);
  shadow(0, 6, 108, 12, .28);
  rr(-96, -76, 192, 62, 18); ink('#8a2a3c', 4);
  rr(-106, -44, 36, 48, 12); ink('#a8354a', 4); rr(70, -44, 36, 48, 12); ink('#a8354a', 4);
  rr(-72, -40, 144, 42, 10); ink('#c2415a', 4);
  X.fillStyle = 'rgba(255,255,255,.25)'; rr(-62, -34, 124, 7, 3); X.fill();
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, -40); X.lineTo(0, 0); X.stroke();
  rr(-90, -2, 14, 10, 3); ink(INK, 0); rr(76, -2, 14, 10, 3); ink(INK, 0);
  X.restore();
}
function cava(x, y, s, open, lidA) {                   // the styrofoam cooler ("cava de anime"), the lid rotates open
  X.save(); X.translate(x, y); X.scale(s, s);
  shadow(0, 5, 46, 8, .28);
  rr(-40, -44, 80, 48, 6); ink('#f6f4ec', 4); X.fillStyle = 'rgba(0,0,0,.08)'; X.fillRect(-36, -14, 72, 14);
  X.fillStyle = '#d7d2c0'; for (let i = 0; i < 5; i++) X.fillRect(-30 + i * 14, -38, 3, 8);
  if (open) { X.save(); X.translate(-40, -44); X.rotate(-lidA); rr(0, -16, 84, 16, 5); ink('#3da5e0', 3.5); X.restore(); el(0, -44, 36, 6); ink('#b9e6ff', 2); }
  else { rr(-46, -60, 92, 18, 6); ink('#3da5e0', 4); rr(-16, -70, 32, 12, 5); ink('#2d8cc4', 3); }
  X.restore();
}
function hen(x, y, s, T, run) {
  X.save(); X.translate(x, y); X.scale(s, s);
  shadow(0, 4, 24, 6, .25);
  const b = Math.abs(Math.sin(T * (run ? 14 : 5))) * 3;
  line([[-6, 0], [-6, -14]], 3, '#ff9a3d'); line([[8, 0], [8, -14]], 3, '#ff9a3d');
  X.translate(0, -b);
  X.beginPath(); X.moveTo(-26, -20); X.quadraticCurveTo(-34, -42, -18, -42); X.quadraticCurveTo(-28, -30, -20, -22); X.closePath(); ink('#a84a1a', 2.5);   // tail
  el(0, -26, 24, 17); ink('#d9792b', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; el(-6, -33, 10, 5, -.4); X.fill();
  X.beginPath(); X.arc(16, -42, 11, 0, TAU); ink('#e68a3a', 3);
  X.beginPath(); X.arc(12, -53, 4, 0, TAU); ink('#e8343d', 2); X.beginPath(); X.arc(18, -54, 4, 0, TAU); ink('#e8343d', 2);
  tri(25, -44, 36, -40, 25, -37, '#ffd23f', 2);
  X.beginPath(); X.arc(19, -45, 2.4, 0, TAU); X.fillStyle = INK; X.fill();
  el(10, -26, 10, 8, .3); ink('#c26a22', 2);
  X.restore();
}

/* ───────────── the people ───────────── */
function person(kind, x, y, u, col, mood, T, o) {
  o = o || {};
  const bob = o.bob || 0;
  shadow(x, y + 2, 5.6 * u, 1.4 * u, .25);
  // a spin when she flies
  X.save(); if (o.rot) { X.translate(x, y - 5 * u); X.rotate(o.rot); X.translate(-x, -(y - 5 * u)); }
  caos(x, y - bob, u, { col, mood, run: o.run });
  const hy = y - bob - 12 * u;
  if (kind === 0) {                                    // the uncle: a cachucha and a cold one
    rr(x - 4.6 * u, hy - 1.6 * u, 9.2 * u, 3 * u, 1.2 * u); ink('#e8343d', 2.5); rr(x - 5.4 * u, hy + .6 * u, 11 * u, 1.4 * u, .7 * u); ink('#b32a30', 2);
    if (!o.noBottle) { rr(x + 7 * u, y - bob - 11 * u, 2 * u, 6 * u, .8 * u); ink('#4a8a2a', 2); rr(x + 7.4 * u, y - bob - 13.2 * u, 1.2 * u, 2.6 * u, .5 * u); ink('#4a8a2a', 2); }
  } else if (kind === 1) {                             // the aunt: pink curlers
    for (let i = 0; i < 3; i++) { rr(x + (i - 1) * 3.2 * u - 1.2 * u, hy - 2.4 * u, 2.4 * u, 3.4 * u, 1 * u); ink('#ff6fa8', 2); }
  } else if (kind === 2) {                             // the grandma: bun and glasses
    el(x, hy - 1 * u, 3.4 * u, 2.4 * u); ink('#d8d8e6', 2.5);
    for (const sx of [-1, 1]) { X.beginPath(); X.arc(x + sx * 2.7 * u, y - bob - 6.2 * u, 1.9 * u, 0, TAU); X.lineWidth = Math.max(1.5, u * .45); X.strokeStyle = '#6b3fa0'; X.stroke(); }
  } else {                                             // the cousin: a party hat
    tri(x - 3.2 * u, hy + .4 * u, x + 3.2 * u, hy + .4 * u, x, hy - 6 * u, '#4db8ff', 2.5); X.beginPath(); X.arc(x, hy - 6.2 * u, 1.1 * u, 0, TAU); ink(GOLD, 1.5);
  }
  if (o.teq) tequeno(x + 3.4 * u, y - bob - 4.6 * u, u * .22 + .1, -.15 + Math.sin(T * 10) * .05);   // the tequeño in the mouth
  X.restore();
}

/* ───────────── the game ═════════ */
let CS = 5; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
function sqTrencito(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0;
  /* the level: identical on every screen whatever n / role */
  const kinds = [0, 1, 2, 0, 1, 2, 0]; for (let i = 6; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const OB = []; let ost = 2.3;
  for (let k = 0; k < 7; k++) {
    if (k) ost += 1.6 + R() * .4; else R();
    const kind = kinds[k];
    OB.push({ st: ost, kind, oy: LY0 + 36 + R() * (LY1 - LY0 - 72), hh: [44, 34, 26][kind], hw: [98, 42, 26][kind], amp: kind === 2 ? 52 : 0, fr: 1.5 + R() * .8, ph: R() * TAU, fx: false });
  }
  const sway = { p1: R() * TAU, p2: R() * TAU, a1: 330 + R() * 40, a2: 170 + R() * 40 };
  const oyAt = (o, s) => clamp(o.oy + o.amp * Math.sin(o.fr * s + o.ph), LY0 + 14, LY1 - 8);
  const beatT = (role, k) => B0 + k * P + (role === 3 ? P / 2 : 0);
  const NEED = n === 4 ? 3 : 5;
  const CH = CHAIN(n);
  /* state */
  let S = 0, y = (LY0 + LY1) / 2, vy = 0, pvy = 0, ten = 0, keyU = 0, keyD = 0, ptrOn = false, ptrY = 0, botU = null;
  let sentY = -9, sentT = -9, lastY = '', lastTen = '', bumpCd = 0, bumpAt = -9, ending = false, resAt = -1, snapFx = false, sad = false;
  let hits = 0, offs = 0, miss = 0, used = [], lastH = '', sentH = -9, pulls = 0, sentP = -9, lastPull = -9, tugAt = -9, tapAt = -9, lastQ = '', hitFxAt = -9;
  const HC = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], hitAt = [-9, -9, -9, -9], hitK = [0, 0, 0, 0];    // cumulative [hits, off, miss] per connector, last hit time
  let PC = 0;
  const yT = track(), tT = track(), yH = [], pops = [], bits = [], CP = [];
  const cols = r => (D.byRole[r] && D.byRole[r].color) || COLS[r], nm = r => (D.byRole[r] && D.byRole[r].name) || 'P' + (r + 1);
  function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 4) pops.shift(); }
  const hyAt = c => { if (!yH.length) return y; if (c <= yH[0].c) return yH[0].y; for (let i = yH.length - 1; i > 0; i--) if (yH[i - 1].c <= c) { const a = yH[i - 1], b = yH[i]; return a.y + (b.y - a.y) * (c - a.c) / Math.max(1e-6, b.c - a.c); } return yH[0].y; };
  const headY = () => judge ? y : (yT.at() === null ? (LY0 + LY1) / 2 : yT.at());
  const tenV = () => judge ? ten : (tT.at() || 0);
  const need = r => r === 1 || r === 3 ? NEED : 0;
  function tap() {                                     // connector: tap on the beat; grandma: pull
    if (g.result) return;
    if (me === 1 || me === 3) {
      let bi = -1, bd = 9;
      for (let k = 0; k < NB; k++) { if (used[k]) continue; const d = Math.abs(S - beatT(me, k)); if (d < bd) { bd = d; bi = k; } }
      tapAt = g.c;
      if (bi >= 0 && bd <= HITW) { used[bi] = 1; hits++; hitFxAt = g.c; pop(bd <= PERF ? 'PERFECT!' : 'NICE!', 400, 205, 26, bd <= PERF ? '#22a447' : '#2b9ee6'); snd(bd <= PERF ? 880 : 660, .08, 'triangle', .06); sfx.tick && sfx.tick(); }
      else { offs++; pop('WRONG STEP!', 400, 205, 22, '#e8343d'); snd(180, .08, 'square', .04, 0, 120); }
      publishH(true);
    } else if (me === 2) {
      if (g.c - lastPull < .12) return;
      lastPull = g.c; pulls++; tugAt = g.c; D.send('p', pulls, true); sentP = g.c;
      if (tenV() < .2) pop('TOO LOOSE!', 400, 205, 22, '#e8343d'); else snd(300, .1, 'sawtooth', .05, 0, 200);
    }
  }
  function publishH(force) { const m = hits + ',' + offs + ',' + miss; if (force || (m !== lastH && g.c - sentH >= .1)) { lastH = m; sentH = g.c; D.send('h', [hits, offs, miss], true); } }
  function finish(res) { if (judge && !g.result) g.finish(res); }
  const stIn = () => botU !== null ? botU : keyU || keyD ? keyD - keyU : ptrOn ? clamp((ptrY - y) / 55, -1, 1) : 0;

  const roleName = ['UNCLE', 'AUNT', 'GRANDMA', 'COUSIN'];
  const g = {
    c: 0, dur: 18, pts: 0,
    cmd: ['STEER!', 'STEP!', 'TUG!', 'STEP!'][me], roleLabel: roleName[me],
    hint: me === 0 ? 'HOLD ▲ ▼ (OR W / S) TO STEER THE LINE - DODGE THE SOFA, THE COOLER AND THE HEN'
      : me === 2 ? 'TAP (OR SPACE) TO PULL - KEEP THE LINE TIGHT BUT NOT YANKED'
      : 'TAP (OR SPACE) ON THE BEAT - MATCH THE STRIDE OF THE LINE',
    thint: me === 0 ? 'DRAG UP / DOWN TO STEER THE LINE - DODGE THE SOFA, THE COOLER AND THE HEN'
      : me === 2 ? 'TAP TO PULL - KEEP THE LINE TIGHT BUT NOT YANKED'
      : 'TAP ON THE BEAT - MATCH THE STRIDE OF THE LINE',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      const done = !!g.result;
      if (!done) {
        const dS = dt * TS; S += dS; bumpCd -= dS;
        yH.push({ c: g.c, y: headY() }); if (yH.length > 90) yH.shift();
        if (judge) {
          const dr = sway.a1 * Math.sin(1.35 * S + sway.p1) + sway.a2 * Math.sin(2.9 * S + sway.p2);
          vy += (stIn() * 900 + dr - 2.4 * vy) * dS; y += vy * dS;
          if (y < LY0) { y = LY0; if (vy < -80) ten += .04; vy = Math.abs(vy) * .3; } else if (y > LY1) { y = LY1; if (vy > 80) ten += .04; vy = -Math.abs(vy) * .3; }
          const ay = (vy - pvy) / Math.max(dS, 1e-3); pvy = vy;
          ten += dS * (BASE + .3 * Math.max(0, Math.abs(ay) - 450) / 1000);
          if (bumpCd <= 0) for (let i = 0; i < OB.length; i++) { const o = OB[i]; if (Math.abs(o.st - S) * SPD < o.hw + 12 && Math.abs(y - oyAt(o, S)) < o.hh + 12) {
            bumpCd = .9; ten += BUMP; vy += (y < oyAt(o, S) ? -1 : 1) * 220; bumpAt = g.c; D.send('bump', i); shake(5, .18); sfx.thud && sfx.thud(); pop('BUMPED!', HX, y - 90, 26, '#e8343d'); break; } }
          ten = Math.max(0, ten);
          const ym = Math.round(y);
          if (ym !== lastY && g.c - sentY >= .1) { lastY = ym; sentY = g.c; D.send('y', ym, true); }
          const tm = Math.round(ten * 1000);
          if (tm !== lastTen && g.c - sentT >= .1) { lastTen = tm; sentT = g.c; D.send('ten', tm, true); }
          if (ten > 1) { sad = true; finish('lose'); }
          else if (S >= SEND) { const okH = (n === 4 ? [1, 3] : [1]).every(r => HC[r][0] >= NEED); finish(okH && ten <= 1 ? 'win' : 'lose'); }
        } else {
          // connectors: beats that slid past the plate unhit are misses
          if (me === 1 || me === 3) { for (let k = 0; k < NB; k++) if (!used[k] && S > beatT(me, k) + HITW) { used[k] = 2; miss++; publishH(false); } }
        }
        if (me === 1 || me === 3) publishH(false);
      }
      if (g.result === 'lose') { if (!snapFx) { snapFx = true; sfx.miss(); snd(330, .5, 'sawtooth', .06, 0, 110); snd(250, .4, 'sawtooth', .05, .12, 90); shake(6, .22); } }
      else if (g.result === 'win' && !ending) { ending = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += 700 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      while (pops.length && g.c - pops[0].t0 > 1) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'y') yT.push(d);
      else if (type === 'ten') tT.push(d / 1000);
      else if (type === 'h' && Array.isArray(d) && from >= 0 && from < 4) {
        const o = HC[from], dh = d[0] - o[0], doff = d[1] - o[1], dm = d[2] - o[2];
        if (dh > 0) { hitAt[from] = g.c; if (!judge) { /* cosmetic only */ } }
        if (judge) ten += (doff > 0 ? doff : 0) * .05 + (dm > 0 ? dm : 0) * .03;
        HC[from] = [d[0], d[1], d[2]];
      } else if (type === 'p' && typeof d === 'number') {
        const dp = d - PC; PC = d; tugAt = g.c;
        if (judge) for (let i = 0; i < dp; i++) { if (ten > .2) ten = Math.max(0, ten - PULL); else ten += .06; }
      } else if (type === 'bump') { if (!judge) { bumpAt = g.c; shake(5, .18); sfx.thud && sfx.thud(); pop('BUMPED!', HX, headY() - 90, 26, '#e8343d'); } }
    },
    steer(v) { botU = clamp(v, -1, 1); },
    tap,
    draw(tm) {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose';
      const rk = resAt >= 0 ? T - resAt : -1, Sv = Math.min(S, SEND), cam = Sv * SPD;
      const tv_ = tenV(), cx0 = 560 + (SEND - Sv) * SPD;
      room(cam, T);
      buffet(cx0, T, won && rk > 1);
      // finish ribbon on the floor
      const rx = HX + (SEND - Sv) * SPD + 40;
      if (rx < W + 30) { X.fillStyle = INK; X.fillRect(rx - 5, 342, 10, 220); X.fillStyle = '#ffd23f'; X.fillRect(rx - 2, 342, 4, 220); }
      // everything that stands on the floor, depth sorted
      const things = [];
      for (const o of OB) {
        const sx = HX + (o.st - S) * SPD, oy = oyAt(o, S + (o.kind === 2 ? 0 : 0));
        if (sx < -140 || sx > W + 140) continue;
        const sc = .85 + (oy - LY0) / (LY1 - LY0) * .3;
        things.push({ y: oy, f: () => o.kind === 0 ? sofa(sx, oy, sc) : o.kind === 1 ? cava(sx, oy, sc, false, 0) : hen(sx, oy, sc, T, true) });
        // warning flash
      }
      // the line
      const hy = headY(), pos = [], ang = [];
      const lvT = lost ? clamp((rk) / .9, 0, 1) : 0;
      for (let ci = 0; ci < n; ci++) {
        const lag = ci * .22, a0 = hyAt(g.c - lag), a1 = hyAt(g.c - lag - .2);
        const sw = ci ? (a0 - a1) * .55 * ci : 0;
        const px = HX - ci * (SP + STRETCH * clamp(tv_, 0, 1.2));
        pos.push([px, clamp(ci ? a0 + sw : hy, LY0 - 6, LY1 + 6)]);
      }
      if (me !== 0) pos[0][1] = hy;
      if ((won || lost) && !CP.length) pos.forEach(p => CP.push([p[0], p[1]]));
      const wk = won && rk >= 0 ? rk : -1;
      const pose = [];
      CH.forEach((r, ci) => {
        let [px, py] = pos[ci], u = 3 + (py - LY0) / (LY1 - LY0) * .9, rot = 0, al = 1, mood = won ? 'happy' : lost ? 'sad' : null, bob = 0;
        if (!g.result) bob = Math.abs(Math.sin((S - B0) / P * Math.PI)) * 3.4 * (ci ? 1 : .5);
        if (wk >= 0 && CP.length) {                        // the train walks out through the kitchen door
          const k = clamp((wk - .25 - ci * .16) / 1.35, 0, 1), dxx = cx0 + 175, dyy = 342, e = ease(k);
          px = lerp(CP[ci][0], dxx, e); py = lerp(CP[ci][1], dyy, e); u *= 1 - .5 * e; al = k > .85 ? 1 - (k - .85) / .15 : 1; bob = Math.abs(Math.sin(wk * 12 + ci)) * 3;
        }
        if (lost && lk() >= 0) {
          if (r === 2) {                                   // grandma flies into the cooler
            const k = clamp((lk() - .1) / .85, 0, 1), tx = 74, ty = 452, ax = lerp(CP[ci][0], tx, ease(k)), ay = lerp(CP[ci][1], ty, ease(k)) - Math.sin(k * Math.PI) * 130;
            px = ax; py = ay; rot = k * 9.4 * (k < 1 ? 1 : 0); u = 3.4; if (k >= 1) { rot = 0; py = ty + 6; }
          } else { px = CP[ci][0] + Math.min(1, lk() * 3) * (ci ? 22 : 0) * 0; py = CP[ci][1]; }
        }
        pose.push({ r, ci, px, py, u, rot, al, mood, bob });
      });
      function lk() { return lost && rk >= 0 ? rk : -1; }
      pose.forEach(p => things.push({ y: p.py + 1, f: () => {
        const kind = p.r;
        const o = { bob: p.bob, rot: p.rot, run: !g.result ? S * 1.1 + p.ci : undefined, teq: wk > .12, noBottle: lost };
        if (p.al < 1) X.globalAlpha = Math.max(0, p.al);
        person(kind, p.px, p.py, p.u, cols(p.r), p.mood, T, o);
        X.globalAlpha = 1;
      } }));
      // links (the arms on the shoulders), behind the people
      if (!lost || lk() < .12) {
        for (let i = 1; i < pose.length; i++) {
          const a = pose[i - 1], b = pose[i], k = clamp(tv_, 0, 1.2), col = mixc('#f1c9a0', '#ff3d3d', clamp((tv_ - .45) / .5, 0, 1));
          const ax = a.px - 5.5 * a.u, ay = a.py - a.bob - 7 * a.u, bx = b.px + 6 * b.u, by = b.py - b.bob - 7 * b.u;
          const j = tv_ > .75 ? Math.sin(T * 40 + i) * (tv_ - .7) * 5 : 0;
          line([[bx, by], [(ax + bx) / 2, (ay + by) / 2 + (1 - clamp(tv_ * 1.4, 0, 1)) * 7 + j], [ax, ay]], 5, col);
          void k;
        }
      }
      things.sort((a, b) => a.y - b.y).forEach(t0 => t0.f());
      // the snap: the cooler gets the grandma
      if (lost && rk >= 0) {
        const cy = 458, k = clamp(rk / .25, 0, 1);
        if (rk > .85) cava(74, cy + 6, 1.3, true, Math.min(1.9, (rk - .85) * 6));
        else cava(lerp(-60, 74, ease(k)), cy + 6, 1.3, false, 0);
        if (rk > .9) for (let i = 0; i < 4; i++) { const d = (rk - .9) * 1.6 + i * .2; X.globalAlpha = clamp(1 - d, 0, 1); el(48 + i * 14 + Math.sin(d * 7 + i) * 6, 410 - d * 60, 6, 6); ink('#dff6ff', 2); X.globalAlpha = 1; }
      }
      // whip lines when the tail swings
      if (!g.result && tv_ > .6) for (let i = 0; i < 3; i++) { const px = pos[n - 1][0] - 40 - i * 12, py2 = pos[n - 1][1] - 40 + Math.sin(T * 30 + i) * 10; X.globalAlpha = .6; line([[px, py2], [px - 18, py2 - 3]], 3, '#fff'); X.globalAlpha = 1; }
      // tipsy swirls over the head (judge or not: everyone sees him wobble)
      if (!g.result) { const dr = Math.sin(1.35 * S + sway.p1); X.save(); X.translate(pos[0][0] + dr * 6, pos[0][1] - 62); for (let i = 0; i < 2; i++) { const a = T * 6 + i * Math.PI; star(Math.cos(a) * 12, Math.sin(a) * 4, 4.5, 2, 4, T * 3, '#ffe14d', 1.6); } X.restore(); }
      // the end gags
      if (won && rk >= 0) { const bk = clamp((rk - .1) / .25, 0, 1); badge('YUMMY!', 400, 150, 36, '#22a447', '#fff', outBack(bk), -.05); if (rk > .25) for (let i = 0; i < 7; i++) { const d = rk - .2 - i * .1; if (d < 0) continue; tequeno(120 + i * 95 + Math.sin(d * 5 + i) * 10, -20 + d * 230, 1, d * 3 + i); } }
      if (lost && rk > .4) badge(sad || tv_ > .9 ? 'IT SNAPPED!' : 'OFF BEAT!', 400, 150, 32, '#e8343d', '#fff', outBack((rk - .4) / .25), .04);
      // the name tags
      pose.forEach(p => { if (g.result && (won || lost)) return; pill(p.px, Math.min(p.py - p.u * 12 - 16, 520), p.r === me ? 'YOU' : nm(p.r), cols(p.r)); });
      g._hud(T, tv_, pos);
      for (const q of pops) { const aa = T - q.t0; X.globalAlpha = clamp(1.1 - aa, 0, 1); badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .18 ? outBack(aa / .18) : 1, .05); X.globalAlpha = 1; }
      vignette(.14);
    },
    _hud(T, tv_, pos) {
      const act = !g.result;
      // the trip so far: a little train on a bar, tequeño at the end
      if (act) { const bx0 = 250, bx1 = 550, kk = clamp(S / SEND, 0, 1); rr(bx0, 58, bx1 - bx0, 14, 7); ink('#fff', 3); X.fillStyle = GOLD; rr(bx0 + 3, 61, Math.max(8, (bx1 - bx0 - 6) * kk), 8, 4); X.fill(); tequeno(bx1 + 24, 65, .6, 0); }
      if (me === 0) {
        if (act) {
          for (const [dy, lab, on] of [[-1, '▲', stIn() < -.3], [1, '▼', stIn() > .3]]) { const ky = 440 + dy * 56, kx = TOUCH ? 52 : 44; rr(kx - 28, ky - 24 + (on ? 4 : 0), 56, 48, 10); ink(on ? '#ffe14d' : '#fff', 4); txt(lab, kx, ky + 2 + (on ? 4 : 0), 30, INK); }
          // arrow cue toward the nearest gap
          for (const o of OB) { const d = o.st - S; if (d > -.2 && d < 1.7 && Math.abs(y - oyAt(o, o.st)) < o.hh + 40) { const dir = y < oyAt(o, o.st) ? -1 : 1, cxh = HX + 60; X.save(); X.translate(cxh, clamp(y + dir * 36, LY0, LY1)); X.globalAlpha = .9; tri(0, dir * 16, -14, -dir * 8, 14, -dir * 8, '#ffe14d', 3.5); X.restore(); break; } }
        }
        if (T < 2.4 && act) badge('DODGE!', 590, 120, 22, '#22a447', '#fff', 1, -.03);
      } else if (me === 2) {
        if (act) {
          // tension gauge: a rope meter on the left, sweet band in the middle
          const gx = 44, gy0 = 150, gh = 330;
          rr(gx - 18, gy0 - 8, 36, gh + 16, 10); ink('#fff', 4);
          const zones = [[0, .2, '#8fd0ff'], [.2, .6, '#5CFF7A'], [.6, .85, '#ffd23f'], [.85, 1, '#ff4d4d']];
          for (const [a, b, c] of zones) { X.fillStyle = c; X.fillRect(gx - 12, gy0 + gh * (1 - b), 24, gh * (b - a)); }
          const ky = gy0 + gh * (1 - clamp(tv_, 0, 1)); tri(gx + 20, ky, gx + 40, ky - 12, gx + 40, ky + 12, INK, 3); X.fillStyle = INK; X.fillRect(gx - 14, ky - 2, 28, 4);
          txt('TENSION', gx, gy0 - 22, 14, '#fff', 'center', 90);
          if (tv_ > .55 && Math.sin(T * 14) > 0) badge('TUG!', 130, ky, 20, '#e8343d', '#fff', 1, -.05);
          const tk = T - tugAt; if (tk < .25) { X.globalAlpha = 1 - tk / .25; el(pos[n - 1][0], pos[n - 1][1] - 30, 30 + tk * 80, 16 + tk * 30); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
        }
        if (T < 2.4 && act) badge('PULL WHEN IT STRETCHES!', 500, 120, 20, '#2b9ee6', '#fff', 1, -.03);
      } else {
        if (act) {
          // my beat lane: arepas slide to the plate
          const ly = 118, tx = 160, scale = 230;
          rr(60, ly - 28, 680, 56, 16); ink(me === 1 ? 'rgba(255,255,255,.6)' : 'rgba(255,240,170,.7)', 4);
          for (let k = 0; k < NB; k++) {
            const b = beatT(me, k), nx = tx + (b - S) * scale; if (nx < tx - 40 || nx > 730 || used[k] === 1) continue;
            arepa(nx, ly, 17, used[k] === 2 ? '#9a8f7a' : me === 1 ? '#e8c06a' : '#ffd23f');
          }
          const near = (() => { let d = 9; for (let k = 0; k < NB; k++) if (!used[k]) d = Math.min(d, Math.abs(S - beatT(me, k))); return d; })();
          const ps = 1 + (near < HITW ? .12 : 0) + (T - tapAt < .12 ? .1 : 0);
          X.save(); X.translate(tx, ly); X.scale(ps, ps); X.beginPath(); X.arc(0, 0, 25, 0, TAU); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = near < HITW ? '#5CFF7A' : '#fff'; X.stroke(); X.restore();
          txt('' + Math.min(hits, 99) + ' / ' + NEED, 700, ly + 52, 20, '#fff', 'center', 80);
          if (TOUCH) { rr(300, 480, 200, 56, 28); ink(T - tapAt < .12 ? '#ffe14d' : '#fff', 4); txt('STEP!', 400, 510, 26, INK, 'center', 160); }
        }
        if (T < 2.4 && act) badge('ON THE BEAT!', 500, 190, 20, '#2b9ee6', '#fff', 1, -.03);
      }
    },
    down(p) { if (me === 0) { ptrOn = true; ptrY = p.y; } else tap(); },
    move(p) { if (me === 0 && ptrOn) ptrY = p.y; },
    up() { ptrOn = false; },
    key(e) {
      const c = e.code;
      if (me === 0) { if (c === 'ArrowUp' || c === 'KeyW') keyU = 1; else if (c === 'ArrowDown' || c === 'KeyS') keyD = 1; }
      else if (c !== 'ShiftLeft' && c !== 'ShiftRight' && c !== 'Escape' && !e.repeat) tap();
    },
    keyup(e) { const c = e.code; if (c === 'ArrowUp' || c === 'KeyW') keyU = 0; else if (c === 'ArrowDown' || c === 'KeyS') keyD = 0; },
  };
  g.dbg = { view: () => ({ y, vy, S, ten: tenV(), hits, offs, miss, pulls, me, n, ob: OB.map(o => ({ st: o.st, oy: oyAt(o, o.st), hh: o.hh, hw: o.hw, kind: o.kind, at: k => oyAt(o, k) })), nextBeat: (() => { for (let k = 0; k < NB; k++) if (!used[k]) return beatT(me, k); return 99; })(), HC }), OB, beatT, oyAt };
  wire(g, D, 0, sp, 'sq_trencito');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  const u = t % 4;
  X.fillStyle = '#f3d29a'; X.fillRect(0, 0, 520, 100); X.fillStyle = '#e8b878'; for (let x = 0; x < 520; x += 60) X.fillRect(x, 0, 20, 100);
  X.fillStyle = INK; X.fillRect(0, 96, 520, 4); X.fillStyle = '#7a4a2a'; X.fillRect(0, 100, 520, 14);
  const gg = X.createLinearGradient(0, 114, 0, 240); gg.addColorStop(0, '#c98a4b'); gg.addColorStop(1, '#a8672f'); X.fillStyle = gg; X.fillRect(0, 114, 520, 126);
  const sc = .8, hx = 330, yy = 190 + (role === 0 ? Math.sin(t * 2) * 0 : 0);
  const hyd = role === 0 ? 190 + 22 * Math.sin(t * 2.2) * (u < 3 ? 1 : .2) : 190;
  // sofa to dodge
  const sx = 560 - ((t * 120) % 760);
  if (role === 0) sofa(sx, 168, .55);
  const ten = role === 2 ? (u % 1.3) / 1.3 : .25;
  for (let ci = 0; ci < n; ci++) {
    const r = CHAIN(n)[ci], px = hx - ci * (60 + 20 * ten), py = hyd + (ci ? -Math.sin(t * 2.2 - ci * .5) * 6 : 0) * 0 + (190 - hyd) * .0;
    if (ci) { const pr = CHAIN(n)[ci - 1]; void pr; line([[px + 6 * 3, py - 20], [px + 60 + 20 * ten - 16, py - 20]], 4, ten > .75 ? '#ff4d4d' : '#f1c9a0'); }
    person(r, px, py + (ci ? 0 : 0), 3.1 * sc / .8 * .8, COLS[r], null, t, { bob: Math.abs(Math.sin(t * 6 - ci)) * 2.5, noBottle: false });
  }
  void yy;
  if (role === 0) { for (const [dy, lab, on] of [[-1, '▲', Math.cos(t * 2.2) < -.2], [1, '▼', Math.cos(t * 2.2) > .2]]) { rr(22, 126 + (dy + 1) * 40, 48, 40, 8); ink(on ? '#ffe14d' : '#fff', 3); txt(lab, 46, 148 + (dy + 1) * 40, 26, INK); } demoFinger(46, 226, Math.cos(t * 2.2) > .2, 0); badge('DODGE!', 330, 28, 18, '#22a447', '#fff', 1, -.03); }
  else if (role === 2) {
    const gx = 30; rr(gx - 14, 8, 28, 140, 8); ink('#fff', 3); const k = clamp(ten, 0, 1); X.fillStyle = k > .6 ? '#ff4d4d' : '#5CFF7A'; X.fillRect(gx - 9, 12 + 132 * (1 - k), 18, 132 * k);
    const press = ten > .6; demoFinger(430, 214, press, ((u % 1.3) / 1.3 - .6) / .4); badge('PULL WHEN IT STRETCHES!', 300, 28, 16, '#2b9ee6', '#fff', 1, -.03);
  } else {
    const ly = 36, tx = 90; rr(30, ly - 22, 460, 44, 14); ink('rgba(255,255,255,.6)', 3);
    for (let k = 0; k < 6; k++) { const nx = tx + (k * .9 - (t % 4.5) + (role === 3 ? .45 : 0)) * 150; if (nx > 60 && nx < 470) arepa(nx, ly, 14, role === 1 ? '#e8c06a' : '#ffd23f'); }
    X.beginPath(); X.arc(tx, ly, 20, 0, TAU); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke();
    const ph = ((t % 4.5) / .9) % 1, near = ph < .15 || ph > .9; demoFinger(430, 214, near, 0); badge('ON THE BEAT!', 330, 82, 16, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_trencito', sqTrencito, 'TRENCITO'); REGMAP.sq_trencito.duo = true; REGMAP.sq_trencito.squad = true;
DUO.INFO.sq_trencito = n => [
  ['UNCLE', 'STEER THE LINE', 'HOLD ▲ ▼ OR DRAG UP / DOWN'],
  ['AUNT', 'TAP ON THE BEAT', 'TAP / CLICK / SPACE'],
  ['GRANDMA', 'PULL TO KEEP IT TIGHT', 'TAP / CLICK / SPACE'],
  ['COUSIN', 'TAP ON THE BEAT', 'TAP / CLICK / SPACE'],
].slice(0, n);
DUO.DEMOS.sq_trencito = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
