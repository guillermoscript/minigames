'use strict';
/* ═════════ DUO · LIGHTHOUSE KEEPER (du_lighthouse), after Twisted!'s rotating lamp ═════════
   A stormy night. A tiny boat has to slip between the rocks into the harbour; the only light is the lighthouse beam.
   KEEPER (role 0, JUDGE): turns the lamp (drag the pointer round the lamp, or hold ◄ ► / A D; the lamp has weight and overshoots a little).
   The keeper sees the WHOLE sea from above: every rock as a dark blob, the boat as a dot with a tiny glow, and the beam lighting a cone.
   CAPTAIN (role 1): steers the boat sideways (pointer x / ◄ ► / drag); the boat sails forward at a constant speed.
   The captain is BLIND: only what the beam touches (and a tiny lantern round the bow) is visible. Rocks it has seen stay as a fading ghost
   for ~1 s. So the keeper must sweep AHEAD of the boat and hold the light where the captain needs to look, while the captain's steering
   shows the keeper where the boat is going. 3 hulls: every hit cracks one. Reach the harbour = win (the keeper dances, foghorn);
   3 cracks or running out of time = the boat sinks, a shark fin takes the captain's hat.
   Netcode: the KEEPER owns the lamp: 'th' beam angle (coalesced, ≤10/s, latest). The CAPTAIN owns the boat and the collisions:
   'b' [x, p] boat x + distance sailed (coalesced, ≤10/s, latest), 'hit' n (absolute hit count, so duplicates are harmless), 'arr' 1 when it
   enters the harbour. The keeper counts the hits, decides the verdict ('end', via wire). The rocks are the same on both screens
   (seeded), so only the boat's position travels; the boat's speed is constant, so the keeper's view extrapolates it between messages. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const LX = 604, LY = 112;                             // the lamp, top right: the beam fans DOWN over the sea toward the boat
const BY = 470;                                       // the boat's row on screen (rocks scroll down past it)
const LMIN = 168, LMAX = 758;                         // where the boat can go sideways
const TMIN = .62, TMAX = 2.95, TH0 = .72;             // lamp angle limits (atan2: 0 = right, π/2 = straight down, π = left) and its start
const HALF = .23, BEAM = 860, LANT = 32;               // beam half-angle, length, the captain's bow lantern radius
const V0 = 150, DIST = 1900, ARRIVE = DIST + 46;      // sailing speed (px/s), where the harbour quay is, where the boat counts as arrived
const GAPH = 118, RB = 15, GHOST = 1.05;              // half width of the harbour entrance, hull radius, seconds a seen rock stays as a ghost

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function pill(x, y, label, col) {                     // a name tag with a little pointer down
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  X.beginPath(); X.moveTo(x - 9, y + 13); X.lineTo(x, y + 24); X.lineTo(x + 9, y + 13); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {     // a word on a chunky coloured badge
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(260, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 260);
  X.restore();
}
function arm(u, sx, an, k, col) {                     // a thin blocky arm from claude()'s side stub (drawn before claude()); an = angle (0 = up), k = 0..1 raised
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
function heart(x, y, s, col, cracked) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-16, -2, -10, -14, 0, -6); X.bezierCurveTo(10, -14, 16, -2, 0, 8); X.closePath(); ink(col, 2.5);
  if (cracked) { line([[0, -6], [-3, -1], [2, 2], [-1, 7]], 2.4, INK); } else { X.fillStyle = 'rgba(255,255,255,.55)'; el(-5, -5, 2.6, 1.7, -.5); X.fill(); }
  X.restore();
}

/* ───────────── level helpers ───────────── */
function blobPath(x, y, r, L) {                       // a lumpy outline from lobe radii (≈1)
  const n = L.length, pts = L.map((l, i) => { const a = i / n * TAU; return [x + Math.cos(a) * r * l, y + Math.sin(a) * r * l * .92]; });
  X.beginPath(); X.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; X.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  X.closePath();
}
/* a lit rock: white foam round its feet, grey stone, a shaded far side, a bright cel highlight, cracks (and, now and then, a crab) */
function rockLit(rk, x, y, T) {
  const s = rk.r, w = Math.sin(T * 2.6 + rk.ph) * 3;
  if (rk.q) {                                         // a block of the harbour quay
    rr(x - 30, y - 26, 60, 52, 9); ink('#cdbd9c', 4); X.fillStyle = '#a99876'; X.fillRect(x - 26, y + 10, 52, 12);
    X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(x - 24, y - 22, 26, 6); line([[x - 8, y - 4], [x + 22, y - 4]], 3, '#8a7a5a'); line([[x - 24, y + 8], [x + 6, y + 8]], 3, '#8a7a5a');
    return;
  }
  el(x, y + 5, s * 1.3 + w, s * 1.02 + w * .6); X.fillStyle = 'rgba(236,250,255,.62)'; X.fill();
  el(x, y + 5, s * 1.08 + w * .5, s * .84); X.fillStyle = 'rgba(255,255,255,.55)'; X.fill();
  blobPath(x, y, s, rk.L); ink('#8d93ab', 4);
  X.save(); blobPath(x, y, s, rk.L); X.clip();
  X.fillStyle = '#5f6785'; blobPath(x + s * .22, y + s * .24, s * .85, rk.L); X.fill();
  X.fillStyle = '#c6cce0'; blobPath(x - s * .22, y - s * .26, s * .52, rk.L2); X.fill();
  X.fillStyle = 'rgba(255,255,255,.7)'; el(x - s * .3, y - s * .36, s * .16, s * .09, -.5); X.fill();
  line([[x + s * .1, y - s * .2], [x + s * .22, y + s * .05], [x + s * .08, y + s * .3]], 2.6, '#454c68');
  X.restore();
  if (rk.crab) { const u = 1.15, cy = y - s * .55 + Math.sin(T * 5 + rk.ph) * 1; claude(x + s * .2, cy, u, { col: OR }); }
}
function rockGhost(rk, x, y, a) {                     // what the captain remembers: a faint bluish blob
  if (rk.q) { X.globalAlpha = a; rr(x - 30, y - 26, 60, 52, 9); X.fillStyle = '#2b3d70'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#4a69ad'; X.stroke(); X.globalAlpha = 1; return; }
  X.globalAlpha = a; blobPath(x, y, rk.r * 1.05, rk.L); X.fillStyle = '#2a3c70'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#5273b8'; X.stroke(); X.globalAlpha = 1;
}
function rockDark(rk, x, y) {                         // the keeper's chart: dark blobs with a pale rim
  if (rk.q) { rr(x - 30, y - 26, 60, 52, 9); X.fillStyle = '#070c22'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#7494d8'; X.stroke(); return; }
  blobPath(x, y, rk.r * 1.05, rk.L); X.fillStyle = '#070c22'; X.fill(); X.lineWidth = 3.2; X.strokeStyle = '#7494d8'; X.stroke();
}

/* ───────────── the boat ───────────── */
/* a little red rowing boat seen from above, bow up; Claude the captain stands in it. tilt: lean; hits: cracks; flick: lantern pulse */
function boat(x, y, tilt, hits, mood, T, col, sink) {
  X.save(); X.translate(x, y + Math.sin(T * 3.2) * 1.6); X.rotate(tilt + Math.sin(T * 2.3) * .025);
  if (sink) { const k = ease(sink); X.translate(0, k * 20); X.rotate(k * .55); X.scale(1 - k * .35, 1 - k * .35); X.globalAlpha = 1 - k * .35; }
  shadow(3, 8, 28, 36, .22);
  X.beginPath(); X.moveTo(0, -42); X.quadraticCurveTo(30, -14, 25, 24); X.quadraticCurveTo(22, 40, 0, 42); X.quadraticCurveTo(-22, 40, -25, 24); X.quadraticCurveTo(-30, -14, 0, -42); X.closePath(); ink('#e0453d', 4);
  X.beginPath(); X.moveTo(0, -34); X.quadraticCurveTo(21, -10, 17, 22); X.quadraticCurveTo(14, 34, 0, 35); X.quadraticCurveTo(-14, 34, -17, 22); X.quadraticCurveTo(-21, -10, 0, -34); X.closePath(); ink('#f6e3b4', 3);
  X.save(); X.beginPath(); X.moveTo(0, -42); X.quadraticCurveTo(30, -14, 25, 24); X.quadraticCurveTo(22, 40, 0, 42); X.quadraticCurveTo(-22, 40, -25, 24); X.quadraticCurveTo(-30, -14, 0, -42); X.clip();
  X.fillStyle = '#fff'; X.fillRect(-30, -2, 60, 7); X.fillStyle = 'rgba(255,255,255,.4)'; el(-14, -20, 4, 12, .25); X.fill(); X.restore();
  if (hits > 0) { line([[-22, 8], [-15, 13], [-19, 19]], 3, INK); if (hits > 1) line([[20, 20], [13, 26], [18, 32], [12, 36]], 3, INK); if (hits > 2) line([[-4, -34], [2, -26], [-3, -20]], 3, INK); }
  // the bow lantern on a little post
  rr(-2, -48, 4, 10, 2); ink('#6b4a2c', 2); X.beginPath(); X.arc(0, -52, 6, 0, TAU); ink('#ffe58a', 2.5); X.fillStyle = '#fff'; el(-1.5, -53.5, 2, 2.4); X.fill();
  const u = 2.3; arm(u, -1, -.9, .8, col || OR); arm(u, 1, .9, .8, col || OR);
  X.save(); X.translate(0, 0); claude(0, 24, u, { col: col || OR, mood }); X.restore();
  // captain's cap
  X.fillStyle = INK; rr(-8.5 * 1, 24 - 9 * u - 5, 17, 9, 3); X.fill(); rr(-7, 24 - 9 * u - 7, 14, 8, 3); X.fillStyle = '#fff'; X.fill(); X.fillStyle = INK; X.fillRect(-7, 24 - 9 * u - 1, 14, 3); X.fillStyle = '#ffcf33'; X.fillRect(-2, 24 - 9 * u - 5, 4, 3);
  X.restore();
}
function hat(x, y, T) {                               // the captain's cap, floating
  X.save(); X.translate(x, y + Math.sin(T * 4) * 1.5); X.rotate(-.2); el(0, 4, 13, 5); ink('#2a2a3c', 2.5); rr(-9, -6, 18, 11, 4); ink('#fff', 3); X.fillStyle = '#ffcf33'; X.fillRect(-2.5, -3, 5, 4); X.restore();
}
function fin(x, y, T, s) {                            // a shark fin
  X.save(); X.translate(x, y); X.scale(s, s);
  el(0, 4, 26, 7); X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 3; X.stroke();
  X.beginPath(); X.moveTo(-16, 3); X.quadraticCurveTo(-4, -14, 4, -34); X.quadraticCurveTo(14, -12, 20, 3); X.closePath(); ink('#7e93ad', 3.5);
  X.fillStyle = 'rgba(255,255,255,.4)'; X.beginPath(); X.moveTo(-8, -3); X.quadraticCurveTo(-1, -14, 2, -26); X.quadraticCurveTo(0, -10, -2, -3); X.fill();
  X.restore();
}

/* ───────────── the lighthouse and the keeper ───────────── */
const WT = { cv: null };                              // one wave tile (800×240), painted once: pale crests on transparent
function waveTile() {
  if (WT.cv) return WT.cv; const cv = document.createElement('canvas'); cv.width = 800; cv.height = 240; const old = X; X = cv.getContext('2d');
  X.lineCap = 'round'; X.strokeStyle = '#fff'; X.lineWidth = 4;
  for (let r = 0; r < 8; r++) for (let c = -1; c < 7; c++) {
    const x = c * 140 + (r % 2) * 70 + (r * 37) % 30, y = 14 + r * 30; X.beginPath(); X.moveTo(x, y); X.quadraticCurveTo(x + 17, y - 11, x + 34, y); X.quadraticCurveTo(x + 51, y + 11, x + 68, y); X.stroke();
  }
  X = old; WT.cv = cv; return cv;
}
let BG = null;                                        // the cliff + tower, painted once (transparent canvas)
function buildTower() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  // the rocky islet the lighthouse stands on (top right)
  X.beginPath(); X.moveTo(446, 168); X.quadraticCurveTo(470, 232, 520, 262); X.quadraticCurveTo(580, 300, 700, 288); X.quadraticCurveTo(790, 280, 800, 262); X.lineTo(800, 150); X.lineTo(446, 150); X.closePath(); ink('#4c4a66', 4);
  X.save(); X.clip(); X.fillStyle = '#6b6988'; X.beginPath(); X.moveTo(446, 168); X.quadraticCurveTo(470, 232, 520, 262); X.lineTo(560, 236); X.lineTo(500, 180); X.fill();
  X.fillStyle = '#3a3852'; for (const [a, b, c] of [[640, 276, 34], [740, 270, 28], [560, 270, 22]]) { el(a, b, c, c * .45); X.fill(); } X.restore();
  // the tower: red and white bands, tapering
  X.beginPath(); X.moveTo(576, 132); X.lineTo(632, 132); X.lineTo(646, 268); X.lineTo(562, 268); X.closePath(); ink('#e9e1cf', 4);
  X.save(); X.beginPath(); X.moveTo(576, 132); X.lineTo(632, 132); X.lineTo(646, 268); X.lineTo(562, 268); X.closePath(); X.clip();
  X.fillStyle = '#d6453b'; for (let i = 0; i < 3; i++) X.fillRect(540, 150 + i * 44, 130, 22);
  X.fillStyle = 'rgba(20,16,50,.28)'; X.fillRect(618, 120, 40, 160); X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(580, 120, 6, 160); X.restore();
  rr(594, 190, 18, 24, 8); ink('#ffe58a', 3); X.fillStyle = INK; X.fillRect(602, 192, 2, 20);
  rr(592, 232, 22, 40, 9); ink('#7a4a2c', 3);
  // gallery balcony to the left, with a railing, and the lamp room on top
  rr(470, 150, 176, 12, 4); ink('#3a3850', 3.5); X.fillStyle = 'rgba(255,255,255,.2)'; X.fillRect(474, 152, 168, 3);
  X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(472, 132); X.lineTo(576, 132); X.stroke(); for (let x = 474; x < 580; x += 26) { X.beginPath(); X.moveTo(x, 132); X.lineTo(x, 150); X.stroke(); }
  rr(580, 84, 48, 50, 6); ink('#2f2d46', 3.5);
  X.beginPath(); X.moveTo(574, 86); X.lineTo(604, 56); X.lineTo(634, 86); X.closePath(); ink('#d6453b', 4);
  X.beginPath(); X.arc(604, 54, 5, 0, TAU); ink('#ffcf33', 2.5);
  X = old; return cv;
}
/* the keeper: Claude in striped pyjamas, a nightcap and fluffy slippers, hands on a big crank wheel (it turns with the lamp) */
function keeperFig(x, y, spin, dance, mood, T, col, startle) {
  const u = 3.6, hop = dance ? Math.abs(Math.sin(T * 10)) * 14 : 0, by = y - hop;
  shadow(x, y + 1, 26, 6, .25);
  // the crank wheel
  const wx = x - 30, wy = by - 29;
  X.save(); X.translate(wx, wy); X.rotate(spin); X.beginPath(); X.arc(0, 0, 17, 0, TAU); ink('#b9833f', 3.5); X.beginPath(); X.arc(0, 0, 9, 0, TAU); ink('#8a5a2c', 2.5);
  for (let i = 0; i < 4; i++) { X.rotate(Math.PI / 2); X.fillStyle = INK; X.fillRect(-2, -17, 4, 8); X.fillStyle = '#ffd36a'; X.beginPath(); X.arc(0, -19, 3.4, 0, TAU); X.fill(); }
  X.restore();
  X.save(); X.translate(x, by);
  if (dance) { const w = Math.sin(T * 14) * .35; arm(u, -1, -.5 + w, 1, col); arm(u, 1, .5 - w, 1, col); }
  else { arm(u, -1, -1.35 + Math.sin(spin * 2) * .08, .95, col); arm(u, 1, .55, .55, col); }
  X.restore();
  claude(x, by, u, { col, mood: dance ? 'happy' : mood });
  // pyjama stripes over the body, a nightcap with a pom-pom, slippers
  X.save(); X.beginPath(); X.rect(x - 6 * u, by - 9 * u, 12 * u, 7 * u); X.clip(); X.fillStyle = 'rgba(176,205,255,.62)'; for (let i = 0; i < 6; i++) X.fillRect(x - 6 * u + i * 2.4 * u, by - 9 * u, 1.3 * u, 7 * u); X.restore();
  X.beginPath(); X.moveTo(x - 5.5 * u, by - 9 * u); X.quadraticCurveTo(x - 1 * u, by - 14 * u, x + 3 * u, by - 12.5 * u + Math.sin(T * 3) * 2); X.quadraticCurveTo(x + 6 * u, by - 12 * u, x + 7 * u, by - 9 * u); X.closePath(); ink('#e0453d', 3);
  X.beginPath(); X.arc(x + 3.2 * u, by - 12.6 * u + Math.sin(T * 3) * 2, 1.5 * u, 0, TAU); ink('#fff', 2.5); X.fillStyle = '#fff'; rr(x - 6.1 * u, by - 9.6 * u, 12.2 * u, 1.2 * u, 3); X.fill();
  for (const sx of [-2.8, 2.2]) { el(x + sx * u, by - .2, 1.9 * u, .9 * u); ink('#ff9fc2', 2.5); }
  if (startle) { line([[x + 20, by - 44], [x + 28, by - 54]], 3, '#fff'); line([[x - 20, by - 44], [x - 28, by - 54]], 3, '#fff'); }
}
/* a sleepy seagull in a nightcap on the rail (wakes with a squawk when lightning strikes) */
function gull(x, y, awake, T) {
  X.save(); X.translate(x, y + (awake ? -Math.abs(Math.sin(T * 24)) * 3 : 0));
  el(0, -9, 15, 11); ink('#fff', 3); el(-3, -6, 9, 6); X.fillStyle = '#d9e2f0'; X.fill();
  X.beginPath(); X.arc(11, -20, 8, 0, TAU); ink('#fff', 3); X.beginPath(); X.moveTo(17, -21); X.lineTo(27, awake ? -17 : -19); X.lineTo(17, -17); X.closePath(); ink('#ffb23d', 2.5);
  if (awake) { el(12, -22, 3.4, 4); ink('#fff', 1.5); X.fillStyle = INK; el(13, -22, 1.6, 1.6); X.fill(); } else line([[8, -21], [13, -20]], 2.6, INK);
  X.beginPath(); X.moveTo(5, -27); X.lineTo(12, -38); X.lineTo(17, -26); X.closePath(); ink('#6c9bff', 2.5);
  line([[-2, 2], [-2, 7]], 2.6, '#ffb23d'); line([[4, 2], [4, 7]], 2.6, '#ffb23d');
  if (!awake) txt('z', 24, -36 - Math.sin(T * 2) * 3, 16, '#cfe0ff');
  X.restore();
}
/* the horizon gag during lightning: a ghost ship, or (1 round in 8) a whale spouting */
function gag(whale, T, a) {
  X.save(); X.globalAlpha = a;
  if (whale) {
    X.translate(250, 236); X.beginPath(); X.moveTo(-90, 12); X.quadraticCurveTo(-60, -40, 10, -34); X.quadraticCurveTo(70, -28, 96, 12); X.closePath(); ink('#3a4f86', 4);
    X.beginPath(); X.moveTo(92, 2); X.quadraticCurveTo(118, -28, 134, -22); X.quadraticCurveTo(122, -6, 128, 12); X.quadraticCurveTo(110, 4, 92, 12); X.closePath(); ink('#3a4f86', 3.5);
    el(-56, -2, 3, 3); X.fillStyle = '#fff'; X.fill(); line([[-70, 6], [-46, 8]], 2.5, INK);
    for (let i = 0; i < 6; i++) { const q = (T * 2 + i / 6) % 1; X.fillStyle = '#dff6ff'; el(-34 + (i - 3) * 6 * q, -36 - q * 38, 3.4, 3.4); X.fill(); }
  } else {
    X.translate(250, 236 + Math.sin(T * 2) * 2); X.rotate(.05);
    X.beginPath(); X.moveTo(-70, 0); X.lineTo(70, 0); X.lineTo(52, 22); X.lineTo(-52, 22); X.closePath(); ink('#8a97b8', 3.5);
    line([[0, 0], [0, -62]], 4, '#5b6a92'); for (const [dx, h, w] of [[-26, 42, 22], [22, 38, 20]]) { X.beginPath(); X.moveTo(dx - w, -6); X.quadraticCurveTo(dx, -h, dx + w, -6); X.closePath(); ink('#c5d0ea', 3); }
    X.beginPath(); X.moveTo(0, -62); X.lineTo(14, -56); X.lineTo(0, -50); X.closePath(); ink('#fff', 2.5);
    for (const sx of [-1, 1]) { el(sx * 12 - 0, -22, 3.6, 4.6); X.fillStyle = '#fff'; X.fill(); }
    X.globalAlpha = a * .5; el(0, 28, 70, 8); X.fillStyle = '#9fb4e8'; X.fill();
  }
  X.restore();
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 5; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ═════════ the game ═════════ */
function duLight(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), keeper = D.role === 0, TS = Math.sqrt(sp), V = V0 * TS, VX = 340 * TS;
  /* the level: a winding safe channel (waypoints every 180 px, ≤190 px sideways each) and rocks scattered everywhere outside it */
  const SEG = 320, NW = Math.ceil(ARRIVE / SEG) + 3, cw = [470];
  let side = R() < .5 ? -1 : 1;                       // the channel zigzags: it swings to one side of the middle, then the other
  for (let i = 1; i < NW; i++) { side = -side; cw.push(i >= NW - 5 ? lerp(cw[i - 1], 470, .55) : 470 + side * (110 + R() * 80)); }
  const cAt = p => { const q = Math.max(0, p) / SEG, i = Math.min(NW - 2, Math.floor(q)); return lerp(cw[i], cw[i + 1], ease(q - i)); };
  const gc = cAt(DIST), rocks = [];
  for (let pr = 270; pr < DIST - 120; pr += 40 + R() * 24) {
    for (let k = 0, n = 5 + Math.floor(R() * 2); k < n; k++) {
      const p = pr + (R() - .5) * 50, x = LMIN - 14 + R() * (LMAX - LMIN + 34), r = 21 + R() * 14, half = lerp(102, 84, p / DIST);
      const L = Array.from({ length: 9 }, () => .84 + R() * .3), L2 = Array.from({ length: 9 }, () => .8 + R() * .3), crab = R() < .16, ph = R() * 6;
      if (Math.abs(x - cAt(p)) < half + r) continue;
      rocks.push({ p, x, r, L, L2, crab, ph, litAt: -9, q: false });
    }
  }
  for (const [x0, x1] of [[LMIN - 40, gc - GAPH - 30], [gc + GAPH + 30, 830]]) for (let x = x0; x < x1; x += 54) rocks.push({ p: DIST, x, r: 31, L: [1, 1, 1, 1], L2: [1, 1, 1, 1], crab: false, ph: 0, litAt: -9, q: true });
  const fl = [3.7 + R() * 1.3, 8.4 + R() * 1.6], whale = R() < 1 / 8;
  /* state */
  const kHeld = new Set(), bits = [], pops = [];
  let th = TH0, thT = TH0, om = 0, lastA = null, thSent = -9, lastTh = 99, spin = 0;                              // keeper: lamp
  let bx = 470, tx = 470, vx = 0, P = 0, hits = 0, invUntil = -9, hitAt = -9, bSent = -9, lastB = '', arrived = false, arrT = -9, thV = TH0, thGoal = TH0, held = false;   // captain: boat
  let hornAt = 0, gulpAt = 0, bX = 470, bP = 0, bRecv = -1, bxV = 470, pView = 0, kHits = 0, loseAt = -9, resAt = -1, flashN = [false, false], gullUp = -9, startle = 0, fN = FOCUSN;
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const ry = (rk, p) => BY - (rk.p - p);
  const litTest = (x, y, r, a) => { const dx = x - LX, dy = y - LY, d = Math.hypot(dx, dy); return d < BEAM + r && Math.abs(wrap(Math.atan2(dy, dx) - a)) < HALF + Math.asin(Math.min(.9, r / Math.max(d, 1))); };
  const pulse = d => d < 0 || d > .44 ? 0 : d < .1 ? 1 : d < .18 ? .25 : d < .27 ? .9 : 1 - (d - .27) / .17;
  const fk = T => Math.max(pulse(T - fl[0]), pulse(T - fl[1]));
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 700, r: 3 }, o)); }
  function bonkFx(x, y) { hitAt = g.c; sfx.thud(); snd(210, .16, 'square', .07, 0, 80); noise(.2, .07, 700, 180, 'lowpass'); shake(7, .22); for (let i = 0; i < 9; i++) bit({ x, y, vx: (cr() - .5) * 280, vy: -(80 + cr() * 220), c: '#e8f6ff', r: 3 + cr() * 3 }); pop('BONK!', x, y - 80, 34, '#e8434f', '#fff'); }
  function thunder() { noise(1.1, .13, 260, 50, 'lowpass'); noise(.25, .1, 1800, 200, 'bandpass'); }

  const g = {
    c: 0, dur: 16, pts: 0,
    cmd: keeper ? 'SWEEP!' : 'STEER!', roleLabel: keeper ? 'KEEPER' : 'CAPTAIN',
    hint: keeper ? 'TURN THE LAMP (DRAG IN CIRCLES OR HOLD ◄ ►) AND LIGHT THE WAY JUST AHEAD OF THE BOAT - YOUR FRIEND CAN\'T SEE THE ROCKS' : 'STEER THE BOAT (MOUSE OR ◄ ►) - YOU ONLY SEE WHAT THE BEAM LIGHTS, SO FOLLOW THE LIGHT!',
    thint: keeper ? 'DRAG IN CIRCLES AROUND THE LAMP AND LIGHT THE WAY JUST AHEAD OF THE BOAT' : 'DRAG TO STEER THE BOAT - YOU ONLY SEE WHAT THE BEAM LIGHTS, SO FOLLOW THE LIGHT!',
    update(dt) {
      g.c += dt; startle = Math.max(0, startle - dt);
      if (g.result && resAt < 0) resAt = g.c;
      if (g.result === 'lose' && loseAt < 0) loseAt = g.c;
      if (arrived && !hornAt) { hornAt = 1; snd(98, .9, 'sawtooth', .07, 0, 90); snd(147, .9, 'sawtooth', .05, 0, 135); snd(1319, .2, 'square', .04, .5); }
      if (loseAt >= 0 && !gulpAt) { gulpAt = 1; for (let i = 0; i < 3; i++) snd(340 - i * 40, .16, 'sine', .07, i * .12, 120); snd(150, .1, 'square', .08, .78, 70); noise(.14, .08, 900, 200, 'lowpass', .78); }
      const done = !!(g.result || arrived || hits >= 3 || kHits >= 3);
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); held = false; }
      // lightning (cosmetic on both screens, same times from the seed)
      for (let i = 0; i < 2; i++) if (!flashN[i] && g.c >= fl[i]) { flashN[i] = true; thunder(); gullUp = g.c; startle = .9; }
      if (keeper) {
        // the lamp: keys push the target, a heavy spring follows (it overshoots a little)
        let kd = 0; for (const c of kHeld) { if (c === 'ArrowLeft' || c === 'KeyA' || c === 'ArrowUp' || c === 'KeyW') kd++; else if (c === 'ArrowRight' || c === 'KeyD' || c === 'ArrowDown' || c === 'KeyS') kd--; }
        if (kd && !done) thT = clamp(thT + kd * 2.1 * dt, TMIN, TMAX);
        om += (62 * (thT - th) - 11 * om) * dt; th = clamp(th + om * dt, TMIN - .04, TMAX + .04); spin += om * dt * 3;
        const r = Math.round(th * 100) / 100; if (r !== lastTh && g.c - thSent >= .1) { lastTh = r; thSent = g.c; D.send('th', r, true); }
        // where the boat is: the last report, moved on at the boat's constant speed
        if (bRecv < 0) pView = g.c * V; else { const pe = bP + (g.c - bRecv) * V; pView += (Math.min(pe, ARRIVE) - pView) * Math.min(1, dt * 8); }
        bxV += (bX - bxV) * Math.min(1, dt * 12);
        if (!g.result) {
          if (kHits >= 3) g.finish('lose'); else if (arrived) g.finish('win'); else if (g.c >= g.limit) g.finish('lose');
        }
      } else {
        // the boat: sideways toward the pointer / keys at a fixed speed, forward at a constant speed
        let kd = 0; for (const c of kHeld) { if (c === 'ArrowLeft' || c === 'KeyA') kd--; else if (c === 'ArrowRight' || c === 'KeyD') kd++; }
        if (kd && !done) tx = clamp(tx + kd * 460 * TS * dt, LMIN, LMAX);
        const ox = bx;
        if (!done) { bx += clamp(tx - bx, -VX * dt, VX * dt); P += V * dt; }
        vx += ((bx - ox) / Math.max(dt, 1e-3) - vx) * Math.min(1, dt * 10);
        thV += wrap(thGoal - thV) * Math.min(1, dt * 11);
        // what the captain can see: the beam, the lantern, lightning. Seen rocks keep a fading ghost.
        const fl2 = fk(g.c) > .3;
        for (const rk of rocks) {
          const y = ry(rk, P); if (y < -70 || y > H + 70) continue;
          if (fl2 || litTest(rk.x, y, rk.r, thV) || Math.hypot(rk.x - bx, y - BY) < LANT + rk.r) rk.litAt = g.c;
        }
        // rocks hurt (3 hulls)
        if (!done && g.c > invUntil) for (const rk of rocks) {
          const y = ry(rk, P); if (y < BY - 90 || y > BY + 90) continue;
          if (Math.hypot(rk.x - bx, y - BY) < rk.r * (rk.q ? .9 : .95) + RB) {
            hits++; invUntil = g.c + 1.0; const s = bx < rk.x ? -1 : 1; bx = clamp(bx + s * 42, LMIN, LMAX); tx = bx; bonkFx(bx, BY); D.send('hit', hits);
            if (hits >= 3) loseAt = g.c; break;
          }
        }
        if (!done && P >= ARRIVE) { arrived = true; arrT = g.c; D.send('arr', 1); }
        const b = Math.round(bx) + ',' + Math.round(P); if (b !== lastB && g.c - bSent >= .1) { lastB = b; bSent = g.c; D.send('b', [Math.round(bx), Math.round(P)], true); }
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
    },
    msg(type, d) {
      if (keeper) {
        if (type === 'b' && Array.isArray(d)) { if (d[1] >= bP) { bX = d[0]; bP = d[1]; bRecv = g.c; } }
        else if (type === 'hit' && d > kHits) { kHits = d; hitAt = g.c; bonkFx(bxV, BY); if (kHits >= 3) loseAt = g.c; }
        else if (type === 'arr') { if (!arrived) { arrived = true; arrT = g.c; } }
      } else if (type === 'th' && typeof d === 'number') thGoal = clamp(d, TMIN - .1, TMAX + .1);
    },
    draw() {
      const T = g.c, won = g.result === 'win' || arrived, lost = g.result === 'lose' || hits >= 3 || kHits >= 3 || (g.result === 'lose'), rk0 = resAt >= 0 ? T - resAt : -1;
      const lk = lost ? (loseAt >= 0 ? T - loseAt : rk0) : -1, wk = won ? (arrT >= 0 ? T - arrT : rk0) : -1;
      const Pv = keeper ? pView : P, ang = keeper ? th : thV, bxN = keeper ? bxV : bx, f = fk(T), hn = keeper ? kHits : hits;
      X = ctx;
      // 1. the dark sea (the keeper's chart is a little brighter than the captain's fog) and faint waves
      X.fillStyle = keeper ? '#1c3872' : '#08102c'; X.fillRect(0, 0, W, H);
      const tile = waveTile(), off = (Pv * .8) % 240; X.globalAlpha = keeper ? .13 : .06; for (let y = -240 + off; y < H; y += 240) X.drawImage(tile, 0, y); X.globalAlpha = 1;
      // 2. rocks outside the light: ghosts (captain) or dark blobs (keeper)
      for (const rk of rocks) {
        const y = ry(rk, Pv); if (y < -70 || y > H + 70) continue;
        if (keeper) rockDark(rk, rk.x, y); else { const a = clamp(1 - (T - rk.litAt) / GHOST, 0, 1); if (a > .02) rockGhost(rk, rk.x, y, a * .75); }
      }
      // 3. the lit world, clipped to the beam (and, for the captain, to the bow lantern); lightning lights it all
      const lit = (alpha) => {
        X.globalAlpha = alpha; const gr = X.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2f9ac6'); gr.addColorStop(1, '#1f6ea6'); X.fillStyle = gr; X.fillRect(0, 0, W, H);
        X.globalAlpha = alpha * .4; for (let y = -240 + off; y < H; y += 240) X.drawImage(tile, 0, y); X.globalAlpha = alpha;
        harbour(Pv, T, won);
        for (const rk of rocks) { const y = ry(rk, Pv); if (y < -70 || y > H + 70) continue; rockLit(rk, rk.x, y, T); }
        X.globalAlpha = 1;
      };
      const fw0 = () => Math.max(f, won && wk >= 0 ? ease(wk / .45) : 0);
      const wedge = (a) => { X.beginPath(); X.moveTo(LX, LY); X.arc(LX, LY, BEAM, a - HALF, a + HALF); X.closePath(); };
      if (fw0() < .98) {
        X.save(); wedge(ang); X.clip(); lit(1); X.restore();
        if (!keeper) { const lr = LANT * (1 + Math.sin(T * 11) * .05 + (T - hitAt < .3 ? .3 : 0)), by = won ? BY - ease(wk / .9) * 190 : BY; X.save(); X.beginPath(); X.arc(bxN, by - 4, lr, 0, TAU); X.clip(); lit(1); X.restore(); }
      }
      const fw = Math.max(f, won && wk >= 0 ? ease(wk / .45) : 0);
      if (fw > 0) { lit(fw); X.fillStyle = `rgba(235,240,255,${f * .22})`; X.fillRect(0, 0, W, H); if (f > 0) gag(whale, T, f); }
      // 5. harbour beacons shine through the fog; the boat; the keeper's dot
      beacons(Pv, T);
      const bt = clamp(vx / 420, -1, 1) * .22;
      if (keeper) {
        const bOy = won ? BY - ease(wk / .9) * 190 : BY, sinkK = lk >= 0 ? clamp(lk / .5, 0, 1) : 0;
        if (!lost || lk < .7) {
          const a = 1 - sinkK; X.globalAlpha = a; X.fillStyle = 'rgba(255,240,170,.28)'; X.beginPath(); X.arc(bxN, bOy, 26 + Math.sin(T * 8) * 2, 0, TAU); X.fill();
          X.beginPath(); X.arc(bxN, bOy, 8, 0, TAU); ink('#ffe58a', 3); X.fillStyle = '#fff'; el(bxN - 2, bOy - 3, 2.4, 2); X.fill();
          if (T - hitAt < .5) { ring(bxN, bOy, '#ff7a7a', 60, .3); X.beginPath(); X.arc(bxN, bOy, 14 + (T - hitAt) * 40, 0, TAU); X.lineWidth = 3; X.strokeStyle = `rgba(255,110,110,${1 - (T - hitAt) * 2})`; X.stroke(); }
          X.globalAlpha = 1;
        }
        if (T < 3.6 && !g.result) pill(bxN, bOy - 40, 'YOUR FRIEND', pCol());
      } else {
        const by = won ? BY - ease(wk / .9) * 190 + Math.sin(T * 14) * (wk > .9 ? 2 : 0) : BY;
        const flick = T - hitAt < .6 && hn < 3 ? Math.sin(T * 60) * 2 : 0;
        if (lost && lk >= 0) sinking(bxN, by, lk, T); else boat(bxN + flick, by, bt, hn, (T - hitAt < .7 && hits > 0) ? 'sad' : won ? 'happy' : null, T, myCol(), 0);
        if (T < 3.6 && !g.result) pill(bxN, by - 66, 'YOU', myCol());
        if (T - hitAt < .7 && hits > 0 && !lost) for (let i = 0; i < 3; i++) { const a = T * 8 + i * TAU / 3; star(bxN + Math.cos(a) * 30, by - 52 + Math.sin(a) * 8, 8, 3.5, 5, a, '#FFE14D', 2.5); }
      }
      // 6. the lighthouse, the keeper, the gull
      if (!BG) BG = buildTower(); X.drawImage(BG, 0, 0);
      // 4. the beam's light itself: a warm additive glow along the cone, a hot core, soft edges
      X.save(); X.globalCompositeOperation = 'lighter';
      let gr = X.createRadialGradient(LX, LY, 20, LX, LY, BEAM); gr.addColorStop(0, 'rgba(255,238,160,.55)'); gr.addColorStop(.35, 'rgba(255,230,140,.22)'); gr.addColorStop(1, 'rgba(255,230,140,0)');
      wedge(ang); X.fillStyle = gr; X.fill();
      X.beginPath(); X.moveTo(LX, LY); X.arc(LX, LY, BEAM * .8, ang - HALF * .32, ang + HALF * .32); X.closePath(); gr = X.createRadialGradient(LX, LY, 10, LX, LY, BEAM * .8); gr.addColorStop(0, 'rgba(255,250,210,.4)'); gr.addColorStop(1, 'rgba(255,250,210,0)'); X.fillStyle = gr; X.fill();
      X.restore();
      // the edges of the cone: two soft ink-blue lines so the keeper can read exactly where the light ends
      X.lineWidth = 2.5; X.strokeStyle = 'rgba(255,244,180,.45)'; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(LX, LY); X.lineTo(LX + Math.cos(ang + s * HALF) * BEAM, LY + Math.sin(ang + s * HALF) * BEAM); X.stroke(); }
      X.save(); X.globalCompositeOperation = 'lighter'; gr = X.createRadialGradient(LX, LY, 4, LX, LY, 70); gr.addColorStop(0, 'rgba(255,248,200,.9)'); gr.addColorStop(1, 'rgba(255,230,120,0)'); X.fillStyle = gr; X.beginPath(); X.arc(LX, LY, 70, 0, TAU); X.fill(); X.restore();
      X.save(); X.translate(LX, LY); X.rotate(ang); X.beginPath(); X.moveTo(0, -8); X.lineTo(17, -13); X.lineTo(17, 13); X.lineTo(0, 8); X.closePath(); ink('#ffe58a', 2.5); X.fillStyle = '#fff'; X.fillRect(6, -4, 8, 8); X.restore();
      const kcol = keeper ? myCol() : pCol(), awake = g.c - gullUp < 1.6;
      gull(724, 196, awake, T);
      keeperFig(530, 150, keeper ? spin : th * 3, won && (!keeper || arrT >= 0 || g.result === 'win'), lost ? 'sad' : null, T, kcol, startle > 0);
      pill(522, 84, keeper ? 'YOU' : 'YOUR FRIEND', kcol);
      // 7. rain, lightning bolt, drops
      if (f > .3) { X.strokeStyle = `rgba(255,255,255,${f})`; X.lineWidth = 5; X.beginPath(); X.moveTo(440, 60); X.lineTo(416, 92); X.lineTo(432, 96); X.lineTo(402, 134); X.stroke(); }
      X.strokeStyle = 'rgba(190,210,255,.28)'; X.lineWidth = 1.6; X.beginPath(); for (let i = 0; i < 46; i++) { const x = (i * 137 + T * 140) % 880 - 40, y = (i * 211 + T * 640) % 640 - 20; X.moveTo(x, y); X.lineTo(x - 7, y + 18); } X.stroke();
      for (const b of bits) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); el(b.x, b.y, b.r, b.r * 1.3); ink(b.c, 1.5); X.globalAlpha = 1; }
      // 8. win / lose payoff on top
      if (wk >= 0 && wk < 3) winFx(wk, T, keeper ? bxN : bxN);
      if (lost && lk >= 0) loseFx(bxN, lk, T);
      // 9. HUD: course strip + hulls
      hud(P, Pv, hn, T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 140, 660), Math.max(100, q.y - Math.min(a, .6) * 14), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && !arrived && T < 3.4) badge(keeper ? 'LIGHT AHEAD OF THE BOAT!' : 'STEER INTO THE LIGHT!', 300, 214, 19, keeper ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
      vignette(.2);
    },
    down(p) { held = true; if (keeper) { const a = Math.atan2(p.y - LY, p.x - LX); lastA = a; } else g.move(p); },
    up() { held = false; },
    move(p) {
      if (keeper) { if (Math.hypot(p.x - LX, p.y - LY) < 28 || g.result) return; const a = Math.atan2(p.y - LY, p.x - LX); if (lastA !== null) thT = clamp(thT + wrap(a - lastA) * 1.15, TMIN, TMAX); lastA = a; }
      else tx = clamp(p.x, LMIN, LMAX);
    },
    key(e) { if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return; kHeld.add(e.code); },
    keyup(e) { kHeld.delete(e.code); },
  };
  /* the harbour: quay wall with a gap, warm town behind it (drawn in the lit world only) */
  function harbour(p, T, all) {
    const yq = BY - (DIST - p); if (yq < -80 || yq > H + 140) return;
    X.fillStyle = '#e9c98f'; X.fillRect(0, 0, W, Math.max(0, yq - 28));
    X.fillStyle = 'rgba(20,16,28,.14)'; for (let x = 0; x < W; x += 46) X.fillRect(x, 0, 3, Math.max(0, yq - 28));
    for (let i = 0; i < 7; i++) {
      const hx = 60 + i * 118, hy = yq - 62 - (i % 2) * 26; if (hy < -60) continue;
      rr(hx - 28, hy - 22, 56, 46, 5); ink(['#ff9a8a', '#8fd0ff', '#ffe08a'][i % 3], 3.5); X.beginPath(); X.moveTo(hx - 34, hy - 20); X.lineTo(hx, hy - 50); X.lineTo(hx + 34, hy - 20); X.closePath(); ink('#d6453b', 3.5);
      rr(hx - 7, hy - 8, 14, 18, 3); ink('#ffe58a', 2.5);
    }
    X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(0, yq - 100); X.quadraticCurveTo(200, yq - 70, 400, yq - 100); X.quadraticCurveTo(600, yq - 130, 800, yq - 100); X.stroke();
    const cols = ['#ff4d6d', '#ffd23f', '#4db8ff', '#5CFF7A']; for (let i = 0; i < 12; i++) { const x = 30 + i * 66, y = yq - 100 + Math.sin(i * .9) * 10 + 6; X.beginPath(); X.moveTo(x - 9, y); X.lineTo(x + 9, y); X.lineTo(x, y + 18); X.closePath(); ink(cols[i % 4], 2.5); }
  }
  function beacons(p, T) {
    const yq = BY - (DIST - p); if (yq < -20 || yq > H + 40) return;
    for (const [x, c] of [[gc - GAPH - 8, '#ff4d6d'], [gc + GAPH + 8, '#5CFF7A']]) {
      const pu = .7 + .3 * Math.sin(T * 5 + x); X.save(); X.globalCompositeOperation = 'lighter'; const gr = X.createRadialGradient(x, yq - 20, 2, x, yq - 20, 44 * pu); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = gr; X.beginPath(); X.arc(x, yq - 20, 44 * pu, 0, TAU); X.fill(); X.restore();
      line([[x, yq + 4], [x, yq - 20]], 5, INK); X.beginPath(); X.arc(x, yq - 24, 8, 0, TAU); ink(c, 3); X.fillStyle = '#fff'; el(x - 2, yq - 27, 2.4, 2); X.fill();
    }
  }
  function sinking(x, y, k, T) {
    if (k < .6) boat(x, y, Math.sin(T * 30) * .06 * (1 - k), 3, 'sad', T, myCol(), k / .6);
    else { const a = clamp(1 - (k - .6) / .3, 0, 1); X.globalAlpha = a * .8; boat(x, y, 0, 3, 'sad', T, myCol(), 1); X.globalAlpha = 1; }
  }
  function winFx(k, T, x) {
    if (k < .12) return;
    const c = ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A'];
    for (let i = 0; i < 6; i++) { const q = (k * 1.3 + i * .17) % 1, a = i * 1.1 + 1, fx = 300 + i * 70, fy = 150 + (i % 3) * 36; star(fx, fy, 6 + q * 22, 3 + q * 4, 6, a + q * 2, c[i % 4], 0); }
    badge('HOOONK!', 400, 360, 44, '#ffb23d', '#fff', outBack((k - .12) / .22) * (k > 1.2 ? Math.max(0, 1 - (k - 1.2) * 3) : 1), -.06);
    for (let i = 0; i < 3; i++) { const q = (k * 1.6 + i / 3) % 1; X.globalAlpha = (1 - q) * .8; X.lineWidth = 5; X.strokeStyle = '#fff'; X.beginPath(); X.arc(LX, LY, 30 + q * 120, 0, TAU); X.stroke(); X.globalAlpha = 1; }
  }
  function loseFx(x, k, T) {
    const cx = x, cy = BY + 8;
    if (k > .1) for (let i = 0; i < 4; i++) { const q = (k * 2.4 + i * .3) % 1; X.globalAlpha = 1 - q; X.beginPath(); X.arc(cx - 14 + i * 9, cy - q * 52, 3 + i, 0, TAU); X.lineWidth = 2.5; X.strokeStyle = '#e8f6ff'; X.stroke(); X.globalAlpha = 1; }
    if (k > .25) {                                    // the captain's cap floats up; a shark fin circles in and takes it
      const q = clamp((k - .25) / .55, 0, 1), fx = lerp(cx + 150, cx + 24, ease(q)), fy = cy + 6 + Math.sin(q * 9) * 4;
      if (q < 1) { hat(cx + 24, cy - 6, T); fin(fx, fy, T, 1); } else { fin(cx + 24, cy, T, 1.15 - (k - .8) * 1.2); }
      if (k > .78) badge('CHOMP!', cx, cy - 90, 30, '#7e93ad', '#fff', outBack((k - .78) / .18), .06);
    }
  }
  function hud(p, pv, hn, T) {
    // course strip on the left edge (nobody else shows the boat's progress): sea line, a boat marker, a harbour flag at the top
    const x = 26, y0 = 520, y1 = 176, k = clamp(pv / ARRIVE, 0, 1), my = lerp(y0, y1, k);
    line([[x, y0], [x, y1]], 11, INK); line([[x, y0], [x, y1]], 5, '#3a69b5'); line([[x, y0], [x, my]], 5, '#ffe58a');
    line([[x, y1 + 4], [x, y1 - 20]], 4, INK); X.beginPath(); X.moveTo(x, y1 - 20); X.lineTo(x + 17, y1 - 15); X.lineTo(x, y1 - 10); X.closePath(); ink('#5CFF7A', 2.5);
    X.beginPath(); X.arc(x, my, 8, 0, TAU); ink('#e0453d', 2.5);
    // hulls (hearts), one cracks at each hit
    for (let i = 0; i < 3; i++) { const cracked = i >= 3 - hn; heart(346 + i * 38, 82, 1.1 * (cracked && T - hitAt < .3 ? 1.3 : 1), cracked ? '#6b6486' : '#ff5c8a', cracked); }
  }
  g.dbg = {
    LX, LY, BY, LMIN, LMAX, TMIN, TMAX, HALF, LANT, gc, rocks, DIST, ARRIVE,
    /* what the CAPTAIN screen shows: the rocks it can see (lit now, or a ghost still fading), the beam as it sees it, its boat */
    capView: () => ({ rocks: rocks.map(rk => { const y = ry(rk, P), a = clamp(1 - (g.c - rk.litAt) / GHOST, 0, 1); return { x: rk.x, y, r: rk.r, a, q: rk.q, lit: rk.litAt >= g.c - .05 }; }).filter(r => r.a > .12 && r.y > -60 && r.y < H + 60), th: thV, boat: [bx, BY], beacons: P > DIST - 800 ? gc : null, hits, P, tx }),
    /* what the KEEPER screen shows: every rock, the boat dot, the lamp angle */
    keyView: () => ({ rocks: rocks.map(rk => ({ x: rk.x, y: ry(rk, pView), r: rk.r, q: rk.q })).filter(r => r.y > -60 && r.y < H + 60), boat: [bxV, BY], th, thT, om, hits: kHits, P: pView }),
    truth: () => rocks.map(rk => ({ x: rk.x, y: ry(rk, keeper ? pView : P), r: rk.r })).filter(r => r.y > -60 && r.y < H + 60),
    cAt, hits: () => hits, kHits: () => kHits,
  };
  wire(g, D, 0, sp, 'du_lighthouse');
  return g;
}
reg('du_lighthouse', duLight, 'LIGHTHOUSE KEEPER'); REGMAP.du_lighthouse.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
const DR = [{ x: 250, y: 112, r: 22, L: [1, .92, 1.08, .95, 1.1, .9, 1, 1.06, .94], L2: [.95, 1.05, .9, 1, 1.08, .92, 1, .96, 1.04], ph: 1, crab: true }, { x: 340, y: 150, r: 24, L: [1.05, .9, 1, 1.1, .92, 1, 1.08, .9, 1], L2: [1, .9, 1.08, .94, 1, 1.06, .9, 1, 1.02], ph: 3, crab: false }, { x: 150, y: 150, r: 20, L: [1, 1.08, .9, 1, 1.06, .92, 1, 1.04, .94], L2: [1, 1, 1, 1, 1, 1, 1, 1, 1], ph: 5, crab: false }];
function demo(role, tt) {
  X = ctx; const u = tt % 4, lx = 452, ly = 40, sw = Math.sin(u / 4 * TAU);
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#0c1736'; X.fillRect(0, 0, 520, 240);
  const a = role === 0 ? 2.0 + sw * .42 : 2.05 + sw * .12;
  const wedgeP = () => { X.beginPath(); X.moveTo(lx, ly); X.arc(lx, ly, 560, a - .23, a + .23); X.closePath(); };
  X.save(); wedgeP(); X.clip(); const gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#2f9ac6'); gr.addColorStop(1, '#1f6ea6'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240); X.restore();
  for (const rk of DR) {
    if (role === 0) { blobPath(rk.x, rk.y, rk.r * 1.05, rk.L); X.fillStyle = '#070c22'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#7494d8'; X.stroke(); }
    X.save(); wedgeP(); X.clip(); rockLit(rk, rk.x, rk.y, tt); X.restore();
  }
  X.save(); X.globalCompositeOperation = 'lighter'; const g2 = X.createRadialGradient(lx, ly, 10, lx, ly, 520); g2.addColorStop(0, 'rgba(255,238,160,.55)'); g2.addColorStop(1, 'rgba(255,230,140,0)'); wedgeP(); X.fillStyle = g2; X.fill(); X.restore();
  // the lighthouse, top right
  X.beginPath(); X.moveTo(436, 52); X.lineTo(470, 52); X.lineTo(480, 130); X.lineTo(426, 130); X.closePath(); ink('#d6453b', 3); X.fillStyle = '#fff'; X.fillRect(432, 76, 44, 12); rr(432, 22, 40, 32, 5); ink('#2f2d46', 3);
  X.beginPath(); X.arc(lx, ly, 6, 0, TAU); ink('#ffe58a', 2);
  const bx = role === 0 ? 250 + 80 * sw : 250 + 90 * Math.sin(u / 4 * TAU - .6), by = 196;
  if (role === 0) {                                    // the keeper's finger circles round the lamp
    X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 4; X.setLineDash([8, 8]); X.beginPath(); X.arc(lx, ly, 96, 1.3, 2.6); X.stroke(); X.setLineDash([]);
    DUO.demoFinger(lx + Math.cos(a) * 96, ly + Math.sin(a) * 96 + 4, true, u % 1); badge('TURN THE LAMP!', 190, 26, 18, '#c98a12', '#fff', 1, -.03);
    X.beginPath(); X.arc(bx, by, 8, 0, TAU); ink('#ffe58a', 2.5);
  } else {
    X.save(); X.translate(bx, by); X.scale(.62, .62); X.translate(-bx, -by); boat(bx, by, Math.cos(u / 4 * TAU - .6) * .12, 0, null, tt, '#FFC93C', 0); X.restore();
    DUO.demoFinger(bx, by + 34, true, 0); badge('FOLLOW THE LIGHT!', 190, 26, 18, '#2b9ee6', '#fff', 1, -.03);
  }
  X.restore();
}
DUO.INFO.du_lighthouse = [['KEEPER', 'LIGHT THE ROCKS AHEAD', 'DRAG IN CIRCLES OR HOLD ◄ ►'], ['CAPTAIN', 'STEER INTO THE LIGHT', 'MOVE LEFT / RIGHT']];
DUO.DEMOS.du_lighthouse = [t => demo(0, t), t => demo(1, t)];

})();
