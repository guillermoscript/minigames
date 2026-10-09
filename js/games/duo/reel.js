'use strict';
/* ═════════ DUO · REEL & RELEASE (du_reel), after Twisted!'s fishing / crank gags ═════════
   Two Caoses in a tiny rowboat are hooked to a giant grumpy tuna in sunglasses and a tie. ONE rod, ONE line, and the line's tension is
   what both of them are really fighting with:
   REELER (role 0, JUDGE): cranks the reel (drag in circles anywhere, or hold Space, or alternate A / D). Cranking pulls the fish in, but only
   while the line is taut, and it also raises the tension. The reeler never sees the gauge: it feels the line (it SAGS when slack, SHAKES when
   close to snapping) and the reel (the handle strains), and only gets a tiny ripple hint of the next lunge.
   ROD HAND (role 1): leans the rod toward the fish (pointer x / ◄ ►) and sets the drag (pointer y / ▲ ▼, or hold Space for tight). It owns the
   gauge (needle in the green = fine) and sees the lunges 0.7 s early (jaw flex, big ripples, a ring where the rod tip should go).
   The fish lunges left / right on a seeded schedule. A lunge yanks the line (tension spike) unless the rod already leans that way, and a
   loose drag absorbs part of the yank; too slack and the fish swims away, too tight (or too much cranking) and the line snaps.
   Win: the fish reaches the boat before the time is up. Lose: the line snaps, or the fish tows the whole boat away.
   Netcode: the ROD HAND owns 'rd' [rod, drag ×1000] (coalesced, ≤10/s). The REELER owns the physics (tension, distance, strain, its crank speed):
   'st' [dist ×1000, tension ×1000, strain ×100, crank ×100] (coalesced, ≤10/s) and the verdict ('why' = snap | drag, then 'end' via wire).
   The rod hand predicts the tension locally (same formula from its own rod / drag and the reeler's crank) and nudges toward each 'st'. The
   lunge schedule is seeded, so both screens draw the fish from their own clock. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (x, a, b) => ease((x - a) / (b - a));
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MC = new Map();
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right LEAVE and y>552) ───────────── */
const HZ = 172;                                       // horizon
const POLE = [400, 515];                              // where the rod stands in the boat
const RSC = 118, TIPY = 300;                          // rod tip travels ±RSC px sideways, rests at TIPY
const FX = 230;                                       // the fish swims ±FX px around the middle
const FEET = 520;                                     // the Caoses' feet
const GAUGE = [248, 452], GR = 34;
const LEVER = [304, 505];
const REEL = [434, 480], RR = 31, HR = 21;
const RX = [334, 494];                                // rod hand / reeler x
const TELE = .8;                                      // seconds of warning before a lunge
const SC = 1.25, PV = 566;                            // the boat is drawn 1.25× around (400, 566)
const fishY = d => lerp(430, 262, d), fishS = d => lerp(1.15, .5, d);
const BAND = [.40, .70];                              // the green band of the gauge

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
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
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
/* an arm of a Caos standing at (cx, cy) reaching for (tx, ty) */
function reach(cx, cy, u, sx, tx, ty, col) {
  const dx = tx - (cx + sx * 6.6 * u), dy = ty - (cy - 5.2 * u), d = Math.hypot(dx, dy);
  X.save(); X.translate(cx, cy); arm(u, sx, Math.atan2(dx, -dy), clamp((d - 2.35 * u) / (3.3 * u), .15, 1.7), col); X.restore();
}
function drop(x, y, r, col) {
  X.beginPath(); X.moveTo(x, y - r * 1.7); X.quadraticCurveTo(x + r * 1.1, y - r * .2, x, y + r); X.quadraticCurveTo(x - r * 1.1, y - r * .2, x, y - r * 1.7); X.closePath();
  ink(col || '#9fe3ff', 2); X.fillStyle = 'rgba(255,255,255,.75)'; el(x - r * .3, y - r * .3, r * .28, r * .4, -.4); X.fill();
}
const sweat = (x, y, T, n = 2) => { for (let i = 0; i < n; i++) { const k = (T * 1.6 + i / n) % 1; drop(x + (i ? 16 : -4) + k * 8, y - 8 + k * 26, 3.4 * (1 - k * .4), '#bfefff'); } };

/* ───────────── the fish ───────────── */
/* a grumpy tuna in sunglasses and a tie, seen from the side, facing +x (face = -1 mirrors it).
   o: jaw 0..1 open, fast (flapping), wave (the goodbye fin), rot, shades (false = lost them), fin (sweat), glint */
function tuna(x, y, s, face, o, T) {
  const jaw = o.jaw || 0, wag = Math.sin(T * (o.fast ? 22 : 6)) * (o.fast ? .32 : .16);
  X.save(); X.translate(x, y); X.scale(s * face, s); X.rotate((o.rot || 0) * face);
  X.save(); X.translate(-64, 0); X.rotate(wag); X.beginPath(); X.moveTo(4, 0); X.lineTo(-34, -32); X.quadraticCurveTo(-22, 0, -34, 32); X.closePath(); ink('#2f5a99', 3.5);
  X.fillStyle = 'rgba(255,255,255,.2)'; X.beginPath(); X.moveTo(0, -3); X.lineTo(-26, -22); X.lineTo(-18, -4); X.fill(); X.restore();
  X.beginPath(); X.moveTo(-26, -29); X.lineTo(-4 + wag * 10, -60); X.lineTo(26, -30); X.closePath(); ink('#2f5a99', 3.5);
  for (const fx of [-44, -36, -28]) { X.beginPath(); X.moveTo(fx, 24); X.lineTo(fx - 6, 34); X.lineTo(fx + 4, 28); X.closePath(); ink('#ffd23f', 2); }
  el(0, 0, 72, 37); ink('#4577bd', 4);
  X.save(); el(0, 0, 72, 37); X.clip();
  X.fillStyle = '#e1edf8'; el(4, 30, 84, 24); X.fill(); X.fillStyle = '#2f5a99'; X.fillRect(-80, -2, 160, 4);
  X.fillStyle = 'rgba(255,255,255,.3)'; el(-6, -22, 44, 7, -.08); X.fill();
  X.strokeStyle = '#2f5a99'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(-34 + i * 16, -12, 9, .3, Math.PI - .3); X.stroke(); }
  X.restore();
  X.save(); X.translate(8, 18); X.rotate(o.wave ? -2.2 + Math.sin(T * 15) * .5 : .55 + wag * .5); X.beginPath(); X.moveTo(0, 0); X.lineTo(-10, 28); X.lineTo(16, 20); X.closePath(); ink('#2f5a99', 3); X.restore();
  // the lower jaw hinges at the front, the mouth is a grumpy frown when shut
  X.save(); X.translate(56, 12); X.rotate(jaw * .6); rr(-2, -4, 28, 12, 6); ink('#35609f', 3);
  if (jaw > .2) { X.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(4 + i * 7, -4); X.lineTo(7 + i * 7, -10); X.lineTo(10 + i * 7, -4); X.fill(); } }
  X.restore();
  X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(46, 12); X.quadraticCurveTo(62, jaw > .2 ? 10 : 4, 76, 11 - jaw * 3); X.stroke();
  // the tie
  X.save(); X.translate(34, 30); X.rotate(.18 + wag * .8); rr(-7, -6, 14, 12, 3); ink('#e8434f', 3);
  X.beginPath(); X.moveTo(-8, 6); X.lineTo(8, 6); X.lineTo(12, 40); X.lineTo(0, 50); X.lineTo(-12, 40); X.closePath(); ink('#e8434f', 3);
  X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 3; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(-9 + i * 2, 16 + i * 9); X.lineTo(9 - i * 2, 12 + i * 9); X.stroke(); } X.restore();
  // sunglasses + angry brows
  if (o.shades !== false) {
    X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(18, -9); X.lineTo(-6, -13); X.stroke();
    for (const lx of [22, 46]) { rr(lx - 1, -20, 22, 17, 6); ink('#1b1b26', 3); X.fillStyle = 'rgba(255,255,255,.75)'; X.beginPath(); X.moveTo(lx + 3, -16); X.lineTo(lx + 9, -16); X.lineTo(lx + 4, -8); X.fill(); }
    X.beginPath(); X.moveTo(42, -12); X.lineTo(48, -12); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    line([[18, -28], [42, -21]], 6, INK); line([[72, -26], [52, -21]], 6, INK);
  } else {
    for (const lx of [32, 54]) { el(lx, -12, 7, 9); ink('#fff', 2.5); X.fillStyle = INK; el(lx + 1, -11, 2.5, 3); X.fill(); }
    line([[22, -26], [38, -22]], 5, INK); line([[68, -26], [50, -22]], 5, INK);
  }
  if (o.fin) { X.fillStyle = 'rgba(255,255,255,.9)'; }
  X.restore();
  if (o.glint) { const k = o.glint; star(x + face * 36 * s, y - 14 * s, 14 * k, 3, 4, T * 6, '#fff', 1.5); }
}
const mouthOf = (x, y, s, face) => [x + face * 77 * s, y + 10 * s];     // where the hook is

