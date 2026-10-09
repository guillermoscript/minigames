'use strict';
/* LINES & LIGHT - drawing, tracing and light microgames: SEW EASY, ROAD WORK, HOOKIN' UP, WHAT'S YOUR SIGN?,
   MAGNAFIRE, GREEN THUMB, DIRE PLATES, ON THE EDGE.
   Every game works with touch (down/move/up with logical coordinates, targets >= 56px, no hover, no chords) and
   with mouse + keyboard (arrow keys / digits as the alternative to dragging).
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), down/move/up/key/keyup}; g.result = 'win'|'lose'.
   The real time limit is dur / sqrt(sp) (see main.js), so every game keeps its own clock D = dur / rs.
   ART: the DUO look (docs/ART-STYLE.md). Gameplay is frozen; decor randomness comes from hr(), never from Math.random. */
(function () {

const NAVY = '#1E2A5A', NAVY2 = '#2A3B78', CYAN = '#35D0E8', AMB = '#FFC93C', CORAL = '#FF6B6B', LIME = '#8DF06B',
  PLUM = '#9B6BFF', PINK = '#FF8AD8', PAP = '#FFF1D0', RED = '#ff4d4d';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lnMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const lnLose = (msg, x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); floatText(msg, x, y, RED, 46); };
const lnWin = (msg, x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 36); ring(x, y, '#fff', 110); floatText(msg, x, y - 110, AMB, 48); };

