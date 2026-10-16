'use strict';
/* ═════════ SQUAD · GARAGE BAND (sq_band), 3-4 players, one role each ═════════
   Four neighbours' kids rehearse in a garage while the street waits behind the roll-up door. The crowd meter IS the door: it rises as the band grooves.
   n = 4:  CONDUCTOR (0, JUDGE)  sees the whole score. Before every bar (2 s) taps pad 1 / 2 / 3 = which part the band must play in that bar.
           DRUMS (1), BASS (2), KEYS (3)  each see ONLY their own lane. A bar's notes are revealed only when the conductor's call for it arrives
                                    (until then the lane shows "?"). Tap on the notes. A stray tap or a missed note breaks the groove.
   n = 3:  the same with DRUMS and BASS.
   The song is a fixed clock: bar b starts at S0 + 2b (sim seconds, S advances g.c * sqrt(sp)), 4 beats of BP s. Every bar has a TRUE part (seeded by mkR()):
   STEADY / OFFBEAT / FILL. The notes an instrument has to hit come from the true part; the lane shows what the conductor CALLED, so a wrong call
   makes the whole band wrong and no call makes them guess. A beat slot is LOCKED when every instrument nailed it (±WIN, generous); a locked slot
   fills the crowd meter, an unlocked one drains it. Win = the meter is full before the song ends.
   Netcode: every role owns its variables, the others render them:
     CONDUCTOR 'call' {b, k} (the call for bar b), 'cr' [meter*1000, combo] (after judging a slot: the meter is the judge's)
     INSTRUMENT 'ok' [slot, 0|1] (did I nail my part of that slot), 'tap' 1 (cosmetic: I strummed)
   The judge (role 0) decides the verdict ('end', via wire) from the 'ok' reports. Beats come from the shared clock, never from messages. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ───────────── the song (sim seconds) ───────────── */
const BP = .5, S0 = 2, NB = 6, NS = NB * 4, WIN = .12, GRACE = 1.0, NEED = 16, LOSS = 1 / 32;
const PAT = [                                                // true parts: note offsets (in beats) inside a bar, per instrument. Every beat slot has a note for everybody
  [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]],                // 0 STEADY
  [[.5, 1.5, 2.5, 3.5], [.5, 1.5, 2.5, 3.5], [.5, 1.5, 2.5, 3.5]],   // 1 OFFBEAT
  [[0, .5, 1, 1.5, 2, 3], [0, 1, 2, 2.5, 3, 3.5], [0, .5, 1, 2, 2.5, 3.5]],   // 2 FILL
];
const PNAME = ['STEADY', 'OFFBEAT', 'FILL'];
const PXS = 150, HITX = 150;                                 // lane: px per sim second, x of the hit ring
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const KCOL = ['#6EA8FE', '#ff8a3d', '#e8434f'];             // colour of each part
const WALL = '#8fd1c8', WALL2 = '#6fb8b0', BRICK = '#5aa39b', FLOOR = '#b9a58a', FLOOR2 = '#a18e74', PAPER = '#fff6dc', GOLD = '#ffcf33';
const NAMES = ['CONDUCTOR', 'DRUMS', 'BASS', 'KEYS'];
const DX = 250, DY = 92, DW = 300, DH = 206;                // the roll-up door

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(150, X.measureText(s).width + 24);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(250, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 250);
  X.restore();
}
function note(x, y, r, col, k) {                             // a chunky note head; k 0..1 = how "hit" it is
  X.beginPath(); X.arc(x, y, r * (1 + k * .5), 0, TAU); ink(k > 0 ? '#fff' : col, 3);
  if (k <= 0) { X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .3, y - r * .35, r * .3, r * .2, -.5); X.fill(); }
}
function qchip(x, y, r, T) {                                 // an unknown note: the conductor has not called this bar yet
  X.beginPath(); X.arc(x, y, r * .8, 0, TAU); ink('#cfc8dd', 2.5); txt('?', x, y + 1, r * 1.2, '#7b7490');
}
function flower(x, y, r, col, rot) {
  X.save(); X.translate(x, y); X.rotate(rot);
  for (let i = 0; i < 5; i++) { X.save(); X.rotate(i * TAU / 5); el(0, -r * .62, r * .42, r * .55); ink(col, 2); X.restore(); }
  X.beginPath(); X.arc(0, 0, r * .34, 0, TAU); ink(GOLD, 2); X.restore();
}

