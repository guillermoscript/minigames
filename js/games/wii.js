'use strict';
/* WII wave — WarioWare: Smooth Moves inspired microgames (browser adaptations). All names prefixed wii / wii_
   Art: the DUO look (docs/ART-STYLE.md). A local copy of the DUO drawing kit (WIK); everything draws on X, which can be swapped for an
   offscreen canvas so the same code bakes each static scene once. Cosmetic code never calls Math.random: the seeded game RNG is untouched. */
const WIK = (() => {
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
  const K = { TAU };
  K.cx = () => X; K.begin = () => (X = ctx);
  const clamp = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  K.lerp = (a, b, k) => a + (b - a) * k;
  K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
  const LAY = {};
  K.layer = (key, fn) => { let c = LAY[key]; if (!c || c.width !== VW) c = LAY[key] = K.bake(VW, H, x => { x.translate(OX, 0); fn(x); }); X.drawImage(c, -OX, 0); };
  const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  /* cel shading with a path builder: shade fill, then the base shifted by (-sx,-sy) inside it leaves a crescent */
  const celF = K.celF = (pf, base, shade, sx, sy, o = 4) => { pf(); ink(shade, o); X.save(); pf(); X.clip(); X.translate(-sx, -sy); pf(); X.fillStyle = base; X.fill(); X.restore(); };
  K.celE = (x, y, rx, ry, base, shade, sx = 3, sy = 3, o = 4, rot = 0) => celF(() => el(x, y, rx, ry, rot), base, shade, sx, sy, o);
  K.celR = (x, y, w, h, r, base, shade, sx = 3, sy = 3, o = 4) => celF(() => rr(x, y, w, h, r), base, shade, sx, sy, o);
  K.glintE = (x, y, rx, ry, a = .45, rot = -.5) => { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); };
  K.line = (pts, w, col, ol = 3) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + ol * 2; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  K.qline = (x1, y1, cx, cy, x2, y2, w, col, ol = 3) => { X.beginPath(); X.moveTo(x1, y1); X.quadraticCurveTo(cx, cy, x2, y2); X.lineCap = 'round'; X.lineWidth = w + ol * 2; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  const starP = K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
  K.glim = (x, y, r, a = 1) => { X.save(); X.globalAlpha = a; X.fillStyle = '#fff'; X.beginPath(); X.moveTo(x, y - r); X.quadraticCurveTo(x, y, x + r, y); X.quadraticCurveTo(x, y, x, y + r); X.quadraticCurveTo(x, y, x - r, y); X.quadraticCurveTo(x, y, x, y - r); X.fill(); X.restore(); };
  K.heart = (x, y, s, a = 1) => {
    X.save(); X.globalAlpha = clamp(a, 0, 1); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  };
  K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
  K.zee = (x, y, s, a) => {
    X.save(); X.globalAlpha = clamp(a, 0, 1); X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
    X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.restore();
  };
  /* blocky Caos arms (hippo.js): call with the origin at Caos's feet, before caos() */
  K.arms = (u, la, ra, k = 1, col = OR) => {
    if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
    const one = (sx, an) => {
      X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
      X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
      X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
    };
    one(-1, la); one(1, ra);
  };
  /* a long inked arm between two points ending in a square hand (for reaching) */
  K.reach = (x1, y1, x2, y2, col = OR, w = 11, hs = 17) => {
    K.line([[x1, y1], [x2, y2]], w, col, 3);
    const a = Math.atan2(y2 - y1, x2 - x1);
    X.save(); X.translate(x2, y2); X.rotate(a); rr(-hs * .2, -hs / 2, hs, hs, 4); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(-hs * .1, -hs * .4, hs * .45, hs * .3, 2); X.fill(); X.restore();
  };
  /* crane.js eye: sclera, pupil looking at the action, white dot, blink, moods */
  K.eye = (x, y, r, mood, look, T, k, line = INK) => {
    X.lineCap = 'round';
    if (mood === 'happy') { X.lineWidth = r * .55; X.strokeStyle = line; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
    if (mood === 'bonk' || mood === 'sleep') { X.lineWidth = r * .5; X.strokeStyle = line; X.beginPath(); if (mood === 'sleep') X.arc(x, y - r * .2, r * .7, Math.PI * .15, Math.PI * .85); else { const d = k % 2 ? -1 : 1; X.moveTo(x - r * .7 * d, y - r * .5); X.lineTo(x + r * .4 * d, y); X.lineTo(x - r * .7 * d, y + r * .5); } X.stroke(); return; }
    const big = mood === 'panic' ? 1.3 : 1;
    el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(1.5, r * .28));
    if (mood === 'dizzy') { X.strokeStyle = INK; X.lineWidth = Math.max(1.5, r * .22); X.beginPath(); for (let i = 0; i < 24; i++) { const a = i * .55 + T * 9, q = i / 24 * r * .85; X.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } X.stroke(); return; }
    if (mood !== 'panic' && Math.sin(T * 1.9 + k * .2 + x * .01) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
    const pr = mood === 'panic' ? r * .32 : r * .52, lx = clamp(look[0], -1, 1) * r * .38, ly = clamp(look[1], -1, 1) * r * .38;
    X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
    X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .38, pr * .32); X.fill();
  };
  K.cloud = (x, y, s, body = '#e4f5ff', top = '#fff', ol = null) => {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3, ol || INK); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = body; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = top; X.fill(); } X.restore();
  };
  K.sun = (sx, sy, T, r = 32) => {
    X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, r + 8); X.lineTo(8, r + 8); X.lineTo(0, r * 2.2); X.fill(); }
    X.restore(); X.beginPath(); X.arc(sx, sy, r, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - r * .3, sy - r * .3, r * .38, r * .25, -.6); X.fill();
  };
  /* "that's you" tag with no words: a gold pill with a star and a pointer */
  K.tag = (x, y, col = '#FFE14D') => {
    X.beginPath(); X.moveTo(x - 8, y + 10); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 10); X.closePath(); ink(col, 3);
    rr(x - 22, y - 12, 44, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - 16, y - 9, 32, 6, 3); X.fill();
    starP(x, y + 1, 8.5, 4, 5, -Math.PI / 2, '#fff', 2);
  };
  K.shade = (x, y, rx, ry, a = .25) => { X.fillStyle = `rgba(20,16,28,${a})`; el(x, y, rx, ry); X.fill(); };
  K.keyCap = (s, x, y) => {
    X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.max(26, X.measureText(s).width + 14);
    rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, x, y + 1);
  };
  K.puff = (x, y, r, a = 1, col = '#f4ead8') => {
    if (a <= 0) return; X.save(); X.globalAlpha = clamp(a, 0, 1);
    const c = [[-r * .6, 0, r * .62], [0, -r * .35, r * .75], [r * .6, 0, r * .6], [0, r * .2, r * .6]];
    for (const [a2, b, q] of c) { X.beginPath(); X.arc(x + a2, y + b, q, 0, TAU); ink(null, 3); }
    for (const [a2, b, q] of c) { X.beginPath(); X.arc(x + a2, y + b, q, 0, TAU); X.fillStyle = col; X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .25, y - r * .5, r * .35, r * .2, -.4); X.fill(); X.restore();
  };
  K.rays = (x, y, r, T, a = .5, col = '255,240,150', n = 12) => {
    X.save(); X.translate(x, y); X.rotate(T * .6); X.fillStyle = `rgba(${col},${a})`;
    for (let i = 0; i < n; i++) { X.rotate(TAU / n); X.beginPath(); X.moveTo(-r * .12, r * .25); X.lineTo(r * .12, r * .25); X.lineTo(0, r); X.fill(); }
    X.restore();
  };
  /* feedback word on a coloured slab (hippo badge): pop it in with sc */
  K.badge = (s, x, y, size, bgc, fg, sc = 1, rot = 0) => {
    if (sc <= .01) return;
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(236, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
    X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
    rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
    X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
    txt(s, 0, 2, size, fg || '#fff', 'center', 236);
    X.restore();
  };
  /* a glass tube gauge: fill k (0..1) from the bottom, optional green zone [lo,hi] */
  K.gauge = (x, y, w, h, k, col, zone) => {
    rr(x, y, w, h, w / 2); ink('#eaf6ff', 4);
    X.save(); rr(x, y, w, h, w / 2); X.clip();
    if (zone) { X.fillStyle = '#5CFF7A'; X.fillRect(x, y + h - zone[1] * h, w, (zone[1] - zone[0]) * h); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(x, y + h - zone[1] * h, w * .4, (zone[1] - zone[0]) * h); }
    if (k > 0) { X.fillStyle = col; X.fillRect(x, y + h - k * h, w, k * h + 2); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x + w * .14, y + h - k * h, w * .22, k * h); }
    X.restore(); X.fillStyle = 'rgba(255,255,255,.55)'; rr(x + w * .16, y + 8, w * .2, h - 16, w * .1); X.fill();
  };
  /* a cowboy / helmet style dome hat sitting on Caos's head: x, y = top of the head */
  K.dome = (x, y, hw, h, col, shade, o = 4) => celF(() => { X.beginPath(); X.moveTo(x - hw, y + 2); X.quadraticCurveTo(x - hw, y - h * 1.25, x, y - h * 1.25); X.quadraticCurveTo(x + hw, y - h * 1.25, x + hw, y + 2); X.closePath(); }, col, shade, hw * .14, h * .12, o);
  K.pigeon = (x, y, s, dir, T, mood = 0) => {   // mood 0 walk, 1 scared (wings out)
    X.save(); X.translate(x, y); X.scale(s * dir, s);
    const bob = mood ? 0 : Math.sin(T * 9) * 2.5, st = Math.sin(T * 9) * 5;
    X.strokeStyle = '#e8794a'; X.lineWidth = 3; X.lineCap = 'round';
    X.beginPath(); X.moveTo(-3, -6); X.lineTo(-3 + st, 0); X.moveTo(5, -6); X.lineTo(5 - st, 0); X.stroke();
    K.celE(0, -16, 17, 12, '#b5bdd0', '#8590ab', 3, 3, 3);
    X.save(); X.rotate(mood ? -.7 : 0); K.celE(-6, -16 - (mood ? 8 : 0), 10, 6, '#98a2bd', '#7a85a3', 2, 2, 2.5); X.restore();
    K.celE(14, -26 + bob * .3, 8, 8, '#b5bdd0', '#8590ab', 2, 2, 3);
    K.celE(8, -22, 6, 5, '#7fd6b0', '#4fae88', 1, 1, 2);
    X.beginPath(); X.moveTo(21, -26); X.lineTo(29, -24); X.lineTo(21, -22); X.closePath(); ink('#ffb347', 2);
    X.fillStyle = INK; el(17, -28, 2.4, 2.6); X.fill(); X.fillStyle = '#fff'; el(16.4, -28.8, .9, .9); X.fill();
    X.restore();
  };
  return K;
})();
const wiiMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const wiiBang = (x = W / 2, y = 300) => { sfx.thud(); sfx.miss(); shake(10, .3); burst(x, y, '#FF4D6D', 16, 300); ring(x, y, '#FF4D6D', 110, .45); };
/* shared bits of art (no game logic) */
const wiiSkin = '#f6c9a0', wiiSkinSh = '#e2a574';
/* the clock of an outro: seconds since the verdict (0 while playing) */
const wiiRk = (g, at) => at < 0 ? 0 : now - at;

/* 1 ── SAVE ME!: slide the trampoline under the jumper, twice */
const WII_BYS = [[1, 1, 'granny'], [3, 3, 'cap'], [5, 0, 'kid'], [6, 2, 'cat']];   // bystander windows (col, row, who)
function wiiSaveBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX, wk = Math.ceil(OX / 85);
  let gr = X.createLinearGradient(0, 0, 0, 70); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(1, '#a9e4fb'); X.fillStyle = gr; X.fillRect(L, 0, VW, 72);
  gr = X.createLinearGradient(0, 56, 0, 500); gr.addColorStop(0, '#b4bff5'); gr.addColorStop(1, '#8f9ee3'); X.fillStyle = gr; X.fillRect(L, 56, VW, 446);
  X.strokeStyle = 'rgba(60,70,150,.22)'; X.lineWidth = 2; X.beginPath();
  for (let y = 78, i = 0; y < 500; y += 22, i++) { X.moveTo(L, y); X.lineTo(R, y); for (let x = L + (i % 2 ? 0 : 30); x < R; x += 60) { X.moveTo(x, y); X.lineTo(x, y + 22); } }
  X.stroke();
  rr(L - 20, 40, VW + 40, 28, 9); ink('#fff1d6', 4); X.fillStyle = 'rgba(143,158,227,.45)'; X.fillRect(L, 60, VW, 6);
  const win = (wx, wy, lit) => {
    rr(wx - 6, wy + 56, 56, 12, 4); ink('#fff1d6', 3);
    rr(wx, wy, 44, 58, 6); ink(lit ? '#ffe58a' : '#7cc4ee', 4);
    X.save(); rr(wx, wy, 44, 58, 6); X.clip(); X.fillStyle = lit ? '#ffcf55' : '#5aa9db'; X.fillRect(wx, wy + 32, 44, 30);
    X.fillStyle = 'rgba(255,255,255,.4)'; X.beginPath(); X.moveTo(wx + 4, wy + 58); X.lineTo(wx + 20, wy); X.lineTo(wx + 30, wy); X.lineTo(wx + 14, wy + 58); X.fill(); X.restore();
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(wx + 22, wy); X.lineTo(wx + 22, wy + 58); X.moveTo(wx, wy + 29); X.lineTo(wx + 44, wy + 29); X.stroke();
  };
  for (let r = 0; r < 5; r++) for (let c = -wk; c < 8 + wk; c++) {
    const wx = 70 + c * 85, wy = 82 + r * 85, by = WII_BYS.some(b => b[0] === c && b[1] === r), h = K.hash(c * 7 + r * 13);
    win(wx, wy, by || h > .78);
    if (!by && h > .5 && h < .62) { rr(wx + 6, wy + 44, 32, 14, 3); ink('#b4553a', 2.5); X.fillStyle = '#4fb065'; el(wx + 14, wy + 36, 7, 10, -.3); X.fill(); el(wx + 26, wy + 34, 7, 12, .3); X.fill(); }
  }
  // pavement
  gr = X.createLinearGradient(0, 500, 0, 600); gr.addColorStop(0, '#d2d6e0'); gr.addColorStop(1, '#9ca2b5'); X.fillStyle = gr; X.fillRect(L, 500, VW, 100);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(L, 504, VW, 12);
  X.strokeStyle = 'rgba(20,16,28,.15)'; X.lineWidth = 3; X.beginPath(); X.moveTo(L, 548); X.lineTo(R, 548); for (let x = L + 30, i = 0; x < R; x += 120, i++) { X.moveTo(x + (i % 2) * 40, 516); X.lineTo(x + (i % 2) * 40 - 14, 548); X.moveTo(x + 60 - (i % 2) * 40, 548); X.lineTo(x + 60 - (i % 2) * 40 - 18, 600); } X.stroke();
  X.fillStyle = INK; X.fillRect(L, 498, VW, 5);
  // hydrant + bin
  const hx = R - 46;
  K.celR(hx - 16, 470, 32, 52, 10, '#ff4d5e', '#c22f45', 4, 0, 4); K.celE(hx, 468, 18, 11, '#ff7a86', '#c22f45', 2, 2, 4); rr(hx - 26, 484, 52, 12, 5); ink('#ffd23f', 3);
  K.celR(hx - 30, 502, 60, 20, 6, '#c22f45', '#9a2036', 0, 3, 3); X.fillStyle = INK; X.beginPath(); X.arc(hx, 500, 4, 0, K.TAU); X.fill();
  const bx = L + 46;
  K.celR(bx - 22, 474, 44, 52, 8, '#aab3c4', '#7e88a3', 4, 0, 4); rr(bx - 26, 466, 52, 12, 6); ink('#c9d1e0', 3);
  X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 3; X.beginPath(); for (let i = -1; i <= 1; i++) { X.moveTo(bx + i * 12, 484); X.lineTo(bx + i * 12, 516); } X.stroke();
}
function wiiSave(sp) {
  const grav = 760 * (sp > 1.5 ? 1.15 : 1), BY = 490;
  let tw = mouse.x, tx = mouse.x, caught = 0, stretch = 0, splat = 0, t = 0, endAt = -1; const cAt = [];
  const SR = 250 + OX * .6, P = { x: W / 2 + (Math.random() - .5) * 2 * (SR - 20), y: 80, vx: 0, vy: 0, rot: 0 };
  const g = {
    wide: true, cmd: 'SAVE ME!', hint: 'MOUSE / ← → SLIDES THE TRAMPOLINE', thint: 'DRAG LEFT AND RIGHT', dur: 6.2,
    move(p) { tx = p.x; },
    update(dt) {
      t += dt; stretch = Math.max(0, stretch - dt * 3);
      if (g.result && endAt < 0) endAt = now;
      if (g.result === 'lose') { splat += dt; return; }
      if (keys.ArrowLeft || keys.KeyA) tx -= 700 * dt; if (keys.ArrowRight || keys.KeyD) tx += 700 * dt;
      tx = Math.max(90 - OX, Math.min(710 + OX, tx)); tw += (tx - tw) * Math.min(1, 16 * dt);
      if (g.result) return;
      if (t < .6) { P.rot = Math.sin(t * 30) * .15; return; }
      P.vy += grav * dt; P.x += P.vx * dt; P.y += P.vy * dt; P.rot += (P.vx / 60 + .5) * dt * 2;
      if (P.vy > 0 && P.y >= BY - 22 && P.y < BY + 30 && Math.abs(P.x - tw) < 78) {
        P.y = BY - 22; P.vy = -690; stretch = 1; caught++; cAt.push(now); sfx.boing(); sfx.blip(caught * 4); shake(4, .15); burst(P.x, BY, '#FFE14D', 10, 220); ring(P.x, BY, '#fff', 80, .35); floatText(caught >= 2 ? 'SAVED!' : 'BOING!', P.x, BY - 50, '#fff', 34);
        if (caught >= 2) { g.result = 'win'; P.vx = 0; sfx.sparkle(); confetti(P.x, BY - 40, 24); }
        else { const tg = W / 2 + (Math.random() - .5) * 2 * SR; P.vx = (tg - P.x) / (2 * 690 / grav); }
      }
      if (P.x < 40 - OX || P.x > 760 + OX) P.vx *= -1;
      if (P.y > 560) { g.result = 'lose'; sfx.splat(); wiiBang(P.x, 540); confetti(P.x, 540, 10); }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt), falling = !g.result && t >= .6;
      K.layer('save', wiiSaveBg);
      // clouds peeking over the roof + a pigeon strolling the curb
      K.cloud(((now * 7 + 300) % (VW + 260)) - OX - 130, 22, .7);
      const pgx = ((now * 26 + 120) % (VW + 160)) - OX - 80;
      if (!won && !lost) K.pigeon(pgx, 525, .9, 1, now); else K.pigeon(pgx + rk * (won ? 0 : 300), 525 - (lost ? Math.min(60, rk * 160) : 0), .9, 1, now, 1);
      // bystanders in their windows
      for (const [c, r, who] of WII_BYS) {
        const wx = 70 + c * 85, wy = 82 + r * 85, cx = wx + 22, cy = wy + 40;
        const near = falling && Math.hypot(P.x - cx, P.y - cy) < 170, mood = won ? 'happy' : lost ? 'sleep' : near || (falling && P.y > 300) ? 'panic' : 'idle';
        X.save(); rr(wx, wy, 44, 58, 6); X.clip();
        X.fillStyle = who === 'cat' ? '#6b5a7a' : who === 'granny' ? '#e8e8f0' : who === 'cap' ? '#3a2a22' : '#f2a65a'; if (who === 'kid') { el(cx - 16, cy - 4, 6, 7); X.fill(); el(cx + 16, cy - 4, 6, 7); X.fill(); }
        K.celE(cx, cy + 4, 17, 17, who === 'cat' ? '#9b86b5' : wiiSkin, who === 'cat' ? '#7a669a' : wiiSkinSh, 2, 2, 3);
        if (who === 'granny') { K.celE(cx, cy - 15, 17, 9, '#f2f2fa', '#c9c9dd', 2, 2, 2.5); K.celE(cx, cy - 25, 7, 6, '#f2f2fa', '#c9c9dd', 1, 1, 2.5); }
        if (who === 'cap') { K.celF(() => { X.beginPath(); X.moveTo(cx - 18, cy - 8); X.quadraticCurveTo(cx - 18, cy - 28, cx, cy - 28); X.quadraticCurveTo(cx + 18, cy - 28, cx + 18, cy - 8); X.closePath(); }, '#ff4d5e', '#c22f45', 3, 2, 3); rr(cx - 2, cy - 12, 24, 6, 3); ink('#c22f45', 2.5); }
        if (who === 'kid') { K.celE(cx, cy - 12, 17, 10, '#f2a65a', '#c97a38', 2, 2, 2.5); }
        if (who === 'cat') { for (const s of [-1, 1]) { X.beginPath(); X.moveTo(cx + s * 7, cy - 10); X.lineTo(cx + s * 17, cy - 24); X.lineTo(cx + s * 18, cy - 6); X.closePath(); ink('#9b86b5', 2.5); } }
        const lk = [clamp((P.x - cx) / 160, -1, 1), clamp((P.y - cy) / 200, -1, 1)];
        K.eye(cx - 7, cy + 2, 4.6, mood, lk, tt, c); K.eye(cx + 7, cy + 2, 4.6, mood, lk, tt, c + 1);
        X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round';
        if (who === 'granny') { X.beginPath(); X.arc(cx - 7, cy + 2, 6.5, 0, TAU); X.arc(cx + 7, cy + 2, 6.5, 0, TAU); X.moveTo(cx - .5, cy + 2); X.lineTo(cx + .5, cy + 2); X.stroke(); }
        X.beginPath();
        if (mood === 'panic') { el(cx, cy + 12, 3.4, 4.4); X.fillStyle = INK; X.fill(); } else if (mood === 'happy') { X.arc(cx, cy + 8, 5, .15 * Math.PI, .85 * Math.PI); X.stroke(); } else { X.moveTo(cx - 3, cy + 12); X.lineTo(cx + 3, cy + 12); X.stroke(); }
        if (mood === 'happy') { X.fillStyle = 'rgba(255,110,165,.6)'; el(cx - 12, cy + 8, 3.5, 2.2); X.fill(); el(cx + 12, cy + 8, 3.5, 2.2); X.fill(); }
        if (lost) { for (const s of [-1, 1]) K.celE(cx + s * 7, cy + 1, 6, 6, wiiSkin, wiiSkinSh, 1, 1, 2.5); }
        X.restore();
        if (mood === 'happy') { const q = (rk * 2 + c * .3) % 1; K.heart(cx + Math.sin(q * 6) * 6, wy - 4 - q * 30, .55, 1 - q); }
      }
      // shadows
      K.shade(tw - 105, 538, 30, 8); K.shade(tw + 105, 538, 30, 8); K.shade(tw, 541, 70, 9, .18);
      if (!lost) K.shade(P.x, 541, Math.max(14, 44 - (BY - P.y) / 9), 7, .22);
      // the firefighters holding the trampoline
      const hop = won ? Math.abs(Math.sin(rk * 9)) * 16 : 0, fy = BY + stretch * 22;
      for (const s of [-1, 1]) {
        const hx = tw + s * 105;
        X.save(); X.translate(hx, 538 - hop);
        const lift = stretch * .25 - (falling && P.y > 330 ? .1 : 0);
        K.arms(5, -lift + (s < 0 ? .05 : -.2), lift + (s < 0 ? .2 : -.05), 1);
        caos(0, 0, 5, { mood: wiiMood(g) });
        K.dome(0, -45, 31, 16, '#ffd23f', '#d9a31a', 3);
        rr(-36, -47, 72, 8, 4); ink('#ffb21e', 3); X.fillStyle = '#ff4d5e'; rr(-5, -66, 10, 14, 3); X.fill(); K.glintE(-12, -57, 8, 3, .6, -.3);
        if (!won && !lost && falling) K.sweat(s * 38, -42, .9, tt + s);
        X.restore();
      }
      K.tag(tw - 105, 538 - hop - 80);
      // the trampoline sheet between their hands
      X.save(); const ex1 = tw - 72, ex2 = tw + 72, ey = 489 - hop;
      X.beginPath(); X.moveTo(ex1, ey); X.quadraticCurveTo(tw, fy + 16 - hop, ex2, ey); X.lineCap = 'round';
      X.lineWidth = 22; X.strokeStyle = INK; X.stroke(); X.lineWidth = 14; X.strokeStyle = '#ff4d5e'; X.stroke();
      X.setLineDash([12, 12]); X.lineWidth = 14; X.strokeStyle = '#fff'; X.stroke(); X.setLineDash([]);
      X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.65)'; X.beginPath(); X.moveTo(ex1 + 8, ey - 3); X.quadraticCurveTo(tw, fy + 10 - hop, ex2 - 8, ey - 3); X.stroke(); X.restore();
      // the jumper
      if (!lost) {
        let jx = P.x, jy = P.y, rot = P.rot;
        if (won) { jy = P.y - Math.abs(Math.sin(rk * 7)) * 80; rot = (((P.rot % TAU) + TAU) % TAU); if (rot > Math.PI) rot -= TAU; rot *= 1 - ease(rk * 3); }
        if (falling) { X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); for (let i = -1; i <= 1; i++) { X.moveTo(jx + i * 22, jy - 70 - Math.abs(i) * 10); X.lineTo(jx + i * 22, jy - 110 - Math.abs(i) * 14); } X.stroke(); }
        X.save(); X.translate(jx, jy); X.rotate(rot); const sq = Math.min(.22, Math.abs(P.vy) / 3200) - stretch * .12; X.scale(1 - sq * .6, 1 + sq);
        K.arms(4.4, -2.6 + Math.sin(tt * 22) * .2, 2.6 - Math.sin(tt * 22) * .2, falling ? 1 : .0);
        X.translate(0, 22); caos(0, 0, 4.4, { mood: won ? 'happy' : null }); X.restore();
        if (falling) K.sweat(jx + 30, jy - 8, 1, tt);
        if (won) for (let i = 0; i < 3; i++) { const q = (rk * 1.6 + i / 3) % 1; K.heart(jx + (i - 1) * 36, jy - 30 - q * 70, .8, 1 - q); }
      } else {
        // the crater: a flat Caos in a hole, stars and dust
        const cxp = P.x, k = ease(rk * 6);
        X.fillStyle = INK; el(cxp, 541, 46 * k, 10 * k); X.fill();
        X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i < 6; i++) { const a = -.2 - i * .55, l = (30 + (i % 2) * 18) * k; X.moveTo(cxp + Math.cos(a) * 46 * k, 541 + Math.sin(a) * 9 * k); X.lineTo(cxp + Math.cos(a) * (46 * k + l), 541 + Math.sin(a) * (9 * k + l * .35)); } X.stroke();
        X.save(); X.translate(cxp, 543); X.scale(1.5, .3 + (1 - k) * .7); caos(0, 0, 4.4, { mood: 'sad' }); X.restore();
        for (let i = 0; i < 3; i++) { const a = rk * 5 + i * TAU / 3; K.star(cxp + Math.cos(a) * 34, 508 + Math.sin(a) * 7, 9, 4, 5, a, '#FFE14D', 2.5); }
        K.puff(cxp - 46 - rk * 40, 530, 14 * (1 - clamp(rk, 0, 1) * .5), 1 - rk * 1.2); K.puff(cxp + 46 + rk * 40, 530, 14 * (1 - clamp(rk, 0, 1) * .5), 1 - rk * 1.2);
        K.badge('SPLAT!', clamp(cxp, 120, W + OX - 120), 455, 34, '#ff4d5e', '#fff', outBack(rk / .25), -.05);
      }
      // score sign: two star slots
      const sx = -OX + 18, sy = 88;
      X.fillStyle = 'rgba(20,16,28,.3)'; rr(sx + 3, sy + 6, 86, 38, 14); X.fill();
      rr(sx, sy, 86, 38, 14); ink('#d9944f', 4); X.fillStyle = '#c98443'; rr(sx + 6, sy + 5, 74, 5, 2); X.fill();
      for (let i = 0; i < 2; i++) { const cx = sx + 24 + i * 38; el(cx, sy + 21, 14, 14); ink(caught > i ? '#fff3a0' : '#a5622c', 3); if (caught > i) K.star(cx, sy + 21, 12 * outBack((now - cAt[i]) / .25), 5.5, 5, -Math.PI / 2, '#FFE14D', 2.5); }
      vignette(.16);
    }
  };
  return g;
}

