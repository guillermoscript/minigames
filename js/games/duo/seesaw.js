'use strict';
/* ═════════ DUO · EGG DELIVERY (du_seesaw) ═════════
   Two Caoses carry a giant sleeping egg on a plank along a windy mountain path, to its mama goose's nest.
   LEFT CARRIER (role 0, JUDGE) and RIGHT CARRIER (role 1) each hold one end and can only LIFT it (mouse up / drag a thumb up / ▲ ▼):
   the egg rolls away from a raised end. While the egg sleeps on the cushion in the middle of the plank, the two walk on; off the
   cushion they stop. A puffy wind cloud blows the egg toward one end or the other: it shows up on the side it will blow FROM about
   a second before the gust (it inflates its cheeks, trees bend, an arrow points the way), the gust ramps up and down, and there are
   calm spells. A gust that pushes the egg toward YOUR end is yours to fix, so one carrier alone can never get there.
   The egg reaching an end = WHOA: it bonks that carrier in the face and hops back on the plank (a plaster, a few steps lost; more if bonks keep coming).
   Walk NEED seconds with the egg on the cushion = the nest: it hatches. Time out = the egg rolls off and a grumpy chick pops out.
   Netcode: each carrier owns its end and sends 'h' (0..100, coalesced, <= 10/s); the other screen eases toward the latest value.
   The JUDGE simulates the egg with its own end and that partner value and sends 'st' [s, v, progress, hop] (x1000, coalesced, 10/s),
   'sc' {d, p} on a bonk. The other screen runs the same (heavily damped, first-order) egg physics locally with its OWN end
   immediate, so its own lifting moves the egg at once, and pulls that prediction softly toward the judge's latest state
   (extrapolated by its speed). Bonks and the verdict come only from the judge. The wind is a pure function of the seed + the clock. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right LEAVE and y>552) ───────────── */
const GY = 505, LX = 168, RX = 632, PU = 6.4;          // the carriers' feet, their x, caos() unit
const Y0 = 402, LIFT = 78, PT = 14;                    // plank end height at rest / fully lifted, plank thickness
const TRK = 190, ERX = 36, ERY = 45, CUSH = 9;         // the egg rolls x = 400 ± TRK; egg radii; cushion thickness
const YT = 170, YB = 400;                              // the lift gauge: pointer y YB = resting, YT = fully lifted (kept high: the nest arrives under it)
const ZONE = .45, G = 2, KU = .45, HOP = .42, PEN = 1.2, PENW = 5, NEED = 6.5, RAMP = .55, WARN = .95;
const NX = 744, SCROLL = 380;                          // where the nest sits when you get there; how far the path scrolls
const endY = h => Y0 - LIFT * h;
const SIDEX = [LX, RX];

/* palette */
const SHELL = '#fff3dc', SHELL2 = '#e9cf9f', SHELLL = '#ffffff', SPECK = '#c99a62';
const WOOD = '#d9944f', WOOD2 = '#a5622c';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
/* cel shading with a shifted copy of the same shape: base on top, the shade shows as a crescent on the (sx, sy) side */
function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function glint(p, x, y, rx, ry, col, rot = 0) { X.save(); X.clip(p); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
function pill(x, y, label, col, up) {                // a name tag with a little pointer (down, or up), e.g. YOU / YOUR FRIEND
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
/* a word on a chunky coloured badge (feedback that stays readable over any background) */
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(236, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 236);
  X.restore();
}
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function zee(x, y, s, a) {                             // a sleepy "Z" (drawn, not text)
  X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
  X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke();
  X.restore();
}
function bang(x, y, s, col) {                          // a "!" bubble over a carrier's head
  X.save(); X.translate(x, y); X.scale(s, s);
  X.beginPath(); X.moveTo(-6, 16); X.lineTo(0, 26); X.lineTo(6, 16); X.closePath(); ink('#fff', 3);
  X.beginPath(); X.arc(0, 0, 19, 0, TAU); ink('#fff', 3.5);
  rr(-3.5, -12, 7, 15, 3); X.fillStyle = col || '#ff4d5e'; X.fill(); X.beginPath(); X.arc(0, 9, 3.8, 0, TAU); X.fill();
  X.restore();
}
/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave an end stuck going up */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ───────────── the egg (centre x, y; rot; mood: sleep / awake / scared / dizzy / happy) ───────────── */
const EGGP = `M0 ${-ERY} C${ERX * .78} ${-ERY} ${ERX} ${-ERY * .18} ${ERX} ${ERY * .2} C${ERX} ${ERY * .72} ${ERX * .56} ${ERY} 0 ${ERY} C${-ERX * .56} ${ERY} ${-ERX} ${ERY * .72} ${-ERX} ${ERY * .2} C${-ERX} ${-ERY * .18} ${-ERX * .78} ${-ERY} 0 ${-ERY} Z`;
function plaster(x, y, rot) {
  X.save(); X.translate(x, y); X.rotate(rot);
  for (const a of [.7, -.7]) { X.save(); X.rotate(a); rr(-13, -4.5, 26, 9, 4); ink('#ffcf9e', 2); X.fillStyle = '#f2b27a'; X.fillRect(-4, -3, 8, 6); X.restore(); }
  X.restore();
}
function egg(x, y, rot, o) {
  const mood = o.mood || 'awake', T = o.t || 0, sq = o.sq || 0, lk = o.look || [0, 0];
  X.save(); X.translate(x, y); X.rotate(rot); X.translate(0, ERY); X.scale(1 + sq * .12, 1 - sq * .12); X.translate(0, -ERY);
  const p = P(EGGP);
  cel(p, SHELL, SHELL2, -8, 7, 4.5);
  X.save(); X.clip(p); X.fillStyle = SPECK; for (const [a, b, r] of [[-20, -26, 4], [16, -32, 3], [24, 6, 4.5], [-26, 18, 3.5], [8, 30, 3], [-6, -38, 2.5]]) { el(a, b, r, r * .8, a); X.fill(); } X.restore();
  glint(p, -15, -24, 9, 15, SHELLL, .45);
  for (let i = 0; i < (o.plasters || 0) && i < 3; i++) plaster([18, -22, 2][i], [-24, -14, -36][i], [.3, -.4, .1][i]);
  // the face
  const fy = 4, ex = 12;
  X.strokeStyle = INK; X.lineCap = 'round'; X.lineJoin = 'round';
  if (mood === 'sleep' || mood === 'happy') {
    X.lineWidth = 3.6;
    for (const sx of [-1, 1]) { X.beginPath(); if (mood === 'sleep') { X.moveTo(sx * ex - 7, fy); X.quadraticCurveTo(sx * ex, fy + 6, sx * ex + 7, fy); } else { X.moveTo(sx * ex - 7, fy + 2); X.quadraticCurveTo(sx * ex, fy - 7, sx * ex + 7, fy + 2); } X.stroke(); }
    X.fillStyle = 'rgba(255,130,150,.55)'; el(-23, fy + 12, 7, 4); X.fill(); el(23, fy + 12, 7, 4); X.fill();
    X.lineWidth = 3; X.beginPath(); if (mood === 'sleep') { X.arc(0, fy + 15, 3.4, 0, TAU); X.stroke(); } else { X.moveTo(-7, fy + 12); X.quadraticCurveTo(0, fy + 21, 7, fy + 12); X.stroke(); }
  } else if (mood === 'dizzy') {
    X.lineWidth = 2.6; for (const sx of [-1, 1]) { X.beginPath(); for (let i = 0; i < 16; i++) { const a = i * .8 + T * 14 * sx, r = i * .55; X.lineTo(sx * ex + Math.cos(a) * r, fy + Math.sin(a) * r); } X.stroke(); }
    X.lineWidth = 3; X.beginPath(); X.moveTo(-8, fy + 17); for (let i = 1; i <= 4; i++) X.lineTo(-8 + i * 4, fy + 17 + (i % 2 ? -3 : 0)); X.stroke();
  } else {
    const big = mood === 'scared', r = big ? 9.5 : 7.5;
    for (const sx of [-1, 1]) { el(sx * ex, fy - (big ? 2 : 0), r, r + 1.5); ink('#fff', 2.2); X.fillStyle = INK; el(sx * ex + lk[0] * (big ? 3.5 : 2.5), fy - (big ? 2 : 0) + lk[1] * 2.5, big ? 3.2 : 4, big ? 3.6 : 4.6); X.fill(); X.fillStyle = '#fff'; el(sx * ex + lk[0] * 2.5 - 1.5, fy - 2.5, 1.5, 1.5); X.fill(); }
    X.lineWidth = 3;
    if (big) { el(0, fy + 19, 6, 7.5); ink('#7a2236', 2); for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * ex - 8 * sx, fy - 15); X.lineTo(sx * ex + 7 * sx, fy - 19); X.lineWidth = 3; X.stroke(); } }
    else { X.beginPath(); X.moveTo(-5, fy + 16); X.quadraticCurveTo(0, fy + 13, 5, fy + 16); X.stroke(); }
  }
  X.restore();
  if (mood === 'scared') { X.globalAlpha = .9; const d = (T * 50) % 22; el(x + 34, y - 30 + d, 4.5, 6.5); ink('#9fe3ff', 2); X.globalAlpha = 1; }
}
/* the chick that hatches (win: happy, with the shell top as a hat) or pops out grumpy (lose) */
function chick(x, y, s, mood, T, shades) {
  X.save(); X.translate(x, y); X.scale(s, s);
  for (const sx of [-1, 1]) { X.save(); X.translate(sx * 20, -8); X.rotate(sx * (.6 + Math.sin(T * (mood === 'mad' ? 30 : 18)) * .4)); el(sx * 8, 0, 11, 6); ink('#ffd23f', 3); X.restore(); }
  X.beginPath(); X.arc(0, -16, 22, 0, TAU); ink('#ffe14d', 3.5);
  X.fillStyle = '#fff6a8'; el(-8, -26, 7, 4.5, -.5); X.fill();
  X.beginPath(); X.moveTo(-6, -10); X.lineTo(6, -10); X.lineTo(0, 0); X.closePath(); ink('#ff9a1c', 2.2);
  X.strokeStyle = INK; X.lineWidth = 3.2; X.lineCap = 'round';
  if (mood === 'mad') {
    for (const sx of [-1, 1]) { X.fillStyle = INK; el(sx * 8, -18, 3, 3.5); X.fill(); X.beginPath(); X.moveTo(sx * 14, -28); X.lineTo(sx * 3, -22); X.stroke(); }
    X.fillStyle = 'rgba(255,90,90,.45)'; el(-14, -8, 5, 3); X.fill(); el(14, -8, 5, 3); X.fill();
  } else {
    for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 8 - 5, -17); X.quadraticCurveTo(sx * 8, -24, sx * 8 + 5, -17); X.stroke(); }
    X.fillStyle = 'rgba(255,130,150,.6)'; el(-14, -9, 5, 3); X.fill(); el(14, -9, 5, 3); X.fill();
  }
  if (shades) { X.lineWidth = 3; X.strokeStyle = INK; X.beginPath(); X.moveTo(-20, -21); X.lineTo(20, -21); X.stroke(); for (const sx of [-1, 1]) { rr(sx * 9 - 8, -24, 16, 10, 4); ink('#2b2b3a', 2); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(sx * 9 - 5, -22, 4, 2.5); } }
  X.restore();
}
/* the bottom half of the shell (zigzag top), centre x, bottom y */
function shellCup(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s);
  X.beginPath(); X.moveTo(-ERX + 1, -26); for (let i = 0; i <= 8; i++) X.lineTo(-ERX + 1 + i * (ERX * 2 - 2) / 8, -26 + (i % 2 ? -9 : 0));
  X.bezierCurveTo(ERX, 10, ERX * .56, 0, 0, 0); X.bezierCurveTo(-ERX * .56, 0, -ERX, 10, -ERX + 1, -26); X.closePath();
  X.save(); X.translate(0, 0); X.restore();
  ink(SHELL, 4); X.fillStyle = SHELL2; X.beginPath(); X.ellipse(0, -6, ERX * .7, 6, 0, 0, Math.PI); X.fill();
  X.fillStyle = SPECK; el(-14, -14, 3.5, 3); X.fill(); el(16, -8, 3, 2.4); X.fill();
  X.restore();
}
function shellTop(x, y, s, rot) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  X.beginPath(); X.moveTo(-ERX * .86, 0); for (let i = 0; i <= 8; i++) X.lineTo(-ERX * .86 + i * ERX * 1.72 / 8, (i % 2 ? -8 : 0));
  X.bezierCurveTo(ERX * .8, -26, ERX * .5, -36, 0, -36); X.bezierCurveTo(-ERX * .5, -36, -ERX * .8, -26, -ERX * .86, 0); X.closePath();
  ink(SHELL, 3.5); X.fillStyle = SHELLL; el(-10, -24, 6, 4, -.4); X.fill(); X.fillStyle = SPECK; el(10, -22, 3, 2.4); X.fill();
  X.restore();
}

