'use strict';
/* ═════════ SQUAD · LA BUSETA (sq_buseta), 3-4 players, one role each ═════════
   A Caracas minibus (yellow, a rooster on the roof) has to reach the terminal with enough paying passengers before the clock runs out.
   Everybody is in the same bus but only ONE seat sees each part of the road:
   n = 4:  DRIVER (0, JUDGE)  steers between 3 lanes (mouse / A D / tap) and BRAKES (hold Space / the pedal). He only sees the road right in front of
                               the bumper (the far road is smog) plus whatever the others flag. Owns the position, the speed and the HULL.
           LOOKOUT (1)        stands in the roof hatch and sees the far road: potholes, stalled cars, speed bumps and the cop. Taps a lane = flags the
                               next hazard there (it shows up on every screen with its icon, so the driver knows whether to swerve or to slow down).
           CONDUCTOR (2)      sees the far bus stops. Rings the bell (¡PARADA!) = the driver sees the stop and can brake for it. Once the bus is
                               stopped he taps the passengers to charge each fare before they lose patience.
           DOOR HELPER (3)    holds the door open while the bus is still (hold). Passengers only board through an open door, and the driver cannot
                               pull away while the door is open: driver and helper have to agree.
   n = 3:  the DOOR HELPER is gone, the CONDUCTOR's passengers board by themselves once the bus is stopped.
   Win = reach the terminal with NEED fares and a bus that still has a hull. Lose = hull gone, time up, or the quota missed.
   Same level whatever n / role (all draws from mkR() in the constructor, always the same number of them).
   Netcode: every role owns its variables, the others render them:
     DRIVER    'sh' [p, lane*100, v*100, hull] (coalesced <=10/s), 'hit' {i, hull}
     LOOKOUT   'flag' {i}                    (hazard i is flagged)
     CONDUCTOR 'call' {k}                    (stop k is called), 'fare' {k, i, ok} (passenger i of stop k paid (1) or was lost (0))
     DOOR      'door' 0|1                    (coalesced)
   The driver (judge) counts the fares from the conductor's messages and sends the verdict ('end', via wire). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
let CS = 13; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;          // cosmetic randomness: never touches the seeded level
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ───────────── layout (800×600). The road runs away from the bus (BUSY) towards the top; the far road is squeezed (perspective) ───────────── */
const LX = [300, 400, 500], BUSY = 466, VTOP = 92, RANGE = 900, SONAR = 120, ZH = 100;
const HWL = [30, 40, 18, 26];                              // hazard kinds: 0 pothole, 1 stalled car, 2 speed bump, 3 cop checkpoint: half length (world px)
const WIN = [72, 84, 36, 46];                              // how close (world px, bus centre to hazard centre) the bus touches it
const DMGH = [1, 2, 1, 2], THR = [0, 0, .55, .4];         // damage; bump / cop only hurt above this speed
const HULL = 5, NEED = 7, PAT = 1.4, ACC = 2.0, DECB = 2.6, RDY0 = .08, RDYS = .32;
const DEF = ['#FFE14D', '#6EA8FE', '#ff7aa8', '#7CE38B'];
const ROOF = '#ffd23f', ROOF2 = '#d99a12', PAXC = ['#ff8a5c', '#b69cff', '#6ec6ff', '#8be28b', '#ff7aa8', '#ffb347'];
const BLD = ['#ff8a5c', '#ffd23f', '#6ec6ff', '#ff7aa8', '#8be28b', '#c9a0ff', '#e9a46b'];
const proj = dw => {
  if (dw <= 0) return { y: BUSY - dw, s: 1 };
  const k = Math.min(1.3, dw / RANGE);
  return { y: BUSY - (BUSY - VTOP) * Math.pow(k, .72), s: 1 - .5 * Math.min(1, k) };
};

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tube(pts, w, col) { line(pts, w + 6, INK); line(pts, w, col); }
function glint(x, y, rx, ry, rot = -.4, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function poly(pts) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); }
function tag(x, y, label, col, size = 12, maxW = 62) {
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
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(200, X.measureText(t(s)).width) + 26, h = size * 1.5;
  X.save(); X.translate(x, y); X.scale(sc, sc);
  X.beginPath(); X.moveTo(-8, -18); X.lineTo(2, 0); X.lineTo(10, -18); X.closePath(); ink('#fff', 3);
  rr(-w / 2, -18 - h, w, h, h * .45); ink('#fff', 3);
  X.fillStyle = '#fff'; X.fillRect(-6, -21, 15, 6);
  txt(s, 0, -18 - h / 2 + 2, size, INK, 'center', 200); X.restore();
}
function keyCap(x, y, label) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.max(26, X.measureText(t(label)).width + 16);
  rr(x - w / 2, y - 11, w, 22, 6); ink('#fff', 2.5); txt(label, x, y + 1, 15, INK, 'center', w - 6);
}
function plate(cx, y, w, h, face, base, label, key, down, grey) {
  const x = cx - w / 2, d = grey || down ? 3 : 9, fy = y + 9 - d;
  rr(x, y + 9, w, h, 20); ink(grey ? '#8f88a6' : base, 4);
  rr(x, fy, w, h, 20); ink(grey ? '#d3cfe0' : face, 4);
  X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 14, fy + 6, w - 28, h * .16, 6); X.fill();
  const hasKey = key && !TOUCH;
  txt(label, cx, fy + h / 2 - (hasKey ? 8 : 0), 22, grey ? '#f6f4fb' : '#fff', 'center', w * .86);
  if (hasKey) keyCap(cx, fy + h - 12, key);
}
function sweat(x, y, T, k) { const a = (T * 1.6 + k) % 1; X.globalAlpha = 1 - a * a; el(x, y + a * 14, 3, 4.5); ink('#9fe3ff', 2); X.globalAlpha = 1; }
function heart(x, y, s, col) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink(col || '#ff5c8a', 3); glint(-6, -9, 3, 2, -.6, .6); X.restore();
}

/* ───────────── the bus: seen from behind and above (nose up). o: { tilt, doorK, crew [{col, mood}], spin, hull, n, hatch, smoke, wheel } ───────────── */
function wheelsAt(x, y, s, o) { for (const [wx, wy] of [[-44, -40], [44, -40], [-44, 42], [44, 42]]) { rr(x + wx * s - 7 * s, y + wy * s - 15 * s, 14 * s, 30 * s, 5 * s); ink('#2a2436', 3); } }
function drawBus(x, y, s, T, o) {
  const crew = o.crew, n4 = o.n === 4, dk = o.doorK || 0;
  X.save(); X.translate(x, y); X.rotate(o.tilt || 0); X.scale(s, s);
  for (const [wx, wy] of [[-44, -40], [44, -40], [-44, 42], [44, 42]]) {
    rr(wx - 7, wy - 15, 14, 30, 5); ink('#2a2436', 3);
    X.fillStyle = '#6a6486'; const o2 = ((o.spin || 0) * 3 + wy) % 10; for (let q = -1; q < 3; q++) X.fillRect(wx - 6, wy - 14 + q * 10 + o2, 12, 3);
  }
  // the body
  cel(ROOF, ROOF2, () => rr(-40, -68, 80, 136, 18), 6, 8, 4.5);
  X.save(); rr(-40, -68, 80, 136, 18); X.clip();
  X.fillStyle = '#2f7bd6'; X.fillRect(-42, -2, 84, 10); X.fillStyle = '#e8434f'; X.fillRect(-42, 8, 84, 10);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-34, -64, 7, 126);
  X.restore();
  rr(-40, -68, 80, 136, 18); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
  // windshield + route board
  rr(-33, -63, 66, 17, 6); ink('#9fe3ff', 3); glint(-14, -58, 14, 3, -.15, .7);
  rr(-24, -84, 48, 17, 5); ink('#fffdf5', 3); txt('CATIA', 0, -75, 12, INK, 'center', 42);
  // roof hatch (lookout) and rear rack (sacks + a rooster)
  rr(-17, -36, 34, 28, 7); ink('#7a5a40', 3);
  rr(-27, 24, 54, 34, 5); ink('#c98443', 3); X.fillStyle = '#e6c58c'; for (const [qx, qy] of [[-18, 34], [-2, 40], [14, 34]]) { rr(qx - 9, qy - 8, 18, 16, 5); ink('#f1d9a8', 2.5); }
  const hop = o.hop || 0;
  el(-12 + 0, 28 - hop * 9, 7, 6); ink('#fff', 2.5); el(-5, 24 - hop * 9, 3.4, 3.4); ink('#fff', 2); poly([[-3, 21 - hop * 9], [-1, 17 - hop * 9], [-5, 19 - hop * 9]]); ink('#e8434f', 1.5);
  if (o.shades) { rr(-9, 22 - hop * 9, 9, 3.4, 1.5); ink(INK, 1); }
  // the door on the right flank (slides open)
  X.save(); rr(34, 10, 14, 50, 4); X.fillStyle = '#2a2436'; X.fill(); X.strokeStyle = INK; X.lineWidth = 3.5; X.stroke(); rr(37, 38, 12, 20, 4); ink('#fff1a8', 2); X.restore();
  rr(33, 10 + dk * 32, 8, 50 - dk * 32, 3); ink('#fff1a8', 3);
  // the crew
  const drv = crew[0], look = crew[1], cob = crew[2], door = crew[3];
  if (drv) { caos(-15, -37, 1.35, { col: drv.col, mood: drv.mood }); X.beginPath(); X.arc(-15, -29, 7, 0, TAU); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.6; X.strokeStyle = '#c9ced6'; X.stroke(); }
  if (look) { caos(0, -11 - (o.hatch || 0) * 3, 1.7, { col: look.col, mood: look.mood }); rr(-8, -29, 7, 10, 2); ink('#3b3550', 2); rr(1, -29, 7, 10, 2); ink('#3b3550', 2); }
  if (cob) { caos(54, 8, 1.55, { col: cob.col, mood: cob.mood }); rr(59, -6 - (o.cash || 0) * 3, 12, 7, 2); ink('#6fd47a', 2); }
  if (door && n4) { caos(55, 52, 1.35, { col: door.col, mood: door.mood }); line([[44, 18], [44, 62]], 4, '#c9ced6'); }
  // smoke (breakdown)
  if (o.smoke > 0) for (let i = 0; i < 4; i++) { const k = (T * .9 + i / 4) % 1; X.globalAlpha = (1 - k) * .85 * o.smoke; X.beginPath(); X.arc(-4 + Math.sin(T * 5 + i) * 10, -78 - k * 60, 9 + k * 16, 0, TAU); ink('#8a8498', 3); X.globalAlpha = 1; }
  X.restore();
}

