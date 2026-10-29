'use strict';
/* ═════════ DUO · MOTOTAXI EN EL CERRO (du_mototaxi): a motorcycle taxi climbing a steep barrio street on a Caracas hillside ═════════
   Two people, one moto, and a hen in a sack on the passenger's lap.
   DRIVER (role 0, JUDGE): sees the street right in front of the handlebars (only ~280 px ahead: the hill hides the rest). HOLD (pointer anywhere /
   space / up) = throttle, RELEASE = brake. Steps (escalones) need speed or the moto stalls; stray dogs crossing the street need a brake.
   Cannot steer: the lean of the passenger steers the moto. Sees a rear-view mirror with the passenger.
   PASSENGER (role 1): sits behind, looks over the driver's shoulder and sees the whole street far ahead: potholes, hens, steps, dogs.
   LEAN with the body: drag the pointer / tilt the phone (gyroscope) / A D / arrows. The moto follows the lean. Cannot brake: has to shout
   "frena, perro!" to the driver.
   WIN: reach the top of the hill (the CIMA arch). LOSE: 3 crashes (the moto rolls back down the hill) or time runs out.
   Gag: the sack with the hen. On arrival the passenger climbs off dizzy with the hen on their head.
   Netcode: the DRIVER owns the moto and publishes 's' [P, x*100, v, hits] (latest, coalesced). The PASSENGER owns the lean: 'l' = lean*100
   (absolute, latest, re-sent every .4 s). The level is drawn from mkR() in the constructor (identical on both screens); the dogs run on the
   shared clock (u = g.c * sqrt(sp)). The driver decides the verdict and calls g.finish. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only

/* ───────────── tuning ───────────── */
const LEN = 2500, NOBS = 10, MAXHIT = 3;                  // street length, obstacles, crashes allowed before the moto rolls away
const VMAX = 300, ACC = 420, BRK = 700, DRAG = 260, LSPD = 3.4, HW = .32, XM = 1.6;   // top speed px/s, accel, brake, coast drag, sideways units/s, half width, max |x|
const VSTEP = 140, ROAD = 1.9;                            // minimum speed to climb a step, half width of the street (units)
const DOGD = 3.6, DOGX = 3.3;                              // seconds a dog takes to cross, |x| where it starts / ends
const SEE_D = 280, SEE_P0 = 50, SEE_P1 = 1500;            // how far ahead the driver sees; the range the passenger sees
const KIND = ['bache', 'gallina', 'escalon', 'bache', 'perro', 'gallina', 'bache', 'escalon', 'perro', 'gallina'];
const PD = { HZ: 205, YB: 515, LW: 215, K: 150 };          // driver camera: horizon y, near-plane y, px per unit at s=1, depth falloff
const PP = { HZ: 175, YB: 455, LW: 165, K: 420 };          // passenger camera

let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4, oc = INK) { build(); ink(shade, o, oc); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col, oc) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); if (oc !== null) { X.strokeStyle = oc || INK; X.lineWidth = w + 5; X.stroke(); } X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .55) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(170, X.measureText(t(label)).width + 24);
  X.beginPath(); X.moveTo(x - 8, y + 11); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 11); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(330, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 330); X.restore();
}
function spiral(x, y, r, rot) { X.beginPath(); for (let a = 0; a < 12; a += .3) { const rad = r * a / 12; X.lineTo(x + Math.cos(a + rot) * rad, y + Math.sin(a + rot) * rad); } X.lineWidth = Math.max(1.5, r * .22); X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); }

/* the hen (seen from behind/side), u = height in px; peck 0..1; flap amplitude */
function hen(x, y, u, T, ph, flap, flip) {
  X.save(); X.translate(x, y); X.scale(u * (flip || 1) / 40, u / 40);
  const pk = Math.sin(T * 6 + ph) * 3, fl = flap ? Math.sin(T * 24 + ph) * flap : 0;
  X.beginPath(); X.moveTo(-3, 0); X.lineTo(-5, 8); X.moveTo(5, 0); X.lineTo(7, 8); X.lineWidth = 3; X.strokeStyle = '#ffb23d'; X.stroke();
  line([[-3, 0], [-5, 8]], 3, '#ffb23d'); line([[5, 0], [7, 8]], 3, '#ffb23d');
  cel('#fff6e0', '#d7cdb2', () => el(0, -14, 21, 16), 5, -4, 3);
  cel('#fff6e0', '#d7cdb2', () => { X.beginPath(); X.moveTo(-18, -18); X.lineTo(-30, -30 + fl); X.lineTo(-24, -10); X.closePath(); }, 2, -2, 2.5);
  cel('#fff6e0', '#d7cdb2', () => el(-3, -12 - fl * .3, 10, 7, -.4 - fl * .02), 2, -2, 2.5);
  cel('#fff6e0', '#d7cdb2', () => el(17, -29 + pk * .3, 8, 8), 2, -2, 2.5);
  X.beginPath(); X.moveTo(23, -31 + pk * .3); X.lineTo(32, -28 + pk); X.lineTo(23, -26 + pk * .3); X.closePath(); ink('#ff9f1a', 2);
  for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(13 + i * 4, -38 + pk * .3 - (i === 1 ? 2 : 0), 3.2, 0, TAU); ink('#e8434f', 2); }
  X.fillStyle = INK; X.beginPath(); X.arc(20, -30 + pk * .3, 1.8, 0, TAU); X.fill();
  X.restore();
}
function dog(x, y, u, T, run, flip) {                       // a stray dog, side view, u = body length px
  X.save(); X.translate(x, y); X.scale(u * (flip || 1) / 60, u / 60);
  const sw = Math.sin(T * 16) * 6 * run;
  line([[-18, -4], [-18 + sw, 10]], 5, '#7a4a2c'); line([[18, -4], [18 - sw, 10]], 5, '#7a4a2c'); line([[-8, -4], [-8 - sw, 10]], 5, '#8d5a35'); line([[8, -4], [8 + sw, 10]], 5, '#8d5a35');
  line([[-27, -22], [-36, -32 + Math.sin(T * 10) * 4]], 5, '#8d5a35');
  cel('#c58a52', '#9a6a3a', () => el(0, -16, 30, 14), 5, -4, 3);
  X.fillStyle = '#6a4326'; el(-8, -20, 9, 6); X.fill();
  cel('#c58a52', '#9a6a3a', () => el(30, -26, 13, 11), 3, -3, 3);
  cel('#7a4a2c', '#5c341c', () => el(24, -34, 5, 9, .6), 1, -1, 2.5);
  cel('#7a4a2c', '#5c341c', () => el(42, -22, 7, 5), 1, -1, 2.5);
  X.fillStyle = INK; X.beginPath(); X.arc(33, -29, 2.2, 0, TAU); X.fill(); X.beginPath(); X.arc(47, -23, 2, 0, TAU); X.fill();
  X.restore();
}
function bumpCan(x, y, s) {                                   // not a hazard: a gas cylinder (bombona) on the sack, for the gag
  X.save(); X.translate(x, y); X.scale(s, s);
  cel('#e8434f', '#b02a3a', () => rr(-12, -34, 24, 34, 8), 4, -2, 2.5); rr(-5, -42, 10, 9, 3); ink('#9a9fb2', 2.5);
  X.restore();
}

