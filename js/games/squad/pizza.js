'use strict';
/* ═════════ SQUAD · PIZZA RUSH (sq_pizza), 3-4 players ═════════
   A tiny king (so small he stands on three phone books, with a crown bigger than his head) has ordered NEED pizzas and is tapping his foot.
   One pizza at a time rides a conveyor through the kitchen and every seat is a station with its OWN verb:
     DOUGH   tap on the beat (3 hits) to toss the dough          SAUCE    trace a spiral with the ladle
     TOPPINGS  tap the glowing spot (4 hits)                      OVEN     hold to heat, release in the green zone
   With 3 seats SAUCE and TOPPINGS are one station (spiral, then 3 toppings). The OVEN seat is the JUDGE.
   A pizza only moves on when its station is done: a flopped toss / a missed topping / a raw release only cost time, a burnt pizza is
   lost (the king never sees it). DOUGH may only start a pizza while fewer than CAP are in flight, so a slow seat visibly backs the line up.
   Netcode: every seat OWNS its station and only publishes results. 'd' {i, s}: pizza i finished station s (everybody renders the line from
   these, ordered with max()). 'o' {k, i, s, b}: the oven's verdict on pizza i (k 1 = served, 0 = burnt) with the running counts: only the
   oven (the judge) counts, so two screens can never disagree. 'h' {v, a} (latest): oven heat, so the other seats see the door glow.
   'm' {k}: cosmetic mishap (the chef's face). Nothing ever blocks local input. The judge declares the win once NEED are served, the
   loss at the time limit. ═════════ */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

