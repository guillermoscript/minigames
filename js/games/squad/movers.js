'use strict';
/* ═════════ SQUAD · SOFA MOVERS (sq_movers) ═════════
   A building with no lift. 3-4 tiny Claudes carry one giant sofa down the hallway to the moving van, past low door frames
   (everybody must duck) and stair landings (everybody must lift), with a grumpy cat on the sofa and a plant on top.
   FOREMAN (role 0, the JUDGE) walks ahead and sets the pace: hold = walk, let go = stop (a green GO / red STOP paddle tells the team
   whether the road ahead is clear). FRONT / MIDDLE / BACK (roles 1..n-1; n = 3 has no MIDDLE) each own ONE handle of the sofa and its height
   (pointer Y / arrows / drag). The sofa is a plank resting on the handles (a bent plank through the MIDDLE when there is one). A header or a
   stair that the plank would touch wedges it: walking into one is a BONK (the sofa is shoved back and the foreman is dazed for a moment),
   standing still inside one is just STUCK until the handles are fixed. Reach the van before the clock runs out: the door slams and the cat
   sits proudly on the perfectly parked sofa. Out of time: the sofa gives up (THUD) and the cat does not care.
   Netcode: every carrier owns its handle and publishes 'h' (height x100, coalesced ~10/s); everybody draws the other handles ~LAG behind.
   The FOREMAN owns the walk: it integrates the position p from its own hold and the carriers' latest heights, decides the BONK, and publishes
   'p' [p, state] (~10/s, interpolated by the others) plus a one-shot 'bonk'. The level (obstacles) is seeded and identical for everybody. ═════════ */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── geometry (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const FL = 500, CEILY = 70;                    // y of the feet on the flat floor, bottom edge of the ceiling
const L = 240, SH = 70;                       // sofa length, height from its feet to the top of the backrest
const BOT0 = 38, BOTR = 140;                   // height of the sofa's feet above the floor: BOT0 + BOTR*h (h = 0..1)
const CLR = 40, TOL = 5, TILT = .72;           // carriers' heads need CLR below the sofa; tolerance in px; max |front - back|
const FX = 500;                                // where the front end of the sofa stays on screen (the world scrolls)
const VMAX = 215, ACC = 700, DEC = 1400;       // foreman's walking pace px/s, accelerations
const SLEW = 2.4, KEYR = 1.15;                 // how fast a handle follows the pointer / the arrow keys (h per s)
const GRIPIN = 24;                             // the handles sit this far in from the sofa's ends
const BONKBACK = 40, STUN = .55;               // a BONK shoves the sofa back and dazes the foreman
const COLS = ['#FFE14D', '#6EA8FE', '#5CFF7A', '#FF4D9E'];
const SOFA = '#ffb02e', SOFA2 = '#d98a14', SOFAL = '#ffd978', CAT = '#aab0c8', CAT2 = '#7e86a8';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
/* a rounded slab with a shade crescent on the lower-left and a little light (cel shading without gradients) */
function celRR(x, y, w, h, r, base, shade, o = 4) {
  rr(x, y, w, h, r); ink(shade, o); X.save(); rr(x, y, w, h, r); X.clip(); X.fillStyle = base; rr(x - 3, y - 4, w, h, r); X.fill(); X.restore();
  X.fillStyle = 'rgba(255,255,255,.4)'; rr(x + w * .1, y + 3, w * .5, Math.min(5, h * .2), 2.5); X.fill();
}
function pill(x, y, label, col, up, lamp) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(150, X.measureText(s).width + 24);
  if (up) { X.beginPath(); X.moveTo(x - 8, y - 12); X.lineTo(x, y - 22); X.lineTo(x + 8, y - 12); X.closePath(); ink(col, 3); }
  else { X.beginPath(); X.moveTo(x - 8, y + 12); X.lineTo(x, y + 22); X.lineTo(x + 8, y + 12); X.closePath(); ink(col, 3); }
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
  if (lamp !== null && lamp !== undefined) {              // readiness lamp: green tick = my handle is where the road needs it, red ! = not yet
    const lx = x + w / 2 + 14; X.beginPath(); X.arc(lx, y, 11, 0, TAU); ink(lamp ? '#5CFF7A' : '#ff4d5e', 3.5); X.strokeStyle = '#fff'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath();
    if (lamp) { X.moveTo(lx - 4.5, y); X.lineTo(lx - 1, y + 3.6); X.lineTo(lx + 5, y - 3.6); } else { X.moveTo(lx, y - 5); X.lineTo(lx, y + 1); X.moveTo(lx, y + 4.4); X.lineTo(lx, y + 4.6); } X.stroke();
  }
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
function bubble(s, x, y, size, sc) {                 // a speech bubble whose tail points down to (x, y)
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(200, X.measureText(t(s)).width) + 26, h = size * 1.5;
  X.save(); X.translate(x, y); X.scale(sc, sc);
  X.beginPath(); X.moveTo(-8, -18); X.lineTo(2, 0); X.lineTo(10, -18); X.closePath(); ink('#fff', 3);
  rr(-w / 2, -18 - h, w, h, h * .45); ink('#fff', 3); X.fillStyle = '#fff'; X.fillRect(-6, -21, 15, 6);
  txt(s, 0, -18 - h / 2 + 2, size, INK, 'center', 200); X.restore();
}
function keyCap(label, x, y) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.max(30, X.measureText(label).width + 16);
  rr(x - w / 2, y - 13, w, 26, 6); ink('#fff', 2.5); txt(label, x, y + 1, 15, INK, 'center', w - 6);
}
function heart(x, y, s, col) {
  X.beginPath(); X.moveTo(x, y + s * .9); X.bezierCurveTo(x - s * 1.5, y - s * .1, x - s * .8, y - s * 1.1, x, y - s * .35); X.bezierCurveTo(x + s * .8, y - s * 1.1, x + s * 1.5, y - s * .1, x, y + s * .9); X.closePath(); ink(col || '#ff5c8a', 2.5);
}
function sweat(x, y, k, s) {                          // a drop sliding down a forehead
  const a = 1 - k; if (a <= 0) return; X.globalAlpha = a; const yy = y + k * 10 * s;
  X.beginPath(); X.moveTo(x, yy - 4 * s); X.quadraticCurveTo(x + 3.2 * s, yy + 1 * s, x, yy + 3.4 * s); X.quadraticCurveTo(x - 3.2 * s, yy + 1 * s, x, yy - 4 * s); X.closePath(); ink('#9fe3ff', 1.5); X.globalAlpha = 1;
}

/* ───────────── the characters ───────────── */
/* brows over claude()'s two eyes: mood 'effort' (pushing), 'worry' (up and in), none otherwise. (x, y) = centre of the feet, u = unit */
function brows(x, y, u, mood) {
  if (!mood) return; const ey = y - 6.2 * u - 2 * u; X.strokeStyle = INK; X.lineWidth = Math.max(2.5, u * .75); X.lineCap = 'round';
  for (const sx of [-1, 1]) { const ex = x + sx * 2.8 * u; X.beginPath(); if (mood === 'effort') { X.moveTo(ex - sx * 1.6 * u, ey - .9 * u); X.lineTo(ex + sx * 1.3 * u, ey + .5 * u); } else { X.moveTo(ex - sx * 1.5 * u, ey + .5 * u); X.lineTo(ex + sx * 1.4 * u, ey - .9 * u); } X.stroke(); }
}
/* arms from a Claude's shoulders up to a grip point (gx, gy); drawn before the body so it hides the shoulder ends */
function reachArms(x, y, u, gx, gy, col) {
  for (const sx of [-1, 1]) {
    const px = x + sx * 7.2 * u, py = y - 5.4 * u, hx = gx + sx * 9, hy = gy + 3, w = Math.max(7, 1.15 * u * 2.3);
    line([[px, py], [hx, hy]], w + 7, INK); line([[px, py], [hx, hy]], w, col);
    const hs = 2 * u; X.fillStyle = INK; X.fillRect(hx - hs / 2 - 3, hy - hs - 3, hs + 6, hs + 6); X.fillStyle = col; X.fillRect(hx - hs / 2, hy - hs, hs, hs);
    X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(hx - hs / 2, hy - hs, hs * .45, hs * .4);
  }
}
/* the hard hat, the whistle and the paddle sign of the foreman */
function hardHat(x, y, u) {
  const ty = y - 9 * u;
  X.beginPath(); X.ellipse(x, ty + .4 * u, 6.6 * u, 3.1 * u, 0, Math.PI, TAU); X.closePath(); ink('#ffd23f', 3.5);
  X.fillStyle = 'rgba(255,255,255,.5)'; el(x - 2.2 * u, ty - 1.4 * u, 1.8 * u, .8 * u, -.3); X.fill();
  rr(x - 7.6 * u, ty - .2 * u, 15.2 * u, 1.3 * u, .6 * u); ink('#e8a812', 2.5);
}
function paddle(x, y, go, T, sc) {                   // lollipop sign on a pole; (x, y) = bottom of the pole
  X.save(); X.translate(x, y); X.rotate(Math.sin(T * 4) * .03); X.scale(sc, sc);
  rr(-3, -70, 6, 70, 2); ink('#d9a066', 2.5);
  X.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; X.lineTo(Math.cos(a) * 27, -96 + Math.sin(a) * 27); } X.closePath(); ink(go ? '#2fc654' : '#e8434f', 4);
  X.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; X.lineTo(Math.cos(a) * 22, -96 + Math.sin(a) * 22); } X.closePath(); X.lineWidth = 2.5; X.strokeStyle = '#fff'; X.stroke();
  txt(go ? 'GO!' : 'STOP', 0, -96, go ? 19 : 15, '#fff', 'center', 44);
  X.restore();
}

