'use strict';
/* ═════════ DUO · WOBBLE WALK (du_legs) ═════════
   A tall Caos on two long wobbly legs has to cross a river over 6 stepping stones. Each player IS one leg:
   LEFT LEG (role 0, JUDGE) and RIGHT LEG (role 1). Hold to lift your leg (the foot swings forward and a dotted marker shows where
   it would land), let go to put it down. The reach is measured from the OTHER foot (capped at MAXS), so one leg alone gets nowhere:
   the legs have to take turns. Water = SPLOOSH and that foot goes back to its stone. Both legs up for more than GRACE s = Caos
   faceplants into the river (stunned, the front foot goes back one stone). Both feet on the far bank = win.
   Netcode (events only): 'up' [epoch, anchor, otherAnchor] when a leg lifts, 'pl' [epoch, x, ok, clock] when it comes down: the acting
   player decides where it landed and whether that was a stone. The partner replays the swing locally from 'up' with the same
   formula (it has the same lag as the 'pl' that ends it, so the marker is smooth and lands where the partner saw it land).
   The body pose is computed only from the planted feet, so both screens draw the same Caos. The judge (left leg) watches for both
   legs up (GRACE covers late packets), sends 'fall' [epoch, foothold] and checks the win; 'up'/'pl' sent before a fall carry an
   older epoch and are ignored. At the time limit the judge waits up to .25 s (END_SLACK .6 - lag) for a friend's leg that is still up (its last step may be
   on the way) and accepts that plant only if it was stamped before the limit. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const t2 = s => t(s);             // the translator, for places where t is the demo clock
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const easeOut = k => { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k); };
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const okHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MIXC = {}, mix = (a, b, k) => { const key = a + b + k; if (MIXC[key]) return MIXC[key]; const A = rgb(a), B = rgb(b); return (MIXC[key] = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')); };
const dark = (c, k) => mix(c, '#2a1740', k), lite = (c, k) => mix(c, '#ffffff', k);

/* ───────────── layout (800×600; the HUD keeps y<58, the top-left box x<320 & y<150, the top-right corner and y>552) ───────────── */
const GY = 452;                 // the top of the stones and the banks: where the soles stand
const WY = 478;                 // water surface
const ANK = 23;                 // ankle height above the sole
const LEG = 100;                // thigh = shin
const REACH = 188;              // hip to ankle when standing (knees a bit bent)
const HIPX = 16;                // each hip sits this far from the body centre
const MAXS = 225;               // a swinging foot can land at most this far ahead of the other foot
const LEN = 9;                  // landing lenience past a stone edge
const V0 = 400;                 // swing speed (px/s) at sp 1
const DWL = WY + 36;            // the faceplant dunks in the foreground water, in front of the stones, so the X-X face reads at this waterline
const GRACE = .42, STUN = .85, WET = .34, NST = 6, SCRX = 330, GO0 = .15;   // GO0: the first lift is allowed after this (a press before it is queued)
const BTN = [[84, 500], [716, 500]], BR = 40;   // hold indicators: left leg bottom-left, right leg bottom-right (over the foreground water, under the stone row)
const PILLX = [196, 604];                        // the foot name tags stay between the two buttons

/* palette */
const OR = '#FF6B3D', ORS = '#b4553a', ORL = '#f3a283';
const GRASS = '#6fd660', GRASSL = '#b2f27f', GRASSS = '#3fa64a', DIRT = '#c98a55', DIRTS = '#9a6238', DIRTL = '#e3ac74';
const STONE = '#bab4d8', STONES = '#8c85b4', STONEL = '#e6e3f6', MOSS = '#82d460', MOSSS = '#4fa845';
const WAT0 = '#5fd2f7', WAT1 = '#2f9fe3', WAT2 = '#1f6fc0', FOAM = '#d9f7ff';
const GO = '#5CFF7A', NO = '#ff5a6e', YEL = '#FFE14D';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4, col = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4, col = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
/* cel shading with a shifted copy of the same shape: base on top, the shade shows as a crescent on the (sx, sy) side */
function cel(p, base, shade, sx, sy, o = 4, col = INK) { inkP(p, shade, o, col); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function line(a, b, c, d) { X.beginPath(); X.moveTo(a, b); X.lineTo(c, d); X.stroke(); }
const mkC = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function onto(c, f) { const prev = X; X = c.getContext('2d'); try { f(); } finally { X = prev; } return c; }
function pill(x, y, label, col, size = 17, px = x, up = false) {   // a name tag with a little pointer (under it, or above it when up)
  X.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const s = t(label), w = Math.min(150, X.measureText(s).width + 24), h = size + 10, d = up ? -1 : 1;
  if (px !== null) { X.beginPath(); X.moveTo(px - 8, y + d * (h / 2 - 2)); X.lineTo(px, y + d * (h / 2 + 9)); X.lineTo(px + 8, y + d * (h / 2 - 2)); X.closePath(); ink(col, 3); }
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); txt(label, x, y + 1, size, INK, 'center', w - 12);
}

/* ───────────── the walker: Caos's blocky body on two long jointed legs ───────────── */
const SHOE = 'M-24,10 C-27,-4 -18,-12 -8,-11 L4,-10 C14,-9 22,-2 33,4 C43,8 43,15 36,16 L-22,16 C-27,16 -27,13 -24,10 Z';
const SOLE = 'M-28,13 L41,13 C46,13 46,23 40,23 L-24,23 C-30,23 -31,14 -28,13 Z';
const TOE = 'M26,2 C36,6 41,9 40,13 L23,13 C22,8 23,5 26,2 Z';
function shoe(x, y, r, sc, col) {
  X.save(); X.translate(x, y); X.rotate(r); X.scale(sc, sc);
  const o = 4.5; inkP(P(SOLE), '#fff6e6', o);
  cel(P(SHOE), col, dark(col, .28), -3, -4, o);
  X.save(); X.clip(P(SHOE)); X.fillStyle = lite(col, .35); X.fill(P(TOE)); X.restore();
  X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineCap = 'round'; X.beginPath(); X.moveTo(-15, 8); X.bezierCurveTo(-4, 3, 8, 3, 18, 9); X.stroke();   // swoosh
  X.strokeStyle = INK; X.lineWidth = 2.6; line(-3, -6, 3, -1); line(4, -5, 10, 0);                                                             // laces
  X.fillStyle = dark(col, .5); el(-12, -9, 8, 3.2, -.1); X.fill();                                                                                // collar
  X.fillStyle = 'rgba(255,255,255,.55)'; el(-14, -3, 5, 2.4, -.5); X.fill();
  X.fillStyle = '#e8dccb'; X.fillRect(-26, 19, 64, 3);
  X.restore();
}
/* one leg: hip H -> knee K -> ankle A; a long stocking in the player's colour, a sporty sock, a kneepad, a big sneaker */
function legDraw(hx, hy, ax, ay, r, sc, col, flip) {
  const L = LEG * sc, dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy) || 1, th = Math.atan2(dy, dx);
  let kx, ky;
  if (d >= 2 * L) { kx = hx + dx / 2; ky = hy + dy / 2; }
  else { const a = Math.acos(d / (2 * L)) * (flip ? -1 : 1); kx = hx + Math.cos(th - a) * L; ky = hy + Math.sin(th - a) * L; }
  const w1 = 21 * sc, w2 = 17 * sc, o = Math.max(2.5, 4.5 * sc);
  X.lineCap = 'round'; X.lineJoin = 'round'; X.strokeStyle = INK;
  X.lineWidth = w1 + 2 * o; line(hx, hy, kx, ky); X.lineWidth = w2 + 2 * o; line(kx, ky, ax, ay);
  X.strokeStyle = col; X.lineWidth = w1; line(hx, hy, kx, ky); X.lineWidth = w2; line(kx, ky, ax, ay);
  const bone = (x0, y0, x1, y1, w) => {                  // cylinder look: a shade stripe on one side, a light one on the other
    const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
    X.strokeStyle = dark(col, .3); X.lineWidth = w * .3; line(x0 - nx * w * .28, y0 - ny * w * .28, x1 - nx * w * .28, y1 - ny * w * .28);
    X.strokeStyle = lite(col, .45); X.lineWidth = w * .2; line(x0 + nx * w * .22, y0 + ny * w * .22, x1 + nx * w * .22, y1 + ny * w * .22);
  };
  bone(hx, hy, kx, ky, w1); bone(kx, ky, ax, ay, w2);
  const sk = (k0, k1, c) => { X.strokeStyle = c; X.lineWidth = w2; X.lineCap = 'butt'; line(lerp(kx, ax, k0), lerp(ky, ay, k0), lerp(kx, ax, k1), lerp(ky, ay, k1)); X.lineCap = 'round'; };
  sk(.6, 1, '#fff8ec'); sk(.66, .72, col); sk(.78, .84, col);                           // sock with two stripes
  X.beginPath(); X.arc(kx, ky, 11.5 * sc, 0, TAU); ink(lite(col, .2), o * .8);
  X.fillStyle = 'rgba(255,255,255,.6)'; X.beginPath(); X.arc(kx - 3.5 * sc, ky - 3.5 * sc, 3.6 * sc, 0, TAU); X.fill();
  shoe(ax, ay, r, sc, col);
}
/* body, local coords: origin = middle of the hips, the block sits above it. mood: idle|focus|strain|whoa|dizzy|happy|sad */
function body(p, sc) {
  X.save(); X.translate(p.hx, p.hy); X.rotate(p.rot || 0); X.scale(sc, sc * (p.sq || 1));
  const o = 5, fl = p.flail || 0, up = p.armsUp || 0, tt = now;
  // the mascot's two outer stubby legs dangle under the block
  for (const [x, ph] of [[-40, 0], [30, 2]]) { X.save(); X.translate(x + 5, -2); X.rotate(Math.sin(tt * (fl ? 22 : 3) + ph) * (fl ? .5 : .08)); rr(-5, -2, 10, 15, 2); ink(OR, 4); X.restore(); }
  // arms: hang, flail when wobbling, shoot up when cheering
  for (const s of [-1, 1]) {
    X.save(); X.translate(s * 48, -27); X.rotate(s * (-up * (1.15 + Math.sin(tt * 16 + s * 1.5) * .45) + fl * Math.sin(tt * 26 + s) * .9 - fl * .5));
    rr(s < 0 ? -16 : 0, -9, 16, 19, 3); ink(OR, o); X.fillStyle = ORS; X.fillRect(s < 0 ? -16 : 0, 6, 16, 4); X.restore();
  }
  rr(-48, -56, 96, 56, 6); ink(OR, o);
  X.save(); rr(-48, -56, 96, 56, 6); X.clip(); X.fillStyle = ORS; X.fillRect(-60, -11, 120, 14); X.fillRect(38, -60, 14, 70);
  X.fillStyle = ORL; rr(-42, -51, 34, 7, 3.5); X.fill(); rr(-42, -51, 7, 22, 3.5); X.fill(); X.restore();
  // face
  const lk = (p.look || 0) * 4, ey = -33, ex = [-22 + lk, 22 + lk], m = p.mood || 'idle';
  X.fillStyle = INK; X.strokeStyle = INK; X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = 4.4;
  if (m === 'happy') { for (const e of ex) { X.beginPath(); X.moveTo(e - 7, ey + 5); X.lineTo(e, ey - 4); X.lineTo(e + 7, ey + 5); X.stroke(); } X.beginPath(); X.moveTo(-10 + lk, -16); X.quadraticCurveTo(lk, -4, 10 + lk, -16); X.closePath(); X.fillStyle = INK; X.fill(); X.fillStyle = '#ff7a8c'; el(lk, -10, 5, 2.6); X.fill(); }
  else if (m === 'sad' || m === 'dizzy') {
    if (m === 'dizzy') for (const e of ex) { X.beginPath(); for (let a = 0; a < 9; a += .5) X.lineTo(e + Math.cos(a + tt * 12) * a * .9, ey + Math.sin(a + tt * 12) * a * .9); X.lineWidth = 3; X.stroke(); }
    else for (const e of ex) { line(e - 6, ey - 6, e + 6, ey + 6); line(e + 6, ey - 6, e - 6, ey + 6); }
    X.lineWidth = 4; X.beginPath(); X.moveTo(-9 + lk, p.inv ? -16 : -12); X.quadraticCurveTo(lk, p.inv ? -6 : -20, 9 + lk, p.inv ? -16 : -12); X.stroke();   // upside down, a local smile reads as a frown
  } else if (m === 'whoa') {
    const j = Math.sin(tt * 40) * 1.5;
    for (const e of ex) { X.beginPath(); X.arc(e, ey, 10, 0, TAU); ink('#fff', 3); X.fillStyle = INK; X.beginPath(); X.arc(e + lk * .6 + j, ey + 1, 4.5, 0, TAU); X.fill(); }
    X.beginPath(); X.ellipse(lk, -13, 6, 7.5, 0, 0, TAU); X.fillStyle = INK; X.fill();
    X.fillStyle = '#aee8ff'; X.beginPath(); X.moveTo(52, -50); X.quadraticCurveTo(60, -38, 52, -34); X.quadraticCurveTo(44, -38, 52, -50); X.fill(); X.strokeStyle = INK; X.lineWidth = 2.5; X.stroke();
  } else if (m === 'strain') {
    for (const [e, s] of [[ex[0], 1], [ex[1], -1]]) { X.beginPath(); X.moveTo(e - 6 * s, ey - 7); X.lineTo(e + 6 * s, ey); X.lineTo(e - 6 * s, ey + 7); X.stroke(); }
    X.lineWidth = 3.5; line(-8 + lk, -14, 8 + lk, -14);
    X.fillStyle = '#aee8ff'; X.beginPath(); X.moveTo(-50, -50); X.quadraticCurveTo(-42, -40, -50, -36); X.quadraticCurveTo(-58, -40, -50, -50); X.fill(); X.strokeStyle = INK; X.lineWidth = 2.5; X.stroke();
  } else {
    const blink = (tt % 3.1) < .12 ? .2 : 1, h = 20 * blink;
    for (const e of ex) { rr(e - 5, ey - h / 2, 10, h, 3); X.fill(); }
    if (m === 'focus') { X.lineWidth = 3.2; for (const e of ex) line(e - 7, ey - 14, e + 6, ey - 12); }
  }
  X.restore();
}
/* the whole walker. p = { hx, hy, rot, sq, feet: [[x, y, r] left, [x, y, r] right], order: [back leg, front leg], mood, flail, armsUp, look } */
function walker(p, sc, cols) {
  const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0), hip = i => { const lx = (i ? HIPX : -HIPX) * sc, ly = -3 * sc; return [p.hx + lx * c - ly * s, p.hy + lx * s + ly * c]; };
  for (const i of p.order || [0, 1]) { const [hx, hy] = hip(i), f = p.feet[i]; legDraw(hx, hy, f[0], f[1], f[2], sc, cols[i], c < 0); }
  body(p, sc);
}

