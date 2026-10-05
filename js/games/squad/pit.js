'use strict';
/* ═════════ SQUAD · PIT STOP (sq_pit), 3-4 players ═════════
   A tiny race car screeches into the pit lane and the crew has seconds to service it. Everybody works on their own part AT THE SAME TIME,
   every station has a lamp on the pit gantry, and the car only goes when all lamps are green.
   JACK (role 0): taps (click / Space / tap) to pump the car up. The ram leaks: stop pumping and the car sinks. Wheels can only be worked while it is up.
   WHEELS (role 1): spins the wheel gun (circle the pointer round the hub, mash A / D, or tap) on the front wheel, then the rear one. Needs the car up.
   FUEL (role 2): holds the nozzle (click / Space) and lets go with the gauge in the green. Past the top it spills (SPLASH, stunned, level drops).
   LOLLIPOP (role 3, only with 4 players, JUDGE): raises the STOP sign (hold) and lets go to send the car off. Letting go before every lamp is green =
   the car leaves half-serviced and crashes. With 3 players there is no signal man: the mechanic's cat holds the lollipop and sends the car off
   by itself half a second after all the lamps are green (the FUEL player is the judge); the team still loses on the clock.
   Netcode: every role OWNS its own part and publishes it. 'jack' level*100 (coalesced), 'wheels' [p0,p1,cur]*100 (coalesced) + 'wdone' (event),
   'fuel' [level*100, pouring] (coalesced) + 'fdone' / 'spill' (events), 'sign' 0|1 (event). The judge decides: it needs wheels done + fuel done
   (monotonic events) and the jack down (as it sees it), tells everybody WHAT went wrong ('why' bitmask, drawn as the lose gag) and sends the verdict ('end', via wire). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MC = new Map();
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };

/* ───────────── layout (800x600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const CX = 360, CGY = 430, GY = 492;                 // car centre / ground under its wheels / where the crew's feet are
const HUBX = 70, HUBY = 32, WR = 32;                 // wheel hubs are +-HUBX from the car centre, HUBY above the ground, radius WR
const LIFT = 30, ARR = 1.0, HIT = CX + 205;                          // the car rises LIFT px at full pump; it screeches in during the first ARR s
const XF = 176, XJ = 348, XW = [470, 250], XS = 596; // crew x: fuel, jack, wheels (front job / rear job), lollipop
const GANTRY = 184, LAMPY = 244;
const PCOL = ['#FFC93C', '#6EA8FE', '#7CE38B', '#FF8FC4'];   // seat colours when the harness gives none
const CARS = [['#ff4d5e', '#b8283a', '#ffa3ac'], ['#2fc8c0', '#1a8a95', '#99f2ea'], ['#ffd23f', '#c99512', '#fff2a8'], ['#9a7cff', '#5f43c9', '#cfc2ff']];
const RIGX = [26, 118];                              // fuel rig x range
const WIN_Y = [330, 452];                            // the gauge window (top, bottom)

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
/* cel shading: the shape in its shade colour, then the base colour shifted by (-sx, -sy) inside it, so a crescent of shade stays on one side */
function cel(pf, base, shade, sx, sy, o = 4) { pf(); ink(shade, o); X.save(); pf(); X.clip(); X.translate(-sx, -sy); pf(); X.fillStyle = base; X.fill(); X.restore(); }
function glint(x, y, rx, ry, rot, a) { X.fillStyle = `rgba(255,255,255,${a || .45})`; el(x, y, rx, ry, rot || -.4); X.fill(); }
function pill(x, y, label, col, raw) {                // a name tag with a little pointer down
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = raw ? label : t(label), w = Math.min(150, X.measureText(s).width + 22);
  X.beginPath(); X.moveTo(x - 7, y + 10); X.lineTo(x, y + 19); X.lineTo(x + 7, y + 10); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 11, w, 22, 11); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 5, y - 8.5, w - 10, 6, 3); X.fill();
  if (raw) { X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = INK; X.fillText(s, x, y + 1, w - 12); }
  else txt(label, x, y + 1, 15, INK, 'center', w - 12);
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
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
/* two thin blocky arms from claude()'s side stubs (drawn before claude()); an = angle (0 = up, + = towards the right), k = 0..1 raised */
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
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
function zee(x, y, s, a) { X.globalAlpha = a; txt('Z', x, y, s, '#fff'); X.globalAlpha = 1; }
function puffC(x, y, r, a, col) { X.globalAlpha = a; X.fillStyle = col || '#f1eef8'; X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(x, y, r, 0, TAU); X.fill(); X.stroke(); X.globalAlpha = 1; }

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 17; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave the nozzle stuck on */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ───────────── the car ───────────── */
/* a wheel at (x, y): p = job progress 0..1 (nuts back out, the tyre swaps at .5, nuts screw in), cur = being worked on, spin = angle */
function wheel(x, y, p, spin, cur, T) {
  const r = WR, fresh = p >= .5, k = p < .5 ? p / .5 : (p - .5) / .5;
  X.save(); X.translate(x, y);
  X.beginPath(); X.arc(0, 0, r, 0, TAU); ink('#2b2838', 4);
  X.beginPath(); X.arc(0, 0, r - 8, 0, TAU); ink(fresh ? '#ffffff' : '#a79f98', 3);
  if (fresh) { X.fillStyle = '#ff4d5e'; X.beginPath(); X.arc(0, 0, r - 8, -.6, .6); X.lineTo(0, 0); X.fill(); X.beginPath(); X.arc(0, 0, r - 8, Math.PI - .6, Math.PI + .6); X.lineTo(0, 0); X.fill(); }
  else { X.fillStyle = '#7e756e'; for (let i = 0; i < 3; i++) { const a = i * 2.1 + .7; el(Math.cos(a) * 12, Math.sin(a) * 12, 4, 2.6, a); X.fill(); } }   // a rusty old tyre
  X.fillStyle = 'rgba(255,255,255,.4)'; el(-r * .35, -r * .45, r * .28, r * .12, -.6); X.fill();
  X.beginPath(); X.arc(0, 0, 7, 0, TAU); ink('#c9ced6', 2.5);
  const out = p < .5 ? k * 7 : (1 - k) * 7;                         // the nuts back out, then screw back in
  for (let i = 0; i < 5; i++) { const a = spin + i * TAU / 5, d = 15 + out; X.beginPath(); X.arc(Math.cos(a) * d, Math.sin(a) * d, 3.3, 0, TAU); ink(p >= 1 ? '#5CFF7A' : '#ffd23f', 2); }
  X.restore();
}
/* the driver: a hamster in a helmet (or a rubber duck, 1 round in 8). mood: calm | worried | eager | joy | scared | stall */
function driver(x, y, mood, T, duck) {
  X.save(); X.translate(x, y);
  const bob = mood === 'joy' ? Math.sin(T * 18) * 3 : mood === 'scared' ? Math.sin(T * 40) * 2 : Math.sin(T * 3) * 1;
  X.translate(0, bob);
  X.beginPath(); X.arc(0, 0, 19, 0, TAU); ink(duck ? '#ffe14d' : '#fff', 4);                       // helmet / duck head
  if (!duck) { X.save(); X.beginPath(); X.arc(0, 0, 19, 0, TAU); X.clip(); X.fillStyle = '#ff4d5e'; X.fillRect(-20, -22, 40, 9); X.fillStyle = 'rgba(255,255,255,.7)'; el(-8, -8, 6, 3, -.5); X.fill(); X.restore(); }
  else { X.beginPath(); X.moveTo(14, -1); X.quadraticCurveTo(30, -3, 28, 5); X.quadraticCurveTo(20, 8, 14, 5); X.closePath(); ink('#ff9a4d', 3); glint(-7, -9, 5, 2.4, -.5, .7); }
  if (!duck) { X.beginPath(); X.ellipse(4, 3, 14, 10, 0, 0, TAU); ink('#ffd9a8', 3); }              // face patch
  const ex = duck ? 6 : 1;
  for (const sx of [-1, 1]) {
    const e = ex + sx * 6.5, ey = -1;
    if (mood === 'joy') { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(e, ey + 3, 4.5, Math.PI + .3, -.3); X.stroke(); }
    else { const big = mood === 'scared' ? 6.6 : mood === 'worried' ? 5.8 : 5; el(e, ey, big, mood === 'stall' ? 2.2 : big * 1.1); ink('#fff', 2); X.fillStyle = INK; el(e + (mood === 'worried' ? 1 : 1.5), ey + 1, mood === 'scared' ? 1.6 : 2.6, mood === 'stall' ? 1.4 : 2.8); X.fill(); }
  }
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath();
  if (mood === 'joy') { X.arc(ex + 1, 7, 5, .1, Math.PI - .1); } else if (mood === 'scared') { X.ellipse(ex + 1, 10, 3.5, 4.6, 0, 0, TAU); } else if (mood === 'worried' || mood === 'stall') { X.moveTo(ex - 4, 11); X.quadraticCurveTo(ex + 1, 7, ex + 6, 11); } else { X.moveTo(ex - 3, 9); X.lineTo(ex + 5, 9); }
  X.stroke();
  if (mood === 'worried' || mood === 'scared') { X.fillStyle = '#9fe3ff'; const sy = -14 + (T * 30) % 18; el(-17, sy, 2.4, 3.4); X.fill(); }
  X.restore();
}
/* the car, origin at the middle of the ground contact. o: lift 0..1, wp [p0, p1] wheel progress, cur wheel being worked, col index, mood, hide = which wheels are gone (bitmask), flame */
function car(x, o, T) {
  const L = o.lift || 0, c = CARS[o.col], y = CGY - L * LIFT;
  shadow(x, CGY + 3, 150 - L * 14, 12, .3 - L * .08);
  X.save(); X.translate(x, y); if (o.tilt) X.rotate(o.tilt);
  const stall = o.mood === 'stall' ? Math.sin(T * 50) * 1.2 : 0; X.translate(stall, 0);
  if (o.flame) {                                                                                       // exhaust flames
    for (let i = 0; i < 3; i++) { const fl = o.flame * (46 + i * 22 + Math.sin(T * 60 + i) * 8); X.beginPath(); X.moveTo(-124, -64 - i * 7); X.lineTo(-124 - fl, -58 - i * 7 + Math.sin(T * 40 + i) * 3); X.lineTo(-124, -52 - i * 7); X.closePath(); ink(i ? '#ffe14d' : '#ff7a2f', 3); }
  }
  // rear wing
  rr(-112, -120, 8, 34, 2); ink('#4a4660', 3); cel(() => rr(-140, -128, 52, 11, 5), c[0], c[1], 0, -2, 3.5);
  // body
  const body = () => { X.beginPath(); X.moveTo(-124, -42); X.lineTo(-126, -82); X.quadraticCurveTo(-126, -95, -112, -95); X.lineTo(8, -95); X.quadraticCurveTo(32, -98, 58, -88); X.lineTo(104, -72); X.quadraticCurveTo(132, -64, 130, -50); X.quadraticCurveTo(128, -42, 114, -42); X.closePath(); };
  cel(body, c[0], c[1], 5, 7, 5);
  X.save(); body(); X.clip(); X.fillStyle = '#fff'; rr(-130, -78, 262, 9, 4); X.fill(); X.fillStyle = c[2]; el(-40, -90, 56, 3.4, -.04); X.fill(); X.restore();
  X.fillStyle = '#2b2838'; el(14, -94, 24, 7); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();                      // cockpit
  rr(-112, -102, 20, 10, 3); ink('#d3cfe0', 2.5);                                                          // fuel flap
  if (o.flapOpen) { rr(-112, -106, 20, 6, 3); ink('#8f88a6', 2.5); }
  X.beginPath(); X.arc(-44, -64, 15, 0, TAU); ink('#fff', 3); txt(String(o.num || 7), -44, -63, 20, INK);
  X.beginPath(); X.arc(112, -60, 7, 0, TAU); ink('#fff3a0', 2.5);                                          // headlamp
  // wheel arches then wheels (the car hangs a little when lifted, so the tyres drop a touch)
  for (let i = 0; i < 2; i++) {
    const hx = i ? -HUBX : HUBX, gone = o.gone && (o.gone >> i & 1);
    X.fillStyle = '#1f1b2e'; X.beginPath(); X.arc(hx, -HUBY, WR + 6, Math.PI, 0); X.fill();
    if (!gone) wheel(hx, -HUBY, o.wp[i === 0 ? 0 : 1], (o.spin || 0) * (i === (o.cur || 0) ? 1 : 0) + hx, i === o.cur, T);
  }
  // driver
  if (o.mood !== 'none') driver(10, -114, o.mood || 'calm', T, o.duck);
  X.restore();
}
/* the trolley jack under the car: base on the ground, ram up to the belly, handle out to the left */
function jackProp(x, L, pump) {
  const top = CGY - 36 - L * LIFT;
  rr(x - 36, CGY - 14, 72, 14, 5); ink('#e8434f', 3.5);
  rr(x - 9, top + 6, 18, CGY - 14 - top - 4, 3); ink('#c9ced6', 3);
  X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(x - 5, top + 10, 4, Math.max(0, CGY - 14 - top - 12));
  rr(x - 22, top - 2, 44, 10, 4); ink('#ffd23f', 3);
  for (const wx of [-24, 24]) { X.beginPath(); X.arc(x + wx, CGY - 2, 6, 0, TAU); ink('#2b2838', 2.5); }
  line([[x - 14, CGY - 18], [XJ + 26, GY - 38 + pump * 8]], 14, INK); line([[x - 14, CGY - 18], [XJ + 26, GY - 38 + pump * 8]], 7, '#ff9a4d');
}
/* a crew member: claude() in the player's colour with a hard hat. hat colour tells the job */
function crew(x, y, col, mood, hat, o = {}) {
  const u = 4.2; X.save(); X.translate(x, y);
  shadow(x, y + 1, 30, 7, .22);
  if (o.arms) { const [la, lk, ra, rk] = o.arms; arm(u, -1, la, lk, col); arm(u, 1, ra, rk, col); }
  X.restore();
  X.save(); X.translate(x, y); claude(0, 0, u, { col, mood, run: o.run }); X.restore();
  X.save(); X.translate(x, y);
  rr(-5.4 * u, -11.2 * u, 10.8 * u, 2.6 * u, 1.4 * u); ink(hat, 3); rr(-3.2 * u, -12.7 * u, 6.4 * u, 2 * u, u); ink(hat, 3);
  X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(-4.4 * u, -10.6 * u, 3.6 * u, .6 * u);
  X.restore();
}
/* the lollipop: a pole with a round sign. s = raised 0..1, stop = red STOP else green GO */
function lollipop(x, y, s, stop, T) {
  const top = lerp(y - 108, y - 172, s), sway = Math.sin(T * 2.4) * (s * 2);
  line([[x, y - 18], [x + sway, top + 30]], 11, INK); line([[x, y - 18], [x + sway, top + 30]], 5, '#e8e4f2');
  X.save(); X.translate(x + sway, top); X.rotate(sway * .02);
  X.beginPath(); X.arc(0, 0, 36, 0, TAU); ink(stop ? '#ff4d5e' : '#4fd06a', 5);
  X.beginPath(); X.arc(0, 0, 28, 0, TAU); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke();
  glint(-12, -16, 11, 4.5, -.6, .55);
  txt(stop ? 'STOP' : 'GO!', 0, 1, stop ? 19 : 22, '#fff', 'center', 52);
  X.restore();
}
/* the mechanic's cat: sits at (x, y) (feet); mood calm | cheer | gasp; look = x it stares at; hold = standing holding the lollipop pole (3 players) */
function cat(x, y, mood, look, T, hold) {
  const fur = '#ff9a4d', fur2 = '#c9692a', bel = '#ffe0c0';
  X.save(); X.translate(x, y); if (mood === 'cheer') X.translate(0, -Math.abs(Math.sin(T * 10)) * 12);
  const ts = Math.sin(T * 3.1) * .5 + (mood === 'gasp' ? Math.sin(T * 30) * .3 : 0);
  X.beginPath(); X.moveTo(18, -10); X.quadraticCurveTo(44 + ts * 10, -14, 42 + ts * 14, -50 + ts * 6); X.lineWidth = 15; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = fur; X.stroke();
  cel(() => el(0, -22, 22, hold ? 26 : 22), fur, fur2, 4, 5, 4);
  el(2, -16, 11, hold ? 17 : 14); ink(bel, 2.5);
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 15, -50); X.lineTo(sx * 21, -72); X.lineTo(sx * 4, -60); X.closePath(); ink(fur, 3); X.beginPath(); X.moveTo(sx * 14, -54); X.lineTo(sx * 17, -66); X.lineTo(sx * 8, -59); X.closePath(); X.fillStyle = '#ffb3c0'; X.fill(); }
  cel(() => el(0, -46, 20, 17), fur, fur2, 3, 4, 4);
  const lx = clamp((look - x) / 200, -1, 1) * 2.2;
  for (const sx of [-1, 1]) { el(sx * 8, -48, 6, mood === 'gasp' ? 8 : 6.6); ink('#fff', 2); X.fillStyle = INK; el(sx * 8 + lx, -48, 2.4, mood === 'gasp' ? 2 : 4.2); X.fill(); }
  X.beginPath(); X.moveTo(-2, -40); X.lineTo(2, -40); X.lineTo(0, -37); X.closePath(); ink('#ff7ea8', 1.5);
  X.strokeStyle = INK; X.lineWidth = 2.2; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, -37); X.quadraticCurveTo(-4, -33, -7, -35); X.moveTo(0, -37); X.quadraticCurveTo(4, -33, 7, -35); X.stroke();
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 8, -39); X.lineTo(sx * 24, -41); X.moveTo(sx * 8, -37); X.lineTo(sx * 24, -35); X.stroke(); }
  X.restore();
}
/* a spare tyre stack */
function tyres(x, y, n, tip) {
  for (let i = 0; i < n; i++) { const yy = y - 12 - i * 26, dx = i === n - 1 ? tip : 0; X.save(); X.translate(x + dx, yy); el(0, 0, 38, 14); ink('#2b2838', 4); el(0, -6, 38, 14); ink('#3b3550', 4); el(0, -6, 22, 7); ink('#1f1b2e', 3); X.fillStyle = '#ff4d5e'; X.beginPath(); X.ellipse(0, -6, 38, 14, 0, Math.PI * 1.1, Math.PI * 1.35); X.lineTo(0, -6); X.fill(); X.restore(); }
}

