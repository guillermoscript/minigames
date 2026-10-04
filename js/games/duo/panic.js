'use strict';
/* ═════════ PANIC PANEL (DUO, scope 'du'), after Spaceteam. A rocket in trouble, two rooms, two control panels.
   BRIDGE (role 0, the JUDGE): RED BUTTON, BANANA, HORN.      ENGINE ROOM (role 1): LEVER, VALVE, TOILET.
   Each player gets order cards ("FLUSH THE TOILET!") with a burning fuse. Most of them are for the OTHER room's controls, so you
   shout them (voice, or tap the card: your friend's intercom flashes the icon) and your friend finds it on their own panel.
   Orders: each panel runs a queue with one open order at a time. What each order is (control, whose card) comes from the room
   seed on both clients; WHEN it opens is the judge's call ('go {i}': next one BEAT s after the last was done or lost), so a
   blind press is right only 1 time in 3. A press travels as 'act {k, c, q}'; the judge matches it against its panel's open
   order and answers 'ok {i, n, b, q}', or 'no {q, k, ...}': {j: 1} a double press / a press while jammed (nothing happens),
   {late: 1} a press for the order just lost (TOO LATE!, no penalty), or {c, J}: a press nobody asked for (something absurd
   happens, the panel jams for J s, and the hull cracks: 'x {i: -1, n}'). Lost orders crack the hull: 'x {i, n}'.
   Shouts: 'yell {i, k}' (not 'ping': party.js keeps ping/pong for its own latency probe). Win: NEED orders done. Lose: MAXX cracks, or the time runs out. ═════════ */
(function () {
'use strict';
const { clamp, mkR, wire, YEL, GRN, RED, PNK } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const easeOut = k => { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k) * (1 - k); };
const easeBack = k => { k = clamp(k, 0, 1); const c = 1.8; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

/* ───────────── colour + path helpers ───────────── */
const MC = new Map();
const hex2 = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
function mix(a, b, k) {
  const key = a + b + k; let v = MC.get(key); if (v) return v;
  const A = hex2(a), B = hex2(b); v = '#' + A.map((x, i) => Math.round(x + (B[i] - x) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v;
}
const lite = (c, k = .35) => mix(c, '#ffffff', k), dark = (c, k = .28) => mix(c, '#14101c', k);
const okCol = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#4DB8FF';
let OS = 1;                                               // outline scale: icons drawn small keep a readable ink line
function rrP(x, y, w, h, r) {
  const p = new Path2D(); r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p;
}
function elP(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; }
const PC = new Map();                                     // static rounded rects (cards, bubbles, plates) are built once
function rrC(x, y, w, h, r) { const key = x + ',' + y + ',' + w + ',' + h + ',' + r; let p = PC.get(key); if (!p) { p = rrP(x, y, w, h, r); PC.set(key, p); } return p; }
/* a cel shape: ink outline (o px visible), flat fill, then shade/light shapes clipped inside */
function shp(X, p, fill, o = 5, inner) {
  X.lineJoin = 'round'; X.lineCap = 'round';
  if (o) { X.strokeStyle = INK; X.lineWidth = o * 2 * OS; X.stroke(p); }
  X.fillStyle = fill; X.fill(p);
  if (inner) { X.save(); X.clip(p); inner(X); X.restore(); }
}
function line(X, pts, w, col = INK) { X.strokeStyle = col; X.lineWidth = w; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach((q, i) => i ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])); X.stroke(); }
function blob(X, x, y, rx, ry, col, rot = 0) { X.fillStyle = col; X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); X.fill(); }
function hazard(X, p, x0, x1, y0, y1, w = 14) {
  X.save(); X.clip(p); X.fillStyle = '#ffd23a'; X.fillRect(x0, y0, x1 - x0, y1 - y0); X.fillStyle = INK; const hh = y1 - y0;
  for (let x = x0 - hh; x < x1; x += w * 2) { X.beginPath(); X.moveTo(x, y1); X.lineTo(x + w, y1); X.lineTo(x + w + hh, y0); X.lineTo(x + hh, y0); X.closePath(); X.fill(); }
  X.restore();
}

/* ───────────── the six controls (art around 0,0 inside about x -100..100, y -100..80) ─────────────
   st = { p: press 0..1 (eased, springy), tp: seconds since the press, n: presses so far, t: clock } */
function artButton(X, st) {
  const d = clamp(st.p, -.2, 1);
  const cov = rrP(-56, -86, 112, 78, 16);                                      // flipped-up safety cover
  X.lineJoin = 'round'; X.strokeStyle = INK; X.lineWidth = 8 * OS; X.stroke(cov);
  X.fillStyle = 'rgba(160,226,255,.5)'; X.fill(cov);
  X.fillStyle = 'rgba(255,255,255,.65)'; X.fillRect(-42, -76, 9, 56); X.fillRect(-27, -76, 4, 56);
  shp(X, rrP(-30, -16, 60, 12, 5), '#8f9bbd', 4);                              // hinge
  const side = new Path2D(); side.moveTo(-84, 2); side.lineTo(-84, 36); side.ellipse(0, 36, 84, 24, 0, Math.PI, 0, true); side.lineTo(84, 2); side.ellipse(0, 2, 84, 24, 0, 0, Math.PI); side.closePath();
  X.strokeStyle = INK; X.lineWidth = 10 * OS; X.stroke(side); hazard(X, side, -96, 96, -30, 64, 13);
  X.save(); X.clip(side); X.fillStyle = 'rgba(20,16,28,.28)'; X.fillRect(34, -30, 70, 100); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(-84, -30, 18, 100); X.restore();
  shp(X, elP(0, 2, 84, 24), '#4b4666', 5); blob(X, 0, 4, 68, 17, '#1d1a2c');
  const y0 = -2 + d * 14, h = 48 * (1 - .36 * d), wx = 60 * (1 + .07 * d);
  const dome = new Path2D(); dome.ellipse(0, y0, wx, h, 0, Math.PI, 0); dome.ellipse(0, y0, wx, 15, 0, 0, Math.PI); dome.closePath();
  shp(X, dome, '#ff3b4e', 5, X => { blob(X, 22, y0 + 6, wx + 4, h + 18, '#c41630'); blob(X, -8, y0 - 8, wx - 6, h, '#ff3b4e'); blob(X, -14, y0 - h * .3, wx * .55, h * .55, '#ff6a78'); });
  blob(X, -24, y0 - h * .56, 15, 8, '#fff', -.5); blob(X, -3, y0 - h * .8, 5, 3.5, '#fff', -.3);
}
function bananaBody(sk) {                                                       // a chunky upright banana, stem at 0,0
  const p = new Path2D(); p.moveTo(-10, -2); p.bezierCurveTo(-50, -40, -46, -106, 4, -132); p.lineTo(12, -134); p.lineTo(16, -126);
  p.bezierCurveTo(-6, -102, -4, -44, 16, -4); p.quadraticCurveTo(4, 8, -10, -2); p.closePath(); return p;
}
function bananaBase(X) {
  shp(X, rrP(-44, 52, 88, 28, 8), '#f2b33d', 5, X => { X.fillStyle = '#c98a1c'; X.fillRect(-50, 68, 100, 20); X.fillStyle = '#ffe08a'; X.fillRect(-40, 55, 80, 5); });
  shp(X, rrP(-66, 30, 132, 30, 15), '#e2456e', 5, X => { X.fillStyle = '#b52a52'; X.fillRect(-70, 48, 140, 20); X.fillStyle = '#ff7ea0'; X.fillRect(-52, 33, 70, 6); });
  for (const sx of [-1, 1]) { line(X, [[sx * 60, 46], [sx * 66, 62]], 6 * OS); blob(X, sx * 66, 64, 6, 7, '#ffd23a'); }
}
function bananaWhole(X) {                                                          // the unpeeled fruit around its stem pivot
  shp(X, bananaBody(), '#ffd93b', 5, X => {
    X.fillStyle = '#e8a91c'; X.beginPath(); X.moveTo(6, -2); X.bezierCurveTo(-16, -40, -18, -100, -4, -128); X.lineTo(60, -128); X.lineTo(60, 0); X.fill();
    X.strokeStyle = '#fff3a0'; X.lineWidth = 6; X.beginPath(); X.moveTo(-22, -18); X.bezierCurveTo(-40, -50, -36, -96, -10, -118); X.stroke();
    blob(X, -18, -60, 3, 4, '#a5741a'); blob(X, -8, -96, 2.5, 3, '#a5741a');
  });
  blob(X, 12, -132, 5, 5, '#6b4a1e'); shp(X, rrP(-12, -6, 16, 12, 4), '#8a7a2a', 3.5);
}
function artBanana(X, st) {
  const e = st.tp < 0 ? 0 : st.tp < .14 ? st.tp / .14 : st.tp < .7 ? 1 : st.tp < .95 ? 1 - (st.tp - .7) / .25 : 0, pe = easeBack(e) * e;
  bananaBase(X);
  X.save(); X.translate(0, 40); X.rotate(.14 + Math.sin(st.t * 2.1) * .03);
  const body = bananaBody(), cut = -70;
  if (e <= .02) { bananaWhole(X); X.restore(); return; }
  {
    X.save(); X.beginPath(); X.rect(-60, cut, 120, 90); X.clip();
    shp(X, body, '#ffd93b', 5, X => { X.fillStyle = '#e8a91c'; X.beginPath(); X.moveTo(6, -2); X.bezierCurveTo(-16, -40, -18, -100, -4, -128); X.lineTo(60, -128); X.lineTo(60, 0); X.fill(); });
    X.restore();
    const petal = (px, a, sy) => { X.save(); X.translate(px, cut + 2); X.rotate(a); X.scale(1, sy);
      const p = new Path2D(); p.moveTo(-11, 0); p.quadraticCurveTo(-14, -30, -2, -56); p.lineTo(3, -56); p.quadraticCurveTo(13, -30, 11, 0); p.closePath();
      shp(X, p, '#ffd93b', 4.5, X => { X.fillStyle = '#e8a91c'; X.fillRect(3, -60, 14, 64); }); X.restore(); };
    petal(-14, 0, 1 - 1.2 * pe);                                                 // back petal folds down
    const fruit = new Path2D(); fruit.moveTo(-30, cut + 4); fruit.bezierCurveTo(-34, cut - 30 * pe, -22, cut - 52 * pe, -11, cut - 56 * pe); fruit.bezierCurveTo(0, cut - 52 * pe, 4, cut - 30 * pe, 2, cut + 4); fruit.closePath();
    shp(X, fruit, '#fff1c4', 4.5, X => { X.fillStyle = '#f3d98e'; X.fillRect(-6, cut - 70, 20, 80); });
    petal(-30, -pe * 2.2, 1); petal(2, pe * 2.2, 1);
  }
  blob(X, 12, -132, 5, 5, '#6b4a1e'); shp(X, rrP(-12, -6, 16, 12, 4), '#8a7a2a', 3.5);
  X.restore();
}
function artHorn(X, st) {
  const p = clamp(st.p, 0, 1);
  shp(X, rrP(-62, 56, 124, 22, 10), '#5d6b8f', 5, X => { X.fillStyle = '#7f8db0'; X.fillRect(-62, 56, 124, 6); });
  shp(X, rrP(-10, 10, 20, 52, 6), '#8f9bbd', 4);
  X.save(); X.rotate(Math.sin(st.t * 70) * .045 * p);
  const bell = new Path2D(); bell.moveTo(-16, -12); bell.lineTo(24, -12); bell.bezierCurveTo(44, -14, 60, -40, 74, -56); bell.lineTo(74, 56); bell.bezierCurveTo(60, 40, 44, 14, 24, 12); bell.lineTo(-16, 12); bell.closePath();
  shp(X, bell, '#f6c445', 5, X => { X.fillStyle = '#cf8f1d'; X.beginPath(); X.moveTo(-20, 5); X.lineTo(26, 5); X.bezierCurveTo(46, 6, 60, 30, 76, 46); X.lineTo(80, 70); X.lineTo(-20, 70); X.fill(); X.fillStyle = '#fff0a8'; X.fillRect(-14, -9, 36, 5); });
  shp(X, elP(74, 0, 15, 56), '#f9d66a', 5); blob(X, 77, 0, 9, 46, '#5a3510'); blob(X, 79, -14, 4, 16, '#7a4a18');
  shp(X, rrP(-24, -17, 12, 34, 4), '#c98a1c', 4);
  X.save(); X.translate(-22, 0); X.scale(1 - .4 * p, 1 + .22 * p);
  shp(X, elP(-36, 0, 38, 34), '#e8344a', 5, X => { blob(X, -24, 10, 40, 34, '#b61f3a'); blob(X, -42, -6, 32, 28, '#e8344a'); });
  blob(X, -50, -16, 11, 6, '#ff9aa6', -.5); blob(X, -38, -24, 4, 3, '#fff', -.3);
  X.restore(); X.restore();
  if (p > .05) { X.globalAlpha = Math.min(1, p * 1.6); for (let i = 0; i < 3; i++) { X.strokeStyle = INK; X.lineWidth = 7 * OS; X.lineCap = 'round'; X.beginPath(); X.arc(92, 0, 16 + i * 15 + p * 8, -.6, .6); X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 3 * OS; X.stroke(); } X.globalAlpha = 1; }
}
function artLever(X, st) {
  const a = -.34 + clamp(st.p, -.15, 1.1) * 1.45;
  shp(X, rrP(-64, -2, 128, 30, 15), '#2b2740', 5); blob(X, 0, 13, 50, 6, '#0e0b16');
  shp(X, rrP(-80, 22, 160, 58, 14), '#5d6b8f', 5, X => { X.fillStyle = '#46527a'; X.fillRect(-90, 60, 180, 30); X.fillStyle = '#8492b8'; X.fillRect(-80, 22, 160, 7); });
  hazard(X, rrP(-58, 40, 116, 16, 6), -60, 60, 40, 56, 11); X.lineWidth = 4 * OS; X.strokeStyle = INK; X.stroke(rrP(-58, 40, 116, 16, 6));
  for (const sx of [-66, 66]) { blob(X, sx, 50, 6, 6, INK); blob(X, sx, 49, 4, 4, '#c3cce4'); }
  X.save(); X.translate(0, 18); X.rotate(a);
  shp(X, rrP(-9, -96, 18, 104, 9), '#dfe6f5', 5, X => { X.fillStyle = '#a3aecb'; X.fillRect(2, -104, 12, 114); X.fillStyle = '#fff'; X.fillRect(-6, -92, 4, 86); });
  shp(X, elP(0, -100, 27, 27), '#ff4a4a', 5, X => { blob(X, 10, -92, 29, 29, '#c41f33'); blob(X, -4, -104, 23, 23, '#ff4a4a'); });
  blob(X, -10, -112, 9, 6, '#fff', -.6); blob(X, 2, -120, 3, 2, '#fff');
  X.restore();
  shp(X, elP(0, 18, 15, 15), '#8f9bbd', 4); blob(X, -3, 15, 5, 5, '#d5dcf0');
}
function valveBody(X) {
  shp(X, rrP(-17, -12, 34, 92, 6), '#e3913f', 5, X => { X.fillStyle = '#b8682a'; X.fillRect(6, -20, 20, 110); X.fillStyle = '#ffc07a'; X.fillRect(-11, -20, 6, 110); });
  for (const y of [0, 44]) shp(X, rrP(-27, y, 54, 14, 5), '#f2a24e', 4, X => { X.fillStyle = '#c9772e'; X.fillRect(-30, y + 8, 60, 8); });
  shp(X, rrP(26, 30, 22, 12, 3), '#c9772e', 3.5);                                // gauge
  shp(X, elP(66, 36, 24, 24), '#fff8e8', 5); X.strokeStyle = RED; X.lineWidth = 4 * OS; X.beginPath(); X.arc(66, 36, 17, -.4, .6); X.stroke();
}
const valveNa = st => -1.8 + .25 * Math.sin(st.t * 3.3) + clamp(st.p, 0, 1) * 1.6;
function valveNeedle(X, na) { line(X, [[66, 36], [66 + Math.cos(na) * 18, 36 + Math.sin(na) * 18]], 4 * OS); blob(X, 66, 36, 4, 4, INK); }
function valveWheel(X) {                                                           // the hand wheel at its own centre (unrotated)
  for (let i = 0; i < 5; i++) { X.save(); X.rotate(i * TAU / 5); shp(X, rrP(-6, -56, 12, 56, 4), '#d92f2b', 4); X.restore(); }
  const rim = new Path2D(); rim.arc(0, 0, 64, 0, TAU); rim.moveTo(48, 0); rim.arc(0, 0, 48, 0, TAU, true);
  shp(X, rim, '#ff4a3d', 5);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + TAU / 10; blob(X, Math.cos(a) * 56, Math.sin(a) * 56, 6, 6, '#c41f2a'); }
}
function valveHub(X) {
  X.strokeStyle = '#ffa08f'; X.lineWidth = 5 * OS; X.lineCap = 'round'; X.beginPath(); X.arc(0, 0, 56, 3.5, 4.5); X.stroke();
  shp(X, elP(0, 0, 18, 18), '#ffd23a', 4, X => blob(X, 6, 6, 16, 16, '#e0a91c')); blob(X, -5, -5, 5, 4, '#fff6c0');
}
const valveSpin = st => st.tp >= 0 && st.tp < .6 ? easeOut(st.tp / .6) * TAU : 0;
function artValve(X, st) {
  valveBody(X); valveNeedle(X, valveNa(st));
  X.save(); X.translate(0, -36); X.save(); X.rotate(valveSpin(st) + .3); valveWheel(X); X.restore(); valveHub(X); X.restore();
}
function artToilet(X, st) {
  const pull = clamp(st.p, -.2, 1), sw = st.tp >= 0 && st.tp < 1.1 ? 1 - st.tp / 1.1 : 0;
  shp(X, rrP(-7, -66, 14, 44, 4), '#cfd6ee', 4);
  shp(X, rrP(-54, -100, 108, 40, 12), '#f4f7ff', 5, X => { X.fillStyle = '#cdd4ec'; X.fillRect(-60, -72, 120, 20); X.fillStyle = '#fff'; X.fillRect(-44, -94, 64, 6); });
  line(X, [[40, -88], [64, -88 + pull * 10]], 9 * OS); line(X, [[40, -88], [64, -88 + pull * 10]], 4 * OS, '#c0c8e0');
  const hy = -42 + pull * 26;
  for (let y = -84 + pull * 10; y < hy; y += 7) { X.strokeStyle = INK; X.lineWidth = 2.6 * OS; X.beginPath(); X.ellipse(64, y, 2.6, 3.6, 0, 0, TAU); X.stroke(); }
  shp(X, elP(0, -16, 46, 38), '#e7ebfa', 5, X => { blob(X, 14, -6, 46, 38, '#c9d0ea'); blob(X, -14, -30, 14, 9, '#fff', -.4); });
  const ped = new Path2D(); ped.moveTo(-26, 44); ped.lineTo(26, 44); ped.lineTo(36, 80); ped.lineTo(-36, 80); ped.closePath();
  shp(X, ped, '#eef1fb', 5, X => { X.fillStyle = '#c9d0ea'; X.fillRect(8, 40, 40, 44); });
  const bowl = new Path2D(); bowl.moveTo(-58, 20); bowl.ellipse(0, 20, 58, 44, 0, Math.PI, 0, true); bowl.closePath();
  shp(X, bowl, '#f4f7ff', 5, X => { blob(X, 22, 40, 50, 40, '#cdd4ec'); X.fillStyle = '#fff'; X.fillRect(-48, 26, 10, 22); });
  shp(X, elP(0, 18, 62, 20), '#ffffff', 5);
  shp(X, elP(0, 19, 44, 12), '#4cc3ff', 3.5, X => {
    blob(X, 8, 24, 40, 10, '#2a9be0');
    if (sw > 0) { X.strokeStyle = '#e6f8ff'; X.lineWidth = 3; for (let i = 0; i < 3; i++) { X.beginPath(); X.ellipse(0, 19, 34 - i * 10, 9 - i * 2.6, 0, st.t * 14 + i * 2, st.t * 14 + i * 2 + 2.6); X.stroke(); } }
    else blob(X, -14, 15, 12, 3, '#a8e6ff');
  });
  shp(X, rrP(56, hy, 16, 26, 7), '#c9773a', 4, X => { X.fillStyle = '#a65a24'; X.fillRect(65, hy, 10, 30); X.fillStyle = '#f0a868'; X.fillRect(59, hy + 3, 4, 18); });
}
const ARTS = [artButton, artBanana, artHorn, artLever, artValve, artToilet];
const IDLE = { p: 0, tp: -1, n: 0, t: 0 }, CST = { p: 0, tp: -1, n: 0, t: 0 };
/* idle poses are pre-rendered once per (control, scale) into small sprites: the cards, the bubble and the resting panel controls
   blit them instead of rebuilding ~12 Path2Ds each per frame. Pressed controls (and the swaying banana / wobbling valve) stay vector. */