/* ───────────── scenery: sky, far mountains and hills are the same every round (cached once); the banks and stones per level ───────────── */
let SKY = null, MTN = null, HILL = null, CLOUD = null, WATG = null;
function stoneDraw(x0, w, top, bot, sd, sc = 1, wl = WY + 2) {   // a stepping stone, mossy, lit from the top-left; the part under water is tinted
  const r = 16 * sc, p = new Path2D();
  p.moveTo(x0 + 2 * sc, bot); p.bezierCurveTo(x0 - 6 * sc, top + 18 * sc, x0 + 2 * sc, top - 2 * sc, x0 + r, top - 3 * sc);
  p.bezierCurveTo(x0 + w * .4, top - 9 * sc, x0 + w * .6, top - 7 * sc, x0 + w - r, top - 3 * sc);
  p.bezierCurveTo(x0 + w + 2 * sc, top - 1 * sc, x0 + w + 6 * sc, top + 18 * sc, x0 + w - 2 * sc, bot); p.closePath();
  cel(p, STONE, STONES, -7 * sc, -9 * sc, 5 * sc);
  X.save(); X.clip(p);
  X.fillStyle = STONEL; X.beginPath(); X.ellipse(x0 + w * .38, top + 1 * sc, w * .3, 5 * sc, -.05, 0, TAU); X.fill();
  X.fillStyle = MOSS; X.beginPath(); X.ellipse(x0 + w * (.22 + sd * .2), top - 4 * sc, w * .2, 7 * sc, 0, 0, TAU); X.fill();
  X.fillStyle = MOSSS; X.beginPath(); X.ellipse(x0 + w * (.25 + sd * .2), top + 2 * sc, w * .14, 3 * sc, 0, 0, TAU); X.fill();
  X.strokeStyle = dark(STONE, .35); X.lineWidth = 2.5 * sc; X.lineCap = 'round'; X.beginPath(); X.moveTo(x0 + w * .7, top + 10 * sc); X.lineTo(x0 + w * .62, top + 20 * sc); X.lineTo(x0 + w * .7, top + 26 * sc); X.stroke();
  X.fillStyle = 'rgba(31,111,192,.45)'; X.fillRect(x0 - 10 * sc, wl, w + 20 * sc, bot - wl + 10);   // the part under water
  X.restore();
  X.lineJoin = 'round'; X.lineWidth = 5 * sc; X.strokeStyle = INK; X.stroke(p);
}
function buildSky() {
  SKY = onto(mkC(800, 600), () => {
    const g = X.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, '#3fb0ff'); g.addColorStop(.55, '#8fdcff'); g.addColorStop(1, '#e6fbff');
    X.fillStyle = g; X.fillRect(0, 0, 800, 600);
    for (const [r, a] of [[150, .1], [112, .14], [82, .2]]) { X.fillStyle = `rgba(255,248,200,${a})`; X.beginPath(); X.arc(652, 206, r, 0, TAU); X.fill(); }
    X.beginPath(); X.arc(652, 206, 46, 0, TAU); ink('#ffd84a', 5);
    X.save(); X.beginPath(); X.arc(652, 206, 46, 0, TAU); X.clip(); X.fillStyle = '#ffe98a'; X.beginPath(); X.arc(640, 194, 40, 0, TAU); X.fill(); X.restore();
    X.fillStyle = '#fffbe0'; el(634, 186, 12, 7, -.6); X.fill();
  });
  CLOUD = [[[0, 0, 30], [32, -14, 34], [66, -2, 28], [94, 6, 20], [-26, 8, 18]], [[0, 0, 24], [26, -12, 26], [52, 0, 20]], [[0, 0, 22], [24, -16, 28], [56, -6, 26], [82, 4, 18]]].map(puffs =>
    onto(mkC(200, 110), () => {
      X.translate(50, 70); const base = () => { X.beginPath(); for (const [x, y, r] of puffs) { X.moveTo(x + r, y); X.arc(x, y, r, 0, TAU); } };
      base(); X.lineWidth = 9; X.strokeStyle = '#3c6fb4'; X.lineJoin = 'round'; X.stroke(); X.fillStyle = '#cde9ff'; X.fill();
      X.save(); base(); X.clip(); X.translate(-4, -8); base(); X.fillStyle = '#fff'; X.fill(); X.restore();
    }));
  // far mountains: a pale lilac range with snow caps, soft violet outlines (atmospheric)
  MTN = onto(mkC(1300, 260), () => {
    const ranges = [[[[0, 150], [90, 70], [170, 120], [260, 40], [360, 115], [450, 60], [560, 130], [650, 50], [760, 120], [860, 64], [960, 128], [1060, 44], [1160, 112], [1300, 70]], '#c9d0fb', '#aab3f2', '#7b80c6'],
      [[[0, 200], [120, 110], [230, 180], [330, 95], [450, 170], [560, 100], [680, 185], [790, 105], [900, 175], [1010, 90], [1130, 165], [1230, 110], [1300, 150]], '#a4b1f2', '#8492e2', '#5b5fa8']];
    for (const [pts, base, shade, ol] of ranges) {
      X.beginPath(); X.moveTo(0, 260); for (const [x, y] of pts) X.lineTo(x, y); X.lineTo(1300, 260); X.closePath();
      X.lineWidth = 6; X.strokeStyle = ol; X.lineJoin = 'round'; X.stroke(); X.fillStyle = base; X.fill();
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i], [px, py] = pts[i - 1], [nx, ny] = pts[i + 1]; if (y > py || y > ny) continue;
        X.fillStyle = shade; X.beginPath(); X.moveTo(x, y); X.lineTo(nx, ny); X.lineTo(nx, 260); X.lineTo(x + (nx - x) * .25, 260); X.closePath(); X.fill();
        if (y < 110) { X.fillStyle = '#f6f8ff'; X.beginPath(); X.moveTo(x, y); const k = .3; X.lineTo(x + (nx - x) * k, y + (ny - y) * k); X.lineTo(x + (nx - x) * k * .5, y + (ny - y) * k * .8); X.lineTo(x, y + (ny - y) * k * .55); X.lineTo(x - (x - px) * k * .5, y + (py - y) * k * .8); X.lineTo(x - (x - px) * k, y + (py - y) * k); X.closePath(); X.fill(); }
      }
    }
  });
  // hills: two rows of rolling green with lollipop trees, then the far shore of the river (reeds) down to the water line
  HILL = onto(mkC(1700, 200), () => {
    const OL = '#2f7a49', hill = (pts, base, shade) => {
      X.beginPath(); X.moveTo(0, 200); X.lineTo(0, pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; X.quadraticCurveTo(x0 + (x1 - x0) / 2, Math.min(y0, y1) - 34, x1, y1); }
      X.lineTo(1700, 200); X.closePath(); X.lineWidth = 8; X.strokeStyle = OL; X.lineJoin = 'round'; X.stroke(); X.fillStyle = shade; X.fill();
      X.save(); X.clip(); X.translate(-10, -9); X.fill(); X.fillStyle = base; X.fill(); X.restore();
    };
    const tree = (x, y, s) => {
      X.lineWidth = 8 * s; X.strokeStyle = OL; X.lineCap = 'round'; line(x, y, x, y - 34 * s); X.lineWidth = 4 * s; X.strokeStyle = '#8a5a3c'; line(x, y, x, y - 34 * s);
      X.beginPath(); X.arc(x, y - 46 * s, 22 * s, 0, TAU); ink('#3bb35a', 3.5 * s, OL); X.fillStyle = '#7be07d'; X.beginPath(); X.arc(x - 7 * s, y - 53 * s, 9 * s, 0, TAU); X.fill();
    };
    hill([[0, 70], [230, 50], [470, 80], [700, 40], [960, 75], [1200, 46], [1450, 72], [1700, 52]], '#9be38a', '#78cc72');
    for (const [x, y, s] of [[120, 74, .8], [160, 80, .6], [520, 86, .9], [820, 72, .7], [1050, 82, .85], [1090, 86, .6], [1500, 80, .8]]) tree(x, y, s);
    hill([[0, 120], [180, 96], [420, 126], [650, 92], [900, 124], [1150, 98], [1400, 128], [1700, 100]], '#7cd46f', '#5cbc5e');
    for (const [x, y, s] of [[60, 128, 1.05], [300, 120, .95], [340, 126, .75], [760, 118, 1.1], [980, 128, .9], [1260, 120, 1], [1300, 126, .7], [1620, 124, 1]]) tree(x, y, s);
    X.fillStyle = '#4fae55'; X.fillRect(0, 150, 1700, 50); X.fillStyle = OL; X.fillRect(0, 148, 1700, 4);
    X.lineCap = 'round';
    for (let x = 8; x < 1700; x += 23 + (x * 7 % 17)) {   // reeds and cattails on the far shore
      const h = 16 + (x * 13 % 22); X.strokeStyle = '#2f8a45'; X.lineWidth = 4; line(x, 192, x + 3, 192 - h);
      if (x % 3 === 0) { X.strokeStyle = OL; X.lineWidth = 9; line(x + 3, 186 - h, x + 3, 178 - h); X.strokeStyle = '#8a5a3c'; X.lineWidth = 6; line(x + 3, 186 - h, x + 3, 178 - h); }
    }
  });
}
/* the per-level world layer: start bank (with the sign), the stones, the far bank (trees, the goal flag pole), reflections */
const WX0 = -420, WYT = 180;
function buildWorld(F, B0, B1) {
  const w = Math.ceil(B1 + 700 - WX0), c = mkC(w, 600 - WYT);
  return onto(c, () => {
    X.translate(-WX0, -WYT);
    // reflections of the stones in the water (under everything)
    for (const s of F) if (!s.bank) { X.fillStyle = 'rgba(30,60,140,.28)'; X.beginPath(); X.ellipse(s.c, WY + 30, s.w * .52, 22, 0, 0, TAU); X.fill(); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(s.x0 + 6, WY + 40, s.w - 12, 3); X.fillRect(s.x0 + 14, WY + 50, s.w - 28, 3); }
    const bank = (xa, xb, edge, dir) => {   // dir -1: the bank's edge is on its right (start), +1: on its left (far side)
      const e = edge, p = new Path2D();
      if (dir < 0) { p.moveTo(xa, GY - 2); p.lineTo(e - 26, GY - 2); p.bezierCurveTo(e - 4, GY - 2, e + 4, GY + 14, e + 2, GY + 34); p.bezierCurveTo(e + 1, WY + 10, e + 18, WY + 30, e + 26, 600); p.lineTo(xa, 600); }
      else { p.moveTo(xb, GY - 2); p.lineTo(e + 26, GY - 2); p.bezierCurveTo(e + 4, GY - 2, e - 4, GY + 14, e - 2, GY + 34); p.bezierCurveTo(e - 1, WY + 10, e - 18, WY + 30, e - 26, 600); p.lineTo(xb, 600); }
      p.closePath();
      cel(p, DIRT, DIRTS, 0, -10, 5);
      X.save(); X.clip(p);
      X.fillStyle = DIRTS; for (let y = GY + 40; y < 600; y += 34) { X.beginPath(); X.moveTo(xa, y); for (let x = xa; x <= xb; x += 40) X.quadraticCurveTo(x + 20, y + (x / 40 % 2 ? 8 : -6), x + 40, y); X.lineTo(xb, y + 6); X.lineTo(xa, y + 6); X.closePath(); X.fill(); }
      for (let i = 0, x = xa + 30; x < xb; x += 57 + (i * 23 % 31), i++) { X.beginPath(); X.ellipse(x, GY + 54 + (i * 37 % 80), 9, 6, 0, 0, TAU); ink(DIRTL, 2.5); }
      // grass lip: a wavy band hanging over the dirt
      const g = new Path2D(); g.moveTo(xa, GY - 8);
      g.lineTo(xb, GY - 8); g.lineTo(xb, GY + 12);
      for (let x = xb; x > xa; x -= 18) g.quadraticCurveTo(x - 9, GY + 26, x - 18, GY + 12);
      g.closePath(); X.fillStyle = GRASS; X.fill(g); X.strokeStyle = GRASSS; X.lineWidth = 4; X.stroke(g);
      X.fillStyle = GRASSL; X.fillRect(xa, GY - 8, xb - xa, 6);
      X.restore();
      X.lineWidth = 5; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke(p);
      // tufts and flowers on top
      X.lineCap = 'round';
      for (let i = 0, x = xa + 14; x < xb - 10; x += 34 + (i * 19 % 23), i++) {
        X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(x - 6, GY - 2); X.lineTo(x - 9, GY - 14); X.moveTo(x, GY - 2); X.lineTo(x, GY - 18); X.moveTo(x + 6, GY - 2); X.lineTo(x + 10, GY - 13); X.stroke();
        X.strokeStyle = GRASS; X.lineWidth = 3.5; X.stroke();
        if (i % 3 === 1) { const fc = ['#ff8fc2', '#fff27a', '#ffffff'][i % 3]; X.beginPath(); X.arc(x + 16, GY - 12, 5, 0, TAU); ink(fc, 2.5); X.fillStyle = '#ffb84a'; X.beginPath(); X.arc(x + 16, GY - 12, 2, 0, TAU); X.fill(); }
      }
    };
    const bush = (x, y, s, col) => { X.beginPath(); X.arc(x - 22 * s, y - 14 * s, 20 * s, 0, TAU); X.arc(x, y - 24 * s, 26 * s, 0, TAU); X.arc(x + 24 * s, y - 13 * s, 19 * s, 0, TAU); ink(col, 4.5);
      X.fillStyle = lite(col, .35); X.beginPath(); X.arc(x - 8 * s, y - 34 * s, 8 * s, 0, TAU); X.fill(); X.fillStyle = dark(col, .25); X.fillRect(x - 40 * s, y - 6 * s, 80 * s, 6 * s); };
    const tree = (x, s) => {
      X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 22 * s; line(x, GY - 4, x, GY - 120 * s); X.strokeStyle = '#9a6238'; X.lineWidth = 13 * s; line(x, GY - 4, x, GY - 120 * s);
      X.beginPath(); X.arc(x - 34 * s, GY - 132 * s, 40 * s, 0, TAU); X.arc(x + 30 * s, GY - 140 * s, 44 * s, 0, TAU); X.arc(x, GY - 176 * s, 46 * s, 0, TAU); ink('#3fbf5f', 5);
      X.fillStyle = '#2f9a4c'; X.beginPath(); X.arc(x + 36 * s, GY - 124 * s, 26 * s, 0, TAU); X.fill();
      X.fillStyle = '#86e88a'; X.beginPath(); X.arc(x - 14 * s, GY - 190 * s, 16 * s, 0, TAU); X.fill(); X.beginPath(); X.arc(x - 44 * s, GY - 142 * s, 10 * s, 0, TAU); X.fill();
      for (const [ax, ay] of [[-20, -150], [24, -170], [40, -136]]) { X.beginPath(); X.arc(x + ax * s, GY + ay * s, 6 * s, 0, TAU); ink('#ff5a6e', 2.5); }   // apples
    };
    tree(B0 - 330, 1); bush(B0 - 190, GY - 2, 1, '#43c463'); bush(B1 + 420, GY - 2, 1.1, '#43c463'); tree(B1 + 300, 1.15); bush(B1 + 220, GY - 2, .8, '#58cf6a');
    // the START sign post (its words are drawn live)
    X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 16; line(B0 - 260, GY - 2, B0 - 260, GY - 150); X.strokeStyle = '#a8703f'; X.lineWidth = 8; line(B0 - 260, GY - 2, B0 - 260, GY - 150);
    rr(B0 - 312, GY - 192, 104, 46, 8); ink('#e8b06a', 5); X.fillStyle = '#c98a4e'; X.fillRect(B0 - 310, GY - 158, 100, 10);
    bank(WX0, B0, B0, -1); bank(B1, B1 + 700, B1, 1);
    // flag pole on the far bank (the cloth waves live)
    X.strokeStyle = INK; X.lineWidth = 14; line(B1 + 150, GY - 2, B1 + 150, GY - 230); X.strokeStyle = '#f2f2f8'; X.lineWidth = 7; line(B1 + 150, GY - 2, B1 + 150, GY - 230);
    X.beginPath(); X.arc(B1 + 150, GY - 236, 9, 0, TAU); ink(YEL, 4); X.beginPath(); X.ellipse(B1 + 150, GY, 22, 8, 0, 0, TAU); ink('#9a9ab5', 4);
    for (const s of F) if (!s.bank) stoneDraw(s.x0, s.w, GY, WY + 34, s.sd);
  });
}

