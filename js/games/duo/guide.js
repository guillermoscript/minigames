'use strict';
/* ═════════ DUO · DARK STEPS (du_guide) ═════════
   A frozen lake at night, full of thin ice. WALKER (role 0, JUDGE) crosses it in the dark: on its screen every ice slab looks the
   same. GUIDE (role 1) stands on the lookout tower, sees the thin ice and shouts the way through a megaphone (◄ ▲ ►).
   The walker steps with three chunky buttons; it only moves left, right and forward (the route never needs to go back).
   Thin ice = SPLOOSH: it pops back out as an ice cube and lands on the pier again (the hole stays open on its screen).
   Step off the far side onto the shore to win. Time out = it freezes solid.
   Netcode: a shout is ONE event 'sig {d, id, ep}'. The walker queues shouts in order (the big arrow in the bubble is NEXT and its
   button glows); every step eats the oldest one. A step is ONE event 'st {c, r, f, ep, k}' (f: fell through, k: id of the last shout
   eaten). A fall bumps the epoch ep and clears the queue, so shouts the guide sent before it saw the fall (lag) are dropped
   instead of walking the walker into the next hole. The walker's own moves are instant; the guide sees them hop ~one lag later. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box down to ~y170, the top-right corner and y>552) ───────────── */
const C = 5, RW = 5, CS = 70, GX = 400, GY = 140;                          // the ice: 5×5 slabs; row RW is the pier, row -1 the far shore
const tcx = c => GX + c * CS + CS / 2, tcy = r => GY + r * CS + CS / 2;
const LK = [382, 122, 386, 392];                                            // the lake (rounded), the slabs sit inside it
const BTN = [[16, 452, 104, 86], [132, 452, 104, 86], [248, 452, 104, 86]];  // ◄ ▲ ►
const DX = [-1, 0, 1], DY = [0, -1, 0], ROT = [-Math.PI / 2, 0, Math.PI / 2];
const TWX = 92, TWY = 330;                                                  // the guide's feet on the tower platform
const BUB = [160, 182, 204, 132];                                           // the speech bubble (x, y, w, h)
const MEG = [150, 300];                                                     // where the megaphone's mouth points from
const SNX = 322, SNY = 128;                                                 // the snowman (it watches the walker)
const FIRE = [362, 126];                                                    // the campfire on the far shore

/* palette */
const ICE = '#a6dcf6', ICE2 = '#7ec1e8', ICEL = '#dff4ff', SNOW = '#eef4ff', SNOW2 = '#bccbef';
const WATER = '#0f2c58', WATER2 = '#1d4a86';
const WOOD = '#b77a43', WOOD2 = '#8a5530', WOODL = '#d9995a';
const PLATE_W = ['#5ec8ff', '#2a86c2'], PLATE_G = ['#ff9b4a', '#c25a1c'], PLATE_LIT = ['#ffd23f', '#c99512'];

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function pill(x, y, label, col, up) {                // a name tag with a little pointer (down, or up), e.g. YOU / YOUR FRIEND
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
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
/* chunky 3D button: returns the y offset of its face (it sinks when pressed) */
function plate(b, col, dk, down, lit) {
  const [x, y, w, h] = b, d = down ? 3 : 9;
  rr(x, y + 9, w, h, 20); ink(dk, 4);
  rr(x, y + 9 - d, w, h, 20); ink(col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 12, 6); X.fill();
  rr(x, y + 9 - d, w, h, 20); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  if (lit) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.globalAlpha = .6 + .4 * Math.sin(now * 10); rr(x + 7, y + 16 - d, w - 14, h - 14, 15); X.stroke(); X.globalAlpha = 1; }
  return 9 - d;
}
/* a fat arrow (pointing up when rot = 0), s = 1 is ~44 px tall */
function arrow(x, y, s, rot, fill, o = 4) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  X.beginPath(); X.moveTo(0, -22); X.lineTo(20, -1); X.lineTo(8.5, -1); X.lineTo(8.5, 20); X.lineTo(-8.5, 20); X.lineTo(-8.5, -1); X.lineTo(-20, -1); X.closePath();
  X.lineJoin = 'round'; if (o) { X.lineWidth = o * 2 / s; X.strokeStyle = INK; X.stroke(); } X.fillStyle = fill; X.fill();
  X.fillStyle = 'rgba(255,255,255,.45)'; X.beginPath(); X.moveTo(-2, -17); X.lineTo(-13, -5); X.lineTo(-8, -5); X.closePath(); X.fill();
  X.restore();
}
function keyCap(x, y, d) {                             // a little arrow key under the big arrow (desktop only)
  rr(x - 15, y - 12, 30, 24, 6); ink('#fff', 2.5);
  X.save(); X.translate(x, y); X.rotate(ROT[d]); X.fillStyle = INK; X.beginPath(); X.moveTo(0, -7); X.lineTo(6, 0); X.lineTo(2.2, 0); X.lineTo(2.2, 7); X.lineTo(-2.2, 7); X.lineTo(-2.2, 0); X.lineTo(-6, 0); X.closePath(); X.fill(); X.restore();
}
function check(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.lineCap = 'round'; X.lineJoin = 'round';
  X.beginPath(); X.moveTo(-9, 0); X.lineTo(-3, 7); X.lineTo(10, -8); X.lineWidth = 10; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4.5; X.strokeStyle = '#5CFF7A'; X.stroke(); X.restore();
}
/* two thin blocky arms raised from caos()'s side stubs (drawn before caos(), so the body hides the shoulder) */
function arms(u, la, ra, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  const one = (sx, an) => {
    X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
    X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
    X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
    X.restore();
  };
  one(-1, la); one(1, ra);
}
/* a bobble beanie on top of caos() (unit u, origin = the feet) */
function beanie(u, col) {
  const y = -9 * u;
  X.beginPath(); X.moveTo(-5.4 * u, y + .6 * u); X.bezierCurveTo(-5 * u, y - 4.6 * u, 5 * u, y - 4.6 * u, 5.4 * u, y + .6 * u); X.closePath(); ink(col, 3);
  X.fillStyle = 'rgba(255,255,255,.55)'; for (let i = -2; i <= 2; i++) X.fillRect(i * 2 * u - .4 * u, y - 2.6 * u + Math.abs(i) * .5 * u, .8 * u, 2.6 * u - Math.abs(i) * .5 * u);
  rr(-6 * u, y - .4 * u, 12 * u, 1.8 * u, .8 * u); ink('#fff', 3);
  X.beginPath(); X.arc(0, y - 3.9 * u, 1.3 * u, 0, TAU); ink('#fff', 3);
}
/* a translucent ice block around whatever was just drawn at (0, 0) (unit u) */
function iceBlock(u, k) {
  const w = 17 * u * k, h = 15 * u * k;
  X.globalAlpha = .62; rr(-w / 2, -h + 1.6 * u, w, h, 2.2 * u); X.fillStyle = '#c9f0ff'; X.fill(); X.globalAlpha = 1;
  rr(-w / 2, -h + 1.6 * u, w, h, 2.2 * u); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  X.fillStyle = 'rgba(255,255,255,.8)'; rr(-w / 2 + 2 * u * k, -h + 3 * u * k, w * .14, h * .55, u * .6); X.fill(); rr(-w / 2 + 4.6 * u * k, -h + 3 * u * k, w * .06, h * .3, u * .4); X.fill();
}

