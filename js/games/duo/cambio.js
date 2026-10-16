'use strict';
/* ═════════ DUO · CASA DE CAMBIO (du_cambio): ¡DÓLAR, A CÓMO ESTÁ! ═════════
   A street exchange stall in a Venezuelan barrio. Customers want dollars, the rate on the chalkboard keeps changing.
   CHALKBOARD (role 0, JUDGE): sees the board (1 $ = N stacks, it changes every ~2.4 s, with a wobble just before) and the order ("give me 2 $").
   Works out N × order and taps the total (chip 1-12, + / −, or the keys): that is the number the cashier hears. Sees the cashier's tray mirrored.
   CASHIER (role 1): hears the total, has the till with stacks of mocho bills worth 1, 2 and 5 (tap = put in the tray, tap the tray / UNDO = take
   out) and must put EXACTLY that total in the tray, then HAND OVER. Sees the client's face and a shaking alcabala cop, but NOT the rate.
   Win: 4 clients paid right (the vivo goes ¡UEPA!). Lose: 3 clients storm off (wrong amount, or too slow) or time runs out.
   Netcode: the CHALKBOARD owns the rate schedule (seeded), the client index, the verdict. 'st' [nRes, client, total, served, strikes, lastOk, rateIdx]
   (absolute, latest, repeated every .4 s so a dropped message never matters). The CASHIER owns the tray: 'tray' [values...] (latest) and
   'give' [client, total]; the judge compares it with order × rate (the old rate still counts for 1 s after a change: lag is not the players' fault). */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

const CL = 392;                                         // the counter line: the stall's counter top, busts stand behind it
const NEED = 4, MAXSTRIKE = 3, PAT = 5.6, WALK = .6, GRACE = 1.0;
const RATES = [2, 3, 4];
const BC = { 1: '#8fd96b', 2: '#ffb25c', 5: '#6fb7ff' }, BD = { 1: '#3f8f35', 2: '#c26a22', 5: '#2f64c0' };
const STK = [{ v: 1, x: 36, y: 420, w: 112, h: 78, k: '1' }, { v: 2, x: 156, y: 420, w: 112, h: 78, k: '2' }, { v: 5, x: 276, y: 420, w: 112, h: 78, k: '3' }];
const TRAY = { x: 404, y: 420, w: 216, h: 78 }, TOT = { x: 630, y: 420, w: 134, h: 78 };
const UNDO = { x: 36, y: 506, w: 140, h: 42 }, GIVE = { x: 190, y: 506, w: 574, h: 42 };
const MINUS = { x: 36, y: 420, w: 100, h: 78 }, DISP = { x: 146, y: 420, w: 150, h: 78 }, PLUS = { x: 306, y: 420, w: 100, h: 78 }, MIRR = { x: 430, y: 420, w: 334, h: 78 };
const chipR = n => ({ x: 36 + (n - 1) * 60, y: 506, w: 56, h: 42 });
const inR = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const ctr = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const SKIN = ['#f2c29b', '#d99b6c', '#b97a4e', '#8d5a3a'], SHIRT = ['#e8434f', '#2f6fd6', '#ffd23f', '#5fc46a', '#ff8fb8', '#b58cff'], HAIR = ['#2a1c14', '#4a2c1a', '#14101c', '#6b4a2c'];

