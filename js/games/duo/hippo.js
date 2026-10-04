'use strict';
/* ═════════ DUO · FEED THE HIPPO (du_hippo) ═════════
   FEEDER (role 0): wears X-ray goggles, so it sees what is inside every paper bag on the conveyor. Tosses the waiting bag
   (tap / click / Space) and can stick a skull sign on it first (the WARN button, or W) when there is trash inside.
   HIPPO (role 1, JUDGE): only sees "?" bags and the skull signs. Hold to open the mouth, let go to shut it.
   Food + open = CHOMP (+1) · food + shut = BONK · trash + open = sick (the 3rd one = it throws up, the team loses) · trash + shut = NOPE (safe).
   Eat 6 before the time runs out. A bag that waits too long tosses itself.
   Netcode: a toss is ONE event 'toss {id, w}'. The hippo starts that flight when the event arrives and judges it with its own mouth
   (it is the last actor, so what it sees is what counts), then sends 'eat {id, res, n, k}'. On the feeder's screen the bag waits at
   the lips until that answer arrives. 'warn {id, on}' moves the sign on the waiting bag, 'm' is the mouth (0/1, coalesced). */
(function () {
const { clamp, mkR, wire, track, demoFinger, duWin, duLose } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right LEAVE and y>552) ───────────── */
const SLOTX = 262, BELTY = 326, SPB = 78;            // the waiting bag sits at SLOTX on the belt, bags are SPB apart
const JX = 690, JY = 410, HS = .94;                  // the hippo's jaw hinge + its scale
const MX = JX - 150 * HS, MY = JY - 52 * HS;         // where a bag ends its flight (between the lips)
const SX = SLOTX, SY = BELTY - 30, FC = [356, 130];   // a lob: up and over the feeder's raised hands, down into the mouth (stays under the scoreboard)
const CLX = 352, CLY = 338;                          // the feeder (Claude) stands on a crate at the end of the belt
const WARN_B = [22, 446, 176, 96], TOSS_B = [214, 446, 176, 96], HOLD_B = [22, 446, 368, 96];
const WATER = 458;
const fpos = k => { const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; return [a * SX + b * FC[0] + c * MX, a * SY + b * FC[1] + c * MY]; };
/* the feeder's WARN zone is forgiving (a thumb that lands near the skull must never toss an unwarned bag): the whole lower-left corner */
const inWarn = p => (p.x < 206 && p.y > 420) || (p.x >= WARN_B[0] - 24 && p.x <= WARN_B[0] + WARN_B[2] + 8 && p.y >= WARN_B[1] - 24 && p.y <= WARN_B[1] + WARN_B[3] + 24);

/* palette */
const KR = '#e3ac66', KR2 = '#b98042', KRL = '#f7d297';                    // kraft paper
const HIP = '#a48fdc', HIP2 = '#7a63b9';                                   // hippo lavender
/* hand-picked skin per tummy-ache level (no RGB blending: lavender -> green through grey looks dead): base, shade, light */
const PAL = [['#a48fdc', '#7a63b9', '#cdbdf5'], ['#a48fdc', '#7a63b9', '#cdbdf5'], ['#9cc98a', '#5f9a5e', '#d3edc2'], ['#8fd14f', '#4f8f2a', '#cdf29a']];
const BLOT = [null, '#a9dc7c', '#7fb86a', '#6cb43a'];                       // green blotches on the snout / cheeks
const GUM = '#e2577c', THROAT = '#6e1838', TONGUE = '#ff92ad', TOOTH = '#fffbea';
const XRAY = '#9ff3ff';
const WK = .62;                                                             // size of the skull sign on a bag in the air

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
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}

/* ───────────── what can be inside a bag ───────────── */
function burger() {
  rr(-21, 6, 42, 11, 5); ink('#f2a444', 3);
  rr(-24, -3, 48, 11, 5); ink('#7b4527', 3);
  X.beginPath(); X.moveTo(-24, -6); X.lineTo(24, -6); X.lineTo(24, -1); X.lineTo(13, 7); X.lineTo(7, -1); X.lineTo(-8, 6); X.lineTo(-14, -1); X.lineTo(-24, -1); X.closePath(); ink('#ffd23f', 3);
  X.beginPath(); X.moveTo(-25, -10); for (let i = 0; i <= 10; i++) X.lineTo(-25 + i * 5, -6 + (i % 2 ? 4 : 0)); X.lineTo(25, -12); X.closePath(); ink('#71d64b', 3);
  X.beginPath(); X.moveTo(-23, -10); X.bezierCurveTo(-23, -34, 23, -34, 23, -10); X.closePath(); ink('#f5ae48', 3);
  X.fillStyle = '#ffd590'; el(-9, -22, 7, 3, -.4); X.fill();
  X.fillStyle = '#fff4d8'; for (const [a, b] of [[-11, -15], [0, -23], [9, -16], [3, -14], [-3, -18]]) { el(a, b, 2.4, 1.4, .4); X.fill(); }
}
function cake() {
  X.beginPath(); X.moveTo(-24, 14); X.lineTo(24, 14); X.lineTo(24, -6); X.lineTo(-24, 2); X.closePath(); ink('#ffe08a', 3);
  X.fillStyle = '#fff'; X.beginPath(); X.moveTo(-24, 7); X.lineTo(24, 4); X.lineTo(24, 7); X.lineTo(-24, 10); X.fill();
  X.fillStyle = '#ff5f9e'; X.beginPath(); X.moveTo(-24, -1); X.lineTo(24, -9); X.lineTo(24, -5); X.lineTo(-24, 3); X.fill();
  X.beginPath(); X.moveTo(-26, 2); X.lineTo(26, -8); X.lineTo(24, -14); X.lineTo(-24, -4); X.closePath(); ink('#ff8fc4', 3);
  X.beginPath(); X.arc(8, -13, 3.5, 0, Math.PI); X.arc(-6, -10, 3, 0, Math.PI); ink('#ff8fc4', 0);
  X.beginPath(); X.moveTo(6, -22); X.quadraticCurveTo(10, -32, 16, -34); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
  X.beginPath(); X.arc(5, -18, 7, 0, TAU); ink('#ff2f4f', 3); X.fillStyle = '#ffb3c0'; el(3, -20, 2.2, 1.6); X.fill();
}
function melon() {
  X.beginPath(); X.moveTo(-26, -8); X.arc(0, -8, 26, Math.PI, 0, true); X.closePath(); ink('#3fa34d', 3);
  X.beginPath(); X.moveTo(-21, -8); X.arc(0, -8, 21, Math.PI, 0, true); X.closePath(); X.fillStyle = '#c9f59a'; X.fill();
  X.beginPath(); X.moveTo(-18, -8); X.arc(0, -8, 18, Math.PI, 0, true); X.closePath(); X.fillStyle = '#ff4d6d'; X.fill();
  X.fillStyle = '#ff8aa0'; X.fillRect(-18, -9, 36, 3);
  X.fillStyle = INK; for (const [a, b] of [[-9, -1], [0, 3], [9, -1], [-4, -5], [5, -5]]) { el(a, b, 1.8, 2.8); X.fill(); }
}
function donut() {
  X.beginPath(); X.arc(0, -4, 22, 0, TAU); X.arc(0, -4, 7, 0, TAU, true); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#e9b26a'; X.fill('evenodd');
  X.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, r = 18 + (i % 2 ? 2.5 : 0); X.lineTo(Math.cos(a) * r, -6 + Math.sin(a) * r); } X.arc(0, -6, 8.5, 0, TAU, true); X.fillStyle = '#ff7cbc'; X.fill('evenodd');
  const sc = ['#fff', '#5cd2ff', '#ffe14d', '#6fe07a']; for (let i = 0; i < 9; i++) { const a = i * 2.2 + .4, r = 13; X.save(); X.translate(Math.cos(a) * r, -6 + Math.sin(a) * r); X.rotate(a * 2); X.fillStyle = sc[i % 4]; X.fillRect(-3, -1, 6, 2.4); X.restore(); }
}
function boot() {
  X.save(); X.rotate(-.12);
  X.beginPath(); X.moveTo(-14, -28); X.lineTo(6, -28); X.lineTo(6, -2); X.quadraticCurveTo(24, -2, 27, 8); X.lineTo(27, 13); X.lineTo(-16, 13); X.lineTo(-16, -2); X.closePath(); ink('#8a6440', 3);
  X.fillStyle = '#6d4c2f'; X.fillRect(-14, -28, 20, 6);
  rr(-17, 9, 45, 7, 3); ink('#3b2a22', 3);
  X.strokeStyle = '#e9d8b0'; X.lineWidth = 2.4; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(-1, -18 + i * 6); X.lineTo(6, -16 + i * 6); X.stroke(); }
  rr(-12, -10, 9, 8, 2); ink('#b8a07a', 2); X.restore();
}
function fishbone() {
  X.save(); X.rotate(-.08);
  X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(-12, -4); X.lineTo(20, -4); X.stroke();
  X.strokeStyle = '#eef4f7'; X.lineWidth = 3.5; X.beginPath(); X.moveTo(-12, -4); X.lineTo(20, -4); X.stroke();
  for (let i = 0; i < 4; i++) { const x = -6 + i * 7; X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(x, -14); X.quadraticCurveTo(x + 3, -4, x, 6); X.stroke(); X.strokeStyle = '#eef4f7'; X.lineWidth = 2.6; X.stroke(); }
  X.beginPath(); X.moveTo(18, -4); X.lineTo(28, -14); X.lineTo(27, 6); X.closePath(); ink('#dfe8ee', 3);
  X.beginPath(); X.moveTo(-12, -16); X.quadraticCurveTo(-30, -14, -29, -4); X.quadraticCurveTo(-29, 7, -12, 8); X.closePath(); ink('#eef4f7', 3);
  X.strokeStyle = INK; X.lineWidth = 2.6; X.beginPath(); X.moveTo(-23, -9); X.lineTo(-18, -4); X.moveTo(-18, -9); X.lineTo(-23, -4); X.stroke(); X.restore();
}
function clock() {
  X.save(); X.rotate(.15);
  for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 11, -19, 7, Math.PI, 0); X.closePath(); ink('#c9ced6', 3); }
  X.strokeStyle = INK; X.lineWidth = 4; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 9, 10); X.lineTo(s * 14, 17); X.stroke(); }
  X.beginPath(); X.arc(0, -2, 17, 0, TAU); ink('#ff5a4f', 3);
  X.beginPath(); X.arc(0, -2, 11.5, 0, TAU); ink('#fffaf0', 2);
  X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(0, -2); X.lineTo(0, -10); X.moveTo(0, -2); X.lineTo(6, 1); X.stroke();
  X.strokeStyle = '#7a8090'; X.lineWidth = 2; X.beginPath(); X.moveTo(-5, -12); X.lineTo(-2, -6); X.lineTo(-6, -1); X.stroke();
  X.strokeStyle = INK; X.lineWidth = 2.4; X.beginPath(); X.moveTo(15, -4); for (let i = 0; i < 4; i++) X.lineTo(19 + i * 3, -9 + (i % 2) * 7); X.stroke(); X.restore();
}
function tincan() {
  X.save(); X.rotate(-.1);
  rr(-15, -20, 30, 34, 4); ink('#b7c0ca', 3);
  X.fillStyle = '#d98a5a'; X.fillRect(-15, -12, 30, 14); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-11, -19, 5, 32);
  X.fillStyle = INK; X.fillRect(-15, -12, 30, 2); X.fillRect(-15, 1, 30, 2);
  X.beginPath(); X.ellipse(0, -20, 15, 5, 0, 0, TAU); ink('#8d97a3', 3);
  X.beginPath(); X.moveTo(-2, -22); X.lineTo(10, -36); X.lineTo(16, -30); X.lineTo(6, -20); X.closePath(); ink('#c6ced8', 3);
  X.strokeStyle = 'rgba(20,16,28,.4)'; X.lineWidth = 2; X.beginPath(); X.moveTo(8, -4); X.lineTo(14, 2); X.stroke(); X.restore();
}
const FOODS = [burger, cake, melon, donut], TRASH = [boot, fishbone, clock, tincan];
const CRUMB = [['#f5ae48', '#71d64b', '#7b4527'], ['#ff8fc4', '#ffe08a', '#ff2f4f'], ['#ff4d6d', '#3fa34d', '#c9f59a'], ['#e9b26a', '#ff7cbc', '#5cd2ff']];
function item(trash, v) { X.save(); X.lineJoin = 'round'; X.lineCap = 'round'; (trash ? TRASH : FOODS)[v](); X.restore(); }

