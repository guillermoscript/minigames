'use strict';
/* ═════════ SQUAD · STORM SHIP (sq_storm), 3-4 players, one role each ═════════
   A pirate ship made of cardboard (duct tape, a bedsheet for a sail) must cross a rocky channel in a cartoon storm and reach the lighthouse.
   Seen from above. The channel is full of fog: only the LOOKOUT (in the crow's nest, squinting 2 rows ahead) sees the rocks.
   n = 4:  HELM (0, JUDGE)  turns the wheel (drag in circles / hold A D). Owns the ship: position, heading, hull. Sees only ~110 px ahead + the lookout's flags.
           LOOKOUT (1)      plants FLAGS in the gaps between the rocks (click / tap, or A D + Enter). The flags show up on the helm's screen (in the fog
                            and on the compass rail). Rings the BELL before every big wave (Space / plate): the bell is the only warning the others get.
           SAILS (2)        drags the rope (or W S) so the sail matches the wind (green zone). Too slack = slow, too tight = fast but the ship heels over.
                            Forward speed also sets how hard the helm can turn (turn radius).
           BAILER (3)       mashes to scoop the water out. Water rises on its own (leak) and with every wave hit; heavy ship = slow and listing; full = sinks.
   n = 3:  SAILS and BAILER are one DECK role (rope on the right strip, taps anywhere else).
   BIG WAVES (3, fixed times): when one hits, HELM + SAILS + BAILER (DECK) must all be holding BRACE at that very moment (Space / the plate), otherwise
           the ship takes a hit. While you hold, your own job is frozen (the real cost: bracing early hurts). The lookout does not brace, he rings.
   Win = reach the lighthouse before the clock with the hull intact (4 planks: three hits are fine). Lose = 4th hit, water to the top, or time.
   Same level whatever n / role (all draws from mkR() in the constructor, always the same number of them).
   Netcode: every role owns its variables, the others render them:
     HELM     'sh' [p, x, hull, hd*100, spd*100] (≤10/s, latest), 'hit' {i, hull} (a rock), 'wv' {k, hit, hull} (verdict of big wave k)
     LOOKOUT  'wp' {i, x} (flag in row i, idempotent), 'bell' {k}
     SAILS    'tr' trim*100 (latest)          BAILER 'wl' water*100 (latest)       (DECK sends both)
     BRACERS  'bk' {k, ok} (each one judges ITSELF: was I holding from tw-.12 to tw+.12 on my own clock), 'hold' 0|1 (for the others' pictures)
   The helm sends the verdict ('end', via wire). Waves are on a fixed clock (g.c), rocks and the lighthouse are positions along the route. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2, PI = Math.PI;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;          // cosmetic randomness: never touches the seeded level
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const SHIPY = 364, CHL = 134, CHR = 666, LK = .58;            // ship's screen row; channel limits for the ship's centre; the lookout sees the route squeezed (×LK)
const NR = 8, ROWGAP = 310, HULL = 4, TOL = .09, BR_OFF = .12;
const WX = 126, WY = 468;                                   // the wheel
const ROPE_X = 716, ROPE_Y0 = 190, ROPE_Y1 = 430;           // the sail rope
const PL = { x0: 245, x1: 555, y0: 468 };                   // the bottom plate (BRACE / BELL)
const DEF = ['#FFE14D', '#6EA8FE', '#ff7aa8', '#7CE38B'];
const SS = 1.55;                                             // ship drawing scale
const WV = 215;                                             // big wave speed on screen (px/s) so the lookout sees it ~2.6 s before it hits
const SEA1 = '#47c4ee', SEA2 = '#1f8fcf', WOOD = '#d9944f', WOOD2 = '#a5622c', CARD = '#e3b06c', CARD2 = '#c28a4a', CARD3 = '#f1cc90';

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
function heart(x, y, s, col) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink(col || '#ff5c8a', 3); glint(-6, -9, 3, 2, -.6, .6); X.restore();
}
function eye(x, y, r, look, mood, T, k = 0) {            // big cartoon eye. look = [-1..1, -1..1]
  if (mood === 'happy') { X.strokeStyle = INK; X.lineWidth = r * .5; X.lineCap = 'round'; X.beginPath(); X.arc(x, y + r * .3, r * .8, PI * 1.1, PI * 1.9); X.stroke(); return; }
  if (Math.sin(T * 1.9 + k) > .985) { X.strokeStyle = INK; X.lineWidth = r * .35; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r, y); X.lineTo(x + r, y); X.stroke(); return; }
  const big = mood === 'panic' ? 1.25 : 1; el(x, y, r * big, r * 1.08 * big); ink('#fff', r * .26);
  const pr = r * (mood === 'panic' ? .34 : .52), px = x + look[0] * r * .38, py = y + look[1] * r * .38;
  X.fillStyle = INK; X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(px - pr * .35, py - pr * .4, pr * .35, 0, TAU); X.fill();
}

/* ───────────── props: rocks, flags, waves, the lighthouse, creatures ───────────── */
function rock(x, y, r, vk, T, seed) {                    // a boulder seen from above, with a foam ring that breathes
  X.save(); X.translate(x, y); X.scale(1, vk);
  const f = .5 + .5 * Math.sin(T * 2 + seed * 9);
  X.globalAlpha = .55 + f * .25; el(0, 2, r * 1.28 + f * 4, r * 1.12 + f * 3); X.fillStyle = '#fff'; X.fill(); X.globalAlpha = 1;
  const n = 9, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, rd = r * (.84 + hash(seed * 31 + i) * .3); pts.push([Math.cos(a) * rd, Math.sin(a) * rd * .92]); }
  const build = () => { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); };
  cel('#97a6c4', '#6e82a8', build, r * .16, r * .2, 4.5);
  X.save(); build(); X.clip(); X.fillStyle = '#6fbf6a'; el(-r * .25, -r * .3, r * .42, r * .26, .4); X.fill(); X.restore();
  glint(-r * .3, -r * .42, r * .3, r * .12, -.5, .5);
  X.strokeStyle = 'rgba(20,16,28,.5)'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(r * .1, r * .1); X.lineTo(r * .32, r * .3); X.lineTo(r * .22, r * .45); X.stroke();
  X.restore();
}
function flagStake(x, y, T, k, big) {                     // a flag the lookout planted in a gap
  const w = Math.sin(T * 9 + k) * 3, s = big ? 1.25 : 1;
  X.save(); X.translate(x, y); X.scale(s, s);
  X.beginPath(); X.ellipse(0, 6, 14, 6, 0, 0, TAU); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  line([[0, 6], [0, -44]], 7, INK); line([[0, 6], [0, -44]], 3, '#f3ece0');
  X.beginPath(); X.moveTo(0, -44); X.quadraticCurveTo(14, -48 + w, 30, -40 + w * 1.5); X.quadraticCurveTo(14, -34 + w, 0, -26); X.closePath(); ink('#ff4d5e', 3);
  glint(10, -41, 6, 2, -.1, .6); X.beginPath(); X.arc(0, -46, 4, 0, TAU); ink('#ffd23f', 2.5);
  X.restore();
}
function bigWave(y, T, mad) {                             // the angry wall of water (y = its crest row)
  const x0 = 120, x1 = 680, h = 74;
  X.save();
  const build = () => { X.beginPath(); X.moveTo(x0, y + h); X.lineTo(x0, y + 6); for (let x = x0; x <= x1; x += 14) X.lineTo(x, y - 8 - Math.abs(Math.sin(x * .021 + T * 3)) * 16 + (x - 400) * (x - 400) * .00005 * 0); X.lineTo(x1, y + 6); X.lineTo(x1, y + h); X.closePath(); };
  cel('#1f8fcf', '#136aa6', build, 0, -10, 4.5);
  X.save(); build(); X.clip(); X.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 6; i++) { el(160 + i * 100 + Math.sin(T * 2 + i) * 8, y + 30, 38, 6); X.fill(); } X.restore();
  for (let x = x0 + 6; x <= x1; x += 22) { const yy = y - 8 - Math.abs(Math.sin(x * .021 + T * 3)) * 16; X.beginPath(); X.arc(x, yy + 2, 11 + hash(x) * 4, 0, TAU); ink('#fff', 3); }
  const ex = 400, ey = y + 34;
  for (const sx of [-1, 1]) eye(ex + sx * 38, ey, 15, [0, .8], mad ? 'panic' : 'x', T, sx);
  X.strokeStyle = INK; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 62, ey - 24); X.lineTo(ex - 22, ey - 12); X.moveTo(ex + 62, ey - 24); X.lineTo(ex + 22, ey - 12); X.stroke();
  X.beginPath(); X.arc(ex, ey + 30, 16, PI * 1.1, PI * 1.9); X.stroke();
  X.restore();
}
function lighthouse(x, y, T, lit) {                       // stands on a rocky islet at the end of the channel
  X.save(); X.translate(x, y);
  X.beginPath(); X.ellipse(0, 6, 150, 26, 0, 0, TAU); X.fillStyle = 'rgba(255,255,255,.7)'; X.fill();
  const isl = () => { X.beginPath(); X.moveTo(-120, 0); X.quadraticCurveTo(-110, -40, -50, -44); X.lineTo(60, -44); X.quadraticCurveTo(116, -40, 124, 0); X.quadraticCurveTo(0, 22, -120, 0); X.closePath(); };
  cel('#8ea0c0', '#667a9c', isl, 8, 9, 4.5); glint(-40, -34, 30, 5, -.1, .4);
  const tw = () => { X.beginPath(); X.moveTo(-34, -40); X.lineTo(-22, -186); X.lineTo(22, -186); X.lineTo(34, -40); X.closePath(); };
  cel('#fff', '#d6dbe8', tw, 9, 0, 4.5);
  X.save(); tw(); X.clip(); X.fillStyle = '#e8434f'; for (const [a, b] of [[-150, -122], [-104, -76], [-56, -30]]) X.fillRect(-60, a - 20, 120, b - a); X.restore(); tw(); X.lineWidth = 9; X.strokeStyle = INK; X.stroke();
  rr(-34, -204, 68, 24, 5); ink('#c9ced6', 3.5);
  X.beginPath(); X.moveTo(-26, -204); X.quadraticCurveTo(-26, -238, 0, -240); X.quadraticCurveTo(26, -238, 26, -204); X.closePath(); ink(lit ? '#fff1a8' : '#9fe3ff', 4);
  X.beginPath(); X.arc(0, -224, 7, 0, TAU); ink('#ffd23f', 2.5);
  X.beginPath(); X.moveTo(-12, -244); X.lineTo(0, -262); X.lineTo(12, -244); X.closePath(); ink('#e8434f', 3);
  rr(-9, -74, 18, 34, 8); ink('#7a4a22', 3); rr(-8, -150, 16, 20, 5); ink('#9fe3ff', 2.5);
  if (lit) { X.save(); X.globalCompositeOperation = 'lighter'; const a0 = T * 2.2; for (const s of [0, PI]) { const a = a0 + s; X.fillStyle = 'rgba(255,240,150,.30)'; X.beginPath(); X.moveTo(0, -224); X.lineTo(Math.cos(a - .12) * 700, -224 + Math.sin(a - .12) * 700 * .6); X.lineTo(Math.cos(a + .12) * 700, -224 + Math.sin(a + .12) * 700 * .6); X.fill(); } X.restore(); }
  X.restore();
}
/* the sea monster who only wants one selfie with the ship */
function monster(x, y, T, shot, sad) {
  X.save(); X.translate(x, y);
  const bob = Math.sin(T * 3) * 3; X.translate(0, bob);
  for (let i = 0; i < 3; i++) { const pts = []; for (let k = 0; k <= 5; k++) pts.push([-30 + i * 30 + Math.sin(T * 4 + i + k) * 4, 20 + k * 6]); }
  X.beginPath(); X.ellipse(0, 24, 54, 16, 0, 0, TAU); X.fillStyle = 'rgba(255,255,255,.75)'; X.fill();
  cel('#9b6ae0', '#7447b8', () => { X.beginPath(); X.moveTo(-42, 26); X.bezierCurveTo(-52, -34, 52, -34, 42, 26); X.closePath(); }, 7, 6, 4.5);
  for (const [a, b] of [[-14, -14], [8, -22], [22, -6]]) { X.beginPath(); X.arc(a, b, 5, 0, TAU); X.fillStyle = 'rgba(255,255,255,.35)'; X.fill(); }
  for (const sx of [-1, 1]) eye(sx * 15, -2, 11, [.7, .1], sad ? 'x' : 'x', T, sx);
  X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.arc(0, 12, 9, sad ? PI * 1.15 : .15, sad ? PI * 1.85 : PI - .15); X.stroke();
  X.fillStyle = 'rgba(255,110,150,.5)'; el(-30, 8, 7, 4); X.fill(); el(30, 8, 7, 4); X.fill();
  // the arm with a selfie stick, aimed at the ship (to the right)
  line([[34, 8], [60, -12 + Math.sin(T * 5) * 2]], 12, INK); line([[34, 8], [60, -12 + Math.sin(T * 5) * 2]], 6, '#9b6ae0');
  line([[58, -12], [88, -44]], 6, INK); line([[58, -12], [88, -44]], 2.5, '#c9ced6');
  rr(80, -72, 22, 32, 4); ink('#2b2b3a', 3); X.fillStyle = shot ? '#fff' : '#9fe3ff'; rr(83, -68, 16, 22, 2); X.fill(); X.beginPath(); X.arc(91, -38, 2.4, 0, TAU); X.fillStyle = '#fff'; X.fill();
  X.restore();
}
function gull(x, y, T, hat, sq) {                          // seagull captain
  X.save(); X.translate(x, y + Math.sin(T * 5) * (sq ? 2 : 0.6));
  X.beginPath(); X.ellipse(0, 0, 13, 9, 0, 0, TAU); ink('#fff', 2.5); glint(-4, -3, 5, 2.5, -.3, .5);
  X.beginPath(); X.moveTo(-12, 0); X.lineTo(-24, -4 + Math.sin(T * 8) * (sq ? 4 : 1)); X.lineTo(-22, 5); X.closePath(); ink('#e6ebf5', 2);
  X.beginPath(); X.arc(10, -9, 8, 0, TAU); ink('#fff', 2.5);
  X.beginPath(); X.moveTo(16, -10); X.lineTo(27, -7 + (sq ? Math.sin(T * 24) * 2 : 0)); X.lineTo(16, -5); X.closePath(); ink('#ffb13d', 2);
  X.fillStyle = INK; X.beginPath(); X.arc(12, -11, 2, 0, TAU); X.fill();
  if (hat) { X.beginPath(); X.moveTo(0, -14); X.lineTo(20, -14); X.lineTo(16, -23); X.quadraticCurveTo(10, -28, 4, -23); X.closePath(); ink('#2c3e75', 2.5); X.fillStyle = '#ffd23f'; X.fillRect(3, -17, 14, 3); }
  X.restore();
}
function palm(x, y, s, T, k) {
  X.save(); X.translate(x, y); X.scale(s, s);
  X.beginPath(); X.ellipse(2, 4, 24, 9, 0, 0, TAU); X.fillStyle = 'rgba(20,16,28,.22)'; X.fill();
  const sw = Math.sin(T * 1.6 + k) * 3;
  tube([[0, 0], [4 + sw * .3, -26], [8 + sw * .6, -52]], 8, '#b9722f');
  for (let i = 0; i < 6; i++) { const a = -PI / 2 + (i - 2.5) * .62 + sw * .02; const lx = 8 + sw * .6 + Math.cos(a) * 34, ly = -52 + Math.sin(a) * 22 + 6; poly([[8 + sw * .6, -52], [(8 + sw * .6 + lx) / 2 + 3, (-52 + ly) / 2 - 10], [lx, ly]]); ink(i % 2 ? '#3fb260' : '#2f9a55', 3); }
  X.beginPath(); X.arc(10 + sw * .6, -50, 4, 0, TAU); ink('#7a4a22', 2); X.restore();
}
function barrel(x, y, T, k) {
  X.save(); X.translate(x, y + Math.sin(T * 2.4 + k) * 3); X.rotate(Math.sin(T * 1.7 + k * 2) * .08);
  X.beginPath(); X.ellipse(0, 18, 28, 8, 0, 0, TAU); X.fillStyle = 'rgba(255,255,255,.7)'; X.fill();
  rr(-18, -16, 36, 36, 10); cel('#c98443', '#9a5f26', () => rr(-18, -16, 36, 36, 10), 4, 4, 3.5);
  for (const by of [-6, 8]) { X.fillStyle = INK; X.fillRect(-19, by - 1.5, 38, 4); X.fillStyle = '#c9ced6'; X.fillRect(-18, by - .5, 36, 2); }
  X.restore();
}
function pot(x, y, s) {                                   // the cook's pot, worn as a hat
  X.save(); X.translate(x, y); X.scale(s, s);
  rr(-11, -12, 22, 15, 4); cel('#9aa6bf', '#6d7894', () => rr(-11, -12, 22, 15, 4), 3, 2, 2.5);
  el(0, -12, 12, 3); ink('#3b3550', 2); line([[-11, -8], [-17, -6]], 3, INK); line([[11, -8], [17, -6]], 3, INK); glint(-5, -8, 3, 1.5, 0, .7);
  X.restore();
}