const NEED = 3, CAP = 4, MAXP = 10, HITS = 3;
const BELT = 262, CHEFY = 254;                              // pizza centre line on the belt; chefs' feet
const STX = { 3: [104, 300, 496], 4: [86, 232, 378, 524] };   // station x (the oven is a tunnel straddling the belt)
const KINDS = { 3: ['dough', 'st', 'oven'], 4: ['dough', 'sauce', 'tops', 'oven'] };
const KING = [752, 262], TOWER = [704, 262];               // the king's feet, and where the delivered pizza boxes stack
const PC = [400, 400], PR = 70;                            // the close-up pizza in the work panel
const SPOT = [[0, -42], [42, 0], [0, 42], [-42, 0], [0, 0]]; // topping spots: N E S W C (arrows / WASD + space)
const SPOTKEY = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3, Space: 4, Enter: 4 };
const DCOL = ['#FFC93C', '#6EA8FE', '#ff7ab6', '#5CFF7A'];
const SIGN = { dough: 'DOUGH', sauce: 'SAUCE', tops: 'TOPPINGS', st: 'SAUCE+TOPS', oven: 'OVEN' };
const TOPC = ['#d6343c', '#f1e4d3', '#3a3550', '#4fbf4a', '#ffd23f'];
const TOL = 26;                                            // sauce tolerance (px) around the spiral line

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function poly(pts) { X.beginPath(); pts.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.closePath(); }
/* cel shading: path(), inked and filled with the shade, then the base colour again shifted by (-sx, -sy) inside the clip: a crescent of shade stays */
function cel(path, base, shade, o = 4, sx = 4, sy = 4) {
  path(); ink(shade, o); X.save(); path(); X.clip(); X.translate(-sx, -sy); path(); X.fillStyle = base; X.fill(); X.restore();
}
function line(pts, w, col, under) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; if (under) { X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); } X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function pill(x, y, label, col, up, raw) {                  // a name tag with a little pointer (down, or up)
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = raw ? label : t(label), w = Math.min(150, X.measureText(s).width + 26), py = up ? -1 : 1;
  X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {         // a word on a chunky coloured badge
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(250, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 250);
  X.restore();
}
function keyCap(x, y, label) {                              // a white key cap (desktop only), centred on x
  X.font = '700 14px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.max(26, X.measureText(s).width + 16);
  rr(x - w / 2, y - 9, w, 18, 6); ink('#fff', 2.5); txt(label, x, y + 1, 14, INK, 'center', w - 8);
}
function heart(x, y, s, col) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink(col || '#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function zee(x, y, s, a) {
  X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
  X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.restore();
}
function sweat(x, y, T, k) { const a = (T * 1.6 + k) % 1; X.globalAlpha = 1 - a * a; el(x, y + a * 14, 3, 4.5); ink('#9fe3ff', 2); X.globalAlpha = 1; }
let CS = 29; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;   // cosmetic randomness: its own generator, never the seeded level

/* ───────────── food ───────────── */
function topping(k, x, y, s, rot) {                         // k: 0 pepperoni, 1 mushroom, 2 olive, 3 pepper, 4 cheese
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(s, s);
  if (k === 0) { X.beginPath(); X.arc(0, 0, 9, 0, TAU); ink('#d6343c', 2.5); X.fillStyle = '#ef6a5a'; el(-3, -3, 3, 2, -.5); X.fill(); X.fillStyle = '#b02530'; el(3, 3, 2, 1.5); X.fill(); }
  else if (k === 1) { X.beginPath(); X.rect(-3, 0, 6, 8); ink('#f1e4d3', 2); X.beginPath(); X.ellipse(0, 0, 10, 7, 0, Math.PI, 0); X.closePath(); ink('#d9b88f', 2.5); X.fillStyle = 'rgba(255,255,255,.55)'; el(-3, -3, 4, 1.8, -.3); X.fill(); }
  else if (k === 2) { X.beginPath(); X.arc(0, 0, 7, 0, TAU); ink('#3a3550', 2.5); X.beginPath(); X.arc(0, 0, 2.6, 0, TAU); X.fillStyle = '#fff3d0'; X.fill(); }
  else if (k === 3) { X.beginPath(); X.arc(0, 0, 7, .5, TAU - .5); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4.5; X.strokeStyle = '#5fd05a'; X.stroke(); }
  else { poly([[-7, 4], [0, -7], [8, 3], [2, 8]]); ink('#ffd23f', 2.5); X.fillStyle = '#fff3a8'; el(-1, -1, 2, 1.4); X.fill(); }
  X.restore();
}
/* a pizza lying on the belt, seen from the side: c = stages done decides what it wears */
function pizza(x, y, r, o) {                                // o: { sauce, tops, baked, burnt, i }
  X.save(); X.translate(x, y);
  const crust = o.burnt ? '#3a2a24' : o.baked ? '#e2992f' : '#f1d490', side = o.burnt ? '#241914' : o.baked ? '#b9711b' : '#d7ae60';
  el(0, 4, r, r * .5); ink(side, 3); el(0, 0, r, r * .5); ink(crust, 3);
  if (o.sauce || o.baked) { el(0, 0, r * .8, r * .4); X.fillStyle = o.burnt ? '#2a2220' : o.baked ? '#ffd24a' : '#e8434f'; X.fill(); if (o.baked && !o.burnt) { X.fillStyle = '#f5a623'; el(-r * .3, r * .06, r * .12, r * .06); X.fill(); el(r * .25, -r * .08, r * .1, r * .05); X.fill(); } }
  if (o.tops) for (let k = 0; k < 5; k++) { const a = o.i * 1.7 + k * 1.26, rad = r * (.18 + .3 * ((k * 7 + o.i * 3) % 5) / 5), tx = Math.cos(a) * rad, ty = Math.sin(a) * rad * .5; X.beginPath(); X.ellipse(tx, ty, r * .17, r * .1, 0, 0, TAU); ink(o.burnt ? '#14100c' : TOPC[(k + o.i) % 4], 1.8); }
  X.fillStyle = 'rgba(255,255,255,.4)'; el(-r * .35, -r * .22, r * .22, r * .06, -.2); X.fill();
  X.restore();
}
/* the close-up (top-down) pizza of the work panel. o: dough k (0..1 size), sauce/tops/baked flags, placed toppings */
function bigPizza(cx, cy, R, o) {
  X.save(); X.translate(cx, cy);
  el(0, 6, R, R * .96); X.fillStyle = 'rgba(20,16,28,.28)'; X.fill();
  const crust = o.burnt ? '#3a2a24' : o.baked ? '#e2992f' : '#eec47d', crustS = o.burnt ? '#241914' : o.baked ? '#b9711b' : '#d4a35a';
  cel(() => { X.beginPath(); X.arc(0, 0, R, 0, TAU); }, crust, crustS, 5, 5, 5);
  X.beginPath(); X.arc(0, 0, R * .84, 0, TAU); X.fillStyle = o.burnt ? '#2a2220' : o.baked ? '#ffd24a' : '#f8e3b0'; X.fill();
  if (o.sauceFull) { X.beginPath(); X.arc(0, 0, R * .8, 0, TAU); X.fillStyle = o.burnt ? '#2a2220' : o.baked ? '#ffd24a' : '#e8434f'; X.fill(); X.fillStyle = 'rgba(255,255,255,.25)'; el(-R * .3, -R * .35, R * .25, R * .1, -.5); X.fill(); }
  X.fillStyle = 'rgba(255,255,255,.4)'; el(-R * .5, -R * .55, R * .2, R * .06, -.7); X.fill();
  X.restore();
}
function spiralPt(cx, cy, k, dirv, turns, u) { const a = -Math.PI / 2 + dirv * TAU * turns * u, r = (56 - 48 * u) * k; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
function sauceStroke(cx, cy, k, dirv, turns, u, col) {      // the poured sauce up to u
  if (u <= 0) return; const pts = []; const st = Math.max(2, Math.ceil(u * 70));
  for (let q = 0; q <= st; q++) pts.push(spiralPt(cx, cy, k, dirv, turns, u * q / st));
  line(pts, 13 * k, col || '#e8434f', true); line(pts, 3 * k, 'rgba(255,255,255,.4)', false);
}
function ladle(x, y, tilt, pouring) {
  X.save(); X.translate(x, y); X.rotate(tilt);
  line([[0, 0], [34, -50]], 7, '#c9ced6', true);
  X.beginPath(); X.arc(0, 0, 13, 0, Math.PI); X.closePath(); ink('#d9d4ee', 3); X.fillStyle = pouring ? '#e8434f' : 'rgba(255,255,255,.4)'; el(0, 1, 9, 3); X.fill();
  X.restore();
}

/* ───────────── characters ───────────── */
function toque(x, y, u, T, k) {                             // the chef's hat sits on the head top (y = top of the head)
  const w = Math.sin(T * 2 + k) * .03;
  X.save(); X.translate(x, y); X.rotate(w);
  rr(-4.4 * u, -1.7 * u, 8.8 * u, 1.9 * u, .5 * u); ink('#f6f4fb', 2.5);
  for (const [px, py, r] of [[-2.4, -3.4, 2], [0, -4.2, 2.3], [2.4, -3.4, 2]]) { X.beginPath(); X.arc(px * u, py * u, r * u, 0, TAU); ink('#fff', 2.5); }
  rr(-4.4 * u, -1.7 * u, 8.8 * u, 1.9 * u, .5 * u); X.fillStyle = '#f6f4fb'; X.fill();
  X.fillStyle = 'rgba(200,205,225,.7)'; X.fillRect(-4 * u, -.3 * u, 8 * u, .45 * u);
  X.restore();
}
function chef(r, x, y, u, T, col, mood, bob, kind) {         // a Caos in an apron and a toque; mood: null | happy | sad
  const dy = bob || 0;
  X.save(); X.translate(0, dy);
  shadow(x, y + 1, 5.5 * u, 1.2 * u, .25);
  caos(x, y, u, { col, mood });
  rr(x - 4.6 * u, y - 4.6 * u, 9.2 * u, 3.7 * u, .8 * u); ink('#fff', 2.2); X.fillStyle = 'rgba(190,196,220,.8)'; X.fillRect(x - 4.2 * u, y - 1.7 * u, 8.4 * u, .5 * u);
  toque(x, y - 9 * u, u, T, r);
  X.restore();
}
function crown(x, y, u, T, spin) {                           // a crown that is far too big (u = the king's unit)
  X.save(); X.translate(x, y); X.rotate(spin || Math.sin(T * 1.7) * .03);
  poly([[-5.4 * u, 0], [-5.8 * u, -5.2 * u], [-3 * u, -2.6 * u], [0, -6.4 * u], [3 * u, -2.6 * u], [5.8 * u, -5.2 * u], [5.4 * u, 0]]); ink('#ffd23f', 3);
  X.fillStyle = '#ffb81c'; X.fillRect(-5.2 * u, -1.2 * u, 10.4 * u, 1.2 * u); X.fillStyle = 'rgba(255,255,255,.55)'; el(-2.6 * u, -2.4 * u, 1.6 * u, .5 * u, -.5); X.fill();
  for (const [px, py, c] of [[0, -4.2, '#e8434f'], [-3.6, -2.6, '#4DB8FF'], [3.6, -2.6, '#5CFF7A']]) { X.beginPath(); X.arc(px * u, py * u, .6 * u, 0, TAU); ink(c, 1.6); }
  X.restore();
}
/* the tiny king: mood 'wait' | 'grump' | 'steam' | 'happy' | 'rage'; y = feet. The cutter-sceptre is a pizza wheel. */
function king(x, y, u, T, mood, spin) {
  const happy = mood === 'happy', rage = mood === 'rage';
  X.save();
  poly([[x - 6.4 * u, y - 8.4 * u], [x + 6.4 * u, y - 8.4 * u], [x + 8 * u, y - 1 * u], [x - 8 * u, y - 1 * u]]); ink('#c9304a', 3);          // the cape behind
  poly([[x - 6.4 * u, y - 8.4 * u], [x + 6.4 * u, y - 8.4 * u], [x + 6.8 * u, y - 7 * u], [x - 6.8 * u, y - 7 * u]]); ink('#f6f4fb', 2.2);
  caos(x, y, u, { col: '#b69cff', mood: happy ? 'happy' : rage ? 'sad' : null });
  X.strokeStyle = INK; X.lineWidth = Math.max(2, u * .5); X.lineCap = 'round';                                                              // brows
  if (!happy) for (const sx of [-1, 1]) { const ex = x + sx * 2.8 * u, tilt = mood === 'wait' ? 0 : (mood === 'grump' ? .8 : 1.5) * -sx; X.beginPath(); X.moveTo(ex - 1.3 * u, y - 7.9 * u - tilt * .5 * u); X.lineTo(ex + 1.3 * u, y - 7.9 * u + tilt * .5 * u); X.stroke(); }
  X.beginPath(); X.moveTo(x - 2.2 * u, y - 4.6 * u); X.quadraticCurveTo(x - 1 * u, y - 3.5 * u, x, y - 4.4 * u); X.quadraticCurveTo(x + 1 * u, y - 3.5 * u, x + 2.2 * u, y - 4.6 * u); X.lineWidth = Math.max(3, u * .8); X.strokeStyle = '#4a3322'; X.stroke();   // moustache
  X.fillStyle = 'rgba(255,110,150,.55)'; el(x - 4.6 * u, y - 4.6 * u, 1.2 * u, .7 * u); X.fill(); el(x + 4.6 * u, y - 4.6 * u, 1.2 * u, .7 * u); X.fill();
  if (rage) { X.fillStyle = INK; X.beginPath(); X.ellipse(x, y - 3 * u, 1.6 * u, 1 * u + Math.abs(Math.sin(T * 25)) * .5 * u, 0, 0, TAU); X.fill(); }
  crown(x, y - 8.4 * u, u, T, spin);
  // the pizza-wheel sceptre
  line([[x + 7 * u, y - 1 * u], [x + 8.2 * u, y - 11 * u]], 2.4 * u, '#d9944f', true); X.beginPath(); X.arc(x + 8.2 * u, y - 12 * u, 2.2 * u, 0, TAU); ink('#e9edf5', 2.5);
  X.beginPath(); X.arc(x + 8.2 * u, y - 12 * u, .6 * u, 0, TAU); ink('#ffb81c', 1.4);
  X.restore();
  if (mood === 'steam' || rage) for (let i = 0; i < 2; i++) for (const sx of [-1, 1]) { const k = (T * 1.4 + i * .5 + (sx > 0 ? .25 : 0)) % 1; X.globalAlpha = (1 - k) * .85; X.beginPath(); X.arc(x + sx * (6.8 + k * 3) * u, y - 6 * u - k * 7 * u, (1.3 + k * 1.5) * u, 0, TAU); ink('#f6f4fb', 2); X.globalAlpha = 1; }
}

/* ───────────── the static scene, painted once per seat into an offscreen canvas ───────────── */
const BGC = {};
function buildBg(n, role) {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  const stx = STX[n], kinds = KINDS[n], kind = kinds[role];
  // wall: warm plaster over white subway tiles, an Italian flag trim between them
  let g = X.createLinearGradient(0, 0, 0, 130); g.addColorStop(0, '#ffd89a'); g.addColorStop(1, '#ffe7b8'); X.fillStyle = g; X.fillRect(0, 0, W, 130);
  X.fillStyle = 'rgba(200,120,70,.1)'; for (let x = 20; x < W; x += 70) X.fillRect(x, 0, 26, 130);
  X.fillStyle = '#fbf3e4'; X.fillRect(0, 126, W, 140);
  X.strokeStyle = 'rgba(176,140,100,.4)'; X.lineWidth = 2;
  for (let y = 148, r = 0; y < 266; y += 22, r++) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); for (let x = (r & 1) * 22; x < W; x += 44) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 22); X.stroke(); } }
  X.fillStyle = '#3fae5a'; X.fillRect(0, 112, W, 7); X.fillStyle = '#fff'; X.fillRect(0, 119, W, 7); X.fillStyle = '#e8434f'; X.fillRect(0, 126, W, 7);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 112); X.lineTo(W, 112); X.moveTo(0, 133); X.lineTo(W, 133); X.stroke();
  // the order rail the ticket hangs from
  rr(318, 62, 196, 8, 4); ink('#c9ced6', 3);
  // the king's alcove (a take-away hatch) with a striped awning
  rr(652, 144, 148, 160, 10); ink('#a5622c', 4);
  g = X.createLinearGradient(0, 160, 0, 290); g.addColorStop(0, '#7a2e4a'); g.addColorStop(1, '#b3475a'); X.fillStyle = g; rr(664, 160, 124, 130, 6); X.fill(); X.strokeStyle = INK; X.lineWidth = 4; X.stroke();
  X.fillStyle = 'rgba(255,214,120,.18)'; for (let x = 670; x < 786; x += 22) X.fillRect(x, 164, 9, 124);
  X.beginPath(); X.arc(726, 196, 22, 0, TAU); ink('#ffd98a', 3); X.fillStyle = '#fff3c4'; el(720, 190, 8, 4, -.5); X.fill();   // a little round window to the street... lit
  for (let i = 0; i < 6; i++) { rr(646 + i * 26, 128, 26, 36, 8); ink(i & 1 ? '#fff' : '#e8434f', 3); }                                   // awning
  X.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 6; i++) X.fillRect(652 + i * 26, 134, 8, 14);
  // three phone books under the king, a doormat of hearts
  rr(KING[0] - 28, KING[1] + 16, 56, 11, 3); ink('#2f7bd6', 3); rr(KING[0] - 26, KING[1] + 6, 52, 11, 3); ink('#e8434f', 3); rr(KING[0] - 24, KING[1] - 4, 48, 11, 3); ink('#ffd23f', 3);
  // the belt: housing, steel apron, rails
  rr(-12, 250, 686, 30, 4); ink('#3b3550', 4); X.fillStyle = '#5a5274'; for (let x = -4; x < 674; x += 22) X.fillRect(x, 262, 14, 4);
  rr(-12, 242, 686, 12, 4); ink('#c9ced6', 3.5); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(0, 245, 670, 3);
  X.fillStyle = '#cfd8e6'; X.fillRect(0, 280, W, 32); X.fillStyle = '#8f9cb3'; X.fillRect(0, 300, W, 12);
  for (let x = 0; x < W; x += 40) { X.fillStyle = (x / 40 & 1) ? '#ffd23f' : '#2a2436'; poly([[x, 306], [x + 20, 306], [x + 12, 312], [x - 8, 312]]); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 280); X.lineTo(W, 280); X.stroke();
  // the work counter (wood) and the cutting board the panel sits on
  g = X.createLinearGradient(0, 312, 0, 600); g.addColorStop(0, '#d9944f'); g.addColorStop(1, '#a8693a'); X.fillStyle = g; X.fillRect(0, 312, W, 288);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 312); X.lineTo(W, 312); X.stroke(); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(0, 316, W, 4);
  X.strokeStyle = 'rgba(110,60,25,.3)'; X.lineWidth = 2; for (const y of [352, 400, 452, 506]) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  rr(148, 322, 504, 226, 24); ink('#f1d09b', 4.5); X.fillStyle = '#e6b878'; rr(156, 330, 488, 210, 18); X.fill();
  X.strokeStyle = 'rgba(150,90,40,.28)'; X.lineWidth = 2; for (let y = 352; y < 540; y += 26) { X.beginPath(); X.moveTo(160, y); X.lineTo(640, y + 2); X.stroke(); }
  // per-station props on the line
  for (let r = 0; r < n; r++) {
    const k = kinds[r], x = stx[r];
    if (k === 'dough' || k === 'st') {
      const fx = k === 'st' ? x - 66 : x - 70;
      rr(fx, 214, 34, 38, 9); ink('#f4ead6', 3.5); rr(fx + 3, 207, 28, 11, 5); ink('#e3d7bc', 3); X.fillStyle = 'rgba(255,255,255,.7)'; el(fx + 10, 226, 6, 10, -.2); X.fill();
      X.beginPath(); X.arc(fx + 17, 234, 7, 0, TAU); ink('#ffd23f', 2); X.fillStyle = INK; X.fillRect(fx + 14, 233, 6, 2);
    }
    if (k === 'dough') { rr(x + 34, 236, 44, 16, 4); ink('#d9944f', 3); el(x + 56, 232, 14, 9); ink('#f6dfa6', 3); line([[x + 22, 246], [x + 40, 226]], 6, '#e3ac66', true); }
    if (k === 'sauce' || k === 'st') {
      const px = k === 'st' ? x + 62 : x + 54;
      cel(() => rr(px - 24, 212, 48, 40, 14), '#d98a4a', '#a8582c', 3.5, 5, 4);
      rr(px - 28, 206, 56, 11, 5); ink('#e9a866', 3); el(px, 207, 22, 4.5); ink('#e8434f', 2);
      line([[px + 10, 208], [px + 34, 180]], 5, '#c9ced6', true); X.beginPath(); X.arc(px + 36, 178, 8, 0, TAU); ink('#d9d4ee', 2.5);
    }
    if (k === 'tops') {
      rr(x + 20, 240, 70, 12, 4); ink('#d9944f', 3);
      [['#d6343c', 0], ['#f1e4d3', 1], ['#3a3550', 2]].forEach(([c, j]) => { rr(x + 24 + j * 22, 218, 20, 24, 4); ink('#fff', 3); X.fillStyle = c; X.beginPath(); X.arc(x + 34 + j * 22, 222, 6.5, 0, TAU); X.fill(); });
      X.fillStyle = 'rgba(255,255,255,.55)'; el(x + 28, 228, 3, 6, .3); X.fill();
    }
    if (k === 'oven') {                                       // a conveyor tunnel oven: brick dome behind the belt, a chimney, a dark mouth
      cel(() => { X.beginPath(); X.moveTo(x - 66, 252); X.lineTo(x - 66, 206); X.arc(x, 206, 66, Math.PI, 0); X.lineTo(x + 66, 252); X.closePath(); }, '#d96a42', '#aa4a2a', 4.5, 6, 5);
      X.save(); X.beginPath(); X.moveTo(x - 66, 252); X.lineTo(x - 66, 206); X.arc(x, 206, 66, Math.PI, 0); X.lineTo(x + 66, 252); X.closePath(); X.clip();
      X.strokeStyle = 'rgba(100,34,20,.35)'; X.lineWidth = 2; for (let y = 160, rw = 0; y < 252; y += 16, rw++) { X.beginPath(); X.moveTo(x - 70, y); X.lineTo(x + 70, y); X.stroke(); for (let bx = x - 70 + (rw & 1) * 16; bx < x + 70; bx += 32) { X.beginPath(); X.moveTo(bx, y); X.lineTo(bx, y + 16); X.stroke(); } }
      X.restore();
      rr(x + 30, 134, 26, 56, 4); ink('#8a8fa8', 3.5); rr(x + 26, 128, 34, 12, 4); ink('#b9bfd2', 3);
      X.beginPath(); X.moveTo(x - 36, 252); X.lineTo(x - 36, 228); X.arc(x, 228, 36, Math.PI, 0); X.lineTo(x + 36, 252); X.closePath(); ink('#1e1218', 4);
    }
  }
  // the role's own work panel props
  if (kind === 'dough') {
    X.fillStyle = 'rgba(255,255,255,.55)'; for (const [fx, fy, rx] of [[250, 470, 38], [540, 380, 30], [330, 520, 24], [470, 524, 28]]) { el(fx, fy, rx, rx * .45); X.fill(); }
    line([[184, 486], [250, 504]], 13, '#e3ac66', true); X.beginPath(); X.arc(182, 485, 8, 0, TAU); ink('#c4874e', 2.5); X.beginPath(); X.arc(254, 506, 8, 0, TAU); ink('#c4874e', 2.5);
    rr(560, 400, 62, 74, 12); ink('#f4ead6', 4); rr(566, 390, 50, 16, 6); ink('#e3d7bc', 3); X.fillStyle = 'rgba(255,255,255,.7)'; el(578, 428, 8, 16, -.2); X.fill();
    X.beginPath(); X.arc(591, 448, 12, 0, TAU); ink('#ffd23f', 2.5); X.fillStyle = INK; X.fillRect(585, 446, 12, 3);
  } else if (kind === 'sauce' || kind === 'st') {
    cel(() => rr(170, 380, 78, 76, 22), '#d98a4a', '#a8582c', 4.5, 7, 6); rr(164, 370, 90, 18, 8); ink('#e9a866', 4); el(209, 373, 36, 7); ink('#e8434f', 3);
    X.fillStyle = 'rgba(255,255,255,.45)'; el(190, 412, 6, 18, .2); X.fill();
    if (kind === 'sauce') for (let i = 0; i < 3; i++) { const cx = 560 + (i & 1) * 44, cy = 486 - i * 34 + (i & 1) * 0; rr(cx - 18, cy - 16, 36, 40, 7); ink('#e8434f', 3.5); X.fillStyle = '#fff'; X.fillRect(cx - 15, cy - 4, 30, 12); X.fillStyle = '#3fae5a'; X.fillRect(cx - 15, cy - 4, 30, 3); }
  }
  if (kind === 'tops' || kind === 'st') {
    const bins = kind === 'st' ? [[540, 380, 0], [592, 380, 1], [540, 436, 2], [592, 436, 3]] : [[184, 380, 0], [236, 380, 1], [534, 380, 2], [586, 380, 3]];
    for (const [bx, by, k] of bins) { rr(bx - 24, by - 20, 48, 40, 8); ink('#e3d7bc', 3.5); X.fillStyle = '#fffaf0'; rr(bx - 20, by - 14, 40, 28, 6); X.fill(); X.save(); X.beginPath(); X.rect(bx - 20, by - 14, 40, 28); X.clip(); for (let q = 0; q < 4; q++) topping(k, bx - 11 + (q % 2) * 22, by - 6 + (q >> 1) * 13, .85, q); X.restore(); }
  }
  if (kind === 'oven') {                                       // the oven's front: brick arch with a dark mouth, the gauge frame on the right
    cel(() => { X.beginPath(); X.moveTo(176, 542); X.lineTo(176, 452); X.arc(290, 452, 114, Math.PI, 0); X.lineTo(404, 542); X.closePath(); }, '#d96a42', '#aa4a2a', 4.5, 7, 6);
    X.save(); X.beginPath(); X.moveTo(176, 542); X.lineTo(176, 452); X.arc(290, 452, 114, Math.PI, 0); X.lineTo(404, 542); X.closePath(); X.clip();
    X.strokeStyle = 'rgba(100,34,20,.35)'; X.lineWidth = 2; for (let y = 344, rw = 0; y < 542; y += 20, rw++) { X.beginPath(); X.moveTo(170, y); X.lineTo(410, y); X.stroke(); for (let bx = 170 + (rw & 1) * 20; bx < 410; bx += 40) { X.beginPath(); X.moveTo(bx, y); X.lineTo(bx, y + 20); X.stroke(); } }
    X.restore();
    rr(552, 340, 56, 166, 20); ink('#e9edf5', 4.5);
  }
  X = old; return cv2;
}

