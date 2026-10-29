'use strict';
/* ═════════ DUO · AREPERA (du_arepera): a street arepa stand at dawn, three hungry customers at the counter ═════════
   Drag-and-drop puzzle with a hidden order. Three customers stand in front of three plates (1, 2, 3). Each wants ONE filling.
   LA PLANCHA (role 0): sees the order ticket above every customer (queso, reina pepiada, caraotas, jamón, carne mechada) and the griddle with golden
     arepas. DRAG an arepa (or tap it, then tap a plate) onto a FREE plate of the counter. The cooler next to it is closed: it cannot see the fillings.
   EL MOSTRADOR (role 1, JUDGE): sees the open cooler with the five fillings (their order is shuffled by the seed) but customers only show a "?".
     DRAG a filling (or tap it, then tap a plate) onto the arepa waiting on a plate: the arepa flies to the customer's cap and the judge scores it.
   They have to talk: A says "plate 2 wants reina pepiada", B stuffs it. A wrong filling costs PEN seconds (the judge loses earlier); a right one
   serves the customer and a new one arrives with a new order. WIN: 3 right orders. LOSE: time out (customers walk off offended).
   Gag: every stuffed arepa is thrown and lands on the customer's cap; the right one is eaten with hearts, the wrong one slides down his face.
   Netcode (everything absolute, latest, resent every .5 s, one owner per object, nothing is ever dragged by two players):
     LA PLANCHA owns put[k] (how many arepas it has placed on plate k)      -> 'p' [put0, put1, put2]
     EL MOSTRADOR owns dn[k] (how many customers plate k has served), the verdict of the last one on each plate, the right-order count and the
       time penalty                                                         -> 's' [dn0..2, res0..2, fill0..2, oks, pen*10]
     A plate holds an arepa while put[k] > dn[k]; A only drops on a plate it knows to be free (its dn is never ahead of the truth, so it can't clash).
     The customer on plate k is the (dn[k])-th one of that plate: its order is ORD[k + 3 * dn[k]], drawn from the seed, so both screens agree. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only (never the level's R)

/* ───────────── tuning / layout (800×600) ───────────── */
const NSL = 3, NEED = 3, NF = 5, NORD = 36;
const SX = [150, 400, 650], PLY = 366, HEADY = 288, SLOTR = 105;       // plate x, plate y, customer head y, drop radius
const SPOT = [{ x: 140, y: 490 }, { x: 215, y: 490 }, { x: 290, y: 490 }];   // arepas on the griddle
const TUBX = [406, 478, 550, 622, 694], TUBY = 486;                   // fillings in the cooler
const READY0 = [.2, .5, .8];                                           // when the first arepas are golden (s)
const FN = ['CHEESE', 'REINA PEPIADA', 'BLACK BEANS', 'HAM', 'SHREDDED BEEF'];
const FC = ['#ffd23f', '#c9e07a', '#5b3a5e', '#ff8fa3', '#b5532f'];
const SKIN = [['#f3c9a0', '#d9a278'], ['#e0a878', '#c0845a'], ['#b27a50', '#8e5a38'], ['#7a4a2c', '#5a3320']];
const CAPC = [['#e8434f', '#b8283a'], ['#2b9ee6', '#1c74b0'], ['#5fd35a', '#2e8f3a'], ['#ffd23f', '#c99512'], ['#7e5bd6', '#5a3fa8']];
const SHIRT = [['#fff3d0', '#e0c88f'], ['#4fd06a', '#24803a'], ['#ff8a5c', '#d1553a'], ['#8fb6e8', '#6a90c8'], ['#ff7ab0', '#d9508a']];

/* ───────────── drawing kit (X is ctx while playing, an offscreen context while a layer is baked) ───────────── */
let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function circ2(x, y, r, fill, o = 3) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(fill, o); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(170, X.measureText(t(label)).width + 24);
  X.beginPath(); X.moveTo(x - 8, y + 11); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 11); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(360, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 360); X.restore();
}
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function arm(u, sx, an, k, col) {            // blocky arm at a caos's shoulder (translate to feet first)
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
}

