'use strict';
/* ═════════ SQUAD · CANDLE CIRCLE (sq_velas) ═════════
   El apagón: a dark living room, one corner each. Every seat holds a flashlight (drag / arrows / WASD move the beam) and sees ONLY what its
   cone (and the other seats' cones) lights up. Three things lie in the dark, one in each of seats 0-2's corner: the CANDLE, the MATCHES and the
   CANDLEHOLDER. Keep the beam on your item for a moment and it follows the beam: carry it to the table in the middle (the arepa is there).
   Floor junk (a toy block, a flip-flop, a toy car) is only visible in a cone: carry the item through it and you TRIP, the item flies back home.
   The flashlights run on one shared POWER meter that always drains: with 4 seats the 4th is the GENERATOR (mash tap / space / click to crank it,
   the more you crank the wider every beam), with 3 seats everybody can tap the DYNAMO button once in a while. Power 0 = flashlights dead.
   A COCKROACH crawls (unseen) toward the arepa: light it for a moment and it scurries back. If it reaches the arepa you lose. If the clock runs
   out "la luz vuelve" and the family is caught in underwear. Each seat has ONE radar blip ('blip', B or the button) to flag a spot to the others.
   Netcode: each seat owns its beam and item and publishes [bx, by, ix, iy, st] (coalesced ≤10/s, drawn ~150 ms behind via track()); the JUDGE
   (seat 0 = table owner) owns the power meter, the roach and the verdict: it publishes 'j' [power, roach x, y, progress, cause], gets 'tap',
   'scare' and 'put' from the others and finishes 'win' when all three items are on the table, 'lose' on roach / clock. Level (item homes,
   floor junk, roach route) comes from the seeded mkR(), identical on every screen. Win = candle lit and abuela caught in her avocado mask. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only

const TB = { x: 400, y: 336 }, TRAD = 58;                      // the table (centre) and how close an item has to get to count
const HAND = [[86, 512], [86, 200], [714, 200], [714, 512]];   // where each seat stands
const B0 = [[196, 452], [196, 270], [604, 270], [680, 452]];   // where each beam starts
const R0 = 96, BSPD = 250, GRAB = .3, TRIPR = 22;             // beam radius at full power, beam speed px/s, hold time to pick up, trip distance
const BX0 = 20, BX1 = 780, BY0 = 72, BY1 = 546;
const DRAIN = [0, 0, 0, .16, .5], TAPP = [0, 0, 0, .3, .2]; // power drain per sim second and gain per tap, indexed by seat count
const RV = .12, RSTART = 1.9, RBACK = .35;                     // roach speed (path/s), when it appears, how far a scare sends it back
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const SLOT = [[-34, -12], [36, -6], [0, -26]];                  // where the three items sit on the table
const KINDS = ['CANDLE', 'MATCHES', 'HOLDER', 'GENERATOR'];
const GREEN = '#8fcf5a', GOLD = '#ffcf33', GOLD2 = '#d99a12';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context while the room is baked) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 3.5) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(160, X.measureText(t(label)).width + 24);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(330, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 330);
  X.restore();
}

/* the things that lie in the dark */
function candle(x, y, s, lit, T) {
  rr(x - 6 * s, y - 13 * s, 12 * s, 26 * s, 3 * s); ink('#f4ead0', 3);
  X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(x - 3.5 * s, y - 10 * s, 2.5 * s, 18 * s);
  X.fillStyle = '#e7d3a1'; el(x + 2 * s, y - 6 * s, 2 * s, 5 * s); X.fill();
  line([[x, y - 13 * s], [x, y - 18 * s]], 2.2, INK);
  if (lit) {
    const f = 1 + Math.sin(T * 17) * .12;
    X.beginPath(); X.moveTo(x, y - 36 * s * f); X.quadraticCurveTo(x + 9 * s, y - 24 * s, x, y - 15 * s); X.quadraticCurveTo(x - 9 * s, y - 24 * s, x, y - 36 * s * f); ink('#ff9a2e', 2.5);
    el(x, y - 22 * s, 3.2 * s, 5.5 * s); X.fillStyle = '#fff3a0'; X.fill();
  }
}
function matches(x, y, s) {
  X.save(); X.translate(x, y); X.rotate(-.12);
  line([[-3 * s, -9 * s], [14 * s, -22 * s]], 3 * s, '#c58b4a'); X.beginPath(); X.arc(15 * s, -23 * s, 3.4 * s, 0, TAU); ink('#e8343d', 2);
  rr(-14 * s, -8 * s, 28 * s, 17 * s, 3 * s); ink('#d9435a', 3);
  X.fillStyle = '#fff4d6'; X.fillRect(-10 * s, -3 * s, 20 * s, 4 * s); X.fillStyle = INK; X.fillRect(-10 * s, 4 * s, 20 * s, 2 * s);
  X.restore();
}
function holder(x, y, s) {
  X.beginPath(); X.arc(x + 15 * s, y - 2 * s, 8 * s, 0, TAU); X.lineWidth = 5 * s; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.5 * s; X.strokeStyle = GOLD; X.stroke();
  el(x, y + 8 * s, 15 * s, 5 * s); ink(GOLD2, 3);
  rr(x - 3 * s, y - 8 * s, 6 * s, 16 * s, 2); ink(GOLD, 2.5);
  rr(x - 9 * s, y - 16 * s, 18 * s, 9 * s, 3 * s); ink(GOLD, 3);
  X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(x - 6 * s, y - 14 * s, 3 * s, 5 * s);
}
function drawKind(k, x, y, s, lit, T) { if (k === 0) candle(x, y, s, lit, T); else if (k === 1) matches(x, y, s); else holder(x, y, s); }
function junk(k, x, y, T, w) {                                                  // floor clutter: toy block / flip-flop / toy car
  X.save(); X.translate(x, y); X.rotate(w * Math.sin(T * 30) * .25);
  if (k === 0) { rr(-13, -13, 26, 26, 4); ink('#4db8ff', 3); txt('A', 0, 1, 20, '#fff'); }
  else if (k === 1) { el(0, 0, 11, 19, .3); ink('#ff7a3d', 3); tri(-5, -6, 5, -6, 0, 6, '#fff', 2); }
  else { rr(-17, -7, 34, 14, 5); ink('#e8343d', 3); rr(-8, -13, 16, 8, 3); ink('#bde7ff', 2.5); for (const sx of [-10, 10]) { X.beginPath(); X.arc(sx, 8, 5.5, 0, TAU); ink('#2b2640', 2); } }
  X.restore();
}
function roach(x, y, ang, T, s, hurt) {
  X.save(); X.translate(x, y); X.rotate(ang); X.scale(s, s);
  const ph = T * 26;
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const a = Math.sin(ph + i * 2 + (sx > 0 ? 1.6 : 0)) * 3; line([[0, -5 + i * 5], [sx * 14, -9 + i * 6 + a], [sx * 19, -3 + i * 6 - a]], 3, INK); }
  line([[-3, -17], [-9, -29]], 2.5, INK); line([[3, -17], [9, -29]], 2.5, INK);
  el(0, 0, 11, 17); ink('#7a3f1d', 3); X.fillStyle = '#9b5527'; el(-2, -2, 7, 12); X.fill(); line([[0, -12], [0, 14]], 2, INK);
  X.beginPath(); X.arc(0, -17, 7, 0, TAU); ink('#5a2d12', 3);
  X.fillStyle = '#fff'; X.beginPath(); X.arc(-3, -19, 2.4, 0, TAU); X.arc(3, -19, 2.4, 0, TAU); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(-3, -19, 1.1, 0, TAU); X.arc(3, -19, 1.1, 0, TAU); X.fill();
  if (hurt) { X.strokeStyle = '#ff4d6d'; X.lineWidth = 2.5; X.beginPath(); X.arc(0, -2, 20, 0, TAU); X.stroke(); }
  X.restore();
}
function arepa(x, y, bite) {
  el(x, y + 6, 30, 12); ink('#fff7e6', 3);
  X.beginPath(); X.arc(x, y - 2, 18, 0, TAU); ink('#efc26b', 3);
  X.fillStyle = '#f9dc9a'; el(x - 5, y - 8, 9, 5, -.4); X.fill();
  line([[x - 14, y - 2], [x + 14, y - 2]], 3, '#d99a3a');
  if (bite) { X.fillStyle = '#e6c58c'; el(x + 9, y - 9, 7, 5); X.fill(); }
}
function abuela(x, y, u, mood, T, scream) {
  shadow(x, y + 3, 6 * u, 1.6 * u, .22);
  X.fillStyle = INK; rr(x - 7 * u, y - 7 * u, 14 * u, 8 * u, 3 * u); X.fill();
  rr(x - 6 * u, y - 7 * u, 12 * u, 7 * u, 2.5 * u); ink('#f3a6c9', 2.5);   // bata (house dress)
  X.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { X.beginPath(); X.arc(x - 4 * u + i * 2 * u, y - 3.4 * u + (i % 2) * u, .45 * u, 0, TAU); X.fill(); }
  caos(x, y - 2 * u, u, { col: '#f3b790', mood });
  for (let i = 0; i < 5; i++) { X.beginPath(); X.arc(x - 3.6 * u + i * 1.8 * u, y - 13.4 * u - Math.sin(i / 4 * Math.PI) * .8 * u, 1.15 * u, 0, TAU); ink(['#ff7ab6', '#7fd8ff', '#ffe14d'][i % 3], 2); }   // rollers
  el(x, y - 9.3 * u, 4.3 * u, 4.6 * u); ink(GREEN, 2.5);                                                                                          // avocado mask
  X.fillStyle = '#d9f0a0'; el(x, y - 9.3 * u, 3.1 * u, 3.4 * u); X.fill();
  X.beginPath(); X.arc(x, y - 8.4 * u, 1.35 * u, 0, TAU); ink('#8a5a2b', 2);
  for (const sx of [-1, 1]) { X.beginPath(); X.arc(x + sx * 2.1 * u, y - 11 * u, 1.05 * u, 0, TAU); ink('#cfe9a0', 2); X.fillStyle = INK; X.beginPath(); X.arc(x + sx * 2.1 * u, y - 11 * u, .35 * u, 0, TAU); X.fill(); }
  if (scream) { el(x, y - 6.2 * u, 1.3 * u, 1.7 * u); ink('#7a1f2e', 2); }
}

