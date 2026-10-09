'use strict';
/* ═════════ DUO · BARBER BALANCE (du_barber), after Match Cut (Move It!) ═════════
   CUSTOMER (role 0): a sleepy man with a huge mop of hair whose head droops to one side and wobbles (all from the seed). They counter-tilt
   it (pointer x / ◄ ► / touch drag) to keep the dotted cut line level. Only they feel the sneezes coming (the nose twitches: AH... AH...)
   and the side the ACHOO! will throw the head to, so they can lean against it in time.
   BARBER (role 1, JUDGE): holds and drags the scissors along the dotted line on the hair (hold mouse / touch, or Space + arrows).
   The scissors only cut while the line is level, and a line that moves under held scissors makes them slip: a bald notch.
   Three cuts (the barber also sees where the NEXT one is, the customer does not) = a flat-top that pops into a glossy pompadour.
   Three slips = a disaster haircut (mullet / reverse mohawk / half lawn, from the seed) and the customer cries at the hand mirror.
   Netcode: the customer owns the head angle and sends it as 'h' (angle x1000, coalesced, <= 10/s); 'sn' i marks the moment a sneeze fires.
   The barber judges every snip against the latest head angle it has received (interpolated ~150 ms behind with track()), so what it sees
   is what counts, and publishes 'sc' [tip x, tip y (head-local), cut, front, flags] (coalesced, <= 10/s): the customer draws the
   scissors on its own head, so they never drift off the hair whatever the lag. 'slip' [n, cut, x] is one event per slip.
   The verdict travels as 'end' (DUO.wire). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right LEAVE and y>552) ───────────── */
const PX = 400, PY = 452;                          // the customer's neck: the head rotates around it
const NSEG = 3, MAXSLIP = 3;
const LEVEL = .12;                                 // |head angle| under this = level: the scissors cut
const SLIP = 30, CUTTOL = 22, ENG = 40, CUTV = 230; // px in head space: slip off the line / cut band / grab the front / max cut speed
const CMAX = .8, KSPR = 110, DAMP = 13;             // counter-tilt range (rad), the neck spring
const SNA = .6;                                    // a sneeze throws the head this far (rad)
const NOWW = .2;                                   // LEAN NOW! shows this long before the ACHOO (a human reaction lands right on it)
const LVX = 400, LVY = 520;                        // the spirit level (bottom panel)
const CLX = 702, CLY = 528;                        // the barber (Caos) on the right

/* palette */
const SKIN = '#ffc69c', SKIN2 = '#ec9a70', SKINL = '#ffe2c9', SCALP = '#ffd8bb';
const HAIR = '#7b4427', HAIR2 = '#552a17', HAIRL = '#a8663b', CUTC = '#c8885a';
const GEL = '#3d2216', GELL = '#7d4a2c';
const STEEL = '#e6ecf3', STEEL2 = '#9aa7b8';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function stroke(col, w) { X.strokeStyle = col; X.lineWidth = w; X.lineCap = 'round'; X.lineJoin = 'round'; X.stroke(); }
function pill(x, y, label, col, up) {                // a name tag with a little pointer, e.g. YOU / YOUR FRIEND
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {     // a word on a chunky badge (feedback that reads over any background)
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(250, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 250);
  X.restore();
}
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function spark(x, y, r, a) { X.save(); X.globalAlpha = a === undefined ? 1 : a; star(x, y, r, r * .32, 4, 0, '#fff', Math.max(1.5, r * .12)); X.restore(); }

/* ───────────── the mop of hair (head space: origin = neck, y up is negative) ───────────── */
const HB = [[-92, -298, 44], [-40, -320, 46], [14, -324, 46], [66, -310, 44], [110, -288, 38],
  [-128, -258, 40], [-70, -270, 46], [0, -274, 50], [72, -268, 46], [128, -256, 40],
  [-118, -226, 40], [118, -226, 40], [-138, -206, 32], [138, -206, 32], [-62, -222, 36], [0, -228, 38], [62, -222, 36]];
let HP_ = null; const hairP = () => HP_ || (HP_ = (() => { const p = new Path2D(); for (const [x, y, r] of HB) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); } return p; })());   // built on first use (no Path2D in the headless tests)
/* cosmetic randomness (strands, particles): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
const STRANDS = Array.from({ length: 34 }, () => { const b = HB[Math.floor(cr() * HB.length)], a = cr() * TAU, d = cr() * b[2] * .7; return [b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d, cr() * TAU, 8 + cr() * 8]; });
function hairBody(base, shade, light) {              // ink outline of every puff, then the fills, a cel shade, curls on top
  X.lineJoin = 'round';
  for (const [x, y, r] of HB) { X.beginPath(); X.arc(x, y, r, 0, TAU); X.lineWidth = 10; X.strokeStyle = INK; X.stroke(); }
  X.fillStyle = shade; X.fill(hairP());
  X.save(); X.clip(hairP()); X.fillStyle = base; X.translate(8, 10); X.fill(hairP()); X.restore();
  X.save(); X.clip(hairP());
  X.fillStyle = light; for (const [x, y, r] of HB) { if (y > -240) continue; el(x - r * .25, y - r * .45, r * .42, r * .2, -.4); X.fill(); }
  X.strokeStyle = shade; X.lineWidth = 3.5; X.lineCap = 'round';
  for (const [x, y, a, r] of STRANDS) { X.beginPath(); X.arc(x, y, r, a, a + 1.9); X.stroke(); }
  X.restore();
}
/* the kept part of the hair: everything under the skyline of the cuts (rects [x0, x1, y] remove all the hair above y in x0..x1) */
function keepPath(rects) {
  const ed = new Set([-420, 420]); for (const [a, b] of rects) { ed.add(clamp(a, -420, 420)); ed.add(clamp(b, -420, 420)); }
  const xs = [...ed].sort((a, b) => a - b), p = new Path2D(), sky = [];
  p.moveTo(-420, 120);
  for (let i = 0; i < xs.length - 1; i++) {
    const m = (xs[i] + xs[i + 1]) / 2; let s = -1000; for (const [a, b, y] of rects) if (m >= Math.min(a, b) && m <= Math.max(a, b)) s = Math.max(s, y);
    p.lineTo(xs[i], s); p.lineTo(xs[i + 1], s); sky.push([xs[i], xs[i + 1], s]);
  }
  p.lineTo(420, 120); p.closePath(); return { p, sky };
}
const notchPts = n => [[n.x - 17, n.y - 3], [n.x - 9, n.y + 14], [n.x, n.y + 26], [n.x + 9, n.y + 14], [n.x + 17, n.y - 3]];
function hairCut(rects, notches, fresh) {
  const { p: kp, sky } = keepPath(rects);
  const np = new Path2D(); np.rect(-420, -1000, 840, 1200);
  for (const n of notches) { const q = notchPts(n); np.moveTo(q[0][0], q[0][1] - 40); for (const [x, y] of q) np.lineTo(x, y); np.lineTo(q[4][0], q[4][1] - 40); np.closePath(); }
  X.save(); X.clip(kp); X.clip(np, 'evenodd'); hairBody(HAIR, HAIR2, HAIRL); X.restore();
  // the fresh cut edge: a lighter band just under each cut, inked, only where there is hair
  X.save(); X.clip(hairP()); X.clip(kp);
  for (const [a, b, s] of sky) if (s > -999) { X.fillStyle = CUTC; X.fillRect(a, s, b - a, 7); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(a, s + 1, b - a, 2); }
  X.beginPath(); let pen = false;
  for (const [a, b, s] of sky) { if (s < -999) { pen = false; continue; } if (!pen) { X.moveTo(a, s); pen = true; } else X.lineTo(a, s); X.lineTo(b, s); }
  stroke(INK, 7);
  for (const n of notches) {                         // a bald notch: scalp, a shine, an inked rim, a red nick
    const q = notchPts(n); X.beginPath(); X.moveTo(q[0][0], q[0][1]); for (const [x, y] of q) X.lineTo(x, y);
    X.fillStyle = SCALP; X.fill(); stroke(INK, 6);
    X.fillStyle = '#fff'; el(n.x - 4, n.y + 6, 3, 5, .3); X.fill();
    if (fresh && n.at !== undefined) { X.fillStyle = '#ff5d6c'; el(n.x + 3, n.y + 18, 2.5, 3.5); X.fill(); }
  }
  X.restore();
}
/* the payoff hairdo: a glossy, impossibly tall pompadour (k = 0..1 grows from the flat-top) */
const POMP = 'M-138 -196 C-152 -262 -132 -330 -74 -360 C-14 -392 86 -404 140 -364 C178 -336 182 -292 154 -272 C134 -258 106 -266 106 -290 C106 -306 124 -312 132 -300 C152 -270 152 -232 138 -196 C84 -222 -80 -222 -138 -196 Z';
function pompadour(k, T) {
  X.save(); X.translate(0, -200); X.scale(1 + .06 * Math.sin(k * Math.PI), Math.max(.05, k)); X.translate(0, 200);
  const p = P(POMP); cel(p, GELL, GEL, 0, -12, 5);
  X.save(); X.clip(p);
  X.strokeStyle = 'rgba(255,255,255,.75)'; X.lineWidth = 7; X.lineCap = 'round';
  X.beginPath(); X.moveTo(-104, -250); X.quadraticCurveTo(-90, -336, 20, -362); X.stroke();
  X.lineWidth = 4; X.beginPath(); X.moveTo(-70, -238); X.quadraticCurveTo(-50, -318, 60, -340); X.stroke();
  X.strokeStyle = 'rgba(20,10,6,.45)'; X.lineWidth = 4;
  for (const o of [-40, 0, 40]) { X.beginPath(); X.moveTo(-120 + o, -214); X.quadraticCurveTo(-60 + o, -300, 70 + o * .6, -330 + o * .3); X.stroke(); }
  const sh = ((T * .9) % 1.6) - .3; X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.moveTo(-160 + sh * 300, -400); X.lineTo(-130 + sh * 300, -400); X.lineTo(-210 + sh * 300, -180); X.lineTo(-240 + sh * 300, -180); X.fill();
  X.restore(); X.restore();
}
/* the losing hairdos: what the slips left (a cloud of snips hides the change) */
const DIS = ['MULLET!', 'REVERSE MOHAWK!', 'HALF LAWN!'];
function disasterRects(v) { return v === 0 ? [[-420, 420, -170]] : v === 1 ? [[-34, 34, -150]] : [[-420, 16, -194]]; }
function mulletBack(k) {                              // business in the front, party in the back
  if (k <= 0) return;
  X.save(); X.scale(1, k);
  X.beginPath(); X.moveTo(-104, -170); X.bezierCurveTo(-170, -120, -176, -30, -140, 30); X.lineTo(-110, 14); X.lineTo(-96, 40); X.lineTo(-60, 10); X.lineTo(60, 10); X.lineTo(96, 40); X.lineTo(110, 14); X.lineTo(140, 30); X.bezierCurveTo(176, -30, 170, -120, 104, -170); X.closePath();
  ink(HAIR, 5); X.save(); X.clip(); X.strokeStyle = HAIR2; X.lineWidth = 4; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(s * (110 + i * 12), -130); X.quadraticCurveTo(s * (150 + i * 6), -60, s * (118 + i * 10), 10); X.stroke(); } X.restore();
  X.restore();
}

