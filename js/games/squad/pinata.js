'use strict';
/* ═════════ SQUAD · PIÑATA PARTY (sq_pinata), 3-4 players, one role each ═════════
   A Venezuelan birthday party in a bright yard. The piñata hangs from a clothesline on a pulley; the wind (and a naughty uncle) keeps shoving it
   around a 5 x 3 grid of "slots" (5 columns, 3 heights) and a rope holder lowers / raises it. Win = 4 hits (candy rain) before the clock.
   n = 4:  BATTER (0, JUDGE)   blindfolded: sees only a blurry wobbling screen and the cue arrows. Moves the bat between slots (pointer / arrows)
                               and swings (click / Space / SWING plate). Owns the bat slot and decides every hit.
           ROPE (1)            holds the rope: pointer = where the piñata is held (X = column, Y = height; the top of the field = hoisted out of
                               reach). The wind shoves it off that slot every ~3 s. Arms tire: ~5 s lowered and the piñata slips back up.
           SIDE CALLER (2)     sees the piñata's COLUMN and the bat's column only. Taps ◄ ► (and OK once they line up).
           HEIGHT CALLER (3)   sees the piñata's HEIGHT and whether it is in reach, and the bat's height only. Taps ▲ ▼ and NOW.
   n = 3:  one CALLER (role 2) sees everything and has all the buttons (◄ ► ▲ ▼ NOW). NOW = "column AND height match, it is down: swing".
   Same level whatever n / role (all draws from mkR() in the constructor, always the same number of them): the wind schedule.
   Netcode: every role OWNS its variables, the others render them:
     BATTER  'b' [col,row] (coalesced ~10/s, latest)  the bat slot.  'sw' {c,r,h}  a swing (h = total hits so far, 0 = a miss). The batter alone
             decides hit / miss, from the piñata samples it RECEIVED over the last .45 s (so lag never costs a hit). 'end' = verdict (via wire).
     ROPE    'p' [cx*100, hy*100, stamina*100, tired]  (coalesced ~10/s, latest)  the piñata. The rope owner alone simulates it (hold + wind).
     CALLERS 'cue' {k, f, n, s}  k = L R U D (move the bat n slots), O (columns match), N (swing now); f = the bat column (L R O) or row (U D N)
             the caller saw, s = the hit count it saw. The batter ignores a cue whose f no longer matches its bat slot, or whose s is old
             (that is a cue about a piñata that has already moved on), so a late duplicate never makes the bat overshoot or swing at nothing. ═════════ */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
let CS = 41; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;     // cosmetic randomness: never touches the seeded level

/* ───────────── layout (800x600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const COLX = c => 100 + 150 * c, ROWY = [250, 330, 410], LINEY = 84, HOISTY = 128, HOIST = -1.4, LOW = -.35;
const yOf = hy => hy >= 0 ? 250 + 80 * hy : 250 + 87 * hy;
const GROUND = 520, ROPEX = 770, KIDY = 524;
const NEED = 4, WIND = .16, SWT = .55, MISS_LOCK = 1.0, HIT_LOCK = .55, CUE_LIFE = .9, WIN = .45;
const DRAIN = .14, RECOV = .6, HOIST_HIT = .55;
const PCOL = ['#FFC93C', '#6EA8FE', '#7CE38B', '#FF8FC4'];
const TIS = ['#ffd23f', '#4db8ff', '#5fbf4f', '#ff4d5e', '#b49cff', '#ff9a4d', '#ff8fc4'];
const CANDY = ['#ff4d5e', '#ffd23f', '#4db8ff', '#5fbf4f', '#b49cff', '#ff9a4d'];

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tube(pts, w, col) { line(pts, w + 6, INK); line(pts, w, col); }
function poly(pts) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); }
function cel(pf, base, shade, sx, sy, o = 4) { pf(); ink(shade, o); X.save(); pf(); X.clip(); X.translate(-sx, -sy); pf(); X.fillStyle = base; X.fill(); X.restore(); }
function glint(x, y, rx, ry, rot, a) { X.fillStyle = `rgba(255,255,255,${a || .45})`; el(x, y, rx, ry, rot || -.4); X.fill(); }
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(280, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 280);
  X.restore();
}
function pill(x, y, label, col, raw) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = raw ? label : t(label), w = Math.min(150, X.measureText(s).width + 22);
  X.beginPath(); X.moveTo(x - 7, y + 10); X.lineTo(x, y + 19); X.lineTo(x + 7, y + 10); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 11, w, 22, 11); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 5, y - 8.5, w - 10, 6, 3); X.fill();
  if (raw) { X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = INK; X.fillText(s, x, y + 1, w - 12); }
  else txt(label, x, y + 1, 15, INK, 'center', w - 12);
}
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function heart(x, y, s, col) { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 6); X.bezierCurveTo(-14, -4, -8, -14, 0, -7); X.bezierCurveTo(8, -14, 14, -4, 0, 6); X.closePath(); ink(col || '#ff5c8a', 2.5); X.restore(); }
function arrow(x, y, dir, s, col) {                    // a chunky inked arrow; dir 0 = left, 1 = right, 2 = up, 3 = down
  X.save(); X.translate(x, y); X.rotate([Math.PI, 0, -Math.PI / 2, Math.PI / 2][dir]); X.scale(s, s);
  poly([[-12, -6], [2, -6], [2, -15], [17, 0], [2, 15], [2, 6], [-12, 6]]); ink(col, 3); X.restore();
}
function candy(x, y, r, c, rot) {
  X.save(); X.translate(x, y); X.rotate(rot);
  poly([[-r * 2.1, -r * .9], [-r * .6, 0], [-r * 2.1, r * .9]]); ink(c, 1.8); poly([[r * 2.1, -r * .9], [r * .6, 0], [r * 2.1, r * .9]]); ink(c, 1.8);
  X.beginPath(); X.arc(0, 0, r, 0, TAU); ink(c, 2.2); glint(-r * .3, -r * .35, r * .35, r * .22, -.5, .7); X.restore();
}

/* ───────────── the piñata: a 7-point star of tissue paper, origin = its centre ───────────── */
function starPath(R1, R2) { return () => { X.beginPath(); for (let i = 0; i < 14; i++) { const r = i % 2 ? R2 : R1, a = -Math.PI / 2 + i * Math.PI / 7; if (i) X.lineTo(Math.cos(a) * r, Math.sin(a) * r); else X.moveTo(Math.cos(a) * r, Math.sin(a) * r); } X.closePath(); }; }
/* o: dmg 0..4 | mood smug scared ouch laugh dizzy | rot | s | look -1..1 */
function pinata(x, y, T, o) {
  X.save(); X.translate(x, y); X.rotate(o.rot || 0); const s = o.s || 1; X.scale(s, s);
  for (let i = 0; i < 7; i++) {                                                          // tissue tassels on the tips
    const a = -Math.PI / 2 + i * TAU / 7, sw = Math.sin(T * 6 + i) * .12;
    for (let k = -1; k <= 1; k++) { const b = a + k * .13 + sw; tube([[Math.cos(a) * 44, Math.sin(a) * 44], [Math.cos(b) * 62, Math.sin(b) * 62]], 4, TIS[(i + k + 7) % 7]); }
  }
  cel(starPath(52, 31), '#ff5c9a', '#c93a73', 5, 6, 4.5);
  X.save(); starPath(52, 31)(); X.clip();
  X.fillStyle = '#ffd23f'; starPath(40, 24)(); X.fill(); X.fillStyle = '#4db8ff'; starPath(28, 17)(); X.fill();
  X.strokeStyle = 'rgba(20,16,28,.18)'; X.lineWidth = 2; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i * TAU / 7; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a) * 52, Math.sin(a) * 52); X.stroke(); }
  X.restore();
  glint(-14, -26, 12, 5, -.5, .5);
  const d = o.dmg || 0, m = o.mood || 'smug', lk = (o.look || 0) * 2.4;
  if (d >= 1) { X.save(); X.translate(16, -14); X.rotate(.5); rr(-10, -4, 20, 8, 2); ink('#fff3e0', 2); X.restore(); }
  if (d >= 2) { line([[-30, -4], [-20, 6], [-26, 14], [-14, 22]], 3, INK); line([[24, 8], [16, 14], [22, 22]], 3, INK); }
  if (d >= 3) { el(-6, 26, 12, 7); ink('#3a1b2e', 3); for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(-12 + i * 6, 25, 3, 0, TAU); ink(CANDY[i], 1.6); } }
  for (const sx of [-1, 1]) {
    const ex = sx * 11, ey = -4;
    if (m === 'ouch') { line([[ex - 5, ey - 5], [ex + 5, ey + 5]], 3, INK); line([[ex + 5, ey - 5], [ex - 5, ey + 5]], 3, INK); }
    else if (m === 'laugh') { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(ex, ey + 2, 5, Math.PI + .3, -.3); X.stroke(); }
    else { const big = m === 'scared' ? 8 : 6.5; el(ex, ey, big, big * 1.1); ink('#fff', 2); X.fillStyle = INK; el(ex + lk * (m === 'dizzy' ? Math.cos(T * 9) : 1), ey + (m === 'dizzy' ? Math.sin(T * 9) * 2 : 0), big * .45, big * .5); X.fill(); X.fillStyle = '#fff'; el(ex - 1.6, ey - 2, 1.6, 1.6); X.fill(); }
  }
  X.strokeStyle = INK; X.lineWidth = 2.8; X.lineCap = 'round'; X.fillStyle = INK;
  if (m === 'laugh') { el(0, 12, 9, 7); X.fillStyle = '#7a2230'; X.fill(); X.stroke(); X.fillStyle = '#ff7ea8'; el(0, 15, 5, 3); X.fill(); }
  else if (m === 'scared' || m === 'ouch') { el(0, 13, 4.5, 6); X.fillStyle = '#7a2230'; X.fill(); X.stroke(); }
  else if (m === 'dizzy') { X.beginPath(); X.moveTo(-7, 12); X.quadraticCurveTo(-3, 8, 0, 12); X.quadraticCurveTo(3, 16, 7, 12); X.stroke(); }
  else { X.beginPath(); X.moveTo(-8, 10); X.quadraticCurveTo(0, 18, 9, 8); X.stroke(); }                 // the smirk
  X.fillStyle = 'rgba(255,255,255,.35)'; el(-18, 8, 4, 2.4); X.fill();
  X.restore();
}