/* the skull warning sign on a stick */
function skull(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s);
  X.beginPath(); X.arc(0, -3, 11, 0, TAU); rr(-7, 2, 14, 9, 3); ink(null, 2.5);
  X.fillStyle = '#fff'; X.beginPath(); X.arc(0, -3, 11, 0, TAU); X.fill(); rr(-7, 2, 14, 9, 3); X.fill();
  X.fillStyle = INK; el(-4.5, -3, 3.4, 3.8); X.fill(); el(4.5, -3, 3.4, 3.8); X.fill();
  X.beginPath(); X.moveTo(0, 2); X.lineTo(-2, 5); X.lineTo(2, 5); X.fill(); X.fillRect(-3.5, 8, 1.6, 3); X.fillRect(1.9, 8, 1.6, 3);
  X.restore();
}
function sign(k, wob) {                               // in bag space: bag bottom at 0
  if (k <= 0) return;
  X.save(); X.translate(0, -48); X.scale(k, k); X.rotate(wob);
  rr(-3.5, -38, 7, 40, 3); ink('#9a6838', 3);
  rr(-27, -76, 54, 40, 9); ink('#ff4d5e', 4); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(-23, -72, 46, 6);
  skull(0, -56, 1.15); X.restore();
}
/* a paper bag: bottom-centre at (x, y). xray: see-through with the content in colour (the feeder's view) */
const BAGP = 'M-28 0 L28 0 L25 -50 L19.5 -56 L14 -50 L8.5 -56 L3 -50 L-2.5 -56 L-8 -50 L-13.5 -56 L-19 -50 L-25 -50 Z';
function bag(x, y, s, rot, xray, trash, v, warnK, t, fresh) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  const p = P(BAGP);
  if (!xray) {
    cel(p, KR, KR2, -9, 0, 4);
    X.save(); X.clip(p); X.fillStyle = KR2; X.fillRect(-30, -47, 60, 5); X.fillStyle = KRL; X.fillRect(-24, -40, 6, 38); X.restore();
    X.font = '900 30px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = '#8a5524'; X.fillText('?', 1, -22);
  } else {
    inkP(p, 'rgba(160,236,255,.30)', 4); X.strokeStyle = XRAY; X.lineWidth = 2.5; X.stroke(p);
    X.save(); X.clip(p); X.fillStyle = 'rgba(159,243,255,.16)'; for (let i = 0; i < 9; i++) X.fillRect(-30, -54 + i * 6 + ((t * 30) % 6), 60, 2); X.restore();
    X.save(); X.translate(0, -24); X.scale(.92, .92); item(trash, v); X.restore();
    if (trash) {                                    // stink + a fly: trash reads as trash at a glance
      X.strokeStyle = '#7fd34a'; X.lineWidth = 3; X.lineCap = 'round';
      for (const sx of [-10, 8]) { X.beginPath(); for (let i = 0; i <= 8; i++) { const yy = -54 - i * 3.2; X.lineTo(sx + Math.sin(i * .9 + t * 7 + sx) * 4, yy); } X.stroke(); }
      const fa = t * 9 + x * .1, fx = Math.cos(fa) * 22, fy = -40 + Math.sin(fa * 1.3) * 12;
      X.fillStyle = 'rgba(255,255,255,.8)'; el(fx - 3, fy - 4, 3, 2, -.5); X.fill(); el(fx + 3, fy - 4, 3, 2, .5); X.fill(); X.fillStyle = INK; el(fx, fy, 3, 2.4); X.fill();
    } else if (fresh) { star(-18, -46, 5 + Math.sin(t * 8) * 1.5, 2, 4, t, '#fff', 0); }
  }
  sign(warnK, Math.sin(t * 5) * .05);
  X.restore();
}

/* ───────────── the hippo (facing left, jaw hinge at (x, y)) ───────────── */
const HEAD = 'M14 6 C34 -40 28 -98 -8 -124 C-40 -148 -110 -142 -150 -112 C-168 -100 -186 -100 -204 -104 C-246 -112 -274 -88 -272 -50 C-270 -16 -258 4 -238 6 Z';
const JAW = 'M40 -8 L-236 -8 C-258 -8 -268 14 -260 36 C-250 60 -200 72 -140 72 L60 72 Z';
const TUSK = 'M-8 0 L-5 -21 Q0 -28 5 -21 L8 0 Z';
const BODY = 'M-150 -30 A150 138 0 1 0 150 -30 A150 138 0 1 0 -150 -30 Z';
const UPT = 'M-7 0 L-5 15 Q0 20 5 15 L7 0 Z';
/* o: open 0..1, sick 0..3 (skin level), pulse 0..1 (green flash on a hit), look [dx, dy], mood, t, mouth(fn drawn inside the mouth), chew, breathe */
function hippo(x, y, s, o) {
  const lv = clamp(o.sick || 0, 0, 3), pulse = o.pulse || 0, open = clamp(o.open, 0, 1), a = open * .68, t = o.t || 0, mood = o.mood || 'idle';
  const [base, shade, light] = PAL[lv];
  X.save(); X.translate(x, y); X.scale(s, s);
  // body behind (the back sticks out of the water on the right), breathing
  const br = 1 + Math.sin(t * 2.4) * .015;
  X.save(); X.translate(118, 34); X.scale(1, br);
  const bp = P(BODY); cel(bp, base, shade, -14, 18, 5); glint(bp, -50, -128, 46, 15, light, -.3);
  X.fillStyle = shade; for (const [fx, fy, fr] of [[-10, -96, 7], [14, -110, 5], [30, -84, 6]]) { el(fx, fy, fr, fr * .8); X.fill(); }
  X.restore();
  // lower jaw
  const jp = P(JAW); cel(jp, base, shade, 0, 14, 5);
  glint(jp, -200, 6, 40, 8, light, 0);
  if (lv >= 2) { X.save(); X.clip(jp); X.fillStyle = BLOT[lv]; el(-214, 30, 34, 16, .1); X.fill(); el(-150, 46, 16, 10); X.fill(); X.restore(); }
  if (pulse > 0) { X.save(); X.clip(jp); X.fillStyle = `rgba(150,255,80,${pulse * .5})`; X.fillRect(-280, -20, 360, 110); X.restore(); }
  // inside the mouth
  if (open > .02) {
    const ca = Math.cos(a), sa = Math.sin(a), rot = (px, py) => [px * ca - py * sa, px * sa + py * ca];
    const f1 = rot(-238, 6), f2 = rot(-120, 10);
    X.beginPath(); X.moveTo(18, 0); X.lineTo(f2[0], f2[1]); X.quadraticCurveTo(f1[0] - 6, f1[1], f1[0] + 2, f1[1] + 4); X.lineTo(-240, -6); X.lineTo(10, -6); X.closePath();
    X.save(); ink(GUM, 5); X.clip();
    X.fillStyle = THROAT; el(-34 + 10 * open, -40 * open, 46 * open + 10, 50 * open + 6, .4); X.fill();
    X.fillStyle = mix(GUM, '#ffffff', .18); el(f1[0] * .55, f1[1] * .55 - 6, 40, 12, a * .9); X.fill();
    X.fillStyle = TONGUE; el(-118, -12, 82, 14 + 16 * open); X.fill(); X.strokeStyle = 'rgba(160,30,70,.5)'; X.lineWidth = 3; X.beginPath(); X.moveTo(-180, -18 - 6 * open); X.quadraticCurveTo(-120, -10, -60, -18 - 6 * open); X.stroke();
    X.restore();
    if (o.mouth) o.mouth();
    X.save(); X.rotate(a); for (const tx of [-214, -168]) { X.save(); X.translate(tx, 6); inkP(P(UPT), TOOTH, 3); X.restore(); } X.restore();
  }
  // upper head (rotates open around the hinge)
  X.save(); X.rotate(a);
  const hp = P(HEAD);
  const bumps = [[-60, -132, 27], [-112, -124, 25]], ears = [[-4, -124, -.5], [16, -108, -.2]];
  X.lineJoin = 'round';
  for (const [ex, ey, er] of ears) { el(ex, ey, 11, 17, er); ink(null, 5); }
  for (const [bx, by, r] of bumps) { X.beginPath(); X.arc(bx, by, r, 0, TAU); ink(null, 5); }
  X.lineWidth = 10; X.strokeStyle = INK; X.stroke(hp);
  for (const [ex, ey, er] of ears) { el(ex, ey, 11, 17, er); X.fillStyle = shade; X.fill(); el(ex - 1, ey + 2, 5, 10, er); X.fillStyle = '#e88aa8'; X.fill(); }
  X.fillStyle = shade; X.fill(hp); X.save(); X.clip(hp); X.translate(0, -14); X.fillStyle = base; X.fill(hp); X.restore();
  for (const [bx, by, r] of bumps) { X.beginPath(); X.arc(bx, by, r, 0, TAU); X.fillStyle = base; X.fill(); }
  // snout: a lighter muzzle, nostrils, freckles, blush
  X.save(); X.clip(hp); X.fillStyle = light; el(-226, -46, 56, 50); X.fill(); X.fillStyle = mix(light, '#ffffff', .4); el(-236, -84, 18, 7, -.35); X.fill();
  if (lv === 1) {                                    // a little queasy: only a soft green wash under the eyes
    X.fillStyle = 'rgba(126,204,92,.42)'; for (const [bx, by] of [[-60, -132], [-112, -124]]) { el(bx, by + 17, 21, 7.5); X.fill(); }
  } else if (lv) {                                   // properly sick: green creeps over the muzzle, a band under the eyes
    X.fillStyle = BLOT[lv]; el(-222, -30, 50, 30, -.1); X.fill(); el(-178, -70, 14, 10, .4); X.fill(); el(-262, -40, 10, 14); X.fill(); el(-150, -24, 22, 12, .2); X.fill();
    for (const [bx, by] of [[-60, -132], [-112, -124]]) { el(bx, by + 16, 22, 9); X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.28)'; el(-232, -44, 18, 6, -.3); X.fill();
  }
  if (pulse > 0) { X.fillStyle = `rgba(150,255,80,${pulse * .5})`; X.fillRect(-290, -200, 340, 220); }
  X.restore();
  const flare = mood === 'eager' ? 1.25 + Math.sin(t * 18) * .12 : mood === 'sick' || mood === 'vomit' ? .8 : 1;
  for (const [nx, ny, nr] of [[-252, -82, -.6], [-221, -92, -.3]]) { el(nx, ny, 8.5 * flare, 5.5 * flare, nr); ink(mix(shade, INK, .55), 2.5); X.fillStyle = 'rgba(255,255,255,.35)'; el(nx - 2, ny - 3, 3, 1.6, nr); X.fill(); }
  X.fillStyle = mix(shade, INK, .2); for (const [fx, fy] of [[-214, -46], [-226, -36], [-202, -36], [-240, -30]]) { el(fx, fy, 2.4, 2.4); X.fill(); }
  glint(hp, -96, -100, 30, 9, light, -.15);
  // cheek: puffs up while chewing, blushes
  const puff = o.puff || 0, cx0 = -84, cy0 = -30;
  if (puff > .02) {                                  // the bulge spills over the jaw line: fill, then ink only its lower rim
    const rx = 26 + 26 * puff, ry = 18 + 20 * puff, cy1 = cy0 + 10 * puff;
    X.fillStyle = base; el(cx0, cy1, rx, ry, -.1); X.fill();
    X.strokeStyle = INK; X.lineWidth = 8; X.lineCap = 'round'; X.beginPath(); X.ellipse(cx0, cy1, rx, ry, -.1, .25, Math.PI - .25); X.stroke();
    X.fillStyle = light; el(cx0 - rx * .3, cy1 - ry * .45, rx * .4, ry * .2, -.3); X.fill();
  }
  const blush = mood === 'happy' || mood === 'chew' ? .8 : .55;
  X.fillStyle = lv ? ['', 'rgba(150,215,100,.55)', 'rgba(104,170,74,.75)', 'rgba(80,150,40,.7)'][lv] : `rgba(255,110,165,${blush})`; el(cx0 + 4, cy0 + 4, 22 + puff * 12, 12 + puff * 6); X.fill();
  // smile at the corner of the mouth
  if (open < .2) { X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); if (mood === 'sick' || mood === 'vomit') { X.moveTo(-20, 4); X.quadraticCurveTo(-6, -4, 6, 4); } else { X.moveTo(-26, 0); X.quadraticCurveTo(-4, 10, 8, -8); } X.stroke(); }
  // eyes
  const lk = o.look || [0, 0];
  for (const [bx, by] of bumps) {
    const ex = bx, ey = by - 4;
    if (mood === 'happy' || mood === 'chew') { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 11, ey + 4); X.quadraticCurveTo(ex, ey - 10, ex + 11, ey + 4); X.stroke(); continue; }
    if (mood === 'sleepy') { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 12, ey - 2); X.quadraticCurveTo(ex, ey + 8, ex + 12, ey - 2); X.stroke(); X.lineWidth = 3; for (const q of [-8, 0, 8]) { X.beginPath(); X.moveTo(ex + q, ey + 4); X.lineTo(ex + q * 1.3, ey + 10); X.stroke(); } continue; }
    if (mood === 'bonk') { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 10, ey - 7); X.lineTo(ex + 2, ey); X.lineTo(ex - 10, ey + 7); X.moveTo(ex + 10, ey - 7); X.lineTo(ex - 2, ey); X.lineTo(ex + 10, ey + 7); X.stroke(); continue; }
    el(ex, ey, 16, 19); ink('#fff', 3);
    if (mood === 'vomit') { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); for (let i = 0; i < 18; i++) { const aa = i * .7 + t * 12, r = i * .7; X.lineTo(ex + Math.cos(aa) * r, ey + Math.sin(aa) * r); } X.stroke(); continue; }
    const big = mood === 'eager' ? 9.5 : 7.5, px = ex + lk[0] * 5, py = ey + lk[1] * 6 + 2;
    X.fillStyle = INK; el(px, py, big, big + 1.5); X.fill(); X.fillStyle = '#fff'; el(px - 3, py - 4, 3, 3); X.fill();
    const blink = Math.sin(t * 1.3 + bx) > .985 ? 1 : 0, lid = mood === 'sick' ? .55 : blink;
    if (lid > 0) { X.save(); el(ex, ey, 15, 18); X.clip(); X.fillStyle = base; X.fillRect(ex - 18, ey - 20, 36, 38 * lid); X.restore(); X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(ex - 15, ey - 20 + 38 * lid); X.lineTo(ex + 15, ey - 20 + 38 * lid); X.stroke(); }
    X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round';
    if (mood === 'eager') { X.beginPath(); X.moveTo(ex - 12, ey - 29); X.quadraticCurveTo(ex, ey - 37, ex + 12, ey - 29); X.stroke(); }
    else if (mood === 'sick') { X.beginPath(); X.moveTo(ex - 13, ey - 27); X.quadraticCurveTo(ex, ey - 24, ex + 11, ey - 33); X.stroke(); }
  }
  if (lv) { X.fillStyle = 'rgba(160,230,255,.9)'; const dy = (t * 40) % 26; el(-20, -96 + dy, 5, 7); ink('rgba(160,230,255,.95)', 2.5); }
  X.restore();
  // the two tusks of the lower jaw poke up in front
  for (const tx of [-224, -182]) { X.save(); X.translate(tx, -6); inkP(P(TUSK), TOOTH, 3); X.fillStyle = 'rgba(200,190,160,.5)'; X.fillRect(2, -18, 3, 16); X.restore(); }
  X.restore();
}

