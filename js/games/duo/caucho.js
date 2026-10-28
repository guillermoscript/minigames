'use strict';
/* ═════════ DUO · CAMBIO DE CAUCHO (du_caucho): a flat tire on the autopista Caracas - La Guaira ═════════
   A yellow old-timer with a flat, the spare already on the hub, trucks thundering past. Two people, one wheel.
   JACK (role 0, JUDGE): works the scissor jack. HOLD (pointer anywhere / space / up) = crank, RELEASE = the jack leaks and the car sinks.
   Sees the HEIGHT gauge (green band = the working height, red above = danger) and the bubble LEVEL (wobble), and how many nuts are tight,
   but NOT which nut comes next. Too high or too wobbly = the car falls off the jack. When the wheel is on: let go and lower it.
   LUGS (role 1): sees a magnifier of the hub with the 5 nuts numbered in star order. Taps them 1 to 5 (keys 1-5), but a nut only turns while
   the car hangs at the working height (lamp on the magnifier: green = go, red = too high, grey = too low). Every tightened nut shakes the car and
   sinks it a little, a wrong nut shakes it hard, so the jack has to keep pumping between taps. Neither can see the other's screen: each reads
   the other's effect in the world.
   Win: 5 nuts tight in order and the car back on the ground. Lose: the car drops (wobble full) or time runs out. Gag: the spare pops off and
   rolls into the zanja, a motorcyclist stops: "tranquilo, pana".
   Netcode: the JACK owns h (height) and wobble and publishes 'h' [h*1000, wobble*1000] (coalesced, latest, repeated every .4 s). The LUGS owns the
   nuts and publishes absolute counters 'n' [tight, wrong, slips] (repeated every .4 s); the jack applies the deltas (settling, wobble) and judges. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only

/* ───────────── tuning ───────────── */
const NN = 5, LO = .5, HI = .8;                         // nuts to tighten; working band of the car height (0..1)
const LIFTR = .55, SINK = .3, SINK2 = .5, SETTLE = .045; // lift / leak / lowering speed per second, height lost per tightened nut
const WDEC = .3, WRISE = 5, TRUCKJ = .2;                 // wobble: decay per second, rise factor above the band, jolt from a passing truck
const GY = 476, HX = 200, HYC = GY - 62, LIFTPX = 60;    // ground line, rear hub x, hub y with the car on the ground, pixels of lift at h = 1
const JX = 300;                                          // the jack's x
const MC = { x: 628, y: 205, r: 118 }, NR = 66, NHIT = 36;   // the lugs' magnifier and its nut ring
const GAUGE = { x: 724, y: 96, w: 40, h: 230 };
const DITCH = 690;                                       // x where the shoulder ends and the zanja begins
const nutAng = p => -Math.PI / 2 + p * TAU / 5;

