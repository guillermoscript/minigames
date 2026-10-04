'use strict';
/* ═════════ DUO · SWITCH PANIC (du_rails), after Junction Jumble (WarioWare: Move It!) ═════════
   A toy railway in a steamy valley. Five trains leave the tunnel on the left, cross TWO switches and must end in the shed of their
   colour, where the cargo is expected: cow in pyjamas -> barn, grandma on a sofa -> bingo hall, wedding cake -> chapel, cactus -> greenhouse.
   The steam splits what each player knows, so neither can do it alone:
   TUNNEL SIDE (role 0): sees every train's colour (a lamp over the tunnel shows the next one early) and owns the first switch (UPPER /
     LOWER line), but the right half of the valley (the second switch and the sheds) is lost in steam: it has no idea where a colour
     lives. It raises a coloured FLAG for each train (keys 1-4 / tap a flag), and sets its switch the way the friend calls back.
   STATION SIDE (role 1, JUDGE): sees the sheds, but the tunnel is in the steam and every train comes out of it under a tarp, loco grey
     with soot: no colours. It reads the friend's flag and taps the shed of that colour (keys 1-4, ↑ ↓ + Space, click / tap the shed).
     That pick does two things: it sets its own switch for that train (which shed of the pair) and calls the line (▲ / ▼) back to the
     tunnel side, who has to throw the first switch before the train gets there.
   Wrong shed = the cargo is flung into the wrong building: CRASH, the team loses. Deliver all five before the time runs out.
   Netcode: 'fl {i, c}' (tunnel -> station: the flag for train i) and 'pk {i, k}' (back: the shed picked for it, k = line*2 + shed) are
   the conversation. The owner of a switch decides which way each train goes when the loco's nose reaches it, on its own screen, and
   relays it: 'a {i, a}' (tunnel side -> station side) and 'b {i, b}' (back). Until that answer arrives the train keeps rolling INSIDE the
   steam that hides the friend's switch (and waits in there if the answer is late), so nobody ever sees a train change its mind. The
   station side owns the last switch, so it judges every arrival ('arr {i, ok, n}') and the round ('end' via DUO.wire). */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box (x<310, y<170), LEAVE at the top right, y>552) ───────────── */
const MAINY = 356, LY = [246, 467], ROWS = [192, 300, 412, 522];   // main line, the two lines after switch A, the four shed tracks
const JAX = 230, JBX = 520, DOORX = 700, PORTX = 46;              // switch A, switch B, shed doors, tunnel mouth
const BFOGX = 362;                                                // station side: everything left of this is steam
const AFOGX = 470;                                                // tunnel side: everything right of this (switch B, the sheds) is steam
const LOCO = 70, CPL = 8, WAG = 62, TLEN = LOCO + CPL + WAG;      // a train = loco + one flat wagon
const NT = 5, V = 175, GAP = 1.55, FIRST = .9;                   // FIRST: the first train waits a moment (both lamps lit) so the flag can go round
const ACX = 104, ACY = 508, ALX = 168;                            // the tunnel side's signalman + lever
const BCX = 412, BCY = 398, BLX = 470;                            // the station side's signalman + lever
const SMX = 604, SMY = 384, SMS = .85;                            // the station master's feet (on the grass between the B forks) + size
const FLAGS = [0, 1, 2, 3].map(c => [238 + c * 62, 516]);         // tunnel side: the four flag buttons
const FPX = 398, FPY = 226;                                       // station side: the flag pole at the edge of the steam (foot)
const CBX = 352, CBY = 356;                                       // tunnel side: the board where the friend's call (▲ / ▼) lights up
const LEAD = 1.4;                                                 // a tunnel lamp lights this long (s at speed 1) before its train starts

/* colours: [base, shade, light]; each colour IS a shed type and a cargo */
const COL = [['#ff5a4f', '#c0332c', '#ffaaa3'], ['#4db8ff', '#2b7cc4', '#b0e2ff'], ['#ffd23f', '#d49a10', '#fff0a8'], ['#5fd068', '#2f9440', '#b8f0b4']];
const SOOT = ['#a9a3b8', '#7d7790', '#cfcadb'];                    // a train the station side cannot read yet (c = -1)
const pal = c => c < 0 ? SOOT : COL[c];
const HAPPY = ['MOO!', 'BINGO!', 'I DO!', 'HOME!'];

/* ───────────── track geometry: polylines with cumulative length ───────────── */
function line(a, x0, y0, x1, y1) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 16)); for (let i = a.length ? 1 : 0; i <= n; i++) a.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]); return a; }
function bez(a, p0, p1, p2, p3, n = 26) {
  for (let i = a.length ? 1 : 0; i <= n; i++) { const k = i / n, u = 1 - k; a.push([0, 1].map(j => u * u * u * p0[j] + 3 * u * u * k * p1[j] + 3 * u * k * k * p2[j] + k * k * k * p3[j])); }
  return a;
}
function mkPath(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; }
function at(P, s) {
  s = clamp(s, 0, P.len); let lo = 0, hi = P.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.cum[m] <= s) lo = m; else hi = m; }
  const a = P.pts[lo], b = P.pts[hi], k = (s - P.cum[lo]) / Math.max(1e-6, P.cum[hi] - P.cum[lo]);
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])];
}
function sAtX(P, x) {
  for (let i = 1; i < P.pts.length; i++) if (P.pts[i][0] >= x) { const a = P.pts[i - 1], b = P.pts[i]; return P.cum[i - 1] + (P.cum[i] - P.cum[i - 1]) * clamp((x - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1); }
  return P.len;
}
const MAIN = mkPath(line([], -150, MAINY, JAX, MAINY));
const AP = LY.map(y => mkPath(line(bez([], [JAX, MAINY], [JAX + 64, MAINY], [JAX + 58, y], [JAX + 124, y]), JAX + 124, y, JBX, y)));
const BP = LY.map((y, a) => [0, 1].map(b => { const ys = ROWS[a * 2 + b]; return mkPath(line(bez([], [JBX, y], [JBX + 56, y], [JBX + 54, ys], [JBX + 112, ys]), JBX + 112, ys, 960, ys)); }));
const LM = MAIN.len, LA = AP.map(p => p.len);
const DOOR = BP.map(r => r.map(p => sAtX(p, DOORX)));                                    // nose at the shed door = arrival
const HOLDA = Math.min(...AP.map(p => sAtX(p, BFOGX - 40)));                            // station side: the line is not known yet -> wait in the steam
const HOLDB = BP.map(r => Math.min(...r.map(p => sAtX(p, 594))));                       // tunnel side: the shed is not known yet -> wait in the steam
const EMERGE = sAtX(MAIN, PORTX);
const slotOf = (stCol, c) => stCol.indexOf(c);

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function poly(pts) { X.beginPath(); pts.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.closePath(); }
function stroke(pts, col, w) { X.beginPath(); pts.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.strokeStyle = col; X.lineWidth = w; X.lineJoin = 'round'; X.lineCap = 'round'; X.stroke(); }
function pill(x, y, label, col) {                    // a name tag with a little pointer up, e.g. YOU / YOUR FRIEND
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(150, X.measureText(s).width + 24);
  X.beginPath(); X.moveTo(x - 8, y - 12); X.lineTo(x, y - 22); X.lineTo(x + 8, y - 12); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 14);
}
/* a word on a chunky coloured badge (feedback that stays readable over any background) */
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(260, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 260);
  X.restore();
}
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;

/* ───────────── the cargo (bottom-centre at 0,0, about 56 wide) ───────────── */
function cow(T, awake) {
  // a cow asleep in striped pyjamas, lying on the deck
  X.save(); el(-2, -15, 25, 14); ink('#a8d4ff', 3); X.clip(); X.fillStyle = '#6f9fe6'; for (let i = -30; i < 30; i += 9) X.fillRect(i, -32, 4, 34); X.restore();
  X.fillStyle = '#fff'; for (const bx of [-12, 8]) { el(bx, -3, 4, 4); ink('#fff', 2.5); }                   // hooves poking out
  X.fillStyle = INK; for (const bx of [-12, 8]) X.fillRect(bx - 3, -2, 6, 2.5);
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-26, -16); X.quadraticCurveTo(-36, -22, -32, -30); X.stroke();   // tail
  X.save(); X.translate(19, -24);
  el(0, 0, 12, 11); ink('#fff', 3); X.fillStyle = INK; el(4, -4, 5, 4, .4); X.fill();
  el(7, 6, 8, 6); ink('#ffb3c7', 2.5); X.fillStyle = '#c96a85'; el(5, 6, 1.6, 1.6); X.fill(); el(10, 6, 1.6, 1.6); X.fill();
  X.strokeStyle = INK; X.lineWidth = 2.6; X.beginPath();
  if (awake) { X.arc(-4, -1, 2.6, 0, TAU); X.moveTo(5, -2); X.arc(3, -2, 2.6, 0, TAU); X.stroke(); }
  else { X.moveTo(-7, -1); X.quadraticCurveTo(-4, 2, -1, -1); X.moveTo(1, -2); X.quadraticCurveTo(4, 1, 7, -2); X.stroke(); }
  X.beginPath(); X.moveTo(-10, -6); X.lineTo(-16, -9); X.lineTo(-11, -2); X.closePath(); ink('#fff', 2.4);            // ear
  // nightcap flopping back, with a pompom
  X.beginPath(); X.moveTo(-9, -6); X.quadraticCurveTo(-2, -16, 8, -9); X.quadraticCurveTo(0, -24, -18, -22 + Math.sin(T * 3) * 2); X.closePath(); ink('#ff5d7a', 2.6);
  X.fillStyle = '#fff'; X.fillRect(-9, -8, 16, 3);
  X.beginPath(); X.arc(-19, -22 + Math.sin(T * 3) * 2, 4.5, 0, TAU); ink('#fff', 2.4);
  X.restore();
  if (!awake) { X.globalAlpha = .9; txt('z', 34 + Math.sin(T * 2) * 3, -46 - (T * 12) % 10, 14, '#fff'); X.globalAlpha = 1; }
}
function granny(T) {
  // a purple sofa with grandma knitting on it
  rr(-27, -36, 54, 24, 9); ink('#b45ad0', 3); X.fillStyle = '#d58cf0'; rr(-22, -32, 44, 6, 3); X.fill();
  rr(-29, -16, 58, 13, 5); ink('#9a42b8', 3);
  for (const sx of [-1, 1]) { rr(sx * 26 - 7, -26, 14, 22, 6); ink('#c46ee0', 3); }
  X.fillStyle = INK; X.fillRect(-24, -3, 5, 4); X.fillRect(19, -3, 5, 4);
  el(0, -21, 10, 9); ink('#ff8cc6', 3);                                                                          // cardigan
  X.beginPath(); X.arc(0, -36, 9, 0, TAU); ink('#ffd9b8', 3);                                                    // head
  el(0, -45, 9, 5); ink('#d8d4e6', 2.5); X.beginPath(); X.arc(0, -51, 5, 0, TAU); ink('#d8d4e6', 2.5);          // hair + bun
  X.strokeStyle = INK; X.lineWidth = 2; for (const ex of [-4, 4]) { X.beginPath(); X.arc(ex, -36, 3.6, 0, TAU); X.stroke(); }
  X.beginPath(); X.moveTo(-.4, -36); X.lineTo(.4, -36); X.stroke();
  X.beginPath(); X.arc(0, -32, 3, .2, Math.PI - .2); X.stroke();
  const k = Math.sin(T * 12) * 2;                                                                                // knitting needles click
  X.lineWidth = 2.4; X.beginPath(); X.moveTo(-8, -14 + k); X.lineTo(8, -24 - k); X.moveTo(8, -14 - k); X.lineTo(-8, -24 + k); X.stroke();
  X.beginPath(); X.arc(16, -14, 5, 0, TAU); ink('#ff5d7a', 2); X.strokeStyle = '#c23552'; X.lineWidth = 1.4; X.beginPath(); X.arc(16, -14, 3, 0, 3); X.stroke();
}
function cake(T) {
  const drip = (x, y, w) => { X.fillStyle = '#ff8fc4'; X.beginPath(); X.moveTo(x, y); for (let i = 0; i <= 6; i++) X.lineTo(x + w * i / 6, y + (i % 2 ? 5 : 1)); X.lineTo(x + w, y - 2); X.lineTo(x, y - 2); X.fill(); };
  rr(-24, -16, 48, 16, 4); ink('#fffaf0', 3); drip(-24, -15, 48);
  rr(-17, -30, 34, 14, 4); ink('#fffaf0', 3); drip(-17, -29, 34);
  rr(-10, -42, 20, 12, 4); ink('#fffaf0', 3); drip(-10, -41, 20);
  X.fillStyle = '#ff5d9e'; for (const [x, y] of [[-16, -6], [0, -6], [16, -6], [-9, -21], [9, -21]]) { X.beginPath(); X.arc(x, y, 2.4, 0, TAU); X.fill(); }
  // the couple on top: a groom and a bride
  const b = Math.sin(T * 5) * 1.2;
  rr(-8, -56 + b, 6, 13, 2); ink('#3b3550', 2); X.beginPath(); X.arc(-5, -59 + b, 3.4, 0, TAU); ink('#ffd9b8', 2);
  X.beginPath(); X.moveTo(1, -43); X.lineTo(9, -43); X.lineTo(6, -56 - b); X.lineTo(4, -56 - b); X.closePath(); ink('#fff', 2); X.beginPath(); X.arc(5, -59 - b, 3.4, 0, TAU); ink('#ffd9b8', 2);
  X.beginPath(); X.arc(0, -66, 3, 0, TAU); ink('#ff5c8a', 1.5);
}
function cactus(T) {
  X.beginPath(); X.moveTo(-14, -14); X.lineTo(14, -14); X.lineTo(10, 0); X.lineTo(-10, 0); X.closePath(); ink('#e07a45', 3); X.fillStyle = '#c45f2f'; X.fillRect(-14, -14, 28, 4);
  const sway = Math.sin(T * 2.2) * .06;
  X.save(); X.translate(0, -14); X.rotate(sway);
  rr(-20, -30, 10, 18, 5); ink('#48b858', 3); rr(-14, -18, 8, 8, 3); ink('#48b858', 0);                         // left arm
  rr(10, -38, 10, 20, 5); ink('#48b858', 3);                                                                       // right arm
  rr(-9, -48, 18, 48, 9); ink('#48b858', 3); X.fillStyle = '#7fe08a'; rr(-5, -44, 5, 36, 2.5); X.fill();
  X.fillStyle = '#48b858'; X.fillRect(-12, -18, 6, 6); X.fillRect(6, -26, 6, 6);
  X.fillStyle = INK; for (const [x, y] of [[-4, -16], [5, -8], [-2, -30], [3, -40], [-16, -24], [15, -30]]) X.fillRect(x, y, 1.6, 3);
  rr(-11, -38, 22, 7, 3); ink(INK, 0); el(-5, -34, 5, 4); ink('#22222e', 2); el(5, -34, 5, 4); ink('#22222e', 2);   // sunglasses
  X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(-7, -36, 3, 1.6); X.fillRect(3, -36, 3, 1.6);
  X.strokeStyle = INK; X.lineWidth = 2.2; X.beginPath(); X.arc(0, -26, 4, .3, Math.PI - .3); X.stroke();
  for (let i = 0; i < 5; i++) { X.save(); X.translate(0, -50); X.rotate(i * TAU / 5 + T); el(0, -4, 2.6, 4.4); ink('#ff7ab8', 1.4); X.restore(); }
  X.beginPath(); X.arc(0, -50, 2.4, 0, TAU); ink('#ffe14d', 1.2);
  X.restore();
}
function cargo(c, T, awake) { X.save(); X.lineJoin = 'round'; X.lineCap = 'round'; [cow, granny, cake, cactus][c](T, awake); X.restore(); }

