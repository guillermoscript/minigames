'use strict';
/* ═════════ DUO · TWO-CLAW CRANE (du_crane), after Crane Catcher (Move It!) ═════════
   A claw machine with TWO claws, one per player: PINK CLAW (role 0, the JUDGE) and BLUE CLAW (role 1). The prize (a rubber chicken,
   a fat cat or a tuba, from the seed) can only be lifted by its two marked grips (two feet, two ears, both ends). Each player slides
   their own claw (pointer / drag / ◄ ►) and drops it (click / DROP button / Space). The claw closes where it lands; on a grip it hangs on.
   One grip held = the prize tips up on that side and screams; if the OTHER claw closes on the OTHER grip within WIN s, the two claws
   lift it, carry it to the chute and the ticket printer spits metres of tickets. Otherwise the grip slips: the prize swings, falls
   back and lands somewhere else (maybe turned round, so "who takes which" must be agreed again). TRIES tries, then GAME OVER.
   Netcode: each role owns its claw. 'x' = its x while it slides (int, coalesced, <= 10/s). 'drop {n, x, g, w}' = it drops at x on
   try n (g = the grip under it, -1 floor, -2 the prize's body; w = how long the prize had been tipping ON THAT PLAYER'S SCREEN when
   they pressed, -1 = not tipping yet); the partner animates that drop from the moment it arrives, and the claw closes DESC s later
   on both screens. The ring a player sees is their deadline to PRESS, so the JUDGE (pink) never compares clocks: the second grip
   counts if its presser pressed within WIN (+ GRACE) of the tip on their own screen, however late that close reaches the judge.
   The judge waits up to WINJ for a partner's drop still on the wire (any claw already dropping is always waited for), then slips.
   It answers 'v {n, r}' (r: 'l' lift with the grips in h, 'f' the grip slipped) and 'c {n, w}' (claw w closed on the grip the
   other one already holds: CLANK, it lets go). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right LEAVE and y>552) ───────────── */
const GL = 92, GR = 708, GT = 102, GB = 436;               // the glass window of the cabinet
const RAIL = [146, 130];                                    // rail y per role: pink runs in front, blue behind
const HUBY0 = 176, GOFF = 44, CSC = 1.15;                  // claw hub at rest; a hub holding a grip sits GOFF above it; claw scale
const PY = 414;                                             // the prize's feet (its local y = 0) rest in the ball pit
const XMIN = 140, XMAX = 660;                               // how far a claw can slide
const CHX = 150, CHT = 312;                                 // the prize chute (left, inside the glass): centre x, top
const DROP_B = [400, 498, 46];                              // my big arcade button (centre, radius)
const inDrop = p => p.y > 446 && p.x > 300 && p.x < 500;   // generous: a thumb near the button never just slides the claw
const PRINT = [655, 470];                                   // the ticket printer's slot
const COLS = ['#ff5fa2', '#3fb6ff'], DARKS = ['#c22f74', '#1f7fc2'];   // pink claw, blue claw (fixed per role, so they never clash)

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
/* cel shading with a shifted copy of the same shape: base on top, the shade shows as a crescent on the (sx, sy) side */
function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function celE(x, y, rx, ry, rot, base, shade, sx, sy, o = 4) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); cel(p, base, shade, sx, sy, o); return p; }
function tube(pts, w, col, hi) {                           // an inked pipe / leg along a polyline (quadratic through the middle points)
  const path = () => { X.beginPath(); X.moveTo(pts[0][0], pts[0][1]); if (pts.length === 3) X.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); else for (let i = 1; i < pts.length; i++) X.lineTo(pts[i][0], pts[i][1]); };
  X.lineCap = 'round'; X.lineJoin = 'round';
  path(); X.lineWidth = w + 8; X.strokeStyle = INK; X.stroke(); path(); X.lineWidth = w; X.strokeStyle = col; X.stroke();
  if (hi) { X.save(); X.translate(-w * .18, -w * .18); path(); X.lineWidth = w * .28; X.strokeStyle = hi; X.stroke(); X.restore(); }
}
function pill(x, y, label, col, up) {                     // a name tag with a little pointer (down, or up), e.g. YOU / YOUR FRIEND
  X.font = '700 14px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(150, X.measureText(s).width + 22);
  const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 7, y + 10 * py); X.lineTo(x, y + 18 * py); X.lineTo(x + 7, y + 10 * py); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 11, w, 22, 11); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 8, w - 12, 5, 2.5); X.fill();
  txt(label, x, y + 1, 14, INK, 'center', w - 12);
}
/* a word on a chunky coloured badge (feedback that stays readable over any background) */
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
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
/* 2D affine matrices [a, b, c, d, e, f] (canvas order), so the prize and its grips always share one transform */
const Mx = {
  mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
  T: (x, y) => [1, 0, 0, 1, x, y], R: a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], S: (x, y) => [x, 0, 0, y, 0, 0],
  pt: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
};
const about = (px, py, a, m) => Mx.mul(Mx.T(px, py), Mx.mul(Mx.R(a), Mx.mul(Mx.T(-px, -py), m)));   // rotate m around (px, py)

