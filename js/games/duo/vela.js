'use strict';
/* ═════════ DUO · BLACKOUT (du_vela), "¡APAGA LA VELA!" ═════════
   A Caracas apartment during the apagón; abuela is in her armchair and she is NOT happy. Cockroaches are out. The room is pitch dark.
   FLASHLIGHT (role 0, JUDGE): holds the only flashlight (pointer / arrows move the beam). Only inside the beam do things have colour, so he
   alone sees what each dim shape really is: a cucaracha, abuela's chancleta, a plant, an arepa, abuela's head peeking over the sofa.
   Holding the beam still on a shape for a moment "sends" what it is to the friend (the shape lights up on the friend's screen).
   CANDLE (role 1): sees the whole room as colourless dark silhouettes, moves a flickering candle (pointer / arrows: move FAST and it gutters
   and goes out for a second) and swats with the chola (click / tap / Space). Hitting anything that is not a cucaracha costs a heart.
   So: the candle shows the flashlight where to look, the flashlight reveals what it is, the candle swats only the roaches.
   Win: 5 roaches flattened with at most 2 mistakes. Lights come back, abuela claps. Fail: abuela screams, lights stay out.
   Netcode: the level (shapes, kinds, roach routes) is seeded (mkR) so both screens build the same room. FLASHLIGHT owns the beam:
   'b' [x, y] (coalesced), 'rv' i (shape i was held long enough: reveal it). CANDLE owns the candle and the swats: 'c' [x, y, gutter, out]
   (coalesced), 'w' i (swat shape i: absolute index, duplicates harmless). The judge counts kills and mistakes and ends via wire(). */
(function () {
const { clamp, mkR, wire, track } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

const BR = 90, TR = 26, NR = 7;                       // beam radius, shape radius, roaches in the room
const X0 = 80, X1 = 730, Y0 = 356, Y1 = 494;          // where shapes can sit (floor)
const AX = 74, AY = 378;                              // abuela's armchair
const HOLD = .13, TINT = 3.2, COOL = .36, NEEDM = 3;  // beam hold to reveal (s), how long a revealed shape stays lit on the candle's screen, swat cooldown, hearts
const PAN = [574, 66, 126, 128];                      // the barred window (live night sky behind it)

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(190, X.measureText(t(label)).width + 26);
  X.beginPath(); X.moveTo(x - 8, y + 12); X.lineTo(x, y + 22); X.lineTo(x + 8, y + 12); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(330, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 330); X.restore();
}
function heart(x, y, s, col, cracked) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-16, -2, -10, -14, 0, -6); X.bezierCurveTo(10, -14, 16, -2, 0, 8); X.closePath(); ink(col, 2.5);
  if (cracked) line([[0, -6], [-3, -1], [2, 2], [-1, 7]], 2.4, INK); else glint(-5, -5, 2.6, 1.7, -.5, .55);
  X.restore();
}
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
}
let CS = 9; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;   // cosmetic randomness only (never the level)

