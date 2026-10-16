'use strict';
/* ═════════ DUO · LANCHA A LOS ROQUES (du_lancha): a speedboat across the turquoise shallows of the Venezuelan keys ═════════
   PILOT (role 0, JUDGE): behind the windscreen. HOLD (pointer anywhere / space / ↑) = full throttle, release = coast, drag the pointer sideways
   (or ◄ ► / A D) to steer. Sees the waves, the horizon, the island coming up - but NOT the coral heads and sandbars hiding under the water.
   Only the little tricolor flags the lookout plants warn the pilot (each flag has a foam ring: that is the danger radius).
   LOOKOUT (role 1): stands on the bow and sees through the clear water: coral heads and sandbars ahead. TAP one to plant a flag on it (it shows
   on the pilot's screen). Cannot steer. A turtle swims by to tempt them.
   WIN: the boat reaches the island dock intact. LOSE: the hull touches a coral/sandbar, or time runs out. Fail gag: the lookout waves at the turtle.
   Netcode: the PILOT owns the boat and publishes 's' [P, x*100, v] (latest, coalesced). The LOOKOUT owns the flags: 'fl' = bitmask of flagged
   obstacles (absolute, latest, re-sent every .5 s so a dropped message never matters). The level (obstacles) is drawn from mkR() in the
   constructor, identical on both screens. The pilot decides the verdict (hit / arrived / time) and calls g.finish. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only

/* ───────────── tuning ───────────── */
const LEN = 2700, BOW = 80, NOBS = 9;              // course length to the dock, bow offset ahead of the camera, number of hidden obstacles
const VMAX = 300, ACC = 420, DRAG = 520, LSPD = 4.2, HW = .32, XM = 1.8;   // boat: top speed px/s, accel, coast drag, sideways units/s, half width, max |x|
const LW = 190, HZP = 200, YBP = 560, HZL = 150, YBL = 545;   // 1 x-unit = LW px at the near plane; horizon / near-plane y of each screen
const FL = ['#ffd23f', '#2f6fd6', '#e8434f'];                 // the flag: yellow / blue / red
const CORAL = ['#ff7a8a', '#ff9f43', '#c78bff', '#ff6fb1', '#ffcf4d'], CSH = ['#d04a68', '#d06f1f', '#8f55d6', '#cc4584', '#d6a017'];
const DEEP = '#0b4b63';

let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4, oc = INK) { build(); ink(shade, o, oc); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col, oc) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); if (oc !== null) { X.strokeStyle = oc || INK; X.lineWidth = w + 5; X.stroke(); } X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
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
function palm(x, yb, h, s, T, ph) {
  const lw = Math.max(1.5, 3 * s);
  line([[x, yb], [x + 5 * s, yb - h * .5], [x + 2 * s, yb - h]], Math.max(2, 9 * s), '#a5763c');
  const sw = Math.sin(T * 2 + ph) * 3 * s;
  for (let k = 0; k < 5; k++) { const a = -2.7 + k * .55; X.save(); X.translate(x + 2 * s, yb - h); X.rotate(a + sw * .01); el(24 * s, 0, 26 * s, 6 * s); ink('#3fae52', lw); X.restore(); }
}
/* the tricolor flag on a pole: (x, y) = foot, h = pole height, k = unfurl wobble phase */
function flag(x, y, h, T, ph) {
  const lw = Math.max(1.2, h * .035), fw = h * .55, fh = h * .34, w = Math.sin(T * 9 + ph) * h * .035;
  line([[x, y], [x, y - h]], Math.max(2, h * .07), '#f4f0e6');
  X.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const y0 = y - h + i * fh / 3, y1 = y0 + fh / 3;
    X.beginPath(); X.moveTo(x, y0); X.lineTo(x + fw, y0 + w); X.lineTo(x + fw, y1 + w); X.lineTo(x, y1); X.closePath(); ink(FL[i], 0); X.fillStyle = FL[i]; X.fill();
  }
  X.beginPath(); X.moveTo(x, y - h); X.lineTo(x + fw, y - h + w); X.lineTo(x + fw, y - h + fh + w); X.lineTo(x, y - h + fh); X.closePath(); X.lineWidth = lw * 2; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.arc(x, y - h, Math.max(1.5, h * .05), 0, TAU); ink('#ffd23f', Math.max(1, lw));
}
/* a coral head seen through the water: w = pixel radius */
function coralHead(x, y, w, T, ph, tint) {
  const lw = Math.max(1.2, w * .09);
  X.fillStyle = 'rgba(8,60,84,.32)'; el(x, y + w * .12, w * 1.1, w * .34); X.fill();
  for (let k = 0; k < 5; k++) {
    const cx = x + (k - 2) * w * .42, rad = w * (.34 + .14 * hsh(ph * 5 + k)), cy = y - rad * (.5 + .5 * hsh(ph * 3 + k)) + w * .05, ci = (k + ph) % 5;
    cel(CORAL[ci], CSH[ci], () => el(cx, cy, rad, rad * .9), rad * .3, -rad * .1, lw, DEEP);
    glint(cx - rad * .3, cy - rad * .35, rad * .26, rad * .16);
  }
  for (let k = 0; k < 3; k++) { const bx = x + (k - 1) * w * .5, sw = Math.sin(T * 1.6 + k + ph) * w * .05; line([[bx, y - w * .1], [bx + sw, y - w * .8], [bx + sw * 2 + (k - 1) * w * .1, y - w * 1.15]], Math.max(2, w * .13), CORAL[(k + ph + 2) % 5], DEEP); }
  if (tint) { X.fillStyle = 'rgba(70,225,215,.16)'; el(x, y - w * .3, w * 1.15, w * .8); X.fill(); }
}
function glint(x, y, rx, ry, rot = -.5, a = .55) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function sandbar(x, y, w, ph) {
  const lw = Math.max(1.2, w * .03);
  cel('#f7e3a6', '#d9bd78', () => el(x, y, w * 1.12, w * .28), w * .18, -w * .04, lw, '#a8895a');
  X.fillStyle = 'rgba(168,137,90,.45)'; for (let k = 0; k < 4; k++) { el(x + (hsh(ph + k) - .5) * w * 1.4, y + (hsh(ph + k * 3) - .4) * w * .18, w * .1, w * .03); X.fill(); }
  glint(x - w * .4, y - w * .08, w * .22, w * .05, -.15, .5);
}
function turtle(x, y, u, T, wave, flip) {          // sea turtle seen from the side/above; wave = 0..1 raises a flipper hello
  X.save(); X.translate(x, y); X.scale(u * (flip || 1), u); const p = Math.sin(T * 3);
  el(-22, 8 + p * 2, 14, 5, .6 + p * .3); ink('#4fb36b', 3); el(18, 10 - p * 2, 14, 5, -.6 - p * .3); ink('#4fb36b', 3);
  el(-26, 0, 7, 3, .2); ink('#4fb36b', 2.5);
  X.beginPath(); X.arc(28, -2, 11, 0, TAU); ink('#8fd68a', 3.5); X.fillStyle = INK; el(32, -5, 2.4, 2.8); X.fill(); glint(31, -6, 1, 1, 0, .9);
  X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.arc(33, 0, 4, .2, 1.8); X.stroke();
  cel('#6fb552', '#3f8a3c', () => el(0, -4, 27, 20), 5, -3, 3.5);
  X.strokeStyle = 'rgba(20,16,28,.5)'; X.lineWidth = 2; X.beginPath(); X.moveTo(-14, -14); X.lineTo(-8, 4); X.moveTo(2, -22); X.lineTo(2, 10); X.moveTo(16, -14); X.lineTo(10, 4); X.moveTo(-22, -4); X.lineTo(22, -4); X.stroke();
  glint(-10, -14, 7, 3.5, -.3);
  const fa = wave > 0 ? -1.2 + Math.sin(T * 14) * .4 : 1.1 + p * .2;
  X.save(); X.translate(14, -16); X.rotate(wave > 0 ? fa : 0); el(wave > 0 ? 2 : 8, wave > 0 ? -12 : -8 + p * 2, wave > 0 ? 5 : 13, wave > 0 ? 12 : 5, wave > 0 ? 0 : -.5); ink('#4fb36b', 3); X.restore();
  X.restore();
}

