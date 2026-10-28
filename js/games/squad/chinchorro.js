'use strict';
/* ═════════ SQUAD · CHINCHORRO (sq_chinchorro), 3-4 players, one role each ═════════
   Beach patio, two palm trees (matas) and a striped chinchorro (hammock) between them. Somebody is about to lie down with a coco in his hand.
   The hammock only stays flat if BOTH ropes have the same tension and are neither too slack (the butt scrapes the sand) nor too tight.
   n = 4:  EN EL CHINCHORRO (0, JUDGE)  sees the real hammock: how much it tilts and how it sags. He is the only one who knows what to fix, so he SHOUTS
                              with four plates (hold): LEFT TIGHTER / LEFT LOOSER / RIGHT TIGHTER / RIGHT LOOSER (keys Q A E D). Calls g.finish.
           AMARRE IZQUIERDO (1), AMARRE DERECHO (2)  each see ONLY their own rope tension meter (a knot sliding on a post, no target marked) and the
                              judge's shout over it (arrow up = tighten, down = loosen). Drag the knot up / down (keys W S / arrows). The wind and the
                              people walking by change both tensions by themselves all the time (deterministic from the seed), so it never stays put.
           ZANCUDOS (3)      sees mosquitoes buzzing around the hammock and taps (swats) them. Each one that is not swatted within 2 s bites the guy: the
                              hammock gets a kick (an instant tilt that breaks the steadiness).
   n = 3:  the same without the mosquito swatter (no mosquitoes).
   Rules. tilt = tR - tL (positive = left side slack = leans left), mean = (tL + tR) / 2. STEADY = |tilt| <= .2 and .28 <= mean <= .78.
   WIN: 6 s IN A ROW of steady (the streak resets to 0 the moment it is not steady; accumulated time does not count). LOSE: |tilt| > .6 or mean < .08
   (the guy falls on the sand), or the clock. Every wind segment pushes the two ropes apart and together, and the first one starts at t = 0, so a
   hammock that nobody tends to falls in ~2 s: both ropers AND the judge are needed, and the swatter too with 4 (a bite every ~1.1 s keeps it unsteady).
   Netcode (absolute values, re-sent every .5 s): ROPE 'tn' [tension*1000]; JUDGE 'cue' [left, right] in -1/0/1, 'tl' [tilt*1000, mean*1000, streak*100] (cosmetic
   for the other screens), 'why'; SWATTER 'kl' [bitmask of swatted mosquitoes]. The judge adds the bites itself (mosquito k not in the mask at its deadline). */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const NSEG = 8, T0 = .52, RATE = .27, TOL = .3, MLO = .22, MHI = .82, FALL = .75, FLOOR = .06, NEED = 6;   // wind segments, start tension, rope speed, steady band, win streak (s)
const NM = 14, MLIFE = 2.0, KICK = .5;                                                              // mosquitoes, seconds before one bites, tilt of a bite
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const NAMES = ['IN THE HAMMOCK', 'LEFT KNOT', 'RIGHT KNOT', 'MOSQUITOES'];
const AX = [128, 672], TR = [[110, 470, 125, 215], [690, 470, 675, 215]], GROUND = 478;       // anchor x on each trunk, trunk base and top
const PLATES = [{ x: 20, l: 'LEFT TIGHTER', side: 0, dir: 1, cap: 'Q', c: '#4fd06a', d: '#24803a' }, { x: 205, l: 'LEFT LOOSER', side: 0, dir: -1, cap: 'A', c: '#ffd23f', d: '#c99512' },
  { x: 420, l: 'RIGHT TIGHTER', side: 1, dir: 1, cap: 'E', c: '#4fd06a', d: '#24803a' }, { x: 605, l: 'RIGHT LOOSER', side: 1, dir: -1, cap: 'D', c: '#ffd23f', d: '#c99512' }];

