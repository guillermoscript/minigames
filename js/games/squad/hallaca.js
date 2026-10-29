'use strict';
/* ═════════ SQUAD · HALLACAS EN FILA (sq_hallaca) ═════════
   A Christmas kitchen: ONE long plátano leaf runs down the table and the hallaca travels along it from seat to seat while the abuela
   watches with her arms crossed (and a slipper under her arm). Seats (3): DOUGH -> STEW -> TIE; (4) DOUGH -> STEW -> FOLD -> TIE. The last seat (TIE) is the JUDGE.
   - DOUGH (seat 0): a beat ring shrinks onto the spoon, tap ON the beat. 3 good taps fill the leaf; spamming makes it too thick and it overflows (redo).
   - STEW: drag the spoon along the snake, twice (2 scoops). Leaving the path spills the stew; too much spill = redo.
   - FOLD (4 seats): swipe left, right, left, right (or ◄ ► keys).
   - TIE: trace a cross (down, across) twice with the pabilo. Before tying, the abuela inspects it: a sloppy one (quality < .5), or one with a hole
     (the seeded `FL`-th hallaca is flawed the first time) goes BACK to the dough seat (loop-back, a 'r' message).
   A quality number q (0..1) travels with the hallaca ('p' message) and is averaged with every step. A hallaca only advances when a step is good.
   Netcode: every seat owns its state. Messages: 'p' {i,s,q} step s done; 'r' {i,h} sent back; 'o' {i,k} tied (k = count); 'w' {i,v} progress (coalesced).
   Time inside the game is S = g.c * sqrt(sp): everything (beat, tracing, inspection) runs in S so faster speeds are just harder.
   Win = 5 tied before the pot boils (the judge calls g.finish('win')); lose = the clock: a hallaca bursts and the slipper flies. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

const NEED = 5, CAP = 10, BP = .44, TOL = 34, SPILL = 1.25;
const KINDS = { 3: ['masa', 'guiso', 'atar'], 4: ['masa', 'guiso', 'tapar', 'atar'] };
const SXS = { 3: [245, 410, 575], 4: [225, 345, 465, 585] };
const ST_Y = 276, POT = [738, 232], WC = [400, 428], PANEL = [16, 340, 768, 212];
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const LEAF = '#4cb35a', LEAF2 = '#2f8a43', MASA = '#f4c04a', MASA2 = '#d99a2a', STEW = '#8a3322';
const SNAKES = [0, 1].map(j => Array.from({ length: 37 }, (_, k) => { const u = k / 36; return [j ? 650 - 250 * u : 150 + 250 * u, 440 + 40 * Math.sin(u * TAU * 1.5 + j * Math.PI)]; }));   // two scoops: the stew pot (left) and the garnish bowl (right) both end on the leaf
const LINE = (a, b, N = 14) => Array.from({ length: N + 1 }, (_, k) => [lerp(a[0], b[0], k / N), lerp(a[1], b[1], k / N)]);
const CROSS = [LINE([400, 378], [400, 482], 10), LINE([330, 430], [470, 430], 10)];

/* ───────────── drawing kit (X can be an offscreen context while baking) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(build, base, shade, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 26);
  tri(x - 7, y + 11, x, y + 21, x + 7, y + 11, col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 14);
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
function keycap(x, y, label, on) {
  X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(30, X.measureText(t(label)).width + 18);
  rr(x - w / 2, y - 13 + (on ? 3 : 0), w, 26, 7); ink(on ? '#ffe14d' : '#fff', 2.5); txt(label, x, y + 1 + (on ? 3 : 0), 15, INK, 'center', w - 6);
}
function plate(x, y, w, h, col, dk, down) {
  const d = down ? 3 : 9;
  rr(x, y + 9, w, h, 20); ink(dk, 4);
  rr(x, y + 9 - d, w, h, 20); ink(col, 4); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 10, 5); X.fill();
}
function star5(x, y, ro, ri, rot, fill, o = 2) { X.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / 5; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); }
function steam(x, y, T, k, n = 4) { for (let i = 0; i < n; i++) { const ph = (T * .55 + i / n) % 1; X.globalAlpha = (1 - ph) * .75 * k; el(x + Math.sin(ph * 6 + i * 2) * 12, y - ph * 70, 9 + ph * 12, 8 + ph * 9); ink('#fff', 2); } X.globalAlpha = 1; }
const hash = k => { let h = (k * 2654435761) >>> 0; h ^= h >>> 15; return (h % 1000) / 1000; };

/* ───────────── a hallaca at any stage: o = { masa (0..1.5 thickness), guiso (0..1), fold (0..1), tie (0..1 = 4 strokes), hole } ───────────── */
function packet(x, y, s, o) {
  X.save(); X.translate(x, y); X.scale(s, s);
  const fold = o.fold || 0;
  if (fold < 1) {
    cel(() => rr(-52, -31, 104, 62, 17), LEAF, LEAF2, 3.5, 5, 4);
    X.strokeStyle = 'rgba(20,90,40,.4)'; X.lineWidth = 2.2; X.lineCap = 'round';
    X.beginPath(); X.moveTo(-46, 0); X.lineTo(46, 0); for (let i = -3; i <= 3; i++) if (i) { X.moveTo(i * 13, 0); X.lineTo(i * 13 + 9, -22); X.moveTo(i * 13, 0); X.lineTo(i * 13 + 9, 22); } X.stroke();
    glint(-28, -21, 20, 4.5, -.1, .45);
    const mk = o.masa || 0;
    if (mk > 0) {
      const rx = 20 + 24 * Math.min(1.5, mk), ry = 9 + 12 * Math.min(1.5, mk);
      cel(() => el(0, 1, rx, ry), MASA, MASA2, 2.5, 4, 3.5); glint(-rx * .35, -ry * .4, rx * .3, ry * .22, -.2, .6);
      if (mk > 1.2) { X.fillStyle = MASA; for (const sx of [-1, 1]) { el(sx * (rx + 3), ry * .5, 7, 5); ink(MASA, 2.5); } }
    }
    const gk = o.guiso || 0;
    if (gk > 0) {
      const gy = 1;
      el(0, gy, 30 * Math.min(1, gk * 1.2), 11 * Math.min(1, gk * 1.2)); ink(STEW, 3); glint(-9, gy - 4, 8, 3, -.2, .4);
      if (gk > .3) { X.beginPath(); X.arc(-12, gy - 1, 4, 0, TAU); ink('#6b8a2c', 2); X.beginPath(); X.arc(8, gy + 3, 3.4, 0, TAU); ink('#4a2a55', 2); X.beginPath(); X.arc(14, gy - 4, 3, 0, TAU); ink('#f5e7c2', 2); }
      if (gk > .6) line([[-22, gy + 2], [4, gy - 6]], 3, '#d9362f');
    }
    if (o.hole) { el(16, -2, 7, 5); ink('#2a1a20', 2); X.strokeStyle = '#ff3d4d'; X.lineWidth = 2.5; el(16, -2, 11, 8); X.stroke(); }
  }
  if (fold > 0) {
    const f = Math.min(1, fold);
    cel(() => rr(-48, -26, 96, 52, 14), '#3f9a4a', '#277a38', 3, 5, 4);
    X.strokeStyle = 'rgba(15,70,30,.55)'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-40, -8); X.lineTo(40, -8); X.moveTo(-40, 8); X.lineTo(40, 8); X.stroke();
    glint(-26, -17, 20, 4, -.1, .5);
    if (f < 1) { X.save(); X.globalAlpha = 1 - f; rr(-52 + f * 50, -31, 104 - f * 50, 62, 16); ink(LEAF, 4); X.restore(); }
  }
  const tk = o.tie || 0;
  if (tk > 0) {
    const seg = [[[-5, -27], [-5, 27]], [[-45, -5], [45, -5]], [[5, -27], [5, 27]], [[-45, 5], [45, 5]]];
    for (let i = 0; i < 4; i++) { const p = clamp(tk * 4 - i, 0, 1); if (p <= 0) continue; const [a, b] = seg[i]; line([a, [lerp(a[0], b[0], p), lerp(a[1], b[1], p)]], 4.5, '#f4e5b8'); }
    if (tk >= 1) { X.beginPath(); X.arc(0, 0, 6, 0, TAU); ink('#f4e5b8', 2.5); }
  }
  X.restore();
}