/* ───────────── the static scene, painted once into an offscreen canvas ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  // far hills
  X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(0, 300); for (let x = 0; x <= W; x += 20) X.lineTo(x, 262 - Math.sin(x * .011 + 1) * 22 - Math.sin(x * .027) * 8); X.lineTo(W, 340); X.lineTo(0, 340); X.fill();
  X.fillStyle = '#87d19b'; X.beginPath(); X.moveTo(0, 320); for (let x = 0; x <= W; x += 20) X.lineTo(x, 288 - Math.sin(x * .014 + 3) * 16); X.lineTo(W, 340); X.lineTo(0, 340); X.closePath(); X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
  // trees behind the fence
  const tree = (x, y, r, dark) => {
    rr(x - 8, y, 16, 70, 5); ink('#8a5a34', 3);
    const blobs = [[0, 0, r], [-r * .7, r * .25, r * .7], [r * .7, r * .25, r * .72], [0, -r * .55, r * .72]];
    for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a, y + b, c, 0, TAU); ink(null, 3.5); }
    for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a, y + b, c, 0, TAU); X.fillStyle = dark ? '#2f9a55' : '#3fb260'; X.fill(); }
    for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a - c * .2, y + b - c * .25, c * .72, 0, TAU); X.fillStyle = dark ? '#43b366' : '#5bcf72'; X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.28)'; for (const [a, b, c] of blobs.slice(1)) { el(x + a - c * .35, y + b - c * .45, c * .25, c * .14, -.5); X.fill(); }
  };
  tree(232, 232, 44, true); tree(440, 226, 50, false); tree(560, 248, 34, true);
  // zoo fence
  X.fillStyle = '#b77a43'; for (const y of [298, 318]) { rr(170, y, 640, 9, 3); ink('#d9995a', 3); }
  for (let x = 186; x < W + 20; x += 46) { X.beginPath(); X.moveTo(x - 7, 340); X.lineTo(x - 7, 290); X.lineTo(x, 282); X.lineTo(x + 7, 290); X.lineTo(x + 7, 340); X.closePath(); ink('#e3a868', 3); X.fillStyle = '#c4874e'; X.fillRect(x + 2, 290, 5, 50); }
  // grass
  g = X.createLinearGradient(0, 330, 0, 600); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(0, 334, W, 266);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 334); X.lineTo(W, 334); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -4; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, 600); X.lineTo(i * 90 + 45, 600); X.lineTo(i * 90 + 145, 336); X.lineTo(i * 90 + 100, 336); X.fill(); }
  // pond (sandy rim, water, light streaks)
  const pond = new Path2D('M392 600 C380 520 420 452 520 438 C600 427 720 428 820 430 L820 600 Z');
  X.save(); X.translate(0, -8); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(pond); X.fillStyle = '#f4d998'; X.fill(pond); X.restore();
  g = X.createLinearGradient(0, 430, 0, 600); g.addColorStop(0, '#62d3f0'); g.addColorStop(1, '#2a8fcb'); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(pond); X.fillStyle = g; X.fill(pond);
  X.save(); X.clip(pond); X.fillStyle = 'rgba(255,255,255,.18)'; el(470, 520, 60, 8, -.1); X.fill(); el(720, 575, 90, 7); X.fill(); X.restore();
  // pebbles on the rim
  for (const [px, py, r] of [[408, 470, 9], [430, 452, 7], [466, 437, 8], [395, 505, 7]]) { el(px, py, r * 1.3, r); ink('#c9c3d6', 3); }
  // snack kiosk on the left (awning, window, counter)
  rr(-10, 214, 186, 120, 4); ink('#ffe3a8', 4);
  X.fillStyle = '#f2cd86'; for (let y = 230; y < 330; y += 18) X.fillRect(-10, y, 186, 3);
  rr(22, 232, 132, 70, 8); ink('#5a3b2e', 4); X.fillStyle = '#7a5040'; X.fillRect(22, 232, 132, 12);
  for (let i = 0; i < 7; i++) { X.beginPath(); X.moveTo(-14 + i * 28, 172); X.lineTo(14 + i * 28, 172); X.lineTo(14 + i * 28, 206); X.arc(i * 28, 206, 14, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff6e6' : '#ff5d5d', 3.5); }
  X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(-10, 220, 186, 8);
  // conveyor frame + legs
  for (const lx of [44, 232]) { rr(lx - 9, 360, 18, 84, 4); ink('#8d95a6', 3.5); rr(lx - 20, 440, 40, 10, 4); ink('#5f6677', 3); }
  rr(-14, 337, 310, 26, 8); ink('#ffc53d', 4); X.fillStyle = '#e09a1f'; X.fillRect(-14, 353, 310, 10); X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(-10, 340, 300, 4);
  X.fillStyle = INK; for (let x = 10; x < 290; x += 40) { X.beginPath(); X.arc(x, 350, 3, 0, TAU); X.fill(); }
  // crate under the feeder
  rr(312, 338, 84, 94, 4); ink('#d9944f', 4);
  X.fillStyle = '#b06d33'; X.fillRect(312, 368, 84, 4); X.fillRect(312, 400, 84, 4);
  X.strokeStyle = '#b06d33'; X.lineWidth = 6; X.beginPath(); X.moveTo(318, 344); X.lineTo(390, 426); X.stroke();
  X.fillStyle = '#f2b878'; X.fillRect(312, 338, 84, 5);
  // flowers + tufts on the grass
  const tuft = (x, y) => { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9, y - 10); X.moveTo(x, y); X.lineTo(x, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 10); X.stroke(); };
  for (const [x, y] of [[300, 446], [130, 380], [372, 470], [16, 420], [280, 392]]) tuft(x, y);
  X = old; return cv2;
}

/* ───────────── live bits of the scene ───────────── */
function sky(t) {
  // sun
  const sx = 752, sy = 182;
  X.save(); X.translate(sx, sy); X.rotate(t * .25); X.fillStyle = 'rgba(255,240,150,.45)';
  for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 40); X.lineTo(8, 40); X.lineTo(0, 70); X.fill(); }
  X.restore(); X.beginPath(); X.arc(sx, sy, 32, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 10, sy - 10, 12, 8, -.6); X.fill();
  // clouds drifting at two speeds
  const cloud = (x, y, s) => { X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]; for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); };
  cloud(((t * 9 + 520) % 980) - 120, 172, .9); cloud(((t * 5 + 120) % 1000) - 140, 222, .7); cloud(((t * 7 + 860) % 1000) - 140, 160, .6);
  // two birds
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round';
  for (let i = 0; i < 2; i++) { const bx = ((t * 40 + i * 70) % 1100) - 150, by = 196 + i * 14 + Math.sin(t * 2 + i) * 6, f = Math.sin(t * 10 + i) * 5; X.beginPath(); X.moveTo(bx - 9, by - f); X.quadraticCurveTo(bx - 4, by - 6, bx, by); X.quadraticCurveTo(bx + 4, by - 6, bx + 9, by - f); X.stroke(); }
}
let WG = null;
function waterFront(t) {   // the band of water in front of the hippo, so it sits IN the pond
  X.beginPath(); X.moveTo(424, 600); X.lineTo(424, WATER + 4);
  for (let x = 424; x <= 820; x += 16) X.lineTo(x, WATER + Math.sin(x * .05 + t * 2.2) * 3);
  X.lineTo(820, 600); X.closePath();
  if (!WG) { WG = X.createLinearGradient(0, WATER, 0, 600); WG.addColorStop(0, '#4cc4e8'); WG.addColorStop(1, '#2a8fcb'); }
  X.fillStyle = WG; X.fill();
  X.beginPath(); for (let x = 436; x <= 820; x += 16) X.lineTo(x, WATER + 3 + Math.sin(x * .05 + t * 2.2) * 3);
  X.lineJoin = 'round'; X.lineCap = 'round'; X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 5; X.stroke();
  X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 4; X.lineCap = 'round';
  for (const [x0, w0, ph] of [[450, 60, 0], [560, 80, 1.7], [690, 70, 3.1]]) { const k = (t * .6 + ph) % 1; X.globalAlpha = Math.sin(k * Math.PI); X.beginPath(); X.moveTo(x0 - w0 * k * .3, WATER + 14 + k * 10); X.lineTo(x0 + w0 * (.5 + k * .3), WATER + 14 + k * 10); X.stroke(); }
  X.globalAlpha = 1;
  // lily pads
  for (const [lx, ly, r, ph] of [[468, 528, 22, 0], [744, 536, 26, 2]]) { const by = Math.sin(t * 1.6 + ph) * 2; X.beginPath(); X.moveTo(lx, ly + by); X.arc(lx, ly + by, r, .3, TAU - .3); X.closePath(); X.save(); X.translate(0, 0); X.scale(1, 1); ink('#4fbf5a', 3); X.restore(); X.strokeStyle = '#3a9a48'; X.lineWidth = 2; X.beginPath(); X.moveTo(lx, ly + by); X.lineTo(lx - r * .6, ly + by - r * .4); X.moveTo(lx, ly + by); X.lineTo(lx - r * .5, ly + by + r * .5); X.stroke(); }
  X.save(); X.translate(748, 528 + Math.sin(t * 1.6 + 2) * 2); for (let i = 0; i < 6; i++) { X.rotate(TAU / 6); el(0, -8, 5, 9); ink('#ff9ac2', 2); } X.beginPath(); X.arc(0, 0, 4.5, 0, TAU); ink('#ffe14d', 2); X.restore();
  // sparkles on the water
  for (let i = 0; i < 3; i++) { const k = (t * .5 + i * .33) % 1; star(520 + i * 95, 500 + i * 18, 6 * Math.sin(k * Math.PI), 1.5, 4, 0, '#fff', 0); }
}
function belt(p, t) {           // the rubber belt on top of the frame, its treads move with the bags
  rr(-14, BELTY, 310, 13, 5); ink('#3b3550', 4);
  X.fillStyle = '#5a5274'; const off = ((p * SPB) % 22 + 22) % 22; for (let x = -14 + off - 22; x < 296; x += 22) if (x > -16) X.fillRect(x, BELTY + 3, 9, 7);
  X.save(); X.translate(290, BELTY + 13); X.rotate(p * 1.4); X.beginPath(); X.arc(0, 0, 13, 0, TAU); ink('#c9ced6', 3.5); X.fillStyle = INK; X.fillRect(-11, -2, 22, 4); X.restore();
}

