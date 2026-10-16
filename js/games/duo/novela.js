'use strict';
/* ═════════ DUO · SINTONIZA LA NOVELA (du_novela): grandma's living room, the radio dial, the soap opera is starting NOW ═════════
   TUNER (role 0, JUDGE): sees the SIGNAL bar (LED stack) of the radio and the 3-second progress bar, plus the read-only fine lever of the friend.
   DRAG LEFT / RIGHT anywhere (or ◄ ► / A D) = COARSE dial: 16 stations (n 0..15).
   FINE TUNER (role 1): the speaker and the panel show only static (it clears only when the station is really clean). DRAG UP / DOWN anywhere
   (or ▲ ▼ / W S) = FINE lever v (0..1) that slides the frequency inside the current station: f = (n + v) / 16.
   The station f* hops a little every ~3 s (n by 1-2 and the fine side flips), so they have to re-tune together. Clean = |f - f*| < TOL (generous:
   the fine lever has ~45 % of its travel as a good zone, and the fine tuner can see the static clear). The judge keeps a 3 s meter: it fills while clean
   and drains slowly when not. WIN: meter full. LOSE: time out. Gags: the galan's voice comes out of the radio (win) / granny smacks the radio (lose).
   The target is drawn so that neither player can win alone (the fine side is always >= .3 away from the lever's rest position, and n != n0).
   Netcode (all absolute, latest, repeated every .4 s so a dropped message never matters): the TUNER owns n and publishes 'c' [n]; the FINE TUNER owns v and
   publishes 'v' [v*1000]; the TUNER judges (it holds both) and publishes 'q' [signal*1000, meter*1000, clean 0/1] so the fine tuner's static follows it. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only

/* ───────────── tuning ───────────── */
const NS = 16, NMAX = NS - 1, QW = .55, TOL = .014, NEED = 3, DEC = .4;   // stations, signal falloff width, clean radius (in f), seconds of clean signal, meter drain /s
const SHIFT = [3.3, 6.3, 9.3, 12.1];                                       // when the station hops (s, before /TS)
const DX0 = 180, DX1 = 620, DIALY = 171;                                   // dial strip on the radio
const LVX = 705, VY0 = 250, VY1 = 420;                                     // fine lever track
const PNL = { x: 430, y: 210, w: 200, h: 205 };                            // the panel (LEDs / snow)
const SPK = { x: 270, y: 306, r: 92 };                                     // speaker grille

/* ───────────── drawing kit (X is ctx while playing, an offscreen context while the backdrop is baked) ───────────── */
let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function circ2(x, y, r, fill, o = 3) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(170, X.measureText(t(label)).width + 24);
  X.beginPath(); X.moveTo(x - 8, y + 11); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 11); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(360, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 360); X.restore();
}
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function arm(u, sx, an, k, col) {            // blocky arm at a caos's shoulder (translate to feet first)
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
}