/* ───────────── kids (Caos with party props) ───────────── */
function hat(x, y, u, col) {                                       // a cone party hat on top of the body
  X.save(); X.translate(x, y - 9 * u); poly([[-3 * u, 0], [3 * u, 0], [.4 * u, -6 * u]]); ink(col, 2.6);
  X.fillStyle = '#fff'; X.beginPath(); X.arc(.4 * u, -6.2 * u, .9 * u, 0, TAU); X.fill(); X.restore();
}
function blind(x, y, u) { rr(x - 6.6 * u, y - 7.7 * u, 13.2 * u, 2.6 * u, u); ink('#ff4d5e', 2.5); line([[x - 6.4 * u, y - 6.4 * u], [x + 6.4 * u, y - 6.4 * u]], 1.5, 'rgba(255,255,255,.55)'); }
function bat(hx, hy, tx, ty, rot, ext) {                           // the bat from the hand towards a target, rotated about the hand
  const dx = tx - hx, dy = ty - hy, a = Math.atan2(dy, dx) + rot, d = Math.hypot(dx, dy) * ext + 26, ex = hx + Math.cos(a) * d, ey = hy + Math.sin(a) * d;
  tube([[hx, hy], [ex, ey]], 9, '#d9944f');
  for (const k of [.45, .62, .79]) { const bx = lerp(hx, ex, k), by = lerp(hy, ey, k), nx = -Math.sin(a) * 5, ny = Math.cos(a) * 5; line([[bx - nx, by - ny], [bx + nx, by + ny]], 3.4, TIS[Math.floor(k * 10) % 7]); }
  X.beginPath(); X.arc(ex, ey, 7, 0, TAU); ink('#d9944f', 3); glint(ex - 2, ey - 2, 2.5, 2, 0, .7);
  return [ex, ey];
}

/* ───────────── background, baked once ───────────── */
let BG = null;
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 430); g.addColorStop(0, '#4fb4f0'); g.addColorStop(.55, '#a9defa'); g.addColorStop(1, '#ffe9c4'); X.fillStyle = g; X.fillRect(0, 0, W, 440);
  X.fillStyle = '#c9d0fb'; X.strokeStyle = '#7b80c6'; X.lineWidth = 3;                                  // far hills
  [[60, 70, 190], [250, 40, 150], [520, 80, 210], [740, 60, 170]].forEach(([x, h, w]) => { X.beginPath(); X.ellipse(x, 120, w / 2, h, 0, Math.PI, TAU); X.fill(); X.stroke(); });
  // the house wall: a yellow facade with a pink skirt and a zinc roof edge
  cel(() => rr(-10, 112, 820, 326, 4), '#ffd98a', '#e8b95c', 0, -8, 5);
  X.save(); rr(-10, 112, 820, 326, 4); X.clip(); X.fillStyle = '#ff9bb8'; X.fillRect(-10, 372, 830, 70); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-10, 372, 830, 6);
  X.fillStyle = 'rgba(180,120,40,.13)'; for (let i = 0; i < 9; i++) X.fillRect(i * 100 + 20, 140, 5, 230); X.restore();
  rr(-10, 96, 820, 26, 5); ink('#b8c4d6', 4); X.strokeStyle = '#8f9cb3'; X.lineWidth = 2.5; for (let x = 6; x < W; x += 22) { X.beginPath(); X.moveTo(x, 100); X.lineTo(x, 118); X.stroke(); }
  for (const wx of [150, 650]) {                                                                          // barred windows (reja)
    rr(wx - 40, 150, 80, 92, 8); ink('#fff3e0', 4); rr(wx - 31, 159, 62, 74, 5); ink('#2a1424', 3);
    X.fillStyle = 'rgba(255,200,120,.3)'; rr(wx - 28, 162, 56, 68, 4); X.fill();
  }
  // the yard: patio tiles with a hard ink horizon
  g = X.createLinearGradient(0, 438, 0, H); g.addColorStop(0, '#f0dcae'); g.addColorStop(1, '#cdb083'); X.fillStyle = g; X.fillRect(0, 438, W, H - 438);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 438); X.lineTo(W, 438); X.stroke();
  X.strokeStyle = 'rgba(120,80,40,.22)'; X.lineWidth = 2;
  for (let r = 0; r < 4; r++) { const y = 438 + r * r * 9 + 26 * r; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let i = -6; i < 15; i++) { X.beginPath(); X.moveTo(400 + (i - 4) * 28, 438); X.lineTo(400 + (i - 4) * 120, H); X.stroke(); }
  // left post of the clothesline + the mango tree on the right
  rr(14, 70, 14, 372, 4); ink('#b9722f', 4); glint(19, 200, 2.5, 80, 0, .35);
  rr(762, 40, 26, 404, 6); ink('#8a5a34', 4); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(768, 60, 5, 360);
  for (const [lx, ly, r] of [[772, 40, 54], [738, 70, 40], [800, 80, 44], [764, 14, 40]]) { X.beginPath(); X.arc(lx, ly, r, 0, TAU); ink('#2f9a55', 4); }
  for (const [lx, ly, r] of [[772, 40, 54], [738, 70, 40], [800, 80, 44], [764, 14, 40]]) { X.beginPath(); X.arc(lx, ly, r - 5, 0, TAU); X.fillStyle = '#3fb260'; X.fill(); }
  glint(748, 22, 22, 8, -.5, .3);
  for (const [mx, my] of [[742, 82], [790, 62], [760, 104]]) { el(mx, my, 6, 8, .3); ink('#ffb13d', 2.4); }   // mangos
  // the cake table
  rr(190, 462, 150, 14, 5); ink('#c98443', 3.5); rr(198, 474, 10, 40, 3); ink('#a5622c', 3); rr(322, 474, 10, 40, 3); ink('#a5622c', 3);
  rr(220, 440, 90, 24, 8); ink('#fff3e0', 3.5); rr(232, 420, 66, 22, 7); ink('#ff8fc4', 3.5);
  for (const cx of [244, 264, 284]) { rr(cx - 2, 406, 5, 15, 2); ink('#4db8ff', 1.8); }
  X = old; return cv;
}

