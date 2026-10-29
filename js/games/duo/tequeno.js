'use strict';
/* ═════════ DUO · TEQUEÑOS A TIEMPO (du_tequeno): "¡Cuadra el tequeño!" ═════════
   A party buffet at the miniteca. Seven plates ride a belt toward a hungry tío; he wants 5 of them right.
   FRYER (role 0, JUDGE): sees the fryer with tequeños bubbling, each with a timer ring (pale = raw, gold arc = golden, red = burnt).
     Taps (click / touch / SPACE) to scoop: the tapped tequeño (or the one closest to golden) jumps onto ITS plate on the belt.
   SAUCE (role 1): sees the plates and what the tío wants for each one (guasacaca / ketchup / nothing) as a tag above the plate and a bubble over
     the tío. Picks a bottle (bottom buttons or Z / X), aims the nozzle (drag, ◄ ►) and squirts (tap on the belt, SPACE).
   Only SAUCE knows the order; only FRYER knows the timing. The metronome bar at the bottom pulses on every golden moment so they can sync.
   A plate counts when its tequeño was scooped GOLDEN and carries exactly the sauce the tío asked for (or none). 5 of 7 = trencito (win);
   when 3 plates have failed, or time runs out, the tequeño ends up on the tía's dress (lose).
   Netcode: every plate/tequeño is a pure function of the clock (both screens start together), so only decisions travel:
   FRYER owns the quality of each scooped tequeño: 'sc' [i, q] (absolute, duplicate-safe). SAUCE owns the sauce on each plate: 'sq' [i, s]
   (absolute) and its nozzle 'nz' [x, sel] (coalesced, ≤10/s, latest). The judge scores each plate a moment after it passes the tío. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ───────────── layout (800×600) ───────────── */
const N = 7, NEED = 5, SPACE = 1.4, T0 = .9;          // plates, plates needed, seconds between plates, first plate's time
const BV = 210, X0 = -50, JX = 660, SAUMAX = 620;      // belt speed (px/s), plate x at its start, where the tío scores it, last x you can still sauce
const GOLD = .45, CK = 1.7, GONE = 1.4;                // golden half-window (s), how long a tequeño cooks before gold, when it sinks if unscooped
const BY = 402, GY = 326, TIPY = 352;                  // belt row (plate centre), gantry rail, nozzle tip
const GUA = ['#5fd35a', '#2e8f3a'], KET = ['#ff4d5e', '#b8283a'];
const tI = i => T0 + SPACE * i, gI = i => tI(i) + .7, tJ = i => tI(i) + (JX - X0) / BV;
const pxAt = (i, S) => X0 + (S - tI(i)) * BV;
const SLOTX = i => 108 + (i % 4) * 76, SLOTY = 262;
const phaseOf = d => d < -GOLD ? 0 : d <= GOLD ? 1 : 2;

