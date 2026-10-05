'use strict';
/* ═════════ SQUAD · VAULT RING (sq_vault), 3-4 players ═════════
   A bank vault door with one big combination dial per player, in a ring. NO TALKING in the bank (the sign says so).
   Everybody OWNS one dial (dial i = seat i) and turns it (drag in circles round it, or hold A / D, or ◄ ►), but nobody can see the number their
   own dial has to stop on: the goal of dial i is a glowing gold tick drawn only on the screen of seat i+1 (mod n). That seat is its WATCHER.
   The watcher talks through the world: PING (tap / click / Space) opens a ~1 s feedback pulse along the rim of the owner's dial: arrow chevrons that
   point the way to turn (more chevrons = further, hotter colour = closer) and a golden DING when the needle is inside the lock window. The ping
   carries what the watcher SAW [the needle angle it saw, goal - that angle]; the owner's dial turns that into the relation to its needle NOW, so
   network lag never makes the arrows stale.
   A dial LOCKS when its needle rests inside +-TOL of the goal (slow enough, for DWELL s); it un-locks if it slips out. The owner never sees its
   own lock: the lamps on the vault hub show the OTHER dials (the owner's own lamp is a "?"). The judge (seat 0) wins when all n dials are
   locked at once for HOLD s. Half way through the sleeping bank dog SNEEZES: every dial gets kicked ~20 degrees (its owner applies it to itself).
   Everybody is both an owner and a watcher, so nobody ever just waits.
   Netcode: each seat OWNS its needle and publishes 'a' [angle*10, k] (coalesced, latest). Pings are events 'p' [bucket, side, k, seenAngle*10, goalMinusSeen*10] (the target dial is
   implied: the sender watches seat-1). Locks are events 'lk' [0|1, k] (computed by the owner, which is the only one that sees the exact needle).
   The judge combines them, finishes 'win' (open door, prize) or 'lose' at the limit (alarm + guard dog) and tells the others via 'end' (wire). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = d => { d %= 360; if (d > 180) d -= 360; else if (d <= -180) d += 360; return d; };

/* ───────────── layout (800x600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const CX = 400, CY = 270, DOOR = 204, RING = 122, DR = 54;   // door centre / radius, ring radius for the dials, dial radius
const GY = 540;                                              // the floor under the crew's feet
const PLIFE = 1.1;                                          // how long one ping keeps the owner's rim feedback open (s)
const TICKS = 24, TOL = 12, LOCKV = 70, DWELL = .2, HOLD = .6, MAXV = 380;   // ticks on a dial, lock window (deg), max speed to lock, dwell, simultaneous hold, pointer speed cap
const PCOL = ['#FFC93C', '#6EA8FE', '#7CE38B', '#FF8FC4'];
const HEAT = ['#ffd23f', '#ff4d3a', '#ff9a4d', '#7fd0ff', '#3d7bff'];   // pulse colour by bucket: 0 = DING, 1 hot ... 4 cold
const slot = (i, n) => { const a = (-90 + i * 360 / n) * DEG; return [CX + Math.cos(a) * RING, CY + Math.sin(a) * RING]; };
const crewX = (i, n) => 400 + (i - (n - 1) / 2) * 134;
const hubDir = (i, n) => (-90 + i * 360 / n) * DEG;

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ci(x, y, r) { X.beginPath(); X.arc(x, y, Math.max(.1, r), 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function cel(pf, base, shade, sx, sy, o = 4) { pf(); ink(shade, o); X.save(); pf(); X.clip(); X.translate(-sx, -sy); pf(); X.fillStyle = base; X.fill(); X.restore(); }
function glint(x, y, rx, ry, rot, a) { X.fillStyle = `rgba(255,255,255,${a || .45})`; el(x, y, rx, ry, rot || -.4); X.fill(); }
function pill(x, y, label, col, raw) {
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
function arm(u, sx, an, k, col) {                       // a thin blocky arm from claude()'s side stub (drawn before claude()); an = angle (0 = up, + = right), k = 0..1 raised
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
function puffC(x, y, r, a, col) { X.globalAlpha = a; X.fillStyle = col || '#f1eef8'; X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(x, y, r, 0, TAU); X.fill(); X.stroke(); X.globalAlpha = 1; }
function zee(x, y, s, a) { X.globalAlpha = a; txt('Z', x, y, s, '#fff'); X.globalAlpha = 1; }
function btxt(s, x, y, size, fill, ang) {            // text on the baked canvas (txt() only paints on the live one)
  X.save(); X.translate(x, y); X.rotate(ang || 0); X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round';
  X.lineWidth = size / 5; X.strokeStyle = INK; const s2 = t(s); X.strokeText(s2, 0, 0); X.fillStyle = fill; X.fillText(s2, 0, 0); X.restore();
}
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave the dial spinning */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }
/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 23; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
const heatCol = b => HEAT[clamp(b, 0, 4)];