/* 2 ── ZAP!: monsters peek out of doors, zap the eye */
function wiiZapBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  let gr = X.createLinearGradient(0, 0, 0, 540); gr.addColorStop(0, '#9a6fd6'); gr.addColorStop(1, '#c19ae8'); X.fillStyle = gr; X.fillRect(L, 0, VW, 540);
  X.fillStyle = 'rgba(255,255,255,.1)'; for (let x = L - 20; x < R; x += 44) X.fillRect(x, 0, 22, 540);
  X.fillStyle = 'rgba(255,214,102,.5)'; for (let y = 24; y < 530; y += 52) for (let x = L; x < R; x += 44) { el(x + 11 + (y / 52 % 2) * 22, y, 5, 7); X.fill(); }
  // ceiling beam + upper gallery rail
  X.fillStyle = INK; X.fillRect(L, 54, VW, 4); X.fillStyle = '#5a3a8c'; X.fillRect(L, 0, VW, 54);
  X.fillStyle = '#6d47a3'; X.fillRect(L, 0, VW, 30);
  rr(L - 10, 296, VW + 20, 14, 5); ink('#d9944f', 4); X.fillStyle = '#a5622c'; X.fillRect(L, 310, VW, 26); X.fillStyle = INK; X.fillRect(L, 336, VW, 4);
  for (let x = L + 8; x < R; x += 34) { rr(x, 310, 12, 26, 4); ink('#f2b878', 2.5); }
  // lower wainscot + carpet
  X.fillStyle = INK; X.fillRect(L, 526, VW, 4); X.fillStyle = '#6d47a3'; X.fillRect(L, 526, VW, 12);
  gr = X.createLinearGradient(0, 538, 0, 600); gr.addColorStop(0, '#d94a5e'); gr.addColorStop(1, '#a8283f'); X.fillStyle = gr; X.fillRect(L, 538, VW, 62);
  X.fillStyle = '#ffd23f'; X.fillRect(L, 548, VW, 4); for (let x = L + 20; x < R; x += 60) { X.beginPath(); X.moveTo(x, 575); X.lineTo(x + 20, 565); X.lineTo(x + 40, 575); X.lineTo(x + 20, 585); X.closePath(); X.fill(); }
  // door frames and numbers (the doors themselves are live)
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = 135 + c * 200, y = 100 + r * 235;
    rr(x - 14, y - 14, 168, 214, 14); ink('#7a4fb4', 4); rr(x - 14, y - 14, 168, 214, 14); X.fillStyle = 'rgba(255,255,255,.12)'; X.fill();
    rr(x + 40, y - 40, 60, 24, 8); ink('#ffd23f', 3.5); X.fillStyle = INK; for (let d = 0; d < 3; d++) { X.beginPath(); X.arc(x + 54 + d * 16, y - 28, 3.4, 0, K.TAU); X.fill(); }
  }
}
function wiiZap(sp) {
  const vis = 1.2 / Math.pow(sp, .55), gap = .65 / Math.sqrt(sp), need = 4;
  const doors = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) doors.push({ x: 135 + c * 200, y: 100 + r * 235, op: 0, life: 0, z: 0, col: '#C77DFF', t: 0 });
  const cols = ['#C77DFF', '#5CFF7A', '#FF8FAB', '#FFE14D'];
  let sp0 = .5, zaps = 0, laser = 0, lx = 0, ly = 0, esc = null, endAt = -1, zAt = -9;
  const g = {
    wide: true, cmd: 'ZAP!', hint: 'CLICK THE EYES BEFORE THEY ESCAPE', thint: 'TAP THE EYES', dur: 6,
    down(p) {
      if (g.result) return; laser = .12; lx = p.x; ly = p.y;
      const d = doors.find(d => d.op > 0 && !d.z && p.x > d.x - 10 && p.x < d.x + 150 && p.y > d.y && p.y < d.y + 190);
      if (d) { d.z = .35; zaps++; zAt = now; sfx.zap(); sfx.blip(zaps * 3); shake(5, .15); burst(d.x + 70, d.y + 100, d.col, 14, 300); ring(d.x + 70, d.y + 100, '#FFE14D', 90, .35); floatText('ZAP!', d.x + 70, d.y + 30, '#FFE14D', 32); confetti(d.x + 70, d.y + 100, 10); if (zaps >= need) { g.result = 'win'; sfx.sparkle(); } }
      else sfx.click();
    },
    update(dt) {
      laser = Math.max(0, laser - dt);
      for (const d of doors) {
        d.t += dt;
        if (d.z > 0) { d.z -= dt; if (d.z <= 0) { d.op = 0; d.life = 0; } continue; }
        if (d.op > 0) { d.life += dt; if (d.life > vis && !g.result) { esc = d; g.result = 'lose'; wiiBang(d.x + 70, d.y + 100); } }
      }
      if (g.result && endAt < 0) endAt = now;
      if (g.result) return;
      sp0 -= dt;
      if (sp0 <= 0 && zaps < need) {
        const free = doors.filter(d => !d.op), open = doors.length - free.length;
        if (open < 2 && free.length) { const d = free[Math.floor(Math.random() * free.length)]; d.op = 1; d.life = 0; d.t = 0; d.col = cols[Math.floor(Math.random() * 4)]; sfx.whoosh(true); }
        sp0 = gap;
      }
    },
    draw(t) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt);
      K.layer('zap', wiiZapBg);
      // sconces flicker between the doors (rainbow when you win)
      for (const sx of [45, 305, 505, 765]) for (const sy of [150, 385]) {
        const fl = .5 + .5 * Math.sin(now * 9 + sx * .1 + sy), col = won ? `hsl(${(sx + sy + now * 400) % 360},100%,70%)` : 'rgba(255,220,120,1)';
        X.save(); X.globalAlpha = (won ? .5 : .25 + .15 * fl); X.fillStyle = col; el(sx, sy - 10, 40, 40); X.fill(); X.restore();
        K.celE(sx, sy, 9, 14, won ? col : '#ffe58a', '#e0b840', 2, 2, 3); rr(sx - 10, sy + 12, 20, 8, 3); ink('#d9944f', 3);
      }
      // the ghost maid drifting along the gallery
      { const gx = ((now * 38 + 100) % (VW + 200)) - OX - 100, gy = 262 + Math.sin(now * 2) * 8 - (won ? rk * 10 : 0); X.save(); X.translate(gx, gy);
        X.beginPath(); X.moveTo(-18, 18); X.quadraticCurveTo(-24, -26, 0, -28); X.quadraticCurveTo(24, -26, 18, 18); for (let i = 0; i < 4; i++) X.quadraticCurveTo(14 - i * 9, 26 + (i % 2) * 6, 9 - i * 9, 18); X.closePath(); ink('#f3f4ff', 3.5);
        X.fillStyle = 'rgba(180,190,230,.5)'; el(8, 6, 8, 18); X.fill(); K.eye(-6, -8, 4.5, won ? 'happy' : 'idle', [1, 0], now, 3); K.eye(6, -8, 4.5, won ? 'happy' : 'idle', [1, 0], now, 4);
        rr(-14, -34, 28, 9, 4); ink('#fff', 2.5); X.fillStyle = '#4fd06a'; X.fillRect(-14, -30, 28, 3); K.line([[16, 4], [28, -6]], 3, '#8a5a34', 2); K.celE(30, -9, 6, 5, '#ff8fab', '#d9647f', 1, 1, 2); X.restore(); }
      // doors + monsters
      for (let i = 0; i < doors.length; i++) {
        const d = doors[i], dx = d.x, dy = d.y;
        X.fillStyle = INK; rr(dx - 3, dy - 3, 146, 196, 6); X.fill();
        if (d.op > 0) {
          const k = Math.min(1, d.t / .15), peek = d.z > 0 ? 1 : k, hurry = d.life > vis * .65 && d.z <= 0;
          const ex = dx + 70, ey = d.y + 112 - (1 - peek) * 50 + Math.sin(d.t * 8) * 3;
          X.save(); rr(dx, dy, 140, 190, 4); X.clip();
          X.fillStyle = '#2b1a3f'; X.fillRect(dx, dy, 140, 190); X.fillStyle = 'rgba(255,225,120,.12)'; X.beginPath(); X.moveTo(dx, dy); X.lineTo(dx + 140, dy + 30); X.lineTo(dx + 140, dy + 190); X.lineTo(dx, dy + 190); X.fill();
          // monster: a one-eyed blob with horns, arms on the frame, a mouth
          const zz = d.z > 0, lk = [clamp((62 - ex) / 300, -1, 0), clamp((520 - ey) / 400, 0, 1)];
          K.shade(ex, dy + 178, 50, 9, .35);
          for (const s of [-1, 1]) { K.line([[ex + s * 46, ey + 14], [ex + s * 66, ey - 6 - (zz ? 14 : 0)]], 9, d.col); K.celE(ex + s * 68, ey - 8 - (zz ? 14 : 0), 8, 8, d.col, '#7a4fb4', 2, 2, 3); }
          for (const s of [-1, 1]) { X.beginPath(); X.moveTo(ex + s * 24, ey - 44); X.lineTo(ex + s * 34, ey - 70); X.lineTo(ex + s * 40, ey - 38); X.closePath(); ink('#fff3a0', 3); }
          K.celE(ex, ey, 52, 52, d.col, 'rgba(60,20,110,.55)', 8, 8, 5); K.glintE(ex - 30, ey - 34, 10, 6, .45, -.6);
          K.celE(ex, ey - 6, 33, 33, '#fff', '#dfe3f3', 3, 3, 4);
          if (zz) { K.eye(ex, ey - 6, 30, 'bonk', lk, now, 0); K.star(ex, ey - 6, 70, 30, 8, d.t * 8, '#FFE14D', 4); }
          else { X.fillStyle = INK; el(ex + lk[0] * 10, ey - 6 + lk[1] * 10, hurry ? 9 : 16, hurry ? 10 : 17); X.fill(); X.fillStyle = '#fff'; el(ex + lk[0] * 10 - 5, ey - 12 + lk[1] * 10, 5, 4); X.fill(); }
          // mouth
          X.beginPath(); if (zz) { el(ex, ey + 38, 13, 7); X.fillStyle = INK; X.fill(); K.celE(ex + 4, ey + 42, 8, 5, '#ff6b8a', '#c94a6a', 1, 1, 2); }
          else if (hurry) { X.moveTo(ex - 18, ey + 40); for (let q = 0; q < 6; q++) X.lineTo(ex - 18 + q * 7.2, ey + 40 + (q % 2 ? -5 : 5)); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); }
          else { X.moveTo(ex - 18, ey + 34); X.quadraticCurveTo(ex, ey + 50, ex + 18, ey + 34); X.lineWidth = 4; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.fillStyle = '#fff'; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(ex + s * 8, ey + 40); X.lineTo(ex + s * 12, ey + 47); X.lineTo(ex + s * 4, ey + 43); X.fill(); } }
          if (hurry) { K.sweat(ex + 46, ey - 28, 1.1, now + i); K.badge('!', ex + 52, ey - 52 + Math.sin(now * 20) * 2, 26, '#ff4d5e', '#fff', 1, .1); }
          X.restore();
          // the door leaf, swung open (perspective)
          const sw = 40 * (1 - Math.cos(k * 1.2));
          X.beginPath(); X.moveTo(dx, dy); X.lineTo(dx - sw - 10, dy + 12); X.lineTo(dx - sw - 10, dy + 180); X.lineTo(dx, dy + 190); X.closePath(); ink('#ffb3d1', 4); X.fillStyle = '#e88db4'; X.beginPath(); X.moveTo(dx, dy + 150); X.lineTo(dx - sw - 10, dy + 140); X.lineTo(dx - sw - 10, dy + 180); X.lineTo(dx, dy + 190); X.fill();
        } else {
          K.celR(dx, dy, 140, 190, 4, '#ffb3d1', '#e88db4', 5, 0, 4);
          for (const [py, ph] of [[16, 72], [102, 72]]) { rr(dx + 16, dy + py, 108, ph, 8); ink(null, 3, '#c9669a'); }
          K.glintE(dx + 34, dy + 42, 14, 6, .5, -.5);
          K.celE(dx + 118, dy + 100, 8, 8, '#ffe14d', '#d9a31a', 1, 1, 3);
          rr(dx + 56, dy + 32, 28, 16, 8); ink('#fff', 2.5); X.fillStyle = INK; el(dx + 70 + Math.sin(now * 2 + i) * 4, dy + 40, 4, 5); X.fill();   // peephole eye
        }
      }
      if (esc) {   // the one that escaped bursts out
        const ex = esc.x + 70, ey = esc.y + 100, k = Math.min(1, (esc.life - vis) * 8 + .2);
        K.celE(ex, ey, 52 + k * 170, 52 + k * 170, esc.col, 'rgba(60,20,110,.55)', 14, 14, 6);
        K.celE(ex, ey - 6 * k, 34 + k * 110, 34 + k * 110, '#fff', '#dfe3f3', 8, 8, 5); X.fillStyle = INK; el(ex + (62 - ex) * .05, ey, 15 + k * 50, 15 + k * 50); X.fill(); X.fillStyle = '#fff'; el(ex - 6 - k * 12, ey - 8 - k * 14, 5 + k * 12, 4 + k * 10); X.fill();
        X.beginPath(); X.moveTo(ex - 40 - k * 60, ey + 40 + k * 70); X.quadraticCurveTo(ex, ey + 60 + k * 120, ex + 40 + k * 60, ey + 40 + k * 70); X.lineWidth = 6 + k * 6; X.strokeStyle = INK; X.stroke();
      }
      // Caos with the zapper, left of the doors
      const cx = 62, cy = 535, aimA = clamp(Math.atan2(ly - (cy - 45), lx - (cx + 40)), -1.2, .6);
      const aim = laser > 0 || (!lost && mouse.x > cx) ? (laser > 0 ? aimA : clamp(Math.atan2(mouse.y - (cy - 45), mouse.x - (cx + 40)), -1.2, .6)) : .2;
      K.shade(cx, cy + 3, 40, 8);
      X.save(); X.translate(cx, cy - (won ? Math.abs(Math.sin(rk * 9)) * 18 : 0));
      K.arms(5, lost ? 2.7 : -.3, lost ? 2.4 : aim + Math.PI / 2, 1);
      caos(0, 0, 5, { mood: wiiMood(g) }); if (!won && !lost) K.sweat(36, -42, .9, now);
      const hx = 33 + Math.sin(aim + Math.PI / 2) * 28, hy = -26 - Math.cos(aim + Math.PI / 2) * 28;
      if (!lost) { X.save(); X.translate(hx + 4, hy); X.rotate(aim); K.celR(-6, -8, 34, 16, 6, '#8f9cb3', '#5d6a85', 0, 3, 3); K.celR(-6, 4, 10, 16, 3, '#ff4d5e', '#c22f45', 1, 0, 3); rr(26, -5, 10, 10, 3); ink('#ffe14d', 2.5); if (laser > 0) { K.star(40, 0, 16, 7, 6, now * 20, '#fff3a0', 2.5); } X.restore(); }
      X.restore();
      if (lost) { X.save(); X.translate(cx + 56, cy - 4); X.rotate(.4); K.celR(-6, -8, 34, 16, 6, '#8f9cb3', '#5d6a85', 0, 3, 3); X.restore(); }
      K.tag(cx, cy - 78 - (won ? Math.abs(Math.sin(rk * 9)) * 18 : 0));
      if (won) for (let i = 0; i < 3; i++) { const q = (rk * 1.6 + i / 3) % 1; K.heart(cx + (i - 1) * 30, 440 - q * 90, .8, 1 - q); }
      if (laser > 0) { const mx = cx + hx + 4 + Math.cos(aim) * 40, my = cy - 0 + hy + Math.sin(aim) * 40; X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 14; X.beginPath(); X.moveTo(mx, my); X.lineTo(lx, ly); X.stroke(); X.strokeStyle = '#FF2E4D'; X.lineWidth = 6; X.stroke(); X.strokeStyle = '#ffd0d8'; X.lineWidth = 2; X.stroke(); K.celE(lx, ly, 14, 14, '#fff', '#ffd0d8', 2, 2, 3); }
      // tally plaque: one eye sticker per zap
      const px = -OX + 10, py = 88;
      X.fillStyle = 'rgba(20,16,28,.3)'; rr(px + 3, py + 6, 118, 36, 14); X.fill(); rr(px, py, 118, 36, 14); ink('#d9944f', 4);
      for (let i = 0; i < need; i++) { const cx2 = px + 20 + i * 26; el(cx2, py + 19, 11, 11); ink(i < zaps ? '#fff' : '#a5622c', 3); if (i < zaps) { const sc = i === zaps - 1 ? outBack((now - zAt) / .25) : 1; X.fillStyle = INK; el(cx2, py + 19, 5 * sc, 5.5 * sc); X.fill(); X.fillStyle = '#FF2E4D'; el(cx2 + 3, py + 15, 2, 2); X.fill(); } }
      vignette(.16);
    }
  };
  return g;
}

