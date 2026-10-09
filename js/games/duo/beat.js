'use strict';
/* ═════════ DUO · DUET (du_beat) ═════════
   Two Caos mariachis serenade a grumpy walrus critic in his theatre box. Each singer owns one spotlight: notes fall down
   it and the singer taps as a note's head crosses the ring above the sombrero (anywhere on the screen, or Space).
   Every tap is judged on the tapper's own screen against the ring it sees: PERFECT (±85 ms) = 2 claps, GOOD (±160 ms) = 1,
   a note that slips past untapped = MISS (it drops on the sombrero), a tap with no note in reach = a SOUR note (−1 clap).
   The applause meter needs NEED claps; one lane alone tops out below it, so both singers have to sing.
   LEFT SINGER (role 0, JUDGE) · RIGHT SINGER (role 1). The song is the same on both screens (seeded): four call-and-response
   phrases (one singer leads, the other answers) and a final two-voice chord.
   Netcode: each singer judges only its own notes and relays every verdict as ONE event 'j' [note, grade, offset ms]; sour taps
   relay as a running count 's' (coalesced). On the other screen the partner's notes are dimmed; a partner note that reaches
   the ring before its verdict hovers there ("…") until the verdict arrives, and a verdict that arrives early waits for its
   note to reach the ring, so lag never shows a note falling through. Team totals are always rebuilt from per-note events.
   The judge decides once every verdict is in after the last note (or a short grace later), or at once when even PERFECTs on
   every note still open could not reach the goal. */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const rgba = (h, a) => { const [r, g2, b] = rgb(h); return `rgba(${r},${g2},${b},${a})`; };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box down to y≈170, the top-right LEAVE and y>552) ───────────── */
const LX = [310, 490];                    // the two spotlight lanes (role 0 left, role 1 right) on BOTH screens
const TOP = 168, HY = 388, SY = 494, SU = 5.2;   // notes appear at TOP, the ring is at HY, the singers' feet at SY
const HAT = SY - 9 * SU - 4;              // where a missed note lands (the sombrero's crown)
const JX = 694, JY = 292, JS = .86;       // the walrus critic's head
const MX = 125, MY = 326, MR = 74;        // the applause meter's dial
const PLATES = [[24, 470, 202, 76], [574, 470, 202, 76]];
const PERF = .085, GOOD = .16;            // judging windows (seconds, never scaled by speed)
const LAT = (typeof TOUCH !== 'undefined' && TOUCH) ? .04 : .02;   // taps land a little after the eye sees the line (display + touch latency)
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
const NOTEHZ = s => 440 * Math.pow(2, (60 + s - 69) / 12);

/* palette */
const WOOD = '#c98a4b', WOOD2 = '#9b5d2c', VEL = '#c8283a', VEL2 = '#8c1424', GOLD = '#ffd23f', GOLD2 = '#c9971a';
const WAL = '#c49a80', WAL2 = '#9a6f58', WAL3 = '#e3bea4', PAD = '#efcfb6', TUX = '#2b2547';
const STRAW = '#f2c75c', STRAW2 = '#c99a33';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
/* cel shading with a shifted copy of the same shape: base on top, the shade shows as a crescent on the (sx, sy) side */
function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function glint(p, x, y, rx, ry, col, rot = 0) { X.save(); X.clip(p); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
function pill(x, y, label, col, up) {                // a name tag with a little pointer (down, or up), e.g. YOU / YOUR FRIEND
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
/* a word on a chunky coloured badge (feedback that stays readable over any background) */
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(236, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 236);
  X.restore();
}
function plate(b, col, dk, down) {
  const [x, y, w, h] = b, d = down ? 3 : 9;
  rr(x, y + 9, w, h, 20); ink(dk, 4);
  rr(x, y + 9 - d, w, h, 20); ink(col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 12, 6); X.fill();
  rr(x, y + 9 - d, w, h, 20); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  return 9 - d;
}
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }

/* ───────────── props ───────────── */
/* an eighth note: the head's centre at (0, 0) after translate (x, y); s scale; sour = bent, cracked and green */
function note(x, y, s, col, sour, rot) {
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(s, s);
  const stem = sour ? 'M12 -3 Q20 -26 10 -50' : 'M12 -3 L12 -50';
  X.lineCap = 'round'; X.lineJoin = 'round';
  X.lineWidth = 11; X.strokeStyle = INK; X.stroke(P(stem));
  X.beginPath(); X.moveTo(sour ? 10 : 12, -50); X.bezierCurveTo(sour ? 18 : 22, -42, sour ? 32 : 34, -34, sour ? 22 : 28, -18); X.lineWidth = 11; X.stroke();
  X.lineWidth = 4.5; X.strokeStyle = sour ? '#c7f07a' : '#fff'; X.stroke(); X.stroke(P(stem));
  el(0, 0, 16, 12, -.38); ink(col, 4);
  X.fillStyle = 'rgba(255,255,255,.55)'; el(-6, -4, 5.5, 3, -.38); X.fill();
  if (sour) { X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-4, -11); X.lineTo(0, -3); X.lineTo(-5, 2); X.lineTo(-1, 10); X.stroke(); }
  X.restore();
}
function sombrero(x, y, s, band, tilt) {               // sitting on a head whose top is at y
  X.save(); X.translate(x, y); X.rotate(tilt || 0); X.scale(s, s);
  el(0, 2, 58, 11); ink(STRAW2, 4); el(0, -1, 56, 8.5); X.fillStyle = STRAW; X.fill();
  X.beginPath(); X.moveTo(-22, 0); X.bezierCurveTo(-24, -30, -10, -40, 0, -40); X.bezierCurveTo(10, -40, 24, -30, 22, 0); X.closePath(); ink(STRAW, 4);
  X.save(); X.clip(); X.fillStyle = STRAW2; X.fillRect(10, -44, 20, 48); X.restore();
  X.beginPath(); X.moveTo(-22, -4); X.lineTo(22, -4); X.lineTo(21, -13); X.lineTo(-21, -13); X.closePath(); ink(band, 2.5);
  X.fillStyle = '#fff'; for (let i = -16; i <= 12; i += 8) { X.beginPath(); X.moveTo(i, -5); X.lineTo(i + 4, -12); X.lineTo(i + 8, -5); X.fill(); }
  X.fillStyle = 'rgba(255,255,255,.4)'; el(-9, -28, 4, 8, .3); X.fill();
  for (const px of [-50, -34, 34, 50]) { X.beginPath(); X.arc(px, 10, 4, 0, TAU); ink(band, 2); }
  X.restore();
}
function maraca(x, y, a, col) {
  X.save(); X.translate(x, y); X.rotate(a);
  rr(-2.5, -2, 5, 16, 2); ink('#8a5a34', 2.5);
  el(0, -12, 9, 11); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.5)'; el(-3, -16, 3, 2.4, -.5); X.fill();
  X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(-7, -9); X.lineTo(7, -13); X.stroke();
  X.restore();
}
function tomato(x, y, r, rot) {
  X.save(); X.translate(x, y); X.rotate(rot || 0);
  X.beginPath(); X.arc(0, 0, r, 0, TAU); ink('#ff3b30', 3); X.fillStyle = 'rgba(255,255,255,.55)'; el(-r * .35, -r * .4, r * .3, r * .18, -.5); X.fill();
  X.fillStyle = '#3fae4a'; for (let i = 0; i < 5; i++) { X.save(); X.rotate(i * TAU / 5); el(0, -r * .9, 2.6, 6); X.fill(); X.restore(); }
  X.restore();
}
function splat(x, y, s, rot) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  X.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = i % 2 ? 9 : 15 + (i % 3) * 3; X.lineTo(Math.cos(a) * r, Math.sin(a) * r * .8); } X.closePath(); ink('#e8281e', 2.5);
  X.fillStyle = '#ff7a6b'; el(-3, -3, 5, 3); X.fill(); X.fillStyle = '#ffe9a8'; for (const [a, b] of [[4, 2], [-5, 4], [1, -6]]) { el(a, b, 1.6, 1.2); X.fill(); }
  X.restore();
}
function rose(x, y, s, rot) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  X.strokeStyle = INK; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 4); X.lineTo(0, 36); X.stroke(); X.strokeStyle = '#3fae4a'; X.lineWidth = 3.5; X.stroke();
  el(-7, 22, 7, 3.5, .6); ink('#3fae4a', 2);
  X.beginPath(); X.arc(0, -2, 10, 0, TAU); ink('#e8274e', 3);
  X.strokeStyle = '#a3102e'; X.lineWidth = 2; X.beginPath(); X.arc(0, -2, 5, .5, 5); X.stroke(); X.beginPath(); X.arc(1, -2, 2, 0, 5); X.stroke();
  X.restore();
}
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
/* the vaudeville hook: a long cane from the left wing, its crook at (x, y) */
function hook(x, y) {
  X.save(); X.lineCap = 'round';
  X.beginPath(); X.moveTo(-60, y - 6); X.lineTo(x - 24, y - 6); X.arc(x - 24 + 18, y + 12, 25, -Math.PI * .75, Math.PI * .55);
  X.lineWidth = 17; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#c98a4b'; X.stroke();
  X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.5)'; X.beginPath(); X.moveTo(-60, y - 8); X.lineTo(x - 26, y - 8); X.stroke();
  X.restore();
}

