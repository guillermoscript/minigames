'use strict';
/* ═════════ SQUAD · RADIO BEMBA (sq_bemba), 3-4 players, one role each ═════════
   A market queue and a rumour that travels from ear to ear (the "teléfono dañado"). The first ear is shown a picture (the bombona, the bread, the flour...)
   and has to say it with one of four phrases. Every next ear only hears the previous phrase, with a bit of it eaten by static, and has to say it again with
   ITS OWN list of phrases (each hop speaks a different dialect). The last ear hears the final phrase and picks the picture the neighbour will shout
   through her megaphone: "¡LLEGÓ LA BOMBONA!". Three rumours per game, two right ones win, two wrong ones lose. The players are expected to talk out loud.
   n = 3:  role 0 STARTER (sees the picture), role 1 EAR (hears list 0, speaks list 1), role 2 LAST EAR (JUDGE: hears list 1, picks the picture).
   n = 4:  one more EAR in the middle (role 2 hears list 1, speaks list 2); the LAST EAR (role 3, JUDGE) hears list 2.
   The level (pictures, the four candidates of each rumour, the order of every card, which parts of every phrase are eaten by static) is drawn from mkR() in
   the constructor, always the same number of draws, so it is identical on every screen whatever n / role.
   Netcode: every role owns its variables, the others render them, and absolute values are re-sent every 0.5 s:
     EARS (0..n-2)  'say' [round, role, meaning]   (what I passed on in this round: only the next ear shows it; everybody animates the whisper)
     LAST EAR       'rd'  [round, score, wrong, chosen, ok, resolvedRound]   (the verdict of the last rumour and the round everybody plays now)
   Nobody can jump ahead: an ear can only speak after the previous ear's message of THIS round arrived, and a round only advances when the judge says so. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only

const NR = 3, NEED = 2, MAXBAD = 2, SY = 322;
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const NAMES = ['STARTER', 'EAR 1', 'EAR 2', 'LAST EAR'];
const ICON_N = ['GAS CYLINDER', 'BREAD', 'FLOUR', 'CHICKEN', 'EGGS', 'COOKING OIL'];
const ICON_THE = ['THE GAS CYLINDER', 'THE BREAD', 'THE FLOUR', 'THE CHICKEN', 'THE EGG CARTON', 'THE OIL'];
const CREAM = '#fff7e6', CREAM2 = '#e8d9b5', CHALK = '#2f5d50', CHALK2 = '#24493f', WOODC = '#c98443', WOODD = '#9a5f2c', RED = '#e8434f', RED2 = '#b8283a', TEAL = '#2fb5a4';
/* the three dialects. PH[list][icon] = three chunks; no chunk repeats inside a list, so any chunk that survives the static gives the phrase away */
const PH = [
  [['THE ROUND ONE', 'WEIGHS A TON', 'FOR THE STOVE'], ['LONG AND CRUSTY', 'FROM THE BAKERY', 'FOR BREAKFAST'], ['WHITE SACK', 'FOR AREPAS', 'DUST EVERYWHERE'],
   ['HAS FEATHERS', 'CLUCK CLUCK', 'SUNDAY ROAST'], ['VERY FRAGILE', 'SOLD BY THE DOZEN', 'HAVE A SHELL'], ['SLIPPERY STUFF', 'GOLDEN COLOUR', 'FOR THE FRYING PAN']],
  [['ORANGE TANK', 'SMELLS LIKE GAS', 'FILLED EVERY MONTH'], ['A CANILLA', 'STILL WARM', 'WITH HAM AND CHEESE'], ['CORN DOUGH', 'HAS TO BE KNEADED', 'WHITE POWDER'],
   ['WINGS AND LEGS', 'FOR THE SOUP POT', 'PEEP PEEP'], ['FOR THE OMELETTE', 'YOLK INSIDE', 'CARTON OF THIRTY'], ['BOTTLE OF GOLD', 'POUR A LITTLE', 'IT SIZZLES']],
  [['THE NEIGHBOUR WANTS IT', 'ROLLS DOWN THE STAIRS', 'LIGHTS THE BURNER'], ['BAKERY QUEUE', 'GOLDEN CRUST', 'CRUMBS EVERYWHERE'], ['TWO KILOS', 'IT SNOWS WHITE', 'TORN SACK'],
   ['LUNCH ON SUNDAY', 'RED COMB', 'FLAPS AND RUNS'], ['CRACK ONE', 'OVAL AND SMOOTH', 'SITS IN A TRAY'], ['SLIPS FROM YOUR HANDS', 'LITRE BOTTLE', 'FRIES THE EMPANADA']],
];
const MASKED = 'KRRSHH!';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(build, base, shade, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 24);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(520, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 520);
  X.restore();
}

