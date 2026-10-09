'use strict';
/* ═════════ DUO · LAZY FROG (du_frog), after Twisted's rotating table + a sleepy frog ═════════
   A fat sleepy frog sits in the middle of a round lily pad ("lazy Susan") covered with flies, a golden fly and, landing in between, ladybugs
   (the frog is allergic). The frog can only flick its tongue inside a front arc, and the tongue needs ~0.2 s to arrive.
   SPINNER (role 0): turns the pad: drag in circles around it (the pad follows the pointer; let go and it coasts with inertia and friction)
   or A / D / arrows to spin it either way, Space / S / down to brake. Only the spinner can move the flies.
   TONGUE (role 1, JUDGE): aims the frog (pointer / arrows) and flicks the tongue (click, tap, Space). The tongue eats the first thing on its
   line when it arrives, so a moving pad must be slowed down or led. Fly +1, golden fly +2, ladybug = a strike (3 strikes = sick frog).
   Information through the world: the spinner does not see where the tongue wants to go, only the glowing marker the frog's eyes throw on the
   pad (its colour says what is under the line: green fly, gold fly, red ladybug). The tongue player owns the aim and the timing, the spinner owns
   the speed and the angle: if either does nothing the team cannot eat a single fly.
   Netcode: the SPINNER owns the pad: 'pad' [angle×1000 mod 2π, omega×100] (coalesced, ≤10/s). The TONGUE (judge) renders the pad ~lag behind
   (extrapolated with omega), owns the aim 'aim' [angle×1000, gate] (coalesced, ≤10/s) and the flicks: 'fl' [angle×1000] when it starts, 'eat'
   [item id, kind 0 miss / 1 fly / 2 gold / 3 ladybug, points, strikes] when it lands (resolved on the judge's own view, so what the judge saw is
   what counts). Screens never wait for each other; every message is idempotent. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2, PI = Math.PI;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = a => { a %= TAU; if (a > PI) a -= TAU; else if (a < -PI) a += TAU; return a; };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MC = new Map();
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right LEAVE and y>552) ───────────── */
const CX = 400, CY = 290, RP = 200, SQ = .66, RIM = 16;   // the pad: centre, radius, squash (3/4 view), thickness
const AC = PI / 2, AH = .96;                              // the tongue arc: straight at the viewer ± 55°
const MOUTH = [CX, 248];                                  // where the tongue leaves the frog
const REACH = [62, 192], HW = 27;                         // the tongue catches things 62..192 px out, ≤ HW from its line
const T_EXT = .2, T_HOLD = .24, T_END = .44;              // flick timeline (s): out, lands at 0.2, back at 0.44
const LAND = .38;                                         // a ladybug falls for this long before it can be eaten
const MAXS = 3;                                           // strikes
const HZ = 126;                                           // the far bank meets the water
const proj = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a) * SQ];

/* palette */
const WA1 = '#62d3f0', WA2 = '#2a8fcb';
const PADC = '#58c866', PADS = '#2f9a50', PADL = '#8be38a', PADD = '#237a45';
const FR = '#4fc66a', FR2 = '#2f9a4b', FRL = '#a4f08c', BELLY = '#e4f7a8', SICK = '#c7d94a', SICK2 = '#8c9c30';
const TONG = '#ff6f91', TONG2 = '#d8406c';
const WOOD = '#d9944f', WOOD2 = '#a5622c', WOODL = '#f2b878';
const GOLD = '#ffd23f', LADY = '#e8434f';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
/* cel shading: path builder fn(ox, oy) drawn as shade, then the base colour on top shifted by (-sx, -sy): the shade stays as a crescent */
function cel(fn, base, shade, sx, sy, o = 4) { fn(0, 0); ink(shade, o); X.save(); fn(0, 0); X.clip(); fn(-sx, -sy); X.fillStyle = base; X.fill(); X.restore(); }
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
/* two thin blocky arms from caos()'s side stubs (drawn before caos()); an = angle (0 = up), k = 0..1 raised */
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
const handOf = (bx, by, u, sx, an, k) => { const d = 3.3 * u * k + .35 * u + u; return [bx + sx * 6.6 * u + d * Math.sin(an), by - 5.2 * u - d * Math.cos(an)]; };
function sweat(x, y, T, k) { const a = (T * 1.4 + k) % 1; X.globalAlpha = 1 - a * a; X.beginPath(); X.moveTo(x, y - 8 + a * 14); X.quadraticCurveTo(x + 6, y + 2 + a * 14, x, y + 7 + a * 14); X.quadraticCurveTo(x - 6, y + 2 + a * 14, x, y - 8 + a * 14); ink('#9fe3ff', 2); X.globalAlpha = 1; }
function zee(x, y, T, k) { const a = (T * .8 + k) % 1; X.globalAlpha = Math.sin(a * PI); txt('Z', x + a * 26 + Math.sin(a * 6) * 4, y - a * 50, 22 + a * 18 + k * 6, '#fff'); X.globalAlpha = 1; }
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}

/* ───────────── the bugs: x, y = where it touches the pad; s = size ───────────── */
function fly(x, y, s, T, ph, gold, wingsOn = true) {
  const h = 13 + Math.sin(T * 5 + ph) * 3, wx = Math.sin(T * 3.1 + ph) * 4, wy = Math.cos(T * 2.3 + ph) * 2;
  X.fillStyle = 'rgba(20,16,28,.25)'; el(x + wx, y + 2, 9 * s, 4 * s); X.fill();
  X.save(); X.translate(x + wx, y - h * s + wy); X.scale(s, s);
  if (gold) { const g = 1 + Math.sin(T * 6 + ph) * .1; X.fillStyle = 'rgba(255,230,120,.28)'; X.beginPath(); X.arc(0, 0, 21 * g, 0, TAU); X.fill(); X.fillStyle = 'rgba(255,240,170,.35)'; X.beginPath(); X.arc(0, 0, 14 * g, 0, TAU); X.fill(); }
  const fl = wingsOn ? Math.sin(T * 60 + ph) : .6;
  for (const sx of [-1, 1]) { X.save(); X.translate(sx * 5, -4); X.rotate(sx * (.7 + fl * .22)); el(0, -7, 5.2, 9 + fl * 1.5); ink(gold ? 'rgba(255,248,200,.92)' : 'rgba(225,246,255,.88)', 1.6); X.restore(); }
  el(0, 1, 6.6, 8.2); ink(gold ? GOLD : '#3a3550', 2.5);
  X.fillStyle = gold ? '#fff3a0' : 'rgba(255,255,255,.45)'; el(-2.2, -2.4, 2.4, 3.4, -.4); X.fill();
  X.fillStyle = gold ? '#e8a912' : '#262238'; X.fillRect(-5, 3, 10, 1.8);
  el(0, -8.4, 4.8, 4.2); ink(gold ? '#ffe477' : '#4a4562', 2);
  X.fillStyle = '#ff4d5e'; X.beginPath(); X.arc(-2.5, -9.2, 1.7, 0, TAU); X.arc(2.5, -9.2, 1.7, 0, TAU); X.fill();
  if (gold) { star(-12 + Math.sin(T * 7) * 3, -12, 3.5, 1.2, 4, T * 4, '#fff', 0); star(13, 5 + Math.cos(T * 6) * 3, 3, 1, 4, -T * 5, '#fff', 0); }
  X.restore();
}
function lady(x, y, s, T, ph, fall) {                    // fall 0..1 = how far down it still is (shadow grows while it drops)
  const hop = fall > 0 ? 0 : Math.max(0, Math.sin(T * 3 + ph)) ** 6 * 3;
  X.fillStyle = 'rgba(20,16,28,.28)'; el(x, y + 2, (7 + (1 - fall) * 3) * s, (3.4 + (1 - fall)) * s); X.fill();
  X.save(); X.translate(x, y - 6 * s - hop - fall * 80); X.scale(s, s); if (fall > 0) X.rotate(fall * 2.4);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const lg = Math.sin(T * 14 + i * 2 + ph) * 1.4; line([[sx * 6, 2 + i * 2.6], [sx * 11, 4 + i * 2.6 + lg]], 3.2, INK); }
  for (const sx of [-1, 1]) line([[sx * 2, -10], [sx * 6, -15 + Math.sin(T * 9 + ph) * 1]], 2.6, INK);
  el(0, -8, 4.6, 3.6); ink('#2b2640', 2);
  X.beginPath(); X.ellipse(0, 0, 10.5, 9, 0, 0, TAU); ink(LADY, 2.8);
  X.save(); X.beginPath(); X.ellipse(0, 0, 10.5, 9, 0, 0, TAU); X.clip();
  X.fillStyle = '#b0283a'; X.beginPath(); X.ellipse(4, 4, 10, 8, 0, 0, TAU); X.fill();
  X.fillStyle = LADY; X.beginPath(); X.ellipse(0, 0, 10, 8.4, 0, 0, TAU); X.fill();
  X.fillStyle = INK; X.fillRect(-.9, -9, 1.8, 18);
  for (const [dx, dy, r] of [[-5, -3, 2.1], [5, -3, 2.1], [-5.5, 3.5, 1.8], [5.5, 3.5, 1.8], [0, 6.2, 1.4]]) { X.beginPath(); X.arc(dx, dy, r, 0, TAU); X.fill(); }
  X.fillStyle = 'rgba(255,255,255,.65)'; el(-4.6, -5.6, 3, 1.6, -.5); X.fill(); X.restore();
  X.fillStyle = '#fff'; X.beginPath(); X.arc(-2, -9, 1.2, 0, TAU); X.arc(2, -9, 1.2, 0, TAU); X.fill();
  X.restore();
}