/* 3 ── DRAW!: quick-draw duel; fire only after the "!" (not before, not too late) */
function wiiDrawBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  let gr = X.createLinearGradient(0, 0, 0, 440); gr.addColorStop(0, '#ff7a5c'); gr.addColorStop(.55, '#ffb066'); gr.addColorStop(1, '#ffe3a0'); X.fillStyle = gr; X.fillRect(L, 0, VW, 442);
  // the setting sun, half behind the town
  X.save(); X.beginPath(); X.rect(L, 0, VW, 440); X.clip(); X.beginPath(); X.arc(W / 2, 330, 120, 0, K.TAU); ink('#ffd84a', 4); X.fillStyle = '#fff1a8'; el(W / 2 - 40, 290, 52, 34, -.5); X.fill(); X.restore();
  // far mesas (coloured outline, no ink)
  const mesa = (x0, x1, top, notch) => { X.beginPath(); X.moveTo(x0, 442); X.lineTo(x0 + 16, top + 30); X.quadraticCurveTo(x0 + 18, top, x0 + 44, top); X.lineTo(x0 + notch, top); X.lineTo(x0 + notch + 12, top + 26); X.lineTo(x1 - 40, top + 26); X.quadraticCurveTo(x1 - 16, top + 26, x1 - 14, top + 56); X.lineTo(x1, 442); X.closePath(); ink('#e0795a', 4, '#a8473a'); X.save(); X.clip(); X.fillStyle = '#c9604a'; for (let y = top + 50; y < 442; y += 28) X.fillRect(x0, y, x1 - x0, 8); X.restore(); };
  mesa(L - 40, 250, 300, 110); mesa(540, R + 40, 330, 70);
  // little town in front of the sun
  const bld = (x, w, h, col, sh, roof) => { K.celR(x, 440 - h, w, h, 3, col, sh, 4, 0, 3); rr(x - 4, 440 - h - 10, w + 8, 12, 3); ink(roof, 3); X.fillStyle = INK; for (let wx = x + 10; wx < x + w - 14; wx += 26) { rr(wx, 440 - h + 18, 14, 20, 3); ink('#7a4a2a', 2); } };
  bld(262, 70, 70, '#d99a5c', '#b87a3c', '#a5622c'); bld(336, 92, 52, '#e8b36b', '#c98f4e', '#b06d33'); bld(432, 60, 78, '#c9784a', '#a5583a', '#8a4a2c'); bld(496, 64, 58, '#e0a45c', '#c0803c', '#a5622c');
  // ground
  gr = X.createLinearGradient(0, 440, 0, 600); gr.addColorStop(0, '#f0c27a'); gr.addColorStop(1, '#d99a52'); X.fillStyle = gr; X.fillRect(L, 440, VW, 160);
  X.fillStyle = INK; X.fillRect(L, 438, VW, 5);
  X.strokeStyle = 'rgba(138,90,43,.35)'; X.lineWidth = 5; X.lineCap = 'round'; for (const y of [478, 505]) { X.beginPath(); for (let x = L; x <= R; x += 40) X.lineTo(x, y + Math.sin(x * .03) * 4); X.stroke(); }
  for (let i = 0; i < 16; i++) { const px = L + K.hash(i) * VW, py = 462 + K.hash(i + 40) * 120; K.celE(px, py, 6 + K.hash(i + 9) * 5, 4, '#c9a06a', '#a47c48', 1, 1, 2); }
  // cactus (left) and the post with the wanted poster (right)
  const cx = L + 34;
  K.celR(cx - 11, 380, 22, 100, 11, '#4fb065', '#2f8048', 4, 0, 4); K.celR(cx - 34, 410, 12, 42, 6, '#4fb065', '#2f8048', 3, 0, 3); K.celR(cx - 34, 440, 30, 12, 6, '#4fb065', '#2f8048', 3, 0, 3); K.celR(cx + 22, 396, 12, 34, 6, '#4fb065', '#2f8048', 3, 0, 3); K.celR(cx + 4, 420, 30, 12, 6, '#4fb065', '#2f8048', 3, 0, 3);
  X.fillStyle = INK; for (let i = 0; i < 5; i++) X.fillRect(cx - 14 + (i % 2) * 24, 390 + i * 16, 4, 3);
  const px = R - 60;
  K.celR(px - 9, 330, 18, 120, 5, '#a5622c', '#7a4620', 4, 0, 4); rr(px - 40, 332, 80, 14, 5); ink('#b06d33', 3.5);
  X.save(); X.translate(px - 8, 372); X.rotate(-.05); rr(-30, -26, 52, 56, 4); ink('#f3dca6', 3.5); K.celE(-4, 0, 12, 12, OR, '#b4553a', 2, 2, 2.5); X.fillStyle = INK; X.fillRect(-10, -3, 4, 6); X.fillRect(0, -3, 4, 6); X.fillRect(-20, 16, 32, 4); X.fillRect(-20, -20, 32, 4); X.restore();
  // a cow skull in the dust
  K.celE(300, 560, 18, 13, '#fff', '#dfe3f3', 2, 2, 3); X.fillStyle = INK; el(293, 558, 4, 5); X.fill(); el(307, 558, 4, 5); X.fill(); K.line([[282, 551], [270, 543]], 5, '#fff', 2.5); K.line([[318, 551], [330, 543]], 5, '#fff', 2.5);
}
function wiiDraw(sp) {
  const lim = .55 / Math.pow(sp, .5), delay = 1.3 + Math.random() * 1.4;
  let tm = 0, tg = 0, st = 0, react = 0, endT = 0, popAt = -9;
  const fire = () => {
    if (g.result || tm < .2) return;
    if (!st) { st = 3; g.result = 'lose'; wiiBang(170, 330); }
    else if (st === 1) { react = tg; if (tg <= lim) { st = 2; g.result = 'win'; sfx.stamp(); sfx.zap(); shake(12, .3); burst(630, 330, '#FFE14D', 18, 340); ring(630, 330, '#fff', 120, .4); sfx.sparkle(); } else { st = 3; g.result = 'lose'; wiiBang(630, 330); } }
  };
  const g = {
    wide: true, cmd: 'DRAW!', hint: 'WAIT FOR THE "!" THEN CLICK / SPACE', thint: 'WAIT FOR "!", THEN TAP', dur: 4.6,
    key(e) { if (e.code === 'Space') fire(); }, down() { fire(); },
    update(dt) {
      tm += dt; if (g.result) { endT += dt; return; }
      if (st === 0 && tm > delay) { st = 1; tg = 0; popAt = now; sfx.coin(); sfx.hit(); if (typeof EGGS !== 'undefined') EGGS.play('alert'); shake(3, .12); ring(W / 2, 170, '#FFE14D', 100, .35); }
      if (st === 1) { tg += dt; if (tg > lim) { st = 3; g.result = 'lose'; wiiBang(170, 330); } }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      const won = g.result === 'win', lost = g.result === 'lose', rk = endT;
      K.layer('draw', wiiDrawBg);
      K.rays(W / 2, 330, 420, tt * .25, .14, '255,241,168', 16);
      // tumbleweeds rolling through
      for (let i = 0; i < 3 + Math.ceil(VW / 400); i++) {
        const x = ((tt * 90 + i * 260) % (VW + 200)) - 100 - OX, y = 520 + Math.sin(tt * 6 + i) * 4 - Math.abs(Math.sin(tt * 5 + i)) * 6;
        X.save(); X.translate(x, y); X.rotate(x / 18); K.celE(0, 0, 19, 19, '#c9954f', '#9a6c30', 2, 2, 3);
        X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); for (let q = 0; q < 5; q++) { X.moveTo(-16 + q * 3, -10 + q * 6); X.quadraticCurveTo(0, -4 + q * 3, 16 - q * 2, 10 - q * 5); } X.stroke(); X.restore();
      }
      // vulture on the post, watching the loser
      { const px = W + OX - 60, vy = 322; X.save(); X.translate(px, vy);
        const wing = g.result ? Math.abs(Math.sin(tt * 9)) * .9 : 0;
        for (const s of [-1, 1]) { X.save(); X.translate(s * 12, 8); X.rotate(s * (.2 + wing)); K.celE(s * 10, 6, 10, 24, '#4a4358', '#2e2838', 2, 2, 3); X.restore(); }
        K.celE(0, 6, 17, 22, '#5a5370', '#2e2838', 3, 3, 3.5); K.celE(0, -22, 10, 13, '#ff9fb0', '#d9647f', 2, 2, 3);
        K.celE(0, -2, 15, 6, '#f3efe8', '#c9c2b4', 1, 1, 2.5);
        X.beginPath(); X.moveTo(-6, -20); X.quadraticCurveTo(-24, -18, -20, -6); X.quadraticCurveTo(-14, -14, -6, -14); X.closePath(); ink('#ffd23f', 2.5);
        const vm = won ? 'happy' : lost ? 'bonk' : st === 1 ? 'panic' : 'idle'; K.eye(-3, -26, 4.4, vm, [st === 0 ? -1 : 0, 0], tt, 5, INK); X.restore(); }
      K.shade(170, 444, 90, 18); K.shade(630, 444, 90, 18);
      // the duelists (drawn facing right, mirrored for the bandit)
      const duelist = (x, dir, o) => {
        const u = 12; X.save();
        const fk = o.fall ? Math.min(1, endT * 4) : 0; X.translate(x, 440 - 70 * fk); if (fk) X.rotate(-dir * 1.2 * fk);
        X.scale(dir, 1);
        const idle = Math.sin(tt * 3 + x) * .03, ant = st === 1 && !g.result ? .4 : 0;
        let ra = 3.0 - ant * 1.4 + idle, la = -3.0 - idle;
        if (o.shoot) ra = Math.PI / 2 - .12 + Math.min(1, endT * 8) * .1; else if (o.fall) { ra = 2.2 + Math.sin(tt * 20) * .2; la = -2.2; }
        K.arms(u, la, ra, 1);
        caos(0, 0, u, { col: o.col, mood: o.mood });
        // belt + holster, scarf
        rr(-6 * u, -3.6 * u, 12 * u, 1.3 * u, 4); ink('#7a4620', 3); rr(-1.2 * u, -3.7 * u, 2.4 * u, 1.5 * u, 3); ink('#ffd23f', 2.5);
        if (!o.shoot) K.celR(5.4 * u, -4.6 * u, 3 * u, 4.4 * u, 6, '#7a4620', '#5a3216', 2, 0, 3);
        if (o.badge) { K.star(-3.4 * u, -6.5 * u, 2 * u, .9 * u, 5, -Math.PI / 2, '#ffd84a', 3); }
        // brows
        if (!o.mood && (st >= 1 || o.brow)) { X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(-4.4 * u, -8.2 * u); X.lineTo(-1.6 * u, -7.3 * u); X.moveTo(4.4 * u, -8.2 * u); X.lineTo(1.6 * u, -7.3 * u); X.stroke(); }
        if (!g.result) K.sweat(3.8 * u, -8.6 * u, 1.4, tt + x);
        // hat
        if (!o.hatOff) {
          rr(-6.6 * u, -9 * u - 8, 13.2 * u, 16, 8); ink(o.hat, 4);
          K.dome(0, -9 * u - 4, 4 * u, 2.6 * u, o.hat, o.hatSh, 4); rr(-4 * u, -9 * u - 22, 8 * u, 11, 3); ink(o.band, 3);
          K.glintE(-2 * u, -9 * u - 30, 1.6 * u, 4, .35, -.2);
        }
        // the revolver
        if (o.shoot) {
          const hx = 6.6 * u + 4.65 * u * Math.sin(ra), hy = -5.2 * u - 4.65 * u * Math.cos(ra);
          X.save(); X.translate(hx, hy); X.rotate(ra - Math.PI / 2);
          K.celR(-8, 2, 15, 30, 6, '#8a5a2b', '#5e3a18', 2, 0, 3.5); K.celR(-12, -12, 34, 22, 7, '#c9ced6', '#7e88a3', 0, 3, 3.5); K.celR(18, -9, 38, 14, 5, '#c9ced6', '#7e88a3', 0, 2, 3.5);
          X.fillStyle = INK; X.fillRect(48, -14, 5, 6); K.celE(4, -1, 10, 10, '#a0a8b8', '#6a7388', 1, 1, 3);
          if (endT < .18) { const fl = 1 - endT / .18; K.star(72, -2, (38 + fl * 18), 16, 9, endT * 20, '#ffe14d', 4); K.star(72, -2, 24 * fl + 6, 10, 9, -endT * 14, '#fff', 0); }
          X.restore();
          if (endT > .08) { K.puff(hx + 60 + endT * 40, hy - 18 - endT * 50, 16 + endT * 18, 1 - endT * 1.2, '#f4ead8'); K.puff(hx + 90 + endT * 60, hy - 30 - endT * 70, 12 + endT * 14, .8 - endT * 1.1, '#f4ead8'); }
        } else if (ant) { /* hand hovers by the holster */ }
        X.restore();
      };
      const heroShoot = won, banShoot = lost;
      duelist(170, 1, { col: OR, hat: '#c9894a', hatSh: '#8a5a2b', band: '#7a4620', mood: wiiMood(g), shoot: heroShoot, fall: lost, hatOff: lost && endT > .1, badge: true, scarf: '#4DB8FF', brow: true });
      duelist(630, -1, { col: '#8a6ad6', hat: '#3a3a52', hatSh: '#22222f', band: '#ff4d5e', mood: won ? 'sad' : lost ? 'happy' : null, shoot: banShoot, fall: won, hatOff: won && endT > .1, scarf: '#ff4d5e', brow: true });
      // the flying hat of the loser
      if (g.result && endT > .1) {
        const q = endT - .1, dir = lost ? -1 : 1, hx0 = lost ? 170 : 630, hat = lost ? ['#c9894a', '#8a5a2b'] : ['#3a3a52', '#22222f'];
        X.save(); X.translate(hx0 + dir * 220 * q * (lost ? 1 : -1) * -1 * -1, 330 - 330 * q + 560 * q * q); X.rotate(q * 12 * dir);
        rr(-92, -8, 184, 16, 8); ink(hat[0], 4); K.dome(0, -4, 58, 36, hat[0], hat[1], 4); X.restore();
      }
      // the "!" and the waiting dots
      if (st === 1) { const pu = 1 + Math.max(0, .25 - tg * 2.5) * 2.4; X.save(); X.translate(W / 2, 170); X.rotate(Math.sin(tt * 40) * .04); K.star(0, 0, 84 * pu, 56 * pu, 14, tt * 1.5, '#ff4d5e', 5); txt('!', 0, 4, 120 * pu, '#FFE14D'); X.restore(); }
      if (st === 0) for (let i = 0; i < 3; i++) { const by = 190 + Math.sin(tt * 5 + i * 1.1) * 7; K.celE(W / 2 - 34 + i * 34, by, 11, 11, '#fff', '#dfe3f3', 2, 2, 3.5); }
      if (won) { K.badge('BANG!', 400, 262, 56, '#ff4d5e', '#FFE14D', outBack(rk / .22), -.08); K.badge(t('{n} MS', { n: Math.round(react * 1000) }), W / 2, 505, 28, '#4DB8FF', '#fff', outBack((rk - .1) / .25), .03); }
      if (lost && endT < .9) K.badge(tg > 0 ? 'TOO SLOW!' : 'TOO EARLY!', W / 2, 120, 40, '#ff4d5e', '#fff', outBack(rk / .22), -.04);
      vignette(.18);
    }
  };
  return g;
}

/* 4 ── SNEAK!: hold to creep, freeze when the dog looks */
function wiiSneakBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  let gr = X.createLinearGradient(0, 0, 0, 440); gr.addColorStop(0, '#3d4f9a'); gr.addColorStop(1, '#6f82cf'); X.fillStyle = gr; X.fillRect(L, 0, VW, 442);
  X.fillStyle = 'rgba(255,255,255,.06)'; for (let x = L; x < R; x += 50) X.fillRect(x, 0, 25, 440);
  X.fillStyle = 'rgba(255,214,102,.28)'; for (let y = 30; y < 430; y += 56) for (let x = L + 25; x < R; x += 50) { el(x + (y / 56 % 2) * 25, y, 4, 5); X.fill(); }
  // window with the moon
  X.beginPath(); X.moveTo(300, 250); X.lineTo(150, 440); X.lineTo(430, 440); X.lineTo(430, 250); X.closePath(); X.fillStyle = 'rgba(255,243,176,.07)'; X.fill();
  rr(266, 82, 156, 160, 14); ink('#e8d7a8', 5);
  X.save(); rr(272, 88, 144, 148, 10); X.clip(); gr = X.createLinearGradient(0, 88, 0, 236); gr.addColorStop(0, '#1d1840'); gr.addColorStop(1, '#3d3480'); X.fillStyle = gr; X.fillRect(266, 82, 160, 160);
  X.beginPath(); X.arc(370, 140, 28, 0, K.TAU); ink('#fff3b0', 3.5); X.fillStyle = '#e4d78a'; el(380, 136, 8, 6); X.fill(); el(362, 152, 6, 5); X.fill();
  X.fillStyle = '#fff'; for (const [sx, sy, r] of [[300, 120, 2.4], [330, 180, 2], [400, 200, 2.4], [310, 210, 1.6], [392, 104, 2]]) { X.beginPath(); X.arc(sx, sy, r, 0, K.TAU); X.fill(); }
  X.restore(); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(344, 88); X.lineTo(344, 236); X.moveTo(272, 160); X.lineTo(416, 160); X.stroke();
  rr(256, 238, 176, 14, 5); ink('#e8d7a8', 4);
  for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s < 0 ? 262 : 426, 80); X.quadraticCurveTo(s < 0 ? 300 : 388, 150, s < 0 ? 270 : 418, 236); X.lineTo(s < 0 ? 246 : 442, 236); X.quadraticCurveTo(s < 0 ? 280 : 408, 150, s < 0 ? 246 : 442, 80); X.closePath(); ink('#e4577a', 3.5); }
  // shelf with jars (left)
  rr(30, 186, 170, 12, 5); ink('#c98443', 4);
  [['#ffd23f', 40], ['#5CFF7A', 60], ['#ff8fab', 52], ['#4DB8FF', 44]].forEach(([c, h], i) => { K.celR(44 + i * 38, 186 - h, 30, h, 8, c, 'rgba(60,40,110,.4)', 4, 0, 3.5); rr(48 + i * 38, 186 - h - 8, 22, 9, 3); ink('#e8d7a8', 2.5); });
  // floor: checkered tiles
  const ys = [440, 462, 490, 526, 572, 640];
  for (let r = 0; r < 5; r++) for (let c = -14; c < 14; c++) {
    const s0 = (ys[r] - 330) / 110, s1 = (ys[r + 1] - 330) / 110, x0 = 400 + c * 56 * s0, x1 = 400 + (c + 1) * 56 * s0, x2 = 400 + (c + 1) * 56 * s1, x3 = 400 + c * 56 * s1;
    X.beginPath(); X.moveTo(x0, ys[r]); X.lineTo(x1, ys[r]); X.lineTo(x2, ys[r + 1]); X.lineTo(x3, ys[r + 1]); X.closePath(); X.fillStyle = (r + c) & 1 ? '#e9edf8' : '#c7d0ee'; X.fill();
  }
  X.strokeStyle = 'rgba(20,16,28,.18)'; X.lineWidth = 2; X.beginPath(); for (const y of ys) { X.moveTo(L, y); X.lineTo(R, y); } X.stroke();
  X.fillStyle = INK; X.fillRect(L, 436, VW, 5); rr(L - 6, 420, VW + 12, 18, 6); ink('#e8d7a8', 3.5);
  // the dog bed
  K.celE(655, 436, 138, 30, '#e4577a', '#b83a5c', 6, 10, 4.5); K.celE(655, 430, 112, 20, '#ff8fab', '#e4577a', 4, 6, 3);
}
function wiiSneak(sp) {
  const k = Math.sqrt(sp), BX = 610, X0 = 80;
  let p = 0, hold = false, st = 'sleep', stT = 0, stD = 1.3, lookT = 0, t = 0, endAt = -1;
  const hxp0 = () => X0 + p * (BX - 55 - X0);
  const press = () => { if (!g.result) hold = true; }, rel = () => { hold = false; };
  const g = {
    wide: true, cmd: 'SNEAK!', hint: 'HOLD TO CREEP · RELEASE WHEN HE LOOKS', thint: 'HOLD TO CREEP, LET GO WHEN HE LOOKS', dur: 6.2,
    key(e) { if (e.code === 'Space' && !e.repeat) press(); }, keyup(e) { if (e.code === 'Space') rel(); },
    down() { press(); }, up() { rel(); },
    update(dt) {
      t += dt; if (g.result) { if (endAt < 0) endAt = now; return; }
      stT += dt;
      if (stT >= stD) {
        stT = 0;
        if (st === 'sleep') { st = 'warn'; stD = .42 / k; sfx.blip(-5); }
        else if (st === 'warn') { st = 'look'; stD = (.55 + Math.random() * .35) / k; lookT = 0; sfx.buzz(); }
        else { st = 'sleep'; stD = (.9 + Math.random() * .7) / k; }
      }
      if (st === 'look') { lookT += dt; if (hold && lookT > .13) { g.result = 'lose'; sfx.miss(); sfx.buzz(); shake(10, .3); burst(hxp0(), 494, '#FF4D6D', 14); floatText('CAUGHT!', hxp0(), 440, '#FF4D6D', 36); return; } }
      if (hold) { p = Math.min(1, p + .36 * Math.pow(sp, .7) * dt); if (Math.random() < .15) snd(150 + p * 100, .04, 'triangle', .03); if (p >= 1) { g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(BX, 470, '#FFE14D', 16); ring(BX, 470, '#fff', 90, .4); floatText('GOT IT!', BX, 410, '#fff', 36); } }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt);
      K.layer('sneak', wiiSneakBg);
      const look = st === 'look' && !won, warn = st === 'warn' && !won, asleep = !look && !warn;
      // clock on the wall + the cat on the sill
      { const cx = 600, cy = 150; K.celE(cx, cy, 40, 40, '#fff', '#dfe3f3', 3, 3, 5); X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; X.moveTo(cx + Math.cos(a) * 31, cy + Math.sin(a) * 31); X.lineTo(cx + Math.cos(a) * 35, cy + Math.sin(a) * 35); } X.stroke();
        X.lineWidth = 5; X.beginPath(); X.moveTo(cx, cy); X.lineTo(cx + Math.cos(tt * .2) * 18, cy + Math.sin(tt * .2) * 18); X.stroke(); X.lineWidth = 3; X.beginPath(); X.moveTo(cx, cy); X.lineTo(cx + Math.cos(tt * 2.4) * 27, cy + Math.sin(tt * 2.4) * 27); X.stroke();
        X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(cx, cy + 40); X.lineTo(cx + Math.sin(tt * 3) * 12, cy + 84); X.stroke(); K.celE(cx + Math.sin(tt * 3) * 12, cy + 88, 8, 8, '#ffd23f', '#d9a31a', 1, 1, 3); }
      { const hx = hxp0(), cx = 345, cy = 232; X.save(); X.translate(cx, cy);
        const tail = Math.sin(tt * 2.2) * 14; K.qline(26, -2, 52, -8, 54 + tail, -34, 8, '#2b2438', 2.5);
        K.celE(0, -14, 24, 24, '#4a3f60', '#2b2438', 3, 3, 4); K.celE(0, -42, 18, 15, '#4a3f60', '#2b2438', 2, 2, 4);
        for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 8, -52); X.lineTo(s * 17, -66); X.lineTo(s * 18, -46); X.closePath(); ink('#4a3f60', 3); }
        const lx = clamp((hx - cx) / 300, -1, 1) * 3, big = look || lost ? 1.25 : 1;
        for (const s of [-1, 1]) { K.celE(s * 7, -43, 5.5 * big, 6.5 * big, '#ffe14d', '#e0b840', 1, 1, 2); X.fillStyle = INK; el(s * 7 + lx, -43, 1.8, 6 * big); X.fill(); }
        X.fillStyle = '#ff8fab'; X.beginPath(); X.moveTo(-2, -36); X.lineTo(2, -36); X.lineTo(0, -33); X.fill(); X.restore(); }
      // the dog
      const hx = look ? 520 : 540, hy = 335 + Math.sin(tt * 2) * (look ? 0 : 4), lunge = lost ? -Math.min(1, rk * 6) * 34 : 0;
      K.celR(560, 330, 190, 112, 46, '#c97a2b', '#9a561a', 8, 10, 6);
      K.celR(708, 402, 44, 46, 16, '#d98a3b', '#9a561a', 3, 3, 4);
      const wag = asleep ? Math.sin(tt * 5) * 10 : look ? 0 : Math.sin(tt * 18) * 4;
      K.qline(748, 372, 776, 366, 780 + wag, 322, 12, '#c97a2b', 3.5);
      K.celR(564, 408, 40, 38, 16, '#d98a3b', '#9a561a', 3, 3, 4);
      rr(hx + 46, hy + 54, 26, 18, 5); ink('#e4577a', 3.5); K.celE(hx + 59, hy + 76, 6, 6, '#ffd23f', '#d9a31a', 1, 1, 2.5);
      X.save(); X.translate(lunge, 0);
      const earUp = look ? .1 : 0;
      for (const [ex, ey, rot] of [[hx + 4, hy - 36, .4 - earUp * 3], [hx + 86, hy - 42, -.45 + earUp * 2]]) K.celE(ex, ey, 17, 30, '#8a4b12', '#5e3208', 3, 3, 4, rot);
      K.celE(hx + 40, hy, 62, 58, '#d98a3b', '#a85f1c', 8, 8, 6);
      K.celE(hx + 36, hy + 20, 36, 28, '#f1d6aa', '#d4b07c', 4, 4, 4); K.glintE(hx + 8, hy - 30, 20, 8, .3, -.4);
      K.celE(hx + 2, hy + 6, 11, 8, '#2a2030', '#14101c', 1, 1, 3); X.fillStyle = 'rgba(255,255,255,.7)'; el(hx - 1, hy + 3, 3.4, 2); X.fill();
      // eyes
      for (const ex of [hx + 18, hx + 66]) {
        if (look) { K.celE(ex, hy - 14, 15, 17, '#fff', '#e8d0d0', 2, 2, 3.5); X.fillStyle = '#FF2E4D'; el(ex - 5, hy - 13, 8.5, 9); X.fill(); X.fillStyle = INK; el(ex - 6, hy - 13, 3.6, 4); X.fill(); X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 14, hy - 40 + (ex > hx + 40 ? 6 : 0)); X.lineTo(ex + 14, hy - 30 + (ex > hx + 40 ? -6 : 0)); X.stroke(); }
        else if (warn && ex > hx + 40) { K.eye(ex, hy - 14, 11, 'idle', [-1, 0], tt, 3); }
        else { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.arc(ex, hy - 16, 10, Math.PI * .15, Math.PI * .85); X.stroke(); }
      }
      if (look || lost) { X.beginPath(); X.moveTo(hx - 2, hy + 24); X.quadraticCurveTo(hx + 28, hy + 30, hx + 52, hy + 20); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(hx + 4 + i * 12, hy + 26 - i * .5); X.lineTo(hx + 10 + i * 12, hy + 38 - Math.abs(i - 1.5) * 1.5); X.lineTo(hx + 14 + i * 12, hy + 25); X.fill(); } }
      else { X.beginPath(); X.moveTo(hx + 8, hy + 22); X.quadraticCurveTo(hx + 28, hy + 34, hx + 50, hy + 24); X.lineWidth = 4; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); }
      if (lost) { const o = Math.min(1, rk * 6); X.beginPath(); X.ellipse(hx + 26, hy + 34, 28, 9 + 16 * o, 0, 0, TAU); ink('#7a1f33', 4); X.fillStyle = '#ff6b8a'; el(hx + 28, hy + 42 + 5 * o, 12, 8 * o + 2); X.fill(); X.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(hx + 6 + i * 13, hy + 28); X.lineTo(hx + 12 + i * 13, hy + 38); X.lineTo(hx + 16 + i * 13, hy + 28); X.fill(); } }
      X.restore();
      if (look && !lost) { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(hx + 22 + i * 24, hy - 62); X.lineTo(hx + 16 + i * 24, hy - 80); X.stroke(); } }
      if (lost) { X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = 2.4 + i * .5, q = (rk * 4 + i * .3) % 1; X.globalAlpha = 1 - q; X.beginPath(); X.arc(hx - 30 + lunge, hy + 36, 30 + q * 50 + i * 16, a - .3, a + .3); X.stroke(); } X.globalAlpha = 1; }
      // snot bubble, Zs and the dream
      if (asleep || won) { const bs = 7 + (1 + Math.sin(tt * 2.4)) * 6; K.celE(hx - 14 - bs, hy + 4 - bs * .3, bs, bs, 'rgba(210,244,255,.85)', 'rgba(140,200,235,.8)', 1, 1, 2.5); K.glintE(hx - 14 - bs - bs * .3, hy + 4 - bs * .6, bs * .25, bs * .15, .8, -.5);
        for (let i = 0; i < 2; i++) { const q = (tt * .5 + i * .5) % 1; K.zee(hx + 90 + i * 22, hy - 70 - q * 36 - i * 14, .9 + i * .2, Math.sin(q * Math.PI)); }
        K.celE(hx + 130, hy - 130, 30, 22, '#fff', '#dfe3f3', 3, 3, 3.5); K.celE(hx + 100, hy - 98, 7, 6, '#fff', '#dfe3f3', 1, 1, 2.5); K.celE(hx + 90, hy - 84, 4, 3.5, '#fff', '#dfe3f3', 1, 1, 2);
        if (won) K.heart(hx + 130, hy - 130, 1.2, 1); else { X.save(); X.translate(hx + 130, hy - 130); X.rotate(-.3); K.line([[-14, 0], [14, 0]], 6, '#fff', 2.5); for (const [a, b] of [[-14, -5], [-14, 5], [14, -5], [14, 5]]) K.celE(a, b, 5, 5, '#fff', '#dfe3f3', 1, 1, 2.5); X.restore(); } }
      if (warn) K.badge('!', hx + 40, hy - 98 + Math.sin(tt * 30) * 3, 40, '#FFE14D', '#ff4d5e', 1, -.05);
      if (look && !lost) K.badge('HMM?', hx + 60, hy - 108, 26, '#ff4d5e', '#fff', 1, .05);
      // the bone
      const hxp = X0 + p * (BX - 55 - X0) + (lost ? Math.sin(tt * 40) * 4 : 0) * (1 - Math.min(1, rk * 4));
      const boneK = won ? ease(rk / .2) : 0, bnx = K.lerp(BX, hxp + 26, boneK), bny = K.lerp(470, 494, boneK) - (won ? Math.sin(boneK * Math.PI) * 14 : 0);
      X.save(); X.translate(bnx, bny); X.rotate(-.3); K.line([[-30, 0], [30, 0]], 12, '#fff', 3); for (const [a, b] of [[-34, -8], [-34, 8], [34, -8], [34, 8]]) K.celE(a, b, 10, 10, '#fff', '#dfe3f3', 2, 2, 3); X.restore();
      K.shade(bnx, 486, 36, 7, .22);
      // Caos and the long arm
      const back = lost ? Math.min(1, rk * 5) : 0, hx2 = K.lerp(hxp, 150, back);
      K.shade(70, 524, 44, 8);
      X.save(); X.translate(70, 520);
      caos(0, 0, 5.5, { mood: wiiMood(g) });
      if (hold && !g.result) K.sweat(40, -50, 1, tt); if (look && hold) K.sweat(-38, -52, 1, tt + .5);
      X.restore();
      K.tag(70, 520 - 5.5 * 9 - 28);
      K.reach(70 + 36, 520 - 28.6, hx2 - 6, 494, OR, 12, 22);
      X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i < 3; i++) { X.moveTo(hx2 + 4, 487 + i * 7); X.lineTo(hx2 + 12, 487 + i * 7); } X.stroke();
      if (!g.result && hold && look) K.badge('FREEZE!', W / 2, 150, 40, '#ff4d5e', '#fff', 1, .03);
      vignette(.2);
    }
  };
  return g;
}