function icicles(u, k) {                             // icicles hanging off the bottom edge of the ice block
  if (k <= 0) return; X.fillStyle = '#e3f7ff'; X.strokeStyle = INK; X.lineWidth = 2.5; X.lineJoin = 'round';
  for (const [x, l] of [[-5.5, 3.2], [-2, 2], [1.5, 3.8], [5, 2.4]]) { X.beginPath(); X.moveTo(x * u - 1.3 * u, 1.6 * u); X.lineTo(x * u, (1.6 + l * k) * u); X.lineTo(x * u + 1.3 * u, 1.6 * u); X.closePath(); X.stroke(); X.fill(); }
}
/* the irregular outline of the hole in slab (c, r): fixed per slab so both screens draw the same one */
function holePath(c, r, k) {
  const x = tcx(c), y = tcy(r), n = 11, s = (c * 7 + r * 13) % 10;
  X.beginPath();
  for (let i = 0; i < n; i++) { const a = i / n * TAU, rad = (22 + ((s + i * 5) % 7) * 1.6) * k; X.lineTo(x + Math.cos(a) * rad * 1.08, y + Math.sin(a) * rad * .92); }
  X.closePath();
}
function hole(c, r, k, T) {                          // open water: a jagged rim of broken ice, rippling water, a floating chunk
  if (k <= .02) return; const x = tcx(c), y = tcy(r);
  holePath(c, r, k * 1.14); X.fillStyle = 'rgba(255,255,255,.85)'; X.fill(); X.lineWidth = 2; X.strokeStyle = '#7ec1e8'; X.stroke();
  holePath(c, r, k); X.lineWidth = 5; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke();
  const gr = X.createLinearGradient(0, y - 24, 0, y + 24); gr.addColorStop(0, '#0d2550'); gr.addColorStop(1, '#2867a8'); X.fillStyle = gr; X.fill();
  X.save(); holePath(c, r, k); X.clip();
  X.strokeStyle = 'rgba(150,215,255,.75)'; X.lineWidth = 2.5;
  for (let i = 0; i < 2; i++) { const q = (T * .6 + i * .5 + c * .3 + r * .17) % 1; X.globalAlpha = 1 - q; el(x, y + 3, (5 + q * 20) * k, (2 + q * 8) * k); X.stroke(); }
  X.globalAlpha = 1; X.fillStyle = 'rgba(255,255,255,.35)'; el(x - 8 * k, y - 10 * k, 9 * k, 3 * k, -.3); X.fill();
  X.restore();
}
function flagAt(x, y, T) {                           // a little red warning flag stuck by a hole you already fell into
  X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(x, y); X.lineTo(x, y - 30); X.stroke(); X.strokeStyle = '#e9e2d0'; X.lineWidth = 2; X.stroke();
  const w = Math.sin(T * 6 + x) * 2; X.beginPath(); X.moveTo(x + 1, y - 30); X.lineTo(x + 18, y - 25 + w); X.lineTo(x + 1, y - 19); X.closePath(); ink('#ff4d5e', 2.5);
}
function fish(x, y, k, T) {                          // a curious fish pokes its head out of a hole
  if (k <= 0) return; X.save(); X.translate(x, y); X.beginPath(); X.rect(-30, -40, 60, 40); X.clip();
  X.translate(0, 26 - 30 * k); X.rotate(Math.sin(T * 5) * .1);
  el(0, 0, 11, 15); ink('#ff9f43', 3); X.fillStyle = '#ffd08a'; el(0, 5, 6, 8); X.fill();
  el(-4, -5, 3.6, 4); ink('#fff', 1.5); el(4, -5, 3.6, 4); ink('#fff', 1.5); X.fillStyle = INK; el(-3.4, -4.4, 1.6, 2); X.fill(); el(4.6, -4.4, 1.6, 2); X.fill();
  X.beginPath(); X.arc(0, 2, 2.6, 0, TAU); X.fillStyle = INK; X.fill();
  X.restore();
}
function footprint(x, y, a, col) {
  X.globalAlpha = a; X.fillStyle = col; for (const [dx, dy, rot] of [[-7, 4, -.2], [7, -6, .2]]) { el(x + dx, y + dy, 4.5, 6.5, rot); X.fill(); el(x + dx, y + dy - 9, 3, 2.4, rot); X.fill(); } X.globalAlpha = 1;
}