/* ───────────── the frog (front view, sitting). x,y = bottom centre. o: look (aim angle), lid 0..1 closed, mouth 0..1, sick 0..1, happy, sleep, sq (squash), gulp, T ───────────── */
function frog(x, y, o) {
  const T = o.T, sick = o.sick || 0, C = mix(FR, SICK, sick), C2 = mix(FR2, SICK2, sick), CL = mix(FRL, '#e6f08a', sick), B = mix(BELLY, '#f2f2a8', sick);
  const br = Math.sin(T * 2.1) * .018, sq = o.sq || 0;
  X.save(); X.translate(x, y); X.scale((1 + sq * -.06 + br) * .88, (1 + sq * .08 - br) * .88);
  if (o.sleep) X.rotate(.05);
  // hind legs: fat folded thighs and flat feet
  for (const sx of [-1, 1]) {
    X.save(); X.translate(sx * 52, -14); X.rotate(sx * .3);
    cel((ox, oy) => el(ox, oy, 27, 21), C, C2, sx * 6, 6, 4.5);
    X.fillStyle = 'rgba(255,255,255,.3)'; el(-sx * 6, -9, 10, 4, -sx * .4); X.fill(); X.restore();
    for (let i = 0; i < 3; i++) { el(sx * (70 + i * 9) - sx * 6, 1 - i * 1.5, 9, 5.2, sx * .15); ink(C2, 3); }
  }
  // body and belly
  cel((ox, oy) => el(ox, oy - 38, 56, 44), C, C2, 8, 8, 5);
  el(0, -30, 35, 29); ink(B, 3.5);
  if (o.gulp > 0) { X.fillStyle = 'rgba(255,255,255,.4)'; el(0, -44 + o.gulp * 14, 10, 8); X.fill(); }
  X.fillStyle = C2; for (const [dx, dy, r] of [[-38, -52, 4.5], [30, -58, 5.5], [42, -40, 3.6], [-26, -64, 3.4]]) { X.beginPath(); X.arc(dx, dy, r, 0, TAU); X.fill(); }
  // front arms hugging the belly
  for (const sx of [-1, 1]) { X.save(); X.translate(sx * 34, -14); X.rotate(sx * -.28); el(0, 0, 9, 18); ink(C, 3.5); for (let i = -1; i <= 1; i++) { el(i * 5, 17, 3.3, 4.6); ink(C2, 2); } X.restore(); }
  // head (wide, a little tilted towards the aim)
  X.save(); X.translate(0, -64); X.rotate(o.sleep ? .1 : Math.cos(o.look) * .05);
  cel((ox, oy) => el(ox, oy, 66, 40), C, C2, 6, 7, 5);
  X.fillStyle = 'rgba(255,255,255,.28)'; el(-22, -20, 22, 6, -.2); X.fill();
  // eye bumps
  for (const sx of [-1, 1]) {
    const ex = sx * 38, ey = -34, r = 20;
    cel((ox, oy) => el(ex + ox, ey + oy, r, r - 1), C, C2, sx * 3, 3, 4.5);
    el(ex, ey - 1, 14, 14.5); ink('#fff', 2.5);
    X.save(); el(ex, ey - 1, 14, 14.5); X.clip();
    const px = ex + Math.cos(o.look) * 5.4 * (o.cross ? -sx * .4 : 1), py = ey + 3 + Math.sin(o.look) * 2;
    if (o.sick > .9 && !o.happy) {                                  // dizzy spirals
      X.strokeStyle = INK; X.lineWidth = 2.2; X.beginPath(); for (let i = 0; i < 40; i++) { const a = i * .5 + T * 6, rr2 = i * .3; X.lineTo(ex + Math.cos(a) * rr2, ey - 1 + Math.sin(a) * rr2); } X.stroke();
    } else if (!o.happy) {
      const pr = o.wide ? 4.6 : 6;
      X.fillStyle = INK; X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(px - 1.8, py - 2, 1.9, 0, TAU); X.fill();
    }
    if (!o.happy && !(o.sick > .9)) {                               // eyelid: skin colour sliding down from the top
      const lid = clamp(o.lid + (o.blink || 0), 0, 1);
      if (lid > .01) { X.fillStyle = C; X.fillRect(ex - 16, ey - 17, 32, 31 * lid); X.strokeStyle = INK; X.lineWidth = 3.4; X.beginPath(); X.moveTo(ex - 15, ey - 16 + 31 * lid); X.lineTo(ex + 15, ey - 16 + 31 * lid); X.stroke(); }
    }
    X.restore();
    if (o.happy) { X.strokeStyle = INK; X.lineWidth = 4.4; X.lineCap = 'round'; X.beginPath(); X.arc(ex, ey + 4, 9, PI * 1.12, PI * 1.88); X.stroke(); }
    X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();                      // brow
    if (o.sick > .3) { X.moveTo(ex - sx * 14, ey - 14 - 2); X.lineTo(ex + sx * 12, ey - 20 + 4); } else if (o.wide) { X.moveTo(ex - 12, ey - 24); X.lineTo(ex + 12, ey - 25); } else { X.moveTo(ex - 11, ey - 22 + (1 - o.lid) * -2); X.lineTo(ex + 11, ey - 22 + (1 - o.lid) * -2); }
    if (!o.sleep && o.lid < .95) X.stroke(); else X.beginPath();
  }
  // nostrils, cheeks
  X.fillStyle = INK; X.beginPath(); X.arc(-7, -8, 2.2, 0, TAU); X.arc(7, -8, 2.2, 0, TAU); X.fill();
  X.fillStyle = 'rgba(255,110,150,.5)'; el(-46, 4, 10, 6); X.fill(); el(46, 4, 10, 6); X.fill();
  // mouth: a wide smile; opens into a dark cave with the tongue root
  const mo = clamp(o.mouth || 0, 0, 1), sad = sick > .5 && !o.happy;
  if (mo > .05) {
    X.beginPath(); X.moveTo(-34, 8); X.quadraticCurveTo(0, 8 + 8 * (o.happy ? 1 : .2) + mo * 30, 34, 8); X.quadraticCurveTo(0, 6, -34, 8); X.closePath(); ink('#6a1d34', 3.5);
    X.save(); X.clip(); X.fillStyle = TONG; el(0, 22 + mo * 4, 18, 9); X.fill(); X.restore();
  } else {
    X.strokeStyle = INK; X.lineWidth = 4.4; X.lineCap = 'round'; X.beginPath();
    if (o.sleep) { X.moveTo(-14, 11); X.quadraticCurveTo(0, 15, 14, 11); }
    else if (sad) { X.moveTo(-26, 13); X.quadraticCurveTo(-12, 3, 0, 8); X.quadraticCurveTo(12, 13, 26, 5); }
    else { X.moveTo(-36, 6); X.quadraticCurveTo(0, 18 + (o.happy ? 6 : 0), 36, 6); }
    X.stroke();
  }
  X.restore();
  X.restore();
}