/* ───────────── the bank, baked once ───────────── */
let BG = null, DOORBG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  // marble wall with panels and a brass rail
  let g = X.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, '#d9ecdc'); g.addColorStop(1, '#a9cdb4'); X.fillStyle = g; X.fillRect(0, 0, W, 480);
  X.fillStyle = 'rgba(255,255,255,.28)'; for (let i = 0; i < 8; i++) X.fillRect(i * 112 + 6, 28, 70, 420);
  X.strokeStyle = 'rgba(30,70,50,.18)'; X.lineWidth = 3; for (let i = 0; i <= 8; i++) { X.beginPath(); X.moveTo(i * 112 + 6, 28); X.lineTo(i * 112 + 6, 448); X.stroke(); }
  X.fillStyle = INK; X.fillRect(0, 440, W, 14); X.fillStyle = '#e8c15a'; X.fillRect(0, 442, W, 8); X.fillStyle = 'rgba(255,255,255,.6)'; X.fillRect(0, 442, W, 2.5);   // brass skirting
  // the floor: black and white marble tiles in perspective
  g = X.createLinearGradient(0, 452, 0, H); g.addColorStop(0, '#9aa0b8'); g.addColorStop(1, '#6e7390'); X.fillStyle = g; X.fillRect(0, 452, W, H - 452);
  for (let r = 0; r < 5; r++) {
    const y0 = 452 + r * r * 5 + r * 14, y1 = 452 + (r + 1) * (r + 1) * 5 + (r + 1) * 14, k0 = 1 + r * .22, k1 = 1 + (r + 1) * .22, tw = 70;
    for (let c = -12; c < 14; c++) if ((c + r) & 1) { X.fillStyle = 'rgba(30,26,52,.30)'; X.beginPath(); X.moveTo(400 + c * tw * k0, y0); X.lineTo(400 + (c + 1) * tw * k0, y0); X.lineTo(400 + (c + 1) * tw * k1, y1); X.lineTo(400 + c * tw * k1, y1); X.fill(); }
  }
  X.fillStyle = 'rgba(255,255,255,.1)'; X.fillRect(0, 456, W, 6);
  // hinges: three heavy steel blocks on the left of the door
  for (const dy of [-120, 0, 120]) { rr(CX - DOOR - 24, CY + dy - 20, 36, 40, 7); ink('#7d86a0', 4); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(CX - DOOR - 18, CY + dy - 15, 7, 30); ci(CX - DOOR - 8, CY + dy, 5); ink('#c9ced6', 2); }
  // door frame: a thick steel ring in the wall
  ci(CX, CY, DOOR + 16); ink('#5e6682', 5); ci(CX, CY, DOOR + 5); X.lineWidth = 6; X.strokeStyle = '#2d3142'; X.stroke();
  // ===== the signs of the room =====
  // left: NO TALKING sign (the whole rule of the game)
  X.save(); X.translate(94, 296); X.rotate(-.04);
  rr(-72, -52, 144, 104, 12); ink('#fff7e0', 4.5); rr(-62, -42, 124, 84, 8); X.lineWidth = 3; X.strokeStyle = '#d94a3d'; X.stroke();
  // a face with a finger over the lips
  ci(-22, -4, 21); ink('#ffd9a8', 3); X.fillStyle = INK; ci(-29, -11, 2.8); X.fill(); ci(-14, -11, 2.8); X.fill();
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-31, -19); X.lineTo(-25, -22); X.moveTo(-12, -22); X.lineTo(-6, -19); X.stroke();
  rr(-26, -4, 8, 24, 4); ink('#ffd9a8', 2.5);                                    // the finger
  ci(-22, 10, 4); ink('#ffd9a8', 2);
  btxt('SHHH!', 32, -16, 19, '#d94a3d'); btxt('NO TALKING', 26, 20, 11.5, INK);
  X.restore();
  // right: BANK OF NOM plaque and the alarm box
  rr(668, 252, 118, 54, 10); ink('#e8c15a', 4.5); rr(676, 260, 102, 38, 6); X.lineWidth = 2.5; X.strokeStyle = '#8a6a1d'; X.stroke(); glint(700, 266, 22, 3, 0, .6);
  btxt('BANK OF', 727, 273, 12, '#fff'); btxt('NOM', 727, 289, 14, '#fff');
  rr(704, 330, 46, 72, 8); ink('#ff5c6a', 4); rr(712, 340, 30, 20, 4); ink('#fff', 2.5); X.fillStyle = INK; X.font = '900 12px Arial'; ci(727, 380, 9); ink('#b8283a', 2.5);   // alarm box with a big button
  btxt('!!', 727, 350, 11, '#d94a3d');
  // a potted plant, right
  rr(738, 478, 44, 40, 6); ink('#c9692a', 3.5); rr(734, 470, 52, 14, 5); ink('#e0803a', 3);
  for (const [dx, dy, rx, ry, ro] of [[-14, -26, 12, 34, -.5], [14, -28, 12, 36, .45], [0, -38, 12, 40, 0], [-3, -18, 10, 26, -.15]]) { el(760 + dx, 470 + dy, rx, ry, ro); ink('#4fc968', 3); }
  X = old; return cv;
}
/* the steel door itself, baked: heavy disc with rivets, bevels and a wheel hub (the dials and lamps are live) */
function buildDoor() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  cel(() => ci(CX, CY, DOOR), '#b4bdd0', '#7d86a0', 10, 12, 6);
  ci(CX, CY, DOOR - 18); X.lineWidth = 4; X.strokeStyle = 'rgba(20,16,28,.5)'; X.stroke(); ci(CX, CY, DOOR - 22); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.55)'; X.stroke();
  ci(CX, CY, DOOR - 62); X.lineWidth = 3; X.strokeStyle = 'rgba(20,16,28,.28)'; X.stroke();
  glint(CX - 90, CY - 120, 70, 14, -.7, .35); glint(CX + 110, CY + 110, 40, 7, -.7, .2);
  for (let i = 0; i < 20; i++) { const a = i * TAU / 20, x = CX + Math.cos(a) * (DOOR - 10), y = CY + Math.sin(a) * (DOOR - 10); ci(x, y, 5); ink('#d6dbe6', 2.2); X.fillStyle = 'rgba(255,255,255,.7)'; ci(x - 1.5, y - 1.5, 1.6); X.fill(); }
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + .39; line([[CX + Math.cos(a) * 36, CY + Math.sin(a) * 36], [CX + Math.cos(a) * (DOOR - 28), CY + Math.sin(a) * (DOOR - 28)]], 3, 'rgba(20,16,28,.14)'); }
  X = old; return cv;
}

