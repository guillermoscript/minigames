'use strict';
/* ═════════ DUO · SPLIT KEYBOARD (du_keys), after Just My Type (Move It!) ═════════
   A giant typewriter is writing a love letter, and its keyboard has been sawn in half: 8 letters, 4 per player.
   LEFT HAND (role 0, the JUDGE) owns the 4 keys left of the crack, RIGHT HAND (role 1) the 4 on the right. Two tiny Claudes
   stomp on the giant keys. The 2-3 words (seeded, built only from those 8 letters) need both halves, so the players take turns
   letter by letter. A wrong key types a silly letter, a doodle (a loaf, a fish...) lands in the margin and that half jams for
   JAM s. All the words in time: the letter folds into a paper plane and bonks the crush across the street on the head.
   Netcode: ONE shared cursor (the first letter nobody has typed yet). Only the owner of a letter can type it, so each client
   checks its own key against the letter at ITS cursor and relays the result: 'k {i}' letter i typed, 'x {i, c}' a typo (key c)
   at letter i. A press is judged on the presser's screen when it is made, so a late message never turns a good press bad, and
   two presses can never fight over a letter. The JUDGE declares the win once every letter is in, the loss TOL s after its time
   limit (so a last letter of RIGHT HAND's still in flight counts; RIGHT HAND stops typing TOL s before the limit). RIGHT HAND
   only starts the win show when the judge's 'end' says so, never on its own last letter. ═════════ */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── the words: the same on both screens whatever each player's language, so they are cognates / loanwords
   that read in English AND Spanish, all built from these 8 letters (no M: main.js keeps that key for mute) ───────────── */
