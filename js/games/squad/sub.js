'use strict';
/* ═════════ SQUAD · SUB CREW (sq_sub), 3-4 players, one role each ═════════
   A yellow submarine crewed by tiny Claudes sails an underwater route to the treasure. The sea is full of grumpy residents: pufferfish
   that are really mines, sleepy jellyfish, a whale who wants the road to himself and two GIANT puffers that fill the whole tunnel.
   n = 4:  PILOT (0, JUDGE)  steers between 3 lanes (pointer / W S / arrows / tap). Owns the position along the route and the HULL.
           SCOPE (1)         is the only one who SEES what is far ahead. Taps a lane = flags the next danger there: it shows up on every screen.
           TORPEDO (2)       fires a torpedo down a lane. It only locks onto a FLAGGED danger (so it needs the scope) and takes a while to reload.
           ENGINE (3)        shovels coal (mash): the reactor must stay between the two marks. Cold = the sub slows down and sinks, hot = steam.
   n = 3:  the TORPEDO and ENGINE jobs are one STOKER (role 2): click a lane = fire, Space / the bottom plate = shovel.
   Same level whatever n / role (all draws from mkR() in the constructor, always the same number of them).
   Win = the sub reaches the chest before the clock (the whale burps a trophy out). Lose = the hull is gone or time is up (it sinks, a fish points).
   Netcode: every role owns its variables, the others render them:
     PILOT   'sh' [p, lane*100, hull] (coalesced ≤10/s), 'hit' {i, hull} (a danger hurt the hull; the pilot alone decides that)
     SCOPE   'flag' {i}                       (danger i is flagged; everyone may now see it)
     TORPEDO 'tor' {lane, i} (launch, visual), 'boom' {i} (the torpedo owner alone decides that a danger is dead), 'bonk' {i} (bounced off the whale)
     ENGINE  'temp' t*100 (coalesced ≤10/s). The pilot moves at a speed given by the last temperature it received.
   The pilot sends the verdict ('end', via wire). The dangers are a fixed schedule along the route, so a position message is all anyone needs. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
let CS = 7; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;          // cosmetic randomness: never touches the seeded level
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const SUBX = 230, LANES = [220, 325, 430], SURF = 116, SEABED = 506;
const SONAR = 125, HITR = 42;                                     // everybody but the scope sees dangers only this close to the sub
const HW = [32, 30, 84, 84], DMG = [1, 1, 2, 3];      // danger kinds: 0 pufferfish mine, 1 jellyfish, 2 grumpy whale, 3 GIANT puffer: half width, hull damage
const HULL = 5, LO = .38, HI = .72, TAP = .075;         // reactor marks
const DEF = ['#FFE14D', '#6EA8FE', '#ff7aa8', '#7CE38B'];
const SKY1 = '#36b0ea', SKY2 = '#a8e6ff', W1 = '#4cc8ee', W2 = '#1d78c4', W3 = '#0f4c93';
const SUBY = '#ffd23f', SUBY2 = '#d99a12', SUBL = '#fff1a8';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tube(pts, w, col) { line(pts, w + 7, INK); line(pts, w, col); }
function glint(x, y, rx, ry, rot = -.4, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function poly(pts) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); }
const MC = new Map(), rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };
function tag(x, y, label, col, size = 13, maxW = 70) {   // a little name tag, centred on x
  X.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const s = t(label), w = Math.min(maxW, X.measureText(s).width + 14), h = size + 8;
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 2.5); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 5, y - h / 2 + 3, w - 10, 4, 2); X.fill();
  txt(label, x, y + 1, size, INK, 'center', w - 10);
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
function bubble(s, x, y, size, sc) {                    // a speech bubble with a tail pointing down to (x, y)
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(190, X.measureText(t(s)).width) + 26, h = size * 1.5;
  X.save(); X.translate(x, y); X.scale(sc, sc);
  X.beginPath(); X.moveTo(-8, -18); X.lineTo(2, 0); X.lineTo(10, -18); X.closePath(); ink('#fff', 3);
  rr(-w / 2, -18 - h, w, h, h * .45); ink('#fff', 3);
  X.fillStyle = '#fff'; X.fillRect(-6, -21, 15, 6);
  txt(s, 0, -18 - h / 2 + 2, size, INK, 'center', 190); X.restore();
}
function keyCap(x, y, label) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.max(26, X.measureText(label).width + 16);
  rr(x - w / 2, y - 11, w, 22, 6); ink('#fff', 2.5); txt(label, x, y + 1, 15, INK, 'center', w - 6);
}
function plate(cx, y, w, h, face, base, label, key, down, grey, icon) {
  const x = cx - w / 2, d = grey || down ? 3 : 9, fy = y + 9 - d;
  rr(x, y + 9, w, h, 20); ink(grey ? '#8f88a6' : base, 4);
  rr(x, fy, w, h, 20); ink(grey ? '#d3cfe0' : face, 4);
  X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 14, fy + 6, w - 28, h * .16, 6); X.fill();
  if (icon) icon(x + 40, fy + h / 2);
  const lx = icon ? x + w * .6 : cx, hasKey = key && !TOUCH;
  txt(label, lx, fy + h / 2 - (hasKey ? 9 : 0), 25, grey ? '#f6f4fb' : '#fff', 'center', w * (icon ? .5 : .8));
  if (hasKey) keyCap(lx, fy + h - 15, key);
}
function eye(x, y, r, look, mood, T, k = 0) {            // big cartoon eye. look = [-1..1, -1..1]
  if (mood === 'happy') { X.strokeStyle = INK; X.lineWidth = r * .5; X.lineCap = 'round'; X.beginPath(); X.arc(x, y + r * .3, r * .8, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); return; }
  if (mood === 'dead') { X.strokeStyle = INK; X.lineWidth = r * .4; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .7, y - r * .7); X.lineTo(x + r * .7, y + r * .7); X.moveTo(x + r * .7, y - r * .7); X.lineTo(x - r * .7, y + r * .7); X.stroke(); return; }
  if (Math.sin(T * 1.9 + k) > .985) { X.strokeStyle = INK; X.lineWidth = r * .35; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r, y); X.lineTo(x + r, y); X.stroke(); return; }
  const big = mood === 'panic' ? 1.3 : 1; el(x, y, r * big, r * 1.08 * big); ink('#fff', r * .26);
  const pr = r * (mood === 'panic' ? .32 : .52), px = x + look[0] * r * .38, py = y + look[1] * r * .38;
  X.fillStyle = INK; X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(px - pr * .35, py - pr * .4, pr * .35, 0, TAU); X.fill();
}
function heart(x, y, s, col) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink(col || '#ff5c8a', 3); glint(-6, -9, 3, 2, -.6, .6); X.restore();
}

/* ───────────── the sea creatures ───────────── */
function spikes(x, y, r, n, len, rot, base, o) {          // a ring of inked spikes around a body
  for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, w = .2; poly([[x + Math.cos(a - w) * r * .9, y + Math.sin(a - w) * r * .9], [x + Math.cos(a) * (r + len), y + Math.sin(a) * (r + len)], [x + Math.cos(a + w) * r * .9, y + Math.sin(a + w) * r * .9]]); ink(base, o); }
}
/* a pufferfish that is really a mine: spikes, an antenna with a blinking red light, a very bad mood */
function puffer(x, y, s, T, mad, dead) {
  X.save(); X.translate(x, y); X.scale(s, s);
  const bob = Math.sin(T * 3 + x * .01) * 3; X.translate(0, bob);
  spikes(0, 0, 30, 11, 15, T * .35, '#e9eef7', 3);
  X.beginPath(); X.moveTo(30, 0); X.lineTo(50, -14 + Math.sin(T * 9) * 3); X.lineTo(48, 14 + Math.sin(T * 9) * 3); X.closePath(); ink('#ff9b4a', 3);   // tail
  line([[0, -30], [0, -50]], 9, INK); line([[0, -30], [0, -50]], 4, '#9aa6bf');
  const on = Math.sin(T * 7) > 0; X.beginPath(); X.arc(0, -54, 8, 0, TAU); ink(on ? '#ff4d5e' : '#8a2a36', 3); if (on) glint(-2, -57, 3, 2, -.4, .8);
  cel('#ffb04f', '#e0802f', () => { X.beginPath(); X.arc(0, 0, 30, 0, TAU); }, 6, 6, 4);
  X.save(); X.beginPath(); X.arc(0, 0, 30, 0, TAU); X.clip(); X.fillStyle = '#ffe3b0'; el(-4, 16, 24, 14); X.fill(); X.restore();
  glint(-12, -14, 9, 5, -.5, .6);
  el(-4, 20, 6, 5); ink('#ff9b4a', 2.5);                                                                    // fin
  const lk = [-.5, .1];
  for (const sx of [-1, 1]) eye(sx * 11 - 4, -4, 8, lk, dead ? 'dead' : mad ? 'panic' : 'x', T, sx);
  X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(-26, -18); X.lineTo(-6, -8); X.moveTo(18, -18); X.lineTo(2, -8); X.stroke();   // angry brows
  X.beginPath(); X.arc(-12, 14, 6, Math.PI * 1.1, Math.PI * 1.9); X.stroke();
  X.restore();
}
function jelly(x, y, s, T, dead) {
  X.save(); X.translate(x, y); X.scale(s, s);
  const pulse = Math.sin(T * 4 + x * .02), bw = 36 + pulse * 3, bh = 30 - pulse * 3; X.translate(0, Math.sin(T * 2 + x * .01) * 4);
  for (let i = 0; i < 4; i++) { const tx = -20 + i * 13.3, pts = []; for (let k = 0; k <= 5; k++) pts.push([tx + Math.sin(T * 5 + i * 1.7 + k * .9) * 5, 8 + k * 9]); tube(pts, 5, i % 2 ? '#ff9ad2' : '#ffb3dd'); }
  cel('#ff8ac8', '#d95fa6', () => { X.beginPath(); X.moveTo(-bw, 12); X.bezierCurveTo(-bw, -bh * 1.9, bw, -bh * 1.9, bw, 12); X.quadraticCurveTo(0, 22, -bw, 12); X.closePath(); }, 6, 7, 4);
  glint(-14, -18, 10, 5, -.5, .55); X.fillStyle = 'rgba(255,255,255,.4)'; for (const [a, b, r] of [[8, -16, 4], [18, -6, 3], [-2, -22, 3]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fill(); }
  for (const sx of [-1, 1]) eye(sx * 12, -2, 6, [0, .5], dead ? 'dead' : 'x', T, sx * 2);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(0, 8, 3.5, 0, TAU); X.stroke();
  X.restore();
}
/* the grumpy whale: faces the sub, frowns, huffs. bonk = a torpedo just bounced off his head */
function whale(x, y, s, T, bonk, happy, openK = 0) {
  X.save(); X.translate(x, y); X.scale(s, s);
  const sw = Math.sin(T * 2.2 + x * .01) * 3; X.translate(0, sw);
  const body = () => { X.beginPath(); X.moveTo(-100, -4); X.bezierCurveTo(-100, -78, 50, -80, 92, -34); X.bezierCurveTo(112, -62, 130, -76, 132, -66); X.bezierCurveTo(130, -40, 118, -22, 104, -6); X.bezierCurveTo(118, 14, 132, 30, 128, 52); X.bezierCurveTo(112, 46, 96, 34, 86, 20); X.bezierCurveTo(40, 66, -100, 62, -100, -4); X.closePath(); };
  cel('#4f86e0', '#2f5fb8', body, 7, 9, 4.5);
  X.save(); body(); X.clip(); X.fillStyle = '#d8e8ff'; el(-34, 40, 90, 24, -.08); X.fill(); X.strokeStyle = 'rgba(79,134,224,.55)'; X.lineWidth = 3; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(-70 + i * 22, 24 + i * 2); X.lineTo(-60 + i * 22, 52 - i); X.stroke(); } glint(-40, -40, 34, 8, -.15, .45); X.restore();
  el(-4, 24, 30, 11, -.25); ink('#3a70cc', 3);                                                                // flipper
  if (happy) { X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath(); X.arc(-60, -6, 18, .15, Math.PI - .15); X.stroke(); X.beginPath(); X.moveTo(-76, -4); X.lineTo(-84, -12); X.stroke(); }
  else { X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(-98, 12); X.quadraticCurveTo(-66, 0 - (bonk ? 8 : 0), -34, 14); X.stroke(); }   // the frown
  el(-62, -26, 14, 15); ink('#fff', 3);
  X.fillStyle = INK; X.beginPath(); X.arc(-66 + (happy ? 0 : -2), -24, happy ? 3 : 6.5, 0, TAU); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(-68, -27, 2.3, 0, TAU); X.fill();
  if (happy) { X.strokeStyle = INK; X.lineWidth = 4.5; X.beginPath(); X.arc(-62, -22, 14, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
  else { X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(-82, -50 + (bonk ? 6 : 0)); X.lineTo(-44, -38); X.stroke(); }                                // angry brow
  X.fillStyle = 'rgba(255,110,150,.5)'; el(-84, -2, 8, 5); X.fill();
  for (let i = 0; i < 3; i++) { const k = (T * .9 + i / 3) % 1; X.globalAlpha = 1 - k; line([[18 + i * 5, -64 - k * 30], [20 + i * 8, -76 - k * 46]], 5, '#cfeeff'); } X.globalAlpha = 1;   // spout
  X.restore();
}
function giant(x, y, T, dead) {                           // the GIANT puffer that fills the tunnel
  X.save(); X.translate(x, y);
  const bob = Math.sin(T * 2.4 + x * .006) * 4; X.translate(0, bob);
  spikes(0, 0, 122, 16, 34, T * .25, '#e9eef7', 4.5);
  X.beginPath(); X.moveTo(118, 0); X.lineTo(160, -34 + Math.sin(T * 6) * 5); X.lineTo(156, 34 + Math.sin(T * 6) * 5); X.closePath(); ink('#ff9b4a', 4.5);
  line([[0, -122], [0, -168]], 14, INK); line([[0, -122], [0, -168]], 6, '#9aa6bf');
  const on = Math.sin(T * 6) > 0; X.beginPath(); X.arc(0, -174, 14, 0, TAU); ink(on ? '#ff4d5e' : '#8a2a36', 4.5); if (on) glint(-4, -178, 5, 3, -.4, .8);
  cel('#ffb04f', '#e0802f', () => { X.beginPath(); X.arc(0, 0, 122, 0, TAU); }, 14, 16, 5);
  X.save(); X.beginPath(); X.arc(0, 0, 122, 0, TAU); X.clip(); X.fillStyle = '#ffe3b0'; el(-14, 70, 100, 50); X.fill(); X.restore();
  glint(-48, -56, 36, 17, -.5, .6);
  el(-10, 74, 22, 16); ink('#ff9b4a', 3.5);
  for (const sx of [-1, 1]) eye(sx * 40 - 20, -20, 24, [-.5, .2], dead ? 'dead' : 'panic', T, sx);
  X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(-96, -62); X.lineTo(-30, -36); X.moveTo(40, -62); X.lineTo(-4, -36); X.stroke();
  X.lineWidth = 7; X.beginPath(); X.arc(-40, 50, 22, Math.PI * 1.1, Math.PI * 1.9); X.stroke();
  el(-20, 78, 0, 0);
  X.restore();
}
/* a sunken treasure chest; open 0..1 (the lid swings back) */
function chest(x, y, open, T) {
  X.save(); X.translate(x, y);
  X.beginPath(); X.ellipse(0, 4, 74, 12, 0, 0, TAU); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  if (open > 0) {
    X.save(); X.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .26 + Math.sin(T * 1.5) * .03; X.fillStyle = `rgba(255,236,150,${.34 * open})`; X.beginPath(); X.moveTo(0, -30); X.lineTo(Math.cos(a - .07) * 340, -30 + Math.sin(a - .07) * 340); X.lineTo(Math.cos(a + .07) * 340, -30 + Math.sin(a + .07) * 340); X.fill(); } X.restore();
  }
  rr(-52, -42, 104, 46, 6); cel('#b9722f', '#8a4f1f', () => rr(-52, -42, 104, 46, 6), 5, 7, 4);
  X.fillStyle = SUBY; for (const bx of [-38, 28]) { rr(bx, -42, 12, 46, 3); ink(SUBY, 2.5); }
  if (open > .1) { X.save(); rr(-52, -42, 104, 46, 6); X.clip(); X.fillStyle = '#3a2410'; X.fillRect(-52, -42, 104, 16); X.restore(); for (let i = 0; i < 6; i++) { el(-36 + i * 14, -38 - Math.abs(Math.sin(i * 2.1)) * 8, 8, 6); ink(SUBY, 2); } }
  X.save(); X.translate(-50, -42); X.rotate(-open * 1.9); X.translate(50, 42);
  X.beginPath(); X.moveTo(-52, -42); X.quadraticCurveTo(0, -92, 52, -42); X.closePath(); cel('#c98443', '#9a5f26', () => { X.beginPath(); X.moveTo(-52, -42); X.quadraticCurveTo(0, -92, 52, -42); X.closePath(); }, 4, 6, 4);
  X.fillStyle = SUBY; for (const bx of [-38, 28]) { X.beginPath(); X.moveTo(bx, -42); X.quadraticCurveTo(bx + 6, -78, bx + 12, -44); X.closePath(); ink(SUBY, 2.5); }
  X.restore();
  X.beginPath(); X.arc(0, -36, 9, 0, TAU); ink('#fff1a8', 3); X.fillStyle = INK; rr(-2, -38, 4, 8, 2); X.fill();
  X.restore();
}
function torp(x, y, T) {                                  // a torpedo with goggles and a grin
  X.save(); X.translate(x, y);
  X.beginPath(); X.moveTo(-34, -6); X.lineTo(-48, -18 + Math.sin(T * 30) * 2); X.lineTo(-40, 0); X.lineTo(-48, 18 - Math.sin(T * 30) * 2); X.lineTo(-34, 6); X.closePath(); ink('#c9ced6', 3);
  cel('#e8434f', '#b3283a', () => { X.beginPath(); X.moveTo(-36, -10); X.lineTo(14, -10); X.quadraticCurveTo(38, -10, 38, 0); X.quadraticCurveTo(38, 10, 14, 10); X.lineTo(-36, 10); X.closePath(); }, 2, 4, 3.5);
  X.beginPath(); X.moveTo(18, -9); X.quadraticCurveTo(38, -9, 38, 0); X.quadraticCurveTo(38, 9, 18, 9); X.closePath(); ink('#fff', 2);
  glint(-14, -5, 14, 2.4, 0, .6);
  X.beginPath(); X.arc(0, -1, 5.5, 0, TAU); ink('#fff', 2); X.fillStyle = INK; X.beginPath(); X.arc(1.5, -1, 2.6, 0, TAU); X.fill();
  X.restore();
}
function flagBuoy(x, y, T) {                              // a red warning flag on a pole above a flagged danger
  const w = Math.sin(T * 9) * 3;
  line([[x, y + 8], [x, y - 36]], 5, INK); line([[x, y + 8], [x, y - 36]], 2, '#e9edf5');
  X.beginPath(); X.moveTo(x, y - 36); X.lineTo(x + 26, y - 30 + w); X.lineTo(x, y - 18); X.closePath(); ink('#ff4d5e', 3);
  txt('!', x + 8, y - 28, 13, '#fff');
  X.globalAlpha = .5 + .3 * Math.sin(T * 8); X.lineWidth = 3; X.strokeStyle = '#ff4d5e'; X.beginPath(); X.arc(x, y + 8, 14 + Math.sin(T * 8) * 3, 0, TAU); X.stroke(); X.globalAlpha = 1;
}

/* ───────────── the submarine ───────────── */
function propeller(x, y, a) {
  X.save(); X.translate(x, y);
  X.beginPath(); X.arc(0, 0, 6, 0, TAU); ink('#9aa6bf', 3);
  for (let i = 0; i < 3; i++) { X.save(); X.rotate(a + i * TAU / 3); el(0, -14, 5, 14); ink('#c9ced6', 3); X.restore(); }
  X.restore();
}
/* roles: array of {col, mood, look} per porthole. hull 0..HULL; cold/hot 0..1; flash: blinks white */
function subBody(x, y, s, tilt, T, o) {
  X.save(); X.translate(x, y); X.rotate(tilt); X.scale(s, s);
  const n = o.crew.length, pts = n === 4 ? [-66, -22, 22, 66] : [-50, 0, 50];
  propeller(-112, 2, T * (o.spin || 9));
  X.beginPath(); X.moveTo(-96, -8); X.lineTo(-122, -30); X.lineTo(-112, -4); X.lineTo(-122, 22); X.lineTo(-96, 12); X.closePath(); ink(SUBY2, 3.5);   // tail fins
  // tower + periscope
  rr(-22, -62, 54, 32, 12); cel(SUBY, SUBY2, () => rr(-22, -62, 54, 32, 12), 4, 6, 4);
  line([[8, -60], [8, -86], [34, -86]], 11, INK); line([[8, -60], [8, -86], [34, -86]], 5, '#c9ced6');
  rr(30, -96, 16, 20, 5); ink('#c9ced6', 3.5);
  if (o.scope) { X.fillStyle = '#fff'; X.beginPath(); X.arc(47, -86, 6, 0, TAU); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(49 + (o.look || 0) * 1.5, -86, 3.3, 0, TAU); X.fill(); }
  else { X.fillStyle = '#9fe3ff'; el(48, -86, 3, 6); X.fill(); }
  // chimney (reactor exhaust)
  rr(-20, -78, 16, 20, 4); ink('#8f9cb3', 3.5);
  // hull
  cel(SUBY, SUBY2, () => { el(0, 0, 110, 46); }, 7, 12, 5);
  X.save(); el(0, 0, 110, 46); X.clip(); X.fillStyle = '#e8434f'; X.fillRect(-120, 20, 240, 7); X.fillStyle = 'rgba(20,16,28,.5)'; X.fillRect(-120, 27, 240, 2.5); X.restore();
  glint(-34, -30, 40, 6, -.1, .55);
  X.fillStyle = 'rgba(20,16,28,.35)'; for (const rx of [-98, -84, 84, 98]) { X.beginPath(); X.arc(rx, 0, 2.2, 0, TAU); X.fill(); }
  // nose cone with the torpedo tube
  el(100, 6, 14, 18); ink('#9aa6bf', 3.5);
  if (o.loaded) { X.fillStyle = '#e8434f'; el(112, 6, 7, 7); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(114, 6, 2, 0, TAU); X.fill(); }
  // portholes with crew
  for (let i = 0; i < n; i++) {
    const c = o.crew[i], px = pts[i], py = -2;
    X.beginPath(); X.arc(px, py, 21, 0, TAU); ink(c.col, 4);
    X.save(); X.beginPath(); X.arc(px, py, 16, 0, TAU); X.clip(); X.fillStyle = '#9fe3ff'; X.fillRect(px - 20, py - 20, 40, 40); X.fillStyle = '#ffe9a8'; X.fillRect(px - 20, py - 20, 40, 40);
    X.restore();
    X.beginPath(); X.arc(px, py, 16, 0, TAU); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
    if (o.draw) o.draw(i, px, py);
    glint(px - 8, py - 9, 5, 2.2, -.7, .7);
  }
  // damage: cracks + leaks
  if (o.hull < HULL) {
    X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round';
    for (let k = 0; k < HULL - o.hull && k < 4; k++) { const cx = [-84, 46, 10, 80][k], cy = [24, -26, 30, -16][k]; X.beginPath(); X.moveTo(cx, cy); X.lineTo(cx + 7, cy + 8); X.lineTo(cx + 2, cy + 14); X.lineTo(cx + 10, cy + 22); X.stroke(); }
  }
  X.restore();
}
/* the crew inside the portholes: tiny claudes, whose moods carry the story. Drawn live on the global ctx */
function crewFace(col, mood, px, py, big) { claude(px, py + 11, 1.55 * (big || 1), { col, mood }); }

/* ───────────── background (baked once) ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; const old = X; X = cv.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, SURF + 10); g.addColorStop(0, SKY1); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(0, 0, 800, SURF + 10);
  g = X.createLinearGradient(0, SURF, 0, SEABED); g.addColorStop(0, W1); g.addColorStop(.45, W2); g.addColorStop(1, W3); X.fillStyle = g; X.fillRect(0, SURF, 800, 600 - SURF);
  // sun
  X.beginPath(); X.arc(716, 52, 30, 0, TAU); ink('#ffe14d', 4); glint(707, 44, 10, 6, -.5, .7);
  // far silhouettes: a sunken ship and rocky arches (no ink, tinted outline)
  X.fillStyle = 'rgba(15,76,147,.55)';
  X.beginPath(); X.moveTo(420, SEABED); X.lineTo(450, 400); X.lineTo(470, 404); X.lineTo(500, 392); X.lineTo(520, 440); X.lineTo(560, 452); X.lineTo(580, SEABED); X.closePath(); X.fill();
  X.strokeStyle = 'rgba(15,76,147,.55)'; X.lineWidth = 6; X.beginPath(); X.moveTo(486, 396); X.lineTo(486, 340); X.moveTo(486, 352); X.lineTo(520, 366); X.stroke();
  X.beginPath(); X.moveTo(40, SEABED); X.quadraticCurveTo(60, 380, 130, 396); X.quadraticCurveTo(190, 408, 220, SEABED); X.closePath(); X.fill();
  X.beginPath(); X.moveTo(660, SEABED); X.quadraticCurveTo(700, 360, 780, 390); X.lineTo(800, SEABED); X.closePath(); X.fill();
  // light shafts
  X.save(); X.globalCompositeOperation = 'lighter'; for (const [sx, w] of [[150, 60], [380, 90], [610, 70]]) { X.fillStyle = 'rgba(255,255,255,.06)'; X.beginPath(); X.moveTo(sx, SURF); X.lineTo(sx + w, SURF); X.lineTo(sx + w - 120, SEABED); X.lineTo(sx - 120, SEABED); X.fill(); } X.restore();
  // the seabed
  g = X.createLinearGradient(0, SEABED, 0, 600); g.addColorStop(0, '#f4d998'); g.addColorStop(1, '#d9a85c'); X.fillStyle = g; X.fillRect(0, SEABED, 800, 600 - SEABED);
  X.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 7; i++) { X.beginPath(); X.moveTo(i * 130 - 20, SEABED); X.lineTo(i * 130 + 30, SEABED); X.lineTo(i * 130 - 70, 600); X.lineTo(i * 130 - 120, 600); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, SEABED); X.lineTo(800, SEABED); X.stroke();
  X = old; return cv;
}
function cloud(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s);
  const puff = () => { X.beginPath(); for (const [a, b, r] of [[-26, 4, 16], [-8, -6, 20], [14, -2, 18], [30, 6, 13]]) { X.moveTo(a + r, b); X.arc(a, b, r, 0, TAU); } };
  puff(); ink(null, 3); X.fillStyle = '#e4f5ff'; X.fill(); X.save(); X.translate(-3, -4); X.scale(.8, .8); puff(); X.fillStyle = '#fff'; X.fill(); X.restore(); X.restore();
}
/* kelp, coral, rocks scroll with the route; each spot is a hash of its index (no seeded RNG) */
function kelp(x, y, h, T, ph) {
  const pts = []; for (let i = 0; i <= 5; i++) pts.push([x + Math.sin(T * 1.6 + ph + i * .7) * (i * 3.2), y - i * h / 5]);
  tube(pts, 9, '#3fb260'); X.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 1; i <= 4; i++) { el(pts[i][0] - 2, pts[i][1], 2, 5, -.3); X.fill(); }
}
function coral(x, y, s, col, dk) {
  X.save(); X.translate(x, y); X.scale(s, s);
  for (const [dx, h, w] of [[-14, 34, 8], [0, 52, 9], [14, 28, 8]]) { rr(dx - w / 2, -h, w, h, w / 2); ink(col, 3); }
  X.fillStyle = dk; for (const [dx, h] of [[-14, 34], [0, 52], [14, 28]]) { X.beginPath(); X.arc(dx, -h + 2, 3, 0, TAU); X.fill(); }
  X.restore();
}
function rock(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(-34, 0); X.quadraticCurveTo(-34, -30, -8, -34); X.quadraticCurveTo(20, -38, 32, 0); X.closePath(); cel('#8ea0c0', '#667a9c', () => { X.beginPath(); X.moveTo(-34, 0); X.quadraticCurveTo(-34, -30, -8, -34); X.quadraticCurveTo(20, -38, 32, 0); X.closePath(); }, 5, 4, 3.5); glint(-12, -22, 9, 4, -.4, .4); X.restore();
}
function smallFish(x, y, s, T, col) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(-10, 0); X.lineTo(-18, -7 + Math.sin(T * 12) * 2); X.lineTo(-18, 7 - Math.sin(T * 12) * 2); X.closePath(); ink(col, 2);
  el(0, 0, 11, 7); ink(col, 2.5); X.fillStyle = INK; X.beginPath(); X.arc(5, -2, 2, 0, TAU); X.fill(); X.restore();
}
function octopus(x, y, T, happy) {                        // a shy octopus in a pot, waves at the sub
  X.save(); X.translate(x, y);
  X.beginPath(); X.moveTo(-26, 0); X.quadraticCurveTo(-34, -34, -18, -44); X.lineTo(18, -44); X.quadraticCurveTo(34, -34, 26, 0); X.closePath(); ink('#c4673a', 4); glint(-14, -30, 5, 10, .2, .4);
  const wv = Math.sin(T * 6) * .5;
  X.beginPath(); X.arc(0, -52, 22, 0, TAU); ink('#b06fe0', 4);
  line([[16, -48], [34, -62 - wv * 6], [38 + wv * 5, -82]], 6, INK); line([[16, -48], [34, -62 - wv * 6], [38 + wv * 5, -82]], 3, '#b06fe0');
  eye(-8, -54, 6, [.7, 0], happy ? 'happy' : 'x', T, 3); eye(8, -54, 6, [.7, 0], happy ? 'happy' : 'x', T, 4);
  X.restore();
}
function duck(x, y, T) {                                  // a rubber duck in sunglasses floats by on the surface
  X.save(); X.translate(x, y + Math.sin(T * 2.4 + x * .02) * 2.5); X.rotate(Math.sin(T * 2.4 + x * .02) * .06);
  X.beginPath(); X.ellipse(0, 4, 20, 13, 0, 0, TAU); ink('#ffe14d', 3); glint(-7, 0, 7, 3, -.3, .6);
  X.beginPath(); X.arc(12, -10, 11, 0, TAU); ink('#ffe14d', 3);
  poly([[20, -8], [32, -6], [20, -2]]); ink('#ff9b4a', 2.5);
  rr(6, -17, 16, 7, 3); ink('#14101c', 2); glint(10, -15, 3, 1.5, 0, .7);
  X.restore();
}
function gull(x, y, T) {
  X.save(); X.translate(x, y); const f = Math.sin(T * 7) * 6;
  X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(-18, -4 + f); X.quadraticCurveTo(-8, -12, 0, 0); X.quadraticCurveTo(8, -12, 18, -4 + f); X.stroke();
  X.strokeStyle = '#fff'; X.lineWidth = 3; X.stroke();
  X.restore();
}