/* 5 ── UMBRELLA!: pop the umbrella when the meter is in the green */
function wiiUmbrellaBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  let gr = X.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, '#34406e'); gr.addColorStop(1, '#5a6ca0'); X.fillStyle = gr; X.fillRect(L, 0, VW, 502);
  // far skyline (coloured outline, no ink) with lit windows
  for (let i = -Math.ceil(OX / 120); i < 8 + Math.ceil(OX / 120); i++) {
    const h = 150 + K.hash(i + 3) * 130, w = 96 + K.hash(i + 9) * 24, x = i * 120 + 10;
    rr(x, 500 - h, w, h + 10, 6); ink('#46548a', 3.5, '#2c3558');
    X.fillStyle = '#ffd86a'; for (let wy = 500 - h + 18; wy < 480; wy += 34) for (let wx = x + 12; wx < x + w - 16; wx += 26) if (K.hash(wx * .7 + wy * 1.3 + i) > .62) { rr(wx, wy, 13, 18, 3); X.fill(); }
  }
  // brick alley wall with a neon cup sign
  rr(L - 10, 330, VW + 20, 190, 0); X.fillStyle = '#6b5a82'; X.fill();
  X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = 2; X.beginPath(); for (let y = 346, i = 0; y < 500; y += 24, i++) { X.moveTo(L, y); X.lineTo(R, y); for (let x = L + (i % 2) * 36; x < R; x += 72) { X.moveTo(x, y); X.lineTo(x, y + 24); } } X.stroke();
  // ground
  gr = X.createLinearGradient(0, 500, 0, 600); gr.addColorStop(0, '#46547a'); gr.addColorStop(1, '#2c3550'); X.fillStyle = gr; X.fillRect(L, 500, VW, 100);
  X.fillStyle = INK; X.fillRect(L, 498, VW, 5);
  X.fillStyle = 'rgba(243,220,166,.22)'; for (let x = L + 30; x < R; x += 150) { rr(x, 560, 70, 10, 5); X.fill(); }
  for (let i = -Math.ceil(OX / 200); i < 3 + Math.ceil(OX / 200); i++) { X.fillStyle = 'rgba(160,196,235,.35)'; el(200 + i * 200, 530 + (Math.abs(i) % 2) * 20, 56, 9); X.fill(); X.fillStyle = 'rgba(255,255,255,.4)'; el(190 + i * 200, 528 + (Math.abs(i) % 2) * 20, 22, 3); X.fill(); }
  // street lamp
  K.celR(583, 190, 9, 312, 3, '#3b3550', '#241f36', 2, 0, 3.5); K.celE(587, 186, 22, 12, '#fff3a0', '#e0b840', 3, 3, 4); rr(571, 168, 32, 12, 4); ink('#3b3550', 3.5);
  // cardboard box (the cat's)
  K.celR(640, 462, 96, 46, 5, '#d9944f', '#a5622c', 4, 4, 4); X.fillStyle = 'rgba(165,98,44,.55)'; X.fillRect(676, 464, 24, 40);
}
function wiiUmbrella(sp) {
  const zw = .2 / Math.pow(sp, .35), zc = .3 + Math.random() * .45, per = 1.7 / sp;
  let t = 0, cur = 0, open = 0, wet = 0, endAt = -1; const drops = [];
  const g = {
    wide: true, cmd: 'UMBRELLA!', hint: 'CLICK / SPACE WHEN THE BAR IS GREEN', thint: 'TAP WHEN THE BAR IS GREEN', dur: 4.8,
    key(e) { if (e.code === 'Space') go(); }, down() { go(); },
    update(dt) {
      t += dt; if (g.result && endAt < 0) endAt = now;
      const ph = Math.max(0, t - .5) / per; cur = ph ? 1 - Math.abs(((ph + .25) % 1) * 2 - 1) : 0;
      const inten = g.result === 'win' ? 1 : Math.min(1, .25 + t * .22);
      if (Math.random() < dt * (10 + inten * 60) * VW / W) drops.push({ x: 120 - OX + Math.random() * (560 + OX * 2), y: 130, v: 500 + Math.random() * 200 });
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.y += d.v * dt;
        if (open > .8 && Math.abs(d.x - 400) < 95 && d.y > 330 - 40 * Math.sin(Math.abs(d.x - 400) / 95)) { drops.splice(i, 1); continue; }
        if (d.y > 520) drops.splice(i, 1);
      }
      if (g.result === 'win') open = Math.min(1, open + dt * 7);
      if (open > .8) for (const d of drops) if (d.sp !== 1 && Math.abs(d.x - 400) < 95 && d.y > 280 && d.y < 340) { d.sp = 1; if (Math.random() < .3) { sfx.click(); burst(d.x, 335, '#cfe6ff', 2, 120); } }
      if (g.result === 'lose') wet = Math.min(1, wet + dt * 2);
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt);
      K.layer('umb', wiiUmbrellaBg);
      // neon cup sign flickers on the wall
      { const fl = Math.sin(now * 23) > .9 ? .35 : 1; X.save(); X.globalAlpha = fl; rr(190, 372, 112, 74, 16); ink('#2c3558', 4); K.celR(214, 392, 40, 36, 10, '#ff8fab', '#d9647f', 3, 3, 3); X.strokeStyle = '#ff8fab'; X.lineWidth = 6; X.beginPath(); X.arc(260, 408, 10, -Math.PI / 2, Math.PI / 2); X.stroke(); for (let i = 0; i < 2; i++) { X.beginPath(); X.moveTo(226 + i * 14, 384); X.quadraticCurveTo(220 + i * 14, 376, 228 + i * 14, 368); X.lineWidth = 3; X.stroke(); } X.globalAlpha = .18 * fl; X.fillStyle = '#ff8fab'; el(246, 410, 70, 52); X.fill(); X.restore(); }
      // storm clouds (behind the hint)
      for (let k = -Math.ceil(OX / 500); k <= Math.ceil(OX / 500); k++) for (const [cx, cy, r] of [[180, 90, 60], [260, 70, 75], [340, 95, 60], [470, 80, 70], [560, 70, 75], [640, 95, 58]]) { const dx = Math.sin(now * .3 + cx) * 6; K.celE(cx + k * 500 + dx, cy, r, r, '#5d647e', '#3c4260', 5, 8, 4, 0); }
      // lamp glow + rain
      X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = 'rgba(255,230,140,.13)'; X.beginPath(); X.moveTo(578, 196); X.lineTo(596, 196); X.lineTo(670, 500); X.lineTo(504, 500); X.closePath(); X.fill(); X.restore();
      X.strokeStyle = '#cfe6ff'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (const d of drops) { X.moveTo(d.x, d.y); X.lineTo(d.x - 3, d.y - 16); } X.stroke();
      // puddle ripples
      for (let i = 0; i < 4; i++) { const q = (now * .9 + i * .27) % 1; X.strokeStyle = `rgba(207,230,255,${.6 * (1 - q)})`; X.lineWidth = 2.5; el(150 + i * 170 + (i % 2) * 40, 540 + (i % 3) * 10, 8 + q * 30, 2 + q * 7); X.stroke(); }
      // the cat in the box, smug under a leaf
      { const cx = 688, cy = 466, lk = clamp((400 - cx) / 300, -1, 1) * -1; X.save(); X.translate(cx, cy);
        K.celE(0, -12, 24, 22, '#f2a65a', '#c97a38', 3, 3, 4); for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 8, -28); X.lineTo(s * 19, -42); X.lineTo(s * 21, -22); X.closePath(); ink('#f2a65a', 3); }
        const cm = lost ? 'happy' : won ? 'panic' : 'idle'; K.eye(-9, -14, 5.5, cm, [-1, 0], now, 8); K.eye(9, -14, 5.5, cm, [-1, 0], now, 9);
        X.fillStyle = '#ff8fab'; X.beginPath(); X.moveTo(-3, -6); X.lineTo(3, -6); X.lineTo(0, -2); X.fill(); X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, -2); X.lineTo(0, 1); X.stroke();
        X.beginPath(); X.moveTo(-5, 1); X.quadraticCurveTo(-2, 5, 0, 1); X.quadraticCurveTo(2, 5, 5, 1); X.stroke();
        X.save(); X.translate(0, -32); X.rotate(-.3 + Math.sin(now * 2) * .05); X.beginPath(); X.moveTo(-30, 8); X.quadraticCurveTo(0, -26, 30, 8); X.quadraticCurveTo(0, 0, -30, 8); ink('#5bcf72', 3); X.restore();
        X.restore(); K.celR(640, 478, 96, 32, 5, '#d9944f', '#a5622c', 4, 4, 4); }
      // the spy
      const shiver = lost ? Math.sin(now * 50) * 2 * (1 - clamp(rk, 0, 1) * .4) : 0;
      K.shade(400, 504, 70, 10, .3);
      X.save(); X.translate(shiver, 0);
      caos(400, 500, 9, { col: '#8a8f9e', mood: wiiMood(g) });
      X.fillStyle = INK; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(400 + s * 54, 436); X.lineTo(400 + s * 54, 412); X.lineTo(400 + s * 28, 436); X.closePath(); ink('#6e7488', 3.5); }
      rr(346, 466, 108, 10, 3); ink('#5b5f6e', 3); rr(392, 463, 16, 16, 4); ink('#ffd23f', 3);
      for (let i = 0; i < 2; i++) { X.fillStyle = INK; X.beginPath(); X.arc(400, 484 + i * 8, 2.4, 0, TAU); X.fill(); }
      // fedora
      rr(330, 410, 140, 14, 7); ink('#2b2b3a', 4); K.dome(400, 412, 46, 30, '#3a3a52', '#22222f', 4); rr(354, 394, 92, 10, 3); ink('#ff4d5e', 3); K.glintE(380, 384, 14, 4, .3, -.2);
      if (!won && !lost) K.sweat(452, 442, 1, tt);
      if (wet > 0) { X.save(); rr(346, 419, 108, 63, 8); X.clip(); X.fillStyle = `rgba(60,140,230,${.42 * wet})`; X.fillRect(340, 410, 120, 110); X.restore(); for (let i = 0; i < 4; i++) { const q = (now * 2.4 + i * .25) % 1; X.fillStyle = '#9fe3ff'; el(340 + i * 40 + (i % 2) * 20, 424 + q * 70, 3, 5); X.fill(); } }
      X.restore();
      K.tag(400 + shiver, 372);
      // umbrella
      if (open > 0) {
        const s = ease(open), hx = 437, hy = 418;
        X.save(); X.translate(400, 430 - 80 * s);
        const shx = hx - 400, shy = hy - (430 - 80 * s);
        K.line([[0, 0], [shx, shy]], 7, '#3b3550', 3);
        X.beginPath(); X.arc(shx, shy + 6, 10, 0, Math.PI); X.lineWidth = 6 + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#3b3550'; X.stroke();
        X.scale(s, s); const P = new Path2D(); P.moveTo(-104, 4); P.arc(0, 4, 104, Math.PI, 0); for (let i = 0; i < 4; i++) P.quadraticCurveTo(104 - i * 52 - 26, 26, 104 - i * 52 - 52, 4); P.closePath();
        X.lineJoin = 'round'; X.lineWidth = 9; X.strokeStyle = INK; X.stroke(P); X.fillStyle = '#c22f45'; X.fill(P);
        X.save(); X.clip(P); X.fillStyle = '#ff4d5e'; X.translate(-7, -9); X.fill(P); X.translate(7, 9);
        X.fillStyle = '#FFE14D'; for (let i = -1; i <= 1; i += 2) { X.beginPath(); X.moveTo(0, 4); X.arc(0, 4, 106, Math.PI + (i > 0 ? .6 : 1.6), Math.PI + (i > 0 ? 1.57 : 2.55)); X.fill(); }
        X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); for (let i = 1; i < 4; i++) { const a = Math.PI + i * Math.PI / 4; X.moveTo(0, 4); X.lineTo(Math.cos(a) * 104, 4 + Math.sin(a) * 104); } X.stroke();
        X.fillStyle = 'rgba(255,255,255,.4)'; el(-52, -52, 30, 10, -.7); X.fill(); X.restore(); K.celE(0, -102, 6, 8, '#ffd23f', '#d9a31a', 1, 1, 3);
        X.restore();
        K.reach(459, 453, hx + 4, hy + 2, '#8a8f9e', 11, 16);
      }
      if (won) { X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = `rgba(255,240,150,${.2 * clamp(rk * 3, 0, 1)})`; X.beginPath(); X.moveTo(380, 60); X.lineTo(420, 60); X.lineTo(560, 500); X.lineTo(240, 500); X.closePath(); X.fill(); X.restore(); for (let i = 0; i < 3; i++) { const q = (rk * 1.3 + i / 3) % 1; K.heart(310 + i * 90, 300 - q * 60, .7, 1 - q); } }
      if (lost) {   // a rain cloud of one's own, dripping on the spy
        const k = outBack(rk / .3); K.cloud(354, 310 - 4 * Math.sin(now * 5), 1.1 * k, '#6d7694', '#8a93b0'); X.strokeStyle = '#9fe3ff'; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i < 5; i++) { const y = 340 + ((now * 260 + i * 25) % 90); X.moveTo(366 + i * 14, y); X.lineTo(364 + i * 14, y + 10); } X.stroke();
        K.eye(374, 316, 4.5, 'sleep', [0, 0], now, 1); K.eye(398, 316, 4.5, 'sleep', [0, 0], now, 2);
        K.celE(500, 534, 26 * clamp(rk * 2, 0, 1), 5 * clamp(rk * 2, 0, 1), 'rgba(120,180,235,.6)', 'rgba(90,150,210,.6)', 0, 1, 0);
      }
      // the rain-o-meter
      const cy = 480 - cur * 340, wx = 80;
      rr(wx - 12, 474, 78, 18, 8); ink('#8f9cb3', 4); rr(wx - 12, 128, 78, 16, 8); ink('#8f9cb3', 4);
      K.gauge(wx, 140, 54, 340, 0, '#fff', [zc - zw / 2, zc + zw / 2]);
      const hot = !g.result && cur >= zc - zw / 2 && cur <= zc + zw / 2;
      rr(wx - 14, cy - 8, 82, 16, 8); ink(hot ? '#5CFF7A' : '#FFE14D', 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; rr(wx - 8, cy - 5, 40, 4, 2); X.fill();
      X.save(); X.translate(wx + 27, 112); K.celE(0, 4, 14, 8, '#ff4d5e', '#c22f45', 2, 2, 3); X.restore();   // little umbrella icon
      if (t < .5) K.badge('RAIN!', W / 2, 250, 54, '#4DB8FF', '#fff', outBack(t / .2), -.04);
      vignette(.2);
    }
  };
  function go() {
    if (g.result || t < .35) return;
    if (cur >= zc - zw / 2 && cur <= zc + zw / 2) { g.result = 'win'; sfx.pop(); sfx.sparkle(); ring(400, 350, '#fff', 130, .45); burst(400, 340, '#FF4D6D', 16); floatText('PERFECT!', 400, 250, '#5CFF7A', 38); }
    else { g.result = 'lose'; sfx.splat(); wiiBang(400, 450); }
  }
  return g;
}