/* ───────────── a carrier: caos() with noodle arms up to its end of the plank and a face that reacts ───────────── */
function face(x, y, u, col, mood, lk) {
  const ey = y - 6.2 * u;
  X.fillStyle = col; for (const sx of [-1, 1]) X.fillRect(x + sx * 2.8 * u - 1.05 * u, ey - 1.5 * u, 2.1 * u, 3.1 * u);
  X.strokeStyle = INK; X.fillStyle = INK; X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = Math.max(2, u * .55);
  for (const sx of [-1, 1]) {
    const e = x + sx * 2.8 * u;
    if (mood === 'strain') { X.beginPath(); X.moveTo(e - sx * .9 * u, ey - .9 * u); X.lineTo(e + sx * .7 * u, ey); X.lineTo(e - sx * .9 * u, ey + .9 * u); X.stroke(); }
    else if (mood === 'scared') { el(e, ey, u * 1.0, u * 1.25); ink('#fff', Math.max(1.5, u * .3)); X.fillStyle = INK; el(e + lk[0] * u * .35, ey + lk[1] * u * .3, u * .38, u * .45); X.fill(); }
    else if (mood === 'dizzy') { X.lineWidth = Math.max(1.6, u * .3); X.beginPath(); for (let i = 0; i < 12; i++) { const a = i * .9 + now * 12 * sx, r = i * u * .08; X.lineTo(e + Math.cos(a) * r, ey + Math.sin(a) * r); } X.stroke(); X.lineWidth = Math.max(2, u * .55); }
    else X.fillRect(e - .6 * u + lk[0] * .45 * u, ey - 1.2 * u + lk[1] * .3 * u, 1.2 * u, 2.4 * u);
  }
  if (mood === 'strain') { X.fillStyle = 'rgba(255,80,80,.45)'; el(x - 4.6 * u, y - 4.3 * u, u * .9, u * .5); X.fill(); el(x + 4.6 * u, y - 4.3 * u, u * .9, u * .5); X.fill(); X.fillStyle = '#fff'; rr(x - 1.6 * u, y - 4.2 * u, 3.2 * u, 1.2 * u, u * .3); ink('#fff', Math.max(1.5, u * .25)); X.strokeStyle = INK; X.lineWidth = Math.max(1, u * .2); X.beginPath(); X.moveTo(x - 1.6 * u, y - 3.6 * u); X.lineTo(x + 1.6 * u, y - 3.6 * u); X.stroke(); }
  else if (mood === 'scared') { el(x, y - 3.6 * u, u * .7, u * .85); ink('#7a2236', Math.max(1.5, u * .3)); }
}
/* noodle arms from caos()'s side stubs up to the plank end (hx, hy), drawn before the body; hands are drawn after the plank */
function noodleArms(x, y, u, hx, hy, col, wob) {
  const ol = Math.max(3, u * .5), aw = 1.25 * u;
  for (const sx of [-1, 1]) {
    const x0 = x + sx * 7 * u, y0 = y - 5.4 * u, x1 = hx + sx * 2.6 * u, y1 = hy + 1.2 * u, mx = (x0 + x1) / 2 + sx * (10 + wob * 6), my = (y0 + y1) / 2;
    X.lineCap = 'round'; X.beginPath(); X.moveTo(x0, y0); X.quadraticCurveTo(mx + Math.sin(now * 40 + sx) * wob * 3, my, x1, y1);
    X.lineWidth = aw + ol * 2; X.strokeStyle = INK; X.stroke(); X.lineWidth = aw; X.strokeStyle = col; X.stroke();
  }
}
function hands(u, hx, hy, col) {
  const ol = Math.max(3, u * .5), hs = 2.1 * u;
  for (const sx of [-1, 1]) { const x = hx + sx * 2.6 * u - hs / 2, y = hy - hs * .35; X.fillStyle = INK; X.fillRect(x - ol, y - ol, hs + ol * 2, hs + ol * 2); X.fillStyle = col; X.fillRect(x, y, hs, hs); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(x, y, hs * .45, hs * .4); }
}

/* ───────────── the wind cloud: shows up on the side it blows FROM, puffs its cheeks, then blows ───────────── */
const PUFFS = [[0, 0, 30], [-30, 8, 24], [30, 8, 25], [-14, -18, 24], [16, -20, 26], [-42, 22, 16], [44, 22, 16], [0, 22, 26]];
function windCloud(x, y, dir, inK, blowK, T, sc) {
  X.save(); X.translate(x, y); X.scale(sc * dir, sc);          // drawn facing +x (downwind), mirrored for leftward gusts
  const puff = 1 + inK * .08 * (1 - blowK) + Math.sin(T * 9) * .02 * inK;
  X.scale(puff, puff);
  for (const [a, b, r] of PUFFS) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 4); }
  for (const [a, b, r] of PUFFS) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#c5d8ef'; X.fill(); }
  for (const [a, b, r] of PUFFS) { X.beginPath(); X.arc(a - 3, b - 5, r * .82, 0, TAU); X.fillStyle = '#f2f8ff'; X.fill(); }
  // face (looking downwind)
  const fx = 12;
  X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round';
  for (const ex of [fx - 12, fx + 12]) {                       // eyes: wide while inhaling, squinting hard while blowing
    if (blowK > .3) { X.beginPath(); X.moveTo(ex - 6, -10); X.lineTo(ex + 6, -6); X.stroke(); }
    else { el(ex, -6, 5.5, 7); ink('#fff', 2.2); X.fillStyle = INK; el(ex + 2, -5, 2.8, 3.4); X.fill(); }
    X.beginPath(); X.moveTo(ex - 7, -18 - inK * 3); X.lineTo(ex + 6, -15 + (blowK > .3 ? 3 : -2)); X.stroke();
  }
  const ck = inK * (1 - blowK * .7);                            // cheeks puff up during the warning
  X.fillStyle = 'rgba(255,120,150,.6)'; el(fx - 20, 10, 9 + ck * 8, 6 + ck * 6); X.fill(); el(fx + 24, 10, 9 + ck * 8, 6 + ck * 6); X.fill();
  if (blowK > .05) { el(fx + 30, 12, 6 + blowK * 3, 8 + blowK * 4); ink('#5a2236', 3); }    // the "O" it blows through
  else { X.beginPath(); X.moveTo(fx - 2, 14); X.quadraticCurveTo(fx + 6, 12 - ck * 4, fx + 14, 14); X.stroke(); }
  X.restore();
}
function windArrow(x, y, dir, k, T) {                           // a chunky arrow next to the cloud: the way it blows (size = strength)
  if (k <= .01) return;
  X.save(); X.translate(x + Math.sin(T * 8) * 4 * dir, y); X.scale(dir * k * 1.35, k * 1.35);
  X.beginPath(); X.moveTo(-30, -9); X.lineTo(6, -9); X.lineTo(6, -20); X.lineTo(32, 0); X.lineTo(6, 20); X.lineTo(6, 9); X.lineTo(-30, 9); X.closePath(); ink('#fff', 4);
  X.fillStyle = '#9fd3ff'; X.fillRect(-26, 2, 30, 5);
  X.restore();
}

