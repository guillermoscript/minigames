'use strict';
/* ═════════ DUO · SQUIRT & WIPE (du_squeegee), after Twisted!'s windscreen wiper ═════════
   A bus is parked in the bus wash with a windscreen caked in absurd gunk: a slapped pie, seagull poop, mud and a glued-on cat paw
   print. Two seagull bombing runs add more gunk while you work. Gunk only comes off where the glass is WET.
   WIPER (role 0, JUDGE): rides the tip of the wiper arm and TURNS it (drag / circle the pointer round the hub, or hold A / D / arrows).
   Wiping dry glass squeaks and smears the gunk back (progress goes backwards). Every sweep also squeegees the water away.
   SPRAYER (role 1): on a ladder with a squirt bottle: aims (pointer / arrows), HOLDS to squirt washer fluid. The bucket drains while
   squirting and refills while resting; empty = it dribbles until it has refilled a bit. Its view shows how THICK each gunk is (a ring);
   it sees the wiper arm ~0.3 s late. The wiper sees no thickness: it just follows the shine of the water.
   Netcode: the SPRAYER owns the water: 'aim' [seq, x, y, on] (coalesced ≤10/s, repeated while on). The WIPER owns the arm and the gunk:
   'arm' [seq, angle×1000, vel×100] (≤10/s) and 'hp' [seq, h0..h6 ×100] (≤7/s), 'dry' i when it smears dry gunk (the sprayer's screen
   shows "WET IT!"). Both screens simulate the water on glass from the aim stream (wiper) / own aim (sprayer); only the wiper decides how
   much gunk is left, counts it and sends the verdict ('end', via wire). Sequence numbers make duplicate / reordered packets harmless. */
(function () {
const { clamp, mkR, wire, track, demoFinger, END_SLACK } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MC = new Map();
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const PX = 400, PY = 486, R0 = 64, R1 = 334;          // the wiper hub and the blade's reach
const TH0 = -2.92, TH1 = -.22;                        // the arm's range (radians; -π/2 = straight up)
const GL = [78, 140, 644, 342, 30];                   // the glass: x, y, w, h, corner radius
const CS = 20, GX0 = 70, GY0 = 136, GW = 33, GH = 18; // the water grid laid over the glass
const NZ = [112, 304];                                // where the squirt leaves the bottle
const MINX = 84, MAXX = 716, MINY = 146, MAXY = 478;  // where the aim can go
const NB = 7, GONE = .035;                            // gunk blobs / hp below which one is clean

/* palette */
const BUSY = '#ff6b57', BUSY2 = '#d9483a', BUSL = '#ffb3a3', RUBB = '#2b2b3a', GLASSC = '#bfeaf5';
const WATER = '#5fd0ff', WATER2 = '#2b9ee6', FOAM = '#eafaff';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function circ(x, y, r, fill, o = 3) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(fill, o); }
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
function bubble(s, x, y, size, sc) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(200, X.measureText(t(s)).width) + 26, h = size * 1.5;
  X.save(); X.translate(x, y); X.scale(sc, sc);
  X.beginPath(); X.moveTo(-8, -18); X.lineTo(2, 0); X.lineTo(10, -18); X.closePath(); ink('#fff', 3);
  rr(-w / 2, -18 - h, w, h, h * .45); ink('#fff', 3);
  X.fillStyle = '#fff'; X.fillRect(-6, -21, 15, 6);
  txt(s, 0, -18 - h / 2 + 2, size, INK, 'center', 200); X.restore();
}
function arm(u, sx, an, k, col) {                     // a thin blocky arm from caos()'s side stub (drawn before caos()); an = angle (0 = up), k = 0..1 raised
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
function drop(x, y, r, col) {
  X.beginPath(); X.moveTo(x, y - r * 1.7); X.quadraticCurveTo(x + r * 1.1, y - r * .2, x, y + r); X.quadraticCurveTo(x - r * 1.1, y - r * .2, x, y - r * 1.7); X.closePath();
  ink(col || WATER, 2); X.fillStyle = 'rgba(255,255,255,.75)'; el(x - r * .3, y - r * .3, r * .28, r * .4, -.4); X.fill();
}

/* ───────────── the gunk ───────────── */
/* a lumpy closed shape from seeded lobe radii (L: n values ~1) */
function lumps(x, y, r, L, rot) {
  const n = L.length, pts = L.map((l, i) => { const a = i / n * TAU + rot; return [x + Math.cos(a) * r * l, y + Math.sin(a) * r * l]; });
  X.beginPath(); X.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; X.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  X.closePath();
}
/* kinds: 0 slapped pie, 1 seagull poop, 2 mud, 3 glued-on cat paw print. b = {x, y, r, L, kind, dr (drips)}, sc = size, w = how wet (shine) */
function gunk(b, sc, w, T) {
  const x = b.x, y = b.y, r = b.r * sc, k = b.kind;
  if (k === 3) {                                       // the paw print sits in a puddle of amber glue
    lumps(x, y, r * 1.12, b.L, b.rot); ink('rgba(244,196,70,.62)', 0); X.lineWidth = 3; X.strokeStyle = 'rgba(160,110,20,.6)'; X.stroke();
    const col = '#5b3b2a', toes = [[-.62, -.12, -.5], [-.22, -.55, -.15], [.22, -.55, .15], [.62, -.12, .5]];
    el(x, y + r * .26, r * .52, r * .42); ink(col, 3);
    for (const [tx, ty, ro] of toes) { el(x + tx * r, y + ty * r, r * .2, r * .27, ro); ink(col, 3); }
    X.fillStyle = 'rgba(255,255,255,.4)'; el(x - r * .2, y + r * .12, r * .18, r * .08, -.4); X.fill(); el(x - r * .45, y - r * .3, r * .06, r * .1, -.5); X.fill();
    X.fillStyle = 'rgba(255,225,120,.9)'; el(x + r * .75, y - r * .6, r * .1, r * .06, -.5); X.fill();
  } else {
    const base = k === 0 ? '#fff0c9' : k === 1 ? '#f6f4ee' : '#7b4a26', mid = k === 0 ? '#ffd877' : k === 1 ? '#c9d6b0' : '#a26a3a', dark = k === 0 ? '#c98443' : k === 1 ? '#6f6a46' : '#4f2c14';
    for (const d of b.dr) { const len = d.l * sc * (1 + Math.sin(T * 1.4 + d.p) * .06); rr(x + d.x * r - 5, y + r * .5, 10, len + r * .4, 5); ink(base, 3); }   // drips run down the glass
    lumps(x, y, r, b.L, b.rot); ink(base, 3.5);
    X.save(); lumps(x, y, r, b.L, b.rot); X.clip();
    X.fillStyle = mid; lumps(x + r * .08, y + r * .1, r * .72, b.L, b.rot + .5); X.fill();
    X.fillStyle = dark;
    if (k === 0) { for (const [a, d, q] of b.sp) { el(x + Math.cos(a) * r * d * .55, y + Math.sin(a) * r * d * .55, q * .7, q * .45, a); X.fill(); } }
    else if (k === 1) { lumps(x + r * .05, y + r * .05, r * .26, b.L, b.rot + 1); X.fill(); for (const [a, d, q] of b.sp) { X.beginPath(); X.arc(x + Math.cos(a) * r * d * .5, y + Math.sin(a) * r * d * .5, q * .35, 0, TAU); X.fill(); } }
    else { X.lineWidth = 2.4; X.strokeStyle = dark; X.lineCap = 'round'; for (const [a, d] of b.sp) { X.beginPath(); X.moveTo(x + Math.cos(a) * r * .15, y + Math.sin(a) * r * .15); X.lineTo(x + Math.cos(a + .3) * r * d * .55, y + Math.sin(a + .3) * r * d * .55); X.lineTo(x + Math.cos(a - .1) * r * d * .85, y + Math.sin(a - .1) * r * d * .85); X.stroke(); } }
    X.fillStyle = 'rgba(255,255,255,.5)'; el(x - r * .34, y - r * .36, r * .3, r * .13, -.55); X.fill();
    X.restore();
    if (k === 0) { circ(x + r * .12, y - r * .08, r * .22, '#e8434f', 3); X.fillStyle = 'rgba(255,255,255,.8)'; el(x + r * .05, y - r * .15, r * .07, r * .05, -.5); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(x + r * .14, y - r * .3); X.quadraticCurveTo(x + r * .2, y - r * .5, x + r * .34, y - r * .52); X.stroke(); }
  }
  if (w > .15) { X.globalAlpha = Math.min(1, w) * .75; X.fillStyle = '#fff'; el(x + r * .2, y + r * .3, r * .22, r * .07, -.2); X.fill(); el(x - r * .45, y - r * .05, r * .09, r * .05, -.5); X.fill(); X.globalAlpha = 1; }
}
/* the thickness ring the SPRAYER sees: it empties as the gunk comes off */
function heat(b, hp, T) {
  const rad = b.r * (.55 + .45 * hp) + 11, col = hp > .66 ? '#ff4d5e' : hp > .33 ? '#ff9a4d' : '#ffd23f';
  X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = 'rgba(20,16,28,.6)'; X.beginPath(); X.arc(b.x, b.y, rad, 0, TAU); X.stroke();
  X.lineWidth = 5; X.strokeStyle = col; X.beginPath(); X.arc(b.x, b.y, rad, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.02, hp)); X.stroke();
  if (hp > .66) { const p = 1 + Math.sin(T * 9) * .12; txt('!', b.x, b.y - rad - 12 * p, 24 * p, '#ff4d5e'); }
}

