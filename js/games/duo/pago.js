'use strict';
/* ═════════ DUO · PAGO MÓVIL (du_pago): the queue at the corner pharmacy-bodega, the pharmacy closes in 15 seconds ═════════
   SHARED SIMON MEMORY split across two screens.
   THE BANK (role 0) holds the phone with the payment code: a row of symbols (bolivar, arepa, cedula, phone, cafecito, tequeno) that is shown
   for a moment at the start of each round and then HIDES again (tap anywhere = show it again, always for the same short time). It never touches
   the keypad. THE CASHIER (role 1, JUDGE) has the keypad with the six symbols and never sees the code: it has to type it in order from what its
   friend DICTATES by voice. The code changes every round and gets longer: 3 rounds of 2, 3 and 4 symbols (so 9 taps). A wrong symbol is an error
   (the symbol does not count); 3 errors = TRANSACTION REJECTED. WIN: the 3 codes accepted. LOSE: 3 errors or time out.
   Gags: the guy behind in the queue sighs, checks his watch and gets angrier as the clock runs out; the wall clock is the countdown. Ending: a
   "PAGO EXITOSO" SMS with confetti, or the cashier slams a REJECTED stamp on the receipt.
   Netcode (all absolute, latest, re-sent every .5 s so a dropped message never matters): the level (the 3 codes) is drawn from mkR() in the
   constructor, identical on both screens. The CASHIER judges and publishes 'p' [seq, round, pos, errs, tapN, lastSym]; the BANK reads it to show
   progress, to auto-show the next code when the round changes and to flash the errors. The bank sends nothing: showing the code is local. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── tuning ───────────── */
const LENS = [2, 3, 4], NR = 3, NSYM = 6, MAXERR = 3;
const SHOW0 = 1.5, SHOWK = .5, REVEAL_DELAY = .45;                       // how long the code stays on the phone: SHOW0 + SHOWK * length (s)
const KX0 = 51, KST = 118, KW = 108, KY = 438, KH = 100;                 // the keypad (6 keys)
const PH = { x: 170, y: 70, w: 240, h: 300 }, PSC = { x: 184, y: 112, w: 212, h: 214 };
const POS = { x: 446, y: 205, w: 196, h: 155 }, PSCR = { x: 462, y: 222, w: 164, h: 86 };
const NAMES = ['BOLIVAR', 'AREPA', 'ID CARD', 'PHONE', 'COFFEE', 'TEQUENO'];

/* ───────────── drawing kit (X is ctx while playing, an offscreen context while the backdrop is baked) ───────────── */
let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function thin(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function circ2(x, y, r, fill, o = 3) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(fill, o); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(170, X.measureText(t(label)).width + 24);
  X.beginPath(); X.moveTo(x - 8, y + 11); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 11); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(360, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 360); X.restore();
}
function arm(u, sx, an, k, col) {            // blocky arm at a caos's shoulder (translate to feet first)
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
}
function tick(x, y, s, col, w = 5) { thin([[x - 9 * s, y], [x - 3 * s, y + 7 * s], [x + 10 * s, y - 8 * s]], w + 4, INK); thin([[x - 9 * s, y], [x - 3 * s, y + 7 * s], [x + 10 * s, y - 8 * s]], w, col); }
function cross(x, y, s, col, w = 5) { thin([[x - 8 * s, y - 8 * s], [x + 8 * s, y + 8 * s]], w + 4, INK); thin([[x + 8 * s, y - 8 * s], [x - 8 * s, y + 8 * s]], w + 4, INK); thin([[x - 8 * s, y - 8 * s], [x + 8 * s, y + 8 * s]], w, col); thin([[x + 8 * s, y - 8 * s], [x - 8 * s, y + 8 * s]], w, col); }