/* the cat that rides on the sofa: feet at (x, y). mood: 'calm' (deadpan) | 'worry' | 'happy' | 'meh' */
function cat(x, y, s, mood, T, lean) {
  X.save(); X.translate(x, y); X.scale(s, s); X.rotate(lean || 0);
  const tw = Math.sin(T * 3.2) * 8;
  X.beginPath(); X.moveTo(16, -8); X.quadraticCurveTo(40 + tw, -4, 34 + tw * .6, -32 + tw * .5); X.lineWidth = 15; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 8; X.strokeStyle = CAT; X.stroke();
  el(0, -15, 22, 16); ink(CAT, 3.5);
  X.save(); el(0, -15, 22, 16); X.clip(); X.fillStyle = CAT2; X.fillRect(-24, -4, 50, 12); X.fillStyle = '#e8ebfa'; el(-6, -10, 11, 8); X.fill(); X.restore();
  X.strokeStyle = CAT2; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(8 + i * 5, -29 + i); X.lineTo(10 + i * 5, -22 + i); X.stroke(); }
  el(-12, 1, 6, 4); ink(CAT, 2.5); el(12, 1, 6, 4); ink(CAT, 2.5);
  const hy = -38 + (mood === 'worry' ? 3 : 0);
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 6, hy - 8); X.lineTo(sx * (mood === 'worry' ? 20 : 15), hy - (mood === 'worry' ? 12 : 24)); X.lineTo(sx * 17, hy - 2); X.closePath(); ink(CAT, 3); X.beginPath(); X.moveTo(sx * 9, hy - 8); X.lineTo(sx * 13, hy - 17); X.lineTo(sx * 14, hy - 7); X.closePath(); X.fillStyle = '#ff9fb4'; X.fill(); }
  el(0, hy, 17, 14); ink(CAT, 3.5);
  X.fillStyle = CAT2; for (let i = -1; i <= 1; i++) { rr(i * 5 - 1.2, hy - 14, 2.4, 6, 1); X.fill(); }
  el(0, hy + 5, 8, 5.5); X.fillStyle = '#eef0fb'; X.fill();
  X.beginPath(); X.moveTo(-2.4, hy + 2.5); X.lineTo(2.4, hy + 2.5); X.lineTo(0, hy + 5); X.closePath(); ink('#ff7ea8', 1.5);
  X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round';
  for (const sx of [-1, 1]) {
    const ex = sx * 7.5, ey = hy - 3.5;
    if (mood === 'happy') { X.beginPath(); X.arc(ex, ey + 1, 3.6, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
    else if (mood === 'worry') { el(ex, ey, 4.6, 5.6); ink('#fff', 2); X.fillStyle = INK; el(ex, ey + .6, 1.6, 1.6); X.fill(); }
    else { el(ex, ey, 4, mood === 'meh' ? 2.2 : 3.6); ink('#fff', 2); X.fillStyle = INK; el(ex + 1, ey, 1.8, 1.8); X.fill(); if (mood === 'calm' || mood === 'meh') { X.fillStyle = CAT; X.fillRect(ex - 6, ey - 6, 12, mood === 'meh' ? 5 : 3.2); X.beginPath(); X.moveTo(ex - 5, ey - 2.4 + (mood === 'meh' ? 2 : 0)); X.lineTo(ex + 5, ey - 2.4 + (mood === 'meh' ? 2 : 0)); X.stroke(); } }
  }
  X.lineWidth = 1.6; for (const sx of [-1, 1]) for (const k of [-1, 1]) { X.beginPath(); X.moveTo(sx * 9, hy + 5 + k); X.lineTo(sx * 24, hy + 4 + k * 3.5); X.stroke(); }
  if (mood === 'happy') { X.lineWidth = 2.4; X.beginPath(); X.arc(-2.2, hy + 8, 2.2, .1, Math.PI - .1); X.arc(2.2, hy + 8, 2.2, .1, Math.PI - .1); X.stroke(); }
  X.restore();
}
function plant(x, y, s, wob) {                       // a little cactus in a pot, base at (x, y)
  X.save(); X.translate(x, y); X.scale(s, s); X.rotate(wob || 0);
  X.beginPath(); X.moveTo(-14, -20); X.lineTo(14, -20); X.lineTo(10, 0); X.lineTo(-10, 0); X.closePath(); ink('#d9694a', 3.5); rr(-16, -26, 32, 8, 3); ink('#e9805f', 3);
  rr(-8, -62, 16, 38, 8); ink('#43b366', 3.5); rr(-17, -50, 8, 18, 4); ink('#43b366', 3); rr(9, -56, 8, 20, 4); ink('#43b366', 3);
  X.fillStyle = 'rgba(255,255,255,.4)'; rr(-5, -58, 3, 22, 1.5); X.fill(); X.fillStyle = '#ff7ea8'; el(0, -64, 4, 3); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.5; X.stroke();
  X.restore();
}

/* the sofa seen from its long side, in its own frame: x from 0 (back end) to L, y = 0 on the soles of its feet, up is negative */
function sofaArt() {
  X.save(); X.scale(1, 1.2);                                                              // drawn 58 px tall, scaled up to SH
  for (const fx of [14, L - 28]) { rr(fx, -9, 14, 11, 3); ink('#8a5530', 3); }
  celRR(10, -SH, L - 20, 40, 16, SOFA, SOFA2, 4);                                        // the backrest
  X.fillStyle = SOFA2; for (let i = 0; i < 6; i++) { el(34 + i * ((L - 68) / 5), -41, 2.6, 2.6); X.fill(); }       // tufted buttons
  celRR(0, -38, L, 30, 11, SOFA, SOFA2, 4);                                              // the frame
  const cw = (L - 80) / 2;
  celRR(36, -52, cw, 22, 10, SOFAL, SOFA, 3.5); celRR(40 + cw, -52, cw, 22, 10, SOFAL, SOFA, 3.5);   // two seat cushions
  celRR(-5, -54, 38, 50, 16, SOFA, SOFA2, 4); celRR(L - 33, -54, 38, 50, 16, SOFA, SOFA2, 4);         // the armrests
  X.restore();
}

/* ───────────── the static hallway, painted once into a 400-wide tile that repeats while the world scrolls ───────────── */
let TILE = null;
function buildTile() {
  const cv2 = document.createElement('canvas'); cv2.width = 400; cv2.height = H; const old = X; X = cv2.getContext('2d');
  X.fillStyle = '#efe3cc'; X.fillRect(0, 0, 400, CEILY);                                          // ceiling
  X.fillStyle = '#e1d1b2'; X.fillRect(0, 0, 400, 12);
  let g = X.createLinearGradient(0, CEILY, 0, FL - 22); g.addColorStop(0, '#d9d3f7'); g.addColorStop(1, '#f0eaff'); X.fillStyle = g; X.fillRect(0, CEILY, 400, FL - 22 - CEILY);   // wallpaper
  X.fillStyle = 'rgba(120,100,200,.12)'; for (let i = 0; i < 10; i++) X.fillRect(i * 40 + 10, CEILY, 16, 400);
  X.fillStyle = 'rgba(255,120,150,.4)'; for (let i = 0; i < 10; i++) for (let j = 0; j < 7; j++) { el(i * 40 + 18 + (j % 2) * 20 - 20 + 20, CEILY + 34 + j * 42, 3.4, 3.4); X.fill(); }
  X.fillStyle = '#f7efe0'; X.fillRect(0, CEILY - 14, 400, 14); X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(0, CEILY, 400, 6);   // crown moulding + its shadow
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, CEILY - 14); X.lineTo(400, CEILY - 14); X.stroke(); X.beginPath(); X.moveTo(0, CEILY); X.lineTo(400, CEILY); X.stroke();
  X.fillStyle = '#9c82f0'; X.fillRect(0, FL - 128, 400, 106);                                       // wainscot
  X.fillStyle = '#b9a2ff'; for (let i = 0; i < 4; i++) { rr(10 + i * 100, FL - 112, 80, 74, 7); ink('#a58cf6', 3); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(16 + i * 100, FL - 108, 50, 5); X.fillStyle = '#b9a2ff'; }
  X.fillStyle = '#7e66d8'; X.fillRect(0, FL - 128, 400, 14); X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(0, FL - 128); X.lineTo(400, FL - 128); X.stroke();   // chair rail
  X.fillStyle = '#f7efe0'; X.fillRect(0, FL - 22, 400, 22); X.strokeStyle = INK; X.beginPath(); X.moveTo(0, FL - 22); X.lineTo(400, FL - 22); X.stroke();                    // skirting
  g = X.createLinearGradient(0, FL, 0, H); g.addColorStop(0, '#b97a46'); g.addColorStop(1, '#8a5530'); X.fillStyle = g; X.fillRect(0, FL, 400, H - FL);      // floorboards
  X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = 2; for (let y = FL + 26; y < H; y += 26) { X.beginPath(); X.moveTo(0, y); X.lineTo(400, y); X.stroke(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, FL); X.lineTo(400, FL); X.stroke();
  rr(-10, FL + 10, 420, 66, 8); ink('#c8454f', 3.5); X.strokeStyle = '#ffd23f'; X.lineWidth = 3; X.strokeRect(-6, FL + 16, 412, 54);                             // runner
  X.fillStyle = 'rgba(255,225,160,.55)'; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(i * 80 + 40, FL + 28); X.lineTo(i * 80 + 54, FL + 43); X.lineTo(i * 80 + 40, FL + 58); X.lineTo(i * 80 + 26, FL + 43); X.closePath(); X.fill(); }
  X = old; return cv2;
}

