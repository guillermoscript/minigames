'use strict';
/* ═════════ DUO · ¡RECOGE LA ROPA! (du_tendedero), reg name 'AGUACERO' ═════════
   A Caracas patio, storm clouds rolling in off the Avila. Two clotheslines (left and right) run under a zinc porch roof.
   HEN (role 0, JUDGE): perched on the fence, she sees the SKY: every storm cloud sliding in from the left or the right, and nothing
   about the laundry (a bougainvillea hedge hides the yard). She clucks to warn the granny: 1 cluck = the cloud is on the LEFT,
   2 quick clucks = on the RIGHT (the keys ◄ ► / A D say it straight). The warning rings a bell on the granny's side.
   GRANNY (role 1): at the two pulley cranks under the roof. She cannot see the sky (the porch roof is over her head), only the
   laundry and the bell. She reels each line IN under the roof before the rain reaches it and back OUT afterwards so it dries:
   circular drag on a crank (clockwise = in), tap a crank (reels the line all the way), or keys A D (left line) / ◄ ► (right line).
   Washing only dries while it hangs out in the sun; rain on an exposed garment soaks it again. The tío keeps hanging more wet
   shirts, so there is always drying left to do. Win: all six garments dry and under the roof (sábanas flap, granny thumbs up).
   Fail: the calzones get drenched, the hen ends up wearing them as a hat.
   Time: the whole script runs in "u" = g.c * sqrt(speed), so every speed has the same storm schedule.
   Netcode: the HEN owns the warnings: 'ck' [side, n]. The GRANNY owns the laundry: 'st' [posL, posR, d0..d5] (x100, d = -1 for a garment
   not hung yet), coalesced <= 10/s (latest). The storm schedule comes from the seeded mkR(), so both screens see the same clouds
   and the same rain. The hen judges: win as soon as the latest report shows everything dry and in; lose at g.limit. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

/* ───────────── layout (800×600; the HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const LY = 322;                                        // the clothesline height
const OUTC = [[60, 120, 178], [740, 680, 622]], INC = [[250, 310, 368], [550, 490, 432]];   // item centres: line out in the yard / reeled in under the roof
const ROOF0 = 205, ROOF1 = 595;                        // the porch roof spans these x
const COVER = [222, 578];                              // an item whose centre is past this (towards the middle) is dry from the rain
const CR = [[330, 452], [470, 452]];                   // crank centres
const CRR = 40;
const TRAVEL = 1.6, KROT = .5 / TAU, SUN = 2.2, SOAK = 2.2, RAIN_D = 1.0, CLOUD_T = 2.8;
const KIND = [0, 1, 2, 2, 1, 0];                        // 0 sábana, 1 calzones, 2 camisa del tío
const SLOT = [0, 1, 2, 0, 1, 2];
const WID = [64, 46, 52];

/* ───────────── tiny drawing kit ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function cloudShape(x, y, s) {
  X.beginPath(); for (const [dx, dy, r] of [[-34, 6, 22], [-8, -8, 28], [22, -2, 25], [44, 8, 18], [0, 10, 24]]) { X.moveTo(x + (dx + r) * s, y + dy * s); X.arc(x + dx * s, y + dy * s, r * s, 0, TAU); }
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(300, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 300); X.restore();
}
function pill(x, y, label, col) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(330, X.measureText(t(label)).width + 24), h = 26;
  X.beginPath(); X.moveTo(x - 8, y + h / 2 - 2); X.lineTo(x, y + h / 2 + 9); X.lineTo(x + 8, y + h / 2 - 2); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - h / 2 + 3, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 15, INK, 'center', 320);
}
let CS = 5; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;   // cosmetic randomness only
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ───────────── characters ───────────── */
function calzon(x, y, s, rot, wet) {                    // the big bloomers: also the hen's hat
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(s, s);
  X.beginPath(); X.moveTo(-23, -18); X.lineTo(23, -18); X.quadraticCurveTo(28, 0, 24, 14); X.lineTo(10, 24); X.quadraticCurveTo(5, 8, 0, 5); X.quadraticCurveTo(-5, 8, -10, 24); X.lineTo(-24, 14); X.quadraticCurveTo(-28, 0, -23, -18); X.closePath(); ink(wet ? '#a9c3e6' : '#fff5ee', 3.5);
  X.fillStyle = wet ? '#6f8fc0' : '#ffd0dc'; for (const [a, b] of [[-12, -4], [8, -8], [14, 6], [-16, 8], [0, -12]]) { X.beginPath(); X.arc(a, b, 3.4, 0, TAU); X.fill(); }
  rr(-25, -22, 50, 9, 4); ink(wet ? '#7a9ccf' : '#ff8fb1', 3); X.restore();
}
function gallina(x, y, s, mood, T, cluck, hat, wetHat) {
  X.save(); X.translate(x, y); X.scale(s, s);
  const bob = mood === 'happy' ? -Math.abs(Math.sin(T * 12)) * 5 : Math.sin(T * 3) * 1.2, k = cluck;
  X.translate(0, bob);
  // tail feathers
  for (let i = 0; i < 3; i++) { const a = -2.5 + i * .34 + (mood === 'happy' ? Math.sin(T * 10 + i) * .12 : 0); X.save(); X.translate(-24, -30); X.rotate(a); el(0, -20, 8, 24); ink(['#e0453d', '#ff9a4d', '#ffd23f'][i], 3); X.restore(); }
  // legs + feet on the fence rail
  line([[-8, -6], [-8, 10]], 4, '#ffb23d'); line([[8, -6], [8, 10]], 4, '#ffb23d');
  line([[-8, 10], [-17, 12]], 3, '#ffb23d'); line([[8, 10], [17, 12]], 3, '#ffb23d');
  // body
  X.beginPath(); X.ellipse(0, -30, 34, 30, 0, 0, TAU); ink('#fff6e6', 4.5); X.save(); X.clip(); X.fillStyle = '#f3dcb4'; el(14, -16, 40, 28); X.fill(); X.restore();
  glint(-14, -46, 9, 5, -.5, .6);
  el(-14, -26, 14, 10, .4); ink(mood === 'sad' ? '#d8cfc0' : '#fff0d0', 3);   // wing
  // head
  X.beginPath(); X.arc(18, -58, 17, 0, TAU); ink('#fff6e6', 4.5);
  // comb
  for (const [a, b, r] of [[8, -76, 6], [16, -80, 7], [24, -76, 6]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink('#e0453d', 3); }
  // beak (opens when she clucks)
  const op = k > 0 ? 6 * Math.min(1, k * 4) : 0;
  X.beginPath(); X.moveTo(31, -62); X.lineTo(46, -58 - op * .4); X.lineTo(31, -57); X.closePath(); ink('#ffb23d', 2.8);
  X.beginPath(); X.moveTo(31, -57); X.lineTo(43, -54 + op); X.lineTo(31, -52); X.closePath(); ink('#ff9a4d', 2.8);
  el(30, -48, 4, 7); ink('#e0453d', 2.5);                                                // wattle
  // eye
  const blink = (T % 3.3) < .12;
  if (mood === 'happy') { line([[18, -62], [23, -66], [28, -62]], 3, INK); } else if (blink) line([[18, -62], [28, -62]], 3, INK);
  else { el(23, -62, 6, mood === 'sad' ? 5 : 7.5); ink('#fff', 2.5); X.fillStyle = INK; el(24.5 + (mood === 'worry' ? -2 : 0), -61, 2.8, 3.4); X.fill(); X.fillStyle = '#fff'; el(25, -63, 1.1, 1.1); X.fill(); }
  if (mood === 'sad') line([[14, -72], [28, -68]], 3, INK);
  if (mood === 'worry') { line([[15, -70], [29, -73]], 3, INK); }
  if (hat) calzon(14, -78, .95, -.18 + Math.sin(T * 2) * .03, wetHat);
  X.restore();
}
function abuela(x, y, s, mood, T, handL, handR, thumbs) {                                  // handL/handR: crank handle positions in world space (or null)
  X.save(); X.translate(x, y);
  const happy = mood === 'happy', sc = s, bob = happy ? -Math.abs(Math.sin(T * 9)) * 6 : Math.sin(T * 2.4) * 1.5;
  X.save(); X.scale(sc, sc);
  // arms first (behind the body)
  const sh = [[-26, -62 + bob], [26, -62 + bob]];
  const arm = (a, tgt, up) => { const ex = tgt ? (tgt[0] - x) / sc : a[0] + (up ? 20 : 0), ey = tgt ? (tgt[1] - y) / sc : a[1] + 40; line([a, [(a[0] + ex) / 2 + (a[0] < 0 ? -8 : 8), (a[1] + ey) / 2 + 10], [ex, ey]], 11, '#e8b48a'); X.beginPath(); X.arc(ex, ey, 9, 0, TAU); ink('#e8b48a', 3); return [ex, ey]; };
  arm(sh[0], handL, false);
  if (thumbs) { const ex = 52, ey = -108 + bob; line([sh[1], [46, -86 + bob], [ex, ey]], 11, '#e8b48a'); X.beginPath(); X.arc(ex, ey, 10, 0, TAU); ink('#e8b48a', 3); rr(ex - 4, ey - 24, 9, 18, 4); ink('#e8b48a', 3); }
  else arm(sh[1], handR, false);
  // legs and slippers
  rr(-20, -6, 16, 22, 6); ink('#e8b48a', 3); rr(4, -6, 16, 22, 6); ink('#e8b48a', 3);
  el(-14, 18, 15, 8); ink('#5b8fd9', 3); el(14, 18, 15, 8); ink('#5b8fd9', 3);
  // dress with flowers + apron
  X.beginPath(); X.moveTo(-26, -66 + bob); X.lineTo(26, -66 + bob); X.lineTo(36, 2); X.lineTo(-36, 2); X.closePath(); ink('#ff8fb1', 4.5);
  X.save(); X.clip(); X.fillStyle = 'rgba(180,40,90,.25)'; el(22, -30, 30, 60); X.fill(); X.fillStyle = '#fff'; for (const [a, b] of [[-18, -48], [4, -34], [-6, -12], [20, -50], [-24, -22], [18, -18]]) { X.beginPath(); X.arc(a, b + bob * .3, 4, 0, TAU); X.fill(); } X.restore();
  rr(-17, -48 + bob, 34, 46, 7); ink('#fff6e6', 3.5);
  // head
  el(0, -88 + bob, 25, 24); ink('#f1c49b', 4.5); glint(-9, -98 + bob, 7, 4, -.5, .5);
  el(0, -112 + bob, 19, 11); ink('#dfe0ea', 4); el(0, -126 + bob, 11, 9); ink('#dfe0ea', 3.5);    // grey hair and bun
  X.fillStyle = 'rgba(255,110,140,.5)'; el(-15, -80 + bob, 6, 4); X.fill(); el(15, -80 + bob, 6, 4); X.fill();
  const blink = (T % 3.7) < .12;
  for (const ex of [-9, 9]) { X.beginPath(); X.arc(ex, -90 + bob, 9, 0, TAU); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.fillStyle = 'rgba(190,230,255,.45)'; X.fill(); if (!blink) { X.fillStyle = INK; el(ex + (mood === 'worry' ? -1 : 0), -89 + bob, 2.6, 3.2); X.fill(); } }
  line([[-1, -90 + bob], [1, -90 + bob]], 2.5, INK);
  if (happy) { X.beginPath(); X.arc(0, -78 + bob, 8, .1, Math.PI - .1); ink('#fff', 2.5); } else if (mood === 'sad') line([[-6, -73 + bob], [0, -77 + bob], [6, -73 + bob]], 3, INK); else line([[-5, -76 + bob], [5, -76 + bob]], 3, INK);
  X.restore(); X.restore();
}
function crank(i, ang, T, glow, key) {
  const [cx, cy] = CR[i];
  rr(cx - 56, cy - 56, 112, 112, 14); ink('#b98042', 4); rr(cx - 50, cy - 50, 100, 100, 10); X.fillStyle = '#d9a86a'; X.fill();
  if (glow > 0) { X.strokeStyle = `rgba(255,255,255,${glow * .8})`; X.lineWidth = 4; X.setLineDash([8, 8]); X.beginPath(); X.arc(cx, cy, CRR + 12, ang * .5, ang * .5 + TAU); X.stroke(); X.setLineDash([]); }
  X.beginPath(); X.arc(cx, cy, CRR, 0, TAU); ink('#8f9cb3', 4);
  X.save(); X.translate(cx, cy); X.rotate(ang);
  for (let k = 0; k < 4; k++) { X.save(); X.rotate(k * TAU / 4); rr(-4, 0, 8, CRR - 3, 3); ink('#c9ced6', 2.5); X.restore(); }
  X.beginPath(); X.arc(0, 0, 9, 0, TAU); ink('#ffd23f', 3);
  X.beginPath(); X.arc(CRR - 8, 0, 8, 0, TAU); ink('#e0453d', 3);     // the handle
  X.restore(); glint(cx - 14, cy - 18, 9, 4, -.6, .45);
  // key caps under the crank
  const caps = i === 0 ? ['A', 'D'] : ['◄', '►'];
  for (let j = 0; j < 2; j++) { const kx = cx - 20 + j * 40, ky = cy + 70; rr(kx - 15, ky - 12, 30, 24, 6); ink(key[j] ? '#ffd23f' : '#fff6e6', 2.5); txt(caps[j], kx, ky + 1, 14, INK); }
}
/* garments hanging from the line: (x, y) is the peg point; d = dryness 0..1; sway in radians */
function garment(kind, x, y, d, T, sway, ph, t0) {
  const wet = 1 - d;
  X.save(); X.translate(x, y); X.rotate(Math.sin(T * 2.1 + ph) * sway * (1 - wet * .5));
  const drop = t0 > 0 && t0 < .35 ? (1 - t0 / .35) * -60 : 0; X.translate(0, drop);
  const sag = wet * 6;
  if (kind === 0) {                                                                   // sábana (striped bed sheet), flaps when dry
    const fl = Math.sin(T * 6 + ph) * 4 * (1 - wet);
    X.beginPath(); X.moveTo(-32, 4); X.lineTo(32, 4); X.lineTo(34 + fl, 40 + sag); X.quadraticCurveTo(18, 74 + sag + fl, 0, 70 + sag); X.quadraticCurveTo(-18, 76 + sag - fl, -34 - fl, 42 + sag); X.closePath();
    ink(wet > .5 ? '#8ea9d8' : '#bfe7ff', 4); X.save(); X.clip(); X.fillStyle = wet > .5 ? '#6f8fc0' : '#ffffff'; for (let i = -3; i < 4; i += 2) X.fillRect(i * 9 - 4, 0, 9, 90); X.fillStyle = 'rgba(40,60,120,.18)'; el(24, 40, 18, 50); X.fill(); X.restore();
    glint(-14, 20, 8, 4, -.5, .5);
  } else if (kind === 1) {                                                            // calzones
    calzon(0, 22 + sag * .4, 1.0, 0, wet > .5); if (wet > .5) { /* heavy */ }
  } else {                                                                            // camisa del tío: the vinotinto jersey, number 10
    X.beginPath(); X.moveTo(-14, 4); X.lineTo(-30, 14); X.lineTo(-38, 34 + sag); X.lineTo(-28, 38 + sag); X.lineTo(-22, 26); X.lineTo(-22, 62 + sag); X.lineTo(22, 62 + sag); X.lineTo(22, 26); X.lineTo(28, 38 + sag); X.lineTo(38, 34 + sag); X.lineTo(30, 14); X.lineTo(14, 4); X.quadraticCurveTo(0, 14, -14, 4); X.closePath();
    ink(wet > .5 ? '#5a3a6e' : '#a8203f', 4); X.save(); X.clip(); X.fillStyle = 'rgba(20,16,28,.22)'; el(24, 36, 14, 40); X.fill(); X.restore();
    txt('10', 0, 38 + sag, 20, '#fff'); glint(-12, 20, 6, 3, -.5, .4);
  }
  // pegs
  for (const px of kind === 1 ? [-14, 14] : [-20, 20]) { rr(px - 4, -5, 8, 16, 3); ink('#ffd23f', 2.5); }
  // drips when wet
  if (wet > .25) for (let i = 0; i < 3; i++) { const q = (T * 1.6 + i * .37 + ph) % 1; X.globalAlpha = (1 - q) * Math.min(1, wet * 1.5); el(-14 + i * 14, 52 + q * 36 + sag, 2.6, 4); ink('#9fe3ff', 1.5); X.globalAlpha = 1; }
  // dry sparkles
  if (d >= .995) { const q = (T * 1.3 + ph) % 1; X.globalAlpha = 1 - q; X.fillStyle = '#fff'; el(-10 + ph * 3 % 20, 20 - q * 12, 3, 3); X.fill(); X.globalAlpha = 1; }
  X.restore();
}

/* ───────────── baked scenes ───────────── */
const BAKE = {};
function mk(role, layer) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  if (layer === 'back') backLayer(role); else frontLayer(role);
  X = old; return cv;
}
function hillHouses(x0, x1, y0, seedc) {
  const cols = ['#ff8a7a', '#ffd166', '#6ec6ff', '#a0e07a', '#ff9de0', '#ffb347'];
  for (let i = 0, x = x0; x < x1; i++, x += 22 + (i * 7) % 12) { const hh = 18 + (i * 13 + seedc) % 22, y = y0 - (i % 3) * 7; rr(x, y - hh, 20, hh, 3); ink(cols[(i + seedc) % 6], 2.5, '#4a4f8f'); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x + 4, y - hh + 4, 5, 5); }
}
function backLayer(role) {
  // sky (the granny never sees it: the front layer's roof underside covers it)
  const sky = X.createLinearGradient(0, 0, 0, 312); sky.addColorStop(0, '#3fa8e8'); sky.addColorStop(.6, '#8fd8ff'); sky.addColorStop(1, '#e3f8ff'); X.fillStyle = sky; X.fillRect(0, 0, W, 312);
  // El Avila: far range with a snowless crest and barrio houses climbing it
  X.beginPath(); X.moveTo(0, 232); X.lineTo(0, 150); X.quadraticCurveTo(90, 100, 180, 140); X.quadraticCurveTo(260, 82, 360, 128); X.quadraticCurveTo(470, 70, 560, 120); X.quadraticCurveTo(660, 84, 760, 134); X.lineTo(800, 124); X.lineTo(800, 232); X.closePath(); ink('#a9b6f0', 3, '#5b5fa8');
  X.save(); X.clip(); X.fillStyle = '#8492e2'; X.beginPath(); X.moveTo(0, 170); X.quadraticCurveTo(130, 140, 260, 200); X.lineTo(260, 240); X.lineTo(0, 240); X.fill(); X.beginPath(); X.moveTo(500, 150); X.quadraticCurveTo(640, 130, 800, 190); X.lineTo(800, 240); X.lineTo(500, 240); X.fill(); X.restore();
  hillHouses(10, 190, 232, 0); hillHouses(610, 790, 232, 3);
  // distant tricolor bunting
  // the back fence (picket) at y 236..312
  X.fillStyle = '#e3a868'; X.fillRect(0, 252, W, 12); X.fillRect(0, 288, W, 10);
  for (let x = 0; x < W; x += 26) { X.beginPath(); X.moveTo(x, 316); X.lineTo(x, 246); X.lineTo(x + 11, 234); X.lineTo(x + 22, 246); X.lineTo(x + 22, 316); X.closePath(); ink('#f1be78', 3); X.fillStyle = 'rgba(160,100,40,.28)'; X.fillRect(x + 14, 246, 8, 70); }
  // the yard: warm concrete with tile joints and moss tufts
  const gr = X.createLinearGradient(0, 312, 0, H); gr.addColorStop(0, '#f0d2a2'); gr.addColorStop(1, '#d1a56d'); X.fillStyle = gr; X.fillRect(0, 312, W, H - 312);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 314); X.lineTo(W, 314); X.stroke();
  X.strokeStyle = 'rgba(130,80,30,.25)'; X.lineWidth = 2; for (let y = 360; y < H; y += 62) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); } for (let r = 0; r < 5; r++) for (let x = (r % 2) * 40; x < W; x += 80) { X.beginPath(); X.moveTo(x, 360 + r * 62); X.lineTo(x, 422 + r * 62); X.stroke(); }
  X.strokeStyle = '#3f8f35'; X.lineWidth = 3; for (const x of [40, 130, 700, 770, 610]) for (let j = -1; j <= 1; j++) { X.beginPath(); X.moveTo(x, 322); X.lineTo(x + j * 6, 310); X.stroke(); }
  // the house wall under the porch roof, with a door and a window
  rr(ROOF0 + 6, 300, ROOF1 - ROOF0 - 12, 190, 6); ink('#f7a99c', 4); X.save(); X.clip();
  X.strokeStyle = 'rgba(120,40,40,.22)'; X.lineWidth = 2; for (let y = 322; y < 490; y += 24) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); } for (let r = 0; r < 8; r++) for (let x = ROOF0 + (r % 2) * 24; x < ROOF1; x += 48) { X.beginPath(); X.moveTo(x, 322 + r * 24); X.lineTo(x, 346 + r * 24); X.stroke(); }
  X.fillStyle = 'rgba(20,16,28,.22)'; X.fillRect(ROOF0, 300, ROOF1 - ROOF0, 190); X.restore();
  rr(377, 392, 46, 98, 6); ink('#7a4a2a', 4); X.fillStyle = '#d9944f'; rr(383, 398, 34, 86, 4); X.fill();
  // the shade the porch throws on the floor
  X.fillStyle = 'rgba(40,30,60,.22)'; X.beginPath(); X.moveTo(ROOF0 - 12, 490); X.lineTo(ROOF1 + 12, 490); X.lineTo(ROOF1 + 40, 580); X.lineTo(ROOF0 - 40, 580); X.closePath(); X.fill();
  // flower pots (matas) and a little tricolor flag
  for (const [x, c] of [[90, '#d9633f'], [715, '#d9633f']]) { X.beginPath(); X.moveTo(x - 20, 500); X.lineTo(x + 20, 500); X.lineTo(x + 15, 540); X.lineTo(x - 15, 540); X.closePath(); ink(c, 3.5); for (let j = -1; j <= 1; j++) { X.beginPath(); X.ellipse(x + j * 14, 484 - Math.abs(j) * 8, 12, 17, j * .4, 0, TAU); ink('#3fb260', 3); } el(x, 478, 7, 7); ink('#ff4d6d', 2.5); }
}
function frontLayer(role) {
  if (role === 0) {                                                                  // the hen's view: the porch roof from above, then the hedge that hides the yard
    X.beginPath(); X.moveTo(ROOF0 - 30, 316); X.lineTo(ROOF0 + 20, 258); X.lineTo(ROOF1 - 20, 258); X.lineTo(ROOF1 + 30, 316); X.closePath(); ink('#9fb4c4', 4.5);
    X.save(); X.clip(); X.strokeStyle = '#7f95a8'; X.lineWidth = 3; for (let x = ROOF0 - 30; x < ROOF1 + 40; x += 22) { X.beginPath(); X.moveTo(x, 316); X.lineTo(x + 8, 258); X.stroke(); } X.fillStyle = 'rgba(255,255,255,.35)'; el(330, 270, 120, 6); X.fill(); X.fillStyle = 'rgba(150,80,40,.35)'; el(500, 290, 30, 8); X.fill(); X.restore();
    // the bougainvillea hedge
    X.beginPath(); X.moveTo(0, 336); for (let x = 0; x <= W; x += 40) X.quadraticCurveTo(x + 20, 312 + ((x / 40) % 2) * 14, x + 40, 336); X.lineTo(W, H); X.lineTo(0, H); X.closePath(); ink('#2f9a55', 4.5);
    X.save(); X.clip(); X.fillStyle = '#3fb260'; for (let i = 0; i < 70; i++) { const x = (i * 97) % 820, y = 330 + (i * 53) % 280; X.beginPath(); X.arc(x, y, 30 + (i % 3) * 8, 0, TAU); X.fill(); }
    X.fillStyle = '#2a8a4a'; for (let i = 0; i < 30; i++) { const x = (i * 131) % 820, y = 350 + (i * 71) % 250; el(x, y, 36, 10, .3); X.fill(); }
    for (let i = 0; i < 80; i++) { const x = (i * 71) % 800 + 10, y = 330 + (i * 37) % 260; X.fillStyle = ['#ff2d95', '#ff5ca8', '#d11a7a'][i % 3]; X.beginPath(); X.arc(x, y, 7, 0, TAU); X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.stroke(); X.fillStyle = 'rgba(255,255,255,.5)'; X.beginPath(); X.arc(x - 2, y - 2, 2, 0, TAU); X.fill(); }
    X.restore();
  } else {                                                                           // the granny's view: the underside of the zinc roof covers the whole sky
    X.fillStyle = '#7d8aa0'; X.fillRect(0, 0, W, 264);
    for (let x = 0; x < W; x += 40) { X.fillStyle = (x / 40) % 2 ? '#8896ad' : '#6f7c92'; X.fillRect(x, 0, 40, 264); }
    X.strokeStyle = INK; X.lineWidth = 3; for (let x = 0; x <= W; x += 40) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, 264); X.stroke(); }
    X.fillStyle = '#9a6a3a'; for (const y of [60, 168]) { X.fillRect(0, y, W, 16); X.strokeRect(0, y, W, 16); }
    X.fillStyle = 'rgba(160,80,30,.35)'; for (const [x, y] of [[140, 100], [520, 210], [690, 60], [300, 150]]) { el(x, y, 22, 8, .3); X.fill(); }
    X.fillStyle = 'rgba(255,240,170,.5)'; for (const x of [90, 610]) { X.fillRect(x, 0, 4, 264); }
    X.fillStyle = INK; X.fillRect(0, 264, W, 4); rr(-10, 262, W + 20, 14, 6); ink('#a7b3c4', 3.5);
    // the sheet-metal gutters
    X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(0, 276, W, 6);
  }
}