/* ═════════ the game ═════════ */
function duPizza(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), TS = Math.sqrt(sp), role = D.role, n = D.roles >= 4 ? 4 : 3, S = n, kinds = KINDS[n], kind = kinds[role], stx = STX[n], JR = n - 1;
  /* the level (the same draws on every seat): oven target zone per pizza, spiral direction per pizza, the glow sequence of the toppings, one rare extra */
  const zc = Array.from({ length: MAXP }, () => .5 + R() * .22);
  const dirs = Array.from({ length: MAXP }, () => R() < .5 ? 1 : -1);
  const litSeq = []; for (let k = 0, p = -1; k < 90; k++) { let s = Math.floor(R() * 5); if (s === p) s = (s + 1) % 5; litSeq.push(s); p = s; }
  const rare = R() < 1 / 8;                                         // the king wears a rubber duck on his crown
  const bp = .5 / TS, HW = bp * .22, TURNS = n === 4 ? 1.5 : 1.1, HT = n === 4 ? 4 : 3, LIFE = 1.6 / TS, ZW = .11, HEATR = TS / 1.4;
  const colOf = r => (D.byRole && D.byRole[r] && D.byRole[r].color) || DCOL[r];
  const nameOf = r => r === role ? 'YOU' : ((D.byRole && D.byRole[r] && D.byRole[r].name) || 'P' + (r + 1));
  const chefX = r => kinds[r] === 'oven' ? stx[r] + 78 : stx[r];
  const key = n + '/' + role;

  const pz = [], act = kinds.map(() => ({ ok: -9, bad: -9 })), bits = [];
  let served = 0, burnt = 0, lastDone = -9, resAt = -1, ending = null, kingHop = -9, pop = null, flopAt = -9, fullAt = -9, tick = -1, heatNet = 0, armedNet = false, hAt = -9, lastHeat = -1, pourSnd = -9;
  const ws = { i: -1, prog: 0, ph: 0, lock: 0, lit: -1, litAt: 0, nextLit: 0, litIdx: 0, heat: 0, armed: false, bake: -9, lastBeat: -1, dir: 1, placed: [], hold: 0 };
  let ptr = null, ptrDown = false, kx = 0, ky = 0, kc = [PC[0], PC[1]], keyPour = false, ptrSeen = false, pressAt = -9, tossAt = -9, dropFx = [];
  const mkP = (i, x0) => ({ i, c: 0, dead: false, x: x0, yo: 0, recv: g.c, doneAt: -9, burnAt: -9 });
  const inflight = () => pz.length - served - burnt, canDough = () => pz.length < MAXP && inflight() < CAP;
  const head = () => { for (let i = 0; i < pz.length; i++) { const p = pz[i]; if (p && !p.dead && p.c === role) return i; } return -1; };
  function sync() {
    const i = kind === 'dough' ? (canDough() ? pz.length : -1) : head();
    if (i !== ws.i) { ws.i = i; ws.prog = 0; ws.ph = 0; ws.lit = -1; ws.nextLit = g.c + .35; ws.placed = []; ws.armed = false; ws.lock = Math.max(ws.lock, 0); ws.dir = i >= 0 ? dirs[i % MAXP] : 1; ws.lastBeat = -1; dropFx = []; kc = [PC[0], PC[1] - 56]; }
  }
  const ready = () => ws.i >= 0 && !g.result && g.c > .3 && (kind === 'dough' || g.c - pz[ws.i].recv > .3);
  const sauceNow = () => kind === 'sauce' || (kind === 'st' && ws.ph === 0), topsNow = () => kind === 'tops' || (kind === 'st' && ws.ph === 1);
  function say(s, bg, x, y) { pop = { s, bg, x: x === undefined ? 400 : x, y: y === undefined ? 300 : y, t0: g.c, rot: (cr() - .5) * .14 }; }
  function spawn(x, y, col, nb, sp0, life) { for (let q = 0; q < nb; q++) bits.push({ x, y, vx: (cr() - .5) * 2 * (sp0 || 120), vy: -(40 + cr() * (sp0 || 120)), r: 2 + cr() * 3, c: col, t0: g.c, life: life || .6 }); }
  function done() {                                                  // my station finished the pizza: pass it on
    const i = ws.i; if (i < 0) return; let p = pz[i];
    if (kind === 'dough') { p = pz[i] = mkP(i, stx[0] - 6); p.yo = 54; tossAt = g.c; sfx.whoosh(true); snd(660, .12, 'triangle', .05, .08); }
    p.c = role + 1; p.recv = g.c; act[role].ok = g.c; D.send('d', { i, s: role }); snd(880, .08, 'triangle', .05); snd(1320, .12, 'triangle', .04, .07);
    say(kind === 'dough' ? 'TOSSED!' : kind === 'oven' ? 'DING!' : kind === 'sauce' ? 'SAUCY!' : 'YUM!', '#ff4d9e', 400, 330);
    spawn(PC[0], PC[1], kind === 'dough' ? '#fff' : '#ffd23f', 12, 160, .7); sync();
  }
  /* ───── DOUGH: tap on the beat ───── */
  function tapDough() {
    if (g.result || g.c < .3) return;
    if (ws.i < 0) { if (g.c - fullAt > .5) { fullAt = g.c; say('LINE FULL!', '#e8434f', 400, 330); sfx.buzz(); } return; }
    if (ws.lock > 0) return;
    const k = Math.round(g.c / bp), d = Math.abs(g.c - k * bp); pressAt = g.c;
    if (d < HW) { if (k === ws.lastBeat) return; ws.lastBeat = k; ws.prog++; sfx.pop(); spawn(PC[0], PC[1] + 10, '#fff', 8, 150, .5); if (ws.prog >= HITS) done(); }
    else { ws.prog = Math.max(0, ws.prog - 1); ws.lock = .2; flopAt = g.c; act[role].bad = g.c; D.send('m', 0); sfx.miss(); say('FLOP!', '#8f88a6', 400, 330); }
  }
  /* ───── SAUCE: trace the spiral with the ladle ───── */
  const sp0 = u => spiralPt(PC[0], PC[1], 1, ws.dir, TURNS, u);
  function trace() {
    if (!ready() || !sauceNow() || !ptr || !(ptrDown || keyPour)) return;
    let best = -1; for (let k = 0; k <= 9; k++) { const u = ws.prog + k * .022; if (u > 1) break; const [x, y] = sp0(u); if (Math.hypot(ptr[0] - x, ptr[1] - y) < TOL) best = u; }
    if (best > ws.prog) {
      ws.prog = best; if (g.c - pourSnd > .08) { pourSnd = g.c; noise(.06, .035, 500 + best * 900, 700 + best * 900, 'bandpass', 0, 2); }
      if (best >= .955) { ws.prog = 1; if (kind === 'sauce') done(); else { ws.ph = 1; ws.nextLit = g.c + .3; ws.prog = 0; ws.placed = []; sfx.coin(); say('SAUCY!', '#e8434f', 400, 330); spawn(PC[0], PC[1], '#e8434f', 14, 160, .6); } }
    }
  }
  /* ───── TOPPINGS: tap the glowing spot ───── */
  function tapSpot(s) {
    if (!ready() || !topsNow() || ws.lock > 0 || s < 0) return;
    if (ws.lit < 0) return;                                           // nothing glowing yet: ignore (no penalty)
    pressAt = g.c;
    if (s === ws.lit) {
      dropFx.push({ k: s, at: g.c, rot: (cr() - .5) * 1.2 }); ws.lit = -1; ws.nextLit = g.c + .12; sfx.pop(); snd(500 + ws.prog * 120, .06, 'triangle', .05);
      ws.prog++; if (ws.prog >= HT) { ws.pend = g.c + .16; }
    } else { ws.lock = .3; dropFx.push({ k: s, at: g.c, rot: 0, bad: true }); act[role].bad = g.c; D.send('m', 0); sfx.miss(); say('OOPS!', '#8f88a6', 400, 330); }
  }
  const spotAt = p => { let b = -1, bd = 1e9; SPOT.forEach(([dx, dy], k) => { const d = Math.hypot(p.x - PC[0] - dx, p.y - PC[1] - dy); if (d < bd) { bd = d; b = k; } }); return bd < 62 ? b : -1; };
  /* ───── OVEN: hold to heat, release in the green zone ───── */
  const zone = () => { const c = zc[(ws.i < 0 ? 0 : ws.i) % MAXP]; return [c - ZW, c + ZW]; };
  function pressOven() {
    if (g.result || g.c < .3) return; pressAt = g.c;
    if (!ready() || ws.lock > 0 || ws.bake > g.c - .55) { if (ws.i < 0 && g.c - fullAt > .5) { fullAt = g.c; say('NO PIZZA!', '#8f88a6', 400, 330); sfx.click(); } return; }
    ws.armed = true;
  }
  function releaseOven() {
    if (!ws.armed) return; ws.armed = false; const h = ws.heat, [lo, hi] = zone(), p = pz[ws.i];
    if (g.result || !p) return;
    if (h < lo) { ws.lock = .5; flopAt = g.c; act[role].bad = g.c; D.send('m', 0); sfx.miss(); say('RAW!', '#8aa0d8', 400, 330); }
    else if (h <= hi) {
      p.c = S; p.doneAt = g.c; served++; lastDone = g.c; kingHop = g.c + .9; ws.bake = g.c; act[role].ok = g.c; D.send('o', { k: 1, i: p.i, s: served, b: burnt });
      sfx.coin(); sfx.sparkle(); snd(2093, .5, 'sine', .07); say(h > (lo + hi) / 2 - .035 && h < (lo + hi) / 2 + .035 ? 'PERFECT!' : 'DING!', '#ffd23f', 400, 330); spawn(PC[0], PC[1], '#ffd23f', 16, 200, .8); sync();
    } else burn();
  }
  function burn() {
    const p = pz[ws.i]; ws.armed = false; if (!p) return;
    p.dead = true; p.burnAt = g.c; burnt++; ws.lock = .7; ws.bake = g.c; act[role].bad = g.c; D.send('o', { k: 0, i: p.i, s: served, b: burnt });
    sfx.buzz(); shake(6, .2); say('BURNT!', '#4a3f68', 400, 330); spawn(PC[0], PC[1], '#2a2436', 18, 220, .9); sync();
  }

  const g = {
    c: 0, dur: 18, pts: 0,
    cmd: { dough: 'TOSS!', sauce: 'POUR!', tops: 'DROP!', st: 'DRESS!', oven: 'BAKE!' }[kind], roleLabel: SIGN[kind],
    hint: {
      dough: 'TAP / CLICK / SPACE ON THE BEAT: 3 HITS TOSS THE DOUGH - DON\'T LET THE LINE BACK UP!',
      sauce: 'HOLD THE MOUSE (OR ARROWS) AND TRACE THE SAUCE SPIRAL FROM THE ARROW INWARD',
      tops: 'TAP THE GLOWING SPOT (CLICK, OR ARROWS / WASD + SPACE) TO DROP A TOPPING',
      st: 'TRACE THE SAUCE SPIRAL (HOLD MOUSE / ARROWS), THEN TAP THE GLOWING SPOTS (CLICK, ARROWS + SPACE)',
      oven: 'HOLD CLICK / SPACE TO HEAT THE PIZZA - LET GO IN THE GREEN ZONE! TOO LATE AND IT BURNS',
    }[kind],
    thint: {
      dough: 'TAP ON THE BEAT: 3 HITS TOSS THE DOUGH - DON\'T LET THE LINE BACK UP!',
      sauce: 'DRAG YOUR FINGER ALONG THE SAUCE SPIRAL, FROM THE ARROW INWARD',
      tops: 'TAP THE GLOWING SPOT TO DROP A TOPPING',
      st: 'DRAG ALONG THE SAUCE SPIRAL, THEN TAP THE GLOWING SPOTS',
      oven: 'HOLD TO HEAT THE PIZZA - LET GO IN THE GREEN ZONE! TOO LATE AND IT BURNS',
    }[kind],
    update(dt) {
      g.c += dt; ws.lock = Math.max(0, ws.lock - dt); sync();
      if (g.result && resAt < 0) { resAt = g.c; ws.armed = false; if (g.result === 'lose') { sfx.thud(); noise(.5, .07, 900, 200, 'lowpass', .1); } else { sfx.sparkle(); } }
      // the beat tick (only DOUGH is playing the rhythm, the others just hear it far away)
      if (kind === 'dough' && !g.result && g.c > .2) { const k = Math.floor(g.c / bp); if (k !== tick) { tick = k; snd(300, .03, 'sine', .028); } }
      if (ready()) {
        if (sauceNow() && (kx || ky)) { kc[0] = clamp(kc[0] + kx * 330 * dt, 150, 650); kc[1] = clamp(kc[1] + ky * 330 * dt, 330, 540); ptr = kc; }
        trace();
        if (topsNow()) {
          if (ws.pend && g.c >= ws.pend) { ws.pend = 0; done(); }
          else if (!ws.pend) {
            if (ws.lit < 0 && g.c >= ws.nextLit) { ws.lit = litSeq[ws.litIdx++ % litSeq.length]; ws.litAt = g.c; snd(700, .04, 'sine', .04); }
            else if (ws.lit >= 0 && g.c - ws.litAt > LIFE) { ws.lit = -1; ws.nextLit = g.c + .15; sfx.click(); }
          }
        }
        if (kind === 'oven') {
          if (ws.armed) { ws.heat += HEATR * dt; if (g.c % .12 < dt) snd(180 + ws.heat * 260, .05, 'sawtooth', .02); if (ws.heat > zone()[1] + .12) burn(); }
          else ws.heat = Math.max(0, ws.heat - 1.6 * dt);
          const hv = Math.round(ws.heat * 50) / 50; if ((hv !== lastHeat || ws.armed !== armedNet) && g.c - hAt >= .1) { hAt = g.c; lastHeat = hv; armedNet = ws.armed; D.send('h', { v: Math.round(ws.heat * 100), a: ws.armed ? 1 : 0 }, true); }
        }
      } else if (kind === 'oven') ws.heat = Math.max(0, ws.heat - 1.6 * dt);
      // the line: queue positions, tweened
      const cnt = [];
      for (let i = 0; i < pz.length; i++) {
        const p = pz[i]; if (!p) continue; p.yo *= Math.exp(-dt * 8);
        if (p.dead || p.c >= S || p.c < 1) continue;
        const c = p.c, idx = cnt[c] = (cnt[c] || 0) + 1, tx = stx[c] - (idx - 1) * 36;
        p.x += (tx - p.x) * Math.min(1, dt * 7);
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += 760 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pop && g.c - pop.t0 > .95) pop = null;
      // the judge (the OVEN seat): all served -> win after the last pizza reaches the king; the clock -> lose
      if (g.judge && !g.result) {
        if (served >= NEED && !ending) ending = { at: lastDone + 1.0 };
        if (ending) { if (g.c >= Math.min(ending.at, g.limit + .3)) g.finish('win'); }
        else if (g.c >= g.limit) g.finish('lose');
      }
    },
    msg(type, d, from) {
      if (!d && d !== 0) return;
      if (type === 'd') {
        const i = d.i; if (!(i >= 0 && i < MAXP) || d.s < 0 || d.s >= S - 1) return;
        const p = pz[i] = pz[i] || mkP(i, stx[d.s]); if (p.c < d.s + 1) { p.c = d.s + 1; p.recv = g.c; }
        if (d.s === 0 && p.yo === 0) p.yo = 54;
        if (act[d.s]) act[d.s].ok = g.c;
      } else if (type === 'o') {
        const i = d.i; if (!(i >= 0 && i < MAXP)) return;
        const p = pz[i] = pz[i] || mkP(i, stx[S - 1]);
        served = Math.max(served, d.s); burnt = Math.max(burnt, d.b);
        if (d.k) { p.c = S; p.doneAt = g.c; kingHop = g.c + .9; lastDone = g.c; act[S - 1].ok = g.c; } else { p.dead = true; p.burnAt = g.c; act[S - 1].bad = g.c; sfx.buzz(); shake(4, .15); }
      } else if (type === 'h') { heatNet = d.v / 100; armedNet = !!d.a; hAt = g.c; }
      else if (type === 'm') { if (act[from]) act[from].bad = g.c; }
    },
    down(p) {
      if (g.result) return; ptr = [p.x, p.y]; ptrSeen = true; ptrDown = true;
      if (kind === 'dough') tapDough(); else if (kind === 'oven') pressOven();
      else if (sauceNow()) trace(); else if (topsNow() && p.y > 322) tapSpot(spotAt(p));
    },
    move(p) { if (g.result) return; ptr = [p.x, p.y]; ptrSeen = true; if (ptrDown) trace(); },
    up() { ptrDown = false; if (kind === 'oven') releaseOven(); },
    key(e) {
      if (e.repeat || !e.code || g.result) return;
      if (kind === 'dough') { if (e.code === 'Space' || e.code === 'Enter' || e.code in SPOTKEY || e.code === 'KeyZ' || e.code === 'KeyX') tapDough(); }
      else if (kind === 'oven') { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS') pressOven(); }
      else if (sauceNow()) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; else if (e.code === 'ArrowUp' || e.code === 'KeyW') ky = -1; else if (e.code === 'ArrowDown' || e.code === 'KeyS') ky = 1; else if (e.code === 'Space') { keyPour = true; return; } else return;
        keyPour = true; ptr = kc; ptrSeen = true;
      } else if (topsNow() && e.code in SPOTKEY) tapSpot(SPOTKEY[e.code]);
    },
    keyup(e) {
      if (kind === 'oven') { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS') releaseOven(); return; }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } else if (e.code === 'ArrowUp' || e.code === 'KeyW') { if (ky < 0) ky = 0; } else if (e.code === 'ArrowDown' || e.code === 'KeyS') { if (ky > 0) ky = 0; } else if (e.code === 'Space') keyPour = !!(kx || ky) ? keyPour : false;
      if (!kx && !ky && e.code !== 'Space') keyPour = false;
    },
    draw() {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1, LIM = g.limit || 17;
      if (!BGC[key]) BGC[key] = buildBg(n, role); X = ctx; X.drawImage(BGC[key], 0, 0);
      const waiting = [];                                            // pizzas queued per station (the line backing up)
      for (const p of pz) if (p && !p.dead && p.c >= 1 && p.c < S) waiting[p.c] = (waiting[p.c] || 0) + 1;
      const frac = clamp(T / LIM, 0, 1), kmood = won ? 'happy' : lost ? 'rage' : frac > .68 && served < NEED ? 'steam' : frac > .34 && served < NEED ? 'grump' : 'wait';
      // ── the wall: clock, salami, the order ticket, bunting
      drawWall(T, frac, rk, won);
      // ── the king in his alcove
      const hop = T < kingHop && T > kingHop - .5 ? Math.abs(Math.sin((kingHop - T) / .5 * Math.PI)) * 0 : 0;
      const kh = T - (kingHop - .9); const hopY = kh > 0 && kh < .5 ? -Math.sin(kh / .5 * Math.PI) * 18 : 0;
      const kfoot = won ? -Math.abs(Math.sin(rk * 8)) * 26 - 12 : lost ? Math.sin(rk * 40) * 2.5 : kmood === 'wait' ? 0 : Math.abs(Math.sin(T * (kmood === 'steam' ? 9 : 5))) * (kmood === 'steam' ? 5 : 2.5);
      king(KING[0], KING[1] + kfoot + hopY, won ? 3.5 + Math.min(rk, .3) / .3 * .9 : 3.5, T, kmood, won ? Math.sin(rk * 10) * .5 : 0);
      if (rare) { el(KING[0] - 2, KING[1] - 36 + kfoot, 9, 7); ink('#ffd23f', 2.5); X.fillStyle = '#ff8a3d'; poly([[KING[0] - 12, KING[1] - 36 + kfoot], [KING[0] - 20, KING[1] - 34 + kfoot], [KING[0] - 12, KING[1] - 32 + kfoot]]); X.fill(); X.fillStyle = INK; el(KING[0] - 6, KING[1] - 39 + kfoot, 1.4, 1.6); X.fill(); }
      // the pizza boxes (served pizzas) stacked next to him
      let del = 0; for (const p of pz) if (p && !p.dead && p.c >= S && T - p.doneAt >= 1.0) del++;
      for (let k = 0; k < del; k++) { rr(TOWER[0] - 24, TOWER[1] + 6 - 10 * (k + 1), 48, 10, 2); ink(k & 1 ? '#fff' : '#f1d0a0', 2.5); X.fillStyle = '#e8434f'; X.fillRect(TOWER[0] - 6, TOWER[1] + 8 - 10 * (k + 1), 12, 4); }
      // ── the stations: chefs (behind the belt), signs, name tags
      for (let r = 0; r < S; r++) drawChef(r, T, waiting, won, lost, rk, frac);
      // ── the oven: the door over the mouth
      drawOven(T, won, lost);
      // ── the belt
      X.save(); X.beginPath(); X.rect(0, 252, 672, 26); X.clip(); X.fillStyle = '#4a4262'; X.fillRect(0, 252, 672, 26); X.fillStyle = '#5f5680'; const off = (lost || won ? 0 : T * 46) % 22; for (let x = -22 + off; x < 672; x += 22) X.fillRect(x, 270, 12, 6); X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(0, 252, 672, 4); X.restore();
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 278); X.lineTo(672, 278); X.stroke();
      // ── pizzas on the belt
      for (const p of pz) {
        if (!p) continue;
        if (p.dead) { const a = T - p.burnAt; if (a < 1.3) { const k = a / 1.3, px = stx[S - 1] - 20 - k * 60, py = BELT - Math.sin(Math.min(1, k * 1.2) * Math.PI) * 150 + k * 60; X.globalAlpha = 1 - k * k; X.save(); X.translate(px, py); X.rotate(k * 9); pizza(0, 0, 21, { sauce: 1, tops: 1, burnt: 1, i: p.i }); X.restore(); X.globalAlpha = 1; if (a < .9) for (let q = 0; q < 2; q++) { X.globalAlpha = .6 * (1 - a); X.beginPath(); X.arc(px + Math.sin(T * 9 + q) * 8, py - 14 - q * 10 - a * 30, 7 + q * 3 + a * 6, 0, TAU); ink('#7d7690', 2); X.globalAlpha = 1; } } continue; }
        if (p.c >= S) {
          const a = T - p.doneAt, ox = stx[S - 1], hx = TOWER[0] - 0;
          if (a >= 1.0) continue;
          if (a < .5) { if (T - ws.bake < .5 && kind === 'oven' || a < .5) drawPizzaAt(p, ox, BELT, 21, a < .5 && ovenBusy(T, p) ? 0 : 1); }
          else { const k = ease((a - .5) / .5), px = lerp(ox, hx, k), py = BELT - Math.sin(k * Math.PI) * 60 - k * 10; drawPizzaAt(p, px, py, 21, 1, k * 6.28 * 0 + k * .3); }
          continue;
        }
        if (p.c < 1) continue;
        drawPizzaAt(p, p.x, BELT - p.yo, 21, 1);
      }
      // ── the line backing up: steam and "!" over the station that has the queue
      for (let c = 1; c < S; c++) if ((waiting[c] || 0) >= 2 && !g.result) { const x = stx[c] - 4, bb = Math.abs(Math.sin(T * 8)) * 4; badge('!', x, 224 - bb, 18, '#e8434f', '#fff', 1, 0); }
      if (kind !== 'dough' || true) { const full = inflight() >= CAP && pz.length > 0 && !g.result; if (full) badge('LINE FULL!', stx[0] + 4, 224 - Math.abs(Math.sin(T * 8)) * 4, 17, '#e8434f', '#fff', 1, -.05); }
      for (const b of bits) { X.globalAlpha = clamp(1 - (T - b.t0) / b.life, 0, 1); X.fillStyle = b.c; X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); X.fill(); } X.globalAlpha = 1;
      // ── the work panel (the part you play)
      drawPanel(T, won, lost, rk);
      if (pop) { const a = T - pop.t0; X.globalAlpha = a > .65 ? Math.max(0, 1 - (a - .65) / .3) : 1; badge(pop.s, pop.x, pop.y - Math.min(a, .5) * 14, 26, pop.bg, '#fff', a < .2 ? outBack(a / .2) : 1, pop.rot); X.globalAlpha = 1; }
      drawEnd(T, won, lost, rk);
      vignette(.14);
    },
  };
  function drawPizzaAt(p, x, y, r, show, rot) {
    if (!show) return;
    const o = { sauce: p.c >= (n === 4 ? 2 : 2), tops: p.c >= (n === 4 ? 3 : 2), baked: p.c >= S, burnt: false, i: p.i };
    if (rot) { X.save(); X.translate(x, y); X.rotate(rot); pizza(0, 0, r, o); X.restore(); } else pizza(x, y, r, o);
  }
  function ovenBusy(T, p) { return T - p.doneAt < .5; }
  function drawWall(T, frac, rk, won) {
    // the pizza clock: one slice vanishes at a time while the king waits
    const cx = 598, cy = 92, left = 8 - Math.floor(frac * 8 + .001);
    X.beginPath(); X.arc(cx, cy, 33, 0, TAU); ink('#eec47d', 4); X.beginPath(); X.arc(cx, cy, 27, 0, TAU); X.fillStyle = '#4a3f68'; X.fill();
    for (let s = 0; s < 8; s++) if (s < left) { const a0 = -Math.PI / 2 + s * TAU / 8 + .03, a1 = a0 + TAU / 8 - .06; X.beginPath(); X.moveTo(cx, cy); X.arc(cx, cy, 26, a0, a1); X.closePath(); X.fillStyle = frac > .75 ? '#ff8a6a' : '#ffd24a'; X.fill(); X.strokeStyle = '#e8434f'; X.lineWidth = 2; X.stroke(); const m = (a0 + a1) / 2; X.beginPath(); X.arc(cx + Math.cos(m) * 15, cy + Math.sin(m) * 15, 3.4, 0, TAU); ink('#d6343c', 1.2); }
    X.beginPath(); X.arc(cx, cy, 4, 0, TAU); ink('#fff', 1.5);
    // the salami on a string, swinging
    const sa = Math.sin(T * 1.6) * .16; X.beginPath(); X.arc(548, 66, 4, 0, TAU); ink('#c9ced6', 2); X.save(); X.translate(548, 66); X.rotate(sa); line([[0, 0], [0, 22]], 2.5, '#c9a36a', false); rr(-8, 20, 16, 40, 8); ink('#c3463c', 3); X.fillStyle = '#f6c9b8'; for (const dy of [28, 38, 48]) { X.beginPath(); X.arc(-2 + (dy & 1) * 3, dy, 2, 0, TAU); X.fill(); } X.restore();
    // the cat that lives on the awning
    const lie = !won && !g.result; const ty = 128;
    X.save(); X.translate(700, ty);
    el(0, -9, 20, 11); ink('#9aa2c4', 3); X.fillStyle = '#7d86ad'; el(5, -6, 10, 6, .2); X.fill();
    X.beginPath(); X.arc(-17, -14, 10, 0, TAU); ink('#9aa2c4', 3); poly([[-23, -22], [-21, -31], [-16, -23]]); ink('#9aa2c4', 2.5); poly([[-13, -23], [-9, -30], [-8, -21]]); ink('#9aa2c4', 2.5);
    const open = g.result === 'lose' || (frac > .6 && !won); X.strokeStyle = INK; X.lineWidth = 2.4; X.lineCap = 'round';
    if (open) { X.fillStyle = '#fff'; el(-20, -15, 3, 3.4); X.fill(); el(-13, -15, 3, 3.4); X.fill(); X.fillStyle = INK; el(-20, -15, 1.4, 1.8); X.fill(); el(-13, -15, 1.4, 1.8); X.fill(); }
    else { X.beginPath(); X.moveTo(-23, -15); X.quadraticCurveTo(-20, -12, -17, -15); X.moveTo(-16, -15); X.quadraticCurveTo(-13, -12, -10, -15); X.stroke(); }
    X.beginPath(); X.moveTo(20, -8); X.quadraticCurveTo(34, -10 + Math.sin(T * 3) * 6, 32, -26 + Math.sin(T * 3) * 6); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#7d86ad'; X.stroke();
    X.restore(); if (!open && !won) { const k = (T * .5) % 1; zee(682 + k * 8, 100 - k * 22, .6 + k * .3, Math.sin(k * Math.PI)); }
    // the order ticket: NEED slots, filled as pizzas reach the king
    X.save(); X.translate(416, 66); X.rotate(Math.sin(T * 1.3) * .015);
    rr(-84, 4, 168, 66, 5); ink('#fffdf5', 3.5); X.fillStyle = '#e8434f'; X.fillRect(-80, 8, 160, 4); X.fillStyle = 'rgba(190,196,220,.8)'; for (let q = 0; q < 3; q++) X.fillRect(-72, 14 + q * 0, 0, 0);
    txt('ORDER', -46, 24, 17, INK, 'center', 80); X.beginPath(); X.arc(0, 4, 5, 0, TAU); ink('#e8434f', 2);
    for (let q = 0; q < NEED; q++) { const sx = -52 + q * 52, got = q < served, k = got ? outBack((T - (kingHop - .9 + 0) + 9) * 0 + 1) : 0; X.beginPath(); X.arc(sx, 48, 17, 0, TAU); ink(got ? '#fff3c4' : '#ece7f3', 3); if (got) { X.fillStyle = won ? 'hsl(' + ((q * 70 + T * 500) % 360) + ',90%,60%)' : '#f0b24a'; X.beginPath(); X.arc(sx, 48, 12, 0, TAU); X.fill(); X.fillStyle = '#e8434f'; X.beginPath(); X.arc(sx - 4, 45, 3.4, 0, TAU); X.fill(); X.beginPath(); X.arc(sx + 4, 52, 3.4, 0, TAU); X.fill(); } else { X.setLineDash([4, 4]); X.strokeStyle = '#b9b2cc'; X.lineWidth = 2; X.beginPath(); X.arc(sx, 48, 12, 0, TAU); X.stroke(); X.setLineDash([]); } }
    X.restore();
  }
  function drawChef(r, T, waiting, won, lost, rk, frac) {
    const x = chefX(r), k = kinds[r], a = act[r], busy = (k === 'dough' ? inflight() < CAP && pz.length < MAXP : (waiting[r] || 0) > 0 && true) || (k === 'oven' && false);
    const hopping = T - a.ok < .45, bad = T - a.bad < .65, jam = (waiting[r] || 0) >= 3;
    let mood = won ? 'happy' : lost ? 'sad' : bad || jam ? 'sad' : hopping ? 'happy' : null;
    const bob = won ? -Math.abs(Math.sin(rk * 9 + r)) * 14 : hopping ? -Math.sin((T - a.ok) / .45 * Math.PI) * 9 : busy && !lost ? Math.sin(T * 11 + r) * 1.3 : Math.sin(T * 1.6 + r) * 1.2;
    // the sign over the station
    const sx = k === 'oven' ? stx[r] : x, sw = 88; line([[sx - 32, 134], [sx - 32, 152]], 2.5, '#c9a36a', false); line([[sx + 32, 134], [sx + 32, 152]], 2.5, '#c9a36a', false);
    rr(sx - sw / 2, 150, sw, 24, 8); ink('#d9944f', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; rr(sx - sw / 2 + 6, 153, sw - 12, 5, 2.5); X.fill(); txt(SIGN[k], sx, 163, 14, '#fff', 'center', sw - 10);
    chef(r, x, CHEFY, 4, T, colOf(r), mood, bob, k);
    // the tool in the chef's hand
    const hy = CHEFY - 18 + bob;
    if (k === 'dough') { X.save(); X.translate(x + 26, hy + 2); X.rotate(busy ? Math.sin(T * 9) * .4 - .4 : -.5); line([[-12, 0], [12, 0]], 6, '#e3ac66', true); X.restore(); }
    else if (k === 'sauce' || k === 'st') { X.save(); X.translate(x + 24, hy + 2); X.rotate(busy ? Math.sin(T * 6) * .35 - .6 : -.7); line([[0, 8], [0, -14]], 4, '#c9ced6', true); X.beginPath(); X.arc(0, -16, 6, 0, TAU); ink('#d9d4ee', 2); X.fillStyle = '#e8434f'; el(0, -17, 4, 1.8); X.fill(); X.restore(); }
    else if (k === 'tops') { X.save(); X.translate(x + 24, hy); X.rotate(busy ? Math.sin(T * 8) * .3 : 0); X.beginPath(); X.arc(0, 0, 5, 0, TAU); ink('#d6343c', 1.8); X.restore(); }
    else if (k === 'oven') { X.save(); X.translate(x + 26, hy + 4); X.rotate(-.9); line([[-22, 6], [10, -2]], 4, '#c9a36a', true); rr(8, -9, 18, 12, 3); ink('#c9ced6', 2.5); X.restore(); }
    if (bad || jam) sweat(x + 19, CHEFY - 36 + bob, T, r);
    pill(x, 188, nameOf(r), colOf(r), false, r !== role);
    if (r !== role && jam) badge('!', x + 30, 204 - Math.abs(Math.sin(T * 8)) * 4, 14, '#e8434f', '#fff', 1, 0);
  }
  function drawOven(T, won, lost) {
    const r = S - 1, x = stx[r], heat = kind === 'oven' ? ws.heat : heatNet, armed = kind === 'oven' ? ws.armed : armedNet;
    const baking = pz.some(p => p && !p.dead && p.c >= S && T - p.doneAt < .5), burning = pz.some(p => p && p.dead && T - p.burnAt < .5);
    const closed = armed || baking || burning, k = closed ? 1 : 0;
    // the glow from the mouth + the door (slides down over the belt)
    const gl = clamp(heat * 1.15, 0, 1), shk = armed && heat > zoneTop() - .02 ? Math.sin(T * 60) * 1.5 : 0;
    X.save(); X.translate(shk, 0);
    el(x, 240, 36, 24); X.fillStyle = `rgba(255,${Math.round(150 - gl * 70)},40,${.18 + gl * .5})`; X.fill();
    if (closed || !pz.some(p => p && !p.dead && p.c === r)) { rr(x - 34, 224, 68, 34, 8); ink('#aab2c4', 3.5); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x - 28, 228, 56, 4); rr(x - 18, 234, 36, 16, 5); ink(`rgb(255,${Math.round(220 - gl * 150)},${Math.round(120 - gl * 100)})`, 2.5); }
    X.restore();
    // smoke from the chimney
    for (let i = 0; i < 3; i++) { const q = (T * .55 + i / 3) % 1; X.globalAlpha = (1 - q) * .8; X.beginPath(); X.arc(x + 43 + Math.sin(T * 2 + i) * 6 + q * 12, 126 - q * 50, 6 + q * 9, 0, TAU); ink('#f6f4fb', 2.5); X.globalAlpha = 1; }
  }
  function zoneTop() { return zone()[1]; }
  /* ───── the work panel ───── */
  function drawPanel(T, won, lost, rk) {
    const hasP = ws.i >= 0, p = hasP && kind !== 'dough' ? pz[ws.i] : null, arr = p ? clamp((T - p.recv) / .3, 0, 1) : 1, ox = (1 - ease(arr)) * -260;
    const act0 = ready() && !g.result;
    // the station title on the board
    X.save(); X.translate(0, 0);
    if (kind === 'dough') panelDough(T, act0, hasP);
    else if (sauceNow() || topsNow() && kind === 'st') panelSauceTops(T, act0, p, ox, hasP);
    else if (kind === 'tops') panelSauceTops(T, act0, p, ox, hasP);
    else panelOven(T, act0, p, ox, hasP);
    X.restore();
    // the control plate
    const lab = { dough: 'TAP!', sauce: 'POUR!', tops: 'DROP!', st: sauceNow() ? 'POUR!' : 'DROP!', oven: 'HOLD!' }[kind], cap = { dough: 'SPACE', sauce: 'MOUSE', tops: 'ARROWS', st: sauceNow() ? 'MOUSE' : 'ARROWS', oven: 'SPACE' }[kind];
    const down = T - pressAt < .12 || ((kind === 'oven' || sauceNow()) && (ptrDown || ws.armed || keyPour)), grey = g.result;
    const col = grey ? '#d3cfe0' : act0 ? (kind === 'oven' ? '#ff8a3d' : '#4fd06a') : '#ffd23f', dk = grey ? '#8f88a6' : act0 ? (kind === 'oven' ? '#b3481a' : '#24803a') : '#c99512';
    const px = 400, py = 498, w = 220, h = 44, d = down ? 3 : 9;
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(px - w / 2 + 4, py + 12, w, h, 18); X.fill(); rr(px - w / 2, py + 9, w, h, 18); ink(dk, 4); rr(px - w / 2, py + 9 - d, w, h, 18); ink(col, 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; rr(px - w / 2 + 12, py + 9 - d + 4, w - 24, 8, 4); X.fill();
    if (act0 && Math.floor(T * 4) % 2 === 0 && !down) { X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 3; rr(px - w / 2 + 5, py + 9 - d + 4, w - 10, h - 8, 14); X.stroke(); }
    const gw = g.result ? (won ? 'YUM!' : 'OH NO!') : lab;
    txt(gw, px, py + 9 - d + (TOUCH ? h / 2 + 1 : 15), 26, '#fff', 'center', w - 24); if (!TOUCH) keyCap(px, py + 9 - d + 33, cap);
  }
  function waitingNote(T, why, small) {
    if (small) { txt(why, 290, 420, 24, '#fff', 'center', 130); X.save(); X.translate(290, 470); X.rotate(Math.sin(T * 2) * .15); poly([[-12, -14], [12, -14], [0, 0]]); ink('#e8434f', 3); poly([[0, 0], [12, 14], [-12, 14]]); ink('#ffd23f', 3); X.restore(); return; }
    X.fillStyle = 'rgba(255,255,255,.55)'; rr(262, 352, 276, 104, 22); X.fill(); X.setLineDash([8, 8]); X.strokeStyle = 'rgba(150,90,40,.5)'; X.lineWidth = 3; X.stroke(); X.setLineDash([]);
    txt(why, 400, 384, 26, '#fff', 'center', 250);
    X.save(); X.translate(400, 428); X.rotate(Math.sin(T * 2) * .15); poly([[-12, -14], [12, -14], [0, 0]]); ink('#e8434f', 3); poly([[0, 0], [12, 14], [-12, 14]]); ink('#ffd23f', 3); X.restore();
  }
  function panelDough(T, act0, hasP) {
    if (!hasP) { waitingNote(T, 'LINE FULL!'); return; }
    const hits = ws.prog, tNext = bp - ((T % bp)), ph = tNext / bp, cx = PC[0], cy = PC[1] + 4;
    // the dough ball: stretches with every hit, squashes on the beat, flour puffs
    const sq = T - pressAt < .12 ? 1 - Math.sin((T - pressAt) / .12 * Math.PI) * .12 : 1, base = 28 + hits * 15 + (hits >= HITS ? 4 : 0), fl = T - flopAt < .3 ? -Math.sin((T - flopAt) / .3 * Math.PI) * 6 : 0;
    el(cx, cy + base * .55 + 6, base * 1.02, base * .26); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
    cel(() => el(cx, cy, base * sq + fl, base * (1.04 - sq * .24 + 0.15) * .9), '#f6dfa6', '#dcb878', 4.5, 5, 6);
    X.fillStyle = 'rgba(255,255,255,.55)'; el(cx - base * .35, cy - base * .35, base * .28, base * .1, -.5); X.fill();
    // the dough's face (it hates this)
    const sad = T - flopAt < .5; X.fillStyle = INK; el(cx - base * .26, cy - 2, 3, sad ? 1.4 : 3.6); X.fill(); el(cx + base * .26, cy - 2, 3, sad ? 1.4 : 3.6); X.fill();
    X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(cx, cy + 8, 6, sad ? Math.PI + .3 : .2, sad ? TAU - .3 : Math.PI - .2); X.stroke();
    // the beat ring closing in on the target ring
    const tr = 76, rr0 = tr + ph * 48, near = Math.min(ph, 1 - ph) < HW / bp; X.setLineDash([10, 8]); X.strokeStyle = near ? '#5CFF7A' : 'rgba(255,255,255,.85)'; X.lineWidth = 5; X.beginPath(); X.arc(cx, cy, tr, 0, TAU); X.stroke(); X.setLineDash([]);
    X.globalAlpha = clamp(1 - ph * .6, .2, 1); X.strokeStyle = INK; X.lineWidth = 10; X.beginPath(); X.arc(cx, cy, rr0, 0, TAU); X.stroke(); X.strokeStyle = near ? '#5CFF7A' : '#ffd23f'; X.lineWidth = 5; X.stroke(); X.globalAlpha = 1;
    if (act0) { if (Math.min(ph, 1 - ph) < .05) { X.beginPath(); X.arc(cx, cy, tr + 4, 0, TAU); X.lineWidth = 8; X.strokeStyle = 'rgba(92,255,122,.7)'; X.stroke(); } }
    // three dough pips
    for (let q = 0; q < HITS; q++) { X.beginPath(); X.arc(cx - 34 + q * 34, 474, 10, 0, TAU); ink(q < hits ? '#fff3c4' : '#d7b88a', 3); if (q < hits) { X.fillStyle = '#f6dfa6'; X.beginPath(); X.arc(cx - 34 + q * 34, 474, 6, 0, TAU); X.fill(); } }
    if (!act0 && !g.result) waitingNote(T, 'WAIT!');
  }
  function panelSauceTops(T, act0, p, ox, hasP) {
    if (!hasP) { waitingNote(T, 'WAITING...'); return; }
    const sauceOn = sauceNow(), cx = PC[0] + ox, cy = PC[1];
    bigPizza(cx, cy, PR, { sauceFull: !sauceOn });
    if (sauceOn) {
      const turns = TURNS;
      // the guide (a dotted spiral) and the sauce poured so far
      const pts = []; for (let q = 0; q <= 80; q++) pts.push(spiralPt(cx, cy, 1, ws.dir, turns, q / 80));
      X.setLineDash([3, 10]); X.lineCap = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineWidth = 6; X.strokeStyle = 'rgba(170,45,45,.75)'; X.stroke(); X.setLineDash([]);
      sauceStroke(cx, cy, 1, ws.dir, turns, ws.prog);
      const s0 = pts[0]; if (ws.prog < .03 && !g.result) { const b = Math.sin(T * 8) * 3; poly([[s0[0] - 28 + b, s0[1] - 11], [s0[0] - 12 + b, s0[1] - 11], [s0[0] - 12 + b, s0[1] - 18], [s0[0] + 2 + b, s0[1]], [s0[0] - 12 + b, s0[1] + 18], [s0[0] - 12 + b, s0[1] + 11], [s0[0] - 28 + b, s0[1] + 11]]); ink('#FFE14D', 2.5); }
      if (act0) { const c = ptr || [PC[0] + 0, PC[1] - 56], lx = ptrSeen ? c[0] : s0[0], ly = ptrSeen ? c[1] : s0[1], pour = ptrDown || keyPour; ladle(lx, ly, pour ? -.5 : -.2, pour);
        if (pour) { X.fillStyle = '#e8434f'; el(lx, ly + 10, 3, 5); X.fill(); } }
      if (!TOUCH && act0) { for (const [dx, dy, ch] of []) { } }
    } else {
      // five topping spots; one glows (a closing ring tells you how long it lasts)
      for (let k = 0; k < 5; k++) {
        const [dx, dy] = SPOT[k], x = cx + dx, y = cy + dy, lit = ws.lit === k && act0;
        X.beginPath(); X.arc(x, y, 20, 0, TAU); X.setLineDash([5, 6]); X.lineWidth = 3; X.strokeStyle = lit ? '#fff' : 'rgba(120,60,30,.45)'; X.stroke(); X.setLineDash([]);
        if (lit) { const ph = clamp((T - ws.litAt) / LIFE, 0, 1), pul = .5 + .5 * Math.sin(T * 14); X.beginPath(); X.arc(x, y, 20, 0, TAU); X.fillStyle = `rgba(255,255,255,${.35 + pul * .35})`; X.fill(); X.beginPath(); X.arc(x, y, 30 - ph * 8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - ph)); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = ph > .7 ? '#ff4d5e' : '#FFE14D'; X.stroke(); topping(k, x, y, 1.15 + pul * .1, T * 2); }
        if (!TOUCH && act0) txt(['▲', '►', '▼', '◄', '●'][k], x + (dx ? dx / 42 * 22 : 0), y + (dy ? dy / 42 * 22 : 0) + (k === 4 ? 24 : 0), 13, 'rgba(255,255,255,.85)');
      }
      // toppings that have landed + the ones in the air
      for (const f of dropFx) { const a = T - f.at, [dx, dy] = SPOT[f.k], x = cx + dx, y = cy + dy; if (f.bad) { const q = clamp(a / .3, 0, 1); topping(f.k, x + q * (dx >= 0 ? 90 : -90) + (dx === 0 ? 40 * q : 0), y - 70 * (1 - q) * (1 - q) * 0 + q * 90 - Math.sin(q * Math.PI) * 40, 1, a * 12); continue; } if (a < .16) topping(f.k, x, y - (1 - a / .16) * 90, 1.1, f.rot + a * 20); else topping(f.k, x, y, 1.1, f.rot); }
      if (dropFx.length > 12) dropFx.splice(0, dropFx.length - 12);
      for (let q = 0; q < HT; q++) { X.beginPath(); X.arc(PC[0] - (HT - 1) * 17 + q * 34, 474, 10, 0, TAU); ink(q < ws.prog ? '#fff3c4' : '#d7b88a', 3); if (q < ws.prog) { X.fillStyle = '#e8434f'; X.beginPath(); X.arc(PC[0] - (HT - 1) * 17 + q * 34, 474, 6, 0, TAU); X.fill(); } }
    }
    if (!act0 && !g.result && p) { const a = clamp((T - p.recv) / .3, 0, 1); if (a < 1) { /* sliding in */ } }
  }
  function panelOven(T, act0, p, ox, hasP) {
    const heat = ws.heat, [lo, hi] = hasP ? zone() : [.55, .75], armed = ws.armed, MX = 290, MY = 452, gl = clamp(heat * 1.2, 0, 1);
    const mouth = () => { X.beginPath(); X.moveTo(216, 542); X.lineTo(216, MY); X.arc(MX, MY, 74, Math.PI, 0); X.lineTo(364, 542); X.closePath(); };
    X.save(); mouth(); X.clip();
    const gr = X.createLinearGradient(0, 380, 0, 542); gr.addColorStop(0, `rgb(${Math.round(60 + gl * 170)},${Math.round(20 + gl * 60)},20)`); gr.addColorStop(1, `rgb(${Math.round(160 + gl * 95)},${Math.round(60 + gl * 100)},30)`); X.fillStyle = gr; X.fillRect(210, 370, 160, 180);
    for (let i = 0; i < 6; i++) { const fx = 232 + i * 25, fh = 24 + Math.sin(T * 9 + i * 1.7) * 9 + gl * 38; X.beginPath(); X.moveTo(fx - 12, 542); X.quadraticCurveTo(fx - 4, 542 - fh * .6, fx, 542 - fh); X.quadraticCurveTo(fx + 6, 542 - fh * .5, fx + 12, 542); X.closePath(); X.fillStyle = i & 1 ? '#ffb81c' : '#ff6a2a'; X.fill(); }
    if (hasP && p) {
      X.save(); X.translate(MX + ox * .6, 478); X.scale(1, .55); bigPizza(0, 0, 54, { sauceFull: true, baked: armed && heat > lo - .04 });
      for (let k = 0; k < 5; k++) { const a = p.i * 1.7 + k * 1.26, rad = 54 * (.18 + .35 * ((k * 7 + p.i * 3) % 5) / 5); X.beginPath(); X.arc(Math.cos(a) * rad, Math.sin(a) * rad, 7, 0, TAU); ink(TOPC[(k + p.i) % 4], 1.6); } X.restore();
    }
    X.restore(); mouth(); X.lineWidth = 8; X.strokeStyle = INK; X.stroke();
    // the thermometer: raw / perfect / burnt zones, the mercury and a marker
    const gt = 346, gh = 154, gx = 560, gw = 40;
    X.save(); rr(gx, gt, gw, gh, 12); X.clip(); X.fillStyle = '#9fd8ff'; X.fillRect(gx, gt, gw, gh); X.fillStyle = '#ff4d5e'; X.fillRect(gx, gt, gw, gh * (1 - (hi + .12))); X.fillStyle = '#ffb347'; X.fillRect(gx, gt + gh * (1 - (hi + .12)), gw, gh * .12); X.fillStyle = '#5CFF7A'; X.fillRect(gx, gt + gh * (1 - hi), gw, gh * (hi - lo));
    X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(gx + 6, gt, 6, gh);
    const my = gt + gh * (1 - clamp(heat, 0, 1)); X.fillStyle = '#e8434f'; X.fillRect(gx + 14, my, 14, gt + gh - my + 4); X.restore();
    rr(gx, gt, gw, gh, 12); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
    X.beginPath(); X.arc(gx + 20, 512, 17, 0, TAU); ink('#e8434f', 4); X.fillStyle = 'rgba(255,255,255,.55)'; el(gx + 14, 506, 5, 3, -.5); X.fill();
    poly([[gx + gw + 10, my], [gx + gw + 26, my - 8], [gx + gw + 26, my + 8]]); ink('#FFE14D', 2.5);
    if (act0 && !armed && ws.lock <= 0 && Math.floor(T * 3) % 2 === 0) txt('HOLD!', MX, 390, 28, '#fff');
    if (!hasP && !g.result) waitingNote(T, 'WAITING...', true);
    if (armed && heat > hi - .035) { X.globalAlpha = .6 + .4 * Math.sin(T * 30); txt('NOW!', 470, 430 + Math.sin(T * 30) * 3, 40, '#FFE14D'); X.globalAlpha = 1; }
  }
  /* ───── the endings: win = the king rides the tower and goes wild; lose = the line floods with sauce ───── */
  function drawEnd(T, won, lost, rk) {
    if (won && rk >= 0) {
      for (let i = 0; i < 5; i++) { const k = ((rk * .9 + i * .2) % 1); X.globalAlpha = Math.sin(k * Math.PI); heart(KING[0] - 50 + i * 24 + Math.sin(T * 4 + i) * 6, KING[1] - 40 - k * 90, .65 + (i % 2) * .3); X.globalAlpha = 1; }
      for (let i = 0; i < 4; i++) { const a = T * 6 + i * TAU / 4; star(KING[0] + Math.cos(a) * 30, KING[1] - 52 + Math.sin(a) * 8 - 20, 7, 3, 5, a, '#FFE14D', 2.5); }
      badge('BUON APPETITO!', 640, 470, 22, '#3fae5a', '#fff', rk < .2 ? outBack(rk / .2) : 1, -.06);
      if (rk < .3) for (let i = 0; i < 2; i++) ring(KING[0], KING[1] - 40, '#fff', 60 + i * 20, .3);
    } else if (lost && rk >= 0) {
      const k = ease(rk / .7), top = lerp(600, 316, k), amp = 7;
      X.beginPath(); X.moveTo(0, 600); for (let x = 0; x <= 800; x += 20) X.lineTo(x, top + Math.sin(x * .035 + T * 6) * amp); X.lineTo(800, 600); X.closePath(); ink('#e8434f', 4); X.fillStyle = 'rgba(255,255,255,.2)'; for (let x = 20; x < 800; x += 90) { el(x + Math.sin(T * 3 + x) * 6, top + 12, 24, 4); X.fill(); }
      for (let i = 0; i < 6; i++) { const px = 80 + i * 130, py = top + 24 + Math.sin(T * 4 + i) * 6; if (py < 590) { topping(0, px, py, 1.2, T + i); topping(i & 1 ? 2 : 0, px + 40, py + 14, 1, T * 2 + i); } }
      if (rk > .25) badge('TOO SLOW!', 650, 466, 22, '#e8434f', '#fff', rk < .45 ? outBack((rk - .25) / .2) : 1, .06);
    }
  }
  g.dbg = {
    kind, n, S, bp, HW, HITS, HT, NEED, role, ws, pz, TS, zone, ready, canDough, inflight, ptr: () => ptr,
    beatIn: () => { const ph = g.c % bp; return ph < 1e-9 ? 0 : bp - ph; },
    spiral: u => sp0(u), lit: () => ws.lit, litAge: () => g.c - ws.litAt, heat: () => ws.heat, armed: () => ws.armed, phase: () => ws.ph, prog: () => ws.prog,
    served: () => served, burnt: () => burnt, lock: () => ws.lock, sauceNow, topsNow, SPOT, PC,
  };
  wire(g, D, JR, sp, 'sq_pizza');
  return g;
}
reg('sq_pizza', duPizza, 'PIZZA RUSH'); REGMAP.sq_pizza.duo = true; REGMAP.sq_pizza.squad = true;