/* ═════════ the game ═════════ */
function duMovers(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), TS = Math.sqrt(sp), n = D.roles >= 4 ? 4 : 3, role = D.role, judge = role === 0;
  const KEYS = n === 4 ? ['F', 'M', 'B'] : ['F', 'B'], ROLE = { F: 1, M: 2, B: n - 1 };
  const myKey = role === 0 ? null : KEYS.find(k => ROLE[k] === role) || 'B';
  /* the level: 4 obstacles (2 low doorways, 2 stair landings) in a seeded order. Always 13 draws, whatever n / role. */
  const pats = [['B', 'S', 'B', 'S'], ['S', 'B', 'S', 'B'], ['B', 'S', 'S', 'B'], ['S', 'B', 'B', 'S']], pat = pats[Math.floor(R() * 4)];
  const OBS = []; let ax = 250 + R() * 30;
  for (let i = 0; i < 4; i++) {
    const k = pat[i], r1 = R(), r2 = R(), r3 = R(), o = k === 'B' ? { k, a: ax, w: 120 + r1 * 25, C: 146 + r2 * 14 } : { k, a: ax, w: 170, ht: 84 + r2 * 14 };
    o.b = o.a + o.w; OBS.push(o); ax = o.b + L + 10 + r3 * 25;    // the next obstacle starts after the sofa has left this one: never two demands on the plank at once
  }
  const VANX = OBS[3].b + 110, LEN = VANX + 70, PIN = VANX + L + 40, NIX = Math.ceil((PIN + 500) / 4);
  /* lookup tables every 4 px from x = -400: floor height (stairs) and ceiling height (headers), both in px above the flat floor */
  const TERR = new Float32Array(NIX), CEIL = new Float32Array(NIX).fill(1e4), sm = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  for (let i = 0; i < NIX; i++) {
    const x = i * 4 - 400;
    for (const o of OBS) {
      if (o.k === 'B') { if (x >= o.a && x <= o.b) CEIL[i] = Math.min(CEIL[i], o.C); }
      else { const s = x - o.a; let T = 0; for (let j = 0; j < 3; j++) T += o.ht / 3 * (sm((s - j * 20) / 8) - sm((s - 96 - j * 20) / 8)); TERR[i] = Math.max(TERR[i], T); }
    }
  }
  const terr = x => TERR[clamp(((x + 400) / 4) | 0, 0, NIX - 1)];
  /* 0 = the plank clears everything; 1 = a foot / the underside hits a stair, 2 = the top hits a header, 3 = too steep */
  function viol(p, hb, hm, hf) {
    if (Math.abs(hf - hb) > TILT) return 3;
    for (let k = 0; k <= 8; k++) {
      const u = k / 8, x = p - L + u * L, h = u < .5 ? hb + (hm - hb) * u * 2 : hm + (hf - hm) * (u - .5) * 2, bot = BOT0 + BOTR * h, i = clamp(((x + 400) / 4) | 0, 0, NIX - 1);
      if (bot < TERR[i] + CLR - TOL) return 1; if (bot + SH > CEIL[i] + TOL) return 2;
    }
    return 0;
  }
  /* ───── state ───── */
  const hT = [null, track(), track(), track()], pT = track(), bits = [], pops = [];
  let fN = FOCUSN, h = .5, ht = .5, kU = 0, kD = 0, held = false, kSpace = false, hSent = -9, lastH = -1;
  let p = 0, v = 0, stun = 0, stunAge = 9, ending = null, stuck = 0, pSt = 0, pSent = -9, lastP = -1, lastSt = -1;
  let bonkAt = -9, resAt = -1, winP0 = 0, loseH = null, walkPh = 0, prevPV = 0, spd = 0, bandAt = -9, bandC = null, lightC = null, lampT = 0, jamAt = -9;
  const catS = { x: .5, v: 0 };
  const colOf = r => (D.byRole && D.byRole[r] && D.byRole[r].color) || COLS[r], nameOf = r => (D.byRole && D.byRole[r] && D.byRole[r].name) || 'P' + (r + 1);
  const pView = () => judge ? p : (pT.at() === null ? 0 : pT.at());
  /* the three handle heights as seen from here (lag undefined = drawn LAG behind; 0 = the latest known) */
  function hs(lag) {
    const o = {}; for (const k of KEYS) { if (k === myKey) o[k] = h; else { const q = hT[ROLE[k]].at(lag); o[k] = q === null ? .5 : q / 100; } }
    if (n === 3) o.M = (o.F + o.B) / 2; return o;
  }
  const violH = (pp, o) => viol(pp, o.B, o.M, o.F);
  /* the heights `key` may take so that the plank clears everything between pp - 70 and pp + look, the others staying where they are (or all moving together) */
  function okSet(key, o, pp, look, equal) {
    let lo = 9, hi = -9;
    for (let vv = 0; vv <= 1.001; vv += .1) {
      const q = equal ? { F: vv, M: vv, B: vv } : Object.assign({}, o, { [key]: vv }); if (!equal && n === 3) q.M = (q.F + q.B) / 2;
      let bad = false; for (let x = pp - LB(); x <= pp + look; x += 30) if (viol(x, q.B, q.M, q.F)) { bad = true; break; }
      if (!bad) { lo = Math.min(lo, vv); hi = Math.max(hi, vv); }
    }
    return lo > hi ? null : [lo, hi];
  }
  const LK = { F: 230, M: 300, B: 380 }, LB = () => clamp(Math.abs(spd) * .45, 10, 90);   // how far behind the sofa still counts (a position seen late)
  function bandOf(key, o, pp) {
    for (const look of [LK[key], LK[key] * .55, 70]) { const r = okSet(key, o, pp, look, false) || okSet(key, o, pp, look, true); if (r) return { lo: r[0], hi: r[1], free: r[0] <= .001 && r[1] >= .999 }; }
    return null;
  }
  function bands() {                                  // cached ~7/s: { F: {lo, hi, free}, ... }
    if (g.c - bandAt > .14 || !bandC) { bandAt = g.c; const o = hs(), pp = pView(); bandC = {}; lightC = {}; for (const k of KEYS) { const b = bandOf(k, o, pp); bandC[k] = b; lightC[k] = !!b && (b.free || (o[k] >= b.lo - .06 && o[k] <= b.hi + .06)); } }
    return bandC;
  }
  const safe = (pp, lag) => { const o = hs(lag); for (let d = 0; d <= 30; d += 15) if (violH(pp + d, o)) return false; return true; };
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (Math.sin(g.c * 91) * .07) }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .8, gr: 700, k: 0, rot: 0, vr: 0 }, o)); }
  function bonkFx(pp) {
    bonkAt = g.c; sfx.thud(); shake(7, .22); snd(180, .18, 'square', .06, 0, 90); const cx = FX + 14, cy = FL - BOT0 - 140 * (hs().F) - 20;
    for (let i = 0; i < 6; i++) bit({ k: 1, x: cx, y: cy, vx: (Math.sin(i * 2.4)) * 220, vy: -120 - (i % 3) * 70, r: 7, life: .5 });
    pop('BONK!', clamp(cx - 60, 150, 640), cy - 50, 34, '#ff9a4d', '#fff'); catS.v += 2.4;
  }
  const hkey = e => e.code === 'ArrowUp' || e.code === 'KeyW' ? 1 : e.code === 'ArrowDown' || e.code === 'KeyS' ? -1 : 0;
  const walkKey = c => c === 'Space' || c === 'Enter' || c === 'ArrowRight' || c === 'KeyD';
  const yOfH = hh => 150 + (1 - hh) * 270, hOfY = y => clamp(1 - (y - 150) / 270, 0, 1);

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: judge ? 'WALK!' : 'LIFT!', roleLabel: judge ? 'FOREMAN' : myKey === 'F' ? 'FRONT' : myKey === 'M' ? 'MIDDLE' : 'BACK',
    hint: judge ? 'HOLD CLICK / SPACE TO WALK THE SOFA TO THE VAN - STOP WHEN THE SIGN SAYS STOP!' : myKey === 'M' ? 'MOVE THE MOUSE (OR ▲ ▼) TO RAISE / LOWER THE MIDDLE - KEEP IT IN THE GREEN' : 'MOVE THE MOUSE (OR ▲ ▼) TO RAISE / LOWER YOUR END - KEEP IT IN THE GREEN',
    thint: judge ? 'HOLD TO WALK THE SOFA TO THE VAN - STOP WHEN THE SIGN SAYS STOP!' : 'DRAG UP / DOWN TO LIFT YOUR HANDLE - KEEP IT IN THE GREEN',
    update(dt) {
      g.c += dt; lampT += dt;
      if (g.result && resAt < 0) { resAt = g.c; winP0 = pView(); loseH = hs(); }
      const done = !!(g.result || ending);
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kU = kD = 0; held = false; kSpace = false; }
      if (myKey) {
        const dir = kU - kD; if (dir && !done) ht = clamp(ht + dir * KEYR * dt, 0, 1);
        if (!done) h += clamp(ht - h, -SLEW * dt, SLEW * dt);
        const r = Math.round(h * 100); if (r !== lastH && g.c - hSent >= .09) { lastH = r; hSent = g.c; D.send('h', r, true); }
      }
      if (judge) {
        const o = hs(0);
        if (stun > 0) { stun -= dt; stunAge += dt; v = stunAge < .16 ? -240 : 0; p = Math.max(0, p + v * dt); }
        else {
          const walk = (held || kSpace) && !done && g.c > .15, target = walk ? VMAX * TS : 0;
          v += clamp(target - v, -DEC * dt, ACC * dt);
          const dp = v * dt;
          if (dp > 0 && !done) {
            if (!violH(p + dp, o)) { p += dp; stuck = 0; }
            else {
              if (!violH(p, o)) { stun = STUN; stunAge = 0; bonkFx(p); D.send('bonk', Math.round(p)); } else if (walk && stuck === 0) { jamAt = g.c; sfx.buzz(); }
              stuck = 1; v = 0;
            }
          } else if (!walk) stuck = violH(p, o) ? 1 : 0;
        }
        const st = stun > 0 ? 2 : stuck, rp = Math.round(p * 2) / 2;
        if ((rp !== lastP || st !== lastSt) && g.c - pSent >= .09) { lastP = rp; lastSt = st; pSent = g.c; D.send('p', [rp, st], true); }
        pSt = st;
        if (!g.result) {
          if (!ending && p >= LEN) ending = { at: g.c + .25 };
          if (ending && g.c >= Math.min(ending.at, g.limit)) g.finish('win'); else if (!ending && g.c >= g.limit) g.finish('lose');
        }
      }
      const pv = pView(); spd += (clamp((pv - prevPV) / Math.max(dt, 1e-3), -300, 400) - spd) * Math.min(1, dt * 10); prevPV = pv; if (Math.abs(spd) > 5) walkPh += spd * dt / 13;
      catS.v += (-catS.x + .5) * 40 * dt - catS.v * 4 * dt; catS.x += catS.v * dt * .02;
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
    },
    msg(type, d, from) {
      if (type === 'h' && hT[from] && typeof d === 'number') hT[from].push(d);
      else if (type === 'p' && !judge && Array.isArray(d)) { pT.push(d[0]); pSt = d[1]; }
      else if (type === 'bonk' && !judge) bonkFx(d);
    },
    draw() {
      const T = g.c, o = hs(), pv0 = pView(), won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      X = ctx;
      let pv = pv0;
      if (won && rk >= 0) pv = lerp(Math.min(winP0, LEN + 40), PIN, ease(clamp(rk / .42, 0, 1)));
      const cam = pv - FX, sx = wx => wx - cam;
      /* heights to draw: a loss lets the sofa sag to the floor */
      let dh = o;
      if (lost && rk >= 0 && loseH) { const k = ease(clamp(rk / .22, 0, 1)); dh = { F: lerp(loseH.F, 0, k), M: lerp(loseH.M, 0, k), B: lerp(loseH.B, 0, k) }; }
      else if (won && rk >= 0) { const k = ease(clamp(rk / .35, 0, 1)); dh = { F: lerp(o.F, .12, k), M: lerp(o.M, .12, k), B: lerp(o.B, .12, k) }; }
      const bnk = T - bonkAt, bk = bnk < .4 ? 1 - bnk / .4 : 0;
      if (!TILE) TILE = buildTile();
      const ox = -(((cam % 400) + 400) % 400); X.drawImage(TILE, ox, 0); X.drawImage(TILE, ox + 400, 0); X.drawImage(TILE, ox + 800, 0);
      drawDecor(sx, pv, T, bk);
      for (const q of OBS) { if (sx(q.b) < -40 || sx(q.a) > W + 40) continue; q.k === 'B' ? drawHeader(q, sx(q.a), T, pv) : drawStairs(q, sx(q.a), T, pv); }
      drawVan(sx(VANX), T, won ? rk : -1);
      /* the sofa */
      const hand = key => FL - BOT0 - BOTR * dh[key], xB = FX - L, ss = lost && rk >= 0 ? Math.min(1, rk / .3) : 0;
      const jolt = bk * Math.sin(bnk * 60) * 4, winSettle = won && rk > .38 ? Math.abs(Math.sin((rk - .38) * 11)) * 12 * Math.max(0, 1 - (rk - .38) * 2.2) : 0;
      const yB = hand('B') + jolt - winSettle * 0, yM = hand('M') + jolt, yF = hand('F') + jolt;
      const lift = winSettle;
      // carriers (arms first, then the sofa, then bodies in front of it)
      const grips = KEYS.map(k => ({ k, x: FX - GRIPIN - (k === 'F' ? 0 : k === 'M' ? L / 2 - GRIPIN : L - 2 * GRIPIN) + ((k === 'M') ? 0 : 0) }));
      const body = [];
      for (const gp of grips) {
        const r = ROLE[gp.k], wx = pv - FX + gp.x, feet = FL - terr(wx), u = 3.5, hgt = gp.k === 'F' ? yF : gp.k === 'M' ? yM : yB, gy = hgt - lift;
        const rising = Math.abs((o[gp.k]) - (gp.k === myKey ? ht : o[gp.k])) > .04;
        body.push({ gp, r, feet, u, gy, mood: won ? 'happy' : lost ? 'sad' : null, brow: won || lost ? null : (bk > 0 || pSt === 1 ? 'worry' : (Math.abs(spd) > 20 || rising ? 'effort' : null)) });
      }
      shadowOn(body, sx);
      drawSofa(xB, yB - lift, yM - lift, yF - lift, T, bk, lost, won, rk, o, dh);
      if (!g.result) bands();
      for (const q of body) {
        const sq =lost && rk >= 0 ? 1 - .42 * ease(clamp((rk - .1) / .15, 0, 1)) : 1, bob = (Math.abs(spd) > 20 && !lost ? Math.abs(Math.sin(walkPh * 3 + q.r)) * 3 : 0) + (won ? Math.abs(Math.sin(T * 9 + q.r)) * 10 : 0);
        X.save(); X.translate(q.gp.x, q.feet); X.scale(1, sq); X.translate(-q.gp.x, -q.feet);
        reachArms(q.gp.x, q.feet - bob, q.u, q.gp.x, (q.gy - q.feet + q.feet), colOf(q.r));
        claude(q.gp.x, q.feet - bob, q.u, { col: colOf(q.r), mood: q.mood }); brows(q.gp.x, q.feet - bob, q.u, q.brow);
        if (q.brow === 'effort') sweat(q.gp.x + 12, q.feet - bob - 9 * q.u + 2, (T * 1.4 + q.r) % 1, 1);
        if (q.brow === 'worry') sweat(q.gp.x + 14, q.feet - bob - 9 * q.u, (T * 2.2 + q.r) % 1, 1.2);
        X.restore();
        if (lost && rk > .2) for (let i = 0; i < 3; i++) { const a = T * 6 + i * TAU / 3; star(q.gp.x + Math.cos(a) * 24, q.feet - 38 + Math.sin(a) * 6, 8, 3.5, 5, a, '#FFE14D', 2.5); }
        pill(q.gp.x, q.feet + 26, nameOf(q.r), colOf(q.r), true, g.result ? null : !!(lightC && lightC[q.gp.k]));
      }
      // the foreman ahead of the sofa, with his paddle
      drawForeman(sx(pv + 90) + (won ? 0 : 0), FL - terr(pv + 90), T, won, lost, rk, pv);
      drawFlyingPlant(T, rk, lost);
      drawHud(o, pv, T, won, lost, rk);
      drawBits(T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, q.x, Math.max(176, q.y - Math.min(a, .6) * 14), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (won && rk > .3) badge('PERFECT FIT!', 400, 168, 30, '#22a447', '#fff', outBack((rk - .3) / .22), -.04);
      if (lost && rk > .35) badge('THUD!', 205, 330, 30, '#8a5a33', '#fff', outBack((rk - .35) / .2), .05);
      vignette(.16);
    },
    down(pt) { if (judge) held = true; else g.move(pt); },
    up() { if (judge) held = false; },
    move(pt) { if (!judge) ht = hOfY(pt.y); },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (judge) { if (walkKey(e.code)) kSpace = true; return; }
      const d = hkey(e); if (d > 0) kU = 1; else if (d < 0) kD = 1;
    },
    keyup(e) { if (judge) { if (walkKey(e.code)) kSpace = false; return; } const d = hkey(e); if (d > 0) kU = 0; else if (d < 0) kD = 0; },
  };

  /* ───────── scenery ───────── */
  function drawDecor(sx, pv, T, bk) {
    const gaps = []; let prev = -330; for (const q of OBS) { gaps.push([prev, q.a]); prev = q.b; } gaps.push([prev, VANX]);
    gaps.forEach(([a, b], i) => {
      const mid = (a + b) / 2, x = sx(mid);
      if (x < -120 || x > W + 120) return;
      if (i === 0) { drawDoor(sx(-70), 'HOME', '#ff9a4d', true, 1); drawClock(sx(190), T); drawPainting(sx(60), 1); }
      else if (i === 1) { drawDoor(x - 35, '2B', '#4db8ff', false, 0); drawPainting(sx(a + 30), 2); }
      else if (i === 2) drawNeighbour(x - 35, T, pv, mid, bk);
      else if (i === 3) { drawDoor(x - 35, '3A', '#43b366', false, 0); drawPainting(sx(b - 50), 0); }
      else { drawExit(sx(VANX - 120), T); }
      if (i > 0 && i < 4) drawLamp(sx(mid + 80 * (i % 2 ? 1 : -1)), T, i);
    });
    // the grumpy cat on the banister of the first stairs
    const s0 = OBS.find(q => q.k === 'S'); if (s0) drawBanisterCat(sx(s0.a + 72), FL - s0.ht - 62, T, pv, s0);
  }
  function drawDoor(x, num, col, open, lit) {
    rr(x - 8, FL - 188, 86, 190, 6); ink('#f7efe0', 4);
    if (open) { rr(x, FL - 180, 70, 182, 4); ink('#ffe9a8', 3); X.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 5; i++) { el(x + 35, FL - 20, 20 + i * 8, 10 + i * 3); } rr(x + 50, FL - 178, 18, 178, 3); ink(col, 3); }
    else { rr(x, FL - 180, 70, 182, 4); ink(col, 3.5); X.fillStyle = 'rgba(0,0,0,.1)'; rr(x + 10, FL - 168, 20, 54, 4); X.fill(); rr(x + 40, FL - 168, 20, 54, 4); X.fill(); rr(x + 10, FL - 100, 50, 80, 4); X.fill(); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(x + 5, FL - 176, 5, 160); el(x + 60, FL - 90, 5, 5); ink('#ffd23f', 2.5); }
    rr(x + 18, FL - 206, 34, 20, 5); ink('#fff', 2.5); txt(num, x + 35, FL - 196, 14, INK, 'center', 30);
  }
  function drawPainting(x, v) {
    X.save(); X.translate(x, FL - 230); X.rotate((v - 1) * .06);
    rr(-34, -26, 68, 52, 5); ink('#d9a066', 3.5); rr(-28, -20, 56, 40, 3); ink(['#8fe0ff', '#ffd1d9', '#c9f2a8'][v % 3], 2);
    if (v === 0) { el(0, 10, 18, 7); X.fillStyle = '#4fae5c'; X.fill(); el(8, -6, 6, 6); X.fillStyle = '#ffe14d'; X.fill(); }
    else if (v === 1) { X.fillStyle = '#ff5c8a'; for (let i = 0; i < 3; i++) { heart(-14 + i * 14, 0, 5, '#ff5c8a'); } }
    else { X.beginPath(); X.moveTo(-24, 14); X.lineTo(-6, -8); X.lineTo(6, 6); X.lineTo(14, -2); X.lineTo(24, 14); X.closePath(); ink('#6a9a5a', 2); }
    X.restore();
  }
  function drawClock(x, T) {
    X.save(); X.translate(x, FL - 250); X.beginPath(); X.arc(0, 0, 25, 0, TAU); ink('#fff', 4); X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round';
    for (let i = 0; i < 12; i += 3) { X.beginPath(); X.moveTo(Math.sin(i / 12 * TAU) * 18, -Math.cos(i / 12 * TAU) * 18); X.lineTo(Math.sin(i / 12 * TAU) * 22, -Math.cos(i / 12 * TAU) * 22); X.stroke(); }
    X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.sin(T * .25) * 12, -Math.cos(T * .25) * 12); X.stroke(); X.lineWidth = 2; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.sin(T * 3) * 19, -Math.cos(T * 3) * 19); X.stroke(); X.restore();
  }
  function drawLamp(x, T, i) {                      // a wall sconce that flickers
    const fl = .8 + .2 * Math.sin(T * 9 + i * 3) * (Math.sin(T * 1.3 + i) > .6 ? 1 : .2);
    X.globalAlpha = .25 * fl; el(x, FL - 250, 46, 46); X.fillStyle = '#ffe9a8'; X.fill(); X.globalAlpha = 1;
    rr(x - 8, FL - 242, 16, 26, 6); ink('#ffe9a8', 3); rr(x - 12, FL - 220, 24, 8, 3); ink('#d9a066', 3);
  }
  function drawExit(x, T) {
    rr(x - 40, FL - 190, 100, 192, 8); ink('#f7efe0', 4); rr(x - 30, FL - 180, 80, 182, 4); ink('#9fe3ff', 3);
    X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(x - 22, FL - 172, 12, 150); rr(x - 18, FL - 228, 72, 28, 6); ink('#22a447', 3.5); txt('WAY OUT', x + 18, FL - 214, 20, '#fff', 'center', 60);
  }
  function drawNeighbour(x, T, pv, wx, bk) {
    const k = ease(1 - Math.abs(pv - (wx - 80)) / 330), peek = k * (bk > 0 ? 1 : .75 + .25 * Math.sin(T * 5));
    rr(x - 8, FL - 188, 86, 190, 6); ink('#f7efe0', 4); rr(x, FL - 180, 70, 182, 4); ink(peek > .05 ? '#3a2a4a' : '#e8b24a', 3.5);
    rr(x + 18, FL - 206, 34, 20, 5); ink('#fff', 2.5); txt('2A', x + 35, FL - 196, 14, INK, 'center', 30);
    if (peek > .05) {                                 // a grumpy neighbour in curlers leans out and shushes
      const hx = x + 36, hy = FL - 118 - peek * 8;
      el(hx, hy + 60, 30, 46); ink('#7ec8a0', 3.5); X.beginPath(); X.arc(hx, hy, 24, 0, TAU); ink('#ffd9b0', 3.5);
      for (let i = 0; i < 5; i++) { rr(hx - 24 + i * 11, hy - 32 + Math.abs(i - 2) * 4, 9, 14, 4); ink(['#ff7ea8', '#9fe3ff'][i % 2], 2); }
      X.strokeStyle = INK; X.lineWidth = 3.4; X.lineCap = 'round'; X.beginPath(); X.moveTo(hx - 16, hy - 9); X.lineTo(hx - 4, hy - 4); X.moveTo(hx + 16, hy - 9); X.lineTo(hx + 4, hy - 4); X.stroke();
      el(hx - 9, hy + 1, 4, 4.6); ink('#fff', 2); X.fillStyle = INK; el(hx - 8, hy + 2, 1.8, 1.8); X.fill(); el(hx + 9, hy + 1, 4, 4.6); ink('#fff', 2); X.fillStyle = INK; el(hx + 8, hy + 2, 1.8, 1.8); X.fill();
      X.beginPath(); X.arc(hx, hy + 17, 5, Math.PI + .3, -.3); X.stroke(); rr(hx - 2, hy + 8, 4, 18, 2); ink('#ffd9b0', 2);
      if (peek > .5) bubble('SHHH!', hx + 4, hy - 38, 17, outBack((peek - .5) / .3));
    } else { X.fillStyle = 'rgba(0,0,0,.1)'; rr(x + 10, FL - 168, 20, 54, 4); X.fill(); el(x + 60, FL - 90, 5, 5); ink('#ffd23f', 2.5); }
  }
  function drawBanisterCat(x, y, T, pv, s0) {
    const near = Math.abs(pv - (s0.a + 20)) < 150, hiss = bkNear(pv, s0);
    rr(x - 8, y - 4, 16, 66, 4); ink('#d9a066', 3); X.beginPath(); X.arc(x, y - 10, 9, 0, TAU); ink('#d9a066', 3);
    X.save(); X.translate(x, y - 16); X.scale(.62, .62); cat(0, 0, 1, hiss ? 'worry' : near ? 'meh' : 'calm', T, hiss ? -.1 : 0); X.restore();
    if (hiss) bubble('PSST!', x, y - 52, 16, 1);
  }
  const bkNear = (pv, s0) => pv > s0.a + 40 && pv < s0.a + 230;
  function drawHeader(q, x, T, pv) {
    const bot = FL - q.C, w = q.w;
    X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(x, bot, w, 14);
    rr(x, CEILY - 10, w, bot - CEILY + 10, 6); ink('#c9b27a', 4); X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(x + 8, CEILY + 4, 7, bot - CEILY - 18);
    X.save(); rr(x, bot - 20, w, 20, 4); X.clip(); X.fillStyle = '#ffd23f'; X.fillRect(x, bot - 20, w, 20); X.fillStyle = INK; for (let i = -2; i < w / 16 + 2; i++) { X.beginPath(); X.moveTo(x + i * 16, bot); X.lineTo(x + i * 16 + 8, bot); X.lineTo(x + i * 16 + 22, bot - 20); X.lineTo(x + i * 16 + 14, bot - 20); X.fill(); } X.restore();
    rr(x, bot - 20, w, 20, 4); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    rr(x + w / 2 - 54, bot - 66, 108, 32, 8); ink('#fff', 3.5); txt('MIND YOUR HEAD', x + w / 2, bot - 50, 13, INK, 'center', 98);
    for (const s of [x + 12, x + w - 12]) { X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(s, bot - 34); X.lineTo(s, bot - 66); X.stroke(); }
  }
  function drawStairs(q, x, T, pv) {
    const pts = []; for (let i = -14; i <= q.w + 14; i += 4) pts.push([x + i, FL - terr(q.a + i)]);
    // banister rail behind the steps
    const rail = pts.map(([a, b]) => [a, b - 72]); line(rail, 12, INK); line(rail, 6, '#c98443');
    for (let i = 0; i < pts.length; i += 6) line([[pts[i][0], pts[i][1] - 70], [pts[i][0], pts[i][1]]], 8, INK), line([[pts[i][0], pts[i][1] - 70], [pts[i][0], pts[i][1]]], 3.5, '#e3a868');
    X.beginPath(); X.moveTo(pts[0][0], FL + 12); pts.forEach(([a, b]) => X.lineTo(a, b)); X.lineTo(pts[pts.length - 1][0], FL + 12); X.closePath(); ink('#d09a5c', 4);
    X.save(); X.beginPath(); X.moveTo(pts[0][0], FL + 12); pts.forEach(([a, b]) => X.lineTo(a, b)); X.lineTo(pts[pts.length - 1][0], FL + 12); X.closePath(); X.clip();
    X.fillStyle = 'rgba(20,16,28,.18)'; for (let j = 0; j < 3; j++) { X.fillRect(x + j * 20 + 6, FL - q.ht + 0, 3, q.ht + 20); X.fillRect(x + 96 + j * 20 + 6, FL - q.ht + 0, 3, q.ht + 20); }
    X.restore();
    line(pts.map(([a, b]) => [a, b - 3]), 9, '#c8454f');                                      // the carpet on the treads
    line(pts.map(([a, b]) => [a, b - 8]), 2.5, 'rgba(255,255,255,.45)');
    for (const cx of [x + 156, x + 12]) { rr(cx - 11, FL - q.ht - 98, 22, 36, 6); ink('#d9a066', 3); X.beginPath(); X.arc(cx, FL - q.ht - 104, 11, 0, TAU); ink('#e3a868', 3); }
  }
  function drawVan(x, T, rk) {
    if (x > W + 60) return;
    const bx = x, top = 214, doorTop = FL - 215, wr = 500;
    rr(bx - 18, top - 6, wr + 60, FL + 60 - top, 18); ink('#e8f3ff', 5);                         // body
    rr(bx, doorTop - 20, wr - 100, FL - doorTop + 20, 6); ink('#4a3f5c', 4);                    // cargo bay interior
    X.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 12; i++) X.fillRect(bx + 10 + i * 34, doorTop - 14, 14, FL - doorTop + 12);
    // moving boxes stacked at the back of the bay
    const bxs = [[bx + 300, FL - 52, 78, 52, '#e3ac66'], [bx + 306, FL - 100, 66, 46, '#d49a52'], [bx + 230, FL - 40, 60, 40, '#f0b872'], [bx + 366, FL - 46, 28, 46, '#e3ac66']];
    for (const [a, b, c, d, col] of bxs) { rr(a, b, c, d, 4); ink(col, 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(a + 6, b + 6, c - 12, 4); line([[a + c / 2 - 12, b + d * .5], [a + c / 2 + 12, b + d * .5]], 4, '#8a5a33'); }
    rr(bx + 120, doorTop - 16, 22, 12, 3); ink('#fff3a0', 3);                                    // a bulb
    X.globalAlpha = .12; el(bx + 131, doorTop + 40, 90, 120); X.fillStyle = '#fff3a0'; X.fill(); X.globalAlpha = 1;
    // cab on the right and wheels
    rr(bx + wr - 100, top + 60, 130, FL + 60 - top - 60, 16); ink('#ff9a4d', 5); rr(bx + wr - 80, top + 80, 80, 90, 10); ink('#9fe3ff', 4); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(bx + wr - 70, top + 90, 12, 60);
    for (const wx of [bx + 80, bx + wr - 30]) { X.beginPath(); X.arc(wx, FL + 52, 34, 0, TAU); ink('#3b3550', 5); X.beginPath(); X.arc(wx, FL + 52, 14, 0, TAU); ink('#c9ced6', 3); }
    // sign on the roof
    rr(bx + 120, top - 36, 190, 36, 10); ink('#ffd23f', 4); txt('MOVERS', bx + 215, top - 18, 22, INK, 'center', 160);
    // the roller door slams down when the sofa is in
    if (rk >= 0) {
      const k = outBack(clamp((rk - .32) / .14, 0, 1)), dh2 = (FL - doorTop + 20) * clamp((rk - .32) / .12, 0, 1);
      if (rk > .3) { rr(bx - 6, doorTop - 24, 26, dh2 + 6, 5); ink('#c9ced6', 4); X.strokeStyle = 'rgba(20,16,28,.4)'; X.lineWidth = 2; for (let yy = doorTop; yy < doorTop + dh2; yy += 14) { X.beginPath(); X.moveTo(bx - 4, yy); X.lineTo(bx + 18, yy); X.stroke(); } }
      if (rk > .44 && rk < .62) ring(bx + 6, FL - 20, '#fff', 90, .2);
    }
    rr(bx - 6, doorTop - 30, 26, 16, 5); ink('#aab3c4', 3.5);                                     // the rolled-up door above the opening
  }
  function shadowOn(body, sx) { for (const q of body) shadow(q.gp.x, q.feet + 2, 26, 7, .25); }

  /* the sofa pose, the cat and the plant on top */
  function sofaPt(u, xB, yB, yM, yF) {                // a point on the seat surface at fraction u: x, y (feet line), slope angle
    const x = xB + u * L, y = u < .5 ? lerp(yB, yM, u * 2) : lerp(yM, yF, (u - .5) * 2), a = u < .5 ? Math.atan2(yM - yB, L / 2) : Math.atan2(yF - yM, L / 2);
    return { x, y, a };
  }
  function drawSofa(xB, yB, yM, yF, T, bk, lost, won, rk, o, dh) {
    const piece = (x0, y0, ang, u0, u1) => {
      X.save(); X.translate(x0, y0); X.rotate(ang); X.scale(1 / Math.cos(ang), 1); X.translate(-u0 * L, 0);
      if (u0 > 0 || u1 < 1) { X.beginPath(); X.rect(u0 * L - (u0 > 0 ? 0 : 20), -SH - 40, (u1 - u0) * L + (u0 > 0 ? 0 : 20) + (u1 < 1 ? 0 : 20), SH + 60); X.clip(); }
      sofaArt(); X.restore();
    };
    shadow(xB + L / 2, FL + 4, 110, 12, .18);
    if (n === 3) piece(xB, yB, Math.atan2(yF - yB, L), 0, 1);
    else { piece(xB, yB, Math.atan2(yM - yB, L / 2), 0, .5); piece(xB + L / 2, yM, Math.atan2(yF - yM, L / 2), .5, 1); }
    // grips under the handles
    // the cat sits among the cushions, the plant on the left arm; they lean and slide with the slope
    const sc = sofaPt(.5 + (catS.x - .5) * .05, xB, yB, yM, yF), tilt = (yF - yB) / L;
    const worry = bk > 0 || pSt === 1 || Math.abs(dh.F - dh.B) > .45, mood = won ? 'happy' : lost ? 'meh' : worry ? 'worry' : 'calm';
    const slide = clamp(tilt * 60, -26, 26) * (lost ? 0 : 1), hop = bk * Math.abs(Math.sin((T - bonkAt) * 30)) * 10 + (won && rk > .38 ? Math.abs(Math.sin(T * 11)) * 6 : 0);
    cat(sc.x + 6 + slide * .6, sc.y - 62 - hop, 1.05, mood, T, sc.a + (lost ? 0 : tilt * -.1));
    if (won && rk > .4) for (let i = 0; i < 3; i++) { const a = (T * 1.4 + i / 3) % 1; X.globalAlpha = 1 - a; heart(sc.x + Math.sin(i * 2 + T * 3) * 24, sc.y - 100 - a * 50, 7, '#ff5c8a'); X.globalAlpha = 1; }
    if (!(lost && rk > .1 && !plantOnSofa)) { const pu = sofaPt(.14, xB, yB, yM, yF); plant(pu.x, pu.y - 62 - (bk > 0 ? Math.abs(Math.sin((T - bonkAt) * 24)) * 14 : 0), .85, pu.a + clamp(tilt * -.4, -.2, .2) + (bk > 0 ? Math.sin(T * 40) * .12 : 0)); }
  }
  const plantOnSofa = false;
  function drawFlyingPlant(T, rk, lost) {             // on a loss the cactus is launched and breaks on the floor in front of the foreman
    if (!lost || rk < .1) return; const k = clamp((rk - .1) / .55, 0, 1);
    const x0 = FX - L + .14 * L, y0 = FL - 120, x1 = FX + 50, y1 = FL - 6, x = lerp(x0, x1, k), y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * 130;
    if (k < 1) plant(x, y, .85, k * 9); else { for (let i = 0; i < 5; i++) { X.save(); X.translate(x1 - 30 + i * 16, y1 - 4); X.rotate(i); rr(-8, -6, 16, 10, 2); ink('#d9694a', 2.5); X.restore(); } if (rk < 1) badge('CRASH!', x1 - 10, y1 - 70, 22, '#e8434f', '#fff', outBack((rk - .65) / .15), .05); }
  }
  function drawForeman(x, feet, T, won, lost, rk, pv) {
    const u = 3.6, col = colOf(0), go = safe(pv, undefined) && stun <= 0 && !g.result, face = won ? 'happy' : lost ? 'sad' : null, bob = (Math.abs(spd) > 20 ? Math.abs(Math.sin(walkPh * 3)) * 3 : 0) + (won ? Math.abs(Math.sin(T * 9)) * 10 : 0), st = judge ? (T - bonkAt < STUN ? 1 : 0) : (T - bonkAt < STUN ? 1 : 0);
    shadow(x, feet + 2, 28, 7, .25);
    if (!won && !lost) paddle(x + 40, feet - 4 - bob, go, T, 1);
    else if (won) { star(x + 36, feet - 60 - bob, 12, 5, 5, T * 2, '#FFE14D', 3); }
    claude(x, feet - bob, u, { col, mood: face }); hardHat(x, feet - bob, u);
    if (!won && !lost) brows(x, feet - bob, u, st || !go ? 'worry' : null);
    if (st) for (let i = 0; i < 3; i++) { const a = T * 8 + i * TAU / 3; star(x + Math.cos(a) * 26, feet - 9 * u - 12 + Math.sin(a) * 6, 7, 3, 5, a, '#FFE14D', 2.5); }
    pill(x, feet + 26, nameOf(0), col, true);
  }

  /* ───────── HUD: the route sign, my gauge and plate, the readiness lamps ───────── */
  function drawHud(o, pv, T, won, lost, rk) {
    // route sign (top centre, below y 58)
    const sx0 = 346, sw = 310, sy = 64; X.fillStyle = 'rgba(20,16,28,.3)'; rr(sx0 + 4, sy + 6, sw, 30, 14); X.fill();
    rr(sx0, sy, sw, 30, 14); ink('#d9944f', 4); X.fillStyle = '#a5622c'; rr(sx0 + 8, sy + 22, sw - 16, 4, 2); X.fill();
    const x0 = sx0 + 22, x1 = sx0 + sw - 26; line([[x0, sy + 15], [x1, sy + 15]], 7, INK); line([[x0, sy + 15], [x1, sy + 15]], 3.5, '#f7d297');
    for (const q of OBS) { const px = lerp(x0, x1, (q.a + q.w / 2) / VANX); X.beginPath(); X.moveTo(px - 5, sy + 24); X.lineTo(px + 5, sy + 24); X.lineTo(px, sy + 8); X.closePath(); ink(q.k === 'B' ? '#ff9a4d' : '#9fe3ff', 2); }
    rr(x1 - 2, sy + 4, 22, 18, 5); ink('#e8f3ff', 2.5); rr(x0 - 20, sy + 6, 16, 16, 3); ink('#ffe9a8', 2.5);
    const kp = clamp(pv / VANX, 0, 1), mx = lerp(x0, x1, kp); rr(mx - 10, sy + 5, 20, 12, 5); ink(SOFA, 2.5); rr(mx - 10, sy + 1, 20, 8, 4); ink(SOFAL, 2);
    // my gauge + plate
    if (myKey) {
      const gx = 24, gy = 168, gw = 32, gh = 270, bd = bands()[myKey];
      rr(gx - 4, gy - 12, gw + 8, gh + 24, 14); ink('#fff3dc', 4); rr(gx, gy, gw, gh, 10); ink('#b8b0d6', 3);
      if (bd && !bd.free && !g.result) { const yt = gy + (1 - bd.hi) * gh, yb = gy + (1 - bd.lo) * gh; rr(gx + 2, yt - 6, gw - 4, Math.max(14, yb - yt + 12), 7); ink('rgba(92,255,122,.85)', 2.5); X.globalAlpha = .55 + .25 * Math.sin(T * 8); X.fillStyle = '#5CFF7A'; X.fill(); X.globalAlpha = 1; }
      X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 2; for (let i = 1; i < 10; i++) { X.beginPath(); X.moveTo(gx + 6, gy + gh * i / 10); X.lineTo(gx + gw - 6, gy + gh * i / 10); X.stroke(); }
      const my = gy + (1 - h) * gh, tg = gy + (1 - ht) * gh, ok = !!lightC && lightC[myKey];
      X.globalAlpha = .45; X.beginPath(); X.moveTo(gx + gw + 6, tg); X.lineTo(gx + gw + 20, tg - 8); X.lineTo(gx + gw + 20, tg + 8); X.closePath(); ink('#fff', 2); X.globalAlpha = 1;
      rr(gx - 8, my - 9, gw + 16, 18, 7); ink(ok ? '#5CFF7A' : '#FFE14D', 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(gx - 2, my - 6, gw - 4, 3);
      txt('▲', gx + gw / 2, gy - 22, 20, '#fff'); txt('▼', gx + gw / 2, gy + gh + 24, 20, '#fff');
      const dn = g.result;
      rr(14, 478 - 14 + 4, 186, 48, 16); ink(dn ? '#d3cfe0' : '#ffd23f', 4); X.fillStyle = 'rgba(20,16,28,.2)'; rr(14, 478 + 36, 186, 6, 3); X.fill();
      txt(dn ? (won ? 'LANDED!' : 'DROPPED') : 'LIFT', 66 + (TOUCH ? 40 : 0), 478 + 11, 24, dn ? '#f6f4fb' : INK, 'center', 110); if (!dn && !TOUCH) { keyCap('▲', 150, 478 + 14); keyCap('▼', 184, 478 + 14); }
      if (!dn && !ok && bd && !bd.free) { badge(h < bd.lo ? 'HIGHER!' : 'LOWER!', 100, 152, 15, '#e8434f', '#fff', 1, -.04); }
    } else {
      const dn = g.result, go = !dn && safe(pView(), 0) && stun <= 0;
      rr(14, 478 - 10, 214, 56, 18); ink(dn ? '#d3cfe0' : (held || kSpace) ? '#5CFF7A' : '#4fd06a', 4); X.fillStyle = 'rgba(20,16,28,.2)'; rr(14, 478 + 38, 214, 6, 3); X.fill();
      txt(dn ? (won ? 'DELIVERED!' : 'TOO SLOW') : TOUCH ? 'HOLD TO WALK' : 'HOLD TO WALK', 121, 478 + 3, 22, dn ? '#f6f4fb' : '#fff', 'center', 190);
      if (!dn && !TOUCH) keyCap('SPACE', 121, 478 + 28);
      if (!dn && !go && T > 1) badge('WAIT FOR THE TEAM!', 110, 454, 14, '#e8434f', '#fff', 1, -.04);
    }
    // readiness lamps: one dot per carrier by its name tag
    if (!g.result) { bands(); }
  }
  function drawBits(T) {
    for (const b of bits) { const a = T - b.t0, fade = clamp(a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1, 0, 1); X.globalAlpha = fade; if (b.k === 1) star(b.x, b.y, b.r, b.r * .4, 4, a * 8, '#fff4b0', 2); else { el(b.x, b.y, b.r, b.r * .6); ink('#d9d4ee', 2); } X.globalAlpha = 1; }
  }
  g.dbg = { OBS, VANX, LEN, n, myKey, ROLE, KEYS, pos: () => pView(), h: () => h, band: k => bands()[k || myKey], hs, viol: (pp, o) => violH(pp, o || hs(0)), safe: pp => safe(pp === undefined ? pView() : pp, 0), yOfH, lights: () => (bands(), lightC), stun: () => stun };
  wire(g, D, 0, sp, 'sq_movers');
  return g;
}
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }
reg('sq_movers', duMovers, 'SOFA MOVERS'); REGMAP.sq_movers.duo = true; REGMAP.sq_movers.squad = true;