/* ───────────── the train (local frame: x forward, y=0 on the rail) ───────────── */
function wheel(x, y, r, a, col) {
  X.beginPath(); X.arc(x, y, r, 0, TAU); ink(col, 2.6);
  X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); for (let i = 0; i < 3; i++) { const q = a + i * TAU / 3; X.moveTo(x - Math.cos(q) * r * .7, y - Math.sin(q) * r * .7); X.lineTo(x + Math.cos(q) * r * .7, y + Math.sin(q) * r * .7); } X.stroke();
  X.beginPath(); X.arc(x, y, 2.4, 0, TAU); X.fillStyle = INK; X.fill();
}
/* mood: 'calm' | 'happy' | 'scared' | 'dizzy' */
function loco(c, T, s, mood, tilt) {                // c = -1: grey with soot (the station side cannot read it yet)
  const [base, shade, light] = pal(c), wa = s / 9;
  X.save(); X.rotate(tilt || 0);
  for (const wx of [-22, -2]) wheel(wx, -9, 9, wa, '#e8434f'); wheel(19, -7, 7, wa * 1.3, '#e8434f');
  rr(-38, -16, 82, 8, 3); ink('#3b3550', 3);                                                                      // chassis
  const ra = wa, px = Math.cos(ra) * 5, py = Math.sin(ra) * 5;                                                    // the coupling rod goes round and round
  X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(-22 + px, -9 + py); X.lineTo(-2 + px, -9 + py); X.stroke(); X.strokeStyle = '#d8dbe4'; X.lineWidth = 2.5; X.stroke();
  // cab
  rr(-36, -52, 30, 40, 5); ink(shade, 3.5); X.fillStyle = base; rr(-34, -50, 24, 36, 4); X.fill();
  rr(-31, -46, 17, 14, 4); ink('#bff0ff', 2.6); X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(-29, -44, 4, 9);
  rr(-40, -58, 38, 9, 4); ink('#3b3550', 3);
  // boiler
  rr(-8, -42, 46, 28, 13); ink(base, 3.5);
  X.save(); rr(-8, -42, 46, 28, 13); X.clip(); X.fillStyle = shade; X.fillRect(-10, -22, 60, 10); X.fillStyle = light; X.fillRect(-4, -39, 36, 5); X.fillStyle = shade; X.fillRect(8, -44, 4, 32); X.fillRect(24, -44, 4, 32); X.restore();
  el(37, -28, 5, 13); ink('#3b3550', 3);                                                                          // smokebox door
  X.beginPath(); X.moveTo(18, -42); X.lineTo(28, -42); X.lineTo(31, -56); X.lineTo(15, -56); X.closePath(); ink('#3b3550', 3);   // chimney
  rr(12, -61, 22, 7, 3); ink('#3b3550', 3);
  X.beginPath(); X.arc(4, -42, 8, Math.PI, 0); X.closePath(); ink('#ffd23f', 2.6);                               // brass dome
  X.beginPath(); X.moveTo(38, -16); X.lineTo(50, -3); X.lineTo(38, -3); X.closePath(); ink(shade, 2.6);           // cowcatcher
  X.beginPath(); X.arc(41, -44, 5, 0, TAU); ink('#fff6a8', 2.4);                                                 // headlamp
  // face on the front of the boiler
  const ey = -30;
  for (const ex of [16, 28]) {
    if (mood === 'happy') { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(ex - 5, ey + 2); X.quadraticCurveTo(ex, ey - 6, ex + 5, ey + 2); X.stroke(); continue; }
    if (mood === 'dizzy') { X.strokeStyle = INK; X.lineWidth = 2.2; X.beginPath(); for (let i = 0; i < 12; i++) { const q = i * .8 + T * 14, r = i * .45; X.lineTo(ex + Math.cos(q) * r, ey + Math.sin(q) * r); } X.stroke(); continue; }
    el(ex, ey, 5.5, 7); ink('#fff', 2.2);
    const big = mood === 'scared' ? 1.8 : 3; X.fillStyle = INK; el(ex + 1.5, ey + (mood === 'scared' ? 0 : 1), big, big + .6); X.fill();
  }
  X.strokeStyle = INK; X.lineWidth = 2.6; X.beginPath();
  if (mood === 'scared' || mood === 'dizzy') { X.ellipse(24, -19, 3.5, 2.6, 0, 0, TAU); } else { X.moveTo(17, -20); X.quadraticCurveTo(23, -15, 30, -20); }
  X.stroke();
  if (mood === 'scared') { X.fillStyle = '#9fe3ff'; el(10, -40 + (T * 40) % 8, 2.6, 3.6); ink('#9fe3ff', 1.6); }
  X.restore();
}
function wagonCar(c, T, s, hasCargo, awake, tag) {   // c = -1: the cargo is under a tarp; tag: the shed the station side picked for it
  const wa = s / 7;
  wheel(-18, -7, 7, wa, '#e8434f'); wheel(18, -7, 7, wa, '#e8434f');
  rr(-31, -19, 62, 10, 3); ink('#b3743f', 3); X.fillStyle = '#8a5530'; X.fillRect(-29, -12, 58, 2);
  X.fillStyle = pal(c)[0]; rr(-31, -19, 8, 10, 2); X.fill(); rr(23, -19, 8, 10, 2); X.fill();                  // colour tags on the deck ends
  if (!hasCargo) return;
  if (c >= 0) { X.save(); X.translate(0, -19); X.scale(.88, .88); cargo(c, T, awake); X.restore(); return; }
  tarp(0, -19, T);
  if (tag !== undefined && tag !== null) { X.beginPath(); X.arc(0, -40, 9, 0, TAU); ink(COL[tag][0], 2.4); X.fillStyle = 'rgba(255,255,255,.6)'; el(-3, -43, 3, 2, -.5); X.fill(); }
  else txt('?', 1, -38, 17, '#efe6c2');
}
/* a lumpy tarp roped over the cargo, a stencilled ? on it (bottom-centre at x, y) */
function tarp(x, y, T, rot) {
  X.save(); X.translate(x, y); X.rotate(rot || 0); const w = Math.sin(T * 7) * 1.2;
  X.beginPath(); X.moveTo(-29, 1); X.quadraticCurveTo(-33, -26, -16, -34 + w); X.quadraticCurveTo(-4, -46, 8, -38); X.quadraticCurveTo(26, -40, 28, -18); X.lineTo(29, 1); X.closePath(); ink('#8f9a6a', 3);
  X.fillStyle = '#7a8456'; X.beginPath(); X.moveTo(-26, -2); X.quadraticCurveTo(-24, -20, -12, -26); X.lineTo(-8, -2); X.closePath(); X.fill();
  X.fillStyle = 'rgba(255,255,255,.22)'; el(-6, -34, 9, 3.4, -.3); X.fill();
  X.strokeStyle = '#d8c79a'; X.lineWidth = 2.4; X.beginPath(); X.moveTo(-18, 1); X.quadraticCurveTo(-20, -18, -12, -32); X.moveTo(16, 1); X.quadraticCurveTo(19, -18, 14, -34); X.stroke();
  X.restore();
}

