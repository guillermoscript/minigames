'use strict';
/* ═════════ SQUAD · CIRCUS TOWER (sq_circus) ═════════
   Inside the big top a human tower of tiny Claudes (one per seat) has to stay up until the curtain call.
   Level 0 (role 0, JUDGE) rides a unicycle, the next levels stand on its head: STRONGMAN, ACROBAT and (4 seats) a JUGGLER on top.
   Every level is a little unstable pendulum that owns its own tilt `a` (rad, + = leaning right): a' = LAM*a + wobble(t) + force(t) + KCP*lowerTilt + CC*u.
   The player holds ◄ / ► (or A / D, or drags the left / right side) = u, which tilts the level back. Idle = it topples by itself in a few seconds.
   Events come from the seeded schedule (the same on every screen, each seat applies them to its own level): a GUST pushes every level,
   a TOMATO from the stands hits one level, the lion's SNEEZE blows the two lowest ones. Each is announced ~0.9 s before.
   The unicycle also rolls where the tower leans (x' = XK*a_0): the judge wins only if the unicycle sits on the X at the curtain call,
   and the X hops to the other side of the ring half way.
   Netcode: every seat publishes only its own tilt 'a' (coalesced ≤10/s; the base sends [a, x]); the others draw it ~150 ms behind (track()).
   A seat whose tilt passes FALL sends 'fall'; the judge (base) turns that into 'lose'. At the curtain call the judge checks the X and finishes.
   Win = the tower bows in a rain of flowers; lose = it folds like an accordion. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const GY = 478;                                      // the ground under the unicycle
const SEAT = 58, WR = 25;                            // saddle height / wheel radius
const U = [4.8, 4.4, 4.0, 3.6];                      // size of each level's Claude (the tower narrows)
const BHT = U.map(u => 9 * u);                     // feet-to-feet height of one level
const FALL = .5, XMIN = 190, XMAX = 610, ONX = 80;   // topple angle, where the unicycle can roll, how close to the X counts
const LAM = [.55, .75, .95, 1.15], CC = [1.05, 1.0, 1.0, 1.0], AMP = [.2, .22, .24, .26];   // each level's feel: heavy and slow at the bottom, twitchy at the top
const KCP = .3, XK = 240, SCHG = 7.2, SEND = 15.2;   // coupling from the level below, roll speed per rad, when the X hops, length of the show (sim seconds)
const TAU_EV = [.55, .3, .4];                        // how long each event pushes (gust, tomato, sneeze)
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const CCOL = ['#D97757', '#8fb7ff', '#ffd166', '#b6e388', '#f49ac2', '#c9b6ff'];
const RED = '#d9435a', CREAM = '#f6e7c1', GOLD = '#ffcf33', GOLD2 = '#d99a12', WOOD = '#8a5a3c', WOOD2 = '#5b3a2a';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function pill(x, y, label, col) {
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(150, X.measureText(s).width + 26);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(250, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 250);
  X.restore();
}
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function drop(x, y, r) {
  X.beginPath(); X.moveTo(x, y - r * 1.7); X.quadraticCurveTo(x + r * 1.1, y - r * .2, x, y + r); X.quadraticCurveTo(x - r * 1.1, y - r * .2, x, y - r * 1.7); X.closePath();
  ink('#7fd8ff', 2); X.fillStyle = 'rgba(255,255,255,.75)'; el(x - r * .3, y - r * .3, r * .28, r * .4, -.4); X.fill();
}
function flower(x, y, r, col, rot) {
  X.save(); X.translate(x, y); X.rotate(rot);
  for (let i = 0; i < 5; i++) { X.save(); X.rotate(i * TAU / 5); el(0, -r * .62, r * .42, r * .55); ink(col, 2); X.restore(); }
  X.beginPath(); X.arc(0, 0, r * .34, 0, TAU); ink(GOLD, 2); X.restore();
}

/* ───────────── the big top, painted once ───────────── */
const CROWD = [];                                    // 4 stepped rows of tiny Claudes (drawn live: they cheer / gasp)
for (let r = 0; r < 4; r++) for (let i = 0; i < 19; i++) { const h = (i * 37 + r * 101) % 97; CROWD.push({ x: 18 + i * 43 + (r % 2) * 21 + (h % 7 - 3), y: 146 + r * 36, ph: h * .37, col: CCOL[(i + r * 3) % CCOL.length], r }); }
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  // tent wall: stripes radiating from the peak
  for (let k = 0; k < 18; k++) { const x0 = 400 + (k - 9) * 100; X.beginPath(); X.moveTo(400, -240); X.lineTo(x0, 312); X.lineTo(x0 + 100, 312); X.closePath(); X.fillStyle = k % 2 ? CREAM : RED; X.fill(); }
  let g = X.createLinearGradient(0, 0, 0, 312); g.addColorStop(0, 'rgba(30,10,40,.55)'); g.addColorStop(.6, 'rgba(30,10,40,.1)'); g.addColorStop(1, 'rgba(30,10,40,.25)'); X.fillStyle = g; X.fillRect(0, 0, W, 312);
  // stands: benches + risers
  for (let r = 0; r < 4; r++) { const y = 146 + r * 36; X.fillStyle = WOOD2; X.fillRect(0, y - 2, W, 36); X.fillStyle = WOOD; X.fillRect(0, y - 2, W, 11); X.fillStyle = 'rgba(0,0,0,.25)'; X.fillRect(0, y + 22, W, 12); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, y - 2); X.lineTo(W, y - 2); X.stroke(); }
  // valance + scallops at the top
  X.fillStyle = '#8c1d34'; X.fillRect(0, 0, W, 50); X.fillStyle = GOLD; X.fillRect(0, 44, W, 8);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 52); X.lineTo(W, 52); X.stroke();
  for (let i = 0; i < 16; i++) { X.beginPath(); X.arc(i * 50 + 25, 52, 25, 0, Math.PI); ink(i % 2 ? CREAM : RED, 3); }
  // tent poles at both sides
  for (const px of [26, 774]) { X.fillStyle = INK; X.fillRect(px - 12, 52, 24, 262); X.fillStyle = '#e9d6a6'; X.fillRect(px - 8, 52, 16, 262); for (let y = 66; y < 300; y += 36) { X.fillStyle = RED; X.fillRect(px - 8, y, 16, 16); } X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(px - 6, 52, 4, 262); }
  // the ring barrier (red and cream planks)
  X.fillStyle = INK; X.fillRect(0, 288, W, 38); for (let i = 0; i < 17; i++) { X.fillStyle = i % 2 ? CREAM : RED; X.fillRect(i * 50 + 3, 292, 44, 30); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(i * 50 + 6, 294, 38, 6); }
  X.fillStyle = GOLD; X.fillRect(0, 282, W, 8); X.strokeStyle = INK; X.lineWidth = 3; X.strokeRect(-2, 282, W + 4, 8);
  // sawdust floor + the painted ring
  g = X.createLinearGradient(0, 326, 0, H); g.addColorStop(0, '#d7a869'); g.addColorStop(1, '#efd29d'); X.fillStyle = g; X.fillRect(0, 326, W, H - 326);
  let s = 7; for (let i = 0; i < 220; i++) { s = s * 16807 % 2147483647; const px = s % W, py = 330 + (s >> 4) % 270; X.fillStyle = i % 3 ? 'rgba(120,70,30,.28)' : 'rgba(255,245,215,.5)'; X.fillRect(px, py, 3 + i % 3, 2); }
  el(400, GY, 350, 80); X.fillStyle = 'rgba(255,240,200,.45)'; X.fill(); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#fff'; X.stroke();
  el(400, GY, 350, 80); X.lineWidth = 3; X.strokeStyle = RED; X.setLineDash([22, 22]); X.stroke(); X.setLineDash([]);
  // the lion's box seat (red velvet armchair on the barrier, left)
  rr(60, 214, 104, 74, 10); ink('#a3243c', 4); rr(52, 244, 24, 48, 8); ink('#c2304a', 4); rr(148, 244, 24, 48, 8); ink('#c2304a', 4);
  X = old; return cv2;
}