/* ───────────── buttons ───────────── */
function plate(b, col, dk, down, lit) {
  const [x, y, w, h] = b, d = down ? 3 : 9;
  rr(x, y + 9, w, h, 20); ink(dk, 4);
  rr(x, y + 9 - d, w, h, 20); ink(col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 12, 6); X.fill();
  rr(x, y + 9 - d, w, h, 20); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  if (lit) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.globalAlpha = .6 + .4 * Math.sin(now * 10); rr(x + 7, y + 16 - d, w - 14, h - 14, 15); X.stroke(); X.globalAlpha = 1; }
  return 9 - d;
}
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function tossIcon(x, y) {                              // a paper bag with a curved "throw" arrow
  X.save(); X.translate(x, y); X.rotate(-.15); X.scale(.62, .62); X.translate(-6, 28); const p = P(BAGP); cel(p, KR, KR2, -7, 0, 4.5); X.restore();
  X.save(); X.translate(x, y); X.lineCap = 'round'; X.lineJoin = 'round';
  X.beginPath(); X.arc(10, 10, 30, Math.PI * 1.08, Math.PI * 1.62); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#fff'; X.stroke();
  X.beginPath(); X.moveTo(6, -28); X.lineTo(24, -18); X.lineTo(4, -10); X.closePath(); ink('#fff', 3); X.restore();
}
function mouthIcon(x, y, k, bad) {                     // a little hippo snout that opens with the real mouth
  X.save(); X.translate(x, y); X.scale(.36, .36); X.translate(150, 20);
  const a = clamp(k, 0, 1) * .62, base = HIP, shade = HIP2;
  cel(P(JAW), base, shade, 0, 12, 7);
  if (a > .03) { X.save(); X.beginPath(); X.moveTo(18, 0); X.lineTo(-240 * Math.cos(a), -240 * Math.sin(a)); X.lineTo(-240, -6); X.closePath(); ink(GUM, 7); X.restore(); X.fillStyle = TONGUE; el(-120, -14, 80, 16); X.fill(); }
  X.save(); X.rotate(a); cel(P(HEAD), base, shade, 0, -14, 7);
  X.fillStyle = mix(shade, INK, .5); el(-252, -82, 10, 7, -.6); X.fill(); el(-221, -92, 10, 7, -.3); X.fill();
  X.beginPath(); X.arc(-86, -128, 30, 0, TAU); ink(base, 7); el(-86, -132, 15, 18); ink('#fff', 4);
  if (bad) { X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(-100, -158); X.lineTo(-72, -150); X.stroke(); }
  X.fillStyle = INK; el(-92 - (bad ? 0 : 3), -128, 8, 9); X.fill(); X.restore();
  for (const tx of [-224, -182]) { X.save(); X.translate(tx, -6); inkP(P(TUSK), TOOTH, 4); X.restore(); }
  X.restore();
}
function goggles(u, T, fog, up) {                      // X-ray goggles on the feeder (unit u of claude()); fog: steamed up green, up: pushed up onto the forehead
  const ey = -6.2 * u - (up || 0) * 3.3 * u;
  X.lineWidth = 4; X.strokeStyle = INK; X.beginPath(); X.moveTo(-6 * u, ey); X.lineTo(6 * u, ey); X.stroke();
  for (const sx of [-1, 1]) {
    const lx = sx * 2.8 * u;
    X.beginPath(); X.arc(lx, ey, u * 1.65, 0, TAU); ink(fog ? '#a9e06a' : '#7fe7ff', 3.2);
    X.save(); X.beginPath(); X.arc(lx, ey, u * 1.65, 0, TAU); X.clip();
    if (fog) { X.fillStyle = '#6fb83f'; for (let i = 0; i < 3; i++) { el(lx - u + i * u, ey + Math.sin(T * 6 + i * 2 + sx) * u * .5, u * .55, u * .4); X.fill(); } }
    else { X.fillStyle = 'rgba(255,255,255,.75)'; X.fillRect(lx - u * 2, ey - u * 2 + ((T * 30 + sx * 7) % (u * 4)), u * 4, 2.5); }
    X.restore();
    X.fillStyle = '#fff'; el(lx - u * .6, ey - u * .6, u * .42, u * .32, -.6); X.fill();
  }
}
/* two thin blocky arms raised from claude()'s side stubs, each with a little square hand (drawn before claude(), so the body hides the shoulder).
   la / ra: arm angles (0 = straight up, + leans right), k: 0..1 how far they are raised */