/* ───────────── DUO-look drawing kit (local copy; draws on X, which is ctx live or an offscreen canvas while baking) ───────────── */
const TAU = Math.PI * 2;
let X = null;
const hr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // decor "random": never the game RNG
const cl = k => Math.max(0, Math.min(1, k));
const ease = k => (k = cl(k), k * k * (3 - 2 * k));
const outBack = k => { k = cl(k) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
const R_ = (x, y, w, h, r) => () => rr(x, y, w, h, r), E_ = (x, y, rx, ry, rot) => () => el(x, y, rx, ry, rot), C_ = (x, y, r) => () => { X.beginPath(); X.arc(x, y, r, 0, TAU); };
function cel(pf, base, shade, dx = -4, dy = -5) {          // flat shade, then the base shifted up-left and clipped: a crescent is left
  X.save(); pf(); X.fillStyle = shade; X.fill(); X.clip(); X.translate(dx, dy); pf(); X.fillStyle = base; X.fill(); X.restore();
}
function obj(pf, base, shade, o = 4, dx, dy) { pf(); ink(null, o); cel(pf, base, shade, dx, dy); }
function glint(x, y, rx, ry, a = .45, rot = -.5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function line(pts, w, col, oc = INK) {
  X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]));
  X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 7; X.strokeStyle = oc; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke();
}
function bake(fn) {            // paint once into a VW x 600 layer (logical x from -OX); blit with X.drawImage(layer, -OX, 0)
  const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0);
  try { fn(); } finally { X = old; } return c;
}
function cloud(x, y, s, oc) {
  X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3, oc || INK); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); }
  X.restore();
}
function tuft(x, y, col = '#3f8f35') { X.strokeStyle = col; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9, y - 10); X.moveTo(x, y); X.lineTo(x, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 10); X.stroke(); }
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function drop(x, y, s, a = 1) {
  X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 1, 0, 6); X.quadraticCurveTo(-7, 1, 0, -9); X.closePath();
  ink('#9fe3ff', 2.5); X.fillStyle = '#fff'; el(-1.8, 0, 1.6, 2.4); X.fill(); X.restore();
}
function spark(x, y, s, col = '#fff', a = 1) {   // 4-point sparkle (no INK: a light)
  X.save(); X.globalAlpha = a; X.translate(x, y); X.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .24 : s, an = i * Math.PI / 4 - Math.PI / 2; X.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
  X.closePath(); X.fillStyle = col; X.fill(); X.restore();
}
function zee(x, y, s, a = 1) {
  X.save(); X.globalAlpha = a; X.font = `900 ${s}px "Arial Black", Impact, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round';
  X.lineWidth = s / 4; X.strokeStyle = INK; X.strokeText('Z', x, y); X.fillStyle = '#fff'; X.fillText('Z', x, y); X.restore();
}
function eye(x, y, r, look, mood, T, k) {   // sclera + pupil toward look [-1..1] + white dot; moods: happy dead panic sleepy
  if (mood === 'happy') { X.beginPath(); X.arc(x, y + r * .3, r * .7, Math.PI * 1.1, Math.PI * 1.9); X.lineWidth = r * .45; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); return; }
  if (mood === 'dead') { X.lineWidth = r * .42; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .6, y - r * .6); X.lineTo(x + r * .6, y + r * .6); X.moveTo(x + r * .6, y - r * .6); X.lineTo(x - r * .6, y + r * .6); X.stroke(); return; }
  if (mood === 'sleepy') { X.beginPath(); X.arc(x, y - r * .3, r * .7, Math.PI * .1, Math.PI * .9); X.lineWidth = r * .45; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); return; }
  const pan = mood === 'panic', Rr = pan ? r * 1.3 : r;
  if (!pan && Math.sin(T * 1.9 + k) > .985) { X.lineWidth = r * .4; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - Rr, y); X.lineTo(x + Rr, y); X.stroke(); return; }
  el(x, y, Rr, Rr * 1.08); ink('#fff', Math.max(1.5, r * .28));
  const pr = pan ? r * .32 : r * .52, px = x + look[0] * Rr * .38, py = y + look[1] * Rr * .38;
  X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fillStyle = INK; X.fill();
  X.beginPath(); X.arc(px - pr * .35, py - pr * .4, Math.max(1, pr * .38), 0, TAU); X.fillStyle = '#fff'; X.fill();
}
function brow(x, y, w, ang, wd = 4) { X.save(); X.translate(x, y); X.rotate(ang); X.beginPath(); X.moveTo(-w / 2, 0); X.lineTo(w / 2, 0); X.lineWidth = wd; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.restore(); }
function mouth(x, y, w, kind, wd = 3.5) {    // smile / frown / open / flat
  X.lineWidth = wd; X.strokeStyle = INK; X.lineCap = 'round'; X.lineJoin = 'round';
  if (kind === 'open') { X.beginPath(); X.ellipse(x, y, w * .5, w * .42, 0, 0, TAU); X.fillStyle = '#7a1f3a'; X.fill(); X.stroke(); return; }
  if (kind === 'laugh') { X.beginPath(); X.moveTo(x - w / 2, y - 2); X.quadraticCurveTo(x, y + w * .9, x + w / 2, y - 2); X.closePath(); X.fillStyle = '#7a1f3a'; X.fill(); X.stroke(); return; }
  X.beginPath();
  if (kind === 'smile') { X.moveTo(x - w / 2, y); X.quadraticCurveTo(x, y + w * .5, x + w / 2, y); }
  else if (kind === 'frown') { X.moveTo(x - w / 2, y + w * .25); X.quadraticCurveTo(x, y - w * .3, x + w / 2, y + w * .25); }
  else if (kind === 'wavy') { X.moveTo(x - w / 2, y); X.quadraticCurveTo(x - w / 4, y - 4, x, y); X.quadraticCurveTo(x + w / 4, y + 4, x + w / 2, y); }
  else { X.moveTo(x - w / 2, y); X.lineTo(x + w / 2, y); }
  X.stroke();
}
/* blocky arms from caos()'s side stubs (drawn before caos(); origin = Caos's feet). 0 = straight up, - = out left */
function arms(u, la, ra, col) {
  const ol = Math.max(3, u * .5), L = 3.3 * u, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  const one = (sx, an) => {
    X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
    X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
    X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
    X.restore();
  };
  one(-1, la); one(1, ra);
}
const oT = g => g.result ? Math.max(0, now - (g._r0 == null ? (g._r0 = now) : g._r0)) : 0;
/* Caos, dressed: shadow + arms + body. Waves on idle, hops with arms up on a win, slumps on a loss. */
function hero(g, x, y, u) {
  const o = oT(g); let dy = 0, la = -2.4, ra = 2.4;
  if (g.result === 'win') { dy = -Math.abs(Math.sin(o * 9)) * 12; la = -.5 + Math.sin(now * 14) * .2; ra = .5 - Math.sin(now * 14) * .2; }
  else if (g.result === 'lose') { la = -2.9; ra = 2.9; }
  else { const k = Math.sin(now * 2) * .1; la = -2.4 + k; ra = 2.4 - k; }
  shadow(x, y + 2, u * 8 * (1 + dy / 80), u * 1.6, .3);
  X.save(); X.translate(x, y + dy); arms(u, la, ra, OR); X.restore();
  caos(x, y + dy, u, { mood: lnMood(g) });
}
/* Progress / fuel gauge: an inked pill that reads like part of the scene (label comes from the game, unchanged) */
function meter(x, y, w, v, col, label) {
  rr(x + 3, y + 7, w, 26, 13); X.fillStyle = 'rgba(20,16,28,.32)'; X.fill();
  rr(x, y, w, 26, 13); ink('#efe9ff', 4);
  X.save(); rr(x, y, w, 26, 13); X.clip(); const fw = w * clamp(v, 0, 1);
  X.fillStyle = col; X.fillRect(x, y, fw, 26); X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(x, y + 17, fw, 9);
  X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(x + 6, y + 4, Math.max(0, fw - 12), 4); X.restore();
  txt(label, x + w / 2, y + 13, 18, '#fff');
}
function ringHint(x, y, r) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r + Math.sin(now * 6) * 5, 0, 7); ctx.stroke(); }
function wallDots(L, R, y0, y1, col, n = 40) { X.fillStyle = col; for (let i = 0; i < n; i++) { X.beginPath(); X.arc(L + hr(i) * (R - L), y0 + hr(i + 50) * (y1 - y0), 3, 0, TAU); X.fill(); } }

/* A path sampled from f(u), u in 0..1. near() only looks at samples whose arc length lies in [s0, s1],
   which is what stops a player from "skipping" along the line. */
function lnPath(f, n = 240) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const p = f(i / n); pts.push({ x: p[0], y: p[1], s: 0 }); }
  for (let i = 1; i <= n; i++) pts[i].s = pts[i - 1].s + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const len = pts[n].s;
  const at = s => {
    s = clamp(s, 0, len); let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi], k = (s - a.s) / ((b.s - a.s) || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
  const near = (x, y, s0, s1) => {
    let bd = 1e9, bs = s0;
    for (const p of pts) { if (p.s < s0 || p.s > s1) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; bs = p.s; } }
    return { d: bd, s: bs };
  };
  const stroke = (s0, s1) => {
    if (s1 <= s0) return;
    const a = at(s0); ctx.beginPath(); ctx.moveTo(a.x, a.y);
    for (const p of pts) if (p.s > s0 && p.s < s1) ctx.lineTo(p.x, p.y);
    const e = at(s1); ctx.lineTo(e.x, e.y); ctx.stroke();
  };
  return { pts, len, at, near, stroke };
}

/* The thing the player moves. Pointer: while held it homes in on the finger/mouse at a limited speed (so it can
   never teleport past a gate); keyboard: arrows / WASD move it directly. Hovering without pressing does nothing. */
function lnTool(x, y, spd, kspd, bx0 = 24, bx1 = 776, by0 = 118, by1 = 545) {
  const T = { x, y, tx: x, ty: y, held: false, used: false };
  T.down = p => { T.held = true; T.used = true; T.tx = p.x; T.ty = p.y; };
  T.move = p => { if (T.held) { T.tx = p.x; T.ty = p.y; } };
  T.up = () => { T.held = false; };
  T.step = (dt, fix) => {
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.KeyA) dx--; if (keys.ArrowRight || keys.KeyD) dx++;
    if (keys.ArrowUp || keys.KeyW) dy--; if (keys.ArrowDown || keys.KeyS) dy++;
    if (dx || dy) {
      const l = Math.hypot(dx, dy); T.x += dx / l * kspd * dt; T.y += dy / l * kspd * dt; T.tx = T.x; T.ty = T.y; T.used = true;
    } else if (T.held) {
      const ex = T.tx - T.x, ey = T.ty - T.y, d = Math.hypot(ex, ey), m = spd * dt;
      if (d > m) { T.x += ex / d * m; T.y += ey / d * m; } else { T.x = T.tx; T.y = T.ty; }
    }
    T.x = clamp(T.x, bx0, bx1); T.y = clamp(T.y, by0, by1);
    if (fix) fix(T);
  };
  return T;
}

function cat(x, y, mood, look, T, tangle) {   // y = paws, sits facing us
  X.save(); X.translate(x, y);
  const wag = Math.sin(T * (mood === 'happy' ? 7 : 3)) * (mood === 'happy' ? 10 : 5);
  line([[24, -12], [44, -18], [52 + wag, -38], [46 + wag * 1.5, -58]], 9, '#e8a25a');
  obj(E_(0, -18, 30, 20), '#f0ad62', '#c97e3c', 4);
  glint(-14, -28, 8, 4, .4);
  for (const sx of [-1, 1]) obj(E_(sx * 13, -4, 9, 6), '#f0ad62', '#c97e3c', 3);
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 21 - 2, -54); X.lineTo(sx * 20, -80); X.lineTo(sx * 4, -62); X.closePath(); ink('#f0ad62', 3.5); X.beginPath(); X.moveTo(sx * 17, -58); X.lineTo(sx * 17.5, -73); X.lineTo(sx * 8, -62); X.closePath(); X.fillStyle = '#ffb3c1'; X.fill(); }
  obj(E_(-1, -46, 24, 21), '#f0ad62', '#c97e3c', 4);
  X.strokeStyle = '#b86a2c'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-1, -66); X.lineTo(-1, -58); X.moveTo(-9, -65); X.lineTo(-7, -58); X.moveTo(7, -65); X.lineTo(5, -58); X.stroke();
  glint(-12, -56, 7, 3.5, .45);
  eye(-11, -48, 6.5, look, mood, T, 1); eye(9, -48, 6.5, look, mood, T, 2);
  if (mood === 'panic') { brow(-11, -58, 10, .35, 3); brow(9, -58, 10, -.35, 3); drop(20 + Math.sin(T * 9) * 1.5, -60 + (T * 20 % 12), .9, .9); }
  X.beginPath(); X.moveTo(-4, -40); X.lineTo(2, -40); X.lineTo(-1, -36); X.closePath(); ink('#ff8fa6', 1.5);
  X.lineWidth = 2.5; X.strokeStyle = INK; X.beginPath(); X.moveTo(-1, -36); X.lineTo(-1, -34); X.moveTo(-7, -33); X.quadraticCurveTo(-4, -31, -1, -34); X.quadraticCurveTo(2, -31, 5, -33); X.stroke();
  X.strokeStyle = 'rgba(20,16,28,.55)'; X.lineWidth = 1.8; for (const sx of [-1, 1]) for (const k of [-3, 3]) { X.beginPath(); X.moveTo(sx * 12, -37 + k * .4); X.lineTo(sx * 30, -39 + k * 2.4); X.stroke(); }
  X.fillStyle = 'rgba(255,110,140,.5)'; for (const sx of [-1, 1]) { el(sx * 17 - 1, -41, 5, 3); X.fill(); }
  if (tangle) for (let i = 0; i < 4; i++) { el(-1, -34 - i * 4, 36 - i * 3, 24, i * .55 - .8); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = CORAL; X.stroke(); }
  X.restore();
}
function yarn(x, y, r, spin) {
  obj(C_(x, y, r), CORAL, '#d94a4a', 3.5);
  X.save(); C_(x, y, r)(); X.clip(); X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { X.beginPath(); X.ellipse(x, y, r * (1 - Math.abs(i) * .15), r * .5, spin + i * .5, 0, TAU); X.stroke(); }
  X.restore(); glint(x - r * .35, y - r * .4, r * .3, r * .18, .5);
}

/* 1 SEW EASY: drag the needle along the dashed line to stitch it.  Place: the tailor's table; a cat guards the yarn. */
function lnNeedle(x, y, a) {   // tip at x,y
  X.save(); X.translate(x, y); X.rotate(a); X.lineCap = 'round';
  X.strokeStyle = INK; X.lineWidth = 14; X.beginPath(); X.moveTo(-84, 0); X.lineTo(0, 0); X.stroke();
  X.strokeStyle = '#dfe6f5'; X.lineWidth = 8; X.stroke(); X.strokeStyle = '#9aa7c4'; X.lineWidth = 3; X.beginPath(); X.moveTo(-82, 2.5); X.lineTo(-2, 2.5); X.stroke();
  X.strokeStyle = '#fff'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-76, -2); X.lineTo(-10, -2); X.stroke();
  el(-72, 0, 9, 4.2); ink('#dfe6f5', 2.5); el(-72, 0, 5.5, 1.8); X.fillStyle = INK; X.fill();
  X.restore(); X.lineCap = 'butt';
}
let SEWBG = null, SEWW = -1;
function sewBg() {
  if (SEWBG && SEWW === VW) return SEWBG; SEWW = VW;
  return SEWBG = bake(() => {
    const L = -OX - 2, Rt = W + OX + 2;
    let g = X.createLinearGradient(0, 0, 0, 134); g.addColorStop(0, '#e6a86a'); g.addColorStop(1, '#ffe0a8'); X.fillStyle = g; X.fillRect(L, 0, Rt - L, 136);
    X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = L; x < Rt; x += 44) X.fillRect(x, 0, 22, 136);
    wallDots(L, Rt, 6, 130, 'rgba(255,120,150,.4)', 44);
    // shelf with spools (centre of the wall, clear of the hint and the lives box)
    obj(R_(318, 110, 190, 16, 4), '#d9944f', '#a5622c', 3.5);
    [['#ff6b6b', 336], ['#35D0E8', 372], ['#8DF06B', 408], ['#9B6BFF', 444], ['#FFC93C', 480]].forEach(([c, sx], i) => {
      const h = 34 + hr(i + 3) * 8, y0 = 110 - h;
      obj(R_(sx - 13, y0, 26, h, 5), '#f4d9a8', '#cfa56a', 3);
      X.save(); rr(sx - 13, y0 + 7, 26, h - 14, 2); X.clip(); X.fillStyle = c; X.fillRect(sx - 14, y0 + 7, 28, h - 14); X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(sx + 3, y0 + 7, 10, h - 14); X.restore();
      glint(sx - 6, y0 + 12, 2.5, 7, .5, 0);
    });
    // window
    obj(R_(556, 66, 96, 58, 8), '#9fe0ff', '#7ac4ee', 4);
    X.save(); rr(556, 66, 96, 58, 8); X.clip(); cloud(566, 100, .6, '#6ab0d8'); X.restore();
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(604, 66); X.lineTo(604, 124); X.moveTo(556, 95); X.lineTo(652, 95); X.stroke();
    // table top: planks, INK edge
    g = X.createLinearGradient(0, 134, 0, 600); g.addColorStop(0, '#b97a46'); g.addColorStop(1, '#8a5530'); X.fillStyle = g; X.fillRect(L, 134, Rt - L, 470);
    X.fillStyle = 'rgba(255,255,255,.1)'; for (let y = 134; y < 600; y += 62) X.fillRect(L, y + 2, Rt - L, 14);
    X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = 3; for (let y = 196; y < 600; y += 62) { X.beginPath(); X.moveTo(L, y); X.lineTo(Rt, y); X.stroke(); }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 134); X.lineTo(Rt, 134); X.stroke();
    // the denim: a drop shadow, the cloth, a stitched border, weave
    rr(46, 148, 720, 340, 30); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
    obj(R_(40, 140, 720, 340, 30), '#6a9ae0', '#4a72b8', 5, -5, -7);
    X.save(); rr(40, 140, 720, 340, 30); X.clip(); X.strokeStyle = 'rgba(255,255,255,.07)'; X.lineWidth = 3;
    for (let i = -400; i < 800; i += 14) { X.beginPath(); X.moveTo(i, 140); X.lineTo(i + 340, 480); X.stroke(); } X.restore();
    glint(130, 175, 70, 10, .22, -.12);
    X.setLineDash([9, 8]); rr(56, 156, 688, 308, 22); X.strokeStyle = 'rgba(230,240,255,.75)'; X.lineWidth = 3; X.stroke(); X.setLineDash([]);
    // pins in the corners
    for (const [px, py, c] of [[66, 168, '#ff6b6b'], [734, 168, '#FFC93C'], [66, 454, '#35D0E8'], [734, 454, '#8DF06B']]) {
      line([[px, py], [px + 14, py + 14]], 3, '#dfe6f5'); X.beginPath(); X.arc(px, py, 7, 0, TAU); ink(c, 3); glint(px - 2, py - 2, 2.5, 1.8, .6);
    }
    // pincushion (tomato) and scissors at the bottom of the table
    obj(E_(212, 522, 26, 18), '#ff5c5c', '#c93a3a', 4); glint(204, 514, 8, 4, .5);
    for (let i = 0; i < 5; i++) { const a = -2.4 + i * .5, px = 212 + Math.cos(a) * 15, py = 520 + Math.sin(a) * 10; line([[px, py], [px + Math.cos(a) * 14, py + Math.sin(a) * 14]], 2, '#dfe6f5'); X.beginPath(); X.arc(px + Math.cos(a) * 15, py + Math.sin(a) * 15, 3.5, 0, TAU); ink(['#ffd23f', '#35D0E8', '#fff', '#8DF06B', '#ff8ad8'][i], 1.8); }
    for (const sg of [-1, 1]) { line([[612, 530], [642 + sg * 6, 504 - sg * 3]], 8, '#dfe6f5'); X.beginPath(); X.arc(606 - sg * 4, 540 + sg * 4, 9, 0, TAU); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#e8434f'; X.stroke(); }
    X.beginPath(); X.arc(620, 522, 3, 0, TAU); ink('#ffd23f', 1.5);
  });
}
function lnSew(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, TOL = Math.max(34, 42 - 5 * (rs - 1));
  const dir = Math.random() < .5 ? 1 : -1, amp = 68 + 16 * Math.min(rs, 1.8);
  const path = lnPath(u => [90 + 620 * u, 310 + dir * amp * Math.sin(u * Math.PI * 2)]);
  const tool = lnTool(90, 310, 900, 340);
  let c = 0, prog = 0, stitch = 0, off = 0;
  const g = {
    cmd: 'SEW!', hint: 'DRAG THE NEEDLE ALONG THE LINE (OR ARROWS)', thint: 'DRAG THE NEEDLE ALONG THE LINE', dur: 5.8,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt; if (g.result) return;
      tool.step(dt);
      const nr = path.near(tool.x, tool.y, Math.max(0, prog - 25), prog + 90);
      if (nr.d <= TOL) { off = 0; if (nr.s > prog) prog = nr.s; } else off += dt;
      const st = Math.floor(prog / 48); if (st !== stitch) { stitch = st; sfx.tickHi(); }
      if (prog >= path.len - 10) { g.result = 'win'; g._r0 = now; lnWin('STITCHED!'); }
      else if (c >= D - .03) { g.result = 'lose'; g._r0 = now; lnLose('UNRAVELED!'); }
    },
    draw(t) {
      X = ctx; ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H); ctx.drawImage(sewBg(), -OX, 0);
      const o = oT(g), win = g.result === 'win', lose = g.result === 'lose';
      ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
      ctx.setLineDash([16, 14]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 5; path.stroke(0, path.len);
      const pr = lose ? prog * (1 - ease(o / .7)) : prog;
      ctx.setLineDash([22, 12]); ctx.strokeStyle = INK; ctx.lineWidth = 13; path.stroke(0, pr);
      ctx.strokeStyle = CORAL; ctx.lineWidth = 8; path.stroke(0, pr);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2.5; path.stroke(0, pr); ctx.setLineDash([]);
      const e = path.at(path.len), p0 = path.at(0);
      circ(p0.x, p0.y, 11 + Math.sin(now * 6) * 2, AMB, 4); circ(e.x, e.y, 11, LIME, 4);
      glint(p0.x - 3, p0.y - 4, 3, 2, .6); glint(e.x - 3, e.y - 4, 3, 2, .6);
      const a0 = path.at(prog - 8), a1 = path.at(prog + 8), ang = Math.atan2(a1.y - a0.y, a1.x - a0.x);
      // thread from the last stitch to the needle's eye, with a little slack
      const pe = path.at(pr), ex = tool.x - Math.cos(ang) * 72, ey = tool.y - Math.sin(ang) * 72;
      line([[pe.x, pe.y], [(pe.x + ex) / 2, (pe.y + ey) / 2 + 8 + (lose ? Math.sin(o * 10) * 6 : 0)], [ex, ey]], 3, CORAL);
      lnNeedle(tool.x, tool.y, ang);
      if (!g.result && off > .15) { ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tool.x, tool.y, 26 + Math.sin(now * 20) * 3, 0, 7); ctx.stroke(); }
      if (!g.result && !tool.used) ringHint(p0.x, p0.y, 30);
      if (lose) for (let i = 0; i < 5; i++) {   // the unravelled thread piles up in loops
        const k = ease((o - i * .06) / .5); if (k <= 0) continue;
        el(tool.x - 18 + i * 9, tool.y + 26 - i * 2, 16 + i * 2, 8 + i, i * .6); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = CORAL; X.globalAlpha = k; X.stroke(); X.globalAlpha = 1;
      }
      if (win) {
        for (let i = 0; i < 12; i++) { const q = path.at(path.len * ((i / 12 + now * .6) % 1)); spark(q.x, q.y - 10, 7 + Math.sin(now * 12 + i) * 3, '#fff', .9); }
        const hk = outBack(o / .4); if (hk > 0) heart(e.x + 30, e.y - 34 - Math.sin(o * 6) * 3, 1.5 * hk);
      }
      // cat + yarn guard the thread; the cat follows the needle and reacts
      const look = [clamp((tool.x - 100) / 300, -1, 1), clamp((tool.y - 480) / 200, -1, 1)];
      const cm = win ? 'happy' : lose ? 'dead' : off > .15 ? 'panic' : null;
      cat(100, 538, cm, look, now, lose);
      yarn(160, 526, 14, now * (lose ? 0 : .5));
      if (win) for (let i = 0; i < 3; i++) { const k = (o * .9 + i / 3) % 1; heart(112 + Math.sin(k * 6 + i) * 14, 470 - k * 50, .8 * (1 - k * .5)); }
      meter(250, 516, 300, prog / path.len, CORAL, 'STITCHES');
      hero(g, 720, 534, 4.6);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_sew', lnSew, 'Sew Easy');

/* 2 ROAD WORK: drag the paver along the route and stay ahead of the roller.  Place: a cow pasture being paved. */
function cow(x, y, s, mood, look, T, k, flip) {   // y = hooves, faces left (flip = -1 faces right)
  X.save(); X.translate(x, y); X.scale(s * flip, s);
  line([[34, -44], [44, -36], [42, -22]], 5, '#3b3550');
  for (const lx of [-24, -10, 12, 26]) obj(R_(lx - 5, -20, 10, 20, 4), '#fff', '#cdd5ea', 3);
  for (const lx of [-24, -10, 12, 26]) { X.fillStyle = INK; X.fillRect(lx - 4, -4, 8, 4); }
  obj(E_(0, -38, 40, 24), '#fff', '#cdd5ea', 4);
  X.save(); el(0, -38, 40, 24); X.clip(); X.fillStyle = '#3b3550'; el(-14, -46, 11, 8, .3); X.fill(); el(14, -30, 13, 9, .5); X.fill(); el(30, -48, 8, 6); X.fill(); X.restore();
  glint(-16, -50, 9, 4, .5);
  obj(E_(-42, -48, 19, 17), '#fff', '#cdd5ea', 4);
  X.fillStyle = '#3b3550'; el(-34, -60, 7, 5, .5); X.fill();
  obj(E_(-34, -58, 7, 5, -.5), '#fff', '#cdd5ea', 2.5); obj(E_(-56, -56, 7, 5, .5), '#fff', '#cdd5ea', 2.5);
  const chew = Math.sin(T * 9 + k) * (mood ? 0 : 1.6);
  obj(E_(-52, -40 + chew, 13, 9.5), '#ffb3c1', '#e68aa0', 3);
  X.fillStyle = INK; el(-56, -42 + chew, 1.8, 2.4); X.fill(); el(-48, -42 + chew, 1.8, 2.4); X.fill();
  eye(-45, -55, 4.8, look, mood, T, k); eye(-33, -55, 4.8, look, mood, T, k + 1);
  if (mood === 'panic') { brow(-45, -63, 8, .35, 2.5); brow(-33, -63, 8, -.35, 2.5); drop(-24, -62 + (T * 22 + k * 5) % 12, .8, .9); }
  if (mood === 'happy') { X.fillStyle = 'rgba(255,110,140,.5)'; el(-50, -48, 4, 2.5); X.fill(); }
  // hard hat
  X.beginPath(); X.arc(-39, -66, 12, Math.PI, TAU); X.closePath(); ink('#ffc93c', 3); rr(-53, -67, 28, 5, 2); ink('#ffc93c', 2.5); glint(-44, -73, 4, 2, .6);
  X.restore();
}
function cone(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s);
  obj(R_(-15, -3, 30, 7, 3), '#3b3550', '#241f33', 2.5);
  X.beginPath(); X.moveTo(-10, -3); X.lineTo(-4, -34); X.lineTo(4, -34); X.lineTo(10, -3); X.closePath(); ink('#ff8a2a', 3);
  X.save(); X.beginPath(); X.moveTo(-10, -3); X.lineTo(-4, -34); X.lineTo(4, -34); X.lineTo(10, -3); X.closePath(); X.clip(); X.fillStyle = '#fff'; X.fillRect(-12, -22, 24, 6); X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(2, -36, 12, 36); X.restore();
  glint(-4, -24, 1.6, 6, .5, .2);
  X.restore();
}
let ROADBG = null, ROADW = -1;
function roadBg() {
  if (ROADBG && ROADW === VW) return ROADBG; ROADW = VW;
  return ROADBG = bake(() => {
    const L = -OX - 2, Rt = W + OX + 2, HZ = 86;
    let g = X.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#36b0ea'); g.addColorStop(.6, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, Rt - L, HZ + 4);
    X.save(); X.beginPath(); X.rect(L, 0, Rt - L, HZ); X.clip(); X.beginPath(); X.arc(300, 78, 20, 0, TAU); ink('#ffe14d', 4); glint(293, 70, 7, 4.5, .6); X.restore();
    X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(L, HZ); for (let x = L; x <= Rt + 20; x += 20) X.lineTo(x, 58 - Math.sin(x * .011 + 1) * 10 - Math.sin(x * .027) * 4); X.lineTo(Rt, HZ); X.closePath(); X.fill();
    for (const [tx, ty, r] of [[60, 66, 12], [92, 70, 8], [560, 66, 11], [716, 68, 13], [-100, 68, 12], [900, 68, 12]]) {
      X.fillStyle = '#8a5a34'; X.fillRect(tx - 3, ty, 6, 12); X.beginPath(); X.arc(tx, ty, r, 0, TAU); ink('#3fb260', 2.5, '#2f7a49'); glint(tx - r * .3, ty - r * .35, r * .35, r * .22, .35);
    }
    g = X.createLinearGradient(0, HZ, 0, 600); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(L, HZ, Rt - L, 520);
    X.strokeStyle = 'rgba(255,255,255,.12)'; X.lineWidth = 16; for (let i = -6; i < 24; i++) { X.beginPath(); X.moveTo(L + i * 70, 600); X.lineTo(L + i * 70 + 160, HZ); X.stroke(); }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, HZ); X.lineTo(Rt, HZ); X.stroke();
    // fence along the horizon, with a gap where the road leaves the pasture
    for (let x = L + 8; x < Rt; x += 44) { if (x > 176 && x < 624) continue; obj(R_(x - 5, HZ - 2, 10, 22, 3), '#e3a868', '#c4874e', 2.5); }
    X.fillStyle = '#e3a868'; for (const [a, b] of [[L, 176], [624, Rt]]) { rr(a, HZ + 4, b - a, 5, 2); ink('#e3a868', 2); rr(a, HZ + 13, b - a, 5, 2); ink('#e3a868', 2); }
    for (let i = 0; i < 46; i++) { const x = L + hr(i) * (Rt - L), y = 130 + hr(i + 70) * 410; if (Math.abs(x - 400) < 230 && y > 120) continue; if (i % 3) tuft(x, y); else { X.beginPath(); X.arc(x, y, 4, 0, TAU); ink(['#fff', '#ffd23f', '#ff8ad8'][i % 3 + (i % 2)] || '#fff', 1.8); } }
    // cones by the finish
    cone(332, 540, 1); cone(468, 540, 1); cone(700, 538, 1.2);
  });
}
function lnRoad(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, TOL = 56, dir = Math.random() < .5 ? 1 : -1;
  const path = lnPath(u => [400 + dir * 165 * Math.sin(u * Math.PI * 2), 135 + 390 * u]);
  const tool = lnTool(path.at(0).x, path.at(0).y, 900, 340, 60, 740, 118, 545);
  const RV = path.len / D * .72;
  let c = 0, prog = 0, roll = -130, stitch = 0;
  const g = {
    cmd: 'PAVE!', hint: 'DRAG THE PAVER, OUTRUN THE ROLLER (OR ARROWS)', thint: 'DRAG THE PAVER, OUTRUN THE ROLLER', dur: 5.8,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt; if (g.result) return;
      tool.step(dt);
      const nr = path.near(tool.x, tool.y, Math.max(0, prog - 25), prog + 90);
      if (nr.d <= TOL && nr.s > prog) prog = nr.s;
      const st = Math.floor(prog / 60); if (st !== stitch) { stitch = st; sfx.tick(); }
      if (c > 1) roll += RV * dt;
      if (prog >= path.len - 10) { g.result = 'win'; g._r0 = now; lnWin('PAVED!'); }
      else if (roll >= prog - 6 && c > 1) { g.result = 'lose'; g._r0 = now; g._why = 'sq'; lnLose('SQUASHED!'); }
      else if (c >= D - .03) { g.result = 'lose'; g._r0 = now; g._why = 'slow'; lnLose('TOO SLOW!'); }
    },
    draw(t) {
      X = ctx; ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H); ctx.drawImage(roadBg(), -OX, 0);
      const o = oT(g), win = g.result === 'win', lose = g.result === 'lose', sq = lose && g._why === 'sq';
      // drifting clouds + the finish flags
      for (const [sx, sy, s] of [[0, 40, .8], [460, 62, .6]]) cloud((now * 7 + sx) % 1000 - 140, sy, s, '#3c6fb4');
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 86; path.stroke(0, path.len);
      ctx.strokeStyle = '#a97f52'; ctx.lineWidth = 76; path.stroke(0, path.len);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 6; ctx.save(); ctx.translate(-7, -2); path.stroke(0, path.len); ctx.restore();
      ctx.setLineDash([14, 16]); ctx.lineCap = 'butt'; ctx.strokeStyle = AMB; ctx.lineWidth = 5; path.stroke(0, path.len); ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 86; path.stroke(0, prog);
      ctx.strokeStyle = '#4a5080'; ctx.lineWidth = 76; path.stroke(0, prog);
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 6; ctx.save(); ctx.translate(-7, -2); path.stroke(0, prog); ctx.restore();
      ctx.setLineDash([16, 14]); ctx.lineCap = 'butt'; ctx.strokeStyle = AMB; ctx.lineWidth = 6; path.stroke(0, prog); ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      const e = path.at(path.len); rr(e.x - 44, e.y - 7, 88, 14, 4); ink('#fff', 3);
      X.save(); rr(e.x - 44, e.y - 7, 88, 14, 4); X.clip(); X.fillStyle = INK; for (let i = 0; i < 8; i++) X.fillRect(e.x - 44 + i * 11, e.y - 7 + (i & 1) * 7, 11, 7); X.restore();
      for (const sx of [-1, 1]) {   // finish flags
        const px = e.x + sx * 78, py = e.y - 8, wv = Math.sin(now * (win ? 12 : 4) + sx) * (win ? 6 : 3);
        line([[px, py + 22], [px, py - 30]], 3, '#e8e8f0');
        X.beginPath(); X.moveTo(px, py - 30); X.quadraticCurveTo(px + sx * 14, py - 34 + wv, px + sx * 28, py - 24); X.quadraticCurveTo(px + sx * 14, py - 22 + wv, px, py - 12); X.closePath(); ink(sx < 0 ? '#ff4d5e' : AMB, 2.5);
      }
      // the audience: two cows in hard hats, and a snail
      const gapNow = prog - roll, cmood = win ? 'happy' : lose ? 'happy' : (c > .3 && gapNow < 150) ? 'panic' : null;
      cow(112, 336, .9, cmood, [clamp((tool.x - 112) / 300, -1, 1), clamp((tool.y - 300) / 200, -1, 1)], now, 1, -1);
      cow(690, 430, .85, cmood, [clamp((tool.x - 690) / 300, -1, 1), clamp((tool.y - 400) / 200, -1, 1)], now, 3, 1);
      if (win) for (const [hx, hy] of [[130, 276], [670, 372]]) for (let i = 0; i < 2; i++) { const k = (o * .9 + i / 2) % 1; heart(hx + i * 14 + Math.sin(k * 6) * 8, hy - k * 46, .75 * (1 - k * .4)); }
      { const sx = 100 + 55 * Math.sin(now * .35), fl = Math.cos(now * .35) > 0 ? 1 : -1;
        X.save(); X.translate(sx, 538); X.scale(fl, 1); line([[-14, 0], [12, 0]], 7, '#e8c9a0'); obj(C_(-2, -9, 9), '#ff8ad8', '#c95fa0', 2.5); X.beginPath(); X.moveTo(12, -2); X.lineTo(16, -14); X.moveTo(15, -1); X.lineTo(22, -11); X.lineWidth = 2.2; X.strokeStyle = INK; X.stroke(); X.restore(); }
      // roller: a grumpy steamroller with a face
      const rp = roll < 0 ? { x: path.at(0).x, y: path.at(0).y + roll } : path.at(roll);
      if (c > .2 && rp.y > 90) {
        shadow(rp.x, rp.y + 36, 52, 10, .3);
        X.save(); X.translate(rp.x, rp.y);
        obj(R_(-48, 6, 96, 32, 14), '#cfd6e6', '#8f9cb3', 4); glint(-24, 14, 18, 4, .5, 0);
        X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 2.5; for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(i * 13, 8); X.lineTo(i * 13, 36); X.stroke(); }
        obj(R_(14, -56, 14, 22, 3), '#555d8c', '#3b3550', 3);
        for (let i = 0; i < 3; i++) { const k = (now * .9 + i / 3) % 1; X.globalAlpha = .6 * (1 - k); X.beginPath(); X.arc(21 + Math.sin(k * 7 + i) * 6, -62 - k * 36, 6 + k * 9, 0, TAU); X.fillStyle = '#e8ecff'; X.fill(); }
        X.globalAlpha = 1;
        obj(R_(-34, -36, 68, 46, 12), CORAL, '#c93a3a', 4); glint(-22, -28, 12, 4, .45);
        const rm = win ? 'sad' : lose ? 'smug' : gapNow < 150 ? 'grin' : 'grump';
        eye(-14, -16, 7.5, [0, .5], rm === 'sad' ? 'sleepy' : rm === 'smug' ? 'happy' : null, now, 5); eye(14, -16, 7.5, [0, .5], rm === 'sad' ? 'sleepy' : rm === 'smug' ? 'happy' : null, now, 6);
        if (rm !== 'smug' && rm !== 'sad') { brow(-14, -28, 15, .42, 4.5); brow(14, -28, 15, -.42, 4.5); }
        if (rm === 'grin' || rm === 'smug') { mouth(0, -2, 22, 'laugh', 3); X.fillStyle = '#fff'; X.fillRect(-9, -4, 18, 3); } else mouth(0, 0, 18, rm === 'sad' ? 'frown' : 'flat', 4);
        if (rm === 'sad') drop(-20, -4 + (now * 18 % 14), .9);
        X.restore();
      }
      if (!g.result && c > .3 && gapNow < 150 && Math.sin(now * 16) > 0) txt('!', Math.min(740, tool.x + 62), tool.y - 44, 44, AMB);
      // paver, with Caos at the wheel
      { const k = sq ? ease(o / .22) : 0, bnc = win ? Math.abs(Math.sin(o * 9)) * 9 : 0;
        shadow(tool.x, tool.y + 28, 42, 9, .3);
        X.save(); X.translate(tool.x, tool.y + 26); X.scale(1 + k * .3, 1 - k * .8); X.translate(0, -26 - bnc);
        for (const sx of [-1, 1]) obj(R_(sx * 40 - 8, -8, 16, 34, 6), '#3b3550', '#241f33', 3);
        X.beginPath(); X.moveTo(-30, -26); X.lineTo(-22, -48); X.lineTo(22, -48); X.lineTo(30, -26); X.closePath(); ink('#d9deea', 3.5);
        X.fillStyle = '#3b3550'; for (let i = 0; i < 4; i++) { el(-14 + i * 9, -42 + (i & 1) * 3, 5, 3.5); X.fill(); }
        obj(R_(-40, -26, 80, 46, 10), AMB, '#d99a1a', 4); glint(-24, -19, 14, 4, .5);
        X.save(); rr(-40, -26, 80, 46, 10); X.clip(); X.fillStyle = INK; for (let i = 0; i < 8; i++) X.fillRect(-40 + i * 11, 8, 6, 12); X.restore();
        for (const sx of [-1, 1]) { X.beginPath(); X.arc(sx * 28, -4, 5, 0, TAU); ink('#fffbe0', 2.5); }
        if (!sq) { caos(0, -12, 2.5, { mood: lnMood(g) }); X.beginPath(); X.arc(0, -35, 11, Math.PI, TAU); X.closePath(); ink('#ffc93c', 3); rr(-14, -36, 28, 5, 2); ink('#ffc93c', 2.5); }
        X.restore();
        if (sq) {   // flattened: X eyes on the pancake and stars going round
          eye(tool.x - 10, tool.y + 14, 5, [0, 0], 'dead', now, 0); eye(tool.x + 10, tool.y + 14, 5, [0, 0], 'dead', now, 1);
          for (let i = 0; i < 3; i++) { const a = now * 6 + i * TAU / 3; star(tool.x + Math.cos(a) * 26, tool.y - 12 + Math.sin(a) * 8, 8, 3.5, 5, a, '#FFE14D', 2.5); }
        } else if (lose) { for (let i = 0; i < 3; i++) { const k2 = (o * 1.2 + i / 3) % 1; X.globalAlpha = .7 * (1 - k2); X.beginPath(); X.arc(tool.x + 30 + Math.sin(k2 * 6 + i) * 6, tool.y - 36 - k2 * 40, 6 + k2 * 10, 0, TAU); X.fillStyle = '#e8ecff'; X.fill(); X.globalAlpha = 1; } zee(tool.x + 34, tool.y - 50 - Math.sin(now * 3) * 3, 20, .95); }
      }
      if (!g.result && !tool.used) ringHint(tool.x, tool.y, 50);
      meter(44, 120, 150, prog / path.len, AMB, 'ROAD');
      vignette(.2);
    }
  };
  return g;
}
reg('ln_road', lnRoad, 'Road Work');

/* 3 HOOKIN' UP: drag the cable around the rocks and plug it into the socket.  Place: a desert where the boulders sleep. */
function cactus(x, y, s, flower) {
  X.save(); X.translate(x, y); X.scale(s, s);
  obj(R_(-9, -50, 18, 52, 9), '#4fc06a', '#2f8f4a', 3, -3, -3);
  obj(R_(-27, -36, 12, 8, 4), '#4fc06a', '#2f8f4a', 3); obj(R_(-27, -44, 10, 16, 5), '#4fc06a', '#2f8f4a', 3);
  obj(R_(15, -30, 12, 8, 4), '#4fc06a', '#2f8f4a', 3); obj(R_(18, -40, 10, 18, 5), '#4fc06a', '#2f8f4a', 3);
  if (flower) { X.beginPath(); X.arc(0, -54, 6, 0, TAU); ink('#ff8ad8', 2.5); X.beginPath(); X.arc(0, -54, 2.5, 0, TAU); X.fillStyle = '#ffd23f'; X.fill(); }
  X.restore();
}
function rockFace(x, y, r, mood, T, k) {   // sleeping boulder: eyes shut, Z; bumped: eyes open, ow
  const ey = y - r * .05, ex = r * .3, er = Math.max(4, r * .14);
  if (mood === 'bump') { eye(x - ex, ey, er * 1.2, [0, .3], 'panic', T, k); eye(x + ex, ey, er * 1.2, [0, .3], 'panic', T, k + 1); brow(x - ex, ey - er * 2, er * 2.2, .45, 3.5); brow(x + ex, ey - er * 2, er * 2.2, -.45, 3.5); mouth(x, ey + r * .3, r * .28, 'open', 3); }
  else if (mood === 'happy') { eye(x - ex, ey, er, [0, 0], 'happy', T, k); eye(x + ex, ey, er, [0, 0], 'happy', T, k); mouth(x, ey + r * .26, r * .4, 'laugh', 3); X.fillStyle = 'rgba(255,110,140,.5)'; for (const sx of [-1, 1]) { el(x + sx * r * .5, ey + r * .15, er * .9, er * .55); X.fill(); } }
  else { eye(x - ex, ey, er, [0, 0], 'sleepy', T, k); eye(x + ex, ey, er, [0, 0], 'sleepy', T, k); mouth(x, ey + r * .3, r * .22, 'flat', 3); }
}
let CABBG = null, CABW = -1;
function cableBg() {
  if (CABBG && CABW === VW) return CABBG; CABW = VW;
  return CABBG = bake(() => {
    const L = -OX - 2, Rt = W + OX + 2, HZ = 96;
    let g = X.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#ff9f6e'); g.addColorStop(.55, '#ffd29a'); g.addColorStop(1, '#fff0c8'); X.fillStyle = g; X.fillRect(L, 0, Rt - L, HZ + 4);
    X.save(); X.beginPath(); X.rect(L, 0, Rt - L, HZ); X.clip();
    for (let i = 0; i < 12; i++) { X.save(); X.translate(480, 84); X.rotate(i * TAU / 12); X.fillStyle = 'rgba(255,240,170,.35)'; X.beginPath(); X.moveTo(-6, 34); X.lineTo(6, 34); X.lineTo(0, 70); X.fill(); X.restore(); }
    X.beginPath(); X.arc(480, 84, 28, 0, TAU); ink('#ffe14d', 4); glint(472, 76, 9, 5, .6); X.restore();
    for (const [mx, mw, mh, c1, c2] of [[40, 190, 46, '#e8a07c', '#d3835e'], [250, 130, 34, '#dd8f6b', '#c8744f'], [610, 230, 50, '#e8a07c', '#d3835e']]) {
      X.beginPath(); X.moveTo(mx, HZ); X.lineTo(mx + 14, HZ - mh); X.lineTo(mx + mw - 16, HZ - mh); X.lineTo(mx + mw, HZ); X.closePath(); X.fillStyle = c1; X.fill(); X.strokeStyle = '#b8603f'; X.lineWidth = 3; X.lineJoin = 'round'; X.stroke();
      X.fillStyle = c2; X.fillRect(mx + mw * .55, HZ - mh + 3, mw * .45 - 14, mh - 3);
    }
    g = X.createLinearGradient(0, HZ, 0, 600); g.addColorStop(0, '#f8dc92'); g.addColorStop(1, '#e8bc6a'); X.fillStyle = g; X.fillRect(L, HZ, Rt - L, 520);
    X.strokeStyle = 'rgba(255,255,255,.2)'; X.lineWidth = 10; X.lineCap = 'round'; for (let i = 0; i < 9; i++) { const y = 150 + i * 48; X.beginPath(); X.moveTo(L + hr(i) * 400, y); X.quadraticCurveTo(L + 300 + hr(i + 9) * 300, y - 14, Rt - hr(i + 18) * 300, y + 4); X.stroke(); }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, HZ); X.lineTo(Rt, HZ); X.stroke();
    cactus(160, 118, .8, true); cactus(590, 116, .65, false); cactus(742, 122, .9, true);
    for (let i = 0; i < 30; i++) { const x = L + hr(i + 5) * (Rt - L), y = 130 + hr(i + 40) * 420; X.beginPath(); X.ellipse(x, y, 5 + hr(i) * 4, 3, 0, 0, TAU); ink('#d4a85a', 1.5, '#b98a42'); }
    for (let i = 0; i < 14; i++) tuft(L + hr(i + 90) * (Rt - L), 140 + hr(i + 120) * 400, '#8a9a3a');
  });
}
function lnCable(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, flip = Math.random() < .5 ? 1 : -1, jy = (Math.random() - .5) * 50;
  const Y = y => 345 + (y - 345) * flip;
  const A = { x: 96, y: Y(345 + jy) }, B = { x: 706, y: Y(345 - jy) };
  const rocks = [{ x: 400, y: Y(345 + (Math.random() - .5) * 30), r: 82 }, { x: 250, y: Y(425), r: 44 }, { x: 560, y: Y(265), r: 46 }];
  const MAXL = 1300, HR = 17;
  const tool = lnTool(A.x, A.y, 850, 330, 30, 770, 118, 545);
  const trail = [{ x: A.x, y: A.y }];
  let c = 0, bump = 0, used = 0, lastR = null;
  const fix = T => {
    for (const r of rocks) {
      const dx = T.x - r.x, dy = T.y - r.y, d = Math.hypot(dx, dy) || 1, m = r.r + HR;
      if (d < m) { T.x = r.x + dx / d * m; T.y = r.y + dy / d * m; lastR = r; if (bump <= 0) { bump = .25; sfx.tick(); } }
    }
  };
  const g = {
    cmd: 'PLUG IN!', hint: 'DRAG THE CABLE AROUND THE ROCKS TO THE SOCKET (OR ARROWS)', thint: 'DRAG THE CABLE AROUND THE ROCKS TO THE SOCKET', dur: 5.8,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt; bump = Math.max(0, bump - dt); if (g.result) return;
      tool.step(dt, fix);
      const last = trail[trail.length - 1];
      if (Math.hypot(tool.x - last.x, tool.y - last.y) > 9) trail.push({ x: tool.x, y: tool.y });
      if (trail.length > 2) { const pv = trail[trail.length - 2]; if (Math.hypot(tool.x - pv.x, tool.y - pv.y) < 7) trail.pop(); }
      used = 0; for (let i = 1; i < trail.length; i++) used += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
      used += Math.hypot(tool.x - trail[trail.length - 1].x, tool.y - trail[trail.length - 1].y);
      if (Math.hypot(tool.x - B.x, tool.y - B.y) < 36) {
        tool.x = B.x; tool.y = B.y; g.result = 'win'; g._r0 = now; sfx.zap(); lnWin('CONNECTED!'); burst(B.x, B.y - 80, AMB, 18);
      } else if (used > MAXL) { g.result = 'lose'; g._r0 = now; lnLose('OUT OF CABLE!'); }
      else if (c >= D - .03) { g.result = 'lose'; g._r0 = now; lnLose('TOO SLOW!'); }
    },
    draw(t) {
      X = ctx; ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H); ctx.drawImage(cableBg(), -OX, 0);
      const o = oT(g), win = g.result === 'win', lose = g.result === 'lose', on = win;
      for (const [sx, sy] of [[0, 40], [380, 58]]) cloud((now * 6 + sx) % 1000 - 140, sy, .7, '#e0907a');
      // a tumbleweed rolls through the foreground
      { const tx = (now * 34) % 1000 - 100, ty = 494; X.save(); X.translate(tx, ty); X.rotate(now * 2.4);
        X.strokeStyle = '#a07a3a'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = 0; i < 6; i++) { X.beginPath(); X.ellipse(0, 0, 18 - i * 1.5, 18 - ((i * 5) % 7), i * .6, 0, TAU); X.stroke(); }
        X.restore(); X.fillStyle = 'rgba(20,16,28,.2)'; el(tx, ty + 20, 18, 4); X.fill(); }
      // power box (generator) on the left, the lamp-post socket on the right
      { const gx = A.x - 66, gy = A.y - 34;
        shadow(gx + 30, gy + 74, 38, 8, .3);
        obj(R_(gx, gy, 56, 68, 8), '#e8434f', '#b5283a', 4); glint(gx + 14, gy + 12, 10, 4, .5);
        X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 3; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(gx + 8, gy + 48 + i * 6); X.lineTo(gx + 48, gy + 48 + i * 6); X.stroke(); }
        X.beginPath(); X.moveTo(gx + 30, gy + 8); X.lineTo(gx + 14, gy + 34); X.lineTo(gx + 26, gy + 34); X.lineTo(gx + 20, gy + 54); X.lineTo(gx + 44, gy + 26); X.lineTo(gx + 32, gy + 26); X.closePath(); ink('#ffd23f', 2.5);
        obj(R_(gx + 38, gy - 16, 10, 18, 3), '#8f9cb3', '#5d6aa3', 3);
        const sm = lose ? 1 : .35; for (let i = 0; i < 3; i++) { const k = (now * .8 + i / 3) % 1; X.globalAlpha = sm * (1 - k); X.beginPath(); X.arc(gx + 43 + Math.sin(k * 6 + i) * 6, gy - 22 - k * 40, 5 + k * 12, 0, TAU); X.fillStyle = lose ? '#8a8fa8' : '#e8ecff'; X.fill(); } X.globalAlpha = 1;
      }
      { shadow(B.x + 4, B.y + 100, 34, 8, .3);
        obj(R_(B.x - 11, B.y + 40, 22, 64, 5), '#d9944f', '#a5622c', 3.5);
        line([[B.x, B.y - 44], [B.x, B.y - 72]], 6, '#8f9cb3');
        obj(R_(B.x - 28, B.y - 46, 56, 92, 10), '#e6edff', '#a8b4d8', 4); glint(B.x - 14, B.y - 28, 8, 4, .6);
        X.fillStyle = INK; rr(B.x - 16, B.y - 12, 8, 24, 2); X.fill(); rr(B.x + 8, B.y - 12, 8, 24, 2); X.fill();
        X.fillStyle = INK; X.beginPath(); X.arc(B.x, B.y + 24, 4, 0, TAU); X.fill();
        if (on) { for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + now * .8; X.strokeStyle = 'rgba(255,225,77,.7)'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(B.x + Math.cos(a) * 28, B.y - 86 + Math.sin(a) * 28); X.lineTo(B.x + Math.cos(a) * (44 + Math.sin(now * 12 + i) * 6), B.y - 86 + Math.sin(a) * (44 + Math.sin(now * 12 + i) * 6)); X.stroke(); }
          X.fillStyle = 'rgba(255,201,60,.35)'; X.beginPath(); X.arc(B.x, B.y - 86, 50 + Math.sin(now * 12) * 4, 0, TAU); X.fill(); }
        obj(R_(B.x - 7, B.y - 74, 14, 8, 2), '#8f9cb3', '#5d6aa3', 2.5);
        X.beginPath(); X.arc(B.x, B.y - 88, 16, 0, TAU); ink(on ? '#fff3a0' : '#aab4dc', 4);
        if (!on) { X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 2; X.beginPath(); X.moveTo(B.x - 6, B.y - 80); X.lineTo(B.x - 3, B.y - 90); X.lineTo(B.x + 3, B.y - 90); X.lineTo(B.x + 6, B.y - 80); X.stroke(); }
        glint(B.x - 5, B.y - 94, 4, 2.5, .7);
      }
      if (!g.result && Math.sin(now * 6) > -.3) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(B.x, B.y, 56 + Math.sin(now * 6) * 4, 0, 7); ctx.stroke(); }
      // the sleeping boulders: bumped one wakes up grumpy
      rocks.forEach((r, i) => {
        const hop = win ? -Math.abs(Math.sin(o * 9 + i * 1.3)) * 12 : 0, bm = bump > 0 && lastR === r;
        const mood = win || lose ? 'happy' : bm ? 'bump' : null;
        shadow(r.x + 6, r.y + r.r - 6, r.r * .95 * (1 + hop / 120), r.r * .28, .3);
        X.save(); X.translate(0, hop);
        obj(C_(r.x, r.y, r.r), bm ? '#e0908e' : '#a699d0', bm ? '#b0605e' : '#756aa8', 5, -r.r * .1, -r.r * .12);
        glint(r.x - r.r * .38, r.y - r.r * .48, r.r * .3, r.r * .16, .45);
        X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(r.x + r.r * .42, r.y - r.r * .5); X.lineTo(r.x + r.r * .55, r.y - r.r * .25); X.lineTo(r.x + r.r * .46, r.y - r.r * .08); X.stroke();
        rockFace(r.x, r.y + r.r * .05, r.r, mood, now, i * 2);
        if (!g.result && !bm) zee(r.x + r.r * .62, r.y - r.r * .72 - (now * 14 + i * 9) % 10, Math.max(14, r.r * .3), .9);
        if (bm) for (let q = 0; q < 3; q++) { const a = now * 9 + q * TAU / 3; star(r.x + Math.cos(a) * r.r * .55, r.y - r.r - 8 + Math.sin(a) * 6, 7, 3, 5, a, '#FFE14D', 2.5); }
        X.restore();
      });
      // cable
      const cab = (col, w, ox = 0, oy = 0) => { X.beginPath(); X.moveTo(A.x + ox, A.y + oy); for (const p of trail) X.lineTo(p.x + ox, p.y + oy); X.lineTo(tool.x + ox, tool.y + oy); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
      cab(INK, 17); cab(CORAL, 9); cab('rgba(255,255,255,.4)', 2.5, -2, -2);
      // plug head
      X.save(); X.translate(tool.x, tool.y);
      for (const sy of [-1, 1]) { rr(2, sy * 8.5 - 3, 20, 6, 2); ink('#dfe6f5', 2.5); }
      obj(R_(-17, -16, 28, 32, 8), AMB, '#d99a1a', 4); glint(-9, -8, 5, 3, .6); X.restore();
      if (!g.result && !tool.used) ringHint(tool.x, tool.y, 32);
      if (win) for (let i = 0; i < 6; i++) { const q = ((o * 1.4 + i / 6) % 1); spark(lerp(A.x, B.x, q) + Math.sin(i * 3) * 30, lerp(A.y, B.y, q) - 40 + Math.sin(q * 9 + i) * 24, 8, '#fff3a0', 1 - q * .5); }
      const left = 1 - used / MAXL;
      meter(250, 516, 300, left, left < .25 ? RED : AMB, 'CABLE');
      hero(g, 90, 534, 4.6);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_cable', lnCable, "Hookin' Up");

/* 4 WHAT'S YOUR SIGN?: connect the numbered stars in order (tap them, or drag through them).  Place: a hilltop at night with a UFO and a sleepy moon. */
const starP = (x, y, ro, ri, rot) => () => { X.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / 5; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); };
let SGNBG = null, SGNW = -1;
function signBg() {
  if (SGNBG && SGNW === VW) return SGNBG; SGNW = VW;
  return SGNBG = bake(() => {
    const L = -OX - 2, Rt = W + OX + 2;
    let g = X.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, '#0b0726'); g.addColorStop(.55, '#1c0e46'); g.addColorStop(1, '#2f2a7c'); X.fillStyle = g; X.fillRect(L, 0, Rt - L, H);
    X.beginPath(); X.moveTo(L, 470); for (let x = L; x <= Rt + 20; x += 20) X.lineTo(x, 470 - Math.sin(x * .008 + 2) * 26 - Math.sin(x * .021) * 8); X.lineTo(Rt, 600); X.lineTo(L, 600); X.closePath(); X.fillStyle = '#221f66'; X.fill(); X.strokeStyle = '#3d3b94'; X.lineWidth = 4; X.lineJoin = 'round'; X.stroke();
    X.beginPath(); X.moveTo(L, 520); for (let x = L; x <= Rt + 20; x += 20) X.lineTo(x, 520 - Math.sin(x * .011 + .5) * 14); X.lineTo(Rt, 600); X.lineTo(L, 600); X.closePath(); X.fillStyle = '#2d2a86'; X.fill(); X.strokeStyle = '#5b5fa8'; X.lineWidth = 4; X.stroke();
    for (let i = 0; i < 18; i++) tuft(L + hr(i + 7) * (Rt - L), 548 + hr(i) * 30, '#4a4aa8');
    // a small telescope on the hill
    X.save(); X.translate(652, 528);
    for (const sx of [-1, 0, 1]) line([[0, 0], [sx * 16, 34]], 4, '#8f9cb3');
    X.rotate(-.8); obj(R_(-6, -10, 66, 20, 6), '#c9ced6', '#8f9cb3', 3.5); obj(R_(54, -13, 12, 26, 4), '#ffd23f', '#c99512', 3); glint(8, -5, 14, 2.5, .6, 0); X.restore();
  });
}
function lnSign(sp) {
  const rs = Math.sqrt(sp), D = 5.6 / rs, N = rs > 1.4 ? 6 : 5, R = 62;
  const pts = []; let md = 190;
  for (let i = 0; i < N; i++) {
    let p, k = 0;
    do { p = { x: 110 + Math.random() * 540, y: 170 + Math.random() * 310, ph: Math.random() * 6 }; k++; if (k % 40 === 0) md -= 15; }
    while (pts.some(q => Math.hypot(q.x - p.x, q.y - p.y) < md));
    pts.push(p);
  }
  const dust = []; for (let i = 0; i < 40; i++) dust.push([Math.random() * W, Math.random() * H, Math.random() * 6]);
  let c = 0, nxt = 0, strikes = 0, held = false, ptr = { x: 400, y: 300 };
  const hit = (p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y) <= R;
  const connect = () => {
    const s = pts[nxt]; sfx.blip(nxt * 2); sfx.sparkle(); burst(s.x, s.y, AMB, 12); ring(s.x, s.y, '#fff', 70, .35); nxt++;
    if (nxt >= N) { g.result = 'win'; g._r0 = now; lnWin('CONSTELLATION!'); }
  };
  const strike = i => {
    strikes++; sfx.miss(); shake(4, .15); floatText('WRONG STAR!', pts[i].x, pts[i].y - 56, RED, 30);
    if (strikes >= 3) { g.result = 'lose'; g._r0 = now; lnLose('LOST IN SPACE!'); }
  };
  const g = {
    cmd: 'CONNECT!', hint: 'CLICK THE STARS IN ORDER (OR PRESS THEIR NUMBERS)', thint: 'TAP OR DRAG THROUGH THE STARS IN ORDER', dur: 5.6,
    down(p) {
      held = true; ptr = p; if (g.result) return;
      if (hit(p, nxt)) connect(); else for (let i = nxt + 1; i < N; i++) if (hit(p, i)) { strike(i); break; }
    },
    move(p) { ptr = p; if (!held || g.result) return; if (nxt < N && hit(p, nxt)) connect(); },
    up() { held = false; },
    key(e) {
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || ''); if (!m || e.repeat || g.result) return;
      const n = +m[1] - 1; if (n < 0 || n >= N) return;
      if (n === nxt) connect(); else if (n > nxt) strike(n);
    },
    keyup() {},
    update(dt) {
      c += dt; if (g.result) return;
      if (c >= D - .03) { g.result = 'lose'; g._r0 = now; lnLose('TOO SLOW!'); }
    },
    draw(t) {
      X = ctx; ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H); ctx.drawImage(signBg(), -OX, 0);
      const o = oT(g), win = g.result === 'win', lose = g.result === 'lose';
      for (const d of dust) { ctx.globalAlpha = .35 + .35 * Math.sin(now * 2 + d[2]); ctx.fillStyle = '#fff'; ctx.fillRect(d[0], d[1], 3, 3); }
      ctx.globalAlpha = 1;
      // the moon (far layer: no ink) follows the next star with its eyes
      { const mx = 90, my = 124, nt = pts[Math.min(nxt, N - 1)], lk = [clamp((nt.x - mx) / 300, -1, 1), clamp((nt.y - my) / 300, -1, 1)];
        X.fillStyle = 'rgba(255,248,190,.14)'; X.beginPath(); X.arc(mx, my, 56, 0, TAU); X.fill();
        X.beginPath(); X.arc(mx, my, 36, 0, TAU); X.fillStyle = '#f3efc4'; X.fill(); X.lineWidth = 4; X.strokeStyle = '#bdb7ff'; X.stroke();
        X.fillStyle = '#e0d9a0'; for (const [cx2, cy2, cr] of [[mx + 18, my - 16, 6], [mx - 22, my + 14, 5], [mx + 14, my + 22, 4]]) { X.beginPath(); X.arc(cx2, my + (cy2 - my), cr, 0, TAU); X.fill(); }
        const mm = win ? 'happy' : lose ? 'sleepy' : strikes >= 2 ? 'panic' : null;
        eye(mx - 12, my - 4, 6, lk, mm, now, 1); eye(mx + 10, my - 4, 6, lk, mm, now, 2);
        mouth(mx - 1, my + 16, 14, win ? 'laugh' : lose ? 'frown' : strikes >= 2 ? 'wavy' : 'smile', 3);
        X.fillStyle = 'rgba(255,120,150,.4)'; el(mx - 21, my + 8, 5, 3); X.fill(); el(mx + 19, my + 8, 5, 3); X.fill();
        if (lose) drop(mx - 14, my + 8 + (now * 24 % 22), 1, .9);
      }
      // a UFO drifts across the sky
      { const ux = (now * 24) % 1100 - 130, uy = 96 + Math.sin(now * 1.3) * 8;
        el(ux, uy + 4, 40, 11); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
        X.beginPath(); X.arc(ux, uy - 4, 17, Math.PI, TAU); ink('#bfeaff', 3); glint(ux - 6, uy - 14, 5, 2.5, .7);
        el(ux, uy + 2, 42, 11); ink('#c9ced6', 3.5); X.save(); el(ux, uy + 2, 42, 11); X.clip(); X.fillStyle = '#8f9cb3'; X.fillRect(ux - 44, uy + 6, 90, 8); X.restore();
        for (let i = -2; i <= 2; i++) { X.beginPath(); X.arc(ux + i * 15, uy + 3 + Math.abs(i) * .6, 3, 0, TAU); X.fillStyle = Math.sin(now * 8 + i) > 0 ? '#ffd23f' : '#ff5c8a'; X.fill(); }
        eye(ux - 4, uy - 6, 2.8, [.3, 0], null, now, 3); eye(ux + 5, uy - 6, 2.8, [.3, 0], null, now, 4);
      }
      X.lineCap = 'round'; X.lineJoin = 'round';
      const seg = (a, b, w1, w2, col) => { X.lineWidth = w1; X.strokeStyle = INK; X.beginPath(); X.moveTo(a.x, a.y); X.lineTo(b.x, b.y); X.stroke(); X.lineWidth = w2; X.strokeStyle = col; X.stroke(); };
      const fall = i => lose ? Math.pow(Math.max(0, o - i * .05), 2) * 1100 : 0;
      for (let i = 0; i + 1 < nxt; i++) {
        X.globalAlpha = .25; X.lineWidth = 20; X.strokeStyle = CYAN; X.beginPath(); X.moveTo(pts[i].x, pts[i].y + fall(i)); X.lineTo(pts[i + 1].x, pts[i + 1].y + fall(i + 1)); X.stroke(); X.globalAlpha = 1;
        seg({ x: pts[i].x, y: pts[i].y + fall(i) }, { x: pts[i + 1].x, y: pts[i + 1].y + fall(i + 1) }, 12, 6, lose ? '#8f6b8f' : CYAN);
      }
      if (held && !g.result && nxt > 0 && nxt < N) { X.setLineDash([10, 12]); X.lineWidth = 5; X.strokeStyle = '#fff'; X.beginPath(); X.moveTo(pts[nxt - 1].x, pts[nxt - 1].y); X.lineTo(ptr.x, ptr.y); X.stroke(); X.setLineDash([]); }
      X.lineCap = 'butt';
      // Caos on the hill with the telescope
      hero(g, 730, 534, 4.6);
      for (let i = 0; i < N; i++) {
        const p = pts[i], done = i < nxt, isNext = i === nxt && !g.result, k = isNext ? 1 + Math.sin(now * 7) * .1 : 1, py = p.y + fall(i);
        if (win) { X.fillStyle = `rgba(255,225,77,${.22 + .1 * Math.sin(now * 8 + i)})`; X.beginPath(); X.arc(p.x, py, 64, 0, TAU); X.fill(); }
        if (!lose) { X.fillStyle = 'rgba(20,16,28,.25)'; el(p.x, p.y + 46, 28, 7); X.fill(); }
        const rot = -Math.PI / 2 + Math.sin(now + p.ph) * .08, dn = lose ? '#8f86a8' : '#ffd23f';
        obj(starP(p.x, py, 46 * k, 22 * k, rot), done ? dn : PAP, done ? (lose ? '#5d5578' : '#e0a010') : '#d9c9a0', 5, -4, -5);
        glint(p.x - 13, py - 16, 6, 3, .55);
        txt(String(i + 1), p.x, py + 4, 30, INK);
        if (isNext) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, py, 58 + Math.sin(now * 7) * 4, 0, 7); ctx.stroke(); }
      }
      if (win) for (let i = 0; i < 3; i++) { const k = ((o * 1.2 + i * .4) % 1.3); X.save(); X.translate(820 - k * 900, -20 + k * 360 + i * 60); X.rotate(.4); const gr = X.createLinearGradient(0, 0, 90, 0); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = gr; X.fillRect(0, -3, 90, 6); spark(0, 0, 12, '#fff'); X.restore(); }
      for (let i = 0; i < 3; i++) { obj(starP(40 + i * 40, 520, 15, 7, -Math.PI / 2), i < strikes ? RED : '#fff', i < strikes ? '#b8283a' : '#d9c9a0', 3.5); }
      vignette(.22);
    }
  };
  return g;
}
reg('ln_sign', lnSign, "What's Your Sign?");

/* 5 MAGNAFIRE: the sun dot drifts; keep it steady on one spot of the paper until it ignites.  Place: a sunny deck, a smug sun, an ant on holiday. */
function flameP(x, y, w, h) { return () => { X.beginPath(); X.moveTo(x - w, y); X.bezierCurveTo(x - w * 1.1, y - h * .45, x - w * .25, y - h * .55, x + w * .05, y - h); X.bezierCurveTo(x + w * .3, y - h * .55, x + w * 1.1, y - h * .4, x + w, y); X.quadraticCurveTo(x, y + w * .5, x - w, y); X.closePath(); }; }
function ant(x, y, s, mood, T, calm) {   // lying on a towel, faces left
  X.save(); X.translate(x, y); X.scale(s, s);
  const up = mood === 'happy' ? Math.sin(T * 12) * 3 : 0;
  for (const k of [-1, 0, 1]) for (const sd of [-1, 1]) line([[k * 7, sd * 6], [k * 9 + 2, sd * (14 + (mood === 'happy' ? up : 0))], [k * 11, sd * 17]], 2, INK, INK);
  obj(E_(15, 0, 14, 10), '#e0553a', '#a8341f', 3); obj(E_(0, 0, 8, 7), '#e0553a', '#a8341f', 3);
  obj(C_(-14, 0, 11), '#ee6a4c', '#a8341f', 3.5); glint(-18, -5, 4, 2.4, .4);
  line([[-20, -8], [-26, -16], [-32, -15]], 2, INK, INK); line([[-12, -9], [-12, -18], [-6, -22]], 2, INK, INK);
  const m = mood === 'panic' ? 'panic' : mood === 'happy' ? 'happy' : null;
  eye(-18, -3, 4, [.3, .2], m, T, 1); eye(-9, -3, 4, [.3, .2], m, T, 2);
  if (calm) { rr(-25, -7, 22, 9, 3); ink(INK, 1.5); glint(-20, -5, 4, 1.5, .5); }
  else if (mood === 'panic') { drop(-6, -14 + (T * 22 % 10), .8, .9); }
  mouth(-14, 6, 8, mood === 'happy' ? 'laugh' : mood === 'panic' ? 'wavy' : 'smile', 2);
  X.restore();
}
let MAGBG = null, MAGW = -1;
function magBg() {
  if (MAGBG && MAGW === VW) return MAGBG; MAGW = VW;
  return MAGBG = bake(() => {
    const L = -OX - 2, Rt = W + OX + 2;
    let g = X.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, '#c98a50'); g.addColorStop(1, '#9a6038'); X.fillStyle = g; X.fillRect(L, 0, Rt - L, H);
    X.fillStyle = 'rgba(255,255,255,.1)'; for (let y = 0; y < 600; y += 60) X.fillRect(L, y + 3, Rt - L, 14);
    X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 3; for (let y = 60; y < 600; y += 60) { X.beginPath(); X.moveTo(L, y); X.lineTo(Rt, y); X.stroke(); }
    for (let i = 0; i < 14; i++) { const y = 60 * Math.floor(hr(i) * 10), x = L + hr(i + 20) * (Rt - L); X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 60); X.stroke(); }
    // gingham placemat under the paper
    rr(104, 100, 592, 410, 14); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill(); X.save();
    rr(98, 94, 592, 410, 14); ink('#fff6f0', 4); X.clip(); X.fillStyle = 'rgba(255,92,92,.5)'; for (let x = 98; x < 690; x += 28) X.fillRect(x, 94, 14, 410); for (let y = 94; y < 504; y += 28) X.fillRect(98, y, 592, 14); X.restore();
    // the paper, ink, depth and a gold star sticker
    rr(156, 131, 500, 360, 8); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
    obj(R_(150, 125, 500, 360, 8), PAP, '#e8cf9c', 5, -4, -5);
    X.strokeStyle = 'rgba(70,110,200,.28)'; X.lineWidth = 3; for (let y = 165; y < 470; y += 30) { X.beginPath(); X.moveTo(172, y); X.lineTo(628, y); X.stroke(); }
    X.strokeStyle = 'rgba(255,92,92,.5)'; X.beginPath(); X.moveTo(196, 135); X.lineTo(196, 480); X.stroke();
    obj(starP(600, 455, 26, 12, -Math.PI / 2), '#ffd23f', '#e0a010', 3); glint(594, 448, 6, 3, .6);
    // beach towel for the ant
    obj(R_(690, 366, 76, 108, 8), '#4fc3e8', '#2f8fc0', 4); X.save(); rr(690, 366, 76, 108, 8); X.clip(); X.fillStyle = '#fff'; for (let i = 0; i < 4; i++) X.fillRect(690, 384 + i * 26, 76, 8); X.restore();
    // lemonade
    obj(R_(30, 270, 40, 52, 6), '#fff3a0', '#e8d45a', 3.5); line([[58, 262], [66, 236]], 4, '#ff6b6b'); X.beginPath(); X.arc(54, 268, 9, 0, TAU); ink('#ffe14d', 2.5); glint(40, 284, 3, 12, .6, 0);
  });
}
function lnMagna(sp) {
  const rs = Math.sqrt(sp), D = 5.6 / rs, T = 1.3 / Math.pow(rs, .6), R = 60, amp = 62 + 8 * Math.min(rs, 1.8);
  const tool = lnTool(400, 305, 800, 340, 160, 640, 150, 460);
  const p1 = Math.random() * 6, p2 = Math.random() * 6, dir = Math.random() < .5 ? 1 : -1, W1 = 1.9 + .3 * Math.min(rs, 1.8), smoke = [];
  let c = 0, heat = 0, hx = 400, hy = 305, dx = 0, dy = 0, spawn = 0, flame = 0, cx = 400, cy = 305;
  const g = {
    cmd: 'BURN!', hint: 'HOLD AND MOVE AGAINST THE DRIFT TO KEEP THE DOT STILL (OR ARROWS)', thint: 'DRAG AGAINST THE DRIFT TO KEEP THE SUN DOT STILL', dur: 5.6,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt;
      for (let i = smoke.length - 1; i >= 0; i--) { const s = smoke[i]; s.t += dt; s.y -= 50 * dt; s.x += Math.sin(s.t * 5 + s.ph) * 20 * dt; if (s.t > 1) smoke.splice(i, 1); }
      if (g.result) { if (g.result === 'win') flame += dt; return; }
      tool.step(dt);
      const k = Math.min(1, c / .5);
      // a loop (never lingers, so doing nothing can't ignite it) plus a wobble; the finger has to circle the other way
      dx = amp * k * (Math.cos(c * W1 + p1) + .25 * Math.sin(c * 3.7 + p2));
      dy = amp * k * (dir * Math.sin(c * W1 + p1) + .25 * Math.cos(c * 3.3 + p2));
      cx = clamp(tool.x + dx, 165, 635); cy = clamp(tool.y + dy, 150, 460);
      if (heat <= 0) { hx = cx; hy = cy; }
      if (Math.hypot(cx - hx, cy - hy) < R) heat = Math.min(1, heat + dt / T);
      else heat = Math.max(0, heat - dt * 1.6);
      spawn -= dt; if (heat > .35 && spawn <= 0) { spawn = .09; smoke.push({ x: hx + (Math.random() - .5) * 14, y: hy, t: 0, ph: Math.random() * 6 }); }
      if (heat >= 1) { g.result = 'win'; g._r0 = now; sfx.zap(); lnWin('IGNITED!', hx, hy); burst(hx, hy, CORAL, 20); }
      else if (c >= D - .03) { g.result = 'lose'; g._r0 = now; lnLose('FIZZLED!'); }
    },
    draw(t) {
      X = ctx; ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H); ctx.drawImage(magBg(), -OX, 0);
      const o = oT(g), win = g.result === 'win', lose = g.result === 'lose';
      const SX = 705, SY = 175, sdx = SX - cx, sdy = SY - cy, sl = Math.hypot(sdx, sdy) || 1, ux = sdx / sl, uy = sdy / sl, px = -uy, py = ux;
      const lx = cx + ux * sl * .42, ly = cy + uy * sl * .42;   // the lens hovers between the sun and the dot
      // light: a wide column from the sun to the lens, then a cone down to the dot
      ctx.fillStyle = 'rgba(255,240,150,.26)'; ctx.beginPath(); ctx.moveTo(SX + px * 20, SY + py * 20); ctx.lineTo(SX - px * 20, SY - py * 20); ctx.lineTo(lx - px * 28, ly - py * 28); ctx.lineTo(lx + px * 28, ly + py * 28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,225,77,.4)'; ctx.beginPath(); ctx.moveTo(lx + px * 28, ly + py * 28); ctx.lineTo(lx - px * 28, ly - py * 28); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
      // sun with a face
      { X.save(); X.translate(SX, SY); X.rotate(now * .4);
        for (let i = 0; i < 10; i++) { X.rotate(Math.PI / 5); rr(-6, -58, 12, 20, 5); ink(AMB, 3); }
        X.restore();
        obj(C_(SX, SY, 34), '#ffe14d', '#f0b820', 5, -5, -6); glint(SX - 12, SY - 18, 10, 6, .6);
        const sm = win ? 'happy' : lose ? 'bored' : heat > .35 ? 'evil' : 'smug';
        rr(SX - 26, SY - 11, 22, 14, 5); ink(INK, 2); rr(SX + 4, SY - 11, 22, 14, 5); ink(INK, 2);
        X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(SX - 4, SY - 6); X.lineTo(SX + 4, SY - 6); X.stroke(); glint(SX - 20, SY - 8, 5, 1.8, .6); glint(SX + 10, SY - 8, 5, 1.8, .6);
        if (sm === 'happy') { eye(SX - 15, SY - 3, 5, [0, 0], 'happy', now, 1); eye(SX + 15, SY - 3, 5, [0, 0], 'happy', now, 2); }
        if (sm === 'bored') { X.fillStyle = INK; X.beginPath(); X.ellipse(SX + 1, SY + 18, 7, 8, 0, 0, TAU); X.fill(); }
        else mouth(SX, SY + 15 + (sm === 'evil' ? 2 : 0), sm === 'smug' ? 18 : 22, sm === 'smug' ? 'smile' : 'laugh', 3);
        X.fillStyle = 'rgba(255,110,140,.5)'; el(SX - 24, SY + 12, 5, 3); X.fill(); el(SX + 24, SY + 12, 5, 3); X.fill();
      }
      // scorch mark + smoke
      if (heat > 0) {
        const r = 6 + heat * 28;
        X.fillStyle = `rgba(90,50,30,${.25 + heat * .6})`; X.beginPath(); X.arc(hx, hy, r, 0, TAU); X.fill();
        X.fillStyle = `rgba(20,16,28,${heat * .7})`; X.beginPath(); X.arc(hx, hy, r * .5, 0, TAU); X.fill();
        if (heat > .5) { X.strokeStyle = `rgba(255,140,50,${(heat - .5) * 1.6})`; X.lineWidth = 3; X.beginPath(); X.arc(hx, hy, r + 2, 0, TAU); X.stroke(); }
      }
      for (const s of smoke) { X.globalAlpha = .55 * (1 - s.t); X.beginPath(); X.arc(s.x, s.y, 8 + s.t * 16, 0, TAU); X.fillStyle = '#e8ecff'; X.fill(); }
      X.globalAlpha = 1;
      if (win) {
        for (let i = -1; i <= 1; i++) {
          const fh = (50 + Math.sin(now * 18 + i) * 10) * Math.min(1, flame * 5) * (i ? .72 : 1), fx = hx + i * 22;
          flameP(fx, hy + 8, 17, fh)(); ink(i ? AMB : CORAL, 4); flameP(fx, hy + 8, 9, fh * .6)(); X.fillStyle = i ? '#fff3a0' : AMB; X.fill();
        }
        for (let i = 0; i < 6; i++) { const k = (o * 1.3 + i / 6) % 1; spark(hx + Math.sin(i * 2.1) * 40, hy - 20 - k * 80, 7, '#ffd23f', 1 - k); }
      } else if (!g.result) {
        X.setLineDash([8, 8]); X.strokeStyle = heat > 0 ? CORAL : 'rgba(20,16,28,.35)'; X.lineWidth = 4; X.beginPath(); X.arc(hx, hy, R, 0, TAU); X.stroke(); X.setLineDash([]);
      }
      // the lens (handle sideways so it never hides the dot) and the sun dot
      { X.beginPath(); X.arc(lx, ly, 29, 0, TAU); X.fillStyle = 'rgba(200,235,255,.28)'; X.fill();
        line([[lx + px * 30, ly + py * 30], [lx + px * 74, ly + py * 74]], 8, '#a5622c');
        X.beginPath(); X.arc(lx, ly, 29, 0, TAU); X.lineWidth = 16; X.strokeStyle = INK; X.stroke(); X.lineWidth = 9; X.strokeStyle = '#ffc93c'; X.stroke();
        glint(lx - 9, ly - 10, 8, 3.5, .7, -.7); }
      if (!g.result || lose) {
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, 24 + Math.sin(now * 14) * 3, 0, 7); ctx.fill();
        circ(cx, cy, 12, '#fffbe0', 3);
      }
      if (!g.result && !tool.used) ringHint(cx, cy, 40);
      // the ant on holiday reacts to the heat
      ant(728, 420, 1.4, win ? 'happy' : lose ? 'happy' : heat > .4 ? 'panic' : null, now, !(heat > .4) && !win);
      if (win) for (let i = 0; i < 2; i++) { const k = (o * .9 + i / 2) % 1; heart(716 + i * 18, 380 - k * 40, .7 * (1 - k * .4)); }
      meter(250, 512, 300, heat, heat > .6 ? CORAL : AMB, 'HEAT');
      hero(g, 80, 534, 4.6);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_magna', lnMagna, 'Magnafire');

/* 6 GREEN THUMB: aim the mirror so the sunbeam lands on the plant.  Place: a back garden; the potted plant has a face. */
let GRNBG = null, GRNW = -1;
function greenBg() {
  if (GRNBG && GRNW === VW) return GRNBG; GRNW = VW;
  return GRNBG = bake(() => {
    const L = -OX - 2, Rt = W + OX + 2;
    let g = X.createLinearGradient(0, 0, 0, 440); g.addColorStop(0, '#36b0ea'); g.addColorStop(.6, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, Rt - L, 450);
    for (const [mx, mh, mw] of [[60, 80, 260], [380, 110, 300], [680, 70, 240]]) { X.beginPath(); X.moveTo(mx - mw / 2, 440); X.lineTo(mx - 20, 440 - mh); X.lineTo(mx + 20, 440 - mh); X.lineTo(mx + mw / 2, 440); X.closePath(); X.fillStyle = '#c9d0fb'; X.fill(); X.strokeStyle = '#7b80c6'; X.lineWidth = 3; X.lineJoin = 'round'; X.stroke(); }
    X.fillStyle = '#9be38a'; X.beginPath(); X.moveTo(L, 450); for (let x = L; x <= Rt + 20; x += 20) X.lineTo(x, 420 - Math.sin(x * .012 + 1) * 14 - Math.sin(x * .03) * 5); X.lineTo(Rt, 450); X.closePath(); X.fill(); X.strokeStyle = '#2f7a49'; X.lineWidth = 4; X.stroke();
    for (const [tx, ty, r] of [[250, 418, 18], [600, 412, 22], [760, 416, 16], [30, 420, 20]]) { X.fillStyle = '#8a5a34'; X.fillRect(tx - 4, ty, 8, 24); X.beginPath(); X.arc(tx, ty, r, 0, TAU); ink('#3fb260', 3, '#2f7a49'); glint(tx - r * .3, ty - r * .35, r * .35, r * .22, .35); }
    // wooden garden fence along the bottom of the lawn
    X.fillStyle = '#7cd46f'; X.fillRect(L, 450, Rt - L, 76);
    for (let x = L + 10; x < Rt; x += 46) { X.beginPath(); X.moveTo(x - 17, 520); X.lineTo(x - 17, 470); X.lineTo(x, 456); X.lineTo(x + 17, 470); X.lineTo(x + 17, 520); X.closePath(); ink('#e3a868', 3.5); X.save(); X.clip(); X.fillStyle = '#c4874e'; X.fillRect(x + 4, 450, 16, 74); X.restore(); glint(x - 7, 480, 2, 12, .4, 0); }
    X.fillStyle = '#c4874e'; rr(L, 486, Rt - L, 8, 3); ink('#e3a868', 3); rr(L, 506, Rt - L, 8, 3); ink('#e3a868', 3);
    // ground strip + INK horizon
    g = X.createLinearGradient(0, 524, 0, 600); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(L, 524, Rt - L, 80);
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 524); X.lineTo(Rt, 524); X.stroke();
    X.strokeStyle = 'rgba(255,255,255,.14)'; X.lineWidth = 12; for (let i = -2; i < 20; i++) { X.beginPath(); X.moveTo(L + i * 60 + 60, 600); X.lineTo(L + i * 60, 524); X.stroke(); }
    for (let i = 0; i < 14; i++) tuft(L + hr(i + 3) * (Rt - L), 534 + hr(i) * 40);
  });
}
function lnGreen(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, S = { x: 92, y: 150 }, M = { x: 340, y: 230 + Math.random() * 40 };
  const P = { x: 480 + Math.random() * 220, y: 512 }, PR = 80 - 6 * Math.min(rs - 1, .8), NEED = .7;
  const nrm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  const d = nrm(M.x - S.x, M.y - S.y), d2 = nrm(P.x - M.x, P.y - M.y - 50), tsol = nrm(d.x + d2.x, d.y + d2.y);
  const sol = Math.atan2(tsol.y, tsol.x), pc = { x: P.x, y: P.y - 50 };
  let th = sol + (Math.random() < .5 ? -1 : 1) * (.7 + Math.random() * .5), target = th, c = 0, grow = 0, held = false, ptr = { x: 0, y: 0 }, used = false;
  const dAng = (a, b) => { let x = (a - b) % Math.PI; if (x > Math.PI / 2) x -= Math.PI; if (x < -Math.PI / 2) x += Math.PI; return x; };
  const aim = () => { const tx = Math.cos(th), ty = Math.sin(th), dd = d.x * tx + d.y * ty; return nrm(2 * dd * tx - d.x, 2 * dd * ty - d.y); };
  const setT = p => { if (Math.hypot(p.x - M.x, p.y - M.y) > 12) { target = th + dAng(Math.atan2(p.y - M.y, p.x - M.x), th); used = true; } };
  const g = {
    cmd: 'REFLECT!', hint: 'DRAG TO AIM THE MIRROR AT THE PLANT (OR LEFT / RIGHT)', thint: 'DRAG TO AIM THE MIRROR AT THE PLANT', dur: 5.8,
    down(p) { held = true; ptr = p; setT(p); }, move(p) { ptr = p; if (held) setT(p); }, up() { held = false; }, key() {}, keyup() {},
    update(dt) {
      c += dt; if (g.result) { if (g.result === 'win') grow = 1; return; }
      let kd = 0; if (keys.ArrowLeft || keys.KeyA) kd--; if (keys.ArrowRight || keys.KeyD) kd++;
      if (kd) { th += kd * 1.0 * dt; target = th; used = true; }
      else th += dAng(target, th) * Math.min(1, dt * 14);
      const r = aim(), s = (pc.x - M.x) * r.x + (pc.y - M.y) * r.y, perp = Math.abs((pc.x - M.x) * r.y - (pc.y - M.y) * r.x);
      const hit = s > 0 && perp <= PR; g._h = hit;
      if (hit) grow = Math.min(1, grow + dt / (NEED * 1.0)); else grow = Math.max(0, grow - dt * .25);
      if (hit && Math.random() < dt * 14) burst(pc.x + (Math.random() - .5) * 40, pc.y - 20, AMB, 2, 90);
      if (grow >= 1) { g.result = 'win'; g._r0 = now; lnWin('BLOOM!', P.x, P.y - 60); }
      else if (c >= D - .03) { g.result = 'lose'; g._r0 = now; lnLose('WILTED!'); }
    },
    draw(t) {
      X = ctx; ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H); ctx.drawImage(greenBg(), -OX, 0);
      const o = oT(g), win = g.result === 'win', lose = g.result === 'lose';
      for (const [sx, sy, s] of [[200, 90, .8], [560, 150, .6]]) cloud((now * 6 + sx) % 1000 - 140, sy, s, '#3c6fb4');
      // sun (with shades) and beams
      X.save(); X.translate(S.x, S.y); X.rotate(now * .4);
      for (let i = 0; i < 10; i++) { X.rotate(Math.PI / 5); rr(-6, -66, 12, 22, 5); ink(AMB, 3); }
      X.restore(); obj(C_(S.x, S.y, 36), '#ffe14d', '#f0b820', 5, -5, -6); glint(S.x - 12, S.y - 18, 10, 6, .6);
      const hitNow = g._h && !g.result;
      rr(S.x - 28, S.y - 10, 23, 15, 5); ink(INK, 2); rr(S.x + 5, S.y - 10, 23, 15, 5); ink(INK, 2); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(S.x - 5, S.y - 5); X.lineTo(S.x + 5, S.y - 5); X.stroke();
      glint(S.x - 21, S.y - 7, 5, 1.8, .6); glint(S.x + 12, S.y - 7, 5, 1.8, .6);
      mouth(S.x + 1, S.y + 16, 22, hitNow || win ? 'laugh' : lose ? 'flat' : 'smile', 3);
      const r = aim(), hit = g._h && !g.result || g.result === 'win';
      let len = 1000; if (hit) len = Math.max(0, (pc.x - M.x) * r.x + (pc.y - M.y) * r.y);
      ctx.lineCap = 'round';
      const beam = (ax, ay, bx, by, w) => { ctx.strokeStyle = 'rgba(255,225,77,.4)'; ctx.lineWidth = w + 10; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = w; ctx.stroke(); };
      beam(S.x + d.x * 36, S.y + d.y * 36, M.x, M.y, 8); beam(M.x, M.y, M.x + r.x * len, M.y + r.y * len, 8);
      ctx.lineCap = 'butt';
      // mirror on a stand
      line([[M.x, M.y + 10], [M.x, 520]], 8, '#a5622c'); obj(R_(M.x - 24, 512, 48, 12, 5), '#c4874e', '#8a5530', 3);
      X.save(); X.translate(M.x, M.y); X.rotate(th);
      obj(R_(-68, -13, 136, 26, 8), '#e6b36a', '#b07a38', 4); rr(-62, -8, 124, 16, 5); X.fillStyle = '#cfe9ff'; X.fill();
      X.fillStyle = '#fff'; X.fillRect(-56, -6, 52, 4); X.fillStyle = 'rgba(120,170,230,.5)'; X.fillRect(-4, 2, 62, 4);
      X.restore(); X.beginPath(); X.arc(M.x, M.y, 11, 0, TAU); ink(AMB, 4); glint(M.x - 3, M.y - 3, 3, 2, .7);
      if (held && !g.result) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(M.x, M.y); ctx.lineTo(ptr.x, ptr.y); ctx.stroke(); ctx.setLineDash([]); }
      if (!g.result && !used) ringHint(M.x + Math.cos(th) * 66, M.y + Math.sin(th) * 66, 24);
      // butterfly gag
      { const bx = win ? P.x + Math.cos(now * 3) * 50 : 300 + Math.sin(now * .7) * 220, by = win ? P.y - 130 + Math.sin(now * 3) * 14 : 400 + Math.sin(now * 1.9) * 24, fl = Math.abs(Math.sin(now * 14));
        X.save(); X.translate(bx, by); for (const sx of [-1, 1]) { X.save(); X.scale(sx * (.35 + fl * .65), 1); obj(E_(8, -3, 9, 7, -.4), '#ff8ad8', '#c95fa0', 2.5); obj(E_(6, 5, 6, 5, .3), '#ffd23f', '#d9a010', 2.5); X.restore(); }
        line([[0, -5], [0, 7]], 2.5, INK, INK); X.restore(); }
      // plant in a pot with a face
      shadow(P.x, 528, 50, 10, .3);
      const pot = () => { X.beginPath(); X.moveTo(P.x - 34, 478); X.lineTo(P.x + 34, 478); X.lineTo(P.x + 26, 526); X.lineTo(P.x - 26, 526); X.closePath(); };
      pot(); ink(null, 4); cel(pot, CORAL, '#c93a3a', -5, -4); rr(P.x - 38, 470, 76, 14, 5); ink(CORAL, 3.5); glint(P.x - 22, 477, 9, 2.5, .5, 0);
      const h = 16 + grow * 92, droop = (1 - grow) * 16 * (lose ? 2 : 1), sway = Math.sin(now * 3) * 3 * grow;
      const tx = P.x + droop + sway, ty = 478 - h;
      X.beginPath(); X.moveTo(P.x, 480); X.quadraticCurveTo(P.x + sway, 480 - h * .6, tx, ty); X.lineCap = 'round'; X.lineWidth = 14; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = '#6ad84f'; X.stroke(); X.lineCap = 'butt';
      for (const sd of [-1, 1]) { X.save(); X.translate(P.x + sd * 3, 480 - h * .45); X.rotate(sd * (.9 - grow * .4)); obj(E_(sd * 18, 0, 22 + grow * 6, 9), '#6ad84f', '#3fa64a', 3.5); X.restore(); }
      if (grow > .55) { const pr = (grow - .55) / .45 * 17; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + now * .5; X.beginPath(); X.arc(tx + Math.cos(a) * pr * 1.2, ty + Math.sin(a) * pr * 1.2, pr * .7, 0, TAU); ink(PINK, 3); } X.beginPath(); X.arc(tx, ty, pr * .8, 0, TAU); ink(AMB, 3); glint(tx - pr * .25, ty - pr * .3, pr * .25, pr * .15, .6); }
      else { X.beginPath(); X.arc(tx, ty, 8 + grow * 8, 0, TAU); ink('#6ad84f', 4); }
      if (lose) { X.fillStyle = INK; X.fillRect(tx - 12, ty - 4, 8, 3); X.fillRect(tx + 4, ty - 4, 8, 3); }
      { const pm = win ? 'happy' : lose ? 'dead' : hitNow ? null : grow < .2 ? 'sleepy' : null, lk = [hitNow ? -.2 : -.5, hitNow ? -.6 : .2];
        eye(P.x - 12, 498, 6.5, lk, pm, now, 4); eye(P.x + 12, 498, 6.5, lk, pm, now, 5);
        mouth(P.x, 513, 12, win || hitNow ? 'smile' : lose ? 'frown' : 'frown', 3);
        if (!g.result && !hitNow && grow < .2) { brow(P.x - 12, 487, 9, -.4, 3); brow(P.x + 12, 487, 9, .4, 3); }
        if (win) { X.fillStyle = 'rgba(255,120,140,.55)'; el(P.x - 22, 507, 5, 3); X.fill(); el(P.x + 22, 507, 5, 3); X.fill(); } }
      if (win) for (let i = 0; i < 3; i++) { const k = (o * .9 + i / 3) % 1; heart(P.x - 30 + i * 30, 420 - k * 60, .8 * (1 - k * .4)); }
      if (lose) {   // a sad rain cloud moves in
        const k = ease(o / .4), cx2 = P.x, cy2 = 340 - (1 - k) * 80;
        X.save(); X.globalAlpha = k; X.translate(cx2 - 30, cy2); for (const [a, b, rad] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, rad, 0, TAU); ink(null, 3, '#44507c'); } for (const [a, b, rad] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, rad, 0, TAU); X.fillStyle = '#8b97bf'; X.fill(); }
        eye(14, -2, 4, [0, .5], 'sleepy', now, 7); eye(34, -2, 4, [0, .5], 'sleepy', now, 8); mouth(24, 12, 10, 'frown', 2.5);
        for (let i = 0; i < 3; i++) drop(10 + i * 14, 28 + ((now * 70 + i * 17) % 40), .8, .9);
        X.restore();
      }
      meter(30, 458, 200, grow, LIME, 'GROWTH');
      hero(g, 90, 534, 4.6);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_green', lnGreen, 'Green Thumb');

/* 7 DIRE PLATES: three rings, each divided in 6 coloured wedges. Tap a ring to turn it until every wedge lines up.  Place: a bank vault dial, a nosy camera. */
function sack(x, y, s, hop) {
  X.save(); X.translate(x, y - hop); X.scale(s, s);
  X.fillStyle = 'rgba(20,16,28,.25)'; el(0, 2 + hop / s, 30, 7); X.fill();
  X.beginPath(); X.moveTo(-14, -42); X.quadraticCurveTo(-36, -30, -32, -8); X.quadraticCurveTo(-30, 2, 0, 2); X.quadraticCurveTo(30, 2, 32, -8); X.quadraticCurveTo(36, -30, 14, -42); X.closePath();
  ink('#c9a06a', 4); cel(() => { X.beginPath(); X.moveTo(-14, -42); X.quadraticCurveTo(-36, -30, -32, -8); X.quadraticCurveTo(-30, 2, 0, 2); X.quadraticCurveTo(30, 2, 32, -8); X.quadraticCurveTo(36, -30, 14, -42); X.closePath(); }, '#d9b27a', '#a87c46', -5, -4);
  rr(-16, -48, 32, 9, 4); ink('#e8434f', 3);
  X.beginPath(); X.arc(0, -20, 11, 0, TAU); ink('#ffd23f', 3); X.fillStyle = '#c99512'; X.fillRect(-1.5, -26, 3, 12);
  X.restore();
}
let VLTBG = null, VLTW = -1;
function vaultBg() {
  if (VLTBG && VLTW === VW) return VLTBG; VLTW = VW;
  return VLTBG = bake(() => {
    const L = -OX - 2, Rt = W + OX + 2;
    let g = X.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, '#d3dae8'); g.addColorStop(1, '#9ca8c6'); X.fillStyle = g; X.fillRect(L, 0, Rt - L, H);
    for (let x = L - 30; x < Rt; x += 160) { X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(x, 0, 70, H); X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 4; X.beginPath(); X.moveTo(x + 80, 0); X.lineTo(x + 80, H); X.stroke(); }
    for (let x = L - 30; x < Rt; x += 160) for (const y of [24, 574]) { X.beginPath(); X.arc(x + 70, y, 6, 0, TAU); ink('#b9c2da', 2.5); glint(x + 68, y - 2, 2, 1.5, .8); }
    X.fillStyle = 'rgba(20,16,28,.16)'; X.fillRect(L, 548, Rt - L, 60);
    X.save(); X.beginPath(); X.rect(L, 550, Rt - L, 50); X.clip(); X.fillStyle = '#ffc93c'; for (let x = L - 60; x < Rt; x += 56) { X.beginPath(); X.moveTo(x, 600); X.lineTo(x + 28, 600); X.lineTo(x + 56, 550); X.lineTo(x + 28, 550); X.closePath(); X.fill(); } X.restore();
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 550); X.lineTo(Rt, 550); X.stroke();
    // siren on the left wall
    obj(R_(54, 232, 32, 12, 4), '#555d8c', '#3b3550', 3);
  });
}
function lnPlates(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, CX = 400, CY = 332, S = Math.PI / 3, MAXN = rs > 1.3 ? 4 : 3;
  const BANDS = [[42, 98], [100, 156], [158, 214]], PAL = [CORAL, AMB, LIME, CYAN, PLUM, PINK];
  const tot = [0, 0, 0], vis = [0, 0, 0];
  for (let i = 0; i < 3; i++) { tot[i] = -(1 + Math.floor(Math.random() * MAXN)); vis[i] = tot[i] * S; }
  let c = 0, sel = 1, kb = false, solved = 0;
  const aligned = i => ((tot[i] % 6) + 6) % 6 === 0;
  const spin = i => {
    if (g.result) return; tot[i]++; sfx.click(); sfx.tick();
    const mid = (BANDS[i][0] + BANDS[i][1]) / 2; burst(CX, CY - mid, '#fff', 3, 120);
    if (aligned(0) && aligned(1) && aligned(2)) solved = .001;
  };
  const g = {
    cmd: 'ALIGN!', hint: 'CLICK THE RINGS TO TURN THEM (OR 1 / 2 / 3)', thint: 'TAP THE RINGS TO TURN THEM', dur: 5.8,
    down(p) {
      const r = Math.hypot(p.x - CX, p.y - CY); kb = false;
      for (let i = 0; i < 3; i++) if (r >= BANDS[i][0] - 3 && r <= BANDS[i][1] + 3) { sel = i; spin(i); return; }
    },
    move() {}, up() {},
    key(e) {
      if (e.repeat || g.result) return;
      const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code || '');
      if (m) { sel = +m[1] - 1; kb = true; spin(sel); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = Math.min(2, sel + 1); kb = true; }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = Math.max(0, sel - 1); kb = true; }
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight' || e.code === 'KeyD') { kb = true; spin(sel); }
    },
    keyup() {},
    update(dt) {
      c += dt;
      for (let i = 0; i < 3; i++) vis[i] += (tot[i] * S - vis[i]) * Math.min(1, dt * 14);
      if (g.result) return;
      if (solved > 0) { solved += dt; if (solved > .22) { g.result = 'win'; g._r0 = now; lnWin('ALIGNED!', CX, CY); } return; }
      if (c >= D - .03) { g.result = 'lose'; g._r0 = now; lnLose('JAMMED!'); }
    },
    draw(t) {
      X = ctx; ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H); ctx.drawImage(vaultBg(), -OX, 0);
      const o = oT(g), win = g.result === 'win', lose = g.result === 'lose', ok3 = aligned(0) && aligned(1) && aligned(2);
      // win: the vault bursts open in gold light behind the dial
      if (win) { X.save(); X.translate(CX, CY); X.rotate(now * .5); X.fillStyle = 'rgba(255,225,77,.38)'; for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(0, 0); X.lineTo(-40, -760); X.lineTo(40, -760); X.closePath(); X.fill(); } X.restore(); }
      // security camera (an eye on a stalk) watches the dial; siren on the wall
      { const camX = 724, camY = 116, ang = Math.atan2(CY - camY, CX - camX);
        line([[camX + 40, 60], [camX + 10, camY - 14]], 7, '#8f9cb3');
        X.save(); X.translate(camX, camY); X.rotate(ang + Math.PI + Math.sin(now * .9) * .08);
        obj(R_(-6, -17, 52, 34, 9), '#e6edff', '#a8b4d8', 4); X.restore();
        X.save(); X.translate(camX, camY); obj(C_(0, 0, 19), '#fff', '#cdd5ea', 4);
        const lk = [Math.cos(ang) * 1, Math.sin(ang) * 1], cm = win ? 'happy' : lose ? 'panic' : null;
        eye(0, 0, 11, lk, cm, now, 9); X.restore();
        X.beginPath(); X.arc(camX + 14, camY - 24, 4, 0, TAU); ink(Math.sin(now * (lose ? 14 : 3)) > 0 ? '#ff4d5e' : '#7a2a3a', 2); }
      { const sx = 70, sy = 232, on = lose;
        if (on) { X.save(); X.translate(sx, sy - 22); X.rotate(now * 7); for (const sg of [0, Math.PI]) { X.save(); X.rotate(sg); const gr = X.createLinearGradient(0, 0, 420, 0); gr.addColorStop(0, 'rgba(255,60,80,.6)'); gr.addColorStop(1, 'rgba(255,60,80,0)'); X.fillStyle = gr; X.beginPath(); X.moveTo(0, 0); X.lineTo(420, -70); X.lineTo(420, 70); X.closePath(); X.fill(); X.restore(); } X.restore(); }
        obj(R_(sx - 17, sy - 36, 34, 36, 10), on ? '#ff4d5e' : win ? '#5CFF7A' : '#c85a64', on ? '#b8283a' : win ? '#23a046' : '#8a2a38', 4); glint(sx - 7, sy - 26, 4, 8, .55, 0);
        obj(R_(sx - 21, sy - 4, 42, 10, 4), '#555d8c', '#3b3550', 3); }
      // sacks of money: they hop on a win
      sack(56, 536, .9, win ? Math.abs(Math.sin(o * 9)) * 14 : 0); sack(752, 536, .9, win ? Math.abs(Math.sin(o * 9 + 1.3)) * 14 : 0);
      // the dial: bezel, wedges, lamps, hub
      shadow(CX + 8, CY + 214, 215, 18, .3);
      circ(CX, CY, 218, INK, 0);
      for (let i = 0; i < 3; i++) {
        const [ri, ro] = BANDS[i];
        for (let k = 0; k < 6; k++) {
          const a0 = -Math.PI / 2 + k * S + vis[i], a1 = a0 + S;
          ctx.beginPath(); ctx.arc(CX, CY, ro, a0, a1); ctx.arc(CX, CY, ri, a1, a0, true); ctx.closePath();
          ctx.fillStyle = PAL[k]; ctx.fill();
          if (i) { ctx.fillStyle = `rgba(255,255,255,${i * .13})`; ctx.fill(); }
          ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
          ctx.beginPath(); ctx.arc(CX, CY, ro - 7, a0 + .12, a1 - .3); ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
        }
        const mid = (ri + ro) / 2, ok = aligned(i);
        circ(CX, CY - mid, 9, ok ? LIME : '#5d6aa3', 3); glint(CX - 3, CY - mid - 3, 3, 2, .7);
        if (kb && sel === i && !g.result) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(CX, CY, ro + 2, 0, 7); ctx.arc(CX, CY, ri - 2, 0, 7, true); ctx.stroke(); }
      }
      if (win) { ctx.fillStyle = `rgba(255,225,77,${.26 + .12 * Math.sin(now * 10)})`; ctx.beginPath(); ctx.arc(CX, CY, 214, 0, 7); ctx.fill(); }
      if (lose) { ctx.fillStyle = 'rgba(60,0,16,.3)'; ctx.beginPath(); ctx.arc(CX, CY, 214, 0, 7); ctx.fill(); }
      // steel bezel with rivets, and the red pointer
      ctx.lineWidth = 20; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(CX, CY, 224, 0, 7); ctx.stroke(); ctx.lineWidth = 12; ctx.strokeStyle = '#c9ced6'; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(CX, CY, 227, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
      for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + .1; X.beginPath(); X.arc(CX + Math.cos(a) * 224, CY + Math.sin(a) * 224, 3.4, 0, TAU); ink('#9aa7c4', 1.5); }
      X.beginPath(); X.moveTo(CX - 12, CY - 238); X.lineTo(CX + 12, CY - 238); X.lineTo(CX, CY - 214); X.closePath(); ink('#ff4d5e', 3.5);
      obj(C_(CX, CY, 38), '#e6edff', '#a8b4d8', 5, -4, -5);
      caos(CX, CY + 14, 2.9, { mood: lnMood(g) });
      if (ok3 && !g.result) { X.strokeStyle = LIME; X.lineWidth = 4; X.beginPath(); X.arc(CX, CY, 44, 0, TAU); X.stroke(); }
      if (!g.result && c < 1.2 && Math.sin(now * 10) > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(CX, CY, 128, 0, 7); ctx.stroke(); }
      if (win) for (let i = 0; i < 14; i++) {   // coins rain down both sides of the dial
        const side = i % 2 ? 1 : -1, cx2 = CX + side * (250 + hr(i) * 120), cy2 = -30 + ((o * 380 * (.7 + hr(i + 30) * .6) + hr(i + 60) * 300) % 640);
        X.save(); X.translate(cx2, cy2); X.scale(Math.abs(Math.cos(now * 7 + i)) * .8 + .2, 1); X.beginPath(); X.arc(0, 0, 11, 0, TAU); ink('#ffd23f', 3); X.fillStyle = '#c99512'; X.fillRect(-1.5, -6, 3, 12); X.restore();
      }
      if (lose) { for (let i = 0; i < 4; i++) { const k = (o * 1.1 + i / 4) % 1, a = -Math.PI / 2 + (i - 1.5) * .6; X.globalAlpha = .7 * (1 - k); X.beginPath(); X.arc(CX + Math.cos(a) * (200 + k * 30), CY + Math.sin(a) * (200 + k * 30) - k * 20, 12 + k * 18, 0, TAU); X.fillStyle = '#6a6f8c'; X.fill(); } X.globalAlpha = 1;
        X.fillStyle = `rgba(255,50,70,${.07 + .05 * Math.sin(now * 14)})`; X.fillRect(-OX, 0, VW, H); }
      vignette(.2);
    }
  };
  return g;
}
reg('ln_plates', lnPlates, 'Dire Plates');

/* 8 ON THE EDGE: trace the outline; stay inside the band or the steadiness meter drains.  Place: a baking tray; icing the cookie (it has opinions). */
function ginger(x, y, mood, look, T) {   // y = feet
  X.save(); X.translate(x, y);
  line([[-14, -26], [-24, -2]], 12, '#c98a45'); line([[14, -26], [24, -2]], 12, '#c98a45');
  line([[-18, -50], [-34, -36]], 11, '#c98a45'); line([[18, -50], [34, -36 + (mood === 'happy' ? -Math.sin(T * 12) * 10 - 12 : 0)]], 11, '#c98a45');
  obj(R_(-20, -62, 40, 42, 14), '#d89a52', '#a8692c', 4);
  obj(C_(0, -76, 21), '#d89a52', '#a8692c', 4); glint(-9, -88, 7, 3.5, .45);
  eye(-8, -78, 5.5, look, mood, T, 3); eye(8, -78, 5.5, look, mood, T, 4);
  if (mood === 'panic') { brow(-8, -88, 9, .4, 2.5); brow(8, -88, 9, -.4, 2.5); drop(18, -90 + (T * 20 % 14), .8, .9); }
  mouth(0, -66, 12, mood === 'happy' ? 'laugh' : mood === 'panic' ? 'wavy' : 'smile', 2.5);
  X.fillStyle = 'rgba(255,100,130,.5)'; el(-14, -70, 4, 2.5); X.fill(); el(14, -70, 4, 2.5); X.fill();
  for (const by of [-54, -44]) { X.beginPath(); X.arc(0, by, 3.5, 0, TAU); ink('#ff5c8a', 1.8); }
  X.strokeStyle = '#fff'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-17, -22); X.lineTo(-17, -17); X.moveTo(17, -22); X.lineTo(17, -17); X.stroke();
  X.restore();
}
let EDGBG = null, EDGW = -1;
function edgeBg() {
  if (EDGBG && EDGW === VW) return EDGBG; EDGW = VW;
  return EDGBG = bake(() => {
    const L = -OX - 2, Rt = W + OX + 2;
    for (let y = 0; y < 600; y += 60) for (let x = L - 30; x < Rt; x += 60) { X.fillStyle = ((x / 60 + y / 60) & 1) ? '#8fd8d0' : '#7cc6be'; X.fillRect(x, y, 60, 60); }
    X.strokeStyle = 'rgba(20,16,28,.14)'; X.lineWidth = 3; for (let y = 0; y < 600; y += 60) { X.beginPath(); X.moveTo(L, y); X.lineTo(Rt, y); X.stroke(); } for (let x = L - 30; x < Rt; x += 60) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, H); X.stroke(); }
    glint(120, 80, 90, 8, .16, -.3);
    rr(110, 120, 600, 424, 18); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
    obj(R_(100, 112, 600, 424, 18), '#c9ced6', '#8f9cb3', 5, -5, -6);
    obj(R_(118, 130, 564, 388, 10), '#f6edd3', '#e0d2ac', 3, -3, -4);
    glint(180, 126, 120, 4, .5, 0);
    for (const [hx, hy] of [[84, 322], [716, 322]]) { rr(hx - 14, hy - 30, 28, 60, 12); ink('#8f9cb3', 3.5); }
  });
}
function lnEdge(sp) {
  const rs = Math.sqrt(sp), D = 5.9 / rs, TOL = Math.max(36, 44 - 5 * (rs - 1)), ph = Math.random() * 6;
  const path = lnPath(u => { const a = -Math.PI / 2 + u * Math.PI * 2, w = 1 + .15 * Math.cos(3 * a + ph); return [400 + 168 * Math.cos(a) * w, 330 + 118 * Math.sin(a) * w]; }, 300);
  const p0 = path.at(0), tool = lnTool(p0.x, p0.y, 900, 330, 30, 760, 118, 545);
  let c = 0, prog = 0, ste = 1, out = false, outT = 0;
  const g = {
    cmd: 'TRACE!', hint: 'DRAG ALONG THE OUTLINE, STAY IN THE BAND (OR ARROWS)', thint: 'DRAG ALONG THE OUTLINE, STAY IN THE BAND', dur: 5.9,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt; if (g.result) return;
      tool.step(dt);
      const full = path.near(tool.x, tool.y, 0, path.len);
      out = full.d > TOL;
      const nr = path.near(tool.x, tool.y, Math.max(0, prog - 25), prog + 90);
      if (nr.d <= TOL && nr.s > prog) prog = nr.s;
      outT = out ? outT + dt : 0;   // short grace so a first touch away from the start isn't punished
      if (tool.used) { if (outT > .25) ste -= dt * 1.0; else if (!out) ste = Math.min(1, ste + dt * .35); }
      if (prog >= path.len * .965) { g.result = 'win'; g._r0 = now; lnWin('TRACED!'); }
      else if (ste <= 0) { ste = 0; g.result = 'lose'; g._r0 = now; lnLose('OFF THE EDGE!'); }
      else if (c >= D - .03) { g.result = 'lose'; g._r0 = now; lnLose('TOO SLOW!'); }
    },
    draw(t) {
      X = ctx; ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H); ctx.drawImage(edgeBg(), -OX, 0);
      const o = oT(g), win = g.result === 'win', lose = g.result === 'lose', bad = out && !g.result;
      const body = () => { X.beginPath(); for (const p of path.pts) X.lineTo(p.x, p.y); X.closePath(); };
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // the cookie: dough, a crust band to stay in, chocolate chips
      X.save(); X.translate(8, 10); body(); X.fillStyle = 'rgba(20,16,28,.28)'; X.fill(); ctx.strokeStyle = 'rgba(20,16,28,.28)'; ctx.lineWidth = TOL * 2 + 10; path.stroke(0, path.len); X.restore();
      body(); X.fillStyle = '#f2c887'; X.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = TOL * 2 + 10; path.stroke(0, path.len);
      ctx.strokeStyle = bad ? '#b4503a' : '#dc9f58'; ctx.lineWidth = TOL * 2; path.stroke(0, path.len);
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 5; ctx.save(); ctx.translate(-6, -8); path.stroke(0, path.len); ctx.restore();
      for (let i = 0; i < 16; i++) { const q = path.at(path.len * (i / 16 + hr(i) * .03)), a = hr(i + 20) * TAU, off = (hr(i + 40) - .5) * TOL * 1.2; X.save(); X.translate(q.x + Math.cos(a) * off, q.y + Math.sin(a) * off); X.rotate(a); X.beginPath(); X.ellipse(0, 0, 7, 5, 0, 0, TAU); X.fillStyle = '#5a3320'; X.fill(); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(-3, -3, 3, 2); X.restore(); }
      ctx.lineCap = 'butt'; ctx.setLineDash([12, 12]); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 4; path.stroke(0, path.len); ctx.setLineDash([]);
      ctx.lineCap = 'round';
      // the icing line
      ctx.strokeStyle = INK; ctx.lineWidth = 17; path.stroke(0, prog);
      ctx.strokeStyle = lose ? '#c27aa5' : PINK; ctx.lineWidth = 10; path.stroke(0, prog);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.save(); ctx.translate(-2, -3); path.stroke(0, prog); ctx.restore();
      circ(p0.x, p0.y, 11, LIME, 4); glint(p0.x - 3, p0.y - 4, 3, 2, .6);
      // the cookie has a face and watches the piping bag
      { const fx = 400, fy = 322, lk = [clamp((tool.x - fx) / 200, -1, 1), clamp((tool.y - fy) / 120, -1, 1)], fm = win ? 'happy' : lose ? 'dead' : bad ? 'panic' : null;
        eye(fx - 24, fy, 10, lk, fm, now, 1); eye(fx + 24, fy, 10, lk, fm, now, 2);
        if (bad) { brow(fx - 24, fy - 17, 16, .4, 4); brow(fx + 24, fy - 17, 16, -.4, 4); drop(fx + 40, fy - 10 + (now * 24 % 18), 1, .9); }
        mouth(fx, fy + 26, 24, win ? 'laugh' : lose ? 'frown' : bad ? 'wavy' : 'smile', 4);
        X.fillStyle = 'rgba(255,100,130,.5)'; el(fx - 42, fy + 14, 7, 4); X.fill(); el(fx + 42, fy + 14, 7, 4); X.fill();
        if (lose) { X.beginPath(); X.moveTo(fx - 4, fy - 56); X.lineTo(fx + 8, fy - 30); X.lineTo(fx - 8, fy - 14); X.lineTo(fx + 6, fy + 4); X.lineWidth = 4; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); } }
      if (win) for (let i = 0; i < 30; i++) { const q = path.at(path.len * (i / 30)), a = hr(i + 5) * TAU, k = ease(o / .3 - i * .01); if (k <= 0) continue; X.save(); X.translate(q.x, q.y - 4 - (1 - k) * 20); X.rotate(a); X.globalAlpha = k; rr(-5, -2, 10, 4, 2); ink(['#ff5c8a', '#35D0E8', '#ffd23f', '#8DF06B', '#fff'][i % 5], 1.5); X.restore(); }
      if (win) for (let i = 0; i < 4; i++) { const k = (o * .9 + i / 4) % 1; heart(400 + (i - 1.5) * 46, 250 - k * 60, .85 * (1 - k * .4)); }
      if (lose) { const k = ease(o / .35); X.save(); X.globalAlpha = .9; X.beginPath(); X.ellipse(tool.x, tool.y, 12 + 30 * k, 10 + 22 * k, .4, 0, TAU); ink(PINK, 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(tool.x - 8, tool.y - 6, 7, 4); X.fill(); X.restore();
        for (let i = 0; i < 8; i++) { const q = path.at(path.len * hr(i + 70)), fy2 = Math.pow(Math.max(0, o - .05 * i), 2) * 500; X.beginPath(); X.ellipse(q.x, q.y + fy2, 6, 4, i, 0, TAU); ink('#d89a52', 2); } }
      // the piping bag (slim and angled away so it never hides the line ahead)
      { const bx = 46 / 90.5, by = -78 / 90.5, nx = -by, ny = bx, cx0 = tool.x + bx * 104, cy0 = tool.y + by * 104, hop = win ? Math.abs(Math.sin(o * 9)) * 8 : 0;
        X.save(); X.translate(0, -hop);
        const bag = () => { X.beginPath(); X.moveTo(tool.x, tool.y); X.lineTo(cx0 + nx * 19, cy0 + ny * 19); X.quadraticCurveTo(cx0 + bx * 10, cy0 + by * 10, cx0 - nx * 19, cy0 - ny * 19); X.closePath(); };
        bag(); ink(null, 4); cel(bag, PLUM, '#6f45c4', -4, -3);
        X.beginPath(); X.moveTo(tool.x, tool.y); X.lineTo(tool.x + bx * 18 + nx * 6, tool.y + by * 18 + ny * 6); X.lineTo(tool.x + bx * 18 - nx * 6, tool.y + by * 18 - ny * 6); X.closePath(); ink('#dfe6f5', 2.5);
        X.beginPath(); X.arc(cx0 + bx * 8, cy0 + by * 8, 9, 0, TAU); ink('#7a4fd8', 3.5);
        glint(tool.x + bx * 50 + nx * 6, tool.y + by * 50 + ny * 6, 3, 14, .5, Math.atan2(by, bx) + Math.PI / 2);
        circ(tool.x, tool.y + hop, 10, bad ? RED : lose ? '#c27aa5' : PINK, 4); glint(tool.x - 3, tool.y - 3 + hop, 3, 2, .7);
        X.restore(); }
      if (!g.result && !tool.used) ringHint(tool.x, tool.y, 30);
      // the gingerbread man by the tray watches too
      ginger(750, 470, win ? 'happy' : lose ? 'dead' : bad ? 'panic' : null, [clamp((tool.x - 750) / 300, -1, 1), clamp((tool.y - 400) / 150, -1, 1)], now);
      meter(250, 520, 300, ste, ste < .35 ? RED : LIME, 'STEADY');
      hero(g, 80, 534, 4.6);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_edge', lnEdge, 'On the Edge');
})();