/* ───────────── things on the road ───────────── */
function warnTri(x, y, s, fill) { X.save(); X.translate(x, y); X.scale(s, s); poly([[0, -14], [14, 10], [-14, 10]]); ink(fill || '#ff4d5e', 3); txt('!', 0, 2, 13, '#fff'); X.restore(); }
function pothole(x, y, s, T) {
  X.save(); X.translate(x, y); X.scale(s, s);
  el(0, 0, 38, 17); ink('#8b8aa0', 3.5); el(1, 2, 28, 11); ink('#1f1b2e', 3); el(-6, -1, 10, 4); X.fillStyle = '#3b3550'; X.fill();
  for (const [a, b] of [[-36, -4, -52, -12], [34, 2, 52, 8], [-12, 15, -20, 26]]) { }
  line([[-36, -4], [-52, -12]], 3, INK); line([[34, 2], [52, 8]], 3, INK);
  el(14, -4, 6, 3); X.fillStyle = 'rgba(159,227,255,.7)'; X.fill();                // a puddle
  X.restore();
}
function carTop(x, y, s, T, c) {                           // a stalled car seen from above, hood up, hazard triangle behind, a driver in despair
  X.save(); X.translate(x, y); X.scale(s, s);
  warnTri(0, 46, .9, '#ff4d5e');
  cel(c, mixShade(c), () => rr(-27, -42, 54, 82, 14), 5, 6, 4);
  rr(-20, -34, 40, 18, 6); ink('#9fe3ff', 2.5); rr(-20, 10, 40, 16, 6); ink('#9fe3ff', 2.5);
  rr(-23, -48, 46, 26, 6); ink('#c9ced6', 3);                                       // the open hood
  const sm = (T * .8) % 1; X.globalAlpha = 1 - sm; X.beginPath(); X.arc(Math.sin(T * 4) * 6, -58 - sm * 30, 8 + sm * 10, 0, TAU); ink('#8a8498', 2.5); X.globalAlpha = 1;
  caos(-44, 28, 1.3, { col: '#ff8a5c', mood: 'sad' });
  X.restore();
}
function mixShade(c) { const n = parseInt(c.slice(1), 16); const r = (n >> 16) * .72 | 0, gg = (n >> 8 & 255) * .72 | 0, b = (n & 255) * .72 | 0; return '#' + [r, gg, b].map(v => v.toString(16).padStart(2, '0')).join(''); }
function bumpTop(x, y, s) {                                 // a yellow-and-black speed bump across the whole road
  X.save(); X.translate(x, y); X.scale(s, 1);
  rr(-156, -9, 312, 18, 8); ink('#ffd23f', 3.5);
  X.save(); rr(-156, -9, 312, 18, 8); X.clip(); X.fillStyle = '#2a2436'; for (let q = -160; q < 160; q += 38) { poly([[q, -9], [q + 18, -9], [q + 6, 9], [q - 12, 9]]); X.fill(); } X.restore();
  X.restore();
}
function copTop(x, y, s, T) {                               // the traffic cop: a whistle, a STOP paddle and a row of cones
  X.save(); X.translate(x, y); X.scale(s, s);
  for (const cx of [-132, -92, 92, 132]) { poly([[cx - 11, 6], [cx + 11, 6], [cx + 5, -20], [cx - 5, -20]]); ink('#ff8a3d', 3); rr(cx - 12, 6, 24, 7, 3); ink('#fff', 2); }
  rr(-26, -6, 52, 12, 5); ink('#2f7bd6', 3);
  caos(0, 12, 1.9, { col: '#3b6fe0', mood: null });
  rr(-12, -34, 24, 8, 3); ink('#1f3f9a', 2.5); rr(-9, -40, 18, 8, 4); ink('#2f7bd6', 2.5);   // the cap
  const w = Math.sin(T * 9) * .12; X.save(); X.translate(30, -8); X.rotate(w);
  line([[0, 14], [0, -2]], 4, '#c9a36a'); poly([[-9, -8], [0, -17], [9, -8], [9, 2], [0, 11], [-9, 2]].map(([a, b]) => [a, b - 6])); ink('#e8434f', 3); txt('STOP', 0, -8, 9, '#fff', 'center', 20);
  X.restore();
  X.restore();
}
function hazardSprite(h, x, y, s, T) {
  if (h.kind === 0) pothole(x, y, s, T); else if (h.kind === 1) carTop(x, y, s, T, ['#6ec6ff', '#ff7aa8', '#8be28b', '#c9a0ff'][Math.floor(h.seed * 4) % 4]);
  else if (h.kind === 2) bumpTop(400, y, s); else copTop(400, y, s, T);
}
function glyph(kind, x, y) {                                // the little icon in a warning sign
  X.save(); X.translate(x, y);
  if (kind === 0) { el(0, 1, 7, 4); X.fillStyle = '#3b3550'; X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.stroke(); }
  else if (kind === 1) { rr(-5, -7, 10, 14, 3); ink('#6ec6ff', 1.5); }
  else if (kind === 2) { rr(-8, -2, 16, 5, 2); ink('#ffd23f', 1.5); }
  else { star(0, 0, 8, 3.5, 5, -Math.PI / 2, '#ffd23f', 1.6); }
  X.restore();
}
function warnSign(x, y, kind, T) {                           // a red triangle on a pole with the hazard's icon: the lookout's work, as everybody sees it
  const b = Math.abs(Math.sin(T * 8)) * 3;
  line([[x, y + 4], [x, y - 28]], 4, INK); line([[x, y + 4], [x, y - 28]], 2, '#e9edf5');
  X.save(); X.translate(x, y - 40 - b); poly([[0, -20], [21, 14], [-21, 14]]); ink('#ff4d5e', 3.5); X.fillStyle = '#fff'; poly([[0, -11], [12, 9], [-12, 9]]); X.fill(); glyph(kind, 0, 2); X.restore();
}

/* a stop sign + the queue. o: {called, near} */
function stopSign(x, y, s, T, called) {
  X.save(); X.translate(x, y); X.scale(s, s);
  el(0, 10, 18, 6); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  line([[0, 8], [0, -58]], 5, INK); line([[0, 8], [0, -58]], 2, '#c9ced6');
  X.save(); X.translate(0, -66); X.rotate(Math.sin(T * 2 + x) * .04);
  rr(-27, -16, 54, 30, 8); ink(called ? '#3fb260' : '#2f7bd6', 3.5); X.fillStyle = 'rgba(255,255,255,.35)'; rr(-21, -12, 42, 5, 2.5); X.fill();
  txt('BUS STOP', 0, 1, 13, '#fff', 'center', 48);
  X.restore();
  X.restore();
}
function paxDraw(x, y, s, T, col, k, mood, o) {
  X.save(); X.translate(x, y); X.scale(s, s);
  caos(0, 0, 1.45, { col, mood });
  if (k % 3 === 0) { rr(-14, -2, 9, 11, 3); ink('#c98443', 2); }                              // a bag
  else if (k % 3 === 1) { X.beginPath(); X.arc(10, -18, 14, Math.PI, 0); X.closePath(); ink(PAXC[(k + 2) % 6], 2.5); line([[10, -18], [10, -2]], 2, INK); }   // an umbrella
  else { X.beginPath(); X.arc(12, -4, 6, 0, TAU); ink('#f1d9a8', 2); X.fillStyle = '#ffd23f'; el(12, -4, 3, 2); X.fill(); }                                // an arepa
  X.restore();
}