/* ───────────── a small clapping frog on a side pad (the audience) ───────────── */
function fan(x, y, T, k, look, clap, mood, col) {
  X.save(); X.translate(x, y); const hop = clap ? Math.abs(Math.sin(T * 10 + k)) * 4 : 0; X.translate(0, -hop);
  el(0, -14, 24, 18); ink(col, 3.5); el(0, -10, 14, 11); ink(BELLY, 2);
  el(0, -36, 28, 17); ink(col, 3.5);
  for (const sx of [-1, 1]) {
    el(sx * 16, -48, 10, 10); ink(col, 3); el(sx * 16, -48, 6.4, 6.6); ink('#fff', 2);
    if (mood === 'sleep') { X.strokeStyle = INK; X.lineWidth = 2.6; X.beginPath(); X.moveTo(sx * 16 - 5, -47); X.lineTo(sx * 16 + 5, -47); X.stroke(); }
    else if (mood === 'cheer') { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(sx * 16, -45, 5, PI * 1.1, PI * 1.9); X.stroke(); }
    else { X.fillStyle = INK; X.beginPath(); X.arc(sx * 16 + clamp(look[0] / 180, -1, 1) * 2.4, -47 + clamp(look[1] / 140, -1, 1) * 1.6, 3, 0, TAU); X.fill(); }
  }
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath();
  if (mood === 'gasp') { X.fill(); el(0, -30, 4, 5); ink('#6a1d34', 2); } else { X.moveTo(-10, -31); X.quadraticCurveTo(0, mood === 'sad' ? -33 : -26, 10, -31); X.stroke(); }
  const cl = clap ? Math.sin(T * 16 + k) * .5 + .5 : 0;                                        // arms: two hands that meet in front when clapping
  for (const sx of [-1, 1]) { X.save(); X.translate(sx * 20, -20); X.rotate(sx * (-.2 - (clap ? (1 - cl) * .7 : 0)) - (mood === 'gasp' ? sx * .8 : 0)); el(0, 0, 5.4, 12); ink(col, 3); X.restore(); }
  if (clap && cl > .85) star(0, -20, 6, 2, 5, T * 3, '#fff6a0', 1.5);
  X.restore();
}