/* ───────────── the game ───────────── */
function duTendedero(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), hen = D.role === 0, TS = Math.sqrt(sp);
  /* the storm schedule (seeded, identical on both screens): 4 storms, sides L R L R in a random order */
  const flip = R() < .5 ? 1 : 0;
  const storms = [3.0, 5.4, 7.8, 10.6].map((t0, i) => ({ side: (i + flip) % 2, t0, id: i }));
  /* the tío hangs one more wet shirt on each line: the side of the LAST storm gets it so late that it can only finish drying
     if its owner takes it in for the storm and out again afterwards (a granny who guesses alone runs out of time) */
  const lastSide = storms[3].side, APPEAR = [0, 0, lastSide === 0 ? 7.9 : 5.2, 0, 0, lastSide === 1 ? 7.9 : 5.2];
  const gags = { cat: R() * 3, whale: R() < 1 / 8 };
  /* state */
  const kHeld = new Set(), pops = [], bits = [];
  const pos = [.3, .3], dry = [0, 0, -1, 0, 0, -1], tgt = [null, null], crA = [0, 0], appearT = [-9, -9, -9, -9, -9, -9];
  let grab = null, lastSt = '', stSent = -9, bell = [-9, -9], bellLbl = [0, 0], wasRain = [false, false], rainN = 0;
  let rep = [30, 30, 0, 0, -1, 0, 0, -1], repAt = -1;                              // the hen: the latest report from the granny
  let tapN = 0, tapAt = -9, ckAt = -9, ckSide = -1, soakAt = -9, doneAt = -9, flash = 0, resAt = -1, sentN = 0, fN = FOCUSN, lastSoak = 0;
  const u = () => g.c * TS;
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const rainOn = (side, uu) => storms.some(s => s.side === side && uu >= s.t0 && uu < s.t0 + RAIN_D);
  const itemX = (i, p) => { const side = i < 3 ? 0 : 1, s = SLOT[i]; return lerp(OUTC[side][s], INC[side][s], p); };
  const covered = (i, p) => { const x = itemX(i, p); return i < 3 ? x >= COVER[0] : x <= COVER[1]; };
  const allIn = (P, D2) => D2.every((d, i) => d >= .99 && covered(i, P[i < 3 ? 0 : 1]));
  function pop(s, x, y, size, bgc, fg) { pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); if (pops.length > 3) pops.shift(); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 600, r: 3 }, o)); }
  function sendCk(side) { D.send('ck', [side, ++sentN]); ckAt = g.c; ckSide = side; snd(side ? 880 : 660, .16, 'triangle', .07, 0, side ? 1100 : 880); pop(side ? 'RIGHT!' : 'LEFT!', 400 + (side ? 130 : -130), 190, 26, side ? '#2b9ee6' : '#e0453d', '#fff'); }
  function tap() {                                                                  // hen: a cluck; a short burst of two means the right side
    if (g.result) return; tapN++; tapAt = g.c; ckAt = g.c; snd(520 + cr() * 90, .08, 'square', .06, 0, 340); noise(.05, .04, 1400, 700, 'bandpass'); pop('CLOC!', 400 + (cr() - .5) * 80, 160, 22, '#ffb23d', '#fff');
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: hen ? 'CLUCK!' : 'REEL!', roleLabel: hen ? 'HEN' : 'GRANNY',
    hint: hen ? 'CLOUD ON THE LEFT? CLUCK ONCE. ON THE RIGHT? CLUCK TWICE (OR PRESS ◄ ►) - GRANNY CAN\'T SEE THE SKY!' : 'WHEN THE BELL RINGS REEL THAT LINE IN UNDER THE ROOF, THEN OUT AGAIN TO DRY (DRAG THE CRANKS, TAP THEM OR PRESS A D ◄ ►)',
    thint: hen ? 'TAP ONCE FOR A CLOUD ON THE LEFT, TWICE FOR THE RIGHT - GRANNY CAN\'T SEE THE SKY' : 'WHEN THE BELL RINGS TAP THAT CRANK TO REEL THE LAUNDRY IN, TAP AGAIN TO DRY IT',
    update(dt) {
      g.c += dt; const uu = u(), du = dt * TS;
      if (g.result && resAt < 0) resAt = g.c;
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); grab = null; }
      flash = Math.max(0, flash - dt);
      for (const s of storms) { if (!s.fl && uu >= s.t0) { s.fl = true; flash = .45; noise(1.0, .12, 260, 50, 'lowpass'); noise(.25, .09, 1800, 200, 'bandpass'); } }
      for (let i = 0; i < 6; i++) if (appearT[i] < -5 && uu >= APPEAR[i] && uu >= 0) { appearT[i] = g.c; if (APPEAR[i] > 0 && !hen) { snd(300, .2, 'square', .07, 0, 140); pop('MORE LAUNDRY!', i < 3 ? 160 : 640, 250, 20, '#a8203f', '#fff'); } }
      if (hen) {
        // clucks: a burst ends .32 s after the last tap; 1 = left, 2+ = right
        if (tapN && g.c - tapAt > .32 && !g.result) { sendCk(tapN >= 2 ? 1 : 0); tapN = 0; }
        let k = 0; for (const c of kHeld) { if (c === 'ArrowLeft' || c === 'KeyA') k |= 1; if (c === 'ArrowRight' || c === 'KeyD') k |= 2; }
        if (k && !g.result && g.c - ckAt > .45) { kHeld.clear(); sendCk(k & 2 ? 1 : 0); }
        if (!g.result) {
          if (repAt >= 0 && rep[0] >= 0 && uu >= Math.max(APPEAR[2], APPEAR[5]) && allIn([rep[0] / 100, rep[1] / 100], rep.slice(2).map(v => v < 0 ? -1 : v / 100)) && rep.slice(2).every(v => v >= 0)) g.finish('win');
          else if (g.c >= g.limit) g.finish('lose');
        }
      } else {
        // the granny: keys, auto-reel, and the physics of drying
        const kk = [0, 0]; for (const c of kHeld) { if (c === 'KeyD') kk[0]++; else if (c === 'KeyA') kk[0]--; else if (c === 'ArrowLeft') kk[1]++; else if (c === 'ArrowRight') kk[1]--; }
        for (let s = 0; s < 2; s++) {
          if (g.result) break;
          if (kk[s]) { tgt[s] = null; pos[s] = clamp(pos[s] + kk[s] * TRAVEL * du, 0, 1); crA[s] += kk[s] * TRAVEL * du * 9; }
          else if (tgt[s] !== null) { const d = tgt[s] - pos[s], m = TRAVEL * du; if (Math.abs(d) <= m) { pos[s] = tgt[s]; tgt[s] = null; } else { pos[s] += Math.sign(d) * m; crA[s] += Math.sign(d) * m * 9; } }
        }
        for (let i = 0; i < 6; i++) {
          const s = i < 3 ? 0 : 1; if (uu < APPEAR[i]) { dry[i] = -1; continue; } if (dry[i] < 0) dry[i] = 0;
          if (g.result) continue;
          const outside = !covered(i, pos[s]);
          if (outside && rainOn(s, uu)) { if (dry[i] > 0) { dry[i] = Math.max(0, dry[i] - SOAK * du); if (g.c - soakAt > .5) { soakAt = g.c; snd(180, .12, 'sine', .05, 0, 120); } } }
          else if (outside) dry[i] = Math.min(1, dry[i] + du / SUN);
        }
        for (let s = 0; s < 2; s++) { const r = rainOn(s, uu); if (r && !wasRain[s]) { rainN++; } wasRain[s] = r; }
        const st = [Math.round(pos[0] * 100), Math.round(pos[1] * 100), ...dry.map(d => d < 0 ? -1 : Math.round(d * 100))].join();
        if (st !== lastSt && g.c - stSent >= .1) { lastSt = st; stSent = g.c; D.send('st', st.split(',').map(Number), true); }
        if (!g.result && dry.every(d => d >= .99) && uu >= Math.max(APPEAR[2], APPEAR[5]) && allIn(pos, dry) && doneAt < 0) doneAt = g.c;
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) if (g.c - pops[i].t0 > 1.1) pops.splice(i, 1);
    },
    msg(type, d) {
      if (hen) { if (type === 'st' && Array.isArray(d) && d.length === 8) { rep = d; repAt = g.c; } }
      else if (type === 'ck' && Array.isArray(d)) {
        const side = d[1] === undefined ? 0 : d[0] ? 1 : 0; bell[side] = g.c; bellLbl[side] = d[1];
        snd(1318, .5, 'sine', .08); snd(1760, .35, 'sine', .05, .06); pop(side ? 'RIGHT!' : 'LEFT!', side ? 640 : 160, 296, 20, side ? '#2b9ee6' : '#e0453d', '#fff');
      }
    },
    draw() {
      const T = g.c, uu = u(), won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      X = ctx;
      const back = BAKE[hen ? 'b0' : 'b1'] || (BAKE[hen ? 'b0' : 'b1'] = mk(hen ? 0 : 1, 'back')), front = BAKE[hen ? 'f0' : 'f1'] || (BAKE[hen ? 'f0' : 'f1'] = mk(hen ? 0 : 1, 'front'));
      X.drawImage(back, 0, 0);
      const gloom = storms.reduce((m, s) => Math.max(m, clamp(1 - Math.abs(uu - (s.t0 + .6)) / 2.2, 0, 1)), 0);
      // wind: streamers on the fence & the cat gag (hen's view)
      if (hen) {
        // sun and clouds drifting in the background
        X.fillStyle = '#ffe14d'; el(730, 120, 30, 30); ink('#ffe14d', 4); glint(720, 110, 9, 6, -.4, .6);
        for (let i = 0; i < 3; i++) { const cx = (T * (5 + i * 3) + i * 300) % 1000 - 100, cy = 80 + i * 24; X.globalAlpha = 1 - gloom * .6; cloudShape(cx, cy, .8); ink('#e8f6ff', 3, '#9bb8e6'); X.globalAlpha = 1; }
        // the storm clouds
        for (const s of storms) {
          const k = (uu - (s.t0 - CLOUD_T)) / CLOUD_T; if (k < 0 || uu > s.t0 + RAIN_D + 1.6) continue;
          const tx = s.side ? 690 : 110, fx = s.side ? 960 : -160, leave = uu > s.t0 + RAIN_D ? ease((uu - s.t0 - RAIN_D) / 1.6) : 0;
          const x = lerp(fx, tx, ease(clamp(k, 0, 1))) + (s.side ? 1 : -1) * leave * 220, y = 138 + Math.sin(T * 1.4 + s.id) * 5, big = 1.35;
          X.save(); cloudShape(x, y, big); ink('#5a6b8e', 4.5, '#2b3350'); cloudShape(x - 6, y - 6, big * .8); X.fillStyle = '#7b8cb0'; X.fill();
          const raining = uu >= s.t0 && uu < s.t0 + RAIN_D;
          // angry face
          el(x - 14, y + 4, 6, raining ? 4 : 7); ink('#fff', 2.5); el(x + 14, y + 4, 6, raining ? 4 : 7); ink('#fff', 2.5); X.fillStyle = INK; el(x - 14 + (s.side ? -2 : 2), y + 5, 2.4, 3); X.fill(); el(x + 14 + (s.side ? -2 : 2), y + 5, 2.4, 3); X.fill();
          line([[x - 22, y - 8], [x - 8, y - 2]], 4, INK); line([[x + 22, y - 8], [x + 8, y - 2]], 4, INK);
          X.beginPath(); X.arc(x, y + 22, 9, Math.PI + .3, TAU - .3); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
          if (raining) { X.strokeStyle = 'rgba(190,215,255,.9)'; X.lineWidth = 3; X.beginPath(); for (let j = 0; j < 14; j++) { const rx = x - 70 + j * 11, ry = y + 34 + ((T * 520 + j * 63) % 170); X.moveTo(rx, ry); X.lineTo(rx - 5, ry + 16); } X.stroke(); }
          X.restore();
        }
        X.fillStyle = `rgba(30,40,80,${gloom * .32})`; X.fillRect(0, 0, W, 330);
        // the cat on the fence (background gag)
        { const cx = (T * 18 + gags.cat * 200) % 1000 - 100, cy = 236; X.save(); X.translate(cx, cy); el(0, -8, 17, 9); ink('#ffb26b', 3); el(15, -14, 8, 7); ink('#ffb26b', 3); X.beginPath(); X.moveTo(11, -20); X.lineTo(13, -28); X.lineTo(17, -21); X.closePath(); ink('#ffb26b', 2); X.beginPath(); X.moveTo(-17, -9); X.quadraticCurveTo(-30, -26 + Math.sin(T * 3) * 4, -24, -34); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#ffb26b'; X.stroke(); X.fillStyle = INK; el(18, -15, 1.6, 2); X.fill(); X.restore(); }
      }
      X.drawImage(front, 0, 0);
      // ─── the hen ───
      if (hen) {
        const ck = g.c - ckAt, mood = lost ? 'sad' : won ? 'happy' : (uu > 1 && storms.some(s => uu > s.t0 - CLOUD_T && uu < s.t0 + .5) ? 'worry' : 'idle');
        const flapK = won && rk >= 0 ? 1 : 0;
        gallina(400, 236, 1.5, mood, T, ck < .3 ? 1 - ck / .3 : 0, lost && rk > .5, true);
        if (flapK) for (let i = 0; i < 6; i++) { const q = (rk * 1.4 + i * .17) % 1; star(250 + i * 60, 200 - q * 60, 5 + q * 12, 2 + q * 3, 5, q * 6, ['#FFE14D', '#ff4d6d', '#4db8ff'][i % 3], 2); }
        if (T < 3.4) pill(400, 150, 'YOU', myCol());
        if (T < 4) pill(400, 322, 'YOUR FRIEND', pCol());
        // cluck counter: a pending burst shows how many she has clucked
        if (tapN > 0) { badge(tapN >= 2 ? 'RIGHT!' : 'LEFT!', 400, 120, 22, tapN >= 2 ? '#2b9ee6' : '#e0453d', '#fff', 1, 0); }
        // the cloud timeline strip (below the HUD): one icon per storm, the next one glows
        const nxt = storms.findIndex(s => uu < s.t0 + RAIN_D);
        for (let i = 0; i < 4; i++) {
          const s = storms[i], x = 330 + i * 46, y = 82, done = i < nxt || nxt < 0;
          X.globalAlpha = done ? .35 : 1; cloudShape(x, y, .33 + (i === nxt ? .05 * Math.sin(T * 6) : 0)); ink(i === nxt ? '#ffd23f' : '#aab8d8', 2.5, '#2b3350'); txt(s.side ? '►' : '◄', x, y + 17, 15, '#fff'); X.globalAlpha = 1;
        }
      } else {
        // ─── the granny: lines, cranks, garments, rain, bells ───
        const wind = Math.max(.04, gloom * .14);
        for (let s = 0; s < 2; s++) {                                              // the two clotheslines + pulleys
          const x0 = s ? 780 : 20, x1 = s ? 405 : 395;
          line([[x0, LY - 4], [x1, LY]], 3, '#e8e2d0');
          X.beginPath(); X.arc(x1, LY, 8, 0, TAU); ink('#c9ced6', 3);
          line([[x1, LY + 6], [CR[s][0] + (s ? 6 : -6), CR[s][1] - 56]], 3, '#e6c58c');     // the rope down to the crank
          X.fillStyle = '#8a5a34'; rr(x0 - (s ? 0 : 10), LY - 14, 10, 160, 4); ink('#8a5a34', 3);
        }
        // rain beyond the porch edges (drops stop at the zinc edge)
        for (let s = 0; s < 2; s++) if (rainOn(s, uu)) {
          const xa = s ? ROOF1 : 0, xb = s ? W : ROOF0; X.strokeStyle = 'rgba(190,215,255,.85)'; X.lineWidth = 3; X.beginPath();
          for (let j = 0; j < 26; j++) { const rx = xa + ((j * 53 + 11) % (xb - xa)), ry = 270 + ((T * 560 + j * 97) % 330); X.moveTo(rx, ry); X.lineTo(rx - 6, ry + 18); } X.stroke();
          X.fillStyle = 'rgba(80,100,150,.14)'; X.fillRect(xa, 266, xb - xa, 334);
          for (let j = 0; j < 8; j++) { const rx = xa + ((j * 71) % (xb - xa)), q = (T * 4 + j * .31) % 1; X.globalAlpha = 1 - q; el(rx, 590, 8 + q * 10, 3 + q * 3); X.strokeStyle = '#d8ecff'; X.lineWidth = 2; X.stroke(); X.globalAlpha = 1; }
        }
        for (let i = 0; i < 6; i++) {
          if (dry[i] < 0 && !(appearT[i] > -5)) continue;
          const s = i < 3 ? 0 : 1, x = itemX(i, pos[s]), t0 = g.c - appearT[i], d = Math.max(0, dry[i]);
          garment(KIND[i], x, LY + 2, d, T, wind, i * 1.7, APPEAR[i] > 0 ? t0 : 0);
        }
        // the roof's front rail with a bunting of tricolor flags (drawn over the clothes edge)
        const cols = ['#ffd23f', '#2b6fd6', '#e0453d']; for (let i = 0; i < 14; i++) { const x = 230 + i * 26, y = 300 + Math.sin(i * .8) * 4; X.beginPath(); X.moveTo(x - 9, y); X.lineTo(x + 9, y); X.lineTo(x, y + 16); X.closePath(); ink(cols[i % 3], 2); }
        // bells hanging from the roof: they swing and ring when the hen warns
        for (let s = 0; s < 2; s++) {
          const bx = s ? 690 : 110, by = 170, ba = g.c - bell[s], sw = ba < 2.2 ? Math.sin(ba * 22) * (1 - ba / 2.2) * .5 : 0;
          line([[bx, 0], [bx, by - 26]], 3, '#e6c58c');
          X.save(); X.translate(bx, by - 26); X.rotate(sw); X.beginPath(); X.moveTo(-22, 40); X.quadraticCurveTo(-20, 8, 0, 6); X.quadraticCurveTo(20, 8, 22, 40); X.closePath(); ink('#ffd23f', 4); glint(-8, 22, 4, 9, .2, .6); el(0, 44, 6, 6); ink('#b8860b', 2.5); X.restore();
          if (ba < 2.4) { for (let r = 0; r < 2; r++) { const q = (ba * 1.8 + r * .5) % 1; X.globalAlpha = (1 - q) * .8; X.strokeStyle = '#fff'; X.lineWidth = 3; X.beginPath(); X.arc(bx, by + 10, 34 + q * 34, 0, TAU); X.stroke(); X.globalAlpha = 1; }
            badge(s ? '►' : '◄', bx, by + 70, 30, s ? '#2b9ee6' : '#e0453d', '#fff', outBack(ba / .15), 0); }
        }
        // cranks and the granny between them
        const h0 = [CR[0][0] + Math.cos(crA[0]) * (CRR - 8), CR[0][1] + Math.sin(crA[0]) * (CRR - 8)], h1 = [CR[1][0] + Math.cos(crA[1]) * (CRR - 8), CR[1][1] + Math.sin(crA[1]) * (CRR - 8)];
        const mood = lost ? 'sad' : won ? 'happy' : (rainOn(0, uu) || rainOn(1, uu)) ? 'worry' : 'idle';
        crank(0, crA[0], T, grab && grab.i === 0 ? 1 : (T < 4 ? .6 + .4 * Math.sin(T * 6) : 0), [kHeld.has('KeyA'), kHeld.has('KeyD')]);
        crank(1, crA[1], T, grab && grab.i === 1 ? 1 : (T < 4 ? .6 + .4 * Math.sin(T * 6) : 0), [kHeld.has('ArrowLeft'), kHeld.has('ArrowRight')]);
        abuela(400, 520, 1.15, mood, T, won ? null : h0, won ? null : h1, won && rk > .1);
        if (T < 3.6) pill(400, 380, 'YOU', myCol());
        // lightning flash reaches her only as a flicker of the zinc
        if (flash > 0) { X.fillStyle = `rgba(255,255,255,${flash * .35})`; X.fillRect(0, 0, W, H); }
      }
      // ─── win / lose payoffs ───
      if (won && rk >= 0 && rk < 3) {
        if (!hen) {                                                               // sábanas flap in a fan of sparkles
          for (let i = 0; i < 8; i++) { const q = (rk * 1.3 + i * .13) % 1, a = i * 1.1; star(160 + (i % 4) * 160, 380 - q * 80, 6 + q * 14, 3 + q * 4, 6, a + q * 3, ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A'][i % 4], 0); }
          badge('DRY!', 400, 200, 52, '#3fb260', '#fff', outBack((rk - .1) / .25) * (rk > 1.8 ? Math.max(0, 1 - (rk - 1.8) * 4) : 1), -.05);
        } else badge('LAUNDRY SAVED!', 400, 180, 46, '#3fb260', '#fff', outBack((rk - .1) / .25) * (rk > 1.8 ? Math.max(0, 1 - (rk - 1.8) * 4) : 1), -.05);
      }
      if (lost && rk >= 0) {
        if (hen) badge('SOAKED!', 400, 120, 44, '#5a78b8', '#fff', outBack((rk - .5) / .25), .05);
        else { for (let i = 0; i < 5; i++) { const q = (rk * 1.6 + i * .2) % 1; el(240 + i * 80, 340 + q * 160, 4, 7); ink('#9fe3ff', 1.5); } badge('SOAKED!', 400, 190, 46, '#5a78b8', '#fff', outBack((rk - .1) / .25), .05); }
      }
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, clamp(q.x, 120, 680), Math.max(100, q.y - Math.min(a, .6) * 14), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(hen ? 'CLOUDS COMING? TELL GRANNY!' : 'LISTEN FOR THE BELL!', 400, 214, 19, hen ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
      vignette(.2);
    },
    down(p) {
      if (hen) { tap(); return; }
      let bi = -1, bd = 1e9; for (let i = 0; i < 2; i++) { const d = Math.hypot(p.x - CR[i][0], p.y - CR[i][1]); if (d < bd) { bd = d; bi = i; } }
      if (bd < 90) grab = { i: bi, a: Math.atan2(p.y - CR[bi][1], p.x - CR[bi][0]), moved: 0, at: g.c };
      else { const s = p.x < 400 ? 0 : 1; grab = { i: s, a: null, moved: 0, at: g.c, x: p.x, line: true }; }
    },
    move(p) {
      if (hen || !grab || g.result) return;
      if (grab.line) { const dx = (p.x - grab.x) * (grab.i ? -1 : 1); grab.x = p.x; grab.moved += Math.abs(dx); pos[grab.i] = clamp(pos[grab.i] + dx / 190, 0, 1); tgt[grab.i] = null; return; }
      const ang = Math.atan2(p.y - CR[grab.i][1], p.x - CR[grab.i][0]); if (Math.hypot(p.x - CR[grab.i][0], p.y - CR[grab.i][1]) < 14) return;
      const d = wrap(ang - grab.a); grab.a = ang; grab.moved += Math.abs(d); tgt[grab.i] = null;
      pos[grab.i] = clamp(pos[grab.i] + d * KROT, 0, 1); crA[grab.i] += d;
    },
    up() {
      if (grab && !hen && !g.result && grab.moved < .35 && g.c - grab.at < .45 && !grab.line) { const i = grab.i; tgt[i] = pos[i] > .5 ? 0 : 1; }   // a tap sends the whole line the other way
      grab = null;
    },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (hen && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'ArrowDown')) { if (!e.repeat) tap(); return; }
      kHeld.add(e.code);
    },
    keyup(e) { kHeld.delete(e.code); },
  };
  g.dbg = {
    LY, CR, COVER,
    /* what the HEN's screen shows: the clouds, with the side they come from, how far they are from raining, and whether it rains already */
    sky: () => ({ u: u(), clouds: storms.filter(s => u() >= s.t0 - CLOUD_T && u() < s.t0 + RAIN_D + .2).map(s => ({ side: s.side, eta: s.t0 - u(), id: s.id })) }),
    /* what the GRANNY's screen shows: both lines, how wet each garment looks, whether it rains on each side right now, her bells */
    view: () => ({ u: u(), pos: pos.slice(), d: dry.slice(), rain: [rainOn(0, u()), rainOn(1, u())], bell: bell.slice(), c: g.c, covered: dry.map((d, i) => covered(i, pos[i < 3 ? 0 : 1])), tgt: tgt.slice() }),
    truth: () => ({ storms, pos, dry }),
  };
  wire(g, D, 0, sp, 'du_tendedero');
  return g;
}
reg('du_tendedero', duTendedero, 'AGUACERO'); REGMAP.du_tendedero.duo = true;