/* ───────────── the customer's face (head space) ───────────── */
const FACE = 'M0 -250 C62 -250 98 -206 98 -150 C98 -116 104 -84 92 -64 C78 -38 44 -36 0 -36 C-44 -36 -78 -38 -92 -64 C-104 -84 -98 -116 -98 -150 C-98 -206 -62 -250 0 -250 Z';
const STACHE = 'M0 -96 C-10 -106 -34 -106 -50 -96 C-62 -88 -72 -88 -80 -98 C-82 -82 -66 -70 -46 -76 C-30 -80 -12 -82 0 -78 C12 -82 30 -80 46 -76 C66 -70 82 -82 80 -98 C72 -88 62 -88 50 -96 C34 -106 10 -106 0 -96 Z';
/* o: mood (idle / worry / ah / achoo / shock / happy / cry), tw (sneeze twitch 0..1), look [dx, dy], T */
function head(o) {
  const T = o.T || 0, mood = o.mood || 'idle', tw = o.tw || 0, lk = o.look || [0, 0];
  // neck + ears
  rr(-30, -70, 60, 84, 14); ink(SKIN2, 4);
  for (const s of [-1, 1]) { el(s * 104, -132, 17, 25, s * .15); ink(SKIN, 4); X.fillStyle = SKIN2; el(s * 107, -130, 7, 13, s * .15); X.fill(); }
  // face with cheek shade + light
  const fp = P(FACE); cel(fp, SKIN, SKIN2, -10, 6, 5);
  X.save(); X.clip(fp); X.fillStyle = SKINL; el(-40, -206, 34, 18, -.3); X.fill(); X.restore();
  const blush = mood === 'happy' ? .85 : mood === 'cry' ? .7 : .45;
  X.fillStyle = `rgba(255,105,120,${blush})`; el(-62, -100, 20, 11); X.fill(); el(62, -100, 20, 11); X.fill();
  // eyebrows (bushy, same brown as the hair)
  const bro = mood === 'shock' ? -16 : mood === 'ah' ? -10 * tw - 4 : mood === 'happy' ? -10 : mood === 'achoo' ? 6 : 0;
  const tilt = mood === 'worry' || mood === 'cry' ? .32 : mood === 'achoo' ? -.25 : mood === 'ah' ? .15 * tw : 0;
  for (const s of [-1, 1]) { X.save(); X.translate(s * 38, -176 + bro + Math.sin(T * 30) * tw * 1.5); X.rotate(s * tilt); rr(-24, -8, 48, 16, 8); ink(HAIR2, 3.5); X.fillStyle = HAIRL; rr(-18, -6, 20, 4, 2); X.fill(); X.restore(); }
  // eyes
  for (const s of [-1, 1]) {
    const ex = s * 36, ey = -142;
    if (mood === 'happy') { X.beginPath(); X.moveTo(ex - 14, ey + 4); X.quadraticCurveTo(ex, ey - 14, ex + 14, ey + 4); stroke(INK, 5.5); spark(ex + s * 14, ey - 16, 8 + 3 * Math.sin(T * 9 + s), 1); continue; }
    if (mood === 'achoo') { X.beginPath(); X.moveTo(ex - 13, ey - 9); X.lineTo(ex + 3 * s, ey); X.lineTo(ex - 13, ey + 9); X.moveTo(ex + 13, ey - 9); X.lineTo(ex - 3 * s, ey); X.lineTo(ex + 13, ey + 9); X.lineWidth = 5; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); continue; }
    if (mood === 'cry') { X.beginPath(); X.moveTo(ex - 14, ey - 2); X.quadraticCurveTo(ex, ey + 9, ex + 14, ey - 2); stroke(INK, 5.5); continue; }
    const big = mood === 'shock' ? 1.25 : 1; el(ex, ey, 16 * big, 18 * big); ink('#fff', 3);
    const pr = mood === 'shock' ? 4.5 : 8, px = ex + lk[0] * 6, py = ey + lk[1] * 6 + 2;
    X.fillStyle = INK; el(px, py, pr, pr + 1.5); X.fill(); X.fillStyle = '#fff'; el(px - 2.5, py - 3.5, 2.6, 2.6); X.fill();
    const lid = mood === 'ah' ? .25 + .55 * tw : mood === 'worry' ? .3 : mood === 'idle' ? .38 + (Math.sin(T * 1.4) > .97 ? .6 : 0) : 0;   // a sleepy customer: heavy lids
    if (lid > 0) { X.save(); el(ex, ey, 15 * big, 17 * big); X.clip(); X.fillStyle = SKIN; X.fillRect(ex - 18, ey - 20, 36, 36 * lid); X.restore(); X.beginPath(); X.moveTo(ex - 15, ey - 18 + 36 * lid); X.lineTo(ex + 15, ey - 18 + 36 * lid); stroke(INK, 3.5); }
  }
  // the nose: big, bulbous; it twitches before a sneeze
  const nw = 1 + tw * (.18 + .1 * Math.sin(T * 38)), nr = Math.sin(T * 24) * .12 * tw;
  X.save(); X.translate(0, -112); X.rotate(nr); X.scale(nw, mood === 'achoo' ? .86 : 1);
  el(0, 0, 24, 21); ink('#ffae86', 4); X.fillStyle = '#ffcfb2'; el(-8, -8, 8, 5, -.4); X.fill();
  X.fillStyle = '#8a3b2c'; el(-9, 9, 4.5 + tw * 2.5, 3 + tw * 1.5, .3); X.fill(); el(9, 9, 4.5 + tw * 2.5, 3 + tw * 1.5, -.3); X.fill();
  X.restore();
  if (tw > .05) {                                    // twitch lines beside the nose
    X.globalAlpha = tw; for (const s of [-1, 1]) { X.beginPath(); for (let i = 0; i < 3; i++) { X.moveTo(s * (34 + i * 2), -124 + i * 9); X.lineTo(s * (46 + i * 3), -128 + i * 9 + Math.sin(T * 40 + i) * 2); } stroke(INK, 3); } X.globalAlpha = 1;
  }
  // mouth (under the moustache)
  X.save(); X.translate(0, -62);
  if (mood === 'happy') { X.beginPath(); X.moveTo(-34, -8); X.quadraticCurveTo(0, 30, 34, -8); X.closePath(); ink('#7a1f2c', 3.5); X.save(); X.clip(); X.fillStyle = '#fff'; X.fillRect(-34, -10, 68, 11); X.restore(); spark(24, -4, 7 + 3 * Math.sin(T * 12), 1); }
  else if (mood === 'cry') { X.beginPath(); X.moveTo(-28, 2); for (let i = 0; i <= 8; i++) X.lineTo(-28 + i * 7, (i % 2 ? -6 : 0) + Math.sin(T * 30 + i) * 2); X.quadraticCurveTo(0, 30, -28, 2); X.closePath(); ink('#7a1f2c', 3.5); X.fillStyle = '#ff7c94'; el(0, 16, 12, 5); X.fill(); }
  else if (mood === 'achoo') { el(0, 6, 22, 20); ink('#7a1f2c', 3.5); X.fillStyle = '#ff7c94'; el(0, 16, 12, 6); X.fill(); }
  else if (mood === 'shock' || mood === 'ah') { const r = mood === 'shock' ? 13 : 5 + tw * 8; el(0, 4, r * .85, r); ink('#7a1f2c', 3.5); }
  else if (mood === 'worry') { X.beginPath(); X.moveTo(-18, 6); X.quadraticCurveTo(-6, -2, 0, 4); X.quadraticCurveTo(8, 10, 18, 2); stroke(INK, 4); }
  else { X.beginPath(); X.moveTo(-16, 0); X.quadraticCurveTo(0, 8, 16, 0); stroke(INK, 4); }
  X.restore();
  // the handlebar moustache (flaps on a sneeze)
  X.save(); if (mood === 'achoo') { X.translate(0, -90); X.scale(1.15, .8); X.translate(0, 90); }
  inkP(P(STACHE), HAIR2, 3.5); X.save(); X.clip(P(STACHE)); X.fillStyle = HAIRL; el(-30, -98, 16, 3, .1); X.fill(); el(30, -98, 16, 3, -.1); X.fill(); X.restore(); X.restore();
  if (mood === 'worry' || mood === 'shock') { X.globalAlpha = .9; const dy = (T * 50) % 24; el(80, -196 + dy, 6, 9); ink('#9fe3ff', 2.5); X.globalAlpha = 1; }   // sweat drop
}