/* ───────────── the kitchen, painted once (back layer and front layer) ───────────── */
let BGB = null, FGB = null;
function bakeLayer(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; const old = X; X = c.getContext('2d'); fn(); X = old; return c; }
function buildBack() {
  let g = X.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, '#f6c677'); g.addColorStop(1, '#ffe5ad'); X.fillStyle = g; X.fillRect(0, 0, W, 260);
  X.fillStyle = 'rgba(200,120,70,.14)'; for (let x = 0; x < W; x += 44) X.fillRect(x, 0, 20, 200);
  X.fillStyle = 'rgba(255,120,150,.4)'; for (let y = 40; y < 180; y += 46) for (let x = 22 + (y / 46 & 1) * 22; x < W; x += 44) { X.beginPath(); X.arc(x, y, 3.5, 0, TAU); X.fill(); }
  // azulejo wainscot
  for (let r = 0; r < 4; r++) for (let c = 0; c < 40; c++) { X.fillStyle = (r + c) & 1 ? '#e9f4ff' : '#58a8ea'; X.fillRect(c * 20, 180 + r * 20, 20, 20); }
  X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 1.5; for (let r = 0; r <= 4; r++) { X.beginPath(); X.moveTo(0, 180 + r * 20); X.lineTo(W, 180 + r * 20); X.stroke(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 180); X.lineTo(W, 180); X.stroke();
  // window onto a Christmas night
  rr(452, 62, 124, 100, 8); ink('#5b3a2a', 5);
  g = X.createLinearGradient(0, 70, 0, 154); g.addColorStop(0, '#1d1840'); g.addColorStop(1, '#4a3aa0'); X.fillStyle = g; rr(458, 68, 112, 88, 4); X.fill();
  X.beginPath(); X.arc(540, 94, 13, 0, TAU); ink('#fff3b0', 2.5); X.fillStyle = '#1d1840'; X.beginPath(); X.arc(546, 90, 12, 0, TAU); X.fill();
  X.fillStyle = '#2a1f62'; X.beginPath(); X.moveTo(458, 156); for (let i = 0; i <= 7; i++) X.lineTo(458 + i * 16, 140 + (i % 2) * 8); X.lineTo(570, 156); X.fill();
  X.fillStyle = '#ffd23f'; for (const [a, b] of [[478, 144], [504, 138], [528, 146], [552, 140]]) X.fillRect(a, b, 5, 5);
  X.fillStyle = '#5b3a2a'; X.fillRect(512, 68, 5, 88); X.fillRect(458, 108, 112, 5);
  rr(444, 158, 140, 14, 5); ink('#d9944f', 3.5);
  // shelf with pots and the radio
  rr(300, 118, 130, 11, 4); ink('#d9944f', 3.5); rr(306, 128, 8, 14, 2); ink('#a5622c', 2); rr(416, 128, 8, 14, 2); ink('#a5622c', 2);
  cel(() => rr(372, 82, 46, 36, 8), '#d9d4ee', '#aaa4c9', 3, 4, 3.5); el(388, 100, 10, 10); ink('#7a7596', 2.5); X.fillStyle = INK; for (let i = 0; i < 3; i++) X.fillRect(404, 90 + i * 8, 9, 3);
  line([[394, 82], [408, 62]], 3, '#8a86a3');
  cel(() => rr(318, 92, 32, 26, 6), '#e8434f', '#b8283a', 3, 4, 3.5); rr(314, 88, 40, 8, 4); ink('#f7f4ff', 2.5);
  // calendar
  rr(196, 70, 60, 74, 6); ink('#fffaf0', 3.5); X.fillStyle = '#e8434f'; X.fillRect(199, 73, 54, 20); X.fillStyle = INK; X.font = '900 34px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('24', 226, 118);
  X.beginPath(); X.arc(226, 66, 4, 0, TAU); ink('#c9ced6', 2);
  // the stove (right) with a blue flame bar under the pot
  cel(() => rr(672, 252, 128, 100, 10), '#d3dbe8', '#9aa6bd', 4, 5, 4); rr(684, 292, 104, 46, 6); ink('#3b3550', 3);
  for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(702 + i * 32, 315, 8, 0, TAU); ink('#8f9cb3', 2.5); }
  X.fillStyle = INK; X.fillRect(0, 322, W, 4);
  // floor strip under the table
  X.fillStyle = '#b97a46'; X.fillRect(0, 326, W, 14);
}
function buildFront() {
  // the table: top, front face, the shared plátano leaf
  rr(104, 252, 592, 54, 12); ink('#e3a868', 5); X.fillStyle = 'rgba(255,255,255,.25)'; rr(114, 257, 572, 8, 4); X.fill();
  rr(116, 298, 568, 40, 8); ink('#a5622c', 4); X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 2; for (let x = 160; x < 680; x += 120) { X.beginPath(); X.moveTo(x, 302); X.lineTo(x, 334); X.stroke(); }
  X.save(); X.translate(0, 0);
  cel(() => rr(126, 262, 548, 36, 18), LEAF, LEAF2, 3, 5, 3.5);
  X.strokeStyle = 'rgba(20,90,40,.5)'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(140, 280); X.lineTo(660, 280); for (let x = 160; x < 650; x += 34) { X.moveTo(x, 280); X.lineTo(x + 14, 266); X.moveTo(x, 280); X.lineTo(x + 14, 294); } X.stroke();
  glint(260, 268, 90, 3.2, 0, .35);
  X.restore();
  // the workspace counter for the local seat
  const [px, py, pw, ph] = PANEL;
  rr(px, py, pw, ph, 22); ink('#a5622c', 5); rr(px + 14, py + 12, pw - 28, ph - 24, 16); ink('#e3a868', 3.5);
  X.strokeStyle = 'rgba(165,98,44,.35)'; X.lineWidth = 2; for (let i = 1; i < 4; i++) { X.beginPath(); X.moveTo(px + 22, py + 12 + i * (ph - 24) / 4); X.lineTo(px + pw - 22, py + 12 + i * (ph - 24) / 4); X.stroke(); }
  X.fillStyle = 'rgba(255,255,255,.3)'; rr(px + 24, py + 18, pw - 48, 7, 3.5); X.fill();
}