/* the far-island layer: tiny low cays on the horizon (tinted, no ink) */
function farCays(hz) {
  for (const [cx, w, h] of [[110, 120, 16], [330, 70, 10], [560, 150, 20], [730, 60, 9]]) {
    X.beginPath(); X.moveTo(cx - w, hz); X.quadraticCurveTo(cx - w * .4, hz - h * 1.4, cx, hz - h); X.quadraticCurveTo(cx + w * .5, hz - h * 1.3, cx + w, hz); X.closePath(); X.fillStyle = '#9fd9b4'; X.fill();
    X.fillStyle = '#7cc79a'; for (let k = 0; k < 3; k++) { X.beginPath(); X.arc(cx - w * .3 + k * w * .3, hz - h * .85 - (k % 2) * 3, 3 + (k % 2) * 2, 0, TAU); X.fill(); }
  }
}
function cloud(x, y, s) { X.save(); X.translate(x, y); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink('#f2fbff', 3, '#6aa7d8'); } X.restore(); }
function pelican(x, y, T) {
  const fl = Math.sin(T * 7) * 12; X.save(); X.translate(x, y);
  line([[-4, 0], [-30, -16 - fl], [-56, -4 - fl * .4]], 6, '#fff6e0'); line([[4, 0], [30, -16 - fl], [56, -4 - fl * .4]], 6, '#fff6e0');
  el(0, 2, 20, 9); ink('#fff6e0', 3.5); el(-20, 0, 7, 5); ink('#fff6e0', 3);
  X.beginPath(); X.moveTo(-24, -1); X.lineTo(-52, 4); X.lineTo(-26, 9); X.closePath(); ink('#ffb23d', 3);
  X.fillStyle = INK; X.fillRect(-23, -3, 2.5, 2.5); X.restore();
}