/* ───────────── intro card: what each role does (520×240 frame), a 4 s loop: a low doorway comes up and the team ducks under it ───────────── */
DUO.INFO.sq_movers = n => n === 4
  ? [['FOREMAN', 'WALK THE SOFA TO THE VAN', 'HOLD CLICK / SPACE'], ['FRONT', 'RAISE / LOWER THE FRONT', 'MOUSE UP / DOWN'], ['MIDDLE', 'RAISE / LOWER THE MIDDLE', 'MOUSE UP / DOWN'], ['BACK', 'RAISE / LOWER THE BACK', 'MOUSE UP / DOWN']]
  : [['FOREMAN', 'WALK THE SOFA TO THE VAN', 'HOLD CLICK / SPACE'], ['FRONT', 'RAISE / LOWER THE FRONT', 'MOUSE UP / DOWN'], ['BACK', 'RAISE / LOWER THE BACK', 'MOUSE UP / DOWN']];
function demo(n, role, t) {
  X = ctx; const u = t % 4, FLY = 200, LL = 190, bx0 = 150;
  let g2 = X.createLinearGradient(0, 0, 0, FLY); g2.addColorStop(0, '#d9d3f7'); g2.addColorStop(1, '#f0eaff'); X.fillStyle = g2; X.fillRect(0, 0, 520, FLY);
  X.fillStyle = '#9c82f0'; X.fillRect(0, FLY - 52, 520, 52); X.fillStyle = '#efe3cc'; X.fillRect(0, 0, 520, 14);
  g2 = X.createLinearGradient(0, FLY, 0, 240); g2.addColorStop(0, '#b97a46'); g2.addColorStop(1, '#8a5530'); X.fillStyle = g2; X.fillRect(0, FLY, 520, 40);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, FLY); X.lineTo(520, FLY); X.stroke(); X.fillStyle = '#c8454f'; X.fillRect(0, FLY + 8, 520, 22);
  const hx = 560 - u * 190;                                        // the header scrolls left over the sofa
  const frontX = bx0 + LL, near = k => ease(1 - Math.abs(hx + 40 - (frontX - LL * k)) / 120);
  const hh = { F: lerp(.55, .12, near(0) ), M: lerp(.55, .12, near(.5)), B: lerp(.55, .12, near(1)) };
  X.save(); rr(hx, 8, 100, 62, 6); ink('#c9b27a', 3.5); X.fillStyle = '#ffd23f'; X.fillRect(hx + 2, 58, 96, 10); X.restore();
  const bot = hf => FLY - 26 - hf * 60, yB = bot(hh.B), yF = bot(hh.F), yM = n === 4 ? bot(hh.M) : (yB + yF) / 2;
  const ang = Math.atan2(yF - yB, LL), sc = LL / L;
  const keys = n === 4 ? ['F', 'M', 'B'] : ['F', 'B'], myK = role === 0 ? null : role === 1 ? 'F' : (n === 4 && role === 2 ? 'M' : 'B');
  const gx = { F: bx0 + LL - 18, M: bx0 + LL / 2, B: bx0 + 18 }, gy = { F: yF, M: yM, B: yB };
  // sofa
  X.save(); X.translate(bx0, yB); X.rotate(ang); X.scale(sc, sc); sofaArt(); X.restore();
  X.save(); X.translate(bx0 + LL * .5, yM - 28); X.scale(.6, .6); cat(0, 0, 1, hx > frontX - 40 && hx < frontX + 30 ? 'worry' : 'calm', t, 0); X.restore();
  for (const k of keys) { const r = k === 'F' ? 1 : k === 'M' ? 2 : n - 1, hl = myK === k; if (hl) { X.globalAlpha = .6; el(gx[k], FLY + 2, 30, 9); X.fillStyle = '#fff'; X.fill(); X.globalAlpha = 1; } X.save(); X.translate(gx[k], FLY); X.scale(.72, .72); reachArms(0, 0, 3.2, 0, (gy[k] - FLY) / .72 + 8, COLS[r]); claude(0, 0, 3.2, { col: COLS[r] }); X.restore(); }
  // the foreman ahead
  const fx = frontX + 60, sofaNear = hx > frontX - 20 && hx < frontX + 90 && near(0) < .6;
  X.save(); X.translate(fx, FLY); X.scale(.72, .72); if (true) paddle(30, -2, !sofaNear, t, 1); claude(0, 0, 3.6, { col: COLS[0] }); hardHat(0, 0, 3.6); X.restore();
  if (role === 0) { const held = !sofaNear; demoFinger(fx, FLY + 26, held, held ? (t * 2) % 1 : 0); badge(held ? 'HOLD TO WALK' : 'LET GO!', 260, 34, 18, held ? '#22a447' : '#e8434f', '#fff', 1, -.03); }
  else {
    const gxx = gx[myK], dn = near(myK === 'F' ? 0 : myK === 'M' ? .5 : 1) > .4;                      // my handle goes down while the header is over my part of the sofa
    demoFinger(gxx + 30, FLY + 20 - (hh[myK] - .12) * 46, true, 0); txt(dn ? '▼' : '▲', gxx + 30, FLY - 44, 30, '#fff');
    badge(dn ? 'LOWER!' : 'LIFT!', 260, 34, 18, dn ? '#e8434f' : '#2b9ee6', '#fff', 1, -.03);
  }
}
DUO.DEMOS.sq_movers = n => Array.from({ length: n }, (_, r) => t => demo(n, r, t));

})();