/* ───────────── the cardboard pirate ship (top view, bow up, local coords: x -36..36, y -78..70) ───────────── */
function shipBody(x, y, tilt, T, o) {
  X.save(); X.translate(x, y); X.rotate(tilt); X.scale((1 - (o.heel || 0) * .08) * (o.ss || SS), o.ss || SS);
  X.fillStyle = 'rgba(10,50,90,.28)'; el(8 + (o.heel || 0) * 10, 12, 40, 76); X.fill();
  const hull = () => { X.beginPath(); X.moveTo(0, -80); X.bezierCurveTo(32, -58, 40, -14, 37, 38); X.quadraticCurveTo(34, 68, 0, 72); X.quadraticCurveTo(-34, 68, -37, 38); X.bezierCurveTo(-40, -14, -32, -58, 0, -80); X.closePath(); };
  cel(CARD, CARD2, hull, 8, 5, 5);
  X.save(); hull(); X.clip();
  X.strokeStyle = 'rgba(150,95,40,.38)'; X.lineWidth = 2.5; for (let i = -5; i <= 5; i++) { X.beginPath(); X.moveTo(i * 8, -90); X.lineTo(i * 8.4, 80); X.stroke(); }
  X.restore();
  X.save(); X.scale(.78, .84); X.translate(0, -2); hull(); X.restore();
  X.save(); X.translate(0, -2); X.scale(.78, .84); hull(); X.lineWidth = 4; X.strokeStyle = 'rgba(20,16,28,.55)'; X.stroke(); X.fillStyle = CARD3; X.fill();
  X.save(); hull(); X.clip(); X.strokeStyle = 'rgba(190,130,60,.35)'; X.lineWidth = 3; for (let i = -6; i <= 6; i++) { X.beginPath(); X.moveTo(-60, i * 11); X.lineTo(60, i * 11 + 2); X.stroke(); } X.restore(); X.restore();
  for (const [tx, ty, ta, tw] of [[-22, -50, .6, 20]]) { X.save(); X.translate(tx, ty); X.rotate(ta); rr(-tw / 2, -6, tw, 12, 2); ink('#cfd5de', 2.2); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(-tw / 2 + 2, -4, tw - 4, 2); X.restore(); }   // duct tape
  for (const [px, py] of [[-33, 6], [33, 6], [-31, 44], [31, 44]]) { X.beginPath(); X.arc(px * .96, py, 3.4, 0, TAU); ink('#7a4a22', 1.8); }   // cardboard 'portholes'
  glint(-18, -40, 7, 22, .25, .35);
  // bow decoration: googly figurehead
  X.save(); X.translate(0, -74); X.beginPath(); X.arc(0, 0, 8, 0, TAU); ink('#fff', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(1.5, -1, 3.2, 0, TAU); X.fill(); X.restore();
  // the bedsheet sail, swung out over the left side. bg = how full it is (apex of the curve), fl = flapping
  const bg = o.bulge, fl = o.flap;
  if (!o.noSail) {
    const sail = () => { X.beginPath(); X.moveTo(-2, -14); X.quadraticCurveTo(-2 - bg * 2 + Math.sin(T * 14) * fl, 24, -8, 66); X.closePath(); };
    line([[-8, 66], [-2, -14]], 6, INK); line([[-8, 66], [-2, -14]], 2.6, '#7a4a22');   // boom
    X.save(); X.translate(7, 9); sail(); X.fillStyle = 'rgba(20,16,28,.22)'; X.fill(); X.restore();
    sail(); ink('#fffaf0', 4.5);
    X.save(); sail(); X.clip(); X.fillStyle = 'rgba(120,190,255,.55)'; for (let i = 0; i < 5; i++) { X.beginPath(); X.rect(-130, -14 + i * 17 + 4, 140, 7); X.fill(); } X.strokeStyle = 'rgba(150,130,90,.55)'; X.lineWidth = 2; for (let i = 1; i <= 3; i++) { X.beginPath(); X.moveTo(-2, -14 + i * 19); X.quadraticCurveTo(-2 - bg * 1.1, -6 + i * 19, -bg * 1.7, 4 + i * 19); X.stroke(); } X.restore();
    sail(); X.lineWidth = 3.2; X.strokeStyle = INK; X.stroke();
    if (bg > 20) { X.save(); X.translate(-bg * .85, 24); X.fillStyle = INK; X.beginPath(); X.arc(0, -2, 8, 0, TAU); X.fill(); X.fillRect(-3.4, 4, 6.8, 6); X.fillStyle = '#fff'; X.beginPath(); X.arc(-3, -3, 2.3, 0, TAU); X.arc(3, -3, 2.3, 0, TAU); X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(-14, 16); X.lineTo(12, 22); X.moveTo(-14, 22); X.lineTo(12, 16); X.stroke(); X.restore(); }
  }
  if (o.crew) o.crew(T);
  // the crow's nest barrel on the mast (the lookout)
  X.save(); X.translate(0, -12);
  X.beginPath(); X.arc(0, 0, 17, 0, TAU); ink('#6a4220', 4);
  if (o.nest) o.nest(T);
  X.beginPath(); X.arc(0, 0, 17, .08, PI - .08); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = '#c98443'; X.stroke();
  X.beginPath(); X.arc(0, 0, 17, PI + .2, TAU - .2); X.lineWidth = 3; X.strokeStyle = '#8a5a2a'; X.stroke();
  X.restore();
  X.restore();
}

/* ───────────── background tile (baked once) ───────────── */
let TILE = null;
function buildTile() {
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 400; const old = X; X = cv.getContext('2d');
  X.fillStyle = SEA1; X.fillRect(0, 0, 800, 400);
  X.fillStyle = 'rgba(31,143,207,.35)'; for (let i = 0; i < 40; i++) { const x = hash(i) * 800, y = hash(i + 50) * 400, w = 40 + hash(i + 9) * 70; for (const dy of [0, 400, -400]) { X.beginPath(); X.ellipse(x, y + dy, w, 8, 0, 0, TAU); X.fill(); } }
  X.strokeStyle = 'rgba(255,255,255,.4)'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 46; i++) { const x = hash(i + 100) * 800, y = hash(i + 150) * 400, w = 12 + hash(i + 7) * 22; for (const dy of [0, 400, -400]) { X.beginPath(); X.moveTo(x - w, y + dy); X.quadraticCurveTo(x, y + dy - 7, x + w, y + dy); X.stroke(); } }
  X = old; return cv;
}