/* ───────────── static scene, painted once into offscreen canvases ───────────── */
let BG = null, STRIP = null;
const STRIPW = W + SCROLL + 80;
function pine(x, y, h, bend, dark) {                            // a pine whose top leans with the wind (live: drawn every frame)
  rr(x - 5, y - 18, 10, 22, 3); ink('#7a4b2a', 3);
  const tiers = 3, col = dark ? '#2e8a59' : '#3aa56a', hi = dark ? '#3fa36c' : '#55c07f';
  for (let i = 0; i < tiers; i++) {
    const k0 = i / tiers, k1 = (i + 1.25) / tiers, w = (1 - k0 * .62) * h * .34, yb = y - 14 - k0 * h * .78, yt = y - 14 - Math.min(1, k1) * h * .86;
    const bb = bend * k0 * k0 * h * .2, bt = bend * Math.min(1, k1) * Math.min(1, k1) * h * .2;
    X.beginPath(); X.moveTo(x - w + bb, yb); X.quadraticCurveTo(x + bb, yb + 6, x + w + bb, yb); X.lineTo(x + bt, yt); X.closePath(); ink(col, 3);
    X.fillStyle = hi; X.beginPath(); X.moveTo(x - w * .7 + bb, yb - 3); X.lineTo(x + bt - 2, yt + 8); X.lineTo(x - w * .1 + bb, yb - 3); X.closePath(); X.fill();
  }
}
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, '#4aa8f0'); g.addColorStop(.6, '#9bd6fb'); g.addColorStop(1, '#e4f6ff'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  // far snowy mountains
  const peaks = [[-40, 330], [70, 196], [170, 300], [270, 210], [380, 318], [500, 182], [610, 290], [700, 220], [840, 330]];
  X.beginPath(); X.moveTo(-40, 420); for (const [x, y] of peaks) X.lineTo(x, y); X.lineTo(840, 420); X.closePath(); ink('#9aa9d8', 3.5);
  X.save(); X.clip(); X.fillStyle = '#8191c8'; for (let i = 1; i < peaks.length - 1; i++) { const [x, y] = peaks[i]; X.beginPath(); X.moveTo(x, y); X.lineTo(x + 70, y + 130); X.lineTo(x + 18, y + 130); X.closePath(); X.fill(); }
  X.fillStyle = '#ffffff'; for (let i = 1; i < peaks.length - 1; i++) { const [x, y] = peaks[i], [px, py] = peaks[i - 1], [nx, ny] = peaks[i + 1]; X.beginPath(); X.moveTo(x, y); X.lineTo(lerp(x, nx, .28), lerp(y, ny, .28)); X.lineTo(lerp(x, nx, .16), lerp(y, ny, .2) + 6); X.lineTo(x + 2, y + 20); X.lineTo(lerp(x, px, .16), lerp(y, py, .2) + 8); X.lineTo(lerp(x, px, .26), lerp(y, py, .26)); X.closePath(); X.fill(); }
  X.restore();
  // mid hills
  X.fillStyle = '#9ccf9a'; X.beginPath(); X.moveTo(0, 420); for (let x = 0; x <= W; x += 20) X.lineTo(x, 352 - Math.sin(x * .012 + 2) * 20 - Math.sin(x * .031) * 7); X.lineTo(W, 440); X.lineTo(0, 440); X.closePath(); X.fill(); X.strokeStyle = '#5f9c6a'; X.lineWidth = 3; X.stroke();
  // the goat's crag (the goat itself is drawn live)
  X.beginPath(); X.moveTo(262, 440); X.lineTo(276, 316); X.lineTo(300, 300); X.lineTo(336, 306); X.lineTo(352, 330); X.lineTo(366, 440); X.closePath(); ink('#b4a6c9', 3.5);
  X.fillStyle = '#9b8db3'; X.beginPath(); X.moveTo(336, 306); X.lineTo(352, 330); X.lineTo(366, 440); X.lineTo(330, 440); X.closePath(); X.fill();
  X.fillStyle = '#d1c6e0'; X.beginPath(); X.moveTo(278, 318); X.lineTo(298, 304); X.lineTo(306, 310); X.lineTo(284, 330); X.closePath(); X.fill();
  X = old; return cv2;
}
function buildStrip() {                                          // the path the carriers walk along; it scrolls left as they go
  const cv2 = document.createElement('canvas'); cv2.width = STRIPW; cv2.height = 200; const old = X; X = cv2.getContext('2d');
  const Y = GY - 440;                                            // strip y 0 = screen y 440
  // back grass bank
  let g = X.createLinearGradient(0, 0, 0, 80); g.addColorStop(0, '#7fd05a'); g.addColorStop(1, '#5fb944'); X.fillStyle = g;
  X.beginPath(); X.moveTo(0, 30); for (let x = 0; x <= STRIPW; x += 24) X.lineTo(x, 22 + Math.sin(x * .02) * 6 + Math.sin(x * .053) * 3); X.lineTo(STRIPW, 200); X.lineTo(0, 200); X.closePath(); X.fill();
  X.strokeStyle = INK; X.lineWidth = 4; X.stroke();
  // the dirt path
  X.fillStyle = '#e8c48a'; X.beginPath(); X.moveTo(0, Y - 10); for (let x = 0; x <= STRIPW; x += 30) X.lineTo(x, Y - 12 + Math.sin(x * .04) * 2); X.lineTo(STRIPW, Y + 22); X.lineTo(0, Y + 22); X.closePath(); X.fill();
  X.strokeStyle = '#c99a5c'; X.lineWidth = 3; X.stroke();
  X.fillStyle = '#d4a86a'; for (let x = 20; x < STRIPW; x += 46) { el(x + (x * 7 % 13), Y + 2 + (x % 3) * 4, 5 + (x % 4), 2.5); X.fill(); }
  // the cliff drop in front
  X.beginPath(); X.moveTo(0, Y + 20); for (let x = 0; x <= STRIPW; x += 26) X.lineTo(x, Y + 20 + (x % 52 ? 4 : 0)); X.lineTo(STRIPW, 200); X.lineTo(0, 200); X.closePath(); ink('#8f7aa8', 4);
  X.save(); X.clip(); X.fillStyle = '#76628f'; for (let x = 0; x < STRIPW; x += 70) { X.beginPath(); X.moveTo(x, Y + 26); X.lineTo(x + 24, 200); X.lineTo(x + 6, 200); X.closePath(); X.fill(); }
  X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(0, Y + 26, STRIPW, 5); X.restore();
  // tufts, flowers, pebbles
  const tuft = (x, y) => { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9, y - 10); X.moveTo(x, y); X.lineTo(x, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 10); X.stroke(); };
  for (let x = 30; x < STRIPW; x += 97) tuft(x, 46 + (x % 3) * 5);
  const flower = (x, y, c) => { X.strokeStyle = '#3f8f35'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(x, y); X.lineTo(x, y - 12); X.stroke(); X.save(); X.translate(x, y - 14); for (let i = 0; i < 5; i++) { X.rotate(TAU / 5); el(0, -4.5, 3.2, 4.5); ink(c, 1.6); } X.beginPath(); X.arc(0, 0, 2.6, 0, TAU); ink('#ffe14d', 1.4); X.restore(); };
  for (let x = 74; x < STRIPW; x += 151) flower(x, 50 + (x % 2) * 6, ['#ff8fc4', '#fff', '#b49cff'][x % 3]);
  for (let x = 120; x < STRIPW; x += 233) { el(x, Y + 12, 12, 7); ink('#c9c3d6', 3); X.fillStyle = '#e4e0ec'; el(x - 3, Y + 9, 5, 2.5); X.fill(); }
  // the trail signpost at the start
  rr(52, 4, 8, 64, 3); ink('#8a5a34', 3); X.beginPath(); X.moveTo(20, 6); X.lineTo(84, 6); X.lineTo(96, 18); X.lineTo(84, 30); X.lineTo(20, 30); X.closePath(); ink('#e3a868', 3);
  X.fillStyle = INK; for (const [a, b] of [[36, 15], [52, 21], [68, 15]]) { el(a, b, 3.5, 5, .3); X.fill(); }
  X = old; return cv2;
}