/* ───────────── the boat, its crew and its gags ───────────── */
function crab(x, y, T, mood, shades) {                // a bored crab: sits on the gunwale tapping a claw
  const tap = mood === 'bored' ? Math.max(0, Math.sin(T * 5)) : 0;
  X.save(); X.translate(x, y);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const a = i * 9; X.beginPath(); X.moveTo(sx * 14, -10 + i * 3); X.lineTo(sx * (24 + a * .4), -2 + i * 3); X.lineTo(sx * (28 + a * .4), 6); X.lineWidth = 7; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#e8573b'; X.stroke(); }
  el(0, -14, 24, 15); ink('#f2674a', 4); X.fillStyle = 'rgba(255,255,255,.3)'; el(-6, -22, 11, 4, -.2); X.fill();
  const up = mood === 'shock' || mood === 'angry';
  for (const sx of [-1, 1]) {                         // claws
    X.save(); X.translate(sx * 20, -16); const a = up ? -1.3 + (mood === 'angry' ? Math.sin(T * 24) * .3 : 0) : (sx > 0 ? .7 - tap * .5 : .2);
    X.rotate(sx * a); X.lineWidth = 8; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(sx * 10, -8); X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#f2674a'; X.stroke();
    X.translate(sx * 12, -9); X.beginPath(); X.arc(0, 0, 9, 0, TAU); ink('#f2674a', 3); X.beginPath(); X.moveTo(0, 0); X.lineTo(sx * 9, -7); X.lineTo(sx * 11, 1); X.closePath(); ink('#e8573b', 2.5); X.restore();
  }
  for (const sx of [-1, 1]) {                         // eyes on stalks
    const ex = sx * 8, ey = mood === 'shock' ? -42 : -34; X.beginPath(); X.moveTo(sx * 6, -26); X.lineTo(ex, ey + 8); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.4; X.strokeStyle = '#f2674a'; X.stroke();
    el(ex, ey, 7.5, mood === 'shock' ? 9 : 7.5); ink('#fff', 2.5); X.fillStyle = INK; el(ex + (mood === 'bored' ? 1 + Math.sin(T * .8) * 2 : 0), ey + 1, mood === 'shock' ? 2 : 3, mood === 'shock' ? 2 : 3); X.fill();
    if (mood === 'bored') { X.fillStyle = '#f2674a'; X.fillRect(ex - 8, ey - 8, 16, 8 + (Math.sin(T * 1.3) > .94 ? 6 : 0)); X.strokeStyle = INK; X.lineWidth = 2.4; X.beginPath(); X.moveTo(ex - 8, ey + 0.5); X.lineTo(ex + 8, ey + .5); X.stroke(); }
  }
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); if (mood === 'shock') X.arc(0, -8, 4, 0, TAU); else { X.moveTo(-6, -8); X.quadraticCurveTo(0, mood === 'angry' ? -12 : -5, 6, -8); } X.stroke();
  if (shades) { for (const sx of [-1, 1]) { rr(sx * 9 - 10, -42, 20, 14, 5); ink('#1b1b26', 2.5); } line([[-1, -35], [1, -35]], 3, INK); }
  X.restore();
}
function bucket(x, y, fishes) {                       // the bait bucket with sardine tails sticking out
  for (let i = 0; i < fishes; i++) { X.save(); X.translate(x - 12 + i * 12, y - 36); X.rotate(-.35 + i * .3); X.beginPath(); X.moveTo(0, 8); X.lineTo(-7, -12); X.lineTo(0, -6); X.lineTo(7, -12); X.closePath(); ink('#9fc5e8', 2.5); X.restore(); }
  X.beginPath(); X.moveTo(x - 24, y - 34); X.lineTo(x + 24, y - 34); X.lineTo(x + 19, y); X.lineTo(x - 19, y); X.closePath(); ink('#6f8da8', 3.5);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(x - 17, y - 30, 6, 26); X.fillStyle = INK; X.fillRect(x - 22, y - 22, 44, 3);
}
function gull(x, y, flap, s, face, hold) {
  X.save(); X.translate(x, y); X.scale(s * face, s);
  const w = Math.sin(flap) * 22;
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 4, -4); X.quadraticCurveTo(sx * 30, -22 - w, sx * 52, -8 - w * 1.4); X.quadraticCurveTo(sx * 30, -6 - w * .4, sx * 6, 6); X.closePath(); ink(sx > 0 ? '#f4f4f8' : '#d6d9e6', 3); }
  el(0, 2, 20, 12); ink('#ffffff', 3.5); X.beginPath(); X.moveTo(-18, 2); X.lineTo(-32, 8); X.lineTo(-18, 9); X.closePath(); ink('#d6d9e6', 3);
  X.beginPath(); X.arc(20, -4, 9, 0, TAU); ink('#fff', 3);
  X.beginPath(); X.moveTo(27, -5); X.lineTo(40, -2 + (hold ? -2 : 0)); X.lineTo(27, 0); X.closePath(); ink('#ffb020', 2.5);
  el(22, -7, 3.2, 3.6); ink('#fff', 1.5); X.fillStyle = INK; el(23, -7, 1.6, 1.8); X.fill(); line([[17, -12], [25, -10]], 3, INK);
  if (hold) { X.save(); X.translate(40, 2); X.rotate(.4 + Math.sin(flap * 1.3) * .3); X.beginPath(); X.moveTo(0, 0); X.lineTo(8, -9); X.lineTo(8, 9); X.closePath(); ink('#9fc5e8', 2.5); el(-12, 0, 13, 6); ink('#9fc5e8', 2.5); X.restore(); }
  X.restore();
}
/* the dial on the post: needle shows the tension (front); the reeler only sees the back of it */
function gauge(x, y, r, T, front, T2, postTo = 505) {
  rr(x - 7, y + r - 4, 14, postTo - (y + r) + 6, 3); ink('#b9854d', 3);
  X.beginPath(); X.arc(x, y, r + 5, 0, TAU); ink('#d9dde8', 4.5);
  if (!front) {
    X.beginPath(); X.arc(x, y, r - 3, 0, TAU); ink('#8f96ad', 3); X.fillStyle = 'rgba(255,255,255,.25)'; el(x - 10, y - 16, 14, 6, -.5); X.fill();
    for (const [bx, by] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { X.beginPath(); X.arc(x + bx * (r - 9), y + by * (r - 9), 3, 0, TAU); ink('#5d637a', 1.5); }
    txt('?', x, y + 15, 46, '#fff'); return;
  }
  X.beginPath(); X.arc(x, y, r - 3, 0, TAU); ink('#fff8e6', 3);
  const a0 = Math.PI * .8, a1 = Math.PI * 2.2, at = v => a0 + (a1 - a0) * clamp(v / 1.05, 0, 1), arc = (v0, v1, col) => { X.beginPath(); X.arc(x, y, r * .6, at(v0), at(v1)); X.lineWidth = r * .26; X.lineCap = 'butt'; X.strokeStyle = col; X.stroke(); };
  X.beginPath(); X.arc(x, y, r * .6, a0 - .06, a1 + .06); X.lineWidth = r * .26 + 6; X.strokeStyle = INK; X.lineCap = 'butt'; X.stroke();
  arc(0, .26, '#6ec1ff'); arc(.26, BAND[0], '#ffd23f'); arc(BAND[0], BAND[1], '#3ddc63'); arc(BAND[1], .87, '#ff9a4d'); arc(.87, 1.05, '#ff4d4d');
  X.strokeStyle = INK; X.lineWidth = 2.5; for (const v of [BAND[0], BAND[1]]) { X.beginPath(); X.moveTo(x + Math.cos(at(v)) * r * .42, y + Math.sin(at(v)) * r * .42); X.lineTo(x + Math.cos(at(v)) * r * .78, y + Math.sin(at(v)) * r * .78); X.stroke(); }
  const na = at(T) + Math.sin(T2 * 70) * (T > .8 ? .05 : 0);
  X.lineCap = 'round'; X.lineWidth = 7; X.strokeStyle = INK; X.beginPath(); X.moveTo(x, y); X.lineTo(x + Math.cos(na) * r * .82, y + Math.sin(na) * r * .82); X.stroke();
  X.lineWidth = 3.5; X.strokeStyle = '#e8434f'; X.stroke(); X.beginPath(); X.arc(x, y, 6, 0, TAU); ink('#2f2a4a', 2.5);
  X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .4, y - r * .62, r * .26, r * .08, -.5); X.fill();
}
/* the brake lever: k 0 (loose) .. 1 (tight). returns the knob position (the rod hand's left hand holds it) */
function lever(x, y, k) {
  const a = (k - .5) * 1.7; X.beginPath(); X.arc(x, y, 16, 0, TAU); ink('#8f96ad', 3);
  X.beginPath(); X.arc(x, y, 38, -Math.PI / 2 - .95, -Math.PI / 2 + .95); X.lineWidth = 7; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 3; X.strokeStyle = mix('#6ec1ff', '#ff4d4d', k); X.stroke();
  const kx = x + Math.sin(a) * 36, ky = y - Math.cos(a) * 36;
  X.lineWidth = 11; X.strokeStyle = INK; X.beginPath(); X.moveTo(x, y); X.lineTo(kx, ky); X.stroke(); X.lineWidth = 5; X.strokeStyle = '#d9dde8'; X.stroke();
  X.beginPath(); X.arc(kx, ky, 9, 0, TAU); ink('#e8434f', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(kx - 3, ky - 3, 3, 2); X.fill();
  return [kx, ky];
}

/* the rod: base in the boat, tip at (400 + rod·RSC, TIPY); returns the tip and a function for points along it */
function rodShape(rod, bend) {
  const bx = POLE[0], by = POLE[1], tx = bx + rod * RSC, ty = TIPY + Math.abs(rod) * 20 + bend, cx = bx + rod * RSC * .12, cy = (by + ty) / 2 + 24;
  const at = u => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; return [a * bx + b * cx + c * tx, a * by + b * cy + c * ty]; };
  return { tip: [tx, ty], at, bx, by, cx, cy, tx, ty };
}
function rodDraw(R) {
  X.beginPath(); X.moveTo(R.bx, R.by); X.quadraticCurveTo(R.cx, R.cy, R.tx, R.ty); X.lineCap = 'round';
  X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#d99a4a'; X.stroke(); X.lineWidth = 2.4; X.strokeStyle = 'rgba(255,255,255,.5)'; X.stroke();
  for (const u of [.35, .6, .82]) { const [px, py] = R.at(u); X.beginPath(); X.arc(px, py, 5 - u * 2, 0, TAU); ink('#ffd23f', 1.8); }
  X.beginPath(); X.arc(R.tx, R.ty, 6, 0, TAU); ink('#e8e8f0', 2.5);
}
/* the reel body (the handle is drawn separately, after the reeler) */
function reelBody(cx, cy, ang, spool, shake, T) {
  X.save(); X.translate(cx + Math.sin(T * 60) * shake, cy + Math.cos(T * 53) * shake);
  X.beginPath(); X.arc(0, 0, RR, 0, TAU); ink('#7f869f', 4);
  X.beginPath(); X.arc(0, 0, 15 + spool * 7, 0, TAU); ink('#f4f0e6', 3);
  X.strokeStyle = 'rgba(160,150,130,.8)'; X.lineWidth = 1.6; for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(0, 0, 8 + spool * 7 - i * 1, 0, TAU); X.stroke(); }
  X.save(); X.rotate(ang); X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 3; i++) { X.rotate(TAU / 3); X.beginPath(); X.moveTo(0, 0); X.lineTo(RR - 5, 0); X.stroke(); } X.restore();
  X.beginPath(); X.arc(0, 0, 6, 0, TAU); ink('#d9dde8', 2.5);
  X.restore();
}
function reelHandle(cx, cy, ang, shake, T) {
  const sx = Math.sin(T * 60) * shake, sy = Math.cos(T * 53) * shake, kx = cx + sx + Math.cos(ang) * HR, ky = cy + sy + Math.sin(ang) * HR;
  X.lineCap = 'round'; X.lineWidth = 10; X.strokeStyle = INK; X.beginPath(); X.moveTo(cx + sx, cy + sy); X.lineTo(kx, ky); X.stroke(); X.lineWidth = 4.5; X.strokeStyle = '#d9dde8'; X.stroke();
  X.beginPath(); X.arc(kx, ky, 8, 0, TAU); ink('#ff9a4d', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(kx - 2.5, ky - 3, 3, 2); X.fill();
  return [kx, ky];
}
/* the fishing line from the rod tip to the fish's mouth: sags when slack, shakes (and reddens) when about to snap */
function lineDraw(a, b, sag, vib, red, T, cut) {
  const pts = [], n = 26, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 0; i <= n; i++) {
    const u = i / n, s = Math.sin(u * Math.PI), w = Math.sin(u * Math.PI * 5 + T * 58) * vib * 6.5 * s;
    pts.push([a[0] + dx * u + nx * w, a[1] + dy * u + ny * w + sag * 4 * u * (1 - u) * 84]);
  }
  const col = mix('#ffffff', '#ff4d4d', red), th = 3.6 - red * 1.3;
  if (cut != null) {                                  // snapped: two free ends recoil
    const k = clamp(cut, 0, 1), m = Math.floor(n * .5), A = pts.slice(0, m + 1), B = pts.slice(m);
    const ra = A.map((p, i) => [lerp(A[A.length - 1][0], p[0], 1 - (1 - i / (A.length - 1)) * k * 0 - 0) , p[1]]);
    const sa = A.map(([px, py], i) => [lerp(a[0], px, 1 - k * .62 * (i / (A.length - 1))) , lerp(a[1], py, 1 - k * .62 * (i / (A.length - 1))) + Math.sin(T * 40 + i) * 4 * (1 - k)]);
    const sb = B.map(([px, py], i) => [lerp(b[0], px, 1 - k * .62 * (1 - i / (B.length - 1))), lerp(b[1], py, 1 - k * .62 * (1 - i / (B.length - 1))) + Math.sin(T * 40 + i) * 4 * (1 - k)]);
    line(sa, th + 3.5, INK); line(sa, th, col); line(sb, th + 3.5, INK); line(sb, th, col); void ra; return;
  }
  line(pts, th + 3.5, INK); line(pts, th, col);
}