/* ───────────── backdrop (baked once): granny's living room ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  // wallpaper: warm cream with stripes and little flowers
  const wl = X.createLinearGradient(0, 0, 0, 450); wl.addColorStop(0, '#f1cf93'); wl.addColorStop(1, '#ffe7b6'); X.fillStyle = wl; X.fillRect(0, 0, W, 450);
  X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 0; x < W; x += 40) X.fillRect(x, 0, 18, 450);
  for (let i = 0; i < 46; i++) { const fx = 10 + (i % 12) * 68 + (Math.floor(i / 12) % 2) * 34, fy = 22 + Math.floor(i / 12) * 100; X.fillStyle = 'rgba(255,120,150,.45)'; X.beginPath(); X.arc(fx, fy, 6, 0, TAU); X.fill(); X.fillStyle = 'rgba(255,240,170,.8)'; X.beginPath(); X.arc(fx, fy, 2.5, 0, TAU); X.fill(); }
  // wainscot + floor
  X.fillStyle = '#9a5b39'; X.fillRect(0, 410, W, 40); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(0, 410, W, 5); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 450); X.lineTo(W, 450); X.stroke();
  const fl = X.createLinearGradient(0, 450, 0, H); fl.addColorStop(0, '#b97a46'); fl.addColorStop(1, '#8a5530'); X.fillStyle = fl; X.fillRect(0, 452, W, H - 452);
  X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = 3; for (let i = 0; i < 8; i++) { const y = 470 + i * 20; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  // rug
  el(400, 560, 330, 46); ink('#d9534f', 4); el(400, 560, 290, 32); X.fillStyle = '#f2c14e'; X.fill(); el(400, 560, 230, 20); X.fillStyle = '#d9534f'; X.fill();
  // window with curtains (right) and a night-ish sky: the novela is on at dusk
  rr(672, 40, 112, 150, 10); ink('#ffbf7a', 4); rr(680, 48, 96, 134, 6); ink('#ff9a6a', 3); X.fillStyle = 'rgba(255,255,255,.35)'; X.beginPath(); X.moveTo(690, 56); X.lineTo(724, 56); X.lineTo(692, 150); X.closePath(); X.fill();
  line([[728, 48], [728, 182]], 4, '#a5622c'); line([[680, 114], [776, 114]], 4, '#a5622c');
  cel('#e8434f', '#b8283a', () => { X.beginPath(); X.moveTo(664, 34); X.quadraticCurveTo(690, 100, 672, 196); X.lineTo(704, 196); X.quadraticCurveTo(704, 100, 706, 34); X.closePath(); }, 5, 0, 3.5);
  cel('#e8434f', '#b8283a', () => { X.beginPath(); X.moveTo(790, 34); X.quadraticCurveTo(764, 100, 782, 196); X.lineTo(752, 196); X.quadraticCurveTo(752, 100, 748, 34); X.closePath(); }, 5, 0, 3.5);
  line([[656, 30], [800, 30]], 6, '#a5622c');
  // framed photo of the galan (signed!)
  rr(26, 34, 82, 104, 8); ink('#a5622c', 4); rr(36, 44, 62, 84, 5); ink('#fff3d0', 3);
  el(67, 88, 20, 26); ink('#f1b98c', 3); X.beginPath(); X.moveTo(46, 80); X.quadraticCurveTo(48, 54, 68, 58); X.quadraticCurveTo(88, 54, 88, 80); X.quadraticCurveTo(80, 66, 68, 68); X.quadraticCurveTo(54, 66, 46, 80); X.closePath(); ink('#2a1d1a', 2.5);
  el(60, 96, 8, 3.5, .15); ink('#2a1d1a', 1.5); el(75, 96, 8, 3.5, -.15); ink('#2a1d1a', 1.5); heart(98, 124, .7);
  // wall clock
  circ2(560, 74, 30, '#fff', 4); X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(560, 74); X.lineTo(560, 54); X.moveTo(560, 74); X.lineTo(574, 80); X.stroke();
  // table with a doily
  rr(70, 418, 600, 30, 10); ink('#a5622c', 4); X.fillStyle = 'rgba(255,255,255,.2)'; rr(80, 422, 580, 7, 3); X.fill();
  rr(96, 446, 26, 84, 6); ink('#8a5530', 4); rr(618, 446, 26, 84, 6); ink('#8a5530', 4);
  el(290, 425, 190, 12); ink('#fff7e6', 3);
  X = old; return cv;
}

/* ───────────── props ───────────── */
function snow(cx, cy, w, h, dens, T, round) {                 // static: random grey dots, thinner when dens is low
  X.save(); X.beginPath(); if (round) X.arc(cx, cy, w, 0, TAU); else X.rect(cx, cy, w, h); X.clip();
  X.fillStyle = dens < .5 ? '#2c3a3a' : '#2b2b33'; X.fillRect(cx - (round ? w : 0), cy - (round ? w : 0), round ? w * 2 : w, round ? w * 2 : h);
  const f = Math.floor(T * 22), n = Math.round(40 + dens * 210), ox = round ? cx - w : cx, oy = round ? cy - w : cy, ww = round ? w * 2 : w, hh = round ? w * 2 : h;
  for (let i = 0; i < n; i++) { const a = hsh(i * 3.1 + f * 17.7), b = hsh(i * 5.3 + f * 9.1 + 4), c = hsh(i * 1.7 + f * 3.3 + 9); X.fillStyle = c < .5 ? 'rgba(255,255,255,.75)' : c < .8 ? 'rgba(170,175,190,.7)' : 'rgba(20,16,28,.6)'; const s = 3 + c * 5; X.fillRect(ox + a * ww, oy + b * hh, s * 1.8, s); }
  X.restore();
}
function galan(x, y, s, T, mouth) {                            // the novela's leading man, cameo bust
  X.save(); X.translate(x, y); X.scale(s, s);
  cel('#3a2a52', '#2a1d3e', () => { X.beginPath(); X.moveTo(-70, 90); X.quadraticCurveTo(-60, 40, 0, 38); X.quadraticCurveTo(60, 40, 70, 90); X.closePath(); }, 5, 2, 4);
  X.beginPath(); X.moveTo(-14, 42); X.lineTo(0, 74); X.lineTo(14, 42); X.closePath(); ink('#fff', 3);
  cel('#f1b98c', '#d89a6c', () => el(0, 0, 42, 54), 6, 2, 5);
  X.beginPath(); X.moveTo(-44, -6); X.quadraticCurveTo(-48, -62, 0, -62); X.quadraticCurveTo(48, -62, 44, -6); X.quadraticCurveTo(34, -34, 0, -34); X.quadraticCurveTo(-34, -34, -44, -6); X.closePath(); ink('#2a1d1a', 4);
  X.fillStyle = 'rgba(255,255,255,.35)'; el(-18, -50, 14, 4, -.4); X.fill();
  for (const sx of [-1, 1]) { el(sx * 16, -2, 9, 11); ink('#fff', 2.5); const hp = 1 + Math.sin(T * 6) * .1; X.save(); X.translate(sx * 16, -2); X.scale(hp, hp); heart(0, 2, .5); X.restore(); }
  X.beginPath(); X.moveTo(-26, 22); X.quadraticCurveTo(-12, 12, 0, 20); X.quadraticCurveTo(12, 12, 26, 22); X.quadraticCurveTo(12, 28, 0, 26); X.quadraticCurveTo(-12, 28, -26, 22); X.closePath(); ink('#2a1d1a', 2.5);
  el(0, 38, 14, 4 + mouth * 7); ink('#7a1d2e', 2.5); X.fillStyle = '#fff'; X.fillRect(-9, 35, 18, 3);
  X.restore();
}
function abuela(T, st, rk, nodk) {                             // granny in her armchair; st: 0 idle, 1 won, 2 lost
  X.save();
  cel('#b5485d', '#8f3347', () => rr(6, 322, 108, 150, 22), 8, 0, 4);
  cel('#b5485d', '#8f3347', () => rr(0, 396, 34, 78, 14), 5, 0, 4);
  const lean = st === 0 ? 6 + Math.sin(T * 1.7) * 2 + nodk * 4 : st === 1 ? 2 : 0;
  cel('#8fb6e8', '#6a90c8', () => el(60 + lean * .4, 420, 36, 46), 7, 0, 4);
  line([[40, 400], [78, 438]], 4, 'rgba(255,255,255,.55)'); line([[48, 440], [86, 404]], 4, 'rgba(255,255,255,.55)');
  // head
  const hx = 60 + lean, hy = 352 + (st === 1 ? Math.sin(T * 5) * 2 : 0);
  circ2(hx, hy - 36, 12, '#e8e6ee', 3.5);
  cel('#f3c9a0', '#d9a278', () => el(hx, hy, 27, 29), 6, 2, 4.5);
  X.beginPath(); X.moveTo(hx - 29, hy - 4); X.quadraticCurveTo(hx - 30, hy - 36, hx, hy - 34); X.quadraticCurveTo(hx + 30, hy - 36, hx + 29, hy - 4); X.quadraticCurveTo(hx + 18, hy - 20, hx, hy - 20); X.quadraticCurveTo(hx - 18, hy - 20, hx - 29, hy - 4); X.closePath(); ink('#e8e6ee', 3.5);
  for (const sx of [-1, 1]) {
    circ2(hx + sx * 11, hy - 1, 9, '#fff', 2.5);
    const lk = st === 2 ? 3 : 4; circ2(hx + sx * 11 + lk, hy - 1 + (st === 1 ? -1 : 0), 3.6, INK, 0); X.fillStyle = '#fff'; X.beginPath(); X.arc(hx + sx * 11 + lk - 1, hy - 3, 1.3, 0, TAU); X.fill();
    if (st === 2) line([[hx + sx * 22, hy - 16 + 0], [hx + sx * 4, hy - 9]], 3, INK);            // angry brows
  }
  line([[hx - 2, hy - 1], [hx + 2, hy - 1]], 2.5, INK);
  X.fillStyle = st === 1 ? 'rgba(255,110,165,.8)' : 'rgba(255,120,140,.5)'; el(hx - 19, hy + 11, 6, 4); X.fill(); el(hx + 19, hy + 11, 6, 4); X.fill();
  if (st === 1) { X.beginPath(); X.arc(hx, hy + 11, 9, .1, Math.PI - .1); ink('#7a1d2e', 2.5); }
  else if (st === 2) { X.beginPath(); X.arc(hx, hy + 20, 8, Math.PI + .3, TAU - .3); X.lineWidth = 3.5; X.strokeStyle = INK; X.stroke(); }
  else { el(hx, hy + 14, 6, 3 + Math.abs(Math.sin(T * 1.3)) * 1.5); ink('#9a3b4a', 2); }
  // knitting + yarn
  if (st !== 2 || rk < .15) { line([[30, 438], [84, 412]], 3.5, '#d9dfe8'); line([[40, 418], [92, 436]], 3.5, '#d9dfe8'); }
  circ2(98, 466, 13, '#ff7ab0', 3.5); X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 2.5; X.beginPath(); X.arc(98, 466, 8, .3, 2.6); X.stroke();
  X.restore();
}
function chancla(x, y, rot) {
  X.save(); X.translate(x, y); X.rotate(rot); rr(-9, -22, 20, 44, 9); ink('#ffd23f', 3.5); X.beginPath(); X.moveTo(-5, -4); X.quadraticCurveTo(0, -14, 6, -4); X.lineWidth = 4; X.strokeStyle = '#e8434f'; X.stroke(); X.restore();
}