/* ───────────── people behind the glass ───────────── */
/* the bus driver: look = where the wiper tip is; cl = 0..1 how clean the glass is; mood 'win' | 'lose' | null */
function driver(x, y, look, cl, mood, T) {
  const lx = clamp((look[0] - x) / 220, -1, 1) * 4, ly = clamp((look[1] - y) / 220, -1, 1) * 3;
  rr(x - 50, y - 12, 100, 86, 26); ink('#3d6fd1', 4);                                  // blue shirt
  X.fillStyle = 'rgba(255,255,255,.2)'; rr(x - 38, y - 4, 22, 46, 10); X.fill();
  X.beginPath(); X.moveTo(x - 12, y - 10); X.lineTo(x, y + 8); X.lineTo(x + 12, y - 10); X.closePath(); ink('#fff', 3);
  const bob = mood === 'win' ? -Math.abs(Math.sin(T * 9)) * 8 : mood === 'lose' ? Math.sin(T * 40) * 2 : 0;
  X.save(); X.translate(0, bob);
  el(x - 40, y - 58, 8, 11); ink('#f2b27a', 3); el(x + 40, y - 58, 8, 11); ink('#f2b27a', 3);      // ears
  X.beginPath(); X.arc(x, y - 56, 40, 0, TAU); ink('#f2b27a', 4);
  X.fillStyle = 'rgba(255,110,140,.45)'; el(x - 26, y - 44, 9, 6); X.fill(); el(x + 26, y - 44, 9, 6); X.fill();
  rr(x - 44, y - 106, 88, 34, 16); ink('#2a4fa8', 4); el(x, y - 74, 52, 11); ink('#1d3a82', 4);          // cap + brim
  star(x, y - 90, 10, 4.5, 5, 0, '#ffd23f', 2);
  const wide = mood === 'lose' || cl < .3, small = mood === 'win' || cl > .8;
  for (const sx of [-1, 1]) {
    const ex = x + sx * 17, ey = y - 58;
    el(ex, ey, wide ? 11 : 9, wide ? 12 : small ? 6 : 9); ink('#fff', 2.5);
    X.fillStyle = INK; el(ex + lx * .7, ey + ly * .7, wide ? 3 : 4, wide ? 3 : 4); X.fill();
    X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - sx * 12, ey - (wide ? 20 : 16) + (cl < .6 ? sx * 3 : 0)); X.lineTo(ex + sx * 9, ey - (wide ? 23 : 13) - (cl < .6 ? sx * 4 : 0)); X.stroke();
  }
  X.fillStyle = INK;                                                                      // the big moustache
  X.beginPath(); X.moveTo(x, y - 46); X.quadraticCurveTo(x - 20, y - 54, x - 32, y - 40); X.quadraticCurveTo(x - 16, y - 36, x, y - 40); X.quadraticCurveTo(x + 16, y - 36, x + 32, y - 40); X.quadraticCurveTo(x + 20, y - 54, x, y - 46); X.fill();
  if (mood === 'lose' || cl < .3) { el(x, y - 28, 9, 12); ink('#3a1830', 2.5); }
  else { X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); if (small) X.arc(x, y - 34, 11, .15, Math.PI - .15); else X.moveTo(x - 9, y - 28), X.lineTo(x + 9, y - 28); X.stroke(); }
  if (cl < .5 && mood !== 'win') { const q = (T * 1.4) % 1; drop(x + 46, y - 80 + q * 26, 4, '#9fe3ff'); }
  X.restore();
  // hands on the wheel (thumbs-up when it is clean)
  if (mood === 'win') { rr(x + 40, y - 40 - Math.abs(Math.sin(T * 9)) * 8, 20, 30, 9); ink('#f2b27a', 3); rr(x + 44, y - 66 - Math.abs(Math.sin(T * 9)) * 8, 12, 28, 6); ink('#f2b27a', 3); }
  else for (const sx of [-1, 1]) { el(x + sx * 56, y + 56, 12, 10); ink('#f2b27a', 3); }
  el(x, y + 64, 84, 24); X.lineWidth = 16; X.strokeStyle = INK; X.stroke(); X.lineWidth = 9; X.strokeStyle = '#4a4560'; X.stroke();   // the steering wheel
}
/* a kid with his face squashed against the glass; look = the wiper tip; mood 'win' peels him off and waves */
function kid(x, y, look, mood, T) {
  const lx = clamp((look[0] - x) / 200, -1, 1) * 3.4, ly = clamp((look[1] - y) / 200, -1, 1) * 3;
  const pull = mood === 'win' ? ease(clamp(T - kid.t0, 0, .35) / .35) : 0, sc = 1 - pull * .14;
  X.save(); X.translate(x, y); X.scale(sc, sc);
  if (mood === 'win') { const w = Math.sin(T * 12) * .3; X.save(); X.translate(54, 34); X.rotate(-.5 + w); rr(-9, -40, 18, 44, 9); ink('#ffcf9e', 3); X.restore(); }
  for (const [hx, hy] of [[-60, 36], [mood === 'win' ? 140 : 62, 40]]) if (!(mood === 'win' && hx > 0)) {   // hands splayed on the glass
    el(hx, hy, 17, 15); ink('#ffcf9e', 3); X.strokeStyle = INK; X.lineWidth = 3; for (let i = -1; i <= 1; i++) { X.beginPath(); X.moveTo(hx + i * 8, hy - 4); X.lineTo(hx + i * 12, hy - 18); X.stroke(); }
  }
  for (let i = 0; i < 5; i++) { const a = -2.4 + i * .5; X.beginPath(); X.moveTo(Math.cos(a) * 34, Math.sin(a) * 34 - 4); X.lineTo(Math.cos(a) * 52 + (i - 2) * 3, Math.sin(a) * 52 - 12); X.lineTo(Math.cos(a + .25) * 36, Math.sin(a + .25) * 36 - 4); X.closePath(); ink('#6b3f22', 3); }   // spiky hair
  el(0, 0, 50 + (1 - pull) * 6, 42); ink('#ffcf9e', 4);                                    // the squashed face
  X.fillStyle = 'rgba(255,110,140,.55)'; el(-30, 12, 12, 8); X.fill(); el(30, 12, 12, 8); X.fill();
  for (const sx of [-1, 1]) { const ex = sx * 19; el(ex, -8, 11, 12); ink('#fff', 2.5); X.fillStyle = INK; el(ex + lx, -8 + ly, 4.5, 4.5); X.fill(); }
  el(0, 8 + pull * 2, 11 - pull * 3, 7 - pull * 2); ink('#f2a679', 2.5);                  // the mashed nose
  if (mood === 'lose') { el(0, 26, 12, 13); ink('#3a1830', 2.5); }
  else if (mood === 'win') { X.beginPath(); X.arc(0, 18, 15, .1, Math.PI - .1); ink('#3a1830', 2.5); }
  else { X.beginPath(); X.moveTo(-22, 22); X.quadraticCurveTo(0, 36, 22, 22); X.quadraticCurveTo(0, 26, -22, 22); ink('#3a1830', 2.5); el(0, 31 + Math.sin(T * 7) * 1.5, 7, 6); ink('#ff7ea8', 2); }   // tongue out
  X.restore();
}
kid.t0 = 0;
/* a granny who keeps knitting no matter what */
function granny(x, y, T, mood) {
  rr(x - 44, y + 4, 88, 70, 22); ink('#a85fb0', 4);
  const cx = x, cy = y - 20;
  X.beginPath(); X.arc(cx, cy - 26, 15, 0, TAU); ink('#f4f1f6', 3.5);                    // the bun
  X.beginPath(); X.arc(cx, cy, 30, 0, TAU); ink('#ffd9b3', 4);
  X.beginPath(); X.arc(cx, cy - 8, 31, Math.PI * 1.05, Math.PI * 1.95); X.lineWidth = 12; X.strokeStyle = '#f4f1f6'; X.stroke();   // white hair
  for (const sx of [-1, 1]) { circ(cx + sx * 12, cy + 2, 8.5, 'rgba(255,255,255,.7)', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(cx + sx * 12, cy + 2 + (mood === 'lose' ? 0 : Math.sin(T * .8) * .6), 2.8, 0, TAU); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(cx - 4, cy + 2); X.lineTo(cx + 4, cy + 2); X.stroke();
  X.beginPath(); X.arc(cx, cy + 14, 6, .2, Math.PI - .2); X.lineWidth = 3; X.stroke();
  const k = Math.sin(T * 7) * 8;                                                          // the knitting
  circ(x - 26, y + 52, 14, '#ff5c8a', 3); line([[x - 18, y + 52 + k * .2], [x + 20, y + 40 - k * .3]], 4, '#cfd8e6'); line([[x - 8, y + 58], [x + 28, y + 50 + k * .3]], 4, '#cfd8e6');
  rr(x + 8, y + 54, 36, 14 + Math.abs(k) * .2, 5); ink('#ff5c8a', 3);
}

/* ───────────── the bus wash, the bus ───────────── */
function ladder(x, y0, T) {                            // an a-frame ladder in front of the bus, left
  for (const sx of [0, 1]) { const lx = x + sx * 58 + (sx ? 8 : -2); line([[lx, y0], [lx + (sx ? 6 : -6), 596]], 15, INK); line([[lx, y0], [lx + (sx ? 6 : -6), 596]], 8, '#d9d4ee'); }
  for (let i = 0; i < 8; i++) { const yy = y0 + 20 + i * 46; rr(x - 4, yy - 7, 76, 14, 5); ink('#b9b4d0', 3); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(x, yy - 4, 60, 3); }
}
function squirtBottle(x, y, an, on, T) {
  X.save(); X.translate(x, y); X.rotate(an); const rec = on ? Math.sin(T * 38) * 1.5 : 0; X.translate(-rec, 0);
  rr(-34, -12, 40, 28, 9); ink('#ff5c8a', 3.5); X.fillStyle = 'rgba(255,255,255,.45)'; rr(-30, -8, 28, 5, 2.5); X.fill();
  rr(-10, 12, 16, 20, 5); ink('#c9ced6', 3);                                                // the trigger
  rr(4, -9, 24, 14, 5); ink('#ffd23f', 3); rr(24, -6, 12, 8, 3); ink('#d99a12', 3);          // spray head
  X.restore();
}
/* the water jet from the bottle to the aim point */
function jet(ax, ay, k, dry, T) {
  const dx = ax - NZ[0], dy = ay - NZ[1], d = Math.hypot(dx, dy), lift = 24 + d * .1, C = [(NZ[0] + ax) / 2, Math.min(NZ[1], ay) - lift];
  const at = u => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; return [a * NZ[0] + b * C[0] + c * ax, a * NZ[1] + b * C[1] + c * ay]; };
  if (dry) { for (let i = 0; i < 4; i++) { const u = ((T * 3 + i * .25) % 1) * .25, [px, py] = at(u); drop(px, py + u * 90, 5 - i * .7); } return; }
  const w = 5 + 6 * k, pts = []; for (let i = 0; i <= 22; i++) pts.push(at(i / 22));
  line(pts, w + 8, INK); line(pts, w, WATER); line(pts, w * .4, FOAM);
  X.setLineDash([10, 16]); X.lineDashOffset = -T * 300; line(pts, w * .25, '#fff'); X.setLineDash([]);
  const s = 1 + Math.sin(T * 30) * .08; el(ax, ay, 34 * s, 28 * s); ink('rgba(170,232,255,.7)', 3);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI + Math.PI + Math.sin(T * 25 + i) * .15, L = 20 + ((T * 90 + i * 13) % 18); drop(ax + Math.cos(a) * L, ay + Math.sin(a) * L * .9 - 4, 3.6); }
}
function bucket(x, y, k, dry, T) {                     // the washer-fluid jug at the foot of the ladder: level k
  const w = 58, h = 64;
  rr(x - w / 2, y - h, w, h, 14); ink('#e8f3ff', 4);
  X.save(); rr(x - w / 2, y - h, w, h, 14); X.clip();
  const lv = y - h * k, wv = Math.sin(T * 6) * 2; X.fillStyle = dry ? '#ff8a8a' : '#7ae0ff'; X.beginPath(); X.moveTo(x - w / 2, lv + wv); X.lineTo(x + w / 2, lv - wv); X.lineTo(x + w / 2, y); X.lineTo(x - w / 2, y); X.fill();
  X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(x - w / 2 + 6, y - h + 8, 7, h - 16);
  X.restore(); rr(x - w / 2, y - h, w, h, 14); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  rr(x - 12, y - h - 14, 24, 14, 5); ink('#ffd23f', 3);
  X.fillStyle = INK; for (let i = 1; i < 4; i++) X.fillRect(x + w / 2 - 12, y - h + i * h / 4, 12, 3);
  if (dry && Math.sin(T * 12) > 0) txt('!', x, y - h - 28, 30, '#ff4d4d');
}
/* the sprayer on the ladder, feet at (x, y); the bottle points at (ax, ay) */
function sprayer(x, y, ax, ay, col, mood, on, T) {
  const u = 4, an = Math.atan2(ay - NZ[1], ax - NZ[0]), hx = x + 22, hy = y - 30;
  shadow(x, y + 2, 34, 6, .2);
  X.save(); X.translate(x, y); arm(u, 1, clamp(an + Math.PI / 2, .3, 2.5) - .1, .85, col); X.restore();
  caos(x, y, u, { col, mood });
  squirtBottle(hx + 8, hy - 2, an, on, T);
}
/* the wiper arm + blade. th = angle, v = angular velocity (for the rubber to lag), dry = squeaking */
function wiperArm(th, v, dry, T) {
  X.save(); X.translate(PX, PY); X.rotate(th);
  rr(10, -5, R1 - 6, 10, 5); ink('#aeb6c4', 3); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(18, -3, R1 - 40, 2.5);
  X.save(); X.translate(R1 - 60, 0); X.rotate(-v * .012); rr(-(R1 - 60 - R0), -9, R1 - R0 - 4, 18, 9); ink(RUBB, 3.5); X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(-(R1 - 60 - R0) + 10, -6, R1 - R0 - 24, 3); X.restore();
  rr(R0 - 12, -9, 14, 18, 4); ink('#c9ced6', 3);
  X.restore();
  circ(PX, PY, 21, '#3b3550', 4); circ(PX, PY, 10, '#c9ced6', 3);
  if (dry) { const a = th + Math.PI / 2; for (let i = 0; i < 3; i++) { const r = R0 + 80 + i * 60 + Math.sin(T * 30 + i) * 6, q = (i % 2 ? 1 : -1) * 16; line([[PX + Math.cos(th) * r + Math.cos(a) * q, PY + Math.sin(th) * r + Math.sin(a) * q], [PX + Math.cos(th) * r + Math.cos(a) * (q + 12 * Math.sign(q)), PY + Math.sin(th) * r + Math.sin(a) * (q + 12 * Math.sign(q))]], 4, '#fff'); } }
}
/* the seagull that bombs the glass: (x, y) = body centre, fl = flap phase */
function gull(x, y, fl, sc, T, flip) {
  X.save(); X.translate(x, y); X.scale(sc * (flip ? -1 : 1), sc);
  const fa = Math.sin(fl) * .7;
  for (const s of [-1, 1]) { X.save(); X.translate(s * 6, -4); X.rotate(s * (.3 + fa)); X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(s * 26, -22, s * 54, -4); X.quadraticCurveTo(s * 30, 2, 0, 8); X.closePath(); ink('#fff', 3); X.fillStyle = '#c3cbd9'; X.fillRect(s * 38 - 5, -8, 10, 8); X.restore(); }
  el(0, 4, 20, 13); ink('#fff', 3.5);
  X.beginPath(); X.arc(20, -4, 10, 0, TAU); ink('#fff', 3.5);
  X.beginPath(); X.moveTo(28, -5); X.lineTo(42, -2); X.lineTo(28, 2); X.closePath(); ink('#ffb02e', 2.5);
  X.fillStyle = INK; X.beginPath(); X.arc(23, -7, 2.4, 0, TAU); X.fill();
  X.beginPath(); X.moveTo(-18, 6); X.lineTo(-32, 10); X.lineTo(-18, 12); X.closePath(); ink('#c3cbd9', 2.5);
  X.restore();
}
/* the cardboard cutout of the wash attendant (a gag standing by the bumper; the losing bus bowls it over) */
function cutout(x, y, rot, s) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  rr(-26, -20, 52, 14, 5); ink('#b98042', 3);                                              // the folded foot
  rr(-24, -96, 48, 78, 8); ink('#e3ac66', 3.5); X.fillStyle = '#f7d297'; X.fillRect(-18, -90, 12, 60);
  rr(-24, -96, 48, 24, 8); ink('#ff7a3d', 3);                                                // overalls bib
  X.beginPath(); X.arc(0, -118, 22, 0, TAU); ink('#f2c9a0', 3.5);
  rr(-24, -144, 48, 14, 7); ink('#ff5c8a', 3);
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(0, -114, 11, .2, Math.PI - .2); X.stroke();
  X.fillStyle = INK; X.beginPath(); X.arc(-8, -123, 2.6, 0, TAU); X.arc(8, -123, 2.6, 0, TAU); X.fill();
  rr(26, -88, 16, 34, 8); ink('#f2c9a0', 3); rr(30, -114, 9, 30, 4); ink('#f2c9a0', 3);       // thumbs-up
  X.restore();
}

