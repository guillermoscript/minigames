'use strict';
/* ═════════ DUO · PLANK & NAIL (du_bridge) ═════════
   A rickety rope bridge over a river has lost its planks and a very impatient conga line of ducks is queuing up to cross it (the bread
   is on the other side). Four gaps, four planks.
   CARRIER (role 0): rides a basket on a swaying cable (pointer x / ◄ ► / A D) with a plank hanging from a rope under it. The plank swings
   like a pendulum (every move sets it swinging), so the drop (click / Space; touch: let go) has to be timed so it lands square on a gap:
   a ghost plank shows where it would land and how crooked. A dropped plank is only wobbly-laid: it needs 2 nails or the river takes it.
   HAMMERER (role 1, JUDGE): rows a boat under the bridge (pointer x / ◄ ► / A D) with a hammer that swings like a metronome. Tap (click /
   Space; touch: let go) when the head passes through the green: a nail goes in. Tap a little off and the nail goes in half-way (BENT): it
   sticks out and the carrier's hook is LOCKED until a clean hit sinks it. A plank with no nails stops the parade; a plank with one nail
   holds it up slowly; a plank under the parade that runs out of time gives out and the ducks go PLOP (they float happily).
   Netcode: the CARRIER owns the basket: 'tr' [x, θ×1000] (coalesced, ≤10/s) and 'drop' {id, x0, a0, xl, tl} the moment it lets go of the
   plank (xl = where it will land, tl = its tilt, both computed from the carrier's own swing). The HAMMERER (judge) owns the bridge: when
   the plank has fallen it answers 'lay' {id, s, q} / 'rej' {id}, plus 'hit' {s, k, n}, 'brk' {s}, and 'st' [seq, parade, hammer x, 5 numbers
   per slot] (coalesced, ≤10/s). The carrier lays the plank on its own screen at once (a snapshot with an empty slot is ignored for a moment)
   and takes it back if the judge refuses. The parade, the loose timers and the verdict are all the judge's ('end', via wire). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const NS = 4, X0 = 159, PITCH = 118, PW = 108, PH = 24;     // four gaps; slot i spans X0 + PITCH·i … + PITCH
const DY = 380;                                              // the deck (and both banks) top
const cxOf = i => X0 + PITCH * i + PITCH / 2;
const XEND = X0 + PITCH * NS;                                // 631: where the right bank starts
const CAB = [108, 158, 772];                                 // cable: left tower x, y, right tower x
const cabY = x => CAB[1] + 11 * (1 - ((x - 440) / 332) ** 2);
const LP = 92, BASK = 70;                                    // rope length, pivot below the cable
const TMIN = 170, TMAX = 620;                                // where the basket can go
const HY = 470, HL = 82, HMIN = 192, HMAX = 600, HOFF = 30; // hammer pivot height, length, boat x range, boat offset from the pivot
const BOATY = 496;
const WATERY = 432;
const DUCKS = 4, DGAP = 38, WINX = 672, BREADX = 742;
const FALL = .28;                                            // plank fall time (s)
const RELOAD = .6;
const KP = 17, CD = 2.4, ACC = 1100, VMAX = 330;             // pendulum stiffness, damping, basket acceleration / speed
const AMP = 1.05, GZ = .44, YZ = .7;                         // hammer swing amplitude, clean (green) and half-in (yellow) zones (rad)
const OMEGA = TAU / 1.7;                                      // hammer swing speed
const LOOSE = 5.6, LOOSE_C = 3.8, LOOSE_1 = 3.4;             // seconds a loose plank survives (square, crooked, after the first nail)
const VP = 125;                                               // parade speed

/* palette */
const WOOD = '#d9944f', WOOD2 = '#a5622c', WOODL = '#f2b878', GRAIN = '#c4803f';
const DUCK = '#ffd84a', DUCK2 = '#e0a91c', DUCKL = '#fff0a0', BEAK = '#ff8a2a';
const WATER = '#62d3f0', WATER2 = '#2a8fcb';
const ROPE = '#e6c58c', ROPE2 = '#a88a58';
const STEEL = '#cfd8e6', STEEL2 = '#8f9cb3';
const OK = '#5CFF7A', MID = '#ffd23f', BAD = '#ff4d5e';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tube(pts, w, col) { line(pts, w + 6, INK); line(pts, w, col); }
function pill(x, y, label, col, up) {                // a name tag with a little pointer (down, or up)
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
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
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function sweat(x, y, s, T) { const k = (T * 2.2) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
/* two thin blocky arms from claude()'s side stubs; a = angle (0 = up), k = 0..1 raised (drawn before claude()) */
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
function hardHat(x, y, u, col) {                      // sits on top of claude() (y = its feet)
  X.save(); X.translate(x, y - 9 * u - 1); el(0, -1.2 * u, 4 * u, 2.6 * u); ink(col, 3); rr(-5.6 * u, -1.3 * u, 11.2 * u, 2.1 * u, u * .9); ink(col, 3);
  X.fillStyle = 'rgba(255,255,255,.5)'; el(-1.6 * u, -2.2 * u, 1.3 * u, .7 * u, -.4); X.fill(); X.restore();
}
function drop(x, y, r, col) {
  X.beginPath(); X.moveTo(x, y - r * 1.7); X.quadraticCurveTo(x + r * 1.1, y - r * .2, x, y + r); X.quadraticCurveTo(x - r * 1.1, y - r * .2, x, y - r * 1.7); X.closePath();
  ink(col || WATER, 2); X.fillStyle = 'rgba(255,255,255,.75)'; el(x - r * .3, y - r * .3, r * .28, r * .4, -.4); X.fill();
}

/* ───────────── props ───────────── */
/* a plank centred at (0, 0) after translate: nails = [state, state] (0 hole, 1 driven, 2 bent), hot = 0..1 how close it is to giving out, lit = shine */
function plank(w, nails, hot, lit) {
  const h = PH, x = -w / 2, y = -h / 2;
  rr(x, y, w, h, 5); ink(WOOD, 4);
  X.save(); rr(x, y, w, h, 5); X.clip();
  X.fillStyle = WOOD2; X.fillRect(x, y + h * .62, w, h); X.fillStyle = WOODL; X.fillRect(x, y, w, h * .24);
  X.strokeStyle = GRAIN; X.lineWidth = 1.6; for (const [a, b, c] of [[-.3, -.1, .5], [.1, .2, .7], [-.2, .3, .3]]) { X.beginPath(); X.moveTo(w * a - w * .2, y + h * c); X.lineTo(w * b + w * .24, y + h * c + 1); X.stroke(); }
  if (hot > 0) { X.fillStyle = `rgba(255,77,94,${(.15 + .3 * Math.abs(Math.sin(now * 9))) * hot})`; X.fillRect(x, y, w, h); }
  if (lit) { X.fillStyle = `rgba(255,255,255,${.35 * lit})`; X.fillRect(x, y, w, h); }
  X.restore();
  for (let i = 0; i < 2; i++) {
    const nx = (i ? 1 : -1) * (w / 2 - 15), st = nails ? nails[i] : 0;
    if (st === 2) { X.save(); X.translate(nx, 0); X.rotate(.5); rr(-1.6, -17, 3.2, 17, 1.4); ink('#ff8a8a', 1.6); el(0, -18, 5, 2.4); ink('#ff4d5e', 2); X.restore(); }
    else if (st === 1) { X.beginPath(); X.arc(nx, 0, 4.2, 0, TAU); ink(STEEL, 2.4); X.fillStyle = 'rgba(255,255,255,.8)'; el(nx - 1.3, -1.5, 1.4, .9); X.fill(); }
    else { X.beginPath(); X.arc(nx, 0, 3.4, 0, TAU); X.fillStyle = 'rgba(60,30,10,.7)'; X.fill(); }
  }
}
/* the sling: two ropes from the pivot to the plank ends, a hook ring on top */
function sling(px, py, qx, qy, ang, w) {
  const ca = Math.cos(ang), sa = Math.sin(ang), a = [qx - ca * (w / 2 - 6), qy - sa * (w / 2 - 6)], b = [qx + ca * (w / 2 - 6), qy + sa * (w / 2 - 6)];
  tube([[px, py], a], 3, ROPE); tube([[px, py], b], 3, ROPE);
  X.beginPath(); X.arc(px, py, 5, 0, TAU); ink(STEEL, 2.5);
}
function duck(x, y, s, o) {                           // feet at (x, y); o: { dir, hat, mood, ph, lean, sink }
  o = o || {}; const dir = o.dir || 1, mood = o.mood || 'calm', ph = o.ph || 0, bob = mood === 'float' ? Math.sin(ph) * 2 : Math.abs(Math.sin(ph)) * (mood === 'happy' ? 7 : 3);
  X.save(); X.translate(x, y); X.scale(s * dir, s); if (o.lean) X.rotate(o.lean);
  if (mood === 'float') { /* body mostly under water: clipped at the waterline by the caller */ }
  const wa = mood === 'happy' ? Math.sin(ph * 2) * .5 : 0;
  // feet
  if (mood !== 'float') for (const k of [0, 1]) { const lift = Math.max(0, Math.sin(ph + k * Math.PI)) * 5; X.beginPath(); X.moveTo(-3 + k * 9, -4 - lift); X.lineTo(-3 + k * 9 + 8, -lift); X.lineTo(-3 + k * 9 - 3, -lift); X.closePath(); ink(BEAK, 2.5); }
  X.translate(0, -bob);
  // tail + body
  X.beginPath(); X.moveTo(-14, -16); X.lineTo(-24, -24); X.lineTo(-12, -22); X.closePath(); ink(DUCK2, 2.8);
  el(0, -13, 16, 11.5); ink(DUCK, 3.5);
  X.save(); el(0, -13, 16, 11.5); X.clip(); X.fillStyle = DUCK2; el(2, -4, 18, 8); X.fill(); X.fillStyle = DUCKL; el(-5, -19, 8, 3.4, -.3); X.fill(); X.restore();
  X.save(); X.translate(-3, -13); X.rotate(wa - .2); el(0, 0, 8, 5); ink(DUCK2, 2.5); X.restore();   // wing
  // head
  X.beginPath(); X.arc(10, -27, 9.4, 0, TAU); ink(DUCK, 3.5); X.fillStyle = DUCKL; el(6, -31, 4, 2.2, -.5); X.fill();
  const open = mood === 'happy' || mood === 'panic' ? 3 : 0;
  rr(16, -27 + open * .3, 11, 5, 2.6); ink(BEAK, 2.5); if (open) { rr(16, -22, 10, 3.2, 1.6); ink('#ff6a2a', 2); }
  X.fillStyle = 'rgba(255,110,150,.5)'; el(12, -23, 3, 2); X.fill();
  const ex = 11, ey = -29;
  if (mood === 'happy' || mood === 'float') { X.strokeStyle = INK; X.lineWidth = 2.4; X.lineCap = 'round'; X.beginPath(); X.arc(ex, ey + 1.5, 2.8, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
  else if (mood === 'wait') { el(ex, ey, 3.4, 3.4); ink('#fff', 1.6); X.fillStyle = INK; el(ex + 1.2, ey + 1, 1.5, 1.5); X.fill(); X.strokeStyle = INK; X.lineWidth = 2.4; X.beginPath(); X.moveTo(ex - 5, ey - 6); X.lineTo(ex + 4, ey - 3.4); X.stroke(); }
  else { const big = mood === 'panic' ? 4.4 : 3.4; el(ex, ey, big, big); ink('#fff', 1.6); X.fillStyle = INK; el(ex + 1, ey, mood === 'panic' ? 1.1 : 1.7, mood === 'panic' ? 1.1 : 1.7); X.fill(); }
  // hats
  const h = o.hat || 0; X.save(); X.translate(9, -35);
  if (h === 0) { rr(-8, -9, 16, 11, 2); ink('#2a2540', 2.5); X.fillStyle = '#ff4d6d'; X.fillRect(-8, -2, 16, 3); rr(-12, 0, 24, 4, 2); ink('#2a2540', 2.5); }
  else if (h === 1) { X.beginPath(); X.moveTo(-7, 1); X.lineTo(0, -17); X.lineTo(7, 1); X.closePath(); ink('#ff5fb0', 2.5); X.beginPath(); X.arc(0, -18, 3.2, 0, TAU); ink('#fff', 2); }
  else if (h === 2) { X.beginPath(); X.moveTo(-9, 2); X.lineTo(-10, -9); X.lineTo(-4, -3); X.lineTo(0, -12); X.lineTo(4, -3); X.lineTo(10, -9); X.lineTo(9, 2); X.closePath(); ink('#ffd23f', 2.5); X.fillStyle = '#ff4d6d'; X.beginPath(); X.arc(0, -3, 1.8, 0, TAU); X.fill(); }
  else { el(0, 1, 13, 3.4); ink('#f3d27a', 2.5); el(0, -3, 7, 6); ink('#f3d27a', 2.5); X.fillStyle = '#ff5c8a'; X.fillRect(-7, -1, 14, 2.4); }
  X.restore();
  X.restore();
}
function cloud(x, y, s) { X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]; for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); }
function loaf(x, y, s, T, wob) {                       // the giant bread: base at (x, y)
  X.save(); X.translate(x, y); X.scale(s, s); X.rotate(wob || 0);
  X.beginPath(); X.moveTo(-40, 0); X.bezierCurveTo(-52, -34, -30, -64, 0, -64); X.bezierCurveTo(30, -64, 52, -34, 40, 0); X.closePath(); ink('#d99a4a', 4);
  X.save(); X.clip(); X.fillStyle = '#b8742e'; X.fillRect(-60, -16, 120, 30); X.fillStyle = '#f0bb6a'; el(-14, -46, 22, 12, -.4); X.fill(); X.restore();
  X.strokeStyle = '#a2601e'; X.lineWidth = 4; X.lineCap = 'round'; for (const a of [-16, 0, 16]) { X.beginPath(); X.moveTo(a - 5, -50); X.quadraticCurveTo(a + 2, -42, a - 1, -30); X.stroke(); }
  X.restore();
}
/* the fisherman: a sleepy bear on a ledge, rod over the water. (x, y) = where it sits */
function bear(x, y, T) {
  const br = Math.sin(T * 1.6) * 1.5;
  X.save(); X.translate(x, y);
  rr(-24, -34, 48, 36, 16); ink('#3f9a5a', 4);                                   // sweater
  el(-6, 4, 11, 8); ink('#8a5a33', 3.5); el(14, 6, 11, 8); ink('#8a5a33', 3.5);   // feet
  X.save(); X.translate(0, -34 + br);
  for (const sx of [-1, 1]) { X.beginPath(); X.arc(sx * 17, -17, 8, 0, TAU); ink('#8a5a33', 3.2); }
  X.beginPath(); X.arc(0, -8, 21, 0, TAU); ink('#a8743f', 4); el(2, -2, 11, 8); ink('#e8c08a', 3); el(4, -4, 3.2, 2.4); X.fillStyle = INK; X.fill();
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; for (const ex of [-7, 9]) { X.beginPath(); X.arc(ex, -9, 3.4, .2, Math.PI - .2); X.stroke(); }
  el(0, -19, 27, 5); ink('#f3d27a', 3.2); rr(-14, -34, 28, 18, 8); ink('#f3d27a', 3.2); X.fillStyle = '#d9534f'; X.fillRect(-14, -22, 28, 4);   // straw hat over the eyes
  X.restore(); X.restore();
  txt('Z', x + 22, y - 74 - (T * 14 % 22), 18 + (T * 14 % 22) * .3, '#fff'); txt('z', x + 36, y - 60 - ((T * 14 + 11) % 22), 14, '#fff');
}
function turtle(x, y, T, dir) {
  X.save(); X.translate(x, y + Math.sin(T * 2) * 2); X.scale(dir, 1);
  X.save(); X.translate(-14, 4); X.rotate(Math.sin(T * 3) * .4); el(0, 4, 5, 9, .5); ink('#6cc04a', 2.5); X.restore();
  el(12, -2, 8, 7); ink('#6cc04a', 3); X.fillStyle = INK; X.beginPath(); X.arc(15, -4, 1.8, 0, TAU); X.fill();
  X.beginPath(); X.moveTo(-24, 4); X.bezierCurveTo(-24, -22, 18, -22, 18, 4); X.closePath(); ink('#3f9a55', 4); X.fillStyle = '#5bcf72'; X.beginPath(); X.moveTo(-14, -8); X.quadraticCurveTo(-4, -16, 6, -8); X.quadraticCurveTo(-4, -2, -14, -8); X.fill();
  X.fillStyle = 'rgba(255,255,255,.4)'; el(-8, -13, 6, 2.4, -.4); X.fill();
  X.restore();
}
/* the boat with the hammerer: hull centre (x, y) */
function boat(x, y, T, rock) {
  X.save(); X.translate(x, y + Math.sin(T * 2.4) * 2); X.rotate(Math.sin(T * 1.9) * .025 + (rock || 0));
  X.beginPath(); X.moveTo(-54, -16); X.lineTo(54, -16); X.quadraticCurveTo(48, 24, 20, 26); X.lineTo(-20, 26); X.quadraticCurveTo(-48, 24, -54, -16); X.closePath(); ink('#ff6b4d', 4);
  X.save(); X.clip(); X.fillStyle = '#c84a30'; X.fillRect(-60, 8, 120, 30); X.fillStyle = '#fff3dc'; X.fillRect(-60, -6, 120, 7); X.restore();
  X.fillStyle = 'rgba(255,255,255,.4)'; el(-26, -9, 14, 2.4, -.1); X.fill();
  X.restore();
}
/* the front lip of the boat, drawn over the legs of whoever stands in it */
function boatLip(x, y, T, rock) {
  X.save(); X.translate(x, y + Math.sin(T * 2.4) * 2); X.rotate(Math.sin(T * 1.9) * .025 + (rock || 0));
  X.beginPath(); X.moveTo(-52, -16); X.lineTo(52, -16); X.lineTo(50, -3); X.quadraticCurveTo(0, 2, -50, -3); X.closePath(); ink('#fff3dc', 4);
  X.fillStyle = '#ff6b4d'; X.fillRect(-48, -8, 96, 4); X.restore();
}
/* a name tag that sits beside someone (dir = which side the pointer points to) */
function sideTag(x, y, label, col, dir) {
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  X.beginPath(); X.moveTo(x - dir * w / 2 + dir * 2, y - 7); X.lineTo(x - dir * w / 2 - dir * 12, y); X.lineTo(x - dir * w / 2 + dir * 2, y + 7); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
/* the hammer: pivot (px, py), angle φ (0 = straight up), swing trail */
function hammer(px, py, phi, T, hit) {
  X.save(); X.translate(px, py); X.rotate(phi);
  tube([[0, 16], [0, -HL + 14]], 8, '#d9a066');
  X.save(); X.translate(0, -HL); if (hit) X.scale(1 + hit * .15, 1 - hit * .1);
  rr(-21, -13, 42, 24, 6); ink(STEEL, 4); X.fillStyle = STEEL2; X.fillRect(-19, 3, 38, 6); X.fillStyle = 'rgba(255,255,255,.8)'; rr(-17, -10, 22, 5, 2.5); X.fill();
  rr(-27, -9, 8, 16, 3); ink(STEEL2, 3);
  X.restore(); X.restore();
}

/* ───────────── the scene, baked once ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 430); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  const mount = (pts, fill, ol, snow) => { X.beginPath(); X.moveTo(pts[0][0], 430); pts.forEach(([a, b]) => X.lineTo(a, b)); X.lineTo(pts[pts.length - 1][0], 430); X.closePath(); X.fillStyle = fill; X.fill(); X.lineWidth = 3; X.strokeStyle = ol; X.lineJoin = 'round'; X.stroke();
    if (snow) { X.fillStyle = '#f6f8ff'; for (const [a, b] of snow) { X.beginPath(); X.moveTo(a, b); X.lineTo(a - 26, b + 30); X.lineTo(a - 9, b + 24); X.lineTo(a, b + 36); X.lineTo(a + 10, b + 24); X.lineTo(a + 24, b + 30); X.closePath(); X.fill(); } } };
  mount([[0, 372], [90, 296], [170, 352], [260, 270], [360, 350], [450, 300], [560, 360], [650, 282], [740, 342], [800, 310], [800, 430]], '#c9d0fb', '#7b80c6', [[260, 270], [650, 282]]);
  mount([[0, 404], [120, 350], [250, 396], [380, 346], [520, 398], [640, 352], [800, 402], [800, 430]], '#a4b1f2', '#5b5fa8', [[380, 346]]);
  // far hills with lollipop trees, the far shore under the bridge
  X.fillStyle = '#87d19b'; X.beginPath(); X.moveTo(0, 430); for (let x = 0; x <= W; x += 20) X.lineTo(x, 404 - Math.sin(x * .02 + 1) * 10 - Math.sin(x * .05) * 4); X.lineTo(W, 430); X.closePath(); X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
  for (const [x, y, r] of [[190, 398, 13], [262, 392, 16], [340, 400, 12], [430, 394, 15], [520, 399, 13], [596, 393, 16], [670, 398, 12]]) { rr(x - 3, y, 6, 22, 2); ink('#8a5a34', 2); X.beginPath(); X.arc(x, y - 4, r, 0, TAU); ink('#3fb260', 3); X.fillStyle = 'rgba(255,255,255,.28)'; el(x - r * .35, y - r * .5, r * .3, r * .16, -.5); X.fill(); }
  // the river
  g = X.createLinearGradient(0, WATERY, 0, H); g.addColorStop(0, WATER); g.addColorStop(1, WATER2); X.fillStyle = g; X.fillRect(0, WATERY, W, H - WATERY);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, WATERY); X.lineTo(W, WATERY); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.14)'; for (let i = -2; i < 10; i++) { X.beginPath(); X.moveTo(i * 100, H); X.lineTo(i * 100 + 40, H); X.lineTo(i * 100 + 120, WATERY); X.lineTo(i * 100 + 90, WATERY); X.fill(); }
  // the banks (rock faces) with grass lips
  const bank = (x0, x1, edge) => {
    X.beginPath(); X.moveTo(x0, DY); X.lineTo(x1, DY); X.lineTo(x1, H); X.lineTo(x0, H); X.closePath(); ink('#b98a5e', 5);
    X.save(); X.clip(); X.fillStyle = '#9c6f47'; for (let y = DY + 40; y < H; y += 56) { X.fillRect(x0, y, x1 - x0, 6); }
    X.fillStyle = '#d3a574'; for (const [a, b, c] of [[.2, 80, 26], [.6, 150, 18], [.35, 220, 30], [.7, 28, 14]]) { el(x0 + (x1 - x0) * a, DY + b, c, 7, -.1); X.fill(); }
    X.fillStyle = 'rgba(20,16,28,.22)'; X.fillRect(edge < 0 ? x1 - 18 : x0, DY, 18, H); X.restore();
    X.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 7; i++) { el(edge < 0 ? x1 + 3 : x0 - 3, H - 8 - i * 12, 6, 3.4); X.fill(); }   // foam at the foot of the cliff
    rr(x0 - 6, DY - 12, x1 - x0 + 6, 20, 8); ink('#7cd46f', 4); X.fillStyle = '#b2f27f'; X.fillRect(x0, DY - 8, x1 - x0, 4);
    X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; for (let x = x0 + 12; x < x1 - 6; x += 26) { X.beginPath(); X.moveTo(x, DY - 12); X.lineTo(x - 3, DY - 20); X.moveTo(x, DY - 12); X.lineTo(x + 4, DY - 19); X.stroke(); }
  };
  bank(-10, X0, -1); bank(XEND, W + 10, 1);
  // rope anchors: two posts at each end of the bridge, the cable towers behind them
  for (const tx of [CAB[0], CAB[2]]) { rr(tx - 8, CAB[1] - 6, 16, DY - CAB[1] + 4, 4); ink('#8a5a34', 4); X.fillStyle = '#6e4526'; X.fillRect(tx + 1, CAB[1], 5, DY - CAB[1] - 6); X.beginPath(); X.arc(tx, CAB[1] - 2, 10, 0, TAU); ink(STEEL, 3); }
  for (const px of [X0 - 6, XEND + 6]) { rr(px - 6, DY - 52, 12, 60, 4); ink('#b06d33', 3.5); X.fillStyle = WOODL; X.fillRect(px - 3, DY - 48, 3, 50); X.beginPath(); X.arc(px, DY - 54, 8, 0, TAU); ink('#d9944f', 3); }
  // the bridge's far handrail (a drooping rope) with hanging ties; the deck ropes where planks are missing
  const rail = []; for (let i = 0; i <= 24; i++) { const k = i / 24; rail.push([lerp(X0 - 6, XEND + 6, k), DY - 52 + Math.sin(k * Math.PI) * 22]); }
  tube(rail, 4, ROPE);
  for (let i = 0; i <= NS; i++) { const x = X0 + PITCH * i, k = (x - (X0 - 6)) / (XEND - X0 + 12), y = DY - 52 + Math.sin(clamp(k, 0, 1) * Math.PI) * 22; if (i > 0 && i < NS) tube([[x, y], [x, DY - 8]], 2.6, ROPE); }
  for (const y of [DY + 2, DY + 14]) { const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push([lerp(X0, XEND, k), y + Math.sin(k * Math.PI) * 5]); } tube(pts, 4.5, '#b88a50'); }
  // sign "BRIDGE OUT" on the left bank, a picnic cloth + sign on the right bank
  X.save(); X.translate(34, DY - 12); rr(-5, -36, 10, 40, 3); ink('#b06d33', 3); X.rotate(-.05); rr(-34, -66, 68, 34, 7); ink('#ffd23f', 3.5); X.fillStyle = INK; X.fillRect(-26, -50, 52, 3); X.restore();
  X.save(); X.translate(704, DY - 4); X.beginPath(); X.moveTo(-46, 0); X.lineTo(50, 0); X.lineTo(60, 8); X.lineTo(-56, 8); X.closePath(); ink('#ff4d6d', 3.5); X.fillStyle = '#fff'; for (let i = -42; i < 50; i += 18) X.fillRect(i, 1, 9, 6); X.restore();
  X = old; return cv2;
}

/* ───────────── cosmetic randomness + focus ───────────── */
let CS = 31; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* where a dropped plank would land: the empty slot nearest to xl, how off-centre / crooked it is. e<=.75 square, <=1.3 crooked, else it misses */
function evalDrop(xl, tl, empty) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < NS; i++) if (empty(i)) { const d = Math.abs(xl - cxOf(i)); if (d < bd) { bd = d; best = i; } }
  if (best < 0 || bd > 56) return { s: -1, q: 0, e: 9 };
  const e = bd / 52 + Math.abs(tl) / .55;
  return e <= .75 ? { s: best, q: 2, e } : e <= 1.3 ? { s: best, q: 1, e } : { s: -1, q: 0, e };
}

/* ═════════ the game ═════════ */
function duBridge(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), carrier = D.role === 0, TS = Math.sqrt(sp);
  const PH0 = R() * TAU;                                  // hammer swing phase (same on both screens)
  const variant = R() < 1 / 8;                            // 1 round in 8: a goat is waiting at the far end instead of the bread
  const S = Array.from({ length: NS }, () => ({ has: 0, nails: 0, bent: 0, t: 0, tl: 0, id: -1, at: -9, hitAt: -9, opt: -9 }));
  const drifts = [], bits = [], pops = [], inflight = [];
  const trX = track(), trA = track(), hxT = track(), pfT = track();
  let wc = 0;                                             // the world clock: runs TS× faster in later rounds
  /* carrier state */
  let tx = 400, bx = 400, bv = 0, th = 0, om = 0, kx = 0, fN = FOCUSN, have = true, reloadAt = -9, nid = 0, lastTr = '', trSent = -9, fall = null, pend = null, lockMsg = -9, pd = null, relX = -9;
  /* hammerer state */
  let hx = cxOf(1), htx = hx, cd = 0, hitFx = 0, seq = 0, snapAt = -9, lastSnap = '', stSeq = -1, hitK = 0, hitS = -1;
  /* shared (judge computes, carrier mirrors) */
  let pf = 118, pv = 0, loseAt = -1, winAt = -1, lostBy = -1, resAt = -1, pfEnd = 0, ending = null;
  const swing = w => AMP * Math.sin(OMEGA * w + PH0);
  const dswing = w => AMP * OMEGA * Math.cos(OMEGA * w + PH0);
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const locked = () => S.some(s => s.has && s.bent);
  const empty = i => !S[i].has;
  const nextEmpty = () => { for (let i = 0; i < NS; i++) if (!S[i].has) return i; return -1; };
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, vr: 0, rot: 0, k: 0 }, o)); }
  function splash(x, y, n) { for (let i = 0; i < n; i++) bit({ x: x + (cr() - .5) * 30, y, vx: (cr() - .5) * 240, vy: -(160 + cr() * 240), r: 3 + cr() * 3, c: WATER }); }
  function dust(x, y, n) { for (let i = 0; i < n; i++) bit({ k: 3, x: x + (cr() - .5) * 70, y: y - 4, vx: (cr() - .5) * 120, vy: -(20 + cr() * 60), gr: 60, r: 4 + cr() * 4, life: .5 }); }
  function chips(x, y, n) { for (let i = 0; i < n; i++) bit({ k: 4, x: x + (cr() - .5) * 20, y, vx: (cr() - .5) * 200, vy: -(120 + cr() * 160), gr: 900, r: 2 + cr() * 2, life: .6, vr: (cr() - .5) * 20 }); }
  function layFx(s, q) { const x = cxOf(s); dust(x, DY, 6); sfx.thud(); shake(3, .1); if (q === 1) pop('CROOKED', x, DY - 70, 24, '#ff9a4d', '#fff'); else pop('SQUARE!', x, DY - 70, 26, '#22a447', '#fff'); }
  function missFx(x) { splash(x, WATERY + 10, 9); sfx.splat(); pop('SPLASH!', clamp(x, 140, 660), 300, 26, '#2b9ee6', '#fff'); drifts.push({ x, y: DY - 8, ang: (cr() - .5) * .8, t0: g.c, sink: 1 }); }
  function hitFxAt(s, k, n) {
    const x = cxOf(s); S[s].hitAt = g.c; hitK = k === 'g' ? 1 : k === 'b' ? 2 : 0; hitS = s;
    if (k === 'g') { chips(x + (n >= 2 ? 30 : -30), DY - 6, 5); sfx.hit(); sfx.thud(); shake(3, .1); star(x + (n >= 2 ? 30 : -30), DY, 18, 5, 6, 0, '#fff', 0); pop(n >= 2 ? 'NAILED!' : 'CLANG!', x, DY - 70, 26, '#22a447', '#fff'); }
    else if (k === 'b') { sfx.buzz(); pop('BENT!', x, DY - 70, 26, '#e8434f', '#fff'); }
    else { sfx.click(); }
  }
  function breakPlank(s, occ) {
    const p = S[s]; p.has = 0; p.nails = 0; p.bent = 0; drifts.push({ x: cxOf(s), y: DY, ang: 0, t0: g.c, sink: 0, vx: 60 }); splash(cxOf(s), WATERY + 6, 8); sfx.splat();
    if (occ) pop('SNAP!', cxOf(s), DY - 80, 28, '#e8434f', '#fff');
  }
  function resolve(f) {                                    // judge: a plank has finished falling
    const ev = evalDrop(f.xl, f.tl, empty);
    if (g.result || ending) { D.send('rej', { id: f.id }); return; }
    if (locked() && ev.s >= 0) { D.send('rej', { id: f.id }); sfx.buzz(); pop('BONK!', clamp(f.xl, 140, 660), 330, 26, '#e8434f', '#fff'); return; }
    if (ev.s < 0) { missFx(f.xl); D.send('rej', { id: f.id, m: 1 }); return; }
    const p = S[ev.s]; Object.assign(p, { has: 1, nails: 0, bent: 0, t: ev.q === 2 ? LOOSE : LOOSE_C, tl: f.tl * .5, id: f.id, at: g.c, opt: -9 });
    D.send('lay', { id: f.id, s: ev.s, q: ev.q }); layFx(ev.s, ev.q); sendSnap(true);
  }
  function hit() {                                         // judge: tap
    if (g.result || ending || cd > 0 || g.c < .15) return;
    cd = .3; const phi = swing(wc), a = Math.abs(phi); let k = 'w', slot = -1;
    for (let i = 0; i < NS; i++) if (S[i].has && (S[i].nails < 2) && Math.abs(hx - cxOf(i)) < 54) slot = i;
    if (slot >= 0 && a < YZ) {
      const p = S[slot];
      if (a < GZ) { k = 'g'; p.nails++; p.bent = 0; if (p.nails === 1) p.t = Math.max(p.t, LOOSE_1); }
      else { k = 'b'; p.bent = 1; }
      hitFxAt(slot, k, p.nails); D.send('hit', { s: slot, k, n: p.nails }); sendSnap(true);
    } else { sfx.click(); hitK = 0; hitS = -1; hitFx = .25; D.send('hit', { s: -1, k: 'w', n: 0 }); }
    hitFx = Math.max(hitFx, .22);
  }
  function sendSnap(force) {
    const a = [++seq, Math.round(pf), Math.round(hx)]; S.forEach(s => a.push(s.has, s.nails, s.bent, Math.round(s.t * 10), Math.round(s.tl * 100)));
    const key = a.slice(1).join(); if (!force && key === lastSnap) return; if (!force && g.c - snapAt < .1) return;
    lastSnap = key; snapAt = g.c; D.send('st', a, true);
  }
  function doDrop() {                                      // carrier: let go of the plank
    if (!carrier || g.result || !have || g.c < .1) return;
    if (locked()) { if (g.c - lockMsg > .5) { lockMsg = g.c; sfx.buzz(); pop('LOCKED!', clamp(bx, 140, 660), 250, 24, '#e8434f', '#fff'); } return; }
    const hk = bx + LP * Math.sin(th), vhx = bv + LP * Math.cos(th) * om * TS;
    const xl = hk + vhx * FALL, tl = th + om * .1;
    have = false; reloadAt = g.c + RELOAD;
    fall = { t0: g.c, x0: hk, a0: th, xl, tl, id: nid, py: cabY(bx) + BASK + LP * Math.cos(th) };
    D.send('drop', { id: nid, x0: Math.round(hk), a0: Math.round(th * 100), xl: Math.round(xl), tl: Math.round(tl * 100) }); nid++;
    sfx.whoosh(false);
  }
  function act() { carrier ? doDrop() : hit(); }
  function setT(x) { tx = clamp(x, TMIN, TMAX); htx = clamp(x, HMIN, HMAX); }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: carrier ? 'DROP!' : 'NAIL!', roleLabel: carrier ? 'CARRIER' : 'HAMMERER',
    hint: carrier ? 'SLIDE THE BASKET (MOUSE OR ◄ ►), CLICK / SPACE TO DROP THE PLANK ON A GAP - IT SWINGS! YOUR FRIEND NAILS IT DOWN' : 'ROW UNDER A LOOSE PLANK (MOUSE OR ◄ ►), CLICK / SPACE WHEN THE HAMMER IS IN THE GREEN - LOOSE PLANKS FLOAT AWAY',
    thint: carrier ? 'DRAG THE BASKET, LET GO TO DROP THE PLANK ON A GAP - IT SWINGS! YOUR FRIEND NAILS IT DOWN' : 'DRAG THE BOAT UNDER A LOOSE PLANK, TAP WHEN THE HAMMER IS IN THE GREEN - LOOSE PLANKS FLOAT AWAY',
    update(dt) {
      g.c += dt; const dtw = Math.min(dt, .05) * TS; wc += dtw;
      if (g.result && resAt < 0) { resAt = g.c; pfEnd = carrier ? (pfT.at() === null ? pf : pfT.at()) : pf; }
      const done = !!(g.result || ending);
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kx = 0; pd = null; }
      cd = Math.max(0, cd - dt); hitFx = Math.max(0, hitFx - dt);
      if (carrier) {
        if (kx && !done) tx = clamp(tx + kx * 460 * dt, TMIN, TMAX);
        // the basket follows the pointer with limited speed; the plank under it swings like a pendulum
        const want = clamp((tx - bx) * 5.5, -VMAX * TS, VMAX * TS), nv = bv + clamp(want - bv, -ACC * dtw * TS, ACC * dtw * TS);
        const ax = dtw > 0 ? (nv - bv) / dtw : 0; bv = nv; bx += bv * dtw;
        om += (-KP * Math.sin(th) - CD * om - ax / TS * Math.cos(th) / LP * 1.0) * dtw; th += om * dtw; th = clamp(th, -1.3, 1.3);
        if (!have && g.c >= reloadAt && !fall) have = true;
        if (fall) {
          const k = (g.c - fall.t0) / FALL;
          if (k >= 1) {                                   // landed: predict what the judge will say
            const ev = evalDrop(fall.xl, fall.tl, empty), f = fall; fall = null;
            if (ev.s < 0) { missFx(f.xl); reloadAt = g.c + .1; }
            else { const p = S[ev.s]; Object.assign(p, { has: 1, nails: 0, bent: 0, t: ev.q === 2 ? LOOSE : LOOSE_C, tl: f.tl * .5, id: f.id, at: g.c, opt: g.c + 1.2 }); pend = { id: f.id, s: ev.s, at: g.c }; layFx(ev.s, ev.q); }
          }
        }
        const sh = Math.round(bx) + ',' + Math.round(th * 100); if (sh !== lastTr && g.c - trSent >= .1) { lastTr = sh; trSent = g.c; D.send('tr', [Math.round(bx), Math.round(th * 1000)], true); }
      } else {
        // hammerer: the boat follows the pointer; the judge runs the bridge
        if (kx && !done) htx = clamp(htx + kx * 440 * dt, HMIN, HMAX);
        if (!done) hx += (htx - hx) * Math.min(1, dt * 9);
        for (let i = inflight.length - 1; i >= 0; i--) if (g.c >= inflight[i].land) { const f = inflight[i]; inflight.splice(i, 1); resolve(f); }
        // loose planks run out of time
        for (let i = 0; i < NS; i++) {
          const p = S[i]; if (!p.has || p.nails >= 2) continue; p.t -= dtw;
          if (p.t <= 0 && !done) {
            const lo = X0 + PITCH * i, hi = lo + PITCH, occ = wc > .6 && Array.from({ length: DUCKS }, (_, q) => pf - q * DGAP).some(x => x > lo + 2 && x < hi);
            breakPlank(i, occ); D.send('brk', { s: i, o: occ ? 1 : 0 });
            if (occ && !g.result) { lostBy = i; loseAt = g.c; ending = { res: 'lose', at: g.c + .05 }; }
          }
        }
        // the parade walks over nailed planks
        if (!done && wc > .6) {
          let v = VP * (1 + .05 * Math.floor(wc / 4)) * dtw, step = v;
          for (let k = 0; k < NS; k++) {
            const bar = X0 + PITCH * k - 8;
            if (pf < bar + 4 && pf + step > bar && !(S[k].has && S[k].nails >= 1)) step = Math.max(0, bar - pf);
            if (pf >= bar && pf < bar + PITCH && S[k].nails < 2) step *= .55;
          }
          const ox = pf; pf += step; pv += ((pf - ox) / Math.max(dt, 1e-3) - pv) * Math.min(1, dt * 8);
          if (pf >= WINX && !ending) ending = { res: 'win', at: g.c + .05 };
        }
        if (!g.result) {
          if (ending && g.c >= Math.min(ending.at, g.limit)) { if (ending.res === 'lose') loseAt = loseAt < 0 ? g.c : loseAt; else winAt = g.c; g.finish(ending.res); }
          else if (!ending && g.c >= g.limit) { loseAt = g.c; g.finish('lose'); }
        }
        sendSnap(false);
      }
      if (pend && g.c - pend.at > 1.2) pend = null;
      if (g.result === 'win' && resAt >= 0 && g.c - resAt > .4 && cr() < dt * 16) bit({ k: 4, x: BREADX - 26, y: DY - 34, vx: -30 - cr() * 90, vy: -(80 + cr() * 120), gr: 800, r: 2 + cr() * 2, life: .6, vr: (cr() - .5) * 16 });
      if (!carrier) { /* nothing else */ }
      else { /* carrier */ }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = drifts.length - 1; i >= 0; i--) if (g.c - drifts[i].t0 > 2.4) drifts.splice(i, 1);
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
    },
    msg(type, d) {
      if (carrier) {
        if (type === 'st' && Array.isArray(d)) {
          if (d[0] <= stSeq) return; stSeq = d[0]; pfT.push(d[1]); hxT.push(d[2]); pf = d[1];
          for (let i = 0; i < NS; i++) {
            const p = S[i], o = 3 + i * 5; if (d[o] === undefined) break;
            if (!d[o] && p.opt > g.c) continue;            // my own plank, not confirmed yet: keep it
            p.has = d[o]; p.nails = d[o + 1]; p.bent = d[o + 2]; p.t = d[o + 3] / 10; p.tl = d[o + 4] / 100; if (!p.has) { p.bent = 0; p.nails = 0; }
          }
        } else if (type === 'lay' && d) { const p = S[d.s]; if (p) { if (!p.has) { Object.assign(p, { has: 1, nails: 0, bent: 0, t: d.q === 2 ? LOOSE : LOOSE_C, id: d.id, at: g.c }); layFx(d.s, d.q); } p.opt = -9; if (pend && pend.id === d.id) pend = null; } }
        else if (type === 'rej' && d) {
          if (pend && pend.id === d.id) { const ps = pend.s, p = S[ps]; pend = null; if (p.id === d.id) { p.has = 0; p.nails = 0; p.bent = 0; p.opt = -9; } if (d.m) missFx(cxOf(ps)); else { sfx.buzz(); pop('BONK!', cxOf(ps), 330, 26, '#e8434f', '#fff'); } have = false; reloadAt = g.c + .35; }
          else if (fall && fall.id === d.id) { fall = null; have = true; sfx.buzz(); pop('BONK!', 400, 300, 26, '#e8434f', '#fff'); }
        }
        else if (type === 'hit' && d) { if (d.s >= 0) hitFxAt(d.s, d.k, d.n); else hitK = 0; hitFx = .22; }
        else if (type === 'brk' && d) { const p = S[d.s]; if (p) { if (p.has) breakPlank(d.s, d.o); p.has = 0; p.nails = 0; p.bent = 0; if (d.o) { lostBy = d.s; } } }
      } else {
        if (type === 'tr' && Array.isArray(d)) { trX.push(d[0]); trA.push(d[1] / 1000); }
        else if (type === 'drop' && d) { inflight.push({ id: d.id, xl: d.xl, tl: d.tl / 100, x0: d.x0, a0: d.a0 / 100, land: g.c + FALL, t0: g.c, py: cabY(trX.at() === null ? 400 : trX.at()) + BASK + LP }); relX = g.c; }
      }
    },
    draw() { drawScene(); },
    down(p) { if (!TOUCH) { setT(p.x); act(); } else pd = { x: p.x, t: g.c, moved: false }; },
    move(p) { if (TOUCH && pd) { if (Math.abs(p.x - pd.x) > 14) pd.moved = true; if (pd.moved || g.c - pd.t > .18) setT(p.x); } else setT(p.x); },
    up(p) { if (TOUCH && pd) { if (pd.moved || g.c - pd.t > .18) setT(p.x); pd = null; act(); } },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1;
      else if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'ArrowUp')) act();
    },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } },
  };

  /* ───────────── drawing ───────────── */
  const ghost = () => {                                    // carrier: where would the plank land if I let go now
    const hk = bx + LP * Math.sin(th), vhx = bv + LP * Math.cos(th) * om * TS, xl = hk + vhx * FALL, tl = th + om * .1, ev = evalDrop(xl, tl, empty);
    return { x: xl, tl, e: ev.e, s: ev.s, q: ev.q };
  };
  const nailsOf = p => [p.nails >= 1 ? 1 : (p.bent ? 2 : 0), p.nails >= 2 ? 1 : (p.nails === 1 && p.bent ? 2 : 0)];
  function drawDuckLine(T, won, lost, rk) {
    const front = carrier ? (pfT.at() === null ? pf : pfT.at()) : pf, f0 = resAt >= 0 ? pfEnd : front;
    const stuck = !won && !lost && pvNow() < 6 && T > .8;
    if (stuck && T > 1.4) { const k = (T * .8) % 1, i = Math.floor(T * .8) % DUCKS; if (k < .55) badge(['HONK!', 'QUACK!', 'HURRY!', 'HONK!'][i], clamp(f0 - i * DGAP, 70, 400), DY - 74 - k * 8, 16, '#ff9a4d', '#fff', outBack(k / .15), -.06 + i * .03); }
    for (let i = DUCKS - 1; i >= 0; i--) {
      let x = f0 - i * DGAP, y = DY - 2, o = { dir: 1, hat: [2, 0, 1, 3][i], mood: 'calm', ph: T * 12 + i * 1.3 }; let sk = 0;
      if (stuck) { o.mood = 'wait'; o.ph = i % 2 ? T * 9 : 0; o.lean = .06 + (i === 0 ? .04 : 0) + Math.sin(T * 7 + i) * .02; }
      else if (!won && !lost && T < .6) { o.mood = 'calm'; }
      if (won && rk >= 0) {                                // conga to the bread: keep walking, hop, peck
        const lead = Math.min(BREADX - 52, f0 + rk * 170); x = lead - i * 34; o.mood = 'happy'; o.ph = T * 12 + i; y = DY - 2;
        if (lead >= BREADX - 53) { o.ph = T * 9 + i * 1.7; if (i === 0) o.lean = .22 + Math.sin(T * 16) * .12; }
      }
      if (lost && rk >= 0) {                               // PLOP: they jump / fall into the river and float away happily
        const d0 = Math.max(0, rk - i * .07), vy0 = -200, grav = 1500, tyy = vy0 * d0 + .5 * grav * d0 * d0;
        const bank = x < X0 - 6 ? (X0 + 30 - x) / .55 : 40;
        let yy = DY - 2 + tyy, xx = x + (d0 < .55 ? bank * d0 : bank * .55) * (x < X0 - 6 ? 1 : 1);
        if (yy >= WATERY + 18) { const w = d0 - .45; yy = WATERY + 18 + Math.sin(T * 5 + i * 2) * 2; xx += Math.min(1.2, Math.max(0, w)) * 40 * (i % 2 ? 1 : .6); sk = 1; o.mood = 'float'; o.ph = T * 5 + i; }
        else o.mood = 'panic', o.ph = T * 20;
        x = xx; y = yy;
      }
      if (sk) {
        X.save(); X.beginPath(); X.rect(x - 60, y - 80, 120, 66); X.clip(); duck(x, y + 16, 1.25, o); X.restore();
        X.fillStyle = 'rgba(255,255,255,.55)'; el(x, y - 3, 26, 5); X.fill(); X.lineWidth = 2; X.strokeStyle = 'rgba(255,255,255,.8)'; X.stroke();
      } else { shadowEl(x, DY - 1, 16); duck(x, y, 1.25, o); }
    }
  }
  function shadowEl(x, y, r) { X.fillStyle = 'rgba(20,16,28,.22)'; el(x, y, r, 3.4); X.fill(); }
  function drawPlankSlot(i, T, urgent) {
    const p = S[i], x = cxOf(i); if (!p.has) return;
    const k = clamp((T - p.at) / .25, 0, 1), sq = p.at > 0 ? 1 + Math.sin(k * Math.PI) * .12 * (1 - k) : 1;
    const hot = p.nails < 2 ? clamp(1 - p.t / 2.2, 0, 1) : 0, wob = p.nails < 2 ? Math.sin(T * (8 + 10 * hot)) * (.012 + .04 * hot) : 0;
    X.save(); X.translate(x, DY - PH / 2 + 1 + (p.nails < 2 ? Math.sin(T * 5 + i) * .8 : 0)); X.rotate(p.tl * .4 + wob); X.scale(1, sq);
    plank(PW, nailsOf(p), hot, S[i].hitAt > 0 && T - S[i].hitAt < .2 ? 1 - (T - S[i].hitAt) / .2 : 0); X.restore();
  }
  function drawScene() {
    const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    X = ctx; if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
    // sky life: sun, clouds, a bird
    X.save(); X.translate(572, 92); X.fillStyle = 'rgba(255,240,150,.45)'; for (let i = 0; i < 10; i++) { const a = T * .25 + i * TAU / 10; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a - .09) * 62, Math.sin(a - .09) * 62); X.lineTo(Math.cos(a + .09) * 62, Math.sin(a + .09) * 62); X.fill(); }
    X.beginPath(); X.arc(0, 0, 26, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(-8, -9, 8, 5, -.5); X.fill(); X.restore();
    cloud(((T * 7 + 60) % 980) - 140, 118, .9); cloud(((T * 5 + 520) % 980) - 140, 196, .7);
    { const bx2 = ((T * 46 + 300) % 1000) - 100, by = 236 + Math.sin(T * 1.3) * 12, fl = Math.sin(T * 12) * 5; X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(bx2 - 10, by - fl); X.quadraticCurveTo(bx2 - 4, by - 6, bx2, by); X.quadraticCurveTo(bx2 + 4, by - 6, bx2 + 10, by - fl); X.stroke(); }
    // river: moving glints, the turtle, the fisherman's ledge
    X.save(); X.beginPath(); X.rect(X0 - 4, WATERY, XEND - X0 + 8, H - WATERY); X.clip();
    X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 3; X.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const wy = WATERY + 22 + i * 19, wx = X0 + ((i * 97 + T * (22 + i * 3)) % (XEND - X0 + 60)) - 30, wl = 18 + (i % 3) * 8; X.beginPath(); X.moveTo(wx, wy); X.quadraticCurveTo(wx + wl / 2, wy - 4, wx + wl, wy); X.stroke(); }
    turtle(XEND - 30 - ((T * 9) % 330), 536, T, -1);
    X.restore();
    rr(0, 506, 150, 14, 5); ink('#b06d33', 3.5); X.fillStyle = WOODL; X.fillRect(8, 508, 134, 3);
    bear(86, 506, T);
    tube([[118, 440], [186, 470], [236, 494]], 3, '#d9a066'); X.beginPath(); X.moveTo(236, 494); X.lineTo(236, 504 + Math.sin(T * 2.3) * 1.5); X.lineWidth = 1.5; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.arc(236, 508 + Math.sin(T * 2.3) * 1.5, 5, 0, TAU); ink('#ff4d5e', 2);
    txt('BRIDGE', 34, DY - 62, 15, INK); txt('OUT!', 34, DY - 47, 15, '#e8434f');
    // loaf (or a goat) at the far end
    const bw = won && rk > .3 ? Math.sin((rk - .3) * 26) * .05 : 0;
    if (variant) goat(BREADX, DY - 2, T, won); else loaf(BREADX, DY - 4, 1, T, bw);
    // floating bits of broken planks
    for (const d of drifts) {
      const a = T - d.t0; X.save(); X.globalAlpha = clamp(1 - (a - 1.6) / .8, 0, 1);
      const yy = d.sink ? lerp(d.y, WATERY + 28, ease(a / .35)) + Math.sin(T * 4) * 2 : lerp(d.y, WATERY + 22, ease(a / .4)) + Math.sin(T * 3 + d.x) * 2;
      X.translate(d.x + (d.vx || 30) * a, yy); X.rotate((d.ang || 0) + a * .5 + Math.sin(T * 2) * .1); plank(PW, [0, 0], 0, 0); X.restore();
    }
    // planks laid on the bridge
    for (let i = 0; i < NS; i++) drawPlankSlot(i, T);
    // the loose-timer rings and the hammer zone (hammerer's view only)
    const hxNow = carrier ? (hxT.at() === null ? cxOf(1) : hxT.at()) : hx;
    const phi = swing(wc);
    // the parade
    drawDuckLine(T, won, lost, rk);
    // the blocked-by-bent-nail sign, ghost and arrows (carrier) / rings (hammerer)
    if (!g.result) {
      if (carrier) {
        const ne = nextEmpty();
        if (ne >= 0) { const x = cxOf(ne), by = DY - 78 + Math.sin(T * 5) * 4; X.save(); X.translate(x, by); X.beginPath(); X.moveTo(-14, -12); X.lineTo(14, -12); X.lineTo(0, 8); X.closePath(); ink('#ffe14d', 3.5); X.restore(); }
        if (have && !fall && !locked()) { const gh = ghost(); X.save(); X.translate(clamp(gh.x, 150, 650), DY - PH / 2); X.rotate(gh.tl * .5); X.globalAlpha = .75; rr(-PW / 2, -PH / 2, PW, PH, 5); X.lineWidth = 5; X.strokeStyle = gh.s < 0 ? BAD : gh.q === 2 ? OK : MID; X.setLineDash([9, 7]); X.stroke(); X.setLineDash([]); X.globalAlpha = .22; X.fillStyle = gh.s < 0 ? BAD : gh.q === 2 ? OK : MID; X.fill(); X.restore(); X.globalAlpha = 1; }
      } else {
        for (let i = 0; i < NS; i++) {
          const p = S[i]; if (!p.has || p.nails >= 2) continue; const k = clamp(p.t / (p.nails ? LOOSE_1 : LOOSE), 0, 1), x = cxOf(i), y = DY - 52, urgent = p.t < 1.8;
          X.fillStyle = 'rgba(20,16,28,.55)'; X.beginPath(); X.arc(x, y, 17, 0, TAU); X.fill(); X.lineCap = 'round'; X.lineWidth = 10; X.strokeStyle = 'rgba(20,16,28,.6)'; X.beginPath(); X.arc(x, y, 14, 0, TAU); X.stroke();
          X.lineWidth = 5; X.strokeStyle = urgent ? BAD : k < .5 ? MID : '#9fe3ff'; X.beginPath(); X.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * k); X.stroke();
          if (urgent && Math.sin(T * 14) > 0) txt('!', x, y + 1, 20, '#fff');
          if (p.bent) { badge('BENT!', x, y - 34, 16, '#e8434f', '#fff', 1, -.04); }
        }
      }
    }
    // the hammerer's boat and hammer
    const bxx = hxNow - HOFF, bobY = BOATY;
    const hitK2 = hitFx > 0 ? hitFx / .22 : 0, hv = lost ? 0 : phi;
    if (!carrier && !g.result) {                           // the green (clean) and yellow (half-in) arcs the head swings through
      X.save(); X.translate(hx, HY); for (const [a0, a1, col] of [[-YZ, -GZ, 'rgba(255,210,63,.5)'], [GZ, YZ, 'rgba(255,210,63,.5)'], [-GZ, GZ, 'rgba(92,255,122,.65)']]) { X.beginPath(); X.arc(0, 0, HL + 17, a0 - Math.PI / 2, a1 - Math.PI / 2); X.arc(0, 0, HL - 17, a1 - Math.PI / 2, a0 - Math.PI / 2, true); X.closePath(); X.fillStyle = col; X.fill(); }
      X.lineWidth = 3; X.strokeStyle = '#fff'; X.beginPath(); X.arc(0, 0, HL + 17, -GZ - Math.PI / 2, GZ - Math.PI / 2); X.arc(0, 0, HL - 17, GZ - Math.PI / 2, -GZ - Math.PI / 2, true); X.closePath(); X.stroke(); X.restore();
    }
    const hmood = won ? 'happy' : lost ? 'sad' : null, hcol = carrier ? pCol() : myCol(), jump = won ? Math.abs(Math.sin(T * 9)) * 10 : 0, rock = won ? Math.sin(T * 8) * .03 : lost ? .05 : 0;
    boat(bxx, bobY, T, rock);
    hammer(hxNow, HY, won ? 0.2 : hv, T, hitK2);
    X.save(); X.translate(bxx, BOATY - 10 - jump); arm(5, 1, .25 + (won ? Math.sin(T * 14) * .3 : 0), won ? 1 : .55, hcol); claude(0, 0, 5, { col: hcol, mood: hmood }); hardHatAt(0, 0, 5, '#ff4d5e'); X.restore();
    boatLip(bxx, bobY, T, rock);
    rr(hxNow - 8, HY - 8 - jump * 0, 16, 16, 4); ink('#fff', 3);
    if (lost && rk > .1) sweat(bxx + 30, BOATY - 62, 1.1, T);
    // water in front of the boat
    X.fillStyle = 'rgba(98,211,240,.9)'; el(bxx, BOATY + 20, 60, 8); X.fill(); X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 3; X.beginPath(); X.ellipse(bxx, BOATY + 20, 62, 8, 0, .1, Math.PI - .1); X.stroke();
    pill(bxx, BOATY - 104 - jump, carrier ? 'YOUR FRIEND' : 'YOU', hcol);
    // the cable, the basket and the swinging plank
    const cb = carrier ? bx : (trX.at() === null ? 400 : trX.at()), ca = carrier ? th : (trA.at() === null ? 0 : trA.at()), cy = cabY(cb), piv = cy + BASK;
    const cpts = []; for (let i = 0; i <= 24; i++) { const x = lerp(CAB[0], CAB[2], i / 24); cpts.push([x, cabY(x)]); } tube(cpts, 4, '#8f9cb3');
    const handHas = carrier ? have : (g.c - relX > RELOAD);
    const cmood = won ? 'happy' : lost ? 'sad' : null, ccol = carrier ? myCol() : pCol(), cj = won ? Math.abs(Math.sin(T * 9)) * 8 : 0;
    X.save(); X.translate(cb, cy);
    tube([[0, 6], [0, 32]], 5, STEEL2);
    rr(-46, BASK - 34, 92, 30, 8); ink('#e6a85a', 4);                // the back of the basket
    X.fillStyle = WOODL; X.fillRect(-26, BASK - 33, 52, 3);
    X.beginPath(); X.arc(0, 0, 12, 0, TAU); ink(STEEL, 3.5); X.fillStyle = 'rgba(255,255,255,.7)'; el(-3, -3, 3, 2); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(0, 0, 3, 0, TAU); X.fill();
    X.restore();
    X.save(); X.translate(cb, cy + BASK - 10 - cj); arm(4.6, -1, -.3 + (won ? -Math.sin(T * 14) * .3 : 0), won ? 1 : .75, ccol); arm(4.6, 1, .3 + (won ? Math.sin(T * 14) * .3 : 0), won ? 1 : .75, ccol); claude(0, 0, 4.6, { col: ccol, mood: cmood }); hardHatAt(0, 0, 4.6, '#ff9a4d'); X.restore();
    X.save(); X.translate(cb, cy); rr(-50, BASK - 22, 100, 24, 8); ink('#e6a85a', 4); X.fillStyle = WOOD2; X.fillRect(-46, BASK - 6, 92, 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(-40, BASK - 19, 30, 4, 2); X.fill(); X.restore();
    if (!won && ((lost && rk > .1) || (!g.result && stuckNow()))) sweat(cb + 34, cy + BASK - 56, 1.1, T);
    sideTag(cb < 620 ? cb + 78 : cb - 78, cy + BASK - 8, carrier ? 'YOU' : 'YOUR FRIEND', ccol, cb < 620 ? 1 : -1);
    // the plank on its rope (or the one that is falling)
    if (handHas && !(fall && carrier)) {
      const px = cb + LP * Math.sin(ca), py = piv + LP * Math.cos(ca);
      sling(cb, piv, px, py, ca, PW); X.save(); X.translate(px, py); X.rotate(ca); plank(PW, [0, 0], 0, 0); X.restore();
    }
    if (carrier && fall) {
      const k = clamp((g.c - fall.t0) / FALL, 0, 1), e = k * k, x = lerp(fall.x0, fall.xl, k), y = lerp(fall.py, DY - PH / 2, e), a = lerp(fall.a0, fall.tl * .5, ease(k));
      X.save(); X.translate(x, y); X.rotate(a); plank(PW, [0, 0], 0, 0); X.restore();
    } else if (!carrier && inflight.length) {
      for (const f of inflight) { const k = clamp((g.c - f.t0) / FALL, 0, 1), e = k * k, x = lerp(f.x0, f.xl, k), y = lerp(f.py, DY - PH / 2, e), a = lerp(f.a0, f.tl * .5, ease(k)); X.save(); X.translate(x, y); X.rotate(a); plank(PW, [0, 0], 0, 0); X.restore(); }
    }
    // locked hook (carrier): a chain and a lock on the hook, a red cross where the nail sticks out
    if (locked() && !g.result) {
      const px = cb + LP * Math.sin(ca), py = piv + LP * Math.cos(ca);
      if (carrier) { X.save(); X.translate(cb + 30, piv - 10); rr(-12, -9, 24, 18, 5); ink(BAD, 3); X.beginPath(); X.arc(0, -9, 8, Math.PI, 0); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); X.restore(); }
    }
    // hand-written tutorial words that go away after a moment
    if (!g.result && T < 3.2) {
      if (carrier) { badge(TOUCH ? 'SLIDE, LET GO TO DROP' : 'CLICK / SPACE TO DROP', 400, 262, 17, '#2b9ee6', '#fff', 1, -.04); }
      else { badge(TOUCH ? 'TAP IN THE GREEN' : 'SPACE IN THE GREEN', clamp(hx + 120, 260, 560), 520, 17, '#22a447', '#fff', 1, -.04); }
    }
    if (!g.result && carrier && locked()) badge('HAMMER IS STUCK', clamp(cb, 160, 640), piv + 70, 17, '#e8434f', '#fff', 1, -.04);
    // the sign with the planks done so far (themed progress)
    drawSign(T);
    // particles + words
    drawBits(T);
    for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 120, 680), Math.max(180, q.y - Math.min(a, .6) * 14), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
    if (won && rk > .25) { for (let i = 0; i < 3; i++) { const q = (rk * 1.2 + i / 3) % 1; heart(BREADX - 40 + (i - 1) * 34, DY - 80 - q * 90, 1 - q * .4); } if (rk > .3 && rk < 1.2) badge('QUACK!', 560, 300, 36, '#ff9a4d', '#fff', outBack((rk - .3) / .25), -.05); }
    if (lost && rk > .3) badge('PLOP!', 400, 470, 36, '#2b9ee6', '#fff', outBack((rk - .3) / .2), -.05);
    vignette(.14);
  }
  function pvNow() { if (!carrier) return pv; const a = pfT.at(.15), b = pfT.at(.45); return a === null || b === null ? 99 : (a - b) / .3; }
  function stuckNow() { return pvNow() < 6 && g.c > 1.2 && !g.result; }
  function hardHatAt(x, y, u, col) { X.save(); X.translate(x, y); hardHat(0, 0, u, col); X.restore(); }
  function goat(x, y, T, won) {
    X.save(); X.translate(x, y); const b = won ? Math.abs(Math.sin(T * 10)) * 8 : 0; X.translate(0, -b);
    for (const sx of [-1, 1]) { rr(sx * 14 - 4, -18, 8, 18, 3); ink('#f1ece3', 3); }
    el(0, -30, 26, 17); ink('#fffaf0', 4.5); el(-20, -50, 16, 14); X.fillStyle = '#fffaf0'; ink('#fffaf0', 4);
    X.beginPath(); X.arc(24, -50, 13, 0, TAU); ink('#fffaf0', 4); for (const sx of [0, 1]) { X.beginPath(); X.moveTo(18 + sx * 10, -60); X.quadraticCurveTo(14 + sx * 14, -78, 24 + sx * 14, -74); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#d9a066'; X.stroke(); }
    X.beginPath(); X.moveTo(30, -42); X.lineTo(26, -30); X.lineTo(34, -34); X.closePath(); ink('#fffaf0', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(28, -52, 2, 0, TAU); X.fill();
    X.restore();
  }
  function drawSign(T) {
    // bunting line + a little wooden sign with one plate per plank: empty, laid, nailed
    const y0 = 62; const pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20; pts.push([lerp(248, 552, k), y0 + Math.sin(k * Math.PI) * 6]); } line(pts, 3, '#e6c58c');
    for (let i = 0; i < 9; i++) { const k = (i + .5) / 9, x = lerp(248, 552, k), y = y0 + Math.sin(k * Math.PI) * 6, c = ['#ff5c8a', '#ffd23f', '#4db8ff', '#5CFF7A'][i % 4]; X.beginPath(); X.moveTo(x - 9, y); X.lineTo(x + 9, y); X.lineTo(x + Math.sin(T * 3 + i) * 2, y + 20); X.closePath(); ink(c, 2.4); }
    const sx = 400, sy = 106, w = 236, h = 44; tube([[sx - 90, y0 + 5], [sx - 90, sy - h / 2]], 2.5, ROPE); tube([[sx + 90, y0 + 5], [sx + 90, sy - h / 2]], 2.5, ROPE);
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(sx - w / 2 + 4, sy - h / 2 + 7, w, h, 14); X.fill(); rr(sx - w / 2, sy - h / 2, w, h, 14); ink(WOOD, 4);
    for (let i = 0; i < NS; i++) {
      const x = sx - 81 + i * 54, p = S[i], on = p.has, nl = on && p.nails >= 2; const k = on ? outBack((T - p.at) / .3) : 1;
      X.save(); X.translate(x, sy); X.scale(k, k); rr(-22, -11, 44, 22, 5); ink(on ? (nl ? '#5bcf72' : WOODL) : '#a5622c', 3); if (!on) { X.fillStyle = 'rgba(20,16,28,.35)'; X.fill(); }
      if (on) { X.fillStyle = INK; X.beginPath(); X.arc(-14, 0, 2.2, 0, TAU); X.arc(14, 0, 2.2, 0, TAU); X.fill(); if (nl) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(-6, 0); X.lineTo(-1, 5); X.lineTo(8, -5); X.stroke(); } }
      X.restore();
    }
  }
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0, fade = clamp(a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1, 0, 1);
      if (b.k === 3) { X.globalAlpha = fade * .8; X.beginPath(); X.arc(b.x, b.y, b.r * (1 + a * 2), 0, TAU); X.fillStyle = '#f4ecd8'; X.fill(); X.globalAlpha = 1; }
      else if (b.k === 4) { X.save(); X.globalAlpha = fade; X.translate(b.x, b.y); X.rotate(b.rot); X.fillStyle = WOODL; X.fillRect(-b.r, -b.r * .6, b.r * 2, b.r * 1.2); X.restore(); }
      else { X.globalAlpha = fade; drop(b.x, b.y, b.r, b.c); X.globalAlpha = 1; }
    }
  }
  g.dbg = {
    S, NS, ghost, cxOf, swing: () => swing(wc), dswing: () => dswing(wc),
    /* what the CARRIER screen shows: my basket and swing, the planks as last reported (no timers), the parade, the ghost landing */
    carView: () => ({ x: bx, v: bv, th, om, have: have && !fall, locked: locked(), slots: S.map(s => ({ has: s.has, nails: s.nails, bent: s.bent })), pf: pfT.at() === null ? pf : pfT.at(), ghost: ghost(), next: nextEmpty(), hx: hxT.at() }),
    /* what the HAMMERER screen shows: the boat and the hammer angle, the planks with their timers, the parade */
    hamView: () => ({ hx, phi: swing(wc), dphi: dswing(wc) * TS, slots: S.map(s => ({ has: s.has, nails: s.nails, bent: s.bent, t: s.t })), pf, cd, cx: trX.at() }),
    GZ, YZ, force: (a, b) => { pf = a; if (b !== undefined) pv = b; },
  };
  wire(g, D, 1, sp, 'du_bridge');
  return g;
}
reg('du_bridge', duBridge, 'PLANK & NAIL'); REGMAP.du_bridge.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 3.6 s loop ───────────── */
function demo(role, t) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.7, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = WATER; X.fillRect(0, 170, 520, 70); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 170); X.lineTo(520, 170); X.stroke();
  rr(-10, 126, 90, 118, 6); ink('#b98a5e', 4); rr(-14, 116, 98, 16, 6); ink('#7cd46f', 3.5); rr(440, 126, 90, 118, 6); ink('#b98a5e', 4); rr(436, 116, 98, 16, 6); ink('#7cd46f', 3.5);
  const u = t % 3.6;
  X.save(); X.translate(-139, -250 + 130);   // plank frame: slot centre at x 260, deck at y 126
  X.restore();
  const DYd = 126;
  tube([[84, DYd + 6], [440, DYd + 6]], 4, '#b88a50');
  if (role === 0) {
    const cx = 130 + 130 * ease(clamp(u / 1.2, 0, 1)), a = Math.sin(u * 5) * .6 * Math.exp(-u * 1.1), rel = u > 2 ? clamp((u - 2) / .3, 0, 1) : 0;
    tube([[60, 40], [460, 40]], 3, '#8f9cb3');
    X.save(); X.translate(cx, 40); X.beginPath(); X.arc(0, 0, 8, 0, TAU); ink(STEEL, 3); rr(-26, 14, 52, 20, 6); ink('#e6a85a', 3.5); X.restore();
    X.save(); X.translate(cx, 46); claude(0, 0, 2.4, { col: '#6EA8FE' }); X.restore();
    const px = lerp(cx + 64 * Math.sin(a), 262, rel * rel), py = lerp(50 + 64 * Math.cos(a), DYd - 8, rel * rel);
    if (u < 2.9) { if (!rel) tube([[cx, 54], [px, py]], 2.6, ROPE); X.save(); X.translate(px, py); X.rotate(rel ? lerp(a, 0, rel) : a); X.scale(.62, .62); plank(PW, [0, 0], 0, 0); X.restore(); }
    else { X.save(); X.translate(262, DYd - 8); X.scale(.62, .62); plank(PW, [1, 0], 0, 0); X.restore(); }
    if (u < 2) { X.save(); X.translate(262, DYd - 8); X.setLineDash([6, 5]); rr(-34, -6, 68, 12, 3); X.lineWidth = 3; X.strokeStyle = OK; X.stroke(); X.restore(); }
    demoFinger(cx + 40, 150, u > 1.9 && u < 2.2, ((u - 1.9) / .3) % 1);
    badge(u < 1.9 ? 'WAIT FOR THE SWING' : 'DROP!', 260, 222, 18, u < 1.9 ? '#7a5040' : '#22a447', '#fff', 1, -.03);
  } else {
    const ph = u * 3.7, phi = AMP * Math.sin(ph), hit = u > 2 && u < 2.4;
    X.save(); X.translate(262, DYd - 8); X.scale(.62, .62); plank(PW, [u > 2.2 ? 1 : 0, 0], 0, 0); X.restore();
    boat(230, 196, t, 0); X.save(); X.translate(230, 190); claude(0, 0, 2.6, { col: '#FFC93C' }); X.restore();
    X.save(); X.translate(262, 174); X.scale(.55, .55); X.rotate(hit ? 0 : phi); const L = HL; tube([[0, 16], [0, -L + 14]], 8, '#d9a066'); X.translate(0, -L); rr(-21, -13, 42, 24, 6); ink(STEEL, 4); X.restore();
    X.save(); X.translate(262, 174); for (const [a0, a1, col] of [[-GZ, GZ, 'rgba(92,255,122,.55)']]) { X.beginPath(); X.arc(0, 0, 54, a0 - Math.PI / 2, a1 - Math.PI / 2); X.arc(0, 0, 36, a1 - Math.PI / 2, a0 - Math.PI / 2, true); X.closePath(); X.fillStyle = col; X.fill(); } X.restore();
    demoFinger(300, 200, u > 1.9 && u < 2.3, ((u - 1.9) / .4) % 1);
    badge(u < 1.9 ? 'WAIT FOR THE GREEN' : 'NAILED!', 260, 40, 18, u < 1.9 ? '#7a5040' : '#22a447', '#fff', 1, -.03);
  }
  duck(40, DYd - 2, .9, { hat: 2, ph: t * 10 });
}
DUO.INFO.du_bridge = [['CARRIER', 'DROP THE PLANK ON THE GAP', 'SLIDE + CLICK / SPACE'], ['HAMMERER', 'NAIL THE PLANKS DOWN', 'SLIDE + CLICK / SPACE']];
DUO.DEMOS.du_bridge = [t => demo(0, t), t => demo(1, t)];

})();