/* ───────────── props ───────────── */
function fillIcon(f, x, y, s) {                                     // a mound of filling (cheese, salad, beans, ham, beef)
  X.save(); X.translate(x, y); X.scale(s, s);
  if (f === 0) {
    X.beginPath(); X.moveTo(-20, 10); X.lineTo(20, 10); X.lineTo(14, -10); X.lineTo(-14, -14); X.closePath(); ink('#ffd23f', 3);
    X.fillStyle = '#e0a417'; for (const [a, b, r] of [[-8, 0, 3.4], [6, -3, 2.6], [8, 5, 2.2], [-2, 6, 1.8]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fill(); }
    glint(-8, -8, 7, 2.4, -.2, .6);
  } else if (f === 1) {
    el(0, 2, 21, 14); ink('#c9e07a', 3);
    X.fillStyle = '#5aa63c'; for (const [a, b] of [[-9, -1], [4, -5], [10, 3], [-3, 6], [-13, 6]]) { X.beginPath(); X.arc(a, b, 3.2, 0, TAU); X.fill(); }
    X.fillStyle = '#fff'; for (const [a, b] of [[0, 1], [-10, -6], [8, -1], [3, 8]]) { el(a, b, 3.6, 2.2, .5); X.fill(); }
  } else if (f === 2) {
    el(0, 2, 21, 14); ink('#5b3a5e', 3);
    X.fillStyle = '#8a5a8e'; for (const [a, b, r] of [[-9, -2, .3], [3, -6, -.4], [9, 2, .6], [-2, 5, -.2], [-13, 6, .5]]) { el(a, b, 4.4, 2.8, r); X.fill(); }
    glint(-8, -6, 6, 2, -.3, .35);
  } else if (f === 3) {
    rr(-20, -9, 40, 21, 9); ink('#ff8fa3', 3);
    X.strokeStyle = '#ffd0d8'; X.lineWidth = 2.6; X.lineCap = 'round'; for (const a of [-9, 0, 9]) { X.beginPath(); X.moveTo(a, -4); X.lineTo(a + 3, 8); X.stroke(); }
    glint(-10, -5, 6, 2, -.2, .55);
  } else {
    el(0, 2, 21, 14); ink('#b5532f', 3);
    X.strokeStyle = '#e8946a'; X.lineWidth = 2.6; X.lineCap = 'round'; for (const [a, b] of [[-10, -3], [-3, -7], [5, -4], [-6, 3], [4, 4], [11, 1]]) { X.beginPath(); X.moveTo(a, b); X.lineTo(a + 7, b + 5); X.stroke(); }
  }
  X.restore();
}
function arepaPlain(x, y, r, golden) {                              // side view disc: raw (pale) or golden with toast marks
  cel(golden ? '#f2c14e' : '#f6e6c3', golden ? '#d89a2a' : '#dcc592', () => el(x, y, r, r * .7), r * .22, r * .2, 3.5);
  if (golden) { X.strokeStyle = 'rgba(150,84,20,.55)'; X.lineWidth = 3; X.lineCap = 'round'; for (const [a, b, l] of [[-.45, -.1, .5], [.1, .22, .45], [.35, -.2, .4]]) { X.beginPath(); X.arc(x + a * r, y + b * r, r * l * .5, 3.6, 5.5); X.stroke(); } }
  glint(x - r * .35, y - r * .3, r * .3, r * .1, -.4, .5);
}
function arepaFull(x, y, r, col, rot = 0, bite = 0) {               // a stuffed arepa: two golden discs and the filling peeking out
  X.save(); X.translate(x, y); X.rotate(rot);
  const R2 = r * (1 - bite * .5);
  cel('#f2c14e', '#d89a2a', () => el(0, R2 * .16, R2, R2 * .52), R2 * .2, R2 * .15, 3.2);
  el(0, 0, R2 * .94, R2 * .3); ink(col, 2.8);
  X.fillStyle = 'rgba(255,255,255,.28)'; el(-R2 * .3, -R2 * .06, R2 * .3, R2 * .07); X.fill();
  cel('#f2c14e', '#d89a2a', () => el(0, -R2 * .2, R2, R2 * .52), R2 * .2, R2 * .15, 3.2);
  X.strokeStyle = 'rgba(150,84,20,.5)'; X.lineWidth = 2.6; X.lineCap = 'round'; X.beginPath(); X.arc(R2 * .2, -R2 * .26, R2 * .26, 3.6, 5.4); X.stroke();
  glint(-R2 * .34, -R2 * .36, R2 * .28, R2 * .08, -.3, .5);
  X.restore();
}
function look(s) { return { sk: SKIN[Math.floor(hsh(s * 1.3 + 2) * 4)], cp: CAPC[Math.floor(hsh(s * 2.9 + 5) * 5)], sh: SHIRT[Math.floor(hsh(s * 4.1 + 7) * 5)], mus: hsh(s * 5.5 + 9) < .4 }; }
function customer(x, y, s, mood, T, drip) {                           // bust of a customer with a cap; (x, y) = head centre. mood 0 idle, 1 happy, 2 angry
  const L = look(s), by = y + Math.sin(T * 2.1 + s) * 1.6;
  cel(L.sh[0], L.sh[1], () => rr(x - 46, by + 34, 92, 90, 26), 8, 2, 4);
  X.beginPath(); X.moveTo(x - 10, by + 36); X.lineTo(x, by + 54); X.lineTo(x + 10, by + 36); X.closePath(); ink(L.sk[1], 2.5);
  for (const sx of [-1, 1]) { el(x + sx * 31, by + 4, 6, 9); ink(L.sk[0], 3); }
  cel(L.sk[0], L.sk[1], () => el(x, by, 31, 34), 6, 2, 4.5);
  // eyes
  const blink = (T * .7 + s * .37) % 3.1 < .12;
  for (const sx of [-1, 1]) {
    const ex = x + sx * 12, ey = by + 1;
    if (mood === 1 || blink) { X.beginPath(); X.arc(ex, ey + 2, 7, Math.PI + .3, TAU - .3); X.lineWidth = 3.4; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); }
    else { circ2(ex, ey, 8.5, '#fff', 2.6); const lx = mood === 2 ? -sx * -1 : 0; circ2(ex + (mood === 2 ? sx * -1.5 : 0) + lx * .0, ey + 2.5, 3.6, INK, 0); X.fillStyle = '#fff'; X.beginPath(); X.arc(ex - 1, ey + 1, 1.3, 0, TAU); X.fill(); }
    if (mood === 2) line([[ex - sx * 9, ey - 15 - 0], [ex + sx * 5, ey - 8]], 3.4, INK);
  }
  X.fillStyle = mood === 1 ? 'rgba(255,110,165,.8)' : mood === 2 ? 'rgba(255,60,60,.55)' : 'rgba(255,120,140,.45)'; el(x - 22, by + 13, 6, 4); X.fill(); el(x + 22, by + 13, 6, 4); X.fill();
  if (L.mus) { X.beginPath(); X.moveTo(x - 15, by + 15); X.quadraticCurveTo(x - 7, by + 8, x, by + 14); X.quadraticCurveTo(x + 7, by + 8, x + 15, by + 15); X.quadraticCurveTo(x + 7, by + 19, x, by + 17); X.quadraticCurveTo(x - 7, by + 19, x - 15, by + 15); X.closePath(); ink('#2a1d1a', 2); }
  if (mood === 1) { X.beginPath(); X.arc(x, by + 20, 9, .1, Math.PI - .1); ink('#7a1d2e', 2.5); }
  else if (mood === 2) { X.beginPath(); X.arc(x, by + 29, 8, Math.PI + .3, TAU - .3); X.lineWidth = 3.4; X.strokeStyle = INK; X.stroke(); }
  else { el(x, by + 23, 4.5, 2.6 + Math.abs(Math.sin(T * 1.2 + s)) * 1.2); ink('#9a3b4a', 2); }
  if (drip && drip.k > 0) { for (const dx of [-14, -2, 11]) { const l = drip.k * (22 + (dx + 20) % 9); X.beginPath(); X.moveTo(x + dx - 3, by - 9); X.lineTo(x + dx + 3, by - 9); X.lineTo(x + dx + 2, by - 9 + l); X.quadraticCurveTo(x + dx, by - 5 + l, x + dx - 2, by - 9 + l); X.closePath(); ink(drip.col, 2); } }
  // the cap
  X.beginPath(); X.moveTo(x - 33, by - 7); X.bezierCurveTo(x - 36, by - 56, x + 36, by - 56, x + 33, by - 7); X.closePath(); cel(L.cp[0], L.cp[1], () => { X.beginPath(); X.moveTo(x - 33, by - 7); X.bezierCurveTo(x - 36, by - 56, x + 36, by - 56, x + 33, by - 7); X.closePath(); }, 7, 3, 4);
  rr(x - 38, by - 12, 76, 11, 5); ink(L.cp[1], 3.4); X.beginPath(); X.moveTo(x + 6, by - 13); X.quadraticCurveTo(x + 40, by - 18, x + 46, by - 4); X.quadraticCurveTo(x + 30, by - 2, x + 6, by - 2); X.closePath(); ink(L.cp[1], 3); circ2(x, by - 47, 4, L.cp[1], 2);
  X.fillStyle = 'rgba(255,255,255,.4)'; el(x - 14, by - 36, 10, 4, -.5); X.fill();
}
function steam(x, y, T) { for (let i = 0; i < 3; i++) { const ph = (T * .8 + i / 3) % 1; X.globalAlpha = (1 - ph) * .5; X.fillStyle = '#fff'; X.beginPath(); X.arc(x + Math.sin(ph * 6 + i * 2) * 6 + (i - 1) * 9, y - ph * 38, 5 + ph * 5, 0, TAU); X.fill(); } X.globalAlpha = 1; }
function plate(x, y, glow) {
  if (glow) { X.fillStyle = `rgba(255,255,255,${glow * .55})`; el(x, y, 76, 24); X.fill(); }
  el(x, y + 3, 62, 17); ink('#d8d0c4', 3.4); el(x, y, 62, 17); ink('#fff7ea', 3.4); el(x, y, 44, 10); X.strokeStyle = 'rgba(160,140,110,.5)'; X.lineWidth = 2; X.stroke();
}