/* ═════════ the game ═════════ */
function duSeesaw(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), left = D.role === 0, side = left ? -1 : 1, TS = Math.sqrt(sp);
  const WSP = .85 + .12 * (sp - 1), WALK = Math.sqrt(TS);    // how fast a full gust pushes the egg (plank half-lengths / s); later rounds walk a bit faster
  /* the wind: a list of gusts from the seed (always 12 of them, 4 draws each, whatever the role). The first four alternate sides,
     later ones usually do (sometimes the same side twice); each ramps up over RAMP, holds, ramps down; a calm spell in between. */
  const gusts = [];
  { let u = 1.45, dir = R() < .5 ? 1 : -1;
    for (let i = 0; i < 12; i++) {
      const a = R(), b = R(), c = R(), d = R();
      if (i && (i < 4 || d > .2)) dir = -dir;
      const hold = (1.05 + a * .7) / TS, gap = (.3 + b * .6) / TS, mag = .7 + c * .3;
      gusts.push({ i, t0: u, t1: u + RAMP + hold, dir, mag, warned: false, blown: false });
      u += RAMP * 2 + hold + gap;
    } }
  const shades = R() < .125;                            // hidden extra (1 in 8): the chick hatches already wearing sunglasses
  const env = (gu, c) => c < gu.t0 ? 0 : c < gu.t0 + RAMP ? ease((c - gu.t0) / RAMP) : c < gu.t1 ? 1 : c < gu.t1 + RAMP ? 1 - ease((c - gu.t1) / RAMP) : 0;
  const windAt = c => { let w = 0; for (const gu of gusts) w += gu.dir * gu.mag * env(gu, c); return clamp(w, -1, 1); };
  const comingAt = c => gusts.find(gu => c >= gu.t0 - WARN && c < gu.t0 + RAMP) || null;     // a gust in its warning or its ramp-up

  // my end (local, immediate) and the partner's (eased toward its latest message)
  let tgt = 0, h = 0, ph = 0, pRaw = 0, lastSentH = -1, sentHAt = -9, touchMode = false, touching = null, fN = FOCUSN;
  const kUp = new Set(), kDn = new Set();
  // the egg
  let s = 0, v = 0, hop = null, prog = 0, shownK = 0, stAt = -9, rx = null, plasters = 0, edgy = false;
  const bonkAt = [-9, -9];
  let resAt = -1, loseSide = 1, walkPh = 0, lastPopAt = -9, lastStep = 0;
  const beat = {};                                   // which beats of the win / lose show have fired
  const pops = [], bits = [], leaves = [];
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const UPK = new Set(['ArrowUp', 'KeyW', 'Space']), DNK = new Set(['ArrowDown', 'KeyS']);

  function pop(str, size, bgc, fg, x, y) { pops.length = 0; pops.push({ s: str, size, bgc, fg, x: x || 400, y: y || 214, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, rot: 0, vr: 0, sh: 0 }, o)); }
  function hL() { return left ? h : ph; }
  function hR() { return left ? ph : h; }
  function startHop(sd) {
    hop = { s0: s, s1: sd * .75, k: 0, sd }; v = 0; edgy = false; plasters = Math.min(3, plasters + 1); bonkAt[sd > 0 ? 1 : 0] = g.c;
    sfx.boing(); snd(660, .12, 'square', .05, 0, 1300); noise(.08, .06, 1800, 600, 'bandpass'); shake(5, .16);
    const geo = { yL: endY(hL()), yR: endY(hR()) }, hx = SIDEX[sd > 0 ? 1 : 0], hy = (sd > 0 ? geo.yR : geo.yL) - 60;
    for (let i = 0; i < 3; i++) bit({ sh: 2, x: hx + (cr() - .5) * 30, y: hy - 10, vx: (cr() - .5) * 120, vy: -(120 + cr() * 80), gr: 300, life: .55, rot: cr() * 6, vr: 6 });
    ring(400 + sd * TRK, hy + 20, '#fff', 60, .3);
    pop(['WHOA!', 'OOF!', 'YIKES!'][(plasters - 1) % 3], 34, '#ff7a3d', '#fff');
  }
  /* JUDGE only: the egg reached an end. A lone bonk costs PEN s of walking; bonks that keep coming (within PENW s of the last one, i.e.
     nobody is fixing that side) cost PEN more each time */
  let lastBonk = -99, streak = 0;
  function scare(sd) {
    streak = g.c - lastBonk < PENW ? streak + 1 : 0; lastBonk = g.c;
    prog = Math.max(0, prog - PEN * (1 + streak)); D.send('sc', { d: sd, p: Math.round(prog * 1000) }); startHop(sd);
  }

  const g = {
    c: 0, dur: 14, pts: 0,
    cmd: 'CARRY!', roleLabel: left ? 'LEFT CARRIER' : 'RIGHT CARRIER',
    hint: 'MOUSE UP OR ▲: LIFT YOUR END - EGG ON THE CUSHION!',
    thint: 'SLIDE UP: LIFT YOUR END - EGG ON THE CUSHION!',
    update(dt) {
      const T = g.c += dt;
      if (g.result && resAt < 0) { resAt = T; loseSide = s > .05 ? 1 : s < -.05 ? -1 : (windAt(T) >= 0 ? 1 : -1); if (g.result === 'win') prog = NEED; }
      // my end
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kUp.clear(); kDn.clear(); touching = null; }
      if (!g.result) {
        if (kUp.size) tgt = Math.min(1, tgt + 1.7 * dt);
        if (kDn.size) tgt = Math.max(0, tgt - 1.7 * dt);
        if (touchMode && !touching && !kUp.size) tgt = Math.max(0, tgt - .6 * dt);    // a thumb let go: the end sinks back down slowly
      }
      const want = g.result ? (g.result === 'win' ? .25 : 0) : tgt;
      h += clamp(want - h, -2.6 * dt, 2.6 * dt);
      if (!g.result && T - sentHAt >= .1 && Math.round(h * 100) !== lastSentH) { lastSentH = Math.round(h * 100); sentHAt = T; D.send('h', lastSentH, true); }
      ph += ((g.result ? (g.result === 'win' ? .25 : 0) : pRaw) - ph) * Math.min(1, dt * 14);
      // the egg
      const w = windAt(T);
      if (hop) { hop.k += dt / HOP; s = lerp(hop.s0, hop.s1, ease(Math.min(1, hop.k))); v = 0; if (hop.k >= 1) hop = null; }
      else if (!g.result) {
        const vt = G * (hL() - hR()) + WSP * w + KU * s;      // an egg never sits still on a plank: it rocks away from the middle
        v += (vt - v) * Math.min(1, dt * 6); s += v * dt;
        if (g.judge) { if (Math.abs(s) >= 1) { s = Math.sign(s); scare(Math.sign(s)); } }
        else {
          if (rx && !rx.hop) { const tg = clamp(rx.s + rx.v * clamp(now - rx.at + .15, 0, .35), -1, 1); s += (tg - s) * Math.min(1, dt * 6); }
          if (Math.abs(s) > 1) { s = Math.sign(s); v = 0; }          // teeters at the end until the judge says what happened
        }
      }
      const walking = !g.result && !hop && Math.abs(s) < ZONE && T > .25;
      if (g.judge && !g.result) {
        if (walking) prog = Math.min(NEED, prog + dt * WALK);
        if (T - stAt >= .1) { stAt = T; D.send('st', [Math.round(s * 1000), Math.round(v * 1000), Math.round(prog * 1000), hop ? 1 : 0], true); }
        if (prog >= NEED) g.finish('win'); else if (T >= g.limit) g.finish('lose');
      }
      shownK += (prog / NEED - shownK) * Math.min(1, dt * 5);
      // walking feet + footstep ticks; a "phew" when the egg comes back to the cushion from near an end
      if (walking) { walkPh += dt; if (walkPh - lastStep > .3) { lastStep = walkPh; snd(150 + (Math.floor(walkPh / .3) % 2) * 40, .04, 'triangle', .035); } }
      if (Math.abs(s) > .72 && !hop) edgy = true;
      if (edgy && Math.abs(s) < ZONE * .8 && !g.result) { edgy = false; if (T - lastPopAt > 1.2) { lastPopAt = T; pop('PHEW!', 30, '#2fb35a', '#fff'); snd(880, .08, 'triangle', .04); snd(1175, .1, 'triangle', .035, .07); } }
      // wind sounds (cosmetic, each screen on its own clock)
      for (const gu of gusts) {
        if (!gu.warned && T >= gu.t0 - WARN && T < gu.t0) { gu.warned = true; if (!g.result) noise(.75, .035 * gu.mag, 2600, 500, 'bandpass', 0, 1.2); }
        if (!gu.blown && T >= gu.t0) { gu.blown = true; if (!g.result) { noise(RAMP * 2 + (gu.t1 - gu.t0), .05 * gu.mag, 500, 1300, 'bandpass', 0, .7); } }
      }
      // leaves ride the wind
      if (!g.result && Math.abs(w) > .08 && cr() < Math.abs(w) * dt * 16 && leaves.length < 24) leaves.push({ x: w > 0 ? -30 : W + 30, y: 120 + cr() * 340, vy: (cr() - .5) * 40, r: cr() * 6, vr: (cr() - .5) * 14, c: ['#7fd05a', '#ffd23f', '#ff9a4d', '#5bbf5e'][Math.floor(cr() * 4)], ph: cr() * 6 });
      for (let i = leaves.length - 1; i >= 0; i--) { const l = leaves[i]; l.x += (w * 620 + Math.sign(w || 1) * 60) * dt; l.y += (l.vy + Math.sin(T * 5 + l.ph) * 60) * dt; l.r += l.vr * dt; if (l.x < -60 || l.x > W + 60) leaves.splice(i, 1); }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1.1) pops.length = 0;
      // the payoffs' sound beats
      if (resAt >= 0) {
        const rk = T - resAt;
        if (g.result === 'win') {
          if (rk >= .34 && !beat.landed) { beat.landed = true; sfx.thud(); ring(NX, GY - 40, '#fff', 70, .35); }
          if (rk >= .5 && !beat.hatched) { beat.hatched = true; noise(.12, .09, 3000, 900, 'bandpass'); [1760, 2093, 2349].forEach((f, i) => snd(f, .07, 'sine', .07, .05 + i * .09, f * 1.2)); pop('PEEP!', 38, '#ffb300', '#fff', 636, 186); for (let i = 0; i < 8; i++) bit({ sh: 1, x: NX + (cr() - .5) * 40, y: GY - 60, vx: (cr() - .5) * 260, vy: -(200 + cr() * 200), r: 4 + cr() * 3, c: SHELL, rot: cr() * 6, vr: (cr() - .5) * 16, life: .6 }); }
        } else {
          if (rk >= .55 && !beat.landed) { beat.landed = true; sfx.splat(); noise(.14, .09, 2600, 700, 'bandpass'); shake(5, .15); pop('CRACK!', 34, '#8f7aa8', '#fff', loseSide > 0 ? 648 : 152, 186); for (let i = 0; i < 4; i++) bit({ sh: 1, x: SIDEX[loseSide > 0 ? 1 : 0] + loseSide * (70 + i * 14), y: GY - 10, vx: loseSide * (60 + cr() * 160), vy: -(140 + cr() * 140), r: 3 + cr() * 2, c: SHELL, rot: cr() * 6, vr: (cr() - .5) * 16, life: .45 }); }
          if (rk >= .72 && !beat.peeped) { beat.peeped = true; [1400, 1250, 1400].forEach((f, i) => snd(f, .07, 'square', .05, i * .1, f * .8)); pop('PEEP!!', 36, '#e8434f', '#fff', loseSide > 0 ? 648 : 152, 186); }
        }
      }
    },
    msg(type, d) {
      if (type === 'h') pRaw = clamp(d / 100, 0, 1);
      else if (type === 'st' && !g.judge) { rx = { s: d[0] / 1000, v: d[1] / 1000, at: now, hop: !!d[3] }; prog = d[2] / 1000; }
      else if (type === 'sc' && !g.judge) { prog = d.p / 1000; if (!g.result) startHop(d.d); }
    },
    draw() {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) { BG = buildBg(); STRIP = buildStrip(); } X = ctx;
      X.drawImage(BG, 0, 0);
      const calm = rk >= 0 ? 1 - ease(rk / .35) : 1, w = windAt(T) * calm, scr = shownK * SCROLL;
      sky(T, w);
      goat(306, 302, T, w, s);
      streaks(T, w);
      // pines on the back bank (parallax), bending with the wind
      for (let i = 0; i < 9; i++) { const x = 40 + i * 168 - scr * .55; if (x < -60 || x > W + 60) continue; pine(x, 452 + (i % 2) * 6, 92 + (i * 37 % 40), w * 1.2 + Math.sin(T * 2.2 + i) * .06 * (.3 + Math.abs(w)), i % 2); }
      X.drawImage(STRIP, -scr, 440);
      // the nest comes into view near the end of the path
      const nx = NX + (1 - shownK) * SCROLL;
      if (nx < W + 80) nestScene(nx, T, won ? rk : -1);
      // the wind clouds: one per gust, from its warning until it has died down
      for (const gu of gusts) {
        const a = T - (gu.t0 - WARN); if (a < 0 || T > gu.t1 + RAMP + .4) continue;
        const inK = ease(a / .35), out = Math.max(T > gu.t1 ? ease((T - gu.t1) / (RAMP + .4)) : 0, 1 - calm), blowK = env(gu, T) * calm;
        const cx = (gu.dir > 0 ? 150 : W - 150) - gu.dir * (1 - inK) * 210 - gu.dir * out * 40, cy = 128 + (gu.i % 2) * 14 - out * 60;
        X.globalAlpha = 1 - out; windCloud(cx, cy, gu.dir, inK, blowK, T, .78 + gu.mag * .3);
        const ak = T < gu.t0 ? inK * (.75 + .25 * Math.sin(T * 16)) : (.55 + .45 * env(gu, T)) * (1 - out);       // pulses during the warning
        windArrow(cx + gu.dir * (34 + 30 * blowK), cy + 86, gu.dir, ak * (.8 + gu.mag * .3), T); X.globalAlpha = 1;
      }
      // the carriers, the plank, the egg
      const HL = hL(), HR = hR();
      const egs = { s, hop, T, won, lost, rk, plasters, loseSide, walk: !g.result && !hop && Math.abs(s) < ZONE && T > .25 ? walkPh : null };
      const coming = comingAt(T), threat = sd => (!g.result && !hop && s * sd > .55 && v * sd > -.05) || (!g.result && coming && coming.dir === sd);
      porters(HL, HR, egs, [left ? myCol() : pCol(), left ? pCol() : myCol()], threat, T);
      for (const l of leaves) leaf(l);
      drawBits();
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 10, q.size, q.bgc, q.fg, a < .25 ? outBack(a / .25) : 1, q.rot); X.globalAlpha = 1; }
      trailSign(T);
      pill(LX, 536, left ? 'YOU' : 'YOUR FRIEND', left ? myCol() : pCol(), true);
      pill(RX, 536, left ? 'YOUR FRIEND' : 'YOU', left ? pCol() : myCol(), true);
      if (rk < .3) gauge(T, coming && coming.dir === side && !g.result, rk < 0 ? 1 : 1 - rk / .3);
      vignette(.14);
    },
    move(p) {
      if (g.result) return;
      if (p.touch === false) touchMode = false;                                              // a mouse / pen again (a laptop with a touch screen)
      if (p.touch && !touching) { touchMode = true; touching = { y0: p.y, h0: tgt }; }       // a finger already down when the game started
      if (p.touch || touchMode) { if (touching) tgt = clamp(touching.h0 + (touching.y0 - p.y) / 250, 0, 1); }
      else tgt = clamp((YB - p.y) / (YB - YT), 0, 1);
    },
    down(p) { if (p.touch) touchMode = true; if (p.touch || touchMode) touching = { y0: p.y, h0: tgt }; else g.move(p); },
    up() { touching = null; },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (UPK.has(e.code)) kUp.add(e.code); else if (DNK.has(e.code)) kDn.add(e.code);
    },
    keyup(e) { kUp.delete(e.code); kDn.delete(e.code); },
  };

  /* ───────────── drawing that needs the game state ───────────── */
  function gauge(T, alarm, fade) {                 // my lift lever, on my side of the screen (it fades away once the verdict is in)
    const gx = left ? 50 : W - 50, top = YT - 22, hgt = YB - YT + 44, col = myCol(), done = !!g.result;
    X.globalAlpha = done ? .75 * fade : 1;
    rr(gx - 28, top + 6, 56, hgt, 28); ink('#5d4a7a', 4);
    rr(gx - 28, top, 56, hgt, 28); ink('#8f7aa8', 0); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    X.fillStyle = 'rgba(255,255,255,.25)'; rr(gx - 22, top + 5, 44, 10, 5); X.fill();
    // the groove, filled up to where my end really is
    rr(gx - 9, YT - 4, 18, YB - YT + 8, 9); ink('#3b3550', 3);
    const fy = YB - (YB - YT) * h; X.save(); rr(gx - 9, YT - 4, 18, YB - YT + 8, 9); X.clip(); X.fillStyle = done ? '#b9b3c9' : col; X.fillRect(gx - 9, fy, 18, YB - fy + 6); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(gx - 6, fy, 4, YB - fy); X.restore();
    for (let i = 1; i < 4; i++) { const y = YB - (YB - YT) * i / 4; X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(gx + 13, y - 1.5, 8, 3); X.fillRect(gx - 21, y - 1.5, 8, 3); }
    // the knob (where I want my end); glows when a gust is about to push the egg my way
    const ky = YB - (YB - YT) * (touchMode ? h : tgt);
    if (alarm) { X.globalAlpha = .45 + .45 * Math.sin(T * 14); X.beginPath(); X.arc(gx, ky, 34, 0, TAU); X.lineWidth = 6; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
    X.beginPath(); X.arc(gx, ky + 4, 24, 0, TAU); ink(INK, 0); X.fillStyle = 'rgba(20,16,28,.35)'; X.fill();
    X.beginPath(); X.arc(gx, ky, 24, 0, TAU); ink(done ? '#d3cfe0' : col, 4); X.fillStyle = 'rgba(255,255,255,.4)'; el(gx - 7, ky - 9, 9, 5, -.4); X.fill();
    X.beginPath(); X.moveTo(gx - 10, ky + 5); X.lineTo(gx, ky - 8); X.lineTo(gx + 10, ky + 5); X.lineWidth = 5; X.strokeStyle = INK; X.lineCap = 'round'; X.lineJoin = 'round'; X.stroke();
    txt('LIFT', gx, top - 18, 22, alarm ? '#FFE14D' : '#fff', 'center', 90);
    if (alarm) { const bob = Math.abs(Math.sin(T * 9)) * 8; X.save(); X.translate(gx + (left ? 46 : -46), ky - 10 - bob); X.beginPath(); X.moveTo(-11, 6); X.lineTo(0, -10); X.lineTo(11, 6); X.closePath(); ink('#FFE14D', 3); X.restore(); }
    if (!TOUCH) { keyCap(gx - 16, YB + 40, '▲'); keyCap(gx + 16, YB + 40, '▼'); }
    X.globalAlpha = 1;
  }
  function trailSign(T) {                          // a wooden sign hanging from the top: the trail, 6 footprints, the nest
    const x0 = 262, y0 = 64, w = 276, h0 = 60, cx = x0 + w / 2, sw = Math.sin(T * 1.3) * .012, k = clamp(shownK, 0, 1);
    X.save(); X.translate(cx, 40); X.rotate(sw); X.translate(-cx, -40);
    X.lineCap = 'round'; for (const rx2 of [x0 + 30, x0 + w - 30]) { X.strokeStyle = INK; X.lineWidth = 8; X.beginPath(); X.moveTo(rx2, 40); X.lineTo(rx2, y0 + 6); X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 3.5; X.stroke(); }
    rr(x0, y0 + 5, w, h0, 16); ink(WOOD2, 5);
    rr(x0, y0, w, h0, 16); ink(WOOD, 0); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
    X.save(); rr(x0, y0, w, h0, 16); X.clip(); X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(x0, y0 + 4, w, 6); X.fillStyle = '#c98443'; X.fillRect(x0, y0 + h0 / 2 + 8, w, 2); X.restore();
    // dotted trail, footprints that fill in as they walk, the nest at the end
    X.strokeStyle = 'rgba(90,50,20,.45)'; X.lineWidth = 3; X.setLineDash([5, 7]); X.beginPath(); X.moveTo(x0 + 22, y0 + 38); X.lineTo(x0 + w - 48, y0 + 38); X.stroke(); X.setLineDash([]);
    for (let i = 0; i < NEED; i++) {
      const fx = x0 + 36 + i * 31, on = prog >= i + 1 - 1e-6;
      X.save(); X.translate(fx, y0 + 38); X.rotate(.25);
      X.fillStyle = on ? '#5a3216' : 'rgba(90,50,20,.22)'; el(-4, i % 2 ? -5 : 5, 4.5, 6.5); X.fill(); el(-4, i % 2 ? -13 : -3, 2.8, 2.8); X.fill();
      X.restore();
    }
    nestIcon(x0 + w - 28, y0 + 36, .55);
    // the little egg rides the trail
    const ex = x0 + 24 + k * (w - 62), ey = y0 + 22 + (Math.abs(s) < ZONE && !g.result ? -Math.abs(Math.sin(T * 10)) * 3 : 0);
    X.save(); X.translate(ex, ey); X.scale(.36, .36); inkP(P(EGGP), SHELL, 6); X.restore();
    X.restore();
  }
  function nestIcon(x, y, sc) {
    X.save(); X.translate(x, y); X.scale(sc, sc);
    X.beginPath(); X.ellipse(0, 4, 30, 14, 0, 0, Math.PI); X.lineTo(-30, 4); X.closePath(); ink('#b07a3c', 3.5);
    X.strokeStyle = '#7e5226'; X.lineWidth = 3; for (let i = -2; i <= 2; i++) { X.beginPath(); X.moveTo(i * 11 - 8, 6 + Math.abs(i) * 1); X.lineTo(i * 11 + 8, 12 - Math.abs(i) * 2); X.stroke(); }
    X.restore();
  }
  function nestScene(x, T, wk) {                  // a twig nest on a rock, mama goose waiting behind it (wk: time since the win, or -1)
    const y = GY - 4;
    // mama goose
    const flap = wk >= .5 ? Math.sin(T * 22) : 0, hy = Math.sin(T * 2) * 2 - (wk >= .5 ? Math.abs(Math.sin(T * 10)) * 8 : 0);
    X.save(); X.translate(x + 42, y - 34);
    for (const sx of [-1, 1]) if (wk >= .5) { X.save(); X.translate(sx * 10, -16); X.rotate(-sx * .3 - flap * .5 * sx); el(sx * 22, -10, 26, 12, -sx * .5); ink('#eef1f6', 3.5); X.restore(); }
    el(10, -10, 44, 30); ink('#ffffff', 4); X.fillStyle = '#e3e7ef'; el(26, 0, 26, 14, .2); X.fill();
    // a long neck: her head stays clear above the chick (hx, hy2 = the head)
    const hx = -14, hy2 = -146 + hy;
    X.beginPath(); X.moveTo(-6, -26); X.bezierCurveTo(-30, -60, 8, -100, hx, hy2 + 6); X.lineWidth = 22; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 14; X.strokeStyle = '#fff'; X.stroke();
    X.beginPath(); X.arc(hx, hy2, 17, 0, TAU); ink('#fff', 3.5);
    X.beginPath(); X.moveTo(hx - 12, hy2 - 4); X.lineTo(hx - 38, hy2 + 4); X.lineTo(hx - 14, hy2 + 10); X.closePath(); ink('#ff9a1c', 3);
    if (wk >= .5) { X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(hx - 8, hy2 - 4); X.quadraticCurveTo(hx - 2, hy2 - 12, hx + 4, hy2 - 4); X.stroke(); X.fillStyle = 'rgba(255,120,150,.6)'; el(hx + 6, hy2 + 6, 6, 3.5); X.fill(); }
    else { X.fillStyle = INK; el(hx - 4, hy2 - 4, 3.4, 4.2); X.fill(); X.fillStyle = '#fff'; el(hx - 5, hy2 - 6, 1.2, 1.2); X.fill(); }
    // a string of pearls: she dressed up for the occasion
    for (let i = 0; i < 6; i++) { X.beginPath(); X.arc(-20 + i * 4.2, -70 - i * 3.2, 3.2, 0, TAU); ink('#fff8f0', 1.5); }
    X.restore();
    // rock + nest
    X.beginPath(); X.moveTo(x - 60, y + 6); X.lineTo(x - 48, y - 14); X.lineTo(x + 50, y - 16); X.lineTo(x + 64, y + 6); X.closePath(); ink('#b4a6c9', 3.5);
    X.save(); X.translate(x, y - 26);
    X.beginPath(); X.ellipse(0, 0, 50, 22, 0, 0, Math.PI); X.lineTo(-50, 0); X.closePath(); ink('#b07a3c', 4);
    X.strokeStyle = '#7e5226'; X.lineWidth = 3.5; for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(i * 13 - 10, 4 + Math.abs(i)); X.lineTo(i * 13 + 10, 14 - Math.abs(i) * 2); X.stroke(); }
    X.strokeStyle = '#d9a35f'; X.lineWidth = 3; for (let i = -2; i <= 2; i++) { X.beginPath(); X.moveTo(i * 17 - 6, 2); X.lineTo(i * 17 + 9, 9); X.stroke(); }
    X.restore();
  }
  function porters(HL, HR, o, cols, threat, T) {
    const yL = endY(HL), yR = endY(HR), a = Math.atan2(yR - yL, RX - LX), rk = o.rk;
    // lose: the carriers slump, the plank tips toward the egg's side
    const slump = o.lost && rk >= 0 ? ease(rk / .3) : 0, tipL = o.loseSide < 0 ? slump * 30 : -slump * 10, tipR = o.loseSide > 0 ? slump * 30 : -slump * 10;
    const ends = [[LX, yL + tipL], [RX, yR + tipR]], geoA = Math.atan2(ends[1][1] - ends[0][1], RX - LX);
    // the egg's place
    let ex, ey, erot, emood = 'awake', esq = 0, look = [0, 0];
    const along = s2 => { const x = 400 + s2 * TRK, yp = ends[0][1] + (ends[1][1] - ends[0][1]) * (x - LX) / (RX - LX), c = CUSH * clamp((ZONE * TRK + 18 - Math.abs(x - 400)) / 18, 0, 1), d = PT / 2 + c + ERY - 3; return [x + Math.sin(geoA) * d, yp - Math.cos(geoA) * d]; };
    [ex, ey] = along(o.s); erot = geoA + .26 * Math.sin(o.s * TRK / ERX * .9);
    if (o.hop) { const k = Math.min(1, o.hop.k); ey -= Math.sin(k * Math.PI) * 74; erot += k * TAU * -o.hop.sd; emood = 'dizzy'; }
    else if (Math.abs(o.s) > .72) { emood = 'scared'; look = [Math.sign(o.s), .3]; }
    else if (Math.abs(o.s) < ZONE && Math.abs(v) < .3) emood = 'sleep';
    else look = [clamp(v * 2, -1, 1), 0];
    if (T - Math.max(...bonkAt) < .9 && !o.hop) emood = 'dizzy';
    let eggVis = true, chickAt = null;
    if (o.won && rk >= 0) {                         // the egg hops off the plank into the nest, wobbles, hatches
      const k = clamp(rk / .34, 0, 1), [sx, sy] = along(clamp(o.s, -1, 1)), tx = NX, ty = GY - 4 - 26 - ERY + 8;
      ex = lerp(sx, tx, ease(k)); ey = lerp(sy, ty, k) - Math.sin(k * Math.PI) * 90; erot = lerp(erot, 0, k) + (k < 1 ? k * TAU : 0);
      emood = k < 1 ? 'happy' : 'happy'; if (k >= 1 && rk < .5) { erot = Math.sin(rk * 60) * .12; esq = Math.sin(clamp((rk - .34) / .1, 0, 1) * Math.PI) * .5; }
      if (rk >= .5) { eggVis = false; chickAt = [tx, ty, rk - .5]; }
    } else if (o.lost && rk >= 0) {                 // the egg rolls off the low end and falls on the path
      const sd = o.loseSide, roll = clamp(rk / .25, 0, 1), fall = clamp((rk - .25) / .3, 0, 1);
      const [sx, sy] = along(lerp(o.s, sd * 1.1, ease(roll)));
      if (fall <= 0) { ex = sx; ey = sy; erot += roll * 2 * sd; emood = 'scared'; look = [sd, .5]; }
      else { const lx = SIDEX[sd > 0 ? 1 : 0] + sd * 92, ly = GY - ERY + 4; ex = lerp(sx + sd * 30, lx, fall); ey = lerp(sy, ly, fall * fall); erot = sd * (2 + fall * 4); emood = 'scared'; look = [0, 1]; }
      if (rk >= .55) { eggVis = false; chickAt = [SIDEX[sd > 0 ? 1 : 0] + sd * 92, GY + 2, rk - .55]; }
    }
    // shadows on the path
    X.fillStyle = 'rgba(20,16,28,.22)'; for (const x of [LX, RX]) { el(x, GY + 2, 40, 7); X.fill(); }
    if (eggVis) { el(ex, GY + 4, 26 * clamp(1 - (GY - ey) / 400, .4, 1), 5); X.fill(); }
    // carriers: arms up to the plank, bodies (tiptoe when lifting), faces
    const geo = [[LX, ends[0][1], HL, -1], [RX, ends[1][1], HR, 1]];
    const bodies = geo.map(([x, ey2, hh, sd], i) => {
      const bob = o.walk !== null ? Math.abs(Math.sin(o.walk * 10.5 + i * Math.PI)) * 3 : 0, tip = hh * 9;
      const jump = o.won && rk >= .5 ? Math.abs(Math.sin((rk - .5) * 12 + i)) * 16 : 0, sag = slump * 10;
      return { x, y: GY - tip - bob - jump + sag, hx: x, hy: ey2 + PT / 2 + 3, hh, sd, i };
    });
    for (const b of bodies) noodleArms(b.x, b.y, PU, b.hx, b.hy, cols[b.i], b.hh > .6 ? (b.hh - .6) * 2.5 : 0);
    for (const b of bodies) {
      const bonked = T - bonkAt[b.i] < .7, thr = threat(b.sd);
      let mood = null;
      if (o.won && rk >= 0) mood = 'happy'; else if (o.lost && rk >= 0) mood = 'sad'; else if (bonked) mood = 'dizzy'; else if (thr && Math.abs(o.s) > .55) mood = 'scared'; else if (b.hh > .5) mood = 'strain';
      caos(b.x, b.y, PU, { col: cols[b.i], mood: mood === 'happy' || mood === 'sad' ? mood : null, run: o.walk !== null ? o.walk + b.i : undefined });
      if (mood && mood !== 'happy' && mood !== 'sad') face(b.x, b.y, PU, cols[b.i], mood, [clamp((ex - b.x) / 200, -1, 1), -.6]);
      else if (!mood) face(b.x, b.y, PU, cols[b.i], 'look', [clamp((ex - b.x) / 200, -1, 1), -.6]);
      if (mood === 'strain') { X.globalAlpha = .9; const d = (T * 46 + b.i * 9) % 20; el(b.x + b.sd * 30, b.y - 50 + d, 4, 6); ink('#9fe3ff', 2); X.globalAlpha = 1; }
      if (bonked) for (let i = 0; i < 3; i++) { const an = T * 7 + i * TAU / 3; star(b.x + Math.cos(an) * 34, b.y - 56 + Math.sin(an) * 9, 8, 3.6, 5, an, '#FFE14D', 2.5); }
      if (thr && !o.won && !o.lost) bang(b.x + b.sd * 46, b.y - 74 + Math.sin(T * 10) * 3, .9 + .08 * Math.sin(T * 14), '#ff4d5e');
    }
    // the plank, with the cushion in the middle
    X.save(); X.translate(LX, ends[0][1]); X.rotate(geoA);
    const len = Math.hypot(RX - LX, ends[1][1] - ends[0][1]);
    rr(-34, -PT / 2 + 5, len + 68, PT, 6); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
    rr(-34, -PT / 2, len + 68, PT, 6); ink('#e0a35e', 4); X.fillStyle = '#c4874e'; X.fillRect(-30, PT / 2 - 5, len + 60, 3); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-28, -PT / 2 + 2, len + 56, 3);
    X.fillStyle = INK; for (const nx2 of [-22, len + 22]) { X.beginPath(); X.arc(nx2, 0, 2.5, 0, TAU); X.fill(); }
    const cx0 = (400 - LX) / Math.cos(geoA) - (ZONE * TRK + 18), cw = (ZONE * TRK + 18) * 2;
    rr(cx0, -PT / 2 - CUSH - 4, cw, CUSH + 8, 9); ink(o.walk !== null ? '#ff9ccb' : '#f2a6c8', 3.5);
    X.fillStyle = 'rgba(255,255,255,.45)'; rr(cx0 + 10, -PT / 2 - CUSH - 1, cw - 20, 3, 1.5); X.fill();
    X.strokeStyle = 'rgba(160,40,90,.35)'; X.lineWidth = 2; X.setLineDash([4, 5]); rr(cx0 + 5, -PT / 2 - CUSH, cw - 10, CUSH, 6); X.stroke(); X.setLineDash([]);
    X.restore();
    for (const b of bodies) hands(PU, b.hx, b.hy - PT / 2 - 3, cols[b.i]);
    // the egg
    if (eggVis) egg(ex, ey, erot, { mood: emood, t: T, plasters: o.plasters, look, sq: esq });
    if (eggVis && emood === 'sleep') for (let i = 0; i < 2; i++) { const k = ((T * .7 + i * .5) % 1); zee(ex + 28 + k * 22, ey - 44 - k * 40, .7 + i * .2, Math.sin(k * Math.PI)); }
    if (chickAt) {
      const [cx, cy, ck] = chickAt, up = outBack(ck / .2);
      if (o.won) {
        shellCup(cx, cy + ERY - 6, 1); chick(cx, cy + 16 - up * 22, 1.05, 'happy', T, shades);
        shellTop(cx + 2, cy - 30 - up * 22 - Math.max(0, .2 - ck) * 120, .62, -.15);
        for (let i = 0; i < 3; i++) { const k = ((T * .9 + i * .33) % 1); X.globalAlpha = Math.sin(k * Math.PI); heart(cx - 40 + i * 40, cy - 70 - k * 70, .7 + (i % 2) * .25); X.globalAlpha = 1; }
      } else {
        chick(cx + Math.sin(T * 30) * 2.5 * clamp(ck * 4, 0, 1), cy - 30 - up * 26, 1.4, 'mad', T); shellCup(cx, cy, 1.15);
        if (ck > .1) for (let i = 0; i < 2; i++) { const k = ((T * 1.6 + i * .5) % 1); X.globalAlpha = 1 - k; el(cx - 24 + i * 48 + (i ? 1 : -1) * k * 16, cy - 104 - up * 26 - k * 30, 9 + k * 7, 6 + k * 5); ink('#fff', 2.5); X.globalAlpha = 1; }
        shellTop(cx + o.loseSide * 40, cy - 6, .55, o.loseSide * 1.9);
      }
    }
  }
  function drawBits() {
    for (const b of bits) {
      const a = g.c - b.t0, fade = a > b.life * .7 ? 1 - (a - b.life * .7) / (b.life * .3) : 1; X.globalAlpha = clamp(fade, 0, 1);
      if (b.sh === 1) { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); X.beginPath(); X.moveTo(-b.r, -b.r); X.lineTo(b.r * 1.2, -b.r * .4); X.lineTo(-b.r * .2, b.r); X.closePath(); ink(b.c, 2); X.restore(); }
      else if (b.sh === 2) star(b.x, b.y, 9, 4, 5, b.rot, '#FFE14D', 2.5);
    }
    X.globalAlpha = 1;
  }
  g.dbg = {
    egg: () => ({ s, v, hop: !!hop }),                       // what this player sees on its own screen
    wind: () => windAt(g.c), coming: () => { const c = comingAt(g.c); return c && { dir: c.dir, mag: c.mag, at: c.t0 - g.c }; },
    mine: () => h, partner: () => ph, prog: () => prog, NEED, ZONE, G, WSP, KU,
    yOf: k => YB - (YB - YT) * k, gusts, shades,
  };
  wire(g, D, 0, sp, 'du_seesaw');
  return g;
}
reg('du_seesaw', duSeesaw, 'EGG DELIVERY'); REGMAP.du_seesaw.duo = true;

