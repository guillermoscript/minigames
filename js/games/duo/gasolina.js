'use strict';
/* ═════════ DUO · ¡LA COLA DE GASOLINA! (du_gasolina) ═════════
   The gasoline queue at the bomba. Eight cars in line, the pump at the head, a guard walking his gaze up and down the line.
   THE SLY ONE (role 0, JUDGE): sees the line from above and the guard's gaze cone sweeping F(ront) / B(ack). HOLDS the pointer (or Space)
   and slides the marker to a gap 1-2 cars ahead = "I want in" (the friend's dash lights up), and LETS GO to cut in. Letting go while the
   guard is looking = busted (back one spot, 3 busts = thrown out of the line). The guard only looks away (SIDE) after the friend honks.
   THE DRIVER (role 1): sees only the dash: the fuel needle drops all the time, a lamp says "the vivo wants a honk", and a horn.
   A honk makes the guard whip his head toward the commotion for ~1.4 s, EXCEPT if he is already staring down the back of the line
   (where the honker sits): then he spots the honk and the car is busted. The vivo decides WHEN (arm / cancel / let go), the driver performs.
   The line also moves by itself (a car fills up and leaves every ~3 s), so ~4+ spots must be cut. Reach the pump with fuel left = win.
   Netcode: the VIVO owns the whole line, the guard and the verdict. 'arm' 0/1 (latest) and 'q' {p,c,k} (cars ahead, busts, cut spots;
   absolute, latest) go to the driver. The DRIVER owns the horn: 'honk' n (absolute counter, duplicates harmless). Fuel is a pure function
   of the clock + busts, so both screens agree without messages. The judge calls g.finish before g.limit. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) */
const L = 10, P0 = 8, Y0 = 138, SPC = 41, QX = 240, SX = 392;   // cars in line, our start slot, y of slot 0, spacing, queue x, shoulder x
const GX = 505, GY = 352;                                          // the guard
const HX = 560, HY = 468;                                          // the horn hub on the dash
const slotY = i => Y0 + i * SPC;
const CARC = ['#ff6b6b', '#4db8ff', '#ffd23f', '#5CFF7A', '#c78bff', '#ff9a3d', '#f2f2f2', '#2ec4b6'];