const SPR = new Map(), SB = { x0: -112, x1: 116, y0: -140, y1: 96 };
function sprite(k, s) {
  const key = k + ':' + s; let c = SPR.get(key); if (c) return c;
  const pad = 8, w = Math.ceil((SB.x1 - SB.x0) * s) + pad * 2, h = Math.ceil((SB.y1 - SB.y0) * s) + pad * 2;
  c = document.createElement('canvas'); c.width = w; c.height = h; const X = c.getContext('2d');
  X.translate(pad - SB.x0 * s, pad - SB.y0 * s); X.scale(s, s); const o = OS; OS = Math.max(1, .62 / s); IDLE.t = 0; ARTS[k](X, IDLE); OS = o;
  c.ox = pad - SB.x0 * s; c.oy = pad - SB.y0 * s; SPR.set(key, c); return c;
}
/* named part sprites (scale 1) for the panel: the valve body / wheel / hub and the banana base / fruit, so the idle motion
   (swaying banana, wobbling gauge, spinning wheel) is a blit + rotate, not a dozen Path2Ds per frame */
const PARTS = { vb: valveBody, vw: valveWheel, vh: valveHub, bb: bananaBase, bf: bananaWhole };
function part(name) {
  const key = 'p:' + name; let c = SPR.get(key); if (c) return c;
  const pad = 8, w = Math.ceil(SB.x1 - SB.x0) + pad * 2, h = Math.ceil(SB.y1 - SB.y0) + pad * 2;
  c = document.createElement('canvas'); c.width = w; c.height = h; const X = c.getContext('2d');
  X.translate(pad - SB.x0, pad - SB.y0); const o = OS; OS = 1; PARTS[name](X); OS = o;
  c.ox = pad - SB.x0; c.oy = pad - SB.y0; SPR.set(key, c); return c;
}
const blit = (name, x, y) => { const c = part(name); ctx.drawImage(c, x - c.ox, y - c.oy); };
function drawArt(k, x, y, s, st) {
  if (!st || (st.tp < 0 && !st.p)) { const c = sprite(k, s); ctx.drawImage(c, Math.round(x - c.ox), Math.round(y - c.oy)); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const o = OS; OS = Math.max(1, .62 / s);
  ARTS[k](ctx, st); OS = o; ctx.restore();
}
/* press curve: snaps in, holds, springs back with a wobble */
const pressK = tp => tp < 0 ? 0 : tp < .07 ? tp / .07 : tp < .2 ? 1 : tp < .9 ? Math.exp(-(tp - .2) * 7) * Math.cos((tp - .2) * 16) : 0;

const NAMES = ['RED BUTTON', 'BANANA', 'HORN', 'LEVER', 'VALVE', 'TOILET'];
const VERBS = ['PUSH THE', 'PEEL THE', 'HONK THE', 'PULL THE', 'SPIN THE', 'FLUSH THE'];
const NOUNS = ['RED BUTTON!', 'BANANA!', 'HORN!', 'LEVER!', 'VALVE!', 'TOILET!'];
const SND = [
  () => { snd(150, .08, 'square', .07); snd(620, .14, 'triangle', .07, .03, 310); noise(.05, .05, 2200, 900, 'bandpass'); },
  () => { noise(.14, .08, 500, 2600, 'bandpass', 0, 2); snd(320, .28, 'sine', .08, .03, 980); },
  () => { snd(330, .22, 'sawtooth', .07, 0, 300); snd(336, .22, 'square', .045, 0, 306); snd(330, .2, 'sawtooth', .065, .25, 292); snd(336, .2, 'square', .04, .25, 298); },
  () => { snd(190, .1, 'square', .07, 0, 95); snd(120, .16, 'sine', .12, .02, 50); noise(.07, .06, 3200, 1500, 'bandpass'); },
  () => { snd(900, .22, 'triangle', .035, 0, 1500); noise(.5, .07, 3000, 6500, 'highpass'); },
  () => { noise(.85, .1, 2600, 180, 'lowpass', 0, 1); snd(240, .3, 'sine', .07, .18, 90); snd(170, .35, 'sine', .06, .45, 70); },
];
const S = {
  shout: () => { snd(520, .07, 'square', .05, 0, 780); snd(780, .1, 'square', .045, .07, 1100); },
  ping: () => { snd(988, .1, 'triangle', .09); snd(740, .18, 'triangle', .09, .11); },
  card: () => { snd(1320, .05, 'square', .028); snd(1760, .07, 'square', .028, .06); },
  done: () => { sfx.stamp(); snd(784, .1, 'square', .045, .06); snd(1175, .22, 'square', .045, .14); noise(.45, .06, 300, 2600, 'bandpass', .06, 1.2); },
  crack: () => { sfx.thud(); noise(.3, .12, 4000, 500, 'bandpass', 0, .8); noise(.9, .045, 5000, 5000, 'highpass', .15); [880, 660, 880, 660].forEach((f, i) => snd(f, .12, 'square', .035, .22 + i * .14)); },
  moo: () => { snd(180, .6, 'sawtooth', .07, .25, 120); snd(182, .6, 'triangle', .06, .25, 118); sfx.whoosh(false); },
  kazoo: () => [523, 587, 523, 440, 523, 659].forEach((f, i) => { snd(f, .12, 'sawtooth', .05, i * .11, f * 1.03); snd(f * 1.01, .12, 'square', .02, i * .11); }),
  party: () => { sfx.pop(); snd(700, .4, 'sawtooth', .05, .05, 1300); sfx.sparkle(); },
  duck: () => [0, .18, .36].forEach(d => snd(1400, .09, 'square', .03, d, 2100)),
  bonk: () => snd(160, .09, 'square', .05, 0, 90),
};

/* ───────────── room palettes ───────────── */
const PAL = [
  { wall: '#3946c6', hi: '#5160e6', sh: '#2a3499', dk: '#1e2675', rail: '#c9d2ea',
    top: '#f3f5fc', topSh: '#c4cbe6', face: '#dfe4f4', faceSh: '#b3bbdb', bay: '#323a74', bayHi: '#454f96', plate: '#ffe7a6', lamp: ['#5CFF7A', '#FFE14D', '#4DB8FF'] },
  { wall: '#6c3184', hi: '#8746a2', sh: '#4f2264', dk: '#3c1650', rail: '#f0b43c',
    top: '#d9f7ec', topSh: '#9fd9c6', face: '#62d1b1', faceSh: '#3fa88b', bay: '#1d544b', bayHi: '#2c6f63', plate: '#ffe7a6', lamp: ['#FFE14D', '#FF9A4D', '#5CFF7A'] },
];
const BX = [142, 400, 658], CTLY = 432, CARDX = [18, 538], CARDY = 168, CW = 244, CH = 150;
const WINP = () => rrC(280, 174, 240, 152, 36);
const CRK = [{ x: 334, y: 298, vx: -1 }, { x: 472, y: 296, vx: 1 }, { x: 404, y: 308, vx: 1 }];   // low in the porthole: the bubble never hides them
const LAYERS = {};
function mkLayer(fn) { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const X = c.getContext('2d'); fn(X); return c; }
function paintWall(X, role) {
  const P = PAL[role];
  X.fillStyle = P.wall; X.fillRect(0, 0, 800, 600);
  X.fillStyle = P.dk; X.fillRect(0, 0, 800, 58);
  const cols = [0, 140, 268, 532, 660, 800], rows = [58, 158, 340];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const x0 = cols[c], x1 = cols[c + 1], y0 = rows[r], y1 = rows[r + 1];
    X.fillStyle = P.hi; X.fillRect(x0, y0, x1 - x0, 6); X.fillStyle = P.sh; X.fillRect(x0, y1 - 7, x1 - x0, 7); X.fillRect(x1 - 6, y0, 6, y1 - y0);
    X.fillStyle = 'rgba(20,16,28,.55)'; X.fillRect(x0, y0, x1 - x0, 2); X.fillRect(x0, y0, 2, y1 - y0);
    for (const [rx, ry] of [[x0 + 12, y0 + 14], [x1 - 16, y0 + 14], [x0 + 12, y1 - 18], [x1 - 16, y1 - 18]]) { blob(X, rx + 1, ry + 2, 4.5, 4.5, P.sh); blob(X, rx, ry, 4, 4, P.hi); blob(X, rx - 1, ry - 1, 1.6, 1.6, '#fff'); }
  }
  X.fillStyle = P.sh; X.fillRect(0, 340, 800, 60);
  X.fillStyle = 'rgba(255,255,255,.07)'; for (let x = -40; x < 800; x += 46) { X.beginPath(); X.moveTo(x, 400); X.lineTo(x + 20, 400); X.lineTo(x + 60, 340); X.lineTo(x + 40, 340); X.fill(); }
  if (role === 0) {                                                              // bridge: cable conduit + handrail
    shp(X, rrP(-10, 146, 820, 16, 8), '#262c66', 4); for (let x = 30; x < 800; x += 90) shp(X, rrP(x, 142, 14, 24, 4), '#8f9bbd', 3);
    shp(X, rrP(-10, 350, 820, 12, 6), P.rail, 4, X => { X.fillStyle = '#fff'; X.fillRect(-10, 351, 820, 3); });
    for (let x = 60; x < 800; x += 170) shp(X, rrP(x, 360, 10, 24, 3), '#8f9bbd', 3);
  } else {                                                                       // engine room: brass pipes + gauges
    shp(X, rrP(-10, 142, 820, 22, 11), P.rail, 4, X => { X.fillStyle = '#c4862a'; X.fillRect(-10, 155, 820, 9); X.fillStyle = '#ffe08a'; X.fillRect(-10, 145, 820, 4); });
    for (let x = 50; x < 800; x += 120) shp(X, rrP(x, 138, 18, 30, 4), '#d99a2e', 3.5);
    shp(X, rrP(-10, 346, 820, 20, 10), P.rail, 4, X => { X.fillStyle = '#c4862a'; X.fillRect(-10, 358, 820, 8); X.fillStyle = '#ffe08a'; X.fillRect(-10, 349, 820, 4); });
    for (let x = 20; x < 800; x += 150) shp(X, rrP(x, 342, 18, 28, 4), '#d99a2e', 3.5);
  }
  X.fillStyle = 'rgba(20,16,28,.35)'; X.fillRect(0, 384, 800, 16);
  for (const cx of CARDX) {                                                      // empty card holders: a recess + two clips
    shp(X, rrP(cx + 4, CARDY + 4, CW - 8, CH - 8, 18), P.dk, 3, X => { X.fillStyle = 'rgba(0,0,0,.25)'; X.fillRect(cx, CARDY, CW, 12); });
    X.setLineDash([10, 8]); X.strokeStyle = P.hi; X.lineWidth = 3; X.stroke(rrP(cx + 16, CARDY + 16, CW - 32, CH - 32, 12)); X.setLineDash([]);
    for (const k of [.25, .75]) shp(X, rrP(cx + CW * k - 14, CARDY - 8, 28, 18, 5), '#c3cce4', 3, X => { X.fillStyle = '#8f9bbd'; X.fillRect(cx + CW * k - 14, CARDY + 3, 28, 8); });
    const mx = cx + CW / 2, my = CARDY + CH / 2; X.save(); X.globalAlpha = .5; X.fillStyle = P.hi; X.strokeStyle = P.hi; X.lineCap = 'round';
    if (cx === CARDX[0]) {                                                         // empty slot glyphs: left = cards to shout (megaphone), right = yours (star)
      X.beginPath(); X.moveTo(mx - 34, my - 12); X.lineTo(mx + 6, my - 30); X.lineTo(mx + 6, my + 30); X.lineTo(mx - 34, my + 12); X.closePath(); X.fill(); X.fillRect(mx - 46, my - 13, 14, 26);
      X.lineWidth = 6; for (let i = 0; i < 2; i++) { X.beginPath(); X.arc(mx + 10, my, 18 + i * 14, -.8, .8); X.stroke(); }
    } else { X.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 15 : 36; X.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); } X.closePath(); X.fill(); }
    X.restore();
  }
  // window ring, bolts, then the hole
  shp(X, rrP(264, 158, 272, 184, 50), '#cfd6ea', 5, X => { X.fillStyle = '#9aa4c4'; X.fillRect(264, 300, 272, 50); X.fillRect(500, 150, 40, 200); X.fillStyle = '#eef2ff'; X.fillRect(264, 158, 272, 8); });
  shp(X, rrP(274, 168, 252, 164, 42), '#7c86aa', 3);
  const bolts = [[290, 166], [400, 163], [510, 166], [290, 334], [400, 337], [510, 334], [270, 250], [530, 250], [270, 200], [530, 200], [270, 300], [530, 300]];
  for (const [bx, by] of bolts) { blob(X, bx, by, 4.5, 4.5, INK); blob(X, bx, by, 3, 3, '#f4f6ff'); }
  X.globalCompositeOperation = 'destination-out'; X.fill(WINP()); X.globalCompositeOperation = 'source-over';
}
function paintConsole(X, role) {
  const P = PAL[role];
  const top = new Path2D(); top.moveTo(-10, 398); top.lineTo(810, 398); top.lineTo(810, 430); top.lineTo(-10, 430); top.closePath();
  X.fillStyle = P.top; X.fill(top); X.fillStyle = P.topSh; X.fillRect(-10, 420, 820, 10); X.fillStyle = '#fff'; X.fillRect(-10, 401, 820, 4);
  X.fillStyle = P.face; X.fillRect(-10, 430, 820, 180);
  const gr = X.createLinearGradient(0, 430, 0, 600); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(20,16,28,.22)'); X.fillStyle = gr; X.fillRect(-10, 430, 820, 180);
  X.fillStyle = INK; X.fillRect(-10, 395, 820, 5); X.fillRect(-10, 428, 820, 4);
  for (let i = 0; i < 3; i++) {
    const x = BX[i] - 118, y = 440, w = 236, h = 110;
    shp(X, rrP(x, y, w, h, 18), P.bay, 4, X => { X.fillStyle = 'rgba(0,0,0,.32)'; X.fillRect(x, y, w, 10); X.fillStyle = P.bayHi; X.fillRect(x, y + h - 8, w, 8); });
    for (const [sx, sy] of [[x + 13, y + 14], [x + w - 13, y + 14], [x + 13, y + h - 14], [x + w - 13, y + h - 14]]) { blob(X, sx, sy, 5, 5, INK); blob(X, sx, sy, 3.5, 3.5, '#c3cce4'); line(X, [[sx - 2.5, sy - 2.5], [sx + 2.5, sy + 2.5]], 1.5); }
  }
  for (const vx of [271, 529]) for (let k = 0; k < 3; k++) shp(X, rrP(vx - 9, 446 + k * 30, 18, 20, 9), '#2b2740', 3);
  hazard(X, rrP(-10, 556, 820, 60, 0), -10, 810, 556, 616, 22); X.fillStyle = INK; X.fillRect(-10, 552, 820, 5);
}