/* ───────────── the sheds (door / left edge at x=0, track level y=0) ───────────── */
function shed(c, T, o) {
  const [base, shade, light] = COL[c];
  X.save(); X.translate(0, 0);
  rr(-4, -6, 112, 20, 5); ink('#a49cb5', 3);                                                                     // stone footing
  X.fillStyle = '#8b839c'; for (let i = 0; i < 5; i++) X.fillRect(8 + i * 22, -2, 3, 12);
  if (c === 0) {                       // RED BARN (gambrel roof, white X door, hay loft, rooster weathervane)
    rr(0, -50, 104, 46, 3); ink(base, 3.5); X.fillStyle = shade; for (let x = 6; x < 104; x += 12) X.fillRect(x, -48, 2.5, 42);
    poly([[-6, -48], [8, -66], [52, -76], [96, -66], [110, -48]]); ink(shade, 3.5);
    X.strokeStyle = '#fff'; X.lineWidth = 3; X.beginPath(); X.moveTo(-2, -50); X.lineTo(10, -64); X.lineTo(52, -73); X.lineTo(94, -64); X.lineTo(106, -50); X.stroke();
    rr(44, -66, 18, 14, 2); ink('#3b2a22', 2.5); X.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) X.fillRect(46 + i * 4, -58 - (i % 2) * 3, 2, 6);
    rr(60, -40, 32, 36, 2); ink('#fff', 3); X.save(); rr(63, -37, 26, 30, 1); X.clip(); X.fillStyle = base; X.fillRect(63, -37, 26, 30); X.restore();
    X.strokeStyle = '#fff'; X.lineWidth = 3.5; X.beginPath(); X.moveTo(63, -37); X.lineTo(89, -7); X.moveTo(89, -37); X.lineTo(63, -7); X.stroke();
    X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(52, -76); X.lineTo(52, -88); X.stroke();
    X.save(); X.translate(52, -90); X.rotate(Math.sin(T * 1.5) * .3); X.beginPath(); X.moveTo(-8, 0); X.lineTo(6, 0); X.lineTo(8, -6); X.lineTo(3, -9); X.lineTo(0, -4); X.lineTo(-6, -6); X.closePath(); ink('#3b3550', 1.6); X.restore();
  } else if (c === 1) {                // BLUE BINGO HALL (flat roof, light-bulb sign, round windows)
    rr(0, -56, 104, 52, 4); ink(base, 3.5); X.fillStyle = shade; X.fillRect(2, -16, 100, 4);
    rr(-4, -62, 112, 9, 3); ink(shade, 3);
    rr(38, -86, 66, 24, 6); ink('#3b2d5e', 3);
    const on = o.lit ? 1 : (Math.floor(T * 4) % 2);
    for (let i = 0; i < 7; i++) { X.fillStyle = (i + Math.floor(T * 6)) % 3 === 0 || o.lit ? '#fff6a8' : '#8d7bb8'; X.beginPath(); X.arc(44 + i * 9, -84, 2, 0, TAU); X.fill(); }
    txt('BINGO', 71, -72, 14, on ? '#ffe14d' : '#ff9f1c', 'center', 56);
    for (const wx of [62, 88]) { X.beginPath(); X.arc(wx, -34, 9, 0, TAU); ink(o.lit ? '#fff6a8' : '#bfe6ff', 3); X.strokeStyle = shade; X.lineWidth = 2; X.beginPath(); X.moveTo(wx - 9, -34); X.lineTo(wx + 9, -34); X.stroke(); }
    X.save(); X.translate(20, -62); X.rotate(T * .8); X.beginPath(); X.arc(0, -6, 7, 0, TAU); ink('#fff', 2.4); txt('7', 0, -5, 9, INK); X.restore();
  } else if (c === 2) {                // YELLOW WEDDING CHAPEL (pointy roof, bell tower, rose window, heart)
    rr(0, -52, 104, 48, 3); ink('#fff3d6', 3.5);
    poly([[-6, -50], [52, -78], [110, -50]]); ink(base, 3.5); X.fillStyle = light; poly([[8, -53], [52, -74], [60, -70], [20, -53]]); X.fill();
    rr(72, -86, 22, 36, 2); ink('#fff3d6', 3); poly([[68, -84], [83, -104], [98, -84]]); ink(base, 3);
    const sw = Math.sin(T * 6) * (o.lit ? .5 : .12); X.save(); X.translate(83, -76); X.rotate(sw); X.beginPath(); X.moveTo(-6, 6); X.quadraticCurveTo(-6, -6, 0, -6); X.quadraticCurveTo(6, -6, 6, 6); X.closePath(); ink('#ffb627', 2.2); X.restore();
    X.beginPath(); X.arc(40, -32, 11, 0, TAU); ink('#ff8fc4', 3); X.strokeStyle = '#fff'; X.lineWidth = 2; for (let i = 0; i < 4; i++) { const q = i * Math.PI / 4; X.beginPath(); X.moveTo(40 + Math.cos(q) * 11, -32 + Math.sin(q) * 11); X.lineTo(40 - Math.cos(q) * 11, -32 - Math.sin(q) * 11); X.stroke(); }
    X.beginPath(); X.moveTo(64, -4); X.lineTo(64, -26); X.arc(76, -26, 12, Math.PI, 0); X.lineTo(88, -4); X.closePath(); ink('#c98a3a', 3);
    heart(76, -50, .55);
  } else {                             // GREEN GREENHOUSE (glass panes, arched roof, plants inside)
    X.beginPath(); X.moveTo(0, -4); X.lineTo(0, -46); X.quadraticCurveTo(52, -86, 104, -46); X.lineTo(104, -4); X.closePath(); ink('rgba(196,246,214,.92)', 3.5);
    X.save(); X.clip();
    X.fillStyle = shade; for (const [px, r] of [[22, 14], [44, 18], [70, 15], [92, 12]]) { X.beginPath(); X.arc(px, -6, r, Math.PI, 0); X.fill(); }
    X.fillStyle = base; for (const [px, r] of [[30, 10], [58, 12], [84, 9]]) { X.beginPath(); X.arc(px, -4, r, Math.PI, 0); X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.moveTo(14, -50); X.lineTo(24, -50); X.lineTo(8, -8); X.lineTo(2, -8); X.fill();
    X.restore();
    X.strokeStyle = '#ffffff'; X.lineWidth = 2.5; for (let x = 20; x < 104; x += 20) { X.beginPath(); X.moveTo(x, -4); X.lineTo(x, -46 - Math.sin(x / 104 * Math.PI) * 18); X.stroke(); }
    X.beginPath(); X.moveTo(0, -28); X.lineTo(104, -28); X.stroke();
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, -46); X.quadraticCurveTo(52, -86, 104, -46); X.stroke();
    X.beginPath(); X.arc(52, -70, 6, 0, TAU); ink(base, 2.4);
  }
  // the doorway the train goes into (dark arch on the left)
  X.beginPath(); X.moveTo(-2, 4); X.lineTo(-2, -26); X.quadraticCurveTo(-2, -44, 16, -44); X.quadraticCurveTo(34, -44, 34, -26); X.lineTo(34, 4); X.closePath(); ink('#2a2238', 3.5);
  X.fillStyle = 'rgba(255,255,255,.08)'; X.fillRect(2, -30, 28, 4);
  if (o.lit) { X.globalAlpha = .45 + .3 * Math.sin(T * 10); X.fillStyle = '#fff6a8'; X.beginPath(); X.moveTo(2, 2); X.lineTo(2, -26); X.quadraticCurveTo(2, -40, 16, -40); X.quadraticCurveTo(30, -40, 30, -26); X.lineTo(30, 2); X.fill(); X.globalAlpha = 1; }
  // a sign at the door with what this shed expects (colour + cargo)
  X.save(); X.translate(16, -64); rr(-17, -14, 34, 26, 7); ink(base, 3); X.translate(0, 9); X.scale(.36, .36); cargo(c, T, true); X.restore();
  X.restore();
}

/* ───────────── people ───────────── */
/* the station master: round, moustache, peaked cap, whistle. mood: idle | cheer | worry | shock | faint | angry */
function stationMaster(x, y, T, mood, k) {
  X.save(); X.translate(x, y); X.scale(SMS, SMS);
  if (mood === 'faint') { X.rotate(-ease(k / .45) * 1.45); X.translate(0, -Math.sin(clamp(k / .45, 0, 1) * Math.PI) * 10); }   // keels over to the left, onto the grass
  const hop = mood === 'cheer' ? -Math.abs(Math.sin(T * 12)) * 8 : 0, shk = mood === 'angry' ? Math.sin(T * 40) * 1.5 : 0;
  X.translate(shk, hop);
  shadow(0, 2 - hop, 22, 5, .2);
  for (const lx of [-8, 8]) { rr(lx - 5, -16, 10, 16, 3); ink('#2d3a6e', 2.6); rr(lx - 7, -4, 14, 6, 3); ink(INK, 0); }
  const armsUp = mood === 'cheer' || mood === 'shock' || mood === 'faint';
  for (const sx of [-1, 1]) { X.save(); X.translate(sx * 20, -46); X.rotate(armsUp ? sx * 2.5 + Math.sin(T * 14) * .2 : mood === 'angry' && sx > 0 ? -1.2 : sx * .35); rr(-5, 0, 10, 24, 5); ink('#3a4b8c', 2.6); X.beginPath(); X.arc(0, 26, 5.5, 0, TAU); ink('#ffd9b8', 2.4); X.restore(); }
  el(0, -36, 23, 25); ink('#3a4b8c', 3);                                                                          // coat + belly
  X.fillStyle = '#5267b0'; el(-8, -44, 8, 10, -.4); X.fill();
  X.fillStyle = '#ffd23f'; for (const by of [-50, -38, -26]) { X.beginPath(); X.arc(0, by, 2.6, 0, TAU); X.fill(); }
  if (mood === 'angry') { X.save(); X.translate(14, -30); X.beginPath(); X.arc(0, 0, 8, 0, TAU); ink('#ffe14d', 2.4); X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -5); X.moveTo(0, 0); X.lineTo(4, 2); X.stroke(); X.restore(); }
  // head
  const face = mood === 'angry' ? '#ff9a7a' : '#ffd9b8';
  X.beginPath(); X.arc(0, -68, 16, 0, TAU); ink(face, 3);
  X.fillStyle = 'rgba(255,120,140,.45)'; el(-10, -63, 5, 3); X.fill(); el(10, -63, 5, 3); X.fill();
  // eyes
  X.strokeStyle = INK; X.fillStyle = INK; X.lineWidth = 2.6; X.lineCap = 'round';
  for (const ex of [-6, 6]) {
    if (mood === 'faint') { heart(ex, -71, .32); continue; }
    if (mood === 'cheer') { X.beginPath(); X.moveTo(ex - 4, -69); X.quadraticCurveTo(ex, -75, ex + 4, -69); X.stroke(); continue; }
    if (mood === 'angry') { X.beginPath(); X.moveTo(ex - 4 * Math.sign(ex), -76); X.lineTo(ex + 4 * Math.sign(ex), -73); X.stroke(); }
    const big = mood === 'shock' || mood === 'worry'; el(ex, -71, big ? 4.2 : 2.6, big ? 5 : 3.4); if (big) { ink('#fff', 1.6); X.fillStyle = INK; el(ex, -71, 1.6, 2); } X.fill();
  }
  // moustache + mouth (+ whistle when cheering)
  X.beginPath(); X.moveTo(0, -64); X.quadraticCurveTo(-10, -66, -16, -58 + Math.sin(T * 3) * 1.5); X.quadraticCurveTo(-8, -60, 0, -61); X.quadraticCurveTo(8, -60, 16, -58 - Math.sin(T * 3) * 1.5); X.quadraticCurveTo(10, -66, 0, -64); ink('#6b4a33', 2);
  if (mood === 'shock' || mood === 'faint') { el(0, -54, 4, 5); ink('#7a2a3a', 2); }
  else if (mood === 'cheer') { rr(-3, -58, 16, 6, 3); ink('#ffd23f', 2); }
  // cap (flies off on a shock)
  const capY = mood === 'shock' ? -Math.min(1, k / .25) * 30 : mood === 'faint' ? -ease(k / .3) * 22 : 0, capR = mood === 'shock' ? k * 6 : 0;
  X.save(); X.translate(0, -82 + capY); X.rotate(capR);
  rr(-17, -10, 34, 12, 5); ink('#2d3a6e', 3); X.beginPath(); X.ellipse(4, 2, 20, 5, 0, 0, Math.PI); ink('#1d2448', 2.4);
  X.beginPath(); X.arc(0, -4, 4, 0, TAU); ink('#ffd23f', 1.8);
  X.restore();
  if (mood === 'angry') for (const sx of [-1, 1]) { const q = (T * 2.4) % 1; X.globalAlpha = 1 - q; X.beginPath(); X.arc(sx * (20 + q * 10), -76 - q * 18, 4 + q * 5, 0, TAU); ink('#fff', 1.8); X.globalAlpha = 1; }
  if (mood === 'worry') { X.fillStyle = '#9fe3ff'; el(16, -78 + (T * 30) % 10, 3, 4); ink('#9fe3ff', 1.5); }
  X.restore();
}
/* the lever stand: a slot with a fat knob that is UP (upper line) or DOWN (lower line), with two arrow lamps */
function leverStand(x, y, k, col, live, T) {
  rr(x - 24, y - 92, 48, 92, 10); ink('#5d5672', 3.5); X.fillStyle = '#756c8e'; rr(x - 20, y - 88, 40, 8, 4); X.fill();
  rr(x - 5, y - 78, 10, 62, 5); ink('#2a2238', 2.4);
  const ky = lerp(y - 72, y - 22, k);
  X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.moveTo(x, ky); X.lineTo(x + 16, ky - 16 + k * 2); X.stroke(); X.strokeStyle = '#c9ced6'; X.lineWidth = 4; X.stroke();
  X.beginPath(); X.arc(x + 18, ky - 18 + k * 2, 11, 0, TAU); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.5)'; el(x + 14, ky - 22 + k * 2, 4, 3, -.5); X.fill();
  for (const [ay, dn] of [[y - 70, 0], [y - 24, 1]]) {
    const on = Math.round(k) === dn; X.save(); X.translate(x - 38, ay); if (dn) X.scale(1, -1);
    X.beginPath(); X.moveTo(0, -11); X.lineTo(11, 7); X.lineTo(-11, 7); X.closePath(); ink(on ? '#5CFF7A' : '#5d5672', 2.6); X.restore();
  }
  if (live) { X.globalAlpha = .4 + .3 * Math.sin(T * 8); X.strokeStyle = '#fff'; X.lineWidth = 4; rr(x - 54, y - 100, 90, 108, 14); X.stroke(); X.globalAlpha = 1; }
}
/* a signalman (Claude) next to its lever: yanks on a flip, cheers on a delivery, gasps at a crash */
function signalman(x, y, u, col, T, flipK, mood) {
  const hop = flipK > 0 && flipK < 1 ? Math.sin(flipK * Math.PI) * 8 : 0, sq = flipK > 0 && flipK < .25 ? 1 + .15 * (1 - flipK / .25) : 1;
  X.save(); X.translate(x, y - hop); X.scale(sq, 2 - sq); shadow(0, hop, 26, 5, .22);
  claude(0, 0, u, { col, mood });
  X.restore();
}
/* puffy steam: a set of circles inked as one shape */
function cloud(circles, fill, shade) {
  X.lineJoin = 'round';
  for (const [x, y, r] of circles) { X.beginPath(); X.arc(x, y, r, 0, TAU); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); }
  for (const [x, y, r] of circles) { X.beginPath(); X.arc(x, y, r, 0, TAU); X.fillStyle = shade; X.fill(); }
  for (const [x, y, r] of circles) { X.beginPath(); X.arc(x - r * .12, y - r * .16, r * .86, 0, TAU); X.fillStyle = fill; X.fill(); }
}