/* ───────────── the room (baked twice: full light and dark) ───────────── */
const BK = { lit: null, dim: null };
function paintRoom() {
  let gr = X.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#f0b658'); gr.addColorStop(1, '#ffd98c'); X.fillStyle = gr; X.fillRect(0, 0, W, 306);
  X.fillStyle = 'rgba(200,110,40,.2)'; for (let x = 6; x < W; x += 52) X.fillRect(x, 0, 22, 240);
  X.fillStyle = '#c9763a'; X.fillRect(0, 238, W, 64); X.fillStyle = 'rgba(255,255,255,.2)'; X.fillRect(0, 240, W, 6); X.fillStyle = 'rgba(20,16,28,.18)'; for (let x = 0; x < W; x += 80) X.fillRect(x, 246, 3, 56);
  X.fillStyle = INK; X.fillRect(0, 234, W, 5);
  // the granite floor tiles
  gr = X.createLinearGradient(0, 300, 0, H); gr.addColorStop(0, '#e7d7b4'); gr.addColorStop(1, '#cdb88f'); X.fillStyle = gr; X.fillRect(0, 300, W, 300);
  for (let r = 0; r < 7; r++) for (let c = 0; c < 14; c++) if ((r + c) % 2) { X.fillStyle = 'rgba(120,90,50,.16)'; X.fillRect(c * 60, 302 + r * 44, 60, 44); }
  X.fillStyle = 'rgba(70,50,30,.25)'; for (let i = 0; i < 90; i++) { const q = i * 97.3; X.fillRect((q * 7.7) % W, 306 + (q * 3.1) % 290, 3, 2); }
  X.fillStyle = INK; X.fillRect(0, 300, W, 5);
  // window: hole for the live night sky, curtains, iron bars (every Caracas window has them)
  X.clearRect(PAN[0], PAN[1], PAN[2], PAN[3]);
  rr(PAN[0] - 8, PAN[1] - 8, PAN[2] + 16, PAN[3] + 16, 8); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#fff3d6'; X.stroke();
  for (const sx of [PAN[0] + 4, PAN[0] + PAN[2] - 4]) { X.beginPath(); X.moveTo(sx - 18 * Math.sign(sx - 640), PAN[1] - 6); X.quadraticCurveTo(sx, PAN[1] + 70, sx - 14 * Math.sign(sx - 640), PAN[1] + PAN[3] + 6); X.lineTo(sx - 36 * Math.sign(sx - 640), PAN[1] + PAN[3] + 6); X.lineTo(sx - 36 * Math.sign(sx - 640), PAN[1] - 6); X.closePath(); ink('#d6453b', 3.5); }
  X.strokeStyle = INK; X.lineWidth = 6; for (let i = 1; i < 4; i++) { const x = PAN[0] + i * PAN[2] / 4; X.beginPath(); X.moveTo(x, PAN[1]); X.lineTo(x, PAN[1] + PAN[3]); X.stroke(); } X.beginPath(); X.moveTo(PAN[0], PAN[1] + 62); X.lineTo(PAN[0] + PAN[2], PAN[1] + 62); X.stroke();
  // a framed picture of El Ávila, the wall clock stuck at 12:00
  rr(30, 90, 96, 76, 6); ink('#8a5a34', 4); X.fillStyle = '#9fe0ff'; X.fillRect(38, 98, 80, 60); X.beginPath(); X.moveTo(38, 158); X.lineTo(66, 116); X.lineTo(84, 138); X.lineTo(98, 122); X.lineTo(118, 158); X.closePath(); ink('#5b8fb5', 2.5);
  X.beginPath(); X.arc(100, 110, 8, 0, TAU); ink('#ffe14d', 2);
  X.beginPath(); X.arc(190, 120, 32, 0, TAU); ink('#fff', 4.5); X.fillStyle = INK; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; X.fillRect(190 + Math.cos(a) * 24 - 1.5, 120 + Math.sin(a) * 24 - 1.5, 3, 3); }
  line([[190, 120], [190, 100]], 4, INK); line([[190, 120], [190, 104]], 3, INK);
  // the TV (dead) on its stand
  rr(594, 236, 124, 64, 8); ink('#7b4a2a', 4); rr(596, 168, 120, 76, 10); ink('#3a3550', 4.5); rr(606, 178, 100, 56, 6); X.fillStyle = '#10121f'; X.fill(); glint(626, 190, 18, 5, -.35, .18);
  line([[640, 168], [622, 134]], 3, '#8f9cb3'); line([[670, 168], [690, 130]], 3, '#8f9cb3');
  // the sofa with a crocheted doily
  rr(252, 214, 260, 74, 20); ink('#26908c', 4.5); rr(236, 262, 292, 54, 16); ink('#37b8b0', 4.5); rr(228, 238, 40, 80, 14); ink('#26908c', 4.5); rr(498, 238, 40, 80, 14); ink('#26908c', 4.5);
  glint(300, 232, 40, 6, -.1, .35); X.beginPath(); X.moveTo(382, 236); X.lineTo(404, 254); X.lineTo(382, 272); X.lineTo(360, 254); X.closePath(); ink('#fff8e6', 3);
  rr(264, 308, 14, 14, 3); ink('#7b4a2a', 3); rr(488, 308, 14, 14, 3); ink('#7b4a2a', 3);
  // abuela's armchair
  rr(12, 226, 128, 150, 24); ink('#b8505e', 4.5); rr(26, 300, 100, 66, 14); ink('#d46a78', 4); glint(40, 244, 22, 8, -.2, .4);
  rr(20, 366, 14, 16, 3); ink('#7b4a2a', 3); rr(118, 366, 14, 16, 3); ink('#7b4a2a', 3);
}
function dimOver() { X.save(); X.globalCompositeOperation = 'source-atop'; X.fillStyle = 'rgba(8,10,38,.87)'; X.fillRect(0, 0, W, H); X.restore(); }
function bakeRoom() {
  if (BK.lit) return;
  const mk = dark => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d'); paintRoom(); if (dark) dimOver(); X = old; return cv; };
  BK.lit = mk(false); BK.dim = mk(true);
}
/* the live night sky behind the bars: stars, a moon, and a cat that strolls along the ledge (the background gag) */
function pane(T, lit) {
  X.save(); rr(PAN[0], PAN[1], PAN[2], PAN[3], 2); X.clip();
  const gr = X.createLinearGradient(0, PAN[1], 0, PAN[1] + PAN[3]); gr.addColorStop(0, '#1d1840'); gr.addColorStop(1, '#4a3f95'); X.fillStyle = gr; X.fillRect(PAN[0], PAN[1], PAN[2], PAN[3]);
  X.beginPath(); X.arc(PAN[0] + 34, PAN[1] + 34, 15, 0, TAU); X.fillStyle = '#fff3b0'; X.fill(); glint(PAN[0] + 30, PAN[1] + 30, 5, 3, -.5, .7);
  for (let i = 0; i < 7; i++) { X.fillStyle = `rgba(255,255,255,${.35 + .45 * Math.abs(Math.sin(T * 2 + i * 1.7))})`; X.fillRect(PAN[0] + 14 + (i * 41) % 104, PAN[1] + 10 + (i * 29) % 56, 3, 3); }
  X.fillStyle = '#12102a'; X.fillRect(PAN[0], PAN[1] + PAN[3] - 20, PAN[2], 20);            // the neighbour's roof, with one lit window
  X.fillStyle = '#ffd36a'; X.fillRect(PAN[0] + 80, PAN[1] + PAN[3] - 14, 10, 8);
  const cp = (T % 9) / 9, cx = PAN[0] - 30 + cp * (PAN[2] + 70), cy = PAN[1] + PAN[3] - 22;   // the cat
  X.fillStyle = '#05050f'; el(cx, cy - 6, 15, 7); X.fill(); el(cx + 14, cy - 12, 7, 6); X.fill();
  X.beginPath(); X.moveTo(cx + 9, cy - 16); X.lineTo(cx + 11, cy - 24); X.lineTo(cx + 15, cy - 17); X.lineTo(cx + 19, cy - 24); X.lineTo(cx + 20, cy - 15); X.fill();
  X.strokeStyle = '#05050f'; X.lineWidth = 3; X.beginPath(); X.moveTo(cx - 14, cy - 8); X.quadraticCurveTo(cx - 28, cy - 22 + Math.sin(T * 5) * 4, cx - 22, cy - 30); X.stroke();
  X.fillStyle = '#c8ff6a'; el(cx + 16, cy - 12, 1.6, 2.4); X.fill(); el(cx + 20, cy - 12, 1.6, 2.4); X.fill();
  if (lit) { X.fillStyle = 'rgba(255,255,255,.08)'; X.fillRect(PAN[0], PAN[1], PAN[2], PAN[3]); }
  X.restore();
}