/* ───────────── live bits of the scene ───────────── */
function sky(T, w) {
  const cloud = (x, y, s2) => { X.save(); X.translate(x, y); X.scale(s2, s2); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]; for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); };
  cloud(((T * 9 + 380) % 980) - 120, 150, .6); cloud(((T * 6 + 900) % 1000) - 140, 260, .5);
  // a bird struggling against the wind
  const bx = ((T * 30) % 1100) - 150 + w * 40, by = 236 + Math.sin(T * 2) * 8, f = Math.sin(T * (10 + Math.abs(w) * 14)) * 5;
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(bx - 9, by - f); X.quadraticCurveTo(bx - 4, by - 6, bx, by); X.quadraticCurveTo(bx + 4, by - 6, bx + 9, by - f); X.stroke();
}
function streaks(T, w) {                                        // wind lines across the sky: how many and how fast = how strong
  const a = Math.abs(w); if (a < .04) return;
  X.save(); X.lineCap = 'round'; const wc = 'rgba(255,255,255,' + (.35 + a * .55).toFixed(3) + ')', bc = 'rgba(60,120,190,' + (.12 + a * .25).toFixed(3) + ')';
  for (let i = 0; i < 9; i++) {
    if (i / 9 > a + .15) continue;
    const y = 132 + i * 37 + Math.sin(i * 7.3) * 12, sp2 = 520 + (i * 97 % 260), len = 60 + a * 90, span = W + 300;
    let x = ((T * sp2 * (.4 + a) + i * 211) % span) - 150; if (w < 0) x = W - x;
    const d = Math.sign(w);
    X.beginPath(); X.moveTo(x - d * len, y); X.quadraticCurveTo(x - d * len * .4, y - 6, x, y); X.arc(x, y - 9, 9, Math.PI / 2, Math.PI / 2 + d * 4.2, d < 0);
    X.lineWidth = 8; X.strokeStyle = bc; X.stroke(); X.lineWidth = 4; X.strokeStyle = wc; X.stroke();
  }
  X.restore();
}
function leaf(l) {
  X.save(); X.translate(l.x, l.y); X.rotate(l.r);
  X.beginPath(); X.moveTo(-9, 0); X.quadraticCurveTo(0, -8, 9, 0); X.quadraticCurveTo(0, 8, -9, 0); X.closePath(); ink(l.c, 2);
  X.strokeStyle = 'rgba(20,16,28,.4)'; X.lineWidth = 1.5; X.beginPath(); X.moveTo(-7, 0); X.lineTo(7, 0); X.stroke();
  X.restore();
}
function goat(x, y, T, w, es) {                                 // a mountain goat on a far crag, chewing, staring at the egg
  X.save(); X.translate(x, y); X.scale(.62, .62);
  for (const lx of [-16, -6, 10, 20]) { rr(lx - 3, 6, 6, 18, 2); ink('#e9e4f2', 2.5); }
  el(2, 0, 28, 15); ink('#f4f1f8', 3);
  X.fillStyle = '#d6d0e2'; el(10, 6, 18, 7); X.fill();
  const hx = -28, hy = -18 + Math.sin(T * 1.3) * 1.5;
  X.beginPath(); X.moveTo(-14, -6); X.lineTo(hx + 4, hy + 4); X.lineWidth = 14; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#f4f1f8'; X.stroke();
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(hx + sx * 4, hy - 8); X.quadraticCurveTo(hx + sx * 4 + 10, hy - 26, hx + 14 + sx * 3, hy - 18); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.5; X.strokeStyle = '#c9a874'; X.stroke(); }
  el(hx, hy, 11, 9); ink('#f4f1f8', 3);
  const chew = Math.sin(T * 9) * 1.6;
  X.beginPath(); X.moveTo(hx - 6, hy + 6 + chew); X.lineTo(hx - 2 + w * 6, hy + 20 + chew); X.lineTo(hx + 3, hy + 7 + chew); X.closePath(); ink('#d6d0e2', 2.2);    // the beard flaps in the wind
  X.fillStyle = INK; const lk = clamp(es, -1, 1) * 1.6; el(hx - 3 + lk, hy - 2, 2.2, 2.6); X.fill(); el(hx + 5 + lk, hy - 2, 2.2, 2.6); X.fill();
  X.fillStyle = '#7fd05a'; X.save(); X.translate(hx - 10, hy + 4 + chew); X.rotate(-.5 + Math.sin(T * 9) * .2); X.fillRect(-7, -1.5, 9, 3); X.restore();    // a blade of grass, chewed forever
  X.restore();
}