/* ───────────── the pit lane, baked once ───────────── */
let BG = null;
function btxt(s, x, y, size, fill, ang) {            // text on the baked canvas (txt() only paints on the live one)
  X.save(); X.translate(x, y); X.rotate(ang || 0); X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round';
  X.lineWidth = size / 5; X.strokeStyle = INK; const s2 = t(s); X.strokeText(s2, 0, 0); X.fillStyle = fill; X.fillText(s2, 0, 0); X.restore();
}
const ADS = [['ZOOM OIL', '#ffd23f', INK], ['NOM NOM', '#ff5c8a', '#fff'], ['TURBO TOOTS', '#4db8ff', '#fff'], ['BOING TYRES', '#4fd06a', '#fff'], ['ZOOM OIL', '#ffd23f', INK], ['NOM NOM', '#ff5c8a', '#fff']];
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#3fb0ff'); g.addColorStop(.6, '#8fdcff'); g.addColorStop(1, '#e6fbff'); X.fillStyle = g; X.fillRect(0, 0, W, 330);
  // far hills
  X.fillStyle = '#9be38a'; X.beginPath(); X.moveTo(0, 190); X.quadraticCurveTo(120, 120, 260, 170); X.quadraticCurveTo(380, 120, 520, 165); X.quadraticCurveTo(660, 110, 800, 160); X.lineTo(800, 330); X.lineTo(0, 330); X.fill(); X.lineWidth = 3; X.strokeStyle = '#2f7a49'; X.stroke();
  // the grandstand: three tiers of seats full of fans (their bodies are baked, a few of them bounce live)
  const tiers = [[236, '#c4c9e8'], [200, '#aeb4e0'], [164, '#9aa1d8']];
  for (const [ty, tc] of tiers) { X.fillStyle = tc; X.fillRect(0, ty, W, 36); X.fillStyle = 'rgba(20,16,28,.28)'; X.fillRect(0, ty + 30, W, 6); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, ty); X.lineTo(W, ty); X.stroke(); }
  const fcol = ['#ff5c8a', '#ffd23f', '#4db8ff', '#4fd06a', '#ff9a4d', '#b49cff'];
  tiers.forEach(([ty], ti) => { for (let i = 0; i < 17; i++) { const x = 24 + i * 47 + (ti % 2) * 22 + ((i * 53 + ti * 17) % 13) - 6, c = fcol[(i * 5 + ti * 2) % 6]; el(x, ty + 22, 12, 14); ink(c, 2.5); X.beginPath(); X.arc(x, ty + 4, 9.5, 0, TAU); ink('#ffd9a8', 2.5); } });
  // pit wall: a white barrier with ads, red / white kerb on top
  X.fillStyle = '#e8e4f2'; X.fillRect(0, 286, W, 66); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 286); X.lineTo(W, 286); X.moveTo(0, 352); X.lineTo(W, 352); X.stroke();
  for (let i = 0; i < 40; i++) { X.fillStyle = i % 2 ? '#ff4d5e' : '#fff'; X.fillRect(i * 20, 278, 20, 10); } X.strokeStyle = INK; X.lineWidth = 3; X.strokeRect(0, 278, W, 10);
  ADS.forEach(([s, bgc, fg], i) => { const x = 86 + i * 126; rr(x - 54, 298, 108, 42, 9); ink(bgc, 3.5); btxt(s, x, 320, s.length > 8 ? 13 : 15, fg === INK ? '#fff' : fg); });
  // asphalt with the pit lane lines
  g = X.createLinearGradient(0, 352, 0, H); g.addColorStop(0, '#6a6e86'); g.addColorStop(1, '#4a4d63'); X.fillStyle = g; X.fillRect(0, 352, W, H - 352);
  X.fillStyle = 'rgba(255,255,255,.07)'; for (let i = -3; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, H); X.lineTo(i * 90 + 40, H); X.lineTo(i * 90 + 130, 352); X.lineTo(i * 90 + 100, 352); X.fill(); }
  X.fillStyle = '#fff'; X.fillRect(0, 372, W, 5); X.fillStyle = '#ffd23f'; X.fillRect(0, 514, W, 6);
  X.fillStyle = 'rgba(255,255,255,.9)'; for (let x = 12; x < W; x += 64) X.fillRect(x, 536, 34, 4);
  // skid marks and an oil spot
  X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 436); X.quadraticCurveTo(120, 440, 250, 436); X.moveTo(0, 424); X.quadraticCurveTo(120, 428, 250, 424); X.stroke();
  X.fillStyle = 'rgba(20,16,28,.22)'; el(700, 436, 46, 10); X.fill();
  // the pit canopy gantry the lamps hang from
  X.fillStyle = INK; X.fillRect(0, GANTRY - 7, W, 20); X.fillStyle = '#d3cfe0'; X.fillRect(0, GANTRY - 4, W, 14); X.fillStyle = 'rgba(255,255,255,.6)'; X.fillRect(0, GANTRY - 2, W, 3);
  for (const px of [6, 794]) { rr(px - 8, GANTRY - 6, 16, 150, 4); ink('#d3cfe0', 3); }
  // the fuel rig: a pump with a glass window, the hose goes out of its side
  const [rx0, rx1] = RIGX; rr(rx0, 318, rx1 - rx0, 170, 16); ink('#ff4d5e', 4.5);
  X.save(); rr(rx0, 318, rx1 - rx0, 170, 16); X.clip(); X.fillStyle = '#b8283a'; X.fillRect(rx1 - 22, 318, 30, 180); X.restore();
  rr(rx0 + 4, 300, rx1 - rx0 - 8, 28, 10); ink('#ffd23f', 3.5); btxt('FUEL', (rx0 + rx1) / 2, 315, 16, '#fff');
  rr(rx0 + 12, WIN_Y[0] + 4, 64, WIN_Y[1] - WIN_Y[0] + 8, 10); ink('#e8f3ff', 3.5);
  rr(rx1 - 8, 438, 14, 24, 5); ink('#6a6e86', 3);
  X = old; return cv;
}
const CLOUDS = [[40, 74, 1], [330, 118, .8], [610, 84, 1.1]];
function clouds(T) {
  for (const [x0, y, s] of CLOUDS) {
    const x = (x0 + T * 6 * s) % 1000 - 140;
    X.save(); X.translate(x, y); X.scale(s, s);
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 22], [26, 8, 24]]) { X.beginPath(); X.arc(dx, dy, r, 0, TAU); ink(null, 3); }
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 22], [26, 8, 24]]) { X.beginPath(); X.arc(dx, dy, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    glint(14, -14, 14, 6, -.3, .8);
    X.restore();
  }
}
/* the grandstand fans that jump (live): bounce more on a win, hide on a loss */
const FANS = [[60, 0], [150, 1], [260, 0], [360, 2], [470, 1], [570, 0], [680, 2], [760, 1]];
function fans(T, won, lost, rk) {
  FANS.forEach(([x, ti], i) => {
    const ty = [236, 200, 164][ti], hop = won ? Math.abs(Math.sin(T * 9 + i)) * 14 : lost ? 0 : Math.max(0, Math.sin(T * 3 + i * 1.7)) * 3;
    const col = ['#ff5c8a', '#ffd23f', '#4db8ff', '#4fd06a'][i % 4], y = ty + 8 - hop;
    X.save(); X.translate(x + 8, y);
    if (won) { line([[-6, 12], [-14, -4 + Math.sin(T * 12 + i) * 4]], 6, INK); line([[-6, 12], [-14, -4 + Math.sin(T * 12 + i) * 4]], 3, '#ffd9a8'); }
    X.restore();
    el(x, ty + 22 - hop, 12, 14); ink(col, 2.5); X.beginPath(); X.arc(x, ty + 4 - hop, 9.5, 0, TAU); ink('#ffd9a8', 2.5);
    X.fillStyle = INK; for (const sx of [-3.4, 3.4]) { X.beginPath(); X.arc(x + sx, ty + 2 - hop, lost ? 1.2 : 1.8, 0, TAU); X.fill(); }
    X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); if (won) X.arc(x, ty + 6 - hop, 3.4, .1, Math.PI - .1); else if (lost) X.arc(x, ty + 10 - hop, 3, Math.PI + .3, -.3); else { X.moveTo(x - 2, ty + 8 - hop); X.lineTo(x + 2, ty + 8 - hop); } X.stroke();
  });
}
function flag(x, y, T) {                                // a chequered flag on a pole, waving
  rr(x - 3, y - 10, 6, 80, 3); ink('#e8e4f2', 2.5);
  const w = i => Math.sin(T * 6 + i * .9) * 5 * (i / 4 + .2);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x0 = x + 3 + c * 13, y0 = y - 8 + r * 11 + w(c), q = (r + c) % 2; X.fillStyle = q ? '#fff' : INK; X.fillRect(x0, y0, 13, 11); }
  X.strokeStyle = INK; X.lineWidth = 3; X.strokeRect(x + 3, y - 8 + w(0), 52, 33);
}

