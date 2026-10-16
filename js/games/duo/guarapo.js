'use strict';
/* ═════════ DUO · GUARAPO (du_guarapo): a sugar-cane press (trapiche) in the plaza, fresh juice for the whole street ═════════
   THE CRANK (role 0): sees only the big flywheel and a speed dial. A CONTINUOUS CIRCULAR GESTURE: drag the finger / mouse round and round the crank
   (the game measures the ANGULAR SPEED, never the position; direction does not matter, going back and forth cancels out). Keys for desktop:
   ▲ ▼ (or W S) = faster / slower. The speed decides which lane the juice falls into (three coloured bands on the dial = three lanes), but the
   dial lies a little: the press drifts slowly, so the crank has to listen to the friend. Also sees the tally of full glasses and a spill bucket.
   THE GLASS (role 1, JUDGE): sees where the juice really falls but cannot control it. Moves the glass between the 3 lanes (tap / drag sideways anywhere,
   or ◄ ► / A D). Juice in the glass fills it; juice anywhere else is spilled. Say "faster" / "slower" / "yellow!" to your friend.
   WIN: 5 full glasses before too much is spilled and before time runs out. LOSE: too much spilled, or time out. Gags: win = the last glass overflows and
   splashes the vendor; lose = a hen jams the press (or drinks the puddle).
   Netcode (absolute, latest, re-sent every .5 s so a dropped message never matters): the CRANK owns the speed and publishes 'w' [omega*100];
   the GLASS owns cup + judging and publishes 'q' [cups, spill%]; 'end' comes from wire(). The drift of the press is drawn from mkR(), identical on both. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only

/* ───────────── tuning ───────────── */
const NEED = 5, FT = 1.25, SPM = 3.2, GRACE = 1.4, SWAP = .35;   // glasses to win, seconds of juice per glass, seconds of spill allowed, no-spill intro, glass swap time
const LANEX = [220, 400, 580], LC = ['#ff5a5a', '#ffd23f', '#4db8ff'];   // lane x on the counter, lane colours (shared by dial and counter plates)
const WC = [1.0, 1.8, 2.6], WHALF = .38, WMAX = 3.6;              // crank speed (rev/s) at the centre of each lane, half width of a lane band, dial full scale
const KX = 225, JX0 = 130, JX1 = 670, CR = 86;                    // px of landing per rev/s, landing limits, glass catch radius
const DRIFT = .15;                                                // rev/s the press wanders (the dial lies by this much)
const CXC = 250, CYC = 330;                                       // crank centre on the crank screen
const CY0 = 413, CYB = 503, CEY = 548;                            // glass top / base, counter top
const JC = '#d6e84e', JS = '#a9c12c', JL = '#f6fcb0', CANE = '#7fcf4a';
const GL = ['#ff5a5a', '#ffd23f', '#4db8ff'];

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
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(400, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 400); X.restore();
}
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
function cloud(x, y, s) { X.save(); X.translate(x, y); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink('#f2fbff', 3, '#6aa7d8'); } X.restore(); }