/* ───────────── the tower ───────────── */
const LX = new Float64Array(4), LY = new Float64Array(4);
function layout(AA, sy, n, bx) {
  for (let i = 0; i < n; i++) {
    if (!i) { LX[0] = bx + Math.sin(AA[0]) * SEAT * sy[0]; LY[0] = GY - Math.cos(AA[0]) * SEAT * sy[0]; }
    else { const h = BHT[i - 1] * sy[i - 1]; LX[i] = LX[i - 1] + Math.sin(AA[i - 1]) * h; LY[i] = LY[i - 1] - Math.cos(AA[i - 1]) * h; }
  }
}
function unicycle(spin, T) {                         // origin = the ground under the wheel
  X.save(); X.translate(0, -WR);
  X.beginPath(); X.arc(0, 0, WR, 0, TAU); X.lineWidth = 14; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = '#4b4560'; X.stroke();
  X.save(); X.rotate(spin); for (let i = 0; i < 4; i++) { X.rotate(Math.PI / 4); line([[-WR + 3, 0], [WR - 3, 0]], 4.5, INK); line([[-WR + 3, 0], [WR - 3, 0]], 2, '#e8e2f5'); } X.restore();
  X.beginPath(); X.arc(0, 0, 6, 0, TAU); ink(GOLD, 2.5);
  X.restore();
  line([[0, -WR], [0, -SEAT + 8]], 11, INK); line([[0, -WR], [0, -SEAT + 8]], 5, '#ff9a4d');
  rr(-17, -SEAT + 2, 34, 9, 4); ink('#d9435a', 3);
}
function accessories(kind, i, u, A, T, front) {      // local frame: feet at the origin, y up is negative
  if (kind === 0) { if (front) { X.beginPath(); X.arc(0, -5.1 * u, .9 * u, 0, TAU); ink('#ff3d3d', 2); X.fillStyle = 'rgba(255,255,255,.7)'; el(-.25 * u, -5.4 * u, .25 * u, .18 * u); X.fill(); } }
  else if (kind === 1) {
    if (front) { for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * .3 * u, -4.2 * u); X.quadraticCurveTo(sx * 2.1 * u, -3.8 * u, sx * 3.1 * u, -5 * u); X.quadraticCurveTo(sx * 2.4 * u, -3 * u, sx * .3 * u, -3.1 * u); X.closePath(); ink('#3a2a22', 1.6); } }
    else for (const sx of [-1, 1]) { line([[sx * 9.7 * u, -6.5 * u], [sx * 9.7 * u, -9.6 * u]], 1.4 * u, INK); line([[sx * 9.7 * u, -6.5 * u], [sx * 9.7 * u, -9.6 * u]], .7 * u, '#bdb6d0'); for (const yy of [-9.6, -6.5]) { X.beginPath(); X.arc(sx * 9.7 * u, yy * u, 1.45 * u, 0, TAU); ink('#6d6785', 2.5); } }
  } else if (kind === 2) {
    if (!front) { X.save(); X.translate(0, -6.6 * u); X.rotate(-A * .9); line([[-15 * u, 0], [15 * u, 0]], 1.5 * u, INK); line([[-15 * u, 0], [15 * u, 0]], .7 * u, '#d9a066'); for (const sx of [-1, 1]) { X.beginPath(); X.arc(sx * 15 * u, 0, 1.5 * u, 0, TAU); ink(sx < 0 ? '#ff4d6d' : '#4db8ff', 2.5); } X.restore(); }
    else { star(0, -9.8 * u, 1.5 * u, .6 * u, 5, T * 2, '#ff8fb1', 2); }
  } else {
    if (front) {
      tri(-4.6 * u, -8.6 * u, -3.6 * u, -13.8 * u, -.4 * u, -8.6 * u, '#ff4d6d', 2.5); tri(4.6 * u, -8.6 * u, 3.6 * u, -13.8 * u, .4 * u, -8.6 * u, '#4db8ff', 2.5); tri(-3.4 * u, -8.6 * u, 0, -15.4 * u, 3.4 * u, -8.6 * u, GOLD, 2.5);
      X.beginPath(); X.arc(-3.6 * u, -14.2 * u, .75 * u, 0, TAU); ink('#fff', 2); X.beginPath(); X.arc(3.6 * u, -14.2 * u, .75 * u, 0, TAU); ink('#fff', 2);
    } else for (let j = 0; j < 3; j++) { const an = T * 4.2 + j * TAU / 3, bx = Math.cos(an) * 8.4 * u, by = -7.5 * u - (Math.sin(an) * .5 + .5) * 8 * u; X.beginPath(); X.arc(bx, by, 1.15 * u, 0, TAU); ink(['#ff4d6d', '#5CFF7A', '#4db8ff'][j], 2.5); }
  }
}
/* one level at its feet (x, y), absolute angle A, vertical squash sy. level 0 is drawn around the wheel contact (x = base x, y = GY) */
function level(i, kind, x, y, A, sy, col, mood, T, spin, danger, splat) {
  const u = U[i];
  X.save(); X.translate(x, y); X.rotate(A); X.scale(1, sy);
  if (i === 0) { unicycle(spin, T); X.translate(0, -SEAT); }
  accessories(kind, i, u, A, T, false);
  claude(0, 0, u, { col, mood });
  accessories(kind, i, u, A, T, true);
  if (danger > .1) { const w = Math.sin(T * 30) * .6; for (const sx of [-1, 1]) drop(sx * (7.6 * u) + w, -8.4 * u + ((T * 5 + sx) % 1) * 1.8 * u, .45 * u * danger + .2 * u); }
  if (splat > 0) {
    X.globalAlpha = Math.min(1, splat * 2); const sw = 1 + (1 - splat) * .35;
    X.beginPath(); X.moveTo(.8 * u, -6.6 * u); X.quadraticCurveTo(2 * u * sw, -9 * u, 3.6 * u * sw, -7 * u); X.quadraticCurveTo(5.6 * u * sw, -5 * u, 3.4 * u, -3.8 * u); X.quadraticCurveTo(2.8 * u, -2.4 * u * sw, 1.2 * u, -4 * u); X.quadraticCurveTo(-.4 * u, -5.4 * u, .8 * u, -6.6 * u); X.closePath(); ink('#e8343d', 2.5);
    X.fillStyle = '#fff4b0'; for (const [qx, qy] of [[2, -6.6], [3.4, -5.2], [1.6, -4.8]]) { el(qx * u, qy * u, .35 * u, .2 * u); X.fill(); }
    for (const dx of [1.4, 3]) { X.beginPath(); X.moveTo(dx * u, -3.6 * u); X.lineTo(dx * u, (-2.4 + (1 - splat) * 2.6) * u); X.lineWidth = .7 * u; X.strokeStyle = '#e8343d'; X.lineCap = 'round'; X.stroke(); }
    X.globalAlpha = 1;
  }
  X.restore();
}

