'use strict';
/* ═════════ DUO · CAFÉ COLADO (du_cafe): abuela's kitchen, coffee through a cloth sock (colador de tela / chorreador) ═════════
   JARRA (role 0): holds the enamel kettle. TILT THE PHONE (gyroscope) to pour - the more it leans, the thicker the stream. Desktop / bots / no gyro:
   hold the mouse (or finger) and drag RIGHT to tilt (left = upright), or ◄ ► / A D / space. Sees only the water left in the kettle (glass gauge) and the
   stream falling behind the table: NOT the cloth. The grandma's hand wobbles, so the stream drifts left and right on its own.
   PAÑO (role 1, JUDGE): slides the cloth sock along the rail (drag / mouse / ◄ ►) to keep it under the stream, and watches how full the sock is
   (the red thread = almost full) and the coffee dripping into the glass. The sock drains slower when the grounds clog, so the pourer cannot know:
   PAÑO has to SHOUT "easy!/more!", JARRA has to say how much it is pouring.
   WIN: the whole kettle is poured into the sock, none lost, and the sock drains to the last drop. LOSE: the sock overflows (rebosó), too much water
   misses the cloth (regó), or time runs out. Fail gag: a chancla flies in. Win gag: abuela runs in with her cup, "¡COLADITO!".
   Netcode: the JARRA owns the kettle and publishes 'j' [streamX, streamVx, flow*1000, poured*1000] (absolute, latest, re-sent every .5 s).
   The PAÑO owns the cloth and decides the verdict: every new bit of poured water lands either in the sock or beside it, at the stream position
   it received. Before the verdict it sends 'why' ('o' overflow / 's' spill / 't' time) so the kettle screen can draw the right ending. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only

/* ───────────── tuning (units: 1 = a full sock; the kettle holds J) ───────────── */
const J = 2.2, FMAX = .9, DRB = .12, DRL = .32, SPM = .3;   // kettle volume, max pour /s, base drain /s, drain per fill /s, max water lost beside the cloth
const HW = 92, CLS = 520;                                   // cloth half width (px), cloth top speed (px/s)
const RIMY = 300, TIPY = 466, CNT = 556;                    // sock rim y, sock tip y, counter top y (paño screen)
const WOOD = '#c98f4e', WOODD = '#9a6a34', BLUE = '#3b8fd6', BLUED = '#2368a8', CLOTH = '#efe4c8', CLOTHD = '#cbbb92', COF = '#5a3418', COFL = '#8a5a30';

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
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}

