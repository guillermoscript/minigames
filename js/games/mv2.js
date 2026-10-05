'use strict';
/* Move It! wave 2 - pose and rhythm microgames: PUNCH, WAVE, CLAP, STAND.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/move/up}; g.result = 'win'|'lose'
   Art follows docs/ART-STYLE.md (the DUO look). Art only: decor randomness comes from hr(), never from the game's Math.random. */
(function () {

const MAG = '#E0399B', PUR = '#7A3FD1', TEAL = '#2EC4B6', YEL = '#FFE14D', MINT = '#5CFF7A', RED = '#ff4d4d';
const mvMood = (g) => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const mvLose = () => { sfx.miss(); sfx.thud(); shake(8, .25); };
const mvWin = (x, y) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 36); ring(x, y, '#fff', 110); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ───────────── DUO-look kit for the cursed disco (local copy, draws on X; X = ctx while live, the offscreen ctx while baking) ───────────── */
const MV2A = (() => {
  const TAU = Math.PI * 2;
  let X = null;
  const hr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const cl = k => Math.max(0, Math.min(1, k));
  const ease = k => (k = cl(k), k * k * (3 - 2 * k));
  const outBack = k => { k = cl(k) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  const lerp = (a, b, k) => a + (b - a) * k;
  const use = () => { X = ctx; };
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  function inkP(p, fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
  function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
  function glint(p, x, y, rx, ry, col, rot = 0) { X.save(); X.clip(p); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
  function line(pts, w, col) {
    X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]));
    X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke();
  }
  function bake(fn) {
    const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0);
    try { fn(); } finally { X = old; } return c;
  }
  const layer = c => X.drawImage(c, -OX, 0);
  function heart(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  }
  function drop(x, y, s, a = 1) {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 1, 0, 6); X.quadraticCurveTo(-7, 1, 0, -9); X.closePath();
    ink('#9fe3ff', 2.5); X.fillStyle = '#fff'; el(-1.8, 0, 1.6, 2.4); X.fill(); X.restore();
  }
  /* blocky arms off claude()'s side stubs (origin = Claude's feet, draw BEFORE claude()). an: 0 = straight up, + = clockwise */
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
  function eye(x, y, r, look, mood, T, k) {
    if (mood === 'happy') { X.beginPath(); X.arc(x, y + r * .3, r * .7, Math.PI * 1.1, Math.PI * 1.9); X.lineWidth = r * .45; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); return; }
    if (mood === 'dead') { X.lineWidth = r * .42; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .6, y - r * .6); X.lineTo(x + r * .6, y + r * .6); X.moveTo(x + r * .6, y - r * .6); X.lineTo(x - r * .6, y + r * .6); X.stroke(); return; }
    const pan = mood === 'panic', R = pan ? r * 1.3 : r;
    if (!pan && Math.sin(T * 1.9 + k) > .985) { X.lineWidth = r * .4; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - R, y); X.lineTo(x + R, y); X.stroke(); return; }
    el(x, y, R, R * 1.08); ink('#fff', Math.max(1.5, r * .28));
    const pr = pan ? r * .32 : r * .52, px = x + look[0] * R * .38, py = y + look[1] * R * .38;
    X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fillStyle = INK; X.fill();
    X.beginPath(); X.arc(px - pr * .35, py - pr * .4, Math.max(1, pr * .38), 0, TAU); X.fillStyle = '#fff'; X.fill();
  }
  function mouth(x, y, w, mood, T) {
    X.lineCap = 'round'; X.lineJoin = 'round';
    if (mood === 'happy') { X.beginPath(); X.moveTo(x - w, y - 2); X.quadraticCurveTo(x, y + w * 1.5, x + w, y - 2); X.closePath(); ink('#7a1530', 2.5); X.fillStyle = '#ff7a95'; el(x, y + w * .55, w * .45, w * .25); X.fill(); }
    else if (mood === 'angry') { X.beginPath(); X.moveTo(x - w, y + 3); X.quadraticCurveTo(x, y - w * .9, x + w, y + 3); X.quadraticCurveTo(x, y + 1, x - w, y + 3); X.closePath(); ink('#fff', 2.5); X.lineWidth = 2; X.strokeStyle = INK; X.beginPath(); for (let i = -1; i <= 1; i++) { X.moveTo(x + i * w * .45, y - w * .35 + Math.abs(i) * 2); X.lineTo(x + i * w * .45, y + 2); } X.stroke(); }
    else if (mood === 'scared') { el(x, y, w * .45, w * .6); ink('#7a1530', 2.5); }
    else if (mood === 'dead') { X.beginPath(); X.moveTo(x - w, y); X.quadraticCurveTo(x - w * .5, y - 4, x, y); X.quadraticCurveTo(x + w * .5, y + 4, x + w, y); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); el(x + w * .4, y + 6, 4, 6); ink('#ff7a95', 2); }
    else if (mood === 'bored') { X.beginPath(); X.moveTo(x - w * .7, y); X.lineTo(x + w * .7, y); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); }
    else { X.beginPath(); X.moveTo(x - w * .6, y); X.quadraticCurveTo(x, y + w * .5, x + w * .6, y); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); }
  }
  function pill(x, y, label, col, up) {
    X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
    const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
    rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
    txt(label, x, y + 1, 17, INK, 'center', w - 14);
  }
  /* white cartoon glove (palm + thumb + 3 stripes); a = rotation */
  function mitt(x, y, r, a) {
    X.save(); X.translate(x, y); X.rotate(a || 0);
    X.beginPath(); X.ellipse(-r * .85, r * .15, r * .38, r * .28, -.5, 0, TAU); ink('#fff', 3.5);
    X.beginPath(); X.arc(0, 0, r, 0, TAU); ink('#fff', 4.5);
    X.fillStyle = '#d9d4ec'; X.beginPath(); X.arc(0, 0, r, .25, 1.9); X.arc(0, 0, r * .72, 1.9, .25, true); X.closePath(); X.fill();
    X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (let i = -1; i <= 1; i++) { X.moveTo(i * r * .36, -r * .86); X.lineTo(i * r * .3, -r * .35); } X.stroke();
    X.fillStyle = 'rgba(255,255,255,.9)'; el(-r * .3, r * .3, r * .22, r * .12, -.5); X.fill();
    X.restore();
  }
  /* red boxing glove pointing along angle a (0 = right) */
  function glove(x, y, r, a) {
    X.save(); X.translate(x, y); X.rotate(a);
    X.beginPath(); X.ellipse(-r * .1, r * .7, r * .5, r * .4, .4, 0, TAU); ink('#e8434f', 3.5);
    const p = new Path2D(); p.ellipse(0, 0, r * 1.05, r * .92, 0, 0, TAU); cel(p, '#ff4d5e', '#b8283a', -3, -4, 4.5);
    X.fillStyle = 'rgba(255,255,255,.55)'; el(r * .25, -r * .4, r * .4, r * .17, -.2); X.fill();
    X.beginPath(); X.rect(-r * 1.25, -r * .55, r * .38, r * 1.1); ink('#fff', 3);
    X.restore();
  }
  /* a tiny sparkle that works while baking (core star() draws on ctx) */
  function spark(x, y, r, col) { X.beginPath(); for (let i = 0; i < 8; i++) { const rad = i & 1 ? r * .3 : r, a = i * Math.PI / 4; X.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } X.closePath(); X.fillStyle = col; X.fill(); }

  /* sentient snacks: 0 hot dog, 1 eyeball donut, 2 banana, 3 sock, 4 toaster, 5 cheese. x,y = feet.
     o: mood idle|angry|happy|scared|ko|bored, w wobble 0..2.6, look [lx,ly], armsUp */
  const PCACHE = {};
  const P = (k, d) => PCACHE[k] || (PCACHE[k] = new Path2D(d));
  const FACE = [
    { e: [[-6, -60], [6, -60]], r: 5.5, m: [0, -45] }, { e: [[0, -36]], r: 13, m: [0, -12] }, { e: [[-4, -53], [8, -57]], r: 6, m: [2, -40] },
    { e: [[-3, -62], [6, -62]], r: 5, m: [2, -48] }, { e: [[-12, -28], [12, -28]], r: 7.5, m: [0, -12] }, { e: [[-6, -34], [7, -34]], r: 5.5, m: [0, -19] }];
  function snack(x, y, s, kind, T, o) {
    o = o || {}; const mood = o.mood || 'idle', w = o.w == null ? 1 : o.w, look = o.look || [0, 0], ph = x * .013 + kind;
    const hop = mood === 'ko' ? 0 : Math.abs(Math.sin(T * 6 + ph)) * 14 * s * w, sway = mood === 'ko' ? 0 : Math.sin(T * 6 + ph) * .22 * w;
    shadow(x, y + 2, 26 * s, 6 * s, .25);
    X.save(); X.translate(x, y - hop); X.rotate(sway); X.scale(s, s * (1 + Math.sin(T * 12 + ph) * .05 * w));
    const up = o.armsUp ? 1 : 0;
    const arm = (ax, ay, dir) => {
      const sw = Math.sin(T * 9 + ph + dir) * w, lift = up * 14;
      X.save(); line([[ax, ay], [ax + dir * 16, ay - 12 + sw * 14 - lift * .6], [ax + dir * 26, ay - 26 + sw * 22 - lift]], 5, '#ffd6b0'); X.restore();
      X.beginPath(); X.arc(ax + dir * 26, ay - 26 + sw * 22 - lift, 5, 0, TAU); ink('#fff', 2.5);
    };
    const legs = lw => { for (const d of [-1, 1]) { const fx = d * lw + Math.sin(T * 12 + ph + d) * 6 * w; line([[d * lw, -6], [fx, 5]], 5, '#ffd6b0'); el(fx + d * 2, 7, 8, 4); ink(d < 0 ? '#ff4d5e' : '#4fd06a', 2.5); } };
    const f = FACE[kind];
    if (kind === 0) {
      arm(-22, -40, -1); arm(22, -40, 1); legs(8);
      cel(P('bun', 'M-24 -52 Q-24 -76 0 -76 Q24 -76 24 -52 L24 -24 Q24 0 0 0 Q-24 0 -24 -24Z'), '#F0B35A', '#c98a35', 5, 4, 4);
      cel(P('sau', 'M-13 -60 Q-13 -82 0 -82 Q13 -82 13 -60 L13 -22 Q13 2 0 2 Q-13 2 -13 -22Z'), '#E0402F', '#a82418', 4, 3, 4);
      X.strokeStyle = YEL; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(-8, -18); X.bezierCurveTo(-2, -26, 2, -10, 8, -20); X.stroke();
      X.fillStyle = 'rgba(255,255,255,.4)'; el(-6, -66, 2.5, 7, 0); X.fill();
    } else if (kind === 1) {
      arm(-30, -26, -1); arm(30, -26, 1); legs(10);
      const p = P('don', 'M-34 -34 A34 34 0 1 0 34 -34 A34 34 0 1 0 -34 -34Z');
      cel(p, '#FF8FD0', '#d6579f', 5, 5, 4); glint(p, -14, -56, 9, 4, 'rgba(255,255,255,.55)', -.5);
      X.fillStyle = '#fff'; for (const a of [.4, 1.5, 2.7, 3.9, 5.2]) { X.save(); X.translate(Math.cos(a) * 25, -34 + Math.sin(a) * 25); X.rotate(a * 2); X.fillRect(-4, -1.5, 8, 3); X.restore(); }
    } else if (kind === 2) {
      arm(-14, -46, -1); arm(14, -46, 1); legs(6);
      const p = P('ban', 'M-8 4 C-44 -30 -22 -86 18 -84 C2 -62 6 -22 14 4Z');
      cel(p, '#FFE14D', '#e0b21c', 5, 3, 4.5); glint(p, -16, -60, 3, 12, 'rgba(255,255,255,.55)', .2);
      X.fillStyle = '#7a5a20'; X.fillRect(12, -88, 8, 6);
    } else if (kind === 3) {
      arm(-18, -34, -1); arm(18, -40, 1);
      const p = P('sock', 'M-18 -86 L14 -86 L14 -36 Q40 -10 22 4 L-24 4 Q-26 -20 -18 -40Z');
      cel(p, '#fff', '#c9c4e6', 5, 3, 4); X.save(); X.clip(p); X.fillStyle = '#FF3EA5'; X.fillRect(-20, -84, 36, 11); X.fillRect(-26, -52, 40, 7); X.restore();
    } else if (kind === 4) {
      arm(-34, -26, -1); arm(34, -26, 1); legs(14);
      const tp = Math.max(0, Math.sin(T * 6 + ph)) * 18;
      rr(-9, -76 - tp, 18, 32, 4); ink('#F2C77A', 3); rr(-9, -76 - tp, 18, 8, 3); X.fillStyle = '#b97a2a'; X.fill();
      rr(-30, -52, 60, 52, 10); const p = new Path2D(); p.roundRect(-30, -52, 60, 52, 10); cel(p, '#C9D2E0', '#8f9cb3', 5, 4, 4); glint(p, -16, -44, 12, 3, 'rgba(255,255,255,.65)', 0);
      X.fillStyle = INK; X.fillRect(-12, -52, 24, 5);
    } else {
      arm(-24, -24, -1); arm(24, -24, 1); legs(10);
      const p = P('chz', 'M-36 2 L0 -66 L36 2Z');
      cel(p, '#FFC93C', '#e09a10', 5, 3, 4); X.save(); X.clip(p); X.fillStyle = '#E09A10'; for (const h of [[-14, -12, 5], [10, -28, 4], [14, -9, 6]]) { X.beginPath(); X.arc(h[0], h[1], h[2], 0, TAU); X.fill(); } X.restore();
      glint(p, -9, -36, 3, 15, 'rgba(255,255,255,.5)', .4);
    }
    // face
    const em = mood === 'angry' ? 'idle' : mood === 'scared' ? 'panic' : mood === 'ko' ? 'dead' : mood === 'happy' ? 'happy' : 'idle';
    f.e.forEach((p, i) => { eye(p[0], p[1], f.r, look, em, T, i + kind); });
    if (mood === 'angry') { f.e.forEach((p, i) => { const d = f.e.length === 1 ? 0 : (i ? 1 : -1); X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); if (!d) { X.moveTo(p[0] - f.r, p[1] - f.r * 1.8); X.lineTo(p[0] + f.r, p[1] - f.r * 1.3); } else { X.moveTo(p[0] + d * f.r * 1.2, p[1] - f.r * 1.9); X.lineTo(p[0] - d * f.r * 1.2, p[1] - f.r * 1.2); } X.stroke(); }); }
    mouth(f.m[0], f.m[1], kind === 4 ? 8 : 6, mood === 'ko' ? 'dead' : mood, T);
    if (mood === 'happy' || mood === 'angry') { X.fillStyle = 'rgba(255,110,165,.5)'; for (const p of f.e) { el(p[0] + (f.e.length === 1 ? 20 : (p[0] < 0 ? -f.r * .8 : f.r * .8)), p[1] + f.r * 1.6, 4, 2.4); X.fill(); } }
    X.restore();
  }
  /* the judgmental disco ball: mood judge|happy|cringe|sleep */
  function disco(x, y, r, T, mood) {
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(x, -10); X.lineTo(x, y - r); X.stroke();
    rr(x - 8, y - r - 8, 16, 12, 3); ink('#c9ced6', 3);
    const p = new Path2D(); p.arc(x, y, r, 0, TAU); cel(p, '#dfe6f7', '#8f9cb3', r * .1, r * .1, 4.5);
    X.save(); X.clip(p); const rot = T * 1.4;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const u = (i + (rot % 1)) * r / 3.1, v = j * r / 3.1; if (u * u + v * v > r * r) continue; X.fillStyle = ((i + j + (rot | 0)) & 1) ? 'rgba(255,255,255,.75)' : 'rgba(120,140,200,.35)'; X.fillRect(x + u - r / 8, y + v - r / 8, r / 4.2, r / 4.2); }
    X.restore(); glint(p, x - r * .4, y - r * .45, r * .3, r * .15, 'rgba(255,255,255,.8)', -.6);
    const ey = y + r * .08, ex = r * .3, er = r * .21;
    if (mood === 'sleep') { for (const d of [-1, 1]) { X.beginPath(); X.arc(x + d * ex, ey, er * .8, .2, Math.PI - .2); X.lineWidth = 3.5; X.strokeStyle = INK; X.stroke(); } }
    else if (mood === 'happy') { for (const d of [-1, 1]) eye(x + d * ex, ey, er, [0, 0], 'happy', T, d); mouth(x, y + r * .42, r * .2, 'happy', T); }
    else if (mood === 'cringe') { for (const d of [-1, 1]) eye(x + d * ex, ey, er, [0, 0], 'dead', T, d); mouth(x, y + r * .5, r * .22, 'dead', T); drop(x + r * .75, y - r * .3 + (T * 40 % 16), .9, .9); }
    else {
      for (const d of [-1, 1]) { eye(x + d * ex, ey, er, [0, .9], 'idle', T, d); X.save(); el(x + d * ex, ey, er + 3, er * 1.1 + 3); X.clip(); X.fillStyle = '#b9c4e0'; X.fillRect(x + d * ex - er - 4, ey - er * 1.3, er * 2 + 8, er * 1.25); X.restore(); X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(x + d * ex - er - 2, ey - er * .15); X.lineTo(x + d * ex + er + 2, ey - er * .15); X.stroke(); X.beginPath(); X.moveTo(x + d * (ex + er * 1.2), ey - er * 1.4 - 2); X.lineTo(x + d * (ex - er * .8), ey - er * 1.1); X.stroke(); }
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(x - r * .2, y + r * .5); X.lineTo(x + r * .2, y + r * .5); X.stroke();
    }
    X.save(); X.globalAlpha = .1; X.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) { const a = T * 1.1 + i * 1.256; X.beginPath(); X.moveTo(x, y); X.lineTo(x + Math.cos(a) * 900 - 40, y + Math.abs(Math.sin(a)) * 900); X.lineTo(x + Math.cos(a) * 900 + 40, y + Math.abs(Math.sin(a)) * 900); X.fill(); }
    X.restore();
  }
  /* a back row of snacks across the whole screen */
  function crowd(y, T, w, s, off, ko, mood, look, up) {
    const step = 96, m = Math.ceil(OX / step);
    for (let i = -m; i < 9 + m; i++) { const k = ((i + ko) % 6 + 12) % 6; snack(30 + i * step + off + (i & 1) * 14, y + ((i & 1) ? 10 : 0), s, k, T, { mood, w, look, armsUp: up }); }
  }
  /* velvet curtain panel with cel-shaded folds, x0..x1 from y0 to y1 */
  function curtain(x0, x1, y0, y1, base, shade, lite) {
    const n = Math.max(3, Math.round((x1 - x0) / 34)), fw = (x1 - x0) / n;
    X.fillStyle = INK; X.fillRect(x0 - 3, y0, x1 - x0 + 6, y1 - y0 + 3);
    for (let i = 0; i < n; i++) {
      const fx = x0 + i * fw; X.fillStyle = (i & 1) ? shade : base; X.fillRect(fx, y0, fw, y1 - y0);
      X.fillStyle = lite; X.fillRect(fx + fw * .15, y0, fw * .14, y1 - y0);
      X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(fx + fw * .72, y0, fw * .28, y1 - y0);
    }
  }
  function bulb(x, y, r, col) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(col, 2.5); X.fillStyle = 'rgba(255,255,255,.7)'; el(x - r * .3, y - r * .3, r * .32, r * .2, -.6); X.fill(); }
  function sweatMarks(x, y, T) { drop(x, y + (T * 50 % 14), .9, .9); }
  return { TAU, hr, cl, ease, outBack, lerp, use, rr, el, ink, inkP, cel, glint, line, bake, layer, heart, drop, arms, eye, mouth, pill, mitt, glove, spark, snack, disco, crowd, curtain, bulb, sweatMarks, set x(v) { X = v; }, get x() { return X; } };
})();
const { hr, cl, ease, outBack, lerp, rr: mrr, el: mel, ink: mink, cel: mcel, glint: mglint, line: mline, bake: mbake, layer: mlayer, heart: mheart, arms: marms, eye: meye, mouth: mmouth, pill: mpill, mitt: mmitt, glove: mglove, snack: msnack, disco: mdisco, crowd: mcrowd, curtain: mcurtain, bulb: mbulb, TAU } = MV2A;
const MX = () => MV2A.x;   // the current drawing context of the kit