/* the rival crew, fast asleep on deck chairs behind the wall (the background gag). woke: 0..1 */
function rivals(T, woke) {
  [[708, '#8a93b8'], [746, '#b8a2c9'], [782, '#92b8a6']].forEach(([x, col], i) => {
    const y = 288, ph = i * 1.3;
    rr(x - 19, y - 14, 38, 8, 3); ink('#ffa04d', 2.5); line([[x - 17, y - 8], [x - 22, y + 2]], 5, INK); line([[x + 17, y - 8], [x + 22, y + 2]], 5, INK);   // chair
    X.save(); X.translate(x, y - 14); X.rotate(woke > 0 ? Math.sin(T * 30 + i) * .1 : 0); claude(0, 0, 2.5, { col, mood: null });
    if (woke > .1) { el(-4, -14.5, 3, 3.4); X.fillStyle = '#fff'; X.fill(); X.lineWidth = 1.5; X.strokeStyle = INK; X.stroke(); el(4, -14.5, 3, 3.4); X.fill(); X.stroke(); X.fillStyle = INK; el(-4, -14.5, 1.1, 1.1); X.fill(); el(4, -14.5, 1.1, 1.1); X.fill(); }
    else { X.fillStyle = col; X.fillRect(-9, -17, 18, 4.5); X.strokeStyle = INK; X.lineWidth = 1.6; for (const sx of [-4.2, 4.2]) { X.beginPath(); X.arc(sx, -15, 1.9, .2, Math.PI - .2); X.stroke(); } }
    rr(-8, -26, 16, 4.5, 2); ink('#ffd23f', 2);
    X.restore();
    if (woke <= .1) { const k = ((T * .5 + ph) % 1); zee(x + 12 + k * 8, y - 36 - k * 22, 9 + k * 6, 1 - k); }
  });
  if (woke > .1) badge('!?', 746, 226, 20, '#ff4d5e', '#fff', outBack(woke), -.05);
}