/* ───────────── tiny drawing kit (X is ctx while playing, an offscreen context while the backdrop is baked) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
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
function heart(x, y, s, col, cracked) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-16, -2, -10, -14, 0, -6); X.bezierCurveTo(10, -14, 16, -2, 0, 8); X.closePath(); ink(col, 2.5);
  if (cracked) line([[0, -6], [-3, -1], [2, 2], [-1, 7]], 2.4, INK); else { X.fillStyle = 'rgba(255,255,255,.55)'; el(-5, -5, 2.6, 1.7, -.5); X.fill(); }
  X.restore();
}
/* a mocho bill (one corner bitten off): v = 1, 2 or 5 */
function bill(x, y, w, h, v, rot) {
  X.save(); X.translate(x, y); X.rotate(rot || 0);
  X.beginPath(); X.moveTo(-w / 2 + 4, -h / 2); X.lineTo(w / 2 - 4, -h / 2); X.lineTo(w / 2, -h / 2 + 4); X.lineTo(w / 2, h / 2 - 4); X.lineTo(w / 2 - 4, h / 2);
  X.lineTo(-w / 2 + 12, h / 2); X.lineTo(-w / 2 + 7, h / 2 - 5); X.lineTo(-w / 2 + 2, h / 2 - 1); X.lineTo(-w / 2, h / 2 - 7); X.lineTo(-w / 2, -h / 2 + 4); X.closePath(); ink(BC[v] || BC[1], 2.5);
  X.strokeStyle = BD[v] || BD[1]; X.lineWidth = 1.6; rr(-w / 2 + 5, -h / 2 + 4, w - 10, h - 8, 2); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-w / 2 + 3, -h / 2 + 2, w * .4, 3);
  if (w > 26) { el(-w * .22, 0, h * .18, h * .26); X.fillStyle = BD[v] || BD[1]; X.fill(); }
  txt(String(v), w > 26 ? w * .18 : 0, 1, Math.max(10, h * .5), '#fff', 'center', w * .6);
  X.restore();
}
function plate(r, col, dk, down, glow) {
  const d = down ? 3 : 8;
  rr(r.x, r.y + 8, r.w, r.h, 16); ink(dk, 4);
  rr(r.x, r.y + 8 - d, r.w, r.h, 16); ink(col, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(r.x + 8, r.y + 12 - d, r.w - 16, 8, 4); X.fill();
  if (glow) { X.globalAlpha = .55 + .4 * Math.sin(now * 10); X.strokeStyle = '#fff'; X.lineWidth = 4; rr(r.x + 6, r.y + 14 - d, r.w - 12, r.h - 12, 12); X.stroke(); X.globalAlpha = 1; }
  return 8 - d;
}

/* ───────────── people ───────────── */
function brow(x, y, dir, w) { line([[x - 7, y - dir * 4], [x + 7, y + dir * 4]], w, INK); }
/* a bust standing behind the counter (origin = counter line, centre x); mood: calm / wait / angry / happy / sad */
function bust(x, yc, L, mood, T, o) {
  o = o || {}; const s = o.s || 1, bob = Math.sin(T * 3 + L.ph) * 1.2;
  X.save(); X.translate(x, yc + (o.dy || 0)); X.scale(s, s); if (o.rot) X.rotate(o.rot);
  const up = o.arms || 0;
  if (up > 0) for (const sx of [-1, 1]) { const w = Math.sin(T * 16 + sx) * 6 * up; line([[sx * 28, -26], [sx * (42 + w * .3), -26 - 46 * up]], 11, L.skin); X.beginPath(); X.arc(sx * (42 + w * .3), -26 - 52 * up, 7, 0, TAU); ink(L.skin, 3); }
  X.beginPath(); X.moveTo(-36, 12); X.quadraticCurveTo(-38, -44, -14, -54 + bob); X.lineTo(14, -54 + bob); X.quadraticCurveTo(38, -44, 36, 12); X.closePath(); ink(L.shirt, 4);
  X.save(); X.beginPath(); X.moveTo(-36, 12); X.quadraticCurveTo(-38, -44, -14, -54 + bob); X.lineTo(14, -54 + bob); X.quadraticCurveTo(38, -44, 36, 12); X.closePath(); X.clip();
  X.fillStyle = 'rgba(20,16,28,.22)'; X.fillRect(14, -60, 30, 80); X.fillStyle = 'rgba(255,255,255,.28)'; X.fillRect(-30, -50 + bob, 8, 50); X.restore();
  rr(-7, -62 + bob, 14, 12, 4); ink(L.skin, 3);
  const hy = -82 + bob;
  el(0, hy, 25, 26); ink(L.skin, 4); X.fillStyle = 'rgba(20,16,28,.14)'; X.beginPath(); X.ellipse(8, hy + 3, 15, 22, 0, -1.4, 1.4); X.fill();
  if (mood === 'angry') { X.fillStyle = 'rgba(255,50,50,.38)'; el(0, hy, 24, 25); X.fill(); }
  if (L.hat === 1) { X.beginPath(); X.moveTo(-25, hy - 6); X.quadraticCurveTo(0, hy - 42, 25, hy - 6); X.lineTo(44, hy - 3); X.lineTo(-25, hy - 3); X.closePath(); ink('#e8434f', 3.5); X.fillStyle = '#fff'; el(0, hy - 18, 6, 4); X.fill(); }
  else if (L.hat === 2) { el(0, hy - 14, 40, 8); ink('#e6c58c', 3.5); X.beginPath(); X.moveTo(-20, hy - 14); X.quadraticCurveTo(-18, hy - 40, 0, hy - 40); X.quadraticCurveTo(18, hy - 40, 20, hy - 14); X.closePath(); ink('#f0d9a0', 3.5); X.fillStyle = '#b5521e'; X.fillRect(-19, hy - 20, 38, 5); }
  else { X.beginPath(); X.moveTo(-25, hy - 4); X.quadraticCurveTo(-26, hy - 32, 0, hy - 30); X.quadraticCurveTo(26, hy - 32, 25, hy - 4); X.quadraticCurveTo(14, hy - 18, 0, hy - 17); X.quadraticCurveTo(-14, hy - 18, -25, hy - 4); X.closePath(); ink(L.hair, 3.5); }
  const ey = hy - 1;
  for (const sx of [-1, 1]) {
    if (mood === 'happy') { X.strokeStyle = INK; X.lineWidth = 3.4; X.lineCap = 'round'; X.beginPath(); X.moveTo(sx * 9 - 6, ey + 3); X.lineTo(sx * 9, ey - 3); X.lineTo(sx * 9 + 6, ey + 3); X.stroke(); }
    else { el(sx * 9, ey, 6, mood === 'sad' ? 4.5 : 7); ink('#fff', 2); X.fillStyle = INK; el(sx * 9 + (o.look || 0) * 2, ey + 1, 2.8, 3.2); X.fill(); }
  }
  if (mood === 'angry') { brow(-9, ey - 11, 1, 4); brow(9, ey - 11, -1, 4); }
  else if (mood === 'wait') { line([[-15, ey - 11], [-4, ey - 12]], 3, INK); line([[4, ey - 12], [15, ey - 11]], 3, INK); }
  const my = hy + 14;
  if (mood === 'happy') { X.beginPath(); X.moveTo(-10, my - 4); X.quadraticCurveTo(0, my + 14, 10, my - 4); X.closePath(); ink('#7a1f2b', 2.5); X.fillStyle = '#fff'; X.fillRect(-7, my - 3, 14, 4); X.fillStyle = 'rgba(255,100,150,.7)'; el(-17, hy + 7, 5, 3); X.fill(); el(17, hy + 7, 5, 3); X.fill(); }
  else if (mood === 'angry') { X.beginPath(); X.moveTo(-10, my + 5); X.quadraticCurveTo(0, my - 8 + Math.sin(T * 40) * 1.5, 10, my + 5); X.quadraticCurveTo(0, my + 2, -10, my + 5); X.closePath(); ink('#7a1f2b', 2.5); X.fillStyle = '#fff'; X.fillRect(-6, my, 12, 3); }
  else if (mood === 'sad') { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(-7, my + 4); X.quadraticCurveTo(0, my - 4, 7, my + 4); X.stroke(); }
  else { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-6, my); X.lineTo(6, my + (mood === 'wait' ? 0 : 1)); X.stroke(); }
  if (mood === 'wait') { const k = (T * 1.6) % 1; X.globalAlpha = 1 - k; X.beginPath(); X.moveTo(28, hy - 14 + k * 12); X.quadraticCurveTo(35, hy - 4 + k * 12, 28, hy + 1 + k * 12); X.quadraticCurveTo(21, hy - 4 + k * 12, 28, hy - 14 + k * 12); ink('#9fe3ff', 2); X.globalAlpha = 1; }
  if (mood === 'angry') for (let i = 0; i < 3; i++) { const k = (T * 1.4 + i / 3) % 1; X.globalAlpha = 1 - k; el(-10 + i * 10, hy - 36 - k * 26, 6 + k * 6, 5 + k * 5); ink('#f1eef8', 2); X.globalAlpha = 1; }
  X.restore();
}
function cop(x, T, hot) {                                // the alcabala guardia: olive uniform, cap, shades, a stop paddle; shakes when things go wrong
  const sh = Math.sin(T * 38) * (hot ? 2.6 : .6), yc = CL;
  X.save(); X.translate(x + sh, yc);
  line([[30, -20], [48, -96]], 6, '#8a5a34'); X.beginPath(); X.arc(50, -108, 20, 0, TAU); ink('#e8434f', 4); txt('HALT', 50, -108, 12, '#fff', 'center', 34);
  X.beginPath(); X.moveTo(-34, 12); X.quadraticCurveTo(-36, -44, -14, -54); X.lineTo(14, -54); X.quadraticCurveTo(36, -44, 34, 12); X.closePath(); ink('#7e8f4a', 4);
  X.fillStyle = '#ffd23f'; el(-16, -34, 5, 5); X.fill(); X.fillStyle = INK; X.fillRect(-4, -54, 8, 66);
  rr(-7, -62, 14, 12, 4); ink('#c4895c', 3);
  el(0, -82, 24, 25); ink('#c4895c', 4);
  rr(-27, -112, 54, 22, 7); ink('#5b6b34', 4); rr(-33, -94, 66, 9, 4); ink('#3f4a24', 3); X.fillStyle = '#ffd23f'; X.beginPath(); X.arc(0, -102, 5, 0, TAU); X.fill();
  rr(-20, -88, 40, 12, 5); ink('#14101c', 2); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(-16, -86, 10, 3);
  line([[-12, -64], [12, -64]], 5, '#3a2418'); line([[-6, -58], [6, -58]], 3, INK);
  X.restore();
}