/* ───────────── the garage, painted once ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  X.fillStyle = WALL; X.fillRect(0, 0, W, 392);
  X.fillStyle = BRICK; for (let r = 0; r < 14; r++) for (let c = 0; c < 9; c++) { const bx = c * 96 - (r % 2) * 48, by = r * 28; X.fillRect(bx + 2, by + 2, 92, 24); }
  X.fillStyle = WALL; for (let r = 0; r < 14; r++) for (let c = 0; c < 9; c++) { const bx = c * 96 - (r % 2) * 48, by = r * 28; X.fillRect(bx + 4, by + 4, 88, 20); }
  let g = X.createLinearGradient(0, 0, 0, 392); g.addColorStop(0, 'rgba(20,10,40,.4)'); g.addColorStop(1, 'rgba(20,10,40,0)'); X.fillStyle = g; X.fillRect(0, 0, W, 392);
  // the street seen through the door: dusk sky, far houses
  g = X.createLinearGradient(0, DY, 0, DY + DH); g.addColorStop(0, '#ff9a6b'); g.addColorStop(.6, '#ffd8a0'); g.addColorStop(1, '#8aa3c9'); X.fillStyle = g; X.fillRect(DX, DY, DW, DH);
  for (let i = 0; i < 5; i++) { const hx = DX + 8 + i * 60; X.fillStyle = i % 2 ? '#6b6fa5' : '#59608f'; X.fillRect(hx, DY + 130 - (i * 23) % 40, 52, 120); X.fillStyle = '#ffe9a0'; X.fillRect(hx + 10, DY + 150 - (i * 23) % 40, 10, 12); X.fillRect(hx + 30, DY + 150 - (i * 23) % 40, 10, 12); }
  X.fillStyle = '#5b5568'; X.fillRect(DX, DY + DH - 36, DW, 36);
  // frame
  X.strokeStyle = INK; X.lineWidth = 12; X.strokeRect(DX - 6, DY - 6, DW + 12, DH + 12); X.lineWidth = 6; X.strokeStyle = '#fff'; X.strokeRect(DX - 6, DY - 6, DW + 12, DH + 12);
  // floor + rug
  g = X.createLinearGradient(0, 392, 0, H); g.addColorStop(0, FLOOR); g.addColorStop(1, FLOOR2); X.fillStyle = g; X.fillRect(0, 392, W, H - 392);
  X.fillStyle = INK; X.fillRect(0, 388, W, 8); X.fillStyle = '#fff'; X.fillRect(0, 392, W, 3);
  X.beginPath(); X.ellipse(400, 440, 340, 36, 0, 0, TAU); ink('#c45470', 4); X.beginPath(); X.ellipse(400, 440, 300, 26, 0, 0, TAU); X.lineWidth = 4; X.strokeStyle = '#ffd1dc'; X.stroke();
  // poster (left) and a bulb
  X.save(); X.translate(110, 186); X.rotate(-.05); rr(-52, -70, 104, 140, 4); ink('#ffe14d', 4); X.fillStyle = '#e8434f'; X.beginPath(); X.arc(0, -10, 32, 0, TAU); X.fill();
  X.fillStyle = INK; X.font = '900 18px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.fillText('LIVE', 0, 52); X.restore();
  line([[640, 0], [640, 62]], 4, INK); X.beginPath(); X.arc(640, 70, 12, 0, TAU); ink('#fff3a0', 3);
  // amp stack (right)
  for (const [ax, ay, aw, ah] of [[690, 300, 90, 90], [700, 220, 70, 80]]) { rr(ax - aw / 2, ay, aw, ah, 6); ink('#3a3550', 4); X.fillStyle = '#b8b4cc'; X.beginPath(); X.arc(ax, ay + ah * .55, aw * .26, 0, TAU); X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.fillStyle = GOLD; X.fillRect(ax - aw / 2 + 8, ay + 8, 16, 6); }
  X = old; return cv2;
}

/* ───────────── the stage props ───────────── */
function prop(role, x, y, T, hk) {                           // role 1 drums, 2 bass, 3 keys. (x, y) = the player's feet
  if (role === 1) {
    X.beginPath(); X.moveTo(x + 30, y - 22); X.lineTo(x + 40, y - 78); line([[x + 38, y - 24], [x + 40, y - 78]], 4, '#9a96ab');
    el(x + 40, y - 80 + hk * 3, 26, 6); ink(GOLD, 3);
    el(x, y - 18, 30, 24); ink('#e8434f', 4); X.beginPath(); X.arc(x, y - 18, 11, 0, TAU); ink('#fff', 3);
    el(x - 40, y - 34 + hk * 4, 22, 7); ink('#fff', 3);
  } else if (role === 2) {
    X.save(); X.translate(x + 14, y - 30); X.rotate(-.5 + hk * .06); line([[0, 0], [58, -6]], 10, '#8a5a3c'); el(0, 0, 20, 13); ink('#4db8ff', 3); X.beginPath(); X.arc(2, 0, 4, 0, TAU); ink('#fff', 2); X.restore();
  } else {
    rr(x - 42, y - 36 + hk * 2, 84, 14, 4); ink('#fff', 3); for (let k = 1; k < 6; k++) line([[x - 42 + k * 14, y - 36 + hk * 2], [x - 42 + k * 14, y - 22 + hk * 2]], 2, INK);
    line([[x - 30, y - 22], [x - 30, y]], 5, '#6d6785'); line([[x + 30, y - 22], [x + 30, y]], 5, '#6d6785');
  }
}
function baton(x, y, T, beat) {
  line([[x - 4, y - 74], [x + 26, y - 74 - 8 * Math.sin(beat * Math.PI)]], 5, '#fff');
  rr(x + 40, y - 70, 6, 70, 2); ink('#6d6785', 2); rr(x + 18, y - 98, 52, 34, 4); ink(PAPER, 3);
}