/* ───────────── characters and props ───────────── */
/* the bank guard dog (sleeps on a cushion, bottom left). mode: sleep | sneeze | alert | angry. sc = scale, k = 0..1 how far into the mode */
function dog(x, y, mode, T, sc, k) {
  X.save(); X.translate(x, y); X.scale(sc, sc);
  const fur = '#d79a5e', fur2 = '#9a6234', bel = '#ffe3c0', sleep = mode === 'sleep', ang = mode === 'angry', snz = mode === 'sneeze';
  const breathe = sleep ? Math.sin(T * 2.2) * 1.4 : ang ? Math.sin(T * 40) * 1.2 : 0;
  if (sleep) { el(2, 2, 62, 11); ink('#e8434f', 3); el(2, -2, 54, 8); X.fillStyle = 'rgba(255,255,255,.35)'; X.fill(); }                      // the cushion
  else shadow(0, 2, 56, 9, .3);
  // tail
  const wag = ang ? Math.sin(T * 30) * .6 : sleep ? 0 : Math.sin(T * 6) * .35;
  X.save(); X.translate(-44, -30); X.rotate(-.9 + wag); rr(-3, -22, 8, 26, 4); ink(fur, 3); X.restore();
  // legs
  for (const lx of [-30, -12, 20, 38]) { rr(lx - 6, -18, 14, 18 + (ang && Math.sin(T * 30 + lx) > 0 ? -5 : 0), 5); ink(fur2, 3); }
  // body
  cel(() => el(0, -30 + breathe * .4, 50, 25 + breathe * .3), fur, fur2, 4, 6, 4);
  el(-4, -20, 30, 11); ink(bel, 0); X.fillStyle = bel; X.fill();
  // collar with a gold tag
  rr(24, -48, 12, 30, 5); ink('#4db8ff', 2.5); ci(32, -17, 5); ink('#ffd23f', 2);
  // head
  const hx = sleep ? 46 : 48, hy = sleep ? -28 : snz ? -48 - k * 6 : -50, hr = ang ? 1.08 : 1;
  X.save(); X.translate(hx, hy); if (snz) X.rotate(-.5 + k * .9); if (ang) X.rotate(Math.sin(T * 20) * .05);
  for (const sx of [-1, 1]) { X.save(); X.translate(sx * 16 - 2, -10); X.rotate(sx * .5 + (ang ? sx * .4 : 0)); el(0, 8, 8, 17); ink(fur2, 3); X.restore(); }      // floppy ears
  cel(() => el(0, 0, 28 * hr, 23 * hr), fur, fur2, 3, 4, 4);
  cel(() => el(18, 8, 18, 14), bel, '#e0b88c', 2, 3, 3);                                                                                          // muzzle
  ci(30, 4, 6.5); ink('#2b2838', 2.5); glint(28, 2, 2.4, 1.4, 0, .8);                                                                              // nose
  const mood = sleep ? 'z' : ang ? 'a' : snz ? 'n' : 'w';
  if (mood === 'z') { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; for (const ex of [-4, 10]) { X.beginPath(); X.arc(ex, -4, 5, .15, Math.PI - .15); X.stroke(); } }
  else if (mood === 'n') { X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; for (const ex of [-4, 10]) { X.beginPath(); X.moveTo(ex - 5, -8); X.lineTo(ex + 3, -4); X.lineTo(ex - 5, 0); X.stroke(); } }
  else {
    for (const ex of [-4, 11]) { ci(ex, -5, ang ? 7 : 6.5); ink('#fff', 2.2); X.fillStyle = ang ? '#d92b2b' : INK; ci(ex + 1.5, -5, ang ? 3.2 : 3.2); X.fill(); }
    if (ang) { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(-12, -16); X.lineTo(4, -10); X.moveTo(22, -16); X.lineTo(8, -10); X.stroke(); }
  }
  if (ang) {                                                                                                                                       // snarling mouth with teeth, drool
    X.beginPath(); X.moveTo(8, 14); X.quadraticCurveTo(24, 36 + Math.sin(T * 40) * 3, 40, 14); X.closePath(); ink('#7a1b2b', 3);
    X.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(11 + i * 7, 15); X.lineTo(14 + i * 7, 23); X.lineTo(17 + i * 7, 15); X.closePath(); X.fill(); }
    X.fillStyle = '#9fe3ff'; el(26, 32 + (T * 60) % 14, 2.6, 4.2); X.fill();
  } else if (mood === 'w' || mood === 'n') { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(14, 14); X.quadraticCurveTo(24, 20, 34, 13); X.stroke(); }
  // guard cap
  X.save(); X.translate(-4, -22); rr(-18, -8, 38, 14, 6); ink('#3d52c9', 3); rr(12, -1, 24, 7, 3); ink('#2d3b99', 2.5); star(0, -2, 6, 2.6, 5, 0, '#ffd23f', 1.5); X.restore();
  X.restore();
  X.restore();
}
/* a security camera on the wall, looking at the door; sweeps slowly. alarm = 0..1 flash */
function camera(x, y, T, alarm) {
  X.save(); X.translate(x, y);
  line([[40, -40], [20, -20]], 10, INK); line([[40, -40], [20, -20]], 5, '#a9afc4');
  X.rotate(.42 + Math.sin(T * .8) * .12);
  rr(-36, -16, 62, 32, 8); ink('#e3e6f2', 3.5); X.fillStyle = 'rgba(0,0,0,.14)'; rr(-34, 4, 58, 10, 6); X.fill();
  ci(-36, 0, 15); ink('#5e6682', 3); ci(-38, 0, 8); ink(alarm > 0 ? '#ff4d4d' : '#3a8ee6', 2.5); glint(-41, -3, 3, 2, 0, .8);
  ci(14, -8, 3.2); X.fillStyle = (Math.floor(T * 2) % 2) || alarm > 0 ? '#ff3030' : '#4a1010'; X.fill();
  X.restore();
}
function siren(x, y, T, rate, full) {                       // the alarm lamp: flashes faster as the time runs out
  rr(x - 22, y + 14, 44, 12, 4); ink('#8f88a6', 3);
  const on = full ? Math.sin(T * 14) > -.3 : Math.sin(T * Math.PI * 2 * rate) > .2;
  X.save(); X.beginPath(); X.arc(x, y + 14, 22, Math.PI, 0); X.closePath(); ink(on ? '#ff4d4d' : '#8a2b36', 3.5); glint(x - 8, y + 2, 6, 3, -.6, on ? .8 : .3); X.restore();
  if (on) { X.globalAlpha = .28; X.fillStyle = '#ff4d4d'; X.beginPath(); X.moveTo(x, y + 4); X.arc(x, y + 4, 120, Math.PI * 1.05, Math.PI * 1.95); X.fill(); X.globalAlpha = 1; }
}
function padlock(x, y, s, col) {
  X.save(); X.translate(x, y); X.scale(s, s);
  X.beginPath(); X.arc(0, -6, 7, Math.PI, 0); X.lineWidth = 6.5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#c9ced6'; X.stroke();
  rr(-10, -6, 20, 15, 4); ink(col || '#ffd23f', 3); ci(0, 1, 2.2); X.fillStyle = INK; X.fill(); X.restore();
}
function eye(x, y, s) {                                       // the "you watch this dial" eye
  X.save(); X.translate(x, y); X.scale(s, s);
  X.beginPath(); X.moveTo(-14, 0); X.quadraticCurveTo(0, -13, 14, 0); X.quadraticCurveTo(0, 13, -14, 0); X.closePath(); ink('#fff', 2.8);
  ci(0, 0, 6); ink('#ffd23f', 2); X.fillStyle = INK; ci(0, 0, 2.8); X.fill(); X.restore();
}
/* a burglar-crew Claude: the player colour, a striped beanie, a swag sack of dollars by the feet */
function crew(x, y, col, mood, o = {}) {
  const u = 3.7; X.save(); X.translate(x, y);
  shadow(0, 1, 28, 6, .25);
  if (o.arms) { const [la, lk, ra, rk] = o.arms; arm(u, -1, la, lk, col); arm(u, 1, ra, rk, col); }
  X.restore();
  X.save(); X.translate(x, y); claude(0, 0, u, { col, mood, run: o.run }); X.restore();
  X.save(); X.translate(x, y);
  X.beginPath(); X.moveTo(-5.4 * u, -9.4 * u); X.quadraticCurveTo(-5 * u, -14.2 * u, 0, -14.2 * u); X.quadraticCurveTo(5 * u, -14.2 * u, 5.4 * u, -9.4 * u); X.closePath(); ink(o.hat || '#2d3142', 3);
  X.save(); X.beginPath(); X.moveTo(-5.4 * u, -9.4 * u); X.quadraticCurveTo(-5 * u, -14.2 * u, 0, -14.2 * u); X.quadraticCurveTo(5 * u, -14.2 * u, 5.4 * u, -9.4 * u); X.closePath(); X.clip();
  X.fillStyle = '#fff'; for (let i = -2; i < 3; i++) X.fillRect(i * 2.8 * u - .7 * u, -15 * u, 1.3 * u, 6 * u); X.restore();
  rr(-5.8 * u, -10.4 * u, 11.6 * u, 1.8 * u, .9 * u); ink(o.hat || '#2d3142', 2.5); ci(0, -14.6 * u, 1.5 * u); ink('#fff', 2.5);
  X.restore();
}
function sack(x, y, s) { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(-10, 0); X.quadraticCurveTo(-18, -22, -4, -26); X.lineTo(4, -26); X.quadraticCurveTo(18, -22, 10, 0); X.closePath(); ink('#c9a26a', 3); X.fillStyle = '#e8d3a8'; X.fillRect(-4, -26, 8, 4); btxt('$', 0, -11, 14, '#5CFF7A'); X.restore(); }