/* the six pictures, drawn around (x, y) at scale s (about 90 px tall at s = 1) */
function icon(id, x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s);
  if (id === 0) {                                                  // gas cylinder
    rr(-9, -50, 18, 12, 4); ink('#9aa3b2', 3); X.beginPath(); X.arc(0, -52, 11, Math.PI, 0); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#9aa3b2'; X.stroke();
    cel(() => rr(-27, -42, 54, 88, 22), '#f39a2c', '#c4631a', 7, 8, 4);
    rr(-27, -6, 54, 26, 2); ink('#fff7e6', 3); txt('GAS', 0, 8, 18, RED2, 'center', 44);
    X.fillStyle = 'rgba(255,255,255,.45)'; rr(-20, -34, 7, 30, 3); X.fill();
  } else if (id === 1) {                                           // canilla bread
    X.rotate(-.45);
    cel(() => rr(-46, -17, 92, 34, 17), '#e9a94a', '#b9742a', 4, 7, 4);
    for (let i = -1; i <= 1; i++) { X.beginPath(); X.moveTo(i * 24 - 6, -10); X.lineTo(i * 24 + 6, 8); X.lineWidth = 4; X.strokeStyle = '#8a4f1e'; X.lineCap = 'round'; X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.4)'; rr(-36, -12, 34, 6, 3); X.fill();
  } else if (id === 2) {                                           // flour sack
    X.beginPath(); X.moveTo(-30, -34); X.quadraticCurveTo(-34, 6, -30, 40); X.quadraticCurveTo(0, 50, 30, 40); X.quadraticCurveTo(34, 6, 30, -34); X.quadraticCurveTo(0, -42, -30, -34); X.closePath();
    cel(() => { X.beginPath(); X.moveTo(-30, -34); X.quadraticCurveTo(-34, 6, -30, 40); X.quadraticCurveTo(0, 50, 30, 40); X.quadraticCurveTo(34, 6, 30, -34); X.quadraticCurveTo(0, -42, -30, -34); X.closePath(); }, '#fff9ea', '#d9ceb0', 7, 4, 4);
    tri(-16, -36, -4, -52, 6, -36, '#fff9ea', 3); tri(2, -36, 14, -50, 24, -36, '#fff9ea', 3);
    rr(-30, -8, 60, 28, 3); ink('#ffd23f', 3); txt('FLOUR', 0, 6, 15, RED2, 'center', 52);
  } else if (id === 3) {                                           // chicken
    el(0, 6, 34, 28, -.1); cel(() => el(0, 6, 34, 28, -.1), '#fff3e0', '#d9c3a0', 6, 7, 4);
    line([[-8, 30], [-10, 46]], 4, '#f2a33a'); line([[8, 30], [10, 46]], 4, '#f2a33a'); line([[-16, 46], [-4, 46]], 3, '#f2a33a'); line([[2, 46], [14, 46]], 3, '#f2a33a');
    X.beginPath(); X.arc(26, -26, 17, 0, TAU); ink('#fff3e0', 4);
    for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(20 + i * 6, -43 + (i === 1 ? -3 : 0), 5, 0, TAU); ink(RED, 2.5); }
    tri(40, -28, 54, -23, 40, -19, '#f2a33a', 2.5); X.beginPath(); X.arc(31, -30, 3.2, 0, TAU); X.fillStyle = INK; X.fill();
    X.beginPath(); X.arc(30, -14, 4, 0, TAU); ink(RED, 2);
    el(-8, 6, 17, 11, -.5); ink('#f1dfc4', 3);
  } else if (id === 4) {                                           // egg carton
    cel(() => rr(-44, 6, 88, 32, 8), '#c9b48a', '#9a8660', 4, 6, 4);
    for (const ex of [-26, 0, 26]) { el(ex, -6, 14, 18); ink('#fffaf0', 3); X.fillStyle = 'rgba(255,255,255,.7)'; el(ex - 4, -12, 3.5, 6, -.4); X.fill(); }
    rr(-44, 14, 88, 24, 8); ink('#b9a279', 3);
  } else {                                                         // cooking oil
    rr(-9, -50, 18, 14, 4); ink(RED, 3);
    cel(() => { rr(-23, -38, 46, 84, 14); }, '#ffd23f', '#e0a416', 6, 5, 4);
    rr(-23, -4, 46, 30, 3); ink(CREAM, 3); X.beginPath(); X.arc(0, 11, 8, 0, TAU); ink('#ffd23f', 2.5);
    X.fillStyle = 'rgba(255,255,255,.5)'; rr(-17, -32, 6, 24, 3); X.fill();
  }
  X.restore();
}
/* the market, painted once */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, '#9fdcf5'); g.addColorStop(1, '#ffe7b8'); X.fillStyle = g; X.fillRect(0, 0, W, 240);
  // houses behind the stalls
  for (const [hx, hw, hh, c] of [[0, 150, 130, '#f6a8b8'], [140, 130, 110, '#ffd36b'], [250, 190, 150, '#9be3cf'], [430, 140, 120, '#b9a8f0'], [560, 90, 100, '#ffb98a']]) { rr(hx, 232 - hh, hw, hh, 6); ink(c, 4); X.fillStyle = 'rgba(255,255,255,.28)'; X.fillRect(hx + 8, 232 - hh + 8, 10, hh - 16); }
  // the stalls: counters with crates
  for (const [sx, c1] of [[28, '#2fb5a4'], [236, '#ffc93c'], [444, '#ff8fb1']]) {
    rr(sx, 150, 190, 66, 6); ink(WOODC, 4);
    for (let i = 0; i < 5; i++) { X.beginPath(); X.arc(sx + 28 + i * 34, 146, 13, 0, TAU); ink(['#ff8a3d', '#7cd96a', '#ff5c5c', '#ffd23f', '#a678e8'][(i + sx) % 5], 3); }
    for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(sx - 6 + i * 33, 96); X.lineTo(sx - 6 + (i + 1) * 33, 96); X.lineTo(sx - 6 + (i + 1) * 33, 120); X.arc(sx - 6 + i * 33 + 16.5, 120, 16.5, 0, Math.PI); X.closePath(); ink(i % 2 ? CREAM : c1, 3); }
    line([[sx + 2, 96], [sx + 2, 214]], 4, WOODD); line([[sx + 186, 96], [sx + 186, 214]], 4, WOODD);
  }
  // hanging flags
  line([[0, 22], [260, 40], [520, 22], [800, 40]], 2, '#6c5a3a');
  for (let i = 0; i < 17; i++) { const fx = i * 50 + 12, fy = 22 + (Math.sin((i * 50) / 260 * Math.PI) * 0) + (i % 2 ? 6 : 0); tri(fx - 8, fy + 2, fx + 8, fy + 2, fx, fy + 20, ['#ff5c5c', '#ffd23f', '#2fb5a4', '#6EA8FE'][i % 4], 2); }
  // the street, the curb, the paving
  X.fillStyle = '#d2c6a4'; X.fillRect(0, 232, W, 14); X.fillStyle = INK; X.fillRect(0, 230, W, 4); X.fillRect(0, 244, W, 3);
  g = X.createLinearGradient(0, 247, 0, H); g.addColorStop(0, '#e9dcbc'); g.addColorStop(1, '#c9b48a'); X.fillStyle = g; X.fillRect(0, 247, W, H - 247);
  X.strokeStyle = 'rgba(120,90,50,.26)'; X.lineWidth = 3;
  for (let r = 0; r < 6; r++) { const y = 262 + r * r * 3 + r * 17; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let c = -8; c <= 16; c++) { X.beginPath(); X.moveTo(400 + (c - 4) * 40, 247); X.lineTo(400 + (c - 4) * 105, 372); X.stroke(); }
  X.fillStyle = 'rgba(20,16,28,.2)'; el(400, 330, 380, 14); X.fill();
  // the wooden counter with a chalkboard where the cards go
  rr(14, 372, 772, 222, 22); ink(WOODC, 5); X.fillStyle = WOODD; rr(22, 380, 756, 206, 16); X.fill(); X.fillStyle = 'rgba(255,255,255,.22)'; rr(30, 384, 740, 8, 4); X.fill();
  rr(30, 392, 740, 184, 12); ink(CHALK, 4); X.fillStyle = CHALK2; rr(36, 398, 728, 172, 9); X.fill();
  X = old; return cv2;
}
function dog(x, y, T, bread) {
  const bob = Math.abs(Math.sin(T * 14)) * 2, d = 1;
  line([[x - 20, y - 14], [x - 28, y - 24 + Math.sin(T * 20) * 4]], 4, '#a8672f');
  el(x, y - 12 - bob, 22, 11); cel(() => el(x, y - 12 - bob, 22, 11), '#c98443', '#9a5f2c', 3, 5, 3);
  X.beginPath(); X.arc(x + 22 * d, y - 18 - bob, 10, 0, TAU); ink('#c98443', 3);
  el(x + 17, y - 27 - bob, 4, 7, -.3); ink('#8a4f1e', 2);
  X.fillStyle = INK; X.beginPath(); X.arc(x + 26, y - 20 - bob, 2, 0, TAU); X.fill(); X.beginPath(); X.arc(x + 33, y - 17 - bob, 3, 0, TAU); X.fill();
  for (const lx of [-12, 8]) line([[x + lx, y - 6], [x + lx + Math.sin(T * 14 + lx) * 5, y]], 4, '#9a5f2c');
  if (bread) icon(1, x + 36, y - 14 - bob, .32);
}
function neighbour(x, y, mood, T, jump) {                          // the neighbour in her window: rollers, megaphone
  rr(x - 82, y - 78, 164, 156, 8); ink('#8a5a3c', 5); X.fillStyle = '#ffe9a0'; rr(x - 74, y - 70, 148, 140, 4); X.fill();
  X.fillStyle = '#c45470'; rr(x - 84, y + 62, 168, 14, 4); X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  const hy = y - 4 - jump;
  rr(x - 34, hy + 22, 68, 54, 16); ink('#ff8fb1', 3);
  X.beginPath(); X.arc(x, hy, 31, 0, TAU); ink('#ffd2a8', 3);
  for (let i = -2; i <= 2; i++) { rr(x + i * 11 - 6, hy - 40, 12, 22, 6); ink(i % 2 ? '#7cd0ff' : '#ff9cc8', 2.5); }
  X.fillStyle = '#fff'; for (const sx of [-1, 1]) { X.beginPath(); X.arc(x + sx * 11, hy - 4, 6.5, 0, TAU); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(x + sx * 11 - 2, hy - 3, 2.8, 0, TAU); X.fill(); X.fillStyle = '#fff'; }
  if (mood === 'shout') { el(x - 4, hy + 15, 8, 9 + Math.sin(T * 30) * 2); ink('#7a1f2e', 2); }
  else if (mood === 'happy') { X.beginPath(); X.arc(x - 2, hy + 12, 9, 0, Math.PI); ink('#7a1f2e', 2); }
  else if (mood === 'sad') { X.beginPath(); X.arc(x - 2, hy + 22, 8, Math.PI, 0); ink(null, 2); }
  else line([[x - 9, hy + 16], [x + 5, hy + 16]], 3, INK);
  if (mood === 'shout' || mood === 'happy') {                      // the megaphone, pointed at the queue
    X.save(); X.translate(x - 34, hy + 20); X.rotate(-.3); X.beginPath(); X.moveTo(0, -6); X.lineTo(-40, -22); X.lineTo(-40, 22); X.lineTo(0, 6); X.closePath(); ink(RED, 3); rr(-5, -8, 14, 16, 3); ink('#fff7e6', 3); X.restore();
  }
}
const COMB = ['#7cd0ff', '#ff9cc8'];