/* ───────────── faces (eyes that react: idle / panic / dizzy / happy / rasp / bonk) ───────────── */
function eye(x, y, r, mood, look, T, k) {                  // k: per-eye index (dizzy spirals turn opposite ways, rasp winks the 2nd)
  if (mood === 'happy') { X.lineWidth = r * .55; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
  if (mood === 'rasp' && k) { X.lineWidth = r * .5; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .8, y - r * .5); X.lineTo(x + r * .5, y); X.lineTo(x - r * .8, y + r * .5); X.stroke(); return; }
  if (mood === 'bonk') { X.lineWidth = r * .5; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .8, y - r * .1); X.lineTo(x + r * .8, y - r * .1); X.stroke(); return; }
  const big = mood === 'panic' ? 1.35 : 1;
  el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(2, r * .28));
  if (mood === 'dizzy') {
    X.strokeStyle = INK; X.lineWidth = Math.max(1.6, r * .2); X.beginPath();
    for (let i = 0; i < 26; i++) { const a = i * .55 * (k ? -1 : 1) + T * 9 * (k ? -1 : 1), q = i / 26 * r * .85; X.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } X.stroke(); return;
  }
  const blink = mood !== 'panic' && Math.sin(T * 1.9 + k * .2) > .985;
  if (blink) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
  const pr = mood === 'panic' ? r * .32 : r * .52, lx = clamp(look[0], -1, 1) * r * .38, ly = clamp(look[1], -1, 1) * r * .38;
  X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
  X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .35, pr * .3); X.fill();
}
function sweat(x, y, s, T) { const k = (T * 2.2) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
function crown(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(-16, 6); X.lineTo(-18, -10); X.lineTo(-8, -2); X.lineTo(0, -14); X.lineTo(8, -2); X.lineTo(18, -10); X.lineTo(16, 6); X.closePath(); ink('#ffd23f', 3);
  for (const [a, b, c] of [[-8, 1, '#ff4d6d'], [0, 1, '#4db8ff'], [8, 1, '#5CFF7A']]) { X.beginPath(); X.arc(a, b, 2.6, 0, TAU); X.fillStyle = c; X.fill(); } X.restore();
}

/* ───────────── the three prizes (local coords: feet at y = 0, grips in G; drawn already flipped / rotated) ─────────────
   o: { mood, T, look, strain (0..1: tipping), rare } */
const CHK = '#ffd84a', CHK2 = '#e0a21c', CHKL = '#fff3a8', ORG = '#ff9a2e';
function chicken(o) {
  const { mood, T, look } = o, st = o.strain || 0, kick = mood === 'panic' ? Math.sin(T * 26) * 5 : 0;
  // legs up (it lies on its back), each ending in a three-toed foot = a grip
  for (const [hx, hy, kx, ky, fx, fy, s] of [[-26, -58, -56, -86, -55, -118, 1], [30, -60, 62, -88, 55, -120, -1]]) {
    tube([[hx, hy], [kx + kick * s, ky], [fx, fy]], 8, ORG, '#ffd08a');
    X.save(); X.translate(fx, fy); X.rotate(kick * .02 * s);
    for (const a of [-.55, 0, .55]) tube([[0, 0], [Math.sin(a) * 15, -Math.cos(a) * 15]], 5, ORG);
    X.restore();
  }
  // tail feathers, body, belly, the plucked bumps
  for (let i = 0; i < 3; i++) { X.save(); X.translate(78, -46); X.rotate(-.6 + i * .5 + Math.sin(T * 6 + i) * .05); el(14, 0, 16, 7); ink(CHK, 3); X.restore(); }
  const bp = celE(6, -40, 76, 36, -.04, CHK, CHK2, 8, 10, 4.5);
  X.save(); X.clip(bp); X.fillStyle = CHKL; el(-6, -60, 46, 12, -.06); X.fill(); X.fillStyle = 'rgba(224,162,28,.55)'; for (const [a, b] of [[-30, -30], [-10, -22], [14, -28], [36, -20], [-20, -46], [26, -42]]) { el(a, b, 3, 2.4); X.fill(); } X.restore();
  X.save(); X.translate(10, -24); X.rotate(.15 + (mood === 'panic' ? Math.sin(T * 30) * .25 : 0)); el(0, 0, 28, 12); ink(CHK, 3.5); X.strokeStyle = CHK2; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-14, 2); X.lineTo(10, 4); X.stroke(); X.restore();
  // neck + head (left), comb, wattle, beak (opens wide to scream)
  tube([[-54, -42], [-80, -34 - st * 6], [-104, -40 - st * 10]], 22, CHK, CHKL);
  const hx = -114, hy = -44 - st * 12;
  for (const [a, b, r] of [[-12, -22, 9], [-1, -27, 10], [10, -22, 8]]) { X.beginPath(); X.arc(hx + a, hy + b, r, 0, TAU); ink('#ff4d5e', 3); }
  X.beginPath(); X.arc(hx, hy, 22, 0, TAU); ink(CHK, 4); X.fillStyle = CHKL; el(hx - 6, hy - 9, 9, 5, -.4); X.fill();
  if (o.rare) crown(hx, hy - 34, 1);
  const open = mood === 'panic' ? .55 + Math.sin(T * 40) * .12 : mood === 'rasp' ? .3 : mood === 'happy' ? .2 : .06;
  X.save(); X.translate(hx - 18, hy + 4);
  if (open > .1) { X.beginPath(); X.moveTo(0, -4); X.lineTo(-24, -4 - open * 16); X.lineTo(-24, 4 + open * 16); X.lineTo(0, 6); X.closePath(); ink('#b0203a', 3); }
  X.save(); X.rotate(-open * .6); X.beginPath(); X.moveTo(2, -10); X.lineTo(-26, -3); X.lineTo(2, 0); X.closePath(); ink(ORG, 3); X.restore();
  X.save(); X.rotate(open * .6); X.beginPath(); X.moveTo(2, 0); X.lineTo(-22, 4); X.lineTo(2, 10); X.closePath(); ink('#ff7a1a', 3); X.restore();
  if (mood === 'rasp') { X.beginPath(); X.moveTo(-8, 2); X.quadraticCurveTo(-30, 8, -26, 20); X.quadraticCurveTo(-16, 20, -6, 8); ink('#ff7aa8', 2.5); }
  X.restore();
  X.beginPath(); X.moveTo(hx - 16, hy + 12); X.quadraticCurveTo(hx - 24, hy + 30, hx - 12, hy + 28); X.quadraticCurveTo(hx - 6, hy + 20, hx - 8, hy + 12); ink('#ff4d5e', 2.5);
  eye(hx - 2, hy - 4, 9, mood, look, T, 0);
  if (mood === 'panic') sweat(hx + 24, hy - 18, 1, T);
}
const CAT = '#ff9f43', CAT2 = '#d46f19', CATL = '#ffd9a8', STRIPE = '#c45f12';
function cat(o) {
  const { mood, T, look } = o, puff = mood === 'panic' ? 1 : 0;
  // tail
  tube([[48, -18], [104, -24 + Math.sin(T * 3) * 6], [92, -76 + Math.sin(T * 3.4) * 8]], 15, CAT, '#ffc285');
  // body (all fur standing up when scared), belly, paws
  if (puff) { X.beginPath(); for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU, r = (i % 2 ? 1 : 1.16) + Math.sin(T * 40 + i) * .02; X.lineTo(Math.cos(a) * 76 * r, -50 + Math.sin(a) * 54 * r); } X.closePath(); ink(CAT, 4); }
  const bp = celE(0, -50, 70, 50, 0, CAT, CAT2, 10, 8, 4.5);
  X.save(); X.clip(bp); X.fillStyle = CATL; el(0, -34, 40, 32); X.fill(); X.fillStyle = STRIPE; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { el(s * (52 + i * 4), -70 + i * 18, 14, 4, s * .3); X.fill(); } X.restore();
  for (const s of [-1, 1]) { el(s * 26, -6, 20, 11); ink(CATL, 3.5); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(s * 26 - 6, -10); X.lineTo(s * 26 - 6, -2); X.moveTo(s * 26 + 6, -10); X.lineTo(s * 26 + 6, -2); X.stroke(); }
  // ears (= the grips), then the head
  const hy = -114, ear = (s) => { X.beginPath(); X.moveTo(s * 60, hy - 6); X.lineTo(s * 50, hy - 50); X.lineTo(s * 16, hy - 36); X.closePath(); };
  for (const s of [-1, 1]) { ear(s); ink(CAT, 4.5); X.beginPath(); X.moveTo(s * 50, hy - 18); X.lineTo(s * 47, hy - 40); X.lineTo(s * 28, hy - 32); X.closePath(); X.fillStyle = '#ff9cbc'; X.fill(); }
  const hp = celE(0, hy, 66, 46, 0, CAT, CAT2, 8, 8, 4.5);
  X.save(); X.clip(hp); X.fillStyle = STRIPE; for (const a of [-14, 0, 14]) { X.beginPath(); X.moveTo(a - 5, hy - 46); X.lineTo(a, hy - 26); X.lineTo(a + 5, hy - 46); X.fill(); }
  for (const s of [-1, 1]) { el(s * 62, hy + 2, 12, 4, s * .2); X.fill(); el(s * 60, hy + 14, 10, 3.5, s * .2); X.fill(); }
  X.fillStyle = '#ffc285'; el(-24, hy - 30, 16, 6, -.3); X.fill(); X.restore();
  if (o.rare) crown(0, hy - 50, 1.1);
  // face
  X.fillStyle = CATL; el(0, hy + 14, 26, 17); X.fill();
  for (const s of [-1, 1]) {                                 // whiskers
    X.strokeStyle = INK; X.lineWidth = 2.4; X.lineCap = 'round';
    for (let i = 0; i < 2; i++) { X.beginPath(); X.moveTo(s * 26, hy + 12 + i * 7); X.lineTo(s * (58 + puff * 8), hy + 6 + i * 12 + (puff ? -6 + i * 2 : 0)); X.stroke(); }
  }
  for (let k = 0; k < 2; k++) {
    const ex = (k ? 1 : -1) * 25, ey = hy - 6;
    if (mood === 'idle' || mood === 'look') {               // cat eyes: green with a slit
      el(ex, ey, 12, 13); ink('#c9f27a', 3);
      const blink = Math.sin(T * 1.9) > .985;
      if (blink) { X.fillStyle = INK; X.fillRect(ex - 12, ey - 2, 24, 4); }
      else { X.fillStyle = INK; el(ex + clamp(look[0], -1, 1) * 4, ey + clamp(look[1], -1, 1) * 3, 3.2, 10); X.fill(); X.fillStyle = '#fff'; el(ex - 5, ey - 5, 3, 2.4); X.fill(); }
    } else eye(ex, ey, 12, mood, look, T, k);
  }
  X.beginPath(); X.moveTo(-6, hy + 6); X.lineTo(6, hy + 6); X.lineTo(0, hy + 12); X.closePath(); ink('#ff7aa8', 2);
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round';
  if (mood === 'panic') {                                   // MREOW: open mouth, fangs
    el(0, hy + 26, 13, 12 + Math.sin(T * 30) * 2); ink('#8a1830', 2.5); X.fillStyle = '#ff7aa8'; el(0, hy + 32, 8, 4); X.fill();
    for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 8, hy + 16); X.lineTo(s * 5, hy + 23); X.lineTo(s * 2, hy + 16); X.closePath(); ink('#fff', 1.5); }
    sweat(52, hy - 30, 1.1, T);
  } else if (mood === 'rasp') {
    X.beginPath(); X.moveTo(-10, hy + 16); X.quadraticCurveTo(0, hy + 22, 10, hy + 16); X.stroke();
    X.beginPath(); X.moveTo(-6, hy + 18); X.quadraticCurveTo(-8, hy + 36, 2, hy + 36); X.quadraticCurveTo(10, hy + 34, 7, hy + 18); ink('#ff7aa8', 2.5);
  } else { X.beginPath(); X.moveTo(-10, hy + 15); X.quadraticCurveTo(-5, hy + 21, 0, hy + 14); X.quadraticCurveTo(5, hy + 21, 10, hy + 15); X.stroke(); }
}
const BR = '#ffc94a', BR2 = '#c98a1e', BRL = '#fff1b8';
function tuba(o) {
  const { mood, T, look } = o;
  // lead pipe to the mouthpiece (left grip), the big coil
  tube([[-40, -64], [-70, -76], [-96, -70]], 9, BR, BRL);
  X.beginPath(); X.arc(-101, -70, 8, 0, TAU); ink('#d9dee6', 3); X.fillStyle = '#5a6070'; el(-103, -70, 3, 4); X.fill();
  X.lineCap = 'round';
  el(0, -50, 52, 38); X.lineWidth = 30; X.strokeStyle = INK; X.stroke(); X.lineWidth = 20; X.strokeStyle = BR2; X.stroke();
  X.save(); X.translate(-2, -3); el(0, -50, 52, 38); X.lineWidth = 12; X.strokeStyle = BR; X.stroke(); X.restore();
  X.strokeStyle = BRL; X.lineWidth = 4; X.beginPath(); X.ellipse(-2, -53, 52, 38, 0, Math.PI * 1.05, Math.PI * 1.55); X.stroke();
  // valves on top
  for (let i = 0; i < 3; i++) { const vx = -16 + i * 15, push = mood === 'panic' ? Math.max(0, Math.sin(T * 24 + i * 2)) * 5 : 0; rr(vx - 5, -102 + push, 10, 20, 3); ink('#d9dee6', 2.5); rr(vx - 7, -108 + push, 14, 7, 3); ink('#f4f6fa', 2.5); }
  // the bell (right grip = its top rim): flares up and out, with a dark mouth
  X.beginPath(); X.moveTo(30, -76); X.quadraticCurveTo(66, -80, 98, -114); X.lineTo(104, -22); X.quadraticCurveTo(66, -54, 30, -58); X.closePath(); ink(BR, 4.5);
  X.save(); X.clip(); X.fillStyle = BR2; X.beginPath(); X.moveTo(30, -64); X.quadraticCurveTo(70, -56, 104, -26); X.lineTo(110, 0); X.lineTo(20, 0); X.fill(); X.fillStyle = BRL; el(60, -80, 22, 4, -.6); X.fill(); X.restore();
  el(101, -68, 13, 47); ink(BR, 4); el(103, -68, 8, 40); X.fillStyle = '#5a3a10'; X.fill();
  if (mood === 'panic') { X.fillStyle = 'rgba(255,240,200,.5)'; el(104, -68, 5 + Math.sin(T * 40) * 2, 30); X.fill(); }
  // a face sticker in the middle of the coil
  const fp = celE(0, -50, 34, 22, 0, BRL, BR, 0, 5, 3.5);
  if (o.rare) crown(0, -80, .9);
  eye(-12, -54, 8, mood, look, T, 0); eye(12, -54, 8, mood, look, T, 1);
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round';
  if (mood === 'panic') { el(0, -38, 7, 6 + Math.sin(T * 30) * 1.5); ink('#8a1830', 2); }
  else if (mood === 'rasp') { X.beginPath(); X.moveTo(-8, -40); X.lineTo(8, -40); X.stroke(); X.beginPath(); X.moveTo(-4, -40); X.quadraticCurveTo(-5, -28, 2, -28); X.quadraticCurveTo(7, -30, 4, -40); ink('#ff7aa8', 2); }
  else { X.beginPath(); X.moveTo(-8, -42); X.quadraticCurveTo(0, mood === 'happy' ? -32 : -37, 8, -42); X.stroke(); }
  if (mood === 'panic') sweat(36, -96, 1, T);
  void fp;
}
/* G: the two grips (local), w: half width, top: where a claw lands on the body, scream + its particle, sound */
const PRIZES = [
  { draw: chicken, s: 1, G: [[-55, -126], [55, -128]], w: 150, top: -78, yell: 'BAWK!', bit: 'feather', col: '#ff9f1c' },
  { draw: cat, s: .8, G: [[-50, -160], [50, -160]], w: 110, top: -160, yell: 'MREOW!', bit: 'fur', col: '#e8434f' },
  { draw: tuba, s: 1, G: [[-101, -70], [99, -112]], w: 116, top: -92, yell: 'BWAAMP!', bit: 'note', col: '#7c4dff' },
];
function yellSnd(kind) {
  if (kind === 0) { snd(900, .18, 'square', .05, 0, 1700); snd(1500, .32, 'square', .045, .16, 700); }          // rubber chicken squeal
  else if (kind === 1) { snd(520, .5, 'sawtooth', .045, 0, 1050); snd(1040, .4, 'triangle', .03, .1, 620); }    // cat yowl
  else { snd(58, .6, 'sawtooth', .09, 0, 46); snd(87, .55, 'square', .04, .02, 70); }                        // tuba blat
}