/* ───────────── characters + props ───────────── */
/* the Claude crew: the same blocky critter as claude(), with poses: eyes dot|panic|happy|sad, mouth yell|o|grin, arms (rad), squash */
function crew(x, y, u, o) {
  const col = o.col || OR, sh = dark(col, .22), hl = lite(col, .3), ol = Math.max(2.5, u * .55), aL = o.aL || 0, aR = o.aR || 0, sq = o.sq || 1;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(u / Math.sqrt(sq), u * sq);
  const lift = o.run != null ? i => Math.max(0, Math.sin(o.run * 16 + i * Math.PI)) * .9 : () => 0;
  const parts = pass => {
    const e = pass ? 0 : ol / u, f = (x0, y0, w, h) => ctx.fillRect(x0 - e, y0 - e, w + 2 * e, h + 2 * e);
    [-5, -2.6, 1.4, 3.8].forEach((lx, i) => { if (pass) ctx.fillStyle = sh; f(lx, -2.2 - lift(i), 1.2, 2.2); });
    for (const [s, a] of [[-1, aL], [1, aR]]) { ctx.save(); ctx.translate(s * 6, -5.3); ctx.rotate(-s * a); if (pass) ctx.fillStyle = col; f(s < 0 ? -2.2 : 0, -1.2, 2.2, 2.4); ctx.restore(); }
    if (pass) ctx.fillStyle = col; f(-6, -9, 12, 7);
  };
  ctx.fillStyle = INK; parts(0); parts(1);
  ctx.fillStyle = hl; ctx.fillRect(-6, -9, 12, 1.3); ctx.fillStyle = sh; ctx.fillRect(-6, -3.3, 12, 1.3);
  const ey = -6.3, ex = [-2.8, 2.8]; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = .55; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const e of ex) {
    if (o.eyes === 'happy') { ctx.beginPath(); ctx.moveTo(e - .9, ey + .8); ctx.lineTo(e, ey - .4); ctx.lineTo(e + .9, ey + .8); ctx.stroke(); }
    else if (o.eyes === 'sad') { ctx.beginPath(); ctx.moveTo(e - .8, ey - .8); ctx.lineTo(e + .8, ey + .8); ctx.moveTo(e + .8, ey - .8); ctx.lineTo(e - .8, ey + .8); ctx.stroke(); }
    else if (o.eyes === 'panic') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e, ey - .2, 1.45, 0, TAU); ctx.fill(); ctx.lineWidth = .4; ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(e + Math.sin(now * 23 + e) * .35, ey - .2 + Math.cos(now * 19) * .3, .55, 0, TAU); ctx.fill(); ctx.lineWidth = .55; }
    else { const b = Math.sin(now * 1.7 + (o.seed || 0)) > .985 ? .25 : 1; ctx.fillRect(e - .6, ey - 1.2 * b, 1.2, 2.4 * b); }
  }
  if (o.mouth === 'yell') { ctx.fillStyle = INK; ctx.fillRect(-1.6, -4.7, 3.2, 2.3); ctx.fillStyle = '#ff6b8a'; ctx.fillRect(-1, -3.3, 2, .9); }
  else if (o.mouth === 'o') { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, -3.7, .75, .95, 0, 0, TAU); ctx.fill(); }
  else if (o.mouth === 'grin') { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, -4.3, 1.8, 1.3, 0, 0, Math.PI); ctx.fill(); }
  if (o.sweat) { ctx.fillStyle = '#8fdcff'; ctx.strokeStyle = INK; ctx.lineWidth = .35; ctx.beginPath(); ctx.moveTo(7.2, -10.4); ctx.quadraticCurveTo(8.6, -8, 7.2, -7.6); ctx.quadraticCurveTo(5.8, -8, 7.2, -10.4); ctx.fill(); ctx.stroke(); }
  if (o.gear && !o.hat) gear(o.gear);
  if (o.hat) { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-2.8, -8.6); ctx.lineTo(0, -14.4); ctx.lineTo(2.8, -8.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = o.hat; ctx.beginPath(); ctx.moveTo(-2.1, -9); ctx.lineTo(0, -13.4); ctx.lineTo(2.1, -9); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -14.2, .8, 0, TAU); ctx.fill(); }
  ctx.restore(); ctx.lineCap = 'butt';
}
/* crew uniform (never a player colour, so the partner-coloured FRIEND on the intercom always stands apart): a headset with a
   mic, plus a navy captain's cap on the bridge or a yellow hard hat with a lamp in the engine room. Unit space of crew(). */