/* the six symbols of the local culture, centered at (x, y), k = scale (about 60 px at k = 1) */
function sym(id, x, y, k) {
  X.save(); X.translate(x, y); X.scale(k, k);
  if (id === 0) {                                                       // bolivar coin
    cel('#ffd23f', '#d9a017', () => { X.beginPath(); X.arc(0, 0, 27, 0, TAU); }, 5, 3, 4);
    X.beginPath(); X.arc(0, 0, 20, 0, TAU); X.lineWidth = 2.5; X.strokeStyle = '#a87608'; X.stroke(); glint(-10, -14, 8, 3, -.6, .6);
    txt('Bs', 0, 2, 22, '#fff', 'center', 34);
  } else if (id === 1) {                                                // arepa, split, with cheese
    cel('#f2c783', '#cf9650', () => el(0, 2, 29, 24), 6, 4, 4); glint(-12, -10, 10, 4, -.4, .55);
    thin([[-22, 2], [22, 2]], 3, '#a86f32'); X.beginPath(); X.moveTo(-18, 4); X.quadraticCurveTo(-10, 18, -2, 6); X.quadraticCurveTo(6, 16, 14, 5); X.closePath(); ink('#ffe066', 2);
    thin([[-8, -26], [-12, -34], [-6, -42]], 3, 'rgba(255,255,255,.8)'); thin([[8, -26], [4, -34], [10, -42]], 3, 'rgba(255,255,255,.8)');
  } else if (id === 2) {                                                // cedula (ID card)
    cel('#fff3b0', '#e0cf72', () => rr(-31, -21, 62, 42, 6), 4, 5, 4);
    rr(-31, -21, 62, 10, 5); ink('#3f6fd0', 3); circ2(-14, -1, 7, '#e8b48a', 2); X.beginPath(); X.moveTo(-26, 18); X.quadraticCurveTo(-14, 6, -2, 18); X.closePath(); ink('#3f6fd0', 2);
    thin([[2, -2], [24, -2]], 3, INK); thin([[2, 6], [24, 6]], 3, INK); thin([[2, 14], [16, 14]], 3, INK);
  } else if (id === 3) {                                                // phone
    cel('#4a4660', '#2e2a40', () => rr(-16, -29, 32, 58, 8), 4, 3, 4);
    rr(-12, -22, 24, 40, 4); ink('#7fe0ff', 1.5); glint(-5, -12, 5, 10, -.3, .5); circ2(0, 23, 2.6, '#fff', 0); tick(0, -2, .7, '#2fbf5a', 3);
  } else if (id === 4) {                                                // cafecito
    el(0, 22, 31, 8); ink('#fff', 3); cel('#ffffff', '#cfd5e6', () => { X.beginPath(); X.moveTo(-20, -8); X.lineTo(20, -8); X.lineTo(15, 20); X.quadraticCurveTo(0, 25, -15, 20); X.closePath(); }, 5, 3, 4);
    X.beginPath(); X.arc(22, 4, 8, -1.4, 1.5); X.lineWidth = 6; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke();
    el(0, -8, 20, 5); ink('#6b3f23', 3); glint(-8, -9, 6, 1.6, 0, .4);
    thin([[-6, -18], [-10, -28], [-4, -38]], 3, 'rgba(255,255,255,.85)'); thin([[7, -18], [3, -28], [9, -38]], 3, 'rgba(255,255,255,.85)');
  } else {                                                              // tequeno
    X.rotate(-.45); cel('#efae44', '#c27d22', () => rr(-32, -10, 64, 20, 10), 4, 5, 4);
    thin([[-18, -9], [-6, 9]], 3, '#fbe3a0'); thin([[0, -9], [12, 9]], 3, '#fbe3a0'); thin([[16, -9], [26, 6]], 3, '#fbe3a0');
    circ2(31, 0, 7, '#fff0a0', 2.5); glint(-18, -5, 8, 2.4, 0, .5);
  }
  X.restore();
}

/* ───────────── backdrop 1 (baked once): wall, shelves, floor, and the counter ───────────── */
let BG = null, BG2 = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  // wall: mint, with tile stripes
  const wl = X.createLinearGradient(0, 0, 0, 380); wl.addColorStop(0, '#9fdcc8'); wl.addColorStop(1, '#d9f5e8'); X.fillStyle = wl; X.fillRect(0, 0, W, 380);
  X.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < W; x += 50) X.fillRect(x, 0, 24, 380);
  X.fillStyle = 'rgba(20,16,28,.08)'; for (let y = 60; y < 380; y += 64) X.fillRect(0, y, W, 4);
  // floor: warm checker, hard ink horizon
  X.fillStyle = '#e9c98c'; X.fillRect(0, 376, W, H - 376);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 17; c++) if ((r + c) % 2) { X.fillStyle = '#c9965a'; X.fillRect(c * 50 - (r % 2) * 10, 376 + r * 34, 50, 34); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 376); X.lineTo(W, 376); X.stroke();
  X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(0, 378, W, 8);
  // shelves with cans, jars and pill boxes (right)
  for (const sy of [150, 232]) {
    rr(520, sy, 280, 14, 5); ink('#a5622c', 3.5);
    for (let i = 0; i < 7; i++) {
      const x = 536 + i * 38, k = (i + (sy > 200 ? 3 : 0)) % 5, cols = ['#e8434f', '#ffd23f', '#4DB8FF', '#5CFF7A', '#ff9a4d'];
      if (k === 0 || k === 3) { rr(x, sy - 40, 28, 40, 6); ink(cols[(i + 2) % 5], 3); X.fillStyle = '#fff'; X.fillRect(x + 3, sy - 26, 22, 10); }
      else if (k === 1) { rr(x - 2, sy - 52, 34, 52, 8); ink('#ffd23f', 3); circ2(x + 15, sy - 28, 8, '#e8434f', 2); }
      else { rr(x + 2, sy - 30, 24, 30, 5); ink('#fff', 3); X.fillStyle = '#2fbf5a'; X.fillRect(x + 12, sy - 26, 4, 18); X.fillRect(x + 7, sy - 20, 14, 4); }
    }
  }
  // pharmacy green cross sign (a moving sway is not needed: it is lit)
  rr(572, 70, 56, 56, 12); ink('#1fa84f', 4); X.fillStyle = '#fff'; X.fillRect(592, 80, 16, 36); X.fillRect(582, 90, 36, 16);
  line([[600, 66], [600, 56]], 3, '#a5622c');
  // door-mat shadow and the queue rope on the left
  el(120, 400, 110, 14); X.fillStyle = 'rgba(20,16,28,.2)'; X.fill();
  X = old; return cv;
}
function buildBg2() {                                    // the counter, in front of the clerk (right side): top surface and wooden front
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  rr(410, 346, 420, 28, 8); ink('#e0a867', 4); X.fillStyle = 'rgba(255,255,255,.28)'; rr(420, 350, 400, 6, 3); X.fill();
  X.beginPath(); X.rect(410, 372, 420, 70); ink('#a5622c', 4); X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 7; i++) X.fillRect(410 + i * 62, 376, 3, 62);
  // a cat on the counter edge? no: a bell
  circ2(436, 342, 11, '#ffd23f', 3); rr(430, 350, 12, 5, 2); ink('#a5622c', 2);
  X = old; return cv;
}

