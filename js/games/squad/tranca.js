'use strict';
/* ═════════ SQUAD · TRANCA (sq_tranca), 3-4 players, one role each ═════════
   Dominó on the sidewalk, Venezuelan style: a red plastic table, a thermos of cafecito, the bodega neighbour leaning out of his window. The whole
   table plays TOGETHER against the clock to empty everybody's hands. One double starts the line and the line has two open ends.
   n = 4:  MESA (0, JUDGE)   sees the line (both open ends, how many tiles are left) but NOT the hands. Taps the number pad (1-6): "¡el cinco!".
           MANO A (1), MANO B (2)  each see ONLY their own 3-4 tiles. When a number is called they play a tile that has it (tap it, or press the number).
                              No such tile = the hand says "¡NO TENGO!" by itself and the Mesa sees the hand refuse that end.
           POZO (3)          sees the draw pile (how many are left) and which hands are stuck. When EVERYONE is stuck ("tranca") it draws a tile for a hand.
   n = 3:  the same without the Pozo: the Mesa also draws.
   Rules (deterministic from the seed mkR(), identical on every screen): tiles are 1-6, each tile exists once. The level is searched at start (exact game-tree
   search, <50 ms) so that the pile is always needed at least once and a table that plays any legal order at random still wins ~99 % of the time (the pile is
   only used when everyone is stuck). A tile played on an end with its matching half
   makes its other half the new end. A hand taps a tile that does not have the called number (or taps with no call): "¡NO ES!", it costs 1 s of the clock.
   No hand can play and the pile is empty = TRANCA, the table flips. Same if the clock runs out. Win = every hand is empty.
   Netcode: every role owns its variables, the others render them:
     MESA (judge)  'call' [n, v] (the number asked at line version v), 'line' [id, side, ...] (the full placement list = the truth; v = its length),
                   'st' [stuckA, stuckB, blocked], 'tl' lost seconds, 'why' cause of a loss, 'rej' [role, id] a play that came too late
     MANO          'play' [id, n, v] (I put this tile), 'pass' [n, v] (I have none), 'pen' 1 (I tapped a wrong tile)
     POZO          'draw' [role, k] (the k-th pile tile goes to this hand)
   The Mesa decides the verdict ('end', via wire) from what it receives. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only

const PEN = 1.0, LOSTCAP = 5, PASSD = .1, LY = 372, TW = 52, TH = 26, GAP = 3, SY = 312;
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const CHAIR = ['#3f8a7a', '#6EA8FE', '#ff8fb1', '#ffb347'];
const NAMES = ['TABLE', 'HAND A', 'HAND B', 'DRAW PILE'];
const IVORY = '#fffaf0', IVORY2 = '#d8c79a', BACK = '#4aa896', BACK2 = '#2f7d70', RED = '#e8434f', RED2 = '#b8283a', GOLD = '#ffcf33';
const PIPS = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];

/* ───────────── the level: a chain of unique tiles built by a random walk, a piece of it hidden in the pile, then searched ───────────── */
function analyse(hand, pile, s) {          // { p: chance a table that plays every legal order at random still wins (the pile is used only when stuck), pileless: true if the hands alone could finish }
  const N = hand.length + pile.length, all = hand.concat(pile), mp = new Map(), me = new Map();
  function moves(rem, l, r) {
    const out = [];
    for (let i = 0; i < N; i++) if (rem >> i & 1) {
      const a = all[i][0], b = all[i][1];
      for (let side = 0; side < 2; side++) { const e = side ? r : l; let ne = -1; if (a === e) ne = b; else if (b === e) ne = a; if (ne < 0) continue; out.push([rem & ~(1 << i), side ? l : ne, side ? ne : r]); }
    }
    return out;
  }
  function P(rem, l, r, pi) {
    if (!rem) return 1; const k = rem + ':' + l + ':' + r + ':' + pi; if (mp.has(k)) return mp.get(k);
    const m = moves(rem, l, r); let v = 0;
    if (!m.length) v = pi < pile.length ? P(rem | 1 << (hand.length + pi), l, r, pi + 1) : 0;   // stuck: draw the next pile tile (or it is a tranca)
    else { for (const x of m) v += P(x[0], x[1], x[2], pi); v /= m.length; }
    mp.set(k, v); return v;
  }
  function ex(rem, l, r) {
    if (!rem) return true; const k = rem + ':' + l + ':' + r; if (me.has(k)) return me.get(k);
    let ok = false; for (const x of moves(rem, l, r)) if (ex(x[0], x[1], x[2])) { ok = true; break; } me.set(k, ok); return ok;
  }
  const full = (1 << hand.length) - 1; return { p: P(full, s, s, 0), pileless: ex(full, s, s) };
}
function makeLevel(R, nh, np) {
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1)), key = (a, b) => Math.min(a, b) * 10 + Math.max(a, b); let best = null, bp = -1;
  for (let at = 0; at < 300 && bp < .99; at++) {
    const start = ri(1, 6), used = new Set([key(start, start)]); let l = start, r = start, chain = [], bad = false;
    for (let k = 0; k < nh + 1 && !bad; k++) {                                                        // the line the table will build, tile by tile
      const side = R() < .5, e = side ? r : l; let nv = -1;
      for (let q = 0; q < 12 && nv < 0; q++) { const c = R() < .12 ? e : ri(1, 6); if (!used.has(key(e, c))) nv = c; }
      if (nv < 0) bad = true; else { used.add(key(e, nv)); chain.push([e, nv]); if (side) r = nv; else l = nv; }
    }
    if (bad) continue;
    const hid = chain.splice(1 + Math.floor(R() * (nh - 1)), 1)[0], hand = chain;                  // one link of the line sits in the pile: the hands alone cannot finish
    for (let i = hand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = hand[i]; hand[i] = hand[j]; hand[j] = x; }
    if (hand.filter(q => q[0] === q[1]).length > 2) continue;
    const pile = [hid]; for (let k = 1; k < np && !bad; k++) { let q = null; for (let z = 0; z < 30 && !q; z++) { const a = ri(1, 6), b = ri(1, 6); if (!used.has(key(a, b))) { used.add(key(a, b)); q = [a, b]; } } if (q) pile.push(q); else bad = true; }
    if (bad) continue;
    for (let i = pile.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = pile[i]; pile[i] = pile[j]; pile[j] = x; }
    const st = analyse(hand, pile, start); if (st.pileless || st.p <= 0) continue;
    if (st.p > bp) { bp = st.p; best = { s: start, hand, pile }; }
  }
  if (best) return best;
  return { s: 3, hand: nh === 8 ? [[3, 5], [5, 1], [1, 2], [3, 6], [6, 4], [4, 4], [2, 6], [2, 2]] : [[3, 5], [5, 1], [1, 2], [3, 6], [6, 4], [2, 2]], pile: nh === 8 ? [[1, 4], [6, 6], [4, 5]] : [[1, 4], [6, 6]] };   // practically never reached
}

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
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(330, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 330);
  X.restore();
}
function pips(cx, cy, size, v, col) {                        // v pips inside a square half of side `size`
  const d = size * .25, r = Math.max(1.6, size * .085);
  for (const [px, py] of PIPS[v] || []) { X.beginPath(); X.arc(cx + px * d, cy + py * d, r, 0, TAU); X.fillStyle = col || INK; X.fill(); X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.arc(cx + px * d - r * .3, cy + py * d - r * .3, r * .32, 0, TAU); X.fill(); }
}
function tile(cx, cy, w, h, a, b, rot, hid, glow) {          // a domino w x h, `a` pips on the left half, `b` on the right
  X.save(); X.translate(cx, cy); X.rotate(rot || 0);
  const bd = () => rr(-w / 2, -h / 2, w, h, h * .24), o = Math.max(2, h * .1);
  if (hid) {
    cel(bd, BACK, BACK2, h * .05, h * .1, o);
    X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + h * .14, -h / 2 + h * .12, w - h * .28, h * .16, h * .08); X.fill();
    X.beginPath(); X.arc(0, 0, h * .12, 0, TAU); ink('#e9fff8', 1.5);
  } else {
    cel(bd, IVORY, IVORY2, h * .05, h * .1, o);
    line([[0, -h * .34], [0, h * .34]], Math.max(1.4, h * .05), '#7a6a4a');
    pips(-w / 4, 0, h, a); pips(w / 4, 0, h, b);
  }
  if (glow) { bd(); X.lineWidth = 4; X.strokeStyle = glow; X.stroke(); }
  X.restore();
}
function cup(x, y, s, T, steam) {
  rr(x - 11 * s, y - 14 * s, 22 * s, 18 * s, 5 * s); ink('#fff7e6', 3);
  X.beginPath(); X.arc(x + 13 * s, y - 6 * s, 6 * s, -Math.PI / 2, Math.PI / 2); X.lineWidth = 6 * s; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3 * s; X.strokeStyle = '#fff7e6'; X.stroke();
  el(x, y - 13 * s, 10 * s, 3 * s); ink('#5a2d12', 2);
  if (steam) for (let i = 0; i < 2; i++) { const k = (T * .7 + i * .5) % 1; X.globalAlpha = (1 - k) * .7; line([[x + (i ? 4 : -4) * s, y - 16 * s - k * 14 * s], [x + (i ? 7 : -1) * s + Math.sin(k * 6 + i) * 3, y - 22 * s - k * 14 * s]], 2.5, '#fff'); X.globalAlpha = 1; }
}
function thermos(x, y, s) {
  rr(x - 12 * s, y - 40 * s, 24 * s, 44 * s, 6 * s); cel(() => rr(x - 12 * s, y - 40 * s, 24 * s, 44 * s, 6 * s), '#e8434f', '#b8283a', 4 * s, 0, 3);
  rr(x - 9 * s, y - 50 * s, 18 * s, 12 * s, 4 * s); ink('#fff7e6', 3);
  X.fillStyle = 'rgba(255,255,255,.45)'; rr(x - 8 * s, y - 36 * s, 4 * s, 28 * s, 2 * s); X.fill();
}
function moto(x, y, T) {
  const bob = Math.sin(T * 40) * 1;
  for (const wx of [-22, 22]) { X.beginPath(); X.arc(x + wx, y + 10, 10, 0, TAU); ink('#2b2640', 3); X.beginPath(); X.arc(x + wx, y + 10, 4, 0, TAU); ink('#c9ced6', 1.5); }
  line([[x - 22, y + 10], [x - 4, y - 2 + bob], [x + 16, y - 4 + bob], [x + 22, y + 10]], 5, '#e8434f');
  rr(x - 10, y - 12 + bob, 22, 9, 4); ink('#2b2640', 2.5);
  rr(x - 4, y - 24 + bob, 14, 14, 5); ink('#4db8ff', 3); X.beginPath(); X.arc(x + 4, y - 31 + bob, 7.5, 0, TAU); ink('#ffd23f', 3);
  line([[x + 10, y - 17 + bob], [x + 20, y - 8 + bob]], 4, '#ffd2a8');
}