/* ───────────── the static scene, painted once per round (the sheds' order comes from the seed) ───────────── */
function trackPts(P, s0, s1) { const a = []; for (let s = s0; s < s1; s += 8) a.push(at(P, s)); a.push(at(P, s1)); return a; }
function offset(pts, d) { return pts.map(([x, y, an]) => [x - Math.sin(an) * d, y + Math.cos(an) * d]); }
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, '#5ec4f5'); g.addColorStop(1, '#d4f3ff'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  // far mountains with snow
  X.fillStyle = '#9fb6e8'; X.beginPath(); X.moveTo(0, 170); for (const [x, y] of [[0, 120], [90, 70], [170, 118], [280, 58], [390, 124], [470, 84], [560, 130], [650, 74], [740, 118], [800, 96], [800, 170]]) X.lineTo(x, y); X.closePath(); X.fill();
  X.fillStyle = '#fff'; for (const [x, y] of [[90, 70], [280, 58], [470, 84], [650, 74]]) { X.beginPath(); X.moveTo(x - 20, y + 16); X.lineTo(x, y); X.lineTo(x + 20, y + 16); X.lineTo(x + 8, y + 12); X.lineTo(x, y + 18); X.lineTo(x - 8, y + 12); X.closePath(); X.fill(); }
  X.fillStyle = '#8fd6a0'; X.beginPath(); X.moveTo(0, 190); for (let x = 0; x <= W; x += 20) X.lineTo(x, 150 - Math.sin(x * .013 + 1) * 14 - Math.sin(x * .031) * 6); X.lineTo(W, 200); X.closePath(); X.fill();
  // the valley floor
  g = X.createLinearGradient(0, 150, 0, 600); g.addColorStop(0, '#9be36a'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(0, 160, W, 440);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); for (let x = 0; x <= W; x += 20) X.lineTo(x, 162 - Math.sin(x * .013 + 1) * 4); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.1)'; for (let i = -4; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, 600); X.lineTo(i * 90 + 45, 600); X.lineTo(i * 90 + 145, 166); X.lineTo(i * 90 + 100, 166); X.fill(); }
  // flowers + tufts
  const tuft = (x, y) => { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9, y - 10); X.moveTo(x, y); X.lineTo(x, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 10); X.stroke(); };
  for (const [x, y] of [[300, 300], [380, 200], [610, 356], [300, 540], [450, 545], [26, 560], [250, 430], [620, 470]]) tuft(x, y);
  for (const [x, y, c] of [[340, 310, '#fff'], [470, 190, '#ff8fc4'], [262, 520, '#ffe14d'], [600, 545, '#fff'], [380, 520, '#ff8fc4']]) { for (let i = 0; i < 5; i++) { el(x + Math.cos(i * 1.26) * 4, y + Math.sin(i * 1.26) * 4, 3, 3); X.fillStyle = c; X.fill(); } el(x, y, 2.4, 2.4); X.fillStyle = '#ffb627'; X.fill(); }
  // gravel beds, then sleepers, then rails (the beds of all lines merge into one outline)
  const lines = [trackPts(MAIN, 0, LM), ...AP.map(p => trackPts(p, 0, p.len)), ...BP.flat().map((p, i) => trackPts(p, 0, DOOR[i >> 1][i & 1] + 20))];
  for (const L of lines) stroke(L, INK, 38);
  for (const L of lines) stroke(L, '#cdb894', 30);
  for (const L of lines) stroke(offset(L, 9), 'rgba(140,110,80,.25)', 8);
  for (const L of lines) for (let i = 0; i < L.length; i += 2) { const [x, y, an] = L[i]; X.save(); X.translate(x, y); X.rotate(an); rr(-4, -14, 8, 28, 2); ink('#8a5a34', 1.6); X.restore(); }
  for (const L of lines) for (const d of [-7, 7]) stroke(offset(L, d), INK, 7);
  for (const L of lines) for (const d of [-7, 7]) { stroke(offset(L, d), '#a7aebb', 3.5); stroke(offset(L, d - 1), 'rgba(255,255,255,.55)', 1.2); }
  // buffer stops are hidden in the sheds; no signposts: which colour lives where is only known by the station side (it sees the sheds)
  // the hill with the tunnel
  X.beginPath(); X.moveTo(-10, 430); X.quadraticCurveTo(-10, 214, 70, 236); X.quadraticCurveTo(130, 252, 124, 330); X.quadraticCurveTo(122, 420, 90, 440); X.closePath(); ink('#72c25a', 4);
  X.fillStyle = '#8fd673'; X.beginPath(); X.moveTo(10, 260); X.quadraticCurveTo(60, 236, 96, 262); X.quadraticCurveTo(60, 252, 14, 276); X.fill();
  for (const [x, y] of [[30, 286], [96, 300], [14, 410]]) { el(x, y, 9, 7); ink('#b8b0c8', 2.5); }
  X.beginPath(); X.moveTo(PORTX - 14, MAINY + 14); X.lineTo(PORTX - 14, MAINY - 30); X.quadraticCurveTo(PORTX - 14, MAINY - 50, PORTX + 2, MAINY - 50); X.quadraticCurveTo(PORTX + 18, MAINY - 50, PORTX + 18, MAINY - 30); X.lineTo(PORTX + 18, MAINY + 14); X.closePath();
  X.fillStyle = '#1d1828'; X.fill(); X.fillStyle = '#2e2740'; X.fillRect(PORTX - 14, MAINY - 8, 32, 6);
  X = old; return cv2;
}
/* the tunnel mouth goes on top of the trains (they come out of it) */
function portal(T, lamps) {
  X.beginPath(); X.moveTo(PORTX - 30, MAINY + 14); X.lineTo(PORTX - 30, MAINY - 34); X.quadraticCurveTo(PORTX - 30, MAINY - 66, PORTX + 2, MAINY - 66); X.quadraticCurveTo(PORTX + 34, MAINY - 66, PORTX + 34, MAINY - 34); X.lineTo(PORTX + 34, MAINY + 14);
  X.lineTo(PORTX + 16, MAINY + 14); X.lineTo(PORTX + 16, MAINY - 30); X.quadraticCurveTo(PORTX + 16, MAINY - 48, PORTX + 2, MAINY - 48); X.quadraticCurveTo(PORTX - 12, MAINY - 48, PORTX - 12, MAINY - 30); X.lineTo(PORTX - 12, MAINY + 14); X.closePath();
  ink('#b8b0c8', 3.5);
  X.strokeStyle = '#8f87a3'; X.lineWidth = 2; for (const [x, y] of [[PORTX - 22, MAINY - 20], [PORTX - 22, MAINY], [PORTX + 24, MAINY - 20], [PORTX + 24, MAINY], [PORTX + 2, MAINY - 58]]) { X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x + 6, y); X.stroke(); }
  // the lamps over the arch: the next train's colour (big) and the one after it (small), each with my flag once I raised one
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(PORTX + 2, MAINY - 66); X.lineTo(PORTX + 2, MAINY - 78); X.moveTo(PORTX + 2, MAINY - 80); X.lineTo(PORTX + 40, MAINY - 80); X.stroke();
  for (let n = 1; n >= 0; n--) {
    const tr = lamps[n], x = n ? PORTX + 40 : PORTX + 2, y = n ? MAINY - 82 : MAINY - 90, r = n ? 9 : 13;
    X.beginPath(); X.arc(x, y, r, 0, TAU); ink(tr ? COL[tr.c][0] : '#5d5672', n ? 2.5 : 3);
    if (!tr) continue;
    if (!n) { X.globalAlpha = .35 + .35 * Math.sin(T * 12); X.beginPath(); X.arc(x, y, 20 + (T >= tr.t0 ? 4 : 0), 0, TAU); X.fillStyle = COL[tr.c][2]; X.fill(); X.globalAlpha = 1; }
    X.fillStyle = 'rgba(255,255,255,.7)'; el(x - r * .3, y - r * .3, r * .3, r * .22, -.5); X.fill();
    if (tr.fl !== null) pennant(x + r - 2, y - r + 4, tr.fl, T, (T - tr.flAt) / .25, .55);
  }
}

