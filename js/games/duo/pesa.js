'use strict';
/* ═════════ DUO · PESA JUSTO (du_pesa): the fruit stall at Mercado de Coche, a spring scale on a chain ═════════
   VENDOR (role 0, JUDGE): behind the counter. Takes fruit from the bin (tap = put one on the scale, or drag it onto the pan; tap the pan / QUITAR / ⌫
   takes one off) and watches the needle and the pile. He CANNOT read the shopper's list (the clipboard shows its back): he only has the hints.
   SHOPPER (role 1): holds the list (fruit and target kilos, 3 items in order, green band on the dial = the margin). Cannot touch the scale: sends
   MORE / LESS / DONE! (three plates, keys 1 2 3) and watches the same dial. DONE! while the needle is inside the margin = item bagged.
   Win: 3 items weighed within ±1 kg before time. Lose: 3 strikes (DONE! with the wrong weight, or a pile 4 kg over the target) or time.
   Fail gag: the vendor flings extra mangoes into the shopper's bag - the ñapa the list did not include.
   Netcode: the VENDOR owns the pile and the verdict. 'st' [nRes, idx, pieces, done, strikes, why] (absolute, latest, repeated every .4 s so a dropped
   message never matters). The SHOPPER owns the hints: 'h' [seq, kind 0 more / 1 less / 2 done, idx, pieces the shopper saw]; DONE! counts what the
   shopper SAW (the pile must have been that for a moment in the last 1.2 s: lag is not the players' fault). The level (fruit and kilos) is drawn
   from mkR() in the constructor, the same on both screens. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only

/* ───────────── tuning ───────────── */
const NEED = 3, MAXSTRIKE = 3, MARGIN = 1, OVER = 3, GR = 1.2, MAXP = 12, READY = .5;
const FR = [{ k: 'MANGOES', w: 1 }, { k: 'BANANAS', w: 2 }, { k: 'PLANTAINS', w: 2 }, { k: 'YUCCA', w: 3 }];   // unit weight in kg of one piece
const CX = 400, CY = 222, DR = 62;                               // the dial
const XS = 100, XV = 700, FEET = 446;                            // shopper / vendor x, feet y
const BIN = { x: 28, y: 496, w: 300, h: 84 }, OFF = { x: 340, y: 496, w: 150, h: 84 }, RD = { x: 504, y: 496, w: 268, h: 84 };
const PMORE = { x: 28, y: 496, w: 240, h: 84 }, PLESS = { x: 280, y: 496, w: 240, h: 84 }, PDONE = { x: 532, y: 496, w: 240, h: 84 };
const PAN = { x: 330, y: 250, w: 140, h: 170 };                  // the pan area (drop target / tap to take one off)
const BAG = { x: 178, y: 440 };                                  // the shopper's paper bag on the counter
const inR = (r, p) => p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const ctr = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const angOf = k => .75 * Math.PI + clamp(k, 0, 13) / 12 * 1.5 * Math.PI;