/* ───────────── background (baked, per viewport width) ───────────── */
let BGC = null;
function buildBg() {
  const w = VW, h = 140, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const old = X; X = cv.getContext('2d');
  const ox = OX;
  let g = X.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6fc3f0'); g.addColorStop(.7, '#ffe6b8'); g.addColorStop(1, '#ffd9a0'); X.fillStyle = g; X.fillRect(0, 0, w, h);
  X.beginPath(); X.arc(ox + 690, 40, 24, 0, TAU); ink('#fff3a0', 3); glint(ox + 683, 33, 8, 4, -.5, .7);
  // the Avila: a long green ridge behind the city
  X.beginPath(); X.moveTo(0, h); X.lineTo(0, 74); for (let x = 0; x <= w; x += 40) X.lineTo(x, 50 + Math.sin(x * .012 + 1) * 18 + Math.sin(x * .031) * 8); X.lineTo(w, h); X.closePath(); X.fillStyle = '#3f8f8a'; X.fill();
  X.beginPath(); X.moveTo(0, h); X.lineTo(0, 92); for (let x = 0; x <= w; x += 40) X.lineTo(x, 80 + Math.sin(x * .02 + 3) * 10); X.lineTo(w, h); X.closePath(); X.fillStyle = '#5fb3a5'; X.fill();
  // ranchos stacked on the hill: little coloured boxes with zinc roofs
  for (let i = 0; i < w / 26; i++) { const bx = i * 26 + hash(i) * 10, by = 92 + hash(i + 30) * 34, c = BLD[Math.floor(hash(i + 7) * BLD.length)]; X.fillStyle = c; X.fillRect(bx, by, 20, 14); X.fillStyle = '#9aa0b4'; X.fillRect(bx - 1, by - 3, 22, 4); X.strokeStyle = 'rgba(20,16,28,.5)'; X.lineWidth = 1.5; X.strokeRect(bx, by, 20, 14); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, h - 2); X.lineTo(w, h - 2); X.stroke();
  X = old; return cv;
}
function building(side, wp0, wp1, ox0, ox1, col, P, hs) {
  const a = proj(wp0 - P), b = proj(wp1 - P); if (a.y < VTOP - 4 && b.y < VTOP - 4) return;
  const x = (o, s) => 400 + side * o * s;
  poly([[x(ox0, a.s), a.y], [x(ox1, a.s), a.y], [x(ox1, b.s), b.y], [x(ox0, b.s), b.y]]); ink(col, Math.max(1.5, 3.5 * a.s));
  poly([[x(ox0, a.s), a.y], [x(ox0 + 16, a.s), a.y], [x(ox0 + 16, b.s), b.y], [x(ox0, b.s), b.y]]); X.fillStyle = 'rgba(20,16,28,.22)'; X.fill();
  X.fillStyle = 'rgba(255,255,255,.55)'; for (let q = 0; q < 3; q++) { const k = (q + .5) / 3, yy = lerp(a.y, b.y, k), ss = lerp(a.s, b.s, k); X.fillRect(x(ox0 + 3, ss) - (side > 0 ? 0 : 6 * ss), yy - 3 * ss, 6 * ss, 5 * ss); }
  if (hs > .55) { X.fillStyle = '#9aa0b4'; poly([[x(ox0 + 40, a.s), lerp(a.y, b.y, .2)], [x(ox1 - 8, a.s * .98), lerp(a.y, b.y, .2)], [x(ox1 - 8, b.s), lerp(a.y, b.y, .8)], [x(ox0 + 40, b.s), lerp(a.y, b.y, .8)]]); X.fill(); }
}
function billboard(x, y, s, T) {                             // a billboard for arepas, with a steaming one
  X.save(); X.translate(x, y); X.scale(s, s);
  line([[-24, 6], [-24, -42]], 5, INK); line([[24, 6], [24, -42]], 5, INK);
  rr(-46, -78, 92, 50, 7); ink('#e8434f', 3.5);
  X.beginPath(); X.arc(-16, -53, 17, 0, TAU); ink('#f1c36a', 3); X.fillStyle = '#ffe9a8'; el(-20, -58, 6, 3, -.4); X.fill();
  txt('AREPAS', 18, -53, 12, '#fff', 'center', 38);
  const k = (T * .8) % 1; X.globalAlpha = 1 - k; X.beginPath(); X.arc(-16 + Math.sin(T * 3) * 3, -76 - k * 14, 5 + k * 5, 0, TAU); ink('#fff', 2); X.globalAlpha = 1;
  X.restore();
}