/* ───────────── the game ───────────── */
function storm(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 3 ? 3 : 4, role = D.role, TS = Math.sqrt(sp);
  const isHelm = role === 0, isLook = role === 1, isSails = n === 4 ? role === 2 : false, isBail = n === 4 ? role === 3 : false, isDeck = n === 3 && role === 2;
  const hasRope = isSails || isDeck, hasBail = isBail || isDeck, bracer = !isLook;
  const ROLEN = n === 4 ? ['HELM', 'LOOKOUT', 'SAILS', 'BAILER'] : ['HELM', 'LOOKOUT', 'DECK'];
  const BR = n === 4 ? [0, 2, 3] : [0, 2];                                            // roles that must brace for a big wave
  const VK = isLook ? LK : 1, Y = dp => SHIPY - dp * VK;
  /* the level: the same on every screen. Always the same number of draws. */
  const ROWS = []; let pp = 300, sd = R() < .5 ? -1 : 1, lastCs = 400;
  for (let k = 0; k < NR; k++) {
    const a = R(), b = R(), c = R(), d = R(), e = R(), boulder = k % 2 === 0;
    if (c < .35) sd = -sd;
    const bx = 400 + (a - .5) * 50, br = 52 + b * 10, gr = 38 + e * 6;
    const csFor = () => boulder ? bx + sd * (br * .9 + 48 + 55) : clamp(400 + sd * (150 + d * 60), 190, 610);
    let cs = csFor(); if (k && Math.abs(cs - lastCs) > 290) { sd = -sd; cs = csFor(); }
    lastCs = cs;
    const rocks = boulder ? [{ x: bx, r: br, s: k * 3 + 1 }] : [{ x: cs - 104 - gr, r: gr, s: k * 3 + 1 }, { x: cs + 104 + gr, r: gr, s: k * 3 + 2 }];
    ROWS.push({ i: k, p: pp, cs, rocks, boulder }); pp += ROWGAP;
  }
  const LEN = ROWS[NR - 1].p + 380, SPD = LEN / 14.2, FINAL = LEN + 130;
  const TW = [4.7, 9.3, 13.6].map(v => v / TS);                                     // big waves (clock time)
  const SEG = 3.3 / TS, OPT = []; { const first = R() < .5 ? 0 : 1; for (let i = 0; i < 8; i++) { const hi = (i + first) % 2, r = R(); OPT.push(hi ? .78 + r * .06 : .18 + r * .06); } }
  const optAt = c => OPT[Math.min(OPT.length - 1, Math.max(0, Math.floor(c / SEG)))];
  const optNext = c => OPT[Math.min(OPT.length - 1, Math.floor(c / SEG) + 1)];
  const segLeft = c => SEG - (c % SEG);
  const sailF = (tr, opt) => { const e = tr - opt; if (e < -TOL) return { f: Math.max(.3, 1 - 2 * (-e - TOL)), heel: 0 }; if (e > TOL) return { f: Math.max(.45, 1 - 1.8 * (e - TOL)), heel: clamp((e - TOL) * 3.2, 0, 1) }; return { f: 1, heel: 0 }; };
  const waterF = w => w < .5 ? 1 : 1 - .9 * (w - .5);
  /* state */
  const pT = track(), xT = track(), hdT = track(), sT = track(), parts = [], pops = [], bubs = [];
  let p = 0, x = 400, hd = 0, hull = HULL, hullV = HULL, inv = 0, stall = 0, hitAt = -9, shAt = -9, lastSh = '', hurtFlash = 0, spdNow = 1;
  let a = 0, ptrA = null, kHeld = new Set(), grab = false;                              // helm: wheel angle
  const wps = {};                                                                      // lookout flags: row index -> x
  let curX = 400, curY = 250, curSet = false, flagAt = -9, kcx = 400;
  let trim = .5, trimIn = .5, trSent = -9, lastTr = -1, ropeGrab = false;
  let wl = .18, wlIn = .18, wlSent = -9, lastWl = -1, bailAt = -9, tapAt = -9;
  let holdPtr = false, holdKey = false, holdSent = 0, holdOthers = {}, braceAcc = {}, bkSent = {}, results = {}, waveDone = {}, waveFx = {}, waveRes = {}, bellAt = -9, alertUntil = -9, ringAt = -9, bellWob = -9;
  const hitRows = {}; let resAt = -1, ending = null, wobAt = -9, tapPrompt = 0;
  const col = r => (D.byRole && D.byRole[r] && D.byRole[r].color) || DEF[r];
  const nameOf = r => r === role ? 'YOU' : ((D.byRole && D.byRole[r] && D.byRole[r].name) || 'P' + (r + 1)).slice(0, 7);
  const pv = () => ending && ending.res === 'win' ? LEN : isHelm ? p : (pT.at() === null ? 0 : pT.at());
  const xv = () => isHelm ? x : (xT.at() === null ? 400 : xT.at());
  const hdv = () => isHelm ? hd : (hdT.at() === null ? 0 : hdT.at() / 100);
  const trimV = () => hasRope ? trim : trimIn;
  const wlV = () => hasBail ? wl : wlIn;
  const holding = () => holdPtr || holdKey;
  const waveNext = c => { for (let k = 0; k < TW.length; k++) if (c < TW[k] + .3) return k; return -1; };
  const addP = (px, py, vx, vy, life, k, c, r) => { if (parts.length < 140) parts.push({ x: px, y: py, vx, vy, life, t0: g.c, k, c, r }); };
  const spray = (px, py, k = 1) => { for (let i = 0; i < k; i++) addP(px + (cr() - .5) * 30, py, (cr() - .5) * 160, -60 - cr() * 140, .7 + cr() * .4, 1, '#fff', 3 + cr() * 4); };
  const pop = (s, px, py, size, bgc, fg, rot) => { pops.length = 0; pops.push({ s, x: px, y: py, t0: g.c, size, bgc, fg, rot: rot !== undefined ? rot : (cr() - .5) * .14 }); };
  const rowAt = y => { const P = pv(); let best = null, bd = 140; const wp = P + (SHIPY - y) / VK; for (const r of ROWS) { if (r.p < P - 20) continue; const d = Math.abs(r.p - wp); if (d < bd) { bd = d; best = r; } } return best; };
  const MY = n === 4 ? [0, 1, 2, 3] : [0, 1, 2];
  const g = {
    c: 0, dur: 18, pts: 0,
    cmd: isHelm ? 'STEER!' : isLook ? 'SPOT!' : isSails ? 'TRIM!' : isBail ? 'BAIL!' : 'DECK!',
    roleLabel: ROLEN[role],
    hint: isHelm ? 'TURN THE WHEEL (DRAG IN CIRCLES OR HOLD A / D) TO FOLLOW THE FLAGS - HOLD SPACE WHEN THE BELL RINGS'
      : isLook ? 'CLICK THE GAPS BETWEEN THE ROCKS TO PLANT FLAGS (OR A / D + ENTER) - RING THE BELL (SPACE) BEFORE THE BIG WAVE'
      : isSails ? 'DRAG THE ROPE (OR W / S) INTO THE GREEN WIND ZONE - HOLD SPACE WHEN THE BELL RINGS'
      : isBail ? 'MASH CLICK / F / J TO BAIL THE WATER OUT - HOLD SPACE WHEN THE BELL RINGS'
      : 'DRAG THE ROPE (OR W / S) INTO THE GREEN ZONE, CLICK / F / J TO BAIL - HOLD SPACE WHEN THE BELL RINGS',
    thint: isHelm ? 'DRAG IN CIRCLES ON THE WHEEL TO STEER TO THE FLAGS - HOLD THE PLATE WHEN THE BELL RINGS'
      : isLook ? 'TAP THE GAPS BETWEEN THE ROCKS TO PLANT FLAGS - TAP THE BELL BEFORE THE BIG WAVE'
      : isSails ? 'DRAG THE ROPE INTO THE GREEN WIND ZONE - HOLD THE PLATE WHEN THE BELL RINGS'
      : isBail ? 'TAP FAST TO BAIL THE WATER OUT - HOLD THE PLATE WHEN THE BELL RINGS'
      : 'DRAG THE ROPE INTO THE GREEN ZONE, TAP TO BAIL - HOLD THE PLATE WHEN THE BELL RINGS',
    update(dt) {
      g.c += dt; inv = Math.max(0, inv - dt); stall = Math.max(0, stall - dt); hurtFlash = Math.max(0, hurtFlash - dt * 3);
      hullV += (hull - hullV) * Math.min(1, dt * 10);
      if (g.result && resAt < 0) onResult();
      const br = holding() && !g.result;
      // keyboard: wheel / rope / cursor
      if (!g.result) {
        const dx = (kHeld.has('ArrowRight') || kHeld.has('KeyD') ? 1 : 0) - (kHeld.has('ArrowLeft') || kHeld.has('KeyA') ? 1 : 0);
        const dy = (kHeld.has('ArrowDown') || kHeld.has('KeyS') ? 1 : 0) - (kHeld.has('ArrowUp') || kHeld.has('KeyW') ? 1 : 0);
        if (isHelm && !br && dx) a = clamp(a + dx * 4.6 * dt, -PI, PI);
        if (hasRope && !br && dy) trim = clamp(trim + dy * .95 * dt, 0, 1);
        if (isLook && dx) { kcx = clamp(kcx + dx * 330 * dt, CHL, CHR); curX = kcx; curSet = true; }
      }
      // bracing: did I hold through the whole impact window of every big wave (on my own clock)?
      if (bracer && !g.result) for (let k = 0; k < TW.length; k++) {
        if (g.c >= TW[k] - BR_OFF && g.c <= TW[k] + BR_OFF) braceAcc[k] = (braceAcc[k] === undefined ? true : braceAcc[k]) && holding();
        if (g.c > TW[k] + BR_OFF && !bkSent[k]) { bkSent[k] = 1; const ok = !!braceAcc[k]; if (isHelm) (results[k] = results[k] || {})[0] = ok; else D.send('bk', { k, ok: ok ? 1 : 0 }); }
      }
      if (bracer) { const h = holding() ? 1 : 0; if (h !== holdSent && !g.result) { holdSent = h; D.send('hold', h); } }
      // the waves hit everybody's picture at the same clock time
      for (let k = 0; k < TW.length; k++) if (!waveFx[k] && g.c >= TW[k]) { waveFx[k] = 1; onWaveFx(k); }
      // ── role simulations ──
      if (hasBail && !g.result) {
        wl = clamp(wl + (n === 3 ? .1 : .13) * TS * dt, 0, 1);
        const r = Math.round(wl * 100); if (r !== lastWl && g.c - wlSent >= .1) { lastWl = r; wlSent = g.c; D.send('wl', r, true); }
      }
      if (hasRope) { const r = Math.round(trim * 100); if (r !== lastTr && g.c - trSent >= .1) { lastTr = r; trSent = g.c; D.send('tr', r, true); } }
      if (isHelm) {
        const opt = optAt(g.c), sf = sailF(trimIn, opt), fw = waterF(wlIn);
        const fs = sf.f * fw; spdNow = fs * (stall > 0 ? .2 : 1);
        if (!g.result) {
          p += SPD * TS * spdNow * dt;
          const s = clamp(a / PI, -1, 1), slosh = Math.max(0, wlIn - .45), rate = 5 * (1 - .45 * clamp((wlIn - .5) / .5, 0, 1));
          hd += (s - hd) * Math.min(1, dt * rate);
          const lean = sf.heel * 70 + slosh * 130 * Math.sin(g.c * 1.3);
          x += (hd * 340 * TS * (.35 + .65 * Math.min(1, fs)) + lean * TS) * dt;
          if (x < CHL) { x = CHL; hd = Math.max(hd, 0); if (cr() < dt * 20) spray(x - 30, SHIPY, 1); } else if (x > CHR) { x = CHR; hd = Math.min(hd, 0); if (cr() < dt * 20) spray(x + 30, SHIPY, 1); }
          for (const rw of ROWS) {
            if (inv > 0) break;
            for (const rk of rw.rocks) {
              const ex = (x - rk.x) / (rk.r * .9 + 48), ey = (p - rw.p) / (rk.r * .9 + 66);
              if (ex * ex + ey * ey < 1) { hull = Math.max(0, hull - 1); inv = .9; stall = .5; hitAt = g.c; hurtFlash = 1; D.send('hit', { i: rw.i, hull }); onHit(rk.x); break; }
            }
          }
          for (let k = 0; k < TW.length; k++) if (!waveDone[k] && g.c >= TW[k] + BR_OFF + .02) resolveWave(k);
          if (hull <= 0) { ending = { res: 'lose', why: 'hull' }; g.finish('lose'); }
          else if (wlIn >= .995) { ending = { res: 'lose', why: 'sunk' }; g.finish('lose'); }
          else if (p >= LEN) { p = LEN; ending = { res: 'win' }; g.finish('win'); }
          else if (g.c >= g.limit) { ending = { res: 'lose', why: 'time' }; g.finish('lose'); }
        }
        if (g.c - shAt >= .1) { const sh = [Math.round(p), Math.round(x), hull, Math.round(hd * 100), Math.round(spdNow * 100)]; if (sh.join() !== lastSh || g.result) { lastSh = sh.join(); shAt = g.c; D.send('sh', sh, true); } }
      } else spdNow = sT.at() === null ? 1 : sT.at() / 100;
      // cosmetics
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 1) q.vy += 420 * dt; if (g.c - q.t0 > q.life) parts.splice(i, 1); }
      if (cr() < dt * 5) bubs.push({ x: 140 + cr() * 520, y: 560, r: 2 + cr() * 3, ph: cr() * 6 });
      for (let i = bubs.length - 1; i >= 0; i--) { const b = bubs[i]; b.y += 80 * spdNow * dt; if (b.y > 620) bubs.splice(i, 1); }
    },
    msg(ty, d, from) {
      if (ty === 'sh') { pT.push(d[0]); xT.push(d[1]); hdT.push(d[3]); sT.push(d[4]); if (!isHelm) hull = d[2]; }
      else if (ty === 'hit') { if (!isHelm && !hitRows[d.i]) { hitRows[d.i] = 1; hull = d.hull; hurtFlash = 1; hitAt = g.c; inv = .9; onHit(xT.at() === null ? 400 : xT.at()); } }
      else if (ty === 'wp') { if (!(d.i in wps) || !isLook) wps[d.i] = d.x; }
      else if (ty === 'tr') { trimIn = d / 100; }
      else if (ty === 'wl') { wlIn = d / 100; }
      else if (ty === 'hold') holdOthers[from] = d;
      else if (ty === 'bell') { onBell(d.k, !isLook); }
      else if (ty === 'bk') { if (isHelm && BR.includes(from)) (results[d.k] = results[d.k] || {})[from] = !!d.ok; }
      else if (ty === 'wv') { if (isHelm || waveRes[d.k]) return; waveRes[d.k] = d; hull = d.hull; onWaveRes(d); }
    },
    /* ── actions (also what the bots call) ── */
    setTrim(v) { if (hasRope && !g.result && !holding()) trim = clamp(v, 0, 1); },
    bail() { if (!hasBail || g.result || holding()) return; wl = Math.max(0, wl - (n === 3 ? .05 : .042)); bailAt = g.c; sfx.blip && sfx.blip(5 + Math.floor(cr() * 6)); for (let i = 0; i < 3; i++) addP(WX + 30, WY - 20, 80 + cr() * 140, -220 - cr() * 120, .6, 1, '#9fe3ff', 3 + cr() * 2); },
    plantAt(px, py) {
      if (!isLook || g.result) return; const r = rowAt(py);
      if (!r) { sfx.tick && sfx.tick(); return; }
      plant(r, px);
    },
    ring() {
      if (!isLook || g.result) return; ringAt = g.c; const k = waveNext(g.c);
      D.send('bell', { k }); onBell(k, false); sfx.coin && sfx.coin();
    },
    setHold(h) { if (!bracer || g.result) return; holdKey = h; },
    draw(T0) { drawFrame(); },
    down(pt) {
      if (g.result) return; const onPlate = pt.y >= PL.y0 && pt.x > PL.x0 && pt.x < PL.x1;
      if (isLook) { if (onPlate) g.ring(); else { curX = pt.x; curY = pt.y; curSet = true; g.plantAt(pt.x, pt.y); } return; }
      if (onPlate) { holdPtr = true; return; }
      if (holding()) return;
      if (isHelm) { ptrA = Math.atan2(pt.y - WY, pt.x - WX); grab = true; }
      else if (isSails || (isDeck && pt.x >= 560)) { ropeGrab = true; g.setTrim((pt.y - ROPE_Y0) / (ROPE_Y1 - ROPE_Y0)); }
      else if (hasBail) g.bail();
    },
    move(pt) {
      curX = pt.x; curY = pt.y; if (isLook) curSet = true; if (g.result) return;
      if (isHelm && grab && !holding()) { const na = Math.atan2(pt.y - WY, pt.x - WX); if (ptrA !== null) { let d = na - ptrA; d = Math.atan2(Math.sin(d), Math.cos(d)); a = clamp(a + d, -PI, PI); } ptrA = na; }
      else if (hasRope && ropeGrab && !holding()) g.setTrim((pt.y - ROPE_Y0) / (ROPE_Y1 - ROPE_Y0));
    },
    up() { holdPtr = false; grab = false; ptrA = null; ropeGrab = false; },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (c === 'Space') { if (e.repeat) return; if (isLook) g.ring(); else g.setHold(true); return; }
      kHeld.add(c);
      if (isLook && (c === 'Enter' || c === 'KeyF') && !e.repeat && !g.result) { const P = pv(); const r = ROWS.find(q => q.p > P + 10 && !(q.i in wps)); if (r) { plant(r, kcx); } else sfx.tick && sfx.tick(); }
      if (hasBail && !e.repeat && (c === 'KeyF' || c === 'KeyJ' || c === 'Enter' || c === 'KeyB')) g.bail();
    },
    keyup(e) { kHeld.delete(e.code); if (e.code === 'Space') holdKey = false; },
  };
  function plant(r, px) { px = clamp(px, CHL, CHR); wps[r.i] = Math.round(px); flagAt = g.c; D.send('wp', { i: r.i, x: Math.round(px) }); sfx.coin && sfx.coin(); ring(px, Y(r.p - pv()), '#ff4d5e', 50, .3); }
  function resolveWave(k) {
    const rs = results[k] || {}; const have = BR.every(r => rs[r] !== undefined);
    if (!have && g.c < TW[k] + BR_OFF + .02 + .75) return;
    waveDone[k] = 1; const ok = BR.every(r => rs[r] === true);
    if (!ok) hull = Math.max(0, hull - 1);
    const d = { k, hit: ok ? 0 : 1, hull }; D.send('wv', d); waveRes[k] = d; onWaveRes(d);
  }
  function onBell(k, others) {
    bellAt = g.c; bellWob = g.c; const c = g.c, nx = k >= 0 ? k : waveNext(c);
    if (nx >= 0 && TW[nx] - c < 3.8 && TW[nx] - c > -.2) alertUntil = TW[nx] + .3; else alertUntil = c + .5;
    snd(1320, .35, 'sine', .08); snd(990, .5, 'sine', .06, .08); if (others) pop('DING DING!', 400, 190, 24, '#ffb13d', '#fff');
  }
  function onWaveFx(k) {
    wobAt = g.c; spray(xv(), SHIPY - 40, 16); sfx.whoosh && sfx.whoosh(false); shake(2, .12);
  }
  function onWaveRes(d) {
    if (d.hit) { hurtFlash = 1; hitAt = g.c; sfx.thud(); sfx.miss(); shake(7, .22); pop('SPLASH!', 400, 230, 28, '#e8434f', '#fff'); spray(xv(), SHIPY - 20, 14); if (hasBail) wl = clamp(wl + .22, 0, 1); }
    else { sfx.coin(); sfx.sparkle && sfx.sparkle(); pop('BRACED!', 400, 230, 28, '#2f9a55', '#fff'); for (let i = 0; i < 3; i++) addP(xv() - 40 + i * 40, SHIPY - 70, 0, -70, 1, 4, '#ff5c8a', 10); }
  }
  function onHit(hx) {
    shake(7, .2); sfx.thud(); sfx.miss(); burst(hx, SHIPY - 40, '#fff', 10); ring(xv(), SHIPY - 30, '#ff4d5e', 70);
    pop(cr() < .5 ? 'CRUNCH!' : 'BONK!', 400, 200, 26, '#e8434f', '#fff'); spray(xv(), SHIPY - 40, 8);
  }
  function onResult() {
    resAt = g.c; if (!ending) ending = { res: g.result, why: hull <= 0 ? 'hull' : 'time' };
    if (g.result === 'win') { snd(523, .12, 'square', .05); snd(659, .12, 'square', .05, .12); snd(784, .12, 'square', .05, .24); snd(1047, .3, 'square', .06, .36); }
    else { [[233, .26, 0], [220, .26, .3], [208, .26, .6], [196, .9, .9]].forEach(([f, d, w], i) => { snd(f, d, 'sawtooth', .06, w, i === 3 ? f * .85 : f); snd(f * 1.005, d, 'square', .02, w); }); }
  }

  /* ───────────── drawing ───────────── */
  function drawBanks(P, T) {
    for (const s of [0, 1]) {
      const edge = y => { const wc = P + (SHIPY - y) / VK; return (s ? 690 : 110) + (s ? 1 : -1) * 0 + (s ? -1 : 1) * (12 * Math.sin(wc * .012 + s) + 6 * Math.sin(wc * .031 + s * 2)); };
      const path = off => { X.beginPath(); X.moveTo(s ? 820 : -20, -20); for (let y = -20; y <= 620; y += 16) X.lineTo(edge(y) + (s ? -off : off), y); X.lineTo(s ? 820 : -20, 620); X.closePath(); };
      X.globalAlpha = .6 + .2 * Math.sin(T * 2 + s); path(-9); X.fillStyle = '#fff'; X.fill(); X.globalAlpha = 1;
      path(0); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#f4d998'; X.fill();
      X.save(); path(0); X.clip(); path(26); X.fillStyle = '#7fd46a'; X.fill(); X.lineWidth = 2.5; X.strokeStyle = '#4f9a6a'; X.stroke(); X.restore();
      const slot = 200; for (let q = Math.floor((P - 120) / slot) - 1; q < Math.floor((P + 340 / VK) / slot) + 2; q++) {
        const h = hash(q * 2 + s * 17), wy = q * slot + hash(q + s * 5) * 120, yy = Y(wy - P), ex = edge(yy); if (yy < -60 || yy > 660) continue;
        const bx = s ? Math.min(790, ex + 40 + hash(q + 3) * 22) : Math.max(10, ex - 40 - hash(q + 3) * 22);
        if (h < .5) palm(bx, yy, .95, T, q); else if (h < .78) { X.save(); X.translate(bx, yy); X.scale(1, VK); X.beginPath(); X.arc(0, 0, 18, 0, TAU); ink('#4fb55f', 3.5); glint(-6, -6, 6, 3, -.5, .45); X.restore(); } else rock(bx, yy, 16, VK, T, q);
      }
    }
  }
  function drawWake(sx, T, spd) {
    X.save(); X.globalAlpha = .5 * clamp(spd, .3, 1); X.strokeStyle = '#fff'; X.lineWidth = 6; X.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const k = (T * 1.2 * (.6 + spd * .5) + i / 4) % 1; X.globalAlpha = (1 - k) * .55; X.beginPath(); X.moveTo(sx + s * (54 + k * 26), SHIPY + 100 + k * 10); X.lineTo(sx + s * (58 + k * 42), SHIPY + 100 + k * 90); X.stroke(); }
    X.restore();
  }
  function drawFrame() {
    X = ctx; if (!TILE) TILE = buildTile();
    const T = g.c, P = pv(), sx0 = xv(), won = ending && ending.res === 'win' || g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? g.c - resAt : -1;
    const off = (P * VK) % 400; X.drawImage(TILE, 0, off - 400); X.drawImage(TILE, 0, off); X.drawImage(TILE, 0, off + 400);
    drawBanks(P, T);
    // the lighthouse at the end
    { const ly = Y(FINAL - P); if (ly > -330 && ly < 700) { X.save(); X.translate(400, ly); X.scale(1, 1); X.translate(-400, -ly); lighthouse(400, ly, T, won || P > LEN - 700); X.restore(); } }
    // rocks
    for (const rw of ROWS) { const y = Y(rw.p - P); if (y < -90 || y > 700) continue; for (const rk2 of rw.rocks) rock(rk2.x, y, rk2.r, VK, T, rk2.s); }
    // big waves (a wall of water that crosses the channel at its fixed time)
    for (let k = 0; k < TW.length; k++) { const dp = (TW[k] - T) * WV, y = Y(dp); if (y > -90 && y < 680) bigWave(y, T, true); }
    // the ship
    drawWake(sx0, T, spdNow);
    drawShip(T, sx0, won, lost, rk);
    // the monster who wants a selfie (background gag, the same on every screen)
    drawMonster(T, sx0, rk, won);
    // fog: everybody but the lookout sees the channel only close to the ship
    if (!isLook && !won) {
      if (!drawFrame.fog) { const gr = X.createLinearGradient(0, SHIPY - 172, 0, SHIPY - 130); gr.addColorStop(0, 'rgba(226,240,244,.92)'); gr.addColorStop(1, 'rgba(226,240,244,0)'); drawFrame.fog = gr; }
      X.fillStyle = drawFrame.fog; X.fillRect(0, 0, 800, SHIPY - 130);
      X.globalAlpha = .55; for (let i = 0; i < 5; i++) { const fx = ((T * (12 + i * 5) + i * 190) % 1000) - 100, fy = SHIPY - 190 + (i % 3) * 36; X.beginPath(); X.ellipse(fx, fy, 90, 22, 0, 0, TAU); X.fillStyle = '#f2fafc'; X.fill(); } X.globalAlpha = 1;
    }
    // flags (above the fog, so the helm sees them from afar)
    for (const r of ROWS) if (r.i in wps) { const y = Y(r.p - P); if (y > 175 && y < 640 && r.p > P - 60) flagStake(wps[r.i], y, T, r.i, false); }
    if (isLook && !g.result) lookCursor(T, P);
    // spray, bubbles, particles
    for (const b of bubs) { X.globalAlpha = .5; X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); X.strokeStyle = '#fff'; X.lineWidth = 2; X.stroke(); X.globalAlpha = 1; }
    for (const q of parts) {
      const aa = (g.c - q.t0) / q.life, f = clamp(1 - aa, 0, 1);
      if (q.k === 1) { X.globalAlpha = f; X.beginPath(); X.arc(q.x, q.y, q.r, 0, TAU); ink(q.c, 1.5); X.globalAlpha = 1; }
      else if (q.k === 4) { X.globalAlpha = f; heart(q.x, q.y, .9, q.c); X.globalAlpha = 1; }
      else { X.globalAlpha = f * .8; X.beginPath(); X.arc(q.x, q.y, q.r, 0, TAU); X.fillStyle = q.c; X.fill(); X.globalAlpha = 1; }
    }
    if (won && rk >= 0) winShow(rk, T, sx0);
    if (lost && rk >= 0) loseShow(rk, T, sx0);
    drawHud(T, P, rk);
    drawControls(T, P, rk);
    if (isLook) lookerFrame(T);
    if (alertUntil > g.c && bracer && !g.result) braceAlert(T);
    for (const q of pops) { const aa = g.c - q.t0; X.globalAlpha = aa > .8 ? Math.max(0, 1 - (aa - .8) / .25) : 1; badge(q.s, clamp(q.x, 130, 670), q.y - Math.min(aa, .6) * 14, q.size, q.bgc, q.fg, aa < .2 ? outBack(aa / .2) : 1, q.rot); X.globalAlpha = 1; }
    vignette(.16);
  }
  function crewOf(r, T, mood) {
    const sx = r === 0 ? 0 : r === 1 ? 0 : 20, sy = r === 0 ? 50 : r === 1 ? -9 : r === 2 ? 14 : 36;
    return [sx, sy];
  }
  function drawShip(T, sx, won, lost, rk) {
    const sp1 = spdNow, tr = trimV(), opt = optAt(T), sf = sailF(tr, opt), heel = hasRope || isHelm || true ? sf.heel : 0;
    let y = SHIPY + Math.sin(T * 2.2) * 2.5, tilt = clamp(hdv(), -1, 1) * .12 + heel * .12 + Math.sin(T * 1.9) * .015;
    const wob = g.c - wobAt, bw = g.c - bellWob; if (wob < .6) tilt += Math.sin(wob * 22) * .09 * (1 - wob / .6); if (bw < .8) tilt += Math.sin(bw * 26) * .05 * (1 - bw / .8);
    const wlv = wlV(); y += Math.max(0, wlv - .5) * 16;
    let sxx = sx; if (won && rk >= 0) { sxx = lerp(sx, 400, ease(clamp(rk / .9, 0, 1))); y = SHIPY + Math.sin(T * 12) * 2; }
    if (lost && rk >= 0) { const k = ease(clamp(rk / .9, 0, 1)); y += k * 40; tilt += k * .5; }
    const bulge = sf.heel > 0 ? 12 + 12 * (1 - sf.heel * .5) : (tr < opt - TOL ? 8 : 34), flap = tr < opt - TOL ? 18 : 0;
    const bulgeV = tr < opt - TOL ? 40 : tr > opt + TOL ? 34 : 64;
    const mood = r => won ? 'happy' : lost ? 'sad' : (hurtFlash > .3 && r !== 1) ? 'sad' : (holdOthers[r] || (r === role && holding())) ? 'happy' : null;
    const flash = inv > 0 && Math.floor(g.c * 16) % 2 === 0;
    X.save(); if (flash) X.globalAlpha = .6;
    shipBody(sxx, y, tilt, T, {
      heel: sf.heel, bulge: bulgeV, flap, noSail: false,
      crew: () => drawCrew(T, mood, won, lost),
      nest: () => { const m = mood(1); claude(0, 6, 1.55, { col: col(1), mood: m }); X.beginPath(); X.moveTo(5, -4); X.lineTo(15, -17); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4.5; X.strokeStyle = '#d9a441'; X.stroke(); },
    });
    X.restore();
    if (lost && rk >= 0) { const k = ease(clamp(rk / .9, 0, 1)); X.save(); X.globalAlpha = .6 * k; el(sxx, y + 30, 92, 70); X.fillStyle = '#47c4ee'; X.fill(); X.globalAlpha = k; el(sxx, y + 30, 92, 70); X.lineWidth = 5; X.strokeStyle = '#fff'; X.stroke(); X.restore(); }
    // name tags
    if (!g.result || rk < .4) MY.forEach(r => { if (g.c >= 3 && r !== role) return; const [cx, cy] = r === 1 ? [0, -12] : crewOf(r); tag(sxx + 84, y + cy * SS - 4, nameOf(r), col(r), 12, 60); line([[sxx + 62, y + cy * SS - 4], [sxx + 50, y + cy * SS - 4]], 3, INK); });
    // the seagull captain on the stern rail
    if (!lost) gull(sxx, y - 92 * SS, T, true, alertUntil > g.c || (T % 7 > 5.6 && T % 7 < 6.4));
    if (T % 7 > 5.7 && T % 7 < 6.4 && !g.result) bubble('ARRR!', sxx + 14, y - 100 * SS, 16, outBack((T % 7 - 5.7) / .15));
    if (g.c - bellAt < 1.1 && !isLook) { const k = (g.c - bellAt) / 1.1; X.save(); X.translate(sxx + 40, y - 150); X.rotate(Math.sin(g.c * 30) * .35 * (1 - k)); X.beginPath(); X.moveTo(-14, 8); X.quadraticCurveTo(-14, -14, 0, -16); X.quadraticCurveTo(14, -14, 14, 8); X.closePath(); ink('#ffd23f', 3); X.beginPath(); X.arc(0, 11, 3.5, 0, TAU); ink('#b8860b', 2); X.restore(); }
  }
  function drawCrew(T, mood, won, lost) {
    const heldBy = r => (r === role ? holding() : !!holdOthers[r]);
    const busyBail = hasBail && g.c - bailAt < .18 || (!hasBail && false);
    // helm at the stern with a little wheel
    { const [cx, cy] = [0, 50], held = heldBy(0); X.save(); X.translate(cx, cy - 18); X.rotate(isHelm ? a * 1.2 : hdv() * 3.4);
      for (let i = 0; i < 6; i++) { X.rotate(TAU / 6); line([[0, 0], [0, -11]], 3, INK); line([[0, 0], [0, -11]], 1.5, '#c98443'); }
      X.beginPath(); X.arc(0, 0, 8, 0, TAU); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#c98443'; X.stroke(); X.restore();
      claude(cx, cy + (held ? 2 : 0), 1.5, { col: col(0), mood: mood(0) }); if (held) bracePuff(cx, cy - 8, T); }
    if (n === 4) {
      { const [cx, cy] = [20, 14], held = heldBy(2); const tt = trimV(), ty2 = cy + 4; line([[-4, 20], [cx - 6, ty2 - 2 + (tt - .5) * 12]], 3.4, INK); line([[-4, 20], [cx - 6, ty2 - 2 + (tt - .5) * 12]], 1.6, '#e6c58c');
        claude(cx + (held ? 0 : Math.sin(T * 3) * .6), cy + (held ? 2 : 0), 1.5, { col: col(2), mood: mood(2) }); if (held) bracePuff(cx, cy - 8, T); }
      { const [cx, cy] = [20, 38], held = heldBy(3), busy = g.c - bailAt < .18; claude(cx, cy + (held ? 2 : 0) - (busy ? 2 : 0), 1.5, { col: col(3), mood: mood(3) });
        bucketMini(cx - 16, cy - 4, busy, wlV()); if (held) bracePuff(cx, cy - 8, T); }
    } else {
      { const [cx, cy] = [20, 22], held = heldBy(2), busy = g.c - bailAt < .18; line([[-4, 12], [cx - 6, cy - 2]], 3.4, INK); line([[-4, 12], [cx - 6, cy - 2]], 1.6, '#e6c58c');
        claude(cx, cy + (held ? 2 : 0) - (busy ? 2 : 0), 1.5, { col: col(2), mood: mood(2) }); bucketMini(cx - 15, cy + 12, busy, wlV()); if (held) bracePuff(cx, cy - 8, T); }
    }
    // water sloshing on deck when the hold is full
    const wv = wlV(); if (wv > .45) { X.save(); X.globalAlpha = clamp((wv - .45) * 1.3, 0, .55); X.fillStyle = '#4fb7ff'; el(0, 24, 22, 28 * (wv)); X.fill(); X.restore(); }
  }
  function bucketMini(bx, by, busy, wlv) { X.save(); X.translate(bx, by); X.rotate(busy ? -.5 : 0); poly([[-7, -6], [7, -6], [5, 7], [-5, 7]]); ink('#c9ced6', 2); X.fillStyle = '#4fb7ff'; X.fillRect(-6, -5, 12, 3); X.restore(); }
  function bracePuff(cx, cy, T) { X.save(); X.globalAlpha = .8; X.strokeStyle = '#fff'; X.lineWidth = 3; for (const s of [-1, 1]) { X.beginPath(); X.arc(cx, cy, 14 + Math.sin(T * 14) * 1.5, s > 0 ? -.8 : PI - .2, s > 0 ? .2 : PI + .8); X.stroke(); } X.restore(); }
  function drawMonster(T, sx, rk, won) {
    const tm = T - 5.8 / TS; if (tm > 0 && tm < 3.4) {   // pops up on the bank, takes a selfie, goes back
      const k = tm < .5 ? ease(tm / .5) : tm > 2.9 ? 1 - ease((tm - 2.9) / .5) : 1, shot = tm > 1.7 && tm < 1.9;
      X.save(); X.beginPath(); X.rect(0, 0, 110, 800); X.clip(); monster(54, 300 + (1 - k) * 80, T, shot, false); X.restore();
      if (shot) { X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(0, 0, 800, 600); }
      if (tm > 1.7 && tm < 2.7) badge('CLICK!', 122, 232, 20, '#9b6ae0', '#fff', outBack((tm - 1.7) / .15), -.08);
    }
  }
  function lookCursor(T, P) {
    if (!curSet) return; const r = rowAt(curY); const cx = clamp(curX, CHL, CHR);
    if (curY < PL.y0 - 10) { X.globalAlpha = .75; flagStake(cx, r ? Y(r.p - P) : curY, T, 3, false); X.globalAlpha = 1; }
  }
  function braceAlert(T) {
    const pul = 1 + Math.sin(T * 18) * .06; badge('BRACE!', 400, 250, 44 * pul, '#e8434f', '#fff', 1, Math.sin(T * 22) * .03);
    if (!holding()) { X.save(); X.translate(400, 300); X.globalAlpha = .6 + .4 * Math.sin(T * 14); poly([[-16, -8], [16, -8], [0, 14]]); ink('#fff', 3); X.restore(); }
  }
  function winShow(rk, T, sx) {
    // the monster pops out next to the dock for its selfie with the crew; hearts and confetti
    const k = clamp(rk / .35, 0, 1), mx = lerp(-60, 150, ease(k));
    monster(mx, 360, T, rk > .55 && rk < .75, false); if (rk > .55 && rk < .72) { X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(0, 0, 800, 600); }
    if (rk > .3) badge(rk > .55 ? 'CLICK!' : 'SELFIE!', 190, 280, 22, '#9b6ae0', '#fff', outBack((rk - .3) / .2), -.07);
    for (let i = 0; i < 4; i++) { const q = (T * 1.1 + i / 4) % 1; X.globalAlpha = 1 - q; heart(400 - 60 + i * 40, SHIPY - 80 - q * 80, 1, '#ff5c8a'); X.globalAlpha = 1; }
    if (rk > .15) badge('MADE IT!', 400, 190, 30, '#2f9a55', '#fff', outBack((rk - .15) / .2), -.04);
  }
  function loseShow(rk, T, sx) {
    // the ship sinks gently; the crew floats on barrels, the cook wears the pot
    const k = clamp((rk - .15) / .35, 0, 1); if (k <= 0) return;
    X.save(); X.translate(0, (1 - outBack(k)) * 30);
    MY.forEach((r, i) => { const bx = sx - 90 + i * (180 / (MY.length - 1)), by = SHIPY - 10 + (i % 2) * 36; barrel(bx, by, T, i); claude(bx, by - 8, 1.7, { col: col(r), mood: 'sad' }); if (r === (n === 4 ? 3 : 2)) pot(bx, by - 30, 1.3); });
    X.restore();
    if (rk > .5) bubble('SQUAWK!', sx + 70, SHIPY - 100 + Math.sin(T * 3) * 4, 17, outBack((rk - .5) / .2));
    gull(sx + 70, SHIPY - 90 + Math.sin(T * 3) * 4, T, true, true);
  }
  function drawHud(T, P, rk) {
    const sx = 332, sy = 64, sw = 330, sh = 52;
    line([[sx + 40, 50], [sx + 40, sy + 4]], 4, '#e6c58c'); line([[sx + sw - 40, 50], [sx + sw - 40, sy + 4]], 4, '#e6c58c');
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(sx + 4, sy + 7, sw, sh, 14); X.fill();
    rr(sx, sy, sw, sh, 14); ink(WOOD, 4); X.fillStyle = '#c98443'; for (let i = 0; i < 3; i++) { rr(sx + 8, sy + 12 + i * 14, sw - 16, 2.5, 1); X.fill(); }
    for (let i = 0; i < HULL; i++) {                       // hull: cardboard planks that fall off
      const on = i < hull, x0 = sx + 22 + i * 24, y0 = sy + 12; X.save(); X.translate(x0, y0); if (!on) X.globalAlpha = .45;
      rr(0, 0, 18, 28, 4); ink(on ? CARD : '#b8b4c8', 3); if (on) { X.strokeStyle = 'rgba(150,95,40,.45)'; X.lineWidth = 1.6; for (let q = 1; q < 4; q++) { X.beginPath(); X.moveTo(q * 4.5, 3); X.lineTo(q * 4.5, 25); X.stroke(); } } X.restore();
    }
    const bx = sx + 140, bw = 150, by = sy + sh / 2 + 3, kk = clamp(P / LEN, 0, 1);
    line([[bx, by], [bx + bw, by]], 8, INK); line([[bx, by], [bx + bw, by]], 4, '#fff1c9');
    for (const w of TW) { const wx = bx + clamp((w * SPD * TS * .9) / LEN, 0, 1) * bw; X.fillStyle = '#1f8fcf'; X.beginPath(); X.arc(wx, by, 2.6, 0, TAU); X.fill(); }
    X.save(); X.translate(bx + bw + 14, by - 4); rr(-6, -12, 12, 20, 3); ink('#fff', 2.5); X.fillStyle = '#e8434f'; X.fillRect(-6, -4, 12, 5); poly([[-7, -12], [0, -19], [7, -12]]); ink('#e8434f', 2); X.restore();
    X.save(); X.translate(bx + kk * bw, by - 4); poly([[-7, 6], [7, 6], [4, -6], [-4, -6]]); ink(CARD, 2.5); X.restore();
  }
  function drawControls(T, P, rk) {
    const done = !!g.result, py = 478 + (rk > 0 ? ease(clamp((rk - .1) / .25, 0, 1)) * 120 : 0);
    // water gauge on the left bank (everybody sees it)
    { const gx = 50, gy0 = 160, gh = 186, wv = wlV(); X.save(); X.fillStyle = 'rgba(20,16,28,.28)'; rr(gx - 18 + 4, gy0 - 14 + 6, 36, gh + 56, 18); X.fill();
      rr(gx - 18, gy0 - 14, 36, gh + 52, 18); ink('#f4f6fb', 4);
      X.save(); rr(gx - 9, gy0 - 4, 18, gh, 9); X.clip(); X.fillStyle = '#3b3550'; X.fillRect(gx - 9, gy0 - 4, 18, gh); X.fillStyle = wv > .8 ? '#ff4d5e' : '#4fb7ff'; const fh = gh * wv; X.fillRect(gx - 9, gy0 - 4 + gh - fh, 18, fh);
      X.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 3; i++) { el(gx - 9 + i * 9, gy0 - 4 + gh - fh + Math.sin(T * 5 + i) * 1.5, 5, 2.5); X.fill(); } glint(gx - 4, gy0 + 30, 2, 50, 0, .4); X.restore();
      rr(gx - 9, gy0 - 4, 18, gh, 9); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
      const my = gy0 - 4 + gh * (1 - .5); X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(gx - 14, my); X.lineTo(gx + 14, my); X.stroke(); X.strokeStyle = '#ffd23f'; X.lineWidth = 2.5; X.stroke();
      X.restore(); tag(gx, gy0 + gh + 24, 'WATER', wv > .8 ? '#ff8a94' : '#9fe3ff', 12, 70); }
    // role props and plates
    if (isHelm) wheelProp(T); if (hasBail) bucketProp(T); if (hasRope) ropeProp(T);
    if (isHelm || isLook) railProp(T, P);
    if (isLook) plate(400, py, 310, 56, '#ffd23f', '#c99512', 'RING!', 'SPACE', g.c - ringAt < .15, done, (x, y) => { X.save(); X.translate(x, y - 2); X.beginPath(); X.moveTo(-13, 12); X.quadraticCurveTo(-13, -14, 0, -16); X.quadraticCurveTo(13, -14, 13, 12); X.closePath(); ink('#fff', 2.5); X.beginPath(); X.arc(0, 15, 3.5, 0, TAU); ink('#fff', 2); X.restore(); });
    else { const al = alertUntil > g.c, hh = holding(); plate(400, py, 310, 56, hh ? '#5CFF7A' : al ? '#ff4d5e' : '#ff9a4d', hh ? '#23a046' : al ? '#b8283a' : '#c46a1a', al || hh ? 'HOLD!' : 'BRACE', 'SPACE', hh, done, (x, y) => { X.save(); X.translate(x, y); poly([[-14, -14], [14, -14], [14, 4], [0, 16], [-14, 4]]); ink('#fff', 2.5); X.restore(); }); }
    if (!done && T < 3.6) {
      if (isLook) badge(TOUCH ? 'TAP THE GAPS!' : 'CLICK THE GAPS!', 250, 372, 20, '#e8434f', '#fff', 1, -.04);
      else if (hasBail && !hasRope) badge(TOUCH ? 'TAP TAP TAP!' : 'MASH CLICK!', 250, 300, 24, '#c99512', '#fff', 1, -.04);
    }
  }
  function railProp(T, P) {                                  // the compass rail: ship + flags
    const ry = 160, x0 = 170, x1 = 630; X.save(); X.globalAlpha = .96;
    line([[x0, ry], [x1, ry]], 9, INK); line([[x0, ry], [x1, ry]], 4, '#e6c58c'); for (const px of [x0, x1]) { rr(px - 5, ry - 11, 10, 22, 3); ink(WOOD2, 2.5); }
    const mp = x => x0 + (x - CHL) / (CHR - CHL) * (x1 - x0);
    for (const r of ROWS) if (r.i in wps && r.p > P - 40) { const fx = mp(wps[r.i]); X.beginPath(); X.moveTo(fx, ry - 5); X.lineTo(fx, ry - 26); X.lineTo(fx + 15, ry - 21); X.lineTo(fx, ry - 15); X.closePath(); ink(r.p === (ROWS.find(q => q.i in wps && q.p > P - 40) || {}).p ? '#ff4d5e' : '#ff9aa6', 2.5); }
    const sxm = mp(xv()); poly([[sxm - 8, ry + 14], [sxm + 8, ry + 14], [sxm + 5, ry + 2], [sxm - 5, ry + 2]]); ink(CARD, 2.5);
    X.restore();
  }
  function wheelProp(T) {
    X.save(); rr(WX - 82, WY - 74, 164, 150, 26); ink(WOOD, 4); X.fillStyle = '#c98443'; for (let i = 0; i < 4; i++) { rr(WX - 74, WY - 56 + i * 32, 148, 3, 1); X.fill(); }
    X.translate(WX, WY - 4); X.rotate(a);
    for (let i = 0; i < 8; i++) { X.rotate(TAU / 8); line([[0, 0], [0, -56]], 9, INK); line([[0, 0], [0, -56]], 4, '#e6c58c'); el(0, -62, 6, 6); ink('#c98443', 2.5); }
    X.beginPath(); X.arc(0, 0, 44, 0, TAU); X.lineWidth = 16; X.strokeStyle = INK; X.stroke(); X.lineWidth = 9; X.strokeStyle = '#c98443'; X.stroke();
    X.beginPath(); X.arc(0, 0, 14, 0, TAU); ink('#ffd23f', 3); X.beginPath(); X.arc(0, -44, 5, 0, TAU); ink('#e8434f', 2);
    X.restore();
    // limit marker and keys
    if (!TOUCH) { keyCap(WX - 56, WY + 66, 'A'); keyCap(WX + 56, WY + 66, 'D'); }
    const al = clamp(a / PI, -1, 1); X.fillStyle = INK; for (let i = -2; i <= 2; i++) { X.beginPath(); X.arc(WX + i * 14, WY - 84, 3.6, 0, TAU); X.fill(); } X.beginPath(); X.arc(WX + al * 28, WY - 84, 5, 0, TAU); ink('#ffd23f', 2);
  }
  function bucketProp(T) {
    const busy = g.c - bailAt < .16, k = busy ? 1 : 0;
    X.save(); rr(WX - 82, WY - 74, 164, 150, 26); ink(WOOD, 4); X.fillStyle = '#c98443'; for (let i = 0; i < 4; i++) { rr(WX - 74, WY - 56 + i * 32, 148, 3, 1); X.fill(); }
    X.translate(WX, WY + 4); X.rotate(busy ? -.35 : Math.sin(T * 2) * .03);
    poly([[-38, -34], [38, -34], [28, 40], [-28, 40]]); cel('#c9ced6', '#8f9cb3', () => poly([[-38, -34], [38, -34], [28, 40], [-28, 40]]), 6, 0, 4);
    X.fillStyle = '#4fb7ff'; el(0, -34, 38, 8); X.fill(); X.lineWidth = 3; X.strokeStyle = INK; el(0, -34, 38, 8); X.stroke(); glint(-12, -4, 6, 20, .15, .4);
    X.beginPath(); X.arc(0, -34, 40, PI * 1.05, PI * 1.95); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#c98443'; X.stroke();
    X.restore();
    if (!TOUCH) { keyCap(WX - 20, WY + 66, 'F'); keyCap(WX + 20, WY + 66, 'J'); }
  }
  function ropeProp(T) {
    const tt = trim, ky = ROPE_Y0 + (ROPE_Y1 - ROPE_Y0) * tt, opt = optAt(T), nx = optNext(T), pre = segLeft(T) < 1.1;
    X.save(); rr(ROPE_X - 26, ROPE_Y0 - 36, 52, ROPE_Y1 - ROPE_Y0 + 80, 18); ink(WOOD, 4); X.fillStyle = '#b9722f'; rr(ROPE_X - 12, ROPE_Y0 - 14, 24, ROPE_Y1 - ROPE_Y0 + 28, 12); X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
    const zy = t2 => ROPE_Y0 + (ROPE_Y1 - ROPE_Y0) * t2;
    if (pre) { X.globalAlpha = .45 + .25 * Math.sin(T * 12); X.fillStyle = '#ffd23f'; X.fillRect(ROPE_X - 12, zy(nx - TOL), 24, (ROPE_Y1 - ROPE_Y0) * TOL * 2); X.globalAlpha = 1; }
    X.fillStyle = 'rgba(92,255,122,.85)'; X.fillRect(ROPE_X - 12, zy(opt - TOL), 24, (ROPE_Y1 - ROPE_Y0) * TOL * 2); X.strokeStyle = INK; X.lineWidth = 3; X.strokeRect(ROPE_X - 12, zy(opt - TOL), 24, (ROPE_Y1 - ROPE_Y0) * TOL * 2);
    X.beginPath(); X.arc(ROPE_X, ROPE_Y0 - 22, 12, 0, TAU); ink('#c9ced6', 3);
    line([[ROPE_X, ROPE_Y0 - 22], [ROPE_X, ky]], 7, INK); line([[ROPE_X, ROPE_Y0 - 22], [ROPE_X, ky]], 3.4, '#f3e3b8');
    const inZ = Math.abs(tt - opt) <= TOL; X.beginPath(); X.arc(ROPE_X, ky, 15, 0, TAU); ink(inZ ? '#5CFF7A' : '#fff', 3.5); X.beginPath(); X.arc(ROPE_X, ky, 6, 0, TAU); ink('#c98443', 2);
    X.restore();
    tag(ROPE_X, ROPE_Y0 - 50, 'SLACK', '#cde6ff', 11, 56); tag(ROPE_X, ROPE_Y1 + 40, 'TIGHT', '#ffd0b0', 11, 56);
    // the wind (an arrow-flag)
    X.save(); X.translate(ROPE_X, ROPE_Y0 - 84); X.rotate(Math.sin(T * 2) * .08); poly([[-26, -8], [8, -8], [8, -18], [28, 0], [8, 18], [8, 8], [-26, 8]]); ink('#bfe9ff', 3); glint(-8, -3, 12, 2.5, 0, .7); X.restore();
    if (!TOUCH) { keyCap(ROPE_X - 52, ROPE_Y0 + 60, 'W'); keyCap(ROPE_X - 52, ROPE_Y0 + 92, 'S'); }
    if (g.c < 4 && !g.result) badge('GREEN = PERFECT', 600, ROPE_Y0 + 170, 15, '#2f9a55', '#fff', 1, -.05);
  }
  /* the crow's nest: the lookout sees the route squeezed, with the next wave's countdown */
  function lookerFrame(T) {
    const nx = waveNext(g.c), wi = nx >= 0 ? TW[nx] - g.c : 99;
    if (wi < 2.8 && wi > -.2 && !g.result) { badge('BIG WAVE!', 400, 300, 34, '#e8434f', '#fff', 1, Math.sin(T * 20) * .03); X.fillStyle = INK; rr(300, 334, 200, 18, 9); X.fill(); X.fillStyle = wi < 1.5 ? '#ffd23f' : '#fff'; rr(303, 337, 194 * clamp(wi / 2.8, 0, 1), 12, 6); X.fill(); }
  }
  g.dbg = {
    ROWS, LEN, TW, SHIPY,
    helmView: () => { const P = p; return { x, a, p, hd, hull, wps: ROWS.filter(r => r.i in wps && r.p > P - 55).map(r => ({ i: r.i, x: wps[r.i], dp: r.p - P })), WX, WY, speed: spdNow }; },
    lookView: () => { const P = pv(); return { P, rows: ROWS.filter(r => r.p - P < (SHIPY - 80) / LK && r.p - P > -30).map(r => ({ i: r.i, dp: r.p - P, cs: r.cs, set: r.i in wps, x: wps[r.i] })), waveIn: (() => { const k = waveNext(g.c); return k >= 0 ? TW[k] - g.c : null; })(), wavek: waveNext(g.c) }; },
    sailsView: () => ({ trim, opt: optAt(g.c), next: optNext(g.c), left: segLeft(g.c), TOL, ROPE_X, ROPE_Y0, ROPE_Y1 }),
    bailView: () => ({ wl }),
    braceView: () => ({ alert: alertUntil > g.c, hold: holding(), until: alertUntil, wave: waveNext(g.c) }),
    cheat: res => { if (res === 'win') { p = LEN; } else { hull = 0; hullV = 0; } },
  };
  wire(g, D, 0, sp, 'sq_storm');
  return g;
}