/* ───────────── the things in the room ───────────── */
function roach(x, y, T, ph, ang, run) {
  X.save(); X.translate(x, y); X.rotate(ang); const w = Math.sin(T * (run ? 34 : 7) + ph);
  for (const s of [-1, 1]) for (const dx of [-9, 1, 11]) line([[dx, s * 8], [dx + 6, s * (19 + w * 3 * (dx > 0 ? 1 : -1))]], 3, '#3a1d0c');
  line([[16, -4], [30, -13 + w * 5], [40, -7 + w * 6]], 2.5, '#3a1d0c'); line([[16, 4], [30, 13 - w * 5], [40, 7 - w * 6]], 2.5, '#3a1d0c');
  el(-2, 0, 22, 14); ink('#8a4520', 4); X.fillStyle = '#b3642e'; el(-6, -4, 15, 7); X.fill(); line([[-20, 0], [14, 0]], 2.4, '#5a2c12'); glint(-10, -7, 7, 2.6, -.2, .6);
  el(18, 0, 9, 8); ink('#6b3318', 3.5); X.fillStyle = '#fff'; el(21, -3.5, 2.6, 2.8); X.fill(); el(21, 3.5, 2.6, 2.8); X.fill(); X.fillStyle = INK; el(22, -3.5, 1.2, 1.2); X.fill(); el(22, 3.5, 1.2, 1.2); X.fill();
  X.restore();
}
function splat(x, y, T, k) {
  X.save(); X.translate(x, y); X.globalAlpha = k;
  el(0, 2, 30, 13); ink('#d9e85a', 3.5); X.fillStyle = '#b8c93c'; el(-4, 0, 16, 6); X.fill();
  X.fillStyle = '#7a3f1d'; el(0, 0, 18, 8); X.fill(); line([[-14, -2], [14, -2]], 2, '#5a2c12');
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line([[-8 + i * 9, s * 6], [-12 + i * 12, s * 15]], 2.5, '#3a1d0c');
  line([[16, -5], [22, 0]], 2.4, INK); line([[22, -5], [16, 0]], 2.4, INK);
  X.restore();
}
function slipper(x, y, rot, T) {
  X.save(); X.translate(x, y); X.rotate(rot);
  el(0, 4, 14, 26); ink('#e9f2ff', 4); el(0, 1, 12, 23); X.fillStyle = '#2d7fd6'; X.fill(); el(-3, -2, 7, 16, .1); X.fillStyle = '#5ba8f0'; X.fill();
  X.beginPath(); X.moveTo(-12, -8); X.lineTo(0, 7); X.lineTo(12, -8); X.lineWidth = 15; X.strokeStyle = INK; X.lineJoin = 'round'; X.lineCap = 'round'; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#ffd23f'; X.stroke();
  X.beginPath(); X.arc(0, 8, 3.2, 0, TAU); ink('#fff', 2); glint(-5, -12, 3, 7, .1, .55);
  X.restore();
}
function plant(x, y, T, ph) {
  X.save(); X.translate(x, y + 6);
  for (let i = -1; i <= 1; i++) { const s = Math.sin(T * 1.6 + ph + i) * .06; X.save(); X.rotate(i * .6 + s); el(0, -22, 7.5, 19); ink('#3fb260', 3.5); X.fillStyle = '#5bcf72'; el(-2, -24, 3.5, 12); X.fill(); X.restore(); }
  X.beginPath(); X.moveTo(-16, -6); X.lineTo(16, -6); X.lineTo(11, 18); X.lineTo(-11, 18); X.closePath(); ink('#d9704a', 4); rr(-19, -10, 38, 9, 3); ink('#f08a5c', 3.5); glint(-9, 6, 3, 6, .1, .5);
  X.restore();
}
function granny(x, y, T, ph) {                         // abuela's head peeking over the back of the sofa, curlers and all
  X.save(); X.translate(x, y + 4); const b = Math.sin(T * 1.8 + ph) * 1.4;
  el(0, 0, 21, 19); ink('#f2c9a0', 4);
  el(0, -10 + b, 20, 12); ink('#d4d8e4', 3.5);
  for (const dx of [-13, 0, 13]) { rr(dx - 5, -26 + b, 10, 13, 5); ink('#ff8fb6', 2.5); }
  for (const dx of [-8, 8]) { X.beginPath(); X.arc(dx, 0, 7.5, 0, TAU); ink('#fff', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(dx + 1, 1, 2.2, 0, TAU); X.fill(); }
  line([[-1, 0], [1, 0]], 2.5, INK); line([[-8, 11], [-3, 8], [3, 8], [8, 11]], 3, '#a04a4a');
  X.fillStyle = 'rgba(255,110,150,.5)'; el(-14, 7, 4, 2.6); X.fill(); el(14, 7, 4, 2.6); X.fill();
  X.restore();
}
function arepa(x, y, T, ph) {
  X.save(); X.translate(x, y);
  el(0, 3, 25, 17); ink('#d99a3a', 4); el(0, 0, 23, 15); X.fillStyle = '#f2c46a'; X.fill(); el(-5, -3, 15, 8, -.1); X.fillStyle = '#ffe08a'; X.fill();
  X.beginPath(); X.moveTo(-23, 0); X.quadraticCurveTo(0, 6, 23, 0); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#fff0a0'; X.stroke();
  for (let i = 0; i < 3; i++) { const k = (T * .8 + i / 3) % 1; X.globalAlpha = 1 - k; X.strokeStyle = '#fff'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-8 + i * 8, -14 - k * 18); X.quadraticCurveTo(-4 + i * 8, -20 - k * 18, -8 + i * 8, -26 - k * 18); X.stroke(); X.globalAlpha = 1; }
  X.restore();
}
function silhouette(x, y, tg, T) {                     // what the candle sees: all the same lump, no colour, no clues
  const L = tg.L, n = L.length, s = 1 + Math.sin(T * 2.2 + tg.ph) * .02, r = TR * s;
  const pts = L.map((l, i) => { const a = i / n * TAU; return [x + Math.cos(a) * r * l, y + Math.sin(a) * r * l * .8]; });
  X.beginPath(); X.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; X.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  X.closePath(); X.fillStyle = '#04050e'; X.fill(); X.lineWidth = 3; X.lineJoin = 'round'; X.strokeStyle = '#5a6285'; X.stroke();
}
function drawItem(tg, x, y, T, run) {
  switch (tg.kind) {
    case 'roach': roach(x, y, T, tg.ph, tg.ang, run); break;
    case 'slipper': slipper(x, y, tg.ang, T); break;
    case 'plant': plant(x, y, T, tg.ph); break;
    case 'granny': granny(x, y, T, tg.ph); break;
    default: arepa(x, y, T, tg.ph);
  }
}
/* abuela in her armchair. mood: idle (knitting, glaring), happy (clapping), scream */
function abuela(T, mood) {
  const x = AX, y = AY; X.save(); X.translate(x, y);
  const b = Math.sin(T * 2) * 1.2, sc = mood === 'scream' ? 1 + Math.abs(Math.sin(T * 30)) * .04 : 1;
  X.scale(sc, sc);
  rr(-34, -62 + b, 68, 64, 22); ink('#8a5fd0', 4.5); X.fillStyle = 'rgba(255,255,255,.2)'; rr(-26, -56 + b, 14, 40, 7); X.fill();   // her bata (house dress)
  X.fillStyle = '#ffd36a'; for (let i = 0; i < 5; i++) { el(-18 + i * 9, -30 + b + (i % 2) * 14, 3, 3); X.fill(); }
  // arms
  const cl = mood === 'happy' ? Math.abs(Math.sin(T * 12)) : 0;
  if (mood === 'happy') { for (const s of [-1, 1]) { X.beginPath(); X.arc(s * (22 - cl * 18), -62 + b - cl * 4, 9, 0, TAU); ink('#f2c9a0', 3.5); } if (cl < .2) { line([[-8, -92], [-14, -102]], 3, '#fff'); line([[8, -92], [14, -102]], 3, '#fff'); } }
  else if (mood === 'scream') { for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 40, -100, 9, 0, TAU); ink('#f2c9a0', 3.5); } }
  else { X.beginPath(); X.arc(0, -22 + b, 18, 0, TAU); ink('#ff7f9f', 3.5); line([[-6, -26 + b], [8, -18 + b]], 2.5, '#fff'); line([[-20, -8 + b], [24, -40 + b]], 3, '#e6c58c'); }   // a ball of yarn
  // head
  el(0, -82 + b, 24, 23); ink('#f2c9a0', 4.5);
  el(0, -96 + b, 24, 14); ink('#d4d8e4', 3.5); el(-4, -100 + b, 12, 5, -.2); X.fillStyle = 'rgba(255,255,255,.55)'; X.fill();
  for (const dx of [-18, -6, 7, 19]) { rr(dx - 5, -118 + b - (Math.abs(dx) < 10 ? 4 : 0), 10, 14, 5); ink('#ff8fb6', 2.5); }
  const sx = mood === 'scream' ? 1 : 0;
  for (const dx of [-9, 9]) { X.beginPath(); X.arc(dx, -82 + b, 8 + sx * 2, 0, TAU); ink('#fff', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(dx + 1, -81 + b, mood === 'scream' ? 1.8 : 2.6, 0, TAU); X.fill(); }
  line([[-1, -82 + b], [1, -82 + b]], 2.5, INK);
  if (mood === 'happy') { X.beginPath(); X.arc(0, -72 + b, 8, .1, Math.PI - .1); ink('#7a1f2a', 2.5); X.fillStyle = '#fff'; X.fillRect(-5, -72 + b, 10, 3); }
  else if (mood === 'scream') { el(0, -68 + b, 9, 12 + Math.abs(Math.sin(T * 30)) * 3); ink('#5a0f1c', 3); X.fillStyle = '#ff6f8f'; el(0, -63 + b, 5, 4); X.fill(); line([[-16, -96 + b], [-5, -90 + b]], 3, INK); line([[16, -96 + b], [5, -90 + b]], 3, INK); }
  else { line([[-9, -66 + b], [-3, -69 + b], [3, -69 + b], [9, -66 + b]], 3, '#a04a4a'); line([[-17, -94 + b], [-4, -89 + b]], 3, INK); line([[17, -94 + b], [4, -89 + b]], 3, INK); }
  X.fillStyle = 'rgba(255,110,150,.5)'; el(-16, -73 + b, 5, 3); X.fill(); el(16, -73 + b, 5, 3); X.fill();
  X.restore();
}
function candle(x, y, h, T, vx, out, scared) {
  X.save(); X.translate(x, y);
  el(0, 56, 24, 8); ink('#c9a24a', 3.5);                                                    // the saucer
  rr(-11, 8, 22, 48, 5); ink('#fff3d6', 3.5); X.fillStyle = '#ffd99a'; rr(4, 10, 6, 44, 3); X.fill(); glint(-5, 18, 2.4, 9, 0, .7);
  X.beginPath(); X.moveTo(-11, 8); X.quadraticCurveTo(-8, 20, -3, 10); X.fillStyle = '#fff3d6'; X.fill();
  line([[0, 8], [0, 1]], 3, '#3a2a1a');
  const eyeY = 28; for (const dx of [-4.5, 4.5]) { X.fillStyle = '#fff'; el(dx, eyeY, 3.4, scared ? 4.4 : 3.6); X.fill(); X.lineWidth = 1.6; X.strokeStyle = INK; X.stroke(); X.fillStyle = INK; el(dx + (out ? 0 : .6), eyeY + .6, 1.4, 1.6); X.fill(); }
  if (out) { line([[-8, 24], [-1, 28]], 2, INK); line([[8, 24], [1, 28]], 2, INK); line([[-3, 38], [3, 38]], 2.2, INK); }
  else if (scared) { el(0, 39, 3, 4); ink('#7a1f2a', 2); } else { X.beginPath(); X.arc(0, 36, 4, .15, Math.PI - .15); X.lineWidth = 2.2; X.strokeStyle = INK; X.stroke(); }
  if (!out) {
    const lean = clamp(vx / 600, -1, 1) * .5, sz = 1 - clamp(h, 0, 1) * .5, fl = Math.sin(T * 24) * .08 * (1 + h * 2);
    X.save(); X.translate(0, 0); X.rotate(lean + fl); X.scale(sz, sz);
    X.beginPath(); X.moveTo(0, 6); X.quadraticCurveTo(-13, -8, -3, -26); X.quadraticCurveTo(0, -33 - h * 6, 3, -26); X.quadraticCurveTo(13, -8, 0, 6); X.closePath(); ink(h > .6 ? '#ff9f43' : '#ffb82e', 3);
    X.fillStyle = '#fff3a0'; el(0, -7, 5.4, 11); X.fill(); X.fillStyle = '#fff'; el(-1, -10, 2.2, 5); X.fill();
    X.restore();
  } else { for (let i = 0; i < 3; i++) { const k = (T * 1.4 + i / 3) % 1; X.globalAlpha = (1 - k) * .7; X.strokeStyle = '#cfd6ee'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(Math.sin(k * 6 + i) * 5, -4 - k * 40); X.quadraticCurveTo(8 + Math.sin(k * 6) * 6, -14 - k * 40, 0, -24 - k * 40); X.stroke(); X.globalAlpha = 1; } }
  X.restore();
}