/* 6 ── POP IT!: pump the balloon (press = push, release = pull) until it bursts */
function wiiPopBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  let gr = X.createLinearGradient(0, 0, 0, 520); gr.addColorStop(0, '#ffe9a8'); gr.addColorStop(1, '#ffd76a'); X.fillStyle = gr; X.fillRect(L, 0, VW, 522);
  for (let i = 0; i < 60; i++) { const x = L + K.hash(i) * VW, y = 20 + K.hash(i + 70) * 480; X.fillStyle = ['rgba(255,120,150,.35)', 'rgba(77,184,255,.3)', 'rgba(255,255,255,.5)'][i % 3]; X.beginPath(); X.arc(x, y, 7 + K.hash(i + 5) * 8, 0, K.TAU); X.fill(); }
  // bunting
  const cols = ['#ff4d5e', '#4DB8FF', '#5CFF7A', '#ff8fab', '#c77dff'];
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); for (let x = L; x <= R; x += 10) X.lineTo(x, 66 + Math.sin((x - L) / VW * Math.PI) * 52); X.stroke();
  for (let x = L + 24, i = 0; x < R - 10; x += 46, i++) { const y = 66 + Math.sin((x - L) / VW * Math.PI) * 52 + 2; X.beginPath(); X.moveTo(x - 17, y); X.lineTo(x + 17, y); X.lineTo(x, y + 36); X.closePath(); ink(cols[i % 5], 3); }
  // floor planks
  X.fillStyle = '#c98a52'; X.fillRect(L, 520, VW, 80); X.fillStyle = INK; X.fillRect(L, 518, VW, 5);
  X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 3; X.beginPath(); for (const y of [548, 578]) { X.moveTo(L, y); X.lineTo(R, y); } for (let x = L + 20, i = 0; x < R; x += 120, i++) { X.moveTo(x + (i % 2) * 50, 523); X.lineTo(x + (i % 2) * 50, 548); X.moveTo(x + 60 - (i % 2) * 50, 548); X.lineTo(x + 60 - (i % 2) * 50, 578); } X.stroke();
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 524; y < 600; y += 30) X.fillRect(L, y, VW, 6);
  // party table with a cake (right)
  rr(634, 466, 172, 16, 6); ink('#d9944f', 4); K.celR(646, 482, 148, 52, 4, '#ff8fab', '#d9647f', 6, 0, 4); X.fillStyle = '#fff'; for (let x = 654; x < 790; x += 20) { X.beginPath(); X.arc(x, 534, 9, 0, Math.PI); ink('#fff', 2.5); }
  K.celR(692, 436, 70, 30, 8, '#fff3d6', '#e8c98c', 5, 0, 4); K.celR(706, 410, 42, 26, 8, '#ff8fab', '#d9647f', 4, 0, 4); X.fillStyle = '#5CFF7A'; for (let x = 700; x < 760; x += 14) { X.beginPath(); X.arc(x, 438, 4, 0, K.TAU); X.fill(); }
  rr(725, 390, 6, 22, 2); ink('#4DB8FF', 2.5);
}
function wiiPop(sp) {
  const n = 9 + Math.floor(sp * 1.4), inc = 1 / n;
  let s = 0, up = true, hy = 0, pop = 0, wob = 0, endAt = -1;
  const push = e => { if (g.result || !up || (e && e.repeat)) return; up = false; s = Math.min(1, s + inc); wob = .25; snd(220 + s * 700, .09, 'triangle', .08, 0, 260 + s * 800); noise(.06, .03, 1500, 3000, 'highpass'); burst(430, 395, '#fff', 3, 120); if (s >= 1) { g.result = 'win'; pop = .001; sfx.stamp(); sfx.pop(); sfx.sparkle(); shake(14, .35); ring(520, 300, '#FF4D6D', 200, .5); burst(520, 300, '#FF4D6D', 22, 380); confetti(400, 250, 60); } };
  const pull = () => { up = true; };
  const g = {
    wide: true, cmd: 'POP IT!', hint: 'PUMP: PRESS AND RELEASE SPACE / CLICK', thint: 'TAP TAP TAP TO PUMP', dur: 5.8,
    key(e) { if (e.code === 'Space') push(e); }, keyup(e) { if (e.code === 'Space') pull(); }, down() { push(); }, up() { pull(); },
    update(dt) {
      if (g.result && endAt < 0) endAt = now;
      wob = Math.max(0, wob - dt); hy += ((up ? 0 : 1) - hy) * Math.min(1, 22 * dt);
      if (pop) pop += dt; else if (s > 0) s = Math.max(0, s - .05 * dt);
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt);
      K.layer('pop', wiiPopBg);
      // candle flame on the cake leans away from the balloon, blown out at the bang
      if (!won) { const fl = Math.sin(now * 14) * 2; X.beginPath(); X.moveTo(728, 386); X.quadraticCurveTo(722 + fl - s * 6, 372, 728 + fl - s * 6, 362); X.quadraticCurveTo(738, 374, 728, 386); ink('#ffb21e', 2); } else { K.puff(728, 380 - rk * 30, 6 + rk * 8, 1 - rk, '#cfd5e3'); }
      // the party dachshund: ears covered as the balloon grows, fainted after the bang
      { const dx = 200, dy = 528, sc = clamp(s, 0, 1), ck = won ? 'bonk' : lost ? 'happy' : sc > .55 ? 'panic' : 'idle';
        K.shade(dx, dy + 2, 60, 8); X.save(); X.translate(dx, dy - 20); if (won) X.rotate(Math.min(1, rk * 4) * Math.PI); X.translate(0, 20);
        K.qline(46, -22, 70, -24, 74, -44 + Math.sin(now * 12) * (won ? 0 : 6), 8, '#c97a2b', 3);
        K.celE(0, -20, 52, 20, '#d98a3b', '#a85f1c', 5, 6, 4.5); for (const lx of [-30, -4, 22, 40]) K.celR(lx - 7, -12, 14, 14, 5, '#d98a3b', '#a85f1c', 2, 2, 3.5);
        K.celE(-52, -34, 21, 19, '#d98a3b', '#a85f1c', 3, 4, 4.5); K.celE(-68, -30, 14, 10, '#f1d6aa', '#d4b07c', 2, 2, 3.5); K.celE(-78, -34, 5, 4, '#2a2030', '#14101c', 1, 1, 2);
        const lk = [clamp((520 - dx) / 300, -1, 1), -.4];
        K.eye(-48, -42, 6, ck, lk, now, 4);
        if (sc > .45 && !won) { for (const [ex, ey] of [[-38, -22], [-62, -22]]) K.celE(ex, ey, 7, 9, '#f1d6aa', '#d4b07c', 1, 1, 3); K.celE(-38, -46, 10, 15, '#8a4b12', '#5e3208', 2, 2, 3.5, -.5); } else K.celE(-34, -50, 10, 17, '#8a4b12', '#5e3208', 2, 2, 3.5, -.5);
        X.beginPath(); X.moveTo(-60, -50); X.lineTo(-48, -76); X.lineTo(-36, -50); X.closePath(); ink('#4DB8FF', 3); K.celE(-48, -78, 5, 5, '#ffd23f', '#d9a31a', 1, 1, 2);
        X.restore(); if (sc > .5 && !won && !lost) K.sweat(dx - 52, dy - 62, .9, tt); if (won) K.zee(dx - 30, dy - 70 - ((rk * 30) % 20), 1, 1); }
      // hose + pump
      K.shade(410, 544, 60, 9, .25); K.qline(400, 490, 500, 520, 520, 420, 8, '#8f9cb3', 3);
      K.celR(380, 480, 60, 60, 10, '#4DB8FF', '#2a8fcb', 6, 0, 5); K.glintE(394, 496, 8, 14, .5, 0.1);
      K.celE(410, 512, 19, 19, '#fff', '#dfe3f3', 2, 2, 3.5); X.strokeStyle = '#ff4d5e'; X.lineWidth = 4; X.beginPath(); X.arc(410, 512, 14, 0.2, 1.1); X.stroke();
      const na = -2.6 + s * 2.8; X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(410, 512); X.lineTo(410 + Math.cos(na) * 13, 512 + Math.sin(na) * 13); X.stroke();
      K.celR(406, 400 + hy * 70, 8, 94 - hy * 70, 3, '#e6e9f0', '#aab3c4', 2, 0, 3); const hyy = 388 + hy * 70; K.celR(370, hyy, 80, 18, 9, '#ff4d5e', '#c22f45', 0, 4, 4);
      // Caos pumping, with a long inked arm to the handle
      const hdx = 372, hdy = hyy + 9;
      K.shade(325, 534, 40, 8);
      X.save(); X.translate(325, 532); caos(0, 0, 7, { mood: wiiMood(g) }); if (!won && !lost) K.sweat(-36, -52, .9, tt + 1); X.restore();
      if (won) { for (let i = 0; i < 2; i++) { rr(300 + i * 20 - 22, 466 - i * 6, 8, 20, 4); } }
      K.reach(325 + 46, 532 - 36, hdx + 6, hdy, OR, 10, 17);
      K.tag(325, 532 - 7 * 9 - 26);
      // balloon
      const r = pop ? 0 : (40 + s * 120 + Math.sin(tt * 40) * wob * 14) * (lost ? 1 - .5 * ease(rk * 1.5) : 1), bx = 520, by = lost ? 420 - r - 18 + ease(rk * 1.5) * 40 : 420 - r - 18;
      if (!pop) {
        const gg = Math.floor(120 * (1 - s)), col = `rgb(255,${60 + gg},${150 - Math.floor(s * 100)})`, sh = `rgb(205,${30 + Math.floor(gg * .6)},${110 - Math.floor(s * 70)})`;
        X.save(); X.translate(bx, by); X.rotate(lost ? Math.sin(rk * 8) * .2 * (1 - clamp(rk, 0, 1)) : 0);
        X.beginPath(); X.moveTo(-7, r * 1.05 + 4); X.lineTo(7, r * 1.05 + 4); X.lineTo(0, r * 1.05 - 8); X.closePath(); ink(sh, 3);
        K.celE(0, 0, r * .9, r * 1.05, col, sh, r * .09, r * .09, 5);
        X.fillStyle = 'rgba(255,255,255,.55)'; el(-r * .4, -r * .45, r * .12, r * .24, -.6); X.fill();
        const e = r * .3, big = 1 + s * .35; for (const sx of [-1, 1]) { K.celE(sx * e, -r * .08, r * .14 * big, r * .16 * big, '#fff', '#dfe3f3', 1, 1, 3); X.fillStyle = INK; el(sx * e - 1, -r * .06 + (s > .5 ? 0 : 1), r * .06, r * .07); X.fill(); }
        X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath();
        if (lost) { X.arc(0, r * .5, r * .14, Math.PI * 1.1, Math.PI * 1.9); } else if (s > .55) { X.moveTo(-r * .2, r * .38); for (let i = 1; i <= 5; i++) X.lineTo(-r * .2 + i * r * .08, r * .38 + (i % 2 ? -5 : 5)); } else X.arc(0, r * .3, r * .16, .2, Math.PI - .2); X.stroke();
        if (s > .6 && !lost) for (let i = 0; i < 5; i++) { const a = -2.3 + i * .5; X.beginPath(); X.moveTo(Math.cos(a) * r * .95, Math.sin(a) * r * 1.1); X.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.3); X.stroke(); }
        if (s > .5 && !lost) K.sweat(r * .62, -r * .4, 1.1, tt);
        X.restore();
      } else {
        const q = pop; K.star(bx, by + 40, clamp(150 - q * 200, 0, 150), clamp(70 - q * 90, 0, 70), 12, tt, '#fff', 5);
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + .3, v = 220 + (i % 3) * 70, px = bx + Math.cos(a) * v * q, py = by + 40 + Math.sin(a) * v * q + 500 * q * q; X.save(); X.translate(px, py); X.rotate(q * 9 + i); X.beginPath(); X.moveTo(-10, -7); X.quadraticCurveTo(2, -12, 12, 0); X.quadraticCurveTo(0, 10, -10, -7); ink('#ff5c8a', 2.5); X.restore(); }
        K.badge('BANG!', bx, by + 40, 52, '#ff4d5e', '#fff', outBack(q / .2), -.1);
      }
      // party hat on Caos's pal, streamers after the pop
      if (won) for (let i = 0; i < 9; i++) { const a = i * TAU / 9, v = 160 + (i % 3) * 80, q = rk; X.strokeStyle = ['#ff4d5e', '#4DB8FF', '#5CFF7A', '#FFE14D'][i % 4]; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(bx + Math.cos(a) * 30, by + 40 + Math.sin(a) * 30); X.quadraticCurveTo(bx + Math.cos(a) * v * q * .6, by + 40 + Math.sin(a) * v * q * .6 + 40 * q, bx + Math.cos(a) * v * q, by + 40 + Math.sin(a) * v * q + 120 * q * q); X.stroke(); }
      vignette(.16);
    }
  };
  return g;
}

/* 7 ── STRIKE!: slash the coin only while it is in the glowing band */
function wiiStrikeBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  X.fillStyle = '#f6ecd2'; X.fillRect(L, 0, VW, 502);
  X.fillStyle = 'rgba(255,225,120,.22)'; for (let x = L; x < R; x += 200) X.fillRect(x + 100, 62, 100, 440);
  X.strokeStyle = '#a5622c'; X.lineWidth = 6; X.beginPath(); for (let x = L - ((L % 100) + 100) % 100; x < R; x += 100) { X.moveTo(x, 62); X.lineTo(x, 500); } for (const y of [62, 180, 300, 420, 500]) { X.moveTo(L, y); X.lineTo(R, y); } X.stroke();
  X.strokeStyle = 'rgba(165,98,44,.5)'; X.lineWidth = 2; X.beginPath(); for (let x = L - ((L % 100) + 100) % 100 + 50; x < R; x += 100) { X.moveTo(x, 62); X.lineTo(x, 500); } for (const y of [121, 240, 360, 460]) { X.moveTo(L, y); X.lineTo(R, y); } X.stroke();
  rr(L - 10, 36, VW + 20, 28, 6); ink('#7a4620', 4); X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(L, 40, VW, 6);
  X.fillStyle = INK; X.fillRect(L, 498, VW, 5); X.fillStyle = '#c98443'; X.fillRect(L, 503, VW, 100);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); for (let i = -Math.ceil(OX / 100); i < 8 + Math.ceil(OX / 100); i++) { X.moveTo(i * 100 + 6, 503); X.lineTo(i * 100 - 14, 600); } X.moveTo(L, 548); X.lineTo(R, 548); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.14)'; for (let y = 508; y < 600; y += 44) X.fillRect(L, y, VW, 6);
  for (const x of [110, 690]) { K.celR(x - 18, 60, 36, 440, 6, '#e0453d', '#a52a2e', 7, 0, 4); rr(x - 24, 88, 48, 14, 5); ink('#ffd23f', 3.5); rr(x - 24, 440, 48, 14, 5); ink('#ffd23f', 3.5); K.celR(x - 26, 490, 52, 14, 5, '#aab3c4', '#7e88a3', 3, 3, 3.5); }
}
function wiiStrike(sp) {
  const GY = 380, band = 52, v = 150 * sp, cx = 250 + Math.random() * 300, ph = Math.random() * 6;
  const T = { x: cx, y: -40 }, trail = []; let t = 0, hit = 0, slash = null, warn = 0, hitDir = 0, endAt = -1;
  const g = {
    wide: true, cmd: 'STRIKE!', hint: 'SWIPE ACROSS THE COIN IN THE GLOW', thint: 'SWIPE THROUGH THE COIN IN THE GLOW', dur: 5,
    move(p) {
      if (g.result) return;
      trail.push({ x: p.x, y: p.y, t }); while (trail.length && t - trail[0].t > .13) trail.shift();
      if (trail.length < 2 || t < .2) return;
      let len = 0, near = false;
      for (let i = 1; i < trail.length; i++) { len += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y); if (segD(T.x, T.y, trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y) < 36) near = true; }
      if (len < 130 || !near) return;
      if (Math.abs(T.y - GY) <= band) { g.result = 'win'; hit = .001; slash = trail.slice(); const a = slash[0], b = slash[slash.length - 1]; hitDir = Math.atan2(b.y - a.y, b.x - a.x); sfx.whoosh(false); sfx.hit(); sfx.coin(); shake(8, .25); burst(T.x, T.y, '#FFE14D', 18, 340); ring(T.x, T.y, '#fff', 100, .4); floatText('SLASH!', T.x, T.y - 50, '#fff', 38); }
      else { warn = .6; sfx.miss(); shake(3, .12); }
    },
    update(dt) {
      t += dt; warn = Math.max(0, warn - dt);
      if (g.result && endAt < 0) endAt = now;
      if (hit) { hit += dt; return; }
      if (g.result) return;
      if (t > .3) T.y += v * dt;
      T.x = cx + Math.sin(t * 2 + ph) * 25;
      if (T.y > 570) { g.result = 'lose'; sfx.thud(); sfx.miss(); shake(8, .25); burst(T.x, 560, '#FF4D6D', 10); }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt);
      K.layer('strike', wiiStrikeBg);
      // lanterns
      for (const lx of [240, 400, 560]) { const sw = Math.sin(now * 1.4 + lx) * 5; X.save(); X.translate(lx + sw, 64);
        K.line([[0, 0], [0, 34]], 3, '#7a4620', 2); K.celE(0, 70, 26, 34, '#ff6b4a', '#c22f45', 5, 5, 4); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); for (let i = -1; i <= 1; i++) { X.moveTo(i * 12, 38); X.quadraticCurveTo(i * 14, 70, i * 12, 102); } X.stroke(); rr(-14, 34, 28, 8, 3); ink('#ffd23f', 2.5); rr(-14, 98, 28, 8, 3); ink('#ffd23f', 2.5); K.glintE(-10, 58, 5, 12, .4, 0);
        X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = 'rgba(255,170,90,.14)'; el(0, 70, 60, 60); X.fill(); X.restore(); X.restore(); }
      // the golden light band
      const gl = .55 + Math.sin(tt * 8) * .2;
      X.fillStyle = `rgba(255,196,40,${gl * .7})`; X.fillRect(-OX, GY - band, VW, band * 2);
      X.fillStyle = INK; X.fillRect(-OX, GY - band - 3, VW, 6); X.fillRect(-OX, GY + band - 3, VW, 6);
      X.fillStyle = '#FFE14D'; X.fillRect(-OX, GY - band, VW, 4); X.fillRect(-OX, GY + band - 4, VW, 4);
      for (let i = 0; i < 9; i++) { const sx = ((tt * 60 + i * 130) % (VW + 100)) - OX - 50, sy = GY - band + 10 + K.hash(i) * (band * 2 - 20); K.glim(sx, sy, 6 + K.hash(i + 4) * 5, .5 + .5 * Math.sin(tt * 6 + i)); }
      // sakura petals
      for (let i = 0; i < 7; i++) { const px = ((i * 137 + tt * 22) % (VW + 60)) - OX - 30, py = ((tt * 34 + i * 83) % 460) + 70; X.save(); X.translate(px, py); X.rotate(tt * 2 + i); K.celE(0, 0, 6, 3.5, '#ffb3d1', '#e88db4', 1, 1, 1.5); X.restore(); }
      // the lucky cat on its stand
      { const cx2 = 640, cy2 = 500; K.shade(cx2, 504, 36, 7); K.celR(cx2 - 28, 462, 56, 40, 8, '#fff', '#dfe3f3', 4, 4, 4); K.celE(cx2, 448, 26, 22, '#fff', '#dfe3f3', 3, 3, 4); for (const s of [-1, 1]) { X.beginPath(); X.moveTo(cx2 + s * 10, 432); X.lineTo(cx2 + s * 22, 418); X.lineTo(cx2 + s * 24, 438); X.closePath(); ink('#fff', 3); }
        const cm = lost ? 'sleep' : won ? 'happy' : 'idle'; K.eye(cx2 - 9, 448, 5, cm, [-.5, .5], now, 6); K.eye(cx2 + 9, 448, 5, cm, [-.5, .5], now, 7);
        X.fillStyle = '#ff8fab'; el(cx2, 456, 3, 2); X.fill(); rr(cx2 - 22, 462, 44, 8, 4); ink('#ff4d5e', 2.5); K.celE(cx2, 474, 7, 7, '#ffd23f', '#d9a31a', 1, 1, 2.5);
        X.save(); X.translate(cx2 + 20, 466); X.rotate(lost ? 0.2 : -1.7 + Math.sin(now * 5) * .35); K.celR(-6, -30, 12, 32, 6, '#fff', '#dfe3f3', 2, 0, 3.5); X.restore(); }
      // Caos the swordsman
      const sx0 = 156, sy0 = 472, tgt = trail.length ? trail[trail.length - 1] : mouse, aim = clamp(Math.atan2(tgt.y - sy0, tgt.x - sx0), -1.25, -.1);
      K.shade(110, 512, 46, 8);
      X.save(); X.translate(110, 508); const jump = won ? Math.abs(Math.sin(rk * 9)) * 12 : 0; X.translate(0, -jump);
      K.arms(7, lost ? 2.4 : -.4, lost ? -2.4 : aim + Math.PI / 2, 1);
      caos(0, 0, 7, { mood: wiiMood(g) });
      rr(-6.4 * 7, -9 * 7 + 2, 12.8 * 7, 9, 3); ink('#ff4d5e', 3); X.fillStyle = '#ff4d5e'; X.beginPath(); X.moveTo(6.4 * 7, -9 * 7 + 6); X.quadraticCurveTo(6.4 * 7 + 18, -9 * 7 + 8 + Math.sin(now * 8) * 5, 6.4 * 7 + 30, -9 * 7 + 22 + Math.sin(now * 7) * 8); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#ff4d5e'; X.stroke();
      if (!lost) { const hx = 6.6 * 7 + 4.65 * 7 * Math.cos(aim), hy = -5.2 * 7 + 4.65 * 7 * Math.sin(aim); X.save(); X.translate(hx, hy - jump * 0); X.rotate(aim);
        K.line([[0, 0], [58, 0]], 6, '#e6e9f0', 2.5); K.glintE(30, -2, 18, 1.4, .8, 0); rr(-3, -8, 8, 16, 3); ink('#ffd23f', 2.5); K.line([[-4, 0], [-18, 0]], 7, '#3a2a40', 2.5);
        if (won && rk < .3) K.glim(60, 0, 16, 1 - rk * 3); X.restore(); }
      X.restore();
      K.tag(110, 508 - jump - 63 - 28);
      // the coin
      if (!hit) {
        const cyv = lost ? Math.min(T.y, 488) : T.y;
        if (!lost) K.shade(T.x, 520, 30 - Math.min(14, (520 - T.y) / 30), 6, .2); else K.shade(T.x, 506, 26, 6, .2);
        const cox = lost ? T.x + (rk > .35 ? (rk - .35) * 600 : 0) : T.x; token(cox, cyv, 34);
        if (lost) {   // a mouse snatches it
          const q = ease(rk / .35), rx = lost && rk > .35 ? T.x + (rk - .35) * 600 + 6 : K.lerp(W + OX + 40, T.x + 40, q), ry = 490;
          X.save(); X.translate(rx, ry); if (rk > .35) X.scale(-1, 1); X.scale(1, 1); K.celE(0, 0, 22, 14, '#aab3c4', '#7e88a3', 2, 2, 3); K.celE(-20, -4, 10, 9, '#aab3c4', '#7e88a3', 1, 1, 3); K.celE(-18, -14, 6, 6, '#ff8fab', '#d9647f', 1, 1, 2.5);
          X.fillStyle = INK; el(-24, -6, 2, 2.4); X.fill(); K.qline(22, 2, 40, 10 + Math.sin(now * 20) * 4, 50, -4, 4, '#ff8fab', 2); X.restore();
        }
      } else {
        const k = Math.min(1, hit * 3), ca = Math.cos(hitDir), sa = Math.sin(hitDir);
        for (const sg of [-1, 1]) {
          X.save(); X.translate(T.x - sa * sg * k * 40, T.y + ca * sg * k * 40 + hit * hit * 200); X.rotate(hitDir); X.beginPath(); X.rect(-60, sg < 0 ? -60 : 0, 120, 60); X.clip(); X.rotate(-hitDir); token(0, 0, 34); X.restore();
        }
        if (slash && hit < .35) { X.strokeStyle = '#fff'; X.lineWidth = 12 * (1 - hit * 2.5); X.lineCap = 'round'; X.beginPath(); const a = slash[0], b = slash[slash.length - 1]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; X.moveTo(T.x - dx / l * 140, T.y - dy / l * 140); X.lineTo(T.x + dx / l * 140, T.y + dy / l * 140); X.stroke(); X.lineCap = 'butt'; }
      }
      if (trail.length > 1 && !g.result) { X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); trail.forEach((q, i) => i ? X.lineTo(q.x, q.y) : X.moveTo(q.x, q.y)); X.stroke(); X.lineCap = 'butt'; }
      if (warn > 0) K.badge(T.y < GY ? 'TOO EARLY!' : 'TOO LATE!', W / 2, 140, 36, '#ff4d5e', '#fff', 1, -.03);
      else if (!g.result && Math.abs(T.y - GY) <= band + 40 && Math.abs(T.y - GY) > band) K.badge('NOW...', W / 2, 140, 32, '#4DB8FF', '#fff', 1, .02);
      if (!g.result && Math.abs(T.y - GY) <= band) K.badge('NOW!', W / 2, 140, 44, '#ff2e4d', '#FFE14D', 1 + Math.sin(tt * 30) * .06, -.03);
      vignette(.16);
    }
  };
  return g;
}