/* ───────────── tiny drawing kit (X is ctx while playing, an offscreen context while the backdrop is baked) ───────────── */
let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function oline(pts, w, col) { line(pts, w + 4, INK); line(pts, w, col); }
function cel(base, shade, build, sx, sy, o = 3) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
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
function plate(r, col, dk, down, glow) {
  const d = down ? 3 : 8;
  rr(r.x, r.y + 8, r.w, r.h, 16); ink(dk, 4);
  rr(r.x, r.y + 8 - d, r.w, r.h, 16); ink(col, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(r.x + 8, r.y + 12 - d, r.w - 16, 8, 4); X.fill();
  if (glow) { X.globalAlpha = .55 + .4 * Math.sin(now * 10); X.strokeStyle = '#fff'; X.lineWidth = 4; rr(r.x + 6, r.y + 14 - d, r.w - 12, r.h - 12, 12); X.stroke(); X.globalAlpha = 1; }
  return 8 - d;
}
function tri(x, y, s, dir, col) { X.beginPath(); X.moveTo(x - s, y + dir * s * .6); X.lineTo(x + s, y + dir * s * .6); X.lineTo(x, y - dir * s * .8); X.closePath(); ink(col, 2.5); }
function keycap(x, y, k) { rr(x - 12, y - 11, 24, 22, 5); ink('#fff', 2); txt(k, x, y + 1, 14, INK, 'center', 18); }

/* ───────────── the fruit: j = 0 mango, 1 cambur (bunch), 2 plátano, 3 yuca. Centre (x, y), size s, rotation rot ───────────── */
function fruit(j, x, y, s, rot) {
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(s, s);
  if (j === 0) {
    cel('#ffb23d', '#e07a1f', () => el(0, 0, 16, 13, -.3), 3, 3);
    X.fillStyle = 'rgba(232,67,79,.55)'; el(-6, 3, 6, 5, -.3); X.fill();
    X.beginPath(); X.moveTo(2, -11); X.quadraticCurveTo(10, -22, 20, -14); X.quadraticCurveTo(12, -8, 2, -11); X.closePath(); ink('#3fb260', 2.5);
    X.fillStyle = 'rgba(255,255,255,.55)'; el(-6, -5, 4, 2.4, -.6); X.fill();
  } else if (j === 1) {
    for (const [dx, dy, r] of [[-5, 2, -.12], [5, -1, .1]]) {
      X.save(); X.translate(dx, dy); X.rotate(r);
      cel('#ffe14d', '#e0b820', () => { X.beginPath(); X.moveTo(-16, -6); X.quadraticCurveTo(0, 22, 16, -10); X.quadraticCurveTo(2, 8, -16, -6); X.closePath(); }, 2, 3, 2.6);
      X.fillStyle = '#6b4a24'; el(16, -10, 2.4, 2.4); X.fill(); X.restore();
    }
    rr(-6, -13, 14, 7, 3); ink('#8a6a2c', 2.2);
  } else if (j === 2) {
    cel('#d9dc4a', '#9fb02e', () => { X.beginPath(); X.moveTo(-22, -4); X.quadraticCurveTo(-2, 24, 22, -8); X.quadraticCurveTo(24, -2, 20, 2); X.quadraticCurveTo(0, 18, -20, 4); X.quadraticCurveTo(-24, 0, -22, -4); X.closePath(); }, 2, 3, 3);
    X.fillStyle = 'rgba(70,50,20,.55)'; for (const [a, b] of [[-8, 9], [4, 11], [12, 7]]) { el(a, b, 2, 1.4); X.fill(); }
    X.fillStyle = '#6b4a24'; el(22, -7, 3, 3); X.fill();
  } else {
    cel('#a8743f', '#7a4f26', () => { X.beginPath(); X.moveTo(-22, 2); X.quadraticCurveTo(-10, -12, 10, -10); X.lineTo(22, -3); X.quadraticCurveTo(10, 10, -8, 10); X.quadraticCurveTo(-18, 10, -22, 2); X.closePath(); }, 2, 3, 3);
    X.fillStyle = '#f4ead0'; el(21, -5, 4, 6.5, -.3); X.fill(); X.lineWidth = 2; X.strokeStyle = INK; X.stroke();
    X.strokeStyle = 'rgba(70,40,15,.5)'; X.lineWidth = 1.6; for (const a of [-12, -3, 6]) { X.beginPath(); X.moveTo(a, -6 + a * .1); X.lineTo(a + 3, 5); X.stroke(); }
  }
  X.restore();
}

/* the spring-scale dial at (cx, cy): needle shows dv kilos; band (optional) = the shopper's target margin */
function dial(cx, cy, R, dv, tgt, T) {
  oline([[cx, cy - R - 70], [cx, cy - R - 12]], 5, '#8f9cb3');
  X.beginPath(); X.arc(cx, cy - R - 10, 10, 0, TAU); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#c9ced6'; X.stroke();
  X.beginPath(); X.arc(cx, cy, R + 9, 0, TAU); ink('#d9dfe8', 4); X.fillStyle = 'rgba(20,16,28,.14)'; X.beginPath(); X.arc(cx, cy, R + 9, -.5, 1.9); X.arc(cx, cy, R - 9, 1.9, -.5, true); X.closePath(); X.fill();
  X.beginPath(); X.arc(cx, cy, R, 0, TAU); ink('#fff7e0', 3);
  if (tgt) { X.beginPath(); X.arc(cx, cy, R - 6, angOf(tgt - MARGIN), angOf(tgt + MARGIN)); X.lineWidth = 11; X.lineCap = 'butt'; X.strokeStyle = 'rgba(30,170,70,.9)'; X.stroke(); X.beginPath(); X.arc(cx, cy, R - 6, angOf(tgt - .12), angOf(tgt + .12)); X.lineWidth = 11; X.strokeStyle = '#5CFF7A'; X.stroke(); }
  for (let k = 0; k <= 12; k++) { const a = angOf(k), c = Math.cos(a), s = Math.sin(a), l = k % 2 ? 6 : 10; line([[cx + c * (R - 3), cy + s * (R - 3)], [cx + c * (R - 3 - l), cy + s * (R - 3 - l)]], k % 2 ? 2 : 3, INK); if (k % 2 === 0 && R > 40) txt(String(k), cx + c * (R - 24), cy + s * (R - 24), R > 50 ? 13 : 10, INK, 'center', 20); }
  if (R > 40) txt('KG', cx, cy + R * .45, 13, INK, 'center', 30);
  const na = angOf(dv); oline([[cx - Math.cos(na) * 9, cy - Math.sin(na) * 9], [cx + Math.cos(na) * (R - 9), cy + Math.sin(na) * (R - 9)]], 4, '#e8434f');
  X.beginPath(); X.arc(cx, cy, 8, 0, TAU); ink('#ffd23f', 2.5);
  X.fillStyle = 'rgba(255,255,255,.45)'; el(cx - R * .42, cy - R * .55, R * .26, R * .1, -.7); X.fill();
}
/* the pan hanging under the dial: centre x, top y */
function pan(cx, py, cy, R) {
  const hy = cy + R + 20; rr(cx - 6, cy + R + 8, 12, 14, 3); ink('#8f9cb3', 2.5);
  oline([[cx, hy], [cx - 52, py + 2]], 3, '#8f9cb3'); oline([[cx, hy], [cx + 52, py + 2]], 3, '#8f9cb3'); oline([[cx, hy], [cx, py]], 3, '#8f9cb3');
  X.beginPath(); X.moveTo(cx - 70, py); X.lineTo(cx + 70, py); X.quadraticCurveTo(cx + 62, py + 28, cx, py + 28); X.quadraticCurveTo(cx - 62, py + 28, cx - 70, py); X.closePath(); ink('#c9ced6', 4);
  X.fillStyle = 'rgba(255,255,255,.4)'; el(cx - 40, py + 10, 14, 3, .2); X.fill();
  el(cx, py, 70, 7); ink('#e4e9f2', 3);
}

/* ───────────── backdrop (baked once): the market hall at Coche seen from behind the stall's counter ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  const gr = X.createLinearGradient(0, 0, 0, 392); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(.55, '#8fdcff'); gr.addColorStop(1, '#fff0c8'); X.fillStyle = gr; X.fillRect(0, 0, W, 392);
  X.beginPath(); X.arc(712, 208, 28, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(705, 201, 9, 5, -.6); X.fill();
  X.beginPath(); X.moveTo(0, 330); X.lineTo(0, 220); X.quadraticCurveTo(120, 170, 250, 240); X.quadraticCurveTo(380, 190, 520, 270); X.lineTo(600, 330); X.closePath(); X.fillStyle = '#6fbf86'; X.fill();
  X.beginPath(); X.moveTo(380, 330); X.quadraticCurveTo(560, 200, 700, 250); X.lineTo(800, 270); X.lineTo(800, 330); X.closePath(); X.fillStyle = '#58ab74'; X.fill();
  // the market hall: long cream front with a row of arches and a red roof band
  rr(-10, 262, 820, 130, 6); ink('#f6e7c4', 4); X.fillStyle = 'rgba(20,16,28,.1)'; X.fillRect(-6, 372, 812, 16);
  rr(-10, 244, 820, 28, 6); ink('#e8434f', 4); X.fillStyle = 'rgba(255,255,255,.28)'; X.fillRect(0, 249, 800, 6);
  for (let i = 0; i < 8; i++) { const x = 6 + i * 98; X.beginPath(); X.moveTo(x, 392); X.lineTo(x, 316); X.quadraticCurveTo(x + 40, 262, x + 80, 316); X.lineTo(x + 80, 392); X.closePath(); ink('#5b4a6e', 3.5);
    for (let q = 0; q < 5; q++) { X.fillStyle = ['#ff9a8a', '#ffd479', '#9be38a', '#8fd0ff', '#ffb7d4'][(i + q) % 5]; el(x + 12 + q * 14, 382 - (q % 2) * 8, 6, 5); X.fill(); } }
  // floor in front of the hall + the counter
  X.fillStyle = '#d9c6a0'; X.fillRect(0, 392, W, 60); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 392); X.lineTo(W, 392); X.stroke();
  X.strokeStyle = 'rgba(20,16,28,.14)'; X.lineWidth = 2; for (let x = 0; x < W; x += 64) { X.beginPath(); X.moveTo(x, 392); X.lineTo(x - 14, 452); X.stroke(); }
  // awning: red / cream scallops
  for (let i = 0; i < 10; i++) { const x0 = i * 80; X.beginPath(); X.moveTo(x0, -6); X.lineTo(x0 + 80, -6); X.lineTo(x0 + 80, 70); X.quadraticCurveTo(x0 + 40, 104, x0, 70); X.closePath(); ink(i % 2 ? '#fff3d0' : '#e8434f', 4); X.fillStyle = 'rgba(20,16,28,.16)'; X.fillRect(x0 + 62, -6, 18, 74); X.fillStyle = 'rgba(255,255,255,.34)'; X.fillRect(x0 + 6, -2, 10, 60); }
  rr(-10, 56, 34, 600, 8); ink('#a5622c', 4); rr(776, 56, 34, 600, 8); ink('#a5622c', 4);
  // the stall's sign, hung from the awning
  line([[590, 92], [590, 118]], 3, '#e6c58c'); line([[750, 92], [750, 118]], 3, '#e6c58c');
  rr(560, 116, 220, 40, 10); ink('#ffd23f', 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(568, 120, 204, 8, 4); X.fill();
  // counter: top and front
  rr(-4, 440, W + 8, 34, 10); ink('#f2b878', 4); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(10, 445, W - 20, 6);
  X.fillStyle = '#b97a46'; X.fillRect(0, 474, W, H); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 474); X.lineTo(W, 474); X.stroke();
  X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 3; for (let x = 0; x < W; x += 100) { X.beginPath(); X.moveTo(x, 476); X.lineTo(x, H); X.stroke(); }
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 0; x < W; x += 100) X.fillRect(x + 6, 480, 8, 110);
  // the four crates on the counter (the vendor's stock)
  [[218, 0], [474, 1], [540, 2], [606, 3]].forEach(([x, j]) => {
    for (let i = 0; i < 4; i++) fruit(j, x + 12 + (i % 2) * 22 + (i > 1 ? 6 : 0), 410 - Math.floor(i / 2) * 12, .62, (i - 1.5) * .3);
    rr(x, 414, 64, 28, 4); ink('#d9944f', 3); X.strokeStyle = '#b06d33'; X.lineWidth = 2; X.beginPath(); X.moveTo(x + 4, 428); X.lineTo(x + 60, 428); X.stroke();
  });
  X = old; return cv;
}

/* the stall's moving gags: a plantain bunch swaying under the awning, a parrot on a swing, a porter with a sack crossing the hall */
function bunch(T) {
  X.save(); X.translate(500, 90); X.rotate(Math.sin(T * 1.7) * .06); line([[0, 0], [0, 26]], 3, '#8a5a34');
  for (let i = 0; i < 5; i++) fruit(2, (i - 2) * 7, 38 + Math.abs(i - 2) * 5, .7, 1.45 + (i - 2) * .1);
  X.restore();
}
function parrot(T) {
  X.save(); X.translate(626, 168); line([[0, -76], [0, 0]], 3, '#e6c58c'); X.rotate(Math.sin(T * 1.5) * .09); line([[-24, 22], [24, 22]], 6, '#a5622c'); X.translate(0, 22);
  const fl = Math.sin(T * 9) > .85 ? 7 : 0;
  X.save(); X.rotate(.15); rr(-8, 4, 10, 30, 5); ink('#e8434f', 2.5); X.restore();
  el(0, -8, 13, 17); ink('#3fb260', 3.5); el(-4, -2, 6, 9, .3); X.fillStyle = 'rgba(255,255,255,.28)'; X.fill();
  X.save(); X.translate(-9, -5 - fl); X.rotate(-.4 - fl * .06); el(0, 0, 10, 5); ink('#2f8f54', 2.5); X.restore();
  X.beginPath(); X.arc(2, -28, 11, 0, TAU); ink('#ffd23f', 3.5);
  X.beginPath(); X.arc(5, -30, 4.2, 0, TAU); ink('#fff', 1.5); X.fillStyle = INK; X.beginPath(); X.arc(6, -30, 1.8, 0, TAU); X.fill();
  X.beginPath(); X.moveTo(10, -28); X.quadraticCurveTo(24, -26, 18, -16); X.quadraticCurveTo(14, -22, 10, -22); X.closePath(); ink('#ff9a4d', 2.5);
  X.restore();
}
function porter(T) {
  const k = (T / 9) % 1, x = lerp(-60, 880, k);
  X.save(); X.translate(x, 394); const b = Math.abs(Math.sin(T * 9)) * 3; X.translate(0, -b);
  caos(0, 0, 1.7, { col: '#7e8fd0', run: T });
  X.save(); X.translate(0, -29); rr(-17, -20, 34, 22, 7); ink('#d9b27a', 3); X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(4, -17, 11, 16); X.restore();
  X.restore();
}
function cloud(x, y, s) { X.save(); X.translate(x, y); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink('#eaf7ff', 3); } X.restore(); }