/* ───────────── backdrop (baked once, two layers: the street behind the customers, and the stand in front of them) ───────────── */
let BGB = null, BGF = null;
function bake(fn) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d'); fn(); X = old; return cv; }
function buildBack() {
  return bake(() => {
    const sk = X.createLinearGradient(0, 0, 0, 350); sk.addColorStop(0, '#120e3a'); sk.addColorStop(.5, '#3a2a78'); sk.addColorStop(.85, '#d9708a'); sk.addColorStop(1, '#ffb27a'); X.fillStyle = sk; X.fillRect(0, 0, W, 350);
    circ2(470, 112, 30, '#fff3b0', 4); X.fillStyle = 'rgba(220,200,130,.5)'; for (const [a, b, r] of [[460, 104, 6], [482, 122, 5], [474, 100, 3]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fill(); }
    // far skyline (coloured outline, no ink) and near buildings
    X.fillStyle = '#3b2f6e'; X.strokeStyle = '#2a2158'; X.lineWidth = 3;
    for (const [bx, bw, bh] of [[0, 90, 120], [90, 70, 170], [160, 100, 110], [260, 80, 150], [340, 90, 100], [430, 70, 160], [500, 100, 120], [600, 80, 180], [680, 120, 130]]) { X.fillRect(bx, 350 - bh, bw, bh); X.strokeRect(bx, 350 - bh, bw, bh); }
    X.fillStyle = 'rgba(255,224,138,.75)'; for (let i = 0; i < 40; i++) { const wx = 10 + (i % 20) * 40 + (hsh(i) * 8 | 0), wy = 210 + Math.floor(i / 20) * 46 + (hsh(i + 9) * 14 | 0); if (hsh(i * 2 + 1) < .5) X.fillRect(wx, wy, 11, 15); }
    cel('#4a3a86', '#352a6c', () => rr(560, 232, 120, 130, 4), 8, 0, 4); X.fillStyle = 'rgba(255,224,138,.9)'; for (const [a, b] of [[576, 252], [610, 252], [644, 252], [576, 288], [644, 288]]) { rr(a, b, 18, 22, 3); X.fill(); }
    // street + curb
    X.fillStyle = '#5a5a78'; X.fillRect(0, 320, W, 40); X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(0, 320, W, 5); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 322); X.lineTo(W, 322); X.stroke();
    // street lamps (pole and head; the glow and moths are live)
    for (const lx of [275, 525]) { line([[lx, 168], [lx, 328]], 7, '#3a3550'); rr(lx - 17, 150, 34, 20, 8); ink('#ffd23f', 3.4); }
    // the clock on its pole (the face is live)
    line([[735, 246], [735, 330]], 7, '#3a3550');
    // a paper bunting across the street
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(20, 150); X.quadraticCurveTo(150, 190, 270, 150); X.stroke();
    X.beginPath(); X.moveTo(530, 150); X.quadraticCurveTo(650, 192, 780, 150); X.stroke();
  });
}
function buildFront() {
  return bake(() => {
    // the counter: top face, fascia with slats
    rr(-10, 348, W + 20, 34, 8); ink('#e8a35c', 4); X.fillStyle = 'rgba(255,255,255,.28)'; rr(0, 352, W, 7, 3); X.fill();
    rr(-10, 378, W + 20, 44, 6); ink('#a5622c', 4); X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 3; for (let x = 60; x < W; x += 80) { X.beginPath(); X.moveTo(x, 384); X.lineTo(x, 418); X.stroke(); }
    // inside of the stand: dark planks, a shelf of cans, and the floor
    const wl = X.createLinearGradient(0, 424, 0, 552); wl.addColorStop(0, '#5b3a2a'); wl.addColorStop(1, '#3a2418'); X.fillStyle = wl; X.fillRect(0, 424, W, 128);
    X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 3; for (let x = 40; x < W; x += 56) { X.beginPath(); X.moveTo(x, 424); X.lineTo(x, 552); X.stroke(); }
    X.fillStyle = 'rgba(255,160,70,.1)'; X.fillRect(0, 424, W, 128);
    const fl = X.createLinearGradient(0, 552, 0, H); fl.addColorStop(0, '#8a5530'); fl.addColorStop(1, '#5e381d'); X.fillStyle = fl; X.fillRect(0, 552, W, H - 552);
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 552); X.lineTo(W, 552); X.stroke();
    // shelf with corn flour sacks / cans in the gap between the griddle and the cooler
    rr(344, 432, 22, 16, 4); ink('#fff3d0', 2.5); rr(340, 450, 30, 40, 6); ink('#ffd23f', 3); rr(334, 494, 40, 52, 6); ink('#fff3d0', 3);
    // awning with scalloped edge, posts
    for (let i = 0; i < 17; i++) { X.beginPath(); X.moveTo(i * 50 - 25, 0); X.lineTo(i * 50 + 25, 0); X.lineTo(i * 50 + 25, 48); X.arc(i * 50, 48, 25, 0, Math.PI); X.closePath(); X.fillStyle = i % 2 ? '#fff3d0' : '#e8434f'; X.fill(); X.lineWidth = 3.4; X.strokeStyle = INK; X.stroke(); }
    X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(0, 70, W, 6);
    rr(-6, 0, 24, 556, 6); ink('#a5622c', 4); rr(782, 0, 24, 556, 6); ink('#a5622c', 4);
    // plates on the counter
    for (const x of SX) plate(x, PLY, 0);
    // the griddle (plancha)
    cel('#5a5a6e', '#3b3b4c', () => rr(86, 452, 258, 92, 18), 8, 6, 4.5); X.fillStyle = 'rgba(255,255,255,.18)'; rr(96, 458, 238, 8, 4); X.fill();
    X.fillStyle = 'rgba(255,140,60,.28)'; rr(94, 524, 242, 10, 5); X.fill();
    // paper sign hanging from the awning
    line([[580, 74], [580, 92]], 3, '#e6c58c'); line([[700, 74], [700, 92]], 3, '#e6c58c'); rr(552, 90, 176, 34, 8); ink('#fff3d0', 3.4);
  });
}