/* ───────────── the static scene, painted once into an offscreen canvas ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#59b8f0'); g.addColorStop(1, '#d6f1ff'); X.fillStyle = g; X.fillRect(0, 0, W, HZ);
  // the sun, a lazy island with one palm
  X.beginPath(); X.arc(640, 104, 44, 0, TAU); ink('#ffe14d', 4); X.fillStyle = 'rgba(255,255,255,.55)'; el(626, 90, 14, 8, -.5); X.fill();
  X.save(); X.translate(130, HZ); X.beginPath(); X.moveTo(-70, 0); X.quadraticCurveTo(-40, -30, 0, -26); X.quadraticCurveTo(46, -30, 78, 0); X.closePath(); ink('#f2d49b', 4);
  X.beginPath(); X.moveTo(-4, -24); X.quadraticCurveTo(8, -52, 2, -78); X.lineWidth = 12; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#a8703a'; X.stroke();
  for (let i = 0; i < 5; i++) { const a = -2.7 + i * .55; X.beginPath(); X.moveTo(2, -78); X.quadraticCurveTo(2 + Math.cos(a) * 20, -78 + Math.sin(a) * 20 - 14, 2 + Math.cos(a) * 40, -78 + Math.sin(a) * 40 + 6); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#3ddc63'; X.stroke(); }
  X.restore();
  // the sea in bands
  g = X.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, '#46c3ee'); g.addColorStop(.5, '#1f9ad6'); g.addColorStop(1, '#1272b4'); X.fillStyle = g; X.fillRect(0, HZ, W, H - HZ);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, HZ); X.lineTo(W, HZ); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.22)'; X.beginPath(); X.moveTo(612, HZ); X.lineTo(668, HZ); X.lineTo(720, H); X.lineTo(560, H); X.fill();   // the sun's glitter road
  X.fillStyle = 'rgba(10,50,110,.12)'; for (let y = HZ + 40, i = 0; y < H; y += 26 + i * 6, i++) X.fillRect(0, y, W, 10 + i * 2);
  X = old; return cv2;
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 17; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* the seagull's heist: the same clock on both screens (it only decorates) */
const GULL_IN = 2.6, GULL_GRAB = 3.6, GULL_OUT = 4.9, BUCKET = [552, 505], BKS = [400 + (BUCKET[0] - 18 - 400) * SC, PV + (BUCKET[1] - PV) * SC - 40];   // the bucket in screen space
function gullAt(T) {
  if (T >= GULL_IN && T < GULL_GRAB) { const k = ease((T - GULL_IN) / (GULL_GRAB - GULL_IN)); return { x: lerp(860, BKS[0] - 6, k), y: lerp(60, BKS[1] - 24, k) + Math.sin(k * 9) * 8 * (1 - k), flap: T * 17, face: -1, hold: false, s: lerp(.7, 1, k) }; }
  if (T >= GULL_GRAB && T < GULL_OUT) { const k = ease((T - GULL_GRAB) / (GULL_OUT - GULL_GRAB)); return { x: lerp(BKS[0] - 6, -90, k), y: lerp(BKS[1] - 24, 50, k) - Math.sin(k * 3.14) * 40, flap: T * 20, face: -1, hold: true, s: lerp(1, .8, k) }; }
  if (T >= 8.4 && T < 11.2) { const k = (T - 8.4) / 2.8; return { x: lerp(-90, 890, k), y: 64 + Math.sin(k * 6) * 16, flap: T * 14, face: 1, hold: true, s: .62 }; }
  return null;
}