/* ───────────── the sidewalk, painted once ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 210); g.addColorStop(0, '#ffd9a0'); g.addColorStop(1, '#f4b87a'); X.fillStyle = g; X.fillRect(0, 0, W, 210);
  X.fillStyle = 'rgba(200,100,70,.16)'; for (let i = 0; i < 16; i++) X.fillRect(i * 52 + 14, 0, 18, 210);
  // the bodega: door and window
  rr(34, 86, 112, 128, 6); ink('#8a5a3c', 5); rr(46, 98, 88, 70, 4); ink('#bfe8ff', 3); line([[90, 98], [90, 168]], 3, '#8a5a3c');
  X.beginPath(); X.arc(124, 160, 4, 0, TAU); ink(GOLD, 2);
  rr(556, 92, 196, 114, 8); ink('#8a5a3c', 6); rr(566, 102, 176, 94, 4); ink('#2b2d5c', 3);
  X.fillStyle = '#ffe9a0'; X.fillRect(566, 102, 176, 6);
  rr(546, 200, 216, 14, 4); ink('#8a5a3c', 4);                                              // sill
  for (const [fx, c] of [[580, '#ff7ab6'], [722, '#ffe14d']]) { rr(fx - 14, 182, 28, 20, 4); ink('#c45470', 3); X.beginPath(); X.arc(fx, 176, 9, 0, TAU); ink(c, 2.5); }
  // striped awning along the top
  for (let i = 0; i < 14; i++) { const x0 = i * 58 - 4; X.beginPath(); X.moveTo(x0, 0); X.lineTo(x0 + 58, 0); X.lineTo(x0 + 58, 42); X.arc(x0 + 29, 42, 29, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff7e6' : RED, 3); }
  // the street behind the curb, the curb, the sidewalk
  X.fillStyle = '#6f6a80'; X.fillRect(0, 214, W, 26); X.fillStyle = '#ffd23f'; for (let i = 0; i < 12; i++) X.fillRect(i * 80 + 20, 226, 36, 4);
  X.fillStyle = '#d9d3c4'; X.fillRect(0, 240, W, 12); X.fillStyle = INK; X.fillRect(0, 238, W, 5); X.fillRect(0, 250, W, 4);
  g = X.createLinearGradient(0, 254, 0, H); g.addColorStop(0, '#eadcbc'); g.addColorStop(1, '#cdb98f'); X.fillStyle = g; X.fillRect(0, 254, W, H - 254);
  X.strokeStyle = 'rgba(120,90,50,.28)'; X.lineWidth = 3;
  for (let r = 0; r < 7; r++) { const y = 254 + r * r * 3 + r * 18; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let c = -8; c <= 16; c++) { X.beginPath(); X.moveTo(400 + (c - 4) * 40, 254); X.lineTo(400 + (c - 4) * 110, H); X.stroke(); }
  X.fillStyle = 'rgba(20,16,28,.22)'; el(400, 424, 340, 34); X.fill();                          // shade under the table
  // the plastic tray where each role's controls live
  rr(14, 450, 772, 142, 22); ink(RED, 5); X.fillStyle = RED2; rr(22, 460, 756, 124, 16); X.fill(); X.fillStyle = 'rgba(255,255,255,.22)'; rr(30, 466, 740, 10, 5); X.fill();
  X = old; return cv2;
}

/* ═════════ the game ═════════ */
function sqTranca(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, judge = me === 0, hand = me === 1 || me === 2, drawer = n === 4 ? me === 3 : me === 0;
  const NH = n === 4 ? 4 : 3, NP = n === 4 ? 3 : 2;
  /* the level: identical on every screen for the same head count */
  const lv = makeLevel(R, 2 * NH, NP), TL = [[lv.s, lv.s]].concat(lv.hand, lv.pile), PL = lv.pile.length, P0 = 2 * NH + 1;
  const ownerOf0 = id => id <= NH ? 1 : 2;
  /* state */
  let seq = [], cur = null, pidx = 0, ver = 0;
  const drawnTo = [], placedAt = {}, mine = [], infl = new Map(), refused = [null, new Set(), new Set()];
  let calls = [], callV = 0, callAt = -9, passQ = [], lost = 0, cause = 0, stuckF = [false, false], blocked = false, blockedAt = -1, stLast = '', lock = -9, resAt = -1, endFx = false;
  let lockSt = false, wrongAt = -9, penAt = -9, padAt = [-9, -9, -9, -9, -9, -9, -9], drawAt = [-9, -9, -9], hoverK = -1;
  const pops = [], tmap = {};
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  if (hand) for (let id = 1; id <= 2 * NH; id++) if (ownerOf0(id) === me) mine.push(id);
  function replay() {
    let l = TL[0][0], r = l; const Lc = [], Rc = [], used = new Set([0]);
    for (const [id, side] of seq) {
      const a = TL[id][0], b = TL[id][1], e = side ? r : l, inV = a === e ? a : b, outV = a === e ? b : a; used.add(id);
      const it = { id, inV, outV, dbl: a === b }; if (side) { Rc.push(it); r = outV; } else { Lc.push(it); l = outV; }
    }
    return { l, r, Lc, Rc, used };
  }
  cur = replay();
  const ownerOf = id => id < P0 ? ownerOf0(id) : (drawnTo[id - P0] || 0);
  const cnt = h => { let c = NH + drawnTo.filter(x => x === h).length; for (const [id] of seq) if (ownerOf(id) === h) c--; return c; };
  const remaining = () => cnt(1) + cnt(2);
  const hasNum = (id, v) => TL[id][0] === v || TL[id][1] === v;
  const pileLeft = () => PL - pidx;
  function setSeq(s) {
    const old = seq.length; seq = s; cur = replay(); ver = seq.length;
    for (let i = old; i < seq.length; i++) { placedAt[seq[i][0]] = g.c; if (hand) infl.delete(seq[i][0]); }
    if (seq.length > old) { snd(180, .07, 'square', .06, 0, 110); noise(.05, .09, 1800, 3200, 'bandpass'); }
    if (callV < seq.length) { calls = []; passQ = []; } else if (hand && callV === ver) for (const c of calls) schedulePass(c);
    if (judge) for (const h of [1, 2]) refused[h].clear();
  }
  function applyDraw(h, k) {
    if (k !== pidx || pidx >= PL) return; drawnTo[pidx] = h; const id = P0 + pidx; pidx++; drawAt[h] = g.c; snd(420, .09, 'triangle', .06, 0, 640);
    if (me === h) { mine.push(id); if (callV === ver) for (const c of calls) schedulePass(c); }
    if (judge && refused[h]) { refused[h].clear(); judgeEval(); }
  }
  /* ── the Mesa ── */
  function call(v) {
    if (!judge || g.result || v < 1 || v > 6) return; if (callV !== ver) { callV = ver; calls = []; } if (!calls.includes(v)) calls.push(v); callAt = g.c; padAt[v] = g.c; D.send('call', [v, ver]);
    snd(480 + v * 60, .09, 'triangle', .07);
  }
  function stuckOf(h) { if (cnt(h) <= 0) return false; const s = refused[h]; return s.has(cur.l) && s.has(cur.r); }
  function actives() { return [1, 2].filter(h => cnt(h) > 0); }
  function judgeEval() {
    const sa = stuckOf(1), sb = stuckOf(2), act = actives(), bl = act.length > 0 && act.every(stuckOf);
    stuckF = [sa, sb]; blocked = bl;
    const key = (sa ? 1 : 0) + ',' + (sb ? 1 : 0) + ',' + (bl ? 1 : 0); if (key !== stLast) { stLast = key; D.send('st', [sa ? 1 : 0, sb ? 1 : 0, bl ? 1 : 0]); }
    if (bl && pileLeft() <= 0) { if (blockedAt < 0) blockedAt = g.c; } else blockedAt = -1;
  }
  function judgePlay(from, d) {
    if (!judge || g.result || !Array.isArray(d)) return; const id = d[0] | 0, num = d[1] | 0;   // a play that arrives late is still good while its tile fits an open end
    if (!(id >= 1 && id < TL.length) || cur.used.has(id) || id >= P0 && id - P0 >= pidx || (from !== ownerOf(id))) { D.send('rej', [from, id]); return; }
    let side = -1;
    if (cur.l === num && hasNum(id, num)) side = 0; else if (cur.r === num && hasNum(id, num)) side = 1;
    else if (hasNum(id, cur.l)) side = 0; else if (hasNum(id, cur.r)) side = 1;
    if (side < 0) { D.send('rej', [from, id]); return; }
    const s2 = seq.concat([[id, side]]); setSeq(s2); D.send('line', s2.flat());
    if (remaining() <= 0) g.finish('win');
  }
  /* ── a hand ── */
  function schedulePass(c) { passQ = passQ.filter(q => q.c !== c); passQ.push({ c, at: g.c + PASSD }); }
  const liveCalls = () => callV === ver ? calls : [];
  function tapTile(id) {
    if (!hand || g.result || !mine.includes(id)) return;
    const num = liveCalls().find(c => hasNum(id, c));
    if (num === undefined) {
      if (g.c - penAt < .3) return; penAt = g.c; wrongAt = g.c; wrongId = id; D.send('pen', 1); sfx.miss(); shake(3, .1);
      pop('NO!', clamp(tmap[id] ? tmap[id].x : 400, 90, 710), 484, 22, '#e8343d'); pop('-1s', 400, 440, 20, '#e8343d'); lost = Math.min(LOSTCAP, lost + PEN); return;
    }
    mine.splice(mine.indexOf(id), 1); infl.set(id, g.c); D.send('play', [id, num, callV]); snd(260, .06, 'square', .06, 0, 150);
  }
  let wrongId = -1;
  function keyTile(v) {
    if (!hand) return; const id = mine.find(i => hasNum(i, v)); if (id !== undefined) tapTile(id);
  }
  /* ── the drawer (Pozo, or the Mesa with 3 seats) ── */
  function drawFor(h) {
    if (!drawer || g.result || !blocked || pileLeft() <= 0 || (lockSt && g.c - lock < 1.5)) { if (drawer && !g.result && (!blocked || pileLeft() <= 0)) { sfx.miss(); pop(pileLeft() <= 0 ? 'EMPTY!' : 'NOT STUCK!', 400, 440, 20, '#e8343d'); } return; }
    if (cnt(h) <= 0 || !stuckF[h - 1]) return; lock = g.c; lockSt = !judge; const k = pidx; D.send('draw', [h, k]); applyDraw(h, k);
  }

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['CALL THE NUMBER!', 'PLAY THE TILE!', 'PLAY THE TILE!', 'DRAW A TILE!'][me], roleLabel: NAMES[me],
    hint: judge ? 'READ THE OPEN ENDS AND CALL A NUMBER (KEYS 1-6 OR CLICK) - THE HANDS PLAY IT' + (n === 3 ? ' - WHEN EVERYONE IS STUCK DRAW FOR A HAND (A / B)' : '')
      : hand ? 'WHEN A NUMBER IS CALLED PLAY A TILE THAT HAS IT (CLICK IT OR PRESS THE NUMBER) - A WRONG TILE COSTS TIME'
      : 'WHEN EVERYONE IS STUCK DRAW A TILE FOR A HAND (CLICK IT OR PRESS 1 / 2)',
    thint: judge ? 'READ THE OPEN ENDS AND TAP A NUMBER - THE HANDS PLAY IT' + (n === 3 ? ' - WHEN EVERYONE IS STUCK DRAW FOR A HAND' : '')
      : hand ? 'WHEN A NUMBER IS CALLED TAP A TILE THAT HAS IT - A WRONG TILE COSTS TIME'
      : 'WHEN EVERYONE IS STUCK TAP A HAND TO DRAW A TILE FOR IT',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      if (!g.result) {
        if (hand) {
          if (passQ.length) { const due = passQ.filter(q => g.c >= q.at); if (due.length) { passQ = passQ.filter(q => g.c < q.at); for (const q of due) if (callV === ver && calls.includes(q.c) && !infl.size && !mine.some(i => hasNum(i, q.c))) { D.send('pass', [q.c, callV]); pop('NO TENGO!', 400, 440, 20, '#8f88a6'); } } }
          for (const [id, ts] of infl) if (g.c - ts > 3) { infl.delete(id); if (!cur.used.has(id)) mine.push(id); }
        }
        if (judge) {
          judgeEval();
          if (blockedAt >= 0 && g.c - blockedAt > .6) { cause = 1; D.send('why', 1); g.finish('lose'); }
          else if (g.c >= g.limit - lost) { cause = 2; D.send('why', 2); g.finish('lose'); }
        }
      }
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); for (let i = 0; i < 4; i++) noise(.05, .1, 1800, 3000, 'bandpass', i * .09); }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(300, .5, 'sawtooth', .06, 0, 90); noise(.35, .12, 300, 900, 'lowpass'); shake(7, .28); }
      while (pops.length && g.c - pops[0].t0 > 1.0) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'call' && Array.isArray(d)) { const c = d[0] | 0, cv = d[1] | 0; if (cv < ver) return; if (callV !== cv) { callV = cv; calls = []; } if (!calls.includes(c)) calls.push(c); callAt = g.c; if (hand && callV === ver) schedulePass(c); snd(480 + c * 60, .09, 'triangle', .06); }
      else if (type === 'line' && Array.isArray(d)) { if (d.length / 2 > seq.length) { const s = []; for (let i = 0; i + 1 < d.length; i += 2) s.push([d[i], d[i + 1]]); setSeq(s); } }
      else if (type === 'pass') { if (judge && from > 0 && from < 3 && Array.isArray(d) && d[1] === ver) refused[from].add(d[0]); }
      else if (type === 'play') judgePlay(from, d);
      else if (type === 'rej') { if (Array.isArray(d) && d[0] === me && hand && infl.has(d[1])) { infl.delete(d[1]); if (!cur.used.has(d[1])) mine.push(d[1]); } }
      else if (type === 'pen') { if (judge) { lost = Math.min(LOSTCAP, lost + PEN); D.send('tl', Math.round(lost * 10)); } }
      else if (type === 'tl') { if (!judge) lost = d / 10; }
      else if (type === 'draw') { if (Array.isArray(d)) applyDraw(d[0] | 0, d[1] | 0); }
      else if (type === 'st') { if (!judge && Array.isArray(d)) { stuckF = [!!d[0], !!d[1]]; blocked = !!d[2]; lockSt = false; } }
      else if (type === 'why') cause = d | 0;
    },
    draw(t0) {
      X = ctx; const T = g.c, won = g.result === 'win', over = !!g.result, lostG = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      const frac = clamp((T + lost) / Math.max(1, g.limit), 0, 1), cx0 = n === 4 ? [130, 300, 500, 670] : [150, 400, 650], mesaX = cx0[0];
      // the awning sign, the clock, the moto, the neighbour
      line([[320, 42], [320, 66]], 3, INK); line([[500, 42], [500, 66]], 3, INK); rr(300, 62, 220, 50, 10); ink('#fff7e6', 4); txt('CAFÉ · BODEGA', 410, 88, 22, RED2, 'center', 196);
      X.beginPath(); X.arc(228, 150, 30, 0, TAU); ink('#fff7e6', 4); X.beginPath(); X.moveTo(228, 150); X.arc(228, 150, 24, -Math.PI / 2, -Math.PI / 2 + TAU * frac); X.closePath(); X.fillStyle = frac > .75 ? '#e8434f' : '#ffd23f'; X.fill();
      X.beginPath(); X.arc(228, 150, 4, 0, TAU); ink(INK, 0); X.fillStyle = INK; X.fill();
      { const mx = ((T * 70 + 300) % 1100) - 150; moto(mx, 224, T); }
      { const nx = 654, ny = 150, jump = won ? Math.abs(Math.sin(T * 8)) * 8 : 0, look = clamp((400 - nx) / 400, -1, 1);
        X.beginPath(); X.arc(nx, ny + 14 - jump, 26, 0, TAU); ink('#ffd2a8', 3); rr(nx - 30, ny - 20 - jump, 60, 20, 8); ink('#d9435a', 3);   // cap
        X.fillStyle = '#fff'; for (const sx of [-1, 1]) { X.beginPath(); X.arc(nx + sx * 10, ny + 10 - jump, 6, 0, TAU); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(nx + sx * 10 + look * 3, ny + 11 - jump, 2.6, 0, TAU); X.fill(); X.fillStyle = '#fff'; }
        if (won) { X.beginPath(); X.arc(nx, ny + 22 - jump, 8, 0, Math.PI); ink('#7a1f2e', 1.5); } else if (lostG) { el(nx, ny + 24 - jump, 5, 7); ink('#7a1f2e', 1.5); } else line([[nx - 8, ny + 26], [nx + 8, ny + 26]], 3, INK);
        if (won) { line([[nx - 30, ny + 34], [nx - 40, ny + 4 - jump]], 6, '#ffd2a8'); line([[nx + 30, ny + 34], [nx + 40, ny + 4 - jump]], 6, '#ffd2a8'); } }
      // chairs and the seated crew
      const mood = won ? 'happy' : lostG ? 'sad' : null;
      for (let r = 0; r < n; r++) {
        const x = cx0[r], jig = won ? -Math.abs(Math.sin(T * 9 + r)) * 10 : 0;
        rr(x - 38, SY - 64, 76, 82, 14); ink(CHAIR[r], 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(x - 30, SY - 58, 16, 46, 6); X.fill();
        shadow(x, SY + 3, 30, 7, .22); caos(x, SY + jig, 3.7, { col: cols(r), mood });
        if (r === 1 || r === 2) { const c = cnt(r); for (let q = 0; q < Math.min(c, 7); q++) tile(x - (Math.min(c, 7) - 1) * 6 + q * 12, SY - 10, 10, 20, 0, 0, 0, true); }
      }
      // ───── the table, its line, the cups: the whole thing flips when the game is lost ─────
      const items = lineItems(T), fl = lostG ? rk : -1; let sy = 1;
      X.save();
      if (fl >= 0) { const ang = ease(fl / .5) * Math.PI * .96 + Math.sin(clamp(fl - .5, 0, 1) * 14) * .05 * clamp(1 - (fl - .5) * 1.5, 0, 1); sy = Math.cos(ang); X.translate(0, 1500 * Math.pow(Math.max(0, fl - .8), 2)); X.translate(400, 300); X.scale(1, sy); X.translate(-400, -300); }
      // legs, plastic top with a cel crescent and a shine
      for (const lx of [150, 650]) { rr(lx - 9, 400, 18, 52, 5); ink('#fff7e6', 3); }
      cel(() => el(400, LY, 332, 74), sy < 0 ? '#e6e0cf' : RED, sy < 0 ? '#b9b29c' : RED2, 6, 12, 5);
      X.strokeStyle = 'rgba(255,255,255,.4)'; X.lineWidth = 4; X.beginPath(); X.ellipse(400, LY - 3, 318, 60, 0, Math.PI * 1.05, Math.PI * 1.55); X.stroke();
      X.fillStyle = 'rgba(255,255,255,.25)'; X.beginPath(); X.ellipse(400, LY, 300, 52, 0, 0, TAU); X.fill();
      el(400, LY, 300, 52); X.lineWidth = 3; X.strokeStyle = 'rgba(184,40,58,.6)'; X.stroke();
      if (fl < .08) {
        cup(116, LY + 6, 1.1, T, !over); cup(682, LY + 14, 1, T, !over); thermos(722, LY - 4, .9);
        drawLine(items, T, won, 0);
      }
      X.restore();
      if (fl >= .08) {
        const T2 = fl - .08;
        for (let i = 0; i < items.length; i++) { const q = items[i], vx = (hash(i + 3) - .3) * 300, vy = -260 - hash(i + 9) * 240; tile(q.x + vx * T2, q.y + vy * T2 + 520 * T2 * T2, q.w, q.h, q.a, q.b, q.rot + T2 * (3 + hash(i) * 6), q.hid); }
        for (const [cxp, cyp, s] of [[116, LY + 6, 1.1], [682, LY + 14, 1], [722, LY - 4, .9]]) { const k = hash(cxp) * 3; X.save(); X.translate(cxp + (hash(k) - .2) * 260 * T2, cyp - 300 * T2 + 520 * T2 * T2); X.rotate(T2 * 7 * (k - 1)); if (s === .9) thermos(0, 0, s); else cup(0, 0, s, T, false); X.restore(); }
        if (fl > .5) for (let i = 0; i < 9; i++) { const k = fl - .5 - hash(i) * .3; if (k < 0) continue; X.fillStyle = '#5a2d12'; X.globalAlpha = clamp(1 - k, 0, 1); el(150 + hash(i + 4) * 520 + k * 60, LY + 20 + k * 70 + hash(i) * 30, 5, 3); X.fill(); X.globalAlpha = 1; }
      }
      for (let r = 0; r < n; r++) { const x = cx0[r]; pill(x, 208, r === me ? 'YOU' : name(r), cols(r)); txt(NAMES[r], x, 229, 13, '#fff', 'center', 100); }
      // ───── the role's own controls on the tray ─────
      if (!over) {
        if (judge) {
          if (n === 3) drawBtns(606, T);
          for (let k = 1; k <= 6; k++) {
            const r0 = padRect(k), dn = Math.exp(-(T - padAt[k]) / .15), d = dn > .4 ? 3 : 8, on = liveCalls().includes(k);
            rr(r0.x, r0.y + 8, r0.w, r0.h, 14); ink('#7a1f2e', 4); rr(r0.x, r0.y + 8 - d, r0.w, r0.h, 14); ink(on ? '#ffe14d' : IVORY, 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(r0.x + 8, r0.y + 12 - d, r0.w - 16, 8, 4); X.fill();
            pips(r0.x + r0.w / 2 + 4, r0.y + r0.h / 2 + 8 - d - 2, 58, k); if (!TOUCH) { X.beginPath(); X.arc(r0.x + 15, r0.y + 22 - d, 11, 0, TAU); ink('#fff', 2); txt(String(k), r0.x + 15, r0.y + 23 - d, 14, INK); }
          }
          txt(t('LEFT {n}', { n: remaining() }) + '', 400, 478, 17, '#fff', 'center', 220);
        } else if (hand) {
          const L = handLayout();
          for (const q of L) {
            const sh = q.id === wrongId && T - wrongAt < .3 ? Math.sin(T * 70) * 5 : 0, hop = 0;
            tile(q.x + sh, q.y + hop, q.w, q.h, TL[q.id][0], TL[q.id][1], 0, false, null);
          }
          if (!mine.length) txt('EMPTY HAND!', 400, 524, 26, '#fff');
          if (!passQ.length && liveCalls().length && !mine.some(i => liveCalls().some(c => hasNum(i, c))) && !infl.size) badge('NO TENGO!', 400, 486, 20, '#8f88a6', '#fff', 1, -.02);
        } else {
          drawBtns(250, T);
          for (let q = 0; q < PL; q++) if (q >= pidx) tile(80 + (q - pidx) * 16, 548 - (q - pidx) * 14, 70, 36, 0, 0, -.1 + q * .05, true);
          txt(t('PILE {n}', { n: pileLeft() }) + '', 100, 478, 18, '#fff', 'center', 150);
        }
      }
      // ───── the Mesa sees the ends of the line ─────
      if (judge && !over) {
        const e = endPos(items);
        for (let s = 0; s < 2; s++) {
          const v = s ? cur.r : cur.l, ex = e[s], ey = LY - 56, on = liveCalls().includes(v);
          X.beginPath(); X.arc(ex, ey, 21, 0, TAU); ink(on ? '#ffe14d' : IVORY, 4); pips(ex, ey, 40, v); tri(ex - 8, ey + 20, ex + 8, ey + 20, ex, ey + 31, on ? '#ffe14d' : IVORY, 2.5);
          for (let h = 1; h <= 2; h++) {
            const rf = refused[h].has(v), xx = ex + (h === 1 ? -14 : 14), yy = LY + 44;
            X.beginPath(); X.arc(xx, yy, 11, 0, TAU); ink(rf ? '#8f88a6' : cols(h), 2.5); txt(rf ? 'X' : h === 1 ? 'A' : 'B', xx, yy + 1, 12, rf ? '#fff' : INK, 'center', 18);
          }
        }
        if (blocked && Math.sin(T * 12) > -.3) badge(pileLeft() > 0 ? 'EVERYONE IS STUCK!' : 'TRANCA!', 400, 300, 20, '#e8343d', '#fff', 1, -.02);
      } else if (!over) {
        if (blocked && Math.sin(T * 12) > -.3) badge('EVERYONE IS STUCK!', 400, 300, 20, '#e8343d', '#fff', 1, -.02);
      }
      // the call bubble above the Mesa
      if (liveCalls().length && !over) {
        const cl = liveCalls(), bx = clamp(mesaX + 56, 120, 680), by = 150, k = outBack((T - callAt) / .2), bw = 100 + cl.length * 74;
        X.save(); X.translate(bx, by); X.scale(k, k); rr(-bw / 2, -34, bw, 68, 22); ink('#fff', 4);
        tri(-bw / 2 + 24, 30, -bw / 2 + 50, 30, -bw / 2 + 12, 62, '#fff', 3); X.fillStyle = '#fff'; X.fillRect(-bw / 2 + 26, 24, 22, 10);
        cl.forEach((c, i) => { const px = -bw / 2 + 44 + i * 74; X.beginPath(); X.arc(px, 0, 24, 0, TAU); ink(IVORY, 3); pips(px, 0, 46, c); if (i) txt('AND', px - 37, 2, 14, RED2, 'center', 30); });
        txt(cl.length > 1 ? '!' : t('THE {n}!', { n: cl[0] }), bw / 2 - 36, 2, cl.length > 1 ? 40 : 26, RED2, 'center', 70);
        X.restore();
      }
      if (!over && T < 2.4) badge(judge ? 'CALL THE ENDS!' : hand ? 'PLAY THE CALLED NUMBER!' : 'DRAW WHEN STUCK!', 400, 292, 20, judge ? '#22a447' : '#2b9ee6', '#fff', outBack(T / .25), -.03);
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      // drawn payoffs
      if (over && rk >= 0) {
        if (won) {
          for (let i = 0; i < 16; i++) { const d = rk - hash(i + 2) * .6; if (d < 0) continue; const fx = 40 + hash(i) * 720 + Math.sin(d * 4 + i) * 14, fy = -20 + d * (200 + hash(i + 7) * 90); if (fy < 600) tile(fx, fy, 30, 15, 1 + i % 6, 1 + (i * 5) % 6, d * 3 + i); }
          if (rk > .25) badge('DOMINÓ!', 400, 300, 40, '#22a447', '#fff', outBack((rk - .25) / .25), -.04);
        } else {
          if (rk > .35) badge(cause === 2 ? "TIME'S UP!" : 'TRANCA!', 400, 262, 36, '#e8343d', '#fff', outBack((rk - .35) / .25), .04);
          if (rk > .8) badge('THE TABLE FLIPPED!', 400, 316, 24, '#ffb020', '#fff', outBack((rk - .8) / .25), -.03);
        }
      }
      vignette(.14);
    },
    down(p) {
      if (g.result) return;
      if (judge) {
        for (let k = 1; k <= 6; k++) { const r0 = padRect(k); if (p.x >= r0.x && p.x <= r0.x + r0.w && p.y >= r0.y && p.y <= r0.y + r0.h + 10) { call(k); return; } }
        if (n === 3) { const h = btnHit(p, 606); if (h) drawFor(h); }
      } else if (hand) {
        for (const q of handLayout()) if (Math.abs(p.x - q.x) <= q.w / 2 + 2 && Math.abs(p.y - q.y) <= q.h / 2 + 8) { tapTile(q.id); return; }
      } else { const h = btnHit(p, 250); if (h) drawFor(h); }
    },
    move() {}, up() {},
    key(e) {
      if (g.result) return; const c = e.code, dg = /^(?:Digit|Numpad)([0-9])$/.exec(c), v = dg ? +dg[1] : -1;
      if (judge) { if (v >= 1 && v <= 6) call(v); else if (n === 3 && c === 'KeyA') drawFor(1); else if (n === 3 && c === 'KeyB') drawFor(2); }
      else if (hand) { if (v >= 1 && v <= 6) keyTile(v); }
      else if (c === 'Digit1' || c === 'Numpad1' || c === 'KeyA') drawFor(1); else if (c === 'Digit2' || c === 'Numpad2' || c === 'KeyB') drawFor(2);
    },
    keyup() {},
  };

  /* ── layout helpers (they close over the state above) ── */
  function padRect(k) { return n === 4 ? { x: 40 + (k - 1) * 120, y: 496, w: 112, h: 76 } : { x: 28 + (k - 1) * 96, y: 496, w: 88, h: 76 }; }
  function handLayout() {
    const c = mine.length; if (!c) return [];
    const tw = Math.min(112, (740 - (c - 1) * 12) / c), x0 = 400 - (c * tw + (c - 1) * 12) / 2, out = [];
    mine.forEach((id, i) => { const q = { id, x: x0 + i * (tw + 12) + tw / 2, y: 528, w: tw, h: tw * .5 }; out.push(q); tmap[id] = q; });
    return out;
  }
  function btnRect(h, x0) { return n === 4 ? { x: x0 + (h - 1) * 270, y: 492, w: 250, h: 86 } : { x: x0, y: 470 + (h - 1) * 56, w: 172, h: 50 }; }
  function btnHit(p, x0) { for (const h of [1, 2]) { const r0 = btnRect(h, x0); if (p.x >= r0.x && p.x <= r0.x + r0.w && p.y >= r0.y && p.y <= r0.y + r0.h + 6) return h; } return 0; }
  function drawBtns(x0, T) {
    for (const h of [1, 2]) {
      const r0 = btnRect(h, x0), stk = stuckF[h - 1] && cnt(h) > 0, ok = blocked && pileLeft() > 0 && stk, dn = Math.exp(-(T - drawAt[h]) / .15), d = dn > .4 ? 3 : 7;
      rr(r0.x, r0.y + 7, r0.w, r0.h, 16); ink('#3a3550', 4); rr(r0.x, r0.y + 7 - d, r0.w, r0.h, 16); ink(ok ? (Math.sin(T * 10) > 0 ? '#ffe14d' : '#ffd23f') : '#d3cfe0', 4);
      X.fillStyle = 'rgba(255,255,255,.4)'; rr(r0.x + 10, r0.y + 11 - d, r0.w - 20, 8, 4); X.fill();
      txt(t('DRAW FOR') + ' ' + (h === 1 ? 'A' : 'B'), r0.x + r0.w / 2 + 14, r0.y + r0.h * .38 - d + 4, n === 4 ? 21 : 16, ok ? INK : '#6c6785', 'center', r0.w - 56);
      txt(t('{n} TILES', { n: cnt(h) }) + (stk ? ' · ' + t('STUCK') : ''), r0.x + r0.w / 2 + 14, r0.y + r0.h * .74 - d + 2, n === 4 ? 16 : 13, stk ? RED2 : '#6c6785', 'center', r0.w - 56);
      if (!TOUCH) { rr(r0.x + 8, r0.y + 12 - d, 22, 24, 6); ink('#fff', 2); txt(n === 4 ? String(h) : h === 1 ? 'A' : 'B', r0.x + 19, r0.y + 25 - d, 15, INK); }
    }
  }
  function lineItems(T) {                                    // absolute placement of every tile on the table
    const out = [], rp = cur; let cl = TH / 2, cr = TH / 2; const L = [], Rr = [];
    for (const it of rp.Lc) { const len = it.dbl ? TH : TW; L.push({ it, off: -(cl + GAP + len / 2) }); cl += GAP + len; }
    for (const it of rp.Rc) { const len = it.dbl ? TH : TW; Rr.push({ it, off: cr + GAP + len / 2 }); cr += GAP + len; }
    const k = Math.min(1, 300 / Math.max(cl, cr, 1)), hid = !judge;
    const push = (id, off, a, b, dbl) => {
      const pa = placedAt[id], dk = pa === undefined ? 1 : ease((T - pa) / .2), dy = -(1 - dk) * 46;
      out.push({ id, x: 400 + off * k, y: LY + dy, w: TW * k, h: TH * k, a, b, rot: dbl ? Math.PI / 2 : 0, hid, len: (dbl ? TH : TW) * k });
    };
    push(0, 0, TL[0][0], TL[0][1], true);
    for (const q of L) push(q.it.id, q.off, q.it.outV, q.it.inV, q.it.dbl);
    for (const q of Rr) push(q.it.id, q.off, q.it.inV, q.it.outV, q.it.dbl);
    out.endL = L.length ? out.find(o => o.id === L[L.length - 1].it.id) : out[0]; out.endR = Rr.length ? out.find(o => o.id === Rr[Rr.length - 1].it.id) : out[0];
    return out;
  }
  function endPos(items) { const a = items.endL, b = items.endR; return a === b ? [a.x - 36, b.x + 36] : [a.x - a.len / 2 + 6, b.x + b.len / 2 - 6]; }
  function drawLine(items, T, won, hop) {
    for (const q of items) {
      const j = won ? -Math.abs(Math.sin(T * 9 + q.x * .05)) * 6 : 0;
      tile(q.x, q.y + j, q.w, q.h, q.a, q.b, q.rot, q.hid);
    }
  }

  g.dbg = {
    view: () => {
      const base = { me, n, ver, call: liveCalls().slice(), callV, S: g.c, lost };
      if (judge) return Object.assign(base, { l: cur.l, r: cur.r, refused: [null, [...refused[1]], [...refused[2]]], left: remaining(), pile: pileLeft(), blocked, stuck: stuckF.slice(), cnt: [0, cnt(1), cnt(2)] });
      if (hand) return Object.assign(base, { tiles: handLayout().map(q => ({ id: q.id, a: TL[q.id][0], b: TL[q.id][1], x: q.x, y: q.y })), inflight: infl.size, passPending: passQ.length > 0 });
      return Object.assign(base, { pile: pileLeft(), blocked, stuck: stuckF.slice(), cnt: [0, cnt(1), cnt(2)], lock: g.c - lock < .5 });
    },
    TL, analyse, lv, cnt, getBlocked: () => blocked,
  };
  wire(g, D, 0, sp, 'sq_tranca');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, tm) {
  X = ctx;
  X.fillStyle = '#f4b87a'; X.fillRect(0, 0, 520, 100); X.fillStyle = '#eadcbc'; X.fillRect(0, 100, 520, 140); X.fillStyle = INK; X.fillRect(0, 98, 520, 6);
  for (let i = 0; i < 9; i++) { const x0 = i * 64 - 6; X.beginPath(); X.moveTo(x0, 0); X.lineTo(x0 + 64, 0); X.lineTo(x0 + 64, 16); X.arc(x0 + 32, 16, 32, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff7e6' : RED, 2.5); }
  el(260, 160, 240, 46); ink(RED, 4); X.fillStyle = 'rgba(255,255,255,.22)'; el(260, 160, 210, 34); X.fill();
  const u = tm % 4, k = Math.floor(u), v = [5, 2, 4, 6][k];
  tile(260, 160, 44, 22, 0, 0, Math.PI / 2, false); tile(260, 160, 44, 22, 3, 3, Math.PI / 2, false);
  tile(212, 160, 44, 22, 5, 3, 0); tile(308, 160, 44, 22, 3, 2, 0);
  if (role === 0) {
    caos(70, 96, 2.4, { col: COLS[0] });
    for (let q = 1; q <= 6; q++) { const on = v === q && u % 1 < .5; rr(30 + (q - 1) * 74, 190 - (on ? 3 : 0), 66, 40, 10); ink(on ? '#ffe14d' : IVORY, 3); pips(63 + (q - 1) * 74, 208 - (on ? 3 : 0), 34, q); }
    demoFinger(63 + (v - 1) * 74, 220, u % 1 < .5, (u % 1) * 2);
    badge('CALL THE ENDS!', 330, 40, 17, '#22a447', '#fff', 1, -.03);
  } else if (role === 3) {
    for (let q = 0; q < 3; q++) tile(70 + q * 6, 200 - q * 8, 60, 30, 0, 0, -.1 + q * .04, true);
    const on = u % 2 < 1; rr(180, 178, 200, 52, 14); ink(on ? '#ffe14d' : '#d3cfe0', 3); txt(t('DRAW FOR') + ' A', 280, 204, 18, INK, 'center', 170);
    demoFinger(280, 222, u % 2 < .5, (u % 2) * 1.5);
    caos(450, 96, 2.4, { col: COLS[3] }); badge('DRAW WHEN STUCK!', 330, 40, 17, '#2b9ee6', '#fff', 1, -.03);
  } else {
    caos(450, 96, 2.4, { col: COLS[role] });
    const hv = [[5, 1], [2, 6], [4, 4], [3, 6]]; hv.forEach(([a, b], i) => tile(110 + i * 100, 206, 88, 44, a, b, 0, false, v === a || v === b ? GOLD : null));
    const hit = hv.findIndex(([a, b]) => a === v || b === v); demoFinger(110 + (hit < 0 ? 0 : hit) * 100, 222, u % 1 < .5, (u % 1) * 2);
    rr(60, 20, 120, 42, 14); ink('#fff', 3); txt(t('THE {n}!', { n: v }), 120, 41, 22, RED2, 'center', 100);
    badge('PLAY THE CALLED NUMBER!', 330, 74, 14, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_tranca', sqTranca, 'TRANCA'); REGMAP.sq_tranca.duo = true; REGMAP.sq_tranca.squad = true;
DUO.INFO.sq_tranca = n => [
  ['TABLE', n === 4 ? 'CALL THE NUMBER THE LINE NEEDS' : 'CALL NUMBERS AND DRAW WHEN STUCK', n === 4 ? 'KEYS 1-6 / TAP A KEY' : 'KEYS 1-6 + A / B'],
  ['HAND A', 'PLAY A TILE WITH THE CALLED NUMBER', 'CLICK A TILE / PRESS THE NUMBER'],
  ['HAND B', 'PLAY A TILE WITH THE CALLED NUMBER', 'CLICK A TILE / PRESS THE NUMBER'],
  ['DRAW PILE', 'DRAW A TILE WHEN EVERYONE IS STUCK', 'CLICK A HAND / KEYS 1 2'],
].slice(0, n);
DUO.DEMOS.sq_tranca = n => Array.from({ length: n }, (_, r) => t => demo(r === 3 ? 3 : r, n, t));

})();