/* ───────────── props ───────────── */
function cat(x, y, s, T, mood) {                       // a sitting grey cat; (x, y) = bottom centre
  X.save(); X.translate(x, y); X.scale(s, s);
  const sw = Math.sin(T * 2.4) * 9;
  X.lineCap = 'round'; X.beginPath(); X.moveTo(18, -4); X.quadraticCurveTo(46, -2 + sw, 40, -34 + sw * .6); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#a9a3b8'; X.stroke();
  el(0, -16, 22, 17); ink('#a9a3b8', 3.5); glint(-9, -24, 8, 4);
  el(-6, -44, 15, 13); ink('#a9a3b8', 3.5);
  for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(-6 + sd * 6, -53); X.lineTo(-6 + sd * 15, -66); X.lineTo(-6 + sd * 15, -50); X.closePath(); ink('#a9a3b8', 3); }
  X.fillStyle = INK; if (mood === 'happy') { X.lineWidth = 2.5; X.strokeStyle = INK; X.beginPath(); X.arc(-12, -46, 3, Math.PI, 0); X.arc(0, -46, 3, Math.PI, 0); X.stroke(); } else { el(-12, -46, 2.3, 3.2); X.fill(); el(0, -46, 2.3, 3.2); X.fill(); }
  X.fillStyle = '#ff8fa8'; X.beginPath(); X.arc(-6, -41, 2, 0, TAU); X.fill();
  X.strokeStyle = INK; X.lineWidth = 1.5; X.beginPath(); X.moveTo(-6, -41); X.lineTo(-6, -38); X.moveTo(-6, -38); X.quadraticCurveTo(-10, -35, -13, -38); X.moveTo(-6, -38); X.quadraticCurveTo(-2, -35, 1, -38); X.stroke();
  X.restore();
}
function ln(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 1.3; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
/* the grandma (feet at x, y; s = scale, about 15 s px tall). o: walk, cup (holds a cup up), mood 'happy' | 'mad' */
function grandma(x, y, s, T, o) {
  o = o || {}; X.save(); X.translate(x, y); X.scale(s * (o.flip || 1), s); const w = o.walk ? Math.sin(T * 11) : 0, bob = o.walk ? Math.abs(w) * .5 : 0;
  X.translate(0, -bob);
  for (const sd of [-1, 1]) { el(sd * 2 + sd * w * .8, -.7, 1.9, .9); ink('#e8434f', .5); }
  X.beginPath(); X.moveTo(-3.6, -7.5); X.lineTo(3.6, -7.5); X.lineTo(5.6, -1.2); X.lineTo(-5.6, -1.2); X.closePath(); ink('#b86bd6', .55);
  for (const [dx, dy] of [[-4, -3], [4.2, -2.6], [-2, -1.9], [3, -5.4]]) { X.fillStyle = '#ffe14d'; X.beginPath(); X.arc(dx, dy, .55, 0, TAU); X.fill(); }
  rr(-2.6, -7.2, 5.2, 5.8, 1); ink('#fff6e0', .45);
  const up = o.cup ? 1 : 0, ah = up ? -2 + Math.sin(T * 12) * (o.mood === 'happy' ? .8 : 0) : 0;
  ln([[-3.2, -7], [-5.2, -4.4 + (o.mood === 'mad' ? -3 : 0)], [-4.6, -2.2 + (o.mood === 'mad' ? -4 : 0)]], 1.5, '#f2c9a0');
  ln([[3.2, -7], [5.4, -5.4 + ah], [5.2, -8.4 + ah * 2]], 1.5, '#f2c9a0');
  if (o.cup) { X.save(); X.translate(5.2, -9.2 + ah * 2); rr(-1.8, -2.2, 3.6, 3.2, .8); ink('#fff', .4); X.fillStyle = COF; X.fillRect(-1.4, -1.6, 2.8, .9); X.restore(); }
  el(0, -11, 3.7, 3.7); ink('#f2c9a0', .55);
  X.beginPath(); X.arc(0, -15.2, 1.9, 0, TAU); ink('#d9d9e3', .45);
  X.beginPath(); X.arc(0, -11.4, 3.7, Math.PI * 1.05, Math.PI * 1.95); ink('#d9d9e3', .3);
  X.strokeStyle = INK; X.lineWidth = .35; for (const sd of [-1, 1]) { X.beginPath(); X.arc(sd * 1.5, -10.8, 1.1, 0, TAU); X.stroke(); }
  X.fillStyle = INK; for (const sd of [-1, 1]) { X.beginPath(); X.arc(sd * 1.5, -10.8, .35, 0, TAU); X.fill(); }
  X.lineWidth = .4; X.beginPath(); if (o.mood === 'happy') X.arc(0, -9.4, 1, .1, Math.PI - .1); else if (o.mood === 'mad') X.arc(0, -8.4, 1, Math.PI + .2, -.2); else { X.moveTo(-.8, -8.8); X.lineTo(.8, -8.8); } X.stroke();
  X.restore();
}
function chancla(x, y, s, rot) {                       // a flip-flop (the national weapon)
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  el(0, 0, 34, 13, 0); ink('#e8434f', 3.5); glint(-12, -4, 12, 3, 0, .5);
  X.beginPath(); X.moveTo(-6, 0); X.lineTo(10, -9); X.moveTo(-6, 0); X.lineTo(10, 9); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#ffe14d'; X.stroke();
  X.restore();
}
function glass(x, base, fill, T, drip) {               // a glass mug on the counter; fill 0..1
  const w = 70, h = 64, top = base - h;
  X.beginPath(); X.moveTo(x - w / 2 - 3, top); X.lineTo(x + w / 2 + 3, top); X.lineTo(x + w / 2 - 6, base); X.quadraticCurveTo(x, base + 6, x - w / 2 + 6, base); X.closePath();
  X.fillStyle = 'rgba(233,246,255,.55)'; X.fill(); X.save(); X.clip();
  const ly = base - 4 - fill * (h - 12); X.fillStyle = COF; X.fillRect(x - w, ly, w * 2, h); X.fillStyle = COFL; X.fillRect(x - w, ly, w * 2, 5);
  X.restore();
  X.beginPath(); X.moveTo(x - w / 2 - 3, top); X.lineTo(x + w / 2 + 3, top); X.lineTo(x + w / 2 - 6, base); X.quadraticCurveTo(x, base + 6, x - w / 2 + 6, base); X.closePath(); X.lineWidth = 7; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.ellipse(x + w / 2 + 14, base - h / 2 + 2, 15, 18, 0, -1.5, 1.5); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#d9edf2'; X.stroke();
  glint(x - w / 2 + 9, top + 22, 4, 17, .08, .55);
  if (fill > .5) for (let k = 0; k < 2; k++) { const q = (T * .7 + k * .5) % 1; X.globalAlpha = (1 - q) * .7; X.strokeStyle = '#fff'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 10 + k * 20, top - 6 - q * 30); X.quadraticCurveTo(x - 4 + k * 20, top - 18 - q * 30, x - 10 + k * 20, top - 28 - q * 30); X.stroke(); X.globalAlpha = 1; }
}
function tiles(y0, y1) {
  for (let r = 0, y = y0; y < y1; r++, y += 44) for (let c = 0, x = 0; x < 800; c++, x += 44) {
    X.fillStyle = (r + c) % 2 ? '#f4f1ea' : '#cfe3f5'; X.fillRect(x, y, 44, 44);
    if ((r + c) % 2 === 0) { X.strokeStyle = '#3b8fd6'; X.lineWidth = 2; X.beginPath(); X.arc(x + 22, y + 22, 8, 0, TAU); X.stroke(); }
  }
  X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 1.5; for (let y = y0; y <= y1; y += 44) { X.beginPath(); X.moveTo(0, y); X.lineTo(800, y); X.stroke(); } for (let x = 0; x <= 800; x += 44) { X.beginPath(); X.moveTo(x, y0); X.lineTo(x, y1); X.stroke(); }
}
function windowAvila(x, y, w, h) {                     // a window onto the green mountain
  const sk = X.createLinearGradient(0, y, 0, y + h); sk.addColorStop(0, '#4fb8ff'); sk.addColorStop(1, '#fff0cc'); X.fillStyle = sk; X.fillRect(x, y, w, h);
  X.beginPath(); X.moveTo(x, y + h); X.lineTo(x, y + h * .6); X.quadraticCurveTo(x + w * .3, y + h * .15, x + w * .55, y + h * .5); X.quadraticCurveTo(x + w * .8, y + h * .25, x + w, y + h * .55); X.lineTo(x + w, y + h); X.closePath(); X.fillStyle = '#4fae62'; X.fill();
  X.beginPath(); X.arc(x + w * .78, y + h * .22, 14, 0, TAU); ink('#ffe14d', 3);
  rr(x - 6, y - 6, w + 12, h + 12, 6); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#fff6e0'; X.stroke();
  X.lineWidth = 8; X.strokeStyle = INK; X.beginPath(); X.moveTo(x + w / 2, y); X.lineTo(x + w / 2, y + h); X.moveTo(x, y + h / 2); X.lineTo(x + w, y + h / 2); X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff6e0'; X.stroke();
}
function clock(x, y) { X.beginPath(); X.arc(x, y, 30, 0, TAU); ink('#fff6e0', 4); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(x, y); X.lineTo(x, y - 20); X.moveTo(x, y); X.lineTo(x + 14, y + 4); X.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; X.beginPath(); X.moveTo(x + Math.sin(a) * 24, y - Math.cos(a) * 24); X.lineTo(x + Math.sin(a) * 27, y - Math.cos(a) * 27); X.stroke(); } }
function calendar(x, y) { rr(x - 34, y - 46, 68, 92, 6); ink('#fff6e0', 3.5); X.fillStyle = '#e8434f'; X.fillRect(x - 31, y - 43, 62, 20); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { X.fillStyle = INK; X.fillRect(x - 24 + c * 14, y - 12 + r * 13, 8, 6); } X.beginPath(); X.arc(x, y - 33, 6, 0, TAU); ink('#ffe14d', 2.5); }