/* ═════════ the game ═════════ */
function duMototaxi(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), driver = D.role === 0, TS = Math.sqrt(sp);
  const VM = VMAX * TS, AC = ACC * TS * TS, BR = BRK * TS * TS, DR = DRAG * TS * TS, LS = LSPD * TS, VS = VSTEP * TS;
  /* ----- the level (identical draws on both screens): a safe line the obstacles keep clear of, so it can always be dodged ----- */
  const obs = []; let safe = 0;
  for (let i = 0; i < NOBS; i++) {
    const kind = KIND[i], p = 320 + i * (LEN - 520) / NOBS + (R() - .5) * 30, o = { i, kind, p, x: 0, r: kind === 'gallina' ? .3 : .42, done: false, ph: Math.floor(R() * 20), t0: 0 };
    if (kind === 'bache' || kind === 'gallina') {
      safe = clamp(safe + (R() - .5) * 1.6, -1.05, 1.05); if (Math.abs(safe) < .3) safe = (R() < .5 ? -1 : 1) * (.45 + R() * .3);   // keep off the centre so a driver alone gets hit
      let sg = R() < .5 ? -1 : 1; const off = .95 + R() * .35;
      if (Math.abs(safe + sg * off) > 1.5) sg = -sg;
      if (i === 0) { safe = .7; sg = -1; }
      o.x = clamp(safe + sg * off, -1.5, 1.5);
    }
    if (kind === 'perro') o.t0 = o.p / (VMAX * .85) - 1.1 + R() * .5;      // the dog starts crossing about when the moto would arrive (u-time)
    obs.push(o);
  }
  const dogX = (o, u) => -DOGX + 2 * DOGX * clamp((u - o.t0) / DOGT, 0, 1);
  const DOGT = DOGD;
  /* ----- state ----- */
  const pops = [], dust = [];
  let held = false, P = 0, x = 0, v = 0, hits = 0, lean = 0, bank = 0, hitAt = -9, sSent = -9, lastS = '', resAt = -1, goT = 0;   // driver (lean = what the passenger sends)
  const kGo = new Set(); let kL = false, kR = false;
  let xT = 0, lSent = -9, lastL = '', pView = 0, xView = 0, vView = 0, hView = 0, recvP = 0, recvX = 0, recvV = 0, recvT = -1, kickAt = -9;   // passenger (xT = my lean)
  const toX = px => clamp((px - 400) / 320 * XM, -XM, XM);
  const uT = () => g.c * TS;
  const pop = (s, px, py, size, bgc, fg) => { pops.push({ s, x: px, y: py, size, bgc, fg, t0: g.c, rot: (hsh(g.c * 9) - .5) * .14 }); if (pops.length > 3) pops.shift(); };
  const puff = (px, py, n) => { for (let i = 0; i < n; i++) dust.push({ x: px + (hsh(i + g.c) - .5) * 60, y: py, vx: (hsh(i * 3 + g.c) - .5) * 260, vy: -80 - hsh(i * 7 + g.c) * 240, t0: g.c, life: .7 + hsh(i) * .4, r: 5 + hsh(i * 5) * 8, feather: hsh(i * 11 + g.c) < .35 }); };

  const g = {
    c: 0, dur: 15, pts: 0, gyro: !driver,
    cmd: driver ? 'CLIMB!' : 'LEAN!', roleLabel: driver ? 'DRIVER' : 'PASSENGER',
    hint: driver ? 'HOLD (MOUSE OR SPACE) TO GO, RELEASE TO BRAKE. YOU ONLY SEE THE STREET RIGHT IN FRONT: LISTEN TO YOUR FRIEND, WHO SEES THE DOGS AND STEPS COMING!' : 'LEAN WITH THE MOUSE, A D OR YOUR PHONE TO STEER THE MOTO. YOU SEE THE WHOLE STREET: WARN THE DRIVER ABOUT DOGS AND STEPS!',
    thint: driver ? 'HOLD TO GO, RELEASE TO BRAKE. YOU ONLY SEE THE STREET RIGHT IN FRONT: LISTEN TO YOUR FRIEND' : 'TILT YOUR PHONE (OR DRAG) TO LEAN AND STEER THE MOTO. YOU SEE THE WHOLE STREET: WARN THE DRIVER',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) {
        resAt = T;
        if (g.result === 'win') sfx.sparkle && sfx.sparkle(); else if (!driver) { sfx.pop(); }
      }
      for (let i = dust.length - 1; i >= 0; i--) { const b = dust[i]; b.vy += 700 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) dust.splice(i, 1); }
      if (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      if (driver) {
        const done = !!g.result, go = (held || kGo.size > 0) && !done;
        goT += ((go ? 1 : 0) - goT) * Math.min(1, dt * 14);
        if (done) { if (g.result === 'win') v = Math.max(0, v - BR * .4 * dt); else v = 0; }
        else if (go) v = Math.min(VM, v + AC * dt); else v = Math.max(0, v - (v > 0 ? BR : DR) * dt);
        const P0 = P, x0 = x; P += v * dt;
        x += clamp(clamp(lean, -XM, XM) - x, -LS * dt, LS * dt); bank += ((x - x0) / Math.max(dt, 1e-4) / LS * .12 - bank) * Math.min(1, dt * 8);
        if (!done) {
          for (const o of obs) {
            if (o.done || !(P0 < o.p && P >= o.p)) continue;
            o.done = true; let bad = false;
            if (o.kind === 'escalon') bad = v < VS;
            else if (o.kind === 'perro') bad = Math.abs(dogX(o, uT()) - x) < .55 + HW;
            else bad = Math.abs(o.x - x) < o.r + HW;
            if (bad) {
              hits++; hitAt = T; v = 0; P = o.p - 4; sfx.thud(); sfx.miss(); noise && noise(.25, .1, 600, 150, 'lowpass'); shake(9, .3); puff(400, 470, 16);
              pop(o.kind === 'escalon' ? 'STALLED!' : o.kind === 'perro' ? 'WOOF!' : o.kind === 'gallina' ? 'BAWK!' : 'BUMP!', 400, 260, 30, '#e8434f', '#fff');
              if (hits >= MAXHIT) { g.finish('lose'); break; }
            } else if (o.kind === 'escalon') { sfx.click && sfx.click(); }
          }
          if (!g.result && P >= LEN) { sfx.coin(); g.finish('win'); }
          else if (!g.result && T >= g.limit) g.finish('lose');
        }
        const sm = Math.round(P) + ',' + Math.round(x * 100) + ',' + Math.round(v) + ',' + hits;
        if (sm !== lastS && T - sSent >= .08) { lastS = sm; sSent = T; D.send('s', [Math.round(P), Math.round(x * 100), Math.round(v), hits], true); }
        if (!done && v > 40 && hsh(T * 40) < .25) dust.push({ x: 400 + (hsh(T) - .5) * 200, y: 520, vx: (hsh(T * 3) - .5) * 100, vy: -40, t0: T, life: .45, r: 4, feather: false });
      } else {
        if (kL) xT = Math.max(-XM, xT - 2.4 * TS * dt); if (kR) xT = Math.min(XM, xT + 2.4 * TS * dt);
        if (recvT >= 0) { const pe = recvP + recvV * Math.min(.4, T - recvT); pView += (Math.max(pView, pe) - pView) * Math.min(1, dt * 10); xView += (recvX - xView) * Math.min(1, dt * 12); vView += (recvV - vView) * Math.min(1, dt * 10); hView = Math.max(hView, hitsRecv); }
        bank += ((xT - xView) * .1 - bank) * Math.min(1, dt * 6);
        const lm = String(Math.round(xT * 100));
        if (!g.result && ((lm !== lastL && T - lSent >= .06) || T - lSent >= .4)) { lastL = lm; lSent = T; D.send('l', Math.round(xT * 100), true); }
      }
    },
    msg(type, d) {
      if (driver) { if (type === 'l' && typeof d === 'number') lean = clamp(d / 100, -XM, XM); }
      else if (type === 's' && Array.isArray(d)) {
        if (d[0] >= recvP) { recvP = d[0]; recvX = d[1] / 100; recvV = d[2]; recvT = g.c; }
        if (d[3] > hitsRecv) { hitsRecv = d[3]; kickAt = g.c; sfx.thud && sfx.thud(); shake(7, .25); pop('OUCH!', 400, 300, 28, '#e8434f', '#fff'); }
      }
    },
    /* ───────── drawing ───────── */
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (driver) drawDriver(T, won, lost, rk); else drawPassenger(T, won, lost, rk);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .85 ? Math.max(0, 1 - (a - .85) / .25) : 1; badge(q.s, clamp(q.x, 150, 650), Math.max(120, q.y - Math.min(a, .6) * 18), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(driver ? 'TALK TO YOUR FRIEND!' : 'WARN THE DRIVER!', 400, 250, 20, driver ? '#2b9ee6' : '#c98a12', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
    down(p) { if (driver) { held = true; return; } xT = toX(p.x); },
    move(p) { if (!driver) xT = toX(p.x); },
    up() { held = false; },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (driver) { if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') kGo.add(c); }
      else if (c === 'ArrowLeft' || c === 'KeyA') kL = true; else if (c === 'ArrowRight' || c === 'KeyD') kR = true;
    },
    keyup(e) { kGo.delete(e.code); if (e.code === 'ArrowLeft' || e.code === 'KeyA') kL = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') kR = false; },
  };
  let hitsRecv = 0;

  /* ----- shared scene pieces ----- */
  const sc = (C, d) => { const s = 1 / (1 + Math.max(0, d) / C.K); return { s, y: C.HZ + (C.YB - C.HZ) * s, u: C.LW * s }; };
  function roadScene(C, Pn, cam, T) {
    const SPB = 90, n0 = Math.floor(Pn / SPB), ex = (xu, s) => 400 + (xu - cam) * C.LW * s;
    X.fillStyle = '#6a5d7c'; X.fillRect(0, C.HZ, W, H - C.HZ);                     // base under the road
    for (let k = 26; k >= 0; k--) {
      const dn = k * SPB - (Pn % SPB), df = dn + SPB; if (df < 0) continue;
      const a = sc(C, Math.max(0, dn)), b = sc(C, df), par = (n0 + k) & 1;
      X.fillStyle = par ? '#8d88a4' : '#9893ad'; X.beginPath(); X.moveTo(ex(-ROAD, a.s), a.y); X.lineTo(ex(ROAD, a.s), a.y); X.lineTo(ex(ROAD, b.s), b.y); X.lineTo(ex(-ROAD, b.s), b.y); X.closePath(); X.fill();
      for (const sd of [-1, 1]) {                                                    // painted curb
        X.fillStyle = par ? '#ffd23f' : '#f4f0e6'; X.beginPath(); X.moveTo(ex(sd * ROAD, a.s), a.y); X.lineTo(ex(sd * (ROAD + .28), a.s), a.y); X.lineTo(ex(sd * (ROAD + .28), b.s), b.y); X.lineTo(ex(sd * ROAD, b.s), b.y); X.closePath(); X.fill();
      }
      if (par) { X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.moveTo(ex(-.07, a.s), a.y); X.lineTo(ex(.07, a.s), a.y); X.lineTo(ex(.07, b.s), b.y); X.lineTo(ex(-.07, b.s), b.y); X.closePath(); X.fill(); }
    }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(ex(-ROAD - .28, 1), C.YB + 140); for (const d of [0, 100, 300, 800, 2400]) { const q = sc(C, d); X.lineTo(ex(-ROAD - .28, q.s), q.y); } X.stroke();
    X.beginPath(); X.moveTo(ex(ROAD + .28, 1), C.YB + 140); for (const d of [0, 100, 300, 800, 2400]) { const q = sc(C, d); X.lineTo(ex(ROAD + .28, q.s), q.y); } X.stroke();
    // poles along the street
    const pn = Math.floor(Pn / 210);
    for (let k = 8; k >= 0; k--) for (const sd of [-1, 1]) {
      const d = (pn + k) * 210 + (sd > 0 ? 105 : 0) - Pn; if (d < 0 || d > 2000) continue;
      const q = sc(C, d), px = ex(sd * (ROAD + .75), q.s);
      line([[px, q.y], [px, q.y - 1.9 * q.u]], Math.max(2, q.u * .09), '#6f5a40'); line([[px - .35 * q.u, q.y - 1.6 * q.u], [px + .35 * q.u, q.y - 1.6 * q.u]], Math.max(1.5, q.u * .05), '#6f5a40');
    }
    return ex;
  }
  function drawObs(C, o, q, ex, T, near) {
    const sx = ex(o.x, q.s), u = q.u, sy = q.y;
    if (o.kind === 'bache') {
      const r = o.r * u;
      el(sx, sy, r * 1.15, r * .4); ink('#3a3250', Math.max(1.5, u * .035), '#2a2438'); X.fillStyle = '#241f33'; el(sx + r * .08, sy + r * .06, r * .8, r * .26); X.fill(); glint(sx - r * .45, sy - r * .1, r * .22, r * .06, -.15, .35);
      for (let k = 0; k < 4; k++) { X.fillStyle = '#7a738f'; el(sx + (k - 1.5) * r * .6, sy + r * .45, Math.max(1, u * .04), Math.max(.5, u * .014)); X.fill(); }
    } else if (o.kind === 'gallina') {
      X.fillStyle = 'rgba(20,16,28,.28)'; el(sx, sy, u * .32, u * .08); X.fill(); hen(sx, sy, u * .9, T, o.ph, 0, o.i & 1 ? 1 : -1);
    } else if (o.kind === 'escalon') {
      const h = u * .26, w = ROAD + .28;
      X.beginPath(); X.rect(ex(-w, q.s), sy - h, 2 * w * u, h); X.save(); X.clip(); X.fillStyle = '#d2cdde'; X.fillRect(ex(-w, q.s), sy - h, 2 * w * u, h); X.fillStyle = '#a49fb8'; X.fillRect(ex(-w, q.s), sy - h * .35, 2 * w * u, h * .35); X.restore();
      X.beginPath(); X.rect(ex(-w, q.s), sy - h, 2 * w * u, h); X.lineWidth = Math.max(2, u * .06); X.strokeStyle = INK; X.stroke();
      X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(ex(-w, q.s) + 6, sy - h + 2, 2 * w * u - 12, Math.max(1.5, h * .15));
      X.fillStyle = '#ffd23f'; for (let k = -3; k <= 3; k++) { X.beginPath(); X.moveTo(ex(k * .5, q.s) - u * .1, sy); X.lineTo(ex(k * .5, q.s) + u * .1, sy); X.lineTo(ex(k * .5, q.s) + u * .2, sy - h * .5); X.lineTo(ex(k * .5, q.s), sy - h * .5); X.closePath(); X.fill(); }
    } else if (o.kind === 'perro') {
      const dxu = dogX(o, uT()), moving = dxu > -DOGX + .01 && dxu < DOGX - .01;
      const px = ex(dxu, q.s); if (px < -100 || px > 900) return;
      X.fillStyle = 'rgba(20,16,28,.28)'; el(px, sy, u * .5, u * .1); X.fill(); dog(px, sy, u * 1.05, T, moving ? 1 : 0, 1);
      if (!moving && dxu < 0 && near) { X.fillStyle = '#fff'; txt('...', px, sy - u * .9, Math.max(10, u * .35), '#fff'); }
    }
  }
  function summit(C, Pn, cam) {
    const d = LEN + 40 - Pn; if (d > 2400 || d < -300) return;
    const q = sc(C, Math.max(0, d)), u = q.u, ex = xu => 400 + (xu - cam) * C.LW * q.s, y = q.y, lw = Math.max(2, u * .06);
    for (const sd of [-1, 1]) { cel('#c9c3da', '#9a94b0', () => rr(ex(sd * 2.3) - u * .22, y - 2.6 * u, u * .44, 2.6 * u, u * .06), u * .06, 0, lw); }
    cel('#e8434f', '#b02a3a', () => rr(ex(-2.45), y - 3.2 * u, 4.9 * u, 0.9 * u, u * .15), u * .2, -u * .05, lw);
    txt('LA CIMA', ex(0), y - 2.75 * u, Math.max(8, u * .6), '#fff', 'center', 4.5 * u);
    for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { const fx = ex(sd * 2.4) + sd * (k + 1) * u * .3; X.beginPath(); X.moveTo(fx, y - 3.2 * u); X.lineTo(fx + u * .12, y - 2.9 * u + Math.sin(uT() * 6 + k) * 2); X.lineTo(fx - u * .12, y - 2.9 * u); X.closePath(); ink(['#ffd23f', '#2f6fd6', '#e8434f'][k % 3], Math.max(1, u * .02)); }
  }
  function progress(pr) {
    const x0 = 250, w = 300, y = 30;
    rr(x0, y - 14, w, 30, 10); ink('#c98f4e', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; rr(x0 + 8, y - 11, w - 16, 5, 2.5); X.fill();
    X.beginPath(); X.moveTo(x0 + 18, y + 8); X.lineTo(x0 + w - 18, y - 8); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#a49fb8'; X.stroke();
    el(x0 + w - 16, y - 12, 9, 7); ink('#e8434f', 2);
    const bx = x0 + 18 + clamp(pr, 0, 1) * (w - 36), by = y + 8 - clamp(pr, 0, 1) * 16;
    el(bx, by - 6, 8, 6); ink('#ffd23f', 2.5);
  }
  function hearts(x0, y0, n, col) {
    for (let k = 0; k < MAXHIT; k++) { const on = k < MAXHIT - n, cx = x0 + k * 34; X.save(); X.translate(cx, y0); X.beginPath(); X.moveTo(0, 9); X.bezierCurveTo(-18, -4, -12, -18, 0, -8); X.bezierCurveTo(12, -18, 18, -4, 0, 9); X.closePath(); ink(on ? col : '#5b546b', 3); X.restore(); }
  }
  function motoBack(cx, cy, sz, roll, T, rider, pas) { /* a mototaxi seen from behind-ish: used only in the finale */
    X.save(); X.translate(cx, cy); X.rotate(roll); X.scale(sz, sz);
    el(0, 4, 26, 9); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
    cel('#22202c', '#0f0e16', () => rr(-9, -50, 18, 54, 8), 2, 0, 3);                        // wheel seen edge-on
    cel('#ffb23d', '#d0801a', () => rr(-26, -70, 52, 28, 9), 6, -2, 3);                       // seat/body
    cel('#e8434f', '#b02a3a', () => rr(-30, -90, 60, 26, 9), 6, -2, 3);
    line([[-44, -86], [44, -86]], 6, '#9a9fb2');
    el(-44, -86, 6, 6); ink(rider, 2.5); el(44, -86, 6, 6); ink(rider, 2.5);
    X.restore();
  }

  /* ═════ driver: first person over the handlebars ═════ */
  let DBG = null;
  function bakeD() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
    const sk = X.createLinearGradient(0, 0, 0, PD.HZ); sk.addColorStop(0, '#6ec1ff'); sk.addColorStop(1, '#ffe9bd'); X.fillStyle = sk; X.fillRect(0, 0, W, PD.HZ);
    X.beginPath(); X.arc(630, 70, 30, 0, TAU); ink('#ffe14d', 4); glint(621, 61, 10, 6, -.6, .8);
    barrio(PD.HZ);
    X = old; return cv;
  }
  function barrio(hz) {                                    // the hillside: stacked ranchitos on both sides, a clothesline gag
    X.fillStyle = '#c9744a'; X.fillRect(0, hz, W, H - hz);
    const cols = ['#ff9f43', '#4db8ff', '#ff6fb1', '#ffd23f', '#5CFF7A', '#c78bff', '#ff7a59'], zinc = ['#b8b4c8', '#a49fb8'];
    for (const sd of [-1, 1]) for (let row = 7; row >= 0; row--) for (let k = 0; k < 4; k++) {
      const s = .35 + row * .22, w = 78 * s * (.8 + .4 * hsh(row * 9 + k + sd)), h = 62 * s * (.8 + .4 * hsh(row * 5 + k * 2)), bx = sd < 0 ? 12 + k * (w * .85) + row * 6 : W - 12 - k * (w * .85) - row * 6 - w;
      const by = hz + 16 + row * (H - hz) / 10 + (k % 2) * 10; if (by > H - 30) continue;
      const c = cols[(row * 3 + k + (sd > 0 ? 2 : 0)) % cols.length];
      cel(c, 'rgba(0,0,0,.2)', () => rr(bx, by - h, w, h, 3), -w * .14, 0, Math.max(2, 3 * s));
      X.beginPath(); X.moveTo(bx - 4 * s, by - h); X.lineTo(bx + w + 4 * s, by - h); X.lineTo(bx + w, by - h - 14 * s); X.lineTo(bx, by - h - 14 * s); X.closePath(); ink(zinc[(k + row) & 1], Math.max(2, 3 * s));
      rr(bx + w * .15, by - h * .7, w * .24, h * .32, 2); ink('#243556', Math.max(1.5, 2 * s)); rr(bx + w * .58, by - h * .6, w * .22, h * .6, 2); ink('#7a4a2c', Math.max(1.5, 2 * s));
    }
    if (hz < 200) { line([[20, hz + 70], [240, hz + 85]], 3, '#e6c58c'); for (let k = 0; k < 5; k++) { const cx = 50 + k * 42, cy = hz + 73 + k * 3; X.beginPath(); X.moveTo(cx, cy); X.lineTo(cx + 12, cy); X.lineTo(cx + 12, cy + 16); X.lineTo(cx, cy + 16); X.closePath(); ink(['#fff', '#ff6fb1', '#fff', '#4db8ff', '#fff'][k], 2); } }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, hz); X.lineTo(W, hz); X.stroke();
  }
  function drawDriver(T, won, lost, rk) {
    if (!DBG) DBG = bakeD();
    X.save();
    const roll = lost && rk >= 0 ? Math.min(rk, 1.1) * 3.4 : 0;
    if (roll) { X.translate(400, 520); X.rotate(roll); X.translate(-400, -520 + Math.min(1, rk) * 120); }
    ctx.drawImage(DBG, 0, 0);
    for (const [sx0, y, s] of [[60, 60, .8], [420, 100, .6]]) { X.save(); X.translate(((T * 8 + sx0) % 980) - 120, y); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink('#fff', 3, '#9ab6d8'); } X.restore(); }
    const cam = x * .7, ex = roadScene(PD, P, cam, T);
    const items = [];
    for (const o of obs) { const d = o.p - P; if (d > -40 && d < SEE_D + 40) items.push({ d, o }); }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) {
      const q = sc(PD, Math.max(0, it.d)); X.globalAlpha = it.d > SEE_D ? clamp(1 - (it.d - SEE_D) / 40, 0, 1) : 1;
      if (it.d < 0) { const k = -it.d / 40; X.globalAlpha = 1 - k; }
      drawObs(PD, it.o, it.d < 0 ? sc(PD, 0) : q, ex, T, true); X.globalAlpha = 1;
    }
    // the hill hides what is further ahead: a haze band on the horizon
    const hz = X.createLinearGradient(0, PD.HZ, 0, PD.HZ + 120); hz.addColorStop(0, 'rgba(255,233,189,1)'); hz.addColorStop(1, 'rgba(255,233,189,0)'); X.fillStyle = hz; X.fillRect(0, PD.HZ + 2, W, 118);
    summit(PD, P, cam);
    for (const b of dust) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); if (b.feather) { X.save(); X.translate(b.x, b.y); X.rotate(a * 8); el(0, 0, 12, 4); ink('#fff6e0', 2); X.restore(); } else { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink('#d9cfc0', 2, '#8a7a68'); } X.globalAlpha = 1; }
    X.restore();
    // handlebars + dashboard
    const col = myCol(), jig = Math.sin(T * 30) * v / VM * 1.2, hy = 640 + jig;
    X.save(); X.translate(400, hy); X.rotate(bank * 1.4);
    line([[-300, -150], [-120, -120], [120, -120], [300, -150]], 20, '#3a3550');
    // dial
    X.beginPath(); X.arc(0, -150, 70, 0, TAU); ink('#2c2a3a', 5);
    X.beginPath(); X.arc(0, -150, 58, Math.PI * .75, Math.PI * 2.25); X.lineWidth = 12; X.strokeStyle = '#5b546b'; X.lineCap = 'butt'; X.stroke();
    const a0 = Math.PI * .75, span = Math.PI * 1.5, ak = VS / VM;
    X.beginPath(); X.arc(0, -150, 58, a0 + span * ak, a0 + span); X.strokeStyle = '#5CFF7A'; X.stroke();
    X.beginPath(); X.arc(0, -150, 58, a0, a0 + span * ak); X.strokeStyle = '#ff5c5c'; X.stroke();
    const na = a0 + span * clamp(v / VM, 0, 1); line([[0, -150], [Math.cos(na) * 52, -150 + Math.sin(na) * 52]], 5, '#fff'); X.beginPath(); X.arc(0, -150, 8, 0, TAU); ink('#ffd23f', 2.5);
    txt('ESCALÓN', 0, -108, 11, '#cfcfe0', 'center', 70);
    hearts(-52, -184, hits, '#ff5c8a');
    // grips + hands
    for (const sd of [-1, 1]) {
      const gx = sd * 300, gy = -150, tw = sd > 0 ? goT * 8 : 0;
      rr(gx - 28, gy - 22 + tw * .3, 56, 44, 14); ink('#22202c', 4);
      X.fillStyle = col; rr(gx - 24, gy - 40 - tw, 48, 38, 12); X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(gx - 16, gy - 34 - tw, 14, 8);
    }
    X.restore();
    // rear-view mirror with the passenger and the hen
    mirror(690, 505, T, won, lost, rk);
    if (T < 3.5 && !g.result) pill(400, 400, 'YOU', col);
    if (T < 3 && !g.result) DUO.demoFinger(400, 560 + Math.sin(T * 5) * 3, true, (T * 2) % 1);
    progress(P / LEN);
    if (won && rk >= 0) {
      for (let i = 0; i < 3; i++) { const q = (rk * 1.4 + i / 3) % 1; X.globalAlpha = (1 - q) * .8; X.lineWidth = 5; X.strokeStyle = '#fff'; X.beginPath(); X.arc(400, 470, 40 + q * 220, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); X.globalAlpha = 1; }
      badge('THE TOP!', 400, 300, 56, '#ffb23d', '#fff', outBack(rk / .28) * (rk > 2.4 ? Math.max(0, 1 - (rk - 2.4) * 2) : 1), -.06);
      if (rk > .45) badge('DIZZY PASSENGER!', 400, 372, 28, '#2fa84a', '#fff', outBack((rk - .45) / .22), .05);
    }
    if (lost && rk >= 0) {
      if (hits >= MAXHIT) { badge('IT FLIPPED!', 400, 300, 52, '#e8434f', '#fff', outBack(rk / .22), -.07); if (rk > .5) badge('ROLLING DOWNHILL...', 400, 372, 26, '#7e5bd6', '#fff', outBack((rk - .5) / .22), .04); }
      else badge('TOO SLOW!', 400, 320, 50, '#e8434f', '#fff', outBack(rk / .22), -.05);
    }
  }
  function mirror(mx, my, T, won, lost, rk) {
    const pc = (D.partner && D.partner.color) || '#6EA8FE';
    X.save(); X.beginPath(); X.arc(mx, my, 62, 0, TAU); X.fillStyle = INK; X.fill(); X.beginPath(); X.arc(mx, my, 54, 0, TAU); X.clip();
    X.fillStyle = '#bfe3ff'; X.fillRect(mx - 60, my - 60, 120, 120); X.fillStyle = '#e9b27a'; X.fillRect(mx - 60, my + 28, 120, 40);
    const dz = won && rk >= 0;
    X.translate(mx, my + 30); caos(0, 20, 3.2, { col: pc, mood: lost ? 'sad' : dz ? null : null });
    if (dz) { spiral(-9, -14, 7, T * 8); spiral(9, -14, 7, -T * 8); }
    if (!lost) hen(-26, 18 + Math.sin(T * 7) * 1.5, 28, T, 3, v > 50 ? 3 : 0, 1);
    X.restore(); X.beginPath(); X.arc(mx, my, 54, 0, TAU); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.7)'; X.setLineDash([6, 10]); X.stroke(); X.setLineDash([]);
    glint(mx - 28, my - 30, 12, 5, -.7, .6);
    if (T < 3.5 && !g.result) pill(mx, my - 78, 'YOUR FRIEND', pc);
  }

  /* ═════ passenger: over the driver's shoulder ═════ */
  let PBG = null;
  function bakeP() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
    const sk = X.createLinearGradient(0, 0, 0, PP.HZ); sk.addColorStop(0, '#6ec1ff'); sk.addColorStop(1, '#ffe9bd'); X.fillStyle = sk; X.fillRect(0, 0, W, PP.HZ);
    X.beginPath(); X.arc(130, 70, 28, 0, TAU); ink('#ffe14d', 4); glint(122, 62, 10, 6, -.6, .8);
    for (const [cx, w, h, c] of [[200, 260, 70, '#9ccfa0'], [600, 320, 90, '#8fc79a']]) { X.beginPath(); X.moveTo(cx - w, PP.HZ); X.quadraticCurveTo(cx - w * .3, PP.HZ - h * 1.5, cx, PP.HZ - h); X.quadraticCurveTo(cx + w * .4, PP.HZ - h * 1.3, cx + w, PP.HZ); X.closePath(); X.fillStyle = c; X.fill(); }
    barrio(PP.HZ);
    X = old; return cv;
  }
  function drawPassenger(T, won, lost, rk) {
    if (!PBG) PBG = bakeP();
    X.save();
    const roll = lost && rk >= 0 ? Math.min(rk, 1.1) * 3.4 : 0;
    if (roll) { X.translate(400, 520); X.rotate(roll); X.translate(-400, -520 + Math.min(1, rk) * 120); }
    ctx.drawImage(PBG, 0, 0);
    for (const [sx0, y, s] of [[300, 60, .8], [620, 100, .6]]) { X.save(); X.translate(((T * 8 + sx0) % 980) - 120, y); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink('#fff', 3, '#9ab6d8'); } X.restore(); }
    const cam = xView * .7, ex = roadScene(PP, pView, cam, T);
    const items = [];
    for (const o of obs) { const d = o.p - pView; if (d > SEE_P0 - 60 && d < 2200) items.push({ d, o }); }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) {
      const q = sc(PP, Math.max(0, it.d)); X.globalAlpha = it.d < SEE_P0 ? clamp((it.d - SEE_P0 + 60) / 60, 0, 1) : 1; if (q.s < .04) { X.globalAlpha = 1; continue; }
      drawObs(PP, it.o, q, ex, T, false);
      if (it.d > 100 && it.d < SEE_P1 && !g.result) {                       // a little arrow so far-off obstacles are never missed
        const sx = ex(it.o.kind === 'perro' || it.o.kind === 'escalon' ? 0 : it.o.x, q.s), by = q.y - q.u * (it.o.kind === 'escalon' ? 1.0 : 1.2);
        X.globalAlpha *= .9; X.beginPath(); X.moveTo(sx - 6, by - 14); X.lineTo(sx + 6, by - 14); X.lineTo(sx, by - 2); X.closePath(); ink(it.o.kind === 'perro' ? '#ff9f1a' : it.o.kind === 'escalon' ? '#4db8ff' : '#ff5c5c', 2);
      }
      X.globalAlpha = 1;
    }
    summit(PP, pView, cam);
    for (const b of dust) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); if (b.feather) { X.save(); X.translate(b.x, b.y); X.rotate(a * 8); el(0, 0, 12, 4); ink('#fff6e0', 2); X.restore(); } else { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink('#d9cfc0', 2, '#8a7a68'); } X.globalAlpha = 1; }
    X.restore();
    // the driver's back (the only thing that hides the very near street) and my arms on their shoulders
    const pcol = (D.partner && D.partner.color) || '#6EA8FE', mc = myCol(), won2 = won && rk >= 0;
    const bob = Math.sin(T * 9) * vView / VM * 2;
    X.save(); X.translate(400, 560 + bob); X.rotate(bank * 1.2 + (kickAt > 0 && T - kickAt < .3 ? Math.sin((T - kickAt) * 40) * .05 : 0));
    cel(pcol, 'rgba(0,0,0,.22)', () => rr(-120, -150, 240, 220, 44), -30, 0, 5);
    cel('#ffd23f', '#d0a01a', () => { X.beginPath(); X.arc(0, -178, 62, 0, TAU); }, -14, -8, 5);
    rr(-62, -190, 124, 18, 6); ink('#2c2a3a', 3);
    rr(-38, -90, 76, 34, 6); ink('#fff6e0', 3); txt('MOTOTAXI', 0, -73, 15, INK, 'center', 66);
    for (const sd of [-1, 1]) { line([[sd * 150, 62], [sd * 112, -120]], 26, mc); X.beginPath(); X.arc(sd * 108, -126, 20, 0, TAU); ink(mc, 4); }
    X.restore();
    // the sack with the hen on my lap (bombona poking out too)
    X.save(); X.translate(150, 580 + bob); X.rotate(-.1 + bank * .5);
    cel('#d9b77a', '#a8864c', () => { X.beginPath(); X.moveTo(-70, 20); X.quadraticCurveTo(-90, -40, -40, -60); X.lineTo(40, -60); X.quadraticCurveTo(90, -40, 70, 20); X.closePath(); }, 12, -6, 4);
    hen(0, -50, 82, T, 1, vView > 40 ? 5 : 0, 1);
    X.restore();
    bumpCan(700, 585, 1.9);
    // lean indicator (what my body is doing): a world sticker on the sack side
    const mx = 400 + clamp(xT / XM, -1, 1) * 150;
    rr(250, 570, 300, 18, 9); ink('#243556', 3); X.fillStyle = '#5b546b'; X.fillRect(396, 574, 8, 10);
    el(mx, 579, 17, 15); ink(mc, 3.5); glint(mx - 6, 574, 4, 3, 0, .7);
    txt('◄', 232, 580, 22, '#fff'); txt('►', 568, 580, 22, '#fff');
    if (T < 3.5 && !g.result) pill(400, 380, 'YOU', mc);
    if (T < 3 && !g.result) DUO.demoFinger(mx, 592 + Math.sin(T * 5) * 3, true, (T * 2) % 1);
    progress(pView / LEN);
    hearts(70, 40, hView, '#ff5c8a');
    if (won2) {
      const sway = Math.sin(rk * 5) * 24;
      X.save(); X.translate(400 + sway, 470); X.rotate(Math.sin(rk * 5) * .15);
      caos(0, 0, 5.4, { col: mc, mood: null });
      spiral(-15, -33, 10, rk * 9); spiral(15, -33, 10, -rk * 9);
      hen(0, -72, 56, T, 2, 6, 1);
      for (let i = 0; i < 4; i++) star(Math.cos(rk * 5 + i * 1.57) * 50, -95 + Math.sin(rk * 5 + i * 1.57) * 12, 8, 3.5, 5, rk * 3, '#ffe14d', 2);
      X.restore();
      badge('THE TOP!', 400, 250, 52, '#ffb23d', '#fff', outBack(rk / .28) * (rk > 2.4 ? Math.max(0, 1 - (rk - 2.4) * 2) : 1), -.06);
      if (rk > .45) badge('I FEEL DIZZY...', 400, 320, 30, '#2fa84a', '#fff', outBack((rk - .45) / .22), .05);
    }
    if (lost && rk >= 0) {
      if (hView >= MAXHIT || rk > 0) {
        const k = ease(rk / .6), hx = 400 + Math.sin(rk * 4) * 120, hyy = lerp(560, 220, k) - Math.sin(Math.min(1, rk / 1.2) * Math.PI) * 120;
        hen(hx, hyy + 60, 70, T, 1, 9, 1); star(hx, hyy, 40 * Math.min(1, rk * 6), 18, 8, rk * 2, '#ffe14d', 3);
        badge('BAWK!', 400, 300, 56, '#e8434f', '#fff', outBack(rk / .22), -.07);
        if (rk > .5) badge('ROLLING DOWNHILL...', 400, 372, 26, '#7e5bd6', '#fff', outBack((rk - .5) / .22), .04);
      }
    }
  }

  const farView = o => ({ i: o.i, kind: o.kind, d: o.p - (driver ? P : pView), x: o.kind === 'perro' || o.kind === 'escalon' ? 0 : o.x, r: o.r });
  g.dbg = {
    LEN, HW, XM, VM, LS, VS, DOGX, DOGT, MAXHIT,
    toPx: xu => 400 + xu / XM * 320,
    /* what each screen shows: the driver sees the street up to SEE_D ahead (dogs with their position and speed); the passenger sees it all but not the near 50 px */
    view: () => {
      if (driver) {
        const u = uT();
        return { role: 'driver', P, x, v, hits, VS, near: obs.filter(o => o.p - P > -20 && o.p - P < SEE_D).map(o => {
          const f = farView(o); if (o.kind === 'perro') { const dx = dogX(o, u), mv = dx > -DOGX + .01 && dx < DOGX - .01; f.dx = dx; f.startIn = dx <= -DOGX + .01 ? Math.max(0, (o.t0 - u) / TS) : 0; f.dvx = 2 * DOGX / DOGT * TS; }
          return f; }) };
      }
      return { role: 'passenger', P: pView, x: xView, v: vView, hits: hView, xT, far: obs.filter(o => { const d = o.p - pView; return d > SEE_P0 && d < SEE_P1; }).map(farView) };
    },
    truth: () => ({ P, x, v, hits, lean }),
  };
  wire(g, D, 0, sp, 'du_mototaxi');
  return g;
}
reg('du_mototaxi', duMototaxi, 'MOTOTAXI EN EL CERRO'); REGMAP.du_mototaxi.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  const sk = X.createLinearGradient(0, 0, 0, 90); sk.addColorStop(0, '#6ec1ff'); sk.addColorStop(1, '#ffe9bd'); X.fillStyle = sk; X.fillRect(0, 0, 520, 90);
  X.fillStyle = '#c9744a'; X.fillRect(0, 90, 520, 150);
  for (const [bx, by, w, h, c] of [[10, 150, 70, 56, '#ff9f43'], [88, 130, 60, 50, '#4db8ff'], [380, 140, 70, 58, '#ff6fb1'], [450, 120, 60, 50, '#ffd23f']]) { cel(c, 'rgba(0,0,0,.2)', () => rr(bx, by - h, w, h, 3), -w * .14, 0, 3); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 90); X.lineTo(520, 90); X.stroke();
  X.beginPath(); X.moveTo(240, 90); X.lineTo(280, 90); X.lineTo(430, 240); X.lineTo(110, 240); X.closePath(); ink('#9893ad', 4);
  const sway = Math.sin(u / 4 * TAU) * 40;
  if (role === 0) {
    const k = (u * 1.6) % 1; dog(120 + k * 280, 170, 50, tt, 1, 1);
    line([[90, 232], [430, 232]], 14, '#3a3550'); X.beginPath(); X.arc(260, 222, 34, 0, TAU); ink('#2c2a3a', 4); line([[260, 222], [260 + Math.cos(2.4 + (u < 2 ? u : 4 - u)) * 24, 222 + Math.sin(2.4 + (u < 2 ? u : 4 - u)) * 24]], 4, '#fff');
    DUO.demoFinger(430, 214, u < 2, u % 1);
    badge('HOLD TO GO, RELEASE TO BRAKE', 260, 26, 15, '#2b9ee6', '#fff', 1, -.02);
  } else {
    hen(250 + sway * .2, 140, 36, tt, 3, 0, 1);
    el(300, 120, 30, 10); ink('#3a3250', 3);
    caos(260 + sway, 235, 3.6, { col: '#6EA8FE' });
    DUO.demoFinger(260 + sway, 226, true, u % 1);
    badge('LEAN LEFT / RIGHT, WARN THE DRIVER', 260, 26, 15, '#c98a12', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_mototaxi = [['DRIVER', 'GAS AND BRAKE, TRUST YOUR FRIEND', 'HOLD TO GO'], ['PASSENGER', 'LEAN TO STEER AND WARN THE DRIVER', 'TILT OR DRAG LEFT / RIGHT']];
DUO.DEMOS.du_mototaxi = [t => demo(0, t), t => demo(1, t)];

})();