/* ───────────── live background gags ───────────── */
function clouds(T) {
  for (const [x0, y, s] of [[30, 40, 1], [360, 24, .8], [600, 46, 1.1]]) {
    const x = (x0 + T * 7 * s) % 1000 - 140; X.save(); X.translate(x, y); X.scale(s, s);
    for (const [dx, dy, r] of [[0, 0, 20], [22, -8, 26], [48, 0, 20], [24, 8, 22]]) { X.beginPath(); X.arc(dx, dy, r, 0, TAU); ink(null, 3); }
    for (const [dx, dy, r] of [[0, 0, 20], [22, -8, 26], [48, 0, 20], [24, 8, 22]]) { X.beginPath(); X.arc(dx, dy, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    glint(12, -14, 12, 5, -.3, .8); X.restore();
  }
}
function bunting(T, wild) {                                   // papel picado flags on a sagging string
  const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([lerp(26, 764, u), 70 + Math.sin(Math.PI * u) * 14]); }
  line(pts, 3, INK);
  for (let i = 1; i < 20; i++) {
    const [x, y] = pts[i], sw = Math.sin(T * (wild ? 7 : 2.4) + i * .8) * (wild ? .3 : .12);
    X.save(); X.translate(x, y); X.rotate(sw); poly([[-9, 0], [9, 0], [0, 22]]); ink(TIS[i % 7], 2.4); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(-4, 4, 3, 3); X.restore();
  }
}
function windows(S, T) {
  // the grandma with her fan and curlers in the left window, a cat on the sill on the right
  const gx = 150, gy = 214, bob = Math.sin(T * 2) * 1.5;
  X.save(); rr(gx - 31, 159, 62, 74, 5); X.clip();
  cel(() => el(gx, gy + 12 + bob, 22, 18), '#b49cff', '#8a73e0', 3, 4, 3.5);
  cel(() => el(gx, gy - 6 + bob, 14, 13), '#ffd9a8', '#e8b27d', 3, 3, 3.5);
  cel(() => el(gx, gy - 17 + bob, 15, 8), '#f1eef8', '#c4bddb', 2, 3, 3);
  for (const sx of [-1, 1]) { el(gx + sx * 10, gy - 20 + bob, 4, 7, sx * .3); ink('#ff8fc4', 2); }
  const lost = S.res === 'lose', won = S.res === 'win';
  X.strokeStyle = INK; X.lineWidth = 2.6; X.lineCap = 'round';
  if (won) { for (const sx of [-1, 1]) { X.beginPath(); X.arc(gx + sx * 5.5, gy - 7 + bob, 3, Math.PI + .4, -.4); X.stroke(); } }
  else { for (const sx of [-1, 1]) { el(gx + sx * 5.5, gy - 7 + bob, 2.6, 3); ink('#fff', 1.6); X.fillStyle = INK; X.beginPath(); X.arc(gx + sx * 5.5 + 1, gy - 7 + bob, 1.3, 0, TAU); X.fill(); } }
  X.beginPath(); X.arc(gx, gy + 1 + bob, 3.4, lost ? Math.PI + .3 : .3, lost ? -.3 : Math.PI - .3); X.stroke();
  const fa = Math.sin(T * (won ? 14 : 5)) * .5; X.save(); X.translate(gx + 22, gy + 8 + bob); X.rotate(fa);
  poly([[0, 0], [-9, -20], [9, -20]]); ink('#ff4d5e', 2.4); X.restore();
  X.restore();
  const cx = 650, cy = 226 + Math.sin(T * 1.3) * 1.5;
  X.save(); rr(cx - 31, 159, 62, 74, 5); X.clip();
  cel(() => el(cx, cy + 14, 20, 17), '#ffb13d', '#d9871a', 3, 4, 3.5);
  cel(() => el(cx, cy - 6, 15, 12), '#ffb13d', '#d9871a', 3, 3, 3.5);
  for (const sx of [-1, 1]) { poly([[cx + sx * 12, cy - 12], [cx + sx * 15, cy - 25], [cx + sx * 4, cy - 15]]); ink('#ffb13d', 2.6); }
  const lk = clamp(S.catLook || 0, -1, 1);
  for (const sx of [-1, 1]) { el(cx + sx * 6, cy - 6, 4, 4.4); ink('#fff', 1.6); X.fillStyle = INK; X.beginPath(); X.arc(cx + sx * 6 + lk * 1.8, cy - 5.5, 1.9, 0, TAU); X.fill(); }
  X.restore();
}
function parrot(S, T) {                                       // a lorito on the clothesline post
  const x = 22, y = 64, tilt = Math.sin(T * 3) * .1;
  X.save(); X.translate(x, y); X.rotate(tilt);
  el(0, 6, 8, 12, .1); ink('#5fbf4f', 3); el(3, 8, 4, 8, .2); ink('#4db8ff', 2);
  X.beginPath(); X.arc(2, -8, 8, 0, TAU); ink('#ff4d5e', 3);
  poly([[8, -9], [16, -6], [8, -3]]); ink('#ffd23f', 2.2);
  X.fillStyle = '#fff'; X.beginPath(); X.arc(4, -10, 3, 0, TAU); X.fill(); X.fillStyle = INK; X.beginPath(); X.arc(5, -10, 1.4, 0, TAU); X.fill();
  X.restore();
  const k = (T % 6.5) / 6.5, say = S.res === 'win' ? 'WOOHOO!' : S.res === 'lose' ? 'WHOOPS!' : 'DALE!';
  if (S.res || k > .78) { const sc = S.res ? outBack(S.rk * 4) : outBack((k - .78) / .06) * (1 - clamp((k - .94) / .06, 0, 1)); if (sc > .02) badge(say, 82, 52, 15, '#fff', INK, sc, -.04); }
}
function dog(S, T) {                                          // a dog under the cake table, eyeing the candy
  const x = S.dogX, ph = S.res === 'win' ? Math.sin(T * 14) * .5 : Math.sin(T * 6) * .22;
  X.save(); X.translate(x, 506 - Math.abs(Math.sin(T * 10)) * (S.res === 'win' ? 8 : 0));
  shadow(0, 8, 30, 6, .25);
  X.save(); X.translate(-18, -12); X.rotate(-.6 + ph); rr(-3, -14, 6, 16, 3); ink('#c98443', 2.6); X.restore();
  cel(() => rr(-18, -26, 36, 22, 10), '#e0a35c', '#b87a2c', 3, 4, 3.5);
  for (const sx of [-10, 8]) { rr(sx, -8, 7, 12, 3); ink('#e0a35c', 2.5); }
  cel(() => el(16, -34, 12, 11), '#e0a35c', '#b87a2c', 2, 3, 3.5);
  X.save(); X.translate(8, -38); X.rotate(.3); el(0, 3, 5, 9); ink('#8a5a34', 2); X.restore();
  el(25, -30, 6, 4.4); ink('#e8d5c0', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(28, -31, 2.2, 0, TAU); X.fill();
  X.beginPath(); X.arc(18, -37, 3, 0, TAU); ink('#fff', 1.8); X.fillStyle = INK; X.beginPath(); X.arc(S.res === 'lose' ? 17 : 19.5, -37, 1.5, 0, TAU); X.fill();
  X.restore();
}

/* ───────────── the scene ───────────── */
/* S = { n, me, mode: 'bat'|'rope'|'a'|'b'|'full', T, pcx, phy (displayed), bc, br (displayed floats), bcT, brT (true slots), hits, sw (swing anim or null),
         cues[] (valid, for the batter), names[], cols[], res, rk, sta, tired, dogX, flash, shower[], piles[] } */
function drawScene(S) {
  X = ctx; const T = S.T, n = S.n, mode = S.mode;
  if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
  S.catLook = (S.bc - 2) / 2;
  clouds(T); bunting(T, S.res === 'win'); windows(S, T); parrot(S, T);
  // clothesline
  line([[26, LINEY], [ROPEX, LINEY]], 5, INK); line([[26, LINEY], [ROPEX, LINEY]], 2, '#e6c58c');
  X.beginPath(); X.arc(ROPEX - 4, LINEY, 8, 0, TAU); ink('#c9ced6', 3);
  // where the piñata is drawn for THIS role
  let px = COLX(S.pcx), py = yOf(S.phy);
  if (mode === 'a') py = ROWY[1];                              // the side caller cannot tell how high it is
  if (mode === 'b') px = COLX(2);                              // the height caller cannot tell which column
  const lowered = S.phy >= LOW, hide = mode === 'bat';
  dog(S, T);
  // the piñata, its pulley, string and rope
  const lean = S.lean || 0, swayRot = Math.sin(T * 2.3) * .06 + lean;
  if (!hide) {
    const trolX = mode === 'b' ? COLX(2) : px;
    rr(trolX - 10, LINEY - 9, 20, 16, 4); ink('#ffd23f', 2.8);
    if (mode !== 'a') { const rp = [[trolX + 6, LINEY - 1], [ROPEX - 4, LINEY - 1]]; line(rp, 7, INK); line(rp, 3, '#e6c58c'); const rd = [[ROPEX - 4, LINEY], [ROPEX + 4, LINEY + 60], [S.holderX + 4, GROUND - 30]]; line(rd, 7, INK); line(rd, 3, '#e6c58c'); }
    line([[trolX, LINEY + 6], [px, py - 44]], 4, INK); line([[trolX, LINEY + 6], [px, py - 44]], 1.8, '#e6c58c');
    if (S.res !== 'win' || S.rk < .06) {
      const mood = S.res === 'lose' ? 'laugh' : S.flash > 0 ? 'ouch' : !lowered ? 'smug' : S.tired ? 'dizzy' : 'scared';
      pinata(px, py, T, { dmg: Math.min(3, S.hits), mood, rot: swayRot, look: mode === 'rope' || mode === 'a' ? 0 : (S.bc - S.pcx) / 3 });
    }
  } else {
    // the blindfold: a milky cloth over the whole yard, with wobbling ghosts
    X.save(); X.translate(Math.sin(T * 1.9) * 5, Math.cos(T * 2.3) * 4);
    for (let i = 0; i < 3; i++) { const gx = 400 + Math.sin(T * (1.1 + i * .37) + i * 2.1) * 270, gy = 270 + Math.cos(T * (.9 + i * .31) + i) * 110; X.globalAlpha = .34; pinata(gx, gy, T + i, { mood: 'smug', rot: Math.sin(T + i) * .3, s: 1.05 }); X.globalAlpha = 1; }
    X.restore();
  }
  // the blind cloth: over the yard and the piñata ghosts, under the batter's own bat
  if (hide) {
    X.save(); X.fillStyle = 'rgba(255,248,230,.56)'; X.fillRect(0, 96, W, 340);
    X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 7; for (let i = 0; i < 7; i++) { const y = 130 + i * 48 + Math.sin(T * 1.6 + i) * 8; X.beginPath(); X.moveTo(0, y); X.bezierCurveTo(260, y - 30, 540, y + 30, W, y); X.stroke(); }
    X.restore();
    for (let i = 0; i < 5; i++) { const q = (T * .4 + i / 5) % 1; X.globalAlpha = .5 * Math.sin(q * Math.PI); txt('?', 130 + i * 140 + Math.sin(T + i) * 18, 160 + (i % 3) * 90 + q * 20, 38, '#ff9a4d'); X.globalAlpha = 1; }
  }
  // kids
  const batX = mode === 'rope' || mode === 'b' ? COLX(2) : COLX(S.bc);
  const won = S.res === 'win', lost = S.res === 'lose', hop = i => won ? Math.abs(Math.sin(T * 9 + i)) * 14 : 0;
  const mood = lost ? 'sad' : won ? 'happy' : null;
  const names = S.names, cols = S.cols;
  // the callers (left)
  const callers = n === 4 ? [2, 3] : [2];
  callers.forEach((r, k) => {
    const x = 52 + k * 84, y = KIDY - hop(r);
    caos(x, y, 4.4, { col: cols[r], mood }); hat(x, y, 4.4, TIS[(r + 2) % 7]);
    const c = S.lastCue[r];
    if (c && S.t0 - c.t < 1.1 && !S.res) {
      const a = S.t0 - c.t, sc = outBack(a / .12) * (1 - clamp((a - .85) / .25, 0, 1));
      X.save(); X.translate(x + 6, y - 74); X.scale(sc, sc);
      X.beginPath(); X.moveTo(-6, 12); X.lineTo(0, 22); X.lineTo(8, 12); X.closePath(); ink('#fff', 3); rr(-26, -16, 52, 32, 14); ink('#fff', 3); X.fillStyle = '#fff'; X.fillRect(-8, 8, 18, 6);
      if (c.k === 'N') txt('NOW!', 0, 0, 14, '#e8434f', 'center', 46); else if (c.k === 'O') txt('OK!', 0, 0, 16, '#2f9a55', 'center', 46); else arrow(0, 0, 'LRUD'.indexOf(c.k), .85, cols[r]);
      X.restore();
    }
    pill(x, y - 56, r === S.me ? 'YOU' : names[r], cols[r], r !== S.me);
  });
  // the rope holder (right)
  { const hx = S.holderX, y = KIDY - hop(1); caos(hx, y, 4.8, { col: cols[1], mood }); hat(hx, y, 4.8, TIS[3]);
    for (const sx of [-1, 1]) { X.beginPath(); X.arc(hx + sx * 5, y - 36 - (lowered ? 0 : 8), 5, 0, TAU); ink('#ffd23f', 2.4); }
    if (S.tired && !S.res) { for (let i = 0; i < 2; i++) { const q = (T * 1.7 + i * .5) % 1; X.globalAlpha = 1 - q; X.fillStyle = '#9fe3ff'; X.beginPath(); X.arc(hx + 18 + i * 6, y - 52 + q * 22, 3, 0, TAU); X.fill(); X.globalAlpha = 1; } }
    pill(hx, y - 62, 1 === S.me ? 'YOU' : names[1], cols[1], 1 !== S.me); }
  // the batter
  { const x = batX, y = KIDY - hop(0), u = 5, hx = x + 30, hy = y - 30, sl = S.sw, tx = COLX(mode === 'rope' || mode === 'b' ? 2 : S.bc), ty = mode === 'rope' || mode === 'a' ? ROWY[1] : ROWY[clamp(Math.round(S.br), 0, 2)] + (S.br - Math.round(S.br)) * 80;
    X.save(); X.translate(x, y); X.rotate(lost ? Math.sin(T * 5) * .05 : 0); X.translate(-x, -y);
    let rot = 0, ext = .72; if (sl) { const k = (S.t0 - sl.t0) / SWT; if (k >= 0 && k < 1) { rot = k < .29 ? -.9 * ease(k / .29) : k < .42 ? lerp(-.9, .35, ease((k - .29) / .13)) : lerp(.35, 0, ease((k - .42) / .58)); ext = k < .29 ? .72 : k < .5 ? 1.0 : lerp(1, .72, ease((k - .5) / .5)); } }
    if (won) { rot = Math.sin(T * 6) * .3; ext = .5; }
    caos(x, y, u, { col: cols[0], mood });
    if (!won) blind(x, y, u); else hat(x, y, u, TIS[0]);
    const tip = bat(hx, hy, tx, ty, rot, ext);
    X.restore();
    // the target ring: where the bat is aimed
    if (!S.res && (mode === 'bat' || mode === 'a' || mode === 'b' || mode === 'full')) {
      X.save(); X.setLineDash([7, 7]); X.lineWidth = 3.4; X.strokeStyle = 'rgba(255,255,255,.9)'; X.beginPath(); X.arc(tx, ty, 50, T * .8, T * .8 + TAU); X.stroke(); X.setLineDash([]); X.restore();
    }
    if (mode !== 'rope') pill(x, y - 64, 0 === S.me ? 'YOU' : names[0], cols[0], 0 !== S.me);
    if (sl && S.t0 - sl.t0 > WIND - .02 && S.t0 - sl.t0 < WIND + .35) {            // the impact: POW or a whiff
      const a = (S.t0 - sl.t0 - WIND) / .35, ok = sl.h > 0;
      if (ok) { star(tip[0], tip[1], 34 * (1 - a * .4), 16, 9, T * 6, '#ffe14d', 3); }
      else { X.globalAlpha = 1 - a; line([[tip[0] - 20, tip[1] - 14], [tip[0] + 10, tip[1] + 18]], 4, '#fff'); X.globalAlpha = 1; }
    }
  }
  // candy that fell
  for (const p of S.piles) candy(p.x, p.y, 4, p.c, p.r);
  for (const p of S.shower) candy(p.x, p.y, 4.4, p.c, p.r);
  // winning shards
  if (won && S.rk < 1.2) { for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i * TAU / 7, d = S.rk * 220, x = px + Math.cos(a) * d, y = py + Math.sin(a) * d + S.rk * S.rk * 160; X.save(); X.translate(x, y); X.rotate(a + S.rk * 7); X.globalAlpha = clamp(1 - S.rk / 1.2, 0, 1); poly([[-14, -10], [14, -4], [-4, 14]]); ink(TIS[i], 3); X.globalAlpha = 1; X.restore(); } }
}

/* ───────────── the game ───────────── */
function sqPinata(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles >= 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp);
  const isBat = me === 0, isRope = me === 1, isCall = me >= 2, isA = n === 4 && me === 2, isB = n === 4 && me === 3, isC3 = n === 3 && me === 2;
  const seesCol = isBat || isRope || isA || isC3, seesRow = isBat || isRope || isB || isC3;
  /* the level: the same on every screen. Always the same number of draws. */
  const GU = []; { let tt = 0, pdc = 0; for (let k = 0; k < 10; k++) { const a = R(), b = R(), c = R(); let dc = [-2, -1, 1, 2][Math.floor(a * 4)]; if (dc === pdc) dc = -dc; pdc = dc; GU.push({ t: tt, dc, dr: Math.floor(b * 3) - 1 }); tt += 2.9 + c * 1.1; } }
  const colOf = r => (D.byRole && D.byRole[r] || {}).color || PCOL[r], nmOf = r => ((D.byRole && D.byRole[r] || {}).name || 'P' + (r + 1)).slice(0, 7);
  /* state */
  const cxT = track(), hyT = track(), staT = track(), pHist = [];
  let bc = 2, br = 1, bcR = 2, brR = 1, bcS = 2, brS = 1, lastB = '', sentB = -9, pressed = false;
  let ropeC = 2, ropeR = -1, cx = 2, hy = HOIST, sta = 1, tired = false, hoistUntil = -1, sentP = -9, lastP = '', S = 0, tiredR = 0;
  let hits = 0, swing = null, lockUntil = 0, resAt = -1, flash = 0, sw = null, dogX = 300;
  let cues = [];                                          // batter: cues received {k, f, n, s, t}
  const lastCue = {}, pops = [], shower = [], piles = [];
  let colSince = 0, rowSince = 0, lastColSlot = -1, lastRowSlot = -9, lastLow = false;
  const gust = () => { let q = GU[0]; for (const g2 of GU) if (g2.t <= S) q = g2; return q; };
  const pcxV = () => isRope ? cx : cxT.at() === null ? 2 : cxT.at() / 100;
  const phyV = () => isRope ? hy : hyT.at() === null ? HOIST : hyT.at() / 100;
  const batCol = () => isBat ? bc : bcR, batRow = () => isBat ? br : brR;
  const staV = () => isRope ? sta : staT.at() === null ? 1 : staT.at() / 100;
  const tiredV = () => isRope ? tired : !!tiredR;
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function spill(x, y, k, up) { for (let i = 0; i < k && shower.length < 120; i++) shower.push({ x: x + (cr() - .5) * 40, y: y + (cr() - .5) * 20, vx: (cr() - .5) * 330, vy: -(up || 160) * cr() - 40, c: CANDY[Math.floor(cr() * 6)], r: cr() * 6, gy: 480 + cr() * 44 }); }

  /* ── the batter ── */
  function setSlot(c, r) {
    if (!isBat || g.result) return; c = clamp(Math.round(c), 0, 4); r = clamp(Math.round(r), 0, 2);
    if (c !== bc || r !== br) { bc = c; br = r; sfx.blip && sfx.blip(6); snd(520 + c * 40 + r * 25, .04, 'square', .03); publishB(true); }
  }
  function publishB(force) { const s = bc + ',' + br; if (force || s !== lastB || g.c - sentB >= .6) { lastB = s; sentB = g.c; D.send('b', [bc, br], true); } }
  const slotOf = p => [(p.x - 100) / 150, (p.y - 250) / 80];
  function doSwing() {
    if (!isBat || g.result || swing || g.c < lockUntil) return;
    swing = { t: g.c, c: bc, r: br }; cues = []; lockUntil = g.c + SWT / TS; sw = { t0: g.c, h: -1 };
    sfx.whoosh && sfx.whoosh(false); snd(260, .16, 'sawtooth', .04, 0, 90);
  }
  function resolveSwing() {
    const c = swing.c, r = swing.r; let ok = false;
    for (const h of pHist) if (g.c - h.t <= WIN && h.hy >= LOW && Math.abs(h.cx - c) < .45 && Math.abs(h.hy - r) < .45) { ok = true; break; }
    swing = null;
    if (ok) hits++;
    lockUntil = g.c + (ok ? HIT_LOCK : MISS_LOCK) / TS;
    D.send('sw', { c, r, h: ok ? hits : 0 });
    onSwing({ c, r, h: ok ? hits : 0 }, true);
    if (ok && hits >= NEED) g.finish('win');
  }
  function onSwing(d, own) {
    sw = { t0: own && sw ? sw.t0 : g.c - WIND, h: d.h };
    if (d.h > 0) {
      hits = Math.max(hits, d.h); flash = .45; sfx.thud(); sfx.boing && sfx.boing(); shake(5 + d.h, .18);
      const k = d.h >= NEED ? 0 : 10; spill(COLX(d.c), ROWY[d.r], k, 200);
      pop(d.h >= NEED ? 'CANDY!' : ['CRACK!', 'POW!', 'WHACK!', 'BONK!'][(d.h - 1) % 4], 400, 190, 28, '#ff5c9a', '#fff');
      if (isRope) hoistUntil = g.c + HOIST_HIT / TS;
    } else { sfx.miss && sfx.miss(); if (isBat) pop('WHIFF!', COLX(d.c), ROWY[d.r] - 70, 22, '#7a5040', '#fff'); }
  }
  const cueOk = c => g.c - c.t < CUE_LIFE && c.s === hits && (c.k === 'L' || c.k === 'R' || c.k === 'O' ? c.f === bc : c.f === br);
  const validCues = () => isBat ? cues.filter(cueOk) : [];

  /* ── the caller ── */
  function cue(k) {
    if (!isCall || g.result) return;
    const pcs = Math.round(pcxV()), prs = Math.round(phyV()), bcs = batCol(), brs = batRow(); let f = 0, nn = 1;
    if (k === 'L' || k === 'R') { if (!seesCol) return; f = bcs; nn = Math.max(1, Math.abs(pcs - bcs)); }
    else if (k === 'U' || k === 'D') { if (!seesRow) return; f = brs; nn = Math.max(1, Math.abs(prs - brs)); }
    else if (k === 'O') { if (!seesCol) return; f = bcs; }
    else if (k === 'N') { if (!seesRow) return; f = brs; }
    else return;
    D.send('cue', { k, f, n: clamp(nn, 1, 4), s: hits }); lastCue[me] = { k, t: g.c };
    sfx.blip && sfx.blip(k === 'N' ? 14 : 8); snd(k === 'N' ? 880 : 660, .05, 'square', .04);
  }
  const BTN = (() => {
    if (!isCall) return [];
    const mk = (k, x, w, face, base) => ({ k, x, y: 488, w, h: 52, face, base });
    if (isA) return [mk('L', 235, 170, '#4db8ff', '#2a82c4'), mk('O', 400, 120, '#4fd06a', '#24803a'), mk('R', 565, 170, '#4db8ff', '#2a82c4')];
    if (isB) return [mk('U', 235, 170, '#b49cff', '#7d5fe0'), mk('N', 400, 150, '#ff4d5e', '#b8283a'), mk('D', 565, 170, '#b49cff', '#7d5fe0')];
    return [mk('L', 120, 112, '#4db8ff', '#2a82c4'), mk('R', 244, 112, '#4db8ff', '#2a82c4'), mk('N', 400, 150, '#ff4d5e', '#b8283a'), mk('U', 556, 112, '#b49cff', '#7d5fe0'), mk('D', 680, 112, '#b49cff', '#7d5fe0')];
  })();
  const KEYBTN = { L: 'A', R: 'D', U: 'W', D: 'S', N: 'SPACE', O: 'SPACE' };
  let btnDown = null, btnAt = -9;

  /* ── the rope ── */
  function setRope(c, r) { if (!isRope || g.result) return; ropeC = clamp(Math.round(c), 0, 4); ropeR = r < 0 ? -1 : clamp(Math.round(r), 0, 2); }
  const g = {
    c: 0, dur: 16, pts: 0,
    cmd: isBat ? 'SWING!' : isRope ? 'LOWER IT!' : 'CALL IT!',
    roleLabel: isBat ? 'BATTER' : isRope ? 'ROPE' : isA ? 'SIDE CALLER' : isB ? 'HEIGHT CALLER' : 'CALLER',
    hint: isBat ? 'YOU ARE BLINDFOLDED - FOLLOW THE ARROWS YOUR CALLERS SEND (MOUSE OR ARROWS TO MOVE THE BAT), CLICK / SPACE TO SWING WHEN THEY SAY NOW'
      : isRope ? 'KEEP THE PIÑATA LOW WITH THE MOUSE (OR ARROWS) - THE WIND SHOVES IT AROUND AND YOUR ARMS GET TIRED'
      : isA ? 'YOU SEE LEFT-RIGHT ONLY - CLICK ◄ ► (OR A / D) TO MOVE THE BAT, THEN OK (SPACE) WHEN THE COLUMNS MATCH'
      : isB ? 'YOU SEE UP-DOWN AND TIMING ONLY - CLICK ▲ ▼ (OR W / S) TO MOVE THE BAT, NOW (SPACE) WHEN IT IS LOW AND LEVEL'
      : 'TELL THE BATTER WHERE AND WHEN - CLICK ◄ ► ▲ ▼ (OR ARROWS), NOW (SPACE) WHEN BOTH MATCH',
    thint: isBat ? 'YOU ARE BLINDFOLDED - FOLLOW THE ARROWS YOUR CALLERS SEND, DRAG TO MOVE THE BAT, TAP SWING WHEN THEY SAY NOW'
      : isRope ? 'DRAG TO KEEP THE PIÑATA LOW - THE WIND SHOVES IT AROUND AND YOUR ARMS GET TIRED'
      : isA ? 'YOU SEE LEFT-RIGHT ONLY - TAP ◄ ► TO MOVE THE BAT, THEN OK WHEN THE COLUMNS MATCH'
      : isB ? 'YOU SEE UP-DOWN AND TIMING ONLY - TAP ▲ ▼ TO MOVE THE BAT, NOW WHEN IT IS LOW AND LEVEL'
      : 'TELL THE BATTER WHERE AND WHEN - TAP ◄ ► ▲ ▼, NOW WHEN BOTH MATCH',
    update(dt) {
      g.c += dt; const T = g.c; S += dt * TS; const done = !!g.result;
      if (done && resAt < 0) {
        resAt = T;
        if (g.result === 'win') { sfx.coin(); snd(300, .5, 'sawtooth', .05, 0, 900); spill(COLX(Math.round(pcxV())), yOf(Math.max(0, phyV())), 60, 420); } else snd(300, .5, 'sawtooth', .06, 0, 80);
      }
      flash = Math.max(0, flash - dt);
      bcS += (batCol() - bcS) * Math.min(1, dt * 16); brS += (batRow() - brS) * Math.min(1, dt * 16);
      if (isBat && !done) {
        publishB(false);
        if (swing && T - swing.t >= WIND) resolveSwing();
        cues = cues.filter(c => T - c.t < CUE_LIFE + .5);
        if (T >= g.limit) g.finish('lose');
      }
      if (isRope && !done) {
        const gu = gust(), lowered = ropeR >= 0 && !tired && T >= hoistUntil;
        const tcx = clamp(ropeC + gu.dc, 0, 4), thy = lowered ? clamp(ropeR + gu.dr, 0, 2) : HOIST;
        cx += clamp(tcx - cx, -8 * dt, 8 * dt); hy += clamp(thy - hy, -5 * dt, 5 * dt);
        if (hy >= LOW) sta = Math.max(0, sta - DRAIN * dt * TS); else sta = Math.min(1, sta + RECOV * dt);
        if (!tired && sta <= 0) { tired = true; sfx.buzz && sfx.buzz(); pop('TIRED!', 700, 380, 22, '#ff9a4d', '#fff'); } else if (tired && sta >= .5) tired = false;
        const s = Math.round(cx * 100) + ',' + Math.round(hy * 100) + ',' + Math.round(sta * 100) + ',' + (tired ? 1 : 0);
        if ((s !== lastP && T - sentP >= .09) || T - sentP >= .5) { lastP = s; sentP = T; D.send('p', [Math.round(cx * 100), Math.round(hy * 100), Math.round(sta * 100), tired ? 1 : 0], true); }
      }
      // what the callers' bots (and eyes) read: how long the piñata has sat in the same slot
      const pcs = Math.round(pcxV()), prs = Math.round(phyV()), low = phyV() >= LOW;
      if (pcs !== lastColSlot) { lastColSlot = pcs; colSince = T; }
      if (prs !== lastRowSlot || low !== lastLow) { lastRowSlot = prs; lastLow = low; rowSince = T; }
      // cosmetic bits
      dogX += (clamp(piles.length ? piles[piles.length - 1].x : (shower.length ? shower[shower.length - 1].x : 300), 240, 700) - dogX) * Math.min(1, dt * (g.result === 'win' ? 3 : .8));
      for (let i = shower.length - 1; i >= 0; i--) {
        const p = shower[i]; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 5;
        if (p.y >= p.gy && p.vy > 0) { shower.splice(i, 1); if (piles.length < 90) piles.push({ x: clamp(p.x, 40, 740), y: p.gy, c: p.c, r: p.r }); }
      }
      if (pops.length && T - pops[0].t0 > 1) pops.length = 0;
    },
    msg(type, d, from) {
      if (type === 'b' && Array.isArray(d) && !isBat) { bcR = clamp(d[0] | 0, 0, 4); brR = clamp(d[1] | 0, 0, 2); }
      else if (type === 'p' && Array.isArray(d) && !isRope) {
        cxT.push(d[0]); hyT.push(d[1]); staT.push(d[2]); tiredR = d[3] | 0;
        if (isBat) { pHist.push({ t: g.c, cx: d[0] / 100, hy: d[1] / 100 }); while (pHist.length && pHist[0].t < g.c - 1) pHist.shift(); }
      }
      else if (type === 'sw' && d && !isBat) onSwing({ c: d.c | 0, r: d.r | 0, h: d.h | 0 }, false);
      else if (type === 'cue' && d && from >= 2 && from < n) {
        lastCue[from] = { k: d.k, t: g.c };
        if (isBat && /^[LRUDON]$/.test(d.k)) { cues.push({ k: d.k, f: d.f | 0, n: clamp(d.n | 0, 1, 4), s: d.s | 0, t: g.c }); if (cues.length > 8) cues.shift(); sfx.blip && sfx.blip(10); }
      }
    },
    draw(T) {
      X = ctx; const res = g.result, rk = resAt >= 0 ? g.c - resAt : -1;
      const mode = isBat ? 'bat' : isRope ? 'rope' : isA ? 'a' : isB ? 'b' : 'full';
      let pc = pcxV(), ph = phyV(); if (res === 'lose') { ph = lerp(ph, HOIST, ease(rk * 2)); }
      const vc = validCues();
      const sc = { n, me, mode, T, t0: g.c, pcx: pc, phy: ph, bc: bcS, br: brS, hits, sw: sw ? { t0: sw.t0, h: Math.max(0, sw.h) } : null, cues: vc, names: Array.from({ length: n }, (_, i) => nmOf(i)), cols: Array.from({ length: n }, (_, i) => colOf(i)),
        res, rk, sta: staV(), tired: tiredV(), dogX, flash, shower, piles, lastCue, holderX: 745 };
      drawScene(sc);
      hud(sc);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 120, 680), clamp(q.y - Math.min(a, .6) * 14, 150, 520), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (res && rk >= 0) endFx(sc, rk, T);
      vignette(.14);
    },
    down(p) {
      if (g.result) return; pressed = true;
      if (isCall) { for (const b of BTN) if (p.x >= b.x - b.w / 2 && p.x <= b.x + b.w / 2 && p.y >= b.y - 6 && p.y <= b.y + b.h + 14) { btnDown = b.k; btnAt = g.c; cue(b.k); return; } }
      else if (isBat) {
        if (TOUCH) { if (p.y >= 488 && p.x > 260 && p.x < 540) doSwing(); else { const s = slotOf(p); setSlot(s[0], s[1]); } }
        else { const s = slotOf(p); setSlot(s[0], s[1]); doSwing(); }
      } else if (isRope) { setRope((p.x - 100) / 150, p.y < 175 ? -1 : (p.y - 250) / 80); }
    },
    move(p) {
      if (g.result) return;
      if (isBat && (!TOUCH || pressed)) { const s = slotOf(p); setSlot(s[0], s[1]); }
      else if (isRope && (!TOUCH || pressed)) setRope((p.x - 100) / 150, p.y < 175 ? -1 : (p.y - 250) / 80);
    },
    up() { pressed = false; },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape' || g.result) return;
      const L = c === 'ArrowLeft' || c === 'KeyA', Rr = c === 'ArrowRight' || c === 'KeyD', U = c === 'ArrowUp' || c === 'KeyW', Dn = c === 'ArrowDown' || c === 'KeyS', SP = c === 'Space' || c === 'Enter';
      if (isBat) { if (L) setSlot(bc - 1, br); else if (Rr) setSlot(bc + 1, br); else if (U) setSlot(bc, br - 1); else if (Dn) setSlot(bc, br + 1); else if (SP && !e.repeat) doSwing(); }
      else if (isRope) { if (L) setRope(ropeC - 1, ropeR); else if (Rr) setRope(ropeC + 1, ropeR); else if (U) setRope(ropeC, ropeR - 1); else if (Dn) setRope(ropeC, ropeR + 1); }
      else if (isCall && !e.repeat) {
        if (L) cue('L'); else if (Rr) cue('R'); else if (U && !isA) cue('U'); else if (Dn && !isA) cue('D');
        else if (c === 'KeyW' && isA) cue('O'); else if (SP) cue(isA ? 'O' : 'N');
      }
    },
    keyup() {},
  };
  /* ── the HUD: the candy sign, role plates, the rope's grip, the height ruler ── */
  function hud(S2) {
    const T = S2.T, x0 = 294, y0 = 62, w = 212, h = 40;
    line([[x0 + 26, 58], [x0 + 26, y0 + 2]], 3, '#e6c58c'); line([[x0 + w - 26, 58], [x0 + w - 26, y0 + 2]], 3, '#e6c58c');
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(x0 + 4, y0 + 6, w, h, 12); X.fill();
    rr(x0, y0, w, h, 12); ink('#a5622c', 4); rr(x0 + 3, y0 + 2, w - 6, h - 8, 10); X.fillStyle = '#d9944f'; X.fill(); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x0 + 10, y0 + 5, w - 20, 5, 2.5); X.fill();
    for (let i = 0; i < NEED; i++) {
      const px = x0 + 38 + i * 45, py = y0 + 18, on = i < hits, k = on ? outBack(clamp((S2.t0 - (S2.sw ? S2.sw.t0 : 0)) / .3, 0, 1)) : 1;
      X.save(); X.translate(px, py); X.scale(on && i === hits - 1 ? Math.max(.6, k) : 1, on && i === hits - 1 ? Math.max(.6, k) : 1);
      X.beginPath(); X.arc(0, 0, 14, 0, TAU); ink(on ? '#fff3e0' : '#8a5a34', 3);
      if (on) candy(0, 0, 5, CANDY[i % 6], T * 2 + i); X.restore();
    }
    const done = !!S2.res, ps = (S2.res ? 90 : 0);
    // role plates
    if (isCall) {
      for (const b of BTN) {
        const act = btnDown === b.k && g.c - btnAt < .12, d = act || done ? 3 : 9, fy = b.y + 9 - d, grey = done;
        rr(b.x - b.w / 2, b.y + 9, b.w, b.h, 18); ink(grey ? '#8f88a6' : b.base, 4); rr(b.x - b.w / 2, fy, b.w, b.h, 18); ink(grey ? '#d3cfe0' : b.face, 4);
        X.fillStyle = 'rgba(255,255,255,.3)'; rr(b.x - b.w / 2 + 12, fy + 5, b.w - 24, 8, 4); X.fill();
        const cy = fy + b.h / 2 + (TOUCH ? 0 : -5);
        if (b.k === 'N') txt('NOW!', b.x, cy + 1, 26, '#fff', 'center', b.w - 24); else if (b.k === 'O') txt('OK!', b.x, cy + 1, 26, '#fff', 'center', b.w - 24); else arrow(b.x, cy, 'LRUD'.indexOf(b.k), 1.15, '#fff');
        if (!TOUCH && !done) keyCap(b.x, fy + b.h - 12, n === 3 && (b.k === 'L' || b.k === 'R') ? (b.k === 'L' ? '◄' : '►') : n === 3 && (b.k === 'U' || b.k === 'D') ? (b.k === 'U' ? '▲' : '▼') : isA && b.k !== 'O' ? (b.k === 'L' ? 'A' : 'D') : isB && b.k !== 'N' ? (b.k === 'U' ? 'W' : 'S') : 'SPACE');
      }
    } else if (isBat) {
      const bx = 400, by = 488, bw = 250, bh = 48, d = !done && g.c < lockUntil ? 3 : 9, fy = by + 9 - d, grey = done || g.c < lockUntil;
      rr(bx - bw / 2, by + 9, bw, bh, 20); ink(grey ? '#8f88a6' : '#c99512', 4); rr(bx - bw / 2, fy, bw, bh, 20); ink(grey ? '#d3cfe0' : '#ffd23f', 4);
      X.fillStyle = 'rgba(255,255,255,.35)'; rr(bx - bw / 2 + 14, fy + 5, bw - 28, 8, 4); X.fill();
      if (TOUCH || done) txt(done ? (S2.res === 'win' ? 'YEAH!' : 'OOPS!') : 'SWING!', bx, fy + bh / 2 + 2, 26, INK, 'center', bw - 30);
      else { txt('SWING!', bx - 50, fy + bh / 2 + 1, 24, INK, 'center', 100); keyCap(bx + 40, fy + bh / 2 + 2, 'CLICK'); keyCap(bx + 100, fy + bh / 2 + 2, 'SPACE'); }
      // the cue arrows: right on the bat slot, from the callers' hands
      if (!done) for (const c of S2.cues.slice(-3)) {
        const a = (g.c - c.t) / CUE_LIFE, al = 1 - ease(clamp((a - .6) / .4, 0, 1)), x = COLX(S2.bc >= 0 ? Math.round(S2.bc) : 2), y = ROWY[clamp(Math.round(S2.br), 0, 2)];
        X.globalAlpha = al;
        if (c.k === 'L' || c.k === 'R' || c.k === 'U' || c.k === 'D') {
          const dir = 'LRUD'.indexOf(c.k), ox = [-82, 82, 0, 0][dir], oy = [0, 0, -80, 80][dir], bump = Math.sin(T * 14) * 5 * [-1, 1, -1, 1][dir];
          X.save(); X.translate(x + ox + (dir < 2 ? bump : 0), y + oy + (dir >= 2 ? bump : 0)); arrow(0, 0, dir, 2.1, '#ffd23f'); if (c.n > 1) badge('x' + c.n, 0, -44, 18, '#ff4d5e', '#fff', 1, 0); X.restore();
        } else if (c.k === 'N') badge('NOW!', x, y - 92, 30, '#ff4d5e', '#fff', 1 + Math.sin(T * 16) * .08, -.05);
        else badge('OK!', x, y + 92, 24, '#4fd06a', '#fff', 1, .05);
        X.globalAlpha = 1;
      }
      if (!done && !S2.cues.length && g.c > 1) { X.globalAlpha = .75; txt('WAIT...', 400, 460, 22, '#fff'); X.globalAlpha = 1; }
    } else if (isRope) {
      // the grip meter: a ring round the holder's hands + a label
      const hx = S2.holderX, hy2 = KIDY - 38;
      if (!done) {
        X.lineCap = 'round'; X.lineWidth = 11; X.strokeStyle = 'rgba(20,16,28,.55)'; X.beginPath(); X.arc(hx, hy2, 34, 0, TAU); X.stroke();
        X.lineWidth = 5.5; X.strokeStyle = S2.tired ? '#ff9a4d' : sta < .35 ? '#ffd23f' : '#5CFF7A'; X.beginPath(); X.arc(hx, hy2, 34, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.02, sta)); X.stroke();
      }
      const bx = 400, by = 488, bw = 300, bh = 48;
      rr(bx - bw / 2, by + 9, bw, bh, 20); ink(done ? '#8f88a6' : '#24803a', 4); rr(bx - bw / 2, by + 2, bw, bh, 20); ink(done ? '#d3cfe0' : '#4fd06a', 4);
      X.fillStyle = 'rgba(255,255,255,.3)'; rr(bx - bw / 2 + 14, by + 7, bw - 28, 8, 4); X.fill();
      txt(done ? (S2.res === 'win' ? 'YEAH!' : 'OOPS!') : S2.tired ? 'TIRED!' : 'PULL IT DOWN!', bx, by + bh / 2 + 4, 24, '#fff', 'center', bw - 40);
    }
    if (S2.mode === 'a' && !done) badge('SEES SIDEWAYS ONLY', 400, 138, 15, '#2a82c4', '#fff', 1, -.02);
    if (S2.mode === 'b') {
      // the height ruler on the left wall + the reach lamp
      const rx = 52, top = 150, bot = 430; rr(rx - 15, top - 14, 30, bot - top + 28, 14); ink('#f4f6fb', 3.5);
      for (let r = 0; r < 3; r++) { const y = ROWY[r] - 100; line([[rx - 12, y], [rx + 12, y]], 3, '#8f88a6'); }
      const yy = v => lerp(top, bot, clamp((yOf(v) - HOISTY) / (ROWY[2] - HOISTY), 0, 1));
      star(rx, yy(S2.phy), 11, 6, 7, T * 2, '#ff5c9a', 2.5);
      arrow(rx + 26, yy(S2.br), 0, .55, '#ffd23f');
      badge(S2.phy >= LOW ? 'IN REACH!' : 'HOISTED', 118, top - 26, 14, S2.phy >= LOW ? '#4fd06a' : '#ff4d5e', '#fff', 1, -.03);
      if (!done) badge('SEES UP-DOWN ONLY', 400, 138, 15, '#7d5fe0', '#fff', 1, -.02);
    }
    if (isRope && S2.phy < LOW && !done && !S2.tired && g.c > 1.2 && ropeR < 0) badge('PULL IT DOWN!', 560, 250, 20, '#ff4d5e', '#fff', 1 + Math.sin(T * 9) * .05, -.04);
  }
  function endFx(S2, rk, T) {
    if (S2.res === 'win') {
      for (let i = 0; i < 6; i++) { const q = (rk * .9 + i / 6) % 1; X.globalAlpha = 1 - q; heart(120 + i * 110 + Math.sin(q * 6 + i) * 20, 430 - q * 190, 1.2 + (i % 2) * .4); } X.globalAlpha = 1;
      if (rk > .15) badge('HAPPY BIRTHDAY!', 400, 200, 36, '#ff5c9a', '#fff', outBack((rk - .15) / .2), -.05);
    } else if (rk > .1) badge(['HA HA HA!', 'WHOOPS!'][Math.floor(resAt * 7) % 2], 400, 200, 36, '#ff9a4d', '#fff', outBack((rk - .1) / .2), -.05);
  }
  g.dbg = {
    view: () => {
      const pcs = Math.round(pcxV()), prs = Math.round(phyV()), low = phyV() >= LOW;
      if (isBat) return { n, role: 'bat', col: bc, row: br, locked: !!swing || g.c < lockUntil, cues: validCues().map(c => ({ k: c.k, n: c.n, age: g.c - c.t })), hits };
      if (isRope) return { n, role: 'rope', cx, hy, sta, tired, lowered: hy >= LOW, hits };
      const v = { n, role: isA ? 'a' : isB ? 'b' : 'c3', hits };
      if (seesCol) { v.pcol = pcs; v.bcol = batCol(); v.colStable = g.c - colSince; }
      if (seesRow) { v.prow = prs; v.brow = batRow(); v.lowered = low; v.rowStable = g.c - rowSince; }
      return v;
    },
    cue, setSlot, doSwing, setRope, GU, get hits() { return hits; },
  };
  wire(g, D, 0, sp, 'sq_pinata');
  return g;
}
reg('sq_pinata', sqPinata, 'PIÑATA PARTY'); REGMAP.sq_pinata.duo = true; REGMAP.sq_pinata.squad = true;