/* the vendor: feet at (x, y), s = scale, mood null | 'happy' | 'sad' | 'splat' (k = splat growth 0..1) */
function vendor(x, y, s, T, mood, k) {
  const bob = Math.sin(T * 3) * s, lw = Math.max(2, 3.5 * s);
  X.save(); X.translate(x, y + bob * .5);
  cel('#f4f0e6', '#c9c5d6', () => rr(-34 * s, -72 * s, 68 * s, 72 * s, 14 * s), 8 * s, 0, lw);
  cel('#2fa84a', '#1f7d36', () => rr(-26 * s, -50 * s, 52 * s, 50 * s, 10 * s), 7 * s, 0, lw);
  rr(-12 * s, -40 * s, 24 * s, 16 * s, 4 * s); ink('#26923f', lw * .6);
  const hy = -98 * s - (mood === 'happy' ? Math.abs(Math.sin(T * 9)) * 6 * s : 0);
  cel('#e8b07a', '#bf8650', () => el(0, hy, 24 * s, 26 * s), 6 * s, -3 * s, lw);
  // mustache
  X.fillStyle = INK; el(-8 * s, hy + 9 * s, 10 * s, 4.5 * s, .35); X.fill(); el(8 * s, hy + 9 * s, 10 * s, 4.5 * s, -.35); X.fill();
  if (mood === 'splat') { X.strokeStyle = INK; X.lineWidth = Math.max(2, 2.5 * s); X.beginPath(); X.arc(-9 * s, hy - 4 * s, 4 * s, Math.PI * 1.1, Math.PI * 1.9); X.arc(9 * s, hy - 4 * s, 4 * s, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
  else { X.fillStyle = INK; el(-9 * s, hy - 4 * s, 3 * s, mood === 'sad' ? 3 * s : 3.6 * s); X.fill(); el(9 * s, hy - 4 * s, 3 * s, mood === 'sad' ? 3 * s : 3.6 * s); X.fill(); glint(-10 * s, hy - 6 * s, 1.1 * s, 1.1 * s, 0, .9); glint(8 * s, hy - 6 * s, 1.1 * s, 1.1 * s, 0, .9); }
  X.strokeStyle = INK; X.lineWidth = Math.max(2, 2.4 * s); X.beginPath();
  if (mood === 'sad') X.arc(0, hy + 24 * s, 7 * s, Math.PI * 1.15, Math.PI * 1.85); else X.arc(0, hy + 14 * s, 6 * s, .15, Math.PI - .15);
  X.stroke();
  // straw hat
  cel('#f2d27a', '#d1a845', () => el(0, hy - 18 * s, 44 * s, 9 * s), 8 * s, -2 * s, lw);
  cel('#f2d27a', '#d1a845', () => { X.beginPath(); X.moveTo(-22 * s, hy - 20 * s); X.quadraticCurveTo(-20 * s, hy - 44 * s, 0, hy - 44 * s); X.quadraticCurveTo(20 * s, hy - 44 * s, 22 * s, hy - 20 * s); X.closePath(); }, 6 * s, -2 * s, lw);
  line([[-22 * s, hy - 24 * s], [22 * s, hy - 24 * s]], Math.max(2, 5 * s), '#e8434f', null);
  if (mood === 'splat' && k > 0) {
    const q = outBack(k);
    X.beginPath(); X.moveTo(-40 * s * q, hy - 12 * s); X.bezierCurveTo(-30 * s, hy - 46 * s * q, 30 * s, hy - 40 * s * q, 40 * s * q, hy - 10 * s); X.bezierCurveTo(46 * s * q, hy + 22 * s * q, 20 * s, hy + 34 * s * q, 0, hy + 26 * s * q); X.bezierCurveTo(-24 * s, hy + 36 * s * q, -46 * s * q, hy + 18 * s * q, -40 * s * q, hy - 12 * s); X.closePath(); ink(JC, Math.max(2, 3 * s));
    glint(-14 * s, hy - 16 * s, 7 * s * q, 3 * s * q, -.4, .7);
    for (let i = 0; i < 3; i++) { const dl = (18 + i * 14) * s * ease(k) * (.6 + hsh(i + 4) * .6); line([[(-16 + i * 16) * s, hy + 28 * s], [(-16 + i * 16) * s, hy + 28 * s + dl]], Math.max(2, 4 * s), JC); }
  }
  X.restore();
}
/* a hen: feet at (x, y), pose 'walk' | 'peck' | 'sit' | 'shock' */
function hen(x, y, s, T, pose, flip) {
  const lw = Math.max(1.5, 3 * s), pk = pose === 'peck' ? Math.abs(Math.sin(T * 10)) : 0, wob = pose === 'shock' ? Math.sin(T * 30) * 3 * s : 0;
  X.save(); X.translate(x + wob, y); X.scale((flip || 1) * s, s);
  if (pose !== 'sit') { line([[-6, -2], [-8, -16]], 3, '#ffb23d'); line([[7, -2], [9, -16]], 3, '#ffb23d'); line([[-12, 0], [-4, 0]], 3, '#ffb23d'); line([[4, 0], [12, 0]], 3, '#ffb23d'); }
  X.beginPath(); X.moveTo(-22, -34); X.lineTo(-38, -52 + Math.sin(T * 8) * (pose === 'shock' ? 4 : 0)); X.lineTo(-26, -24); X.lineTo(-36, -36); X.closePath(); ink('#e0a46a', 2.5);
  cel('#fff6e0', '#d9cdb0', () => el(0, -26, 26, 22), 6, -4, 3);
  el(-2, -24, 13, 9, .3); ink('#f0d9a8', 2.5);
  const hx = 18, hy = -42 + pk * 16, hr = pose === 'shock' ? -3 : 0;
  line([[10, -34], [hx, hy + 8]], 9, '#fff6e0');
  X.beginPath(); X.arc(hx, hy, 10, 0, TAU); ink('#fff6e0', 3);
  for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(hx - 5 + i * 5, hy - 10 + hr, 4, 0, TAU); ink('#e8434f', 2); }
  X.beginPath(); X.moveTo(hx + 8, hy - 2); X.lineTo(hx + 20, hy + 2); X.lineTo(hx + 8, hy + 5); X.closePath(); ink('#ffb23d', 2);
  X.beginPath(); X.moveTo(hx + 9, hy + 5); X.quadraticCurveTo(hx + 11, hy + 14, hx + 8, hy + 14); ink('#e8434f', 2);
  X.fillStyle = INK; el(hx + 3, hy - 3, 2, pose === 'shock' ? 3.4 : 2.4); X.fill();
  X.restore();
}
function cane(x, y, h, lean, T, ph) {          // a few cane stalks
  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * 9, tl = lean + (i - 1.5) * 4 + Math.sin(T * 2 + ph + i) * 1.5;
    line([[x + dx, y], [x + dx + tl, y - h * (.85 + .08 * (i % 2))]], 8, CANE);
    for (let n = 1; n < 4; n++) line([[x + dx + tl * n / 4 - 4, y - h * n * .22], [x + dx + tl * n / 4 + 4, y - h * n * .22]], 2, '#4d9a2a', null);
    line([[x + dx + tl, y - h * .85], [x + dx + tl - 14, y - h * 1.0 - (i % 2) * 6]], 5, '#3fae52'); line([[x + dx + tl, y - h * .85], [x + dx + tl + 14, y - h * 1.02]], 5, '#3fae52');
  }
}
/* a juice glass: centre x, base y; fill 0..1 (liquid height), wob = surface wobble */
function glass(x, y, sc, fill, T, full) {
  const tw = 48 * sc, bw = 35 * sc, h = 90 * sc, lw = Math.max(2, 3.5 * sc);
  const build = () => { X.beginPath(); X.moveTo(x - tw, y - h); X.lineTo(x + tw, y - h); X.lineTo(x + bw, y); X.lineTo(x - bw, y); X.closePath(); };
  X.fillStyle = 'rgba(230,248,255,.55)'; build(); X.fill();
  if (fill > .005) {
    const ly = y - 6 * sc - (h - 8 * sc) * clamp(fill, 0, 1.04); X.save(); build(); X.clip();
    X.fillStyle = JC; X.beginPath(); X.moveTo(x - tw, y + 4); X.lineTo(x - tw, ly);
    for (let i = 0; i <= 8; i++) X.lineTo(x - tw + i * tw * 2 / 8, ly + Math.sin(T * 9 + i * 1.3) * 2.2 * sc);
    X.lineTo(x + tw, y + 4); X.closePath(); X.fill();
    X.fillStyle = JS; X.fillRect(x + bw * .15, ly, tw, h); X.fillStyle = JL;
    for (let i = 0; i < 5; i++) { X.beginPath(); X.arc(x - tw * .7 + i * tw * .35, ly + 1 + Math.sin(T * 7 + i) * 1.5, 5 * sc, 0, TAU); X.fill(); }
    X.restore();
  }
  build(); X.lineWidth = lw * 2; X.lineJoin = 'round'; X.strokeStyle = INK; X.stroke();
  X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.moveTo(x - tw * .78, y - h + 8 * sc); X.lineTo(x - tw * .55, y - h + 8 * sc); X.lineTo(x - bw * .52, y - 10 * sc); X.lineTo(x - bw * .74, y - 10 * sc); X.closePath(); X.fill();
  if (full) { X.strokeStyle = INK; X.lineWidth = lw; X.beginPath(); X.moveTo(x - tw - 3, y - h); X.lineTo(x + tw + 3, y - h); X.stroke(); }
}