/* ═════════ the game ═════════ */
function duRails(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), tunnel = D.role === 0, TS = Math.sqrt(sp), v = V * TS;
  /* which shed sits on which track, then the five trains' colours. Rules: each switch has to flip at least twice, the idle position
     (both UP) is wrong for at least one train of each switch, the first train already needs a flip, no colour three times in a row */
  const stCol = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [stCol[i], stCol[j]] = [stCol[j], stCol[i]]; }
  const need = c => { const k = slotOf(stCol, c); return [k >> 1, k & 1]; };
  let seq = [];
  for (let tries = 0; tries < 500; tries++) {
    seq = Array.from({ length: NT }, () => Math.floor(R() * 4));
    const as = seq.map(c => need(c)[0]), bs = seq.map(c => need(c)[1]), flips = q => q.reduce((n, x, i) => n + (i && x !== q[i - 1] ? 1 : 0), 0);
    const run3 = seq.some((c, i) => i > 1 && c === seq[i - 1] && c === seq[i - 2]);
    if (flips(as) >= 2 && flips(bs) >= 2 && as.includes(1) && bs.includes(1) && (as[0] || bs[0]) && !run3) break;
    if (tries === 499) seq = [3, 0, 2, 1, 3].map(k => stCol[k]);
  }
  const jit = seq.map(() => (R() - .5) * .24), rare = R() < 1 / 8;   // rare: the station master has a parrot
  /* fl: the flag the tunnel side raised for a train (a colour), pk: the shed the station side picked for it (line * 2 + shed) */
  const trains = seq.map((c, i) => ({ i, c, t0: (FIRST + i * GAP + jit[i]) / TS, s: 0, a: null, b: null, fl: null, pk: null, flAt: -9, pkAt: -9, arr: -1, ok: null, gone: false, on: false, puffAt: 0, crash: -1 }));
  const sw = [0, 0], swK = [0, 0], flipAt = [-9, -9];
  const bits = [], pops = [], puffs = [], flying = [], tarps = [];
  let delivered = 0, crashAt = -1, winAt = -1, resAt = -1, ending = null, halt = false, cheerAt = -9, BG = null;
  let cur = 0, hov = -1, shrugAt = -9; const btnAt = [-9, -9, -9, -9];   // station: keyboard cursor / mouse hover over a shed; when each flag / shed was last pressed
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const roleCol = r => (r === D.role ? myCol() : pCol());

  function pop(s, x, y, bgc, fg, size) { pops.length = 0; pops.push({ s, x, y, bgc, fg, size: size || 30, t0: g.c, rot: (cr() - .5) * .16 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, rot: 0, vr: 0, sh: 0 }, o)); }
  function posOf(tr, s) {                     // a point of the route s px from the start, or null where the route is not decided yet
    if (s <= LM) return at(MAIN, s);
    if (tr.a === null) return null; s -= LM;
    if (s <= LA[tr.a]) return at(AP[tr.a], s);
    if (tr.b === null) return null; return at(BP[tr.a][tr.b], s - LA[tr.a]);
  }
  const doorS = tr => LM + LA[tr.a] + DOOR[tr.a][tr.b];
  /* the tunnel side: the trains whose colours the two lamps over the arch show (NEXT, THEN: a lamp lights LEAD s before its train
     starts and goes out as it leaves the tunnel), and every train it can see before its switch */
  const lampTrains = () => trains.filter(tr => !tr.gone && tr.s < EMERGE + 10 && g.c > tr.t0 - LEAD / TS).slice(0, 2);
  function seenT() { const lt = lampTrains(); return trains.filter(tr => tr.a === null && !tr.gone && ((tr.on && tr.s >= EMERGE - 4) || lt.includes(tr))); }
  /* a flag is for the first train seen without one; with none left, it corrects the last flag the friend has not answered yet */
  function flagTarget() { const vis = seenT(); return vis.find(tr => tr.fl === null) || vis.reverse().find(tr => tr.pk === null) || null; }
  /* the station side answers the flags in order; with none waiting, a pick corrects the last answer for a train still before its switch */
  const flagUp = () => trains.find(tr => tr.fl !== null && tr.pk === null && tr.b === null) || null;
  const pickTarget = () => flagUp() || [...trains].reverse().find(tr => tr.pk !== null && tr.b === null) || null;
  function arrive(tr) {
    tr.arr = g.c; const k = tr.a * 2 + tr.b, sc = stCol[k]; tr.ok = sc === tr.c; tr.shed = k;
    const sx = DOORX + 52, sy = ROWS[k] - 40;
    // on the tunnel side the sheds are in the steam: words pop up in one place over it, so they never tell which row a colour lives in
    const [px, py] = tunnel ? [620, 200] : [sx, sy - 70];
    if (tr.ok) {
      delivered++; shedFx[k].hit = g.c; cheerAt = g.c;
      snd(988, .09, 'triangle', .06); snd(1319, .14, 'triangle', .05, .09);                                       // ding-ding
      [() => { snd(140, .35, 'sawtooth', .05, .05, 110); }, () => { snd(660, .1, 'square', .04, .05); snd(880, .1, 'square', .04, .15); }, () => { snd(784, .12, 'sine', .06, .05); snd(1047, .2, 'sine', .05, .17); }, () => sfx.boing()][tr.c]();
      pop(HAPPY[tr.c], px, py, COL[tr.c][1], '#fff');
      for (let i = 0; i < 8; i++) bit({ sh: 1, x: DOORX + 16, y: ROWS[k] - 20, vx: -40 + cr() * 160, vy: -(200 + cr() * 200), r: 4 + cr() * 3, c: ['#fff', COL[tr.c][0], '#ffe14d'][i % 3], vr: (cr() - .5) * 12 });
      if (!tunnel) { ring(DOORX + 16, ROWS[k] - 20, '#fff', 50, .3); const p = posOf(tr, tr.s - LOCO - CPL - WAG / 2); if (p) tarps.push({ x: p[0], y: p[1] - 19, t0: g.c }); }   // the tarp flies off: ta-da, a cow
      if (delivered >= NT && winAt < 0) winAt = g.c;
    } else {                                   // wrong shed: the train slams the door frame, the cargo flies into the building
      crashAt = g.c; halt = true; tr.crash = g.c;
      flying.push({ c: tr.c, k, t0: g.c, from: posOf(tr, tr.s - LOCO - CPL - WAG / 2), to: [sx + 4, sy - 16] });
      noise(.25, .1, 1200, 300, 'bandpass'); snd(1400, .25, 'sawtooth', .04, 0, 600); shake(6, .2);
      pop('WRONG SHED!', 560, 150, '#e8434f', '#fff', 28);
    }
  }
  function land(f) {                          // the cargo lands in the wrong building
    const sf = shedFx[f.k]; sf.crash = g.c; sf.stuck = f.c;
    sfx.thud(); noise(.4, .12, 900, 120, 'lowpass'); snd(90, .3, 'sawtooth', .07, 0, 40); shake(12, .4);
    for (let i = 0; i < 12; i++) bit({ sh: i % 3 ? 0 : 2, x: f.to[0], y: f.to[1], vx: (cr() - .5) * 380, vy: -(160 + cr() * 300), r: 4 + cr() * 5, c: i % 2 ? COL[stCol[f.k]][0] : '#8f87a3', vr: (cr() - .5) * 16, life: .9 });
    for (let i = 0; i < 5; i++) puffs.push({ x: f.to[0] + (cr() - .5) * 60, y: f.to[1] + (cr() - .5) * 20, t0: g.c, r: 16 + cr() * 14, vy: -30 - cr() * 30, life: 1.2, dark: true });
    pop('CRASH!', tunnel ? 620 : 588, tunnel ? 210 : Math.max(156, ROWS[f.k] - 84), '#e8434f', '#FFE14D', 40);
  }
  const shedFx = [0, 1, 2, 3].map(() => ({ hit: -9, crash: -1, stuck: null }));
  const busy = () => g.result || ending || halt || g.c < .05;

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: tunnel ? 'FLAG IT!' : 'PICK THE SHED!', roleLabel: tunnel ? 'TUNNEL SIDE' : 'STATION SIDE',
    hint: tunnel ? '1-4: FLAG THE TRAIN\'S COLOUR · SPACE: SWITCH AS YOUR FRIEND SAYS' : 'CLICK (OR 1-4) THE SHED OF YOUR FRIEND\'S FLAG',
    thint: tunnel ? 'TAP THE TRAIN\'S FLAG · TAP ELSEWHERE: SWITCH AS YOUR FRIEND SAYS' : 'TAP THE SHED OF YOUR FRIEND\'S FLAG',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) resAt = T;
      if (!tunnel) {                            // my blade follows the pick of the next train that will reach it
        const nb = trains.find(tr => !tr.gone && tr.b === null && tr.pk !== null);
        if (nb && (nb.pk & 1) !== sw[1]) { sw[1] = nb.pk & 1; flipAt[1] = T; snd(sw[1] ? 260 : 330, .06, 'square', .04, 0, sw[1] ? 180 : 420); }
      }
      for (let r = 0; r < 2; r++) swK[r] += (sw[r] - swK[r]) * Math.min(1, dt * 22);
      for (const tr of trains) {
        if (T < tr.t0 || tr.gone) continue;
        if (!tr.on) { tr.on = true; if (tunnel) { snd(740, .16, 'triangle', .035, .25); snd(932, .2, 'triangle', .035, .25); } }
        if (halt) continue;
        let ns = tr.s + v * dt;
        if (tunnel && tr.a === null && tr.s < LM && ns >= LM) { tr.a = sw[0]; D.send('a', { i: tr.i, a: tr.a }); snd(320, .05, 'square', .03); }
        if (!tunnel && tr.a === null) ns = Math.min(ns, LM + HOLDA);
        if (tr.a !== null) {
          const jb = LM + LA[tr.a];
          if (!tunnel && tr.b === null && tr.s < jb && ns >= jb) { tr.b = tr.pk !== null ? tr.pk & 1 : 0; D.send('b', { i: tr.i, b: tr.b }); snd(320, .05, 'square', .03); }
          if (tunnel && tr.b === null) ns = Math.min(ns, jb + HOLDB[tr.a]);
        }
        if (tr.arr >= 0 && !tr.ok) continue;
        tr.s = ns;
        if (tr.a !== null && tr.b !== null) {
          if (tr.arr < 0 && tr.s >= doorS(tr)) { arrive(tr); if (!tr.ok) tr.s = doorS(tr) - 4; if (!tunnel) { D.send('arr', { i: tr.i, ok: tr.ok ? 1 : 0, n: delivered }); if (!ending) { if (!tr.ok) ending = { res: 'lose', at: T + .5 }; else if (delivered >= NT) ending = { res: 'win', at: T + .35 }; } } }
          if (tr.arr >= 0 && tr.ok && tr.s > doorS(tr) + TLEN + 12) tr.gone = true;
        }
        if (T - tr.puffAt > .26 && tr.s > EMERGE + 20) { tr.puffAt = T; const p = posOf(tr, tr.s - LOCO / 2); if (p) { const ca = Math.cos(p[2]), sa = Math.sin(p[2]); puffs.push({ x: p[0] + 22 * ca + 64 * sa, y: p[1] + 22 * sa - 64 * ca, t0: T, r: 7 + cr() * 4, vy: -46, vx: -30, life: .8 }); } }
      }
      for (const f of flying) if (!f.landed && T - f.t0 >= .45) { f.landed = true; land(f); }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
      for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.y += p.vy * dt; p.x += (p.vx || 0) * dt; if (T - p.t0 > p.life) puffs.splice(i, 1); }
      if (pops.length && T - pops[0].t0 > 1.1) pops.length = 0;
      if (!tunnel && !g.result) { if (ending && T >= Math.min(ending.at, g.limit)) g.finish(ending.res); else if (!ending && T >= g.limit) g.finish('lose'); }
    },
    msg(type, d) {
      const tr = d && trains[d.i]; if (!tr) return;
      if (type === 'fl' && !tunnel) { if (tr.pk === null && tr.b === null) { tr.fl = clamp(d.c | 0, 0, 3); tr.flAt = g.c; snd(560, .07, 'triangle', .04); snd(700, .09, 'triangle', .035, .06); } }
      else if (type === 'pk' && tunnel) { tr.pk = clamp(d.k | 0, 0, 3); tr.pkAt = g.c; snd(880, .06, 'square', .03); snd(660, .08, 'square', .03, .07); }
      else if (type === 'a' && !tunnel) { if (tr.a === null) tr.a = d.a ? 1 : 0; }
      else if (type === 'b' && tunnel) { if (tr.b === null) tr.b = d.b ? 1 : 0; }
      /* 'arr': the tunnel side works the same arrival out from the same switches; nothing to do */
    },
    flip(to) {                                  // tunnel side, my switch: to = 0 / 1, or toggle
      if (!tunnel || busy()) return false;
      const n = to === undefined ? 1 - sw[0] : to; if (n === sw[0]) return false;
      sw[0] = n; flipAt[0] = g.c;
      snd(n ? 260 : 330, .06, 'square', .05, 0, n ? 180 : 420); noise(.05, .06, 2600, 1200, 'bandpass', .02);
      return true;
    },
    flag(c) {                                   // tunnel side: raise the flag of colour c for the next train
      if (!tunnel || busy()) return false;
      btnAt[c] = g.c; const tr = flagTarget();
      if (!tr) { shrugAt = g.c; snd(180, .08, 'square', .03); return false; }
      if (tr.fl === c) return false;
      tr.fl = c; tr.flAt = g.c; D.send('fl', { i: tr.i, c });
      noise(.12, .05, 1800, 700, 'bandpass', .02); snd(520 + c * 70, .08, 'triangle', .05);                       // a flag snapping up the pole
      return true;
    },
    pick(k) {                                   // station side: the shed (row k) for the train whose flag is up
      if (tunnel || busy()) return false;
      cur = k; btnAt[k] = g.c; const tr = pickTarget();
      if (!tr) { shrugAt = g.c; snd(180, .08, 'square', .03); return false; }
      if (tr.pk === k) return false;
      tr.pk = k; tr.pkAt = g.c; D.send('pk', { i: tr.i, k });
      snd(990, .05, 'square', .04); snd(740, .08, 'square', .035, .05);                                            // stamp-stamp
      return true;
    },
    draw() {
      const T = g.c; X = ctx;
      if (!BG) BG = buildBg();
      X.drawImage(BG, 0, 0);
      const won = g.result === 'win' || winAt >= 0, lost = g.result === 'lose', late = lost && crashAt < 0, rk = resAt >= 0 ? T - resAt : -1;
      const wk = won ? T - (winAt >= 0 ? winAt : resAt) : -1;
      sky(T);
      mole(T, won, crashAt >= 0 ? T - crashAt : -1);
      // the switches: the selected way glows in its owner's colour; the blade snaps over
      junction(JAX, MAINY, AP, swK[0], roleCol(0), T, flipAt[0]);
      for (let a = 0; a < 2; a++) junction(JBX, LY[a], BP[a], swK[1], roleCol(1), T, flipAt[1]);
      // the station master, on the grass between the forks (drawn first: trains pass in front of him)
      let mood = 'idle', mk = 0;
      if (won) { mood = 'faint'; mk = wk; } else if (crashAt >= 0) { mood = 'shock'; mk = T - crashAt; } else if (late) { mood = 'angry'; mk = rk; }
      else if (T - cheerAt < .8) mood = 'cheer'; else if (trains.some(tr => tr.a !== null && tr.b !== null && tr.arr < 0 && stCol[tr.a * 2 + tr.b] !== tr.c)) mood = 'worry';
      if (!tunnel) { stationMaster(SMX, SMY, T, mood, mk); if (rare) parrot(SMX + 20, SMY - 54, T, mood); }
      // trains (clipped at the tunnel mouth)
      X.save(); X.beginPath(); X.rect(PORTX - 12, 0, W + 200, H); X.clip();
      for (const tr of trains) if (tr.on && !tr.gone) drawTrain(tr, T);
      X.restore();
      portal(T, tunnel ? lampTrains() : []);
      // the sheds (trains go in behind them)
      for (let k = 0; k < 4; k++) {
        const sf = shedFx[k], hk = (T - sf.hit) / .45, pk = (T - btnAt[k]) / .3, bounce = hk >= 0 && hk < 1 ? Math.sin(hk * Math.PI) * (1 - hk) : !tunnel && pk >= 0 && pk < 1 ? Math.sin(pk * Math.PI) * (1 - pk) * .5 : 0, ck = sf.crash >= 0 ? T - sf.crash : -1;
        X.save(); X.translate(DOORX + 52, ROWS[k] + 10); X.scale(1 + bounce * .12, 1 - bounce * .14); if (ck >= 0 && ck < .4) X.rotate(Math.sin(ck * 50) * .04 * (1 - ck / .4)); X.translate(-52, -10);
        shed(stCol[k], T, { lit: won || hk >= 0 && hk < 1.4 });
        if (sf.stuck !== null) {                       // the wrong cargo sticks out of a hole in the roof
          X.fillStyle = '#2a2238'; poly([[30, -62], [44, -78], [60, -66], [72, -80], [80, -60], [56, -52]]); ink('#2a2238', 3);
          X.save(); X.translate(56, -60); X.rotate(Math.PI + Math.sin(T * 8) * .12); X.scale(.85, .85); cargo(sf.stuck, T, true); X.restore();
        }
        X.restore();
      }
      if (!tunnel) shedPicker(T);
      // flying cargo (crash) and tarps (delivery)
      for (const f of flying) if (!f.landed && f.from) { const k = clamp((T - f.t0) / .45, 0, 1), x = lerp(f.from[0], f.to[0], k), y = lerp(f.from[1], f.to[1], k) - Math.sin(k * Math.PI) * 120; X.save(); X.translate(x, y); X.rotate(k * 7); X.scale(.9, .9); cargo(f.c, T, true); X.restore(); }
      for (const q of tarps) { const k = (T - q.t0) / .7; if (k > 1) continue; X.globalAlpha = 1 - k * k; tarp(q.x - 30 * k, q.y - 150 * k + 120 * k * k, T, -k * 5); X.globalAlpha = 1; }
      // steam puffs (from the chimneys, and the crash dust)
      for (const p of puffs) { const k = (T - p.t0) / p.life, r = p.r * (.7 + k * 1.1); X.globalAlpha = Math.max(0, 1 - k * k); X.beginPath(); X.arc(p.x + Math.sin(k * 5) * 4, p.y, r, 0, TAU); ink(p.dark ? '#a69fb6' : '#fff', 2.5); X.fillStyle = p.dark ? '#c9c3d6' : '#e4e8f2'; el(p.x + Math.sin(k * 5) * 4 + r * .2, p.y + r * .25, r * .6, r * .45); X.fill(); X.globalAlpha = 1; }
      if (!tunnel && won) for (let i = 0; i < 4; i++) { const q = ((T * .8 + i * .25) % 1); X.globalAlpha = Math.sin(q * Math.PI); heart(SMX - 70 + i * 24 + Math.sin(T * 3 + i) * 8, SMY - 34 - q * 80, .7 + (i % 2) * .3); X.globalAlpha = 1; }
      if (!tunnel && won && wk > .45) for (let i = 0; i < 3; i++) { const a = T * 5 + i * TAU / 3; star(SMX - 62 + Math.cos(a) * 26, SMY - 34 + Math.sin(a) * 8, 8, 4, 5, a, '#FFE14D', 2); }
      // the two signalmen (Claudes): mine at my lever; the friend's lever is never drawn (the steam hides it)
      const cMood = () => won ? 'happy' : lost ? 'sad' : T - cheerAt < .6 ? 'happy' : null;
      const fk = r => (T - flipAt[r]) / .3;
      if (tunnel) leverStand(ALX, ACY, swK[0], roleCol(0), callOff() && !busy(), T);
      signalman(ACX, ACY - (won ? Math.abs(Math.sin(T * 9)) * 14 : 0), 4.2, roleCol(0), T, tunnel ? fk(0) : (T - lastFlagIn()) / .3, cMood());
      if (!tunnel) leverStand(BLX, BCY, swK[1], roleCol(1), false, T);
      signalman(BCX, BCY - (won ? Math.abs(Math.sin(T * 9 + 1)) * 14 : 0), 4.2, roleCol(1), T, fk(1), cMood());
      if (T - shrugAt < .6) { const [sx, sy] = tunnel ? [ACX, ACY] : [BCX, BCY]; badge('?', sx + 26, sy - 92 - (T - shrugAt) * 20, 20, '#fff', INK, outBack((T - shrugAt) / .2), .1); }   // nothing to flag / no flag to answer yet
      if (tunnel) drawBits(T);                  // (under the steam: where the sparks fly would tell which row a shed is in)
      // the steam that hides the friend's half of the valley (drawn over everything of that part)
      if (tunnel) {
        cloud(fogR(T), '#f1f3f9', '#cfd5e3');
        // the station master wades out of the steam to watch the trains go by (he knows where the sheds are; he is not telling)
        const px = AFOGX + 70, py = 440 + (won ? 0 : Math.sin(T * 1.7) * 3);
        stationMaster(px, py, T, mood === 'faint' ? 'cheer' : mood, mk);
        if (rare) parrot(px + 20, py - 54, T, mood);
        cloud([[px - 40, py - 2, 24], [px - 6, py + 6, 30], [px + 34, py, 26], [px + 66, py + 8, 30]], '#f1f3f9', '#cfd5e3');
      }
      else {
        cloud(fogB(T), '#f1f3f9', '#cfd5e3');
        // the lamps at the edge of the steam: a train is coming down this line (no colour: under the tarp it is anybody's guess)
        for (let a = 0; a < 2; a++) {
          const tr = trains.find(q => q.on && !q.gone && q.a === a && q.s < LM + HOLDA + 40 && q.b === null);
          const lx = BFOGX + (a ? 72 : 112), ly = LY[a] + (a ? 44 : -44);
          X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(lx, ly + (a ? -20 : 20)); X.lineTo(lx, LY[a] + (a ? 16 : -16)); X.stroke(); X.strokeStyle = '#8d95a6'; X.lineWidth = 3; X.stroke();
          lineLamp(lx, ly, tr, T);
        }
        // the friend stands in the steam, waist-deep
        signalman(ACX, ACY - (won ? Math.abs(Math.sin(T * 9)) * 14 : 0), 4.2, pCol(), T, (T - lastFlagIn()) / .3, cMood());
        cloud([[ACX - 44, ACY + 4, 20], [ACX - 10, ACY + 8, 24], [ACX + 30, ACY + 4, 20], [ACX + 60, ACY + 6, 22]], '#f1f3f9', '#cfd5e3');
        flagPole(T);
      }
      scoreboard(T);
      if (tunnel) { callBoard(T); flagButtons(T); }
      // name tags
      pill(ACX, ACY + 30, tunnel ? 'YOU' : 'YOUR FRIEND', roleCol(0));
      pill(BCX, BCY + 30, tunnel ? 'YOUR FRIEND' : 'YOU', roleCol(1));
      if (!tunnel) drawBits(T);
      // the next train for MY switch: a ring that runs out when it gets there (it does not tell which way)
      if (!g.result && !halt) {
        const nx = nextFor(tunnel ? 0 : 1);
        if (nx) { const left = nx.left, k = clamp(left / 1.6, 0, 1), [jx, jy] = tunnel ? [JAX, MAINY] : [JBX, LY[nx.a]];
          X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.arc(jx, jy, 30, -Math.PI / 2, -Math.PI / 2 + TAU * k); X.stroke();
          X.lineWidth = 4.5; X.strokeStyle = k < .35 ? '#ff6b6b' : tunnel ? COL[nx.c][0] : '#fff'; X.stroke(); }
        if (tunnel) { if (TOUCH) badge('TAP!', ALX + 2, ACY - 116, 18, myCol(), INK, 1 + .06 * Math.sin(T * 9), -.05); else keyCap(ALX, ACY - 112, 'SPACE'); }
        else if (TOUCH && flagUp()) badge('TAP!', 560, 150, 18, myCol(), INK, 1 + .06 * Math.sin(T * 9), -.05);
      }
      // feedback words
      for (const q of won ? [] : pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, clamp(q.x, 120, 690), Math.max(140, q.y) - Math.min(a, .6) * 8, q.size, q.bgc, q.fg, a < .25 ? outBack(a / .25) : 1, q.rot); X.globalAlpha = 1; }
      if (late && rk > .1) badge('TOO LATE!', 450, 200, 40, '#3b3550', '#FFE14D', outBack((rk - .1) / .25), -.06);
      if (won && wk > .3) badge('ALL CARGO HOME!', 450, 200, 34, '#22a447', '#fff', outBack((wk - .3) / .25), -.05);
      vignette(.14);
    },
    move(p) { if (tunnel || p.touch) return; hov = rowAt(p.y); },
    down(p) {
      if (tunnel) {                           // anywhere on the flag panel = the nearest flag; anywhere else = my lever
        const onPanel = p && Math.abs(p.y - FLAGS[0][1]) < 40 && p.x > FLAGS[0][0] - 40 && p.x < FLAGS[3][0] + 40;
        if (onPanel) g.flag(clamp(Math.round((p.x - FLAGS[0][0]) / (FLAGS[1][0] - FLAGS[0][0])), 0, 3)); else g.flip();
      }
      else g.pick(p ? rowAt(p.y) : cur);
    },
    key(e) {
      if (e.repeat) return;
      const n = /^(Digit|Numpad)([1-4])$/.exec(e.code || '');
      if (n) { if (tunnel) g.flag(+n[2] - 1); else g.pick(+n[2] - 1); return; }
      if (tunnel) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') g.flip(0);
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') g.flip(1);
        else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') g.flip();
      } else {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') { cur = Math.max(0, cur - 1); hov = -1; }
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') { cur = Math.min(3, cur + 1); hov = -1; }
        else if (e.code === 'Space' || e.code === 'Enter') g.pick(cur);
      }
    },
  };
  const rowAt = y => { let b = 0; for (let k = 1; k < 4; k++) if (Math.abs(y - (ROWS[k] - 30)) < Math.abs(y - (ROWS[b] - 30))) b = k; return b; };
  const lastFlagIn = () => trains.reduce((m, tr) => Math.max(m, tr.flAt), -9);   // the friend's Claude waves when a flag goes up
  /* tunnel side: the friend's call for the next train at my switch: 0 / 1, or null while it has not come back */
  function callFor() { const nx = seenT()[0]; return nx ? { tr: nx, line: nx.pk === null ? null : nx.pk >> 1 } : null; }
  const callOff = () => { const c = callFor(); return !!c && c.line !== null && c.line !== sw[0]; };
  /* the next train that will reach switch r, as this screen knows it: {c, left (s until its nose gets there), a} */
  function nextFor(r) {
    let best = null;
    for (const tr of trains) {
      if (!tr.on || tr.gone) continue;
      let left;
      if (r === 0) { if (tr.a !== null) continue; left = (LM - tr.s) / v; if (tr.s < EMERGE - 4) continue; }
      else { if (tr.b !== null || tr.a === null) continue; left = (LM + LA[tr.a] - tr.s) / v; }
      if (!best || left < best.left) best = { c: tr.c, left, a: tr.a, i: tr.i };
    }
    return best;
  }
  function drawTrain(tr, T) {
    const mood = tr.crash >= 0 ? 'dizzy' : tr.arr >= 0 && tr.ok ? 'happy' : tr.a !== null && tr.b !== null && stCol[tr.a * 2 + tr.b] !== tr.c && tr.s > doorS(tr) - 220 ? 'scared' : 'calm';
    const pw = posOf(tr, tr.s - LOCO - CPL - WAG / 2), pl = posOf(tr, tr.s - LOCO / 2);
    const flung = flying.some(f => f.c === tr.c && tr.crash >= 0), c = !tunnel && tr.arr < 0 ? -1 : tr.c;   // the station side reads nothing until it arrives
    if (pw) { X.save(); X.translate(pw[0], pw[1]); X.rotate(pw[2]); wagonCar(c, T, tr.s, !flung, tr.arr >= 0 || (tr.s > LM && tr.a !== null), tr.pk === null ? null : stCol[tr.pk]); X.restore(); }
    if (pw && pl) { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(pw[0] + Math.cos(pw[2]) * 31, pw[1] + Math.sin(pw[2]) * 31 - 12); X.lineTo(pl[0] - Math.cos(pl[2]) * 36, pl[1] - Math.sin(pl[2]) * 36 - 12); X.stroke(); }
    if (pl) { const ck = tr.crash >= 0 ? T - tr.crash : -1, tilt = ck >= 0 ? -Math.min(1, ck / .12) * .22 + Math.sin(ck * 30) * .02 * Math.max(0, 1 - ck) : 0;
      X.save(); X.translate(pl[0], pl[1] + (ck >= 0 && ck < .2 ? -Math.sin(ck / .2 * Math.PI) * 10 : 0)); X.rotate(pl[2]); loco(c, T, tr.s, mood, tilt);
      if (tunnel && tr.fl !== null) pennant(-22, -60, tr.fl, T, (T - tr.flAt) / .25);                           // my flag for it, stuck on the cab roof
      if (tr.crash >= 0) for (let i = 0; i < 3; i++) { const a = T * 6 + i * TAU / 3; star(10 + Math.cos(a) * 26, -68 + Math.sin(a) * 7, 7, 3, 5, a, '#FFE14D', 2); }
      X.restore(); }
  }
  /* tunnel side: the four flag buttons (the one I raised for the next train stands up, the rest lie down) */
  function flagButtons(T) {
    const tg = flagTarget(), want = tg && tg.fl === null, calm = busy();
    X.save(); rr(FLAGS[0][0] - 40, FLAGS[0][1] - 36, FLAGS[3][0] - FLAGS[0][0] + 80, 72, 22); X.fillStyle = 'rgba(42,34,56,.28)'; X.fill(); X.restore();
    for (let c = 0; c < 4; c++) {
      const [x, y] = FLAGS[c], pk = (T - btnAt[c]) / .25, press = pk >= 0 && pk < 1 ? Math.sin(pk * Math.PI) : 0, bob = want && !calm ? Math.sin(T * 9 + c) * 2.5 : 0;
      const raised = tg && tg.fl === c;
      X.save(); X.translate(x, y + bob + press * 4); X.scale(1 - press * .1, 1 - press * .1);
      X.beginPath(); X.arc(0, 0, 27, 0, TAU); ink(raised ? '#fff6a8' : '#fffaf0', 3.5);
      if (raised) { X.globalAlpha = .4 + .3 * Math.sin(T * 10); X.lineWidth = 5; X.strokeStyle = myCol(); X.beginPath(); X.arc(0, 0, 33, 0, TAU); X.stroke(); X.globalAlpha = 1; }
      pennant(-8, 18, c, T + c, 1, 1.25);
      X.restore();
      if (!TOUCH) keyCap(x + 20, y + 24, String(c + 1));
    }
  }
  /* tunnel side: the board between the forks where the friend's call lights up for the next train at my switch */
  function callBoard(T) {
    const cl = callFor(), x = CBX, y = CBY;
    X.save(); X.translate(x, y + Math.sin(T * 2) * 1.5);
    rr(-3, 26, 6, 26, 2); ink('#8a5a34', 2);
    rr(-34, -32, 68, 62, 12); ink('#3b3550', 3.5); X.fillStyle = 'rgba(255,255,255,.12)'; rr(-28, -27, 56, 6, 3); X.fill();
    if (cl) {
      X.beginPath(); X.arc(-22, -20, 7, 0, TAU); ink(COL[cl.tr.c][0], 2.2);                                     // which train it is for
      if (cl.line === null) { const d = Math.floor(T * 4) % 4; for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(-12 + i * 12, 4, 4, 0, TAU); X.fillStyle = i < d ? '#fff' : '#5d5672'; X.fill(); } }
      else {
        const pk = clamp((T - cl.tr.pkAt) / .2, 0, 1), sc = .6 + .4 * outBack(pk), ok = cl.line === sw[0];
        X.save(); X.translate(4, 4); X.scale(sc, cl.line ? -sc : sc);
        X.beginPath(); X.moveTo(0, -20); X.lineTo(17, 2); X.lineTo(7, 2); X.lineTo(7, 18); X.lineTo(-7, 18); X.lineTo(-7, 2); X.lineTo(-17, 2); X.closePath(); ink(pCol(), 3);
        X.restore();
        if (!ok && !busy()) { X.globalAlpha = .5 + .5 * Math.sin(T * 14); X.lineWidth = 4; X.strokeStyle = '#ff6b6b'; rr(-38, -36, 76, 70, 15); X.stroke(); X.globalAlpha = 1; }
      }
    } else txt('…', 0, 2, 22, '#8d7bb8');
    X.restore();
  }
  /* station side: the friend's flag on a pole at the edge of the steam (more flags waiting = little pennants under it) */
  function flagPole(T) {
    const up = flagUp();
    const x = FPX, y = FPY, rise = up ? outBack(clamp((T - up.flAt) / .3, 0, 1)) : 0, top = y - 86;
    rr(x - 14, y - 8, 28, 14, 5); ink('#a49cb5', 3);
    X.strokeStyle = INK; X.lineWidth = 8; X.lineCap = 'round'; X.beginPath(); X.moveTo(x, y); X.lineTo(x, top); X.stroke(); X.strokeStyle = '#d9cfb8'; X.lineWidth = 3.5; X.stroke();
    X.beginPath(); X.arc(x, top - 4, 6, 0, TAU); ink(pCol(), 2.4);
    if (up) { X.save(); X.translate(x, lerp(y - 20, top + 4, rise)); pennant(0, 0, up.fl, T, 1, 2.1, true); X.restore(); }
    else { X.save(); X.translate(x, y - 24); X.fillStyle = '#b9b4c6'; X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(8, 10, 4, 22); X.lineTo(0, 22); X.closePath(); ink('#b9b4c6', 2.2); X.restore(); }   // limp, nothing to say yet
    const more = trains.filter(tr => tr.fl !== null && tr.pk === null && tr.b === null).slice(1, 3);             // the flags queued behind it, small
    more.forEach((tr, i) => pennant(x + 4, top + 46 + i * 18, tr.fl, T + i, 1, .7, true));
  }
  /* station side: where the keyboard cursor / mouse is, the keys, and the shed picked for the flag that is up */
  function shedPicker(T) {
    if (busy()) return;
    const sel = hov >= 0 ? hov : cur;
    if (!TOUCH) { X.save(); X.setLineDash([14, 9]); X.lineDashOffset = -T * 30; rr(DOORX - 12, ROWS[sel] - 96, 122, 116, 16); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = myCol(); X.stroke(); X.restore(); }
    for (let k = 0; k < 4; k++) if (!TOUCH) keyCap(DOORX + 86, ROWS[k] - 6, String(k + 1));
  }
  function lineLamp(lx, ly, tr, T) {
    rr(lx - 18, ly - 18, 36, 36, 9); ink('#3b3550', 3);
    X.beginPath(); X.arc(lx, ly, 12, 0, TAU); ink(tr ? '#fff6a8' : '#5d5672', 2.4);
    if (tr) { X.globalAlpha = .3 + .3 * Math.sin(T * 14); X.beginPath(); X.arc(lx, ly, 22, 0, TAU); X.fillStyle = '#fff6a8'; X.fill(); X.globalAlpha = 1; }
  }
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0, fade = a > b.life * .7 ? 1 - (a - b.life * .7) / (b.life * .3) : 1; X.globalAlpha = clamp(fade, 0, 1);
      if (b.sh === 0) { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2.2); }
      else if (b.sh === 1) star(b.x, b.y, b.r * 1.6, b.r * .7, 5, b.rot, b.c, 2);
      else { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); rr(-b.r, -b.r * .6, b.r * 2, b.r * 1.2, 1.5); ink(b.c, 2); X.restore(); }
    }
    X.globalAlpha = 1;
  }
  function scoreboard(T) {                    // a departure board hanging at the top: five cargo slots
    const x0 = 344, y0 = 64, w = 264, h = 52, cx = x0 + w / 2, swg = Math.sin(T * 1.3) * .012;
    X.save(); X.translate(cx, 40); X.rotate(swg); X.translate(-cx, -40);
    X.lineCap = 'round'; for (const rx of [x0 + 30, x0 + w - 30]) { X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(rx, 40); X.lineTo(rx, y0 + 4); X.stroke(); X.strokeStyle = '#c9ced6'; X.lineWidth = 3; X.stroke(); }
    rr(x0, y0 + 4, w, h, 12); ink('#1f1a2e', 4); rr(x0, y0, w, h, 12); ink('#3b3550', 0); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    X.fillStyle = 'rgba(255,255,255,.12)'; rr(x0 + 8, y0 + 4, w - 16, 6, 3); X.fill();
    const done = trains.filter(tr => tr.arr >= 0 && tr.ok).sort((a, b) => a.arr - b.arr);
    for (let i = 0; i < NT; i++) {
      const px = x0 + 32 + i * 50, py = y0 + h / 2, tr = done[i], k = tr ? outBack((T - tr.arr) / .3) : 0;
      X.beginPath(); X.arc(px, py, 19, 0, TAU); ink(tr ? COL[tr.c][2] : '#2a2238', 3);
      if (tr) { X.save(); X.translate(px, py + 13); X.scale(.42 * k, .42 * k); cargo(tr.c, T, true); X.restore(); }
      else { X.strokeStyle = 'rgba(255,255,255,.18)'; X.lineWidth = 2; X.setLineDash([4, 4]); X.beginPath(); X.arc(px, py, 12, 0, TAU); X.stroke(); X.setLineDash([]); }
    }
    X.restore();
  }
  g.dbg = {
    stCol, seq, trains,
    /* what each role can see. TUNNEL SIDE: the trains from the lamp to its switch (colour, my flag, the friend's call ▲ 0 / ▼ 1 once it is
       back, time to the switch). STATION SIDE: the flag that is up (colour) and the sheds top to bottom; never a train's colour */
    view() {
      if (tunnel) return { sw: sw[0], trains: seenT().map(tr => ({ i: tr.i, c: tr.c, fl: tr.fl, call: tr.pk === null ? null : tr.pk >> 1, left: (LM - tr.s) / v })) };
      const up = flagUp();
      return { flag: up ? { i: up.i, c: up.fl } : null, sheds: stCol.slice(), rows: ROWS.slice() };
    },
    delivered: () => delivered,
  };
  wire(g, D, 1, sp, 'du_rails');
  return g;
}
reg('du_rails', duRails, 'SWITCH PANIC'); REGMAP.du_rails.duo = true;