/* ═════════ the game ═════════ */
function duReel(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), reeler = D.role === 0, TS = Math.sqrt(sp);
  const LK = .4, RK = .075, AWAY = .03, WIN_D = .04;
  /* the level: the lunge schedule, identical on both screens */
  const ev = []; let t0 = 2.0 / TS, pd = R() < .5 ? -1 : 1;
  for (let i = 0; i < 8; i++) { pd = R() < .68 ? -pd : pd; ev.push({ t0, dir: pd, amp: (i === 0 ? .62 : .68) + R() * .3 }); t0 += (2.6 + R() * 1) / TS; }
  const fishAt = c => {
    let lat = .09 * Math.sin(c * 1.3) + .04 * Math.sin(c * 3.1), s = 0, tele = null, idx = -1;
    ev.forEach((e, i) => {
      const u = c - e.t0, p = u < 0 ? 0 : u < .2 ? u / .2 : u < .75 ? 1 : u < 1.3 ? 1 - (u - .75) / .55 : 0;
      if (p > 0) { lat += e.dir * e.amp * ease(p); s = Math.max(s, e.amp * p); }
      if (u > -TELE && u < 0) { tele = { e, k: (u + TELE) / TELE }; idx = i; }
    });
    return { lat: clamp(lat, -1, 1), s, tele, idx };
  };
  /* state */
  let rod = 0, rt = 0, dr = .45, drT = .45, kx = 0, ky = 0, kTight = false, fN = FOCUSN, rodSent = -9, lastRod = '';
  let w = 0, wk = 0, ang = 0, turnAcc = 0, lastPt = null, lastH = null, cdir = 0, dragging = false, lastMash = '', crankAcc = 0;
  let dist = .6, Tn = .3, strain = 0, ending = null, why = '', stSent = -9, lastSt = '';
  let rodR = 0, drR = .45, rodS = 0, drS = .45, resAt = -1, endFish = null, announced = -1, lastCleanLand = false;
  const rodTr = track(), drTr = track(), distTr = track(), wTr = track(), kHeld = new Set();
  let strainV = 0, faceMem = 1;
  const bits = [], pops = [];
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, k: 0 }, o)); }
  function splash(x, y, n, col) { for (let i = 0; i < n; i++) bit({ x: x + (cr() - .5) * 30, y, vx: (cr() - .5) * 280, vy: -(160 + cr() * 240), r: 3 + cr() * 3, c: col || '#9fe3ff' }); }
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  const dispDist = () => reeler ? dist : (distTr.at() === null ? .6 : distTr.at());
  const done = () => !!(g.result || ending);

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: reeler ? 'REEL!' : 'LEAN!', roleLabel: reeler ? 'REELER' : 'ROD HAND',
    hint: reeler ? 'DRAG IN CIRCLES (OR HOLD SPACE) TO REEL THE FISH IN - IF THE LINE SHAKES EASE OFF, IF IT SAGS CRANK HARDER' : 'POINT AT THE FISH TO LEAN THE ROD, MOUSE HEIGHT = DRAG (OR ◄ ► ▲ ▼) - KEEP THE NEEDLE GREEN',
    thint: reeler ? 'DRAG IN CIRCLES TO REEL THE FISH IN - IF THE LINE SHAKES EASE OFF, IF IT SAGS CRANK HARDER' : 'DRAG LEFT / RIGHT TO LEAN THE ROD, UP = TIGHT, DOWN = LOOSE - KEEP THE NEEDLE GREEN',
    update(dt) {
      g.c += dt;
      if (g.result && resAt < 0) { resAt = g.c; const f = fishAt(g.c), d = dispDist(); endFish = { x: 400 + f.lat * FX, y: fishY(d), s: fishS(d), face: f.lat < 0 ? -1 : 1, lat: f.lat }; }
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); kTight = false; kx = 0; ky = 0; }
      const f = fishAt(g.c), dn = done();
      if (f.idx !== announced) { announced = f.idx; if (f.idx >= 0 && !dn) { if (reeler) noise(.12, .02, 1500, 800, 'bandpass'); else { snd(480, .1, 'triangle', .05, 0, 700); noise(.16, .04, 1800, 700, 'bandpass'); } } }
      if (reeler) {
        /* the crank: circles anywhere → turns / s */
        const inst = turnAcc / Math.max(dt, 1e-3); turnAcc = 0;
        const kw = !dn && (kHeld.has('Space') || kHeld.has('Enter')) ? 1.8 : 0; wk += (kw - wk) * Math.min(1, dt * (kw ? 5 : 8));
        w += (dn ? 0 : Math.max(Math.min(inst, 3.4), wk) - w) * Math.min(1, dt * 10);
        ang += w * TAU * dt; crankAcc += w * dt; if (crankAcc > 1 / 6) { crankAcc = 0; if (!dn) snd(260 + Tn * 420, .03, 'square', .028); }
        /* the partner's rod and drag */
        rodS += (rodR - rodS) * Math.min(1, dt * 14); drS += (drR - drS) * Math.min(1, dt * 10);
        const m = Math.min(1, Math.abs(rodS - f.lat) / .6), load = LK * f.s * (.25 + .75 * m) * (.5 + .5 * drS);
        Tn += (clamp(.06 + .5 * drS + .13 * Math.min(w, 2.8) + load, 0, 1.05) - Tn) * Math.min(1, dt * 9);
        if (!dn) {
          const eff = ss(Tn, .26, .38), slack = Tn < .26 ? .14 * (.26 - Tn) / .26 : 0;
          dist = clamp(dist + ((AWAY + slack + f.s * (.1 + .75 * clamp((Math.abs(rodS - f.lat) - .4) / .4, 0, 1))) - RK * w * eff) * TS * dt, 0, 1.02);
          strain = clamp(strain + (Tn > .87 ? 1 / .9 : -.9) * dt, 0, 1.2);
          if (Tn > .6 && cr() < dt * 10) noise(.08, .02, 700 + Tn * 900, 500, 'bandpass');
        }
        const sIt = Math.round(dist * 1000) + ',' + Math.round(Tn * 1000) + ',' + Math.round(strain * 100) + ',' + Math.round(w * 100);
        if (sIt !== lastSt && g.c - stSent >= .1) { lastSt = sIt; stSent = g.c; D.send('st', [Math.round(dist * 1000), Math.round(Tn * 1000), Math.round(strain * 100), Math.round(w * 100)], true); }
        strainV = strain;
        if (!g.result) {
          if (!ending && dist <= WIN_D) ending = { res: 'win', at: g.c + .12 };
          else if (!ending && strain >= 1) ending = { res: 'lose', at: g.c, why: 'snap' };
          else if (!ending && dist >= 1) ending = { res: 'lose', at: g.c, why: 'drag' };
          if (ending && g.c >= Math.min(ending.at, g.limit)) { why = ending.why || ''; if (why) D.send('why', why); g.finish(ending.res); }
          else if (!ending && g.c >= g.limit) { why = 'drag'; D.send('why', why); g.finish('lose'); }
        }
      } else {
        /* lean + drag: pointer / keys → targets; the rod follows fast, the drag lever moves at a human pace */
        if (!dn) {
          if (kx) rt = clamp(rt + kx * 2.4 * dt, -1, 1);
          if (ky) drT = clamp(drT + ky * .8 * dt, 0, 1);
          rod += (rt - rod) * Math.min(1, dt * 14);
          const want = kTight ? 1 : drT; dr += clamp(want - dr, -2 * dt, 2 * dt);
        }
        const rIt = Math.round(rod * 1000) + ',' + Math.round(dr * 1000);
        if (rIt !== lastRod && g.c - rodSent >= .1) { lastRod = rIt; rodSent = g.c; D.send('rd', [Math.round(rod * 1000), Math.round(dr * 1000)], true); }
        /* predicted tension: same formula, my rod / drag, the reeler's crank as I see it */
        const wr = wTr.at() === null ? 0 : wTr.at(); ang += wr * TAU * dt;
        const m = Math.min(1, Math.abs(rod - f.lat) / .6), load = LK * f.s * (.25 + .75 * m) * (.5 + .5 * dr);
        Tn += (clamp(.06 + .5 * dr + .13 * Math.min(wr, 2.8) + load, 0, 1.05) - Tn) * Math.min(1, dt * 9);
        if (!g.result && Tn > .6 && cr() < dt * 10) noise(.08, .02, 700 + Tn * 900, 500, 'bandpass');
      }
      // cosmetic: particles, popped words
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      if (resAt >= 0) {
        const rk = g.c - resAt, win = g.result === 'win';
        if (win && !lastCleanLand && rk >= .52) { lastCleanLand = true; sfx.splat(); sfx.coin(); sfx.sparkle(); shake(7, .2); splash(420, 500, 14); }
        if (!win && !lastCleanLand) { lastCleanLand = true; if (why === 'snap') { snd(1400, .12, 'sawtooth', .07, 0, 200); sfx.miss(); shake(6, .2); burst(400 + ((endFish ? endFish.x : 400) - 400) * .5, 300, '#ffffff', 16); ring(400 + ((endFish ? endFish.x : 400) - 400) * .5, 300, '#ffffff', 60); } else { sfx.whoosh(true); snd(300, .5, 'sine', .08, 0, 700); } }
      }
    },
    msg(type, d) {
      if (reeler) {
        if (type === 'rd' && Array.isArray(d)) { rodR = clamp(d[0] / 1000, -1, 1); drR = clamp(d[1] / 1000, 0, 1); rodTr.push(rodR); drTr.push(drR); }
      } else if (type === 'st' && Array.isArray(d)) {
        distTr.push(d[0] / 1000); wTr.push(d[3] / 100); Tn += (d[1] / 1000 - Tn) * .5; strainV = d[2] / 100;
      }
      if (type === 'why') why = d;
    },
    /* the crank: the heading of the stroke turning = the handle turning (any direction) */
    drag(p) {
      if (!reeler || g.result) return;
      if (!lastPt) { lastPt = { x: p.x, y: p.y }; return; }
      const dx = p.x - lastPt.x, dy = p.y - lastPt.y; if (dx * dx + dy * dy < 49) return;
      const h = Math.atan2(dy, dx); lastPt = { x: p.x, y: p.y };
      if (lastH !== null) {
        let dh = h - lastH; while (dh > Math.PI) dh -= TAU; while (dh < -Math.PI) dh += TAU;
        if (Math.abs(dh) < 1.4) { cdir = cdir * .85 + dh; if (Math.sign(dh) === Math.sign(cdir) || Math.abs(cdir) < .2) turnAcc += Math.abs(dh) / TAU; }
      }
      lastH = h;
    },
    aim(p) { rt = clamp((p.x - 400) / FX, -1, 1); drT = clamp(.45 + (330 - p.y) * .0024, 0, 1); },
    draw() {
      const T = g.c, won = g.result === 'win' || (ending && ending.res === 'win'), lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      X = ctx; if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      const f = fishAt(T), d = dispDist(), tele = !g.result ? f.tele : null;
      const myRod0 = reeler ? (rodTr.at() === null ? 0 : rodTr.at()) : rod, myRod = myRod0 + (lost && why === 'snap' && rk >= 0 ? -Math.sign(endFish.lat || 1) * Math.sin(rk * 26) * .55 * Math.max(0, 1 - rk * 1.8) : 0), myDr = reeler ? (drTr.at() === null ? .45 : drTr.at()) : dr;
      const vib = clamp((Tn - .62) / .22, 0, 1), sag = clamp((.40 - Tn) / .2, 0, 1), red = clamp(strainV, 0, 1);
      const snap = lost && why === 'snap', tow = lost && !snap, landed = won && rk >= 0;
      // cloud + live sea ripples
      for (let i = 0; i < 3; i++) { const cx = ((T * (6 + i * 3) + i * 300) % 1000) - 100; X.fillStyle = 'rgba(255,255,255,.9)'; el(cx, 56 + i * 34, 60 + i * 14, 14); ink('#fff', 2.5); el(cx + 26, 44 + i * 34, 34, 14); ink('#fff', 2.5); }
      X.strokeStyle = 'rgba(220,245,255,.55)'; X.lineWidth = 3; X.lineCap = 'round';
      for (let i = 0; i < 11; i++) { const y = HZ + 22 + i * (22 + i * 3.4); X.beginPath(); for (let x = -40; x < W + 40; x += 70) { const px = x + ((T * (14 + i * 3) + i * 37) % 70); X.moveTo(px, y); X.quadraticCurveTo(px + 14, y - 5 - i * .4, px + 28, y); } X.stroke(); }
      // the boat frame (bobbing, rolling with the rod, towed away on a "drag" loss): toS maps boat coordinates to the screen
      const bob = Math.sin(T * 2.2) * 2.4 + (Tn > .75 && !g.result ? Math.sin(T * 50) * 1.2 : 0), roll = Math.sin(T * 1.7) * .012 + myRod * .02;
      const tk = tow && rk >= 0 ? ease(rk / .8) : 0, tx0 = tk && endFish ? endFish.lat * 120 * tk : 0, ty0 = -230 * tk * tk, ts = 1 - .45 * tk;
      const toS = (x, y) => { const dx = (x - 400) * SC, dy = (y - PV) * SC, c = Math.cos(roll), s = Math.sin(roll); return [400 + tx0 + ts * (dx * c - dy * s), PV + ty0 + ts * (dx * s + dy * c + bob)]; };
      // the fish (floats on the surface)
      let fx = 400 + f.lat * FX, fy = fishY(d) + Math.sin(T * 3.1) * 3, fs = fishS(d), face = (faceMem = f.lat < -.03 ? -1 : f.lat > .03 ? 1 : faceMem);
      if (tele) face = tele.e.dir;
      if (rk >= 0 && endFish) { fx = endFish.x; fy = endFish.y; fs = endFish.s; face = endFish.face; }
      const fo = { jaw: tele && !reeler ? (Math.sin(T * 26) > 0 ? 1 : .25) : 0, fast: !!tele || (Tn > .7 && !g.result) };
      let px = fx, py = fy, ps = fs;
      if (snap && rk >= 0) { const k = ease(clamp((rk - .1) / .8, 0, 1)); px = fx + face * 170 * k; py = fy - 26 * k; ps = fs * (1 - .25 * k); fo.wave = rk > .18; fo.fast = rk < .25; fo.glint = rk > .3 ? clamp((rk - .3) / .2, 0, 1) * (1 + Math.sin(T * 20) * .2) : 0; }
      if (tow && rk >= 0) { const k = ease(rk / .8); py = fy - 120 * k; px = fx + (endFish.lat > 0 ? 1 : -1) * 20 * k; ps = fs * (1 - .15 * k); fo.fast = true; fo.jaw = .3; }
      if (!landed) {
        X.strokeStyle = 'rgba(235,250,255,.8)'; X.lineWidth = 4; const rw = 1 + Math.sin(T * 5) * .05; el(px, py + 36 * ps, 78 * ps * rw, 12 * ps); X.stroke(); X.strokeStyle = 'rgba(235,250,255,.5)'; el(px, py + 36 * ps, 100 * ps * rw, 17 * ps); X.stroke();
      }
      // lunge telegraph: the rod hand sees it big, the reeler just a few bubbles
      if (tele) {
        const tx = 400 + tele.e.dir * tele.e.amp * FX, pulse = 1 + Math.sin(T * 18) * .12;
        if (!reeler) {
          X.lineWidth = 5; X.strokeStyle = '#ffd23f'; for (let i = 0; i < 3; i++) { el(tx, fy + 34 * fs, (22 + i * 16 + tele.k * 20) * pulse, (6 + i * 4 + tele.k * 6) * pulse); X.globalAlpha = .9 - i * .25; X.stroke(); } X.globalAlpha = 1;
          for (let i = 0; i < 3; i++) { const ax = fx + tele.e.dir * (74 * fs + 18 + i * 22), ay = fy - 6 * fs; X.beginPath(); X.moveTo(ax, ay - 14); X.lineTo(ax + tele.e.dir * 16, ay); X.lineTo(ax, ay + 14); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#ffd23f'; X.globalAlpha = .45 + .55 * ((Math.floor(T * 12) + i) % 3 === 0); X.stroke(); X.globalAlpha = 1; }
          badge('!', fx, fy - 74 * fs - 14, 26, '#e8434f', '#fff', outBack(tele.k * 3), 0);
        } else { for (let i = 0; i < 3; i++) circ(tx + (i - 1) * 14, fy + 34 * fs + Math.sin(T * 9 + i) * 3, 2.5 + (i % 2), 'rgba(255,255,255,.8)', 0); }
      }
      if (!landed) tuna(px, py, ps, face, fo, T);
      // ---- the boat ----
      const R_ = rodShape(myRod, clamp((Tn - .35) * 34, -4, 22)), mouthIn = landed && endFish ? null : mouthOf(px, py, ps, face);
      X.save(); X.translate(400, PV); X.translate(tx0, ty0); X.scale(ts, ts); X.translate(0, bob); X.rotate(roll); X.scale(SC, SC); X.translate(-400, -PV);
      if (tk > 0) { X.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 6; i++) { const q = (T * 3 + i / 6) % 1; el(400 + (i - 2.5) * 36, 552 + q * 70, 20 * (1 - q), 6 * (1 - q)); X.fill(); } }
      // interior, crab + bucket on the right end, the dial post on the left
      X.beginPath(); X.moveTo(222, 486); X.lineTo(578, 486); X.lineTo(560, 520); X.lineTo(240, 520); X.closePath(); ink('#5b3a20', 3.5);
      const gl = gullAt(T), cm = gl && T >= GULL_IN + .6 && T < GULL_GRAB + .3 ? 'shock' : T >= GULL_GRAB + .3 && T < GULL_OUT + .2 ? 'angry' : f.s > .5 && !g.result ? 'shock' : 'bored';
      bucket(BUCKET[0] - 18, BUCKET[1], T >= GULL_GRAB ? 2 : 3);
      crab(BUCKET[0] + 34, 506 + (cm === 'shock' ? -Math.abs(Math.sin(T * 16)) * 3 : 0), T, landed && rk > .6 ? 'bored' : cm, landed && rk > .7);
      gauge(GAUGE[0], GAUGE[1], GR, Tn, !reeler, T);
      rodDraw(R_);
      reelBody(REEL[0], REEL[1], ang, clamp(1 - d, 0, 1), reeler ? vib * 1.6 : 0, T);
      // crew
      const tags = [], mood = won ? 'happy' : lost ? 'sad' : null, hop = landed ? Math.abs(Math.sin(T * 10)) * 12 : 0;
      const rodCol = reeler ? pCol() : myCol(), reelCol = reeler ? myCol() : pCol(), grip = R_.at(.16), strained = (Tn > .75 || tele) && !g.result;
      const cheer = (cx, cy, col) => { const w2 = Math.sin(T * 14) * .3; X.save(); X.translate(cx, cy); arm(5, 1, .5 - w2, 1, col); arm(5, -1, -.5 + w2, 1, col); X.restore(); };
      { const cx = RX[0], cy = FEET - hop, a = (myDr - .5) * 1.7, kn = [LEVER[0] + Math.sin(a) * 36, LEVER[1] - Math.cos(a) * 36];
        lever(LEVER[0], LEVER[1], myDr);
        if (landed) cheer(cx, cy, rodCol); else { reach(cx, cy, 5, 1, grip[0], grip[1], rodCol); reach(cx, cy, 5, -1, kn[0], kn[1], rodCol); }
        caos(cx, cy, 5, { col: rodCol, mood });
        if (strained && !won) sweat(cx + 26, cy - 40, T, 2);
        tags.push([cx, reeler ? 'YOUR FRIEND' : 'YOU', rodCol]);
      }
      { const cx = RX[1], cy = FEET - hop, hk = [REEL[0] + Math.cos(ang) * HR, REEL[1] + Math.sin(ang) * HR];
        if (landed) cheer(cx, cy, reelCol); else { reach(cx, cy, 5, -1, hk[0], hk[1], reelCol); reach(cx, cy, 5, 1, cx + 40, cy - 14, reelCol); }
        caos(cx, cy, 5, { col: reelCol, mood });
        if (w > 1.2 && reeler && !g.result || (!reeler && (wTr.at() || 0) > 1.2 && !g.result)) sweat(cx - 30, cy - 40, T, 2);
        tags.push([cx, reeler ? 'YOU' : 'YOUR FRIEND', reelCol]);
      }
      reelHandle(REEL[0], REEL[1], ang, reeler ? vib * 1.6 : 0, T);
      if (reeler && vib > .25 && !g.result) { X.strokeStyle = '#ff4d4d'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a = -2.4 + i * .5 + Math.sin(T * 30) * .06; X.beginPath(); X.moveTo(REEL[0] + Math.cos(a) * 38, REEL[1] + Math.sin(a) * 38); X.lineTo(REEL[0] + Math.cos(a) * (46 + vib * 8), REEL[1] + Math.sin(a) * (46 + vib * 8)); X.stroke(); } }
      // the winning fish lands in the boat
      let flyP = null;
      if (landed && endFish) {
        const k = clamp(rk / .55, 0, 1), e = ease(k), sx = 400 + (endFish.x - 400) / SC, sy = PV + (endFish.y - PV) / SC;
        const bx = lerp(sx, 424, e), by = lerp(sy, 490, e) - Math.sin(k * Math.PI) * 150, bs = lerp(endFish.s / SC, .95, e), rot = k >= 1 ? .22 + Math.sin(T * 24) * .05 * Math.max(0, 1 - (rk - .55) * 2) : -k * TAU * endFish.face + .22;
        flyP = [bx, by, bs, k];
        tuna(bx, by, bs, endFish.face < 0 ? -1 : 1, { fast: true, jaw: k >= 1 ? .6 + Math.sin(T * 12) * .4 : 1, rot, shades: k < .6 }, T);
        if (k >= 1) { const sk = (rk - .55) / .3; if (sk > 0 && sk < 1) { X.globalAlpha = 1 - sk; star(bx + 40, by - 40, 26 * sk + 6, 6, 4, T * 4, '#fff', 0); X.globalAlpha = 1; } }
      }
      // front of the hull
      X.beginPath(); X.moveTo(204, 505); X.lineTo(596, 505); X.quadraticCurveTo(582, 556, 520, 558); X.lineTo(282, 558); X.quadraticCurveTo(218, 556, 204, 505); X.closePath(); ink('#c27a3e', 4.5);
      X.save(); X.clip();
      X.fillStyle = '#e8434f'; X.fillRect(190, 505, 420, 14); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(190, 508, 420, 3);
      X.strokeStyle = 'rgba(90,50,20,.5)'; X.lineWidth = 2.5; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(190, 528 + i * 11); X.lineTo(610, 528 + i * 11); X.stroke(); }
      X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(190, 545, 420, 20); X.restore();
      X.beginPath(); X.arc(566, 536, 14, 0, TAU); ink('#fff', 3.5); X.strokeStyle = '#e8434f'; X.lineWidth = 6; for (let i = 0; i < 4; i++) { X.beginPath(); X.arc(566, 536, 10, i * Math.PI / 2 + .3, i * Math.PI / 2 + 1.0); X.stroke(); }
      X.beginPath(); X.arc(566, 536, 5, 0, TAU); ink('#c27a3e', 2);
      for (const [tx2, lb, tc] of tags) pill(tx2, 534, lb, tc);
      X.fillStyle = 'rgba(235,250,255,.85)'; for (let i = 0; i < 9; i++) { el(232 + i * 42 + Math.sin(T * 3 + i) * 5, 556 + Math.sin(T * 4 + i * 2) * 2, 22, 6); X.fill(); }
      // the ring where the rod tip should be: where the fish will pull (big, early) / where it is now
      if (!reeler && !g.result) {
        const lt = tele ? tele.e.dir * tele.e.amp : f.lat, tx = 400 + lt * RSC, ty = TIPY + Math.abs(lt) * 20, pulse = tele ? 1 + Math.sin(T * 14) * .1 : 1;
        X.lineWidth = 7; X.strokeStyle = INK; X.setLineDash([9, 7]); X.lineDashOffset = -T * 40; X.beginPath(); X.arc(tx, ty, 22 * pulse, 0, TAU); X.stroke(); X.lineWidth = 3.5; X.strokeStyle = tele ? '#ffd23f' : 'rgba(255,240,150,.9)'; X.stroke(); X.setLineDash([]);
      }
      if (reeler && !g.result && T < 3.4) { X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 4; X.setLineDash([8, 8]); X.lineDashOffset = -T * 30; X.beginPath(); X.arc(REEL[0], REEL[1], 50, 0, TAU); X.stroke(); X.setLineDash([]); }
      X.restore();
      // the line, tip → mouth (in screen space; it sags when slack, shakes and reddens when about to snap)
      const tipS = toS(R_.tx, R_.ty);
      if (landed && flyP) { const m = toS(flyP[0] + 76 * flyP[2] * (endFish.face < 0 ? -1 : 1), flyP[1] + 8 * flyP[2]); if (rk < .5) lineDraw(tipS, m, 0, 0, 0, T, null); }
      else {
        const cutK = snap && rk >= 0 ? clamp(rk / .25, 0, 1) : null, mo = mouthIn;
        lineDraw(tipS, mo, tow ? 0 : sag, tow ? 0 : vib * (1 - (cutK || 0)), tow ? 0 : red, T, cutK);
      }
      // the seagull's heist (in front of everything in the sky)
      if (gl) gull(gl.x, gl.y, gl.flap, gl.s, gl.face, gl.hold);
      // particles + popped words
      for (const b of bits) { const a = T - b.t0, fade = clamp(a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1, 0, 1); X.globalAlpha = fade; drop(b.x, b.y, b.r, b.c); X.globalAlpha = 1; }
      // first-seconds hints + live warnings (UI in the world)
      if (!g.result) {
        if (T < 3.4) badge(reeler ? (TOUCH ? 'CIRCLE HERE!' : 'DRAG IN CIRCLES') : 'MATCH THE FISH!', 612, 338, 18, '#2b9ee6', '#fff', 1, -.05);
        else if (!reeler && Tn > BAND[1] + .02) badge('LOOSEN!', 210, 352, 20, '#e8434f', '#fff', 1, -.05);
        else if (!reeler && Tn < BAND[0] - .04) badge('TIGHTEN!', 210, 352, 20, '#2b9ee6', '#fff', 1, -.05);
        else if (reeler && vib > .6) badge('EASE OFF!', 612, 338, 20, '#e8434f', '#fff', 1, -.05);
        else if (reeler && sag > .55) badge('CRANK!', 612, 338, 20, '#2b9ee6', '#fff', 1, -.05);
      }
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 14, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (rk >= 0) {
        if (won) badge('REELED IN!', 400, 190, 40, '#22a447', '#fff', outBack((rk - .35) / .2), -.05);
        else if (snap) { badge('TWANG!', 400, 170, 40, '#e8434f', '#fff', outBack(rk / .15), -.05); if (rk > .3) badge('BYE-BYE!', clamp(px, 170, 630), clamp(py - 80, 120, 300), 26, '#4577bd', '#fff', outBack((rk - .3) / .2), .06); }
        else badge('WHEEEE!', 400, 150, 40, '#ff9a4d', '#fff', outBack(rk / .2), -.05);
      }
      vignette(.14);
    },
    down(p) { if (reeler) { dragging = true; lastPt = { x: p.x, y: p.y }; lastH = null; } else g.aim(p); },
    move(p) { if (reeler) { if (dragging || !p.touch) g.drag(p); } else g.aim(p); },
    up() { if (reeler) { dragging = false; lastPt = null; lastH = null; } },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (reeler) {
        if (e.code === 'KeyA' || e.code === 'KeyD') { if (e.repeat) return; const side = e.code === 'KeyA' ? 'L' : 'R'; if (side !== lastMash) { lastMash = side; turnAcc += .22; } return; }
        if (e.code === 'Space' || e.code === 'Enter') kHeld.add(e.code);
      } else {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1;
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') ky = 1; else if (e.code === 'ArrowDown' || e.code === 'KeyS') ky = -1;
        else if (e.code === 'Space' || e.code === 'Enter') kTight = true;
      }
    },
    keyup(e) {
      if (reeler) kHeld.delete(e.code);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { if (ky > 0) ky = 0; } else if (e.code === 'ArrowDown' || e.code === 'KeyS') { if (ky < 0) ky = 0; }
      else if (e.code === 'Space' || e.code === 'Enter') kTight = false;
    },
  };
  g.dbg = {
    /* what the REELER screen shows: the line (sags when slack, shakes when tight), the reel, the fish's distance, a tiny ripple before a lunge */
    reelerView: () => ({ vib: clamp((Tn - .62) / .22, 0, 1), sag: clamp((.40 - Tn) / .2, 0, 1), hint: !!fishAt(g.c).tele, dist, w }),
    /* what the ROD HAND screen shows: the gauge, the fish and the lunge telegraph, the reel's speed, my rod and lever */
    rodView: () => { const f = fishAt(g.c); return { T: Tn, lat: f.lat, s: f.s, tele: f.tele ? { dir: f.tele.e.dir, amp: f.tele.e.amp, left: (1 - f.tele.k) * TELE } : null, w: wTr.at() || 0, rod, dr, dist: dispDist(), band: BAND }; },
    state: () => ({ dist, Tn, strain, w }),
  };
  wire(g, D, 0, sp, 'du_reel');
  return g;
}
reg('du_reel', duReel, 'REEL & RELEASE'); REGMAP.du_reel.duo = true;