/* ───────────── the scissors: tip at (0, 0) pointing to +x, o = how open (0..1) ───────────── */
const BLADE = 'M0 0 C-10 -4 -30 -10 -52 -10 L-52 2 C-30 2 -12 1 0 0 Z';
function scissors(x, y, ang, o, sc, glow) {
  X.save(); X.translate(x, y); X.rotate(ang); X.scale(sc, sc);
  const a = .05 + o * .32;
  if (glow) { X.globalAlpha = .35; el(-30, 0, 70, 34); X.fillStyle = glow; X.fill(); X.globalAlpha = 1; }
  for (const s of [1, -1]) {                         // the far blade + its handle, then the near one
    X.save(); X.translate(-52, 0); X.rotate(s * a); X.translate(52, 0); X.scale(1, s);
    X.beginPath(); X.moveTo(-52, -2); X.quadraticCurveTo(-64, 6, -70, 16); X.lineWidth = 15; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 7; X.strokeStyle = s > 0 ? '#ff5160' : '#ff7c4d'; X.stroke();
    X.beginPath(); X.arc(-82, 24, 15, 0, TAU); X.arc(-82, 24, 7, 0, TAU, true); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.fillStyle = s > 0 ? '#ff5160' : '#ff7c4d'; X.fill('evenodd');
    X.fillStyle = 'rgba(255,255,255,.45)'; el(-88, 16, 5, 2.5, -.6); X.fill();
    inkP(P(BLADE), STEEL, 3); X.save(); X.clip(P(BLADE)); X.fillStyle = STEEL2; X.fillRect(-60, -1, 60, 4); X.fillStyle = '#fff'; X.fillRect(-46, -7, 30, 2.5); X.restore();
    X.restore();
  }
  X.beginPath(); X.arc(-52, 0, 5.5, 0, TAU); ink('#ffe14d', 2.5);
  X.restore();
}