/* tiny bake helpers: layer cached per VW so wide screens re-bake once */
const BG = {};
function bgCache(key, fn) { const c = BG[key]; if (c && c.w === VW) return c.c; const cv = MV2A.bake(fn); BG[key] = { c: cv, w: VW }; return cv; }
/* kit gradient helper */
function vg(y0, y1, stops) { const X = MX(), g = X.createLinearGradient(0, y0, 0, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }
/* neon-lit wall with mirror-diamond lattice */
function wall(X, L, R, y0, y1, a, b, lat) {
  X.fillStyle = vg(y0, y1, [[0, a], [1, b]]); X.fillRect(L, y0, R - L, y1 - y0);
  X.strokeStyle = lat; X.lineWidth = 2; X.beginPath();
  for (let x = L - 80; x < R + 80; x += 60) { X.moveTo(x, y0); X.lineTo(x + 60, y1); X.moveTo(x + 60, y0); X.lineTo(x, y1); }
  X.stroke();
}
/* spotlight cone (live) */
function cone(x0, y0, x1, y1, hw, col, a) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 - 6, y0); ctx.lineTo(x0 + 6, y0); ctx.lineTo(x1 + hw, y1); ctx.lineTo(x1 - hw, y1); ctx.closePath(); ctx.fill(); ctx.restore(); }

