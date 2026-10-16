'use strict';
/* ═════════ SQUAD · BOLAS CRIOLLAS (sq_bolas), 3-4 players, one role each ═════════
   Bolas criollas in the plaza: the team throws balls at the boliche (the little jack) and wins when ONE ball stops inside the target ring.
   Seen from above: the throw line at the bottom, the sand court, the boliche somewhere up the court. The plaza dog sleeps ON the way to it
   and a dry leaf lies on it: a ball that rolls through the dog is carried off (the game is lost), a ball that rolls through the leaf stops dead.
   n = 4:  MEDIDOR (0, JUDGE)  sees the boliche, the target ring and where each ball stopped (distance in metres). Presses "más lejos" / "más cerca":
                               the arrows of that call say how far off the ball was. Decides the verdict.
           LANZADOR (1)        sees ONLY his power gauge (the boliche is hidden in the fog). HOLD to charge, let go to throw. Listens to the Medidor.
           APUNTADOR (2)       sees the court, the boliche and the aim line, but NOT the power. Slides / drags the angle (A D or slider).
           DESPEJADOR (3)      shoos the dog and sweeps the leaf off the way (tap them, or 1 / 2). They come back after a few seconds.
   n = 3:  no Despejador: the way is clear (the dog sleeps by a bench).
   Physics (deterministic, the same on every screen): from the throw line the ball goes along the aim angle for 40 + 290 * power px, easing to a stop.
   The first obstacle (leaf, dog) whose circle the path crosses decides where it ends. Win = a stopped ball within RAD px of the boliche.
   Netcode: every role owns its variables and republishes them as absolutes every 0.5 s while they matter:
     APUNTADOR  'ang' [deg*10]          (the aim angle)
     LANZADOR   'pow' [k, power*100]    (release of the k-th throw, resent until the judge's 'th' arrives)
     DESPEJADOR 'obs' [dogAway, leafAway]
     MEDIDOR    'th' [k, ang*10, power*100, dogOn, leafOn] (the throw as it was decided), 'fb' [dir, arrows, k], 'why' cause
   The level (boliche, dog, leaf) is drawn from mkR() with the same number of draws for every head count. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only

const SX = 400, SY = 500, RAD = 50, BR = 10, ROLL = 1.0, CH = .95, DMIN = 40, DSPAN = 290, AWAY = 6.5, ARROW = 45;
const DOGR = 30, LEAFR = 20, ANGMAX = 45;
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const NAMES = ['MEASURER', 'THROWER', 'AIMER', 'SWEEPER'];
const BALLC = ['#e8434f', '#3f8fe0'], BALLD = ['#a8283a', '#2763a8'];
const RED = '#e8434f', SAND = '#e8c98f', SAND2 = '#c9a56a', WOOD = '#9a5f2c', WOODL = '#c98443', GOLD = '#ffcf33';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(build, base, shade, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 24);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(380, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 380);
  X.restore();
}
function ball(x, y, z, col, dk, r = BR, T = 0) {                       // a bola criolla: x,y on the ground, z in the air
  X.fillStyle = 'rgba(20,16,28,' + (.28 - Math.min(.16, z / 220)) + ')'; el(x + z * .15, y + 2, r * (1 + z / 120), r * .4 * (1 + z / 120)); X.fill();
  cel(() => { X.beginPath(); X.arc(x, y - z, r, 0, TAU); }, col, dk, r * .3, r * .3, 3);
  X.fillStyle = 'rgba(255,255,255,.6)'; el(x - r * .35, y - z - r * .4, r * .28, r * .18, -.6); X.fill();
}
function arrowKey(x, y, w, h, up, col, on) { rr(x, y, w, h, 14); ink(col, 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(x + 8, y + 5, w - 16, 7, 3.5); X.fill(); }
function dog(x, y, s, T, awake, carry) {                               // plaza dog, sleeping or on its feet
  const wag = Math.sin(T * (awake ? 18 : 2.5)) * (awake ? .5 : .15), br = awake ? 0 : Math.sin(T * 2.4) * 1.2;
  line([[x - 24 * s, y - 6 * s], [x - 34 * s, y - 20 * s + wag * 14 * s]], 7 * s, '#a8703c');
  cel(() => el(x, y - 10 * s + br * .5, 26 * s, 14 * s + br * .4), '#d9a066', '#a8703c', 3 * s, 6 * s, 3.5);
  for (const lx of [-12, 12]) { rr(x + lx * s - 5 * s, y - 2 * s, 10 * s, 9 * s, 4 * s); ink('#d9a066', 3); }
  const hx = x + 26 * s, hy = y - 14 * s + (awake ? 0 : 5 * s);
  cel(() => el(hx, hy, 15 * s, 13 * s), '#d9a066', '#a8703c', 2 * s, 4 * s, 3.5);
  el(hx + 11 * s, hy + 3 * s, 8 * s, 6 * s); ink('#efc590', 3); X.beginPath(); X.arc(hx + 17 * s, hy + 1 * s, 2.6 * s, 0, TAU); ink(INK, 1);
  el(hx - 9 * s, hy - 6 * s + (awake ? 0 : 6 * s), 5 * s, 10 * s, .5); ink('#7a4a22', 3);
  if (awake) { X.fillStyle = '#fff'; X.beginPath(); X.arc(hx + 3 * s, hy - 3 * s, 3.4 * s, 0, TAU); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(hx + 4.4 * s, hy - 3 * s, 1.7 * s, 0, TAU); X.fill(); }
  else line([[hx - 1 * s, hy - 2 * s], [hx + 7 * s, hy - 2 * s]], 2.2, INK);
  if (carry) ball(hx + 20 * s, hy + 6 * s, 0, carry[0], carry[1], BR * .9 * s);
  if (!awake) { const k = (T * .6) % 1; X.globalAlpha = 1 - k; txt('Z', hx + 12 * s + k * 10, hy - 22 * s - k * 22, 14 + k * 8, '#fff'); X.globalAlpha = 1; }
}
function leaf(x, y, rot, s) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  const b = () => { X.beginPath(); X.moveTo(-22, 0); X.quadraticCurveTo(-8, -17, 22, -4); X.quadraticCurveTo(8, 17, -22, 0); X.closePath(); };
  cel(b, '#c98443', '#8f5a24', 3, 5, 3); line([[-20, 0], [18, -2]], 2, '#8f5a24'); line([[-4, -1], [4, -9]], 1.6, '#8f5a24'); line([[2, -1], [10, 7]], 1.6, '#8f5a24');
  X.restore();
}

/* ───────────── the plaza, painted once ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, '#8fd8ff'); g.addColorStop(1, '#ffe9b5'); X.fillStyle = g; X.fillRect(0, 0, W, 170);
  X.beginPath(); X.moveTo(0, 150); X.quadraticCurveTo(120, 60, 260, 110); X.quadraticCurveTo(360, 70, 470, 120); X.lineTo(470, 170); X.lineTo(0, 170); X.closePath(); ink('#5aa37c', 3);       // El Ávila behind the plaza
  X.fillStyle = 'rgba(255,255,255,.3)'; el(120, 100, 60, 8); X.fill();
  // the church: ochre facade, bell tower and clock
  rr(560, 62, 190, 112, 4); cel(() => rr(560, 62, 190, 112, 4), '#f2d49b', '#d9b273', 8, 0, 4);
  rr(600, 14, 70, 60, 4); cel(() => rr(600, 14, 70, 60, 4), '#f2d49b', '#d9b273', 6, 0, 4);
  tri(594, 18, 676, 18, 635, -8, RED, 4); rr(620, 78, 30, 6, 2); ink('#a8703c', 2);
  X.beginPath(); X.arc(635, 40, 14, 0, TAU); ink('#fff7e6', 3); line([[635, 40], [635, 31]], 2.5, INK); line([[635, 40], [642, 44]], 2.5, INK);
  X.beginPath(); X.moveTo(594, 174); X.lineTo(594, 122); X.arc(620, 122, 26, Math.PI, 0); X.lineTo(646, 174); X.closePath(); ink('#6b3d22', 4);
  for (const wx of [578, 702]) { rr(wx - 12, 96, 24, 34, 12); ink('#2b2d5c', 3); }
  // the Bolívar statue on its pedestal
  rr(150, 126, 90, 48, 4); cel(() => rr(150, 126, 90, 48, 4), '#d6d0bd', '#a49d86', 6, 8, 4);
  el(195, 108, 34, 15); ink('#5f8d7a', 3.5); rr(214, 82, 12, 30, 4); ink('#5f8d7a', 3); X.beginPath(); X.arc(222, 72, 9, 0, TAU); ink('#5f8d7a', 3);
  line([[168, 118], [166, 130]], 6, '#5f8d7a'); line([[218, 118], [220, 130]], 6, '#5f8d7a'); line([[170, 104], [158, 92]], 6, '#5f8d7a');
  // palms and the hedge
  for (const px of [48, 752]) {
    line([[px, 176], [px + (px < 400 ? 10 : -10), 96]], 12, '#a8703c');
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .55, hx = px + (px < 400 ? 10 : -10); line([[hx, 96], [hx + Math.cos(a) * 54, 96 + Math.sin(a) * 40 + 16]], 9, '#3f9a5c'); }
  }
  X.fillStyle = '#4da568'; for (let i = 0; i < 12; i++) { X.beginPath(); X.arc(262 + i * 24, 168, 17, 0, TAU); ink(i % 2 ? '#4da568' : '#59b874', 3); }
  for (let i = 0; i < 7; i++) { X.beginPath(); X.arc(274 + i * 40, 160, 4, 0, TAU); ink(i % 2 ? '#ff7ab6' : '#ffe14d', 1.5); }
  // cobbles around the court
  X.fillStyle = '#d3c7a6'; X.fillRect(0, 176, W, H - 176);
  X.strokeStyle = 'rgba(120,100,70,.3)'; X.lineWidth = 3;
  for (let r = 0; r < 12; r++) { const y = 186 + r * 32; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); for (let c = 0; c < 18; c++) { X.beginPath(); X.moveTo(c * 48 + (r % 2) * 24, y); X.lineTo(c * 48 + (r % 2) * 24, y + 32); X.stroke(); } }
  // the court: wood frame, sand, a painted throw line
  rr(96, 180, 608, 348, 26); ink(WOOD, 6); X.fillStyle = WOODL; rr(104, 186, 592, 12, 6); X.fill();
  g = X.createLinearGradient(0, 196, 0, 528); g.addColorStop(0, '#efd7a3'); g.addColorStop(1, SAND); rr(110, 198, 580, 318, 18); ink(g, 3);
  X.fillStyle = 'rgba(160,110,60,.2)'; for (let i = 0; i < 60; i++) { X.beginPath(); X.arc(130 + hash(i) * 540, 214 + hash(i + 80) * 290, 1.5 + hash(i + 40) * 2.2, 0, TAU); X.fill(); }
  X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(300, SY + 12); X.lineTo(500, SY + 12); X.stroke();
  X.strokeStyle = 'rgba(255,255,255,.35)'; X.setLineDash([2, 12]); X.beginPath(); X.moveTo(120, 280); X.lineTo(680, 280); X.stroke(); X.setLineDash([]);
  // the wooden tray where each role's controls live
  rr(14, 526, 772, 68, 20); ink(WOOD, 5); X.fillStyle = '#6f4420'; rr(22, 534, 756, 52, 14); X.fill(); X.fillStyle = 'rgba(255,255,255,.2)'; rr(30, 538, 740, 7, 3.5); X.fill();
  X = old; return cv2;
}

/* ═════════ the game ═════════ */
function sqBolas(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, judge = me === 0, thrower = me === 1, aimer = me === 2, sweeper = n === 4 && me === 3, OB = n === 4;
  /* the level: identical on every screen (always the same 3 draws) */
  const sgn = R() < .5 ? -1 : 1, bang = sgn * (22 + R() * 12), bd = 190 + R() * 90;
  const ux = Math.sin(bang * DEG), uy = -Math.cos(bang * DEG), BX = SX + ux * bd, BY = SY + uy * bd;
  const DOG = OB ? { x: SX + ux * bd * .55, y: SY + uy * bd * .55 } : { x: sgn > 0 ? 170 : 630, y: 360 };
  const LEAF = { x: SX + ux * bd * .3, y: SY + uy * bd * .3 };
  /* state */
  let ang = 0, angSent = -99, angAt = -9, dragging = false;
  const throws = []; let fb = null, fbDone = -1;
  let holdAt = -1, lockUntil = -9, powSent = null; const hist = [];
  let dogAway = 0, leafAway = 0, dogUntil = -9, leafUntil = -9, obsSig = '', obsAt = -9, dogK = 0, leafK = 0;
  let cause = 0, resAt = -1, endFx = false, stealAt = -1, hoverK = -1;
  const pops = [], padAt = [-9, -9, -9];
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }

  function land(a, pw, dogOn, leafOn) {                      // deterministic: where does a ball thrown at angle a (deg) with power pw (0..1) stop?
    const ax = Math.sin(a * DEG), ay = -Math.cos(a * DEG), L = DMIN + DSPAN * pw; let ex = SX + ax * L, ey = SY + ay * L, kind = 0, best = 1e9;
    const hit = (c, r, k) => {
      const px = c.x - SX, py = c.y - SY, tt = clamp(px * ax + py * ay, 0, L), qx = SX + ax * tt - c.x, qy = SY + ay * tt - c.y;
      if (Math.hypot(qx, qy) < r + BR && tt < best) { best = tt; kind = k; ex = c.x; ey = c.y; }
    };
    if (leafOn) hit(LEAF, LEAFR, 1);
    if (dogOn) hit(DOG, DOGR, 2);
    return { ex, ey, kind };
  }
  const last = () => throws[throws.length - 1];
  const rolling = () => { const l = last(); return !!l && g.c - l.t0 < ROLL; };
  function addThrow(k, a, pw, dOn, lOn) {
    if (k !== throws.length) return; const L = land(a, pw, dOn, lOn); throws.push({ k, a, pw, dOn, lOn, ex: L.ex, ey: L.ey, kind: L.kind, t0: g.c, res: false, d: 0 });
    snd(180, .08, 'square', .06, 0, 110); noise(.08, .08, 600, 1400, 'bandpass'); if (thrower) { lockUntil = -9; powSent = null; }
  }
  const errOf = t => { const dx = t.ex - BX, dy = t.ey - BY; return { along: dx * ux + dy * uy, side: dx * -uy + dy * ux, dist: Math.hypot(dx, dy) }; };
  /* ── the Medidor ── */
  function judgeThrow(pw) {
    const a = ang, dOn = OB && !dogAway ? 1 : 0, lOn = OB && !leafAway ? 1 : 0, k = throws.length;
    addThrow(k, a, pw, dOn, lOn); D.send('th', [k, Math.round(a * 10), Math.round(pw * 100), dOn, lOn]);
  }
  function fbPress(dir) {
    if (!judge || g.result) return; const t = last(); padAt[dir > 0 ? 1 : 2] = g.c;
    if (!t || !t.res || fbDone >= t.k) { sfx.miss(); return; }
    fbDone = t.k; const lvl = clamp(Math.ceil(Math.abs(errOf(t).along) / ARROW), 1, 6); fb = { dir, lvl, k: t.k, at: g.c }; D.send('fb', [dir, lvl, t.k]); snd(dir > 0 ? 620 : 420, .1, 'triangle', .07);
  }
  /* ── the Lanzador ── */
  function press() {
    if (!thrower || g.result || holdAt >= 0 || g.c < lockUntil || rolling()) return; holdAt = g.c; snd(200, .06, 'square', .04, 0, 300);
  }
  function release() {
    if (!thrower || holdAt < 0 || g.result) return; const p = clamp((g.c - holdAt) / CH, 0, 1); holdAt = -1; hist.push(p);
    lockUntil = g.c + 1.6; powSent = { k: throws.length, p: Math.round(p * 100), at: g.c }; D.send('pow', [powSent.k, powSent.p]); snd(300, .08, 'square', .06, 0, 160);
  }
  /* ── the Apuntador ── */
  function setAng(a) { a = clamp(a, -ANGMAX, ANGMAX); if (a !== ang) { ang = a; if (aimer && g.c - angAt > .04) { angAt = g.c; angSent = ang; D.send('ang', [Math.round(ang * 10)]); } } }
  function aimFrom(p) { if (p.y >= 520) setAng((p.x - 400) / 240 * ANGMAX); else setAng(Math.atan2(p.x - SX, SY - p.y) / DEG); }
  /* ── the Despejador ── */
  function sendObs() { if (!sweeper) return; D.send('obs', [dogAway, leafAway]); obsAt = g.c; obsSig = dogAway + ',' + leafAway; }
  function shoo(w) {
    if (!sweeper || g.result) return;
    if (w === 0) { dogUntil = g.c + AWAY; if (!dogAway) { dogAway = 1; sendObs(); } snd(520, .1, 'sawtooth', .05, 0, 300); pop('SHOO!', DOG.x, DOG.y - 50, 20, '#2b9ee6'); }
    else { leafUntil = g.c + AWAY; if (!leafAway) { leafAway = 1; sendObs(); } noise(.2, .08, 1200, 3000, 'bandpass'); pop('SWEEP!', LEAF.x, LEAF.y - 30, 20, '#2b9ee6'); }
  }

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['CALL CLOSER OR FARTHER!', 'HOLD AND THROW!', 'AIM AT THE BOLICHE!', 'CLEAR THE WAY!'][me], roleLabel: NAMES[me],
    hint: judge ? 'WATCH WHERE EACH BALL STOPS AND CALL "FARTHER" OR "CLOSER" (KEYS 1 / 2 OR CLICK) - DO NOT LET THE DOG STEAL THE BALL'
      : thrower ? 'HOLD (SPACE OR CLICK) TO CHARGE THE POWER, LET GO TO THROW - THE MEASURER TELLS YOU IF IT WAS TOO SHORT OR TOO LONG'
      : aimer ? 'DRAG THE COURT OR THE SLIDER (A / D) TO POINT THE LINE AT THE BOLICHE - YOU CANNOT SEE THE POWER'
      : 'SHOO THE DOG AND SWEEP THE LEAF OFF THE WAY (CLICK THEM OR PRESS 1 / 2) - THEY COME BACK',
    thint: judge ? 'WATCH WHERE EACH BALL STOPS AND TAP "FARTHER" OR "CLOSER" - DO NOT LET THE DOG STEAL THE BALL'
      : thrower ? 'HOLD TO CHARGE THE POWER, LET GO TO THROW - THE MEASURER TELLS YOU IF IT WAS TOO SHORT OR TOO LONG'
      : aimer ? 'DRAG THE COURT OR THE SLIDER TO POINT THE LINE AT THE BOLICHE - YOU CANNOT SEE THE POWER'
      : 'TAP THE DOG AND THE LEAF TO CLEAR THE WAY - THEY COME BACK',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      dogK += ((dogAway ? 1 : 0) - dogK) * Math.min(1, dt * 4); leafK += ((leafAway ? 1 : 0) - leafK) * Math.min(1, dt * 5);
      if (!g.result) {
        if (aimer && g.c - angAt > .5) { angAt = g.c; D.send('ang', [Math.round(ang * 10)]); }
        if (thrower && powSent) { if (g.c >= lockUntil) powSent = null; else if (g.c - powSent.at > .5) { powSent.at = g.c; D.send('pow', [powSent.k, powSent.p]); } }
        if (sweeper) {
          let ch = false; if (dogAway && g.c >= dogUntil) { dogAway = 0; ch = true; } if (leafAway && g.c >= leafUntil) { leafAway = 0; ch = true; }
          if (ch || g.c - obsAt > .5) sendObs();
        }
        if (judge) {
          const l = last();
          if (l && !l.res && g.c - l.t0 >= ROLL) {
            l.res = true; l.d = errOf(l).dist; snd(l.kind === 2 ? 700 : 240, .12, 'triangle', .06);
            if (l.kind === 2) stealAt = g.c; else if (l.d <= RAD) g.finish('win');
          }
          if (stealAt >= 0 && g.c - stealAt > .9) { cause = 1; D.send('why', 1); g.finish('lose'); }
          else if (!g.result && g.c >= g.limit && !(l && !l.res)) { cause = 2; D.send('why', 2); g.finish('lose'); }
        }
      }
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); for (let i = 0; i < 4; i++) noise(.05, .1, 1800, 3000, 'bandpass', i * .09); }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(300, .5, 'sawtooth', .06, 0, 90); noise(.3, .1, 300, 900, 'lowpass'); shake(6, .25); }
      while (pops.length && g.c - pops[0].t0 > 1.0) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'ang') { if (!aimer && Array.isArray(d)) ang = clamp((d[0] | 0) / 10, -ANGMAX, ANGMAX); }
      else if (type === 'pow') { if (judge && !g.result && Array.isArray(d) && (d[0] | 0) === throws.length && !rolling()) judgeThrow(clamp((d[1] | 0) / 100, 0, 1)); }
      else if (type === 'th') { if (!judge && Array.isArray(d)) { if (!aimer) ang = (d[1] | 0) / 10; addThrow(d[0] | 0, (d[1] | 0) / 10, (d[2] | 0) / 100, d[3] | 0, d[4] | 0); } }
      else if (type === 'fb') { if (!judge && Array.isArray(d)) { fb = { dir: d[0] | 0, lvl: d[1] | 0, k: d[2] | 0, at: g.c }; snd(d[0] > 0 ? 620 : 420, .1, 'triangle', .06); } }
      else if (type === 'obs') { if (!sweeper && Array.isArray(d)) { dogAway = d[0] ? 1 : 0; leafAway = d[1] ? 1 : 0; } }
      else if (type === 'why') cause = d | 0;
    },
    draw(t0) {
      X = ctx; const T = g.c, won = g.result === 'win', over = !!g.result, lostG = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      const mood = won ? 'happy' : lostG ? 'sad' : null, l = last();
      // the boliche and its ring (the Lanzador is blind to it: fog)
      if (!thrower) {
        if (judge) { X.setLineDash([8, 8]); X.beginPath(); X.arc(BX, BY, RAD, 0, TAU); X.lineWidth = 4; X.strokeStyle = won ? '#22a447' : '#fff'; X.stroke(); X.setLineDash([]); X.fillStyle = 'rgba(255,255,255,.25)'; X.beginPath(); X.arc(BX, BY, RAD, 0, TAU); X.fill(); }
        else { X.setLineDash([4, 10]); X.beginPath(); X.arc(BX, BY, RAD, 0, TAU); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.7)'; X.stroke(); X.setLineDash([]); }
        ball(BX, BY, 0, GOLD, '#c9962a', 6);
      }
      // obstacles that are on the way
      if (leafK < .98) { const lx = LEAF.x + leafK * (sgn > 0 ? 520 : -520), ly = LEAF.y - leafK * 70; if (OB || leafK < .98) leaf(lx, ly, .5 + leafK * 6 + Math.sin(T * 2) * .05, 1); }
      // balls
      throws.forEach((th, i) => {
        const e = T - th.t0, kk = clamp(e / ROLL, 0, 1), s = 1 - Math.pow(1 - kk, 2.2), z = e < .4 ? Math.sin(Math.PI * clamp(e / .4, 0, 1)) * 38 : 0, c = i % 2;
        let bx = SX + (th.ex - SX) * s, by = SY + (th.ey - SY) * s;
        const stolen = th.kind === 2 && e > ROLL; if (stolen) { const q = e - ROLL; if (q > .45) { bx = DOG.x + (q - .45) * 420; by = DOG.y; } }
        if (!(stolen && bx > 840)) ball(bx, by, z, BALLC[c], BALLD[c], BR, T);
      });
      if (l && l.res && !over && !(l.kind === 2)) {      // the Medidor's tape: from the last ball to the boliche
        if (judge) { const ee = errOf(l); X.setLineDash([5, 6]); X.beginPath(); X.moveTo(l.ex, l.ey); X.lineTo(BX, BY); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke(); X.setLineDash([]); badge(t('{n} M', { n: (ee.dist / 50).toFixed(1) }), clamp((l.ex + BX) / 2, 90, 710), clamp((l.ey + BY) / 2 - 22, 210, 480), 17, '#3a3550', '#fff', 1); }
      }
      // the dog, awake only when it steals
      { const stole = l && l.kind === 2 && T - l.t0 > ROLL, q = stole ? T - l.t0 - ROLL : 0, dgx = DOG.x + dogK * (sgn > 0 ? -560 : 560) + (stole && q > .45 ? (q - .45) * 420 : 0), dgy = DOG.y - (OB ? 0 : 0);
        if (dogK < .98 || stole) { const awake = stole || dogK > .1 || (won), car = stole && q > .45 ? [BALLC[l.k % 2], BALLD[l.k % 2]] : null; dog(dgx, dgy, 1, T, awake, car); } }
      // aim line / arrow
      if (aimer && !over) {
        X.setLineDash([12, 10]); X.beginPath(); X.moveTo(SX, SY); X.lineTo(SX + Math.sin(ang * DEG) * 330, SY - Math.cos(ang * DEG) * 330); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke(); X.setLineDash([]);
      }
      { const ax = SX + Math.sin(ang * DEG) * 70, ay = SY - Math.cos(ang * DEG) * 70;
        if (!over) { X.save(); X.translate(ax, ay); X.rotate(ang * DEG); tri(-10, 8, 10, 8, 0, -14, cols(2), 3); X.restore(); } }
      // the crew
      const pos = [[48, 330], [330, 514], [752, 330], [752, 450]];
      for (let r = 0; r < n; r++) {
        const [x, y] = pos[r], jig = won ? -Math.abs(Math.sin(T * 9 + r)) * 10 : 0;
        shadow(x, y + 3, 28, 7, .22); caos(x, y + jig, 3.2, { col: cols(r), mood });
        pill(x, r === 1 ? y - 90 : y - 90, r === me ? 'YOU' : name(r), cols(r)); txt(NAMES[r], x, (r === 1 ? y - 90 : y - 90) + 20, 12, '#fff', 'center', 90);
        if (r === 1) { const ch = holdAt >= 0 ? clamp((T - holdAt) / CH, 0, 1) : 0; ball(x + 36, y - 20 - ch * 6, 0, BALLC[throws.length % 2], BALLD[throws.length % 2], BR, T); }
      }
      // the pigeon on the statue
      { const bob = Math.sin(T * 5) > .85 ? 3 : 0, fl = won ? Math.sin(T * 30) * 5 : 0; X.beginPath(); X.ellipse(222, 58 - bob - Math.abs(fl), 8, 6, 0, 0, TAU); ink('#b8b4c8', 2.5); X.beginPath(); X.arc(229, 53 - bob, 3.5, 0, TAU); ink('#b8b4c8', 2); tri(231, 53 - bob, 236, 54 - bob, 231, 56 - bob, GOLD, 1.5); }
      // fog for the Lanzador
      if (thrower) {
        const gr = X.createLinearGradient(0, 196, 0, 440); gr.addColorStop(0, 'rgba(255,244,214,.96)'); gr.addColorStop(1, 'rgba(255,244,214,.55)'); X.fillStyle = gr; rr(110, 198, 580, 250, 18); X.fill();
        for (let i = 0; i < 4; i++) { X.fillStyle = 'rgba(255,255,255,.7)'; el(190 + i * 140 + Math.sin(T * .6 + i) * 20, 270 + (i % 2) * 70, 70, 20); X.fill(); }
        txt('FOG!', 400, 300, 34, 'rgba(255,255,255,.95)'); txt('YOU CANNOT SEE THE BOLICHE', 400, 336, 17, '#fff', 'center', 420);
        throws.forEach((th, i) => { const q = T - th.t0; if (q > ROLL) ball(th.ex, th.ey, 0, BALLC[i % 2], BALLD[i % 2], BR, T); });
      }
      // the feedback bubble from the Medidor
      if (fb && fb.k === throws.length - 1 && !over) {
        const k = outBack((T - fb.at) / .2), far = fb.dir > 0;
        X.save(); X.translate(400, 392); X.scale(k, k); rr(-140, -34, 280, 68, 22); ink('#fff', 4);
        for (let i = 0; i < fb.lvl; i++) { const ax = -118 + i * 20; tri(ax - 8, far ? 8 : -8, ax + 8, far ? 8 : -8, ax, far ? -10 : 10, far ? '#22a447' : '#e8434f', 2); }
        txt(far ? 'FARTHER!' : 'CLOSER!', 28 + (fb.lvl > 3 ? 20 : 0), 2, 28, far ? '#1e7c3a' : '#b8283a', 'center', 190 - (fb.lvl > 3 ? 40 : 0)); X.restore();
      }
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      // ───── the role's own controls on the tray ─────
      if (!over) {
        if (judge) {
          for (const dir of [1, -1]) {
            const r0 = fbRect(dir), pr = T - padAt[dir > 0 ? 1 : 2] < .12, ok = l && l.res && fbDone < l.k, d = pr ? 2 : 6;
            rr(r0.x, r0.y + 6, r0.w, r0.h, 14); ink('#3a3550', 4); rr(r0.x, r0.y + 6 - d, r0.w, r0.h, 14); ink(ok ? (dir > 0 ? '#7CE08A' : '#ff9a8a') : '#d3cfe0', 4);
            X.fillStyle = 'rgba(255,255,255,.4)'; rr(r0.x + 8, r0.y + 9 - d, r0.w - 16, 6, 3); X.fill();
            tri(r0.x + 34, r0.y + (dir > 0 ? 36 : 12) - d, r0.x + 54, r0.y + (dir > 0 ? 36 : 12) - d, r0.x + 44, r0.y + (dir > 0 ? 12 : 36) - d, ok ? INK : '#8a85a0', 2);
            txt(dir > 0 ? 'FARTHER!' : 'CLOSER!', r0.x + r0.w / 2 + 28, r0.y + 24 - d, 22, ok ? INK : '#6c6785', 'center', r0.w - 110);
            if (!TOUCH) { rr(r0.x + r0.w - 32, r0.y + 8 - d, 22, 24, 6); ink('#fff', 2); txt(dir > 0 ? '1' : '2', r0.x + r0.w - 21, r0.y + 21 - d, 15, INK); }
          }
          if (!l) txt('WAIT FOR THE FIRST THROW', 400, 556, 17, '#fff', 'center', 260);
        } else if (thrower) {
          const ch = holdAt >= 0 ? clamp((T - holdAt) / CH, 0, 1) : 0, gx = 60, gw = 680, gy = 542, gh = 34;
          rr(gx, gy, gw, gh, 12); ink('#fff7e6', 4);
          const gcol = ch < .5 ? '#7CE08A' : ch < .8 ? '#ffd23f' : '#e8434f'; if (ch > 0) { rr(gx + 3, gy + 3, Math.max(14, (gw - 6) * ch), gh - 6, 9); X.fillStyle = gcol; X.fill(); X.fillStyle = 'rgba(255,255,255,.45)'; rr(gx + 8, gy + 6, Math.max(8, (gw - 6) * ch - 10), 6, 3); X.fill(); }
          for (let i = 1; i < 10; i++) { X.fillStyle = 'rgba(20,16,28,.35)'; X.fillRect(gx + gw * i / 10 - 1, gy + gh - 9, 2, 7); }
          hist.slice(-5).forEach((p, i) => { const mx = gx + 3 + (gw - 6) * p; tri(mx - 6, gy - 6, mx + 6, gy - 6, mx, gy + 4, BALLC[0], 1.5); });
          txt(holdAt >= 0 ? 'LET GO TO THROW!' : (g.c < lockUntil || rolling()) ? 'ROLLING...' : 'HOLD TO CHARGE', 400, gy - 12, 16, '#fff', 'center', 300);
        } else if (aimer) {
          rr(160, 548, 480, 20, 10); ink('#fff7e6', 3); const kx = 400 + ang / ANGMAX * 240; rr(kx - 16, 540, 32, 36, 10); ink(cols(2), 3.5); X.fillStyle = 'rgba(255,255,255,.45)'; rr(kx - 10, 544, 20, 6, 3); X.fill();
          for (const sd of [-1, 1]) { const bx = 400 + sd * 300; X.beginPath(); X.arc(bx, 558, 17, 0, TAU); ink('#fff7e6', 3); tri(bx + sd * 7, 558 - 9, bx + sd * 7, 558 + 9, bx - sd * 8, 558, INK, 1.5); if (!TOUCH) txt(sd < 0 ? 'A' : 'D', bx, 538, 13, '#fff'); }
          txt(t('{n} DEG', { n: Math.round(ang) }), 400, 530, 14, '#fff', 'center', 140);
        } else if (sweeper) {
          for (const w of [0, 1]) {
            const r0 = swRect(w), away = w === 0 ? dogAway : leafAway, pr = T - padAt[w] < .12, d = pr ? 2 : 6;
            rr(r0.x, r0.y + 6, r0.w, r0.h, 14); ink('#3a3550', 4); rr(r0.x, r0.y + 6 - d, r0.w, r0.h, 14); ink(away ? '#d3cfe0' : '#ffe14d', 4);
            X.fillStyle = 'rgba(255,255,255,.4)'; rr(r0.x + 8, r0.y + 9 - d, r0.w - 16, 6, 3); X.fill();
            if (away) { const lf = clamp(((w === 0 ? dogUntil : leafUntil) - T) / AWAY, 0, 1); X.fillStyle = lf < .3 ? '#e8434f' : '#22a447'; rr(r0.x + 8, r0.y + 30 - d, Math.max(6, (r0.w - 16) * lf), 5, 2.5); X.fill(); }
            txt(w === 0 ? 'SHOO THE DOG' : 'SWEEP THE LEAF', r0.x + r0.w / 2, r0.y + 22 - d, 19, away ? '#6c6785' : INK, 'center', r0.w - 60);
            if (!TOUCH) { rr(r0.x + 8, r0.y + 10 - d, 22, 24, 6); ink('#fff', 2); txt(String(w + 1), r0.x + 19, r0.y + 23 - d, 15, INK); }
          }
        }
      }
      if (!over && T < 2.4) badge(judge ? 'MEASURE THE THROWS!' : thrower ? 'THROW THE BALL!' : aimer ? 'AIM THE LINE!' : 'CLEAR THE WAY!', 400, 232, 20, judge ? '#22a447' : '#2b9ee6', '#fff', outBack(T / .25), -.03);
      // drawn payoffs
      if (over && rk >= 0) {
        if (won) {
          el(BX, BY, RAD * (1 + rk * .6), RAD * (1 + rk * .6)); X.lineWidth = 5; X.strokeStyle = GOLD; X.globalAlpha = clamp(1 - rk, 0, 1); X.stroke(); X.globalAlpha = 1;
          for (let i = 0; i < 18; i++) { const d = rk - hash(i + 2) * .6; if (d < 0) continue; const fx = 40 + hash(i) * 720 + Math.sin(d * 4 + i) * 14, fy = -20 + d * (200 + hash(i + 7) * 90); if (fy < 600) ball(fx, fy, 0, BALLC[i % 2], BALLD[i % 2], 7); }
          if (rk > .25) badge('BULLSEYE!', 400, 250, 42, '#22a447', '#fff', outBack((rk - .25) / .25), -.04);
        } else {
          if (cause === 1) { if (rk > .2) badge('THE DOG TOOK THE BALL!', 400, 246, 26, '#e8343d', '#fff', outBack((rk - .2) / .25), .03); }
          else {
            if (rk > .2) badge("TIME'S UP!", 400, 246, 36, '#e8343d', '#fff', outBack((rk - .2) / .25), .04);
            const bl = l || { ex: 400, ey: 400 }, pk = clamp((rk - .5) / .4, 0, 1);       // the pigeon bombs the last ball
            if (rk > .5) { const py = 60 + (bl.ey - 70) * pk * pk; X.beginPath(); X.arc(bl.ex, py, 4, 0, TAU); ink('#fff', 1.5); if (pk >= 1) { el(bl.ex, bl.ey - 8, 14, 7); ink('#fff', 2); pop('SPLAT!', bl.ex, bl.ey - 30, 18, '#ffb020'); } }
          }
        }
      }
      vignette(.14);
    },
    down(p) {
      if (g.result) return;
      if (judge) { for (const dir of [1, -1]) { const r0 = fbRect(dir); if (p.x >= r0.x && p.x <= r0.x + r0.w && p.y >= r0.y && p.y <= r0.y + r0.h + 8) { fbPress(dir); return; } } }
      else if (thrower) press();
      else if (aimer) { dragging = true; aimFrom(p); }
      else if (sweeper) {
        for (const w of [0, 1]) { const r0 = swRect(w); if (p.x >= r0.x && p.x <= r0.x + r0.w && p.y >= r0.y && p.y <= r0.y + r0.h + 8) { padAt[w] = g.c; shoo(w); return; } }
        const dd = Math.hypot(p.x - DOG.x, p.y - DOG.y), dl = Math.hypot(p.x - LEAF.x, p.y - LEAF.y);   // the nearest of the two wins
        if (dd < 52 && dd - 10 <= dl) shoo(0); else if (dl < 40) shoo(1);
      }
    },
    move(p) { if (aimer && dragging && !g.result) aimFrom(p); },
    up() { dragging = false; if (thrower) release(); },
    key(e) {
      if (g.result) return; const c = e.code;
      if (judge) { if (c === 'Digit1' || c === 'Numpad1' || c === 'ArrowUp' || c === 'KeyW') fbPress(1); else if (c === 'Digit2' || c === 'Numpad2' || c === 'ArrowDown' || c === 'KeyS') fbPress(-1); }
      else if (thrower) { if (c === 'Space' || c === 'Enter') press(); }
      else if (aimer) { if (c === 'ArrowLeft' || c === 'KeyA') setAng(ang - 1.2); else if (c === 'ArrowRight' || c === 'KeyD') setAng(ang + 1.2); }
      else if (sweeper) { if (c === 'Digit1' || c === 'Numpad1') { padAt[0] = g.c; shoo(0); } else if (c === 'Digit2' || c === 'Numpad2') { padAt[1] = g.c; shoo(1); } }
    },
    keyup(e) { if (thrower && (e.code === 'Space' || e.code === 'Enter')) release(); },
  };

  function fbRect(dir) { return { x: dir > 0 ? 60 : 440, y: 536, w: 300, h: 40 }; }
  function swRect(w) { return { x: w === 0 ? 60 : 440, y: 536, w: 300, h: 40 }; }

  g.dbg = {
    view: () => {
      const l = last(), base = { me, n, k: throws.length, ang, fb: fb ? { dir: fb.dir, lvl: fb.lvl, k: fb.k } : null, S: g.c };
      if (judge) { const ee = l && l.res ? errOf(l) : null; return Object.assign(base, { bx: BX, by: BY, sx: SX, sy: SY, rad: RAD, landed: !!(l && l.res), pending: !!(l && l.res && fbDone < l.k && l.kind !== 2), along: ee ? ee.along : 0, side: ee ? ee.side : 0, dist: ee ? ee.dist : 0, rolling: rolling() }); }
      if (thrower) return Object.assign(base, { meter: holdAt >= 0 ? clamp((g.c - holdAt) / CH, 0, 1) : 0, holding: holdAt >= 0, locked: g.c < lockUntil || rolling() || holdAt >= 0 && false, hist: hist.slice() });
      if (aimer) return Object.assign(base, { bx: BX, by: BY, sx: SX, sy: SY, rolling: rolling() });
      return Object.assign(base, { dog: { on: !dogAway, x: DOG.x, y: DOG.y, left: dogAway ? Math.max(0, dogUntil - g.c) : 0 }, leaf: { on: !leafAway, x: LEAF.x, y: LEAF.y, left: leafAway ? Math.max(0, leafUntil - g.c) : 0 } });
    },
    land, bd, BX, BY, throws,
  };
  wire(g, D, 0, sp, 'sq_bolas');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, tm) {
  X = ctx;
  let g = X.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#d3c7a6'); X.fillStyle = g; X.fillRect(0, 0, 520, 240);
  rr(60, 22, 400, 160, 20); ink(SAND, 4); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(150, 150, 220, 4);
  const u = tm % 4, k = clamp(u / 1.6, 0, 1), bx = 330, by = 56, sx = 260, sy = 150;
  X.beginPath(); X.arc(bx, by, 22, 0, TAU); ink('rgba(255,255,255,.4)', 3); ball(bx, by, 0, GOLD, '#c9962a', 6);
  const px = sx + (bx - sx) * ease(k) * .98, py = sy + (by - sy) * ease(k) * .98;
  if (role !== 1) ball(px, py, Math.sin(Math.PI * clamp(k * 2.5, 0, 1)) * 20, BALLC[0], BALLD[0], 9);
  if (role === 0) {
    caos(70, 216, 2.4, { col: COLS[0] }); badge('MEASURE THE THROWS!', 340, 206, 14, '#22a447', '#fff', 1, -.02);
    const far = u > 2.2; rr(150, 190, 100, 30, 12); ink('#7CE08A', 3); txt('FARTHER!', 200, 205, 14, INK, 'center', 86); demoFinger(200, 212, u > 2.2 && u < 2.7, (u % .5) * 2);
    if (u > 2.2) badge('FARTHER!', 260, 100, 18, '#1e7c3a', '#fff', outBack((u - 2.2) / .2), .03);
  } else if (role === 1) {
    X.beginPath(); X.arc(bx, by, 22, 0, TAU); ink('#fff6dc', 3); txt('FOG!', 300, 90, 22, '#fff');
    const ch = clamp(u / 1.6, 0, 1); rr(100, 190, 320, 26, 10); ink('#fff7e6', 3); rr(103, 193, Math.max(12, 314 * ch), 20, 8); X.fillStyle = ch < .5 ? '#7CE08A' : ch < .8 ? '#ffd23f' : '#e8434f'; X.fill();
    demoFinger(100 + 320 * ch, 204, u < 1.7, (u % .5) * 2); if (u > 1.6) ball(sx + (bx - sx) * ease((u - 1.6) / 1.2), sy + (by - sy) * ease((u - 1.6) / 1.2) * .8, 0, BALLC[0], BALLD[0], 9);
    caos(450, 216, 2.4, { col: COLS[1] });
  } else if (role === 2) {
    const a = Math.sin(tm * 1.4) * .5; X.setLineDash([10, 8]); X.beginPath(); X.moveTo(sx, sy); X.lineTo(sx + Math.sin(a) * 130, sy - Math.cos(a) * 130); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke(); X.setLineDash([]);
    rr(110, 192, 300, 18, 9); ink('#fff7e6', 3); rr(260 + a * 150 - 14, 184, 28, 32, 9); ink(COLS[2], 3); demoFinger(260 + a * 150, 200, true, (tm % .6) / .6);
    badge('AIM THE LINE!', 400, 36, 16, '#2b9ee6', '#fff', 1, -.03);
  } else {
    dog(280, 100, .9, tm, tm % 4 < 1.6); leaf(220, 120, .4, .8);
    const w = tm % 4 < 1.6 ? 0 : 1; demoFinger(w === 0 ? 300 : 220, w === 0 ? 90 : 118, tm % .8 < .3, (tm % .8) * 2);
    badge('CLEAR THE WAY!', 400, 206, 16, '#2b9ee6', '#fff', 1, -.03); caos(450, 150, 2.4, { col: COLS[3] });
  }
}
reg('sq_bolas', sqBolas, 'BOLAS CRIOLLAS'); REGMAP.sq_bolas.duo = true; REGMAP.sq_bolas.squad = true;
DUO.INFO.sq_bolas = n => [
  ['MEASURER', 'SAY IF THE BALL FELL SHORT OR LONG', 'KEYS 1 / 2 OR CLICK'],
  ['THROWER', 'HOLD TO CHARGE THE POWER, LET GO TO THROW', 'SPACE / CLICK AND HOLD'],
  ['AIMER', 'POINT THE LINE AT THE BOLICHE', 'DRAG / KEYS A D'],
  ['SWEEPER', 'SHOO THE DOG AND SWEEP THE LEAF', 'CLICK THEM / KEYS 1 2'],
].slice(0, n);
DUO.DEMOS.sq_bolas = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