/* ───────────── drawing kit (X is ctx while playing, an offscreen context while the backdrop is baked) ───────────── */
let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function circ2(x, y, r, fill, o = 3) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(170, X.measureText(t(label)).width + 24);
  X.beginPath(); X.moveTo(x - 8, y + 11); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 11); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(330, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 330); X.restore();
}
function plate(r, col, dk, down, glow, T) {
  const d = down ? 3 : 8;
  rr(r.x, r.y + 8, r.w, r.h, 16); ink(dk, 4);
  rr(r.x, r.y + 8 - d, r.w, r.h, 16); ink(col, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(r.x + 8, r.y + 12 - d, r.w - 16, 8, 4); X.fill();
  if (glow) { X.globalAlpha = .55 + .4 * Math.sin(T * 10); X.strokeStyle = '#fff'; X.lineWidth = 4; rr(r.x + 6, r.y + 14 - d, r.w - 12, r.h - 12, 12); X.stroke(); X.globalAlpha = 1; }
  return 8 - d;
}
function hex(x, y, r, rot, fill, o = 2.5) { X.beginPath(); for (let i = 0; i < 6; i++) { const a = rot + i * TAU / 6; i ? X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : X.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); }
function arm(u, sx, an, k, col) {            // blocky arm at a caos's shoulder (translate to feet first)
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
}
function bubble(x, y, w, h, tailX) {
  X.beginPath(); X.moveTo(tailX - 12, y + h - 4); X.lineTo(tailX, y + h + 22); X.lineTo(tailX + 12, y + h - 4); X.closePath(); ink('#fff', 3);
  rr(x - w / 2, y, w, h, 18); ink('#fff', 4);
}

/* ───────────── props ───────────── */
function tire(x, y, R, spin, nutsOn) {
  X.save(); X.translate(x, y); X.rotate(spin);
  circ2(0, 0, R, '#3b3550', 4.5);
  X.strokeStyle = 'rgba(255,255,255,.14)'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; X.beginPath(); X.arc(0, 0, R - 6, a, a + .2); X.stroke(); }
  circ2(0, 0, R * .62, '#c9ced6', 3.5); X.fillStyle = 'rgba(255,255,255,.55)'; el(-R * .2, -R * .26, R * .22, R * .1, -.6); X.fill();
  circ2(0, 0, R * .2, '#9ba3b4', 3);
  if (nutsOn) for (let p = 0; p < 5; p++) hex(Math.cos(nutAng(p)) * R * .33, Math.sin(nutAng(p)) * R * .33, R * .085, 0, '#8e98ad', 2);
  X.restore();
}
function carPath() {
  X.beginPath(); X.moveTo(-150, 34); X.lineTo(-152, -30); X.quadraticCurveTo(-152, -50, -134, -53); X.lineTo(-84, -58); X.lineTo(-52, -104); X.quadraticCurveTo(-48, -112, -38, -112);
  X.lineTo(66, -112); X.quadraticCurveTo(76, -112, 82, -104); X.lineTo(122, -60); X.lineTo(232, -52); X.quadraticCurveTo(256, -50, 258, -26); X.lineTo(258, 34); X.closePath();
}
function carBody() {                                     // car frame: the rear hub is (0, 0), the car faces right
  carPath(); ink('#ffd23f', 5);
  X.save(); carPath(); X.clip();
  X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(-160, 8, 430, 40); X.fillStyle = 'rgba(255,255,255,.32)'; X.fillRect(-160, -58, 430, 6);
  X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(-140, -40, 8, 60);
  for (const wx of [0, 190]) { el(wx, 0, 72, 72); X.fillStyle = '#2a2535'; X.fill(); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); }
  X.restore();
  X.beginPath(); X.moveTo(-70, -62); X.lineTo(-44, -102); X.lineTo(-8, -102); X.lineTo(-8, -62); X.closePath(); ink('#bfeaff', 3);
  X.beginPath(); X.moveTo(6, -62); X.lineTo(6, -102); X.lineTo(60, -102); X.lineTo(108, -62); X.closePath(); ink('#bfeaff', 3);
  X.fillStyle = 'rgba(255,255,255,.5)'; X.beginPath(); X.moveTo(14, -98); X.lineTo(30, -98); X.lineTo(10, -66); X.lineTo(10, -78); X.closePath(); X.fill();
  line([[-2, -56], [-2, 26]], 2.5, 'rgba(20,16,28,.5)'); rr(10, -48, 22, 7, 3); ink('#eef0f4', 2);
  rr(-150, -34, 7, 18, 3); ink('#e8434f', 2.5); el(251, -24, 6, 9); ink('#fff3a0', 2.5);
  rr(-164, 16, 22, 24, 6); ink('#d9dfe8', 3); rr(246, 18, 22, 22, 6); ink('#d9dfe8', 3);
  rr(-34, -126, 56, 16, 5); ink('#fff', 3); txt('LIBRE', -6, -118, 11, INK, 'center', 48);   // taxi lamp on the roof
}
function jackDraw(h, T, pumping, tilt) {                 // the scissor jack: world coords, base on the ground
  const under = HYC + 34 - h * LIFTPX, bot = GY - 8, s = Math.max(14, bot - under), l = 52, w = Math.sqrt(Math.max(30, l * l - (s / 2) * (s / 2))), mid = (under + bot) / 2;
  rr(JX - 38, bot, 76, 9, 3); ink('#8a8fa3', 3);
  const crk = pumping ? Math.sin(T * 15) * 12 : 0;
  line([[JX - w, mid], [JX + w, mid]], 5, '#b8bfcc');
  line([[JX + w, mid], [JX + w + 34, mid + crk], [JX + w + 40, mid + crk + 12]], 5, '#e8434f');
  line([[JX, under], [JX - w, mid], [JX, bot]], 7, '#ff9a4d'); line([[JX, under], [JX + w, mid], [JX, bot]], 7, '#ff7a1a');
  circ2(JX - w, mid, 5, '#d9dfe8', 2); circ2(JX + w, mid, 5, '#d9dfe8', 2);
  rr(JX - 24, under - 7, 48, 10, 4); ink('#8a8fa3', 3);
}
function tanker(x, T) {                                   // a cisterna thundering past in the far lane
  X.save(); X.translate(x, 436);
  rr(-190, -92, 210, 76, 38); ink('#eef0f4', 4); X.fillStyle = 'rgba(20,16,28,.16)'; rr(-190, -48, 210, 32, 30); X.fill();
  X.fillStyle = '#e8434f'; X.fillRect(-150, -62, 130, 10);
  rr(22, -70, 62, 54, 8); ink('#2f6fd6', 4); rr(52, -62, 26, 22, 4); ink('#bfeaff', 2.5); rr(-196, -22, 290, 12, 4); ink('#5a5470', 3);
  for (const wx of [-150, -110, 30, 66]) { X.save(); X.translate(wx, -4); X.rotate(T * 12); circ2(0, 0, 16, '#3b3550', 3.5); X.fillStyle = '#c9ced6'; X.fillRect(-2, -10, 4, 20); X.fillRect(-10, -2, 20, 4); X.restore(); }
  X.restore();
}
function farCar(x, col) {
  X.save(); X.translate(x, 420); rr(-44, -26, 88, 24, 8); ink(col, 3.5); rr(-24, -42, 46, 22, 8); ink(col, 3.5); rr(-18, -38, 16, 13, 3); ink('#bfeaff', 2); rr(2, -38, 16, 13, 3); ink('#bfeaff', 2);
  for (const wx of [-26, 26]) circ2(wx, 0, 9, '#3b3550', 3); X.restore();
}
function moto(x, y, T, col) {                             // y = ground; the rider is a Caos with a helmet
  X.save(); X.translate(x, y);
  for (const wx of [-34, 34]) { X.save(); X.translate(wx, -18); X.rotate(T * 14 * (wx > 0 ? 1 : 1)); circ2(0, 0, 18, '#3b3550', 3.5); X.fillStyle = '#c9ced6'; X.fillRect(-2, -12, 4, 24); X.fillRect(-12, -2, 24, 4); X.restore(); }
  line([[-34, -18], [-8, -34], [18, -34], [34, -18]], 7, '#5a5470'); line([[18, -34], [30, -52]], 5, '#8a8fa3');
  rr(-14, -52, 36, 18, 8); ink(col, 3); rr(-34, -44, 26, 9, 4); ink('#2a2535', 3);
  caos(-8, -36, 2.5, { col: '#ff9a4d' });
  el(-8, -64, 15, 13); ink('#e8434f', 3.5); X.fillStyle = '#bfeaff'; rr(-4, -68, 14, 8, 3); X.fill(); X.fillStyle = 'rgba(255,255,255,.5)'; el(-14, -70, 4, 3, -.5); X.fill();
  X.restore();
}