/* 8 ── SHAVE!: clear the stubble, dodge the mole */
function wiiShaveBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  X.fillStyle = '#9fe3ef'; X.fillRect(L, 0, VW, 540);
  X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 3; X.beginPath(); for (let x = L - ((L % 50) + 50) % 50; x < R; x += 50) { X.moveTo(x, 0); X.lineTo(x, 540); } for (let y = 0; y < 540; y += 50) { X.moveTo(L, y); X.lineTo(R, y); } X.stroke();
  X.fillStyle = 'rgba(47,160,190,.25)'; for (let i = 0; i < 12; i++) { X.fillRect(L + K.hash(i) * VW, K.hash(i + 5) * 500, 50, 50); }
  X.fillStyle = INK; X.fillRect(L, 538, VW, 5); X.fillStyle = '#f0e6d2'; X.fillRect(L, 543, VW, 60);
  X.fillStyle = '#c9bda6'; for (let x = L - ((L % 80) + 80) % 80, i = 0; x < R; x += 80, i++) for (let y = 543, j = 0; y < 600; y += 30, j++) if ((i + j) % 2) X.fillRect(x, y, 80, 30);
  // mirror frame (right)
  rr(610, 118, 170, 250, 18); ink('#d9944f', 5); X.save(); rr(618, 126, 154, 234, 12); X.clip(); X.fillStyle = '#d6f4fb'; X.fillRect(600, 110, 190, 270); X.fillStyle = 'rgba(255,255,255,.7)'; X.beginPath(); X.moveTo(640, 360); X.lineTo(700, 126); X.lineTo(730, 126); X.lineTo(670, 360); X.fill(); X.restore();
  // shelf with bottles (left)
  rr(14, 270, 122, 12, 5); ink('#c98443', 4);
  [['#ff8fab', 42], ['#ffd23f', 30], ['#c77dff', 38]].forEach(([c, h], i) => { K.celR(24 + i * 38, 270 - h, 28, h, 8, c, 'rgba(60,40,110,.4)', 3, 0, 3.5); rr(30 + i * 38, 270 - h - 9, 16, 10, 3); ink('#e8d7a8', 2.5); });
}
function wiiShave(sp) {
  const CS = 15, X0 = 250, Y0 = 290, NC = 20, NR = 14, RR = 24, hard = sp > 1.5;
  const moles = []; const m0 = { x: 0, y: 0 };
  for (let i = 0; i < (hard ? 2 : 1); i++) {
    for (let tries = 0; tries < 30; tries++) {
      const m = { x: 310 + Math.random() * 180, y: 340 + Math.random() * 120 };
      if (Math.hypot(m.x - mouse.x, m.y - mouse.y) > 90 && moles.every(o => Math.hypot(o.x - m.x, o.y - m.y) > 100)) { moles.push(m); break; }
    }
  }
  if (!moles.length) moles.push({ x: 420, y: 420 });
  const cells = []; for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const cx = X0 + c * CS + CS / 2, cy = Y0 + r * CS + CS / 2;
    cells.push({ x: cx, y: cy, f: 0, skip: moles.some(m => Math.hypot(m.x - cx, m.y - cy) < 42) });
  }
  const need = cells.filter(c => !c.skip).length; let lx = null, ly = 0, cut = 0, mx = W / 2, my = H / 2, cleared = 0, lastC = 0, endAt = -1, aMoved = false;
  const clearAt = (x, y) => { for (const c of cells) if (!c.f && Math.abs(c.x - x) < RR + 4 && Math.abs(c.y - y) < RR + 4 && Math.hypot(c.x - x, c.y - y) < RR) c.f = .8; };
  const g = {
    wide: true, cmd: 'SHAVE!', hint: 'MOUSE OVER THE STUBBLE · AVOID THE MOLE', thint: 'DRAG OVER STUBBLE, AVOID MOLE', dur: hard ? 6 : 6.5,
    update(dt) {
      for (const c of cells) if (c.f > 0) c.f = Math.max(.001, c.f - dt * .6);
      cut = Math.max(0, cut - dt);
      if (g.result && endAt < 0) endAt = now;
      if (g.result) return;
      mx = mouse.x; my = mouse.y;
      if (lx === null) { lx = mx; ly = my; }
      for (const m of moles) if (segD(m.x, m.y, lx, ly, mx, my) < 15 + 12) { g.result = 'lose'; cut = 1; sfx.zap(); sfx.miss(); shake(10, .3); burst(mx, my, '#FF4D6D', 16, 300); ring(mx, my, '#FF4D6D', 90, .4); return; }
      const d = Math.hypot(mx - lx, my - ly), st = Math.max(1, Math.ceil(d / 8));
      for (let i = 1; i <= st; i++) clearAt(lx + (mx - lx) * i / st, ly + (my - ly) * i / st);
      if (d > 4 && Math.random() < .3) snd(900 + Math.random() * 300, .02, 'sawtooth', .015);
      if (cleared > lastC + 20) { lastC = cleared; sfx.blip(Math.min(12, cleared / 40 | 0)); }
      lx = mx; ly = my;
      const done = cells.filter(c => !c.skip && c.f).length; cleared = done;
      if (done / need >= .9) { g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(400, 340, '#fff', 20, 320); ring(400, 340, '#5CFF7A', 160, .5); floatText('SMOOTH!', 400, 250, '#5CFF7A', 44); }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt);
      K.layer('shave', wiiShaveBg);
      // barber pole
      { const px = 66; rr(px - 20, 120, 40, 300, 18); ink('#fff', 4); X.save(); rr(px - 20, 120, 40, 300, 18); X.clip(); for (let i = -4; i < 14; i++) { const y0 = 120 + ((i * 40 + now * 40) % 400) - 40; X.fillStyle = i % 2 ? '#ff4d5e' : '#4D6BFF'; X.beginPath(); X.moveTo(px - 22, y0); X.lineTo(px + 22, y0 - 22); X.lineTo(px + 22, y0 - 2); X.lineTo(px - 22, y0 + 20); X.fill(); } X.restore(); rr(px - 20, 120, 40, 300, 18); X.strokeStyle = INK; X.lineWidth = 8; X.stroke(); X.fillStyle = 'rgba(255,255,255,.4)'; rr(px - 12, 140, 7, 260, 3); X.fill();
        K.celE(px, 112, 22, 14, '#ffd23f', '#d9a31a', 3, 3, 4); K.celE(px, 428, 22, 14, '#ffd23f', '#d9a31a', 3, 3, 4); K.celE(px, 98, 8, 8, '#ffd23f', '#d9a31a', 1, 1, 3); }
      // the tonic bottle: it fills green as you shave
      { const bx = 130, by = 330, bh = 170, fillK = Math.min(1, cells.filter(c => !c.skip && c.f).length / need / .9);
        K.celR(bx + 16, by - 34, 28, 40, 5, '#e6e9f0', '#aab3c4', 3, 0, 3.5);
        rr(bx, by, 60, bh, 22); ink('#eaf6ff', 4.5); X.save(); rr(bx, by, 60, bh, 22); X.clip(); X.fillStyle = '#5CFF7A'; X.fillRect(bx, by + bh - fillK * bh, 60, fillK * bh + 2); X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(bx + 8, by + bh - fillK * bh, 10, fillK * bh); X.restore();
        rr(bx - 4, by + 62, 68, 34, 6); ink('#fff3d6', 3); K.celE(bx + 30, by + 79, 9, 9, '#ff4d5e', '#c22f45', 1, 1, 2.5); rr(bx + 10, by - 44, 40, 14, 5); ink('#ff4d5e', 3); }
      // the customer
      const worried = moles.some(m => Math.hypot(m.x - mx, m.y - my) < 80) && !g.result, mood = won ? 'happy' : lost ? 'bonk' : worried ? 'panic' : 'idle';
      K.shade(400, 522, 200, 16, .25);
      for (const s of [-1, 1]) K.celE(400 + s * 190, 300, 30, 44, wiiSkin, wiiSkinSh, 4, 4, 5);
      K.celR(220, 110, 360, 400, 130, '#FFD3A5', '#e8aa7a', 10, 8, 6); K.glintE(290, 160, 40, 14, .38, -.5);
      K.celF(() => { X.beginPath(); X.moveTo(222, 210); X.quadraticCurveTo(222, 80, 400, 78); X.quadraticCurveTo(578, 80, 578, 210); X.quadraticCurveTo(540, 150, 400, 146); X.quadraticCurveTo(260, 150, 222, 210); X.closePath(); }, '#5a3b22', '#3a2412', 5, 6, 5);
      K.glintE(320, 100, 36, 8, .25, -.2);
      const lk = [clamp((mx - 400) / 200, -1, 1), clamp((my - 205) / 260, -1, 1)];
      X.strokeStyle = '#3a2a26'; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); const up = worried ? 12 : 0;
      X.moveTo(292, 168 - up * .5); X.lineTo(362, 158 - up); X.moveTo(438, 158 - up); X.lineTo(508, 168 - up * .5); if (lost) { X.moveTo(292, 168); X.lineTo(362, 176); } X.stroke();
      for (const ex of [330, 470]) { if (mood === 'bonk' || mood === 'happy') K.eye(ex, 205, 26, mood, lk, tt, ex); else K.eye(ex, 205, 26, mood, lk, tt, ex); }
      K.celE(400, 262, 22, 28, '#f5b88a', '#d98f5c', 3, 3, 4); K.glintE(392, 252, 5, 9, .5, 0);
      if (worried) K.sweat(540, 190, 1.4, tt);
      // stubble (live: one path), foam where you passed
      X.fillStyle = 'rgba(90,70,110,.16)'; X.beginPath(); for (const c of cells) if (!c.skip && !c.f) X.rect(c.x - 7.5, c.y - 7.5, 15, 15); X.fill();
      X.strokeStyle = '#3a2a26'; X.lineWidth = 2.6; X.lineCap = 'round'; X.beginPath(); for (const c of cells) if (!c.skip && !c.f) { X.moveTo(c.x - 4, c.y - 4); X.lineTo(c.x - 3, c.y + 3); X.moveTo(c.x + 3, c.y - 2); X.lineTo(c.x + 4, c.y + 5); } X.stroke();
      X.fillStyle = '#fff'; X.beginPath(); for (const c of cells) if (c.f > .3) { X.moveTo(c.x + 9, c.y); X.arc(c.x, c.y, 9, 0, TAU); } X.fill();
      if (won) { X.fillStyle = 'rgba(255,255,255,.35)'; el(335, 380, 22, 10, -.5); X.fill(); el(465, 380, 22, 10, .5); X.fill(); K.glim(340 + Math.sin(rk * 8) * 4, 372, 14 * (.5 + .5 * Math.sin(rk * 10)), 1); K.glim(470, 392, 10, .8); }
      // the mouth, over the stubble
      X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath();
      if (lost) { el(400, 440, 34, 26 + Math.sin(rk * 30) * 3); X.fillStyle = '#7a1f33'; X.fill(); X.stroke(); X.fillStyle = '#ff6b8a'; el(400, 452, 18, 9); X.fill(); }
      else if (won) { X.arc(400, 412, 42, .15, Math.PI - .15); X.stroke(); X.fillStyle = '#fff'; X.beginPath(); X.moveTo(366, 418); X.lineTo(434, 418); X.quadraticCurveTo(400, 454, 366, 418); X.fill(); }
      else if (worried) { X.moveTo(366, 430); for (let i = 1; i <= 6; i++) X.lineTo(366 + i * 11.3, 430 + (i % 2 ? -7 : 7)); X.stroke(); }
      else { X.arc(400, 420, 40, .2, Math.PI - .2); X.stroke(); }
      // moles
      for (const m of moles) { K.celE(m.x, m.y, 15, 15, '#9a4a3a', '#5a2a24', 3, 3, 4); K.glintE(m.x - 5, m.y - 6, 4, 3, .55, -.5); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); for (const a of [-.6, .2, 1.0]) { X.moveTo(m.x + Math.cos(a - 1.2) * 12, m.y + Math.sin(a - 1.2) * 12); X.lineTo(m.x + Math.cos(a - 1.2) * 24, m.y + Math.sin(a - 1.2) * 24 - 2); } X.stroke();
        K.badge('!', m.x, m.y - 38 + Math.sin(tt * 8) * 3, 22, '#ff4d5e', '#fff', 1, 0); }
      // cape + collar
      X.save(); X.beginPath(); X.moveTo(150, 545); X.quadraticCurveTo(160, 505, 280, 498); X.lineTo(520, 498); X.quadraticCurveTo(640, 505, 650, 545); X.lineTo(650, 560); X.lineTo(150, 560); X.closePath(); ink('#4D6BFF', 5); X.clip(); X.fillStyle = 'rgba(255,255,255,.85)'; for (let x = 140; x < 660; x += 56) X.fillRect(x, 490, 22, 80); X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(150, 530, 500, 40); X.restore();
      rr(310, 490, 180, 24, 12); ink('#fff', 4);
      // the barber (Caos) watching from the right
      K.shade(700, 540, 40, 8); X.save(); X.translate(700, 538); caos(0, 0, 6, { mood: wiiMood(g) }); if (worried) K.sweat(34, -46, 1, tt); K.celF(() => { X.beginPath(); X.moveTo(-34, -54); X.quadraticCurveTo(-34, -78, 0, -78); X.quadraticCurveTo(34, -78, 34, -54); X.closePath(); }, '#fff', '#dfe3f3', 4, 3, 3.5); rr(-36, -58, 72, 8, 4); ink('#fff', 3); X.restore(); K.tag(700, 538 - 54 - 54);
      // razor + glove
      if (mouse.x !== W / 2 || mouse.y !== H / 2) aMoved = true;
      X.save(); X.globalAlpha = aMoved ? 1 : .35; K.shade(mx + 10, my + 8, 22, 6, .2); X.translate(mx, my); X.rotate(-.6);
      K.celR(-6, -80, 16, 70, 6, '#4DB8FF', '#2a8fcb', 3, 0, 4); K.celR(-22, -16, 48, 20, 5, '#ddd', '#9aa3b5', 0, 4, 4); X.fillStyle = INK; X.fillRect(-18, -2, 40, 3);
      K.celE(2, -60, 13, 15, '#fff', '#dfe3f3', 2, 2, 3.5); X.restore();
      if (cut > 0) { K.star(mx, my, 50, 20, 8, tt * 3, '#FF4D6D', 4); K.badge('OUCH!', W / 2, 70, 44, '#ff4d5e', '#fff', outBack((1 - cut) / .2), -.04); }
      vignette(.16);
    }
  };
  return g;
}

/* 9 ── FAN IT!: wave the fan below the butterfly to keep it aloft */
function wiiFanBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  let gr = X.createLinearGradient(0, 0, 0, 440); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.55, '#86d8fb'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(L, 0, VW, 522);
  // far hills (no ink), near hills (coloured outline)
  X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(L, 440); for (let x = L; x <= R; x += 20) X.lineTo(x, 400 - Math.sin(x * .006 + 1) * 40 - Math.sin(x * .017) * 14); X.lineTo(R, 440); X.fill();
  X.beginPath(); X.moveTo(L, 520); for (let x = L; x <= R; x += 20) X.lineTo(x, 450 - Math.sin(x * .008 + 3) * 26 - Math.sin(x * .021) * 10); X.lineTo(R, 520); X.closePath(); ink('#87d19b', 3.5, '#4f9a6a');
  for (let i = 0; i < 6; i++) { const tx = L + 60 + i * (VW / 5.2), ty = 442 - Math.sin(tx * .008 + 3) * 26; rr(tx - 5, ty - 40, 10, 44, 3); ink('#8a5a34', 2.5, '#5e3a1c'); X.beginPath(); X.arc(tx, ty - 52, 22, 0, K.TAU); ink('#3fb260', 3, '#2f7a49'); X.fillStyle = 'rgba(255,255,255,.25)'; el(tx - 8, ty - 60, 8, 5, -.5); X.fill(); }
  // picket fence
  X.fillStyle = INK; X.fillRect(L, 486, VW, 3); for (const y of [452, 480]) { rr(L - 6, y, VW + 12, 9, 3); ink('#fff3d6', 3); }
  for (let x = L - ((L % 34) + 34) % 34; x < R; x += 34) { X.beginPath(); X.moveTo(x, 520); X.lineTo(x, 440); X.lineTo(x + 11, 428); X.lineTo(x + 22, 440); X.lineTo(x + 22, 520); X.closePath(); ink('#fff', 3); X.fillStyle = 'rgba(160,170,200,.35)'; X.fillRect(x + 12, 440, 10, 80); }
  // grass
  gr = X.createLinearGradient(0, 520, 0, 600); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944'); X.fillStyle = gr; X.fillRect(L, 520, VW, 80); X.fillStyle = INK; X.fillRect(L, 519, VW, 4);
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = L - 100; x < R; x += 70) { X.beginPath(); X.moveTo(x, 600); X.lineTo(x + 24, 600); X.lineTo(x + 70, 524); X.lineTo(x + 46, 524); X.fill(); }
  // flowers along the front
  for (let i = -Math.ceil(OX / 90); i < 9 + Math.ceil(OX / 90); i++) {
    const x = 40 + i * 90, h = 34 + (Math.abs(i * 37) % 40), c = ['#FF8FAB', '#FFE14D', '#C77DFF'][(i % 3 + 3) % 3];
    K.line([[x, 538], [x + 2, 538 - h]], 5, '#4fb065', 2.5); K.celE(x - 9, 538 - h * .45, 10, 5, '#5bcf72', '#2f9a55', 1, 1, 2.5, -.5);
    for (let p = 0; p < 6; p++) { const a = p * K.TAU / 6; K.celE(x + 2 + Math.cos(a) * 13, 538 - h + Math.sin(a) * 13, 8, 8, c, 'rgba(60,20,110,.35)', 1, 1, 2.5); }
    K.celE(x + 2, 538 - h, 7, 7, '#fff3a0', '#e0b840', 1, 1, 3);
  }
}
function wiiFan(sp) {
  const grav = 320 * Math.pow(sp, .6), B = { x: 300 + Math.random() * 200, y: 250, vx: 0, vy: 0 }; let lx = mouse.x, ly = mouse.y, spd = 0, wind = 0, t = 0, lw = 0, ph = Math.random() * 6, endAt = -1, aMoved = false;
  const g = {
    wide: true, fistHand: true, cmd: 'FAN IT!', hint: 'WAVE THE MOUSE BELOW THE BUTTERFLY', thint: 'WAVE YOUR FINGER BELOW IT', dur: 5.2, timeWin: true,
    update(dt) {
      t += dt;
      const sx = (Math.abs(mouse.x - lx) + Math.abs(mouse.y - ly) * .5) / Math.max(dt, .001); lx = mouse.x; ly = mouse.y;
      spd += (Math.min(2500, sx) - spd) * Math.min(1, 12 * dt);
      if (g.result && endAt < 0) endAt = now;
      if (g.result) return;
      const dx = mouse.x - B.x, near = Math.abs(dx) < 160 && mouse.y > B.y - 20 && mouse.y < B.y + 270;
      wind = near ? Math.min(1, spd / 1300) : 0;
      B.vy += (grav - wind * 1700) * dt; B.vx += (-dx * (near ? .4 : 0) * wind * .02 * 60 + Math.sin(t * 1.7 + ph) * 60) * dt;
      B.vy = Math.max(-380, Math.min(440, B.vy)); B.vx *= Math.pow(.3, dt);
      B.x += B.vx * dt; B.y += B.vy * dt; B.x = Math.max(60 - OX, Math.min(740 + OX, B.x));
      if (B.y < 80) { B.y = 80; B.vy = Math.abs(B.vy) * .3; }
      if (B.y > 515) { g.result = 'lose'; endAt = now; sfx.splat(); shake(7, .25); burst(B.x, 520, '#FF8FAB', 12); }
      if (wind > .35 && t - lw > .25) { lw = t; sfx.whoosh(true); }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt), low = !g.result && B.y > 380;
      K.layer('fan', wiiFanBg);
      K.sun(W + OX - 64, 100, now, 30);
      K.cloud(((now * 8 + 300) % (VW + 260)) - OX - 130, 150, .8); K.cloud(((now * 5 + 40) % (VW + 260)) - OX - 130, 250, .6);
      { const bx = ((now * 45) % (VW + 200)) - OX - 100, by = 200 + Math.sin(now * 2) * 8, f = Math.sin(now * 10) * 5; X.strokeStyle = '#3c6fb4'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(bx - 9, by - f); X.quadraticCurveTo(bx - 4, by - 6, bx, by); X.quadraticCurveTo(bx + 4, by - 6, bx + 9, by - f); X.stroke(); }
      // Caos cheers from the left
      { const cx = 70, cy = 532; K.shade(cx, cy + 3, 40, 8); X.save(); X.translate(cx, cy - (won ? Math.abs(Math.sin(rk * 9)) * 16 : 0));
        K.arms(5, won ? -2.8 : -.5, won ? 2.8 : .5, 1); caos(0, 0, 5, { mood: wiiMood(g) }); if (low) K.sweat(34, -40, .9, tt); X.restore(); K.tag(cx, cy - 78); }
      // the frog waits in the grass for a snack
      const fx = W + OX - 84, fy = 536, mouthX = fx - 30, mouthY = fy - 24;
      K.shade(fx, fy + 4, 52, 9, .25);
      X.save(); X.translate(fx, fy);
      const pul = 1 + Math.sin(now * 3) * .03;
      K.celE(0, -22, 44 * pul, 30 * pul, '#5bcf72', '#2f9a55', 6, 7, 5); K.celE(10, -10, 26, 16, '#c8f0a0', '#9ad074', 3, 3, 3.5);
      for (const s of [-1, 1]) K.celE(s * 30, 0, 14, 8, '#5bcf72', '#2f9a55', 2, 2, 4);
      for (const s of [-1, 1]) { K.celE(s * 17 - 4, -50, 13, 13, '#5bcf72', '#2f9a55', 2, 2, 4.5); }
      const flk = [clamp((B.x - fx) / 260, -1, 1), clamp((B.y - fy) / 260, -1, 0)];
      const fm = lost ? 'happy' : won ? 'bonk' : low ? 'panic' : 'idle'; K.eye(-21, -51, 8.5, fm, flk, now, 3); K.eye(13, -51, 8.5, fm, flk, now, 4);
      X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath(); if (won) { X.arc(-6, -20, 14, 1.2, 1.95); } else { X.moveTo(-34, -24); X.quadraticCurveTo(-8, -14 + (low ? 6 : 0), 20, -24); } X.stroke();
      X.fillStyle = 'rgba(255,110,165,.5)'; el(-30, -34, 6, 4); X.fill();
      X.restore();
      // butterfly (pulled into the frog's mouth when it falls)
      let bxp = B.x, byp = B.y, vis = true, tg = null;
      if (lost) {
        const e = clamp(rk / .12, 0, 1), r2 = clamp((rk - .12) / .28, 0, 1);
        tg = rk < .12 ? { x: K.lerp(mouthX, B.x, e), y: K.lerp(mouthY, B.y, e) } : { x: K.lerp(B.x, mouthX, ease(r2)), y: K.lerp(B.y, mouthY, ease(r2)) };
        bxp = rk < .12 ? B.x : tg.x; byp = rk < .12 ? B.y : tg.y; vis = rk < .4;
        X.strokeStyle = INK; X.lineWidth = 13; X.lineCap = 'round'; X.beginPath(); X.moveTo(mouthX, mouthY); X.lineTo(tg.x, tg.y); X.stroke(); X.strokeStyle = '#ff6b8a'; X.lineWidth = 7; X.stroke();
      }
      K.shade(B.x, 531, Math.max(10, 30 - (531 - B.y) / 14), 6, .2);
      if (vis) {
        const fl = Math.sin(tt * 22) * .8 + .2, bm = won ? 'happy' : lost ? 'panic' : wind > .7 ? 'dizzy' : B.y > 380 ? 'panic' : 'idle';
        const drawB = (px, py, rot, sc, col, col2, mood) => {
          X.save(); X.translate(px, py); X.rotate(rot); X.scale(sc, sc);
          for (const s of [-1, 1]) { X.save(); X.scale(s * (Math.abs(fl) * .9 + .25), 1); K.celE(32, -12, 34, 28, col, 'rgba(120,40,110,.4)', 4, 4, 4.5, -.4); K.celE(34, 14, 19, 15, col2, 'rgba(160,110,20,.4)', 3, 3, 4, .3); X.fillStyle = 'rgba(255,255,255,.8)'; el(38, -16, 6, 6); X.fill(); el(26, 4, 3.5, 3.5); X.fill(); X.restore(); }
          K.celR(-5, -22, 10, 44, 5, '#7a4fb4', '#4a2a7a', 2, 0, 3.5); K.celE(0, -28, 10, 10, '#7a4fb4', '#4a2a7a', 2, 2, 3.5);
          for (const s of [-1, 1]) { K.qline(s * 4, -35, s * 8, -48, s * 14 + Math.sin(tt * 6 + s) * 2, -52, 2.5, '#4a2a7a', 2); K.celE(s * 14, -52, 3, 3, '#ffd23f', '#d9a31a', 1, 1, 2); }
          K.eye(-4, -29, 3.6, mood, [0, 1], tt, 2); K.eye(4, -29, 3.6, mood, [0, 1], tt, 3);
          X.restore();
        };
        drawB(bxp, byp, lost ? 0 : B.vx / 400, lost ? 1 - .3 * clamp((rk - .12) / .28, 0, 1) : 1, '#FF8FAB', '#FFE14D', bm);
        if (won) for (let i = 0; i < 3; i++) { const a = rk * 3 + i * TAU / 3; drawB(B.x + Math.cos(a) * 90, B.y + Math.sin(a) * 40 - 20, 0, .5, ['#4DB8FF', '#C77DFF', '#5CFF7A'][i], '#fff', 'happy'); }
      }
      if (lost && rk > .4) { K.badge('SPLAT...', fx - 70, 470, 28, '#ff4d5e', '#fff', outBack((rk - .4) / .25), -.05); K.puff(fx - 24, 500, 6, clamp(1 - (rk - .4), 0, 1), '#cfd5e3'); X.fillStyle = '#FF8FAB'; X.save(); X.translate(mouthX + 3, mouthY - 2); X.rotate(.5); K.celE(0, 0, 7, 3, '#FF8FAB', '#d9647f', 1, 1, 2); X.restore(); }
      // the fan (the pointer)
      const fan = { x: mouse.x, y: mouse.y }; if (mouse.x !== W / 2 || mouse.y !== H / 2) aMoved = true;
      X.save(); X.globalAlpha = aMoved ? 1 : .35; X.translate(fan.x, fan.y); X.rotate(Math.sin(tt * 30) * wind * .6);
      K.celR(-6, -2, 12, 38, 6, '#c98443', '#8a5a2b', 2, 0, 3.5);
      X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 60, -2.4, -.74); X.closePath(); ink('#FFE14D', 4); X.save(); X.clip(); X.fillStyle = '#FF8FAB'; for (let i = 0; i < 4; i++) { const a0 = -2.4 + i * .42, a1 = a0 + .21; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 62, a0, a1); X.fill(); } X.restore();
      X.strokeStyle = INK; X.lineWidth = 2.6; for (let i = 0; i < 5; i++) { const a = -2.4 + i * .415; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); X.stroke(); }
      K.celE(0, 0, 6, 6, '#ffd23f', '#d9a31a', 1, 1, 3); X.restore();
      if (wind > .1) { X.lineCap = 'round'; for (let i = 0; i < 3; i++) { const y0 = fan.y - 70 - i * 30 - ((tt * 300) % 60); X.beginPath(); X.arc(fan.x + (i - 1) * 36, y0, 14, 0, 4.5); X.strokeStyle = INK; X.lineWidth = 9; X.stroke(); X.strokeStyle = 'rgba(255,255,255,.95)'; X.lineWidth = 5; X.stroke(); } }
      vignette(.16);
    }
  };
  return g;
}