/* ───────────── characters and props ───────────── */
function senor(T, st, impat) {                           // the man behind in the queue. st: 0 waiting, 1 relieved, 2 furious. impat 0..1
  const x = 52, cyc = (T % 3.4) / 3.4, chk = st === 0 ? ease(1 - Math.abs(cyc * 5.2 - 1.2)) : 0, sigh = st === 0 && cyc > .55 && cyc < .95;
  X.save(); X.translate(x, 0);
  cel('#8a6fb8', '#6a5198', () => rr(-36, 262, 72, 126, 24), 8, 0, 4);                 // shirt
  X.beginPath(); X.moveTo(-10, 262); X.lineTo(0, 288); X.lineTo(10, 262); X.closePath(); ink('#fff', 2.5);
  const by = 214 + Math.sin(T * 2) * 1.5 + (sigh ? 4 * Math.sin((cyc - .55) / .4 * Math.PI) : 0);
  cel('#e0a878', '#b9805a', () => el(0, by, 29, 34), 7, 3, 4.5);                       // head
  X.beginPath(); X.moveTo(-29, by - 6); X.quadraticCurveTo(-34, by - 28, -22, by - 22); X.lineTo(-24, by - 4); X.closePath(); ink('#c9c9d6', 2.5);
  X.beginPath(); X.moveTo(29, by - 6); X.quadraticCurveTo(34, by - 28, 22, by - 22); X.lineTo(24, by - 4); X.closePath(); ink('#c9c9d6', 2.5);
  for (const sx of [-1, 1]) {                                                           // eyes: half-lidded, glued to the watch
    el(sx * 11, by - 6, 8, st === 1 ? 6 : 7); ink('#fff', 2); circ2(sx * 11 + (chk > .3 ? 2.5 : 0), by - 5 + (st === 1 ? -1 : 2), 2.8, INK, 0);
    X.fillStyle = '#e0a878'; X.beginPath(); X.rect(sx * 11 - 10, by - 15, 20, st === 1 ? 5 : 8 - chk * 2); X.fill(); thin([[sx * 11 - 9, by - 7 - (st === 1 ? 5 : 0)], [sx * 11 + 9, by - 7 - (st === 1 ? 5 : 0)]], 3, INK);
    if (st === 2) thin([[sx * 20, by - 20], [sx * 3, by - 13]], 4, INK); else thin([[sx * 19, by - 18 - impat * 3], [sx * 4, by - 17 + impat * 3 * sx * -1 + 3]], 3, INK);
  }
  X.beginPath(); X.moveTo(-18, by + 10); X.quadraticCurveTo(-9, by + 3, 0, by + 10); X.quadraticCurveTo(9, by + 3, 18, by + 10); X.quadraticCurveTo(9, by + 18, 0, by + 14); X.quadraticCurveTo(-9, by + 18, -18, by + 10); X.closePath(); ink('#2a1d1a', 2.5);   // mustache
  if (sigh) { el(0, by + 22, 6, 5 + 3 * Math.sin((cyc - .55) / .4 * Math.PI)); ink('#7a1d2e', 2); }
  else if (st === 1) { X.beginPath(); X.arc(0, by + 18, 9, .1, Math.PI - .1); ink('#7a1d2e', 2); }
  else if (st === 2) { thin([[-8, by + 25], [8, by + 25]], 4, INK); }
  else thin([[-6, by + 23], [6, by + 23]], 3, INK);
  // arms: the left one checks the watch, the right one is crossed (or both up when relieved)
  const wr = st === 1 ? [74, 236 + Math.sin(T * 10) * 8] : st === 2 ? [26, 318] : [lerp(40, 22, chk) + 14, lerp(316, by + 20, chk)];
  line([[34, 280], [lerp(48, wr[0], .6), lerp(300, wr[1], .6)], wr], 12, '#e0a878');
  circ2(wr[0], wr[1], 9, '#fff', 2.5); thin([[wr[0], wr[1]], [wr[0], wr[1] - 5]], 2, INK); thin([[wr[0], wr[1]], [wr[0] + 4, wr[1]]], 2, INK);
  line([[-34, 280], [-44, 316], [-4, 322]], 12, '#e0a878');
  if (st === 1) line([[-34, 280], [-56, 246], [-62, 226]], 12, '#e0a878');
  X.restore();
  if (st === 2) for (let i = 0; i < 3; i++) { const ph = (T * 1.4 + i / 3) % 1; X.globalAlpha = (1 - ph) * .8; X.strokeStyle = '#fff'; X.lineWidth = 5; X.beginPath(); X.moveTo(26 + i * 24, 188 - ph * 30); X.quadraticCurveTo(32 + i * 24, 176 - ph * 30, 26 + i * 24, 164 - ph * 30); X.stroke(); X.globalAlpha = 1; }
  if (sigh) { const a = ease(Math.min(1, (cyc - .55) / .08)) * (1 - ease((cyc - .88) / .07)); X.globalAlpha = a; rr(14, 134, 120, 38, 19); ink('#fff', 3); txt('UFFF...', 74, 154, 20, '#6b6f8a', 'center', 100); X.beginPath(); X.moveTo(40, 170); X.lineTo(50, 186); X.lineTo(58, 170); X.closePath(); ink('#fff', 2.5); X.globalAlpha = 1; }
}
function clock(T, left, st) {                            // the wall clock IS the countdown: a red wedge that eats the face
  const x = 480, y = 108, r = 40;
  circ2(x, y, r, '#fff', 4.5);
  X.beginPath(); X.moveTo(x, y); X.arc(x, y, r - 5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(1 - left, 0, 1)); X.closePath(); X.fillStyle = 'rgba(232,67,79,.85)'; X.fill();
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; thin([[x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6)], [x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1)]], 2.5, INK); }
  const a = -Math.PI / 2 + TAU * clamp(1 - left, 0, 1) + (st === 0 ? Math.sin(T * 30) * .03 * (1 - left) : 0);
  line([[x, y], [x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8)]], 3, INK); circ2(x, y, 4, INK, 0);
  if (left < .3 && st === 0) { X.globalAlpha = .5 + .5 * Math.sin(T * 12); thin([[x - r - 10, y - 4], [x - r - 18, y - 12]], 4, '#e8434f'); thin([[x + r + 10, y - 4], [x + r + 18, y - 12]], 4, '#e8434f'); X.globalAlpha = 1; }
}