function gear(kind, hatOnly) {
  const X = ctx; X.lineJoin = 'round'; X.lineCap = 'round';
  if (hatOnly) X.translate(0, 10);                                                 // just the hat, centred on 0,0 (it flew off)
  else {
  X.strokeStyle = INK; X.lineWidth = 1.5; X.beginPath(); X.moveTo(6.3, -6.6); X.quadraticCurveTo(6.6, -3.4, 2.4, -3.3); X.stroke();      // mic boom
  X.strokeStyle = '#c3cce4'; X.lineWidth = .6; X.stroke();
  X.fillStyle = INK; X.fillRect(5.2, -8.4, 2.6, 3.6); X.fillStyle = '#9aa4c4'; X.fillRect(5.65, -7.95, 1.7, 2.7); X.fillStyle = '#eef2ff'; X.fillRect(5.65, -7.95, .6, 2.7);
  blob(X, 2.2, -3.3, .95, .8, INK); blob(X, 2.2, -3.3, .55, .45, '#5d6b8f');
  }
  if (kind === 'cap') {
    X.fillStyle = INK; X.beginPath(); X.moveTo(-5.3, -8.6); X.lineTo(-4.6, -12.3); X.quadraticCurveTo(0, -13.6, 4.6, -12.3); X.lineTo(5.3, -8.6); X.closePath(); X.fill();
    X.fillStyle = '#2f3a8c'; X.beginPath(); X.moveTo(-4.7, -9.1); X.lineTo(-4.1, -11.9); X.quadraticCurveTo(0, -13.05, 4.1, -11.9); X.lineTo(4.7, -9.1); X.closePath(); X.fill();
    X.fillStyle = '#4a58c0'; X.fillRect(-3.8, -11.7, 2.2, .7);
    X.fillStyle = INK; X.fillRect(-6.4, -9.5, 12.8, 1.9); X.fillStyle = '#1e2675'; X.fillRect(-6, -9.15, 12, 1.2);
    blob(X, 0, -10.8, 1.25, 1.05, INK); blob(X, 0, -10.8, .85, .7, '#FFD23A'); blob(X, -.25, -11, .3, .25, '#fff');
  } else {
    X.fillStyle = INK; X.beginPath(); X.ellipse(0, -8.9, 5.9, 4.6, 0, Math.PI, 0); X.closePath(); X.fill(); X.fillRect(-7, -9.6, 14, 1.9);
    X.fillStyle = '#ffc93a'; X.beginPath(); X.ellipse(0, -8.9, 5.35, 4.05, 0, Math.PI, 0); X.closePath(); X.fill();
    X.fillStyle = '#e09a12'; X.beginPath(); X.ellipse(1.4, -8.9, 3.9, 3.4, 0, -Math.PI / 2, 0); X.lineTo(1.4, -8.9); X.fill();
    X.fillStyle = '#fff1a8'; X.fillRect(-3.6, -11.6, 1.8, .7);
    X.fillStyle = '#ffc93a'; X.fillRect(-6.6, -9.25, 13.2, 1.2); X.fillStyle = '#e09a12'; X.fillRect(-6.6, -8.55, 13.2, .5);
    blob(X, 0, -11, 1.5, 1.3, INK); blob(X, 0, -11, 1.05, .9, '#fffbe0');
  }
}
function cow(x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  for (const lx of [-26, -12, 10, 24]) { shp(ctx, rrC(lx - 5, 8, 10, 26, 4), '#fff', 3.5); ctx.fillStyle = '#3a3040'; ctx.fillRect(lx - 5, 28, 10, 6); }
  line(ctx, [[-36, -8], [-50, 4], [-46, 14]], 7); line(ctx, [[-36, -8], [-50, 4], [-46, 14]], 3, '#fff'); blob(ctx, -46, 16, 5, 6, '#3a3040');
  shp(ctx, rrC(-40, -24, 78, 42, 20), '#ffffff', 5, X => { blob(X, -16, -12, 14, 10, '#2a2230', .4); blob(X, 14, 6, 12, 9, '#2a2230', -.3); blob(X, -30, 10, 8, 7, '#2a2230'); blob(X, 10, 22, 30, 8, '#dfe2ee'); });
  shp(ctx, rrC(24, -46, 38, 36, 14), '#fff', 5, X => blob(X, 50, -42, 10, 8, '#2a2230'));
  shp(ctx, rrC(30, -26, 36, 22, 10), '#ffa3b8', 4); blob(ctx, 41, -15, 3, 3.5, '#8a3a55'); blob(ctx, 55, -15, 3, 3.5, '#8a3a55');
  for (const hx of [30, 54]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(hx - 6, -44); ctx.lineTo(hx - 2, -60); ctx.lineTo(hx + 4, -44); ctx.fill(); ctx.fillStyle = '#ffe7a6'; ctx.beginPath(); ctx.moveTo(hx - 3, -45); ctx.lineTo(hx - 2, -56); ctx.lineTo(hx + 2, -45); ctx.fill(); }
  blob(ctx, 34, -34, 4, 5, INK); blob(ctx, 50, -34, 4, 5, INK); blob(ctx, 33, -36, 1.4, 1.6, '#fff'); blob(ctx, 49, -36, 1.4, 1.6, '#fff');
  ctx.restore();
}
function duck(x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  shp(ctx, elP(0, 0, 26, 18), '#ffd93b', 4, X => blob(X, 8, 8, 24, 14, '#e8a91c'));
  shp(ctx, elP(12, -18, 15, 14), '#ffd93b', 4); shp(ctx, rrC(22, -20, 16, 9, 4), '#ff9a3c', 3); blob(ctx, 15, -22, 2.6, 3, INK);
  shp(ctx, elP(-6, -2, 12, 8, -.3), '#ffe680', 3);
  ctx.restore();
}
function note(x, y, s, col) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); blob(ctx, 0, 0, 9, 7, INK, -.4); blob(ctx, 0, 0, 6.5, 4.5, col, -.4); ctx.fillStyle = INK; ctx.fillRect(4, -30, 5, 30); ctx.beginPath(); ctx.moveTo(9, -30); ctx.quadraticCurveTo(20, -22, 16, -12); ctx.lineTo(9, -20); ctx.fill(); ctx.restore(); }
function megaphone(x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const p = new Path2D(); p.moveTo(-12, -5); p.lineTo(8, -14); p.lineTo(8, 14); p.lineTo(-12, 5); p.closePath();
  shp(ctx, p, col || '#fff', 3); shp(ctx, rrC(-18, -6, 8, 12, 2), col || '#fff', 3); shp(ctx, rrC(-12, 4, 6, 10, 2), INK, 0);
  for (let i = 0; i < 2; i++) { ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(10, 0, 8 + i * 6, -.8, .8); ctx.stroke(); }
  ctx.restore();
}
function bomb(x, y, r, hot) {
  circ(x, y, r, hot ? (Math.floor(now * 14) % 2 ? '#ff4d4d' : '#2b2840') : '#2b2840', 3);
  blob(ctx, x - r * .35, y - r * .35, r * .28, r * .2, 'rgba(255,255,255,.55)', -.6); shp(ctx, rrC(x + r * .3, y - r - 4, 9, 7, 2), '#8f9bbd', 2.5);
}
/* an order card at its own origin (CW x CH). c = { k, frac, urg, friend, label, pcol, ycol, stamp, hot } */
function paintCard(c) {
  ctx.fillStyle = 'rgba(20,16,28,.32)'; ctx.fill(rrC(7, 10, CW, CH, 18));
  shp(ctx, rrC(0, 0, CW, CH, 18), '#fff8e8', 5, X => {
    X.fillStyle = c.friend ? c.pcol : c.ycol; X.fillRect(0, 0, CW, 44); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(0, 0, CW, 7); X.fillStyle = INK; X.fillRect(0, 44, CW, 4);
    X.fillStyle = '#f3e4c3'; X.fillRect(0, 112, CW, 40); X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(0, 112, CW, 3);
    if (c.urg > 0) { X.fillStyle = `rgba(255,60,70,${(.12 + .22 * (.5 + .5 * Math.sin(now * 22))) * c.urg})`; X.fillRect(0, 0, CW, CH); }
  });
  if (c.friend) megaphone(26, 23, .95, '#fff'); else star(26, 23, 13, 6, 5, -Math.PI / 2, '#fff', 2.5);
  txt(c.label, c.big ? 146 : 140, 24, c.big ? 21 : 18, INK, 'center', c.big ? 176 : 188);
  drawArt(c.k, 56, 82, .31);
  const noun = t(NAMES[c.k]) + '!';                                              // card noun: no opening ¡ mid-sentence (the verb carries it)
  if (c.big) txt(noun, 166, 80, 30, '#ff3d5a', 'center', 138);                   // intro demo: icon + noun only, bigger
  else { txt(VERBS[c.k], 164, 63, 18, INK, 'center', 140); txt(noun, 164, 94, 28, '#ff3d5a', 'center', 146); }
  bomb(26, 131, 14, c.hot);
  const x0 = 44, x1 = x0 + 184 * clamp(c.frac, 0, 1), wy = x => 131 + Math.sin(x * .13) * 2.4;
  if (x1 > x0 + 1) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, col] of [[9, INK], [5, '#d9a066']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (let x = x0; x <= x1; x += 6) x === x0 ? ctx.moveTo(x, wy(x)) : ctx.lineTo(x, wy(x)); ctx.lineTo(x1, wy(x1)); ctx.stroke(); }
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 2; for (let x = x0 + 4; x < x1 - 3; x += 7) { ctx.beginPath(); ctx.moveTo(x - 2, wy(x) + 2.5); ctx.lineTo(x + 2, wy(x) - 2.5); ctx.stroke(); }
    if (c.burning) {
      const fl = 1 + .25 * Math.sin(now * 40) + c.urg * .4;
      star(x1, wy(x1), 11 * fl, 4.5, 8, now * 9, '#FF9A4D', 2); star(x1, wy(x1), 7 * fl, 3, 6, -now * 12, '#FFE14D', 0); blob(ctx, x1, wy(x1), 2.6, 2.6, '#fff');
      for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, r = 8 + Math.random() * 14; blob(ctx, x1 + Math.cos(a) * r, wy(x1) + Math.sin(a) * r - 4, 1.8, 1.8, i ? '#FFE14D' : '#fff'); }
    }
  }
  if (c.stamp >= 0) {
    const k = clamp(c.stamp / .16, 0, 1), sc = 2.3 - 1.3 * easeOut(k);
    ctx.save(); ctx.globalAlpha = k; ctx.translate(CW / 2, 79); ctx.rotate(-.2); ctx.scale(sc, sc);
    const p = rrC(-90, -30, 180, 60, 12); ctx.fillStyle = 'rgba(92,255,122,.28)'; ctx.fill(p); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(p); ctx.lineWidth = 5; ctx.strokeStyle = GRN; ctx.stroke(p);
    txt('DONE!', 0, 2, 40, GRN, 'center', 164); ctx.restore();
  }
}
/* the friend's intercom, bolted under a ceiling bracket (nothing is drawn above y 46: that strip belongs to the HUD hint) */
function paintTV(cx, cy, pcol, f) {
  shp(ctx, rrC(cx - 46, cy - 54, 92, 14, 6), '#8f9bbd', 3.5, X => { X.fillStyle = '#c3cce4'; X.fillRect(cx - 46, cy - 54, 92, 4); });
  for (const sx of [-30, 30]) { blob(ctx, cx + sx, cy - 47, 4, 4, INK); blob(ctx, cx + sx, cy - 47, 2.5, 2.5, '#eef2ff'); }
  shp(ctx, rrC(cx - 68, cy - 42, 136, 84, 18), pcol, 5, X => { X.fillStyle = dark(pcol, .3); X.fillRect(cx - 70, cy + 28, 140, 20); X.fillStyle = lite(pcol, .4); X.fillRect(cx - 68, cy - 42, 136, 7); });
  const scr = rrC(cx - 54, cy - 32, 108, 60, 12);
  shp(ctx, scr, '#123049', 4, X => {
    blob(X, cx, cy + 10, 70, 40, '#1b4a6a');
    crew(cx + Math.sin(now * 2.2) * 2 + (f.yell ? Math.sin(now * 40) * 1.5 : 0), cy + 29 - (f.yell ? Math.abs(Math.sin(now * 18)) * 4 : Math.abs(Math.sin(now * 3)) * 1.5), 3.7, { col: pcol, eyes: f.eyes, mouth: f.mouth, aL: f.arms, aR: f.arms, seed: 3 });
    if (f.stat) {                                                                  // signal lost: TV snow (cosmetic randomness)
      X.fillStyle = '#5a6278'; X.fillRect(cx - 54, cy - 32, 108, 60);
      for (let j = 0; j < 46; j++) { const v = 120 + Math.floor(Math.random() * 135); X.fillStyle = `rgb(${v},${v},${v + 12})`; X.fillRect(cx - 54 + Math.random() * 104, cy - 32 + Math.floor(Math.random() * 15) * 4, 4 + Math.random() * 22, 3); }
      X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(cx - 54, cy - 32 + ((now * 90) % 60), 108, 6);
    }
    X.fillStyle = 'rgba(0,0,0,.16)'; for (let y = cy - 32; y < cy + 28; y += 4) X.fillRect(cx - 54, y, 108, 2);
    if (f.flash > 0) { X.fillStyle = `rgba(255,255,255,${f.flash * .55})`; X.fillRect(cx - 54, cy - 32, 108, 60); }
    X.fillStyle = 'rgba(255,255,255,.14)'; X.beginPath(); X.moveTo(cx - 54, cy - 32); X.lineTo(cx - 10, cy - 32); X.lineTo(cx - 44, cy + 28); X.lineTo(cx - 54, cy + 28); X.fill();
  });
  blob(ctx, cx + 60, cy - 32, 3.5, 3.5, f.flash > 0 || f.yell ? '#ff4d4d' : '#5CFF7A');
  if (f.plate === false) return;
  shp(ctx, rrC(cx - 52, cy + 40, 104, 26, 10), INK, 0);
  txt('FRIEND', cx, cy + 54, 18, pcol, 'center', 92);
}
/* speech bubble under the intercom: the icons your friend is shouting. Short (it hides only the top of the porthole);
   when the order is done the icon gives way to a THANKS! stamp inside the bubble, then the whole bubble fades. */
function paintBubble(cx, y0, items, pcol, left) {
  const two = items.length > 1, w = two ? 252 : 240, h = two ? 104 : 90, x0 = cx - w / 2, r = 24;
  const rect = rrC(x0, y0, w, h, r), tk = (left ? 'L' : 'T') + x0 + ',' + y0 + ',' + cx; let tail = PC.get(tk);
  if (!tail) { tail = new Path2D(); if (left) { tail.moveTo(x0 + 4, y0 + 26); tail.lineTo(x0 - 24, y0 + 16); tail.lineTo(x0 + 4, y0 + 54); } else { tail.moveTo(cx - 15, y0 + 4); tail.lineTo(cx, y0 - 12); tail.lineTo(cx + 15, y0 + 4); } tail.closePath(); PC.set(tk, tail); }
  const live = items.filter(b => !b.gone), pop = live.length ? Math.min(...live.map(b => b.pop)) : 1 + .06 * Math.sin(Math.min(1, Math.min(...items.map(b => b.gone)) * 3) * Math.PI);
  const flash = Math.max(...items.map(b => b.flash)), fade = live.length ? 1 : clamp(1 - (Math.min(...items.map(b => b.gone)) - .62) / .38, 0, 1);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(cx, y0); ctx.scale(pop, pop); ctx.translate(-cx, -y0);
  ctx.fillStyle = 'rgba(20,16,28,.3)'; ctx.fill(rrC(x0 + 6, y0 + 8, w, h, r));
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.stroke(rect); ctx.stroke(tail);
  const bgc = flash > 0 && Math.floor(now * 16) % 2 ? '#FFE14D' : '#ffffff'; ctx.fillStyle = bgc; ctx.fill(rect); ctx.fill(tail);
  ctx.lineWidth = 5; ctx.strokeStyle = pcol; ctx.stroke(rrC(x0 + 8, y0 + 8, w - 16, h - 16, r - 7));
  items.forEach((b, i) => {
    const x = two ? cx + (i ? 62 : -62) : cx, wob = 1 + .14 * b.flash * Math.sin(now * 30);
    if (b.gone) {                                                                  // done: THANKS! slams in where the icon was
      const k = clamp(b.gone * 6, 0, 1), sc = 1.7 - .7 * easeOut(k);
      ctx.save(); ctx.translate(x, y0 + h / 2); ctx.rotate(-.12); ctx.scale(sc, sc); txt('THANKS!', 0, 0, two ? 24 : 34, GRN, 'center', two ? 108 : 200); ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(two ? x : x0 + 60, y0 + (two ? 42 : 52)); ctx.scale(wob, wob); drawArt(b.k, 0, 0, two ? .22 : .28); ctx.restore();
    if (two) txt(NOUNS[b.k], x, y0 + 84, 19, '#ff3d5a', 'center', 108);
    else txt(NOUNS[b.k], x0 + 158, y0 + h / 2 + 1, 27, '#ff3d5a', 'center', 140);
  });
  ctx.restore();
}
let PAPER_P = null; const PAPER = () => PAPER_P || (PAPER_P = rrP(-15, -12, 30, 24, 3));
let SHARD_P = null; const SHARD = () => { if (!SHARD_P) { SHARD_P = new Path2D(); SHARD_P.moveTo(-1, -.4); SHARD_P.lineTo(.8, -.7); SHARD_P.lineTo(.2, .9); SHARD_P.closePath(); } return SHARD_P; };
let ROCKET = null;                                                                // built on first use (no Path2D at load time: node test sandboxes)
const mkRocket = () => { const b = new Path2D(); b.moveTo(-14, -8); b.lineTo(6, -8); b.quadraticCurveTo(20, -6, 22, 0); b.quadraticCurveTo(20, 6, 6, 8); b.lineTo(-14, 8); b.closePath();
  const fin = new Path2D(); fin.moveTo(-14, -8); fin.lineTo(-20, -15); fin.lineTo(-6, -8); fin.moveTo(-14, 8); fin.lineTo(-20, 15); fin.lineTo(-6, 8); return { b, fin, win: elP(4, 0, 4, 4) }; };
function rocketIcon(x, y, s) {
  ROCKET = ROCKET || mkRocket(); ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const fl = 6 + Math.sin(now * 40) * 3; ctx.fillStyle = '#FF9A4D'; ctx.beginPath(); ctx.moveTo(-14, -5); ctx.lineTo(-14 - fl - 6, 0); ctx.lineTo(-14, 5); ctx.fill(); ctx.fillStyle = YEL; ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-14 - fl, 0); ctx.lineTo(-14, 3); ctx.fill();
  shp(ctx, ROCKET.b, '#fff', 3); shp(ctx, ROCKET.win, '#4DB8FF', 2); shp(ctx, ROCKET.fin, RED, 2.5);
  ctx.restore();
}
let SHIELD = null;
const mkShield = () => { const p = new Path2D(); p.moveTo(-12, -13); p.lineTo(12, -13); p.lineTo(12, 0); p.quadraticCurveTo(10, 11, 0, 16); p.quadraticCurveTo(-10, 11, -12, 0); p.closePath(); return p; };
/* one hull shield: green = fine, red + split = broken (the last one left blinks when the hull is about to go).
   pop (0..1) bounces it right after it breaks */
function shield(x, y, ok, last, pop) {
  SHIELD = SHIELD || mkShield(); ctx.save(); ctx.translate(x, y); const sc = 1 + .5 * Math.sin(clamp(pop, 0, 1) * Math.PI); ctx.scale(sc, sc);
  if (!ok) ctx.rotate(.18 * Math.sin(clamp(pop, 0, 1) * Math.PI * 3) * (1 - clamp(pop, 0, 1)));
  const col = !ok ? '#ff4d4d' : last && Math.floor(now * 5) % 2 ? '#FFE14D' : '#5CFF7A';
  shp(ctx, SHIELD, col, 3, X => { X.fillStyle = !ok ? '#c4283c' : last && col !== '#5CFF7A' ? '#e0a91c' : '#2fcf58'; X.fillRect(2, -14, 12, 32); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(-12, -13, 7, 30); });
  if (!ok) line(ctx, [[-3, -13], [3, -3], [-2, 3], [3, 14]], 3);
  ctx.restore();
}

