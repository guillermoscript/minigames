'use strict';
/* ═════════ DUO · BATIDO DE MAMEY (du_batido): the corner juice stand, a mamey milkshake for a very impatient grandma ═════════
   COCTELERA (role 0, the SHAKER): holds the shaker cup and SHAKES IT. Phone: really shake it (devicemotion), or wave it side to side (the tilt gyro
   also sees that). Desktop / bots / no sensors: wave the mouse (or a finger) left-right FAST, or tap ◄ ► / A D alternately. The shaking energy is
   the pointer's back-and-forth speed. She only sees the cup (its colours, the lid on or off) and a plain energy tube: NO green zone, NO recipe.
   TAPA (role 1, JUDGE): HOLDS THE LID (hold the lid / space) while the friend shakes, lets go to add the next ingredient by tapping its plate (keys
   1 2 3 / Q W E) in the order of the recipe ticket that only HE sees, and sees the energy tube with the GREEN ZONE. Too soft (below the zone) does not
   mix, too hard (above) spills; shaking with the lid OFF spills too. So the friend has to talk: "harder", "stop", "ice now".
   WIN: every ingredient is in, in order, and mixed in the green zone, and the lid is opened in time (the pressure gauge must not run out).
   LOSE: wrong ingredient (bad order), too much spilled, the lid blows (not opened in time) or time runs out.
   Gag: the lid pops, the shake flies to the awning, rains down and grandma ends with a milkshake moustache. Fail gag: the chancla.
   Netcode: the SHAKER owns the energy and publishes 'e' [e*1000] (absolute, latest, re-sent every .5 s). The LID owns the glass and decides the
   verdict: it integrates mixing / spill / pressure from the last energy it received and publishes 'in' [added, lid, mix*1000, spill*1000, press*1000]
   (absolute, latest, re-sent every .5 s) so the shaker draws the same cup. Before a loss it sends 'why' ('d' spill / 'w' order / 'p' pressure / 't' time). */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixc = (a, b, k) => { const A = hx(a), B = hx(b); k = clamp(k, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

/* ───────────── tuning ───────────── */
const LO = .32, HI = .75, SPD = 2400;           // green zone of the energy (0..1); path speed (px/s) that counts as energy 1
const MIXR = .6, SPO = .4, SPH = 3.5, PRT = 2.4; // mix units per second inside the zone, spill/s with the lid off (x energy), spill/s over the zone, seconds before the lid blows
const NIN = 3;
const WOOD = '#c98f4e', WOODD = '#9a6a34', RED = '#e8434f', REDD = '#b8283a', CREAM = '#fff6e0', BLEND = '#f5b46a';
const ING = [{ col: '#f08a3c', dk: '#c0561f', n: 'MAMEY' }, { col: '#fff3df', dk: '#e2cfa8', n: 'MILK' }, { col: '#cfeeff', dk: '#8fc8e8', n: 'ICE' }];
const CUPB = 440;                               // counter top y
const PLX = [225, 405, 585], PLY = 525, PLW = 160, PLH = 84;   // ingredient plates (LID screen)
const LIDBOX = [250, 90, 550, 450];             // hold area for the lid (LID screen)
const KEYS = { Digit1: 0, KeyQ: 0, Digit2: 1, KeyW: 1, Digit3: 2, KeyE: 2 };

let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col, oc) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = oc || INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
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
function ln(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 1.3; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function chancla(x, y, s, rot) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  el(0, 0, 34, 13, 0); ink(RED, 3.5); glint(-12, -4, 12, 3, 0, .5);
  X.beginPath(); X.moveTo(-6, 0); X.lineTo(10, -9); X.moveTo(-6, 0); X.lineTo(10, 9); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#ffe14d'; X.stroke();
  X.restore();
}

/* ───────────── props ───────────── */
/* the grandma (feet at x, y; s = scale, about 15 s px tall). o: mood 'happy' | 'mad', mus (0..1 milkshake moustache), wait (taps her foot), splat (0..1 covered) */
function grandma(x, y, s, T, o) {
  o = o || {}; X.save(); X.translate(x, y); X.scale(s * (o.flip || 1), s);
  const tap = o.wait ? Math.max(0, Math.sin(T * 7)) * .9 : 0, hop = o.mood === 'happy' ? Math.abs(Math.sin(T * 9)) * .9 : 0; X.translate(0, -hop);
  for (const sd of [-1, 1]) { el(sd * 2, -.7 - (sd > 0 ? tap : 0), 1.9, .9); ink(RED, .5); }
  X.beginPath(); X.moveTo(-3.6, -7.5); X.lineTo(3.6, -7.5); X.lineTo(5.6, -1.2); X.lineTo(-5.6, -1.2); X.closePath(); ink('#b86bd6', .55);
  for (const [dx, dy] of [[-4, -3], [4.2, -2.6], [-2, -1.9], [3, -5.4]]) { X.fillStyle = '#ffe14d'; X.beginPath(); X.arc(dx, dy, .55, 0, TAU); X.fill(); }
  rr(-2.6, -7.2, 5.2, 5.8, 1); ink(CREAM, .45);
  const up = o.mood === 'happy' ? -3.2 + Math.sin(T * 12) * .8 : o.mood === 'mad' ? -3 : 0;
  ln([[-3.2, -7], [-5.2, -4.4 + (o.mood === 'mad' ? -3 : 0)], [-4.6, -2.2 + (o.mood === 'mad' ? -4 : 0)]], 1.5, '#f2c9a0');
  ln([[3.2, -7], [5.4, -5.4 + up], [5.2, -3.4 + up * 2]], 1.5, '#f2c9a0');
  el(0, -11, 3.7, 3.7); ink('#f2c9a0', .55);
  X.beginPath(); X.arc(0, -15.2, 1.9, 0, TAU); ink('#d9d9e3', .45);
  X.beginPath(); X.arc(0, -11.4, 3.7, Math.PI * 1.05, Math.PI * 1.95); ink('#d9d9e3', .3);
  X.strokeStyle = INK; X.lineWidth = .35; for (const sd of [-1, 1]) { X.beginPath(); X.arc(sd * 1.5, -10.8, 1.1, 0, TAU); X.stroke(); }
  X.fillStyle = INK; for (const sd of [-1, 1]) { X.beginPath(); X.arc(sd * 1.5, -10.8, .35, 0, TAU); X.fill(); }
  X.lineWidth = .4; X.beginPath(); if (o.mood === 'happy') X.arc(0, -9.1, 1.05, .1, Math.PI - .1); else if (o.mood === 'mad') X.arc(0, -8.3, 1, Math.PI + .2, -.2); else { X.moveTo(-.8, -8.7); X.lineTo(.8, -8.7); } X.stroke();
  if (o.mus > 0) { const k = outBack(o.mus); X.save(); X.translate(0, -9.3); X.scale(k, k); for (const sd of [-1, 1]) { el(sd * 1.4, 0, 1.7, .85, sd * -.25); ink('#fff7ea', .35); } X.restore(); }
  if (o.splat > 0) { X.fillStyle = BLEND; for (let i = 0; i < 6; i++) { X.beginPath(); X.arc((hsh(i) - .5) * 5, -11 + (hsh(i + 7) - .5) * 5, .5 + hsh(i + 3) * .7 * o.splat, 0, TAU); X.fill(); } }
  X.restore();
}
function parrot(x, y, s, T, mood) {                   // a scarlet macaw on its perch (x, y = perch)
  X.save(); X.translate(x, y); X.scale(s, s); const bob = Math.sin(T * 3.1) * 2, hd = mood === 'happy' ? Math.sin(T * 14) * 4 : Math.sin(T * 1.7) * 3;
  X.beginPath(); X.moveTo(-8, -4); X.quadraticCurveTo(-22, 20, -12, 44); X.lineTo(-2, 40); X.quadraticCurveTo(-2, 16, 2, -2); X.closePath(); ink('#3b8fd6', 3);
  el(2, -8 + bob * .3, 15, 22, .1); cel('#e8434f', '#b8283a', () => el(2, -8 + bob * .3, 15, 22, .1), 5, 0, 3.5);
  el(-2, -4, 7, 14, .3); ink('#3b8fd6', 2.5); el(2, -26 + bob + hd * .2, 11, 11); ink('#e8434f', 3); el(7, -28 + bob + hd * .2, 7, 5.5); ink('#fff6e0', 2);
  X.fillStyle = INK; X.beginPath(); X.arc(8, -28 + bob + hd * .2, 2.2, 0, TAU); X.fill();
  X.beginPath(); X.moveTo(11, -30 + bob); X.quadraticCurveTo(26, -26 + bob, 18, -17 + bob); X.quadraticCurveTo(14, -22 + bob, 11, -22 + bob); X.closePath(); ink('#ffd23f', 2.5);
  glint(-3, -24 + bob, 3, 5, -.5, .6);
  X.restore();
}
function ingIcon(k, x, y, s, T) {                     // 0 mamey, 1 milk, 2 ice
  X.save(); X.translate(x, y); X.scale(s, s);
  if (k === 0) {
    X.beginPath(); X.ellipse(0, 0, 24, 29, .25, 0, TAU); cel('#a8683a', '#7a4524', () => { X.beginPath(); X.ellipse(0, 0, 24, 29, .25, 0, TAU); }, 6, 5, 4);
    X.save(); X.beginPath(); X.ellipse(2, 4, 12, 15, .25, 0, TAU); ink('#ff9a4a', 2.5); X.restore();
    X.beginPath(); X.ellipse(2, 7, 4.5, 7, .25, 0, TAU); ink('#6b3a1e', 2); glint(-10, -12, 5, 9, .5, .5);
  } else if (k === 1) {
    rr(-16, -26, 32, 52, 5); cel('#fff', '#d6dde8', () => rr(-16, -26, 32, 52, 5), 6, 0, 4);
    X.beginPath(); X.moveTo(-16, -26); X.lineTo(0, -38); X.lineTo(16, -26); X.closePath(); ink('#3b8fd6', 3.5);
    rr(-11, -10, 22, 22, 4); ink('#4db8ff', 2.5); X.fillStyle = '#fff'; X.beginPath(); X.arc(0, 1, 5, 0, TAU); X.fill();
  } else {
    for (const [dx, dy, r] of [[-9, 8, -.2], [10, 10, .2], [1, -10, .1]]) { X.save(); X.translate(dx, dy); X.rotate(r); rr(-13, -13, 26, 26, 6); cel('#cfeeff', '#8fc8e8', () => rr(-13, -13, 26, 26, 6), 5, 4, 3.5); glint(-5, -6, 4, 6, .4, .7); X.restore(); }
  }
  X.restore();
}
function awning(h) {
  const n = 10, w = 800 / n;
  for (let i = 0; i < n; i++) {
    const c = i % 2 ? CREAM : RED, x = i * w;
    X.beginPath(); X.moveTo(x, -10); X.lineTo(x + w, -10); X.lineTo(x + w, h - 22); X.quadraticCurveTo(x + w, h + 12, x + w / 2, h + 12); X.quadraticCurveTo(x, h + 12, x, h - 22); X.closePath();
    cel(c, i % 2 ? '#e0d2ad' : REDD, () => { X.beginPath(); X.moveTo(x, -10); X.lineTo(x + w, -10); X.lineTo(x + w, h - 22); X.quadraticCurveTo(x + w, h + 12, x + w / 2, h + 12); X.quadraticCurveTo(x, h + 12, x, h - 22); X.closePath(); }, 7, 0, 3.5);
  }
}
function glassTube(x, y0, y1, w) { rr(x - w / 2, y0, w, y1 - y0, w / 2); }

/* ═════ the cup (both screens) ═════ */
function cupPath() { X.beginPath(); X.moveTo(-78, -216); X.lineTo(78, -216); X.lineTo(58, -14); X.quadraticCurveTo(54, 0, 38, 0); X.lineTo(-38, 0); X.quadraticCurveTo(-54, 0, -58, -14); X.closePath(); }
function cupDraw(cx, base, sc, o) {
  X.save(); X.translate(cx, base); X.rotate(o.tilt || 0); X.scale(sc, sc);
  el(0, 4, 74, 12); X.fillStyle = 'rgba(20,16,28,.28)'; X.fill();
  cupPath(); X.fillStyle = 'rgba(233,246,255,.62)'; X.fill();
  X.save(); cupPath(); X.clip();
  const lh = 48, nn = o.n, mf = o.mixF, sick = o.sick;
  for (let i = 0; i < nn; i++) {
    const k = o.rec[i], col = sick ? mixc('#8f9a4e', '#6b7a3a', i / 3) : mixc(ING[k].col, BLEND, mf), y0 = -i * lh - 2;
    X.fillStyle = col;
    if (i === nn - 1) {                              // the top layer has a sloshing surface
      const amp = o.slosh * 15; X.beginPath(); X.moveTo(-90, y0 + 4);
      for (let x = -90; x <= 90; x += 10) X.lineTo(x, y0 - lh + Math.sin(o.T * 11 + x * .07) * amp + Math.sin(o.T * 7.3 - x * .11) * amp * .5);
      X.lineTo(90, y0 + 4); X.closePath(); X.fill();
      X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 3; X.beginPath(); for (let x = -80; x <= 80; x += 10) { const yy = y0 - lh + Math.sin(o.T * 11 + x * .07) * amp + Math.sin(o.T * 7.3 - x * .11) * amp * .5 + 2; x === -80 ? X.moveTo(x, yy) : X.lineTo(x, yy); } X.stroke();
    } else X.fillRect(-90, y0 - lh, 180, lh + 4);
    if (k === 2 && !sick) for (let c = 0; c < 4; c++) { X.save(); X.translate(-44 + c * 30 + Math.sin(o.T * 9 + c) * o.slosh * 5, y0 - 16 - (c % 2) * 8); X.rotate(.3 * c - .4); rr(-10, -10, 20, 20, 5); ink('rgba(207,238,255,.85)', 2, '#8fc8e8'); X.restore(); }
  }
  if (nn > 0 && mf > .15 && !sick) { X.strokeStyle = 'rgba(255,255,255,.35)'; X.lineWidth = 4; for (let s = 0; s < 3; s++) { X.beginPath(); X.ellipse(0, -nn * lh * .5, 30 + s * 12, 8 + s * 3, o.T * (2 + o.slosh * 4) + s, 0, Math.PI * 1.3); X.stroke(); } }
  X.restore();
  cupPath(); X.lineWidth = 8; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke();
  glint(-52, -150, 5, 38, .1, .55);
  X.strokeStyle = 'rgba(20,16,28,.4)'; X.lineWidth = 3; for (let q = 1; q < 4; q++) { X.beginPath(); X.moveTo(58 - q * 3, -q * lh); X.lineTo(44 - q * 3, -q * lh); X.stroke(); }
  // the lid: ly = 0 sits on the cup; negative = floating above it
  if (o.lid !== null) {
    const ly = -216 + o.lid;
    X.beginPath(); X.moveTo(-68, ly - 6); X.quadraticCurveTo(-68, ly - 56, 0, ly - 56); X.quadraticCurveTo(68, ly - 56, 68, ly - 6); X.closePath(); cel(RED, REDD, () => { X.beginPath(); X.moveTo(-68, ly - 6); X.quadraticCurveTo(-68, ly - 56, 0, ly - 56); X.quadraticCurveTo(68, ly - 56, 68, ly - 6); X.closePath(); }, 12, 6, 4);
    rr(-86, ly - 10, 172, 24, 10); cel('#ff6b6b', REDD, () => rr(-86, ly - 10, 172, 24, 10), 4, 5, 4);
    rr(-8, ly - 66, 16, 14, 5); ink('#ffd23f', 3); glint(-34, ly - 38, 6, 12, .6, .6);
    if (o.press > .05) { for (let k = 0; k < 3; k++) { const q = (o.T * 1.6 + k / 3) % 1; X.globalAlpha = (1 - q) * Math.min(1, o.press * 2); X.beginPath(); X.arc(-30 + k * 30 + Math.sin(o.T * 6 + k) * 4, ly - 70 - q * 40, 7 + q * 9, 0, TAU); ink('rgba(255,255,255,.92)', 1.5, 'rgba(255,255,255,.55)'); X.globalAlpha = 1; } }
  }
  X.restore();
}


/* ═════════ the game ═════════ */
function duBatido(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), shk = D.role === 0, TS = Math.sqrt(sp);
  const rec = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const tmp = rec[i]; rec[i] = rec[j]; rec[j] = tmp; }   // the recipe: a shuffled order of the three ingredients
  const CX = 400, TOPY = shk ? 190 : 230;
  const pops = [], spl = [], conf = [];
  let resAt = -1, why = '', popA = -9;
  // shaker (A)
  let e = 0, lx = null, dir = 0, rev = -9, acc = 0, mSpd = 0, mT = -9, pxv = 400, eSent = -9, lastQ = -1, askedMotion = false, jit = 0;
  let rin = { n: 0, lid: 0, m: 0, sp: 0, pr: 0 };
  // lid (B)
  let rE = 0, rT = -9, hasMsg = false, held = false, n = 0, m = 0, spill = 0, press = 0, iSent = -9, lastK = '', lk = 0, eV = 0, hoverK = 0, tapK = [0, 0, 0], kSp = false;
  const pop = (s, px, py, size, bgc, fg) => { pops.push({ s, x: px, y: py, size, bgc, fg, t0: g.c, rot: (hsh(g.c * 9) - .5) * .14 }); if (pops.length > 3) pops.shift(); };
  const ready = () => n >= NIN && m >= NIN - .004;
  const sendIn = force => {
    const T = g.c, k = [n, held ? 1 : 0, Math.round(m * 50), Math.round(spill * 50), Math.round(press * 50)].join();
    if (force || (k !== lastK && T - iSent >= .1) || T - iSent >= .5) { lastK = k; iSent = T; D.send('in', [n, held ? 1 : 0, Math.round(m * 1000), Math.round(spill * 1000), Math.round(press * 1000)], true); }
  };
  const lose = w => { if (g.result) return; why = w; D.send('why', w); sfx.splat(); shake(9, .3); g.finish('lose'); };

  function stroke(dx) {                                // the shaker: one move of the pointer; only fast back-and-forth counts as shaking
    const a = Math.abs(dx), s = a < 2 ? 0 : dx > 0 ? 1 : -1;
    if (s && dir && s !== dir) rev = g.c;
    if (s) dir = s;
    if (g.c - rev < .6) acc += a;
  }
  function onMotion(ev) {
    if (!ev || g.result && g.c > 20) return;
    const a = ev.acceleration && ev.acceleration.x != null ? ev.acceleration : null, b = ev.accelerationIncludingGravity;
    const mag = a ? Math.hypot(a.x || 0, a.y || 0, a.z || 0) : b ? Math.abs(Math.hypot(b.x || 0, b.y || 0, b.z || 0) - 9.81) : 0;
    mSpd = clamp(mag / 16, 0, 1.3) * SPD; mT = g.c;
  }
  if (shk) { try { if (typeof addEventListener === 'function') addEventListener('devicemotion', onMotion); } catch (_) {} }
  const askMotion = () => { if (askedMotion) return; askedMotion = true; try { if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { const p = DeviceMotionEvent.requestPermission(); if (p && p.catch) p.catch(() => {}); } } catch (_) {} };

  function tap(i) {                                    // the lid player taps an ingredient plate
    if (g.result || shk) return;
    if (held) { if (g.c - popA > .8) { popA = g.c; pop('LID IS ON!', 400, 150, 22, '#7e5bd6', '#fff'); } return; }
    if (n >= NIN) return;
    tapK[i] = g.c;
    if (rec[n] !== i) { sfx.buzz && sfx.buzz(); lose('w'); return; }
    n++; sfx.pop && sfx.pop(); sendIn(true);
    for (let k = 0; k < 8; k++) spl.push({ x: CX + (hsh(k + n * 3) - .5) * 60, y: 170, vx: (hsh(k + 5) - .5) * 60, vy: 60, t0: g.c, life: .6, col: ING[i].col, r: 4 });
  }

  const g = {
    c: 0, dur: 15, pts: 0, gyro: shk,
    cmd: shk ? 'SHAKE NOW!' : 'THE LID!', roleLabel: shk ? 'SHAKER' : 'LID',
    hint: shk ? 'SHAKE THE CUP: WAVE THE MOUSE LEFT-RIGHT FAST (OR TAP ◄ ► / A D). NOT TOO SOFT, NOT TOO HARD! YOU CANNOT SEE THE RECIPE - LISTEN TO YOUR FRIEND: "HARDER", "STOP"!' : 'HOLD THE LID (CLICK OR SPACE) WHILE YOUR FRIEND SHAKES - LET GO TO TAP THE NEXT INGREDIENT (1 2 3 / Q W E) IN RECIPE ORDER. SHOUT "HARDER" OR "STOP" TO KEEP THE TUBE GREEN!',
    thint: shk ? 'SHAKE YOUR PHONE TO MIX THE SHAKE. YOU CANNOT SEE THE RECIPE - LISTEN TO YOUR FRIEND: "HARDER", "STOP"!' : 'HOLD THE LID WHILE YOUR FRIEND SHAKES, LET GO TO TAP THE NEXT INGREDIENT IN ORDER. SHOUT "HARDER" OR "STOP"!',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) {
        resAt = T;
        if (g.result === 'win') {
          for (let i = 0; i < 40; i++) conf.push({ x: hsh(i) * 800, y: -20 - hsh(i + 3) * 300, vy: 90 + hsh(i + 9) * 150, ph: hsh(i + 17) * 6, c: ['#FFE14D', '#ff4d6d', '#4db8ff', '#5CFF7A', '#ff9f43'][i % 5] });
          for (let i = 0; i < 46; i++) spl.push({ x: CX + (hsh(i) - .5) * 40, y: TOPY, vx: -60 + hsh(i + 1) * 380, vy: -(560 + hsh(i + 2) * 420), t0: T + .05, life: 2.6, col: i % 3 ? BLEND : '#fff3df', r: 4 + hsh(i + 4) * 5 });
          sfx.sparkle && sfx.sparkle();
        } else if (why === 'p' || why === 'd') {
          for (let i = 0; i < 30; i++) spl.push({ x: CX + (hsh(i) - .5) * 80, y: TOPY + 10, vx: (hsh(i + 1) - .5) * 600, vy: -(100 + hsh(i + 2) * 420), t0: T, life: 1.6, col: i % 3 ? BLEND : '#fff3df', r: 3 + hsh(i + 4) * 5 });
        } else sfx.miss();
      }
      for (let i = spl.length - 1; i >= 0; i--) { const b = spl[i]; if (T < b.t0) continue; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) spl.splice(i, 1); }
      for (const c of conf) { c.y += c.vy * dt; if (c.y > 620) c.y = -20; }
      if (pops.length && T - pops[0].t0 > 1.1) pops.shift();
      const done = !!g.result;
      lk += ((held ? 0 : 1) - lk) * Math.min(1, dt * 14);
      for (let i = 0; i < 3; i++) if (T - tapK[i] > .25) tapK[i] = 0;
      if (shk) {
        const spd = acc / Math.max(dt, 1 / 120); acc = 0;
        const ms = T - mT < .25 ? mSpd : 0, tg = done ? 0 : clamp(Math.max(spd, ms) / SPD, 0, 1.3);
        e += (tg - e) * Math.min(1, dt * (tg > e ? 4.5 : 3.5)); jit = e;
        const q = Math.round(e * 1000);
        if ((Math.abs(q - lastQ) >= 25 && T - eSent >= .08) || T - eSent >= .5) { lastQ = q; eSent = T; D.send('e', [q], true); }
      } else if (!done) {
        const E = hasMsg && T - rT < 1.4 ? rE : 0; eV += (E - eV) * Math.min(1, dt * 12);
        if (held) {
          if (E >= LO && E <= HI && m < n) m = Math.min(n, m + MIXR * TS * dt);
          if (E > HI) spill += (E - HI) * SPH * dt;
        } else if (E > .12) spill += E * SPO * dt;
        if (ready() && held) press += dt * TS / PRT; else press = Math.max(0, press - dt * .6);
        if (spill >= 1) lose('d');
        else if (press >= 1) lose('p');
        else if (T >= g.limit) lose('t');
        else sendIn(false);
      }
    },
    msg(type, d) {
      if (shk) {
        if (type === 'why' && typeof d === 'string') why = d;
        else if (type === 'in' && Array.isArray(d)) rin = { n: d[0], lid: d[1], m: d[2] / 1000, sp: d[3] / 1000, pr: d[4] / 1000 };
        return;
      }
      if (type === 'e' && Array.isArray(d) && !g.result) { rE = clamp(d[0] / 1000, 0, 1.3); rT = g.c; hasMsg = true; }
    },
    down(p) {
      if (g.result) return;
      if (shk) { askMotion(); if (lx !== null) stroke(p.x - lx); lx = p.x; pxv = p.x; return; }
      const x = p.x, y = p.y;
      for (let i = 0; i < 3; i++) if (Math.abs(x - PLX[i]) <= PLW / 2 && y >= PLY - PLH / 2 - 6 && y <= PLY + PLH / 2 + 8) { tap(i); return; }
      if (x >= LIDBOX[0] && x <= LIDBOX[2] && y >= LIDBOX[1] && y <= LIDBOX[3] && !held && n > 0) { held = true; sendIn(true); }
      else if (x >= LIDBOX[0] && x <= LIDBOX[2] && y >= LIDBOX[1] && y <= LIDBOX[3] && n === 0 && g.c - popA > .8) { popA = g.c; pop('ADD SOMETHING FIRST!', 400, 150, 20, '#7e5bd6', '#fff'); }
    },
    move(p) { if (g.result) return; if (shk) { if (lx !== null) stroke(p.x - lx); lx = p.x; pxv = p.x; } },
    up() {
      if (g.result) return;
      if (!shk && held) { held = false; sendIn(true); if (ready()) { sfx.coin && sfx.coin(); g.finish('win'); } }
    },
    key(ev) {
      const c = ev.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape' || g.result) return;
      if (shk) {
        const dd = (c === 'ArrowLeft' || c === 'KeyA') ? -1 : (c === 'ArrowRight' || c === 'KeyD') ? 1 : 0;
        if (dd) { if (dir && dd !== dir) { rev = g.c; acc += 330; } else acc += 40; dir = dd; pxv = 400 + dd * 60; }
      } else if (c === 'Space' || c === 'ArrowDown' || c === 'KeyS') { if (!kSp) { kSp = true; g.down({ x: 400, y: 300 }); } }
      else if (c in KEYS) tap(KEYS[c]);
    },
    keyup(ev) { const c = ev.code; if (!shk && (c === 'Space' || c === 'ArrowDown' || c === 'KeyS') && kSp) { kSp = false; g.up(); } },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = bakeBg();
      ctx.drawImage(BG, 0, 0);
      drawStand(T, won, lost, rk);
      if (shk) drawShaker(T, won, lost, rk); else drawLid(T, won, lost, rk);
      drawEnd(T, won, lost, rk);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .85 ? Math.max(0, 1 - (a - .85) / .25) : 1; badge(q.s, clamp(q.x, 150, 650), Math.max(120, q.y - Math.min(a, .6) * 18), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.2) badge(shk ? 'SHAKE IT!' : 'FOLLOW THE TICKET!', 400, shk ? 62 : 62, 20, shk ? '#2b9ee6' : '#c98a12', '#fff', outBack(T / .3), -.03);
      vignette(.18);
    },
  };

  /* ═════ the stand (shared) ═════ */
  let BG = null;
  function bakeBg() {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const old = X; X = c.getContext('2d');
    const wg = X.createLinearGradient(0, 0, 0, CUPB); wg.addColorStop(0, '#ffeec4'); wg.addColorStop(1, '#ffd48a'); X.fillStyle = wg; X.fillRect(0, 0, W, CUPB + 4);
    X.fillStyle = 'rgba(200,120,70,.14)'; for (let x = 0; x < 800; x += 56) X.fillRect(x, 0, 24, CUPB);
    X.fillStyle = '#3b8fd6'; X.fillRect(0, 360, 800, 40); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(0, 364, 800, 6);
    X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 400); X.lineTo(800, 400); X.stroke();
    // shelf with jars of fruit behind the cup
    rr(250, 226, 300, 14, 5); ink(WOODD, 3);
    for (const [px, ph, col, fr] of [[290, 56, '#ffd23f', '#f2a81c'], [350, 62, '#7bd35a', '#3fa64a'], [450, 58, '#ff9f43', '#d96a1a'], [510, 54, '#e8434f', '#b8283a']]) {
      rr(px - 22, 226 - ph, 44, ph, 9); X.fillStyle = 'rgba(233,246,255,.7)'; X.fill(); ink(null, 3); X.save(); rr(px - 22, 226 - ph, 44, ph, 9); X.clip(); X.fillStyle = col; X.fillRect(px - 24, 226 - ph * .55, 48, ph); X.fillStyle = fr; X.beginPath(); X.arc(px - 6, 226 - 12, 8, 0, TAU); X.arc(px + 8, 226 - 16, 8, 0, TAU); X.fill(); X.restore(); glint(px - 12, 226 - ph * .7, 3, ph * .25, .1, .6);
    }
    // counter
    X.beginPath(); X.rect(0, CUPB, W, H - CUPB); X.fillStyle = INK; X.fill();
    const cg = X.createLinearGradient(0, CUPB + 6, 0, H); cg.addColorStop(0, '#d9a362'); cg.addColorStop(1, '#b57a3e'); X.fillStyle = cg; X.fillRect(0, CUPB + 8, W, H - CUPB - 8);
    X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(0, CUPB + 8, W, 8); X.fillStyle = 'rgba(20,16,28,.28)'; for (let x = 100; x < W; x += 140) X.fillRect(x, CUPB + 16, 4, H);
    X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(0, CUPB + 16, W, 6);
    awning(96);
    // the sign hanging from the awning is drawn live (text); its strings are baked
    X.strokeStyle = INK; X.lineWidth = 3; for (const sx of [624, 740]) { X.beginPath(); X.moveTo(sx, 100); X.lineTo(sx, 118); X.stroke(); }
    X = old; return c;
  }
  function drawStand(T, won, lost, rk) {
    // swinging bananas under the awning (left) and the parrot on its perch (right)
    X.save(); X.translate(60, 100); X.rotate(Math.sin(T * 1.8) * .09);
    line([[0, 0], [0, 26]], 3, '#5a8f3a');
    for (let k = 0; k < 4; k++) { X.save(); X.translate(0, 24); X.rotate(-.5 + k * .33); X.beginPath(); X.moveTo(-5, 0); X.quadraticCurveTo(-14, 28, 2, 52); X.quadraticCurveTo(10, 30, 5, 0); X.closePath(); ink('#ffd23f', 3); X.restore(); }
    X.restore();
    rr(608, 118, 148, 42, 8); cel('#d9944f', '#a5622c', () => rr(608, 118, 148, 42, 8), 4, 5, 4); X.save(); X.translate(0, 0); X.restore(); txt('BATIDOS', 682, 139, 26, CREAM, 'center', 130);
    if (shk) { line([[690, 190], [770, 190]], 7, WOODD); parrot(730, 188, .9, T, won ? 'happy' : null); }
  }

  /* ═════ shaker (A) screen ═════ */
  function drawShaker(T, won, lost, rk) {
    const pc = (D.partner && D.partner.color) || '#6EA8FE', me1 = myCol(), done = !!g.result;
    const live = !done, sh = live ? Math.sin(T * 38) * e * 7 : 0, offx = live ? clamp((pxv - 400) * .32, -130, 130) + sh : 0;
    const open = !rin.lid, mixF = rin.n ? clamp(rin.m / rin.n, 0, 1) : 0;
    const base = 404;
    // my friend, in a frame on the wall
    rr(40, 118, 90, 90, 10); ink(CREAM, 4); X.save(); rr(46, 124, 78, 78, 7); X.clip(); X.fillStyle = '#7ec8e3'; X.fillRect(40, 118, 90, 90); caos(85, 204, 2.8, { col: pc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (T < 3.5 && !done) pill(85, 232, 'YOUR FRIEND', pc);
    // the energy tube (plain: no zones) on the left
    const gx = 175, g0 = 150, g1 = 400;
    glassTube(gx, g0, g1, 40); X.fillStyle = 'rgba(233,246,255,.8)'; X.fill(); ink(null, 4);
    X.save(); glassTube(gx, g0, g1, 40); X.clip(); const ey = g1 - clamp(e, 0, 1) * (g1 - g0); X.fillStyle = '#ffd23f'; X.fillRect(gx - 24, ey, 48, g1 - ey); X.fillStyle = '#fff3a0'; X.fillRect(gx - 24, ey, 48, 4); X.restore();
    X.strokeStyle = INK; X.lineWidth = 3; for (let q = 0; q <= 8; q++) { X.beginPath(); X.moveTo(gx + 20, g1 - q / 8 * (g1 - g0)); X.lineTo(gx + (q % 2 ? 28 : 36), g1 - q / 8 * (g1 - g0)); X.stroke(); }
    glint(gx - 8, g0 + 60, 3, 36, .05, .6);
    X.beginPath(); X.arc(gx, g1 + 14, 24, 0, TAU); ink('#ffd23f', 4); glint(gx - 7, g1 + 8, 6, 4, -.5, .6);
    txt('ENERGY', gx, g0 - 22, 18, '#fff', 'center', 110);
    // the cup, shaken by my caos
    const wob = live ? Math.sin(T * 38 + 1) * e * .06 : 0, cxp = CX + offx;
    cupDraw(cxp, base, 1.15, { n: (won || (lost && why === 'p')) && rk > .25 ? 0 : rin.n, rec, mixF, slosh: e, T, lid: done && won ? -(30 + rk * 1000) : done && lost && rk > .1 && (why === 'p' || why === 'd') ? -(60 + rk * 900) : rin.lid ? 0 : -(66 + Math.sin(T * 3) * 4), press: rin.pr, tilt: wob + (offx / 130) * .08, sick: lost && why === 'w' });
    if (rin.lid && !done) { /* lid on: nothing else */ }
    // spill drips off the cup when the friend's glass is leaking
    if (!done && rin.sp > .03 && rin.sp > 0) for (let k = 0; k < 3; k++) { const q = (T * 2 + k / 3) % 1; X.beginPath(); X.ellipse(cxp + (k - 1) * 60, base - 200 + q * 190, 4, 6 + q * 4, 0, 0, TAU); ink(BLEND, 1.5); }
    // caos below holds the cup with both rubber arms
    const hop = won && rk >= 0 ? Math.abs(Math.sin(rk * 9)) * 18 : 0;
    X.save(); X.translate(400, 598 - hop);
    if (!won) { line([[-26, -44], [-86, -120], [cxp - 400 - 74 * 1.15, base - 598 - 100 * 1.15 + hop]], 18, me1); line([[26, -44], [86, -120], [cxp - 400 + 74 * 1.15, base - 598 - 100 * 1.15 + hop]], 18, me1); }
    else { X.fillStyle = me1; }
    X.restore();
    X.save(); X.translate(400, 598 - hop); caos(0, 0, 5, { col: me1, mood: won ? 'happy' : (lost || e > HI + .1) ? 'sad' : null }); X.restore();
    if (T < 3.5 && !done) pill(400, 504, 'YOU', me1);
    grandma(712, 598, 5.4, T, { wait: !done, mood: won ? 'happy' : lost ? 'mad' : null, mus: won ? clamp((rk - .9) / .3, 0, 1) : 0, splat: lost && why === 'p' ? 1 : 0 });
    if (T < 3 && !done) DUO.demoFinger(400 + Math.sin(T * 9) * 90, 330, true, (T * 2) % 1);
  }

  /* ═════ lid (B) screen ═════ */
  function drawLid(T, won, lost, rk) {
    const pc = (D.partner && D.partner.color) || '#6EA8FE', me1 = myCol(), done = !!g.result;
    const rt = done ? 0 : eV, ox = Math.sin(T * 47) * rt * 5;
    // the recipe ticket on the wall (only I see it)
    X.save(); X.translate(125, 142); X.rotate(-.03);
    rr(-95, -22, 190, 252, 8); cel(CREAM, '#e6d8b4', () => rr(-95, -22, 190, 252, 8), 5, 0, 4);
    X.beginPath(); X.moveTo(-95, 230); for (let q = 0; q < 8; q++) { X.lineTo(-95 + q * 24 + 12, 240); X.lineTo(-95 + (q + 1) * 24, 230); } X.fillStyle = CREAM; X.fill();
    rr(-26, -34, 52, 20, 5); ink('rgba(255,224,130,.9)', 2.5, '#c9a233');
    txt('RECIPE', 0, -4, 22, RED, 'center', 140);
    for (let i = 0; i < NIN; i++) {
      const ry = 50 + i * 68, k = rec[i], cur = i === n && !done, dn = i < n, pr = dn ? clamp(m - i, 0, 1) : 0;
      if (cur) { rr(-88, ry - 31, 176, 62, 10); ink('rgba(255,226,120,.55)', 2.5, '#e0b020'); }
      X.beginPath(); X.arc(-62, ry, 14, 0, TAU); ink('#fff', 3); txt(String(i + 1), -62, ry + 1, 18, INK);
      ingIcon(k, -14, ry, .75 + (cur ? Math.sin(T * 8) * .04 : 0), T);
      txt(ING[k].n, 46, ry - 4, 15, INK, 'center', 62);
      X.beginPath(); X.arc(66, ry + 16, 11, 0, TAU); ink('#fff', 2.5);
      if (dn) { X.fillStyle = BLEND; X.beginPath(); X.moveTo(66, ry + 16); X.arc(66, ry + 16, 10, -Math.PI / 2, -Math.PI / 2 + TAU * pr); X.closePath(); X.fill(); if (pr >= .995) { line([[60, ry + 16], [65, ry + 21], [73, ry + 10]], 3, '#2fa84a'); } }
    }
    X.restore();
    // energy tube with the GREEN ZONE
    const gx = 640, g0 = 200, g1 = 430, yAt = v => g1 - v * (g1 - g0);
    glassTube(gx, g0, g1, 44); X.fillStyle = '#fff'; X.fill(); X.save(); glassTube(gx, g0, g1, 44); X.clip();
    X.fillStyle = '#9fb7d6'; X.fillRect(gx - 26, yAt(LO), 52, g1 - yAt(LO)); X.fillStyle = '#5CFF7A'; X.fillRect(gx - 26, yAt(HI), 52, yAt(LO) - yAt(HI)); X.fillStyle = '#ff4d5e'; X.fillRect(gx - 26, g0 - 4, 52, yAt(HI) - g0 + 4);
    X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(gx - 26, yAt(clamp(rt, 0, 1)), 52, g1 - yAt(clamp(rt, 0, 1))); X.restore();
    ink(null, 4); glassTube(gx, g0, g1, 44); X.lineWidth = 8; X.strokeStyle = INK; X.stroke();
    { const yy = yAt(clamp(rt, 0, 1)); X.beginPath(); X.moveTo(gx - 30, yy); X.lineTo(gx + 30, yy); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.beginPath(); X.moveTo(gx - 34, yy - 10); X.lineTo(gx - 24, yy); X.lineTo(gx - 34, yy + 10); X.closePath(); ink('#ffd23f', 2.5); }
    glint(gx - 12, g0 + 40, 3, 30, .05, .5);
    txt('ENERGY', gx, g0 - 20, 18, '#fff', 'center', 110);
    X.font = '700 13px Fredoka, Arial, sans-serif';
    txt('WEAK', gx - 34, yAt(LO / 2), 14, '#fff', 'right', 60); txt('GOOD', gx - 34, yAt((LO + HI) / 2), 14, '#5CFF7A', 'right', 60); txt('TOO MUCH', gx - 34, yAt((HI + 1) / 2), 14, '#ff8a96', 'right', 70);
    // the cup with its lid, rattled by the friend's shaking
    const mixF = n ? clamp(m / n, 0, 1) : 0, lidOff = -(88 + Math.sin(T * 3) * 4);
    cupDraw(CX + ox, CUPB - 2, 1, { n: (won || (lost && why === 'p')) && rk > .25 ? 0 : n, rec, mixF, slosh: rt, T, lid: done && won ? -(30 + Math.max(0, rk) * 1000) : done && lost && rk > .1 && (why === 'p' || why === 'd') ? -(60 + rk * 900) : lerp(lidOff, 0, 1 - lk), press, tilt: ox * .004, sick: lost && why === 'w' });
    // pressure gauge on the lid
    if (press > .02 && !done) { const px = CX + 112, py = 220; X.beginPath(); X.arc(px, py, 22, 0, TAU); ink('#fff', 3.5); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); const a = -Math.PI * .85 + press * Math.PI * 1.7; X.moveTo(px, py); X.lineTo(px + Math.cos(a) * 16, py + Math.sin(a) * 16); X.stroke(); X.fillStyle = RED; X.beginPath(); X.arc(px, py, 3.5, 0, TAU); X.fill(); if (press > .5) badge('OPEN THE LID!', 400, 70 + Math.sin(T * 20) * 2, 22, RED, '#fff', 1, 0); }
    // spill puddle on the counter, grows with what I have spilled
    if (spill > .02 || (lost && (why === 'd' || why === 'p'))) { const sv = lost && why === 'd' ? 1 : spill, w = 24 + sv * 150; el(CX + 20, CUPB + 14, w, 5 + sv * 11); ink(BLEND, 3); glint(CX + 6 - w * .3, CUPB + 11, w * .25, 3, 0, .55); }
    // my caos with an arm up on the lid
    const hop = won && rk >= 0 ? Math.abs(Math.sin(rk * 9)) * 18 : 0;
    X.save(); X.translate(78, 598 - hop);
    const armX = 70, armY = held ? -260 : -140;
    if (!won) line([[26, -44], [50, -60 + (held ? -60 : -20)], [armX, armY + 10]], 16, me1);
    caos(0, 0, 4.2, { col: me1, mood: won ? 'happy' : (lost || (rE > HI && held)) ? 'sad' : null }); X.restore();
    if (T < 3.5 && !done) pill(78, 504, 'YOU', me1);
    // friend portrait
    rr(690, 440, 90, 90, 10); ink(CREAM, 4); X.save(); rr(696, 446, 78, 78, 7); X.clip(); X.fillStyle = '#7ec8e3'; X.fillRect(690, 440, 90, 90); caos(735, 526, 2.8, { col: pc, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (T < 3.5 && !done) pill(735, 420, 'YOUR FRIEND', pc);
    // the ingredient plates
    for (let i = 0; i < 3; i++) {
      const x = PLX[i], k = (T - tapK[i]) < .25 && tapK[i] ? 1 : 0, dy = k * 5, locked = held || done;
      rr(x - PLW / 2, PLY - PLH / 2 + dy, PLW, PLH, 16); cel(locked ? '#d3cfe0' : '#e8b866', locked ? '#8f88a6' : '#b88a4c', () => rr(x - PLW / 2, PLY - PLH / 2 + dy, PLW, PLH, 16), 0, 7, 4);
      X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - PLW / 2 + 10, PLY - PLH / 2 + dy + 6, PLW - 20, 9, 4); X.fill();
      ingIcon(i, x - 38, PLY - 2 + dy, .78, T);
      txt(ING[i].n, x + 24, PLY - 8 + dy, 17, INK, 'center', 78);
      rr(x + 8, PLY + 12 + dy, 32, 22, 6); ink('#fff', 2.5); txt(String(i + 1), x + 24, PLY + 24 + dy, 16, INK);
    }
    if (!done && !held && n < NIN && T > 3) { const a = Math.sin(T * 6) * .5 + .5; X.globalAlpha = .3 + a * .4; rr(PLX[rec[n]] - PLW / 2 - 5, PLY - PLH / 2 - 5, PLW + 10, PLH + 10, 20); X.lineWidth = 5; X.strokeStyle = '#ffe14d'; X.stroke(); X.globalAlpha = 1; }
    if (!done && T < 3) DUO.demoFinger(400, 300 + Math.sin(T * 4) * 4, true, (T * 2) % 1);
    // grandma tapping her foot
    grandma(742, 440, 6, T, { wait: !done, mood: won ? 'happy' : lost ? 'mad' : null, mus: won ? clamp((rk - .9) / .3, 0, 1) : 0, splat: lost && why === 'p' ? 1 : 0 });
    if (!done && held) txt('HOLDING', 400, 462, 16, '#fff');
  }

  /* ═════ endings ═════ */
  function drawEnd(T, won, lost, rk) {
    if (rk < 0) return;
    for (const b of spl) { if (T < b.t0) continue; const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); X.beginPath(); X.arc(b.x, b.y, b.r || 3, 0, TAU); ink(b.col, 1.5); X.globalAlpha = 1; }
    if (won) {
      // the shake rushes up to the awning and drips there
      const col = clamp((rk - .0) / .3, 0, 1); if (rk < .45) { const topY = lerp(TOPY, 40, ease(col)); X.beginPath(); rr(CX - 26, topY, 52, TOPY - topY + 6, 20); ink(BLEND, 3); }
      for (let i = 0; i < 6; i++) { const sx = 130 + i * 110 + hsh(i) * 30, k = clamp((rk - .35 - i * .04) / .3, 0, 1); if (k > 0) { el(sx, 80, 26 * k, 14 * k); ink('#fff3df', 3); line([[sx, 84], [sx, 84 + 30 * k + Math.max(0, rk - .8) * 20]], 7, BLEND); } }
      for (const c of conf) { X.save(); X.translate(c.x + Math.sin(T * 3 + c.ph) * 12, c.y); X.rotate(T * 4 + c.ph); X.fillStyle = c.c; X.fillRect(-5, -3, 10, 6); X.restore(); }
      if (rk > 1.0) for (let i = 0; i < 3; i++) { const q = (rk * 1.1 + i / 3) % 1; X.globalAlpha = 1 - q; X.save(); X.translate(700 + i * 22, 340 - q * 60); X.scale(.9, .9); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); ink('#ff5c8a', 3); X.restore(); X.globalAlpha = 1; }
      badge('BATIDAZO!', 400, 200, 54, '#c0561f', '#fff', outBack(rk / .28) * (rk > 2.4 ? Math.max(0, 1 - (rk - 2.4) * 2) : 1), -.06);
      if (rk > .9) badge('MILKSHAKE MOUSTACHE!', 400, 272, 28, '#2fa84a', '#fff', outBack((rk - .9) / .22), .05);
    }
    if (lost) {
      const k = clamp((rk - .25) / .55, 0, 1), cxp = lerp(740, 330, k), cyp = lerp(380, 520, k) - Math.sin(k * Math.PI) * 120;
      if (rk > .25 && rk < .8) chancla(cxp, cyp, 1.2, -rk * 14); else if (rk >= .8) { chancla(330, 540 + Math.min(1, (rk - .8) * 3) * 10, 1.1, -.25); star(CX - 70, 480, 46 * Math.min(1, (rk - .8) * 6), 20, 9, rk * 2, '#ffe14d', 4); }
      const txtMain = why === 'd' ? 'SHAKE SPILLED!' : why === 'w' ? 'WRONG ORDER!' : why === 'p' ? 'LID BLEW OFF!' : 'SHAKE TOO LATE!';
      badge(txtMain, 400, 200, 48, RED, '#fff', outBack(rk / .22), -.05);
      if (rk > .8) badge(why === 'w' ? 'YUCK!' : 'CHANCLAZO!', 400, 272, 32, '#7e5bd6', '#fff', outBack((rk - .8) / .22), .04);
    }
  }

  g.dbg = {
    LO, HI, TS, NIN,
    /* what each screen shows. SHAKER: its own shaking energy and whether the lid is on (the cup). LID: the recipe ticket, the glass state, the energy tube. */
    view: () => shk
      ? { role: 0, e, lid: !!rin.lid, n: rin.n, press: rin.pr }
      : { role: 1, recipe: rec.slice(), n, m, lid: held, ready: ready(), e: rE, spill, press, plates: PLX.map(x => ({ x, y: PLY })), lidPos: { x: 400, y: 300 }, LO, HI },
    truth: () => ({ e, n, m, spill, press, rE, why, rec }),
  };
  wire(g, D, 1, sp, 'du_batido');
  return g;
}
reg('du_batido', duBatido, 'BATIDO DE MAMEY'); REGMAP.du_batido.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  const wg = X.createLinearGradient(0, 0, 0, 240); wg.addColorStop(0, '#ffeec4'); wg.addColorStop(1, '#ffd48a'); X.fillStyle = wg; X.fillRect(0, 0, 520, 240);
  X.fillStyle = INK; X.fillRect(0, 168, 520, 4); X.fillStyle = '#d9a362'; X.fillRect(0, 172, 520, 70);
  awning(34);
  if (role === 0) {
    const sx = Math.sin(tt * 9) * 34, tr = Math.sin(tt * 9) * .12;
    cupDraw(260 + sx, 190, .55, { n: 3, rec: [0, 1, 2], mixF: .5 + .4 * Math.sin(tt), slosh: .8, T: tt, lid: 0, press: 0, tilt: tr, sick: false });
    X.beginPath(); X.moveTo(140, 130); X.lineTo(104, 130); X.lineTo(114, 120); X.moveTo(104, 130); X.lineTo(114, 140); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    X.beginPath(); X.moveTo(380, 130); X.lineTo(416, 130); X.lineTo(406, 120); X.moveTo(416, 130); X.lineTo(406, 140); X.stroke();
    DUO.demoFinger(260 + sx, 215, true, (tt * 3) % 1);
    badge('SHAKE IT!', 260, 76, 16, '#2b9ee6', '#fff', 1, -.02);
  } else {
    const held = u > 1.2 && u < 3.2, lk = held ? 0 : -50 + Math.sin(tt * 3) * 3;
    cupDraw(200, 190, .55, { n: u < 1.2 ? 1 : 2, rec: [0, 1, 2], mixF: held ? (u - 1.2) / 2 : 0, slosh: held ? .4 : 0, T: tt, lid: held ? 0 : lk, press: 0, tilt: 0, sick: false });
    for (let i = 0; i < 3; i++) { rr(300 + i * 70 - 30, 190, 60, 38, 10); cel('#e8b866', '#b88a4c', () => rr(300 + i * 70 - 30, 190, 60, 38, 10), 0, 4, 3); ingIcon(i, 300 + i * 70, 207, .42, tt); }
    DUO.demoFinger(held ? 200 : 370, held ? 130 : 205, held || u > 3.2, (tt * 3) % 1);
    badge('FOLLOW THE TICKET!', 260, 76, 16, '#c98a12', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_batido = [['SHAKER', 'SHAKE THE CUP, NOT TOO HARD', 'SHAKE THE PHONE OR WAVE FAST'], ['LID', 'HOLD THE LID, ADD IN ORDER', 'HOLD THE LID, TAP THE INGREDIENTS']];
DUO.DEMOS.du_batido = [t => demo(0, t), t => demo(1, t)];

})();