/* ═════════ the game ═════════ */
let DCOL = ['#FF6B3D', '#6EA8FE'], DROLE = 0;   // leg colours + my role in the last round built (the intro demos use them)
function duLegs(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), rl = D.role, judge = rl === 0, V = V0 * sp;   // the swing scales with sp (the clock only with sqrt(sp)): 8 half-steps that each wait for the partner's packet must still fit at top speed with 300 ms of lag
  /* level: start bank, NST stones (water gaps 60-120 + two wide "hero" jumps of 118-134, stones 62-84 wide), far bank.
     3 draws per stone + 2 (hero gaps) + 1 (far bank) + 1 (gag) = the same count for both roles */
  const F = [{ x0: -3000, x1: 230, c: 180, bank: 1 }]; {
    const GP = [], WS = [], SD = []; for (let i = 0; i < NST; i++) { GP.push(60 + R() * 60); WS.push(62 + R() * 22); SD.push(R()); }
    const h1 = 1 + Math.floor(R() * 2), hv = R(); GP[h1] = 124 + hv * 10; GP[h1 + 2] = 118 + (1 - hv) * 12;
    let x = 230; for (let i = 0; i < NST; i++) { x += GP[i]; F.push({ x0: x, x1: x + WS[i], c: x + WS[i] / 2, w: WS[i], sd: SD[i], hero: GP[i] > 117 }); x += WS[i]; }
    const b1 = x + 60 + R() * 50; F.push({ x0: b1, x1: b1 + 3000, c: b1 + 50, bank: 1 }); }
  const gag = R();                                              // background gag variant (rare golden duck)
  const LAST = F.length - 1, B0 = F[0].x1, B1 = F[LAST].x0, CAM0 = -210, CAM1 = B1 + 120 - SCRX;
  const footAt = x => { for (let k = LAST; k >= 0; k--) if (x >= F[k].x0 - LEN && x <= F[k].x1 + LEN) return k; return -1; };
  const spot = k => k === 0 ? [B0 - 64, B0 - 30] : k === LAST ? [B1 + 30, B1 + 64] : (h => [F[k].c - h, F[k].c + h])(Math.max(4, Math.min(14, F[k].w / 2 - 16)));
  /* colours: my leg in my colour, the friend's leg in theirs */
  const pc = okHex(D.partner && D.partner.color) ? D.partner.color : (rl ? '#FF6B3D' : '#6EA8FE');
  let mc = null; try { if (typeof me === 'function') { const m = me(); if (m && okHex(m.color)) mc = m.color; } } catch (e) {}
  if (!mc || mc.toLowerCase() === pc.toLowerCase()) { const def = rl ? '#6EA8FE' : '#FF6B3D'; mc = def.toLowerCase() !== pc.toLowerCase() ? def : ['#6EA8FE', '#FF6B3D', '#FFD23F'].find(c => c.toLowerCase() !== pc.toLowerCase()); }
  const COL = []; COL[rl] = mc; COL[1 - rl] = pc; DCOL = COL.slice(); DROLE = rl;

  const mkLeg = (a, i) => ({ i, a, k: 0, up: false, t: 0, o: 0, wet: 0, land: null, spl: null, cap: false, tick: 0, vx: a, vy: GY - ANK, vr: 0 });
  const s0 = spot(0), legs = [mkLeg(s0[0], 0), mkLeg(s0[1], 1)], mine = legs[rl], fr = legs[1 - rl];
  let ep = 0, stun = 0, bothT = 0, whoaOn = false, pressed = false, queued = false, fall = null, resAt = -1, sqT = -9, best = 0, btnFx = 0;
  let ptrN = 0, holdKey = null, late = false, word = null;      // pointers down + the key that started the hold; a friend plant stamped after the limit
  let hxS = (s0[0] + s0[1]) / 2, hyS = GY - ANK - REACH, cam = clamp(hxS - SCRX, CAM0, CAM1), world = null, fish = null, nextFish = 1.2;
  if (typeof Path2D === 'function') { if (!SKY) buildSky(); world = buildWorld(F, B0, B1); }   // build the scenery now (during the intro card), not on the first gameplay frame
  /* a landing worth advertising = a real step: a stone ahead of the one this foot left AND past the other foot's stone (or the far bank).
     Landing back on the same stone, or next to the other foot, is legal, just not "LET GO!" */
  const useful = (l, x) => { const k = footAt(x), o = legs[1 - l.i].k; return k >= 0 && k > l.k && (k > o || k === LAST); };
  const swingD = dt => dt < .2 ? V * (.5 * dt + 1.25 * dt * dt) : V * (.15 + dt - .2);   // eases in, then a steady sweep
  const capOf = l => l.o + MAXS;
  const swingX = l => Math.max(l.a, Math.min(l.a + swingD(Math.max(0, g.c - l.t)), capOf(l)));
  const behind = i => legs[i].a < legs[1 - i].a - .5 || (Math.abs(legs[i].a - legs[1 - i].a) <= .5 && i === 0);
  const NOTE = [262, 294, 330, 349, 392, 440, 494, 523, 587];

  function lift(l, a, o, own) {
    l.up = true; l.t = g.c; l.a = a; l.o = o; l.land = null; l.spl = null; l.cap = false; l.tick = 0;
    snd(l.i ? 520 : 392, .12, 'triangle', own ? .07 : .035, 0, l.i ? 820 : 620); if (own) noise(.12, .03, 600, 2400, 'bandpass');
  }
  function plant(l, x, ok, own) {
    const x0 = l.vx, y0 = l.vy; l.up = false;
    const sx = x - cam;
    if (ok) {
      const k = footAt(x); l.a = x; l.k = Math.max(0, k); l.land = { x0, y0, t: now }; sqT = now;
      const v = own ? 1 : .55; noise(.07, .07 * v, 2200, 700, 'bandpass'); snd(NOTE[clamp(l.k + 1, 0, 8)] * (l.i ? 1 : .5) * 2, .14, l.i ? 'triangle' : 'square', .05 * v);
      puffs(x + 4, GY, 3); drops(x + 4, GY - 2, 3, 200, k === 0 || k === LAST ? GRASS : STONE, 1.6); ring(sx + 4, GY, '#fff', 34, .25);
      if (l.k > best) { best = l.k; if (l.k === LAST && legs[1 - l.i].k !== LAST) { floatText('YAY!', sx, GY - 80, GO, 30); sfx.sparkle(); } }   // the 2nd foot's arrival: the judge's verdict does the show
    } else {
      l.spl = { x, x0, y0, t: now }; l.wet = g.c + WET;
      splash(sx, own ? 1 : .7); floatText('SPLOOSH!', sx, WY - 70, '#bff0ff', own ? 34 : 26);
    }
  }
  /* local particles (world coords): round outlined droplets, dust puffs, a splash crown */
  const fxl = [];
  function drops(wx, y, n, spd, col, spread = 2.2) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * spread, v = spd * (.45 + Math.random() * .7); fxl.push({ k: 0, x: wx, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2.5 + Math.random() * 4.5, t: 0, life: .45 + Math.random() * .4, c: col, fl: Math.max(WY, y) + 16 }); } }
  function puffs(wx, y, n) { for (let i = 0; i < n; i++) { const d = i - (n - 1) / 2; fxl.push({ k: 1, x: wx + d * 16, y: y - 4, vx: d * 50, vy: -18 - Math.random() * 26, r: 7 + Math.random() * 4, t: 0, life: .34 + Math.random() * .14 }); } }
  function crown(wx, y, s) { fxl.push({ k: 2, x: wx, y, r: s, t: 0, life: .42, vx: 0, vy: 0 }); }
  function splash(sx, v, y = WY, side = 0) {   // side: two crowns at +-side px instead of one in the middle (keeps a dunked face in view)
    sfx.splat(); noise(.32, .08 * v, 2600, 300, 'bandpass'); snd(700, .2, 'sine', .05 * v, .04, 220);
    const wx = sx + cam; if (side) { crown(wx - side, y + 2, v * .7); crown(wx + side, y + 2, v * .7); } else crown(wx, y + 2, v);
    for (const dx of side ? [-side * .7, side * .7] : [0]) { const n = side ? .5 : 1; drops(wx + dx, y, Math.round(14 * v * n), 420 * Math.min(1.2, v), '#d4f6ff'); drops(wx + dx, y, Math.round(7 * v * n), 300, WAT0); }
    ring(sx, y + 2, '#fff', 64 * v, .4); if (v >= 1) shake(4 * v, .15);
  }
  function fxStep(dt) {
    for (let i = fxl.length - 1; i >= 0; i--) { const f = fxl[i]; f.t += dt; if (f.k === 0) { f.vy += 1100 * dt; } f.x += f.vx * dt; f.y += f.vy * dt; if (f.k === 1) { f.vx *= Math.exp(-6 * dt); f.vy *= Math.exp(-4 * dt); }
      if (f.t > f.life || (f.k === 0 && f.vy > 0 && f.y > f.fl)) fxl.splice(i, 1); }
  }
  function fxDraw() {
    X = ctx;
    for (const f of fxl) {
      const x = f.x - cam, u = f.t / f.life;
      if (f.k === 0) { X.beginPath(); X.arc(x, f.y, f.r, 0, TAU); ink(f.c, 2.2); X.fillStyle = 'rgba(255,255,255,.8)'; X.beginPath(); X.arc(x - f.r * .3, f.y - f.r * .3, f.r * .35, 0, TAU); X.fill(); }
      else if (f.k === 1) { X.globalAlpha = 1 - u; X.beginPath(); X.arc(x, f.y, f.r * (1 + u * .8), 0, TAU); ink('#fffaf0', 2.5); X.globalAlpha = 1; }
      else {                                                   // splash crown: spikes shoot up, then sink back
        const h = Math.sin(Math.min(1, u * 1.4) * Math.PI) * 58 * f.r, w = (26 + u * 34) * f.r; if (h < 2) continue;
        X.beginPath(); X.moveTo(x - w, f.y);
        for (let j = 0; j <= 6; j++) { const q = j / 6, sx = x - w + q * 2 * w, sp = j % 2 ? .45 : 1; X.lineTo(sx, f.y - h * sp * (1 - Math.abs(q - .5) * .9)); }
        X.lineTo(x + w, f.y); X.closePath(); ink('#e6fbff', 3.5); X.fillStyle = 'rgba(95,210,247,.55)'; X.beginPath(); X.ellipse(x, f.y, w * .7, 5, 0, 0, TAU); X.fill();
      }
    }
  }
  function doFall(k) {
    const [xl, xr] = spot(k), hx = hxS, dv = diveX(hx + 80);
    fall = { t: now, hx, hy: hyS, f: legs.map(l => [l.vx, l.vy, l.vr]), to: [xl, xr], stay: false, hit: false, back: false, dx: dv, sur: footAt(dv) < 0 ? WY : GY };
    legs.forEach((l, i) => { l.up = false; l.a = i ? xr : xl; l.k = k; l.land = null; l.spl = null; l.wet = 0; });
    stun = STUN; bothT = 0; pressed = false; queued = false; snd(330, .5, 'sine', .07, 0, 90);
  }
  const diveX = x => { const k = footAt(x); return k > 0 && k < LAST ? (F[k].x1 + F[k + 1].x0) / 2 : x; };   // aim the faceplant at the middle of the water gap when a stone is in the way

  function press() {
    pressed = true; btnFx = 1;
    if (g.result || stun > 0 || mine.up) return;
    if (g.c < GO0 || g.c < mine.wet) { queued = true; return; }      // a press during the start beat or while the foot drips: lift as soon as it can
    g.lift();
  }
  function release() {
    if (ptrN > 0 || holdKey !== null) return;
    pressed = false; queued = false;
    if (!mine.up || g.result) return;
    const x = Math.round(swingX(mine) * 10) / 10, ok = footAt(x) >= 0;
    D.send('pl', [ep, x, ok ? 1 : 0, Math.round(g.c * 100) / 100]); plant(mine, x, ok, true);
  }
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: 'WALK!', roleLabel: rl ? 'RIGHT LEG' : 'LEFT LEG',
    hint: 'HOLD = LIFT · LET GO ON A STONE · TAKE TURNS',
    thint: 'HOLD = LIFT · LET GO ON A STONE · TAKE TURNS',
    update(dt) {
      g.c += dt; stun = Math.max(0, stun - dt); btnFx = Math.max(0, btnFx - dt * 5); fxStep(dt);
      if (holdKey !== null && typeof keys === 'object' && keys[holdKey] === false) { holdKey = null; release(); }   // the window lost focus mid-hold (main.js clears keys, no keyup comes): put the foot down
      if (fall && !fall.stay && now - fall.t >= STUN) { fall = null; const q = target(); hxS = q[0]; hyS = q[1]; }
      if (queued && pressed && !mine.up && !g.result && stun <= 0 && g.c >= GO0 && g.c >= mine.wet) g.lift();
      if (mine.up && !g.result) {                             // the swing: a rising tick while the foot travels, a grunt at full reach
        const d = swingX(mine) - mine.a, cap = swingX(mine) >= capOf(mine) - .5;
        if (!cap && Math.floor(d / 34) > mine.tick) { mine.tick = Math.floor(d / 34); snd(300 + d * 1.6, .04, 'sine', .035); }
        if (cap && !mine.cap) { mine.cap = true; snd(140, .25, 'sawtooth', .04, 0, 110); }
      }
      const both = legs[0].up && legs[1].up;
      bothT = both && stun <= 0 ? bothT + dt : 0;
      if (both && !whoaOn && bothT > .12) { whoaOn = true; sfx.boing(); }
      if (!both) whoaOn = false;
      if (judge && !g.result) {
        if (bothT > GRACE && stun <= 0) { ep++; const k = Math.max(0, Math.max(legs[0].k, legs[1].k) - 1); D.send('fall', [ep, k]); doFall(k); }
        else if (legs[0].k === LAST && legs[1].k === LAST && !late) g.finish('win');
        else if (g.c >= g.limit + (fr.up && !late ? .25 : 0)) g.finish('lose');   // the friend's last step may still be on its way: wait for it a moment
      }
      feet();
      const [tx, ty] = target(); hxS += (tx - hxS) * (1 - Math.exp(-dt * 9)); hyS += (ty - hyS) * (1 - Math.exp(-dt * 12));
      const fx = fall && !fall.back ? fall.dx - 60 : hxS;
      cam += (clamp(fx - SCRX, CAM0, CAM1) - cam) * (1 - Math.exp(-dt * 4));
    },
    msg(t, d) {
      if (t === 'up') { if (d[0] < ep || g.result) return; lift(fr, d[1], d[2], false); }
      else if (t === 'pl') { if (d[0] < ep || g.result) return; if (judge && g.c >= g.limit && d[3] > g.limit + .05) late = true; if (fr.up) plant(fr, d[1], d[2] === 1, false); }
      else if (t === 'fall') { if (d[0] <= ep) return; ep = d[0]; doFall(d[1]); }
    },
    /* the hold lasts while ANY finger / the mouse button OR the key that started it is down: a 2nd finger lifting, or Shift tapped
       during a Space hold, does not plant early */
    down() { ptrN++; press(); },
    up() { ptrN = Math.max(0, ptrN - 1); release(); },
    key(e) { if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape' || e.repeat || holdKey !== null) return; holdKey = e.code; press(); },
    keyup(e) { if (e.code !== holdKey) return; holdKey = null; release(); },
    lift() { queued = false; lift(mine, mine.a, fr.a, true); D.send('up', [ep, mine.a, mine.o]); },
    draw() { drawScene(); },
  };
  /* visual feet (ankle positions): planted, swinging, landing, splashing */
  function feet() {
    for (const l of legs) {
      let x, y, r = 0;
      if (l.up) {
        const e = g.c - l.t, sx = swingX(l); x = sx + (sx >= capOf(l) - .5 ? Math.sin(now * 55) * 1.6 : 0);
        y = GY - ANK - 64 * easeOut(e / .16) - Math.sin(e * 8) * 3; r = -.22 + .08 * Math.sin(e * 7);
      } else if (l.spl && now - l.spl.t < WET + .06) {
        const k = (now - l.spl.t) / WET;
        if (k < .3) { const e = k / .3; x = lerp(l.spl.x0, l.spl.x, e); y = lerp(l.spl.y0, WY + 4, e * e); r = .5 * e; }
        else { const e = ease((k - .3) / .7); x = lerp(l.spl.x, l.a, e); y = lerp(WY + 4, GY - ANK, e) - Math.sin(e * Math.PI) * 54; r = .5 * (1 - e) - .3 * Math.sin(e * Math.PI); }
      } else if (l.land && now - l.land.t < .09) { const e = (now - l.land.t) / .09; x = lerp(l.land.x0, l.a, e); y = lerp(l.land.y0, GY - ANK, e * e); r = -.2 * (1 - e); }
      else { x = l.a; y = GY - ANK; }
      l.vx = x; l.vy = y; l.vr = r;
    }
  }
  /* body target from the PLANTED feet only (+ a small lean toward a swinging foot): both screens agree */
  function target() {
    let hx = (legs[0].a + legs[1].a) / 2; for (const l of legs) if (l.up) hx += (l.vx - l.a) * .2;
    let md = 0; const all = legs[0].up && legs[1].up;
    for (const l of legs) if (!l.up || all) md = Math.max(md, Math.abs(hx + (l.i ? HIPX : -HIPX) - l.a));
    return [hx, GY - ANK - Math.sqrt(Math.max(REACH * REACH - md * md, 120 * 120))];
  }
  /* the pose to draw: standing / swinging / wobbling, the faceplant gag, the win dance */
  function pose() {
    const p = { hx: hxS, hy: hyS, rot: 0, sq: 1, feet: legs.map(l => [l.vx, l.vy, l.vr]), order: legs[0].up && !legs[1].up ? [1, 0] : [0, 1], mood: 'idle', flail: 0, armsUp: 0, look: 0 };
    const swinging = legs.find(l => l.up);
    if (swinging) { p.rot = .05 + Math.sin(now * 5) * .02; p.look = 1; p.mood = swinging === mine ? (mine.cap ? 'strain' : 'focus') : 'focus'; }
    else p.rot = Math.sin(now * 2.1) * .025;
    const sq = now - sqT; if (sq < .3) { p.sq = 1 - .09 * Math.sin(sq / .3 * Math.PI); p.hy += 6 * Math.sin(sq / .3 * Math.PI); }
    if (legs[0].up && legs[1].up) { const k = Math.min(1, bothT / GRACE + .2); p.rot = Math.sin(now * 17) * (.06 + .2 * k); p.hx += Math.sin(now * 13) * 6 * k; p.mood = 'whoa'; p.flail = 1; }
    if (fall) {
      const k = (now - fall.t) / STUN, sur = fall.sur, dive = [fall.dx, sur === WY ? DWL - 40 : GY + 30];   // in water the head goes under up to the eyes, the hips and the kicking legs stay out
      const rel = (rot, i, kick) => { const lx = (i ? HIPX : -HIPX) + kick, ly = 158, c = Math.cos(rot), s = Math.sin(rot); return [p.hx + lx * c - ly * s, p.hy + lx * s + ly * c - ANK * .2]; };
      p.mood = g.result === 'lose' ? 'sad' : 'dizzy'; p.flail = 0; p.look = 0; p.sq = 1;
      if (k < .3) {
        const e = ease(k / .3); p.hx = lerp(fall.hx, dive[0], e); p.hy = lerp(fall.hy, dive[1], e * e) - Math.sin(e * Math.PI) * 30; p.rot = Math.PI * e * e; p.mood = 'whoa'; p.flail = 1;
        p.feet = [0, 1].map(i => { const q = rel(p.rot, i, 0), f = fall.f[i]; return [lerp(f[0], q[0], e), lerp(f[1], q[1], e), lerp(f[2], Math.PI * e, e)]; });
      } else if (k < .72 || fall.stay) {
        if (!fall.hit) { fall.hit = true; const sx = dive[0] - cam; if (sur === WY) splash(sx, 1.3, DWL, 64); else { puffs(dive[0], GY, 5); drops(dive[0], GY, 8, 300, DIRTL); } sfx.thud(); shake(9, .3); word = { s: g.result === 'lose' ? 'GLUB...' : 'BLUB!', t: fall.t + .3 * STUN, x: dive[0] }; snd(180, .35, 'sine', .06, 0, 70); }
        const kk = fall.stay ? 8 : 20, j = Math.sin(now * 3) * 3; p.hx = dive[0]; p.hy = dive[1] + j; p.rot = Math.PI + Math.sin(now * 4) * .06; p.inv = 1; p.flail = .6; p.dunk = sur === WY;
        const c = Math.cos(p.rot), sn = Math.sin(p.rot);
        p.feet = [0, 1].map(i => {                            // the legs stick out in a V and kick in turn (upside down, the left hip is on the right)
          const lx = i ? HIPX : -HIPX, hx = p.hx + lx * c + 3 * sn, hy = p.hy + lx * sn - 3 * c, sg = i ? -1 : 1, w = Math.sin(now * kk + i * Math.PI);
          const a = sg * (.36 + .16 * w), L = 170 - 10 * Math.max(0, w);
          return [hx + Math.sin(a) * L, hy - Math.cos(a) * L, Math.PI + sg * (.35 + .25 * w)];
        });
      } else {
        if (!fall.back) { fall.back = true; sfx.boing(); if (sur === WY) { drops(dive[0], DWL, 10, 360, '#d4f6ff'); crown(dive[0], DWL + 2, .7); } else puffs(dive[0], GY, 4); }
        const e = ease((k - .72) / .28), tx = (fall.to[0] + fall.to[1]) / 2, ty = GY - ANK - Math.sqrt(REACH * REACH - (HIPX + 17) * (HIPX + 17));
        p.hx = lerp(dive[0], tx, e); p.hy = lerp(dive[1], ty, e) - Math.sin(e * Math.PI) * 90; p.rot = Math.PI + Math.PI * e; p.flail = 1 - e;
        if (p.hx - cam < 340) p.hy = Math.max(p.hy, 236);   // the flip stays under the players box (x<320, y<150)
        p.feet = [0, 1].map(i => { const q = rel(p.rot, i, 0), a = fall.to[i]; const w = e * e; return [lerp(q[0], a, w), lerp(q[1], GY - ANK, w), lerp(Math.PI * (1 + e), TAU, w)]; });
        if (k >= 1) { fall = null; hxS = tx; hyS = ty; }
      }
      p.under = sur === WY ? DWL : sur;
    } else if (g.result === 'win') {
      const k = now - resAt, top = Math.abs(Math.sin(k * 6.5)), hop = top * 52 * Math.max(.5, 1 - k * .4), mid = (legs[0].a + legs[1].a) / 2, spread = lerp(36, 3, top * top);
      p.hx = mid; p.hy = GY - ANK - REACH + 10 - hop; p.mood = 'happy'; p.armsUp = 1; p.rot = Math.sin(k * 6.5) * .06;
      p.feet = [0, 1].map(i => [mid + (i ? spread : -spread), GY - ANK - hop * .85, (i ? -1 : 1) * .35 * top]);   // heel click at the top of every hop
      p.click = top > .93;
    }
    return p;
  }
  /* ───────────── drawing ───────────── */
  const LILY = []; for (let k = 0; k < LAST; k++) { const a = F[k].x1, b = F[k + 1].x0; if (b - a > 40) LILY.push([(a + b) / 2 + (k % 2 ? 9 : -12), WY + 46 + (k * 17 % 3) * 10, k]); }
  const LILYS = LILY.concat([[B0 + 44, WY + 64, 3], [B1 - 44, WY + 60, 3]]);
  function drawScene() {
    X = ctx;
    if (!SKY) buildSky();
    if (!world) world = buildWorld(F, B0, B1);
    if (g.result && resAt < 0) {
      resAt = now; legs.forEach(l => { l.up = false; }); mine.cap = true; pressed = false; queued = false;   // the round is over: no swing, no marker
      if (g.result === 'lose') { if (fall && (now - fall.t) / STUN < .7) fall.stay = true; else { fall = null; const dv = diveX(hxS + 80); fall = { t: now, hx: hxS, hy: hyS, f: legs.map(l => [l.vx, l.vy, l.vr]), to: [legs[0].a, legs[1].a], stay: true, hit: false, back: false, dx: dv, sur: footAt(dv) < 0 ? WY : GY }; } }
      else { fall = null; const sx = hxS - cam; confetti(sx, 200, 34); ring(sx, 230, YEL, 120, .5); sfx.boing(); }
    }
    feet();
    const cx = cam;
    // sky, clouds, birds, far mountains, hills (parallax)
    ctx.drawImage(SKY, 0, 0);
    ctx.save(); ctx.globalAlpha = .13; ctx.fillStyle = '#fff8c8'; ctx.translate(652, 206); ctx.rotate(now * .15);
    for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(220, -18); ctx.lineTo(220, 18); ctx.closePath(); ctx.fill(); } ctx.restore();
    [[60, 196, 0, 7], [430, 150, 1, 4], [760, 236, 2, 5.5]].forEach(([x0, y, i, v]) => { const span = 1100, x = ((x0 - cx * .05 + now * v) % span + span) % span - 200; ctx.drawImage(CLOUD[i], x, y - 70); });
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const x = ((now * (22 + i * 6) + i * 260) % 1000) - 100, y = 168 + i * 22 + Math.sin(now * 1.3 + i) * 6, f = Math.sin(now * 9 + i * 2) * 4; ctx.beginPath(); ctx.moveTo(x - 9, y - f); ctx.quadraticCurveTo(x - 4, y - 5, x, y); ctx.quadraticCurveTo(x + 4, y - 5, x + 9, y - f); ctx.stroke(); }
    ctx.drawImage(MTN, -60 - (cx - CAM0) * .08, 228);
    ctx.drawImage(HILL, -80 - (cx - CAM0) * .3, 290);
    // water
    if (!WATG) { WATG = ctx.createLinearGradient(0, WY, 0, 600); WATG.addColorStop(0, WAT0); WATG.addColorStop(.35, WAT1); WATG.addColorStop(1, WAT2); }
    ctx.fillStyle = WATG; ctx.fillRect(0, WY, 800, 600 - WY);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 3; i++) ctx.fillRect(0, WY + 22 + i * 30 + Math.sin(now * 1.2 + i) * 3, 800, 8 - i * 2);
    ctx.strokeStyle = FOAM; ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {           // shimmering ripple dashes, fixed in the world
      const wx = (i * 151.7) % 1900 - 300, x = ((wx - cx) % 1900 + 1900) % 1900 - 200, y = WY + 14 + (i * 41 % 100), l = 16 + (i * 13 % 34), a = .35 + .35 * Math.sin(now * 2.2 + i * 1.7);
      if (x < -60 || x > 860) continue; ctx.globalAlpha = Math.max(0, a); ctx.lineWidth = i % 3 ? 3 : 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l + Math.sin(now * 1.6 + i) * 5, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#9ce9ff'; ctx.beginPath(); ctx.moveTo(0, WY + 5); for (let x = 0; x <= 800; x += 20) ctx.lineTo(x, WY + Math.sin(x * .05 + now * 2.4) * 2); ctx.lineTo(800, WY + 5); ctx.closePath(); ctx.fill();
    // the background gag: a rubber duck drifting down the river (1 round in 8: golden, with a crown)
    let dkx = ((now * 18 + gag * 900) % 1500) - 300 - (cx - CAM0) * .6;
    if (g.result === 'lose' && fall && fall.sur === WY) { const tx = fall.dx - cx + 104; if (resAt >= 0 && fall.dk === undefined) fall.dk = dkx < -60 || dkx > 860 ? (tx > 400 ? 880 : -80) : dkx; dkx = lerp(fall.dk, tx, ease((now - resAt - .3) / 1.6)); }   // the duck paddles over to see
    if (!(g.result === 'lose' && fall && fall.sur === WY)) duck(dkx, WY + 16 + Math.sin(now * 2) * 2, gag < .125);
    const p = pose(); const scr = q => Object.assign({}, q, { hx: q.hx - cx, feet: q.feet.map(f => [f[0] - cx, f[1], f[2]]) }), ps = scr(p);
    // banks + stones (cached), foam where the stones meet the water
    ctx.drawImage(world, WX0 - cx, WYT);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(230,250,255,.9)';
    for (const s of F) { if (s.bank) continue; const x = s.c - cx; if (x < -80 || x > 880) continue; const k = (now * .9 + s.sd) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(x, WY + 3, s.w * .55 + k * 22, 6 + k * 5, 0, 0, Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // lily pads (not stones! they sit in the foreground water), a fish that jumps now and then
    for (const [wx, y, k] of LILYS) { const x = wx - cx; if (x < -50 || x > 850) continue; lily(x, y + Math.sin(now * 2 + k) * 2, k); }
    if (!fish && now > nextFish) { const gaps = LILY.filter(([wx]) => wx - cx > 380 && wx - cx < 760); if (gaps.length) fish = { x: gaps[Math.floor(Math.random() * gaps.length)][0] + 20, t: now, d: Math.random() < .5 ? 1 : -1 }; nextFish = now + 2.2 + Math.random() * 1.6; }
    if (fish) drawFish();
    // markers (where a lifted foot would land)
    for (const l of legs) if (l.up) marker(l);
    // the walker (+ its reflection in the water)
    if (!p.under) { ctx.save(); ctx.beginPath(); ctx.rect(B0 - cx + 6, WY + 2, B1 - B0 - 12, 120); ctx.clip(); ctx.translate(0, 2 * WY); ctx.scale(1, -1); ctx.globalAlpha = .2; walker(ps, 1, COL); ctx.restore(); }
    if (p.under) {
      const u = p.under + 3;
      if (!p.dunk) { ctx.save(); ctx.beginPath(); ctx.rect(-10, -10, 820, u + 10); ctx.clip(); walker(ps, 1, COL); ctx.restore(); }
      if (p.dunk) {
        // head first in the foreground water: dry above the waterline, seen through clear water (lighter, a cyan tint) below it
        ctx.save(); ctx.beginPath(); ctx.rect(-10, -10, 820, u + 10); ctx.clip(); walker(ps, 1, COL); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(-10, u, 820, 200); ctx.clip(); ctx.globalAlpha = .8; walker(ps, 1, COL);
        ctx.globalAlpha = .3; ctx.fillStyle = '#8fe6ff'; ctx.beginPath(); ctx.ellipse(ps.hx, u + 6, 84, 40, 0, 0, TAU); ctx.fill(); ctx.restore();
        ctx.fillStyle = 'rgba(214,246,255,.85)'; ctx.beginPath(); ctx.moveTo(ps.hx - 70, u + 4); for (let x = -70; x <= 70; x += 10) ctx.lineTo(ps.hx + x, u + Math.sin(x * .14 + now * 7) * 2.2); ctx.lineTo(ps.hx + 70, u + 4); ctx.closePath(); ctx.fill();
        // ripples, a ring of foam bubbles on the surface, bubbles rising from the mouth
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; for (let i = 0; i < 2; i++) { const k = (now * 1.2 + i * .5) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(ps.hx, u, 54 + k * 56, 7 + k * 7, 0, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
        X = ctx; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + now * .8, r = 3.5 + 1.8 * Math.sin(now * 7 + i * 2); if (Math.sin(a) < -.2) continue; ctx.beginPath(); ctx.arc(ps.hx + Math.cos(a) * 60, u + Math.sin(a) * 7, r, 0, TAU); ink('#eafcff', 1.8); }
        for (let i = 0; i < 6; i++) { const k = (now * 1.1 + i / 6) % 1, r = (3 + i % 3 * 2.4) * (.6 + k * .5), bx = ps.hx + 22 + Math.sin(i * 2.3 + now * 3) * (8 + k * 22), by = u - 4 - k * 80; ctx.globalAlpha = 1 - k * k;
          ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ink('rgba(220,248,255,.45)', 1.6, '#fff'); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx - r * .35, by - r * .35, r * .3, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        if (g.result === 'lose') duck(dkx, u - 2 + Math.sin(now * 2) * 2, gag < .125);
      }
    } else walker(ps, 1, COL);
    fxDraw();
    if (mine.up && mine.cap && !fall && !g.result) { const k = Math.abs(Math.sin(now * 12)); txt('MAX!', mine.vx - cx + 6, mine.vy - 86 - k * 4, 24, YEL, 'center', 110); }
    if (p.click) { star(ps.feet[0][0] / 2 + ps.feet[1][0] / 2, ps.feet[0][1] + 6, 22, 9, 4, now * 3, YEL, 3); }
    if (p.mood === 'whoa' && !fall) {                         // WHOA! over the head, nudged right when it would touch the players box (x<320, y<150)
      const k = .5 + .5 * Math.sin(now * 20), y = ps.hy - 104 - k * 4; ctx.font = '900 38px "Arial Black", Impact, sans-serif';
      const hw = Math.min(260, ctx.measureText(t('WHOA!')).width) / 2 + 8, x = y < 160 ? Math.max(ps.hx, 326 + hw) : ps.hx;
      txt('WHOA!', x, y, 34 + k * 4, NO, 'center', 260); txt('ONE AT A TIME!', ps.hx, ps.hy - 70, 20, '#fff', 'center', 300);
    }
    if (word && fall && fall.hit && !fall.back) {             // BLUB! / GLUB...: a big squashy word that pops in above the kicking legs
      const k = now - word.t, s = outBack(k / .28), q = Math.sin(k * 16) * .14 * Math.max(0, 1 - k * 2.2);
      ctx.save(); ctx.translate(clamp(word.x - cx, 230, 570), 188 + Math.sin(now * 5) * 3); ctx.rotate(Math.sin(now * 4.5) * .07); ctx.scale(s * (1 + q), s * (1 - q));
      txt(word.s, 0, 0, 56, YEL, 'center', 380); ctx.restore();
      if (!fall.stay) txt('ONE AT A TIME!', clamp(word.x - cx, 230, 570), 242, 26, '#fff', 'center', 380);
    }
    // the goal flag + live sign words
    flag(B1 + 150 - cx, GY - 226);
    txt('START', B0 - 260 - cx, GY - 169, 22, '#fff', 'center', 92);
    // name tags under the feet + "your turn" glow
    if (!g.result && !fall) {
      const free = !legs[0].up && !legs[1].up && !(legs[0].k === LAST && legs[1].k === LAST), myT = free && behind(rl) && g.c >= mine.wet;
      if (myT && stun <= 0) { const k = (now * 1.6) % 1; ctx.strokeStyle = COL[rl]; ctx.lineWidth = 5 * (1 - k) + 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(mine.vx - cx + 4, GY + 2, 34 + k * 26, 9 + k * 6, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
      const gap = legs[1].vx - legs[0].vx, push = legs[0].up || legs[1].up ? 0 : Math.max(0, 96 - Math.abs(gap)) / 2 * (gap >= 0 ? 1 : -1);
      X = ctx;
      for (const l of legs) {                                 // a planted foot: its tag under it; a swinging foot: above the shoe (its landing ring stays clear)
        const own = l === mine, px = l.vx - cx + 4, lab = own ? 'YOU' : 'FRIEND', sz = own ? 18 : 15;
        if (l.up) { const x = clamp(px, 70, 730); pill(x, l.vy - 44, lab, COL[l.i], sz, clamp(px, x - 24, x + 24), false); }
        else { const x = clamp(px + (l.i ? push : -push), PILLX[0], PILLX[1]); pill(x, GY + 44, lab, COL[l.i], sz, clamp(px, x - 24, x + 24), true); }
      }
    }
    // foreground reeds (parallax 1.25) and the buttons
    reeds(cx);
    buttons();
    progress();
    // a soft vignette keeps the edges calm
    vignette(.16);
    if (g.result === 'win') headline();
  }
  /* the win headline: a sunburst, a pop with an overshoot and a slow wobble; centred and width-capped so it fits in any language */
  function headline() {
    const k = now - resAt, s = outBack(k / .42), y = 318 + Math.sin(now * 3.2) * 4;   // across the legs: the happy face above stays in view
    ctx.save(); ctx.translate(400, y); ctx.globalAlpha = Math.min(1, k * 3) * .34; ctx.fillStyle = '#fffbe0'; ctx.rotate(now * .5);
    for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(260 * s, -22 * s); ctx.lineTo(260 * s, 22 * s); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.translate(400, y); ctx.rotate(Math.sin(now * 2.6) * .045); ctx.scale(s, s);
    txt('MADE IT!', 0, 0, 62, YEL, 'center', 520);
    ctx.restore();
    ctx.font = '900 62px "Arial Black", Impact, sans-serif'; const hw = Math.min(520, ctx.measureText(t('MADE IT!')).width) / 2;
    if (k > .3) for (const sx of [-1, 1]) star(400 + sx * (hw + 30 + Math.sin(now * 6 + sx) * 5), y - 6, 22 * Math.min(1, (k - .3) * 4), 9 * Math.min(1, (k - .3) * 4), 5, now * 2 * sx, YEL, 3);
  }
  /* where a lifted foot would land: green with a check only for a useful stone ahead, red with an X over water, plain white otherwise */
  function marker(l) {
    const lx = swingX(l), wet = footAt(lx) < 0, ok = !wet && useful(l, lx), own = l === mine, x = lx - cam, fx = l.vx - cam, fy = l.vy + ANK;
    const col = wet ? NO : ok ? GO : '#ffffff', a = own ? 1 : .75, ry = wet ? WY + 2 : GY;
    ctx.save(); ctx.globalAlpha = a;
    ctx.setLineDash([2, 11]); ctx.lineCap = 'round'; ctx.lineWidth = own ? 6 : 4.5; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(fx + 4, fy); ctx.quadraticCurveTo((fx + x) / 2, Math.min(fy, GY) - 46, x + 4, ry); ctx.stroke();
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -now * 40; ctx.lineWidth = own ? 5 : 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(x + 4, ry, 30, 9, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = own ? 3 : 2.4; ctx.stroke(); ctx.setLineDash([]);
    if (own && (ok || wet)) { const s = ok ? 1 + .12 * Math.sin(now * 20) : 1; ctx.translate(x + 4, ry - 36); ctx.scale(s, s); X = ctx; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ink(col, 3.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); if (ok) { ctx.moveTo(-6, 0); ctx.lineTo(-1, 5); ctx.lineTo(7, -5); } else { ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); } ctx.stroke(); }
    ctx.restore();
  }
  function lily(x, y, k) {
    X = ctx; ctx.save(); ctx.translate(x, y); ctx.scale(1, .42);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 24, .35, TAU - .05); ctx.closePath(); ink('#4cbf5a', 4); ctx.fillStyle = '#2f9a45'; ctx.beginPath(); ctx.arc(0, 0, 24, 1.2, 2.6); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
    if (k % 2 === 0) { ctx.save(); ctx.translate(x - 6, y - 4); for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5); ctx.beginPath(); ctx.ellipse(0, -6, 4, 7, 0, 0, TAU); ink('#ff9ccd', 2); } ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.restore(); }
  }
  function drawFish() {
    const k = (now - fish.t) / 1.1; if (k >= 1) { fish = null; return; }
    const x = fish.x - cam + fish.d * (k - .5) * 90, y = WY + 10 - Math.sin(k * Math.PI) * 92, a = Math.atan2(-Math.cos(k * Math.PI) * 92 * Math.PI, fish.d * 90) ;
    if (!fish.a) { fish.a = 1; drops(x + cam, WY, 4, 200, '#d4f6ff'); noise(.1, .03, 3000, 1200, 'bandpass'); }
    if (k > .9 && !fish.b) { fish.b = 1; drops(x + cam, WY, 5, 220, '#d4f6ff'); }
    if (y > WY + 6) return;
    X = ctx; ctx.save(); ctx.translate(x, y); ctx.rotate(fish.d > 0 ? a : a + Math.PI); ctx.scale(fish.d > 0 ? 1 : -1, 1);
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-30, -10); ctx.lineTo(-28, 10); ctx.closePath(); ink('#ff8a3d', 3.5);
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 10, 0, 0, TAU); ink('#ffa44d', 3.5); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-2, 3, 12, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10, -2, 4.5, 0, TAU); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(11, -2, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function duck(x, y, gold) {
    if (x < -60 || x > 860) return; X = ctx; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(now * 2.4) * .08);
    const c = gold ? '#ffd23f' : '#ffe86a', s = gold ? '#e0a400' : '#f2c230';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, TAU); ink(c, 3.5); ctx.beginPath(); ctx.arc(12, -14, 10, 0, TAU); ink(c, 3.5);
    ctx.fillStyle = s; ctx.beginPath(); ctx.ellipse(-4, 2, 9, 5, -.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(19, -15); ctx.lineTo(29, -12); ctx.lineTo(19, -9); ctx.closePath(); ink('#ff8a3d', 2.5);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(14, -17, 2.2, 0, TAU); ctx.fill();
    if (gold) { ctx.beginPath(); ctx.moveTo(4, -22); ctx.lineTo(6, -32); ctx.lineTo(10, -26); ctx.lineTo(13, -34); ctx.lineTo(16, -26); ctx.lineTo(20, -31); ctx.lineTo(20, -22); ctx.closePath(); ink('#ffd23f', 2.5); }
    ctx.restore();
  }
  function flag(x, y) {
    if (x < -120 || x > 920) return; X = ctx; const w = 92, h = 58;   // the waving cloth: one live path (no per-frame Path2D), clipped for the checks
    X.beginPath(); X.moveTo(x, y);
    for (let i = 0; i <= 8; i++) { const u = i / 8; X.lineTo(x + u * w, y + Math.sin(now * 6 - u * 4) * 6 * u); }
    for (let i = 8; i >= 0; i--) { const u = i / 8; X.lineTo(x + u * w, y + h + Math.sin(now * 6 - u * 4) * 6 * u); } X.closePath();
    ink('#fff', 4); ctx.save(); ctx.clip(); ctx.fillStyle = INK;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2) { const u = c / 6; ctx.fillRect(x + c * w / 6, y + r * h / 4 + Math.sin(now * 6 - (u + .08) * 4) * 6 * (u + .08), w / 6 + 1, h / 4 + 1); }
    ctx.restore(); ink(null, 2);
    if (g.result !== 'win') txt('GOAL', x + w / 2 - 6, y + h + 34, 22, YEL, 'center', 110);   // on a win the MADE IT! headline owns that row
  }
  function reeds(c) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const wx = -200 + i * 470, x = ((wx - c * 1.25) % 2820 + 2820) % 2820 - 200; if (x < -40 || x > 840) continue;
      for (let j = 0; j < 3; j++) { const bx = x + j * 11, sw = Math.sin(now * 1.8 + i + j) * 6, h = 50 + j * 12 - (i % 2) * 10;
        ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(bx, 610); ctx.quadraticCurveTo(bx, 600 - h / 2, bx + sw, 600 - h); ctx.stroke();
        ctx.strokeStyle = j === 1 ? '#3fa64a' : '#58c35a'; ctx.lineWidth = 5; ctx.stroke();
        if (j === 1) { ctx.strokeStyle = INK; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(bx + sw, 600 - h - 2); ctx.lineTo(bx + sw * 1.1, 600 - h - 22); ctx.stroke(); ctx.strokeStyle = '#8a5a3c'; ctx.lineWidth = 7; ctx.stroke(); }
      }
    }
  }
  /* the hold indicators (the whole screen is the input): mine big in the bottom corner on my side, the friend's small one opposite */
  function buttons() {
    X = ctx;
    const fade = g.result ? Math.max(0, 1 - (now - resAt) * 3) : 1; if (fade <= 0) return;
    const free = !legs[0].up && !legs[1].up && !(legs[0].k === LAST && legs[1].k === LAST), myTurn = free && behind(rl) && !g.result && !fall && stun <= 0 && g.c >= mine.wet;
    const [bx, by] = BTN[rl], [ox, oy] = BTN[1 - rl], held = mine.up, lx = held ? swingX(mine) : 0, wet = held && footAt(lx) < 0, ok = held && !wet && useful(mine, lx), far = wet && mine.cap;
    ctx.save(); ctx.globalAlpha = fade;
    // the friend's little button: presses down while their leg is up; a tiny Caos in their colour stands on it (no text: the FRIEND tag is on their foot)
    const fu = fr.up ? 1 : 0, fc = COL[1 - rl], fy = oy + 10;
    X.beginPath(); X.ellipse(ox, fy + 30, 28, 7, 0, 0, TAU); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
    X.beginPath(); X.arc(ox, fy + 7, 24, 0, TAU); ink(dark(fc, .35), 3.5); X.beginPath(); X.arc(ox, fy + fu * 4, 24, 0, TAU); ink(fu ? lite(fc, .3) : fc, 3.5);
    shoe(ox - 2, fy - 3 + fu * 4, fu ? -.3 : -.1, .36, lite(fc, fu ? .55 : .25));
    caos(ox, fy - 25 + fu * 5, 2.3, { col: fc, mood: fu ? 'happy' : null });
    // my big button
    const pr = held || pressed ? 1 : 0, pulse = myTurn ? .5 + .5 * Math.sin(now * 8) : 0, s = 1 + pulse * .07 + btnFx * .05;
    const face = ok ? GO : far ? NO : held ? YEL : COL[rl], label = ok ? 'LET GO!' : far ? 'TOO FAR!' : held ? 'KEEP GOING' : 'HOLD';
    ctx.save(); ctx.translate(bx, by); ctx.scale(s, s);
    if (myTurn) { const k = (now * 1.6) % 1; ctx.globalAlpha = fade * (1 - k); ctx.strokeStyle = COL[rl]; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(0, 4, BR + 6 + k * 22, 0, TAU); ctx.stroke(); ctx.globalAlpha = fade; }
    X.beginPath(); X.ellipse(0, BR + 1, BR + 4, 8, 0, 0, TAU); X.fillStyle = 'rgba(20,16,28,.35)'; X.fill();
    X.beginPath(); X.arc(0, 8, BR, 0, TAU); ink(dark(face, .4), 5);
    X.beginPath(); X.arc(0, pr * 6, BR, 0, TAU); ink(face, 5);
    X.save(); X.beginPath(); X.arc(0, pr * 6, BR, 0, TAU); X.clip(); X.fillStyle = lite(face, .45); X.beginPath(); X.ellipse(-11, pr * 6 - 22, 22, 10, -.3, 0, TAU); X.fill(); X.restore();
    shoe(-4, pr * 6 - 10, held ? -.3 : 0, .52, lite(COL[rl], held ? .05 : .15));
    // the label on a ribbon across the bottom of the button (wider than the button, kept on screen)
    X.font = '700 19px Fredoka, "Helvetica Neue", Arial, sans-serif'; const lw = clamp(X.measureText(t(label)).width + 26, 76, 150), rx = clamp(0, lw / 2 + 12 - bx, 788 - lw / 2 - bx);
    rr(rx - lw / 2, pr * 6 + 16, lw, 28, 14); ink(ok ? '#eaffef' : '#fffdf6', 3.5); txt(label, rx, pr * 6 + 31, 19, INK, 'center', lw - 14);
    ctx.restore();
    const tx = rl ? Math.min(bx - 22, 686) : Math.max(bx + 22, 114);   // the cue sits above my button, clear of the screen frame
    if (myTurn) { const k = Math.abs(Math.sin(now * 5)); txt('YOUR TURN!', tx, by - BR - 26 - k * 6, 24, YEL, 'center', 180); }
    else if (!mine.up && !g.result && !fall && (fr.up || (free && behind(1 - rl)))) txt("FRIEND'S TURN", tx, by - BR - 22, 18, '#fff', 'center', 190);
    ctx.restore();
  }
  function progress() {
    const x0 = 362, x1 = 646, y = 86, span = (B1 + 80) - (B0 - 80), mx = wx => x0 + clamp((wx - (B0 - 80)) / span, 0, 1) * (x1 - x0);
    X = ctx;
    rr(x0 - 16, y - 12, x1 - x0 + 32, 24, 12); ink(WAT1, 3.5);
    rr(x0 - 16, y - 12, mx(B0) - x0 + 16, 24, 12); ink(GRASS, 0); X.fillRect(mx(B0) - 12, y - 12, 12, 24);
    rr(mx(B1), y - 12, x1 + 16 - mx(B1), 24, 12); ink(GRASS, 0); X.fillRect(mx(B1), y - 12, 12, 24);
    rr(x0 - 16, y - 12, x1 - x0 + 32, 24, 12); ink(null, 3.5);
    for (let k = 1; k < LAST; k++) { X.beginPath(); X.ellipse(mx(F[k].c), y + 1, 7, 5, 0, 0, TAU); ink(k <= best ? STONEL : STONE, 2); }
    for (const l of legs) { X.beginPath(); X.arc(mx(l.a), y + 1, 6, 0, TAU); ink(COL[l.i], 2.5); }
    caos(mx(hxS), y - 6, 1.5, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
    star(x1 + 30, y, 13, 6, 5, now * 1.5, best === LAST ? YEL : '#fff', 2.5);
  }
  g.dbg = {
    F, LAST, MAXS,
    me: () => ({ a: mine.a, k: mine.k, up: mine.up, x: mine.up ? swingX(mine) : mine.a, cap: (mine.up ? mine.o : fr.a) + MAXS, locked: g.result || stun > 0 || g.c < GO0 || g.c < mine.wet }),
    fr: () => ({ a: fr.a, up: fr.up }),
  };
  wire(g, D, 0, sp, 'du_legs');
  return g;
}

