'use strict';
/* ═════════ DUO · JAR WARS (du_jar), after Twisted! (Move It!) ═════════
   A tiny fat pickle jar with a lid welded shut sits on a kitchen table that rumbles because a washing machine is spinning next to it.
   HOLDER (role 0, JUDGE): keeps the jar steady. The table (a seeded wander D(t)) and the twister's torque kicks K shove the jar; the holder sees
   a moving GREEN zone on a spirit level (its centre = D + K = where the jar wants to lean) and slides a bubble (pointer x, or ← →) into it.
   Tilt = D + K - c. While the tilt is inside the green the jar is "steady"; the more it leans, the more the jar creeps to the table edge.
   TWISTER (role 1): circles the pointer around the lid (or holds Space / any arrow / A / D) = twist power pw 0..1. The lid only turns while the
   jar is steady, and each click of the lid (1/NC of the turn) with hard power gives the jar a kick ±pw² (the holder sees the next kick coming
   as a charging arrow: its direction is in the seeded list ks, its charge is the progress to the next click). The twister reads the jar (tilt) and
   the lid grip (it buzzes when the jar is not steady).  Lid fully off = POP = win. The jar slides off the table (or time ends) = lose.
   Netcode: the TWISTER owns its power: 'tw' [pw×100, seq] (coalesced, ≤10/s, repeated every .25 s so a stale value never sticks).
   The HOLDER (judge) owns the physics and publishes 'st' [P, K, th, sl, seq] (×1000, ≤10/s, latest): the twister predicts its own progress from its
   power and the tilt it sees, and eases to P. The judge sends the verdict ('end', via wire). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MC = new Map();
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const JX = 372, JY0 = 426, JY1 = 462;                 // the jar's base: x, y at the back of the table / at the front edge (slide meter)
const JH = 122;                                        // jar body height; lid centre is JH + 21 above the base
const TT = 406, TF = 468;                              // table top: back edge y, front edge y
const LV = [186, 498, 372, 46];                        // the spirit level / torque plate (x, y, w, h)
const LVX = 372, LVS = 128;                            // level: x of the centre, px per tilt unit
const COL_X = 496;                                     // the twister's crate

/* tuning */
const NC = 18;                                         // clicks per full unscrew
const G = .24, G2 = .48;                                 // tilt inside G = fully steady, outside G2 = the lid slips
const SLIPT = .5;                                      // tilt beyond this makes the jar creep to the edge
const FULL = TAU * 1.25;                               // rad/s of pointer circling = full power
const KM = .5, KTAU = .5;                              // kick size at full power, kick decay time

/* palette */
const WALL = '#ffe7a8', WALL2 = '#fff3cf', TILE = '#bfeadf', TILE2 = '#7cc7b4';
const JUICE = '#b8e03a';
const GLASS = '#c8f1d9', GLASS2 = '#8fd3ae', BRINE = '#d4eb7e', BRINE2 = '#b3d155';
const PICK = '#5aa83a', PICK2 = '#3d7f2a', PICKL = '#9bd868';
const GOLD = '#ffcf33', GOLD2 = '#d99a12';
const CLOTH = '#ff7a8a', CLOTH2 = '#e0485f';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function cel(path, base, shade, sx, sy) {              // base/shade/light: fill the shade, then the base again shifted by (-sx, -sy), clipped to the shape
  path(); ink(shade, 0); X.save(); path(); X.clip(); X.translate(-sx, -sy); path(); X.fillStyle = base; X.fill(); X.restore();
}
function pill(x, y, label, col) {
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  X.beginPath(); X.moveTo(x - 9, y + 13); X.lineTo(x, y + 24); X.lineTo(x + 9, y + 13); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(250, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 250);
  X.restore();
}
function keyCap(s, x, y) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.max(30, X.measureText(s).width + 16);
  rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w);
}
function drop(x, y, r, col) {
  X.beginPath(); X.moveTo(x, y - r * 1.7); X.quadraticCurveTo(x + r * 1.1, y - r * .2, x, y + r); X.quadraticCurveTo(x - r * 1.1, y - r * .2, x, y - r * 1.7); X.closePath();
  ink(col || BRINE, 2); X.fillStyle = 'rgba(255,255,255,.75)'; el(x - r * .3, y - r * .3, r * .28, r * .4, -.4); X.fill();
}
function heart(x, y, s, col) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 6); X.bezierCurveTo(-14, -4, -8, -14, 0, -6); X.bezierCurveTo(8, -14, 14, -4, 0, 6); X.closePath(); ink(col || '#ff5c8a', 2.5); X.restore();
}
function sweat(x, y, T, k) {                           // a drop that slides and fades
  const q = (T * 1.6 + k) % 1; X.globalAlpha = 1 - q; drop(x, y + q * 16, 3.4, '#9fe3ff'); X.globalAlpha = 1;
}
function arrow(x, y, dir, s, col) {                    // a fat horizontal arrow
  X.save(); X.translate(x, y); X.scale(dir * s, s); X.beginPath(); X.moveTo(-18, -7); X.lineTo(2, -7); X.lineTo(2, -15); X.lineTo(20, 0); X.lineTo(2, 15); X.lineTo(2, 7); X.lineTo(-18, 7); X.closePath(); ink(col, 3); X.restore();
}
/* a blocky arm from a shoulder to a hand (with an elbow bump), the hand is a white-glossed square */
function armTo(sx, sy, hx, hy, col, u, bend) {
  const mx = (sx + hx) / 2 + bend * 0, my = (sy + hy) / 2 + bend, w = u * 1.25;
  X.beginPath(); X.moveTo(sx, sy); X.quadraticCurveTo(mx, my, hx, hy); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke();
  const hs = u * 1.9; X.fillStyle = INK; X.fillRect(hx - hs / 2 - 3, hy - hs / 2 - 3, hs + 6, hs + 6); X.fillStyle = col; X.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(hx - hs / 2, hy - hs / 2, hs * .45, hs * .4);
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 23; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ───────────── the static kitchen, painted once into an offscreen canvas ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 470); g.addColorStop(0, WALL); g.addColorStop(1, WALL2); X.fillStyle = g; X.fillRect(0, 0, W, 470);
  X.fillStyle = 'rgba(217,119,87,.13)'; for (let x = 0; x < W; x += 48) X.fillRect(x, 0, 22, 470);                     // wallpaper stripes
  X.fillStyle = 'rgba(255,120,150,.4)'; for (let i = 0; i < 40; i++) { const x = 24 + (i % 10) * 80 + (i % 3) * 9, y = 20 + Math.floor(i / 10) * 40 + (i % 2) * 14; if (y > 220) continue; X.beginPath(); X.arc(x, y, 4, 0, TAU); X.fill(); }
  // tile backsplash behind the table
  X.fillStyle = TILE; X.fillRect(0, 252, W, 218);
  X.strokeStyle = TILE2; X.lineWidth = 2; X.beginPath(); for (let y = 252; y <= 470; y += 36) { X.moveTo(0, y); X.lineTo(W, y); } for (let r = 0, y = 252; y < 470; r++, y += 36) for (let x = (r % 2) * 22; x < W; x += 44) { X.moveTo(x, y); X.lineTo(x, y + 36); } X.stroke();
  X.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 20; x < W; x += 132) { X.save(); X.translate(x, 275); X.rotate(-.3); X.fillRect(0, 0, 22, 4); X.restore(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 252); X.lineTo(W, 252); X.stroke();
  // window with a curtain
  rr(404, 112, 150, 106, 10); ink('#fff', 4); rr(412, 120, 134, 90, 6); ink('#7cd0ff', 3);
  X.save(); rr(412, 120, 134, 90, 6); X.clip(); X.fillStyle = '#d6f7ff'; X.fillRect(412, 156, 134, 54); X.fillStyle = '#9be38a'; X.beginPath(); X.moveTo(412, 210); X.quadraticCurveTo(450, 160, 490, 190); X.quadraticCurveTo(520, 170, 546, 200); X.lineTo(546, 210); X.fill();
  X.fillStyle = '#ffe14d'; X.beginPath(); X.arc(520, 142, 12, 0, TAU); X.fill(); X.restore();
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(479, 120); X.lineTo(479, 210); X.moveTo(412, 162); X.lineTo(546, 162); X.stroke();
  X.beginPath(); X.moveTo(396, 108); X.quadraticCurveTo(436, 140, 410, 226); X.lineTo(386, 226); X.quadraticCurveTo(396, 160, 380, 108); X.closePath(); ink('#ff9fb3', 3.5);
  X.beginPath(); X.moveTo(562, 108); X.quadraticCurveTo(522, 140, 548, 226); X.lineTo(572, 226); X.quadraticCurveTo(562, 160, 578, 108); X.closePath(); ink('#ff9fb3', 3.5);
  X.fillStyle = INK; X.fillRect(372, 102, 214, 8);
  // a shelf with pickle jars' cousins (top left stays clear above y 150)
  rr(24, 176, 232, 12, 4); ink('#d9944f', 3.5);
  [[52, '#ff8a6a'], [100, '#ffd23f'], [148, '#9be38a'], [214, '#b49cff']].forEach(([x, c], i) => { const h = 34 + (i % 2) * 8; rr(x - 17, 176 - h, 34, h, 8); ink(c, 3); rr(x - 12, 176 - h - 8, 24, 10, 3); ink(GOLD, 2.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(x - 7, 176 - h / 2, 3, h / 3.5); X.fill(); });
  // floor boards + baseboard
  g = X.createLinearGradient(0, 470, 0, H); g.addColorStop(0, '#d7a066'); g.addColorStop(1, '#a56a3c'); X.fillStyle = g; X.fillRect(0, 470, W, H - 470);
  X.strokeStyle = 'rgba(70,40,20,.35)'; X.lineWidth = 2.5; X.beginPath(); for (let y = 500; y < H; y += 32) { X.moveTo(0, y); X.lineTo(W, y); } for (let r = 0, y = 470; y < H; r++, y += 32) for (let x = (r % 2) * 70 + 20; x < W; x += 140) { X.moveTo(x, y); X.lineTo(x, y + 32); } X.stroke();
  X.fillStyle = '#fff3dc'; X.fillRect(0, 460, W, 12); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 460); X.lineTo(W, 460); X.moveTo(0, 472); X.lineTo(W, 472); X.stroke();
  X = old; return cv2;
}