/* ───────────── backdrop (baked once): barrio street seen from inside the stall ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  const gr = X.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(.6, '#8fdcff'); gr.addColorStop(1, '#fff0c8'); X.fillStyle = gr; X.fillRect(0, 0, W, 340);
  X.beginPath(); X.arc(668, 168, 30, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(660, 160, 10, 6, -.6); X.fill();
  // the cerro with its ranchitos (far layer: no ink, tinted)
  X.beginPath(); X.moveTo(0, 340); X.lineTo(0, 190); X.quadraticCurveTo(110, 150, 220, 210); X.quadraticCurveTo(330, 170, 440, 250); X.lineTo(520, 340); X.closePath(); X.fillStyle = '#6fbf86'; X.fill();
  const pal = ['#ff9a8a', '#ffd479', '#8fd0ff', '#c9a6ff', '#9be38a', '#ffb7d4'];
  for (let i = 0; i < 26; i++) { const bx = 8 + (i % 13) * 33, by = 205 + Math.floor(i / 13) * 34 + (i * 7 % 19) + Math.abs(6.5 - (i % 13)) * 6, w = 22 + (i * 5 % 9), h = 17 + (i * 3 % 8); X.fillStyle = pal[i % 6]; X.fillRect(bx, by, w, h); X.fillStyle = 'rgba(20,16,28,.25)'; X.fillRect(bx, by, w, 3); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(bx + 4, by + 7, 5, 6); }
  // buildings along the street
  const cols = ['#ffb86b', '#7fd1c9', '#ff8fa8', '#ffe08a', '#9fb6ff'];
  for (let i = 0; i < 6; i++) { const bx = 380 + i * 90, bh = 120 + (i * 37 % 60), by = CL - 62 - bh; rr(bx, by, 84, bh + 70, 6); ink(cols[i % 5], 3.5);
    for (let r = 0; r < Math.floor(bh / 44); r++) for (let c = 0; c < 2; c++) { rr(bx + 14 + c * 36, by + 14 + r * 44, 24, 28, 4); ink('#7ec8f0', 2.5); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(bx + 17 + c * 36, by + 17 + r * 44, 6, 8); } }
  // palm tree
  line([[330, CL - 40], [340, CL - 120], [326, CL - 190]], 14, '#a77544'); for (let i = 0; i < 6; i++) { const a = -2.6 + i * .5; X.beginPath(); X.moveTo(326, CL - 192); X.quadraticCurveTo(326 + Math.cos(a) * 40, CL - 192 + Math.sin(a) * 40 - 30, 326 + Math.cos(a) * 80, CL - 192 + Math.sin(a) * 60 + 14); X.quadraticCurveTo(326 + Math.cos(a) * 40, CL - 192 + Math.sin(a) * 30 + 6, 326, CL - 192); ink('#3fb260', 3); }
  // street + sidewalk
  X.fillStyle = '#7d7894'; X.fillRect(0, 346, W, 60); X.fillStyle = '#cfc8d8'; X.fillRect(0, 330, W, 20); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 330); X.lineTo(W, 330); X.stroke();
  X.fillStyle = '#ffd23f'; for (let x = 10; x < W; x += 90) X.fillRect(x, 372, 46, 5);
  // power line with sneakers hung over it (a classic)
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 150); X.quadraticCurveTo(400, 190, 800, 138); X.stroke();
  // stall: posts, awning, counter
  rr(-10, 56, 34, 560, 8); ink('#a5622c', 4); rr(776, 56, 34, 560, 8); ink('#a5622c', 4);
  const sc = ['#ffd23f', '#2f6fd6', '#e8434f'];
  for (let i = 0; i < 10; i++) { const x0 = i * 80; X.beginPath(); X.moveTo(x0, 50); X.lineTo(x0 + 80, 50); X.lineTo(x0 + 80, 98); X.quadraticCurveTo(x0 + 40, 128, x0, 98); X.closePath(); ink(sc[i % 3], 4); X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(x0 + 62, 50, 18, 56); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(x0 + 6, 54, 10, 40); }
  rr(-4, CL, W + 8, 40, 10); ink('#f2b878', 4); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(10, CL + 5, W - 20, 6);
  X.fillStyle = '#b97a46'; X.fillRect(0, CL + 36, W, H); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, CL + 36); X.lineTo(W, CL + 36); X.stroke();
  X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 3; for (let x = 0; x < W; x += 100) { X.beginPath(); X.moveTo(x, CL + 38); X.lineTo(x, H); X.stroke(); }
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 0; x < W; x += 100) X.fillRect(x + 6, CL + 40, 8, 160);
  X = old; return cv;
}
function buseta(x, T) {                                  // a little yellow-and-blue buseta rolling past (the moving gag), wheels turning
  X.save(); X.translate(x, 352); const b = Math.sin(T * 14) * 1.2; X.translate(0, b);
  rr(-70, -44, 140, 52, 12); ink('#ffd23f', 4); X.fillStyle = '#2f6fd6'; X.fillRect(-66, -10, 132, 7);
  for (let i = 0; i < 4; i++) { rr(-58 + i * 30, -36, 24, 20, 4); ink('#bfeaff', 2.5); }
  rr(-76, -26, 12, 28, 5); ink('#e8434f', 3);
  for (const wx of [-42, 40]) { X.save(); X.translate(wx, 12); X.rotate(T * 9); X.beginPath(); X.arc(0, 0, 13, 0, TAU); ink('#3b3550', 3.5); X.fillStyle = '#c9ced6'; X.fillRect(-2, -10, 4, 20); X.fillRect(-10, -2, 20, 4); X.restore(); }
  X.restore();
}
function sneakers(T) { const sw = Math.sin(T * 1.6) * .12; X.save(); X.translate(396, 172); for (const [dx, dy] of [[0, 0], [16, 4]]) { X.save(); X.translate(dx, dy); X.rotate(sw); line([[0, -10], [0, 8]], 2.5, INK); X.beginPath(); X.moveTo(-9, 8); X.lineTo(9, 8); X.lineTo(13, 20); X.lineTo(-9, 20); X.closePath(); ink(dx ? '#fff' : '#e8434f', 2.5); X.restore(); } X.restore(); }
function bunting(T) {                                    // tricolor banderines under the awning
  for (let i = 0; i < 16; i++) { const x = 20 + i * 48, y = 118 + Math.sin(i * .7 + T * 2) * 3 + Math.sin(i * 1.3) * 6; X.beginPath(); X.moveTo(x - 10, y); X.lineTo(x + 10, y); X.lineTo(x, y + 20); X.closePath(); ink(['#ffd23f', '#2f6fd6', '#e8434f'][i % 3], 2.5); }
}

/* ═════════ the game ═════════ */
function duCambio(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), judge = D.role === 0, TS = Math.sqrt(sp);
  /* the level, from the seed: the clients and the rate schedule */
  const cl = [];
  for (let i = 0; i < 14; i++) cl.push({ A: 1 + Math.floor(R() * 3), skin: SKIN[Math.floor(R() * 4)], shirt: SHIRT[Math.floor(R() * 6)], hair: HAIR[Math.floor(R() * 4)], hat: Math.floor(R() * 3), side: R() < .5 ? -1 : 1, ph: R() * 6 });
  const rt = [0], rv = [RATES[Math.floor(R() * 3)]];
  rt.push((2.5 + R() * .5) / TS); for (let i = 2; i < 12; i++) rt.push(rt[i - 1] + (2.1 + R() * .7) / TS);
  for (let i = 1; i < 12; i++) { let n; do n = RATES[Math.floor(R() * 3)]; while (n === rv[i - 1]); rv.push(n); }
  const rIdx = T => { let k = 0; for (let i = 0; i < rt.length; i++) if (rt[i] <= T) k = i; return k; };
  const patience = PAT / TS;
  /* shared view state */
  let ci = 0, nRes = 0, served = 0, strikes = 0, lastOk = 1, tgt = 0, rk = 0;
  const arrive = [0]; let readyAt = WALK, rkSeen = 0, rkAt = -9;
  const leave = [], bits = [], pops = [];
  let resAt = -1, stSent = -9, stDirty = true, lastTray = '', trayAt = -9, hitAt = -9, giveAt = -9, jTray = [], tray = [], held = -1, heldAt = -9, stormed = false, winFinal = false;
  let cr = 7; const rnd = () => (cr = cr * 16807 % 2147483647) / 2147483647;
  const sum = a => a.reduce((s, v) => s + v, 0);
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const WX = judge ? 560 : 470;
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (rnd() - .5) * .14 }); }
  function flyBills(x, y, n) { for (let i = 0; i < n; i++) bits.push({ x: x + (rnd() - .5) * 40, y, vx: (rnd() - .5) * 420, vy: -(180 + rnd() * 380), v: [1, 2, 5][Math.floor(rnd() * 3)], r: rnd() * 6, vr: (rnd() - .5) * 14, t0: g.c, life: 1.6 }); }
  function leaver(idx, ok, final) { leave.push({ idx, ok, final, at: g.c }); if (ok) { sfx.coin(); if (!final) sfx.sparkle(); } else { sfx.miss(); sfx.buzz && sfx.buzz(); shake(7, .22); flyBills(WX, CL - 40, 11); pop('WHAT A RIP-OFF!', 400, 214, 30, '#e8434f', '#fff'); } }
  function nextClient(res, final) {                    // a result happened for the client `ci`: it leaves, the next one walks in
    leaver(ci, res, final); ci = Math.min(ci + 1, cl.length - 1); arrive[ci] = g.c; tray = []; lastTray = '';
  }
  function resolve(ok) {                               // JUDGE only
    nRes++; lastOk = ok ? 1 : 0; if (ok) served++; else strikes++;
    const final = ok && served >= NEED; nextClient(ok, final);
    tgt = 0; readyAt = g.c + WALK; stDirty = true; hitAt = g.c; jTray = [];
    sendSt();
    if (served >= NEED) g.finish('win'); else if (strikes >= MAXSTRIKE) g.finish('lose');
  }
  function sendSt() { stSent = g.c; stDirty = false; D.send('st', [nRes, ci, tgt, served, strikes, lastOk, rk], true); }
  const setTgt = n => { if (g.result) return; n = clamp(Math.round(n), 0, 12); if (n === tgt) return; tgt = n; stDirty = true; sfx.tick && sfx.tick(); };
  function sendTray() { const s = tray.join(','); if (s !== lastTray) { lastTray = s; D.send('tray', tray.slice(), true); } }
  function addBill(v) { if (g.result || tray.length >= 14) return; tray.push(v); sfx.click(); heldAt = g.c; sendTray(); }
  function undo() { if (g.result || !tray.length) return; tray.pop(); sfx.pop(); sendTray(); }
  function give() { if (g.result) return; giveAt = g.c; sfx.blip(); D.send('give', [ci, sum(tray)]); }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: judge ? 'CALL IT!' : 'COUNT!', roleLabel: judge ? 'CHALKBOARD' : 'CASHIER',
    hint: judge ? 'MULTIPLY THE RATE BY THE ORDER AND TAP THE TOTAL FOR YOUR FRIEND - THE RATE KEEPS CHANGING, WATCH THE BOARD!' : 'PUT EXACTLY THE TOTAL YOUR FRIEND CALLS IN THE TRAY WITH THE BILLS (1, 2, 5), THEN HAND OVER!',
    thint: judge ? 'TAP THE TOTAL NUMBER (RATE x ORDER) - THE RATE KEEPS CHANGING, WATCH THE BOARD!' : 'TAP THE BILLS INTO THE TRAY TO MATCH THE CALL, THEN TAP HAND OVER',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) {
        resAt = T;
        if (g.result === 'lose' && !stormed && !(leave.length && leave[leave.length - 1].at > T - .1)) { stormed = true; leave.push({ idx: ci, ok: false, final: false, at: T, cur: true }); flyBills(WX, CL - 40, 12); sfx.thud(); shake(8, .25); pop('WHAT A RIP-OFF!', 400, 214, 30, '#e8434f', '#fff'); }
        if (g.result === 'win') { for (let i = 0; i < 18; i++) bits.push({ x: 60 + rnd() * 680, y: -20 - rnd() * 160, vx: (rnd() - .5) * 60, vy: 120 + rnd() * 160, v: [1, 2, 5][Math.floor(rnd() * 3)], r: rnd() * 6, vr: (rnd() - .5) * 8, t0: T, life: 2.4 }); sfx.sparkle(); }
      }
      if (judge) {
        const k = rIdx(T); if (k !== rk) { rk = k; rkAt = T; stDirty = true; sfx.whoosh && sfx.whoosh(); }
        if (!g.result) {
          if (T >= readyAt && T - readyAt >= patience) resolve(false);
          else if (T >= g.limit) g.finish('lose');
        }
        if (stDirty || T - stSent >= .4) sendSt();
      } else if (rk !== rkSeen) { rkSeen = rk; rkAt = T; }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = leave.length - 1; i >= 0; i--) if (T - leave[i].at > 1.4 && !leave[i].final) leave.splice(i, 1);
    },
    msg(type, d) {
      if (judge) {
        if (type === 'tray' && Array.isArray(d)) jTray = d.slice(0, 14).map(v => v | 0);
        else if (type === 'give' && Array.isArray(d) && !g.result) {
          if (d[0] !== ci) return;
          const T = g.c, A = cl[ci].A, ok = d[1] === A * rv[rIdx(T)] || (T - rt[rIdx(T)] < GRACE && rIdx(T) > 0 && d[1] === A * rv[rIdx(T) - 1]);
          resolve(ok);
        }
      } else if (type === 'st' && Array.isArray(d)) {
        if (d[0] > nRes) {
          const T = g.c; nRes = d[0]; const wasOk = d[5] === 1, fin = wasOk && d[3] >= NEED;
          leaver(ci, wasOk, fin); if (ci < d[1]) { ci = Math.min(d[1], cl.length - 1); arrive[ci] = T; } tray = []; lastTray = ''; hitAt = T; held = -1;
        }
        tgt = d[2]; served = d[3]; strikes = d[4]; lastOk = d[5]; if (d[6] !== rk) rk = d[6];
        if (d[1] > ci) { ci = Math.min(d[1], cl.length - 1); if (arrive[ci] === undefined) arrive[ci] = g.c; }
      }
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk0 = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); ctx.drawImage(BG, 0, 0);
      // moving background gag: clouds + the buseta crossing, with a honk
      for (const [sx, y, s] of [[40, 70, .8], [420, 110, .6], [700, 80, .7]]) { const cx = ((T * 7 + sx) % 1000) - 120; X.save(); X.translate(cx, y); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink('#eaf7ff', 3); } X.restore(); }
      const bph = (T / 7) % 1, bX = lerp(-120, 940, bph); buseta(bX, T); sneakers(T);
      if (bX > 340 && bX < 360 && !g.result) { /* honk lands once per pass */ }
      // clients
      const cur = cl[ci], pf = clamp((T - (arrive[ci] || 0) - WALK) / patience, 0, 1);
      const walkIn = clamp((T - (arrive[ci] || 0)) / WALK, 0, 1), curState = g.result ? (won ? 'win' : 'storm') : 'wait';
      const drawClient = (idx, x, mood, o) => bust(x, CL, cl[idx] || cl[0], mood, T, o);
      for (const lv of leave) {
        const k = (T - lv.at) / (lv.ok ? .8 : .55), L = cl[lv.idx] || cl[0];
        if (lv.final) { const hop = Math.abs(Math.sin((T - lv.at) * 9)) * 16; drawClient(lv.idx, WX, 'happy', { arms: 1, dy: -hop }); continue; }
        if (lv.ok) { const x = WX + (L.side > 0 ? -1 : 1) * 700 * ease(k) * .9; drawClient(lv.idx, x, 'happy', { arms: 1, dy: -Math.abs(Math.sin(k * 14)) * 10 }); }
        else { const x = WX + L.side * (k * k * 900 + 20), sh = Math.sin(T * 50) * 2; drawClient(lv.idx, x + sh, 'angry', { arms: 1, rot: L.side * .18 * Math.min(1, k * 3), dy: -Math.abs(Math.sin(k * 20)) * 8 }); }
      }
      const curGone = leave.some(l => l.idx === ci && l.final) || (g.result && leave.some(l => l.idx === ci && l.cur));
      if (!curGone && !(won && leave.some(l => l.final))) {
        const sideX = cur.side * 600, x = WX + sideX * (1 - ease(walkIn));
        const mood = lost ? 'angry' : pf > .8 ? 'angry' : pf > .45 ? 'wait' : 'calm';
        drawClient(ci, x, mood, { dy: -(walkIn < 1 ? Math.abs(Math.sin(T * 14)) * 6 : 0), look: judge ? -1 : 0 });
      }
      // the cop (cashier's screen: always; he shakes when a client storms off or the clock is low)
      const hot = T - hitAt < .9 && lastOk === 0 || lost || (!judge && pf > .8);
      if (!judge) cop(738, T, hot);
      // people at the stall
      if (judge) {
        // friend the cashier, counting bills at the right edge
        const cx = 735; X.save(); caosAt(cx, CL + 6, 3.2, { col: pCol(), mood: lost ? 'sad' : won ? 'happy' : null }); X.restore();
        pill(cx, CL - 70, 'YOUR FRIEND', pCol());
        caosAt(476, CL + 6, 3.2, { col: myCol(), mood: lost ? 'sad' : won ? 'happy' : null }); pill(476, CL - 74, 'YOU', myCol());
      } else {
        // the chalkboard friend peeks over the back of the board and calls the total
        caosAt(170, CL + 6, 3.2, { col: pCol(), mood: lost ? 'sad' : won ? 'happy' : null });
        rr(92, CL - 70, 156, 76, 8); ink('#b97a46', 4); X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 3; for (const lx of [118, 144, 170, 196, 222]) { X.beginPath(); X.moveTo(lx, CL - 66); X.lineTo(lx, CL + 2); X.stroke(); }
        X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(98, CL - 66, 144, 6);
        pill(170, CL - 118, 'YOUR FRIEND', pCol());
        caosAt(590, CL + 6, 3.2, { col: myCol(), mood: lost ? 'sad' : won ? 'happy' : null }); pill(590, CL - 74, 'YOU', myCol());
      }
      // the client's speech bubble
      const bx = WX, by = 210, bw = judge ? 168 : 120, bh = 78, shown = !g.result || won;
      if (shown && walkIn > .5 && !curGone) {
        const bp = outBack((walkIn - .5) / .5); X.save(); X.translate(bx, by + bh / 2); X.scale(bp, bp); X.translate(-bx, -by - bh / 2);
        X.beginPath(); X.moveTo(bx - 14, by + bh - 4); X.lineTo(bx, by + bh + 22); X.lineTo(bx + 14, by + bh - 4); X.closePath(); ink('#fff', 3);
        rr(bx - bw / 2, by, bw, bh, 18); ink('#fff', 4);
        if (judge) { txt('GIVE ME', bx, by + 20, 18, INK, 'center', bw - 20); txt(cur.A + ' $', bx - 22, by + 54, 40, '#3fa64a', 'center', 80); for (let i = 0; i < cur.A; i++) bill(bx + 34 + (i % 2) * 6 - 6, by + 56 - i * 11, 44, 22, 1, (i - 1) * .12); }
        else { txt('$ ?', bx, by + 40, 44, '#3fa64a', 'center', bw - 20); }
        X.restore();
        // patience: a little bar under the bubble
        if (!g.result) { const px = bx - 40, py = by + bh + 30; rr(px, py, 80, 10, 5); ink('#3a3550', 2.5); X.fillStyle = pf > .8 ? '#ff4d5e' : pf > .45 ? '#ffd23f' : '#5CFF7A'; rr(px, py, Math.max(6, 80 * (1 - pf)), 10, 5); X.fill(); }
      }
      // role-specific panels
      if (judge) drawBoard(T, won, lost); else drawCall(T, won, lost);
      if (judge) drawChalkUI(T); else drawTillUI(T);
      // HUD: served medals + strike hearts (hung under the awning)
      bunting(T);
      for (let i = 0; i < NEED; i++) { const mx = 612 + i * 40; X.beginPath(); X.arc(mx, 140, 15, 0, TAU); ink(i < served ? '#ffd23f' : '#4a4558', 3); if (i < served) txt('$', mx, 141, 18, '#a86b00', 'center', 20); else { X.fillStyle = 'rgba(255,255,255,.12)'; el(mx - 4, 135, 4, 3, -.5); X.fill(); } }
      for (let i = 0; i < MAXSTRIKE; i++) { const cracked = i < strikes; heart(60 + i * 38, 140, 1.1 * (cracked && T - hitAt < .3 ? 1.3 : 1), cracked ? '#6b6486' : '#ff5c8a', cracked); }
      // bills in flight
      for (const b of bits) { const a = T - b.t0; X.globalAlpha = clamp(1 - (a - b.life + .4) / .4, 0, 1); bill(b.x, b.y, 44, 22, b.v, b.r); X.globalAlpha = 1; }
      // payoffs
      if (won && rk0 >= 0) {
        const c = ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A'];
        for (let i = 0; i < 7; i++) { const q = (rk0 * 1.4 + i * .15) % 1; star(110 + i * 100, 240 + (i % 3) * 36, 6 + q * 20, 3 + q * 4, 6, i + q * 2, c[i % 4], 0); }
        badge('PAID UP, UEPA!', 400, 300, 56, '#ffb23d', '#fff', outBack(rk0 / .3) * (rk0 > 1.2 ? Math.max(0, 1 - (rk0 - 1.2) * 3) : 1), -.06);
      }
      for (const q of pops) { const a = T - q.t0; if (a > 1) continue; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 12, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(judge ? 'MULTIPLY AND TAP!' : 'COUNT IT OUT!', 400, 190, 20, judge ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
    down(p) {
      if (g.result) return;
      if (judge) {
        for (let n = 1; n <= 12; n++) if (inR(chipR(n), p)) { setTgt(n); held = 'c' + n; heldAt = g.c; return; }
        if (inR(MINUS, p)) { setTgt(tgt - 1); held = 'm'; heldAt = g.c; } else if (inR(PLUS, p)) { setTgt(tgt + 1); held = 'p'; heldAt = g.c; }
      } else {
        for (const s of STK) if (inR(s, p)) { addBill(s.v); held = 's' + s.v; return; }
        if (inR(TRAY, p) || inR(UNDO, p)) { undo(); held = 'u'; heldAt = g.c; } else if (inR(GIVE, p) || inR(TOT, p)) { give(); held = 'g'; heldAt = g.c; }
      }
    },
    move() {}, up() { held = -1; },
    key(e) {
      if (g.result || e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return; const c = e.code;
      if (judge) {
        const dm = /^Digit(\d)$/.exec(c) || /^Numpad(\d)$/.exec(c);
        if (dm) { const n = +dm[1]; setTgt(n === 0 ? 10 : n); }
        else if (c === 'ArrowUp' || c === 'ArrowRight' || c === 'KeyW' || c === 'KeyD' || c === 'Equal' || c === 'NumpadAdd') setTgt(tgt + 1);
        else if (c === 'ArrowDown' || c === 'ArrowLeft' || c === 'KeyS' || c === 'KeyA' || c === 'Minus' || c === 'NumpadSubtract') setTgt(tgt - 1);
      } else {
        if (c === 'Digit1' || c === 'KeyZ' || c === 'Numpad1') addBill(1); else if (c === 'Digit2' || c === 'KeyX' || c === 'Numpad2') addBill(2); else if (c === 'Digit3' || c === 'KeyC' || c === 'Numpad3') addBill(5);
        else if (c === 'Backspace' || c === 'Delete' || c === 'KeyQ' || c === 'ArrowLeft' || c === 'ArrowDown') undo();
        else if (c === 'Space' || c === 'Enter' || c === 'ArrowUp' || c === 'ArrowRight') give();
      }
    },
    keyup() {},
  };
  function caosAt(x, feet, u, o) { caos(x, feet, u, o); }

  /* the chalkboard (pizarra's screen): rate, a wobble before it changes, the old rate crossed out */
  function drawBoard(T, won, lost) {
    const x = 28, y = 158, w = 400, h = 214, k = rIdx(T), nxt = rt[k + 1], warn = nxt !== undefined && nxt - T < .6 && nxt - T > 0 && !g.result;
    const sh = warn ? Math.sin(T * 60) * 3 : 0, rate = rv[k], since = T - rt[k];
    X.save(); X.translate(sh, 0);
    line([[x + 60, y + 4], [x + 60, 124]], 4, '#e6c58c'); line([[x + w - 60, y + 4], [x + w - 60, 124]], 4, '#e6c58c');
    rr(x, y + 6, w, h, 16); ink('#8a5a2c', 4); rr(x, y, w, h, 16); ink('#d9944f', 5);
    rr(x + 12, y + 12, w - 24, h - 24, 10); ink('#2d5a4b', 3);
    X.save(); rr(x + 12, y + 12, w - 24, h - 24, 10); X.clip(); X.fillStyle = 'rgba(0,0,0,.18)'; X.fillRect(x + 12, y + h - 70, w - 24, 60); X.fillStyle = 'rgba(255,255,255,.07)'; el(x + 120, y + 60, 90, 24, -.2); X.fill(); el(x + 280, y + 150, 70, 16, .15); X.fill(); X.restore();
    txt('EXCHANGE', x + w / 2, y + 36, 24, '#ffe08a', 'center', 240);
    txt('1 $ =', x + 98, y + 100, 46, '#f4f1de', 'center', 140);
    const pop = since < .35 ? 1 + Math.sin(since / .35 * Math.PI) * .35 : 1;
    X.save(); X.translate(x + 226, y + 100); X.scale(pop, pop); txt(String(rate), 0, 0, 92, since < .2 ? '#fff' : '#ffe14d', 'center', 70); X.restore();
    txt('STACKS', x + 330, y + 104, 24, '#f4f1de', 'center', 100);
    if (k > 0) { const old = rv[k - 1], up = rate > old; txt('BEFORE', x + 90, y + 170, 20, '#bcd8cf', 'center', 100); txt(String(old), x + 160, y + 170, 36, '#bcd8cf', 'center', 40); line([[x + 138, y + 182], [x + 184, y + 158]], 5, '#ff6a6a');
      X.beginPath(); if (up) { X.moveTo(x + 240, y + 182); X.lineTo(x + 270, y + 182); X.lineTo(x + 255, y + 156); } else { X.moveTo(x + 240, y + 156); X.lineTo(x + 270, y + 156); X.lineTo(x + 255, y + 182); } X.closePath(); ink(up ? '#ff6a6a' : '#5CFF7A', 3); }
    if (warn) badge('!', x + w - 38, y + 36, 26, '#ff4d5e', '#fff', 1, .1);
    X.restore();
    if (T - rkAt < .9 && rkAt > 0 && !g.result) badge('RATE CHANGED!', 228, 136, 20, '#ff7a1a', '#fff', outBack((T - rkAt) / .2), -.04);
    // own character holds the chalk
    if (T - hitAt < .6 && hitAt > 0 && lastOk === 1) { for (let i = 0; i < 3; i++) star(70 + i * 120, 150 - (T - hitAt) * 20, 7, 3, 5, T * 6 + i, '#FFE14D', 2); }
  }
  /* the cashier's screen: the friend calls the total in a bubble above the board's back */
  function drawCall(T, won, lost) {
    const bx = 170, by = 150, bw = 220, bh = 92, flash = T - hitAt < .4 ? 1 : 0;
    X.beginPath(); X.moveTo(bx - 14, by + bh - 4); X.lineTo(bx, by + bh + 24); X.lineTo(bx + 14, by + bh - 4); X.closePath(); ink('#fff', 3);
    rr(bx - bw / 2, by, bw, bh, 20); ink('#fff', 4);
    if (tgt > 0) { txt('GIVE HIM', bx, by + 20, 20, INK, 'center', bw - 30); const pop = 1 + Math.max(0, 1 - (T - trayAt) * 4) * .0; X.save(); X.translate(bx, by + 60); X.scale(pop, pop); txt(String(tgt), 0, 0, 62, '#e8434f', 'center', 100); X.restore(); }
    else { txt('...', bx, by + 48, 50, '#9a96b0', 'center', 100); }
    if (T - rkAt < 1 && rkAt > 0 && !g.result) badge('RATE CHANGED!', bx, by - 22, 17, '#ff7a1a', '#fff', outBack((T - rkAt) / .2), -.03);
  }
  function drawTillUI(T) {
    // till stacks
    for (const s of STK) {
      const down = held === 's' + s.v && g.c - heldAt < .12; const lift = plate(s, '#f1d9a8', '#a8794a', down);
      for (let i = 0; i < 3; i++) bill(s.x + s.w / 2 + (i - 1) * 3, s.y + 34 - lift - i * 6 + 8, 70, 30, s.v, (i - 1) * .08);
      txt('x' + s.v, s.x + 24, s.y + 66 - lift + 0, 20, '#fff', 'center', 40);
      X.font = '700 14px Fredoka, Arial, sans-serif'; rr(s.x + s.w - 30, s.y + s.h - 24 - lift, 24, 20, 5); ink('#fff', 2); txt(s.k, s.x + s.w - 18, s.y + s.h - 13 - lift, 14, INK, 'center', 20);
    }
    // tray
    const tot = sum(tray), ok = tgt > 0 && tot === tgt;
    plate(TRAY, '#d9dfe8', '#8f9cb3', false, false); rr(TRAY.x + 10, TRAY.y + 14, TRAY.w - 20, TRAY.h - 24, 10); ink('#aeb7c8', 2.5);
    if (!tray.length) txt('TRAY', TRAY.x + TRAY.w / 2, TRAY.y + 46, 22, 'rgba(255,255,255,.8)', 'center', 140);
    tray.forEach((v, i) => bill(TRAY.x + 34 + (i % 6) * 30, TRAY.y + 34 + Math.floor(i / 6) * 26 - (i === tray.length - 1 && g.c - heldAt < .12 ? 5 : 0), 30, 24, v, (i % 3 - 1) * .08));
    // total
    plate(TOT, ok ? '#5CFF7A' : '#ffd23f', ok ? '#23a046' : '#c99512', false, ok);
    txt('TOTAL', TOT.x + TOT.w / 2, TOT.y + 24, 16, INK, 'center', 100); txt(String(tot), TOT.x + TOT.w / 2, TOT.y + 56, 48, ok ? '#fff' : '#fff', 'center', 100);
    // buttons
    const dU = held === 'u' && g.c - heldAt < .12, dG = held === 'g' && g.c - heldAt < .12;
    let l = plate(UNDO, '#ff9a8a', '#c4584a', dU); txt('UNDO', UNDO.x + UNDO.w / 2, UNDO.y + 28 - l, 20, INK, 'center', 110);
    l = plate(GIVE, ok ? '#5CFF7A' : '#4fd06a', '#24803a', dG, ok); txt('HAND OVER', GIVE.x + GIVE.w / 2, GIVE.y + 26 - l, 26, INK, 'center', 380);
    if (!g.result && ci === 0 && g.c < 3) { DUO.demoFinger(STK[2].x + 60, STK[2].y + 40 + Math.sin(g.c * 5) * 4, true, (g.c * 2) % 1); }
  }
  function drawChalkUI(T) {
    let l = plate(MINUS, '#ff9a8a', '#c4584a', held === 'm' && g.c - heldAt < .12); txt('-', MINUS.x + 50, MINUS.y + 40 - l, 64, INK, 'center', 60);
    plate(DISP, '#f4f1de', '#9a937c', false, tgt > 0 && T - hitAt > .6 && false);
    txt(tgt > 0 ? String(tgt) : '?', DISP.x + DISP.w / 2, DISP.y + 46, 60, tgt > 0 ? '#e8434f' : '#9a96b0', 'center', 120);
    l = plate(PLUS, '#5CFF7A', '#23a046', held === 'p' && g.c - heldAt < .12); txt('+', PLUS.x + 50, PLUS.y + 40 - l, 64, INK, 'center', 60);
    // the cashier's tray, mirrored
    plate(MIRR, '#d9dfe8', '#8f9cb3', false, false); rr(MIRR.x + 10, MIRR.y + 14, MIRR.w - 20, MIRR.h - 24, 10); ink('#aeb7c8', 2.5);
    if (!jTray.length) txt('TRAY', MIRR.x + MIRR.w / 2, MIRR.y + 46, 22, 'rgba(255,255,255,.8)', 'center', 140);
    jTray.forEach((v, i) => bill(MIRR.x + 34 + (i % 7) * 30, MIRR.y + 34 + Math.floor(i / 7) * 26, 30, 24, v, (i % 3 - 1) * .08));
    txt(String(sum(jTray)), MIRR.x + MIRR.w - 34, MIRR.y + 42, 40, sum(jTray) === tgt && tgt > 0 ? '#5CFF7A' : '#fff', 'center', 56);
    for (let n = 1; n <= 12; n++) { const r = chipR(n), on = n === tgt, d = held === 'c' + n && g.c - heldAt < .12; const lf = plate(r, on ? '#ffe14d' : '#f4f1de', on ? '#c99512' : '#9a937c', d); txt(String(n), r.x + r.w / 2, r.y + 24 - lf, 24, INK, 'center', 40); }
  }
  // what a bot may see: the same things as the screen
  g.dbg = {
    chip: n => ctr(chipR(n)), btn: nm => nm === 'give' ? ctr(GIVE) : nm === 'undo' ? ctr(UNDO) : ctr(STK[nm === 'b1' ? 0 : nm === 'b2' ? 1 : 2]),
    view: () => judge ? { rate: rv[rIdx(g.c)], order: cl[ci].A, ci, target: tgt, tray: sum(jTray), ready: g.c >= readyAt } : { target: tgt, tray: sum(tray), ci, ready: true },
    truth: () => ({ ci, served, strikes, rate: rv[rIdx(g.c)] }),
  };
  wire(g, D, 0, sp, 'du_cambio');
  return g;
}
reg('du_cambio', duCambio, 'CASA DE CAMBIO'); REGMAP.du_cambio.duo = true;

/* ───────────── intro card (520×240), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#8fdcff'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#7d7894'; X.fillRect(0, 150, 520, 90);
  for (let i = 0; i < 7; i++) { X.beginPath(); X.moveTo(i * 80, 0); X.lineTo(i * 80 + 80, 0); X.lineTo(i * 80 + 80, 30); X.quadraticCurveTo(i * 80 + 40, 52, i * 80, 30); X.closePath(); ink(['#ffd23f', '#2f6fd6', '#e8434f'][i % 3], 3); }
  if (role === 0) {
    rr(24, 52, 250, 120, 12); ink('#d9944f', 4); rr(34, 62, 230, 100, 8); ink('#2d5a4b', 2.5);
    txt('1 $ =', 90, 100, 30, '#f4f1de', 'center', 80); txt(String(u < 2 ? 3 : 4), 170, 100, 56, '#ffe14d', 'center', 50); txt('STACKS', 228, 106, 15, '#f4f1de', 'center', 60);
    txt('GIVE ME', 390, 62, 16, INK, 'center', 100); rr(330, 40, 120, 60, 14); ink('#fff', 3); txt('GIVE ME', 390, 56, 16, INK, 'center', 100); txt('2 $', 390, 82, 28, '#3fa64a', 'center', 80);
    const tg = u < 2 ? 6 : 8;
    for (let i = 0; i < 4; i++) { rr(150 + i * 60, 176, 52, 40, 10); ink(i === ((u % 2) < 1 ? 1 : 3) ? '#ffe14d' : '#f4f1de', 3); }
    txt('6', 176, 196, 26, INK); txt('7', 236, 196, 26, INK); txt('8', 296, 196, 26, INK); txt('9', 356, 196, 26, INK);
    txt(String(tg), 60, 200, 40, '#e8434f', 'center', 60);
    DUO.demoFinger(u < 2 ? 176 : 296, 200, true, (u % 1));
    badge('MULTIPLY AND TAP!', 260, 20, 16, '#c98a12', '#fff', 1, -.02);
  } else {
    txt('GIVE HIM', 130, 40, 16, INK, 'center', 100); rr(70, 22, 120, 60, 14); ink('#fff', 3); txt('GIVE HIM', 130, 38, 14, INK, 'center', 100); txt('7', 130, 66, 30, '#e8434f', 'center', 40);
    const bills = [5, 2]; const n = u < 1 ? 0 : u < 2 ? 1 : 2;
    for (let i = 0; i < 3; i++) { rr(30 + i * 92, 150, 84, 60, 12); ink('#f1d9a8', 3); bill(72 + i * 92, 178, 56, 26, [1, 2, 5][i], 0); }
    rr(300, 150, 150, 60, 12); ink('#d9dfe8', 3); for (let i = 0; i < n; i++) bill(340 + i * 40, 180, 34, 26, bills[i], 0);
    txt(String(n === 0 ? 0 : n === 1 ? 5 : 7), 480, 180, 38, n === 2 ? '#5CFF7A' : '#fff', 'center', 50);
    DUO.demoFinger(u < 1 ? 72 + 184 : u < 2 ? 72 + 92 : 380, u < 2 ? 190 : 190, true, (u % 1));
    badge('COUNT IT OUT!', 330, 36, 16, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_cambio = [['CHALKBOARD', 'CALL THE TOTAL', 'TAP THE NUMBER'], ['CASHIER', 'COUNT OUT THE BILLS', 'TAP BILLS, HAND OVER']];
DUO.DEMOS.du_cambio = [t => demo(0, t), t => demo(1, t)];

})();