function arms(u, la, ra, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  const one = (sx, an) => {
    X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
    X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
    X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
    X.restore();
  };
  one(-1, la); one(1, ra);
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
function zee(x, y, s, a) {                             // a sleepy "Z" (drawn, not text)
  X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
  X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke();
  X.restore();
}
/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 7; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave the hippo's mouth stuck open */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ═════════ the game ═════════ */
function duHippo(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), feeder = D.role === 0, TS = Math.sqrt(sp);
  const N = 26, NEED = 6, SICKMAX = 3;
  const FIRST = 1.0 / TS, SLIDE = .45 / TS, AUTO = 2.2 / TS, FLIGHT = 1.15 / Math.sqrt(TS), GRACE = .22, SHUT = .14, HOLDMAX = 1.2;   // a slow lob, a late chomp still counts, a skull bag gives a beat to shut
  /* the bag queue: same on both screens. Rules: the first bag is food; the 6th food comes by bag 10; the 3rd trash comes BEFORE the 6th food,
     so a hippo that just keeps its mouth open (or a feeder who never warns) always throws up before it can win */
  let kind = [];
  for (let tries = 0; tries < 400; tries++) {
    kind = Array.from({ length: N }, () => R() < .42 ? 1 : 0); kind[0] = 0;
    let f = 0, tr = 0, f6 = -1, t3 = -1, run = 0, okRun = true;
    kind.forEach((k, i) => { if (k) { tr++; run++; if (run > 2) okRun = false; if (tr === 3) t3 = i; } else { f++; run = 0; if (f === NEED) f6 = i; } });
    if (okRun && f6 >= 0 && f6 <= 9 && t3 >= 0 && t3 < f6) break;
    if (tries === 399) kind = [0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
  }
  const vari = kind.map(() => Math.floor(R() * 4)), tilt = kind.map(() => (R() - .5) * .12);
  const warned = kind.map(() => false), warnAt = kind.map(() => -9);
  const flights = [], debris = [], bits = [], pops = [], mouthT = track();
  let s = 0, p = -FIRST / SLIDE, sitAt = null, queued = false;
  let open = false, pN = 0, fN = FOCUSN; const kHeld = new Set(); let mo = 0, lastM = -1, rawM = 0;
  let eaten = 0, sick = 0, plateAt = [], plateV = [], lastPlateAt = -9, sickAt = [-9, -9, -9], chewAt = -9, bonkAt = -9, sickHitAt = -9, vomAt = -9, splashed = false;
  let tossAt = -9, ending = null, warnPress = -9, resAt = -1, burped = false, seeded = false, faded = false;
  const CHEW = .7, LIPS = [448, 392];
  const HKEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS']);
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const holding = () => pN > 0 || kHeld.size > 0;

  function nearLips(f) { return g.c - f.t0 >= f.T * .86; }
  function nextFlight() { let n = null; for (const f of flights) if (!f.res && !f.gone && (!n || f.t0 + f.T < n.t0 + n.T)) n = f; return n; }
  function pop(s, size, bgc, fg) { pops.length = 0; pops.push({ s, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .8, gr: 1100, rot: 0, vr: 0, sh: 0 }, o)); }
  function knock(f, x, y) {                        // a bag bounces off the head: up and back over the hippo, into the pond behind it
    f.gone = g.c;
    debris.push({ id: f.id, x, y, vx: 150 + (f.id % 3) * 30, vy: -560, r: 0, vr: 7, t0: g.c });
    if (f.w) bit({ sh: 4, x, y: y - 50, vx: 90, vy: -420, gr: 1000, vr: 8, life: .55 });   // the skull sign pops off on its own
  }
  function resolveFx(f, res) {
    const [x, y] = fpos(1);
    if (res === 'chomp') {
      chewAt = g.c; plateAt[eaten - 1] = g.c; lastPlateAt = g.c; plateV[eaten - 1] = vari[f.id]; f.gone = g.c;
      snd(170, .09, 'square', .09, 0, 90); noise(.08, .1, 2200, 500, 'bandpass', 0, 1.2); noise(.07, .08, 1800, 400, 'bandpass', .11); snd(523 * Math.pow(2, eaten * 2 / 12), .14, 'triangle', .07, .16);
      const cols = CRUMB[vari[f.id]];
      for (let i = 0; i < 10; i++) bit({ sh: i % 3 ? 0 : 1, x: LIPS[0] + cr() * 24, y: LIPS[1] - cr() * 20, vx: -110 + cr() * 190, vy: -(260 + cr() * 220), r: 4 + cr() * 4, c: cols[i % 3], vr: (cr() - .5) * 14, life: .65 + cr() * .3 });
      bit({ sh: 2, x: LIPS[0] - 8, y: LIPS[1] - 14, vx: 0, vy: 0, gr: 0, life: .3 });
      ring(LIPS[0], LIPS[1] - 10, '#fff', 60, .28);
      pop(eaten >= NEED ? 'YUM YUM!' : ['CHOMP!', 'YUM!', 'GULP!'][eaten % 3], 36, '#ff9f1c', '#FFE14D');
    } else if (res === 'sick') {
      sickHitAt = g.c; sickAt[sick - 1] = g.c; f.gone = g.c;
      snd(320, .4, 'sawtooth', .06, 0, 90); noise(.3, .07, 900, 200, 'lowpass'); sfx.splat(); shake(5, .2);
      for (let i = 0; i < 8; i++) bit({ sh: 3, c: '#8fcf55', x: LIPS[0] + cr() * 20, y: LIPS[1] - 10, vx: -(40 + cr() * 160), vy: -(120 + cr() * 220), r: 4 + cr() * 4, life: .6 + cr() * .3 });
      pop(sick >= SICKMAX ? 'BLEEEEH!' : 'BLEH!', sick >= SICKMAX ? 42 : 36, '#3f9a3a', '#e6ff9a');
      if (sick >= SICKMAX) { vomAt = g.c; noise(1.1, .12, 1400, 160, 'lowpass', .15); snd(220, .8, 'sawtooth', .07, .15, 55); shake(10, .5); }
    } else {
      knock(f, x, y);
      if (!kind[f.id]) { bonkAt = g.c; sfx.boing(); snd(330, .07, 'square', .06, 0, 200); shake(4, .12); pop('BONK!', 36, '#e8434f', '#fff'); ring(x, y, '#ff6b6b', 60, .3); }
      else { snd(240, .07, 'square', .06, 0, 160); snd(1175, .07, 'triangle', .05, .06); snd(1568, .1, 'triangle', .04, .12); pop('NOPE!', 36, '#22a447', '#fff'); ring(x, y, '#5CFF7A', 70, .35); }
    }
  }
  function resolve(f, res) {                       // the hippo (judge) decides
    f.res = res; f.rt = g.c;
    if (res === 'chomp') eaten++; else if (res === 'sick') sick++;
    D.send('eat', { id: f.id, res, n: eaten, k: sick });
    resolveFx(f, res);
    if (!ending) { if (eaten >= NEED) ending = { res: 'win', at: g.c + .3 }; else if (sick >= SICKMAX) ending = { res: 'lose', at: g.c + .55 }; }
  }

  const g = {
    c: 0, dur: 19, pts: 0,
    cmd: feeder ? 'FEED!' : 'OPEN WIDE!', roleLabel: feeder ? 'FEEDER' : 'HIPPO',
    hint: feeder ? 'CLICK / SPACE: TOSS - TRASH INSIDE? WARN FIRST (W)' : 'HOLD CLICK / SPACE TO OPEN - SHUT IT FOR SKULLS!',
    thint: feeder ? 'TAP TO TOSS - TRASH INSIDE? TAP THE SKULL FIRST' : 'HOLD TO OPEN - SHUT IT FOR SKULLS!',
    update(dt) {
      g.c += dt; p = Math.min(s, p + dt / SLIDE);
      if (g.result && resAt < 0) resAt = g.c;
      if (!faded && (g.result || ending || eaten >= NEED || vomAt > 0)) {
        faded = true;
        // bags still in the air vanish in a puff where they are (no bag left hanging at the lips during the burp / the vomit)
        for (const f of flights) if (!f.res && !f.gone) { const [x, y] = fpos(Math.min(1, (g.c - f.t0) / f.T)); f.gone = g.c; f.fade = true; ring(x, y, '#fff', 44, .25); for (let i = 0; i < 5; i++) bit({ x: x + (cr() - .5) * 30, y: y + (cr() - .5) * 30, vx: (cr() - .5) * 160, vy: -(60 + cr() * 140), r: 3 + cr() * 3, c: '#fff', life: .4 }); }
      }
      if (g.result === 'win' && !burped && g.c - resAt > .4) {          // the show: a full hippo burps
        burped = true; snd(98, .38, 'sawtooth', .07, 0, 62); snd(140, .3, 'square', .03, .02, 80); noise(.3, .07, 600, 180, 'lowpass');
        pop('BURP!', 40, '#8a6fd6', '#fff'); ring(LIPS[0], LIPS[1] - 30, '#fff', 90, .35);
      }
      if (vomAt > 0 && !splashed && g.c - vomAt > .25) {              // the vomit lands in the pond
        splashed = true; noise(.35, .08, 1800, 300, 'bandpass'); ring(VEND[0] + 10, WATER + 8, '#c9f08f', 80, .4);
        for (let i = 0; i < 9; i++) bit({ sh: 3, c: i % 2 ? '#8fcf55' : '#bff3ff', x: VEND[0] + (cr() - .5) * 40, y: WATER, vx: (cr() - .5) * 240, vy: -(160 + cr() * 220), r: 4 + cr() * 4, life: .7 });
      }
      // cosmetic: knocked bags arc over the hippo and splash behind it; crumbs, drops, the popped sign
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]; d.vy += 1100 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt; d.behind = d.vy > 0 && d.x > 610;
        if (d.behind && d.y > 318) { noise(.22, .06, 2400, 400, 'bandpass'); for (let j = 0; j < 6; j++) bit({ sh: 3, c: '#bff3ff', x: d.x + (cr() - .5) * 30, y: 300, vx: (cr() - .5) * 160, vy: -(200 + cr() * 160), r: 3 + cr() * 3, life: .55 }); debris.splice(i, 1); }
        else if (!d.behind && d.x > 424 && d.y > WATER + 8) { noise(.25, .07, 2400, 400, 'bandpass'); ring(d.x, WATER + 8, '#fff', 60, .4); debris.splice(i, 1); }
        else if (!d.behind && d.x <= 424 && d.y > 470) { sfx.thud(); debris.splice(i, 1); }
        else if (d.x > 880 || d.y > 640) debris.splice(i, 1);
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1.1) pops.length = 0;
      for (let i = flights.length - 1; i >= 0; i--) if (flights[i].gone && g.c - flights[i].gone > .2) flights.splice(i, 1);
      if (feeder) {
        mo += ((mouthT.at() === null ? 0 : mouthT.at()) - mo) * Math.min(1, dt * 20);
        if (!g.result && s < N && p >= s - 1e-6) { if (sitAt === null) sitAt = g.c; if (queued || g.c - sitAt >= AUTO) g.toss(true); }
        for (const f of flights) if (!f.res && !f.gone && g.c - f.t0 - f.T > HOLDMAX) knock(f, ...fpos(1));   // no answer (partner gone): don't pile bags at the lips
      } else {
        if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; pN = 0; kHeld.clear(); seeded = false; }
        // a press that started during the intro countdown never reached down(): main.js keeps 'pressing', so a finger held through GO opens the mouth
        const pr = typeof pressing !== 'undefined' ? pressing : null;
        if (g.c < .3 && pr && pN === 0) { pN = 1; seeded = true; } else if (seeded && pr === false) { pN = Math.max(0, pN - 1); seeded = false; }
        open = !g.result && !ending && holding() || (vomAt > 0 && g.c - vomAt < 1.2);
        const m = open ? 1 : 0; if (m !== lastM) { lastM = m; D.send('m', m, true); if (m) snd(150, .1, 'sine', .07, 0, 260); else snd(420, .05, 'square', .04, 0, 200); }
        mo += ((open ? 1 : 0) - mo) * Math.min(1, dt * 24);
        if (!g.result && !ending) for (const f of flights) {
          if (f.res) continue; const land = f.t0 + f.T;
          if (g.c >= land - .06 && open) f.seen = true;
          if (g.c < land) continue;
          if (!kind[f.id]) { if (f.seen) resolve(f, 'chomp'); else if (g.c >= land + GRACE) resolve(f, 'bonk'); }
          else { if (f.atLand === undefined) f.atLand = open; if (!f.atLand) resolve(f, 'block'); else if (g.c >= land + SHUT) resolve(f, open ? 'sick' : 'block'); }
          if (ending) break;
        }
        if (!g.result) { if (ending && g.c >= Math.min(ending.at, g.limit)) g.finish(ending.res); else if (!ending && g.c >= g.limit) g.finish('lose'); }
      }
    },
    msg(type, d) {
      if (type === 'toss' && !feeder) {
        if (g.result || ending) return;
        s = Math.max(s, d.id + 1); warned[d.id] = !!d.w; flights.push({ id: d.id, w: !!d.w, t0: g.c, T: FLIGHT, res: null }); tossAt = g.c; sfx.whoosh(true);
      } else if (type === 'warn' && !feeder) { if (d.id >= s && !warned[d.id]) { warned[d.id] = true; warnAt[d.id] = g.c; sfx.stamp(); } }
      else if (type === 'm' && feeder) { rawM = d; mouthT.push(d); }
      else if (type === 'eat' && feeder) {
        const f = flights.find(q => q.id === d.id); eaten = d.n; sick = d.k;
        if (f && !f.res && !f.gone) { f.res = d.res; f.rt = g.c; resolveFx(f, d.res); }
        else if (d.res === 'sick' && sick >= SICKMAX && vomAt < 0) { sickHitAt = g.c; sickAt[sick - 1] = g.c; vomAt = g.c; }
      }
    },
    toss(auto) {
      if (!feeder || g.result || s >= N || g.c < .1 || eaten >= NEED || sick >= SICKMAX) return;
      if (p < s - 1e-6) { if (!auto && p > s - .3) queued = true; return; }
      const id = s, w = warned[id]; flights.push({ id, w, t0: g.c, T: FLIGHT, res: null }); D.send('toss', { id, w: w ? 1 : 0 });
      s++; sitAt = null; queued = false; tossAt = g.c; sfx.whoosh(true); snd(523, .08, 'triangle', .05, 0, 880);
    },
    warn() {                                        // set-only: a nervous double tap never takes the skull back off
      if (!feeder || g.result || s >= N || g.c < .1) return;
      const id = s; warnPress = g.c;
      if (warned[id]) { sfx.click(); return; }
      warned[id] = true; warnAt[id] = g.c; D.send('warn', { id, on: 1 });
      sfx.stamp(); snd(880, .06, 'square', .04);
    },
    hold(on) { if (feeder) return; pN = on ? pN + 1 : Math.max(0, pN - 1); if (!on) seeded = false; },
    draw() {
      const T = g.c, view = feeder, won = g.result === 'win' || (ending && ending.res === 'win'), lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      const vom = vomAt > 0 ? T - vomAt : -1, sleepy = lost && vom < 0 && rk >= 0;
      if (!BG) BG = buildBg(); X = ctx;
      X.drawImage(BG, 0, 0);
      sky(T);
      scoreboard(T);
      // bags waiting on the belt (on a time-out they tip off the end, one after the other)
      belt(p, T);
      for (let i = N - 1; i >= s; i--) {
        let x = SLOTX - (i - p) * SPB; if (x < -40 || x > SLOTX + 1) continue;
        const atSlot = i === s && p >= s - 1e-6, wk = warned[i] ? outBack((T - warnAt[i]) / .25) : 0;
        let jig = 0, hopY = 0, tip = 0;
        if (atSlot && feeder && sitAt !== null && !g.result) { const left = AUTO - (T - sitAt); if (left < .7) jig = Math.sin(T * 40) * .07 * (1 - left / .7); }
        if (atSlot) { const k = sitAt !== null ? (T - sitAt) / .18 : 1; if (k < 1) hopY = -Math.sin(k * Math.PI) * 8; }
        else hopY = -Math.abs(Math.sin((x - SLOTX) / SPB * Math.PI)) * 3;
        if (sleepy) { tip = clamp((rk - .15 - (SLOTX - x) / 520) / .4, 0, 1); hopY += tip * tip * 96; x += tip * 26; }
        bag(x, BELTY + hopY, 1, tilt[i] + jig + tip * 1.5, view, kind[i], vari[i], wk, T, i === s);
        if (atSlot && feeder && sitAt !== null && !g.result && vomAt < 0 && eaten < NEED) {      // the bag tosses itself when this ring runs out
          const k = clamp((T - sitAt) / AUTO, 0, 1); X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.arc(x, BELTY - 28, 44, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); X.stroke();
          X.lineWidth = 4.5; X.strokeStyle = k > .6 ? '#ff6b6b' : '#fff'; X.stroke();
        }
      }
      // the feeder on its crate: anticipation squash, a two-handed throw (arms swing from the belt to the hippo), cheers; recoils from the vomit; shrugs on a time-out
      const tk = (T - tossAt) / .38, hop = !g.result && tk >= 0 && tk < 1 ? Math.sin(tk * Math.PI) : 0;
      const sqx = !g.result && tk >= 0 && tk < .22 ? 1 + .2 * (1 - tk / .22) : 1;
      const jumpY = won ? Math.abs(Math.sin(T * 9)) * 18 : 0, recoil = vom >= 0 ? ease(vom / .3) : 0, shrug = sleepy ? ease((rk - .1) / .3) : 0;
      const brth = Math.sin(T * 3.1) * .025, ccol = feeder ? myCol() : pCol();
      X.save(); X.translate(CLX, CLY - hop * 10 - jumpY); X.rotate(-.24 * recoil + Math.sin(T * 40) * .02 * recoil); X.scale(sqx - brth, 2 - sqx + brth);
      shadow(0, 2 + hop * 10 + jumpY, 36, 6, .25 * (1 - hop * .5));
      const th = (T - tossAt) / .5;
      if (won) { const w = Math.sin(T * 14) * .3; arms(5.4, -.45 + w, .45 - w, ease(rk / .2), ccol); }
      else if (recoil > 0) arms(5.4, .35, .7, recoil, ccol);
      else if (shrug > 0) arms(5.4, -.85, .85, shrug, ccol);
      else if (th >= 0 && th < 1) { const an = lerp(-.8, 1.0, ease(th / .5)); arms(5.4, an, an, th < .12 ? th / .12 : 1 - ease((th - .55) / .45), ccol); }
      claude(0, 0, 5.4, { col: ccol, mood: won ? 'happy' : vom >= 0 ? 'sad' : hop > 0 ? 'happy' : null });
      goggles(5.4, T, recoil > .5, shrug);
      if (shrug > .5) { X.globalAlpha = shrug; el(26, -62 + ((T * 30) % 12), 5, 7); ink('#9fe3ff', 2.5); X.globalAlpha = 1; }
      X.restore();
      pill(CLX, 404, feeder ? 'YOU' : 'YOUR FRIEND', ccol, true);   // on the crate's front, out of the flight path
      // the hippo
      const chew = T - chewAt < CHEW ? (T - chewAt) / CHEW : 0;
      let shown = mo, puff = 0;
      const atLips = flights.some(f => !f.res && !f.gone && T - f.t0 >= f.T);
      if (feeder && rawM === 1 && atLips) shown = Math.max(shown, .8);           // its latest word was "open": show the bag going in
      if (chew > 0) {                                // CHOMP: snap fully open, slam shut, then chew (re-opens at once if still held)
        const c = chew < .05 ? 1 : chew < .16 ? 1 - ease((chew - .05) / .11) : .12 * Math.abs(Math.sin((chew - .16) * 16));
        shown = Math.max(c, shown * clamp((chew - .2) / .1, 0, 1));
        puff = (chew < .16 ? chew / .16 : 1) * (1 - ease((chew - .55) / .45)) * (.88 + .12 * Math.sin(chew * 34));
      }
      if (vom >= 0) shown = Math.min(1, .45 + vom * 3);
      if (won && rk >= 0) { const b = rk - .4; if (b > 0 && b < .35) shown = Math.max(shown, Math.sin(b / .35 * Math.PI) * .45); }
      let sinkY = 0;
      if (sleepy) { shown = rk < .6 ? Math.sin(clamp(rk / .6, 0, 1) * Math.PI) : 0; sinkY = ease((rk - .5) / .55) * 168; }
      const pulse = T - sickHitAt < .3 ? Math.sin((T - sickHitAt) / .3 * Math.PI) : 0;
      let mood = 'idle';
      if (vom >= 0) mood = 'vomit'; else if (won) mood = 'happy'; else if (sleepy) mood = 'sleepy'; else if (chew > 0) mood = 'chew'; else if (T - bonkAt < .6) mood = 'bonk';
      else if (lost) mood = 'sick'; else if (T - sickHitAt < .9 || sick >= 2) mood = 'sick'; else if (shown > .4) mood = 'eager';
      const nx = nextFlight(), tgt = nx ? fpos(Math.min(1, (T - nx.t0) / nx.T)) : [SLOTX, BELTY - 30];
      const lx = clamp((tgt[0] - (JX - 90)) / 220, -1, 1), ly = clamp((tgt[1] - (JY - 130)) / 160, -1, 1);
      const hb = Math.sin(T * 1.6) * 3 + (won ? -Math.abs(Math.sin(T * 8)) * 10 : 0) + (T - bonkAt < .25 ? (1 - (T - bonkAt) / .25) * 12 : 0) + sinkY;
      const wob = T - sickHitAt < .6 ? Math.sin((T - sickHitAt) * 30) * .025 * (1 - (T - sickHitAt) / .6) : 0;
      const sq = chew > 0 && chew < .3 ? 1 + .05 * Math.sin(chew / .3 * Math.PI) : 1;
      for (const d of debris) if (d.behind) drawDebris(d, T);                  // falling behind the hippo's back
      X.save(); X.translate(JX + 60, JY + hb + 40); X.rotate(wob); X.scale(1 / sq, sq); X.translate(-JX - 60, -JY - hb - 40);
      hippo(JX, JY + hb, HS, { open: shown, sick: Math.min(sick, SICKMAX), pulse, look: [lx, ly], mood, t: T, chew, puff,
        mouth: () => { X.save(); X.scale(1 / HS, 1 / HS); X.translate(-JX, -JY - hb); for (const f of flights) if (nearLips(f) && shown > .25 && (!f.gone || T - f.gone < .15)) drawFlight(f, T, true, f === nx);
          if (vom >= 0) vomitStream(vom, T, hb);   // from the throat, over the lower lip (under the upper lip and the tusks), down into the pond
          X.restore(); } });
      X.restore();
      // bonk stars around the head, hearts when full, stink lines when queasy
      if (T - bonkAt < .7) for (let i = 0; i < 3; i++) { const a = T * 6 + i * TAU / 3; star(JX - 100 + Math.cos(a) * 70, JY - 196 + Math.sin(a) * 16, 11, 5, 5, a, '#FFE14D', 3); }
      if (won) for (let i = 0; i < 4; i++) { const k = ((T * .8 + i * .25) % 1); X.globalAlpha = Math.sin(k * Math.PI); heart(JX - 150 + i * 46 + Math.sin(T * 3 + i) * 10, JY - 170 - k * 90, .8 + (i % 2) * .3); X.globalAlpha = 1; }
      if (mood === 'sick' && vom < 0) for (let i = 0; i < 3; i++) { const k = ((T * .9 + i / 3) % 1); X.globalAlpha = Math.sin(k * Math.PI) * .9; X.strokeStyle = '#7fd34a'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); for (let j = 0; j <= 6; j++) X.lineTo(JX - 70 + i * 26 + Math.sin(j * 1.1 + T * 6 + i) * 5, JY - 200 - k * 50 - j * 5); X.stroke(); X.globalAlpha = 1; }
      // the feedback word, in the open sky, under the flights (bags always stay visible)
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, 566, 168 - Math.min(a, .6) * 8, q.size, q.bgc, q.fg, a < .25 ? outBack(a / .25) : 1, q.rot); X.globalAlpha = 1; }
      // flights (in front unless they are inside the open mouth); on the hippo's screen the next bag to judge is marked, later ones are dimmer
      for (const f of flights) if (!(nearLips(f) && shown > .25)) { if (f.gone && !(f.fade && T - f.gone < .15)) continue; drawFlight(f, T, false, f === nx); }
      for (const d of debris) if (!d.behind) drawDebris(d, T);
      drawBits(T, false);
      waterFront(T);
      if (sleepy && rk > .7) {                       // bubbles and Zs from under the water
        for (let i = 0; i < 4; i++) { const k = ((T * 1.1 + i * .27) % 1), bx = 486 + i * 22 + Math.sin(T * 3 + i) * 5; X.globalAlpha = 1 - k; X.beginPath(); X.arc(bx, WATER - 2 - k * 46, 4 + (i % 2) * 3, 0, TAU); ink('rgba(220,250,255,.85)', 2); }
        X.globalAlpha = 1; for (let i = 0; i < 2; i++) { const k = ((T * .7 + i * .5) % 1); zee(560 + i * 34 + k * 20, WATER - 30 - k * 60, .9 + i * .3, Math.sin(k * Math.PI)); }
      }
      if (vom >= 0) { vomitSlick(vom, T); vomitSplash(vom, T); }
      drawBits(T, true);
      pill(JX - 112, 512, feeder ? 'YOUR FRIEND' : 'YOU', feeder ? pCol() : myCol(), true);
      // my own control (after the verdict it goes flat and grey, so it never looks live)
      const done = !!(g.result || ending || vomAt > 0 || eaten >= NEED), GR = '#d3cfe0', GRD = '#8f88a6', GT = '#f6f4fb';
      if (done) X.globalAlpha = .8;
      if (feeder && done) {
        const o1 = plate(WARN_B, GR, GRD, true, false); skull(WARN_B[0] + 42, WARN_B[1] + 44 + o1, 1.65); txt('WARN', WARN_B[0] + 118, WARN_B[1] + 48 + o1, 30, GT, 'center', 104);
        const o2 = plate(TOSS_B, GR, GRD, true, false); tossIcon(TOSS_B[0] + 40, TOSS_B[1] + 46 + o2); txt('TOSS', TOSS_B[0] + 118, TOSS_B[1] + 48 + o2, 32, GT, 'center', 100);
      } else if (done) {
        const o = plate(HOLD_B, GR, GRD, true, false); mouthIcon(HOLD_B[0] + 64, HOLD_B[1] + 50 + o, 0, false);
        txt(won ? 'FULL TUMMY!' : vom >= 0 ? 'BLEEEEH!' : 'ZZZ...', HOLD_B[0] + 250, HOLD_B[1] + 48 + o, 30, GT, 'center', 210);
      } else if (feeder) {
        const lit = s < N && warned[s];
        const o1 = plate(WARN_B, lit ? '#ff4d5e' : '#ff7a85', '#b8283a', T - warnPress < .12, lit);
        skull(WARN_B[0] + 42, WARN_B[1] + 44 + o1, 1.65);
        if (TOUCH) txt(lit ? 'WARNED' : 'WARN', WARN_B[0] + 118, WARN_B[1] + 48 + o1, 30, '#fff', 'center', 104);
        else { txt(lit ? 'WARNED' : 'WARN', WARN_B[0] + 118, WARN_B[1] + 38 + o1, 28, '#fff', 'center', 104); keyCap(WARN_B[0] + 118, WARN_B[1] + 70 + o1, 'W'); }
        const ready = s < N && p >= s - 1e-6 && !g.result;
        const o2 = plate(TOSS_B, ready ? '#4fd06a' : '#9fd9aa', '#24803a', T - tossAt < .12, false);
        tossIcon(TOSS_B[0] + 40, TOSS_B[1] + 46 + o2);
        if (TOUCH) txt('TOSS', TOSS_B[0] + 118, TOSS_B[1] + 48 + o2, 32, '#fff', 'center', 100);
        else { txt('TOSS', TOSS_B[0] + 118, TOSS_B[1] + 38 + o2, 30, '#fff', 'center', 100); keyCap(TOSS_B[0] + 118, TOSS_B[1] + 70 + o2, 'SPACE'); }
      } else {
        const hd = !g.result && holding(), skullNear = !g.result && !!nx && nx.w && nx.t0 + nx.T - T < .9;   // only the NEXT bag to land counts
        const col = skullNear ? (hd ? '#ff4d5e' : '#ff8a94') : hd ? '#5CFF7A' : '#ffd23f', dk = skullNear ? '#b8283a' : hd ? '#23a046' : '#c99512';
        const o = plate(HOLD_B, col, dk, hd, skullNear && hd);
        mouthIcon(HOLD_B[0] + 64, HOLD_B[1] + 50 + o, mo, skullNear);
        const label = skullNear ? (hd ? 'SKULL! LET GO!' : 'KEEP IT SHUT!') : hd ? 'OPEN WIDE!' : 'HOLD TO OPEN';
        if (TOUCH) txt(label, HOLD_B[0] + 250, HOLD_B[1] + 48 + o, 30, '#fff', 'center', 210);
        else { txt(label, HOLD_B[0] + 250, HOLD_B[1] + 38 + o, 28, '#fff', 'center', 210); keyCap(HOLD_B[0] + 250, HOLD_B[1] + 70 + o, 'SPACE'); }
      }
      X.globalAlpha = 1;
      vignette(.16);
    },
    down(pt) {
      if (feeder) { if (inWarn(pt)) g.warn(); else g.toss(); }
      else g.hold(true);
    },
    up() { if (!feeder) g.hold(false); },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (feeder) { if (e.repeat) return; if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyX') g.warn(); else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'ArrowDown') g.toss(); }
      else if (HKEYS.has(e.code)) kHeld.add(e.code);
    },
    keyup(e) { if (!feeder) kHeld.delete(e.code); },
  };
  function drawFlight(f, T, inMouth, isNext) {
    let k = Math.min(1, (T - f.t0) / f.T), [x, y] = fpos(k), sc = 1 + .15 * Math.sin(Math.PI * k), rot = Math.sin(k * 7 + f.id) * .25;
    if (k >= 1 && !f.res) { y += Math.sin(T * 30) * 2; rot = Math.sin(T * 14) * .12; }
    if (f.gone) { const u = clamp((T - f.gone) / .15, 0, 1); sc *= 1 - u; x += 10 * u; }
    if (sc <= .01) return;
    const later = !feeder && !isNext && !f.gone;
    if (later) { X.globalAlpha = .7; sc *= .85; }
    bag(x, y + 30 * sc, sc * .95, rot, feeder, kind[f.id], vari[f.id], f.w ? WK : 0, T, false);
    X.globalAlpha = 1;
    if (!feeder && isNext && !inMouth && !f.res && k < .97) {     // a bouncing arrow on the bag the hippo must judge now
      // above the bag (or its sign); where that would reach the scoreboard it slides round to the bag's right side and points left
      const bob = Math.abs(Math.sin(T * 9)) * 5, by = y + 30 * sc, top = by - (f.w ? 48 + 76 * WK : 56) * .95 * sc - 16;
      const sk = clamp((172 - top) / 18, 0, 1), e2 = ease(sk);
      const ax = lerp(x, x + 34 * .95 * sc + 22 + bob, e2), ay = lerp(top - bob, by - 30 * sc, e2);
      X.save(); X.translate(ax, ay); X.rotate(e2 * Math.PI / 2); X.beginPath(); X.moveTo(-13, -12); X.lineTo(13, -12); X.lineTo(0, 4); X.closePath(); ink(f.w ? '#ff4d5e' : '#FFE14D', 3.5); X.restore();
    }
    if (!inMouth && k < .25) { X.globalAlpha = .5 * (1 - k * 4); for (let i = 1; i <= 3; i++) { const [px, py] = fpos(Math.max(0, k - i * .04)); circ(px, py + 10, 6 - i, '#fff', 0); } X.globalAlpha = 1; }
  }
  function drawDebris(d, T) {
    X.save(); X.globalAlpha = .8; X.translate(d.x, d.y); X.rotate(d.r); bag(0, 22, .72, 0, feeder, kind[d.id], vari[d.id], 0, T, false); X.restore(); X.globalAlpha = 1;
  }
  function drawBits(T, front) {                    // ink-outlined crumbs / drops, the pop star, the skull sign that flew off
    for (const b of bits) {
      if ((b.sh === 3) !== front) continue;
      const a = T - b.t0, fade = a > b.life * .7 ? 1 - (a - b.life * .7) / (b.life * .3) : 1; X.globalAlpha = clamp(fade, 0, 1);
      if (b.sh === 0) { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2.5); X.fillStyle = 'rgba(255,255,255,.45)'; el(b.x - b.r * .3, b.y - b.r * .35, b.r * .35, b.r * .25); X.fill(); }
      else if (b.sh === 1) { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); X.beginPath(); X.moveTo(0, -b.r * 1.2); X.lineTo(b.r * 1.1, b.r * .8); X.lineTo(-b.r * 1.1, b.r * .8); X.closePath(); ink(b.c, 2.5); X.restore(); }
      else if (b.sh === 2) { const k = a / b.life; star(b.x, b.y, 30 * outBack(k * 2.2), 12 * outBack(k * 2.2), 5, .3, '#fff', 3); }
      else if (b.sh === 3) { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2); X.fillStyle = 'rgba(255,255,255,.7)'; el(b.x - b.r * .3, b.y - b.r * .35, b.r * .3, b.r * .22); X.fill(); }
      else if (b.sh === 4) { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); X.scale(.62, .62); X.translate(0, 104); sign(1, 0); X.restore(); }
    }
    X.globalAlpha = 1;
  }
  function scoreboard(T) {                          // a wooden sign hanging from the top: 6 plates to fill + 3 tummy-ache faces
    const x0 = 338, y0 = 66, w = 352, h = 74, sw = Math.sin(T * 1.3) * .012, cx = x0 + w / 2, pop = T - lastPlateAt < .25;
    X.save(); X.translate(cx, 40); X.rotate(sw); X.translate(-cx, -40);
    X.lineCap = 'round'; for (const rx of [x0 + 34, x0 + w - 34]) { X.strokeStyle = INK; X.lineWidth = 8; X.beginPath(); X.moveTo(rx, 40); X.lineTo(rx, y0 + 6); X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 3.5; X.stroke(); }
    rr(x0, y0 + 5, w, h, 16); ink('#a5622c', 5);
    rr(x0, y0, w, h, 16); ink('#d9944f', 0); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
    X.save(); rr(x0, y0, w, h, 16); X.clip(); X.fillStyle = '#c98443'; X.fillRect(x0, y0 + h / 2 - 2, w, 3); X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(x0, y0 + 4, w, 7);
    X.strokeStyle = 'rgba(120,64,24,.35)'; X.lineWidth = 2; for (const [a1, b1] of [[x0 + 60, y0 + 18], [x0 + 200, y0 + 56], [x0 + 300, y0 + 22]]) { X.beginPath(); X.ellipse(a1, b1, 14, 4, 0, 0, TAU); X.stroke(); } X.restore();
    for (let i = 0; i < NEED; i++) {
      const px = x0 + 32 + i * 43, py = y0 + h / 2 + 1, at = plateAt[i], full = i < eaten, k = full && at !== undefined ? outBack((T - at) / .3) : full ? 1 : 0, nxt = i === eaten && !g.result;
      X.beginPath(); X.arc(px, py + 3, 19, 0, TAU); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
      X.beginPath(); X.arc(px, py, 19, 0, TAU); ink(full ? '#fffaf0' : nxt ? '#fff3cf' : '#f1e3c8', 3.5); X.strokeStyle = 'rgba(20,16,28,.16)'; X.lineWidth = 2; X.beginPath(); X.arc(px, py, 13, 0, TAU); X.stroke();
      if (full) { X.save(); X.translate(px, py + 3); X.scale(.52 * k, .52 * k); item(false, plateV[i] || 0); X.restore(); }
    }
    X.fillStyle = INK; X.fillRect(x0 + 284, y0 + 12, 4, h - 24);
    for (let i = 0; i < SICKMAX; i++) {
      const on = i < sick, k = on ? outBack((T - sickAt[i]) / .3) : 1, cy = y0 + 15 + i * 22, cx2 = x0 + 318;
      X.save(); X.translate(cx2, cy); X.scale(k, k); X.beginPath(); X.arc(0, 0, 10, 0, TAU); ink(on ? '#9ad46a' : 'rgba(255,240,220,.55)', 2.5);
      X.strokeStyle = on ? INK : 'rgba(20,16,28,.35)'; X.lineWidth = 2.2; X.beginPath();
      if (on) { X.moveTo(-5, -3); X.lineTo(-2, -1); X.moveTo(5, -3); X.lineTo(2, -1); X.moveTo(-5, 5); X.quadraticCurveTo(-2, 1, 0, 5); X.quadraticCurveTo(2, 9, 5, 5); }
      else { X.moveTo(-4, -2); X.lineTo(-4, -1); X.moveTo(4, -2); X.lineTo(4, -1); X.moveTo(-4, 4); X.quadraticCurveTo(0, 7, 4, 4); }
      X.stroke(); X.restore();
    }
    if (pop) { X.globalAlpha = .5; rr(x0, y0, w, h, 16); X.strokeStyle = '#fff'; X.lineWidth = 4; X.stroke(); X.globalAlpha = 1; }
    X.restore();
  }
  g.dbg = {
    kind, flights, N,
    slot: () => ({ id: s, ready: s < N && p >= s - 1e-6, sat: sitAt, trash: s < N && !!kind[s], warned: s < N && warned[s] }),   // the feeder sees inside (X-ray)
    incoming: () => flights.filter(f => !f.res).map(f => ({ w: f.w, left: f.t0 + f.T - g.c })),                          // the hippo sees bags fly + their signs
    eaten: () => eaten, sick: () => sick, open: () => open,
  };
  wire(g, D, 1, sp, 'du_hippo');
  return g;
}
reg('du_hippo', duHippo, 'FEED THE HIPPO'); REGMAP.du_hippo.duo = true;