/* ───────────── the static scene, painted once into an offscreen canvas ───────────── */
let BG = null;
function pine(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s);
  rr(-4, -6, 8, 14, 2); ink('#6d4c2f', 2.5);
  for (const [w, h, yy] of [[26, 22, -6], [21, 20, -20], [15, 18, -33]]) { X.beginPath(); X.moveTo(-w, yy); X.lineTo(0, yy - h - 6); X.lineTo(w, yy); X.closePath(); ink('#2c6b5a', 3); }
  X.fillStyle = SNOW; for (const [w, yy] of [[26, -6], [21, -20], [15, -33]]) { X.beginPath(); X.moveTo(-w * .55, yy - 8); X.lineTo(0, yy - 22); X.lineTo(w * .55, yy - 8); X.quadraticCurveTo(0, yy - 13, -w * .55, yy - 8); X.fill(); }
  X.restore();
}
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 330); g.addColorStop(0, '#11163a'); g.addColorStop(.6, '#262f6e'); g.addColorStop(1, '#39468f'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  // moon + stars
  X.fillStyle = 'rgba(255,250,210,.12)'; X.beginPath(); X.arc(540, 70, 40, 0, TAU); X.fill();
  X.beginPath(); X.arc(540, 70, 23, 0, TAU); ink('#fff6c8', 3.5); X.fillStyle = '#e9dfa6'; el(533, 64, 5, 4); X.fill(); el(548, 77, 3.5, 3); X.fill(); el(545, 60, 2.5, 2); X.fill();
  let s = 3; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) { const x = r() * W, y = 60 + r() * 120; X.fillStyle = `rgba(255,255,255,${.3 + r() * .5})`; X.fillRect(x, y, 2, 2); }
  // far hills, far shore with pines and a cabin
  X.fillStyle = '#4a5aa6'; X.beginPath(); X.moveTo(0, 170); for (let x = 0; x <= W; x += 20) X.lineTo(x, 128 - Math.sin(x * .012 + 2) * 18 - Math.sin(x * .031) * 6); X.lineTo(W, 200); X.lineTo(0, 200); X.fill();
  X.fillStyle = SNOW2; X.beginPath(); X.moveTo(200, 240); X.quadraticCurveTo(250, 96 + 6, 300, 96 - Math.sin(6 + 1) * 5); for (let x = 300; x <= W; x += 20) X.lineTo(x, 96 - Math.sin(x * .02 + 1) * 5); X.lineTo(W, 240); X.closePath(); X.fill();
  X.fillStyle = SNOW; X.beginPath(); X.moveTo(200, 240); X.quadraticCurveTo(250, 102 + 6, 300, 102 - Math.sin(6 + 1) * 5); for (let x = 300; x <= W; x += 20) X.lineTo(x, 102 - Math.sin(x * .02 + 1) * 5); X.lineTo(W, 240); X.closePath(); X.fill();
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(200, 240); X.quadraticCurveTo(250, 108, 300, 102 - Math.sin(6 + 1) * 5); for (let x = 300; x <= W; x += 20) X.lineTo(x, 102 - Math.sin(x * .02 + 1) * 5); X.stroke();
  // the cabin (warm window) on the right, pines on both sides
  pine(418, 104, .9); pine(458, 100, .7); pine(760, 100, .85);
  rr(618, 64, 92, 44, 3); ink('#9a5b34', 4); X.fillStyle = '#7d4526'; for (let y = 72; y < 108; y += 9) X.fillRect(618, y, 92, 2.5);
  X.beginPath(); X.moveTo(608, 68); X.lineTo(664, 38); X.lineTo(720, 68); X.closePath(); ink('#6b3a2a', 4); X.fillStyle = SNOW; X.beginPath(); X.moveTo(612, 66); X.lineTo(664, 40); X.lineTo(716, 66); X.lineTo(700, 62); X.lineTo(664, 46); X.lineTo(628, 62); X.closePath(); X.fill();
  rr(690, 40, 12, 22, 2); ink('#8d5b4a', 3);
  rr(636, 76, 24, 20, 3); ink('#ffd36b', 3); X.fillStyle = INK; X.fillRect(647, 76, 2.5, 20); X.fillRect(636, 85, 24, 2.5);
  rr(672, 78, 22, 30, 3); ink('#5a3020', 3);
  // the near (left) shore: snow drifts
  X.fillStyle = SNOW2; X.beginPath(); X.moveTo(0, 220); X.bezierCurveTo(120, 190, 260, 214, 400, 200); X.lineTo(400, 600); X.lineTo(0, 600); X.fill();
  g = X.createLinearGradient(0, 200, 0, 600); g.addColorStop(0, SNOW); g.addColorStop(1, '#d2def8'); X.fillStyle = g;
  X.beginPath(); X.moveTo(0, 232); X.bezierCurveTo(120, 204, 260, 226, 400, 212); X.lineTo(400, 600); X.lineTo(0, 600); X.fill();
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 232); X.bezierCurveTo(120, 204, 260, 226, 400, 212); X.stroke();
  X.fillStyle = 'rgba(140,160,215,.35)'; for (const [x, y, w] of [[40, 300, 50], [250, 360, 60], [190, 430, 40], [70, 250, 30]]) { el(x, y, w, 5); X.fill(); }
  X.fillStyle = SNOW; X.beginPath(); X.moveTo(380, 600); X.lineTo(380, 520); for (let x = 380; x <= W; x += 20) X.lineTo(x, 522 + Math.sin(x * .05) * 4); X.lineTo(W, 600); X.closePath(); X.fill();
  // the lake: an icy rim, then 25 slabs
  const [lx, ly, lw, lh] = LK;
  rr(lx - 6, ly - 4, lw + 12, lh + 10, 44); ink('#cfe9fb', 5);
  g = X.createLinearGradient(0, ly, 0, ly + lh); g.addColorStop(0, '#5aa7d8'); g.addColorStop(1, '#3f86c0'); rr(lx, ly, lw, lh, 38); X.fillStyle = g; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  for (let r0 = 0; r0 < RW; r0++) for (let c = 0; c < C; c++) {
    const x = GX + c * CS, y = GY + r0 * CS;
    rr(x + 3, y + 4, CS - 6, CS - 6, 11); X.fillStyle = ICE2; X.fill();
    rr(x + 3, y + 2, CS - 6, CS - 8, 11); X.fillStyle = ICE; X.fill();
    X.fillStyle = ICEL; el(x + 20, y + 14, 11, 4, -.4); X.fill();
    X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 2; X.beginPath(); X.moveTo(x + 40 + (c * 9 + r0 * 5) % 14, y + 30); X.lineTo(x + 52, y + 42 + (r0 * 7) % 9); X.stroke();
  }
  // the tower (legs + ladder + platform); the guide stands on it
  X.lineCap = 'round';
  for (const [x0, x1] of [[48, 40], [136, 146]]) { X.strokeStyle = INK; X.lineWidth = 14; X.beginPath(); X.moveTo(x0, TWY + 8); X.lineTo(x1, 470); X.stroke(); X.strokeStyle = WOOD; X.lineWidth = 7; X.stroke(); }
  X.strokeStyle = INK; X.lineWidth = 8; X.beginPath(); X.moveTo(46, 380); X.lineTo(140, 420); X.moveTo(140, 380); X.lineTo(46, 420); X.stroke(); X.strokeStyle = WOOD2; X.lineWidth = 3.5; X.stroke();
  rr(30, TWY, 124, 14, 4); ink(WOOD, 4); X.fillStyle = WOODL; X.fillRect(34, TWY + 2, 116, 3);
  for (const x of [36, 148]) { rr(x - 4, TWY - 40, 8, 42, 3); ink(WOOD, 3); }
  rr(30, TWY - 44, 124, 9, 4); ink(WOOD, 3);
  X = old; return cv2;
}