/* ═════════ the game ═════════ */
function duLancha(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), pilot = D.role === 0, TS = Math.sqrt(sp);
  const VM = VMAX * TS, AC = ACC * TS * TS, DR = DRAG * TS * TS, LS = LSPD * TS;
  /* ----- the level (identical draws on both screens): hidden coral heads and sandbars ----- */
  const obs = [];
  for (let i = 0; i < NOBS; i++) {
    const sand = i % 4 === 3, p = 430 + i * (LEN - 430 - 380) / NOBS + (R() - .5) * 50;
    let x = sand ? (R() < .5 ? -1 : 1) * (.8 + R() * .5) : (R() * 2 - 1) * 1.35;
    if (i === 0) x = (R() - .5) * .4;
    obs.push({ i, p, x, r: sand ? .85 : .42, sand, hit: false, ph: Math.floor(R() * 20) });
  }
  /* ----- state ----- */
  const pops = [], spl = [], conf = [];
  let held = false, xT = 0, x = 0, P = 0, v = 0, goT = 0, sSent = -9, lastS = '', hitAt = -9, hitIdx = -1, bank = 0;   // pilot
  const kGo = new Set(); let kL = false, kR = false;
  let fmask = 0, fSent = -9; const flagAt = obs.map(() => -9);                 // flags: pilot sees the mask, lookout owns it
  let pView = 0, xView = 0, vView = 0, recvP = 0, recvX = 0, recvV = 0, recvT = -1, plantAt = -9, tapMiss = null, lastTap = -9;   // lookout
  let resAt = -1, newFlagAt = -9;
  const toX = px => clamp((px - 400) / 400 * 1.9, -XM, XM), toPx = wx => 400 + wx * 400 / 1.9;
  const pop = (s, px, py, size, bgc, fg) => { pops.push({ s, x: px, y: py, size, bgc, fg, t0: g.c, rot: (hsh(g.c * 9) - .5) * .14 }); if (pops.length > 3) pops.shift(); };
  const splash = (px, py, n, up) => { for (let i = 0; i < n; i++) spl.push({ x: px + (hsh(i + g.c) - .5) * 60, y: py, vx: (hsh(i * 3 + g.c) - .5) * 300, vy: -(up || 200) - hsh(i * 7 + g.c) * 280, t0: g.c, life: .9 + hsh(i) * .4, r: 3 + hsh(i * 5) * 5, plank: hsh(i * 11 + g.c) < .25 }); };
  const flagged = i => !!(fmask >> i & 1);

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: pilot ? 'STEER!' : 'SPOT!', roleLabel: pilot ? 'PILOT' : 'LOOKOUT',
    hint: pilot ? 'HOLD (MOUSE OR SPACE) TO GO, MOVE SIDEWAYS (◄ ► OR A D) TO STEER. THE CORAL IS HIDDEN - ONLY THE FLAGS YOUR FRIEND PLANTS SHOW WHERE IT IS!' : 'YOU SEE THE CORAL AND SANDBARS UNDER THE WATER. TAP EACH ONE TO PLANT A FLAG SO YOUR FRIEND CAN STEER AROUND IT!',
    thint: pilot ? 'HOLD TO GO, DRAG LEFT / RIGHT TO STEER. ONLY THE FLAGS YOUR FRIEND PLANTS SHOW WHERE THE CORAL IS' : 'TAP EACH CORAL AND SANDBAR YOU SEE UNDER THE WATER TO PLANT A FLAG FOR YOUR FRIEND',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) {
        resAt = T;
        if (g.result === 'win') { for (let i = 0; i < 46; i++) conf.push({ x: hsh(i) * 800, y: -20 - hsh(i + 3) * 300, vy: 90 + hsh(i + 9) * 150, ph: hsh(i + 17) * 6, c: ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A', '#ff9f43'][i % 5] }); sfx.sparkle && sfx.sparkle(); }
        else if (!pilot) { sfx.pop(); }
      }
      for (let i = spl.length - 1; i >= 0; i--) { const b = spl[i]; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) spl.splice(i, 1); }
      for (const c of conf) { c.y += c.vy * dt; if (c.y > 620) c.y = -20; }
      if (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      if (pilot) {
        const done = !!g.result, go = (held || kGo.size > 0) && !done;
        if (kL) xT = Math.max(-XM, xT - 2.4 * TS * dt); if (kR) xT = Math.min(XM, xT + 2.4 * TS * dt);
        if (done) { if (g.result === 'win') v = Math.max(0, v - DR * .5 * dt); else v = 0; }
        else if (go) v = Math.min(VM, v + AC * dt); else v = Math.max(0, v - DR * dt);
        goT += ((go ? 1 : 0) - goT) * Math.min(1, dt * 14);
        P += v * dt; const px0 = x; x += clamp(xT - x, -LS * dt, LS * dt); bank += ((x - px0) / Math.max(dt, 1e-4) / LS * .09 - bank) * Math.min(1, dt * 8);
        if (!done) {
          for (const o of obs) if (!o.hit && Math.abs(o.p - (P + BOW)) < 22 && Math.abs(o.x - x) < o.r + HW) {
            o.hit = true; hitIdx = o.i; hitAt = T; v = 0; sfx.thud(); sfx.miss(); noise && noise(.25, .1, 600, 150, 'lowpass'); shake(10, .35); splash(400, 470, 22, 260); g.finish('lose'); break;
          }
          if (!g.result && P + BOW >= LEN) { sfx.coin(); g.finish('win'); }
          else if (!g.result && T >= g.limit) g.finish('lose');
        }
        const sm = Math.round(P) + ',' + Math.round(x * 100) + ',' + Math.round(v);
        if (sm !== lastS && T - sSent >= .08) { lastS = sm; sSent = T; D.send('s', [Math.round(P), Math.round(x * 100), Math.round(v)], true); }
        if (!done && v > 30 && hsh(T * 40) < .2) spl.push({ x: 400 + (hsh(T) - .5) * 160, y: 560, vx: (hsh(T * 3) - .5) * 160, vy: -90, t0: T, life: .5, r: 3, plank: false });
      } else {
        if (recvT >= 0) { const pe = recvP + recvV * Math.min(.4, T - recvT); pView += (Math.max(pView, pe) - pView) * Math.min(1, dt * 10); xView += (recvX - xView) * Math.min(1, dt * 12); vView += (recvV - vView) * Math.min(1, dt * 10); }
        if (fmask && T - fSent >= .5) { fSent = T; D.send('fl', fmask, true); }
      }
    },
    msg(type, d) {
      if (pilot) {
        if (type === 'fl' && typeof d === 'number') {
          const nw = d & ~fmask; if (nw) { fmask |= d; newFlagAt = g.c; for (let i = 0; i < NOBS; i++) if (nw >> i & 1) flagAt[i] = g.c; if (!g.result) { sfx.pop(); pop('WATCH OUT!', 400, 300, 24, '#ff7a1a', '#fff'); } }
        }
      } else if (type === 's' && Array.isArray(d)) { if (d[0] >= recvP) { recvP = d[0]; recvX = d[1] / 100; recvV = d[2]; recvT = g.c; } }
    },
    /* ───────── drawing ───────── */
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (pilot) drawPilot(T, won, lost, rk); else drawLookout(T, won, lost, rk);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .85 ? Math.max(0, 1 - (a - .85) / .25) : 1; badge(q.s, clamp(q.x, 150, 650), Math.max(120, q.y - Math.min(a, .6) * 18), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(pilot ? 'STEER BY THE FLAGS!' : 'FLAG THE CORAL!', 400, 250, 20, pilot ? '#2b9ee6' : '#c98a12', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
    down(p) {
      if (pilot) { held = true; xT = toX(p.x); return; }
      if (g.result) return;
      lastTap = g.c; const best = pickObs(p.x, p.y);
      if (best && !flagged(best.i)) { fmask |= 1 << best.i; flagAt[best.i] = g.c; plantAt = g.c; fSent = g.c; D.send('fl', fmask, true); sfx.click(); sfx.pop(); const pr = lookProj(best); pop('FLAG!', pr.sx, Math.max(150, pr.sy - 60), 22, '#2fa84a', '#fff'); }
      else if (!best) { tapMiss = { x: p.x, y: p.y, t0: g.c }; }
    },
    move(p) { if (pilot && held) xT = toX(p.x); },
    up() { held = false; },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (pilot) {
        if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') kGo.add(c);
        else if (c === 'ArrowLeft' || c === 'KeyA') kL = true; else if (c === 'ArrowRight' || c === 'KeyD') kR = true;
      }
    },
    keyup(e) { kGo.delete(e.code); if (e.code === 'ArrowLeft' || e.code === 'KeyA') kL = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') kR = false; },
  };

  /* projections: the pilot's camera sits at the boat, the lookout's at the bow tip (BOW ahead) */
  const proj = d => 1 / (1 + d / 240);
  const lookProj = o => { const d = o.p - (pView + BOW), s = proj(Math.max(-40, d)); return { d, s, sx: 400 + (o.x - xView) * LW * s, sy: HZL + (YBL - HZL) * s, w: o.r * LW * s }; };
  const pilProj = o => { const d = o.p - P, s = proj(Math.max(1, d)); return { d, s, sx: 400 + (o.x - x) * LW * s, sy: HZP + (YBP - HZP) * s, w: o.r * LW * s }; };
  function pickObs(px, py) {
    let best = null, bd = 1e9;
    for (const o of obs) {
      const q = lookProj(o); if (q.d < -10 || q.d > 1500) continue;
      const cy = q.sy - (o.sand ? 0 : q.w * .45), dd = Math.hypot(px - q.sx, py - cy), tol = Math.max(34, q.w * (o.sand ? 1.1 : 1.0) + 22);
      if (dd < tol && dd < bd) { bd = dd; best = o; }
    }
    return best;
  }

  function progress(T, pr) {
    const x0 = 250, w = 300, y = 30;
    line([[x0 + 30, 0], [x0 + 30, y - 12]], 3, '#e6c58c'); line([[x0 + w - 30, 0], [x0 + w - 30, y - 12]], 3, '#e6c58c');
    rr(x0, y - 14, w, 30, 10); ink('#c98f4e', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; rr(x0 + 8, y - 11, w - 16, 5, 2.5); X.fill();
    rr(x0 + 22, y - 3, w - 60, 8, 4); ink('#7ad8e0', 2);
    el(x0 + w - 20, y + 1, 11, 9); ink('#ffe08a', 2.5); line([[x0 + w - 20, y + 1], [x0 + w - 20, y - 11]], 3, '#a5763c'); X.beginPath(); X.arc(x0 + w - 20, y - 12, 6, 0, TAU); ink('#3fae52', 2);
    const bx = x0 + 22 + clamp(pr, 0, 1) * (w - 60);
    X.beginPath(); X.moveTo(bx - 11, y - 3); X.lineTo(bx + 11, y - 3); X.lineTo(bx + 6, y + 8); X.lineTo(bx - 6, y + 8); X.closePath(); ink('#fff6e0', 2.5); X.fillStyle = '#e8434f'; X.fillRect(bx - 9, y - 1, 18, 3);
  }

  /* ═════ pilot ═════ */
  let PBG = null;
  function bakeP() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
    const sk = X.createLinearGradient(0, 0, 0, HZP); sk.addColorStop(0, '#4fb8ff'); sk.addColorStop(1, '#fff0cc'); X.fillStyle = sk; X.fillRect(0, 0, W, HZP);
    X.beginPath(); X.arc(650, 100, 32, 0, TAU); ink('#ffe14d', 4); glint(641, 90, 11, 6, -.6, .8);
    farCays(HZP);
    const sg = X.createLinearGradient(0, HZP, 0, H); sg.addColorStop(0, '#a8f7e8'); sg.addColorStop(.35, '#37d6d0'); sg.addColorStop(1, '#0d9dba'); X.fillStyle = sg; X.fillRect(0, HZP, W, H - HZP);
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, HZP); X.lineTo(W, HZP); X.stroke();
    X = old; return cv;
  }
  function island(cx, y, S, T) {
    const lw = Math.max(1.5, 4 * S);
    cel('#f7e3a6', '#d9bd78', () => el(cx, y, 460 * S, 60 * S), 30 * S, -8 * S, lw, '#a8895a');
    cel('#55c070', '#2f8a4e', () => { X.beginPath(); X.moveTo(cx - 300 * S, y - 10 * S); X.quadraticCurveTo(cx - 150 * S, y - 130 * S, cx, y - 100 * S); X.quadraticCurveTo(cx + 170 * S, y - 140 * S, cx + 310 * S, y - 10 * S); X.closePath(); }, 24 * S, 0, lw);
    for (const [dx, h, ph] of [[-190, 190, 0], [-60, 230, 1], [150, 205, 2], [250, 160, 3]]) palm(cx + dx * S, y - 30 * S, h * S, S, T, ph);
    cel('#ffb23d', '#d0801a', () => rr(cx + 60 * S, y - 76 * S, 82 * S, 54 * S, 6 * S), 8 * S, 0, lw);
    X.beginPath(); X.moveTo(cx + 50 * S, y - 74 * S); X.lineTo(cx + 101 * S, y - 118 * S); X.lineTo(cx + 152 * S, y - 74 * S); X.closePath(); ink('#c14d2f', lw);
    rr(cx + 88 * S, y - 56 * S, 26 * S, 34 * S, 3 * S); ink('#7a4a2c', Math.max(1, 2.5 * S));
    // the dock
    cel('#c98f4e', '#9a6a34', () => rr(cx - 120 * S, y + 10 * S, 240 * S, 34 * S, 5 * S), 10 * S, -3 * S, lw);
    for (let k = 0; k < 5; k++) { X.fillStyle = 'rgba(20,16,28,.28)'; X.fillRect(cx - 100 * S + k * 48 * S, y + 12 * S, 3 * S, 30 * S); }
    line([[cx - 100 * S, y + 10 * S], [cx - 100 * S, y - 40 * S]], Math.max(2, 7 * S), '#a5763c'); line([[cx + 100 * S, y + 10 * S], [cx + 100 * S, y - 40 * S]], Math.max(2, 7 * S), '#a5763c');
    rr(cx - 140 * S, y - 90 * S, 280 * S, 52 * S, 10 * S); ink('#2f6fd6', lw); txt('LOS ROQUES', cx, y - 63 * S, Math.max(6, 32 * S), '#fff', 'center', 250 * S);
  }
  function drawPilot(T, won, lost, rk) {
    if (!PBG) PBG = bakeP(); ctx.drawImage(PBG, 0, 0);
    const bob = Math.sin(T * 5) * (1 + v / VM * 2), roll = bank * (won ? 0 : 1) + (lost && rk >= 0 ? -.05 * Math.min(1, rk * 4) : 0);
    // sky life
    for (const [sx0, y, s] of [[40, 70, .8], [420, 120, .6], [700, 60, .7]]) cloud(((T * 8 + sx0) % 980) - 120, y, s);
    pelican(((T * 70 + 300) % 1100) - 150, 118 + Math.sin(T * 1.5) * 12, T);
    X.save(); X.translate(0, bob);
    // waves
    const n0 = Math.floor(P / 95);
    for (let k = 26; k >= 0; k--) {
      const d0 = k * 95 - (P % 95); if (d0 < -20) continue; const idx = n0 + k, s = proj(Math.max(1, d0)), y = HZP + (YBP - HZP) * s;
      for (let j = 0; j < 4; j++) { const wx = (hsh(idx * 4 + j) - .5) * 8 + Math.sin(T * .8 + idx + j) * .2, px = 400 + (wx - x) * LW * s, wd = (22 + 30 * hsh(idx + j * 5)) * s * 1.6;
        X.globalAlpha = .55; line([[px - wd, y + 1], [px - wd * .3, y - 3 * s - 1], [px + wd * .3, y - 3 * s - 1], [px + wd, y + 1]], Math.max(1.2, 4 * s), '#fff', null); X.globalAlpha = 1; }
    }
    // island + hazards + flags, far to near
    const items = [];
    const dI = LEN + 140 - (P + BOW); if (dI > -200 && dI < 6000) items.push({ d: dI, k: 'isl' });
    for (const o of obs) { const fl = flagged(o.i), rev = o.hit; if (!fl && !rev) continue; const d = o.p - P; if (d > -60 && d < 2600) items.push({ d, k: 'o', o }); }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) {
      if (it.k === 'isl') { const s = proj(Math.max(1, it.d)); island(400 + (0 - x) * 0 + (hsh(1) - .5) * 0 - x * LW * s * .0, HZP + (YBP - HZP) * s + 4, s * 1.1 + .02, T); continue; }
      const o = it.o, q = pilProj(o); if (q.s < .05) continue;
      if (o.hit && !flagged(o.i)) { if (o.sand) sandbar(q.sx, q.sy, q.w, o.ph); else coralHead(q.sx, q.sy, q.w * 1.2, T, o.ph, false); }
      const age = T - flagAt[o.i], drop = age >= 0 && age < .3 ? (1 - ease(age / .3)) * 90 * q.s : 0;
      const ring = .5 + .5 * Math.sin(T * 6 + o.i);
      X.globalAlpha = .55 + .35 * ring; X.strokeStyle = '#fff'; X.lineWidth = Math.max(1.5, 4 * q.s); X.setLineDash([10 * q.s + 3, 8 * q.s + 3]); el(q.sx, q.sy, q.w * (1.05 + .05 * ring) + 6 * q.s, (q.w * (1.05 + .05 * ring) + 6 * q.s) * .3); X.stroke(); X.setLineDash([]); X.globalAlpha = 1;
      if (o.sand) { flag(q.sx - q.w * .55, q.sy - drop, 92 * q.s, T, o.i); flag(q.sx + q.w * .45, q.sy - drop, 92 * q.s, T, o.i + 2); }
      else flag(q.sx - 6 * q.s, q.sy - drop, 100 * q.s, T, o.i);
    }
    // wake
    const wv = v / VM;
    if (wv > .05 && !lost) { for (const sd of [-1, 1]) { X.globalAlpha = .75 * wv; line([[400 + sd * 40, 500], [400 + sd * (100 + wv * 80), 560], [400 + sd * (170 + wv * 160), 610]], 10, '#fff', null); X.globalAlpha = 1; } }
    for (const b of spl) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); if (b.plank) { X.save(); X.translate(b.x, b.y); X.rotate(a * 9); rr(-12, -4, 24, 8, 2); ink('#c98f4e', 2.5); X.restore(); } else { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink('#eaffff', 2, '#2a86a6'); } X.globalAlpha = 1; }
    // the bow with the lookout on it
    X.save(); X.translate(400, 470); X.rotate(roll + (lost && rk >= 0 ? -.08 * Math.min(1, rk * 5) : 0));
    cel('#f4f0e6', '#c9c5d6', () => { X.beginPath(); X.moveTo(0, -18); X.quadraticCurveTo(26, 40, 140, 140); X.lineTo(-140, 140); X.quadraticCurveTo(-26, 40, 0, -18); X.closePath(); }, 18, -4);
    X.beginPath(); X.moveTo(0, -4); X.quadraticCurveTo(18, 40, 96, 140); X.lineTo(-96, 140); X.quadraticCurveTo(-18, 40, 0, -4); X.closePath(); ink('#d9edf2', 3); glint(-24, 44, 9, 30, .35, .5);
    line([[-6, 8], [-96, 140]], 5, '#2fc0d6'); line([[6, 8], [96, 140]], 5, '#2fc0d6');
    X.beginPath(); X.arc(0, 4, 8, 0, TAU); ink('#ffd23f', 3);
    X.restore();
    const pcol = (D.partner && D.partner.color) || '#6EA8FE', jump = won && rk >= 0 ? Math.abs(Math.sin(rk * 9)) * 18 : 0;
    X.save(); X.translate(400, 520 - jump); X.rotate(roll);
    arm(3.3, -1, won ? -2.7 + Math.sin(T * 14) * .3 : -.9, 1, pcol); arm(3.3, 1, won ? 2.7 - Math.sin(T * 14) * .3 : .9, 1, pcol);
    caos(0, 0, 3.3, { col: pcol, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (T < 3.5 && !g.result) pill(400, 450, 'YOUR FRIEND', pcol);
    X.restore();
    // dashboard
    X.beginPath(); X.moveTo(0, H); X.lineTo(0, 556); X.quadraticCurveTo(400, 530, W, 556); X.lineTo(W, H); X.closePath(); ink('#3f5b8f', 5); X.fillStyle = 'rgba(255,255,255,.16)'; X.beginPath(); X.moveTo(0, 562); X.quadraticCurveTo(400, 536, W, 562); X.lineTo(W, 572); X.quadraticCurveTo(400, 546, 0, 572); X.fill();
    // wheel
    X.save(); X.translate(230, 650); X.rotate((xT - x) * .5 + bank * 3); X.beginPath(); X.arc(0, 0, 128, 0, TAU); X.lineWidth = 22; X.strokeStyle = INK; X.stroke(); X.lineWidth = 12; X.strokeStyle = '#d9a441'; X.stroke();
    X.fillStyle = '#d9a441'; X.fillRect(-4, -122, 8, 110); X.fillStyle = INK; X.beginPath(); X.arc(0, -6, 9, 0, TAU); X.fill(); X.restore();
    for (const hx of [160, 300]) { rr(hx - 14, 548 + Math.sin(T * 9) * 1, 28, 28, 6); ink(myCol(), 3.5); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(hx - 9, 553, 10, 8); }
    // throttle slot + lever
    rr(520, 566, 230, 22, 11); ink('#243556', 3.5); txt('GAS', 484, 577, 18, '#fff', 'center', 56);
    const lx = 536 + goT * 198; rr(lx - 14, 552, 28, 50, 9); ink(goT > .5 ? '#ff5c5c' : '#ffd23f', 3.5); glint(lx - 5, 562, 4, 8, 0, .6);
    if (T < 3.5 && !g.result) pill(230, 530, 'YOU', myCol());
    if (T < 3 && !g.result) DUO.demoFinger(lx, 585 + Math.sin(T * 5) * 3, true, (T * 2) % 1);
    progress(T, P / (LEN - BOW));
    // payoffs
    if (won && rk >= 0) {
      for (const c of conf) { X.save(); X.translate(c.x + Math.sin(T * 3 + c.ph) * 12, c.y); X.rotate(T * 4 + c.ph); X.fillStyle = c.c; X.fillRect(-5, -3, 10, 6); X.restore(); }
      for (let i = 0; i < 3; i++) { const q = (rk * 1.4 + i / 3) % 1; X.globalAlpha = (1 - q) * .8; X.lineWidth = 5; X.strokeStyle = '#fff'; X.beginPath(); X.arc(400, 470, 40 + q * 220, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); X.globalAlpha = 1; }
      badge('LOS ROQUES!', 400, 300, 50, '#ffb23d', '#fff', outBack(rk / .28) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 2) : 1), -.06);
      if (rk > .45) badge('MADE IT!', 400, 372, 34, '#2fa84a', '#fff', outBack((rk - .45) / .22), .05);
    }
    if (lost && rk >= 0) {
      if (hitIdx >= 0) { badge('CRUNCH!', 400, 300, 56, '#e8434f', '#fff', outBack(rk / .22), -.07); if (rk > .35) badge('HULL RIPPED!', 400, 372, 30, '#7e5bd6', '#fff', outBack((rk - .35) / .22), .04); star(400, 440, 60 * Math.min(1, rk * 6), 28, 9, rk * 2, '#ffe14d', 4); }
      else { badge('TOO SLOW!', 400, 320, 50, '#e8434f', '#fff', outBack(rk / .22), -.05); }
    }
  }

  /* ═════ lookout ═════ */
  let LBG = null;
  function bakeL() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
    const sk = X.createLinearGradient(0, 0, 0, HZL); sk.addColorStop(0, '#4fb8ff'); sk.addColorStop(1, '#fff0cc'); X.fillStyle = sk; X.fillRect(0, 0, W, HZL);
    X.beginPath(); X.arc(100, 70, 28, 0, TAU); ink('#ffe14d', 4); glint(92, 62, 10, 6, -.6, .8);
    farCays(HZL);
    const sg = X.createLinearGradient(0, HZL, 0, H); sg.addColorStop(0, '#b9fbe9'); sg.addColorStop(.4, '#6fe9d4'); sg.addColorStop(1, '#2bc7cc'); X.fillStyle = sg; X.fillRect(0, HZL, W, H - HZL);
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, HZL); X.lineTo(W, HZL); X.stroke();
    X = old; return cv;
  }
  function drawLookout(T, won, lost, rk) {
    if (!LBG) LBG = bakeL(); ctx.drawImage(LBG, 0, 0);
    for (const [sx0, y, s] of [[300, 56, .7], [620, 90, .55]]) cloud(((T * 8 + sx0) % 980) - 120, y, s);
    // seabed ripples + caustics scrolling with the boat
    const n0 = Math.floor(pView / 70);
    for (let k = 20; k >= 0; k--) {
      const d0 = k * 70 - (pView % 70) - BOW; if (d0 < -30) continue; const idx = n0 + k, s = proj(Math.max(1, d0)), y = HZL + (YBL - HZL) * s;
      for (let j = 0; j < 4; j++) { const wx = (hsh(idx * 4 + j + 50) - .5) * 8 - 0, px = 400 + (wx - xView) * LW * s, wd = (24 + 30 * hsh(idx + j * 5)) * s * 1.6;
        X.globalAlpha = .4; line([[px - wd, y + 1], [px - wd * .3, y - 3 * s - 1], [px + wd * .3, y - 3 * s - 1], [px + wd, y + 1]], Math.max(1.2, 4 * s), (j & 1) ? '#fff' : '#e9fff6', null); X.globalAlpha = 1; }
    }
    // fish crossing (background gag)
    for (let i = 0; i < 5; i++) { const fx = ((T * (40 + i * 11) + i * 190) % 960) - 80, fy = 250 + i * 50 + Math.sin(T * 2 + i) * 8; X.save(); X.translate(fx, fy); X.beginPath(); X.moveTo(-10, 0); X.lineTo(-18, -6); X.lineTo(-18, 6); X.closePath(); ink(['#ffd23f', '#ff7a59', '#4db8ff'][i % 3], 2, DEEP); el(0, 0, 12, 7); ink(['#ffd23f', '#ff7a59', '#4db8ff'][i % 3], 2, DEEP); X.fillStyle = INK; X.beginPath(); X.arc(6, -1.5, 1.6, 0, TAU); X.fill(); X.restore(); }
    // the tempting turtle drifts across the far right
    if (!lost) turtle(((1 - ((T * .05) % 1)) * 1100) - 150, 300 + Math.sin(T) * 6, .8, T, 0, -1);
    // obstacles, far to near
    const vis = obs.filter(o => { const q = lookProj(o); return q.d > -40 && q.d < 1900; }).sort((a, b) => b.p - a.p);
    for (const o of vis) {
      const q = lookProj(o), fl = flagged(o.i);
      if (q.d < -40) continue;
      if (o.sand) sandbar(q.sx, q.sy, q.w, o.ph); else coralHead(q.sx, q.sy, q.w, T, o.ph, true);
      if (!fl && !g.result && q.s > .1) for (let b = 0; b < 3; b++) { const k = (T * .8 + b / 3 + o.i * .37) % 1; X.globalAlpha = (1 - k) * .8; X.beginPath(); X.arc(q.sx + (b - 1) * q.w * .5 + Math.sin(T * 3 + b) * 3, q.sy - q.w * (.6 + k * 1.2), Math.max(2, q.w * .09), 0, TAU); ink('#eaffff', 1.5, '#2a86a6'); X.globalAlpha = 1; }
      if (fl) {
        const age = T - flagAt[o.i], drop = age >= 0 && age < .25 ? (1 - ease(age / .25)) * 220 * q.s : 0;
        if (o.sand) { flag(q.sx - q.w * .55, q.sy - drop, 92 * q.s, T, o.i); flag(q.sx + q.w * .45, q.sy - drop, 92 * q.s, T, o.i + 2); } else flag(q.sx - 6 * q.s, q.sy - drop, 100 * q.s, T, o.i);
        if (age >= .25 && age < .7) { const k = (age - .25) / .45; X.globalAlpha = 1 - k; X.lineWidth = 4; X.strokeStyle = '#fff'; el(q.sx, q.sy, q.w * (1 + k * .6), q.w * (1 + k * .6) * .3); X.stroke(); X.globalAlpha = 1; }
      }
    }
    if (tapMiss && T - tapMiss.t0 < .4) { const k = (T - tapMiss.t0) / .4; X.globalAlpha = 1 - k; X.lineWidth = 3; X.strokeStyle = '#fff'; el(tapMiss.x, tapMiss.y, 10 + k * 22, (10 + k * 22) * .4); X.stroke(); X.globalAlpha = 1; }
    // the island ahead on the horizon
    const dI = LEN + 140 - (pView + BOW); if (dI > -200 && dI < 7000) { const s = proj(Math.max(1, dI)); island(400, HZL + 6 + (YBL - HZL) * s * .4, Math.max(.05, s * .9), T); }
    // the bow deck, the lookout, and the pilot's little cabin window
    X.save(); const sway = Math.sin(T * 4) * 2; X.translate(0, sway);
    cel('#f4f0e6', '#c9c5d6', () => { X.beginPath(); X.moveTo(-20, 600); X.lineTo(-20, 548); X.quadraticCurveTo(400, 500, 820, 548); X.lineTo(820, 600); X.closePath(); }, 0, -10);
    X.beginPath(); X.moveTo(-20, 560); X.quadraticCurveTo(400, 514, 820, 560); X.lineWidth = 8; X.strokeStyle = '#2fc0d6'; X.stroke();
    for (let i = 0; i < 9; i++) { const bx = 40 + i * 90, by = 548 - Math.sin(i / 8 * Math.PI) * 36 * .0; line([[bx, 560 - 14 * Math.sin(i / 8 * Math.PI) + 8], [bx, 528 - 14 * Math.sin(i / 8 * Math.PI)]], 5, '#ffd23f'); }
    X.restore();
    const wave = lost && rk >= 0;
    X.save(); X.translate(170, 592 + sway); const hop = won && rk >= 0 ? Math.abs(Math.sin(rk * 9)) * 16 : 0; X.translate(0, -hop);
    const wv = Math.sin(T * 14) * .35;
    arm(5, -1, wave ? -2.6 + wv : won ? -2.8 + wv : -.5, 1, myCol()); arm(5, 1, wave ? 2.6 - wv : won ? 2.8 - wv : plantAt > 0 && T - plantAt < .25 ? 1.5 : .6, 1, myCol());
    caos(0, 0, 5, { col: myCol(), mood: won ? 'happy' : wave ? 'happy' : null });
    X.fillStyle = INK; rr(-30, -12.6 * 5 - 8, 60, 18, 6); X.fill(); rr(-27, -12.6 * 5 - 6, 54, 12, 5); X.fillStyle = '#fff'; X.fill(); X.fillStyle = '#e8434f'; X.fillRect(-27, -12.6 * 5 - 1, 54, 4);
    X.restore();
    if (T < 3.5 && !g.result) pill(170, 592 - 12.6 * 5 - 36, 'YOU', myCol());
    const pc = (D.partner && D.partner.color) || '#6EA8FE';
    rr(600, 556, 180, 44, 12); ink('#7ad8e0', 3.5); X.save(); rr(606, 562, 168, 32, 9); X.clip(); X.fillStyle = '#243556'; X.fillRect(600, 556, 180, 44); caos(690, 600, 2.2, { col: pc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (T < 3.5 && !g.result) pill(690, 530, 'YOUR FRIEND', pc);
    if (T < 3 && !g.result) { const t0 = obs.find(o => { const q = lookProj(o); return q.d > 200 && !flagged(o.i); }); if (t0) { const q = lookProj(t0); DUO.demoFinger(q.sx, q.sy - q.w * .4 + Math.sin(T * 5) * 3, true, (T * 2) % 1); } }
    progress(T, pView / (LEN - BOW));
    if (won && rk >= 0) {
      for (const c of conf) { X.save(); X.translate(c.x + Math.sin(T * 3 + c.ph) * 12, c.y); X.rotate(T * 4 + c.ph); X.fillStyle = c.c; X.fillRect(-5, -3, 10, 6); X.restore(); }
      badge('LOS ROQUES!', 400, 280, 50, '#ffb23d', '#fff', outBack(rk / .28) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 2) : 1), -.06);
      if (rk > .45) badge('MADE IT!', 400, 352, 34, '#2fa84a', '#fff', outBack((rk - .45) / .22), .05);
    }
    if (lost && rk >= 0) {
      const k = ease(rk / .5), tx = lerp(950, 560, k), ty = lerp(330, 420, k);
      turtle(tx, ty, 1.6, T, rk > .5 ? 1 : 0, -1);
      badge('HELLO, TURTLE!', 400, 250, 38, '#2b9ee6', '#fff', outBack((rk - .3) / .22), -.05);
      if (rk > .9) badge('OOPS...', 400, 320, 26, '#e8434f', '#fff', outBack((rk - .9) / .22), .04);
    }
  }

  g.dbg = {
    LEN, BOW, HW, XM, toPx,
    /* pilot's screen: own state + the flags in view (distance ahead of the bow, lateral position, danger radius) - never the unflagged hazards */
    pview: () => ({ P, x, v, xT, VM, LS, bowAhead: LEN - (P + BOW), flags: obs.filter(o => flagged(o.i) && o.p - (P + BOW) > -40).map(o => ({ d: o.p - (P + BOW), x: o.x, r: o.r })) }),
    /* lookout's screen: what is visible through the water (screen position) and whether it already carries a flag */
    lview: () => ({ pView, items: obs.map(o => { const q = lookProj(o); return { i: o.i, d: q.d, sx: q.sx, sy: q.sy - (o.sand ? 0 : q.w * .45), flagged: flagged(o.i) }; }).filter(o => o.d > -10 && o.d < 1500) }),
    truth: () => ({ P, x, v, fmask, hitIdx }),
  };
  wire(g, D, 0, sp, 'du_lancha');
  return g;
}
reg('du_lancha', duLancha, 'LANCHA A LOS ROQUES'); REGMAP.du_lancha.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  const sk = X.createLinearGradient(0, 0, 0, 80); sk.addColorStop(0, '#4fb8ff'); sk.addColorStop(1, '#fff0cc'); X.fillStyle = sk; X.fillRect(0, 0, 520, 80);
  const sg = X.createLinearGradient(0, 80, 0, 240); sg.addColorStop(0, '#b9fbe9'); sg.addColorStop(.5, '#37d6d0'); sg.addColorStop(1, '#0d9dba'); X.fillStyle = sg; X.fillRect(0, 80, 520, 160);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 80); X.lineTo(520, 80); X.stroke();
  const cx = 260 + (role === 0 ? 120 * Math.sin(u / 4 * TAU) * .0 : 0);
  if (role === 0) {
    const bx = u < 2 ? lerp(260, 380, ease(u / 1.5)) : lerp(380, 260, ease((u - 2) / 1.5));
    for (const [fx, fy, fs] of [[300, 120, .8], [200, 150, 1.0]]) { X.globalAlpha = .7; X.strokeStyle = '#fff'; X.lineWidth = 3; X.setLineDash([8, 6]); el(fx, fy, 38 * fs, 12 * fs); X.stroke(); X.setLineDash([]); X.globalAlpha = 1; flag(fx - 4, fy, 60 * fs, tt, fx); }
    cel('#f4f0e6', '#c9c5d6', () => { X.beginPath(); X.moveTo(bx, 150); X.quadraticCurveTo(bx + 16, 190, bx + 84, 250); X.lineTo(bx - 84, 250); X.quadraticCurveTo(bx - 16, 190, bx, 150); X.closePath(); }, 12, -3);
    line([[bx - 90, 225], [bx - 60, 205]], 6, '#fff', null); line([[bx + 90, 225], [bx + 60, 205]], 6, '#fff', null);
    DUO.demoFinger(lerp(150, 330, ease(u < 2 ? u / 1.5 : 1 - (u - 2) / 1.5)), 215, true, u % 1);
    badge('STEER BY THE FLAGS!', 260, 26, 16, '#2b9ee6', '#fff', 1, -.02);
  } else {
    const k = u % 2 / 2;
    coralHead(150, 150, 36, tt, 2, true); coralHead(350, 120, 28, tt, 5, true); sandbar(250, 190, 54, 3);
    const planted = u > 1.2; if (planted) flag(146, 150, 70, tt, 1);
    DUO.demoFinger(planted ? 350 : 150, planted ? 105 : 130, u > .6 && u < 1.6 || u > 2.4 && u < 3.2, (u % 1));
    if (u > 2.6) flag(346, 120, 56, tt, 4);
    turtle(((1 - tt * .1 % 1) * 700) - 100, 100, .6, tt, 0, -1);
    badge('FLAG THE CORAL!', 260, 26, 16, '#c98a12', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_lancha = [['PILOT', 'DODGE WHAT THE LOOKOUT FLAGS', 'HOLD TO GO, DRAG TO STEER'], ['LOOKOUT', 'FLAG THE CORAL FOR THE PILOT', 'TAP THE CORAL']];
DUO.DEMOS.du_lancha = [t => demo(0, t), t => demo(1, t)];

})();
