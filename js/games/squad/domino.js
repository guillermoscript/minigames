'use strict';
/* ═════════ SQUAD · DOMINÓ DE ESQUINA (sq_domino), 3-4 players, one role each ═════════
   A game of dominoes on the corner sidewalk, red plastic table, the old man from the corner watching with a tile in his fist. Everybody plays on the same
   team against the clock and NOBODY can talk in the game: only a handful of SIGNS (shown above the signer for 2 s). Out of the game you may talk.
   The core is deduction: every hand sees ONLY its own tiles, and the table has an open end. Whoever holds the right tile has to be found by signs.
   n = 4:  TABLE (0, JUDGE)  does not hold tiles. Sees the whole plan (4 plays in a row: [open end | new end]) and confirms the plays. Signs:
                              HINT  = "the other side of the tile we need is LOW (1-2) / MID (3-4) / HIGH (5-6)" and
                              WHO   = points at a hand ("you play").
           HAND A, B, C (1-3)  see ONLY their tiles and the open end (tiles that fit glow). Signs: "I HAVE IT" + the other side of their tile (1-6) or "NO TENGO".
                              Play = tap the tile. A hand that holds a fitting tile of the hinted size signs it and, if no other hand signed too, plays;
                              if two hands claim it, the Table compares the numbers with the plan and points at the right one.
   n = 3:  one hand less (two hands, four tiles each; with 4 players three hands of three tiles).
   Rounds: 4 plays in a row (each round has its own deal: the target tile is in ONE hand, decoys that also fit the open end sit in the others; one round
   per game is a "tie": the decoy is in the same size as the target, so the hint is not enough and the numbers must be signed).
   Win = 4 right plays. Lose = 2 wrong tiles or the clock.
   Everything is generated from mkR() in the constructor, always the same draws on every screen (n only, never the role).
   Netcode (absolute messages, resent every .5 s):  'sg' [round, kind, seq] a sign (kind 0 no tengo, 1-6 I have it + number, 7-9 hint low/mid/high,
   10+h points at hand h); 'pl' [round, tileId, seq] a hand plays (to the judge); 'st' [round, strikes, ...deadTileIds] judge -> everybody; 'why'.
   The Table (judge) decides the verdict ('end', via wire). */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only

const ROUNDS_N = 4, MAXBAD = 2, SIGN_LIFE = 2, RESEND = .5;
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const NAMES = ['TABLE', 'HAND A', 'HAND B', 'HAND C'];
const HINTS = ['LOW (1-2)', 'MID (3-4)', 'HIGH (5-6)'], HCOL = ['#6EA8FE', '#FFC93C', '#FF8FB1'];
const IVORY = '#fffaf0', IVORY2 = '#d8c79a', BACK = '#4aa896', BACK2 = '#2f7d70', RED = '#e8434f', RED2 = '#b8283a', GOLD = '#ffcf33', WOOD = '#c98443', WOOD2 = '#8f5a24';
const PIPS = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
const CL = v => v <= 2 ? 0 : v <= 4 ? 1 : 2;                          // size class of a number
const tid = (a, b) => a < b ? a * 10 + b : b * 10 + a, ta = id => Math.floor(id / 10), tb = id => id % 10;
const fits = (id, e) => ta(id) === e || tb(id) === e, other = (id, e) => ta(id) === e ? tb(id) : ta(id);
const LINEY = 322, TILEW = 64, TILEH = 32;