/* ───────────── the walrus critic (head centre at x, y) ───────────── */
const WHEAD = 'M-82 6 C-88 -52 -50 -82 0 -82 C50 -82 88 -52 82 6 C78 50 42 68 0 68 C-42 68 -78 50 -82 6 Z';
const WMUST = 'M-66 28 Q-64 56 -46 52 Q-36 64 -22 56 Q-10 66 0 56 Q10 66 22 56 Q36 64 46 52 Q64 56 66 28 Q34 40 0 32 Q-34 40 -66 28 Z';
const WMUSTB = 'M-66 28 L-70 50 L-52 46 L-48 64 L-32 52 L-22 68 L-10 54 L0 70 L10 54 L22 68 L32 52 L48 64 L52 46 L70 50 L66 28 Q34 40 0 32 Q-34 40 -66 28 Z';
const WTUSK = 'M-9 0 Q-12 44 -3 74 Q5 44 7 0 Z';
/* o: mood (bored|pleased|impressed|annoyed|wince|joy|angry), T, beat (0..1 bob), rise, flush (0..1), cards (0..1), win, look */
function walrus(x, y, s, o) {
  const T = o.T, mood = o.mood, fl = o.flush || 0;
  const base = fl ? mix(WAL, '#e0574f', fl) : WAL, shade = fl ? mix(WAL2, '#a8302b', fl) : WAL2;
  X.save(); X.translate(x, y - (o.rise || 0) + (o.beat || 0) * 3); X.scale(s, s);
  // tuxedo shoulders
  X.beginPath(); X.moveTo(-112, 150); X.quadraticCurveTo(-116, 58, -40, 50); X.lineTo(40, 50); X.quadraticCurveTo(116, 58, 112, 150); X.closePath(); ink(TUX, 5);
  X.fillStyle = '#3c3560'; X.beginPath(); X.moveTo(-40, 50); X.lineTo(-70, 150); X.lineTo(-58, 150); X.lineTo(-26, 56); X.fill(); X.beginPath(); X.moveTo(40, 50); X.lineTo(70, 150); X.lineTo(58, 150); X.lineTo(26, 56); X.fill();
  X.beginPath(); X.moveTo(-28, 52); X.lineTo(0, 120); X.lineTo(28, 52); X.closePath(); ink('#fff', 3);
  X.save(); X.translate(0, 70); X.beginPath(); X.moveTo(0, 0); X.lineTo(-24, -12); X.lineTo(-24, 12); X.closePath(); X.moveTo(0, 0); X.lineTo(24, -12); X.lineTo(24, 12); X.closePath(); ink('#e8434f', 3); X.beginPath(); X.arc(0, 0, 6, 0, TAU); ink('#e8434f', 3); X.restore();
  // head
  const hp = P(WHEAD); cel(hp, base, shade, 12, 10, 5); glint(hp, -30, -64, 26, 9, fl ? mix(WAL3, '#ff9a8a', fl) : WAL3, -.2);
  // blush
  if (mood === 'pleased' || mood === 'joy' || mood === 'impressed') { X.fillStyle = 'rgba(255,110,150,.55)'; el(-58, 4, 14, 8); X.fill(); el(58, 4, 14, 8); X.fill(); }
  // muzzle pads, nose, freckles
  for (const sx of [-1, 1]) { el(sx * 27, 26, 34, 26); ink(PAD, 4); }
  for (const sx of [-1, 1]) { X.fillStyle = 'rgba(120,70,50,.55)'; for (const [a, b] of [[16, 20], [30, 16], [40, 28], [24, 32], [44, 40]]) { el(sx * a, b, 2, 2); X.fill(); } }
  el(0, 6, 17, 11); ink('#5b3a36', 3); X.fillStyle = 'rgba(255,255,255,.45)'; el(-5, 2, 6, 3, -.2); X.fill();
  // tusks + mustache
  for (const sx of [-1, 1]) { X.save(); X.translate(sx * 20, 46); X.scale(sx, 1); inkP(P(WTUSK), '#fffbea', 3); X.fillStyle = 'rgba(200,190,160,.6)'; X.fillRect(1, 8, 3, 40); X.restore(); }
  const bristle = mood === 'wince' || mood === 'angry';
  inkP(P(bristle ? WMUSTB : WMUST), '#f6efe0', 3.5);
  X.strokeStyle = 'rgba(160,140,110,.6)'; X.lineWidth = 2; for (const q of [-40, -20, 20, 40]) { X.beginPath(); X.moveTo(q, 42); X.lineTo(q * 1.05, 52); X.stroke(); }
  if (mood === 'joy' || mood === 'pleased') {    // a smile peeks out under the mustache
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-14, 60); X.quadraticCurveTo(0, 70, 14, 60); X.stroke();
  } else if (mood === 'angry' || mood === 'annoyed') {
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-14, 66); X.quadraticCurveTo(0, 58, 14, 66); X.stroke();
  }
  // eyes + brows
  const lk = o.look || 0;
  for (const sx of [-1, 1]) {
    const ex = sx * 30, ey = -22;
    X.strokeStyle = INK; X.lineCap = 'round';
    if (mood === 'joy' || mood === 'pleased') { X.lineWidth = 5; X.beginPath(); X.moveTo(ex - 10, ey + 4); X.quadraticCurveTo(ex, ey - 9, ex + 10, ey + 4); X.stroke(); }
    else if (mood === 'wince') { X.lineWidth = 5; X.beginPath(); X.moveTo(ex - sx * 10, ey - 8); X.lineTo(ex + sx * 4, ey); X.lineTo(ex - sx * 10, ey + 8); X.stroke(); }
    else {
      const big = mood === 'impressed' ? 15 : 12; el(ex, ey, big, big + 2); ink('#fff', 3);
      const pr = mood === 'impressed' ? 6 : 5; X.fillStyle = INK; el(ex + lk * 4, ey + 2, pr, pr + 1); X.fill(); X.fillStyle = '#fff'; el(ex + lk * 4 - 2, ey - 1, 1.8, 1.8); X.fill();
      if (mood === 'bored' || mood === 'annoyed' || mood === 'angry') { X.save(); el(ex, ey, big - 1, big + 1); X.clip(); X.fillStyle = base; X.fillRect(ex - 20, ey - 20, 40, mood === 'bored' ? 19 : 14); X.restore(); X.lineWidth = 3.5; X.beginPath(); X.moveTo(ex - big, ey - (mood === 'bored' ? 1 : 6)); X.lineTo(ex + big, ey - (mood === 'bored' ? 1 : 6)); X.stroke(); }
    }
    // brows
    X.lineWidth = 7; X.beginPath();
    if (mood === 'impressed') { X.moveTo(ex - 14, ey - 26); X.quadraticCurveTo(ex, ey - 38, ex + 14, ey - 26); }
    else if (mood === 'angry' || mood === 'annoyed' || mood === 'wince') { X.moveTo(ex - sx * 16, ey - 26); X.lineTo(ex + sx * 12, ey - 16); }
    else if (mood === 'bored') { X.moveTo(ex - sx * 16, ey - 20); X.lineTo(ex + sx * 12, ey - 16); }
    else { X.moveTo(ex - 14, ey - 22); X.quadraticCurveTo(ex, ey - 30, ex + 14, ey - 22); }
    X.stroke();
  }
  // tears of joy
  if (mood === 'joy') for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) { const k = (T * 1.6 + i * .5) % 1; X.globalAlpha = 1 - k * .6; el(sx * (34 + k * 26), -10 + k * 60, 5, 7); ink('#7fd8ff', 2); X.globalAlpha = 1; }
  // monocle (pops off and dangles when impressed)
  const mon = mood === 'impressed' || mood === 'wince' ? 1 : 0, mx = 30, my = mon ? 34 + Math.sin(T * 9) * 4 : -22, mxx = mon ? 46 + Math.sin(T * 6) * 8 : mx;
  X.strokeStyle = GOLD2; X.lineWidth = 2; X.beginPath(); X.moveTo(mxx + 14, my + 6); X.quadraticCurveTo(84, 30, 76, 66); X.stroke();
  X.beginPath(); X.arc(mxx, my, 17, 0, TAU); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4.5; X.strokeStyle = GOLD; X.stroke();
  X.fillStyle = 'rgba(200,240,255,.25)'; X.fill(); X.fillStyle = 'rgba(255,255,255,.7)'; el(mxx - 6, my - 7, 5, 2.5, -.6); X.fill();
  // steam when angry
  if (mood === 'angry') for (let i = 0; i < 3; i++) { const k = (T * 1.4 + i / 3) % 1; X.globalAlpha = 1 - k; X.beginPath(); X.arc((i - 1) * 50, -96 - k * 60, 10 + k * 10, 0, TAU); ink('rgba(255,255,255,.9)', 2); X.globalAlpha = 1; }
  // top hat (hops up when shocked)
  const hop = mood === 'impressed' ? -14 : mood === 'angry' ? -10 - Math.abs(Math.sin(T * 20)) * 8 : 0;
  X.save(); X.translate(-8, -74 + hop); X.rotate(-.13);
  rr(-36, -76, 72, 76, 8); ink(TUX, 4); X.fillStyle = '#3c3560'; X.fillRect(-30, -72, 10, 66);
  X.fillStyle = '#e8434f'; X.fillRect(-36, -22, 72, 13); X.strokeStyle = INK; X.lineWidth = 3; X.strokeRect(-36, -22, 72, 13);
  el(0, 0, 62, 10); ink(TUX, 4);
  if (o.dove) {                                         // a hidden extra: a pigeon lives on the hat
    X.save(); X.translate(16, -78 + Math.abs(Math.sin(T * 3)) * -2);
    el(0, 0, 16, 11); ink('#d8d4e6', 3); X.beginPath(); X.arc(12, -10, 8, 0, TAU); ink('#d8d4e6', 3);
    X.beginPath(); X.moveTo(19, -10); X.lineTo(27, -8); X.lineTo(19, -6); ink('#ffb03b', 1.5); X.fillStyle = INK; el(14, -12, 1.8, 2); X.fill();
    X.fillStyle = '#a9a3c4'; el(-4, 0, 9, 5, -.3); X.fill(); X.restore();
  }
  X.restore();
  X.restore();
}
/* flippers resting on the box rail, or raised (scorecards), or over the ears (wince); drawn after the rail */
function flippers(x, y, s, o) {
  const T = o.T, up = o.cards || 0, ears = o.ears || 0;
  X.save(); X.translate(x, y + (o.beat || 0) * 3); X.scale(s, s);
  for (const sx of [-1, 1]) {
    let fx = sx * 74, fy = 112, rot = sx * .5;
    if (ears > 0) { fx = lerp(fx, sx * 84, ears); fy = lerp(fy, -14, ears); rot = lerp(rot, sx * -.3, ears); }
    if (up > 0) { fx = lerp(fx, sx * 92, up); fy = lerp(fy, -30, up); rot = lerp(rot, sx * .15, up); }
    if (ears > .05 || up > .05) {                     // a tuxedo sleeve from the shoulder to the raised flipper
      X.lineCap = 'round'; X.beginPath(); X.moveTo(sx * 84, 120); X.quadraticCurveTo(sx * 112, 60, fx, fy + 18);
      X.lineWidth = 34; X.strokeStyle = INK; X.stroke(); X.lineWidth = 24; X.strokeStyle = TUX; X.stroke();
      X.beginPath(); X.arc(fx, fy + 18, 13, 0, TAU); ink('#fff', 3);
    }
    if (up > 0) {                                     // a scorecard on a stick
      X.save(); X.translate(fx, fy - 10); X.rotate(rot + Math.sin(T * 8 + sx) * .06);
      X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(0, 10); X.lineTo(0, -40); X.stroke(); X.strokeStyle = '#d9a46a'; X.lineWidth = 3.5; X.stroke();
      rr(-34, -98, 68, 62, 8); ink(o.win ? '#fff' : '#ff6b6b', 4);
      txt(o.win ? '10' : '0', 0, -64, 40, INK, 'center', 60);
      X.restore();
    }
    X.save(); X.translate(fx, fy); X.rotate(rot); el(0, 0, 20, 30); ink(WAL2, 4); X.fillStyle = 'rgba(255,255,255,.18)'; el(-5, -10, 6, 12); X.fill();
    X.strokeStyle = INK; X.lineWidth = 3; for (const q of [-8, 0, 8]) { X.beginPath(); X.moveTo(q, 20); X.lineTo(q, 28); X.stroke(); }
    X.restore();
  }
  X.restore();
}