/* ───────────── the audience, the lion, the ringmaster ───────────── */
function crowd(T, st, hot) {                         // st: 0 normal, 1 cheer, 2 gasp; hot: 0..1 wind / excitement
  for (const p of CROWD) {
    const bob = st === 1 ? -Math.abs(Math.sin(T * 9 + p.ph)) * 10 : st === 2 ? 0 : Math.sin(T * 2.4 + p.ph) * .9 + (hot ? Math.sin(T * 30 + p.ph) * hot * 1.2 : 0);
    const x = p.x, y = p.y + bob, up = st === 1 ? 14 + Math.sin(T * 12 + p.ph) * 5 : 0;
    X.fillStyle = INK; X.fillRect(x - 17.5, y - 14.5 - up, 7, 8 + up); X.fillRect(x + 10.5, y - 14.5 - up, 7, 8 + up);
    X.fillStyle = p.col; X.fillRect(x - 16, y - 13 - up, 4, 6 + up); X.fillRect(x + 12, y - 13 - up, 4, 6 + up);
    rr(x - 12, y - 20, 24, 20, 3); ink(p.col, 2.5);
    X.fillStyle = INK;
    if (st === 1) { X.lineWidth = 2.2; X.strokeStyle = INK; X.lineCap = 'round'; for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(x + sx * 5 - 3, y - 10); X.lineTo(x + sx * 5, y - 13); X.lineTo(x + sx * 5 + 3, y - 10); X.stroke(); } }
    else { const dx = hot ? hot * 1.5 : 0; for (const sx of [-1, 1]) { X.beginPath(); X.arc(x + sx * 5 + dx, y - 11, st === 2 ? 1.5 : 2.3, 0, TAU); X.fill(); } if (st === 2) { X.beginPath(); X.arc(x, y - 4, 2.4, 0, TAU); X.fill(); } }
  }
}
function lion(x, y, T, sniff, sn, card, hide) {      // sits at (x, y) = the cushion; sniff 0..1 before the sneeze, sn 0..1 during it
  const puff = 1 + sniff * .06 * Math.sin(T * 26) + sn * .1;
  star(x, y - 56, 40 * puff, 31 * puff, 14, T * .15, '#b8591f', 3.5);
  rr(x - 26, y - 38, 52, 40, 12); ink('#e9a64c', 3.5);                       // body
  X.beginPath(); X.arc(x, y - 56, 25, 0, TAU); ink('#f4b860', 3.5);          // face
  for (const sx of [-1, 1]) { X.beginPath(); X.arc(x + sx * 22, y - 76, 8, 0, TAU); ink('#e9a64c', 3); }
  el(x, y - 48, 13, 9); ink('#ffe3b0', 2.5); tri(x - 5, y - 54, x + 5, y - 54, x, y - 47, '#ff7ea8', 2.2);
  const sneezing = sn > 0;
  for (const sx of [-1, 1]) {                                                  // eyes behind reading glasses
    const ex = x + sx * 10, ey = y - 62;
    if (sneezing || hide) { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 4, ey - 2); X.lineTo(ex + 4, ey + 1); X.moveTo(ex + 4, ey - 4); X.lineTo(ex - 4, ey + 3); X.stroke(); }
    else { el(ex, ey, 6, 6); ink('#fff', 2); X.fillStyle = INK; X.beginPath(); X.arc(ex, ey + 2.5, 2.4, 0, TAU); X.fill(); }
    X.beginPath(); X.arc(ex, ey, 9, 0, TAU); X.lineWidth = 2.5; X.strokeStyle = GOLD2; X.stroke();
  }
  line([[x - 1, y - 62], [x + 1, y - 62]], 2.5, GOLD2);
  if (sneezing) { el(x, y - 40, 7, 5 + sn * 4); ink('#7a1f2e', 2.2); } else { X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y - 40); X.quadraticCurveTo(x, y - 36 - (hide ? -5 : 0), x + 6, y - 40); X.stroke(); }
  if (card) {                                                                  // win: a score card
    rr(x - 34, y - 46, 68, 52, 6); ink('#fff', 3.5); txt('10', x, y - 20, 36, '#e8434f');
  } else {                                                                     // the newspaper (flies off when he sneezes)
    const fly = ease(sn), nx = x + fly * 70 + (sniff ? Math.sin(T * 40) * 1.2 : 0), ny = y - 16 - (hide ? 36 : 0) - fly * 70;
    X.save(); X.translate(nx, ny); X.rotate(fly * 2.4 + (hide ? 0 : -.04));
    rr(-32, -22, 64, 44, 3); ink('#f2efe4', 3); X.fillStyle = INK; X.fillRect(-26, -16, 52, 8); X.fillStyle = '#9a96ab'; for (let k = 0; k < 3; k++) X.fillRect(-26 + (k % 2) * 3, -3 + k * 7, 52 - (k % 2) * 8, 3);
    X.restore();
    for (const sx of [-1, 1]) { X.beginPath(); X.arc(nx + sx * 30 * (1 - fly), ny + 14, 7, 0, TAU); ink('#f4b860', 3); }   // paws
  }
}
function ringmaster(x, y, col, mood, hatLift, hatFall, watchK, T) {
  shadow(x, y + 3, 28, 7, .22);
  claude(x, y, 3.6, { col: '#e8434f', mood });
  const hy = y - 9 * 3.6 - 6 - hatLift + hatFall;
  X.save(); X.translate(x + hatFall * .8, hy); X.rotate(hatFall * .03 + hatLift * .02);
  rr(-17, -2, 34, 7, 3); ink('#2f2a4a', 3); rr(-11, -26, 22, 26, 3); ink('#2f2a4a', 3); X.fillStyle = GOLD; X.fillRect(-11, -7, 22, 5); X.restore();
  const wx = x - 28, wy = y - 28;                                              // the stopwatch: its hand sweeps once during the show
  line([[x - 20, y - 20], [wx, wy]], 5, INK); X.beginPath(); X.arc(wx, wy, 13, 0, TAU); ink('#fff', 3.5);
  line([[wx, wy], [wx + Math.sin(watchK * TAU) * 9, wy - Math.cos(watchK * TAU) * 9]], 2.5, '#e8434f'); X.beginPath(); X.arc(wx, wy - 15, 3, 0, TAU); ink(GOLD, 1.5);
}
function bunting(T, wind) {
  X.beginPath(); for (let i = 0; i <= 16; i++) { const x = i * 50, y = 96 + 12 * Math.sin(i / 16 * Math.PI) ; i ? X.lineTo(x, y) : X.moveTo(x, y); }
  X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  for (let i = 0; i < 16; i++) { const x = i * 50 + 25, y = 96 + 12 * Math.sin((i + .5) / 16 * Math.PI), sw = Math.sin(T * 3 + i) * 2 + wind * (6 + Math.sin(T * 17 + i) * 3); tri(x - 11, y, x + 11, y, x + sw, y + 20, ['#ff4d6d', '#ffd23f', '#4db8ff', '#7CE08A'][i % 4], 2.5); }
}
function curtain(k, left, T) {                       // the red curtain slides in from the sides toward the curtain call
  const w = 24 + 36 * k; X.save(); if (!left) { X.translate(W, 0); X.scale(-1, 1); }
  X.beginPath(); X.moveTo(0, 0); X.lineTo(w, 0); X.bezierCurveTo(w + 14, 160, w - 6, 340, w + 8, 560); X.lineTo(0, 560); X.closePath(); ink('#b81e3c', 4);
  X.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 1; i < 4; i++) X.fillRect(w * i / 4 - 2, 0, 5, 560); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(w * .12, 0, 5, 560);
  X.fillStyle = GOLD; X.fillRect(0, 0, w + 6, 8); X.restore();
}
function keycap(x, y, dir, on, big) {
  const s = big ? 64 : 52; X.save(); X.translate(x, y + (on ? 4 : 0)); X.globalAlpha = big ? .85 : 1;
  rr(-s / 2, -s / 2 + (on ? 0 : -5), s, s, 10); ink(on ? '#ffe14d' : '#fff', 4); X.fillStyle = 'rgba(0,0,0,.14)'; rr(-s / 2 + 4, s / 2 - 12 + (on ? 0 : -5), s - 8, 8, 4); X.fill();
  tri(dir * 14, -5, -dir * 10, -19, -dir * 10, 9, INK, 0); X.fillStyle = INK; X.fill(); X.restore();
}
function arrowCue(x, y, dir, k, T) {                 // "press this way": a chunky arrow that pulses with how late you are
  const s = 1 + Math.sin(T * 14) * .1, r = 16 + 14 * k;
  X.save(); X.translate(x + dir * Math.sin(T * 14) * 3, y); X.scale(s, s);
  tri(dir * r * 1.3, 0, -dir * r * .2, -r, -dir * r * .2, r, k > .6 ? '#ff3d3d' : '#ffe14d', 4);
  X.restore();
}
function spotMark(x, on, T, alpha) {
  X.save(); X.globalAlpha = alpha; const pul = 1 + Math.sin(T * 6) * .04;
  el(x, GY + 6, ONX * pul, 20 * pul); ink(on ? 'rgba(92,255,122,.6)' : 'rgba(255,225,77,.55)', 3);
  const c = on ? '#2bd45a' : '#ff3d5a'; for (const sg of [-1, 1]) { line([[x - 24, GY + 6 - 11 * sg], [x + 24, GY + 6 + 11 * sg]], 14, INK); }
  for (const sg of [-1, 1]) { line([[x - 24, GY + 6 - 11 * sg], [x + 24, GY + 6 + 11 * sg]], 7, c); }
  X.restore();
}