/* ═════════ the game ═════════ */
function duCafe(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), jug = D.role === 0, TS = Math.sqrt(sp);
  const PH = [R() * TAU, R() * TAU, R() * TAU, R() * TAU];
  const FM = FMAX * TS, DB = DRB * TS, DL = DRL * TS, CSP = CLS * TS, KR = 1.5 * TS;
  const jxAt = (T, th) => 400 + 150 * Math.sin(.7 * TS * T + PH[0]) + 50 * Math.sin(1.6 * TS * T + PH[1]) + 38 * th;   // where the (shaky) stream lands
  const clogAt = T => 1 + .3 * Math.sin(.55 * TS * T + PH[2]);                                                         // grounds clog: the sock drains slower / faster
  /* ----- state ----- */
  const pops = [], spl = [], puddles = [], conf = [];
  let resAt = -1, why = '', held = false, kL = false, kR = false, kSp = false, popA = -9;
  // jarra
  let tt = 0, th = 0, poured = 0, flow = 0, jx = 400, jv = 0, sSent = -9, lastS = '';
  // paño
  let ptx = 400, cx = 400, L = 0, cup = 0, spilled = 0, rPoured = 0, rX = 400, rV = 0, rFlow = 0, rT = -9, fellAt = -9, lastDrip = 0, hasMsg = false;
  const sxNow = T => hasMsg ? rX + rV * Math.min(.35, Math.max(0, T - rT)) : 400;
  const pop = (s, px, py, size, bgc, fg) => { pops.push({ s, x: px, y: py, size, bgc, fg, t0: g.c, rot: (hsh(g.c * 9) - .5) * .14 }); if (pops.length > 3) pops.shift(); };

  const g = {
    c: 0, dur: 15, pts: 0, gyro: jug,
    cmd: jug ? 'POUR!' : 'CATCH!', roleLabel: jug ? 'JUG' : 'CLOTH',
    hint: jug ? 'TILT THE KETTLE: HOLD THE MOUSE AND MOVE RIGHT (OR ► / D) TO POUR, LEFT TO STOP. YOU CANNOT SEE THE CLOTH - TELL YOUR FRIEND HOW MUCH YOU POUR AND LISTEN WHEN THEY SAY STOP!' : 'MOVE THE MOUSE (OR ◄ ►) TO KEEP THE CLOTH UNDER THE STREAM. WHEN THE RED THREAD IS NEAR, YELL "EASY!" TO YOUR FRIEND - THEY CANNOT SEE YOUR CLOTH!',
    thint: jug ? 'TILT YOUR PHONE TO POUR (OR DRAG RIGHT). YOU CANNOT SEE THE CLOTH - TALK TO YOUR FRIEND!' : 'DRAG LEFT / RIGHT TO KEEP THE CLOTH UNDER THE STREAM. YELL "EASY!" WHEN IT GETS FULL!',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) {
        resAt = T;
        if (g.result === 'win') { for (let i = 0; i < 46; i++) conf.push({ x: hsh(i) * 800, y: -20 - hsh(i + 3) * 300, vy: 90 + hsh(i + 9) * 150, ph: hsh(i + 17) * 6, c: ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A', '#ff9f43'][i % 5] }); sfx.sparkle && sfx.sparkle(); }
        else { sfx.miss(); }
      }
      for (let i = spl.length - 1; i >= 0; i--) { const b = spl[i]; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) spl.splice(i, 1); }
      for (const c of conf) { c.y += c.vy * dt; if (c.y > 620) c.y = -20; }
      if (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      const done = !!g.result;
      if (jug) {
        if (kR) tt = Math.min(1, tt + KR * dt); if (kL) tt = Math.max(0, tt - KR * dt);
        const eff = done ? 0 : kSp ? Math.max(tt, .55) : tt;
        th += (eff - th) * Math.min(1, dt * 9);
        const nrm = th < .2 ? 0 : Math.pow((th - .2) / .8, 1.3), dp = done ? 0 : Math.min(FM * nrm * dt, J - poured);
        poured += dp; flow += (dt > 0 ? dp / dt - flow : 0) * Math.min(1, dt * 20);
        const jn = jxAt(T, th); jv += ((jn - jx) / Math.max(dt, 1e-4) - jv) * Math.min(1, dt * 12); jx = jn;
        const sm = Math.round(jx) + ',' + Math.round(flow * 1000) + ',' + Math.round(poured * 1000);
        if ((sm !== lastS && T - sSent >= .07) || T - sSent >= .5) { lastS = sm; sSent = T; D.send('j', [Math.round(jx), Math.round(jv), Math.round(flow * 1000), Math.round(poured * 1000)], true); }
      } else {
        // the cloth slides toward the pointer, never teleporting
        if (kL) ptx = Math.max(90, ptx - 560 * TS * dt); if (kR) ptx = Math.min(710, ptx + 560 * TS * dt);
        if (!done) cx += clamp(ptx - cx, -CSP * dt, CSP * dt);
        if (hasMsg && T - rT > .4) rFlow = 0;
        if (!done) {
          const dr = Math.min(L, (DB + DL * L) * clogAt(T) * dt); L -= dr; cup += dr; lastDrip = dr / Math.max(dt, 1e-4);
          if (L >= 1) { why = 'o'; D.send('why', 'o'); sfx.splat(); shake(9, .3); g.finish('lose'); }
          else if (spilled > SPM) { why = 's'; D.send('why', 's'); g.finish('lose'); }
          else if (rPoured >= J - .004 && L < .03) { sfx.coin(); g.finish('win'); }
          else if (T >= g.limit) { why = 't'; D.send('why', 't'); g.finish('lose'); }
        }
      }
    },
    msg(type, d) {
      if (jug) { if (type === 'why' && typeof d === 'string') why = d; return; }
      if (type !== 'j' || !Array.isArray(d) || g.result) return;
      const T = g.c, np = d[3] / 1000, dp = Math.max(0, np - rPoured);
      rX = d[0]; rV = d[1]; rFlow = d[2] / 1000; rT = T; hasMsg = true;
      if (dp > 0) {
        rPoured = np;
        if (Math.abs(rX - cx) <= HW) { L += dp; sfx.tick && Math.random() < .05 && sfx.tick(); }
        else { spilled += dp; puddles.push({ x: rX, w: dp * 260, t0: T }); if (puddles.length > 14) puddles.shift(); if (T - popA > .8) { popA = T; sfx.splat(); pop('MISSED!', clamp(rX, 140, 660), 190, 24, '#e8434f', '#fff'); } }
      }
    },
    down(p) { if (g.result) return; if (jug) { held = true; tt = clamp((p.x - 400) / 320, 0, 1); } else ptx = clamp(p.x, 90, 710); },
    move(p) { if (g.result) return; if (jug) { if (held || TOUCH) tt = clamp((p.x - 400) / 320, 0, 1); } else ptx = clamp(p.x, 90, 710); },
    up() { held = false; if (jug) tt = 0; },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (c === 'ArrowLeft' || c === 'KeyA') kL = true; else if (c === 'ArrowRight' || c === 'KeyD') kR = true; else if (jug && (c === 'Space' || c === 'ArrowDown' || c === 'KeyS')) kSp = true;
    },
    keyup(e) { const c = e.code; if (c === 'ArrowLeft' || c === 'KeyA') kL = false; if (c === 'ArrowRight' || c === 'KeyD') kR = false; if (c === 'Space' || c === 'ArrowDown' || c === 'KeyS') kSp = false; },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (jug) drawJug(T, won, lost, rk); else drawCloth(T, won, lost, rk);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .85 ? Math.max(0, 1 - (a - .85) / .25) : 1; badge(q.s, clamp(q.x, 150, 650), Math.max(120, q.y - Math.min(a, .6) * 18), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(jug ? 'POUR IT SLOW!' : 'FOLLOW THE STREAM!', 400, jug ? 120 : 140, 20, jug ? '#2b9ee6' : '#c98a12', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
  };

  /* ═════ paño (cloth) screen ═════ */
  let BBG = null, BFG = null;
  function bakeB() {
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const old = X, a = mk(), b = mk();
    X = a.getContext('2d');
    const wg = X.createLinearGradient(0, 0, 0, 340); wg.addColorStop(0, '#ffeec4'); wg.addColorStop(1, '#ffd98f'); X.fillStyle = wg; X.fillRect(0, 0, W, 340);
    tiles(330, CNT + 2); X.fillStyle = INK; X.fillRect(0, 326, W, 8);
    windowAvila(70, 50, 150, 130);
    calendar(330, 110);
    // shelf with pots
    rr(400, 168, 170, 12, 4); ink(WOODD, 3);
    for (const [px, pw, ph, col] of [[428, 38, 40, '#e8434f'], [482, 44, 52, BLUE], [536, 30, 34, '#ffb23d']]) { rr(px - pw / 2, 168 - ph, pw, ph, 8); ink(col, 3); glint(px - pw / 4, 168 - ph * .7, 4, ph * .25, .1, .5); }
    // doorway to the hall (the grandma walks by in it)
    rr(610, 40, 160, 292, 4); ink('#4a3a52', 5); X.fillStyle = '#ffd1a0'; X.fillRect(618, 48, 144, 280); X.fillStyle = '#e9a77a'; X.fillRect(618, 300, 144, 28);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(630, 60, 20, 200);
    X = b.getContext('2d');
    // rail with two posts and the counter top
    for (const px of [14, 756]) { rr(px, 232, 30, CNT - 232, 6); cel(WOOD, WOODD, () => rr(px, 232, 30, CNT - 232, 6), 8, 0, 4); }
    rr(2, 236, 796, 24, 8); cel(WOOD, WOODD, () => rr(2, 236, 796, 24, 8), 0, 6, 4);
    X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 2; for (let x = 60; x < 760; x += 40) { X.beginPath(); X.moveTo(x, 248); X.lineTo(x, 256); X.stroke(); }
    X.beginPath(); X.rect(0, CNT, W, H - CNT); X.fillStyle = INK; X.fill(); X.fillStyle = WOOD; X.fillRect(0, CNT + 6, W, H - CNT - 6); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(0, CNT + 6, W, 8);
    X.fillStyle = WOODD; for (let x = 0; x < W; x += 140) X.fillRect(x, CNT + 30, 4, H);
    X = old; BBG = a; BFG = b;
  }
  function sockPath(cxx) { X.beginPath(); X.moveTo(cxx - 88, RIMY); X.bezierCurveTo(cxx - 88, 390, cxx - 30, 440, cxx, TIPY); X.bezierCurveTo(cxx + 30, 440, cxx + 88, 390, cxx + 88, RIMY); X.closePath(); }
  function drawSock(cxx, dy, rot, T, lvl, over) {
    X.save(); X.translate(cxx, RIMY + dy); X.rotate(rot); X.translate(-cxx, -RIMY);
    X.beginPath(); X.ellipse(cxx, RIMY, 90, 18, 0, 0, TAU); X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = WOOD; X.stroke();
    X.beginPath(); X.ellipse(cxx, RIMY, 86, 15, 0, 0, TAU); X.fillStyle = lvl > .93 ? COFL : '#4a2f1a'; X.fill();
    sockPath(cxx); ink(CLOTHD, 4.5);
    X.save(); sockPath(cxx); X.clip(); X.translate(-14, 0); sockPath(cxx); X.fillStyle = CLOTH; X.fill(); X.translate(14, 0);
    const yl = TIPY - lvl * (TIPY - RIMY);
    if (lvl > 0) { X.fillStyle = COF; X.fillRect(cxx - 100, yl, 200, 200); X.fillStyle = COFL; el(cxx, yl, 62 * Math.sqrt(Math.max(.05, lvl)) + 20, 6 + 5 * lvl); X.fill(); X.fillStyle = 'rgba(239,228,200,.28)'; X.fillRect(cxx - 100, yl, 200, 200); }
    X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 2; X.setLineDash([6, 7]); for (const k of [-.5, 0, .5]) { X.beginPath(); X.moveTo(cxx + k * 120, RIMY + 14); X.quadraticCurveTo(cxx + k * 70, 400, cxx + k * 6, TIPY - 4); X.stroke(); } X.setLineDash([]);
    // the red thread: when the coffee reaches it, the sock is nearly full
    const ty = TIPY - .82 * (TIPY - RIMY); X.lineWidth = 5; X.strokeStyle = INK; X.beginPath(); X.moveTo(cxx - 100, ty); X.lineTo(cxx + 100, ty); X.stroke(); X.lineWidth = 3; X.strokeStyle = lvl > .82 ? '#ff3b3b' : '#e8434f'; X.stroke();
    glint(cxx - 40, 360, 8, 26, .2, .4);
    X.restore();
    X.beginPath(); X.ellipse(cxx, RIMY, 90, 18, 0, 0, Math.PI); X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = WOOD; X.stroke();
    if (over) for (const sd of [-1, 1]) { const k = clamp(over, 0, 1); X.beginPath(); X.moveTo(cxx + sd * 90, RIMY + 4); X.lineTo(cxx + sd * (96 + k * 8), RIMY + 4 + k * 190); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = COF; X.stroke(); }
    X.restore();
  }
  function drawCloth(T, won, lost, rk) {
    if (!BBG) bakeB(); ctx.drawImage(BBG, 0, 0);
    // background gags: the cat on the shelf, the grandma passing the doorway
    cat(486, 168, .6, T, won ? 'happy' : null);
    const gt = ((T - 4.2) / 3.2); if (gt > 0 && gt < 1 && !won) { X.save(); X.beginPath(); X.rect(618, 48, 144, 280); X.clip(); grandma(lerp(780, 600, gt), 326, 3.6, T, { walk: true, cup: true, flip: 1 }); X.restore(); }
    ctx.drawImage(BFG, 0, 0);
    const over = lost && why === 'o', fall = over && rk > .3 ? Math.min(92, 1500 * (rk - .3) * (rk - .3)) : 0;
    const wob = lost && rk >= 0 && fall >= 92 ? Math.sin((rk - .5) * 22) * Math.max(0, 1 - (rk - .5) * 1.4) * .12 : 0;
    // ropes and carriage
    if (!(over && fall > 0)) { line([[cx - 80, 258], [cx - 86, RIMY - 2]], 5, '#f4f0e6'); line([[cx + 80, 258], [cx + 86, RIMY - 2]], 5, '#f4f0e6'); }
    rr(cx - 28, 232, 56, 34, 8); cel('#e8b866', '#b88a4c', () => rr(cx - 28, 232, 56, 34, 8), 6, 4, 3.5); X.beginPath(); X.arc(cx, 249, 6, 0, TAU); ink('#4a3a52', 2.5);
    // glass under the sock
    const full = clamp(cup / (J * .95), 0, 1);
    glass(cx, CNT + 20, full, T, lastDrip);
    // drips from the tip
    const dripping = !g.result && lastDrip > .01;
    if (dripping) for (let k = 0; k < 3; k++) { const q = (T * (1.2 + lastDrip * 5) + k / 3) % 1, dy = TIPY + 6 + q * (CNT - 70 - TIPY); X.beginPath(); X.ellipse(cx + Math.sin(k * 2) * 3, dy, 3.4, 5 + q * 4, 0, 0, TAU); ink(COF, 1.5); }
    drawSock(cx, fall, wob, T, clamp(L, 0, 1), over ? clamp(rk * 2, 0, 1) : 0);
    // the stream
    const flowing = !g.result && rFlow > .012;
    if (hasMsg && (flowing || (g.result && rk < .25 && rFlow > .012))) {
      const sx = sxNow(T), hit = Math.abs(sx - cx) <= HW, wd = 3 + clamp(rFlow / FM, 0, 1) * 17, endY = hit ? RIMY + 6 : CNT + 6;
      const wob2 = Math.sin(T * 30) * 1.2; X.lineCap = 'butt';
      X.beginPath(); X.moveTo(sx, -6); X.lineTo(sx + wob2, endY); X.lineWidth = wd + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = wd; X.strokeStyle = '#bfe6ff'; X.stroke(); X.lineWidth = Math.max(1, wd * .25); X.strokeStyle = '#fff'; X.beginPath(); X.moveTo(sx - wd * .2, 0); X.lineTo(sx - wd * .2 + wob2, endY); X.stroke();
      for (let k = 0; k < 3; k++) { const q = (T * 2.5 + k / 3) % 1; X.globalAlpha = 1 - q; X.beginPath(); X.ellipse(sx + (k - 1) * wd * .9, endY - 2 - q * 12, wd * (.5 + q * .9), wd * .22, 0, 0, TAU); X.lineWidth = 2.5; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
    }
    // the kettle's spout peeking from the top edge (it follows the stream)
    { const sx = hasMsg ? sxNow(T) : 400, tl = clamp(rFlow / FM, 0, 1); X.save(); X.translate(sx, 0); X.rotate(.35 + tl * .12); line([[-60, -34], [-20, 4], [0, 18]], 24, BLUE); X.restore(); X.beginPath(); X.ellipse(sx, 12, 9, 5, 0, 0, TAU); X.fillStyle = INK; X.fill(); }
    // spilled water on the counter
    for (const p of puddles) { const k = clamp((T - p.t0) / .4, 0, 1); el(p.x, CNT + 12, (14 + p.w) * k + 8, 6 + p.w * .1 * k); ink('#bfe6ff', 2.5); }
    for (const b of spl) { if (b.steam) continue; const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); X.beginPath(); X.arc(b.x, b.y, b.r || 3, 0, TAU); ink('#bfe6ff', 1.5); X.globalAlpha = 1; }
    // the pourer in the picture frame
    const pc = (D.partner && D.partner.color) || '#6EA8FE';
    rr(660, 30, 90, 90, 10); ink('#fff6e0', 4); X.save(); rr(666, 36, 78, 78, 7); X.clip(); X.fillStyle = '#7ec8e3'; X.fillRect(660, 30, 90, 90); caos(705, 116, 2.8, { col: pc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (T < 3.5 && !g.result) pill(705, 140, 'YOUR FRIEND', pc);
    // my caos, worried when the sock is nearly full
    const me1 = myCol(), worry = L > .8 && !g.result;
    X.save(); X.translate(78, 598); const hop = won && rk >= 0 ? Math.abs(Math.sin(rk * 9)) * 18 : 0; X.translate(0, -hop);
    arm(4.2, -1, won ? -2.7 + Math.sin(T * 14) * .3 : -.3, 1, me1); arm(4.2, 1, won ? 2.7 - Math.sin(T * 14) * .3 : (worry ? 2.4 + Math.sin(T * 20) * .15 : .5), 1, me1);
    caos(0, 0, 4.2, { col: me1, mood: won ? 'happy' : (lost || worry) ? 'sad' : null }); X.restore();
    if (worry) { const sw = (T * 2.2) % 1; X.globalAlpha = 1 - sw; X.save(); X.translate(110 - sw * 6, 520 + sw * 14); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
    if (T < 3.5 && !g.result) pill(78, 520, 'YOU', me1);
    if (T < 3 && !g.result) DUO.demoFinger(cx + Math.sin(T * 3) * 80, 330 + Math.sin(T * 5) * 3, true, (T * 2) % 1);
    // payoffs
    if (won && rk >= 0) {
      for (const c of conf) { X.save(); X.translate(c.x + Math.sin(T * 3 + c.ph) * 12, c.y); X.rotate(T * 4 + c.ph); X.fillStyle = c.c; X.fillRect(-5, -3, 10, 6); X.restore(); }
      const gx = lerp(900, 640, ease(rk / .7)); grandma(gx, 598, 5.2, T, { walk: rk < .7, cup: true, mood: 'happy' });
      for (let i = 0; i < 4; i++) { const q = (rk * 1.1 + i / 4) % 1; X.globalAlpha = 1 - q; X.save(); X.translate(cx - 30 + i * 20, CNT - 90 - q * 70); X.scale(.9, .9); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); ink('#ff5c8a', 3); X.restore(); X.globalAlpha = 1; }
      badge('COLADITO!', 400, 190, 54, '#8a5a30', '#fff', outBack(rk / .28) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 2) : 1), -.06);
      if (rk > .45) badge('BEST COFFEE!', 400, 262, 32, '#2fa84a', '#fff', outBack((rk - .45) / .22), .05);
    }
    if (lost && rk >= 0) {
      const k = clamp((rk - .25) / .55, 0, 1), cxp = lerp(880, 92, k), cyp = lerp(300, 548, k) - Math.sin(k * Math.PI) * 120;
      if (rk > .25 && rk < .8) chancla(cxp, cyp, 1.2, rk * 14); else if (rk >= .8) { chancla(100, 568 + Math.min(1, (rk - .8) * 3) * 10, 1.1, .25); star(78, 520, 46 * Math.min(1, (rk - .8) * 6), 20, 9, rk * 2, '#ffe14d', 4); }
      const txtMain = why === 'o' ? 'OVERFLOW!' : why === 's' ? 'SPILLED!' : 'TOO SLOW!';
      badge(txtMain, 400, 200, 52, '#e8434f', '#fff', outBack(rk / .22), -.05);
      if (rk > .8) badge('CHANCLAZO!', 400, 276, 32, '#7e5bd6', '#fff', outBack((rk - .8) / .22), .04);
    }
  }

  /* ═════ jarra (kettle) screen ═════ */
  let ABG = null;
  const PIVX = 600, PIVY = 330, TBL = 540;
  function bakeA() {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const old = X; X = c.getContext('2d');
    const wg = X.createLinearGradient(0, 0, 0, 360); wg.addColorStop(0, '#ffeec4'); wg.addColorStop(1, '#ffd98f'); X.fillStyle = wg; X.fillRect(0, 0, W, 360);
    tiles(340, H); X.fillStyle = INK; X.fillRect(0, 336, W, 8);
    windowAvila(70, 40, 150, 120);
    clock(400, 80); calendar(690, 100);
    // radio on a little shelf
    rr(250, 172, 140, 12, 4); ink(WOODD, 3); rr(266, 120, 90, 52, 8); ink('#c14d2f', 3.5); el(292, 148, 14, 14); ink('#ffe08a', 2.5); X.fillStyle = INK; for (let k = 0; k < 4; k++) X.fillRect(318, 132 + k * 9, 28, 3);
    // the table with its checkered cloth hides everything below: the pourer never sees the sock
    X.beginPath(); X.moveTo(200, TBL); X.lineTo(820, TBL); X.lineTo(820, H + 10); X.lineTo(200, H + 10); X.closePath(); ink('#fff6e0', 5);
    X.save(); X.clip(); for (let r = 0; r < 8; r++) for (let q = 0; q < 16; q++) if ((r + q) % 2 === 0) { X.fillStyle = '#e8434f'; X.fillRect(200 + q * 40, TBL + r * 40, 40, 40); } X.restore();
    X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(200, TBL, 620, 14);
    X.beginPath(); X.moveTo(200, TBL); X.lineTo(820, TBL); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
    X = old; return c;
  }
  function jugBody(ang, lft, T) {
    X.save(); X.rotate(-ang);
    // handle first (behind), then body, spout, lid
    line([[-32, -72], [24, -80], [44, -20], [24, 42], [-32, 58]], 16, BLUED);
    line([[-205, -62], [-240, -118], [-256, -138]], 26, BLUE);
    rr(-200, -95, 172, 190, 30); cel(BLUE, BLUED, () => rr(-200, -95, 172, 190, 30), 20, -8, 5);
    X.fillStyle = 'rgba(255,255,255,.85)'; for (const [a, b, r] of [[-175, -40, 2.4], [-160, 20, 2], [-60, -50, 2.6], [-45, 10, 2], [-80, 60, 2.4], [-180, 60, 2]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fill(); }
    rr(-196, -112, 164, 26, 12); ink('#fff6e0', 3.5); X.beginPath(); X.arc(-114, -126, 9, 0, TAU); ink('#e8434f', 3);
    // the glass gauge (water left); the water stays level in the world
    rr(-166, -62, 34, 132, 10); ink('#e9f6ff', 3.5);
    X.save(); rr(-166, -62, 34, 132, 10); X.clip(); X.translate(-149, 4); X.rotate(ang); const wl = (.5 - lft) * 136;
    X.fillStyle = '#6fc8ff'; X.fillRect(-60, wl, 120, 200); X.fillStyle = '#b6e5ff'; X.fillRect(-60, wl, 120, 4);
    for (let k = 0; k < 3; k++) { const q = (T * .6 + k * .33) % 1; X.globalAlpha = (1 - q) * .8; X.beginPath(); X.arc(Math.sin(k * 3 + T * 2) * 7, 66 - q * 120, 2.2, 0, TAU); X.fillStyle = '#fff'; X.fill(); X.globalAlpha = 1; }
    X.restore();
    X.strokeStyle = INK; X.lineWidth = 3; for (const f of [0, .25, .5, .75, 1]) { X.beginPath(); X.moveTo(-132, -58 + f * 124); X.lineTo(f % .5 === 0 ? -122 : -126, -58 + f * 124); X.stroke(); }
    glint(-186, -30, 4, 22, .1, .5);
    X.restore();
  }
  function drawJug(T, won, lost, rk) {
    if (!ABG) ABG = bakeA(); ctx.drawImage(ABG, 0, 0);
    const pc = (D.partner && D.partner.color) || '#6EA8FE', me1 = myCol();
    // gags: the cat on the sill watches the stream, the radio plays
    cat(150, 160, .55, T, won ? 'happy' : null);
    for (let k = 0; k < 3; k++) { const q = (T * .6 + k / 3) % 1; X.globalAlpha = 1 - q; txt('♪', 300 + k * 30 + Math.sin(T * 3 + k) * 8, 112 - q * 60, 22, '#c14d2f'); X.globalAlpha = 1; }
    rr(520, 20, 90, 90, 10); ink('#fff6e0', 4); X.save(); rr(526, 26, 78, 78, 7); X.clip(); X.fillStyle = '#7ec8e3'; X.fillRect(520, 20, 90, 90); caos(565, 106, 2.8, { col: pc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (T < 3.5 && !g.result) pill(565, 130, 'YOUR FRIEND', pc);
    // the kettle + stream
    const ang = th * .8, offx = (jx - 400) * .35, offy = Math.sin(T * 2.3) * 3 - ang * 10;
    const c = Math.cos(-ang), s = Math.sin(-ang), tx = PIVX + offx + c * -256 - s * -138, ty = PIVY + offy + s * -256 + c * -138;
    const fln = clamp(flow / FM, 0, 1);
    // water leaves the spout; it keeps the horizontal speed it had at the lip
    if (fln > .01 && !g.result) {
      const wd = 3 + fln * 17, N = 18; X.lineCap = 'butt'; X.beginPath(); for (let i = 0; i <= N; i++) { const q = i / N, yy = ty + (TBL - ty) * q, xx = tx - 26 * q * (1 - q) * 2 + Math.sin(T * 30 + q * 9) * 1.2; i ? X.lineTo(xx, yy) : X.moveTo(xx, yy); }
      X.lineWidth = wd + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = wd; X.strokeStyle = '#bfe6ff'; X.stroke();
    }
    X.save(); X.translate(PIVX + offx, PIVY + offy); jugBody(ang, 1 - poured / J, T); X.restore();
    // steam off the kettle
    for (let k = 0; k < 3; k++) { const q = (T * .8 + k / 3) % 1; X.globalAlpha = (1 - q) * .8; X.beginPath(); X.arc(tx + 8 + k * 6 + Math.sin(T * 4 + k) * 4, ty - 8 - q * 46, 5 + q * 8, 0, TAU); ink('rgba(255,255,255,.9)', 1.5, 'rgba(255,255,255,.6)'); X.globalAlpha = 1; }
    // the hot-water hits the table: a hiss, but nobody sees where it lands
    if (fln > .01 && !g.result) { for (let k = 0; k < 3; k++) { const q = (T * 2.2 + k / 3) % 1; X.globalAlpha = (1 - q) * .8; X.beginPath(); X.arc(tx - 26 + k * 6 + Math.sin(T * 5 + k) * 6, TBL - 8 - q * 34, 4 + q * 7, 0, TAU); ink('rgba(255,255,255,.9)', 1.2, 'rgba(255,255,255,.5)'); X.globalAlpha = 1; } }
    // my caos behind the kettle, one rubber arm to the handle
    const hop = won && rk >= 0 ? Math.abs(Math.sin(rk * 9)) * 18 : 0;
    X.save(); X.translate(704, 598 - hop);
    if (!won) line([[-26, -48], [-60 + offx * .2, -150], [PIVX + offx - 704 + 26, PIVY + offy - 598 + 26 + hop]], 20, me1);
    else arm(5, -1, -2.7 + Math.sin(T * 14) * .3, 1, me1);
    arm(5, 1, won ? 2.7 - Math.sin(T * 14) * .3 : .6, 1, me1);
    caos(0, 0, 5, { col: me1, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (!won) { X.save(); X.translate(PIVX + offx + 26, PIVY + offy + 26); X.rotate(-ang); rr(-14, -14, 28, 28, 6); ink(me1, 3.5); glint(-5, -6, 4, 5, 0, .6); X.restore(); }
    if (T < 3.5 && !g.result) pill(704, 500, 'YOU', me1);
    if (T < 3 && !g.result) DUO.demoFinger(430 + (Math.sin(T * 3) * .5 + .5) * 200, 590, true, (T * 2) % 1);
    // a little "?" over the table: the cloth is hidden down there
    X.save(); X.translate(330, TBL + 40); X.rotate(Math.sin(T * 2) * .08); txt('?', 0, 0, 52, '#fff6e0'); X.restore();
    if (won && rk >= 0) {
      for (const c2 of conf) { X.save(); X.translate(c2.x + Math.sin(T * 3 + c2.ph) * 12, c2.y); X.rotate(T * 4 + c2.ph); X.fillStyle = c2.c; X.fillRect(-5, -3, 10, 6); X.restore(); }
      const gx = lerp(-100, 280, ease(rk / .7)); grandma(gx, TBL + 52, 5, T, { walk: rk < .7, cup: true, mood: 'happy' });
      badge('COLADITO!', 400, 200, 54, '#8a5a30', '#fff', outBack(rk / .28) * (rk > 2.2 ? Math.max(0, 1 - (rk - 2.2) * 2) : 1), -.06);
      if (rk > .45) badge('BEST COFFEE!', 400, 272, 32, '#2fa84a', '#fff', outBack((rk - .45) / .22), .05);
    }
    if (lost && rk >= 0) {
      const k = clamp((rk - .25) / .55, 0, 1), cxp = lerp(-80, 690, k), cyp = lerp(300, 540, k) - Math.sin(k * Math.PI) * 110;
      if (rk > .25 && rk < .8) chancla(cxp, cyp, 1.3, -rk * 14); else if (rk >= .8) { chancla(690, 570 + Math.min(1, (rk - .8) * 3) * 10, 1.2, -.25); star(704, 520, 46 * Math.min(1, (rk - .8) * 6), 20, 9, rk * 2, '#ffe14d', 4); }
      grandma(130, TBL + 52, 4.6, T, { mood: 'mad', cup: false });
      const txtMain = why === 'o' ? 'OVERFLOW!' : why === 's' ? 'SPILLED!' : 'TOO SLOW!';
      badge(txtMain, 400, 200, 52, '#e8434f', '#fff', outBack(rk / .22), -.05);
      if (rk > .8) badge('CHANCLAZO!', 400, 276, 32, '#7e5bd6', '#fff', outBack((rk - .8) / .22), .04);
    }
  }

  g.dbg = {
    HW, J, TS,
    /* what each screen shows. JARRA: the tilt it holds, the thickness of the stream, the water left in the kettle (glass gauge). It never sees the cloth. */
    view: () => jug
      ? { role: 0, th, tt, flow: clamp(flow / FM, 0, 1), left: 1 - poured / J }
      : { role: 1, L, cx, sx: sxNow(g.c), flowing: rFlow > .012, spilled, cup, poured: rPoured, ptx },
    truth: () => ({ th, poured, L, cx, spilled, rPoured, why }),
  };
  wire(g, D, 1, sp, 'du_cafe');
  return g;
}
reg('du_cafe', duCafe, 'CAFÉ COLADO'); REGMAP.du_cafe.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  const wg = X.createLinearGradient(0, 0, 0, 240); wg.addColorStop(0, '#ffeec4'); wg.addColorStop(1, '#ffd98f'); X.fillStyle = wg; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#cfe3f5'; X.fillRect(0, 150, 520, 90); X.fillStyle = INK; X.fillRect(0, 148, 520, 4);
  if (role === 0) {
    const a = u < 2 ? ease(u / 1.6) : ease(1 - (u - 2) / 1.6), px = 340, py = 120;
    X.save(); X.translate(px, py); X.scale(.5, .5); X.rotate(0); X.rotate(-a * .8);
    line([[-32, -72], [24, -80], [44, -20], [24, 42], [-32, 58]], 16, BLUED); line([[-205, -62], [-240, -118], [-256, -138]], 26, BLUE);
    rr(-200, -95, 172, 190, 30); cel(BLUE, BLUED, () => rr(-200, -95, 172, 190, 30), 20, -8, 5); rr(-196, -112, 164, 26, 12); ink('#fff6e0', 3.5); X.restore();
    if (a > .35) { const c = Math.cos(-a * .8), s = Math.sin(-a * .8), tx = px + (c * -256 + s * 138) * .5, ty = py + (s * -256 - c * 138) * .5; X.lineWidth = 3 + a * 7 + 5; X.strokeStyle = INK; X.beginPath(); X.moveTo(tx, ty); X.lineTo(tx - 6, 150); X.stroke(); X.lineWidth = 3 + a * 7; X.strokeStyle = '#bfe6ff'; X.stroke(); }
    X.fillStyle = INK; X.fillRect(160, 150, 360, 4); X.beginPath(); X.rect(0, 150, 520, 90); X.fillStyle = '#e8434f'; X.fill();
    DUO.demoFinger(lerp(300, 440, a), 205, a > .1, u % 1);
    badge('POUR IT SLOW!', 260, 26, 16, '#2b9ee6', '#fff', 1, -.02);
  } else {
    const sx = 260 + 90 * Math.sin(tt * 1.8), cxx = 260 + 90 * Math.sin(tt * 1.8 - .3), s = .5;
    X.fillStyle = INK; X.fillRect(0, 62, 520, 12); X.fillStyle = WOOD; X.fillRect(0, 64, 520, 8);
    X.save(); X.translate(cxx, 84); X.scale(s, s); X.translate(-cxx * 0, -RIMY); X.translate(0, 0);
    X.restore();
    X.save(); X.translate(cxx - 0, 70); X.scale(.5, .5); X.translate(-cxx * 0, -RIMY);
    X.beginPath(); X.ellipse(0, RIMY, 90, 18, 0, 0, TAU); X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = WOOD; X.stroke();
    X.beginPath(); X.moveTo(-88, RIMY); X.bezierCurveTo(-88, 390, -30, 440, 0, TIPY); X.bezierCurveTo(30, 440, 88, 390, 88, RIMY); X.closePath(); ink(CLOTH, 5);
    X.save(); X.clip(); const lvl = .3 + .4 * Math.abs(Math.sin(tt * 1.2)); X.fillStyle = COF; X.fillRect(-100, TIPY - lvl * (TIPY - RIMY), 200, 200); X.fillStyle = 'rgba(239,228,200,.28)'; X.fillRect(-100, TIPY - lvl * (TIPY - RIMY), 200, 200); X.restore();
    X.restore();
    X.lineWidth = 11; X.strokeStyle = INK; X.beginPath(); X.moveTo(sx, 0); X.lineTo(sx, 72); X.stroke(); X.lineWidth = 6; X.strokeStyle = '#bfe6ff'; X.stroke();
    DUO.demoFinger(cxx, 190 + Math.sin(tt * 4) * 2, true, (u % 1));
    X.fillStyle = INK; X.fillRect(0, 214, 520, 4);
    badge('FOLLOW THE STREAM!', 260, 26, 16, '#c98a12', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_cafe = [['JUG', 'POUR SLOW AND TELL YOUR FRIEND', 'TILT THE PHONE TO POUR'], ['CLOTH', 'KEEP THE CLOTH UNDER THE STREAM', 'DRAG TO FOLLOW, SHOUT WHEN FULL']];
DUO.DEMOS.du_cafe = [t => demo(0, t), t => demo(1, t)];

})();