/* ───────────── the static scene, painted once into offscreen canvases ───────────── */
let BG = null, RAIL = null;
const STARS = [[64, 120, 13], [210, 182, 9], [586, 104, 14], [700, 150, 9], [236, 92, 8], [560, 182, 8]];
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  // the painted night backdrop
  let g = X.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, '#1d1446'); g.addColorStop(.6, '#3b2777'); g.addColorStop(1, '#5a3a8e'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  X.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 9; i++) X.fillRect(i * 96 + 30, 0, 44, 450);
  // cardboard hills on the backdrop
  X.fillStyle = '#2e2266'; X.beginPath(); X.moveTo(0, 450); for (let x = 0; x <= W; x += 20) X.lineTo(x, 392 - Math.sin(x * .012 + 1) * 26); X.lineTo(W, 450); X.fill();
  X.strokeStyle = '#4b3a92'; X.lineWidth = 3; X.beginPath(); for (let x = 0; x <= W; x += 20) X.lineTo(x, 392 - Math.sin(x * .012 + 1) * 26); X.stroke();
  // a cactus cut-out (mariachi night)
  const cactus = (x, y, s) => { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(-10, 0); X.lineTo(-10, -70); X.arc(0, -70, 10, Math.PI, 0); X.lineTo(10, 0); X.closePath(); ink('#2f8f5a', 3); rr(-30, -50, 12, 30, 6); ink('#2f8f5a', 3); rr(-30, -28, 26, 10, 5); ink('#2f8f5a', 3); rr(18, -60, 12, 30, 6); ink('#2f8f5a', 3); rr(4, -38, 26, 10, 5); ink('#2f8f5a', 3); X.restore(); };
  cactus(400, 428, .8);
  // stage floor (planks in perspective) + the apron with footlight sockets
  g = X.createLinearGradient(0, 440, 0, 540); g.addColorStop(0, '#b77438'); g.addColorStop(1, '#d99a58'); X.fillStyle = g; X.fillRect(0, 440, W, 100);
  X.strokeStyle = '#8f5226'; X.lineWidth = 2.5; for (let x0 = -400; x0 <= 1200; x0 += 70) { X.beginPath(); X.moveTo(x0, 540); X.lineTo(400 + (x0 - 400) * .72, 440); X.stroke(); }
  X.strokeStyle = 'rgba(143,82,38,.6)'; for (const y of [462, 490]) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 440); X.lineTo(W, 440); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(0, 444, W, 6);
  rr(-10, 536, W + 20, 30, 4); ink('#6d3b1e', 4); X.fillStyle = '#84502b'; X.fillRect(-10, 540, W + 20, 6);
  // the audience pit
  X.fillStyle = '#140f24'; X.fillRect(0, 566, W, 40);
  // curtains: the scalloped valance on top + the side drapes
  for (const sx of [0, 1]) {
    X.save(); if (sx) { X.translate(W, 0); X.scale(-1, 1); }
    X.beginPath(); X.moveTo(-10, -10); X.lineTo(44, -10); X.bezierCurveTo(30, 160, 52, 360, 30, 560); X.lineTo(-10, 560); X.closePath(); ink(VEL, 4);
    X.fillStyle = VEL2; for (const fx of [6, 22]) { X.beginPath(); X.moveTo(fx, 0); X.bezierCurveTo(fx - 6, 160, fx + 8, 360, fx - 2, 556); X.lineTo(fx + 6, 556); X.bezierCurveTo(fx + 14, 360, fx, 160, fx + 7, 0); X.fill(); }
    X.restore();
  }
  for (let i = -1; i < 11; i++) { X.beginPath(); X.moveTo(i * 84, -10); X.lineTo(i * 84 + 84, -10); X.lineTo(i * 84 + 84, 30); X.quadraticCurveTo(i * 84 + 42, 70, i * 84, 30); X.closePath(); ink(VEL, 4); X.fillStyle = VEL2; X.fillRect(i * 84 + 38, -10, 8, 40); }
  X.strokeStyle = GOLD; X.lineWidth = 4; for (let i = -1; i < 11; i++) { X.beginPath(); X.moveTo(i * 84 + 4, 34); X.quadraticCurveTo(i * 84 + 42, 66, i * 84 + 80, 34); X.stroke(); }
  // the critic's box: back wall, swag drapes
  rr(584, 166, 240, 240, 10); ink('#5a1630', 4); X.fillStyle = '#6e1d3a'; for (let x = 596; x < 820; x += 24) X.fillRect(x, 170, 10, 232);
  X.beginPath(); X.moveTo(580, 160); X.quadraticCurveTo(690, 232, 806, 160); X.lineTo(806, 150); X.lineTo(580, 150); X.closePath(); ink(VEL, 4);
  X.strokeStyle = GOLD; X.lineWidth = 4; X.beginPath(); X.moveTo(584, 168); X.quadraticCurveTo(690, 236, 802, 168); X.stroke();
  // the applause meter: a wooden cabinet with a dial
  rr(24, 196, 202, 208, 18); ink(WOOD2, 4); rr(24, 192, 202, 206, 18); ink(WOOD, 0); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  X.fillStyle = 'rgba(255,255,255,.22)'; rr(34, 198, 182, 8, 4); X.fill();
  X.beginPath(); X.arc(MX, MY, MR + 10, Math.PI, 0); X.lineTo(MX + MR + 10, MY + 12); X.lineTo(MX - MR - 10, MY + 12); X.closePath(); ink('#fff4dc', 4);
  const zone = (a0, a1, c) => { X.beginPath(); X.arc(MX, MY, MR - 8, Math.PI + a0 * Math.PI, Math.PI + a1 * Math.PI); X.lineWidth = 15; X.strokeStyle = c; X.lineCap = 'butt'; X.stroke(); };
  zone(0, .38, '#ff6b6b'); zone(.38, .8, '#ffd23f'); zone(.8, 1, '#5CFF7A');
  X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.arc(MX, MY, MR - 16, Math.PI, 0); X.stroke(); X.beginPath(); X.arc(MX, MY, MR, Math.PI, 0); X.stroke();
  for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI, r0 = MR - (i % 5 ? 6 : 12); X.lineWidth = i % 5 ? 2 : 3.5; X.beginPath(); X.moveTo(MX + Math.cos(a) * r0, MY + Math.sin(a) * r0); X.lineTo(MX + Math.cos(a) * (MR + 4), MY + Math.sin(a) * (MR + 4)); X.stroke(); }
  rr(54, 352, 142, 40, 12); ink('#2b2547', 3.5);
  // tiny frowny / smiley faces at the dial ends
  const face = (x, y, happy) => { X.beginPath(); X.arc(x, y, 9, 0, TAU); ink(happy ? '#5CFF7A' : '#ff6b6b', 2.5); X.fillStyle = INK; el(x - 3, y - 2, 1.5, 2); X.fill(); el(x + 3, y - 2, 1.5, 2); X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); if (happy) X.arc(x, y + 1, 4, .2, Math.PI - .2); else X.arc(x, y + 7, 4, Math.PI + .3, -.3); X.stroke(); };
  face(MX - MR - 2, MY + 26, false); face(MX + MR + 2, MY + 26, true);
  X = old; return cv2;
}
function buildRail() {                                   // the front of the critic's box (drawn over the walrus)
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  X.beginPath(); X.moveTo(576, 404); X.quadraticCurveTo(690, 388, 812, 404); X.lineTo(812, 466); X.quadraticCurveTo(690, 482, 576, 466); X.closePath(); ink(VEL, 4);
  X.save(); X.clip(); X.fillStyle = VEL2; for (let x = 590; x < 812; x += 30) X.fillRect(x, 400, 8, 80); X.restore();
  X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.moveTo(572, 402); X.quadraticCurveTo(690, 384, 814, 402); X.stroke(); X.lineWidth = 5; X.strokeStyle = GOLD; X.stroke();
  X.lineWidth = 3; X.strokeStyle = GOLD; X.beginPath(); X.moveTo(580, 458); X.quadraticCurveTo(690, 474, 810, 458); X.stroke();
  X.beginPath(); X.arc(690, 432, 17, 0, TAU); ink(GOLD, 3); X.fillStyle = GOLD2; X.beginPath(); X.arc(690, 432, 8, 0, TAU); X.fill();
  X = old; return cv2;
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;

/* ═════════ the game ═════════ */
function duBeat(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), me0 = D.role, TS = Math.sqrt(sp);
  const E = .25 / TS, T0 = 1.25 / TS, VY = 232 * TS;
  /* the song: 4 phrases of 8 eighths, a leader sings 3 notes and the other voice answers once; then a two-voice chord.
     Same-lane notes are never closer than 2 eighths. 9 notes per voice; perfect = 2 claps, so one voice alone tops out at 18 */
  const PATS = [[0, 2, 4], [0, 2, 5], [0, 3, 5], [1, 3, 5], [1, 3, 5]];
  const first = R() < .5 ? 0 : 1, pick = [0, 1, 2, 3].map(() => PATS[Math.floor(R() * PATS.length)]);
  const raw = [];
  for (let k = 0; k < 4; k++) {
    const lead = (first + k) % 2, nx = k < 3 ? pick[k + 1][0] : 0;
    for (const e of pick[k]) raw.push({ lane: lead, e: k * 8 + e });
    raw.push({ lane: 1 - lead, e: k * 8 + (nx === 0 ? 6 : 7) });
  }
  raw.push({ lane: 0, e: 32, chord: true }, { lane: 1, e: 32, chord: true });
  raw.sort((a, b) => a.e - b.e || a.lane - b.lane);
  const notes = raw.map((r, i) => ({ i, lane: r.lane, e: r.e, t: T0 + r.e * E, chord: !!r.chord, p: SCALE[Math.floor(R() * SCALE.length)] + (r.lane ? 0 : -12), g: null, at: -1, off: 0, fx: false, rx: -1 }));
  const dove = R() < .125;
  const N = notes.length, NEED = 19, LAST = notes[N - 1].t, ENDT = LAST + GOOD + .06, GRACE = .8;
  const BEATS = []; for (let k = -2; k <= 16; k++) BEATS.push(T0 + k * 2 * E);
  const mine = notes.filter(n => n.lane === me0);

  let mySour = 0, pSour = 0, shownSour = [0, 0], tapAt = -9, resAt = -1, beatN = -99, ending = null;
  const singAt = [-9, -9], sourAt = [-9, -9], bonkAt = [-9, -9], lastG = [null, null];
  const bits = [], pops = [], drops = [], flies = [], splats = [[], []], roses = [];
  let evT = -9, evK = '', needle = 0, showScore = 0, booed = false, cheered = false, yanked = false;
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const laneCol = l => l === me0 ? myCol() : pCol();
  const pts = v => v === 2 ? 2 : v === 1 ? 1 : 0;
  const score = () => { let s = 0; for (const n of notes) if (n.g !== null) s += pts(n.g); return s - mySour - pSour; };          // what the judge decides from
  const shown = () => { let s = 0; for (const n of notes) if (n.fx && n.g !== null) s += pts(n.g); return s - shownSour[0] - shownSour[1]; };   // what the meter shows

  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .8, gr: 900, rot: 0, vr: 0 }, o)); }
  function pop(l, s, size, bgc, fg, sub) { for (let i = pops.length - 1; i >= 0; i--) if (pops[i].l === l) pops.splice(i, 1); pops.push({ l, s, size, bgc, fg, sub, t0: g.c, rot: (cr() - .5) * .16 }); }
  function hitFx(n) {                               // a verdict is shown: the note pops at the ring, or drops on the sombrero
    n.fx = true; const l = n.lane, x = LX[l], f = NOTEHZ(n.p), mineL = l === me0;
    evT = g.c; evK = n.g === 2 ? 'perfect' : n.g === 1 ? 'good' : 'miss'; lastG[l] = n.g;
    if (n.g) {
      singAt[l] = g.c;
      if (mineL) { snd(f, .26, 'triangle', .1); snd(f * 2, .14, 'sine', .035); } else { snd(f, .24, 'square', .035); snd(f / 2, .2, 'triangle', .05); }
      const col = laneCol(l);
      for (let i = 0; i < (n.g === 2 ? 9 : 5); i++) { const a = cr() * TAU, v = 140 + cr() * 160; bit({ k: 'dot', x: x + Math.cos(a) * 10, y: HY + Math.sin(a) * 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: 3 + cr() * 3, c: i % 2 ? '#fff' : col, life: .45 + cr() * .2, gr: 500 }); }
      bit({ k: 'sung', x: x + 8, y: SY - 5 * SU, vx: (l ? 1 : -1) * (30 + cr() * 30), vy: -120, gr: -40, life: 1.1, c: col, ph: cr() * 6 });
      if (n.g === 2) { bit({ k: 'star', x, y: HY, life: .32, gr: 0 }); ring(x, HY, '#fff', 54, .3); snd(f * 3, .06, 'sine', .03, .03); pop(l, 'PERFECT!', 19, '#ff9f1c', '#FFE14D'); }
      else pop(l, 'GOOD', 19, '#22a447', '#fff', n.off < 0 ? 'EARLY' : 'LATE');
    } else {
      const y = l === me0 ? Math.min(HAT - 10, HY + Math.max(0, g.c - n.t) * VY) : HY;
      drops.push({ l, x, y, vy: VY * .8, c: laneCol(l), id: n.i });
      pop(l, 'MISS', 18, '#6b6a8a', '#fff');
    }
  }
  function sourFx(l, k) {
    sourAt[l] = g.c; evT = g.c; evK = 'sour';
    const f = 300 + cr() * 120;
    snd(f, .3, 'sawtooth', .055, 0, f * .7); snd(f * 1.07, .3, 'sawtooth', .045, 0, f * .74); noise(.12, .04, 500, 300, 'bandpass');
    bit({ k: 'sour', x: LX[l] + 6, y: SY - 5 * SU, vx: (l ? 1 : -1) * 40, vy: -90, gr: -30, life: 1, ph: cr() * 6 });
    pop(l, 'SOUR!', 19, '#5f9a2a', '#eaff9a', k ? 'TOO EARLY' : null);
  }
  function grade(n, v, off) {                       // my own note: judged here, shown now, relayed once
    n.g = v; n.off = off; n.at = g.c; D.send('j', [n.i, v, Math.round(off * 1000)]); hitFx(n);
  }
  function beatSound(k) {                           // a tiny backing band on the game clock (count-in sticks, then kick + hat + bass)
    if (k < 0) { snd(1250, .05, 'square', .045); noise(.03, .04, 4000, 4000, 'highpass'); return; }
    snd(120, .12, 'sine', .11, 0, 48); noise(.03, .014, 7000, 7000, 'highpass', E);
    const bass = [0, 0, 5, 5, 7, 7, 5, 4][Math.floor(k / 2) % 8]; snd(NOTEHZ(bass - 24), .2, 'triangle', .05);
  }

  const g = {
    c: 0, dur: 13, pts: 0,
    cmd: 'SING!', roleLabel: me0 === 0 ? 'LEFT SINGER' : 'RIGHT SINGER',
    hint: 'TAP / CLICK / SPACE WHEN YOUR NOTE HITS THE RING - EXTRA TAPS SOUND SOUR!',
    thint: 'TAP WHEN YOUR NOTE HITS THE RING - EXTRA TAPS SOUND SOUR!',
    update(dt) {
      g.c += dt;
      if (g.c < .2 && typeof stopMusic === 'function' && typeof mus !== 'undefined' && mus.on) stopMusic();   // the song needs its own beat; the next screen restarts the music
      if (g.result && resAt < 0) resAt = g.c;
      // the backing beat
      if (!g.result && !ending) { let k = -99; for (let i = 0; i < BEATS.length; i++) if (g.c >= BEATS[i]) k = i - 2; if (k !== beatN) { beatN = k; if (k > -99) beatSound(k); } }
      // my own misses: the note slipped past the window
      if (!g.result && !ending) for (const n of mine) if (n.g === null && g.c - LAT - n.t > GOOD) grade(n, 0, GOOD);
      // the partner's verdicts show when their note reaches the ring (never before, so an early verdict never pops a note mid-air)
      for (const n of notes) {
        if (n.lane === me0 || n.fx) continue;
        if (n.g !== null && g.c >= n.at) hitFx(n);
        else if (n.g === null && g.c > n.t + GOOD + 1.2 && !g.result) { n.fx = true; n.lost = true; drops.push({ l: n.lane, x: LX[n.lane], y: HY, vy: VY * .5, c: pCol(), id: n.i }); }   // never heard back: let it drop
      }
      if (pSour > shownSour[1 - me0]) { shownSour[1 - me0] = pSour; sourFx(1 - me0, 0); }
      // cosmetic: drops, particles, flying tomatoes / roses
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.vy += 1500 * dt; d.y += d.vy * dt;
        if (d.y >= HAT) { bonkAt[d.l] = g.c; snd(560, .16, 'sine', .08, 0, 190); noise(.06, .05, 2500, 900, 'bandpass'); for (let j = 0; j < 6; j++) bit({ k: 'shard', x: d.x, y: HAT, vx: (cr() - .5) * 300, vy: -(120 + cr() * 200), r: 4 + cr() * 3, c: d.c, rot: cr() * 6, vr: (cr() - .5) * 20, life: .55 }); drops.splice(i, 1); }
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = flies.length - 1; i >= 0; i--) {
        const f = flies[i]; if (g.c - f.t0 < f.T) continue; flies.splice(i, 1);
        if (f.k === 'tom') { splats[f.l].push({ dx: f.dx, dy: f.dy, rot: cr() * 6, s: .8 + cr() * .4 }); sfx.splat(); for (let j = 0; j < 5; j++) bit({ k: 'dot', x: f.x1, y: f.y1, vx: (cr() - .5) * 260, vy: -(80 + cr() * 180), r: 3 + cr() * 3, c: '#ff3b30', life: .45, gr: 900 }); }
        else roses.push({ x: f.x1, y: f.y1, rot: f.rot });
      }
      if (pops.length && g.c - pops[0].t0 > .75) pops.shift();
      showScore = shown(); needle += (clamp(showScore / NEED, 0, 1.25) - needle) * Math.min(1, dt * 7);
      // the endings
      if (g.result === 'win' && !cheered) {
        cheered = true; [523, 659, 784, 1047].forEach((f, i) => snd(f, .2, 'triangle', .06, .05 + i * .07));
        for (let i = 0; i < 26; i++) noise(.05, .045, 1800 + cr() * 1400, 1800, 'bandpass', cr() * 1.1, 2);   // applause
        for (let i = 0; i < 8; i++) { const l = i % 2, x1 = LX[l] + (cr() - .5) * 150, y1 = 456 + cr() * 60; flies.push({ k: 'rose', x0: 40 + cr() * 720, y0: 610, x1, y1, h: 160 + cr() * 80, t0: g.c + i * .07, T: .55 + cr() * .2, rot: cr() * 6 }); }
      }
      if (g.result === 'lose' && !booed) {
        booed = true; snd(150, .7, 'sawtooth', .05, 0, 95); snd(156, .7, 'sawtooth', .04, .02, 98); noise(.7, .05, 500, 260, 'lowpass');
        for (let i = 0; i < 6; i++) { const l = i % 2; flies.push({ k: 'tom', l, x0: 60 + cr() * 680, y0: 610, x1: LX[l] + (cr() - .5) * 40, y1: SY - 5 * SU + (cr() - .5) * 26, dx: 0, dy: 0, h: 150 + cr() * 60, t0: g.c + i * .08, T: .45, rot: 0 }); const f = flies[flies.length - 1]; f.dx = f.x1 - LX[l]; f.dy = f.y1 - SY; }
      }
      if (g.result === 'lose' && !yanked && g.c - resAt > .55) { yanked = true; sfx.whoosh(false); snd(330, .3, 'square', .05, 0, 900); }
      // the verdict (judge only): every verdict in after the last note, or a grace later, or hopeless already
      if (g.judge && !g.result) {
        let open = 0; for (const n of notes) if (n.g === null) open++;
        const sc = score();
        if (!ending && sc + 2 * open < NEED) ending = { res: 'lose', at: g.c + .35 };
        else if (!ending && ((open === 0 && g.c >= ENDT) || g.c >= ENDT + GRACE)) ending = { res: sc >= NEED ? 'win' : 'lose', at: g.c + .15 };
        if (ending && g.c >= ending.at) g.finish(ending.res);
        else if (g.c >= g.limit) g.finish(ending ? ending.res : sc >= NEED ? 'win' : 'lose');
      }
    },
    msg(type, d) {
      if (type === 'j') {
        const n = notes[d[0]]; if (!n || n.lane === me0 || n.g !== null) return;
        n.g = d[1] | 0; n.off = (d[2] | 0) / 1000; n.rx = g.c; n.at = Math.max(g.c, n.t);
      } else if (type === 's') pSour = Math.max(pSour, d | 0);
    },
    tap() {
      if (g.result || ending || g.c < .25) return;
      tapAt = g.c; const tt = g.c - LAT;
      let best = null, bd = 9;
      for (const n of mine) if (n.g === null) { const d = tt - n.t; if (Math.abs(d) <= GOOD && Math.abs(d) < Math.abs(bd)) { best = n; bd = d; } }
      if (best) grade(best, Math.abs(bd) <= PERF ? 2 : 1, bd);
      else {
        mySour++; shownSour[me0] = mySour; D.send('s', mySour, true);
        const soon = mine.some(n => n.g === null && n.t - tt > 0 && n.t - tt < .4);
        sourFx(me0, soon);
      }
    },
    draw() {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) { BG = buildBg(); RAIL = buildRail(); } X = ctx;
      X.drawImage(BG, 0, 0);
      const bph = (() => { let b = -1; for (let i = 0; i < BEATS.length; i++) if (T >= BEATS[i]) b = i; return b < 0 ? 0 : clamp((T - BEATS[b]) / (2 * E), 0, 1); })();
      const thump = g.result ? 0 : Math.max(0, 1 - bph * 3.5);
      // a cardboard moon on a string + stars
      X.strokeStyle = 'rgba(255,255,255,.35)'; X.lineWidth = 2; X.beginPath(); X.moveTo(400, 0); X.lineTo(400, 84); X.stroke();
      X.save(); X.translate(400, 116); X.rotate(Math.sin(T * 1.1) * .08); X.beginPath(); X.arc(0, 0, 34, -1.9, 1.9); X.arc(14, -2, 28, 1.75, -1.75, true); X.closePath(); ink('#fff1b8', 3.5);
      X.fillStyle = INK; el(20, -8, 2.5, 3.5); X.fill(); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); if (won) X.arc(21, 4, 6, .3, 2.6); else X.arc(21, 14, 6, 3.8, 5.6); X.stroke(); X.restore();
      for (const [sx, sy, r] of STARS) { const tw = 1 + Math.sin(T * 3 + sx) * .12; X.strokeStyle = 'rgba(255,255,255,.3)'; X.lineWidth = 1.5; X.beginPath(); X.moveTo(sx, 0); X.lineTo(sx, sy - r); X.stroke(); star(sx, sy, r * tw, r * .45 * tw, 5, Math.sin(T + sx) * .2, '#ffe68a', 2.5); }
      // spotlights = the lanes
      const off = lost && rk > .3 ? clamp(1 - (rk - .3) / .4, .25, 1) : 1;
      for (let l = 0; l < 2; l++) {
        const x = LX[l], col = won ? '#ffe14d' : lost ? '#ff6b6b' : laneCol(l), hot = Math.max(0, 1 - (T - singAt[l]) / .3), mineL = l === me0;
        const gr = X.createLinearGradient(0, 0, 0, SY); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.25, rgba(col, (mineL ? .2 : .12) * off)); gr.addColorStop(1, rgba(col, (mineL ? .34 : .2) * off + hot * .2));
        X.fillStyle = gr; X.beginPath(); X.moveTo(x - 34, 0); X.lineTo(x + 34, 0); X.lineTo(x + 76, SY + 4); X.lineTo(x - 76, SY + 4); X.closePath(); X.fill();
        X.fillStyle = rgba('#ffffff', .1 * off); el(x, SY + 2, 80, 14); X.fill();
        // beat lines scroll down the lane with the notes
        if (!g.result) for (const b of BEATS) { const y = HY - (b - T) * VY; if (y < TOP || y > HY - 4) continue; const w = 30 + (y / SY) * 30; X.globalAlpha = clamp((y - TOP) / 40, 0, 1) * (mineL ? .3 : .16); X.fillStyle = '#fff'; X.fillRect(x - w, y - 1.5, w * 2, 3); X.globalAlpha = 1; }
        // the ring
        const pulse = 1 + thump * .07 + hot * .12;
        X.save(); X.translate(x, HY); X.scale(pulse, pulse);
        X.beginPath(); X.arc(0, 0, 30, 0, TAU); X.lineWidth = mineL ? 12 : 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = mineL ? 6 : 4; X.strokeStyle = hot > 0 ? '#fff' : mineL ? col : mix(col, '#3b2777', .35); X.stroke();
        X.setLineDash([5, 6]); X.strokeStyle = 'rgba(255,255,255,.45)'; X.lineWidth = 2; X.beginPath(); X.ellipse(0, 0, 16, 12, -.38, 0, TAU); X.stroke(); X.setLineDash([]);
        X.restore();
      }
      meter(T);
      // the critic in his box
      const jm = judgeMood(T, won, lost, rk), bob = !g.result && (jm === 'pleased' || jm === 'impressed') ? thump : 0;
      const rise = won && rk >= 0 ? ease(rk / .25) * 26 : 0, cards = g.result && rk >= 0 ? outBack((rk - .1) / .3) : 0, flush = lost && rk >= 0 ? clamp(rk / .3, 0, 1) : 0;
      const ears = jm === 'wince' ? clamp(1 - (T - evT - .35) / .2, 0, 1) * clamp((T - evT) / .08, 0, 1) : 0;
      walrus(JX, JY, JS, { mood: jm, T, beat: bob, rise, flush, dove, look: Math.sin(T * .9) * .6 });
      X.drawImage(RAIL, 0, 0);
      flippers(JX, JY - rise, JS, { T, cards, win: won, ears: g.result ? 0 : ears, beat: bob });
      if (dove && T - evT < .5 && evK === 'sour') { X.globalAlpha = 1 - (T - evT) * 2; for (let i = 0; i < 3; i++) { const fx = JX + 30 + i * 14, fy = JY - 150 - (T - evT) * 80 - i * 6; X.save(); X.translate(fx, fy); X.rotate(i); el(0, 0, 5, 2.5); ink('#d8d4e6', 1.5); X.restore(); } X.globalAlpha = 1; }
      // roses on the stage floor
      for (const r of roses) rose(r.x, r.y, .9, r.rot);
      // the singers
      let yank = 0; if (lost && rk > .55) yank = ease((rk - .55) / .45) * 560;
      for (let l = 0; l < 2; l++) singer(l, T, won, lost, rk, yank, thump);
      if (lost && rk > .3) { const hx = rk < .55 ? lerp(-80, LX[0] - 6, ease((rk - .3) / .25)) : LX[0] - 6 - yank; hook(hx, SY - 7 * SU); }
      // feedback badges over each ring (under the notes, so a badge never hides the next note)
      for (const q of pops) {
        const a = T - q.t0, x = LX[q.l], y = HY - 66 - Math.min(a, .4) * 30;
        X.globalAlpha = a > .55 ? Math.max(0, 1 - (a - .55) / .2) : 1;
        badge(q.s, x, y, q.size, q.bgc, q.fg, a < .18 ? outBack(a / .18) : 1, q.rot);
        if (q.sub) txt(q.sub, x, y + 26, 15, '#fff', 'center', 120);
        X.globalAlpha = 1;
      }
      // notes
      for (const n of notes) drawNote(n, T);
      for (const d of drops) note(d.x, d.y, .95, d.c, false, Math.sin(T * 30 + d.id) * .3);
      drawBits(T);
      // flying tomatoes / roses, the audience
      for (const f of flies) { const u = (T - f.t0) / f.T; if (u < 0) continue; const x = lerp(f.x0, f.x1, u), y = lerp(f.y0, f.y1, u) - f.h * 4 * u * (1 - u); if (f.k === 'tom') tomato(x, y, 11, u * 9); else rose(x, y, .8, u * 10 + f.rot); }
      audience(T, won, lost, rk, thump);
      if (won && rk >= 0) { badge('BRAVO!', 400, 140, 40, '#e8274e', '#FFE14D', rk < .25 ? outBack(rk / .25) : 1, -.06); if (rk > .5) badge('ENCORE!', 400, 210, 24, '#ff9f1c', '#fff', outBack((rk - .5) / .2), .05); }
      if (lost && rk >= 0) badge('BOOO!', 400, 140, 40, '#5f4b8b', '#ff8a8a', rk < .25 ? outBack(rk / .25) : 1, .05);
      // the name pills at the top of each spotlight
      if (!g.result) for (let l = 0; l < 2; l++) pill(LX[l], 186, l === me0 ? 'YOU' : 'YOUR FRIEND', laneCol(l), false);
      // my control (after the verdict it goes flat and grey)
      const b = PLATES[me0], done = !!(g.result || ending);
      if (done) { X.globalAlpha = .8; const o = plate(b, '#d3cfe0', '#8f88a6', true); micIcon(b[0] + 44, b[1] + 38 + o, '#f6f4fb'); txt(won ? 'BRAVO!' : lost ? 'BOOO!' : 'SING!', b[0] + 128, b[1] + 40 + o, 30, '#f6f4fb', 'center', 120); X.globalAlpha = 1; }
      else {
        const col = myCol(), o = plate(b, col, mix(col, '#14101c', .45), T - tapAt < .1);
        micIcon(b[0] + 44, b[1] + 38 + o, '#fff');
        if (TOUCH) txt('SING!', b[0] + 128, b[1] + 40 + o, 32, INK, 'center', 120);
        else { txt('SING!', b[0] + 128, b[1] + 30 + o, 28, INK, 'center', 120); keyCap(b[0] + 128, b[1] + 58 + o, 'SPACE'); }
      }
      vignette(.16);
    },
    down() { g.tap(); },
    key(e) {
      if (e.repeat || e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape' || e.code === 'Tab' || /^(Shift|Control|Alt|Meta|OS|CapsLock|Fn|F\d)/.test(e.code || '')) return;   // Cmd+Tab must not sing a sour note
      g.tap();
    },
  };
  function judgeMood(T, won, lost, rk) {
    if (won) return 'joy'; if (lost) return 'angry';
    const a = T - evT;
    if (a < .6) { if (evK === 'perfect') return 'impressed'; if (evK === 'good') return 'pleased'; if (evK === 'miss') return 'annoyed'; if (evK === 'sour') return 'wince'; }
    let judged = 0; for (const n of notes) if (n.fx && !n.lost) judged++;
    return judged >= 2 && showScore >= judged * 1.3 ? 'pleased' : 'bored';
  }
  function singer(l, T, won, lost, rk, yank, thump) {
    const col = laneCol(l), sa = T - singAt[l], so = T - sourAt[l], bo = T - bonkAt[l];
    const sing = sa < .32 ? Math.sin(Math.min(1, sa / .32) * Math.PI) : 0, sour = so < .5 ? 1 - so / .5 : 0, dizzy = bo < .7;
    let x = LX[l] - (l === 0 ? yank : yank * .97 + (yank > 0 ? Math.max(0, 1 - yank / 60) * 0 : 0)), y = SY;
    const hop = won ? Math.abs(Math.sin(T * 9 + l)) * 16 : sing * 6, bow = won && rk > .5 ? Math.sin(clamp((rk - .5) / .4, 0, 1) * Math.PI) * .35 : 0;
    const lean = lost && rk > .55 ? -.35 : 0, sway = g.result ? 0 : Math.sin(T * Math.PI / (2 * E) * .5 + l * Math.PI) * .03;
    X.save(); X.translate(x, y - hop); X.rotate(sway + lean + (l ? -bow : bow) * 0); X.scale(1 + thump * .03 + sing * .04, 1 - thump * .03 - sing * .04 + bow * -.2);
    shadow(0, hop + 2, 46, 8, .3);
    // arms with maracas: shake on the beat, wave on a hit, up in the air on a win
    const u = SU, shake2 = Math.sin(T * 28) * .25 * (sing + (won ? 1 : 0)), la = won ? -.5 + shake2 : -.95 + thump * .25 + shake2, ra = won ? .5 - shake2 : .95 - thump * .25 - shake2;
    for (const [sx, an] of [[-1, la], [1, ra]]) {
      X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
      const L = 3.2 * u, aw = 1.2 * u; X.fillStyle = INK; X.fillRect(-aw / 2 - 3, -L - 3, aw + 6, L + 6); X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L);
      maraca(0, -L - 2, sx * .2, l ? '#5CFF7A' : '#ff6b9e'); X.restore();
    }
    caos(0, 0, u, { col, mood: won ? 'happy' : dizzy || lost ? 'sad' : null });
    // mustache (left singer) + mouth
    const my = -3.4 * u;
    if (sour > 0) { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); for (let i = 0; i <= 6; i++) X.lineTo(-12 + i * 4, my + 3 + (i % 2 ? -3 : 3)); X.stroke(); X.fillStyle = 'rgba(140,220,90,.55)'; el(0, -6 * u, 6 * u, 2.6 * u); X.fill(); }
    else if (sing > 0 || won) { const op = won ? .8 + Math.sin(T * 12) * .2 : sing; el(0, my + 2, 8, 3 + op * 8); ink('#7a1838', 3); X.fillStyle = '#ff7a9a'; el(0, my + 4 + op * 4, 5, 2 + op * 2); X.fill(); }
    else if (lost) { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.arc(0, my + 10, 8, Math.PI + .5, -.5); X.stroke(); }
    else { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-8, my); X.quadraticCurveTo(0, my + 5, 8, my); X.stroke(); }
    if (l === 0) { X.save(); X.translate(0, my - 5); X.beginPath(); X.moveTo(0, 0); X.bezierCurveTo(-8, -4, -18, -2, -22, 6); X.bezierCurveTo(-14, 2, -8, 4, 0, 3); X.bezierCurveTo(8, 4, 14, 2, 22, 6); X.bezierCurveTo(18, -2, 8, -4, 0, 0); X.closePath(); ink('#3b2a22', 2); X.restore(); }
    for (const s of splats[l]) splat(s.dx, s.dy, s.s, s.rot);
    // the sombrero (knocked crooked by a missed note)
    const tilt = dizzy ? Math.sin(bo * 26) * .25 * (1 - bo / .7) : sing * Math.sin(T * 30) * .05;
    sombrero(0, -9 * u - 2 - (dizzy ? Math.max(0, .2 - bo) * 40 : 0) - (won && rk > .5 ? bow * 30 : 0), .82, l ? '#2ec27e' : '#e8434f', tilt + (lost && rk > .55 ? -.4 : 0));
    if (dizzy) for (let i = 0; i < 3; i++) { const a = T * 8 + i * TAU / 3; star(Math.cos(a) * 34, -13 * u + Math.sin(a) * 8, 7, 3, 5, a, '#FFE14D', 2); }
    if (sour > 0) for (let i = 0; i < 2; i++) { const k = ((T * 1.5 + i * .5) % 1); X.globalAlpha = sour * Math.sin(k * Math.PI); X.strokeStyle = '#8fd14f'; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); for (let j = 0; j <= 5; j++) X.lineTo((i ? 30 : -30) + Math.sin(j + T * 8) * 4, -6 * u - k * 30 - j * 5); X.stroke(); X.globalAlpha = 1; }
    X.restore();
  }
  function drawNote(n, T) {
    if (n.fx || g.result) return;
    const mineL = n.lane === me0, x = LX[n.lane];
    let y = HY - (n.t - T) * VY, pend = false, rot = 0;
    if (y < TOP - 30) return;
    if (!mineL && y > HY) { y = HY; pend = true; rot = Math.sin(T * 18 + n.i) * .12; }    // waiting at the ring for the partner's verdict
    if (mineL && n.g !== null) return;
    const a = clamp((y - TOP + 20) / 40, 0, 1);
    X.globalAlpha = a * (mineL ? 1 : .62);
    const s = (mineL ? 1.08 : .9) * (pend ? 1 + Math.sin(T * 9) * .04 : 1);
    if (n.chord) {                                      // the final chord: both notes wear a little crown
      star(x, y - 66 * s, 10, 4.5, 5, T * 2, '#FFE14D', 2.5);
    }
    note(x, y, s, laneCol(n.lane), false, rot);
    X.globalAlpha = 1;
    if (pend) for (let i = 0; i < 3; i++) { const by = Math.abs(Math.sin(T * 8 + i * .7)) * 5; X.beginPath(); X.arc(x + 34 + i * 10, HY - 24 - by, 3.6, 0, TAU); ink('#fff', 2); }
  }
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0; if (a < 0) continue; const fade = a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1; X.globalAlpha = clamp(fade, 0, 1);
      if (b.k === 'dot') { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2); }
      else if (b.k === 'star') { const k = a / b.life; star(b.x, b.y, 44 * outBack(k * 2), 18 * outBack(k * 2), 8, .2, '#fff6b0', 3); }
      else if (b.k === 'sung') note(b.x + Math.sin(a * 9 + b.ph) * 10, b.y, .55, b.c, false, Math.sin(a * 6 + b.ph) * .3);
      else if (b.k === 'sour') note(b.x + Math.sin(a * 13 + b.ph) * 6, b.y, .6, '#9ad46a', true, Math.sin(a * 9) * .4);
      else if (b.k === 'shard') { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); X.beginPath(); X.moveTo(0, -b.r); X.lineTo(b.r, b.r * .7); X.lineTo(-b.r, b.r * .5); X.closePath(); ink(b.c, 2); X.restore(); }
    }
    X.globalAlpha = 1;
  }
  function meter(T) {
    txt('APPLAUSE', MX, 220, 22, GOLD, 'center', 180);
    const k = needle + (g.result ? 0 : Math.sin(T * 30) * .006), a = Math.PI + clamp(k / 1.25, 0, 1) * Math.PI;
    const ga = Math.PI + .8 * Math.PI; star(MX + Math.cos(ga) * (MR + 14), MY + Math.sin(ga) * (MR + 14), 9, 4, 5, T, '#FFE14D', 2.5);
    X.save(); X.translate(MX, MY); X.rotate(a);
    X.beginPath(); X.moveTo(-6, -4); X.lineTo(MR - 6, 0); X.lineTo(-6, 4); X.closePath(); ink('#e8434f', 2.5); X.restore();
    X.beginPath(); X.arc(MX, MY, 9, 0, TAU); ink(GOLD, 3);
    const v = Math.max(0, showScore), full = v >= NEED;
    txt(`${v} / ${NEED}`, MX, 374, 26, full ? '#5CFF7A' : '#FFE14D', 'center', 130);
  }
  function micIcon(x, y, col) {
    X.save(); X.translate(x, y); X.rotate(-.35);
    rr(-5, 4, 10, 26, 4); ink('#5b5674', 3); el(0, -6, 13, 15); ink(col, 3.5);
    X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 2; for (const q of [-8, -2, 4]) { X.beginPath(); X.moveTo(-10, q - 6); X.lineTo(10, q - 6); X.stroke(); }
    X.restore();
    X.save(); X.translate(x + 22, y - 18); note(0, 0, .38, col, false, .2); X.restore();
  }
  function audience(T, won, lost, rk, thump) {
    const HEADS = [[-6, 30], [70, 26], [148, 32], [232, 28], [318, 30], [404, 27], [488, 31], [568, 28], [650, 32], [734, 27], [808, 30]];
    HEADS.forEach(([x, r], i) => {
      const cheer = won ? Math.abs(Math.sin(T * 10 + i)) * 12 : 0, bounce = thump * (i % 2 ? 3 : 2) + cheer;
      const y = 594 - bounce;
      if (won || (lost && rk >= 0)) {                   // arms up (cheering), or shaking fists
        X.strokeStyle = '#1d1533'; X.lineWidth = 9; X.lineCap = 'round';
        for (const sx of [-1, 1]) { const wv = Math.sin(T * (lost ? 18 : 12) + i + sx) * (lost ? 4 : 8); X.beginPath(); X.moveTo(x + sx * r * .6, y + 10); X.lineTo(x + sx * (r + 6) + wv, y - r - 18); X.stroke(); }
      }
      X.beginPath(); X.arc(x, y, r, Math.PI, 0); X.lineTo(x + r, 610); X.lineTo(x - r, 610); X.closePath(); X.fillStyle = '#1d1533'; X.fill();
      X.strokeStyle = 'rgba(160,130,230,.45)'; X.lineWidth = 3; X.beginPath(); X.arc(x, y, r - 2, Math.PI * 1.15, Math.PI * 1.6); X.stroke();
    });
  }
  g.dbg = {
    notes, NEED, lane: me0,
    incoming: () => mine.filter(n => n.g === null).map(n => ({ i: n.i, left: n.t - g.c })).sort((a, b) => a.left - b.left),   // my notes as I see them: time until each reaches the ring
    score, shown: () => showScore, sours: () => mySour,
  };
  wire(g, D, 0, sp, 'du_beat');
  return g;
}
reg('du_beat', duBeat, 'DUET'); REGMAP.du_beat.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 2 s loop ───────────── */
let DBG = null;
function buildDemoBg() {
  const c2 = document.createElement('canvas'); c2.width = 520; c2.height = 240; const old = X; X = c2.getContext('2d');
  const gr = X.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, '#1d1446'); gr.addColorStop(1, '#5a3a8e'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#b77438'; X.fillRect(0, 196, 520, 44); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 196); X.lineTo(520, 196); X.stroke();
  X.strokeStyle = '#8f5226'; X.lineWidth = 2; for (let x0 = -200; x0 <= 720; x0 += 50) { X.beginPath(); X.moveTo(x0, 240); X.lineTo(260 + (x0 - 260) * .7, 196); X.stroke(); }
  for (const sx of [0, 1]) { X.save(); if (sx) { X.translate(520, 0); X.scale(-1, 1); } X.beginPath(); X.moveTo(-6, -6); X.lineTo(30, -6); X.bezierCurveTo(20, 80, 34, 160, 20, 246); X.lineTo(-6, 246); X.closePath(); ink(VEL, 3); X.restore(); }
  X = old; return c2;
}
const DLX = [190, 330], DHY = 132;
function demo(role, tt) {
  X = ctx; if (!DBG) DBG = buildDemoBg(); X.drawImage(DBG, 0, 0);
  const u = tt % 2, cols = ['#FFC93C', '#6EA8FE'], my = role, VYd = 150;
  const hits = [[.45, 1.25], [.85, 1.65]], mineH = hits[0], theirH = hits[1];       // my notes hit at .45 and 1.25, the friend's at .85 and 1.65
  for (let l = 0; l < 2; l++) {
    const x = DLX[l], mineL = l === my, col = cols[l];
    const gr = X.createLinearGradient(0, 0, 0, 210); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, mineL ? .38 : .18));
    X.fillStyle = gr; X.beginPath(); X.moveTo(x - 20, 0); X.lineTo(x + 20, 0); X.lineTo(x + 50, 210); X.lineTo(x - 50, 210); X.closePath(); X.fill();
    const H2 = mineL ? mineH : theirH, hot = H2.some(h => u >= h && u - h < .25);
    X.beginPath(); X.arc(x, DHY, 20, 0, TAU); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4.5; X.strokeStyle = hot ? '#fff' : col; X.stroke();
    for (const h of H2) { const y = DHY - (h - u) * VYd; if (u < h && y > -20) { X.globalAlpha = mineL ? 1 : .6; note(x, y, mineL ? .72 : .62, col, false, 0); X.globalAlpha = 1; } }
    // the singer
    const sing = H2.some(h => u >= h && u - h < .3);
    X.save(); X.translate(x, 214 - (sing ? 4 : 0)); caos(0, 0, 3, { col, mood: sing ? 'happy' : null }); sombrero(0, -29, .48, l ? '#2ec27e' : '#e8434f', 0);
    if (sing) { el(0, -9, 5, 6); ink('#7a1838', 2); }
    X.restore();
    const hk = H2.map(h => u - h).find(a => a >= 0 && a < .45);
    if (hk !== undefined) { X.globalAlpha = hk > .3 ? 1 - (hk - .3) / .15 : 1; badge('PERFECT!', x, DHY - 44, 15, '#ff9f1c', '#FFE14D', hk < .12 ? outBack(hk / .12) : 1, -.05); X.globalAlpha = 1; }
    if (mineL) pill(x, 18, 'YOU', col, false);
  }
  // the walrus critic peeks in from the right
  const last = [...mineH, ...theirH].map(h => u - h).filter(a => a >= 0).sort((a, b) => a - b)[0];
  walrus(468, 112, .38, { mood: last !== undefined && last < .5 ? 'impressed' : 'bored', T: tt, look: -1 });
  // the finger taps exactly as my note meets the ring
  const tapK = mineH.map(h => u - h + .06).find(a => a >= 0 && a < .2);
  demoFinger(66, 176, tapK !== undefined, tapK !== undefined ? tapK / .2 : 0);
}
DUO.INFO.du_beat = [['LEFT SINGER', 'SING YOUR NOTES ON THE BEAT', 'TAP AS YOUR NOTE HITS THE RING'], ['RIGHT SINGER', 'SING YOUR NOTES ON THE BEAT', 'TAP AS YOUR NOTE HITS THE RING']];
DUO.DEMOS.du_beat = [t => demo(0, t), t => demo(1, t)];

})();