/* the prize behind the open door */
function prize(kind, x, y, k, T) {
  const s = outBack(clamp(k, 0, 1)) * (kind === 2 ? 1.5 : 1.25); if (s <= .02) return;
  X.save(); X.translate(x, y); X.scale(s, s);
  if (kind === 0) {                                                  // a mountain of gold coins
    for (const [dx, dy, rx] of [[-62, 0, 38], [0, 4, 44], [62, 0, 38], [-30, -30, 36], [32, -32, 36], [0, -64, 34]]) { el(dx, dy, rx, 15); ink('#ffcf33', 3.5); el(dx, dy - 3, rx - 9, 8); X.fillStyle = '#ffe680'; X.fill(); }
    btxt('$', 0, -66, 24, '#fff'); for (let i = 0; i < 5; i++) { const a = T * 4 + i * 1.3; star(Math.cos(a) * 64, -40 + Math.sin(a * 1.3) * 34, 7, 2.5, 4, a, '#fff', 1.5); }
  } else if (kind === 1) {                                           // a giant cheese wheel with a mouse in a tie
    X.beginPath(); X.moveTo(-70, 0); X.lineTo(-70, -48); X.quadraticCurveTo(0, -78, 70, -48); X.lineTo(70, 0); X.quadraticCurveTo(0, 22, -70, 0); X.closePath(); ink('#ffd23f', 4);
    X.fillStyle = '#ffeb7a'; el(0, -50, 70, 20); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
    for (const [dx, dy, r] of [[-34, -52, 9], [14, -44, 7], [42, -56, 6], [-8, -20, 8], [-46, -16, 6], [34, -12, 7]]) { ci(dx, dy, r); ink('#e0a81e', 2); }
    X.save(); X.translate(54, -66 + Math.sin(T * 6) * 2); ci(0, 0, 14); ink('#c9ced6', 3); for (const sx of [-1, 1]) { ci(sx * 10, -11, 7); ink('#ffa8bf', 2.5); } X.fillStyle = INK; ci(-4, -2, 2.4); X.fill(); ci(5, -2, 2.4); X.fill(); ci(12, 3, 3); X.fillStyle = '#ff7ea8'; X.fill(); X.restore();
  } else {                                                           // a very confused goat eating a banknote
    X.save(); X.translate(0, -34);
    for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 12, -42); X.quadraticCurveTo(sx * 40, -66, sx * 38, -32); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#e8dcc0'; X.stroke(); }
    for (const sx of [-1, 1]) { X.save(); X.translate(sx * 34, -10); X.rotate(sx * (.9 + Math.sin(T * 5) * .05)); el(0, 0, 9, 21); ink('#f2ecdc', 3); X.restore(); }
    el(0, 0, 36, 42); ink('#fbf6e8', 4.5); el(0, 28, 20, 18); ink('#f2ecdc', 3);
    for (const sx of [-1, 1]) { el(sx * 14, -10, 9, 8); ink('#fff', 2.5); X.fillStyle = '#ffd23f'; el(sx * 14, -10, 6, 6); X.fill(); X.fillStyle = INK; X.fillRect(sx * 14 - 5.5, -11.5, 11, 3.4); }
    X.fillStyle = INK; ci(-6, 24, 2.2); X.fill(); ci(6, 24, 2.2); X.fill();
    const ch = Math.sin(T * 12) * 3; rr(-16 + ch, 30, 32, 17, 3); ink('#7ddc8c', 2.5); btxt('$', ch, 39, 12, '#fff');
    X.beginPath(); X.moveTo(0, 48); X.lineTo(5, 66); X.lineTo(-5, 66); X.closePath(); ink('#fbf6e8', 3);
    X.restore(); btxt('?', 54 + Math.sin(T * 3) * 3, -96, 30, '#fff', .2);
  }
  X.restore();
}

/* ───────────── one dial (live) ───────────── */
/* o: { col, ang (needle deg), goal (deg or null = this screen does not see it), lock (bool shown), pulse {b, s, a} (alpha 0..1), halo, hot (rim glow 0..1) } */
function dial(x, y, o, T) {
  X.save(); X.translate(x, y);
  if (o.halo > 0) { X.globalAlpha = o.halo * (.5 + .2 * Math.sin(T * 6)); ci(0, 0, DR + 20); X.fillStyle = o.col; X.fill(); X.globalAlpha = 1; }
  if (o.lock) { X.globalAlpha = .55 + .2 * Math.sin(T * 8); ci(0, 0, DR + 17); X.fillStyle = '#5CFF7A'; X.fill(); X.globalAlpha = 1; }
  el(5, 9, DR + 10, DR + 7); X.fillStyle = 'rgba(20,16,28,.28)'; X.fill();
  // rim: knurled steel with the owner's colour inlay
  cel(() => ci(0, 0, DR + 10), '#dde2ec', '#8d97ae', 5, 6, 4);
  X.strokeStyle = 'rgba(20,16,28,.5)'; X.lineWidth = 2; X.beginPath(); for (let k = 0; k < 36; k++) { const a = k * TAU / 36; X.moveTo(Math.cos(a) * (DR + 5), Math.sin(a) * (DR + 5)); X.lineTo(Math.cos(a) * (DR + 9), Math.sin(a) * (DR + 9)); } X.stroke();
  ci(0, 0, DR + 2); X.lineWidth = 5; X.strokeStyle = o.col; X.stroke();
  if (o.hot > .02) { X.globalAlpha = o.hot * .85; ci(0, 0, DR + 7); X.lineWidth = 7; X.strokeStyle = o.hotCol; X.stroke(); X.globalAlpha = 1; }
  // face
  cel(() => ci(0, 0, DR - 4), '#fff3d6', '#dcc597', 3, 5, 3);
  for (let k = 0; k < TICKS; k++) { const a = k * TAU / TICKS, big = k % 6 === 0, r0 = DR - 7, r1 = r0 - (big ? 13 : 7); line([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], big ? 3.4 : 2.2, INK); }
  // the goal (only the watcher's screen draws it): a glowing white window, a hot tick and a pin star, so it never gets lost against the owner's colour
  if (o.goal != null) {
    const g0 = o.goal * DEG, pu = .5 + .5 * Math.sin(T * 7), gx = Math.cos(g0), gy = Math.sin(g0);
    X.beginPath(); X.moveTo(gx * (DR - 30) , gy * (DR - 30)); X.arc(0, 0, DR - 4, g0 - TOL * DEG, g0 + TOL * DEG); X.arc(0, 0, DR - 30, g0 + TOL * DEG, g0 - TOL * DEG, true); X.closePath();
    X.fillStyle = `rgba(255,255,255,${.55 + .25 * pu})`; X.fill(); X.setLineDash([4, 3]); X.lineWidth = 2.2; X.strokeStyle = INK; X.stroke(); X.setLineDash([]);
    const gl = X.createRadialGradient(gx * (DR - 6), gy * (DR - 6), 2, gx * (DR - 6), gy * (DR - 6), 26); gl.addColorStop(0, `rgba(255,236,90,${.75 + .2 * pu})`); gl.addColorStop(1, 'rgba(255,236,90,0)'); X.fillStyle = gl; ci(gx * (DR - 6), gy * (DR - 6), 26); X.fill();
    line([[gx * (DR - 34), gy * (DR - 34)], [gx * (DR + 3), gy * (DR + 3)]], 10, INK); line([[gx * (DR - 34), gy * (DR - 34)], [gx * (DR + 3), gy * (DR + 3)]], 5.5, '#ff9a1a'); line([[gx * (DR - 31), gy * (DR - 31)], [gx * (DR + 1), gy * (DR + 1)]], 2, '#fff7b0');
    star(gx * (DR + 20 + pu * 2), gy * (DR + 20 + pu * 2), 11 + pu * 2, 5, 5, T * 1.5, '#fff27a', 2.4);
  }
  // the needle: a fat handle in the owner colour
  X.save(); X.rotate(o.ang * DEG);
  X.beginPath(); X.moveTo(-15, -7); X.lineTo(DR - 17, -4); X.lineTo(DR - 5, 0); X.lineTo(DR - 17, 4); X.lineTo(-15, 7); X.closePath(); ink(o.col, 3.5);
  X.fillStyle = 'rgba(255,255,255,.45)'; X.beginPath(); X.moveTo(-8, -5); X.lineTo(DR - 22, -3); X.lineTo(DR - 22, -1); X.lineTo(-8, -1); X.closePath(); X.fill();
  X.restore();
  ci(0, 0, 11); ink('#c9ced6', 3.5); glint(-3, -4, 4, 2, -.5, .85);
  // the owner's rim pulse: chevrons that point the way to turn
  const pl = o.pulse;
  if (pl && pl.alpha > .02 && pl.b > 0) {
    const n = pl.b === 1 ? 1 : pl.b === 2 ? 2 : 3, col = heatCol(pl.b); X.globalAlpha = pl.alpha;
    for (let k = 0; k < n; k++) {
      const a = (o.ang + pl.s * (18 + k * 17 + (1 - pl.alpha) * 8)) * DEG, r = DR + 24, px = Math.cos(a) * r, py = Math.sin(a) * r, tx = -Math.sin(a) * pl.s, ty = Math.cos(a) * pl.s, nx = Math.cos(a), ny = Math.sin(a);
      X.beginPath(); X.moveTo(px - tx * 6 + nx * 11, py - ty * 6 + ny * 11); X.lineTo(px + tx * 8, py + ty * 8); X.lineTo(px - tx * 6 - nx * 11, py - ty * 6 - ny * 11);
      X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8.5; X.strokeStyle = col; X.stroke();
    }
    X.globalAlpha = 1;
  }
  if (pl && pl.alpha > .02 && pl.b === 0) {                                            // DING: the whole rim flares gold and a bell shakes
    X.globalAlpha = pl.alpha; ci(0, 0, DR + 14); X.lineWidth = 6; X.strokeStyle = '#ffd23f'; X.stroke();
    X.save(); X.translate(DR * .72, -DR * .9); X.rotate(Math.sin(T * 40) * .35 * pl.alpha);
    X.beginPath(); X.moveTo(-11, 7); X.quadraticCurveTo(-11, -10, 0, -12); X.quadraticCurveTo(11, -10, 11, 7); X.closePath(); ink('#ffd23f', 3); ci(0, 10, 3.3); ink('#b8830a', 1.5); glint(-4, -4, 3, 5, .3, .7); X.restore();
    for (let i = 0; i < 4; i++) { const a = (i * 90 + T * 120) * DEG; star(Math.cos(a) * (DR + 22), Math.sin(a) * (DR + 22), 5, 2, 4, a, '#fff', 1); }
    X.globalAlpha = 1;
  }
  X.restore();
}