/* ───────────── tiny drawing kit (X is ctx, or an offscreen context while the background is baked) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(330, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 330);
  X.restore();
}
function plate(x, y, w, h, col, dk, down, label, cap, dim) {   // chunky control slab with depth and a key cap
  const d = down ? 3 : 9;
  rr(x, y + 9, w, h, 18); ink(dim ? '#8f88a6' : dk, 4);
  rr(x, y + 9 - d, w, h, 18); ink(dim ? '#d3cfe0' : col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 9, 4); X.fill();
  rr(x, y + 9 - d, w, h, 18); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  const kc = cap && !TOUCH;
  txt(label, x + w / 2 - (kc ? 18 : 0), y + 9 - d + h / 2, 19, '#fff', 'center', w - (kc ? 70 : 24));
  if (kc) { X.font = '700 14px Fredoka, Arial, sans-serif'; const cw = Math.max(24, X.measureText(t(cap)).width + 12); rr(x + w - cw - 8, y + 9 - d + h / 2 - 10, cw, 20, 6); ink('#fff', 2.5); txt(cap, x + w - cw / 2 - 8, y + 9 - d + h / 2 + 1, 13, INK, 'center', cw - 4); }
}
function heart(x, y, s, full) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink(full ? '#ff5c8a' : '#bdb6cf', 3); if (full) { X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); }
  X.restore();
}
function cloud(x, y, sc) {
  X.save(); X.translate(x, y); X.scale(sc, sc); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
}

/* ───────────── the baked beach patio ───────────── */
let BG = null;
function trunk(i) {                                                    // a curved palm trunk with ring marks, cel shaded
  const [bx, by, tx, ty] = TR[i], s = i ? -1 : 1;
  X.beginPath(); X.moveTo(bx - 17, by); X.quadraticCurveTo(bx + s * 30, (by + ty) / 2, tx - 10, ty); X.lineTo(tx + 10, ty); X.quadraticCurveTo(bx + s * 30 + 18, (by + ty) / 2, bx + 17, by); X.closePath(); ink('#a8703a', 4);
  X.save(); X.clip(); X.fillStyle = '#8a5a34'; X.fillRect(bx + (i ? -30 : 4), ty - 10, 40, by - ty + 20); X.restore();
  X.beginPath(); X.moveTo(bx - 17, by); X.quadraticCurveTo(bx + s * 30, (by + ty) / 2, tx - 10, ty); X.lineTo(tx + 10, ty); X.quadraticCurveTo(bx + s * 30 + 18, (by + ty) / 2, bx + 17, by); X.closePath(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  for (let q = 1; q < 8; q++) { const k = q / 8, y = by + (ty - by) * k, x = lerp(bx, tx, k) + s * 24 * Math.sin(k * Math.PI) * .9; line([[x - 11, y], [x + 11, y + 3]], 2, '#6e4120'); }
}
function bake() {
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; const old = X; X = cv.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, 400); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.55, '#86d8fb'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, 800, 400);
  X.fillStyle = '#ffe14d'; X.beginPath(); X.arc(620, 110, 32, 0, TAU); X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#fff3a0'; X.beginPath(); X.arc(610, 100, 12, 0, TAU); X.fill();
  X.beginPath(); X.moveTo(0, 330); X.quadraticCurveTo(160, 300, 330, 332); X.lineTo(330, 345); X.lineTo(0, 345); X.closePath(); X.fillStyle = '#a9dfc6'; X.fill();      // far headland, no ink
  gr = X.createLinearGradient(0, 335, 0, 405); gr.addColorStop(0, '#62d3f0'); gr.addColorStop(1, '#2a8fcb'); X.fillStyle = gr; X.fillRect(0, 340, 800, 66);
  X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 3; for (let k = 0; k < 9; k++) { const x = hash(k) * 760 + 10, y = 352 + hash(k + 5) * 44; X.beginPath(); X.moveTo(x, y); X.quadraticCurveTo(x + 16, y - 5, x + 34, y); X.stroke(); }
  X.beginPath(); X.moveTo(0, 405); for (let x = 0; x <= 800; x += 20) X.lineTo(x, 405 + 5 * Math.sin(x * .05)); X.lineTo(800, 420); X.lineTo(0, 420); X.closePath(); X.fillStyle = '#ffffff'; X.fill();   // foam
  X.fillStyle = INK; X.fillRect(0, 404, 800, 4);
  gr = X.createLinearGradient(0, 408, 0, 600); gr.addColorStop(0, '#f6dc9b'); gr.addColorStop(1, '#e2b968'); X.fillStyle = gr; X.fillRect(0, 408, 800, 192);
  X.fillStyle = 'rgba(255,255,255,.14)'; for (let k = 0; k < 6; k++) { X.beginPath(); X.moveTo(k * 150 - 40, 600); X.lineTo(k * 150 + 20, 600); X.lineTo(k * 150 + 150, 408); X.lineTo(k * 150 + 90, 408); X.fill(); }
  X.fillStyle = '#c99e55'; for (let k = 0; k < 20; k++) { X.beginPath(); X.arc(hash(k * 3) * 800, 430 + hash(k * 3 + 1) * 160, 2 + hash(k) * 2, 0, TAU); X.fill(); }
  el(400, 497, 330, 20); X.fillStyle = 'rgba(20,16,28,.14)'; X.fill();                                  // the shade under the hammock
  trunk(0); trunk(1);
  rr(300, 520, 200, 40, 10); ink('#d9944f', 4); line([[316, 536], [484, 536]], 2, '#b06d33'); line([[316, 548], [484, 548]], 2, '#b06d33');   // a bench with a bucket: the patio
  X = old; return cv;
}
function palmTop(i, T) {                                              // swaying fronds on top of the trunk
  const [, , tx, ty] = TR[i]; X.save(); X.translate(tx, ty);
  for (let q = 0; q < 7; q++) { const a = q * TAU / 7 + .3 + Math.sin(T * 1.4 + i * 2 + q) * .06; X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(Math.cos(a) * 40, Math.sin(a) * 14 - 36, Math.cos(a) * 82, Math.sin(a) * 40); X.quadraticCurveTo(Math.cos(a) * 40, Math.sin(a) * 14 - 8, 0, 0); ink(q % 2 ? '#3fb260' : '#2f9a55', 2.5); }
  el(-8, 8, 8, 8); ink('#8a5a34', 3); el(9, 10, 8, 8); ink('#8a5a34', 3);
  X.restore();
}
function macaw(x, y, T) {                                              // a red guacamaya on the right palm that cocks its head
  X.save(); X.translate(x, y); X.rotate(Math.sin(T * 1.3) * .08);
  el(0, 0, 12, 18, .15); ink('#e8343d', 3); el(2, 4, 7, 11, .15); ink('#ffd23f', 2); el(-3, -19 + Math.sin(T * 2.4) * 1.5, 10, 9); ink('#e8343d', 3);
  X.beginPath(); X.moveTo(-10, -19); X.quadraticCurveTo(-20, -16, -14, -9); X.lineTo(-8, -14); X.closePath(); ink('#f4f1e8', 2.5);
  X.beginPath(); X.arc(-5, -21, 3.4, 0, TAU); ink('#fff', 2); X.fillStyle = INK; X.beginPath(); X.arc(-6, -21, 1.5, 0, TAU); X.fill();
  line([[2, 14], [10, 38]], 5, '#2b9ee6'); X.restore();
}
function crab(T) { const x = 120 + ((T * 18) % 560), y = 560 + Math.sin(T * 3) * 2;
  el(x, y, 13, 8); ink('#ff6a5c', 3); for (const s of [-1, 1]) { line([[x + s * 12, y - 2], [x + s * 20, y - 12 + Math.sin(T * 6) * 3]], 3, '#ff6a5c'); line([[x + s * 8, y + 5], [x + s * 15, y + 11]], 2, '#ff6a5c'); X.beginPath(); X.arc(x + s * 4, y - 9, 2.4, 0, TAU); ink('#fff', 1.5); } }

