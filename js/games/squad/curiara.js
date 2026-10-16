'use strict';
/* ═════════ SQUAD · CURIARA EN EL CAÑO (sq_curiara), 3-4 players, one role each ═════════
   A dugout canoe (curiara) has to cross a llanos river in the Orinoco delta: rocks, caimanes and swimming chigüires in the way, a hull that leaks,
   and a far bank where the llanero is waiting. Seen from above, the river scrolls past the canoe.
   n = 4:  RIVER GUIDE / BAQUIANO (0, JUDGE)  stands at the bow and is the only one who sees the river ahead: rocks, caimanes, chigüires and the far bank.
                               Sets the rudder (drag the tiller / A D). The boat has no other steering: the oars do not pull evenly.
           LEFT OAR (1), RIGHT OAR (2)  each pull their own oar and see ONLY their own oar gauge (the river ahead is mist for them). HOLD = pull, let go
                               inside the green band = a full stroke (too soon = weak, too late = crab). The boat drifts to the side of the stronger oar.
           BAILER / ACHICADOR (3)  sees the leak meter and taps to bail. It rises all the time, faster after every hit.
   n = 3:  the BAILER is cut: the Baquiano bails too (Space / the BAIL button) while he steers.
   Win = the bow touches the far bank with fewer than 2 hits. Lose = 2 hits (the canoe is wrecked), the hull fills up, a chigüire climbs aboard, or time.
   The river is identical on every screen whatever n / role (all draws from mkR() in the constructor, always the same number of them).
   Netcode: every role owns its variables, the others render them:
     OARS     'st' [power*100]   (a stroke was released: the judge adds that thrust to that side; the others animate the oar)
     BAILER   'w' [water*1000]   (the leak meter, coalesced), 'bl' 1 (cosmetic: I scooped)
     GUIDE    'bt' [x*10, y*10, heading*1000, tL*100, tR*100, rudder*100, hits] (coalesced <=12/s), 'hit' {k, i}, 'why' cause
   The Baquiano (judge) integrates the boat from the oars' strokes and decides the verdict ('end', via wire). Water level comes from the bailer. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ───────────── the river (world px: x across from the middle, y along the river; the boat starts at y = 0) ───────────── */
const HW = 228, BANKY = 1190, WINY = 1118, CAMY = 390;       // half width of the navigable water, shoreline of the far bank, boat y that counts as arrived, screen y of the boat
const ROWS = 4, ROW0 = 260, RSP = 260, HALF = 90;            // hazard rows: first y, spacing, half distance between the two hazards of a row (the gap is between them)
const HR = [24, 22, 20], HNAME = ['PEÑA', 'CAIMÁN', 'CHIGÜIRE'];
const K = 80, TAUT = .5, AIMB = 1.0, RRUD = 1.6, DH = 2.0;   // speed per unit of thrust, thrust decay, turn from imbalance, from rudder, heading damping
const CHG = .75, BLO = .6, BHI = .9, LOCK = .22;             // seconds to fill the oar gauge, the green band, pause after a stroke
const W0 = .4, LEAK0 = .085, LEAKH = .05, BAILV = .11;
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const NAMES = ['RIVER GUIDE', 'LEFT OAR', 'RIGHT OAR', 'BAILER'];
const WOOD = '#c98443', WOOD2 = '#9a5f2c', WOODL = '#e6a867';
const power = c => c < .35 ? .25 : c < BLO ? .25 + .75 * (c - .35) / (BLO - .35) : c <= BHI ? (Math.abs(c - .75) < .06 ? 1.15 : 1) : .4;