/* ═════════ the game ═════════ */
function buseta(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 3 ? 3 : 4, role = D.role, TS = Math.sqrt(sp);
  const isDrv = role === 0, isLook = role === 1, isCob = role === 2, isDoor = n === 4 && role === 3;
  const ROLEN = n === 4 ? ['DRIVER', 'LOOKOUT', 'FARE COLLECTOR', 'DOOR HELPER'] : ['DRIVER', 'LOOKOUT', 'FARE COLLECTOR'];
  /* the level: the same on every screen, always the same number of draws. 7 hazards and 3 stops (3 passengers each) along the route */
  const SEQ = ['h', 'h', 's', 'h', 'h', 's', 'h', 'h', 's', 'h'], BASE = [0, 1, 2, 0, 3, 1, 0], shift = Math.floor(R() * 7);
  const HZ = [], ST = []; let pp = 820, hk = 0;
  for (let e = 0; e < SEQ.length; e++) {
    const rl = R(), rg = R(), rf = R();
    if (e) pp += 330 + rg * 90 + (SEQ[e] === 's' || SEQ[e - 1] === 's' ? 110 : 0);
    if (SEQ[e] === 'h') { const kind = BASE[(hk + shift) % 7], lane = Math.floor(rl * 3); HZ.push({ i: hk++, p: pp, kind, lane, mask: kind >= 2 ? [0, 1, 2] : [lane], flag: false, flagAt: -9, hit: false, hitAt: -9, seed: rf }); }
    else ST.push({ k: ST.length, p: pp, m: 3, called: false, calledAt: -9, acc: 0, seed: rf });
  }
  let nb = HZ.filter(h => h.kind < 2 && h.lane === 1).length;      // an idle driver (middle lane) must not survive: bend lane hazards into the middle
  for (const h of HZ) if (nb < 3 && h.kind < 2 && h.lane !== 1) { h.lane = 1; h.mask = [1]; nb++; }
  const LEN = pp + 560, SPD = LEN / 6.9;
  const roosterDay = R() < 1 / 8;                                    // 1 round in 8: the rooster wears sunglasses
  /* state */
  const pT = track(), laneT = track(), vT = track(), doorT = track(), PX = ST.map(s => Array.from({ length: s.m }, (_, i) => ({ st: 0, at: -9, ra: 0, rdyAt: -9 }))), parts = [], pops = [];
  let p = 0, v = 0, lanePos = 1, laneTgt = 1, hull = HULL, hullV = HULL, inv = 0, hurtFlash = 0, hitAt = -9, shAt = -9, lastSh = '', kBrk = false, pBrk = false, doorIn = false;
  let doorHeld = false, doorK = 0, doorSent = -1, buzzAt = -9, flagAt2 = -9, callAt = -9, cashAt = -9, arrivedAt = -1, resAt = -1, ending = null, ptr = null, wheel = 0, lastDir = 0;
  const col = r => (D.byRole && D.byRole[r] && D.byRole[r].color) || DEF[r];
  const nameOf = r => r === role ? 'YOU' : ((D.byRole && D.byRole[r] && D.byRole[r].name) || 'P' + (r + 1)).slice(0, 7);
  const pv = () => ending && ending.res === 'win' ? LEN : isDrv ? p : (pT.at() === null ? 0 : pT.at());
  const laneV = () => isDrv ? lanePos : (laneT.at() === null ? 1 : laneT.at() / 100);
  const vV = () => isDrv ? v : (vT.at() === null ? 0 : vT.at() / 100);
  const doorV = () => isDoor ? doorHeld && doorK > .5 : (doorT.at() === null ? false : doorT.at() > .5);
  const faresN = () => PX.reduce((a, r) => a + r.filter(q => q.st === 2).length, 0);
  const doneN = k => PX[k].filter(q => q.st >= 2).length;
  const stopHere = P => ST.find(s => Math.abs(P - s.p) <= ZH);
  const laneOfX = x => clamp(Math.round((x - LX[0]) / 100), 0, 2);
  const pop = (s, x, y, size, bgc, fg, rot) => { pops.length = 0; pops.push({ s, x, y, t0: g.c, size, bgc, fg, rot: rot !== undefined ? rot : (cr() - .5) * .14 }); };
  const addP = (x, y, vx, vy, life, c, r) => { if (parts.length < 90) parts.push({ x, y, vx, vy, life, t0: g.c, c, r }); };
  const coinFx = (x, y) => { for (let i = 0; i < 7; i++) addP(x, y, (cr() - .5) * 220, -160 - cr() * 160, .8, '#ffd23f', 4 + cr() * 3); };
  const sendFare = (k, i, ok) => { const q = PX[k][i]; q.st = ok ? 2 : 3; q.at = g.c; D.send('fare', { k, i, ok: ok ? 1 : 0 }); };
  const paxPos = (k, i, P) => { const s = ST[k], pr = proj(s.p + (i - 1) * 40 - 6 - P); return { x: 400 + (206 + (i % 2) * 36) * pr.s, y: pr.y, s: pr.s }; };
  const near = h => h.p - pv() < SONAR && h.p - pv() > -150;
  const g = {
    c: 0, dur: 18, pts: 0,
    cmd: isDrv ? 'DRIVE!' : isLook ? 'SPOT!' : isCob ? 'COLLECT!' : 'DOOR!',
    roleLabel: ROLEN[role],
    hint: isDrv ? 'MOVE THE MOUSE (OR A / D) TO CHANGE LANE - HOLD SPACE (OR THE PEDAL) TO BRAKE - YOUR LOOKOUT AND FARE COLLECTOR WARN YOU'
      : isLook ? 'ONLY YOU SEE THE FAR ROAD - CLICK A LANE (OR KEYS 1 2 3) TO FLAG THE NEXT HAZARD THERE'
      : isCob? (n === 3 ? 'CLICK THE BELL (OR B) TO CALL A STOP - CLICK EACH PASSENGER (OR SPACE) TO CHARGE THE FARE BEFORE THEY GIVE UP'
          : 'CLICK THE BELL (OR B) TO CALL A STOP - CLICK EACH PASSENGER (OR SPACE) TO CHARGE THE FARE, THE DOOR MUST BE OPEN')
      : 'HOLD CLICK / SPACE TO KEEP THE DOOR OPEN WHILE THE BUS IS STOPPED - LET GO SO THE DRIVER CAN GO',
    thint: isDrv ? 'TAP A LANE TO CHANGE LANE - HOLD THE PEDAL TO BRAKE - YOUR LOOKOUT AND FARE COLLECTOR WARN YOU'
      : isLook ? 'ONLY YOU SEE THE FAR ROAD - TAP A LANE TO FLAG THE NEXT HAZARD THERE'
      : isCob? (n === 3 ? 'TAP THE BELL TO CALL A STOP - TAP EACH PASSENGER TO CHARGE THE FARE BEFORE THEY GIVE UP'
          : 'TAP THE BELL TO CALL A STOP - TAP EACH PASSENGER TO CHARGE THE FARE, THE DOOR MUST BE OPEN')
      : 'HOLD TO KEEP THE DOOR OPEN WHILE THE BUS IS STOPPED - LET GO SO THE DRIVER CAN GO',
    update(dt) {
      g.c += dt; const wd = dt * TS;
      inv = Math.max(0, inv - dt); hurtFlash = Math.max(0, hurtFlash - dt * 3);
      hullV += (hull - hullV) * Math.min(1, dt * 10);
      if (g.result && resAt < 0) onResult();
      const Pn = pv(), vn = vV(), still = vn < .14;
      wheel += wd * vn * 14;
      const dtgt = doorV() ? 1 : 0; doorK += clamp(dtgt - doorK, -dt * 6, dt * 6);
      if (isDrv) {
        lanePos += clamp(laneTgt - lanePos, -7 * TS * dt, 7 * TS * dt);
        if (!g.result) {
          const brk = kBrk || pBrk;
          if (brk) v = Math.max(0, v - DECB * wd); else if (n === 4 && doorIn) v = Math.max(0, v - DECB * .5 * wd); else v = Math.min(1, v + ACC * wd);
          p += SPD * TS * v * dt;
          for (const h of HZ) {
            if (h.hit || inv > 0) continue;
            const dx = Math.abs(h.p - p); if (dx >= WIN[h.kind]) continue;
            if (h.kind < 2 ? !h.mask.some(l => Math.abs(lanePos - l) < .62) : v <= THR[h.kind]) continue;
            h.hit = true; hull = Math.max(0, hull - DMGH[h.kind]); inv = .7; hitAt = g.c; hurtFlash = 1; D.send('hit', { i: h.i, hull }); onHit(h);
          }
          if (hull <= 0) g.finish('lose');
          else if (p >= LEN) {
            p = LEN; if (arrivedAt < 0) arrivedAt = g.c;
            if (faresN() >= NEED) { ending = { res: 'win' }; g.finish('win'); } else if (g.c - arrivedAt > .7) g.finish('lose');
          } else if (g.c >= g.limit) g.finish('lose');
        }
        if (g.c - shAt >= .1) { const sh = [Math.round(p), Math.round(lanePos * 100), Math.round(v * 100), hull]; if (sh.join() !== lastSh || g.result) { lastSh = sh.join(); shAt = g.c; D.send('sh', sh, true); } }
      }
      if (isDoor) {
        const open = doorHeld && still && !g.result;
        const want = open ? 1 : 0; if (want !== doorSent) { doorSent = want; D.send('door', want, true); }
        if (doorHeld && !still && g.c - buzzAt > .6) { buzzAt = g.c; sfx.buzz(); pop('NOT WHILE MOVING!', 400, 250, 20, '#8f88a6', '#fff'); }
      }
      if (isCob && !g.result) {
        const open = n === 3 || doorIn;
        for (const s of ST) {
          const inZ = Math.abs(Pn - s.p) <= ZH;
          if (open && inZ && still) s.acc += wd;
          for (let i = 0; i < s.m; i++) {
            const q = PX[s.k][i];
            if (q.st === 0 && s.acc >= RDY0 + RDYS * i) { q.st = 1; q.ra = s.acc; q.rdyAt = g.c; sfx.pop(); }
            else if (q.st === 1 && s.acc >= q.ra + PAT) { sendFare(s.k, i, false); sfx.miss(); pop('TOO LATE!', 400, 250, 20, '#e8434f', '#fff'); }
          }
          if (Pn > s.p + ZH + 10) for (let i = 0; i < s.m; i++) if (PX[s.k][i].st < 2) sendFare(s.k, i, false);
        }
      }
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (g.c - q.t0 > q.life) parts.splice(i, 1); }
    },
    msg(ty, d, from) {
      if (ty === 'sh') { pT.push(d[0]); laneT.push(d[1]); vT.push(d[2]); if (!isDrv) hull = d[3]; }
      else if (ty === 'hit') { const h = HZ[d.i]; if (h && !h.hit) { h.hit = true; hull = d.hull; hurtFlash = 1; hitAt = g.c; onHit(h); } }
      else if (ty === 'flag') { const h = HZ[d.i]; if (h && !h.flag) { h.flag = true; h.flagAt = g.c; if (!isLook) { snd(1180, .09, 'square', .05); snd(880, .12, 'square', .05, .09); pop('WATCH OUT!', 400, 200, 20, '#e8434f', '#fff', -.04); } } }
      else if (ty === 'call') { const s = ST[d.k]; if (s && !s.called) { s.called = true; s.calledAt = g.c; if (!isCob) { snd(1320, .1, 'triangle', .06); snd(1760, .18, 'triangle', .06, .1); pop('STOP AHEAD!', 400, 200, 20, '#2f7bd6', '#fff', .04); } } }
      else if (ty === 'fare') { const q = PX[d.k] && PX[d.k][d.i]; if (q && q.st < 2) { q.st = d.ok ? 2 : 3; q.at = g.c; if (!isCob && d.ok) { sfx.coin(); cashAt = g.c; } } }
      else if (ty === 'door') { doorT.push(d ? 1 : 0); doorIn = !!d; }
    },
    /* ── actions (also what the bots call) ── */
    setLane(l) { if (isDrv && !g.result) laneTgt = clamp(l, 0, 2); },
    brake(on) { if (isDrv && !g.result) pBrk = !!on; },
    flag(lane) {                                             // lookout: flag the nearest unflagged hazard in this lane
      if (!isLook || g.result) return; flagAt2 = g.c;
      const P = pv(); let best = null;
      for (const h of HZ) if (!h.hit && !h.flag && h.mask.includes(lane) && h.p - P > 60 && h.p - P < RANGE - 10 && (!best || h.p < best.p)) best = h;
      if (!best) { sfx.tick(); pop('NOTHING THERE', 400, 200, 18, '#7a5040', '#fff'); return; }
      best.flag = true; best.flagAt = g.c; D.send('flag', { i: best.i }); sfx.coin(); snd(1480, .08, 'square', .04); ring(400, proj(best.p - P).y, '#ff4d5e', 60, .35);
    },
    call() {                                                 // conductor: ring the bell for the nearest uncalled stop in view
      if (!isCob || g.result) return; callAt = g.c; const P = pv(); let best = null;
      for (const s of ST) if (!s.called && s.p - P > 60 && s.p - P < RANGE - 10 && (!best || s.p < best.p)) best = s;
      if (!best) { sfx.tick(); pop('NO STOP IN SIGHT', 400, 200, 18, '#7a5040', '#fff'); return; }
      best.called = true; best.calledAt = g.c; D.send('call', { k: best.k }); sfx.coin(); snd(1320, .1, 'triangle', .06); snd(1760, .18, 'triangle', .06, .1);
    },
    collect(x, y) {                                          // conductor: charge the nearest passenger that is ready to pay (or the oldest one, with no point)
      if (!isCob || g.result) return; const P = pv(); let best = null, bd = 1e9;
      for (const s of ST) for (let i = 0; i < s.m; i++) {
        const q = PX[s.k][i]; if (q.st !== 1) continue;
        let d = q.rdyAt; if (x !== undefined) { const pp2 = paxPos(s.k, i, P); d = Math.hypot(pp2.x - x, pp2.y - 14 - y); if (d > 90) continue; }
        if (!best || d < bd) { best = { k: s.k, i }; bd = d; }
      }
      if (!best) { sfx.tick(); return; }
      sendFare(best.k, best.i, true); cashAt = g.c; sfx.coin(); sfx.sparkle && 0; snd(1568, .08, 'square', .04);
      const pp2 = paxPos(best.k, best.i, P); coinFx(pp2.x, pp2.y - 20); pop('PAID!', clamp(pp2.x, 130, 670), pp2.y - 70, 22, '#3fae5a', '#fff');
    },
    door(on) { if (isDoor && !g.result) doorHeld = !!on; },
    draw() { drawFrame(); },
    down(pt) {
      if (g.result) return; ptr = pt;
      if (isDrv) { if (pt.x > 620 && pt.y > 486) pBrk = true; else g_lane(pt.x); }
      else if (isLook) g.flag(laneOfX(pt.x));
      else if (isCob) { if (pt.x < 230 && pt.y > 486) g.call(); else g.collect(pt.x, pt.y); }
      else if (isDoor) doorHeld = true;
    },
    move(pt) { ptr = pt; if (g.result) return; if (isDrv && !pBrk && !(pt.x > 620 && pt.y > 486)) g_lane(pt.x); },
    up() { pBrk = false; if (isDoor) doorHeld = false; },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return; if (g.result) return;
      const dig = /^(?:Digit|Numpad)([1-3])$/.exec(c), lane = dig ? +dig[1] - 1 : c === 'ArrowLeft' ? 0 : c === 'ArrowDown' ? 1 : c === 'ArrowRight' ? 2 : -1;
      if (isDrv) {
        if (e.repeat) return;
        if (c === 'KeyA' || c === 'ArrowLeft') laneTgt = clamp(Math.round(laneTgt) - 1, 0, 2); else if (c === 'KeyD' || c === 'ArrowRight') laneTgt = clamp(Math.round(laneTgt) + 1, 0, 2);
        else if (dig) laneTgt = lane; else if (c === 'Space' || c === 'ArrowDown' || c === 'KeyS' || c === 'Enter') kBrk = true;
      } else if (isLook) { if (!e.repeat && (dig || c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowDown' || c === 'KeyA' || c === 'KeyS' || c === 'KeyD')) g.flag(dig || c.startsWith('Arrow') ? lane : c === 'KeyA' ? 0 : c === 'KeyS' ? 1 : 2); }
      else if (isCob) { if (e.repeat) return; if (c === 'KeyB' || c === 'ArrowUp' || c === 'KeyP') g.call(); else if (c === 'Space' || c === 'Enter' || c === 'KeyJ' || c === 'KeyE') g.collect(); }
      else if (isDoor) { if (c === 'Space' || c === 'Enter' || c === 'KeyE' || c === 'ArrowDown') doorHeld = true; }
    },
    keyup(e) {
      const c = e.code;
      if (isDrv && (c === 'Space' || c === 'ArrowDown' || c === 'KeyS' || c === 'Enter')) kBrk = false;
      if (isDoor && (c === 'Space' || c === 'Enter' || c === 'KeyE' || c === 'ArrowDown')) doorHeld = false;
    },
  };
  function g_lane(x) { laneTgt = laneOfX(x); }
  function onHit(h) {
    shake(h.kind === 1 ? 9 : 6, .22); sfx.thud(); sfx.miss(); burst(400, BUSY - 20, '#fff', 10); ring(laneX(), BUSY, '#ff4d5e', 70);
    pop(h.kind === 0 ? 'CLUNK!' : h.kind === 1 ? 'SMASH!' : h.kind === 2 ? 'BOING!' : 'FINED!', 400, 210, 24, '#e8434f', '#fff');
    for (let i = 0; i < 6; i++) addP(laneX() + (cr() - .5) * 40, BUSY - 30, (cr() - .5) * 200, -120 - cr() * 100, .8, '#fff', 3 + cr() * 3);
  }
  function laneX() { return lerp(LX[0], LX[2], laneV() / 2); }
  function onResult() {
    resAt = g.c; if (!ending) ending = { res: g.result };
    if (g.result === 'win') { snd(523, .12, 'square', .05); snd(659, .12, 'square', .05, .12); snd(784, .12, 'square', .05, .24); snd(1047, .3, 'square', .06, .36); for (let i = 0; i < 24; i++) addP(laneX() + (cr() - .5) * 60, BUSY - 40, (cr() - .5) * 420, -300 - cr() * 260, 1.2, ['#ffd23f', '#e8434f', '#2f7bd6', '#fff'][i % 4], 4 + cr() * 3); }
    else { [[233, .26, 0], [220, .26, .3], [208, .26, .6], [196, .9, .9]].forEach(([f, d, w], i) => { snd(f, d, 'sawtooth', .06, w, i === 3 ? f * .85 : f); snd(f * 1.005, d, 'square', .02, w); }); }
  }

  /* ───────────── drawing ───────────── */
  function lineQuad(P, wp0, wp1, ox, w, fill) {
    const a = proj(wp0 - P), b = proj(wp1 - P);
    poly([[400 + ox * a.s - w * a.s / 2, a.y], [400 + ox * a.s + w * a.s / 2, a.y], [400 + ox * b.s + w * b.s / 2, b.y], [400 + ox * b.s - w * b.s / 2, b.y]]); X.fillStyle = fill; X.fill();
  }
  function drawWorld(P, T) {
    X = ctx; const top = proj(RANGE * 1.05).y;
    // ground and the baked horizon
    X.fillStyle = '#d8c6a4'; X.fillRect(-OX, 0, VW, H);
    if (!BGC || BGC.width !== VW) BGC = buildBg(); X.drawImage(BGC, -OX, 0);
    // road: curb, asphalt
    const pts = n2 => { const a = []; a.push(-140); for (let q = 0; q <= 24; q++) a.push(RANGE * 1.04 * q / 24); return a; };
    const dws = pts(), edge = hw => { const L = dws.map(d => { const r = proj(d); return [400 - hw * r.s, r.y]; }), Rr = dws.map(d => { const r = proj(d); return [400 + hw * r.s, r.y]; }).reverse(); return L.concat(Rr); };
    poly(edge(182)); ink('#f4ead6', 4); poly(edge(166)); X.fillStyle = '#5a5672'; X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
    X.save(); poly(edge(166)); X.clip();
    X.fillStyle = 'rgba(255,255,255,.05)'; for (let q = Math.floor((P - 140) / 90) * 90; q < P + RANGE * 1.05; q += 180) { const a = proj(q - P), b = proj(q + 90 - P); X.fillRect(0, b.y, 800, a.y - b.y); }
    for (const ox of [-50, 50]) for (let q = Math.floor((P - 140) / 140) * 140; q < P + RANGE * 1.05; q += 140) lineQuad(P, q, q + 64, ox, 6, '#fff3b0');
    X.restore();
    // buildings and billboards, far to near
    const j0 = Math.floor((P - 160) / 240), j1 = j0 + Math.ceil((RANGE * 1.05 + 320) / 240);
    for (let j = j1; j >= j0; j--) {
      for (let side = -1; side <= 1; side += 2) for (let c = 0; c < 3; c++) {
        const h0 = hash(j * 7 + side * 3 + c * 13), ox0 = (side < 0 ? 190 : 300) + c * 150, wp0 = j * 240 + 10, wp1 = wp0 + 200 - h0 * 40;
        building(side, wp0, wp1, ox0, ox0 + 138, BLD[Math.floor(hash(j * 3 + c + side * 5) * BLD.length)], P, hash(j + c));
      }
      if (hash(j * 11 + 5) > .86) { const r = proj(j * 240 + 120 - P); if (r.y > VTOP) billboard(400 - 196 * r.s, r.y, r.s * 1.1, T); }
    }
    // the terminal gate
    { const dw = LEN - P; if (dw < RANGE * 1.05 && dw > -200) terminal(dw, T); }
  }
  function terminal(dw, T) {
    const r = proj(dw), s = r.s; X.save(); X.translate(0, 0);
    const y0 = r.y, w = 172 * s;
    rr(400 - w, y0 - 8 * s, w * 2, 12 * s, 4); X.fillStyle = '#fff'; X.fill(); X.fillStyle = INK; for (let q = 0; q < 14; q++) if (q & 1) X.fillRect(400 - w + q * w * 2 / 14, y0 - 8 * s, w * 2 / 14, 6 * s);
    for (const sx of [-1, 1]) { rr(400 + sx * w - 7 * s, y0 - 100 * s, 14 * s, 104 * s, 4 * s); ink('#e9edf5', 3.5 * Math.max(.5, s)); }
    rr(400 - w - 6 * s, y0 - 130 * s, w * 2 + 12 * s, 40 * s, 10 * s); ink('#2f7bd6', 4 * Math.max(.5, s));
    txt('TERMINAL', 400, y0 - 110 * s, Math.max(10, 26 * s), '#fff', 'center', w * 1.8);
    for (let q = 0; q < 9; q++) { const bx = 400 - w + q * w * 2 / 8, sw = Math.sin(T * 5 + q) * 2 * s; poly([[bx - 6 * s, y0 - 88 * s], [bx + 6 * s, y0 - 88 * s], [bx + sw, y0 - 72 * s]]); ink(['#ffd23f', '#2f7bd6', '#e8434f'][q % 3], 2 * Math.max(.5, s)); }
    X.restore();
  }
  function drawFrame() {
    X = ctx; const T = g.c, P = pv(), lv = laneV(), vn = vV(), won = ending && ending.res === 'win' || g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? g.c - resAt : -1;
    drawWorld(P, T);
    const bx = lerp(LX[0], LX[2], lv / 2), seeHz = h => isLook || h.flag || near(h), seeSt = s => isCob || s.called || (s.p - P < SONAR && s.p - P > -ZH * 2);
    const items = [];
    for (const h of HZ) { const dw = h.p - P; if (dw < RANGE * 1.04 && dw > -200 && !(h.hit && h.kind < 2 && dw < -60)) if (seeHz(h)) items.push({ dw, h }); }
    for (const s of ST) { const dw = s.p - P; if (dw < RANGE * 1.04 && dw > -240 && seeSt(s)) items.push({ dw, s }); }
    items.sort((a, b) => b.dw - a.dw);
    const drawItem = it => {
      const r = proj(it.dw);
      if (it.h) {
        const h = it.h, x = 400 + (LX[h.lane] - 400) * r.s;
        if (h.hit && h.kind < 2) { X.globalAlpha = .6; }
        hazardSprite(h, h.kind < 2 ? x : 400, r.y, r.s, T); X.globalAlpha = 1;
      } else {
        const s = it.s, z0 = proj(s.p - ZH - P), z1 = proj(s.p + ZH - P);
        if (s.called || it.dw < SONAR) {                    // the painted bus-stop box on the road
          poly([[400 - 150 * z0.s, z0.y], [400 + 150 * z0.s, z0.y], [400 + 150 * z1.s, z1.y], [400 - 150 * z1.s, z1.y]]); X.fillStyle = s.called ? 'rgba(92,255,122,.28)' : 'rgba(255,255,255,.18)'; X.fill(); X.strokeStyle = s.called ? '#5CFF7A' : '#fff'; X.lineWidth = Math.max(2, 5 * r.s); X.setLineDash([14 * r.s, 10 * r.s]); X.stroke(); X.setLineDash([]);
          if (r.s > .62) txt('BUS STOP', 400, r.y, 26 * r.s, '#fff', 'center', 150);
        }
        stopSign(400 + 176 * r.s, r.y, r.s * 1.1, T, s.called);
        for (let i = 0; i < s.m; i++) {
          const q = PX[s.k][i], pp2 = paxPos(s.k, i, P); let x = pp2.x, y = pp2.y, sc = pp2.s * 1.1, a = 1;
          if (q.st === 2) { const k = clamp((g.c - q.at) / .45, 0, 1); x = lerp(x, bx + 46, ease(k)); y = lerp(y, BUSY + 20, ease(k)); a = 1 - k; if (k >= 1) continue; }
          else if (q.st === 3) { const k = clamp((g.c - q.at) / .9, 0, 1); x += k * 90 * pp2.s; a = 1 - k * k; if (k >= 1) continue; }
          X.globalAlpha = a; shadow(x, y + 2, 12 * sc, 4 * sc, .25);
          paxDraw(x, y, sc, T, PAXC[(s.k * 3 + i) % 6], s.k * 3 + i, q.st === 3 ? 'sad' : q.st === 2 ? 'happy' : null); X.globalAlpha = 1;
          if (isCob && q.st === 1 && !g.result) {                          // the fare coin and the patience ring
            const left = clamp(1 - (s.acc - q.ra) / PAT, 0, 1), pul = .5 + .5 * Math.sin(T * 12);
            X.beginPath(); X.arc(x, y - 52 * sc, 16, 0, TAU); ink('#ffd23f', 3); txt('$', x, y - 51 * sc, 17, INK);
            X.beginPath(); X.arc(x, y - 52 * sc, 22 + pul * 2, -Math.PI / 2, -Math.PI / 2 + TAU * left); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = left < .35 ? '#ff4d5e' : '#5CFF7A'; X.stroke();
          }
        }
      }
    };
    for (const it of items) if (it.dw > 0) drawItem(it);
    // the bus
    drawBusMe(T, P, lv, vn, won, lost, rk, bx);
    for (const it of items) if (it.dw <= 0) drawItem(it);
    // smog: only the lookout and the conductor see far; for the driver and the helper the far road is a haze
    { const fy = proj(SONAR).y, a = (isLook || isCob) ? .32 : .92;
      const gr = X.createLinearGradient(0, fy + 14, 0, fy - 70); gr.addColorStop(0, 'rgba(206,196,176,0)'); gr.addColorStop(1, `rgba(206,196,176,${a})`);
      X.fillStyle = gr; X.fillRect(-OX, VTOP - 40, VW, fy - VTOP + 54);
      if (!(isLook || isCob) && !g.result) { X.save(); X.globalAlpha = .5; for (let i = 0; i < 3; i++) txt('?', LX[i] + Math.sin(T * 2 + i) * 4, fy - 40 - (i & 1) * 22 + Math.sin(T * 1.5 + i * 2) * 4, 30, '#7a6a52'); X.restore(); }
      // flagged hazards and called stops come through the smog
      for (const h of HZ) if (h.flag && !h.hit && !near(h) && h.p - P > 0 && h.p - P < RANGE * 1.04) { const r = proj(h.p - P); if (!(isLook)) { hazardSprite(h, h.kind < 2 ? 400 + (LX[h.lane] - 400) * r.s : 400, r.y, r.s, T); } warnSign(h.kind < 2 ? 400 + (LX[h.lane] - 400) * r.s : 400 - 130 * r.s, r.y, h.kind, T); }
      for (const h of HZ) if (h.flag && !h.hit && near(h) && h.p - P > 0) { const r = proj(h.p - P); warnSign(h.kind < 2 ? 400 + (LX[h.lane] - 400) * r.s : 400 - 130 * r.s, r.y, h.kind, T); }
      for (const s of ST) if (s.called && s.p - P > SONAR && s.p - P < RANGE * 1.04 && !isCob) { const r = proj(s.p - P); drawItem({ dw: s.p - P, s }); }
    }
    for (const q of parts) { const a = (g.c - q.t0) / q.life; X.globalAlpha = clamp(1 - a, 0, 1); X.beginPath(); X.arc(q.x, q.y, q.r, 0, TAU); ink(q.c, 2); X.globalAlpha = 1; }
    if (won && rk >= 0) winShow(rk, T, bx);
    if (lost && rk >= 0) loseShow(rk, T, bx);
    drawBoard(T, P);
    if (isLook) lookFrame(T);
    drawControls(T, P);
    for (const q of pops) { const a = g.c - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 130, 670), q.y - Math.min(a, .6) * 14, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
    vignette(.15);
  }
  function drawBusMe(T, P, lv, vn, won, lost, rk, bx) {
    let by = BUSY, tilt = clamp((laneTgt - lanePos) * .1, -.12, .12);
    if (!isDrv) { const lt = laneT.at(); tilt = 0; }
    const jolt = g.c - hitAt < .3 ? Math.sin((g.c - hitAt) * 60) * 3 : 0, flash = inv > 0 && isDrv && Math.floor(g.c * 16) % 2 === 0;
    if (won && rk >= 0) by -= Math.abs(Math.sin(rk * 9)) * 6;
    const mood = r => won ? 'happy' : lost ? 'sad' : (r === 0 && hurtFlash > .3) ? 'sad' : null;
    const crew = [0, 1, 2, 3].slice(0, n).map(r => ({ col: col(r), mood: mood(r) }));
    X.save(); if (flash) X.globalAlpha = .6;
    X.fillStyle = 'rgba(20,16,28,.28)'; el(bx + 6, by + 10, 52, 74); X.fill();
    drawBus(bx + jolt, by + (lost && rk >= 0 ? Math.min(rk, .4) * 10 : 0), 1, T, { crew, n, tilt, doorK, spin: wheel, hatch: g.c - flagAt2 < .3 ? 1 : 0, cash: g.c - cashAt < .25 ? 1 : 0, hop: won && rk >= 0 ? Math.abs(Math.sin(rk * 12)) : roosterHop(T), shades: roosterDay, smoke: lost && rk >= 0 ? clamp(rk / .5, 0, 1) : hull <= 2 ? .5 : 0 });
    X.restore();
    if (!g.result || rk < .5) { const xs = n === 4 ? [-78, -26, 26, 78] : [-52, 0, 52]; for (let r = 0; r < n; r++) tag(bx + xs[r], by + 86, nameOf(r), col(r), 12, 58); }
    if (isDrv && hullV < HULL) for (let k = 0; k < HULL - Math.round(hullV) && k < 4; k++) { const cx = [-24, 20, -8, 26][k], cy = [-4, 12, 36, -30][k]; X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(bx + cx, by + cy); X.lineTo(bx + cx + 6, by + cy + 8); X.lineTo(bx + cx + 1, by + cy + 14); X.stroke(); }
  }
  function roosterHop(T) { return Math.max(0, Math.sin(T * 3.1)) * .5; }
  /* the route board (left sidewalk): hull tyres, fares, route */
  function drawBoard(T, P) {
    const x = 12, y = 68, w = 172, h = 138;
    line([[x + 24, y - 8], [x + 24, y + 6]], 4, '#e6c58c'); line([[x + w - 24, y - 8], [x + w - 24, y + 6]], 4, '#e6c58c');
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 7, w, h, 12); X.fill();
    rr(x, y, w, h, 12); ink('#d9944f', 4); X.fillStyle = '#c98443'; for (let i = 0; i < 4; i++) { rr(x + 8, y + 14 + i * 30, w - 16, 2.5, 1); X.fill(); }
    txt('ROUTE 7', x + w / 2, y + 16, 15, '#fff', 'center', w - 20);
    for (let i = 0; i < HULL; i++) { const on = i < Math.round(hullV + .4) || i < hull, cx = x + 24 + i * 31, cy = y + 48; X.beginPath(); X.arc(cx, cy, 12, 0, TAU); ink(on ? '#2a2436' : '#b8b4c8', 3); X.beginPath(); X.arc(cx, cy, 5, 0, TAU); ink(on ? '#c9ced6' : '#e9e6f2', 2); }
    const got = faresN(); for (let i = 0; i < NEED; i++) { const cx = x + 22 + i * 21, cy = y + 80; X.beginPath(); X.arc(cx, cy, 8.5, 0, TAU); ink(i < got ? '#ffd23f' : '#ece7f3', 2.5); if (i >= got) { X.setLineDash([3, 3]); X.strokeStyle = '#b9b2cc'; X.lineWidth = 1.5; X.beginPath(); X.arc(cx, cy, 5, 0, TAU); X.stroke(); X.setLineDash([]); } }
    const bx0 = x + 20, bw = w - 44, by0 = y + 112, kk = clamp(P / LEN, 0, 1);
    line([[bx0, by0], [bx0 + bw, by0]], 8, INK); line([[bx0, by0], [bx0 + bw, by0]], 4, '#fff1c9');
    for (const s of ST) { X.beginPath(); X.arc(bx0 + s.p / LEN * bw, by0, 4.5, 0, TAU); ink(doneN(s.k) >= s.m ? '#3fb260' : s.called ? '#2f7bd6' : '#e8434f', 2); }
    rr(bx0 + bw + 4, by0 - 8, 14, 16, 3); ink('#2f7bd6', 2.5);
    rr(bx0 + kk * bw - 8, by0 - 12, 16, 10, 4); ink(ROOF, 2.5);
  }
  function lookFrame(T) {                                  // binoculars: dark corners and lane chips
    X.save(); X.globalAlpha = .5; for (const [cx, cy] of [[-40, 90], [840, 90]]) { X.beginPath(); X.arc(cx, cy, 120, 0, TAU); X.fillStyle = INK; X.fill(); } X.restore();
  }
  function drawControls(T, P) {
    const touch = TOUCH;
    if (isDrv) { plate(700, 490, 150, 46, g.result ? '#d3cfe0' : '#ff4d5e', '#b8283a', 'BRAKE', 'SPACE', kBrk || pBrk, !!g.result); }
    else if (isCob) { plate(120, 490, 190, 46, g.result ? '#d3cfe0' : '#ffd23f', '#c99512', 'BELL', 'B', g.c - callAt < .15, !!g.result); }
    else if (isDoor) { const open = doorHeld && vV() < .14; plate(400, 490, 230, 46, g.result ? '#d3cfe0' : open ? '#5CFF7A' : '#4fd06a', open ? '#23a046' : '#24803a', open ? 'OPEN!' : 'HOLD DOOR', 'SPACE', open || doorHeld, !!g.result); }
    else {
      for (let i = 0; i < 3; i++) { const y = 504, x = LX[i]; rr(x - 36, y, 72, 36, 12); ink(g.c - flagAt2 < .15 ? '#fff' : '#ffd23f', 3); txt(String(i + 1), x, y + 19, 22, INK); }
    }
  }
  function winShow(rk, T, bx) {
    for (let i = 0; i < 5; i++) { const q = (T * 1.1 + i / 5) % 1; X.globalAlpha = Math.sin(q * Math.PI); heart(bx - 60 + i * 30, BUSY - 40 - q * 120, .9, '#ff5c8a'); X.globalAlpha = 1; }
    for (let i = 0; i < 4; i++) { const a = T * 6 + i * TAU / 4; star(bx + Math.cos(a) * 60, BUSY - 100 + Math.sin(a) * 14, 8, 3.5, 5, a, '#FFE14D', 2.5); }
    badge('WE MADE IT!', 400, 190, 30, '#3fae5a', '#fff', rk < .25 ? outBack(rk / .25) : 1, -.05);
  }
  function loseShow(rk, T, bx) {
    // a wheel rolls off to the right and a lady with curlers scolds the whole bus
    const k = clamp(rk / 1.4, 0, 1), wx = bx + 60 + k * 260, wy = BUSY + 40 - Math.sin(k * Math.PI) * 30 + k * 30;
    if (k < 1) { X.save(); X.translate(wx, wy); X.rotate(k * 18); X.beginPath(); X.arc(0, 0, 14, 0, TAU); ink('#2a2436', 3); X.beginPath(); X.arc(0, 0, 5, 0, TAU); ink('#c9ced6', 2); X.restore(); }
    const bk = clamp((rk - .3) / .25, 0, 1);
    if (bk > 0) { const sx = 668, sy = 330; shadow(sx, sy + 2, 24, 7, .25); caos(sx, sy, 2.4, { col: '#ff7aa8', mood: 'sad' }); rr(sx - 16, sy - 40, 32, 9, 4); ink('#b69cff', 2.5); bubble('WHAT IS THIS?!', sx - 10, sy - 70, 18, outBack(bk)); }
    if (rk > .5) badge('BROKEN DOWN!', 400, 190, 28, '#e8434f', '#fff', rk < .75 ? outBack((rk - .5) / .25) : 1, .05);
  }
  /* ───── views for the bots (only what that seat's screen shows) ───── */
  g.dbg = {
    LEN, SPD: SPD * TS, DEC: DECB * TS, ACC: ACC * TS, HZ, ST, PX, NEED, ZH, WIN, THR, RANGE, SONAR, n, role, TS,
    drvView: () => { const P = p; return { p, v, lane: lanePos, tgt: laneTgt, doorIn, hull,
      hz: HZ.filter(h => !h.hit && (h.flag || h.p - P < SONAR) && h.p - P > -WIN[h.kind] - 10).map(h => ({ i: h.i, dx: h.p - P, kind: h.kind, mask: h.mask, flag: h.flag })),
      st: ST.filter(s => (s.called || s.p - P < SONAR) && s.p - P > -ZH - 20).map(s => ({ k: s.k, dx: s.p - P, m: s.m, done: doneN(s.k) })) }; },
    lookView: () => { const P = pv(); return { p: P, hz: HZ.filter(h => !h.hit && !h.flag && h.p - P > 60 && h.p - P < RANGE - 10).map(h => ({ i: h.i, dx: h.p - P, mask: h.mask, kind: h.kind })) }; },
    cobView: () => { const P = pv(); return { p: P, v: vV(), stops: ST.filter(s => !s.called && s.p - P > 60 && s.p - P < RANGE - 10).map(s => ({ k: s.k, dx: s.p - P })),
      ready: ST.flatMap(s => PX[s.k].map((q, i) => ({ q, i, s })).filter(o => o.q.st === 1).map(o => { const pp2 = paxPos(o.s.k, o.i, P); return { k: o.s.k, i: o.i, x: pp2.x, y: pp2.y - 12, age: g.c - o.q.rdyAt }; })) }; },
    doorView: () => { const P = pv(), s = stopHere(P); return { v: vV(), still: vV() < .12, pending: !!s && doneN(s.k) < s.m, held: doorHeld }; },
  };
  wire(g, D, 0, sp, 'sq_buseta');
  return g;
}
reg('sq_buseta', buseta, 'LA BUSETA'); REGMAP.sq_buseta.duo = true; REGMAP.sq_buseta.squad = true;