/* ───────────── intro card demos (520x240 frame): a mini yard, the role's own bit big and busy ───────────── */
function demoBase(t) {
  X = ctx;
  let g = X.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, '#4fb4f0'); g.addColorStop(.6, '#a9defa'); g.addColorStop(1, '#ffe9c4'); X.fillStyle = g; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#ffd98a'; X.fillRect(0, 70, 520, 110); X.fillStyle = '#ff9bb8'; X.fillRect(0, 150, 520, 30);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 70); X.lineTo(520, 70); X.stroke();
  X.fillStyle = '#f0dcae'; X.fillRect(0, 180, 520, 60); X.beginPath(); X.moveTo(0, 180); X.lineTo(520, 180); X.stroke();
  const pts = []; for (let i = 0; i <= 14; i++) pts.push([lerp(10, 510, i / 14), 22 + Math.sin(Math.PI * i / 14) * 8]); line(pts, 3, INK);
  for (let i = 1; i < 14; i++) { X.save(); X.translate(pts[i][0], pts[i][1]); X.rotate(Math.sin(t * 2.4 + i) * .12); poly([[-7, 0], [7, 0], [0, 16]]); ink(TIS[i % 7], 2); X.restore(); }
  line([[10, 40], [510, 40]], 4, INK); line([[10, 40], [510, 40]], 2, '#e6c58c');
}
function demoRole(kind, t, ci) {
  demoBase(t); const u = t % 4.2, col = PCOL[ci];
  const px = 300 + Math.sin(t * .9) * 60, low = u > .6 && u < 3.2, py = low ? 120 : 76;
  const sh = (a, b) => ease(clamp((u - a) / (b - a), 0, 1));
  const pinAt = (x, y, o) => { line([[x, 44], [x, y - 28]], 3, INK); pinata(x, y, t, Object.assign({ s: .62 }, o || {})); };
  if (kind === 'bat') {
    const hit = u > 2.2 && u < 2.9;
    for (let i = 0; i < 3; i++) { X.globalAlpha = .35; pinata(120 + i * 140 + Math.sin(t * 1.4 + i) * 20, 100 + Math.cos(t * 1.1 + i) * 14, t, { s: .6 }); X.globalAlpha = 1; }
    X.fillStyle = 'rgba(255,248,230,.5)'; X.fillRect(0, 50, 520, 130);
    const k = hit ? clamp((u - 2.2) / .6, 0, 1) : 0, bx = 150 + (u > 1.2 ? 160 : 0), x = bx;
    caos(x, 214, 4, { col }); blind(x, 214, 4); bat(x + 24, 184, x + 70, 110, hit ? lerp(-.8, .4, ease(k)) : 0, hit ? 1 : .7);
    badge(u < 1.2 ? 'WAIT...' : u < 2.2 ? 'NOW!' : 'POW!', 380, 112, 20, u < 2.2 ? '#ff4d5e' : '#ff5c9a', '#fff', 1, -.04);
    if (u > 1.2 && u < 2.2) arrow(x + 100, 150, 1, 1.2, '#ffd23f');
    demoFinger(x + 20, 214, u > 2 && u < 2.5, ((u - 2) * 2) % 1);
  } else if (kind === 'rope') {
    pinAt(300, py + (low ? 20 : 0), { mood: low ? 'scared' : 'smug' });
    const hx = 460; caos(hx, 220, 4.4, { col }); line([[300, 40], [500, 40], [500, 80], [hx + 4, 180]], 4, INK); line([[300, 40], [500, 40], [500, 80], [hx + 4, 180]], 2, '#e6c58c');
    for (const sx of [-1, 1]) { X.beginPath(); X.arc(hx + sx * 5, 176 - (low ? 0 : 8), 5, 0, TAU); ink('#ffd23f', 2.4); }
    badge(low ? 'HOLD IT LOW!' : 'LOWER IT!', 380, 112, 20, '#4fd06a', '#fff', 1, -.03);
    demoFinger(hx - 10, low ? 150 : 100, u > .3 && u < 1, ((u - .3) * 1.6) % 1);
  } else {
    const aligned = u > 1.6;
    pinAt(px, 120, {});
    caos(110, 214, 4, { col }); caos(250, 214, 4, { col: PCOL[0] }); blind(250, 214, 4); bat(274, 186, px, 120, 0, .8);
    const sc = outBack(clamp((u - .5) / .15, 0, 1)) * (aligned ? 0 : 1);
    if (kind === 'a') { X.save(); X.translate(150, 150); X.scale(sc, sc); arrow(0, 0, px > 250 ? 1 : 0, 1.8, '#4db8ff'); X.restore(); if (aligned) badge('OK!', 150, 150, 22, '#4fd06a', '#fff', outBack((u - 1.6) / .2), .04); }
    else if (kind === 'b') { X.save(); X.translate(150, 150); X.scale(sc, sc); arrow(0, 0, 2, 1.8, '#b49cff'); X.restore(); if (aligned) badge('NOW!', 150, 150, 22, '#ff4d5e', '#fff', outBack((u - 1.6) / .2), .04); }
    else { X.save(); X.translate(150, 150); X.scale(sc, sc); arrow(0, 0, 1, 1.8, '#4db8ff'); X.restore(); if (aligned) badge('NOW!', 150, 150, 22, '#ff4d5e', '#fff', outBack((u - 1.6) / .2), .04); }
    demoFinger(110, 232, (u > .45 && u < 1) || (u > 1.5 && u < 2), ((u * 2) % 1));
  }
}
DUO.INFO.sq_pinata = n => n === 4
  ? [['BATTER', 'BLINDFOLDED: SWING WHEN THEY SAY NOW', 'MOUSE / ARROWS = BAT, CLICK / SPACE = SWING'], ['ROPE', 'HOLD THE PIÑATA LOW, THE WIND SHOVES IT', 'MOUSE OR ARROWS'], ['SIDE CALLER', 'YOU SEE LEFT-RIGHT ONLY', '◄ ► OR A / D, SPACE = OK'], ['HEIGHT CALLER', 'YOU SEE UP-DOWN AND TIMING ONLY', '▲ ▼ OR W / S, SPACE = NOW']]
  : [['BATTER', 'BLINDFOLDED: SWING WHEN THEY SAY NOW', 'MOUSE / ARROWS = BAT, CLICK / SPACE = SWING'], ['ROPE', 'HOLD THE PIÑATA LOW, THE WIND SHOVES IT', 'MOUSE OR ARROWS'], ['CALLER', 'TELL THE BATTER WHERE AND WHEN', 'BUTTONS OR ARROWS + SPACE']];
DUO.DEMOS.sq_pinata = n => (n === 4 ? ['bat', 'rope', 'a', 'b'] : ['bat', 'rope', 'c']).map((k, i) => t => demoRole(k, t, i));

})();