/* 10 ── TWIRL!: circle the mouse to stretch the dough to the plate ring; too fast tears it */
function wiiTwirlBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  let gr = X.createLinearGradient(0, 0, 0, 520); gr.addColorStop(0, '#ffd6a5'); gr.addColorStop(1, '#ffc891'); X.fillStyle = gr; X.fillRect(L, 0, VW, 522);
  X.strokeStyle = 'rgba(200,120,70,.22)'; X.lineWidth = 3; X.beginPath(); for (let x = L - ((L % 60) + 60) % 60; x < R; x += 60) { X.moveTo(x, 62); X.lineTo(x, 520); } for (let y = 62; y < 520; y += 60) { X.moveTo(L, y); X.lineTo(R, y); } X.stroke();
  rr(L - 10, 30, VW + 20, 34, 6); ink('#8a5a2b', 4);
  // hanging salami and garlic (left)
  for (const [x, len, col] of [[40, 70, '#c22f45'], [90, 90, '#a5283a'], [140, 60, '#c22f45']]) { K.line([[x, 62], [x, 84]], 3, '#e8d7a8', 2); K.celR(x - 11, 84, 22, len, 10, col, '#7a1f33', 3, 3, 3.5); X.fillStyle = '#fff3d6'; for (let q = 0; q < 4; q++) { X.beginPath(); X.arc(x - 3 + (q % 2) * 6, 100 + q * 16, 2.4, 0, K.TAU); X.fill(); } }
  for (const x of [200, 240]) { K.line([[x, 62], [x, 90]], 3, '#e8d7a8', 2); for (let q = 0; q < 3; q++) K.celE(x + (q - 1) * 7, 100 + q * 8, 10, 12, '#fff3d6', '#d6c9a8', 2, 2, 3); }
  // brick oven (right)
  K.celR(610, 340, 180, 182, 14, '#c9604a', '#9a4030', 7, 0, 5); X.strokeStyle = 'rgba(20,16,28,.3)'; X.lineWidth = 3; X.beginPath(); for (let y = 372; y < 520; y += 28) { X.moveTo(612, y); X.lineTo(788, y); } X.stroke();
  X.beginPath(); X.arc(700, 340, 90, Math.PI, 0); ink('#d9694f', 5); rr(655, 420, 90, 100, 36); ink('#2b1a3f', 5);
  rr(692, 308, 16, 40, 5); ink('#9a4030', 4);
  // counter
  X.fillStyle = INK; X.fillRect(L, 518, VW, 5); X.fillStyle = '#d6a272'; X.fillRect(L, 523, VW, 16); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(L, 523, VW, 5);
  X.fillStyle = '#a8703a'; X.fillRect(L, 539, VW, 61); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); for (let x = L - ((L % 130) + 130) % 130; x < R; x += 130) { X.moveTo(x, 539); X.lineTo(x, 600); } X.stroke();
  // flour bag + tomato can + cheese on the counter
  K.celR(700, 478, 70, 46, 6, '#fff3d6', '#d6c9a8', 5, 0, 4); rr(712, 490, 46, 18, 4); ink('#ff4d5e', 2.5);
  K.celR(160, 490, 34, 34, 5, '#e85a4a', '#a8283f', 3, 0, 3.5); rr(160, 500, 34, 12, 0); X.fillStyle = '#fff3d6'; X.fill();
  K.celE(244, 506, 26, 18, '#ffe08a', '#e0b840', 3, 3, 3.5);
}
function wiiTwirl(sp) {
  const CX = 400, CY = 330, PR = 165; let r = 62, spin = 0, w = 0, la = null, ang = 0, crack = 0, t = 0, lw = 0, lc = 0, endAt = -1; const fl = [];
  const g = {
    wide: true, cmd: 'TWIRL!', hint: 'MOUSE IN CIRCLES · NOT TOO FAST!', thint: 'DRAG IN CIRCLES, NOT TOO FAST', dur: 6.2,
    update(dt) {
      t += dt;
      if (g.result && endAt < 0) endAt = now;
      if (g.result) { for (const f of fl) { f.x += f.vx * dt; f.y += f.vy * dt; f.l -= dt; } return; }
      const dx = mouse.x - CX, dy = mouse.y - CY, a = Math.atan2(dy, dx);
      let om = 0;
      if (Math.hypot(dx, dy) > 45 && la !== null) { let da = a - la; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; om = Math.max(-30, Math.min(30, da / Math.max(dt, .001))); }
      la = Math.hypot(dx, dy) > 45 ? a : null;
      w += (om - w) * Math.min(1, 9 * dt); spin += (w - spin) * Math.min(1, 4 * dt); ang += spin * dt;
      const as = Math.abs(spin);
      if (as > 1.8) { if (as < 12) r += Math.min(as, 8) * 7.5 * sp * dt; } else r -= 10 * dt;
      r = Math.max(55, r);
      if (as > 12) crack += dt * 1.1; else crack = Math.max(0, crack - dt * .5);
      if (as > 3 && Math.random() < dt * as * 3) fl.push({ x: CX + Math.cos(ang) * r, y: CY + Math.sin(ang) * r, vx: (Math.random() - .5) * 200, vy: -Math.random() * 150, l: .7 });
      for (let i = fl.length - 1; i >= 0; i--) { const f = fl[i]; f.x += f.vx * dt; f.y += f.vy * dt; if ((f.l -= dt) <= 0) fl.splice(i, 1); }
      if (r >= PR) { g.result = 'win'; sfx.pop(); sfx.sparkle(); shake(6, .2); ring(CX, CY, '#fff', 210, .5); burst(CX, CY, '#FFE14D', 20, 340); floatText('PERFECT!', CX, CY - 20, '#fff', 44); }
      else if (crack >= 1) { g.result = 'lose'; sfx.splat(); wiiBang(CX, CY); }
      if (as > 3 && t - lw > .22) { lw = t; sfx.blip(Math.min(12, r / 14 | 0)); }
      if (crack > .3 && t - lc > .3) { lc = t; sfx.buzz(); }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', torn = lost, rk = wiiRk(g, endAt);
      K.layer('twirl', wiiTwirlBg);
      // oven fire
      { const fb = Math.sin(now * 9) * 4; X.save(); X.beginPath(); rr(655, 420, 90, 100, 36); X.clip(); X.fillStyle = '#ff7a2e'; X.fillRect(650, 470 + fb * .3, 100, 60); X.fillStyle = '#ffd23f'; X.beginPath(); X.moveTo(680, 520); X.quadraticCurveTo(682, 480 + fb, 700, 468); X.quadraticCurveTo(718, 480 - fb, 722, 520); X.fill(); X.fillStyle = '#fff3a0'; el(701, 508, 9, 16 + fb); X.fill(); X.restore(); X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = 'rgba(255,150,60,.16)'; el(700, 470, 110, 90); X.fill(); X.restore(); }
      // the pizza pan standing behind the dough
      K.celE(CX, CY, PR + 12, PR + 12, '#dfe6f2', '#aab3c4', 7, 7, 5); X.beginPath(); X.arc(CX, CY, PR + 1, 0, TAU); X.fillStyle = '#c9d1e0'; X.fill(); X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 3; X.stroke(); K.glintE(CX - PR * .55, CY - PR * .55, 50, 12, .5, -.8);
      K.celR(CX - 14, CY - PR - 26, 28, 18, 8, '#aab3c4', '#7e88a3', 2, 2, 3.5);
      // the dough
      K.shade(CX, CY + r * .94 + 14 + 8, r * .9, r * .16, .22);
      const sq = r * (.94 + Math.sin(tt * 6) * .02);
      if (!torn) {
        X.save(); X.translate(CX, CY); X.rotate(ang);
        K.celE(0, 0, r, sq, '#e8b65f', '#b98433', r * .06, r * .06, 6); K.celE(0, 0, r - 9, sq - 9, '#f8dc9c', '#e9bd6c', r * .04, r * .04, 0);
        X.fillStyle = '#e85a4a'; el(0, 0, (r - 9) * .8, (sq - 9) * .8); X.fill(); X.fillStyle = '#ffe08a'; for (const [a, k] of [[.4, .5], [2.2, .6], [3.8, .45], [5.3, .55]]) { el(Math.cos(a) * r * k, Math.sin(a) * r * k, r * .16, r * .1, a); X.fill(); }
        for (const [a, k] of [[0, .5], [1.3, .6], [2.5, .45], [3.7, .62], [4.8, .5], [5.7, .38]]) { K.celE(Math.cos(a) * r * k, Math.sin(a) * r * k, r * .11, r * .11, '#c22f45', '#8a1f33', 1, 1, 2.5); X.fillStyle = 'rgba(255,200,200,.7)'; el(Math.cos(a) * r * k - r * .03, Math.sin(a) * r * k - r * .03, r * .03, r * .03); X.fill(); }
        if (crack > .05) { X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .5; let px = Math.cos(a) * r * .3, py = Math.sin(a) * r * .3; X.moveTo(px, py); for (let s = 1; s <= 3; s++) { const kk = .3 + crack * .6 * s / 3, aa = a + (s % 2 ? .18 : -.12); X.lineTo(Math.cos(aa) * r * kk, Math.sin(aa) * r * kk); } } X.stroke(); }
        X.restore();
      } else {   // RIIIP: two ragged halves fall away
        for (const sd of [-1, 1]) { X.save(); X.translate(CX + sd * (14 + rk * 90), CY + rk * rk * 380); X.rotate(sd * (.1 + rk * 1.3)); X.beginPath(); X.rect(sd < 0 ? -r - 20 : 0, -r - 20, r + 20, 2 * r + 40); X.clip();
          X.save(); X.rotate(ang); K.celE(0, 0, r, sq, '#e8b65f', '#b98433', r * .06, r * .06, 6); K.celE(0, 0, r - 9, sq - 9, '#f8dc9c', '#e9bd6c', 0, 0, 0); X.fillStyle = '#e85a4a'; el(0, 0, (r - 9) * .8, (sq - 9) * .8); X.fill(); X.restore();
          X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); for (let q = -6; q <= 6; q++) X.lineTo(q % 2 ? -sd * 7 : sd * 7, q * r / 6); X.stroke(); X.restore(); }
      }
      for (const f of fl) { X.fillStyle = `rgba(255,255,255,${clamp(f.l / .5, 0, 1)})`; el(f.x, f.y, 4.5, 4.5); X.fill(); }
      // the chef
      const cx = 110, cy = 520, spinA = Math.sin(ang * 1.0), up = won ? Math.abs(Math.sin(rk * 9)) * 16 : 0;
      K.shade(cx, cy + 3, 46, 8);
      X.save(); X.translate(cx, cy - up);
      K.arms(8, lost ? -2.6 : -.7 + spinA * .3, lost ? 2.6 : .7 + Math.cos(ang) * .3, 1);
      caos(0, 0, 8, { mood: wiiMood(g) });
      X.beginPath(); X.moveTo(-22, -29); X.quadraticCurveTo(-8, -20, 0, -27); X.quadraticCurveTo(8, -20, 22, -29); X.quadraticCurveTo(10, -36, 0, -31); X.quadraticCurveTo(-10, -36, -22, -29); X.closePath(); ink('#2b1a3f', 2.5);
      rr(-40, -80, 80, 12, 5); ink('#fff', 4); for (const [hx, hy, hr] of [[-24, -98, 22], [0, -108, 26], [24, -98, 22]]) K.celE(hx, hy, hr, hr, '#fff', '#dfe3f3', 3, 3, 4); rr(-40, -80, 80, 12, 5); ink('#fff', 4);
      if (crack > .3 && !g.result) K.sweat(54, -64, 1.2, tt);
      if (lost && rk > .3) { K.celE(10, -116, 20 * clamp((rk - .3) * 6, 0, 1), 14 * clamp((rk - .3) * 6, 0, 1), '#f8dc9c', '#e9bd6c', 2, 2, 3.5); }
      X.restore(); K.tag(cx, cy - up - 72 - 70);
      if (won) for (let i = 0; i < 3; i++) { const q = (rk * 1.5 + i / 3) % 1; K.heart(cx + (i - 1) * 36 + 70, 400 - q * 90, .8, 1 - q); }
      if (won) { X.save(); X.translate(CX, CY); X.rotate(rk * 3); for (let i = 0; i < 6; i++) { const a = i * TAU / 6, d = PR + 22; K.glim(Math.cos(a) * d, Math.sin(a) * d, 10 + Math.sin(rk * 10 + i) * 3, 1); } X.restore(); }
      // the dough thermometer: how close to the pan
      K.gauge(716, 130, 34, 340, clamp((r - 62) / (PR - 62), 0, 1), '#ff4d5e'); K.celE(733, 478, 22, 22, '#ff4d5e', '#c22f45', 3, 3, 4.5);
      if (crack > .3 && !g.result) K.badge('TOO FAST!', W / 2, 92, 38, '#ff4d5e', '#fff', 1 + Math.sin(tt * 30) * .04, -.03);
      if (torn) K.badge('RIIIP!', W / 2, 92, 44, '#ff4d5e', '#fff', outBack(rk / .22), -.05);
      vignette(.16);
    }
  };
  return g;
}