/* ───────────── intro card: what each role does (520×240 frame, loops) ───────────── */
function dRoad(T, k) {
  X = ctx; X.fillStyle = '#d8c6a4'; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#5a5672'; X.fillRect(150, 0, 220, 240); X.fillStyle = '#f4ead6'; X.fillRect(144, 0, 8, 240); X.fillRect(368, 0, 8, 240);
  X.fillStyle = '#fff3b0'; for (const lx of [223, 297]) for (let y = -60 + (T * 130) % 120; y < 240; y += 120) X.fillRect(lx - 3, y, 6, 56);
  X.fillStyle = INK; X.fillRect(150, 0, 3, 240); X.fillRect(367, 0, 3, 240);
  for (const [bx, by, c] of [[20, 20, '#ff8a5c'], [24, 110, '#6ec6ff'], [420, 40, '#ffd23f'], [430, 140, '#ff7aa8']]) { rr(bx, (by + T * 60) % 300 - 40, 76, 70, 8); ink(c, 3.5); }
}
function dBus(x, y, T, crew, o) { drawBus(x, y, .75, T, Object.assign({ crew, n: 4, spin: T * 6 }, o || {})); }
function dDriver(T) {
  dRoad(T); const u = T % 4, lane = u < 1.2 ? 1 : u < 2.4 ? 0 : 1, bx = [260, 190, 260][lane === 0 ? 1 : 0] + 0, k = ease(clamp((u - 1.0) / .3, 0, 1)) - ease(clamp((u - 2.5) / .3, 0, 1));
  const x = lerp(260, 190, k), hy = 60 + ((u * 120) % 340) - 40;
  if (u < 2.4) pothole(260, 40 + u * 90 - 20, .9, T);
  dBus(x, 170, T, [{ col: DEF[0], mood: k > .5 ? 'happy' : null }, { col: DEF[1] }, { col: DEF[2] }, { col: DEF[3] }]);
  demoFinger(190, 215, u > .9 && u < 1.5, (u - .9) * 1.6); badge(k > .5 ? 'PHEW!' : 'DODGE!', 400, 40, 18, '#2a82c4', '#fff', 1, -.03);
}
function dLook(T) {
  dRoad(T); const u = T % 3.6, fl = u > 1.3;
  carTop(300, 60 + (u * 40) % 100 * 0, .8, T, '#6ec6ff'); if (fl) warnSign(300, 62, 1, T);
  dBus(260, 190, T, [{ col: DEF[0] }, { col: DEF[1], mood: fl ? 'happy' : null }, { col: DEF[2] }, { col: DEF[3] }], { hatch: fl ? 1 : 0 });
  demoFinger(300, 150, u > 1.1 && u < 1.6, (u - 1.1) * 2); badge(fl ? 'WATCH OUT!' : 'FLAG IT!', 420, 30, 18, fl ? '#e8434f' : '#7a5040', '#fff', 1, -.03);
}
function dCob(T) {
  dRoad(T); const u = T % 4, got = clamp(Math.floor((u - .6) / .8), 0, 3);
  stopSign(410, 80, 1.1, T, true);
  for (let i = 0; i < 3; i++) { if (i < got) continue; paxDraw(420 + (i % 2) * 36, 110 + i * 34, 1.1, T, PAXC[i], i, null); if (i === got && u > .5) { X.beginPath(); X.arc(420 + (i % 2) * 36, 60 + i * 34, 14, 0, TAU); ink('#ffd23f', 3); txt('$', 420 + (i % 2) * 36, 61 + i * 34, 15, INK); } }
  dBus(250, 170, T, [{ col: DEF[0] }, { col: DEF[1] }, { col: DEF[2], mood: got >= 3 ? 'happy' : null }, { col: DEF[3] }]);
  demoFinger(420 + (got % 2) * 36, 115 + got * 34, (u - .6) % .8 < .3 && got < 3, ((u - .6) % .8) * 3); badge(got >= 3 ? 'PAID!' : 'COLLECT!', 130, 40, 18, '#3fae5a', '#fff', 1, -.03);
}
function dDoor(T) {
  dRoad(T); const u = T % 3.6, open = u > .5 && u < 2.8;
  for (let i = 0; i < 3; i++) { const k = clamp((u - .8 - i * .5) / .5, 0, 1); if (open) paxDraw(lerp(430, 300, ease(k)), lerp(170 + i * 12, 190, ease(k)), 1.1, T, PAXC[i], i, null); else if (u < .5) paxDraw(430, 170 + i * 12, 1.1, T, PAXC[i], i, null); }
  dBus(250, 170, T, [{ col: DEF[0] }, { col: DEF[1] }, { col: DEF[2] }, { col: DEF[3], mood: open ? 'happy' : null }], { doorK: open ? 1 : 0 });
  demoFinger(120, 190, open, 0); badge(open ? 'HOLD!' : 'DONE!', 120, 40, 18, '#24803a', '#fff', 1, -.03);
}
DUO.INFO.sq_buseta = n => n === 4
  ? [['DRIVER', 'STEER AND BRAKE THE BUS', 'MOUSE / A D + SPACE BRAKES'], ['LOOKOUT', 'SPOT HAZARDS AND FLAG THEM', 'CLICK A LANE / KEYS 1 2 3'], ['FARE COLLECTOR', 'CALL STOPS AND CHARGE FARES', 'CLICK BELL (B) + PASSENGERS'], ['DOOR HELPER', 'HOLD THE DOOR WHILE THEY BOARD', 'HOLD CLICK / SPACE']]
  : [['DRIVER', 'STEER AND BRAKE THE BUS', 'MOUSE / A D + SPACE BRAKES'], ['LOOKOUT', 'SPOT HAZARDS AND FLAG THEM', 'CLICK A LANE / KEYS 1 2 3'], ['FARE COLLECTOR', 'CALL STOPS AND CHARGE FARES', 'CLICK BELL (B) + PASSENGERS']];
DUO.DEMOS.sq_buseta = n => n === 4 ? [dDriver, dLook, dCob, dDoor] : [dDriver, dLook, dCob];
})();