/* ───────────── the abuela, the pot, the slipper ───────────── */
function slipper(x, y, rot, s = 1) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  rr(-26, -9, 52, 18, 9); ink('#ff6fa3', 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(-8, -3, 11, 3, 0); X.fill();
  rr(-6, -15, 20, 10, 5); ink('#ffd23f', 3);
  X.restore();
}
function abuela(x, y, T, mood, grump, sway) {
  X.fillStyle = 'rgba(20,16,28,.25)'; el(x, y + 3, 34, 8); X.fill();
  const u = 4.4;
  caos(x, y, u, { col: '#9a74d6', mood });
  X.beginPath(); X.arc(x - 3.2 * u, y - 12.8 * u, 2.3 * u, 0, TAU); ink('#e7e4ee', 3); glint(x - 3.9 * u, y - 13.6 * u, .7 * u, .4 * u, -.5, .7);
  for (const sx of [-1, 1]) { X.beginPath(); X.arc(x + sx * 2.6 * u, y - 6.1 * u, 1.9 * u, 0, TAU); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke(); }
  line([[x - .7 * u, y - 6.1 * u], [x + .7 * u, y - 6.1 * u]], 2, INK);
  rr(x - 5.4 * u, y - 5 * u + sway * .2, 10.8 * u, 2.3 * u, 4); ink('#9a74d6', 3);                  // crossed arms
  X.fillStyle = '#e2ad8b'; X.beginPath(); X.arc(x - 4.6 * u, y - 3.9 * u + sway * .2, 1.5 * u, 0, TAU); X.fill(); X.beginPath(); X.arc(x + 4.6 * u, y - 3.9 * u + sway * .2, 1.5 * u, 0, TAU); X.fill();
  rr(x - 3.2 * u, y - 2.6 * u, 6.4 * u, 2.4 * u, 3); ink('#f6f4fb', 2.5);                       // apron
  if (grump > 0) for (const sx of [-1, 1]) line([[x + sx * 4.4 * u, y - 7.6 * u - sx * grump * .5 * u], [x + sx * 1.2 * u, y - 7.6 * u + sx * grump * .5 * u]], 2.6, INK);
}
function speech(s, x, y, w) {
  X.font = '700 15px Fredoka, Arial, sans-serif'; const tw = Math.min(w || 200, X.measureText(t(s)).width + 24);
  tri(x - 20, y + 14, x - 36, y + 34, x - 4, y + 14, '#fff', 3);
  rr(x - tw / 2, y - 16, tw, 32, 14); ink('#fff', 3.5);
  txt(s, x, y + 1, 15, INK, 'center', tw - 14);
}
function potDraw(T, boilK, tied, lidK, won, lost, rk) {
  const [px, py] = POT, rat = lost ? 0 : boilK * boilK;
  const fl = Math.sin(T * 21) * .5 + .5;
  for (let i = 0; i < 5; i++) { const fx = px - 40 + i * 20, fh = 12 + 10 * fl + (i & 1) * 5; tri(fx - 8, 270, fx, 270 - fh * (.6 + .4 * boilK), fx + 8, 270, i & 1 ? '#ffd23f' : '#ff8a3d', 2.5); }
  const bounce = lidK > .3 ? Math.abs(Math.sin(T * 26)) * 4 * lidK : 0;
  cel(() => { X.beginPath(); X.moveTo(px - 54, py - 18); X.lineTo(px - 48, py + 36); X.quadraticCurveTo(px, py + 50, px + 48, py + 36); X.lineTo(px + 54, py - 18); X.closePath(); }, '#cfd8e6', '#8f9cb3', 6, 6, 5);
  glint(px - 32, py + 6, 6, 16, .2, .6);
  for (const sx of [-1, 1]) { rr(px + sx * 54 - (sx > 0 ? 0 : 14), py - 4, 14, 10, 4); ink('#8f9cb3', 2.5); }
  // the water and the packets in it
  X.save(); rr(px - 50, py - 22, 100, 14, 6); X.clip(); X.fillStyle = '#e9a85a'; X.fillRect(px - 52, py - 24, 104, 18); X.restore();
  for (let k = 0; k < Math.min(tied, NEED); k++) { if (won && rk > .2) continue; const ax = px - 36 + k * 18; packet(ax, py - 22 + Math.sin(T * 5 + k * 1.7) * 2.5, .24, { fold: 1, tie: 1 }); }
  if (!won && !lost) { for (let i = 0; i < 3; i++) { const ph = (T * (1 + rat * 2) + i / 3) % 1; X.globalAlpha = 1 - ph; X.beginPath(); X.arc(px - 24 + i * 24 + Math.sin(T * 9 + i) * 3, py - 20 - ph * 14, 3 + ph * 3, 0, TAU); ink('#fff', 1.8); X.globalAlpha = 1; } }
  rr(px - 58, py - 26 - bounce, 116, 12, 5); ink('#b9c3d6', 4);
  X.beginPath(); X.arc(px, py - 32 - bounce, 6, 0, TAU); ink('#e8434f', 3);
  steam(px - 10, py - 40, T, won ? 1 : .5 + boilK * .6);
}
function thermo(x, y, k, T) {
  rr(x - 8, y, 16, 100, 8); ink('#fffaf0', 3.5);
  X.save(); rr(x - 8, y, 16, 100, 8); X.clip(); X.fillStyle = k > .75 ? '#ff4d5e' : '#ffd23f'; X.fillRect(x - 10, y + 100 - 100 * k, 20, 100 * k + 2); X.restore();
  X.beginPath(); X.arc(x, y + 108, 12, 0, TAU); ink(k > .75 ? '#ff4d5e' : '#ffd23f', 3.5); glint(x - 4, y + 104, 3, 5, -.3, .7);
  rr(x - 8, y, 16, 100, 8); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  if (k > .75) { X.globalAlpha = .5 + .5 * Math.sin(T * 14); star5(x + 20, y + 20, 9, 4, T * 3, '#ffe14d', 2); X.globalAlpha = 1; }
}