/* ═════════ the game ═════════ */
function duPesa(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), judge = D.role === 0;
  /* the level, from the seed: which fruit and how many kilos, three items in order */
  const order = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const items = []; for (let i = 0; i < NEED; i++) items.push({ f: order[i], kg: 3 + Math.floor(R() * 5) });
  /* shared view state (the vendor is the authority) */
  let idx = 0, done = 0, strikes = 0, np = 0, nRes = 0, why = 0, hitAt = -9, okAt = -9;
  const ci = () => Math.min(idx, NEED - 1), unit = () => FR[items[ci()].f].w, tgt = () => items[ci()].kg;
  const pcs = [], pops = [], fly = [], bits = [];
  let dv = 0, dvel = 0, resAt = -1, napaN = 0, held = null, heldAt = -9, carry = null, hintK = -1, hintAt = -9;
  let stSent = -9, stDirty = true, readyAt = READY, hSeq = 0, seq = 0, hist = [{ t: 0, p: 0 }], over = false, lastBad = -9, sentK = -1, sentAt = -9;
  let cr = 7; const rnd = () => (cr = cr * 16807 % 2147483647) / 2147483647;
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (rnd() - .5) * .14 }); }
  function strikeFx(w) { hitAt = g.c; sfx.miss(); sfx.buzz && sfx.buzz(); shake(6, .2); pop(w === 1 ? 'WAY TOO MUCH!' : 'NOT QUITE!', 400, 190, 30, '#e8434f', '#fff'); }
  function bagUp() { for (let i = 0; i < pcs.length; i++) { const q = pcs[i]; fly.push({ f: q.f, x: q.x, y: q.y, t0: g.c + i * .05, d: .55 }); } pcs.length = 0; }

  function histPush() { hist.push({ t: g.c, p: np }); if (hist.length > 60) hist.shift(); }
  const histHas = p => hist.some((e, i) => e.p === p && (i + 1 < hist.length ? hist[i + 1].t : 1e9) >= g.c - GR);
  function sendSt() { stSent = g.c; stDirty = false; D.send('st', [nRes, idx, np, done, strikes, why], true); }
  /* VENDOR actions */
  function addP() { if (g.result || !judge || idx >= NEED || g.c < readyAt - .15 || np >= MAXP) return false; np++; histPush(); stDirty = true; sfx.click(); heldAt = g.c; return true; }
  function remP() { if (g.result || !judge || np <= 0) return false; np--; histPush(); stDirty = true; sfx.pop(); return true; }
  function good() {                                     // JUDGE: the item is weighed
    nRes++; done++; why = 0; okAt = g.c; bagUp(); np = 0; idx++; hintK = -1; over = false; hist = [{ t: g.c, p: 0 }]; readyAt = g.c + READY; stDirty = true;
    sfx.coin(); sfx.sparkle(); pop('JUST RIGHT!', 400, 190, 32, '#2fa84a', '#fff'); sendSt();
    if (done >= NEED) g.finish('win');
  }
  function bad(w) {                                     // JUDGE: a strike
    strikes++; why = w; lastBad = g.c; strikeFx(w); stDirty = true; sendSt();
    if (strikes >= MAXSTRIKE) g.finish('lose');
  }
  /* SHOPPER actions */
  function say(kind) {
    if (g.result || judge || idx >= NEED) return; seq++; hintK = kind; hintAt = g.c; sentK = kind; sentAt = g.c; sfx.click();
    D.send('h', [seq, kind, idx, np]);
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: judge ? 'WEIGH!' : 'HINT!', roleLabel: judge ? 'VENDOR' : 'SHOPPER',
    hint: judge ? 'PUT FRUIT ON THE SCALE UNTIL YOUR FRIEND SAYS DONE - YOU CANNOT SEE THE LIST, FOLLOW THE HINTS: MORE, LESS, DONE!' : 'READ THE LIST AND TELL THE VENDOR: MORE, LESS, DONE! - KEEP THE NEEDLE IN THE GREEN, DO NOT LET HIM OVERSHOOT!',
    thint: judge ? 'DRAG OR TAP FRUIT ONTO THE SCALE, TAP THE PAN TO TAKE ONE OFF - FOLLOW YOUR FRIEND\'S HINTS' : 'TAP MORE / LESS TO GUIDE THE VENDOR, TAP DONE! WHEN THE NEEDLE IS IN THE GREEN',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) {
        resAt = T;
        if (g.result === 'win') { for (let i = 0; i < 22; i++) bits.push({ x: 40 + rnd() * 720, y: -20 - rnd() * 200, vx: (rnd() - .5) * 60, vy: 120 + rnd() * 160, f: Math.floor(rnd() * 4), r: rnd() * 6, vr: (rnd() - .5) * 8, t0: T, life: 2.6 }); sfx.sparkle(); }
      }
      // the extra mangoes of the ñapa (lose gag): sound as each one leaves the vendor's hand
      if (resAt >= 0 && g.result === 'lose') { const n = Math.min(6, Math.max(0, Math.floor((T - resAt - .2) / .28) + 1)); while (napaN < n) { napaN++; sfx.whoosh && sfx.whoosh(); if (napaN === 1) shake(5, .2); } }
      if (judge) {
        if (!g.result) {
          const w = np * unit();
          if (idx < NEED && T >= readyAt) { if (!over && w > tgt() + OVER) { over = true; bad(1); } else if (over && w <= tgt() + MARGIN) over = false; }
          if (!g.result && T >= g.limit) g.finish('lose');
        }
        if (stDirty || T - stSent >= .4) sendSt();
      }
      // the shopper's mirror of the pile
      while (pcs.length < np) { const i = pcs.length; pcs.push({ b: T, f: items[ci()].f, x: 0, y: 0, j: i }); }
      while (pcs.length > np) { const q = pcs.pop(); fly.push({ f: q.f, x: q.x, y: q.y, t0: T, d: .45, off: 1 }); }
      // the needle: a spring with a little overshoot
      const tv = idx >= NEED ? 0 : np * unit(); for (let s = 0; s < 4; s++) { dvel += ((tv - dv) * 120 - dvel * 9) * dt / 4; dv += dvel * dt / 4; }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = fly.length - 1; i >= 0; i--) if (T - fly[i].t0 > fly[i].d + .1) fly.splice(i, 1);
    },
    msg(type, d) {
      if (judge) {
        if (type !== 'h' || !Array.isArray(d) || g.result) return;
        const [sq, kind, ii, seen] = d; if (!(sq > hSeq)) return; hSeq = sq;
        if (ii !== idx || idx >= NEED) return;
        hintK = kind; hintAt = g.c; sfx.blip && sfx.blip();
        if (kind === 2) {
          if (g.c < readyAt || g.c - lastBad < .35) return;
          const w = seen * unit(); if (seen > 0 && Math.abs(w - tgt()) <= MARGIN && histHas(seen)) good(); else bad(2);
        }
      } else if (type === 'st' && Array.isArray(d)) {
        const T = g.c;
        if (d[0] > nRes) { nRes = d[0]; okAt = T; bagUp(); hintK = -1; sfx.coin(); sfx.sparkle(); pop('JUST RIGHT!', 400, 190, 32, '#2fa84a', '#fff'); }
        if (d[1] !== idx) { idx = d[1]; hintK = -1; }
        np = d[2]; done = d[3];
        if (d[4] > strikes) { strikes = d[4]; why = d[5]; strikeFx(why); }
      }
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); ctx.drawImage(BG, 0, 0);
      for (const [sx, y, s] of [[40, 70, .8], [420, 130, .6], [700, 60, .7]]) cloud(((T * 7 + sx) % 1000) - 120, y, s);
      txt('MERCADO DE COCHE', 670, 138, 21, INK, 'center', 196); porter(T); bunch(T); parrot(T);
      // the active crate: a bouncing arrow over it
      const act = idx < NEED ? items[ci()].f : -1, crateX = [218, 474, 540, 606];
      if (act >= 0 && !g.result) { const x = crateX[act] + 32, y = 372 + Math.sin(T * 7) * 5; tri(x, y, 12, -1, '#ffd23f'); }
      // characters
      const hop = (won && rk >= 0) ? Math.abs(Math.sin(T * 9)) * 14 : 0, moodS = lost ? 'sad' : won ? 'happy' : null, moodV = lost ? 'happy' : won ? 'happy' : null;
      caos(XS, FEET - (won ? hop : 0), 3.2, { col: judge ? pCol() : myCol(), mood: moodS }); pill(XS, 368, judge ? 'YOUR FRIEND' : 'YOU', judge ? pCol() : myCol());
      caos(XV, FEET - (won ? hop : 0) - (lost && rk > 0 ? Math.abs(Math.sin(T * 12)) * 6 : 0), 3.2, { col: judge ? myCol() : pCol(), mood: moodV }); pill(XV, 368, judge ? 'YOU' : 'YOUR FRIEND', judge ? myCol() : pCol());
      this_clip(T);
      drawScale(T, won, lost, rk);
      // the bag, flying fruit
      drawBag(T, won, lost, rk);
      for (const f of fly) { const k = (T - f.t0) / f.d; if (k < 0) continue; const kk = clamp(k, 0, 1), x = lerp(f.off ? CX : f.x || CX, f.off ? CX + 90 : BAG.x, ease(kk)), y = lerp(f.off ? 330 : f.y || 330, f.off ? 460 : BAG.y - 30, ease(kk)) - Math.sin(kk * Math.PI) * 70; X.globalAlpha = 1 - Math.max(0, kk - .75) * 4; fruit(f.f, x, y, .9, kk * 6); X.globalAlpha = 1; }
      // hint bubble
      drawHint(T);
      // the controls: chunky plates on the counter front
      if (judge) drawVendorUI(T); else drawShopperUI(T);
      // HUD: strike hearts + weighed items, hung under the awning
      rr(22, 10, 138, 40, 20); ink('rgba(20,16,28,.55)', 0); X.fillStyle = 'rgba(20,16,28,.55)'; X.fill();
      for (let i = 0; i < MAXSTRIKE; i++) { const cracked = i < strikes; heart(52 + i * 40, 31, 1.1 * (cracked && T - hitAt < .3 ? 1.3 : 1), cracked ? '#6b6486' : '#ff5c8a', cracked); }
      rr(640, 10, 138, 40, 20); X.fillStyle = 'rgba(20,16,28,.55)'; X.fill();
      for (let i = 0; i < NEED; i++) { const mx = 676 + i * 42, on = i < done; X.beginPath(); X.arc(mx, 31, 15, 0, TAU); ink(on ? '#ffd23f' : '#4a4558', 3); if (on) line([[mx - 6, 31], [mx - 1, 37], [mx + 8, 25]], 4, '#a86b00'); else fruit(items[i].f, mx, 31, .42, 0); }
      for (const b of bits) { const a = T - b.t0; X.globalAlpha = clamp(1 - (a - b.life + .4) / .4, 0, 1); fruit(b.f, b.x, b.y, .8, b.r); X.globalAlpha = 1; }
      // payoffs
      if (won && rk >= 0) {
        const c = ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A'];
        for (let i = 0; i < 7; i++) { const q = (rk * 1.4 + i * .15) % 1; star(80 + i * 106, 200 + (i % 3) * 30, 6 + q * 20, 3 + q * 4, 6, i + q * 2, c[i % 4], 0); }
        badge('FAIR WEIGHT!', 400, 130, 52, '#ffb23d', '#fff', outBack(rk / .3) * (rk > 1.4 ? Math.max(0, 1 - (rk - 1.4) * 3) : 1), -.06);
      }
      if (lost && rk >= .3) {
        badge('ONE MORE FOR FREE!', 400, 130, 36, '#e8434f', '#fff', outBack((rk - .3) / .25) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 3) : 1), .04);
      }
      for (const q of pops) { const a = T - q.t0; if (a > 1) continue; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 12, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(judge ? 'FOLLOW THE HINTS!' : 'GUIDE THE VENDOR!', 400, 80, 20, judge ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
    down(p) {
      if (g.result || !p) return;
      if (judge) {
        if (inR(BIN, p)) { carry = { x: p.x, y: p.y, sx: p.x, sy: p.y }; held = 'b'; heldAt = g.c; }
        else if (inR(OFF, p)) { remP(); held = 'o'; heldAt = g.c; }
        else if (inR(PAN, p)) { remP(); held = 'o'; heldAt = g.c; }
      } else {
        if (inR(PMORE, p)) say(0); else if (inR(PLESS, p)) say(1); else if (inR(PDONE, p)) say(2);
      }
    },
    move(p) { if (carry && p) { carry.x = p.x; carry.y = p.y; } },
    up(p) {
      held = null;
      if (carry) { const c = carry; carry = null; if (g.result) return; const q = p || c, tap = Math.hypot(q.x - c.sx, q.y - c.sy) < 18; if (tap || inR(PAN, q)) addP(); }
    },
    key(e) {
      if (g.result || e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return; const c = e.code;
      if (judge) {
        if (c === 'Space' || c === 'Enter' || c === 'KeyZ' || c === 'ArrowUp' || c === 'Digit1' || c === 'Numpad1' || c === 'KeyW' || c === 'KeyD' || c === 'ArrowRight') { addP(); held = 'b'; heldAt = g.c; }
        else if (c === 'Backspace' || c === 'Delete' || c === 'KeyX' || c === 'ArrowDown' || c === 'Digit2' || c === 'Numpad2' || c === 'KeyS' || c === 'KeyA' || c === 'ArrowLeft') { remP(); held = 'o'; heldAt = g.c; }
      } else {
        if (c === 'Digit1' || c === 'Numpad1' || c === 'KeyZ' || c === 'ArrowUp' || c === 'KeyW') say(0);
        else if (c === 'Digit2' || c === 'Numpad2' || c === 'KeyX' || c === 'ArrowDown' || c === 'KeyS') say(1);
        else if (c === 'Digit3' || c === 'Numpad3' || c === 'KeyC' || c === 'Space' || c === 'Enter') say(2);
      }
    },
    keyup() { held = null; },
  };

  /* the clipboard: the shopper reads the list, the vendor only sees the back of it */
  function this_clip(T) {
    const bx = 20, by = 112, bw = 212, bh = 210, sw = Math.sin(T * 1.3) * 1.5;
    line([[bx + 40, 94], [bx + 40, by + 6]], 3, '#e6c58c'); line([[bx + bw - 40, 94], [bx + bw - 40, by + 6]], 3, '#e6c58c');
    X.save(); X.translate(sw, 0);
    rr(bx, by + 6, bw, bh, 12); ink('#8a5a2c', 4); rr(bx, by, bw, bh, 12); ink('#c98a4e', 4);
    if (judge) {
      X.fillStyle = 'rgba(20,16,28,.14)'; rr(bx + 8, by + 8, bw - 16, bh - 16, 8); X.fill();
      rr(bx + bw / 2 - 30, by - 8, 60, 24, 8); ink('#c9ced6', 3.5);
      X.save(); X.translate(bx + bw / 2, by + 104); X.rotate(-.18); rr(-86, -26, 172, 52, 10); ink('#fff3d0', 3.5); X.strokeStyle = '#e8434f'; X.lineWidth = 3; rr(-80, -20, 160, 40, 7); X.stroke(); txt('SECRET LIST', 0, 1, 24, '#e8434f', 'center', 150); X.restore();
      X.restore(); return;
    }
    rr(bx + 10, by + 12, bw - 20, bh - 22, 8); ink('#fff8e6', 2.5);
    rr(bx + bw / 2 - 30, by - 8, 60, 24, 8); ink('#c9ced6', 3.5);
    txt('SHOPPING LIST', bx + bw / 2, by + 28, 15, INK, 'center', 120);
    for (let i = 0; i < NEED; i++) {
      const it = items[i], y = by + 74 + i * 46, cur = i === idx && !g.result, ok = i < done;
      if (cur) { X.globalAlpha = .6 + .3 * Math.sin(T * 8); rr(bx + 14, y - 21, bw - 28, 42, 10); X.fillStyle = '#ffe14d'; X.fill(); X.globalAlpha = 1; rr(bx + 14, y - 21, bw - 28, 42, 10); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
      fruit(it.f, bx + 40, y, .78, -.2);
      txt(FR[it.f].k, bx + 66, y - 1, 13, INK, 'left', 62);
      txt(String(it.kg), bx + 153, y - 1, 30, ok ? '#7a9a80' : '#e8434f', 'center', 36); txt('KG', bx + 184, y + 3, 12, INK, 'center', 24);
      if (ok) { oline([[bx + 24, y + 2], [bx + 36, y + 14], [bx + 60, y - 14]], 6, '#2fa84a'); }
    }
    txt('± 1 KG', bx + bw / 2, by + bh - 22, 14, '#5b4d7a', 'center', 80);
    X.restore();
  }

  /* the scale: needle, pan with the pile, the vendor's dragged fruit */
  function drawScale(T, won, lost, rk) {
    let sdv = dv; if (lost && rk >= 0) sdv = 6 + Math.sin(rk * 18) * 6 * Math.max(0, 1 - rk * .5) + (rk < 1.5 ? rk * 5 : 0);
    const stretch = clamp(sdv, 0, 12) * 1.25 + Math.sin(T * 2) * .6, py = 374 + stretch;
    dial(CX, CY, DR, clamp(sdv, 0, 12.8), judge || idx >= NEED ? 0 : tgt(), T);
    pan(CX, py, CY, DR);
    const a = clamp(pcs.length, 0, MAXP);
    for (let i = 0; i < a; i++) {
      const q = pcs[i], col = i % 4, layer = Math.floor(i / 4), x = CX + (col - 1.5) * 29 + (hsh(i) - .5) * 6, y = py - 8 - layer * 21 - (col % 2) * 4;
      const age = T - q.b, fall = age < .2 ? Math.pow(1 - age / .2, 2) * 90 : 0; q.x = x; q.y = y;
      fruit(q.f, x, y - fall, 1, (hsh(i + 5) - .5) * .8);
    }
    if (carry && judge) { X.fillStyle = 'rgba(20,16,28,.25)'; el(carry.x, carry.y + 22, 16, 5); X.fill(); fruit(items[ci()].f, carry.x, carry.y, 1.2, Math.sin(T * 10) * .12);
      X.globalAlpha = .5 + .4 * Math.sin(T * 10); X.setLineDash([8, 7]); X.lineWidth = 4; X.strokeStyle = '#fff'; el(CX, py - 6, 80, 40); X.stroke(); X.setLineDash([]); X.globalAlpha = 1; }
    if (T - okAt < .5 && okAt > 0 && !g.result) { for (let i = 0; i < 4; i++) star(CX - 60 + i * 40, 330 - (T - okAt) * 40, 7, 3, 5, T * 6 + i, '#FFE14D', 2); }
  }
  function drawBag(T, won, lost, rk) {
    const full = Math.min(1, (done + (won ? 1 : 0)) / NEED), bx = BAG.x, by = BAG.y, lm = lost && rk >= 0 ? Math.min(6, Math.max(0, Math.floor((rk - .2) / .28 + .5))) : 0;
    const tear = lm >= 4;
    X.save(); X.translate(bx, by);
    X.beginPath(); X.moveTo(-26, 0); X.lineTo(-30 - lm * 1.2, -50); X.lineTo(30 + lm * 1.2, -50); X.lineTo(26, 0); X.closePath(); ink('#d9a86a', 3.5);
    X.fillStyle = 'rgba(20,16,28,.16)'; X.beginPath(); X.moveTo(8, 0); X.lineTo(10, -50); X.lineTo(30 + lm * 1.2, -50); X.lineTo(26, 0); X.closePath(); X.fill();
    if (tear) line([[-6, -50], [-2, -38], [-9, -28], [-3, -18]], 3, INK);
    const nf = won ? 6 : done * 2;
    for (let i = 0; i < nf; i++) fruit(items[Math.floor(i / 2) % NEED].f, -14 + (i % 3) * 14, -54 - Math.floor(i / 3) * 8, .6, (i - 2) * .25);
    for (let i = 0; i < lm; i++) fruit(0, -16 + (i % 3) * 16, -56 - Math.floor(i / 3) * 12 - (i % 2) * 3, .78, (i - 2) * .3);
    X.restore();
    // the mangoes flying in from the vendor's hand
    if (lost && rk >= 0) for (let i = 0; i < 6; i++) { const k = (rk - .2 - i * .28) / .7; if (k < 0 || k >= 1) continue; const x = lerp(XV - 30, BAG.x, ease(k)), y = lerp(FEET - 60, BAG.y - 60, k) - Math.sin(k * Math.PI) * 150; fruit(0, x, y, .95, k * 12); }
  }
  function drawHint(T) {
    if (hintK < 0 || g.result) return; const bx = 284, by = 351, bw = 98, bh = 56, age = T - hintAt, sc = age < .2 ? outBack(age / .2) : 1;
    const col = hintK === 0 ? '#2fa84a' : hintK === 1 ? '#e8742a' : '#c99512';
    X.save(); X.translate(bx, by + bh / 2); X.scale(sc, sc); X.translate(-bx, -by - bh / 2);
    X.beginPath(); X.moveTo(bx - 50, by + bh - 4); X.lineTo(bx - 118, by + bh + 46); X.lineTo(bx - 22, by + bh - 4); X.closePath(); ink('#fff', 3);
    rr(bx - bw / 2, by, bw, bh, 16); ink('#fff', 4);
    const bob = Math.sin(T * 9) * 3;
    if (hintK === 0) tri(bx - 30, by + bh / 2 + bob, 11, 1, col); else if (hintK === 1) tri(bx - 30, by + bh / 2 - bob, 11, -1, col);
    else oline([[bx - 38, by + bh / 2], [bx - 30, by + bh / 2 + 9], [bx - 16, by + bh / 2 - 9]], 5, col);
    txt(hintK === 0 ? 'MORE' : hintK === 1 ? 'LESS' : 'DONE!', bx + 12, by + bh / 2 + 1, hintK === 2 ? 17 : 19, col, 'center', 62);
    X.restore();
  }
  function drawVendorUI(T) {
    const w = idx >= NEED ? 0 : np * unit(), f = items[ci()].f;
    let l = plate(BIN, '#f1d9a8', '#a8794a', held === 'b' && T - heldAt < .12);
    for (let i = 0; i < 3; i++) fruit(f, BIN.x + 60 + i * 38, BIN.y + 40 - l - (i === 1 ? 5 : 0), 1, (i - 1) * .3);
    txt('PUT', BIN.x + 232, BIN.y + 34 - l, 22, INK, 'center', 100); keycap(BIN.x + 232, BIN.y + 64 - l, 'SPC');
    l = plate(OFF, '#ff9a8a', '#c4584a', held === 'o' && T - heldAt < .12); txt('TAKE OFF', OFF.x + OFF.w / 2, OFF.y + 36 - l, 22, INK, 'center', 130); keycap(OFF.x + OFF.w / 2, OFF.y + 64 - l, '⌫');
    plate(RD, '#2a2540', '#14101c', false); rr(RD.x + 12, RD.y + 18, RD.w - 24, RD.h - 20, 10); ink('#12301f', 2.5);
    txt('WEIGHT', RD.x + 62, RD.y + 36, 15, '#7fe39a', 'center', 80); txt(String(w), RD.x + 160, RD.y + 52, 50, '#5CFF7A', 'center', 80); txt('KG', RD.x + 226, RD.y + 58, 20, '#7fe39a', 'center', 40);
    if (!g.result && T < 3 && !carry) DUO.demoFinger(BIN.x + 100 + Math.sin(T * 3) * 3, BIN.y + 50 + Math.sin(T * 5) * 4, true, (T * 2) % 1);
  }
  function drawShopperUI(T) {
    const lit = k => sentK === k && T - sentAt < .14;
    let l = plate(PMORE, '#4fd06a', '#24803a', lit(0)); tri(PMORE.x + 52, PMORE.y + 40 - l, 18, 1, '#fff'); txt('MORE', PMORE.x + 150, PMORE.y + 36 - l, 28, INK, 'center', 130); keycap(PMORE.x + 150, PMORE.y + 66 - l, '1');
    l = plate(PLESS, '#ffa05c', '#c4584a', lit(1)); tri(PLESS.x + 52, PLESS.y + 40 - l, 18, -1, '#fff'); txt('LESS', PLESS.x + 150, PLESS.y + 36 - l, 28, INK, 'center', 130); keycap(PLESS.x + 150, PLESS.y + 66 - l, '2');
    const inz = idx < NEED && Math.abs(np * unit() - tgt()) <= MARGIN && np > 0;
    l = plate(PDONE, inz ? '#5CFF7A' : '#ffd23f', inz ? '#23a046' : '#c99512', lit(2), inz); txt('DONE!', PDONE.x + PDONE.w / 2, PDONE.y + 36 - l, 30, INK, 'center', 200); keycap(PDONE.x + PDONE.w / 2, PDONE.y + 66 - l, '3');
    if (!g.result && T < 3 && idx === 0 && np === 0) DUO.demoFinger(PMORE.x + 120, PMORE.y + 50 + Math.sin(T * 5) * 4, true, (T * 2) % 1);
  }

  // what a bot may see: the same things as the screen
  g.dbg = {
    bin: () => ctr(BIN), btn: nm => nm === 'off' ? ctr(OFF) : nm === 'bin' ? ctr(BIN) : nm === 'more' ? ctr(PMORE) : nm === 'less' ? ctr(PLESS) : ctr(PDONE),
    view: () => judge ? { hint: hintK, hseq: hSeq, weight: np * unit(), pieces: np, unit: unit(), idx, ready: g.c >= readyAt }
      : { target: idx < NEED ? tgt() : 0, weight: np * unit(), idx, margin: MARGIN, ready: true },
    truth: () => ({ idx, done, strikes, np, tgt: tgt() }),
  };
  wire(g, D, 0, sp, 'du_pesa');
  return g;
}
reg('du_pesa', duPesa, 'PESA JUSTO'); REGMAP.du_pesa.duo = true;

/* ───────────── intro card (520×240), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#8fdcff'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#d9c6a0'; X.fillRect(0, 170, 520, 70);
  for (let i = 0; i < 7; i++) { X.beginPath(); X.moveTo(i * 80, -4); X.lineTo(i * 80 + 80, -4); X.lineTo(i * 80 + 80, 26); X.quadraticCurveTo(i * 80 + 40, 48, i * 80, 26); X.closePath(); ink(i % 2 ? '#fff3d0' : '#e8434f', 3); }
  const n = u < 1 ? 1 : u < 2 ? 2 : u < 3 ? 3 : 4, w = n * 1.2;
  if (role === 0) {
    const dvv = Math.min(w + Math.sin(u * 14) * .3 * (u % 1 < .4 ? 1 : 0), 12);
    dial(260, 100, 44, dvv, 0, tt); pan(260, 164, 100, 44);
    for (let i = 0; i < n; i++) fruit(0, 240 + (i % 3) * 22, 152 - Math.floor(i / 3) * 12, .75, i * .3);
    rr(20, 176, 150, 54, 12); ink('#f1d9a8', 3); for (let i = 0; i < 3; i++) fruit(0, 48 + i * 34, 202, .85, i * .3);
    const k = u % 1; DUO.demoFinger(lerp(60, 250, ease(k)), lerp(204, 150, ease(k)), true, 0);
    rr(380, 70, 108, 52, 14); ink('#fff', 3); tri(404, 96 + Math.sin(tt * 9) * 2, 9, 1, '#2fa84a'); txt('MORE', 452, 97, 17, '#2fa84a', 'center', 52);
    badge('FOLLOW THE HINTS!', 260, 66, 15, '#c98a12', '#fff', 1, -.02);
  } else {
    rr(20, 52, 150, 150, 10); ink('#fff8e6', 3);
    txt('SHOPPING LIST', 95, 70, 12, INK, 'center', 110); rr(30, 88, 130, 40, 8); ink('#ffe14d', 3); fruit(0, 56, 108, .75, -.2); txt('MANGOES', 74, 106, 11, INK, 'left', 50); txt('5', 140, 106, 28, '#e8434f', 'center', 24);
    txt('± 1 KG', 95, 150, 13, '#5b4d7a', 'center', 70);
    dial(300, 96, 44, Math.min(n * 1.4, 12), 5, tt);
    const ph = u < 2.4 ? 0 : 2;
    [['MORE', '#4fd06a', 200], ['LESS', '#ffa05c', 304], ['DONE!', '#ffd23f', 408]].forEach(([s, c, x], i) => { rr(x - 46, 180, 96, 42, 12); ink(c, 3); txt(s, x + 2, 201, 17, INK, 'center', 80); });
    DUO.demoFinger(ph === 0 ? 246 : 456, 202, true, u % 1);
    badge('GUIDE THE VENDOR!', 330, 20, 15, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_pesa = [['VENDOR', 'WEIGH THE FRUIT', 'DRAG FRUIT, FOLLOW HINTS'], ['SHOPPER', 'CALL MORE, LESS, DONE', 'TAP THE HINT PLATES']];
DUO.DEMOS.du_pesa = [t => demo(0, t), t => demo(1, t)];

})();