/* ───────────── the living room, painted once ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#f1d6a2'); g.addColorStop(1, '#e0b97c'); X.fillStyle = g; X.fillRect(0, 0, W, 306);
  X.fillStyle = 'rgba(180,90,60,.18)'; for (let i = 0; i < 20; i++) X.fillRect(i * 44 + 10, 0, 18, 300);
  X.fillStyle = INK; X.fillRect(0, 296, W, 12); X.fillStyle = '#8a5a3c'; X.fillRect(0, 288, W, 12);       // baseboard
  g = X.createLinearGradient(0, 308, 0, H); g.addColorStop(0, '#c9623f'); g.addColorStop(1, '#a8472b'); X.fillStyle = g; X.fillRect(0, 308, W, H - 308);
  X.strokeStyle = 'rgba(20,16,28,.45)'; X.lineWidth = 3;                                                  // terracotta tiles
  for (let r = 0; r < 8; r++) { const y = 308 + r * r * 4 + r * 22; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let c = -8; c <= 16; c++) { X.beginPath(); X.moveTo(400 + (c - 4) * 36, 308); X.lineTo(400 + (c - 4) * 118, H); X.stroke(); }
  // the window (night, moon, neighbours' lights) with shutters and curtains
  rr(316, 78, 168, 142, 8); ink('#0d1230', 6);
  X.fillStyle = '#fff6c0'; X.beginPath(); X.arc(440, 120, 15, 0, TAU); X.fill(); X.fillStyle = '#0d1230'; X.beginPath(); X.arc(447, 114, 13, 0, TAU); X.fill();
  X.fillStyle = '#1b2250'; for (let i = 0; i < 7; i++) X.fillRect(322 + i * 24, 188 - hash(i) * 36, 20, 40 + hash(i) * 36);
  X.fillStyle = INK; X.fillRect(396, 78, 8, 142); X.fillRect(316, 148, 168, 8);
  rr(316, 78, 168, 142, 8); X.lineWidth = 8; X.strokeStyle = '#8a5a3c'; X.stroke(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(400 + sx * 84, 70); X.lineTo(400 + sx * 120, 70); X.quadraticCurveTo(400 + sx * 130, 150, 400 + sx * 116, 226); X.lineTo(400 + sx * 84, 226); X.closePath(); ink('#d9435a', 3.5); }
  // wall clock stopped at 12:00, framed abuela, sofa, vitrina, ceiling fan
  X.beginPath(); X.arc(250, 130, 28, 0, TAU); ink('#fff7e6', 4); line([[250, 130], [250, 108]], 3.5, INK); line([[250, 130], [250, 118]], 5, INK);
  rr(536, 92, 76, 92, 6); ink('#8a5a3c', 4); rr(546, 102, 56, 72, 3); ink('#cfe3ff', 2.5);
  X.beginPath(); X.arc(574, 138, 17, 0, TAU); ink('#f3b790', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(568, 134, 2, 0, TAU); X.arc(580, 134, 2, 0, TAU); X.fill(); line([[566, 146], [582, 146]], 2.5, INK);
  rr(22, 196, 176, 92, 14); ink('#3f8a7a', 4); rr(22, 238, 176, 50, 10); ink('#52a894', 4); rr(14, 214, 30, 74, 10); ink('#52a894', 4); rr(176, 214, 30, 74, 10); ink('#52a894', 4);
  rr(628, 120, 140, 168, 6); ink('#8a5a3c', 4); rr(638, 130, 120, 70, 3); ink('#bfe0f5', 2.5);
  for (let i = 0; i < 4; i++) { X.beginPath(); X.arc(656 + i * 30, 168, 10, 0, TAU); ink(['#ffe14d', '#ff7ab6', '#7fd8ff', '#fff'][i], 2); }
  rr(638, 214, 120, 60, 3); ink('#7a4a2c', 3);
  line([[400, 0], [400, 38]], 5, INK);
  for (let i = 0; i < 4; i++) { X.save(); X.translate(400, 44); X.rotate(i * TAU / 4 + .5); rr(8, -9, 74, 18, 8); ink('#8a5a3c', 3); X.restore(); }
  X.beginPath(); X.arc(400, 44, 14, 0, TAU); ink(GOLD, 3.5);
  // the table with a lace cloth
  el(TB.x, TB.y + 40, 110, 28); ink('rgba(0,0,0,.28)', 0);
  for (const sx of [-1, 1]) { rr(TB.x + sx * 62 - 8, TB.y + 6, 16, 56, 4); ink('#7a4a2c', 3); }
  el(TB.x, TB.y, 112, 50); ink('#b9703c', 4); el(TB.x, TB.y - 4, 104, 43); ink('#fff7e6', 3);
  X.fillStyle = '#e9d9b5'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; X.beginPath(); X.arc(TB.x + Math.cos(a) * 99, TB.y - 4 + Math.sin(a) * 40, 5, 0, TAU); X.fill(); }
  // the generator in its corner
  rr(646, 456, 108, 62, 8); ink('#4b8a4f', 4); rr(658, 466, 50, 24, 4); ink('#2b2640', 3); rr(720, 466, 24, 14, 3); ink('#ffe14d', 3);
  for (const sx of [662, 738]) { X.beginPath(); X.arc(sx, 522, 9, 0, TAU); ink('#2b2640', 2.5); }
  X = old; return cv2;
}

/* ═════════ the game ═════════ */
function sqVelas(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0, gen = me === 3;
  /* the level: identical on every screen whatever n / role (always the same draws) */
  const home = [], haz = [];
  for (let i = 0; i < 3; i++) {                      // each item lies in its own corner, on the far side of the table
    const a = Math.atan2(B0[i][1] - TB.y, B0[i][0] - TB.x) + (R() - .5) * 1.7, d = 55 + R() * 75;
    home.push([clamp(B0[i][0] + Math.cos(a) * d, 36, 764), clamp(B0[i][1] + Math.sin(a) * d, 100, 520)]);
  }
  for (let i = 0; i < 3; i++) {
    const t0 = .5 + R() * .2, off = (R() < .5 ? -1 : 1) * (6 + R() * 26), kind = Math.floor(R() * 3);
    const dx = TB.x - home[i][0], dy = TB.y - home[i][1], l = Math.hypot(dx, dy) || 1;
    const h = { x: lerp(home[i][0], TB.x, t0) - dy / l * off, y: lerp(home[i][1], TB.y, t0) + dx / l * off, k: kind, w: 0 };
    for (const o of haz) { const d = dist(h.x, h.y, o.x, o.y); if (d < 130) { const m = d || 1, kk = (130 - d) / m; h.x += (h.x - o.x || 1) * kk; h.y += (h.y - o.y) * kk; } }   // never two in a row
    h.x = clamp(h.x, 40, 760); h.y = clamp(h.y, 100, 520); haz.push(h);
  }
  const RP = { x: 120 + R() * 560, y: 538, ph: R() * TAU }, AR = { x: TB.x, y: TB.y - 14 };
  /* state */
  let bx = B0[me][0], by = B0[me][1], tx = bx, ty = by, kx = 0, ky = 0, stun = 0, S = 0, holdT = 0, ptrOn = false;
  const it = { x: home[me < 3 ? me : 0][0], y: home[me < 3 ? me : 0][1], st: 0 };
  let jAt = -9, P = 1, crank = 0, cooldown = 0, litT = 0, blipUsed = false, sentAt = -9, resAt = -1, cause = 1, tapAt = -9;
  let ru = 0, ruT = 0, ruSnd = 0, scared = 0;
  const dl = [0, 0, 0];
  const rem = [0, 1, 2, 3].map(() => ({ bx: track(), by: track(), ix: track(), iy: track(), st: 0 }));
  const PT = track(), rxT = track(), ryT = track(), ruR = track();
  const pops = [], blips = [];
  let endFx = false, wasLow = false;
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  function pop(s, x, y, size, bgc) { pops.push({ s, x, y, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  const powerNow = () => judge ? P : (PT.at() === null ? 1 : PT.at());
  const radius = p => 8 + (R0 - 8) * Math.sqrt(clamp(p, 0, 1));
  const beamOf = s => s === me ? [bx, by] : s === 3 ? B0[3] : [rem[s].bx.at() === null ? B0[s][0] : rem[s].bx.at(), rem[s].by.at() === null ? B0[s][1] : rem[s].by.at()];
  const itemOf = s => s === me ? [it.x, it.y, it.st] : [rem[s].ix.at() === null ? home[s][0] : rem[s].ix.at(), rem[s].iy.at() === null ? home[s][1] : rem[s].iy.at(), rem[s].st];
  const roachPos = () => {
    if (judge) { const k = clamp(ru, 0, 1); return [lerp(RP.x, AR.x, k) + Math.sin(k * 14 + RP.ph) * 10 * (1 - k), lerp(RP.y, AR.y, k)]; }
    return [rxT.at() === null ? RP.x : rxT.at(), ryT.at() === null ? RP.y : ryT.at()];
  };
  const roachOn = () => judge ? S >= RSTART : (ruR.at() !== null && ruR.at() >= 0);
  const myBeam = () => gen ? B0[3] : [bx, by];
  function publish(force) {
    if (!force && g.c - sentAt < .1) return; sentAt = g.c;
    D.send('p', gen ? [Math.round(crank * 100), 0, 0, 0, 0] : [Math.round(bx), Math.round(by), Math.round(it.x), Math.round(it.y), it.st], true);
  }
  function fx(x, y) { sfx.miss(); shake(4, .14); burst(x, y, '#ffcf33', 8); pop('TRIPPED!', clamp(x, 110, 690), clamp(y - 40, 110, 520), 22, '#e8343d'); }
  function addPower(k) { P = clamp(P + TAPP[n], 0, 1); }
  function scare() { if (!judge || g.result) return; ruT = Math.max(.02, ruT - RBACK); scared = .9; snd(900, .08, 'square', .06, 0, 300); }
  function tap() {
    if (g.result || g.c - tapAt < .045) return;
    crank += .9; tapAt = g.c; snd(gen ? 330 : 260, .05, 'triangle', .05, 0, gen ? 520 : 400);
    if (judge) addPower(); else D.send('tap', 1);
  }
  function blip() {
    if (blipUsed || g.result || gen) return; blipUsed = true; const m = [Math.round(bx), Math.round(by)];
    blips.push({ x: m[0], y: m[1], from: me, t0: g.c }); D.send('blip', m); snd(1040, .18, 'sine', .07, 0, 1500);
  }
  function trip() {
    it.st = 0; fx(it.x, it.y); D.send('trip', [Math.round(it.x), Math.round(it.y)]); it.x = home[me][0]; it.y = home[me][1]; stun = .55; holdT = -1.2; publish(true);
  }
  function deliver() {
    it.st = 2; it.x = TB.x + SLOT[me][0]; it.y = TB.y + SLOT[me][1]; D.send('put', me); if (judge) dl[0] = 1; publish(true);
    snd(660, .09, 'triangle', .07); snd(880, .12, 'triangle', .07, .08); burst(it.x, it.y, GOLD, 8);
  }

  const lines = ['FETCH CANDLE!', 'FETCH MATCHES!', 'FETCH HOLDER!', 'CRANK IT!'];
  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: lines[me], roleLabel: KINDS[me],
    hint: gen ? 'TAP SPACE / CLICK AS FAST AS YOU CAN: THE POWER KEEPS DRAINING' : 'ARROWS / WASD MOVE THE FLASHLIGHT - HOLD IT ON YOUR ITEM, CARRY IT TO THE TABLE (SPACE = DYNAMO, B = BLIP)',
    thint: gen ? 'TAP AS FAST AS YOU CAN: THE POWER KEEPS DRAINING' : 'DRAG TO MOVE THE FLASHLIGHT - HOLD IT ON YOUR ITEM, CARRY IT TO THE TABLE',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt; const dS = dt * TS; S += dS;
      if (g.result && resAt < 0) resAt = g.c;
      const done = !!g.result;
      if (!done) {
        const live = powerNow() > .03;
        if (!gen) {
          if (stun > 0) stun -= dt;
          if (kx || ky) { tx = bx + kx * 160; ty = by + ky * 160; }
          if (stun <= 0 && live) {
            const spd = (it.st === 1 ? BSPD * .82 : BSPD) * TS * dt, d = dist(bx, by, tx, ty);
            if (d > .5) { const k = Math.min(1, spd / d); bx += (tx - bx) * k; by += (ty - by) * k; }
            bx = clamp(bx, BX0, BX1); by = clamp(by, BY0, BY1);
          }
          if (it.st === 0) {
            if (holdT < 0) holdT = Math.min(0, holdT + dS); else if (live && dist(bx, by, it.x, it.y) < 26) holdT += dS; else holdT = 0;
            if (holdT >= GRAB) { it.st = 1; holdT = 0; snd(520, .08, 'square', .06, 0, 780); publish(true); }
          } else if (it.st === 1) {
            it.x += (bx - it.x) * Math.min(1, dt * 18); it.y += (by - it.y) * Math.min(1, dt * 18);
            let hit = false; for (const h of haz) if (dist(it.x, it.y, h.x, h.y) < TRIPR) { hit = true; h.w = .5; }
            if (hit) trip(); else if (dist(it.x, it.y, TB.x, TB.y) < TRAD) deliver();
          }
          publish(false);
        } else publish(false);
        // the roach is lit by MY cone? (the judge reacts at once, the others tell it)
        if (!gen && roachOn() && live) {
          const r = roachPos(), lit = dist(bx, by, r[0], r[1]) < radius(powerNow()) - 8;
          litT = lit ? litT + dt : 0; cooldown -= dt;
          if (litT > .25 && cooldown <= 0) { cooldown = .9; if (judge) scare(); else D.send('scare', 1); }
        }
        if (judge) {
          P = clamp(P - DRAIN[n] * dS, 0, 1);
          if (S >= RSTART) { ruT = Math.min(1, ruT + RV * dS * (scared > 0 ? 0 : 1)); if (ru > ruT) ru += (ruT - ru) * Math.min(1, dt * 7); else ru = ruT; }
          if (scared > 0) scared -= dt;
          if (S >= RSTART && ru > .45 && ru < .98 && g.c - ruSnd > .32) { ruSnd = g.c; snd(2100 + ru * 900, .03, 'square', .02); }
          if (g.c - jAt >= .1) { jAt = g.c; D.send('j', [Math.round(P * 1000), Math.round(roachPos()[0]), Math.round(roachPos()[1]), S >= RSTART ? Math.round(ru * 100) : -1, cause], true); }
          if (ru >= .985) { cause = 2; D.send('j', [Math.round(P * 1000), Math.round(AR.x), Math.round(AR.y), 100, 2], true); g.finish('lose'); }
          else if (dl[0] && dl[1] && dl[2]) g.finish('win');
          else if (g.c >= g.limit) { cause = 1; D.send('j', [Math.round(P * 1000), 0, 0, Math.round(ru * 100), 1], true); g.finish('lose'); }
        }
        if (powerNow() < .25 && !wasLow) { wasLow = true; pop('POWER LOW!', 400, 112, 20, '#e8343d'); } else if (powerNow() > .45) wasLow = false;
      }
      if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(300, .5, 'sawtooth', .06, 0, 90); shake(6, .22); }
      else if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .32, 'triangle', .07, .24); }
      for (const h of haz) if (h.w > 0) h.w -= dt;
      while (pops.length && g.c - pops[0].t0 > 1.1) pops.shift();
      for (let i = blips.length - 1; i >= 0; i--) if (g.c - blips[i].t0 > 2.6) blips.splice(i, 1);
    },
    msg(type, d, from) {
      if (type === 'p' && from >= 0 && from < 4 && from !== me) {
        if (from === 3) rem[3].bx.push(d[0] / 100);
        else { rem[from].bx.push(d[0]); rem[from].by.push(d[1]); rem[from].ix.push(d[2]); rem[from].iy.push(d[3]); rem[from].st = d[4]; }
      } else if (type === 'put') { if (judge && from < 3) dl[from] = 1; if (from < 3) rem[from].st = 2; }
      else if (type === 'trip') { fx(d[0], d[1]); if (from < 3) rem[from].st = 0; }
      else if (type === 'blip') { blips.push({ x: d[0], y: d[1], from, t0: g.c }); snd(1040, .18, 'sine', .07, 0, 1500); }
      else if (type === 'tap') { if (judge) addPower(); }
      else if (type === 'scare') scare();
      else if (type === 'j') { if (!judge) { PT.push(d[0] / 1000); rxT.push(d[1]); ryT.push(d[2]); ruR.push(d[3] / 100); cause = d[4]; } }
    },
    aim(x, y) { ptrOn = true; tx = clamp(x, BX0, BX1); ty = clamp(y, BY0, BY1); },
    tap, blip,
    draw(T0) {
      X = ctx; const T = g.c, won = g.result === 'win', over = !!g.result, rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg();
      const pw = powerNow(), rad = radius(pw), frac = clamp(T / Math.max(1, g.limit), 0, 1);
      X.drawImage(BG, 0, 0);
      // light returning through the window as the clock runs down
      const lightK = over && rk >= 0 ? clamp(rk / .25, 0, 1) : 0;
      const dark = over ? 0 : .9 - .22 * frac * frac * frac;
      const ru2 = judge ? ru : Math.max(0, ruR.at() === null ? 0 : ruR.at());
      const rp = roachPos(), hasRoach = roachOn();
      // sources of light: every seat's cone
      const cones = [];
      for (let s = 0; s < n; s++) {
        const b = beamOf(s), hand = HAND[s], r = s === 3 ? 34 + 30 * clamp(pw, 0, 1) : rad;
        const ang = Math.atan2(b[1] - hand[1] + 30, b[0] - hand[0]), px = -Math.sin(ang), py = Math.cos(ang);
        cones.push({ s, x: b[0], y: b[1], r, hx: hand[0], hy: hand[1] - 30, px, py });
      }
      function world(lit) {
        for (const h of haz) junk(h.k, h.x, h.y, T, h.w > 0 ? 1 : 0);
        // the arepa on the table (the roach steals it)
        if (!(over && cause === 2 && rk > .35)) arepa(AR.x, AR.y + 2, over && cause === 2);
        for (let s = 0; s < 3; s++) { const q = itemOf(s); drawKind(s, q[0], q[1] + (q[2] === 1 ? Math.sin(T * 14) * 2 : 0), q[2] === 2 ? .9 : 1.15, won && q[2] === 2 && s === 0, T); }
        if (hasRoach) {
          const stolen = over && cause === 2 && rk > .05;
          if (stolen) { const kk = Math.max(0, rk - .35), rx = AR.x - kk * 260, ry = AR.y + 22 + kk * 40; roach(rx, ry, -Math.PI / 2 + .25, T, 1.4, false); X.save(); X.translate(rx, ry - 12); arepa(0, -12, true); X.restore(); }
          else roach(rp[0], rp[1], Math.atan2(AR.y - rp[1], AR.x - rp[0]) - Math.PI / 2, T, 1.1, false);
        }
        abuela(566, 478, 5.2, won && rk > .1 ? 'happy' : null, T, over && !won);
      }
      if (!dark) {
        world(true);
      } else {
        X.fillStyle = `rgba(6,5,30,${dark})`; X.fillRect(0, 0, W, H);
        // moonlit window + table are faintly visible; everything else only inside the cones
        X.save(); X.beginPath();
        for (const c of cones) {
          X.moveTo(c.x + c.r, c.y); X.arc(c.x, c.y, c.r, 0, TAU);
          const a = [c.hx, c.hy], b = [c.x + c.px * c.r, c.y + c.py * c.r], d = [c.x - c.px * c.r, c.y - c.py * c.r];
          const area = a[0] * b[1] - b[0] * a[1] + b[0] * d[1] - d[0] * b[1] + d[0] * a[1] - a[0] * d[1];
          X.moveTo(a[0], a[1]); if (area >= 0) { X.lineTo(b[0], b[1]); X.lineTo(d[0], d[1]); } else { X.lineTo(d[0], d[1]); X.lineTo(b[0], b[1]); } X.closePath();
        }
        X.clip();
        X.drawImage(BG, 0, 0);
        world(false);
        for (const c of cones) {
          const gr = X.createRadialGradient(c.x, c.y, c.r * .25, c.x, c.y, c.r);
          gr.addColorStop(0, 'rgba(255,240,170,.2)'); gr.addColorStop(.7, 'rgba(255,225,140,.1)'); gr.addColorStop(1, 'rgba(6,5,30,.62)');
          X.fillStyle = gr; X.beginPath(); X.arc(c.x, c.y, c.r, 0, TAU); X.fill();
        }
        X.restore();
        // cat's eyes in the dark (the background gag)
        const ck = T * .5 % 6, ex = 120 + (Math.floor(T * .5 / 6) * 311) % 560;
        if (ck > 3.2 && ck < 5.3) { X.fillStyle = '#9dff6a'; for (const sx of [-9, 9]) { el(ex + sx + Math.sin(ck * 2) * 40, 322, 4, 6 * (Math.sin(T * 5) > .93 ? .2 : 1)); X.fill(); } }
      }
      // power-company glow in the window
      if (!over && frac > .5) { X.fillStyle = `rgba(255,190,80,${(frac - .5) * .5})`; X.fillRect(322, 84, 156, 130); }
      // the seats: Caos with flashlights, name tags
      for (let s = 0; s < n; s++) {
        const c = cones[s], h = HAND[s], mood = won ? 'happy' : over ? 'sad' : null;
        caos(h[0], h[1], 3.4, { col: cols(s), mood });
        if (over && !won && cause === 1) { X.fillStyle = INK; rr(h[0] - 5.2 * 3.4 - 2, h[1] - 6.2 * 3.4 - 2, 10.4 * 3.4 + 4, 4 * 3.4 + 4, 4); X.fill(); rr(h[0] - 5.2 * 3.4, h[1] - 6.2 * 3.4, 10.4 * 3.4, 4 * 3.4, 3); ink('#ff5d7e', 2); X.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { X.beginPath(); X.arc(h[0] - 12 + k * 8, h[1] - 18 + (k % 2) * 5, 2, 0, TAU); X.fill(); } }
        if (!over && (s < 3 || gen)) {
          const a = Math.atan2(c.y - c.hy, c.x - c.hx); X.save(); X.translate(h[0] + Math.cos(a) * 16, h[1] - 30 + Math.sin(a) * 16); X.rotate(a);
          rr(-12, -6, 24, 12, 3); ink('#9aa0b5', 2.5); rr(8, -8, 9, 16, 3); ink('#ffe14d', 2.5); X.restore();
        }
        pill(h[0], h[1] + 24, s === me ? 'YOU' : name(s), cols(s));
      }
      // generator crank + a tiny battery above it
      { const gx = 702, gy = 489, ca = gen ? crank : (rem[3].bx.at() || crank); X.save(); X.translate(gx, gy); X.rotate(ca);
        line([[0, 0], [22, 0]], 6, INK); line([[0, 0], [22, 0]], 3, '#ffe14d'); X.beginPath(); X.arc(22, 0, 7, 0, TAU); ink('#ff7a3d', 2.5); X.restore(); }
      // radar blips (always visible)
      for (const b of blips) { const k = (T - b.t0) / 2.6; X.save(); X.globalAlpha = 1 - k * k; for (let i = 0; i < 2; i++) { const kk = (k * 1.4 + i * .45) % 1; el(b.x, b.y, 14 + kk * 70, 14 + kk * 70); X.lineWidth = 4; X.strokeStyle = cols(b.from); X.stroke(); } el(b.x, b.y, 7, 7); ink(cols(b.from), 2.5); X.restore(); if (k < .75) pill(b.x, b.y - 30, '!', cols(b.from)); }
      // HUD: power battery + the clock bulb
      { const bw = 190, bx0 = 400 - bw / 2, by0 = 66, k = clamp(pw, 0, 1), low = k < .25;
        rr(bx0 - 4, by0 - 4, bw + 8, 28, 8); ink(low && Math.sin(T * 14) > 0 ? '#e8343d' : '#2b2640', 3.5);
        X.fillStyle = k > .5 ? '#5CFF7A' : k > .25 ? '#FFE14D' : '#ff4d4d'; rr(bx0, by0, bw * k, 20, 5); X.fill(); rr(bx0 + bw + 4, by0 + 5, 7, 10, 2); ink('#2b2640', 2);
        txt('POWER', bx0 - 52, by0 + 11, 15, '#fff');
        X.beginPath(); X.arc(600, 78, 14, 0, TAU); ink('#fff7e6', 3); X.beginPath(); X.moveTo(600, 78); X.arc(600, 78, 14, -Math.PI / 2, -Math.PI / 2 + TAU * frac); X.closePath(); X.fillStyle = '#ffd23f'; X.fill();
        rr(594, 92, 12, 8, 2); ink('#8f9cb3', 2); }
      // the buttons (touch) + the cue banners
      if (!over) {
        if (gen) { const k = Math.max(0, 1 - (T - tapAt) * 6); X.beginPath(); X.arc(400, 500, 46 + k * 8, 0, TAU); ink('#ff7a3d', 4); txt('CRANK!', 400, 500, 22, '#fff', 'center', 80); }
        else {
          X.beginPath(); X.arc(330, 510, 34, 0, TAU); ink(blipUsed ? '#6c6785' : cols(me), 4); txt(blipUsed ? 'USED' : 'BLIP', 330, 510, 15, blipUsed ? '#ddd' : INK, 'center', 56);
          X.beginPath(); X.arc(470, 510, 34, 0, TAU); ink('#ffe14d', 4); txt('DYNAMO', 470, 510, 14, INK, 'center', 58);
        }
        if (T < 2.8) badge(gen ? 'KEEP THE POWER UP!' : 'BRING IT TO THE TABLE!', 400, 118, 22, gen ? '#ff7a3d' : '#2b9ee6', '#fff', outBack(T / .25), -.03);
        if (hasRoach && ru2 > .62 && Math.sin(T * 12) > -.4) badge('ROACH!', 400, 150, 22, '#e8343d', '#fff', 1, .04);
        if (frac > .72) badge('THE LIGHT IS COMING!', 400, 192, 19, '#ffb020', '#fff', 1, -.03);
      }
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 20, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      // payoffs
      if (over && rk >= 0) {
        if (lightK < 1) { X.fillStyle = `rgba(255,248,210,${.85 * (1 - lightK)})`; X.fillRect(0, 0, W, H); }
        if (won) {
          if (rk > .12) badge('WOO!', 400, 130, 38, '#22a447', '#fff', outBack((rk - .12) / .25), -.04);
          if (rk > .5) badge('CANDLES LIT!', 400, 188, 24, '#ff9a2e', '#fff', outBack((rk - .5) / .25), .03);
        } else if (cause === 2) { if (rk > .2) badge('THE ROACH TOOK THE AREPA!', 400, 140, 26, '#e8343d', '#fff', outBack((rk - .2) / .25), .03); }
        else { if (rk > .15) badge('THE POWER IS BACK!', 400, 132, 30, '#ffb020', '#fff', outBack((rk - .15) / .25), -.03); if (rk > .55) badge('CAUGHT IN UNDERWEAR!', 400, 190, 24, '#e8343d', '#fff', outBack((rk - .55) / .25), .04); }
      }
      vignette(.14);
    },
    down(p) {
      if (g.result) return;
      if (gen) { tap(); return; }
      if (dist(p.x, p.y, 470, 510) < 40) { tap(); return; }
      if (dist(p.x, p.y, 330, 510) < 40) { blip(); return; }
      ptrOn = true; g.aim(p.x, p.y - (TOUCH ? 30 : 0));
    },
    move(p) { if (!gen && !g.result && (ptrOn || !TOUCH)) { if (!ptrOn && !TOUCH) ptrOn = true; g.aim(p.x, p.y - (TOUCH ? 30 : 0)); } },
    up() { },
    key(e) {
      const c = e.code;
      if (c === 'Space' || c === 'Enter') tap();
      else if (c === 'KeyB' || c === 'KeyE') blip();
      else if (c === 'ArrowLeft' || c === 'KeyA') kx = -1; else if (c === 'ArrowRight' || c === 'KeyD') kx = 1;
      else if (c === 'ArrowUp' || c === 'KeyW') ky = -1; else if (c === 'ArrowDown' || c === 'KeyS') ky = 1;
    },
    keyup(e) {
      const c = e.code;
      if (c === 'ArrowLeft' || c === 'KeyA' || c === 'ArrowRight' || c === 'KeyD') kx = 0;
      else if (c === 'ArrowUp' || c === 'KeyW' || c === 'ArrowDown' || c === 'KeyS') ky = 0;
      if (!kx && !ky) { tx = bx; ty = by; }
    },
  };
  /* what a role can honestly see: its own cone only (items / junk / roach inside it), the table and its own corner */
  g.dbg = {
    view: () => {
      const r = radius(powerNow()) - 6, inC = (x, y) => !gen && dist(bx, by, x, y) < r;
      const rpz = roachPos();
      return { me, n, bx, by, P: powerNow(), st: it.st, ix: it.x, iy: it.y, home: B0[me], r,
        itemSeen: inC(it.x, it.y), haz: haz.filter(h => inC(h.x, h.y)).map(h => [h.x, h.y]), roach: roachOn() && inC(rpz[0], rpz[1]) ? rpz : null, table: [TB.x, TB.y], S };
    },
    haz, home, judge: () => ({ dl, ru, P, cause }),
  };
  wire(g, D, 0, sp, 'sq_velas');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  X = ctx;
  const u = t % 4, k = ease(clamp(u / 2.4, 0, 1)), gen = role === 3;
  X.fillStyle = '#e0b97c'; X.fillRect(0, 0, 520, 104); X.fillStyle = '#b9532f'; X.fillRect(0, 104, 520, 136); X.fillStyle = INK; X.fillRect(0, 100, 520, 8);
  const bx = lerp(90, 392, k), by = lerp(176, 164, k), r = 62;
  if (!gen) {
    X.save(); X.beginPath(); X.arc(bx, by, r, 0, TAU); X.clip();
    X.fillStyle = '#e0b97c'; X.fillRect(0, 0, 520, 104); X.fillStyle = '#b9532f'; X.fillRect(0, 104, 520, 136);
    const q = u < .6 ? [90, 176] : [bx, by];
    drawKind(role, q[0], q[1] + 4, 1.4, false, t);
    X.restore();
  }
  X.fillStyle = 'rgba(6,5,30,.86)'; X.beginPath(); X.rect(0, 0, 520, 240);
  if (!gen) X.arc(bx, by, r, 0, TAU, true); else X.arc(420, 150, 70, 0, TAU, true);
  X.fill();
  X.save(); X.beginPath(); X.arc(gen ? 420 : bx, gen ? 150 : by, gen ? 70 : r, 0, TAU); X.clip();
  X.fillStyle = '#e0b97c'; X.fillRect(0, 0, 520, 104); X.fillStyle = '#b9532f'; X.fillRect(0, 104, 520, 136); X.restore();
  el(430, 188, 62, 22); ink('#fff7e6', 3); X.beginPath(); X.arc(430, 180, 15, 0, TAU); ink('#efc26b', 3);
  if (!gen) {
    caos(60, 214, 3, { col: COLS[role] });
    if (u > 2.3) drawKind(role, 430 + SLOT[role % 3][0] * .6, 168 + SLOT[role % 3][1] * .3, 1.2, false, t);
    demoFinger(lerp(90, 392, k), lerp(200, 188, k), u < 2.6, 0);
    badge(['FETCH CANDLE!', 'FETCH MATCHES!', 'FETCH HOLDER!'][role % 3], 260, 28, 18, '#2b9ee6', '#fff', 1, -.03);
  } else {
    const bar = .35 + .5 * Math.abs(Math.sin(t * 2.5));
    rr(170, 20, 180, 22, 6); ink('#2b2640', 3); X.fillStyle = '#5CFF7A'; rr(173, 23, 174 * bar, 16, 4); X.fill();
    rr(340, 140, 110, 60, 8); ink('#4b8a4f', 4); X.save(); X.translate(395, 170); X.rotate(t * 6); line([[0, 0], [26, 0]], 6, INK); line([[0, 0], [26, 0]], 3, '#ffe14d'); X.restore();
    demoFinger(200, 190, (t * 4) % 1 < .5, ((t * 4) % 1) * 2);
    badge('CRANK IT!', 260, 76, 20, '#ff7a3d', '#fff', 1, -.03);
  }
}
reg('sq_velas', sqVelas, 'CANDLE CIRCLE'); REGMAP.sq_velas.duo = true; REGMAP.sq_velas.squad = true;
DUO.INFO.sq_velas = n => [
  ['CANDLE', 'FIND IT IN THE DARK, CARRY IT TO THE TABLE', 'MOVE THE FLASHLIGHT: ARROWS OR DRAG'],
  ['MATCHES', 'FIND IT IN THE DARK, CARRY IT TO THE TABLE', 'MOVE THE FLASHLIGHT: ARROWS OR DRAG'],
  ['HOLDER', 'FIND IT IN THE DARK, CARRY IT TO THE TABLE', 'MOVE THE FLASHLIGHT: ARROWS OR DRAG'],
  ['GENERATOR', 'KEEP THE POWER UP FOR EVERYONE', 'TAP FAST: SPACE / CLICK / TAP'],
].slice(0, n);
DUO.DEMOS.sq_velas = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