/* the fuel rig's gauge window: level f, the green zone starting at zl, spill = seconds since the last spill */
function rigGauge(f, zl, fd, pour, T, spill) {
  const [wy0, wy1] = WIN_Y, x0 = RIGX[0] + 12, w = 64, h = wy1 - wy0 + 8, y0 = wy0 + 4, wob = Math.sin(T * 7) * 1.4;
  X.save(); rr(x0, y0, w, h, 10); X.clip(); X.fillStyle = '#fff'; X.fillRect(x0, y0, w, h);
  const ly = y0 + h - 4 - (h - 8) * f; X.fillStyle = '#ffb52e'; X.beginPath(); X.moveTo(x0, ly + wob); X.lineTo(x0 + w, ly - wob); X.lineTo(x0 + w, y0 + h); X.lineTo(x0, y0 + h); X.fill(); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(x0 + 6, ly + 4, 6, Math.max(0, y0 + h - ly - 10));
  const zt = y0 + h - 4 - (h - 8) * (zl + .22), zb = y0 + h - 4 - (h - 8) * zl; X.globalAlpha = fd ? .9 : .55 + .15 * Math.sin(T * 8); X.fillStyle = '#4fd06a'; X.fillRect(x0 + w - 22, zt, 22, zb - zt); X.globalAlpha = 1;
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(x0 + w - 22, zt); X.lineTo(x0 + w, zt); X.moveTo(x0 + w - 22, zb); X.lineTo(x0 + w, zb); X.stroke();
  X.fillStyle = '#ff4d5e'; X.fillRect(x0, y0, w, 6);
  if (spill < .8) { X.fillStyle = '#ffb52e'; X.fillRect(x0, y0 - 2, w, 8); }
  X.restore(); rr(x0, y0, w, h, 10); X.lineWidth = 3.5; X.strokeStyle = INK; X.stroke();
  for (let i = 0; i < 3 && pour; i++) { const q = (T * 1.4 + i / 3) % 1; X.fillStyle = 'rgba(255,255,255,.8)'; X.beginPath(); X.arc(x0 + 14 + i * 16, y0 + h - q * (h - 8) * f, 2.4, 0, TAU); X.fill(); }
  if (spill < .7) for (let i = 0; i < 5; i++) { const q = spill * 2 + i * .2; drop(RIGX[0] + 20 + i * 18, 296 - Math.sin(q * 4) * 20 + q * 12, 5); }
}
function drop(x, y, r, col) { X.beginPath(); X.moveTo(x, y - r * 1.7); X.quadraticCurveTo(x + r * 1.1, y - r * .2, x, y + r); X.quadraticCurveTo(x - r * 1.1, y - r * .2, x, y - r * 1.7); X.closePath(); ink(col || '#ffb52e', 2); }
/* the fuel hose: pump -> the mechanic's hand -> the flap on the car at carx (or hanging from his hand once the tank is full) */
function hoseDraw(carx, L, pour, hang, T) {
  const fx = XF + 12, fy = GY - 40, flapX = carx - 102, flapY = CGY - L * LIFT - 100;
  line([[RIGX[1] - 2, 450], [RIGX[1] + 30, 480], [fx - 14, fy + 10]], 12, INK); X.beginPath(); X.moveTo(RIGX[1] - 2, 450); X.quadraticCurveTo(RIGX[1] + 40, 500, fx - 6, fy + 6); X.lineWidth = 7; X.strokeStyle = '#2b2838'; X.stroke();
  const ex = hang ? fx + 22 : flapX, ey = hang ? fy + 26 : flapY + 4;
  X.beginPath(); X.moveTo(fx - 6, fy + 6); X.quadraticCurveTo((fx + ex) / 2, hang ? fy + 40 : flapY + 30, ex, ey); X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#ffd23f'; X.stroke();
  if (pour) { X.setLineDash([8, 12]); X.lineDashOffset = -T * 120; X.beginPath(); X.moveTo(fx - 6, fy + 6); X.quadraticCurveTo((fx + ex) / 2, flapY + 30, ex, ey); X.lineWidth = 4; X.strokeStyle = '#ffb52e'; X.stroke(); X.setLineDash([]); }
  rr(ex - 6, ey - 6, 14, 12, 3); ink('#c9ced6', 2.5);
}