/* ───────────── the hammock, the guy, the coco ───────────── */
function hamGeom(tilt, mean) {                                         // anchors, sag and the control point of the quadratic
  const yA = 255 + 110 * tilt, yB = 255 - 110 * tilt, sag = 20 + (1 - clamp(mean, 0, 1)) * 190;
  return { A: [AX[0], yA], B: [AX[1], yB], C: [400, (yA + yB) / 2 + 2 * sag] };
}
function hamAt(h, u) { const a = 1 - u; return { x: a * a * h.A[0] + 2 * a * u * h.C[0] + u * u * h.B[0], y: a * a * h.A[1] + 2 * a * u * h.C[1] + u * u * h.B[1],
  tx: 2 * a * (h.C[0] - h.A[0]) + 2 * u * (h.B[0] - h.C[0]), ty: 2 * a * (h.C[1] - h.A[1]) + 2 * u * (h.B[1] - h.C[1]) }; }
function drawHammock(h) {
  for (const [i, P] of [[0, h.A], [1, h.B]]) { const tx = i ? 690 - 20 : 110 + 20; line([[tx, P[1] - 6], [P[0], P[1]]], 4, '#e6c58c'); }
  X.beginPath(); X.moveTo(h.A[0], h.A[1]); X.quadraticCurveTo(h.C[0], h.C[1], h.B[0], h.B[1]);
  X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 34; X.stroke(); X.strokeStyle = '#ff6a5c'; X.lineWidth = 25; X.stroke();
  X.save(); X.setLineDash([14, 14]); X.strokeStyle = '#ffd23f'; X.lineWidth = 25; X.stroke(); X.setLineDash([]); X.restore();
  X.strokeStyle = 'rgba(255,255,255,.35)'; X.lineWidth = 5; X.save(); X.translate(0, -7); X.beginPath(); X.moveTo(h.A[0] + 14, h.A[1]); X.quadraticCurveTo(h.C[0], h.C[1], h.B[0] - 14, h.B[1]); X.stroke(); X.restore();
  for (const [P, s] of [[h.A, 1], [h.B, -1]]) for (let q = 0; q < 4; q++) line([[P[0] + s * (6 + q * 5), P[1] + 8], [P[0] + s * (6 + q * 5) + s * 3, P[1] + 24 + q % 2 * 5]], 3, '#ffd23f');   // fringe
}
function coco(x, y, sc, rot) {
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc); el(0, 0, 13, 14); ink('#d9c27a', 3); X.save(); el(0, 0, 13, 14); X.clip(); X.fillStyle = '#b9a35a'; X.fillRect(4, -20, 20, 40); X.restore(); el(0, 0, 13, 14); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  glint(-4, -5, 3, 5, -.4, .6); line([[2, -10], [6, -26], [12, -34]], 3, '#ff5c8a'); X.restore();
}
function arepa(x, y, sc, rot) { X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc); el(0, 0, 15, 13); ink('#f3d089', 3); X.save(); el(0, 0, 15, 13); X.clip(); X.fillStyle = '#d9a95a'; X.fillRect(3, -16, 20, 30); X.restore(); el(0, 0, 15, 13); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); glint(-5, -5, 4, 3, -.4, .6); X.restore(); }
/* ═════════ the game ═════════ */
function sqChinchorro(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0, rope = me === 1 || me === 2, swat = me === 3;
  /* the world: identical on every screen (a fixed number of draws whatever n / role) */
  const flip = R() < .5 ? -1 : 1, BIAS = [(R() < .5 ? -1 : 1) * (.12 + R() * .02), (R() < .5 ? -1 : 1) * (.12 + R() * .02)], SEG = []; let tt = 0;
  for (let k = 0; k < NSEG; k++) { const len = 2.4 + R() * 1.2, wm = R(), cs = R(), cm = R(); SEG.push({ t0: tt, t1: tt += len, w: (k % 2 ? 1 : -1) * flip * (.03 + .02 * wm), c: (cs < .5 ? -1 : 1) * (.015 + .015 * cm) }); }
  const MOS = []; for (let i = 0; i < NM; i++) MOS.push({ i, t0: 1 + i * 1.1 + R() * .3, cx: 160 + R() * 480, cy: 130 + R() * 230, ax: 40 + R() * 70, ay: 25 + R() * 50, f1: 1.8 + R() * 1.6, f2: 2.3 + R() * 1.7, p1: R() * TAU, p2: R() * TAU, sg: R() < .5 ? -1 : 1 });
  const wind = S => { const q = SEG.find(s => S < s.t1) || SEG[NSEG - 1]; const f = (S - q.t0) / (q.t1 - q.t0); return { w: q.w * (.75 + .25 * Math.sin(Math.PI * clamp(f, 0, 1))), c: q.c }; };
  const mpos = (m, S) => [m.cx + m.ax * Math.sin(S * m.f1 + m.p1), m.cy + m.ay * Math.sin(S * m.f2 + m.p2)];
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i];
  let S = 0, resAt = -1, endFx = false, why = 0;
  /* rope roles */
  let ten = T0, tnAt = -9, tnSent = -1, upK = false, dnK = false, dragY = null, tugAt = -9;
  /* judge */
  let tnL = T0, tnR = T0, kick = 0, ss = 0, dTilt = 0, dMean = T0, tlAt = -9, kmask = 0, bitten = 0, cueSent = [9, 9], cueAt = -9, ptr = -1, kq = false, ka = false, ke = false, kd = false, lowT = 0;
  /* everyone (cosmetic): what the judge says, and what the other screens know of the hammock */
  let cueL = 0, cueR = 0, cueGot = -9, fTilt = 0, fMean = T0, fSS = 0, swatMask = 0, klAt = -9, bitesShown = 0;
  const marks = [], pops = [];
  function pop(s, x, y, size, bgc) { pops.length = 0; pops.push({ s, x, y, size, bgc, t0: g.c }); }

  const mosAlive = () => swat || judge ? MOS.filter(m => n === 4 && S >= m.t0 && S < m.t0 + MLIFE && !((swat ? swatMask : kmask) >> m.i & 1)) : [];
  function sendTn(force) { const v = Math.round(ten * 1000); if (v !== tnSent || force) { if (force || g.c - tnAt >= .08) { tnAt = g.c; tnSent = v; D.send('tn', [v], true); } } }
  const sendKl = () => { klAt = g.c; D.send('kl', [swatMask], true); };
  const lose = k => { if (g.result) return; why = k; D.send('why', k); sendTl(true); g.finish('lose'); };
  function sendTl(force) { if (force || g.c - tlAt >= .12) { tlAt = g.c; D.send('tl', [Math.round((tnR - tnL + kick) * 1000), Math.round((tnL + tnR) * 500), Math.round(ss * 100)], true); } }
  function setCue() { const l = (kq ? 1 : 0) - (ka ? 1 : 0) + (ptr === 0 ? 1 : 0) - (ptr === 1 ? 1 : 0), r = (ke ? 1 : 0) - (kd ? 1 : 0) + (ptr === 2 ? 1 : 0) - (ptr === 3 ? 1 : 0); cueL = clamp(l, -1, 1); cueR = clamp(r, -1, 1); }
  function sendCue(force) { if (force || cueL !== cueSent[0] || cueR !== cueSent[1] || g.c - cueAt >= .5) { cueSent = [cueL, cueR]; cueAt = g.c; D.send('cue', [cueL, cueR], true); } }
  const plateAt = p => p.y >= 490 ? PLATES.findIndex(q => p.x >= q.x && p.x <= q.x + 175) : -1;
  function bite(m) { kick += m.sg * KICK; bitesShown++; snd(1200, .08, 'sawtooth', .04, 0, 800); shake(3, .12); pop('BITE!', 400, 300, 26, '#e8343d'); }
  function swatAt(px, py) {
    let best = null, bd = 42; for (const m of mosAlive()) { const [mx, my] = mpos(m, S), d = Math.hypot(mx - px, my - py); if (d < bd) { bd = d; best = m; } }
    if (best) { swatMask |= 1 << best.i; sendKl(); const [mx, my] = mpos(best, S); marks.push({ x: mx, y: my, t0: g.c }); burst(mx, my, '#7a1f2e', 8, 160); snd(260, .08, 'square', .06, 0, 120); noise(.08, .06, 900, 2400, 'bandpass'); }
    else { marks.push({ x: px, y: py, t0: g.c, miss: true }); snd(150, .06, 'triangle', .04); }
  }

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['DIRECT!', 'TIE!', 'TIE!', 'SWAT!'][me], roleLabel: NAMES[me],
    hint: judge ? 'HOLD THE PLATES (Q A / E D) TO SHOUT THE ROPES: TIGHTER OR LOOSER - FLAT AND NOT TOO LOW FOR 6 SECONDS' + (n === 4 ? ' - THE MOSQUITOES ARE BITING YOU' : '')
      : rope ? 'DRAG THE KNOT UP / DOWN (W S) AS THE ARROW SAYS - THE WIND KEEPS MOVING YOUR ROPE'
      : 'CLICK THE MOSQUITOES BEFORE THEY BITE THE GUY',
    thint: judge ? 'HOLD THE PLATES TO SHOUT THE ROPES: TIGHTER OR LOOSER - FLAT AND NOT TOO LOW FOR 6 SECONDS' + (n === 4 ? ' - THE MOSQUITOES ARE BITING YOU' : '')
      : rope ? 'DRAG THE KNOT UP / DOWN AS THE ARROW SAYS - THE WIND KEEPS MOVING YOUR ROPE'
      : 'TAP THE MOSQUITOES BEFORE THEY BITE THE GUY',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt; const wd = dt * TS;
      if (g.result && resAt < 0) resAt = g.c;
      const live = !g.result;
      if (live) S += wd;
      if (rope && live) {
        const wnd = wind(S), wr = (me === 1 ? wnd.c - wnd.w / 2 : wnd.c + wnd.w / 2) + BIAS[me - 1], u = (upK ? 1 : 0) - (dnK ? 1 : 0);
        ten = clamp(ten + (wr + RATE * u) * wd, 0, 1); sendTn(g.c - tnAt >= .5);
      }
      if (swat && live && g.c - klAt >= .5) sendKl();
      if (judge && live) {
        if (n === 4) for (const m of MOS) if (!(bitten >> m.i & 1) && S >= m.t0 + MLIFE) { bitten |= 1 << m.i; if (!(kmask >> m.i & 1)) bite(m); }
        kick *= Math.exp(-wd / .45);
        const tilt = tnR - tnL + kick, mean = (tnL + tnR) / 2;
        dTilt += (tilt - dTilt) * Math.min(1, wd * 10); dMean += (mean - dMean) * Math.min(1, wd * 10);
        if (Math.abs(tilt) <= TOL && mean >= MLO && mean <= MHI) ss += wd; else ss = 0;
        sendCue(false); sendTl(false);
        if (Math.abs(tilt) > FALL) lose(1);
        else if (mean < FLOOR) lose(2);
        else if (ss >= NEED) { sendTl(true); g.finish('win'); }
        else if (g.c >= g.limit) lose(3);
      }
      if (!judge && g.c - cueGot > 1.3) { cueL = 0; cueR = 0; }
      if (g.result && !endFx) { endFx = true; if (g.result === 'win') { snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); } else { sfx.miss(); snd(300, .45, 'sawtooth', .06, 0, 90); shake(6, .22); noise(.4, .08, 400, 1400, 'bandpass'); } }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      for (let i = marks.length - 1; i >= 0; i--) if (g.c - marks[i].t0 > .6) marks.splice(i, 1);
    },
    msg(type, d, from) {
      if (type === 'tn' && Array.isArray(d) && judge && !g.result) { const v = clamp((d[0] | 0) / 1000, 0, 1); if (from === 1) tnL = v; else if (from === 2) tnR = v; }
      else if (type === 'cue' && Array.isArray(d) && from === 0) { cueL = clamp(d[0] | 0, -1, 1); cueR = clamp(d[1] | 0, -1, 1); cueGot = g.c; }
      else if (type === 'tl' && Array.isArray(d) && from === 0) { fTilt = d[0] / 1000; fMean = d[1] / 1000; fSS = d[2] / 100; }
      else if (type === 'kl' && Array.isArray(d) && from === 3) { kmask = d[0] | 0; swatMask = Math.max(swatMask, kmask); }
      else if (type === 'why' && from === 0) { why = d | 0; }
    },
    down(p) {
      if (g.result) return;
      if (rope) dragY = p.y;
      else if (swat) swatAt(p.x, p.y);
      else if (judge) { ptr = plateAt(p); setCue(); sendCue(true); }
    },
    move(p) {
      if (g.result) return;
      if (rope && dragY !== null) { ten = clamp(ten + (dragY - p.y) / 230, 0, 1); dragY = p.y; tugAt = g.c; sendTn(false); }
      else if (judge && ptr >= 0) { const q = plateAt(p); if (q !== ptr) { ptr = q; setCue(); sendCue(true); } }
    },
    up() { dragY = null; if (judge && ptr >= 0) { ptr = -1; setCue(); sendCue(true); } },
    key(e) {
      if (g.result) return; const c = e.code;
      if (rope) { if (c === 'ArrowUp' || c === 'KeyW') upK = true; else if (c === 'ArrowDown' || c === 'KeyS') dnK = true; }
      else if (judge) { if (c === 'KeyQ') kq = true; else if (c === 'KeyA') ka = true; else if (c === 'KeyE') ke = true; else if (c === 'KeyD') kd = true; else return; setCue(); sendCue(true); }
    },
    keyup(e) {
      const c = e.code;
      if (rope) { if (c === 'ArrowUp' || c === 'KeyW') upK = false; else if (c === 'ArrowDown' || c === 'KeyS') dnK = false; }
      else if (judge) { if (c === 'KeyQ') kq = false; else if (c === 'KeyA') ka = false; else if (c === 'KeyE') ke = false; else if (c === 'KeyD') kd = false; else return; setCue(); sendCue(true); }
    },
  };

  /* ───────────── drawing ───────────── */
  function mosquito(x, y, T, sc) {
    const fl = Math.sin(T * 60) * .5 + .5;
    X.save(); X.translate(x, y); X.scale(sc, sc);
    for (const s of [-1, 1]) { el(s * 8, -7, 9, 4 + fl * 3, s * -.5); X.fillStyle = 'rgba(255,255,255,.8)'; X.fill(); X.lineWidth = 2; X.strokeStyle = INK; X.stroke(); }
    for (const s of [-1, 1]) for (let q = 0; q < 3; q++) line([[s * 3, 4 + q * 3], [s * 14, 12 + q * 4 + Math.sin(T * 20 + q) * 2]], 1.5, INK);
    el(0, 0, 8, 11); ink('#5a4a64', 3); el(0, -12, 6, 6); ink('#7a6886', 3); line([[0, -16], [0, -28]], 2.5, INK);
    X.fillStyle = '#e8343d'; X.beginPath(); X.arc(-2.5, -12, 1.6, 0, TAU); X.arc(2.5, -12, 1.6, 0, TAU); X.fill(); glint(-2, -3, 2.5, 4, -.3, .4);
    X.restore();
  }
  function knotPost(x, y0, y1) {                                      // the wooden post the knot slides on (roper's meter)
    rr(x - 22, y0 - 16, 44, y1 - y0 + 32, 18); ink('#c98443', 4); X.save(); rr(x - 22, y0 - 16, 44, y1 - y0 + 32, 18); X.clip(); X.fillStyle = '#9a5f2c'; X.fillRect(x + 4, y0 - 16, 30, y1 - y0 + 32); X.restore();
    rr(x - 22, y0 - 16, 44, y1 - y0 + 32, 18); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    rr(x - 8, y0, 16, y1 - y0, 8); ink('#4a2c14', 2.5);
    X.fillStyle = '#e8434f'; rr(x - 8, y0, 16, 34, 8); X.fill(); rr(x - 8, y1 - 34, 16, 34, 8); X.fill();
    for (let q = 0; q <= 10; q++) { const y = lerp(y1, y0, q / 10); line([[x + 9, y], [x + (q % 5 ? 15 : 21), y]], 2, '#e6a867'); }
  }
  function roperView(T) {
    const side = me === 1 ? 0 : 1, s = side ? -1 : 1, px = 400 + s * 0, y0 = 150, y1 = 450, ky = lerp(y1, y0, ten);
    // the palm of my side, close up on the edge, with the rope tied to it
    const tx = side ? 770 : 30, ty = 300;
    rr(tx - 30, 80, 60, 420, 22); ink('#a8703a', 4); X.save(); rr(tx - 30, 80, 60, 420, 22); X.clip(); X.fillStyle = '#8a5a34'; X.fillRect(side ? tx - 30 : tx + 4, 80, 30, 420); X.restore(); rr(tx - 30, 80, 60, 420, 22); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    for (let q = 0; q < 7; q++) line([[tx - 22, 110 + q * 58], [tx + 22, 118 + q * 58]], 2, '#6e4120');
    // the rope: from the trunk to the knot, slack when the tension is low
    const ax = tx - s * 28, ay = ty, slack = (1 - ten) * 120, shake = ten > .88 ? Math.sin(T * 50) * (ten - .88) * 40 : 0;
    X.beginPath(); X.moveTo(ax, ay); X.quadraticCurveTo((ax + px) / 2, (ay + ky) / 2 + slack + shake, px - s * 20, ky); X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 15; X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 9; X.stroke();
    X.save(); X.setLineDash([6, 6]); X.strokeStyle = '#b98042'; X.lineWidth = 9; X.stroke(); X.setLineDash([]); X.restore();
    knotPost(px, y0, y1);
    el(px, ky, 20, 16); ink('#e6c58c', 4); el(px, ky, 9, 7); ink('#b98042', 2.5); glint(px - 6, ky - 6, 5, 3, -.4, .6);
    if (dragY !== null || g.c - tugAt < .15 || upK || dnK) { X.fillStyle = 'rgba(255,255,255,.35)'; el(px, ky, 30, 26); X.fill(); }
    // the shout of the guy in the hammock
    const cue = side ? cueR : cueL;
    if (cue) {
      const by = 300, up = cue > 0, a = .7 + .3 * Math.sin(T * 10);
      X.save(); X.translate(px + (side ? -130 : 130), by); rr(-70, -80, 140, 160, 26); ink(up ? '#4fd06a' : '#ffd23f', 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(-58, -72, 116, 14, 6); X.fill();
      X.translate(0, (up ? -1 : 1) * Math.sin(T * 12) * 5); X.beginPath(); if (up) { X.moveTo(0, -46); X.lineTo(34, -6); X.lineTo(14, -6); X.lineTo(14, 30); X.lineTo(-14, 30); X.lineTo(-14, -6); X.lineTo(-34, -6); } else { X.moveTo(0, 46); X.lineTo(34, 6); X.lineTo(14, 6); X.lineTo(14, -30); X.lineTo(-14, -30); X.lineTo(-14, 6); X.lineTo(-34, 6); }
      X.closePath(); ink('#fff', 4); X.restore();
      txt(up ? 'TIGHTER!' : 'LOOSER!', px + (side ? -130 : 130), by + 100, 22, up ? '#5CFF7A' : '#ffd23f', 'center', 150);
    } else { txt('WAIT FOR THE SHOUT', px + (side ? -130 : 130), 300, 17, 'rgba(255,255,255,.9)', 'center', 150); }
    txt(side ? 'RIGHT KNOT' : 'LEFT KNOT', 400, 56, 26, '#fff', 'center', 300);
    rr(300, 520, 200, 44, 18); ink('rgba(255,255,255,.2)', 3); txt(TOUCH ? 'DRAG THE KNOT' : 'DRAG / W S', 400, 543, 18, '#fff', 'center', 180);
  }
  function judgeHud(T) {
    // the "steady" sign hanging on strings: it fills with the streak and turns red when the hammock is not steady
    const tilt = dTilt, ok = Math.abs(tilt) <= TOL && dMean >= MLO && dMean <= MHI, w = 360, x0 = 220, y0 = 36;
    line([[x0 + 30, 0], [x0 + 30, y0 + 8]], 3, '#e6c58c'); line([[x0 + w - 30, 0], [x0 + w - 30, y0 + 8]], 3, '#e6c58c');
    rr(x0, y0, w, 44, 14); ink('#d9944f', 4); rr(x0 + 8, y0 + 8, w - 16, 28, 10); X.fillStyle = '#7a4a22'; X.fill();
    X.save(); rr(x0 + 8, y0 + 8, w - 16, 28, 10); X.clip(); X.fillStyle = ok ? '#5CFF7A' : '#ff4d5e'; X.fillRect(x0 + 8, y0 + 8, (w - 16) * clamp(ss / NEED, 0, 1), 28); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(x0 + 8, y0 + 11, w - 16, 6); X.restore();
    txt(ok ? 'STEADY!' : 'NOT STEADY', x0 + w / 2, y0 + 23, 18, '#fff', 'center', w - 40);
  }
  function judgeUI(T) {
    for (let i = 0; i < 4; i++) { const q = PLATES[i], on = i === ptr || (i === 0 && kq) || (i === 1 && ka) || (i === 2 && ke) || (i === 3 && kd); plate(q.x, 494, 175, 50, q.c, q.d, on, q.l, q.cap); }
  }
  function swatUI(T) { rr(300, 524, 200, 40, 18); ink('rgba(255,255,255,.22)', 3); txt(TOUCH ? 'TAP THE MOSQUITOES' : 'CLICK THE MOSQUITOES', 400, 545, 18, '#fff', 'center', 184); }

  function scene(T, tilt, mean) {                                      // the full patio with the hammock (judge live, the others after the verdict)
    X = ctx; const won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? g.c - resAt : -1;
    if (!BG) BG = bake();
    X.drawImage(BG, 0, 0);
    cloud(((T * 6 + 90) % 1000) - 140, 70, .9); cloud(((T * 4 + 480) % 1000) - 140, 150, .7);
    for (let i = 0; i < 2; i++) palmTop(i, T);
    macaw(668, 250, T); crab(T);
    const h = hamGeom(tilt, mean), u0 = clamp(.5 - tilt * .55, .16, .84);
    drawHammock(h);
    let pt = hamAt(h, u0), ang = Math.atan2(pt.ty, pt.tx), px = pt.x, py = pt.y - 20, rot = ang - Math.PI / 2, mood = null, hold = 'coco';
    if (won) { mood = 'happy'; hold = 'arepa'; py += Math.sin(T * 3) * 2; }
    if (lost) {                                                         // the fall: the guy drops to the sand, the coco flies one way, the arepa lands on his face
      const k = clamp(rk / .55, 0, 1), side = Math.sign(tilt || fTilt || 1), gx = px - (why === 2 ? 0 : side * 40), gy = GROUND - 8;
      px = lerp(px, gx, ease(k)); py = lerp(py, gy, k * k); rot = rot + (Math.PI * .5 * ease(k)) * (side || 1); mood = 'sad'; hold = null;
      if (rk > .55 && rk < .6 && !g._thud) { g._thud = true; shake(7, .2); sfx.thud(); burst(px, gy, '#e2b968', 14, 220); }
      const ck = clamp(rk / 1.1, 0, 1); coco(lerp(px, px - side * 160, ease(ck)), lerp(py - 30, GROUND - 12, ck * ck) - Math.sin(ck * Math.PI) * 130, 1, ck * 9);
      if (rk > .5) { const ak = outBack((rk - .5) / .3); arepa(px - side * 30, py - 18 - 30 * (1 - ak), 1.1, -.3 * side); }
    }
    ctx.save(); guyDraw(px, py, rot, mood, T, won, lost); ctx.restore();
    if (hold === 'coco' && !lost) cocoHeld(px, py, rot);
    if (hold === 'arepa') { arepaHeld(px, py, rot, T); }
    if (won) { for (let q = 0; q < 3; q++) { const k = (T * .7 + q * .33) % 1; X.globalAlpha = 1 - k; txt('Z', px - 40 + q * 16, py - 50 - k * 60, 24 + q * 6, '#fff'); X.globalAlpha = 1; } }
    return { px, py };
  }
  function cocoHeld(px, py, rot) { const c = Math.cos(rot), s = Math.sin(rot), lx = -4, ly = -34; coco(px + lx * c - ly * s, py + lx * s + ly * c - 6, .9, rot * .3); }
  function arepaHeld(px, py, rot, T) { const c = Math.cos(rot), s = Math.sin(rot), lx = -4, ly = -34 - Math.abs(Math.sin(T * 5)) * 4; arepa(px + lx * c - ly * s, py + lx * s + ly * c - 6, 1, rot * .3); }
  function guyDraw(px, py, rot, mood, T, won, lost) {
    ctx.translate(px, py); ctx.rotate(rot); const u = 2.6;
    if (!lost && !won) { ctx.translate(0, Math.sin(T * 3) * 1.5); }
    caos(0, 6 * u, u, { col: cols(0), mood });
  }

  g.draw = function (tm) {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    if (judge) { scene(T, dTilt, dMean); }
    else if (g.result) { scene(T, fTilt, fMean); }
    else if (rope) { if (!BG) BG = bake(); X.drawImage(BG, 0, 0); X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(0, 0, 800, 600); roperView(T); }
    else { const sw = Math.sin(T * 1.7) * .03; scene(T, sw, T0); }
    if (judge || swat) {
      for (const m of mosAlive()) { const [mx, my] = mpos(m, S), left = (m.t0 + MLIFE - S) / MLIFE; mosquito(mx, my, T, 1); if (swat && left < .35) { X.globalAlpha = .5 + .5 * Math.sin(T * 24); txt('!', mx + 18, my - 24, 22, '#ffe14d'); X.globalAlpha = 1; } }
      for (const k of marks) { const a = (g.c - k.t0) / .6; X.globalAlpha = 1 - a; if (k.miss) { X.lineWidth = 3; X.strokeStyle = '#fff'; el(k.x, k.y, 10 + a * 20, 10 + a * 20); X.stroke(); } else { el(k.x, k.y, 14, 9); ink('#7a1f2e', 3); } X.globalAlpha = 1; }
    }
    if (!g.result) { if (judge) { judgeHud(T); judgeUI(T); } else if (swat) swatUI(T); }
    if (judge && !g.result && T > 0.2) { const ok = Math.abs(dTilt) <= TOL; if (Math.abs(dTilt) > .38) { X.globalAlpha = .6 + .4 * Math.sin(T * 14); badge('FALLING!', 400, 140, 24, '#e8343d', '#fff', 1, -.03); X.globalAlpha = 1; } else if (dMean < .16) { X.globalAlpha = .6 + .4 * Math.sin(T * 14); badge('TOO LOW!', 400, 140, 24, '#e8343d', '#fff', 1, -.03); X.globalAlpha = 1; } }
    if (won && rk > .15) { for (let i = 0; i < 14; i++) { const d = rk - hash(i + 3) * .8; if (d < 0) continue; heart(40 + hash(i) * 720, 590 - d * (160 + hash(i + 9) * 90), .9 + hash(i + 5) * .5, true); } badge('HOW COMFY!', 400, 120, 34, '#22a447', '#fff', outBack((rk - .15) / .25), -.04); }
    if (lost && rk > .6) badge(why === 3 ? 'TOO SLOW!' : 'PLOP!', 400, 120, 32, '#e8343d', '#fff', outBack((rk - .6) / .25), .04);
    if (!g.result && T < 2.4) badge(judge ? 'SHOUT THE ROPES!' : rope ? 'PULL THE KNOT!' : 'SWAT THEM!', 400, 200, 22, '#2b9ee6', '#fff', outBack(T / .3), -.03);
    for (const q of pops) { const a = T - q.t0; badge(q.s, q.x, q.y - a * 26, q.size, q.bgc, '#fff', a < .2 ? outBack(a / .2) : 1); }
    vignette(.14);
  };
  g.dbg = {
    view: () => judge ? { S, tilt: dTilt, mean: dMean, ss, cue: [cueL, cueR], mos: mosAlive().map(m => ({ id: m.i })) }
      : rope ? { S, ten, cue: me === 1 ? cueL : cueR } : { S, mos: mosAlive().map(m => { const [x, y] = mpos(m, S); return { id: m.i, x, y }; }) },
  };
  wire(g, D, 0, sp, 'sq_chinchorro');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, tm) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#86d8fb'); gr.addColorStop(.6, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#f6dc9b'; X.fillRect(0, 170, 520, 70); X.fillStyle = INK; X.fillRect(0, 168, 520, 4);
  const sw = Math.sin(tm * 1.6) * (role === 0 ? .5 : .15);
  X.fillStyle = '#8a5a34'; rr(20, 40, 24, 134, 8); ink('#a8703a', 3); rr(476, 40, 24, 134, 8); ink('#a8703a', 3);
  const yA = 80 + 40 * sw, yB = 80 - 40 * sw; X.beginPath(); X.moveTo(44, yA); X.quadraticCurveTo(260, (yA + yB) / 2 + 100, 476, yB); X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 24; X.stroke(); X.strokeStyle = '#ff6a5c'; X.lineWidth = 17; X.stroke();
  X.save(); X.setLineDash([10, 10]); X.strokeStyle = '#ffd23f'; X.stroke(); X.setLineDash([]); X.restore();
  const bx = 260 - sw * 90; el(bx, yA + (yB - yA) * .5 + 52 + Math.abs(sw) * 10, 18, 12, -sw * .6); ink(COLS[0], 3);
  if (role === 0) {
    for (const [px, l, c] of [[40, 'L', '#4fd06a'], [160, 'L', '#ffd23f'], [280, 'R', '#4fd06a'], [400, 'R', '#ffd23f']]) { rr(px, 196, 100, 32, 14); ink(c, 3); }
    demoFinger(sw > 0 ? 90 : 450, 214, true, 0); badge('SHOUT THE ROPES!', 260, 24, 16, '#22a447', '#fff', 1, -.03);
  } else if (role < 3) {
    const k = (tm % 2) / 2, y = 160 - 90 * (role === 1 ? k : 1 - k); rr(244, 50, 32, 130, 14); ink('#c98443', 3); el(260, y, 18, 14); ink('#e6c58c', 3); demoFinger(260, y + 18, true, 0);
    badge(role === 1 ? 'LEFT KNOT' : 'RIGHT KNOT', 260, 24, 16, '#2b9ee6', '#fff', 1, -.03);
  } else {
    for (let q = 0; q < 3; q++) { const mx = 150 + q * 110 + Math.sin(tm * 2 + q) * 30, my = 60 + q * 20 + Math.cos(tm * 3 + q) * 14; el(mx, my, 6, 8); ink('#5a4a64', 2.5); }
    demoFinger(260 + Math.sin(tm * 2 + 1) * 30, 82, (tm % 1) < .3, (tm % 1) * 3); badge('SWAT THEM!', 260, 24, 17, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_chinchorro', sqChinchorro, 'CHINCHORRO'); REGMAP.sq_chinchorro.duo = true; REGMAP.sq_chinchorro.squad = true;
DUO.INFO.sq_chinchorro = n => [
  ['IN THE HAMMOCK', 'SHOUT WHICH ROPE TO TIGHTEN OR LOOSEN', 'HOLD THE PLATES / Q A E D'],
  ['LEFT KNOT', 'TIGHTEN OR LOOSEN AS THE SHOUT SAYS', 'DRAG THE KNOT / W S'],
  ['RIGHT KNOT', 'TIGHTEN OR LOOSEN AS THE SHOUT SAYS', 'DRAG THE KNOT / W S'],
  ['MOSQUITOES', 'SWAT THE MOSQUITOES BEFORE THEY BITE', 'TAP / CLICK THEM'],
].slice(0, n);
DUO.DEMOS.sq_chinchorro = n => Array.from({ length: n }, (_, r) => tm => demo(r, n, tm));

})();