/* ───────────── the claw (hub at (x, y); open 0 = shut .. 1 = wide; face) ───────────── */
function claw(x, y, open, col, dk, face, T, sc = 1) {
  X.save(); X.translate(x, y); X.scale(sc, sc);
  const a = .1 + open * .55;
  // back prong (darker), then the two side prongs
  X.save(); X.scale(.8, 1); prong(0, '#8d94a3', dk, 0); X.restore();
  for (const s of [-1, 1]) { X.save(); X.translate(s * 12, 8); X.rotate(-s * a); X.scale(s, 1); prong(1, '#d6dbe4', col, 0); X.restore(); }
  // hub: a little metal dome with a face
  rr(-24, -18, 48, 30, 13); ink('#c9ced6', 4); X.fillStyle = col; rr(-24, -4, 48, 9, 3); X.fill(); X.fillStyle = 'rgba(255,255,255,.55)'; rr(-17, -14, 16, 5, 2.5); X.fill();
  X.fillStyle = dk; X.fillRect(-24, 4, 48, 2);
  const ey = -9;
  if (face === 'happy') { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 8, ey + 2, 4, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); } }
  else if (face === 'sad') { X.strokeStyle = INK; X.lineWidth = 2.6; X.lineCap = 'round'; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 8 - 4, ey - 3); X.lineTo(s * 8 + 4, ey + 3); X.moveTo(s * 8 + 4, ey - 3); X.lineTo(s * 8 - 4, ey + 3); X.stroke(); } }
  else if (face === 'strain') { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 4, ey - 3); X.lineTo(s * 11, ey); X.lineTo(s * 4, ey + 3); X.stroke(); } X.fillStyle = '#9fe3ff'; el(22, -18 + ((T * 20) % 8), 2.5, 3.5); X.fill(); }
  else { const bl = Math.sin(T * 2.3 + x * .01) > .98; X.fillStyle = INK; for (const s of [-1, 1]) { if (bl) X.fillRect(s * 8 - 3, ey - 1, 6, 2.5); else { el(s * 8, ey, 2.8, 3.8); X.fill(); } } }
  X.restore();
}
function prong(front, metal, tip, _) {
  X.beginPath(); X.moveTo(-4, 0); X.lineTo(4, 0); X.quadraticCurveTo(10, 24, 5, 40); X.lineTo(-4, 46); X.lineTo(-6, 41); X.lineTo(-1, 37); X.quadraticCurveTo(2, 22, -4, 0); X.closePath();
  ink(front ? metal : '#9aa1b0', 3.5);
  X.beginPath(); X.moveTo(5, 38); X.lineTo(-4, 46); X.lineTo(-6, 41); X.lineTo(-1, 37); X.closePath(); X.fillStyle = tip; X.fill();
}
function trolley(x, ry, col, dk, T, moving) {
  const wob = moving ? Math.sin(T * 40) * 1 : 0;
  rr(x - 27, ry - 11 + wob, 54, 20, 7); ink(col, 3.5); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - 21, ry - 8 + wob, 20, 4, 2); X.fill();
  for (const s of [-1, 1]) { X.save(); X.translate(x + s * 15, ry - 11 + wob); X.rotate(moving ? T * 20 * s : 0); X.beginPath(); X.arc(0, 0, 5.5, 0, TAU); ink('#4a4560', 2.5); X.fillStyle = '#c9ced6'; X.fillRect(-4, -1, 8, 2); X.restore(); }
  X.fillStyle = dk; X.fillRect(x - 27, ry + 3 + wob, 54, 3);
}