/* ───────────── the game ───────────── */
function sqPit(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles >= 4 ? 4 : 3, me = D.role;
  const JACK = 0, WHEEL = 1, FUEL = 2, SIGN = 3, judgeR = n === 4 ? 3 : 2;
  /* the level: the same on every screen whatever n / role */
  const CARC = Math.floor(R() * 4), ZL = .56 + R() * .14, ZW = .22, NEED = [10 + Math.floor(R() * 3), 10 + Math.floor(R() * 3)], DUCK = R() < 1 / 8, NUM = 2 + Math.floor(R() * 8);
  const DEC = .6, TAP = .35, UP = .5, DOWN = .08;            // jack: each pump adds TAP, the ram leaks DEC per s, the wheels need >= UP, "on the ground" is < DOWN
  const FR = .42, STUN = .8;                                  // fuel: gauge per s while pouring, stun after a spill
  const isJ = me === JACK, isW = me === WHEEL, isF = me === FUEL, isS = n === 4 && me === SIGN, judge = me === judgeR;
  const colOf = r => (D.byRole[r] || {}).color || PCOL[r], nmOf = r => (D.byRole[r] || {}).name || 'P' + (r + 1);
  /* state */
  let Lj = 0, tapAt = -9, jackSent = -9, lastJack = '', seenUp = -9, prevJl = 0;
  const jackT = track(), fuelT = track();
  let wp = [0, 0], wcur = 0, wd = false, wSent = -9, lastW = '', manX = XW[0], ang = null, side = '', wTapAt = -9, ptr = [XW[0], 300], runPh = 0;
  let F = 0, fHeld = false, pour = false, fd = false, stunUntil = -9, fSent = -9, lastF = '', spillAt = -9, fdAt = -9, pourSeen = false;
  let sign = 0, sk = 0, signAt = -9, allSince = -1, lossBits = 8, resAt = -1, ldone = false, lampAt = [-9, -9, -9], fN = FOCUSN;
  const bits = [], pops = [];
  const jl = () => isJ ? Lj : (jackT.at() || 0);
  const fl = () => isF ? F : (fuelT.at() || 0);
  const allGreen = () => wd && fd && jl() < DOWN && g.c >= ARR;
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 600, vx: 0, vy: 0, r: 4, c: '#fff' }, o)); }
  function sparks(x, y, k, col) { for (let i = 0; i < k; i++) bit({ x, y, vx: (cr() - .5) * 320, vy: -(80 + cr() * 220), r: 2 + cr() * 2.4, c: col || '#ffd23f', life: .5 }); }
  function spillFx() { spillAt = g.c; sfx.boing(); sfx.splat(); shake(5, .2); for (let i = 0; i < 12; i++) bit({ x: 70 + (cr() - .5) * 40, y: 322, vx: (cr() - .5) * 240, vy: -(160 + cr() * 220), r: 3 + cr() * 3, c: '#ffb52e', life: .8, gr: 900 }); pop('SPLASH!', 100, 280, 28, '#ff9a4d', '#fff'); }
  function hubPos(i) { return [carX() + (i ? -HUBX : HUBX), CGY - HUBY - jl() * LIFT]; }
  function carX() { const T = g.c; if (T < ARR) return lerp(-230, CX, 1 - (1 - ease(T / ARR)) ** 2); return CX; }

  /* ── my own part ── */
  function jackTap() { if (g.c < ARR || g.result) return; Lj = Math.min(1, Lj + TAP); tapAt = g.c; snd(260 + Lj * 300, .05, 'square', .04, 0, 200 + Lj * 380); }
  function turn(units) {                                           // the wheel gun
    if (g.c < ARR || g.result || wd) return;
    if (jl() < UP) { if (g.c - wTapAt > .9) { wTapAt = g.c; pop('JACK IT UP!', hubPos(wcur)[0], hubPos(wcur)[1] - 70, 24, '#ff9a4d', '#fff'); snd(150, .1, 'sawtooth', .04, 0, 100); } return; }
    const w = wcur; wp[w] = Math.min(1, wp[w] + units / NEED[w]); wTapAt = g.c; if (cr() < .5) snd(900 + wp[w] * 600, .03, 'square', .025, 0, 1400); const [hx, hy] = hubPos(w); sparks(hx + 20, hy - 10, 1, '#ffe14d');
    if (wp[w] >= 1) {
      sfx.coin(); ring(hx, hy, '#fff', 60, .3); pop(w ? 'TIGHT!' : 'GRIPPY!', hx, hy - 76, 26, '#4fd06a', '#fff');
      if (w === 0) wcur = 1; else { wd = true; D.send('wdone', 1); }
    }
  }
  function fuelRelease() {
    if (fd || g.c < ARR) return;
    if (F >= ZL && F <= ZL + ZW) { fd = true; fdAt = g.c; D.send('fdone', 1); sfx.coin(); ring(84, 392, '#fff', 70, .3); pop('FULL!', 150, 310, 28, '#4fd06a', '#fff'); }
    else if (F > ZL + ZW) { F = Math.max(0, F - .3); pop('TOO MUCH!', 150, 310, 24, '#e8434f', '#fff'); snd(180, .15, 'sawtooth', .05, 0, 90); }
    else if (F > .03) pop('MORE!', 150, 310, 24, '#ff9a4d', '#fff');
  }
  function signUp() { if (g.c < ARR || g.result || sign) return; sign = 1; signAt = g.c; D.send('sign', 1); snd(520, .08, 'square', .05, 0, 780); }
  function signRelease() {                                          // the lollipop man lets go: the car is sent off, ready or not
    if (!sign) return; sign = 0; signAt = g.c; D.send('sign', 0);
    if (g.result) return; if (allGreen()) g.finish('win'); else lose();
  }
  function lose() { if (g.result) return; lossBits = (wd ? 0 : 1) | (fd ? 0 : 2) | (jl() >= DOWN ? 4 : 0) | 8; D.send('why', lossBits); g.finish('lose'); }

  const g = {
    c: 0, dur: 14, pts: 0,
    cmd: ['PUMP!', 'SPIN!', 'FILL!', 'HOLD!'][me] || 'PUMP!', roleLabel: ['JACK', 'WHEELS', 'FUEL', 'LOLLIPOP'][me] || 'JACK',
    hint: [
      'TAP CLICK / SPACE TO PUMP THE JACK - KEEP THE CAR UP WHILE THE WHEELS ARE DONE, THEN LET IT DOWN',
      'CIRCLE THE MOUSE ROUND THE WHEEL (OR MASH A / D) TO SPIN THE GUN - THE CAR MUST BE UP',
      'HOLD CLICK / SPACE TO FILL THE TANK - LET GO WHEN THE LEVEL IS IN THE GREEN',
      'HOLD CLICK / SPACE TO RAISE THE SIGN - LET GO WHEN ALL THE LAMPS ARE GREEN',
    ][me] || '',
    thint: [
      'TAP TO PUMP THE JACK - KEEP THE CAR UP, THEN LET IT DOWN',
      'DRAG A CIRCLE ROUND THE WHEEL (OR TAP) TO SPIN THE GUN - THE CAR MUST BE UP',
      'HOLD TO FILL THE TANK - LET GO WHEN THE LEVEL IS IN THE GREEN',
      'HOLD TO RAISE THE SIGN - LET GO WHEN ALL THE LAMPS ARE GREEN',
    ][me] || '',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) { resAt = T; if (g.result === 'win') { sfx.coin(); snd(180, .6, 'sawtooth', .06, 0, 900); } else snd(300, .5, 'sawtooth', .06, 0, 80); }
      const done = !!g.result;
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; if (fHeld) { fHeld = false; fuelRelease(); } if (sign && isS) signRelease(); }
      if (isJ) {
        if (!done) Lj = Math.max(0, Lj - DEC * dt);
        const s = Math.round(Lj * 100) + ''; if (s !== lastJack && T - jackSent >= .1) { lastJack = s; jackSent = T; D.send('jack', Math.round(Lj * 100), true); }
      } else { const v = jackT.at() || 0; if (v > prevJl + .004) seenUp = T; prevJl = v; }
      manX += (XW[wcur] - manX) * Math.min(1, dt * 7); runPh += dt * 20;
      if (isW && !done) {
        const s = Math.round(wp[0] * 100) + ',' + Math.round(wp[1] * 100) + ',' + wcur; if (s !== lastW && T - wSent >= .12) { lastW = s; wSent = T; D.send('wheels', [Math.round(wp[0] * 100), Math.round(wp[1] * 100), wcur], true); }
      }
      if (isF) {
        const want = fHeld && !done && !fd && T >= ARR && T >= stunUntil, was = pour; pour = want;
        if (pour && !was) noise(.15, .04, 700, 2400, 'bandpass');
        if (pour) { F += FR * dt; if (cr() < dt * 14) noise(.06, .02, 1200, 2600, 'bandpass'); if (F >= 1) { F = .3; stunUntil = T + STUN; pour = false; fHeld = false; spillFx(); D.send('spill', 1); } }
        const s = Math.round(F * 100) + ',' + (pour ? 1 : 0); if (s !== lastF && T - fSent >= .1) { lastF = s; fSent = T; D.send('fuel', [Math.round(F * 100), pour ? 1 : 0], true); }
      }
      if (T < ARR && cr() < dt * 22) bit({ x: carX() - 120, y: CGY - 4, vx: -60 - cr() * 80, vy: -20 - cr() * 40, gr: -30, r: 8 + cr() * 8, c: '#f1eef8', life: .6, puff: 1 });
      sk += (sign - sk) * Math.min(1, dt * 14);
      // the verdict
      if (judge && !done) {
        if (n === 3) { if (allGreen()) { if (allSince < 0) allSince = T; if (T - allSince >= .55) g.finish('win'); } else allSince = -1; }
        if (!g.result && T >= g.limit) lose();
      }
      if (n === 3 && !judge) { if (allGreen()) { if (allSince < 0) allSince = T; } else allSince = -1; }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && T - pops[0].t0 > 1) pops.length = 0;
    },
    msg(type, d, from) {
      if (type === 'jack') jackT.push(d / 100);
      else if (type === 'wheels' && Array.isArray(d)) { if (!isW) { wp = [Math.max(wp[0], d[0] / 100), Math.max(wp[1], d[1] / 100)]; wcur = d[2] || 0; } }
      else if (type === 'wdone') { wd = true; wp = [1, 1]; wcur = 1; if (!isW) { sfx.coin(); lampAt[0] = g.c; } }
      else if (type === 'fuel' && Array.isArray(d)) { fuelT.push(d[0] / 100); pour = !!d[1]; }
      else if (type === 'fdone') { fd = true; fdAt = g.c; lampAt[1] = g.c; }
      else if (type === 'spill') spillFx();
      else if (type === 'sign') { sign = d ? 1 : 0; signAt = g.c; }
      else if (type === 'why') lossBits = d | 0;
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      clouds(T);
      fans(T, won, lost, rk);
      flag(26, 120, T); flag(764, 112, T + 1);
      rivals(T, won && rk > .2 ? ease((rk - .2) / .2) : lost && rk > .5 ? .01 : 0);
      const L = jl(), green = allGreen();
      // ── the lamps on the gantry ──
      const lamps = [[XF, 'FUEL', fd ? 2 : pour ? 1 : 0, lampAt[1]], [XJ, 'JACK', g.c < ARR ? 2 : L < DOWN ? 2 : 1, -9], [XW[0] - 2, 'WHEELS', wd ? 2 : (wTapAt > T - .5 ? 1 : 0), lampAt[0]]];
      if (n === 4) lamps.push([XS, 'GO!', green ? 2 : 0, -9]);
      for (const [lx, lab, st, at] of lamps) {
        line([[lx, GANTRY + 8], [lx, LAMPY - 22]], 7, INK); line([[lx, GANTRY + 8], [lx, LAMPY - 22]], 3.5, '#d3cfe0');
        rr(lx - 30, GANTRY + 12, 60, 22, 11); ink('#fff', 3); txt(lab, lx, GANTRY + 24, 13, INK, 'center', 52);
        const pulse = st === 2 ? 1 + Math.max(0, .35 - (T - at)) * .8 : 1, col = st === 2 ? '#5CFF7A' : st === 1 ? '#ffd23f' : '#ff4d5e', dk = st === 2 ? '#23a046' : st === 1 ? '#c99512' : '#b8283a';
        X.save(); X.translate(lx, LAMPY + 4); X.scale(pulse, pulse);
        if (st === 2) { X.globalAlpha = .35 + .15 * Math.sin(T * 6); X.fillStyle = '#5CFF7A'; X.beginPath(); X.arc(0, 0, 30, 0, TAU); X.fill(); X.globalAlpha = 1; }
        X.beginPath(); X.arc(0, 0, 17, 0, TAU); ink(dk, 4); X.beginPath(); X.arc(-1.5, -1.5, 14, 0, TAU); X.fillStyle = col; X.fill(); glint(-5, -7, 6, 3, -.6, .7);
        X.restore();
      }
      if (green && !g.result && n === 4) { badge(isS ? 'LET GO!' : 'ALL GREEN!', XS, 330, 20, '#4fd06a', '#fff', 1 + Math.sin(T * 12) * .05, -.04); }
      rigGauge(clamp(fl(), 0, 1), ZL, fd, pour, T, T - spillAt);
      // ── the car, its jack and its wheels ──
      const cx = won && rk > .2 ? winX(rk) : lost && rk >= 0 ? loseX(rk) : carX();
      const mood = won ? 'joy' : lost ? (lossBits & 7 ? 'scared' : 'stall') : T < ARR ? 'calm' : (g.limit - T < 4) ? 'worried' : (green ? 'joy' : 'calm');
      const gone = lost && rk >= 0 && lossBits & 1 ? (wd ? 0 : wp[0] >= 1 ? 2 : 1) : 0;
      jackProp(CX + 8 + (lost && rk > .1 && lossBits & 4 ? cx - CX : 0), L, isJ ? Math.max(0, 1 - (T - tapAt) / .15) : Math.max(0, 1 - (T - seenUp) / .15));
      car(cx, { lift: L, wp, cur: wcur, col: CARC, mood, gone, num: NUM, duck: DUCK, spin: wp[wcur] * 40, flame: won && rk > .08 ? clamp((rk - .08) * 5, 0, 1) : 0, tilt: lost && rk > .5 ? -.12 : 0, flapOpen: !fd && T >= ARR }, T);
      hoseDraw(cx, L, pour, fd && !lost, T);
      // ── the crew ──
      const happy = won ? 'happy' : lost ? 'sad' : null, hop = k => won ? -Math.abs(Math.sin(T * 9 + k)) * 14 : 0;
      const pumpD = isJ ? Math.max(0, 1 - (T - tapAt) / .15) : Math.max(0, 1 - (T - seenUp) / .15);
      crew(XJ, GY + hop(1), colOf(JACK), happy, '#ff9a4d', { arms: won ? [-.45, 1, .45, 1] : [-.35, .8 + pumpD * .2, .75 - pumpD * .1, .9] });
      pill(XJ, GY - 66 + hop(1), isJ ? 'YOU' : nmOf(JACK), colOf(JACK), !isJ);
      { // the wheel gun man runs between the two jobs
        const run = Math.abs(manX - XW[wcur]) > 6, [hx, hy] = hubPos(wcur), working = T - wTapAt < .25 && !g.result;
        const aim = Math.atan2(hy - (GY - 20), hx - manX);
        crew(manX, GY + hop(2), colOf(WHEEL), happy, '#4db8ff', { run: run ? runPh : undefined, arms: won ? [-.45, 1, .45, 1] : [-.5, .5, clamp(Math.PI / 2 + aim, .3, 2.2), .95] });
        if (!won && !lost && !wd) { X.save(); X.translate(manX + 28, GY - 38); X.rotate(clamp(aim * .7, -1, 1) + (working ? Math.sin(T * 60) * .06 : 0)); rr(-4, -8, 36, 16, 6); ink('#ff4d5e', 3); rr(30, -5, 12, 10, 3); ink('#c9ced6', 2.5); X.restore(); }
        pill(manX, GY - 66 + hop(2), isW ? 'YOU' : nmOf(WHEEL), colOf(WHEEL), !isW);
        if (!won && !lost && !wd && jl() >= UP) {   // progress ring round the hub
          X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = 'rgba(20,16,28,.6)'; X.beginPath(); X.arc(hx, hy, WR + 12, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.02, wp[wcur])); X.stroke(); X.lineWidth = 4.5; X.strokeStyle = wp[wcur] > .5 ? '#5CFF7A' : '#ffd23f'; X.stroke();
        }
      }
      crew(XF, GY + hop(0), colOf(FUEL), pourFace(happy), '#4fd06a', { arms: won ? [-.45, 1, .45, 1] : [-.4, .6, .9, .8] });
      pill(XF, GY - 66 + hop(0), isF ? 'YOU' : nmOf(FUEL), colOf(FUEL), !isF);
      if (n === 4) {
        const st = sk, x = XS;
        lollipop(x + 34, GY + hop(3), won ? 1 : lost ? 0 : st, !won, T);
        crew(x, GY + hop(3), colOf(SIGN), happy, '#ff4d5e', { arms: won ? [-.45, 1, .45, 1] : [-.4, .6, -.2 + (1 - st) * .5, .5 + st * .5] });
        pill(x, GY - 66 + hop(3), isS ? 'YOU' : nmOf(SIGN), colOf(SIGN), !isS);
        tyres(738, GY + 4, 3, lost && rk > .45 ? Math.min(60, (rk - .45) * 400) : 0);
        cat(738, GY - 58, won ? 'cheer' : lost ? 'gasp' : 'calm', cx, T, false);
      } else {
        const up = won ? 1 : lost ? 0 : allSince >= 0 ? ease(clamp((T - allSince) / .25, 0, 1)) : 0;
        lollipop(XS + 12, GY, up, !won, T);
        cat(XS - 18, GY, won ? 'cheer' : lost ? 'gasp' : 'calm', cx, T, true);
        tyres(738, GY + 4, 3, lost && rk > .45 ? Math.min(60, (rk - .45) * 400) : 0);
      }
      drawBits(T);
      if (lost && rk >= 0) loseFx(cx, rk, T);
      if (won && rk >= 0) winFx(rk, T);
      // a name for the job and the controls plate
      plate(T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 120, 680), clamp(q.y - Math.min(a, .6) * 14, 176, 520), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      vignette(.14);
    },
    down(p) {
      ptr = [p.x, p.y];
      if (isJ) jackTap();
      else if (isW) { turn(1); ang = null; }
      else if (isF) fHeld = true;
      else if (isS) signUp();
    },
    up() { if (isF && fHeld) { fHeld = false; fuelRelease(); } else if (isS) signRelease(); ang = null; },
    move(p) {
      ptr = [p.x, p.y];
      if (!isW || g.result) return;
      const [hx, hy] = hubPos(wcur), dx = p.x - hx, dy = p.y - hy, d = Math.hypot(dx, dy);
      if (d < 30 || d > 260) { ang = null; return; }
      const a = Math.atan2(dy, dx); if (ang !== null) { let da = a - ang; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; rotAcc += Math.abs(da); while (rotAcc >= 1.1) { rotAcc -= 1.1; turn(1); } } ang = a;
    },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (e.repeat) return;
      if (isJ) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW') jackTap(); }
      else if (isW) { if (e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyZ' || e.code === 'KeyX') { const s = e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyZ' ? 'L' : 'R'; if (s !== side) { side = s; turn(1); } } else if (e.code === 'Space' || e.code === 'Enter') turn(1); }
      else if (isF) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') fHeld = true; }
      else if (isS) { if (e.code === 'Space' || e.code === 'Enter') signUp(); }
    },
    keyup(e) {
      if (isF && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') && fHeld) { fHeld = false; fuelRelease(); }
      else if (isS && (e.code === 'Space' || e.code === 'Enter')) signRelease();
    },
  };
  let rotAcc = 0;
  function pourFace(happy) { return happy || (stunUntil > g.c ? 'sad' : null); }
  function loseX(rk) {                                           // the car leaves half-serviced: a wild start, then the tyre wall (or a stall)
    if (!(lossBits & 7)) return CX;
    const k = Math.max(0, rk - .1); const x = CX + 1300 * k * k; return Math.min(x, HIT) - (rk > .6 ? Math.min(30, (rk - .6) * 160) : 0);
  }
  function loseFx(cx, rk, T) {
    const bitsL = lossBits;
    if (!(bitsL & 7)) { for (let i = 0; i < 3; i++) { const q = (rk * 1.6 + i / 3) % 1; puffC(cx - 130 - q * 40, CGY - 70 - q * 60, 10 + q * 16, .8 - q * .8, '#8f88a6'); } if (rk > .25) badge('STALLED!', 400, 150, 34, '#8f88a6', '#fff', outBack((rk - .25) / .2), -.06); return; }
    const hitK = cx >= HIT - 1 ? 1 : 0;
    if (bitsL & 3) {                                              // a wheel pops off and rolls away: the cat gives chase
      const k = Math.max(0, rk - .08), wx = CX + 70 + 520 * k - 40, wyb = CGY - HUBY - Math.abs(Math.sin(k * 16)) * 26 * (1 - k * .5);
      if (rk > .08) { X.save(); X.translate(wx, wyb); X.rotate(k * 22); wheel(0, 0, 0, 0, false, T); X.restore(); }
    }
    if (bitsL & 2) {                                              // the hose yanks the pump: it tips over and spits fuel
      for (let i = 0; i < 4; i++) { const q = (rk * 2 + i * .27) % 1; drop(RIGX[1] + 20 + q * 70 + i * 8, 330 - Math.sin(q * 3.14) * 70, 5 + (i % 2) * 2, '#ffb52e'); }
    }
    if (hitK && rk > .45) { sparks(cx + 130, CGY - 40, 0); star(cx + 134, CGY - 66, 26 + Math.sin(T * 30) * 5, 10, 8, T * 2, '#ffe14d', 3); badge('CRASH!', 420, 150, 36, '#ff4d5e', '#fff', outBack((rk - .45) / .2), -.07); }
    else if (rk > .3) badge('OOPS!', 420, 150, 36, '#ff9a4d', '#fff', outBack((rk - .3) / .2), -.07);
    for (let i = 0; i < 3; i++) { const a = T * 7 + i * TAU / 3; if (hitK && rk > .5) star(cx + 20 + Math.cos(a) * 40, CGY - 150 + Math.sin(a) * 10, 9, 4, 5, a, '#FFE14D', 3); }
  }
  function winFx(rk, T) {                                          // flame trail, a green light sweep and the checkered rain
    const cx = winX(rk);
    if (rk > .2 && cx < 1000) { for (let i = 0; i < 8; i++) { const q = i / 8; X.globalAlpha = (1 - q) * .8; X.fillStyle = i % 2 ? '#ffe14d' : '#ff7a2f'; el(cx - 140 - i * 36, CGY - 62 + Math.sin(T * 40 + i) * 4, 34 - i * 3, 12 - i, 0); X.fill(); X.strokeStyle = INK; X.lineWidth = 2.5; X.stroke(); } X.globalAlpha = 1; }
    if (rk > .25) badge(pick(['VROOOM!', 'FASTEST!', 'WOOHOO!']), 400, 150, 40, '#4fd06a', '#fff', outBack((rk - .25) / .2), -.07);
  }
  const winX = rk => CX + 1800 * Math.max(0, rk - .2) ** 2;
  const pick = a => a[Math.floor((resAt * 7 + a.length) % a.length)];
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0, fade = clamp(a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1, 0, 1);
      if (b.puff) puffC(b.x, b.y, b.r * (1 + a), fade * .8, b.c); else { X.globalAlpha = fade; X.fillStyle = b.c; X.strokeStyle = INK; X.lineWidth = 1.5; X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); X.fill(); X.stroke(); X.globalAlpha = 1; }
    }
  }
  /* the controls plate (bottom centre): the label, and the key cap under it on desktop */
  function plate(T) {
    const P = [['PUMP', 'SPACE', '#ff9a4d', '#c96a1e'], ['SPIN', 'A / D', '#4db8ff', '#1f78c0'], ['FILL', 'SPACE', '#4fd06a', '#24803a'], ['HOLD', 'SPACE', '#ff4d5e', '#b8283a']][me] || ['PUMP', 'SPACE', '#ff9a4d', '#c96a1e'];
    const w = 250, h = 46, x = 275, y = 500, fin = !!g.result, press = isJ ? T - tapAt < .12 : isW ? T - wTapAt < .12 : isF ? fHeld : sign === 1;
    const word = fin ? (g.result === 'win' ? 'YEAH!' : 'OOPS!') : P[0], dy = press ? 5 : 0;
    rr(x, y + 7, w, h, 20); ink(fin ? '#8f88a6' : P[3], 4); rr(x, y + 7 - 7 + dy, w, h, 20); ink(fin ? '#d3cfe0' : P[2], 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; rr(x + 14, y + 4 + dy, w - 28, 8, 4); X.fill();
    if (!fin && (isF && !pour && !fd && T > ARR && T < ARR + 4 || isS && !sign && T > ARR && T < ARR + 4)) { X.globalAlpha = .5 + .4 * Math.sin(T * 9); X.lineWidth = 4; X.strokeStyle = '#fff'; rr(x + 5, y + 5 + dy, w - 10, h - 10, 16); X.stroke(); X.globalAlpha = 1; }
    if (TOUCH) txt(word, x + w / 2, y + h / 2 + 2 + dy, 28, '#fff', 'center', w - 30); else { txt(word, x + w / 2 - 38, y + h / 2 + 1 + dy, 26, '#fff', 'center', 100); keyCap(x + w / 2 + 58, y + h / 2 + 2 + dy, P[1]); }
  }
  g.dbg = {
    /* what each screen shows (the bots only read their own view) */
    view: () => ({ jack: jl(), wd, fd, F: fl(), wp: wp.slice(), wcur, sign, zl: ZL, zw: ZW, stun: g.c < stunUntil, green: allGreen(), n, UP, DOWN, hub: hubPos(wcur), ARR }),
  };
  wire(g, D, judgeR, sp, 'sq_pit');
  return g;
}
reg('sq_pit', sqPit, 'PIT STOP'); REGMAP.sq_pit.duo = true; REGMAP.sq_pit.squad = true;