/* the losing gag: ONE continuous tapered gush from the throat, over the lower lip, down into the pond (its end dives under the water line);
   chunks ride it, drops fall off its tip; then a green slick floats on the pond */
const VS = [532, 352], VC = [396, 326], VEND = [450, 482];
const vz = (u, hb) => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u, k = 1 - u; return [a * VS[0] + b * VC[0] + c * VEND[0], a * (VS[1] + hb) + b * (VC[1] + hb * k) + c * VEND[1]]; };
function vomitStream(vom, T, hb) {
  const grow = Math.min(1, vom / .22), tail = vom > 1.05 ? Math.min(1, (vom - 1.05) / .4) : 0;
  if (tail >= 1 || grow <= tail) return;
  const n = 22, C = [];
  for (let i = 0; i <= n; i++) {
    const u = lerp(tail, grow, i / n), [x, y] = vz(u, hb), [x2, y2] = vz(Math.min(1, u + .01), hb), [x1, y1] = vz(Math.max(0, u - .01), hb);
    const th = Math.atan2(y2 - y1, x2 - x1), w = lerp(25, 11, Math.sqrt(u)) * (1 + .1 * Math.sin(T * 26 - u * 19) + .06 * Math.sin(T * 41 - u * 37)) * (tail > 0 && i === 0 ? .7 : 1);
    C.push([x, y, w, th]);
  }
  const side = (sg, kw) => C.map(([x, y, w, th]) => [x + Math.cos(th + sg * Math.PI / 2) * w * kw, y + Math.sin(th + sg * Math.PI / 2) * w * kw]);
  const Lf = side(1, 1), Rt = side(-1, 1), e = C[n], s0 = C[0];
  X.beginPath(); X.moveTo(Lf[0][0], Lf[0][1]); for (const [x, y] of Lf) X.lineTo(x, y);
  X.arc(e[0], e[1], e[2], e[3] + Math.PI / 2, e[3] - Math.PI / 2, true);
  for (let i = n; i >= 0; i--) X.lineTo(Rt[i][0], Rt[i][1]);
  X.arc(s0[0], s0[1], s0[2], s0[3] - Math.PI / 2, s0[3] + Math.PI / 2, true); X.closePath();
  X.lineJoin = 'round'; X.lineWidth = 10; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#86c94e'; X.fill();
  X.save(); X.clip();
  const band = (pts, col, lw) => { X.beginPath(); pts.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.strokeStyle = col; X.lineWidth = lw; X.lineCap = 'round'; X.stroke(); };
  band(side(-1, .95), '#5d9f36', 12);                  // the shade on the far side
  X.setLineDash([16, 12]); X.lineDashOffset = -T * 160; band(side(1, .45).slice(0, n - 1), '#c3ef86', 6); X.setLineDash([]); X.lineDashOffset = 0;   // highlight dashes that flow down the gush
  for (let i = 0; i < 5; i++) {                         // chunks riding the gush
    const u = tail + ((vom * 1.5 + i / 5) % 1) * (grow - tail); if (u > .86) continue;
    const [x, y] = vz(u, hb), r = 2.6 + (i % 3);
    X.save(); X.translate(x + Math.sin(i * 3.1) * 7, y); X.rotate(i + T * 6); rr(-r, -r * .8, r * 2, r * 1.6, 1.5); ink(['#c58a3a', '#ff6b6b', '#ffe14d', '#eef4f7', '#ff9f1c'][i], 1.6); X.restore();
  }
  X.restore();
  if (grow >= .5) for (let i = 0; i < 4; i++) {          // drops flicking off the outside of the curve
    const q = (T * 2.4 + i / 4) % 1, u0 = .3 + i * .12; if (u0 < tail) continue; const [x, y] = vz(u0, hb);
    X.globalAlpha = 1 - q * q; X.beginPath(); X.arc(x - 22 - q * 26, y - 6 + q * (q * 70 - 20), 5 - i * .7, 0, TAU); ink(i % 2 ? '#c3ef86' : '#86c94e', 2); X.globalAlpha = 1;
  }
}
/* where the gush hits the pond: a little crown of splashes that keeps going while it pours */
function vomitSplash(vom, T) {
  if (vom < .2 || vom > 1.3) return; const k = Math.min(1, (vom - .2) / .15) * Math.min(1, (1.3 - vom) / .25), x0 = VEND[0] - 4, y0 = WATER + 6;
  for (let i = 0; i < 5; i++) {
    const q = (T * 3 + i / 5) % 1, dx = (i - 2) * 9 + (i - 2) * q * 18, y = y0 - Math.sin(q * Math.PI) * (22 + (i % 2) * 12) * k;
    X.globalAlpha = (1 - q) * k; X.beginPath(); X.arc(x0 + dx, y, 4.5 - Math.abs(i - 2) * .6, 0, TAU); ink(i % 2 ? '#c3ef86' : '#e6fbff', 2);
  }
  X.globalAlpha = k; X.beginPath(); X.ellipse(x0, y0 + 2, 26, 6, 0, 0, TAU); X.strokeStyle = '#fff'; X.lineWidth = 3; X.stroke(); X.globalAlpha = 1;
}
function vomitSlick(vom, T) {
  if (vom < .22) return;
  const k = ease((vom - .22) / .7), cx = VEND[0] + 46, cy = Math.min(532, WATER + 18);
  X.beginPath(); X.ellipse(cx, cy, 24 + 56 * k, 6 + 6 * k, 0, 0, TAU); ink('#7fc24a', 3);
  X.fillStyle = '#a6dd6c'; X.beginPath(); X.ellipse(cx - 18 * k, cy - 2, 12 + 30 * k, 3 + 3 * k, 0, 0, TAU); X.fill();
  for (let i = 0; i < 3; i++) { const q = ((T * .9 + i / 3) % 1), bx = cx - 50 * k + i * 44 * k; X.globalAlpha = 1 - q; X.beginPath(); X.arc(bx, cy - 4 - q * 18, 3 + i, 0, TAU); ink('#b8ea7c', 1.5); }
  X.globalAlpha = 1;
}