/* ───────────── scene bits ───────────── */
function sky(T) {
  const cloudy = (x, y, s) => { X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 18], [20, -8, 22], [42, 0, 17], [20, 5, 18]]; for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 4, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); };
  cloudy(((T * 8 + 420) % 980) - 120, 96, .8); cloudy(((T * 5 + 90) % 1000) - 140, 132, .6);
  // the background gag: a hot-air balloon flown by a dog waving a little flag
  const bx = 620 + Math.sin(T * .4) * 30, by = 120 + Math.sin(T * 1.1) * 6;
  X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(bx - 10, by + 16); X.lineTo(bx - 7, by + 30); X.moveTo(bx + 10, by + 16); X.lineTo(bx + 7, by + 30); X.stroke();
  el(bx, by, 20, 22); ink('#ff9f1c', 3); X.save(); el(bx, by, 20, 22); X.clip(); X.fillStyle = '#ffe14d'; X.fillRect(bx - 6, by - 24, 12, 48); X.restore();
  rr(bx - 9, by + 28, 18, 12, 3); ink('#b3743f', 2.4);
  X.beginPath(); X.arc(bx, by + 24, 6, 0, TAU); ink('#f2d0a0', 2); X.fillStyle = INK; X.fillRect(bx - 3, by + 22, 2, 2); X.fillRect(bx + 1, by + 22, 2, 2);
  el(bx - 6, by + 21, 2.4, 4, .4); ink('#a06a3a', 1.2);
  const fw = Math.sin(T * 8) * .4; X.save(); X.translate(bx + 7, by + 26); X.rotate(-.6 + fw); X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -14); X.stroke(); X.fillStyle = '#ff5c8a'; X.fillRect(0, -14, 8, 5); X.restore();
}
/* a mole in a hard hat pops out of a hole by the track (ducks at a crash, waves a flag at the win) */
function mole(T, won, ck) {
  const x = 506, y = 544, up = won ? 1 : ck >= 0 ? Math.max(0, 1 - ck * 5) : clamp(Math.sin(T * .9) * 2.2 - .6, 0, 1);
  el(x, y, 26, 8); ink('#5a3b2e', 3);
  if (up <= .02) return;
  X.save(); X.beginPath(); X.rect(x - 40, y - 80, 80, 80); X.clip(); X.translate(x, y + (1 - up) * 46);
  rr(-16, -40, 32, 44, 15); ink('#8a6a5a', 3);
  X.fillStyle = '#c9a796'; el(0, -14, 9, 13); X.fill();
  X.beginPath(); X.arc(0, -30, 5, 0, TAU); ink('#ff8fa8', 2);
  X.fillStyle = INK; X.fillRect(-9, -36, 3, 4); X.fillRect(6, -36, 3, 4);
  X.beginPath(); X.arc(0, -42, 16, Math.PI, 0); X.closePath(); ink('#ffd23f', 3); rr(-19, -44, 38, 5, 2); ink('#ffd23f', 2);
  X.restore();
  if (won) { X.save(); X.translate(x + 18, y - 40); X.rotate(Math.sin(T * 10) * .4); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -28); X.stroke(); X.fillStyle = '#5CFF7A'; X.fillRect(0, -28, 16, 10); X.restore(); }
}
function parrot(x, y, T, mood) {
  X.save(); X.translate(x, y); X.rotate(Math.sin(T * 3) * .08);
  el(0, 0, 8, 11); ink('#4fd06a', 2.4); X.beginPath(); X.arc(0, -12, 7, 0, TAU); ink('#ff5a4f', 2.4);
  X.beginPath(); X.moveTo(5, -13); X.quadraticCurveTo(12, -12, 7, -6); X.closePath(); ink('#ffd23f', 1.6);
  X.fillStyle = INK; X.beginPath(); X.arc(2, -14, 1.6, 0, TAU); X.fill();
  rr(-4, 8, 8, 12, 3); ink('#4db8ff', 1.8);
  X.restore();
  if (mood === 'cheer' || mood === 'faint') { X.globalAlpha = .9; badge('SQUAWK!', x + 30, y - 40, 13, '#4fd06a', '#fff', 1, .1); X.globalAlpha = 1; }
}
/* a switch: the first stretch of the selected way glows in the owner's colour, the blade sits over it; k: 0 = upper, 1 = lower */
function junction(jx, jy, paths, k, col, T, fAt) {
  const sel = Math.round(k), P2 = paths[sel], L = Math.min(110, P2.len), pts = trackPts(P2, 0, L);
  X.globalAlpha = .55; stroke(pts, col, 22); X.globalAlpha = 1;
  for (const d of [-7, 7]) { stroke(offset(pts.slice(0, 8), d), INK, 7); stroke(offset(pts.slice(0, 8), d), '#e8ecf5', 3.5); }
  // the arrow sign on the switch
  const a = lerp(-.62, .62, k), pk = (T - fAt) / .25, sc = pk >= 0 && pk < 1 ? 1 + .25 * Math.sin(pk * Math.PI) : 1;
  X.save(); X.translate(jx - 4, jy); X.scale(sc, sc);
  X.beginPath(); X.arc(0, 0, 17, 0, TAU); ink(col, 3);
  X.rotate(a); X.beginPath(); X.moveTo(-9, -4); X.lineTo(2, -4); X.lineTo(2, -10); X.lineTo(12, 0); X.lineTo(2, 10); X.lineTo(2, 4); X.lineTo(-9, 4); X.closePath(); ink('#fff', 2);
  X.restore();
}
/* a little flag on a stick (stick foot at x, y), or just the cloth (its top-left corner at x, y); k: 0..1 as it snaps open */
function pennant(x, y, c, T, k, s, noStick) {
  s = s || 1; k = clamp(k === undefined ? 1 : k, 0, 1);
  X.save(); X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
  if (!noStick) { X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -30); X.stroke(); X.strokeStyle = '#d9cfb8'; X.lineWidth = 2; X.stroke(); X.translate(0, -30); }
  const o = .3 + .7 * outBack(k); X.scale(o, o);
  const w = Math.sin(T * 9) * 2.4, w2 = Math.sin(T * 9 + 1.6) * 2.4;
  X.beginPath(); X.moveTo(0, -1); X.quadraticCurveTo(11, -4 + w, 23, w2); X.lineTo(24, 15 + w2); X.quadraticCurveTo(12, 12 + w, 0, 16); X.closePath(); ink(COL[c][0], 2.2 / s * 1.3);
  X.fillStyle = 'rgba(255,255,255,.45)'; X.beginPath(); X.moveTo(3, 2); X.quadraticCurveTo(11, -1 + w, 19, 2.5 + w2); X.lineTo(19, 5 + w2); X.quadraticCurveTo(11, 2 + w, 3, 5); X.fill();
  X.restore();
}
/* the tunnel side's steam: a wall over the right half of the valley (switch B, the sheds), the top right corner too (shed roofs) */
function fogR(T) {
  const c = [];
  for (let y = 170; y <= 590; y += 42) c.push([AFOGX + 36 + Math.sin(y * .05 + T * 1.4) * 8, y, 46 + Math.sin(y * .1) * 6]);
  for (let x = 560; x <= 840; x += 52) c.push([x, (x > 640 ? 96 : 150) + Math.sin(x * .06 + T * 1.2) * 6, 50]);
  c.push([548, 322, 44], [600, 250, 110], [600, 440, 120], [730, 180, 120], [740, 330, 130], [730, 480, 130], [800, 90, 70]);
  return c;
}
function fogB(T) {
  const c = [[-60, 300, 300], [80, 380, 150]];
  for (let y = 190; y <= 600; y += 46) c.push([BFOGX - 52 + Math.sin(y * .05 + T * 1.4) * 8, y, 50 + Math.sin(y * .1) * 6]);
  for (let x = -40; x <= BFOGX - 60; x += 52) c.push([x, 196 + Math.sin(x * .06 + T * 1.2) * 6, 48]);
  c.push([60, 420, 160], [200, 420, 140], [220, 300, 110], [120, 300, 120]);
  return c;
}