/* ───────────── the jar ───────────── */
/* base centre at (x, y); tilt in tilt units (±1 = max lean); la = lid angle (rad); shake = lid jitter px; mood for the pickle; pop = 0..1 lid already gone */
function jar(x, y, tilt, la, shake, mood, T, nolid, squash) {
  X.save(); X.translate(x, y); X.rotate(tilt * .26); if (squash) X.scale(1 + squash * .1, 1 - squash * .1);
  X.fillStyle = 'rgba(20,16,28,.25)'; el(0, 3, 70, 9); X.fill();
  const body = () => { rr(-64, -JH, 128, JH, 38); }, neck = () => { rr(-46, -JH - 14, 92, 22, 7); };
  neck(); ink(GLASS, 4); cel(body, GLASS, GLASS2, 9, 6); body(); ink(null, 4.5);
  neck(); X.fillStyle = GLASS; X.fill(); neck(); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); neck(); X.fillStyle = GLASS; X.fill();
  // brine + pickles, clipped inside the glass
  X.save(); rr(-56, -JH + 12, 112, JH - 20, 30); X.clip();
  X.fillStyle = BRINE; X.fillRect(-60, -JH + 12, 120, JH); X.fillStyle = BRINE2; X.fillRect(-60, -JH + 12, 120, 8);
  X.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 5; i++) { const q = (T * .5 + i * .21) % 1; X.beginPath(); X.arc(-40 + i * 20 + Math.sin(T * 3 + i) * 3, -10 - q * (JH - 40), 2.4 + (i % 2), 0, TAU); X.fill(); }   // bubbles
  const pk = (px, py, rot, big, face) => {
    X.save(); X.translate(px, py); X.rotate(rot);
    const sh = () => { rr(-34 * big, -15 * big, 68 * big, 30 * big, 15 * big); };
    sh(); ink(PICK, 3.5); cel(sh, PICK, PICK2, 5, 5); sh(); ink(null, 3.5);
    X.fillStyle = PICKL; for (const [a, b] of [[-18, -5], [-6, 5], [10, -6], [22, 4], [0, -8]]) { el(a * big, b * big, 2.6, 1.8); X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.4)'; el(-14 * big, -8 * big, 11 * big, 3 * big); X.fill();
    if (face) {
      const ey = -2 * big, pan = mood === 'panic', hap = mood === 'happy', sad = mood === 'sad';
      for (const sx of [-1, 1]) {
        const ex = sx * 9 * big; el(ex, ey, 7 * big, (pan ? 9 : 7.5) * big); ink('#fff', 2);
        if (hap) { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(ex, ey + 2, 4, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
        else { const lx = Math.sin(T * 1.7) * 1.5; el(ex + lx, ey + (pan ? 0 : 1), pan ? 1.8 : 3, pan ? 1.8 : 3.4); X.fillStyle = INK; X.fill(); }
        if (sad) { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(ex - 5, ey - 8); X.lineTo(ex + 5, ey - 11); X.stroke(); }
      }
      X.strokeStyle = INK; X.lineWidth = 2.8; X.beginPath();
      if (hap) X.arc(0, 4 * big, 6, .1, Math.PI - .1); else if (pan) { X.ellipse(0, 8 * big, 4, 5, 0, 0, TAU); } else { X.moveTo(-5, 8 * big); X.quadraticCurveTo(0, 6 * big, 5, 8 * big); }
      X.stroke();
    }
    X.restore();
  };
  pk(-14, -34 + Math.sin(T * 1.9) * 2, -.18 + Math.sin(T * 1.2) * .05, 1, true); pk(16, -78 + Math.sin(T * 1.7 + 1) * 2, .5, .86, false);
  X.restore();
  // label
  rr(-44, -86, 88, 36, 8); ink('#fff6dc', 3); X.fillStyle = '#e3555a'; X.fillRect(-40, -52, 80, 4);
  txt('PICKLES', 0, -69, 15, INK, 'center', 78);
  X.fillStyle = 'rgba(255,255,255,.7)'; el(-48, -62, 5, 24, .1); X.fill();
  // lid
  if (!nolid) lid(0, -JH - 8, la, shake, T);
  X.restore();
}
function lid(x, y, la, shake, T) {                    // a gold screw lid seen from the side; the ridges slide as it turns
  X.save(); X.translate(x + (shake ? Math.sin(T * 70) * shake : 0), y + (shake ? Math.cos(T * 55) * shake * .5 : 0));
  const body = () => rr(-54, -20, 108, 28, 9);
  body(); ink(GOLD, 4); cel(body, GOLD, GOLD2, 0, 7); body(); ink(null, 4);
  X.save(); body(); X.clip(); X.strokeStyle = '#a56b06'; X.lineWidth = 2.6; X.lineCap = 'round';
  for (let i = 0; i < 14; i++) { const ph = la + i * TAU / 14, c = Math.cos(ph); if (c <= .05) continue; const lx = Math.sin(ph) * 50; X.globalAlpha = .4 + c * .6; X.beginPath(); X.moveTo(lx, -17); X.lineTo(lx, 5); X.stroke(); }
  X.globalAlpha = 1; X.restore();
  X.fillStyle = 'rgba(255,255,255,.6)'; el(-28, -13, 18, 3.2, -.05); X.fill();
  X.restore();
}

/* ───────────── people & props ───────────── */
function crate(x, y, w, h) {
  rr(x - w / 2, y - h, w, h, 4); ink('#d9944f', 4); X.fillStyle = '#b06d33'; X.fillRect(x - w / 2 + 6, y - h + 14, w - 12, 6); X.fillRect(x - w / 2 + 6, y - 20, w - 12, 6);
  X.fillStyle = '#f2b878'; X.fillRect(x - w / 2 + 3, y - h + 3, w - 6, 5);
}
function washer(T, left, rum, done) {                  // the washing machine; the display counts the seconds down, socks spin in the porthole
  const x = 22 + Math.sin(T * 58) * rum * 1.6, y = 232 + Math.cos(T * 71) * rum * 1.2;
  X.fillStyle = 'rgba(20,16,28,.25)'; el(106, 512, 100, 12); X.fill();
  const body = () => rr(x, y, 168, 278, 18);
  body(); ink('#f2f6fb', 4.5); cel(body, '#f2f6fb', '#c4d2e6', 12, 0); body(); ink(null, 4.5);
  X.fillStyle = INK; X.fillRect(x + 6, y + 62, 156, 4);
  rr(x + 14, y + 12, 74, 38, 8); ink('#18302a', 3);                                    // LCD display
  const n = Math.max(0, Math.ceil(left));
  X.font = '900 28px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = done ? '#ff6b6b' : '#5CFF7A'; X.fillText(String(n).padStart(2, '0'), x + 51, y + 32);
  for (const [kx, kc] of [[112, '#ff8a6a'], [142, '#4db8ff']]) { X.beginPath(); X.arc(x + kx, y + 31, 13, 0, TAU); ink(kc, 3); X.save(); X.translate(x + kx, y + 31); X.rotate(T * (kx > 120 ? .6 : -.3)); X.fillStyle = INK; X.fillRect(-1.5, -10, 3, 9); X.restore(); }
  const cx = x + 84, cy = y + 170;
  X.beginPath(); X.arc(cx, cy, 66, 0, TAU); ink('#aab6c8', 4.5); X.beginPath(); X.arc(cx, cy, 52, 0, TAU); ink('#7fc3e8', 3.5);
  X.save(); X.beginPath(); X.arc(cx, cy, 50, 0, TAU); X.clip();
  X.fillStyle = '#bfe8ff'; X.fillRect(cx - 52, cy - 52, 104, 104);
  const sp = T * 5; for (const [r, ph, c, ex] of [[26, 0, '#ff6b8a', 1], [30, 2.1, '#ffd23f', 0], [24, 4.2, '#9b6bff', 1], [14, 1, '#4fd06a', 0]]) {   // socks and a T-shirt tumbling
    const a = sp + ph, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    X.save(); X.translate(px, py); X.rotate(a * 2); if (ex) { rr(-12, -8, 24, 16, 5); ink(c, 3); X.fillStyle = '#fff'; X.fillRect(-12, -2, 24, 4); } else { rr(-7, -13, 14, 26, 6); ink(c, 3); rr(-10, -15, 20, 7, 3); ink('#fff', 2.5); } X.restore();
  }
  X.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 6; i++) { X.beginPath(); X.arc(cx + Math.cos(i * 2.1 + T * 3) * 38, cy + Math.sin(i * 1.7 + T * 2.2) * 38, 3 + (i % 3), 0, TAU); X.fill(); }   // suds
  X.restore();
  X.fillStyle = 'rgba(255,255,255,.6)'; el(cx - 24, cy - 28, 12, 22, .6); X.fill();
}
function table(rum, T) {
  const ox = Math.sin(T * 49) * rum * 1.2, oy = Math.sin(T * 63) * rum * 1.4;
  X.save(); X.translate(ox, oy * .6);
  X.fillStyle = 'rgba(20,16,28,.28)'; el(398, 556, 224, 14); X.fill();
  // legs poke out under the skirt
  for (const lx of [214, 566]) { rr(lx - 8, 500, 16, 56, 4); ink('#b06d33', 3.5); }
  // cloth skirt (zigzag hem)
  X.beginPath(); X.moveTo(196, 472); X.lineTo(600, 472); X.lineTo(592, 534); for (let i = 0; i < 14; i++) X.lineTo(592 - (i + .5) * 28.5, 534 + (i % 2 ? 0 : 14)); X.lineTo(204, 534); X.closePath(); ink(CLOTH, 4);
  X.save(); X.beginPath(); X.moveTo(196, 472); X.lineTo(600, 472); X.lineTo(592, 534); X.lineTo(204, 534); X.closePath(); X.clip();
  X.fillStyle = '#fff'; for (let r = 0; r < 4; r++) for (let c = 0; c < 15; c++) if ((r + c) % 2) X.fillRect(196 + c * 27, 472 + r * 16, 27, 16);
  X.fillStyle = 'rgba(224,72,95,.5)'; X.fillRect(560, 472, 60, 80); X.restore();
  // top plane (seen from above at 3/4) with a darker front edge
  X.beginPath(); X.moveTo(226, TT); X.lineTo(570, TT); X.lineTo(604, TF); X.lineTo(192, TF); X.closePath(); ink('#fff3dc', 4);
  X.save(); X.beginPath(); X.moveTo(226, TT); X.lineTo(570, TT); X.lineTo(604, TF); X.lineTo(192, TF); X.closePath(); X.clip();
  X.fillStyle = 'rgba(255,122,138,.35)'; for (let c = -2; c < 22; c += 2) { X.beginPath(); X.moveTo(226 + c * 17, TT); X.lineTo(226 + c * 17 + 17, TT); X.lineTo(226 + c * 17 + 17 + (c - 8) * 3.2, TF); X.lineTo(226 + c * 17 + (c - 8) * 3.2, TF); X.fill(); }
  X.fillStyle = 'rgba(224,72,95,.28)'; X.fillRect(180, TF - 18, 440, 18); X.restore();
  // the hazard tape on the front edge: the jar is not supposed to reach it
  X.save(); X.beginPath(); X.moveTo(192, TF - 5); X.lineTo(604, TF - 5); X.lineTo(604, TF); X.lineTo(192, TF); X.closePath(); X.clip(); X.fillStyle = '#ffd23f'; X.fillRect(180, TF - 6, 440, 6); X.fillStyle = INK; for (let x = 180; x < 620; x += 22) { X.beginPath(); X.moveTo(x, TF - 6); X.lineTo(x + 11, TF - 6); X.lineTo(x + 5, TF); X.lineTo(x - 6, TF); X.fill(); } X.restore();
  X.restore();
}
function cat(x, y, T, look, mood, eat, tailLift) {     // a ginger cat sitting, big eyes follow (look = [lx, ly]), tail swipes
  X.save(); X.translate(x, y);
  X.fillStyle = 'rgba(20,16,28,.25)'; el(0, 2, 46, 8); X.fill();
  const sw = Math.sin(T * 2.6) * 22 + (tailLift || 0);
  X.beginPath(); X.moveTo(26, -14); X.bezierCurveTo(60 + sw * .3, -10, 66 + sw, -52, 46 + sw * 1.2, -78 - (tailLift || 0) * .4); X.lineCap = 'round'; X.lineWidth = 19; X.strokeStyle = INK; X.stroke(); X.lineWidth = 11; X.strokeStyle = '#f0a24b'; X.stroke();
  const body = () => { X.beginPath(); X.ellipse(0, -28, 34, 30, 0, 0, TAU); };
  body(); ink('#f0a24b', 4); cel(body, '#f0a24b', '#d4822c', 7, 3); body(); ink(null, 4);
  X.strokeStyle = '#c4731f'; X.lineWidth = 3.5; X.lineCap = 'round'; for (const [a, b] of [[16, -42], [22, -30], [14, -18]]) { X.beginPath(); X.moveTo(a, b); X.lineTo(a + 10, b + 3); X.stroke(); }
  for (const sx of [-1, 1]) { el(sx * 16, -4, 12, 8); ink('#f7c47f', 3); }
  const hy = -62 + (eat ? 2 : 0);
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 11, hy - 14); X.lineTo(sx * 27, hy - 36); X.lineTo(sx * 30, hy - 6); X.closePath(); ink('#f0a24b', 3.5); X.beginPath(); X.moveTo(sx * 16, hy - 14); X.lineTo(sx * 24, hy - 28); X.lineTo(sx * 25, hy - 12); X.closePath(); X.fillStyle = '#ff9fb3'; X.fill(); }
  X.beginPath(); X.ellipse(0, hy, 31 + (eat ? 4 : 0), 25 + (eat ? 2 : 0), 0, 0, TAU); ink('#f0a24b', 4); X.fillStyle = 'rgba(255,255,255,.35)'; el(-10, hy - 14, 12, 5, -.3); X.fill();
  el(0, hy + 9, 13, 9); ink('#f7dcb0', 2.5);
  const lx = clamp((look[0] - x) / 140, -1, 1), ly = clamp((look[1] - (y + hy)) / 140, -1, 1);
  for (const sx of [-1, 1]) {
    const ex = sx * 13, ey = hy - 3;
    if (mood === 'happy' || eat) { X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.arc(ex, ey + 2, 6, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
    else if (mood === 'sad') { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(ex - 5, ey - 5); X.lineTo(ex + 5, ey + 5); X.moveTo(ex + 5, ey - 5); X.lineTo(ex - 5, ey + 5); X.stroke(); }
    else { el(ex, ey, 8, 9.5); ink('#fff', 2.5); X.fillStyle = INK; el(ex + lx * 3, ey + ly * 3, 3.2, 6.5); X.fill(); X.fillStyle = '#fff'; el(ex + lx * 3 - 1, ey + ly * 3 - 2, 1.2, 1.5); X.fill(); }
  }
  X.fillStyle = '#ff7a9a'; X.beginPath(); X.moveTo(-4, hy + 3); X.lineTo(4, hy + 3); X.lineTo(0, hy + 8); X.fill();
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); if (eat) { X.moveTo(-8, hy + 12); X.quadraticCurveTo(0, hy + 20 + Math.sin(T * 25) * 3, 8, hy + 12); } else { X.moveTo(0, hy + 8); X.lineTo(0, hy + 12); X.moveTo(-8, hy + 14); X.quadraticCurveTo(0, hy + 9, 8, hy + 14); } X.stroke();
  X.lineWidth = 2; for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 18, hy + 7); X.lineTo(sx * 40, hy + 3); X.moveTo(sx * 18, hy + 11); X.lineTo(sx * 40, hy + 13); X.stroke(); }
  X.restore();
}
function grandma(x, y, T, mood, plate, look) {         // a lilac grandma with a bun, glasses, an apron and a knitting ball; mood: null | worried | happy | scared
  X.save(); X.translate(x, y);
  X.fillStyle = 'rgba(20,16,28,.25)'; el(0, 2, 50, 8); X.fill();
  const rock = Math.sin(T * 1.8) * .015; X.rotate(rock);
  const dress = () => { X.beginPath(); X.moveTo(-34, -78); X.quadraticCurveTo(-52, -20, -50, 0); X.lineTo(50, 0); X.quadraticCurveTo(52, -20, 34, -78); X.closePath(); };
  dress(); ink('#c8a2e8', 4); cel(dress, '#c8a2e8', '#9d73c4', 9, 0); dress(); ink(null, 4);
  rr(-24, -66, 48, 66, 12); ink('#fff', 3); X.fillStyle = '#ff9fb3'; for (const a of [-12, 0, 12]) { X.beginPath(); X.arc(a, -34, 3, 0, TAU); X.fill(); }
  for (const sx of [-1, 1]) { el(sx * 16, 3, 15, 8); ink('#ffe0b8', 3); }
  // arms
  const up = plate;
  if (up) {
    armTo(-30, -66, -52, -90 - Math.sin(T * 12) * 4, '#ffe0b8', 3, 0); armTo(30, -66, 36, -122, '#ffe0b8', 3, -6);
  } else if (mood === 'scared') { armTo(-30, -66, -16, -118, '#ffe0b8', 3, 0); armTo(30, -66, 16, -118, '#ffe0b8', 3, 0); }
  else { armTo(-30, -66, -30, -34 + Math.sin(T * 3) * 2, '#ffe0b8', 3, 6); armTo(30, -66, 32, -36, '#ffe0b8', 3, -4); }
  const hy = -112;
  X.beginPath(); X.arc(0, hy - 38, 21, 0, TAU); ink('#e4e4ee', 3.5); X.beginPath(); X.arc(0, hy - 52, 9, 0, TAU); ink('#e4e4ee', 3);       // bun
  el(0, hy, 33, 34); ink('#ffe0b8', 4); X.fillStyle = 'rgba(255,255,255,.35)'; el(-12, hy - 16, 10, 5, -.4); X.fill();
  X.fillStyle = '#e4e4ee'; X.beginPath(); X.moveTo(-33, hy - 6); X.quadraticCurveTo(-30, hy - 34, 0, hy - 34); X.quadraticCurveTo(30, hy - 34, 33, hy - 6); X.quadraticCurveTo(20, hy - 22, 0, hy - 22); X.quadraticCurveTo(-20, hy - 22, -33, hy - 6); X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  const lx = clamp((look[0] - x) / 160, -1, 1), ly = clamp((look[1] - (y + hy)) / 160, -1, 1);
  for (const sx of [-1, 1]) {
    const ex = sx * 13, ey = hy - 2;
    el(ex, ey, 11, 11); ink('rgba(255,255,255,.85)', 3);
    if (mood === 'happy') { X.strokeStyle = INK; X.lineWidth = 3.4; X.beginPath(); X.arc(ex, ey + 3, 5.5, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
    else { const w = mood === 'scared' ? 1.4 : 1; el(ex + lx * 3, ey + ly * 3, 3.2 * w, 3.2 * w); X.fillStyle = INK; X.fill(); X.fillStyle = '#fff'; el(ex + lx * 3 - 1, ey + ly * 3 - 1.2, 1, 1); X.fill(); }
  }
  X.beginPath(); X.moveTo(-3, hy - 2); X.lineTo(3, hy - 2); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  X.fillStyle = 'rgba(255,120,140,.55)'; for (const sx of [-1, 1]) { el(sx * 22, hy + 10, 7, 4.5); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 3.2; X.beginPath();
  if (mood === 'happy') X.arc(0, hy + 10, 8, .15, Math.PI - .15); else if (mood === 'scared') X.ellipse(0, hy + 17, 5, 7, 0, 0, TAU); else if (mood === 'worried') { X.moveTo(-7, hy + 18); X.quadraticCurveTo(0, hy + 12, 7, hy + 18); } else { X.moveTo(-6, hy + 15); X.quadraticCurveTo(0, hy + 20, 6, hy + 15); }
  X.stroke();
  if (mood === 'worried' || mood === 'scared') sweat(26, hy - 12, T, 0);
  if (plate) { el(-56, -96 - Math.sin(T * 12) * 4, 24, 7); ink('#fff', 3); }
  else { X.beginPath(); X.arc(-40, -22, 14, 0, TAU); ink('#ff7a8a', 3); X.strokeStyle = '#c93b57'; X.lineWidth = 2; X.beginPath(); X.arc(-40, -22, 8, .5, 3); X.stroke(); }
  X.restore();
}
function fly(T, cx, cy, hov) {
  const a = T * 3.1, x = cx + Math.cos(a) * 54 + Math.sin(T * 11) * 6 + hov, y = cy + Math.sin(a * 1.3) * 28 + Math.cos(T * 13) * 4;
  X.setLineDash([3, 6]); X.strokeStyle = 'rgba(20,16,28,.4)'; X.lineWidth = 2; X.beginPath(); for (let i = 1; i < 14; i++) { const b = a - i * .09; X.lineTo(cx + Math.cos(b) * 54 + hov, cy + Math.sin(b * 1.3) * 28); } X.stroke(); X.setLineDash([]);
  X.save(); X.translate(x, y);
  const w = Math.sin(T * 90) * .5; X.fillStyle = 'rgba(255,255,255,.8)'; for (const sx of [-1, 1]) { X.save(); X.rotate(sx * (.6 + w)); el(sx * 6, -7, 3.4, 7); X.fill(); X.lineWidth = 1.5; X.strokeStyle = INK; X.stroke(); X.restore(); }
  el(0, 0, 6, 4.5); ink('#3a3550', 2.5); X.fillStyle = '#ff4d5e'; X.beginPath(); X.arc(4, -1, 1.7, 0, TAU); X.fill(); X.restore();
}

/* a pickle-shaped progress bar at the top centre: the lid unscrews as it fills; k 0..1 */
function pickleBar(k, T, flash) {
  const x = 352, y = 66, w = 330, h = 30;
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 6, w, h, 15); X.fill();
  rr(x, y, w, h, 15); ink('#e6f4c8', 4);
  X.save(); rr(x, y, w, h, 15); X.clip(); X.fillStyle = k >= 1 ? '#5CFF7A' : PICK; X.fillRect(x, y, w * k, h); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(x, y + 4, w * k, 6);
  X.fillStyle = PICK2; for (let i = 0; i < 9; i++) { el(x + 22 + i * 36, y + 8 + (i % 2) * 14, 2.6, 1.8); X.fill(); }
  X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 2; X.beginPath(); for (let i = 1; i < NC; i++) { X.moveTo(x + w * i / NC, y + h - 7); X.lineTo(x + w * i / NC, y + h); } X.stroke();
  X.restore();
  rr(x, y, w, h, 15); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  lidIcon(x + w - 4 + (flash > 0 ? Math.sin(T * 60) * 2 : 0), y + h / 2, k);
}
function lidIcon(x, y, k) {                            // a small gold lid at the end of the bar that lifts up as k reaches 1
  X.save(); X.translate(x, y - ease((k - .85) / .15) * 6); X.rotate(.18); rr(-16, -12, 32, 20, 6); ink(GOLD, 3); X.strokeStyle = GOLD2; X.lineWidth = 2; X.beginPath(); for (let i = -2; i <= 2; i++) { X.moveTo(i * 6, -8); X.lineTo(i * 6, 4); } X.stroke(); X.restore();
}

/* ═════════ the game ═════════ */
function duJar(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), hold = D.role === 0, TS = Math.sqrt(sp);
  const ph = [R() * TAU, R() * TAU, R() * TAU], ks = Array.from({ length: 64 }, () => R() < .5 ? -1 : 1);
  const RATE = 7.8;                                      // seconds of perfect full-power twisting for one lid (per sqrt(sp))
  const wander = t => {                                  // what the rumbling table does to the jar, escalating every 4 s
    const A = .62 + .3 * clamp(t / 12, 0, 1), s = t * (1 + (TS - 1) * .5);
    return A * (.66 * Math.sin(.88 * s + ph[0]) + .42 * Math.sin(1.6 * s + ph[1]) + .22 * Math.sin(2.6 * s + ph[2]));
  };
  const steady = th => clamp((G2 - Math.abs(th)) / (G2 - G), 0, 1);
  /* state */
  let c = 0, ct = 0, kx = 0, K = 0, P = 0, sl = 0, th = 0, clicked = 0, twAt = -9, twPw = 0, twS = 0, seq = 0, stSeq = -1, twSeq = -1, stAt = -9;
  let pw = 0, acc = 0, pAng = null, kpow = 0, Pl = 0, Pj = 0, sentTw = -9, lastTw = -1, sentSt = -9, fN = FOCUSN, gripNow = 0;
  let resAt = -1, ending = null, lastKick = -9, lastTkAt = -9, popAt = -9, tkFlash = 0, kickDir = 0, lidA = 0, landed = false, crashed = false, lastClickShown = 0;
  const kHeld = new Set(), thT = track(), kT = track(), slT = track();
  const bits = [], pops = [], kicks = [];
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .8, gr: 900, vr: 0, rot: 0, k: 0 }, o)); }
  const tk = n => { snd(1500 + (n % 3) * 90, .03, 'square', .05, 0, 700); noise(.03, .04, 3000, 1500, 'bandpass'); tkFlash = 1; };
  const lidPos = (tilt, base) => { const a = tilt * .26, d = JH + 8; return [JX + Math.sin(a) * d, base - Math.cos(a) * d]; };
  const baseY = s => lerp(JY0, JY1, clamp(s, 0, 1));
  function addKick(dir, mag) { lastKick = g.c; kickDir = dir; kicks.push({ t: g.c, dir, mag }); if (kicks.length > 4) kicks.shift(); }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: hold ? 'STEADY!' : 'TWIST!', roleLabel: hold ? 'HOLDER' : 'TWISTER',
    hint: hold ? 'KEEP YOUR BUBBLE INSIDE THE GREEN (MOUSE OR ◄ ►) - THE LID ONLY TURNS WHILE THE JAR IS STEADY' : 'CIRCLE THE MOUSE AROUND THE LID (OR HOLD SPACE) - TWIST HARD WHEN THE JAR IS STEADY, EASE OFF WHEN IT SHUDDERS',
    thint: hold ? 'DRAG LEFT / RIGHT TO KEEP THE BUBBLE IN THE GREEN - THE LID ONLY TURNS WHILE THE JAR IS STEADY' : 'DRAG IN CIRCLES AROUND THE LID - TWIST HARD WHEN THE JAR IS STEADY, EASE OFF WHEN IT SHUDDERS',
    update(dt) {
      g.c += dt; tkFlash = Math.max(0, tkFlash - dt * 6);
      if (g.result && resAt < 0) resAt = g.c;
      const done = !!(g.result || ending);
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); kx = 0; pAng = null; }
      if (hold) {
        // my lean: pointer target + arrows; the bubble follows it
        if (!done) { if (kx) ct = clamp(ct + kx * 2.8 * dt, -1.3, 1.3); c += (ct - c) * Math.min(1, dt * 20); }
        const tw = g.c - twAt < .45 ? twPw : 0; twS += (tw - twS) * Math.min(1, dt * 9);
        // physics
        K *= Math.exp(-dt / KTAU);
        const D0 = wander(g.c); th = D0 + K - c;
        const stf = done ? 0 : steady(th);
        if (!done) {
          const rate = twS * stf * TS * TS / RATE; P = Math.min(1, P + rate * dt);
          const n = Math.floor(P * NC + 1e-6);
          while (clicked < n) { clicked++; tk(clicked); if (twS > .4) { const mag = KM * twS * twS, dir = ks[clicked % 64]; K += dir * mag; addKick(dir, mag); } }
          const ex = Math.abs(th) - SLIPT; if (ex > 0) sl += dt * .85 * ex / (1 - SLIPT) * (1 + TS * .12); else sl = Math.max(0, sl - dt * .4);
          sl = clamp(sl, 0, 1);
          if (P >= 1) { popAt = g.c; ending = { res: 'win' }; g.finish('win'); }
          else if (sl >= 1) { ending = { res: 'lose' }; g.finish('lose'); }
          else if (g.c >= g.limit) { ending = { res: 'lose' }; g.finish('lose'); }
        }
        if (g.c - sentSt >= .1) { sentSt = g.c; D.send('st', [Math.round(P * 1000), Math.round(K * 1000), Math.round(th * 1000), Math.round(sl * 1000), ++seq], true); }
      } else {
        // my twist: pointer circling around the lid (angular speed) or any held key (ramps up)
        const keyDown = kHeld.size > 0 && !done;
        kpow = keyDown ? Math.min(1, kpow + dt * 1.8) : Math.max(0, kpow - dt * 5);
        const spd = acc / Math.max(dt, 1e-3); acc = 0;
        const target = done ? 0 : Math.max(clamp(spd / FULL, 0, 1), kpow);
        pw += (target - pw) * Math.min(1, dt * (target > pw ? 12 : 7)); if (pw < .02) pw = 0;
        const q = Math.round(pw * 100);
        if ((q !== lastTw && g.c - sentTw >= .1) || g.c - sentTw >= .25) { lastTw = q; sentTw = g.c; D.send('tw', [q, ++seq], true); }
        // prediction: my own progress from my power and the tilt I see; eased toward the judge's number
        const tilt = thT.at(), thN = tilt === null ? 0 : tilt; gripNow = steady(thN);
        const rate = pw * gripNow * TS * TS / RATE;
        if (!done) {
          Pl += rate * dt + (Math.min(.995, Pj + rate * .22) - Pl) * Math.min(1, dt * 3.5); Pl = clamp(Pl, 0, .995);
          const n = Math.floor(Pl * NC + 1e-6); if (n > lastClickShown) { lastClickShown = n; tk(n); }
        }
      }
      lidA += (hold ? twS : pw) * gripNow * dt * 6;
      if (hold) lidA = P * 3.4 * TAU;
      // cosmetic
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1.1) pops.length = 0;
      while (kicks.length && g.c - kicks[0].t > .7) kicks.shift();
    },
    msg(type, d) {
      if (!Array.isArray(d)) return;
      if (hold) {
        if (type === 'tw' && d[1] > twSeq) { twSeq = d[1]; twPw = clamp(d[0] / 100, 0, 1); twAt = g.c; }
      } else if (type === 'st' && d[4] > stSeq) {
        stSeq = d[4]; Pj = d[0] / 1000; const k0 = K; K = d[1] / 1000; thT.push(d[2] / 1000); slT.push(d[3] / 1000); stAt = g.c;
        if (Math.abs(K - k0) > .12 && Math.sign(K - k0) !== 0) addKick(Math.sign(K - k0), Math.abs(K - k0));
      }
    },
    draw() {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose'; if (g.result && resAt < 0) resAt = g.c;
      const rk = resAt >= 0 ? T - resAt : -1;
      X = ctx; if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      // what each screen knows
      const tilt = hold ? th : (thT.at() === null ? 0 : thT.at()), slide = hold ? sl : (slT.at() === null ? 0 : slT.at());
      const pwSee = hold ? twS : pw, Pshow = hold ? P : Pl, left = Math.max(0, g.limit - T), kk = hold ? K : K;
      const danger = clamp(slide, 0, 1), grip = steady(tilt);
      const rum = .9 + Math.abs(kk) * 2.2 + danger * 1.4 + (won ? 0 : 0);
      const eyeTgt = [JX, JY0 - 100];
      // background gags: window fly, washer countdown
      fly(T, 468, 180, 0);
      washer(T, left, rum, left < 1.2 && !g.result);
      grandmaDraw();
      // everything on the table rumbles together
      const ox = Math.sin(T * 47) * rum * .8, oy = Math.sin(T * 61) * rum * .9;
      table(rum * .5, T);
      catDraw();
      X.save(); X.translate(ox, oy);
      jarScene();
      X.restore();
      // controls & progress
      if (!g.result) hold ? levelUI() : torqueUI();
      pickleBar(Pshow, T, tkFlash);
      drawBits(T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, clamp(q.x, 120, 680), Math.max(120, q.y - Math.min(a, .5) * 20), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      vignette(.14);

      /* ---- local scene pieces (closures over this frame's values) ---- */
      function grandmaDraw() {
        const mood = won ? 'happy' : lost ? 'scared' : danger > .55 || Math.abs(tilt) > .7 ? 'worried' : null;
        grandma(738, 542, T, mood, won && rk > .1, won ? [JX, 300] : [JX + tilt * 40, 330]);
      }
      function catDraw() {
        let cx = 636, cy = 540, eat = false, tl = 0, mood = null;
        if (lost && rk >= 0) {
          const k = clamp((rk - .38) / .38, 0, 1); cx = lerp(626, 470, ease(k)); eat = rk > .8; mood = eat ? 'happy' : null; tl = eat ? 10 : 20;
          if (rk > .36 && rk < .4) tl = 30;
        } else if (won) { mood = 'happy'; tl = 12; } else if (danger > .6) tl = 16;
        cat(cx, cy, T, [JX + tilt * 30, JY1 + 20], mood, eat, tl);
        if (eat) { X.fillStyle = PICK; rr(cx - 14, cy - 56, 28, 12, 5); ink(PICK, 2.5); }
      }
      function jarScene() {
        const by = baseY(slide), lp = lidPos(tilt, by);
        // the people stand on the table
        const hmood = won ? 'happy' : lost ? 'sad' : null, hop = won ? Math.abs(Math.sin(T * 9)) * 14 : 0;
        const holder = hold ? myCol() : pCol(), twister = hold ? pCol() : myCol();
        const hx = 240, hfy = TT + 34, tx = COL_X, tfy = TT + 38 - 54, UU = 6.4;
        // holder (left): both arms hug the jar's side and follow the lean
        const sideX = JX - 70 * Math.cos(tilt * .26) + Math.sin(tilt * .26) * -30, sideY = by - 70;
        const lean = -tilt * 5;
        shadow(hx, hfy + 2, 46, 9, .22);
        caos(hx + lean, hfy - hop, UU, { col: holder, mood: hmood });
        // the twister (right) on a crate
        crate(tx, TT + 38, 86, 54);
        const eff = hold ? pwSee : pw, strain = clamp(eff * (1 - grip * .4) + (1 - grip) * .4, 0, 1);
        const lx = lp[0] + 54, ly = lp[1] + 2 + Math.sin(T * 16) * eff * 5;
        caos(tx, tfy - hop, UU, { col: twister, mood: hmood });
        // faces react: sweat when the twisting is hard or the jar leans
        if (!g.result) { for (let i = 0; i < 2; i++) { if (eff > .5 + i * .2) sweat(tx - 28 + i * 12, tfy - 60, T, i * .5); if (Math.abs(tilt) > .5 + i * .2) sweat(hx - 34 + i * 7, hfy - 60, T, i * .4); } }
        // the jar
        let pm = Math.abs(tilt) > .55 || danger > .5 ? 'panic' : null; if (won) pm = 'happy'; if (lost) pm = 'sad';
        const sq = tkFlash > 0 ? tkFlash * .6 : 0;
        if (won && rk >= 0) { winScene(lp, by); }
        else if (lost && rk >= 0) { loseScene(by); }
        else {
          jar(JX, by, tilt, lidA, (1 - grip) * eff * 5, pm, T, false, sq);
          // the twist halo around the lid (twister): a dashed ring that shows where to circle, chevrons turn with the lid
          if (!hold) twistHalo(lp, eff, grip);
          else holderFx(lp, by);
        }
        // arms last, so the hands press on the glass / the lid in front of the jar
        const wob = Math.sin(T * 14) * eff * 4, cheer = (won || lost) && rk >= 0, w2 = Math.sin(T * 14) * (won ? 14 : 8);
        const sh = [hx + 6.6 * UU, hfy - 5.2 * UU - hop], st2 = [tx - 6.6 * UU, tfy - 5.2 * UU - hop];
        if (cheer) { armTo(sh[0], sh[1], hx + 40 + w2, hfy - 100 - hop, holder, UU, 0); armTo(sh[0] - 13 * UU, sh[1], hx - 40 - w2, hfy - 100 - hop, holder, UU, 0); armTo(st2[0] + 13 * UU, st2[1], tx + 40 + w2, tfy - 100 - hop, twister, UU, 0); armTo(st2[0], st2[1], tx - 40 - w2, tfy - 100 - hop, twister, UU, 0); }
        if (!cheer) { armTo(sh[0], sh[1], sideX - 6, sideY + 26, holder, UU, 8); armTo(sh[0], sh[1], sideX - 6, sideY - 14, holder, UU, -10); armTo(st2[0], st2[1], lx + 2, ly - 10 + wob, twister, UU, -14); armTo(st2[0], st2[1], lx + 2, ly + 10 - wob, twister, UU, 12); }
        pill(hx, hfy - 80 - hop, hold ? 'YOU' : 'YOUR FRIEND', holder); pill(tx, tfy - 80 - hop, hold ? 'YOUR FRIEND' : 'YOU', twister);
      }
      function twistHalo(lp, eff, grip) {
        X.save(); X.translate(lp[0], lp[1]); const a = T * 1.5 * (eff > .1 ? 1 + eff * 2 : 1);
        X.globalAlpha = eff > .1 ? .85 : .5 + Math.sin(T * 4) * .15; X.lineCap = 'round';
        X.beginPath(); X.arc(0, 0, 76, 0, TAU); X.lineWidth = 11; X.strokeStyle = INK; X.setLineDash([22, 18]); X.lineDashOffset = -a * 40; X.stroke();
        X.lineWidth = 5; X.strokeStyle = eff > .1 ? (grip > .6 ? '#5CFF7A' : '#ff6b6b') : '#fff'; X.stroke(); X.setLineDash([]);
        for (let i = 0; i < 3; i++) { const b = a + i * TAU / 3; X.save(); X.rotate(b); X.translate(76, 0); X.rotate(Math.PI / 2); X.beginPath(); X.moveTo(-10, 4); X.lineTo(0, -8); X.lineTo(10, 4); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4.5; X.strokeStyle = '#fff'; X.stroke(); X.restore(); }
        X.globalAlpha = 1; X.restore();
        // the grip lamp: the lid tells the twister whether it bites
        if (!g.result) { const ok = grip > .6; badge(eff < .08 && Pshow < .02 && T < 3.2 ? (TOUCH ? 'CIRCLE THE LID' : 'CIRCLE / HOLD SPACE') : ok ? (eff > .5 ? 'GRIP!' : 'GRIP OK') : 'SLIPPING!', lp[0] + 4, lp[1] - 80, 18, ok ? '#22a447' : '#e8434f', '#fff', 1, -.04); if (!ok && eff > .1) for (let i = 0; i < 3; i++) { const q = (T * 3 + i / 3) % 1; X.globalAlpha = 1 - q; X.fillStyle = '#fff'; el(lp[0] - 40 + i * 40, lp[1] - 18 - q * 22, 7, 2.4); X.fill(); X.globalAlpha = 1; } }
      }
      function holderFx(lp, by) {
        // the shudder arrows: kicks that just happened, and the next kick charging (direction from the seeded list, charge from the twist progress)
        for (const k of kicks) { const a = (T - k.t) / .7, s = .7 + Math.min(1, k.mag * 2) * .8; X.globalAlpha = 1 - a; arrow(JX + k.dir * (50 + a * 34), by - JH - 36, k.dir, s, '#ff6b6b'); arrow(JX + k.dir * (84 + a * 34), by - JH - 36, k.dir, s * .75, '#ff9a4d'); X.globalAlpha = 1; }
        if (pwSee > .35 && !g.result) {
          const frac = (P * NC) % 1, nd = ks[(clicked + 1) % 64], ch = frac * Math.min(1, pwSee * pwSee * 2.4);
          X.globalAlpha = .45 + ch * .55; arrow(JX + nd * 40, by - JH - 66, nd, .5 + ch * .6, mix('#ffd23f', '#ff4d5e', ch)); X.globalAlpha = 1;
        }
        if (!g.result && grip < .5) { X.globalAlpha = .6 + Math.sin(T * 14) * .3; txt('!', lp[0] + 60, lp[1] - 44, 34, '#ff4d5e'); X.globalAlpha = 1; }
      }
      function levelUI() {
        const [x, y, w, h] = LV, ring = wander(g.c) + K, inZ = Math.abs(th) < G;
        X.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 7, w, h, 14); X.fill();
        rr(x, y, w, h, 14); ink('#ffd23f', 4); X.fillStyle = '#c99512'; X.fillRect(x + 12, y + h - 6, w - 24, 4);
        rr(x + 14, y + 8, w - 28, h - 18, 11); ink('#fff7c9', 3);
        X.save(); rr(x + 14, y + 8, w - 28, h - 18, 11); X.clip();
        X.strokeStyle = 'rgba(20,16,28,.18)'; X.lineWidth = 2; X.beginPath(); for (let i = -4; i <= 4; i++) { X.moveTo(LVX + i * 32, y + 8); X.lineTo(LVX + i * 32, y + 14); } X.stroke();
        const zx = LVX + clamp(ring, -1.45, 1.45) * LVS, zw = G * LVS, pul = 1 + Math.sin(T * 9) * .04;
        rr(zx - zw * pul, y + 10, zw * 2 * pul, h - 22, 9); ink(inZ ? '#5CFF7A' : '#8be6a0', 3); X.fillStyle = 'rgba(255,255,255,.55)'; rr(zx - zw + 4, y + 13, zw * 2 - 8, 5, 2.5); X.fill();
        X.restore();
        const bx = LVX + clamp(c, -1.4, 1.4) * LVS; X.beginPath(); X.arc(bx, y + h / 2 - 1, 11, 0, TAU); ink(inZ ? '#fff' : '#ffe14d', 3); X.fillStyle = 'rgba(255,255,255,.9)'; el(bx - 3, y + h / 2 - 5, 3.4, 2.2); X.fill();
        if (!TOUCH && T < 3.4) keyCap('◄ ►', 150, y + h / 2);
        if (T < 3.4 && !inZ) badge('BUBBLE IN THE GREEN!', 400, y - 20, 18, '#22a447', '#fff', 1, -.03);
        else if (!inZ && Math.abs(th) > .45 && T > 3) badge('STEADY!', 400, y - 20, 18, '#e8434f', '#fff', 1, -.03);
      }
      function torqueUI() {
        const [x, y, w, h] = LV;
        X.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 7, w, h, 14); X.fill();
        rr(x, y, w, h, 14); ink('#4db8ff', 4); X.fillStyle = '#1f7fc9'; X.fillRect(x + 12, y + h - 6, w - 24, 4);
        rr(x + 14, y + 8, w - 28, h - 18, 11); ink('#18304a', 3);
        const bx = x + 18, bw = w - 36;
        X.save(); rr(x + 14, y + 8, w - 28, h - 18, 11); X.clip();
        X.fillStyle = '#5CFF7A'; X.fillRect(bx, y + 11, bw * .6, h - 24); X.fillStyle = '#ff4d5e'; X.fillRect(bx + bw * .6, y + 11, bw * .4, h - 24);
        X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(bx, y + 13, bw, 5);
        X.fillStyle = 'rgba(20,48,74,.8)'; X.fillRect(bx + bw * pw, y + 8, bw, h);
        X.restore();
        const mx = bx + bw * pw; rr(mx - 5, y + 3, 10, h - 8, 4); ink('#fff', 2.5);
        txt('EASY', x + 58, y + h / 2 - 1, 14, '#fff', 'center', 60); txt('KICKS!', x + w - 50, y + h / 2 - 1, 14, '#fff', 'center', 70);
        if (!TOUCH && T < 3.4) keyCap('SPACE', 150, y + h / 2);
      }
      function winScene(lp, by) {
        // POP: the lid launches over the kitchen to grandma's plate; brine fountain; the pickle sticks its head out
        const k = clamp((rk - .1) / .8, 0, 1), sq = rk < .12 ? rk / .12 : Math.max(0, 1 - (rk - .12) * 4);
        if (rk >= .1 && !crashed) { crashed = true; sfx.boing(); noise(.25, .1, 600, 3000, 'bandpass'); snd(520, .18, 'triangle', .08, 0, 1100); for (let i = 0; i < 36; i++) bit({ x: JX + (cr() - .5) * 30, y: by - JH - 6, vx: (cr() - .5) * 420, vy: -(300 + cr() * 560), gr: 1100, r: 4 + cr() * 4, life: 1.1 }); }
        jar(JX, by, 0, lidA, 0, 'happy', T, rk >= .1, sq * .9);
        if (rk >= .1 && rk < 1) {                                       // brine keeps spraying for a moment
          if (cr() < .8) bit({ x: JX + (cr() - .5) * 40, y: by - JH - 6, vx: (cr() - .5) * 340, vy: -(220 + cr() * 420), gr: 1100, r: 4 + cr() * 3, life: .9 });
        }
        if (rk >= .1) {
          const sx = lp[0], sy = by - JH - 8, ex = 690, ey = 452, qx = lerp(sx, ex, k), qy = lerp(sy, ey, k) - 4 * 190 * k * (1 - k);
          if (k < 1) { X.save(); X.translate(qx, qy); X.rotate(k * TAU * 3.5); X.scale(.75, .75); lid(0, 0, 0, 0, T); X.restore(); }
          else { if (!landed) { landed = true; sfx.coin(); sfx.sparkle(); snd(1800, .2, 'triangle', .08, 0, 2600); ring(ex, ey, '#fff', 60, .3); } X.save(); X.translate(ex, ey - 6); X.rotate(-.1); X.scale(.75, .75); lid(0, 0, 0, 0, T); X.restore(); }
        }
        if (rk > .15) badge('POP!', 250, 250, 40, '#ff9a4d', '#fff', outBack((rk - .15) / .2), -.08);
        if (rk > .5) for (let i = 0; i < 3; i++) heart(310 + i * 70 + Math.sin(T * 5 + i) * 6, 200 - ((rk - .5 + i * .2) % 1) * 40, 1.1, '#ff5c8a');
      }
      function loseScene(by) {
        // the jar tips toward us, falls off the table, crashes; the cat gets the pickle
        const f = clamp(rk / .5, 0, 1), e = f * f;
        const fy = lerp(by, 540, e), fs = 1 + e * .32, fr = (Math.sin(rk * 12) * .1) + e * 2.2 * (tilt < 0 ? -1 : 1), fx = JX + e * 24;
        if (rk < .5) {
          X.save(); X.translate(fx, fy); X.scale(fs, fs); X.rotate(fr); X.translate(-fx, -fy); jar(fx, fy, 0, lidA, 0, 'panic', T, false, 0); X.restore();
          if (rk > .08) { X.globalAlpha = .5; for (let i = 0; i < 3; i++) { X.strokeStyle = '#fff'; X.lineWidth = 3; X.beginPath(); X.moveTo(JX - 30 + i * 30, by - 20 - i * 10); X.lineTo(JX - 30 + i * 30, by - 60 - i * 10 + rk * 20); X.stroke(); } X.globalAlpha = 1; }
        } else {
          if (!crashed) { crashed = true; sfx.thud(); sfx.splat(); snd(1200, .25, 'sawtooth', .07, 0, 200); shake(8, .25); burst(JX + 24, 530, '#c8f1d9', 14); for (let i = 0; i < 16; i++) bit({ k: 2, x: JX + 24, y: 530, vx: (cr() - .5) * 520, vy: -(160 + cr() * 360), gr: 1100, r: 5 + cr() * 7, life: .9, vr: (cr() - .5) * 14 }); for (let i = 0; i < 12; i++) bit({ x: JX + 24, y: 530, vx: (cr() - .5) * 400, vy: -(120 + cr() * 260), gr: 1100, r: 3 + cr() * 3, life: .8 }); }
          // brine puddle, the lid spinning on the floor, the pickle rolling to the cat
          const pk = clamp((rk - .5) / .35, 0, 1);
          el(JX + 24, 538, 70, 12); ink('rgba(212,235,126,.9)', 0);
          X.save(); X.translate(JX + 70, 548); X.rotate(rk * 9); lid(0, 0, 0, 0, T); X.restore();
          const px = lerp(JX + 24, 466, ease(pk)), py = 530 + (1 - Math.abs(Math.sin(pk * 6))) * -10 * (1 - pk);
          if (rk < 1.25) { X.save(); X.translate(px, py); X.rotate(pk * 9); rr(-26, -11, 52, 22, 11); ink(PICK, 3); X.fillStyle = 'rgba(255,255,255,.4)'; el(-10, -5, 8, 2.4); X.fill(); X.restore(); }
          if (rk > .8) badge('YUM!', 520, 470, 34, '#8fd35a', '#fff', outBack((rk - .8) / .18), .06);
          else if (rk > .5) badge('CRASH!', 330, 470, 34, '#e8434f', '#fff', outBack((rk - .5) / .2), -.08);
        }
      }
    },
    move(p) {
      if (hold) { ct = clamp((p.x - LVX) / LVS, -1.3, 1.3); return; }
      if (g.result) return;
      const cx = lidCenter(); const dx = p.x - cx[0], dy = p.y - cx[1], r = Math.hypot(dx, dy);
      if (r < 24 || r > 230) { pAng = null; return; }
      const a = Math.atan2(dy, dx);
      if (pAng !== null) { let d = a - pAng; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; if (Math.abs(d) < 1.3) acc += Math.abs(d); }
      pAng = a;
    },
    down(p) { g.move(p); },
    up() { pAng = null; },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (hold) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; return; }
      kHeld.add(e.code);
    },
    keyup(e) { if (hold) { if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && kx < 0) kx = 0; else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && kx > 0) kx = 0; return; } kHeld.delete(e.code); },
  };
  function lidCenter() { const tl = thT.at() === null ? 0 : thT.at(); return lidPos(tl, baseY(slT.at() === null ? 0 : slT.at())); }
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0, fade = clamp(a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1, 0, 1);
      X.globalAlpha = fade;
      if (b.k === 2) { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); X.beginPath(); X.moveTo(-b.r, b.r * .6); X.lineTo(0, -b.r); X.lineTo(b.r, b.r * .5); X.closePath(); ink('rgba(200,241,217,.85)', 2); X.restore(); }
      else drop(b.x, b.y, b.r * 1.3, JUICE);
      X.globalAlpha = 1;
    }
  }
  g.dbg = {
    /* what the HOLDER screen shows: the green zone (D + K), my bubble, the twist power I see, the slide meter, the progress */
    holdView: () => ({ ring: wander(g.c) + K, c, K, tw: twS, sl, P, th, next: ks[(clicked + 1) % 64], frac: (P * NC) % 1 }),
    /* what the TWISTER screen shows: the jar's tilt (from the judge), the grip, my power, my progress */
    twistView: () => ({ th: thT.at() === null ? 0 : thT.at(), grip: gripNow, pw, P: Pl, sl: slT.at() === null ? 0 : slT.at(), center: lidCenter(), FULL }),
    G, G2, SLIPT,
  };
  wire(g, D, 0, sp, 'du_jar');
  return g;
}
reg('du_jar', duJar, 'JAR WARS'); REGMAP.du_jar.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 3.2 s loop ───────────── */
function demo(role, t) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, WALL); gr.addColorStop(1, WALL2); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = TILE; X.fillRect(0, 70, 520, 130); X.strokeStyle = TILE2; X.lineWidth = 2; X.beginPath(); for (let y = 70; y <= 200; y += 36) { X.moveTo(0, y); X.lineTo(520, y); } X.stroke();
  X.fillStyle = '#d9a066'; X.fillRect(0, 200, 520, 40); X.fillStyle = CLOTH; X.fillRect(70, 190, 380, 12); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 200); X.lineTo(520, 200); X.stroke();
  const u = t % 3.2, ring = Math.sin(t * 1.9) * .8, c = role === 0 ? ring + Math.sin(t * 7) * .06 : ring, th = ring - c, pwr = role === 1 ? (u > .3 && u < 2.4 ? 1 : 0) : 0, la = (u > .3 ? Math.min(u, 2.4) - .3 : 0) * 5;
  const jx = 260, jy = 192;
  X.save(); X.translate(jx, jy); X.scale(.9, .9); X.translate(-jx, -jy);
  jar(jx, jy, role === 0 ? ring - c : th, la, 0, null, t, false, 0);
  X.restore();
  const lx = jx, ly = jy - (JH + 8) * .9;
  if (role === 1) {
    X.save(); X.translate(lx, ly); X.globalAlpha = .8; X.beginPath(); X.arc(0, 0, 60, 0, TAU); X.lineWidth = 9; X.strokeStyle = INK; X.setLineDash([18, 14]); X.lineDashOffset = -t * 60; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.setLineDash([]); X.restore();
    const a = t * 7; demoFinger(lx + Math.cos(a) * 60, ly + Math.sin(a) * 60, pwr > 0, 0);
    badge(pwr > 0 ? 'TWIST!' : 'CIRCLE THE LID', 380, 34, 18, '#e8434f', '#fff', 1, -.03);
  } else {
    rr(110, 214, 300, 22, 11); ink('#ffd23f', 3); rr(116, 217, 288, 16, 8); ink('#fff7c9', 2);
    const zx = 260 + ring * 120; rr(zx - 24, 218, 48, 14, 7); ink('#5CFF7A', 2.5); X.beginPath(); X.arc(260 + c * 120, 225, 8, 0, TAU); ink('#fff', 2.5);
    demoFinger(260 + c * 120, 232, true, 0);
    badge('BUBBLE IN THE GREEN!', 330, 34, 18, '#22a447', '#fff', 1, -.03);
  }
}
DUO.INFO.du_jar = [['HOLDER', 'KEEP THE JAR STEADY', 'SLIDE THE BUBBLE INTO THE GREEN'], ['TWISTER', 'UNSCREW THE LID', 'CIRCLE THE LID, EASE OFF WHEN IT SHUDDERS']];
DUO.DEMOS.du_jar = [t => demo(0, t), t => demo(1, t)];

})();