/* ───────────── intro card: what each role does, tiny Caoses in toques (520×240 frame, loops) ───────────── */
function demoBg(T) {
  X = ctx; let g = X.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, '#ffe7b8'); g.addColorStop(1, '#ffd391'); X.fillStyle = g; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#fbf3e4'; X.fillRect(0, 100, 520, 140); X.strokeStyle = 'rgba(176,140,100,.4)'; X.lineWidth = 2;
  for (let y = 122, r = 0; y < 240; y += 22, r++) { X.beginPath(); X.moveTo(0, y); X.lineTo(520, y); X.stroke(); for (let x = (r & 1) * 22; x < 520; x += 44) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 22); X.stroke(); } }
  X.fillStyle = '#3fae5a'; X.fillRect(0, 92, 520, 5); X.fillStyle = '#fff'; X.fillRect(0, 97, 520, 5); X.fillStyle = '#e8434f'; X.fillRect(0, 102, 520, 5);
  rr(-10, 200, 540, 50, 8); ink('#d9944f', 4); X.fillStyle = '#e6b878'; X.fillRect(0, 210, 520, 30);
}
function dChef(x, y, T, col, mood) { chef(0, x, y, 4.6, T, col, mood, Math.sin(T * 3) * 1.5, ''); }
function dTap(x, y, down, k) { demoFinger(x, y, down, k); }
function dDough(T) {
  demoBg(T); const bp = .55, u = T % 3.3, hits = Math.min(3, Math.floor(u / bp)), ph = (u % bp) / bp, cx = 260, cy = 150;
  const base = 26 + hits * 11;
  el(cx, cy + base * .55 + 4, base, base * .25); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  cel(() => el(cx, cy, base * (1 + (ph < .12 ? .08 : 0)), base * .8), '#f6dfa6', '#dcb878', 4, 4, 5);
  X.fillStyle = INK; el(cx - 8, cy - 2, 2.6, 3.4); X.fill(); el(cx + 8, cy - 2, 2.6, 3.4); X.fill();
  X.setLineDash([8, 7]); X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 4; X.beginPath(); X.arc(cx, cy, 68, 0, TAU); X.stroke(); X.setLineDash([]);
  const rr0 = 68 + (1 - ph) * 44; X.strokeStyle = INK; X.lineWidth = 8; X.beginPath(); X.arc(cx, cy, rr0, 0, TAU); X.stroke(); X.strokeStyle = '#ffd23f'; X.lineWidth = 4; X.stroke();
  dChef(66, 216, T, '#FFC93C', hits >= 3 ? 'happy' : null);
  if (u > 3 * bp && u < 3 * bp + .5) { const k = (u - 3 * bp) / .5; pizza(cx + k * 180, 150 - Math.sin(k * Math.PI) * 90, 24, { i: 1 }); }
  dTap(cx + 110, 205, ph > .85 || ph < .1, ph > .85 ? 0 : ph * 5);
}
function dSauce(T) {
  demoBg(T); const u = T % 3.6, k = clamp(u / 2.6, 0, 1), cx = 260, cy = 130;
  bigPizza(cx, cy, 70, {}); const pts = []; for (let q = 0; q <= 60; q++) pts.push(spiralPt(cx, cy, 1, 1, 1.5, q / 60));
  X.setLineDash([2, 9]); X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineWidth = 5; X.strokeStyle = 'rgba(160,50,50,.55)'; X.lineCap = 'round'; X.stroke(); X.setLineDash([]);
  sauceStroke(cx, cy, 1, 1, 1.5, k); const [lx, ly] = spiralPt(cx, cy, 1, 1, 1.5, k); ladle(lx, ly, -.5, k < 1);
  dChef(66, 216, T, '#6EA8FE', k >= 1 ? 'happy' : null); dTap(lx + 6, ly + 34, k < 1, 0);
  if (k >= 1) for (let q = 0; q < 3; q++) star(cx - 30 + q * 30, 56 - Math.sin(T * 6 + q) * 5, 7, 3, 5, T * 4, '#FFE14D', 2);
}
function dTops(T) {
  demoBg(T); const cx = 260, cy = 130, u = T % 3.6, seq = [0, 3, 1, 4], i = Math.min(3, Math.floor(u / .8)), ph = (u % .8) / .8;
  bigPizza(cx, cy, 70, { sauceFull: true });
  SPOT.forEach(([dx, dy], k) => { X.beginPath(); X.arc(cx + dx, cy + dy, 19, 0, TAU); X.setLineDash([5, 6]); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.6)'; X.stroke(); X.setLineDash([]); });
  for (let q = 0; q < i; q++) topping(seq[q], cx + SPOT[seq[q]][0], cy + SPOT[seq[q]][1], 1.1, q);
  if (u < 3.2) { const [dx, dy] = SPOT[seq[i]]; X.beginPath(); X.arc(cx + dx, cy + dy, 19, 0, TAU); X.fillStyle = `rgba(255,255,255,${.4 + .3 * Math.sin(T * 14)})`; X.fill(); topping(seq[i], cx + dx, cy + dy - (ph > .7 ? (1 - (ph - .7) / .3) * 50 : 0), 1.1, 0); dTap(cx + dx + 8, cy + dy + 22, ph > .6, (ph - .6) / .4); }
  dChef(66, 216, T, '#ff7ab6', i >= 3 && u > 3.1 ? 'happy' : null);
}
function dSt(T) { if (T % 7 < 3.6) dSauce(T % 7); else dTops((T % 7) - 3.6); }
function dOven(T) {
  demoBg(T); const u = T % 3.4, hold = u < 1.5, heat = hold ? u / 1.5 * .72 : u < 2.2 ? .72 : 0, lo = .58, hi = .8;
  X.beginPath(); X.moveTo(70, 210); X.lineTo(70, 120); X.arc(160, 120, 90, Math.PI, 0); X.lineTo(250, 210); X.closePath(); ink('#d96a42', 4);
  const gl = clamp(heat * 1.2, 0, 1); X.beginPath(); X.moveTo(96, 210); X.lineTo(96, 126); X.arc(160, 126, 64, Math.PI, 0); X.lineTo(224, 210); X.closePath(); X.fillStyle = `rgb(${Math.round(60 + gl * 180)},${Math.round(20 + gl * 70)},20)`; X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  if (u > 2.2 && u < 3.1) pizza(160 + (u - 2.2) / .9 * 120, 190, 28, { sauce: 1, tops: 1, baked: 1, i: 2 }); else if (u < 2.2) pizza(160, 190, 28, { sauce: 1, tops: 1, baked: heat > lo, i: 2 });
  rr(330, 24, 40, 180, 12); ink('#9fd8ff', 4); X.save(); rr(330, 24, 40, 180, 12); X.clip(); X.fillStyle = '#ff4d5e'; X.fillRect(330, 24, 40, 180 * .2); X.fillStyle = '#5CFF7A'; X.fillRect(330, 24 + 180 * (1 - hi), 40, 180 * (hi - lo)); X.fillStyle = '#e8434f'; const my = 24 + 180 * (1 - heat); X.fillRect(346, my, 14, 204 - my); X.restore(); rr(330, 24, 40, 180, 12); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
  dChef(300, 226, T, '#5CFF7A', u > 2.2 && u < 3.1 ? 'happy' : null);
  dTap(440, 150, hold, 0); if (u > 2.2 && u < 2.8) badge('DING!', 440, 90, 20, '#ffd23f', '#fff', outBack((u - 2.2) / .15), -.06);
}
DUO.INFO.sq_pizza = n => n === 4
  ? [['DOUGH', 'TAP ON THE BEAT: TOSS IT', 'TAP / CLICK / SPACE'], ['SAUCE', 'TRACE THE SAUCE SPIRAL', 'DRAG / HOLD MOUSE / ARROWS'], ['TOPPINGS', 'DROP TOPPINGS ON THE GLOW', 'TAP SPOT / ARROWS + SPACE'], ['OVEN', 'HOLD, LET GO IN THE GREEN', 'HOLD CLICK / SPACE']]
  : [['DOUGH', 'TAP ON THE BEAT: TOSS IT', 'TAP / CLICK / SPACE'], ['SAUCE+TOPS', 'SPIRAL, THEN TAP THE GLOW', 'DRAG, THEN TAP SPOT'], ['OVEN', 'HOLD, LET GO IN THE GREEN', 'HOLD CLICK / SPACE']];
DUO.DEMOS.sq_pizza = n => n === 4 ? [dDough, dSauce, dTops, dOven] : [dDough, dSt, dOven];

})();