/* ═════════ the game ═════════ */
function duArepera(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), A = D.role === 0, TS = Math.sqrt(sp), PEN = 2 / TS, COOK = .9 / TS;
  /* the level, from the seed (same draws on both screens): the order of every customer and the (shuffled) order of the tubs in the cooler */
  const ORD = []; for (let i = 0; i < NORD; i++) ORD.push(Math.floor(R() * NF));
  const bump = 1 + Math.floor(R() * (NF - 1)); if (ORD[0] === ORD[1] && ORD[1] === ORD[2]) ORD[2] = (ORD[2] + bump) % NF;
  const perm = [0, 1, 2, 3, 4]; for (let i = NF - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
  const ordOf = k => ORD[(k + NSL * dn[k]) % NORD];
  const put = [0, 0, 0], dn = [0, 0, 0], res = [0, 0, 0], fil = [0, 0, 0], anim = [null, null, null], arrive = [-9, -9, -9], lastRes = [0, 0, 0];
  let oks = 0, pen = 0, penAt = -9, lastDone = -1, resAt = -1, pSent = -9, sSent = -9;
  /* A: griddle */
  const readyAt = READY0.map(x => x / TS), takenAt = [-9, -9, -9]; let hold = null, sel = -1, ret = null, downAt = null;
  const sendP = () => { pSent = g.c; D.send('p', put.slice(), true); };
  const sendS = () => { sSent = g.c; D.send('s', [...dn, ...res, ...fil, oks, Math.round(pen * 10)], true); };
  function onDone(k, ok, f) {
    anim[k] = { t0: g.c, ok, f, old: k + NSL * (dn[k] - 1) }; lastDone = k; lastRes[k] = ok ? 1 : 2;
    if (ok) { sfx.coin(); } else { sfx.buzz(); sfx.splat(); }
  }
  function deliver(j, k) {                                             // B: stuff the arepa waiting on plate k with the filling of tub j
    if (put[k] <= dn[k]) { sfx.buzz(); return false; }
    const f = perm[j], ok = f === ordOf(k);
    dn[k]++; res[k] = ok ? 1 : 2; fil[k] = f;
    if (ok) oks++; else { pen += PEN; penAt = g.c; }
    onDone(k, ok, f); sendS();
    if (oks >= NEED) g.finish('win');
    return true;
  }
  function tryPut(i, k) {                                              // A: put griddle arepa i on plate k (only if it is free)
    if (put[k] > dn[k]) { sfx.buzz(); return false; }
    put[k]++; readyAt[i] = g.c + COOK; takenAt[i] = g.c; arrive[k] = g.c; sfx.pop(); sendP(); return true;
  }
  const slotAt = p => { let b = -1, bd = SLOTR; for (let k = 0; k < NSL; k++) { const d = Math.hypot(p.x - SX[k], (p.y - PLY) * .8); if (d < bd) { bd = d; b = k; } } return b; };
  const spotAt = p => { for (let i = 0; i < 3; i++) if (g.c >= readyAt[i] && Math.hypot(p.x - SPOT[i].x, (p.y - SPOT[i].y) * .8) < 44) return i; return -1; };
  const tubAt = p => { for (let j = 0; j < NF; j++) if (Math.abs(p.x - TUBX[j]) < 38 && p.y > 410 && p.y < 552) return j; return -1; };

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: A ? 'PASS THE AREPAS!' : 'STUFF THE AREPAS!', roleLabel: A ? 'THE GRIDDLE' : 'THE COUNTER',
    hint: A ? 'YOU READ THE ORDERS - YOUR FRIEND CANNOT. DRAG A GOLDEN AREPA ONTO A FREE PLATE (OR TAP IT, THEN TAP THE PLATE) AND TELL YOUR FRIEND WHAT EACH CUSTOMER WANTS. 3 RIGHT ORDERS WIN, EACH MISTAKE COSTS TIME'
      : 'YOU HAVE THE FILLINGS BUT NOT THE ORDERS. ASK YOUR FRIEND, THEN DRAG THE RIGHT FILLING ONTO EACH AREPA ON THE COUNTER (OR TAP THE FILLING, THEN THE PLATE). 3 RIGHT ORDERS WIN, EACH MISTAKE COSTS TIME',
    thint: A ? 'DRAG AREPAS TO THE PLATES AND CALL OUT THE ORDERS' : 'DRAG THE FILLING THEY CALL OUT ONTO THE AREPA',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) resAt = T;
      if (A) { if (T - pSent >= .5) sendP(); }
      else {
        if (T - sSent >= .5) sendS();
        if (!g.result && T >= g.limit - pen) g.finish('lose');
      }
    },
    msg(type, d) {
      if (!Array.isArray(d)) return;
      if (!A && type === 'p') { for (let k = 0; k < NSL; k++) { const v = d[k] | 0; if (v > put[k]) { put[k] = Math.min(v, dn[k] + 1); arrive[k] = g.c; sfx.pop(); } } }   // clamp: never more than one arepa per plate
      else if (A && type === 's') {
        for (let k = 0; k < NSL; k++) { const v = d[k] | 0; if (v > dn[k]) { dn[k] = v; res[k] = d[3 + k] | 0; fil[k] = clamp(d[6 + k] | 0, 0, NF - 1); onDone(k, res[k] === 1, fil[k]); } }
        oks = d[9] | 0; const np = (d[10] | 0) / 10; if (np > pen) penAt = g.c; pen = np;
      }
    },
    down(p) {
      if (g.result) return; downAt = { x: p.x, y: p.y };
      if (sel >= 0) { const k = slotAt(p); if (k >= 0) { if (A) tryPut(sel, k); else deliver(sel, k); sel = -1; return; } sel = -1; }
      if (A) { const i = spotAt(p); if (i >= 0) hold = { i, x: p.x, y: p.y }; }
      else { const j = tubAt(p); if (j >= 0) hold = { i: j, x: p.x, y: p.y }; }
    },
    move(p) { if (g.result || !hold) return; hold.x = p.x; hold.y = p.y; },
    up(p) {
      if (!hold) return; const h = hold; hold = null;
      if (g.result) return;
      if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 14) { sel = h.i; sfx.tick(); return; }   // a tap: pick it, then tap a plate
      const k = slotAt(p); let ok = false;
      if (k >= 0) ok = A ? tryPut(h.i, k) : deliver(h.i, k);
      if (!ok) ret = { i: h.i, x: p.x, y: p.y, t0: g.c };
    },
    key() {},
  };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';

  /* ═════ draw ═════ */
  g.draw = function () {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    if (!BGB) { BGB = buildBack(); BGF = buildFront(); }
    ctx.drawImage(BGB, 0, 0);
    // live street: twinkling stars, glowing lamps, moths, the cat on the roof
    for (let i = 0; i < 26; i++) { const sx = hsh(i * 3.3) * 780 + 10, sy = hsh(i * 7.7) * 130 + 8; X.globalAlpha = .35 + .6 * Math.abs(Math.sin(T * 1.7 + i)); X.fillStyle = '#fff'; X.fillRect(sx, sy, 3, 3); } X.globalAlpha = 1;
    for (const lx of [275, 525]) {
      X.fillStyle = 'rgba(255,214,120,.16)'; X.beginPath(); X.moveTo(lx - 12, 168); X.lineTo(lx - 80, 340); X.lineTo(lx + 80, 340); X.lineTo(lx + 12, 168); X.closePath(); X.fill();
      X.fillStyle = 'rgba(255,230,150,.2)'; X.beginPath(); X.arc(lx, 160, 34 + Math.sin(T * 5 + lx) * 1.5, 0, TAU); X.fill();
      for (let m = 0; m < 3; m++) { const a = T * (2.2 + m * .6) + m * 2 + lx, mx = lx + Math.cos(a) * (22 + m * 6), my = 156 + Math.sin(a * 1.3) * 14; X.fillStyle = '#fff'; el(mx, my, 3.4, 1.8, Math.sin(T * 30 + m) * .6); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.4; X.stroke(); }
    }
    // cat on the roof of the near building, tail swishing
    { const cx = 600, cy = 232; cel('#2a2540', '#1c182e', () => el(cx, cy - 10, 17, 11), 3, 2, 3); circ2(cx + 14, cy - 18, 8, '#2a2540', 3); X.beginPath(); X.moveTo(cx + 9, cy - 24); X.lineTo(cx + 10, cy - 32); X.lineTo(cx + 15, cy - 25); X.closePath(); ink('#2a2540', 2); X.beginPath(); X.moveTo(cx + 16, cy - 25); X.lineTo(cx + 19, cy - 32); X.lineTo(cx + 21, cy - 23); X.closePath(); ink('#2a2540', 2);
      X.fillStyle = '#ffe14d'; X.fillRect(cx + 12, cy - 20, 3, 3); X.fillRect(cx + 18, cy - 20, 3, 3);
      line([[cx - 15, cy - 8], [cx - 26, cy - 14 + Math.sin(T * 3) * 4], [cx - 32, cy - 26 + Math.sin(T * 3 + 1) * 8]], 4, '#2a2540'); }
    // clock face (the time left; each mistake takes some away)
    { const cx = 735, cy = 214, left = Math.max(0, g.limit - pen - T), fr = clamp(left / g.limit, 0, 1);
      circ2(cx, cy, 34, '#fff', 4); X.beginPath(); X.moveTo(cx, cy); X.arc(cx, cy, 27, -Math.PI / 2, -Math.PI / 2 + TAU * fr); X.closePath(); X.fillStyle = fr < .25 ? '#ff4d5e' : '#5CFF7A'; X.fill();
      X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(cx, cy); X.lineTo(cx + Math.cos(-Math.PI / 2 + TAU * fr) * 25, cy + Math.sin(-Math.PI / 2 + TAU * fr) * 25); X.stroke(); circ2(cx, cy, 4, INK, 0);
      if (T - penAt < 1.3) { const k = (T - penAt) / 1.3; txt('-' + (Math.round(PEN * 10) / 10) + 's', cx, cy - 46 - k * 20, 24, '#ff4d5e'); } }

    // ── customers (behind the counter) ──
    const hearts = [];
    for (let k = 0; k < NSL; k++) {
      const x = SX[k], an = anim[k], u = an ? T - an.t0 : -1;
      let s = k + NSL * dn[k], dy = 0, mood = 0, cap = null, drip = null, fly = null, hide = false;
      const freeze = won && k === lastDone;
      if (an && !(lost && false)) {
        if (u < 1.05 || freeze) { s = an.old; }
        else if (u < 1.4) { s = an.old; dy = 130 * ease((u - 1.05) / .35); }
        else { s = k + NSL * dn[k]; dy = u < 1.7 ? (1 - outBack((u - 1.35) / .35)) * 130 : 0; if (u < 1.35) hide = true; }
        if (u < 1.05 || freeze) {
          if (u < .45) { fly = ease(u / .45); mood = 0; }
          else if (an.ok) { mood = 1; const eat = freeze ? 0 : clamp((u - .62) / .3, 0, 1); cap = eat >= 1 ? null : { eat, f: an.f }; }
          else { mood = 2; const sl = clamp((u - .8) / .4, 0, 1); drip = { k: ease((u - .5) / .5), col: FC[an.f] }; cap = { slide: sl, f: an.f }; }
        }
      }
      if (lost) { mood = 2; }
      if (won) mood = 1;
      if (lost && rk > .6) dy = 0;
      const off = lost && rk > .7 ? (k === 1 ? 0 : (k - 1)) * ease((rk - .7) / 1.2) * 520 : 0, offY = lost && rk > .7 && k === 1 ? ease((rk - .7) / 1.2) * 190 : 0;
      if (!hide) {
        const hy = HEADY + dy + offY, hx = x + off;
        customer(hx, hy, s, mood, T, drip);
        if (mood === 2) { if (!lost || rk < .7) steam(hx - 26, hy - 44, T + k); if (!lost && drip) {} }
        if (cap) {                                                      // the arepa sitting on his cap, being eaten (right) or sliding down (wrong)
          const topY = hy - 58;
          if (cap.eat !== undefined) { const ey = lerp(topY, hy + 20, ease(cap.eat)); arepaFull(hx, ey, 24 * (1 - cap.eat * .4), FC[cap.f], Math.sin(T * 12) * .06 * cap.eat, cap.eat); }
          else { const sl = ease(cap.slide); arepaFull(hx + sl * 40, lerp(topY, 346, sl * sl), 24, FC[cap.f], sl * 1.3, 0); }
        }
        if (mood === 1) for (let i = 0; i < 3; i++) { const ph = (T * .9 + i / 3 + k * .2) % 1; hearts.push([hx + (i - 1) * 24 + Math.sin(ph * 6 + i) * 6, hy - 62 - ph * 46, .45 + ph * .45, 1 - ph]); }
      }
      if (fly !== null) {                                               // the thrown arepa, on its way to the cap
        const fx = lerp(x, x, fly), fy = lerp(PLY - 6, HEADY - 62, fly) - Math.sin(fly * Math.PI) * 70;
        arepaFull(fx, fy, 24, FC[an.f], fly * 5.5, 0);
      }
    }
    ctx.drawImage(BGF, 0, 0);

    // ── plates: numbers, arepas waiting, glow for a valid drop target ──
    const dragging = hold || sel >= 0;
    for (let k = 0; k < NSL; k++) {
      const x = SX[k], has = put[k] > dn[k], aim = dragging && (A ? !has : has);
      if (aim) { const near = hold ? slotAt(hold) === k : false; X.globalAlpha = .55 + .35 * Math.sin(T * 9); X.strokeStyle = near ? '#5CFF7A' : '#fff'; X.lineWidth = near ? 6 : 4; el(x, PLY, 76, 24); X.stroke(); X.globalAlpha = 1; }
      if (has) { const pk = outBack((T - arrive[k]) / .3); arepaPlain(x, PLY - 10 - (1 - clamp(pk, 0, 1)) * 40, 34 * Math.min(1.1, Math.max(.2, pk)), true); }
      circ2(x, 402, 14, '#fff3d0', 3); txt(String(k + 1), x, 403, 18, INK, 'center', 20);
    }
    X.fillStyle = 'rgba(255,255,255,.9)'; txt('AREPERA 24H', 640, 107, 17, '#e8434f', 'center', 160);

    // ── the griddle ──
    steam(190, 456, T); steam(265, 458, T + 1);
    for (let i = 0; i < 3; i++) {
      if (A) {
        if (hold && hold.i === i) continue;
        const rd = T >= readyAt[i], sf = rd ? 1 : clamp((T - takenAt[i] - .15) / .3, 0, 1);
        if (rd || (T - takenAt[i] > .15 && takenAt[i] > -5)) arepaPlain(SPOT[i].x, SPOT[i].y - (sel === i ? 8 + Math.sin(T * 10) * 2 : 0), 29 * (rd ? 1 : .5 + sf * .3), rd);
        if (sel === i) { X.strokeStyle = '#5CFF7A'; X.lineWidth = 4; el(SPOT[i].x, SPOT[i].y, 38, 28); X.stroke(); }
      } else arepaPlain(SPOT[i].x, SPOT[i].y, 29, true);
    }
    if (A && ret) { const k = ease((T - ret.t0) / .25); if (k >= 1) ret = null; else arepaPlain(lerp(ret.x, SPOT[ret.i].x, k), lerp(ret.y, SPOT[ret.i].y, k), 29, true); }

    // ── the cooler ──
    if (A) {                                                            // closed: the filling names are not for your eyes
      cel('#e8434f', '#b8283a', () => rr(362, 446, 376, 104, 14), 8, 6, 4.5);
      rr(354, 436, 392, 40, 12); ink('#fff', 4); X.fillStyle = 'rgba(20,16,28,.12)'; rr(362, 462, 376, 8, 4); X.fill();
      rr(530, 428, 40, 12, 5); ink('#c9ced6', 3);
      circ2(550, 512, 26, '#fff3d0', 3.5); txt('?', 550, 513, 36, INK, 'center', 30);
    } else {
      rr(362, 440, 376, 112, 14); ink('#2c3350', 4.5);
      for (let j = 0; j < NF; j++) {
        const x = TUBX[j], f = perm[j], isSel = sel === j || (hold && hold.i === j);
        X.beginPath(); X.moveTo(x - 34, 452); X.lineTo(x + 34, 452); X.lineTo(x + 29, 524); X.lineTo(x - 29, 524); X.closePath(); ink('#e9eef7', 3.4);
        fillIcon(f, x, 446, 1.22);
        rr(x - 29, 474, 58, 26, 7); ink('#fff', 2.6); txt(FN[f], x, 488, 12.5, INK, 'center', 52);
        if (isSel) { X.strokeStyle = '#5CFF7A'; X.lineWidth = 4; X.beginPath(); X.moveTo(x - 38, 454); X.lineTo(x + 38, 454); X.lineTo(x + 32, 528); X.lineTo(x - 32, 528); X.closePath(); X.stroke(); }
      }
      cel('#e8434f', '#b8283a', () => rr(358, 510, 384, 42, 12), 8, 6, 4.5); X.fillStyle = 'rgba(255,255,255,.3)'; rr(366, 515, 368, 7, 3); X.fill();
    }
    // ── held things ──
    if (hold) {
      if (A) { X.fillStyle = 'rgba(20,16,28,.28)'; el(hold.x, hold.y + 26, 36, 10); X.fill(); arepaPlain(hold.x, hold.y - 16, 34, true); }
      else { X.fillStyle = 'rgba(20,16,28,.28)'; el(hold.x, hold.y + 22, 30, 8); X.fill(); fillIcon(perm[hold.i], hold.x, hold.y - 12, 1.7); }
    }
    // ── the vendors ──
    const myc = myCol(), pc = pCol(), ac = A ? myc : pc, bc = A ? pc : myc, hop = k => won && rk >= 0 ? Math.abs(Math.sin(T * 10 + k)) * 12 : 0;
    X.save(); X.translate(44, 548 - hop(0)); arm(2.3, -1, won ? -.5 + Math.sin(T * 14) * .3 : -2.3, 1, ac); arm(2.3, 1, won ? .5 - Math.sin(T * 14) * .3 : (A && hold ? -1.2 : -1.9), 1, ac); caos(0, 0, 2.3, { col: ac, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    X.save(); X.translate(772, 548 - hop(1.3)); arm(2.3, -1, won ? -.5 + Math.sin(T * 14) * .3 : (!A && hold ? -1.2 : -2.0), 1, bc); arm(2.3, 1, won ? .5 - Math.sin(T * 14) * .3 : -2.3, 1, bc); caos(0, 0, 2.3, { col: bc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (!g.result && T < 3.4) { pill(78, 548 - 2.3 * 12.6 - 34, A ? 'YOU' : 'YOUR FRIEND', ac); pill(726, 548 - 2.3 * 12.6 - 34, A ? 'YOUR FRIEND' : 'YOU', bc); }

    // ── order tickets (the griddle) / question marks (the counter) ──
    for (let k = 0; k < NSL; k++) {
      const an = anim[k], u = an ? T - an.t0 : -1; if (g.result) continue;
      const sc = an ? (u < 1.0 ? 0 : outBack((u - 1.5) / .3)) : 1; if (sc <= .02) continue;
      const x = SX[k], y = 186;
      X.save(); X.translate(x, y); X.scale(sc, sc); X.translate(-x, -y);
      X.beginPath(); X.moveTo(x - 9, y + 30); X.lineTo(x, y + 52); X.lineTo(x + 9, y + 30); X.closePath(); ink(A ? '#fff8e0' : '#fff', 3);
      if (A) {
        rr(x - 52, y - 34, 104, 68, 8); ink('#fff8e0', 3.6); X.strokeStyle = 'rgba(200,120,70,.5)'; X.lineWidth = 2.4; X.setLineDash([5, 4]); X.beginPath(); X.moveTo(x - 44, y - 22); X.lineTo(x + 44, y - 22); X.stroke(); X.setLineDash([]);
        circ2(x - 42, y - 30, 4, '#e8434f', 2);
        fillIcon(ordOf(k), x, y - 4, 1.2); txt(FN[ordOf(k)], x, y + 22, 14, INK, 'center', 94);
      } else { circ2(x, y, 28, '#fff', 3.6); txt('?', x, y + 1, 38, '#2b9ee6', 'center', 30); }
      X.restore();
    }
    if (hearts.length) for (const [hx, hy, s2, a] of hearts) { X.globalAlpha = a; heart(hx, hy, s2); } X.globalAlpha = 1;

    // ── endings ──
    if (won && rk >= 0) {
      for (let i = 0; i < 8; i++) { const ph = (rk * .8 + i / 8) % 1; X.globalAlpha = 1 - ph; heart(80 + i * 90 + Math.sin(ph * 7 + i) * 10, 330 - ph * 160, .5 + ph * .4); } X.globalAlpha = 1;
      badge('AREPAS FOR EVERYONE!', 520, 110, 32, '#ffb23d', '#fff', outBack((rk - .2) / .3), .03);
      if (rk > .9) badge('NICE CATCH, CAP!', 520, 168, 24, '#e8434f', '#fff', outBack((rk - .9) / .3), -.04);
    }
    if (lost && rk >= 0) {
      badge('THEY LEFT HUNGRY!', 520, 110, 32, '#e8434f', '#fff', outBack((rk - .3) / .3), -.03);
      if (rk > 1.1) badge('NOBODY GOT AN AREPA...', 520, 168, 22, '#7e5bd6', '#fff', outBack((rk - 1.1) / .3), .03);
    }
    if (!g.result && T < 3.4) badge(A ? 'READ OUT THE ORDERS!' : 'ASK WHAT THEY WANT!', 520, 100, 22, A ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.02);
    if (!g.result && T < 3.4 && !hold) {
      if (A) { const k = (T * .8) % 1; DUO.demoFinger(lerp(SPOT[0].x, SX[1], ease(k)) + 4, lerp(SPOT[0].y, PLY, ease(k)) + 18, true, (T * 2) % 1); }
      else { const k = (T * .8) % 1; DUO.demoFinger(lerp(TUBX[2], SX[1], ease(k)) + 4, lerp(TUBY, PLY, ease(k)) + 22, true, (T * 2) % 1); }
    }
    vignette(.18);
  };

  // what a bot may see: the same things as the screen
  g.dbg = {
    slotPt: k => ({ x: SX[k], y: PLY }), spotPt: i => ({ x: SPOT[i].x, y: SPOT[i].y }), tubPt: j => ({ x: TUBX[j], y: TUBY }),
    view: () => A
      ? { role: 0, orders: [0, 1, 2].map(k => ({ f: ordOf(k), name: FN[ordOf(k)] })), cust: dn.slice(), free: [0, 1, 2].map(k => put[k] <= dn[k]), ready: [0, 1, 2].map(i => g.c >= readyAt[i]), oks, pen }
      : { role: 1, cust: dn.slice(), present: [0, 1, 2].map(k => put[k] > dn[k]), tubs: perm.map((f, j) => ({ f, name: FN[f], x: TUBX[j], y: TUBY })), oks, pen },
    truth: () => ({ ORD, perm, put, dn, res, oks, pen }),
  };
  wire(g, D, 1, sp, 'du_arepera');
  return g;
}
reg('du_arepera', duArepera, 'AREPERA'); REGMAP.du_arepera.duo = true;

/* ───────────── intro card (520×240), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4, k = ease(u / 2.2);
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  const sk = X.createLinearGradient(0, 0, 0, 240); sk.addColorStop(0, '#2b2566'); sk.addColorStop(1, '#d9708a'); X.fillStyle = sk; X.fillRect(0, 0, 520, 240);
  rr(-10, 130, 540, 26, 6); ink('#e8a35c', 3.5); X.fillStyle = '#5b3a2a'; X.fillRect(0, 156, 520, 90);
  for (let i = 0; i < 17; i++) { X.beginPath(); X.moveTo(i * 36 - 18, 0); X.lineTo(i * 36 + 18, 0); X.lineTo(i * 36 + 18, 14); X.arc(i * 36, 14, 18, 0, Math.PI); X.closePath(); X.fillStyle = i % 2 ? '#fff3d0' : '#e8434f'; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
  const px = 330; plate(px, 136, 0);
  customer(px, 84, 2, role === 1 && u > 2.6 ? 1 : 0, tt, null);
  X.fillStyle = '#e8a35c'; rr(-10, 130, 540, 26, 6); X.fill(); X.strokeStyle = INK; X.lineWidth = 7; X.stroke(); rr(-10, 130, 540, 26, 6); ink('#e8a35c', 3.5); plate(px, 136, 0);
  if (role === 0) {
    rr(30, 172, 130, 58, 12); ink('#5a5a6e', 3.5); arepaPlain(70, 200, 22, true); arepaPlain(120, 200, 22, true);
    const ax = lerp(70, px, k), ay = lerp(200, 128, k) - Math.sin(k * Math.PI) * 14;
    if (u < 2.4) arepaPlain(ax, ay, 22, true); else arepaPlain(px, 128, 24, true);
    rr(rrx(), 6, 100, 54, 8); ink('#fff8e0', 3); fillIcon(1, rrx() + 50, 26, .9); txt('REINA PEPIADA', rrx() + 50, 50, 11, INK, 'center', 90);
    DUO.demoFinger(ax + 4, ay + 18, u < 2.4, u % 1);
    badge('READ OUT THE ORDERS!', 260, 224, 14, '#c98a12', '#fff', 1, -.02);
  } else {
    rr(250, 172, 250, 58, 12); ink('#e8434f', 3.5);
    for (let j = 0; j < 3; j++) { fillIcon([1, 3, 0][j], 290 + j * 80, 190, 1); }
    arepaPlain(px, 128, 24, true);
    const fx = lerp(370, px, k), fy = lerp(190, 120, k) - Math.sin(k * Math.PI) * 14;
    if (u < 2.4) fillIcon(3, fx, fy, 1.2); else if (u < 3.1) arepaFull(px, 116 - (u - 2.4) * 40, 24, FC[3], (u - 2.4) * 6, 0);
    DUO.demoFinger(fx + 4, fy + 22, u < 2.4, u % 1);
    circ2(px - 70, 70, 20, '#fff', 3); txt('?', px - 70, 71, 28, '#2b9ee6', 'center', 22);
    badge('ASK WHAT THEY WANT!', 260, 224, 14, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
  function rrx() { return 130; }
}
DUO.INFO.du_arepera = [['THE GRIDDLE', 'READ THE ORDERS, PASS THE AREPAS', 'DRAG AN AREPA TO A PLATE'], ['THE COUNTER', 'STUFF EACH AREPA AS ASKED', 'DRAG A FILLING ONTO AN AREPA']];
DUO.DEMOS.du_arepera = [t => demo(0, t), t => demo(1, t)];

})();