/* ───────────── the game ───────────── */
function subCrew(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 3 ? 3 : 4, role = D.role, TS = Math.sqrt(sp);
  const isPilot = role === 0, isScope = role === 1, isTor = role === 2, isEng = n === 4 ? role === 3 : role === 2;
  const ROLEN = n === 4 ? ['PILOT', 'SCOPE', 'TORPEDO', 'ENGINE'] : ['PILOT', 'SCOPE', 'STOKER'];
  /* the level: the same on every screen. Always the same number of draws. */
  const HZ = []; let pp = 520;
  for (let k = 0; k < 11; k++) {
    const rk = R(), rl = R(), rg = R(), rf = R();
    const kind = k === 3 || k === 8 ? 3 : rk < .3 ? 2 : rk < .66 ? 0 : 1;
    const lane = kind === 3 ? 1 : kind === 2 ? Math.floor(rl * 2) : Math.floor(rl * 3);
    if (k) pp += HW[HZ[k - 1].kind] + HW[kind] + HITR * 2 + 110 + rg * 60;           // windows never overlap: there is always a lane (and time to reach it) between two dangers
    HZ.push({ i: k, p: pp, kind, lane, mask: kind === 3 ? [0, 1, 2] : kind === 2 ? [lane, lane + 1] : [lane], dmg: DMG[kind], flag: false, flagAt: -9, dead: false, deadAt: -9, hit: false, bonkAt: -9, seed: rf });
  }
  const NEED1 = 6; let t1 = HZ.filter(h => h.kind !== 3 && h.mask.includes(1)).length;      // an idle pilot (mid lane) must not survive: bend some small dangers into the middle lane
  for (const h of HZ) if (t1 < NEED1 && h.kind < 2 && h.lane !== 1) { h.lane = 1; h.mask = [1]; t1++; }
  const LEN = HZ[HZ.length - 1].p + 380, SPD = LEN / 14.4, CHESTX = LEN + 410;
  const decoSeed = R() < 1 / 8;                                                           // 1 round in 8: a mermaid shows up in the background... or rather an extra duck
  /* state */
  const pT = track(), laneT = track(), tempT = track(), tors = [], parts = [], pops = [], bubs = [];
  let p = 0, lanePos = 1, laneTgt = 1, hull = HULL, hullV = HULL, inv = 0, hitAt = -9, shAt = -9, lastSh = '', tempIn = .5, hurtFlash = 0;
  let aimLane = 1, reload = 0, reloadMax = 1, clunkAt = -9, kickAt = -9, fireAt = -9;
  let temp = .5, tSent = -9, lastTemp = -1, shovelAt = -9, mashes = 0;
  let resAt = -1, ending = null, prop = 0, flagAt2 = -9, kHeld = new Set(), lastDir = 0, lastScopeLane = -1, scopeLook = 0, snapAt = 0, ptr = null;
  const DEC = (n === 3 ? .11 : .15) * TS;
  const col = r => (D.byRole && D.byRole[r] && D.byRole[r].color) || DEF[r];
  const nameOf = r => r === role ? 'YOU' : ((D.byRole && D.byRole[r] && D.byRole[r].name) || 'P' + (r + 1)).slice(0, 7);
  const pv = () => ending && ending.res === 'win' ? LEN : isPilot ? p : (pT.at() === null ? 0 : pT.at());
  const laneV = () => isPilot ? lanePos : (laneT.at() === null ? 1 : laneT.at() / 100);
  const tempV = () => isEng ? temp : (tempT.at() === null ? .5 : tempT.at() / 100);
  const hx = (h, P) => SUBX + (h.p - P);
  const seen = (h, P) => { const x = hx(h, P); return isScope || h.flag || (x < SUBX + SONAR && x > SUBX - 200); };
  const spdOf = tv => tv < LO ? .35 + .65 * tv / LO : tv > HI ? 1 - .5 * (tv - HI) / (1 - HI) : 1;
  const pop = (s, x, y, size, bgc, fg, rot) => { pops.length = 0; pops.push({ s, x, y, t0: g.c, size, bgc, fg, rot: rot !== undefined ? rot : (cr() - .5) * .14 }); };
  const addP = (x, y, vx, vy, life, k, c, r) => { if (parts.length < 120) parts.push({ x, y, vx, vy, life, t0: g.c, k, c, r }); };
  const bubbleUp = (x, y, k = 1) => { for (let i = 0; i < k; i++) addP(x + (cr() - .5) * 10, y, (cr() - .5) * 20, -40 - cr() * 40, 1 + cr(), 0, '#fff', 2 + cr() * 3); };
  const laneOf = y => clamp(Math.round((y - LANES[0]) / (LANES[1] - LANES[0])), 0, 2);
  const g = {
    c: 0, dur: 18, pts: 0,
    cmd: isPilot ? 'STEER!' : isScope ? 'SPOT!' : isEng && n === 3 ? 'STOKE!' : isTor ? 'FIRE!' : 'STOKE!',
    roleLabel: ROLEN[role],
    hint: isPilot ? 'MOVE THE MOUSE (OR W / S) TO STEER BETWEEN THE LANES - YOUR SCOPE WARNS YOU, YOUR ENGINE MAKES YOU GO'
      : isScope ? 'ONLY YOU CAN SEE FAR AHEAD - CLICK A LANE (OR KEYS 1 2 3) TO FLAG THE NEXT DANGER THERE'
      : n === 3 ? 'CLICK A LANE (OR 1 2 3) TO FIRE AT A FLAGGED DANGER - SPACE OR THE PLATE SHOVELS COAL, KEEP THE REACTOR BETWEEN THE MARKS'
      : isTor ? 'AIM WITH THE MOUSE (OR W / S), CLICK / SPACE TO FIRE - IT ONLY LOCKS ONTO FLAGGED DANGERS'
      : 'MASH CLICK / SPACE TO SHOVEL COAL - KEEP THE REACTOR BETWEEN THE TWO MARKS',
    thint: isPilot ? 'TAP A LANE TO STEER - YOUR SCOPE WARNS YOU, YOUR ENGINE MAKES YOU GO'
      : isScope ? 'ONLY YOU CAN SEE FAR AHEAD - TAP A LANE TO FLAG THE NEXT DANGER THERE'
      : n === 3 ? 'TAP A LANE TO FIRE AT A FLAGGED DANGER - TAP THE PLATE TO SHOVEL COAL'
      : isTor ? 'TAP A LANE TO FIRE - IT ONLY LOCKS ONTO FLAGGED DANGERS'
      : 'TAP FAST TO SHOVEL COAL - KEEP THE REACTOR BETWEEN THE TWO MARKS',
    update(dt) {
      g.c += dt; inv = Math.max(0, inv - dt); hurtFlash = Math.max(0, hurtFlash - dt * 3); reload = Math.max(0, reload - dt); prop += dt * 9 * spdOf(tempV());
      hullV += (hull - hullV) * Math.min(1, dt * 10);
      if (g.result && resAt < 0) onResult();
      // keyboard-held steering (pilot) / aiming (torpedo)
      if (isPilot && !g.result) {
        const d = (kHeld.has('ArrowUp') || kHeld.has('KeyW') ? -1 : 0) + (kHeld.has('ArrowDown') || kHeld.has('KeyS') ? 1 : 0);
        if (d && d !== lastDir) laneTgt = clamp(Math.round(laneTgt) + d, 0, 2); lastDir = d;
      }
      if (isPilot) {
        lanePos += clamp(laneTgt - lanePos, -6.5 * TS * dt, 6.5 * TS * dt);
        if (!g.result) {
          p += SPD * TS * spdOf(tempIn) * dt;
          for (const h of HZ) {
            if (h.dead || h.hit || inv > 0) continue;
            if (Math.abs(h.p - p) < HW[h.kind] + HITR && h.mask.some(l => Math.abs(lanePos - l) < .62)) {
              if (g.dbgLog) g.dbgLog('HIT i=' + h.i + ' k=' + h.kind + ' flag=' + h.flag + ' age=' + (g.c - h.flagAt).toFixed(2) + ' lane=' + lanePos.toFixed(2) + ' tgt=' + laneTgt + ' c=' + g.c.toFixed(2)); h.hit = true; hull = Math.max(0, hull - h.dmg); inv = .9; hitAt = g.c; hurtFlash = 1; D.send('hit', { i: h.i, hull }); onHit(h);
            }
          }
          if (hull <= 0) { ending = { res: 'lose', why: 'hull' }; if (g.dbgLog) g.dbgLog('hull p=' + Math.round(p) + ' c=' + g.c.toFixed(1)); g.finish('lose'); }
          else if (p >= LEN) { p = LEN; ending = { res: 'win' }; g.finish('win'); }
          else if (g.c >= g.limit) { ending = { res: 'lose', why: 'time' }; if (g.dbgLog) g.dbgLog('time p=' + Math.round(p) + '/' + Math.round(LEN) + ' hull=' + hull + ' temp=' + tempIn.toFixed(2)); g.finish('lose'); }
        }
        if (g.c - shAt >= .1) { const sh = [Math.round(p), Math.round(lanePos * 100), hull]; if (sh.join() !== lastSh || g.result) { lastSh = sh.join(); shAt = g.c; D.send('sh', sh, true); } }
      }
      if (isEng && !g.result) {
        temp = Math.max(0, temp - DEC * dt);
        const r = Math.round(temp * 100); if (r !== lastTemp && g.c - tSent >= .1) { lastTemp = r; tSent = g.c; D.send('temp', r, true); }
      }
      if (isTor) {                                            // my torpedoes decide what they hit
        for (const q of tors) {
          if (q.dead) continue; q.x += 660 * TS * dt;
          const P = pv();
          for (const h of HZ) {
            if (h.dead || h.i !== q.i) continue; const x = hx(h, P);
            if (Math.abs(x - q.x) < HW[h.kind] + 16) {
              q.dead = true;
              if (h.kind === 2) { h.bonkAt = g.c; D.send('bonk', { i: h.i }); onBonk(h); }
              else { h.dead = true; h.deadAt = g.c; D.send('boom', { i: h.i }); onBoom(h, x); }
              break;
            }
          }
        }
      } else for (const q of tors) if (!q.dead) q.x += 660 * TS * dt;
      for (let i = tors.length - 1; i >= 0; i--) if (tors[i].dead || tors[i].x > 880) tors.splice(i, 1); else if (g.c % .05 < dt) bubbleUp(tors[i].x - 40, LANES[tors[i].lane], 1);
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 1) q.vy += 500 * dt; if (g.c - q.t0 > q.life) parts.splice(i, 1); }
      if (cr() < dt * 6) bubs.push({ x: 140 + cr() * 640, y: SEABED - 10, r: 2 + cr() * 4, ph: cr() * 6 });
      for (let i = bubs.length - 1; i >= 0; i--) { const b = bubs[i]; b.y -= 46 * dt; b.x += Math.sin(g.c * 2 + b.ph) * 8 * dt - 20 * dt; if (b.y < SURF + 4) bubs.splice(i, 1); }
      if (cr() < dt * 3 * (1 - spdOf(tempV()) > 0 ? 1 : 1) && !g.result) bubbleUp(SUBX - 116, laneY() + 2, 1);
      if (tempV() > HI + .12 && cr() < dt * 18) addP(SUBX - 12, laneY() - 84, 8 + cr() * 14, -50 - cr() * 30, 1.1, 2, '#fff', 10 + cr() * 8);
    },
    msg(ty, d, from) {
      if (ty === 'sh') { pT.push(d[0]); laneT.push(d[1]); if (!isPilot) { if (d[2] < hull) { hull = d[2]; } if (d[2] > hull) hull = d[2]; } }
      else if (ty === 'temp') { tempT.push(d); if (isPilot) tempIn = d / 100; }
      else if (ty === 'hit') { const h = HZ[d.i]; if (h && !h.hit) { h.hit = true; hull = d.hull; hurtFlash = 1; hitAt = g.c; onHit(h); } }
      else if (ty === 'flag') { const h = HZ[d.i]; if (h && !h.flag) { h.flag = true; h.flagAt = g.c; if (!isScope) { sfx.blip && sfx.blip(12); snd(1180, .09, 'square', .05); snd(880, .12, 'square', .05, .09); pop('DANGER!', 400, 160, 20, '#e8434f', '#fff', -.04); } } }
      else if (ty === 'tor') { if (!isTor) tors.push({ lane: d.lane, x: SUBX + 70, i: d.i, dead: false }); kickAt = g.c; }
      else if (ty === 'boom') { const h = HZ[d.i]; if (h && !h.dead) { h.dead = true; h.deadAt = g.c; const q = tors.find(z => z.i === d.i && !z.dead); if (q) q.dead = true; onBoom(h, hx(h, pv())); } }
      else if (ty === 'bonk') { const h = HZ[d.i]; if (h) { h.bonkAt = g.c; const q = tors.find(z => z.i === d.i && !z.dead); if (q) q.dead = true; onBonk(h); } }
    },
    /* ── actions (also what the bots call) ── */
    setLane(l) { if (isPilot && !g.result) laneTgt = clamp(l, 0, 2); },
    flag(lane) {                                            // scope: flag the nearest unflagged danger in this lane
      if (!isScope || g.result) return; lastScopeLane = lane; flagAt2 = g.c;
      const P = pv(); let best = null;
      for (const h of HZ) if (!h.dead && !h.hit && !h.flag && h.mask.includes(lane) && hx(h, P) > SUBX + 150 && hx(h, P) < 830 && (!best || h.p < best.p)) best = h;
      if (!best) { sfx.tick(); pop('NOTHING THERE', 400, 160, 18, '#7a5040', '#fff'); return; }
      best.flag = true; best.flagAt = g.c; D.send('flag', { i: best.i }); sfx.coin(); snd(1480, .08, 'square', .04); ring(hx(best, P), LANES[lane], '#ff4d5e', 60, .35);
    },
    fire(lane) {                                            // torpedo: shoot down a lane (needs a flagged danger there)
      if (!isTor || g.result) return; if (lane === undefined) lane = aimLane; aimLane = lane;
      if (reload > 0) { clunkAt = g.c; sfx.buzz(); pop('LOADING...', 400, 160, 18, '#7a5040', '#fff'); return; }
      const P = pv(); let tg = null;
      for (const h of HZ) if (h.flag && !h.dead && h.mask.includes(lane) && hx(h, P) > SUBX + 150 && hx(h, P) < 800 && (!tg || h.p < tg.p)) tg = h;
      if (!tg) { reload = .5; reloadMax = .5; clunkAt = g.c; sfx.thud(); pop('NO TARGET', 400, 160, 18, '#7a5040', '#fff'); D.send('dud', { lane }); return; }
      reload = reloadMax = 1.7 / TS; fireAt = g.c; kickAt = g.c; tors.push({ lane, x: SUBX + 70, i: tg.i, dead: false, mine: true }); D.send('tor', { lane, i: tg.i }); sfx.whoosh(false); snd(220, .2, 'sawtooth', .05, 0, 90);
    },
    shovel() {                                              // engine: coal in the furnace
      if (!isEng || g.result) return; temp = Math.min(1, temp + TAP); shovelAt = g.c; mashes++; sfx.blip && sfx.blip(6 + temp * 8); snd(160 + temp * 160, .05, 'triangle', .05);
      for (let i = 0; i < 2; i++) addP(100, 520, 40 + cr() * 80, -200 - cr() * 120, .7, 1, '#3b3550', 4);
    },
    draw(T0) { drawFrame(); },
    down(pt) {
      if (g.result) return; const y = pt.y;
      if (isPilot) { laneTgt = laneOf(y); }
      else if (isScope) g.flag(laneOf(y));
      else if (isTor && n === 3) { if (y >= 468) g.shovel(); else g.fire(laneOf(y)); }
      else if (isTor) { aimLane = laneOf(y); g.fire(aimLane); }
      else if (isEng) g.shovel();
    },
    move(pt) { ptr = pt; if (g.result) return; if (isPilot) laneTgt = laneOf(pt.y); else if (isTor) aimLane = laneOf(pt.y); },
    up() {},
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      const dig = /^(?:Digit|Numpad)([1-3])$/.exec(c), lane = dig ? +dig[1] - 1 : -1;
      if (isPilot) { kHeld.add(c); if (lane >= 0) laneTgt = lane; }
      else if (isScope) { if (lane >= 0 && !e.repeat) g.flag(lane); }
      else {
        if (isTor) { if (lane >= 0 && !e.repeat) g.fire(lane); else if (c === 'KeyW' || c === 'ArrowUp') aimLane = clamp(aimLane - 1, 0, 2); else if (c === 'KeyS' || c === 'ArrowDown') aimLane = clamp(aimLane + 1, 0, 2); else if (!e.repeat && !(n === 3) && (c === 'Space' || c === 'Enter')) g.fire(aimLane); }
        if (isEng && (c === 'Space' || c === 'Enter' || (n === 4 && (c === 'KeyF' || c === 'KeyJ'))) && !e.repeat) g.shovel();
      }
    },
    keyup(e) { kHeld.delete(e.code); },
  };
  function laneY() { return lerp(LANES[0], LANES[2], laneV() / 2); }
  function onHit(h) {
    const x = SUBX, y = laneY(); shake(h.kind === 3 ? 10 : 6, .22); sfx.thud(); sfx.miss(); burst(x + 40, y, '#fff', 10); ring(x, y, '#ff4d5e', 70);
    pop(h.kind === 3 ? 'KA-BLOOEY!' : h.kind === 2 ? 'BONK!' : h.kind === 1 ? 'ZZAP!' : 'OUCH!', 400, 190, 24, '#e8434f', '#fff'); for (let i = 0; i < 6; i++) addP(x + 20, y, 60 + cr() * 120, -80 + cr() * 160, .9, 0, '#fff', 3 + cr() * 4);
  }
  function onBoom(h, x) {
    const y = h.kind === 3 ? LANES[1] : LANES[h.lane]; sfx.pop(); sfx.zap(); shake(5, .15); burst(x, y, h.kind === 1 ? '#ff8ac8' : '#ffb04f', 14); ring(x, y, '#fff', h.kind === 3 ? 140 : 70, .35);
    pop(h.kind === 3 ? 'PFFFFT!' : h.kind === 1 ? 'ZAP!' : 'BOOM!', clamp(x, 120, 700), clamp(y - 60, 190, 400), 22, '#ff9b4a', '#fff');
  }
  function onBonk(h) { sfx.thud(); pop('RUDE!', clamp(hx(h, pv()), 120, 700), LANES[h.lane] - 70, 22, '#4f86e0', '#fff'); shake(3, .1); }
  function onResult() {
    resAt = g.c; if (!ending) ending = { res: g.result, why: hull <= 0 ? 'hull' : 'time' };
    if (g.result === 'win') { snd(523, .12, 'square', .05); snd(659, .12, 'square', .05, .12); snd(784, .12, 'square', .05, .24); snd(1047, .3, 'square', .06, .36); for (let i = 0; i < 26; i++) addP(SUBX + 410 + (cr() - .5) * 30, 470, (cr() - .5) * 300, -420 - cr() * 260, 1.1, 1, '#ffd23f', 5 + cr() * 3); }
    else { [[233, .26, 0], [220, .26, .3], [208, .26, .6], [196, .9, .9]].forEach(([f, d, w], i) => { snd(f, d, 'sawtooth', .06, w, i === 3 ? f * .85 : f); snd(f * 1.005, d, 'square', .02, w); }); for (let i = 0; i < 10; i++) bubbleUp(SUBX + (cr() - .5) * 120, laneY() - 10, 1); }
  }

  /* ───────────── drawing ───────────── */
  const MY = (n === 4 ? [0, 1, 2, 3] : [0, 1, 2]);
  function drawFrame() {
    X = ctx; if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
    const T = g.c, P = pv(), lv = laneV(), tv = tempV(), won = ending && ending.res === 'win' || g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? g.c - resAt : -1;
    const cold = clamp((LO - tv) / LO, 0, 1), hot = clamp((tv - HI) / (1 - HI), 0, 1);
    // sky: clouds, a gull with a fish, the sun's halo
    for (let i = 0; i < 4; i++) cloud(((T * (6 + i * 2.5) + i * 260) % 1000) - 150, 30 + (i % 2) * 40 + i * 6, .8 + i * .1);
    gull(((T * 40 + 300) % 1100) - 150, 64 + Math.sin(T * 1.3) * 10, T);
    // far layer drifts slowly with the route
    for (let i = 0; i < 6; i++) { const wx = ((i * 330 + 90 - P * .18) % 1980 + 1980) % 1980 - 220; smallFish(wx, 190 + hash(i) * 280, 1 + hash(i + 9) * .5, T + i, mix('#7fd3ff', '#3fa0e0', hash(i + 3))); }
    // surface: waves + a rubber duck passing by
    X.save(); X.beginPath(); X.moveTo(0, SURF - 4); for (let x = 0; x <= 800; x += 16) X.lineTo(x, SURF - 4 + Math.sin(x * .03 + T * 2.4) * 3.5); X.lineTo(800, SURF + 8); X.lineTo(0, SURF + 8); X.closePath(); X.fillStyle = 'rgba(255,255,255,.85)'; X.fill(); X.restore();
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); for (let x = 0; x <= 800; x += 16) { const y = SURF - 4 + Math.sin(x * .03 + T * 2.4) * 3.5; x ? X.lineTo(x, y) : X.moveTo(x, y); } X.stroke();
    { const dx = (((620 - P * .55) % 1600) + 1600) % 1600 - 160; if (dx < 840) duck(dx, SURF - 14, T); }
    // seabed props scroll at the speed of the route
    for (let i = -1; i < 9; i++) {
      const k = Math.floor(P / 150) + i, wx = SUBX + k * 150 - P + hash(k) * 100;
      const h = hash(k + 40);
      if (h < .34) kelp(wx, SEABED + 2, 70 + hash(k + 5) * 60, T, k); else if (h < .62) rock(wx, SEABED + 6, .8 + hash(k + 7) * .6); else coral(wx, SEABED + 4, .9 + hash(k + 11) * .5, h < .8 ? '#ff7aa8' : '#ff9b4a', '#fff');
    }
    { const ox = SUBX + 920 - P; if (ox > -80 && ox < 900) octopus(ox, SEABED + 8, T, won); }
    // the chest at the end of the route
    const cx = SUBX + (CHESTX - P); if (cx < 1100) { const ok = won && rk >= 0 ? clamp(rk / .4, 0, 1) : 0; chest(cx, SEABED + 8, ok, T); if (!won && cx < 860) { rr(cx - 11, SEABED - 120, 22, 70, 3); ink('#d9944f', 3); txt('X', cx, SEABED - 86, 28, '#e8434f'); } }
    // dangers (the ones that are far away AND not flagged stay hidden for everybody but the scope)
    const drawH = h => {
      const x = hx(h, P); if (x < -200 || x > 1000) return;
      const ay = h.kind === 3 ? LANES[1] : h.kind === 2 ? (LANES[h.lane] + LANES[h.lane + 1]) / 2 : LANES[h.lane];
      if (h.dead) { const a = g.c - h.deadAt; if (a > .45) return; X.save(); X.globalAlpha = 1 - a / .45; X.translate(x, ay); X.scale(1 + a * 1.2, 1 + a * 1.2); X.translate(-x, -ay); h.kind === 3 ? giant(x, ay, T, true) : h.kind === 1 ? jelly(x, ay, 1, T, true) : puffer(x, ay, 1, T, false, true); X.restore(); return; }
      if (h.hit) X.globalAlpha = .55;
      if (h.kind === 3) giant(x, ay, T, false); else if (h.kind === 2) whale(x, ay, 1, T, g.c - h.bonkAt < .5); else if (h.kind === 1) jelly(x, ay, 1, T, false); else puffer(x, ay, 1, T, h.flag, false);
      X.globalAlpha = 1;
      if (h.kind === 2 && g.c - h.bonkAt < .9) bubble('RUDE!', x - 70, ay - 80, 18, outBack((g.c - h.bonkAt) / .15));
    };
    for (const h of HZ) if ((isScope || !h.flag) && seen(h, P)) drawH(h);
    // torpedoes
    for (const q of tors) { torp(q.x, LANES[q.lane], T); }
    // the sub
    drawSub(T, lv, tv, cold, hot, won, lost, rk, P);
    // murk: everybody but the scope sees the far sea only as a dark haze
    if (!isScope) {
      const fx = SUBX + SONAR; if (!drawFrame.fog) { const gr = X.createLinearGradient(fx - 20, 0, fx + 150, 0); gr.addColorStop(0, 'rgba(8,52,90,0)'); gr.addColorStop(1, 'rgba(8,52,90,.62)'); drawFrame.fog = gr; }
      X.fillStyle = drawFrame.fog; X.fillRect(fx - 20, SURF, 800 - fx + 20, SEABED - SURF);
      for (const h of HZ) if (h.flag && seen(h, P)) drawH(h);
      if (!g.result) { X.save(); X.globalAlpha = .55; for (let i = 0; i < 3; i++) txt('?', fx + 120 + i * 130 + Math.sin(T * 2 + i) * 6, LANES[i] + Math.sin(T * 1.5 + i * 2) * 5, 34, '#9fe3ff'); X.restore(); }
    }
    for (const h of HZ) if (h.flag && !h.dead && !h.hit) { const x = hx(h, P); if (x > -40 && x < 880) { const ay = h.kind === 3 ? LANES[1] - 190 : h.kind === 2 ? LANES[h.lane] - 66 : LANES[h.lane] - 40; flagBuoy(x, ay, T); } }
    // warning arrows at the right edge for flagged dangers that are still off-screen
    for (const h of HZ) if (h.flag && !h.dead && !h.hit && hx(h, P) >= 800 && hx(h, P) < 1100) { const ay = h.kind === 3 ? LANES[1] : h.kind === 2 ? (LANES[h.lane] + LANES[h.lane + 1]) / 2 : LANES[h.lane]; X.save(); X.translate(772 - Math.abs(Math.sin(T * 8)) * 8, ay); poly([[0, -18], [-26, 0], [0, 18]]); ink('#ff4d5e', 3); txt('!', -6, 1, 16, '#fff'); X.restore(); }
    // bubbles + particles (cosmetic)
    for (const b of bubs) { X.globalAlpha = .75; X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); X.fillStyle = 'rgba(220,245,255,.35)'; X.fill(); X.lineWidth = 1.8; X.strokeStyle = 'rgba(255,255,255,.8)'; X.stroke(); X.globalAlpha = 1; }
    for (const q of parts) {
      const a = (g.c - q.t0) / q.life, f = clamp(1 - a, 0, 1);
      if (q.k === 0) { X.globalAlpha = f * .8; X.beginPath(); X.arc(q.x, q.y, q.r, 0, TAU); X.fillStyle = 'rgba(220,245,255,.4)'; X.fill(); X.lineWidth = 1.6; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
      else if (q.k === 1) { X.globalAlpha = f; X.beginPath(); X.arc(q.x, q.y, q.r, 0, TAU); ink(q.c, 2); X.globalAlpha = 1; }
      else { X.globalAlpha = f * .85; X.beginPath(); X.arc(q.x, q.y, q.r * (1 + a), 0, TAU); X.fillStyle = q.c; X.fill(); X.globalAlpha = 1; }
    }
    // the steam fog on the pilot's screen
    if (hot > .25 && isPilot) { X.globalAlpha = clamp(hot - .15, 0, .6); for (let i = 0; i < 5; i++) { const sx = 200 + i * 130 + Math.sin(T * 1.4 + i) * 20, sy = 220 + (i % 2) * 120 + Math.sin(T + i * 2) * 14; X.beginPath(); X.arc(sx, sy, 70, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.globalAlpha = 1; }
    // the win and lose payoffs that live in the world
    if (won && rk >= 0) winShow(rk, T);
    if (lost && rk >= 0) loseShow(rk, T);
    drawHud(T, P, tv, rk);
    if (isScope) scopeFrame(T);
    drawControls(T, tv, rk);
    for (const q of pops) { const a = g.c - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 130, 670), q.y - Math.min(a, .6) * 14, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
    vignette(.16);
  }
  function drawSub(T, lv, tv, cold, hot, won, lost, rk, P) {
    let sy = lerp(LANES[0], LANES[2], lv / 2) + Math.sin(T * 1.7) * 3 + cold * 22, tilt = cold * .11; let sx = SUBX + Math.sin(T * 40) * cold * 2;
    if (won && rk >= 0) { const k = ease(clamp(rk / .55, 0, 1)); sx += 120 * k; sy = lerp(sy, 440, k) - Math.abs(Math.sin(T * 9)) * 14 * clamp((rk - .5) * 4, 0, 1); }
    if (lost && rk >= 0) { const k = ease(clamp(rk / .8, 0, 1)); sy = lerp(sy, 436, k); tilt = lerp(tilt, .42, k); }
    if (g.result === 'lose' && rk >= 0 && rk < .8 && cr() < .5) bubbleUp(sx - 30 + (cr() - .5) * 120, sy - 40, 1);
    const flash = inv > 0 && Math.floor(g.c * 16) % 2 === 0;
    const mood = r => won ? 'happy' : lost ? 'sad' : (r === 0 && hurtFlash > .3) || (r === 3 && hot > .5) ? 'sad' : null;
    const crew = MY.map(r => ({ col: col(r) }));
    X.save(); if (flash) X.globalAlpha = .6;
    subBody(sx, sy, 1, tilt, T, {
      crew, hull: hullV, scope: true, look: clamp((hx(HZ.find(h => !h.dead && !h.hit && hx(h, P) > SUBX) || { p: P + 300 }, P) - SUBX) / 300, -1, 1), spin: 9 * spdOf(tv), loaded: !isTor ? true : reload <= 0,
      draw: (i, px, py) => porthole(i, MY[i], crew[i].col, px, py, mood(MY[i]), T, hot),
    });
    X.restore();
    // reactor smoke / steam from the chimney, icicles when it's cold
    if (hot > .05) for (let i = 0; i < 3; i++) { const k = (T * 1.4 + i / 3) % 1; X.globalAlpha = (1 - k) * (.4 + hot * .5); X.beginPath(); X.arc(sx - 12 + k * 8, sy - 84 - k * 60, 8 + k * 16 + hot * 8, 0, TAU); X.fillStyle = '#fff'; X.fill(); X.globalAlpha = 1; }
    if (cold > .35) for (const ix of [-70, -30, 30, 70]) { poly([[sx + ix - 5, sy + 40], [sx + ix + 5, sy + 40], [sx + ix, sy + 40 + 14 * cold]]); ink('#d8f4ff', 2); }
    // name tags under each porthole
    if (!g.result || rk < .5) { const pts = n === 4 ? [-66, -22, 22, 66] : [-50, 0, 50]; MY.forEach((r, i) => tag(sx + pts[i] * Math.cos(tilt) - (-2) * Math.sin(tilt) * 0, sy + 62 + pts[i] * Math.sin(tilt), nameOf(r), col(r), 12, 58)); }
    // reload ring around the nose for the torpedo roles
    if (isTor && reload > 0 && !g.result) { X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.arc(sx + 112, sy + 6, 18, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - reload / reloadMax)); X.stroke(); X.strokeStyle = '#ffd23f'; X.lineWidth = 4; X.stroke(); }
    // the sub kicks a bubble when a torpedo leaves
    if (g.c - kickAt < .25) { const k = (g.c - kickAt) / .25; X.globalAlpha = 1 - k; X.beginPath(); X.arc(sx + 126 + k * 14, sy + 6, 10 + k * 14, 0, TAU); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
  }
  /* what is happening inside a porthole (local sub coordinates): the crew member in the player's colour, plus a tiny prop for the job */
  function porthole(i, r, c, px, py, mood, T, hot) {
    const eng = n === 4 ? r === 3 : r === 2, busy = (r === 1 && g.c - flagAt2 < .3) || (r === 2 && n === 4 && g.c - fireAt < .3) || (eng && g.c - shovelAt < .2);
    X.save(); X.beginPath(); X.arc(px, py, 15.5, 0, TAU); X.clip();
    claude(px, py + 12 - (busy ? Math.abs(Math.sin(T * 24)) * 2 : 0), 1.5, { col: c, mood: eng && hot > .5 ? 'sad' : mood });
    X.save(); X.translate(px, py);
    if (r === 0) { X.beginPath(); X.arc(0, 9, 8, 0, TAU); X.lineWidth = 3.4; X.strokeStyle = INK; X.stroke(); X.lineWidth = 1.6; X.strokeStyle = '#c98443'; X.stroke(); }
    else if (r === 1) { X.fillStyle = '#c9ced6'; X.fillRect(2, -6, 10, 3.5); X.strokeStyle = INK; X.lineWidth = 1.3; X.strokeRect(2, -6, 10, 3.5); }
    else if (eng) { X.beginPath(); X.moveTo(4, 12); X.lineTo(12, 4); X.lineTo(15, 8); X.closePath(); X.fillStyle = '#c9ced6'; X.fill(); X.strokeStyle = INK; X.lineWidth = 1.2; X.stroke(); }
    else { X.beginPath(); X.arc(7, 8, 3.5, 0, TAU); X.fillStyle = '#e8434f'; X.fill(); X.strokeStyle = INK; X.lineWidth = 1.2; X.stroke(); }
    X.restore(); X.restore();
  }
  function winShow(rk, T) {
    // a friendly whale pops up at the right and burps a trophy bubble that floats up; hearts rise from the open chest
    const k = clamp(rk / .3, 0, 1), wx = lerp(1000, 742, ease(k)), wy = 300;
    if (rk > .05) {
      whale(wx, wy, .7, T, false, true);
      const bk = clamp((rk - .3) / .45, 0, 1);
      if (bk > 0) {
        const bx = lerp(wx - 84, 724, ease(bk)), by = lerp(wy - 20, 150, ease(bk)), r = 34 * (.3 + .7 * bk);
        X.globalAlpha = .92; X.beginPath(); X.arc(bx, by, r, 0, TAU); X.fillStyle = 'rgba(220,245,255,.5)'; X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); X.globalAlpha = 1; glint(bx - r * .4, by - r * .45, r * .3, r * .16, -.7, .8);
        X.save(); X.translate(bx, by + 2); X.scale(r / 34, r / 34); rr(-10, 12, 20, 6, 2); ink('#c98443', 2.5); X.beginPath(); X.moveTo(-3, 12); X.lineTo(-3, 4); X.lineTo(3, 4); X.lineTo(3, 12); X.closePath(); ink(SUBY, 2); X.beginPath(); X.moveTo(-12, -16); X.lineTo(12, -16); X.quadraticCurveTo(12, 4, 0, 4); X.quadraticCurveTo(-12, 4, -12, -16); X.closePath(); ink(SUBY, 3); glint(-5, -10, 2.5, 6, .1, .7); X.restore();
      }
      if (rk > .35) badge('BURP!', 700, 236, 22, '#2f9a55', '#fff', outBack((rk - .35) / .2), .06);
    }
    for (let i = 0; i < 4; i++) { const q = (T * 1.1 + i / 4) % 1; X.globalAlpha = 1 - q; heart(SUBX + 410 - 54 + i * 36, 450 - q * 90, .9, '#ff5c8a'); X.globalAlpha = 1; }
  }
  function loseShow(rk, T) {
    // a fish points at the sinking sub and laughs
    const k = clamp((rk - .2) / .3, 0, 1); if (k <= 0) return;
    const fx = 650, fy = 470 + Math.sin(T * 3) * 4;
    X.save(); X.translate(fx, fy); X.scale(1.5 * outBack(k), 1.5 * outBack(k));
    X.beginPath(); X.moveTo(18, 0); X.lineTo(34, -12 + Math.sin(T * 10) * 3); X.lineTo(34, 12 - Math.sin(T * 10) * 3); X.closePath(); ink('#ff7a3d', 3);
    X.beginPath(); X.ellipse(0, 0, 22, 15, 0, 0, TAU); ink('#ff9b4a', 3); X.fillStyle = '#fff'; for (const sx of [-6, 8]) { X.fillRect(sx, -14, 5, 28); } X.save(); X.beginPath(); X.ellipse(0, 0, 22, 15, 0, 0, TAU); X.clip(); X.fillStyle = '#fff'; X.fillRect(-8, -16, 5, 32); X.fillRect(5, -16, 5, 32); X.restore(); X.beginPath(); X.ellipse(0, 0, 22, 15, 0, 0, TAU); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
    eye(-10, -3, 5, [-.8, .4], 'x', T, 1); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.arc(-12, 6, 5, .2, Math.PI - .2); X.stroke();
    X.beginPath(); X.moveTo(-14, 6); X.lineTo(-44 - Math.sin(T * 14) * 4, 10); X.stroke();                                          // the fin pointing at the sub
    X.beginPath(); X.moveTo(-44 - Math.sin(T * 14) * 4, 10); X.lineTo(-50, 6); X.lineTo(-48, 14); X.closePath(); ink('#ff7a3d', 2);
    X.restore();
    if (rk > .45) bubble('HA HA!', fx - 20, fy - 32, 20, outBack((rk - .45) / .2));
  }
  function drawHud(T, P, tv, rk) {
    // a wooden sign hanging from the surface: hull rings + the route
    const sx = 332, sy = 64, sw = 330, sh = 52;
    line([[sx + 40, SURF - 2], [sx + 40, sy + 4]], 4, '#e6c58c'); line([[sx + sw - 40, SURF - 2], [sx + sw - 40, sy + 4]], 4, '#e6c58c');
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(sx + 4, sy + 7, sw, sh, 14); X.fill();
    rr(sx, sy, sw, sh, 14); ink('#d9944f', 4); X.fillStyle = '#c98443'; for (let i = 0; i < 3; i++) { rr(sx + 8, sy + 12 + i * 14, sw - 16, 2.5, 1); X.fill(); }
    // hull: life rings that pop off when the sub is hurt
    for (let i = 0; i < HULL; i++) {
      const on = i < Math.round(hullV + .4) || i < hull, x = sx + 30 + i * 28, y = sy + sh / 2, k = on ? 1 : .55;
      X.save(); X.translate(x, y); X.scale(k, k); X.beginPath(); X.arc(0, 0, 11, 0, TAU); ink(on ? '#ff5a4f' : '#b8b4c8', 3); X.beginPath(); X.arc(0, 0, 4.6, 0, TAU); ink('#c98443', 2);
      if (on) { X.save(); X.beginPath(); X.arc(0, 0, 11, 0, TAU); X.arc(0, 0, 4.6, 0, TAU, true); X.clip(); X.fillStyle = '#fff'; X.fillRect(-1.5, -12, 3, 24); X.fillRect(-12, -1.5, 24, 3); X.restore(); }
      X.restore();
    }
    // route: a rope with the sub on it and the chest at the end
    const bx = sx + 186, bw = 120, by = sy + sh / 2 + 2, kk = clamp(P / LEN, 0, 1);
    line([[bx, by], [bx + bw, by]], 8, INK); line([[bx, by], [bx + bw, by]], 4, '#fff1c9');
    for (const h of HZ) if (h.flag && !h.dead) { X.fillStyle = '#ff4d5e'; X.beginPath(); X.arc(bx + h.p / LEN * bw, by, 2.6, 0, TAU); X.fill(); }
    X.save(); X.translate(bx + bw + 12, by - 4); rr(-9, -6, 18, 12, 3); ink('#b9722f', 2.5); X.fillStyle = SUBY; X.fillRect(-9, -2, 18, 2.5); X.restore();
    X.save(); X.translate(bx + kk * bw, by - 4); el(0, 0, 11, 6); ink(SUBY, 2.5); rr(-3, -10, 7, 6, 2); ink(SUBY, 2); X.restore();
  }
  /* the periscope lens: dark corners + a reticle over the three lanes */
  function scopeFrame(T) {
    X.save(); X.beginPath(); X.rect(0, SURF, 800, SEABED - SURF); X.arc(400, 330, 292, 0, TAU, true); X.clip(); X.fillStyle = 'rgba(8,24,44,.0)'; X.fillRect(0, 0, 800, 600); X.restore();
    X.strokeStyle = 'rgba(255,255,255,.28)'; X.lineWidth = 2; X.setLineDash([6, 8]);
    for (const y of LANES) { X.beginPath(); X.moveTo(SUBX + 150, y + 52); X.lineTo(800, y + 52); X.stroke(); } X.setLineDash([]);
    for (let l = 0; l < 3; l++) { const y = LANES[l], on = g.c - flagAt2 < .25 && lastScopeLane === l; X.save(); X.translate(786, y - 56); rr(-22, -14, 44, 28, 9); ink(on ? '#ffd23f' : '#fff', 3); txt(String(l + 1), 0, 1, 20, INK); X.restore(); }
    // range ticks
    X.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 12; i++) X.fillRect(SUBX + 150 + i * 50, SURF + 6, 2, i % 5 ? 6 : 12);
  }
  function drawControls(T, tv, rk) {
    // the reactor thermometer (everybody can see it, the engine shovels it)
    const gx = 56, gy0 = 172, gh = 226, ok = tv >= LO && tv <= HI;
    X.save(); X.fillStyle = 'rgba(20,16,28,.28)'; rr(gx - 18 + 4, gy0 - 14 + 6, 36, gh + 76, 18); X.fill();
    rr(gx - 18, gy0 - 14, 36, gh + 38, 18); ink('#f4f6fb', 4);
    X.save(); rr(gx - 9, gy0 - 4, 18, gh, 9); X.clip(); X.fillStyle = '#3b3550'; X.fillRect(gx - 9, gy0 - 4, 18, gh);
    X.fillStyle = 'rgba(92,255,122,.38)'; X.fillRect(gx - 9, gy0 - 4 + gh * (1 - HI), 18, gh * (HI - LO));
    const fh = gh * tv; X.fillStyle = tv > HI ? '#ff4d5e' : tv < LO ? '#6ec8ff' : '#ffb13d'; X.fillRect(gx - 9, gy0 - 4 + gh - fh, 18, fh); glint(gx - 4, gy0 + 20, 2, 60, 0, .5); X.restore();
    rr(gx - 9, gy0 - 4, 18, gh, 9); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
    for (const m of [LO, HI]) { const y = gy0 - 4 + gh * (1 - m); X.strokeStyle = INK; X.lineWidth = 8; X.beginPath(); X.moveTo(gx - 16, y); X.lineTo(gx + 16, y); X.stroke(); X.strokeStyle = '#5CFF7A'; X.lineWidth = 3.5; X.stroke(); }
    X.beginPath(); X.arc(gx, gy0 + gh + 16, 20, 0, TAU); ink(tv > HI ? '#ff4d5e' : tv < LO ? '#6ec8ff' : '#ffb13d', 4); glint(gx - 7, gy0 + gh + 8, 6, 3, -.6, .6);
    // the needle's arrow (pulses when it is out of the zone)
    const ay = gy0 - 4 + gh * (1 - tv); X.save(); X.translate(gx + 22, ay); X.translate(Math.sin(T * 14) * (ok ? 0 : 2), 0); poly([[0, 0], [12, -8], [12, 8]]); ink('#fff', 2.5); X.restore();
    X.restore();
    tag(gx, gy0 + gh + 50, tv > HI ? 'TOO HOT' : tv < LO ? 'TOO COLD' : 'REACTOR', tv > HI ? '#ff8a94' : tv < LO ? '#9fe3ff' : '#fff1a8', 13, 80);
    // the role plate at the bottom
    const done = !!g.result, py = 478 + (rk > 0 ? ease(clamp((rk - .1) / .25, 0, 1)) * 120 : 0);
    if (isPilot) plate(400, py, 300, 56, '#4db8ff', '#2a82c4', 'STEER', 'W / S', false, done, (x, y) => { poly([[x - 12, y - 4], [x, y - 20], [x + 12, y - 4]]); ink('#fff', 2.5); poly([[x - 12, y + 4], [x, y + 20], [x + 12, y + 4]]); ink('#fff', 2.5); });
    else if (isScope) { plate(400, py, 300, 56, '#ff7a6b', '#b8283a', 'FLAG IT', '1  2  3', g.c - flagAt2 < .12, done, (x, y) => { line([[x - 8, y + 14], [x - 8, y - 14]], 4, INK); poly([[x - 8, y - 14], [x + 14, y - 8], [x - 8, y]]); ink('#fff', 2.5); }); }
    else if (isTor && n === 4) { plate(400, py, 300, 56, reload > 0 ? '#ffb13d' : '#4fd06a', reload > 0 ? '#b07a12' : '#24803a', reload > 0 ? 'LOADING...' : 'FIRE!', 'SPACE', g.c - fireAt < .12, done, (x, y) => { el(x, y, 17, 8); ink('#fff', 2.5); poly([[x + 12, y - 8], [x + 24, y], [x + 12, y + 8]]); ink('#fff', 2.5); }); }
    else if (isEng && n === 4) { plate(400, py, 300, 56, '#ffb13d', '#c99512', 'SHOVEL!', 'SPACE', g.c - shovelAt < .1, done, (x, y) => { line([[x - 14, y + 14], [x + 4, y - 10]], 5, INK); poly([[x + 4, y - 10], [x + 18, y - 4], [x + 8, y + 8]]); ink('#fff', 2.5); }); }
    else if (isTor && n === 3) { plate(400, py, 300, 56, '#ffb13d', '#c99512', 'SHOVEL!', 'SPACE', g.c - shovelAt < .1, done, (x, y) => { line([[x - 14, y + 14], [x + 4, y - 10]], 5, INK); poly([[x + 4, y - 10], [x + 18, y - 4], [x + 8, y + 8]]); ink('#fff', 2.5); }); }
    // lane aim marker for the torpedo roles + lane tags for the scope
    if (isTor && !done) { const y = LANES[aimLane]; X.save(); X.globalAlpha = .9; X.translate(SUBX + 160, y); X.lineWidth = 8; X.strokeStyle = INK; X.beginPath(); X.arc(0, 0, 22, 0, TAU); X.stroke(); X.lineWidth = 4; X.strokeStyle = reload > 0 ? '#ffb13d' : '#fff'; X.stroke(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { line([[a * 14, b * 14], [a * 30, b * 30]], 8, INK); line([[a * 14, b * 14], [a * 30, b * 30]], 4, reload > 0 ? '#ffb13d' : '#fff'); } X.restore(); }
    if (isPilot && !done) for (let l = 0; l < 3; l++) { const on = l === Math.round(laneTgt); X.globalAlpha = on ? .95 : .35; X.save(); X.translate(778 - (on ? Math.abs(Math.sin(T * 8)) * 4 : 0), LANES[l]); poly([[0, -12], [-22, 0], [0, 12]]); ink(on ? '#ffe14d' : '#fff', 2.5); X.restore(); X.globalAlpha = 1; }
    if (!done && T < 4) {
      if (isScope) badge(TOUCH ? 'TAP A LANE!' : 'CLICK A LANE!', 560, 170, 18, '#e8434f', '#fff', 1, -.04);
      else if (isEng || (isTor && n === 3)) badge(TOUCH ? 'TAP TAP TAP!' : 'MASH SPACE!', 400, 440, 18, '#c99512', '#fff', 1, -.04);
    }
  }
  g.dbg = {
    HZ, LEN, SUBX, LANES, SONAR,
    pilotView: () => ({ p, lane: lanePos, tgt: laneTgt, hull, hz: HZ.filter(h => !h.dead && !h.hit && seen(h, p)).map(h => ({ i: h.i, dx: hx(h, p) - SUBX, mask: h.mask, kind: h.kind, flag: h.flag, w: HW[h.kind] })) }),
    scopeView: () => { const P = pv(); return { p: P, hz: HZ.filter(h => !h.dead && !h.hit).map(h => ({ i: h.i, dx: hx(h, P) - SUBX, mask: h.mask, kind: h.kind, flag: h.flag })) }; },
    torView: () => { const P = pv(); return { reload, aim: aimLane, hz: HZ.filter(h => h.flag && !h.dead).map(h => ({ i: h.i, dx: hx(h, P) - SUBX, mask: h.mask, kind: h.kind })), pilotLane: laneV() }; },
    engView: () => ({ temp, LO, HI }),
    cheat: res => { if (res === 'win') { p = LEN; } else { hull = 0; hullV = 0; } },
    setP: v => { p = v; pT.push(v); },
  };
  wire(g, D, 0, sp, 'sq_sub');
  return g;
}