/* ───────────── the static scene, painted once into an offscreen canvas ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  // wallpaper: mint stripes with a little diamond print
  let g = X.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, '#8fe0c4'); g.addColorStop(1, '#bff2df'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  X.fillStyle = 'rgba(255,255,255,.28)'; for (let x = 0; x < W; x += 56) X.fillRect(x, 0, 22, 420);
  X.fillStyle = 'rgba(40,140,110,.18)'; for (let y = 30; y < 410; y += 48) for (let x = 39 + ((y / 48) & 1) * 28; x < W; x += 56) { X.beginPath(); X.moveTo(x, y - 6); X.lineTo(x + 5, y); X.lineTo(x, y + 6); X.lineTo(x - 5, y); X.fill(); }
  // wainscot + chair rail
  rr(-10, 404, W + 20, 18, 4); ink('#d9995a', 4);
  X.fillStyle = '#b8743f'; X.fillRect(0, 426, W, 160);
  for (let x = 10; x < W; x += 98) { rr(x, 438, 82, 120, 8); ink('#c98650', 3); X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(x + 6, 444, 70, 6); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 426); X.lineTo(W, 426); X.stroke();
  // left shelf: a jar of blue disinfectant with combs, tonic bottles
  rr(108, 336, 190, 14, 4); ink('#d9995a', 3.5); for (const bx of [128, 278]) { X.beginPath(); X.moveTo(bx - 8, 350); X.lineTo(bx + 8, 350); X.lineTo(bx, 372); X.closePath(); ink('#b8743f', 3); }
  rr(126, 262, 46, 74, 10); ink('rgba(120,210,255,.75)', 3.5);
  X.fillStyle = '#3aa6ff'; X.fillRect(129, 286, 40, 46); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(132, 268, 6, 60);
  for (const [cx, an, c] of [[140, -.2, '#222'], [152, .05, '#ff5d8a'], [162, .25, '#ffe14d']]) { X.save(); X.translate(cx, 290); X.rotate(an); rr(-3, -52, 6, 50, 2); ink(c, 2.5); X.fillStyle = c; for (let i = 0; i < 6; i++) X.fillRect(3, -48 + i * 7, 6, 3); X.restore(); }
  rr(122, 254, 54, 12, 4); ink('#d0d6de', 3);
  for (const [bx, h, c] of [[262, 54, '#ff9a4d'], [284, 40, '#b49cff']]) { rr(bx - 11, 336 - h, 22, h, 6); ink(c, 3); rr(bx - 5, 324 - h, 10, 14, 3); ink('#fff', 2.5); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(bx - 7, 340 - h, 4, h - 14); rr(bx - 9, 346 - h * .62, 18, 12, 2); ink('#fff6d6', 1.5); }
  // right: a framed poster of the house speciality + a stack of towels on a shelf
  X.save(); X.translate(690, 212); X.rotate(.03); X.scale(.86, .86);
  rr(-74, -70, 148, 140, 6); ink('#ffe9b0', 5); rr(-64, -60, 128, 102, 4); ink('#ff8fb1', 0);
  X.save(); rr(-64, -60, 128, 102, 4); X.clip(); X.fillStyle = '#ff6f9a'; for (let i = 0; i < 12; i++) { X.save(); X.translate(0, -4); X.rotate(i * TAU / 12); X.fillRect(-5, 14, 10, 80); X.restore(); } X.restore();
  el(0, 14, 25, 27); ink(SKIN, 3); X.fillStyle = INK; el(-9, 10, 2.6, 3.4); X.fill(); el(9, 10, 2.6, 3.4); X.fill();
  X.beginPath(); X.moveTo(-14, 26); X.quadraticCurveTo(-7, 20, 0, 24); X.quadraticCurveTo(7, 20, 14, 26); X.quadraticCurveTo(0, 30, -14, 26); ink(HAIR2, 1.5);
  X.save(); X.translate(0, 52); X.scale(.24, .24); const pp = P(POMP); cel(pp, GELL, GEL, 0, -12, 10);
  X.strokeStyle = 'rgba(255,255,255,.75)'; X.lineWidth = 14; X.lineCap = 'round'; X.beginPath(); X.moveTo(-104, -250); X.quadraticCurveTo(-90, -336, 20, -362); X.stroke(); X.restore();
  star(46, -44, 10, 4, 4, 0, '#fff', 2);
  txt('THE POMPADOUR', 0, 57, 17, INK, 'center', 132);
  X.restore();
  rr(612, 338, 170, 14, 4); ink('#d9995a', 3.5);
  for (const [y, c] of [[312, '#ff8fb1'], [292, '#7fd0ff']]) { rr(630, y, 92, 24, 10); ink(c, 3); X.strokeStyle = 'rgba(20,16,28,.18)'; X.lineWidth = 2; X.beginPath(); X.moveTo(640, y + 16); X.lineTo(712, y + 16); X.stroke(); }
  rr(736, 262, 26, 76, 8); ink('#5CFF7A', 3); rr(740, 244, 18, 20, 4); ink('#fff', 2.5); X.beginPath(); X.moveTo(758, 250); X.lineTo(776, 246); stroke(INK, 4);
  // the barber chair: red leather back with buttons, chrome arms
  rr(PX - 132, 326, 264, 210, 40); ink('#e0464f', 5);
  X.save(); rr(PX - 132, 326, 264, 210, 40); X.clip(); X.fillStyle = '#a8283a'; X.fillRect(PX + 92, 326, 50, 220); X.fillStyle = 'rgba(255,255,255,.22)'; el(PX - 80, 350, 44, 10, -.2); X.fill();
  X.fillStyle = 'rgba(80,10,20,.5)'; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { el(PX - 90 + c * 60 + (r & 1) * 30, 360 + r * 44, 4.5, 4.5); X.fill(); } X.restore();
  for (const s of [-1, 1]) { rr(PX + s * 186 - 46, 476, 92, 22, 11); ink(STEEL, 4); X.fillStyle = '#fff'; X.fillRect(PX + s * 186 - 34, 481, 50, 4); rr(PX + s * 186 - 8, 496, 16, 70, 4); ink(STEEL2, 3.5); }
  X = old; return cv2;
}

/* ───────────── live bits of the scene ───────────── */
function pole(T) {                                    // the barber pole spins (stripes climb)
  const x = 44, y = 94, w = 44, h = 250;
  rr(x - 6, y - 26, w + 12, 28, 10); ink(STEEL, 4); X.beginPath(); X.arc(x + w / 2, y - 30, 14, Math.PI, 0); ink('#e0464f', 4);
  rr(x, y, w, h, 16); ink('#fff', 4);
  X.save(); rr(x, y, w, h, 16); X.clip();
  const off = (T * 46) % 60;
  for (let i = -2; i < 7; i++) for (const [c, o] of [['#e0464f', 0], ['#3a7bff', 30]]) { X.fillStyle = c; X.beginPath(); const yy = y + i * 60 - off + o; X.moveTo(x - 2, yy + 34); X.lineTo(x + w + 2, yy); X.lineTo(x + w + 2, yy + 14); X.lineTo(x - 2, yy + 48); X.fill(); }
  X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(x + 7, y, 7, h); X.fillStyle = 'rgba(20,16,28,.16)'; X.fillRect(x + w - 10, y, 10, h);
  X.restore(); rr(x, y, w, h, 16); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
  rr(x - 6, y + h - 2, w + 12, 26, 10); ink(STEEL, 4);
}
function fishbowl(T, sx, sy) {                       // the goldfish watches the scissors, very worried
  const bx = 220, by = 300;
  X.beginPath(); X.arc(bx, by, 34, -1.05, Math.PI + 1.05); X.closePath(); ink('rgba(170,230,255,.55)', 3.5);
  X.save(); X.beginPath(); X.arc(bx, by, 34, -1.05, Math.PI + 1.05); X.closePath(); X.clip(); X.fillStyle = 'rgba(70,170,255,.5)'; X.fillRect(bx - 40, by - 8 + Math.sin(T * 2) * 1.5, 80, 50); X.restore();
  const fx = bx + Math.sin(T * 1.3) * 10, fy = by + 8 + Math.sin(T * 2.1) * 4, face = sx < fx ? -1 : 1;
  X.save(); X.translate(fx, fy); X.scale(face, 1);
  X.beginPath(); X.moveTo(-12, 0); X.lineTo(-22, -8 + Math.sin(T * 12) * 2); X.lineTo(-22, 8 - Math.sin(T * 12) * 2); X.closePath(); ink('#ff8a2a', 2.5);
  el(0, 0, 13, 9); ink('#ff9f3a', 2.5); el(6, -2, 5, 5); ink('#fff', 1.5);
  const a = Math.atan2(sy - fy, (sx - fx) * face); X.fillStyle = INK; el(6 + Math.cos(a) * 2, -2 + Math.sin(a) * 2, 2.2, 2.2); X.fill();
  X.restore();
  X.fillStyle = 'rgba(255,255,255,.6)'; el(bx - 18, by - 14, 5, 10, .4); X.fill();
  X.beginPath(); X.arc(bx, by + Math.sin(T * 2) * 0 - 30, 1, 0, 0);
  const bq = (T * .8) % 1; X.globalAlpha = 1 - bq; X.beginPath(); X.arc(fx + face * 16, fy - 8 - bq * 26, 3, 0, TAU); ink('rgba(255,255,255,.8)', 1.5); X.globalAlpha = 1;
}
let CP_ = null; const capeP = () => CP_ || (CP_ = (() => { const p = new Path2D(); p.moveTo(PX - 44, PY - 16); p.bezierCurveTo(PX - 120, PY + 10, PX - 196, PY + 60, PX - 228, 612); p.lineTo(PX + 228, 612); p.bezierCurveTo(PX + 196, PY + 60, PX + 120, PY + 10, PX + 44, PY - 16); p.closePath(); return p; })());
function cape(fill) {                                 // the striped cape (cut hair piles up on it)
  inkP(capeP(), '#f4f8ff', 5);
  X.save(); X.clip(capeP()); X.fillStyle = '#bcd8ff'; for (let i = -6; i <= 6; i++) { X.beginPath(); X.moveTo(PX + i * 16 - 4, PY - 20); X.lineTo(PX + i * 16 + 4, PY - 20); X.lineTo(PX + i * 40 + 10, 612); X.lineTo(PX + i * 40 - 10, 612); X.fill(); }
  X.fillStyle = 'rgba(40,60,120,.12)'; X.fillRect(PX + 120, PY, 120, 160);
  X.fillStyle = HAIR; for (let i = 0; i < fill; i++) { const a = (i * 2.4) % 6.28, x = PX + Math.cos(a) * (40 + (i * 13) % 130), y = PY + 50 + (i * 17) % 60; X.save(); X.translate(x, y); X.rotate(a); X.beginPath(); X.arc(0, 0, 8, 0, 2.4); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = HAIRL; X.stroke(); X.restore(); }
  X.restore();
  rr(PX - 54, PY - 26, 108, 22, 10); ink('#fff', 4); X.fillStyle = '#bcd8ff'; X.fillRect(PX - 46, PY - 14, 92, 3);
}
/* Caos the barber: a comb in the raised hand; hm = how far the hand mirror is raised (payoff) */
function arms(u, la, ra, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  const one = (sx, an) => { X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an); X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2); X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs); X.restore(); };
  one(-1, la); one(1, ra);
}
function handMirror(x, y, k, win, T) {
  if (k <= .01) return;
  X.save(); X.translate(x, y); X.scale(k, k); X.rotate(-.2);
  rr(-8, 30, 16, 60, 6); ink('#ff8fb1', 3.5);
  X.beginPath(); X.arc(0, 0, 40, 0, TAU); ink('#ff8fb1', 4.5);
  X.beginPath(); X.arc(0, 0, 31, 0, TAU); ink(win ? '#d9f6ff' : '#cfd9e4', 3);
  X.save(); X.beginPath(); X.arc(0, 0, 31, 0, TAU); X.clip(); X.fillStyle = 'rgba(255,255,255,.7)'; X.beginPath(); X.moveTo(-30, 6); X.lineTo(-6, -30); X.lineTo(4, -30); X.lineTo(-24, 12); X.fill(); X.restore();
  if (!win) { X.beginPath(); X.moveTo(-14, -26); X.lineTo(2, -6); X.lineTo(-6, 6); X.lineTo(12, 26); X.moveTo(2, -6); X.lineTo(22, -12); stroke(INK, 3); }
  X.restore();
  if (win) for (let i = 0; i < 3; i++) { const q = ((T * 1.6 + i / 3) % 1); spark(x - 30 + i * 30, y - 46 - q * 30, 10 * Math.sin(q * Math.PI), 1); }
}