/* ───────────── tiny drawing kit (X is always ctx here) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 26);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 14);
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
function plate(x, y, w, h, col, dk, down, label, cap, dim) {   // chunky control slab with depth and a key cap
  const d = down ? 3 : 9;
  rr(x, y + 9, w, h, 18); ink(dim ? '#8f88a6' : dk, 4);
  rr(x, y + 9 - d, w, h, 18); ink(dim ? '#d3cfe0' : col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 9, 4); X.fill();
  rr(x, y + 9 - d, w, h, 18); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  const kc = cap && !TOUCH;
  txt(label, x + w / 2 - (kc ? 22 : 0), y + 9 - d + h / 2, 24, dim ? 'rgba(246,244,251,.8)' : '#fff', 'center', w - (kc ? 120 : 30));
  if (kc) { X.font = '700 14px Fredoka, Arial, sans-serif'; const cw = Math.max(26, X.measureText(t(cap)).width + 14); rr(x + w - cw - 12, y + 9 - d + h / 2 - 10, cw, 20, 6); ink('#fff', 2.5); txt(cap, x + w - cw / 2 - 12, y + 9 - d + h / 2 + 1, 13, INK, 'center', cw - 4); }
}
function heart(x, y, s, full) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink(full ? '#ff5c8a' : '#bdb6cf', 3); if (full) { X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); } else line([[-3, -8], [2, -2], [-2, 2], [3, 6]], 2, INK);
  X.restore();
}
function cloud(x, y, sc) {
  X.save(); X.translate(x, y); X.scale(sc, sc); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
}

/* ───────────── things on the water / on the bank ───────────── */
function rock(x, y, r) {
  el(x, y + 4, r * 1.1, r * .55); X.fillStyle = 'rgba(20,16,28,.22)'; X.fill();
  X.beginPath(); X.moveTo(x - r, y + r * .3); X.lineTo(x - r * .7, y - r * .7); X.lineTo(x + r * .1, y - r * 1.05); X.lineTo(x + r * .9, y - r * .5); X.lineTo(x + r, y + r * .35); X.closePath(); ink('#a3a8b8', 4);
  X.save(); X.clip(); X.fillStyle = '#7e8499'; X.fillRect(x, y - r * 1.2, r * 1.3, r * 2); X.restore();
  X.beginPath(); X.moveTo(x - r, y + r * .3); X.lineTo(x - r * .7, y - r * .7); X.lineTo(x + r * .1, y - r * 1.05); X.lineTo(x + r * .9, y - r * .5); X.lineTo(x + r, y + r * .35); X.closePath(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  glint(x - r * .35, y - r * .5, r * .3, r * .16, -.5, .55);
  el(x, y + r * .42, r * 1.25, r * .3); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.7)'; X.stroke();
}
function caiman(x, y, T, bite) {                            // seen from above, snout up the river; bite = 0..1 jaw opening
  const sw = Math.sin(T * 3 + x) * .12;
  X.save(); X.translate(x, y); X.rotate(sw);
  X.beginPath(); X.moveTo(0, 22); X.quadraticCurveTo(-6, 44, 2, 58 + Math.sin(T * 4) * 4); X.quadraticCurveTo(10, 44, 0, 22); X.closePath(); ink('#3f8f43', 3);
  el(0, 6, 15, 26); ink('#5fb85a', 4); X.save(); el(0, 6, 15, 26); X.clip(); X.fillStyle = '#3f8f43'; X.fillRect(4, -30, 20, 70); X.restore();
  el(0, 6, 15, 26); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  X.fillStyle = '#2f6e33'; for (let q = 0; q < 4; q++) { rr(-4, -8 + q * 12, 8, 6, 2); X.fill(); }
  X.beginPath(); X.moveTo(-9, -14); X.quadraticCurveTo(-11, -40, -4, -52); X.lineTo(4, -52); X.quadraticCurveTo(11, -40, 9, -14); X.closePath(); ink('#5fb85a', 4);
  if (bite > 0) { X.fillStyle = '#7a1f2e'; X.beginPath(); X.moveTo(-6, -48); X.lineTo(6, -48); X.lineTo(0, -48 + 14 * bite); X.fill(); }
  X.fillStyle = '#fff'; for (let q = 0; q < 3; q++) { X.beginPath(); X.moveTo(-8, -22 - q * 9); X.lineTo(-5, -20 - q * 9); X.lineTo(-8, -17 - q * 9); X.fill(); X.beginPath(); X.moveTo(8, -22 - q * 9); X.lineTo(5, -20 - q * 9); X.lineTo(8, -17 - q * 9); X.fill(); }
  for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 8, -6, 5.5, 0, TAU); ink('#fff', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(s * 8, -5, 2.4, 0, TAU); X.fill(); }
  X.restore();
}
function chig(x, y, T, o = {}) {                            // a swimming capybara: head, ears, nose above the water, a ripple ring
  const bob = Math.sin(T * 3 + x * .1) * 1.5;
  el(x, y + 6, 30 + Math.sin(T * 2) * 2, 12); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.75)'; X.stroke();
  el(x, y + 4 + bob, 24, 17); ink('#a8703a', 4); glint(x - 8, y - 2 + bob, 8, 4, -.4, .35);
  el(x, y - 7 + bob, 15, 13); ink('#c08848', 4); for (const s of [-1, 1]) { el(x + s * 12, y - 16 + bob, 4.5, 5); ink('#8d5a2c', 2.5); }
  el(x, y - 1 + bob, 10, 8); ink('#e0a96a', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(x - 3, y - 2 + bob, 1.6, 0, TAU); X.arc(x + 3, y - 2 + bob, 1.6, 0, TAU); X.fill();
  for (const s of [-1, 1]) { X.beginPath(); X.arc(x + s * 7, y - 10 + bob, 3.3, 0, TAU); ink('#fff', 2); X.fillStyle = INK; X.beginPath(); X.arc(x + s * 7.5, y - 10 + bob, 1.5, 0, TAU); X.fill(); }
  if (o.calm) { X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.arc(x, y + 1 + bob, 3, .2, Math.PI - .2); X.stroke(); }
}
function palm(x, y, sc, T, s) {
  X.save(); X.translate(x, y); X.scale(sc, sc); line([[0, 0], [3, -34], [-2, -66]], 7, '#8a5a34');
  for (let q = 0; q < 7; q++) { const a = q * TAU / 7 + .3 + Math.sin(T * 1.4 + s) * .06; X.beginPath(); X.moveTo(-2, -66); X.quadraticCurveTo(-2 + Math.cos(a) * 24, -66 + Math.sin(a) * 10 - 20, -2 + Math.cos(a) * 46, -66 + Math.sin(a) * 22); X.quadraticCurveTo(-2 + Math.cos(a) * 24, -66 + Math.sin(a) * 10 - 4, -2, -66); ink('#3fb260', 2.5); }
  X.restore();
}

/* the canoe, seen from above, bow up. cx, cy = middle; rot = heading. Oars and crew are drawn by the caller. */
function hullPath() { X.beginPath(); X.moveTo(0, -76); X.bezierCurveTo(18, -52, 25, -30, 25, 0); X.bezierCurveTo(25, 40, 19, 62, 0, 72); X.bezierCurveTo(-19, 62, -25, 40, -25, 0); X.bezierCurveTo(-25, -30, -18, -52, 0, -76); X.closePath(); }
function inner() { X.beginPath(); X.moveTo(0, -62); X.bezierCurveTo(12, -44, 16, -26, 16, 0); X.bezierCurveTo(16, 36, 12, 54, 0, 62); X.bezierCurveTo(-12, 54, -16, 36, -16, 0); X.bezierCurveTo(-16, -26, -12, -44, 0, -62); X.closePath(); }