/* ═════════ the game ═════════ */
function duVela(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), fl = D.role === 0, TS = Math.sqrt(sp), NEED = sp > 1.3 ? 4 : 5;
  /* the level: 14 shapes on the floor: 7 cucarachas and 7 decoys; the first three roaches scurry between two spots */
  const kinds = []; for (let i = 0; i < NR; i++) kinds.push('roach'); for (const k of ['slipper', 'slipper', 'slipper', 'plant', 'plant', 'granny', 'arepa']) kinds.push(k);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const spots = [], spot = () => { for (let k = 0; k < 80; k++) { const x = X0 + R() * (X1 - X0), y = Y0 + R() * (Y1 - Y0); if (spots.every(s => Math.hypot(s.x - x, s.y - y) > 88) && !(x < 140 && y < 392)) { const o = { x, y }; spots.push(o); return o; } } const o = { x: X0 + R() * (X1 - X0), y: Y0 + R() * (Y1 - Y0) }; spots.push(o); return o; };
  const tgs = []; let rn = 0;
  for (const kind of kinds) {
    const p = spot(), q = kind === 'roach' && rn < 3 ? spot() : null; if (kind === 'roach') rn++;
    tgs.push({ i: tgs.length, kind, x: p.x, y: p.y, x2: q ? q.x : p.x, y2: q ? q.y : p.y, run: !!q, stay: 2.6 + R() * 1.4, ph: R() * 6, ang: (R() - .5) * 2.6, L: Array.from({ length: 8 }, () => .82 + R() * .34) });
  }
  const N = tgs.length, dead = Array(N).fill(-1), deadP = tgs.map(() => [0, 0]), hit = Array(N).fill(false);   // dead[i] = time it was swatted
  const posOf = (tg, T) => {
    if (!tg.run) return [tg.x, tg.y];
    const cyc = tg.stay + .45, TT = T + tg.ph, c = Math.floor(TT / cyc), f = TT - c * cyc, a = c % 2 ? [tg.x2, tg.y2] : [tg.x, tg.y], b = c % 2 ? [tg.x, tg.y] : [tg.x2, tg.y2], k = f > tg.stay ? ease((f - tg.stay) / .45) : 0;
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  };
  const movingNow = (tg, T) => { if (!tg.run) return false; const cyc = tg.stay + .45, f = (T + tg.ph) % cyc; return f > tg.stay; };
  /* state */
  const kHeld = new Set(), bits = [], rings = []; let pop = null;
  let bx = 400, by = 430, gx = 400, gy = 430, bSent = -9, lastB = '';                                   // flashlight: beam position, goal
  const hold = Array(N).fill(0), lastRv = Array(N).fill(-9), revT = Array(N).fill(-9);
  let cx = 400, cy = 430, tx = 400, ty = 430, vSm = 0, hGut = 0, outUntil = -1, cSent = -9, lastC = '', skipV = false, wCool = 0, swing = null, wasOut = false;   // candle
  let kills = 0, miss = 0, mAt = -9, kAt = -9, resAt = -1, flashAt = -9, snuffN = 0, ghostPing = -9;
  const bxT = track(), byT = track(), cxT = track(), cyT = track(), chT = track(); let cOutRecv = 0;
  const pc = () => (D.partner && D.partner.color) || '#6EA8FE';
  const mcol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const aliveNear = (px, py, T, rad) => { let best = -1, bd = 1e9; for (const tg of tgs) { if (dead[tg.i] >= 0) continue; const [x, y] = posOf(tg, T), d = Math.hypot(x - px, y - py); if (d < rad && d < bd) { bd = d; best = tg.i; } } return best; };
  function say(s, x, y, size, bgc, fg) { pop = { s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .16 }; }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 600, r: 3 }, o)); }
  function applyWhack(i, T) {
    if (i < 0 || i >= N || dead[i] >= 0) return; const tg = tgs[i], p = posOf(tg, T); dead[i] = T; deadP[i] = p;
    if (tg.kind === 'roach') {
      kills++; kAt = T; sfx.thud(); snd(170, .14, 'square', .08, 0, 55); noise(.16, .08, 1400, 300, 'bandpass'); shake(5, .16);
      for (let k = 0; k < 8; k++) bit({ x: p[0], y: p[1], vx: (cr() - .5) * 320, vy: -(60 + cr() * 220), c: k % 2 ? '#d9e85a' : '#b8c93c', r: 3 + cr() * 3 });
      say('SPLAT!', p[0], p[1] - 52, 30, '#7aa51f', '#fff');
    } else {
      miss++; mAt = T; hit[i] = true; sfx.miss(); snd(300, .22, 'sawtooth', .07, 0, 110); shake(7, .22);
      for (let k = 0; k < 6; k++) bit({ x: p[0], y: p[1], vx: (cr() - .5) * 260, vy: -(60 + cr() * 180), c: '#ff7a7a', r: 3 });
      say(tg.kind === 'granny' ? 'ABUELA!' : 'NOT THAT!', p[0], p[1] - 52, 28, '#e8434f', '#fff');
    }
  }
  function swat(px, py) {
    if (g.result || g.c < wCool || g.c < outUntil) return;
    wCool = g.c + COOL; swing = { x: px, y: py, t0: g.c };
    const i = aliveNear(px, py, g.c, TR + 13);
    snd(520, .08, 'triangle', .05, 0, 200);
    if (i >= 0) { applyWhack(i, g.c); D.send('w', i); } else { noise(.1, .05, 600, 200, 'lowpass'); }
  }
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: fl ? 'SHINE!' : 'FLIP-FLOP!', roleLabel: fl ? 'FLASHLIGHT' : 'CANDLE',
    hint: fl ? 'MOVE THE FLASHLIGHT (MOUSE OR ◄ ►) AND HOLD IT ON THE SHAPES - ONLY YOU SEE WHAT THEY ARE, SO SHINE WHERE YOUR FRIEND\'S CANDLE IS' : 'MOVE THE CANDLE SLOWLY (MOUSE OR ◄ ►) AND CLICK TO SWAT - ONLY SWAT WHAT YOUR FRIEND\'S LIGHT SHOWS IS A ROACH',
    thint: fl ? 'DRAG THE FLASHLIGHT ONTO THE SHAPES - ONLY YOU SEE WHAT THEY ARE, SO SHINE WHERE YOUR FRIEND\'S CANDLE IS' : 'DRAG THE CANDLE SLOWLY AND TAP TO SWAT - ONLY SWAT WHAT YOUR FRIEND\'S LIGHT SHOWS IS A ROACH',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) { resAt = T; if (g.result === 'win') { snd(523, .12, 'square', .06, 0); snd(659, .12, 'square', .06, .1); snd(784, .12, 'square', .06, .2); snd(1047, .3, 'square', .07, .3); } else { flashAt = T; snd(880, .7, 'sawtooth', .07, 0, 1500); noise(.5, .09, 2200, 400, 'bandpass'); } }
      const done = !!g.result;
      let kdx = 0, kdy = 0; for (const c of kHeld) { if (c === 'ArrowLeft' || c === 'KeyA') kdx--; else if (c === 'ArrowRight' || c === 'KeyD') kdx++; else if (c === 'ArrowUp' || c === 'KeyW') kdy--; else if (c === 'ArrowDown' || c === 'KeyS') kdy++; }
      if (fl) {
        if (!done) { gx = clamp(gx + kdx * 560 * TS * dt, 24, 776); gy = clamp(gy + kdy * 560 * TS * dt, 96, 520); }
        const k = 1 - Math.exp(-dt * 22); bx += (gx - bx) * k; by += (gy - by) * k;
        for (const tg of tgs) {
          const i = tg.i; if (dead[i] >= 0) { hold[i] = 0; continue; }
          const [x, y] = posOf(tg, T);
          if (Math.hypot(bx - x, by - y) < BR * .8) {
            hold[i] += dt;
            if (hold[i] >= HOLD && T - lastRv[i] > .5) { lastRv[i] = T; revT[i] = T; D.send('rv', i); rings.push({ x, y, t0: T }); snd(1040, .06, 'sine', .04); }
          } else hold[i] = Math.max(0, hold[i] - dt * 3);
        }
        const b = Math.round(bx) + ',' + Math.round(by); if (b !== lastB && T - bSent >= .09) { lastB = b; bSent = T; D.send('b', [Math.round(bx), Math.round(by)], true); }
        if (!g.result) { if (kills >= NEED) g.finish('win'); else if (miss >= NEEDM) g.finish('lose'); else if (T >= g.limit) g.finish('lose'); }
      } else {
        if (!done) { tx = clamp(tx + kdx * 360 * TS * dt, 24, 776); ty = clamp(ty + kdy * 360 * TS * dt, 96, 520); }
        const ox = cx, oy = cy, k = 1 - Math.exp(-dt * 16); cx += (tx - cx) * k; cy += (ty - cy) * k;
        const v = skipV ? 0 : Math.hypot(cx - ox, cy - oy) / Math.max(dt, 1e-3); skipV = false; vSm += (v - vSm) * Math.min(1, dt * 10);
        const out = T < outUntil;
        if (!out) { hGut = clamp(hGut + (Math.max(0, vSm - 520) / 520 - .8) * dt, 0, 1.2); if (hGut >= 1) { outUntil = T + .9; hGut = .2; snuffN++; if (!wasOut) { noise(.3, .06, 2000, 300, 'bandpass'); say('PFFF!', cx, cy - 70, 30, '#6a6f8f', '#fff'); } } }
        wasOut = T < outUntil;
        const c = Math.round(cx) + ',' + Math.round(cy) + ',' + (T < outUntil ? 1 : 0) + ',' + Math.round(hGut * 10); if (c !== lastC && T - cSent >= .1) { lastC = c; cSent = T; D.send('c', [Math.round(cx), Math.round(cy), Math.round(hGut * 100), T < outUntil ? 1 : 0], true); }
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = rings.length - 1; i >= 0; i--) if (T - rings[i].t0 > .5) rings.splice(i, 1);
      if (pop && T - pop.t0 > 1) pop = null;
    },
    msg(type, d) {
      if (type === 'b' && Array.isArray(d)) { bxT.push(d[0]); byT.push(d[1]); }
      else if (type === 'c' && Array.isArray(d)) { cxT.push(d[0]); cyT.push(d[1]); chT.push(d[2] / 100); cOutRecv = d[3] ? g.c : cOutRecv; }
      else if (type === 'rv' && typeof d === 'number' && d >= 0 && d < N) { revT[d] = g.c; ghostPing = g.c; if (!fl) snd(1040, .06, 'sine', .04); }
      else if (type === 'w' && typeof d === 'number') applyWhack(d, g.c);
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      bakeRoom();
      // beam / candle as seen on THIS screen
      const BX = fl ? bx : (bxT.at() ?? 400), BY = fl ? by : (byT.at() ?? 430);
      const CX = fl ? (cxT.at() ?? 400) : cx, CY = fl ? (cyT.at() ?? 430) : cy, GUT = fl ? (chT.at() ?? 0) : hGut;
      const cOut = fl ? (T - cOutRecv < .35 && cOutRecv > 0) : T < outUntil;
      const lightK = won ? ease(rk / .5) : 0;
      // 1. the night sky behind the bars, then the dark room on top
      pane(T, won); X.drawImage(BK.dim, 0, 0);
      const itemsLit = (T2, filter) => {
        const arr = tgs.slice().sort((a, b) => posOf(a, T2)[1] - posOf(b, T2)[1]);
        for (const tg of arr) {
          if (filter && !filter(tg)) continue; const i = tg.i;
          if (dead[i] >= 0 && tg.kind === 'roach') { splat(deadP[i][0], deadP[i][1], T2, 1); continue; }
          const [x, y] = posOf(tg, T2); shadow(x, y + 16, 22, 6, .22); drawItem(tg, x, y, T2, movingNow(tg, T2));
          if (hit[i]) { star(x, y - 34, 11, 5, 4, T2 * 2, '#ff4d5e', 2.5); }
        }
      };
      if (fl) {
        // 2a. the flashlight world: the beam shows colours; the candle lights a little of the room (not the shapes)
        const cr2 = cOut ? 0 : 130 * (1 - clamp(GUT, 0, 1) * .5);
        if (cr2 > 4) { X.save(); X.beginPath(); X.arc(CX, CY - 12, cr2, 0, TAU); X.clip(); X.drawImage(BK.lit, 0, 0); X.fillStyle = 'rgba(255,170,70,.28)'; X.fillRect(0, 0, W, H); X.restore(); }
        X.save(); X.beginPath(); X.arc(BX, BY, BR, 0, TAU); X.clip(); pane(T, true); X.drawImage(BK.lit, 0, 0); abuela(T, 'idle'); itemsLit(T); X.restore();
      } else {
        // 2b. the candle world: dim room, abuela barely there, colourless shapes; a revealed shape shows what it really is
        X.save(); X.globalAlpha = .55; abuela(T, 'idle'); X.restore(); X.fillStyle = 'rgba(8,10,38,.72)'; rr(AX - 52, AY - 134, 104, 150, 10); X.fill();
        for (const tg of tgs) {
          const i = tg.i; if (dead[i] >= 0) continue; const [x, y] = posOf(tg, T), age = T - revT[i];
          if (age >= 0 && age < TINT) {
            const a = clamp((TINT - age) / .8, 0, 1); X.save(); X.globalAlpha = a; X.beginPath(); X.arc(x, y, 38, 0, TAU); X.fillStyle = 'rgba(255,240,170,.22)'; X.fill();
            shadow(x, y + 16, 22, 6, .22); drawItem(tg, x, y, T, movingNow(tg, T));
            if (tg.kind !== 'roach') { X.beginPath(); X.arc(x + 22, y - 26, 10, 0, TAU); ink('#e8434f', 2.5); line([[x + 18, y - 30], [x + 26, y - 22]], 2.6, '#fff'); line([[x + 26, y - 30], [x + 18, y - 22]], 2.6, '#fff'); }
            X.restore();
          } else silhouette(x, y, tg, T);
        }
        for (const tg of tgs) if (dead[tg.i] >= 0 && tg.kind === 'roach') splat(deadP[tg.i][0], deadP[tg.i][1], T, .85);
      }
      // 3. lights: the flashlight cone + pool (both screens), the candle glow
      const hx = clamp(BX, 120, 680), hy = 538;
      X.save(); X.globalCompositeOperation = 'lighter';
      const ang = Math.atan2(BY - hy, BX - hx), dd = Math.hypot(BX - hx, BY - hy), hw = Math.min(BR, dd * .9);
      X.beginPath(); X.moveTo(hx + 18, hy - 30); X.lineTo(BX + Math.cos(ang + Math.PI / 2) * hw, BY + Math.sin(ang + Math.PI / 2) * hw); X.lineTo(BX + Math.cos(ang - Math.PI / 2) * hw, BY + Math.sin(ang - Math.PI / 2) * hw); X.closePath();
      X.fillStyle = fl ? 'rgba(255,248,200,.14)' : 'rgba(255,248,200,.07)'; X.fill();
      let gr = X.createRadialGradient(BX, BY, 6, BX, BY, BR); gr.addColorStop(0, fl ? 'rgba(255,252,220,.38)' : 'rgba(255,252,220,.16)'); gr.addColorStop(1, 'rgba(255,240,180,.06)'); X.fillStyle = gr; X.beginPath(); X.arc(BX, BY, BR, 0, TAU); X.fill();
      if (!cOut) { const cr3 = 120 * (1 - clamp(GUT, 0, 1) * .45) * (.94 + Math.sin(T * 25) * .06 * (1 + GUT)); gr = X.createRadialGradient(CX, CY - 12, 4, CX, CY - 12, cr3); gr.addColorStop(0, 'rgba(255,190,90,.5)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); X.fillStyle = gr; X.beginPath(); X.arc(CX, CY - 12, cr3, 0, TAU); X.fill(); }
      X.restore();
      X.lineWidth = 3; X.strokeStyle = 'rgba(255,250,214,.55)'; X.setLineDash([10, 8]); X.beginPath(); X.arc(BX, BY, BR, 0, TAU); X.stroke(); X.setLineDash([]);
      for (const r of rings) { const k = (T - r.t0) / .5; X.globalAlpha = 1 - k; X.lineWidth = 4; X.strokeStyle = '#fff'; X.beginPath(); X.arc(r.x, r.y, 20 + k * 36, 0, TAU); X.stroke(); X.globalAlpha = 1; }
      // 4. the flashlight kid at the bottom (a dim ghost on the candle's screen)
      X.save(); if (!fl) X.globalAlpha = .55;
      const lc = fl ? mcol() : pc(), hd = Math.atan2(BY - (hy - 30), BX - (hx + 18));
      X.save(); X.translate(hx, hy); arm(2.9, 1, hd + Math.PI / 2 - .2, .9, lc); X.restore();
      caos(hx, hy, 2.9, { col: lc, mood: won ? 'happy' : lost ? 'sad' : null });
      X.save(); X.translate(hx + 18, hy - 30); X.rotate(hd); rr(-4, -6, 28, 12, 4); ink('#8f9cb3', 3); rr(22, -8, 8, 16, 3); ink('#ffe58a', 3); X.restore();
      X.restore();
      // 5. the candle (own screen: at the pointer; flashlight screen: the friend's candle)
      candle(CX, CY, GUT, T, fl ? (cxT.at(.3) !== null ? (CX - cxT.at(.3)) / .15 : 0) : (cx - tx) * -12, cOut, GUT > .6 && !cOut);
      if (swing) { const a = T - swing.t0; if (a < .4) { const k = ease(a / .12), x = lerp(swing.x + 90, swing.x, k), y = lerp(swing.y - 130, swing.y, k); X.save(); X.globalAlpha = a < .25 ? 1 : 1 - (a - .25) / .15; slipper(x, y, lerp(-1.1, .25, k), T); if (a > .1) { ring(swing.x, swing.y, '#fff', 40, .25); swing.r = 1; } X.restore(); } else swing = null; }
      // 6. the finish: lights back on (win) or abuela's scream (lose)
      if (won && rk >= 0) {
        X.globalAlpha = lightK; X.fillStyle = 'rgba(255,248,214,.0)'; pane(T, true); X.drawImage(BK.lit, 0, 0); itemsLit(T); X.globalAlpha = 1;
        X.globalAlpha = lightK; const tvk = (T * 8) % 2; X.fillStyle = tvk < 1 ? '#ff8fb6' : '#7fd8ff'; rr(606, 178, 100, 56, 6); X.fill(); glint(630, 190, 22, 6, -.35, .4); X.fillStyle = INK; X.fillRect(640, 196 + Math.sin(T * 6) * 2, 14, 24); X.globalAlpha = 1;
        if (lightK > .3) { X.globalAlpha = clamp(lightK * 2 - .6, 0, 1); abuela(T, 'happy'); X.globalAlpha = 1; }
        for (let i = 0; i < 8; i++) { const q = (rk * 1.1 + i * .13) % 1; star(80 + i * 90, 120 + (i % 3) * 40 + q * 20, 6 + q * 14, 3 + q * 4, 6, i + q * 3, ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A'][i % 4], 0); }
        if (rk > .15) badge('LIGHTS ON!', 400, 190, 46, '#ffb23d', '#fff', outBack((rk - .15) / .25) * (rk > 2 ? Math.max(0, 1 - (rk - 2) * 2) : 1), -.05);
      }
      if (lost && rk >= 0) {
        const sc = rk < .7 ? Math.min(1, rk / .12) : 1;
        X.globalAlpha = sc * Math.max(0, 1 - Math.max(0, rk - 2.2) * 2); X.fillStyle = 'rgba(8,10,38,.5)'; X.fillRect(0, 0, W, H);
        X.globalAlpha = sc; X.save(); X.translate(400 - AX * 2.6, 560 - AY * 2.6); X.scale(2.6, 2.6); abuela(T, 'scream'); X.restore(); X.globalAlpha = 1;
        for (let i = 0; i < 3; i++) { const q = (rk * 1.8 + i / 3) % 1; X.globalAlpha = (1 - q) * .8; X.lineWidth = 5; X.strokeStyle = '#ff6f8f'; X.beginPath(); X.arc(400, 330, 30 + q * 170, 0, TAU); X.stroke(); X.globalAlpha = 1; }
        if (rk > .1 && rk < .5) { X.globalAlpha = (.5 - rk) / .4 * .6; X.fillStyle = '#fff'; X.fillRect(0, 0, W, H); X.globalAlpha = 1; }
        badge('AAAAY!', 480, 230, 52, '#e8434f', '#fff', outBack((rk - .12) / .22) * (rk > 2.3 ? Math.max(0, 1 - (rk - 2.3) * 2) : 1), .06);
      }
      // 7. flying bits, the speech pop, the intro badge
      for (const b of bits) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); el(b.x, b.y, b.r, b.r * 1.2); ink(b.c, 1.5); X.globalAlpha = 1; }
      if (pop) { const a = T - pop.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(pop.s, clamp(pop.x, 130, 670), Math.max(110, pop.y - Math.min(a, .5) * 18), pop.size, pop.bgc, pop.fg, a < .2 ? outBack(a / .2) : 1, pop.rot); X.globalAlpha = 1; }
      if (T < 3.4 && !g.result) {
        pill(clamp(fl ? hx : CX, 60, 740), fl ? hy - 62 : CY - 64, 'YOU', mcol());
        pill(clamp(fl ? CX : hx, 100, 700), fl ? CY - 66 : hy - 62, 'YOUR FRIEND', pc());
        badge(fl ? 'FIND THE ROACHES!' : 'SWAT THE ROACHES!', 400, 140, 20, fl ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
      }
      // 8. HUD: hearts for mistakes, a row of roach slots
      rr(238, 62, 318, 44, 14); ink('#d9944f', 4); X.fillStyle = 'rgba(255,255,255,.25)'; rr(246, 66, 302, 8, 4); X.fill();
      for (let i = 0; i < NEEDM; i++) { const c = i >= NEEDM - miss; heart(274 + i * 38, 86, 1.1 * (c && T - mAt < .3 ? 1.3 : 1), c ? '#6b6486' : '#ff5c8a', c); }
      for (let i = 0; i < NEED; i++) { const on = i < kills; X.save(); X.translate(420 + i * 30, 86); X.scale(.5, .5); el(0, 0, 20, 13); ink(on ? '#d9e85a' : '#3a3550', 4); if (on) { X.fillStyle = '#7a3f1d'; el(0, 0, 11, 5); X.fill(); } X.restore(); }
      vignette(.24);
    },
    down(p) { if (g.result) return; if (fl) { gx = clamp(p.x, 24, 776); gy = clamp(p.y, 96, 520); } else { tx = clamp(p.x, 24, 776); ty = clamp(p.y, 96, 520); cx = tx; cy = ty; skipV = true; swat(cx, cy); } },
    up() {},
    move(p) { if (g.result) return; if (fl) { gx = clamp(p.x, 24, 776); gy = clamp(p.y, 96, 520); } else { tx = clamp(p.x, 24, 776); ty = clamp(p.y, 96, 520); } },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      kHeld.add(e.code);
      if (!fl && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyX' || e.code === 'KeyZ')) swat(cx, cy);
    },
    keyup(e) { kHeld.delete(e.code); },
  };
  g.dbg = {
    BR, TR, NEED,
    /* what the FLASHLIGHT screen shows: its beam, the friend's candle, and the true kind of every shape the beam covers */
    linView: () => ({ beam: [bx, by], candle: cxT.at() === null ? null : [cxT.at(), cyT.at()], inBeam: tgs.filter(tg => dead[tg.i] < 0).map(tg => { const [x, y] = posOf(tg, g.c); return { i: tg.i, x, y, kind: tg.kind, d: Math.hypot(x - bx, y - by) }; }).filter(o => o.d < BR + TR), kills, miss }),
    /* what the CANDLE screen shows: every living shape as an anonymous lump, the revealed ones with their kind, its candle, the friend's beam */
    velaView: () => ({ candle: [cx, cy], out: g.c < outUntil, gut: hGut, beam: bxT.at() === null ? null : [bxT.at(), byT.at()], kills, miss,
      sil: tgs.filter(tg => dead[tg.i] < 0).map(tg => { const [x, y] = posOf(tg, g.c); return { i: tg.i, x, y }; }),
      rev: tgs.filter(tg => dead[tg.i] < 0 && g.c - revT[tg.i] >= 0 && g.c - revT[tg.i] < TINT - .4).map(tg => { const [x, y] = posOf(tg, g.c); return { i: tg.i, x, y, kind: tg.kind }; }) }),
    truth: () => tgs.map(tg => ({ i: tg.i, kind: tg.kind, pos: posOf(tg, g.c), dead: dead[tg.i] >= 0 })),
  };
  wire(g, D, 0, sp, 'du_vela');
  return g;
}
reg('du_vela', duVela, 'BLACKOUT'); REGMAP.du_vela.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4, ph = u / 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#0a0d24'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#12163a'; X.fillRect(0, 150, 520, 90);
  const S = [[130, 168, 'roach'], [260, 190, 'slipper'], [390, 160, 'plant']], tgt = Math.floor(u) % 3, [sx, sy] = S[tgt];
  for (let i = 0; i < 3; i++) { X.save(); X.translate(S[i][0], S[i][1]); X.beginPath(); X.ellipse(0, 0, 24, 18, 0, 0, TAU); X.fillStyle = '#04050e'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#5a6285'; X.stroke(); X.restore(); }
  const k = ease((u % 1) / .35), px = lerp(S[(tgt + 2) % 3][0], sx, k), py = lerp(S[(tgt + 2) % 3][1], sy, k);
  if (role === 0) {
    X.save(); X.beginPath(); X.arc(px, py, 70, 0, TAU); X.clip(); X.fillStyle = '#e9d9b0'; X.fillRect(0, 0, 520, 240);
    const tg = { kind: S[tgt][2], ph: 0, ang: .3 }; drawItem(tg, sx, sy, tt, false); X.restore();
    X.beginPath(); X.arc(px, py, 70, 0, TAU); X.lineWidth = 3; X.strokeStyle = '#fff3a0'; X.stroke();
    DUO.demoFinger(px + 20, py + 38, true, ph); badge('SHINE!', 130, 30, 20, '#c98a12', '#fff', 1, -.03);
  } else {
    X.fillStyle = 'rgba(255,190,90,.25)'; X.beginPath(); X.arc(sx, sy - 10, 70, 0, TAU); X.fill();
    if (u % 1 > .4) { const tg = { kind: S[tgt][2], ph: 0, ang: .3 }; drawItem(tg, sx, sy, tt, false); if (S[tgt][2] === 'roach') { const a = (u % 1 - .4) / .6; if (a > .6) slipper(sx, sy - 6, .2, tt); } }
    candle(sx, sy - 22, 0, tt, 0, false, false);
    DUO.demoFinger(sx + 40, sy + 40, S[tgt][2] === 'roach' && u % 1 > .8, 0); badge('SWAT THE ROACHES!', 260, 30, 18, '#2b9ee6', '#fff', 1, -.03);
  }
  X.restore();
}
DUO.INFO.du_vela = [['FLASHLIGHT', 'SHINE ON THE SHAPES', 'MOVE THE LIGHT'], ['CANDLE', 'SWAT ONLY ROACHES', 'MOVE SLOWLY + CLICK']];
DUO.DEMOS.du_vela = [t => demo(0, t), t => demo(1, t)];

})();