/* ───────────── the dragonfly photobomber ───────────── */
function dragonfly(x, y, T, sc, flash) {
  X.save(); X.translate(x, y); X.scale(sc, sc);
  const fl = Math.sin(T * 38);
  for (const [wx, rot] of [[-4, -.35], [10, -.1]]) { X.save(); X.translate(wx, -6); X.rotate(rot - fl * .22); el(0, -12, 5.4, 17 + fl * 3); ink('rgba(210,245,255,.82)', 1.8); X.restore(); }
  for (let i = 0; i < 5; i++) { el(-14 - i * 11, Math.sin(T * 4 + i) * 1.5, 6.5 - i * .4, 4.2); ink(i % 2 ? '#2fb3a5' : '#ff7a3d', 2); }
  el(0, 0, 13, 9); ink('#2fb3a5', 3); X.fillStyle = 'rgba(255,255,255,.4)'; el(-3, -4, 6, 2.4); X.fill();
  X.beginPath(); X.arc(16, -1, 10.5, 0, TAU); ink('#2fb3a5', 3);
  for (const sy of [-1, 1]) { el(19, -1 + sy * 5.4, 6.6, 6.2); ink('#fff', 2); X.fillStyle = INK; X.beginPath(); X.arc(21, -1 + sy * 5.4 + 1, 3, 0, TAU); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 2.4; X.beginPath(); X.moveTo(24, 4); X.quadraticCurveTo(21, 9, 17, 6); X.stroke();
  if (flash) { star(30, -14, 10 + flash * 8, 3, 4, T * 2, '#fff', 1.5); }
  X.restore();
}

/* ───────────── the static scene, painted once into an offscreen canvas ───────────── */
const SPADS = [[92, 392], [708, 392]];                    // the side pads with the clapping frogs
let BG = null, PADSPR = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(0, 0, W, HZ);
  // far hills and lollipop trees on the bank
  X.beginPath(); X.moveTo(0, HZ); X.lineTo(0, 92); X.bezierCurveTo(120, 56, 230, 112, 360, 84); X.bezierCurveTo(480, 58, 600, 112, 800, 76); X.lineTo(800, HZ); X.closePath(); X.fillStyle = '#a9dfc6'; X.fill();
  X.beginPath(); X.moveTo(0, HZ); X.lineTo(0, 108); X.bezierCurveTo(100, 90, 200, 120, 330, 104); X.bezierCurveTo(460, 90, 560, 122, 700, 100); X.bezierCurveTo(740, 96, 770, 98, 800, 100); X.lineTo(800, HZ); X.closePath(); X.fillStyle = '#87d19b'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#4f9a6a'; X.stroke();
  for (const [tx, ty, tr] of [[60, 106, 20], [150, 110, 16], [640, 104, 18], [740, 108, 22], [700, 112, 14]]) { X.fillStyle = '#8a5a34'; X.fillRect(tx - 3, ty, 6, 20); X.beginPath(); X.arc(tx, ty - 4, tr, 0, TAU); ink('#3fb260', 3); X.fillStyle = 'rgba(255,255,255,.22)'; el(tx - tr * .35, ty - tr * .5, tr * .4, tr * .22, -.5); X.fill(); }
  // bank strip + the hard horizon
  g = X.createLinearGradient(0, HZ - 14, 0, HZ); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(0, HZ - 14, W, 14);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, HZ); X.lineTo(W, HZ); X.stroke();
  // water
  g = X.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, WA1); g.addColorStop(1, WA2); X.fillStyle = g; X.fillRect(0, HZ + 2, W, H - HZ);
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 9; i++) { el(70 + i * 92 + (i % 2) * 30, HZ + 40 + (i * 53) % 400, 34, 4); X.fill(); }
  X.strokeStyle = 'rgba(255,255,255,.4)'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 7; i++) { const rx = 40 + i * 120, ry = HZ + 70 + (i * 97) % 380; X.beginPath(); X.moveTo(rx, ry); X.quadraticCurveTo(rx + 12, ry - 5, rx + 24, ry); X.quadraticCurveTo(rx + 36, ry + 5, rx + 48, ry); X.stroke(); }
  // reeds and cattails at the sides
  const reed = (rx, ry, h, lean) => { for (let i = -1; i <= 1; i++) { const tx = rx + i * 9 + lean * (i + 2), ty = ry - h * (1 - Math.abs(i) * .22); line([[rx + i * 6, ry], [tx, ty]], 5, '#2f9a4b'); if (i !== 1) { el(tx, ty - 2, 6, 15, lean * .02); ink('#8a5a34', 3); } } };
  reed(30, 250, 118, 4); reed(60, 232, 100, 6); reed(772, 252, 120, -4); reed(744, 232, 96, -6);
  // the pad: soft shadow on the water, the thick green rim and the dark top ring (the spinning top is drawn live)
  X.fillStyle = 'rgba(10,60,100,.3)'; el(CX, CY + RIM + 18, RP + 18, (RP + 18) * SQ); X.fill();
  el(CX, CY + RIM, RP, RP * SQ); ink(PADD, 5);
  X.fillStyle = 'rgba(255,255,255,.14)'; el(CX - 60, CY + RIM + 4, 90, 4, 0); X.fill();
  X.fillStyle = PADD; X.fillRect(CX - RP - 4, CY, 8, RIM);
  el(CX, CY, RP, RP * SQ); ink(PADS, 5);
  // the two side pads of the audience
  for (const [sx, sy] of SPADS) { X.fillStyle = 'rgba(10,60,100,.28)'; el(sx, sy + 14, 62, 22); X.fill(); el(sx, sy + 8, 56, 19); ink(PADD, 4); el(sx, sy, 56, 19); ink(PADC, 4); X.strokeStyle = PADS; X.lineWidth = 2.4; for (let i = 0; i < 6; i++) { const a = i * 1.05 + .3; X.beginPath(); X.moveTo(sx + Math.cos(a) * 12, sy + Math.sin(a) * 4); X.lineTo(sx + Math.cos(a) * 46, sy + Math.sin(a) * 15); X.stroke(); } }
  // two wooden docks at the bottom corners (the players' places)
  for (const dx of [8, 592]) {
    rr(dx, 494, 200, 44, 8); ink(WOOD2, 4); rr(dx, 490, 200, 30, 8); ink(WOOD, 4);
    X.strokeStyle = '#c98443'; X.lineWidth = 2.4; for (let i = 1; i < 5; i++) { X.beginPath(); X.moveTo(dx + i * 40, 492); X.lineTo(dx + i * 40, 518); X.stroke(); }
    X.fillStyle = WOODL; X.fillRect(dx + 8, 494, 184, 3);
    for (const px of [dx + 14, dx + 186]) { rr(px - 7, 500, 14, 50, 4); ink(WOOD2, 3); }
  }
  X = old; return cv2;
}
/* the spinning top of the pad, drawn flat and rotated/squashed live. The notch + sectors + dots make the spin readable */
function buildPad() {
  const S = RP * 2 + 8, cv2 = document.createElement('canvas'); cv2.width = S; cv2.height = S; const old = X; X = cv2.getContext('2d'); X.translate(S / 2, S / 2);
  const R0 = RP - 5;
  X.beginPath(); X.arc(0, 0, R0, 0, TAU); X.fillStyle = PADC; X.fill();
  for (let i = 0; i < 12; i++) if (i % 2) { X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, R0, i * TAU / 12, (i + 1) * TAU / 12); X.closePath(); X.fillStyle = 'rgba(255,255,255,.1)'; X.fill(); }
  X.strokeStyle = PADS; X.lineWidth = 3.4; X.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; X.beginPath(); X.moveTo(Math.cos(a) * 44, Math.sin(a) * 44); X.lineTo(Math.cos(a) * (R0 - 14), Math.sin(a) * (R0 - 14)); X.stroke(); }
  X.lineWidth = 4; X.beginPath(); X.arc(0, 0, 92, 0, TAU); X.stroke(); X.setLineDash([2, 17]); X.lineWidth = 6; X.strokeStyle = '#f6f3b0'; X.beginPath(); X.arc(0, 0, R0 - 10, 0, TAU); X.stroke(); X.setLineDash([]);
  X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, R0, PI - .13, PI + .13); X.closePath(); X.fillStyle = WA2; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke();
  for (const a of [1.0, 3.9, 5.3]) {                                              // pink lotus buds
    X.save(); X.translate(Math.cos(a) * 178, Math.sin(a) * 178); X.rotate(a);
    for (const pa of [-.8, -.4, 0, .4, .8]) { X.save(); X.rotate(pa); el(0, -7, 4.2, 8); ink(pa === 0 ? '#ff8fb3' : '#ffc2d6', 1.8); X.restore(); }
    X.beginPath(); X.arc(0, 0, 3.4, 0, TAU); ink(GOLD, 1.6); X.restore();
  }
  X = old; return cv2;
}
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;   // cosmetic randomness: its own generator, never the seeded one
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* the shared world drawing: pad (spinning), frog, tongue... all take the state they need so the intro demos can reuse them */
function drawPad(padA) {
  if (!PADSPR) PADSPR = buildPad();
  X.save(); X.translate(CX, CY); X.scale(1, SQ); X.rotate(padA); X.drawImage(PADSPR, -RP - 4, -RP - 4); X.restore();
  X.save(); el(CX, CY, RP - 3, (RP - 3) * SQ); X.clip();                          // one fixed light and shade over the spinning top
  X.fillStyle = 'rgba(20,70,45,.2)'; X.beginPath(); X.ellipse(CX, CY, RP, RP * SQ, 0, 0, TAU); X.ellipse(CX - 16, CY - 11, RP - 4, (RP - 4) * SQ, 0, 0, TAU); X.fill('evenodd');
  X.fillStyle = 'rgba(255,255,255,.2)'; el(CX - 74, CY - 66, 70, 11, -.35); X.fill(); X.restore();
}
/* the tongue's reach: a pale fan on the pad in front of the frog */
function reachFan(T, on) {
  X.save(); el(CX, CY, RP - 4, (RP - 4) * SQ); X.clip();
  X.beginPath(); X.moveTo(CX, CY); for (let i = 0; i <= 18; i++) { const a = AC - AH + i / 18 * 2 * AH, [px, py] = proj(RP, a); X.lineTo(px, py); } X.closePath();
  X.fillStyle = `rgba(255,255,255,${on ? .12 + Math.sin(T * 5) * .02 : .08})`; X.fill();
  X.lineWidth = 3; X.setLineDash([9, 9]); X.lineDashOffset = -T * 14; X.strokeStyle = 'rgba(255,255,255,.55)'; X.beginPath(); for (const a of [AC - AH, AC + AH]) { const [px, py] = proj(RP, a); X.moveTo(CX, CY); X.lineTo(px, py); } X.stroke(); X.setLineDash([]); X.restore();
}
/* the glow the frog's eyes throw on the pad: its colour says what is on the line (0 nothing, 1 fly, 2 gold, 3 ladybug) */
function marker(th, gate, T, eyes) {
  const col = gate === 3 ? '#ff4d5e' : gate === 2 ? '#ffd23f' : gate === 1 ? '#5CFF7A' : '#f3f7a8', [mx, my] = proj(168, th), pl = 1 + Math.sin(T * (gate === 3 ? 18 : 7)) * .08;
  X.save(); X.setLineDash([3, 9]); X.lineWidth = 3.2; X.lineCap = 'round'; X.strokeStyle = col; X.globalAlpha = .55; X.beginPath(); X.moveTo(eyes[0], eyes[1]); X.lineTo(mx, my); X.stroke(); X.setLineDash([]);
  X.globalAlpha = .22; X.fillStyle = col; X.beginPath(); X.ellipse(mx, my, 34 * pl, 34 * SQ * pl, 0, 0, TAU); X.fill(); X.globalAlpha = .35; X.beginPath(); X.ellipse(mx, my, 22 * pl, 22 * SQ * pl, 0, 0, TAU); X.fill(); X.globalAlpha = 1;
  X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.ellipse(mx, my, 16 * pl, 16 * SQ * pl, 0, 0, TAU); X.stroke(); X.lineWidth = 4.2; X.strokeStyle = col; X.stroke();
  X.fillStyle = '#fff'; X.beginPath(); X.ellipse(mx, my, 3.4, 3.4 * SQ, 0, 0, TAU); X.fill();
  if (gate === 3) txt('!', mx, my - 26, 26, '#ff4d5e');
  X.restore();
}
/* the tongue: fl = { th, kind } and a = seconds since the flick. returns the tip so a prey can ride on it */
function tongueTip(fl, a) {
  if (!fl || a < 0 || a > T_END) return null;
  const k = a < T_EXT ? 1 - (1 - a / T_EXT) ** 2 : a < T_HOLD ? 1 : 1 - ease((a - T_HOLD) / (T_END - T_HOLD));
  const [ex, ey] = proj(REACH[1] - 10, fl.th);
  return { k, x: MOUTH[0] + (ex - MOUTH[0]) * k, y: MOUTH[1] + (ey - 12 - MOUTH[1]) * k };
}
function tongue(tip, T) {
  if (!tip || tip.k < .02) return;
  const pts = [], dx = tip.x - MOUTH[0], dy = tip.y - MOUTH[1], nl = Math.hypot(dx, dy) || 1, nx = -dy / nl, ny = dx / nl;
  for (let i = 0; i <= 18; i++) { const q = i / 18, bow = Math.sin(q * PI) * 16 * (1 - tip.k * .4) + Math.sin(q * 11 - T * 24) * 2.4 * q; pts.push([MOUTH[0] + dx * q + nx * bow * .4, MOUTH[1] + dy * q + 8 * Math.sin(q * PI) * tip.k + ny * bow * .4]); }
  line(pts, 22, INK); line(pts, 14, TONG); line(pts.map(([a, b]) => [a - 2, b - 3]), 4, 'rgba(255,255,255,.45)'); line(pts, 3, TONG2);
  const [tx, ty] = pts[pts.length - 1]; X.beginPath(); X.arc(tx, ty, 13, 0, TAU); ink(TONG, 3.5); X.fillStyle = 'rgba(255,255,255,.55)'; el(tx - 4, ty - 5, 4.4, 2.8, -.5); X.fill();
}

