'use strict';
/* ═════════ DUO · TELEFÉRICO DE MÉRIDA (du_teleferico): the cable car climbing to Pico Espejo through the Andean fog ═════════
   CABIN (role 0, JUDGE): inside the car. Sees the fog, the horizon tilting, the altitude and a bubble level - but NOT the cable, the wind
   or how far the station is (only the altitude and, at the very end, the station coming out of the fog). Gusts rock the car: when the fog
   rushes in from a side a gust is about to push the car that way (only ~1 s of warning). Holds the coffee sacks: press the LEFT / RIGHT sack
   (touch: left / right half of the screen, keys ◄ ► / A D) to push the car back to that side and keep it from swaying too much.
   STATION (role 1): at the control desk. Sees the cable, the car on it, the platform, a wind sock and the WIND FORECAST (the next gusts, 3 s ahead,
   with direction). Owns the lever: HOLD (pointer anywhere / space / ↑) = the car climbs, LET GO = it brakes. Gusts hit harder at speed; every
   start / stop also rocks the car. Has to stop it inside the platform zone: not before, not past the buffer.
   WIN: the car stands in the platform zone, almost still and almost level, for half a second. LOSE: it sways too far, runs past the buffer, or time runs out.
   A tourist asks for a photo with the landscape (win: the flash and the polaroid with a condor photobombing; lose: the car hangs crooked).
   Netcode: the CABIN owns the physics and publishes 's' [P, th*1000, v, w*1000] (absolute, latest). The STATION owns the lever and publishes 'go'
   0 / 1 (absolute, latest, re-sent every .25 s). The gust schedule is drawn from mkR() in the constructor, identical on both screens. The cabin
   decides the verdict (arrived / swayed / past / time) and calls g.finish. Everything runs on simulated time S = g.c * sqrt(sp). */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only