/* ───────────── the static scene, painted once into offscreen canvases (back = room + cabinet + inside, front = balls, glass, panel) ───────────── */
let BG = null, FG = null;
const BALLC = ['#ff4d6d', '#4db8ff', '#ffe14d', '#5cff7a', '#ffffff', '#ff9f1c', '#b49cff'];
function ball(x, y, r, c) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(c, 2.5); X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .35, y - r * .4, r * .32, r * .22, -.5); X.fill(); X.fillStyle = 'rgba(20,16,28,.14)'; X.beginPath(); X.arc(x + r * .2, y + r * .25, r * .7, 0, Math.PI); X.fill(); }
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  // the arcade: a dark wall with neon stripes, carpet with planets and squiggles
  let g = X.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1650'); g.addColorStop(1, '#170c30'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  X.lineCap = 'round'; for (const [y, c] of [[150, '#ff4dc4'], [176, '#4dfff0']]) { X.strokeStyle = c; X.globalAlpha = .25; X.lineWidth = 10; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); X.globalAlpha = 1; X.lineWidth = 3; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  X.fillStyle = '#20123f'; X.fillRect(0, 540, W, 60);
  const sq = [['#ff4dc4', 30, 560], ['#4dfff0', 150, 584], ['#ffe14d', 700, 566], ['#5cff7a', 770, 590], ['#ff9f1c', 20, 592]];
  for (const [c, x, y] of sq) { X.strokeStyle = c; X.lineWidth = 3; X.beginPath(); for (let i = 0; i <= 6; i++) X.lineTo(x + i * 7, y + (i % 2 ? -5 : 5)); X.stroke(); }
  for (const [x, y, r, c] of [[50, 574, 8, '#ff9f1c'], [744, 580, 7, '#b49cff']]) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(c, 2); X.strokeStyle = '#fff'; X.lineWidth = 2; X.beginPath(); X.ellipse(x, y, r * 1.8, r * .5, -.3, 0, TAU); X.stroke(); }
  // the cabinet body (sunny yellow, purple trim), its shadow on the carpet
  X.fillStyle = 'rgba(0,0,0,.35)'; el(400, 598, 360, 18); X.fill();
  rr(62, 52, 676, 570, 26); ink('#ffb627', 5);
  X.save(); rr(62, 52, 676, 570, 26); X.clip(); X.fillStyle = '#e8961a'; X.fillRect(62, 52, 26, 570); X.fillRect(712, 52, 26, 570);
  X.fillStyle = '#7c4dff'; X.fillRect(62, 440, 676, 14); X.fillStyle = '#9d7bff'; X.fillRect(62, 440, 676, 4); X.restore();
  // marquee box
  rr(84, 56, 632, 38, 14); ink('#7c4dff', 4); X.fillStyle = '#9d7bff'; rr(92, 60, 616, 7, 3.5); X.fill();
  // glass frame + inside: a pink/violet back wall with stars, a spotlight
  rr(GL - 10, GT - 8, GR - GL + 20, GB - GT + 18, 16); ink('#3b2a6b', 4);
  g = X.createLinearGradient(0, GT, 0, GB); g.addColorStop(0, '#ff8ad0'); g.addColorStop(.6, '#c25cff'); g.addColorStop(1, '#7a3dd6'); X.fillStyle = g; X.fillRect(GL, GT, GR - GL, GB - GT);
  X.save(); X.beginPath(); X.rect(GL, GT, GR - GL, GB - GT); X.clip();
  X.fillStyle = 'rgba(255,255,255,.14)'; for (let y = GT + 20; y < GB; y += 44) for (let x = GL + ((y / 44) % 2) * 30 + 16; x < GR; x += 60) star(x, y, 7, 3, 4, .3, 'rgba(255,255,255,.16)', 0);
  X.fillStyle = 'rgba(255,255,230,.10)'; X.beginPath(); X.moveTo(340, GT); X.lineTo(460, GT); X.lineTo(620, GB); X.lineTo(180, GB); X.closePath(); X.fill();
  // back row of balls in the pit
  const r0 = mulberry32(77);
  for (let i = 0; i < 46; i++) { const x = GL + 6 + r0() * (GR - GL - 12), y = 392 + r0() * 24; ball(x, y, 11 + r0() * 4, BALLC[Math.floor(r0() * 7)]); }
  // the chute's back (a dark hole)
  X.fillStyle = '#2a1650'; X.fillRect(CHX - 48, CHT, 96, GB - CHT);
  el(CHX, CHT, 48, 9); ink('#1b0f33', 3);
  X.restore();
  // rails (pink in front, blue behind)
  for (let r = 1; r >= 0; r--) { rr(GL, RAIL[r] - 4, GR - GL, 8, 4); ink(r ? '#a3a9b8' : '#c9ced6', 3); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(GL + 4, RAIL[r] - 3, GR - GL - 8, 2); }
  X = old; return cv2;
}
function buildFg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  X.save(); X.beginPath(); X.rect(GL, GT, GR - GL, GB - GT); X.clip();
  // front row of balls (the prize sits IN the pit)
  const r0 = mulberry32(91);
  for (let i = 0; i < 40; i++) { const x = GL + r0() * (GR - GL), y = 420 + r0() * 18; ball(x, y, 12 + r0() * 4, BALLC[Math.floor(r0() * 7)]); }
  // the chute's clear front with candy stripes and a down arrow
  rr(CHX - 50, CHT - 2, 100, GB - CHT + 10, 8); X.fillStyle = 'rgba(200,240,255,.28)'; X.fill(); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
  X.save(); rr(CHX - 50, CHT - 2, 100, GB - CHT + 10, 8); X.clip(); X.fillStyle = 'rgba(255,255,255,.45)'; for (let i = -2; i < 8; i++) { X.beginPath(); X.moveTo(CHX - 60 + i * 26, CHT + 130); X.lineTo(CHX - 48 + i * 26, CHT + 130); X.lineTo(CHX + 10 + i * 26, CHT - 10); X.lineTo(CHX - 2 + i * 26, CHT - 10); X.fill(); } X.restore();
  rr(CHX - 54, CHT - 8, 108, 14, 5); ink('#ffe14d', 3); X.fillStyle = INK; for (let i = 0; i < 5; i++) { X.beginPath(); X.moveTo(CHX - 46 + i * 20, CHT + 6); X.lineTo(CHX - 38 + i * 20, CHT - 8); X.lineTo(CHX - 30 + i * 20, CHT - 8); X.lineTo(CHX - 38 + i * 20, CHT + 6); X.fill(); }
  X.beginPath(); X.moveTo(CHX - 14, CHT + 36); X.lineTo(CHX + 14, CHT + 36); X.lineTo(CHX + 14, CHT + 58); X.lineTo(CHX + 26, CHT + 58); X.lineTo(CHX, CHT + 84); X.lineTo(CHX - 26, CHT + 58); X.lineTo(CHX - 14, CHT + 58); X.closePath(); ink('#5CFF7A', 3.5);
  // glass reflections
  X.fillStyle = 'rgba(255,255,255,.13)'; for (const [x, w] of [[220, 56], [300, 18], [560, 70]]) { X.beginPath(); X.moveTo(x, GT); X.lineTo(x + w, GT); X.lineTo(x + w - 150, GB); X.lineTo(x - 150, GB); X.fill(); }
  X.restore();
  // the lower panel: bevel, the prize door, the printer, the coin box
  rr(70, GB + 8, 660, 22, 8); ink('#9d7bff', 4); X.fillStyle = '#7c4dff'; X.fillRect(74, GB + 22, 652, 6);
  rr(100, 456, 100, 70, 10); ink('#2a1650', 4); X.fillStyle = '#3b2a6b'; X.fillRect(104, 460, 92, 12);
  rr(604, 452, 100, 92, 12); ink('#c9ced6', 4); X.fillStyle = '#a3a9b8'; X.fillRect(604, 524, 100, 4);
  rr(616, PRINT[1] - 5, 78, 10, 4); ink('#1b0f33', 3);
  rr(620, 492, 70, 28, 6); ink('#1b0f33', 3);
  X = old; return cv2;
}

/* a lost keyup (Alt-Tab / app switch while holding an arrow) must not leave the claw sliding: count focus losses, like hippo.js */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;