/* ───────────── intro card demos (520×240 frame) ───────────── */
function demoBg(t) {
  X = ctx; X.fillStyle = SEA1; X.fillRect(0, 0, 520, 240);
  X.strokeStyle = 'rgba(255,255,255,.45)'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 12; i++) { const x = (i * 97) % 520, y = ((i * 61 + t * 70) % 260) - 10; X.beginPath(); X.moveTo(x - 14, y); X.quadraticCurveTo(x, y - 6, x + 14, y); X.stroke(); }
  for (const s of [0, 1]) { X.beginPath(); X.moveTo(s ? 520 : 0, 0); X.lineTo(s ? 470 : 50, 0); for (let y = 0; y <= 240; y += 20) X.lineTo((s ? 470 : 50) + Math.sin(y * .06 + t) * 6, y); X.lineTo(s ? 520 : 0, 240); X.closePath(); ink('#f4d998', 3.5); }
}
function demoShip(x, y, s, t, o) {
  X.save(); X.translate(x, y); X.scale(s, s); X.translate(-x, -y);
  shipBody(x, y, o.tilt || 0, t, { heel: o.heel || 0, bulge: o.bulge === undefined ? 30 : o.bulge, flap: o.flap || 0,
    crew: () => { claude(0, 50, 1.5, { col: DEF[0], mood: o.mood }); claude(20, 14, 1.5, { col: DEF[2], mood: o.mood }); claude(20, 38, 1.5, { col: DEF[3], mood: o.mood }); },
    nest: () => claude(0, 6, 1.55, { col: DEF[1], mood: o.mood }) });
  X.restore();
}
function demoProp(kind, t, act) {
  const cx = 90, cy = 140;
  if (kind === 'helm') {
    const a = Math.sin(t * 1.6) * 2; X.save(); rr(cx - 70, cy - 66, 140, 132, 22); ink(WOOD, 4); X.translate(cx, cy); X.rotate(a);
    for (let i = 0; i < 8; i++) { X.rotate(TAU / 8); line([[0, 0], [0, -46]], 8, INK); line([[0, 0], [0, -46]], 3.5, '#e6c58c'); el(0, -51, 5, 5); ink('#c98443', 2); }
    X.beginPath(); X.arc(0, 0, 36, 0, TAU); X.lineWidth = 14; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#c98443'; X.stroke(); X.beginPath(); X.arc(0, 0, 12, 0, TAU); ink('#ffd23f', 3); X.restore();
    demoFinger(cx + 40 * Math.cos(a - 1), cy + 40 * Math.sin(a - 1), true, 0);
  } else if (kind === 'look') {
    for (const i of [0, 1]) rock(70 + i * 34, 90 + i * 70, 24, .9, t, i + 3);
    flagStake(100, 170, t, 1, false); demoFinger(100, 168 + (act ? 4 : 0), act > .3, act);
    X.save(); X.translate(cx - 6, 52); X.rotate(Math.sin(t * 20) * .3 * (act > .7 ? 1 : 0)); X.beginPath(); X.moveTo(-14, 10); X.quadraticCurveTo(-14, -14, 0, -16); X.quadraticCurveTo(14, -14, 14, 10); X.closePath(); ink('#ffd23f', 3); X.restore();
  } else if (kind === 'sails' || kind === 'deck') {
    const tt = .5 + .3 * Math.sin(t * 1.5), y0 = 40, y1 = 210;
    X.save(); rr(cx - 22, y0 - 22, 44, y1 - y0 + 44, 16); ink(WOOD, 4); X.fillStyle = 'rgba(92,255,122,.85)'; X.fillRect(cx - 10, y0 + (y1 - y0) * .46, 20, 40); line([[cx, y0 - 8], [cx, y0 + (y1 - y0) * tt]], 6, INK); line([[cx, y0 - 8], [cx, y0 + (y1 - y0) * tt]], 3, '#f3e3b8');
    X.beginPath(); X.arc(cx, y0 + (y1 - y0) * tt, 13, 0, TAU); ink('#fff', 3); X.restore(); demoFinger(cx, y0 + (y1 - y0) * tt + 8, true, 0);
    if (kind === 'deck') { const k = (t * 2.4) % 1; X.save(); X.translate(cx + 110, 190); X.rotate(k < .4 ? -.4 : 0); poly([[-24, -30], [24, -30], [18, 22], [-18, 22]]); ink('#c9ced6', 3.5); X.restore(); demoFinger(cx + 110, 120, k < .4, k * 2.5); }
  } else {
    const k = (t * 3) % 1; X.save(); X.translate(cx, cy + 20); X.rotate(k < .35 ? -.4 : 0); poly([[-40, -36], [40, -36], [30, 42], [-30, 42]]); cel('#c9ced6', '#8f9cb3', () => poly([[-40, -36], [40, -36], [30, 42], [-30, 42]]), 6, 0, 4); X.fillStyle = '#4fb7ff'; el(0, -36, 40, 8); X.fill(); X.restore();
    for (let i = 0; i < 4; i++) { const q = (t * 2 + i / 4) % 1; X.globalAlpha = 1 - q; X.beginPath(); X.arc(cx + 40 + q * 70, cy - 20 - Math.sin(q * 3) * 50, 4, 0, TAU); ink('#9fe3ff', 1.5); X.globalAlpha = 1; }
    demoFinger(cx, cy + 40, k < .35, k * 2.8);
  }
}
function demoFor(t, kind) {
  demoBg(t); X = ctx; const u = t % 3.2;
  if (kind === 'helm') { const tx = 340 + Math.sin(t * 1.3) * 80; flagStake(tx, 70, t, 2, false); demoShip(tx, 170, .55, t, { tilt: Math.cos(t * 1.3) * .12, mood: null }); demoProp('helm', t, 0); badge('FOLLOW THE FLAGS!', 330, 22, 15, '#2a82c4', '#fff', 1, -.03); }
  else if (kind === 'look') { rock(300, 80, 34, 1, t, 4); rock(430, 80, 34, 1, t, 5); flagStake(365, 90, t, 1, false); badge(u > 1.2 ? 'FLAG!' : 'GAP!', 340, 22, 16, '#e8434f', '#fff', 1, -.04); demoShip(365, 190, .5, t, { mood: null }); demoProp('look', t, u > 1.0 && u < 1.5 ? 1 : 0); }
  else if (kind === 'sails') { demoShip(300, 150, .65, t, { bulge: 6 + 26 * (.5 + .5 * Math.sin(t * 1.5)), flap: 6 }); demoProp('sails', t, 0); badge('MATCH THE WIND!', 330, 22, 15, '#2f9a55', '#fff', 1, -.03); }
  else if (kind === 'bail') { demoShip(300, 150, .65, t, { mood: null }); demoProp('bail', t, 0); badge('BAIL BAIL BAIL!', 330, 22, 15, '#c99512', '#fff', 1, -.03); }
  else if (kind === 'deck') { demoShip(300, 150, .65, t, { bulge: 6 + 26 * (.5 + .5 * Math.sin(t * 1.5)), flap: 6 }); demoProp('deck', t, 0); badge('ROPE + BUCKET!', 330, 22, 15, '#c99512', '#fff', 1, -.03); }
}
function demoWave(t) {
  demoBg(t); X = ctx; const u = t % 3.4;
  demoShip(260, 170, .6, t, { tilt: u > 2.3 && u < 2.8 ? Math.sin(u * 30) * .08 : 0, mood: u > 2.3 ? 'happy' : null });
  const wy = 190 - u * 70;
  if (u < 2.4) bigWave(wy - 60, t, true);
  badge(u < 1.2 ? 'DING DING!' : u < 2.4 ? 'HOLD!' : 'BRACED!', 400, 30, 20, u < 2.4 ? '#e8434f' : '#2f9a55', '#fff', 1, -.04);
  plate(400, 190, 220, 44, u > 1.1 && u < 2.5 ? '#5CFF7A' : '#ff9a4d', u > 1.1 && u < 2.5 ? '#23a046' : '#c46a1a', 'BRACE', null, u > 1.1 && u < 2.5, false);
  demoFinger(400, 220, u > 1.1 && u < 2.5, 0);
}
DUO.INFO.sq_storm = n => n === 4
  ? [['HELM', 'STEER THROUGH THE FOG TO THE FLAGS', 'DRAG IN CIRCLES / A D'], ['LOOKOUT', 'FLAG THE GAPS, RING FOR WAVES', 'CLICK GAPS / SPACE'], ['SAILS', 'KEEP THE ROPE IN THE GREEN', 'DRAG THE ROPE / W S'], ['BAILER', 'SCOOP THE WATER OUT', 'MASH CLICK / F J']]
  : [['HELM', 'STEER THROUGH THE FOG TO THE FLAGS', 'DRAG IN CIRCLES / A D'], ['LOOKOUT', 'FLAG THE GAPS, RING FOR WAVES', 'CLICK GAPS / SPACE'], ['DECK', 'TRIM THE SAIL AND BAIL', 'ROPE = DRAG, BUCKET = TAP']];
DUO.DEMOS.sq_storm = n => (n === 4 ? ['helm', 'look', 'sails', 'bail'] : ['helm', 'look', 'deck']).map(k => t => (t % 8 < 5.6 ? demoFor(t, k) : demoWave(t % 8 - 5.6)));

reg('sq_storm', storm, 'STORM SHIP'); REGMAP.sq_storm.duo = true; REGMAP.sq_storm.squad = true;
})();