let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function mixShade(c, k = .72) { const n = parseInt(c.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const f = v => Math.max(0, Math.round(v * k)).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); }
function pill(x, y, label, col) {
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  X.beginPath(); X.moveTo(x - 9, y + 13); X.lineTo(x, y + 24); X.lineTo(x + 9, y + 13); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
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
function eyes(x, y, gap, r, lx, ly, mood, T) {                     // two big eyes; (lx,ly) = where the pupils look, in -1..1
  const blink = Math.sin(T * 1.7 + x) > .985 ? .15 : 1;
  for (const s of [-1, 1]) {
    el(x + s * gap, y, r, r * 1.2 * (mood === 'dead' ? 1 : blink)); ink('#fff', 2.5);
    if (mood === 'dead') { line([[x + s * gap - 3, y - 3], [x + s * gap + 3, y + 3]], 2.5, INK); line([[x + s * gap + 3, y - 3], [x + s * gap - 3, y + 3]], 2.5, INK); continue; }
    X.fillStyle = INK; X.beginPath(); X.arc(x + s * gap + lx * r * .45, y + ly * r * .5, r * .5, 0, TAU); X.fill();
    X.fillStyle = '#fff'; X.beginPath(); X.arc(x + s * gap + lx * r * .45 - 1, y + ly * r * .5 - 1.5, r * .17, 0, TAU); X.fill();
    if (mood === 'angry') line([[x + s * gap - s * r * 1.2, y - r * 1.8 + 2], [x + s * gap + s * r * .6, y - r * 1.3]], 3, INK);
  }
}
function carTop(x, y, col, o = {}) {                               // a chibi car seen from above, facing up; eyes on the windshield
  const T = o.T || 0; x += o.shake ? Math.sin(T * 60) * 1.5 : 0;
  for (const [wx, wy] of [[-27, -12], [27, -12], [-27, 11], [27, 11]]) { rr(x + wx - 4, y + wy - 6, 8, 12, 3); ink('#2b2838', 2.5); }
  cel(col, mixShade(col), () => rr(x - 25, y - 19, 50, 38, 11), 5, 6, 3.5);
  rr(x - 16, y - 14, 32, 14, 5); ink('#bfe9ff', 2.5);
  X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.moveTo(x - 12, y - 11); X.lineTo(x - 4, y - 11); X.lineTo(x - 9, y - 3); X.lineTo(x - 14, y - 3); X.closePath(); X.fill();
  rr(x - 14, y + 2, 28, 11, 4); ink(mixShade(col, .85), 2);
  for (const s of [-1, 1]) { el(x + s * 15, y - 18, 4.5, 3); ink('#fff3a0', 2); el(x + s * 15, y + 18, 4, 2.4); ink('#e0433d', 2); }
  eyes(x, y - 7, 7, 3.6, o.lx || 0, o.ly === undefined ? -.7 : o.ly, o.mood, T + (o.ph || 0));
  if (o.sweat) { X.fillStyle = '#9fe3ff'; X.beginPath(); X.moveTo(x + 21, y - 21); X.quadraticCurveTo(x + 27, y - 13, x + 21, y - 10); X.quadraticCurveTo(x + 15, y - 13, x + 21, y - 21); X.fill(); }
}
function carRear(x, y, s, col) {                                   // the back of a car seen from the driver's seat
  X.save(); X.translate(x, y); X.scale(s, s);
  rr(-58, 30, 22, 24, 6); ink('#2b2838', 3); rr(36, 30, 22, 24, 6); ink('#2b2838', 3);
  cel(col, mixShade(col), () => rr(-62, -34, 124, 78, 22), 8, 9, 5);
  rr(-42, -26, 84, 34, 10); ink('#bfe9ff', 4); X.fillStyle = 'rgba(255,255,255,.5)'; X.beginPath(); X.moveTo(-34, -22); X.lineTo(-12, -22); X.lineTo(-24, 4); X.lineTo(-38, 4); X.closePath(); X.fill();
  for (const sg of [-1, 1]) { rr(sg * 48 - 10, 12, 20, 14, 5); ink('#e0433d', 3); }
  rr(-18, 20, 36, 16, 4); ink('#fff7d6', 3);
  X.restore();
}
function sweatDrop(x, y, s, T) { const k = (T * 2.2) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(x - k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
function heartM(x, y, bad) { X.save(); X.translate(x, y); X.beginPath(); X.moveTo(0, 6); X.bezierCurveTo(-13, -3, -9, -14, 0, -7); X.bezierCurveTo(9, -14, 13, -3, 0, 6); X.closePath(); ink(bad ? '#6b6486' : '#5CFF7A', 2.5); X.restore(); }
function palm(x, y, T, s) {
  X.save(); X.translate(x, y);
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + Math.sin(T * 1.2 + i) * .05; X.save(); X.rotate(a); X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(14 * s, -9 * s, 36 * s, -2 * s); X.quadraticCurveTo(14 * s, 8 * s, 0, 0); ink(i % 2 ? '#2f9a4f' : '#47bd62', 2.5); X.restore(); }
  X.beginPath(); X.arc(0, 0, 6 * s, 0, TAU); ink('#8a5a2b', 3); X.restore();
}
function guard(x, y, T, gx, gy, md) {                              // the guard: hi-vis vest, cap, moustache; his pupils follow the gaze (gx,gy)
  const sway = Math.sin(T * 3) * 1.4;
  el(x, y + 6, 26, 7); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  rr(x - 14, y - 20, 11, 24, 4); ink('#33407a', 3); rr(x + 3, y - 20, 11, 24, 4); ink('#33407a', 3);
  cel('#ff9a2e', '#d9701a', () => rr(x - 21, y - 58 + sway * .3, 42, 42, 12), 5, 5, 4);
  X.fillStyle = '#e8f6ff'; rr(x - 21, y - 40 + sway * .3, 42, 6, 2); X.fill(); rr(x - 21, y - 28 + sway * .3, 42, 5, 2); X.fill();
  rr(x - 31, y - 54, 11, 30, 5); ink('#4d7fd4', 3); rr(x + 20, y - 54, 11, 30, 5); ink('#4d7fd4', 3);
  const hy = y - 78 + sway * .5, hx = x + gx * 5;
  cel('#e2ac86', '#c48862', () => { X.beginPath(); X.arc(hx, hy, 19, 0, TAU); }, 4, 4, 4);
  rr(hx - 20, hy - 24, 40, 16, 8); ink('#2a3f7a', 3.5); rr(hx - 24 + gx * 8, hy - 12, 48, 7, 3); ink('#1e2f5e', 2.5);
  eyes(hx, hy - 1, 7, 4.4, gx, gy, md === 'caught' ? 'angry' : '', T);
  line([[hx - 11, hy + 8], [hx - 3, hy + 5], [hx + 3, hy + 5], [hx + 11, hy + 8]], 4, INK);
  if (md === 'caught') { X.beginPath(); X.arc(hx, hy + 13, 5, 0, TAU); ink('#e8434f', 2); for (let i = 0; i < 3; i++) line([[hx + 14 + i * 4, hy + 8 - i * 6], [hx + 22 + i * 4, hy + 6 - i * 8]], 3, '#fff'); }
  else if (md === 'away') { el(hx, hy + 13, 3.5, 4.5); ink('#7a2b2b', 2); }
  else line([[hx - 4, hy + 13], [hx + 4, hy + 13]], 3, INK);
}
function tio(x, y, T) {                                            // el tío, pushing the car from behind
  const bob = Math.sin(T * 9) * 3;
  el(x, y + 14, 30, 8); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  rr(x - 16, y - 2, 12, 20, 4); ink('#4b4466', 3); rr(x + 4, y - 2, 12, 20, 4); ink('#4b4466', 3);
  cel('#f4e9c8', '#d3c498', () => rr(x - 24, y - 44 + bob, 48, 48, 14), 6, 6, 4);
  for (const s of [-1, 1]) { rr(x + s * 26 - 5, y - 52 + bob, 10, 34, 5); ink('#e2ac86', 3); }
  cel('#e2ac86', '#c48862', () => { X.beginPath(); X.arc(x, y - 62 + bob, 19, 0, TAU); }, 4, 4, 4);
  eyes(x, y - 64 + bob, 7, 4.2, 0, -.4, 'angry', T);
  line([[x - 12, y - 52 + bob], [x - 3, y - 56 + bob], [x + 3, y - 56 + bob], [x + 12, y - 52 + bob]], 5, INK);
  sweatDrop(x + 22, y - 72 + bob, 1, T);
}
function goldDrop(x, y, k) {                                       // the golden drop falling over Caos
  const ky = clamp(k / .9, 0, 1), dy = lerp(y - 190, y - 56, ease(ky)), s = 1 + Math.sin(k * 8) * .04;
  X.save(); X.translate(x, dy); X.scale(s, s);
  X.beginPath(); X.moveTo(0, -42); X.bezierCurveTo(36, -2, 30, 34, 0, 34); X.bezierCurveTo(-30, 34, -36, -2, 0, -42); X.closePath(); ink('#ffcf2e', 4);
  X.fillStyle = 'rgba(255,255,255,.7)'; el(-11, 0, 5, 12, .3); X.fill(); X.restore();
  caos(x, y + 30, 3.2, { mood: ky >= 1 ? 'happy' : null });
  if (ky >= 1) for (let i = 0; i < 6; i++) star(x + Math.cos(i * 1.05 + k * 3) * 54, y - 20 + Math.sin(i * 1.05 + k * 3) * 36, 7, 3, 5, k * 4 + i, '#FFE14D', 2);
}
const hs = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }
let CS = 7; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;

/* ═════════ the game ═════════ */
function duGas(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), vivo = D.role === 0, TS = Math.sqrt(sp);
  const LEAVE = 3.2 / TS, FDW = 1.7 / TS, BDW = 1.0 / TS, SWP = .45 / TS, WIN = 1.45 / TS, STUN = .9 / TS;
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const palmX = [[58, 210], [112, 330], [64, 470], [128, 548]].map(([x, y]) => [x + R() * 16, y + R() * 16]);
  const mkCar = i => ({ col: CARC[Math.floor(R() * CARC.length)], x: QX, y: slotY(i), me: false, ph: R() * 6, shk: 0, vy: 0 });
  const lineUp = []; for (let i = 0; i < L; i++) lineUp.push(mkCar(i));
  const me0 = lineUp[P0]; me0.me = true; me0.col = vivo ? pCol() : myCol();
  const gone = [], bits = [], pops = [], kHeld = new Set();
  // the vivo's truth (the driver mirrors p / c / k from 'q')
  let p = P0, cuts = 0, caught = 0, leaveT = LEAVE, gs = 'F', gt = 0, phi = 0, w = 0, winUntil = -1, armed = false, tgt = P0 - 1, stunUntil = -1, lastHonk = 0, held = false;
  let mood = 'watch', moodUntil = 0, qSig = '', armSent = -1;
  // the driver's view
  let rp = P0, rc = 0, rk = 0, lamp = false, honkN = 0, honkAt = -9, honkReady = 0, pressed = -9, cutAt = -9, bustAt = -9, rpLeaves = 0, lastRp = P0;
  let resAt = -1, fillSnd = false, loseSnd = false, BG = null, fN = FOCUSN;
  const fuel = () => clamp(1 - g.c / (g.limit * .95) - .05 * (vivo ? caught : rc), 0, 1);
  const pop = (s, x, y, size, bgc, fg) => { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); };
  const bit = o => bits.push(Object.assign({ t0: g.c, life: .7, gr: 600, r: 3 }, o));
  const sendQ = () => { const s = p + ',' + caught + ',' + cuts; if (s !== qSig) { qSig = s; D.send('q', { p, c: caught, k: cuts }, true); } };
  const honkSfx = () => { snd(392, .3, 'sawtooth', .06, 0, 370); snd(311, .3, 'sawtooth', .05, 0, 295); };
  const disarm = () => { armed = false; if (armSent !== 0) { armSent = 0; D.send('arm', 0, true); } };

  function bust() {
    caught++; bustAt = g.c; stunUntil = g.c + STUN; mood = 'caught'; moodUntil = g.c + 1.3; disarm();
    const car = lineUp[p]; if (p + 1 < L - 1) { lineUp[p] = lineUp[p + 1]; lineUp[p + 1] = car; p++; }
    car.shk = 1; snd(2300, .35, 'sine', .07, 0, 1900); snd(2300, .3, 'sine', .06, .38, 1800); sfx.thud && sfx.thud(); shake(7, .25);
    for (let i = 0; i < 8; i++) bit({ x: GX + 20, y: GY - 90, vx: (cr() - .2) * 260, vy: -(60 + cr() * 140), c: '#fff', r: 2.5 });
    pop('BUSTED!', 400, 300, 40, '#e8434f', '#fff'); sendQ();
  }
  function cutIn() {
    const from = p, to = tgt; disarm();
    if (to >= from) return;                                            // the marker is back on our own car: cancelled
    if (w >= .6 || g.c < winUntil) {                                   // the guard is looking elsewhere: in you go
      const car = lineUp[from]; lineUp.splice(from, 1); lineUp.splice(to, 0, car); p = to; cuts += from - to; cutAt = g.c;
      snd(520, .12, 'square', .07, 0, 880); snd(780, .14, 'square', .06, .08, 1100); noise(.25, .06, 1200, 300, 'bandpass');
      pop('CUT!', 400, 300, 40, '#2eb85c', '#fff'); for (let i = 0; i < 8; i++) bit({ x: QX + 30, y: slotY(to), vx: 60 + cr() * 150, vy: -(30 + cr() * 90), c: '#ffe58a', r: 3 });
      sendQ();
    } else bust();
  }
  function leave() {
    const c = lineUp.shift(); c.vy = -240; gone.push(c); p--;
    const n = mkCar(L - 1); n.y = slotY(L) + 20; lineUp.push(n);
    snd(130, .2, 'sawtooth', .05, 0, 200); sendQ();
  }
  function setTgt(y) { tgt = clamp(Math.round((y - Y0) / SPC), Math.max(0, p - 2), p); }
  function endSounds() {
    if (g.result === 'lose' && !loseSnd) { loseSnd = true; snd(220, .5, 'sawtooth', .06, 0, 60); noise(.4, .08, 500, 100, 'lowpass'); }
    if (g.result === 'win' && !fillSnd) { fillSnd = true; noise(.9, .07, 2400, 900, 'bandpass'); for (let i = 0; i < 4; i++) snd(523 * Math.pow(1.26, i), .18, 'square', .05, .15 * i); }
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: vivo ? 'CUT IN!' : 'HONK!', roleLabel: vivo ? 'SLY ONE' : 'GAS DRIVER',
    hint: vivo ? 'HOLD AND SLIDE TO A GAP AHEAD, LET GO WHEN THE GUARD LOOKS AWAY - YOUR FRIEND HONKS TO MAKE HIM LOOK' : 'WHEN THE LAMP LIGHTS, HIT THE HORN TO DISTRACT THE GUARD - THE FUEL IS RUNNING OUT!',
    thint: vivo ? 'HOLD, SLIDE TO A GAP AHEAD, LET GO WHEN THE GUARD LOOKS AWAY' : 'TAP THE HORN WHEN THE LAMP LIGHTS UP - THE FUEL IS RUNNING OUT!',
    update(dt) {
      g.c += dt;
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); }
      if (g.result && resAt < 0) resAt = g.c;
      for (const c of gone) { c.y += c.vy * dt; c.x += 70 * dt; c.vy -= 80 * dt; } while (gone.length && gone[0].y < -50) gone.shift();
      for (const b of bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += b.gr * dt; } while (bits.length && g.c - bits[0].t0 > bits[0].life) bits.shift();
      endSounds();
      const done = !!g.result;
      if (vivo) {
        // the guard: F(ront) dwell -> sweep -> B(ack) dwell -> sweep; a honk sends him SIDE for WIN seconds, then he restarts at F
        gt += dt;
        const inWin = g.c < winUntil;
        if (!inWin) {
          if (gs === 'F' && gt >= FDW) { gs = 'toB'; gt = 0; } else if (gs === 'toB' && gt >= SWP) { gs = 'B'; gt = 0; } else if (gs === 'B' && gt >= BDW) { gs = 'toF'; gt = 0; } else if (gs === 'toF' && gt >= SWP) { gs = 'F'; gt = 0; }
        }
        const pt = gs === 'F' ? 0 : gs === 'B' ? 1 : gs === 'toB' ? gt / SWP : 1 - gt / SWP;
        phi = lerp(phi, clamp(pt, 0, 1), Math.min(1, dt * 14));
        w = lerp(w, inWin ? 1 : 0, Math.min(1, dt * (inWin ? 10 : 7)));
        if (!inWin && winUntil > 0) { winUntil = -1; gs = 'F'; gt = 0; if (mood === 'away') mood = 'watch'; }
        if (mood !== 'watch' && g.c > moodUntil && !inWin) mood = 'watch';
        if (!done) { leaveT -= dt; if (leaveT <= 0) { leaveT += LEAVE; leave(); } }
        for (let i = 0; i < lineUp.length; i++) { const c = lineUp[i]; c.y += (slotY(i) - c.y) * Math.min(1, dt * 9); c.shk = Math.max(0, c.shk - dt * 2); }
        if (armed && (done || g.c < stunUntil)) disarm();
        const a = armed ? 1 : 0; if (a !== armSent) { armSent = a; D.send('arm', a, true); }
        if (!done) {
          if (p <= 0) g.finish('win');
          else if (caught >= 3 || fuel() <= 0 || g.c >= g.limit) g.finish('lose');
        }
      } else if (!done && fuel() < .25 && Math.floor(g.c * 4) !== Math.floor((g.c - dt) * 4) && Math.floor(g.c * 4) % 2 === 0) snd(900, .06, 'square', .035);
    },
    msg(type, d) {
      if (vivo) {
        if (type === 'honk') {
          if (typeof d !== 'number' || d <= lastHonk || g.result) return; lastHonk = d; honkSfx();
          if (phi > .5 && w < .5 && g.c >= winUntil) bust();
          else { winUntil = Math.max(winUntil, g.c + WIN); mood = 'away'; moodUntil = winUntil; }
        }
      } else if (type === 'arm') lamp = d === 1;
      else if (type === 'q' && d) {
        if (d.k > rk) { cutAt = g.c; snd(520, .12, 'square', .07, 0, 880); snd(780, .14, 'square', .06, .08, 1100); pop('CUT!', 400, 330, 40, '#2eb85c', '#fff'); }
        if (d.c > rc) { bustAt = g.c; shake(7, .25); snd(2300, .35, 'sine', .07); pop('BUSTED!', 400, 330, 40, '#e8434f', '#fff'); }
        rp = d.p; rc = d.c; rk = d.k;
      }
    },
    honk() {
      if (vivo || g.result || g.c < honkReady) return;
      honkReady = g.c + .85 / TS; honkN++; honkAt = g.c; pressed = g.c; D.send('honk', honkN); honkSfx();
      for (let i = 0; i < 3; i++) bit({ x: HX + (cr() - .5) * 40, y: HY - 50, vx: (cr() - .5) * 300, vy: -(80 + cr() * 140), c: '#ffe58a', r: 3, gr: 200 });
    },
    down(pt) {
      held = true;
      if (!vivo) { g.honk(); return; }
      if (g.result || g.c < stunUntil || p <= 0) return;
      armed = true; setTgt(pt.y); if (tgt >= p) tgt = Math.max(0, p - 1);
    },
    move(pt) { if (vivo && armed && held) setTgt(pt.y); },
    up() { held = false; if (vivo && armed) cutIn(); },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (kHeld.has(e.code)) return; kHeld.add(e.code);
      if (!vivo) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyH') g.honk(); return; }
      if (g.result) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { if (armed) tgt = Math.max(Math.max(0, p - 2), tgt - 1); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { if (armed) tgt = Math.min(p, tgt + 1); }
      else if (e.code === 'Space' || e.code === 'Enter') { if (g.c >= stunUntil && p > 0 && !armed) { armed = true; tgt = Math.max(0, p - 1); } }
    },
    keyup(e) { kHeld.delete(e.code); if (vivo && armed && (e.code === 'Space' || e.code === 'Enter')) cutIn(); },
  };

  /* ───────────── the vivo's top-down gas station ───────────── */
  function bakeVivo() {
    X.fillStyle = '#8f98a8'; X.fillRect(0, 0, W, H);
    X.fillStyle = 'rgba(20,16,28,.07)'; for (let i = 0; i < 40; i++) { rr(170 + hs(i) * 400, 70 + hs(i + 50) * 500, 40 + hs(i + 9) * 50, 18, 8); X.fill(); }
    X.fillStyle = '#6fbf73'; X.fillRect(0, 0, 168, H); X.fillStyle = '#e8dfc9'; X.fillRect(160, 0, 8, H);
    X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(168, 0); X.lineTo(168, H); X.stroke();
    for (let y = 70; y < 560; y += 40) { line([[208, y], [208, y + 22]], 4, '#f4f1e6'); line([[272, y], [272, y + 22]], 4, '#f4f1e6'); }
    X.fillStyle = '#a8b0c0'; X.fillRect(352, 64, 80, 500); X.save(); X.beginPath(); X.rect(352, 64, 80, 500); X.clip(); X.strokeStyle = '#f2c94c'; X.lineWidth = 6;
    for (let y = 40; y < 640; y += 36) { X.beginPath(); X.moveTo(352, y + 36); X.lineTo(432, y); X.stroke(); } X.restore();
    X.strokeStyle = INK; X.lineWidth = 3.5; X.strokeRect(352, 64, 80, 500);
    rr(296, 96, 52, 78, 10); ink('#d7cfbb', 4); rr(306, 104, 32, 54, 8); ink('#e8434f', 3.5); rr(311, 110, 22, 16, 4); ink('#bfe9ff', 2.5);
    rr(176, 62, 190, 28, 10); ink('#f4f1e6', 4); X.fillStyle = '#e8434f'; rr(184, 68, 174, 8, 4); X.fill();
    X.fillStyle = '#e1d6bf'; X.fillRect(588, 0, 212, H); X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(588, 0); X.lineTo(588, H); X.stroke();
    rr(612, 96, 170, 122, 12); ink('#ffb347', 4); rr(604, 82, 186, 34, 10); ink('#e8434f', 4);
    for (let i = 0; i < 6; i++) { X.fillStyle = i % 2 ? '#fff' : '#e8434f'; X.fillRect(612 + i * 30, 86, 15, 26); }
    rr(626, 134, 142, 54, 8); ink('#7a4b2a', 3.5); rr(634, 142, 126, 14, 5); ink('#ffe08a', 2);
    rr(742, 320, 28, 34, 6); ink('#5a8fd6', 3.5);
  }
  function drawVivo(T, won, lost, rk0) {
    X = ctx;
    if (!BG) { try { const c = document.createElement('canvas'); c.width = W; c.height = H; X = c.getContext('2d'); bakeVivo(); BG = c; } catch (e) { BG = null; } X = ctx; }
    if (BG) X.drawImage(BG, 0, 0); else bakeVivo();
    for (const [x, y] of palmX) palm(x, y, T, 1);
    const car = lineUp[p];
    for (let i = 0; i < L; i++) { const c = lineUp[i]; if (c !== car) carTop(c.x, c.y, c.col, { T, ph: c.ph }); }
    for (const c of gone) carTop(c.x, c.y, c.col, { T, ph: c.ph });
    // the guard's cone: front = every car ahead of us, back = us and the tail, side = the kiosk
    const y0 = slotY(0) - 24, y1 = slotY(Math.max(0, p - 1)) + 22, y2 = slotY(p) - 22, y3 = slotY(L - 1) + 22;
    const A = [262, y0, 262, y1], B = [262, y2, 262, y3], S = [610, 150, 610, 280];
    const ex = [0, 1, 2, 3].map(i => lerp(lerp(A[i], B[i], phi), S[i], w));
    const hot = mood === 'caught' ? '255,80,80' : w > .5 ? '120,255,190' : '255,225,70';
    const cg = X.createLinearGradient(GX, GY, ex[0], ex[1]); cg.addColorStop(0, `rgba(${hot},.5)`); cg.addColorStop(1, `rgba(${hot},.16)`);
    X.beginPath(); X.moveTo(GX - 6, GY - 80); X.lineTo(ex[0], ex[1]); X.lineTo(ex[2], ex[3]); X.closePath(); X.fillStyle = cg; X.fill();
    X.lineWidth = 3; X.strokeStyle = `rgba(${hot},.75)`; X.stroke();
    // the marker: ghost car on the shoulder + a dashed path from our car
    if (armed && !g.result) {
      const ty = slotY(tgt), pul = .6 + .4 * Math.sin(T * 12);
      X.setLineDash([9, 8]); line([[QX + 30, slotY(p)], [SX - 34, slotY(p)], [SX - 34, ty], [QX + 30, ty]], 5, `rgba(255,255,255,${.5 + .3 * pul})`); X.setLineDash([]);
      X.globalAlpha = .6 + .3 * pul; carTop(SX, ty, pCol(), { T }); X.globalAlpha = 1;
      X.beginPath(); X.moveTo(SX + 38, ty - 10); X.lineTo(SX + 20, ty); X.lineTo(SX + 38, ty + 10); X.closePath(); ink('#5CFF7A', 3);
    }
    const xo = clamp(Math.abs(car.y - slotY(p)) / 28, 0, 1) * 34, stun = g.c < stunUntil;
    carTop(QX + xo + (car.shk > 0 ? Math.sin(T * 50) * 3 * car.shk : 0), car.y, car.col, { T, mood: lost ? 'dead' : stun ? 'angry' : '', sweat: armed && w < .6, ph: car.ph });
    if (!g.result) pill(QX + xo, car.y - 36, 'YOUR FRIEND', pCol());
    guard(GX, GY, T, clamp(((ex[0] + ex[2]) / 2 - GX) / 300, -1, 1), clamp(((ex[1] + ex[3]) / 2 - GY) / 260, -1, 1), mood);
    pill(GX, GY - 124, 'YOU', myCol());
    // kiosk gags: the arepa lady, a dog that trots by, a moto zipping on the road above
    const lx = 700, ly = 192; el(lx, ly + 4, 22, 6); X.fillStyle = 'rgba(20,16,28,.2)'; X.fill();
    cel('#fff', '#d7d2ea', () => { X.beginPath(); X.arc(lx, ly - 14, 20, 0, TAU); }, 4, 4, 3.5); eyes(lx, ly - 18, 6, 3.6, w > .5 ? 1 : -.3, 0, '', T); line([[lx - 5, ly - 6], [lx + 5, ly - 6]], 3, INK);
    rr(lx - 20, ly - 36, 40, 10, 5); ink('#b2381f', 3);
    const dgx = 780 - (T * 38) % 220; X.save(); X.translate(dgx, 420 + Math.sin(T * 8) * 2); X.beginPath(); X.ellipse(0, 0, 16, 9, 0, 0, TAU); ink('#c88a4a', 3); X.beginPath(); X.arc(-14, -5, 7, 0, TAU); ink('#c88a4a', 3); line([[16, -2], [26, -10]], 4, '#c88a4a'); X.restore();
    const mx = 900 - (T * 160) % 1100; rr(mx - 20, 40, 40, 14, 6); ink('#5a8fd6', 3); X.beginPath(); X.arc(mx - 16, 56, 6, 0, TAU); ink('#2b2838', 2.5); X.beginPath(); X.arc(mx + 16, 56, 6, 0, TAU); ink('#2b2838', 2.5);
    line([[322, 150], [300, 150], [286, 128]], 4, '#2b2838');
    txt('GAS PUMP', 270, 77, 15, '#fff', 'center', 150); txt('AREPAS', 697, 99, 15, '#fff', 'center', 130);
    if (won) {
      const k = Math.max(0, rk0);
      for (let i = 0; i < 10; i++) { const q = (k * 2 + i * .13) % 1; X.globalAlpha = .8 - q * .6; el(322 - q * 24 + Math.sin(i) * 6, 156 - q * 10 + i * 6, 5, 7); ink('#ffd23f', 2); } X.globalAlpha = 1;
      for (let i = 0; i < 6; i++) { const a = i * 1.1 + T * 2; star(260 + Math.cos(a) * 70, 120 + Math.sin(a * 1.3) * 40, 8, 3.5, 5, a, ['#FFE14D', '#5CFF7A', '#4db8ff'][i % 3], 2.5); }
      goldDrop(430, 330, k); badge('GUSH!', 400, 250, 46, '#ffb23d', '#fff', outBack(k / .25), -.05);
    }
    if (lost) {
      const k = Math.max(0, rk0);
      for (let i = 0; i < 5; i++) { const q = (k * 1.4 + i * .2) % 1; X.globalAlpha = (1 - q) * .8; X.beginPath(); X.arc(QX - 10 + i * 8, car.y - 18 - q * 70, 8 + q * 14, 0, TAU); ink('#d6d2e0', 2.5); } X.globalAlpha = 1;
      tio(QX, car.y + 52, T); badge('PUFF!', 400, 280, 46, '#7e93ad', '#fff', outBack(k / .25), .05);
    }
    for (const b of bits) { X.globalAlpha = clamp(1 - (T - b.t0) / b.life, 0, 1); el(b.x, b.y, b.r, b.r * 1.2); ink(b.c, 1.5); X.globalAlpha = 1; }
    rr(612, 236, 162, 60, 10); ink('#fff1c9', 4); txt('AHEAD', 650, 254, 15, INK); txt(String(p), 742, 262, 40, p <= 2 ? '#2eb85c' : '#e8434f');
    for (let i = 0; i < 3; i++) heartM(634 + i * 28, 284, caught > i);
    drawPops(T);
    if (!g.result && T < 3.6) badge('HOLD, SLIDE, LET GO WHEN HE LOOKS AWAY', 400, 538, 18, '#c98a12', '#fff', outBack(T / .3), -.02);
    if (armed && !g.result) badge('HONK!', QX + 100, car.y - 34, 20, '#2b9ee6', '#fff', .9 + .1 * Math.sin(T * 14), -.06);
    vignette(.2);
  }
  function drawPops(T) {
    for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 140, 660), Math.max(100, q.y - Math.min(a, .6) * 14), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
  }

  /* ───────────── the driver's dash ───────────── */
  function bakeDash() {
    const sk = X.createLinearGradient(0, 0, 0, 300); sk.addColorStop(0, '#6ec6ff'); sk.addColorStop(1, '#ffe8a8'); X.fillStyle = sk; X.fillRect(0, 0, W, 300);
    X.fillStyle = '#7fb59a'; X.beginPath(); X.moveTo(0, 190); X.quadraticCurveTo(120, 90, 260, 150); X.quadraticCurveTo(380, 100, 520, 140); X.quadraticCurveTo(660, 80, 800, 170); X.lineTo(800, 220); X.lineTo(0, 220); X.closePath(); X.fill();
    X.fillStyle = '#5f9a80'; X.beginPath(); X.moveTo(0, 215); X.quadraticCurveTo(160, 150, 300, 200); X.lineTo(300, 230); X.lineTo(0, 230); X.closePath(); X.fill();
    const hc = ['#ff8a8a', '#ffd23f', '#6cc4ff', '#9be37a', '#ffa84d']; for (let i = 0; i < 16; i++) { const x = 20 + i * 24 + hs(i) * 10, y = 176 + (i % 3) * 12 + hs(i + 3) * 6; X.fillStyle = hc[i % 5]; rr(x, y, 20, 16, 3); X.fill(); }
    X.fillStyle = '#9aa3b4'; X.beginPath(); X.moveTo(340, 176); X.lineTo(460, 176); X.lineTo(760, 300); X.lineTo(40, 300); X.closePath(); X.fill();
    X.strokeStyle = '#f4f1e6'; X.lineWidth = 4; X.setLineDash([16, 14]); X.beginPath(); X.moveTo(400, 176); X.lineTo(400, 300); X.stroke(); X.setLineDash([]);
    X.fillStyle = '#6fbf73'; X.beginPath(); X.moveTo(0, 230); X.lineTo(340, 176); X.lineTo(40, 300); X.lineTo(0, 300); X.closePath(); X.fill();
    X.beginPath(); X.moveTo(800, 230); X.lineTo(460, 176); X.lineTo(760, 300); X.lineTo(800, 300); X.closePath(); X.fill();
    rr(330, 120, 140, 18, 6); ink('#f4f1e6', 3.5); X.fillStyle = '#e8434f'; rr(336, 124, 128, 6, 3); X.fill();
    X.fillStyle = INK; X.fillRect(344, 138, 4, 38); X.fillRect(452, 138, 4, 38);
    rr(386, 150, 28, 26, 5); ink('#e8434f', 3);
    const dg = X.createLinearGradient(0, 296, 0, H); dg.addColorStop(0, '#4a4670'); dg.addColorStop(1, '#2b2840');
    X.beginPath(); X.moveTo(0, 318); X.quadraticCurveTo(400, 262, 800, 318); X.lineTo(800, H); X.lineTo(0, H); X.closePath(); ink(dg, 5);
    X.fillStyle = 'rgba(255,255,255,.1)'; X.beginPath(); X.moveTo(20, 330); X.quadraticCurveTo(400, 280, 780, 330); X.lineTo(780, 340); X.quadraticCurveTo(400, 292, 20, 342); X.closePath(); X.fill();
  }
  function gauge(cx, cy, r, f, T, low) {
    X.beginPath(); X.arc(cx, cy, r + 14, 0, TAU); ink('#2f2d46', 5); X.beginPath(); X.arc(cx, cy, r + 4, Math.PI, TAU); X.lineTo(cx + r + 4, cy + 30); X.lineTo(cx - r - 4, cy + 30); X.closePath(); ink('#f4f1e6', 3);
    for (const [c, a, b] of [['#e8434f', 0, .2], ['#ffd23f', .2, .5], ['#5CFF7A', .5, 1]]) { X.beginPath(); X.arc(cx, cy, r - 12, Math.PI + a * Math.PI, Math.PI + b * Math.PI); X.lineWidth = 16; X.strokeStyle = c; X.stroke(); }
    X.lineWidth = 3; X.strokeStyle = INK; for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; X.beginPath(); X.moveTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22)); X.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); X.stroke(); }
    txt('EMPTY', cx - r + 30, cy + 20, 14, INK); txt('FULL', cx + r - 24, cy + 20, 14, INK); txt('FUEL', cx, cy - 36, 18, INK);
    const a = Math.PI + clamp(f, 0, 1) * Math.PI + (low ? Math.sin(T * 40) * .03 : 0);
    X.save(); X.translate(cx, cy); X.rotate(a); X.beginPath(); X.moveTo(-8, -4); X.lineTo(r - 18, 0); X.lineTo(-8, 4); X.closePath(); ink('#e8434f', 3); X.restore();
    X.beginPath(); X.arc(cx, cy, 11, 0, TAU); ink('#2f2d46', 3);
    if (low && Math.sin(T * 9) > 0) { rr(cx - 16, cy + 36, 32, 22, 6); ink('#e8434f', 3); txt('!', cx, cy + 47, 18, '#fff'); }
  }
  function drawDash(T, won, lost, rk0) {
    X = ctx;
    if (!BG) { try { const c = document.createElement('canvas'); c.width = W; c.height = H; X = c.getContext('2d'); bakeDash(); BG = c; } catch (e) { BG = null; } X = ctx; }
    if (BG) X.drawImage(BG, 0, 0); else bakeDash();
    for (let i = 0; i < 3; i++) { const cx = (i * 300 + T * 12) % 960 - 80, cy = 70 + i * 24; el(cx, cy, 44, 14); ink('#fff', 0); X.fillStyle = '#fff'; X.fill(); el(cx + 22, cy - 8, 26, 12); X.fill(); }
    const f = fuel(), n = clamp(rp, 0, 8), jump = T - cutAt < .5 ? ease((T - cutAt) / .5) : 1;
    for (let k = n - 1; k >= 0; k--) {
      const s = 1 - k * .1, y = 250 - k * 20 + (k === 0 ? (1 - jump) * 30 : 0), x = 400 + Math.sin(k * 2.1) * 12 * s;
      carRear(x, y, s * .9, CARC[(k + rpLeaves + 1) % CARC.length]);
    }
    rr(340, 72, 120, 38, 10); ink('#2f2d46', 4); X.fillStyle = '#9ad4ff'; rr(346, 78, 108, 26, 7); X.fill();
    caos(400, 104, 1.4, { mood: lost ? 'sad' : won ? 'happy' : f < .25 ? 'panic' : null });
    rr(560, 66, 178, 58, 12); ink('#fff1c9', 4); txt('AHEAD', 610, 88, 16, INK); txt(String(rp), 690, 96, 38, rp <= 2 ? '#2eb85c' : '#e8434f');
    for (let i = 0; i < 3; i++) heartM(594 + i * 30, 114, rc > i);
    gauge(230, 470, 112, lost ? 0 : won ? 1 : f, T, f < .3 && !g.result);
    const on = lamp && !g.result, pul = on ? .65 + .35 * Math.sin(T * 12) : 0;
    if (on) { X.save(); X.globalCompositeOperation = 'lighter'; const gr = X.createRadialGradient(HX, 352, 4, HX, 352, 90); gr.addColorStop(0, `rgba(255,220,80,${.5 + pul * .4})`); gr.addColorStop(1, 'rgba(255,220,80,0)'); X.fillStyle = gr; X.beginPath(); X.arc(HX, 352, 90, 0, TAU); X.fill(); X.restore(); }
    X.beginPath(); X.arc(HX, 352, 28, 0, TAU); ink(on ? '#ffd23f' : '#5b5776', 4);
    X.fillStyle = on ? '#fff' : 'rgba(255,255,255,.2)'; el(HX - 8, 344, 7, 5, -.5); X.fill();
    txt(on ? 'HONK NOW!' : 'WAIT', HX, 398, on ? 24 : 18, on ? '#ffe58a' : '#bfb8dd', 'center', 180);
    const dn = T - pressed < .18 ? 3 : 0;
    el(HX, HY + 8 + dn, 86, 74); X.fillStyle = 'rgba(0,0,0,.3)'; X.fill();
    cel('#6a6590', '#4a4670', () => { X.beginPath(); X.arc(HX, HY + dn, 80, 0, TAU); }, 8, 9, 5);
    X.beginPath(); X.arc(HX, HY + dn, 58, 0, TAU); ink('#ffd23f', 4);
    X.fillStyle = 'rgba(255,255,255,.5)'; el(HX - 20, HY - 24 + dn, 18, 10, -.6); X.fill();
    X.save(); X.translate(HX, HY + dn); X.beginPath(); X.moveTo(-26, -10); X.lineTo(-6, -10); X.lineTo(26, -30); X.lineTo(26, 30); X.lineTo(-6, 10); X.lineTo(-26, 10); X.closePath(); ink('#e8434f', 3.5); X.restore();
    for (let i = 0; i < 2; i++) { X.beginPath(); X.arc(HX + 30, HY + dn, 18 + i * 14, -.9, .9); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); }
    if (T - honkAt < .6) for (let i = 0; i < 3; i++) { const q = ((T - honkAt) * 2.2 + i / 3) % 1; X.globalAlpha = 1 - q; X.beginPath(); X.arc(HX, HY, 70 + q * 130, 0, TAU); X.lineWidth = 6; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
    rr(HX - 52, HY + 94, 104, 30, 8); ink('#fff1c9', 3.5); txt('SPACE', HX, HY + 109, 18, INK);
    if (T - honkAt < .5) badge('BEEP!', HX, HY - 120, 34, '#ffb23d', '#fff', outBack((T - honkAt) / .15), -.06);
    if (won) {
      const k = Math.max(0, rk0);
      for (let i = 0; i < 12; i++) { const q = (k * 1.8 + i * .09) % 1; X.globalAlpha = .9 - q * .5; el(400 + Math.sin(i * 1.3) * 12, 215 + q * 30, 5, 8); ink('#ffd23f', 2); } X.globalAlpha = 1;
      goldDrop(400, 270, k); badge('GUSH!', 400, 330, 46, '#ffb23d', '#fff', outBack(k / .25), -.05);
    }
    if (lost) {
      const k = Math.max(0, rk0);
      for (let i = 0; i < 6; i++) { const q = (k * 1.3 + i * .17) % 1; X.globalAlpha = (1 - q) * .85; X.beginPath(); X.arc(330 + i * 28, 230 - q * 90, 18 + q * 26, 0, TAU); ink('#d6d2e0', 3); } X.globalAlpha = 1;
      tio(660, 262, T); badge('PUFF!', 400, 330, 46, '#7e93ad', '#fff', outBack(k / .25), .05);
    }
    for (const b of bits) { X.globalAlpha = clamp(1 - (T - b.t0) / b.life, 0, 1); el(b.x, b.y, b.r, b.r * 1.2); ink(b.c, 1.5); X.globalAlpha = 1; }
    drawPops(T);
    if (!g.result && T < 3.6) badge('HONK WHEN THE LAMP LIGHTS UP!', 400, 540, 20, '#2b9ee6', '#fff', outBack(T / .3), -.02);
    if (!g.result && T < 3.4) pill(400, 142, 'YOU', myCol());
    vignette(.2);
  }
  g.draw = function () {
    const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk0 = resAt >= 0 ? T - resAt : -1;
    if (!vivo) { if (rp < lastRp) rpLeaves++; lastRp = rp; }
    if (vivo) drawVivo(T, won, lost, rk0); else drawDash(T, won, lost, rk0);
  };
  g.dbg = {
    Y0, SPC, SX, QX, HX, HY, L, P0, slotY,
    /* what the vivo's screen shows: the guard's gaze (state, phase 0=front..1=back, how far he looks away), the line position, the marker */
    vivoView: () => ({ p, gs, gt, phi, w, armed, tgt, stun: g.c < stunUntil, win: g.c < winUntil, caught, cuts, fdw: FDW, f: fuel() }),
    /* what the driver's dash shows: the lamp, the fuel, the cars ahead */
    dashView: () => ({ lamp, f: fuel(), p: rp, c: rc, k: rk, ready: g.c >= honkReady }),
  };
  wire(g, D, 0, sp, 'du_gasolina');
  return g;
}
reg('du_gasolina', duGas, 'COLA DE GASOLINA'); REGMAP.du_gasolina.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  if (role === 0) {
    const mv = ease(clamp((u - 1.2) / .8, 0, 1)), look = u > 1.4 && u < 3.1;
    X.fillStyle = '#8f98a8'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#a8b0c0'; X.fillRect(280, 0, 90, 240);
    for (let i = 0; i < 4; i++) carTop(180, 40 + i * 42, CARC[i], { T: tt });
    carTop(180, 208 - mv * 84, '#FFE14D', { T: tt });
    X.fillStyle = look ? 'rgba(120,255,190,.3)' : 'rgba(255,225,70,.35)'; X.beginPath(); X.moveTo(430, 70); X.lineTo(look ? 520 : 200, look ? 20 : 20); X.lineTo(look ? 520 : 200, look ? 120 : 190); X.closePath(); X.fill();
    guard(440, 170, tt, look ? .9 : -.7, look ? -.3 : 0, look ? 'away' : 'watch');
    DUO.demoFinger(330, 208 - mv * 84, u > .3 && u < 2.1, u % 1);
    badge(look ? 'LET GO NOW!' : 'HOLD AND SLIDE', 190, 26, 18, '#c98a12', '#fff', 1, -.03);
  } else {
    X.fillStyle = '#6ec6ff'; X.fillRect(0, 0, 520, 130); X.fillStyle = '#4a4670'; X.fillRect(0, 130, 520, 110);
    carRear(260, 70, .55, '#4db8ff'); carRear(260, 100, .7, '#ff6b6b');
    const on = u > .6 && u < 2.4; X.beginPath(); X.arc(130, 170, 20, 0, TAU); ink(on ? '#ffd23f' : '#5b5776', 3.5);
    X.beginPath(); X.arc(390, 180, 44, 0, TAU); ink('#6a6590', 4); X.beginPath(); X.arc(390, 180, 30, 0, TAU); ink('#ffd23f', 3.5);
    DUO.demoFinger(390, 190, u > 1 && u < 1.5, (u - 1) * 2); badge('HONK!', 190, 26, 18, '#2b9ee6', '#fff', 1, -.03);
  }
  X.restore();
}
DUO.INFO.du_gasolina = [['SLY ONE', 'CUT IN LINE', 'HOLD, SLIDE, LET GO'], ['GAS DRIVER', 'HONK ON CUE', 'TAP OR SPACE']];
DUO.DEMOS.du_gasolina = [t => demo(0, t), t => demo(1, t)];

})();