/* 1 PUNCH: enemies pop from left / right / up; punch the matching direction */
const PBG_Y = 330;
function punchBg() {
  return bgCache('punch', () => {
    const X = MX(), L = -OX - 2, R = W + OX + 2;
    wall(X, L, R, 0, PBG_Y, '#2a0f5a', '#6a2fae', 'rgba(255,255,255,.07)');
    // red velvet drapes with gold ties at both edges
    const dw = Math.max(70, OX + 70);
    mcurtain(L, L + dw, -6, PBG_Y, '#c4274f', '#8f1838', 'rgba(255,255,255,.18)'); mcurtain(R - dw, R, -6, PBG_Y, '#c4274f', '#8f1838', 'rgba(255,255,255,.18)');
    for (const cx of [L + dw, R - dw]) { X.beginPath(); X.ellipse(cx, 188, 12, 18, 0, 0, TAU); mink('#ffd23f', 3); X.strokeStyle = '#c99512'; X.lineWidth = 3; X.beginPath(); X.moveTo(cx - 8, 196); X.lineTo(cx - 14, 228); X.moveTo(cx + 8, 196); X.lineTo(cx + 14, 228); X.stroke(); }
    // neon "star" bolts in the lattice
    for (const [nx, ny, nc] of [[250, 120, '#ff5cb8'], [560, 245, '#5cf0ff']]) { X.save(); X.translate(nx, ny); X.rotate(.2); X.beginPath(); for (let i = 0; i < 10; i++) { const rad = i & 1 ? 12 : 30, a = i * Math.PI / 5 - 1.57; X.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } X.closePath(); X.strokeStyle = nc; X.lineWidth = 5; X.globalAlpha = .55; X.stroke(); X.restore(); }
    // the ring: canvas mat, hard ink horizon, ropes on posts
    X.fillStyle = vg(PBG_Y, H, [[0, '#4f7bd9'], [1, '#2f4fb0']]); X.fillRect(L, PBG_Y, R - L, H - PBG_Y);
    X.fillStyle = 'rgba(255,255,255,.1)'; for (let x = L - 40; x < R + 40; x += 90) { X.beginPath(); X.moveTo(x, PBG_Y); X.lineTo(x + 50, PBG_Y); X.lineTo(x + 50 - (400 - x) * .25, H); X.lineTo(x - (400 - x) * .25, H); X.closePath(); X.fill(); }
    X.fillStyle = INK; X.fillRect(L, PBG_Y - 2, R - L, 5);
    X.beginPath(); X.ellipse(400, 470, 250, 52, 0, 0, TAU); X.strokeStyle = 'rgba(255,225,77,.55)'; X.lineWidth = 6; X.stroke();
    X.beginPath(); X.ellipse(400, 470, 232, 44, 0, 0, TAU); X.strokeStyle = 'rgba(255,255,255,.2)'; X.lineWidth = 3; X.stroke();
    // floor hatches the left and right snacks pop out of
    for (const hx of [130, 670]) { X.beginPath(); X.ellipse(hx, 492, 62, 16, 0, 0, TAU); mink('#c9ced6', 4); X.beginPath(); X.ellipse(hx, 492, 48, 11, 0, 0, TAU); X.fillStyle = '#1a1330'; X.fill(); X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 2; X.beginPath(); X.ellipse(hx, 489, 40, 7, 0, Math.PI * 1.1, Math.PI * 1.7); X.stroke(); }
    // ropes: back row on posts, then the side ropes running forward
    const ropes = ['#ff4d5e', '#fff', '#4d8dff'];
    for (const [px, side] of [[24, -1], [776, 1]]) {
      for (let i = 0; i < 3; i++) { const ry = 262 + i * 26; mline([[px, ry], [px + side * 70, ry + 205]], 7, ropes[i]); }
    }
    for (let i = 0; i < 3; i++) mline([[24, 262 + i * 26], [776, 262 + i * 26]], 7, ropes[i]);
    for (const px of [24, 776]) { rr0(X, px - 13, 232, 26, 118, 8); mink('#c9ced6', 4); rr0(X, px - 13, 232, 26, 38, 8); X.fillStyle = '#e8434f'; X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.stroke(); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(px - 8, 238, 5, 22); }
    // far-side shadow under the mat horizon
    X.fillStyle = 'rgba(20,16,28,.25)'; X.fillRect(L, PBG_Y + 3, R - L, 8);
  });
}
function rr0(X, x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }

function mvPunch(sp) {
  const rs = Math.sqrt(sp), N = 4, WIN = 1.0 / rs, GAP = .22 / rs;
  const L = 0, R = 1, U = 2;
  const POS = [[130, 430], [670, 430], [400, 160]], ARR = [3, 1, 0];
  const CX = 400, CY = 485;
  const dirs = []; let lastD = -1;
  for (let i = 0; i < N; i++) { let d; do { d = Math.floor(Math.random() * 3); } while (d === lastD); dirs.push(d); lastD = d; }
  const KINDS = []; for (let i = 0; i < N; i++) KINDS.push([4, 0, 5, 1][(Math.floor(Math.random() * 4) + i) % 4]);
  const ELX = [], ELY = []; for (let d = 0; d < 3; d++) { const dx = 400 - POS[d][0], dy = 485 - POS[d][1], l = Math.hypot(dx, dy); ELX.push(dx / l); ELY.push(dy / l); }
  const SX = [95, -95, 135], SY = [-70, -70, -10], SHR = ['AAAH!', 'EEEK!', 'NOOO!'];
  let c = 0, gapT = .45 / rs, idx = 0, cnt = 0, cur = null, fist = null, hurt = 0, slamT = 0, sorry = 0; const dead = [];
  const lose = (msg) => {
    if (g.result) return; g.result = 'lose'; mvLose(); hurt = .5;
    floatText(msg, 400, 300, RED, 46); burst(CX, CY - 20, RED, 14); sorry = 1; snd(500, .5, 'sawtooth', .06, 0, 90); floatText('HA HA!', POS[cur ? cur.d : 2][0], POS[cur ? cur.d : 2][1] - 100, YEL, 34);
  };
  const punch = (d) => {
    if (g.result) return;
    fist = { d, t: 0 };
    if (!cur) { sfx.whoosh(); return; }
    if (d === cur.d) {
      const p = POS[d]; dead.push({ d, t: 0, k: KINDS[idx] }); cnt++; idx++; snd(800, .35, 'sawtooth', .07, 0, 140); sfx.boing();
      sfx.hit(); sfx.thud(); shake(6, .18); burst(p[0], p[1], YEL, 16); ring(p[0], p[1], '#fff', 90);
      floatText(['POW!', 'BAM!', 'WHAM!', 'KO!'][Math.min(3, cnt - 1)], p[0], p[1] - 70, YEL, 40);
      cur = null; gapT = GAP;
      if (cnt >= N) { g.result = 'win'; mvWin(400, 300); slamT = .9; }
    } else lose('WRONG WAY!');
  };
  const KM = { ArrowLeft: L, KeyA: L, ArrowRight: R, KeyD: R, ArrowUp: U, KeyW: U };
  let outT0 = -1;
  const g = {
    wide: true, cmd: 'PUNCH THE SNACK!', hint: 'ARROWS: PUNCH THE ANGRY SNACK\'S SIDE', thint: 'TAP THE SIDE WHERE THEY POP UP', dur: 5.6,
    key(e) { if (!e.repeat && KM[e.code] != null) punch(KM[e.code]); },
    down(p) { const dx = p.x - 400; punch(Math.abs(dx) > 170 ? (dx < 0 ? L : R) : U); },
    update(dt) {
      c += dt; hurt = Math.max(0, hurt - dt); slamT = Math.max(0, slamT - dt);
      if (g.result && outT0 < 0) outT0 = c;
      if (fist) { fist.t += dt; if (fist.t > .25) fist = null; }
      for (let i = dead.length - 1; i >= 0; i--) { dead[i].t += dt; if (dead[i].t > .5) dead.splice(i, 1); }
      if (g.result) return;
      if (!cur) {
        gapT -= dt;
        if (gapT <= 0 && idx < N) { cur = { d: dirs[idx], t: 0 }; sfx.pop(); ring(POS[cur.d][0], POS[cur.d][1], '#fff', 70, .3); }
      } else {
        cur.t += dt;
        if (cur.t > WIN) lose('TOO SLOW!');
      }
    },
    draw(t) {
      MV2A.use(); const X = ctx;
      const oT = outT0 >= 0 ? c - outT0 : 0;
      mlayer(punchBg());
      // ringside crowd behind the ropes + the judging ball
      mcrowd(318, t, g.result === 'win' ? 2 : .6, .5, 0, 0, g.result === 'win' ? 'happy' : g.result === 'lose' ? 'happy' : 'idle', [0, .6], g.result === 'win');
      mdisco(250, 195, 34, t, g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sleep' : 'judge');
      // smoke-cloud platform for the snack that pops from above
      if (cur && cur.d === U || dead.some(d => d.d === U)) { for (const [a, b, r] of [[-44, 0, 22], [-14, -8, 28], [20, -6, 26], [48, 2, 20], [0, 8, 24]]) { X.beginPath(); X.arc(400 + a, 222 + b, r, 0, TAU); mink(null, 3, '#7b80c6'); } for (const [a, b, r] of [[-44, 0, 22], [-14, -8, 28], [20, -6, 26], [48, 2, 20], [0, 8, 24]]) { X.beginPath(); X.arc(400 + a, 222 + b, r, 0, TAU); X.fillStyle = '#e8e2ff'; X.fill(); } X.fillStyle = '#fff'; mel(386, 210, 18, 8, -.3); X.fill(); }
      const drawEnemy = (d, k, a, ko, kind, mood) => {
        const p = POS[d];
        ctx.save(); ctx.globalAlpha = a; ctx.translate(p[0], p[1]); ctx.scale(k, k);
        if (ko) ctx.rotate(ko * (d === L ? -1 : 1));
        msnack(0, 56, 1.75, kind, now, { mood, w: ko ? .3 : 2.6, look: [ELX[d], ELY[d]] });
        if (ko) for (let i = 0; i < 3; i++) { const aa = now * 9 + i * 2.1; star(Math.cos(aa) * 40, -86 + Math.sin(aa) * 10, 11, 5, 5, aa, YEL, 3); }
        ctx.restore();
      };
      for (const dd of dead) {
        const u = dd.t / .5;
        ctx.save(); ctx.translate((dd.d === L ? -1 : dd.d === R ? 1 : 0) * u * 260, (dd.d === U ? -1 : 0) * u * 180 - 60 * Math.sin(u * 3));
        drawEnemy(dd.d, 1, 1 - u, u * 8, dd.k, 'ko'); ctx.restore();
      }
      if (cur) {
        const k = clamp(cur.t / .12, 0, 1), sc = k < 1 ? 1.25 * k : 1 + Math.max(0, .25 * (1 - (cur.t - .12) / .1));
        const p = POS[cur.d], left = 1 - cur.t / WIN;
        drawEnemy(cur.d, sc, 1, 0, KINDS[idx], g.result === 'lose' ? 'happy' : 'angry');
        if (!g.result) { txt(SHR[idx % 3], p[0] + SX[cur.d] + Math.sin(now * 55) * 3, p[1] + SY[cur.d], 30, '#fff'); }
        const blink = left < .35 && Math.sin(now * 40) > 0;
        const ax = CX + (p[0] - CX) * .55, ay = CY - 20 + (p[1] - (CY - 20)) * .55 - (cur.d === U ? 0 : 20);
        if (!blink) drawArrow(ax, ay, ARR[cur.d], 30, YEL);
        // the snack's patience: a round-ended bar
        mrr(p[0] - 50, p[1] + 78, 100, 16, 8); mink('#fff', 3); X.save(); X.clip(); X.fillStyle = left < .35 ? RED : MINT; X.fillRect(p[0] - 50, p[1] + 78, 100 * Math.max(0, left), 16); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(p[0] - 50, p[1] + 80, 100, 4); X.restore();
      }
      if (g.result === 'win') {   // a tiny sock surrenders with a white flag
        const sx = CX + 140, sw = Math.sin(now * 10) * 8, u = outBack(oT / .35);
        ctx.save(); ctx.translate(0, (1 - u) * 80); ctx.globalAlpha = cl(oT / .15);
        mline([[sx + 18, 470], [sx + 18, 410]], 4, '#e3a868'); X.beginPath(); X.moveTo(sx + 18, 410); X.quadraticCurveTo(sx + 36, 404 + sw * .3, sx + 56 + sw, 412); X.lineTo(sx + 56 + sw, 430); X.quadraticCurveTo(sx + 36, 424, sx + 18, 430); X.closePath(); mink('#fff', 3);
        msnack(sx, 528, .6, 3, now, { mood: 'scared', w: 1.6, look: [-1, 0], armsUp: true });
        ctx.restore();
      }
      // Claude + glove
      const f = fist ? Math.sin(clamp(fist.t / .25, 0, 1) * Math.PI) : 0;
      shadow(CX, 528, 70, 14, .3);
      ctx.save(); ctx.translate(CX, 524); if (hurt > 0) ctx.translate(Math.sin(now * 80) * 6, 0);
      const win = g.result === 'win', lost = g.result === 'lose';
      const gl = win ? Math.sin(now * 9) * .12 : 0;
      marms(8, win ? -.5 + gl : -.45, win ? .5 - gl : .45, win ? 1.1 : .65, OR);
      ctx.translate(-CX, -524);
      claude(CX, 524, 8, { mood: mvMood(g) });
      // headband + goggles-free bruise
      X.fillStyle = '#e8434f'; X.fillRect(CX - 49, 524 - 62, 98, 10); X.fillStyle = INK; X.fillRect(CX - 52, 524 - 62, 3, 10); X.fillRect(CX + 49, 524 - 62, 3, 10);
      X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(CX - 44, 524 - 61, 36, 3);
      if (lost) for (let i = 0; i < 3; i++) { const aa = now * 7 + i * 2.1; star(CX + Math.cos(aa) * 46, 524 - 86 + Math.sin(aa) * 9, 10, 4.5, 5, aa, YEL, 3); }
      ctx.restore();
      if (!g.result) { ctx.save(); mpill(CX, 524 - 100 + Math.sin(now * 3) * 2, 'YOU', YEL, false); ctx.restore(); }
      if (fist) {
        const p = POS[fist.d], tx = CX + (p[0] - CX) * .72 * f, ty = CY - 5 + (p[1] - (CY - 5)) * .72 * f;
        mline([[CX, CY - 5], [tx, ty]], 18, OR);
        MV2A.glove(tx, ty, 26, Math.atan2(ty - (CY - 5), tx - CX));
        if (f > .8) { star(tx, ty, 50, 24, 8, now * 4, YEL, 4); }
      }
      // KO scoreboard: a bulb marquee hung beside the top pop-up
      { const sx = 484, sy = 62; X.fillStyle = 'rgba(20,16,28,.3)'; mrr(sx + 4, sy + 7, 168, 38, 12); X.fill(); mrr(sx, sy, 168, 38, 12); mink('#2b1a55', 4);
        for (let i = 0; i < N; i++) { const bx = sx + 24 + i * 40, on = i < cnt, pop = on ? outBack((c - 0) * 0 + 1) : 0; X.beginPath(); X.arc(bx, sy + 19, 14, 0, TAU); mink(on ? '#ffd23f' : '#4a3a7a', 3); if (on) { X.fillStyle = 'rgba(255,255,255,.7)'; mel(bx - 4, sy + 14, 4, 2.4, -.6); X.fill(); star(bx, sy + 20, 8, 3.5, 5, 0, '#fff', 0); } else { X.fillStyle = 'rgba(255,255,255,.18)'; mel(bx - 4, sy + 14, 4, 2.4, -.6); X.fill(); } } }
      mvSlam('WHAT?!', slamT / .9);
      vignette(.25);
    }
  };
  return g;
}
reg('mv_punch', mvPunch, 'Punch!');

/* 2 WAVE: wave the mouse (or alternate left/right) until the crowd cheers */
const WSTAGE = 340;
function waveBg() {
  return bgCache('wave', () => {
    const X = MX(), L = -OX - 2, R = W + OX + 2;
    X.fillStyle = vg(0, WSTAGE, [[0, '#0f8f8a'], [1, '#2EC4B6']]); X.fillRect(L, 0, R - L, WSTAGE + 4);
    // glitter backdrop: scalloped silver-teal drops
    for (let x = L - 30; x < R + 30; x += 56) { X.beginPath(); X.arc(x, 150 + ((x / 56 | 0) & 1) * 14, 34, 0, Math.PI); X.lineTo(x - 34, 0); X.lineTo(x + 34, 0); X.closePath(); X.fillStyle = (x / 56 | 0) & 1 ? '#27b0a3' : '#38d6c6'; X.fill(); X.strokeStyle = '#0f6f6a'; X.lineWidth = 3; X.stroke(); }
    for (let i = 0; i < 40; i++) MV2A.spark(L + hr(i) * (R - L), 20 + hr(i + 50) * 250, 3 + hr(i + 9) * 4, 'rgba(255,255,255,.5)');
    // velvet side curtains tied back
    const dw = Math.max(110, OX + 110);
    mcurtain(L, L + dw, -6, WSTAGE, '#c4274f', '#8f1838', 'rgba(255,255,255,.2)'); mcurtain(R - dw, R, -6, WSTAGE, '#c4274f', '#8f1838', 'rgba(255,255,255,.2)');
    for (const cx of [L + dw, R - dw]) { X.beginPath(); X.ellipse(cx, 230, 12, 20, 0, 0, TAU); mink('#ffd23f', 3); X.strokeStyle = '#c99512'; X.lineWidth = 3; X.beginPath(); X.moveTo(cx - 7, 240); X.lineTo(cx - 12, 276); X.moveTo(cx + 7, 240); X.lineTo(cx + 12, 276); X.stroke(); }
    // stage deck: planks, ink edge, footlights
    X.fillStyle = vg(WSTAGE, 372, [[0, '#d9944f'], [1, '#b97a46']]); X.fillRect(L, WSTAGE + 4, R - L, 30);
    X.fillStyle = INK; X.fillRect(L, WSTAGE, R - L, 5);
    X.strokeStyle = 'rgba(120,70,30,.5)'; X.lineWidth = 2; X.beginPath(); for (let x = L - 40; x < R + 40; x += 70) { X.moveTo(x, WSTAGE + 5); X.lineTo(x - 18, WSTAGE + 34); } X.stroke();
    mrr(L - 8, WSTAGE + 34, R - L + 16, 24, 8); mink('#a5622c', 4);
    for (let x = L + 14; x < R; x += 44) MV2A.bulb(x, WSTAGE + 46, 7, '#ffe98a');
    // audience pit
    X.fillStyle = vg(WSTAGE + 60, H, [[0, '#2a1050'], [1, '#150a30']]); X.fillRect(L, WSTAGE + 60, R - L, H - WSTAGE - 60);
    X.fillStyle = INK; X.fillRect(L, WSTAGE + 58, R - L, 4);
  });
}
function mvWave(sp) {
  const rs = Math.sqrt(sp), need = 8 + Math.round(sp - 1);
  let meter = 0, c = 0, s = 1, ha = 0, lx = null, dir = 0, ext = 0, lastKey = '', hearts = [], flash = 0, winT = -1, loseT = -1;
  const wave = () => {
    if (g.result) return;
    meter = Math.min(1, meter + 1 / need); s = -s; flash = .12;
    sfx.blip(Math.round(meter * 14)); sfx.whoosh(s > 0); snd(260 + meter * 500, .09, 'square', .04, 0, 160 + meter * 700);
    const hx = 400 + 110 * Math.sin(s * .7) + 50, hy = 260 - 110 * Math.cos(s * .7);
    burst(hx, hy, '#fff', 4, 160);
    if (meter > .25 && Math.random() < .6) hearts.push({ x: 140 - OX + Math.random() * (520 + 2 * OX), y: 470, t: 0 });
    if (meter >= 1) { g.result = 'win'; mvWin(400, 300); floatText('CHEERS!', 400, 170, YEL, 50); sfx.boing(); winT = 0; }
  };
  const g = {
    wide: true, cmd: 'GREET THE SNACKS!', hint: 'WAVE THE MOUSE (OR ALTERNATE LEFT / RIGHT)', thint: 'SWIPE LEFT AND RIGHT FAST', dur: 5,
    key(e) {
      if (e.repeat) return;
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (k && k !== lastKey) { lastKey = k; wave(); }
    },
    move(p) {
      if (lx === null) { lx = p.x; return; }
      const dx = p.x - lx; if (Math.abs(dx) < 3) return; lx = p.x;
      const nd = dx > 0 ? 1 : -1;
      if (dir === 0) { dir = nd; ext = Math.abs(dx); return; }
      if (nd === dir) ext += Math.abs(dx);
      else { if (ext >= 35) wave(); dir = nd; ext = Math.abs(dx); }
    },
    update(dt) {
      c += dt; flash = Math.max(0, flash - dt); if (winT >= 0) winT += dt;
      ha += (s * .7 - ha) * Math.min(1, dt * 18);
      if (!g.result) meter = Math.max(0, meter - .06 * dt * sp);
      if (g.result === 'lose') loseT = loseT < 0 ? 0 : loseT + dt;
      for (let i = hearts.length - 1; i >= 0; i--) { hearts[i].t += dt; if (hearts[i].t > 1) hearts.splice(i, 1); }
    },
    draw(t) {
      MV2A.use(); const X = ctx;
      mlayer(waveBg());
      const win = g.result === 'win', lost = g.result === 'lose', hi = meter > .5 || win;
      mdisco(140, 100, 38, t, win ? 'happy' : lost ? 'sleep' : hi ? 'happy' : 'judge');
      cone(400, 0, 400, 340, 120, '#fff6b0', .1 + .08 * Math.sin(t * 3) + (hi ? .06 : 0));
      // a sock stagehand holds the cue card, eyes on the waving hand
      const lk = Math.sin(ha);
      msnack(640, 336, 1, 3, t, { mood: win ? 'happy' : lost ? 'bored' : 'idle', w: .3 + meter * 1.5, look: [lk, -.6], armsUp: win });
      // crowd of sentient snacks, going nuts as the cheer meter fills; they stare at the waving hand
      const cm = win ? 'happy' : lost ? 'bored' : meter > .4 ? 'happy' : 'idle', cw = lost ? .12 : win ? 1.1 : .3 + meter * 2.2;
      mcrowd(468, t, cw, 1.1, 0, 0, cm, [lk, -.6], meter > .6 || win);
      mcrowd(540, t, cw, 1.15, 48, 3, cm, [lk, -.6], meter > .6 || win);
      if (win) {   // roses rain onto the stage
        for (let i = 0; i < 12; i++) { const u = clamp((winT - i * .07) / 1.1, 0, 1); if (u <= 0 || u >= 1) continue; const sx = 120 - OX + hr(i + 3) * (560 + 2 * OX), ex = 260 + hr(i + 7) * 280, x = lerp(sx, ex, u), y = lerp(480, 330, u) - Math.sin(u * Math.PI) * 170;
          ctx.save(); ctx.translate(x, y); ctx.rotate(u * 5 + i); ctx.scale(1.7, 1.7); mline([[0, 0], [0, 16]], 2.5, '#2f9a55'); X.beginPath(); X.arc(0, -2, 8, 0, TAU); mink('#ff3b57', 2.5); X.strokeStyle = '#8f1838'; X.lineWidth = 2; X.beginPath(); X.arc(0, -2, 4, 0, 4.5); X.stroke(); ctx.restore(); }
      }
      if (winT >= 0) {   // one snack faints from pure joy
        const u = Math.min(1, winT / .5), fx = 600, fy = 470 + u * 6;
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(u * 1.5); msnack(0, 0, 1, 2, t, { mood: 'ko', w: .2 }); ctx.restore();
      }
      if (lost && loseT >= 0) {   // a tumbleweed of tangled streamers rolls across the silent stage
        const tx = -OX - 40 + (loseT / .9) * (VW + 80), ty = 296; ctx.save(); ctx.translate(tx, ty); ctx.rotate(loseT * 9);
        X.beginPath(); X.arc(0, 0, 22, 0, TAU); mink('#d9944f', 3); X.strokeStyle = INK; X.lineWidth = 3; for (let i = 0; i < 4; i++) { X.beginPath(); X.arc(0, 0, 9 + i * 4, i, i + 3.5); X.stroke(); } ctx.restore();
      }
      // Claude on stage
      shadow(400, 316, 80, 14, .3);
      const sx = 448, sy = 262, Ln = 120, hx = sx + Math.sin(ha) * Ln, hy = sy - Math.cos(ha) * Ln;
      ctx.save(); ctx.translate(400, 312); const bounce = win ? -Math.abs(Math.sin(t * 9)) * 18 : 0; ctx.translate(0, bounce);
      marms(9, win ? -.5 : lost ? 2.4 : -.5, win ? .5 : lost ? -2.4 : 0, win ? 1.1 : .5, OR); ctx.translate(-400, -312);
      claude(400, 312, 9, { mood: mvMood(g) || (meter > .5 ? 'happy' : null) });
      ctx.restore();
      const by = bounce;
      mline([[sx, sy + by], [hx, hy + by]], 18, OR);
      MV2A.mitt(hx, hy + by, 30, Math.atan2(hy - sy, hx - sx) + Math.PI / 2);
      if (flash > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(sx, sy - 10, 150, -Math.PI * .5 - s * 1.2, -Math.PI * .5 - s * .5, s > 0); ctx.stroke(); }
      mpill(400, 108 + by * 0, 'YOU', YEL, false);
      if (lost) { ctx.save(); MV2A.drop(470, 232 + (t * 40 % 14), 1.2, .9); ctx.restore(); }
      for (const h of hearts) { const u = h.t; ctx.globalAlpha = 1 - u; mheart(h.x + Math.sin(u * 8) * 10, h.y - u * 120, 1.6); ctx.globalAlpha = 1; }
      // applause-o-meter: a lit sign hung below the hint
      { const mx = 250, my = 62, mw = 300; X.fillStyle = 'rgba(20,16,28,.3)'; mrr(mx - 14 + 4, my - 4 + 7, mw + 28, 36, 14); X.fill();
        mrr(mx - 14, my - 4, mw + 28, 36, 14); mink('#2b1a55', 4); mrr(mx, my + 2, mw, 24, 12); mink('#fff', 3); X.save(); X.clip(); X.fillStyle = meter > .7 ? MINT : YEL; X.fillRect(mx, my + 2, mw * clamp(meter, 0, 1), 24); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(mx, my + 5, mw, 5); X.restore();
        for (let i = 1; i < 6; i++) { X.fillStyle = 'rgba(20,16,28,.25)'; X.fillRect(mx + mw * i / 6 - 1, my + 6, 2, 16); }
        mheart(mx - 4, my + 14, .7 + .12 * Math.sin(t * 8) * meter); }
      vignette(.2);
    }
  };
  return g;
}
reg('mv_wave', mvWave, 'Wave!');

/* 3 CLAP: watch the crowd clap 3 beats, then echo the rhythm */
const CFLOOR = 372;
function clapBg() {
  return bgCache('clap', () => {
    const X = MX(), L = -OX - 2, R = W + OX + 2;
    wall(X, L, R, 0, CFLOOR, '#2a0f5a', '#5a2a9a', 'rgba(255,255,255,.06)');
    // dance floor in perspective
    X.fillStyle = '#2b0f5e'; X.fillRect(L, CFLOOR, R - L, H - CFLOOR);
    for (let r = 0; CFLOOR + r * 26 < H; r++) { const y = CFLOOR + r * 26, k = (y - CFLOOR) / (H - CFLOOR); for (let x = L - 100; x < R + 100; x += 64) { const sc = 1 + k * .5, xx = 400 + (x - 400) * sc; X.fillStyle = ((x / 64 | 0) + r) & 1 ? '#3b1d6e' : '#2b0f5e'; X.fillRect(xx + 2, y + 2, 64 * sc - 4, 22); } }
    X.fillStyle = INK; X.fillRect(L, CFLOOR - 3, R - L, 6);
    // DJ booth (back left): turntables on a speaker stack
    rr0(X, 60, 250, 200, 80, 10); mink('#3b3550', 4); X.fillStyle = '#5a5274'; X.fillRect(66, 258, 188, 8);
    X.beginPath(); X.arc(112, 292, 26, 0, TAU); mink('#1a1330', 3); X.beginPath(); X.arc(208, 292, 26, 0, TAU); mink('#1a1330', 3);
    for (const hx of [24, 296]) { rr0(X, hx - 28, 232, 56, 98, 8); mink('#3b3550', 4); for (const cy of [258, 300]) { X.beginPath(); X.arc(hx, cy, cy === 258 ? 10 : 18, 0, TAU); mink('#14101c', 2.5); X.strokeStyle = '#5a5274'; X.lineWidth = 2; X.beginPath(); X.arc(hx, cy, cy === 258 ? 5 : 10, 0, TAU); X.stroke(); } }
    // light-bulb marquee frame behind the three beat lamps
    rr0(X, 252, 108, 296, 84, 20); mink('#2b1a55', 4);
    for (let i = 0; i < 14; i++) { const bx = 262 + i * 21.5; MV2A.bulb(bx, 114, 3.8, '#ffd23f'); MV2A.bulb(bx, 186, 3.8, '#ffd23f'); }
    // sign board for WATCH / NOW!
    rr0(X, 332, 58, 136, 40, 12); mink('#2b1a55', 4);
  });
}
function mvClap(sp) {
  const rs = Math.sqrt(sp), b = .5 / rs, tol = .17 / Math.pow(sp, .35);
  const pats = [[0, 1, 2], [0, .5, 1.5], [0, 1, 1.5], [0, .5, 1]];
  const pat = pats[Math.floor(Math.random() * pats.length)];
  const D0 = .45, E0 = D0 + (pat[2] + 1.6) * b;
  const dem = pat.map(o => D0 + o * b), ech = pat.map(o => E0 + o * b);
  const BX = [300, 400, 500], hit = [false, false, false], demoDone = [false, false, false], lit = [false, false, false];
  let c = 0, pulse = 0, mine = 0, slamT = 0, outT0 = -1;
  const clapFx = (me) => { pulse = .16; if (me) mine = .16; snd(me ? 520 : 330, .07, 'square', .06, 0, me ? 260 : 180); noise(.05, .06, 2500, 5000, 'highpass'); };
  const press = () => {
    if (g.result) return;
    clapFx(true);
    if (c < E0 - tol) { sfx.tick(); return; }
    let bj = -1, bd = 9;
    for (let j = 0; j < 3; j++) if (!hit[j] && Math.abs(c - ech[j]) < bd) { bd = Math.abs(c - ech[j]); bj = j; }
    if (bj >= 0 && bd <= tol) {
      hit[bj] = true; lit[bj] = true; sfx.hit(); sfx.blip(bj * 3);
      const perf = bd < tol * .5; burst(BX[bj], 150, perf ? YEL : MINT, 10); ring(BX[bj], 150, '#fff', 60, .3);
      floatText(perf ? 'PERFECT' : 'GOOD', BX[bj], 215, perf ? YEL : MINT, 26);
      if (hit.every(Boolean)) { g.result = 'win'; mvWin(400, 300); sfx.boing(); }
    } else { g.result = 'lose'; mvLose(); floatText('OFF BEAT!', 400, 300, RED, 46); slamT = .9; snd(600, .4, 'sawtooth', .06, 0, 100); }
  };
  const g = {
    wide: true, cmd: 'CLAP FOR SNACKS!', hint: 'WATCH THE RHYTHM, THEN ECHO IT: SPACE / CLICK', thint: 'WATCH, THEN TAP THE BEATS', dur: 4.6,
    key(e) { if (!e.repeat && e.code === 'Space') press(); },
    down() { press(); },
    update(dt) {
      c += dt; pulse = Math.max(0, pulse - dt); mine = Math.max(0, mine - dt); slamT = Math.max(0, slamT - dt);
      if (!g.result) {
        for (let j = 0; j < 3; j++) if (!demoDone[j] && c >= dem[j]) { demoDone[j] = true; clapFx(false); }
        for (let j = 0; j < 3; j++) if (!hit[j] && c > ech[j] + tol) { g.result = 'lose'; mvLose(); floatText('MISSED!', 400, 300, RED, 46); slamT = .9; snd(600, .4, 'sawtooth', .06, 0, 100); break; }
      }
      if (g.result && outT0 < 0) outT0 = c;
    },
    draw(t) {
      MV2A.use(); const X = ctx;
      const oT = outT0 >= 0 ? c - outT0 : 0, win = g.result === 'win', lost = g.result === 'lose';
      mlayer(clapBg());
      // live dance-floor flashes
      { const beat = (t * 2) | 0; for (let r = 0; r < 8; r++) for (let x = -Math.ceil(OX / 64) * 64; x < W + OX; x += 64) { if (((x / 64 | 0) + r * 3 + beat) % 7 !== 0) continue; const y = CFLOOR + r * 26, k = (y - CFLOOR) / (H - CFLOOR), sc = 1 + k * .5, xx = 400 + (x - 400) * sc; X.globalAlpha = .55; X.fillStyle = MV2A.hr(x + r) > .5 ? '#ff5cb8' : '#5cf0ff'; X.fillRect(xx + 2, y + 2, 64 * sc - 4, 22); X.globalAlpha = 1; } }
      mdisco(650, 90, 36, t, win ? 'happy' : lost ? 'cringe' : 'judge');
      // the hot-dog DJ nods to the beat behind the decks
      msnack(160, 272, 1.1, 0, t, { mood: lost ? 'scared' : win ? 'happy' : 'idle', w: pulse > 0 ? 1.4 : .5, look: [0, 1] });
      X.beginPath(); X.arc(112, 292, 26, 0, TAU); mink('#1a1330', 3); X.strokeStyle = 'rgba(255,255,255,.35)'; X.lineWidth = 2; X.beginPath(); X.arc(112, 292, 18, t * 6, t * 6 + 2); X.stroke(); X.beginPath(); X.arc(208, 292, 26, 0, TAU); mink('#1a1330', 3); X.beginPath(); X.arc(208, 292, 18, -t * 6, -t * 6 + 2); X.stroke();
      // snacks clap along (arms flail on each clap)
      const cw = pulse > 0 ? 2.6 : win ? 2.2 : lost ? .1 : .5, cm = win ? 'happy' : lost ? 'scared' : 'idle';
      mcrowd(412, t, cw, .95, 0, 0, cm, [0, 1], pulse > 0 || win);
      mcrowd(470, t, cw, 1, 48, 2, cm, [0, 1], pulse > 0 || win);
      if (win) { for (let i = 0; i < 6; i++) { const u = (t * .9 + i * .17) % 1; ctx.save(); MV2A.heart(100 - OX + hr(i + 2) * (600 + 2 * OX), 400 - u * 90, 1.2 + hr(i) * .5); ctx.restore(); } }
      // beat lamps
      const echoing = c >= E0 - b * 1.2;
      for (let j = 0; j < 3; j++) {
        const ls = lit[j] || demoDone[j] && !echoing, col = hit[j] ? MINT : ls ? YEL : '#e7e2f5';
        if (ls || hit[j]) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35; circ(BX[j], 150, 34, col, 0); ctx.restore(); }
        X.beginPath(); X.arc(BX[j], 150, 31, 0, TAU); mink('#c9ced6', 4); X.beginPath(); X.arc(BX[j], 150, 24, 0, TAU); mink(col, 3);
        X.fillStyle = 'rgba(255,255,255,.75)'; mel(BX[j] - 8, 141, 7, 4, -.6); X.fill();
        if (echoing && !hit[j]) {
          const k = clamp((ech[j] - c) / (b * 1.1), -.2, 1), r = 28 + k * 70;
          X.beginPath(); X.arc(BX[j], 150, r, 0, 7); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = k < .15 ? YEL : '#fff'; X.stroke();
        }
      }
      // Claude clapping, on the dance floor
      const cy = 536, hy = cy - 46;
      shadow(400, cy + 3, 80, 14, .3);
      claude(400, cy, 9, { mood: mvMood(g) });
      const sp2 = mine > 0 ? 0 : 20, hxs = 12 + sp2 + 4;
      for (const d of [-1, 1]) { mline([[400 + d * 54, hy], [400 + d * hxs, hy]], 14, OR); MV2A.mitt(400 + d * hxs, hy, 15, d * 1.57 - 1.57); }
      if (mine > 0) star(400, hy, 36, 16, 8, now * 5, YEL, 3);
      if (win) for (let i = 0; i < 3; i++) { const aa = now * 5 + i * 2.1; star(400 + Math.cos(aa) * 60, cy - 100 + Math.sin(aa) * 8, 9, 4, 5, aa, YEL, 3); }
      ctx.save(); mpill(400, cy - 96, 'YOU', YEL, false); ctx.restore();
      if (lost) {   // the record scratches and snaps in two
        const u = clamp(oT / .8, 0, 1);
        for (const d of [-1, 1]) { ctx.save(); ctx.translate(400 + d * (40 + u * 190), 300 + u * 40 - Math.sin(u * 3.1) * 30); ctx.rotate(d * (.3 + u * 2));
          X.beginPath(); X.arc(0, 0, 44, d > 0 ? -Math.PI / 2 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI * 1.5); X.closePath(); mink('#1a1330', 3.5);
          X.strokeStyle = 'rgba(255,255,255,.25)'; X.lineWidth = 2; for (const rr1 of [30, 38]) { X.beginPath(); X.arc(0, 0, rr1, d > 0 ? -Math.PI / 2 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI * 1.5); X.stroke(); }
          X.beginPath(); X.arc(0, 0, 16, d > 0 ? -Math.PI / 2 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI * 1.5); X.closePath(); mink('#e0399b', 2.5); ctx.restore(); }
      }
      // sign: WATCH / NOW!
      txt(echoing ? 'NOW!' : 'WATCH', 400, 79, 30, echoing ? YEL : '#fff', 'center', 120);
      mvSlam('WHAT?!', slamT / .9);
      vignette(.25);
    }
  };
  return g;
}
reg('mv_clap', mvClap, 'Clap!');