/* ═════════ the game ═════════ */
function sqCuriara(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0;
  const rower = me === 1 || me === 2, bailerRole = n === 4 ? 3 : 0, bails = me === bailerRole;
  /* the river: identical on every screen (5 draws per row) */
  const HZ = [];
  for (let i = 0; i < ROWS; i++) {
    const sg = R() < .5 ? -1 : 1, mg = 68 + R() * 18, k1 = R(), k2 = R(), ph = R() * TAU, gx = sg * mg;
    [-1, 1].forEach((s, j) => { const u = j ? k2 : k1, kind = u < .45 ? 0 : u < .78 ? 1 : 2; HZ.push({ i: i * 2 + j, row: i, kind, bx: gx + s * HALF, y: ROW0 + i * RSP, ph: ph + j * 2.1, r: HR[kind], hit: false, hitAt: -9 }); });
  }
  const hxOf = (q, S) => q.bx + (q.kind === 1 ? 18 * Math.sin(S * 1.3 + q.ph) : q.kind === 2 ? 10 * Math.sin(S * .8 + q.ph) : 0);
  const hyOf = (q, S) => q.y + (q.kind === 2 ? 8 * Math.sin(S * 1.1 + q.ph) : 0);
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  /* state. Real (judge) boat: bx by bh tL tR rud. Everybody renders dx dy dh dtL dtR drud from it (snapshots on the other screens) */
  let S = 0, bx = 0, by = 0, bh = 0, tL = 0, tR = 0, rud = 0, rudT = 0, hits = 0, inv = 0, why = 0, resAt = -1, endFx = false, btAt = -9;
  let dx = 0, dy = 0, dh = 0, dtL = 0, dtR = 0, drud = 0, snap = null, snapPrev = null;
  let pull = false, cc = 0, lockS = 0, dragRud = false, keyL = false, keyR = false, W = W0, wShown = W0, wAt = -9, wSent = -1, bailAt = -9, bailLock = 0, scoopK = -9;
  const lastSt = [-9, -9, -9, -9], stP = [0, 0, 0, 0], pops = [], bits = [];
  let cam = 0;
  function pop(s, px, py, size, bgc) { pops.length = 0; pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); }
  const seat = r => ({ 0: -54, 1: -14, 2: 24, 3: 60 })[r];          // y of each crew member inside the canoe (bow = negative)

  function startPull() { if (!rower || g.result || pull || S < lockS) return; pull = true; cc = 0; snd(300, .05, 'triangle', .04); }
  function release() {
    if (!pull) return; pull = false; const c = cc, p = power(c); cc = 0; lockS = S + LOCK;
    D.send('st', [Math.round(p * 100)]); lastSt[me] = g.c; stP[me] = p;
    const side = me === 1 ? -1 : 1;
    pop(c > BHI ? 'CRAB!' : c < BLO ? 'WEAK!' : p > 1.05 ? 'PERFECT!' : 'NICE!', 400 + side * 120, 400, 22, c > BHI ? '#e8343d' : c < BLO ? '#8f88a6' : '#22a447');
    noise(.18, .05, 600, 2400, 'bandpass'); snd(c > BHI ? 150 : 230 + p * 100, .12, 'sine', .07, 0, 90);
  }
  function bail() {
    if (!bails || g.result || S < bailLock) return; bailLock = S + .12; W = Math.max(0, W - BAILV); bailAt = g.c; scoopK = g.c; D.send('bl', 1);
    snd(520, .07, 'triangle', .06, 0, 300); noise(.12, .05, 900, 3000, 'bandpass');
  }
  const sendBt = () => { btAt = g.c; D.send('bt', [Math.round(bx * 10), Math.round(by * 10), Math.round(bh * 1000), Math.round(tL * 100), Math.round(tR * 100), Math.round(rud * 100), hits], true); };
  const lose = k => { if (g.result) return; why = k; D.send('why', k); sendBt(); g.finish('lose'); };
  const TC = n === 3 ? 300 : 400;                                  // x of the tiller's middle (with 3 seats the BAIL button takes the right side)
  function steerTo(x) { rudT = clamp((x - TC) / 200, -1, 1); }

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['GUIDE!', 'ROW LEFT!', 'ROW RIGHT!', 'BAIL!'][me], roleLabel: NAMES[me],
    hint: judge ? 'A / D OR DRAG THE TILLER TO STEER AROUND ROCKS, CAIMANS AND CAPYBARAS - THE OARS NEVER PULL EVENLY' + (n === 3 ? ' - SPACE BAILS' : '')
      : rower ? 'HOLD SPACE (OR CLICK) AND LET GO IN THE GREEN - THE BOAT DRIFTS TO THE STRONGER OAR'
      : 'TAP (SPACE / CLICK) TO BAIL WHENEVER THE LEAK METER RISES',
    thint: judge ? 'DRAG THE TILLER TO STEER AROUND ROCKS, CAIMANS AND CAPYBARAS - THE OARS NEVER PULL EVENLY' + (n === 3 ? ' - TAP BAIL' : '')
      : rower ? 'HOLD AND LET GO IN THE GREEN - THE BOAT DRIFTS TO THE STRONGER OAR'
      : 'TAP TO BAIL WHENEVER THE LEAK METER RISES',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt; const wd = dt * TS;
      if (g.result && resAt < 0) resAt = g.c;
      const live = !g.result;
      if (live) S += wd;
      if (rower && pull && live) { cc += wd / CHG; if (cc >= 1) { cc = 1; release(); } }
      if (bails && live) {
        W = Math.min(1, W + (LEAK0 + LEAKH * hits) * wd);
        if (!judge && (Math.round(W * 1000) !== wSent) && g.c - wAt >= .1) { wAt = g.c; wSent = Math.round(W * 1000); D.send('w', [wSent], true); }
        if (judge && W >= .999) lose(1);
      }
      if (judge && live) {
        if (keyL !== keyR) rudT = clamp(rudT + (keyR ? 1 : -1) * 2.4 * dt, -1, 1);
        rud += clamp(rudT - rud, -6 * wd, 6 * wd);
        const e = Math.exp(-wd / TAUT); tL *= e; tR *= e;
        const tot = tL + tR, v = K * tot, eff = .35 + .65 * Math.min(1, tot / .8);
        bh += (AIMB * (tR - tL) + RRUD * rud * eff - DH * bh) * wd; bh = clamp(bh, -1.3, 1.3);
        bx += v * Math.sin(bh) * wd; by = Math.max(0, by + v * Math.cos(bh) * wd);
        if (Math.abs(bx) > HW - 26) { bx = clamp(bx, -HW + 26, HW - 26); bh *= Math.pow(.2, wd); tL *= .98; tR *= .98; }
        inv = Math.max(0, inv - wd);
        for (const q of HZ) {
          if (inv > 0 || by < q.y - 120 || by > q.y + 120) continue;
          const qx = hxOf(q, S), qy = hyOf(q, S);
          for (const s of [-26, 0, 26]) {
            const px = bx + Math.sin(bh) * s, py = by + Math.cos(bh) * s;
            if (Math.hypot(px - qx, py - qy) < 13 + q.r) {
              if (q.kind === 2) { q.hit = true; q.hitAt = g.c; lose(2); break; }
              q.hit = true; q.hitAt = g.c; hits++; inv = 1.1; tL *= .3; tR *= .3; D.send('hit', { k: hits, i: q.i }); onHit(q);
              if (hits >= 2) lose(0);
              break;
            }
          }
          if (inv > 0 || g.result) break;
        }
        if (!g.result) {
          if (by >= WINY) { sendBt(); g.finish('win'); }
          else if (g.c >= g.limit) lose(3);
        }
        if (!g.result && g.c - btAt >= .08) sendBt();
        dx = bx; dy = by; dh = bh; dtL = tL; dtR = tR; drud = rud; wShown = n === 3 ? W : wShown;
      } else if (!judge) {
        if (snap) { const a = Math.min(g.c - snap.t, .3); let ex = snap.x + (snap.vx || 0) * a, ey = snap.y + (snap.vy || 0) * a; const k = Math.min(1, dt * 10);
          dx += (ex - dx) * k; dy += (ey - dy) * k; dh += (snap.h - dh) * k; dtL += (snap.tL - dtL) * k; dtR += (snap.tR - dtR) * k; drud += (snap.rud - drud) * k; }
      }
      if (judge && n === 4) {} else if (bails) wShown = W;
      cam += (dy - cam) * Math.min(1, dt * 14);
      if (g.result && !endFx) { endFx = true; if (g.result === 'win') { snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); } else { sfx.miss(); snd(330, .5, 'sawtooth', .06, 0, 110); shake(5, .2); noise(.5, .08, 500, 1500, 'bandpass'); } }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      for (let i = bits.length - 1; i >= 0; i--) if (g.c - bits[i].t0 > bits[i].life) bits.splice(i, 1);
    },
    msg(type, d, from) {
      if (type === 'st' && Array.isArray(d) && (from === 1 || from === 2)) {
        const p = clamp((d[0] | 0) / 100, 0, 1.3); lastSt[from] = g.c; stP[from] = p;
        if (judge && !g.result) { if (from === 1) tL = Math.min(1.6, tL + p); else tR = Math.min(1.6, tR + p); }
        else if (rower && from !== me) { noise(.1, .02, 700, 1800, 'bandpass'); }
      } else if (type === 'bt' && Array.isArray(d) && !judge) {
        const s = { t: g.c, x: d[0] / 10, y: d[1] / 10, h: d[2] / 1000, tL: d[3] / 100, tR: d[4] / 100, rud: d[5] / 100 };
        if (snap) { const dtm = Math.max(.04, s.t - snap.t); s.vx = (s.x - snap.x) / dtm; s.vy = (s.y - snap.y) / dtm; if (Math.hypot(s.vx, s.vy) > 600) { s.vx = 0; s.vy = 0; } }
        else { dx = s.x; dy = s.y; dh = s.h; cam = s.y; }
        snap = s; if (d[6] > hits) { hits = d[6]; }
      } else if (type === 'w' && Array.isArray(d) && from === bailerRole) { wShown = d[0] / 1000; if (judge) { W = Math.max(W, 0); if (wShown >= .999) lose(1); } }
      else if (type === 'bl') { scoopK = g.c; }
      else if (type === 'hit' && d && !judge) { hits = Math.max(hits, d.k | 0); const q = HZ[d.i]; if (q) { q.hit = true; q.hitAt = g.c; onHit(q); } }
      else if (type === 'why') { why = d | 0; }
    },
    down(p) {
      if (g.result) return;
      if (rower) startPull();
      else if (judge) {
        if (n === 3 && p.y >= 455 && p.x >= 600) bail();
        else if (p.y >= 400) { dragRud = true; steerTo(p.x); }
      } else bail();
    },
    move(p) { if (judge && dragRud && !g.result) steerTo(p.x); },
    up() { dragRud = false; if (rower) release(); },
    key(e) {
      if (g.result) return;
      if (judge) {
        const c = e.code;
        if (c === 'ArrowLeft' || c === 'KeyA') keyL = true; else if (c === 'ArrowRight' || c === 'KeyD') keyR = true;
        else if (n === 3 && !e.repeat && (c === 'Space' || c === 'Enter' || c === 'ArrowDown' || c === 'KeyS')) bail();
      } else if (!e.repeat) { if (rower) startPull(); else bail(); }
    },
    keyup(e) {
      if (judge) { const c = e.code; if (c === 'ArrowLeft' || c === 'KeyA') keyL = false; else if (c === 'ArrowRight' || c === 'KeyD') keyR = false; }
      else if (rower) release();
    },
  };
  function onHit(q) {
    const sx = 400 + hxOf(q, S), sy = CAMY - (hyOf(q, S) - cam);
    shake(q.kind === 1 ? 7 : 5, .22); sfx.thud(); if (q.kind === 1) snd(180, .2, 'sawtooth', .06, 0, 90); noise(.25, .07, 500, 2200, 'bandpass');
    burst(sx, sy, q.kind === 1 ? '#7a1f2e' : '#d9f1ff', 12, 220);
    pop(q.kind === 1 ? 'CHOMP!' : 'BONK!', 400, 330, 30, '#e8343d');
  }

  /* ───────────── drawing ───────────── */
  const scr = wy => CAMY - (wy - cam);
  function river(T) {
    let gr = X.createLinearGradient(0, 0, 0, 600); gr.addColorStop(0, '#6cc2a6'); gr.addColorStop(1, '#3f9c86'); X.fillStyle = gr; X.fillRect(0, 0, 800, 600);
    X.strokeStyle = 'rgba(255,255,255,.28)'; X.lineWidth = 3; X.lineCap = 'round';
    for (let k = 0; k < 22; k++) { const wy = Math.floor((cam + CAMY - 600) / 60) * 60 + k * 60 + hash(k + Math.floor((cam - CAMY) / 60) * 3) * 40, hx = hash(wy * .13) * 460, sy = scr(wy); X.beginPath(); X.moveTo(170 + hx, sy); X.quadraticCurveTo(190 + hx, sy - 5 + Math.sin(T * 2 + wy) * 2, 212 + hx, sy); X.stroke(); }
    // banks (wavy), with the mud rim
    const edge = (wy, s) => 400 + s * (HW + 20 + 14 * Math.sin(wy * .021) + 8 * Math.sin(wy * .057 + 1));
    for (const s of [-1, 1]) {
      X.beginPath(); X.moveTo(s < 0 ? 0 : 800, 0); for (let sy = 0; sy <= 600; sy += 20) X.lineTo(edge(cam + CAMY - sy, s), sy); X.lineTo(s < 0 ? 0 : 800, 600); X.closePath();
      ink('#8fd16a', 4); X.save(); X.clip(); X.beginPath(); X.moveTo(s < 0 ? 0 : 800, 0); for (let sy = 0; sy <= 600; sy += 20) X.lineTo(edge(cam + CAMY - sy, s) - s * 14, sy); X.lineTo(s < 0 ? 0 : 800, 600); X.closePath(); X.fillStyle = '#6fb856'; X.fill();
      X.beginPath(); for (let sy = 0; sy <= 600; sy += 20) { const ex = edge(cam + CAMY - sy, s) - s * 5; sy ? X.lineTo(ex, sy) : X.moveTo(ex, sy); } X.lineWidth = 8; X.strokeStyle = '#d7b878'; X.stroke(); X.restore();
      for (let c = Math.floor((cam - 200) / 150); c < Math.floor((cam + 700) / 150); c++) {
        const wy = c * 150 + hash(c * 2 + s) * 80, sy = scr(wy), ex = edge(wy, s), kind = Math.floor(hash(c * 7 + s * 3) * 4);
        if (wy > BANKY - 60 || wy < 40) continue;
        const px = ex + s * (26 + hash(c) * 50);
        if (kind === 0) palm(px, sy, .9, T, c); else if (kind === 1) { for (let q = 0; q < 4; q++) line([[px + q * 6, sy], [px + q * 6 + Math.sin(T * 2 + q) * 3, sy - 22 - q % 2 * 8]], 3, '#3fb260'); }
        else if (kind === 2) { el(px, sy, 12, 18); ink('#c9a46a', 3); glint(px - 3, sy - 6, 3, 6, -.3, .4); } else { el(px, sy, 10, 6); ink('#e4f5ff', 2.5); line([[px, sy], [px + 3, sy - 16]], 2.5, '#ff8fb1'); }
      }
    }
  }
  function startShore(T) {
    const sy = scr(-40); if (sy < -60) return;
    X.beginPath(); X.moveTo(0, sy); for (let x = 0; x <= 800; x += 25) X.lineTo(x, sy + 6 * Math.sin(x * .05)); X.lineTo(800, 620); X.lineTo(0, 620); X.closePath(); ink('#8fd16a', 4);
    X.fillStyle = '#d7b878'; X.fillRect(0, sy + 4, 800, 8);
    rr(300, sy + 6, 200, 28, 6); ink(WOOD, 4); for (let q = 1; q < 6; q++) line([[300 + q * 33, sy + 8], [300 + q * 33, sy + 32]], 1.5, WOOD2);
    palm(90, sy + 60, 1.1, T, 1); palm(710, sy + 70, 1, T, 2);
    rr(560, sy + 30, 70, 40, 5); ink('#ffe0a8', 3.5); X.beginPath(); X.moveTo(550, sy + 32); X.lineTo(595, sy + 4); X.lineTo(640, sy + 32); X.closePath(); ink('#d9944f', 3.5);
  }
  function farBank(T, won) {
    const sy = scr(BANKY); if (sy > 640) return;
    X.beginPath(); X.moveTo(0, sy); for (let x = 0; x <= 800; x += 20) X.lineTo(x, sy - 5 * Math.sin(x * .04 + 1) - 6); X.lineTo(800, -10); X.lineTo(0, -10); X.closePath(); ink('#8fd16a', 4);
    X.save(); X.clip(); X.fillStyle = '#d7b878'; X.fillRect(0, sy - 22, 800, 22); X.fillStyle = '#6fb856'; for (let q = 0; q < 8; q++) X.fillRect(q * 110 + (q % 2) * 30, sy - 120 - q % 3 * 40, 80, 18); X.restore();
    for (const px of [60, 250, 560, 740]) palm(px, sy - 60 - hash(px) * 40, 1.2, T, px);
    rr(330, sy - 130, 130, 70, 6); ink('#ffe0a8', 4); X.beginPath(); X.moveTo(316, sy - 128); X.lineTo(395, sy - 190); X.lineTo(474, sy - 128); X.closePath(); ink('#d9944f', 4); rr(380, sy - 108, 30, 48, 4); ink('#7a4a22', 3);
    // the llanero waves; a cow chews; a chigüire family holds the welcome sign
    const lx = 520, ly = sy - 40; caos(lx, ly, 3.4, { col: '#8be28b', mood: won ? 'happy' : null }); el(lx, ly - 40, 24, 7); ink('#e6c58c', 3); el(lx, ly - 46, 13, 8); ink('#e6c58c', 3);
    line([[lx + 20, ly - 22], [lx + 32, ly - 40 + Math.sin(T * 8) * 7]], 5, '#8be28b');
    el(170, sy - 50, 34, 20); ink('#fff', 4); X.fillStyle = INK; for (const [qx, qy] of [[160, -56], [180, -46], [168, -42]]) { X.beginPath(); X.arc(qx, sy + qy, 7, 0, TAU); X.fill(); } el(150, sy - 62, 14, 12); ink('#fff', 4); X.fillStyle = INK; X.beginPath(); X.arc(146, sy - 64, 2, 0, TAU); X.fill();
    rr(560, sy - 8, 150, 30, 6); ink(WOODL, 3.5); txt('WELCOME', 635, sy + 7, 17, INK, 'center', 134);
    for (const px of [600, 650, 700]) chig(px, sy + 44 + (px % 3) * 4, T, { calm: true });
  }
  function drawHazards(T) {
    for (const q of HZ) {
      const wx = hxOf(q, S), wy = hyOf(q, S), sx = 400 + wx, sy = scr(wy);
      if (sy < -60 || sy > 660) continue;
      if (!judge && (wy - dy > 150 || wy - dy < -110)) continue;
      const near = Math.abs(wy - dy) < 90;
      if (q.kind === 0) rock(sx, sy, q.r); else if (q.kind === 1) caiman(sx, sy, T, near || (q.hit && g.c - q.hitAt < .6) ? 1 : 0); else chig(sx, sy, T);
      if (judge && !g.result && q.kind === 2 && wy - dy > 0 && wy - dy < 190) { X.globalAlpha = .6 + .4 * Math.sin(T * 9); txt('!', sx, sy - 42, 24, '#ffe14d'); X.globalAlpha = 1; }
    }
  }
  function canoe(T, won, lost, rk) {
    const cx = 400 + dx, cy = CAMY - (dy - cam) + (won ? -rk * 0 : 0), sinkK = lost && why === 1 ? clamp(rk / 1.1, 0, 1) : 0;
    const wob = Math.sin(T * 4) * .015, tilt = lost && why === 2 ? Math.sin(clamp(rk / .5, 0, 1) * 1.5) * .4 : 0;
    el(cx, cy + 6, 38, 90); X.fillStyle = 'rgba(20,16,28,.2)'; X.fill();
    X.save(); X.translate(cx, cy); X.rotate(dh + wob + tilt); const sc = 1 - sinkK * .35; X.scale(sc, sc); if (sinkK > 0) X.globalAlpha = 1 - sinkK * .6;
    // wake
    const spd = (dtL + dtR) * K; if (spd > 20 && !lost) { X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 3; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 20, -50); X.quadraticCurveTo(s * (34 + spd * .12), -20, s * (50 + spd * .2), 40 + spd * .2); X.stroke(); } }
    // oars (behind the hull): each with a sweep from its stroke
    for (const r of [1, 2]) {
      const s = r === 1 ? -1 : 1, ly = seat(r), mine = me === r;
      let ph;                                                                    // 0 blade forward, 1 blade back
      if (mine && pull) ph = cc; else { const a = (g.c - lastSt[r]) / .5; ph = a < 0 || a > 1 ? 0 : (a < .35 ? 1 - a / .35 * .2 : .8 * (1 - (a - .35) / .65)); }
      const phi = (-.55 + ph * 1.1), ex = s * (20 + 60 * Math.cos(phi)), ey = ly + 60 * Math.sin(phi), inB = mine && pull && cc >= BLO && cc <= BHI;
      line([[s * 12, ly], [ex, ey]], 5, WOODL);
      X.save(); X.translate(ex, ey); X.rotate(s * .2 - phi * .3); el(0, 0, 8, 17); ink(inB ? '#5CFF7A' : cols(r), 3.5); glint(-2, -6, 2.5, 6, 0, .5); X.restore();
      if (g.c - lastSt[r] < .5 && lastSt[r] > 0) { X.globalAlpha = 1 - (g.c - lastSt[r]) / .5; el(ex, ey, 10 + (g.c - lastSt[r]) * 40, 6 + (g.c - lastSt[r]) * 20); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
    }
    // hull: cel shaded dugout, the hollow inside, the leak
    hullPath(); ink(WOOD, 5); X.save(); hullPath(); X.clip(); X.fillStyle = WOOD2; X.fillRect(8, -90, 40, 180); X.restore(); hullPath(); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
    glint(-14, -30, 3.5, 22, 0, .4);
    inner(); ink('#6e4120', 3);
    const wl = clamp(wShown, 0, 1.05);
    if (wl > .02) { X.save(); inner(); X.clip(); const wy0 = 62 - 124 * Math.min(1, wl); X.fillStyle = 'rgba(79,195,247,.85)'; X.beginPath(); X.moveTo(-20, 70); X.lineTo(-20, wy0 + Math.sin(T * 6) * 2); X.quadraticCurveTo(0, wy0 - 4 * Math.sin(T * 5), 20, wy0 + Math.sin(T * 6 + 1) * 2); X.lineTo(20, 70); X.fill(); X.restore(); inner(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
    for (const q of [-36, 0, 38]) line([[-16, q], [16, q]], 3, WOOD2);
    // bow: a little banana-leaf flag
    X.restore();
    // crew (upright, placed along the rotated hull)
    const ca = Math.cos(dh), sa = Math.sin(dh);
    const at = ly => [cx - ly * sa * sc0(sinkK), cy + ly * ca * sc0(sinkK)];
    for (let r = 0; r < n; r++) {
      const [px, py] = at(seat(r)); if (sinkK > .8) continue;
      const mood = won ? 'happy' : lost ? 'sad' : null, hop = won ? -Math.abs(Math.sin(T * 9 + r)) * 8 : 0, wob2 = Math.sin(T * 3 + r) * 1.2;
      shadow(px, py + 4, 15, 5, .25);
      if (r === 0) { caos(px, py + 8 + hop, 3, { col: cols(0), mood }); llanero(px, py + 8 + hop, 3); }
      else caos(px, py + 8 + hop + wob2 * .3, 2.9, { col: cols(r), mood });
      if (r === bailerRole && !won) totuma(px, py, T);
      pill(px + (r === 1 || r === 0 ? -66 : 66), py - 22, r === me ? 'YOU' : name(r), cols(r));
    }
    if (lost && why === 2 && rk > 0) { const k = outBack(clamp(rk / .4, 0, 1)); X.save(); X.translate(cx, cy - 20); X.scale(k * 1.6, k * 1.6); chig(0, 0, T, { calm: true }); X.restore(); }
    if (sinkK > .2) for (let q = 0; q < 6; q++) { const k = (T * 1.4 + q * .17) % 1; el(cx + Math.sin(q * 2.3) * 24, cy - k * 50, 3 + q % 3, 3 + q % 3); ink('#d9f1ff', 2); }
    if (inv > 0 && !g.result && Math.sin(T * 30) > 0) { X.globalAlpha = .35; el(cx, cy, 34, 82); X.fillStyle = '#fff'; X.fill(); X.globalAlpha = 1; }
  }
  const sc0 = k => 1 - k * .35;
  function llanero(x, y, u) { el(x, y - 11.4 * u, 7.6 * u, 2 * u); ink('#e6c58c', 3); rr(x - 3.6 * u, y - 15 * u, 7.2 * u, 4.4 * u, 4); ink('#e6c58c', 3); X.fillStyle = '#a5622c'; X.fillRect(x - 3.6 * u, y - 12.3 * u, 7.2 * u, 1.1 * u); }
  function totuma(x, y, T) {                                // the half-gourd for bailing
    const k = g.c - scoopK, up = k >= 0 && k < .3 ? Math.sin(k / .3 * Math.PI) : 0, sx = x + 17, sy = y - 4 - up * 12;
    X.beginPath(); X.arc(sx, sy, 8, 0, Math.PI); X.closePath(); ink('#e0b25a', 3); glint(sx - 2, sy + 2, 3, 1.6, 0, .6);
    if (up > .2) for (let q = 0; q < 3; q++) { el(sx + 8 + q * 7 * up, sy - 3 - up * 10 + q * 5 - up * 5, 2.4, 3.2); ink('#9fe3ff', 1.5); }
  }
  function hud(T) {
    // progress sign on strings (the river map): the canoe slides to the far bank
    const bx0 = 190, by0 = 66, bw = 340, fr = clamp(dy / WINY, 0, 1);
    line([[bx0 + 24, 40], [bx0 + 24, by0]], 3, '#e6c58c'); line([[bx0 + bw - 24, 40], [bx0 + bw - 24, by0]], 3, '#e6c58c');
    rr(bx0, by0, bw, 34, 10); ink(WOODL, 4); line([[bx0 + 30, by0 + 17], [bx0 + bw - 30, by0 + 17]], 5, '#3f9c86');
    for (let q = 0; q < ROWS; q++) { X.beginPath(); X.arc(bx0 + 30 + (bw - 60) * (ROW0 + q * RSP) / WINY, by0 + 17, 3.2, 0, TAU); X.fillStyle = INK; X.fill(); }
    rr(bx0 + bw - 38, by0 + 5, 24, 24, 5); ink('#8fd16a', 3); line([[bx0 + bw - 26, by0 + 6], [bx0 + bw - 26, by0 + 28]], 2.5, INK);
    const mx = bx0 + 30 + (bw - 60) * fr; el(mx, by0 + 17, 11, 6, -.1); ink(WOOD, 3); X.fillStyle = cols(0); X.beginPath(); X.arc(mx, by0 + 14, 3.2, 0, TAU); X.fill();
    for (let q = 0; q < 2; q++) heart(bx0 + bw + 36 + q * 36, by0 + 17, 1.05, q >= hits);
  }
  function tiller(T) {                                       // judge: a wooden track and a tiller handle
    const rx = TC + drud * 200;
    rr(TC - 230, 500, 460, 40, 20); ink(WOOD2, 4); line([[TC - 200, 520], [TC + 200, 520]], 5, '#6e4120');
    for (let q = -2; q <= 2; q++) line([[TC + q * 100, 508], [TC + q * 100, 532]], 2, WOODL);
    X.save(); X.translate(rx, 520); X.rotate(drud * .5); rr(-12, -34, 24, 62, 8); ink(WOODL, 4); glint(-4, -16, 3, 10, 0, .5); X.restore();
    txt('TILLER', TC, 556, 15, '#fff', 'center', 140);
    if (!TOUCH) { X.font = '700 14px Fredoka, Arial, sans-serif'; for (const [kx, kc] of [[TC - 250, 'A'], [TC + 250, 'D']]) { rr(kx - 13, 508, 26, 24, 6); ink('#fff', 2.5); txt(kc, kx, 521, 14, INK); } }
    // bow marker: where the rudder points
    X.save(); X.translate(400 + dx * 0, 470); X.restore();
  }
  function oarGauge(T) {                                     // rowers: the oar's wooden gauge with the green band
    const x0 = 140, y0 = 506, w = 520, h = 36, c = pull ? cc : 0, side = me === 1 ? -1 : 1, cd = Math.exp(-(S - lockS + LOCK) / .3);
    rr(x0, y0, w, h, 18); ink(WOOD2, 4); rr(x0 + 6, y0 + 6, w - 12, h - 12, 12); X.fillStyle = '#4a2c14'; X.fill();
    X.save(); rr(x0 + 6, y0 + 6, w - 12, h - 12, 12); X.clip();
    X.fillStyle = '#7a6a52'; X.fillRect(x0 + 6, y0 + 6, (w - 12) * BLO, h - 12); X.fillStyle = '#3ddc5f'; X.fillRect(x0 + 6 + (w - 12) * BLO, y0 + 6, (w - 12) * (BHI - BLO), h - 12); X.fillStyle = '#e8434f'; X.fillRect(x0 + 6 + (w - 12) * BHI, y0 + 6, (w - 12) * (1 - BHI), h - 12);
    X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(x0 + 6, y0 + 8, w - 12, 5);
    if (pull) { X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(x0 + 6, y0 + 6, (w - 12) * c, h - 12); }
    X.restore();
    const mx = x0 + 6 + (w - 12) * c; X.save(); X.translate(mx, y0 + h / 2); el(0, 0, 11, 17); ink(pull ? (c >= BLO && c <= BHI ? '#5CFF7A' : '#fff') : cols(me), 3.5); X.restore();
    txt(me === 1 ? 'LEFT OAR' : 'RIGHT OAR', 400, y0 - 12, 17, '#fff', 'center', 220);
    txt(pull ? 'LET GO IN THE GREEN!' : 'HOLD', 400, y0 + h + 22, 16, pull ? '#5CFF7A' : '#fff', 'center', 260);
  }
  function leakUI(T, x0, y0, w) {                            // the leak meter: a gourd water gauge with a red top
    const lv = clamp(wShown, 0, 1), alarm = lv > .7;
    rr(x0, y0, w, 30, 15); ink('#e8f6ff', 4); X.save(); rr(x0 + 4, y0 + 4, w - 8, 22, 11); X.clip(); X.fillStyle = alarm ? (Math.sin(T * 14) > 0 ? '#ffb0b0' : '#fff') : '#bfeaff'; X.fillRect(x0, y0, w, 30);
    X.fillStyle = lv > .7 ? '#e8434f' : '#4fc3f7'; X.fillRect(x0, y0, (w) * lv, 30); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x0 + 6, y0 + 7, Math.max(0, w * lv - 8), 5); X.restore();
    for (const q of [.25, .5, .75]) line([[x0 + w * q, y0 + 3], [x0 + w * q, y0 + 9]], 1.5, INK);
    rr(x0, y0, w, 30, 15); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    txt('LEAK', x0 + 36, y0 - 12, 15, alarm ? '#ff8a8a' : '#fff', 'center', 70);
  }
  function mist(T) {
    const gr = X.createLinearGradient(0, 0, 0, 330); gr.addColorStop(0, 'rgba(230,243,244,.97)'); gr.addColorStop(.7, 'rgba(230,243,244,.88)'); gr.addColorStop(1, 'rgba(230,243,244,0)'); X.fillStyle = gr; X.fillRect(0, 0, 800, 330);
    for (const [sx, sy, sc, spd] of [[40, 190, .9, 6], [330, 120, .8, 4], [560, 220, .7, 8]]) cloud(((T * spd + sx) % 1000) - 140, sy, sc);
    if (!g.result) badge('MIST!', 400, 150, 22, '#8f9cb3', '#fff', 1, -.03);
  }
  g.draw = function (tm) {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    river(T); startShore(T); farBank(T, won);
    drawHazards(T);
    canoe(T, won, lost, rk);
    if (!judge && !g.result) mist(T);
    hud(T);
    if (!g.result) {
      if (judge) { tiller(T); if (n === 3) { leakUI(T, 610, 468, 170); plate(610, 500, 170, 42, '#4fc3f7', '#1f93d0', g.c - bailAt < .12, 'BAIL!', 'SPACE'); } }
      else if (rower) oarGauge(T);
      else { leakUI(T, 140, 472, 520); plate(220, 504, 360, 44, '#4fc3f7', '#1f93d0', g.c - bailAt < .12, 'BAIL!', 'SPACE'); }
    }
    if (won && rk > .15) { for (let i = 0; i < 16; i++) { const d = rk - hash(i + 3) * .8; if (d < 0) continue; heart(40 + hash(i) * 720, 590 - d * (160 + hash(i + 9) * 90), .9 + hash(i + 5) * .5, true); } badge('WE MADE IT!', 400, 330, 34, '#22a447', '#fff', outBack((rk - .15) / .25), -.04); }
    if (lost && rk > .35) badge(why === 2 ? 'CAPYBARA ABOARD!' : why === 1 ? 'GLUB!' : why === 0 ? 'WRECKED!' : 'TOO SLOW!', 400, 330, 32, '#e8343d', '#fff', outBack((rk - .35) / .25), .04);
    if (!g.result && T < 2.6) badge(judge ? 'CROSS THE RIVER!' : rower ? 'PULL TOGETHER!' : 'KEEP BAILING!', 400, 200, 22, '#2b9ee6', '#fff', outBack(T / .3), -.03);
    for (const q of pops) { const a = T - q.t0; badge(q.s, q.x, q.y - a * 26, q.size, q.bgc, '#fff', a < .2 ? outBack(a / .2) : 1); }
    vignette(.14);
  };
  g.dbg = {
    view: () => judge ? { S, x: bx, y: by, h: bh, rud, hits, water: n === 3 ? W : wShown, hz: HZ.map(q => ({ x: hxOf(q, S), y: hyOf(q, S), r: q.r, kind: q.kind, row: q.row })), tL, tR, why }
      : rower ? { S, c: cc, pull, lock: S < lockS } : { S, water: W },
    HZ,
  };
  wire(g, D, 0, sp, 'sq_curiara');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#6cc2a6'); gr.addColorStop(1, '#3f9c86'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#8fd16a'; X.fillRect(0, 0, 70, 240); X.fillRect(450, 0, 70, 240); X.fillStyle = INK; X.fillRect(68, 0, 4, 240); X.fillRect(448, 0, 4, 240);
  const u = t % 4, bxm = 260 + Math.sin(t * 1.5) * 20;
  X.save(); X.translate(bxm, 120); X.rotate(Math.sin(t * 1.5) * .12); X.scale(.9, .9); hullPath(); ink(WOOD, 5); inner(); ink('#6e4120', 3); X.restore();
  caos(bxm, 150, 2.7, { col: COLS[role] });
  if (role === 0) {
    X.fillStyle = 'rgba(230,243,244,.0)'; rock(180, 60, 22); caiman(350, 40 + (t * 20) % 8, t, 1); chig(330, 120 - 0, t);
    rr(140, 190, 240, 34, 17); ink(WOOD2, 4); const rx = 260 + Math.sin(t * 1.5) * 90; rr(rx - 10, 182, 20, 50, 7); ink(WOODL, 4); demoFinger(rx, 214, true, 0);
    badge('STEER AROUND!', 260, 24, 17, '#22a447', '#fff', 1, -.03);
  } else if (role < 3) {
    const c = (t % 1.4) / 1.4, side = role === 1 ? -1 : 1;
    rr(60, 190, 400, 30, 15); ink(WOOD2, 4); X.save(); rr(66, 196, 388, 18, 9); X.clip(); X.fillStyle = '#7a6a52'; X.fillRect(66, 196, 388 * BLO, 18); X.fillStyle = '#3ddc5f'; X.fillRect(66 + 388 * BLO, 196, 388 * (BHI - BLO), 18); X.fillStyle = '#e8434f'; X.fillRect(66 + 388 * BHI, 196, 388 * (1 - BHI), 18); X.restore();
    el(66 + 388 * Math.min(c / .75, 1), 205, 9, 14); ink('#fff', 3); demoFinger(66 + 388 * .75, 232, c < .75, 0);
    line([[bxm + side * 12, 124], [bxm + side * 70, 110 + Math.sin(c * 4) * 14]], 5, WOODL);
    badge('LET GO IN THE GREEN!', 260, 24, 16, '#2b9ee6', '#fff', 1, -.03);
  } else {
    const lv = .4 + .45 * ((t % 2) / 2) - .35 * Math.max(0, 1 - ((t % 2) - 1) * 6) * (((t % 2) > 1) ? 1 : 0);
    rr(80, 196, 360, 26, 13); ink('#e8f6ff', 4); X.save(); rr(84, 200, 352, 18, 9); X.clip(); X.fillStyle = lv > .7 ? '#e8434f' : '#4fc3f7'; X.fillRect(84, 200, 352 * clamp((t % 2) < 1.2 ? .35 + .5 * ((t % 2) / 1.2) : .35, 0, 1), 18); X.restore();
    demoFinger(260, 232, (t % 2) > 1.2 && (t % 2) < 1.4, ((t % 2) - 1.2) * 5);
    badge('TAP TO BAIL!', 260, 24, 17, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_curiara', sqCuriara, 'CURIARA'); REGMAP.sq_curiara.duo = true; REGMAP.sq_curiara.squad = true;
DUO.INFO.sq_curiara = n => [
  n === 3 ? ['RIVER GUIDE', 'STEER AND BAIL', 'A D / TILLER, SPACE'] : ['RIVER GUIDE', 'STEER AROUND THE DANGERS', 'A D / DRAG THE TILLER'],
  ['LEFT OAR', 'PULL, LET GO IN THE GREEN', 'HOLD, LET GO / SPACE'],
  ['RIGHT OAR', 'PULL, LET GO IN THE GREEN', 'HOLD, LET GO / SPACE'],
  ['BAILER', 'BAIL OUT THE LEAK', 'TAP / CLICK / SPACE'],
].slice(0, n);
DUO.DEMOS.sq_curiara = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