/* ═════════ the game ═════════ */
function sqBemba(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, judge = me === n - 1, first = me === 0;
  /* the level, identical on every screen: same number of draws whatever the role */
  const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
  const perm = shuf([0, 1, 2, 3, 4, 5]), target = perm.slice(0, NR), cand = [], ord = [], mask = [];
  for (let r = 0; r < NR; r++) {
    cand.push(shuf([target[r]].concat(shuf(perm.filter(i => i !== target[r])).slice(0, 3))));
    ord.push([0, 1, 2, 3].map(() => shuf([0, 1, 2, 3])));         // ord[r][role] = which candidate sits on each card
    mask.push([0, 1, 2].map(h => { const nm = h === n - 2 ? 2 : 1, sel = shuf([0, 1, 2]).slice(0, nm); return [0, 1, 2].map(c => sel.includes(c)); }));   // mask[r][h][chunk]: eaten by static in the phrase of list h
  }
  const cols = i => (D.byRole && D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole && D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  /* state */
  let round = 0, score = 0, wrong = 0, lastRd = null, rs = 0, resAt = -1, endFx = false;
  const out = {}, inbox = {}, hearAt = {}, passed = {}, outAt = {}, picked = {};
  let lastAt = -9, lastIcon = 0, lastOk = true, lastTarget = 0, cause = 0, selJ = -1, hist = [];
  const pops = []; function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  const chosenId = j => cand[Math.min(round, NR - 1)][ord[Math.min(round, NR - 1)][me][j]];
  const ready = () => round < NR && !g.result && (first || inbox[round] !== undefined) && (judge ? picked[round] === undefined : out[round] === undefined);
  /* what this ear hears: the phrase of the previous list with some chunks replaced by static (null) */
  function heard() {
    if (first || inbox[round] === undefined) return null; const ph = PH[me - 1][inbox[round]], mk = mask[Math.min(round, NR - 1)][me - 1];
    return ph.map((c, i) => mk[i] ? null : c);
  }
  function cardRect(j) { return judge ? { x: 46 + j * 176, y: 410, w: 164, h: 150 } : { x: 46 + (j & 1) * 354, y: 408 + (j >> 1) * 78, w: 344, h: 70 }; }
  function optsView() { return [0, 1, 2, 3].map(j => { const m = chosenId(j), r0 = cardRect(j); return judge ? { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2, id: m } : { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2, chunks: PH[me][m].slice() }; }); }
  function sendRd() { if (judge && lastRd) D.send('rd', lastRd); }
  function pick(j) {
    if (!ready() || j < 0 || j > 3) return; const m = chosenId(j); selJ = j;
    if (!judge) { out[round] = m; outAt[round] = g.c; passed[round] = passed[round] || {}; passed[round][me] = g.c; D.send('say', [round, me, m]); snd(520 + j * 70, .1, 'triangle', .07); noise(.08, .05, 1500, 3000, 'bandpass'); return; }
    picked[round] = m; const ok = m === target[round], rd = round; if (ok) score++; else wrong++;
    lastAt = g.c; lastIcon = m; lastOk = ok; lastTarget = target[rd]; hist.push(ok ? 1 : 0); round++; selJ = -1;
    lastRd = [round, score, wrong, m, ok ? 1 : 0, rd]; sendRd(); rs = 0;
    if (ok) { snd(660, .1, 'triangle', .07); snd(880, .16, 'triangle', .07, .09); } else { sfx.miss(); shake(4, .12); }
    if (score >= NEED) g.finish('win'); else if (wrong >= MAXBAD) { cause = 1; g.finish('lose'); }
  }
  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: judge ? 'NAME IT!' : first ? 'WHISPER IT!' : 'PASS IT ON!', roleLabel: NAMES[first ? 0 : judge ? 3 : me],
    hint: first ? 'TELL THE NEXT EAR WHAT YOUR PICTURE IS: PICK THE PHRASE THAT SAYS IT (CLICK OR KEYS 1-4) - TALK OUT LOUD'
      : judge ? 'WORK OUT WHAT THE RUMOUR MEANS AND PICK THE PICTURE (CLICK OR KEYS 1-4) - TALK OUT LOUD'
      : 'THE STATIC EATS PART OF WHAT YOU HEAR: PICK THE PHRASE THAT MEANS THE SAME (CLICK OR KEYS 1-4) - TALK OUT LOUD',
    thint: first ? 'TELL THE NEXT EAR WHAT YOUR PICTURE IS: TAP THE PHRASE THAT SAYS IT - TALK OUT LOUD'
      : judge ? 'WORK OUT WHAT THE RUMOUR MEANS AND TAP THE PICTURE - TALK OUT LOUD'
      : 'THE STATIC EATS PART OF WHAT YOU HEAR: TAP THE PHRASE THAT MEANS THE SAME - TALK OUT LOUD',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt; if (g.result && resAt < 0) resAt = g.c;
      if (!g.result) {
        rs += dt; if (rs >= .5) { rs = 0; if (judge) sendRd(); else if (round < NR && out[round] !== undefined) D.send('say', [round, me, out[round]]); }
        if (judge && g.c >= g.limit) { cause = 2; g.finish('lose'); }
      }
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); for (let i = 0; i < 4; i++) noise(.05, .1, 1800, 3000, 'bandpass', i * .09); }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(300, .5, 'sawtooth', .06, 0, 90); noise(.4, .12, 400, 2400, 'bandpass'); shake(6, .25); }
      while (pops.length && g.c - pops[0].t0 > 1.0) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'say' && Array.isArray(d)) {
        const r = d[0] | 0, f = d[1] | 0, m = d[2] | 0; if (r < 0 || r >= NR || f < 0 || f >= n - 1 || f !== from) return;
        passed[r] = passed[r] || {}; if (passed[r][f] === undefined) passed[r][f] = g.c;
        if (f === me - 1 && inbox[r] === undefined) { inbox[r] = m; hearAt[r] = g.c; if (r === round) noise(.25, .09, 700, 2600, 'bandpass'); }
      } else if (type === 'rd' && Array.isArray(d) && !judge) {
        const nr = d[0] | 0; if (nr <= round) return;
        round = Math.min(nr, NR); score = d[1] | 0; wrong = d[2] | 0; lastIcon = d[3] | 0; lastOk = !!d[4]; lastTarget = target[clamp(d[5] | 0, 0, NR - 1)]; lastAt = g.c; hist.push(lastOk ? 1 : 0); selJ = -1;
        if (lastOk) { snd(660, .1, 'triangle', .06); } else { sfx.miss(); }
        if (wrong >= MAXBAD) cause = 1;
      }
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', over = !!g.result, lostG = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      const cx0 = n === 4 ? [130, 300, 500, 670] : [150, 400, 650], rd = Math.min(round, NR - 1);
      // the queue sign, the rumour tokens and the clock
      line([[110, 36], [110, 62]], 3, INK); line([[250, 36], [250, 62]], 3, INK); rr(80, 58, 196, 52, 12); ink(CREAM, 4);
      txt('RUMOURS', 178, 74, 14, RED2, 'center', 150);
      for (let i = 0; i < NR; i++) { const hx = 122 + i * 56, st = hist[i] !== undefined ? hist[i] : (i < score + wrong ? (i < score ? 1 : 0) : -1); X.beginPath(); X.arc(hx, 94, 11, 0, TAU); ink(st === 1 ? '#22a447' : st === 0 ? '#e8343d' : '#d9d2c0', 3); if (st >= 0) txt(st ? 'OK' : 'X', hx, 95, 11, '#fff', 'center', 18); }
      const frac = clamp(T / Math.max(1, g.limit), 0, 1);
      X.beginPath(); X.arc(318, 84, 28, 0, TAU); ink(CREAM, 4); X.beginPath(); X.moveTo(318, 84); X.arc(318, 84, 22, -Math.PI / 2, -Math.PI / 2 + TAU * frac); X.closePath(); X.fillStyle = frac > .75 ? RED : '#ffd23f'; X.fill();
      X.beginPath(); X.arc(318, 84, 3.5, 0, TAU); X.fillStyle = INK; X.fill();
      // the neighbour and her megaphone
      const sh = T - lastAt < 1.5 && lastAt > -5, nm = won ? 'happy' : lostG ? 'sad' : sh ? 'shout' : null;
      neighbour(706, 126, nm, T, won ? Math.abs(Math.sin(T * 8)) * 8 : 0);
      // a stray dog with a bread, crossing behind the crew
      { const dx = ((T * 55 + 120) % 1050) - 120; dog(dx, 352, T, true); }
      // the queue: each ear with its chair-less spot, the whisper waves between them
      for (let r = 0; r < n; r++) {
        const x = cx0[r], jig = won ? -Math.abs(Math.sin(T * 9 + r)) * 10 : 0, run = lostG && rk > .5 ? clamp((rk - .5) * 380, 0, 520) : 0, mood = won ? 'happy' : lostG ? 'sad' : null;
        shadow(x + run, SY + 3, 30, 7, .22); caos(x + run, SY + jig, 3.7, { col: cols(r), mood, run: run ? T : null });
        if (!run) pill(x, 244, r === me ? 'YOU' : name(r), cols(r));
        if (!run) txt(NAMES[r === 0 ? 0 : r === n - 1 ? 3 : r], x, 266, 13, '#fff', 'center', 110);
      }
      for (let r = 0; r < n - 1; r++) {
        const a = cx0[r] + 36, b = cx0[r + 1] - 36, pa = passed[rd] && passed[rd][r] !== undefined, k = pa ? clamp((T - passed[rd][r]) / .6, 0, 1) : 0, my = 296, col = pa ? '#ffe14d' : 'rgba(255,255,255,.55)';
        for (let q = 0; q < 3; q++) { const qx = a + (b - a) * (.2 + q * .3), a0 = pa && k < 1 ? clamp(1 - Math.abs((k * 1.4) - (.2 + q * .3)) * 3, 0, 1) : (pa ? .5 : 0); X.beginPath(); X.arc(qx - 10, my, 10 + q * 3, -.9, .9); X.lineWidth = 7; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 4; X.strokeStyle = pa ? `rgba(255,225,77,${.45 + a0 * .55})` : col; X.stroke(); }
      }
      // ───── the bubble above the crew: what this role sees ─────
      if (!over) {
        const bx = 36, by = 112, bw = 560, bh = 104, tx = clamp(cx0[me], 120, 520);
        tri(tx - 16, by + bh - 2, tx + 16, by + bh - 2, tx, 236, CREAM, 3); rr(bx, by, bw, bh, 26); ink(CREAM, 4); X.fillStyle = CREAM; X.fillRect(tx - 14, by + bh - 6, 28, 8);
        X.fillStyle = 'rgba(255,255,255,.55)'; rr(bx + 16, by + 8, bw - 32, 8, 4); X.fill();
        if (first) {
          txt(round < NR ? 'YOUR SECRET PICTURE:' : '...', bx + bw / 2, by + 20, 14, RED2, 'center', 330);
          if (round < NR) { const ap = outBack((T - Math.max(0, (round ? lastAt : 0))) / .3); icon(target[round], bx + 120, by + 64, .78 * clamp(ap, .1, 1.1)); txt(ICON_N[target[round]], bx + 330, by + 66, 34, RED2, 'center', 300); }
        } else {
          const hr = heard(), calm = round >= NR;
          if (!hr) {
            txt('WAITING FOR THE RUMOUR...', bx + bw / 2, by + 36, 22, '#8f88a6', 'center', 440);
            for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(bx + bw / 2 - 28 + i * 28, by + 74 + Math.sin(T * 6 + i) * 4, 7, 0, TAU); ink('#8f88a6', 2.5); }
          } else {
            txt('YOU HEARD...', bx + bw / 2, by + 20, 14, RED2, 'center', 330);
            const st = clamp((T - (hearAt[round] === undefined ? 0 : hearAt[round])) / .25, 0, 1), done = !calm && (judge ? picked[round] !== undefined : out[round] !== undefined);
            X.globalAlpha = done ? .45 : 1;
            hr.forEach((c, i) => {
              const cy = by + 42 + i * 22, w = 200 + st * 0;
              if (c) txt(c, bx + bw / 2, cy, 21, INK, 'center', 500);
              else { rr(bx + bw / 2 - w / 2, cy - 11, w, 22, 11); ink('#6b6780', 2.5); X.save(); X.clip(); for (let q = 0; q < 14; q++) { X.fillStyle = hash(Math.floor(T * 24) + q * 3.1 + i * 9) > .5 ? '#c9c5d8' : '#44415a'; X.fillRect(bx + bw / 2 - w / 2 + q * w / 14, cy - 11, w / 14 + 1, 22); } X.restore(); txt(MASKED, bx + bw / 2 + Math.sin(T * 40 + i) * 3, cy + 1, 16, '#fff', 'center', 150); }
            });
            X.globalAlpha = 1;
          }
        }
      }
      // ───── the cards of this role on the chalkboard ─────
      if (!over) {
        const rdy = ready();
        for (let j = 0; j < 4; j++) {
          const r0 = cardRect(j), m = chosenId(j), sel = selJ === j && (judge ? false : out[round] !== undefined), dn = !rdy && !sel;
          X.globalAlpha = dn ? .5 : 1; rr(r0.x, r0.y + 5, r0.w, r0.h, 14); ink('#7a5a30', 3); rr(r0.x, r0.y, r0.w, r0.h, 14); ink(sel ? '#ffe14d' : CREAM, 4);
          X.fillStyle = 'rgba(255,255,255,.5)'; rr(r0.x + 10, r0.y + 5, r0.w - 20, 6, 3); X.fill();
          if (judge) { icon(m, r0.x + r0.w / 2, r0.y + 62, .92); txt(ICON_N[m], r0.x + r0.w / 2, r0.y + r0.h - 17, 17, RED2, 'center', r0.w - 14); }
          else PH[me][m].forEach((c, i) => txt(c, r0.x + r0.w / 2 + 6, r0.y + 17 + i * 18, 15, INK, 'center', r0.w - 50));
          if (!TOUCH) { X.beginPath(); X.arc(r0.x + 16, r0.y + 17, 11, 0, TAU); ink('#fff', 2); txt(String(j + 1), r0.x + 16, r0.y + 18, 14, INK); }
          X.globalAlpha = 1;
        }
        if (!rdy && !over && round < NR) txt(first ? '...' : 'WAIT FOR THE EAR BEFORE YOU', 400, 396, 15, 'rgba(255,255,255,.75)', 'center', 700);
      }
      // ───── the neighbour shouts through the megaphone ─────
      if (sh && !over) {
        const k = outBack((T - lastAt) / .22), a = clamp((lastAt + 1.5 - T) / .25, 0, 1);
        X.save(); X.globalAlpha = a; X.translate(330, 44); X.scale(k, k); rr(-300, -26, 600, 56, 28); ink(lastOk ? '#fff' : '#ffe9e9', 4); tri(300, -4, 340, 6, 296, 20, lastOk ? '#fff' : '#ffe9e9', 3);
        icon(lastIcon, -262, 8, .42);
        txt(t('IT ARRIVED: {n}!', { n: t(ICON_THE[lastIcon]) }), 18, 4, 26, lastOk ? '#22a447' : '#e8343d', 'center', 470);
        X.restore();
      }
      if (!over && T < 2.4) badge(judge ? 'NAME THE PICTURE!' : first ? 'START THE RUMOUR!' : 'PASS IT ON!', 400, 292, 20, judge ? '#22a447' : '#2b9ee6', '#fff', outBack(T / .25), -.03);
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      // drawn payoffs
      if (over && rk >= 0) {
        if (won) {
          for (let i = 0; i < 14; i++) { const d = rk - hash(i + 2) * .6; if (d < 0) continue; const fx = 40 + hash(i) * 720 + Math.sin(d * 4 + i) * 14, fy = -30 + d * (210 + hash(i + 7) * 90); if (fy < 600) icon(i % 6, fx, fy, .4); }
          if (rk > .25) badge('RUMOUR CONFIRMED!', 400, 300, 36, '#22a447', '#fff', outBack((rk - .25) / .25), -.04);
        } else {
          if (rk > .3) badge(wrong < MAXBAD ? "TIME'S UP!" : 'BROKEN PHONE!', 400, 262, 36, '#e8343d', '#fff', outBack((rk - .3) / .25), .04);
          if (rk > .7) badge('THE QUEUE LEFT!', 400, 316, 24, '#ffb020', '#fff', outBack((rk - .7) / .25), -.03);
        }
      }
      vignette(.14);
    },
    down(p) {
      if (g.result) return;
      for (let j = 0; j < 4; j++) { const r0 = cardRect(j); if (p.x >= r0.x && p.x <= r0.x + r0.w && p.y >= r0.y && p.y <= r0.y + r0.h + 6) { pick(j); return; } }
    },
    move() {}, up() {},
    key(e) { if (g.result) return; const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code); if (m) pick(+m[1] - 1); },
    keyup() {},
  };
  g.dbg = {
    view: () => {
      const base = { me, n, round, score, wrong, S: g.c, ready: ready() };
      if (first) return Object.assign(base, { icon: round < NR ? target[round] : -1, opts: optsView() });
      return Object.assign(base, { heard: heard(), list: me - 1, opts: optsView() });
    },
    PH, ICON_N, target, cand,
  };
  wire(g, D, n - 1, sp, 'sq_bemba');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, tm) {
  X = ctx;
  X.fillStyle = '#ffe7b8'; X.fillRect(0, 0, 520, 110); X.fillStyle = '#e9dcbc'; X.fillRect(0, 110, 520, 130); X.fillStyle = INK; X.fillRect(0, 108, 520, 5);
  for (let i = 0; i < 9; i++) { const x0 = i * 64 - 6; X.beginPath(); X.moveTo(x0, 0); X.lineTo(x0 + 64, 0); X.lineTo(x0 + 64, 16); X.arc(x0 + 32, 16, 32, 0, Math.PI); X.closePath(); ink(i % 2 ? CREAM : TEAL, 2.5); }
  const u = tm % 4, last = role === n - 1;
  caos(450, 106, 2.2, { col: COLS[Math.min(role, 3)] });
  rr(20, 40, 340, 62, 18); ink(CREAM, 3);
  if (role === 0) { icon(u > 1 ? 3 : 0, 70, 74, .5); txt(ICON_N[u > 1 ? 3 : 0], 220, 72, 24, RED2, 'center', 220); }
  else { txt('YOU HEARD...', 190, 52, 11, RED2, 'center', 200); txt(PH[0][0][0], 190, 70, 15, INK, 'center', 300); rr(100, 79, 180, 16, 8); ink('#6b6780', 2); txt(MASKED, 190, 87, 11, '#fff', 'center', 140); }
  if (last) { for (let i = 0; i < 4; i++) { const on = Math.floor(u) === i; rr(24 + i * 124, 140 - (on ? 4 : 0), 112, 90, 12); ink(on ? '#ffe14d' : CREAM, 3); icon([0, 1, 4, 3][i], 80 + i * 124, 185 - (on ? 4 : 0), .6); } demoFinger(80 + Math.floor(u) * 124, 210, u % 1 < .5, (u % 1) * 2); }
  else { for (let i = 0; i < 4; i++) { const on = Math.floor(u) === i; rr(24 + (i & 1) * 250, 128 + (i >> 1) * 52 - (on ? 3 : 0), 240, 46, 12); ink(on ? '#ffe14d' : CREAM, 3); txt(PH[role][[2, 0, 4, 1][i]][0], 144 + (i & 1) * 250, 151 + (i >> 1) * 52, 15, INK, 'center', 220); } demoFinger(144 + (Math.floor(u) & 1) * 250, 160 + (Math.floor(u) >> 1) * 52, u % 1 < .5, (u % 1) * 2); }
}
reg('sq_bemba', sqBemba, 'RADIO BEMBA'); REGMAP.sq_bemba.duo = true; REGMAP.sq_bemba.squad = true;
DUO.INFO.sq_bemba = n => Array.from({ length: n }, (_, r) => r === 0 ? ['STARTER', 'SEE A PICTURE AND SAY IT WITH A PHRASE', 'CLICK A PHRASE / KEYS 1-4']
  : r === n - 1 ? ['LAST EAR', 'HEAR THE RUMOUR AND PICK THE PICTURE', 'CLICK A PICTURE / KEYS 1-4']
  : [NAMES[r], 'HEAR THE RUMOUR AND SAY IT IN YOUR OWN WORDS', 'CLICK A PHRASE / KEYS 1-4']);
DUO.DEMOS.sq_bemba = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