/* 11 ── ROLL!: keep the ball under the acrobat */
function wiiRollBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  X.fillStyle = '#ffe3ea'; X.fillRect(L, 0, VW, 520);
  for (let i = -24; i < 24; i++) { X.fillStyle = i % 2 ? '#ff8fab' : '#ffd0dc'; X.beginPath(); X.moveTo(W / 2, -140); X.lineTo(W / 2 + (i - .5) * 120 * 1.0 - 0, 520); X.lineTo(W / 2 + (i + .5) * 120, 520); X.closePath(); X.fill(); }
  X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(L, 0, VW, 60);
  // bleachers
  X.fillStyle = '#6b3fa0'; X.fillRect(L, 330, VW, 120); X.fillStyle = '#7a4fb4'; for (const y of [345, 385, 425]) X.fillRect(L, y, VW, 20); X.fillStyle = INK; for (const y of [345, 385, 425]) X.fillRect(L, y, VW, 3);
  // ring wall
  X.fillStyle = INK; X.fillRect(L, 436, VW, 4); for (let x = L - ((L % 60) + 60) % 60; x < R; x += 60) { X.fillStyle = (Math.round(x / 60) % 2 + 2) % 2 ? '#ff4d5e' : '#fff'; X.fillRect(x, 440, 60, 76); }
  X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 3; X.beginPath(); for (let x = L - ((L % 60) + 60) % 60; x < R; x += 60) { X.moveTo(x, 440); X.lineTo(x, 516); } X.stroke();
  rr(L - 10, 430, VW + 20, 16, 7); ink('#ffd23f', 4);
  // sawdust
  const gr = X.createLinearGradient(0, 516, 0, 600); gr.addColorStop(0, '#f2d79e'); gr.addColorStop(1, '#d6ad68'); X.fillStyle = gr; X.fillRect(L, 516, VW, 84); X.fillStyle = INK; X.fillRect(L, 514, VW, 5);
  for (let i = 0; i < 60; i++) { X.fillStyle = 'rgba(138,90,43,.3)'; el(L + K.hash(i) * VW, 526 + K.hash(i + 30) * 70, 3 + K.hash(i + 9) * 4, 1.6); X.fill(); }
  // an elephant on a stool in the crowd, and stars on the tent
  for (const [sx, sy] of [[120, 90], [680, 70], [400, 40]]) { K.star(sx, sy, 12, 5, 5, .2, '#ffd23f', 3); }
}
function wiiRoll(sp) {
  const BY = 470, BR = 48; let tx = Math.max(220, Math.min(580, mouse.x)), bx = tx, gx = bx + (Math.random() < .5 ? -1 : 1) * 10, gv = 0, ang = 0; const ph = Math.random() * 6; let t = 0, lw = 0, endAt = -1, lSide = 1;
  const g = {
    wide: true, cmd: 'ROLL!', hint: 'MOUSE / ← → ROLLS THE BALL UNDER HIM', thint: 'DRAG TO ROLL THE BALL', dur: 5, timeWin: true,
    move(p) { tx = p.x; },
    update(dt) {
      t += dt;
      if (keys.ArrowLeft || keys.KeyA) tx -= 600 * dt; if (keys.ArrowRight || keys.KeyD) tx += 600 * dt;
      tx = Math.max(60 - OX, Math.min(740 + OX, tx));
      const old = bx; bx += Math.max(-520 * dt, Math.min(520 * dt, tx - bx)); ang += (bx - old) / BR;
      if (g.result && endAt < 0) endAt = now;
      if (g.result) return;
      const d = gx - bx; gv += (d * 7 * sp + Math.sin(t * 2.1 + ph) * 45 * sp) * dt; gv *= Math.pow(.5, dt); gx += gv * dt;
      if (Math.abs(d) > 54) { g.result = 'lose'; endAt = now; lSide = Math.sign(d) || 1; sfx.thud(); sfx.miss(); shake(9, .3); burst(gx, 440, '#FF4D6D', 14); }
      else if (Math.abs(d) > 40 && t - lw > .35) { lw = t; sfx.blip(-7); }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const won = g.result === 'win', lost = g.result === 'lose', rk = wiiRk(g, endAt), d = gx - bx, danger = !g.result && Math.abs(d) > 36;
      K.layer('roll', wiiRollBg);
      // spotlights sweep
      X.save(); X.globalCompositeOperation = 'lighter'; for (const [sx, k] of [[120, 1], [680, -1]]) { const tx2 = bx + Math.sin(now * 1.2 + sx) * 60; X.fillStyle = 'rgba(255,248,200,.16)'; X.beginPath(); X.moveTo(sx - 14, 0); X.lineTo(sx + 14, 0); X.lineTo(tx2 + 90, 516); X.lineTo(tx2 - 90, 516); X.closePath(); X.fill(); } X.restore();
      // the crowd: every face its own hat; they follow the acrobat
      const skins = [['#f6c9a0', '#e2a574'], ['#d99a6c', '#b87a4c'], ['#8a5a3a', '#6a3e24'], ['#ffd8b8', '#e8b48c'], ['#c68a5c', '#a0663a']];
      for (let row = 0; row < 2; row++) for (let i = -Math.ceil(OX / 66); i < 13 + Math.ceil(OX / 66); i++) {
        const k = i * 2 + row, x = i * 66 + (row ? 33 : 0) + K.hash(k) * 14, y = row ? 414 : 372, sk = skins[Math.abs(k) % 5], hat = Math.abs(k * 7) % 6;
        const mood = won ? 'happy' : lost ? 'bonk' : danger ? 'panic' : 'idle', lk = [clamp((gx - x) / 260, -1, 1), clamp((BY - y) / 160, -1, 1)];
        const bob = won ? Math.abs(Math.sin(rk * 8 + k)) * 8 : 0;
        X.save(); X.translate(x, y - bob);
        if (won) { for (const s of [-1, 1]) K.line([[s * 14, 14], [s * 24, -18 + Math.sin(rk * 12 + k + s) * 7]], 6, sk[0], 2.5); }
        K.celE(0, 24, 20, 14, ['#4D6BFF', '#ff8fab', '#5CFF7A', '#ffd23f', '#c77dff'][Math.abs(k * 3) % 5], 'rgba(20,16,60,.35)', 3, 3, 3.5);
        K.celE(0, 0, 17, 17, sk[0], sk[1], 3, 3, 4);
        if (hat === 0) { X.beginPath(); X.moveTo(-13, -10); X.lineTo(-10, -30); X.lineTo(10, -30); X.lineTo(13, -10); X.closePath(); ink('#ff4d5e', 3); rr(-1, -34, 3, 12, 1); X.fillStyle = '#ffd23f'; X.fill(); }
        else if (hat === 1) { X.beginPath(); X.moveTo(-10, -12); X.lineTo(0, -38); X.lineTo(10, -12); X.closePath(); ink('#4DB8FF', 3); K.celE(0, -39, 4, 4, '#ffd23f', '#d9a31a', 1, 1, 2); }
        else if (hat === 2) { rr(-16, -14, 32, 6, 3); ink('#3a3a52', 3); rr(-10, -30, 20, 18, 4); ink('#3a3a52', 3); }
        else if (hat === 3) { for (const a of [-.6, 0, .6]) K.celE(Math.sin(a) * 12, -16 - Math.cos(a) * 4, 7, 9, '#ff8fab', '#d9647f', 1, 1, 2.5, a); }
        else if (hat === 4) { K.celE(0, -14, 20, 9, '#5CFF7A', '#2f9a55', 2, 2, 3); }
        else { K.celF(() => { X.beginPath(); X.moveTo(-17, -4); X.quadraticCurveTo(-17, -24, 0, -24); X.quadraticCurveTo(17, -24, 17, -4); X.closePath(); }, '#ffd23f', '#d9a31a', 2, 2, 3); rr(2, -9, 22, 5, 2.5); ink('#d9a31a', 2); }
        K.eye(-6, -1, 4.3, mood, lk, tt, k); K.eye(6, -1, 4.3, mood, lk, tt, k + 1);
        X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); if (mood === 'panic') { el(0, 9, 3, 4); X.fillStyle = INK; X.fill(); } else if (mood === 'happy') { X.arc(0, 5, 6, .15 * Math.PI, .85 * Math.PI); X.stroke(); } else { X.moveTo(-3, 9); X.lineTo(3, 9); X.stroke(); }
        X.restore();
      }
      // the elephant in the back row
      { const ex = 650, ey = 330, clap = won ? Math.sin(rk * 12) * 6 : 0; X.save(); X.translate(ex, ey);
        for (const s of [-1, 1]) K.celE(s * 24, -4, 18, 22, '#aab3c4', '#7e88a3', 3, 3, 4, s * .2);
        K.celE(0, 0, 28, 26, '#c9ced6', '#8f9cb3', 5, 5, 4.5);
        const tk = lost ? 1 : 0; X.beginPath(); X.moveTo(-6, 8); X.quadraticCurveTo(-8, 34 - tk * 8, 10 + clap, 40 - tk * 34); X.lineWidth = 17; X.strokeStyle = INK; X.stroke(); X.lineWidth = 10; X.strokeStyle = '#c9ced6'; X.stroke();
        K.eye(-10, -4, 4.8, lost ? 'sleep' : won ? 'happy' : danger ? 'panic' : 'idle', [clamp((gx - ex) / 260, -1, 1), .4], tt, 5); K.eye(10, -4, 4.8, lost ? 'sleep' : won ? 'happy' : danger ? 'panic' : 'idle', [clamp((gx - ex) / 260, -1, 1), .4], tt, 6);
        K.celE(0, -26, 10, 7, '#ff4d5e', '#c22f45', 2, 2, 3); X.restore(); }
      X.fillStyle = 'rgba(60,24,110,.32)'; X.fillRect(-OX, 300, VW, 140);
      { const gg = X.createRadialGradient(gx, 410, 10, gx, 410, 120); gg.addColorStop(0, 'rgba(255,244,190,.5)'); gg.addColorStop(1, 'rgba(255,244,190,0)'); X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = gg; X.fillRect(gx - 130, 280, 260, 260); X.restore(); }
      // the ball
      K.shade(bx, BY + BR + 6, BR * .95, 9, .28);
      X.save(); X.translate(bx, BY); X.rotate(ang); X.beginPath(); X.arc(0, 0, BR, 0, TAU); X.fillStyle = '#fff'; X.fill(); X.save(); X.clip(); X.fillStyle = '#ff4d5e'; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, BR + 4, i * 1.57, i * 1.57 + .785); X.fill(); } K.star(0, 0, 13, 6, 5, 0, '#ffd23f', 2.5); X.restore(); X.restore();
      X.beginPath(); X.arc(bx, BY, BR, 0, TAU); X.lineWidth = 10; X.strokeStyle = INK; X.stroke();
      X.save(); X.beginPath(); X.arc(bx, BY, BR, 0, TAU); X.clip(); X.fillStyle = 'rgba(20,16,60,.2)'; X.beginPath(); X.arc(bx - 10, BY - 12, BR + 2, 0, TAU); X.arc(bx, BY, BR + 20, 0, TAU, true); X.fill('evenodd'); X.restore();
      K.glintE(bx - 18, BY - 24, 10, 5, .6, -.6);
      // the acrobat
      let ax = gx, ay = BY - BR + 2, rot = Math.max(-.6, Math.min(.6, d / 70)), air = 0;
      if (lost) { const q = clamp(rk, 0, .5); ax = gx + lSide * q * 190; ay = Math.min(466, BY - BR + 2 + q * q * 1000); rot = lSide * Math.min(1.5, rk * 6); }
      else if (won) { air = Math.abs(Math.sin(rk * 8)) * 34; ay -= air; rot = Math.sin(rk * 8) * .3; }
      K.shade(ax, 524, 38, 7, .22 - air * .002);
      X.save(); X.translate(ax, ay); X.rotate(rot);
      K.arms(7, lost ? -2.6 : -1.3 + rot * 1.1 + Math.sin(tt * 9) * .12 * (danger ? 3 : 1), lost ? 2.6 : 1.3 + rot * 1.1 - Math.sin(tt * 9) * .12 * (danger ? 3 : 1), 1);
      caos(0, 0, 7, { mood: wiiMood(g) });
      K.celF(() => { X.beginPath(); X.moveTo(-26, -63); X.quadraticCurveTo(-26, -90, 0, -90); X.quadraticCurveTo(26, -90, 26, -63); X.closePath(); }, '#ff4d5e', '#c22f45', 4, 3, 3.5); rr(-30, -68, 60, 8, 4); ink('#ffd23f', 3); K.celE(0, -92, 6, 6, '#ffd23f', '#d9a31a', 1, 1, 2.5);
      if (danger) K.sweat(40, -50, 1, tt); X.restore();
      K.tag(ax, ay - 63 - 54 + (lost ? 0 : 0));
      if (lost && rk > .35) for (let i = 0; i < 3; i++) { const a = rk * 5 + i * TAU / 3; K.star(ax + Math.cos(a) * 34, 452 + Math.sin(a) * 7, 9, 4, 5, a, '#FFE14D', 2.5); }
      if (won) for (let i = 0; i < 3; i++) { const q = (rk * 1.5 + i / 3) % 1; K.heart(gx + (i - 1) * 40, 400 - q * 90, .8, 1 - q); }
      // balance track
      const tl = bx - 44, tw2 = 88, gem = clamp(gx - bx, -40, 40);
      rr(tl, 538, tw2, 12, 6); ink('#fff', 3.5); X.fillStyle = INK; X.fillRect(bx - 1.5, 536, 3, 16);
      K.celE(bx + gem, 544, 8, 8, Math.abs(d) > 40 ? '#ff4d5e' : '#5CFF7A', Math.abs(d) > 40 ? '#c22f45' : '#23a046', 1.5, 1.5, 3);
      vignette(.18);
    }
  };
  return g;
}

/* 12 ── CLOSE IT!: pull the shutter down before the customer gets in */
function wiiCloseBg() {
  const K = WIK, X = K.cx(), { rr, el, ink } = K, L = -OX, R = W + OX;
  let gr = X.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.6, '#86d8fb'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(L, 0, VW, 502);
  // neighbours
  K.celR(L - 20, 130, 200, 372, 6, '#ffb3d1', '#e88db4', 6, 0, 4); K.celR(626, 160, R - 626 + 30, 342, 6, '#cfe6ff', '#9ec0e8', 6, 0, 4);
  for (const [x, y] of [[40, 190], [40, 300], [660, 200], [660, 310]]) for (const dx of [0, 62]) { K.celR(x + dx - OX * (x < 100 ? 1 : -1) * 0 + (x < 100 ? -OX : 0), y, 40, 56, 6, '#fff8c4', '#e8d98a', 3, 3, 3.5); }
  // the shop
  K.celR(180, 70, 440, 430, 8, '#FFD6A5', '#e8aa7a', 8, 0, 6);
  rr(210, 150, 380, 330, 6); ink('#3a2a4a', 5);
  // interior: shelf of cakes, counter, register
  X.save(); rr(210, 150, 380, 330, 6); X.clip(); X.fillStyle = '#4a3560'; X.fillRect(210, 150, 380, 330); X.fillStyle = 'rgba(255,214,102,.1)'; for (let x = 210; x < 590; x += 40) X.fillRect(x, 150, 20, 330);
  X.fillStyle = '#a5622c'; X.fillRect(210, 300, 200, 8); X.fillStyle = INK; X.fillRect(210, 308, 200, 3);
  for (const [cx2, col] of [[240, '#ff8fab'], [290, '#fff3d6'], [340, '#c9894a'], [390, '#ff8fab']]) { K.celR(cx2 - 16, 268, 32, 32, 8, col, 'rgba(60,20,40,.3)', 3, 0, 3); K.celE(cx2, 266, 5, 5, '#ff4d5e', '#c22f45', 1, 1, 2); }
  X.restore();
  K.celR(250, 400, 120, 70, 6, '#d9944f', '#a5622c', 5, 0, 4); K.celE(310, 384, 38, 24, 'rgba(214,244,255,.8)', 'rgba(150,200,230,.8)', 3, 3, 3.5); K.celE(310, 392, 22, 10, '#ff8fab', '#d9647f', 2, 2, 2.5);
  K.celE(520, 392, 40, 40, '#FFE14D', '#d9a31a', 4, 4, 4); K.celE(520, 392, 28, 28, '#ffd23f', '#d9a31a', 2, 2, 2.5); K.star(520, 392, 14, 6, 5, -Math.PI / 2, '#fff3a8', 2); K.glintE(508, 378, 8, 3, .7, -.7);
  // ground
  gr = X.createLinearGradient(0, 500, 0, 600); gr.addColorStop(0, '#d2d6e0'); gr.addColorStop(1, '#9ca2b5'); X.fillStyle = gr; X.fillRect(L, 500, VW, 100); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(L, 504, VW, 10); X.fillStyle = INK; X.fillRect(L, 498, VW, 5);
  X.strokeStyle = 'rgba(20,16,28,.15)'; X.lineWidth = 3; X.beginPath(); X.moveTo(L, 548); X.lineTo(R, 548); for (let x = L + 30, i = 0; x < R; x += 120, i++) { X.moveTo(x + (i % 2) * 40, 516); X.lineTo(x + (i % 2) * 40 - 14, 548); } X.stroke();
  // awning with scallops
  for (let i = 0; i < 8; i++) { X.fillStyle = i % 2 ? '#fff' : '#ff4d5e'; X.fillRect(180 + i * 55, 70, 55, 62); X.beginPath(); X.arc(207.5 + i * 55, 132, 27.5, 0, Math.PI); X.fill(); }
  X.save(); X.beginPath(); X.rect(180, 70, 440, 62); for (let i = 0; i < 8; i++) X.arc(207.5 + i * 55, 132, 27.5, 0, Math.PI); X.restore();
  X.strokeStyle = INK; X.lineWidth = 6; X.lineJoin = 'round'; X.beginPath(); X.moveTo(180, 132); X.lineTo(180, 70); X.lineTo(620, 70); X.lineTo(620, 132); for (let i = 7; i >= 0; i--) X.arc(207.5 + i * 55, 132, 27.5, 0, Math.PI); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(184, 74, 432, 8);
}
function wiiClose(sp) {
  const SY0 = 150, SY1 = 466, DX = 300; let sy = SY0, grab = false, g0 = 0, s0 = 0, cx = -40 - OX, t = 0, bump = 0, lw = 0, endAt = -1;
  const v = 175 * Math.sqrt(sp) * (DX + 40 + OX) / (DX + 40);
  const g = {
    wide: true, cmd: 'CLOSE IT!', hint: 'DRAG THE SHUTTER DOWN FAST', thint: 'PULL DOWN FAST', dur: 5,
    down(p) { if (g.result) return; grab = true; g0 = p.y; s0 = sy; sfx.click(); },
    move(p) { if (grab && !g.result) { sy = Math.max(SY0, Math.min(SY1, s0 + p.y - g0)); } },
    up() { grab = false; },
    update(dt) {
      t += dt; if (g.result) { bump += dt; if (endAt < 0) endAt = now; return; }
      if (keys.ArrowDown || keys.KeyS || keys.Space) sy = Math.min(SY1, sy + 700 * dt);
      else if (!grab && sy < SY1) sy = Math.max(SY0, sy - 40 * dt);
      if (sy >= SY1 - 2) { sy = SY1; g.result = 'win'; sfx.stamp(); sfx.thud(); shake(12, .3); burst(400, SY1, '#fff', 16, 300); ring(400, SY1, '#FFE14D', 150, .4); floatText('CLOSED!', 400, 120, '#FFE14D', 40); return; }
      if (t > .3) { cx += v * dt; if (t - lw > .28) { lw = t; sfx.tick(); } }
      if (cx >= DX) { g.result = 'lose'; sfx.miss(); wiiBang(DX, 480); }
    },
    draw(tt) {
      const K = WIK, X = K.begin(), { rr, el, ink, TAU, clamp, ease, outBack } = K;
      if (g.result && endAt < 0) endAt = now;
      const closed = g.result === 'win', lose = g.result === 'lose', rk = wiiRk(g, endAt);
      K.layer('close', wiiCloseBg);
      K.cloud(((now * 6 + 500) % (VW + 260)) - OX - 130, 36, .6); K.cloud(((now * 4 + 80) % (VW + 260)) - OX - 130, 190, .5);
      // a pigeon on the awning, startled by the slam
      K.pigeon(80 + (closed ? rk * 140 : 0), 130 - (closed ? Math.min(rk, .9) * 40 : 0), .8, 1, now, closed ? 1 : 0);
      // emptied cakes when the customer wins
      if (lose) { X.save(); rr(222, 262, 180, 40, 4); X.clip(); X.fillStyle = '#4a3560'; X.fillRect(222, 262, 180, 40); X.fillStyle = 'rgba(255,214,102,.1)'; for (let x = 210; x < 410; x += 40) X.fillRect(x, 262, 20, 40); X.restore(); }
      // the shutter
      X.fillStyle = INK; rr(206, SY0 - 4, 388, sy - SY0 + 8, 4); X.fill();
      for (let y = SY0; y < sy; y += 22) { const hh = Math.min(20, sy - y); X.fillStyle = (((y - SY0) / 22) | 0) % 2 ? '#aab4c4' : '#c3cbd8'; X.fillRect(210, y, 380, hh); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(210, y, 380, Math.min(4, hh)); X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(210, y + hh - 3, 380, 3); }
      rr(206, sy - 8, 388, 16, 6); ink('#7a8497', 4); K.celR(370, sy - 6, 60, 12, 6, '#c3cbd8', '#7a8497', 0, 2, 3); K.glintE(380, sy - 3, 14, 1.6, .8, 0);
      // hanging sign
      { const sw = Math.sin(now * 2) * .06 + (closed ? Math.sin(rk * 20) * .08 * Math.max(0, 1 - rk) : 0); X.save(); X.translate(400, 138); X.rotate(sw); K.line([[-30, 0], [-26, 24]], 3, '#e8d7a8', 2); K.line([[30, 0], [26, 24]], 3, '#e8d7a8', 2);
        const flip = closed ? Math.abs(Math.cos(clamp(rk * 6, 0, 1) * Math.PI)) : 1; X.translate(0, 38); X.scale(flip, 1); rr(-52, -16, 104, 32, 16); ink(closed && rk > .08 ? '#FF4D6D' : '#5CFF7A', 4); txt(closed && rk > .08 ? 'CLOSED' : 'OPEN', 0, 1, 22, '#fff'); X.restore(); }
      // customer
      const x = lose ? DX + 20 + Math.min(1, bump * 3) * 110 : cx, bounce = closed ? Math.min(1, bump * 6) * -30 : 0, px = Math.min(x, closed ? DX : x) + bounce;
      K.shade(Math.min(x, closed ? DX : x) + bounce, 504, 34, 7);
      X.save(); X.translate(px, 500);
      caos(0, 0, 6, { col: '#4DB8FF', run: lose || closed ? null : tt, mood: lose ? 'happy' : closed ? 'sad' : null });
      if (!closed && !lose) { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i < 3; i++) { X.moveTo(-42 - i * 5, -20 - i * 9 + Math.sin(tt * 18 + i) * 2); X.lineTo(-52 - i * 5, -20 - i * 9 + Math.sin(tt * 18 + i) * 2); } X.stroke(); }
      if (closed) { for (let i = 0; i < 3; i++) { const a = rk * 6 + i * TAU / 3; K.star(Math.cos(a) * 30, -62 + Math.sin(a) * 8, 8, 3.5, 5, a, '#FFE14D', 2.5); } K.celE(18, -60, 7, 6, '#ff8fab', '#d9647f', 1, 1, 2.5); }
      if (lose) { K.celR(26, -34, 22, 14, 6, '#ff8fab', '#d9647f', 2, 2, 3); K.celR(26, -42, 22, 8, 4, '#fff3d6', '#e8c98c', 1, 1, 3); for (let i = 0; i < 4; i++) { const q = (rk * 2 + i * .25) % 1; K.celE(10 + i * 8 + q * 20, -30 + q * 40, 3, 3, '#fff3d6', '#e8c98c', 0, 0, 1.5); } }
      X.restore();
      if (!closed && !lose) {   // cake thought bubble, with a worried face when close
        const bx = px + 6, by = 500 - 54 - 40; K.celE(bx, by, 28, 22, '#fff', '#dfe3f3', 3, 3, 4); K.celE(bx - 14, by + 28, 6, 5, '#fff', '#dfe3f3', 1, 1, 3); K.celR(bx - 13, by - 6, 26, 14, 6, '#ff8fab', '#d9647f', 2, 2, 3); K.celE(bx, by - 8, 4, 4, '#ff4d5e', '#c22f45', 1, 1, 2);
        if (cx > DX - 160) K.badge('!', px + 44, 500 - 100, 28, '#ff4d5e', '#fff', 1 + Math.sin(tt * 24) * .06, .08);
      }
      // the shopkeeper hooks the shutter with a pole
      const kx = 700, ky = 504; K.shade(kx, ky + 3, 40, 8);
      const hand = { x: kx - 36, y: ky - 31 }, tip = { x: 598, y: sy + 4 };
      K.line([[tip.x, tip.y], [tip.x + (hand.x - tip.x) * 1.5, tip.y + (hand.y - tip.y) * 1.5]], 7, '#a5622c', 3); K.celE(tip.x - 2, tip.y + 2, 7, 7, '#aab3c4', '#7e88a3', 1, 1, 3);
      X.save(); X.translate(kx, ky - (closed ? Math.abs(Math.sin(rk * 9)) * 12 : 0)); caos(0, 0, 6, { mood: wiiMood(g) }); if (!closed && !lose && cx > DX - 180) K.sweat(36, -46, 1, tt); K.celF(() => { X.beginPath(); X.moveTo(-26, -54); X.quadraticCurveTo(-26, -76, 0, -76); X.quadraticCurveTo(26, -76, 26, -54); X.closePath(); }, '#ffd23f', '#d9a31a', 3, 3, 3.5); X.restore();
      K.reach(kx - 36, ky - 31, hand.x - 8, hand.y - 6, OR, 10, 15); K.tag(kx, ky - 54 - 52);
      if (closed) { K.badge('PHEW!', kx - 10, 330, 34, '#4DB8FF', '#fff', outBack(rk / .22), -.04); K.sweat(kx + 30, ky - 70, 1.3, rk * 2); }
      vignette(.16);
    }
  };
  return g;
}

reg('wii_save', wiiSave, 'SAVE ME!');
reg('wii_zap', wiiZap, 'ZAP!');
reg('wii_draw', wiiDraw, 'DRAW!');
reg('wii_sneak', wiiSneak, 'SNEAK!');
reg('wii_umbrella', wiiUmbrella, 'UMBRELLA!');
reg('wii_pop', wiiPop, 'POP IT!');
reg('wii_strike', wiiStrike, 'STRIKE!');
reg('wii_shave', wiiShave, 'SHAVE!');
reg('wii_fan', wiiFan, 'FAN IT!');
reg('wii_twirl', wiiTwirl, 'TWIRL!');
reg('wii_roll', wiiRoll, 'ROLL!');
reg('wii_close', wiiClose, 'CLOSE IT!');