/* ───────────── backdrop (baked once): autopista Caracas - La Guaira ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  const gr = X.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(.6, '#8fdcff'); gr.addColorStop(1, '#fff0c8'); X.fillStyle = gr; X.fillRect(0, 0, W, 340);
  circ2(690, 70, 28, '#ffe14d', 4); X.fillStyle = '#fff3a0'; el(682, 62, 9, 6, -.6); X.fill();
  // Ávila, far, tinted
  X.beginPath(); X.moveTo(0, 340); X.lineTo(0, 210); X.quadraticCurveTo(120, 140, 260, 200); X.quadraticCurveTo(380, 120, 520, 190); X.quadraticCurveTo(660, 130, 800, 210); X.lineTo(800, 340); X.closePath(); X.fillStyle = '#6fbf86'; X.fill();
  X.beginPath(); X.moveTo(380, 340); X.quadraticCurveTo(450, 170, 520, 190); X.quadraticCurveTo(660, 130, 800, 210); X.lineTo(800, 340); X.closePath(); X.fillStyle = 'rgba(30,90,70,.28)'; X.fill();
  // ranchitos on the hill
  const pal = ['#ff9a8a', '#ffd479', '#8fd0ff', '#c9a6ff', '#9be38a', '#ffb7d4'];
  for (let i = 0; i < 30; i++) { const bx = 300 + (i % 15) * 33, by = 232 + Math.floor(i / 15) * 30 + (i * 7 % 17) - Math.abs(7 - (i % 15)) * 3, w = 22 + (i * 5 % 9), h = 17 + (i * 3 % 8); X.fillStyle = pal[i % 6]; X.fillRect(bx, by, w, h); X.fillStyle = 'rgba(20,16,28,.25)'; X.fillRect(bx, by, w, 3); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(bx + 4, by + 7, 5, 6); }
  // highway sign on two posts
  line([[84, 336], [84, 176]], 8, '#8a8fa3'); line([[212, 336], [212, 176]], 8, '#8a8fa3');
  rr(36, 102, 226, 78, 10); ink('#1f8a4c', 4); X.strokeStyle = '#fff'; X.lineWidth = 3; rr(44, 110, 210, 62, 6); X.stroke();
  txt('CARACAS - LA GUAIRA', 149, 128, 17, '#fff', 'center', 190); txt('◄  22 km  ►', 149, 154, 20, '#ffe14d', 'center', 150);
  // jersey barrier + palms
  rr(-10, 316, W + 20, 36, 8); ink('#cfc8d8', 4); X.fillStyle = 'rgba(20,16,28,.14)'; X.fillRect(0, 336, W, 14); X.fillStyle = '#ffd23f'; for (let x = 20; x < W; x += 120) X.fillRect(x, 322, 60, 6);
  for (const px of [460, 600]) { line([[px, 320], [px + 8, 250], [px - 2, 206]], 11, '#a77544'); for (let i = 0; i < 6; i++) { const a = -2.6 + i * .5; X.beginPath(); X.moveTo(px - 2, 204); X.quadraticCurveTo(px - 2 + Math.cos(a) * 36, 204 + Math.sin(a) * 36 - 26, px - 2 + Math.cos(a) * 72, 204 + Math.sin(a) * 52 + 12); X.quadraticCurveTo(px - 2 + Math.cos(a) * 34, 204 + Math.sin(a) * 26 + 6, px - 2, 204); ink('#3fb260', 3); } }
  // far lanes
  X.fillStyle = '#6d6a85'; X.fillRect(0, 352, W, 90); X.fillStyle = '#ffd23f'; for (let x = 10; x < W; x += 80) X.fillRect(x, 394, 44, 5);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 352); X.lineTo(W, 352); X.stroke();
  // near shoulder
  X.fillStyle = '#8a86a3'; X.fillRect(0, 442, DITCH, H - 442); X.fillStyle = '#fff'; X.fillRect(0, 446, DITCH, 6);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 442); X.lineTo(W, 442); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.1)'; for (let x = 0; x < DITCH; x += 90) X.fillRect(x + 8, GY + 20, 40, 5);
  X.fillStyle = 'rgba(20,16,28,.18)'; for (const [cx, cy] of [[90, 560], [260, 580], [470, 566], [600, 584]]) { el(cx, cy, 30, 6); X.fill(); }
  // the zanja: a muddy trench with a puddle and tall grass
  X.beginPath(); X.moveTo(DITCH, 442); X.lineTo(DITCH + 8, H); X.lineTo(W, H); X.lineTo(W, 442); X.closePath(); ink('#6b4a35', 4);
  X.fillStyle = 'rgba(20,16,28,.22)'; X.fillRect(DITCH + 6, 442, W, 40); X.fillStyle = '#5f8f9a'; el(750, 575, 38, 8); X.fill();
  for (let i = 0; i < 9; i++) { const gx = DITCH - 4 + i * 14; line([[gx, 446], [gx + (i % 2 ? 6 : -6), 414 - (i * 5 % 14)]], 4, '#3fae52'); }
  rr(716, 360, 74, 46, 6); ink('#ffd23f', 3.5); txt('ZANJA', 753, 383, 16, INK, 'center', 62); line([[753, 406], [753, 440]], 5, '#8a8fa3');
  X = old; return cv;
}

/* ═════════ the game ═════════ */
function duCaucho(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), judge = D.role === 0, TS = Math.sqrt(sp);
  /* the level, from the seed (same draws on both screens): the star order and the passing trucks */
  const start = Math.floor(R() * 5), stepk = R() < .5 ? 2 : 3, seq = [], ordOf = [0, 0, 0, 0, 0];
  for (let i = 0; i < NN; i++) { seq.push((start + i * stepk) % 5); ordOf[seq[i]] = i; }
  const trk = [(3.0 + R() * .9) / TS, (7.4 + R() * 1.2) / TS], TRD = 2.3 / TS, trHit = [false, false], trSnd = [false, false];
  const kLift = new Set(), pops = [];
  /* jack: owns h and wobble; lugs: owns the nuts. Each keeps a view of the other */
  let held = false, h = 0, wob = 0, hSent = -9, hLast = -1, wLast = -1, nnV = 0, badV = 0, slipV = 0, pumpT = 0;      // jack
  let nn = 0, bad = 0, slip = 0, nSent = -9, hRecv = 0, wRecv = 0, hView = 0, wView = 0, recvT = -1;                // lugs
  const okAt = [-9, -9, -9, -9, -9], badAt = [-9, -9, -9, -9, -9];
  let resAt = -1, hRes = 0, wRes = 0, wrongAt = -9, slipAt = -9, jolt = 0;
  const nnShow = () => judge ? nnV : nn;
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (hsh(g.c * 7) - .5) * .14 }); }
  const sendH = () => { hSent = g.c; hLast = Math.round(h * 1000); wLast = Math.round(wob * 1000); D.send('h', [hLast, wLast], true); };
  const sendN = () => { nSent = g.c; D.send('n', [nn, bad, slip], true); };
  const inBand = v => v >= LO && v <= HI;
  function tap(p) {                                       // LUGS: tap the nut at position p
    if (g.result || p < 0 || p > 4) return;
    const k = ordOf[p];
    if (k < nn) { sfx.click(); return; }
    if (!inBand(hView)) { slip++; slipAt = g.c; sfx.buzz(); pop('WRONG HEIGHT!', MC.x, MC.y + 150, 26, '#e8434f', '#fff'); sendN(); return; }
    if (k === nn) { nn++; okAt[k] = g.c; sfx.coin(); sfx.thud(); shake(3, .1); if (nn >= NN) { sfx.sparkle(); pop('WHEEL ON!', 400, 150, 34, '#2fa84a', '#fff'); } sendN(); }
    else { bad++; badAt[p] = g.c; wrongAt = g.c; sfx.miss(); shake(5, .16); pop('WRONG NUT!', MC.x, MC.y + 150, 26, '#e8434f', '#fff'); sendN(); }
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: judge ? 'RAISE IT!' : 'TIGHTEN!', roleLabel: judge ? 'JACK' : 'LUGS',
    hint: judge ? 'HOLD TO LIFT THE CAR INTO THE GREEN ZONE AND KEEP IT THERE - TOO HIGH AND IT WOBBLES, TOO LOW AND YOUR FRIEND CANNOT WORK. WHEN THE WHEEL IS ON, LET GO!'
      : 'TIGHTEN THE NUTS IN STAR ORDER (1 TO 5) - BUT ONLY WHILE THE CAR HANGS AT THE RIGHT HEIGHT (GREEN LAMP). YOUR FRIEND WORKS THE JACK!',
    thint: judge ? 'HOLD TO LIFT, KEEP THE CAR IN THE GREEN ZONE, LET GO WHEN THE WHEEL IS ON' : 'TAP THE NUTS IN ORDER WHILE THE LAMP IS GREEN',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) { resAt = T; hRes = judge ? h : hView; wRes = judge ? wob : wView; }
      if (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      for (let i = 0; i < 2; i++) if (!trSnd[i] && T >= trk[i] + .43 * TRD) { trSnd[i] = true; if (!g.result) sfx.whoosh && sfx.whoosh(); }
      if (judge) {
        if (!g.result) {
          const lifting = held || kLift.size > 0;
          h = clamp(h + (lifting ? LIFTR * TS : -(nnV >= NN ? SINK2 : SINK) * TS) * dt, 0, 1);
          if (lifting) { pumpT += dt; if (pumpT > .13) { pumpT = 0; sfx.tick(); } }
          let w = wob - WDEC * TS * dt;
          if (h > HI) w += (h - HI) * WRISE * TS * dt;
          if (h >= .98) w += .8 * TS * dt;
          for (let i = 0; i < 2; i++) if (!trHit[i] && T >= trk[i] + .43 * TRD) { trHit[i] = true; w += TRUCKJ; jolt = T; }
          wob = clamp(w, 0, 1);
          if (wob >= 1) g.finish('lose');
          else if (nnV >= NN && h <= .02) g.finish('win');
          else if (T >= g.limit) g.finish('lose');
        }
        if ((Math.abs(Math.round(h * 1000) - hLast) >= 6 || Math.abs(Math.round(wob * 1000) - wLast) >= 15) && T - hSent >= .05 || T - hSent >= .4) sendH();
      } else {
        if (recvT >= 0) { hView += (hRecv - hView) * Math.min(1, dt * 14); wView += (wRecv - wView) * Math.min(1, dt * 14); }
        if (!g.result && T - nSent >= .4) sendN();
      }
    },
    msg(type, d) {
      if (judge) {
        if (type === 'n' && Array.isArray(d) && !g.result) {
          const a = d[0] | 0, b = d[1] | 0, c = d[2] | 0;
          if (a > nnV && a <= NN) { h = Math.max(0, h - SETTLE * (a - nnV)); nnV = a; okAt[a - 1] = g.c; sfx.click(); }
          if (b > badV) { wob = Math.min(1, wob + .3 * (b - badV)); badV = b; wrongAt = g.c; sfx.miss(); shake(5, .2); }
          if (c > slipV) { wob = Math.min(1, wob + .06 * (c - slipV)); slipV = c; slipAt = g.c; }
        }
      } else if (type === 'h' && Array.isArray(d)) { hRecv = clamp((d[0] | 0) / 1000, 0, 1); wRecv = clamp((d[1] | 0) / 1000, 0, 1); if (recvT < 0) { hView = hRecv; wView = wRecv; } recvT = g.c; }
    },
    down(p) {
      if (g.result) return;
      if (judge) { held = true; return; }
      let best = -1, bd = NHIT * NHIT;
      for (let i = 0; i < 5; i++) { const q = nutPos(i), d = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y); if (d < bd) { bd = d; best = i; } }
      if (best >= 0) tap(best);
    },
    move() {}, up() { held = false; },
    key(e) {
      const c = e.code; if (g.result || c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (judge) { if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW' || c === 'Enter') kLift.add(c); }
      else { const m = /^Digit(\d)$/.exec(c) || /^Numpad(\d)$/.exec(c); if (m && +m[1] >= 1 && +m[1] <= NN) tap(seq[+m[1] - 1]); }
    },
    keyup(e) { kLift.delete(e.code); },
  };
  const nutPos = p => ({ x: MC.x + Math.cos(nutAng(p)) * NR, y: MC.y + Math.sin(nutAng(p)) * NR });

  /* ═════ draw ═════ */
  g.draw = function () {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    if (!BG) BG = buildBg(); ctx.drawImage(BG, 0, 0);
    // moving background: clouds, far traffic, the tanker
    for (const [sx, y, s] of [[40, 60, .8], [330, 96, .6], [560, 50, .7]]) { const cx = ((T * 6 + sx) % 1000) - 120; X.save(); X.translate(cx, y); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) circ2(a, b, r, '#eaf7ff', 3); X.restore(); }
    farCar(((T * 70 + 100) % 1100) - 150, '#4db8ff'); farCar(800 - ((T * 55 + 300) % 1100) + 150, '#e8434f');
    for (let i = 0; i < 2; i++) { const k = (T - trk[i]) / TRD; if (k > 0 && k < 1) tanker(lerp(-300, 1100, k), T); }
    // heights as drawn (the car drops when the game is lost)
    let hd = judge ? h : hView, wd = judge ? wob : wView;
    if (rk >= 0) { const dk = lost ? clamp(rk / .18, 0, 1) : 1; hd = lost ? hRes * (1 - dk * dk) : hd; wd = lost ? Math.max(wRes, .5) * (1 - dk) : wd * .5; }
    const lift = hd * LIFTPX, nShow = nnShow();
    const shk = Math.sin(T * 52) * wd * 5 + (T - wrongAt < .25 ? Math.sin(T * 70) * 3 : 0), tilt = Math.sin(T * 41) * wd * .035;
    const wheelOff = lost && rk > .12;
    jackDraw(hd, T, judge && (held || kLift.size > 0) && !g.result, tilt);
    // the car, hanging on the jack
    X.save(); X.translate(HX + shk, HYC - lift);
    X.translate(JX - HX, 34); X.rotate(tilt); X.translate(HX - JX, -34);
    if (lost && rk > .12) { const sag = ease((rk - .12) / .2); X.translate(190, 62); X.rotate(-.11 * sag); X.translate(-190, -62); }
    carBody();
    tire(190, 0, 62, 0, false);
    if (!wheelOff) { const loose = (NN - nShow) / NN; X.save(); X.rotate(Math.sin(T * 23) * .018 * loose + loose * .02); tire(0, 0, 62, 0, false);
      for (let p = 0; p < 5; p++) { const k = ordOf[p], done = k < nShow, a = nutAng(p), r = done ? 20 : 20 + Math.max(0, 1 - (T - slipAt) * 3) * 0, t0 = T - okAt[k]; hex(Math.cos(a) * r, Math.sin(a) * r, 5.8, done && t0 < .3 ? t0 * 20 : 0, done ? '#ffe08a' : '#8e98ad', 2); }
      X.restore(); }
    X.restore();
    // the spare rolls away, into the zanja
    if (wheelOff) drawRoll(T, rk - .12);
    // dust where the car lands
    if (lost && rk > .1 && rk < .7) for (let i = 0; i < 6; i++) { const q = (rk - .1) / .6; X.globalAlpha = (1 - q) * .8; circ2(HX - 30 + i * 36 + Math.sin(i) * 10, GY - 6 - q * 26 - (i % 2) * 8, 10 + q * 12, '#d9d2c0', 2.5); X.globalAlpha = 1; }
    // the two mechanics
    drawJackman(T, won, lost, rk); drawLugman(T, won, lost, rk);
    // moto + "tranquilo, pana"
    if (lost && rk > 1) { const q = rk - 1, x = q < .7 ? lerp(-90, 470, ease(q / .7)) : 470, brk = q < .7 && q > .5;
      moto(x, GY + 50, T, '#2f6fd6'); if (brk) for (let i = 0; i < 3; i++) circ2(x - 40 - i * 14, GY + 46 - i * 5, 5 + i * 2, '#d9d2c0', 2);
      if (q > .75) { const bp = outBack((q - .75) / .2); X.save(); X.translate(500, 420); X.scale(bp, bp); X.translate(-500, -420); bubble(500, 392, 224, 52, 470); txt('TRANQUILO, PANA', 500, 418, 24, INK, 'center', 204); X.restore(); } }
    // win: the tanker honks, stars
    if (won && rk >= 0) { const c = ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A']; for (let i = 0; i < 7; i++) { const q = (rk * 1.4 + i * .15) % 1; star(90 + i * 100, 250 + (i % 3) * 36, 6 + q * 20, 3 + q * 4, 6, i + q * 2, c[i % 4], 0); } }
    // HUD pips: tight nuts
    for (let i = 0; i < NN; i++) { const px = 46 + i * 40; hex(px, 40, 16, 0, i < nShow ? '#ffe08a' : '#4a4558', 3); if (i < nShow) { X.fillStyle = 'rgba(255,255,255,.5)'; el(px - 5, 34, 4, 3, -.5); X.fill(); } else { X.fillStyle = 'rgba(255,255,255,.15)'; el(px, 40, 6, 6); X.fill(); } }
    if (judge) drawJackUI(T, wd, hd, nShow); else drawLugsUI(T, hd, nShow);
    for (const q of pops) { const a = T - q.t0; if (a > 1) continue; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 12, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
    if (judge && nShow >= NN && !g.result) badge('WHEEL ON! LET GO!', 400, 150, 30, '#2fa84a', '#fff', outBack((T - okAt[NN - 1]) / .25) * (1 + Math.sin(T * 10) * .04), -.03);
    if (!g.result && T < 3.2) badge(judge ? 'LIFT IT JUST RIGHT!' : 'TIGHTEN IN STAR ORDER!', 400, 196, 20, judge ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
    if (won && rk >= 0) { badge('DONE, PAL!', 400, 220, 54, '#ffb23d', '#fff', outBack(rk / .3) * (rk > 2 ? Math.max(0, 1 - (rk - 2) * 3) : 1), -.06); if (rk > .5) badge('HONK HONK!', 400, 290, 30, '#2fa84a', '#fff', outBack((rk - .5) / .25) * (rk > 2 ? Math.max(0, 1 - (rk - 2) * 3) : 1), .05); }
    if (lost && rk > .2) badge('THE CAR FELL!', 330, 200, 40, '#e8434f', '#fff', outBack((rk - .2) / .25), -.05);
    vignette(.18);
  };
  function drawRoll(T, q) {                               // the spare: pops off, rolls along the shoulder, drops into the zanja
    const vx = 300, ry = GY - 62, tEdge = (DITCH - HX) / vx;
    let x, y, rot;
    if (q < 0) { x = HX; y = HYC; rot = 0; }
    else if (q < tEdge) { x = HX + vx * q; y = ry - Math.abs(Math.sin(q * 5)) * Math.max(0, 1 - q * 2) * 26; rot = vx * q / 62; }
    else { const f = q - tEdge, vy = f * 520; x = DITCH + 30 + f * 140; y = Math.min(ry + 150, ry + 90 * f * f * 9 + 0); rot = vx * q / 62 + f * 6; if (f > .3) { x = DITCH + 30 + .3 * 140 + (f - .3) * 40; y = ry + 150 + Math.sin((f - .3) * 18) * 0; } }
    tire(x, y, 62, rot, true);
    X.fillStyle = '#6b4a35'; X.beginPath(); X.moveTo(DITCH + 4, GY + 76); X.lineTo(W, GY + 76); X.lineTo(W, H); X.lineTo(DITCH + 8, H); X.closePath(); X.fill(); X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(DITCH + 4, GY + 76); X.lineTo(W, GY + 76); X.stroke();
    for (let i = 0; i < 6; i++) { const gx = DITCH + 10 + i * 18; line([[gx, GY + 78], [gx + (i % 2 ? 7 : -7), GY + 52 - (i * 7 % 12)]], 4, '#3fae52'); }
    if (q > tEdge + .45) badge('PLOP!', DITCH + 40, GY - 20, 26, '#7e5bd6', '#fff', outBack((q - tEdge - .45) / .2), .06);
  }
  function drawJackman(T, won, lost, rk) {                // the player at the crank (x 392): pumps with both arms
    const x = 392, fy = GY + 52, u = 3.3, pump = judge && (held || kLift.size > 0) && !g.result, ph = Math.sin(T * 15);
    const hop = won && rk >= 0 ? Math.abs(Math.sin(T * 10)) * 14 : 0;
    X.save(); X.translate(x, fy - hop);
    if (won) { arm(u, -1, -.5 + Math.sin(T * 14) * .3, 1, judge ? myCol() : pCol()); arm(u, 1, .5 - Math.sin(T * 14) * .3, 1, judge ? myCol() : pCol()); }
    else { arm(u, -1, -1.9 + (pump ? ph * .25 : 0), 1, judge ? myCol() : pCol()); arm(u, 1, -2.2 + (pump ? ph * .25 : 0), 1, judge ? myCol() : pCol()); }
    caos(0, 0, u, { col: judge ? myCol() : pCol(), mood: won ? 'happy' : lost ? 'sad' : null });
    X.restore();
    if (!g.result && T < 3.4) pill(x, fy - 12.6 * u - 36, judge ? 'YOU' : 'YOUR FRIEND', judge ? myCol() : pCol());
  }
  function drawLugman(T, won, lost, rk) {                 // the player with the cross wrench (x 118): swings it when a nut goes tight
    const x = 118, fy = GY + 52, u = 3.3, col = judge ? pCol() : myCol(), sw = Math.max(0, 1 - (T - okAt[Math.max(0, nnShow() - 1)]) * 4) * (nnShow() > 0 ? 1 : 0);
    const hop = won && rk >= 0 ? Math.abs(Math.sin(T * 10 + 1)) * 14 : 0;
    X.save(); X.translate(x, fy - hop);
    if (won) { arm(u, -1, -.5 + Math.sin(T * 14) * .3, 1, col); arm(u, 1, .5 - Math.sin(T * 14) * .3, 1, col); }
    else { arm(u, 1, -.7 - sw * .5, 1, col); arm(u, -1, -.9, 1, col); line([[20, -52 - sw * 8], [58, -82 + sw * 14]], 5, '#c9ced6'); line([[34, -56 - sw * 8 + 18], [48, -78 + sw * 14 - 18]], 5, '#c9ced6'); }
    caos(0, 0, u, { col, mood: won ? 'happy' : lost ? 'sad' : null });
    X.restore();
    if (!g.result && T < 3.4) pill(x, fy - 12.6 * u - 36, judge ? 'YOUR FRIEND' : 'YOU', col);
  }
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';

  /* the jack's screen: height gauge on a pole, the bubble level, the big lift button */
  function drawJackUI(T, wd, hd, nShow) {
    const G = GAUGE, ty = v => G.y + G.h - v * G.h;
    line([[G.x + G.w / 2, G.y + G.h + 6], [G.x + G.w / 2, H]], 8, '#8a8fa3');
    rr(G.x - 12, G.y - 34, G.w + 24, G.h + 48, 14); ink('#f4efe0', 4);
    txt('HEIGHT', G.x + G.w / 2, G.y - 16, 15, INK, 'center', G.w + 20);
    rr(G.x, G.y, G.w, G.h, 10); ink('#3a3550', 3);
    X.save(); rr(G.x, G.y, G.w, G.h, 10); X.clip();
    X.fillStyle = '#e8434f'; X.fillRect(G.x, G.y, G.w, ty(HI) - G.y); X.fillStyle = '#5CFF7A'; X.fillRect(G.x, ty(HI), G.w, ty(LO) - ty(HI)); X.fillStyle = '#9a96b0'; X.fillRect(G.x, ty(LO), G.w, G.y + G.h - ty(LO));
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(G.x + 4, G.y, 8, G.h);
    X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(G.x, ty(LO) - 3, G.w, 3); X.fillRect(G.x, ty(HI), G.w, 3);
    X.restore();
    const my = ty(hd), inb = inBand(hd);
    X.beginPath(); X.moveTo(G.x - 14, my - 12); X.lineTo(G.x + G.w + 6, my); X.lineTo(G.x - 14, my + 12); X.closePath(); ink(inb ? '#fff' : hd > HI ? '#ffb23d' : '#ffe14d', 3);
    // bubble level, hanging from the top
    const lx = 300, ly = 62, lw = 250;
    line([[lx + 20, 0], [lx + 20, ly - 8]], 3, '#8a8fa3'); line([[lx + lw - 20, 0], [lx + lw - 20, ly - 8]], 3, '#8a8fa3');
    const warn = wd > .65; rr(lx, ly - 16, lw, 34, 17); ink(warn && Math.sin(T * 18) > 0 ? '#ffd0d0' : '#d9f3e8', 4);
    X.fillStyle = 'rgba(20,16,28,.3)'; X.fillRect(lx + lw / 2 - 30, ly - 12, 3, 26); X.fillRect(lx + lw / 2 + 28, ly - 12, 3, 26);
    const bx = lx + lw / 2 + Math.sin(T * 9) * wd * (lw / 2 - 26); el(bx, ly + 1, 14, 10); ink(wd < .35 ? '#8be08b' : wd < .65 ? '#ffd23f' : '#ff5c5c', 2.5); X.fillStyle = 'rgba(255,255,255,.6)'; el(bx - 4, ly - 3, 4, 3, -.5); X.fill();
    txt('LEVEL', lx + lw / 2, ly + 34, 14, '#fff', 'center', 80);
    // the lift button
    const down = (held || kLift.size > 0) && !g.result, cx = 590, cy = 222;
    X.beginPath(); X.arc(cx, cy + 10, 78, 0, TAU); ink('#9a1f2b', 4); X.beginPath(); X.arc(cx, cy + (down ? 8 : 0), 74, 0, TAU); ink(down ? '#ff6b6b' : '#ff3d4d', 4);
    X.fillStyle = 'rgba(255,255,255,.4)'; el(cx - 24, cy - 36 + (down ? 8 : 0), 28, 13, -.5); X.fill();
    txt('HOLD TO LIFT', cx, cy + 4 + (down ? 8 : 0), 22, '#fff', 'center', 112);
    X.beginPath(); X.moveTo(cx - 20, cy - 34 + (down ? 8 : 0) + Math.sin(T * 6) * 3); X.lineTo(cx, cy - 56 + (down ? 8 : 0) + Math.sin(T * 6) * 3); X.lineTo(cx + 20, cy - 34 + (down ? 8 : 0) + Math.sin(T * 6) * 3); X.closePath(); ink('#fff', 2.5);
    if (!g.result && T < 3 && !down) DUO.demoFinger(cx + 40, cy + 40 + Math.sin(T * 5) * 4, true, (T * 2) % 1);
  }
  /* the lugs' screen: a magnifier on the hub, nuts numbered in star order, a lamp for the car height */
  function drawLugsUI(T, hd, nShow) {
    const band = inBand(hView), high = hView > HI, rim = band ? '#5CFF7A' : high ? '#ff4d5e' : '#9a96b0';
    // pointer ring on the real wheel
    X.setLineDash([8, 7]); X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 3; X.beginPath(); X.arc(HX + Math.sin(T * 52) * wView * 5, HYC - hd * LIFTPX, 40, 0, TAU); X.stroke(); X.setLineDash([]);
    // lens
    line([[MC.x + 84, MC.y + 84], [MC.x + 126, MC.y + 132]], 16, '#a5622c');
    circ2(MC.x, MC.y, MC.r, rim, 6); if (band) { X.globalAlpha = .5 + .4 * Math.sin(T * 10); X.strokeStyle = '#fff'; X.lineWidth = 4; X.beginPath(); X.arc(MC.x, MC.y, MC.r - 8, 0, TAU); X.stroke(); X.globalAlpha = 1; }
    circ2(MC.x, MC.y, MC.r - 14, '#e9edf3', 3); circ2(MC.x, MC.y, MC.r - 34, '#c9ced6', 3);
    X.fillStyle = 'rgba(255,255,255,.4)'; el(MC.x - 52, MC.y - 62, 34, 12, -.6); X.fill();
    circ2(MC.x, MC.y, 30, '#9ba3b4', 3);
    // the star pattern: chalk lines in order, done ones solid
    for (let i = 0; i < NN - 1; i++) { const a = nutPos(seq[i]), b = nutPos(seq[i + 1]), done = i + 1 < nShow; X.setLineDash(done ? [] : [7, 8]); X.strokeStyle = done ? '#e0a010' : 'rgba(40,36,60,.45)'; X.lineWidth = done ? 5 : 3; X.beginPath(); X.moveTo(a.x, a.y); X.lineTo(b.x, b.y); X.stroke(); } X.setLineDash([]);
    for (let p = 0; p < 5; p++) {
      const q = nutPos(p), k = ordOf[p], done = k < nShow, nxt = k === nShow && !g.result, t0 = T - okAt[k], bt = T - badAt[p];
      if (nxt) { X.globalAlpha = .55 + .4 * Math.sin(T * 10); circ2(q.x, q.y, 34, '#ffe14d', 0); X.globalAlpha = 1; }
      hex(q.x, q.y, 26, done && t0 < .3 ? t0 * 21 : 0, done ? '#ffe08a' : bt < .3 ? '#ff7a7a' : '#a8b0c2', 4);
      X.fillStyle = 'rgba(255,255,255,.45)'; el(q.x - 8, q.y - 10, 7, 3.5, -.5); X.fill();
      circ2(q.x, q.y, 11, done ? '#d9a21a' : '#6c7490', 2.5);
      if (done) txt('✓', q.x, q.y + 1, 16, '#fff', 'center', 20); else txt(String(k + 1), q.x, q.y + 1, 20, '#fff', 'center', 22);
    }
    // height cue: arrows
    if (!band && !g.result) { const up = !high, ax = MC.x, ay = MC.y - MC.r - 22 + (up ? -1 : 1) * Math.sin(T * 8) * 3; X.beginPath(); if (up) { X.moveTo(ax - 14, ay + 8); X.lineTo(ax, ay - 10); X.lineTo(ax + 14, ay + 8); } else { X.moveTo(ax - 14, ay - 8); X.lineTo(ax, ay + 10); X.lineTo(ax + 14, ay - 8); } X.closePath(); ink(high ? '#ff4d5e' : '#ffe14d', 3); }
    if (!g.result && T < 3 && nShow === 0 && band) DUO.demoFinger(nutPos(seq[0]).x + 8, nutPos(seq[0]).y + 14 + Math.sin(T * 5) * 4, true, (T * 2) % 1);
  }

  // what a bot may see: the same things as the screen
  g.dbg = {
    nut: p => nutPos(p),
    view: () => judge ? { h, wob, nn: nnV, need: NN, lo: LO, hi: HI } : { hv: hView, inBand: inBand(hView), next: nn < NN ? seq[nn] : -1, nn, need: NN, lo: LO, hi: HI },
    truth: () => ({ h, wob, nnV, nn, bad, slip, seq }),
  };
  wire(g, D, 0, sp, 'du_caucho');
  return g;
}
reg('du_caucho', duCaucho, 'CAMBIO DE CAUCHO'); REGMAP.du_caucho.duo = true;

/* ───────────── intro card (520×240), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#8fdcff'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#8a86a3'; X.fillRect(0, 170, 520, 70); X.fillStyle = '#cfc8d8'; X.fillRect(0, 140, 520, 30);
  if (role === 0) {
    const hh = u < 1.6 ? ease(u / 1.6) * .65 : u < 2.6 ? .65 : .65 * (1 - ease((u - 2.6) / 1.2)), lf = hh * 40;
    rr(60, 62 - lf, 230, 70, 14); ink('#ffd23f', 4); rr(110, 38 - lf, 110, 36, 10); ink('#bfeaff', 3); circ2(110, 134 - lf * 0 - 0, 0.1, '#000', 0);
    tire(120, 136 - lf * 0 - lf + lf, 34, 0, false);
    const top = 132 - lf; line([[330, top + 14], [346, 170], [330, 196]], 6, '#ff9a4d'); rr(310, 196, 40, 8, 3); ink('#8a8fa3', 2.5);
    rr(408, 40, 34, 160, 8); ink('#3a3550', 3); X.fillStyle = '#5CFF7A'; X.fillRect(410, 90, 30, 50); const my = 198 - hh * 156; X.beginPath(); X.moveTo(398, my - 8); X.lineTo(450, my); X.lineTo(398, my + 8); X.closePath(); ink('#fff', 2.5);
    DUO.demoFinger(240, 200, u < 2.6, (u % 1)); txt('HOLD TO LIFT', 150, 218, 18, '#fff', 'center', 150);
    badge('LIFT IT JUST RIGHT!', 260, 20, 16, '#c98a12', '#fff', 1, -.02);
  } else {
    circ2(160, 130, 90, '#e9edf3', 4); circ2(160, 130, 30, '#9ba3b4', 3);
    const n = Math.floor(u / .8) % 5, ord = [0, 2, 4, 1, 3];
    for (let p = 0; p < 5; p++) { const a = nutAng(p), q = ord.indexOf(p), x = 160 + Math.cos(a) * 58, y = 130 + Math.sin(a) * 58, dn = q < n; hex(x, y, 19, 0, dn ? '#ffe08a' : '#a8b0c2', 3); if (dn) txt('✓', x, y + 1, 14, '#fff', 'center', 16); else txt(String(q + 1), x, y + 1, 16, '#fff', 'center', 18); }
    const tp = nutAng(ord[n]); DUO.demoFinger(160 + Math.cos(tp) * 58 + 6, 130 + Math.sin(tp) * 58 + 12, true, (u / .8) % 1);
    circ2(380, 80, 22, '#5CFF7A', 3); txt('OK', 380, 81, 16, INK, 'center', 30);
    badge('TIGHTEN IN STAR ORDER!', 300, 218, 15, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_caucho = [['JACK', 'LIFT THE CAR', 'HOLD TO LIFT'], ['LUGS', 'TIGHTEN THE NUTS', 'TAP NUTS 1 TO 5']];
DUO.DEMOS.du_caucho = [t => demo(0, t), t => demo(1, t)];

})();