/* ───────────── tiny drawing kit ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(170, X.measureText(t(label)).width + 24);
  X.beginPath(); X.moveTo(x - 8, y + 12); X.lineTo(x, y + 22); X.lineTo(x + 8, y + 12); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(280, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 280);
  X.restore();
}
function cap(x, y, w, h, face, base, down, lab, size = 22, key) {   // a chunky control plate with depth
  const d = down ? 3 : 9;
  rr(x, y + d, w, h, 16); ink(base, 4); rr(x, y + (down ? 6 : 0), w, h, 16); ink(face, 4);
  X.fillStyle = 'rgba(255,255,255,.35)'; rr(x + 10, y + (down ? 9 : 3), w - 20, h * .2, h * .1); X.fill();
  txt(lab, x + w / 2, y + h / 2 + (down ? 6 : 0) + (key ? -4 : 1), size, INK, 'center', w - 16);
  if (key) { X.font = '700 14px Fredoka, Arial, sans-serif'; const kw = Math.max(26, X.measureText(key).width + 12), ky = y + h - 17 + (down ? 6 : 0); rr(x + w / 2 - kw / 2, ky - 11, kw, 22, 6); ink('#fff', 2.5); txt(key, x + w / 2, ky + 1, 14, INK, 'center', kw); }
}

/* ───────────── props ───────────── */
function tequeno(x, y, q, rot, s, T) {                 // q: 0 raw, 1 golden, 2 burnt
  const C = [['#f6dfb2', '#d7b57c'], ['#ffb629', '#e08a14'], ['#4b3023', '#2a1710']][q];
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  rr(-27, -9, 54, 18, 9); ink(C[0], 3.5);
  X.save(); rr(-27, -9, 54, 18, 9); X.clip(); X.fillStyle = C[1]; X.fillRect(-30, 1, 60, 12); X.restore();
  rr(-27, -9, 54, 18, 9); X.lineWidth = 0; X.strokeStyle = 'rgba(0,0,0,0)';
  line([[-14, -6], [-6, 6]], 2, C[1]); line([[0, -6], [8, 6]], 2, C[1]); line([[14, -6], [20, 5]], 2, C[1]);
  if (q === 1) { glint(-8, -4.5, 9, 2.6, 0, .6); X.fillStyle = '#fff6b0'; el(-26, 0, 2.2, 5); X.fill(); el(26, 0, 2.2, 5); X.fill(); }
  else if (q === 0) { glint(-8, -4.5, 8, 2.4, 0, .6); }
  else { for (let i = 0; i < 2; i++) { const k = ((T || 0) * 1.3 + i * .5) % 1; X.globalAlpha = (1 - k) * .6; el(-6 + i * 14, -14 - k * 18, 4 + k * 3, 4 + k * 3); X.fillStyle = '#8f8a9c'; X.fill(); X.globalAlpha = 1; } }
  X.restore();
}
function sauceSquig(x, y, col, dk, w) {                 // a zigzag of sauce on a tequeño
  const pts = []; for (let i = 0; i <= 6; i++) pts.push([x - w / 2 + i * w / 6, y + (i % 2 ? 4 : -4)]);
  line(pts, 9, dk); line(pts, 5.5, col); X.fillStyle = 'rgba(255,255,255,.55)'; el(x - w / 4, y - 4, 3, 1.6); X.fill();
}
function plate(x, y, tq, sauce, T, st) {                // st: null | 'ok' | 'bad'
  el(x + 3, y + 18, 44, 9); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  el(x, y + 4, 42, 15); ink('#dfe6f2', 4); el(x, y + 1, 37, 11); X.fillStyle = '#fff'; X.fill(); X.strokeStyle = 'rgba(120,140,180,.5)'; X.lineWidth = 2; X.stroke();
  glint(x - 18, y - 3, 10, 2.5, 0, .7);
  if (tq >= 0) tequeno(x, y - 6, tq, -.12, .9, T);
  if (sauce === 0) sauceSquig(x, y - 6, GUA[0], GUA[1], 40); else if (sauce === 1) sauceSquig(x, y - 6, KET[0], KET[1], 40);
  if (st === 'ok') { X.save(); X.translate(x, y - 40 - Math.sin(T * 9) * 3); X.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 6 : 14, a = k / 10 * TAU - Math.PI / 2; X.lineTo(Math.cos(a) * r, Math.sin(a) * r); } X.closePath(); ink('#ffe14d', 3); X.restore(); }
  else if (st === 'bad') { line([[x - 10, y - 46], [x + 10, y - 28]], 6, '#ff4d5e'); line([[x + 10, y - 46], [x - 10, y - 28]], 6, '#ff4d5e'); }
}
function tag(x, y, want) {                              // the order the tío asked for, pinned above a plate
  X.beginPath(); X.moveTo(x - 6, y + 12); X.lineTo(x, y + 20); X.lineTo(x + 6, y + 12); X.closePath(); ink('#fff', 2.5);
  el(x, y, 17, 14); ink('#fff', 3);
  if (want === 2) { X.beginPath(); X.arc(x, y, 8, 0, TAU); X.lineWidth = 4; X.strokeStyle = '#ff4d5e'; X.stroke(); line([[x - 6, y + 6], [x + 6, y - 6]], 4, '#ff4d5e'); }
  else { const c = want ? KET : GUA; el(x, y + 1, 9, 7); ink(c[0], 2.5); glint(x - 3, y - 2, 3, 1.6); }
}
function bottle(x, y, c, label, tilt, T) {              // a squeeze bottle: body, nozzle cap, label
  X.save(); X.translate(x, y); X.rotate(tilt);
  rr(-16, -26, 32, 48, 12); ink(c[0], 3.5); X.save(); rr(-16, -26, 32, 48, 12); X.clip(); X.fillStyle = c[1]; X.fillRect(6, -30, 14, 60); X.restore();
  glint(-8, -12, 3.2, 10, 0, .55);
  rr(-8, -40, 16, 16, 4); ink('#fff', 3); X.beginPath(); X.moveTo(-4, -40); X.lineTo(0, -52); X.lineTo(4, -40); X.closePath(); ink('#fff', 2.5);
  rr(-13, -6, 26, 14, 4); ink('#fff8e0', 2); X.restore();
}

/* ───────────── the people ───────────── */
function tio(x, y, mood, T, chew) {
  const u = 4.2; shadow(x, y + 2, 30, 6, .2);
  caos(x, y + Math.sin(T * 3 + 1) * (mood ? 0 : 1.2), u, { col: '#3fa7e0', mood });
  X.save(); el(x, y - 3.6 * u, 3.4 * u, 1 * u); ink('#3a2418', 2.5); X.restore();                  // moustache
  el(x, y - 13.2 * u, 6.2 * u, 1.3 * u); ink('#e8c06a', 3.5); rr(x - 3.4 * u, y - 15.6 * u, 6.8 * u, 2.6 * u, 4); ink('#e8c06a', 3.5);    // straw hat
  X.fillStyle = '#d6453b'; X.fillRect(x - 3.4 * u, y - 14 * u, 6.8 * u, .7 * u);
  if (chew) { el(x, y - 2.6 * u, 1 * u, .5 * u + Math.abs(Math.sin(T * 9)) * .7 * u); ink('#7a1f2a', 2); }
}
function tia(x, y, mood, T, stain) {
  const u = 4.2; shadow(x, y + 2, 30, 6, .2);
  X.beginPath(); X.moveTo(x - 6 * u, y - 5 * u); X.lineTo(x + 6 * u, y - 5 * u); X.lineTo(x + 9 * u, y + 1); X.lineTo(x - 9 * u, y + 1); X.closePath(); ink('#ff7ac0', 4);
  caos(x, y - 2, u, { col: '#ff9ccd', mood });
  X.beginPath(); X.moveTo(x - 6 * u, y - 5.4 * u); X.lineTo(x + 6 * u, y - 5.4 * u); X.lineTo(x + 8.6 * u, y - 1); X.lineTo(x - 8.6 * u, y - 1); X.closePath(); X.fillStyle = '#ff7ac0'; X.fill();
  for (let i = 0; i < 4; i++) { X.fillStyle = '#fff'; el(x - 5.5 * u + i * 3.7 * u, y - 3.2 * u + (i % 2) * 5, 4, 4); X.fill(); }
  el(x, y - 13.2 * u, 3 * u, 2.2 * u); ink('#5a3322', 3.5);                                         // bun
  el(x + 1.6 * u, y - 11.4 * u, 1.3 * u, 1 * u); ink('#ffe14d', 2.5);
  if (stain) { const k = stain; el(x - 1.4 * u, y - 3.4 * u, 2.8 * u * k, 1.7 * u * k); X.fillStyle = '#ffb629'; X.fill(); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke(); el(x + .6 * u, y - 2.8 * u, 1.3 * u * k, 1 * u * k); X.fillStyle = '#5fd35a'; X.fill(); for (let i = 0; i < 3; i++) { el(x - 3 * u + i * 3 * u, y - .6 * u, 3 * k, 5 * k); X.fillStyle = '#ffb629'; X.fill(); } }
}
function chef(x, y, mood, T, col, act) {
  const u = 4.2; shadow(x, y + 2, 30, 6, .2);
  X.save(); const a = -.7 + (act ? Math.sin(act * 14) * .5 : 0); X.translate(x - 7 * u, y - 5.2 * u); X.rotate(a);   // skimmer arm
  X.fillStyle = INK; X.fillRect(-5, -78, 10, 78); X.fillStyle = '#b9833f'; X.fillRect(-2.5, -76, 5, 74);
  X.beginPath(); X.arc(0, -84, 14, 0, TAU); ink('#d9dee8', 3.5); X.restore();
  caos(x, y, u, { col, mood });
  for (let i = 0; i < 3; i++) { el(x + (i - 1) * 2.4 * u, y - 14.2 * u, 2 * u, 1.9 * u); ink('#fff', 3); }
  rr(x - 3.6 * u, y - 14 * u, 7.2 * u, 3 * u, 3); ink('#fff', 3.5);
}
function mini(x, y, u, col, mood) { caos(x, y, u, { col, mood }); }