/* window focus: a lost keyup / pointerup (Alt-Tab) must never leave the scissors held or a lean key stuck */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ═════════ the game ═════════ */
function duBarber(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), cust = D.role === 0, TS = Math.sqrt(sp);
  /* the level, all from the seed (same draws whatever the role) */
  const bs = R() < .5 ? -1 : 1, BIAS = bs * (.38 + R() * .06);                                 // the sleepy head droops to one side
  const WF = [1.15 * TS, 2.4 * TS, 3.9 * TS], WA = [.19, .1, .05], WP = [R() * TAU, R() * TAU, R() * TAU];
  const drift = c => BIAS + WA[0] * Math.sin(WF[0] * c + WP[0]) + WA[1] * Math.sin(WF[1] * c + WP[1]) + WA[2] * Math.sin(WF[2] * c + WP[2]);
  const WARN = Math.max(.75, 1.05 / TS);
  const SN = [1.5, 4.1, 6.8, 9.5].map(b => ({ t: (b + R() * .8) / TS, dir: R() < .5 ? -1 : 1 }));
  const snz = c => { let v = 0; for (const s of SN) { const u = c - s.t; if (u < 0 || u > 2) continue; v += s.dir * SNA * (u < .07 ? u / .07 : Math.exp(-(u - .07) * 2.4)); } return v; };
  const SEG = [[-120, 120, -300], [-136, 136, -278], [-146, 146, -256]].map(([a, b, y], i) => {
    const d = i === 1 ? -1 : 1, j = (R() - .5) * 10, x0 = a + (R() - .5) * 16, x1 = b + (R() - .5) * 16;
    return { a: d > 0 ? x0 : x1, b: d > 0 ? x1 : x0, d, y: y + j, L: Math.abs(x1 - x0) };
  });
  const VAR = Math.floor(R() * 3), BIRD = R() < .125;                                         // which disaster; the rare bird on the pompadour
  /* state */
  let th = drift(0), om = 0, ctrl = 0, ctrlT = 0; const kHeld = new Set(); let fN = FOCUSN;   // customer: the head
  const thT = track(), lxT = track(), lyT = track(); let thSeen = false, hAt = -9, hLast = 99;
  let seg = 0, f = 0, fShow = 0, slips = 0, eng = false, hold = false, pN = 0, cool = 0, level = false;
  let tip = [640, 300], PT = [640, 300], aP = 0, tipL = [999, 999], sAt = -9, sLast = '', kx = 0, ky = 0, fl = 0, rx = { seg: 0, f: 0, fl: 0 };
  const notches = [], bits = [], pops = [], fired = SN.map(() => false), snAt = SN.map(() => -9);
  let slipAt = -9, segAt = -9, resAt = -1, sungW = false, snipT = 0, cutFill = 0, waitAt = -9, sang = -.7;
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const toLocal = (x, y, a) => { const dx = x - PX, dy = y - PY, c = Math.cos(a), s = Math.sin(a); return [dx * c + dy * s, -dx * s + dy * c]; };
  const toScreen = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [PX + x * c - y * s, PY + x * s + y * c]; };
  const angR = () => { const v = thT.at(); return v === null ? th : v; };                       // the barber's view of the head (until the first 'h': the seeded start)
  function pop(s, size, bgc, fg, x, y) { pops.length = 0; pops.push({ s, size, bgc, fg, x: x || 186, y: y || 236, t0: g.c, rot: (cr() - .5) * .16 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .9, gr: 900, rot: 0, vr: 0, sh: 0 }, o)); }
  function tufts(lx, ly, a, n) { for (let i = 0; i < n; i++) { const [x, y] = toScreen(lx + (cr() - .5) * 14, ly - cr() * 16, a); bit({ sh: 0, x, y, vx: (cr() - .5) * 140, vy: -(40 + cr() * 120), vr: (cr() - .5) * 10, rot: cr() * 6, life: .8 + cr() * .4, r: 7 + cr() * 5 }); } cutFill = Math.min(40, cutFill + n * .35); }
  function slipFx(n, k, x) {
    slipAt = g.c; notches.push({ k, x, y: SEG[k].y, at: g.c });
    sfx.buzz(); noise(.12, .09, 2600, 900, 'bandpass'); shake(7, .22);
    const a = cust ? th : angR(); tufts(x, SEG[k].y + 10, a, 7);
    pop(n >= MAXSLIP ? 'MY HAIR!!' : 'OOPS!', 38, '#e8434f', '#fff');
  }
  function achoo(i) {
    snAt[i] = g.c; noise(.35, .11, 3000, 500, 'bandpass', 0, .8); snd(520, .09, 'square', .05, 0, 1300); shake(6, .2);
    const a = cust ? th : angR(), [nx, ny] = toScreen(0, -104, a);
    for (let j = 0; j < 14; j++) bit({ sh: 1, x: nx, y: ny, vx: (cr() - .5) * 420 + SN[i].dir * 120, vy: (cr() - .3) * 260, gr: 500, life: .5 + cr() * .35, r: 4 + cr() * 4 });
    pop('ACHOO!', 40, '#ffe14d', INK, PX + SN[i].dir * 230, 250);
  }
  function keyDir() {                                 // the barber's arrows move the scissors
    if (cust) return; const h = c => kHeld.has(c) ? 1 : 0;
    kx = h('ArrowRight') + h('KeyD') - h('ArrowLeft') - h('KeyA'); ky = h('ArrowDown') + h('KeyS') - h('ArrowUp') - h('KeyW');
  }
  function snip(n) { snd(2400 + n * 300, .03, 'square', .035, 0, 1200); noise(.03, .05, 5000, 3000, 'highpass'); }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: cust ? 'BALANCE!' : 'SNIP!', roleLabel: cust ? 'CUSTOMER' : 'BARBER',
    hint: cust ? 'MOVE THE MOUSE (OR ◄ ►) TO KEEP THE LINE LEVEL - LEAN AGAINST THE SNEEZES!' : 'HOLD THE MOUSE (OR SPACE + ARROWS) AND DRAG THE SCISSORS ALONG THE DOTS',
    thint: cust ? 'DRAG LEFT / RIGHT TO KEEP THE LINE LEVEL - LEAN AGAINST THE SNEEZES!' : 'HOLD AND DRAG THE SCISSORS ALONG THE DOTS',
    update(dt) {
      g.c += dt; cool = Math.max(0, cool - dt);
      if (g.result && resAt < 0) resAt = g.c;
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); pN = 0; kx = 0; ky = 0; }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1.1) pops.length = 0;
      if (cust) {
        // the head: a damped spring toward (droop + wobble + sneezes + my counter-tilt); after the verdict it sits up straight
        const kl = (kHeld.has('ArrowLeft') || kHeld.has('KeyA') ? 1 : 0) - (kHeld.has('ArrowRight') || kHeld.has('KeyD') ? 1 : 0);
        if (kl) ctrlT = clamp(ctrlT - kl * 1.3 * dt, -CMAX, CMAX);
        ctrl += (ctrlT - ctrl) * Math.min(1, dt * 22);
        const tgt = g.result ? 0 : drift(g.c) + snz(g.c) + ctrl;
        om += (KSPR * (tgt - th) - DAMP * om) * dt; th = clamp(th + om * dt, -1.1, 1.1);
        const r = Math.round(th * 1000);
        if (!g.result && g.c - hAt >= .1 && (Math.abs(r - hLast) > 2 || g.c - hAt > .3)) { hAt = g.c; hLast = r; D.send('h', r, true); }
        for (let i = 0; i < SN.length; i++) if (!fired[i] && !g.result && g.c >= SN[i].t) { fired[i] = true; D.send('sn', i); achoo(i); }
        // the friend's scissors, in head space (so they always sit on MY head)
        const lx = lxT.at(), ly = lyT.at(); if (lx !== null) tipL = [lx, ly];
        const segNow = rx.seg; if (segNow > seg) { seg = segNow; fShow = 0; segAt = g.c; if (seg < NSEG) sfx.coin(); }
        const prev = fShow; fShow = seg >= NSEG ? 0 : Math.min(rx.f, fShow + Math.max(0, rx.f - fShow) * Math.min(1, dt * 12) + 1);
        if (seg < NSEG && fShow > prev + .5) { snipT += fShow - prev; if (snipT > 14) { snipT = 0; snip(seg); const S = SEG[seg]; tufts(S.a + S.d * fShow, S.y, th, 1); } }
        fl = rx.fl;
      } else {
        const a = angR(); level = Math.abs(a) < LEVEL && thSeen;
        if (kx || ky) { tip[0] = clamp(tip[0] + kx * 300 * dt, 20, 780); tip[1] = clamp(tip[1] + ky * 300 * dt, 70, 540); }
        hold = (pN > 0 || kHeld.has('Space') || kHeld.has('Enter')) && !g.result;
        tipL = toLocal(tip[0], tip[1], a);
        // did the line jump away from the scissors (the head turned more than my hand moved this frame)?
        const q = toLocal(tip[0], tip[1], aP), jumped = Math.hypot(tipL[0] - q[0], tipL[1] - q[1]) > Math.max(4, Math.hypot(tip[0] - PT[0], tip[1] - PT[1]));
        PT = tip.slice(); aP = a;
        if (!g.result && seg < NSEG) {
          const S = SEG[seg], u = (tipL[0] - S.a) * S.d, dy = tipL[1] - S.y;
          if (!hold) eng = false;
          else if (!eng) { if (cool <= 0 && Math.abs(u - f) < ENG && Math.abs(dy) < 26) { eng = true; snd(1800, .04, 'square', .04, 0, 2400); } }
          else if ((Math.abs(dy) > SLIP && u > f - 60 && u < f + 80) || ((u < f - 60 || u > f + 80) && jumped)) {   // the line moved (or the hand did), or a sneeze yanked it out from under still scissors: a gouge
            eng = false; cool = .45; slips++; const x = clamp(S.a + S.d * clamp(u, 0, S.L), Math.min(S.a, S.b), Math.max(S.a, S.b));
            D.send('slip', [slips, seg, Math.round(x)]); slipFx(slips, seg, x);
          } else if (u < f - 60 || u > f + 80) eng = false;
          else if (u > f && Math.abs(dy) < CUTTOL) {
            if (level) {
              const nf = Math.min(u, f + CUTV * dt, S.L), d = nf - f; f = nf; snipT += d;
              if (snipT > 14) { snipT = 0; snip(seg); tufts(S.a + S.d * f, S.y, a, 1); }
              if (f >= S.L - .5) { seg++; f = 0; eng = false; segAt = g.c; sfx.coin(); if (seg < NSEG) pop(['NEAT!', 'SHARP!'][seg - 1], 34, '#4fd06a', '#fff'); }
            } else if (g.c - waitAt > .5) { waitAt = g.c; snd(300, .05, 'square', .03); }
          }
          fShow = f;
        }
        if (!g.result) { if (seg >= NSEG) g.finish('win'); else if (slips >= MAXSLIP) g.finish('lose'); else if (g.c >= g.limit) g.finish('lose'); }
        const m = [Math.round(tipL[0]), Math.round(tipL[1]), seg, Math.round(f), (hold ? 1 : 0) | (eng ? 2 : 0)], key = m.join();
        if (!g.result && g.c - sAt >= .1 && (key !== sLast || g.c - sAt > .3)) { sAt = g.c; sLast = key; D.send('sc', m, true); }
        fl = (hold ? 1 : 0) | (eng ? 2 : 0);
      }
      if (g.result === 'win' && !sungW) { sungW = true; snd(1568, .25, 'sine', .06, .15); snd(2093, .3, 'sine', .05, .22); [523, 659, 784, 1047].forEach((q, i) => snd(q, .12, 'triangle', .06, .3 + i * .07)); pop('FABULOUS!', 40, '#ff9f1c', '#FFE14D', 186, 236); }
      if (g.result === 'lose' && !sungW) { sungW = true; [392, 370, 349, 294].forEach((q, i) => snd(q, i === 3 ? .5 : .2, 'sawtooth', .05, .2 + i * .22, i === 3 ? 260 : undefined)); pop(DIS[VAR], 32, '#8a6fd6', '#fff', 186, 236); }
    },
    msg(type, d) {
      if (type === 'h' && !cust) { thT.push(clamp(+d || 0, -1200, 1200) / 1000); thSeen = true; }
      else if (type === 'sn' && !cust) { const i = d | 0; if (SN[i] && snAt[i] < 0) achoo(i); }
      else if (type === 'sc' && cust && Array.isArray(d)) {
        lxT.push(+d[0] || 0); lyT.push(+d[1] || 0); rx.fl = d[4] | 0;
        const sg = clamp(d[2] | 0, 0, NSEG), ff = Math.max(0, +d[3] || 0);           // the front only grows inside one cut, and restarts on the next
        if (sg > rx.seg) { rx.seg = sg; rx.f = ff; } else if (sg === rx.seg) rx.f = Math.max(rx.f, ff);
      }
      else if (type === 'slip' && cust && Array.isArray(d)) { const n = d[0] | 0; if (n > slips) { slips = n; slipFx(n, clamp(d[1] | 0, 0, NSEG - 1), +d[2] || 0); } }
    },
    move(p) {
      if (cust) { ctrlT = clamp((p.x - 400) / 260, -1, 1) * CMAX; return; }
      tip = [clamp(p.x, 20, 780), clamp(p.y - (TOUCH ? 46 : 0), 60, 560)];
    },
    down(p) { if (!cust) { pN++; g.move(p); } },
    up() { if (!cust) pN = Math.max(0, pN - 1); },
    key(e) { if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return; kHeld.add(e.code); keyDir(); },
    keyup(e) { kHeld.delete(e.code); keyDir(); },
    draw() {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); X = ctx;
      X.drawImage(BG, 0, 0);
      let a = cust ? th : angR(); if (rk >= 0) a *= 1 - ease(rk / .3);
      // the sneeze coming (only the customer feels it)
      let tw = 0, wi = -1; if (cust && !g.result) for (let i = 0; i < SN.length; i++) { const u = SN[i].t - T; if (u > 0 && u < WARN) { tw = 1 - u / WARN; wi = i; } }
      const sneezing = SN.some((s, i) => snAt[i] >= 0 && T - snAt[i] < .45);
      // the scissors on screen
      let [scx, scy] = cust ? (tipL[0] < 900 ? toScreen(tipL[0], tipL[1], a) : [640, 300]) : tip;
      pole(T); fishbowl(T, scx, scy);
      scoreboard(T);
      // mood of the customer
      let mood = 'idle';
      if (won && rk > .15) mood = 'happy'; else if (lost && rk > .25) mood = 'cry'; else if (lost) mood = 'shock';
      else if (sneezing) mood = 'achoo'; else if (T - slipAt < .7) mood = 'shock'; else if (tw > 0) mood = 'ah'; else if (Math.abs(a) > .3 || fl & 2) mood = 'worry';
      const lk = [clamp((scx - PX) / 200, -1, 1), clamp((scy - 300) / 200, -1, 1)];
      // the head (rotates around the neck)
      const jolt = sneezing ? Math.sin(T * 60) * 2 : 0, breathe = Math.sin(T * 2.2) * 1.5;
      X.save(); X.translate(PX + jolt, PY + breathe * .3); X.rotate(a);
      const dk = lost ? ease((rk - .18) / .25) : 0;
      if (lost && VAR === 0) mulletBack(dk);
      head({ mood, tw, T, look: lk });
      if (won && rk > .12) {
        pompadour(outBack((rk - .12) / .3), T);
        if (BIRD && rk > .5) bird(clamp((rk - .5) / .3, 0, 1), T);
      } else {
        const rects = []; for (let k = 0; k < NSEG; k++) { const S = SEG[k], ff = k < seg ? S.L : k === seg ? fShow : 0; if (ff > 0) rects.push([S.a, S.a + S.d * ff, S.y]); }
        if (won) rects.push([-420, 420, -258]);
        if (dk > 0) for (const r of disasterRects(VAR)) rects.push([r[0], r[1], lerp(-420, r[2], dk)]);
        hairCut(rects, notches, true);
        if (dk > .9) { X.fillStyle = 'rgba(255,255,255,.75)'; const sp2 = VAR === 0 ? [-30, -236, 30, 7] : VAR === 1 ? [-6, -226, 8, 14] : [-56, -220, 22, 7]; el(sp2[0], sp2[1], sp2[2], sp2[3], -.2); X.fill(); }
        if (!g.result) dots(T);
      }
      X.restore();
      // tears / snip cloud / poof
      if (lost && rk > .25) tears(rk, a);
      if (lost && rk < .45) poof(rk, a, '#fff');
      if (won && rk < .4) poof(rk, a, '#ffe14d');
      cape(Math.floor(cutFill));
      // Caos the barber: holds up the hand mirror at the end
      caosBarber(T, won, lost, rk);
      // the sneeze warning (customer only): AH... AH... and where it will throw the head
      if (tw > 0) sneezeWarn(tw, SN[wi].dir, T, a);
      // scissors (mine = live, the friend's = interpolated, drawn on my own head)
      if (!g.result || rk < .4) {
        const hl = !!(fl & 1), en = !!(fl & 2), S = SEG[Math.min(seg, NSEG - 1)];
        const want = en || (hl && seg < NSEG) ? a + (S.d > 0 ? 0 : Math.PI) : -.75; sang += (want - sang) * .25;
        const op = en && !lost ? .5 + .5 * Math.abs(Math.sin(T * 22)) : hl ? .15 : .75;
        if (lost && rk >= 0) { scx += Math.sin(T * 40) * 20; sang += .4; }
        scissors(scx, scy, sang, op, 1, !cust && seg < NSEG && !g.result ? (en ? (level ? '#5CFF7A' : '#ff6b6b') : null) : null);
        if (!cust && !g.result && seg < NSEG && en && !level && T - waitAt < .5) badge('WAIT!', scx, scy - 54, 22, '#e8434f', '#fff', 1, -.05);
        if (cust && !g.result) { const under = scy < 160 || (scx > 540 && scy < 210); pill(scx, scy + (under ? 52 : -52), 'YOUR FRIEND', pCol(), under); }   // flips under the scissors near the top (never over the sign)
      }
      drawBits(T);
      for (const q of pops) { const k = T - q.t0; X.globalAlpha = k > .8 ? Math.max(0, 1 - (k - .8) / .3) : 1; badge(q.s, q.x, q.y - Math.min(k, .6) * 10, q.size, q.bgc, q.fg, k < .22 ? outBack(k / .22) : 1, q.rot); X.globalAlpha = 1; }
      if (cust && !g.result) pill(232, 452, 'YOU', myCol(), true);
      panel(T, a, tw, wi);
      vignette(.14);
    },
  };
  /* the dotted cut line on the hair: the current cut (both screens) and the NEXT one (only the barber knows where it goes) */
  function dots(T) {
    const one = (k, ghost) => {
      const S = SEG[k], ff = k === seg ? fShow : 0, x0 = S.a + S.d * ff, x1 = S.b;
      X.globalAlpha = ghost ? .55 : 1;
      X.setLineDash([12, 10]); X.lineDashOffset = -T * 30 * S.d;
      X.beginPath(); X.moveTo(x0, S.y); X.lineTo(x1, S.y); stroke(INK, ghost ? 6 : 9); X.beginPath(); X.moveTo(x0, S.y); X.lineTo(x1, S.y); stroke(ghost ? '#ffe9a6' : '#fff', ghost ? 3 : 4.5);
      X.setLineDash([]); X.lineDashOffset = 0;
      if (!ghost) {                                   // start / end markers + the direction arrow
        X.beginPath(); X.arc(x0, S.y, 7, 0, TAU); ink(level || cust ? '#5CFF7A' : '#ffe14d', 3);
        X.save(); X.translate(x1 + S.d * 12, S.y); X.scale(S.d, 1); X.beginPath(); X.moveTo(-6, -10); X.lineTo(8, 0); X.lineTo(-6, 10); X.closePath(); ink('#fff', 3); X.restore();
      } else { X.save(); X.translate(S.a - S.d * 30, S.y); X.rotate(0); txt('NEXT', 0, 4, 14, '#fff', 'center', 60); X.restore(); }
      X.globalAlpha = 1;
    };
    if (seg < NSEG) one(seg, false);
    if (!cust && seg + 1 < NSEG) one(seg + 1, true);
  }
  function bird(k, T) {                               // the 1-in-8 extra: a little bird moves into the pompadour
    const y = lerp(-520, -392, ease(k)), x = lerp(120, 30, ease(k));
    X.save(); X.translate(x, y + Math.abs(Math.sin(T * 8)) * (k < 1 ? 0 : 3));
    el(0, 0, 16, 13); ink('#ffd23f', 3); X.beginPath(); X.moveTo(14, -2); X.lineTo(24, 2); X.lineTo(14, 6); X.closePath(); ink('#ff9a4d', 2.5);
    X.fillStyle = INK; el(6, -4, 2.4, 2.4); X.fill(); X.beginPath(); X.moveTo(-6, -2); X.quadraticCurveTo(-14, -10 - Math.sin(T * 30) * 6 * (1 - k), -2, -8); stroke(INK, 3);
    X.restore();
    if (k >= 1) badge('TWEET!', x + 60, y - 30, 16, '#4DB8FF', '#fff', 1, .1);
  }
  function tears(rk, a) {                             // two fountains of tears from the closed eyes
    for (const s of [-1, 1]) {
      const [ex, ey] = toScreen(s * 40, -140, a);
      for (let i = 0; i < 6; i++) { const q = ((rk * 1.8 + i / 6) % 1), x = ex + s * (20 + q * 90), y = ey - 10 + q * (q * 160 - 50); X.globalAlpha = 1 - q * .6; el(x, y, 6 - q * 2, 8 - q * 2); ink('#8fdcff', 2); }
    }
    X.globalAlpha = 1;
  }
  function poof(rk, a, col) {                         // a quick cloud of snips (hides the change of hairdo)
    const k = rk / .4, [cx, cy] = toScreen(0, -280, a); if (k >= 1) return;
    X.globalAlpha = 1 - k;
    for (let i = 0; i < 7; i++) { const an = i * TAU / 7 + rk * 3, r = 60 + 80 * k; X.beginPath(); X.arc(cx + Math.cos(an) * r, cy + Math.sin(an) * r * .6, 26 * (1 - k * .5), 0, TAU); ink(col, 3); }
    X.globalAlpha = 1;
    if (col !== '#fff') for (let i = 0; i < 5; i++) spark(cx + Math.cos(i * 1.3) * 120 * k, cy + Math.sin(i * 1.3) * 80 * k, 14 * (1 - k));
  }
  function sneezeWarn(tw, dir, T, a) {
    const [nx, ny] = toScreen(-dir * 120, -150, a), s = .8 + tw * .5, wob = Math.sin(T * 30) * 3 * tw;
    X.save(); X.translate(nx + wob, ny - 70); X.scale(s, s);
    X.beginPath(); X.moveTo(dir * 20, 22); X.lineTo(dir * 46, 44); X.lineTo(dir * 6, 26); X.closePath(); ink('#fff', 3);
    rr(-62, -26, 124, 52, 24); ink('#fff', 3.5);
    txt(tw < .5 ? 'AH...' : 'AH... AH...', 0, 2, 22, INK, 'center', 112);
    X.restore();
    // the side the ACHOO will throw the head to: a fat red arc arrow beside the head, pointing the way it will fall
    const a0 = a - Math.PI / 2 + dir * .74, a1 = a - Math.PI / 2 + dir * 1.12, R0 = 262, pulse = .6 + .4 * Math.abs(Math.sin(T * 10));
    X.save(); X.translate(PX, PY); X.globalAlpha = pulse;
    X.beginPath(); X.arc(0, 0, R0, a0, a1, dir < 0); stroke(INK, 20); X.beginPath(); X.arc(0, 0, R0, a0, a1, dir < 0); stroke('#ff4d5e', 11);
    X.save(); X.translate(Math.cos(a1) * R0, Math.sin(a1) * R0); X.rotate(a1 + (dir > 0 ? Math.PI / 2 : -Math.PI / 2)); X.beginPath(); X.moveTo(-6, -17); X.lineTo(20, 0); X.lineTo(-6, 17); X.closePath(); ink('#ff4d5e', 3.5); X.restore();
    X.restore(); X.globalAlpha = 1;
  }
  function caosBarber(T, won, lost, rk) {
    const col = cust ? pCol() : myCol(), bob = won ? Math.abs(Math.sin(T * 9)) * 12 : 0, hm = rk >= 0 ? ease((rk - .3) / .2) : 0;
    X.save(); X.translate(CLX, CLY - bob);
    shadow(0, 2 + bob, 44, 7, .25);
    if (rk >= 0) {                                    // the payoff: the hand mirror rises in the raised left hand (drawn first: the hand grips the handle)
      const an = -.9 * hm, d = 30.2, hx = -6.6 * 6.5 + d * Math.sin(an), hy = -5.2 * 6.5 - d * Math.cos(an);
      handMirror(hx - 13.9 * hm, hy - 68.6 * hm, hm, won, T);
    }
    if (rk >= 0) arms(6.5, -.9 * hm, won ? .5 + Math.sin(T * 14) * .3 : .9, 1, col);
    else { const sw = fl & 2 ? Math.sin(T * 14) * .2 : 0; arms(6.5, -.5 + sw, .35, 1, col); }
    caos(0, 0, 6.5, { col, mood: won ? 'happy' : lost ? 'sad' : T - slipAt < .8 ? 'sad' : null });
    if (rk < 0) {                                     // a comb in the raised right hand
      X.save(); X.translate(6.6 * 6.5 + 2, -5.2 * 6.5 - 32); X.rotate(.35); rr(-6, -26, 12, 40, 3); ink('#2b2b3a', 2.5); X.fillStyle = '#2b2b3a'; for (let i = 0; i < 5; i++) X.fillRect(6, -22 + i * 7, 8, 3); X.restore();
    }
    if (lost || T - slipAt < .8) { X.globalAlpha = .9; const dy = (T * 50) % 22; el(-34, -66 + dy, 5, 8); ink('#9fe3ff', 2.5); X.globalAlpha = 1; }
    X.restore();
    if (!cust) pill(CLX, CLY + 22, 'YOU', myCol(), true);
  }
  function drawBits(T) {                              // hair tufts (curly crescents) and sneeze droplets
    for (const b of bits) {
      const k = T - b.t0, fade = k > b.life * .7 ? 1 - (k - b.life * .7) / (b.life * .3) : 1; X.globalAlpha = clamp(fade, 0, 1);
      if (b.sh === 0) { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); X.beginPath(); X.arc(0, 0, b.r, 0, 2.6); X.lineWidth = 8; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 4; X.strokeStyle = HAIR; X.stroke(); X.restore(); }
      else { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink('#bfeeff', 1.5); }
    }
    X.globalAlpha = 1;
  }
  function scoreboard(T) {                            // a wooden sign: 3 cuts to make, 3 slips allowed
    const x0 = 592, y0 = 68, w = 190, h = 66, cx = x0 + w / 2, sw = Math.sin(T * 1.3) * .012;
    X.save(); X.translate(cx, 40); X.rotate(sw); X.translate(-cx, -40);
    for (const sx of [x0 + 26, x0 + w - 26]) { X.beginPath(); X.moveTo(sx, 40); X.lineTo(sx, y0 + 6); stroke(INK, 7); X.beginPath(); X.moveTo(sx, 40); X.lineTo(sx, y0 + 6); stroke('#e6c58c', 3); }
    rr(x0, y0 + 5, w, h, 14); ink('#a5622c', 5); rr(x0, y0, w, h, 14); ink('#d9944f', 5);
    X.fillStyle = 'rgba(255,255,255,.22)'; rr(x0 + 8, y0 + 5, w - 16, 7, 3); X.fill();
    for (let i = 0; i < NSEG; i++) {
      const px = x0 + 28 + i * 40, py = y0 + 33, done = i < seg || g.result === 'win';
      X.beginPath(); X.arc(px, py, 16, 0, TAU); ink(done ? '#5CFF7A' : i === seg && !g.result ? '#fff3cf' : '#f1e3c8', 3);
      if (done) { X.beginPath(); X.moveTo(px - 8, py); X.lineTo(px - 2, py + 7); X.lineTo(px + 9, py - 7); stroke(INK, 4.5); }
      else { X.save(); X.globalAlpha = .55; scissors(px + 10, py - 2, -.6, .7, .2, null); X.restore(); }
    }
    X.fillStyle = INK; X.fillRect(x0 + 134, y0 + 12, 4, h - 24);
    for (let i = 0; i < MAXSLIP; i++) {
      const on = i < slips, cy = y0 + 15 + i * 18, cxs = x0 + 162, n = notches[i], k = on && n ? outBack((T - n.at) / .3) : 1;
      X.save(); X.translate(cxs, cy); X.scale(k, k); X.beginPath(); X.arc(0, 0, 8, 0, TAU); ink(on ? '#ff6b6b' : 'rgba(255,240,220,.6)', 2.2);
      if (on) { X.beginPath(); X.moveTo(-4, -4); X.lineTo(4, 4); X.moveTo(4, -4); X.lineTo(-4, 4); stroke(INK, 2.6); }
      X.restore();
    }
    X.restore();
  }
  function cue(T, tw, wi) {                           // the customer's sneeze cue: [0 none / 1 GET READY / 2 LEAN NOW!, the side to lean to]
    let brace = 0, bdir = 0;
    if (wi >= 0 && tw > .3) { brace = SN[wi].t - T < NOWW ? 2 : 1; bdir = -SN[wi].dir; }
    for (let i = 0; i < SN.length; i++) if (snAt[i] >= 0 && T - snAt[i] < .3) { brace = 2; bdir = -SN[i].dir; }
    return [brace, bdir];
  }
  function panel(T, a, tw, wi) {                      // the spirit level (the bubble runs to the high side) + my controls
    const w = 300, x0 = LVX - w / 2, y0 = LVY - 22, done = !!g.result;
    X.save(); if (done) X.globalAlpha = Math.max(0, .8 - (resAt >= 0 ? (g.c - resAt) * 2 : 0)); if (X.globalAlpha <= 0) { X.restore(); return; }
    rr(x0, y0 + 5, w, 44, 14); ink('#c99512', 4); rr(x0, y0, w, 44, 14); ink('#ffd23f', 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; rr(x0 + 10, y0 + 5, w - 20, 7, 3); X.fill();
    rr(LVX - 80, y0 + 10, 160, 24, 12); ink('#d8ffb0', 3);
    const lv = Math.abs(a) < LEVEL, tol = LEVEL / .5 * 66;
    X.fillStyle = lv ? 'rgba(92,255,122,.6)' : 'rgba(92,255,122,.25)'; X.fillRect(LVX - tol, y0 + 12, tol * 2, 20);
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(LVX - tol, y0 + 10); X.lineTo(LVX - tol, y0 + 34); X.moveTo(LVX + tol, y0 + 10); X.lineTo(LVX + tol, y0 + 34); X.stroke();
    const bx = LVX - clamp(a / .5, -1, 1) * 66; el(bx, y0 + 22, 13, 8); ink('rgba(255,255,255,.9)', 2.5);
    if (cust && !done) {
      const mk = LVX + ctrlT / CMAX * (w / 2 - 14);       // where my hand is
      X.beginPath(); X.moveTo(mk, y0 - 2); X.lineTo(mk - 9, y0 - 16); X.lineTo(mk + 9, y0 - 16); X.closePath(); ink(myCol(), 3);
      // a sneeze coming: GET READY (keep level, it is not time yet) ... then LEAN NOW! right at the ACHOO (leaning early tips a level head off the line)
      const [brace, bdir] = cue(T, tw, wi);
      const lean = brace ? bdir : Math.abs(a) > LEVEL ? -Math.sign(a) : 0;
      if (!TOUCH) { keyCap(x0 - 34, y0 + 22, '◄'); keyCap(x0 + w + 34, y0 + 22, '►'); }
      const col = brace === 2 ? '#ff4d5e' : brace ? '#ffb3ba' : lv && !lean ? '#5CFF7A' : '#fff';
      const word = brace === 2 ? 'LEAN NOW!' : brace ? 'GET READY' : lv ? 'LEVEL!' : 'LEAN', big = brace === 2 ? 1.05 + .08 * Math.abs(Math.sin(T * 20)) : 1;
      X.save(); X.translate(LVX, y0 - 30); X.scale(big, big); txt(word, 0, 0, 22, col, 'center', 150); X.restore();
      if (lean && !(lv && !brace)) {
        X.globalAlpha = brace === 1 ? .7 : .55 + .45 * Math.abs(Math.sin(T * 9));
        txt(lean < 0 ? '◄' : '►', LVX + lean * (brace === 2 ? 104 : brace ? 90 : 52) + (brace === 1 ? 0 : 6 * Math.sin(T * 12)), y0 - 26, brace === 2 ? 36 : 30, col); X.globalAlpha = 1;
      }
    } else if (!done) {
      txt(lv ? 'CUT!' : 'WAIT!', LVX, y0 - 30, 22, lv ? '#5CFF7A' : '#ff8a94', 'center', 200);
      if (!TOUCH && T < 4) { keyCap(x0 - 50, y0 + 22, 'SPACE'); txt('+', x0 - 14, y0 + 30, 22, '#fff'); }
    }
    X.restore();
  }
  g.dbg = {
    SEG, N: NSEG,
    tilt: () => th,                                                                            // the customer: how my head leans (the spirit level)
    warn: () => { for (let i = 0; i < SN.length; i++) { const u = SN[i].t - g.c; if (u > 0 && u < WARN) return { on: true, i, dir: SN[i].dir, left: u }; } return { on: false }; },
    cue: () => { let tw = 0, wi = -1; if (!g.result) for (let i = 0; i < SN.length; i++) { const u = SN[i].t - g.c; if (u > 0 && u < WARN) { tw = 1 - u / WARN; wi = i; } } const [k, dir] = cue(g.c, tw, wi); return { k, dir }; },   // the panel's words: GET READY (1) / LEAN NOW! (2) and which way
    view: () => ({ a: angR(), seen: thSeen, seg, f, eng, hold, slips, tip: tip.slice(), level: Math.abs(angR()) < LEVEL && thSeen }),   // the barber: the line as drawn, my scissors
    scr: (x, y) => toScreen(x, y, angR()),
    slips: () => slips, seg: () => seg,
  };
  wire(g, D, 1, sp, 'du_barber');
  return g;
}
reg('du_barber', duBarber, 'BARBER BALANCE'); REGMAP.du_barber.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 3.6 s loop ───────────── */
let DBG = null;
function buildDemoBg() {
  const c2 = document.createElement('canvas'); c2.width = 520; c2.height = 240; const old = X; X = c2.getContext('2d');
  const gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#8fe0c4'); gr.addColorStop(1, '#bff2df'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = 'rgba(255,255,255,.28)'; for (let x = 0; x < 520; x += 40) X.fillRect(x, 0, 16, 240);
  X.fillStyle = '#b8743f'; X.fillRect(0, 196, 520, 44); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 196); X.lineTo(520, 196); X.stroke();
  X = old; return c2;
}
function demo(role, t) {
  X = ctx; if (!DBG) DBG = buildDemoBg(); X.drawImage(DBG, 0, 0);
  const u = t % 3.6, cx = 200, cy = 236, s = .5;
  // role 0: the head droops, the finger slides the other way and it comes back level. role 1: level head, scissors slide along the dots
  const lean = role === 0 ? .4 * Math.cos(Math.min(u, 1.8) / 1.8 * Math.PI / 2) * (u < 1.8 ? 1 : 0) + (u >= 1.8 ? 0 : 0) : Math.sin(t * 2) * .03;
  const cut = role === 1 ? clamp((u - .3) / 2.4, 0, 1) : 0;
  X.save(); X.translate(cx, cy); X.scale(s, s); X.rotate(lean);
  head({ mood: role === 0 && u < 1.6 ? 'worry' : 'idle', T: t, look: [role ? .8 : 0, -.6] });
  hairCut(cut > 0 ? [[-146, -146 + 292 * cut, -270]] : [], [], false);
  X.setLineDash([12, 10]); X.beginPath(); X.moveTo(-146 + 292 * cut, -270); X.lineTo(146, -270); stroke(INK, 9); X.beginPath(); X.moveTo(-146 + 292 * cut, -270); X.lineTo(146, -270); stroke('#fff', 4.5); X.setLineDash([]);
  X.restore();
  // spirit level
  rr(360, 20, 140, 30, 10); ink('#ffd23f', 3); rr(395, 27, 70, 16, 8); ink('#d8ffb0', 2.5); const bxl = 430 - clamp(lean / .5, -1, 1) * 30; el(bxl, 35, 8, 5); ink('#fff', 2);
  txt(Math.abs(lean) < LEVEL ? 'LEVEL!' : 'LEAN', 430, 72, 20, Math.abs(lean) < LEVEL ? '#5CFF7A' : '#fff');
  if (role === 0) {
    const fx = 430 - lean / .4 * 36; demoFinger(fx, 150, true, 0); txt('◄', 352, 160, 36, '#fff'); txt('►', 508, 160, 36, '#fff');   // the arrows over the finger
  } else {
    const [x, y] = [cx + (-146 + 292 * cut) * s, cy - 270 * s];
    scissors(x, y, 0, .5 + .5 * Math.abs(Math.sin(t * 20)), .7, null); demoFinger(x - 50, y + 40, cut > 0 && cut < 1, 0);
    txt('HOLD + DRAG', 430, 160, 22, '#fff', 'center', 160);
  }
}
DUO.INFO.du_barber = [['CUSTOMER', 'KEEP YOUR HEAD LEVEL', 'LEAN LEFT / RIGHT'], ['BARBER', 'CUT ALONG THE DOTS', 'HOLD + DRAG THE SCISSORS']];
DUO.DEMOS.du_barber = [t => demo(0, t), t => demo(1, t)];

})();