/* ───────────── intro card demos (520×240 frame) ───────────── */
function demoBg(t) {
  X = ctx; let gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#4cc8ee'); gr.addColorStop(.6, '#1d78c4'); gr.addColorStop(1, '#0f4c93'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  gr = X.createLinearGradient(0, 0, 0, 30); gr.addColorStop(0, SKY1); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 28);
  X.beginPath(); X.moveTo(0, 28); for (let x = 0; x <= 520; x += 14) X.lineTo(x, 28 + Math.sin(x * .05 + t * 2.4) * 3); X.lineTo(520, 36); X.lineTo(0, 36); X.closePath(); X.fillStyle = 'rgba(255,255,255,.85)'; X.fill();
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 28); for (let x = 0; x <= 520; x += 14) X.lineTo(x, 28 + Math.sin(x * .05 + t * 2.4) * 3); X.stroke();
  X.fillStyle = '#e8c27a'; X.fillRect(0, 222, 520, 18); X.strokeStyle = INK; X.beginPath(); X.moveTo(0, 222); X.lineTo(520, 222); X.stroke();
  for (let i = 0; i < 6; i++) { const b = (t * 24 + i * 83) % 200; X.beginPath(); X.arc(40 + i * 90, 220 - b, 2 + (i % 3), 0, TAU); X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 2; X.stroke(); }
}
function demoSub(x, y, s, t, mood) {
  X.save(); X.translate(x, y); X.scale(s, s); X.translate(-x, -y);
  subBody(x, y, 1, 0, t, { crew: [{ col: DEF[0] }, { col: DEF[1] }, { col: DEF[2] }], hull: HULL, scope: true, spin: 9, loaded: true, look: 1, draw: (i, px, py) => { X.save(); X.beginPath(); X.arc(px, py, 15.5, 0, TAU); X.clip(); claude(px, py + 12, 1.5, { col: DEF[i], mood }); X.restore(); } });
  X.restore();
}
const DL = [78, 132, 186];                                 // the three lanes of the demo sea
function demoLanes() { X.strokeStyle = 'rgba(255,255,255,.18)'; X.lineWidth = 2; X.setLineDash([6, 8]); for (const y of DL) { X.beginPath(); X.moveTo(150, y + 30); X.lineTo(520, y + 30); X.stroke(); } X.setLineDash([]); }
/* the crew member of this role, big, inside a porthole at the left of the frame; act = 0..1 how busy it is right now */
function demoPorthole(kind, t, act, col) {
  const cx = 72, cy = 128, r = 58;
  X.beginPath(); X.arc(cx, cy, r + 8, 0, TAU); ink(col, 5);
  X.save(); X.beginPath(); X.arc(cx, cy, r, 0, TAU); X.clip();
  X.fillStyle = '#ffe9a8'; X.fillRect(cx - r, cy - r, r * 2, r * 2); X.fillStyle = 'rgba(217,148,79,.28)'; X.fillRect(cx - r, cy + 34, r * 2, r);
  X.fillStyle = 'rgba(20,16,28,.12)'; for (let i = 0; i < 4; i++) X.fillRect(cx - r + 8 + i * 30, cy - r, 5, r * 2);
  claude(cx - (kind === 'torp' ? 14 : 0), cy + 46, 3.6, { col });
  const hand = (x, y) => { rr(x - 6, y - 6, 12, 12, 3); ink('#fff', 2); };
  if (kind === 'pilot') {                                   // a big wheel
    const a = Math.sin(t * 2) * .9; X.save(); X.translate(cx, cy + 46); X.rotate(a);
    for (let i = 0; i < 6; i++) { X.rotate(TAU / 6); line([[0, 0], [0, -22]], 6, INK); line([[0, 0], [0, -22]], 3, '#c98443'); el(0, -24, 3.5, 3.5); ink('#c98443', 2); }
    X.beginPath(); X.arc(0, 0, 17, 0, TAU); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#c98443'; X.stroke();
    X.beginPath(); X.arc(0, 0, 7, 0, TAU); ink(SUBY, 2.5); X.restore();
    hand(cx - 20 * Math.cos(a), cy + 46 - 20 * Math.sin(a)); hand(cx + 20 * Math.cos(a), cy + 46 + 20 * Math.sin(a));
  } else if (kind === 'scope') {                            // a periscope pipe with an eyepiece
    const look = Math.sin(t * 1.6) * 5;
    tube([[cx + 34, cy - r], [cx + 34, cy + 22], [cx + 16 + look * .3, cy + 22]], 11, '#c9ced6'); rr(cx + 4 + look * .3, cy + 15, 14, 16, 4); ink('#8f9cb3', 3);
    X.fillStyle = '#9fe3ff'; el(cx + 3 + look * .3, cy + 23, 2.5, 6); X.fill();
    hand(cx + 34, cy + 44); hand(cx + 34, cy + 52);
    if (act > .5) { rr(cx - 46, cy - 50, 60, 22, 8); ink('#ff4d5e', 3); txt('!', cx - 16, cy - 38, 17, '#fff'); }
  } else if (kind === 'torp') {                             // pushes a torpedo into the tube
    const push = act * 40; X.beginPath(); X.moveTo(cx + 22, cy + 24); X.lineTo(cx + 62, cy + 24); X.lineTo(cx + 62, cy + 56); X.lineTo(cx + 22, cy + 56); X.closePath(); ink('#8f9cb3', 3.5); X.fillStyle = '#3b3550'; el(cx + 62, cy + 40, 5, 15); X.fill();
    torp(cx + 6 + push, cy + 40, t); hand(cx - 6, cy + 40);
  } else {                                                  // shovels coal into a glowing furnace
    X.beginPath(); X.moveTo(cx + 26, cy + 24); X.lineTo(cx + 66, cy + 24); X.lineTo(cx + 66, cy + 60); X.lineTo(cx + 26, cy + 60); X.closePath(); ink('#8f9cb3', 3.5);
    el(cx + 46, cy + 43, 13, 11); ink(`rgb(255,${150 + Math.sin(t * 20) * 40 | 0},50)`, 2.5); glint(cx + 42, cy + 39, 5, 3, -.4, .7);
    for (let i = 0; i < 3; i++) { el(cx - 38 + i * 9, cy + 52 - (i % 2) * 6, 7, 5); ink('#3b3550', 2.5); }
    const sw = Math.sin(t * 8) * .5 + .1; X.save(); X.translate(cx - 6, cy + 44); X.rotate(sw);
    line([[-6, 6], [30, -4]], 5, INK); line([[-6, 6], [30, -4]], 2.5, '#c98443'); poly([[28, -14], [46, -8], [40, 4], [24, 0]]); ink('#c9ced6', 2.5); X.restore();
    hand(cx - 6, cy + 46);
  }
  X.restore(); X.beginPath(); X.arc(cx, cy, r, 0, TAU); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); glint(cx - 36, cy - 36, 12, 5, -.7, .7);
}
function demoFor(t, kind, ci) {
  demoBg(t); demoLanes(); X = ctx;
  const u = t % 3.6, col = DEF[ci];
  if (kind === 'pilot') {                                   // a jellyfish drifts in; the wheel turns; the sub hops up a lane
    const up = ease(clamp((u - 1.1) / .35, 0, 1)) * (u < 3.1 ? 1 : 1 - ease((u - 3.1) / .4)), hz = 560 - u * 105;
    jelly(hz, DL[1] + 4, .95, t, false);
    demoSub(240, lerp(DL[1], DL[0], up) + 4, .62, t, up > .5 ? 'happy' : null);
    demoPorthole('pilot', t, up, col);
    demoFinger(430, 120 + (1 - up) * 40, u > .9 && u < 1.8, 0); badge(up > .5 ? 'PHEW!' : 'DODGE!', 380, 54, 18, '#2a82c4', '#fff', 1, -.03);
  } else if (kind === 'scope') {                            // sees a pufferfish far away, flags it
    const flagged = u > 1.3, hz = 640 - u * 80;
    puffer(hz, DL[2] + 4, .95, t, flagged, false); demoSub(240, DL[1] + 4, .62, t, null);
    if (flagged) { flagBuoy(hz, DL[2] - 36, t); badge('DANGER!', 300, 54, 18, '#e8434f', '#fff', outBack((u - 1.3) / .2), -.04); }
    else badge('FLAG IT!', 380, 54, 18, '#7a5040', '#fff', 1, -.03);
    demoFinger(Math.min(500, hz - 8), DL[2] + 8, u > 1.1 && u < 1.6, (u - 1.1) * 2);
    demoPorthole('scope', t, flagged ? 1 : 0, col);
  } else if (kind === 'torp') {                             // loads, fires, BOOM
    const hzx = 460, tx = 300 + Math.max(0, u - 1.2) * 330, boom = u > 1.7 && u < 2.7, loaded = u < 1.2 || u > 3;
    demoSub(240, DL[1] + 4, .62, t, boom ? 'happy' : null);
    if (u < 1.7 || u > 3.1) { puffer(hzx, DL[1] + 4, .95, t, true, false); flagBuoy(hzx, DL[1] - 36, t); }
    else if (boom) { X.save(); X.globalAlpha = 1 - (u - 1.7) / 1; star(hzx, DL[1] + 4, 28 + (u - 1.7) * 70, 12 + (u - 1.7) * 24, 9, u * 2, '#ffd23f', 3); X.restore(); badge('BOOM!', hzx, DL[1] - 50, 22, '#ff9b4a', '#fff', outBack((u - 1.7) / .2), .05); }
    if (u > 1.2 && u < 1.7) torp(tx, DL[1] + 8, t);
    demoPorthole('torp', t, u < 1.2 ? ease(u / 1.2) : 1 - ease(clamp((u - 1.2) / .4, 0, 1)), col);
    demoFinger(380, 160, u > 1.1 && u < 1.5, (u - 1.1) * 2.5); badge(u < 1.2 ? 'AIM + FIRE!' : u < 1.7 ? 'FIRE!' : 'NICE!', 380, 54, 18, '#24803a', '#fff', 1, -.03);
  } else {                                                  // mash: the needle stays between the marks
    const tp = clamp(.55 + Math.sin(t * 1.8) * .12, 0, 1), tapK = (t * 4) % 1;
    demoSub(250, DL[1] + 4, .62, t, null);
    const gx = 440, gy = 56, gh = 150; rr(gx - 16, gy - 8, 32, gh + 16, 16); ink('#f4f6fb', 4); X.save(); rr(gx - 8, gy, 16, gh, 8); X.clip(); X.fillStyle = '#3b3550'; X.fillRect(gx - 8, gy, 16, gh); X.fillStyle = 'rgba(92,255,122,.4)'; X.fillRect(gx - 8, gy + gh * (1 - HI), 16, gh * (HI - LO)); X.fillStyle = '#ffb13d'; X.fillRect(gx - 8, gy + gh * (1 - tp), 16, gh * tp); X.restore();
    for (const m of [LO, HI]) { X.strokeStyle = '#5CFF7A'; X.lineWidth = 3; X.beginPath(); X.moveTo(gx - 14, gy + gh * (1 - m)); X.lineTo(gx + 14, gy + gh * (1 - m)); X.stroke(); }
    poly([[gx + 20, gy + gh * (1 - tp)], [gx + 32, gy + gh * (1 - tp) - 8], [gx + 32, gy + gh * (1 - tp) + 8]]); ink('#fff', 2.5);
    demoPorthole('engine', t, tapK < .5 ? 1 : 0, col);
    demoFinger(350, 190, tapK < .4, tapK * 2.5); badge('MASH!', 360, 54, 20, '#c99512', '#fff', 1, -.03);
  }
}
const demoRoles = n => n === 4 ? ['pilot', 'scope', 'torp', 'engine'] : ['pilot', 'scope', 'stoker'];
DUO.INFO.sq_sub = n => n === 4
  ? [['PILOT', 'DODGE THE SEA CREATURES', 'MOUSE UP / DOWN OR W / S'], ['SCOPE', 'SPOT DANGER, FLAG THE LANE', 'CLICK A LANE / KEYS 1 2 3'], ['TORPEDO', 'BLAST THE FLAGGED ONES', 'AIM + CLICK / SPACE'], ['ENGINE', 'KEEP THE REACTOR WARM', 'MASH SPACE / CLICK']]
  : [['PILOT', 'DODGE THE SEA CREATURES', 'MOUSE UP / DOWN OR W / S'], ['SCOPE', 'SPOT DANGER, FLAG THE LANE', 'CLICK A LANE / KEYS 1 2 3'], ['STOKER', 'SHOVEL COAL + FIRE TORPEDOES', 'LANE = FIRE, SPACE = COAL']];
DUO.DEMOS.sq_sub = n => demoRoles(n).map((k, i) => t => k === 'stoker' ? ((t % 7.2) < 3.6 ? demoFor(t, 'engine', i) : demoFor(t % 3.6, 'torp', i)) : demoFor(t, k, i));

reg('sq_sub', subCrew, 'SUB CREW'); REGMAP.sq_sub.duo = true; REGMAP.sq_sub.squad = true;
})();