/* ───────────── live bits ───────────── */
function sky(T) {
  for (let i = 0; i < 6; i++) { const x = (i * 131 + 40) % W, y = 66 + (i * 37) % 90, a = .5 + .5 * Math.sin(T * 3 + i * 2); star(x, y, 4 * a + 1, 1.2, 4, 0, '#fff', 0); }
  for (let i = 0; i < 3; i++) { const k = (T * .35 + i / 3) % 1; X.globalAlpha = .55 * Math.sin(k * Math.PI); el(696 + Math.sin(k * 5 + i) * 6 + k * 10, 34 - k * 30, 6 + k * 8, 5 + k * 6); X.fillStyle = '#c6cbe6'; X.fill(); } X.globalAlpha = 1;
}
function snowfall(T, gust) {
  X.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 26; i++) { const sp = 30 + (i % 5) * 9, x = ((i * 97 + T * (14 + gust * 260) + Math.sin(T + i) * 14) % (W + 40)) - 20, y = ((i * 61 + T * sp) % 560) + 40; X.beginPath(); X.arc(x, y, 1.5 + (i % 3), 0, TAU); X.fill(); }
}
function campfire(T, big) {
  const [x, y] = FIRE, s = 1 + big * .7;
  X.save(); X.translate(x, y);
  X.fillStyle = `rgba(255,170,60,${.16 + .05 * Math.sin(T * 9) + big * .2})`; el(0, -10, 46 * s, 26 * s); X.fill();
  for (const a of [-.35, .35]) { X.save(); X.rotate(a); rr(-18, -4, 36, 8, 4); ink('#7d4526', 2.5); X.restore(); }
  for (let i = 0; i < 3; i++) {
    const h = (22 + 6 * Math.sin(T * 13 + i * 2)) * s * (1 - i * .25), w = (11 - i * 2.5) * s;
    X.beginPath(); X.moveTo(-w, -2); X.quadraticCurveTo(-w, -h * .5, Math.sin(T * 9 + i) * 3, -h); X.quadraticCurveTo(w, -h * .5, w, -2); X.closePath();
    if (i === 0) ink('#ff6b2c', 2.5); else { X.fillStyle = i === 1 ? '#ffb43c' : '#fff1a0'; X.fill(); }
  }
  X.restore();
}
function megaphone(x, y, rot, s) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  rr(-10, -5, 12, 10, 3); ink('#ff4d5e', 3);
  X.beginPath(); X.moveTo(0, -6); X.lineTo(28, -16); X.lineTo(28, 16); X.lineTo(0, 6); X.closePath(); ink('#fff3f3', 3.5);
  X.fillStyle = '#ff4d5e'; X.fillRect(8, -9, 5, 18);
  el(28, 0, 5, 16); ink('#ffd2d6', 3);
  X.restore();
}
function shoutWaves(x, y, k) {                     // three arcs that fly out of the megaphone
  if (k <= 0 || k >= 1) return; X.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const q = k - i * .12; if (q <= 0) continue; X.globalAlpha = Math.max(0, 1 - q); X.strokeStyle = '#fff'; X.lineWidth = 4; X.beginPath(); X.arc(x, y, 10 + q * 36 + i * 4, -.95, .25); X.stroke(); }
  X.globalAlpha = 1;
}
function bubble(T, wob) {                          // the shout bubble, its tail points at the megaphone
  const [x, y, w, h] = BUB;
  X.save(); X.translate(x + w / 2, y + h / 2); X.rotate(wob * .03); X.scale(1 + wob * .04, 1 + wob * .04); X.translate(-x - w / 2, -y - h / 2);
  X.fillStyle = 'rgba(20,16,28,.25)'; rr(x + 4, y + 7, w, h, 26); X.fill();
  X.beginPath(); X.moveTo(x + 18, y + h - 22); X.lineTo(MEG[0] + 14, MEG[1] - 4); X.lineTo(x + 50, y + h - 6); X.closePath(); ink('#fff', 4);
  rr(x, y, w, h, 26); ink('#fff', 4);
  X.beginPath(); X.moveTo(x + 21, y + h - 26); X.lineTo(MEG[0] + 18, MEG[1] - 8); X.lineTo(x + 46, y + h - 8); X.closePath(); X.fillStyle = '#fff'; X.fill();
  X.restore();
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS7 = 11; const cr = () => (CS7 = CS7 * 16807 % 2147483647) / 2147483647;

/* ═════════ the game ═════════ */
function duGuide(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), walker = D.role === 0, TS = Math.sqrt(sp);
  /* the level: a wiggly safe route from the pier (column sc, row RW) up to row 0; every other slab is thin ice except a few
     "decoys" right next to the route in the same row (so a wrong sidestep is never a dead end: you can always step back).
     Retried until the route really wiggles and no column is safe straight across (walking blind straight up always sinks). */
  let sc = 2, safe = null, route = null;
  for (let tries = 0; tries < 300; tries++) {
    sc = Math.floor(R() * C); safe = Array.from({ length: RW }, () => Array(C).fill(false)); route = [];
    let c = sc, side = 0, turns = 0;
    for (let r = RW - 1; r >= 0; r--) {
      safe[r][c] = true; route.push([c, r]);
      let nc = c; const c0 = c;
      if (R() < .8) { const span = 1 + Math.floor(R() * 3), dir = R() < .5 ? -1 : 1; nc = clamp(c + dir * span, 0, C - 1); if (nc === c) nc = clamp(c - dir * span, 0, C - 1); }
      const st = nc > c ? 1 : -1; while (c !== nc) { c += st; safe[r][c] = true; route.push([c, r]); side++; }
      if (nc !== c0) turns++;
    }
    for (let r = 0; r < RW; r++) for (let c2 = 0; c2 < C; c2++) if (!safe[r][c2] && ((c2 > 0 && route.some(q => q[0] === c2 - 1 && q[1] === r)) || (c2 < C - 1 && route.some(q => q[0] === c2 + 1 && q[1] === r))) && R() < .2) safe[r][c2] = 'decoy';
    let colsBlocked = true, blob = false, n = 0; for (let c2 = 0; c2 < C; c2++) if (safe.every(row => row[c2])) colsBlocked = false;
    for (let r = 0; r < RW; r++) for (let c2 = 0; c2 < C; c2++) { if (safe[r][c2]) n++; if (r && c2 && safe[r][c2] && safe[r - 1][c2] && safe[r][c2 - 1] && safe[r - 1][c2 - 1]) blob = true; }
    if (side >= 4 && side <= 7 && turns >= 3 && colsBlocked && !blob && n <= 12) break;
  }
  const pit = safe.map(row => row.map(v => !v));
  const pits = []; for (let r = 0; r < RW; r++) for (let c = 0; c < C; c++) if (pit[r][c]) pits.push([c, r]);
  const sunnies = R() < .125;                        // a rare snowman in sunglasses (same on both screens)
  const STUN = 1.05 / Math.pow(TS, .5), HOP = .14;

  // the walker's own state (role 0) / what the guide last saw of it (role 1)
  let wc = sc, wr = RW, ep = 0, kDone = -1, lastStep = -9, stunUntil = -9;
  const pend = [];                                   // walker: shouts waiting to be walked, oldest first
  const sent = []; let nid = 0, lastShout = -9;      // guide: every shout it sent
  const fell = new Set(), visited = new Set([sc + ',' + RW]);
  let hopFrom = null, hopAt = -9, fallAt = -9, fallTile = null, bumpAt = -9, bumpD = 1, megAt = -9, resAt = -1, endX = 0, endY = 0, revealed = false;
  const pressAt = [-9, -9, -9], qShow = [], qGone = [], bits = [], pops = [];
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const wCol = () => walker ? myCol() : pCol(), gCol = () => walker ? pCol() : myCol();

  const tilePos = (c, r) => [r === RW ? tcx(sc) : tcx(c), r === -1 ? tcy(-1) + 4 : r === RW ? tcy(r) - 14 : tcy(r)];   // the pier stance stays clear of the bottom HUD
  function walkerPos(T) {                          // where to draw the walker now (its hop between slabs)
    const [x1, y1] = tilePos(wc, wr); if (!hopFrom) return [x1, y1, 0];
    const k = clamp((T - hopAt) / HOP, 0, 1); if (k >= 1) return [x1, y1, 0];
    return [lerp(hopFrom[0], x1, ease(k)), lerp(hopFrom[1], y1, ease(k)), Math.sin(k * Math.PI)];
  }
  const holeK = (c, r, T) => fallTile && fallTile[0] === c && fallTile[1] === r && T - fallAt < .2 ? ease((T - fallAt) / .2) : 1;   // a fresh hole cracks open
  function pop(s, size, bgc, fg, x, y) { pops.length = 0; pops.push({ s, size, bgc, fg, x, y, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, rot: 0, vr: 0, sh: 0 }, o)); }
  function splash(x, y, n) { for (let i = 0; i < n; i++) bit({ sh: 1, x: x + (cr() - .5) * 20, y, vx: (cr() - .5) * 260, vy: -(200 + cr() * 260), r: 3 + cr() * 4, c: i % 2 ? '#bfe9ff' : '#fff', life: .6 + cr() * .3 }); ring(x, y, '#bfe9ff', 60, .35); }
  function fallFx(c, r) {
    fallAt = g.c; fallTile = [c, r]; fell.add(c + ',' + r);
    noise(.12, .09, 3000, 5000, 'highpass'); snd(1400, .05, 'square', .04, 0, 600);
    noise(.4, .1, 1600, 200, 'lowpass', .14); sfx.splat(); snd(300, .35, 'sine', .08, .16, 70); shake(5, .2);
    pop('SPLOOSH!', 32, '#2a86c2', '#fff', 575, 92);
  }
  function stepFx(d) { noise(.06, .06, 2400, 3600, 'bandpass'); snd([392, 523, 440][d], .06, 'triangle', .05); }
  function shoutFx(d) { megAt = g.c; noise(.07, .035, 1800, 2600, 'bandpass'); snd([330, 494, 392][d], .12, 'square', .045, .03); snd([330, 494, 392][d] * 1.5, .1, 'triangle', .03, .07); }

  const g = {
    c: 0, dur: 16, pts: 0,
    cmd: walker ? 'WALK!' : 'GUIDE!', roleLabel: walker ? 'WALKER' : 'GUIDE',
    hint: walker ? 'IT\'S DARK! STEP WHERE YOUR FRIEND SHOUTS (ARROW KEYS) - REACH THE FAR SHORE' : 'YOU SEE THE THIN ICE - SHOUT THE WAY WITH THE ARROWS (ARROW KEYS)',
    thint: walker ? 'IT\'S DARK! TAP THE GLOWING ARROW YOUR FRIEND SHOUTS - REACH THE FAR SHORE' : 'YOU SEE THE THIN ICE - TAP THE ARROWS TO SHOUT THE WAY',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) {
        resAt = T; const p = walkerPos(T); endX = p[0]; endY = p[1];
        if (g.result === 'win') { pop('MADE IT!', 36, '#22a447', '#fff', 575, 300); snd(523, .1, 'square', .05); snd(659, .1, 'square', .05, .08); snd(784, .1, 'square', .05, .16); snd(1047, .3, 'triangle', .06, .24); }
        else { pop('FROZEN!', 36, '#2a86c2', '#fff', 575, 300); noise(.9, .07, 500, 1800, 'bandpass'); snd(140, .5, 'square', .03, .1, 120); }
        for (let i = 0; i < 4; i++) noise(.08, .05, 2600, 4200, 'highpass', .2 + i * .09);
      }
      if (resAt >= 0 && !revealed && T - resAt > .55) { revealed = true; if (g.result === 'win') pop('PHEW!', 34, '#ff9f1c', '#FFE14D', 575, 300); }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && T - pops[0].t0 > 1.1) pops.length = 0;
      for (let i = qGone.length - 1; i >= 0; i--) if (T - qGone[i].g0 > .3) qGone.splice(i, 1);
      // the shout queue in the bubble: the walker's pending shouts, or (guide) what it sent that the walker has not walked yet
      const list = walker ? pend : sent.filter(s => s.ep === ep && s.id > kDone);
      for (let i = qShow.length - 1; i >= 0; i--) { const q = qShow[i]; if (!list.some(s => s.id === q.id)) { qGone.push({ d: q.d, x: q.x, y: q.y, s: q.s, g0: T, ok: q.ok !== undefined ? q.ok : (!walker && q.ep === ep) }); qShow.splice(i, 1); } }
      list.forEach((s, i) => {
        let q = qShow.find(o => o.id === s.id); if (!q) { q = { id: s.id, d: s.d, ep: s.ep, t0: T, x: BUB[0] + BUB[2] + 30, y: 0, s: .4 }; qShow.push(q); }
        q.ok = s.ok; const tx = i === 0 ? BUB[0] + 62 : BUB[0] + 108 + i * 38, ts = i === 0 ? 1 : i < 3 ? .58 : 0;
        q.x += (tx - q.x) * Math.min(1, dt * 16); q.s += (ts - q.s) * Math.min(1, dt * 16);
      });
      qShow.sort((a, b) => a.id - b.id);
      if (walker && !g.result && T >= g.limit) g.finish('lose');
    },
    msg(type, d) {
      if (type === 'sig' && walker) {
        if (g.result || d.ep !== ep) return;          // shouted before the guide saw our last fall: ignore it
        pend.push({ id: d.id, d: d.d, ep: d.ep }); if (pend.length > 8) pend.shift(); shoutFx(d.d);
      } else if (type === 'st' && !walker) {
        if (d.k > kDone) kDone = d.k;
        if (d.ep > ep) ep = d.ep;
        if (d.f) { fallFx(d.c, d.r); hopFrom = null; wc = sc; wr = RW; }
        else { hopFrom = walkerPos(g.c); hopAt = g.c; wc = d.c; wr = d.r; stepFx(1); if (d.r >= 0) visited.add(d.c + ',' + d.r); }
      }
    },
    step(d) {
      if (!walker || g.result || g.c < .15 || g.c < stunUntil || g.c - lastStep < .1) return;
      pressAt[d] = g.c;
      const nc = wc + DX[d], nr = wr + DY[d];
      if ((wr === RW && d !== 1) || nc < 0 || nc >= C) { bumpAt = g.c; bumpD = d; snd(150, .08, 'square', .05, 0, 90); pop('BUMP!', 28, '#8a6fd6', '#fff', 575, 92); return; }
      lastStep = g.c;
      if (pend.length) { const q = pend.shift(); kDone = q.id; const v = qShow.find(o => o.id === q.id); if (v) v.ok = q.d === d; }
      hopFrom = walkerPos(g.c); hopAt = g.c;
      if (nr >= 0 && pit[nr][nc]) {
        ep++; for (const q of pend) { const v = qShow.find(o => o.id === q.id); if (v) v.ok = false; } pend.length = 0;
        D.send('st', { c: nc, r: nr, f: 1, ep, k: kDone });
        fallFx(nc, nr); hopFrom = null; wc = sc; wr = RW; stunUntil = g.c + STUN; return;
      }
      wc = nc; wr = nr; D.send('st', { c: wc, r: wr, f: 0, ep, k: kDone }); stepFx(d);
      if (wr >= 0) visited.add(wc + ',' + wr);
      if (wr < 0) g.finish('win');
    },
    shout(d) {
      if (walker || g.result || g.c < .2 || g.c - lastShout < .09) return;
      lastShout = g.c; pressAt[d] = g.c; const id = nid++;
      sent.push({ id, d, ep }); D.send('sig', { d, id, ep }); shoutFx(d);
    },
    act(d) { walker ? g.step(d) : g.shout(d); },
    draw() {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); X = ctx;
      X.drawImage(BG, 0, 0);
      sky(T);
      campfire(T, won ? ease(rk / .3) : 0);
      snowman(T, walkerPos(T), won ? ease((rk - .3) / .8) : 0);   // background gag: warming up by the fire, watching the walker, melting a bit when it flares
      // the pier
      const px = tcx(sc);
      for (const ox of [-22, 22]) { rr(px + ox - 4, GY + RW * CS - 8, 8, 58, 3); ink(WOOD2, 3); }
      rr(px - 30, GY + RW * CS - 14, 60, 44, 6); ink(WOOD, 4); X.fillStyle = WOOD2; for (let i = 1; i < 4; i++) X.fillRect(px - 30, GY + RW * CS - 14 + i * 11, 60, 2.5);
      X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(px - 26, GY + RW * CS - 11, 52, 3);
      // what each screen knows about the ice
      const reveal = rk >= 0 ? rk : -1;
      for (const [c, r] of pits) {
        const key = c + ',' + r, k0 = Math.hypot(tcx(c) - endX, tcy(r) - endY) / 900;
        let k = 0;
        if (!walker || fell.has(key)) k = 1;
        else if (reveal >= 0) k = outBack((reveal - .15 - k0) / .2);
        hole(c, r, Math.min(k, holeK(c, r, T)), T);
      }
      // a fish pokes out of a random hole now and then (whoever can see the holes)
      { const per = 2.9, n = Math.floor(T / per), k = (T % per) / per, h = pits[(n * 7 + 3) % pits.length];
        if (h && (!walker || fell.has(h.join()) || rk > .5)) fish(tcx(h[0]) + 2, tcy(h[1]) + 4, k < .15 ? k / .15 : k < .4 ? 1 : k < .55 ? 1 - (k - .4) / .15 : 0, T); }
      // footprints (walker: where it already walked) / the planned steps (guide: where the shouts in flight will take it)
      if (walker) { for (const v of visited) { const [c, r] = v.split(',').map(Number); if (r >= 0 && r < RW && !(c === wc && r === wr)) footprint(tcx(c), tcy(r) + 4, .5, '#e6f6ff'); } }
      else if (!g.result) {
        let c = wc, r = wr; const list = sent.filter(s => s.ep === ep && s.id > kDone);
        list.forEach((s, i) => {
          if (r === RW && s.d !== 1) return; const nc = c + DX[s.d], nr = r + DY[s.d]; if (nc < 0 || nc >= C) return;
          const [x0, y0] = tilePos(c, r), [x1, y1] = tilePos(nc, nr), bad = nr >= 0 && nr < RW && pit[nr][nc];
          X.globalAlpha = .9 - i * .12; X.setLineDash([6, 8]); X.lineDashOffset = -T * 30; X.strokeStyle = bad ? '#ff4d5e' : '#fff'; X.lineWidth = 4; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.stroke(); X.setLineDash([]);
          X.setLineDash([7, 6]); X.lineDashOffset = -T * 20; X.beginPath(); X.arc(x1, y1, 24, 0, TAU); X.lineWidth = 4; X.strokeStyle = bad ? '#ff4d5e' : gCol(); X.stroke(); X.setLineDash([]);
          arrow((x0 + x1) / 2, (y0 + y1) / 2, .48, ROT[s.d], bad ? '#ff4d5e' : gCol(), 3); X.globalAlpha = 1;
          c = nc; r = nr;
        });
      }
      // darkness on the walker's screen: only a little lantern glow around it (it lifts at the end to show how close that was)
      const [wx, wy, hop] = walkerPos(T);
      let dk = walker ? 1 - (rk >= 0 ? ease((rk - .1) / .5) * (won ? 1 : .85) : 0) : 0;
      if (dk > 0) {
        const [lx, ly, lw, lh] = LK, fx = fallTile && T - fallAt < STUN ? null : [wx, wy];
        X.save(); rr(lx - 8, ly - 6, lw + 16, lh + 14, 46); X.clip();
        const gr = X.createRadialGradient(fx ? fx[0] : tcx(sc), fx ? fx[1] - 10 : tcy(RW), 24, fx ? fx[0] : tcx(sc), fx ? fx[1] - 10 : tcy(RW), 92);
        gr.addColorStop(0, 'rgba(8,10,34,0)'); gr.addColorStop(1, `rgba(8,10,34,${.86 * dk})`); X.fillStyle = gr; X.fillRect(lx - 10, ly - 10, lw + 20, lh + 20);
        X.restore();
        // the slabs still show as faint outlines, so you know where you are
        X.strokeStyle = `rgba(190,225,255,${.22 * dk})`; X.lineWidth = 2;
        for (let r = 0; r < RW; r++) for (let c = 0; c < C; c++) { rr(GX + c * CS + 3, GY + r * CS + 2, CS - 6, CS - 8, 11); X.stroke(); }
        for (const key of fell) { const [c, r] = key.split(',').map(Number); hole(c, r, holeK(c, r, T), T); flagAt(tcx(c) + 24, tcy(r) + 22, T); }
        for (const v of visited) { const [c, r] = v.split(',').map(Number); if (r >= 0 && r < RW && !(c === wc && r === wr)) footprint(tcx(c), tcy(r) + 4, .35 * dk, '#9fdcff'); }
      }
      // the walker: hops, sinks, comes back as an ice cube, freezes, cheers
      const U = 3.1, falling = fallTile && T - fallAt < STUN;
      if (falling) drawFall((T - fallAt) / STUN, T, U);
      else {
        const shiver = T - fallAt < STUN + .7 ? Math.sin(T * 60) * 2 * (1 - (T - fallAt - STUN) / .7) : 0;
        const bx = T - bumpAt < .25 ? Math.sin((T - bumpAt) / .25 * Math.PI) * 6 * (DX[bumpD] || (bumpD ? 1 : -1)) : 0;
        const jump = won ? Math.abs(Math.sin(rk * 9)) * 14 : 0;
        const fx = lost ? endX : wx, fy = lost ? Math.min(endY, tcy(RW) - 14 - 12 * ease(rk / .3)) : wy;   // frozen on the pier: lifted clear of the bottom HUD
        const chat = lost ? Math.sin(T * 70) * 2.5 * (1 - ease((rk - .3) / .5)) : 0, big = lost ? 1 + .35 * outBack(rk / .35) : 1;
        X.save(); X.translate(fx + shiver + bx + chat, fy + 22 - hop * 16 - jump); X.scale(big, big);
        shadow(0, 2 + hop * 16 + jump, 24, 5, .3);
        if (won) { const w = Math.sin(T * 14) * .3; arms(U, -.45 + w, .45 - w, ease(rk / .2), wCol()); }
        caos(0, 0, U, { col: wCol(), mood: won ? 'happy' : lost ? 'sad' : null });
        beanie(U, '#ff4d6d');
        if (lost) { iceBlock(U, outBack(rk / .3)); icicles(U, ease((rk - .25) / .3)); }
        X.restore();
        // the NEXT shout as a little arrow by the walker (its own screen), so the eyes never have to leave the ice
        if (walker && !g.result && pend.length && T >= stunUntil) {
          const d = pend[0].d, b = Math.abs(Math.sin(T * 7)) * 6;
          arrow(wx + DX[d] * (34 + b), wy + 4 + DY[d] * (40 + b), .52, ROT[d], '#ffd23f', 3);
        }
        if (T < 2.6 && !g.result) { X.globalAlpha = clamp((2.6 - T) / .4, 0, 1); pill(wx, wy - 50, walker ? 'YOU' : 'YOUR FRIEND', wCol(), false); X.globalAlpha = 1; }
      }
      // the guide on its tower with the megaphone (cheers / shrugs at the end)
      const mk = (T - megAt) / .45;
      X.save(); X.translate(TWX, TWY - (mk >= 0 && mk < 1 ? Math.sin(mk * Math.PI) * 6 : 0) - (won ? Math.abs(Math.sin(T * 9)) * 12 : 0));
      if (won) { const w = Math.sin(T * 14) * .3; arms(4.4, -.45 + w, .45 - w, ease(rk / .2), gCol()); }
      else if (lost) arms(4.4, -.85, .85, ease(rk / .3), gCol());
      caos(0, 0, 4.4, { col: gCol(), mood: won ? 'happy' : lost ? 'sad' : null });
      beanie(4.4, '#4DB8FF');
      if (!g.result) megaphone(30, -26, -.42 + (mk >= 0 && mk < 1 ? -Math.sin(mk * Math.PI) * .12 : 0), 1);
      X.restore();
      if (!g.result) shoutWaves(MEG[0] + 6, MEG[1] - 36, mk);
      pill(TWX, TWY + 40, walker ? 'YOUR FRIEND' : 'YOU', gCol(), true);
      // the shout bubble with the queue: NEXT (big) then the ones after it
      bubble(T, mk >= 0 && mk < .3 ? Math.sin(mk / .3 * Math.PI) : 0);
      X.save(); rr(BUB[0] + 4, BUB[1] + 4, BUB[2] - 8, BUB[3] - 8, 22); X.clip();
      const cy = BUB[1] + BUB[3] / 2;
      for (const q of qGone) { const a = Math.min(1, (T - q.g0) / .3); if (a >= 1) continue; X.globalAlpha = 1 - a; arrow(q.x, cy + 6, q.s * 1.15 * (1 - a * .7), ROT[q.d], q.ok ? '#5CFF7A' : '#c9c6d8', 4); X.globalAlpha = 1; if (q.ok) check(q.x + 30, cy - 24 - a * 10, outBack(a / .4)); }
      qShow.forEach((q, i) => {
        if (q.s < .05) return; const pk = outBack((T - q.t0) / .22), first = i === 0;
        if (first) { X.beginPath(); X.arc(q.x, cy + 4, 38 * pk, 0, TAU); ink(walker ? '#ffd23f' : gCol(), 4); }
        arrow(q.x, cy + 6, q.s * 1.15 * pk * (first ? 1 + .05 * Math.sin(T * 10) : 1), ROT[q.d], first ? '#fff' : walker ? '#ffd23f' : gCol(), 4);
      });
      if (qShow.length > 3) txt('+' + (qShow.length - 3), BUB[0] + BUB[2] - 20, cy + 34, 18, INK);
      if (!qShow.length && !qGone.length && !g.result) {
        if (walker) for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(BUB[0] + BUB[2] / 2 - 30 + i * 30, cy - Math.abs(Math.sin(T * 5 - i * .6)) * 8, 8, 0, TAU); X.fillStyle = '#9a95b5'; X.fill(); }
        else txt('SHOUT THE WAY!', BUB[0] + BUB[2] / 2, cy, 22, INK, 'center', BUB[2] - 30);
      } else if (g.result && !qShow.length) txt(won ? 'YAAAY!' : 'BRRR...', BUB[0] + BUB[2] / 2, cy, 30, INK, 'center', BUB[2] - 30);
      X.restore();
      if (qShow.length) txt('NEXT', BUB[0] + 62, BUB[1] + 17, 14, INK, 'center', 84);
      // feedback words and particles
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 8, q.size, q.bgc, q.fg, a < .25 ? outBack(a / .25) : 1, q.rot); X.globalAlpha = 1; }
      for (const b of bits) { const a = (T - b.t0) / b.life; X.globalAlpha = clamp(1 - a, 0, 1); if (b.sh === 2) { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); X.beginPath(); X.moveTo(0, -b.r); X.lineTo(b.r, b.r * .7); X.lineTo(-b.r, b.r * .5); X.closePath(); ink('#dff6ff', 2); X.restore(); } else { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2); } } X.globalAlpha = 1;
      if (lost) snowfall(T, ease(rk / .4)); else snowfall(T, 0);
      // my three buttons (flat and grey once the round is over)
      const done = !!g.result, nextD = walker && pend.length && T >= stunUntil ? pend[0].d : -1, stun = walker && T < stunUntil;
      if (done || stun) X.globalAlpha = .8;
      BTN.forEach((b, d) => {
        const lit = d === nextD, pal = done || stun ? ['#d3cfe0', '#8f88a6'] : lit ? PLATE_LIT : walker ? PLATE_W : PLATE_G;
        const o = plate(b, pal[0], pal[1], done || T - pressAt[d] < .12, lit && !done);
        const cx = b[0] + b[2] / 2;
        if (TOUCH) arrow(cx, b[1] + b[3] / 2 + o, 1.05, ROT[d], done || stun ? '#f6f4fb' : '#fff', 4);
        else { arrow(cx, b[1] + 36 + o, .82, ROT[d], done || stun ? '#f6f4fb' : '#fff', 4); keyCap(cx, b[1] + 70 + o, d); }
      });
      X.globalAlpha = 1;
      vignette(.18);
    },
    down(pt) {
      if (pt.y < BTN[0][1] - 30 || pt.x > 372) return;
      g.act(pt.x < (BTN[0][0] + BTN[0][2] + BTN[1][0]) / 2 ? 0 : pt.x < (BTN[1][0] + BTN[1][2] + BTN[2][0]) / 2 ? 1 : 2);
    },
    key(e) {
      if (e.repeat || e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      const d = { ArrowLeft: 0, KeyA: 0, ArrowUp: 1, KeyW: 1, Space: 1, ArrowRight: 2, KeyD: 2 }[e.code];
      if (d !== undefined) g.act(d);
    },
  };
  /* the walker's fall: sinks in the hole, a water spout, shoots out as an ice cube in an arc back to the pier, lands, shatters */
  function drawFall(k, T, U) {
    const [hx, hy] = [tcx(fallTile[0]), tcy(fallTile[1])], [px, py] = tilePos(sc, RW);
    if (k < .2) {
      const s = k / .2; X.save(); X.beginPath(); X.rect(hx - 40, hy - 80, 80, 80 + 6); X.clip();
      X.translate(hx + Math.sin(T * 50) * 2, hy + 22 + s * 40); caos(0, 0, U, { col: wCol(), mood: 'sad' }); beanie(U, '#ff4d6d'); X.restore();
      if (!fallTile.sp) { fallTile.sp = 1; splash(hx, hy, 10); }
    } else if (k < .32) {
      const s = (k - .2) / .12, h = Math.sin(s * Math.PI) * 50;
      X.beginPath(); X.moveTo(hx - 12, hy); X.quadraticCurveTo(hx - 6, hy - h, hx, hy - h - 8); X.quadraticCurveTo(hx + 6, hy - h, hx + 12, hy); X.closePath(); ink('#bfe9ff', 3);
    } else if (k < .88) {
      const s = (k - .32) / .56, x = lerp(hx, px, s), y = lerp(hy, py, s) - Math.sin(s * Math.PI) * 130 + 22;
      X.save(); X.translate(x, y); X.rotate(s * TAU); X.translate(0, 10); caos(0, 0, U, { col: wCol(), mood: 'sad' }); beanie(U, '#ff4d6d'); iceBlock(U, 1); X.restore();
      if (!fallTile.wh) { fallTile.wh = 1; sfx.boing(); }
    } else {
      const s = (k - .88) / .12; X.save(); X.translate(px, py + 22); X.scale(1 + .18 * (1 - s), 1 - .18 * (1 - s)); caos(0, 0, U, { col: wCol(), mood: 'sad' }); beanie(U, '#ff4d6d'); X.restore();
      if (!fallTile.ld) { fallTile.ld = 1; sfx.thud(); for (let i = 0; i < 8; i++) bit({ sh: 2, x: px + (cr() - .5) * 30, y: py, vx: (cr() - .5) * 300, vy: -(150 + cr() * 200), r: 5 + cr() * 4, vr: (cr() - .5) * 12, life: .5 }); pop('BRRR!', 30, '#5ec8ff', '#fff', 575, 92); }
    }
  }
  function snowman(T, [wx, wy], melt) {
    X.save(); X.translate(SNX, SNY); X.scale(.78, .78 * (1 - melt * .25));
    X.beginPath(); X.arc(0, 0, 22, 0, TAU); ink(SNOW, 3.5); X.beginPath(); X.arc(0, -32, 15, 0, TAU); ink(SNOW, 3.5);
    X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; const wv = Math.sin(T * 4) * 3;   // stick arms held out to the fire
    X.beginPath(); X.moveTo(-14, -6); X.lineTo(-34, -12 + wv); X.moveTo(-34, -12 + wv); X.lineTo(-40, -18 + wv); X.moveTo(14, -6); X.lineTo(32, -18); X.stroke();
    rr(-12, -52, 24, 6, 2); ink(INK, 0); rr(-8, -68, 16, 18, 2); ink(INK, 0); X.fillStyle = '#ff4d5e'; X.fillRect(-8, -56, 16, 4);
    const a = Math.atan2(wy - (SNY - 30), wx - SNX), ex = Math.cos(a) * 2.2, ey = Math.sin(a) * 2;
    if (sunnies) { X.fillStyle = INK; rr(-11, -40, 10, 7, 3); X.fill(); rr(1, -40, 10, 7, 3); X.fill(); X.fillRect(-2, -38, 4, 2); }
    else for (const sx of [-5, 5]) { X.fillStyle = '#fff'; el(sx, -36, 4, 4.5); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.5; X.stroke(); X.fillStyle = INK; el(sx + ex, -36 + ey, 2, 2.4); X.fill(); }
    X.beginPath(); X.moveTo(0, -31); X.lineTo(wx > SNX ? 12 : -12, -29); X.lineTo(0, -27); X.closePath(); ink('#ff8a3a', 1.5);
    X.fillStyle = INK; for (const yy of [-10, 0, 10]) { X.beginPath(); X.arc(0, yy, 2.2, 0, TAU); X.fill(); }
    const dq = (T * 1.3) % 1; X.globalAlpha = 1 - dq; el(-14, -44 + dq * 22, 3, 4.5); ink('#9fe3ff', 1.5); X.globalAlpha = 1;   // sweat drop
    X.restore();
    if (melt > 0) { X.fillStyle = 'rgba(159,227,255,.8)'; el(SNX, SNY + 16, 20 + melt * 16, 4 + melt * 2); X.fill(); }
  }
  g.dbg = {
    N: () => pend.length,
    next: () => (walker && pend.length && g.c >= stunUntil ? pend[0].d : null),     // the walker sees the NEXT shout (and its glowing button)
    pit, sc, C, RW,                                                                   // the guide sees the whole lake
    seen: () => ({ c: wc, r: wr, ep }),                                               // the guide: where the walker was, as last heard
    pend: () => sent.filter(s => s.ep === ep && s.id > kDone).map(s => s.d),          // the guide: shouts not walked yet (its own bubble)
  };
  wire(g, D, 0, sp, 'du_guide');
  return g;
}
reg('du_guide', duGuide, 'DARK STEPS'); REGMAP.du_guide.duo = true;