/* ───────────── intro card: what each role does (520×240 frame) ───────────── */
function demo(role, t) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 70); gr.addColorStop(0, '#59b8f0'); gr.addColorStop(1, '#d6f1ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 70);
  gr = X.createLinearGradient(0, 70, 0, 240); gr.addColorStop(0, '#46c3ee'); gr.addColorStop(1, '#1272b4'); X.fillStyle = gr; X.fillRect(0, 70, 520, 170);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 70); X.lineTo(520, 70); X.stroke();
  const u = t % 3.6, lunge = u > 1.6 && u < 2.8, lat = lunge ? .8 * Math.sin(Math.min(1, (u - 1.6) / .3) * 1.57) * (u > 2.4 ? 1 - (u - 2.4) / .4 : 1) : 0;
  const fx = 340 + lat * 90, fy = 110 + Math.sin(t * 3) * 3, tele = u > .9 && u < 1.6;
  X.strokeStyle = 'rgba(235,250,255,.8)'; X.lineWidth = 3; el(fx, fy + 22, 48, 8); X.stroke();
  tuna(fx, fy, .62, lat < -.1 ? -1 : 1, { jaw: tele ? (Math.sin(t * 26) > 0 ? 1 : .2) : 0, fast: lunge }, t);
  // a little boat bottom-left
  X.beginPath(); X.moveTo(40, 200); X.lineTo(250, 200); X.quadraticCurveTo(240, 236, 200, 238); X.lineTo(90, 238); X.quadraticCurveTo(50, 236, 40, 200); X.closePath(); ink('#c27a3e', 3.5); X.fillStyle = '#e8434f'; X.fillRect(42, 200, 206, 9);
  const tipX = 145 + (role ? Math.sin(t * 2.4) * 40 * (lunge ? 1 : .3) + lat * 30 : lat * 26), tip = [tipX, 56];
  X.beginPath(); X.moveTo(145, 200); X.quadraticCurveTo(145 + (tipX - 145) * .15, 130, tipX, 56); X.lineWidth = 10; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#d99a4a'; X.stroke();
  const vibr = role ? 0 : (u > 2.0 && u < 2.7 ? 1 : 0);
  lineDraw(tip, [fx + 44, fy + 6], role ? .1 : 0, vibr, vibr * .6, t, null);
  if (!role) {
    const a = t * 11; reelBody(205, 180, a, .5, vibr * 2, t); reelHandle(205, 180, a, vibr * 2, t);
    caos(240, 205, 3.4, { col: '#FFC93C' });
    X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 4; X.setLineDash([7, 7]); X.lineDashOffset = -t * 40; X.beginPath(); X.arc(420, 172, 34, 0, TAU); X.stroke(); X.setLineDash([]);
    demoFinger(420 + Math.cos(a) * 34, 172 + Math.sin(a) * 34, true, 0);
    badge(vibr ? 'EASE OFF!' : 'CRANK!', 380, 30, 18, vibr ? '#e8434f' : '#2b9ee6', '#fff', 1, -.03);
  } else {
    gauge(70, 168, 28, tele || lunge ? (lunge ? .62 : .5) : .5, true, t, 202);
    caos(150, 205, 3.4, { col: '#6EA8FE' });
    const px = 330 + lat * 90 + (tele ? 0 : 0);
    demoFinger(clamp(px + 12, 270, 470), 190, true, 0);
    badge(tele ? 'LEAN WITH IT!' : 'KEEP IT GREEN', 380, 30, 18, tele ? '#ffd23f' : '#22a447', tele ? INK : '#fff', 1, -.03);
  }
}
DUO.INFO.du_reel = [['REELER', 'CRANK THE FISH IN', 'DRAG IN CIRCLES'], ['ROD HAND', 'LEAN + KEEP IT GREEN', 'MOUSE X = LEAN, Y = DRAG']];
DUO.DEMOS.du_reel = [t => demo(0, t), t => demo(1, t)];

})();
