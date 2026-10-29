'use strict';
/* ═════════ SQUAD · CARRO DE EMPUJE (sq_carro), 3-4 players, one role each ═════════
   An old Chevrolet (mattress strapped to the roof) will not start on a Caracas hill. The only way is a push start: get it rolling uphill, drop the clutch
   at the right instant, and the engine catches. If it stalls, the car rolls backwards down the hill into the bodega and flattens the tower of PAN flour cans.
   n = 4:  VOLANTE (0, JUDGE)   sits at the wheel and is the only one who sees the street ahead: holes and a street vendor in the lanes. Changes lane (A D / tap
                                 the left or right half). Hitting something kills the speed; two hits wreck the car. He also integrates the car and calls the verdict.
           EMPUJADOR (1)        pushes from behind: taps on the beat (a ring shrinks onto the target). On the beat = a big shove, off the beat = almost nothing.
           CLUTCH (2)           holds the pedal and lets go while the rev needle is inside the green band THAT ONLY HE SEES, and only when the speed lamp is green
                                 (fast enough and past the holes). A bad release = the motor coughs; two = it dies.
           CORREDOR (3)         runs behind the car (alternate left / right taps fill the breath bar) and jumps in the moment the engine starts.
   n = 3:  the same without the Corredor.
   Win = the engine starts (and the Corredor jumps aboard). Lose = it dies, rolls back to the bodega, two hits, or time.
   The street is identical on every screen whatever n / role (all draws from mkR() in the constructor, always the same number of them).
   Netcode: every role owns its variables and publishes ABSOLUTE values (re-sent every 0.5 s, so a lost message heals itself):
     EMPUJADOR 'ps' [energy*100, taps]  (cumulative shove energy, +24 per shove on the beat, -8 per stumble; the judge adds the difference to the speed)
     CLUTCH    'cl' [release seq, in the green 0/1, pedal down 0/1]
     CORREDOR  'rn' [breath*100, jumped 0/1]
     VOLANTE   'st' [pos*1000, v*1000, strikes, hits, phase]  (coalesced <=12/s), 'why' cause, then 'end' via wire */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2, W = 800, H = 600;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ───────────── numbers ───────────── */
const G = .12, DRAG = .55, PS = .11;                 // slope pull, drag, hill distance per unit of speed per second
const VMIN = .5, POSOK = .68, START = .3;           // speed the engine needs, hill distance where it may start, where the car starts
const BEAT = .42, GOOD = .1, TAPL = .15, BUMP = .24;   // push rhythm: period, half window, tap lockout, shove on the beat (off the beat = nothing)
const HITK = .3, PER = 2.0, WWID = .3, WAITJ = 1.6, CLOCK = .5;     // speed kept after a hit, rev needle period, green band width, jump wait, clutch lockout
const VIS = .34;                                     // how far ahead (in hill distance) the driver sees
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const NAMES = ['STEERING WHEEL', 'PUSHER', 'CLUTCH', 'RUNNER'];
const SLOPE = .2, ANG = -Math.atan(SLOPE), CA = Math.cos(ANG), SA = Math.sin(ANG);
const GX = x => 478 - Math.max(0, x - 215) * SLOPE;  // street surface height at x (flat in front of the bodega, then the hill)
const CXOF = p => 314 + p * 380;                     // car centre x for a hill distance
const needleAt = S => .5 + .5 * Math.sin(TAU * S / PER - 1.1);
const WOOD = '#c98443', WOOD2 = '#9a5f2c', WOODL = '#e6a867';