/* ═════════ the game ═════════ */
function sqHallaca(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), kinds = KINDS[n], kind = kinds[me], SX = SXS[n], judge = n - 1;
  const FL = 1 + Math.floor(R() * 3);                       // the hallaca (by id) with a hole in the masa: abuela sends it back once
  const flawed = {};
  /* state */
  const it = [];                                            // by id: { i, c: how many steps done = the seat that works it next, q, prog, x, at, hole, rej }
  const queue = [], retries = [];
  let cur = null, nextId = 0, S = 0, tiedN = 0, resAt = -1, lastSent = -9, lastV = -1, ending = false, tick = -1;
  let ptr = null, ptrDown = false, keyHeld = 0, keyUsed = false, kx = 0, ky = 0, swX = 0, tapAt = -9, sayAt = -9, sayS = '', sayCol = 0;
  const w = { th: 0, taps: 0, offs: 0, spam: 0, lastTap: -9, lock: .3, prog: 0, offT: 0, pass: 0, stroke: 0, fold: 0, mist: 0, insp: 0 };
  const act = Array.from({ length: n }, () => -9), tieAt = [], pops = [], bits = [];
  const colOf = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], nameOf = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  const mkIt = i => (it[i] = it[i] || { i, c: 0, q: 1, prog: 0, x: SX[0], at: 0, hole: 0, rej: 0, flyAt: -9 });
  function pop(s, x, y, size, bgc) { pops.push({ s, x, y, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  function say(s, col) { sayAt = g.c; sayS = s; sayCol = col || 0; }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .8, vx: 0, vy: 0, r: 4, c: '#fff' }, o)); }
  const pathOf = () => kind === 'guiso' ? SNAKES[w.pass & 1] : kind === 'atar' ? CROSS[w.stroke & 1] : null;
  const total = () => kind === 'guiso' ? 2 : 4;
  function resetWork(keepLock) { w.th = 0; w.taps = 0; w.offs = 0; w.spam = 0; w.prog = 0; w.offT = 0; w.pass = 0; w.stroke = 0; w.fold = 0; w.mist = 0; w.insp = 0; if (!keepLock) w.lock = .15; }
  const sv = () => kind === 'masa' ? clamp(w.th / 3, 0, 1) : kind === 'guiso' ? (w.pass + w.prog) / 2 : kind === 'tapar' ? w.fold / 4 : (w.stroke + w.prog) / 4;
  const workMood = () => cur ? sv() : 0;
  function takeNext() {
    if (cur || g.result) return;
    let c = null;
    if (me === 0) { if (retries.length) c = { i: retries.shift(), q: 1 }; else if (nextId < CAP) c = { i: nextId++, q: 1 }; }
    else if (queue.length) c = queue.shift();
    if (!c) return;
    cur = c; resetWork(true); const m = mkIt(c.i); m.c = me; m.prog = 0; m.at = g.c; if (me === 0) { m.x = SX[0]; if (!m.hole) m.hole = 0; }
    if (kind === 'atar') w.insp = .35;
    if (kind === 'guiso' || kind === 'atar') { const p = pathOf(); if (!ptr || keyUsed) ptr = p[0].slice(); }
  }
  function sendProgress(force) {
    if (!cur) return; const v = Math.round(sv() * 100);
    if ((v !== lastV || force) && g.c - lastSent >= .1) { lastV = v; lastSent = g.c; D.send('w', { i: cur.i, v }, true); }
  }
  function stepDone(qs) {
    const m = it[cur.i], i = cur.i; let q = me === 0 ? qs : (cur.q + qs) / 2; q = clamp(q, 0, 1);
    act[me] = g.c; sfx.coin();
    if (kind === 'atar') {
      tiedN++; m.c = n; m.q = q; m.flyAt = g.c; tieAt[tiedN - 1] = g.c; D.send('o', { i, k: tiedN });
      pop('TIED!', 400, 252, 26, '#22a447'); cur = null; w.lock = .3; burst(SX[me], 262, '#f4e5b8', 10);
      if (tiedN >= NEED && !g.result) g.finish('win');
    } else {
      D.send('p', { i, s: me, q: Math.round(q * 100) }); m.c = me + 1; m.q = q; m.prog = 0; m.at = g.c; cur = null; w.lock = .1;
      bit({ x: SX[me], y: 250, vy: -80, vx: 0, c: '#ffe14d', r: 5 });
    }
  }
  function redo(word, col, lock) {
    sfx.miss(); shake(3, .1); pop(word, 400, 300, 22, col || '#8f88a6'); act[me] = g.c;
    resetWork(true); w.lock = lock || .45; if (cur) { const m = it[cur.i]; if (m) m.prog = 0; }
  }
  function inspect() {
    const i = cur.i, m = it[i], flaw = i === FL && !flawed[i];
    if (cur.q < .5 || flaw) {
      flawed[i] = true; D.send('r', { i, h: flaw ? 1 : 0 }); m.c = 0; m.rej = 1; m.hole = flaw ? 1 : 0; m.prog = 0; m.at = g.c;
      pop('BACK!', 400, 300, 24, '#e8343d'); say(flaw ? 'THERE IS A HOLE!' : 'SLOPPY, MY LOVE!', 1); sfx.buzz(); shake(3, .12); cur = null; w.lock = .3;
    } else w.insp = -1;
  }
  /* ── DOUGH */
  function tapMasa() {
    if (kind !== 'masa' || g.result || !cur || w.lock > 0) return;
    const ph = S % BP, err = Math.min(ph, BP - ph), gap = S - w.lastTap; w.lastTap = S; tapAt = g.c; act[me] = g.c;
    let add;
    if (gap < .22) { add = 2; w.spam++; } else if (err <= .14) { add = 1; sfx.tick(); } else { add = 1.35; w.offs++; }
    w.th += add; w.taps++; it[cur.i].prog = clamp(w.th / 3, 0, 1.5);
    bit({ x: 400 + (hash(w.taps) - .5) * 80, y: 400, vy: -120, vx: (hash(w.taps + 5) - .5) * 120, c: MASA, r: 5 });
    if (w.th > 4.01) { redo('TOO THICK!', '#e8a31d', .6); return; }
    if (w.th >= 3) { sendProgress(true); stepDone(clamp(1 - .14 * w.offs - .18 * w.spam - Math.max(0, w.th - 3) * .15, .3, 1)); }
    else sendProgress();
  }
  /* ── tracing (STEW and TIE) */
  const active = () => ptrDown || keyHeld > 0;
  function trace(dtS) {
    const p = pathOf(); if (!p || !cur || w.lock > 0 || w.insp > 0 || !ptr) return;
    const N = p.length - 1, i0 = Math.floor(w.prog * N), i1 = Math.min(N, Math.floor((w.prog + .2) * N) + 1);
    let bi = -1, bd = 1e9;
    for (let k = i0; k <= i1; k++) { const d = Math.hypot(p[k][0] - ptr[0], p[k][1] - ptr[1]); if (d < bd) { bd = d; bi = k; } }
    if (!active()) return;
    if (bd <= TOL) {
      if (bi / N > w.prog) { w.prog = bi / N; act[me] = g.c; if (kind === 'guiso' && g.c % .14 < .05) snd(300 + w.prog * 300, .04, 'sine', .03); }
      if (w.prog >= .96) {
        w.prog = 0; w.pass++; sfx.pop(); bit({ x: p[N][0], y: p[N][1], vy: -90, c: kind === 'guiso' ? STEW : '#f4e5b8', r: 6 });
        if (kind === 'guiso') { if (w.pass >= 2) { sendProgress(true); stepDone(clamp(1 - w.offT / 2.2, .3, 1)); } else if (keyUsed) ptr = SNAKES[1][0].slice(); }
        else { w.stroke++; w.pass = 0; if (w.stroke >= 4) { sendProgress(true); stepDone(clamp(1 - w.offT / 2.2, .3, 1)); } else if (keyUsed) ptr = CROSS[w.stroke & 1][0].slice(); }
      }
    } else if (w.prog > 0) {
      w.offT += dtS;
      if (g.c % .1 < .05) bit({ x: ptr[0], y: ptr[1] + 8, vy: 60, c: kind === 'guiso' ? STEW : '#f4e5b8', r: 3.5, life: .5 });
      if (w.offT >= SPILL) redo(kind === 'guiso' ? 'STEW SPILLED!' : 'LOOSE!', '#8f88a6', .5);
    }
  }
  /* ── FOLD */
  const foldDir = () => cur && kind === 'tapar' && w.lock <= 0 ? (w.fold & 1 ? 1 : -1) : 0;
  function tryFold(dir) {
    if (kind !== 'tapar' || !cur || g.result || w.lock > 0) return; const want = w.fold & 1 ? 1 : -1;
    if (dir === want) {
      w.fold++; act[me] = g.c; sfx.pop(); it[cur.i].prog = w.fold / 4; bit({ x: 400 + dir * 70, y: 428, vy: -70, c: LEAF, r: 6 });
      if (w.fold >= 4) { sendProgress(true); stepDone(clamp(1 - w.mist * .12, .4, 1)); } else sendProgress();
    } else { w.mist++; sfx.blip && sfx.blip(); }
  }

  const g = {
    c: 0, dur: 18, pts: 0,
    cmd: { masa: 'SPREAD!', guiso: 'SCOOP!', tapar: 'FOLD!', atar: 'TIE!' }[kind],
    roleLabel: { masa: 'DOUGH', guiso: 'STEW', tapar: 'FOLD', atar: 'TIE' }[kind],
    hint: {
      masa: 'TAP ON THE BEAT (CLICK / SPACE) - 3 GOOD TAPS FILL THE LEAF, TOO FAST AND IT OVERFLOWS',
      guiso: 'DRAG THE SPOON ALONG THE SNAKE (OR ARROWS) - 2 SCOOPS INTO THE LEAF, DON\'T SPILL',
      tapar: 'SWIPE LEFT, RIGHT, LEFT, RIGHT (OR ◄ ►) TO FOLD THE LEAF',
      atar: 'TRACE THE CROSS TWICE (OR ARROWS) TO TIE IT - SLOPPY ONES GO BACK TO THE DOUGH',
    }[kind],
    thint: {
      masa: 'TAP ON THE BEAT - 3 GOOD TAPS FILL THE LEAF, TOO FAST AND IT OVERFLOWS',
      guiso: 'DRAG THE SPOON ALONG THE SNAKE - 2 SCOOPS INTO THE LEAF, DON\'T SPILL',
      tapar: 'SWIPE LEFT, RIGHT, LEFT, RIGHT TO FOLD THE LEAF',
      atar: 'TRACE THE CROSS TWICE TO TIE IT - SLOPPY ONES GO BACK TO THE DOUGH',
    }[kind],
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) { resAt = g.c; if (g.result === 'win') { sfx.sparkle(); snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); } else { sfx.thud(); noise(.5, .07, 900, 200, 'lowpass', .1); shake(6, .22); } }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += 700 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      while (pops.length && g.c - pops[0].t0 > 1) pops.shift();
      if (g.result) return;
      const dS = dt * TS; S += dS; w.lock = Math.max(0, w.lock - dS);
      // keyboard cursor
      if (keyHeld > 0 && (kind === 'guiso' || kind === 'atar')) { const p = pathOf(); if (!ptr) ptr = p[0].slice(); ptr = [clamp(ptr[0] + kx * 320 * dt, 40, 760), clamp(ptr[1] + ky * 320 * dt, 345, 545)]; }
      takeNext();
      if (kind === 'masa' && cur) { const k = Math.floor(S / BP); if (k !== tick) { tick = k; snd(280, .03, 'sine', .025); } }
      if (kind === 'atar' && cur && w.insp > 0) { w.insp -= dS; if (w.insp <= 0) inspect(); }
      if (cur) { if (kind === 'guiso' || kind === 'atar') trace(dS); if (cur) { it[cur.i].prog = kind === 'masa' ? clamp(w.th / 3, 0, 1.5) : sv(); sendProgress(); } }
      if (g.judge && !g.result && g.c >= g.limit) g.finish('lose');
    },
    msg(type, d, from) {
      if (!d && d !== 0) return;
      if (type === 'p') {
        const i = d.i; if (!(i >= 0 && i < CAP) || !(d.s >= 0 && d.s < n - 1)) return;
        const m = mkIt(i); if (m.c <= d.s) { m.c = d.s + 1; m.q = d.q / 100; m.prog = 0; m.at = g.c; }
        act[d.s] = g.c;
        if (d.s + 1 === me && !queue.some(q => q.i === i) && !(cur && cur.i === i)) queue.push({ i, q: d.q / 100 });
      } else if (type === 'r') {
        const i = d.i; if (!(i >= 0 && i < CAP)) return; const m = mkIt(i); m.c = 0; m.rej = 1; m.hole = d.h ? 1 : 0; m.prog = 0; m.at = g.c; flawed[i] = true;
        act[n - 1] = g.c; if (d.h) say('THERE IS A HOLE!', 1); else say('SLOPPY, MY LOVE!', 1);
        if (me === 0 && !retries.includes(i)) retries.push(i);
      } else if (type === 'o') {
        const i = d.i; if (!(i >= 0 && i < CAP)) return; const m = mkIt(i); m.c = n; m.flyAt = g.c; tiedN = Math.max(tiedN, d.k || 0); tieAt[tiedN - 1] = g.c; act[n - 1] = g.c; sfx.coin();
      } else if (type === 'w') {
        const i = d.i; if (!(i >= 0 && i < CAP)) return; const m = mkIt(i); if (m.c <= from) { m.c = from; m.prog = d.v / 100; } act[from] = g.c;
      }
    },
    down(p) {
      if (g.result) return; ptr = [p.x, p.y]; ptrDown = true; keyUsed = false; swX = p.x;
      if (kind === 'masa') tapMasa();
    },
    move(p) {
      if (g.result) return; ptr = [p.x, p.y];
      if (kind === 'tapar' && ptrDown) { const dx = p.x - swX, want = w.fold & 1 ? 1 : -1; if (Math.abs(dx) > 90) { if (Math.sign(dx) === want) { tryFold(want); } swX = p.x; } }
    },
    up() { ptrDown = false; },
    key(e) {
      if (!e.code || g.result) return;
      const c = e.code;
      if (kind === 'masa') { if (!e.repeat && (c === 'Space' || c === 'Enter' || c === 'KeyZ' || c === 'KeyX' || c === 'ArrowDown' || c === 'KeyS' || c === 'ArrowUp' || c === 'KeyW')) tapMasa(); return; }
      if (kind === 'tapar') { if (!e.repeat) { if (c === 'ArrowLeft' || c === 'KeyA') tryFold(-1); else if (c === 'ArrowRight' || c === 'KeyD') tryFold(1); } return; }
      let hit = true;
      if (c === 'ArrowLeft' || c === 'KeyA') kx = -1; else if (c === 'ArrowRight' || c === 'KeyD') kx = 1; else if (c === 'ArrowUp' || c === 'KeyW') ky = -1; else if (c === 'ArrowDown' || c === 'KeyS') ky = 1; else hit = false;
      if (hit) { keyHeld = (kx ? 1 : 0) + (ky ? 1 : 0); keyUsed = true; if (!ptr) ptr = pathOf() ? pathOf()[0].slice() : [400, 440]; }
    },
    keyup(e) {
      const c = e.code;
      if (c === 'ArrowLeft' || c === 'KeyA') { if (kx < 0) kx = 0; } else if (c === 'ArrowRight' || c === 'KeyD') { if (kx > 0) kx = 0; } else if (c === 'ArrowUp' || c === 'KeyW') { if (ky < 0) ky = 0; } else if (c === 'ArrowDown' || c === 'KeyS') { if (ky > 0) ky = 0; }
      keyHeld = (kx ? 1 : 0) + (ky ? 1 : 0);
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1, LIMS = Math.max(1, (g.limit || 17) * TS), boilK = clamp(S / LIMS, 0, 1);
      if (!BGB) { BGB = bakeLayer(buildBack); FGB = bakeLayer(buildFront); }
      X.drawImage(BGB, 0, 0);
      // live gags: twinkling stars, the cat's tail on the sill, the radio's notes, Christmas lights
      for (let i = 0; i < 6; i++) { X.globalAlpha = .4 + .6 * Math.abs(Math.sin(T * 2 + i * 1.7)); star5(468 + i * 18 + (i % 2) * 5, 78 + (i * 23) % 40, 3.5, 1.5, T + i, '#fff', 0); } X.globalAlpha = 1;
      const tail = Math.sin(T * 3) * .5;
      cel(() => { X.beginPath(); X.ellipse(500, 150, 22, 13, 0, Math.PI, TAU); X.closePath(); }, '#f0a04b', '#c4772b', 3, 4, 3.5);
      X.beginPath(); X.arc(486, 134, 9, 0, TAU); ink('#f0a04b', 3); tri(479, 128, 481, 118, 486, 126, '#f0a04b', 2.5); tri(487, 126, 491, 118, 493, 129, '#f0a04b', 2.5);
      X.fillStyle = INK; X.fillRect(483, 133, 2, 3); X.fillRect(489, 133, 2, 3);
      X.beginPath(); X.moveTo(520, 150); X.quadraticCurveTo(540 + tail * 14, 140, 534 + tail * 22, 120); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#f0a04b'; X.stroke();
      for (let k = 0; k < 2; k++) { const ph = (T * .5 + k * .5) % 1; X.globalAlpha = 1 - ph; txt(k ? '♪' : '♫', 396 + Math.sin(ph * 6 + k) * 12, 76 - ph * 40, 22, '#ff5c8a'); } X.globalAlpha = 1;
      for (let i = 0; i < 14; i++) { const lx = 20 + i * 57, ly = 14 + Math.sin(i * .9) * 3, on = Math.sin(T * 5 + i * 1.3) > -.2; X.beginPath(); X.arc(lx, ly, 5.5, 0, TAU); ink(on ? ['#ff4d5e', '#ffe14d', '#5CFF7A', '#4DB8FF'][i % 4] : '#6a6585', 2); }
      // abuela
      const grumpK = lost ? 1 : clamp((boilK - .3) * 1.6, 0, 1), foot = Math.abs(Math.sin(T * (3 + boilK * 7))) * (won ? 0 : 1);
      const lk = lost ? rk : -1, wk = won ? rk : -1;
      let ax = 62, ay = 306 - (won ? Math.abs(Math.sin(T * 9)) * 16 : 0);
      abuela(ax, ay, T, won ? 'happy' : lost ? 'sad' : null, grumpK, Math.sin(T * 2) * 2);
      if (!lost || lk < .15) slipper(ax + 36, ay - 2 - foot * 8, -.3 - foot * .25, .8);
      else { const f = clamp((lk - .15) / .9, 0, 1.3); slipper(ax + 36 + f * 520, ay - 20 - Math.sin(Math.min(1, f) * Math.PI) * 170 + f * 70, f * 22, .8 + f * .8); }
      // the pot (right) and the boil thermometer
      const tcount = tiedN; potDraw(T, boilK, tcount, boilK > .78 ? 1 : 0, won, lost, rk);
      thermo(782, 120, won ? 0 : boilK, T);
      // the cooks behind the table
      for (let r = 0; r < n; r++) {
        const x = SX[r], recent = T - act[r] < .5, k = r === me && cur ? sv() : 0, wob = recent || (r === me && cur) ? Math.sin(T * 18) : Math.sin(T * 2) * .15, dance = won ? Math.abs(Math.sin(T * 9 + r)) * 16 : 0;
        X.fillStyle = 'rgba(20,16,28,.22)'; el(x, 262, 34, 8); X.fill();
        const by = 258 - dance;
        // blocky arms
        const u = 4.2, up = won ? -2.6 : -.5 + wob * .55;
        for (const sx of [-1, 1]) { X.save(); X.translate(x + sx * 6.6 * u, by - 5.2 * u); X.rotate(sx * (won ? 2.6 : .5 + (recent ? 1.1 : 0) * Math.abs(wob)) + (lost ? sx * -.5 : 0)); X.fillStyle = INK; X.fillRect(-5.5, -u * 3.6 - 3, 11, u * 3.6 + 6); X.fillStyle = colOf(r); X.fillRect(-3.5, -u * 3.6, 7, u * 3.6); X.restore(); }
        caos(x, by, u, { col: colOf(r), mood: won ? 'happy' : lost ? 'sad' : null });
        // chef hat for the judge
        if (r === n - 1) { rr(x - 12, by - 12.6 * u - 16, 24, 18, 6); ink('#fff', 3); }
        pill(x, 160, r === me ? 'YOU' : nameOf(r), colOf(r));
        const lab = kinds[r];
        txt({ masa: 'DOUGH', guiso: 'STEW', tapar: 'FOLD', atar: 'TIE' }[lab], x, 140, 14, '#fff', 'center', 90);
        void k; void up;
      }
      X.drawImage(FGB, 0, 0);
      // loop-back rail: chevrons running left on the table front
      X.save(); X.beginPath(); X.rect(130, 304, 540, 28); X.clip(); X.fillStyle = 'rgba(255,230,160,.8)'; for (let x = -40 + (T * 40) % 40; x < 560; x += 40) { X.beginPath(); X.moveTo(130 + x + 14, 312); X.lineTo(130 + x, 318); X.lineTo(130 + x + 14, 324); X.lineTo(130 + x + 20, 324); X.lineTo(130 + x + 6, 318); X.lineTo(130 + x + 20, 312); X.closePath(); X.fill(); } X.restore();
      // the hallacas on the leaf
      const stack = {};
      for (const m of it) {
        if (!m) continue;
        if (m.c >= n) { const fk = (T - m.flyAt) / .6; if (fk < 0 || fk >= 1) continue; const sx0 = SX[n - 1], px = lerp(sx0, POT[0], ease(fk)), py = lerp(ST_Y, POT[1] - 20, ease(fk)) - Math.sin(fk * Math.PI) * 90; packet(px, py, .5, { fold: 1, tie: 1 }); continue; }
        const idx = stack[m.c] = (stack[m.c] || 0) + 1, tx = SX[m.c] - (idx - 1) * 20, ty = ST_Y - (idx - 1) * 3;
        const dx = tx - m.x; m.x += dx * Math.min(1, .16); const ret = m.rej && m.c === 0 && Math.abs(dx) > 8, hop = ret ? Math.abs(Math.sin(T * 12)) * 10 : 0;
        const working = m.c === me && cur && cur.i === m.i, pr = working ? sv() : m.prog;
        const o = itemLook(m, pr, working);
        packet(m.x, ty - hop, .56, o);
        if (ret) { txt('↶', m.x, ty - 28 - hop, 20, '#ff4d5e'); }
      }
      // queue badge for the local seat
      if (me > 0 && queue.length > 0 && !g.result) { badge('×' + queue.length, SX[me] + 34, 236, 16, '#ff8a3d', '#fff', 1); }
      // progress string: five hallacas to tie
      X.beginPath(); for (let i = 0; i <= 20; i++) { const x = 330 + i * 18, y = 66 + Math.sin(i / 20 * Math.PI) * 10; i ? X.lineTo(x, y) : X.moveTo(x, y); } X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.5; X.strokeStyle = '#e6c58c'; X.stroke();
      for (let k = 0; k < NEED; k++) {
        const x = 354 + k * 78, y = 100 + Math.sin((x - 330) / 360 * Math.PI) * 6;
        const filled = k < tiedN, pk = filled ? outBack((T - (tieAt[k] || 0)) / .3) : 0;
        line([[x, y - 24], [x, y - 8]], 3, '#e6c58c');
        if (filled) packet(x, y + 8, .44 * Math.max(.2, pk), { fold: 1, tie: 1 }); else { X.setLineDash([5, 5]); rr(x - 24, y - 8, 48, 32, 10); X.lineWidth = 3; X.strokeStyle = 'rgba(20,16,28,.5)'; X.stroke(); X.setLineDash([]); }
      }
      g.work(T, won, lost);
      // abuela's line
      let line1 = null;
      if (won && rk > .35) line1 = 'AT LAST...'; else if (lost && rk > .5) line1 = 'NOT LIKE THAT!'; else if (T - sayAt < 1.6 && sayS) line1 = sayS; else if (!g.result && boilK > .62) line1 = 'HURRY UP, MY LOVE!';
      if (line1) speech(line1, 156, 236, 220);
      // result payoffs
      if (won && rk > .1) {
        for (let k = 0; k < NEED; k++) { const a = TAU * k / NEED + rk * 1.4, rise = ease(clamp((rk - .1 - k * .06) / .5, 0, 1)); packet(POT[0] + Math.cos(a) * 46, POT[1] - 40 - rise * 54 + Math.sin(a) * 12, .42, { fold: 1, tie: 1 }); }
        star5(POT[0], POT[1] - 100 - Math.sin(rk * 6) * 3, 16, 7, rk * 3, '#ffe14d', 3);
        for (let i = 0; i < 14; i++) { const d = rk - hash(i) * .6; if (d < 0) continue; const fx = 40 + hash(i + 7) * 720, fy = -10 + d * (200 + hash(i + 3) * 120); if (fy < 560) { X.fillStyle = ['#ff4d5e', '#ffe14d', '#5CFF7A', '#4DB8FF'][i & 3]; X.save(); X.translate(fx, fy); X.rotate(d * 6 + i); X.fillRect(-5, -3, 10, 6); X.restore(); } }
      }
      if (lost && rk > .1) {
        const f = clamp((rk - .1) / .5, 0, 1.2);
        packet(POT[0] - 6 + f * 30, POT[1] - 30 - Math.sin(Math.min(1, f) * Math.PI) * 140, .5, { masa: 1.4, guiso: 1, tie: .5 }); // a hallaca bursts out of the pot
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, d = f * 60; X.fillStyle = i & 1 ? LEAF : STEW; X.beginPath(); X.arc(POT[0] + Math.cos(a) * d, POT[1] - 30 + Math.sin(a) * d * .8 + f * 20, 5, 0, TAU); X.fill(); }
      }
      if (won && rk > .15) badge('HALLACAS!', 400, 170, 32, '#22a447', '#fff', outBack((rk - .15) / .25), -.04);
      if (lost && rk > .4) badge('BOILED OVER!', 400, 170, 30, '#e8343d', '#fff', outBack((rk - .4) / .25), .04);
      for (const b of bits) { X.globalAlpha = Math.max(0, 1 - (T - b.t0) / b.life); X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2); X.globalAlpha = 1; }
      for (const q of pops) { const aa = T - q.t0; X.globalAlpha = clamp(1 - (aa - .7) / .3, 0, 1); badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1, .05); X.globalAlpha = 1; }
      vignette(.14);
    },
    /* the big workspace of the local seat */
    work(T, won, lost) {
      const [cx, cy] = WC, done = !!g.result, m = cur ? it[cur.i] : null;
      if (kind === 'masa') {
        const th = cur ? w.th : 0, phase = (S % BP) / BP;
        packet(cx, cy - 6, 2.3, { masa: cur ? clamp(th / 3, 0, 1.5) : 0, hole: 0 });
        // the beat target (a wooden spoon) with the ring that shrinks onto it
        const tx = 150, ty = 430, rad = 30 + 64 * (1 - phase) * (cur && !done ? 1 : 0);
        X.beginPath(); X.arc(tx, ty, 30, 0, TAU); ink('rgba(255,255,255,.55)', 3);
        if (!done) { X.beginPath(); X.arc(tx, ty, rad, 0, TAU); X.lineWidth = 6; X.strokeStyle = rad < 44 ? '#5CFF7A' : '#fff'; X.stroke(); }
        line([[tx - 14, ty + 18], [tx + 10, ty - 14]], 7, '#c98443'); el(tx + 14, ty - 20, 11, 8, -.6); ink('#c98443', 3);
        // thickness gauge
        const gx = 690, gy = 372, gh = 150; rr(gx - 14, gy, 28, gh, 12); ink('#fffaf0', 4);
        X.save(); rr(gx - 14, gy, 28, gh, 12); X.clip(); const zy = v => gy + gh * (1 - v / 4.6);
        X.fillStyle = '#5CFF7A'; X.fillRect(gx - 16, zy(4), 32, zy(3) - zy(4)); X.fillStyle = '#ff4d5e'; X.fillRect(gx - 16, gy, 32, zy(4) - gy);
        X.fillStyle = MASA; X.fillRect(gx - 16, zy(clamp(th, 0, 4.6)), 32, gh); X.restore();
        rr(gx - 14, gy, 28, gh, 12); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
        const dn = T - tapAt < .12;
        plate(250, 482, 300, 56, '#ffd23f', '#c99512', dn);
        txt(done ? (won ? 'YUM!' : 'OOF...') : 'TAP!', 400 - (TOUCH ? 0 : 34), 510 - (dn ? 6 : 0), 30, '#fff');
        if (!TOUCH && !done) keycap(480, 512 - (dn ? 6 : 0), 'SPACE', dn);
      } else if (kind === 'guiso' || kind === 'atar') {
        const p = pathOf(), ghost = kind === 'guiso';
        if (ghost) {
          // the stew pot (left), the garnish bowl (right), the leaf in the middle gets both scoops
          cel(() => rr(78, 404, 76, 66, 20), '#cfd8e6', '#8f9cb3', 4, 5, 4.5); el(116, 406, 32, 8); ink(STEW, 3); steam(116, 400, T, .5, 3);
          cel(() => { X.beginPath(); X.moveTo(620, 412); X.lineTo(752, 412); X.quadraticCurveTo(742, 478, 686, 478); X.quadraticCurveTo(630, 478, 620, 412); X.closePath(); }, '#f4ead6', '#d9ccae', 4, 5, 4);
          for (const [dx, dy, c] of [[-24, 4, '#6b8a2c'], [-4, 0, '#4a2a55'], [16, 5, '#f5e7c2'], [-12, 14, '#4a2a55'], [8, 15, '#6b8a2c'], [28, 12, '#4a2a55']]) { X.beginPath(); X.arc(686 + dx, 420 + dy, 8, 0, TAU); ink(c, 2); }
          packet(400, 440, 1.55, { masa: 1, guiso: clamp((w.pass + (cur ? w.prog : 0)) / 2, 0, 1), hole: m ? m.hole : 0 });
          for (let j = 0; j < 2; j++) {
            const sp2 = SNAKES[j], live = j === (w.pass & 1) && cur;
            X.setLineDash([2, 12]); X.beginPath(); sp2.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineWidth = 8; X.lineCap = 'round'; X.strokeStyle = live ? 'rgba(138,51,34,.7)' : 'rgba(138,51,34,.25)'; X.stroke(); X.setLineDash([]);
          }
          if (cur) { const N = p.length - 1, k = Math.floor(w.prog * N); if (k > 0) { X.beginPath(); for (let i = 0; i <= k; i++) i ? X.lineTo(p[i][0], p[i][1]) : X.moveTo(p[i][0], p[i][1]); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = w.pass ? '#6b8a2c' : STEW; X.stroke(); } }
        } else {
          packet(cx, cy, 1.7, { fold: 1, tie: 0 });
          for (let s = 0; s < 4; s++) {
            const pp = CROSS[s & 1], N = pp.length - 1, dn = s < w.stroke || (s === w.stroke && false);
            if (s === w.stroke && cur) { X.setLineDash([2, 10]); X.beginPath(); pp.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineWidth = 7; X.lineCap = 'round'; X.strokeStyle = 'rgba(255,255,255,.75)'; X.stroke(); X.setLineDash([]); const k = Math.floor(w.prog * N); if (k > 0) line(pp.slice(0, k + 1), 6, '#f4e5b8'); }
            else if (dn) { const o = (s >> 1) * 8 - 4; line(pp.map(([a, b]) => s & 1 ? [a, b + o] : [a + o, b]), 6, '#f4e5b8'); }
          }
          if (cur && w.insp > 0) { const f = 1 - w.insp / .35; X.save(); X.translate(cx + 90 - f * 40, cy - 70); X.beginPath(); X.arc(0, 0, 26, 0, TAU); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#9fd8ff'; X.stroke(); line([[18, 18], [40, 40]], 8, '#8a5a3c'); X.restore(); }
        }
        // the start marker pulses where you should press
        if (cur && !done && w.prog === 0 && w.insp <= 0) { const s0 = p[0], pu = 1 + Math.sin(T * 8) * .15; X.beginPath(); X.arc(s0[0], s0[1], 16 * pu, 0, TAU); X.lineWidth = 4; X.strokeStyle = '#ffe14d'; X.stroke(); }
        // the spoon / the pabilo end follows the pointer
        const q = ptr || p[0];
        if (ghost) { X.save(); X.translate(q[0], q[1]); X.rotate(-.5); line([[0, 0], [34, 26]], 7, '#c98443'); el(0, 0, 15, 11, .3); ink('#e9a866', 3); if (w.prog > 0) { el(0, -2, 10, 6, .3); X.fillStyle = STEW; X.fill(); } X.restore(); }
        else { X.beginPath(); X.arc(q[0], q[1], 11, 0, TAU); ink('#f4e5b8', 3.5); }
        if (!TOUCH && !done && !ptrDown && !keyUsed) txt('↑ ↓ ◄ ►', 400, 534, 16, 'rgba(255,255,255,.9)');
        // the spill meter
        if (cur) { const k = clamp(w.offT / SPILL, 0, 1); rr(300, 354, 200, 12, 6); ink('#fffaf0', 2.5); if (k > 0) { X.save(); rr(300, 354, 200, 12, 6); X.clip(); X.fillStyle = k > .6 ? '#ff4d5e' : '#ffd23f'; X.fillRect(300, 354, 200 * k, 12); X.restore(); } }
      } else if (kind === 'tapar') {
        const fk = clamp(w.fold / 4, 0, 1), dir = foldDir();
        packet(cx, cy, 2.3, { masa: 1, guiso: 1, fold: fk });
        for (const sx of [-1, 1]) {
          const hot = dir === sx, pu = hot ? 1 + Math.sin(T * 10) * .08 : 1, bx = cx + sx * 270;
          X.save(); X.translate(bx, cy); X.scale(pu, pu);
          rr(-40, -40, 80, 80, 20); ink(hot ? '#ffe14d' : '#e3d7bc', 4);
          tri(sx * 18, 0, -sx * 12, -22, -sx * 12, 22, hot ? INK : '#8f88a6', 0); X.fillStyle = hot ? INK : '#8f88a6'; X.fill();
          X.restore();
          if (hot && !TOUCH) keycap(bx, cy + 58, sx < 0 ? '◄' : '►', false);
        }
        for (let k = 0; k < 4; k++) { X.beginPath(); X.arc(cx - 45 + k * 30, 520, 10, 0, TAU); ink(k < w.fold ? '#5CFF7A' : '#fffaf0', 3); }
      }
      if (!cur && !done && kind !== 'masa') {
        const wait = 1 + Math.sin(T * 5) * .05; X.save(); X.translate(cx, cy); X.scale(wait, wait); txt('…', 0, 0, 56, 'rgba(255,255,255,.85)'); X.restore();
      }
    },
  };
  function itemLook(m, pr, working) {
    const c = m.c, o = { masa: 0, guiso: 0, fold: 0, tie: 0, hole: m.hole };
    const foldAt = n === 4 ? 3 : 2;
    if (c >= 1) o.masa = 1; else o.masa = clamp(pr, 0, 1.5);
    if (c >= 2) o.guiso = 1; else if (c === 1) o.guiso = clamp(pr, 0, 1);
    if (n === 4) { if (c >= 3) o.fold = 1; else if (c === 2) o.fold = clamp(pr, 0, 1); }
    else if (c >= foldAt) o.fold = 1;
    if (c >= n - 1 && (c === n - 1)) o.tie = clamp(pr, 0, 1);
    if (c >= n) o.tie = 1;
    if (c === 0) { o.guiso = 0; o.fold = 0; o.tie = 0; }
    if (c > 0 && c < n - 1 + (n === 4 ? 0 : 0)) { /* stage dressing set above */ }
    if (n === 3 && c === 1) { o.guiso = clamp(pr, 0, 1); }
    void working;
    return o;
  }
  g.dbg = {
    kind, me, n, TS, bp: BP, SNAKES, CROSS,
    S: () => S, ready: () => !!cur && w.lock <= 0 && w.insp <= 0 && !g.result,
    beatIn: () => BP - (S % BP), beatK: () => Math.floor((S + BP - (S % BP)) / BP + 1e-6),
    prog: () => w.prog, pts: () => (cur && w.lock <= 0 && w.insp <= 0 ? pathOf() : null), fold: () => foldDir(),
    view: () => ({ tied: tiedN, cur: cur && cur.i, queue: queue.length, retries: retries.length, S, th: w.th, workMood: workMood() }),
  };
  wire(g, D, judge, sp, 'sq_hallaca');
  return g;
}