/* ═════════ the game ═════════ */
function sqBand(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0, conductor = me === 0;
  /* the level: identical on every screen whatever n / role */
  const kinds = []; for (let b = 0; b < NB; b++) { let k = b ? Math.floor(R() * 3) : 0; if (b && k === kinds[b - 1]) k = (k + 1 + Math.floor(R() * 2)) % 3; else if (b) R(); kinds.push(k); }
  const callOf = Array(NB).fill(-1);                         // what the conductor called, per bar (-1 = not heard yet)
  const okMap = Array.from({ length: NS }, () => Array(n).fill(null));
  const myNotes = [];                                        // my TRUE notes {t, slot, used}
  if (me) for (let b = 0; b < NB; b++) for (const off of PAT[kinds[b]][me - 1]) myNotes.push({ t: S0 + b * 2 * 1 + off * BP, slot: b * 4 + Math.floor(off), used: false });
  const stray = new Set(), taps = [], lastTap = [-9, -9, -9, -9];
  let S = 0, evalI = 0, jEval = 0, meter = 0, mv = 0, combo = 0, bestCombo = 0, beatI = -1, ptrDown = false;
  let resAt = -1, endFx = false, lastCr = -9, padAt = [-9, -9, -9], padK = -1;
  const pops = [], bits = [];
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  const barOf = s => Math.floor((s - S0) / 2);
  const targetBar = () => S < S0 ? 0 : barOf(S) + 1;          // the bar the conductor is calling right now (the one that starts next)
  const believed = b => { const k = callOf[b]; return k < 0 ? null : PAT[k][Math.max(0, me - 1)]; };
  function call(k) {
    if (!conductor || g.result) return; const b = targetBar(); if (b >= NB) return;
    callOf[b] = k; padAt[k] = g.c; padK = k; D.send('call', { b, k }); snd(520 + k * 140, .09, 'triangle', .06); snd(780 + k * 140, .09, 'triangle', .05, .06);
  }
  function tap() {
    if (conductor || g.result || S < 0) return;
    lastTap[me] = g.c; D.send('tap', 1);
    snd([0, 110, 82, 330][me], .12, me === 1 ? 'sine' : me === 2 ? 'triangle' : 'square', .09, 0, me === 1 ? 50 : undefined); if (me === 1) noise(.05, .05, 2500, 5000, 'highpass');
    taps.push(S); if (taps.length > 40) taps.shift();
    let bi = -1, bd = WIN + 1e-9;
    for (let i = 0; i < myNotes.length; i++) { const q = myNotes[i]; if (q.used) continue; const d = Math.abs(q.t - S); if (d < bd) { bd = d; bi = i; } }
    if (bi >= 0) { myNotes[bi].used = true; burst(150 + 80, 478, cols(me), 4, 120); }
    else { const j = Math.floor((S - S0) / BP); if (j >= 0 && j < NS) stray.add(j); else if (S > S0 - .4 && S < S0) stray.add(0); }
  }
  function judgeSlot(j) {
    let lock = true; for (let r = 1; r < n; r++) if (okMap[j][r] !== true) lock = false;
    if (lock) { meter = Math.min(1, meter + 1 / NEED); combo++; bestCombo = Math.max(bestCombo, combo); }
    else { meter = Math.max(0, meter - LOSS); combo = 0; }
    D.send('cr', [Math.round(meter * 1000), combo]);
    if (meter >= .999 && !g.result) g.finish('win');
    else if (j >= NS - 1 && !g.result) g.finish('lose');
  }
  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['CONDUCT!', 'DRUMS!', 'BASS!', 'KEYS!'][me], roleLabel: NAMES[me],
    hint: me === 0 ? 'BEFORE EACH BAR PRESS 1 / 2 / 3 (OR CLICK A PAD) = THE PART YOU SEE ON THE SCORE' : 'TAP (SPACE / ANY KEY) ON EACH NOTE OF YOUR LANE - THE CONDUCTOR TELLS YOU WHAT BAR COMES',
    thint: me === 0 ? 'BEFORE EACH BAR TAP THE PAD OF THE PART YOU SEE ON THE SCORE' : 'TAP ANYWHERE ON EACH NOTE OF YOUR LANE - THE CONDUCTOR TELLS YOU WHAT BAR COMES',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      mv += (meter - mv) * Math.min(1, dt * 5);
      if (!g.result) {
        S += dt * TS;
        const bi = Math.floor(S / BP); if (bi !== beatI) { beatI = bi; if (S >= 0) snd(bi * BP < S0 ? 900 : bi % 4 === 0 ? 260 : 200, .04, 'square', .025); }
        if (me) while (evalI < NS && S >= S0 + (evalI + 1) * BP + WIN) {
          const j = evalI++; let ok = !stray.has(j); for (const q of myNotes) if (q.slot === j && !q.used) ok = false;
          okMap[j][me] = ok; D.send('ok', [j, ok ? 1 : 0]);
          if (!ok) { sfx.miss(); pop('OFF!', 150 + (me - 1) * 0, 400, 22, '#e8343d'); }
        }
        if (judge) {
          while (jEval < NS && S >= S0 + (jEval + 1) * BP + GRACE && !g.result) judgeSlot(jEval++);
          if (!g.result && g.c >= g.limit) g.finish(meter >= .999 ? 'win' : 'lose');
        }
      }
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(330, .5, 'sawtooth', .06, 0, 110); shake(5, .2); }
      while (pops.length && g.c - pops[0].t0 > 1.0) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'call' && d && d.b >= 0 && d.b < NB) callOf[d.b] = d.k | 0;
      else if (type === 'ok' && Array.isArray(d) && okMap[d[0]] && from > 0 && from < n) okMap[d[0]][from] = !!d[1];
      else if (type === 'tap' && from >= 0 && from < 4) lastTap[from] = g.c;
      else if (type === 'cr' && Array.isArray(d)) {
        const m0 = meter; meter = d[0] / 1000; if (d[1] > combo && d[1] > 0 && d[1] % 4 === 0) { pop('GROOVE!', 400, 380, 24, '#22a447'); } combo = d[1]; lastCr = g.c;
        if (meter > m0) snd(660 + combo * 30, .08, 'triangle', .05);
      }
    },
    draw(t) {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      const beat = ((S - S0) / BP) % 1, barNow = barOf(S);
      // the street and the door (the crowd meter): the door rolls up as the band grooves
      const lift = won ? lerp(clamp(.15 + .85 * mv, 0, 1), 1, ease(rk / .8)) : lost ? lerp(clamp(.15 + .85 * mv, 0, 1), 0, ease(rk / .45)) : clamp(.15 + .85 * mv, 0, 1);
      const open = DY + DH * (1 - lift);
      const cnt = won ? 14 : Math.round(clamp(mv, 0, 1) * 13);
      X.save(); X.beginPath(); X.rect(DX, DY, DW, DH); X.clip();
      for (let i = 0; i < cnt; i++) {
        const hx = DX + 26 + (i * 41) % (DW - 52) + (hash(i) - .5) * 14, hr = 17, hy0 = DY + DH - 30 - (i % 3) * 14, jump = won ? -Math.abs(Math.sin(T * 9 + i)) * 16 : Math.sin(T * 5 + i) * 2 * (.5 + mv);
        const ccol = ['#FF6B3D', '#8fb7ff', '#ffd166', '#b6e388', '#f49ac2', '#c9b6ff'][i % 6], hy = hy0 + jump;
        rr(hx - 14, hy + hr - 2, 28, 60, 8); ink(ccol, 3); X.beginPath(); X.arc(hx, hy, hr, 0, TAU); ink('#ffe3b0', 3);
        X.fillStyle = INK; X.beginPath(); X.arc(hx - 5, hy - 2, 2.2, 0, TAU); X.arc(hx + 5, hy - 2, 2.2, 0, TAU); X.fill();
        if (won || mv > .5) { el(hx, hy + 7, 5, 3 + (won ? 3 : 0)); ink('#7a1f2e', 1.5); }
        if (won) { line([[hx - 12, hy + hr + 8], [hx - 20, hy - 18 + jump * .3]], 5, '#ffe3b0'); line([[hx + 12, hy + hr + 8], [hx + 20, hy - 18 + jump * .3]], 5, '#ffe3b0'); }
      }
      X.restore();
      // door slats (down = closed), bottom lip
      if (open > DY) {
        X.save(); X.beginPath(); X.rect(DX - 4, DY - 4, DW + 8, open - DY + 4); X.clip();
        X.fillStyle = '#e8e2cf'; X.fillRect(DX - 4, DY - 4, DW + 8, open - DY + 4); X.fillStyle = 'rgba(0,0,0,.14)'; for (let y = DY + 20; y < open; y += 26) X.fillRect(DX - 4, y, DW + 8, 6);
        X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(DX + 8, DY, 10, open - DY); X.restore();
        X.fillStyle = INK; X.fillRect(DX - 8, open - 2, DW + 16, 12); X.fillStyle = '#ffd23f'; X.fillRect(DX - 4, open, DW + 8, 6);
        if (lost && rk > .4) badge('SHHH!', DX + DW / 2, DY + DH * .45, 34, '#e8343d', '#fff', outBack((rk - .4) / .25), -.05);
      }
      X.strokeStyle = INK; X.lineWidth = 6; X.strokeRect(DX - 6, DY - 6, DW + 12, DH + 12);
      // the neighbour at the window: grumpy while we play badly, party hat when the street cheers
      { const wx = 640, wy = 156; rr(wx - 56, wy - 44, 112, 88, 6); ink('#ffe9a0', 4);
        const nb = won ? Math.abs(Math.sin(T * 8)) * 6 : lost ? Math.sin(T * 30) * 2 : 0;
        X.beginPath(); X.arc(wx, wy + 12 - nb, 24, 0, TAU); ink('#ffd2a8', 3);
        X.fillStyle = INK; for (const sx of [-1, 1]) { X.beginPath(); X.arc(wx + sx * 9, wy + 8 - nb, 3, 0, TAU); X.fill(); }
        line([[wx - 16, wy - 2 - nb], [wx - 4, wy + 3 - nb]], 3, INK); line([[wx + 16, wy - 2 - nb], [wx + 4, wy + 3 - nb]], 3, INK);
        if (won) { X.beginPath(); X.arc(wx, wy + 18 - nb, 7, 0, Math.PI); ink('#7a1f2e', 1.5); tri(wx - 12, wy - 8 - nb, wx + 12, wy - 8 - nb, wx, wy - 36 - nb, '#ff4d6d', 3); }
        else { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(wx, wy + 26 - nb, 6, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); if (lost || mv < .3) { X.save(); X.translate(wx + 26, wy + 20 - nb); X.rotate(lost ? Math.sin(T * 30) * .4 : 0); el(0, 0, 14, 5); ink('#9a96ab', 3); X.restore(); } } }
      // the crowd meter sign, hung on the wall
      { const bx = 578, by = 62, bw = 190; line([[bx + 20, 40], [bx + 20, by]], 3, INK); line([[bx + bw - 20, 40], [bx + bw - 20, by]], 3, INK);
        rr(bx, by, bw, 30, 8); ink('#fff', 4); rr(bx + 5, by + 5, bw - 10, 20, 5); X.fillStyle = '#3a3550'; X.fill(); const fw = (bw - 10) * clamp(mv, 0, 1);
        if (fw > 2) { rr(bx + 5, by + 5, fw, 20, 5); X.fillStyle = mv > .75 ? '#22c455' : '#ffe14d'; X.fill(); X.fillStyle = 'rgba(255,255,255,.4)'; rr(bx + 8, by + 7, Math.max(0, fw - 6), 5, 2); X.fill(); }
        txt('CROWD', bx + bw / 2, by + 16, 14, mv > .5 ? INK : '#fff', 'center', bw - 20); }
      // the band
      const xs = n === 3 ? [130, 360, 580] : [110, 290, 470, 650], by = 392 + 28 * 1;
      const mood = won ? 'happy' : lost ? 'sad' : null;
      for (let r = 0; r < n; r++) {
        const x = xs[r], hk = Math.exp(-(T - lastTap[r]) / .11), jig = won ? -Math.abs(Math.sin(T * 9 + r)) * 10 : lost ? 0 : r ? -hk * 5 : 0;
        shadow(x, by + 3, 34, 8, .25);
        if (r === 0) { X.save(); rr(x - 28, by - 14, 56, 18, 4); ink('#8a5a3c', 3); X.restore(); caos(x, by - 14 + jig, 3.4, { col: cols(0), mood }); baton(x, by - 14 + jig, T, Math.abs(beat)); }
        else { caos(x, by + jig, 3.2, { col: cols(r), mood }); prop(r, x, by + jig, T, hk); }
        // my last four slots: green / red dots, under the feet
        if (r) for (let q = 0; q < 4; q++) { const j = Math.max(0, Math.floor((S - S0) / BP) - 2 - q); const v = okMap[j] && S > S0 + BP * 2 ? okMap[j][r] : null; X.beginPath(); X.arc(x - 24 + q * 16, by + 20, 5, 0, TAU); ink(v === true ? '#22c455' : v === false ? '#e8343d' : '#cfc8dd', 2); }
        pill(x, by - 62 - (r === 0 ? 20 : 0), r === me ? 'YOU' : name(r), cols(r));
        if (r) txt(NAMES[r], x, by + 44, 15, '#fff', 'center', 110);
      }
      // ───── the lane (instrument) or the whole score + pads (conductor) ─────
      if (!g.result) {
        const ly = 436, lh = 98;
        if (!conductor) {
          rr(26, ly, 748, lh, 14); ink(PAPER, 4);
          X.save(); rr(26, ly, 748, lh, 14); X.clip(); X.strokeStyle = 'rgba(40,30,60,.25)'; X.lineWidth = 2; for (let q = 1; q < 5; q++) { X.beginPath(); X.moveTo(26, ly + q * lh / 5); X.lineTo(774, ly + q * lh / 5); X.stroke(); }
          const cy = ly + lh / 2, col = cols(me);
          for (let b = Math.max(0, barOf(S) - 1); b < NB; b++) {
            const bx0 = HITX + (S0 + b * 2 - S) * PXS; if (bx0 > 790) break; if (bx0 + 2 * PXS < 20) continue;
            line([[bx0, ly + 6], [bx0, ly + lh - 6]], 4, '#5b4a7a');
            for (let q = 1; q < 4; q++) line([[bx0 + q * BP * PXS, ly + 18], [bx0 + q * BP * PXS, ly + lh - 18]], 1.5, 'rgba(40,30,60,.3)');
            const pat = believed(b);
            if (pat === null) { for (let q = 0; q < 4; q++) qchip(bx0 + q * BP * PXS, cy, 14, T); continue; }
            for (const off of pat) {
              const nt = S0 + b * 2 + off * BP, nx = HITX + (nt - S) * PXS; let hitK = 0; for (const tp of taps) if (Math.abs(tp - nt) <= WIN) hitK = 1;
              if (nx > 10 && nx < 790) { X.globalAlpha = nt < S - .15 && !hitK ? .35 : 1; note(nx, cy, 14, col, hitK); X.globalAlpha = 1; }
            }
          }
          X.restore();
          const pk = Math.exp(-(T - lastTap[me]) / .15), glow = 1 + .1 * Math.sin(T * 10);
          X.beginPath(); X.arc(HITX, ly + lh / 2, (30 + pk * 8) * glow, 0, TAU); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = pk > .3 ? '#fff' : cols(me); X.stroke();
          if (S < S0 && T < 4) badge('TAP ON THE NOTES!', 470, ly - 18, 18, '#22a447', '#fff', 1, -.02);
        } else {
          rr(26, ly - 6, 748, 62, 14); ink(PAPER, 4);
          X.save(); rr(26, ly - 6, 748, 62, 14); X.clip();
          for (let b = Math.max(0, barOf(S) - 1); b < Math.min(NB, barOf(S) + 3); b++) {
            const bx0 = HITX + (S0 + b * 2 - S) * PXS, k = kinds[b], isT = b === targetBar();
            X.fillStyle = KCOL[k]; rr(bx0 + 6, ly + 2, 2 * PXS - 12, 46, 10); ink(callOf[b] < 0 ? KCOL[k] : callOf[b] === k ? '#9dffb0' : '#ffb0b0', 3);
            if (isT && callOf[b] !== k) { X.globalAlpha = .5 + .5 * Math.sin(T * 12); rr(bx0 + 3, ly - 1, 2 * PXS - 6, 52, 12); X.lineWidth = 5; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
            txt(PNAME[k], bx0 + PXS * .55, ly + 25, 20, '#fff', 'center', PXS * 1.0);
            for (const off of PAT[k][0]) { X.beginPath(); X.arc(bx0 + 10 + off * BP * PXS + 8, ly + 40, 4, 0, TAU); X.fillStyle = '#fff'; X.fill(); }
            if (callOf[b] >= 0) { txt(callOf[b] === k ? '✓' : '✗', bx0 + 2 * PXS - 24, ly + 24, 22, callOf[b] === k ? '#0b6b25' : '#7a0c1e'); }
          }
          X.restore();
          line([[HITX, ly - 8], [HITX, ly + 58]], 4, '#e8343d');
          // the three pads
          for (let k = 0; k < 3; k++) {
            const px = 26 + k * 252, w = 244, py = 498, dn = Math.exp(-(T - padAt[k]) / .15), d = dn > .4 ? 3 : 8;
            rr(px, py + 8, w, 46, 16); ink('#3a3550', 4); rr(px, py + 8 - d, w, 46, 16); ink(KCOL[k], 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(px + 12, py + 12 - d, w - 24, 8, 4); X.fill();
            txt(PNAME[k], px + w / 2, py + 30 - d, 22, '#fff', 'center', w - 80); if (!TOUCH) { rr(px + 10, py + 17 - d, 24, 26, 6); ink('#fff', 2); txt(String(k + 1), px + 22, py + 31 - d, 18, INK); }
          }
        }
      }
      // streak, floating hits
      if (!g.result && combo >= 3) badge('GROOVE!', 400, 336, 20, '#22a447', '#fff', 1 + .05 * Math.sin(T * 10), -.03);
      if (won) { for (let i = 0; i < 18; i++) { const d = rk - hash(i + 3) * .8; if (d < 0) continue; const fx = 40 + hash(i) * 720 + Math.sin(d * 4 + i) * 16, fy = -20 + d * (180 + hash(i + 9) * 70); if (fy < 560) flower(fx, fy, 14, ['#ff4d6d', '#ffe14d', '#ff8fb1', '#fff'][i % 4], d * 3 + i); } if (rk > .3) badge('ENCORE!', 400, 360, 34, '#22a447', '#fff', outBack((rk - .3) / .25), -.04); }
      if (lost && rk > .5) badge('NOISE COMPLAINT!', 400, 360, 28, '#e8343d', '#fff', outBack((rk - .5) / .25), .04);
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      if (!g.result && T < 2.4) badge(conductor ? 'CALL THE NEXT BAR!' : 'WAIT FOR THE CALL!', 400, 320, 20, conductor ? '#22a447' : '#2b9ee6', '#fff', 1, -.03);
      vignette(.14);
    },
    down(p) {
      ptrDown = true;
      if (conductor) { if (p.y >= 476) call(clamp(Math.floor((p.x - 26) / 252), 0, 2)); }
      else tap();
    },
    move() {}, up() { ptrDown = false; },
    key(e) {
      if (conductor) { const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2, KeyA: 0, KeyS: 1, KeyD: 2 }[e.code]; if (k !== undefined) call(k); }
      else if (!e.repeat) tap();
    },
    keyup() {},
  };
  g.dbg = {
    view: () => ({ S, n, me, tb: targetBar(), kinds, called: callOf.slice(), notes: me && !conductor ? (() => { const o = []; for (let b = 0; b < NB; b++) { const p = believed(b); if (p) for (const off of p) o.push(S0 + b * 2 + off * BP); } return o; })() : [] }),
    kinds, myNotes, okMap,
  };
  wire(g, D, 0, sp, 'sq_band');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  X = ctx;
  X.fillStyle = WALL; X.fillRect(0, 0, 520, 120); X.fillStyle = BRICK; for (let c = 0; c < 6; c++) X.fillRect(c * 90 + 4, 6, 80, 12);
  X.fillStyle = FLOOR; X.fillRect(0, 120, 520, 120); X.fillStyle = INK; X.fillRect(0, 116, 520, 8);
  const u = t % 4;
  // the little door, rising with the groove
  const lift = .3 + .5 * ease((u % 4) / 4);
  X.fillStyle = '#ffd8a0'; X.fillRect(380, 20, 110, 90); X.fillStyle = '#e8e2cf'; X.fillRect(376, 16, 118, 90 * (1 - lift) + 4); X.strokeStyle = INK; X.lineWidth = 4; X.strokeRect(376, 16, 118, 98);
  if (role === 0) {
    caos(70, 150, 3, { col: COLS[0] }); baton(70, 150, t, Math.abs(Math.sin(t * 3)));
    for (let k = 0; k < 3; k++) { const on = Math.floor(u) % 3 === k && u % 1 < .5; rr(150 + k * 112, 150, 100, 56 - (on ? 4 : 0), 14); ink(KCOL[k], 4); txt(PNAME[k], 200 + k * 112, 180, 17, '#fff', 'center', 90); if (on) demoFinger(200 + k * 112, 190, true, (u % 1) * 2); }
    badge('CALL THE NEXT BAR!', 190, 30, 17, '#22a447', '#fff', 1, -.03);
  } else {
    rr(14, 140, 492, 88, 12); ink(PAPER, 4); const cy = 184, col = COLS[role];
    for (let i = 0; i < 8; i++) { const nx = 70 + i * 90 - ((t * 90) % 90) * 1; note(nx, cy, 14, col, 0); }
    X.beginPath(); X.arc(70, cy, 28, 0, TAU); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = col; X.stroke();
    const ph = (t * 1) % 1; demoFinger(70, 214, ph < .2, ph * 5);
    caos(80, 108, 2.2, { col }); prop(role, 80, 108, t, ph < .2 ? 1 : 0);
    badge('TAP ON THE NOTES!', 280, 28, 17, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_band', sqBand, 'GARAGE BAND'); REGMAP.sq_band.duo = true; REGMAP.sq_band.squad = true;
DUO.INFO.sq_band = n => [
  ['CONDUCTOR', 'CALL EACH BAR BEFORE IT STARTS', 'PRESS 1 / 2 / 3 OR TAP A PAD'],
  ['DRUMS', 'HIT THE NOTES ON THE BEAT', 'TAP / CLICK / SPACE'],
  ['BASS', 'HIT THE NOTES ON THE BEAT', 'TAP / CLICK / SPACE'],
  ['KEYS', 'HIT THE NOTES ON THE BEAT', 'TAP / CLICK / SPACE'],
].slice(0, n);
DUO.DEMOS.sq_band = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