/* 4 STAND: keep your balance on one leg; tap against the lean */
const BFLOOR = 424;
function balBg() {
  return bgCache('bal', () => {
    const X = MX(), L = -OX - 2, R = W + OX + 2;
    X.fillStyle = '#d6309a'; X.fillRect(L, 0, R - L, BFLOOR + 4);
    // sunburst wall
    const cx = 400, cy = 250; X.fillStyle = '#f046a8';
    for (let i = 0; i < 20; i++) { const a0 = i * TAU / 20, a1 = a0 + TAU / 40; X.beginPath(); X.moveTo(cx, cy); X.lineTo(cx + Math.cos(a0) * 1500, cy + Math.sin(a0) * 1500); X.lineTo(cx + Math.cos(a1) * 1500, cy + Math.sin(a1) * 1500); X.closePath(); X.fill(); }
    X.beginPath(); X.arc(cx, cy, 120, 0, TAU); X.fillStyle = 'rgba(255,225,77,.35)'; X.fill();
    // wooden stage floor
    X.fillStyle = vg(BFLOOR, H, [[0, '#d9944f'], [1, '#8a5530']]); X.fillRect(L, BFLOOR, R - L, H - BFLOOR);
    X.strokeStyle = 'rgba(70,35,15,.45)'; X.lineWidth = 2; X.beginPath(); for (let x = L - 100; x < R + 100; x += 80) { X.moveTo(x, BFLOOR); X.lineTo(400 + (x - 400) * 1.7, H); } X.stroke();
    X.fillStyle = INK; X.fillRect(L, BFLOOR - 3, R - L, 6);
    X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(L, BFLOOR + 3, R - L, 5);
    // wind-machine housings at both edges
    for (const [fx, d] of [[34, 1], [766, -1]]) { rr0(X, fx - 30, 330, 60, 96, 10); mink('#3b3550', 4); X.fillStyle = '#5a5274'; X.fillRect(fx - 26, 424, 52, 6); rr0(X, fx - 6, 424, 12, 30, 3); mink('#5a5274', 3); }
  });
}
function mvBalance(sp) {
  const rs = Math.sqrt(sp), K = 2.4, DAMP = .9, ZONE = .4;
  const p1 = Math.random() * 6, p2 = Math.random() * 6, A = .75 * rs;
  let a = (Math.random() < .5 ? -1 : 1) * .28, w = 0, c = 0, md = 0, fall = 0, warn = 0, lastDir = 0, wd = 0, winT = 0;
  const push = (d) => { if (g.result) return; w += d * 1.4; sfx.click(); burst(400 - d * -20, 470, '#fff', 3, 120); lastDir = d; };
  const g = {
    get lean() { return a; }, wide: true, cmd: 'STAND ON DONUT!', hint: 'LEFT / RIGHT AGAINST THE LEAN', thint: 'TAP THE SIDE OPPOSITE THE LEAN', dur: 5, timeWin: true,
    key(e) {
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') push(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') push(1);
    },
    down(p) { md = p.x < 400 ? -1 : 1; push(md); },
    up() { md = 0; },
    update(dt) {
      c += dt; warn = Math.max(0, warn - dt);
      if (g.result === 'lose') { fall += dt; a += Math.sign(a || 1) * dt * 3; return; }
      if (g.result) { winT += dt; return; }
      let u = 0;
      if (keys.ArrowLeft || keys.KeyA) u -= 4; if (keys.ArrowRight || keys.KeyD) u += 4; u += md * 4;
      const wind = A * (Math.sin(c * 2.1 + p1) + .7 * Math.sin(c * 3.7 + p2)) * Math.min(1, c / .5);
      wd = wind;
      const acc = K * a + wind - DAMP * w + u;
      w += acc * dt; a += w * dt;
      if (Math.abs(a) > .75 && warn <= 0) { warn = .3; sfx.tick(); }
      if (Math.abs(a) >= 1) {
        g.result = 'lose'; a = Math.sign(a) * 1; mvLose(); sfx.splat(); sfx.boing(); burst(400 + a * 120, 460, RED, 16); floatText('TIMBER!', 400, 250, RED, 50);
      }
    },
    draw(t) {
      MV2A.use(); const X = ctx;
      mlayer(balBg());
      mdisco(700, 170, 36, t, g.result === 'lose' ? 'cringe' : Math.abs(a) > .6 ? 'cringe' : g.result === 'win' ? 'happy' : 'judge');
      const lost = g.result === 'lose', win = g.result === 'win';
      // the fans blow the way the wind pushes: left fan for +, right fan for -
      for (const [fx, d] of [[34, 1], [766, -1]]) {
        const on = lost ? 0 : clamp(wd * d * 1.2, 0, 1.2) + .12, spin = t * (8 + on * 34) * d;
        X.save(); X.translate(fx, 360); X.beginPath(); X.arc(0, 0, 34, 0, TAU); mink('#c9ced6', 4);
        X.rotate(spin); for (let i = 0; i < 4; i++) { X.rotate(TAU / 4); X.beginPath(); X.ellipse(16, 0, 16, 7, 0, 0, TAU); mink(i & 1 ? '#ff5c8a' : '#ffd23f', 2.5); }
        X.beginPath(); X.arc(0, 0, 7, 0, TAU); mink('#5a5274', 2.5); X.restore();
      }
      // crowd, then the floor
      mcrowd(470, t, win ? 2 : .8, .75, 0, 1, lost ? 'scared' : win ? 'happy' : Math.abs(a) > .6 ? 'scared' : 'idle', [a, -.6], win);
      // giant rolling eyeball donut (Claude's unicycle)
      const OY = -44, dx = lost ? fall * 380 * Math.sign(a || 1) : 0, rr = a * 3 + c * .6 + dx * .02;
      shadow(400 + dx, 556 + OY, 110, 14, .3);
      ctx.save(); ctx.translate(400 + dx, 560 + OY); ctx.rotate(rr);
      { const p = new Path2D(); p.arc(0, 0, 100, 0, TAU); mcel(p, '#FF8FD0', '#d6579f', 9, 9, 6); mglint(p, -42, -52, 22, 8, 'rgba(255,255,255,.55)', -.6);
        X.save(); X.clip(p); const sc = ['#fff', '#ffe14d', '#5cf0ff', '#5cff7a']; for (let i = 0; i < 12; i++) { const aa = i * .55; X.save(); X.translate(Math.cos(aa) * 70, Math.sin(aa) * 70); X.rotate(aa * 3); X.fillStyle = sc[i & 3]; X.fillRect(-7, -2.5, 14, 5); X.restore(); } X.restore();
        X.beginPath(); X.arc(0, 0, 40, 0, TAU); mink('#2b0f5e', 4); }
      ctx.restore();
      { const ex = 400 + dx, ey = 560 + OY; meye(ex, ey, 30, [lost ? 0 : -a * 2, lost ? 1 : .6], lost ? 'dead' : win ? 'happy' : Math.abs(a) > .6 ? 'panic' : 'idle', t, 3);
        X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 22, ey - 40 - (lost ? 0 : Math.abs(a) * 8)); X.lineTo(ex + 22, ey - 36 + (lost ? 0 : Math.abs(a) * 8) * 0); X.stroke(); }
      // a lonely sock tumbles through the wind
      { const sw = VW + 200, sxx = ((c * 140 + 100) % sw) - OX - 100; ctx.save(); ctx.translate(sxx, 230 + Math.sin(c * 3) * 30); ctx.rotate(c * 4); msnack(0, 30, .55, 3, t, { mood: 'scared', w: .2 }); ctx.restore(); }
      ctx.save();
      ctx.translate(400 + (lost ? fall * 380 * Math.sign(a || 1) : 0), 462 + OY + (lost ? fall * fall * 700 : 0)); ctx.rotate(a * .55 + (lost ? fall * 4 * Math.sign(a) : 0));
      const fl = Math.sin(now * 12) * .3 * Math.min(1, Math.abs(a) * 2);
      marms(8, lost ? 2.6 : win ? -.5 + Math.sin(now * 9) * .1 : -1.9 - fl * 2.6, lost ? -2.6 : win ? .5 - Math.sin(now * 9) * .1 : 1.9 + fl * 2.6, .75, OR);
      ctx.translate(-400 * 0, 0);
      claude(0, 0, 8, { mood: mvMood(g) });
      // sneakers: one raised foot gag
      for (const [fx, fy] of [[46, -26 + fl * 20], [-74, -26 - fl * 20]]) { const p = new Path2D(); p.roundRect(fx, fy, 28, 14, 6); mcel(p, '#ff4d5e', '#b8283a', 3, 3, 3); X.fillStyle = '#fff'; X.fillRect(fx + 4, fy + 11, 20, 3); }
      if (lost) for (let i = 0; i < 3; i++) { const aa = now * 7 + i * 2.1; star(Math.cos(aa) * 46, -86 + Math.sin(aa) * 9, 10, 4.5, 5, aa, YEL, 3); }
      ctx.restore();
      if (!lost && Math.abs(a) > .6) { MV2A.drop(400 + a * 100, 340 + (now * 70 % 20), 1.2, 1); }
      if (win) { for (let i = 0; i < 4; i++) { const u = (winT * 1.2 + i * .25) % 1; ctx.save(); mheart(300 + i * 70, 380 - u * 80, 1.3); ctx.restore(); } }
      // wind streaks
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 4 + Math.floor(OX / 150); i++) { const sw = VW + 100, x = ((now * 200 * (i % 2 ? 1 : -1) + i * 230) % sw + sw) % sw - OX - 50, y = 200 + (i % 4) * 55; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 46, y); ctx.stroke(); }
      ctx.lineCap = 'butt';
      if (!lost && !win) { ctx.save(); mpill(400, 462 + OY - 100, 'YOU', YEL, false); ctx.restore(); }
      // sway meter: a lit panel under the hint, red edges / green middle
      const mx = 168, mw = 464, my = 70;
      X.fillStyle = 'rgba(20,16,28,.3)'; mrr(120 + 4, my - 8 + 7, 520, 52, 16); X.fill();
      mrr(120, my - 8, 520, 52, 16); mink('#2b1a55', 4);
      mrr(mx, my, mw, 28, 12); mink('#fff', 3); X.save(); X.clip();
      X.fillStyle = '#ff4d5e'; X.fillRect(mx, my, mw, 28); X.fillStyle = MINT; X.fillRect(mx + mw * (.5 - ZONE / 2), my, mw * ZONE, 28);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(mx, my + 3, mw, 5); X.fillStyle = INK; X.fillRect(mx + mw / 2 - 2, my, 4, 28); X.restore();
      const px = mx + mw / 2 + clamp(a, -1, 1) * mw / 2;
      X.beginPath(); X.moveTo(px, my + 32); X.lineTo(px - 11, my + 52); X.lineTo(px + 11, my + 52); X.closePath(); mink(YEL, 3.5);
      for (const d of [-1, 1]) { X.beginPath(); X.moveTo(400 + d * 262, my + 14); X.lineTo(400 + d * 242, my + 4); X.lineTo(400 + d * 242, my + 24); X.closePath(); mink(YEL, 2.5); }
      vignette(.22);
    }
  };
  return g;
}
reg('mv_balance', mvBalance, 'Stand!');

})();