/* ───────────── intro card: what each role does (520x240 frame), a 4 s loop: the real pit lane, cropped around the role's station ───────────── */
function demoLamp(x, y, st) { X.beginPath(); X.arc(x, y, 12, 0, TAU); ink(st ? '#23a046' : '#b8283a', 3); X.beginPath(); X.arc(x - 1, y - 1, 9.5, 0, TAU); X.fillStyle = st ? '#5CFF7A' : '#ff4d5e'; X.fill(); }
function demoRole(role, t) {
  X = ctx; if (!BG) BG = buildBg();
  const u = t % 4, lift = u < .3 ? 0 : u < .9 ? ease((u - .3) / .6) : u < 2.4 ? 1 : u < 3.1 ? 1 - ease((u - 2.4) / .7) : 0;
  const wpP = u < .9 ? 0 : u < 2.4 ? (u - .9) / 1.5 : 1, fuelK = clamp((u - .2) / 1.6, 0, 1) * .8, fdone = u > 1.9, go = u > 3.3, w1 = wpP * 2, wp = [clamp(w1, 0, 1), clamp(w1 - 1, 0, 1)];
  const ox = [120, 120, 20, 250][role], oy = 262, cx = CX + (go ? 1800 * (u - 3.3) * (u - 3.3) : 0);
  const pumping = u > .15 && u < 2.4 && (u * 3) % 1 < .35, dip = pumping ? 1 : 0;
  const cols = ['#FFC93C', '#6EA8FE', '#7CE38B', '#FF8FC4'], hat = ['#ff9a4d', '#4db8ff', '#4fd06a', '#ff4d5e'], mood = go ? 'happy' : null;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip(); X.translate(-ox, -oy); X.drawImage(BG, 0, 0);
  if (role === 2) rigGauge(fuelK, .6, fdone, u > .2 && !fdone, t, 9);
  jackProp(CX + 8, lift, dip);
  car(cx, { lift, wp, cur: wp[0] >= 1 ? 1 : 0, col: 0, mood: go ? 'joy' : 'calm', num: 7, spin: wpP * 40, flame: go ? 1 : 0, flapOpen: !fdone }, t);
  if (role === 2) hoseDraw(cx, lift, u > .2 && !fdone, fdone, t);
  const wx = wp[0] >= 1 ? XW[1] : XW[0], [hx, hy] = [wx === XW[0] ? CX + HUBX : CX - HUBX, CGY - HUBY - lift * LIFT];
  crew(XJ, GY, cols[0], mood, hat[0], { arms: [-.35, .8 + dip * .2, .75 - dip * .1, .9] });
  crew(wx, GY, cols[1], mood, hat[1], { arms: [-.5, .5, 1.3, .95] });
  if (wp[1] < 1 && lift > .5) { X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = 'rgba(20,16,28,.6)'; X.beginPath(); X.arc(hx, hy, WR + 12, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.02, wp[wp[0] >= 1 ? 1 : 0])); X.stroke(); X.lineWidth = 4.5; X.strokeStyle = '#ffd23f'; X.stroke(); }
  crew(XF, GY, cols[2], fdone || go ? 'happy' : null, hat[2], { arms: [-.4, .6, .9, .8] });
  const up = u > .3 && u < 3.3; lollipop(XS + 34, GY, go ? 1 : up ? 1 : 0, !go, t);
  crew(XS, GY, cols[3], mood, hat[3], { arms: [-.4, .6, -.2, .9] });
  X.restore();
  const fx = (wx === XW[0] ? XW[0] : XW[1]) - ox, ang = u * 12;
  if (role === 0) { demoFinger(XJ - ox + 40, GY - oy - 56, pumping, 0); badge(lift > .5 ? 'KEEP IT UP!' : 'PUMP!', 420, 24, 18, '#ff9a4d', '#fff', 1, -.03); }
  else if (role === 1) { demoFinger(hx - ox + Math.cos(ang) * 30, hy - oy + Math.sin(ang) * 30, lift > .6 && u < 2.4, 0); badge(lift < .5 && u < 1 ? 'WAIT FOR THE JACK' : u < 2.4 ? 'SPIN!' : 'TIGHT!', 420, 24, 18, '#4db8ff', '#fff', 1, -.03); }
  else if (role === 2) { demoFinger(XF - ox + 40, GY - oy - 56, u > .2 && !fdone, (u * 2) % 1); badge(fdone ? 'FULL!' : 'HOLD...', 420, 24, 18, '#4fd06a', '#fff', 1, -.03); }
  else { demoLamp(40, 30, wp[1] >= 1); demoLamp(70, 30, fdone); demoLamp(100, 30, lift < .05 && u > 1); demoFinger(XS - ox + 40, GY - oy - 56, up, (u * 2) % 1); badge(go ? 'GO GO GO!' : 'WAIT FOR GREEN...', 330, 24, 18, go ? '#4fd06a' : '#ff4d5e', '#fff', 1, -.03); }
}
DUO.INFO.sq_pit = n => [
  ['JACK', 'PUMP THE CAR UP', 'TAP / CLICK / SPACE'],
  ['WHEELS', 'SPIN THE WHEEL GUN', 'CIRCLE MOUSE / MASH A D'],
  ['FUEL', 'FILL UP TO THE GREEN', 'HOLD, LET GO IN GREEN'],
  ['LOLLIPOP', 'LET GO WHEN ALL GREEN', 'HOLD, THEN LET GO'],
].slice(0, n >= 4 ? 4 : 3);
DUO.DEMOS.sq_pit = n => [0, 1, 2, 3].slice(0, n >= 4 ? 4 : 3).map(r => t => demoRole(r, t));

})();
