'use strict';
/* ═════════ SQUAD · COLA DEL CLAP (sq_clap), 3-4 players, one role each ═════════
   The line for the neighbourhood food box (CLAP). The foreman has the master list; the line is cut into STRETCHES and every stretch has ONE owner who is the only one
   who moves its people and the only one who sees their tickets (everybody else sees "?"). The shutter of the gate rises with the clock: sort the line before it opens.
   n = 3: FOREMAN (0, JUDGE) + STRETCH A (1) + STRETCH B (2).   n = 4: the same + STRETCH C (3).    4 people per stretch, ascending tickets from the gate.
   - FOREMAN: sees the master list (the sorted tickets of every stretch). Taps DICTATE (or keys 1-3): that stretch's owner sees the order on his own table for 7 s.
              Also tells them aloud who must hand whom: the neighbour that has what I need.
   - STRETCH owners: drag a person onto another one to swap places inside the stretch, or onto an empty spot to move there. Between two stretches there are two
              one-way "bridge lanes" (one per direction); every lane has ONE owner: the sender. Drag a person to your outgoing lane (must be free) to hand him over; the neighbour
              takes him from the lane (drag to an empty spot, or just tap him). Nobody ever drags the same person at the same time.
   - A "colado" is a person handed to the neighbour that is farther from his right stretch. 2 colados = the señora loses her temper = lost. Gate fully open = lost too.
   Netcode (absolute messages, re-sent every .5 s): every STRETCH owner owns its state  'st' {t, v, s:[4 tickets, 0 = empty], R:[tickets sent right], L:[tickets sent left],
   aR/aL: how many people I took from the right/left lane}.  A lane is busy while the sender's sent-count is greater than the receiver's taken-count.
   FOREMAN 'dict' [serial per stretch] (a bump = show that stretch's order), 'why' cause of a loss. The foreman decides the verdict (g.finish) from the absolute states. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only
const NF = 4, MAXC = 2, LISTT = 7, FY = 356, RLY = FY - 36, LLY = FY + 34, X0P = 116, XW = 676;
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const SHIRT = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A', '#ff9a56', '#b69cff', '#5fd6d0', '#f4f0e6'];
const LETTER = ['A', 'B', 'C'];
const RED = '#e8434f', RED2 = '#b8283a', PAPER = '#fffdf2', GOLD = '#ffcf33';

/* ───────────── the level: sorted tickets, then one swap across every bridge, then every stretch is shuffled ───────────── */
function makeLevel(R, S) {
  const pool = []; for (let i = 10; i <= 99; i++) pool.push(i);
  const tot = S * NF; for (let i = 0; i < tot; i++) { const j = i + Math.floor(R() * (pool.length - i)); const x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
  const all = pool.slice(0, tot).sort((a, b) => a - b), target = [], cur = [];
  for (let t = 0; t < S; t++) { target.push(all.slice(t * NF, t * NF + NF)); cur.push(all.slice(t * NF, t * NF + NF)); }
  for (let b = 0; b < S - 1; b++) { const i = 2 + Math.floor(R() * 2), j = Math.floor(R() * 2), x = cur[b][i]; cur[b][i] = cur[b + 1][j]; cur[b + 1][j] = x; }
  for (let t = 0; t < S; t++) {
    for (let at = 0; at < 8; at++) {
      for (let i = NF - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = cur[t][i]; cur[t][i] = cur[t][j]; cur[t][j] = x; }
      if (cur[t].filter((v, i) => v !== target[t][i]).length >= 3) break;
    }
  }
  return { all, target, cur };
}

/* ───────────── drawing kit (X is ctx while playing, an offscreen context while the scene is baked) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(build, base, shade, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col, size = 15) {
  X.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const w = Math.min(150, X.measureText(t(label)).width + 22), h = size + 10;
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - h / 2 + 3, w - 12, h * .24, h * .12); X.fill();
  txt(label, x, y + 1, size, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(360, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 360);
  X.restore();
}
function ticket(x, y, w, h, s, hl, rot = -.05) {            // a paper ticket (s = the number, or '?')
  X.save(); X.translate(x, y); X.rotate(rot); rr(-w / 2, -h / 2, w, h, 3); ink(hl ? '#fff3a0' : PAPER, 2);
  X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(-w / 2 + 3, -h / 2 + 2, w * .4, 2);
  txt(String(s), 0, 1, h * .8, s === '?' ? '#8f88a6' : INK, 'center', w - 4); X.restore();
}
function person(x, fy, u, tk, show, o = {}) {              // one person of the line: Caos with a ticket on the chest
  const k = tk % 8, hop = o.hop || 0, y = fy - hop;
  shadow(x, fy + 2, 6.5 * u, 1.6 * u, .2);
  caos(x, y, u, { col: SHIRT[(k * 5 + 1) % 8], mood: o.mood });
  const v = (tk * 7) % 5;
  if (v === 1) { rr(x - 4.4 * u, y - 12.6 * u, 8.8 * u, 2.6 * u, u); ink('#d9435a', 2); rr(x - 5.6 * u, y - 10.8 * u, 11 * u, 1.2 * u, .5 * u); ink('#d9435a', 1.5); }     // cachucha
  else if (v === 2) { line([[x - 4.5 * u, y - 10 * u], [x + 4.5 * u, y - 10 * u]], u * 1.3, '#2b9ee6'); }                                                                    // pañuelo
  else if (v === 3) { for (const sx of [-1, 1]) { el(x + sx * 4.4 * u, y - 10.6 * u, 1.2 * u, 1.4 * u); ink('#ff8fb1', 1.5); } }                                              // rulos
  ticket(x, y - 5.2 * u, 10.5 * u, 5.2 * u, show ? tk : '?', o.hl);
}

/* ───────────── the baked scene: the CLAP warehouse, the sidewalk and the folding table ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 80); g.addColorStop(0, '#9fdcff'); g.addColorStop(1, '#d9f1ff'); X.fillStyle = g; X.fillRect(0, 0, W, 90);
  // the warehouse wall, with its painted band and barred windows
  X.fillStyle = '#f6d9a2'; X.fillRect(0, 34, W, 200); X.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 9; i++) X.fillRect(i * 100 + 20, 34, 40, 200);
  X.fillStyle = RED; X.fillRect(0, 196, W, 26); X.fillStyle = '#ffd23f'; X.fillRect(0, 222, W, 10); X.fillStyle = INK; X.fillRect(0, 30, W, 6); X.fillRect(0, 232, W, 5);
  for (const wx of [300, 400, 500]) { rr(wx - 28, 130, 56, 52, 5); ink('#8fd0f2', 4); X.strokeStyle = INK; X.lineWidth = 3; for (let q = -1; q <= 1; q++) { X.beginPath(); X.moveTo(wx + q * 14, 130); X.lineTo(wx + q * 14, 182); X.stroke(); } }
  X.fillStyle = '#4cb35a'; for (let q = 0; q < 3; q++) { X.beginPath(); X.arc(640 + q * 22, 156 - q * 4, 12, 0, TAU); ink('#4cb35a', 3); }                                // painted palms
  line([[640, 215], [640, 150]], 6, '#8a5a3c'); line([[662, 215], [662, 146]], 6, '#8a5a3c');
  // the gate: dark inside with shelves of food boxes
  rr(14, 62, 106, 178, 6); ink('#2b2640', 5); X.save(); rr(14, 62, 106, 178, 6); X.clip();
  g = X.createLinearGradient(0, 62, 0, 240); g.addColorStop(0, '#3a3156'); g.addColorStop(1, '#6a5a78'); X.fillStyle = g; X.fillRect(14, 62, 106, 178);
  for (let r = 0; r < 4; r++) { X.fillStyle = '#a5622c'; X.fillRect(14, 112 + r * 40, 106, 6); for (let c = 0; c < 3; c++) { rr(20 + c * 34, 80 + r * 40, 30, 30, 3); ink(['#d9944f', '#e6b46a', '#c98443'][(r + c) % 3], 2.5); X.fillStyle = RED; X.fillRect(26 + c * 34, 92 + r * 40, 18, 4); } }
  X.restore();
  rr(10, 58, 114, 186, 8); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
  // the sidewalk
  X.fillStyle = INK; X.fillRect(0, 237, W, 8); X.fillStyle = '#cdc6b6'; X.fillRect(0, 245, W, 12);
  g = X.createLinearGradient(0, 257, 0, H); g.addColorStop(0, '#eadcbc'); g.addColorStop(1, '#cdb98f'); X.fillStyle = g; X.fillRect(0, 257, W, H - 257);
  X.strokeStyle = 'rgba(120,90,50,.26)'; X.lineWidth = 3; for (let r = 0; r < 7; r++) { const y = 257 + r * r * 3 + r * 20; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let c = -6; c <= 14; c++) { X.beginPath(); X.moveTo(400 + (c - 4) * 40, 257); X.lineTo(400 + (c - 4) * 96, H); X.stroke(); }
  // the folding table where each role's controls live
  rr(14, 432, 772, 160, 20); ink('#7a4a22', 5); X.fillStyle = '#c98443'; rr(22, 440, 756, 142, 14); X.fill(); X.fillStyle = 'rgba(255,255,255,.2)'; rr(30, 446, 740, 10, 5); X.fill();
  X.strokeStyle = 'rgba(122,74,34,.5)'; X.lineWidth = 2; for (let i = 1; i < 5; i++) { X.beginPath(); X.moveTo(22, 440 + i * 28); X.lineTo(778, 440 + i * 28); X.stroke(); }
  X = old; return cv2;
}

/* ═════════ the game ═════════ */
function sqClap(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, S = n - 1, me = D.role, judge = me === 0, mt = me - 1;   // mt = my stretch (-1 = foreman)
  const lv = makeLevel(R, S), tgt = {}; lv.all.forEach((v, i) => { tgt[v] = Math.floor(i / NF); });
  const cnt = n === 4 ? 14 : 9, P = n === 4 ? 48 : 66, X0 = X0P + (XW - cnt * P) / 2, U = Math.min(P / 13.5, 4.2);
  const slotX = (tr, k) => X0 + P * (tr * 5 + k + .5), laneX = b => X0 + P * (b * 5 + 4 + .5);
  /* state: ST[t] is the truth of stretch t (mine = local, the others = their last absolute message) */
  const ST = lv.cur.map(a => ({ s: a.slice(), R: [], L: [], aR: 0, aL: 0, v: 0 }));
  const dictS = Array(S).fill(0), dictAtJ = Array(S).fill(-99);
  let seenDict = 0, dictAt = -99, dictList = null, lastBeat = 0, cause = 0, colN = 0, resAt = -1, endFx = false, drag = null, dictFlash = [-9, -9, -9];
  const pops = [], sentAt = {}, tookAt = {};
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  const wrong = () => { let c = 0; for (let tr = 0; tr < S; tr++) { for (const tk of ST[tr].R) if (Math.abs(tr + 1 - tgt[tk]) > Math.abs(tr - tgt[tk])) c++; for (const tk of ST[tr].L) if (Math.abs(tr - 1 - tgt[tk]) > Math.abs(tr - tgt[tk])) c++; } return c; };
  const laneList = () => {
    const out = [];
    for (let b = 0; b < S - 1; b++) {
      out.push({ b, dir: 'R', from: b, to: b + 1, x: laneX(b), y: RLY, occ: ST[b].R.length > ST[b + 1].aL, tk: ST[b].R[ST[b + 1].aL] });
      out.push({ b, dir: 'L', from: b + 1, to: b, x: laneX(b), y: LLY, occ: ST[b + 1].L.length > ST[b].aR, tk: ST[b + 1].L[ST[b].aR] });
    }
    return out;
  };
  const okOf = tr => ST[tr].s.every((v, i) => v === lv.target[tr][i]);
  function sendSt() { const s = ST[mt]; D.send('st', { t: mt, v: s.v, s: s.s, R: s.R, L: s.L, aR: s.aR, aL: s.aL }); }
  function bump() { ST[mt].v++; sendSt(); }
  /* ── the foreman ── */
  function dictate(tr) {
    if (!judge || g.result || tr < 0 || tr >= S) return; dictS[tr]++; dictAtJ[tr] = g.c; dictFlash[tr] = g.c; D.send('dict', dictS.slice()); snd(520 + tr * 90, .1, 'triangle', .07); noise(.06, .06, 1800, 2600, 'bandpass');
  }
  /* ── a stretch owner ── */
  const slotHit = (px, py, tr, k) => Math.abs(px - slotX(tr, k)) <= P * .52 && py >= FY - 66 && py <= FY + 12;
  const laneHit = (px, py, L) => Math.abs(px - L.x) <= P * .52 && py >= L.y - 66 && py <= L.y + 12;
  function nearSlot(px, py) { let best = -1, bd = 1e9; for (let k = 0; k < NF; k++) { const d = Math.abs(px - slotX(mt, k)); if (d < bd && d <= P * .62 && py >= FY - 90 && py <= FY + 36) { bd = d; best = k; } } return best; }
  function nearOutLane(px, py) { let best = null, bd = 1e9; for (const L of laneList()) if (L.from === mt) { const d = Math.hypot(px - L.x, py - (L.y - 24)); if (d < bd && d <= P * .9) { bd = d; best = L; } } return best; }
  function takeLane(L, k) {
    const s = ST[mt]; if (s.s[k] || !L.occ || L.to !== mt) return false;
    s.s[k] = L.tk; if (L.dir === 'R') s.aL++; else s.aR++; tookAt[L.tk] = g.c; bump(); snd(420, .08, 'triangle', .06, 0, 600); return true;
  }
  function releaseDrag(p) {
    const d = drag; drag = null; if (!d || g.result) return; const s = ST[mt], px = p.x, py = p.y, moved = Math.hypot(px - d.sx, py - d.sy) > 9;
    if (d.src === 's') {
      const j = nearSlot(px, py), L = nearOutLane(px, py);
      if (L && !L.occ && L.from === mt) { s.s[d.k] = 0; if (L.dir === 'R') s.R.push(d.tk); else s.L.push(d.tk); sentAt[d.tk] = g.c; bump(); snd(300, .12, 'square', .05, 0, 520); noise(.1, .07, 900, 2200, 'bandpass'); return; }
      if (j >= 0 && j !== d.k) { const o = s.s[j]; s.s[j] = d.tk; s.s[d.k] = o; bump(); snd(240, .06, 'square', .06, 0, 160); return; }
    } else {
      const L = d.lane, fresh = laneList().find(q => q.dir === L.dir && q.b === L.b); if (!fresh || !fresh.occ) return;
      let j = moved ? nearSlot(px, py) : -1; if (j >= 0 && s.s[j]) j = -1; if (j < 0 && !moved) j = s.s.findIndex(v => !v);
      if (j >= 0) takeLane(fresh, j);
    }
  }
  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: judge ? 'DICTATE THE ORDER!' : 'SORT THE LINE!', roleLabel: judge ? 'FOREMAN' : 'STRETCH ' + LETTER[mt],
    hint: judge ? 'DICTATE EACH STRETCH ITS ORDER (CLICK DICTATE OR KEYS 1-' + S + ') - TELL THEM WHO HANDS WHOM'
      : 'DRAG PEOPLE TO SWAP PLACES - DRAG ONE TO YOUR BRIDGE LANE TO HAND HIM OVER - THE FOREMAN DICTATES THE ORDER',
    thint: judge ? 'TAP DICTATE TO SHOW A STRETCH ITS ORDER - TELL THEM WHO HANDS WHOM'
      : 'DRAG PEOPLE TO SWAP PLACES - DRAG ONE TO YOUR BRIDGE LANE TO HAND HIM OVER - THE FOREMAN DICTATES THE ORDER',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      if (!g.result) {
        if (g.c - lastBeat >= .5) { lastBeat = g.c; if (mt >= 0) sendSt(); else { D.send('dict', dictS.slice()); if (cause) D.send('why', cause); } }
        const w = wrong(); if (w > colN) { colN = w; pop('QUEUE JUMPER!', 400, 300, 24, '#e8343d'); sfx.miss(); shake(4, .12); }
        if (judge) {
          if (w >= MAXC) { cause = 1; D.send('why', 1); g.finish('lose'); }
          else if (g.c >= g.limit) { cause = 2; D.send('why', 2); g.finish('lose'); }
          else if (ST.every((_, tr) => okOf(tr)) && laneList().every(L => !L.occ)) g.finish('win');
        }
      }
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); for (let i = 0; i < 4; i++) noise(.05, .1, 1800, 3000, 'bandpass', i * .09); }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(300, .5, 'sawtooth', .06, 0, 90); noise(.35, .12, 300, 900, 'lowpass', .45); shake(7, .28); }
      while (pops.length && g.c - pops[0].t0 > 1.0) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'st') {
        if (d && typeof d === 'object' && from >= 1 && d.t === from - 1 && d.t < S && d.t !== mt && d.v > ST[d.t].v && Array.isArray(d.s) && Array.isArray(d.R) && Array.isArray(d.L)) ST[d.t] = { s: d.s.slice(0, NF), R: d.R.slice(), L: d.L.slice(), aR: d.aR | 0, aL: d.aL | 0, v: d.v };
      } else if (type === 'dict') {
        if (Array.isArray(d) && mt >= 0 && (d[mt] | 0) > seenDict) { seenDict = d[mt] | 0; dictAt = g.c; dictList = lv.target[mt].slice(); snd(560, .09, 'triangle', .06); noise(.05, .05, 1600, 2400, 'bandpass'); }
      } else if (type === 'why') cause = d | 0;
    },
    draw(t0) {
      X = ctx; const T = g.c, won = g.result === 'win', over = !!g.result, lostG = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1, mood = won ? 'happy' : lostG ? 'sad' : null;
      if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      // the shutter: it rises with the clock (the clock IS the gate) and flies open when the game ends
      const playOpen = clamp(T / Math.max(1, g.limit), 0, 1) * .88, openK = over ? Math.max(playOpen, ease(rk / .35)) : playOpen, shH = 176 * (1 - openK);
      if (shH > 1) { rr(16, 64, 102, shH, 4); ink('#c9ced6', 3); X.save(); rr(16, 64, 102, shH, 4); X.clip(); X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 2; for (let y = 76; y < 64 + shH; y += 12) { X.beginPath(); X.moveTo(16, y); X.lineTo(118, y); X.stroke(); } X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(22, 64, 12, shH); X.restore(); rr(54, 64 + shH - 10, 26, 8, 3); ink(GOLD, 2); }
      // signs: the CLAP sign, the colados counter
      line([[330, 36], [330, 56]], 3, INK); line([[620, 36], [620, 56]], 3, INK);
      rr(200, 48, 250, 54, 10); ink('#fff7e6', 4); txt('CLAP BOX LINE', 325, 76, 24, RED2, 'center', 224);
      rr(530, 48, 200, 54, 10); ink('#fff7e6', 4); txt(t('JUMPERS {a}/{b}', { a: Math.min(colN, MAXC), b: MAXC }) + '', 630, 76, 20, colN ? '#e8343d' : RED2, 'center', 178);
      g._scene(T, won, lostG, rk, mood, openK);
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      if (!over && T < 2.6) badge(judge ? 'DICTATE THE ORDER!' : 'SORT THE LINE!', 400, 296, 22, judge ? '#22a447' : '#2b9ee6', '#fff', outBack(T / .25), -.03);
      if (over && rk >= 0) {
        if (won) {
          for (let i = 0; i < 18; i++) { const dd = rk - hash(i + 2) * .6; if (dd < 0) continue; const fx = 130 + hash(i) * 650 + Math.sin(dd * 4 + i) * 14, fy = -20 + dd * (200 + hash(i + 7) * 90); if (fy < 430) { X.save(); X.translate(fx, fy); X.rotate(dd * 3 + i); rr(-9, -6, 18, 12, 2); ink(SHIRT[i % 8], 2); X.restore(); } }
          if (rk > .25) badge('FOOD FOR EVERYONE!', 400, 290, 34, '#22a447', '#fff', outBack((rk - .25) / .25), -.04);
        } else {
          if (rk > .45) badge('WHACK!', 250, 200, 36, '#ffb020', '#fff', outBack((rk - .45) / .2), -.1);
          if (rk > .7) badge(cause === 1 ? 'QUEUE JUMPER!' : 'THE GATE OPENED!', 440, 290, 32, '#e8343d', '#fff', outBack((rk - .7) / .25), .04);
        }
      }
      vignette(.14);
    },
    _scene(T, won, lostG, rk, mood, openK) {
      const over = !!g.result;
      // the señora of the CLAP at the gate, with her clipboard and her purse; a neighbour in a chair with an umbrella; the sleeping dog
      { const sx = 150, sy = 280, sw = lostG && rk > .2 ? clamp((rk - .2) / .25, 0, 1) : 0, swing = lostG ? (rk < .2 ? -.5 : -.5 + sw * 2.4 - (rk > .6 ? ease((rk - .6) / .4) * 1.3 : 0)) : won ? Math.sin(T * 8) * .15 : Math.sin(T * 2) * .05;
        shadow(sx, sy + 2, 30, 7, .22);
        rr(sx - 20, sy - 56, 40, 56, 12); cel(() => rr(sx - 20, sy - 56, 40, 56, 12), '#ff7ab6', '#d9548f', 7, 0, 4);
        el(sx, sy - 70, 17, 17); ink('#ffd2a8', 3); el(sx, sy - 90, 12, 8); ink('#4a2f20', 2.5);   // head, bun
        X.fillStyle = INK; for (const ex of [-6, 6]) { X.beginPath(); X.arc(sx + ex, sy - 71, 2.4, 0, TAU); X.fill(); }
        if (lostG) { el(sx, sy - 62, 5, 4); ink('#7a1f2e', 1.5); line([[sx - 12, sy - 80], [sx - 3, sy - 76]], 3, INK); line([[sx + 12, sy - 80], [sx + 3, sy - 76]], 3, INK); }
        else if (won) { X.beginPath(); X.arc(sx, sy - 64, 7, 0, Math.PI); ink('#7a1f2e', 1.5); } else line([[sx - 6, sy - 62], [sx + 6, sy - 62]], 3, INK);
        if (won) { const bb = Math.abs(Math.sin(T * 8)) * 4; rr(sx - 50, sy - 84 - bb, 30, 26, 3); ink('#d9944f', 3); X.fillStyle = RED; X.fillRect(sx - 44, sy - 74 - bb, 18, 5); line([[sx - 20, sy - 40], [sx - 40, sy - 62 - bb]], 6, '#ffd2a8'); }
        else { rr(sx - 36, sy - 44, 16, 22, 3); ink(PAPER, 2.5); }                                      // clipboard
        X.save(); X.translate(sx + 20, sy - 46); X.rotate(swing); line([[0, 0], [28, 6]], 6, '#ffd2a8'); rr(26, 4, 26, 22, 5); ink('#7a4a22', 3); X.restore();   // arm + purse
      }
      { const cx = 748, cy = 290; shadow(cx, cy + 3, 26, 6, .2); rr(cx - 17, cy - 52, 34, 8, 3); ink('#e8434f', 2.5); rr(cx - 14, cy - 28, 28, 8, 3); ink('#2b9ee6', 2.5);
        X.beginPath(); X.arc(cx, cy - 78, 36, Math.PI, 0); X.closePath(); ink('#ffd23f', 3.5); line([[cx, cy - 78], [cx, cy - 30]], 3, '#8a5a3c');
        el(cx, cy - 22, 11, 12); ink('#ffd2a8', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(cx - 4, cy - 23, 1.6, 0, TAU); X.arc(cx + 4, cy - 23, 1.6, 0, TAU); X.fill(); }
      { const dx = 650, dy = 292; shadow(dx, dy + 2, 30, 6, .18); cel(() => el(dx, dy - 12, 26, 12), '#c98a52', '#9e6a3a', 5, -4, 3); el(dx + 24, dy - 14, 11, 9); ink('#c98a52', 3); el(dx + 20, dy - 22, 4, 7, -.3); ink('#6b4220', 2);
        if (!g.result) for (let i = 0; i < 2; i++) { const k = (T * .5 + i * .5) % 1; X.globalAlpha = 1 - k; txt('z', dx + 34 + i * 10, dy - 30 - k * 26, 14 + i * 4, '#fff'); X.globalAlpha = 1; } }
      // chalk strips and name tags under every stretch
      for (let tr = 0; tr < S; tr++) {
        const c = cols(tr + 1), x1 = slotX(tr, 0) - P / 2 + 2, x2 = slotX(tr, NF - 1) + P / 2 - 2;
        rr(x1, FY - 8, x2 - x1, 22, 10); X.globalAlpha = .55; ink(c, 3); X.globalAlpha = 1;
        pill((x1 + x2) / 2, FY + 36 + 0, tr + 1 === me ? 'YOU' : name(tr + 1), c, 14); txt('STRETCH ' + LETTER[tr], (x1 + x2) / 2, FY + 58, 13, '#fff', 'center', x2 - x1);
        for (let k = 0; k < NF; k++) if (!ST[tr].s[k] && !(drag && drag.src === 's' && tr === mt && drag.k === k)) { X.beginPath(); X.setLineDash([5, 5]); X.arc(slotX(tr, k), FY - 2, P * .22, 0, TAU); X.lineWidth = 3; X.strokeStyle = 'rgba(20,16,28,.45)'; X.stroke(); X.setLineDash([]); }
      }
      // bridge lanes: two planks, one per direction, each marked with its arrow in the sender's colour
      const lanes = laneList();
      for (const L of lanes) {
        const c = cols(L.from + 1); rr(L.x - P * .48, L.y - 6, P * .96, 14, 4); ink('#c98443', 3); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(L.x - P * .42, L.y - 4, P * .84, 3);
        txt(L.dir === 'R' ? '►' : '◄', L.x, L.y + 2, 12, c, 'center', 20);
      }
      // the people, back to front
      const items = [];
      const hide0 = lostG && rk > .45;
      for (let tr = 0; tr < S; tr++) for (let k = 0; k < NF; k++) {
        const tk = ST[tr].s[k]; if (!tk || (drag && drag.src === 's' && tr === mt && drag.k === k) || (hide0 && tr === 0 && k === 0)) continue;
        const dd = tookAt[tk] !== undefined && tr === mt ? clamp((T - tookAt[tk]) / .2, 0, 1) : 1;
        items.push({ y: FY, f: () => person(slotX(tr, k), FY - (1 - ease(dd)) * 16, U, tk, tr === mt, { mood, hop: won ? Math.abs(Math.sin(T * 9 + tr * 2 + k)) * 9 : 0, hl: tr === mt && dictList && dictList.includes(tk) && T - dictAt < LISTT }) });
      }
      for (const L of lanes) if (L.occ && L.tk && !(drag && drag.src === 'l' && drag.lane.b === L.b && drag.lane.dir === L.dir)) {
        const see = L.from === mt || L.to === mt; items.push({ y: L.y, f: () => person(L.x, L.y - (Math.sin(T * 6 + L.b) * 2 + 2), U, L.tk, see, { mood, hl: L.to === mt }) });
        if (L.to === mt) items[items.length - 1].f2 = () => { const bb = (T * 3) % 1; X.globalAlpha = 1 - bb * .6; tri(L.x - 6, L.y - 64 - bb * 6, L.x + 6, L.y - 64 - bb * 6, L.x, L.y - 56 - bb * 6, GOLD, 2); X.globalAlpha = 1; };
      }
      items.sort((a, b) => a.y - b.y); for (const it of items) { it.f(); if (it.f2) it.f2(); }
      if (drag) { const sc = 1.12; X.save(); X.translate(drag.x, drag.y + 22); X.scale(sc, sc); person(0, 8, U, drag.tk, true, { hl: true }); X.restore(); }
      // the colado flies out of the gate
      if (lostG && rk > .45) { const tau = rk - .45, fx0 = slotX(0, 0), qx = fx0 - 680 * tau, qy = FY - 18 - 520 * tau + 900 * tau * tau; X.save(); X.translate(qx, qy); X.rotate(-tau * 12); person(0, 0, U, lv.target[0][0], true, { mood: 'sad' }); X.restore();
        if (tau < .35) { X.save(); X.translate(fx0 + 6, FY - 40); X.rotate(tau * 3); star(0, 0, 26 * (1 - tau * 1.4), 10, 8, 0, '#ffe14d', 3); X.restore(); } }
      // the role's table
      if (!over) { if (judge) g._judgePanel(T); else g._ownerPanel(T); }
      else { rr(150, 470, 500, 90, 18); ink('#fff7e6', 4); txt(won ? 'THE LINE IS READY!' : 'THE LINE IS A MESS!', 400, 515, 28, won ? '#22a447' : RED2, 'center', 460); }
    },
    _judgePanel(T) {
      const cw = 740 / S;
      for (let tr = 0; tr < S; tr++) {
        const x0 = 30 + tr * cw, c = cols(tr + 1), ok = okOf(tr), fl = Math.exp(-(T - dictFlash[tr]) / .15), dn = fl > .4 ? 3 : 7;
        rr(x0 + 4, 448, cw - 8, 68, 10); ink(PAPER, 3); rr(x0 + 4, 448, cw - 8, 22, 10); ink(c, 3); txt('STRETCH ' + LETTER[tr], x0 + cw / 2, 460, 15, INK, 'center', cw - 24);
        const ww = (cw - 20) / NF; lv.target[tr].forEach((v, i) => ticket(x0 + 10 + ww * (i + .5), 495, Math.min(52, ww - 6), 26, v, false, 0));
        const by = 526; rr(x0 + 10, by + 6, cw - 20, 44, 14); ink('#3a3550', 4); rr(x0 + 10, by + 6 - dn, cw - 20, 44, 14); ink(fl > .1 ? '#ffe14d' : '#ffd23f', 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(x0 + 20, by + 10 - dn, cw - 40, 7, 3); X.fill();
        txt('DICTATE', x0 + cw / 2 + (TOUCH ? 0 : 12), by + 28 - dn, 20, INK, 'center', cw - 70);
        if (!TOUCH) { rr(x0 + 18, by + 14 - dn, 22, 24, 6); ink('#fff', 2); txt(String(tr + 1), x0 + 29, by + 27 - dn, 15, INK); }
        if (ok) { X.save(); X.translate(x0 + cw - 34, 500); X.rotate(.3); badge('DONE!', 0, 0, 15, '#22a447', '#fff', 1, 0); X.restore(); }
      }
    },
    _ownerPanel(T) {
      const age = T - dictAt, show = age >= 0 && age < LISTT && dictList, k = outBack(age / .25);
      rr(120, 450, 560, 128, 12); ink('#eadfc6', 3);
      if (show) {
        const have = ST[mt].s, ww = 500 / NF; X.save(); X.translate(400, 514); X.scale(k, k); X.translate(-400, -514);
        rr(130, 456, 540, 116, 10); ink(PAPER, 3); txt('FOREMAN LIST', 400, 474, 16, RED2, 'center', 360);
        dictList.forEach((v, i) => { const x = 150 + ww * (i + .5), mine = have.includes(v); ticket(x, 520, 64, 36, v, mine, 0); X.globalAlpha = mine ? 1 : .5; if (mine) txt('✓', x + 26, 500, 18, '#22a447'); X.globalAlpha = 1; txt(String(i + 1), x, 552, 14, '#8f88a6'); });
        X.fillStyle = 'rgba(20,16,28,.2)'; rr(146, 563, 508, 6, 3); X.fill(); X.fillStyle = age > LISTT - 2 ? '#e8434f' : '#7CE08A'; rr(146, 563, 508 * clamp(1 - age / LISTT, 0, 1), 6, 3); X.fill(); X.restore();
      } else {
        rr(130, 456, 540, 116, 10); ink('#f7f2e2', 3); txt(dictAt > -50 ? 'ASK THE FOREMAN FOR THE ORDER AGAIN' : 'WAITING FOR THE FOREMAN...', 400, 514, 22, '#8f88a6', 'center', 500);
      }
    },
    down(p) {
      if (g.result) return;
      if (judge) { const cw = 740 / S; for (let tr = 0; tr < S; tr++) { const x0 = 30 + tr * cw; if (p.x >= x0 + 10 && p.x <= x0 + cw - 10 && p.y >= 524 && p.y <= 584) { dictate(tr); return; } } return; }
      if (mt < 0) return;
      for (let k = 0; k < NF; k++) if (ST[mt].s[k] && slotHit(p.x, p.y, mt, k)) { drag = { src: 's', k, tk: ST[mt].s[k], x: p.x, y: p.y, sx: p.x, sy: p.y }; return; }
      for (const L of laneList()) if (L.to === mt && L.occ && L.tk && laneHit(p.x, p.y, L)) { drag = { src: 'l', lane: L, tk: L.tk, x: p.x, y: p.y, sx: p.x, sy: p.y }; return; }
    },
    move(p) { if (drag) { drag.x = p.x; drag.y = p.y; } },
    up(p) { if (drag) releaseDrag(p || drag); },
    key(e) {
      if (g.result || !judge) return; const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code); if (m) dictate(+m[1] - 1);
    },
    keyup() {},
  };
  g.dbg = {
    view: () => {
      const base = { me, n, S, T: g.c, colados: colN, ver: me };
      if (judge) return Object.assign(base, { judge: true, target: lv.target.map(a => a.slice()), ok: lv.target.map((_, tr) => okOf(tr)), dictAge: dictAtJ.map(x => g.c - x) });
      const s = ST[mt], lanes = laneList(), age = g.c - dictAt;
      return Object.assign(base, { tramo: mt, P,
        slots: s.s.map((tk, k) => ({ k, tk, x: slotX(mt, k), y: FY - 24 })),
        dict: age < LISTT && dictList ? dictList.slice() : null, dictNew: seenDict,
        out: lanes.filter(L => L.from === mt).map(L => ({ dir: L.dir, x: L.x, y: L.y - 24, free: !L.occ })),
        inc: lanes.filter(L => L.to === mt && L.occ && L.tk).map(L => ({ dir: L.dir, x: L.x, y: L.y - 24, tk: L.tk })), dragging: !!drag });
    },
    lv, ST,
  };
  wire(g, D, 0, sp, 'sq_clap');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, tm) {
  X = ctx;
  X.fillStyle = '#f6d9a2'; X.fillRect(0, 0, 520, 90); X.fillStyle = RED; X.fillRect(0, 70, 520, 14); X.fillStyle = INK; X.fillRect(0, 88, 520, 5);
  X.fillStyle = '#eadcbc'; X.fillRect(0, 93, 520, 147);
  rr(20, 14, 60, 72, 4); ink('#2b2640', 3); X.fillStyle = '#c9ced6'; X.fillRect(22, 16, 56, 26);
  const u = tm % 4;
  if (role === 0) {
    rr(110, 110, 300, 96, 10); ink(PAPER, 3); [14, 27, 41, 63].forEach((v, i) => ticket(150 + i * 72, 150, 56, 30, v, u > 1 && u < 3 && i === 2, 0));
    const on = u % 2 < 1; rr(180, 184, 160, 40, 12); ink(on ? '#ffe14d' : '#ffd23f', 3); txt('DICTATE', 260, 204, 18, INK, 'center', 140);
    demoFinger(260, 214, u % 2 < .5, (u % 2) * 1.5); badge('DICTATE THE ORDER!', 330, 40, 15, '#22a447', '#fff', 1, -.03);
  } else {
    const k = ease(clamp((u - .5) / 1.2, 0, 1)), xs = [110, 190, 270, 350];
    const a = xs[0] + (xs[2] - xs[0]) * k, c = xs[2] + (xs[0] - xs[2]) * k;
    for (const [x, tk] of [[a, 42], [xs[1], 17], [c, 8], [xs[3], 55]]) person(x, 200, 5, tk, true, { hl: tk === 42 || tk === 8 });
    demoFinger(a, 190 - 20 * (k > 0 && k < 1 ? 1 : 0), u > .4 && u < 1.9, (u % 2) * 1);
    badge('SORT THE LINE!', 330, 40, 15, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_clap', sqClap, 'COLA DEL CLAP'); REGMAP.sq_clap.duo = true; REGMAP.sq_clap.squad = true;
DUO.INFO.sq_clap = n => [
  ['FOREMAN', 'DICTATE EACH STRETCH ITS ORDER AND SAY WHO HANDS WHOM', n === 4 ? 'CLICK DICTATE / KEYS 1-3' : 'CLICK DICTATE / KEYS 1-2'],
  ['STRETCH A', 'SWAP PEOPLE AND HAND THEM OVER THE BRIDGE', 'DRAG A PERSON'],
  ['STRETCH B', 'SWAP PEOPLE AND HAND THEM OVER THE BRIDGE', 'DRAG A PERSON'],
  ['STRETCH C', 'SWAP PEOPLE AND HAND THEM OVER THE BRIDGE', 'DRAG A PERSON'],
].slice(0, n);
DUO.DEMOS.sq_clap = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