/* ═════════ the game ═════════ */
function duGuarapo(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), crank = D.role === 0, TS = Math.sqrt(sp);
  /* the level (identical draws on both screens): where the cup starts, the phases of the press' drift */
  const startLane = R() < .5 ? 0 : 2, ph1 = R() * TAU, ph2 = R() * TAU, henX = 120 + R() * 560;
  const drift = T => DRIFT * (Math.sin(T * 1.1 + ph1) + .5 * Math.sin(T * 2.3 + ph2)) / 1.5;
  const FTS = FT / TS, SPS = SPM / TS;
  const pops = [], spl = [], conf = [], fly = [];
  let resAt = -1, loseKind = '', lastQ = '', qSent = -9, lastW = -1, wSent = -9;
  /* ----- the crank's state ----- */
  let drag = false, lastA = null, crankA = 0, wMeas = 0, wKey = 0, kU = false, kD = false; const win = [];
  let rCups = 0, rSpill = 0, spilled50 = false;                          // what the crank sees of the glass screen
  /* ----- the glass' state (judge) ----- */
  let wV = 0, jetOn = false, jx = 400, lane = startLane, cupX = LANEX[startLane], fill = 0, cups = 0, spill = 0, swap = 0, rollA = 0, recvW = 0;
  let hold = false;
  const pop = (s, px, py, size, bgc, fg) => { pops.push({ s, x: px, y: py, size, bgc, fg, t0: g.c, rot: (hsh(g.c * 9 + pops.length) - .5) * .14 }); if (pops.length > 3) pops.shift(); };
  const drops = (px, py, n, up, col) => { for (let i = 0; i < n; i++) spl.push({ x: px + (hsh(i + g.c * 7) - .5) * 40, y: py, vx: (hsh(i * 3 + g.c) - .5) * 280, vy: -(up || 160) - hsh(i * 7 + g.c) * 220, t0: g.c, life: .6 + hsh(i) * .4, r: 3 + hsh(i * 5) * 4, c: col || JC }); };
  const mapJ = w => clamp(400 + (w + drift(g.c) - WC[1]) * KX, JX0, JX1);

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: crank ? 'CRANK IT!' : 'CATCH THE JUICE!', roleLabel: crank ? 'THE CRANK' : 'THE GLASS',
    hint: crank ? 'DRAW CIRCLES WITH YOUR FINGER AROUND THE CRANK (OR USE ▲ ▼). THE FASTER YOU SPIN, THE FURTHER THE JUICE FLIES. YOUR FRIEND SEES WHERE IT FALLS - LISTEN TO "FASTER" AND "SLOWER"! FILL 5 GLASSES' : 'MOVE THE GLASS BETWEEN THE 3 LANES (DRAG OR ◄ ►) TO CATCH THE JUICE. YOU CANNOT CONTROL THE FLOW - TELL YOUR FRIEND "FASTER", "SLOWER" OR THE COLOUR! FILL 5 GLASSES WITHOUT SPILLING TOO MUCH',
    thint: crank ? 'CIRCLE YOUR FINGER AROUND THE CRANK. FASTER OR SLOWER AS YOUR FRIEND SAYS' : 'DRAG SIDEWAYS TO PUT THE GLASS UNDER THE JUICE. TELL YOUR FRIEND FASTER OR SLOWER',
    update(dt) {
      g.c += dt; const T = g.c, done = !!g.result;
      if (g.result && resAt < 0) {
        resAt = T;
        if (g.result === 'win') { for (let i = 0; i < 46; i++) conf.push({ x: hsh(i) * 800, y: -20 - hsh(i + 3) * 300, vy: 90 + hsh(i + 9) * 150, ph: hsh(i + 17) * 6, c: ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A', '#ff9f43'][i % 5] }); sfx.sparkle && sfx.sparkle(); }
        else { sfx.miss && sfx.miss(); if (!crank) shake && shake(8, .3); }
      }
      for (let i = spl.length - 1; i >= 0; i--) { const b = spl[i]; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) spl.splice(i, 1); }
      for (let i = fly.length - 1; i >= 0; i--) if (T - fly[i].t0 > .5) fly.splice(i, 1);
      for (const c of conf) { c.y += c.vy * dt; if (c.y > 620) c.y = -20; }
      if (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      if (crank) {
        if (kU) wKey = Math.min(WMAX, wKey + 1.6 * dt); if (kD) wKey = Math.max(0, wKey - 1.6 * dt);
        if (done && g.result === 'lose') { win.length = 0; wKey = 0; }
        crankA += wKey * TAU * dt;
        while (win.length && T - win[0].t > .3) win.shift();
        let sum = 0; for (const e of win) sum += e.d;
        const raw = Math.abs(sum) / TAU / .3; wMeas += (raw - wMeas) * Math.min(1, dt * 14);
        const w = Math.max(wMeas, wKey), ws = Math.round(w * 100);
        if (!done && ((ws !== lastW && T - wSent >= .08) || T - wSent >= .5)) { lastW = ws; wSent = T; D.send('w', ws, true); }
        if (done && g.result === 'win') wMeas *= .9;
        if (rSpill >= .5 && !spilled50) { spilled50 = true; if (!done) { sfx.pop && sfx.pop(); pop('JUICE ON THE FLOOR!', 400, 150, 22, '#ff7a1a', '#fff'); } }
      } else {
        wV += (recvW - wV) * Math.min(1, dt * 10);
        const w = done && g.result === 'lose' ? 0 : wV;
        rollA += w * TAU * dt * .5;
        const on = !done && w > (jetOn ? .4 : .55), tgt = mapJ(w);
        if (on && !jetOn) jx = tgt; jetOn = on; if (jetOn) jx += (tgt - jx) * Math.min(1, dt * 9);
        cupX += (LANEX[lane] - cupX) * Math.min(1, dt * 16);
        if (swap > 0) swap = Math.max(0, swap - dt);
        if (!done) {
          const caught = jetOn && swap <= 0 && Math.abs(jx - cupX) < CR;
          if (caught) {
            fill += dt / FTS; if (hsh(T * 40) < .35) drops(cupX, CYB - 80 * Math.min(1, fill), 1, 90, JL);
            if (fill >= 1) {
              cups++; fill = cups >= NEED ? 1 : 0; swap = SWAP; sfx.coin && sfx.coin(); drops(cupX, CY0, 14, 240);
              fly.push({ t0: T, x0: cupX, i: cups - 1 });
              if (cups >= NEED) g.finish('win'); else pop('GLASS FULL!', cupX, 330, 24, '#2fa84a', '#fff');
            }
          } else if (jetOn && swap <= 0 && T > GRACE) {
            spill += dt; if (hsh(T * 55) < .5) drops(jx, CEY, 1, 120);
            if (spill >= SPS) { loseKind = 'spill'; g.finish('lose'); }
          }
          if (!g.result && T >= g.limit) { loseKind = 'time'; g.finish('lose'); }
        }
        const sr = Math.round(clamp(spill / SPS, 0, 1) * 100), qs = cups + ',' + sr;
        if ((qs !== lastQ && T - qSent >= .1) || T - qSent >= .5) { lastQ = qs; qSent = T; D.send('q', [cups, sr], true); }
      }
    },
    msg(type, d) {
      if (!crank && type === 'w' && typeof d === 'number') recvW = clamp(d / 100, 0, WMAX);
      else if (crank && type === 'q' && Array.isArray(d)) {
        if (d[0] > rCups) { sfx.coin && sfx.coin(); if (!g.result) pop('GLASS FULL!', 400, 150, 24, '#2fa84a', '#fff'); }
        rCups = Math.max(rCups, d[0]); rSpill = Math.max(rSpill, d[1] / 100);
      }
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (crank) drawCrank(T, won, lost, rk); else drawGlass(T, won, lost, rk);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .85 ? Math.max(0, 1 - (a - .85) / .25) : 1; badge(q.s, clamp(q.x, 160, 640), Math.max(110, q.y - Math.min(a, .6) * 18), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(crank ? 'SPIN IN CIRCLES!' : 'CATCH THE JUICE!', 400, 250, 22, crank ? '#2b9ee6' : '#c98a12', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
    down(p) {
      if (crank) { if (g.result) return; drag = true; const dx = p.x - CXC, dy = p.y - CYC; lastA = dx * dx + dy * dy >= 900 ? Math.atan2(dy, dx) : null; return; }
      hold = true; pick(p.x);
    },
    move(p) {
      if (crank) {
        if (!drag || g.result) return; const dx = p.x - CXC, dy = p.y - CYC; if (dx * dx + dy * dy < 900) { lastA = null; return; }
        const a = Math.atan2(dy, dx); if (lastA !== null) { let d = a - lastA; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; win.push({ t: g.c, d }); crankA += d; } lastA = a;
      } else if (hold) pick(p.x);
    },
    up() { drag = false; lastA = null; hold = false; },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (crank) { if (c === 'ArrowUp' || c === 'KeyW') kU = true; else if (c === 'ArrowDown' || c === 'KeyS') kD = true; else if (c === 'Space') wKey = wKey > 0 ? 0 : WC[1]; }
      else if (!g.result) { if (c === 'ArrowLeft' || c === 'KeyA') setLane(lane - 1); else if (c === 'ArrowRight' || c === 'KeyD') setLane(lane + 1); }
    },
    keyup(e) { if (e.code === 'ArrowUp' || e.code === 'KeyW') kU = false; if (e.code === 'ArrowDown' || e.code === 'KeyS') kD = false; },
  };
  function setLane(l) { l = clamp(l, 0, 2); if (l !== lane) { lane = l; sfx.click && sfx.click(); } }
  function pick(px) { if (!g.result) setLane(px < 300 ? 0 : px < 500 ? 1 : 2); }

  /* ───────── shared scenery ───────── */
  function wallBase() {
    const wg = X.createLinearGradient(0, 0, 0, 548); wg.addColorStop(0, '#ffe7b8'); wg.addColorStop(1, '#ffc98a'); X.fillStyle = wg; X.fillRect(0, 0, W, 548);
    X.fillStyle = '#7fd1c8'; X.fillRect(0, 380, W, 168); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 380); X.lineTo(W, 380); X.stroke();
    X.fillStyle = 'rgba(20,16,28,.12)'; for (let i = 0; i < 16; i++) X.fillRect(i * 52, 384, 3, 160);
    // arched windows with shutters
    for (const wx of [70, 730]) {
      X.beginPath(); X.moveTo(wx - 40, 360); X.lineTo(wx - 40, 230); X.quadraticCurveTo(wx - 40, 180, wx, 180); X.quadraticCurveTo(wx + 40, 180, wx + 40, 230); X.lineTo(wx + 40, 360); X.closePath(); ink('#3d6f8f', 4);
      glint(wx - 18, 250, 5, 30, .15, .35);
      rr(wx - 74, 190, 30, 160, 5); ink('#e8434f', 3.5); rr(wx + 44, 190, 30, 160, 5); ink('#e8434f', 3.5);
    }
    // papel picado: bunting along a sagging string
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(-10, 66); X.quadraticCurveTo(400, 138, 810, 66); X.stroke();
    for (let i = 0; i < 18; i++) { const u = (i + .5) / 18, bx = u * 820 - 10, by = 66 + 2 * u * (1 - u) * 72 * 1.0 + 1; X.beginPath(); X.moveTo(bx - 14, by); X.lineTo(bx + 14, by); X.lineTo(bx, by + 30); X.closePath(); ink(['#ffd23f', '#2f6fd6', '#e8434f'][i % 3], 2.5); }
    // striped awning
    for (let i = 0; i < 10; i++) { X.beginPath(); X.moveTo(i * 80, 0); X.lineTo(i * 80 + 80, 0); X.lineTo(i * 80 + 80, 34); X.arc(i * 80 + 40, 34, 40, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff6e0' : '#e8434f', 3.5); }
  }
  function sign(cx) { rr(cx - 120, 34, 240, 46, 12); X.save(); ink('#2f6fd6', 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(cx - 108, 38, 216, 10, 5); X.fill(); X.restore(); txt('GUARAPO', cx, 58, 30, '#fff', 'center', 214); }
  function tally(cx0, cy0, n, T) {
    rr(cx0 - 14, cy0 - 20, 5 * 38 + 28, 52, 12); ink('#c98f4e', 3.5);
    for (let i = 0; i < NEED; i++) { const x = cx0 + 12 + i * 38; glass(x, cy0 + 24, .26, i < n ? 1 : 0, T, false); if (i < n) { X.fillStyle = 'rgba(255,255,255,.6)'; el(x - 5, cy0 + 8, 2, 4); X.fill(); } }
  }
  function henWalk(T, y) { const sx = ((T * 22 + henX) % 1000) - 100; hen(sx, y, .7, T, Math.sin(T * 0.7) > .6 ? 'peck' : 'walk', 1); }

  /* ═════ the glass screen (judge) ═════ */
  let GBG = null;
  function bakeG() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
    wallBase();
    // the press frame: two posts, a beam, the rail the spout slides on
    for (const px of [92, 708]) { cel('#c98f4e', '#9a6a34', () => rr(px - 16, 90, 32, 460, 5), 8, 0, 3.5); }
    cel('#c98f4e', '#9a6a34', () => rr(70, 90, 660, 34, 8), 10, -3, 4);
    line([[110, 196], [690, 196]], 8, '#aab6c4'); for (const rx of [130, 400, 670]) { X.beginPath(); X.arc(rx, 196, 8, 0, TAU); ink('#e6eef6', 2.5); }
    // counter
    X.fillStyle = 'rgba(20,16,28,.22)'; X.fillRect(0, 548, W, 8);
    cel('#f0b46a', '#d49240', () => rr(-20, 548, W + 40, 24, 4), 0, -6, 4);
    cel('#c98f4e', '#9a6a34', () => rr(-20, 572, W + 40, 60, 2), 0, -8, 4);
    X.fillStyle = 'rgba(20,16,28,.28)'; for (let i = 1; i < 8; i++) X.fillRect(i * 100 - 2, 576, 3, 26);
    for (let k = 0; k < 3; k++) { el(LANEX[k], 559, 68, 11); ink(LC[k], 3.5); glint(LANEX[k] - 24, 556, 18, 3, 0, .5); }
    X = old; return cv;
  }
  function drawGlass(T, won, lost, rk) {
    if (!GBG) GBG = bakeG(); ctx.drawImage(GBG, 0, 0);
    sign(400);
    // hopper with cane + rollers
    cel('#c98f4e', '#9a6a34', () => { X.beginPath(); X.moveTo(330, 124); X.lineTo(470, 124); X.lineTo(436, 160); X.lineTo(364, 160); X.closePath(); }, 8, -3, 3.5);
    cane(400, 126, 60, 4, T, 1);
    for (const rx of [380, 420]) { cel('#aab6c4', '#7c8a9c', () => rr(rx - 15, 158, 30, 36, 7), 7, 0, 3.5); for (let i = 0; i < 4; i++) { const ry = 160 + ((i * 9 + rollA * 14 * (rx < 400 ? 1 : -1)) % 36 + 36) % 36; if (ry < 192) { X.fillStyle = 'rgba(20,16,28,.3)'; X.fillRect(rx - 13, ry, 26, 3); } } }
    // the hose from the rollers to the spout, and the spout itself
    const sx = jetOn || !g.result ? jx : jx, hose = [[400, 192], [400, 204], [sx, 186], [sx, 204]];
    X.lineCap = 'round'; X.beginPath(); X.moveTo(400, 192); X.bezierCurveTo(400, 214, sx, 160, sx, 204); X.lineWidth = 20; X.strokeStyle = INK; X.stroke(); X.lineWidth = 12; X.strokeStyle = '#7ad8e0'; X.stroke(); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.55)'; X.stroke();
    cel('#aab6c4', '#7c8a9c', () => { X.beginPath(); X.moveTo(sx - 18, 196); X.lineTo(sx + 18, 196); X.lineTo(sx + 9, 224); X.lineTo(sx - 9, 224); X.closePath(); }, 6, 0, 3.5);
    // the jet
    const cupTop = CY0, lvl = CYB - 6 - 82 * clamp(fill, 0, 1);
    if (jetOn && !g.result) {
      const caught = swap <= 0 && Math.abs(jx - cupX) < CR, y1 = swap > 0 ? CEY : caught ? lvl : CEY, w0 = 15;
      X.beginPath(); X.moveTo(jx - w0 / 2, 222);
      for (let y = 222; y <= y1; y += 14) X.lineTo(jx - w0 / 2 + 1.6 * Math.sin(T * 20 + y * .06) - (y - 222) * .004, y);
      for (let y = y1; y >= 222; y -= 14) X.lineTo(jx + w0 / 2 - (y - 222) * .02 + 1.6 * Math.sin(T * 20 + y * .06 + 1), y);
      X.closePath(); ink(JC, 3.5);
      line([[jx - 2, 226], [jx - 2, y1 - 6]], 3, JL, null);
    }
    // splashes
    for (const b of spl) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2); X.globalAlpha = 1; }
    // spilled puddle on the counter, dripping over the front
    const sr = clamp(spill / SPS, 0, 1);
    if (sr > .01) {
      el(400, 560, 30 + sr * 330, 5 + sr * 5); ink(JC, 3); glint(330, 558, 50 * sr + 8, 2, 0, .6);
      for (let i = 0; i < 6; i++) { const dx = 80 + i * 130 + hsh(i) * 40, dl = (14 + hsh(i + 5) * 40) * sr; if (dx > 400 - 30 - sr * 330 && dx < 400 + 30 + sr * 330) line([[dx, 566], [dx, 566 + dl]], 6, JC); }
    }
    // the player (caos) holding the glass above their head
    const cw = swap > 0 ? 0 : 1, gk = swap > 0 ? outBack(1 - swap / SWAP) : 1;
    const hop = won && rk >= 0 ? Math.abs(Math.sin(rk * 9)) * 12 : 0;
    X.save(); X.translate(cupX, CEY + 2 - hop);
    arm(3.8, -1, -.28, 1, myCol()); arm(3.8, 1, .28, 1, myCol());
    caos(0, 0, 3.8, { col: myCol(), mood: won ? 'happy' : lost ? 'sad' : null });
    X.restore();
    const ov = won && rk >= 0 ? clamp(rk / .5, 0, 1) : 0;
    glass(cupX, CYB - hop, gk, fill, T, cups >= NEED);
    if (ov > 0) for (let i = 0; i < 4; i++) { const dx = (i - 1.5) * 30; line([[cupX + dx, CY0 - 2], [cupX + dx * 1.2, CY0 + 18 + ov * 60 * (.5 + hsh(i))]], 6, JC); }
    for (const f of fly) { const k = ease((T - f.t0) / .5), fx = lerp(f.x0, 34 + f.i * 38, k), fy = lerp(CYB - 40, 68, k) - Math.sin(k * Math.PI) * 60; glass(fx, fy + 20, lerp(1, .26, k), 1, T, false); }
    // vendor + ambient hen
    const vm = won && rk > .35 ? 'splat' : lost ? 'sad' : null;
    vendor(742, 548, .9, T, vm, won ? clamp((rk - .35) / .4, 0, 1) : 0);
    if (!lost) henWalk(T, 540);
    tally(34, 22, cups, T);
    // fill gauge hints for the spill (a small warning light)
    if (sr > .6 && !g.result) { X.globalAlpha = .5 + .5 * Math.sin(T * 14); star(760, 40, 18, 8, 8, T * 3, '#ff5a5a', 3); X.globalAlpha = 1; }
    if (T < 3.5 && !g.result) { pill(cupX, CYB - 150, 'YOU', myCol()); pill(660, 155, 'YOUR FRIEND', (D.partner && D.partner.color) || '#6EA8FE'); }
    if (T < 3 && !g.result) DUO.demoFinger(lerp(LANEX[startLane], 400, ease((T % 1.5) / 1.2)), 585 + Math.sin(T * 5) * 3, true, (T * 2) % 1);
    // payoffs
    if (won && rk >= 0) {
      for (const c of conf) { X.save(); X.translate(c.x + Math.sin(T * 3 + c.ph) * 12, c.y); X.rotate(T * 4 + c.ph); X.fillStyle = c.c; X.fillRect(-5, -3, 10, 6); X.restore(); }
      // the overflow arc that splashes the vendor
      if (rk > .2 && rk < 1.6) { const k = clamp((rk - .2) / .5, 0, 1), vx = 742, vy = 450; X.beginPath(); X.moveTo(cupX, CY0 - 4); for (let i = 1; i <= 16; i++) { const u = i / 16 * k; X.lineTo(lerp(cupX, vx, u), lerp(CY0 - 4, vy, u) - Math.sin(u * Math.PI) * 130); } X.lineWidth = 12; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = JC; X.stroke(); }
      badge('GUARAPO FOR EVERYONE!', 400, 285, 38, '#2fa84a', '#fff', outBack(rk / .28) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 2) : 1), -.05);
      if (rk > .9) badge('SPLASH ON THE VENDOR!', 400, 352, 24, '#ffb23d', '#fff', outBack((rk - .9) / .22), .04);
    }
    if (lost && rk >= 0) {
      if (loseKind === 'spill') { hen(lerp(120, 380, ease(rk / .6)), 556, 1.1, T, rk > .6 ? 'peck' : 'walk', 1); badge('TOO MUCH WASTE!', 400, 270, 40, '#e8434f', '#fff', outBack(rk / .22), -.05); if (rk > .8) badge('BAWK...', 400, 335, 26, '#7e5bd6', '#fff', outBack((rk - .8) / .22), .04); }
      else { hen(jx, 192 + 8, 1.4, T, 'shock', 1); for (let i = 0; i < 6; i++) { const q = (rk * .8 + i / 6) % 1; X.globalAlpha = 1 - q; X.fillStyle = '#fff6e0'; el(jx + (i - 2.5) * 22, 170 + q * 70 + Math.sin(i) * 10, 5, 2.5, q * 6); X.fill(); X.globalAlpha = 1; } badge('THE HEN JAMMED IT!', 400, 280, 36, '#e8434f', '#fff', outBack(rk / .22), -.05); if (rk > .8) badge('BAWK...', 400, 345, 26, '#7e5bd6', '#fff', outBack((rk - .8) / .22), .04); }
    }
  }

  /* ═════ the crank screen ═════ */
  let CBG = null;
  function bakeC() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
    wallBase();
    // cobbled plaza floor
    X.fillStyle = '#cdb89a'; X.fillRect(0, 470, W, 130); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 470); X.lineTo(W, 470); X.stroke();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) { const x = c * 62 + (r % 2) * 31, y = 480 + r * 30; el(x, y + 12, 26, 11); ink('#dfcba8', 2, 'rgba(20,16,28,.5)'); }
    // the press body (side view) with the big flywheel mount
    cel('#c98f4e', '#9a6a34', () => rr(90, 150, 340, 320, 12), 14, -6, 4);
    X.fillStyle = 'rgba(20,16,28,.25)'; for (let i = 0; i < 6; i++) X.fillRect(98, 170 + i * 50, 324, 3);
    cel('#aab6c4', '#7c8a9c', () => rr(120, 120, 280, 40, 8), 10, -3, 3.5);
    // dial board
    cel('#c98f4e', '#9a6a34', () => rr(470, 140, 250, 260, 14), 12, -5, 4);
    line([[595, 400], [595, 470]], 12, '#a5763c');
    X = old; return cv;
  }
  function band(k, r0, r1, col) {
    const a0 = Math.PI + clamp((WC[k] - WHALF) / WMAX, 0, 1) * Math.PI, a1 = Math.PI + clamp((WC[k] + WHALF) / WMAX, 0, 1) * Math.PI;
    X.beginPath(); X.arc(595, 345, r1, a0, a1); X.arc(595, 345, r0, a1, a0, true); X.closePath(); ink(col, 2.5);
  }
  function drawCrank(T, won, lost, rk) {
    if (!CBG) CBG = bakeC(); ctx.drawImage(CBG, 0, 0);
    sign(400);
    // rollers on top of the press
    for (const rx of [170, 230]) { cel('#aab6c4', '#7c8a9c', () => rr(rx - 24, 70, 48, 54, 9), 9, 0, 3.5); for (let i = 0; i < 5; i++) { const ry = 72 + ((i * 11 + crankA * 9 * (rx < 200 ? 1 : -1)) % 54 + 54) % 54; if (ry < 120) { X.fillStyle = 'rgba(20,16,28,.3)'; X.fillRect(rx - 22, ry, 44, 3); } } }
    cane(200, 74, 56, 4, T, 2);
    // flywheel + handle
    const jam = lost && rk >= 0, shk = jam ? Math.sin(T * 40) * 3 * Math.max(0, 1 - rk * 2) : 0;
    X.save(); X.translate(CXC + shk, CYC); X.rotate(crankA);
    X.beginPath(); X.arc(0, 0, 112, 0, TAU); ink('#7c8a9c', 5); X.beginPath(); X.arc(0, 0, 100, 0, TAU); ink('#aab6c4', 3);
    for (let i = 0; i < 6; i++) { X.save(); X.rotate(i * TAU / 6); rr(-9, -88, 18, 88, 5); ink('#7c8a9c', 3); X.restore(); }
    X.beginPath(); X.arc(0, 0, 22, 0, TAU); ink('#ffd23f', 4); glint(-6, -8, 7, 3.5, -.5, .7);
    // handle on the rim
    const hx = 84; line([[0, 0], [hx, 0]], 14, '#9a6a34'); X.beginPath(); X.arc(hx, 0, 17, 0, TAU); ink('#c98f4e', 4); glint(hx - 6, -6, 6, 3, -.5, .7);
    X.restore();
    glint(CXC - 40, CYC - 60, 30, 8, -.7, .22);
    // the hen that jams the press
    if (jam) { hen(CXC, CYC + 26, 1.9, T, 'shock', 1); for (let i = 0; i < 8; i++) { const q = (rk * .9 + i / 8) % 1; X.globalAlpha = 1 - q; X.fillStyle = '#fff6e0'; el(CXC + (i - 3.5) * 24, CYC - 40 - q * 90, 6, 3, q * 6 + i); X.fill(); X.globalAlpha = 1; } }
    // the speed dial
    X.beginPath(); X.arc(595, 345, 130, Math.PI, TAU); X.lineTo(725, 345); X.lineTo(465, 345); X.closePath(); X.save(); ink('#fff6e0', 4); X.restore();
    for (let k = 0; k < 3; k++) band(k, 76, 116, LC[k]);
    for (let i = 0; i <= 18; i++) { const a = Math.PI + i / 18 * Math.PI, l = i % 3 === 0 ? 14 : 7; line([[595 + Math.cos(a) * 122, 345 + Math.sin(a) * 122], [595 + Math.cos(a) * (122 - l), 345 + Math.sin(a) * (122 - l)]], 3, '#3a3550', null); }
    for (let k = 0; k < 3; k++) { const a = Math.PI + WC[k] / WMAX * Math.PI; X.beginPath(); X.arc(595 + Math.cos(a) * 140, 345 + Math.sin(a) * 140 + 2, 11, 0, TAU); ink(LC[k], 3); }
    const w = jam ? 0 : Math.max(wMeas, wKey), na = Math.PI + clamp(w / WMAX, 0, 1) * Math.PI + Math.sin(T * 30) * (w > .1 ? .012 : 0);
    X.lineCap = 'round'; X.beginPath(); X.moveTo(595, 345); X.lineTo(595 + Math.cos(na) * 108, 345 + Math.sin(na) * 108); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4.5; X.strokeStyle = '#e8434f'; X.stroke();
    X.beginPath(); X.arc(595, 345, 13, 0, TAU); ink('#ffd23f', 3.5);
    // tally of full glasses and the spill bucket
    tally(34, 22, rCups, T);
    const bx = 640, by = 560;
    X.beginPath(); X.moveTo(bx - 34, by - 52); X.lineTo(bx + 34, by - 52); X.lineTo(bx + 26, by); X.lineTo(bx - 26, by); X.closePath();
    X.save(); X.fillStyle = 'rgba(230,248,255,.6)'; X.fill(); X.restore();
    const lv = 46 * clamp(rSpill, 0, 1); if (lv > 1) { X.save(); X.beginPath(); X.moveTo(bx - 34, by - 52); X.lineTo(bx + 34, by - 52); X.lineTo(bx + 26, by); X.lineTo(bx - 26, by); X.closePath(); X.clip(); X.fillStyle = JC; X.fillRect(bx - 40, by - 4 - lv, 80, lv + 6); X.restore(); }
    X.beginPath(); X.moveTo(bx - 34, by - 52); X.lineTo(bx + 34, by - 52); X.lineTo(bx + 26, by); X.lineTo(bx - 26, by); X.closePath(); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); line([[bx - 36, by - 52], [bx + 36, by - 52]], 6, '#aab6c4');
    // vendor + hen + the player
    vendor(742, 560, .9, T, won && rk > .5 ? 'splat' : lost ? 'sad' : null, won ? clamp((rk - .5) / .4, 0, 1) : 0);
    if (!lost) henWalk(T, 590);
    const hop = won && rk >= 0 ? Math.abs(Math.sin(rk * 9)) * 16 : 0;
    X.save(); X.translate(120, 570 - hop);
    const sp0 = Math.max(wMeas, wKey);
    arm(3.6, -1, -.5 + Math.sin(crankA) * .6, 1, myCol()); arm(3.6, 1, won ? 2.7 - Math.sin(T * 14) * .3 : .6, 1, myCol());
    caos(0, 0, 3.6, { col: myCol(), mood: won ? 'happy' : lost ? 'sad' : sp0 > 2.2 ? 'sweat' : null }); X.restore();
    if (T < 3.5 && !g.result) { pill(120, 570 - 12.6 * 3.6 - 30, 'YOU', myCol()); pill(660, 130, 'YOUR FRIEND', (D.partner && D.partner.color) || '#6EA8FE'); }
    if (T < 3.5 && !g.result && !drag) { const a = T * 6; DUO.demoFinger(CXC + Math.cos(a) * 84, CYC + Math.sin(a) * 84, true, (T * 2) % 1); }
    if (won && rk >= 0) {
      for (const c of conf) { X.save(); X.translate(c.x + Math.sin(T * 3 + c.ph) * 12, c.y); X.rotate(T * 4 + c.ph); X.fillStyle = c.c; X.fillRect(-5, -3, 10, 6); X.restore(); }
      badge('GUARAPO FOR EVERYONE!', 400, 250, 38, '#2fa84a', '#fff', outBack(rk / .28) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 2) : 1), -.05);
      if (rk > .9) badge('SPLASH ON THE VENDOR!', 400, 315, 24, '#ffb23d', '#fff', outBack((rk - .9) / .22), .04);
    }
    if (lost && rk >= 0) {
      badge('THE HEN JAMMED IT!', 400, 215, 36, '#e8434f', '#fff', outBack(rk / .22), -.05);
      if (rk > .8) badge('BAWK...', 400, 270, 26, '#7e5bd6', '#fff', outBack((rk - .8) / .22), .04);
    }
  }

  g.dbg = {
    CXC, CYC, WC, WHALF, WMAX, LANEX, CR,
    /* what each screen shows. The crank: the flywheel centre, its measured speed, the dial bands and the glass tally. The glass: lanes, where the juice lands, which lane the glass is in. */
    view: () => crank
      ? { role: 0, cx: CXC, cy: CYC, omega: Math.max(wMeas, wKey), bands: WC.map((c, i) => ({ i, center: c, lo: c - WHALF, hi: c + WHALF })), cups: rCups, spill: rSpill }
      : { role: 1, laneX: LANEX, lane, cupX, jx, jetOn, fill, cups, spill: spill / SPS, jam: false },
    truth: () => ({ wV, jx, jetOn, lane, cupX, fill, cups, spill, loseKind }),
  };
  wire(g, D, 1, sp, 'du_guarapo');
  return g;
}
reg('du_guarapo', duGuarapo, 'GUARAPO'); REGMAP.du_guarapo.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  const wg = X.createLinearGradient(0, 0, 0, 240); wg.addColorStop(0, '#ffe7b8'); wg.addColorStop(1, '#ffc98a'); X.fillStyle = wg; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#7fd1c8'; X.fillRect(0, 130, 520, 110); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 130); X.lineTo(520, 130); X.stroke();
  if (role === 0) {
    const a = tt * (u < 2 ? 4 : 9), cx = 150, cy = 130;
    X.save(); X.translate(cx, cy); X.rotate(a); X.beginPath(); X.arc(0, 0, 66, 0, TAU); ink('#aab6c4', 4); for (let i = 0; i < 6; i++) { X.save(); X.rotate(i * TAU / 6); rr(-6, -56, 12, 56, 4); ink('#7c8a9c', 2.5); X.restore(); }
    X.beginPath(); X.arc(0, 0, 14, 0, TAU); ink('#ffd23f', 3); line([[0, 0], [52, 0]], 9, '#9a6a34'); X.beginPath(); X.arc(52, 0, 11, 0, TAU); ink('#c98f4e', 3); X.restore();
    DUO.demoFinger(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, true, (tt * 2) % 1);
    X.beginPath(); X.arc(380, 190, 90, Math.PI, TAU); X.closePath(); ink('#fff6e0', 3);
    for (let k = 0; k < 3; k++) { X.beginPath(); X.arc(380, 190, 70, Math.PI + k * Math.PI / 3 + .05, Math.PI + (k + 1) * Math.PI / 3 - .05); X.lineWidth = 16; X.strokeStyle = LC[k]; X.stroke(); }
    const na = Math.PI + (u < 2 ? .25 + .3 * ease(u / 2) : .55 + .1) * Math.PI * .9 + Math.sin(tt * 20) * .02; line([[380, 190], [380 + Math.cos(na) * 66, 190 + Math.sin(na) * 66]], 6, '#e8434f');
    badge('SPIN IN CIRCLES!', 260, 28, 16, '#2b9ee6', '#fff', 1, -.02);
  } else {
    const jx = lerp(130, 390, ease(u < 2 ? u / 1.6 : 1 - (u - 2) / 1.6));
    line([[60, 66], [460, 66]], 7, '#aab6c4'); cel('#aab6c4', '#7c8a9c', () => { X.beginPath(); X.moveTo(jx - 13, 62); X.lineTo(jx + 13, 62); X.lineTo(jx + 6, 84); X.lineTo(jx - 6, 84); X.closePath(); }, 5, 0, 3);
    X.beginPath(); X.moveTo(jx - 5, 84); X.lineTo(jx + 5, 84); X.lineTo(jx + 5, 176); X.lineTo(jx - 5, 176); X.closePath(); ink(JC, 2.5);
    cel('#f0b46a', '#d49240', () => rr(-10, 190, 540, 20, 4), 0, -5, 3.5);
    const gx = lerp(130, 390, ease(u < 2 ? (u - .3) / 1.6 : 1 - (u - 2.3) / 1.6));
    glass(gx, 180, .7, .3 + .4 * ((tt % 2) / 2), tt, false);
    DUO.demoFinger(gx, 215, true, (tt * 2) % 1);
    badge('CATCH THE JUICE!', 260, 28, 16, '#c98a12', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_guarapo = [['THE CRANK', 'SPIN FASTER OR SLOWER AS YOUR FRIEND SAYS', 'CIRCLE YOUR FINGER'], ['THE GLASS', 'CATCH THE JUICE FOR YOUR FRIEND', 'DRAG SIDEWAYS']];
DUO.DEMOS.du_guarapo = [t => demo(0, t), t => demo(1, t)];

})();