/* ───────────── tiny drawing kit (X is ctx, or an offscreen context while the background is baked) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function circ(x, y, r, fill, o = 3) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(fill, o); }
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
  txt(label, x + w / 2 - (kc ? 22 : 0), y + 9 - d + h / 2, 22, dim ? 'rgba(246,244,251,.8)' : '#fff', 'center', w - (kc ? 120 : 30));
  if (kc) { X.font = '700 14px Fredoka, Arial, sans-serif'; const cw = Math.max(26, X.measureText(t(cap)).width + 14); rr(x + w - cw - 12, y + 9 - d + h / 2 - 10, cw, 20, 6); ink('#fff', 2.5); txt(cap, x + w - cw / 2 - 12, y + 9 - d + h / 2 + 1, 13, INK, 'center', cw - 4); }
}
function heart(x, y, s, full) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink(full ? '#ff5c8a' : '#bdb6cf', 3); if (full) { X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); } else line([[-3, -8], [2, -2], [-2, 2], [3, 6]], 2, INK);
  X.restore();
}
function plug(x, y, s, ok) {                       // a spark plug: the motor's lives
  X.save(); X.translate(x, y); X.scale(s, s);
  rr(-5, -16, 10, 12, 2); ink(ok ? '#e8ecf5' : '#6d6780', 2.5); rr(-7, -6, 14, 8, 2); ink(ok ? '#ffd23f' : '#8f88a6', 2.5); line([[0, 2], [0, 12]], 3, ok ? '#c9ced6' : '#6d6780');
  if (ok) { X.fillStyle = '#fff'; X.fillRect(-3, -14, 2, 7); } X.restore();
}
function cloud(x, y, sc) {
  X.save(); X.translate(x, y); X.scale(sc, sc); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3, '#3c6fb4'); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
}

/* ───────────── the street scene, painted once (side view: the bodega at the foot of the hill, ranchos up the slope) ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#46b0ec'); gr.addColorStop(.6, '#8fd8fb'); gr.addColorStop(1, '#d8f6ff'); X.fillStyle = gr; X.fillRect(0, 0, W, H);
  // El Ávila, far
  X.beginPath(); X.moveTo(0, 270); for (const [x, y] of [[60, 205], [150, 150], [240, 192], [330, 118], [430, 172], [520, 132], [620, 184], [720, 140], [800, 176]]) X.lineTo(x, y); X.lineTo(800, 360); X.lineTo(0, 360); X.closePath(); ink('#9fb6ee', 3, '#7b80c6');
  X.beginPath(); X.moveTo(0, 300); for (const [x, y] of [[90, 250], [200, 236], [300, 262], [420, 226], [540, 258], [680, 232], [800, 250]]) X.lineTo(x, y); X.lineTo(800, 360); X.lineTo(0, 360); X.closePath(); ink('#84c0d8', 3, '#5b8fb8');
  // the hill with ranchos
  const hy = x => 338 - (x - 300) * .3;
  X.beginPath(); X.moveTo(300, 360); for (let x = 300; x <= 800; x += 25) X.lineTo(x, hy(x)); X.lineTo(800, 520); X.lineTo(300, 520); X.closePath(); ink('#6fc77a', 4, '#2f7a49');
  const pal = ['#ff8f6b', '#ffd23f', '#6ec6ff', '#c79cff', '#ff7ab6', '#9be38a', '#ffb347'];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) {
    const bx = 330 + i * 52 + (row % 2) * 26 + hash(row * 11 + i) * 14, by = hy(bx) + 14 + row * 44 + hash(i * 3 + row) * 6, bw = 34 + hash(i + row * 5) * 12, bh = 26 + hash(i * 7 + row) * 10;
    if (bx > 770 || by + bh > 470) continue;
    rr(bx, by, bw, bh, 3); ink(pal[(i * 3 + row * 2) % pal.length], 2.2);
    rr(bx - 3, by - 5, bw + 6, 8, 2); ink('#a9a4b8', 2); rr(bx + bw * .3, by + bh * .35, 8, 9, 2); ink('#2b2d5c', 1.5);
  }
  // palms by the bodega
  for (const [px, py, s] of [[262, 470, 1.2], [770, 300, .8]]) { line([[px, py], [px + 4, py - 60 * s], [px - 2, py - 120 * s]], 8, '#8a5a34'); for (let q = 0; q < 7; q++) { const a = q * TAU / 7 + .3; X.beginPath(); X.moveTo(px - 2, py - 120 * s); X.quadraticCurveTo(px - 2 + Math.cos(a) * 40 * s, py - 120 * s + Math.sin(a) * 16 * s - 34 * s, px - 2 + Math.cos(a) * 76 * s, py - 120 * s + Math.sin(a) * 36 * s); X.quadraticCurveTo(px - 2 + Math.cos(a) * 40 * s, py - 120 * s + Math.sin(a) * 16 * s - 6, px - 2, py - 120 * s); ink('#3fb260', 2.5); } }
  // the street: a cut-away band, curb, asphalt, yellow dashes along the slope
  X.beginPath(); X.moveTo(0, GX(0)); for (let x = 0; x <= 800; x += 20) X.lineTo(x, GX(x)); X.lineTo(800, 600); X.lineTo(0, 600); X.closePath();
  gr = X.createLinearGradient(0, 330, 0, 600); gr.addColorStop(0, '#767489'); gr.addColorStop(1, '#4a4860'); ink(gr, 0);
  X.beginPath(); X.moveTo(0, GX(0)); for (let x = 0; x <= 800; x += 20) X.lineTo(x, GX(x)); X.lineWidth = 8; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.moveTo(0, GX(0) + 5); for (let x = 0; x <= 800; x += 20) X.lineTo(x, GX(x) + 5); X.lineWidth = 7; X.strokeStyle = '#d8d2c0'; X.stroke();
  for (let x = 230; x < 800; x += 60) line([[x, GX(x) + 44], [x + 30, GX(x + 30) + 44]], 6, '#ffd23f');
  X.fillStyle = 'rgba(255,255,255,.1)'; for (let x = 0; x < 800; x += 90) { X.beginPath(); X.moveTo(x, GX(x) + 70); X.lineTo(x + 50, GX(x + 50) + 70); X.lineTo(x + 50, GX(x + 50) + 84); X.lineTo(x, GX(x) + 84); X.fill(); }
  // the bodega
  rr(-30, 184, 250, 296, 6); ink('#ffd9a0', 5); X.save(); rr(-30, 184, 250, 296, 6); X.clip(); X.fillStyle = '#f0b878'; X.fillRect(176, 184, 60, 300); X.fillStyle = 'rgba(255,120,150,.4)'; for (let q = 0; q < 9; q++) X.fillRect(q * 30 - 14, 184, 10, 300); X.restore();
  rr(-36, 172, 262, 16, 4); ink('#d9944f', 4);
  rr(26, 206, 80, 70, 8); ink('#7a5a8a', 4); rr(20, 272, 92, 10, 3); ink('#d9944f', 3.5);
  for (const [fx, c] of [[40, '#ff7ab6'], [92, '#ffe14d']]) { rr(fx - 12, 260, 24, 14, 3); ink('#c45470', 2.5); circ(fx, 254, 8, c, 2.5); }
  rr(118, 204, 92, 50, 8); ink('#e8434f', 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(124, 208, 80, 8, 4); X.fill();
  for (let i = 0; i < 8; i++) { const x0 = -34 + i * 32; X.beginPath(); X.moveTo(x0, 296); X.lineTo(x0 + 32, 296); X.lineTo(x0 + 32, 330); X.arc(x0 + 16, 330, 16, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff7e6' : '#e8434f', 3); }
  rr(-14, 360, 112, 90, 6); ink('#bfe8ff', 4); glint(14, 380, 8, 22, -.3, .5); for (const [gx, gy, c] of [[8, 430, '#ff8f6b'], [34, 430, '#ffd23f'], [60, 430, '#6ec6ff'], [84, 430, '#9be38a'], [20, 406, '#c79cff'], [52, 406, '#ff7ab6'], [78, 406, '#ffb347']]) { rr(gx - 10, gy - 14, 20, 20, 3); ink(c, 2.2); }
  rr(150, 354, 56, 124, 6); ink('#8a5a3c', 4); rr(158, 364, 40, 112, 4); ink('#3a2a4a', 0); circ(194, 420, 3, '#ffd23f', 1.5);
  // a dog asleep on the sidewalk
  el(54, 470, 26, 11); ink('#d9a86a', 3); el(80, 466, 11, 9); ink('#c08848', 3); el(86, 459, 5, 8, .4); ink('#8d5a2c', 2.5); line([[74, 466], [80, 467]], 2, INK);
  // a lamp post up the hill
  line([[736, GX(736)], [736, GX(736) - 130]], 7, '#6d6780'); rr(716, GX(736) - 146, 44, 14, 6); ink('#ffd23f', 3);
  X = old; return cv;
}

/* ═════════ the game ═════════ */
function sqCarro(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp);
  const judge = me === 0, pusher = me === 1, clutcher = me === 2, runner = me === 3;
  /* the street: identical on every screen (8 draws, always). Three obstacles in the lanes -1 / 0 / 1 */
  const lA = R() < .5 ? -1 : 1, uA = R(), uB = R(), uC = R(), wc = [R(), R(), R()].map(u => .28 + u * .55);
  const HZ = [[.42, 0, 0, uA], [.52, lA, uB < .5 ? 0 : 1, uB], [.6, 0, 1, uC]].map(([p, lane, kind, u], i) => ({ i, p: p + (u - .5) * .02, lane, kind, done: false, hitAt: -9 }));
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  /* state. Truth (judge): pos v lane lx hits strikes phase. Everybody renders d* from the judge's snapshots */
  let S = 0, pos = START, v = 0, laneT = 0, lx = 0, hits = 0, strikes = 0, phase = 0, phaseAt = 0, why = -1, resAt = -1, endFx = false, stAt = -9, lastE = 0, lastCl = 0, rnR = 0, jumped = false, steer = 0;
  let dpos = START, dv = 0, dstr = 0, dhits = 0, dphase = 0, snap = null, sRoll = 0;
  let E = 0, taps = 0, lockS = 0, tapAt = -9, tapGood = false, psAt = -9, pushK = 0;                                           // pusher
  let pressed = false, relSeq = 0, relOk = 0, clLock = 0, clAt = -9, clSent = -9, relFx = -9;                                  // clutch
  let r = 0, lastSide = 0, rnAt = -9, runJump = false, rnSent = -9, stepK = 0;                                                  // runner
  const pops = [], puffs = [], cans = [];
  for (let row = 0, id = 0; row < 4; row++) for (let q = 0; q < 4 - row; q++, id++) cans.push({ id, x: 195 - (4 - row) * 13 + q * 26 + 13, y: 478 - row * 30 - 15, vx: 0, vy: 0 });
  let crashed = false;
  function pop(s, px, py, size, bgc) { pops.length = 0; pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); }
  const carXY = p => { const x = CXOF(p); return { x, y: GX(x) }; };
  const loc = (c, lx2, ly2) => [c.x + lx2 * CA - ly2 * SA, c.y + lx2 * SA + ly2 * CA];
  function puff(x, y, col, big, vx = 0, vy = -26) { if (puffs.length > 44) puffs.shift(); puffs.push({ x, y, t0: g.c, life: .8 + .5 * big, col, big, vx, vy }); }
  function cough(strong) {                                                                        // the motor coughs: black smoke out of the exhaust
    const c = carXY(judge ? pos : dpos), [ex, ey] = loc(c, -98, -16);
    for (let i = 0; i < (strong ? 9 : 6); i++) puff(ex - i * 3, ey - i * 2, '#4a4458', 1.2 + hash(i) * .6, -50 - i * 14, -24 - hash(i + 4) * 30);
    shake(strong ? 7 : 4, .2); sfx.miss && sfx.miss(); snd(150, .22, 'sawtooth', .06, 0, 70); noise(.25, .07, 300, 1200, 'bandpass');
    pop(strong ? 'COUGH COUGH!' : 'COUGH!', 400, 300, 28, '#6d6780');
  }
  function engineFx() {
    const c = carXY(judge ? pos : dpos), [ex, ey] = loc(c, -98, -16);
    for (let i = 0; i < 8; i++) puff(ex - i * 4, ey - i * 2, '#e6e2ee', 1.4, -60 - i * 12, -20 - hash(i) * 26);
    shake(6, .25); snd(110, .5, 'sawtooth', .07, 0, 220); snd(165, .4, 'square', .04, .05, 260); noise(.4, .08, 200, 900, 'bandpass'); pop('BRRRUM!', 400, 300, 34, '#22a447');
  }
  function hitFx() { shake(8, .22); sfx.thud && sfx.thud(); noise(.25, .08, 400, 1800, 'bandpass'); pop('BONK!', 400, 300, 32, '#e8343d'); }

  /* ── pusher ── */
  const sendPs = () => { psAt = g.c; D.send('ps', [E, taps], true); };
  function tapPush() {
    if (!pusher || g.result || S < lockS) return; lockS = S + TAPL;
    const ph = ((S % BEAT) + BEAT) % BEAT, dist = Math.min(ph, BEAT - ph), good = dist <= GOOD;
    if (!good) lockS = S + TAPL * 3.3;                                                           // a stumble: no shove and the rhythm is lost for a beat
    E += good ? Math.round(BUMP * 100) : -8; taps++; tapAt = g.c; tapGood = good; pushK = 1; sendPs();
    snd(good ? 300 : 180, .07, 'triangle', .06, 0, good ? 200 : 140); if (good) noise(.08, .04, 600, 2000, 'bandpass');
    pop(good ? 'SHOVE!' : 'OFF BEAT', 400, 410, 22, good ? '#22a447' : '#8f88a6');
  }
  /* ── clutch ── */
  const sendCl = () => { clSent = g.c; D.send('cl', [relSeq, relOk, pressed ? 1 : 0], true); };
  function pedalDown() { if (!clutcher || g.result || pressed || S < clLock) return; pressed = true; clAt = g.c; snd(200, .08, 'triangle', .05, 0, 120); if (relSeq) sendCl(); }
  function pedalUp() {
    if (!pressed) return; pressed = false; const c = needleAt(S), w = wc[relSeq % 3], ok = Math.abs(c - w) <= WWID / 2;
    relSeq++; relOk = ok ? 1 : 0; clLock = S + CLOCK; relFx = g.c; sendCl();
    snd(ok ? 420 : 160, .14, ok ? 'triangle' : 'sawtooth', .06, 0, ok ? 600 : 90); pop(ok ? 'CLICK!' : 'MISSED!', 400, 410, 24, ok ? '#22a447' : '#e8434f');
  }
  /* ── runner ── */
  const sendRn = () => { rnAt = g.c; D.send('rn', [Math.round(r * 100), runJump ? 1 : 0], true); };
  function runTap(side) {
    if (!runner || g.result) return; r = clamp(r + (side !== lastSide ? .13 : .03), 0, 1); lastSide = side; stepK = g.c; snd(side < 0 ? 240 : 280, .03, 'square', .02);
    if (g.c - rnAt >= .08) sendRn();
  }
  function jumpIn() {
    if (!runner || g.result || runJump) return;
    if (dphase < 1) return;
    if (r >= .4) { runJump = true; sendRn(); snd(500, .15, 'triangle', .06, 0, 900); } else { pop('TOO TIRED!', 400, 410, 24, '#8f88a6'); snd(160, .12, 'sawtooth', .05); }
  }
  /* ── judge ── */
  const lose = k => { if (g.result) return; why = k; D.send('why', k); sendSt(); g.finish('lose'); };
  function sendSt() { stAt = g.c; D.send('st', [Math.round(pos * 1000), Math.round(v * 1000), strikes, hits, phase], true); }
  function laneStep(d) { if (!judge || g.result) return; const l = clamp(laneT + d, -1, 1); if (l !== laneT) { laneT = l; steer = d; snd(330, .05, 'triangle', .04, 0, 380); } }
  function clutchRelease(ok) {
    const ready = v >= VMIN && pos >= POSOK;
    if (ok && ready) { phase = 1; phaseAt = S; sendSt(); engineFx(); }
    else { strikes++; v *= .6; sendSt(); cough(strikes >= 2); if (strikes >= 2) lose(2); }
  }

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['STEER!', 'PUSH!', 'CLUTCH!', 'RUN!'][me], roleLabel: NAMES[me],
    hint: judge ? 'A / D CHANGES LANE - DODGE THE HOLES AND THE VENDOR, TWO HITS WRECK THE CAR'
      : pusher ? 'PRESS SPACE ON THE BEAT - OFF THE BEAT THE CAR BARELY MOVES'
      : clutcher ? 'HOLD SPACE (CLUTCH IN) AND LET GO WITH THE NEEDLE IN THE GREEN, ONLY WHEN THE SPEED LAMP IS GREEN'
      : 'ALTERNATE A / D TO RUN, THEN SPACE TO JUMP IN WHEN THE ENGINE STARTS',
    thint: judge ? 'TAP LEFT OR RIGHT TO CHANGE LANE - DODGE THE HOLES AND THE VENDOR, TWO HITS WRECK THE CAR'
      : pusher ? 'TAP ON THE BEAT - OFF THE BEAT THE CAR BARELY MOVES'
      : clutcher ? 'HOLD (CLUTCH IN) AND LET GO WITH THE NEEDLE IN THE GREEN, ONLY WHEN THE SPEED LAMP IS GREEN'
      : 'TAP LEFT AND RIGHT TO RUN, THEN TAP JUMP WHEN THE ENGINE STARTS',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt; const wd = dt * TS;
      if (g.result && resAt < 0) resAt = g.c;
      const live = !g.result;
      if (live) S += wd;
      pushK = Math.max(0, pushK - dt * 6);
      if (live) {
        if (pusher && g.c - psAt >= CLOCK) sendPs();
        if (clutcher && relSeq && g.c - clSent >= CLOCK) sendCl();
        if (runner) { r = Math.max(0, r - .3 * wd); if (g.c - rnAt >= CLOCK) sendRn(); }
      }
      if (judge && live) {
        lx += clamp(laneT - lx, -7 * wd, 7 * wd);
        if (phase === 0) v += (-G - DRAG * v) * wd; else v += (1 - v) * 1.5 * wd;
        v = clamp(v, -1.2, 1.2); pos = clamp(pos + v * PS * wd, 0, 1);
        for (const h of HZ) if (!h.done && pos >= h.p) {
          h.done = true;
          if (Math.abs(lx - h.lane) < .62) { h.hitAt = g.c; hits++; v *= HITK; sendSt(); hitFx(); if (hits >= 2) lose(4); }
        }
        if (!g.result) {
          if (phase === 0 && pos <= 0 && v < 0) lose(1);
          else if (phase === 1 && (jumped || (n === 3 && S - phaseAt > .7))) { sendSt(); g.finish('win'); }
          else if (phase === 1 && S - phaseAt > WAITJ) lose(3);
          else if (g.c >= g.limit) lose(phase ? 3 : 0);
        }
        if (!g.result && g.c - stAt >= (.5 - .42 * (Math.abs(v) > .02 ? 1 : 0))) sendSt();
        dpos = pos; dv = v; dstr = strikes; dhits = hits; dphase = phase;
      } else if (!judge && snap) {
        const a = Math.min(g.c - snap.t, .3), k = Math.min(1, dt * 10), tp = clamp(snap.pos + snap.v * PS * TS * a, 0, 1);
        dpos += (tp - dpos) * k; dv += (snap.v - dv) * k;
      }
      // smoke from the exhaust, wheel roll, hazards in the way
      if (!g.result || g.result === 'win') {
        const c = carXY(dpos), [ex, ey] = loc(c, -98, -16); sRoll += dt;
        if (dphase >= 1 || dv > .12) { if (sRoll > (dphase ? .07 : .2)) { sRoll = 0; puff(ex, ey, dphase ? '#d8d4e2' : '#e8e4f0', dphase ? 1.2 : .6, -40, -22); } }
      }
      if (g.result && !endFx) {
        endFx = true;
        if (g.result === 'win') { snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); noise(.5, .06, 200, 800, 'bandpass'); }
        else { sfx.miss && sfx.miss(); snd(330, .5, 'sawtooth', .06, 0, 110); if (!judge && why < 0) why = 0; }
      }
      // the end of a lost game: the crash into the cans
      if (g.result === 'lose' && resAt >= 0) {
        const rk = g.c - resAt, Dd = .55 + .7 * dpos, tc = .35 + Dd;
        if (!crashed && rk >= tc) {
          crashed = true; shake(11, .35); sfx.thud && sfx.thud(); noise(.5, .1, 300, 2400, 'bandpass'); snd(90, .4, 'sawtooth', .08, 0, 50);
          for (const cn of cans) { cn.vx = -120 + hash(cn.id * 3 + 1) * 380 + (4 - 0) * 0; cn.vy = -260 - hash(cn.id + 9) * 260; cn.vx = -60 + hash(cn.id * 3 + 1) * 340; }
          burst(250, 440, '#e8434f', 14, 280); burst(250, 440, '#fff7e6', 10, 220);
        }
      }
      if (crashed) for (const cn of cans) { cn.x += cn.vx * dt; cn.vy += 900 * dt; cn.y += cn.vy * dt; if (cn.y > 470) { cn.y = 470; cn.vy *= -.35; cn.vx *= .8; } }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      for (let i = puffs.length - 1; i >= 0; i--) if (g.c - puffs[i].t0 > puffs[i].life) puffs.splice(i, 1);
    },
    msg(type, d, from) {
      if (type === 'ps' && Array.isArray(d)) {
        if (from === 1 && judge && !g.result) { const e = d[0] | 0; if (e !== lastE) { if (phase === 0) v = clamp(v + (e - lastE) / 100, -1.2, 1.2); lastE = e; } }
        else if (from === 1 && !judge) { const k = (d[1] | 0); if (k > taps) taps = k; }
      } else if (type === 'cl' && Array.isArray(d)) {
        if (judge && from === 2 && !g.result && (d[0] | 0) > lastCl) { lastCl = d[0] | 0; if (phase === 0) clutchRelease(!!d[1]); }
      } else if (type === 'rn' && Array.isArray(d)) {
        rnR = d[0] / 100; if (judge && from === 3 && d[1] && phase >= 1) jumped = true;
      } else if (type === 'st' && Array.isArray(d) && !judge) {
        snap = { t: g.c, pos: d[0] / 1000, v: d[1] / 1000 };
        if (d[2] > dstr) { dstr = d[2]; strikes = d[2]; cough(d[2] >= 2); } if (d[3] > dhits) { dhits = d[3]; hits = d[3]; hitFx(); }
        if (d[4] > dphase) { dphase = d[4]; phase = d[4]; engineFx(); }
        strikes = Math.max(strikes, d[2]); hits = Math.max(hits, d[3]);
      } else if (type === 'why') { why = d | 0; }
    },
    down(p) {
      if (g.result) return;
      if (judge) laneStep(p.x < 400 ? -1 : 1);
      else if (pusher) tapPush();
      else if (clutcher) pedalDown();
      else if (runner) { if (p.y >= 440 && p.x > 300 && p.x < 500) jumpIn(); else runTap(p.x < 400 ? -1 : 1); }
    },
    move() {},
    up() { if (clutcher) pedalUp(); },
    key(e) {
      if (g.result || e.repeat) return; const c = e.code;
      if (judge) { if (c === 'ArrowLeft' || c === 'KeyA') laneStep(-1); else if (c === 'ArrowRight' || c === 'KeyD') laneStep(1); }
      else if (pusher) tapPush();
      else if (clutcher) pedalDown();
      else if (runner) { if (c === 'ArrowLeft' || c === 'KeyA') runTap(-1); else if (c === 'ArrowRight' || c === 'KeyD') runTap(1); else if (c === 'Space' || c === 'Enter' || c === 'ArrowUp' || c === 'KeyW') jumpIn(); }
    },
    keyup() { if (clutcher) pedalUp(); },
  };
  g.dbg = {
    view() {
      const ready = dv >= VMIN + .03 && dpos >= POSOK + .01;
      if (judge) return { S, pos, v, lane: laneT, lx, hits, strikes, phase, hz: HZ.map(h => ({ p: h.p, lane: h.lane, kind: h.kind, done: h.done })) };
      if (pusher) return { S, beat: BEAT, ph: ((S % BEAT) + BEAT) % BEAT, lock: S < lockS, v: dv, taps };
      if (clutcher) { const w = wc[relSeq % 3]; return { S, needle: needleAt(S), win: [w - WWID / 2, w + WWID / 2], ready, pressed, lock: S < clLock, phase: dphase, seq: relSeq }; }
      return { S, r, phase: dphase, jumped: runJump };
    },
    HZ,
  };

  /* ───────────── drawing: the side view ───────────── */
  function zamuro(x, y, T, s) { const fl = Math.sin(T * 5 + s) * 7; X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 14, y - fl); X.quadraticCurveTo(x - 6, y - 5, x, y); X.quadraticCurveTo(x + 6, y - 5, x + 14, y - fl); X.stroke(); }
  function abuela(T, won, lost, rk) {
    const x = 66, y = 262, sh = lost ? Math.sin(T * 30) * 1.5 : won ? 0 : Math.sin(T * 1.6) * 2;
    el(x + sh, y - 24, 22, 24); ink('#e0a96a', 3.5); el(x + sh, y - 52, 20, 11); ink('#c9c9d8', 3); circ(x + sh, y - 66, 8, '#c9c9d8', 3);    // face, grey hair, bun
    X.fillStyle = INK; for (const s of [-1, 1]) { X.beginPath(); X.arc(x + sh + s * 8, y - 28, lost ? 4.2 : 2.6, 0, TAU); X.fill(); }
    X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); if (lost) X.ellipse(x + sh, y - 12, 5, 7, 0, 0, TAU); else X.arc(x + sh, y - (won ? 14 : 10), 6, won ? .1 : 3.4, won ? 3 : 6); X.stroke();
    if (lost) for (const s of [-1, 1]) { el(x + sh + s * 30, y - 20 + Math.sin(T * 14) * 3, 7, 7); ink('#e0a96a', 2.5); }
    else for (const s of [-1, 1]) { el(x + s * 28, y + 2, 8, 6); ink('#e0a96a', 2.5); }
    if (won) { for (let i = 0; i < 3; i++) heart(x + 40 + i * 6, y - 60 - ((T * 40 + i * 20) % 60), .6, true); }
  }
  function drawCans() {
    for (const cn of cans) {
      X.save(); X.translate(cn.x, cn.y); if (crashed) X.rotate(cn.id * .9 + (g.c - resAt) * 4 * (hash(cn.id) - .3));
      rr(-13, -15, 26, 30, 4); ink('#f5e9c6', 3); X.fillStyle = '#e8434f'; X.fillRect(-13, -6, 26, 12); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(-9, -13, 4, 26);
      X.fillStyle = '#c9ced6'; X.fillRect(-13, -15, 26, 3); txt('PAN', 0, 0, 10, '#fff7e6', 'center', 24); X.restore();
    }
  }
  function carShape(T, o) {                                               // the Chevrolet in its own frame: wheels on y = 0, nose to the right
    const body = '#35b6a6', shade = '#238a80';
    for (const wx of [-48, 50]) {
      X.save(); X.translate(wx, -19); X.rotate(o.wheel); circ(0, 0, 19, '#2b2640', 4); circ(0, 0, 9.5, '#d8dcea', 2.5); X.strokeStyle = '#8f9cb3'; X.lineWidth = 2.5; for (let q = 0; q < 4; q++) { X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(q * TAU / 4) * 8, Math.sin(q * TAU / 4) * 8); X.stroke(); } X.restore();
    }
    cel(body, shade, () => rr(-84, -64, 168, 42, 12), 7, 8);
    X.save(); rr(-84, -64, 168, 42, 12); X.clip(); X.fillStyle = '#d9d4c8'; rr(-4, -60, 52, 34, 8); X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();        // primer door
    X.fillStyle = '#b9622e'; for (const [rx2, ry2, rs] of [[8, -36, 3], [34, -50, 2.5], [-62, -30, 3.5], [-48, -54, 2.2]]) { X.beginPath(); X.arc(rx2, ry2, rs, 0, TAU); X.fill(); } X.restore();
    glint(-48, -56, 18, 3, 0, .45);
    const cab = () => { X.beginPath(); X.moveTo(-50, -62); X.quadraticCurveTo(-50, -106, -26, -108); X.lineTo(26, -108); X.quadraticCurveTo(48, -106, 60, -62); X.closePath(); };
    cel(body, shade, cab, 5, 6);
    rr(-41, -100, 31, 33, 7); ink('#bfe8ff', 3); rr(2, -100, 44, 33, 7); ink('#bfe8ff', 3); glint(-34, -92, 3, 10, -.3, .6); glint(10, -92, 3, 10, -.3, .6);
    rr(-86, -42, 14, 12, 4); ink('#e8ecf5', 3); rr(76, -42, 14, 12, 4); ink('#e8ecf5', 3);                  // bumpers
    circ(78, -52, 6.5, '#fff2a0', 2.5); rr(-86, -60, 8, 14, 3); ink('#ff4d5e', 2.5);                         // headlight, tail light
    rr(-76, -34, 30, 12, 3); ink('#fff7e6', 2); line([[-72, -28], [-50, -28]], 2, '#b9a98a');                // plate
    line([[-84, -26], [-98, -14]], 4, '#8f9cb3');                                                              // exhaust
    // the mattress and the rope on the roof
    rr(-36, -128, 74, 22, 9); ink('#f6e9c8', 3.5); for (let q = -2; q <= 2; q++) line([[q * 14 - 2, -126], [q * 14 - 2, -108]], 1.5, '#d9c9a0');
    line([[-18, -130], [-18, -104]], 2.5, '#b9622e'); line([[20, -130], [20, -104]], 2.5, '#b9622e');
    if (o.shake) { /* the engine's shudder is applied by the caller */ }
  }
  function carDraw(T, c, o) {
    X.save(); X.translate(c.x + (o.sx || 0), c.y + (o.sy || 0)); X.rotate(ANG + (o.tilt || 0));
    el(0, 2, 98, 7); X.fillStyle = 'rgba(20,16,28,.28)'; X.fill();
    carShape(T, o); X.restore();
  }
  function sideScene(T, won, lost, rk) {
    if (!BG) BG = buildBg();
    X.drawImage(BG, 0, 0);
    // live sky: sun, clouds, zamuros circling the hill
    X.save(); X.translate(700, 72); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)'; for (let q = 0; q < 10; q++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(40, -6); X.lineTo(84, 0); X.lineTo(40, 6); X.fill(); } X.restore();
    circ(700, 72, 30, '#ffe14d', 4); glint(692, 64, 8, 5, -.5, .8);
    for (const [sx, sy, sc, spd] of [[40, 118, .9, 6], [300, 74, .8, 4], [520, 150, .7, 8]]) cloud(((T * spd + sx) % 1000) - 140, sy, sc);
    for (let q = 0; q < 2; q++) { const a = T * .6 + q * 3; zamuro(560 + Math.cos(a) * 70, 128 + Math.sin(a) * 22 + q * 20, T, q); }
    // the bodega sign
    txt('BODEGA', 164, 224, 17, '#fff', 'center', 80); txt('EL CHAMO', 164, 243, 13, '#ffe14d', 'center', 80);
    abuela(T, won, lost, rk);
    // car position
    let p = dpos, xoff = 0, tilt = 0, sx = 0, sy = 0, wheel = T * (dv * 6), roll = 0;
    const live = !g.result;
    if (live && dphase >= 1) { sx = Math.sin(T * 60) * 1.2; sy = Math.cos(T * 70) * 1; }
    else if (live && dv < VMIN && dv > .05) { sy = Math.sin(T * 40) * .6; }
    if (lost) {
      const Dd = .55 + .7 * dpos, k = rk - .35;
      if (rk < .35) { sx = Math.sin(rk * 90) * 3; }
      else { const u = clamp(k / Dd, 0, 1); p = dpos * (1 - u * u); wheel = -(T * 10); tilt = crashed ? Math.sin(clamp((rk - .35 - Dd) / .15, 0, 1) * 3) * .06 : 0; }
      if (crashed && rk > .35 + Dd) { sx -= 0; }
    }
    if (won) {
      const k = rk - .55; if (k > 0) { xoff = 520 * k * k + 40 * k; wheel = T * 14; tilt = -.02; }
      sx += Math.sin(T * 60) * 1.2;
    }
    const c = carXY(p); c.x += xoff; c.y = GX(c.x);
    drawCans();
    // people on the ground: pusher and runner
    const push0 = loc({ x: c.x, y: c.y }, -112, 0);
    // pusher
    if (n >= 1) {
      let px = push0[0] + (lost ? -10 * clamp((rk) * 3, 0, 1) : 0), py = GX(px), lean = .3 + pushK * .12 + (dv > .1 ? Math.sin(T * 9) * .04 : 0);
      let mood = won ? 'happy' : lost ? 'sad' : null, ox = 0, oy = 0;
      if (won && rk > .1) { const k = ease((rk - .1) / .45); const tgt = loc({ x: c.x, y: c.y }, -16, -130); px = lerp(px, tgt[0], k); py = lerp(py, tgt[1], k) - 60 * Math.sin(Math.PI * k); lean = 0; }
      X.save(); X.translate(px, py); shadow(0, 2, 16, 5, .25); X.rotate((won && rk > .1) ? 0 : (lost && rk > .35 ? -.1 : lean)); X.translate(-px, -py);
      caos(px, py, 2.4, { col: cols(1), mood }); X.restore();
      if (!won || rk < .1) pill(px, py - 52, 1 === me ? 'YOU' : name(1), cols(1));
    }
    if (n === 4) {
      const lagr = 1 - clamp(runner ? r : rnR, 0, 1); let px = push0[0] - 90 - (runner ? lagr * 70 : 20), py = GX(px), mood = won ? 'happy' : lost ? 'sad' : null;
      if (lost) px = push0[0] - 90 + Math.sin(rk * 10) * 2;
      if (won && rk > .1) { const k = ease((rk - .1) / .5); const tgt = loc({ x: c.x, y: c.y }, 22, -130); px = lerp(px, tgt[0], k); py = lerp(GX(px), tgt[1], k) - 70 * Math.sin(Math.PI * k); }
      shadow(px, GX(px) + 2, 14, 4, .25);
      caos(px, py, 2.4, { col: cols(3), mood, run: (!g.result || won) ? (runner ? (T - stepK < .5 ? T : null) : T) : null });
      if (!(won && rk > .1)) pill(px, py - 52, 3 === me ? 'YOU' : name(3), cols(3));
    }
    // the car and the two crew inside
    carDraw(T, c, { wheel, tilt, sx, sy });
    const cc = { x: c.x + sx, y: c.y + sy }, mood = won ? 'happy' : lost ? 'sad' : null, [wx0, wy0] = loc(cc, 24, -66), [wx1, wy1] = loc(cc, -26, -66);
    caos(wx0, wy0 + (won ? -Math.abs(Math.sin(T * 9)) * 6 : 0), 1.9, { col: cols(0), mood });
    caos(wx1, wy1 + (won ? -Math.abs(Math.sin(T * 9 + 1)) * 6 : 0), 1.9, { col: cols(2), mood });
    // steering wheel inside the front window
    const [sw0, sw1] = loc(cc, 40, -76); el(sw0, sw1, 3, 12, ANG); ink('#2b2640', 2);
    const [t0, t1] = loc(cc, 24, -122); pill(t0 + 40, t1 - 8, 0 === me ? 'YOU' : name(0), cols(0));
    const [u0, u1] = loc(cc, -26, -122); pill(u0 - 40, u1 - 12, 2 === me ? 'YOU' : name(2), cols(2));
    // smoke
    for (const q of puffs) { const k = (g.c - q.t0) / q.life, rad = (7 + 18 * q.big) * (.4 + k), px = q.x + q.vx * (g.c - q.t0), py = q.y + q.vy * (g.c - q.t0); X.globalAlpha = (1 - k) * .9; circ(px, py, rad, q.col, 2.5); X.globalAlpha = 1; }
    if (lost && rk > .2 && rk < .6) for (let q = 0; q < 2; q++) { const [ex, ey] = loc(c, -98, -16); circ(ex - 12 - q * 16 - rk * 80, ey - 8 - rk * 40 - q * 10, 10 + q * 5, '#4a4458', 2.5); }
    // hill sign "LAS LATAS PAN"
    return c;
  }

  /* ───────────── drawing: the driver's view ───────────── */
  function roadView(T) {
    const HZY = 232, yk = k => HZY + 300 * k * k, hw = k => 40 + 360 * k * k, ln = (l, k) => 400 + l * (2 * hw(k) / 3);
    let gr = X.createLinearGradient(0, 0, 0, HZY); gr.addColorStop(0, '#46b0ec'); gr.addColorStop(1, '#d8f6ff'); X.fillStyle = gr; X.fillRect(0, 0, W, HZY);
    X.beginPath(); X.moveTo(0, HZY); for (const [x, y] of [[40, 170], [150, 120], [260, 170], [380, 100], [500, 160], [620, 110], [720, 160], [800, 130]]) X.lineTo(x, y); X.lineTo(800, HZY); X.closePath(); ink('#9fb6ee', 3, '#7b80c6');
    cloud(((T * 6 + 60) % 1000) - 140, 70, .9); cloud(((T * 4 + 500) % 1000) - 140, 130, .7);
    X.fillStyle = '#78b55e'; X.fillRect(0, HZY, W, H - HZY);
    X.fillStyle = 'rgba(255,255,255,.1)'; for (let q = 0; q < 6; q++) X.fillRect(0, HZY + 20 + q * 56, W, 14);
    // ranchos scrolling past on both sides
    const step = .045, base = Math.floor(dpos / step), off = dpos - base * step, pal = ['#ff8f6b', '#ffd23f', '#6ec6ff', '#c79cff', '#ff7ab6', '#9be38a', '#ffb347'];
    for (let j = Math.ceil(VIS / step); j >= 0; j--) {
      const dd = j * step - off, k = 1 - dd / VIS; if (k < .05 || k > 1.25) continue;
      for (const s of [-1, 1]) {
        const id = base + j, bw = (40 + hash(id * 2 + s) * 20) * (.2 + k * k * 1.6), bh = (50 + hash(id * 3 + s) * 20) * (.2 + k * k * 1.6), bx = 400 + s * (hw(k) + 30 + k * 40 + bw / 2) - bw / 2, by = yk(k) - bh;
        rr(bx, by, bw, bh, 4); ink(pal[(id + (s > 0 ? 3 : 0)) % pal.length], 2.5); rr(bx - 3, by - 6, bw + 6, 9, 3); ink('#a9a4b8', 2); rr(bx + bw * .3, by + bh * .4, bw * .25, bh * .25, 2); ink('#2b2d5c', 1.5);
      }
    }
    // the road with curb stripes and lane dashes
    X.beginPath(); X.moveTo(400 - hw(0), yk(0)); X.lineTo(400 + hw(0), yk(0)); X.lineTo(400 + hw(1.25), yk(1.25)); X.lineTo(400 - hw(1.25), yk(1.25)); X.closePath(); ink('#5c5a6e', 4);
    const sstep = .03, so = ((dpos % sstep) + sstep) % sstep;
    for (let j = Math.ceil(VIS / sstep); j >= 0; j--) {
      const d0 = j * sstep - so, d1 = d0 + sstep * .5, k0 = 1 - d0 / VIS, k1 = 1 - d1 / VIS; if (k1 < 0 || k0 > 1.25) continue;
      const a = clamp(k1, 0, 1.25), b = clamp(k0, 0, 1.25);
      for (const l of [-1 / 3, 1 / 3]) { X.beginPath(); X.moveTo(400 + l * 2 * hw(a) - 3 * (.3 + a), yk(a)); X.lineTo(400 + l * 2 * hw(b) - 3 * (.3 + b), yk(b)); X.lineTo(400 + l * 2 * hw(b) + 3 * (.3 + b), yk(b)); X.lineTo(400 + l * 2 * hw(a) + 3 * (.3 + a), yk(a)); X.fillStyle = '#fff7e6'; X.fill(); }
      for (const s of [-1, 1]) { X.beginPath(); X.moveTo(400 + s * hw(a), yk(a)); X.lineTo(400 + s * hw(b), yk(b)); X.lineTo(400 + s * (hw(b) + 12 * (.2 + b)), yk(b)); X.lineTo(400 + s * (hw(a) + 12 * (.2 + a)), yk(a)); X.fillStyle = (Math.floor((dpos + j * sstep) / sstep) % 2) ? '#e8434f' : '#fff'; X.fill(); }
    }
    // obstacles, far to near
    const hs = HZ.filter(h => h.p - dpos < VIS && h.p - dpos > -.05).sort((a, b) => b.p - a.p);
    for (const h of hs) {
      const d = h.p - dpos, k = 1 - d / VIS, sc = .18 + k * k * 1.15, x = ln(h.lane, k), y = yk(k);
      X.save(); X.translate(x, y); X.scale(sc, sc);
      if (h.kind === 0) {                                                       // a hole with a traffic cone
        el(0, 0, 76, 24); ink('#3b3347', 5, '#8c8aa0'); el(-10, -3, 56, 14); X.fillStyle = '#1f1a2c'; X.fill(); for (const [a, b] of [[-60, 6], [58, -4], [-20, 22]]) line([[a, b], [a + 14, b + 10]], 2, '#8c8aa0');
        X.beginPath(); X.moveTo(70, 4); X.lineTo(86, -44); X.lineTo(102, 4); X.closePath(); ink('#ff8a3d', 4); X.fillStyle = '#fff'; X.fillRect(77, -22, 18, 8);
      } else {                                                                  // a street vendor with an umbrella cart
        el(0, 4, 70, 14); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
        rr(-46, -46, 92, 40, 6); ink(WOODL, 4); rr(-52, -52, 104, 10, 4); ink('#d9944f', 3.5); circ(-30, 4, 12, '#2b2640', 3); circ(30, 4, 12, '#2b2640', 3);
        line([[0, -52], [0, -120]], 5, '#8f9cb3');
        for (let q = 0; q < 6; q++) { X.beginPath(); X.moveTo(0, -126); X.lineTo(-66 + q * 22, -96); X.lineTo(-44 + q * 22, -96); X.closePath(); ink(q % 2 ? '#fff7e6' : '#ff5c8a', 2.5); }
        for (const [a, c] of [[-28, '#ffd23f'], [-8, '#ff8f6b'], [12, '#ffd23f'], [30, '#9be38a']]) { rr(a - 8, -44, 16, 12, 4); ink(c, 2); }
        caos(62, 0, 2.6, { col: '#c79cff' }); X.fillStyle = INK; txt('TEQUEÑOS', 0, -66, 12, INK, 'center', 90);
      }
      if (h.kind === 1 && h.hitAt > -9 && g.c - h.hitAt < .6) { /* hit marker handled by pop */ }
      X.restore();
    }
    for (const h of HZ) if (!h.done && h.p - dpos > 0 && h.p - dpos < .17) { const k = 1 - (h.p - dpos) / VIS; X.globalAlpha = .6 + .4 * Math.sin(T * 10); txt('!', ln(h.lane, k), yk(k) - (h.kind ? 150 : 80) * (.18 + k * k * 1.15), 26, '#ffe14d'); X.globalAlpha = 1; }
    // the hood, the steering wheel and the lane plates
    const hood = () => { X.beginPath(); X.moveTo(150, 600); X.quadraticCurveTo(190, 450, 300, 440); X.lineTo(500, 440); X.quadraticCurveTo(610, 450, 650, 600); X.closePath(); };
    cel('#35b6a6', '#238a80', hood, 8, 10, 5); glint(330, 462, 70, 8, 0, .4);
    rr(300, 436, 14, 16, 4); ink('#e8ecf5', 3); rr(486, 436, 14, 16, 4); ink('#e8ecf5', 3);
    X.save(); X.translate(400, 520); X.rotate((laneT - lx) * .25 + lx * .3); X.scale(1, .5);
    X.beginPath(); X.arc(0, 0, 82, 0, TAU); X.lineWidth = 20; X.strokeStyle = INK; X.stroke(); X.lineWidth = 12; X.strokeStyle = '#6d6780'; X.stroke();
    for (const a of [Math.PI / 2, Math.PI * 1.17, Math.PI * 1.83]) line([[0, 0], [Math.cos(a) * 76, Math.sin(a) * 76]], 9, '#6d6780'); circ(0, 0, 18, '#e8ecf5', 3.5); X.restore();
    if (!g.result) {
      plate(30, 470, 150, 52, '#ffd23f', '#c99512', laneT < 0 && g.c % 1 < .1, '◄', 'A'); plate(620, 470, 150, 52, '#ffd23f', '#c99512', laneT > 0 && g.c % 1 < .1, '►', 'D');
    }
  }

  /* ───────────── HUD per role ───────────── */
  function statusBoard(T) {                                                        // the motor's spark plugs and the car's hearts, on a sign (centre top, clear of the party HUD)
    line([[330, 62], [330, 78]], 3, '#e6c58c'); line([[470, 62], [470, 78]], 3, '#e6c58c');
    rr(300, 78, 200, 40, 12); ink(WOODL, 4);
    for (let q = 0; q < 2; q++) heart(336 + q * 34, 100, 1, q >= dhits);
    for (let q = 0; q < 2; q++) plug(436 + q * 32, 104, 1, q >= dstr);
  }
  function speedBar(x, y, w) {
    const f = clamp(dv, 0, 1);
    rr(x, y, w, 28, 14); ink('#e8f6ff', 4); X.save(); rr(x + 4, y + 4, w - 8, 20, 10); X.clip(); X.fillStyle = f >= VMIN ? '#3ddc5f' : '#ffb347'; X.fillRect(x, y, w * f, 28); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x + 6, y + 7, Math.max(0, w * f - 8), 5); X.restore();
    line([[x + w * VMIN, y - 4], [x + w * VMIN, y + 32]], 3, '#e8434f'); rr(x, y, w, 28, 14); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    txt('SPEED', x + w / 2, y - 14, 15, '#fff', 'center', 120);
  }
  function pusherHUD(T) {
    speedBar(40, 492, 230);
    const ph = (((S % BEAT) + BEAT) % BEAT) / BEAT, near = Math.min(ph, 1 - ph) * BEAT <= GOOD, cx = 400, cy = 492, fl = g.c - tapAt;
    const hit = fl < .3 ? (tapGood ? '#5CFF7A' : '#ff8a8a') : null;
    circ(cx, cy, 34, near ? '#5CFF7A' : '#ffd23f', 4.5); glint(cx - 10, cy - 12, 12, 6, -.5, .5);
    txt('PUSH!', cx, cy + 1, 19, INK, 'center', 60);
    X.lineWidth = 6; X.strokeStyle = near ? '#5CFF7A' : '#fff'; X.globalAlpha = .9; X.beginPath(); X.arc(cx, cy, 34 + 24 * (1 - ph), 0, TAU); X.stroke(); X.globalAlpha = 1;
    if (hit) { X.globalAlpha = 1 - fl / .3; X.lineWidth = 8; X.strokeStyle = hit; X.beginPath(); X.arc(cx, cy, 36 + fl * 90, 0, TAU); X.stroke(); X.globalAlpha = 1; }
    if (!TOUCH) { X.font = '700 14px Fredoka, Arial, sans-serif'; rr(cx - 34, cy + 38, 68, 20, 6); ink('#fff', 2.5); txt('SPACE', cx, cy + 49, 13, INK, 'center', 60); }
    txt('ON THE BEAT', 640, 482, 16, '#fff', 'center', 150); for (let q = 0; q < 4; q++) circ(592 + q * 32, 508, 9, (Math.floor(S / BEAT) % 4) === q ? '#ffd23f' : '#cfd8e6', 3);
  }
  function clutchHUD(T) {
    const cx = 400, cy = 548, Rr = 108, d = dv;
    X.beginPath(); X.arc(cx, cy, Rr, Math.PI, TAU); X.closePath(); ink('#2b2640', 5);
    const w = wc[relSeq % 3], a0 = Math.PI + (w - WWID / 2) * Math.PI, a1 = Math.PI + (w + WWID / 2) * Math.PI;
    X.beginPath(); X.arc(cx, cy, Rr - 18, Math.PI * 1.02, TAU * .995); X.lineWidth = 16; X.strokeStyle = '#4a4458'; X.lineCap = 'butt'; X.stroke();
    X.beginPath(); X.arc(cx, cy, Rr - 18, a0, a1); X.lineWidth = 16; X.strokeStyle = '#3ddc5f'; X.stroke(); X.lineCap = 'round';
    for (let q = 0; q <= 10; q++) { const a = Math.PI + q / 10 * Math.PI; line([[cx + Math.cos(a) * (Rr - 32), cy + Math.sin(a) * (Rr - 32)], [cx + Math.cos(a) * (Rr - 40), cy + Math.sin(a) * (Rr - 40)]], 1.5, '#cfd8e6'); }
    const na = Math.PI + needleAt(S) * Math.PI; line([[cx, cy], [cx + Math.cos(na) * (Rr - 14), cy + Math.sin(na) * (Rr - 14)]], 4, '#ff4d5e'); circ(cx, cy, 10, '#e8ecf5', 3);
    txt('RPM', cx, cy - 36, 15, '#cfd8e6', 'center', 60);
    // the speed lamp (red / yellow / green)
    const green = dv >= VMIN + .03 && dpos >= POSOK + .01, yel = !green && (dv >= VMIN - .15 || dpos >= POSOK - .12);
    rr(626, 440, 66, 100, 14); ink('#3a3550', 4); circ(659, 464, 13, green ? '#5CFF7A' : '#2d5a3a', 3); circ(659, 492, 13, yel ? '#ffd23f' : '#6a5a2a', 3); circ(659, 520, 13, !green && !yel ? '#ff4d5e' : '#6a2a30', 3);
    txt('SPEED', 659, 430, 14, '#fff', 'center', 80);
    plate(60, 486, 230, 50, pressed ? '#ffd23f' : '#4fd06a', pressed ? '#c99512' : '#24803a', pressed, pressed ? 'LET GO IN THE GREEN!' : 'HOLD THE CLUTCH', 'SPACE', S < clLock);
  }
  function runnerHUD(T) {
    const bx = 250, by = 452, bw = 300;
    rr(bx, by, bw, 26, 13); ink('#e8f6ff', 4); X.save(); rr(bx + 4, by + 4, bw - 8, 18, 9); X.clip(); X.fillStyle = r >= .4 ? '#3ddc5f' : '#ffb347'; X.fillRect(bx, by, bw * r, 26); X.restore(); line([[bx + bw * .4, by - 4], [bx + bw * .4, by + 30]], 3, '#e8434f'); rr(bx, by, bw, 26, 13); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    txt('BREATH', bx + bw / 2, by - 12, 15, '#fff', 'center', 120);
    plate(30, 486, 200, 50, '#6EA8FE', '#2f6fd0', g.c - stepK < .1 && lastSide < 0, 'LEFT', 'A'); plate(570, 486, 200, 50, '#6EA8FE', '#2f6fd0', g.c - stepK < .1 && lastSide > 0, 'RIGHT', 'D');
    const can = dphase >= 1 && !runJump; plate(290, 486, 220, 50, '#ff8f6b', '#c4552e', runJump, 'JUMP!', 'SPACE', !can && !runJump);
    if (can && Math.sin(T * 14) > 0) { X.lineWidth = 4; X.strokeStyle = '#ffe14d'; rr(284, 480, 232, 62, 20); X.stroke(); }
  }

  g.draw = function () {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    if (judge && !g.result) { roadView(T); statusBoard(T); }
    else {
      const c = sideScene(T, won, lost, rk); void c;
      if (!g.result) statusBoard(T);
      if (!g.result) { if (pusher) pusherHUD(T); else if (clutcher) clutchHUD(T); else if (runner) runnerHUD(T); }
      if (judge && !g.result) { /* road view is drawn above */ }
    }
    if (won && rk > .15) {
      for (let i = 0; i < 12; i++) { const d = rk - hash(i + 3) * .8; if (d < 0) continue; heart(40 + hash(i) * 720, 560 - d * (160 + hash(i + 9) * 90), .9 + hash(i + 5) * .5, true); }
      badge('IT STARTED!', 400, 300, 36, '#22a447', '#fff', outBack((rk - .15) / .25), -.04);
    }
    if (lost && rk > .3) badge(rk > .35 + .55 + .7 * dpos ? 'THE PAN CANS!' : why === 2 ? 'IT DIED!' : why === 4 ? 'CAR WRECKED!' : why === 3 ? 'LEFT BEHIND!' : why === 1 ? 'BACKWARDS!' : 'TOO SLOW!', 400, 300, 34, '#e8343d', '#fff', outBack((rk - .3) / .25), .04);
    if (!g.result && T < 2.6) badge(judge ? 'DODGE!' : pusher ? 'PUSH ON THE BEAT!' : clutcher ? 'WAIT FOR THE GREEN!' : 'KEEP RUNNING!', 400, 200, 22, '#2b9ee6', '#fff', outBack(T / .3), -.03);
    for (const q of pops) { const a = T - q.t0; badge(q.s, q.x, q.y - a * 26, q.size, q.bgc, '#fff', a < .2 ? outBack(a / .2) : 1); }
    vignette(.14);
  };
  wire(g, D, 0, sp, 'sq_carro');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#8fd8fb'); gr.addColorStop(1, '#d8f6ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#6c6a7a'; X.beginPath(); X.moveTo(0, 190); X.lineTo(520, 120); X.lineTo(520, 240); X.lineTo(0, 240); X.closePath(); ink('#6c6a7a', 4);
  X.save(); X.translate(260 + Math.sin(t * 2) * 6, 150 - 12); X.rotate(-.13); X.scale(.9, .9); carShape(t, { wheel: t * 4 }); X.restore();
  if (role === 0) {
    X.fillStyle = '#5c5a6e'; X.fillRect(160, 40, 200, 100);
    const lx = Math.round(Math.sin(t * 1.4)) , bx = 260 + lx * 50; el(bx, 100, 22, 10); ink('#3b3347', 3, '#8c8aa0'); rr(bx - 18, 128, 36, 20, 6); ink('#35b6a6', 3);
    rr(40, 190, 90, 34, 12); ink('#ffd23f', 3); txt('◄', 85, 207, 22, INK); rr(390, 190, 90, 34, 12); ink('#ffd23f', 3); txt('►', 435, 207, 22, INK); demoFinger(lx < 0 ? 85 : 435, 215, (t % 2) < .5, (t % 2) * 2);
    badge('DODGE!', 260, 24, 17, '#22a447', '#fff', 1, -.03);
  } else if (role === 1) {
    const ph = (t % .84) / .84; circ(260, 190, 28, ph > .76 || ph < .12 ? '#5CFF7A' : '#ffd23f', 3.5); X.lineWidth = 5; X.strokeStyle = '#fff'; X.beginPath(); X.arc(260, 190, 28 + 28 * (1 - ph), 0, TAU); X.stroke();
    caos(120, 150, 2.4, { col: COLS[1] }); demoFinger(260, 200, ph > .8 || ph < .1, ph > .8 ? (ph - .8) * 5 : ph * 5);
    badge('PUSH ON THE BEAT!', 260, 24, 16, '#2b9ee6', '#fff', 1, -.03);
  } else if (role === 2) {
    const cx = 260, cy = 210, na = Math.PI + (.5 + .5 * Math.sin(t * 3)) * Math.PI;
    X.beginPath(); X.arc(cx, cy, 90, Math.PI, TAU); X.closePath(); ink('#2b2640', 4); X.beginPath(); X.arc(cx, cy, 72, Math.PI + .9, Math.PI + 1.9); X.lineWidth = 14; X.strokeStyle = '#3ddc5f'; X.stroke();
    line([[cx, cy], [cx + Math.cos(na) * 76, cy + Math.sin(na) * 76]], 4, '#ff4d5e'); circ(cx, cy, 8, '#e8ecf5', 3);
    demoFinger(60, 190, (t % 2) < 1, (t % 1)); badge('LET GO IN THE GREEN!', 260, 24, 15, '#2b9ee6', '#fff', 1, -.03);
  } else {
    const k = (t % .6) / .6; caos(120 + Math.sin(t * 2) * 10, 150, 2.4, { col: COLS[3], run: t });
    rr(40, 190, 90, 34, 12); ink(k < .3 ? '#ffd23f' : '#6EA8FE', 3); rr(390, 190, 90, 34, 12); ink(k >= .3 ? '#ffd23f' : '#6EA8FE', 3); demoFinger(k < .3 ? 85 : 435, 212, true, 0);
    badge('RUN, THEN JUMP IN!', 260, 24, 16, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_carro', sqCarro, 'CARRO DE EMPUJE'); REGMAP.sq_carro.duo = true; REGMAP.sq_carro.squad = true;
DUO.INFO.sq_carro = n => [
  ['STEERING WHEEL', 'DODGE THE HOLES AND THE VENDOR', 'A D / TAP LEFT OR RIGHT'],
  ['PUSHER', 'SHOVE THE CAR ON THE BEAT', 'SPACE / TAP ON THE BEAT'],
  ['CLUTCH', 'LET GO IN THE GREEN', 'HOLD, LET GO / SPACE'],
  ['RUNNER', 'RUN AND JUMP IN', 'A D, THEN SPACE / TAP'],
].slice(0, n);
DUO.DEMOS.sq_carro = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