/* ═════════ the game ═════════ */
function duCrane(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), me = D.role, fr = 1 - me, judge = me === 0, TS = Math.sqrt(sp);
  const TRIES = 3, WIN = .8, GRACE = .1, WINJ = WIN + .8, DESC = .42, CLOSE = .12, RISE = .4, FALLT = 1.15, TOL = 30, SPEED = 560 * TS, KSPEED = 430 * TS;
  /* the level: which prize, a rare golden-crown version (1 in 8), and where it lands after each slip (x, tilt, facing) */
  const kind = Math.floor(R() * 3), rare = R() < 1 / 8, PZ = PRIZES[kind];
  const poses = []; let fl = R() < .5 ? 1 : -1, px0 = 0;
  for (let i = 0; i <= TRIES; i++) {
    const flipNow = i > 0 && R() < .65, x0 = 365 + R() * 105, a = (R() - .5) * .38;
    if (flipNow) fl = -fl;
    const x = i > 0 && Math.abs(x0 - px0) < 45 ? (px0 > 417 ? px0 - 70 : px0 + 70) : x0;   // it always lands somewhere visibly new
    poses.push({ x, a, f: fl }); px0 = x;
  }
  const duckX = 640 + R() * 30;
  const restM = n => { const p = poses[Math.min(n, TRIES)]; return Mx.mul(Mx.T(p.x, PY), Mx.mul(Mx.R(p.a), Mx.S(p.f * PZ.s, PZ.s))); };
  const gripsOf = n => PZ.G.map(([lx, ly], i) => { const [x, y] = Mx.pt(restM(n), lx, ly); return { i, x, y }; });
  /* where a claw dropped at x on try n stops: on a grip (g = its index), on the prize's body (-2) or in the balls (-1) */
  function depthFor(x, n) {
    const gr = gripsOf(n); let best = null;
    for (const q of gr) if (Math.abs(q.x - x) < TOL && (!best || Math.abs(q.x - x) < Math.abs(best.x - x))) best = q;
    if (best) return { g: best.i, y: best.y - GOFF };
    const p = poses[Math.min(n, TRIES)];
    if (Math.abs(x - p.x) < PZ.w * PZ.s * .8) return { g: -2, y: PY + PZ.top * PZ.s - GOFF + 6 };
    return { g: -1, y: 392 - GOFF };
  }

  /* the claws: x, state ('top' slides, 'down' drops, 'hold' hangs on a grip, 'up' goes back up, 'lift' carries), the grip it holds */
  const cl = [0, 1].map(r => ({ x: r ? 560 : 240, st: 'top', t0: 0, gi: -1, n: 0, w: -1, dy: HUBY0, y0: HUBY0, hubY: HUBY0, void: false, vx: 0, faceAt: -9, face: null }));
  const xT = track();
  let tx = cl[me].x, kx = 0, lastSX = -1, lastSAt = -9, humAt = 0, queued = false, fN = FOCUSN;
  /* mouse hover steers, so a cursor heading down to the DROP button would drag the claw off its mark on the way. A quick stroke
     straight down (< STROKET s) that ends below the glass was a trip to the button: the claw goes back to where that stroke began */
  const STROKET = .7; let aimX = tx, strokeAt = -1, lastPY = 0, lastMT = -9;
  /* the prize: phase 'open' (waiting), 'tip' (one grip held), 'fall' (slipped, lands in pose n+1), 'lift' (won), 'over' (no tries left) */
  let phase = 'open', n = 0, tries = 0, holds = [-1, -1], tipAt = -9, fallAt = -9, fallM = null, liftAt = -9, liftH = null, liftDy = 0, ending = null;
  let bonkAt = -9, yellAt = -9, clankAt = -9, resAt = -1, ticketsAt = -9, tickN = 0, tickLen = 0, doorAt = -9, quackAt = -9, gameOverAt = -9, lastBeat = -9;
  const bits = [], pops = [];

  function pop(s, size, bgc, fg, x, y) { pops.length = 0; pops.push({ s, size, bgc, fg, x, y, t0: g.c, rot: (cr() - .5) * .16 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .9, gr: 600, rot: 0, vr: 0 }, o)); }
  function yellFx(x, y) {                         // the scream: a badge low over the pit (never over a grip mark), feathers / fur / notes from the grip
    yellAt = g.c; yellSnd(kind); pop(PZ.yell, 32, PZ.col, '#fff', clamp(poses[Math.min(n, TRIES)].x, 260, 540), 372);
    for (let i = 0; i < 6; i++) bit({ k: PZ.bit, x: x + (cr() - .5) * 40, y: y - 10, vx: (cr() - .5) * 220, vy: -(120 + cr() * 160), gr: PZ.bit === 'note' ? -60 : 180, vr: (cr() - .5) * 6, life: 1.1, c: ['#fff8d0', '#ffd84a', '#ff9f43'][i % 3] });
  }
  /* the prize's transform right now (and the matching grip points), from the phase */
  function prizeM(T) {
    if (phase === 'tip') {
      const both = holds[0] >= 0 && holds[1] >= 0 && holds[0] !== holds[1];
      if (both) return Mx.mul(Mx.T(Math.sin(T * 50) * 1.5, -10), restM(n));
      const hg = holds[0] >= 0 ? holds[0] : holds[1]; if (hg < 0) return restM(n);
      const gr = gripsOf(n), held = gr[hg], free = gr[1 - hg], k = ease((T - tipAt) / WIN), side = held.x > free.x ? 1 : -1;
      const da = -side * (.1 + .3 * k) + Math.sin(T * 34) * .025 * k;
      return about(free.x, free.y, da, restM(n));
    }
    if (phase === 'fall' || (phase === 'over' && T - fallAt < FALLT)) {
      const u = (T - fallAt) / FALLT, to = poses[Math.min(n + 1, TRIES)], from = poses[n];
      if (u < .22) {                                                     // it drops back and swings
        const k = u / .22, da = fallM.da * Math.cos(k * Math.PI * 1.5) * (1 - k);
        return Mx.mul(Mx.T(0, -fallM.rise * (1 - k * k)), about(fallM.px, fallM.py, da, restM(n)));
      }
      const v = ease((u - .22) / .78), hop = Math.sin(clamp((u - .22) / .6, 0, 1) * Math.PI) * 70;      // then hops (and maybe turns round) to its new spot
      let sx = lerp(from.f, to.f, v); if (Math.abs(sx) < .08) sx = sx < 0 ? -.08 : .08;
      return Mx.mul(Mx.T(lerp(from.x, to.x, v), PY - hop), Mx.mul(Mx.R(lerp(from.a, to.a, v) + (from.f !== to.f ? Math.sin(v * Math.PI) * .3 : 0)), Mx.S(sx * PZ.s, PZ.s * (1 + Math.sin(v * Math.PI * 2) * .06))));
    }
    if (phase === 'lift') {
      const u = T - liftAt, p = poses[n], rise = ease(u / .35), carry = ease((u - .38) / .4), a = lerp(p.a, 0, rise);
      const lo = Math.min(...PZ.G.map(q => q[0] * p.f * PZ.s)), home = CHX + 4 + Math.max(0, XMIN + 6 - (CHX + 4 + lo));   // carried left as far as the claws go
      let x = lerp(p.x, home, carry), y = PY - rise * liftDy, sq = 1;
      if (u > .8) { const k = (u - .8) / .35; y += k * k * 300; sq = Math.max(.3, 1 - k * .5); x = lerp(home, CHX, Math.min(1, k * 2)); }   // claws open: it plops into the chute
      return Mx.mul(Mx.T(x, y), Mx.mul(Mx.R(a + Math.sin(u * 16) * .04 * (1 - carry)), Mx.S(p.f * sq * PZ.s, PZ.s)));
    }
    return restM(Math.min(phase === 'over' ? n + 1 : n, TRIES));
  }
  const gripNow = (T, i) => { const m = prizeM(T), [lx, ly] = PZ.G[i]; const [x, y] = Mx.pt(m, lx, ly); return { x, y }; };

  /* ── the shared verdict pieces (the JUDGE calls them and tells the partner; the partner replays them when told) ── */
  function slip() {                                    // the grip slips: the prize swings, falls back, hops to pose n+1
    const gr = gripsOf(n); let px = gr[0].x, py = gr[0].y, da = 0, rise = 0;
    if (phase === 'tip') {
      const hg = holds[0] >= 0 ? holds[0] : holds[1];
      if (hg >= 0 && !(holds[0] >= 0 && holds[1] >= 0 && holds[0] !== holds[1])) { const free = gr[1 - hg], held = gr[hg], side = held.x > free.x ? 1 : -1; px = free.x; py = free.y; da = -side * (.1 + .3 * ease((g.c - tipAt) / WIN)); }
      else rise = 10;
    }
    fallM = { px, py, da, rise }; fallAt = g.c; tries++; holds = [-1, -1];
    phase = tries >= TRIES ? 'over' : 'fall';
    for (const c of cl) { if (c.st === 'hold') { c.st = 'up'; c.t0 = g.c; c.y0 = c.hubY; c.face = 'sad'; c.faceAt = g.c; } else if (c.st === 'down') c.void = true; }
    snd(300, .08, 'square', .05, 0, 120); sfx.whoosh(false); setTimeout0(() => { sfx.thud(); sfx.boing(); }, .26);
    const gp = gripNow(g.c, 0); yellFx(gp.x, gp.y);
    pop(tries >= TRIES ? 'GAME OVER' : 'SLIPPED!', tries >= TRIES ? 34 : 32, '#e8434f', '#fff', 420, 350);
    if (tries >= TRIES) { gameOverAt = g.c; if (judge && !ending) ending = { res: 'lose', at: g.c + 1.0 }; }
  }
  function lift(h) {                                   // two claws, two grips: up it goes
    const gr = gripsOf(n); liftDy = Math.max(30, Math.min(gr[0].y, gr[1].y) - (HUBY0 + GOFF + 8));   // up until the claws are home
    phase = 'lift'; liftAt = g.c; liftH = h.slice(); holds = h.slice();
    for (const c of cl) { c.st = 'lift'; c.face = 'happy'; c.faceAt = g.c; }
    [523, 659, 784, 1047].forEach((f, i) => snd(f, .1, 'square', .05, i * .06)); noise(.4, .05, 300, 2400, 'bandpass');
    pop('TOGETHER!', 34, '#22a447', '#fff', 440, 372);
    if (judge && !ending) ending = { res: 'win', at: g.c + .62 };
  }
  function clank(w) {                                  // claw w closed on the grip the other one has: it bounces off and goes up
    const c = cl[w]; if (c.st === 'hold' || c.st === 'down') { if (c.st === 'down') c.void = true; else { c.st = 'up'; c.t0 = g.c; c.y0 = c.hubY; } }
    holds[w] = -1; if (phase === 'tip' && holds[0] < 0 && holds[1] < 0) phase = 'open';
    clankAt = g.c; snd(1300, .05, 'square', .05); snd(1900, .08, 'square', .04, .03); pop('CLANK!', 30, '#8d94a3', '#fff', cl[w].x, 230);
  }
  /* a claw finishes its drop: did it close on a grip of the current pose? */
  function onClose(r) {
    const c = cl[r];
    const miss = () => { c.st = 'up'; c.t0 = g.c + CLOSE; c.y0 = c.dy; };
    sfx.click(); snd(260, .06, 'square', .05);
    if (c.void || c.n !== n || (phase !== 'open' && phase !== 'tip') || c.gi < 0 || g.result || ending) {
      if (!c.void && c.gi === -2) { bonkAt = g.c; snd(180, .12, 'sine', .08, 0, 90); pop('BONK!', 30, '#e8434f', '#fff', c.x, 236); c.face = 'sad'; c.faceAt = g.c; }
      else if (!c.void && c.gi === -1 && Math.abs(c.x - duckX) < 46) { quackAt = g.c; snd(700, .1, 'square', .05, 0, 500); snd(640, .12, 'square', .05, .12, 420); pop('QUACK!', 26, '#ffd23f', INK, duckX, 300); }
      miss(); return;
    }
    if (judge) {
      if (holds[1 - r] === c.gi) { clank(r); D.send('c', { n, w: r }); return; }
      holds[r] = c.gi; c.st = 'hold';
      if (phase === 'open') { phase = 'tip'; tipAt = g.c; const q = gripsOf(n)[c.gi]; yellFx(q.x, q.y); }
      else if (c.w <= WIN + GRACE) { D.send('v', { n, r: 'l', h: holds.slice() }); lift(holds); }   // pressed before its ring ran out
      else { D.send('v', { n, r: 'f' }); slip(); return; }                                             // too late: the first grip gives up
    } else {
      holds[r] = c.gi; c.st = 'hold';
      if (phase === 'open') { phase = 'tip'; tipAt = g.c; const q = gripsOf(n)[c.gi]; yellFx(q.x, q.y); }
    }
    snd(880, .08, 'triangle', .05, .04);
  }
  /* a sound a bit later without timers on the game clock */
  const later = [];
  function setTimeout0(fn, d) { later.push({ at: g.c + d, fn }); }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: 'GRAB!', roleLabel: me === 0 ? 'PINK CLAW' : 'BLUE CLAW',
    hint: 'MOUSE / ◄ ► TO MOVE, CLICK / SPACE TO DROP - GRAB BOTH MARKS TOGETHER!',
    thint: 'DRAG TO MOVE, TAP DROP - GRAB BOTH MARKS TOGETHER!',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) resAt = T;
      for (let i = later.length - 1; i >= 0; i--) if (T >= later[i].at) { later[i].fn(); later.splice(i, 1); }
      if (FOCUSN !== fN) { fN = FOCUSN; kx = 0; queued = false; }                // the window lost focus: forget held keys
      // my claw slides (pointer target or keys); the partner's follows its snapshots ~150 ms behind
      const c = cl[me];
      if (c.st === 'top' && !g.result && phase !== 'lift') {
        const x0 = c.x;
        if (kx) { c.x = clamp(c.x + kx * KSPEED * dt, XMIN, XMAX); tx = aimX = c.x; strokeAt = -1; }
        else { const d = tx - c.x, s = SPEED * dt; c.x += Math.abs(d) < s ? d : Math.sign(d) * s; }
        c.vx = (c.x - x0) / Math.max(dt, 1e-4);
        if (queued && Math.abs(c.x - tx) < 1) { queued = false; g.drop(); }      // a mouse click = slide there, then drop
        const rx = Math.round(c.x); if (rx !== lastSX && T - lastSAt >= .1) { lastSX = rx; lastSAt = T; D.send('x', rx, true); }
        if (Math.abs(c.vx) > 40 && T - humAt > .09) { humAt = T; snd(95 + Math.abs(c.vx) * .05, .07, 'square', .012); }
      } else c.vx = 0;
      const o = cl[fr];
      if (o.st === 'top' && phase !== 'lift') { const v = xT.at(); if (v !== null) { o.vx = (v - o.x) / Math.max(dt, 1e-4); o.x = v; } } else o.vx = 0;
      // drops, closes, rises
      for (let r = 0; r < 2; r++) {
        const q = cl[r];
        if (q.st === 'down') { q.hubY = lerp(HUBY0, q.dy, ease((T - q.t0) / DESC)); if (T >= q.t0 + DESC) onClose(r); }
        else if (q.st === 'up') { q.hubY = lerp(q.y0, HUBY0, ease((T - q.t0) / RISE)); if (T >= q.t0 + RISE) { q.st = 'top'; q.hubY = HUBY0; q.void = false; q.gi = -1; } }
        else if (q.st === 'hold' && q.gi >= 0) { const gp = gripNow(T, q.gi); q.x = gp.x; q.hubY = gp.y - GOFF; }
        else if (q.st === 'lift' && liftH && liftH[r] >= 0) { if (T - liftAt < .8) { const gp = gripNow(T, liftH[r]); q.x = gp.x; q.hubY = gp.y - GOFF; q.y0 = q.hubY; } else q.hubY = lerp(q.y0, HUBY0, ease((T - liftAt - .95) / .3)); }
      }
      // the window: the ring gives WIN s to press; the judge also waits for a press still on the wire (a claw already dropping
      // on this try is always waited for: its press time decides), then the first grip slips
      if (judge && phase === 'tip' && !ending && T >= tipAt + WINJ && !cl.some(q => q.st === 'down' && q.n === n && !q.void)) { D.send('v', { n, r: 'f' }); slip(); }
      if (phase === 'tip' && T - lastBeat > .28) { lastBeat = T; snd(1046, .05, 'square', .03); }    // a nervous beep while it tips
      if (phase === 'fall' && T - fallAt >= FALLT) { phase = 'open'; n++; }
      // the payoff: the prize drops into the chute, the door pops, the printer spits tickets
      if (phase === 'lift') {
        const u = T - liftAt;
        if (u > .95 && doorAt < 0) { doorAt = T; sfx.thud(); snd(196, .12, 'square', .06); ring(150, 490, '#fff', 60, .3); }
        if (u > 1.0) { if (ticketsAt < 0) { ticketsAt = T; sfx.sparkle(); } tickLen = Math.min(3200, (T - ticketsAt) * 2400); const k = Math.floor(tickLen / 34); if (k > tickN) { tickN = k; snd(1500 + (k % 3) * 200, .025, 'square', .025); } }
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.vx *= 1 - dt * 1.5; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && T - pops[0].t0 > 1.1) pops.length = 0;
      if (judge && !g.result) { if (ending && T >= Math.min(ending.at, g.limit)) g.finish(ending.res); else if (!ending && T >= g.limit) g.finish('lose'); }
    },
    msg(type, d) {
      if (type === 'x') xT.push(d);
      else if (type === 'drop') {
        const o = cl[fr]; xT.push(d.x);
        if (o.st === 'lift') return;
        const dep = depthFor(d.x, d.n);
        Object.assign(o, { st: 'down', x: d.x, t0: g.c, gi: d.g, n: d.n, w: d.w, dy: dep.y, void: d.n !== n || phase === 'fall' || phase === 'over' });
        noise(.3, .03, 1800, 500, 'bandpass');
      } else if (type === 'v' && !judge) {
        if (d.n !== n || phase === 'lift') return;
        if (d.r === 'l') lift(d.h);
        else if (d.r === 'f' && phase !== 'fall' && phase !== 'over') slip();
      } else if (type === 'c' && !judge) { if (d.n === n) clank(d.w); }
    },
    drop() {
      const c = cl[me];
      if (c.st !== 'top' || g.result || ending || g.c < .25 || (phase !== 'open' && phase !== 'tip')) return false;
      const dep = depthFor(c.x, n), x = Math.round(c.x), w = phase === 'tip' ? Math.round((g.c - tipAt) * 100) / 100 : -1;   // how far into MY ring I pressed
      Object.assign(c, { st: 'down', x, t0: g.c, gi: dep.g, n, w, dy: dep.y, void: false }); tx = x;
      D.send('drop', { n, x, g: dep.g, w }); lastSX = x;
      noise(.38, .05, 2200, 400, 'bandpass'); snd(620, .36, 'sawtooth', .025, 0, 240);
      return true;
    },
    draw() {
      const T = g.c, won = phase === 'lift', lost = g.result === 'lose' || phase === 'over', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) { BG = buildBg(); FG = buildFg(); }
      X = ctx; X.fillStyle = '#170c30'; X.fillRect(-OX, 0, VW, H);
      X.drawImage(BG, 0, 0);
      marquee(T, won, lost);
      // the duck: a plush in the corner that stares at MY claw (and squeaks when bonked)
      duck(T);
      // grip marks (under the claws): pulsing rings; held = the claw's colour
      const showMarks = phase === 'open' || phase === 'tip';
      if (showMarks) for (let i = 0; i < 2; i++) {
        const q = gripNow(T, i), heldBy = holds[0] === i ? 0 : holds[1] === i ? 1 : -1;
        if (heldBy >= 0) continue;
        const near = cl[me].st === 'top' && Math.abs(cl[me].x - q.x) < TOL, pulse = 1 + Math.sin(T * 8 + i) * .12, urgent = phase === 'tip';
        X.save(); X.translate(q.x, q.y); X.rotate(T * 1.5);
        X.setLineDash([7, 6]); X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.arc(0, 0, 21 * pulse, 0, TAU); X.stroke();
        X.lineWidth = 4.5; X.strokeStyle = near ? COLS[me] : urgent ? '#ff4d5e' : '#ffe14d'; X.stroke(); X.setLineDash([]); X.restore();
      }
      // cables + trolleys (behind the prize), the prize, then the claws on top of it
      for (let r = 1; r >= 0; r--) {
        const q = cl[r], ry = RAIL[r];
        X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(q.x, ry + 6); X.lineTo(q.x, q.hubY - 18); X.stroke();
        X.strokeStyle = '#d6dbe4'; X.lineWidth = 3; X.stroke();
        trolley(q.x, ry, COLS[r], DARKS[r], T, Math.abs(q.vx) > 30);
      }
      const inChute = won && T - liftAt > .8;
      const m = prizeM(T);
      const mood = won ? 'happy' : (lost && (rk > .05 || (phase === 'over' && T - fallAt > FALLT))) ? 'rasp' : (phase === 'fall' || (phase === 'over' && T - fallAt < FALLT)) ? 'dizzy' : phase === 'tip' ? 'panic' : T - bonkAt < .6 ? 'bonk' : 'idle';
      const look = (() => { const q = cl[me]; const [cx, cy] = Mx.pt(m, 0, -80); return [clamp((q.x - cx) / 160, -1, 1), clamp((q.hubY - cy) / 160, -1, 1)]; })();
      X.save(); X.beginPath(); if (inChute) { X.rect(GL, GT, GR - GL, CHT - GT + 4); X.rect(CHX + 52, CHT, GR - CHX - 52, GB - CHT); } else X.rect(GL, GT, GR - GL, GB - GT); X.clip();   // inside the glass (and, once dropped, behind the chute)
      X.save(); X.transform(...m); shadowAt(); PZ.draw({ mood, T, look: [look[0] * (m[0] < 0 ? -1 : 1), look[1]], strain: phase === 'tip' ? 1 : 0, rare }); X.restore();
      X.restore();
      for (let r = 1; r >= 0; r--) {
        const q = cl[r], st = q.st;
        let open = 1;
        if (st === 'down') { const k = T - q.t0; open = k < DESC ? 1 : clamp(1 - (k - DESC) / CLOSE, 0, 1); }
        else if (st === 'hold') open = 0;
        else if (st === 'up') open = T < q.t0 ? clamp(1 - (T - (q.t0 - CLOSE)) / CLOSE, 0, 1) : .3;
        else if (st === 'lift') open = T - liftAt > .8 ? ease((T - liftAt - .8) / .12) : 0;
        else open = .55 + Math.sin(T * 3 + r) * .05;
        const face = (q.face && T - q.faceAt < 1.2) ? q.face : won ? 'happy' : lost ? 'sad' : st === 'hold' ? 'strain' : null;
        const sw = st === 'top' ? clamp(-q.vx / 1400, -.25, .25) : 0;
        X.save(); X.translate(q.x, q.hubY - 16); X.rotate(sw); claw(0, 16, open, COLS[r], DARKS[r], face, T, CSC); X.restore();
        if (st === 'hold' && phase === 'tip' && r === (holds[0] >= 0 && holds[1] < 0 ? 0 : holds[1] >= 0 && holds[0] < 0 ? 1 : -1)) {   // the countdown ring on the lone claw
          const k = clamp((T - tipAt) / WIN, 0, 1); X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.arc(q.x, q.hubY - 2, 40, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); X.stroke();
          X.lineWidth = 4.5; X.strokeStyle = k > .55 ? '#ff4d5e' : '#fff'; X.stroke();
        }
      }
      X.drawImage(FG, 0, 0);
      // name tags on the trolleys
      for (const r of [fr, me]) pill(cl[r].x, RAIL[r] - 24, r === me ? 'YOU' : 'YOUR FRIEND', COLS[r], false);
      drawBits(T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 10, q.size, q.bgc, q.fg, a < .22 ? outBack(a / .22) : 1, q.rot); X.globalAlpha = 1; }
      panel(T, won, lost);
      if (won) tickets(T);
      vignette(.14);
    },
    move(p) {
      if (g.result || queued) return;
      const goingDown = !TOUCH && p.y > lastPY + .5, gap = g.c - lastMT > .2; lastPY = p.y; lastMT = g.c;
      if (!goingDown) strokeAt = -1; else if (strokeAt < 0 || gap) { strokeAt = g.c; aimX = tx; }       // a downward stroke starts here
      if (p.y < 446) { tx = clamp(p.x, XMIN, XMAX); kx = 0; if (!goingDown) aimX = tx; }
      else if (strokeAt >= 0) { if (g.c - strokeAt < STROKET) tx = aimX; strokeAt = -1; }                  // it left the glass: back onto the mark
    },
    down(p) {
      if (inDrop(p)) {
        if (strokeAt >= 0 && g.c - strokeAt < STROKET) tx = aimX; strokeAt = -1;
        if (!TOUCH && cl[me].st === 'top' && Math.abs(cl[me].x - tx) >= 1) queued = true; else g.drop();   // slide back onto the mark, then drop
        return;
      }
      if (p.y < 446) { tx = clamp(p.x, XMIN, XMAX); aimX = tx; strokeAt = -1; if (!TOUCH && cl[me].st === 'top') queued = true; }   // touch: a tap only slides the claw; mouse: slide there and drop
    },
    key(e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { kx = -1; queued = false; }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { kx = 1; queued = false; }
      else if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS')) g.drop();
    },
    keyup(e) { if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && kx < 0) kx = 0; else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && kx > 0) kx = 0; },
  };

  function shadowAt() { X.fillStyle = 'rgba(20,16,28,.22)'; el(0, -2, PZ.w * .7, 9); X.fill(); }
  function marquee(T, won, lost) {                 // the light-bulb sign: chases while playing, rainbow on a win, dies on GAME OVER
    for (let i = 0; i < 22; i++) {
      const x = 98 + i * 28.8, on = won ? true : lost ? (i % 2 === 0 && Math.sin(T * 6) > 0) : (Math.floor(T * 8) + i) % 4 === 0;
      const c = won ? `hsl(${(i * 30 + T * 600) % 360},90%,62%)` : lost ? '#ff4d5e' : on ? '#fff6a8' : '#d6a23a';
      X.beginPath(); X.arc(x, 56, 5, 0, TAU); ink(c, 2);
    }
    const s = won ? 'WINNER!' : lost ? 'GAME OVER' : 'TWO-CLAW CRANE', wob = won ? Math.sin(T * 14) * .04 : 0;
    X.save(); X.translate(400, 77); X.rotate(wob); txt(s, 0, 0, 24, won ? '#FFE14D' : lost ? '#ff8a94' : '#fff', 'center', 560); X.restore();
  }
  function duck(T) {
    const x = duckX, y = 396, q = cl[me], lk = clamp((q.x - x) / 200, -1, 1), sq = T - quackAt < .3 ? 1 - Math.sin((T - quackAt) / .3 * Math.PI) * .25 : 1;
    X.save(); X.translate(x, y); X.scale(1 / sq, sq);
    el(0, 0, 26, 18); ink('#ffe14d', 3.5); el(-4, -24, 15, 14); ink('#ffe14d', 3.5);
    X.beginPath(); X.moveTo(-18, -22); X.lineTo(-32, -18); X.lineTo(-18, -14); X.closePath(); ink('#ff9a2e', 2.5);
    el(-8 + lk * 3, -28, 4.5, 5); ink('#fff', 1.5); X.fillStyle = INK; el(-8 + lk * 4.5, -28 + (q.hubY - 200) / 120, 2, 2.6); X.fill();
    X.restore();
  }
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0; X.globalAlpha = clamp(1 - (a - b.life * .6) / (b.life * .4), 0, 1);
      X.save(); X.translate(b.x, b.y); X.rotate(b.rot);
      if (b.k === 'feather') { el(0, 0, 11, 4.5); ink(b.c, 2); X.strokeStyle = 'rgba(200,140,20,.7)'; X.lineWidth = 1.5; X.beginPath(); X.moveTo(-10, 0); X.lineTo(10, 0); X.stroke(); }
      else if (b.k === 'fur') { X.beginPath(); X.moveTo(-8, 3); X.quadraticCurveTo(0, -8, 8, 3); X.lineWidth = 6; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 3; X.strokeStyle = CAT; X.stroke(); }
      else if (b.k === 'note') { X.rotate(-b.rot); X.fillStyle = INK; el(0, 0, 7, 5.5, -.4); X.fill(); X.fillRect(5, -22, 3.5, 22); X.beginPath(); X.moveTo(8.5, -22); X.quadraticCurveTo(18, -16, 14, -6); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
      else if (b.k === 'star') star(0, 0, 9, 4, 5, 0, b.c, 2.5);
      X.restore();
    }
    X.globalAlpha = 1;
  }
  function panel(T, won, lost) {                   // the control panel: prize door, joystick, my DROP button, tries, the ticket printer
    // prize door: the flap swings open and the prize pokes out, tiny and proud
    const dk = doorAt > 0 ? T - doorAt : -1;
    if (dk >= 0) {
      X.save(); X.beginPath(); X.rect(104, 460, 92, 62); X.clip();
      const pop = outBack(dk / .3); X.translate(150, 520 + (1 - pop) * 60); X.scale(.34 * (poses[n].f), .34);
      PZ.draw({ mood: 'happy', T, look: [0, -1], rare }); X.restore();
    }
    X.save(); X.translate(104, 460); X.scale(1, dk >= 0 ? Math.max(.08, 1 - ease(dk / .15)) : 1); rr(0, 0, 92, 62, 8); ink('#5a3fa8', 3); X.strokeStyle = 'rgba(255,255,255,.3)'; X.lineWidth = 3; X.beginPath(); X.moveTo(10, 50); X.lineTo(82, 50); X.stroke(); X.restore();
    // joystick (tilts with my claw)
    const jt = clamp(cl[me].vx / 600, -1, 1) * .5 + (kx * .1);
    rr(232, 506, 62, 22, 9); ink('#3b2a6b', 3.5);
    X.save(); X.translate(263, 512); X.rotate(jt); tube([[0, 0], [0, -34]], 7, '#c9ced6'); X.beginPath(); X.arc(0, -40, 13, 0, TAU); ink(COLS[me], 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(-4, -45, 4, 3); X.fill(); X.restore();
    if (!TOUCH) { keyCap(240, 540, '◄'); keyCap(286, 540, '►'); }
    // my DROP button
    const ready = cl[me].st === 'top' && !g.result && !ending && (phase === 'open' || phase === 'tip'), pressed = cl[me].st === 'down' && T - cl[me].t0 < .15;
    const [bx, by, br] = DROP_B, d = pressed ? 2 : 7, col = ready ? COLS[me] : '#b8b0cc', dkc = ready ? DARKS[me] : '#8a82a0';
    X.beginPath(); X.ellipse(bx, by + 8, br + 6, br * .62 + 6, 0, 0, TAU); ink('#3b2a6b', 4);
    X.beginPath(); X.ellipse(bx, by + 6, br, br * .62, 0, 0, TAU); ink(dkc, 0);
    X.beginPath(); X.ellipse(bx, by + 6 - d, br, br * .62, 0, 0, TAU); ink(col, 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; el(bx - 10, by - 6 - d, br * .55, br * .18); X.fill();
    if (ready && phase === 'tip' && cl[me].st === 'top') { X.globalAlpha = .5 + .5 * Math.sin(T * 20); X.beginPath(); X.ellipse(bx, by + 6 - d, br + 10, br * .62 + 10, 0, 0, TAU); X.lineWidth = 5; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
    txt('DROP', bx, by + 5 - d, 26, '#fff', 'center', br * 1.7);
    if (!TOUCH) keyCap(bx, by + 50, 'SPACE');
    // tries: three coins, spent ones go dark with a cross
    txt('TRIES', 548, 532, 16, '#fff', 'center', 90);
    for (let i = 0; i < TRIES; i++) {
      const used = i < tries, x = 520 + i * 28, y = 504;
      X.beginPath(); X.arc(x, y, 11, 0, TAU); ink(used ? '#6a5a8a' : '#ffd23f', 3);
      if (used) { X.strokeStyle = '#ff4d5e'; X.lineWidth = 3.5; X.beginPath(); X.moveTo(x - 6, y - 6); X.lineTo(x + 6, y + 6); X.moveTo(x + 6, y - 6); X.lineTo(x - 6, y + 6); X.stroke(); }
      else { X.fillStyle = '#fff6a8'; el(x - 3, y - 4, 4, 3); X.fill(); }
    }
    // the printer's counter
    const cnt = String(Math.floor(tickLen / 1.5)).padStart(4, '0');
    X.font = '700 20px "Courier New", monospace'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = won && ticketsAt > 0 ? '#ff4d5e' : '#7a2d3a'; X.fillText(cnt, 655, 507);
    void lost;
  }
  function tickets(T) {                            // a strip of tickets from the slot, down onto the panel, folding into a growing stack
    if (ticketsAt < 0) return;
    const L = tickLen;
    const pathAt = s => {                          // out of the slot, down to the panel's shelf, then folding back and forth into a growing stack
      if (s < 90) { const k = s / 90; return [lerp(PRINT[0] - 30, 560, k * k) + Math.sin(s * .1 + T * 9) * 3 * (1 - k), PRINT[1] + 4 + k * 70]; }
      s -= 90; const fold = 120, i = Math.floor(s / fold), k = (s % fold) / fold, dir = i % 2 ? -1 : 1;
      return [560 + dir * (k - .5) * 104 + Math.sin(i * 1.7) * 5, 546 - Math.min(i, 22) * 5.5 - Math.sin(k * Math.PI) * 5];
    };
    // one ticket every 20 px along the path, each a little inked card turned along the strip (the newest one still in the slot)
    const tc = rare ? ['#ffd23f', '#ffe98a'] : ['#ff9f43', '#ffc285'];
    for (let s = Math.max(0, L - 3200); s <= L; s += 20) {
      const [x, y] = pathAt(s), [x2, y2] = pathAt(s + 4), a = Math.atan2(y2 - y, x2 - x);
      X.save(); X.translate(x, y); X.rotate(a); rr(-10, -9, 20, 18, 2.5); ink(tc[(s / 20) % 2], 2.5);
      X.fillStyle = 'rgba(120,40,10,.55)'; X.fillRect(-1, -6, 2, 12); star(5, 0, 3.6, 1.6, 5, 0, '#fff', 0); X.restore();
    }
    if (L > 300 && Math.floor(T * 10) % 3 === 0 && cr() < .4) bit({ k: 'star', x: PRINT[0] + (cr() - .5) * 80, y: 520, vx: (cr() - .5) * 200, vy: -200, gr: 500, life: .5, c: '#ffe14d' });
  }

  g.dbg = {
    kind, poses, TRIES,
    grips: () => (phase === 'open' || phase === 'tip') && !g.result ? gripsOf(n) : [],                         // both screens show the marks
    me: () => ({ x: cl[me].x, st: cl[me].st, hold: holds[me] }),
    friend: () => ({ x: cl[fr].x, st: cl[fr].st, hold: holds[fr] }),                                           // as drawn (interpolated)
    phase: () => phase, tries: () => tries,
  };
  wire(g, D, 0, sp, 'du_crane');
  return g;
}
reg('du_crane', duCrane, 'TWO-CLAW CRANE'); REGMAP.du_crane.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 4.2 s loop: both claws line up, drop together, lift ───────────── */
let DBG = null;
function buildDemoBg() {
  const c2 = document.createElement('canvas'); c2.width = 520; c2.height = 240; const old = X; X = c2.getContext('2d');
  const gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#ff8ad0'); gr.addColorStop(1, '#7a3dd6'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  for (let y = 20; y < 240; y += 40) for (let x = (y / 40 % 2) * 30 + 14; x < 520; x += 60) star(x, y, 6, 2.5, 4, .3, 'rgba(255,255,255,.16)', 0);
  for (const ry of [22, 34]) { rr(0, ry - 3, 520, 6, 3); ink('#c9ced6', 2); }
  const r0 = mulberry32(5); for (let i = 0; i < 34; i++) ball(r0() * 520, 214 + r0() * 26, 9 + r0() * 3, BALLC[Math.floor(r0() * 7)]);
  X = old; return c2;
}
function demo(role, t) {
  X = ctx; if (!DBG) DBG = buildDemoBg(); X.drawImage(DBG, 0, 0);
  const u = t % 4.2, PSc = .62, px = 300, py = 226, G = PRIZES[0].G.map(([a, b]) => [px + a * PSc, py + b * PSc]);
  const lineUp = ease(u / 1.1), dropK = ease((u - 1.25) / .35), lifted = ease((u - 1.8) / .5), back = ease((u - 3.6) / .5);
  const x0 = lerp(70, G[0][0], lineUp * (1 - back)), x1 = lerp(470, G[1][0], lineUp * (1 - back));
  const restY = 62, gripY = G[0][1] - GOFF * PSc;
  const hubY = u < 1.8 ? lerp(restY, gripY, dropK) : lerp(gripY, restY + 22, lifted);
  const up = u > 1.8 ? (gripY - hubY) : 0, open = u < 1.6 ? 1 : 0;
  X.save(); X.translate(px, py - up); X.scale(PSc, PSc); chicken({ mood: u > 1.6 && u < 1.8 ? 'panic' : u > 1.8 ? 'happy' : 'idle', T: t, look: [0, -1] }); X.restore();
  for (const [r, x] of [[1, x1], [0, x0]]) {
    X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(x, r ? 22 : 34); X.lineTo(x, hubY - 10); X.stroke(); X.strokeStyle = '#d6dbe4'; X.lineWidth = 2; X.stroke();
    claw(x, hubY, open, COLS[r], DARKS[r], u > 1.8 ? 'happy' : null, t, .7);
  }
  if (u < 1.2) for (const [gx, gy] of G) { X.setLineDash([5, 5]); X.lineWidth = 3; X.strokeStyle = '#ffe14d'; X.beginPath(); X.arc(gx, gy, 14, 0, TAU); X.stroke(); X.setLineDash([]); }
  if (u > 2 && u < 3.6) badge('TOGETHER!', 118, 118, 20, '#22a447', '#fff', outBack((u - 2) / .25), -.04);
  // my claw: the finger drags it, then taps DROP
  const mx = role ? x1 : x0;
  rr(400, 180, 104, 44, 14); ink(u > 1.15 && u < 1.4 ? DARKS[role] : COLS[role], 3); txt('DROP', 452, 203, 20, '#fff', 'center', 90);
  if (u < 1.1) demoFinger(mx, 150, true, 0);
  else if (u < 1.5) demoFinger(452, 210, u > 1.15 && u < 1.4, (u - 1.15) / .25);
  pill(mx, 12, 'YOU', COLS[role], false);
}
DUO.INFO.du_crane = [['PINK CLAW', 'GRAB ONE MARK', 'MOVE + DROP TOGETHER'], ['BLUE CLAW', 'GRAB THE OTHER MARK', 'MOVE + DROP TOGETHER']];
DUO.DEMOS.du_crane = [t => demo(0, t), t => demo(1, t)];

})();