/* ───────────── intro card (520×240 frame), 4 s loop per role ───────────── */
function dBg(T) {
  X = ctx;
  X.fillStyle = '#ffe3a8'; X.fillRect(0, 0, 520, 240);
  for (let c = 0; c < 26; c++) { X.fillStyle = c & 1 ? '#e9f4ff' : '#58a8ea'; X.fillRect(c * 20, 78, 20, 20); }
  X.fillStyle = INK; X.fillRect(0, 76, 520, 4);
  for (let i = 0; i < 9; i++) { const on = Math.sin(T * 5 + i * 1.3) > -.2; X.beginPath(); X.arc(20 + i * 60, 12, 5, 0, TAU); ink(on ? ['#ff4d5e', '#ffe14d', '#5CFF7A', '#4DB8FF'][i % 4] : '#6a6585', 2); }
  rr(10, 120, 500, 130, 18); ink('#e3a868', 5);
}
function dCook(x, T, col, happy) { X.fillStyle = 'rgba(20,16,28,.22)'; el(x, 126, 26, 6); X.fill(); caos(x, 124, 3.2, { col, mood: happy ? 'happy' : null }); }
function dMasa(T) {
  dBg(T); const u = T % 3.2, ph = (u % .52) / .52, taps = Math.min(3, Math.floor(u / .52));
  dCook(66, T, '#FFC93C', taps >= 3);
  packet(300, 170, 1.7, { masa: taps / 3 });
  const rad = 22 + 40 * (1 - ph); X.beginPath(); X.arc(100, 190, 22, 0, TAU); ink('rgba(255,255,255,.5)', 3); X.beginPath(); X.arc(100, 190, rad, 0, TAU); X.lineWidth = 5; X.strokeStyle = rad < 34 ? '#5CFF7A' : '#fff'; X.stroke();
  demoFinger(430, 190, ph < .25 && taps < 3, ph * 4);
  if (taps >= 3) badge('GOOD!', 400, 40, 20, '#22a447', '#fff', 1, -.05);
}
function dGuiso(T) {
  dBg(T); const u = T % 4, pass = u < 1.9 ? 0 : 1, k = clamp((u - pass * 1.9) / 1.4, 0, 1), sn = SNAKES.map(P => P.map(([a, b]) => [260 + (a - 400) * .9, 190 + (b - 440) * .7]));
  dCook(40, T, '#6EA8FE', u > 3.5);
  const cur = sn[pass], N = cur.length - 1, q = cur[Math.round(k * N)];
  for (const P of sn) { X.setLineDash([2, 10]); X.beginPath(); P.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineWidth = 7; X.lineCap = 'round'; X.strokeStyle = 'rgba(138,51,34,.5)'; X.stroke(); X.setLineDash([]); }
  const kk = Math.floor(k * N); if (kk > 0) { X.beginPath(); for (let i = 0; i <= kk; i++) i ? X.lineTo(cur[i][0], cur[i][1]) : X.moveTo(cur[i][0], cur[i][1]); X.lineWidth = 10; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = pass ? '#6b8a2c' : STEW; X.stroke(); }
  cel(() => rr(120, 168, 50, 44, 14), '#cfd8e6', '#8f9cb3', 3, 4, 3.5); el(145, 170, 21, 6); ink(STEW, 2.5);
  cel(() => rr(380, 170, 60, 38, 12), '#f4ead6', '#d9ccae', 3, 4, 3.5);
  packet(260, 190, 1.0, { masa: 1, guiso: clamp((pass + k) / 2, 0, 1) });
  X.save(); X.translate(q[0], q[1]); X.rotate(-.5); line([[0, 0], [26, 20]], 6, '#c98443'); el(0, 0, 12, 9, .3); ink('#e9a866', 3); X.restore();
  demoFinger(q[0] + 6, q[1] + 26, true, 0);
}
function dTapar(T) {
  dBg(T); const u = T % 4, f = Math.min(4, Math.floor(u / .8)), dir = f & 1 ? 1 : -1, ph = (u % .8) / .8;
  dCook(66, T, '#FF8FB1', f >= 4);
  packet(290, 180, 1.8, { masa: 1, guiso: 1, fold: Math.min(1, (f + (f < 4 ? ease(ph) : 0)) / 4) });
  for (const sx of [-1, 1]) { const hot = f < 4 && dir === sx; rr(sx * 140 + 290 - 28, 150, 56, 56, 14); ink(hot ? '#ffe14d' : '#e3d7bc', 4); X.fillStyle = hot ? INK : '#8f88a6'; tri(sx * 12 + sx * 140 + 290, 178, -sx * 8 + sx * 140 + 290, 164, -sx * 8 + sx * 140 + 290, 192, hot ? INK : '#8f88a6', 0); X.fillStyle = hot ? INK : '#8f88a6'; X.fill(); }
  if (f < 4) demoFinger(290 + dir * (-70 + ph * 140) * -1, 120, true, 0);
}
function dAtar(T) {
  dBg(T); const u = T % 4, st = Math.min(4, Math.floor(u / .8)), ph = (u % .8) / .8;
  dCook(66, T, '#7CE08A', st >= 4);
  packet(290, 180, 1.8, { fold: 1, tie: 0 });
  const V = LINE([290, 140], [290, 222], 8), H = LINE([240, 180], [340, 180], 8);
  for (let s = 0; s < 4; s++) {
    const pp = s & 1 ? H : V, o = (s >> 1) * 7 - 3.5, pa = pp.map(([a, b]) => s & 1 ? [a, b + o] : [a + o, b]);
    if (s < st) line(pa, 5, '#f4e5b8'); else if (s === st) { const k = Math.round(ease(ph) * 8); if (k > 0) line(pa.slice(0, k + 1), 5, '#f4e5b8'); const q = pa[k]; demoFinger(q[0] + 4, q[1] + 18, true, 0); }
  }
  if (st >= 4) badge('TIED!', 420, 60, 20, '#22a447', '#fff', 1, -.05);
}
reg('sq_hallaca', sqHallaca, 'HALLACAS EN FILA'); REGMAP.sq_hallaca.duo = true; REGMAP.sq_hallaca.squad = true;
DUO.INFO.sq_hallaca = n => n === 4
  ? [['DOUGH', 'TAP ON THE BEAT: SPREAD THE MASA', 'TAP / CLICK / SPACE'], ['STEW', 'TRACE THE SNAKE: 2 SCOOPS', 'DRAG / ARROWS'], ['FOLD', 'SWIPE LEFT, RIGHT, LEFT, RIGHT', 'SWIPE / ◄ ►'], ['TIE', 'TRACE THE CROSS TWICE', 'DRAG / ARROWS']]
  : [['DOUGH', 'TAP ON THE BEAT: SPREAD THE MASA', 'TAP / CLICK / SPACE'], ['STEW', 'TRACE THE SNAKE: 2 SCOOPS', 'DRAG / ARROWS'], ['TIE', 'TRACE THE CROSS TWICE', 'DRAG / ARROWS']];
DUO.DEMOS.sq_hallaca = n => n === 4 ? [dMasa, dGuiso, dTapar, dAtar] : [dMasa, dGuiso, dAtar];

})();