/* ═════════ the game ═════════ */
function duFrog(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), spin = D.role === 0, TS = Math.sqrt(sp);
  const need = sp > 1.3 ? 7 : 6;
  /* the level: same on both screens. Pad-frame angle a0 + pad angle = where it is on the screen. Flies start outside the tongue arc, so nothing can be eaten before the pad turns. */
  const items = [], goldI = 2 + Math.floor(R() * 6), NG = 10;
  for (let i = 0; i < NG; i++) {
    const a0 = 3.22 + i / NG * 2.9 + (R() - .5) * .12, r = (i % 2 ? 110 : 152) + (R() - .5) * 20;
    items.push({ id: i, a0, r, type: i === goldI ? 1 : 0, ph: R() * TAU, app: 0, eaten: false });
  }
  const LT = [1.6, 4.0, 6.4, 8.8], clear = (a, r) => items.every(q => Math.hypot(q.r * Math.cos(q.a0) - r * Math.cos(a), q.r * Math.sin(q.a0) - r * Math.sin(a)) > 40);
  for (let j = 0; j < 5; j++) {                                 // ladybugs: one is there from the start, the rest land in between (4 s escalation)
    let best = null;
    for (let tr = 0; tr < 8; tr++) { const a = R() * TAU, r = 105 + R() * 62, ok = clear(a, r); if (!best || (!best.ok && ok)) best = { a, r, ok }; }
    items.push({ id: NG + j, a0: best.a, r: best.r, type: 2, ph: R() * TAU, app: j ? LT[j - 1] / TS : 0, eaten: false });
  }
  const landed = it => g.c >= it.app + (it.app > 0 ? LAND : 0), live = it => !it.eaten && landed(it);
  const alpha = it => it.a0 + padA;
  /* state */
  let padA = 0, omega = 0, grab = false, lastAng = 0, grabD = 0, kL = 0, kR = 0, kBrake = false, padSent = -9, lastPad = '', fN = FOCUSN;   // spinner: owns the pad
  let rcA = 0, rcW = 0, rcT = 0;                              // judge: the spinner's last report (unwrapped), padA eases to it
  let aim = AC, tAim = AC, kAim = 0, aimSent = -9, lastAim = '', coolUntil = 0, fl = null;   // tongue: owns the aim
  let pts = 0, strikes = 0, ending = null, endAt = -1, sickV = 0, gate = 0, gulpAt = -9, slotT = [], strikeT = [];
  const aimTr = track(); let gateSeen = 0;
  const bits = [], pops = [], rip = [], fans = [{ clapUntil: -9, gasp: -9 }, { clapUntil: -9, gasp: -9 }];
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, vr: 0, rot: 0, k: 0, vx: 0, vy: 0 }, o)); }
  const gateOf = (th, pa) => {                                   // the first thing on the tongue line (what the marker's colour says)
    let best = null, bd = 1e9;
    for (const it of items) { if (!live(it)) continue; const a = it.a0 + pa, px = it.r * Math.cos(a), py = it.r * Math.sin(a), ux = Math.cos(th), uy = Math.sin(th), along = px * ux + py * uy, perp = Math.abs(px * uy - py * ux); if (along > REACH[0] && along < REACH[1] && perp < HW && along < bd) { bd = along; best = it; } }
    return best;
  };
  function clapFans(sec) { for (const f of fans) f.clapUntil = g.c + sec; }
  function slotMark(n) { while (slotT.length < Math.min(n, 9)) slotT.push(g.c); }
  function eatFx(kind, id, np, ns) {                                // what everyone sees when the tongue lands (id = the prey, -1 for a miss)
    const it = items[id], pos = it ? proj(it.r, alpha(it)) : proj(150, fl ? fl.th : AC);
    if (it && !it.eaten) { it.eaten = true; it.eatAt = g.c; }
    if (fl) { fl.kind = kind; fl.item = id; fl.done = true; fl.pos = pos; }
    if (np > pts) { pts = np; slotMark(pts); }
    if (ns > strikes) { while (strikeT.length < ns) strikeT.push(g.c); strikes = ns; }
    if (kind === 1 || kind === 2) {
      gulpAt = g.c; sfx.coin(); if (kind === 2) sfx.sparkle(); burst(pos[0], pos[1] - 10, kind === 2 ? '#FFE14D' : '#fff', kind === 2 ? 14 : 8); clapFans(1.3);
      pop(kind === 2 ? 'GOLDEN!' : 'YUM!', 400, 146, kind === 2 ? 28 : 26, kind === 2 ? '#e8a912' : '#22a447', '#fff');
    } else if (kind === 3) {
      sfx.buzz(); sfx.splat(); shake(6, .2); burst(pos[0], pos[1] - 10, '#7fd34a', 12); pop('EWW!', 400, 146, 28, '#7fa22b', '#fff'); for (const f of fans) f.gasp = g.c;
      for (let i = 0; i < 5; i++) bit({ x: MOUTH[0] + (cr() - .5) * 30, y: MOUTH[1] + 10, vx: (cr() - .5) * 200, vy: -(60 + cr() * 120), r: 4 + cr() * 3, c: '#9bd34a', life: .6 });
    } else { noise(.14, .05, 700, 200, 'bandpass'); pop('MISS!', 400, 146, 24, '#7a7596', '#fff'); }
  }
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: spin ? 'SPIN!' : 'FLICK!', roleLabel: spin ? 'SPINNER' : 'TONGUE',
    hint: spin ? 'DRAG IN CIRCLES AROUND THE PAD (OR A / D, SPACE TO BRAKE) - STOP A FLY WHERE THE FROG\'S EYES GLOW, NO LADYBUGS!' : 'AIM WITH THE MOUSE (OR ◄ ►), CLICK / SPACE TO FLICK THE TONGUE - FLIES YES, LADYBUGS NO! YOUR FRIEND SPINS THE PAD',
    thint: spin ? 'DRAG IN CIRCLES TO SPIN THE PAD - STOP A FLY WHERE THE FROG\'S EYES GLOW, NO LADYBUGS!' : 'DRAG TO AIM, TAP TO FLICK THE TONGUE - FLIES YES, LADYBUGS NO! YOUR FRIEND SPINS THE PAD',
    update(dt) {
      g.c += dt;
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; grab = false; kL = kR = 0; kBrake = false; kAim = 0; }
      const won = pts >= need || g.result === 'win', lost = strikes >= MAXS || g.result === 'lose';
      if ((won || lost) && endAt < 0) endAt = g.c;
      const done = !!(g.result || ending);
      if (spin) {
        if (grab) { const wm = grabD / Math.max(dt, 1e-3); omega += (clamp(wm, -9, 9) - omega) * Math.min(1, dt * 16); }
        else {
          const acc = kR - kL; omega += acc * 8 * dt;
          const fr = kBrake ? 9 : acc ? .5 : 1.5; omega *= Math.exp(-fr * dt); omega = clamp(omega, -5.5, 5.5); padA += omega * dt;
          if (Math.abs(omega) < .01 && !acc) omega = 0;
        }
        grabD = 0;
        const s = Math.round(wrap(padA) * 1000) + ',' + Math.round(omega * 100);
        if (s !== lastPad && g.c - padSent >= .1) { lastPad = s; padSent = g.c; D.send('pad', [Math.round(wrap(padA) * 1000), Math.round(omega * 100)], true); }
        if (Math.abs(omega) > 2.6 && cr() < dt * 9) rip.push({ x: CX + (cr() - .5) * 340, y: CY + RIM + (cr() * .6 + .7) * RP * SQ * .9, t0: g.c });
      } else {
        const age = Math.min(g.c - rcT, .35), tgt = rcA + rcW * age;
        padA += wrap(tgt - padA) * Math.min(1, dt * 14); omega = rcW;
        if (kAim) tAim = clamp(tAim + kAim * 2.5 * dt, AC - AH, AC + AH);
        aim += (tAim - aim) * Math.min(1, dt * 22);
        const gi = gateOf(aim, padA); gate = gi ? gi.type + 1 : 0;
        const s = Math.round(aim * 100) + ',' + gate;
        if (s !== lastAim && g.c - aimSent >= .1) { lastAim = s; aimSent = g.c; D.send('aim', [Math.round(aim * 1000), gate], true); }
        if (fl && !fl.done && g.c >= fl.t0 + T_EXT) {                // the tongue lands: what is on its line right now?
          const it = gateOf(fl.th, padA), kind = it ? it.type + 1 : 0;
          const np = pts + (kind === 1 || kind === 2 ? kind : 0), ns = strikes + (kind === 3 ? 1 : 0);
          eatFx(kind, it ? it.id : -1, np, ns);
          D.send('eat', [it ? it.id : -1, kind, np, ns]);
          coolUntil = fl.t0 + (kind === 3 ? 1.05 : kind ? .5 : .62);
          if (!ending && !g.result) { if (pts >= need) ending = { res: 'win', at: g.c + .45 }; else if (strikes >= MAXS) ending = { res: 'lose', at: g.c + .45 }; }
        }
        if (!g.result) { if (ending && g.c >= Math.min(ending.at, g.limit)) g.finish(ending.res); else if (!ending && g.c >= g.limit) g.finish('lose'); }
      }
      if (fl && g.c - fl.t0 > T_END + .05) fl = null;
      g.pts = pts;
      sickV += (Math.min(1, strikes / MAXS) - sickV) * Math.min(1, dt * 5);
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = rip.length - 1; i >= 0; i--) if (g.c - rip[i].t0 > 1.2) rip.splice(i, 1);
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      if (done && !spin) { /* the judge keeps animating through the outro */ }
    },
    msg(type, d) {
      if (spin) {
        if (type === 'aim' && Array.isArray(d)) { aimTr.push(d[0] / 1000); gateSeen = d[1]; }
        else if (type === 'fl' && Array.isArray(d)) { if (!fl || g.c - fl.t0 > .3) { fl = { t0: g.c, th: d[0] / 1000, done: false, kind: 0, item: -1 }; sfx.whoosh(true); } }
        else if (type === 'eat' && Array.isArray(d)) { if (!fl) fl = { t0: g.c - T_EXT, th: aimTr.at(0) || AC, done: false, kind: 0, item: -1 }; if (!fl.done) eatFx(d[1], d[0], d[2], d[3]); else { if (d[2] > pts) { pts = d[2]; slotMark(pts); } if (d[3] > strikes) strikes = d[3]; } }
      } else if (type === 'pad' && Array.isArray(d)) {
        const a = d[0] / 1000; rcA = rcA + wrap(a - rcA); rcW = d[1] / 100; rcT = g.c;
      }
    },
    flick() {                                                       // tongue
      if (spin || g.result || ending || g.c < .15 || fl || g.c < coolUntil) return;
      fl = { t0: g.c, th: aim, done: false, kind: 0, item: -1 }; D.send('fl', [Math.round(aim * 1000)]); sfx.whoosh(true);
    },
    aimAt(p) { tAim = clamp(Math.atan2((p.y - CY) / SQ, p.x - CX), AC - AH, AC + AH); },
    draw(t) {
      const T = g.c, won = pts >= need || g.result === 'win', lost = strikes >= MAXS || g.result === 'lose', rk = endAt >= 0 ? T - endAt : -1;
      X = ctx; if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      const sleepy = lost && strikes < MAXS;
      scene(T, won, lost, rk);
      vignette(.16);
    },
    down(p) {
      if (spin) { if (g.result) return; const dx = p.x - CX, dy = (p.y - CY) / SQ; if (Math.hypot(dx, dy) < 22) return; grab = true; lastAng = Math.atan2(dy, dx); }
      else { g.aimAt(p); aim = tAim; g.flick(); }
    },
    move(p) {
      if (spin) { if (!grab) return; const a = Math.atan2((p.y - CY) / SQ, p.x - CX), d = clamp(wrap(a - lastAng), -.9, .9); lastAng = a; if (!g.result) { padA += d; grabD += d; } }
      else g.aimAt(p);
    },
    up() { grab = false; },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (spin) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') kL = 1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kR = 1;
        else if (e.code === 'Space' || e.code === 'KeyS' || e.code === 'ArrowDown') kBrake = true;
      } else {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') kAim = 1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kAim = -1;
        else if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW')) g.flick();
      }
    },
    keyup(e) {
      if (spin) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kL = 0; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kR = 0; else if (e.code === 'Space' || e.code === 'KeyS' || e.code === 'ArrowDown') kBrake = false; }
      else if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && kAim > 0) kAim = 0; else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && kAim < 0) kAim = 0;
    },
  };
  /* what is drawn this frame: back to front. Spinner and tongue see the same world; only the aim comes through the marker */
  function scene(T, won, lost, rk) {
    const aimS = spin ? (aimTr.at() === null ? AC : aimTr.at()) : aim, gateS = spin ? gateSeen : gate;
    const tip0 = fl ? tongueTip(fl, T - fl.t0) : null, out = !!tip0;
    // sky: drifting clouds
    for (let i = 0; i < 3; i++) { const cx = ((T * (5 + i * 2.6) + i * 290) % 1000) - 140, cy = 28 + i * 24 + (i % 2) * 8; for (const [dx, dy, r] of [[0, 0, 20], [22, -8, 17], [44, 0, 19], [22, 6, 15]]) { X.beginPath(); X.arc(cx + dx, cy + dy, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); } X.fillStyle = '#fff'; el(cx + 12, cy - 6, 14, 6, -.3); X.fill(); }
    // water ripples (ambient + from the spinning pad)
    X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const k = (T * .35 + i / 4) % 1, rx = [140, 650, 300, 560][i], ry = [470, 480, 540, 520][i]; X.globalAlpha = (1 - k) * .6; el(rx, ry, 10 + k * 38, (10 + k * 38) * .32); X.stroke(); }
    for (const r of rip) { const k = (T - r.t0) / 1.2; X.globalAlpha = (1 - k) * .7; el(r.x, r.y, 8 + k * 50, (8 + k * 50) * .32); X.stroke(); } X.globalAlpha = 1;
    // the audience on the side pads: they watch the marker, clap on every fly, gasp on a ladybug
    SPADS.forEach(([sx, sy], i) => {
      const f = fans[i], mk = proj(168, aimS), clap = T < f.clapUntil && !lost, mood = won ? 'cheer' : lost ? (strikes >= MAXS ? 'sad' : 'sleep') : T - f.gasp < .9 ? 'gasp' : null;
      fan(sx, sy + 2, T, i * 1.7, [mk[0] - sx, mk[1] - sy], clap || won, mood, i ? '#6fd58a' : '#58c06f');
      if (won) { heart(sx + (i ? -24 : 24), sy - 76 - Math.abs(Math.sin(T * 6 + i)) * 10, .8); }
    });
    // dragonfly photobomber: strolls over the far bank; on a win it stops for a selfie
    { const dxp = ((T * 46 + 120) % 1000) - 100, dyp = HZ + 4 + Math.sin(T * 1.7) * 9;
      if (won && rk >= 0) { const k = ease(clamp(rk / .5, 0, 1)); dragonfly(lerp(dxp, 640, k), lerp(dyp, 206, k), T, 1.05, rk > .35 ? 1 : 0); } else dragonfly(dxp, dyp, T, 1); }
    // the pad
    const bob = won && rk >= 0 ? 0 : 0;
    drawPad(padA); reachFan(T, !!tip0 || (!spin && !lost));
    // things on the pad: back half first, then the frog, then the front half
    const lst = items.filter(it => !it.eaten && T >= it.app).map(it => ({ it, a: alpha(it) })).sort((p, q) => Math.sin(p.a) * p.it.r - Math.sin(q.a) * q.it.r);
    const drawIt = ({ it, a }) => {
      const [x, y] = proj(it.r, a), fallK = it.app > 0 && T < it.app + LAND ? clamp(1 - (T - it.app) / LAND, 0, 1) : 0;
      if (it.type === 2) { lady(x, y, 1.45, T, it.ph, fallK); if (fallK === 0 && T - it.app - LAND < .25 && it.app > 0) { X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 3; X.globalAlpha = 1 - (T - it.app - LAND) / .25; el(x, y, 8 + (T - it.app - LAND) * 90, (8 + (T - it.app - LAND) * 90) * SQ); X.stroke(); X.globalAlpha = 1; } }
      else fly(x, y, it.type ? 1.75 : 1.4, T, it.ph, !!it.type);
    };
    for (const e of lst) if (Math.sin(e.a) < 0) drawIt(e);
    // the frog
    const eyes = [CX, 214];
    const gulp = T - gulpAt < .3 ? Math.sin((T - gulpAt) / .3 * PI) : 0;
    const sickShown = lost && strikes >= MAXS ? 1 : sickV;
    const lid = won ? 0 : lost && strikes < MAXS ? 1 : clamp(.5 - (gateS ? .38 : 0) - (out ? .4 : 0), 0, 1) * (1 - sickShown * .4) + (rk >= 0 && lost ? 0 : 0);
    const blink = Math.sin(T * 1.9) > .985 ? .6 : 0;
    const burp = won && rk >= 0 ? clamp(rk / .25, 0, 1) : 0;
    const lift = won && rk >= 0 ? ease(clamp((rk - .1) / .7, 0, 1)) * 26 + Math.sin(T * 5) * 3 * ease(clamp(rk / .5, 0, 1)) : 0;
    shadow(CX, CY + 36, 74 - lift * .6, 12, .22 - lift * .003);
    const mouthO = won && rk >= 0 ? burp : out ? (tip0.k > .05 ? 1 : 0) : (lost && sickShown > .9 ? .5 : 0);
    const sq = out ? 1 - Math.abs(tip0.k - .5) : 0;
    frog(CX, CY + 20 - lift, { T, look: aimS, lid, blink, mouth: mouthO, sick: sickShown, happy: won, sleep: lost && strikes < MAXS, wide: !!gateS && gateS < 3 || (out && tip0.k > .1), sq, gulp, cross: false });
    if (lost && strikes < MAXS) { zee(CX + 52, CY - 70, T, 0); zee(CX + 52, CY - 70, T, .5); }
    if (sickShown > .5 && !won) { for (let i = 0; i < 3; i++) { const a = (T * .9 + i / 3) % 1; X.globalAlpha = 1 - a; line([[CX - 90 + i * 90, CY - 90 - a * 20], [CX - 80 + i * 90 + Math.sin(a * 9) * 4, CY - 112 - a * 26]], 5, '#7fd34a'); X.globalAlpha = 1; } }
    for (const e of lst) if (Math.sin(e.a) >= 0) drawIt(e);
    // the marker (what the spinner reads) and the tongue
    if (!won && !(lost)) marker(aimS, gateS, T, eyes);
    if (tip0) {
      tongue(tip0, T);
      if (fl.done && fl.kind > 0 && T - fl.t0 > T_HOLD - .02) { const it = items[fl.item]; if (it) { X.save(); if (it.type === 2) lady(tip0.x, tip0.y + 22, 1.5, T, it.ph, 0); else fly(tip0.x, tip0.y + 20, it.type ? 1.75 : 1.4, T, it.ph, !!it.type, false); X.restore(); } }
    }
    if (won && rk >= 0) rainbow(rk, T);
    people(T, won, lost, tip0);
    hud(T, won, lost, rk);
    for (const b of bits) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c || '#fff', 2); X.globalAlpha = 1; }
    for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 18, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
    if (lost && rk >= 0 && strikes >= MAXS && rk > .1) badge('BLEEEH!', 470, 330 + 0, 28, '#7fa22b', '#fff', outBack((rk - .1) / .2), -.07);
    if (lost && rk >= 0 && strikes < MAXS && rk > .1) badge('ZZZ...', 560, 215, 28, '#6a5acd', '#fff', outBack((rk - .1) / .2), .06);
    if (T < 3.4 && !g.result) badge(spin ? (TOUCH ? 'DRAG IN CIRCLES' : 'DRAG IN CIRCLES / A D') : (TOUCH ? 'TAP TO FLICK' : 'AIM + CLICK / SPACE'), spin ? 262 : 520, 488, 16, spin ? '#2b9ee6' : '#22a447', '#fff', 1, spin ? -.04 : .04);
  }
  function rainbow(rk, T) {
    const k = ease(clamp(rk / .55, 0, 1)); if (k <= 0) return;
    for (let b = 0; b < 6; b++) {
      const pts2 = []; for (let i = 0; i <= 28; i++) { const q = i / 28 * k, x = MOUTH[0] + 8 + (730 - MOUTH[0]) * q, y = MOUTH[1] + 4 + (-170 * Math.sin(q * PI) + 70 * q * q) * 1 + b * 7; pts2.push([x, y + Math.sin(q * 20 - T * 8) * 2]); }
      line(pts2, b === 0 ? 11 : 9, b === 0 ? INK : `hsl(${b * 52},95%,58%)`);
    }
    for (let b = 1; b < 6; b++) {
      const pts2 = []; for (let i = 0; i <= 28; i++) { const q = i / 28 * k, x = MOUTH[0] + 8 + (730 - MOUTH[0]) * q, y = MOUTH[1] + 4 + (-170 * Math.sin(q * PI) + 70 * q * q) + b * 7; pts2.push([x, y + Math.sin(q * 20 - T * 8) * 2]); }
      line(pts2, 8, `hsl(${(b - 1) * 52},95%,58%)`);
    }
    if (rk > .15) badge('BURRRP!', 560, 150, 30, '#ff5c8a', '#fff', outBack((rk - .15) / .2), -.06);
    for (let i = 0; i < 4; i++) { const a = (T * 1.6 + i / 4) % 1; star(CX - 70 + i * 46, CY + 6 - a * 60, 7, 2.6, 4, T * 3 + i, '#fff6a0', 1.5); }
  }
  /* the two players on their docks: the spinner pushes the pad with a pole, the tongue holds a joystick */
  function people(T, won, lost, tip0) {
    const sCol = spin ? myCol() : pCol(), tCol = spin ? pCol() : myCol(), mood = won ? 'happy' : lost ? 'sad' : null;
    const fast = clamp(Math.abs(omega) / 3, 0, 1), jump = won ? Math.abs(Math.sin(T * 9)) * 10 : 0;
    // spinner (left dock)
    { const bx = 104, by = 502 - jump, u = 4.4, an = .95 + Math.sin(padA * 3) * .12 * fast + (won ? .5 : 0), hand = handOf(bx, by, u, 1, an, .9), tipP = [236 + Math.sin(padA * 5) * 5, 368];
      shadow(bx, by + 2, 36, 8, .22);
      X.save(); X.translate(bx, by); arm(u, 1, an, .9, sCol); arm(u, -1, -.5 - fast * .4 + (won ? -.6 : 0), .7, sCol); X.restore();
      caos(bx, by, u, { col: sCol, mood });
      if (!won) { line([[hand[0] - (tipP[0] - hand[0]) * .12, hand[1] - (tipP[1] - hand[1]) * .12], tipP], 11, INK); line([[hand[0] - (tipP[0] - hand[0]) * .12, hand[1] - (tipP[1] - hand[1]) * .12], tipP], 5.5, '#d9a066'); el(tipP[0], tipP[1], 9, 5.4); ink('#4db8ff', 2.5); }
      if (fast > .6 && !won) sweat(bx + 28, by - 46, T, 0);
      pill(bx, by - 62 - jump * 0, spin ? 'YOU' : 'YOUR FRIEND', sCol); }
    // tongue player (right dock)
    { const bx = 744, by = 502 - jump, u = 4.4, tilt = clamp((aim - AC) / AH, -1, 1), top = [700 - tilt * 15, 462], handP = handOf(bx, by, u, -1, -1.15, .85);
      shadow(bx, by + 2, 36, 8, .22);
      X.save(); X.translate(bx, by); arm(u, -1, -1.15 + (won ? -.7 : 0), .85, tCol); arm(u, 1, .5 + (won ? .6 : 0), .6, tCol); X.restore();
      caos(bx, by, u, { col: tCol, mood });
      rr(656, 486, 82, 26, 6); ink(WOOD2, 3.5); rr(656, 484, 82, 18, 6); ink(WOOD, 3.5); X.fillStyle = WOODL; X.fillRect(662, 487, 70, 3);
      const pr = tip0 || (fl && T - fl.t0 < T_END) ? 1 : 0;
      if (!won) { line([[700, 486], top], 9, INK); line([[700, 486], top], 4.5, '#cfd8e6'); X.beginPath(); X.arc(top[0], top[1], 11, 0, TAU); ink('#ff4d5e', 3); X.fillStyle = 'rgba(255,255,255,.55)'; el(top[0] - 3, top[1] - 4, 3.6, 2.4, -.5); X.fill(); }
      X.beginPath(); X.arc(672, 494, 5.4 - pr, 0, TAU); ink(pr ? '#fff' : '#5CFF7A', 2.2);
      if (sickV > .4 && !won) sweat(bx - 28, by - 46, T, .4);
      pill(Math.min(bx, 708), by - 62, spin ? 'YOUR FRIEND' : 'YOU', tCol); }
  }
  /* the sign hanging over the pond: one fly slot per point needed, ladybug marks for the strikes */
  function hud(T, won, lost, rk) {
    const x0 = 196, w = 408;
    X.strokeStyle = '#e6c58c'; X.lineWidth = 3; X.beginPath(); X.moveTo(x0 + 40, 56); X.lineTo(x0 + 52, 70); X.moveTo(x0 + w - 40, 56); X.lineTo(x0 + w - 52, 70); X.stroke();
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(x0 + 4, 74, w, 46, 14); X.fill();
    rr(x0, 66, w, 48, 14); ink(WOOD2, 4); rr(x0, 66, w, 42, 14); ink(WOOD, 4); X.strokeStyle = '#c98443'; X.lineWidth = 2.2; X.beginPath(); X.moveTo(x0 + 14, 78); X.lineTo(x0 + w - 14, 78); X.stroke();
    txt('FLIES', x0 + 56, 90, 20, '#fff', 'center', 86);
    const n = need, sx = x0 + 128, step = Math.min(34, 214 / n);
    for (let i = 0; i < n; i++) {
      const cx = sx + i * step, on = i < pts, k = on ? outBack((T - (slotT[i] === undefined ? -9 : slotT[i])) / .3) : 1;
      X.save(); X.translate(cx, 89); X.scale(k, k);
      if (on) { fly(0, 12, .85, T, i, items.some(q => q.type === 1 && q.eaten) && i === pts - 1 && pts > 1 && false); } else { el(0, 0, 11, 11); ink('#7b4f26', 2); X.fillStyle = 'rgba(20,16,28,.28)'; X.fill(); }
      X.restore();
    }
    for (let i = 0; i < MAXS; i++) {
      const cx = x0 + w - 84 + i * 30, on = i < strikes, k = on ? outBack((T - (strikeT[i] === undefined ? -9 : strikeT[i])) / .3) : 1;
      X.save(); X.translate(cx, 89); X.scale(k, k);
      if (on) { lady(0, 11, .9, T, i, 0); } else { el(0, 0, 11, 11); ink('#7b4f26', 2); X.fillStyle = 'rgba(20,16,28,.28)'; X.fill(); X.strokeStyle = 'rgba(255,255,255,.25)'; X.lineWidth = 2; X.beginPath(); X.moveTo(-5, -5); X.lineTo(5, 5); X.moveTo(5, -5); X.lineTo(-5, 5); X.stroke(); }
      X.restore();
    }
  }
  g.dbg = {
    need, MAXS, AC, AH,
    /* what the TONGUE screen shows: the flies and ladybugs where they really are (padA is the pad as I see it), my aim, whether my tongue is out/tired */
    tongView: () => ({ items: items.filter(it => !it.eaten && g.c >= it.app).map(it => ({ i: it.id, a: alpha(it), r: it.r, type: it.type, t: Math.max(0, it.app + (it.app > 0 ? LAND : 0) - g.c) })), aim, cd: Math.max(0, coolUntil - g.c), busy: !!fl, w: omega, pts, strikes, need }),
    /* what the SPINNER screen shows: the same bugs on my own pad, the pad speed, the glowing marker (aim + colour) as it arrives, whether the tongue is out */
    spinView: () => ({ items: items.filter(it => !it.eaten && g.c >= it.app).map(it => ({ i: it.id, a: alpha(it), r: it.r, type: it.type, t: Math.max(0, it.app + (it.app > 0 ? LAND : 0) - g.c) })), pad: padA, w: omega, aim: aimTr.at() === null ? AC : aimTr.at(), gate: gateSeen, out: !!fl && g.c - fl.t0 < T_END + .08, pts, strikes, need }),
    pts: () => pts, strikes: () => strikes,
  };
  wire(g, D, 1, sp, 'du_frog');
  return g;
}
reg('du_frog', duFrog, 'LAZY FROG'); REGMAP.du_frog.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 4 s loop ───────────── */
function demo(role, t) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, WA1); gr.addColorStop(1, WA2); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  const u = t % 4;
  X.save(); X.translate(260, 112); X.scale(.74, .74); X.translate(-CX, -CY);
  X.fillStyle = 'rgba(10,60,100,.3)'; el(CX, CY + RIM + 18, RP + 18, (RP + 18) * SQ); X.fill(); el(CX, CY + RIM, RP, RP * SQ); ink(PADD, 5); el(CX, CY, RP, RP * SQ); ink(PADS, 5);
  const spinK = ease(clamp(u / 1.9, 0, 1)) * (1 - ease(clamp((u - 3.3) / .7, 0, 1)));
  const pa = role === 0 ? -2.0 * spinK : 0;
  drawPad(pa); reachFan(t, true);
  const flick = role === 1 ? clamp((u - 2.2) / 1.4, 0, 1) : 0, fa = flick * T_END;
  const th = role === 1 ? AC + .3 - (1 - ease(clamp(u / 2, 0, 1))) * .8 : AC, hitT = role === 1 && fa > T_EXT;
  const bugs = role === 0 ? [[3.5, 150, 0], [4.2, 112, 0], [5.2, 150, 1], [2.7, 150, 2]] : [[AC + .3, 150, 0], [AC - .75, 120, 2], [AC + 1.3, 110, 0]];
  const dr = bugs.map(([a0, r, ty]) => ({ a: a0 + pa, r, ty, a0 })).sort((a, b) => Math.sin(a.a) * a.r - Math.sin(b.a) * b.r);
  const putBug = q => { const [x, y] = proj(q.r, q.a); if (q.ty === 2) lady(x, y, 1.5, t, q.a0, 0); else if (!(hitT && q.a0 === AC + .3)) fly(x, y, q.ty ? 1.75 : 1.5, t, q.a0, q.ty === 1); };
  for (const q of dr) if (Math.sin(q.a) < 0) putBug(q);
  const out = role === 1 && fa > 0 && fa < T_END;
  frog(CX, CY + 20, { T: t, look: th, lid: out ? 0 : .4, mouth: out ? 1 : 0, sick: 0, wide: out, sq: 0, gulp: 0 });
  for (const q of dr) if (Math.sin(q.a) >= 0) putBug(q);
  const gate = role === 0 ? (Math.abs(wrap(3.5 + pa - AC)) < .3 ? 1 : 0) : 1;
  marker(role === 0 ? AC : th, gate, t, [CX, 214]);
  if (out) { const tip = tongueTip({ th }, fa); tongue(tip, t); if (hitT) fly(tip.x, tip.y + 20, 1.5, t, 1, false, false); }
  X.restore();
  if (role === 0) { const fang = 2.3 + pa; demoFinger(260 + Math.cos(fang) * 140, 112 + Math.sin(fang) * 92 + 14, u < 2, (u * 2) % 1); badge('DRAG IN CIRCLES', 260, 28, 18, '#2b9ee6', '#fff', 1, -.03); }
  else { const [px, py] = proj(190, th); demoFinger(260 + (px - CX) * .74, 112 + (py - CY) * .74 + 14, fa > 0 && fa < .12, fa * 8); badge(flick > 0 ? 'FLICK!' : 'AIM', 260, 28, 18, '#22a447', '#fff', 1, -.03); }
}
DUO.INFO.du_frog = [['SPINNER', 'TURN THE LILY PAD', 'DRAG IN CIRCLES / A D'], ['TONGUE', 'AIM + FLICK AT FLIES', 'MOUSE + CLICK / SPACE']];
DUO.DEMOS.du_frog = [t => demo(0, t), t => demo(1, t)];

})();