/* ───────────── intro card: what each role does (520×240 frame), a 4.4 s loop: a food bag, then a trash bag ───────────── */
let DBG = null;
function buildDemoBg() {
  const c2 = document.createElement('canvas'); c2.width = 520; c2.height = 240; const old = X; X = c2.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#3fb0ec'); gr.addColorStop(1, '#d2f5ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(0, 130); for (let x = 0; x <= 520; x += 20) X.lineTo(x, 104 - Math.sin(x * .016 + 1) * 14); X.lineTo(520, 150); X.lineTo(0, 150); X.fill();
  for (const [x, y, r] of [[60, 92, 26], [250, 86, 30], [330, 100, 20]]) {
    rr(x - 5, y, 10, 50, 4); ink('#8a5a34', 2.5);
    const bl = [[0, 0, r], [-r * .7, r * .3, r * .7], [r * .7, r * .3, r * .7]];
    for (const [q, w, e] of bl) { X.beginPath(); X.arc(x + q, y + w, e, 0, TAU); ink(null, 3); }
    for (const [q, w, e] of bl) { X.beginPath(); X.arc(x + q, y + w, e, 0, TAU); X.fillStyle = '#3fb260'; X.fill(); }
    for (const [q, w, e] of bl) { X.beginPath(); X.arc(x + q - e * .2, y + w - e * .25, e * .7, 0, TAU); X.fillStyle = '#5bcf72'; X.fill(); }
  }
  X.fillStyle = '#b77a43'; for (const y of [124, 136]) { rr(0, y, 520, 6, 3); ink('#d9995a', 2.5); }
  for (let x = 14; x < 520; x += 34) { X.beginPath(); X.moveTo(x - 5, 152); X.lineTo(x - 5, 120); X.lineTo(x, 114); X.lineTo(x + 5, 120); X.lineTo(x + 5, 152); X.closePath(); ink('#e3a868', 2.5); }
  gr = X.createLinearGradient(0, 148, 0, 240); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944'); X.fillStyle = gr; X.fillRect(0, 150, 520, 90);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 150); X.lineTo(520, 150); X.stroke();
  const pond = new Path2D('M300 240 C296 206 330 190 390 186 C440 183 500 184 530 184 L530 240 Z'); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(pond);
  gr = X.createLinearGradient(0, 184, 0, 240); gr.addColorStop(0, '#62d3f0'); gr.addColorStop(1, '#2a8fcb'); X.fillStyle = gr; X.fill(pond);
  rr(-10, 150, 170, 12, 5); ink('#3b3550', 3); rr(-10, 160, 170, 10, 5); ink('#ffc53d', 3);
  rr(150, 150, 56, 50, 4); ink('#d9944f', 3); X.fillStyle = '#b06d33'; X.fillRect(150, 168, 56, 3); X.fillRect(150, 184, 56, 3);
  X = old; return c2;
}
const DJX = 476, DJY = 196, DS = .5, DMX = DJX - 150 * DS, DMY = DJY - 52 * DS, DSX = 108, DSY = 122;
const dpos = k => { const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; return [a * DSX + b * 150 + c * DMX, a * DSY + b * 10 + c * DMY]; };   // the same lob, over the feeder's head
const DWARN = [10, 170, 112, 42], DTOSS = [132, 170, 112, 42], DHOLD = [10, 170, 234, 42];
function miniBtn(b, col, dk, down, label, icon) {
  const [x, y, w, h] = b, d = down ? 2 : 6;
  rr(x, y + 6, w, h, 14); ink(dk, 3); rr(x, y + 6 - d, w, h, 14); ink(col, 3);
  X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 8, y + 9 - d, w - 16, 7, 3.5); X.fill();
  if (icon) icon(x + 24, y + h / 2 + 6 - d);
  txt(label, x + (icon ? w / 2 + 14 : w / 2), y + h / 2 + 6 - d, 20, '#fff', 'center', w - (icon ? 52 : 16));
}
function demo(role, t) {
  X = ctx; if (!DBG) DBG = buildDemoBg(); X.drawImage(DBG, 0, 0);
  const u = t % 4.4, trash = u >= 2.2, v = trash ? u - 2.2 : u, feeder = role === 0;
  const warnT = .45, tossT = trash ? .95 : .6, landT = tossT + .7, inT = Math.min(1, v / .3);
  const wk = trash ? (feeder ? (v > warnT ? outBack((v - warnT) / .25) : 0) : (v > warnT ? 1 : 0)) : 0;
  // the waiting bag slides in, gets tossed
  if (v < tossT) bag(DSX - 120 * (1 - ease(inT)), 154, .82, 0, feeder, trash, 0, wk * .8, t, false);
  // the hippo: opens for food, stays shut for the skull
  const holdOn = !trash && v > tossT + .25 && v < landT + .05, chew = !trash && v > landT && v < landT + .7 ? (v - landT) / .7 : 0;
  let op = holdOn ? Math.min(1, (v - tossT - .25) / .08) : 0, puff = 0;
  if (chew) { op = chew < .14 ? 1 - chew / .14 : .14 * Math.abs(Math.sin((chew - .14) * 16)); puff = Math.min(1, chew / .14) * (1 - ease((chew - .55) / .45)); }
  const ff = v >= tossT && v < landT ? (v - tossT) / (landT - tossT) : -1;
  const drawB = k => { const [x, y] = dpos(k); bag(x, y + 26, .72 * (1 + .2 * Math.sin(Math.PI * k)), Math.sin(k * 6) * .25, feeder, trash, 0, wk * .62, t, false); };
  const bonk = trash && v > landT && v < landT + .5;
  hippo(DJX, DJY + Math.sin(t * 1.6) * 1.5, DS, { open: op, look: [-1, -.3], mood: chew ? 'chew' : op > .4 ? 'eager' : bonk ? 'happy' : 'idle', t, chew, puff,
    mouth: () => { if (ff > .85 && op > .25) { X.save(); X.scale(1 / DS, 1 / DS); X.translate(-DJX, -DJY); drawB(ff); X.restore(); } } });
  if (ff >= 0 && !(ff > .85 && op > .25)) drawB(ff);
  if (bonk) { const k = (v - landT) / .5, [x, y] = dpos(1); X.globalAlpha = .85; bag(x + 70 * k, y + 26 - 90 * k + 160 * k * k, .6, k * 4, feeder, true, 0, 0, t, false); X.globalAlpha = 1; }
  const bk = bonk ? (v - landT) : chew ? (v - landT) : -1;
  if (bk >= 0) badge(bonk ? 'NOPE!' : 'YUM!', DMX - 6, 40, 24, bonk ? '#22a447' : '#ff9f1c', bonk ? '#fff' : '#FFE14D', bk < .2 ? outBack(bk / .2) : 1, -.05);
  // the feeder on its crate
  const tk = (v - tossT) / .35, hop = tk > 0 && tk < 1 ? Math.sin(tk * Math.PI) : 0;
  X.save(); X.translate(178, 150 - hop * 5); const an = lerp(-.8, 1, ease(tk / .6)); if (tk > 0 && tk < 1.3) arms(2.6, an, an, tk < .15 ? tk / .15 : 1 - ease((tk - .7) / .6), feeder ? '#FFC93C' : '#6EA8FE');
  claude(0, 0, 2.6, { col: feeder ? '#FFC93C' : '#6EA8FE', mood: hop > 0 || chew ? 'happy' : null }); goggles(2.6, t); X.restore();
  if (feeder) {
    const tapW = trash && v > warnT - .12 && v < warnT + .16, tapT = v > tossT - .12 && v < tossT + .16;
    miniBtn(DWARN, wk > 0 ? '#ff4d5e' : '#ff7a85', '#b8283a', tapW, 'WARN', (x, y) => skull(x, y, .95));
    miniBtn(DTOSS, '#4fd06a', '#24803a', tapT, 'TOSS', (x, y) => { X.save(); X.translate(x, y + 14); X.scale(.38, .38); cel(P(BAGP), KR, KR2, -7, 0, 4.5); X.restore(); });
    const onW = trash && v < warnT + .3, fx = onW ? DWARN[0] + 70 : DTOSS[0] + 70;    // the finger rests on the button it is about to press
    if (tapW) demoFinger(fx, 213, true, (v - warnT + .12) / .28);
    else if (tapT) demoFinger(fx, 213, true, (v - tossT + .12) / .28);
    else demoFinger(fx, 216, false);
    if (trash && v < tossT) badge('TRASH!', DSX, 34, 18, '#e8434f', '#fff', 1, -.04);
  } else {
    const red = trash && v > tossT && v < landT;
    miniBtn(DHOLD, red ? '#ff8a94' : holdOn ? '#5CFF7A' : '#ffd23f', red ? '#b8283a' : holdOn ? '#23a046' : '#c99512', holdOn, red ? 'KEEP IT SHUT!' : holdOn ? 'OPEN WIDE!' : 'HOLD TO OPEN', null);
    demoFinger(127, holdOn ? 213 : 216, holdOn, holdOn ? (t * 1.8) % 1 : 0);
  }
}
DUO.INFO.du_hippo = [['FEEDER', 'TOSS FOOD, WARN ABOUT TRASH', 'TAP TO TOSS · SKULL TO WARN'], ['HIPPO', 'EAT THE GOOD STUFF', 'HOLD TO OPEN WIDE']];
DUO.DEMOS.du_hippo = [t => demo(0, t), t => demo(1, t)];

})();