/* ═════════ the game ═════════ */
function duPago(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), cashier = D.role === 1, TS = Math.sqrt(sp);
  /* the level, from the seed (same draws on both screens): three codes, each a different row of symbols, no symbol twice in a row */
  const CODE = LENS.map(len => { const c = []; for (let i = 0; i < len; i++) { let s = Math.floor(R() * NSYM); if (i && s === c[i - 1]) s = (s + 1 + Math.floor(R() * (NSYM - 1))) % NSYM; c.push(s); } return c; });
  const showDur = len => SHOW0 + SHOWK * len;
  const keyAt = p => { for (let i = 0; i < NSYM; i++) { const x = KX0 + i * KST; if (p.x >= x - 5 && p.x <= x + KW + 5 && p.y >= KY - 6 && p.y <= KY + KH + 6) return i; } return -1; };
  const pops = [];

  /* cashier (judge) state */
  let round = 0, pos = 0, errs = 0, tapN = 0, lastSym = -1, seq = 0, pSent = -9, okAt = -9, errAt = -9, lastTapAt = -9, pressed = -1, pressAt = -9;
  /* bank state (a view of the cashier + its own reveal timer) */
  let rB = 0, posB = 0, errsB = 0, tapNB = 0, lastSymB = -1, seqB = -1, shownAt = REVEAL_DELAY + .2, okAtB = -9, errAtB = -9, lastTapAtB = -9;
  let resAt = -1;
  const cur = () => cashier ? round : rB;
  const lenNow = () => CODE[Math.min(NR - 1, cur())].length;
  const sendP = () => { pSent = g.c; D.send('p', [seq, round, pos, errs, tapN, lastSym], true); };
  const bump = () => { seq++; sendP(); };

  function tap(i) {                                         // cashier presses a symbol
    if (g.result || i < 0 || i >= NSYM) return;
    pressed = i; pressAt = g.c; tapN++; lastSym = i; lastTapAt = g.c;
    if (round < NR && CODE[round][pos] === i) {
      pos++; sfx.tickHi();
      if (pos >= CODE[round].length) {
        round++; pos = 0; okAt = g.c; sfx.coin();
        if (round >= NR) { bump(); g.finish('win'); return; }
      }
    } else {
      errs++; errAt = g.c; sfx.miss(); shake(5, .18);
      if (errs >= MAXERR) { bump(); g.finish('lose'); return; }
    }
    bump();
  }
  function reveal() { if (g.result) return; shownAt = g.c; sfx.tick(); }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: cashier ? 'TYPE IT!' : 'DICTATE!', roleLabel: cashier ? 'THE CASHIER' : 'THE BANK',
    hint: cashier ? 'YOUR FRIEND HOLDS THE PHONE WITH THE PAYMENT CODE AND DICTATES IT: TAP THE SYMBOLS IN THE SAME ORDER. THE CODE CHANGES EVERY ROUND AND GETS LONGER. 3 MISTAKES AND THE PAYMENT IS REJECTED!'
      : 'YOU SEE THE PAYMENT CODE FOR A MOMENT, THEN IT HIDES: TAP THE PHONE TO SEE IT AGAIN. YOUR FRIEND CANNOT SEE IT - DICTATE THE SYMBOLS OUT LOUD, IN ORDER! 3 ROUNDS, 3 MISTAKES AND IT IS REJECTED!',
    thint: cashier ? 'LISTEN AND TAP THE SYMBOLS IN ORDER' : 'MEMORIZE THE CODE, THEN DICTATE IT OUT LOUD',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) resAt = T;
      while (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      if (cashier) {
        if (!g.result && T >= g.limit) g.finish('lose');
        if (T - pSent >= .5) sendP();
      }
    },
    msg(type, d) {
      if (cashier || type !== 'p' || !Array.isArray(d)) return;
      const s = d[0] | 0; if (s < seqB) return; seqB = s;
      const r = clamp(d[1] | 0, 0, NR), p = d[2] | 0, e = d[3] | 0, n = d[4] | 0;
      if (r > rB) { rB = r; shownAt = g.c + REVEAL_DELAY; okAtB = g.c; }
      posB = p; if (e > errsB) { errAtB = g.c; sfx.miss(); } errsB = e; if (n > tapNB) { lastTapAtB = g.c; lastSymB = d[5] | 0; } tapNB = n;
    },
    down(p) { if (g.result) return; if (cashier) { const i = keyAt(p); if (i >= 0) tap(i); } else reveal(); },
    move() {}, up() {},
    key(e) {
      if (g.result) return; const c = e.code;
      if (cashier) { const m = /^(?:Digit|Numpad)([1-6])$/.exec(c); if (m) tap(+m[1] - 1); }
      else if (c === 'Space' || c === 'Enter') reveal();
    },
    keyup() {},
  };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const showing = () => !cashier && !g.result && cur() < NR && g.c >= shownAt && g.c < shownAt + showDur(lenNow());

  /* ═════ draw ═════ */
  g.draw = function () {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1, st = won ? 1 : lost ? 2 : 0;
    if (!BG) { BG = buildBg(); BG2 = buildBg2(); } ctx.drawImage(BG, 0, 0);
    const left = clamp(1 - T / Math.max(1, g.limit || 14.4), 0, 1), impat = 1 - left;
    const rd = cur(), len = lenNow(), er = cashier ? errs : errsB, ps = cashier ? pos : posB, shown = showing();
    clock(T, left, st);
    senor(T, st, impat);
    const bc = cashier ? pCol() : myCol(), cc = cashier ? myCol() : pCol();
    // ── the clerk (right), behind the counter ──
    const hop = won && rk >= 0 ? Math.abs(Math.sin(T * 10)) * 10 : 0;
    const slam = lost && rk >= 0 ? ease((rk - .05) / .25) : 0;
    X.save(); X.translate(726, 347 - hop); arm(3.8, -1, won ? -.5 + Math.sin(T * 14) * .3 : lost ? -2.3 + slam * 1.5 : -2.2, 1, cc); arm(3.8, 1, won ? .5 - Math.sin(T * 14) * .3 : -1.9, 1, cc);
    caos(0, 0, 3.8, { col: cc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    // ── the customer (left, in front of the man) ──
    X.save(); X.translate(120, 398 - (won && rk >= 0 ? Math.abs(Math.sin(T * 10 + 1.3)) * 10 : 0)); arm(3.6, -1, won ? -.5 + Math.sin(T * 14) * .3 : -2.0, 1, bc); arm(3.6, 1, won ? .5 : -2.5 + Math.sin(T * 3) * .1, 1, bc);
    caos(0, 0, 3.6, { col: bc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    ctx.drawImage(BG2, 0, 0);
    // ── the POS terminal on the counter ──
    cel('#d3dae8', '#97a3ba', () => rr(POS.x, POS.y, POS.w, POS.h + 4, 22), 9, 0, 4.5);
    glint(POS.x + 30, POS.y + 12, 26, 4, -.1, .5);
    rr(POS.x + 30, POS.y - 5, 130, 10, 5); ink('#4a4558', 2.5);                                  // paper slot
    const paper = rd * 14 + (won ? 30 : 0); if (paper > 0) { rr(POS.x + 44, POS.y - 4 - paper, 100, paper + 6, 3); ink('#fff', 2); for (let i = 0; i < paper / 8; i++) thin([[POS.x + 54, POS.y - 12 - i * 8], [POS.x + 54 + 30 + (i % 3) * 14, POS.y - 12 - i * 8]], 2, 'rgba(20,16,28,.35)'); }
    const flashErr = T - (cashier ? errAt : errAtB) < .5, flashOk = T - (cashier ? okAt : okAtB) < .6;
    rr(PSCR.x, PSCR.y, PSCR.w, PSCR.h, 10); ink(flashErr ? '#5a1b22' : flashOk || won ? '#1e5a2c' : '#15321f', 3.5);
    X.fillStyle = 'rgba(255,255,255,.1)'; rr(PSCR.x + 5, PSCR.y + 4, PSCR.w - 10, 9, 4); X.fill();
    txt('Bs 12,50', PSCR.x + 52, PSCR.y + 17, 16, '#7dffa0', 'center', 90);
    for (let i = 0; i < NR; i++) circ2(PSCR.x + PSCR.w - 54 + i * 18, PSCR.y + 17, 5, i < rd ? '#5CFF7A' : '#2a4a34', 1.5);
    const sw = 36, sg = 8, sx0 = PSCR.x + PSCR.w / 2 - (len * sw + (len - 1) * sg) / 2;
    for (let i = 0; i < len; i++) {
      const cx = sx0 + i * (sw + sg), cy = PSCR.y + 54;
      rr(cx, cy - 20, sw, 40, 8); ink(i === ps && !g.result ? '#244a31' : '#1d3a28', 2.5);
      if (i < ps) { if (cashier) sym(CODE[rd][i], cx + sw / 2, cy, .5); else tick(cx + sw / 2, cy, 1.1, '#5CFF7A', 5); }
      else if (i === ps && !g.result) { if (flashErr) cross(cx + sw / 2, cy, 1.1, '#ff4d5e', 5); else { X.globalAlpha = .4 + .5 * Math.abs(Math.sin(T * 5)); thin([[cx + 7, cy + 12], [cx + sw - 7, cy + 12]], 4, '#7dffa0'); X.globalAlpha = 1; } }
    }
    // lives: three lamps (lit = mistakes left)
    for (let i = 0; i < MAXERR; i++) { const on = i < MAXERR - er; circ2(POS.x + 56 + i * 28, POS.y + 124, 9, on ? '#ff6f7d' : '#4a4558', 3); if (on) glint(POS.x + 53 + i * 28, POS.y + 120, 3, 2, 0, .7); }
    for (let r2 = 0; r2 < 2; r2++) for (let c = 0; c < 3; c++) { rr(POS.x + 128 + c * 20, POS.y + 108 + r2 * 18, 16, 12, 4); ink('#6a7490', 2); }
    // ── the phone of the bank ──
    const ph = ease(clamp(T / .4, 0, 1)), bob = Math.sin(T * 2.2) * 3;
    X.save(); X.translate(0, bob + (1 - ph) * 40);
    line([[142, 380], [188, 352], [PH.x + 18, 348]], 12, bc);                                     // the arm holding it
    cel('#3a3550', '#26223a', () => rr(PH.x, PH.y, PH.w, PH.h, 30), 8, 3, 5);
    rr(PSC.x, PSC.y, PSC.w, PSC.h, 14); ink('#f4fbff', 3);
    rr(PSC.x + 2, PSC.y + 2, PSC.w - 4, 30, 12); ink('#1fa84f', 0); X.fillStyle = '#1fa84f'; X.fill();
    txt('MOBILE PAYMENT', PSC.x + PSC.w / 2, PSC.y + 18, 14, '#fff', 'center', PSC.w - 20);
    circ2(PH.x + PH.w / 2, PH.y + 24, 3.5, '#14101c', 0); rr(PH.x + PH.w / 2 - 22, PH.y + 12, 44, 4, 2); X.fillStyle = '#14101c'; X.fill();
    const cy0 = PSC.y + 112;
    if (shown) {                                                                                  // the code, big
      const code = CODE[rd], sz = Math.min(66, (PSC.w - 20) / code.length);
      for (let i = 0; i < code.length; i++) { const px = PSC.x + PSC.w / 2 + (i - (code.length - 1) / 2) * sz; sym(code[i], px, cy0 + Math.sin(T * 4 + i) * 1.5, sz / 66 * 1.0); }
      const k = clamp((T - shownAt) / showDur(code.length), 0, 1);
      rr(PSC.x + 14, PSC.y + PSC.h - 22, PSC.w - 28, 10, 5); ink('#cfd5e6', 2.5); X.save(); rr(PSC.x + 14, PSC.y + PSC.h - 22, PSC.w - 28, 10, 5); X.clip(); X.fillStyle = k > .75 ? '#ff6f7d' : '#4DB8FF'; X.fillRect(PSC.x + 14, PSC.y + PSC.h - 22, (PSC.w - 28) * (1 - k), 10); X.restore();
    } else {                                                                                       // hidden: ? boxes (and a prompt for the bank)
      const code = CODE[Math.min(NR - 1, rd)], sz = Math.min(66, (PSC.w - 20) / code.length);
      for (let i = 0; i < code.length; i++) { const px = PSC.x + PSC.w / 2 + (i - (code.length - 1) / 2) * sz; rr(px - sz * .4, cy0 - sz * .4, sz * .8, sz * .8, 10); ink('#dfe7f5', 2.5); txt('?', px, cy0 + 2, sz * .5, '#8fa0bf', 'center', sz * .6); }
      if (!cashier && !g.result) { const pu = 1 + Math.sin(T * 6) * .04; X.save(); X.translate(PSC.x + PSC.w / 2, PSC.y + PSC.h - 36); X.scale(pu, pu); rr(-90, -16, 180, 32, 16); ink('#ffd23f', 3); txt('TAP TO SEE THE CODE', 0, 1, 14, INK, 'center', 166); X.restore(); }
      else if (!g.result) { txt('HIDDEN', PSC.x + PSC.w / 2, PSC.y + PSC.h - 34, 18, '#8fa0bf', 'center', 150); }
    }
    X.restore();
    if (!cashier && !g.result && T < 3.4) DUO.demoFinger(PSC.x + PSC.w - 30, PSC.y + PSC.h - 12 + bob + Math.sin(T * 5) * 3, true, (T * 2) % 1);
    // ── the keypad of the cashier (the bank sees it too, dimmed, and the key the friend just pressed) ──
    rr(30, 424, 740, 128, 20); ink('#3a3550', 4.5); X.fillStyle = 'rgba(255,255,255,.12)'; rr(42, 428, 716, 8, 4); X.fill();
    const lastS = cashier ? pressed : lastSymB, lastT = cashier ? pressAt : lastTapAtB;
    for (let i = 0; i < NSYM; i++) {
      const x = KX0 + i * KST, down = T - lastT < .14 && lastS === i, dy = down ? 5 : 0, live = cashier && !g.result;
      rr(x, KY + 7, KW, KH, 16); ink(live ? '#b9a98a' : '#7d7890', 3.5);
      cel(live ? '#fff7e6' : '#e1dcec', live ? '#ead9b3' : '#bdb6d2', () => rr(x, KY + dy, KW, KH, 16), 6, 7, 3.5);
      X.globalAlpha = live ? 1 : .8; sym(i, x + KW / 2, KY + dy + 40, .8); X.globalAlpha = 1;
      txt(NAMES[i], x + KW / 2, KY + dy + KH - 14, 13, INK, 'center', KW - 12);
      if (!cashier && down) { X.strokeStyle = '#5CFF7A'; X.lineWidth = 5; rr(x - 3, KY - 3 + dy, KW + 6, KH + 6, 18); X.stroke(); }
    }
    if (cashier && !g.result && T < 3.4) DUO.demoFinger(KX0 + 2 * KST + KW / 2, KY + 40 + Math.sin(T * 5) * 4, true, (T * 2) % 1);
    // ── tags ──
    if (!g.result && T < 3.4) { pill(120, 286, cashier ? 'YOUR FRIEND' : 'YOU', bc); pill(726, 262, cashier ? 'YOU' : 'YOUR FRIEND', cc); }
    // ── win: the SMS ──
    if (won && rk >= 0) {
      const k = outBack(rk / .45), y = lerp(-80, 168, ease(rk / .35));
      X.save(); X.translate(400, y + 70); X.rotate(-.025); X.scale(clamp(k, 0, 1.1) , clamp(k, 0, 1.1)); X.translate(-400, -(y + 70));
      X.fillStyle = 'rgba(20,16,28,.3)'; rr(224, y + 7, 360, 134, 26); X.fill();
      rr(220, y, 360, 134, 26); ink('#fff', 4.5); X.beginPath(); X.moveTo(250, y + 130); X.lineTo(236, y + 156); X.lineTo(284, y + 132); X.closePath(); ink('#fff', 3.5); rr(224, y + 4, 352, 126, 22); X.fillStyle = '#fff'; X.fill();
      circ2(272, y + 66, 32, '#2fbf5a', 4); tick(272, y + 67, 1.9, '#fff', 7);
      txt('SMS', 330, y + 28, 16, '#8f9bb5', 'left', 60); txt('PAYMENT SUCCESSFUL', 436, y + 60, 24, '#1f8a40', 'center', 230); txt('Bs 12,50', 436, y + 98, 22, '#3a3550', 'center', 200);
      X.restore();
      for (let i = 0; i < 5; i++) { const ph2 = (rk * .8 + i / 5) % 1; X.globalAlpha = 1 - ph2; star(110 + i * 150, 360 - ph2 * 120, 12, 5, 5, ph2 * 6, '#FFE14D', 3); X.globalAlpha = 1; }
      if (rk > .9) badge('PAID IN FULL!', 400, 330, 40, '#ffb23d', '#fff', outBack((rk - .9) / .25), .05);
    }
    // ── lose: the cashier stamps a REJECTED on the receipt ──
    if (lost && rk >= 0) {
      const sh = rk > .35 && rk < .6 ? Math.sin(T * 70) * 4 : 0;
      X.save(); X.translate(sh, 0);
      const pk = ease(rk / .25); X.save(); X.translate(0, (1 - pk) * -30);
      X.fillStyle = 'rgba(20,16,28,.28)'; rr(264, 177, 282, 232, 6); X.fill(); rr(260, 170, 282, 232, 6); ink('#fffdf4', 4.5);
      for (let i = 0; i < 8; i++) thin([[282, 200 + i * 22], [282 + 130 + (i % 3) * 36, 200 + i * 22]], 4, 'rgba(20,16,28,.28)');
      txt('Bs 12,50', 470, 200, 20, '#3a3550', 'right', 120);
      X.restore();
      const sy = lerp(60, 292, ease((rk - .05) / .3));                                              // the stamp coming down from the clerk's hand
      if (rk < .5) { line([[726, 250], [640, sy - 40], [440, sy - 36]], 10, cc); rr(410, sy - 36, 60, 22, 6); ink('#a5622c', 3.5); rr(396, sy - 14, 88, 28, 8); ink('#e8434f', 3.5); }
      if (rk > .33) {
        const sp2 = outBack((rk - .33) / .22), sc = lerp(1.7, 1, clamp((rk - .33) / .18, 0, 1));
        X.save(); X.translate(400, 300); X.rotate(-.2); X.scale(sc * clamp(sp2, 0, 1.05), sc * clamp(sp2, 0, 1.05));
        rr(-170, -52, 340, 104, 12); X.lineWidth = 12; X.strokeStyle = '#d62839'; X.stroke(); rr(-160, -42, 320, 84, 8); X.lineWidth = 4; X.stroke();
        txt('TRANSACTION', 0, -16, 38, '#d62839', 'center', 300); txt('REJECTED', 0, 24, 40, '#d62839', 'center', 300);
        X.restore();
      }
      X.restore();
      if (rk > .9) badge('NEXT!', 640, 160, 34, '#7e5bd6', '#fff', outBack((rk - .9) / .25), -.06);
    }
    if (!g.result && T < 3.4) badge(cashier ? 'LISTEN AND TYPE!' : 'DICTATE THE CODE!', 400, 38, 22, cashier ? '#2b9ee6' : '#c98a12', '#fff', outBack(T / .3), -.02);
    vignette(.18);
  };

  g.dbg = {
    keyPt: i => ({ x: KX0 + i * KST + KW / 2, y: KY + KH / 2 }),
    tapPt: () => ({ x: PSC.x + PSC.w / 2, y: PSC.y + PSC.h / 2 }),
    view: () => cashier
      ? { round, rounds: NR, len: CODE[Math.min(NR - 1, round)].length, pos, errs, maxErr: MAXERR, entered: CODE[Math.min(NR - 1, round)].slice(0, pos), nSym: NSYM }
      : { round: rB, rounds: NR, len: lenNow(), shown: showing(), code: showing() ? CODE[Math.min(NR - 1, rB)].slice() : null, pos: posB, errs: errsB, maxErr: MAXERR, showLeft: showing() ? shownAt + showDur(lenNow()) - g.c : 0, nSym: NSYM },
    truth: () => ({ CODE, round, pos, errs, rB, posB, errsB, shownAt }),
  };
  wire(g, D, 1, sp, 'du_pago');
  return g;
}
reg('du_pago', duPago, 'PAGO MÓVIL'); REGMAP.du_pago.duo = true;

/* ───────────── intro cards (520×240), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#bfe8d8'; X.fillRect(0, 0, 520, 240); X.fillStyle = 'rgba(255,255,255,.2)'; for (let x = 0; x < 520; x += 50) X.fillRect(x, 0, 24, 240);
  X.fillStyle = '#e9c98c'; X.fillRect(0, 196, 520, 44); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 196); X.lineTo(520, 196); X.stroke();
  if (role === 0) {
    cel('#3a3550', '#26223a', () => rr(150, 20, 150, 200, 22), 6, 3, 4); rr(160, 46, 130, 140, 10); ink('#f4fbff', 3);
    const show = u < 2;
    if (show) { sym(0, 195, 110, .55); sym(3, 255, 110, .55); } else for (let i = 0; i < 2; i++) { rr(184 + i * 60, 90, 38, 38, 8); ink('#dfe7f5', 2); txt('?', 203 + i * 60, 111, 22, '#8fa0bf'); }
    DUO.demoFinger(225, 172, !show && u > 2.6, (u * 2) % 1);
    X.fillStyle = '#fff'; rr(330, 60, 160, 44, 22); X.fill(); txt(show ? 'BOLIVAR... PHONE' : '...', 410, 84, 15, INK, 'center', 140);
    badge('DICTATE THE CODE!', 260, 16, 15, '#c98a12', '#fff', 1, -.02);
  } else {
    for (let i = 0; i < 3; i++) { rr(100 + i * 110, 120, 98, 78, 12); ink('#fff7e6', 3); sym([0, 3, 1][i], 149 + i * 110, 150, .6); }
    const hit = Math.floor(u * 1.2) % 3; DUO.demoFinger(149 + hit * 110, 156, true, (u * 1.2) % 1);
    cel('#d3dae8', '#97a3ba', () => rr(190, 8, 140, 78, 14), 5, 0, 3); rr(200, 18, 120, 36, 6); ink('#15321f', 2.5); tick(215, 36, .8, '#5CFF7A', 4);
    badge('LISTEN AND TYPE!', 260, 16, 15, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_pago = [['THE BANK', 'READ THE CODE ON YOUR PHONE AND DICTATE IT', 'TAP TO SEE THE CODE'], ['THE CASHIER', 'TYPE THE CODE YOUR FRIEND DICTATES', 'TAP THE SYMBOLS']];
DUO.DEMOS.du_pago = [t => demo(0, t), t => demo(1, t)];

})();