/* ───────────── the game ───────────── */
function duPanic(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), role = D.role, judge = role === 0, TS = Math.sqrt(sp);
  /* FUSE: how long a card burns. GRACE: how long after that (judge's clock) the judge still waits for a press made in time on
     the other screen (one-way lag up to ~300 ms each way). A press nobody asked for costs the SHARED goal: it cracks the hull
     like a lost order (the gag that comes with it is the joke, the crack is the price), and it jams that panel (JAMS, longer for
     each miss; the count only decays by one every MISS_DECAY s, a hit does not reset it). */
  const FUSE = 3.9 / TS, BEAT = .4 / TS, GRACE = .7, NEED = 5, MAXX = 3, NP = 16, JAMS = [1.2, 2, 2.8], MISS_DECAY = 6;
  const PAN = [[0, 1, 2], [3, 4, 5]], mine = PAN[role], P = PAL[role];
  const pcol = okCol(D.partner && D.partner.color);
  let ycol = '#FFE14D'; try { const m = typeof window.me === 'function' && window.me(); if (m && /^#[0-9a-f]{6}$/i.test(m.color) && m.color.toLowerCase() !== pcol.toLowerCase()) ycol = m.color; } catch (e) {}
  /* the orders: each PANEL runs its own queue with ONE open order at a time; when it is done or lost, the next one opens BEAT s
     later (the judge starts it and tells the partner: 'go {i}'). What each order is comes from the room seed, built here with the
     same R() draws for both roles: ~75% of a panel's orders sit on the OTHER room's card (they must be shouted), and any of the
     panel's 3 controls can come next (even the same one again: no pattern to sweep). So each player holds at most 2 cards (one per
     panel), a press is never ambiguous, and a blind press is right only 1 time in 3. orders[n * 2 + pn] = n-th order of panel pn. */
  const orders = [], head = [0, 0], nextAt = [.8 / TS, 1.5 / TS];
  for (let n = 0; n < NP; n++) for (let pn = 0; pn < 2; pn++) {
    const own = R() < .25 && n > 0, pick = R();
    orders.push({ id: orders.length, pn, n, p: own ? pn : 1 - pn, ctl: PAN[pn][Math.floor(pick * 3)], t0: -1, fuse: FUSE,
      done: false, exp: false, stampT: 0, pingT: -9, shown: false, boomAt: 0, doneC: 0, expC: 0 });
  }
  const slot = o => o.pn === role ? 1 : 0;                                        // left card: for your friend's panel (shout it), right card: yours
  const isOpen = o => o.p === role && o.t0 >= 0 && g.c >= o.t0 && g.c < o.t0 + o.fuse && !o.done && !o.exp && !o.stampT;
  /* judge: what a press of control k means: the open order of its panel, or (no penalty) a double press of the order just done /
     a late press of the order just lost; null = a press nobody asked for */
  function find(k) {
    const pn = k < 3 ? 0 : 1, cur = orders[head[pn] * 2 + pn], last = head[pn] ? orders[(head[pn] - 1) * 2 + pn] : null;
    if (cur && cur.t0 >= 0 && cur.ctl === k) return cur;
    if (last && last.ctl === k && (last.done ? g.c - last.doneC < 1.1 : g.c - last.expC < .9)) return last;
    return null;
  }
  const advance = o => { head[o.pn] = o.n + 1; nextAt[o.pn] = g.c + BEAT; };
  let nDone = 0, nExp = 0, seq = 0, gagN = 0, boost = 0, alarm = 0, cheerAt = -9, yellAt = -9, flashAt = -9, resAt = 0, resC = 0, showProg = 0, lastDraw = 0;
  const pressAt = [-9, -9, -9], pressN = [0, 0, 0], yoursAt = [-9, -9, -9], wobAt = [-9, -9, -9], crackAt = [0, 0, 0];
  const bubbles = [], gags = [], waves = [], puffs = [], sparks = [], papers = [];
  const sparkle = (x, y, col, n = 10, v = 240, shard) => { for (let j = 0; j < n; j++) { const a = (j + Math.random() * .6) / n * TAU, sp2 = v * (.55 + Math.random() * .6); sparks.push({ x, y, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2 - 80, r: 7 + Math.random() * 5, rot: Math.random() * 6, spin: (Math.random() - .5) * 14, life: 0, max: .4 + Math.random() * .3, col, shard }); } };
  let hatsUntil = 0, danceUntil = 0, hov = -1, jamT = 0, jamLen = 1;
  const jamC = [-9, -9], miss = [0, 0], missC = [0, 0], shieldAt = [-9, -9, -9];                                                          // judge: per room, the presser's clock until which that panel is jammed   // hov: 0-2 a control, 3-4 a card slot (mouse only)
  const crewPh = [0, 2.4];

  /* one DONE per event: my own card shows the stamp, a shouted order shows THANKS! in the bubble, and only a press that has
     neither on this screen (a friend's order heard over voice) gets a DONE! over the control */
  function onDone(o, by) {
    boost = 1; cheerAt = now; S.done(); shake(4, .15);
    if (o.p === role && !o.stampT) o.stampT = now;
    const i = mine.indexOf(o.ctl), bub = bubbles.filter(b => b.i === o.id && !b.popAt);
    if (by === role && i >= 0) { ring(BX[i], CTLY - 20, '#fff', 120); sparkle(BX[i], CTLY - 60, YEL, 8, 260); if (o.p !== role && !bub.length) floatText('DONE!', BX[i], CTLY - 120, YEL, 38); }
    for (const b of bub) b.popAt = now;
  }
  function tooLate(i) { if (i < 0) return; wobAt[i] = now; S.bonk(); floatText('TOO LATE!', BX[i], CTLY - 120, '#fff', 30); }
  /* the hull takes a hit (a lost order, or a wrong press): a new crack in the porthole, steam, alarm, a shield breaks */
  function hullHit(w) {
    const j = clamp(nExp - 1, 0, 2), c = CRK[j]; crackAt[j] = now; shieldAt[j] = now; alarm = 1; shake(11, .4); S.crack();
    sparkle(c.x, c.y, '#c8eeff', 9, 300, true); sparkle(c.x, c.y, '#FFB020', 5, 200); sparkle(654 - 32 * j, 126, '#ff4d4d', 6, 200);
    floatText(w ? 'WRONG ONE!' : 'HULL BREACH!', 400, 384, '#ff4d4d', 34);
  }
  function onExpire(o) {
    if (o.stampT && o.p === role) o.stampT = 0;                                     // my optimistic DONE was too late: the card goes BOOM
    o.exp = true; hullHit();
    if (o.p === role) o.boomAt = now;
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].i === o.id) bubbles.splice(i, 1);
  }
  function complete(o, by, q) { o.done = true; o.doneC = g.c; advance(o); nDone++; D.send('ok', { i: o.id, n: nDone, b: by, q: q || 0 }); onDone(o, by); }
  const GAGS = ['cow', 'party', 'kazoo', 'ducks'];
  function gag(i, left) {
    const kind = GAGS[gagN++ % GAGS.length]; jamT = now + left; jamLen = left; gags.push({ kind, at: now, i, x: BX[i] }); shake(5, .2);
    if (kind === 'cow') S.moo();
    else if (kind === 'party') { S.party(); confetti(BX[i], 380, 36); ring(BX[i], 400, PNK, 100); floatText('PARTY!', BX[i], 372, PNK, 38); hatsUntil = now + 3.5; }
    else if (kind === 'kazoo') { S.kazoo(); floatText('KAZOO!', BX[i], 372, YEL, 38); danceUntil = now + 1.6; }
    else { S.duck(); floatText('QUACK!', BX[i], 372, YEL, 38); }
  }
  /* the verdict moment (from update, or from draw if the host stops updating after the outcome): freeze the cards (no new ones;
     the open ones BOOM one by one on a loss, drop away on a win), then the show: hyperspace + confetti, or a hull blow-out */
  function onResult() {
    if (!g.result || resAt) return;
    resAt = now; resC = g.c; let j = 0;
    for (const o of orders) if (o.p === role && o.t0 >= 0 && o.t0 <= g.c && !o.done && !o.exp && !o.stampT) o.endAt = now + .3 + j++ * .2;
    if (g.result === 'win') { sfx.whoosh(true); sparkle(668, 90, YEL, 8, 200); ring(400, 250, '#fff', 160, .6); for (const x of CREWX) confetti(x, 340, 22); }
    else {                                                                         // hull blow-out: the porthole shatters, loose papers get sucked out
      alarm = 1.4; sparkle(400, 250, '#c8eeff', 14, 340, true); sparkle(400, 250, '#FF9A4D', 6, 260); noise(1.4, .1, 3000, 200, 'lowpass'); snd(90, .7, 'sawtooth', .06, 0, 40); shake(16, .5);
      for (let j = 0; j < 14; j++) { const sx = j % 2 ? 60 + Math.random() * 200 : 540 + Math.random() * 200; papers.push({ x: sx, y: 330 + Math.random() * 190, r: Math.random() * 6, sp: (Math.random() - .5) * 14, d: .1 + j * .05, col: j % 4 === 0 ? '#ffe7a6' : j % 5 === 0 ? '#a8e6ff' : '#fffdf6' }); }
    }
  }
  /* judge: a press that matches nothing cracks the hull like a lost order (blind guessing loses), and jams that room's panel
     for a moment (presser's clock) */
  function wrong(r, c) {
    const J = JAMS[Math.min(2, miss[r]++)]; missC[r] = g.c; jamC[r] = c + J;
    if (nExp < MAXX) { nExp++; D.send('x', { i: -1, n: nExp }); hullHit(true); }
    return J;
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: 'DON\'T PANIC!', roleLabel: judge ? 'BRIDGE' : 'ENGINE ROOM',
    hint: 'CLICK A CARD TO SHOUT IT · PRESS WHAT YOUR FRIEND SHOUTS',
    thint: 'TAP A CARD TO SHOUT IT · PRESS WHAT YOUR FRIEND SHOUTS',
    update(dt) {
      g.c += dt; boost = Math.max(0, boost - dt * 1.1); alarm = Math.max(0, alarm - dt * .7);
      showProg += (Math.min(1, nDone / NEED) - showProg) * Math.min(1, dt * 5);
      for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; q.life += dt; if (q.life > q.max) { puffs.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(.2, dt); }
      for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i]; q.life += dt; if (q.life > q.max) { sparks.splice(i, 1); continue; } q.vy += 500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
      for (const o of orders) {
        if (o.p !== role) continue;
        if (!o.shown && o.t0 >= 0 && g.c >= o.t0) { o.shown = true; if (!g.result) S.card(); }
      }
      if (judge && !g.result) {
        for (let r = 0; r < 2; r++) if (miss[r] > 0 && g.c - missC[r] > MISS_DECAY) { miss[r]--; missC[r] = g.c; }
        for (let pn = 0; pn < 2 && nExp < MAXX; pn++) {
          const o = orders[head[pn] * 2 + pn]; if (!o) continue;
          if (o.t0 < 0) { if (g.c >= nextAt[pn]) { o.t0 = g.c; D.send('go', { i: o.id }); } }          // open the next order of this panel
          else if (g.c > o.t0 + o.fuse + GRACE) { nExp++; o.expC = g.c; advance(o); D.send('x', { i: o.id, n: nExp }); onExpire(o); }
        }
        if (nDone >= NEED) g.finish('win'); else if (nExp >= MAXX || g.c >= g.limit) g.finish('lose');
      }
      onResult();
    },
    msg(type, d) {
      if (type === 'go') { const o = orders[d.i]; if (o && o.t0 < 0) o.t0 = g.c; }        // the judge opened an order: it starts now on this clock
      else if (type === 'yell') {
        const o = orders[d.i]; if (!o || o.done || o.exp || g.result) return; if (o.t0 < 0) o.t0 = g.c;
        for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].i === d.i) bubbles.splice(i, 1);
        bubbles.push({ i: d.i, k: d.k, at: now, popAt: 0 }); if (bubbles.length > 2) bubbles.shift();
        S.ping(); yellAt = now; flashAt = now;
      } else if (judge && type === 'act') {
        if (g.result) return; const r = 1 - role;
        if (d.c < jamC[r]) { D.send('no', { q: d.q, k: d.k, j: 1 }); return; }                 // pressed while their panel was jammed: nothing happens
        const o = find(d.k);
        if (o && !o.done && !o.exp) complete(o, r, d.q);
        else if (o) D.send('no', { q: d.q, k: d.k, j: 1, late: o.exp ? 1 : 0 });           // in time on their screen but already lost here (or a double press): no penalty
        else { const J = wrong(r, d.c); D.send('no', { q: d.q, k: d.k, c: d.c, J }); }
      } else if (!judge && type === 'ok') {
        const o = orders[d.i]; nDone = Math.max(nDone, d.n); if (o && !o.done) { o.done = true; onDone(o, d.b); }
      } else if (!judge && type === 'x') {
        if (d.i < 0) { if (d.n > nExp) { nExp = d.n; hullHit(true); } }                      // a wrong press (either room)
        else { const o = orders[d.i]; if (o && !o.exp) { nExp = Math.max(nExp, d.n); onExpire(o); } }
      } else if (!judge && type === 'no') {
        const i = mine.indexOf(d.k);
        if (i >= 0 && !g.result) { if (d.late) tooLate(i); else if (d.j) { wobAt[i] = now; S.bonk(); } else gag(i, Math.max(.3, d.c + d.J - g.c)); }
        for (const o of orders) if (o.p === role && o.ctl === d.k && o.stampT && !o.done) o.stampT = 0;
      }
    },
    press(i) {
      if (g.result || g.c < .2 || i < 0 || i > 2) return false;
      if (now < jamT) { S.bonk(); wobAt[i] = now; return false; }
      if (now - pressAt[i] < .28) return false;
      const k = mine[i]; pressAt[i] = now; pressN[i]++; SND[k]();
      if (judge) { const o = find(k); if (o && !o.done && !o.exp) complete(o, role); else if (o) { if (o.exp) tooLate(i); } else gag(i, wrong(role, g.c)); }
      else {
        D.send('act', { k, c: Math.round(g.c * 1000) / 1000, q: ++seq });
        const o = orders.find(q => q.ctl === k && isOpen(q)); if (o) o.stampT = now;              // my own card: show it at once, the judge confirms
      }
      return true;
    },
    shout(o) {
      if (typeof o === 'number') o = orders[o];
      if (g.result || !o || !isOpen(o)) return false;
      const i = mine.indexOf(o.ctl);
      if (i >= 0) { yoursAt[i] = now; sfx.blip(5); return true; }
      if (now - o.pingT < .35) return false;
      o.pingT = now; D.send('yell', { i: o.id, k: o.ctl }); S.shout(); waves.push({ at: now, x: CARDX[slot(o)] + CW / 2, y: CARDY + 20 });
      return true;
    },
    draw() {
      const dtd = clamp(now - lastDraw, 0, .05); lastDraw = now; onResult();
      if (!LAYERS[role]) LAYERS[role] = { wall: mkLayer(X => paintWall(X, role)), con: mkLayer(X => paintConsole(X, role)) };
      const L = LAYERS[role], res = g.result, urgent = orders.some(o => isOpen(o) && o.t0 + o.fuse - g.c < 1.2);
      const panic = res === 'lose' ? 1 : res === 'win' ? 0 : clamp((urgent ? .6 : .15) + alarm * .6 + nExp * .12, 0, 1);
      ctx.save();
      const rum = res === 'win' ? 2.5 : .5 + nExp * .9 + boost * 2.2 + alarm * 2; ctx.translate(Math.sin(now * 37) * rum, Math.cos(now * 29) * rum * .7);
      ctx.fillStyle = P.dk; ctx.fillRect(-30, -30, 860, 30); ctx.fillRect(-30, 0, 30, 400); ctx.fillRect(800, 0, 30, 400);   // only the rumble margins
      drawSpace(dtd, res);
      ctx.drawImage(L.wall, 0, 0, 800, 400, 0, 0, 800, 400);
      paintTV(400, 100, pcol, { eyes: res === 'win' ? 'happy' : res === 'lose' ? 'sad' : now - yellAt < .9 ? 'panic' : panic > .7 ? 'panic' : null,
        mouth: now - yellAt < .9 ? 'yell' : res === 'win' ? 'grin' : null, arms: now - yellAt < .9 ? 1.2 + Math.sin(now * 30) * .4 : res === 'win' ? 1.3 + Math.sin(now * 14) * .3 : 0,
        flash: clamp(1 - (now - flashAt) / .5, 0, 1), yell: now - yellAt < .9, stat: res === 'lose' ? (now - resAt < 1.4 || Math.sin(now * 7) > .6 ? 1 : 0) : 0 });
      drawRoute();
      ctx.drawImage(L.con, 0, 392, 800, 208, 0, 392, 800, 208); ctx.fillStyle = PAL[role].face; ctx.fillRect(-30, 392, 30, 238); ctx.fillRect(800, 392, 30, 238); ctx.fillRect(0, 600, 800, 30);
      drawCrew(dtd, panic, res);
      drawPanel(res);
      drawJam();
      drawCards();
      drawGags();
      drawWaves();
      drawBubbles();
      drawSteam(dtd);
      drawPapers(dtd);
      if (now - cheerAt < .35) { ctx.fillStyle = `rgba(255,190,90,${.16 * (1 - (now - cheerAt) / .35)})`; ctx.fillRect(-30, -30, 860, 660); }
      const al = res === 'lose' ? .12 + .06 * Math.sin(now * 10) : alarm > 0 ? alarm * .22 * (.5 + .5 * Math.sin(now * 12)) : nExp >= 2 ? .07 * (.5 + .5 * Math.sin(now * 5)) : 0;
      if (al > 0) { ctx.fillStyle = `rgba(255,30,60,${al})`; ctx.fillRect(-30, -30, 860, 660); }
      ctx.restore();
      vignette(.2);
    },
    move(p) { hov = -1; if (p.touch) return; const t = target(p); if (t) hov = t.card ? 3 + t.s : t.i; },
    down(p) { const t = target(p); if (!t) return; if (t.card) g.shout(t.o); else g.press(t.i); },
    key(e) {
      if (e.repeat) return; const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      const m = /^(?:Digit|Numpad)([1-3])$/.exec(c); if (m) { g.press(+m[1] - 1); return; }
      if (c === 'Space' || c === 'Enter') orders.filter(isOpen).forEach(o => g.shout(o));
      else if (c === 'KeyQ' || c === 'ArrowLeft') { const o = orders.find(q => slot(q) === 0 && isOpen(q)); if (o) g.shout(o); }
      else if (c === 'KeyW' || c === 'KeyE' || c === 'ArrowRight') { const o = orders.find(q => slot(q) === 1 && isOpen(q)); if (o) g.shout(o); }
    },
  };

  /* what a pointer is on: below the cards' bottom edge, near a control, the control wins (its knob top); an empty card slot
     falls through to the controls */
  function target(p) {
    const ctl = () => ({ i: p.x < 271 ? 0 : p.x < 529 ? 1 : 2 });
    if (p.y > CARDY + CH + 2 && BX.some(x => Math.abs(p.x - x) < 70)) return ctl();
    for (let s = 0; s < 2; s++) if (p.x >= CARDX[s] - 6 && p.x <= CARDX[s] + CW + 6 && p.y >= CARDY - 6 && p.y <= CARDY + CH + 8) {
      const o = orders.find(q => slot(q) === s && isOpen(q)); if (o) return { card: 1, s, o };
    }
    return p.y > CARDY + CH + 2 ? ctl() : null;
  }

  /* ── drawing ── */
  const STARS = (() => { const r = mulberry32(77); return Array.from({ length: 46 }, () => ({ x: 280 + r() * 240, y: 176 + r() * 148, z: .25 + r() * .75, c: r() })); })();
  const CRACKS = (() => { const r = mulberry32(31); return CRK.map(() => Array.from({ length: 7 }, (_, j) => { let a = j / 7 * TAU + r() * .5, x = 0, y = 0; const pts = [[0, 0]]; for (let s = 0; s < 3; s++) { const l = 9 + r() * 12; a += (r() - .5) * .9; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); } return pts; })); })();
  const SHATTER = (() => { const r = mulberry32(5), L = [], ring = [[], []];
    for (let j = 0; j < 11; j++) { let a = j / 11 * TAU + r() * .3; const pts = [[0, 0]]; let d = 0;
      for (let s = 0; s < 5; s++) { d += 22 + r() * 18; a += (r() - .5) * .35; pts.push([Math.cos(a) * d * 1.25, Math.sin(a) * d * .8]); if (s === 1 || s === 3) ring[s >> 1].push(pts[pts.length - 1]); }
      L.push(pts); }
    for (const rg of ring) for (let j = 0; j < rg.length; j++) if (r() < .8) L.push([rg[j], rg[(j + 1) % rg.length]]);
    return L; })();
  let skyG = null, starX = 0;
  function drawSpace(dt, res) {
    const W0 = WINP(); ctx.save(); ctx.clip(W0);
    if (!skyG) { skyG = ctx.createLinearGradient(0, 174, 0, 326); skyG.addColorStop(0, '#120a33'); skyG.addColorStop(.6, '#2a145e'); skyG.addColorStop(1, '#4a1f78'); }
    ctx.fillStyle = skyG; ctx.fillRect(270, 168, 260, 166);
    ctx.save(); if (res === 'lose') { ctx.translate(400, 250); ctx.rotate(Math.sin(now * 3) * .25 + (now - resAt) * .8); ctx.translate(-400, -250); }
    const v = res === 'win' ? 2200 : res === 'lose' ? 40 : 150 + boost * 1100; starX += v * dt;
    blob(ctx, 330, 210, 90, 40, 'rgba(255,90,170,.16)', -.3); blob(ctx, 470, 290, 110, 40, 'rgba(80,200,255,.14)', .2);
    const px = 600 - ((starX * .06 + 120) % 480), py = 246;                       // a ringed planet drifting by
    if (px > 220 && px < 580) {
      shp(ctx, elP(px, py, 30, 30), '#ff9a4d', 3, X => { blob(X, px + 12, py + 10, 30, 30, '#d9653a'); blob(X, px - 6, py - 12, 18, 6, '#ffc08a', -.2); X.fillStyle = 'rgba(120,40,40,.25)'; X.fillRect(px - 30, py - 4, 60, 6); });
      ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(px, py + 2, 50, 11, -.25, .15, Math.PI - .15); ctx.stroke(); ctx.strokeStyle = '#ffe7a6'; ctx.lineWidth = 3.5; ctx.stroke();
    }
    ctx.lineCap = 'round';
    if (res === 'win') {                                                          // hyperspace: streaks rush out of the centre
      const e = now - resAt; ctx.fillStyle = `rgba(120,200,255,${Math.min(.35, e * .6)})`; ctx.fillRect(270, 168, 260, 166);
      for (const s of STARS) { const a = s.c * TAU * 3, d = ((s.z * 300 + e * 600 * (.5 + s.z)) % 300), r0 = 10 + d * .6, r1 = r0 + 20 + d * .5;
        ctx.strokeStyle = s.c < .3 ? '#ffe7a6' : '#fff'; ctx.lineWidth = 1.5 + s.z * 3; ctx.globalAlpha = Math.min(1, d / 60); ctx.beginPath(); ctx.moveTo(400 + Math.cos(a) * r0, 250 + Math.sin(a) * r0 * .7); ctx.lineTo(400 + Math.cos(a) * r1, 250 + Math.sin(a) * r1 * .7); ctx.stroke(); }
      ctx.globalAlpha = 1; blob(ctx, 400, 250, 26 + Math.sin(now * 30) * 4, 20, 'rgba(255,255,255,.8)');
    } else for (const s of STARS) {
      const x = 280 + ((s.x - 280 - starX * s.z) % 240 + 240) % 240, len = 2 + Math.min(220, v * s.z * .03);
      ctx.strokeStyle = s.c < .2 ? '#ffe7a6' : s.c < .35 ? '#a8e6ff' : '#fff'; ctx.lineWidth = 1.4 + s.z * 2.2; ctx.globalAlpha = .45 + s.z * .55;
      ctx.beginPath(); ctx.moveTo(x, s.y); ctx.lineTo(x + len, s.y); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.restore();
    for (let i = 0; i < Math.min(3, nExp); i++) drawCrack(i, CRK[i].x, CRK[i].y, i === 2 ? 1.5 : 1);
    if (res === 'lose') {                                                         // the cracks join up: the whole pane shatters
      const k = easeBack(clamp((now - resAt) / .3, 0, 1)), fl = clamp(1 - (now - resAt) / .25, 0, 1);
      ctx.save(); ctx.translate(400, 252); ctx.scale(k, k);
      for (const pts of SHATTER) { line(ctx, pts, 6); line(ctx, pts, 2.4, '#e8f6ff'); }
      ctx.restore();
      if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${fl * .8})`; ctx.fillRect(270, 168, 260, 166); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(300, 330); ctx.lineTo(360, 170); ctx.lineTo(400, 170); ctx.lineTo(340, 330); ctx.fill(); ctx.beginPath(); ctx.moveTo(356, 330); ctx.lineTo(416, 170); ctx.lineTo(430, 170); ctx.lineTo(370, 330); ctx.fill();
    ctx.restore();
  }
  /* lose: loose papers (cosmetic) whirl into the shattered porthole, spinning and shrinking */
  function drawPapers(dt) {
    for (let i = papers.length - 1; i >= 0; i--) {
      const q = papers[i]; q.d -= dt; if (q.d > 0) continue;
      const dx = 400 - q.x, dy = 250 - q.y, dd = Math.hypot(dx, dy); if (dd < 24) { papers.splice(i, 1); continue; }
      const v = Math.min(900, 160 + 500 * -q.d); q.x += dx / dd * v * dt + (-dy / dd) * 120 * dt; q.y += dy / dd * v * dt + (dx / dd) * 120 * dt; q.r += q.sp * dt;
      const sc = clamp(dd / 160, .25, 1);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.scale(sc, sc * (.6 + .4 * Math.abs(Math.sin(q.r * 2))));
      shp(ctx, PAPER(), q.col, 3); ctx.fillStyle = 'rgba(20,16,28,.35)'; ctx.fillRect(-10, -7, 16, 2.5); ctx.fillRect(-10, -1, 20, 2.5); ctx.fillRect(-10, 5, 12, 2.5);
      ctx.restore();
    }
  }
  function drawCrack(i, x, y, big) {
    const k = clamp((now - crackAt[i]) / .18, 0, 1), sc = (.3 + .7 * easeBack(k)) * big;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    for (const pts of CRACKS[i]) { line(ctx, pts, 5.5); line(ctx, pts, 2.2, '#e8f6ff'); }
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 2; ctx.stroke();
    blob(ctx, 0, 0, 7, 7, 'rgba(232,246,255,.35)');
    ctx.restore();
  }
  function drawSteam(dt) {
    for (let i = 0; i < Math.min(3, nExp); i++) {                               // air hissing out of each crack
      const c = CRK[i]; if (Math.random() < dt * 16) puffs.push({ x: c.x + (Math.random() - .5) * 8, y: c.y, vx: c.vx * (40 + Math.random() * 70), vy: -50 - Math.random() * 60, r: 5 + Math.random() * 4, life: 0, max: .6 + Math.random() * .4 });
    }
    for (const q of puffs) { const u = q.life / q.max; ctx.globalAlpha = .7 * (1 - u); blob(ctx, q.x, q.y, q.r * (1 + u * 2.2), q.r * (1 + u * 2.2), q.col || '#f2f6ff'); ctx.globalAlpha = 1; }
    for (const q of sparks) {
      const u = q.life / q.max;
      const rr = q.r * (1 - u * .5);
      if (q.shard) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + q.spin * q.life); ctx.scale(rr, rr); const o = OS; OS = 1 / rr; shp(ctx, SHARD(), q.col, 2, X => blob(X, -.2, -.3, .35, .2, '#fff')); OS = o; ctx.restore(); }
      else star(q.x, q.y, rr, rr * .45, 4, q.rot + q.spin * q.life * .3, q.col, 2.5);
    }
  }
  function drawRoute() {
    shp(ctx, rrC(478, 62, 212, 82, 16), '#2a2f52', 5, X => { X.fillStyle = '#3a4170'; X.fillRect(478, 62, 212, 8); });
    const scr = rrC(488, 70, 192, 40, 9); shp(ctx, scr, '#0e1a36', 3);
    ctx.save(); ctx.clip(scr);
    for (let i = 0; i < 9; i++) blob(ctx, 492 + ((i * 53 + now * 8) % 190), 74 + (i * 17) % 34, 1.2, 1.2, 'rgba(255,255,255,.6)');
    const x0 = 506, x1 = 662;
    ctx.setLineDash([4, 6]); line(ctx, [[x0, 90], [x1, 90]], 2.5, 'rgba(255,255,255,.55)'); ctx.setLineDash([]);
    for (let i = 1; i <= NEED; i++) { const x = x0 + (x1 - x0) * i / NEED, on = nDone >= i; blob(ctx, x, 90, on ? 4.5 : 3, on ? 4.5 : 3, on ? '#5CFF7A' : 'rgba(255,255,255,.4)'); }
    shp(ctx, elP(x0, 90, 9, 9), '#4DB8FF', 2.5, X => { blob(X, x0 - 2, 87, 4, 3, '#5CFF7A'); blob(X, x0 + 3, 93, 3, 2, '#5CFF7A'); });
    shp(ctx, elP(x1 + 6, 90, 12, 12), '#FFE14D', 2.5, X => blob(X, x1 + 10, 94, 10, 10, '#e0a91c')); line(ctx, [[x1 + 6, 78], [x1 + 6, 66]], 2.5); ctx.fillStyle = RED; ctx.fillRect(x1 + 7, 66, 9, 6);
    rocketIcon(x0 + (x1 - x0) * showProg, 90 + Math.sin(now * 6) * 1.5, .62 + boost * .15);
    ctx.restore();
    txt('HULL', 528, 126, 18, '#fff', 'center', 70);
    for (let i = 0; i < MAXX; i++) { const j = MAXX - 1 - i, ok = nExp <= j; shield(590 + i * 32, 126, ok, ok && nExp === MAXX - 1 && !g.result, (now - shieldAt[j]) / .45); }
  }
  /* the Claude crew stand ON the desk, in the gaps between the control bays: panic, cheer on every done order,
     launch into a big arms-up jump on a win, keel over onto the desk (dizzy) on a loss */
  const CREWX = [271, 529], DESK = 414, GEAR = judge ? 'cap' : 'hard';
  function drawCrew(dt, panic, res) {
    for (let i = 0; i < 2; i++) {
      crewPh[i] += dt * (res === 'win' ? .6 : .5 + panic * 2.6);
      const u = 6.2, x0 = CREWX[i] + Math.sin(crewPh[i] * (i ? 1.13 : .91) + i * 2.4) * (4 + panic * 5);
      const fl = Math.sin(now * 24 + i * 2) * .55, hatC = now < hatsUntil ? (i ? '#4DB8FF' : '#FF4D9E') : null;
      if (res === 'lose') {                                                        // a fright hop, then SPLAT: squashed flat on the desk, legs kicking, seeing stars, hat knocked off
        const e = now - resAt - i * .12, up = e < .32, k = clamp((e - .32) / .5, 0, 1);
        const yy = up ? DESK - Math.sin(clamp(e / .32, 0, 1) * Math.PI) * 54 : DESK, sq = up ? 1.12 : .46 + .3 * Math.exp(-k * 5) * Math.cos(k * 18);
        blob(ctx, x0, DESK + 2, up ? 30 : 50, 7, 'rgba(20,16,28,.28)');
        crew(x0, yy, u, { col: OR, gear: up ? GEAR : null, eyes: up ? 'panic' : 'sad', mouth: 'o', aL: up ? 2.2 : 1.45 + fl * .4, aR: up ? 2.2 : 1.45 - fl * .4, sq, seed: i * 2, hat: up ? hatC : null, run: up ? null : now * .9 + i });
        if (!up) {
          const hk = clamp((e - .32) / .7, 0, 1), dir = i ? 1 : -1;                    // the hat / helmet tumbles off
          ctx.save(); ctx.translate(x0 + dir * (20 + hk * 46), DESK - 8 * u * .46 - Math.sin(hk * Math.PI) * 60 + hk * 6 * u * .46); ctx.rotate(dir * hk * 3.4); ctx.scale(u, u); gear(GEAR, true); ctx.restore();
          for (let s2 = 0; s2 < 3; s2++) { const a = now * 5 + s2 * TAU / 3 + i; star(x0 + Math.cos(a) * 34, DESK - 6.5 * u + Math.sin(a) * 7, 8, 3.5, 5, a, YEL, 2.5); }
        }
        continue;
      }
      let y = DESK, sq = 1 + Math.sin(now * 12 + i) * .05 * (1 + panic), aL, aR, eyes, mouth;
      if (res === 'win') {                                                         // big jumps, arms up, squash on landing
        const T = .62, e = (now - resAt + i * .31) % T, h = Math.sin(e / T * Math.PI);
        y = DESK - h * 78; sq = h < .18 ? 1 - (1 - h / .18) * .22 : 1 + h * .08;
        aL = 2.3 + fl * .4; aR = 2.3 - fl * .4; eyes = 'happy'; mouth = 'grin';
      } else {
        const cheer = now - cheerAt < .7 || now < danceUntil, hop = Math.abs(Math.sin(now * (5 + panic * 9) + i)) * (2 + panic * 9);
        y = DESK - hop - (cheer ? Math.abs(Math.sin(now * 11 + i * 1.3)) * 26 : 0);
        aL = cheer ? 1.9 + fl * .5 : panic > .5 ? 1.15 + fl : .1; aR = cheer ? 1.9 - fl * .5 : panic > .5 ? 1.15 - fl : .1;
        eyes = cheer ? 'happy' : panic > .5 ? 'panic' : null; mouth = cheer ? 'grin' : panic > .5 ? 'yell' : null;
      }
      const air = DESK - y;
      blob(ctx, x0, DESK + 2, 34 * (1 - air / 160), 7 * (1 - air / 160), 'rgba(20,16,28,.28)');
      crew(x0, y, u, { col: OR, gear: GEAR, eyes, mouth, aL, aR, sweat: panic > .4 && !res && now - cheerAt > .7, sq, hat: hatC,
        rot: now < danceUntil ? Math.sin(now * 14 + i) * .2 : 0, seed: i * 2 });
    }
  }
  function drawPanel(res) {
    const lamps = [[271, 456], [271, 486], [271, 516], [529, 456], [529, 486], [529, 516]];
    lamps.forEach(([x, y], j) => {
      const on = res === 'lose' || alarm > 0 ? Math.floor(now * 8 + j) % 2 === 0 : (Math.floor(now * 3 + j * 1.7) % 3) !== 0, col = res === 'lose' || alarm > 0 ? '#ff4d4d' : res === 'win' ? '#5CFF7A' : P.lamp[j % 3];
      blob(ctx, x, y, 7.5, 7.5, INK); blob(ctx, x, y, 5.5, 5.5, on ? col : dark(col, .55)); if (on) blob(ctx, x - 1.5, y - 1.5, 1.8, 1.8, '#fff');
    });
    for (let i = 0; i < 3; i++) {
      const k = mine[i], tp = now - pressAt[i], jam = now < jamT, wob = Math.max(0, 1 - (now - wobAt[i]) / .3);
      const yrs = clamp(1 - (now - yoursAt[i]) / 1.2, 0, 1);
      if (hov === i && !res) { ctx.save(); ctx.globalAlpha = .22 + .08 * Math.sin(now * 8); ctx.fillStyle = '#fff'; ctx.fill(rrC(BX[i] - 118, 440, 236, 110, 18)); ctx.restore(); }
      ctx.save(); ctx.translate(BX[i], CTLY);
      if (jam || wob > 0) ctx.rotate(Math.sin(now * 30) * .05 * (jam ? 1 : wob));
      if (yrs > 0) { ctx.globalAlpha = yrs; blob(ctx, 0, -10, 120, 100, 'rgba(255,225,77,.35)'); ctx.globalAlpha = 1; }
      CST.p = pressK(tp); CST.tp = tp < 2 ? tp : -1; CST.n = pressN[i]; CST.t = now;
      const rest = tp > 1.3 || tp < 0;
      if (k === 4) {                                                               // valve: cached body + wheel + hub, vector needle only
        blit('vb', 0, 0); valveNeedle(ctx, valveNa(CST));
        ctx.save(); ctx.translate(0, -36); ctx.rotate(valveSpin(CST) + .3); blit('vw', 0, 0); ctx.restore(); blit('vh', 0, -36);
      } else if (k === 1 && rest) {                                                // banana at rest: cached base + the fruit swaying on its stem
        blit('bb', 0, 0); ctx.save(); ctx.translate(0, 40); ctx.rotate(.14 + Math.sin(now * 2.1) * .03); blit('bf', 0, 0); ctx.restore();
      } else if (rest) drawArt(k, 0, 0, 1);                                         // at rest: the cached sprite
      else ARTS[k](ctx, CST);
      ctx.restore();
      if (jam) { for (let s = 0; s < 3; s++) { const a = now * 6 + s * TAU / 3; star(BX[i] + Math.cos(a) * 50, CTLY - 92 + Math.sin(a) * 12, 10, 4.5, 5, a, YEL, 2.5); } }
      if (k === 4 && tp < .9) for (let s = 0; s < 4; s++) { const u = (tp * 1.4 + s * .17) % 1; ctx.globalAlpha = (1 - u) * .8; blob(ctx, BX[i] + 30 + u * 60 + s * 5, CTLY + 40 - u * 40 - s * 10, 8 + u * 16, 8 + u * 16, '#f2f6ff'); ctx.globalAlpha = 1; }
      shp(ctx, rrC(BX[i] - 80, 522, 160, 26, 9), P.plate, 3, X => { X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(BX[i] - 80, 522, 160, 5); });
      txt(NAMES[k], BX[i], 536, 18, INK, 'center', 146);
      if (!TOUCH) { circ(BX[i] - 98, 462, 15, '#fff', 3); txt(String(i + 1), BX[i] - 98, 463, 19, INK, 'center'); }
      if (yrs > 0) { const by = 330 + Math.sin(now * 14) * 6; txt('YOURS!', BX[i], by - 22, 26, ycol, 'center', 200); txt('▼', BX[i], by + 4, 26, ycol); }
    }
  }
  function drawJam() {
    if (now >= jamT || g.result) return;
    const left = jamT - now;
    ctx.save(); ctx.globalAlpha = .38 * clamp(left * 4, 0, 1); ctx.fillStyle = '#14101c'; for (let i = 0; i < 3; i++) ctx.fill(rrC(BX[i] - 118, 440, 236, 110, 18)); ctx.restore();
    ctx.save(); ctx.globalAlpha = clamp(left * 4, 0, 1); ctx.translate(400, 488); ctx.rotate(-.05 + Math.sin(now * 9) * .01);
    const tape = rrC(-300, -24, 600, 48, 6); ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(tape); hazard(ctx, tape, -300, 300, -24, 24, 18);
    shp(ctx, rrC(-118, -30, 236, 60, 14), '#fff8e8', 5); txt('JAMMED!', 0, -4, 30, '#ff3d5a', 'center', 210);
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(-90, 16, 180, 7); ctx.fillStyle = '#ff3d5a'; ctx.fillRect(-90, 16, 180 * clamp(left / jamLen, 0, 1), 7);
    ctx.restore();
  }
  function drawGags() {
    for (let j = gags.length - 1; j >= 0; j--) {
      const q = gags[j], e = now - q.at;
      if (q.kind === 'cow') {
        if (e > 2.2) { gags.splice(j, 1); continue; }
        let y, rot = 0, sq = 1;
        if (e < .45) { y = -80 + 470 * (e / .45) * (e / .45); rot = e * 3; }
        else if (e < .85) { const u = (e - .45) / .4; y = 390 - Math.sin(u * Math.PI) * 60; sq = u < .15 ? 1 - (1 - u / .15) * .3 : 1; rot = 1.35 - u * 1.35; }
        else { const u = e - .85; y = 390 - u * u * 260; rot = Math.sin(u * 3) * .4 + u * .6; }
        ctx.save(); ctx.translate(q.x, y); ctx.scale(1 / sq, sq); cow(0, -30, .95, rot); ctx.restore();
        if (e > .45 && e < 1.6) txt('MOO!', q.x + 70, 330 - (e - .45) * 30, 34, '#fff', 'center');
      } else if (q.kind === 'kazoo') {
        if (e > 1.6) { gags.splice(j, 1); continue; }
        for (let s = 0; s < 4; s++) { const u = e / 1.6 + s * .12; if (u > 1) continue; ctx.globalAlpha = 1 - u; note(q.x - 40 + s * 28 + Math.sin(u * 9 + s) * 14, 400 - u * 180, 1, [YEL, PNK, '#4DB8FF', GRN][s]); ctx.globalAlpha = 1; }
      } else if (q.kind === 'ducks') {
        if (e > 1.9) { gags.splice(j, 1); continue; }
        for (let s = 0; s < 4; s++) { const u = e - s * .12; if (u < 0) continue; const x = q.x - 90 + s * 60, y = Math.min(392, -40 + 900 * u * u); const b = u > .5 ? Math.abs(Math.sin((u - .5) * 9)) * 30 * Math.max(0, 1 - (u - .5)) : 0; duck(x, y - 18 - b, 1, Math.sin(u * 8 + s) * .25); }
      } else if (e > 1) gags.splice(j, 1);
    }
  }
  /* cards: drop in, burn, get stamped DONE! and fly into the route screen (never through the HUD corners), or BOOM.
     After the verdict they freeze: no new ones, the open ones BOOM one by one (lose) or drop out of sight (win). */
  const ROUTE = [560, 96];
  function drawCards() {
    const tc = resC || g.c;
    for (const o of orders) {
      if (o.p !== role || o.t0 < 0 || tc < o.t0) continue;
      const age = tc - o.t0, end = o.t0 + o.fuse, s = slot(o), x = CARDX[s], rem = end - tc;
      let cx = x + CW / 2, cy = CARDY + CH / 2, alpha = 1, sc = 1, rot = Math.sin(now * 1.6 + o.id) * .02 + (s ? .02 : -.02), stamp = -1, ended = false;
      if (o.stampT) {
        const e = now - o.stampT; if (e > .9) continue; stamp = e;
        if (e > .5) {                                                               // fly into the route screen and shrink into it
          const u = (e - .5) / .4, vx = 1 - (1 - u) * (1 - u), vy = u * u;               // sideways first, then up: it never crosses the HUD corners
          cx += (ROUTE[0] - cx) * vx; cy += (ROUTE[1] - cy) * vy; sc = 1 - .88 * u; rot += u * .5 * (s ? -1 : 1); alpha = u > .75 ? 1 - (u - .75) / .25 : 1;
          if (u > .85 && !o.arrFx) { o.arrFx = 1; ring(506 + 156 * Math.min(1, nDone / NEED), 90, YEL, 46, .35); sparkle(ROUTE[0], ROUTE[1], YEL, 6, 160); }
        }
      } else if (o.endAt && now >= o.endAt && g.result === 'win') {                  // win: the leftover orders get sucked into hyperspace
        const e = now - o.endAt, u = clamp(e / .45, 0, 1); if (u >= 1) continue; const v = u * u;
        cx += (400 - cx) * v; cy += (250 - cy) * v; sc = 1 - .9 * v; rot += u * 4 * (s ? -1 : 1); alpha = 1 - v; ended = true;
      } else if (o.exp || (o.endAt && now >= o.endAt) || (o.boomAt && now - o.boomAt < .3)) {
        if (!o.boomAt) o.boomAt = o.exp ? now : o.endAt;
        const e = now - o.boomAt; if (e > .35) continue;
        if (!o.boomFx) { o.boomFx = 1; sparkle(x + 26, CARDY + 131, '#FF9A4D', 8, 280); sparkle(x + 26, CARDY + 131, YEL, 4, 180); for (let s2 = 0; s2 < 10; s2++) puffs.push({ x: x + 20 + Math.random() * 40, y: CARDY + 122, vx: (Math.random() - .3) * 120, vy: -40 - Math.random() * 90, r: 7 + Math.random() * 6, life: 0, max: .6 + Math.random() * .4, col: '#6b6080' });
          if (o.exp) floatText('BOOM!', x + CW / 2, CARDY + 70, '#FF9A4D', 44); else { sfx.thud(); shake(5, .15); } }
        sc = 1 + e * .6; alpha = 1 - e / .35; rot += e * 1.2 * (s ? 1 : -1); ended = true;
      } else if (rem < 0) continue;
      const dy = 0; if (age < .32) { const k = easeBack(age / .32); sc *= .25 + .75 * k; rot += (1 - k) * (s ? .5 : -.5); }   // pops in place (no slide through the HUD corners)
      const live = !o.stampT && !ended && !g.result, urg = live && rem < 1.2 ? clamp(1 - rem / 1.2, 0, 1) : 0, shk = urg * 3 + (ended ? 3 : 0);
      ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(cx + Math.sin(now * 47) * shk, cy + dy + Math.cos(now * 41) * shk * .6); ctx.rotate(rot); ctx.scale(sc, sc);
      const pinged = now - o.pingT < 4, pop = (now - o.pingT < .25 ? 1 + .08 * Math.sin((now - o.pingT) / .25 * Math.PI) : 1) * (hov === 3 + s && live ? 1.03 : 1); ctx.scale(pop, pop);
      ctx.translate(-CW / 2, -CH / 2);
      const friend = !mine.includes(o.ctl);
      paintCard({ k: o.ctl, frac: rem / o.fuse, urg, friend, label: friend ? (pinged ? 'SHOUTED!' : TOUCH ? 'TAP TO SHOUT' : 'CLICK TO SHOUT') : 'YOURS!', pcol, ycol, stamp,
        burning: live && rem > 0, hot: live && rem < .5 });
      if (ended && g.result !== 'win') { ctx.globalAlpha *= .6; ctx.fillStyle = '#2b2030'; ctx.fill(rrC(0, 0, CW, CH, 18)); }
      ctx.restore();
    }
  }
  function drawWaves() {
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i], e = (now - w.at) / .45; if (e > 1) { waves.splice(i, 1); continue; }
      const x = w.x + (400 - w.x) * e, y = w.y + (110 - w.y) * e - Math.sin(e * Math.PI) * 50, a = Math.atan2(110 - w.y, 400 - w.x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = 1 - e * .6;
      for (let s = 0; s < 3; s++) { ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-s * 16, 0, 16 + s * 6, -.7, .7); ctx.stroke(); ctx.strokeStyle = pcol; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.restore();
    }
  }
  function drawBubbles() {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i], o = orders[b.i];
      if ((b.popAt && now - b.popAt > .62) || (g.result && !b.popAt) || (!b.popAt && now - b.at > 2.4) || !o || o.exp || (!b.popAt && o.t0 >= 0 && g.c > o.t0 + o.fuse + (judge ? GRACE - .1 : 0))) bubbles.splice(i, 1);
    }
    if (!bubbles.length) return;
    const items = bubbles.map(b => ({ k: b.k, pop: easeBack((now - b.at) / .22), flash: b.popAt ? 0 : clamp(1 - (now - b.at) / .6, 0, 1), gone: b.popAt ? clamp((now - b.popAt) / .62, .001, 1) : 0 }));
    paintBubble(400, 180, items, pcol);
  }

  g.dbg = { mine, cards: () => orders.filter(isOpen).map(o => ({ id: o.id, ctl: o.ctl })), orders, done: () => nDone, lost: () => nExp };
  wire(g, D, 0, sp, 'du_panic');
  return g;
}

/* ───────────── intro card: text + animated demos (520 x 240) ─────────────
   Each demo alternates the two halves of the job (both rooms do both): A = tap a card and your friend does it,
   B = your friend shouts an icon and you press it on your panel. The bridge starts with B, the engine room with A. */
DUO.INFO.du_panic = [['BRIDGE', 'SHOUT YOUR CARDS, DO THEIRS', 'PRESS WHAT YOUR FRIEND SHOUTS'], ['ENGINE ROOM', 'SHOUT YOUR CARDS, DO THEIRS', 'TAP A CARD TO SHOUT IT']];
const DEMO_BG = [];
const DPX = [104, 260, 416], DPY = 194, DPS = .5, DPORT = [470, 62];
function demoBg(role) {                                                            // the room in miniature, painted once (2x for crisp scaling)
  if (DEMO_BG[role]) return DEMO_BG[role];
  const c = document.createElement('canvas'); c.width = 1040; c.height = 480; const X = c.getContext('2d'); X.scale(2, 2);
  const P = PAL[role];
  X.fillStyle = P.wall; X.fillRect(0, 0, 520, 240);
  const cols = [0, 132, 268, 400, 520], rows = [0, 96, 176];
  for (let r = 0; r < 2; r++) for (let q = 0; q < 4; q++) {
    const x0 = cols[q], x1 = cols[q + 1], y0 = rows[r], y1 = rows[r + 1];
    X.fillStyle = P.hi; X.fillRect(x0, y0, x1 - x0, 5); X.fillStyle = P.sh; X.fillRect(x0, y1 - 6, x1 - x0, 6); X.fillRect(x1 - 5, y0, 5, y1 - y0);
    X.fillStyle = 'rgba(20,16,28,.55)'; X.fillRect(x0, y0, x1 - x0, 2); X.fillRect(x0, y0, 2, y1 - y0);
    for (const [rx, ry] of [[x0 + 11, y0 + 12], [x1 - 14, y0 + 12], [x0 + 11, y1 - 16], [x1 - 14, y1 - 16]]) { blob(X, rx + 1, ry + 2, 4, 4, P.sh); blob(X, rx, ry, 3.5, 3.5, P.hi); blob(X, rx - 1, ry - 1, 1.4, 1.4, '#fff'); }
  }
  if (role) shp(X, rrP(-10, 150, 540, 16, 8), P.rail, 3.5, X => { X.fillStyle = '#c4862a'; X.fillRect(-10, 160, 540, 6); X.fillStyle = '#ffe08a'; X.fillRect(-10, 152, 540, 3); });
  else shp(X, rrP(-10, 154, 540, 10, 5), P.rail, 3.5, X => { X.fillStyle = '#fff'; X.fillRect(-10, 155, 540, 3); });
  const [px, py] = DPORT;                                                          // a mini porthole
  shp(X, elP(px, py, 44, 40), '#cfd6ea', 4, X => { blob(X, px + 10, py + 12, 44, 40, '#9aa4c4'); blob(X, px - 6, py - 8, 40, 34, '#cfd6ea'); });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .4; blob(X, px + Math.cos(a) * 38, py + Math.sin(a) * 34, 3.2, 3.2, INK); blob(X, px + Math.cos(a) * 38, py + Math.sin(a) * 34, 2, 2, '#f4f6ff'); }
  const sky = X.createLinearGradient(0, py - 30, 0, py + 30); sky.addColorStop(0, '#120a33'); sky.addColorStop(1, '#4a1f78');
  X.strokeStyle = INK; X.lineWidth = 4; X.fillStyle = sky; X.beginPath(); X.ellipse(px, py, 30, 27, 0, 0, TAU); X.fill(); X.stroke();
  X.save(); X.beginPath(); X.ellipse(px, py, 28, 25, 0, 0, TAU); X.clip();
  shp(X, elP(px + 10, py + 6, 11, 11), '#ff9a4d', 2.5, X => blob(X, px + 15, py + 10, 11, 11, '#d9653a'));
  X.fillStyle = 'rgba(255,255,255,.12)'; X.beginPath(); X.moveTo(px - 24, py + 26); X.lineTo(px - 4, py - 28); X.lineTo(px + 8, py - 28); X.lineTo(px - 12, py + 26); X.fill(); X.restore();
  X.fillStyle = 'rgba(20,16,28,.3)'; X.fillRect(0, 168, 520, 12);
  X.fillStyle = INK; X.fillRect(0, 176, 520, 4); X.fillStyle = P.top; X.fillRect(0, 180, 520, 12); X.fillStyle = '#fff'; X.fillRect(0, 182, 520, 3); X.fillStyle = P.topSh; X.fillRect(0, 188, 520, 4);
  X.fillStyle = INK; X.fillRect(0, 192, 520, 3); X.fillStyle = P.face; X.fillRect(0, 195, 520, 45);
  for (const x of DPX) shp(X, rrP(x - 66, 200, 132, 50, 12), P.bay, 3, X => { X.fillStyle = 'rgba(0,0,0,.32)'; X.fillRect(x - 66, 200, 132, 7); });
  for (const x of [182, 338]) for (let k = 0; k < 2; k++) { blob(X, x, 210 + k * 18, 5.5, 5.5, INK); blob(X, x, 210 + k * 18, 4, 4, P.lamp[k]); }
  DEMO_BG[role] = c; return c;
}
function demoScene(role) {
  ctx.drawImage(demoBg(role), 0, 0, 520, 240);
  const [px, py] = DPORT; ctx.save(); ctx.beginPath(); ctx.ellipse(px, py, 28, 25, 0, 0, TAU); ctx.clip(); ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const y = py - 20 + i * 8, x = px + 40 - ((now * (60 + i * 23) + i * 37) % 90); ctx.strokeStyle = i % 3 ? '#fff' : '#ffe7a6'; ctx.lineWidth = 1.5 + (i % 2); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + i * 2, y); ctx.stroke(); }
  ctx.restore();
}
/* B: the friend on the intercom shouts an icon, you find it on your panel and press it */
function demoPress(role, n, ph) {
  const pc = role ? '#FF4D9E' : '#4DB8FF', j = [1, 2, 0][n % 3], k = PAN_[role][j], yell = ph > .05 && ph < .95, ok = ph > .95;
  ctx.save(); ctx.translate(86, 64); ctx.translate(-400, -100); paintTV(400, 100, pc, { eyes: yell ? 'panic' : ok ? 'happy' : null, mouth: yell ? 'yell' : ok ? 'grin' : null, arms: yell ? 1.2 + Math.sin(now * 30) * .4 : ok ? 1.9 + Math.sin(now * 14) * .3 : 0, flash: clamp(1 - (ph - .05) / .5, 0, 1), yell }); ctx.restore();
  if (ph > .05 && ph < 1.75) {
    const gone = ph > .95 ? clamp((ph - .95) / .62, .001, 1) : 0;
    ctx.save(); ctx.translate(194, 20); ctx.scale(.9, .9); paintBubble(120, 0, [{ k, pop: easeBack((ph - .05) / .22), flash: gone ? 0 : clamp(1 - (ph - .05) / .6, 0, 1), gone }], pc, true); ctx.restore();
  }
  for (let q = 0; q < 3; q++) { const tp = q === j ? ph - .9 : -1; drawArt(PAN_[role][q], DPX[q], DPY, DPS, tp >= 0 && tp < 1.3 ? { p: pressK(tp), tp, n: 1, t: now } : null); }
  const tx = DPX[j], u = ease((ph - .35) / .5), fx = 500 + (tx + 14 - 500) * u, fy = 236 + (188 - 236) * u;
  if (ph > .95 && ph < 1.5) { const e = (ph - .95) / .55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.globalAlpha = 1 - e; ctx.beginPath(); ctx.arc(tx, DPY - 14, 40 + e * 60, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  DUO.demoFinger(fx, fy, ph > .86 && ph < 1.12, (ph - .86) / .26);
}
/* A: a card for your friend's panel (drawn small and high, so your own three controls stay in view); tap it, the shout flies to
   the intercom, your friend presses it on THEIR panel (a little partner-coloured finger next to the intercom): DONE! The finger
   leaves to the left, away from your own controls. */
function demoShout(role, n, ph) {
  const pc = role ? '#FF4D9E' : '#4DB8FF', k = PAN_[1 - role][[2, 0, 1][n % 3]], CS = .85;
  const drop = ph < .28 ? (1 - easeBack(ph / .28)) * -200 : 0, tap = ph > .5 && ph < .72, sh = ph > .55, st = ph > 1.4 ? ph - 1.4 : -1;
  const fl = ph > .78 && ph < 1.3, yell = ph > .8 && ph < 1.4, happy = ph > 1.4;
  ctx.save(); ctx.translate(350, 70); ctx.translate(-400, -100); paintTV(400, 100, pc, { eyes: yell ? 'panic' : happy ? 'happy' : null, mouth: yell ? 'yell' : happy ? 'grin' : null, arms: yell ? 1.2 + Math.sin(now * 30) * .4 : happy ? 1.9 + Math.sin(now * 14) * .3 : 0, flash: fl ? 1 - (ph - .78) / .52 : 0, yell }); ctx.restore();
  for (let q = 0; q < 3; q++) drawArt(PAN_[role][q], DPX[q], DPY, DPS);
  if (ph > 1.02 && ph < 1.75) {                                                    // your friend presses it over there
    const e = ph - 1.02, dn = e > .18 && e < .4, a = clamp(Math.min(e / .12, (1.75 - ph) / .2), 0, 1);
    ctx.save(); ctx.globalAlpha = a; shp(ctx, rrC(398, 90, 56, 50, 13), dark(pc, .55), 3.5, X => { X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(398, 90, 56, 6); });
    drawArt(k, 426, 124, .17, dn ? { p: 1, tp: e - .18, n: 1, t: now } : null);
    if (dn) { ctx.strokeStyle = pc; ctx.lineWidth = 4; ctx.globalAlpha = a * (1 - (e - .18) / .22); ctx.beginPath(); ctx.arc(426, 112, 14 + (e - .18) * 80, 0, TAU); ctx.stroke(); ctx.globalAlpha = a; }
    circ(431, (dn ? 106 : 94) - Math.max(0, .18 - e) * 100, 8, pc, 3); ctx.restore();
  }
  let cx = 12 + CW * CS / 2, cy = 12 + CH * CS / 2 + drop, sc = CS, al = 1;
  if (st > .45) { const u = clamp((st - .45) / .35, 0, 1); cy -= u * u * 140; sc = CS * (1 - .5 * u); al = 1 - u; }
  ctx.save(); ctx.globalAlpha = al; ctx.translate(cx, cy); ctx.rotate(-.02); ctx.scale(sc * (tap ? 1.05 : 1), sc * (tap ? 1.05 : 1)); ctx.translate(-CW / 2, -CH / 2);
  paintCard({ k, frac: 1 - ph / 2.6, urg: 0, friend: true, big: true, label: sh ? 'SHOUTED!' : TOUCH ? 'TAP TO SHOUT' : 'CLICK TO SHOUT', pcol: pc, ycol: YEL, stamp: st, burning: st < 0, hot: false });
  ctx.restore(); ctx.globalAlpha = 1;
  if (ph > .58 && ph < 1.05) { const e = (ph - .58) / .47; for (let q = 0; q < 3; q++) { const x = 200 + (282 - 200) * e - q * 14, y = 40 - Math.sin(e * Math.PI) * 24 + e * 34; ctx.globalAlpha = 1 - e * .5; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, 14 + q * 6, -.7, .7); ctx.stroke(); ctx.strokeStyle = pc; ctx.lineWidth = 4; ctx.stroke(); } ctx.globalAlpha = 1; }
  const tx = 150, ty = 96, uin = ease((ph - .2) / .3), uout = ease((ph - .8) / .35);
  const fx = ph < .8 ? 500 + (tx - 500) * uin : tx + (-40 - tx) * uout, fy = ph < .8 ? 236 + (ty - 236) * uin : ty + (70 - ty) * uout;
  DUO.demoFinger(fx, fy, tap, (ph - .5) / .22);
}
const PAN_ = [[0, 1, 2], [3, 4, 5]], DT = 2.2;
DUO.DEMOS.du_panic = [0, 1].map(role => tt => {
  const n = Math.floor(tt / DT), ph = tt % DT, first = role ? demoShout : demoPress, second = role ? demoPress : demoShout;
  demoScene(role); (n % 2 ? second : first)(role, n >> 1, ph);
});
reg('du_panic', duPanic, 'PANIC PANEL'); REGMAP.du_panic.duo = true;
})();