/* ───────────── tiny drawing kit (X is ctx, or an offscreen context while the background is baked) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(build, base, shade, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function emo(s, x, y, size) { X.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = '#000'; X.fillText(s, x, y); }
function btxt(s, x, y, size, fill, ang = 0, stroke = INK) {          // text on the baked canvas (txt() paints only on the live one); proper names, never translated
  X.save(); X.translate(x, y); X.rotate(ang); X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round';
  X.lineWidth = size / 5; X.strokeStyle = stroke; X.strokeText(s, 0, 0); X.fillStyle = fill; X.fillText(s, 0, 0); X.restore();
}
function pill(x, y, label, col) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(130, X.measureText(t(label)).width + 24);
  rr(x - w / 2, y - 12, w, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 9, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 15, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(380, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 380);
  X.restore();
}
function pips(cx, cy, size, v, col) {                                // v pips inside a square of side `size`
  const d = size * .25, r = Math.max(1.6, size * .085);
  for (const [px, py] of PIPS[v] || []) { X.beginPath(); X.arc(cx + px * d, cy + py * d, r, 0, TAU); X.fillStyle = col || INK; X.fill(); X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.arc(cx + px * d - r * .3, cy + py * d - r * .3, r * .32, 0, TAU); X.fill(); }
}
function tile(cx, cy, w, h, a, b, rot, hid, glow, deadK) {           // a domino w x h, `a` pips on the left half, `b` on the right
  X.save(); X.translate(cx, cy); X.rotate(rot || 0);
  const bd = () => rr(-w / 2, -h / 2, w, h, h * .24), o = Math.max(2, h * .1);
  X.fillStyle = 'rgba(20,16,28,.22)'; rr(-w / 2 + 2, -h / 2 + h * .16, w, h, h * .24); X.fill();
  if (hid) {
    cel(bd, BACK, BACK2, h * .05, h * .1, o);
    X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + h * .14, -h / 2 + h * .12, w - h * .28, h * .16, h * .08); X.fill();
    X.beginPath(); X.arc(0, 0, h * .12, 0, TAU); ink('#e9fff8', 1.5);
  } else {
    cel(bd, deadK ? '#cfc8d8' : IVORY, deadK ? '#a49cb4' : IVORY2, h * .05, h * .1, o);
    line([[0, -h * .34], [0, h * .34]], Math.max(1.4, h * .05), '#7a6a4a');
    pips(-w / 4, 0, h, a, deadK ? '#6c6785' : null); pips(w / 4, 0, h, b, deadK ? '#6c6785' : null);
    if (deadK) { line([[-w * .3, -h * .3], [w * .3, h * .3]], Math.max(3, h * .14), RED); line([[-w * .3, h * .3], [w * .3, -h * .3]], Math.max(3, h * .14), RED); }
  }
  if (glow) { bd(); X.lineWidth = 5; X.strokeStyle = glow; X.stroke(); }
  X.restore();
}
function keycap(x, y, label) { if (TOUCH) return; X.font = '700 13px Fredoka, Arial, sans-serif'; const cw = Math.max(22, X.measureText(label).width + 12); rr(x - cw / 2, y - 10, cw, 20, 6); ink('#fff', 2.5); txt(label, x, y + 1, 13, INK, 'center', cw - 4); }
function chair(x, y, col) {
  rr(x - 22, y - 62, 44, 30, 10); ink(col, 4); X.fillStyle = 'rgba(20,16,28,.14)'; rr(x - 22, y - 62, 44, 30, 10); X.fill();
  rr(x - 26, y - 44, 52, 22, 8); ink(col, 4); line([[x - 18, y - 24], [x - 22, y - 2]], 4, '#cfd6e6'); line([[x + 18, y - 24], [x + 22, y - 2]], 4, '#cfd6e6');
}

/* ───────────── the corner, painted once ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; const old = X; X = cv.getContext('2d');
  // the bodega wall (warm yellow, cel stripes) and the scalloped awning
  let g = X.createLinearGradient(0, 0, 0, 210); g.addColorStop(0, '#ffd78f'); g.addColorStop(1, '#f4b87a'); X.fillStyle = g; X.fillRect(0, 0, 800, 210);
  X.fillStyle = 'rgba(200,100,70,.14)'; for (let i = 0; i < 16; i++) X.fillRect(i * 52 + 14, 0, 18, 210);
  for (let i = 0; i < 14; i++) { const x0 = i * 58 - 4; X.beginPath(); X.moveTo(x0, 0); X.lineTo(x0 + 58, 0); X.lineTo(x0 + 58, 20); X.arc(x0 + 29, 20, 29, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff7e6' : RED, 3); }
  btxt('BODEGA LA ESQUINA', 232, 132, 24, '#fff7e6', -.02, '#7a2c1f');
  // door with the old man's spot (left) and a barred window (right)
  rr(26, 80, 104, 134, 6); ink('#8a5a3c', 5); rr(38, 92, 80, 64, 4); ink('#bfe8ff', 3); line([[78, 92], [78, 156]], 3, '#8a5a3c'); X.beginPath(); X.arc(112, 170, 4, 0, TAU); ink(GOLD, 2);
  rr(560, 66, 150, 92, 8); ink('#8a5a3c', 6); rr(570, 76, 130, 72, 4); ink('#2b2d5c', 3); for (let q = 1; q < 4; q++) line([[570 + q * 32.5, 76], [570 + q * 32.5, 148]], 3, '#8a5a3c');
  // a cat that watches the game from the ledge, and the radio on a crate
  rr(556, 156, 158, 12, 4); ink('#8a5a3c', 4);
  X.beginPath(); X.ellipse(640, 150, 18, 12, 0, 0, TAU); ink('#4a4458', 3); X.beginPath(); X.arc(626, 136, 11, 0, TAU); ink('#4a4458', 3); tri(618, 130, 620, 118, 626, 128, '#4a4458', 2.5); tri(628, 128, 634, 118, 636, 130, '#4a4458', 2.5);
  X.fillStyle = '#ffe14d'; X.beginPath(); X.arc(622, 136, 2.4, 0, TAU); X.arc(631, 136, 2.4, 0, TAU); X.fill(); line([[656, 152], [678, 146], [684, 136]], 4, '#4a4458');
  rr(430, 168, 56, 34, 6); ink('#7c4a24', 4); rr(438, 176, 40, 18, 4); ink('#fff7e6', 2.5); X.beginPath(); X.arc(458, 185, 5, 0, TAU); ink(RED, 2); line([[484, 168], [496, 142]], 3, '#cfd6e6');
  // the chalk board for the score
  rr(318, 14, 164, 66, 8); ink('#8a5a3c', 5); rr(326, 22, 148, 50, 4); ink('#2f5a4b', 3); X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(330, 26, 140, 4);
  // sidewalk: curb, tiles, joints
  rr(-10, 206, 820, 18, 4); ink('#b9b3c7', 4);
  g = X.createLinearGradient(0, 224, 0, 600); g.addColorStop(0, '#d9d2c2'); g.addColorStop(1, '#c4bcaa'); X.fillStyle = g; X.fillRect(0, 224, 800, 376);
  X.strokeStyle = 'rgba(80,70,50,.18)'; X.lineWidth = 3; for (let y = 250; y < 600; y += 58) { X.beginPath(); X.moveTo(0, y); X.lineTo(800, y); X.stroke(); } for (let x = 0; x < 800; x += 100) { X.beginPath(); X.moveTo(x, 224); X.lineTo(x, 600); X.stroke(); }
  // street sign on the corner post
  line([[766, 226], [766, 60]], 8, '#6c6785'); rr(716, 44, 100, 24, 4); ink('#2b9ee6', 3); btxt('ESQUINA', 766, 56, 13, '#fff', 0); rr(722, 74, 88, 20, 4); ink('#22a447', 3); btxt('AV. BOLÍVAR', 766, 84, 10, '#fff', 0);
  // chairs behind the seats (the 4th stays empty with 3 players: the old man left it for his thermos)
  for (const [cx, cy, col] of [[400, 212, '#bfe8ff'], [52, 372, '#ffd6e0'], [748, 372, '#d6f5c9'], [640, 214, '#ffe9a0']]) chair(cx, cy, col);
  // the red plastic table
  X.fillStyle = 'rgba(20,16,28,.25)'; rr(98, 252, 620, 342, 40); X.fill();
  rr(90, 238, 620, 342, 40); cel(() => rr(90, 238, 620, 342, 40), '#e8434f', '#b8283a', 0, 10, 5);
  rr(106, 254, 588, 310, 30); X.lineWidth = 4; X.strokeStyle = 'rgba(255,255,255,.35)'; X.stroke();
  X.fillStyle = 'rgba(255,255,255,.2)'; rr(110, 258, 580, 9, 4.5); X.fill();
  X.strokeStyle = 'rgba(255,255,255,.1)'; X.lineWidth = 12; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(150 + i * 110, 600); X.lineTo(260 + i * 110, 250); X.stroke(); }
  el(400, 322, 250, 52); X.fillStyle = 'rgba(0,0,0,.12)'; X.fill(); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.28)'; X.stroke();
  // cafecito thermos and two tiny cups on the corners, a bottle cap
  rr(124, 262, 22, 40, 6); cel(() => rr(124, 262, 22, 40, 6), '#fff7e6', '#d6c9a8', 4, 0, 3); rr(127, 254, 16, 12, 4); ink(RED, 2.5);
  for (const [cx, cy] of [[676, 270], [150, 548]]) { rr(cx - 10, cy - 8, 20, 16, 5); ink('#fff7e6', 3); X.beginPath(); X.arc(cx + 12, cy, 5, -1.4, 1.4); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); el(cx, cy - 7, 8, 3); ink('#5a2d12', 2); }
  X.beginPath(); X.arc(668, 556, 9, 0, TAU); ink(GOLD, 2.5);
  X = old; return cv;
}

/* ═════════ the game ═════════ */
function sqDomino(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, judge = me === 0, NH = n - 1, hi = me - 1, per = n === 3 ? 4 : 3, TS = Math.sqrt(sp);
  const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
  /* the deal: 4 rounds, a chain (each new end is the next open end). Every draw comes from R, in the same order on every screen */
  const TIE = 1 + Math.floor(R() * 3), ORD = shuf(Array.from({ length: ROUNDS_N }, (_, k) => k % NH)), ALL = [];
  for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ALL.push(a * 10 + b);
  const RO = []; let E = 1 + Math.floor(R() * 6); const E0 = E, START = 1 + Math.floor(R() * 6);
  for (let k = 0; k < ROUNDS_N; k++) {
    const N = 1 + Math.floor(R() * 6), tgt = tid(E, N), th = ORD[k], hands = Array.from({ length: NH }, () => []), tie = k === TIE;
    const used = new Set([tgt]); hands[th].push(tgt);
    const others = shuf(Array.from({ length: NH }, (_, h) => h).filter(h => h !== th)), cls = shuf([0, 1, 2].filter(c => c !== CL(N))), dec = [];
    const pick = c => c * 2 + 1 + Math.floor(R() * 2);
    dec.push(tie ? (N % 2 ? N + 1 : N - 1) : pick(cls[0]));
    const more = R() < .6; if (n === 4 && more) dec.push(tie ? pick(cls[0]) : pick(cls[1]));
    dec.forEach((M, i) => { const id = tid(E, M); used.add(id); hands[others[i]].push(id); });
    const pool = shuf(ALL.filter(id => !used.has(id) && !fits(id, E)));
    for (const h of hands) while (h.length < per) h.push(pool.pop());
    hands.forEach(shuf);
    RO.push({ E, N, tgt, th, tie, hands }); E = N;
  }
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i];
  const SEAT = n === 4 ? [[400, 214], [52, 372], [748, 372], [640, 214]] : [[400, 214], [52, 372], [748, 372]];
  /* state */
  let rd = 0, strikes = 0, why = 0, resAt = -1, endFx = false, stAt = -9;
  const dead = new Set(), placedAt = [-9, -9, -9, -9], signs = {}, signAt = {}, pops = [];
  let slammed = false, mySeq = 0, sgSent = -9, pend = null, pendSent = -9, playSeq = 0, hitAt = -9;
  const seen = new Set();                                              // judge: plays already handled ('from:seq')
  const cur = () => RO[Math.min(rd, ROUNDS_N - 1)];
  const openEnd = () => rd >= ROUNDS_N ? RO[ROUNDS_N - 1].N : RO[rd].E;
  const mine = () => judge || rd >= ROUNDS_N ? [] : RO[rd].hands[hi];
  const live = () => { const out = []; for (const k in signs) { const s = signs[k]; if (s.r === rd && g.c - s.at < SIGN_LIFE) out.push({ from: +k, k: s.k, age: g.c - s.at }); } return out; };
  function pop(s, px, py, size, bgc) { pops.length = 0; pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); }

  function sendSt() { stAt = g.c; D.send('st', [rd, strikes, ...dead]); }
  function sign(kd) {
    if (g.result) return; const o = signs[me]; if (o && o.k === kd && o.r === rd && g.c - o.at < .22) return;
    signs[me] = { r: rd, k: kd, seq: ++mySeq, at: g.c }; sgSent = g.c; signAt[kd] = g.c; D.send('sg', [rd, kd, mySeq]);
    snd(520 + (kd % 7) * 40, .06, 'triangle', .05, 0, 760);
  }
  function advance() {                                                 // judge: a right tile was played
    placedAt[rd] = g.c; rd++; dead.clear(); pend = null; sendSt(); onPlaced();
    if (rd >= ROUNDS_N) g.finish('win');
  }
  function onPlaced() { snd(190, .07, 'square', .06, 0, 120); noise(.06, .07, 2500, 5000, 'highpass'); shake(2, .08); }
  function onBad(id) { dead.add(id); hitAt = g.c; sfx.miss(); shake(5, .18); pop('NO FIT!', 400, 262, 30, RED); }
  function lose(k) { if (g.result) return; why = k; D.send('why', k); sendSt(); g.finish('lose'); }
  function handle(from, d) {                                           // judge: a hand plays a tile
    if (g.result || !Array.isArray(d) || from < 1 || from > NH) return; const r = d[0] | 0, id = d[1] | 0, seq = d[2] | 0, key = from + ':' + seq;
    if (seen.has(key)) return; seen.add(key);
    if (r !== rd || dead.has(id) || !RO[rd].hands[from - 1].includes(id)) return;
    if (id === RO[rd].tgt) advance();
    else { strikes++; onBad(id); sendSt(); if (strikes >= MAXBAD) lose(1); }
  }
  function play(id) {
    if (judge || g.result || rd >= ROUNDS_N || dead.has(id)) return;
    if (pend && pend.r === rd && !dead.has(pend.id) && g.c - pend.at < 1.2) return;
    pend = { r: rd, id, seq: ++playSeq, at: g.c }; pendSent = g.c; D.send('pl', [rd, id, playSeq]); snd(330, .05, 'square', .05, 0, 200);
  }

  /* layout */
  const SGN = [1, 2, 3, 4, 5, 6, 0].map((k, i) => k ? { k, x: 88 + i * 84, y: 408, w: 76, h: 50 } : { k, x: 592, y: 408, w: 124, h: 50 });
  const HNT = [0, 1, 2].map(c => ({ c, x: 96 + c * 122, y: 488, w: 114, h: 62 }));
  const DSG = Array.from({ length: NH }, (_, h) => ({ h, x: n === 4 ? 504 + h * 78 : 540 + h * 88, y: 488, w: n === 4 ? 70 : 80, h2: 62 }));
  function handLayout() {
    const m = mine(), c = m.length; if (!c) return [];
    const tw = Math.min(138, (690 - (c - 1) * 14) / c), x0 = 400 - (c * tw + (c - 1) * 14) / 2;
    return m.map((id, i) => ({ id, x: x0 + i * (tw + 14) + tw / 2, y: 526, w: tw, h: tw * .5, a: ta(id), b: tb(id) }));
  }
  const inR = (p, r0, h) => p.x >= r0.x && p.x <= r0.x + r0.w && p.y >= r0.y && p.y <= r0.y + (h || r0.h) + 8;

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: judge ? 'SIGNAL!' : 'MATCH IT!', roleLabel: NAMES[me],
    hint: judge ? 'READ THE PLAN AND SIGN THE SIZE OF THE NEW END (Q W E) - IF TWO HANDS CLAIM IT, POINT AT THE RIGHT ONE (A S D)'
      : 'YOU ONLY SEE YOUR TILES - SIGN WHAT FITS (1-6, 0) AND PLAY THE TILE THE HINT POINTS TO (Q W E R)',
    thint: judge ? 'READ THE PLAN AND SIGN THE SIZE OF THE NEW END - IF TWO HANDS CLAIM IT, POINT AT THE RIGHT ONE'
      : 'YOU ONLY SEE YOUR TILES - SIGN WHAT FITS AND TAP THE TILE THE HINT POINTS TO',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      const alive = !g.result;
      const mySg = signs[me]; if (alive && mySg && g.c - mySg.at < SIGN_LIFE && g.c - sgSent >= RESEND) { sgSent = g.c; D.send('sg', [mySg.r, mySg.k, mySg.seq]); }
      if (alive && judge) { if (g.c - stAt >= RESEND) sendSt(); if (g.c >= g.limit) lose(2); }
      if (alive && !judge && pend) { if (pend.r !== rd || dead.has(pend.id) || g.c - pend.at > 3) pend = null; else if (g.c - pendSent >= RESEND) { pendSent = g.c; D.send('pl', [pend.r, pend.id, pend.seq]); } }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      if (g.result && !endFx) {
        endFx = true;
        if (g.result === 'win') { sfx.thud(); noise(.3, .1, 400, 1800, 'bandpass'); [392, 523, 659, 784].forEach((f, i) => snd(f, .16, 'square', .05, .1 + i * .09)); }
        else { sfx.miss(); snd(300, .5, 'sawtooth', .06, 0, 90); }
      }
    },
    msg(type, d, from) {
      if (type === 'sg' && Array.isArray(d) && d.length >= 3 && from >= 0 && from < n) {
        const r = d[0] | 0, k = d[1] | 0, seq = d[2] | 0;
        if (from === 0 ? !(k >= 7 && k < 10 + NH) : !(k >= 0 && k <= 6)) return;
        const o = signs[from]; if (o && seq <= o.seq) return;
        signs[from] = { r, k, seq, at: g.c }; if (from !== me) snd(480 + (k % 7) * 36, .05, 'triangle', .035, 0, 640);
      } else if (type === 'pl' && judge) handle(from, d);
      else if (type === 'st' && !judge && Array.isArray(d) && d.length >= 2) {
        const r = d[0] | 0, s = d[1] | 0, dd = d.slice(2).map(v => v | 0);
        if (r > rd) { for (let k = rd; k < Math.min(r, ROUNDS_N); k++) placedAt[k] = g.c; rd = Math.min(r, ROUNDS_N); dead.clear(); pend = null; onPlaced(); }
        if (r >= rd) for (const id of dd) if (!dead.has(id)) { dead.add(id); onBad(id); }
        if (s > strikes) strikes = s;
      } else if (type === 'why') why = d | 0;
    },
    down(p) {
      if (g.result) return;
      if (judge) {
        for (const b of HNT) if (inR(p, b)) { sign(7 + b.c); return; }
        for (const b of DSG) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h2 + 8) { sign(10 + b.h); return; }
      } else {
        for (const b of SGN) if (inR(p, b)) { sign(b.k); return; }
        for (const q of handLayout()) if (Math.abs(p.x - q.x) <= q.w / 2 + 3 && Math.abs(p.y - q.y) <= q.h / 2 + 12) { play(q.id); return; }
      }
    },
    move() {}, up() {},
    key(e) {
      if (g.result || e.repeat) return; const c = e.code, dg = /^(?:Digit|Numpad)([0-9])$/.exec(c), v = dg ? +dg[1] : -1;
      if (judge) { const q = ['KeyQ', 'KeyW', 'KeyE'].indexOf(c), a = ['KeyA', 'KeyS', 'KeyD'].indexOf(c); if (q >= 0) sign(7 + q); else if (a >= 0 && a < NH) sign(10 + a); }
      else { if (v >= 0 && v <= 6) sign(v); const t4 = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'].indexOf(c), hl = handLayout(); if (t4 >= 0 && hl[t4]) play(hl[t4].id); }
    },
    keyup() {},
  };

  /* ───────────── drawing ───────────── */
  function lineItems(T) {                                              // tiles lying on the table: the starter and the plays so far
    const played = g.result === 'win' ? ROUNDS_N : rd, items = [{ a: START, b: E0, k: -1 }];
    for (let k = 0; k < played; k++) items.push({ a: RO[k].E, b: RO[k].N, k });
    const step = TILEW + 5, x0 = 400 - (items.length * step - 5) / 2 - 24;
    return items.map((it, i) => { const pa = it.k >= 0 ? placedAt[it.k] : -9, dk = ease((T - pa) / .22); return Object.assign(it, { x: x0 + i * step + TILEW / 2, y: LINEY - (1 - dk) * 46 }); });
  }
  function person(r, T, won, lost) {
    const [x, y] = SEAT[r], mood = won ? 'happy' : lost ? 'sad' : null, hop = won ? -Math.abs(Math.sin(T * 9 + r)) * 7 : 0;
    shadow(x, y + 3, 17, 5, .28); caos(x, y + hop, 2.6, { col: cols(r), mood });
    if (r === 0) { rr(x + 16, y - 20, 22, 28, 3); ink('#fff7e6', 2.5); line([[x + 20, y - 14], [x + 33, y - 14]], 1.5, '#8f88a6'); line([[x + 20, y - 8], [x + 33, y - 8]], 1.5, '#8f88a6'); }
    pill(x, y + 20, r === me ? 'YOU' : NAMES[r], cols(r));
    if (r >= 1) {                                                      // the face-down tiles in front of that hand
      const c = r === me ? 0 : RO[Math.min(rd, ROUNDS_N - 1)].hands[r - 1].length;
      for (let q = 0; q < c; q++) {
        if (r === 1) tile(116, 348 + q * 17, 30, 15, 0, 0, Math.PI / 2, true); else if (r === 2) tile(684, 348 + q * 17, 30, 15, 0, 0, Math.PI / 2, true);
        else tile(640 - (c - 1) * 9 + q * 18, 262, 30, 15, 0, 0, 0, true);
      }
    }
  }
  function viejo(T, won, lost, rk) {
    let x = 82, y = 232, ar = -.15;                                   // arm: raised fist (rad from straight up)
    const bob = Math.sin(T * 4) * 2;
    if (won && rk >= 0) ar = rk < .12 ? -.15 + (rk / .12) * 1.9 : 1.75 - Math.min(.1, (rk - .12) * .3);
    if (lost && rk > .5) x -= (rk - .5) * 210;
    const mad = strikes > 0 && !g.result;
    shadow(x, y + 3, 24, 7, .3); caos(x, y + bob * (lost ? 0 : .5), 3.6, { col: lost ? '#cfc8d8' : mad ? '#ff9c8a' : '#f0dfb8', mood: won ? 'happy' : lost ? 'sad' : null });
    // guayabera checks, white mustache, straw hat
    X.fillStyle = 'rgba(255,255,255,.7)'; rr(x - 12, y - 22 + bob * .5, 24, 12, 3); X.fill(); X.strokeStyle = 'rgba(120,90,50,.5)'; X.lineWidth = 1.5; for (let q = 0; q < 4; q++) { X.beginPath(); X.moveTo(x - 9 + q * 6, y - 22 + bob * .5); X.lineTo(x - 9 + q * 6, y - 10 + bob * .5); X.stroke(); }
    el(x, y - 25 + bob * .5, 10, 3.5); ink('#fff', 2); el(x, y - 49 + bob * .5, 21, 5); ink('#e6c58c', 3); rr(x - 11, y - 60 + bob * .5, 22, 13, 6); ink('#e6c58c', 3); X.fillStyle = '#a5622c'; X.fillRect(x - 11, y - 52 + bob * .5, 22, 3);
    if (mad) for (let i = 0; i < 2; i++) { const k = (T * 1.6 + i * .5) % 1; X.globalAlpha = 1 - k; line([[x + (i ? 12 : -12), y - 40 - k * 16], [x + (i ? 15 : -15), y - 48 - k * 16]], 3, '#fff'); X.globalAlpha = 1; }
    // the arm with the tile in its fist: it comes down on the table when the team wins
    const sx = x + 22, sy = y - 20, L = 48, a = ar, hx = sx + Math.sin(a) * L, hy = sy - Math.cos(a) * L;
    if (!(lost && rk > .3)) { line([[sx, sy], [hx, hy]], 8, lost ? '#cfc8d8' : '#f0dfb8'); tile(hx + 4, hy - 4, 30, 15, 6, 6, a * .6, false); }
    else { const k = rk - .3; for (const s of [-1, 1]) tile(sx + s * (6 + k * 20), sy - 10 + k * k * 140, 15, 15, 3, 0, s * (1 + k * 4), false); }
  }
  function signBubble(r, s) {
    const age = g.c - s.at; if (age > SIGN_LIFE || s.r !== rd) return;
    const [sx, sy] = SEAT[r]; let bx = sx, by = sy - 92; if (r === 1) { bx = sx + 98; by = sy - 62; } else if (r === 2) { bx = sx - 98; by = sy - 62; }
    const k = age < .2 ? outBack(age / .2) : 1, fade = age > SIGN_LIFE - .3 ? (SIGN_LIFE - age) / .3 : 1, kd = s.k;
    X.save(); X.globalAlpha = clamp(fade, 0, 1); X.translate(bx, by); X.scale(k, k);
    const w = 164, h = 76, dx = sx - bx, dy = sy - 40 - by, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    X.fillStyle = 'rgba(20,16,28,.28)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, 22); X.fill();
    tri(ux * 44 - uy * 14, uy * 44 + ux * 14, ux * 44 + uy * 14, uy * 44 - ux * 14, ux * 72, uy * 72, '#fff', 3);
    rr(-w / 2, -h / 2, w, h, 22); ink(kd >= 7 && kd < 10 ? HCOL[kd - 7] : '#fff', 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, 8, 4); X.fill();
    if (kd >= 1 && kd <= 6) { emo('☝️', -52, -10, 32); rr(-18, -32, 44, 44, 10); ink(IVORY, 3); pips(4, -10, 44, kd); txt('I HAVE IT!', 0, 24, 15, INK, 'center', 146); }
    else if (kd === 0) { emo('🤷', -4, -10, 36); txt('NO TENGO!', 0, 24, 16, INK, 'center', 146); }
    else if (kd < 10) {
      const c = kd - 7, ax = -52, ay = -8; X.beginPath();
      if (c === 0) { X.moveTo(ax - 9, ay - 14); X.lineTo(ax + 9, ay - 14); X.lineTo(ax + 9, ay + 2); X.lineTo(ax + 18, ay + 2); X.lineTo(ax, ay + 20); X.lineTo(ax - 18, ay + 2); X.lineTo(ax - 9, ay + 2); }
      else if (c === 2) { X.moveTo(ax - 9, ay + 14); X.lineTo(ax + 9, ay + 14); X.lineTo(ax + 9, ay - 2); X.lineTo(ax + 18, ay - 2); X.lineTo(ax, ay - 20); X.lineTo(ax - 18, ay - 2); X.lineTo(ax - 9, ay - 2); }
      else { X.moveTo(ax - 20, ay); X.lineTo(ax - 8, ay - 12); X.lineTo(ax - 8, ay - 5); X.lineTo(ax + 8, ay - 5); X.lineTo(ax + 8, ay - 12); X.lineTo(ax + 20, ay); X.lineTo(ax + 8, ay + 12); X.lineTo(ax + 8, ay + 5); X.lineTo(ax - 8, ay + 5); X.lineTo(ax - 8, ay + 12); }
      X.closePath(); ink('#fff', 2.5);
      txt('OTHER SIDE:', 24, -18, 12, INK, 'center', 100); txt(HINTS[c], 24, 4, 20, INK, 'center', 100);
    } else { emo('👉', -48, -8, 32); X.beginPath(); X.arc(-4, -8, 17, 0, TAU); ink(cols(kd - 9), 3); txt(['A', 'B', 'C'][kd - 10], -4, -7, 20, '#fff', 'center', 24); txt('YOU PLAY!', 0, 24, 15, INK, 'center', 146); }
    X.restore();
  }
  function chalk(T) {
    txt(t('PLAY {n}/4', { n: Math.min(rd + 1, ROUNDS_N) }), 400, 38, 20, '#f6f1d8', 'center', 130);
    for (let i = 0; i < MAXBAD; i++) {
      const cx = 372 + i * 56, bad = i < strikes;
      X.beginPath(); X.arc(cx + 14, 59, 9, 0, TAU); if (bad) ink(RED, 2.5); else { X.lineWidth = 2.5; X.strokeStyle = 'rgba(246,241,216,.6)'; X.stroke(); }
      if (bad) line([[cx + 9, 54], [cx + 19, 64]], 3, '#fff'), line([[cx + 19, 54], [cx + 9, 64]], 3, '#fff');
    }
  }
  function hudLine(T, won, lost, rk) {
    const items = lineItems(T), last = items[items.length - 1];
    items.forEach((q, i) => { const j = won ? -Math.abs(Math.sin(T * 9 + i * .7)) * 8 : 0; tile(q.x, q.y + j, TILEW, TILEH, q.a, q.b, 0, false); });
    if (!g.result) {                                                   // the open end: a bottle cap with the number, ringing
      const ex = last.x + TILEW / 2 + 44, pulse = 1 + Math.sin(T * 7) * .06;
      X.save(); X.translate(ex, LINEY); X.scale(pulse, pulse); X.beginPath(); X.arc(0, 0, 25, 0, TAU); ink(GOLD, 4); X.beginPath(); X.arc(0, 0, 19, 0, TAU); ink(IVORY, 2.5); pips(0, 0, 36, openEnd()); X.restore();
      txt('OPEN END', ex, LINEY + 40, 13, '#fff', 'center', 90);
      X.save(); X.translate(last.x + TILEW / 4, LINEY); rr(-TILEW / 4 - 2, -TILEH / 2 - 2, TILEW / 2 + 4, TILEH + 4, 8); X.lineWidth = 4; X.strokeStyle = `rgba(255,207,51,${.6 + .4 * Math.sin(T * 7)})`; X.stroke(); X.restore();
    }
  }
  function judgeUI(T) {
    // the notepad: the plan of the four plays, [open end | new end]
    X.save(); X.translate(400, 424); X.rotate(-.012); rr(-290, -36, 580, 74, 8); ink('#fff7e6', 4); X.fillStyle = 'rgba(255,80,80,.25)'; X.fillRect(-286, -20, 572, 2); X.restore();
    txt('THE PLAN', 168, 426, 16, INK, 'center', 100);
    for (let k = 0; k < ROUNDS_N; k++) {
      const x = 250 + k * 118, done = k < rd, now_ = k === rd && !g.result;
      if (now_) { rr(x - 50, 399, 100, 50, 10); X.lineWidth = 4; X.strokeStyle = `rgba(255,207,51,${.6 + .4 * Math.sin(T * 6)})`; X.stroke(); }
      tile(x, 424, 80, 40, RO[k].E, RO[k].N, 0, false, null, false);
      if (done) { line([[x - 14, 424], [x - 4, 436], [x + 16, 408]], 5, '#22a447'); }
      txt(String(k + 1), x - 52, 402, 13, INK, 'center', 14);
    }
    txt('HINT: THE OTHER SIDE IS...', 224, 472, 14, '#fff', 'center', 260);
    for (const b of HNT) {
      const dn = g.c - (signAt[7 + b.c] || -9) < .15, d = dn ? 2 : 7;
      rr(b.x, b.y + 7, b.w, b.h, 16); ink('#7a2c1f', 4); rr(b.x, b.y + 7 - d, b.w, b.h, 16); ink(HCOL[b.c], 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(b.x + 10, b.y + 11 - d, b.w - 20, 8, 4); X.fill();
      txt(HINTS[b.c], b.x + b.w / 2, b.y + b.h / 2 + 4 - d, 18, INK, 'center', b.w - 18); keycap(b.x + 20, b.y + 13 - d, 'QWE'[b.c]);
    }
    txt('IT IS YOURS!', n === 4 ? 586 : 590, 472, 14, '#fff', 'center', 220);
    for (const b of DSG) {
      const dn = g.c - (signAt[10 + b.h] || -9) < .15, d = dn ? 2 : 7;
      rr(b.x, b.y + 7, b.w, b.h2, 16); ink('#7a2c1f', 4); rr(b.x, b.y + 7 - d, b.w, b.h2, 16); ink(cols(b.h + 1), 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(b.x + 10, b.y + 11 - d, b.w - 20, 8, 4); X.fill();
      txt(['A', 'B', 'C'][b.h], b.x + b.w / 2, b.y + b.h2 / 2 + 3 - d, 30, '#fff', 'center', b.w - 14); keycap(b.x + 14, b.y + 14 - d, 'ASD'[b.h]);
    }
  }
  function handUI(T) {
    const E_ = openEnd(), hl = handLayout();
    txt('I HAVE IT - THE OTHER SIDE:', 330, 394, 14, '#fff', 'center', 330);
    for (const b of SGN) {
      const dn = g.c - (signAt[b.k] || -9) < .15, d = dn ? 2 : 6;
      rr(b.x, b.y + 6, b.w, b.h, 14); ink('#7a4a22', 4); rr(b.x, b.y + 6 - d, b.w, b.h, 14); ink(b.k ? IVORY : '#d9d4ee', 4); X.fillStyle = 'rgba(255,255,255,.5)'; rr(b.x + 8, b.y + 9 - d, b.w - 16, 6, 3); X.fill();
      if (b.k) pips(b.x + b.w / 2, b.y + b.h / 2 + 3 - d, 42, b.k); else { emo('🤷', b.x + 24, b.y + b.h / 2 + 3 - d, 24); txt('NO TENGO!', b.x + 78, b.y + b.h / 2 + 4 - d, 13, INK, 'center', 78); }
      keycap(b.x + 15, b.y + 10 - d, String(b.k));
    }
    const mt = pend && !dead.has(pend.id);
    hl.forEach((q, i) => {
      const dd = dead.has(q.id), fit = fits(q.id, E_) && !dd, lift = fit ? -4 + Math.sin(T * 6 + i) * 2 : 0, pen = mt && pend.id === q.id;
      tile(q.x, q.y + lift - (pen ? 16 : 0), q.w, q.h, q.a, q.b, 0, false, fit ? `rgba(255,207,51,${.75 + .25 * Math.sin(T * 7)})` : null, dd);
      keycap(q.x, q.y + q.h / 2 + 22, 'QWER'[i]);
    });
  }
  g.draw = function (tm) {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
    chalk(T);
    viejo(T, won, lost, rk);
    for (let r = 0; r < n; r++) person(r, T, won, lost);
    hudLine(T, won, lost, rk);
    for (let r = 0; r < n; r++) if (signs[r]) signBubble(r, signs[r]);
    if (!g.result) { if (judge) judgeUI(T); else handUI(T); }
    if (!g.result && T < 2.6) badge(judge ? 'SIGN THE HINT!' : 'PLAY THE RIGHT TILE!', 400, 118, 20, judge ? '#22a447' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
    for (const q of pops) { const a = T - q.t0; badge(q.s, q.x, q.y - a * 26, q.size, q.bgc, '#fff', a < .2 ? outBack(a / .2) : 1); }
    if (won && rk >= 0) {
      if (rk > .14 && !slammed) { slammed = true; shake(10, .3); sfx.thud(); burst(150, 270, '#ffe14d', 18, 300); }
      for (let i = 0; i < 14; i++) { const d = rk - .14 - hash(i + 2) * .3; if (d < 0) continue; tile(150 + (hash(i) - .2) * 600 * d, 270 - d * 300 + 620 * d * d, 30, 15, 1 + i % 6, 1 + (i * 5) % 6, d * 6 + i); }
      if (rk > .2) badge('DOMINÓ!', 400, 118, 46, '#22a447', '#fff', outBack((rk - .2) / .25), -.04);
    } else if (lost && rk > .3) {
      badge(why === 2 ? "TIME'S UP!" : 'TWO BAD TILES!', 400, 118, 36, '#e8343d', '#fff', outBack((rk - .3) / .25), .04);
      if (why !== 2 && rk > .9) badge('THE OLD MAN LEFT!', 400, 168, 22, '#ffb020', '#fff', outBack((rk - .9) / .25), -.03);
    }
    vignette(.14);
  };
  g.dbg = {
    view: () => {
      const base = { me, n, hands: NH, rd, strikes, E: rd < ROUNDS_N ? RO[rd].E : null, signs: live(), result: g.result || null };
      if (judge) { const q = rd < ROUNDS_N ? RO[rd] : null; return Object.assign(base, { plan: RO.map(r => ({ E: r.E, N: r.N })), target: q ? { E: q.E, N: q.N, id: q.tgt } : null }); }
      return Object.assign(base, { tiles: handLayout().map(q => { const e = rd < ROUNDS_N ? RO[rd].E : 0, f = fits(q.id, e); return { id: q.id, a: q.a, b: q.b, x: q.x, y: q.y, fit: f, other: f ? other(q.id, e) : 0, dead: dead.has(q.id) }; }), pending: !!pend });
    },
    RO, sign,
  };
  wire(g, D, 0, sp, 'sq_domino');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, tm) {
  X = ctx;
  X.fillStyle = '#f4b87a'; X.fillRect(0, 0, 520, 90); X.fillStyle = '#d9d2c2'; X.fillRect(0, 90, 520, 150); X.fillStyle = INK; X.fillRect(0, 88, 520, 5);
  for (let i = 0; i < 9; i++) { const x0 = i * 64 - 6; X.beginPath(); X.moveTo(x0, 0); X.lineTo(x0 + 64, 0); X.lineTo(x0 + 64, 12); X.arc(x0 + 32, 12, 32, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff7e6' : RED, 2.5); }
  rr(30, 100, 460, 160, 26); ink(RED, 4); X.fillStyle = 'rgba(255,255,255,.2)'; rr(46, 106, 428, 8, 4); X.fill();
  const u = tm % 4, k = Math.floor(u);
  tile(180, 132, 56, 28, 2, 4, 0, false); tile(240, 132, 56, 28, 4, 3, 0, false);
  X.beginPath(); X.arc(310, 132, 20, 0, TAU); ink(GOLD, 3); X.beginPath(); X.arc(310, 132, 15, 0, TAU); ink(IVORY, 2); pips(310, 132, 28, 3);
  caos(260, 96, 2.3, { col: COLS[role] });
  if (role === 0) {
    for (let c = 0; c < 3; c++) { const on = c === 2 && u % 2 < 1; rr(70 + c * 130, 180 - (on ? 3 : 0), 120, 46, 14); ink(HCOL[c], 3); txt(HINTS[c], 130 + c * 130, 204 - (on ? 3 : 0), 17, INK, 'center', 104); }
    demoFinger(330, 214, u % 2 < 1, (u % 1) * 1.6);
    tile(410, 160, 64, 32, 3, 5, 0, false); badge('SIGN THE HINT!', 260, 56, 15, '#22a447', '#fff', 1, -.03);
  } else {
    const hv = [[3, 5], [1, 6], [2, 2], [3, 4]].slice(0, 3 + (n === 3 ? 1 : 0)); hv.forEach(([a, b], i) => tile(70 + i * 112, 206, 100, 50, a, b, 0, false, (a === 3 || b === 3) ? GOLD : null));
    for (let q = 1; q <= 3; q++) { rr(60 + q * 34, 150, 30, 24, 6); ink(IVORY, 2); pips(75 + q * 34, 162, 24, q + 2 * (q > 1)); }
    demoFinger(160, 220, u % 1 < .5, (u % 1) * 2); badge('PLAY THE RIGHT TILE!', 260, 56, 15, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_domino', sqDomino, 'DOMINÓ DE ESQUINA'); REGMAP.sq_domino.duo = true; REGMAP.sq_domino.squad = true;
DUO.INFO.sq_domino = n => [
  ['TABLE', 'SIGN THE PLAN, POINT AT WHO PLAYS', 'Q W E / A S D / TAP'],
  ['HAND A', 'SIGN WHAT YOU HOLD, PLAY THE RIGHT TILE', '1-6 0 / Q W E R / TAP'],
  ['HAND B', 'SIGN WHAT YOU HOLD, PLAY THE RIGHT TILE', '1-6 0 / Q W E R / TAP'],
  ['HAND C', 'SIGN WHAT YOU HOLD, PLAY THE RIGHT TILE', '1-6 0 / Q W E R / TAP'],
].slice(0, n);
DUO.DEMOS.sq_domino = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