/* ───────────── the game ───────────── */
function sqVault(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles >= 4 ? 4 : 3, me = D.role % n, judge = me === 0;
  const W_ = (me + n - 1) % n;                                      // the dial I watch
  const LIM = 16 / Math.sqrt(sp) - DUO.END_SLACK;
  /* the level: the same on every screen whatever n / role (always 4 draws per dial array) */
  const TG = [], A0 = [], KICK = [];
  for (let i = 0; i < 4; i++) TG.push(Math.floor(R() * TICKS) * (360 / TICKS));
  for (let i = 0; i < 4; i++) A0.push(TG[i] + (100 + R() * 70) * (R() < .5 ? -1 : 1));
  for (let i = 0; i < 4; i++) KICK.push((R() < .5 ? -1 : 1) * (18 + R() * 10));
  const SNZ = LIM * (.4 + R() * .08), PR = R(), DUPE = R() < .125;
  const colOf = r => (D.byRole[r] || {}).color || PCOL[r], nmOf = r => (D.byRole[r] || {}).name || 'P' + (r + 1);
  const L = r => String.fromCharCode(65 + r);
  /* state */
  let a = A0[me], pend = 0, vsm = 0, pressed = false, pang = null, pDown = 0, travel = 0, lpx = 0, lpy = 0, kx = 0, kh = 0, lastTick = Math.floor(a / 15), tickAt = -9, rot = 0, rotTotal = 0;
  let fN = FOCUSN; let dwell = 0, lockedSelf = false, lkSent = 0, aSent = -9, aLast = 1e9, ak = 0, snzDone = false, snzAt = -9, resAt = -1, allSince = -1, pingAt = -9, pk = 0, tapAt = -9;
  const aT = [], aK = [], lkS = [], lkK = [], lkAt = [], pkLast = [];
  for (let r = 0; r < n; r++) { aT.push(track()); aK.push(-1); lkS.push(false); lkK.push(-1); lkAt.push(-9); pkLast.push(-1); }
  let pul = null;                                                  // the last ping aimed at MY dial: { b, s, t0, id }
  const pings = [], bits = [];                                     // visual pings travelling along the world (every screen draws all of them)
  const heat = Array(n).fill(null);                                // per dial: last ping seen { b, s, t0 }
  const ang = r => r === me ? a : (aT[r].at() === null ? A0[r] : aT[r].at());
  const bit = o => bits.push(Object.assign({ t0: g.c, life: .7, gr: 500, vx: 0, vy: 0, r: 4, c: '#fff' }, o));
  const lockedView = r => r === me ? false : lkS[r];               // I never see my own lock

  const bucket = d => { const ad = Math.abs(d); return [ad <= TOL - 2 ? 0 : ad < 36 ? 1 : ad < 80 ? 2 : ad < 140 ? 3 : 4, d >= 0 ? 1 : -1]; };
  function sendA() { ak++; D.send('a', [Math.round(a * 10), ak], true); aSent = g.c; aLast = a; }
  function sendLock(s) { lkSent++; D.send('lk', [s, lkSent]); }
  function ping() {
    if (g.result || g.c < .25 || g.c - pingAt < .17) return; pingAt = g.c;
    const as = Math.round(ang(W_) * 10) / 10, d = Math.round(wrap(TG[W_] - as) * 10) / 10, [b, s] = bucket(d);
    pk++; D.send('p', [b, s, pk, Math.round(as * 10), Math.round(d * 10)]); addPing(me, W_, b, s); snd(560 + (4 - b) * 60, .05, 'triangle', .04);
  }
  function addPing(from, dial, b, s, as, d) {
    pings.push({ from, dial, b, s, t0: g.c }); if (pings.length > 8) pings.shift();
    if (dial === me) { if (!g.result) { pul = { as, d, t0: g.c, id: ++pulId, b: -1, s: 0 }; livePulse(); } } else heat[dial] = { b, s, t0: g.c };
  }
  /* my pulse is LIVE: the ping's [seen angle, goal - seen angle] and my needle now give the true relation to the goal at this very moment */
  function livePulse() {
    if (!pul) return null; const [b, s] = bucket(wrap(pul.d - (a - pul.as)));
    if (b !== pul.b && !g.result) { if (b === 0) { snd(1318, .5, 'sine', .07); snd(1976, .4, 'sine', .035, .02); snd(2637, .3, 'sine', .02, .04); } else if (pul.b < 0 || (b === 1) !== (pul.b === 1) || s !== pul.s) snd(260 + (4 - b) * 150, .09, 'triangle', .05); }
    pul.b = b; pul.s = s; return pul;
  }
  let pulId = 0;
  function sneeze() {
    snzDone = true; snzAt = g.c; a += KICK[me]; shake(8, .35); sfx.thud(); noise(.25, .08, 1500, 400, 'bandpass'); snd(700, .2, 'sawtooth', .05, 0, 200);
    if (lockedSelf) { lockedSelf = false; dwell = 0; sendLock(0); }
  }
  function lose() { if (!g.result) g.finish('lose'); }

  const g = {
    c: 0, dur: 16, pts: 0,
    cmd: 'UNLOCK!', roleLabel: 'DIAL ' + L(me),
    hint: 'TURN YOUR DIAL (DRAG IN CIRCLES, OR HOLD A / D) - YOU CAN\'T SEE ITS NUMBER BUT YOUR NEIGHBOUR CAN: PING THE DIAL YOU WATCH (CLICK / SPACE)',
    thint: 'DRAG IN CIRCLES TO TURN YOUR DIAL - TAP TO PING THE DIAL YOU WATCH (THE GOLD TICK IS YOUR NEIGHBOUR\'S GOAL)',
    update(dt) {
      g.c += dt; const T = g.c, done = !!g.result;
      if (g.result && resAt < 0) {
        resAt = T;
        if (g.result === 'win') { snd(110, .5, 'sine', .14, 0, 50); noise(.3, .08, 600, 120, 'lowpass'); snd(180, .8, 'sawtooth', .04, .15, 90); [784, 988, 1319, 1568].forEach((f, i) => snd(f, .25, 'triangle', .05, .5 + i * .08)); }
        else { noise(.4, .09, 900, 200, 'lowpass'); for (let i = 0; i < 3; i++) snd(700, .34, 'sawtooth', .05, i * .36, 1050); for (const dl of [.18, .42, .66]) { snd(190, .12, 'sawtooth', .09, dl, 90); noise(.09, .06, 900, 300, 'lowpass', dl); } }
      }
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kx = 0; pressed = false; pang = null; }
      // ── my own dial ──
      if (!done) {
        const was = a;
        const ap = clamp(pend, -MAXV * dt, MAXV * dt); pend -= ap; a += ap;
        if (kx) { kh += dt; a += kx * (90 + 190 * Math.min(1, kh / .6)) * dt; } else kh = 0;
        const sp_ = Math.abs(a - was) / Math.max(1e-4, dt); vsm += (sp_ - vsm) * Math.min(1, dt * 14);
        rotTotal += Math.abs(a - was);
        const ti = Math.floor(a / 15); if (ti !== lastTick) { lastTick = ti; if (T - tickAt > .03) { tickAt = T; snd(1100 + (ti & 1) * 80, .015, 'square', .014); } }
        if (!snzDone && T >= SNZ) sneeze();
        const dist = Math.abs(wrap(TG[me] - a));
        if (!lockedSelf) { if (dist <= TOL && vsm < LOCKV) { dwell += dt; if (dwell >= DWELL) { lockedSelf = true; sendLock(1); } } else dwell = 0; }
        else if (dist > TOL + 3) { lockedSelf = false; dwell = 0; sendLock(0); }
        if ((Math.abs(a - aLast) > .05 && T - aSent >= .12) || (T - aSent >= .5 && Math.abs(a - aLast) > 0)) sendA();
      }
      if (T < dt * 2) sendA();
      // ── the verdict (judge) ──
      if (judge && !done) {
        let all = true; for (let r = 0; r < n; r++) if (!(r === me ? lockedSelf : lkS[r])) all = false;
        if (all) { if (allSince < 0) allSince = T; if (T - allSince >= HOLD) g.finish('win'); } else allSince = -1;
        if (!g.result && T >= g.limit) lose();
      }
      if (pul && T - pul.t0 > PLIFE) pul = null; else livePulse();
      for (let i = pings.length - 1; i >= 0; i--) if (T - pings[i].t0 > .9) pings.splice(i, 1);
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
    },
    msg(type, d, from) {
      if (from == null || from < 0 || from >= n || from === me) return;
      if (type === 'a' && Array.isArray(d)) { if (d[1] > aK[from]) { aK[from] = d[1]; aT[from].push(d[0] / 10); } }
      else if (type === 'lk' && Array.isArray(d)) {
        if (d[1] > lkK[from]) { lkK[from] = d[1]; const was = lkS[from]; lkS[from] = !!d[0]; lkAt[from] = g.c; if (lkS[from] !== was && !g.result) { if (lkS[from]) { snd(160, .09, 'square', .07, 0, 70); snd(900, .04, 'square', .04, .02); const [x, y] = slot(from, n); burst(x, y, '#5CFF7A', 8, 160); } else snd(300, .1, 'sawtooth', .04, 0, 120); } }
      }
      else if (type === 'p' && Array.isArray(d)) {
        if (d[2] > pkLast[from]) { pkLast[from] = d[2]; addPing(from, (from + n - 1) % n, d[0] | 0, d[1] < 0 ? -1 : 1, d[3] / 10, d[4] / 10); }
      }
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) { BG = buildBg(); DOORBG = buildDoor(); }
      const left = Math.max(0, g.limit - T), urgency = lost ? 1 : clamp(1 - left / 7, 0, 1);
      X.drawImage(BG, 0, 0);
      // background gags: the camera that watches the door, the siren that flashes faster and faster
      siren(722, 120, T, 1 + urgency * 3, lost);
      camera(712, 196, T, lost ? 1 : 0);
      // lasers: thin red beams across the corners
      const lz = .22 + .08 * Math.sin(T * 9) + (lost ? .4 : urgency * .2);
      X.strokeStyle = `rgba(255,50,60,${lz})`; X.lineWidth = lost ? 5 : 2.5; X.beginPath(); X.moveTo(0, 360); X.lineTo(168, 470); X.moveTo(0, 410); X.lineTo(100, 470); X.moveTo(800, 330); X.lineTo(640, 470); X.moveTo(800, 390); X.lineTo(700, 470); X.stroke();
      // ── what is behind the door ──
      const openK = won ? ease(clamp((rk - .3) / .7, 0, 1)) : 0;
      if (openK > 0) {
        ci(CX, CY, DOOR - 6); ink('#2a2440', 0); const gr = X.createRadialGradient(CX, CY + 40, 20, CX, CY + 40, DOOR); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(.45, '#8a5ad6'); gr.addColorStop(1, '#1e1838'); X.fillStyle = gr; X.fill();
        X.save(); ci(CX, CY, DOOR - 6); X.clip(); for (let i = 0; i < 12; i++) { const a0 = i * TAU / 12 + T * .6; X.fillStyle = 'rgba(255,240,150,.16)'; X.beginPath(); X.moveTo(CX, CY + 40); X.arc(CX, CY + 40, DOOR, a0, a0 + .22); X.fill(); } X.restore();
        prize(PR < .45 ? 0 : PR < .8 ? 1 : 2, CX, CY + 110, (rk - .55) / .5, T);
      }
      // ── the door: hinged on the left, swings open on a win ──
      const hx = CX - DOOR, sxd = 1 - openK * .9;
      X.save(); X.translate(hx, 0); X.scale(sxd, 1); X.translate(-hx, 0);
      if (lost && rk >= 0) X.translate(Math.sin(T * 60) * 2, 0);
      X.drawImage(DOORBG, 0, 0);
      // the hub wheel and the lamps (one per dial; my own is a question mark)
      const spinK = won ? rk * 9 : 0;
      X.save(); X.translate(CX, CY + 0); X.rotate(spinK); ci(0, 0, 34); ink('#8d97ae', 4.5);
      for (let i = 0; i < 6; i++) { const aa = i * TAU / 6; line([[0, 0], [Math.cos(aa) * 40, Math.sin(aa) * 40]], 9, INK); line([[0, 0], [Math.cos(aa) * 40, Math.sin(aa) * 40]], 4.5, '#e3e6f2'); ci(Math.cos(aa) * 40, Math.sin(aa) * 40, 5.5); ink('#ffcf33', 2.2); }
      ci(0, 0, 17); ink('#d6dbe6', 3); glint(-5, -6, 6, 3, -.5, .85); X.restore();
      for (let i = 0; i < n; i++) {
        const dd = hubDir(i, n), lx = CX + Math.cos(dd) * 47, ly = CY + Math.sin(dd) * 47, own = i === me, on = won || (!own && lkS[i]);
        ci(lx, ly, 8.5); ink(on ? '#23a046' : own ? '#6b6580' : '#b8283a', 3); X.fillStyle = on ? '#5CFF7A' : own ? '#8f88a6' : '#ff4d5e'; ci(lx - .8, ly - .8, 6.2); X.fill(); glint(lx - 2.5, ly - 3, 2.5, 1.5, -.5, .8);
        if (own && !won) txt('?', lx, ly + 1, 11, '#fff'); if (on && T - lkAt[i] < .4) { X.globalAlpha = .6; ci(lx, ly, 14 + (T - lkAt[i]) * 30); X.lineWidth = 3; X.strokeStyle = '#5CFF7A'; X.stroke(); X.globalAlpha = 1; }
      }
      // the dials
      for (let i = 0; i < n; i++) {
        const [dx, dy] = slot(i, n), own = i === me, watch = i === W_, h = own ? pul : heat[i], pa = h ? (own ? clamp((PLIFE - (T - h.t0)) / .5, 0, 1) : clamp(1 - (T - h.t0) / .8, 0, 1)) : 0;
        const pl = h ? { b: h.b, s: h.s, alpha: pa } : null;
        dial(dx, dy, { col: colOf(i), ang: ang(i), goal: watch ? TG[i] : null, lock: !own && lkS[i] || (won && rk > .05), pulse: pl, halo: own ? 1 : 0, hot: h ? pa * (h.b === 0 ? 1 : .7) : 0, hotCol: h ? heatCol(h.b) : '#fff' }, T);
        // letter tag on the outer side of every dial
        const ox = dx + Math.cos(hubDir(i, n)) * (DR + 18), oy = dy + Math.sin(hubDir(i, n)) * (DR + 18);
        ci(ox, oy, 12); ink(colOf(i), 3); txt(L(i), ox, oy + 1, 15, INK, 'center', 18);
        if (watch && !won && !lost) eye(ox - Math.sin(hubDir(i, n)) * 32, oy + Math.cos(hubDir(i, n)) * 32, 1 + .08 * Math.sin(T * 6));
        if (own && !won && !lost) { txt(TOUCH ? '↻' : 'A / D', dx, dy + 28, TOUCH ? 22 : 13, INK, 'center', 46); }
        if (watch && !won && !lost) { txt(TOUCH ? 'TAP' : 'SPACE', dx, dy + 29, 12, INK, 'center', 46); }
      }
      X.restore();
      // ── the crew ──
      const sneezing = snzAt >= 0 && T - snzAt < .6;
      for (let i = 0; i < n; i++) {
        const x = crewX(i, n), own = i === me, mood = won ? 'happy' : lost ? 'sad' : null, hop = won ? -Math.abs(Math.sin(T * 9 + i)) * 16 : lost ? -Math.abs(Math.sin(T * 14 + i * 2)) * 8 : 0;
        const pinging = pings.some(p => p.from === i && T - p.t0 < .25);
        const turning = (i === me ? Math.abs(vsm) > 30 : false) || (i !== me && Math.abs(ang(i) - (aT[i].at(.4) === null ? A0[i] : aT[i].at(.4))) > 2);
        const wob = turning ? Math.sin(T * 12) * .25 : 0;
        const bx = x + (lost ? Math.sin(T * 50 + i) * 2 : 0);
        sack(bx + 40, GY + hop * 0 + 1, .9);
        crew(bx, GY + hop, colOf(i), mood, { hat: colOf(i) === '#2d3142' ? '#555' : '#2d3142', arms: won ? [-.5, 1, .5, 1] : [-.45 + wob, .85, pinging ? 1.5 : .45 - wob, pinging ? 1 : .85] });
        const lk = !own && lkS[i] && !won;
        pill(bx, GY - 62 + hop, L(i) + ' ' + (own ? t('YOU') : nmOf(i)), colOf(i), true);
        if (lk) padlock(bx + 34, GY - 56 + hop, 1, '#5CFF7A');
      }
      // ── pings: a bright spark flies from the watcher to the dial ──
      for (const p of pings) {
        const a0 = T - p.t0, fx = crewX(p.from, n), fy = GY - 56, [tx, ty] = slot(p.dial, n), k = clamp(a0 / .24, 0, 1), col = heatCol(p.b);
        X.globalAlpha = (1 - clamp((a0 - .24) / .3, 0, 1)) * .75; X.setLineDash([6, 8]); X.lineDashOffset = -T * 80; line([[fx, fy], [lerp(fx, tx, k), lerp(fy, ty, k)]], 4, col); X.setLineDash([]); X.globalAlpha = 1;
        if (k < 1) { const sx = lerp(fx, tx, k), sy = lerp(fy, ty, k); star(sx, sy, 10, 4, 4, T * 9, col, 2); }
        else if (a0 < .5) { X.globalAlpha = 1 - (a0 - .24) / .26; ci(tx, ty, DR + 10 + (a0 - .24) * 70); X.lineWidth = 4; X.strokeStyle = col; X.stroke(); X.globalAlpha = 1; }
      }
      // ── the dog ──
      const dogMode = lost ? 'angry' : sneezing ? 'sneeze' : left < 4 && !won ? 'alert' : 'sleep';
      if (lost && rk >= 0) { const k = ease(clamp((rk - .12) / .55, 0, 1)); dog(lerp(66, 470, k), GY + 6, 'angry', T, lerp(.85, 1.9, k), 1); }
      else if (won) { dog(66, GY + 6, 'alert', T, .85, 0); }
      else dog(66, GY + 6, dogMode, T, .85, sneezing ? clamp((T - snzAt) / .25, 0, 1) : 0);
      if (dogMode === 'sleep' && !won) for (let i = 0; i < 3; i++) { const q = (T * .5 + i / 3) % 1; zee(96 + q * 18, GY - 60 - q * 40, 14 + q * 14, 1 - q); }
      if (sneezing) badge('ACHOO!', 120, GY - 108, 24, '#ffd23f', INK, outBack((T - snzAt) / .15) * (T - snzAt > .45 ? 1 - (T - snzAt - .45) / .15 : 1), -.08);
      // fx bits
      for (const b of bits) { const q = T - b.t0, fade = clamp(q > b.life * .6 ? 1 - (q - b.life * .6) / (b.life * .4) : 1, 0, 1); X.globalAlpha = fade; ci(b.x, b.y, b.r); ink(b.c, 1.5); X.globalAlpha = 1; }
      // payoffs
      if (won && rk >= 0) {
        if (rk > .25) badge(DUPE ? 'OPEN SESAME!' : 'CRACKED!', 470, 112, 36, '#4fd06a', '#fff', outBack((rk - .25) / .2), -.06);
        if (rk > .3 && rk < 1.2 && cr() < .5) bit({ x: 330 + cr() * 140, y: CY - 30, vx: (cr() - .5) * 400, vy: -200 - cr() * 250, r: 5 + cr() * 3, c: '#ffcf33', life: .9 });
      }
      if (lost && rk >= 0) {
        X.globalAlpha = .18 + .14 * Math.sin(T * 24); X.fillStyle = '#ff2030'; X.fillRect(-OX, 0, VW, H); X.globalAlpha = 1;
        if (rk > .08) badge('ALARM!', 470, 112, 40, '#ff4d5e', '#fff', outBack((rk - .08) / .18), -.07);
        if (rk > .5) badge('WOOF!', 410, GY - 120, 34, '#ff9a4d', '#fff', outBack((rk - .5) / .15), .08);
      }
      if (!won && !lost && urgency > .5 && Math.floor(T * 2 * (1 + urgency * 2)) % 2) { X.globalAlpha = .06 + urgency * .06; X.fillStyle = '#ff2030'; X.fillRect(-OX, 0, VW, H); X.globalAlpha = 1; }
      vignette(.16);
    },
    down(p) { pressed = true; pDown = g.c; travel = 0; lpx = p.x; lpy = p.y; pang = null; },
    move(p) {
      if (!pressed || g.result) return; travel += Math.hypot(p.x - lpx, p.y - lpy); lpx = p.x; lpy = p.y;
      const [sx, sy] = slot(me, n), dx = p.x - sx, dy = p.y - sy, d = Math.hypot(dx, dy);
      if (d < 20 || d > 360) { pang = null; return; }
      const an = Math.atan2(dy, dx); if (pang !== null) { let da = an - pang; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; pend = clamp(pend + da / DEG, -200, 200); } pang = an;
    },
    up() { if (pressed && g.c - pDown < .3 && travel < 18) { tapAt = g.c; ping(); } pressed = false; pang = null; },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') { if (kx !== -1) kh = 0; kx = -1; }
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') { if (kx !== 1) kh = 0; kx = 1; }
      else if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyW' || e.code === 'ArrowUp')) ping();
    },
    keyup(e) { if (e.code === 'KeyA' || e.code === 'ArrowLeft') { if (kx < 0) kx = 0; } else if (e.code === 'KeyD' || e.code === 'ArrowRight') { if (kx > 0) kx = 0; } },
  };
  g.dbg = {
    /* what MY screen shows: my needle and the ping on its rim; the watched dial's needle (as drawn, ~150 ms behind) with its gold goal; the lamps of the others */
    view: () => ({ me, n, a, cx: slot(me, n)[0], cy: slot(me, n)[1], pul: pul ? { b: pul.b, s: pul.s, id: pul.id, age: g.c - pul.t0 } : null, w: W_, wa: ang(W_), wt: TG[W_], tol: TOL, lamps: Array.from({ length: n }, (_, r) => r === me ? null : lkS[r]), c: g.c }),
  };
  wire(g, D, 0, sp, 'sq_vault');
  return g;
}
reg('sq_vault', sqVault, 'VAULT RING'); REGMAP.sq_vault.duo = true; REGMAP.sq_vault.squad = true;