/* ───────────── intro card: what each role does (520×240 frame), a 3.6 s loop ───────────── */
let DBG = null;
function buildDemoBg() {
  const c2 = document.createElement('canvas'); c2.width = 520; c2.height = 240; const old = X; X = c2.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, '#4aa8f0'); gr.addColorStop(1, '#e4f6ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.beginPath(); X.moveTo(0, 190); for (const [x, y] of [[0, 150], [70, 92], [150, 140], [240, 84], [330, 150], [420, 96], [520, 146]]) X.lineTo(x, y); X.lineTo(520, 200); X.closePath(); ink('#9aa9d8', 2.5);
  gr = X.createLinearGradient(0, 196, 0, 240); gr.addColorStop(0, '#7fd05a'); gr.addColorStop(1, '#5fb944'); X.fillStyle = gr; X.fillRect(0, 196, 520, 44);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 196); X.lineTo(520, 196); X.stroke();
  X.fillStyle = '#e8c48a'; X.fillRect(0, 214, 520, 12);
  X = old; return c2;
}
function demo(role, tm) {
  X = ctx; if (!DBG) DBG = buildDemoBg(); X.drawImage(DBG, 0, 0);
  const u = tm % 3.6, sd = role === 0 ? -1 : 1, me2 = role === 0 ? '#FFC93C' : '#6EA8FE', fr = role === 0 ? '#6EA8FE' : '#FFC93C';
  // the gust blows toward MY end: the cloud shows up on the far side, inflates (.0-.7), blows (.7-2.6)
  const inK = ease(u / .35), blowK = u < .7 ? 0 : u < 1.1 ? ease((u - .7) / .4) : u < 2.4 ? 1 : 1 - ease((u - 2.4) / .4);
  const lift = u < 1.0 ? 0 : u < 1.35 ? ease((u - 1.0) / .35) * .62 : u < 2.6 ? .62 : .62 - ease((u - 2.6) / .5) * .62;
  const s2 = u < 1.0 ? 0 : u < 1.5 ? sd * .5 * ease((u - 1.0) / .5) : u < 2.4 ? sd * lerp(.5, .05, ease((u - 1.5) / .7)) : sd * .05;
  X.save(); X.translate(260 - 400 * .5, 240 - 520 * .5 + 8); X.scale(.5, .5);
  windCloud(sd > 0 ? 150 : 650, 118, sd, inK, blowK, tm, .9); windArrow(sd > 0 ? 260 : 540, 124, sd, inK * (u < 1.4 ? 1 : 0), tm);
  const hl = role === 0 ? lift : 0, hr = role === 0 ? 0 : lift, yL = endY(hl), yR = endY(hr), geoA = Math.atan2(yR - yL, RX - LX);
  const cols = role === 0 ? [me2, fr] : [fr, me2];
  for (const [x, ey2, hh, i] of [[LX, yL, hl, 0], [RX, yR, hr, 1]]) { const y = GY - hh * 9; noodleArms(x, y, PU, x, ey2 + PT / 2 + 3, cols[i], 0); caos(x, y, PU, { col: cols[i] }); face(x, y, PU, cols[i], hh > .4 ? 'strain' : 'look', [sd * (i ? -1 : 1) * 0, -.6]); }
  X.save(); X.translate(LX, yL); X.rotate(geoA); const len = Math.hypot(RX - LX, yR - yL);
  rr(-34, -PT / 2, len + 68, PT, 6); ink('#e0a35e', 4);
  const cx0 = (400 - LX) / Math.cos(geoA) - (ZONE * TRK + 18); rr(cx0, -PT / 2 - CUSH - 4, (ZONE * TRK + 18) * 2, CUSH + 8, 9); ink('#ff9ccb', 3.5); X.restore();
  for (const [x, ey2, i] of [[LX, yL, 0], [RX, yR, 1]]) hands(PU, x, ey2 + PT / 2, cols[i]);
  const ex = 400 + s2 * TRK, yp = yL + (yR - yL) * (ex - LX) / (RX - LX), c = CUSH * clamp((ZONE * TRK + 18 - Math.abs(ex - 400)) / 18, 0, 1), d = PT / 2 + c + ERY - 3;
  const mood = Math.abs(s2) < .2 && u > 2.2 ? 'sleep' : Math.abs(s2) > .3 ? 'scared' : 'awake';
  egg(ex + Math.sin(geoA) * d, yp - Math.cos(geoA) * d, geoA + .26 * Math.sin(s2 * TRK / ERX * .9), { mood, t: tm, look: [sd, .2] });
  if (u > .3 && u < 1.6) bang((sd > 0 ? RX : LX) + sd * 46, GY - 80, 1, '#ff4d5e');
  X.restore();
  // my lift lever on my side, the finger slides it up while the gust pushes
  const gx = role === 0 ? 34 : 486, top = 46, bot = 196, ky = bot - (bot - top) * lift;
  rr(gx - 18, top - 16, 36, bot - top + 32, 18); ink('#8f7aa8', 3); rr(gx - 6, top - 3, 12, bot - top + 6, 6); ink('#3b3550', 2);
  X.save(); rr(gx - 6, top - 3, 12, bot - top + 6, 6); X.clip(); X.fillStyle = me2; X.fillRect(gx - 6, ky, 12, bot - ky + 4); X.restore();
  X.beginPath(); X.arc(gx, ky, 15, 0, TAU); ink(me2, 3);
  if (u > .9 && u < 2.7) badge('LIFT!', gx + (role === 0 ? 62 : -62), ky - 6, 18, '#ff7a3d', '#fff', 1, 0);
  demoFinger(gx, ky + 2, u > .95 && u < 2.7, u > .95 ? ((u - .95) * 1.6) % 1 : 0);
}
DUO.INFO.du_seesaw = [['LEFT CARRIER', 'EGG ROLLING YOUR WAY? LIFT!', 'DRAG UP TO LIFT YOUR END'], ['RIGHT CARRIER', 'EGG ROLLING YOUR WAY? LIFT!', 'DRAG UP TO LIFT YOUR END']];
DUO.DEMOS.du_seesaw = [tm => demo(0, tm), tm => demo(1, tm)];

})();