/* ───────────── intro card: what each leg does (520×240 frame, origin top-left) ───────────── */
DUO.INFO.du_legs = [['LEFT LEG', 'STEP WITH THE LEFT LEG', 'HOLD, LET GO ON A STONE'], ['RIGHT LEG', 'STEP WITH THE RIGHT LEG', 'HOLD, LET GO ON A STONE']];
let DSKY = null, DBACK = null, DSTONES = null;
const DST = [96, 200, 304, 408], DGY = 168, DWY = 182;
/* a 3.8 s loop that teaches the whole game, in the real order: the LEFT leg steps first (.4-1.35 s, st0 -> st2), then the RIGHT leg
   (1.75-2.6 s, st1 -> st3), then it is the left leg's turn again. demo(r) is about leg r. On the "YOU" beat (r = my role) leg r is YOU
   and its cues are YOUR TURN! / LET GO!; on the friend beat (party.js shows the partner's demo, from t = 1.3) leg r is FRIEND, the
   other one is YOU, and the cues are FRIEND'S TURN / STEP!. Each beat starts the loop where leg r's own step is in view. */
function demo(r) {
  return t => {
    X = ctx; const own = r === DROLE, off = own ? (r ? 1 : 0) : (r ? .15 : -1.2), T = ((t + off) % 3.8 + 3.8) % 3.8;
    const sc = .5, gy = DGY, wy = DWY, st = DST, cols = DCOL, o = 1 - r;
    if (!SKY) buildSky();
    if (!DSKY) { DSKY = ctx.createLinearGradient(0, 0, 0, 240); DSKY.addColorStop(0, '#3fb0ff'); DSKY.addColorStop(.7, '#bdeeff'); DSKY.addColorStop(1, '#e6fbff'); }
    if (!DBACK) {
      DBACK = onto(mkC(520, 240), () => { X.drawImage(MTN, 100, 0, 1100, 260, -10, 66, 560, 132); X.drawImage(HILL, 200, 0, 1100, 200, -10, 92, 560, 102);
        const g = X.createLinearGradient(0, wy, 0, 240); g.addColorStop(0, WAT0); g.addColorStop(.5, WAT1); g.addColorStop(1, WAT2); X.fillStyle = g; X.fillRect(0, wy, 520, 60); });
      DSTONES = onto(mkC(520, 240), () => { for (const c of st) stoneDraw(c - 30, 60, gy, wy + 22, .3, .8, wy + 2); });
    }
    ctx.fillStyle = DSKY; ctx.fillRect(0, 0, 520, 240);
    ctx.drawImage(CLOUD[0], 20 + Math.sin(t * .5) * 8, -38, 160, 88); ctx.drawImage(CLOUD[2], 300 + Math.sin(t * .4 + 1) * 8, -30, 150, 82);
    ctx.drawImage(DBACK, 0, 0);
    ctx.fillStyle = '#9ce9ff'; ctx.beginPath(); ctx.moveTo(0, wy + 4); for (let x = 0; x <= 520; x += 20) ctx.lineTo(x, wy + Math.sin(x * .06 + t * 2.4) * 1.6); ctx.lineTo(520, wy + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = FOAM; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 7; i++) { const x = (i * 83 + t * 14) % 560 - 20, y = wy + 18 + (i * 23 % 40); ctx.globalAlpha = .5 + .3 * Math.sin(t * 3 + i); line(x, y, x + 22, y); } ctx.globalAlpha = 1;
    ctx.drawImage(DSTONES, 0, 0);
    ctx.strokeStyle = 'rgba(230,250,255,.9)'; ctx.lineWidth = 2.5; for (let i = 0; i < 4; i++) { const k = (t * .9 + i * .3) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(st[i], wy + 3, 33 + k * 14, 4 + k * 3, 0, 0, Math.PI); ctx.stroke(); } ctx.globalAlpha = 1;
    const S0 = [.4, 1.75], S1 = [1.35, 2.6], sw = (k, a, b) => lerp(a, b, 1 - (1 - k) * (1 - k));
    const k = [0, 1].map(i => clamp((T - S0[i]) / (S1[i] - S0[i]), 0, 1)), on = [0, 1].map(i => T > S0[i] && T < S1[i]);
    const x = [0, 1].map(i => on[i] ? sw(k[i], st[i], st[i + 2]) : T >= S1[i] ? st[i + 2] : st[i]), a = [0, 1].map(i => T >= S1[i] ? st[i + 2] : st[i]);
    const lift = i => on[i] ? 30 * easeOut(k[i] * 5) : T >= S1[i] ? 30 * Math.max(0, 1 - (T - S1[i]) / .08) : 0;
    const fe = [0, 1].map(i => [x[i], gy - ANK * sc - lift(i), on[i] ? -.22 : 0]);
    const mid0 = (st[0] + st[1]) / 2, mid1 = (st[1] + st[2]) / 2, mid2 = (st[2] + st[3]) / 2, endA = mid0 + (st[2] - st[0]) * .2, endB = mid1 + (st[3] - st[1]) * .2;
    const hx = T < S0[0] ? mid0 : on[0] ? mid0 + (x[0] - st[0]) * .2 : T < S0[1] ? lerp(endA, mid1, ease((T - S1[0]) / .25)) : on[1] ? mid1 + (x[1] - st[1]) * .2 : lerp(endB, mid2, ease((T - S1[1]) / .25));
    let md = 0; for (const i of [0, 1]) if (!on[i]) md = Math.max(md, Math.abs(hx + (i ? HIPX : -HIPX) * sc - a[i]) / sc);
    const hy = gy - ANK * sc - Math.sqrt(Math.max(REACH * REACH - md * md, 120 * 120)) * sc;
    const ok = [0, 1].map(i => on[i] && x[i] >= st[i + 2] - 30), turn = [T < S0[0] || T >= S1[1] + .1, T >= S1[0] + .15 && T < S0[1]];
    // dotted path + landing ring of a swinging foot (green = a stone ahead, white = not yet); the focus leg's is bolder
    const path = (i) => { const fx = x[i], lf = lift(i), b = i === r; ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.lineWidth = b ? 4 : 3; ctx.strokeStyle = '#fff'; ctx.globalAlpha = b ? 1 : .8;
      ctx.beginPath(); ctx.moveTo(fx, gy - lf); ctx.quadraticCurveTo(fx + 20, gy - 40, fx + 6, gy); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(fx + 2, gy, 20, 6, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = ok[i] ? GO : '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 1; };
    for (const i of [0, 1]) if (on[i]) path(i);
    for (const i of [0, 1]) { const tl = S1[i]; if (T >= tl && T - tl < .3) { const q = (T - tl) / .3; ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(st[i + 2], gy, 20 + q * 30, 6 + q * 6, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } }
    // the "turn" glow on leg r's planted foot, in its colour
    if (turn[r]) { const q = (t * 1.6) % 1; ctx.strokeStyle = cols[r]; ctx.lineWidth = 4 * (1 - q) + 1; ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.ellipse(a[r] + 2, gy + 2, 22 + q * 16, 6 + q * 4, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    const sq = Math.min(T - S1[0], T - S1[1]), bob = sq >= 0 && sq < .25 ? Math.sin(sq / .25 * Math.PI) * 3 : 0, landed = (T >= S1[0] && T < S1[0] + .5) || (T >= S1[1] && T < S1[1] + .5);
    walker({ hx, hy: hy + bob, rot: on[0] || on[1] ? .05 : Math.sin(t * 2) * .02, sq: 1 - bob * .02, feet: fe, order: on[0] ? [1, 0] : [0, 1],
      mood: on[0] || on[1] ? (ok[0] || ok[1] ? 'focus' : 'strain') : landed ? 'happy' : 'idle', look: on[0] || on[1] ? 1 : 0 }, sc, cols);
    // name tags: under the planted feet, above a swinging one
    const tag = (i, lab, sz) => { const sx = fe[i][0] + 2;   // a swinging foot's tag stays clear of leg r's button ribbon (it sits in the top corner on that side)
      if (on[i]) { const x = i !== r ? sx : r ? Math.min(sx, 346) : Math.max(sx, 202); pill(x, fe[i][1] - 26, lab, cols[i], sz, clamp(sx, x - 18, x + 18), false); }
      else pill(sx, gy + 34, lab, cols[i], sz, sx, true); };
    tag(r, own ? 'YOU' : 'FRIEND', own ? 16 : 14); tag(o, own ? 'FRIEND' : 'YOU', own ? 14 : 16);
    // leg r's button (HOLD -> KEEP GOING -> LET GO!), the finger holding it during the step; on the friend beat a tiny Caos in their colour stands on it
    const bx = r ? 462 : 58, by = 80, pr = on[r] ? 1 : 0, face = on[r] ? (ok[r] ? GO : YEL) : cols[r], label = on[r] ? (ok[r] ? 'LET GO!' : 'KEEP GOING') : 'HOLD';
    const ps = turn[r] ? 1 + .06 * (.5 + .5 * Math.sin(t * 8)) : 1;
    ctx.save(); ctx.translate(bx, by); ctx.scale(ps, ps);
    if (turn[r]) { const q = (t * 1.6) % 1; ctx.globalAlpha = 1 - q; ctx.strokeStyle = cols[r]; ctx.lineWidth = 5 * (1 - q) + 1; ctx.beginPath(); ctx.arc(0, 4, 50 + q * 14, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    X.beginPath(); X.arc(0, 8, 44, 0, TAU); ink(dark(face, .4), 4.5); X.beginPath(); X.arc(0, pr * 6, 44, 0, TAU); ink(face, 4.5);
    X.save(); X.beginPath(); X.arc(0, pr * 6, 44, 0, TAU); X.clip(); X.fillStyle = lite(face, .45); X.beginPath(); X.ellipse(-12, pr * 6 - 25, 23, 10, -.3, 0, TAU); X.fill(); X.restore();
    shoe(-4, pr * 6 - 12, on[r] ? -.3 : 0, .54, lite(cols[r], .15));
    X.font = '700 22px Fredoka, "Helvetica Neue", Arial, sans-serif'; const lw = clamp(X.measureText(t2(label)).width + 26, 84, 150), rx = clamp(0, lw / 2 + 6 - bx, 514 - lw / 2 - bx);
    rr(rx - lw / 2, pr * 6 + 18, lw, 32, 16); ink(ok[r] ? '#eaffef' : '#fffdf6', 3.5); txt(label, rx, pr * 6 + 35, 22, INK, 'center', lw - 14);
    ctx.restore();
    if (!own) caos(bx + (r ? 28 : -28), by - 31 + pr * 6, 2.7, { col: cols[r], mood: on[r] ? 'happy' : null });
    demoFinger(bx + (r ? -22 : 22), by - 14 + pr * 6, on[r], k[r] * 2 % 1);   // on the button face, clear of the label
    // the big cue high in the sky, on the side away from the walker and clear of the button
    const lo = r ? 118 : 222, hi = r ? 300 : 402, cx = lerp(hi, lo, ease((hx - 230) / 70)), cy = 27;
    if (ok[r]) { const q = 1 + .08 * Math.sin(t * 24); ctx.save(); ctx.translate(cx, cy); ctx.scale(q, q); txt(own ? 'LET GO!' : 'STEP!', 0, 0, 28, GO, 'center', 200); ctx.restore(); }
    else if (turn[r] || on[r]) { const q = Math.abs(Math.sin(t * 5)); txt(own ? 'YOUR TURN!' : "FRIEND'S TURN", cx, cy - q * 3, own ? 26 : 22, own ? YEL : '#fff', 'center', 200); }
    else if (turn[o] || on[o]) { const q = Math.abs(Math.sin(t * 5)); txt(own ? "FRIEND'S TURN" : 'YOUR TURN!', cx, cy - (own ? 0 : q * 3), own ? 22 : 26, own ? '#fff' : YEL, 'center', 200); }
    if (T > 3.5) { ctx.fillStyle = `rgba(230,250,255,${(T - 3.5) / .3})`; ctx.fillRect(0, 0, 520, 240); }
  };
}
DUO.DEMOS.du_legs = [demo(0), demo(1)];
reg('du_legs', duLegs, 'WOBBLE WALK'); REGMAP.du_legs.duo = true;
})();