/* ───────────── intro cards (520×240), 4 s loops ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4, ph = u / 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  const sky = X.createLinearGradient(0, 0, 0, 240); sky.addColorStop(0, role === 0 ? '#5a6b9a' : '#3fa8e8'); sky.addColorStop(1, '#e3f8ff'); X.fillStyle = sky; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#f0d2a2'; X.fillRect(0, 150, 520, 90); X.fillStyle = INK; X.fillRect(0, 148, 520, 4);
  X.fillStyle = '#e3a868'; X.fillRect(0, 118, 520, 32);
  if (role === 0) {
    const cx = lerp(-40, 120, ease(clamp(ph * 1.6, 0, 1)));
    X.save(); cloudShape(cx, 56, 1.2); ink('#6f82ac', 4, '#2b3350'); el(cx - 12, 60, 5, 6); ink('#fff', 2); el(cx + 12, 60, 5, 6); ink('#fff', 2); line([[cx - 20, 48], [cx - 6, 54]], 3, INK); line([[cx + 20, 48], [cx + 6, 54]], 3, INK); X.restore();
    gallina(300, 128, 1.2, 'worry', tt, ph > .45 && ph < .7 ? .8 : 0, false, false);
    DUO.demoFinger(300, 160, ph > .4 && ph < .55, ((ph - .4) / .15));
    badge('LEFT!', 300, 30, 18, '#e0453d', '#fff', ph > .5 ? 1 : 0, -.03);
    badge('CLUCK!', 400, 205, 18, '#c98a12', '#fff', 1, -.03);
  } else {
    X.fillStyle = '#8896ad'; X.fillRect(0, 0, 520, 40); X.fillStyle = INK; X.fillRect(0, 38, 520, 4);
    line([[20, 100], [260, 104]], 3, '#e8e2d0');
    const p = ph < .45 ? ease(ph / .35) : 1 - ease((ph - .6) / .35), pp = clamp(p, 0, 1);
    for (let i = 0; i < 3; i++) garment([0, 1, 2][i], lerp(60 + i * 56, 140 + i * 56, pp), 106, ph > .55 ? clamp((ph - .55) * 3, 0, 1) : .3, tt, .05, i, 0);
    crank(0, ph * TAU * 2, tt, 0, [false, false]);
    abuela(400, 215, .8, 'idle', tt, null, null, false);
    const bellK = ph > .15 && ph < .5; const bx = 460, ba = ph - .15;
    X.save(); X.translate(bx, 62); X.rotate(bellK ? Math.sin(ba * 90) * .4 : 0); X.beginPath(); X.moveTo(-14, 26); X.quadraticCurveTo(-12, 4, 0, 2); X.quadraticCurveTo(12, 4, 14, 26); X.closePath(); ink('#ffd23f', 3); X.restore();
    DUO.demoFinger(CR[0][0] * .5 + 70, 190, ph > .1 && ph < .5, 0);
    badge('REEL!', 120, 24, 18, '#2b9ee6', '#fff', 1, -.03);
  }
  X.restore();
}
DUO.INFO.du_tendedero = [['HEN', 'TELL GRANNY WHERE THE RAIN COMES FROM', 'CLUCK ONCE = LEFT, TWICE = RIGHT'], ['GRANNY', 'REEL THE LAUNDRY IN BEFORE THE RAIN', 'DRAG A CRANK IN CIRCLES, TAP IT OR PRESS A D ◄ ►']];
DUO.DEMOS.du_tendedero = [t => demo(0, t), t => demo(1, t)];

})();