/* the shared tower pose: rel[i] (joint tilts) -> absolute angles, then draw the levels */
const PY = [0, 0], AA = [0, 0, 0, 0], SY = [1, 1, 1, 1], DNG = [0, 0, 0, 0], SPL = [0, 0, 0, 0];
function drawTower(n, bx, T, spin, cols, mood) {
  layout(AA, SY, n, bx);
  X.save(); shadow(bx + (LX[n - 1] - bx) * .15, GY + 5, 48, 11, .28); X.restore();
  for (let i = 0; i < n; i++) {
    if (i) level(i, i, LX[i], LY[i], AA[i], SY[i], cols[i], mood, T, 0, DNG[i], SPL[i]);
    else level(0, 0, bx, GY, AA[0], SY[0], cols[0], mood, T, spin, DNG[0], SPL[0]);
  }
}

/* cosmetic randomness only (never feeds the level) */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
const hash = k => { let h = (k * 2654435761) >>> 0; h ^= h >>> 15; return (h % 1000) / 1000; };

/* ═════════ the game ═════════ */
function sqCircus(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0;
  /* the level: identical on every screen whatever n / role */
  const sgn = R() < .5 ? -1 : 1, spots = [400 + sgn * (100 + R() * 100), 400 - sgn * (90 + R() * 110)];
  const kinds = [0, 1, 2, 1]; for (let i = 3; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const EV = kinds.map((kind, e) => {
    const s0 = 3.4 + e * 3.1 + (R() - .5) * .7, dir = R() < .5 ? -1 : 1, lf = R(), sx = 90 + R() * 620;
    return { s0, kind, dir: kind === 2 ? 1 : kind === 1 ? (sx < 400 ? 1 : -1) : dir, lvl: Math.min(n - 1, Math.floor(lf * n)), sx, tau: TAU_EV[kind], warned: false, fx: false };
  });
  const LV = Array.from({ length: 4 }, () => ({ a0: (.04 + R() * .06) * (R() < .5 ? -1 : 1), f1: 1.1 + R() * .8, p1: R() * TAU, f2: 2.3 + R() * 1.1, p2: R() * TAU }));
  const force = (i, S) => {
    let f = 0;
    for (const e of EV) {
      const d = S - e.s0; if (d < 0) continue; const k = Math.exp(-d / e.tau);
      if (e.kind === 0) f += e.dir * .8 * (1 + .1 * i) * k; else if (e.kind === 1) { if (i === e.lvl) f += e.dir * 1.5 * k; } else if (i <= 1) f += 1.25 * k;
    }
    return f;
  };
  const spotAt = S => S < SCHG ? spots[0] : spots[1];
  /* state */
  let a = LV[me].a0, x = 400, spin = 0, uS = 0, keyL = 0, keyR = 0, ptrOn = false, ptrX = 400, botOn = false, botU = 0, S = 0;
  let fell = -1, fellAt = -9, resAt = -1, foldFx = false, sentAt = -9, lastSent = '', ending = false;
  const aT = [track(), track(), track(), track()], xT = track();
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  const bits = [], pops = [], rel = [0, 0, 0, 0], BX = { v: 400 };
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .9, gr: 700, vx: 0, vy: 0, r: 5, c: '#fff', k: 0 }, o)); }
  function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  function fall(role) { if (fell >= 0) return; fell = role; fellAt = g.c; if (judge && !g.result) g.finish('lose'); }

  const g = {
    c: 0, dur: 16, pts: 0,
    cmd: ['PEDAL!', 'STEADY!', 'BALANCE!', 'JUGGLE!'][me], roleLabel: ['UNICYCLE', 'STRONGMAN', 'ACROBAT', 'JUGGLER'][me],
    hint: me === 0 ? 'HOLD ◄ ► (OR A / D) TO STAY UPRIGHT - YOU ROLL WHERE YOU LEAN: PARK ON THE X' : 'HOLD ◄ ► (OR A / D) TO TILT YOUR LEVEL BACK UPRIGHT - KEEP THE WHOLE TOWER UP',
    thint: me === 0 ? 'HOLD THE LEFT / RIGHT SIDE TO STAY UPRIGHT - YOU ROLL WHERE YOU LEAN: PARK ON THE X' : 'HOLD THE LEFT / RIGHT SIDE TO TILT YOUR LEVEL BACK UPRIGHT',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      const done = !!g.result || fell >= 0;
      const tu = botOn ? botU : keyL || keyR ? keyR - keyL : ptrOn ? clamp((ptrX - 400) / 130, -1, 1) : 0;
      uS += (tu - uS) * Math.min(1, dt * 16);
      if (!done) {
        S += dt * TS; const dS = dt * TS;
        const lw = me ? (aT[me - 1].at() || 0) : 0, v = LV[me];
        const w = AMP[me] * (Math.sin(v.f1 * S + v.p1) + .6 * Math.sin(v.f2 * S + v.p2));
        a += (LAM[me] * a + w + force(me, S) + KCP * lw + CC[me] * uS) * dS;
        if (!me) { x = clamp(x + XK * a * dS, XMIN, XMAX); spin += XK * a * dS / WR; }
        if (Math.abs(a) >= FALL) { D.send('fall', 1); fall(me); }
        const m = Math.round(a * 1000) + (me ? '' : ',' + Math.round(x));
        if (m !== lastSent && g.c - sentAt >= .1) { lastSent = m; sentAt = g.c; D.send('a', me ? Math.round(a * 1000) : [Math.round(a * 1000), Math.round(x)], true); }
        if (judge && !g.result) { if (g.c >= g.limit) g.finish(Math.abs(x - spotAt(S)) < ONX && fell < 0 ? 'win' : 'lose'); }
      }
      // events: sounds and splashes at the right moment (every screen runs them from the same schedule)
      const Sv = S;
      for (const e of EV) {
        if (!e.warned && Sv >= e.s0 - .9) { e.warned = true; if (e.kind === 0) noise(.7, .05, 600, 2200, 'bandpass'); else if (e.kind === 1) snd(700, .08, 'square', .05, 0, 500); else { snd(400, .06, 'triangle', .05); snd(420, .06, 'triangle', .05, .15); } }
        if (!e.fx && Sv >= e.s0) {
          e.fx = true;
          if (e.kind === 1) { sfx.splat(); shake(3, .12); burst(LX[e.lvl] || 400, LY[e.lvl] || 300, '#e8343d', 10); }
          else if (e.kind === 2) { snd(180, .25, 'sawtooth', .07, 0, 90); noise(.3, .08, 300, 1500, 'lowpass'); shake(3, .12); }
          else { shake(2, .1); }
        }
      }
      if (g.result === 'lose' || (fell >= 0 && g.result !== 'win')) { if (!foldFx) { foldFx = true; sfx.miss(); snd(330, .5, 'sawtooth', .06, 0, 110); snd(250, .5, 'sawtooth', .05, .12, 90); shake(6, .22); } }
      else if (g.result === 'win' && !ending) { ending = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      while (pops.length && g.c - pops[0].t0 > 1.1) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'a' && aT[from]) { if (Array.isArray(d)) { aT[from].push(d[0] / 1000); xT.push(d[1]); } else aT[from].push(d / 1000); }
      else if (type === 'fall') fall(from);
    },
    tilt(v) { botOn = true; botU = clamp(v, -1, 1); },
    draw(t) {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose' || (fell >= 0 && !won), rk = resAt >= 0 ? T - resAt : -1;
      const lk = lost ? T - (fell >= 0 ? fellAt : resAt) : -1;
      if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      // wind from the schedule: strength of the nearest gust and its direction
      let wind = 0, wdir = 1, warnK = -1, warn = null;
      for (const e of EV) { const d = S - e.s0; if (d > -.9 && d < .35) { warn = e; warnK = clamp((d + .9) / .9, 0, 1.2); } if (e.kind === 0 && d > -.9 && d < .9) { wind = Math.max(wind, d < 0 ? (d + .9) / .9 * .6 : Math.exp(-d / .5)); wdir = e.dir; } }
      const st = won ? 1 : lost ? 2 : 0;
      crowd(T, st, wind);
      bunting(T, wind * wdir);
      // the lion on its cushion, the ringmaster on the floor
      let sniff = 0, sn = 0; for (const e of EV) if (e.kind === 2) { const d = S - e.s0; if (d > -.9 && d < 0) sniff = (d + .9) / .9; else if (d >= 0 && d < .6) sn = 1 - d / .6; }
      lion(116, 276, T, sniff, sn, won && rk > .35, lost && rk > .2 || (fell >= 0 && lost));
      ringmaster(668, 400, '#e8434f', won ? 'happy' : lost ? 'sad' : null, won ? Math.abs(Math.sin(T * 8)) * 12 : 0, lost && lk > .3 ? Math.min(60, (lk - .3) * 180) : 0, clamp(S / SEND, 0, 1), T);
      // the tower
      const bxv = me === 0 ? x : (xT.at() === null ? 400 : xT.at()); BX.v = bxv;
      const spot = spotAt(S), onMark = Math.abs(bxv - spot) < ONX;
      for (let i = 0; i < n; i++) { rel[i] = i === me ? a : (aT[i].at() || 0); }
      // pose (relative joint tilts) -> absolute angles, then bow / fold
      let A = 0;
      for (let i = 0; i < n; i++) {
        let r = rel[i];
        if (won && rk >= 0) { const ek = clamp(rk / .25, 0, 1); r = r * (1 - ek) + .2 * Math.sin(Math.PI * clamp((rk - .1 - (n - 1 - i) * .08) / .9, 0, 1)); }
        A += r; AA[i] = A; SY[i] = 1; DNG[i] = clamp((Math.abs(rel[i]) - .22) / .26, 0, 1); SPL[i] = 0;
      }
      if (lost && lk >= 0) for (let i = 0; i < n; i++) {
        const k = ease(clamp((lk - (n - 1 - i) * .07) / .5, 0, 1)), zig = (i % 2 ? -1 : 1) * .72;
        AA[i] = lerp(AA[i], zig, k); SY[i] = lerp(1, .5, k) + Math.sin(lk * 16 - i) * .07 * k * Math.max(0, 1 - lk * .5); DNG[i] = 0;
      }
      for (const e of EV) if (e.kind === 1) { const d = S - e.s0; if (d >= 0 && d < 2.2) SPL[e.lvl] = Math.max(SPL[e.lvl], 1 - d / 2.2); }
      // spotlight, then the X on the floor
      X.save(); X.fillStyle = 'rgba(255,250,220,.13)'; X.beginPath(); X.moveTo(bxv - 26, 56); X.lineTo(bxv + 26, 56); X.lineTo(bxv + 150, GY + 14); X.lineTo(bxv - 150, GY + 14); X.closePath(); X.fill(); X.restore();
      if (S > SCHG - 1.2 && S < SCHG) spotMark(spots[1], false, T, .3 + .3 * Math.sin(T * 14));
      spotMark(spot, onMark, T, 1);
      if (!won && !lost && S > SEND - 3.6 && onMark) badge('ON THE X!', spot, GY - 118, 18, '#22a447', '#fff', outBack((S - (SEND - 3.6)) / .3), -.04);
      drawTower(n, bxv, T, me === 0 ? spin : bxv / WR, [cols(0), cols(1), cols(2), cols(3)], won ? 'happy' : lost ? 'sad' : null);
      // flowers and applause on a win
      if (won && rk >= 0) for (let i = 0; i < 16; i++) { const d = rk - .1 - hash(i + 3) * .8; if (d < 0) continue; const fx = 90 + hash(i) * 620 + Math.sin(d * 4 + i) * 18, fy = -20 + d * (190 + hash(i + 9) * 70); if (fy < 560) flower(fx, fy, 15, ['#ff4d6d', '#ffe14d', '#ff8fb1', '#fff'][i % 4], d * 3 + i); }
      if (lost && lk > .35) for (let i = 0; i < 4; i++) { const d = (lk * .9 + i * .3) % 1.4, nx = bxv + (i - 1.5) * 44 + Math.sin(d * 5 + i) * 10, ny = GY - 150 - d * 70; X.globalAlpha = Math.max(0, 1 - d / 1.4); txt(i % 2 ? '♪' : '♫', nx, ny, 30, '#ffe14d'); X.globalAlpha = 1; }
      // name tags beside each level, upright
      PY[0] = PY[1] = 1e9;
      for (let i = 0; i < n; i++) {
        const si = i % 2, px = clamp(LX[i] + (si ? -84 : 84), 70, 730); let py = Math.min(LY[i] - U[i] * 5, 524);
        if (PY[si] - py < 34) py = PY[si] - 34; PY[si] = py;
        pill(px, py, i === me ? 'YOU' : name(i), cols(i));
      }
      // the event you can see coming
      for (const e of EV) {
        const d = S - e.s0;
        if (e.kind === 1 && d > -.9 && d < 0) {
          const k = clamp((d + .9) / .9, 0, 1), sx = e.sx, sy0 = 232;
          if (k < .33) { X.save(); X.translate(sx, sy0 - 26); X.rotate(Math.sin(T * 20) * .12); badge('!', 0, 0, 16, '#ff4d6d', '#fff', 1); X.restore(); }
          const f = clamp((k - .33) / .67, 0, 1), tx = LX[e.lvl] || 400, ty = (LY[e.lvl] || 300) - U[e.lvl] * 4.5, px = lerp(sx, tx, f), py = lerp(sy0, ty, f) - Math.sin(f * Math.PI) * 90;
          X.beginPath(); X.arc(px, py, 11, 0, TAU); ink('#e8343d', 3); tri(px - 6, py - 9, px + 6, py - 9, px, py - 15, '#3fb14a', 1.5); X.fillStyle = 'rgba(255,255,255,.7)'; el(px - 3, py - 3, 3, 2); X.fill();
        }
        if (e.kind === 0 && d > -.9 && d < .9) {                       // wind streaks
          const ph = (d + .9) / 1.8; X.save(); X.globalAlpha = .55 * Math.min(1, ph * 5) * (ph > .8 ? (1 - ph) * 5 : 1);
          for (let k = 0; k < 9; k++) { const y = 320 + (k * 71) % 250, xx = ((ph * 1400 + k * 137) % 900 - 50) * (e.dir > 0 ? 1 : -1) + (e.dir > 0 ? 0 : 800), ll = 80 + (k % 3) * 30; line([[xx, y], [xx - e.dir * ll, y]], 7, INK); line([[xx, y], [xx - e.dir * ll, y]], 3.5, '#fff'); }
          X.restore();
        }
        if (e.kind === 2 && d > 0 && d < .6) {                           // the sneeze blows across the ring
          const ph = d / .6; X.save(); X.globalAlpha = .6 * (1 - ph);
          for (let k = 0; k < 6; k++) { const y = 300 + k * 38 + (k % 2) * 8, xx = 170 + ph * 520 + k * 14; line([[xx, y], [xx - 70, y]], 7, INK); line([[xx, y], [xx - 70, y]], 3.5, '#fff'); }
          X.restore();
        }
      }
      // your own cue: which way to press
      if (!g.result && fell < 0 && Math.abs(a) > .09) { const k = clamp((Math.abs(a) - .09) / .3, 0, 1), dir = -Math.sign(a), lx = LX[me]; arrowCue(clamp(lx + dir * 112, 60, 740), Math.min(LY[me] - U[me] * 4, 515), dir, k, T); }
      // curtain call: the curtain closes in as time runs out
      const ck = clamp((S - 8) / (SEND - 8), 0, 1); curtain(ck * ck, true, T); curtain(ck * ck, false, T);
      // key caps / touch pads
      if (!g.result) { const big = TOUCH, ky = big ? 506 : 520; keycap(big ? 52 : 74, ky, -1, uS < -.3, big); keycap(big ? 748 : 726, ky, 1, uS > .3, big); }
      // the announcement
      if (warn && !g.result && fell < 0) { const w = warn.kind === 0 ? 'WIND!' : warn.kind === 1 ? 'TOMATO!' : 'ACHOO!', bx2 = warn.kind === 2 ? 270 : warn.kind === 1 ? clamp(warn.sx, 330, 650) : 460, by2 = warn.kind === 2 ? 236 : 120; badge(w, bx2, by2, 22, warn.kind === 0 ? '#2b9ee6' : warn.kind === 1 ? '#e8343d' : '#b8591f', '#fff', outBack(warnK * 1.6), -.05); }
      for (const b of bits) { X.globalAlpha = Math.max(0, 1 - (T - b.t0) / b.life); X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2); X.globalAlpha = 1; }
      if (won && rk > .15) badge('BRAVO!', 400, 150, 34, '#22a447', '#fff', outBack((rk - .15) / .25), -.04);
      if (lost && lk > .5) badge(fell >= 0 ? 'TOWER DOWN!' : 'WRONG SPOT!', 400, 150, 30, '#e8343d', '#fff', outBack((lk - .5) / .25), .04);
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 20, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      if (!g.result && T < 2.6) badge(me === 0 ? 'ROLL TO THE X!' : 'KEEP YOUR LEVEL UP!', 580, 196, 20, me === 0 ? '#22a447' : '#2b9ee6', '#fff', 1, -.03);
      vignette(.14);
    },
    down(p) { ptrOn = true; ptrX = p.x; },
    move(p) { if (ptrOn) ptrX = p.x; },
    up() { ptrOn = false; },
    key(e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyL = 1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keyR = 1;
    },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyL = 0; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keyR = 0; },
  };
  g.dbg = { view: () => ({ a, x, spot: spotAt(S), S, n, me, fell }), spots, EV, LV };
  wire(g, D, 0, sp, 'sq_circus');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  X = ctx;
  for (let k = 0; k < 14; k++) { const x0 = 260 + (k - 7) * 80; X.beginPath(); X.moveTo(260, -170); X.lineTo(x0, 112); X.lineTo(x0 + 80, 112); X.closePath(); X.fillStyle = k % 2 ? CREAM : RED; X.fill(); }
  X.fillStyle = 'rgba(30,10,40,.22)'; X.fillRect(0, 0, 520, 112);
  for (let i = 0; i < 12; i++) { X.fillStyle = CCOL[i % 6]; X.fillRect(10 + i * 44, 78 + Math.sin(t * 3 + i) * 1.5, 22, 18); X.strokeStyle = INK; X.lineWidth = 2.5; X.strokeRect(10 + i * 44, 78 + Math.sin(t * 3 + i) * 1.5, 22, 18); }
  X.fillStyle = INK; X.fillRect(0, 108, 520, 12); X.fillStyle = RED; for (let i = 0; i < 11; i++) if (i % 2) X.fillRect(i * 50, 110, 50, 8);
  let g2 = X.createLinearGradient(0, 120, 0, 240); g2.addColorStop(0, '#d7a869'); g2.addColorStop(1, '#efd29d'); X.fillStyle = g2; X.fillRect(0, 120, 520, 120);
  const u = t % 4, k = .78, gy = 212, bxg = 400 + (role === 0 ? ease(clamp(u / 2.6, 0, 1)) * 130 - 40 : 0), mine = Math.min(role, n - 1);
  const wob = i => .08 * Math.sin(t * (1.7 + .3 * i) + i * 1.9);
  const hitK = u > 1.2 && u < 2.8 ? Math.exp(-(u - 1.2) / .55) : 0, corr = u > 1.5 && u < 2.8 ? .45 : 0;
  const rr0 = [0, 0, 0, 0]; for (let i = 0; i < n; i++) rr0[i] = wob(i);
  rr0[mine] = role === 0 ? .16 * Math.sin(t * 3) : .1 * Math.sin(t * 2.1) + hitK * .34 * (role === 1 ? 1 : -1) * (1 - corr);
  let A = 0; for (let i = 0; i < n; i++) { A += rr0[i]; AA[i] = A; SY[i] = 1; DNG[i] = 0; SPL[i] = 0; }
  X.save(); X.translate(210, gy); X.scale(k, k); X.translate(-bxg, -GY);
  if (role === 0) spotMark(530, Math.abs(bxg - 530) < ONX, t, 1);
  layout(AA, SY, n, bxg);
  X.save(); X.globalAlpha = .6 + .2 * Math.sin(t * 8); X.beginPath(); X.arc(LX[mine], LY[mine] - U[mine] * 4.4, U[mine] * 11, 0, TAU); ink('#ffe14d', 0); X.restore();   // the glow marks YOUR level
  drawTower(n, bxg, t, bxg / WR, COLS, u > 3.4 ? 'happy' : null);
  if (role === 1 && u > .5 && u < 1.2) { const f = (u - .5) / .7, tx = LX[1] - 20, ty = LY[1] - 20, px = lerp(bxg - 300, tx, f), py = lerp(GY - 260, ty, f) - Math.sin(f * Math.PI) * 90; X.beginPath(); X.arc(px, py, 14, 0, TAU); ink('#e8343d', 4); tri(px - 7, py - 11, px + 7, py - 11, px, py - 18, '#3fb14a', 2); }
  if (role === 2 || role === 3) if (u > .5 && u < 1.6) { X.save(); X.globalAlpha = .6; for (let q = 0; q < 4; q++) { const yy = GY - 100 - q * 50, xx = bxg - 300 + ((u - .5) * 800 + q * 90) % 800; line([[xx, yy], [xx - 90, yy]], 9, INK); line([[xx, yy], [xx - 90, yy]], 4.5, '#fff'); } X.restore(); }
  X.restore();
  const lean = rr0[mine], press = Math.abs(lean) > .06 ? -Math.sign(lean) : 0;   // the key that tilts you back is lit
  keycap(380, 192, -1, press < 0); keycap(450, 192, 1, press > 0);
  demoFinger(press < 0 ? 380 : press > 0 ? 450 : 415, 216, !!press, 0);
  const ev = role === 1 ? 'TOMATO!' : 'WIND!', hot = role >= 1 && u > .5 && u < 2.4;
  if (role === 0) badge('ROLL TO THE X!', 330, 28, 18, '#22a447', '#fff', 1, -.03);
  else badge(hot ? ev : 'KEEP YOUR LEVEL UP!', 330, 28, 18, hot ? (role === 1 ? '#e8343d' : '#2b9ee6') : '#22a447', '#fff', 1, -.03);
}
reg('sq_circus', sqCircus, 'CIRCUS TOWER'); REGMAP.sq_circus.duo = true; REGMAP.sq_circus.squad = true;
DUO.INFO.sq_circus = n => [
  ['UNICYCLE', 'ROLL TO THE X, STAY UP', 'HOLD ◄ ► OR DRAG SIDEWAYS'],
  ['STRONGMAN', 'KEEP YOUR LEVEL UPRIGHT', 'HOLD ◄ ► OR DRAG SIDEWAYS'],
  ['ACROBAT', 'KEEP YOUR LEVEL UPRIGHT', 'HOLD ◄ ► OR DRAG SIDEWAYS'],
  ['JUGGLER', 'KEEP YOUR LEVEL UPRIGHT', 'HOLD ◄ ► OR DRAG SIDEWAYS'],
].slice(0, n);
DUO.DEMOS.sq_circus = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