/* ───────────── intro card: what each role does (520×240 frame), a 2.6 s loop that alternates the two ways ───────────── */
const DM = mkPath(line([], -60, 120, 190, 120));
const DA = [50, 190].map(y => mkPath(line(bez([], [190, 120], [232, 120], [228, y], [270, y]), 270, y, 600, y)));
const DIN = mkPath(line([], -60, 124, 210, 124));
const DB = [62, 192].map(y => mkPath(line(bez([], [210, 124], [250, 124], [248, y], [290, y]), 290, y, 600, y)));
function demoTrack(P, s1) { const L = trackPts(P, 0, s1); stroke(L, INK, 26); stroke(L, '#cdb894', 20); for (const d of [-5, 5]) { stroke(offset(L, d), INK, 5); stroke(offset(L, d), '#a7aebb', 2.4); } }
function demoSwitch(x, y, k, col) { X.save(); X.translate(x, y); X.beginPath(); X.arc(0, 0, 14, 0, TAU); ink(col, 2.5); X.rotate(k ? .62 : -.62); X.beginPath(); X.moveTo(-7, -3); X.lineTo(2, -3); X.lineTo(2, -8); X.lineTo(10, 0); X.lineTo(2, 8); X.lineTo(2, 3); X.lineTo(-7, 3); X.closePath(); ink('#fff', 1.6); X.restore(); }
function demoTrain(pos, s, c, t, mood, fl) {
  const pw = pos(s - 74), pl = pos(s - 19);
  X.save(); X.translate(pw[0], pw[1]); X.rotate(pw[2]); X.scale(.62, .62); wagonCar(c, t, s, true, true); X.restore();
  X.save(); X.translate(pl[0], pl[1]); X.rotate(pl[2]); X.scale(.62, .62); loco(c, t, s, mood, 0); if (fl !== undefined) pennant(-22, -60, fl, t, 1); X.restore();
}
function demoLever(x, y, k, col) { X.save(); X.translate(x, y); X.scale(.55, .55); leverStand(0, 0, k, col, false, 0); X.restore(); }
function demoArrow(x, y, dn, col, sc) { X.save(); X.translate(x, y); X.scale(sc, dn ? -sc : sc); X.beginPath(); X.moveTo(0, -20); X.lineTo(17, 2); X.lineTo(7, 2); X.lineTo(7, 18); X.lineTo(-7, 18); X.lineTo(-7, 2); X.lineTo(-17, 2); X.closePath(); ink(col, 3); X.restore(); }
function demo(role, t) {
  X = ctx;
  const gr = ctx.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#9be36a'); gr.addColorStop(1, '#5fb944'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 520, 240);
  const u = t % 2.6, want = Math.floor(t / 2.6) % 2, YC = '#FFC93C', FC = '#6EA8FE';
  const tapAt = (a, b) => u > a - .1 && u < a + .2, ph = a => (u - a + .1) / .3;
  if (role === 0) {                          // a train comes out: the finger flags its colour, the friend's arrow lights up, the finger throws the switch
    const c = want ? 2 : 0, flagT = .35, callT = .7, flipT = 1.0, swv = u > flipT ? want : 1 - want, s = 50 + u * 170;
    demoTrack(DM, DM.len); for (const p of DA) demoTrack(p, 400);
    X.globalAlpha = .5; stroke(trackPts(DA[swv], 0, 70), YC, 16); X.globalAlpha = 1;
    X.fillStyle = '#1d1828'; X.fillRect(30, 96, 22, 30);
    const pos = q => q <= DM.len ? at(DM, q) : at(DA[want], q - DM.len);
    X.save(); X.beginPath(); X.rect(30, 0, 600, 240); X.clip(); demoTrain(pos, s, c, t, 'calm', u > flagT ? c : undefined); X.restore();
    X.fillStyle = '#72c25a'; X.beginPath(); X.moveTo(0, 60); X.quadraticCurveTo(40, 60, 60, 90); X.lineTo(60, 160); X.lineTo(0, 160); X.closePath(); X.fill();
    X.beginPath(); X.moveTo(22, 134); X.lineTo(22, 102); X.quadraticCurveTo(22, 84, 41, 84); X.quadraticCurveTo(60, 84, 60, 102); X.lineTo(60, 134); X.lineTo(52, 134); X.lineTo(52, 104); X.quadraticCurveTo(52, 94, 41, 94); X.quadraticCurveTo(30, 94, 30, 104); X.lineTo(30, 134); X.closePath(); ink('#b8b0c8', 2.5);
    X.beginPath(); X.arc(41, 66, 10, 0, TAU); ink(COL[c][0], 2.5);                                                 // the lamp: the colour
    cloud([[430, 40, 50], [470, 120, 60], [430, 200, 50], [520, 60, 60], [520, 190, 60], [395, 120, 34]], '#f1f3f9', '#cfd5e3');   // the sheds: who knows
    // the friend's call board
    rr(262, 96, 48, 48, 9); ink('#3b3550', 2.5); if (u > callT) demoArrow(286, 120, want, FC, .75 * outBack(clamp((u - callT) / .2, 0, 1)));
    else { for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(276 + i * 10, 120, 3, 0, TAU); X.fillStyle = i < Math.floor(t * 4) % 4 ? '#fff' : '#5d5672'; X.fill(); } }
    demoSwitch(190, 120, swv, YC);
    demoLever(100, 234, swv, YC);
    for (let k = 0; k < 4; k++) { X.beginPath(); X.arc(170 + k * 40, 212, 16, 0, TAU); ink('#fffaf0', 2.5); pennant(166 + k * 40, 224, k, t + k, 1, .7); }
    if (u < .7) demoFinger(170 + c * 40, 216, tapAt(flagT), ph(flagT)); else demoFinger(110, 210, tapAt(flipT), ph(flipT));
  } else {                                   // the friend's flag goes up: the finger taps the shed of that colour, the tarped train goes in, ta-da
    const pickT = .6, swv = u > pickT ? want : 1 - want, s = 40 + u * 190;
    demoTrack(DIN, DIN.len); for (const p of DB) demoTrack(p, sAtX(p, 410));
    X.globalAlpha = .5; stroke(trackPts(DB[swv], 0, 70), FC, 16); X.globalAlpha = 1;
    const pos = q => q <= DIN.len ? at(DIN, q) : at(DB[want], q - DIN.len), inS = DIN.len + sAtX(DB[want], 400);
    demoTrain(pos, Math.min(s, inS + 140), s > inS ? want : -1, t, s > inS ? 'happy' : 'calm');
    for (let b = 0; b < 2; b++) { X.save(); X.translate(400, (b ? 192 : 62) + 4); X.scale(.6, .6); shed(b, t, { lit: b === want && s > inS }); X.restore(); }
    if (s > inS && s < inS + 60) badge(HAPPY[want], 450, want ? 120 : 112, 16, COL[want][1], '#fff', outBack((s - inS) / 30), -.05);
    cloud([[0, 124, 74], [62, 92, 46], [70, 158, 50], [10, 34, 54], [14, 214, 54]], '#f1f3f9', '#cfd5e3');
    // the friend's flag at the edge of the steam
    X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(120, 112); X.lineTo(120, 20); X.stroke(); X.strokeStyle = '#d9cfb8'; X.lineWidth = 2.5; X.stroke();
    X.save(); X.translate(120, lerp(90, 24, outBack(clamp(u / .25, 0, 1)))); pennant(0, 0, want, t, 1, 1.5, true); X.restore();
    if (u > pickT && u < pickT + .6) { const k = (u - pickT) / .6; X.globalAlpha = 1 - k * k; demoArrow(lerp(370, 60, k), 124, want, FC, .6); X.globalAlpha = 1; }   // the call flies back to the friend
    demoSwitch(210, 124, swv, FC);
    demoFinger(430, want ? 176 : 46, tapAt(pickT), ph(pickT));
  }
}
DUO.INFO.du_rails = [['TUNNEL SIDE', 'FLAG THE COLOUR, THROW THE SWITCH', 'TAP THE FLAG · TAP TO FLIP'], ['STATION SIDE', 'PICK THE SHED OF THE FLAG', 'TAP THE SHED']];
DUO.DEMOS.du_rails = [t => demo(0, t), t => demo(1, t)];

})();