/* ───────────── intro card: 520x240, a 6 s loop of the real dials (the owner turns, the neighbour pings) ───────────── */
function demoRole(r, t) {
  X = ctx; if (!BG) { BG = buildBg(); DOORBG = buildDoor(); }
  const u = t % 6, goal = 40, a = u < 1.8 ? 220 - 60 * u : u < 3.2 ? 112 - 40 * (u - 1.8) : u < 4.2 ? 56 - 12 * (u - 3.2) : 44, dist = Math.abs(wrap(goal - a)), locked = u > 4.6;
  const b = dist <= TOL - 2 ? 0 : dist < 36 ? 1 : dist < 80 ? 2 : dist < 140 ? 3 : 4, ping = (u * 4) % 1, pa = clamp(1 - ping * 1.6, 0, 1) * (u > .4 && u < 5 ? 1 : 0);
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip(); X.fillStyle = '#b9d9c2'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#7f89a6'; ci(260, 380, 300); X.fill();
  const c0 = PCOL[r % 4], c1 = PCOL[(r + 3) % 4], pl = { b, s: wrap(goal - a) >= 0 ? 1 : -1, alpha: pa };
  X.save(); X.translate(-60, 0);                                                         // my dial (left): no goal on my screen
  dial(190, 112, { col: c0, ang: a, goal: null, lock: false, pulse: pl, halo: 1, hot: pa * .7, hotCol: heatCol(b) }, t);
  txt(TOUCH ? '↻' : 'A / D', 190, 134, TOUCH ? 22 : 13, INK, 'center', 50);
  X.restore();
  dial(400, 112, { col: c1, ang: 200 + Math.sin(t) * 6, goal: 130, lock: false, pulse: null, halo: 0, hot: 0, hotCol: '#fff' }, t);       // the neighbour's dial: I see ITS goal
  eye(400, 190, 1); txt(TOUCH ? 'TAP' : 'SPACE', 400, 136, 12, INK, 'center', 50);
  badge('TURN IT', 130, 24, 17, '#ff9a4d', '#fff', 1, -.03);
  badge('PING THEM', 400, 24, 17, '#4db8ff', '#fff', 1, .03);
  if (u > .4 && u < 5) { const k = (u * 4) % 1; X.globalAlpha = 1 - k; line([[400, 190], [lerp(400, 130, k), lerp(190, 112, k)]], 4, heatCol(b)); X.globalAlpha = 1; }
  demoFinger(TOUCH || u < 4.2 ? 130 + Math.cos(u * 6) * 56 : 130, 112 + Math.sin(u * 6) * 56, u < 4.2 && !TOUCH, 0);
  if (locked) { padlock(205, 150, 1.5, '#5CFF7A'); badge('LOCKED!', 130, 212, 16, '#4fd06a', '#fff', 1, 0); } else txt('?', 130, 206, 30, '#fff');
  X.restore();
}
DUO.INFO.sq_vault = n => Array.from({ length: n >= 4 ? 4 : 3 }, (_, i) => ['DIAL ' + String.fromCharCode(65 + i), 'TURN YOURS, PING YOUR NEIGHBOUR\'S', 'DRAG CIRCLES / A D + SPACE']);
DUO.DEMOS.sq_vault = n => Array.from({ length: n >= 4 ? 4 : 3 }, (_, i) => t => demoRole(i, t));

})();