const LETTERS = ['A', 'E', 'L', 'O', 'R', 'S', 'T', 'X'];
const WORDS = { 4: ['XOXO', 'EROS', 'ROSA', 'ALTO', 'SOLO', 'ROSE'], 5: ['ALTAR', 'SALSA', 'LATTE', 'TAROT', 'SOLAR', 'ROSAS', 'TOTAL'], 6: ['ASTRAL', 'TESORO'] };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right LEAVE and y>552) ───────────── */
const PX = 310, PRINTY = 210, PLY = 258;                 // print point (x, y of the line being typed) and the platen roller
const PW = 250, MARG = 24, LW = 30, LH = 38;             // paper width, left margin, letter pitch, line feed
const KY = 450, KR = 27;                                  // the key row
const KX = [70, 136, 202, 268, 352, 418, 484, 550];       // left half (role 0) | crack at x=310 | right half (role 1)
const SPL = 310;
const WIN = [596, 80, 170, 340];                          // the window (x, y, w, h); the crush stands on a balcony across the street
const CRX = 676, CRY = 342, CU = 6.2;                     // the crush: feet (behind the railing) + claude() unit
const HEADP = [CRX, CRY - 9 * CU];                        // where the paper plane lands
const BIN = [720, 470];                                   // the waste basket full of failed drafts
const JAM = .55, RET = .2, TOL = .3;                      // a typo jams that half for JAM s (longer each time the same letter is missed); a finished word
                                                          // waits RET s before the carriage returns; TOL = the judge's grace for in-flight letters

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function poly(pts) { X.beginPath(); pts.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.closePath(); }
function pill(x, y, label, col, up) {                      // a name tag with a little pointer (down, or up), e.g. YOU / YOUR FRIEND
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
/* a word on a chunky coloured badge (feedback that stays readable over any background) */
function badge(s, x, y, size, bgc, fg, sc, rot, raw) {   // raw: s is not English (a misspelt word), drawn as is
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(236, X.measureText(raw ? s : t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  if (raw) { X.font = TYPE(size * 1.15); X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round'; X.lineWidth = size / 4; X.strokeStyle = INK; X.strokeText(s, 0, 2, 236); X.fillStyle = fg || '#fff'; X.fillText(s, 0, 2, 236); }
  else txt(s, 0, 2, size, fg || '#fff', 'center', 236);
  X.restore();
}
function heart(x, y, s, col) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink(col || '#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
const TYPE = sz => `700 ${sz}px "Courier New", Courier, monospace`;
/* cosmetic randomness (particles, jitter of the typed letters): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;

/* ───────────── doodles that a typo leaves in the margin (each about 40 px wide, centred) ───────────── */
function loaf() {                                          // "I LOAF YOU"
  X.beginPath(); X.moveTo(-20, 10); X.lineTo(-20, -2); X.bezierCurveTo(-24, -16, -12, -18, -6, -12); X.bezierCurveTo(-2, -20, 10, -20, 14, -12); X.bezierCurveTo(24, -14, 26, 0, 20, 2); X.lineTo(20, 10); X.closePath(); ink('#e7a756', 2.5);
  X.fillStyle = '#f7d08a'; el(-2, -8, 14, 4); X.fill();
  X.strokeStyle = '#a86a2a'; X.lineWidth = 2.5; for (const sx of [-10, 0, 10]) { X.beginPath(); X.moveTo(sx - 3, -12); X.lineTo(sx + 3, -6); X.stroke(); }
  X.fillStyle = INK; X.fillRect(-7, 1, 2.5, 3); X.fillRect(4, 1, 2.5, 3); X.strokeStyle = INK; X.lineWidth = 1.8; X.beginPath(); X.arc(-1, 4, 3, .2, Math.PI - .2); X.stroke();
}
function fish() {
  X.beginPath(); X.moveTo(14, 0); X.lineTo(24, -9); X.lineTo(24, 9); X.closePath(); ink('#5ab8ff', 2.5);
  el(-2, 0, 18, 11); ink('#7fd0ff', 2.5); X.fillStyle = '#c2ecff'; el(-6, -4, 8, 3, -.2); X.fill();
  X.fillStyle = '#fff'; el(-11, -2, 4, 4); X.fill(); X.fillStyle = INK; el(-12, -2, 2, 2.2); X.fill();
  X.strokeStyle = INK; X.lineWidth = 1.8; X.beginPath(); X.moveTo(-19, 4); X.lineTo(-15, 5); X.stroke();
}
function sock() {
  X.beginPath(); X.moveTo(-6, -18); X.lineTo(8, -18); X.lineTo(8, 4); X.bezierCurveTo(8, 14, -2, 16, -14, 14); X.bezierCurveTo(-22, 12, -22, 2, -14, 2); X.lineTo(-6, 0); X.closePath(); ink('#ff8fc4', 2.5);
  X.fillStyle = '#fff'; X.fillRect(-6, -18, 14, 5); X.fillStyle = '#c74a8a'; X.fillRect(-6, -8, 14, 3); X.fillRect(-6, -3, 14, 2);
  X.fillStyle = '#ffd6ea'; el(-16, 9, 4, 3); X.fill();
}
function duck() {
  el(4, 6, 16, 10); ink('#ffd23f', 2.5); X.beginPath(); X.arc(-8, -6, 9, 0, TAU); ink('#ffd23f', 2.5);
  X.beginPath(); X.moveTo(-16, -5); X.lineTo(-26, -2); X.lineTo(-16, 0); X.closePath(); ink('#ff8a3d', 2);
  X.fillStyle = INK; el(-9, -8, 1.8, 2.2); X.fill(); X.fillStyle = '#fff3a8'; el(8, 2, 6, 3, -.3); X.fill();
}
const DOODLES = [loaf, fish, sock, duck];

/* ───────────── the static scene, painted once into an offscreen canvas ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  // wallpaper: pink stripes + little hearts, a darker wainscot band
  X.fillStyle = '#ffd3e0'; X.fillRect(0, 0, W, H);
  X.fillStyle = '#ffc2d4'; for (let x = 0; x < W; x += 48) X.fillRect(x, 0, 22, 520);
  X.fillStyle = 'rgba(255,255,255,.55)';
  for (let y = 84; y < 400; y += 64) for (let x = (y / 64 & 1) * 24 + 12; x < W; x += 48) { X.save(); X.translate(x, y); X.scale(.32, .32); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.fill(); X.restore(); }
  X.fillStyle = '#f2a5bd'; X.fillRect(0, 404, W, 116); X.fillStyle = '#e48daa'; X.fillRect(0, 404, W, 8);
  X.strokeStyle = 'rgba(160,60,100,.25)'; X.lineWidth = 3; for (let x = 30; x < W; x += 92) { rr(x, 424, 70, 80, 6); X.stroke(); }
  // the shrine: a polaroid of the crush, pinned, with lipstick hearts all round it
  X.save(); X.translate(78, 152); X.rotate(-.08);
  rr(-48, -56, 96, 112, 4); ink('#fffdf5', 3.5); X.fillStyle = '#ffe8a3'; X.fillRect(-38, -46, 76, 72);
  X.fillStyle = '#ffb3cf'; X.beginPath(); X.arc(-12, -20, 12, 0, TAU); X.fill();
  X.restore();
  // the window frame (outside: sky, the pink building across the street, its balcony)
  const [wx, wy, ww, wh] = WIN;
  rr(wx - 14, wy - 14, ww + 28, wh + 34, 8); ink('#fff6ea', 4);
  let g = X.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#5cc4f5'); g.addColorStop(1, '#c9f1ff'); X.fillStyle = g; X.fillRect(wx, wy, ww, wh);
  X.save(); X.beginPath(); X.rect(wx, wy, ww, wh); X.clip();
  X.fillStyle = '#ffffff'; for (const [cx, cy, s] of [[650, 102, 1], [760, 128, .8]]) { X.beginPath(); X.arc(cx, cy, 14 * s, 0, TAU); X.arc(cx + 16 * s, cy - 6 * s, 16 * s, 0, TAU); X.arc(cx + 32 * s, cy, 12 * s, 0, TAU); X.fill(); }
  rr(wx - 10, wy + 120, ww + 20, wh, 6); ink('#ff9fb6', 4);                         // the facade
  X.fillStyle = '#ff8aa6'; for (let y = wy + 140; y < wy + wh; y += 22) for (let x = wx + (y / 22 & 1) * 14; x < wx + ww; x += 28) X.fillRect(x, y, 20, 3);
  rr(CRX - 44, wy + 146, 88, CRY - wy - 140, 44); ink('#4a3f68', 4);              // the balcony door behind the crush (arched)
  X.fillStyle = '#6a5c94'; X.fillRect(CRX - 2, wy + 150, 4, CRY - wy - 146);
  X.fillStyle = 'rgba(255,255,255,.25)'; rr(CRX - 36, wy + 160, 26, 60, 12); X.fill();
  rr(wx + 8, CRY + 6, ww - 16, 16, 4); ink('#e2e6f0', 4);                          // balcony floor slab
  X.restore();
  // desk + the waste basket full of failed drafts + a mug
  g = X.createLinearGradient(0, 516, 0, 600); g.addColorStop(0, '#d79a5c'); g.addColorStop(1, '#a8693a'); X.fillStyle = g; X.fillRect(0, 516, W, 84);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 516); X.lineTo(W, 516); X.stroke(); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(0, 520, W, 4);
  X.strokeStyle = 'rgba(110,60,25,.35)'; X.lineWidth = 2; for (const [a, b] of [[120, 560], [430, 575], [650, 548]]) { X.beginPath(); X.ellipse(a, b, 40, 5, 0, 0, TAU); X.stroke(); }
  X = old; return cv2;
}
/* the typewriter body (also static) */
let TW = null;
function buildTw() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  // rubber feet + the deck (the key bed), sawn down the middle and held with duct tape
  for (const fx of [60, 560]) { rr(fx - 22, 508, 44, 14, 5); ink('#3b3550', 3); }
  poly([[56, 382], [564, 382], [598, 506], [22, 506]]); ink('#62bfa9', 4.5);
  X.fillStyle = '#4fa894'; poly([[22, 496], [598, 496], [598, 506], [22, 506]]); X.fill();
  X.fillStyle = 'rgba(255,255,255,.3)'; poly([[62, 388], [558, 388], [560, 396], [60, 396]]); X.fill();
  rr(18, 500, 584, 20, 8); ink('#3f8f7d', 4);
  // the crack
  X.fillStyle = '#ffd3e0'; poly([[SPL - 5, 382], [SPL + 6, 382], [SPL - 2, 420], [SPL + 7, 456], [SPL - 3, 520], [SPL - 10, 520], [SPL - 12, 456], [SPL - 6, 420]]); ink('#2a2436', 3);
  for (const [ty, rot] of [[404, -.12], [478, .1]]) { X.save(); X.translate(SPL - 2, ty); X.rotate(rot); rr(-30, -9, 60, 18, 2); ink('#c9cbd6', 3); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(-26, -6, 52, 4); X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 1.5; for (let i = -22; i < 26; i += 8) { X.beginPath(); X.moveTo(i, -9); X.lineTo(i + 2, 9); X.stroke(); } X.restore(); }
  // upper body (holds the typebar basket and the carriage)
  X.beginPath(); X.moveTo(132, 270); X.quadraticCurveTo(310, 252, 488, 270); X.quadraticCurveTo(512, 274, 516, 296); X.lineTo(530, 384); X.lineTo(90, 384); X.lineTo(104, 296); X.quadraticCurveTo(108, 274, 132, 270); X.closePath();
  ink('#7dd3c0', 4.5);
  X.save(); X.clip(); X.fillStyle = '#5fbca6'; X.fillRect(80, 360, 460, 30); X.fillStyle = 'rgba(255,255,255,.35)'; el(200, 282, 80, 8, -.05); X.fill(); X.restore();
  // the typebar basket: a dark half-moon under the print point
  X.beginPath(); X.arc(PX, 324, 54, Math.PI, 0); X.closePath(); ink('#2a2436', 3.5);
  X.fillStyle = '#3d3550'; X.beginPath(); X.arc(PX, 324, 40, Math.PI, 0); X.closePath(); X.fill();
  // ribbon spool cups
  for (const sx of [178, 442]) { X.beginPath(); X.arc(sx, 306, 26, 0, TAU); ink('#4fa894', 3.5); }
  // the name plate
  rr(PX - 74, 338, 148, 30, 9); ink('#e9edf5', 3.5); X.fillStyle = '#c9cfdd'; X.fillRect(PX - 70, 356, 140, 8);
  X = old; return cv2;
}

/* ───────────── live bits of the scene ───────────── */
function spool(x, y, a) {
  X.save(); X.translate(x, y); X.rotate(a); X.beginPath(); X.arc(0, 0, 20, 0, TAU); ink('#e8434f', 3); X.beginPath(); X.arc(0, 0, 12, 0, TAU); ink('#2a2436', 2.5);
  X.strokeStyle = '#e9edf5'; X.lineWidth = 3; for (let i = 0; i < 3; i++) { X.rotate(TAU / 3); X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 10); X.stroke(); }
  X.beginPath(); X.arc(0, 0, 3.5, 0, TAU); ink('#e9edf5', 1.5); X.restore();
}
/* the typebars: a fan of thin levers lying in the basket; one flies up to the print point on a strike */
function typebars(strikeK, sk) {
  X.lineCap = 'round';
  for (let i = 0; i < 13; i++) {
    const a = Math.PI + (i + .5) / 13 * Math.PI, x0 = PX + Math.cos(a) * 50, y0 = 324 + Math.sin(a) * 50, x1 = PX + Math.cos(a) * 26, y1 = 324 + Math.sin(a) * 26;
    if (strikeK >= 0 && i === 2 + strikeK && sk < 1) continue;
    X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.stroke(); X.strokeStyle = '#c9cfdd'; X.lineWidth = 2.5; X.stroke();
  }
  if (strikeK >= 0 && sk < 1) {                          // up and back in 0.12 s
    const i = 2 + strikeK, a = Math.PI + (i + .5) / 13 * Math.PI, x0 = PX + Math.cos(a) * 50, y0 = 324 + Math.sin(a) * 50, up = Math.sin(sk * Math.PI);
    const tx = lerp(PX + Math.cos(a) * 26, PX, up), ty = lerp(324 + Math.sin(a) * 26, PRINTY + 14, up);
    X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(x0, y0); X.lineTo(tx, ty); X.stroke(); X.strokeStyle = '#e9edf5'; X.lineWidth = 3; X.stroke();
    rr(tx - 5, ty - 4, 10, 8, 2); ink('#c9cfdd', 2);
  }
}
/* the carriage: the platen roller under the paper, chrome knobs, the return lever on the left (all slide with the paper) */
function carriage(px, ret) {
  const x0 = px - 34, x1 = px + PW + 34;
  rr(x0, PLY - 17, x1 - x0, 34, 17); ink('#3b3550', 4); X.fillStyle = '#5a5274'; rr(x0 + 8, PLY - 12, x1 - x0 - 16, 8, 4); X.fill();
  X.fillStyle = 'rgba(20,16,28,.35)'; for (let x = x0 + 14; x < x1 - 10; x += 14) X.fillRect(x, PLY + 2, 3, 9);
  for (const kx of [x0 - 4, x1 + 4]) { el(kx, PLY, 13, 20); ink('#e9edf5', 3.5); X.fillStyle = '#b9c0cf'; el(kx + 3, PLY + 4, 7, 12); X.fill(); }
  // the return lever, swings when the carriage is thrown back
  X.save(); X.translate(x0 - 8, PLY - 10); X.rotate(-.5 - ret * .7);
  rr(-5, -46, 10, 48, 5); ink('#e9edf5', 3); X.beginPath(); X.arc(0, -48, 8, 0, TAU); ink('#3b3550', 3); X.restore();
  // the paper bail with its two little rubber rollers
  X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(x0 + 6, PLY - 8); X.lineTo(x1 - 6, PLY - 8); X.stroke(); X.strokeStyle = '#e9edf5'; X.lineWidth = 3; X.stroke();
  for (const rx of [px + 40, px + PW - 40]) { rr(rx - 9, PLY - 14, 18, 12, 5); ink('#3b3550', 2.5); }
}
/* one round typewriter key: chrome ring, cap, letter; lit = your turn, mine = I can press it */
function keyCap(x, y, ch, rim, o) {
  const d = o.down ? 7 : 0;
  // the lever under the key
  X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(x, y + 12); X.lineTo(x, y + 40); X.stroke(); X.strokeStyle = '#9aa2b4'; X.lineWidth = 4; X.stroke();
  X.fillStyle = 'rgba(20,16,28,.3)'; el(x, y + 30, KR * .9, 7); X.fill();
  y += d;
  if (o.lit) { X.globalAlpha = .45 + .35 * Math.sin(now * 10); X.beginPath(); X.arc(x, y, KR + 13, 0, TAU); X.fillStyle = '#fff6a8'; X.fill(); X.globalAlpha = 1; }
  X.beginPath(); X.arc(x, y + 5, KR, 0, TAU); ink('#8f96a8', 4);                        // side of the key
  X.beginPath(); X.arc(x, y, KR, 0, TAU); ink(o.jam ? '#ff8a94' : rim, 4);              // the coloured ring = whose key
  X.beginPath(); X.arc(x, y, KR - 7, 0, TAU); ink(o.mine ? '#fffaf0' : '#d9d5e6', 2.5);
  X.fillStyle = 'rgba(255,255,255,.7)'; el(x - 8, y - 11, 7, 3.5, -.5); X.fill();
  X.font = TYPE(o.mine ? 36 : 30); X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = o.mine ? INK : '#8a84a0'; X.fillText(ch, x, y + 2);
  if (o.jam) { X.strokeStyle = '#e8434f'; X.lineWidth = 3; X.beginPath(); X.moveTo(x - 12, y - 12); X.lineTo(x + 12, y + 12); X.moveTo(x + 12, y - 12); X.lineTo(x - 12, y + 12); X.stroke(); }
}
/* the crush: a pink critter with a bow and eyelashes; mood 'read' | 'huh' | 'love' | 'meh' */
function crush(x, y, u, mood, T, look) {
  const col = '#ff8fc4';
  claude(x, y, u, { col, mood: mood === 'love' ? 'happy' : mood === 'meh' ? 'sad' : null });
  const ey = y - 6.2 * u;
  X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round';
  if (mood === 'read' || mood === 'huh') for (const sx of [-1, 1]) { const ex = x + sx * 2.8 * u; X.beginPath(); X.moveTo(ex - .7 * u, ey - 1.3 * u); X.lineTo(ex - 1.2 * u, ey - 2 * u); X.moveTo(ex + .7 * u, ey - 1.3 * u); X.lineTo(ex + 1.2 * u, ey - 2 * u); X.stroke(); }
  if (mood === 'love') for (const sx of [-1, 1]) heart(x + sx * 2.8 * u, ey + .2 * u, .1 * u * (1 + .15 * Math.sin(T * 14)), '#ff2f6d');
  if (mood !== 'meh') { X.fillStyle = mood === 'love' ? 'rgba(255,60,110,.6)' : 'rgba(255,90,140,.35)'; el(x - 4.6 * u, y - 4.4 * u, 1.3 * u, .7 * u); X.fill(); el(x + 4.6 * u, y - 4.4 * u, 1.3 * u, .7 * u); X.fill(); }
  // the bow
  X.save(); X.translate(x + 3.4 * u, y - 9.2 * u); X.rotate(.2);
  poly([[0, 0], [-2.6 * u, -1.6 * u], [-2.6 * u, 1.4 * u]]); ink('#ff2f6d', 2.5); poly([[0, 0], [2.6 * u, -1.6 * u], [2.6 * u, 1.4 * u]]); ink('#ff2f6d', 2.5);
  X.beginPath(); X.arc(0, 0, .7 * u, 0, TAU); ink('#ff6f9c', 2); X.restore();
  if (mood === 'huh') { X.save(); X.translate(x - 7 * u, y - 12 * u + Math.sin(T * 8) * 2); rr(-14, -16, 28, 30, 10); ink('#fff', 3); X.font = '900 22px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = INK; X.fillText('?', 0, 0); X.restore(); }
}
function book(x, y, u, open) {                             // held in front of the crush's chest
  X.save(); X.translate(x, y);
  poly([[-4.6 * u, -1.4 * u], [0, -.6 * u], [0, 3 * u], [-4.6 * u, 2.2 * u]]); ink('#7c4dff', 2.5);
  poly([[4.6 * u, -1.4 * u], [0, -.6 * u], [0, 3 * u], [4.6 * u, 2.2 * u]]); ink('#7c4dff', 2.5);
  X.fillStyle = '#fffaf0'; poly([[-4 * u, -1 * u], [0, -.3 * u], [0, 2.5 * u], [-4 * u, 1.8 * u]]); X.fill(); poly([[4 * u, -1 * u], [0, -.3 * u], [0, 2.5 * u], [4 * u, 1.8 * u]]); X.fill();
  X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 1.5; for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * .8 * u, (.4 + i * .6) * u); X.lineTo(sx * 3.4 * u, (-.2 + i * .6) * u); X.stroke(); }
  if (open) heart(0, -2.4 * u, .5, '#ff5c8a');
  X.restore();
}
function pigeon(x, y, T, duckK, hat) {
  const bob = Math.sin(T * 5) * 1.5, dy = duckK * 8;
  X.save(); X.translate(x, y + dy);
  el(0, -10, 13, 10); ink('#9aa2c4', 2.5); X.fillStyle = '#7d86ad'; el(4, -9, 7, 5, .3); X.fill();
  X.beginPath(); X.arc(-10, -20 + bob, 7, 0, TAU); ink('#9aa2c4', 2.5); X.fillStyle = '#8ad6b5'; el(-8, -14 + bob, 5, 2.5); X.fill();
  poly([[-16, -21 + bob], [-22, -19 + bob], [-16, -17 + bob]]); ink('#ffb36b', 1.5);
  X.fillStyle = '#fff'; el(-11, -22 + bob, 2.4, 2.4); X.fill(); X.fillStyle = INK; el(-11.5, -22 + bob, 1.2, 1.4); X.fill();
  if (hat) { rr(-16, -36 + bob, 12, 10, 1); ink('#2a2436', 1.5); rr(-19, -27 + bob, 18, 3, 1); ink('#2a2436', 1.5); }
  X.strokeStyle = '#ffb36b'; X.lineWidth = 2; X.beginPath(); X.moveTo(-3, 0); X.lineTo(-3, 4); X.moveTo(3, 0); X.lineTo(3, 4); X.stroke();
  X.restore();
}
/* a paper plane (side view), nose to the right */
function plane(x, y, s, rot, gold) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  poly([[34, 0], [-28, -16], [-14, 2]]); ink(gold ? '#ffe680' : '#fffdf5', 3);
  poly([[34, 0], [-14, 2], [-24, 14]]); ink(gold ? '#e8b923' : '#e7e1cf', 3);
  X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 1.5; X.beginPath(); X.moveTo(30, 0); X.lineTo(-20, -9); X.stroke();
  heart(-8, -5, .38, '#ff2f6d');
  X.restore();
}
function curtains(k) {                                    // k: 0 tied back, 1 shut
  const [wx, wy, ww, wh] = WIN, half = ww / 2;
  X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(wx - 26, wy - 18); X.lineTo(wx + ww + 26, wy - 18); X.stroke(); X.strokeStyle = '#d9944f'; X.lineWidth = 3; X.stroke();
  for (const sd of [-1, 1]) {
    const edge = sd < 0 ? wx - 20 : wx + ww + 20, w = lerp(30, half + 22, k), inner = edge - sd * w, waist = lerp(.45, .98, k);
    X.beginPath(); X.moveTo(edge, wy - 18); X.lineTo(inner, wy - 18);
    X.quadraticCurveTo(lerp(edge, inner, waist) - sd * 6, wy + wh * .55, inner + sd * 4 * (1 - k), wy + wh + 6); X.lineTo(edge, wy + wh + 6); X.closePath(); ink('#c95c8e', 3.5);
    X.strokeStyle = 'rgba(255,255,255,.3)'; X.lineWidth = 4; for (let i = 1; i < 3; i++) { const fx = lerp(edge, inner, i / 3); X.beginPath(); X.moveTo(fx, wy - 10); X.lineTo(lerp(fx, edge, .3 * (1 - k)), wy + wh); X.stroke(); }
    if (k < .5) { X.globalAlpha = 1 - k * 2; rr(lerp(edge, inner, .4) - 10, wy + wh * .55 - 5, 20, 10, 4); ink('#ffe14d', 2); X.globalAlpha = 1; }
  }
}
function zee(x, y, s, a) {
  X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
  X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke();
  X.restore();
}
/* sounds */
const clack = () => { noise(.035, .12, 2600, 1600, 'bandpass', 0, 2); snd(150, .035, 'square', .05, 0, 70); };
const ding = () => { snd(2093, .55, 'sine', .07); snd(4186, .3, 'sine', .02, .01); };
const zip = () => noise(.22, .07, 900, 4200, 'bandpass', 0, 1.6);
const honk = () => { snd(330, .16, 'sawtooth', .05, 0, 200); snd(247, .18, 'square', .04, .1, 150); };

/* ═════════ the game ═════════ */
function duKeys(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), role = D.role;
  /* the level: split the 8 letters 4/4, then pick words that need both halves with at least 2 hand-offs (same draws on both screens) */
  const plan = sp > 1.4 ? [4, 5] : sp > 1.15 ? [4, 4, 4] : [4, 4, 5];       // ~0.8 s per letter + hand-off lag must fit the time
  let left = null, words = null;
  for (let tries = 0; tries < 300 && !words; tries++) {
    const L = LETTERS.slice(); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
    const side = c => L.indexOf(c) < 4 ? 0 : 1, hand = w => { let n = 0; for (let i = 1; i < w.length; i++) if (side(w[i]) !== side(w[i - 1])) n++; return n; };
    const pick = [];
    for (const n of plan) { const ok = WORDS[n].filter(w => !pick.includes(w) && hand(w) >= 2); if (!ok.length) break; pick.push(ok[Math.floor(R() * ok.length)]); }
    if (pick.length === plan.length) { left = L.slice(0, 4).sort(); words = pick; }
  }
  if (!words) { left = ['A', 'L', 'S', 'X']; words = { 45: ['XOXO', 'TAROT'], 444: ['XOXO', 'SOLO', 'ROSE'], 445: ['XOXO', 'SOLO', 'TAROT'] }[plan.join('')]; }   // all >= 2 hand-offs
  const hatPigeon = R() < 1 / 8;                         // a rare extra: the pigeon wears a top hat
  const KEYS = left.concat(LETTERS.filter(c => !left.includes(c)).sort());
  const ownerOf = k => k < 4 ? 0 : 1, mineK = [0, 1, 2, 3].map(i => role === 0 ? i : i + 4), myKeys = mineK.map(k => KEYS[k]);
  const SEQ = []; words.forEach((w, wi) => [...w].forEach((ch, j) => SEQ.push({ ch, k: KEYS.indexOf(ch), o: ownerOf(KEYS.indexOf(ch)), w: wi, j, last: j === w.length - 1 })));
  const N = SEQ.length, NW = words.length;
  const done = SEQ.map(() => false), jit = SEQ.map(() => [(cr() - .5) * 2.4, (cr() - .5) * 2.4, (cr() - .5) * .12]);
  let cur = 0, ending = null, allAt = -1, resAt = -1, nTypo = 0, wordAt = -9, wordW = -1, strikeAt = -9, strikeK = -1, lookAt = -9, waitAt = -9, sparkled = false, bonked = false, lost = false;
  const typos = [], doodles = [], pops = [], bits = [], jamTo = [-9, -9], keyAt = KEYS.map(() => -9), miss = SEQ.map(() => 0);
  const on = [1, 2], hopAt = [-9, -9], hopFrom = [1, 2];             // which key (0..3 of its half) each Claude stands on
  let px = PX - MARG - LW / 2, py = 0, spin = 0, zipped = false;
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const colOf = r => r === role ? myCol() : pCol();

  function view() {                                      // which word is on the print line, and the letter at the print point
    if (wordW >= 0 && g.c - wordAt < RET) return [wordW, words[wordW].length];
    if (cur >= N) return [NW - 1, words[NW - 1].length];
    return [SEQ[cur].w, SEQ[cur].j];
  }
  function pop(s, size, bgc, fg, raw) { pops.length = 0; pops.push({ s, size, bgc, fg, raw, t0: g.c, rot: (cr() - .5) * .14 }); }
  const winAt = () => g.judge ? allAt : g.result === 'win' ? resAt : -1;   // when the win show starts: RIGHT HAND waits for the judge's word
  function hopTo(r, k) { const i = r === 0 ? k : k - 4; if (i === on[r] && g.c - hopAt[r] < .12) return; hopFrom[r] = on[r]; on[r] = i; hopAt[r] = g.c; }
  function typed(i) {
    if (done[i]) return; done[i] = true; strikeAt = g.c; strikeK = SEQ[i].k;
    while (cur < N && done[cur]) cur++;
    clack(); spin += .9;
    const lx = PX, ly = PRINTY; for (let q = 0; q < 3; q++) bits.push({ x: lx + (cr() - .5) * 14, y: ly + 8, vx: (cr() - .5) * 120, vy: -(80 + cr() * 90), r: 2 + cr() * 2, c: '#2a2436', t0: g.c, life: .3 });
    if (SEQ[i].last) { wordAt = g.c; wordW = SEQ[i].w; ding(); if (cur < N) pop(['NICE!', 'SO ROMANTIC!', 'SWOON!'][SEQ[i].w % 3], 30, '#ff4d9e', '#fff'); }
    if (cur >= N && allAt < 0) { allAt = g.c; if (g.judge && !ending) ending = { res: 'win', at: g.c + .35 }; }
  }
  function typo(i, ch, who) {
    if (i < 0 || i >= N || done[i]) return;
    typos.push({ i, ch, at: g.c, rot: (cr() - .5) * .5 }); doodles.push({ w: SEQ[i].w, v: nTypo % 4, at: g.c, n: doodles.filter(d => d.w === SEQ[i].w).length });
    const s = SEQ[i], w = words[s.w]; pop(w.slice(0, s.j) + ch + w.slice(s.j + 1) + '?!', 28, '#e8434f', '#fff', true); nTypo++;   // ROSAS -> "ROTAS?!"
    jamTo[who] = g.c + JAM * (1 + miss[i]++);           // missing the same letter again jams longer: blind mashing runs out of time lookAt = g.c; strikeAt = g.c; strikeK = KEYS.indexOf(ch);
    clack(); honk(); shake(3, .12);
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: 'TYPE!', roleLabel: role === 0 ? 'LEFT HAND' : 'RIGHT HAND',
    hint: role === 0 ? 'YOU HAVE THE 4 LEFT KEYS: TYPE YOUR LETTERS (KEYBOARD OR CLICK) - TAKE TURNS WITH YOUR FRIEND!' : 'YOU HAVE THE 4 RIGHT KEYS: TYPE YOUR LETTERS (KEYBOARD OR CLICK) - TAKE TURNS WITH YOUR FRIEND!',
    thint: role === 0 ? 'YOU HAVE THE 4 LEFT KEYS: TAP YOUR LETTERS - TAKE TURNS WITH YOUR FRIEND!' : 'YOU HAVE THE 4 RIGHT KEYS: TAP YOUR LETTERS - TAKE TURNS WITH YOUR FRIEND!',
    update(dt) {
      g.c += dt; if (g.result && resAt < 0) { resAt = g.c; lost = g.result === 'lose'; if (lost) { sfx.thud(); noise(.3, .06, 1200, 300, 'lowpass', .1); } }
      const [vw, vj] = view(), tx = PX - MARG - LW / 2 - vj * LW, back = tx > px + 1;
      px += (tx - px) * Math.min(1, dt * (back ? 11 : 30)); py += (vw - py) * Math.min(1, dt * 12);
      if (back && tx - px > 40 && !zipped) { zipped = true; zip(); } else if (!back) zipped = false;
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += 700 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = typos.length - 1; i >= 0; i--) if (g.c - typos[i].at > JAM + .05) typos.splice(i, 1);
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      const wa = winAt(), wk = wa >= 0 && !lost ? g.c - wa : -1;
      if (wk > .45 && !sparkled) { sparkled = true; zip(); snd(523, .08, 'triangle', .05); snd(784, .1, 'triangle', .05, .08); }
      if (wk > .8 && !bonked) { bonked = true; sfx.boing(); snd(1047, .14, 'square', .04, .05); snd(1319, .2, 'square', .04, .13); burst(HEADP[0], HEADP[1], '#ff8fc4', 14); ring(HEADP[0], HEADP[1], '#fff', 70, .35); if (!nTypo) floatText('PERFECT!', 400, 150, '#FFE14D', 44); }
      if (g.judge && !g.result) { if (ending && g.c >= Math.min(ending.at, g.limit + TOL)) g.finish(ending.res); else if (!ending && g.c >= g.limit + TOL) g.finish('lose'); }
    },
    msg(type, d) {
      if (g.result || !d) return;
      if (type === 'k') { const i = d.i; if (i >= 0 && i < N && SEQ[i].o !== role) { hopTo(1 - role, SEQ[i].k); keyAt[SEQ[i].k] = g.c; typed(i); } }
      else if (type === 'x') { const k = KEYS.indexOf(d.c); if (k >= 0 && ownerOf(k) !== role) { hopTo(1 - role, k); keyAt[k] = g.c; typo(d.i, d.c, 1 - role); } }
    },
    press(ch) {                                          // returns true when the letter went in
      const k = KEYS.indexOf(ch); if (k < 0 || ownerOf(k) !== role) return false;
      if (g.result || ending || allAt >= 0 || g.c < .12 || g.c >= g.limit - (g.judge ? 0 : TOL)) return false;
      hopTo(role, k); keyAt[k] = g.c;
      if (jamTo[role] > g.c) { jamTo[role] += .2; snd(90, .07, 'square', .05); return false; }   // jammed: the key just clunks, and mashing it jams it longer
      if (cur >= N) return false;
      const s = SEQ[cur];
      if (s.o !== role || g.c - wordAt < RET) { waitAt = g.c; snd(200, .04, 'square', .035); return false; }     // not your letter: the bar hits the guard, nothing typed
      if (s.ch === ch) { const i = cur; typed(i); D.send('k', { i }); return true; }
      typo(cur, ch, role); D.send('x', { i: cur, c: ch }); return false;
    },
    draw() {
      const T = g.c, wa = winAt(), won = wa >= 0 && !lost, wk = won ? T - wa : -1, rk = resAt >= 0 ? T - resAt : -1, sad = lost && rk >= 0;
      if (!BG) BG = buildBg(); if (!TW) TW = buildTw(); X = ctx;
      X.drawImage(BG, 0, 0);
      shrineHearts(T);
      // outside the window: the crush on the balcony (reads a love novel; looks up at a typo; heart eyes when the plane lands)
      const [wx, wy, ww, wh] = WIN;
      X.save(); X.beginPath(); X.rect(wx, wy, ww, wh); X.clip();
      const love = won && wk > .8, walk = sad ? ease((rk - .1) / .6) : 0;
      const mood = love ? 'love' : sad ? 'meh' : T - lookAt < .9 ? 'huh' : 'read';
      const cx = CRX + walk * 120, hb = love ? -Math.abs(Math.sin(T * 9)) * 10 : 0, knock = love && wk < 1.05 ? Math.sin((wk - .8) / .25 * Math.PI) * 6 : 0;
      X.save(); X.translate(cx, CRY + hb + knock); X.rotate(love && wk < 1.05 ? Math.sin(wk * 40) * .05 : 0);
      crush(0, 0, CU, mood, T);
      if (!love) book(0, -4.4 * CU, CU, mood === 'read');
      else { X.save(); X.translate(-6.4 * CU, -3.6 * CU); plane(0, 0, .95, -.5, !nTypo); X.restore(); }   // hugs the letter
      X.restore();
      if (love) { for (let i = 0; i < 3; i++) { const a = T * 7 + i * TAU / 3; star(HEADP[0] + Math.cos(a) * 34, HEADP[1] - 18 + Math.sin(a) * 9, 7, 3, 5, a, '#FFE14D', 2.5); }
        for (let i = 0; i < 4; i++) { const k = ((T * .8 + i * .25) % 1); X.globalAlpha = Math.sin(k * Math.PI); heart(CRX - 50 + i * 32 + Math.sin(T * 3 + i) * 6, CRY - 70 - k * 120, .7 + (i % 2) * .3); X.globalAlpha = 1; } }
      // the balcony railing in front of the crush, the pigeon on it
      X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(wx, CRY - 8); X.lineTo(wx + ww, CRY - 8); X.stroke(); X.strokeStyle = '#ffffff'; X.lineWidth = 3; X.stroke();
      for (let x = wx + 8; x < wx + ww; x += 16) { X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(x, CRY - 6); X.lineTo(x, CRY + 8); X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 2.5; X.stroke(); }
      for (const [fx, fc] of [[wx + 22, '#ff4d6d']]) { rr(fx - 12, CRY - 26, 24, 18, 4); ink('#e07a4a', 2.5); for (let i = -1; i <= 1; i++) { X.beginPath(); X.arc(fx + i * 8, CRY - 32 + Math.abs(i) * 3, 6, 0, TAU); ink(fc, 2); } }
      const flyK = won ? clamp((wk - .45) / .35, 0, 1) : 0;
      pigeon(wx + ww - 30, CRY - 12, T, flyK > .5 && wk < 1.2 ? 1 : 0, hatPigeon);
      X.restore();
      // window frame mullions (in front of everything outside), the curtains, the sill
      X.strokeStyle = INK; X.lineWidth = 10; X.beginPath(); X.moveTo(wx, wy + 96); X.lineTo(wx + ww, wy + 96); X.moveTo(wx + ww / 2, wy); X.lineTo(wx + ww / 2, wy + 96); X.stroke();
      X.strokeStyle = '#fff6ea'; X.lineWidth = 5; X.stroke();
      curtains(sad ? ease((rk - .3) / .5) : 0);
      rr(wx - 22, wy + wh + 2, ww + 44, 16, 5); ink('#fff6ea', 4);
      // the waste basket of failed drafts + the mug
      wasteBasket(T, sad ? rk : -1);
      mug(648, 516, T);
      // the paper (behind the carriage)
      paper(T, won, wk, sad, rk);
      X.drawImage(TW, 0, 0);
      txt('LOVE-O-MATIC', PX, 352, 17, '#ff4d9e', 'center', 132);
      spool(178, 306, spin * 1.3); spool(442, 306, -spin * 1.3);
      typebars(T - strikeAt < .12 ? strikeK : -1, (T - strikeAt) / .12);
      const [vw, vj] = view(), atEnd = T - wordAt < RET;
      carriage(px, atEnd ? 1 : clamp((PX - MARG - LW / 2 - vj * LW - px) / 120, 0, 1));
      if (sad && rk < 1.2) for (let i = 0; i < 3; i++) { const k = ((T * 1.2 + i / 3) % 1); X.globalAlpha = (1 - k) * .8; X.beginPath(); X.arc(PX - 120 + i * 120 + Math.sin(T * 4 + i) * 8, 268 - k * 80, 10 + k * 14, 0, TAU); X.fillStyle = '#ece8f5'; X.fill(); X.globalAlpha = 1; }
      // the keys + the two Claudes stomping on them
      const nx = cur < N && !won && !g.result && !(T - wordAt < RET) ? SEQ[cur] : null;
      for (let k = 0; k < 8; k++) {
        const o = ownerOf(k), mine = o === role, jam = jamTo[o] > T && !g.result;
        keyCap(KX[k], KY, KEYS[k], colOf(o), { down: T - keyAt[k] < .1, lit: !!nx && nx.o === o && mine && !jam, mine, jam });
      }
      for (const r of [0, 1]) claudeOn(r, T, won, wk, sad);
      pill(180, 532, role === 0 ? 'YOU' : 'YOUR FRIEND', colOf(0), true);
      pill(440, 532, role === 1 ? 'YOU' : 'YOUR FRIEND', colOf(1), true);
      // whose turn: a banner over the half that has to press now
      if (nx) {
        const mineNow = nx.o === role, hx = nx.o === 0 ? 180 : 440, bob = Math.abs(Math.sin(T * 7)) * 4;
        badge(mineNow ? 'YOUR TURN!' : 'FRIEND\'S TURN', hx, 370 - bob, 20, mineNow ? '#ff4d9e' : '#8f88a6', '#fff', 1, 0);
      } else if (!g.result && !won && T - wordAt < RET && !lost) badge('DING!', PX, 396, 22, '#ffd23f', '#fff', outBack((T - wordAt) / .12), -.06);
      if (T - waitAt < .45 && !g.result) badge('WAIT!', role === 0 ? 180 : 440, 360, 22, '#8f88a6', '#fff', outBack((T - waitAt) / .15), .08);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .7 ? Math.max(0, 1 - (a - .7) / .3) : 1; badge(q.s, 470, 108 - Math.min(a, .6) * 8, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot, q.raw); X.globalAlpha = 1; }
      // the win show: paper yanked out, folded, flown across the street
      if (won) flight(T, wk);
      for (const b of bits) { X.globalAlpha = clamp(1 - (T - b.t0) / b.life, 0, 1); X.fillStyle = b.c; X.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); } X.globalAlpha = 1;
      if (sad && rk > .5) for (let i = 0; i < 2; i++) { const k = ((T * .7 + i * .5) % 1); zee(wx + ww / 2 + 10 + i * 30 + k * 16, wy + 120 - k * 60, .8 + i * .3, Math.sin(k * Math.PI)); }
      vignette(.14);
    },
    down(p) {                                             // tap / click: the nearest of MY keys, anywhere on the key bed
      if (p.y < 380) return;
      let best = -1, bd = 1e9; for (const k of mineK) { const d = Math.abs(p.x - KX[k]); if (d < bd) { bd = d; best = k; } }
      if (best >= 0 && bd < 70) g.press(KEYS[best]);
    },
    key(e) {
      if (e.repeat || !e.code || e.code.indexOf('Key') !== 0) return;
      const ch = e.code.slice(3); if (myKeys.includes(ch)) g.press(ch);
    },
  };
  function shrineHearts(T) {                              // lipstick hearts round the pinned photo, the pin, a doodle of the crush
    X.save(); X.translate(78, 152); X.rotate(-.08);
    crushMini(0, 14, 3.2, T);
    X.beginPath(); X.arc(0, -52, 6, 0, TAU); ink('#e8434f', 2.5);
    X.restore();
    for (const [hx, hy, s] of [[24, 96, .55], [138, 112, .7], [130, 206, .5], [20, 214, .6]]) heart(hx, hy + Math.sin(T * 2 + hx) * 2, s, '#ff4d7e');
  }
  function crushMini(x, y, u, T) { claude(x, y, u, { col: '#ff8fc4' }); X.save(); X.translate(x + 3.4 * u, y - 9.2 * u); poly([[0, 0], [-2.6 * u, -1.6 * u], [-2.6 * u, 1.4 * u]]); ink('#ff2f6d', 2); poly([[0, 0], [2.6 * u, -1.6 * u], [2.6 * u, 1.4 * u]]); ink('#ff2f6d', 2); X.restore(); }
  function wasteBasket(T, rk) {
    const [bx, by] = BIN;
    for (const [ox, oy, r] of [[-20, -44, 13], [6, -50, 14], [26, -40, 12], [-4, -36, 12]]) ball(bx + ox, by + oy, r, ox);
    if (rk >= 0) {                                         // tonight's draft joins the pile
      const k = clamp((rk - .3) / .35, 0, 1); if (k > 0 && k < 1) { const sx = PX, sy = 150, x = lerp(sx, bx + 4, k), y = lerp(sy, by - 54, k) - Math.sin(k * Math.PI) * 140; ball(x, y, 18, k * 9); }
      else if (k >= 1) ball(bx + 4, by - 58, 16, 3);
    }
    poly([[bx - 40, by - 36], [bx + 40, by - 36], [bx + 32, by + 44], [bx - 32, by + 44]]); ink('#7c8bb8', 3.5);
    X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 2.5; for (let i = -2; i <= 2; i++) { X.beginPath(); X.moveTo(bx + i * 15, by - 32); X.lineTo(bx + i * 12, by + 40); X.stroke(); }
    rr(bx - 44, by - 42, 88, 10, 4); ink('#9aa8d4', 3);
  }
  function ball(x, y, r, a) {                             // a crumpled draft
    X.save(); X.translate(x, y); X.rotate(a || 0);
    X.beginPath(); for (let i = 0; i < 9; i++) { const an = i / 9 * TAU, rr2 = r * (i % 2 ? .82 : 1.05); X.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2); } X.closePath(); ink('#fffdf5', 2.5);
    X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 1.5; X.beginPath(); X.moveTo(-r * .5, -r * .2); X.lineTo(0, r * .2); X.lineTo(r * .4, -r * .3); X.moveTo(-r * .2, r * .5); X.lineTo(r * .3, r * .3); X.stroke();
    X.restore();
  }
  function mug(x, y, T) {
    rr(x - 18, y - 40, 36, 40, 6); ink('#fff', 3); X.beginPath(); X.arc(x + 20, y - 22, 9, -Math.PI / 2, Math.PI / 2); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke();
    heart(x, y - 20, .5, '#ff4d7e');
    X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 2; i++) { X.beginPath(); for (let j = 0; j <= 6; j++) X.lineTo(x - 6 + i * 12 + Math.sin(j + T * 3 + i) * 3, y - 46 - j * 5); X.stroke(); }
  }
  /* the letter on the platen: a greeting, the typed lines above, the line being typed at the print point (guide letters
     underlined in the colour of whoever has to type them), typos in red that get whited out, doodles in the right margin */
  function paper(T, won, wk, sad, rk) {
    if (won && wk > .25) return;                         // gone: flight() draws it now
    let yank = won ? ease((wk - .1) / .15) * 60 : 0, sq = 1;
    if (sad) { sq = 1 - ease(rk / .3); if (sq <= .02) return; }
    const top = PRINTY - (py + 1) * LH - 40, x0 = px;
    X.save();
    if (sad) { X.translate(PX, 150); X.scale(sq, sq); X.rotate((1 - sq) * 2); X.translate(-PX, -150); }
    X.translate(0, -yank);
    X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(x0 + 6, top + 6, PW, PLY - top);
    X.beginPath(); X.moveTo(x0, PLY); X.lineTo(x0, top); X.lineTo(x0 + PW, top); X.lineTo(x0 + PW, PLY); ink('#fffdf5', 3);
    X.save(); X.beginPath(); X.rect(x0, top, PW, PLY - top); X.clip();
    X.strokeStyle = 'rgba(77,184,255,.18)'; X.lineWidth = 1.5; for (let y = PRINTY + 13; y > top + 20; y -= LH / 2) { X.beginPath(); X.moveTo(x0, y); X.lineTo(x0 + PW, y); X.stroke(); }
    X.strokeStyle = 'rgba(255,77,120,.3)'; X.beginPath(); X.moveTo(x0 + MARG - 6, top); X.lineTo(x0 + MARG - 6, PLY); X.stroke();
    heart(x0 + PW - 22, top + 22, .8, '#ff4d7e');
    // greeting
    X.font = TYPE(22); X.textAlign = 'left'; X.textBaseline = 'middle'; X.fillStyle = INK;
    X.fillText(t('MY LOVE,'), x0 + MARG, PRINTY - (py + 1) * LH + 4);
    const [vw] = view(), nx = cur < N && !(T - wordAt < RET) ? cur : -1;
    let idx = 0;
    for (let wi = 0; wi < NW; wi++) {
      const w = words[wi], ly = PRINTY - (py - wi) * LH;
      for (let j = 0; j < w.length; j++, idx++) {
        if (wi > vw) continue;
        const lx = x0 + MARG + LW / 2 + j * LW, s = SEQ[idx];
        if (done[idx]) { const [jx, jy, jr] = jit[idx]; X.save(); X.translate(lx + jx, ly + jy); X.rotate(jr); X.font = TYPE(34); X.textAlign = 'center'; X.fillStyle = INK; X.fillText(s.ch, 0, 0); X.restore(); }
        else if (wi === vw) {                            // a pencil guide + the owner's colour underneath
          if (idx === nx) { const pulse = 1 + .08 * Math.sin(T * 12); X.save(); X.translate(lx, ly); X.scale(pulse, pulse); rr(-15, -20, 30, 38, 7); ink(s.o === role ? '#fff3a8' : '#ece9f5', 2); X.restore(); }
          X.font = TYPE(34); X.textAlign = 'center'; X.fillStyle = idx === nx ? 'rgba(20,16,28,.55)' : 'rgba(20,16,28,.2)'; X.fillText(s.ch, lx, ly);
          X.fillStyle = colOf(s.o); rr(lx - 11, ly + 16, 22, 5, 2.5); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.5; X.stroke();
        }
      }
      // doodles of this line's typos in the right margin
      for (const d of doodles) if (d.w === wi && wi <= vw) { const k = outBack((T - d.at) / .25); X.save(); X.translate(x0 + MARG + w.length * LW + 30 + (d.n % 2) * 28, ly - 2 - Math.floor(d.n / 2) * 6); X.rotate(-.15 + d.n * .2); X.scale(.8 * k, .8 * k); DOODLES[d.v](); X.restore(); }
    }
    // typos: the silly letter in red at its spot, then a blob of correction fluid, then the carriage backs up
    for (const q of typos) {
      const s = SEQ[q.i]; if (s.w !== vw) continue; const a = T - q.at, lx = x0 + MARG + LW / 2 + s.j * LW, ly = PRINTY - (py - s.w) * LH;
      X.save(); X.translate(lx + 2, ly - 2); X.rotate(q.rot); X.font = TYPE(38); X.textAlign = 'center'; X.fillStyle = '#e8434f'; X.fillText(q.ch, 0, 0); X.restore();
      if (a > JAM * .5) { const k = ease((a - JAM * .5) / (JAM * .4)); X.save(); X.translate(lx, ly); X.scale(k, k); el(0, 0, 17, 21, .2); ink('#ffffff', 2); X.restore(); }
    }
    X.restore();
    X.restore();
  }
  /* the win show: the sheet is yanked up, folds into a plane (a white flash), arcs across the street, bonks the crush */
  function flight(T, wk) {
    const fx = PX - 10, fy = 110;
    if (wk < .25) return;
    if (wk < .45) {                                       // folding: the sheet narrows, its top corners fold down
      const k = ease((wk - .25) / .2), w = lerp(PW * .7, 40, k), h = lerp(170, 40, k);
      X.save(); X.translate(fx, fy); X.rotate(-k * .4);
      poly([[-w / 2, h / 2], [-w / 2, -h / 2 + h * .4 * k], [0, -h / 2], [w / 2, -h / 2 + h * .4 * k], [w / 2, h / 2]]); ink('#fffdf5', 3);
      X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 2; X.beginPath(); X.moveTo(0, -h / 2); X.lineTo(0, h / 2); X.stroke();
      X.restore(); return;
    }
    const k = clamp((wk - .45) / .35, 0, 1);
    if (k < 1) {
      const x = lerp(fx, HEADP[0], k), y = lerp(fy, HEADP[1] - 6, k) - Math.sin(k * Math.PI) * 70, rot = Math.atan2((HEADP[1] - fy) - Math.cos(k * Math.PI) * 70 * Math.PI, HEADP[0] - fx) * .6;
      if (wk - .45 < .08) ring(fx, fy, '#fff', 50, .2);
      X.globalAlpha = .5; for (let i = 1; i <= 3; i++) { const q = Math.max(0, k - i * .05); circ(lerp(fx, HEADP[0], q), lerp(fy, HEADP[1] - 6, q) - Math.sin(q * Math.PI) * 70, 5 - i, '#fff', 0); } X.globalAlpha = 1;
      plane(x, y, 1.4, rot, !nTypo);
    }
    if (wk > .8 && wk < 1.4) { const a = wk - .8; badge('BONK!', HEADP[0] - 46, HEADP[1] - 74 - a * 20, 26, '#ff4d9e', '#fff', a < .15 ? outBack(a / .15) : 1, -.12); }
  }
  /* a Claude on top of its current key: hops key to key, stomps, gets dizzy on a jam, cheers or droops at the end */
  function claudeOn(r, T, won, wk, sad) {
    const base = r === 0 ? 0 : 4, k = clamp((T - hopAt[r]) / .1, 0, 1), xa = KX[base + hopFrom[r]], xb = KX[base + on[r]];
    let x = lerp(xa, xb, ease(k)), y = KY - KR + 2 - Math.sin(k * Math.PI) * (xa === xb ? 10 : 22);
    const stomp = T - keyAt[base + on[r]] < .1; if (stomp) y += 7;
    const jam = jamTo[r] > T && !g.result, cheer = won && wk > .8;
    if (cheer) y -= Math.abs(Math.sin(T * 9 + r)) * 14;
    const sq = stomp ? 1.15 : 1;
    X.save(); X.translate(x, y); X.scale(sq, 2 - sq);
    shadow(0, 2, 18, 4, .25);
    claude(0, 0, 3, { col: colOf(r), mood: cheer ? 'happy' : sad || jam ? 'sad' : null });
    X.restore();
    if (jam) for (let i = 0; i < 3; i++) { const a = T * 8 + i * TAU / 3; star(x + Math.cos(a) * 18, y - 34 + Math.sin(a) * 5, 6, 2.5, 5, a, '#FFE14D', 2); }
    if (sad) { X.globalAlpha = .9; el(x + 14, y - 26 + ((T * 30) % 10), 3, 4.5); ink('#9fe3ff', 2); X.globalAlpha = 1; }
  }
  g.dbg = {
    keys: myKeys, N, words, KEYS,
    next: () => cur < N && g.c - wordAt >= RET ? { i: cur, ch: SEQ[cur].ch, mine: SEQ[cur].o === role, jam: jamTo[role] > g.c } : null,   // what the print point shows: the letter + whose colour it is (nothing while the carriage returns)
    cur: () => cur, typos: () => nTypo,
  };
  wire(g, D, 0, sp, 'du_keys');
  return g;
}
reg('du_keys', duKeys, 'SPLIT KEYBOARD'); REGMAP.du_keys.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 3.2 s loop typing XOXO, X left, O right ───────────── */
const DKX = [62, 118, 174, 230, 290, 346, 402, 458], DKEYS = ['A', 'L', 'S', 'X', 'E', 'O', 'R', 'T'];
function demo(role, T) {
  X = ctx;
  X.fillStyle = '#ffd3e0'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#ffc2d4'; for (let x = 0; x < 520; x += 40) X.fillRect(x, 0, 18, 240);
  const u = T % 3.2, n = Math.min(4, Math.floor(u / .55)), word = 'XOXO';
  // the sheet
  rr(150, 14, 220, 96, 4); ink('#fffdf5', 3);
  X.font = TYPE(34); X.textAlign = 'center'; X.textBaseline = 'middle';
  for (let j = 0; j < 4; j++) {
    const lx = 215 + j * 30, who = j % 2 ? 1 : 0;
    if (j < n) { X.fillStyle = INK; X.fillText(word[j], lx, 66); }
    else { if (j === n) { rr(lx - 14, 46, 28, 38, 6); ink(who === role ? '#fff3a8' : '#ece9f5', 2); } X.fillStyle = 'rgba(20,16,28,.25)'; X.fillText(word[j], lx, 66); }
    X.fillStyle = who ? '#6EA8FE' : '#FFC93C'; rr(lx - 10, 84, 20, 5, 2.5); X.fill();
  }
  if (n >= 4) { const k = (u - 2.2) / 1; heart(260, 40 - k * 20, .8 + k * .4, '#ff4d7e'); }
  // the split key bed
  poly([[40, 140], [500, 140], [516, 226], [24, 226]]); ink('#62bfa9', 3.5);
  X.fillStyle = '#ffd3e0'; poly([[258, 140], [264, 140], [262, 226], [256, 226]]); X.fill();
  const tapI = n < 4 ? n : -1, ph = (u % .55) / .55, tapK = tapI >= 0 ? (tapI % 2 ? 5 : 3) : -1, pressNow = tapI >= 0 && ph > .55;
  for (let k = 0; k < 8; k++) {
    const o = k < 4 ? 0 : 1, mine = o === role, x = DKX[k], y = 178 + (pressNow && k === tapK ? 5 : 0);
    if (tapI >= 0 && (tapI % 2) === o && mine) { X.globalAlpha = .5; X.beginPath(); X.arc(x, y, 30, 0, TAU); X.fillStyle = '#fff6a8'; X.fill(); X.globalAlpha = 1; }
    X.beginPath(); X.arc(x, y + 4, 22, 0, TAU); ink('#8f96a8', 3); X.beginPath(); X.arc(x, y, 22, 0, TAU); ink(o ? '#6EA8FE' : '#FFC93C', 3);
    X.beginPath(); X.arc(x, y, 16, 0, TAU); ink(mine ? '#fffaf0' : '#d9d5e6', 2); X.font = TYPE(mine ? 26 : 22); X.fillStyle = mine ? INK : '#8a84a0'; X.fillText(DKEYS[k], x, y + 1);
  }
  claude(DKX[tapI >= 0 && tapI % 2 === 0 ? 3 : 1], 154, 2, { col: '#FFC93C' }); claude(DKX[tapI >= 0 && tapI % 2 === 1 ? 5 : 6], 154, 2, { col: '#6EA8FE' });
  txt(role === 0 ? 'YOU' : 'YOUR FRIEND', 75, 40, 18, '#FFC93C', 'center', 130); txt(role === 1 ? 'YOU' : 'YOUR FRIEND', 445, 40, 18, '#6EA8FE', 'center', 130);
  if (tapI >= 0 && (tapI % 2) === role) demoFinger(DKX[tapK], 196, pressNow, (ph - .55) / .45);
  else demoFinger(DKX[role === 0 ? 1 : 6], 200, false);
}
DUO.INFO.du_keys = [['LEFT HAND', 'TYPE THE LEFT LETTERS', 'TAKE TURNS, LETTER BY LETTER'], ['RIGHT HAND', 'TYPE THE RIGHT LETTERS', 'TAKE TURNS, LETTER BY LETTER']];
DUO.DEMOS.du_keys = [T => demo(0, T), T => demo(1, T)];

})();