/* ───────────── intro card: what each role does (520×240 frame): shout ▲ ► ▲ ▲ and the walker follows ───────────── */
const DCS = 54, DGX = 300, DGY = 26, DC = 3, DR = 3;
const DPITS = [[0, 1], [2, 2], [0, 0], [2, 0], [2, 1]];
const DSTEP = [1, 2, 1, 1], DSC = 0;
let DBG = null;
function buildDemoBg() {
  const c2 = document.createElement('canvas'); c2.width = 520; c2.height = 240; const old = X; X = c2.getContext('2d');
  const gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#141a42'); gr.addColorStop(1, '#2d3577'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = SNOW; X.beginPath(); X.moveTo(0, 130); X.bezierCurveTo(100, 110, 200, 130, 290, 120); X.lineTo(290, 240); X.lineTo(0, 240); X.fill();
  rr(DGX - 10, DGY - 16, DC * DCS + 20, DR * DCS + 32, 22); ink('#4a8fc8', 3);
  for (let r = 0; r < DR; r++) for (let c = 0; c < DC; c++) { const x = DGX + c * DCS, y = DGY + r * DCS; rr(x + 2, y + 2, DCS - 4, DCS - 6, 8); X.fillStyle = ICE; X.fill(); X.fillStyle = ICEL; el(x + 15, y + 11, 8, 3, -.4); X.fill(); }
  X.fillStyle = SNOW; X.fillRect(DGX - 14, 0, DC * DCS + 28, DGY - 16); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(DGX - 14, DGY - 16); X.lineTo(DGX + DC * DCS + 14, DGY - 16); X.stroke();
  X = old; return c2;
}
function demo(role, t) {
  X = ctx; if (!DBG) DBG = buildDemoBg(); X.drawImage(DBG, 0, 0);
  const u = t % 4.6, walker = role === 0;
  const shoutT = i => .3 + i * .85, stepT = i => shoutT(i) + .42;
  const pos = [[DSC, DR]]; for (const d of DSTEP) { const [c, r] = pos[pos.length - 1]; pos.push([c + DX[d], r + DY[d]]); }
  let n = 0; for (let i = 0; i < DSTEP.length; i++) if (u >= stepT(i)) n = i + 1;
  const dx = (c, r) => DGX + c * DCS + DCS / 2, dy = r => r < 0 ? DGY - 20 : r >= DR ? DGY + DR * DCS + 16 : DGY + r * DCS + DCS / 2;
  // pier
  rr(dx(DSC) - 20, DGY + DR * DCS - 4, 40, 40, 5); ink(WOOD, 3);
  // holes: the guide sees them; for the walker the ice is dark
  if (!walker) for (const [c, r] of DPITS) { X.save(); X.translate(dx(c), dy(r)); X.scale(.72, .72); X.translate(-tcx(c), -tcy(r)); hole(c, r, 1, t); X.restore(); }
  const dark = walker ? 1 : 0;
  // the walker hops along
  const [c0, r0] = pos[n], prev = pos[Math.max(0, n - 1)], hk = n ? clamp((u - stepT(n - 1)) / .14, 0, 1) : 1;
  const x = lerp(dx(prev[0]), dx(c0), ease(hk)), y = lerp(dy(prev[1]), dy(r0), ease(hk)) - Math.sin(hk * Math.PI) * 10, end = n === DSTEP.length;
  if (dark) { X.save(); X.beginPath(); X.rect(DGX - 12, DGY - 10, DC * DCS + 24, DR * DCS + 4); X.clip(); const gr = X.createRadialGradient(x, y, 16, x, y, 64); gr.addColorStop(0, 'rgba(8,10,34,0)'); gr.addColorStop(1, 'rgba(8,10,34,.82)'); X.fillStyle = gr; X.fillRect(DGX - 12, DGY - 10, DC * DCS + 24, DR * DCS + 4); X.restore(); }
  X.save(); X.translate(x, y + 16 - (end ? Math.abs(Math.sin(t * 9)) * 8 : 0)); caos(0, 0, 2.3, { col: walker ? '#FFC93C' : '#6EA8FE', mood: end ? 'happy' : null }); beanie(2.3, '#ff4d6d'); X.restore();
  // the friend with the megaphone, and its shout bubble
  const sh = DSTEP.some((d, i) => u >= shoutT(i) && u < shoutT(i) + .3);
  X.save(); X.translate(40, 104 - (sh ? 4 : 0)); caos(0, 0, 2.6, { col: walker ? '#6EA8FE' : '#FFC93C', mood: end ? 'happy' : null }); beanie(2.6, '#4DB8FF'); megaphone(18, -15, -.42, .62); X.restore();
  // the bubble: the shouts not walked yet
  X.beginPath(); X.moveTo(84, 92); X.lineTo(62, 96); X.lineTo(84, 74); X.closePath(); ink('#fff', 3); rr(76, 16, 194, 100, 22); ink('#fff', 3); X.fillStyle = '#fff'; X.beginPath(); X.moveTo(88, 90); X.lineTo(66, 94); X.lineTo(88, 76); X.closePath(); X.fill();
  const q = []; for (let i = 0; i < DSTEP.length; i++) if (u >= shoutT(i) && u < stepT(i)) q.push(i);
  q.forEach((i, j) => { const k = outBack((u - shoutT(i)) / .2); if (!j) { X.beginPath(); X.arc(126, 66, 36 * k, 0, TAU); ink(walker ? '#ffd23f' : '#FFC93C', 3); } arrow(j ? 170 + j * 32 : 126, 68, (j ? .55 : 1.05) * k, ROT[DSTEP[i]], j ? '#ffd23f' : '#fff', 3); });
  if (!q.length) { if (end) badge('MADE IT!', 173, 66, 22, '#22a447', '#fff', 1, -.04); else for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(145 + i * 28, 66 - Math.abs(Math.sin(t * 5 - i * .6)) * 6, 7, 0, TAU); X.fillStyle = '#9a95b5'; X.fill(); } }
  // three mini plates; the finger taps the one being pressed
  const tapI = DSTEP.findIndex((d, i) => { const tt = walker ? stepT(i) : shoutT(i); return u > tt - .12 && u < tt + .14; });
  const lit = walker && q.length ? DSTEP[q[0]] : -1;
  for (let d = 0; d < 3; d++) {
    const bx = 22 + d * 74, by = 150, down = tapI >= 0 && DSTEP[tapI] === d, pal = d === lit ? PLATE_LIT : walker ? PLATE_W : PLATE_G, o = down ? 2 : 6;
    rr(bx, by + 6, 64, 58, 14); ink(pal[1], 3); rr(bx, by + 6 - o, 64, 58, 14); ink(pal[0], 3);
    arrow(bx + 32, by + 33 - o + 6, .62, ROT[d], '#fff', 3);
  }
  if (tapI >= 0) { const tt = walker ? stepT(tapI) : shoutT(tapI); demoFinger(54 + DSTEP[tapI] * 74, 212, true, clamp((u - tt + .12) / .26, 0, 1)); }
  else demoFinger(54 + (lit >= 0 ? lit : 1) * 74, 216, false);
}
DUO.INFO.du_guide = [['WALKER', 'CROSS THE ICE IN THE DARK', 'TAP THE GLOWING ARROW'], ['GUIDE', 'YOU SEE THE THIN ICE', 'TAP ARROWS TO SHOUT THE WAY']];
DUO.DEMOS.du_guide = [t => demo(0, t), t => demo(1, t)];

})();