const rgbC = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixC = (a, b, k) => { const A = rgbC(a), B = rgbC(b); k = clamp(k, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

/* ───────────── tuning (simulated seconds) ───────────── */
const LEN = 900, VMAX = 130, ACC = 100, DEC = 150;          // cable length to the platform, top speed u/s, accel, brake
const LO = LEN - 70, HI = LEN + 35, OVER = LEN + 60;       // platform zone [LO, HI]; past OVER = crash into the buffer
const OM = 2.2, CD = .26, GA = 2.1, AK = .0035, TQ = 3;    // pendulum: natural freq, damping, gust force, accel coupling, sack torque
const GD = 1.5, WARN = 1.1, TFAIL = .5, TWARN = .3;        // gust length, fog warning lead, sway limit, sway alarm
const ALT0 = 1640, ALT1 = 4765;                            // Mérida / Pico Espejo, metres
const INKC = '#14101c';

let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r, keep) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); if (!keep) X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4, oc = INK) { build(); ink(shade, o, oc); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col, oc) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); if (oc !== null) { X.strokeStyle = oc || INK; X.lineWidth = w + 5; X.stroke(); } X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .55) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function poly(pts) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); }
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
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
/* a frailejón (Espeletia): the furry grey-green rosette on a stem, the trademark plant of the Mérida páramo */
function fraile(x, y, h, T, ph) {
  const lw = Math.max(1.5, h * .05);
  line([[x, y], [x + 1, y - h * .7]], Math.max(2.5, h * .16), '#8a6a3c');
  for (let k = 0; k < 7; k++) { const a = -Math.PI * .5 + (k - 3) * .5 + Math.sin(T * 1.5 + ph) * .05; X.save(); X.translate(x + 1, y - h * .7); X.rotate(a); el(0, -h * .26, h * .09, h * .3); ink(k % 2 ? '#b8d0a0' : '#9cbf8e', lw); X.restore(); }
}
function condor(x, y, s, T, flip) {                      // Andean condor, wings spread, white collar
  X.save(); X.translate(x, y); X.scale(s * (flip || 1), s); const fl = Math.sin(T * 3) * 6;
  poly([[-4, 0], [-50, -14 - fl], [-92, 2 - fl * .6], [-70, 10], [-40, 8]]); ink('#2a2438', 3);
  poly([[4, 0], [50, -14 - fl], [92, 2 - fl * .6], [70, 10], [40, 8]]); ink('#2a2438', 3);
  X.fillStyle = '#f4f0e6'; poly([[-50, -14 - fl * .6], [-80, -2 - fl * .5], [-64, 4], [-42, -2]]); X.fill(); poly([[50, -14 - fl * .6], [80, -2 - fl * .5], [64, 4], [42, -2]]); X.fill();
  el(0, 4, 14, 8); ink('#2a2438', 3); el(-15, 1, 8, 6); ink('#e6a0a0', 3); el(-9, 0, 7, 3); ink('#f4f0e6', 2);
  X.beginPath(); X.moveTo(-22, 0); X.lineTo(-30, 4); X.lineTo(-21, 5); X.closePath(); ink('#f0c64a', 2); X.fillStyle = INK; X.fillRect(-17, -2, 2.6, 2.6);
  X.restore();
}
function cloud(x, y, s, a) { X.save(); X.translate(x, y); X.scale(s, s); X.globalAlpha = a; for (const [p, q, r] of [[0, 0, 24], [26, -12, 28], [54, 0, 22], [26, 8, 24]]) { X.beginPath(); X.arc(p, q, r, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); X.globalAlpha = 1; }
function ridge(y0, amp, seed, col, snow, par, xs) {      // a mountain layer: polygon of peaks, optional snow caps
  const pts = [[-60, 700]]; for (let x = -60; x <= 860; x += 46) pts.push([x, y0 - par - amp * (.25 + .75 * hsh(seed + Math.round((x + xs) / 46))) * (.7 + .3 * Math.sin((x + xs) * .013 + seed))]); pts.push([860, 700]);
  poly(pts); ink(col, 3.5);
  if (snow) for (let i = 1; i < pts.length - 1; i++) { const [a, b] = pts[i]; if (b < y0 - par - amp * .62) { poly([[a - 16, b + 15], [a - 5, b + 7], [a, b + 17], [a + 6, b + 6], [a + 17, b + 15], [a, b - 1]]); X.fillStyle = '#fff'; X.fill(); } }
}

function sack(cx, cy, side, press) {
  X.save(); X.translate(cx, cy + press * 6); const s = 1 - press * .06; X.scale(s, s);
  cel('#d9b27a', '#a47c44', () => { X.beginPath(); X.moveTo(-34, 36); X.quadraticCurveTo(-48, -4, -22, -30); X.lineTo(-14, -42); X.lineTo(14, -42); X.lineTo(22, -30); X.quadraticCurveTo(48, -4, 34, 36); X.quadraticCurveTo(0, 46, -34, 36); X.closePath(); }, 10, -6, 4);
  line([[-16, -34], [16, -34]], 6, '#c14d2f'); glint(-16, -8, 6, 14, .2, .5);
  txt(side < 0 ? '◄' : '►', 0, 8, 34, '#fff'); X.restore();
}

/* ═════════ the game ═════════ */
function duTeleferico(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), cabin = D.role === 0, TS = Math.sqrt(sp);
  /* ----- the gusts (identical draws on both screens) ----- */
  const gusts = []; let dir = R() < .5 ? -1 : 1;
  for (let i = 0; i < 4; i++) { gusts.push({ i, t0: 2.6 + i * 2.9 + (R() - .5) * .6, dir, str: .85 + R() * .35 }); if (R() < .7) dir = -dir; }
  const gf = S => { let f = 0; for (const u of gusts) if (S >= u.t0 && S <= u.t0 + GD) f += u.dir * u.str * Math.pow(Math.sin(Math.PI * (S - u.t0) / GD), 2); return f; };
  const fogAt = S => { let k = 0, d = 0; for (const u of gusts) { const a = u.t0 - WARN, b = u.t0 + GD; if (S < a || S > b + .5) continue; const kk = S < u.t0 ? (S - a) / WARN : S <= b ? 1 : 1 - (S - b) / .5; if (kk > k) { k = kk; d = u.dir; } } return { k: clamp(k, 0, 1), dir: d }; };
  /* ----- state ----- */
  let P = 0, v = 0, th = 0, w = 0, goR = false, uIn = 0, dwell = 0, cause = '', resAt = -1, sSent = -9, crook = 0, flash = -9, warnT = -9;   // cabin (judge)
  let held = false, goSent = -9; const kGo = new Set(); let kL = false, kR = false, ptr = 0;                     // inputs: station lever / cabin sacks
  let rP = 0, rTh = 0, rV = 0, rW = 0, rT = -1, vP = 0, vTh = 0, leverK = 0, sawMsg = false;                     // station: last state received, smoothed view
  const pops = [], conf = [];
  const pop = (s, px, py, size, bgc, fg) => { pops.push({ s, x: px, y: py, size, bgc, fg, t0: g.c, rot: (hsh(g.c * 9) - .5) * .14 }); if (pops.length > 3) pops.shift(); };
  const goNow = () => held || kGo.size > 0;
  const sendGo = () => { goSent = g.c; D.send('go', goNow() ? 1 : 0, true); };

  function step(h, S) {
    const done = !!g.result; let acc;
    if (done) acc = v > 0 ? -Math.min(g.result === 'win' ? DEC * .6 : DEC * 2, v / h) : 0;
    else if (goR) acc = Math.min(ACC, (VMAX - v) / h); else acc = -Math.min(DEC, v / h);
    v += acc * h; P += v * h;
    const al = -OM * OM * th - CD * w + GA * gf(S) * (.4 + .6 * v / VMAX) - AK * acc + TQ * (done ? 0 : uIn);
    w += al * h; th += w * h;
  }
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: cabin ? 'BALANCE!' : 'BRAKE!', roleLabel: cabin ? 'CABIN' : 'STATION',
    hint: cabin ? 'YOU SEE THE FOG, NOT THE WIND OR THE CABLE. WHEN THE FOG RUSHES IN FROM A SIDE, A GUST IS COMING: PRESS THE COFFEE SACK ON THAT SIDE (◄ ► OR A D) TO KEEP THE CABIN LEVEL. YOUR FRIEND DRIVES!' : 'YOU SEE THE CABLE AND THE WIND FORECAST. HOLD (MOUSE OR SPACE) TO CLIMB, LET GO TO BRAKE, AND STOP ON THE GREEN PLATFORM. TELL YOUR FRIEND WHICH GUST IS COMING!',
    thint: cabin ? 'YOU SEE THE FOG, NOT THE WIND. WHEN FOG RUSHES IN FROM A SIDE, TAP THAT SIDE OF THE SCREEN TO PUSH THE CABIN BACK AND KEEP IT LEVEL' : 'HOLD TO CLIMB, LET GO TO BRAKE: STOP ON THE GREEN PLATFORM. YOU SEE THE WIND FORECAST, SO TELL YOUR FRIEND WHICH GUST IS COMING',
    update(dt) {
      g.c += dt; const T = g.c, S = T * TS;
      if (g.result && resAt < 0) {
        resAt = T; flash = T;
        if (g.result === 'win') { for (let i = 0; i < 46; i++) conf.push({ x: hsh(i) * 800, y: -20 - hsh(i + 3) * 300, vy: 90 + hsh(i + 9) * 150, ph: hsh(i + 17) * 6, c: ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A', '#ff9f43'][i % 5] }); sfx.sparkle && sfx.sparkle(); }
        else if (!cabin) sfx.pop();
      }
      for (const c of conf) { c.y += c.vy * dt; if (c.y > 620) c.y = -20; }
      if (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      if (cabin) {
        const hs = dt * TS, n = Math.max(1, Math.ceil(hs / (1 / 90))), h = hs / n;
        for (let i = 0; i < n; i++) step(h, S - hs + (i + 1) * h);
        uIn = (kL ? -1 : 0) + (kR ? 1 : 0) || ptr; if (g.result) uIn = 0;
        if (g.result === 'lose') crook += ((cause === 'sway' ? (th < 0 ? -1 : 1) * .75 : 0) - crook) * Math.min(1, dt * 3);
        if (!g.result) {
          if (Math.abs(th) > TWARN && T - warnT > 1) { warnT = T; sfx.miss && sfx.miss(); }
          const inZ = P >= LO && P <= HI && v < 6 && Math.abs(th) < .1 && Math.abs(w) < .3; dwell = inZ ? dwell + hs : 0;
          if (Math.abs(th) > TFAIL) { cause = 'sway'; sfx.thud(); shake(8, .3); g.finish('lose'); }
          else if (P > OVER) { cause = 'over'; sfx.thud(); sfx.miss(); shake(14, .4); g.finish('lose'); }
          else if (dwell >= .5) { sfx.coin(); g.finish('win'); }
          else if (T >= g.limit) { cause = 'slow'; g.finish('lose'); }
        }
        if (T - sSent >= .07) { sSent = T; D.send('s', [Math.round(P * 10) / 10, Math.round(th * 1000), Math.round(v * 10) / 10, Math.round(w * 1000)], true); }
      } else {
        if (T - goSent >= .25) sendGo();
        if (rT >= 0) { const a = Math.min(.5, T - rT); vP += (Math.min(rP + rV * a, OVER + 5) - vP) * Math.min(1, dt * 12); vTh += (rTh + rW * Math.min(.3, a) - vTh) * Math.min(1, dt * 12); }
        leverK += ((goNow() && !g.result ? 1 : 0) - leverK) * Math.min(1, dt * 14);
      }
    },
    msg(type, d) {
      if (cabin) { if (type === 'go') goR = d === 1 || d === true; }
      else if (type === 's' && Array.isArray(d)) { rP = d[0]; rTh = d[1] / 1000; rV = d[2]; rW = d[3] / 1000; rT = g.c; if (!sawMsg) { sawMsg = true; vP = rP; vTh = rTh; } }
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (cabin) drawCabin(T, won, lost, rk); else drawStation(T, won, lost, rk);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .85 ? Math.max(0, 1 - (a - .85) / .25) : 1; badge(q.s, clamp(q.x, 150, 650), Math.max(120, q.y - Math.min(a, .6) * 18), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(cabin ? 'KEEP IT LEVEL!' : 'STOP ON THE GREEN!', 400, cabin ? 440 : 330, 20, cabin ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
    down(p) {
      if (cabin) { if (!g.result) ptr = p.x < 400 ? -1 : 1; return; }
      held = true; sendGo();
    },
    move(p) { if (cabin && ptr) ptr = p.x < 400 ? -1 : 1; },
    up() { if (cabin) ptr = 0; else { held = false; sendGo(); } },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (cabin) { if (c === 'ArrowLeft' || c === 'KeyA') kL = true; else if (c === 'ArrowRight' || c === 'KeyD') kR = true; }
      else if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') { kGo.add(c); sendGo(); }
    },
    keyup(e) {
      if (cabin) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kL = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') kR = false; }
      else if (kGo.delete(e.code)) sendGo();
    },
  };
  const confetti = () => { for (const c of conf) { X.save(); X.translate(c.x + Math.sin(g.c * 3 + c.ph) * 12, c.y); X.rotate(g.c * 4 + c.ph); X.fillStyle = c.c; X.fillRect(-5, -3, 10, 6); X.restore(); } };

  /* ═════ cabin screen ═════ */
  const WX = 50, WY = 92, WW = 700, WH = 300;
  let CBG = null;
  function bakeC() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
    X.save(); X.beginPath(); X.rect(0, 0, W, H); rr(WX, WY, WW, WH, 26, true); X.clip('evenodd'); X.fillStyle = '#e8434f'; X.fillRect(0, 0, W, H);
    X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 10; i++) X.fillRect(0, i * 60, W, 3); X.restore();
    // window frame + mullions
    rr(WX, WY, WW, WH, 26); X.lineWidth = 16; X.strokeStyle = INKC; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#f4f0e6'; X.stroke();
    // cream band under the window and the wooden floor
    rr(0, 410, W, 40, 0); ink('#f4f0e6', 4); X.fillStyle = 'rgba(20,16,28,.12)'; X.fillRect(0, 436, W, 14);
    cel('#c98f4e', '#9a6a34', () => { rr(-10, 450, W + 20, 170, 0); }, 0, -14, 4);
    X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 3; for (let i = 1; i < 8; i++) { X.beginPath(); X.moveTo(i * 100, 452); X.lineTo(i * 100 + (i - 4) * 12, H); X.stroke(); }
    // roof gauges plate
    rr(30, 8, 740, 66, 14); ink('#f4f0e6', 4);
    X = old; return cv;
  }
  function drawCabin(T, won, lost, rk) {
    if (!CBG) CBG = bakeC(); const S = T * TS, altK = clamp(P / LEN, 0, 1), fg = fogAt(S), tilt = lost && cause === 'sway' ? crook : th;
    // ── the world outside, rotated against the car's tilt
    X.save(); rr(WX, WY, WW, WH, 26); X.clip(); X.translate(400, WY + WH / 2); X.rotate(-tilt * 1.15); X.translate(-400, -(WY + WH / 2));
    const sk = X.createLinearGradient(0, WY - 160, 0, WY + WH + 160); sk.addColorStop(0, mixC('#4aa3ec', '#1c3f9e', altK)); sk.addColorStop(.62, '#cfeaff'); sk.addColorStop(1, '#fff3d6'); X.fillStyle = sk; X.fillRect(-200, WY - 200, 1200, WH + 500);
    X.beginPath(); X.arc(640, WY + 56, 26, 0, TAU); ink('#ffe14d', 4); glint(632, WY + 48, 9, 5, -.6, .8);
    ridge(WY + 250, 110, 3, '#a9bde0', true, altK * 40, 0); ridge(WY + 300, 90, 11, '#6f9a86', false, altK * 70, 90);
    // frailejones sliding down as the car climbs
    for (let i = 0; i < 9; i++) { const k = (((i / 9 - P * .0011) % 1) + 1) % 1, sy = WY + 175 + k * (WH - 130); fraile(60 + hsh(i + 5) * 640, sy, 20 + k * 52, T, i); }
    // the condor, circling behind the glass
    condor(((T * 55 + 120) % 1000) - 150, WY + 80 + Math.sin(T * .9) * 26, .8, T, 1);
    // the station: comes out of the fog in the last stretch
    const dist = LEN - P, ss = clamp(1 - dist / 170, 0, 1);
    if (ss > 0) {
      const px0 = lerp(860, 330, ease(ss)), by = WY + WH - 6;
      cel('#8e8aa8', '#6d6a88', () => rr(px0, by - 190, 700, 190, 8), 14, -8, 4);
      cel('#c14d2f', '#8f3320', () => poly([[px0 - 30, by - 190], [px0 + 300, by - 250], [px0 + 730, by - 190]]), 12, 0, 4);
      rr(px0 + 70, by - 160, 270, 46, 10); ink('#2f6fd6', 4); txt('PICO ESPEJO', px0 + 205, by - 137, 26, '#fff', 'center', 240);
      cel('#f7e3a6', '#d9bd78', () => rr(px0 - 40, by - 22, 780, 40, 4), 10, -6, 4);
      for (let i = 0; i < 12; i++) { X.fillStyle = i % 2 ? INKC : '#ffd23f'; poly([[px0 - 40 + i * 24, by - 22], [px0 - 22 + i * 24, by - 22], [px0 - 34 + i * 24, by - 10], [px0 - 52 + i * 24, by - 10]]); X.fill(); }
      X.globalAlpha = (1 - ss) * .75; X.fillStyle = '#eef7ff'; X.fillRect(px0 - 60, WY, 900, WH); X.globalAlpha = 1;
    }
    // fog: a thin bank always, thick and rushing when a gust is coming
    const base = .3 + .5 * fg.k;
    for (let i = 0; i < 12; i++) {
      const sp0 = (fg.k > .05 ? 380 * fg.dir * (.5 + hsh(i) * .8) * fg.k : 30 * (hsh(i + 2) - .5)), fx = (((hsh(i * 3) * 1000 + sp0 * T + (fg.dir ? 0 : T * 12)) % 1000) + 1000) % 1000 - 150, fy = WY + 40 + hsh(i + 7) * (WH - 40);
      cloud(fx, fy, 1.8 + hsh(i + 4) * 1.4, base * (.5 + .5 * hsh(i + 9)));
    }
    if (fg.k > .3) { X.globalAlpha = fg.k * .55; for (let i = 0; i < 6; i++) { const yy = WY + 30 + i * 46, xx = (((T * 520 * fg.dir + i * 211) % 900) + 900) % 900 - 100; line([[xx, yy], [xx + 70 * fg.dir, yy + 2], [xx + 140 * fg.dir, yy]], 4, '#fff', null); } X.globalAlpha = 1; }
    X.restore();
    ctx.drawImage(CBG, 0, 0);
    // ── gauges on the roof plate
    rr(60, 16, 200, 50, 10); ink('#243556', 3); txt(`${Math.round(ALT0 + (ALT1 - ALT0) * altK).toLocaleString('es-VE')} m`, 160, 42, 28, '#7dff9e', 'center', 180);
    txt('ALTITUDE', 100, 22, 11, '#9fb4e8', 'center', 80);
    rr(310, 24, 180, 34, 17); ink('#2c8f6a', 3); X.save(); rr(316, 29, 168, 24, 12); X.clip(); X.fillStyle = '#bff5d2'; X.fillRect(300, 20, 200, 44);
    X.fillStyle = 'rgba(20,16,28,.3)'; X.fillRect(396, 29, 2, 24); X.fillRect(402, 29, 2, 24);
    const bx = 400 + clamp(-tilt / TFAIL, -1, 1) * 72; X.beginPath(); X.arc(bx, 41, 9, 0, TAU); ink('#ffe14d', 2.5); glint(bx - 3, 38, 3, 2, 0, .8); X.restore();
    const alarm = Math.abs(tilt) > TWARN && !g.result;
    rr(540, 16, 200, 50, 10); ink(alarm && (T * 6 | 0) % 2 ? '#ff5c5c' : '#243556', 3); txt(alarm ? 'TOO MUCH SWAY!' : 'SWAY OK', 640, 42, 20, alarm ? '#fff' : '#7dff9e', 'center', 180);
    // ── tourist + camera
    const lean = clamp(th, -.5, .5) * 40, tx = 400 + lean * .6, mood = won ? 'happy' : lost ? 'sad' : null;
    X.save(); X.translate(tx, 580); X.rotate(clamp(th, -.5, .5) * .25);
    const up = won && rk >= 0 ? -2.7 + Math.sin(T * 14) * .3 : -2.1;
    arm(5.4, -1, up, 1, '#ff8fb1'); arm(5.4, 1, won && rk >= 0 ? 2.7 - Math.sin(T * 14) * .3 : 2.1, 1, '#ff8fb1');
    caos(0, 0, 5.4, { col: '#ff8fb1', mood });
    X.fillStyle = INK; rr(-37, -12.6 * 5.4 - 6, 74, 20, 8); X.fill(); rr(-33, -12.6 * 5.4 - 4, 66, 14, 6); X.fillStyle = '#ffd23f'; X.fill();
    X.restore();
    if (!g.result && ((T > 1.4 && T < 3.6) || (T > 8 && T < 9.6))) { const bxx = tx + 70, byy = 500; X.beginPath(); X.moveTo(bxx - 18, byy + 28); X.lineTo(bxx - 36, byy + 52); X.lineTo(bxx + 2, byy + 36); X.closePath(); ink('#fff', 3); rr(bxx - 70, byy - 24, 150, 54, 24); ink('#fff', 3.5); txt('A PHOTO PLEASE!', bxx + 5, byy + 3, 17, INK, 'center', 128); }
    // ── coffee sacks (the two big buttons)
    const pl = uIn < 0 ? 1 : 0, pr = uIn > 0 ? 1 : 0; sack(110, 520, -1, pl); sack(690, 520, 1, pr);
    if (T < 3.5 && !g.result) { pill(tx, 480 - 12.6 * 5.4 + 30, 'YOUR FRIEND', (D.partner && D.partner.color) || '#6EA8FE'); pill(110, 462, 'YOU', myCol()); }
    if (T < 3 && !g.result) DUO.demoFinger(110 + Math.sin(T * 2) * 0 + (T % 2 < 1 ? 0 : 580), 520, true, (T * 2) % 1);
    // ── payoffs
    if (flash >= 0 && T - flash < .25 && g.result) { X.globalAlpha = (1 - (T - flash) / .25) * (won ? .9 : .5); X.fillStyle = '#fff'; X.fillRect(0, 0, W, H); X.globalAlpha = 1; }
    if (won && rk >= 0) {
      confetti();
      if (rk > .25) polaroid(580, 290, rk - .25, true);
      badge('PICO ESPEJO!', 330, 150, 44, '#2f6fd6', '#fff', outBack(rk / .28) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 2) : 1), -.06);
      if (rk > .45) badge('MADE IT!', 330, 215, 32, '#2fa84a', '#fff', outBack((rk - .45) / .22), .05);
    }
    if (lost && rk >= 0) {
      if (cause === 'sway') { badge('WHAT A SWAY!', 400, 200, 44, '#e8434f', '#fff', outBack(rk / .22), -.07); if (rk > .35) polaroid(590, 270, rk - .35, false); if (rk > .5) badge('BLURRY PHOTO...', 400, 270, 26, '#7e5bd6', '#fff', outBack((rk - .5) / .22), .04); }
      else if (cause === 'over') { badge('TOO FAR!', 400, 200, 50, '#e8434f', '#fff', outBack(rk / .22), -.07); if (rk > .35) badge('BUFFER BONK!', 400, 272, 30, '#7e5bd6', '#fff', outBack((rk - .35) / .22), .04); star(400, 330, 60 * Math.min(1, rk * 6), 28, 9, rk * 2, '#ffe14d', 4); }
      else { badge('TOO SLOW!', 400, 220, 50, '#e8434f', '#fff', outBack(rk / .22), -.05); if (rk > .4) badge('THE CABLE CAR IS COLD...', 400, 290, 22, '#7e5bd6', '#fff', outBack((rk - .4) / .22), .03); }
    }
  }
  /* the tourist's photo: win = sunny peak with a condor photobombing, lose = a smear */
  function polaroid(x, y, k, good) {
    const sc = outBack(k / .3); if (sc <= .01) return;
    X.save(); X.translate(x, y); X.rotate(good ? .1 : -.12); X.scale(sc, sc);
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-74, -78, 160, 190, 8); X.fill();
    rr(-80, -90, 160, 190, 8); ink('#fffdf4', 4);
    X.save(); rr(-68, -78, 136, 124, 4); X.clip();
    if (good) {
      const sg = X.createLinearGradient(0, -78, 0, 46); sg.addColorStop(0, '#4aa3ec'); sg.addColorStop(1, '#fff3d6'); X.fillStyle = sg; X.fillRect(-70, -80, 140, 130);
      poly([[-70, 46], [-40, -20], [-18, 8], [10, -40], [40, 6], [70, -10], [70, 46]]); ink('#a9bde0', 3);
      poly([[10, -40], [2, -26], [10, -30], [16, -24]]); X.fillStyle = '#fff'; X.fill();
      condor(10, -56, .42, g.c, 1);
      caos(-36, 44, 2.4, { col: '#ff8fb1', mood: 'happy' });
    } else {
      X.fillStyle = '#cfd6e6'; X.fillRect(-70, -80, 140, 130); X.globalAlpha = .6; for (let i = 0; i < 4; i++) { el(-30 + i * 22, -20 + (i % 2) * 24, 30, 12, .3 * i); X.fillStyle = ['#ff8fb1', '#fff', '#6f9a86', '#a9bde0'][i]; X.fill(); } X.globalAlpha = 1;
      line([[-60, 30], [60, -50]], 6, '#fff', null);
    }
    X.restore();
    txt(good ? 'CHEESE!' : 'BLURRY', 0, 76, 20, INK, 'center', 120); X.restore();
  }

  /* ═════ station screen ═════ */
  const C0 = [70, 480], C1 = [660, 175], CL = LEN + 75;
  const cp = p => { const k = p / CL; return [C0[0] + (C1[0] - C0[0]) * k, C0[1] + (C1[1] - C0[1]) * k]; };
  let SBG = null;
  function bakeS() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
    const sk = X.createLinearGradient(0, 0, 0, 400); sk.addColorStop(0, '#5db4f5'); sk.addColorStop(1, '#fff3d6'); X.fillStyle = sk; X.fillRect(0, 0, W, H);
    X.beginPath(); X.arc(430, 70, 30, 0, TAU); ink('#ffe14d', 4); glint(421, 60, 10, 6, -.6, .8);
    ridge(300, 190, 21, '#b5c6e6', true, 0, 40); ridge(360, 120, 33, '#7fa88e', false, 0, 200);
    cel('#79a35c', '#587f42', () => { poly([[0, 640], [0, 640], [0, 630], [660, 292], [800, 222], [800, 640]]); }, 20, -14, 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; poly([[300, 470], [660, 292], [800, 222], [800, 250], [660, 322], [320, 500]]); X.fill();
    for (let i = 0; i < 9; i++) { const xx = 60 + i * 74 + hsh(i) * 30, yy = 626 - (xx * .517) + 20 + hsh(i + 3) * 40; if (yy < 600) fraile(xx, yy, 34 + hsh(i + 2) * 22, 0, i); }
    // llamas on the slope are a tourist thing; here, a signpost
    // station building and the bay the car enters
    cel('#8e8aa8', '#6d6a88', () => rr(588, 100, 212, 190, 8), 16, -10, 4);
    cel('#c14d2f', '#8f3320', () => poly([[574, 100], [694, 40], [814, 100]]), 12, 0, 4);
    rr(604, 108, 112, 28, 8); ink('#2f6fd6', 3); txt('PICO ESPEJO', 660, 122, 15, '#fff', 'center', 100);
    rr(598, 196, 120, 88, 6); ink('#2a2438', 4); X.fillStyle = '#4a4560'; X.fillRect(604, 202, 108, 76);
    rr(722, 130, 60, 54, 6); ink('#bfe6ff', 3.5); glint(736, 142, 8, 14, .3, .7);
    cel('#f7e3a6', '#d9bd78', () => rr(580, 282, 230, 22, 4), 10, -4, 4);
    for (let i = 0; i < 9; i++) { X.fillStyle = i % 2 ? INKC : '#ffd23f'; poly([[584 + i * 25, 284], [600 + i * 25, 284], [592 + i * 25, 298], [576 + i * 25, 298]]); X.fill(); }
    // control desk
    cel('#3f5b8f', '#2c4170', () => { rr(-20, 520, 840, 140, 0); }, 0, -14, 5); rr(10, 552, 780, 14, 7); ink('#243556', 3);
    X = old; return cv;
  }
  function pylon(p) {
    const [x, y] = cp(p), top = y - 4, bot = y + 150;
    X.lineJoin = 'round'; line([[x - 26, bot], [x - 5, top + 14], [x + 5, top + 14], [x + 26, bot]], 5, '#8d89a8');
    line([[x - 18, bot - 52], [x + 18, bot - 52]], 4, '#8d89a8'); line([[x - 11, bot - 104], [x + 11, bot - 104]], 4, '#8d89a8'); line([[x - 18, bot - 52], [x + 11, bot - 104]], 3, '#8d89a8', null); line([[x + 18, bot - 52], [x - 11, bot - 104]], 3, '#8d89a8', null);
    rr(x - 14, top + 8, 28, 10, 3); ink('#ffd23f', 2.5);
  }
  function drawStation(T, won, lost, rk) {
    if (!SBG) SBG = bakeS(); ctx.drawImage(SBG, 0, 0);
    const S = T * TS, gw = gf(S), cx0 = C0[0], cy0 = C0[1];
    // sky life
    cloud(((T * 9 + 40) % 980) - 140, 140, .8, .9); cloud(((T * 6 + 480) % 980) - 140, 60, .6, .9);
    condor(((1 - ((T * .045 + .4) % 1)) * 1100) - 150, 200 + Math.sin(T * .8) * 20, .6, T, -1);
    // gust streaks
    if (Math.abs(gw) > .05) { X.globalAlpha = clamp(Math.abs(gw), 0, 1) * .8; for (let i = 0; i < 7; i++) { const yy = 150 + i * 52, xx = (((T * 700 * Math.sign(gw) + i * 190) % 1000) + 1000) % 1000 - 120; line([[xx, yy], [xx + 80 * Math.sign(gw), yy + 2], [xx + 160 * Math.sign(gw), yy]], 4, '#fff', null); } X.globalAlpha = 1; }
    // cable with the platform zone (green) and the buffer line (red)
    line([C0, cp(CL)], 5, '#4a4560'); const a = cp(LO), b = cp(HI); line([a, b], 9, '#5CFF7A'); line([a, b], 5, '#2fa84a', null);
    const o = cp(OVER); line([[o[0], o[1] - 14], [o[0], o[1] + 12]], 5, '#e8434f');
    pylon(LEN * .3); pylon(LEN * .62);
    txt('PLATFORM', cp(LO)[0] + 10, cp(LO)[1] - 38, 18, '#5CFF7A', 'center', 120);
    // the wind sock on the station pole
    const sx = 770, sy = 36; line([[sx, sy + 64], [sx, sy]], 5, '#f4f0e6'); const dirS = gw !== 0 ? Math.sign(gw) : 0, ang = -dirS * clamp(Math.abs(gw), 0, 1) * .12 + Math.sin(T * 3) * .02 + .0;
    for (let i = 0; i < 4; i++) { const k = i / 4, len = 36 * (1 - k * .15), ex = sx + dirS * len * 0.7 * (1 - Math.abs(gw) * .1) * (i + 1) * .9 / 1.6, ey = sy + 4 + Math.abs(gw) * 0 + (1 - clamp(Math.abs(gw), 0, 1)) * (i + 1) * 12 + Math.sin(T * 12 + i) * 2 * Math.abs(gw);
      el(ex, ey, 14, 8, ang); ink(i % 2 ? '#fff' : '#ff7a1a', 2.5); }
    // the car on the cable
    const pp = clamp(sawMsg ? vP : 0, 0, OVER + 5), [qx, qy] = cp(pp), tt = lost && g.result && !(vP > OVER - 3) && Math.abs(vTh) > .3 ? (vTh < 0 ? -1 : 1) * .72 : vTh;
    const swing = lost && Math.abs(vTh) > .3 ? tt : (won ? Math.sin(rk * 8) * .04 * Math.max(0, 1 - rk) : vTh);
    X.save(); X.translate(qx, qy); X.rotate(swing);
    line([[0, 0], [0, 40]], 5, '#8d89a8'); rr(-9, -9, 18, 12, 4); ink('#ffd23f', 2.5);
    cel('#e8434f', '#b22e3a', () => rr(-38, 38, 76, 52, 12), 8, -6, 4);
    rr(-30, 46, 60, 26, 7); ink('#bfe6ff', 3); caos(0, 74, 1.7, { col: (D.partner && D.partner.color) || '#6EA8FE', mood: won ? 'happy' : lost ? 'sad' : null }); glint(-18, 54, 6, 3, 0, .6);
    rr(-38, 76, 76, 6, 0); X.fillStyle = '#f4f0e6'; X.fill();
    X.restore();
    // the wind forecast: the next gusts, 3 s ahead
    rr(14, 14, 380, 96, 14); ink('#243556', 4); txt('WIND FORECAST', 80, 30, 14, '#9fb4e8', 'center', 120);
    rr(34, 52, 340, 8, 4); X.fillStyle = '#3d5688'; X.fill(); X.fillStyle = '#ffd23f'; X.fillRect(54, 40, 3, 32); txt('NOW', 56, 84, 12, '#ffd23f', 'center', 40);
    for (const u of gusts) {
      const eta = u.t0 - S; if (eta < -GD || eta > 3.4) continue; const x = 56 + clamp(eta, -.6, 3.4) / 3.4 * 300, run = eta <= 0, k = run ? 1 : 1, sz = 14 + u.str * 8, jit = run ? Math.sin(T * 40) * 2 : 0;
      X.save(); X.translate(x + jit, 56); poly([[-sz * u.dir * .8, -sz * .8], [sz * u.dir * .9, 0], [-sz * u.dir * .8, sz * .8]]); ink(run ? '#ff5c5c' : '#ffb23d', 2.5); X.restore();
      txt(u.dir < 0 ? '◄' : '►', x, 86, 14, '#fff', 'center', 30);
    }
    // the lever: HOLD to climb, release = brake
    rr(560, 542, 210, 20, 10); ink('#243556', 3.5); txt('BRAKE', 596, 590, 13, '#ff8a8a', 'center', 60); txt('CLIMB', 736, 590, 13, '#7dff9e', 'center', 60);
    const lx = 584 + leverK * 162; rr(lx - 15, 524, 30, 52, 10); ink(leverK > .5 ? '#5CFF7A' : '#ff5c5c', 3.5); glint(lx - 5, 536, 4, 9, 0, .6);
    // you + the readout
    X.save(); X.translate(120, 598); arm(3.6, 1, leverK > .5 ? .5 : 1.1, 1, myCol()); caos(0, 0, 3.6, { col: myCol(), mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    rr(250, 548, 230, 40, 10); ink('#243556', 3); const ok = sawMsg && vP >= LO - 1 && vP <= HI + 1; txt(`${Math.round(Math.max(0, LEN - vP))} m`, 330, 568, 26, ok ? '#5CFF7A' : '#ffd23f', 'center', 100); txt('TO GO', 430, 568, 16, '#9fb4e8', 'center', 70);
    if (T < 3.5 && !g.result) { pill(120, 520, 'YOU', myCol()); pill(qx, qy + 110, 'YOUR FRIEND', (D.partner && D.partner.color) || '#6EA8FE'); }
    if (T < 3 && !g.result) DUO.demoFinger(lx, 578 + Math.sin(T * 5) * 3, true, (T * 2) % 1);
    if (won && rk >= 0) {
      confetti(); for (let i = 0; i < 3; i++) { const q = (rk * 1.3 + i / 3) % 1; X.globalAlpha = (1 - q) * .8; X.lineWidth = 5; X.strokeStyle = '#fff'; X.beginPath(); X.arc(qx, qy + 60, 30 + q * 120, 0, TAU); X.stroke(); X.globalAlpha = 1; }
      badge('PICO ESPEJO!', 400, 250, 46, '#2f6fd6', '#fff', outBack(rk / .28) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 2) : 1), -.06);
      if (rk > .45) badge('MADE IT!', 400, 320, 32, '#2fa84a', '#fff', outBack((rk - .45) / .22), .05);
    }
    if (lost && rk >= 0) {
      const sw = Math.abs(vTh) > .3, past = vP > OVER - 6;
      if (past) { badge('TOO FAR!', 400, 250, 50, '#e8434f', '#fff', outBack(rk / .22), -.07); if (rk > .35) badge('BUFFER BONK!', 400, 322, 30, '#7e5bd6', '#fff', outBack((rk - .35) / .22), .04); }
      else if (sw) { badge('WHAT A SWAY!', 400, 250, 44, '#e8434f', '#fff', outBack(rk / .22), -.07); if (rk > .4) badge('HANGING CROOKED...', 400, 322, 26, '#7e5bd6', '#fff', outBack((rk - .4) / .22), .04); }
      else { badge('TOO SLOW!', 400, 250, 50, '#e8434f', '#fff', outBack(rk / .22), -.05); if (rk > .4) badge('THE CABLE CAR IS COLD...', 400, 322, 22, '#7e5bd6', '#fff', outBack((rk - .4) / .22), .03); }
    }
  }

  /* what each screen shows, for the bots: the cabin sees its tilt, the altitude and the fog; the station sees the cable, the car and the forecast */
  g.dbg = {
    LEN, LO, HI, OVER, VMAX, DEC, TFAIL,
    view: () => cabin
      ? { role: 'cabin', th, w, alt: ALT0 + (ALT1 - ALT0) * clamp(P / LEN, 0, 1), fog: fogAt(g.c * TS), station: LEN - P < 170 ? LEN - P : null }
      : { role: 'station', P: vP, v: rV, th: vTh, w: rW, seen: sawMsg, go: goNow(), gusts: gusts.map(u => ({ eta: u.t0 - g.c * TS, dir: u.dir, str: u.str })).filter(u => u.eta > -GD && u.eta < 3.4) },
    truth: () => ({ P, v, th, w, goR, dwell, cause, gusts }),
  };
  wire(g, D, 0, sp, 'du_teleferico');
  return g;
}
reg('du_teleferico', duTeleferico, 'TELEFÉRICO DE MÉRIDA'); REGMAP.du_teleferico.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  const sk = X.createLinearGradient(0, 0, 0, 240); sk.addColorStop(0, '#5db4f5'); sk.addColorStop(1, '#fff3d6'); X.fillStyle = sk; X.fillRect(0, 0, 520, 240);
  ridge(150, 90, 21, '#b5c6e6', true, 0, 40);
  if (role === 0) {
    const th = Math.sin(tt * 2.2) * .22;
    X.save(); X.translate(260, 120); X.rotate(-th);
    for (let i = 0; i < 3; i++) cloud(((tt * (u < 2 ? 160 : -160) + i * 190) % 620) - 90 - 260, -50 + i * 30, 1.4, .8);
    X.restore();
    sack(70, 190, -1, th > 0 ? 1 : 0); sack(450, 190, 1, th < 0 ? 1 : 0);
    X.save(); X.translate(260, 230); X.rotate(th * .3); caos(0, 0, 3.4, { col: '#ff8fb1' }); X.restore();
    DUO.demoFinger(th > 0 ? 70 : 450, 190, true, tt % 1);
    badge('KEEP IT LEVEL!', 260, 26, 16, '#c98a12', '#fff', 1, -.02);
  } else {
    line([[20, 210], [500, 40]], 5, '#4a4560'); line([[400, 74], [460, 53]], 9, '#5CFF7A');
    const p = (tt % 4) < 3 ? ease((tt % 4) / 3) : 1, qx = 40 + 380 * p, qy = 204 - 160 * (qx - 20) / 480 * 1.0 + 8;
    X.save(); X.translate(qx, qy - 6); X.rotate(Math.sin(tt * 3) * .08); line([[0, 0], [0, 22]], 4, '#8d89a8'); cel('#e8434f', '#b22e3a', () => rr(-22, 20, 44, 32, 8), 5, -4, 3); X.restore();
    DUO.demoFinger(260, 196, (tt % 4) < 3, tt % 1); badge('STOP ON THE GREEN!', 260, 26, 16, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_teleferico = [['CABIN', 'KEEP THE CABIN LEVEL', 'TAP A SIDE TO PUSH BACK'], ['STATION', 'CLIMB AND BRAKE IN TIME', 'HOLD TO CLIMB, LET GO TO BRAKE']];
DUO.DEMOS.du_teleferico = [t => demo(0, t), t => demo(1, t)];

})();