/* ═════════ the game ═════════ */
function duNovela(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), judge = D.role === 0, TS = Math.sqrt(sp), need = NEED / TS;
  /* the level, from the seed (same draws on both screens): the starting station and the schedule of target hops */
  const n0 = 6 + Math.floor(R() * 4), tg = [];
  const vtPick = () => R() < .5 ? .06 + R() * .14 : .8 + R() * .14;           // the target's fine side: always >= .3 from the lever's rest (.5), so v alone can never clear it
  let nt = n0 + (R() < .5 ? -1 : 1) * (3 + Math.floor(R() * 2));
  tg.push({ at: 0, n: nt, vt: vtPick() });
  for (let k = 0; k < SHIFT.length; k++) {
    const at = (SHIFT[k] + (R() - .5) * .5) / TS, r1 = R(), r2 = R(); let s = r1 < .5 ? -1 : 1; const stp = r2 < .5 ? 1 : 2;
    let nn = nt + s * stp; if (nn < 1 || nn > 14 || nn === n0) { s = -s; nn = nt + s * stp; if (nn < 1 || nn > 14 || nn === n0) nn = nt; }
    nt = nn; tg.push({ at, n: nt, vt: vtPick() });
  }
  const targetAt = T => { let c = tg[0]; for (const q of tg) if (q.at <= T) c = q; return c; };
  const fOf = (n, v) => (n + v) / NS;
  const kFine = new Set(); const pops = [];
  /* judge owns n (coarse) and the meter; fine tuner owns v. Each keeps a view of the other */
  let n = n0, vV = .5, held = false, meter = 0, q = 0, clean = false, qSent = -9, qLast = -1, cleanSent = false, cSent = -9, shiftIdx = 0;                 // tuner
  let v = .5, nV = n0, lockV = false, qV = 0, vSent = -9, vLast = -1, staticK = 1, recvQ = -1;                                       // fine tuner
  let resAt = -1, pokeAt = -9, hopAt = -9;
  const sendC = () => { cSent = g.c; D.send('c', [n], true); };
  const sendV = () => { vSent = g.c; vLast = Math.round(v * 1000); D.send('v', [vLast], true); };
  const sendQ = () => { qSent = g.c; cleanSent = clean; qLast = Math.round(q * 1000); D.send('q', [qLast, Math.round(meter / need * 1000), clean ? 1 : 0], true); };
  const setN = k => { k = clamp(Math.round(k), 0, NMAX); if (k !== n) { n = k; sfx.tick(); sendC(); } };
  const setV = k => { v = clamp(k, 0, 1); };
  const nFromX = x => clamp((x - DX0) / (DX1 - DX0), 0, 1) * NMAX, vFromY = y => 1 - clamp((y - VY0) / (VY1 - VY0), 0, 1);
  function apply(p) { if (judge) setN(nFromX(p.x)); else setV(vFromY(p.y)); }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: judge ? 'TUNE IT!' : 'FINE TUNE!', roleLabel: judge ? 'TUNER' : 'FINE TUNER',
    hint: judge ? 'DRAG LEFT / RIGHT (OR ◄ ►) TO TURN THE DIAL AND WATCH THE SIGNAL BAR. YOUR FRIEND ONLY HEARS STATIC AND FINE-TUNES WITH THE LEVER - TELL THEM WHICH WAY! KEEP THE SIGNAL CLEAN FOR 3 SECONDS'
      : 'YOU ONLY HEAR STATIC. DRAG UP / DOWN (OR ▲ ▼) TO FINE-TUNE THE LEVER UNTIL IT CLEARS - YOUR FRIEND WATCHES THE SIGNAL BAR AND TELLS YOU WHICH WAY!',
    thint: judge ? 'DRAG SIDEWAYS TO TURN THE DIAL, WATCH THE SIGNAL, GUIDE YOUR FRIEND' : 'DRAG UP / DOWN TO FINE-TUNE UNTIL THE STATIC CLEARS',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) resAt = T;
      if (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      if (judge) {
        const tgt = targetAt(T); if (tgt !== tg[shiftIdx]) { shiftIdx = tg.indexOf(tgt); hopAt = T; if (!g.result) sfx.buzz(); }
        const d = Math.abs(fOf(n, vV) - fOf(tgt.n, tgt.vt));
        q = clamp(1 - d / QW, 0, 1); clean = d < TOL;
        if (!g.result) {
          meter = clean ? meter + dt : Math.max(0, meter - DEC * dt);
          if (meter >= need) g.finish('win');
          else if (T >= g.limit) g.finish('lose');
        }
        if (T - qSent >= .05 && (Math.abs(Math.round(q * 1000) - qLast) >= 8 || clean !== cleanSent) || T - qSent >= .4) sendQ();
        if (T - cSent >= .4) sendC();
      } else {
        if (kFine.size) { const dir = (kFine.has('ArrowUp') || kFine.has('KeyW') ? 1 : 0) - (kFine.has('ArrowDown') || kFine.has('KeyS') ? 1 : 0); setV(v + dir * .6 * dt); }
        staticK += ((lockV ? .1 : 1) - staticK) * Math.min(1, dt * 10);
        if (Math.abs(Math.round(v * 1000) - vLast) >= 5 && T - vSent >= .05 || T - vSent >= .4) sendV();
      }
    },
    msg(type, d) {
      if (judge) { if (type === 'v' && Array.isArray(d)) vV = clamp((d[0] | 0) / 1000, 0, 1); }
      else if (type === 'c' && Array.isArray(d)) nV = clamp(d[0] | 0, 0, NMAX);
      else if (type === 'q' && Array.isArray(d)) { qV = clamp((d[0] | 0) / 1000, 0, 1); lockV = (d[2] | 0) === 1; recvQ = g.c; }
    },
    down(p) { if (g.result) return; held = true; apply(p); },
    move(p) { if (g.result || !held) return; apply(p); },
    up() { held = false; },
    key(e) {
      const c = e.code; if (g.result || c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (judge) { if (c === 'ArrowLeft' || c === 'KeyA') setN(n - 1); else if (c === 'ArrowRight' || c === 'KeyD') setN(n + 1); }
      else if (c === 'ArrowUp' || c === 'KeyW' || c === 'ArrowDown' || c === 'KeyS') kFine.add(c);
    },
    keyup(e) { kFine.delete(e.code); },
  };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const nView = () => judge ? n : nV, vView = () => judge ? vV : v;

  /* ═════ draw ═════ */
  g.draw = function () {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    if (!BG) BG = buildBg(); ctx.drawImage(BG, 0, 0);
    // drifting dust motes / the clock hand are cosmetic; the window's sunset glows
    X.fillStyle = 'rgba(255,200,120,.12)'; X.beginPath(); X.moveTo(690, 190); X.lineTo(560, 450); X.lineTo(420, 450); X.lineTo(670, 190); X.closePath(); X.fill();
    const sig = judge ? q : lockV ? 1 : 0, st = won ? 1 : lost ? 2 : 0;
    // radio jolt when granny smacks it
    const smack = lost && rk > .45 ? Math.max(0, 1 - (rk - .45) * 2.2) : 0, jx = Math.sin(T * 60) * 6 * smack, jy = -Math.abs(Math.sin(T * 40)) * 8 * smack;
    // granny
    const ak = lost ? ease(rk / .4) : 0; abuela(T, st, rk, sig);
    if (lost && rk > 0) {                                     // the arm and the chancla
      const an = lerp(-2.25, -.9, ease((rk - .1) / .3)), sx = 88, sy = 396, L = 58, hx = sx + Math.cos(an) * L, hy = sy + Math.sin(an) * L;
      if (ak > 0) { line([[sx, sy], [hx, hy]], 12, '#8fb6e8'); circ2(hx, hy, 9, '#f3c9a0', 3); chancla(hx + 6, hy - 8, an + 1.6); }
    }
    X.save(); X.translate(jx, jy);
    // ── the radio ──
    cel('#c98a4a', '#a5622c', () => rr(110, 130, 530, 292, 40), 14, -6, 5);
    X.fillStyle = 'rgba(255,255,255,.22)'; el(210, 146, 70, 6, -.05); X.fill();
    rr(140, 120, 60, 14, 6); ink('#8a5530', 3); rr(550, 120, 60, 14, 6); ink('#8a5530', 3);
    // dial window
    rr(165, 146, 470, 52, 14); ink('#f6edd2', 4); X.fillStyle = 'rgba(20,16,28,.16)'; rr(170, 150, 460, 12, 6); X.fill();
    for (let i = 0; i <= NMAX; i++) { const x = DX0 + i / NMAX * (DX1 - DX0), big = i % 5 === 0; line([[x, 178], [x, big ? 158 : 166]], big ? 3 : 2, 'rgba(20,16,28,.7)'); }
    const nx = DX0 + nView() / NMAX * (DX1 - DX0) + (judge ? 0 : 0);
    X.beginPath(); X.moveTo(nx - 7, 142); X.lineTo(nx, 152); X.lineTo(nx + 7, 142); X.closePath(); ink('#e8434f', 2.5); line([[nx, 150], [nx, 196]], 3, '#e8434f');
    // speaker grille
    circ2(SPK.x, SPK.y, SPK.r + 10, '#8a5530', 4.5);
    const dens = judge ? (won ? 0 : lost ? 1 : 1 - q * .85) : staticK;
    X.save(); X.beginPath(); X.arc(SPK.x, SPK.y, SPK.r, 0, TAU); X.clip(); X.fillStyle = '#5a3b28'; X.fillRect(SPK.x - SPK.r, SPK.y - SPK.r, SPK.r * 2, SPK.r * 2); X.restore();
    if (judge) {                                                 // the tuner sees the cone shudder and sound waves grow with the signal
      X.save(); X.beginPath(); X.arc(SPK.x, SPK.y, SPK.r, 0, TAU); X.clip();
      X.strokeStyle = 'rgba(255,225,160,.45)'; X.lineWidth = 3; for (let i = -8; i <= 8; i++) { X.beginPath(); X.moveTo(SPK.x - SPK.r, SPK.y + i * 12); X.lineTo(SPK.x + SPK.r, SPK.y + i * 12); X.stroke(); }
      X.restore();
      for (let k = 0; k < 3; k++) { const ph = (T * .9 + k / 3) % 1; X.globalAlpha = (1 - ph) * q * .9; X.strokeStyle = '#fff3a0'; X.lineWidth = 5; X.beginPath(); X.arc(SPK.x, SPK.y, 30 + ph * 60, 0, TAU); X.stroke(); } X.globalAlpha = 1;
    } else snow(SPK.x, SPK.y, SPK.r, 0, staticK, T, true);
    X.beginPath(); X.arc(SPK.x, SPK.y, SPK.r, 0, TAU); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    X.fillStyle = 'rgba(255,255,255,.22)'; el(SPK.x - 40, SPK.y - 56, 34, 12, -.7); X.fill();
    circ2(SPK.x, SPK.y, 12, '#8e98ad', 3);
    // panel
    rr(PNL.x, PNL.y, PNL.w, PNL.h, 14); ink(judge ? '#2a2535' : '#1b1822', 4);
    if (judge) {
      txt('SIGNAL', PNL.x + 90, PNL.y + 17, 15, '#fff', 'center', 110);
      const lit = Math.round(q * 10);
      for (let i = 0; i < 10; i++) { const y = PNL.y + PNL.h - 18 - (i + 1) * 15.5, on = i < lit, col = i >= 8 ? '#5CFF7A' : i >= 5 ? '#ffd23f' : '#ff7a5c'; rr(PNL.x + 18, y, 100, 12, 5); ink(on ? col : '#4a4558', 2.5); if (on) { X.fillStyle = 'rgba(255,255,255,.4)'; rr(PNL.x + 22, y + 2, 92, 3, 1.5); X.fill(); } }
      if (clean && !g.result) { X.globalAlpha = .5 + .4 * Math.sin(T * 14); X.strokeStyle = '#fff'; X.lineWidth = 4; rr(PNL.x + 12, PNL.y + 28, 112, 170, 10); X.stroke(); X.globalAlpha = 1; }
      // the fine lever of the friend (read-only mirror)
      rr(PNL.x + 148, PNL.y + 32, 22, 150, 11); ink('#4a4558', 3); const ky = PNL.y + 32 + (1 - vV) * 150; circ2(PNL.x + 159, ky, 11, pCol(), 3);
      txt('FRIEND', PNL.x + 159, PNL.y + PNL.h - 10, 11, '#fff', 'center', 60);
    } else {
      snow(PNL.x + 6, PNL.y + 6, PNL.w - 12, PNL.h - 12, staticK, T, false);
      if (staticK < .6) { X.strokeStyle = 'rgba(92,255,122,.9)'; X.lineWidth = 4; X.beginPath(); for (let i = 0; i <= 40; i++) { const x = PNL.x + 16 + i / 40 * (PNL.w - 32), y = PNL.y + PNL.h / 2 + Math.sin(i * .6 + T * 8) * 28 * (1 - staticK); i ? X.lineTo(x, y) : X.moveTo(x, y); } X.stroke(); }
    }
    // knobs and a little lamp
    circ2(185, 400, 11, '#f2c14e', 3); circ2(215, 400, 11, '#f2c14e', 3);
    X.restore();
    // progress bar (judge): under the dial strip, a lit "ON AIR" strip
    if (judge) { const pk = clamp(meter / need, 0, 1); rr(120, 432, 420, 14, 7); ink('#4a4558', 3); if (pk > 0) { X.save(); rr(120, 432, 420, 14, 7); X.clip(); X.fillStyle = pk >= 1 ? '#5CFF7A' : '#ffd23f'; X.fillRect(120, 432, 420 * pk, 14); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(120, 434, 420 * pk, 4); X.restore(); } for (let i = 1; i < 3; i++) line([[120 + 420 * i / 3, 430], [120 + 420 * i / 3, 448]], 2, 'rgba(255,255,255,.6)'); }
    // labels
    if (!g.result) {
      txt(judge ? 'DRAG LEFT / RIGHT' : 'DRAG UP / DOWN', judge ? 400 : LVX, judge ? 118 : 232, 15, 'rgba(255,255,255,.95)', 'center', judge ? 280 : 120);
    }
    // ── fine lever on its stand ──
    line([[LVX, VY0 - 14], [LVX, 500]], 10, '#a5622c');
    rr(LVX - 18, VY0 - 6, 36, VY1 - VY0 + 12, 16); ink('#3a3550', 4); rr(LVX - 5, VY0 + 6, 10, VY1 - VY0 - 12, 5); X.fillStyle = '#14101c'; X.fill();
    const ly = VY0 + (1 - vView()) * (VY1 - VY0), lk = !judge && held;
    circ2(LVX, ly + 6, 22, '#8a1f2b', 4); circ2(LVX, ly, 22, lk ? '#ff6b6b' : judge ? '#c9ced6' : '#ff3d4d', 4); X.fillStyle = 'rgba(255,255,255,.5)'; el(LVX - 8, ly - 8, 8, 4, -.6); X.fill();
    if (!judge && !g.result && T < 3.2) DUO.demoFinger(LVX + 30, ly + 24 + Math.sin(T * 5) * 4 + Math.sin(T * 2) * 30, true, (T * 2) % 1);
    if (judge && !g.result && T < 3.2) DUO.demoFinger(lerp(300, 460, (Math.sin(T * 2.2) + 1) / 2), 232, true, (T * 2) % 1);
    // ── the players ──
    const jc = judge ? myCol() : pCol(), fc = judge ? pCol() : myCol();
    const hop = (k) => won && rk >= 0 ? Math.abs(Math.sin(T * 10 + k)) * 14 : 0;
    X.save(); X.translate(300, 566 - hop(0)); arm(3.2, -1, won ? -.5 + Math.sin(T * 14) * .3 : -2.3, 1, jc); arm(3.2, 1, won ? .5 - Math.sin(T * 14) * .3 : -2.0 + Math.sin(T * 3) * .15, 1, jc); caos(0, 0, 3.2, { col: jc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    X.save(); X.translate(640, 566 - hop(1.3)); arm(3.2, -1, won ? -.5 + Math.sin(T * 14) * .3 : -1.6, 1, fc); arm(3.2, 1, won ? .5 - Math.sin(T * 14) * .3 : -2.4, 1, fc); caos(0, 0, 3.2, { col: fc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (!g.result && T < 3.4) { pill(300, 566 - 3.2 * 12.6 - 34, judge ? 'YOU' : 'YOUR FRIEND', jc); pill(640, 566 - 3.2 * 12.6 - 34, judge ? 'YOUR FRIEND' : 'YOU', fc); }
    // ── station hop: a little crackle flash ──
    if (judge && !g.result && T - hopAt < .5 && hopAt > 0) { X.globalAlpha = (1 - (T - hopAt) / .5) * .5; snow(SPK.x, SPK.y, SPK.r, 0, 1, T, true); X.globalAlpha = 1; }
    // ── win: the galan's voice comes out of the radio ──
    if (won && rk >= 0) {
      const k = ease(rk / .5);
      X.save(); X.beginPath(); X.arc(SPK.x + jx, SPK.y, SPK.r, 0, TAU); X.clip(); X.fillStyle = '#ffd6e6'; X.fillRect(SPK.x - SPK.r, SPK.y - SPK.r, SPK.r * 2, SPK.r * 2);
      galan(SPK.x, SPK.y + 6 + (1 - k) * 90, 1.0, T, .3 + Math.abs(Math.sin(T * 9)) * .7); X.restore();
      X.beginPath(); X.arc(SPK.x, SPK.y, SPK.r, 0, TAU); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
      for (let i = 0; i < 6; i++) { const ph = (rk * .9 + i / 6) % 1, hx = 130 + ph * 40 + Math.sin(ph * 9 + i) * 8, hy = 330 - ph * 200; X.globalAlpha = 1 - ph; heart(hx, hy, .5 + ph * .5); X.globalAlpha = 1; }
      if (rk > .35) { const bp = outBack((rk - .35) / .25); X.save(); X.translate(380, 100); X.scale(bp, bp); X.translate(-380, -100); rr(190, 72, 380, 56, 28); ink('#fff', 4); X.beginPath(); X.moveTo(240, 124); X.lineTo(SPK.x - 20, SPK.y - SPK.r - 14); X.lineTo(290, 124); X.closePath(); ink('#fff', 3); rr(196, 78, 368, 44, 22); X.fillStyle = '#fff'; X.fill(); txt('MARISOL, MY LOVE...', 380, 101, 26, '#c2185b', 'center', 340); X.restore(); }
      if (rk > .8) badge('TUNED IN!', 530, 270, 38, '#ffb23d', '#fff', outBack((rk - .8) / .25), .06);
    }
    // ── lose: static forever, granny smacked the radio ──
    if (lost && rk >= 0) {
      if (rk > .45) { badge('BANG!', 300, 150, 52, '#e8434f', '#fff', outBack((rk - .45) / .2) * (smack > 0 ? 1 : .9), -.07); if (smack > .6) for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + .3, r = 20 + (1 - smack) * 70; star(120 + Math.cos(a) * r, 290 + Math.sin(a) * r, 11, 5, 5, a, '#FFE14D', 3); } }
      if (rk > 1) badge('GRANNY FIXED IT...', 400, 275, 28, '#7e5bd6', '#fff', outBack((rk - 1) / .25), .04);
      if (rk > 1.5) badge('TOO MUCH STATIC!', 400, 345, 24, '#2b9ee6', '#fff', outBack((rk - 1.5) / .25), -.03);
    }
    if (!g.result && T < 3.2) badge(judge ? 'FIND THE STATION!' : 'MAKE THE STATIC CLEAR!', 400, 70, 22, judge ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.02);
    vignette(.18);
  };

  // what a bot may see: the same things as the screen
  g.dbg = {
    dialPt: k => ({ x: DX0 + k / NMAX * (DX1 - DX0), y: DIALY }),
    knobPt: k => ({ x: LVX, y: VY0 + (1 - k) * (VY1 - VY0) }),
    view: () => judge ? { n, v: vV, q, meter, need, clean, nMax: NMAX, ns: NS, qw: QW, tol: TOL } : { v, n: nV, locked: lockV, snowK: staticK, nMax: NMAX },
    truth: () => ({ n, v, vV, nV, meter, q, tg, tgt: targetAt(g.c) }),
  };
  wire(g, D, 0, sp, 'du_novela');
  return g;
}
reg('du_novela', duNovela, 'SINTONIZA LA NOVELA'); REGMAP.du_novela.duo = true;

/* ───────────── intro card (520×240), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#f1cf93'; X.fillRect(0, 0, 520, 240); X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 0; x < 520; x += 40) X.fillRect(x, 0, 18, 240);
  X.fillStyle = '#b97a46'; X.fillRect(0, 200, 520, 40);
  cel('#c98a4a', '#a5622c', () => rr(60, 40, 400, 170, 26), 10, -4, 4);
  circ2(170, 140, 56, '#5a3b28', 3.5);
  if (role === 0) {
    rr(90, 52, 340, 30, 10); ink('#f6edd2', 3);
    const nx = 105 + 310 * (u < 2 ? ease(u / 1.8) : 1 - ease((u - 2) / 1.8)); line([[nx, 56], [nx, 78]], 3, '#e8434f');
    const lit = Math.round((u < 2 ? ease(u / 1.8) : 1 - ease((u - 2) / 1.8)) * 8);
    rr(260, 96, 160, 100, 10); ink('#2a2535', 3);
    for (let i = 0; i < 8; i++) { rr(272, 182 - i * 11, 70, 8, 4); ink(i < lit ? (i >= 6 ? '#5CFF7A' : i >= 4 ? '#ffd23f' : '#ff7a5c') : '#4a4558', 2); }
    DUO.demoFinger(nx, 100, true, u % 1);
    badge('FIND THE STATION!', 260, 20, 15, '#c98a12', '#fff', 1, -.02);
  } else {
    snow(170, 140, 54, 0, u > 2.4 ? .1 : 1, tt, true);
    rr(260, 96, 160, 100, 10); ink('#1b1822', 3); snow(266, 102, 148, 88, u > 2.4 ? .1 : 1, tt, false);
    rr(450, 40, 26, 160, 12); ink('#3a3550', 3); const ly = 150 - 50 * Math.sin(Math.min(1, u / 2.4) * Math.PI * .5); circ2(463, ly, 15, '#ff3d4d', 3);
    DUO.demoFinger(480, ly + 14, u < 2.4, u % 1);
    badge('MAKE THE STATIC CLEAR!', 250, 20, 15, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_novela = [['TUNER', 'TURN THE DIAL BY THE SIGNAL BAR', 'DRAG LEFT / RIGHT'], ['FINE TUNER', 'FINE-TUNE UNTIL THE STATIC CLEARS', 'DRAG UP / DOWN']];
DUO.DEMOS.du_novela = [t => demo(0, t), t => demo(1, t)];

})();