/* ───────────── the world (baked once) ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#6a3fc4'); gr.addColorStop(1, '#c46fe0'); X.fillStyle = gr; X.fillRect(0, 0, W, 320);
  X.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 9; i++) X.fillRect(i * 100 + 20, 0, 40, 320);
  X.fillStyle = 'rgba(255,225,77,.5)'; for (let i = 0; i < 26; i++) { const x = 20 + hsh(i) * 760, y = 120 + hsh(i + 40) * 170; el(x, y, 2.5, 2.5); X.fill(); }
  // the miniteca neon
  rr(40, 70, 214, 44, 12); ink('#1c1330', 4); X.fillStyle = '#ff4fa3'; X.font = '900 30px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle';
  // speakers
  for (const sx of [14, 730]) { rr(sx, 214, 56, 106, 10); ink('#3a3550', 4); X.beginPath(); X.arc(sx + 28, 244, 17, 0, TAU); ink('#5a5274', 3); X.beginPath(); X.arc(sx + 28, 292, 11, 0, TAU); ink('#5a5274', 3); }
  // fryer body (steel) + stand
  rr(46, 196, 318, 132, 18); ink('#c9ced6', 5); X.fillStyle = 'rgba(255,255,255,.35)'; rr(58, 202, 294, 9, 4); X.fill();
  rr(70, 308, 30, 24, 4); ink('#8f9cb3', 3); rr(310, 308, 30, 24, 4); ink('#8f9cb3', 3);
  // the counter (cream top) hides the legs of the people
  rr(-10, 316, W + 20, 58, 6); ink('#f6e3b4', 4); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(0, 322, W, 5);
  // tablecloth below the belt: yellow / blue / red bands like the flag
  const bands = ['#ffd23f', '#2f6fe0', '#e8434f']; for (let i = 0; i < 3; i++) { X.fillStyle = bands[i]; X.fillRect(0, 432 + i * 56, W, 57); }
  X.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 16; i++) X.fillRect(i * 56 + 10, 432, 18, 168);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 433); X.lineTo(W, 433); X.stroke();
  // belt bed
  X.fillStyle = '#3b3550'; X.fillRect(0, 372, W, 60); X.fillStyle = INK; X.fillRect(0, 368, W, 5); X.fillRect(0, 430, W, 4);
  X = old; return cv;
}
function neon(T) {
  rr(40, 70, 214, 44, 12); X.fillStyle = '#1c1330'; X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  const f = .72 + .28 * Math.sin(T * 7) * Math.sin(T * 3.3);
  X.globalAlpha = f; txt('MINITECA', 147, 93, 26, '#ff7ac0', 'center', 196); X.globalAlpha = 1;
}
function discoball(T, beat) {
  const x = 400, y = 126; line([[x, 56], [x, y - 24]], 3, '#8f9cb3');
  X.beginPath(); X.arc(x, y, 26, 0, TAU); ink('#cfd8e6', 4);
  X.save(); X.beginPath(); X.arc(x, y, 26, 0, TAU); X.clip();
  for (let i = -3; i < 4; i++) for (let j = -3; j < 4; j++) { const on = (i + j + Math.floor(T * 3)) % 3 === 0; X.fillStyle = on ? '#ffffff' : (i + j) % 2 ? '#aab8d0' : '#8793b0'; X.fillRect(x + i * 9 - 4, y + j * 9 - 4, 8, 8); }
  X.restore(); glint(x - 9, y - 10, 5, 3, -.6, .8);
  X.save(); X.globalCompositeOperation = 'lighter';
  const cols = ['#ff4fa3', '#4db8ff', '#ffe14d', '#5cff7a'];
  for (let i = 0; i < 12; i++) { const a = T * .8 + i * TAU / 12, r = 130 + hsh(i) * 120, px = x + Math.cos(a) * r * 1.5, py = 150 + Math.abs(Math.sin(a)) * r * .5 + hsh(i + 9) * 20; X.globalAlpha = .28 + beat * .25; el(px, py, 11, 7); X.fillStyle = cols[i % 4]; X.fill(); }
  X.restore(); X.globalAlpha = 1;
}
function garland(T) {
  const cs = ['#ff4fa3', '#ffe14d', '#4db8ff', '#5cff7a', '#ff9a4d'];
  X.lineWidth = 3; X.strokeStyle = INK; X.beginPath(); X.moveTo(0, 62); X.quadraticCurveTo(200, 84, 400, 62); X.quadraticCurveTo(600, 84, 800, 62); X.stroke();
  for (let i = 0; i < 18; i++) {
    const x = 22 + i * 44, u = x / 400, sag = 22 * Math.sin((u % 1) * Math.PI) * (u < 1 ? 1 : 1), y = 62 + sag * .86, sw = Math.sin(T * 2 + i * .8) * 3;
    X.beginPath(); X.moveTo(x - 11, y); X.lineTo(x + 11, y); X.lineTo(x + sw, y + 20); X.closePath(); ink(cs[i % 5], 2.5);
  }
}
function speakers(beat) {
  for (const sx of [14, 730]) { const k = 1 + beat * .18; X.beginPath(); X.arc(sx + 28, 244, 12 * k, 0, TAU); X.fillStyle = '#1c1330'; X.fill(); glint(sx + 24, 240, 4, 2.5, -.6, .5); X.beginPath(); X.arc(sx + 28, 292, 7 * (1 + beat * .15), 0, TAU); X.fillStyle = '#1c1330'; X.fill(); }
}

/* ═════════ the game ═════════ */
function duTeq(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), fry = D.role === 0, TS = Math.sqrt(sp);
  /* the level: what the tío wants for each plate (at most 2 "nothing" so nobody wins by frying alone) */
  const want = []; let nn = 0;
  for (let i = 0; i < N; i++) { const r = R(); let w = r < .43 ? 0 : r < .86 ? 1 : 2; if (w === 2 && ++nn > 2) w = R() < .5 ? 0 : 1; want.push(w); }
  const q = Array(N).fill(-1), scAt = Array(N).fill(-9), sauce = Array(N).fill(-1), sqAt = Array(N).fill(-9), done = Array(N).fill(false), okv = Array(N).fill(false), doneAt = Array(N).fill(-9);
  const kHeld = new Set(), pops = [], bits = [], streams = [];
  let S = 0, ticked = -1, correct = 0, failed = 0, nx = 400, sel = 0, nzSent = -9, lastNz = '', nzV = 400, selV = 0, cdUntil = -9, whiffAt = -9, resAt = -1, scoopAct = -9, held = false;
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const okOf = i => q[i] === 1 && (want[i] === 2 ? sauce[i] < 0 : sauce[i] === want[i]);
  const dOf = i => S - gI(i);
  const cooking = i => q[i] < 0 && dOf(i) >= -CK && dOf(i) <= GONE;
  const pop = (s, x, y, size, bgc) => { pops.length = 0; pops.push({ s, x, y, size, bgc, t0: g.c, rot: (hsh(g.c * 9) - .5) * .14 }); };
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .6, gr: 700, r: 3 }, o)); }

  function scoopI(i) {
    if (i < 0 || q[i] >= 0) return false;
    const ph = phaseOf(dOf(i)); q[i] = ph; scAt[i] = S; scoopAct = g.c; D.send('sc', [i, ph]); sfx.pop(); snd(520 + ph * 160, .09, 'triangle', .06, 0, 900); noise(.12, .04, 1500, 400, 'bandpass');
    for (let k = 0; k < 7; k++) bit({ x: SLOTX(i), y: SLOTY, vx: (hsh(k + i) - .5) * 200, vy: -120 - hsh(k) * 160, c: '#ffd36a', r: 3 });
    pop(ph === 1 ? 'PERFECT!' : ph === 0 ? 'RAW!' : 'BURNT!', clamp(pxAt(i, S), 130, 640), BY - 80, 26, ph === 1 ? '#e0a010' : '#8a4a2c');
    return true;
  }
  function scoopAt(p) {
    let best = -1, bd = 1e9;
    if (p && p.y < 470) for (let i = 0; i < N; i++) if (cooking(i)) { const dd = Math.hypot(p.x - SLOTX(i), p.y - SLOTY); if (dd < 66 && dd < bd) { bd = dd; best = i; } }
    if (best < 0) { bd = 1e9; for (let i = 0; i < N; i++) if (cooking(i)) { const dd = Math.abs(dOf(i)); if (dd < bd) { bd = dd; best = i; } } }
    if (best < 0 || !scoopI(best)) whiffAt = g.c;
  }
  function squirt(x) {
    if (g.c < cdUntil || g.result) return; cdUntil = g.c + .22; if (x !== undefined) nx = clamp(x, 20, 780);
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) { const px = pxAt(i, S); if (px < 20 || px > SAUMAX || sauce[i] >= 0 || done[i]) continue; const dd = Math.abs(px - nx); if (dd <= 48 && dd < bd) { bd = dd; best = i; } }
    streams.push({ x: nx, t0: g.c, c: sel ? KET : GUA });
    if (best >= 0) { sauce[best] = sel; sqAt[best] = S; D.send('sq', [best, sel]); sfx.splat(); } else { sfx.click(); }
  }
  function key(e) {
    const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
    if (fry) { if (c === 'Space' || c === 'Enter' || c === 'ArrowDown' || c === 'KeyS') { scoopAt(null); } return; }
    if (c === 'KeyZ' || c === 'Digit1' || c === 'KeyQ') sel = 0; else if (c === 'KeyX' || c === 'Digit2' || c === 'KeyE') sel = 1;
    else if (c === 'Space' || c === 'Enter' || c === 'ArrowDown') {
      let best = -1, bd = 1e9; for (let i = 0; i < N; i++) { const px = pxAt(i, S); if (px < 20 || px > SAUMAX || sauce[i] >= 0) continue; const dd = Math.abs(px - nx); if (dd < bd) { bd = dd; best = i; } }
      if (best >= 0 && bd > 48 && bd <= 110) nx = pxAt(best, S);
      squirt();
    } else if (c.startsWith('Arrow') || c.startsWith('Key')) kHeld.add(c);
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: fry ? 'SCOOP!' : 'SQUIRT!', roleLabel: fry ? 'FRYER' : 'SAUCE',
    hint: fry ? 'TAP A TEQUEÑO WHEN ITS RING IS GOLDEN (SPACE TOO) - TOO EARLY IS RAW, TOO LATE IS BURNT. YOUR FRIEND SAUCES THE PLATES' : 'THE TÍO TELLS YOU THE SAUCE FOR EACH PLATE: PICK THE BOTTLE (Z / X), AIM (DRAG OR ◄ ►) AND SQUIRT (TAP OR SPACE) - NO TAG MEANS NO SAUCE',
    thint: fry ? 'TAP A TEQUEÑO WHEN ITS RING IS GOLDEN - YOUR FRIEND SAUCES THE PLATES' : 'PICK THE BOTTLE, DRAG TO AIM AND TAP TO SQUIRT THE SAUCE EACH PLATE ASKS FOR',
    update(dt) {
      g.c += dt; S = g.c * TS; if (g.result && resAt < 0) resAt = g.c;
      // the metronome tick at every golden moment (both screens)
      for (let k = ticked + 1; k < N; k++) if (S >= gI(k)) { ticked = k; snd(k % 2 ? 660 : 880, .06, 'square', .035); noise(.03, .03, 5000, 5000, 'highpass'); }
      // plate verdicts: a moment after it passes the tío (so a late message still counts)
      for (let i = 0; i < N; i++) if (!done[i] && S >= tJ(i) + .3 * TS) {
        done[i] = true; doneAt[i] = g.c; okv[i] = okOf(i);
        if (okv[i]) { correct++; sfx.coin(); pop('UEPA!', clamp(pxAt(i, S), 140, 640), BY - 84, 30, '#2ea84a'); } else { failed++; sfx.miss(); pop('SPLAT!', 640, BY - 84, 26, '#c9304a'); }
      }
      if (!fry) {
        let kd = 0; for (const c of kHeld) { if (c === 'ArrowLeft' || c === 'KeyA') kd--; else if (c === 'ArrowRight' || c === 'KeyD') kd++; }
        if (kd && !g.result) nx = clamp(nx + kd * 520 * dt, 20, 780);
        const k = Math.round(nx) + ',' + sel; if (k !== lastNz && g.c - nzSent >= .1) { lastNz = k; nzSent = g.c; D.send('nz', [Math.round(nx), sel], true); }
      } else {
        nzV += (nx - nzV) * Math.min(1, dt * 12);
        if (!g.result) { if (correct >= NEED) g.finish('win'); else if (failed > N - NEED || g.c >= g.limit) g.finish('lose'); }
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = streams.length - 1; i >= 0; i--) if (g.c - streams[i].t0 > .3) streams.splice(i, 1);
      if (pops.length && g.c - pops[0].t0 > 1.1) pops.length = 0;
    },
    msg(type, d) {
      if (type === 'sc' && Array.isArray(d)) { const i = d[0] | 0; if (i >= 0 && i < N && q[i] < 0) { q[i] = d[1] | 0; scAt[i] = S; sfx.pop(); for (let k = 0; k < 6; k++) bit({ x: SLOTX(i), y: SLOTY, vx: (hsh(k + i) - .5) * 200, vy: -120 - hsh(k) * 160, c: '#ffd36a', r: 3 }); } }
      else if (type === 'sq' && Array.isArray(d)) { const i = d[0] | 0; if (i >= 0 && i < N && sauce[i] < 0) { sauce[i] = d[1] | 0; sqAt[i] = S; } }
      else if (type === 'nz' && Array.isArray(d)) { nx = clamp(+d[0] || 0, 20, 780); selV = d[1] ? 1 : 0; streams.length || 0; }
    },
    draw() {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      X = ctx; if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      const beatK = clamp(1 - ((S - T0 - .7) % SPACE) / .3, 0, 1) * (S >= T0 + .7 ? 1 : 0);
      garland(T); neon(T); discoball(T, beatK); speakers(beatK);
      // characters behind the buffet
      const winLine = won && rk >= 0;
      chef(430, 320, won ? 'happy' : lost ? 'sad' : null, T, fry ? myCol() : pCol(), g.c - scoopAct < .35 ? g.c - scoopAct : 0);
      if (!winLine) { tio(610, 320, won ? 'happy' : lost ? 'sad' : null, T, !g.result && false); tia(725, 320, lost ? 'sad' : null, T, lost && rk > .75 ? clamp((rk - .75) * 4, 0, 1) : 0); }
      X.drawImage(BG, 0, 316, W, 58, 0, 316, W, 58);                         // the counter in front of their legs
      // the fryer: oil window, bubbles, tequeños
      rr(62, 214, 286, 100, 12); ink('#ffb82e', 4);
      X.save(); rr(62, 214, 286, 100, 12); X.clip(); X.fillStyle = '#ff9a1f'; X.fillRect(62, 270, 286, 60);
      for (let i = 0; i < 12; i++) { const k = (T * .6 + hsh(i) * 3) % 1; X.globalAlpha = .75 * (1 - k * .4); el(76 + hsh(i + 3) * 258, 300 - k * 80, 3 + hsh(i) * 4, 3 + hsh(i) * 4); X.fillStyle = '#ffe9a0'; X.fill(); X.globalAlpha = 1; }
      X.restore(); glint(110, 224, 30, 4, 0, .45);
      for (let i = 0; i < N; i++) {
        const d = dOf(i); if (q[i] >= 0 || d < -CK - .2 || d > GONE + .3) continue;
        const ph = phaseOf(d), bob = Math.sin(T * 6 + i * 2) * 2.5, sink = d > GONE ? clamp((d - GONE) / .3, 0, 1) : 0, x = SLOTX(i), y = SLOTY + bob + sink * 30;
        X.globalAlpha = 1 - sink; tequeno(x, y, ph, Math.sin(T * 3 + i) * .12, 1.15, T); X.globalAlpha = 1;
        if (fry && d <= GONE) {                                              // the timer ring: pale track, golden arc, a sweeping dot
          const span = CK + GONE, a0 = -Math.PI / 2 + TAU * ((CK - GOLD) / span), a1 = -Math.PI / 2 + TAU * ((CK + GOLD) / span), f = clamp((d + CK) / span, 0, 1), ang = -Math.PI / 2 + TAU * f;
          X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.arc(x, y, 31, 0, TAU); X.stroke();
          X.lineWidth = 5; X.strokeStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.arc(x, y, 31, 0, TAU); X.stroke();
          X.strokeStyle = ph === 1 ? '#fff25a' : '#ffc928'; X.lineWidth = ph === 1 ? 8 : 6; X.beginPath(); X.arc(x, y, 31, a0, a1); X.stroke();
          if (ph === 2) { X.strokeStyle = '#ff4d5e'; X.lineWidth = 5; X.beginPath(); X.arc(x, y, 31, a1, ang); X.stroke(); }
          X.beginPath(); X.arc(x + Math.cos(ang) * 31, y + Math.sin(ang) * 31, 6, 0, TAU); ink(ph === 1 ? '#5cff7a' : '#fff', 2.5);
          if (ph === 1) { star(x, y - 46, 11 + Math.sin(T * 14) * 2, 5, 5, T * 3, '#ffe14d', 2.5); }
        }
      }
      // the belt: moving treads, plates, tequeños and sauce
      X.fillStyle = '#5a5274'; for (let x = -((S * BV) % 40); x < W; x += 40) X.fillRect(x, 392, 18, 4), X.fillRect(x + 20, 410, 18, 4);
      let front = -1;
      for (let i = 0; i < N; i++) {
        const px = pxAt(i, S); if (px < -60 || px > 860) continue;
        const fly = q[i] >= 0 ? clamp((S - scAt[i]) / (.35 * TS), 0, 1) : -1;   // the scoop arcs from the fryer onto its plate
        const tq = q[i] >= 0 && fly >= 1 ? q[i] : -1;
        plate(px, BY, tq, sauce[i], T, done[i] && g.c - doneAt[i] < 2.2 ? (okv[i] ? 'ok' : 'bad') : null);
        if (fly >= 0 && fly < 1) { const sx = SLOTX(i), sy = SLOTY, tx = px, ty = BY - 6, k = ease(fly); tequeno(lerp(sx, tx, k), lerp(sy, ty, k) - Math.sin(k * Math.PI) * 90, q[i], k * 3, 1, T); }
        if (!done[i] && front < 0 && px > -30) front = i;
      }
      // the sauce gantry and nozzle
      X.fillStyle = INK; X.fillRect(0, GY - 6, W, 14); X.fillStyle = '#c9ced6'; X.fillRect(0, GY - 3, W, 8); X.fillStyle = 'rgba(255,255,255,.6)'; X.fillRect(0, GY - 3, W, 2.5);
      const nzx = fry ? nzV : nx, nzs = fry ? selV : sel, nc = nzs ? KET : GUA;
      rr(nzx - 16, GY - 12, 32, 22, 6); ink('#8f9cb3', 3); rr(nzx - 6, GY + 6, 12, TIPY - GY - 4, 4); ink(nc[0], 3); X.beginPath(); X.moveTo(nzx - 7, TIPY); X.lineTo(nzx + 7, TIPY); X.lineTo(nzx, TIPY + 9); X.closePath(); ink('#fff', 2.5);
      for (const s of streams) { const a = (g.c - s.t0) / .3; X.globalAlpha = clamp(1 - a, 0, 1); line([[s.x, TIPY + 8], [s.x, BY - 8]], 8 * (1 - a * .4), s.c[1]); line([[s.x, TIPY + 8], [s.x, BY - 8]], 4.5 * (1 - a * .4), s.c[0]); X.globalAlpha = 1; }
      // SAUCE only: the order tag over each plate (nothing for FRYER: it cannot know)
      if (!fry) for (let i = 0; i < N; i++) { const px = pxAt(i, S); if (px < 10 || px > 790 || done[i]) continue; tag(px, TIPY + 4 + Math.sin(T * 5 + i) * 1.5, want[i]); }
      // the tío's bubble: what he wants for the plate in front (SAUCE reads it; FRYER sees him talking)
      if (!g.result && !winLine) {
        const i = front >= 0 ? front : 0, bx = 610, by = 170, w = want[i];
        X.beginPath(); X.moveTo(bx - 8, by + 36); X.lineTo(bx + 4, by + 62); X.lineTo(bx + 16, by + 36); X.closePath(); ink('#fff', 3);
        el(bx, by, 52, 38); ink('#fff', 4);
        if (fry) { for (let k = 0; k < 3; k++) { el(bx - 20 + k * 20, by + Math.sin(T * 6 + k) * 3, 5, 5); X.fillStyle = INK; X.fill(); } }
        else if (w === 2) { X.beginPath(); X.arc(bx, by - 4, 14, 0, TAU); X.lineWidth = 6; X.strokeStyle = '#ff4d5e'; X.stroke(); line([[bx - 10, by + 6], [bx + 10, by - 14]], 6, '#ff4d5e'); txt('NONE', bx, by + 22, 15, INK, 'center', 90); }
        else { const c = w ? KET : GUA; el(bx, by - 6, 21, 15); ink(c[0], 3); glint(bx - 7, by - 12, 7, 3.4); txt(w ? 'KETCHUP' : 'GUASACACA', bx, by + 20, 15, INK, 'center', 96); }
      }
      // the score board (a row of plates in the world) top right
      rr(470, 64, 290, 44, 16); ink('#6b4a2c', 4); X.fillStyle = '#8a5e36'; rr(476, 70, 278, 32, 12); X.fill();
      for (let i = 0; i < N; i++) { const x = 500 + i * 40, st = done[i] ? (okv[i] ? 1 : 2) : 0; el(x, 86, 15, 11); ink(st === 1 ? '#5cff7a' : st === 2 ? '#ff4d5e' : '#e7ecf6', 2.5); if (st === 1) txt('✓', x, 87, 18, INK, 'center', 20); else if (st === 2) txt('✗', x, 87, 18, INK, 'center', 20); }
      // the metronome: one pip per golden moment, pulses on the beat
      rr(150, 446, 500, 24, 12); ink('#fff7e0', 3.5);
      for (let k = 0; k < N; k++) { const x = 150 + 24 + k * (452 / (N - 1)), p = clamp(1 - Math.abs(S - gI(k)) / .22, 0, 1), dn = S > gI(k) + .22; el(x, 458, 7 + p * 6, 7 + p * 6); ink(dn ? '#b9b2c9' : p > 0 ? '#ffe14d' : '#ffb23d', 2.5); }
      const mk = clamp((S - gI(0) + .5) / (gI(N - 1) - gI(0) + 1), 0, 1); line([[168 + mk * 452 - 2, 450], [168 + mk * 452 - 2, 466]], 4, '#ff4d5e');
      // controls
      if (fry) {
        const near = (() => { let b = 9; for (let i = 0; i < N; i++) if (cooking(i)) b = Math.min(b, Math.abs(dOf(i))); return b; })(), live = near < GOLD;
        cap(250, 482, 300, 62, live ? '#5CFF7A' : '#ffd23f', live ? '#23a046' : '#c99512', held || g.c - scoopAct < .12, 'SCOOP!', 26, 'SPACE');
      } else {
        cap(60, 482, 300, 62, GUA[0], GUA[1], sel === 0, 'GUASACACA', 22, 'Z'); cap(440, 482, 300, 62, KET[0], KET[1], sel === 1, 'KETCHUP', 22, 'X');
        bottle(46, 518, GUA, '', -.3, T); bottle(754, 518, KET, '', .3, T);
        rr(sel ? 436 : 56, 478, 308, 70, 20); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke();
      }
      if (fry) { pill(430, 230, 'YOU', myCol()); pill(nzx, GY - 30, 'YOUR FRIEND', pCol()); } else pill(nzx, GY - 30, 'YOU', myCol());
      if (!fry) pill(430, 230, 'YOUR FRIEND', pCol());
      // win: the trencito crosses the buffet; lose: the tequeño lands on the tía's dress
      if (winLine) {
        const k = rk, cols = ['#3fa7e0', '#ff9ccd', fry ? myCol() : pCol(), fry ? pCol() : myCol()], head = -60 + k * 520;
        for (let j = 0; j < 4; j++) { const x = head - j * 64, hop = Math.abs(Math.sin(k * 11 + j)) * 14; if (x < -80 || x > 880) continue; mini(x, 352 - hop, 3.6, cols[j], 'happy'); if (j) line([[x + 8, 330 - hop], [x + 52, 330 - (hop + 0)]], 6, cols[j]); }
        for (let i = 0; i < 8; i++) { const a = k * 2 + i, x = 100 + i * 90, y = 190 + (i % 3) * 34; star(x, y, 8 + Math.sin(a * 3) * 3, 3.5, 5, a, ['#FFE14D', '#ff4fa3', '#4db8ff', '#5cff7a'][i % 4], 0); }
        badge('TRENCITO!', 400, 215, 46, '#ff4fa3', '#fff', outBack(k / .25), -.05);
      }
      if (lost && rk >= 0) {
        const k = clamp(rk / .7, 0, 1), sx = 470, sy = 340, tx = 722, ty = 300, qx = lerp(sx, tx, ease(k)), qy = lerp(sy, ty, k) - Math.sin(k * Math.PI) * 130;
        if (k < 1) { tequeno(qx, qy, 1, k * 9, 1.4, T); } else if (rk < 1.5) { for (let i = 0; i < 5; i++) { const a = i * 1.25; el(tx + Math.cos(a) * (rk - .7) * 40, ty + Math.sin(a) * (rk - .7) * 30 - 10, 5, 5); ink('#ffb629', 2); } }
        if (rk > .7) badge('MY DRESS!', 560, 225, 34, '#e8434f', '#fff', outBack((rk - .7) / .25), .05);
      }
      for (const b of bits) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); el(b.x, b.y, b.r, b.r * 1.3); ink(b.c, 1.5); X.globalAlpha = 1; }
      for (const p of pops) { const a = T - p.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(p.s, p.x, Math.max(130, p.y - Math.min(a, .6) * 14), p.size, p.bgc, '#fff', a < .2 ? outBack(a / .2) : 1, p.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(fry ? 'SCOOP ON GOLD!' : 'MATCH THE ORDER!', 300, 150, 20, fry ? '#e0a010' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
    down(p) {
      held = true;
      if (fry) { if (p.y > 478 && p.x > 240 && p.x < 560) scoopAt(null); else scoopAt(p); return; }
      if (p.y >= 474) { sel = p.x < 400 ? 0 : 1; sfx.click(); return; }
      nx = clamp(p.x, 20, 780); squirt();
    },
    up() { held = false; },
    move(p) { if (!fry && p.y < 474 && p.x !== undefined) nx = clamp(p.x, 20, 780); },
    key, keyup(e) { kHeld.delete(e.code); },
  };
  g.dbg = {
    N, NEED, BV, X0, JX, SAUMAX, SLOTX, SLOTY, BY, want, q, sauce, gI, tI, tJ,
    S: () => S, correct: () => correct, failed: () => failed,
    /* what the FRYER screen shows: every tequeño still in the oil, and where its timer ring is */
    fryView: () => { const a = []; for (let i = 0; i < N; i++) if (cooking(i)) a.push({ i, d: dOf(i), x: SLOTX(i), y: SLOTY, ph: phaseOf(dOf(i)) }); return a; },
    /* what the SAUCE screen shows: the plates with their tags, what is on them, the nozzle and the chosen bottle */
    salView: () => ({ nx, sel, plates: want.map((w, i) => ({ i, x: pxAt(i, S), want: w, sauce: sauce[i], q: q[i], done: done[i] })).filter(p => p.x > -60 && p.x < 860) }),
  };
  wire(g, D, 0, sp, 'du_tequeno');
  return g;
}
reg('du_tequeno', duTeq, 'TEQUEÑOS A TIEMPO'); REGMAP.du_tequeno.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4, k = (u % 2) / 2;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  let gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#6a3fc4'); gr.addColorStop(1, '#c46fe0'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#f6e3b4'; X.fillRect(0, 150, 520, 90); X.fillStyle = '#3b3550'; X.fillRect(0, 168, 520, 44); X.fillStyle = INK; X.fillRect(0, 164, 520, 5);
  if (role === 0) {
    rr(40, 24, 200, 108, 14); ink('#c9ced6', 4); rr(50, 34, 180, 88, 10); X.fillStyle = '#ff9a1f'; X.fill();
    const d = ((u % 2) * 1.6) - 1.0, ph = phaseOf(d), x = 140, y = 80;
    tequeno(x, y, ph, 0, 1.4, tt);
    const a0 = -Math.PI / 2 + TAU * .25, a1 = -Math.PI / 2 + TAU * .62, ang = -Math.PI / 2 + TAU * clamp((d + 1.7) / 3.1, 0, 1);
    X.lineWidth = 11; X.strokeStyle = INK; X.beginPath(); X.arc(x, y, 38, 0, TAU); X.stroke(); X.lineWidth = 6; X.strokeStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.arc(x, y, 38, 0, TAU); X.stroke();
    X.strokeStyle = '#ffd23f'; X.lineWidth = 8; X.beginPath(); X.arc(x, y, 38, a0, a1); X.stroke(); X.beginPath(); X.arc(x + Math.cos(ang) * 38, y + Math.sin(ang) * 38, 7, 0, TAU); ink('#fff', 2.5);
    plate(380, 190, ph === 1 && u % 2 > 1.1 ? 1 : -1, -1, tt, null); plate(470 - ((u % 2) * 60), 190, -1, -1, tt, null);
    DUO.demoFinger(x + 40, y + 40, ph === 1, ((u % 2) % .5) * 2); badge('TAP ON GOLD!', 260, 30, 20, '#e0a010', '#fff', 1, -.03);
  } else {
    const px = 60 + (u / 4) * 400; plate(px, 190, 1, u > 2 ? 0 : -1, tt, null);
    el(430, 70, 44, 32); ink('#fff', 4); el(430, 66, 17, 12); ink(GUA[0], 3); glint(425, 62, 6, 3);
    tio(480, 150, null, tt, false);
    const nx = 60 + (Math.min(u, 2.6) / 4) * 400; rr(nx - 14, 118, 28, 18, 5); ink('#8f9cb3', 3); X.fillStyle = INK; X.fillRect(0, 112, 520, 6);
    if (u > 2 && u < 2.5) { line([[nx, 140], [nx, 176]], 8, GUA[1]); line([[nx, 140], [nx, 176]], 4.5, GUA[0]); }
    cap(60, 12, 130, 44, GUA[0], GUA[1], true, 'GUASACACA', 16); cap(210, 12, 130, 44, KET[0], KET[1], false, 'KETCHUP', 16);
    DUO.demoFinger(nx, 138, u > 2 && u < 2.5, (u - 2) * 2); badge('MATCH THE ORDER!', 260, 100, 18, '#2b9ee6', '#fff', 1, -.03);
  }
  X.restore();
}
DUO.INFO.du_tequeno = [['FRYER', 'SCOOP WHEN GOLDEN', 'TAP / CLICK / SPACE'], ['SAUCE', 'SQUIRT WHAT HE WANTS', 'DRAG TO AIM, TAP, Z / X']];
DUO.DEMOS.du_tequeno = [t => demo(0, t), t => demo(1, t)];

})();