/* ───────────── the static scene, painted once into offscreen canvases ───────────── */
let BG = null, BUS = null, BGV = -1;
function offscreen(fn) { const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d'); fn(); X = old; return cv2; }
function buildBg() {                                   // the car-wash bay behind the bus
  return offscreen(() => {
    let g = X.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, '#2f8fa8'); g.addColorStop(1, '#8be0e0'); X.fillStyle = g; X.fillRect(0, 0, W, 420);
    X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 0; x < W; x += 56) for (let y = 0; y < 420; y += 56) if (((x + y) / 56) % 2 === 0) X.fillRect(x, y, 56, 56);   // wall tiles
    X.fillStyle = 'rgba(20,16,28,.12)'; for (let x = 0; x < W; x += 56) X.fillRect(x, 0, 2, 420); for (let y = 0; y < 420; y += 56) X.fillRect(0, y, W, 2);
    g = X.createLinearGradient(0, 400, 0, H); g.addColorStop(0, '#aeb6c4'); g.addColorStop(1, '#d9dde6'); X.fillStyle = g; X.fillRect(0, 400, W, H - 400);
    X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(0, 400); X.lineTo(W, 400); X.stroke();
    X.fillStyle = '#ffd23f'; for (let x = -20; x < W; x += 120) { X.beginPath(); X.moveTo(x, 590); X.lineTo(x + 70, 590); X.lineTo(x + 100, 570); X.lineTo(x + 30, 570); X.fill(); }   // hazard lines
    for (const [px, py, rx] of [[200, 584, 70], [620, 590, 90]]) { el(px, py, rx, 10); X.fillStyle = 'rgba(95,208,255,.45)'; X.fill(); }   // puddles
    X.fillStyle = 'rgba(255,255,255,.18)'; for (let i = -2; i < 8; i++) { X.beginPath(); X.moveTo(i * 130, H); X.lineTo(i * 130 + 50, H); X.lineTo(i * 130 + 150, 400); X.lineTo(i * 130 + 110, 400); X.fill(); }
    // the big roller brush, right wall (the spinning bristles are drawn live)
    rr(752, 150, 60, 250, 16); ink('#ff5c8a', 4);
  });
}
function buildBus() {                                  // the bus: body, windscreen frame, the inside of the bus, grille
  return offscreen(() => {
    rr(28, 70, 744, 498, 50); ink(BUSY, 6);
    X.save(); rr(28, 70, 744, 498, 50); X.clip(); X.fillStyle = BUSY2; X.beginPath(); X.moveTo(28, 520); X.lineTo(772, 520); X.lineTo(772, 600); X.lineTo(28, 600); X.fill(); X.fillStyle = BUSL; el(150, 112, 90, 14, -.1); X.fill();
    X.fillStyle = RUBB; X.fillRect(28, 128, 744, 6); X.restore();
    rr(58, 128, 684, 392, 40); ink(RUBB, 4);                                              // rubber seal
    rr(GL[0], GL[1], GL[2], GL[3], GL[4]); ink('#7d8cae', 0);
    X.save(); rr(GL[0], GL[1], GL[2], GL[3], GL[4]); X.clip();
    let g = X.createLinearGradient(0, GL[1], 0, GL[1] + GL[3]); g.addColorStop(0, '#d8e3f5'); g.addColorStop(1, '#8d9cc0'); X.fillStyle = g; X.fillRect(70, 130, 660, 360);   // inside of the bus
    X.fillStyle = '#6f7fae'; X.fillRect(70, 300, 660, 190);                                  // the floor
    for (const [sx, c] of [[110, '#2fb5a8'], [300, '#2fb5a8'], [500, '#2fb5a8'], [690, '#2fb5a8']]) { rr(sx - 46, 224, 92, 108, 18); ink(mix(c, INK, .1), 3.5); X.fillStyle = 'rgba(255,255,255,.22)'; rr(sx - 38, 232, 22, 80, 10); X.fill(); }   // seat backs
    X.fillStyle = '#e8eefc'; for (const px of [230, 400, 560]) { X.fillRect(px - 5, 140, 10, 350); X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(px - 2, 140, 3, 350); X.fillStyle = '#e8eefc'; }   // handrails
    X.fillStyle = INK; X.fillRect(70, 138, 660, 4);
    X.fillStyle = 'rgba(255,238,160,.75)'; for (const lx of [200, 400, 600]) { rr(lx - 46, 146, 92, 10, 5); X.fill(); }   // ceiling lamps
    X.restore();
    rr(GL[0], GL[1], GL[2], GL[3], GL[4]); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
    // dash + hub plate under the windscreen
    rr(60, 484, 680, 40, 14); ink('#3b3550', 4); X.fillStyle = 'rgba(255,255,255,.12)'; rr(72, 490, 656, 8, 4); X.fill();
    // the grille, headlights, bumper
    rr(250, 530, 300, 24, 8); ink('#4a4560', 3.5); X.strokeStyle = '#8d89a8'; X.lineWidth = 3; for (let i = 0; i < 9; i++) { X.beginPath(); X.moveTo(266 + i * 33, 534); X.lineTo(266 + i * 33, 550); X.stroke(); }
    for (const hx of [150, 650]) { circ(hx, 540, 26, '#fff8d8', 4); circ(hx, 540, 14, '#ffe14d', 3); X.fillStyle = 'rgba(255,255,255,.8)'; el(hx - 8, 531, 8, 4, -.5); X.fill(); }
    rr(100, 556, 600, 14, 7); ink('#c9ced6', 3);
    // mirrors
    for (const sx of [-1, 1]) { const mx = sx < 0 ? 22 : 778; line([[mx, 214], [mx + sx * 12, 244]], 8, INK); rr(mx - 14 + sx * 6, 238, 28, 70, 10); ink('#4a4560', 3.5); X.fillStyle = 'rgba(180,230,255,.7)'; rr(mx - 8 + sx * 6, 244, 16, 58, 6); X.fill(); }
  });
}
function glassGlare(T) {                               // the diagonal light on the windscreen
  X.save(); rr(GL[0], GL[1], GL[2], GL[3], GL[4]); X.clip(); X.fillStyle = 'rgba(255,255,255,.13)';
  X.beginPath(); X.moveTo(190, 140); X.lineTo(260, 140); X.lineTo(150, 482); X.lineTo(80, 482); X.fill();
  X.beginPath(); X.moveTo(300, 140); X.lineTo(330, 140); X.lineTo(220, 482); X.lineTo(190, 482); X.fill();
  X.restore();
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS_ = 11; const cr = () => (CS_ = CS_ * 16807 % 2147483647) / 2147483647;
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave the spray stuck on */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ═════════ the game ═════════ */
function duSqueegee(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), wiper = D.role === 0, TS = Math.sqrt(sp), LIM = 15 / Math.sqrt(sp) - END_SLACK;
  const WETT = 2.3, KW = 2.3 * TS, KS = .5, SQ_ = .62;  // water lasts WETT s; gunk per radian of wet wiping / dry smear gain
  const MAXW = 6.2;                                       // the arm's top speed (rad/s)
  const DRAIN = .6, FILL = .5, RESTART = .28;             // the jug: per s squirting / per s resting / refilled this much after running dry
  /* the level: same on both screens. Seven blobs fanned over the sweep; the last two arrive by seagull later */
  const AT = [0, 0, 0, 0, 0, LIM * .22, LIM * .42];
  const kinds = [0, 1, 2, 3, 0, 1, 2]; for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const order = [0, 1, 2, 3, 4, 5, 6]; for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const bl = [];
  for (let i = 0; i < NB; i++) {
    const slot = order[i], a0 = TH0 + .24 + (TH1 - TH0 - .48) * (slot + .5) / NB, r = 31 + R() * 9;
    let best = null;
    for (let tries = 0; tries < 30; tries++) {
      const a = a0 + (R() - .5) * .16, d = 118 + R() * 150, x = PX + Math.cos(a) * d, y = PY + Math.sin(a) * d;
      if (y - r < GL[1] + 8 || x - r < GL[0] + 6 || x + r > GL[0] + GL[2] - 6) continue;
      if (bl.every(o => Math.hypot(o.x - x, o.y - y) > o.r + r + 8)) { best = { x, y, a, d }; break; }
    }
    if (!best) { const a = a0, d = 130 + (i % 3) * 55; best = { x: PX + Math.cos(a) * d, y: PY + Math.sin(a) * d, a, d }; }
    const L = Array.from({ length: 11 }, () => .84 + R() * .32), sp2 = Array.from({ length: 5 }, () => [R() * TAU, .7 + R() * .5, 4 + R() * 6]);
    const dr = Array.from({ length: 2 }, () => ({ x: (R() - .5) * 1.2, l: 8 + R() * 26, p: R() * 6 }));
    bl.push({ i, x: best.x, y: best.y, r, L, sp: sp2, dr, rot: R() * TAU, kind: kinds[i], at: AT[i], hp: 1, sm: 0, smD: 1, askAt: -9, goneAt: -9, gone: false, wet: 0, a: best.a, d: best.d });
  }
  bl.sort((p, q) => p.at - q.at); bl.forEach((b, i) => { b.i = i; });
  const variant = R() < 1 / 8;                            // 1 round in 8: the seagull wears sunglasses
  const lastAt = AT[NB - 1];
  /* water on the glass (both screens) */
  const wet = new Float32Array(GW * GH), cx = new Float32Array(GW * GH), cy = new Float32Array(GW * GH), cr_ = new Float32Array(GW * GH), ca = new Float32Array(GW * GH), inFan = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const k = j * GW + i, x = GX0 + i * CS + CS / 2, y = GY0 + j * CS + CS / 2; cx[k] = x; cy[k] = y; cr_[k] = Math.hypot(x - PX, y - PY); ca[k] = Math.atan2(y - PY, x - PX); inFan[k] = cr_[k] >= R0 - 4 && cr_[k] <= R1 + 4 && ca[k] <= -.01 ? 1 : 0; }
  const wetAt = (x, y) => { const i = Math.floor((x - GX0) / CS), j = Math.floor((y - GY0) / CS); return i < 0 || j < 0 || i >= GW || j >= GH ? 0 : wet[j * GW + i]; };
  const blobWet = b => { const q = b.r * .5; return (wetAt(b.x, b.y) * 2 + wetAt(b.x - q, b.y) + wetAt(b.x + q, b.y) + wetAt(b.x, b.y - q) + wetAt(b.x, b.y + q)) / 6; };
  function wetStep(dt, sx, sy, on) {
    const dec = dt / WETT;
    for (let k = 0; k < wet.length; k++) if (wet[k] > 0) wet[k] = Math.max(0, wet[k] - dec);
    if (!on) return;
    const SR = 58, i0 = Math.max(0, Math.floor((sx - SR - GX0) / CS)), i1 = Math.min(GW - 1, Math.ceil((sx + SR - GX0) / CS)), j0 = Math.max(0, Math.floor((sy - SR - GY0) / CS)), j1 = Math.min(GH - 1, Math.ceil((sy + SR - GY0) / CS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * GW + i, d = Math.hypot(cx[k] - sx, cy[k] - sy); if (d < SR) wet[k] = Math.min(1, wet[k] + dt * 6 * (1 - d / SR * .55)); }
  }
  function consume(a, b) {                                // the blade squeegees the water off every fan cell it crosses
    if (b - a < 1e-6) return;
    for (let k = 0; k < wet.length; k++) if (inFan[k] && wet[k] > 0 && ca[k] >= a && ca[k] < b) wet[k] *= .5;
  }
  /* state */
  let th = TH1, tt = TH1, vel = 0, pa = null, seenTh = TH1, seenPrev = TH1, seenV = 0, kx = 0, ky = 0, fN = FOCUSN, ending = null, resAt = -1, cleaned = 0, lastCleanAt = -9;
  let ax = 400, ay = 330, tx = 400, ty = 330, held = false, P = 1, dry = false, spraying = false, aimSent = -9, lastAim = '', seqA = 0, seqH = 0, seqArm = 0, armSent = -9, lastArm = '', hpSent = -9, lastHp = '', jetOn = false, aimAt = -9, aimSeq = -1, hpSeq = -1, armSeq = -1;
  let dryAt = -9, squeakAt = -9, sprayStarted = false, kidT0 = 0;
  const aimX = track(), aimY = track(), armT = track();
  const kHeld = new Set(), bits = [], pops = [];
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const HK = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (wiper) Object.assign(HK, { KeyA: [-1, 0], KeyD: [1, 0] }); else Object.assign(HK, { KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] });
  const live = b => g.c >= b.at && !b.gone;
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, vr: 0, rot: 0, k: 0 }, o)); }
  function cleanFx(b) {
    b.gone = true; b.goneAt = g.c; lastCleanAt = g.c; cleaned++; sfx.coin(); sfx.sparkle(); ring(b.x, b.y, '#fff', 70, .35);
    for (let i = 0; i < 6; i++) bit({ k: 1, x: b.x + (cr() - .5) * 60, y: b.y + (cr() - .5) * 50, vx: (cr() - .5) * 120, vy: -(60 + cr() * 100), gr: 160, r: 9 + cr() * 6, life: .7 });
    pop(['SQUEAKY!', 'SHINY!', 'SPARKLY!', 'SQUEAKY!'][cleaned % 4], b.x, b.y - 50, 28, '#4db8ff', '#fff');
  }
  function turn(p) {                                      // the pointer circles the hub: its angle change turns the arm (a dial)
    const dx = p.x - PX, dy = p.y - PY;
    if (Math.hypot(dx, dy) < 26) { pa = null; return; }
    const a = Math.atan2(dy, dx);
    if (pa !== null) { let da = a - pa; if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU; if (Math.abs(da) < 1.7) tt = clamp(tt + da, TH0, TH1); }
    pa = a;
  }
  const aimTo = p => { tx = clamp(p.x, MINX, MAXX); ty = clamp(p.y, MINY, MAXY); };

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: wiper ? 'WIPE!' : 'SQUIRT!', roleLabel: wiper ? 'WIPER' : 'SPRAYER',
    hint: wiper ? 'CIRCLE THE MOUSE AROUND THE HUB (OR HOLD A / D) TO SWING THE WIPER - ONLY WIPE WHERE THE GLASS IS WET!' : 'AIM WITH THE MOUSE (OR ARROWS), HOLD CLICK / SPACE TO SQUIRT THE GUNK - THE WIPER NEEDS WET GLASS!',
    thint: wiper ? 'DRAG IN CIRCLES AROUND THE HUB TO SWING THE WIPER - ONLY WIPE WHERE THE GLASS IS WET!' : 'DRAG TO AIM AND SQUIRT THE GUNK - THE WIPER NEEDS WET GLASS!',
    update(dt) {
      g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      const done = !!(g.result || ending);
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); held = false; kx = 0; ky = 0; }
      let hx = 0, hy = 0; for (const c of kHeld) if (HK[c]) { hx += HK[c][0]; hy += HK[c][1]; }
      if (wiper) {
        /* the arm: the pointer's turning (or A / D) sets the target, the arm chases it with a bit of weight */
        if (!done && hx) tt = clamp(tt + hx * 3.8 * dt, TH0, TH1);
        const prev = th;
        if (!done) { const want = clamp((tt - th) * 22, -MAXW, MAXW); vel += (want - vel) * Math.min(1, dt * 15); th = clamp(th + vel * dt, TH0, TH1); if (th === TH0 || th === TH1) vel = 0; }
        else vel *= .8;
        // the water as the sprayer's aim (a little late) paints it
        const jx = aimX.at(), jy = aimY.at(), on = jetOn && jx !== null && g.c - aimAt < .7 && !done;
        wetStep(dt, jx === null ? 0 : jx, jy === null ? 0 : jy, on);
        // the blade crosses gunk
        const lo = Math.min(prev, th), hi = Math.max(prev, th);
        if (hi - lo > 1e-6 && !g.result) for (const b of bl) {
          if (!live(b)) continue; const d = b.d; if (d < R0 - 6 || d > R1 + 6) continue;
          const hw = Math.asin(Math.min(.98, b.r * .8 / d)), ov = Math.max(0, Math.min(hi, b.a + hw) - Math.max(lo, b.a - hw));
          if (ov <= 0) continue;
          const w = blobWet(b), eff = clamp((w - .1) * 1.5, 0, 1);
          if (eff > 0) { b.hp = Math.max(0, b.hp - KW * ov * eff); b.sm = Math.max(0, b.sm - ov * eff * 2); }
          if (eff < .35) {                                // dry glass: it squeaks and smears the gunk back
            b.hp = Math.min(1, b.hp + KS * ov * (1 - eff / .35) * (b.hp < 1 ? 1 : 0)); b.sm = Math.min(1, b.sm + ov * 2.2); b.smD = Math.sign(vel) || 1;
            if (eff < .2 && g.c - squeakAt > .22) { squeakAt = g.c; snd(1500 + cr() * 500, .09, 'sine', .035, 0, 2400); }
            if (eff < .2 && g.c - b.askAt > 1) { b.askAt = g.c; D.send('dry', b.i); if (g.c - dryAt > 1.1) { dryAt = g.c; pop('SQUEAK!', b.x, b.y - 46, 24, '#9a8f7a', '#fff'); } }
          } else if (cr() < .5) bit({ k: 2, x: b.x + (cr() - .5) * 50, y: b.y + (cr() - .5) * 30, vx: (cr() - .5) * 60, vy: -(20 + cr() * 50), gr: -30, r: 4 + cr() * 6, life: .8 });
          if (b.hp <= GONE) { b.hp = 0; cleanFx(b); }
        }
        consume(lo, hi);
        if (Math.abs(vel) > 2.2 && cr() < dt * 7) noise(.06, .014, 2600, 3600, 'bandpass');
        // publish: the arm (≤10/s) and the gunk (≤7/s)
        const a = Math.round(th * 1000) + ',' + Math.round(vel * 20);
        if ((a !== lastArm && g.c - armSent >= .1)) { lastArm = a; armSent = g.c; D.send('arm', [++seqArm, Math.round(th * 1000), Math.round(vel * 20)], true); }
        const h = bl.map(b => Math.round(b.hp * 100)).join();
        if (h !== lastHp && g.c - hpSent >= .14) { lastHp = h; hpSent = g.c; D.send('hp', [++seqH].concat(bl.map(b => Math.round(b.hp * 100))), true); }
        // the verdict (judge): everything that will ever land has landed, and it is all clean
        if (!g.result) {
          if (!ending && g.c >= lastAt + .05 && bl.every(b => b.gone)) ending = { res: 'win', at: g.c + .3 };
          if (ending && g.c >= Math.min(ending.at, g.limit)) g.finish(ending.res); else if (!ending && g.c >= g.limit) g.finish('lose');
        }
      } else {
        /* the sprayer: aim (pointer or arrows), the jug, the squirt */
        if (hx || hy) { tx = clamp(tx + hx * 540 * dt, MINX, MAXX); ty = clamp(ty + hy * 440 * dt, MINY, MAXY); }
        const k = Math.min(1, dt * 26); ax += (tx - ax) * k; ay += (ty - ay) * k;
        const want = (held || kHeld.has('Space') || kHeld.has('Enter')) && !done && g.c > .1;
        if (want && !dry) { P -= DRAIN * dt; if (P <= 0) { P = 0; dry = true; snd(200, .2, 'sawtooth', .05, 0, 90); } }
        else P = Math.min(1, P + FILL * dt);
        if (dry && P >= RESTART) dry = false;
        const was = spraying; spraying = want && !dry;
        if (spraying && !was) noise(.12, .05, 900, 3000, 'bandpass'); if (spraying && cr() < dt * 12) noise(.1, .022, 2600, 3400, 'bandpass');
        wetStep(dt, ax, ay, spraying);
        // the arm as I see it (a bit late): the blade squeegees my water off too
        const sa = armT.at(.3); if (sa !== null) { seenPrev = seenTh; seenTh = sa; seenV += (clamp((seenTh - seenPrev) / Math.max(dt, 1e-3), -8, 8) - seenV) * Math.min(1, dt * 10); consume(Math.min(seenPrev, seenTh), Math.max(seenPrev, seenTh)); }
        const a = Math.round(ax) + ',' + Math.round(ay) + ',' + (spraying ? 1 : 0);
        if ((a !== lastAim && g.c - aimSent >= .1) || (spraying && g.c - aimSent >= .3)) { lastAim = a; aimSent = g.c; D.send('aim', [++seqA, Math.round(ax), Math.round(ay), spraying ? 1 : 0], true); }
      }
      // gunk keeps its smear and its wet read-out for the screen
      for (const b of bl) { b.wet = live(b) ? blobWet(b) : 0; if (!wiper && !b.gone && b.hp <= 0 && g.c >= b.at + .3) cleanFx(b); }
      // cosmetic
      for (let i = bits.length - 1; i >= 0; i--) { const q = bits[i]; q.vy += q.gr * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; if (g.c - q.t0 > q.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      if (!wiper && spraying && cr() < dt * 14) bit({ x: ax + (cr() - .5) * 60, y: ay + (cr() - .5) * 40, vx: (cr() - .5) * 20, vy: 10 + cr() * 30, gr: 60, r: 3 + cr() * 2.5, life: 1 });
    },
    msg(type, d) {
      if (!Array.isArray(d)) return;
      if (wiper) {
        if (type === 'aim' && d[0] > aimSeq) { aimSeq = d[0]; aimX.push(d[1]); aimY.push(d[2]); jetOn = !!d[3]; aimAt = g.c; }
      } else if (type === 'arm') { if (d[0] > armSeq) { armSeq = d[0]; armT.push(d[1] / 1000); } }
      else if (type === 'hp') { if (d[0] > hpSeq) { hpSeq = d[0]; for (let i = 0; i < bl.length; i++) if (typeof d[i + 1] === 'number') { const b = bl[i]; if (!b.gone) b.hp = clamp(d[i + 1] / 100, 0, 1); if (b.hp > .12) b.sm = Math.max(b.sm, 0); } } }
      else if (type === 'dry') { const b = bl[d]; if (b) b.askAt = g.c; }
    },
    draw() {
      const T = g.c, won = g.result === 'win' || (ending && ending.res === 'win'), lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      X = ctx;
      if (!BG || BGV !== +variant) { BG = buildBg(); BUS = buildBus(); BGV = +variant; }
      X.drawImage(BG, 0, 0);
      for (let i = 0; i < 8; i++) { const yy = 160 + i * 30, sw = Math.sin(T * 9 + i) * 5; rr(742 + sw * .4, yy, 24, 20, 8); ink(i % 2 ? '#4db8ff' : '#ff9a4d', 3); }   // the roller brush bristles, spinning
      for (let i = 0; i < 7; i++) { const q = ((T * .09 + i * .143) % 1), bx = 20 + (i * 131) % 760 + Math.sin(T * 1.3 + i) * 10, by = 400 - q * 420; X.globalAlpha = .85; X.beginPath(); X.arc(bx, by, 10 + (i % 3) * 5, 0, TAU); X.fillStyle = 'rgba(220,245,255,.35)'; X.fill(); X.lineWidth = 2.5; X.strokeStyle = 'rgba(20,60,90,.55)'; X.stroke(); X.fillStyle = 'rgba(255,255,255,.9)'; el(bx - 4, by - 4, 3, 2, -.6); X.fill(); X.globalAlpha = 1; }
      const total = bl.reduce((s, b) => s + (b.gone ? 0 : b.hp), 0), pct = clamp(1 - total / NB, 0, 1), cl = won ? 1 : pct;
      const mood = won ? 'win' : lost ? 'lose' : null;
      const th0 = wiper ? th : (armT.at(.3) === null ? TH1 : seenTh), v0 = wiper ? vel : seenV;
      const tip = [PX + Math.cos(th0) * R1, PY + Math.sin(th0) * R1];
      // ── the bus (everything on it moves together when it drives off) ──
      let off = 0, rev = 0;
      if (lost && rk >= 0) { rev = rk < .25 ? Math.sin(rk * 90) * 3 * (rk / .25) : 0; off = rk > .25 ? 1100 * Math.pow((rk - .25) / .5, 2) : 0; }
      X.save(); X.translate(off + rev, rev * .4);
      X.drawImage(BUS, 0, 0);
      // ── things inside the bus ──
      X.save(); rr(GL[0], GL[1], GL[2], GL[3], GL[4]); X.clip();
      if (won && kid.t0 === 0) kid.t0 = T; if (!won) kid.t0 = 0;
      granny(652, 238, T, mood); kid(150, 232, tip, mood, T);
      driver(594, 372, tip, cl, mood, T);
      X.restore();
      glassGlare(T);
      // ── the water on the glass: a small canvas stretched over the grid, so the puddles are soft ──
      drawWet();
      // ── gunk ──
      for (const b of bl) {
        if (b.at > T) continue;
        if (b.gone) { const a = T - b.goneAt; if (a < .5) { X.globalAlpha = 1 - a / .5; star(b.x, b.y, 44 * (1 + a), 12, 4, a * 3, '#fff', 0); X.globalAlpha = 1; } continue; }
        const born = clamp((T - b.at) / .25, 0, 1), sc = (wiper ? .72 + .28 * clamp(b.hp * 2, 0, 1) : .55 + .45 * b.hp) * (born < 1 ? outBack(born) : 1) * (won ? 1 : 1);
        if (b.sm > .04) {                                // a smear dragged along the wipe
          const an = b.a + Math.PI / 2, o = b.smD * b.sm * b.r * .7; X.globalAlpha = .75; el(b.x + Math.cos(an) * o, b.y + Math.sin(an) * o, b.r * (1 + b.sm * .5) * sc, b.r * .6 * sc, an); ink(b.kind === 0 ? '#ffe9a8' : b.kind === 1 ? '#e6e8dc' : b.kind === 2 ? '#8a5a33' : '#d9b25a', 2); X.globalAlpha = 1;
        }
        gunk(b, sc, b.wet, T);
        if (!wiper && !lost) heat(b, b.hp, T);
      }
      // the wiper arm, with the wiper riding its tip
      wiperArm(th0, v0 * 20, wiper ? T - squeakAt < .25 : false, T);
      const lean = clamp(v0 * .06, -.35, .35) + (th0 + Math.PI / 2) * .3, wcol = wiper ? myCol() : pCol(), wm = won ? 'happy' : lost ? 'sad' : null;
      const jump = won ? Math.abs(Math.sin(T * 9)) * 14 : 0;
      X.save(); X.translate(tip[0], tip[1] - 6 - jump); X.rotate(lean);
      X.save(); X.scale(1, 1); arm(3.4, -1, won ? -.6 + Math.sin(T * 14) * .3 : -.3, 1, wcol); arm(3.4, 1, won ? .6 - Math.sin(T * 14) * .3 : .3, 1, wcol); X.restore();
      caos(0, 0, 3.4, { col: wcol, mood: wm });
      X.restore();
      pill(clamp(tip[0], 80, 720), tip[1] - 56 - jump, wiper ? 'YOU' : 'YOUR FRIEND', wcol);
      // exhaust + brake lights when it drives off
      if (lost && rk > .1) for (let i = 0; i < 3; i++) { const q = (T * 3 + i / 3) % 1; X.globalAlpha = (1 - q) * .8; circ(60 - q * 50 - i * 12, 548 - q * 40, 14 + q * 18, '#cfd8e6', 3); X.globalAlpha = 1; }
      // the sign on the roof, showing how clean the glass is
      rr(268, 80, 264, 44, 12); ink('#14101c', 4); X.fillStyle = 'rgba(255,255,255,.12)'; rr(278, 84, 244, 8, 4); X.fill();
      X.fillStyle = '#3a3550'; rr(280, 92, 240, 22, 7); X.fill();
      X.fillStyle = pct > .8 ? '#5CFF7A' : '#ffb02e'; rr(280, 92, 240 * pct, 22, 7); X.fill();
      txt(Math.round(pct * 100) + '%', 400, 104, 20, '#fff', 'center', 90);
      X.restore();
      // ── the gag cutout beside the bumper ──
      if (!lost || rk < 0) cutout(745, 584, 0, .72);
      else { const hit = rk > .4; if (!hit) cutout(745, 584, 0, .72); else { const e = rk - .4; cutout(745 + e * 520, 584 - e * 360 + e * e * 500, e * 11, .72); } }
      // ── the seagull bombing runs ──
      for (const b of bl) if (b.at > 0) {
        const t0 = b.at - 1.15, t1 = b.at - .3, t2 = b.at + .6; if (T < t0 || T > t2) continue;
        const gx = T < t1 ? lerp(-60, b.x, ease((T - t0) / (t1 - t0))) : lerp(b.x, 880, ease((T - t1 - .1) / (t2 - t1 - .1))), gy = 96 + Math.sin(T * 4) * 6;
        gull(gx, gy, T * 22, 1.05, T, false);
        if (variant) { X.fillStyle = INK; rr(gx + 12, gy - 12, 24, 8, 3); X.fill(); }
        if (T > t1 && T < b.at) { const q = (T - t1) / (b.at - t1); circ(b.x, lerp(gy + 14, b.y, q * q), 6, '#f6f4ee', 3); }
        if (T > t1 - .05 && T < t1 + .5) badge('SPLAT!', clamp(b.x, 120, 680), 176 + (T - t1) * -10, 22, '#9a8f7a', '#fff', outBack((T - t1 + .05) / .2), -.05);
      }
      // ── the sprayer on the ladder (front left) ──
      const aim = wiper ? [aimX.at() === null ? 400 : aimX.at(), aimY.at() === null ? 330 : aimY.at()] : [ax, ay];
      const on = wiper ? jetOn && !g.result && T - aimAt < .7 : spraying, dr = wiper ? false : dry && (held || kHeld.has('Space') || kHeld.has('Enter')), scol = wiper ? pCol() : myCol();
      ladder(20, 340, T);
      bucket(54, 506, wiper ? 1 : P, !wiper && dry, T);
      sprayer(46, 356, aim[0], aim[1], scol, won ? 'happy' : lost ? 'sad' : null, on, T);
      pill(wiper ? 104 : 54, 296, wiper ? 'YOUR FRIEND' : 'YOU', scol);
      if (on && !won && !lost) jet(aim[0], aim[1], wiper ? 1 : clamp(P * 2, .3, 1), false, T);
      else if (dr) jet(aim[0], aim[1], 0, true, T);
      // my aim reticle (sprayer) / the hub dial (wiper)
      if (!wiper && !g.result) {
        const pulse = 1 + Math.sin(T * 8) * .06;
        X.save(); X.translate(ax, ay); X.scale(pulse, pulse);
        X.lineWidth = 8; X.strokeStyle = INK; X.beginPath(); X.arc(0, 0, 30, 0, TAU); X.stroke(); X.lineWidth = 4; X.strokeStyle = spraying ? '#fff' : '#ffd23f'; X.stroke();
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { line([[a * 22, b * 22], [a * 38, b * 38]], 8, INK); line([[a * 22, b * 22], [a * 38, b * 38]], 4, spraying ? '#fff' : '#ffd23f'); }
        X.restore();
        if (!spraying && T < 3 && !dry) badge(TOUCH ? 'HOLD TO SQUIRT' : 'HOLD CLICK / SPACE', 360, 380, 18, '#2b9ee6', '#fff', 1, -.05);
        if (dry) badge('REFILLING...', 130, 540, 18, '#e8434f', '#fff', 1, -.05);
        for (const b of bl) { const a = T - b.askAt; if (live(b) && a < .9) bubble('WET IT!', b.x + 36, b.y - 30 - Math.sin(a * 8) * 2, 18, a < .15 ? outBack(a / .15) : 1); }
      }
      if (wiper && !g.result && T < 3.2) {
        const p = .5 + .5 * Math.sin(T * 5); X.globalAlpha = .55 + p * .4; X.lineWidth = 8; X.strokeStyle = INK; X.beginPath(); X.arc(PX, PY, 54, Math.PI * 1.05, Math.PI * 1.95); X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke();
        for (const e of [Math.PI * 1.05, Math.PI * 1.95]) { const dx = Math.cos(e) * 54, dy = Math.sin(e) * 54; star(PX + dx, PY + dy, 12, 6, 3, e + Math.PI / 2 * (e < 5 ? -1 : 1) + Math.PI / 2, '#fff', 3); }
        X.globalAlpha = 1;
        if (!bl.some(b => live(b) && b.wet > .3)) badge('WAIT FOR THE WATER', 400, 372, 18, '#2b9ee6', '#fff', 1, -.03);
        else badge(TOUCH ? 'DRAG IN CIRCLES' : 'CIRCLE THE MOUSE / A D', 400, 372, 18, '#22a447', '#fff', 1, -.03);
      }
      // ── payoffs ──
      if (won && rk >= 0) {
        const sweep = clamp((rk - .05) / .6, 0, 1);
        if (sweep > 0 && sweep < 1) { X.save(); rr(GL[0], GL[1], GL[2], GL[3], GL[4]); X.clip(); X.globalAlpha = .6; X.fillStyle = '#fff'; const sx = -200 + sweep * 1100; X.beginPath(); X.moveTo(sx, 130); X.lineTo(sx + 80, 130); X.lineTo(sx - 60, 490); X.lineTo(sx - 140, 490); X.fill(); X.restore(); }
        for (let i = 0; i < 6; i++) { const q = ((rk * 1.6 + i / 6) % 1), sx = [120, 300, 520, 690, 200, 600][i], sy = [190, 440, 170, 420, 330, 300][i]; star(sx, sy, 8 + (1 - q) * 14, 3, 4, rk * 4 + i, '#fff', 0); }
        if (rk > .2) badge('HONK!', 594, 292, 34, '#ffd23f', INK, outBack((rk - .2) / .2), .08);
        if (rk > .4) badge('SPOTLESS!', 400, 196, 36, '#4db8ff', '#fff', outBack((rk - .4) / .22), -.04);
      }
      if (lost && rk >= 0) {
        if (rk > .4) badge('BONK!', 660, 470 - (rk - .4) * 120, 36, '#e8434f', '#fff', outBack((rk - .4) / .18), .1);
        if (rk > .08 && rk < .5) badge('VROOM!', 400, 300, 38, '#ff9a4d', '#fff', outBack((rk - .08) / .15), -.06);
      }
      drawBits(T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 100, 700), Math.max(176, q.y - Math.min(a, .6) * 14), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      vignette(.14);
    },
    down(p) { if (wiper) { pa = null; turn(p); } else { aimTo(p); held = true; } },
    up() { if (wiper) pa = null; else held = false; },
    move(p) { if (wiper) turn(p); else aimTo(p); },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      kHeld.add(e.code);
    },
    keyup(e) { kHeld.delete(e.code); },
  };
  let WC = null, WI = null;
  function drawWet() {                                    // the water read-out: shiny blue where wet
    try {
      if (!WC) { WC = document.createElement('canvas'); WC.width = GW; WC.height = GH; WI = WC.getContext('2d').createImageData(GW, GH); }
      const d = WI.data; for (let k = 0; k < wet.length; k++) { const w = wet[k]; d[k * 4] = 170; d[k * 4 + 1] = 232; d[k * 4 + 2] = 255; d[k * 4 + 3] = w > .02 ? Math.min(150, 40 + w * 120) : 0; }
      WC.getContext('2d').putImageData(WI, 0, 0);
      X.save(); rr(GL[0], GL[1], GL[2], GL[3], GL[4]); X.clip(); X.imageSmoothingEnabled = true; X.drawImage(WC, GX0, GY0, GW * CS, GH * CS); X.restore();
    } catch (e) { /* headless */ }
  }
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0, fade = clamp(a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1, 0, 1);
      X.globalAlpha = fade;
      if (b.k === 1) star(b.x, b.y, b.r, b.r * .35, 4, a * 4, '#fff', 2);
      else if (b.k === 2) { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); X.fillStyle = 'rgba(220,245,255,.4)'; X.fill(); X.lineWidth = 2; X.strokeStyle = 'rgba(30,60,90,.7)'; X.stroke(); }
      else drop(b.x, b.y, b.r, WATER);
      X.globalAlpha = 1;
    }
  }
  g.dbg = {
    /* what the WIPER screen shows: the gunk (it is there until nearly clean), how shiny (wet) the glass is under it, my own arm */
    wiperView: () => ({ th, vel, tt, blobs: bl.map(b => ({ i: b.i, x: b.x, y: b.y, r: b.r, a: b.a, d: b.d, live: live(b) && b.hp > GONE, wet: b.wet })), PX, PY, R0, R1 }),
    /* what the SPRAYER screen shows: the gunk with its thickness ring, the water, my aim and jug, the wiper arm as it is drawn (late) */
    sprayerView: () => ({ aim: [ax, ay], P, dry, spraying, arm: armT.at(.3) === null ? TH1 : seenTh, blobs: bl.map(b => ({ i: b.i, x: b.x, y: b.y, r: b.r, a: b.a, d: b.d, live: live(b) && !b.gone, hp: b.hp, wet: b.wet })), PX, PY, R0, R1 }),
    bl, wet, pct: () => 1 - bl.reduce((s, b) => s + (b.gone ? 0 : b.hp), 0) / NB, LIM,
  };
  wire(g, D, 0, sp, 'du_squeegee');
  return g;
}
reg('du_squeegee', duSqueegee, 'SQUIRT & WIPE'); REGMAP.du_squeegee.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 3.6 s loop: squirt a pie, swing the wiper over the wet glass ───────────── */
function demo(role, t) {
  X = ctx;
  const u = t % 3.6, spray = u > .3 && u < 1.2, wetK = u > .5 ? Math.min(1, (u - .5) / .3) * (u < 3.3 ? 1 : 0) : 0;
  const swing = u > 1.3 && u < 2.7 ? Math.sin((u - 1.3) / 1.4 * Math.PI * 1.5) : 0, th = -1.6 + swing * .6;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#2f8fa8'; X.fillRect(0, 0, 520, 240);
  const k = .6, ox = 260 - PX * k, oy = 226 - PY * k;
  X.save(); X.translate(ox, oy); X.scale(k, k);
  rr(60, 150, 680, 360, 36); ink(RUBB, 5); rr(GL[0], GL[1], GL[2], GL[3], GL[4]); ink('#bfd0ec', 4);
  const b = { x: PX + Math.cos(-1.1) * 150, y: PY + Math.sin(-1.1) * 150, r: 50, L: [1, .9, 1.1, .95, 1.08, .9, 1, 1.05, .93, 1.1, .98], sp: [[.5, 1, 6], [2.2, .9, 5], [3.9, 1.1, 7], [5.3, 1, 6]], dr: [{ x: -.2, l: 18, p: 1 }, { x: .4, l: 10, p: 3 }], rot: 0, kind: 0 };
  const hp = u < 1.5 ? 1 : u < 2.6 ? 1 - (u - 1.5) / 1.1 : 0;
  if (wetK > 0) { X.globalAlpha = wetK * .5; el(b.x, b.y, 88, 76); X.fillStyle = '#aae8ff'; X.fill(); X.globalAlpha = 1; }
  if (hp > 0) { gunk(b, .6 + .4 * hp, wetK, t); if (role === 1) heat(b, hp, t); } else if (u < 3) { X.globalAlpha = 1 - (u - 2.6) / .4; star(b.x, b.y, 50, 14, 4, u * 3, '#fff', 0); X.globalAlpha = 1; }
  wiperArm(th, swing * 3, false, t);
  X.restore();
  // the wiper rides the tip, the sprayer stands on the left
  const tipx = ox + (PX + Math.cos(th) * R1) * k, tipy = oy + (PY + Math.sin(th) * R1) * k;
  X.save(); X.translate(tipx, tipy - 3); X.scale(.6, .6); caos(0, 0, 3.4, { col: role ? '#6EA8FE' : '#FFC93C', mood: hp <= 0 ? 'happy' : null }); X.restore();
  X.save(); X.translate(64, 200); X.scale(.8, .8); X.translate(-46, -356);
  ladder(20, 340, t); sprayer(46, 356, b.x, b.y, role ? '#FFC93C' : '#6EA8FE', null, spray, t); X.restore();
  if (spray) {
    const nx = 64 + (NZ[0] - 46) * .8, ny = 200 + (NZ[1] - 356) * .8, ex = ox + b.x * k, ey = oy + b.y * k, C = [(nx + ex) / 2, Math.min(ny, ey) - 40], pts = [];
    for (let i = 0; i <= 16; i++) { const q = i / 16, a = (1 - q) * (1 - q), c = 2 * (1 - q) * q, d = q * q; pts.push([a * nx + c * C[0] + d * ex, a * ny + c * C[1] + d * ey]); }
    line(pts, 12, INK); line(pts, 6, WATER); line(pts, 2.5, FOAM);
  }
  if (role === 1) { demoFinger(ox + b.x * k + 14, oy + b.y * k + 22, spray, spray ? ((u - .3) * 1.5) % 1 : 0); badge(spray ? 'SQUIRT!' : 'HOLD TO SQUIRT', 130, 30, 18, '#2b9ee6', '#fff', 1, -.03); }
  else {
    const sw = u > 1.3 && u < 2.7; X.lineWidth = 5; X.strokeStyle = 'rgba(255,255,255,.8)'; X.beginPath(); X.arc(ox + PX * k, oy + PY * k - 4, 30, Math.PI * 1.05, Math.PI * 1.95); X.stroke();
    demoFinger(ox + PX * k + Math.cos(th) * 36, oy + PY * k + Math.sin(th) * 36, sw, 0); badge(sw ? 'WIPE!' : hp > 0 ? 'WAIT FOR THE WATER' : 'SQUEAKY!', 130, 30, 18, sw || hp <= 0 ? '#22a447' : '#2b9ee6', '#fff', 1, -.03);
  }
  X.restore();
}
DUO.INFO.du_squeegee = [['WIPER', 'SWING THE WIPER OVER WET GUNK', 'CIRCLE THE HUB / A D'], ['SPRAYER', 'WET THE GUNK FIRST', 'AIM + HOLD TO SQUIRT']];
DUO.DEMOS.du_squeegee = [t => demo(0, t), t => demo(1, t)];

})();
