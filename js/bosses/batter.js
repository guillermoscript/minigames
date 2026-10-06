'use strict';
/* BATTER boss (SPORTS DAY): batting practice against a goofy pitching machine, seen from behind Claude.
   After Mega Microgame$' "Ultra Machine" / Gold's "One Hit Wonder". Pitches: normal, FASTBALL, CHANGE-UP (slow, wobbly)
   and a TRICK pitch that stops mid-air once. Swing as the ball reaches the ring: 5 hits win, 3 strikes lose. */
(function () {
  let BATP = null;
  const VX = 400, HZ = 200, GK = 320, gy = z => HZ + GK / z, gx = (X, z) => VX + X * GK / z;   // ground projection
  const MX = 400, MY = gy(4), MS = .9, OX0 = MX, OY0 = MY - 56 * MS;                             // machine on the mound
  const CX = 292, CY = 534, CU = 8, PX = CX + 7 * CU, PY = CY - 5.5 * CU, ZX = 410, ZY = 446;    // Claude, hands, zone
  const NEED = 5, OUTS = 3, PITCHES = 7, HP = .75, A0 = -2.3, A1 = .5, LATE = .03, APR = .42;   // APR: approach-ring lead time
  const TYPES = { N: { fly: .82, wind: .4 }, F: { fly: .58, wind: .5, label: 'FASTBALL!', col: '#ff5a4d' },
    C: { fly: 1.3, wind: .5, label: 'CHANGE-UP!', col: '#7ad7ff' }, S: { fly: .8, wind: .5, label: 'TRICK PITCH!', col: '#c78bff' } };
  const zOf = p => p <= 1 ? 4 - 3 * p : Math.max(.3, 1 - 1.2 * (p - 1)), wOf = z => (1 / z - .25) / .75;
  const ease = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const crack = () => { noise(.07, .3, 3500, 7000, 'highpass'); snd(1500, .05, 'square', .06, 0, 600); snd(180, .14, 'triangle', .1); };
  const pomp = () => { snd(150, .12, 'sine', .14, 0, 55); noise(.1, .12, 500); };
  const SKY = ['#ff4d9e', '#FFE14D', '#4DB8FF', '#5CFF7A', '#fff', '#D97757', '#c78bff'];

  /* ───────────── art kit (the DUO look, docs/ART-STYLE.md): a local copy of the drawing helpers. Everything draws on X, which can be swapped for an
     offscreen context so the same code bakes the static ballpark once. Nothing here calls Math.random, so the boss's own randomness is untouched. ───────────── */
  const K = (() => {
    const TAU = Math.PI * 2;
    let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
    const K = { TAU };
    K.cx = () => X;
    const cl = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    K.dk = (c, k = .78) => { const n = parseInt(c.slice(1), 16); return `rgb(${(n >> 16 & 255) * k | 0},${(n >> 8 & 255) * k | 0},${(n & 255) * k | 0})`; };
    K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
    const BKD = {}; K.baked = (key, fn) => { const k = key + '@' + VW; if (!BKD[k]) BKD[k] = K.bake(VW, H, () => { X.translate(OX, 0); fn(); }); return BKD[k]; };
    const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
    const mkRR = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
    const PR = {}; K.rrP = (x, y, w, h, r) => { const k = x + ',' + y + ',' + w + ',' + h + ',' + r; return PR[k] || (PR[k] = mkRR(x, y, w, h, r)); };
    const PE = {}; K.elP = (x, y, rx, ry) => { const k = x + ',' + y + ',' + rx + ',' + ry; if (!PE[k]) { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); PE[k] = p; } return PE[k]; };
    const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
    const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
    const inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
    K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
    K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
    /* a cel-shaded ball for any radius (no Path2D memo: r changes every frame) */
    K.dot = (x, y, r, base, shade, o = 3) => {
      X.beginPath(); X.arc(x, y, r, 0, TAU); X.lineJoin = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } X.fillStyle = shade; X.fill();
      X.save(); X.beginPath(); X.arc(x, y, r, 0, TAU); X.clip(); X.fillStyle = base; X.beginPath(); X.arc(x - r * .2, y - r * .24, r, 0, TAU); X.fill(); X.restore();
    };
    K.poly = (pts, fill, o = 4) => { X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.closePath(); ink(fill, o); };
    K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
    K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
    K.vg = (y0, y1, stops) => { const g = X.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
    K.hills = (L, R, base, amp, freq, ph, fill, line, lw = 3, y2 = base + 4) => {
      X.beginPath(); X.moveTo(L, y2); for (let x = L; x <= R + 8; x += 8) X.lineTo(x, base - amp * (.55 + .45 * Math.sin(x * freq + ph) * Math.cos(x * freq * .37 + ph * 2)));
      X.lineTo(R, y2); X.closePath(); X.fillStyle = fill; X.fill(); if (line) { X.lineWidth = lw; X.strokeStyle = line; X.lineJoin = 'round'; X.stroke(); }
    };
    K.heart = (x, y, s, a = 1) => {
      X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
      ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
    };
    K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
    K.shade = (x, y, rx, ry, a = .25) => { X.fillStyle = `rgba(20,16,28,${a})`; el(x, y, rx, ry); X.fill(); };
    K.cloud = (x, y, s, col = '#ffe3f0') => {
      X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3, '#a8508a'); }
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = col; X.fill(); }
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff4f8'; X.fill(); } X.restore();
    };
    K.tag = (x, y, label, col = '#ffe14d', up = false) => {
      X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = typeof t === 'function' ? t(label) : label, w = Math.min(170, X.measureText(s).width + 26), py = up ? -1 : 1;
      X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
      rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
      txt(label, x, y + 1, 17, INK, 'center', w - 14);
    };
    return K;
  })();

  function baseball(x, y, r, rot) {
    K.dot(x, y, r, '#fbf8ef', '#d9d0b8', Math.max(2, r * .16));
    if (r < 6) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = '#e8433a'; ctx.lineWidth = Math.max(1.5, r * .12); ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * r * 1.25, 0, r * .8, (sd > 0 ? Math.PI : 0) - .9, (sd > 0 ? Math.PI : 0) + .9); ctx.stroke(); }
    ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - r * .38, y - r * .42, r * .3, r * .16, -.6, 0, 7); ctx.fill();
  }
  function machine(o) {                                   // pitching machine with a face; o: {type, wu, mood, clk, sq, open, ws, left}
    const X = ctx, c = o.clk, win = o.wu >= 0, F = win && o.type === 'F', sh = F ? Math.sin(c * 70) * 3 : o.mood === 'laugh' ? Math.sin(c * 40) * 2 : 0;
    const rock = o.mood === 'ko' ? .3 : win && o.type === 'C' ? Math.sin(c * 4) * .12 : win && o.type === 'S' ? Math.sin(c * 9) * .08 : 0;
    X.save(); X.translate(MX + sh, MY); X.rotate(rock); X.scale(MS * (1 + o.sq * .18), MS * (1 - o.sq * .22));
    X.lineCap = 'round';
    for (const [x, y] of [[-38, 2], [38, 2], [0, 6]]) K.line([[0, -40], [x, y]], 5, '#9a96ad');
    for (const x of [-38, 38]) { K.el(x, 4, 10, 4.5); K.ink('#8d88a6', 3); }
    // the antenna lamp tells the pitch (grey while it sleeps, red / blue / purple for the tricks)
    const lamp = o.mood === 'ko' ? '#8d88a6' : win ? ({ F: '#ff5a4d', C: '#7ad7ff', S: '#c78bff' }[o.type] || '#ffe14d') : '#ffe14d';
    K.line([[0, -130], [0, -154]], 3, '#8d88a6'); K.dot(0, -160, 8, lamp, K.dk(lamp, .7), 3);
    if (win && o.mood !== 'ko') { X.fillStyle = `rgba(255,255,255,${.12 + .1 * Math.sin(c * 14)})`; X.beginPath(); X.arc(0, -160, 15, 0, 7); X.fill(); }
    // the hopper holds the balls that are left
    K.poly([[-34, -96], [-48, -130], [48, -130], [34, -96]], '#d8d4e6', 4); X.fillStyle = 'rgba(255,255,255,.45)'; X.beginPath(); X.moveTo(-40, -102); X.lineTo(-45, -124); X.lineTo(-33, -124); X.lineTo(-30, -102); X.closePath(); X.fill();
    for (let i = 0; i < o.left; i++) K.dot(-30 + (i % 4) * 20 + (i > 3 ? 10 : 0), i > 3 ? -136 : -122, 8, '#fbf8ef', '#d9d0b8', 3);
    const bc = F && (c * 16 | 0) % 2 ? '#ff5a4d' : o.mood === 'ko' ? '#5b5470' : '#4d7cff';
    const BODY = K.rrP(-52, -98, 104, 60, 14); K.cel(BODY, bc, K.dk(bc, .7), 5, 7, 5); K.glint(BODY, -30, -90, 28, 5, .5, -.05);
    X.fillStyle = 'rgba(255,255,255,.3)'; for (const sx of [-1, 1]) { X.beginPath(); X.arc(sx * 44, -44, 2.4, 0, 7); X.fill(); }
    for (const sd of [-1, 1]) {                              // spinning wheels
      K.dot(sd * 58, -66, 24, '#4a4566', '#2b2640', 5); X.strokeStyle = '#8d88a6'; X.lineWidth = 4;
      for (let k = 0; k < 3; k++) { const a = o.ws * sd + k * 2.09; X.beginPath(); X.moveTo(sd * 58, -66); X.lineTo(sd * 58 + Math.cos(a) * 19, -66 + Math.sin(a) * 19); X.stroke(); }
      K.dot(sd * 58, -66, 6, '#FFE14D', '#d99b1a', 3);
    }
    X.fillStyle = 'rgba(255,140,170,.5)'; for (const sd of [-1, 1]) { X.beginPath(); X.ellipse(sd * 38, -58, 7, 4.5, 0, 0, 7); X.fill(); }
    for (const sd of [-1, 1]) {                              // googly eyes + brows per mood / pitch
      const ex = sd * 20, ey = -78; X.strokeStyle = INK; X.lineWidth = 5;
      if (o.mood === 'ko') { X.beginPath(); X.moveTo(ex - 8, ey - 8); X.lineTo(ex + 8, ey + 8); X.moveTo(ex + 8, ey - 8); X.lineTo(ex - 8, ey + 8); X.stroke(); continue; }
      if (o.mood === 'laugh') { X.beginPath(); X.moveTo(ex - 9, ey + 4); X.lineTo(ex, ey - 5); X.lineTo(ex + 9, ey + 4); X.stroke(); continue; }
      if (win && o.type === 'S' && sd > 0) { X.beginPath(); X.moveTo(ex - 9, ey); X.lineTo(ex + 9, ey); X.stroke(); continue; }   // wink
      const big = o.mood === 'shock'; circ(ex, ey, big ? 13 : 11, '#fff', 3);
      const j = Math.sin(c * 23 + sd) * (big ? 1 : 2.5), pr = big ? 3 : 5; circ(ex + j, ey + (big ? 0 : 2), pr, INK, 0);
      X.fillStyle = '#fff'; X.beginPath(); X.arc(ex + j - pr * .35, ey + (big ? 0 : 2) - pr * .4, pr * .35, 0, 7); X.fill();
      if (win && o.type === 'C') { X.fillStyle = '#4d7cff'; X.fillRect(ex - 13, ey - 14, 26, 12); X.beginPath(); X.moveTo(ex - 13, ey - 2); X.lineTo(ex + 13, ey - 2); X.stroke(); }
      if (F) { X.beginPath(); X.moveTo(ex - sd * 13, ey - 19); X.lineTo(ex + sd * 9, ey - 10); X.stroke(); }
      if (win && o.type === 'S') { X.beginPath(); X.arc(ex, ey - 12, 12, -2.6, -.5); X.stroke(); }
    }
    const op = o.mood === 'laugh' ? .8 + Math.sin(c * 40) * .2 : o.mood === 'shock' ? 1 : o.open;    // mouth = the ball chute
    K.el(0, -55, 15 + op * 3, 4 + op * 9); K.ink('#2b1a3a', 3);
    if (win && o.left >= 0) baseball(0, -55, 6, 0);
    if (o.mood === 'laugh') { X.fillStyle = '#ff7a9a'; X.beginPath(); X.ellipse(0, -49, 8, 4, 0, 0, 7); X.fill(); }
    X.restore();
  }

  /* the ballpark: a sunset sky, a grandstand, an outfield wall with ad panels, mowed stripes, the infield and home plate. All static, baked once at the view width. */
  function btBake() {
    const X = K.cx(), L = -OX, R = W + OX;
    X.fillStyle = K.vg(0, HZ + 10, [[0, '#3b2a8c'], [.5, '#ff7aa8'], [1, '#ffc46b']]); X.fillRect(L, 0, VW, HZ + 10);
    // the sun with halo rings, a far skyline
    for (const [r, a] of [[118, .1], [92, .14], [70, .2]]) { X.fillStyle = `rgba(255,236,170,${a})`; X.beginPath(); X.arc(150, 150, r, 0, K.TAU); X.fill(); }
    X.beginPath(); X.arc(150, 150, 54, 0, K.TAU); K.ink('#ffd36b', 4); X.fillStyle = '#fff0b8'; K.el(136, 136, 18, 11, -.6); X.fill();
    K.hills(L, R, 134, 30, .012, 1, '#a04a9a', '#6b2f78', 3, 140);
    for (let i = 0; i < 9; i++) { const bx = L + 40 + i * (VW / 9), bh = 28 + K.hash(i) * 30; K.rr(bx, 128 - bh, 34, bh + 4, 4); K.ink('#7d3d8e', 2.5, '#5a2a70'); X.fillStyle = 'rgba(255,225,140,.7)'; for (let j = 0; j < 3; j++) X.fillRect(bx + 7 + (j % 2) * 12, 128 - bh + 8 + j * 12, 6, 6); }
    // the grandstand: dark purple steps with rails
    X.fillStyle = K.vg(130, 206, [[0, '#4a3a8a'], [1, '#2f2466']]); X.fillRect(L, 132, VW, 74);
    X.fillStyle = INK; X.fillRect(L, 128, VW, 5);
    for (let r = 0; r < 3; r++) { const y = 154 + r * 17; K.rr(L - 6, y + 6, VW + 12, 6, 3); K.ink('#6a5acd', 2); }
    for (let x = L + 30; x < R; x += 120) { X.fillStyle = 'rgba(255,255,255,.1)'; X.fillRect(x, 133, 14, 72); }
    // floodlight towers
    for (const x of [L + 70, R - 70]) { K.line([[x, 133], [x, 62]], 6, '#8f88a6'); K.rr(x - 30, 38, 60, 30, 8); K.ink('#d8d4e6', 3.5); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { X.beginPath(); X.arc(x - 18 + i * 18, 47 + j * 13, 5, 0, K.TAU); K.ink('#fff3a0', 1.5); } }
    // the outfield wall: padded green with ad panels
    K.rr(L - 10, 190, VW + 20, 22, 6); K.ink('#1d6b45', 4);
    for (let x = L - 4, i = 0; x < R; x += 96, i++) { K.rr(x + 6, 194, 84, 14, 4); K.ink(['#ff5c8a', '#4DB8FF', '#ffe14d', '#c78bff'][i % 4], 2); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(x + 12, 198, 20, 3); K.star(x + 70, 201, 5, 2.3, 5, -Math.PI / 2, '#fff', 1.5); }
    X.fillStyle = '#FFE14D'; X.fillRect(L, 186, VW, 5); X.fillStyle = INK; X.fillRect(L, 186, VW, 1.5);
    // grass with mowed stripes
    X.fillStyle = '#4fb35a'; X.fillRect(L, 212, VW, H - 212);
    for (let i = 0; i < 14; i++) { const z0 = 12 / Math.pow(1.22, i), z1 = z0 / 1.22; X.fillStyle = i % 2 ? '#3f9a4a' : '#4fb35a'; X.fillRect(L, gy(z0), VW, gy(z1) - gy(z0) + 1); }
    X.fillStyle = INK; X.fillRect(L, 209, VW, 4);
    const poly = (pts, fill, o) => { X.beginPath(); for (const [x, z] of pts) X.lineTo(gx(x, z), gy(z)); X.closePath(); if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke(); } X.fillStyle = fill; X.fill(); };
    poly([[-.7, .82], [-2.7, 2.6], [-1.6, 5], [0, 7.5], [1.6, 5], [2.7, 2.6], [.7, .82]], '#c98a4f', 5);              // infield dirt
    poly([[0, 1.35], [-1.75, 2.75], [0, 5.6], [1.75, 2.75]], '#45a650', 0);
    X.strokeStyle = '#fff'; X.lineWidth = 4; X.lineCap = 'round'; for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(gx(0, 1), gy(1)); X.lineTo(gx(sd * 14.5, 12), gy(12)); X.stroke(); }
    for (const [x, z] of [[-1.75, 2.75], [0, 5.6], [1.75, 2.75]]) { const px = gx(x, z), py = gy(z), s = 60 / z; K.rr(px - s / 2, py - s / 5, s, s / 2.5, 4); K.ink('#fff', 3); }
    // the mound (the machine stands on it) and home plate on a dirt patch
    K.cel(K.elP(MX, MY, 64, 13), '#d9a066', '#b97a42', 4, 3, 4);
    K.el(400, 520, 190, 44); K.ink('#c98a4f', 4); X.fillStyle = 'rgba(255,255,255,.14)'; K.el(380, 510, 80, 12); X.fill();
    X.beginPath(); X.moveTo(400, 508); X.lineTo(436, 516); X.lineTo(430, 530); X.lineTo(370, 530); X.lineTo(364, 516); X.closePath(); K.ink('#fff', 5); X.fillStyle = 'rgba(20,16,28,.12)'; X.fillRect(372, 523, 56, 6);
    X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 3; X.lineJoin = 'round'; K.rr(232, 496, 116, 56, 6); X.stroke(); K.rr(452, 496, 116, 56, 6); X.stroke();
  }

  BOSSES.batter = function (sp) {
    const k = Math.sqrt(Math.min(sp, 1.3)), win = .17 - .04 * Math.min(sp, 1.3), AFT = .32 / k;
    const order = ['N'].concat(shuffle(['F', 'C', 'S', 'N', Math.random() < .5 ? 'F' : 'C', 'N']));
    let ph = 'ready', pt = .35, idx = -1, hits = 0, strikes = 0, clk = 0, stop = 0, ball = null, swingT = -1, lastCall = null;
    let msq = 0, mopen = 0, ws = 0, mmood = null, mmoodT = 0, crowdJ = 0, cflash = 0, joy = 0, smoke = [];
    const outs = [], crowd = [];
    for (let r = 0; r < 3; r++) for (let x = -700; x < 1500; x += 17) crowd.push({ x: x + r * 8, y: 146 + r * 17, c: SKY[(x * 7 + r * 3 & 255) % SKY.length], ph: x * .37 + r });
    const cur = () => TYPES[order[idx]] || TYPES.N;
    const dur = Math.ceil((.35 + order.reduce((s, ty) => s + (TYPES[ty].wind + TYPES[ty].fly + (ty === 'S' ? .5 : 0)) / k + win + LATE + AFT, 0) + .9) * 2) / 2;
    const pOf = b => b.type !== 'S' ? b.tau / b.f : b.tau < b.a ? HP * b.tau / b.a : b.tau < b.a + b.h ? HP : HP + (1 - HP) * (b.tau - b.a - b.h) / b.c;
    function bpos(b) {
      const p = pOf(b), z = zOf(p), w = wOf(z), q = Math.min(1, p);
      let x = OX0 + (ZX - OX0) * w, y = OY0 + (ZY - OY0) * w - Math.sin(q * Math.PI) * (b.type === 'C' ? 70 : 16);
      if (b.type === 'C') x += Math.sin(b.tau * 13) * 26 * (1 - q);
      if (b.type === 'S' && p === HP) x += Math.sin(clk * 70) * 2;
      return { p, z, x, y, r: 24 / z };
    }
    function startWind() { idx++; ph = 'wind'; pt = cur().wind / k; sfx.tick(); const ty = order[idx];
      if (ty === 'F') snd(260, pt, 'sawtooth', .03, 0, 1100); else if (ty === 'C') snd(520, pt, 'triangle', .04, 0, 200); else if (ty === 'S') { sfx.blip(3); sfx.blip(7); } }
    function release() {
      const ty = order[idx], f = TYPES[ty].fly / k; ph = 'fly'; msq = .7; mopen = 1; pomp();
      ball = { type: ty, tau: 0, f, judged: false, swung: false, hovered: false };
      if (ty === 'S') { ball.a = .5 * f / .8; ball.c = .42 * f / .8; ball.h = (.3 + Math.random() * .25) / k; ball.arr = ball.a + ball.h + ball.c; } else ball.arr = f;
      if (ty === 'F') sfx.zap(); if (ty === 'C') sfx.boing();
    }
    function judged() { ball.judged = true; ph = 'after'; pt = AFT; }
    function strike(msg) {
      judged(); strikes++; lastCall = { idx, t: clk };
      floatText('STRIKE!', ZX + 150, ZY - 50, '#ff4d4d', 50); if (msg) floatText(msg, ZX + 150, ZY - 5, '#fff', 26);
      sfx.buzz(); shake(6, .2); cflash = .45; mmood = 'laugh'; mmoodT = .9; floatText('HA HA!', MX - 125, MY - 75, '#fff', 24);
      if (strikes >= OUTS) { g.result = 'lose'; mmoodT = 99; sfx.miss(); }
    }
    function hit(d) {
      const b = bpos(ball), hr = Math.abs(d) <= .045, side = Math.random() < .5 ? -1 : 1;
      judged(); hits++; stop = hr ? .12 : .07; ball.hitOut = true;
      const e = Math.min(1, Math.max(0, (Math.atan2(b.y - PY, b.x - PX - 8) - A0) / (A1 - A0))); swingT = .11 * (1 - Math.cbrt(1 - e));   // freeze on the bat meeting the ball
      outs.push({ x0: b.x, y0: b.y, r0: b.r, hr, t: 0, d: hr ? 1.3 : .9, tx: 400 + side * (hr ? 230 + Math.random() * 150 : 150 + Math.random() * 220), ty: hr ? 172 + Math.random() * 18 : 222 + Math.random() * 20, trail: [] });
      ball = null; crack(); shake(hr ? 14 : 8, .25); burst(b.x, b.y, '#FFE14D', 18, 420); burst(b.x, b.y, '#fff', 8, 300); ring(b.x, b.y, '#fff', 90, .3);
      floatText(hr ? 'HOME RUN!' : 'NICE HIT!', ZX + 20, ZY - 105, hr ? '#FFE14D' : '#5CFF7A', hr ? 54 : 44);
      if (hr) { sfx.sparkle(); [660, 880, 1320].forEach((f, i) => snd(f, .12, 'square', .05, .08 * i)); } else sfx.coin();
      sfx.blip(hits * 2); crowdJ = 1; joy = .5; mmood = 'shock'; mmoodT = .6;
      if (hits >= NEED) { g.result = 'win'; mmood = 'ko'; mmoodT = 99; confetti(MX, MY - 60, 60); setTimeout(() => sfx.splat(), 150); }
    }
    function swing() {
      if (g.result) return;
      swingT = 0; sfx.whoosh();
      if (lastCall && lastCall.idx === idx && clk - lastCall.t < .35 && ball && !ball.swung) { ball.swung = true; floatText('TOO LATE!', ZX + 150, ZY - 5, '#fff', 26); }
      if (!ball || ball.judged || ball.swung) return;      // between pitches: harmless practice swing
      ball.swung = true; const d = ball.tau - ball.arr;
      if (d >= -win && d <= win + LATE) hit(d); else strike('TOO EARLY!');
    }
    const g = {
      cmd: 'BOSS!', hint: 'CLICK/SPACE AS BALL HITS RING', thint: 'TAP AS BALL HITS RING', dur, boss: true, wide: true,
      key(e) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') swing(); },
      down() { swing(); },
      update(dt) {
        if (stop > 0) { stop -= dt; return; }                 // hit-stop on contact: bat and ball freeze together
        for (const o of outs) { o.t += dt; const u = ease(o.t / o.d); o.x = o.x0 + (o.tx - o.x0) * u; o.y = o.y0 + (o.ty - o.y0) * u - Math.sin(u * Math.PI) * (o.hr ? 90 : 50); o.r = o.r0 + (2.5 - o.r0) * u;
          o.trail.push([o.x, o.y, o.r]); if (o.trail.length > 16) o.trail.shift();
          if (o.t >= o.d && !o.done) { o.done = true; if (o.hr) { confetti(o.x, o.y, 30); burst(o.x, o.y, '#FFE14D', 16, 200); ring(o.x, o.y, '#FFE14D', 60, .5); sfx.sparkle(); } } }
        for (let i = outs.length - 1; i >= 0; i--) if (outs[i].t > outs[i].d + .5) outs.splice(i, 1);
        for (const s of smoke) { s.y -= 40 * dt; s.r += 14 * dt; s.a -= dt * .7; }
        clk += dt; msq *= Math.pow(.01, dt); mopen = Math.max(0, mopen - dt * 2.5); crowdJ = Math.max(0, crowdJ - dt * 1.6);
        cflash = Math.max(0, cflash - dt); joy = Math.max(0, joy - dt); ws += dt * (ph === 'wind' && order[idx] === 'F' ? 40 : ph === 'wind' ? 14 : 4);
        if (swingT >= 0) { swingT += dt; if (swingT > .6) swingT = -1; }
        if ((mmoodT -= dt) <= 0) mmood = null;
        if (g.result === 'win' && Math.random() < dt * 8) smoke.push({ x: MX + (Math.random() - .5) * 60, y: MY - 100, r: 8, a: .8 });
        for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].a <= 0) smoke.splice(i, 1);
        if (ball) {
          ball.tau += dt; const p = pOf(ball);
          if (ball.type === 'S' && p === HP && !ball.hovered) { ball.hovered = true; snd(900, .07, 'square', .04); snd(700, .07, 'square', .04, .09); }
          if (!ball.judged && !g.result && ball.tau > ball.arr + win + LATE) strike(null);
          if (p > 1.5) { sfx.thud(); ball = null; }
        }
        if (g.result) return;
        if (ph === 'ready' || ph === 'after') { if ((pt -= dt) <= 0 && idx < PITCHES - 1) startWind(); }
        else if (ph === 'wind' && (pt -= dt) <= 0) release();
      },
      draw(t) {
        const X = ctx, won = g.result === 'win', lost = g.result === 'lose';
        X.drawImage(K.baked('bt', btBake), -OX, 0);                                            // sky, sun, stands, wall, grass, infield, plate: all baked
        X.fillStyle = 'rgba(255,225,140,.13)'; for (let i = 0; i < 12; i++) { const a = t * .08 + i * Math.PI / 6; X.beginPath(); X.moveTo(150, 150); X.arc(150, 150, 900, a, a + .14); X.fill(); }
        for (const [x, y, w] of [[-120, 70, .9], [300, 56, .7], [640, 84, 1], [1000, 64, .8]]) K.cloud((x + t * 8) % (VW + 300) - OX - 150, y, w);
        for (const c of crowd) {                                                              // the fans: inked heads, some in caps, arms up after a hit
          if (c.x < -OX - 10 || c.x > W + OX + 10) continue; const j = Math.abs(Math.sin(t * (6 + crowdJ * 8) + c.ph)) * (1.5 + crowdJ * 9), sk = ['#ffcba4', '#f0a37e', '#d98c66'][Math.abs(c.ph * 13 | 0) % 3];
          if (crowdJ > .15) { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(c.x + sx * 5, c.y - j + 2); X.lineTo(c.x + sx * 8, c.y - j - 8); X.stroke(); } X.strokeStyle = sk; X.lineWidth = 2.5; for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(c.x + sx * 5, c.y - j + 2); X.lineTo(c.x + sx * 8, c.y - j - 8); X.stroke(); } }
          X.fillStyle = c.c; X.fillRect(c.x - 6, c.y - j, 12, 9); X.lineWidth = 1.6; X.strokeStyle = INK; X.lineJoin = 'round'; X.strokeRect(c.x - 6, c.y - j, 12, 9);
          X.beginPath(); X.arc(c.x, c.y - j - 2, 6.2, 0, 7); X.fillStyle = sk; X.fill(); X.stroke();
          if ((Math.abs(c.ph * 7 | 0)) % 4 === 0) { X.beginPath(); X.arc(c.x, c.y - j - 3, 6.2, Math.PI, 0); X.closePath(); X.fillStyle = c.c; X.fill(); X.stroke(); }
          else { X.fillStyle = INK; X.fillRect(c.x - 3, c.y - j - 3, 1.8, 2.4); X.fillRect(c.x + 1.4, c.y - j - 3, 1.8, 2.4); } }
        for (const s of smoke) { X.fillStyle = `rgba(60,55,80,${Math.max(0, s.a)})`; X.beginPath(); X.arc(s.x, s.y, s.r, 0, 7); X.fill(); }
        const ty = idx >= 0 ? order[idx] : 'N', wu = ph === 'wind' && !g.result ? 1 - pt / (cur().wind / k) : -1;
        shadow(MX, MY + 2, 50, 9, .35);
        machine({ type: ty, wu, mood: mmood, clk, sq: msq, open: Math.max(mopen, wu > 0 ? wu * .6 : 0), ws, left: idx < 0 ? PITCHES : PITCHES - idx - 1 });
        if (ty === 'F' && wu >= 0) for (let i = 0; i < 3; i++) { const u = (clk * 2 + i / 3) % 1; X.fillStyle = `rgba(255,255,255,${.7 * (1 - u)})`; X.beginPath(); X.arc(MX - 30 + i * 30, MY - 130 - u * 50, 7 + u * 10, 0, 7); X.fill(); }
        const T = TYPES[ty]; if (T.label && ((ph === 'wind' && !g.result) || (ball && !ball.judged && ball.tau < .35)))
          txt(T.label, MX + 94, 238, 26 * (wu >= 0 ? .8 + .2 * ease(wu * 4) : 1), T.col, 'left');
        for (const o of outs) {                                                       // batted balls + sparkle trail
          o.trail.forEach(([x, y, r], i) => { const a = i / o.trail.length; X.globalAlpha = a * .8; star(x, y, r * 1.6 * a + 3, r * .6 * a + 1, 4, i, i % 2 ? '#FFE14D' : '#fff', 0); });
          X.globalAlpha = 1; if (o.t < o.d) baseball(o.x, o.y, o.r, o.t * 20); }
        // strike zone ring: glows in the hit window
        const live = ball && !ball.judged && !g.result, hot = live && Math.abs(ball.tau - ball.arr) <= win;
        if (hot) { X.fillStyle = 'rgba(92,255,122,.25)'; X.beginPath(); X.arc(ZX, ZY, 36, 0, 7); X.fill(); }
        X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.arc(ZX, ZY, 36, 0, 7); X.stroke();
        X.lineWidth = 5; X.strokeStyle = hot ? '#5CFF7A' : live ? '#fff' : 'rgba(255,255,255,.55)'; X.setLineDash(hot ? [] : [10, 8]); X.lineDashOffset = -clk * 20; X.stroke(); X.setLineDash([]);
        const rem = live ? ball.arr - ball.tau : -1;                               // approach ring closes onto the zone at arrival
        if (rem > 0 && rem < APR && (ball.type !== 'S' || ball.tau >= ball.a + ball.h)) { const u = rem / APR;
          X.globalAlpha = 1 - u * .6; X.lineWidth = 5; X.strokeStyle = '#FFE14D'; X.beginPath(); X.arc(ZX, ZY, 36 + u * 95, 0, 7); X.stroke(); X.globalAlpha = 1; }
        const fade = b => Math.min(1, Math.max(0, (545 - b.y) / 60));                 // missed balls fade before the fuse bar
        if (ball) { const b = bpos(ball); if (b.z > .6) shadow(b.x, Math.min(gy(Math.max(b.z, .6)), 540), b.r * .9, b.r * .25, .3 * fade(b)); }
        // Claude at bat: helmet, waggle, swing with a smear
        const lean = swingT >= 0 && swingT < .35 ? 8 : 0, bob = joy > 0 ? Math.abs(Math.sin(clk * 18)) * 10 : 0, cx = CX + lean;
        shadow(CX, CY + 2, 56, 10, .35);
        let a = A0 + Math.sin(clk * (ph === 'wind' ? 9 : 3)) * (ph === 'wind' ? .1 : .05);
        if (swingT >= 0) a = swingT < .35 ? A0 + (A1 - A0) * ease(swingT / .11) : A1 + (A0 - A1) * ease((swingT - .35) / .22);
        if (g.result === 'win') a = A0 - .3 + Math.sin(clk * 12) * .4;
        if (swingT >= 0 && swingT < .3) { X.globalAlpha = .55 * (1 - swingT / .3); X.strokeStyle = '#fff'; X.lineWidth = 34; X.beginPath(); X.arc(PX + lean, PY - bob, 96, A0, a); X.stroke(); X.globalAlpha = 1; }
        claude(cx, CY - bob, CU, { mood: g.result === 'lose' || cflash > 0 ? 'sad' : g.result === 'win' || joy > 0 ? 'happy' : null, col: cflash > 0 && (clk * 20 | 0) % 2 ? '#fff' : OR });
        const hy = CY - bob - 9 * CU, dome = (dx, dy) => { X.beginPath(); X.ellipse(cx + dx, hy + 2 + dy, 6.8 * CU, 4.6 * CU, 0, Math.PI, 0); X.closePath(); };
        dome(0, 0); X.lineJoin = 'round'; X.lineWidth = 10; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#1f3aa8'; X.fill();
        X.save(); dome(0, 0); X.clip(); dome(-5, -6); X.fillStyle = '#2f4fd6'; X.fill(); X.restore();
        K.rr(cx + 3 * CU, hy - 3, 5 * CU, 9, 4); K.ink('#2f4fd6', 3); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(cx + 3 * CU + 4, hy - 1, 5 * CU - 8, 2);
        X.fillStyle = 'rgba(255,255,255,.4)'; X.beginPath(); X.ellipse(cx - 2 * CU, hy - 2.4 * CU, 2 * CU, 1 * CU, -.3, 0, 7); X.fill();
        star(cx, hy - 1.8 * CU, 9, 4, 5, -Math.PI / 2, '#FFE14D', 2);
        X.save(); X.translate(PX + lean, PY - bob); X.rotate(a);
        if (!BATP) { BATP = new Path2D(); BATP.moveTo(-4, -4.5); BATP.lineTo(38, -5); BATP.quadraticCurveTo(72, -12, 116, -11); BATP.arc(116, 0, 11, -Math.PI / 2, Math.PI / 2); BATP.quadraticCurveTo(72, 12, 38, 5); BATP.lineTo(-4, 4.5); BATP.closePath(); }
        K.cel(BATP, '#eab76a', '#b97a42', 0, 5, 4); K.glint(BATP, 78, -5, 36, 2.6, .5, 0);
        X.fillStyle = '#2b2140'; K.rr(-4, -5, 28, 10, 4); X.fill(); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(2, -3.5, 18, 2); K.dot(-7, 0, 6.5, '#4a3a66', '#2b2140', 3); X.restore();
        K.rr(PX + lean - 8, PY - bob - 8, 16, 16, 4); K.ink(OR, 3);
        if (lost) for (let i = 0; i < 3; i++) star(cx - 24 + i * 24, hy - 34 + Math.sin(clk * 10 + i) * 5, 8, 3.5, 5, clk * 4 + i, '#FFE14D', 2);
        if (won) { K.heart(cx - 70, CY - 100 - bob - Math.abs(Math.sin(clk * 3)) * 14, 1.1); K.heart(cx + 60, CY - 120 - bob - Math.abs(Math.sin(clk * 3 + 1)) * 14, .9); }
        if (clk < 1.8 && !g.result) K.tag(CX, CY - 150, 'CLAUDE', '#ffe14d');
        if (ball) { const b = bpos(ball); if (fade(b) > 0) { X.globalAlpha = fade(b);
          if (ball.type === 'F') { X.strokeStyle = 'rgba(255,90,77,.7)'; X.lineCap = 'round'; X.lineWidth = b.r * 1.2; X.beginPath(); X.moveTo(b.x, b.y); X.lineTo(b.x - (b.x - OX0) * .25, b.y - (b.y - OY0) * .25); X.stroke(); X.lineCap = 'butt'; }
          baseball(b.x, b.y, b.r, ball.tau * (ball.type === 'C' ? 4 : 25));
          if (ball.type === 'S' && b.p === HP) txt('?!', b.x + 22, b.y - 26, 26, '#c78bff'); X.globalAlpha = 1; } }
        // HUD scoreboard: a wooden frame round a green board; hits (left) and strikes (right)
        X.fillStyle = 'rgba(20,16,28,.3)'; K.rr(208, 90, 384, 60, 18); X.fill();
        K.rr(204, 80, 384, 60, 18); K.cel(K.rrP(204, 80, 384, 60, 18), '#d9944f', '#a5622c', 4, 5, 4);
        K.rr(214, 88, 364, 44, 12); K.cel(K.rrP(214, 88, 364, 44, 12), '#1d4d3a', '#123626', 3, 4, 3);
        txt('HITS', 290, 98, 16, '#fff'); txt('STRIKES', 500, 98, 16, '#fff');
        for (let i = 0; i < NEED; i++) { if (i < hits) baseball(242 + i * 24, 119, 9, 0); else K.dot(242 + i * 24, 119, 8, '#1d4d3a', '#0f2e22', 3); }
        for (let i = 0; i < OUTS; i++) { const x = 470 + i * 30; K.dot(x, 119, 10, i < strikes ? '#ff4d4d' : '#1d4d3a', i < strikes ? '#b92a3a' : '#0f2e22', 3);
          if (i < strikes) { X.strokeStyle = '#fff'; X.lineWidth = 3; X.beginPath(); X.moveTo(x - 5, 114); X.lineTo(x + 5, 124); X.moveTo(x + 5, 114); X.lineTo(x - 5, 124); X.stroke(); } }
        X.fillStyle = '#FFE14D'; X.fillRect(397, 92, 5, 38);
        vignette(.3);
      },
      probe: () => ({ phase: ph, pitch: idx + 1, type: idx >= 0 ? order[idx] : null, order: order.join(''), hits, need: NEED, strikes, outs: OUTS, win: +win.toFixed(3), dur,
        toArrive: ball && !ball.judged ? +(ball.arr - ball.tau).toFixed(3) : null, live: !!(ball && !ball.judged), swung: !!(ball && ball.swung),
        press: ball && !ball.judged && Math.abs(ball.tau - ball.arr) <= win ? 'Space' : null, zone: [ZX, ZY], ball: ball ? (({ x, y, r, p }) => ({ x: +x.toFixed(1), y: +y.toFixed(1), r: +r.toFixed(1), p: +p.toFixed(3) }))(bpos(ball)) : null, result: g.result || null })
    };
    return g;
  };
})();
