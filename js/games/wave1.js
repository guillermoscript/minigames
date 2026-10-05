'use strict';
/* Wave 1: the originals — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* ───────────── DUO-look art kit for the stage-1 restyle of SWAT and SPOT (docs/ART-STYLE.md) ─────────────
   Art only: nothing in here touches Math.random, game state or hitboxes. Cosmetic variety comes from hr(). */
const W1A = (() => {
  const TAU = Math.PI * 2;
  let X = null;                 // set to ctx on each draw (the file is also loaded headless by scripts/party-catalog.js)
  const hr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const cl = k => Math.max(0, Math.min(1, k));
  const ease = k => (k = cl(k), k * k * (3 - 2 * k));
  const outBack = k => { k = cl(k) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = cl;
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  function line(pts, w, col) {   // INK tube under a colour stroke
    X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]));
    X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke();
  }
  function bake(fn) {            // paint once into a VW×600 layer (logical x from -OX), blit with layer(c)
    const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0);
    try { fn(); } finally { X = old; } return c;
  }
  const layer = c => X.drawImage(c, -OX, 0);
  function cloud(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); }
    X.restore();
  }
  function sun(x, y, r, T) {
    X.save(); X.translate(x, y); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.5)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-7, r + 8); X.lineTo(7, r + 8); X.lineTo(0, r + 32); X.fill(); }
    X.restore(); X.beginPath(); X.arc(x, y, r, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(x - r * .3, y - r * .3, r * .38, r * .25, -.6); X.fill();
  }
  function tuft(x, y) { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9, y - 10); X.moveTo(x, y); X.lineTo(x, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 10); X.stroke(); }
  function heart(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  }
  function drop(x, y, s, a = 1) {  // a sweat / tear drop
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 1, 0, 6); X.quadraticCurveTo(-7, 1, 0, -9); X.closePath();
    ink('#9fe3ff', 2.5); X.fillStyle = '#fff'; el(-1.8, 0, 1.6, 2.4); X.fill(); X.restore();
  }
  /* blocky arms from claude()'s side stubs (drawn before claude(), origin = Claude's feet). la/ra: 0 = straight up */
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
  function eye(x, y, r, look, mood, T, k) {   // crane-style eye: sclera, pupil toward look [-1..1], white dot, blink
    if (mood === 'happy') { X.beginPath(); X.arc(x, y + r * .3, r * .7, Math.PI * 1.1, Math.PI * 1.9); X.lineWidth = r * .45; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); return; }
    if (mood === 'dead') { X.lineWidth = r * .42; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .6, y - r * .6); X.lineTo(x + r * .6, y + r * .6); X.moveTo(x + r * .6, y - r * .6); X.lineTo(x - r * .6, y + r * .6); X.stroke(); return; }
    const pan = mood === 'panic', R = pan ? r * 1.3 : r;
    if (!pan && Math.sin(T * 1.9 + k) > .985) { X.lineWidth = r * .4; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - R, y); X.lineTo(x + R, y); X.stroke(); return; }
    el(x, y, R, R * 1.08); ink('#fff', Math.max(1.5, r * .28));
    const pr = pan ? r * .32 : r * .52, px = x + look[0] * R * .38, py = y + look[1] * R * .38;
    X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fillStyle = INK; X.fill();
    X.beginPath(); X.arc(px - pr * .35, py - pr * .4, Math.max(1, pr * .38), 0, TAU); X.fillStyle = '#fff'; X.fill();
  }
  function stars(x, y, rad, T) { for (let i = 0; i < 3; i++) { const a = T * 6 + i * TAU / 3; X.save(); star(x + Math.cos(a) * rad, y + Math.sin(a) * rad * .4, 8, 3.5, 5, a, '#FFE14D', 2.5); X.restore(); } }

  /* ═════════════ SWAT: the picnic ═════════════ */
  const BL = { top: 92, bot: 640, tl: 110, tr: 690, bl: -90, br: 890 };   // the blanket trapezoid
  const blk = (u, v) => { const vv = Math.pow(v, 1.25); return [lerp(lerp(BL.tl, BL.tr, u), lerp(BL.bl, BL.br, u), vv), lerp(BL.top, BL.bot, vv)]; };
  let SWBG = null, SWW = -1;
  const SWHZ = 62;                 // horizon: bugs live at y >= 100, so their whole body always sits on the grass
  function swatBg() {
    if (SWBG && SWW === VW) return SWBG; SWW = VW;
    return SWBG = bake(() => {
      const L = -OX - 2, R = W + OX + 2, HZ = SWHZ;
      let g = X.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#36b0ea'); g.addColorStop(.6, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, R - L, HZ + 4);
      X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(L, HZ); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 38 - Math.sin(x * .011 + 1) * 10 - Math.sin(x * .027) * 4); X.lineTo(R, HZ); X.closePath(); X.fill();
      // lollipop trees on the far hill
      for (const [tx, ty, r] of [[60, 42, 13], [86, 46, 9], [560, 42, 12], [716, 44, 14], [-150, 43, 13], [930, 43, 12]]) {
        X.fillStyle = '#8a5a34'; X.fillRect(tx - 3, ty, 6, 12); X.beginPath(); X.arc(tx, ty, r, 0, TAU); ink('#3fb260', 2.5, '#2f7a49'); X.fillStyle = '#5bcf72'; X.beginPath(); X.arc(tx - r * .2, ty - r * .25, r * .62, 0, TAU); X.fill();
      }
      X.beginPath(); X.moveTo(L, HZ + 2); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 52 - Math.sin(x * .014 + 3) * 6); X.lineTo(R, HZ + 2); X.closePath(); X.fillStyle = '#87d19b'; X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
      g = X.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(L, HZ, R - L, H - HZ);
      X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = Math.floor(L / 90) - 4; i < R / 90 + 2; i++) { X.beginPath(); X.moveTo(i * 90, H); X.lineTo(i * 90 + 45, H); X.lineTo(i * 90 + 145, HZ + 2); X.lineTo(i * 90 + 100, HZ + 2); X.fill(); }
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, HZ); X.lineTo(R, HZ); X.stroke();
      for (let i = 0; i < 26; i++) { const x = L + hr(i + 3) * (R - L), y = HZ + 14 + hr(i + 40) * 470; tuft(x, y); }
      for (let i = 0; i < 10; i++) { const x = L + hr(i + 90) * (R - L), y = HZ + 20 + hr(i + 70) * 440; X.save(); X.translate(x, y); for (let p = 0; p < 5; p++) { X.rotate(TAU / 5); el(0, -5, 3.4, 5); ink('#fff', 1.5); } X.beginPath(); X.arc(0, 0, 3, 0, TAU); ink('#ffe14d', 1.5); X.restore(); }
      // blanket: shadow, gingham, ink edge, fringe
      const edge = () => { const p = []; for (let i = 0; i <= 10; i++) p.push(blk(i / 10, 0)); for (let i = 0; i <= 10; i++) p.push(blk(1, i / 10)); for (let i = 10; i >= 0; i--) p.push(blk(i / 10, 1)); for (let i = 10; i >= 0; i--) p.push(blk(0, i / 10)); X.beginPath(); p.forEach((q, i) => i ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])); X.closePath(); };
      X.save(); X.translate(8, 10); edge(); X.fillStyle = 'rgba(20,16,28,.22)'; X.fill(); X.restore();
      edge(); ink('#fff6e6', 5);
      X.save(); edge(); X.clip();
      const NU = 14, NV = 12;
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
        const a = blk(i / NU, j / NV), b = blk((i + 1) / NU, j / NV), c = blk((i + 1) / NU, (j + 1) / NV), d = blk(i / NU, (j + 1) / NV);
        const col = (i % 2 && j % 2) ? '#e8434f' : (i % 2 || j % 2) ? '#ff9d9d' : '#fff6e6';
        X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.lineTo(c[0], c[1]); X.lineTo(d[0], d[1]); X.closePath(); X.fillStyle = col; X.fill(); X.strokeStyle = col; X.lineWidth = 1; X.stroke();
      }
      X.fillStyle = 'rgba(255,255,255,.18)'; X.beginPath(); X.moveTo(150, 116); X.lineTo(290, 116); X.lineTo(110, 380); X.lineTo(10, 380); X.fill();
      X.restore(); edge(); X.lineWidth = 8; X.strokeStyle = INK; X.stroke();
      for (let i = 0; i <= 24; i++) { const [x, y] = blk(i / 24, 0); X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(x, y - 2); X.lineTo(x, y - 9); X.stroke(); X.strokeStyle = '#ff9d9d'; X.lineWidth = 2.5; X.stroke(); }
      // picnic props on the blanket corners
      // wicker basket (top left)
      X.save(); X.translate(196, 150);
      X.beginPath(); X.ellipse(0, -20, 40, 30, 0, Math.PI * 1.05, Math.PI * 1.95); X.lineWidth = 14; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = '#d9944f'; X.stroke();
      X.fillStyle = 'rgba(20,16,28,.25)'; el(6, 26, 56, 10); X.fill();
      X.beginPath(); X.moveTo(-50, -16); X.lineTo(50, -16); X.lineTo(42, 24); X.quadraticCurveTo(0, 30, -42, 24); X.closePath(); ink('#d9944f', 4);
      X.save(); X.clip(); X.fillStyle = '#b06d33'; X.fillRect(-50, 4, 100, 26); X.strokeStyle = '#a5622c'; X.lineWidth = 2.5; for (let x = -48; x < 50; x += 10) { X.beginPath(); X.moveTo(x, -16); X.lineTo(x + 3, 30); X.stroke(); } for (const y of [-6, 6, 16]) { X.beginPath(); X.moveTo(-50, y); X.lineTo(50, y); X.stroke(); } X.restore();
      X.beginPath(); X.moveTo(-50, -16); X.lineTo(50, -16); X.lineTo(42, 24); X.quadraticCurveTo(0, 30, -42, 24); X.closePath(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
      rr(-56, -24, 112, 12, 6); ink('#f2b878', 3.5);
      X.beginPath(); X.moveTo(-30, -24); X.quadraticCurveTo(-18, -44, 4, -30); X.quadraticCurveTo(18, -46, 30, -24); X.closePath(); ink('#fff6e6', 3); X.fillStyle = '#ff5d5d'; X.fillRect(-14, -36, 6, 10); X.fillRect(8, -38, 6, 12);
      X.restore();
      // cherry pie (top right) with a slice already missing
      X.save(); X.translate(610, 150);
      X.fillStyle = 'rgba(20,16,28,.25)'; el(6, 18, 64, 14); X.fill();
      el(0, 6, 60, 22); ink('#c9ced6', 4); el(0, 2, 52, 18); ink('#b98042', 3);
      X.beginPath(); X.moveTo(0, 0); X.ellipse(0, 0, 50, 16, 0, -.2, Math.PI * 1.62); X.closePath(); ink('#f5c77e', 3);
      X.save(); X.clip(); X.strokeStyle = '#d9944f'; X.lineWidth = 4; for (let x = -44; x <= 44; x += 14) { X.beginPath(); X.moveTo(x, -18); X.lineTo(x + 8, 18); X.stroke(); } for (let y = -10; y <= 10; y += 9) { X.beginPath(); X.moveTo(-50, y); X.lineTo(50, y); X.stroke(); } X.restore();
      X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(-.2) * 50, Math.sin(-.2) * 16); X.lineTo(Math.cos(-.2) * 50, Math.sin(-.2) * 16 + 7); X.lineTo(0, 7); X.closePath(); ink('#c02a3f', 2.5);
      X.fillStyle = 'rgba(255,255,255,.45)'; el(-24, -6, 10, 4, -.2); X.fill();
      X.restore();
      // watermelon slice (bottom left)
      X.save(); X.translate(70, 520); X.rotate(-.25); X.scale(1.7, 1.7);
      X.fillStyle = 'rgba(20,16,28,.25)'; el(4, 6, 30, 6); X.fill();
      X.beginPath(); X.moveTo(-26, -8); X.arc(0, -8, 26, Math.PI, 0, true); X.closePath(); ink('#3fa34d', 3);
      X.beginPath(); X.moveTo(-21, -8); X.arc(0, -8, 21, Math.PI, 0, true); X.closePath(); X.fillStyle = '#c9f59a'; X.fill();
      X.beginPath(); X.moveTo(-18, -8); X.arc(0, -8, 18, Math.PI, 0, true); X.closePath(); X.fillStyle = '#ff4d6d'; X.fill();
      X.fillStyle = INK; for (const [a, b] of [[-9, -1], [0, 3], [9, -1], [-4, -5], [5, -5]]) { el(a, b, 1.8, 2.8); X.fill(); }
      X.restore();
      // juice bottle (right edge)
      X.save(); X.translate(744, 330); X.rotate(.12);
      X.fillStyle = 'rgba(20,16,28,.25)'; el(6, 40, 26, 7); X.fill();
      rr(-8, -50, 16, 18, 4); ink('#ff5d5d', 3); rr(-18, -34, 36, 74, 12); ink('#ffd23f', 4);
      rr(-18, -10, 36, 26, 4); ink('#fff6e6', 0); X.fillStyle = '#ff8a3d'; X.beginPath(); X.arc(0, 3, 8, 0, TAU); X.fill();
      X.fillStyle = 'rgba(255,255,255,.5)'; rr(-12, -28, 6, 52, 3); X.fill();
      X.restore();
    });
  }

  function bugBody(b, look, mood, T, wig) {   // drawn in the bug's frame (head toward -y)
    X.lineCap = 'round';
    for (const i of [-1, 0, 1]) for (const s of [-1, 1]) {
      const w = Math.sin(wig + i * 2 + s) * 8;
      X.beginPath(); X.moveTo(s * 12, i * 11); X.lineTo(s * 26, i * 12 + w * .5); X.lineTo(s * 34, i * 14 + w); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
    }
    // antennae
    for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 5, -34); X.quadraticCurveTo(s * 10, -50 + Math.sin(T * 9 + s) * 2, s * 18, -52); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.arc(s * 18, -52, 4, 0, TAU); ink('#ff9d9d', 2); }
    // shell: shade then base shifted (cel crescent on the right), split, spots, glint
    el(0, 4, 24, 30); ink('#b8283a', 5);
    X.save(); el(0, 4, 24, 30); X.clip(); el(-4, 1, 23, 30); X.fillStyle = '#ff4d5e'; X.fill();
    X.fillStyle = INK; for (const [x, y, r] of [[-11, -4, 5], [11, 2, 5.5], [-9, 18, 4.5], [9, 21, 4], [-15, 8, 3]]) { X.beginPath(); X.arc(x, y, r, 0, TAU); X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.55)'; el(-11, -12, 4.5, 9, .35); X.fill();
    X.restore();
    X.beginPath(); X.moveTo(0, -22); X.lineTo(0, 33); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
    // head + googly eyes + mouth
    el(0, -27, 16, 11); ink('#2a2238', 4);
    eye(-7, -31, 7, look, mood, T, b.x * .01); eye(7, -31, 7, look, mood, T, b.x * .01 + 1.3);
    X.lineWidth = 2.5; X.strokeStyle = '#fff'; X.lineCap = 'round';
    if (mood === 'panic') { X.beginPath(); X.ellipse(0, -21, 3, 3.5, 0, 0, TAU); X.fillStyle = '#ff9d9d'; X.fill(); }
    else { X.beginPath(); X.arc(0, -24, 5, .3, Math.PI - .3); X.stroke(); }
  }
  /* a live bug. near = the swatter is close, so it panics */
  function bug(b, T, near, mx, my) {
    shadow(b.x + 8, b.y + 34, 28, 9, .22);
    const rot = b.a + Math.PI / 2;
    let look = [0, -1];
    if (near) { const dx = mx - b.x, dy = my - b.y, d = Math.hypot(dx, dy) || 1, c = Math.cos(-rot), s = Math.sin(-rot); look = [(dx * c - dy * s) / d, (dx * s + dy * c) / d]; }
    X.save(); X.translate(b.x, b.y); X.rotate(rot); bugBody(b, look, near ? 'panic' : null, T, T * 25); X.restore();
    if (near) drop(b.x + 26, b.y - 30 + ((T * 2.2) % 1) * 12, 1, 1 - ((T * 2.2) % 1));
  }
  /* a squashed bug + its little ghost floating off */
  function splatAt(s, T) {
    const k = T - s.t0, sd = s.x * 3.1 + s.y * 1.7;
    X.save(); X.translate(s.x, s.y); X.rotate(s.r); const sc = k < .1 ? lerp(.5, 1.12, k / .1) : 1 + Math.max(0, .12 - (k - .1)) ; X.scale(sc, sc * .92);
    X.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU, r = 30 + (i % 2 ? 9 : 0) * hr(sd + i) + hr(sd + i * 7) * 6; X.lineTo(Math.cos(a) * r, Math.sin(a) * r); } X.closePath(); ink('#a8d83a', 4);
    X.fillStyle = '#d8f27a'; el(-8, -8, 14, 9, -.4); X.fill();
    for (let i = 0; i < 5; i++) { const a = hr(sd + i * 3) * TAU, r = 44 + hr(sd + i) * 14; X.beginPath(); X.arc(Math.cos(a) * r, Math.sin(a) * r, 4 + hr(sd + i * 5) * 4, 0, TAU); ink('#a8d83a', 2.5); }
    // the flattened bug: splayed legs, pancake shell, X eyes
    X.lineCap = 'round'; X.lineWidth = 5; X.strokeStyle = INK;
    for (let i = 0; i < 6; i++) { const a = -2.4 + i * .95 + (i > 2 ? .6 : 0); X.beginPath(); X.moveTo(Math.cos(a) * 18, Math.sin(a) * 14); X.lineTo(Math.cos(a) * 38, Math.sin(a) * 30); X.stroke(); }
    el(0, 4, 30, 19); ink('#e8434f', 4); X.fillStyle = INK; for (const [x, y] of [[-12, 2], [12, 6], [0, 14]]) { el(x, y, 6, 3.5); X.fill(); }
    el(0, -17, 15, 7); ink('#2a2238', 3); eye(-6, -17, 5, [0, 0], 'dead', T, 0); eye(6, -17, 5, [0, 0], 'dead', T, 0);
    X.restore();
    if (k < 1.3) {   // ghost with a halo
      const a = 1 - k / 1.3, gy = s.y - 26 - k * 70, gx = s.x + Math.sin(k * 6) * 10;
      X.save(); X.globalAlpha = a * .85; X.translate(gx, gy);
      for (const sx of [-1, 1]) { X.save(); X.scale(sx, 1); X.rotate(Math.sin(T * 30) * .4); el(14, -4, 11, 6, -.5); ink('#fff', 2.5); X.restore(); }
      el(0, 0, 13, 15); ink('#f4f1ff', 3); eye(-5, -3, 3.5, [0, 0], 'happy', T, 0); eye(5, -3, 3.5, [0, 0], 'happy', T, 0);
      el(0, -22, 11, 4); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#FFE14D'; X.stroke();
      X.restore();
    }
  }
  /* the fly swatter: hovering over the cursor, or slammed flat on a click */
  function swatter(x, y, slam, T) {
    const lift = slam ? 0 : 1;
    if (!slam) { X.fillStyle = 'rgba(20,16,28,.16)'; el(x + 8, y + 12, 40, 16); X.fill(); }
    X.save(); X.translate(x + lift * 10, y - lift * 22); X.rotate(-.5 + lift * .12 + (slam ? 0 : Math.sin(T * 4) * .03)); const s = slam ? 1.06 : 1; X.scale(s, s * (slam ? .94 : 1));
    line([[0, 40], [0, 150]], 9, '#ffd23f'); rr(-9, 128, 18, 44, 8); ink('#ff5d5d', 3.5);
    X.fillStyle = 'rgba(255,255,255,.45)'; rr(-5, 132, 4, 34, 2); X.fill();
    rr(-40, -46, 80, 92, 22); X.fillStyle = slam ? 'rgba(79,208,106,.92)' : 'rgba(79,208,106,.42)'; X.fill();
    X.save(); rr(-40, -46, 80, 92, 22); X.clip(); X.strokeStyle = 'rgba(20,16,28,.32)'; X.lineWidth = 2; for (let i = -40; i <= 40; i += 10) { X.beginPath(); X.moveTo(i, -46); X.lineTo(i, 46); X.stroke(); X.beginPath(); X.moveTo(-40, i); X.lineTo(40, i); X.stroke(); } X.restore();
    rr(-40, -46, 80, 92, 22); X.lineWidth = 12; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = '#4fd06a'; X.stroke();
    X.strokeStyle = 'rgba(255,255,255,.6)'; X.lineWidth = 3; X.beginPath(); X.arc(-18, -24, 14, Math.PI * 1.05, Math.PI * 1.45); X.stroke();
    X.restore();
    if (slam) { X.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + .2, r0 = 62, r1 = 82; X.beginPath(); X.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); X.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#fff'; X.stroke(); } }
  }
  function sandwich(x, y, s, bites) {
    X.save(); X.translate(x, y); X.scale(s, s);
    const w = 76 * (1 - bites * .3), x0 = -38;
    X.save(); X.beginPath(); X.rect(x0 - 10, -40, w + 10, 80); if (bites) { for (let i = 0; i < 3; i++) X.arc(x0 + w + 2, -16 + i * 14, 9, 0, TAU); } X.clip('evenodd');
    rr(x0, 6, 76, 16, 8); ink('#f2a444', 3.5);
    X.beginPath(); X.moveTo(x0 - 4, 4); for (let i = 0; i <= 12; i++) X.lineTo(x0 - 4 + i * 7, i % 2 ? 10 : 2); X.lineTo(x0 + 80, -2); X.lineTo(x0 - 4, -2); X.closePath(); ink('#71d64b', 3);
    rr(x0 + 4, -6, 68, 8, 4); ink('#ff4d5e', 2.5); X.beginPath(); X.moveTo(x0 + 2, -8); X.lineTo(x0 + 74, -8); X.lineTo(x0 + 66, 2); X.lineTo(x0 + 54, -8); X.closePath(); ink('#ffd23f', 2.5);
    X.beginPath(); X.moveTo(x0, -8); X.bezierCurveTo(x0, -34, x0 + 76, -34, x0 + 76, -8); X.closePath(); ink('#f5ae48', 3.5);
    X.fillStyle = '#ffd590'; el(x0 + 24, -20, 10, 4, -.3); X.fill();
    X.fillStyle = '#fff4d8'; for (const [a, b] of [[20, -18], [38, -24], [52, -17], [30, -14]]) { el(x0 + a, b, 2.4, 1.4, .4); X.fill(); }
    X.restore(); X.restore();
  }
  /* the bug counter: a wooden sign stuck in the grass at the top centre */
  function bugSign(bugs, won, T) {
    const n = bugs.length, w = n * 46 + 30, x0 = 400 - w / 2;
    for (const px of [x0 + 22, x0 + w - 22]) { rr(px - 5, 88, 10, 42, 3); ink('#a5622c', 3); }
    X.save(); X.translate(400, 76); X.rotate(Math.sin(T * 1.3) * .02);
    rr(-w / 2, -14, w, 40, 12); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
    rr(-w / 2, -20, w, 40, 12); ink('#d9944f', 4);
    X.strokeStyle = '#c98443'; X.lineWidth = 2; for (const y of [-8, 6]) { X.beginPath(); X.moveTo(-w / 2 + 10, y); X.lineTo(w / 2 - 10, y); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + 8, -16, w - 16, 6, 3); X.fill();
    bugs.forEach((b, i) => {
      const cx = -w / 2 + 38 + i * 46, hop = won ? -Math.abs(Math.sin(T * 9 + i)) * 8 : 0;
      X.save(); X.translate(cx, hop);
      if (b.dead) { el(0, 0, 16, 11); ink('#a8d83a', 2.5); X.lineWidth = 3; X.strokeStyle = INK; X.beginPath(); X.moveTo(-6, -5); X.lineTo(6, 5); X.moveTo(6, -5); X.lineTo(-6, 5); X.stroke(); }
      else { el(0, 2, 11, 12); ink('#ff4d5e', 2.5); el(0, -10, 7, 5); ink('#2a2238', 2); X.fillStyle = INK; X.beginPath(); X.arc(-4, 2, 2.5, 0, TAU); X.arc(4, 6, 2.5, 0, TAU); X.fill(); }
      X.restore();
    });
    X.restore();
  }
  function ant(T) {   // background gag: an ant hauling a sugar cube twice its size along the horizon
    const span = VW + 160, x = -OX - 80 + ((T * 26) % span), y = SWHZ + 12;
    X.save(); X.translate(x, y);
    X.lineWidth = 2; X.strokeStyle = INK; for (let i = 0; i < 3; i++) { const w = Math.sin(T * 22 + i * 2) * 3; X.beginPath(); X.moveTo(-6 + i * 6, 0); X.lineTo(-8 + i * 6 + w, 7); X.stroke(); }
    for (const [a, r] of [[-8, 4.5], [0, 3.5], [7, 4]]) { X.beginPath(); X.arc(a, -1, r, 0, TAU); X.fillStyle = INK; X.fill(); }
    X.save(); X.translate(0, -16 + Math.sin(T * 11) * 1.2); X.rotate(Math.sin(T * 5.5) * .08); rr(-10, -9, 20, 18, 3); ink('#fff', 2); X.fillStyle = '#d6f2ff'; X.fillRect(2, -7, 6, 14); X.restore();
    X.restore();
  }
  /* Claude guarding lunch near the bottom-right corner, kept above main.js's fuse strip (y > 552) and left of the bomb column */
  const SWFY = 535, SWCX = () => W + OX - 140;
  function swatClaude(T, res, rT, danger, alive) {
    const u = 5.2, cx = SWCX(), won = res === 'win', lost = res === 'lose';
    const jump = won ? Math.abs(Math.sin(rT * 9)) * 16 : 0, shiver = danger && !res ? Math.sin(T * 60) * 1.6 : 0;
    const fy = SWFY - jump, x = cx + shiver;
    shadow(cx, SWFY + 2, 42 - jump * .6, 9, .3);
    X.save(); X.translate(x, fy);
    if (won) { const w = Math.sin(T * 14) * .25; arms(u, -.5 + w, .5 - w, 1, OR); }
    else if (lost) arms(u, -1.25 + Math.sin(T * 10) * .15, -.85, 1, OR);
    else arms(u, .32, -.32, 1, OR);
    X.restore();
    claude(x, fy, u, { mood: won ? 'happy' : lost ? 'sad' : null });
    if (!res) { const sb = Math.sin(T * 3.1) * 2; sandwich(x, fy - 86 + sb, .9, 0); }
    if (won) { const bites = Math.min(3, Math.floor(rT / .22)); if (bites < 3) sandwich(x, fy - 76 + Math.min(1, rT / .2) * 14, .9, bites); for (let i = 0; i < 3; i++) { const k = (rT * .9 + i * .33) % 1; X.globalAlpha = 1 - k; heart(x - 30 + i * 30, fy - 70 - k * 70, .8 + .3 * Math.sin(k * 3)); X.globalAlpha = 1; } }
    if (lost) { for (const s of [-1, 1]) { const k = (T * 2.4 + (s > 0 ? .5 : 0)) % 1; drop(x + s * 16, fy - 26 + k * 18, .8, 1 - k); } }
    if (!res && danger) { const k = (T * 2) % 1; drop(x + 34, fy - 52 + k * 14, .9, 1 - k); }
  }
  /* lose: the surviving bugs march the sandwich off, smug */
  function heist(alive, rT, T) {
    const hx = SWCX(), k = ease((rT - .15) / .8), sx = lerp(hx, hx - 300, k), sy = SWFY - 72 - Math.abs(Math.sin(rT * 10)) * 4;
    alive.forEach((b, i) => {
      const tx = sx + (i - (alive.length - 1) / 2) * 62, ty = sy + 22 + (i % 2 ? -14 : 14), m = ease(rT / .25);
      const bx = lerp(b.x, tx, m), by = lerp(b.y, ty, m);
      shadow(bx + 6, by + 30, 26, 8, .22);
      X.save(); X.translate(bx, by); X.rotate(-Math.PI / 2 + .5 + Math.sin(T * 14 + i) * .08); X.scale(.9, .9); bugBody(b, [-1, 0], 'happy', T, T * 30 + i); X.restore();
    });
    if (alive.length) sandwich(sx, sy - 34, .95, 0);
  }
  let swMx = NaN, swMy = NaN, swMove = -9;   // art only: hide the hover swatter when the pointer has been still for a while
  function swat(st) {   // st: {bugs, splats, pings, res, rT, T}
    const { bugs, splats, pings, res, rT, T } = st;
    X = ctx; layer(swatBg());
    X.save(); X.beginPath(); X.rect(-OX, 0, VW, SWHZ - 2); X.clip();
    sun(232, 30, 15, T);
    for (const [sp, o, y, s] of [[8, 120, 22, .5], [5, 600, 36, .4], [11, 900, 14, .36]]) { const span = VW + 260; cloud(-OX - 140 + ((T * sp + o) % span), y, s); }
    X.restore();
    ant(T);
    bugSign(bugs, res === 'win', T);
    for (const s of splats) { if (s.t0 == null) s.t0 = T; splatAt(s, T); }
    const mx = mouse.x, my = mouse.y, alive = bugs.filter(b => !b.dead);
    if (mx !== swMx || my !== swMy) { swMx = mx; swMy = my; swMove = T; }
    const hand = [SWCX(), SWFY - 86];
    const danger = alive.some(b => Math.hypot(b.x - hand[0], b.y - hand[1]) < 190);
    swatClaude(T, res, rT, danger, alive.length);
    if (res === 'lose') heist(alive, rT, T);
    else for (const b of alive) bug(b, T, !res && Math.hypot(mx - b.x, my - b.y) < 140, mx, my);
    const last = pings.length ? pings[pings.length - 1] : null;
    if (last && last.t < .16) swatter(last.x, last.y, true, T);
    else if (!TOUCH && !res && T - swMove < 2.5) swatter(mx, my, false, T);
    vignette(.14);
  }

  /* ═════════════ SPOT: class photo day ═════════════ */
  let SPBG = null, SPKEY = '';
  function spotBg(feet, floorY) {
    const key = VW + ':' + feet.join(',');
    if (SPBG && SPKEY === key) return SPBG; SPKEY = key;
    return SPBG = bake(() => {
      const L = -OX - 2, R = W + OX + 2;
      let g = X.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3d3480'); g.addColorStop(1, '#1d1840'); X.fillStyle = g; X.fillRect(L, 0, R - L, H);
      X.fillStyle = 'rgba(255,255,255,.05)'; for (let x = Math.floor(L / 40) * 40; x < R; x += 40) X.fillRect(x, 0, 18, H);
      // studio softboxes on stands, at the sides (they show on wide screens; in 4:3 they peek in)
      for (const [lx, d] of [[Math.min(-34, -OX + 70), 1], [Math.max(834, W + OX - 70), -1]]) {
        X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.moveTo(lx, 140); X.lineTo(lx, 560); X.moveTo(lx, 560); X.lineTo(lx - 30, 600); X.moveTo(lx, 560); X.lineTo(lx + 30, 600); X.stroke();
        X.strokeStyle = '#8f9cb3'; X.lineWidth = 4; X.stroke();
        X.save(); X.translate(lx, 120); X.rotate(d * .35); X.beginPath(); X.moveTo(-50, -40); X.lineTo(50, -40); X.lineTo(26, 40); X.lineTo(-26, 40); X.closePath(); ink('#3b3550', 4);
        rr(-46, -48, 92, 16, 6); ink('#fffbe0', 3); X.restore();
      }
      // the paper backdrop: hung from a roll, cheesy painted sky with a rainbow
      const bx0 = -24, bx1 = 824;
      g = X.createLinearGradient(0, 50, 0, floorY); g.addColorStop(0, '#86d8fb'); g.addColorStop(1, '#e6fbff'); X.fillStyle = g;
      X.beginPath(); X.moveTo(bx0, 50); X.lineTo(bx1, 50); X.lineTo(bx1, floorY); X.lineTo(bx0, floorY); X.closePath(); X.fill(); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
      X.save(); X.beginPath(); X.rect(bx0, 50, bx1 - bx0, floorY - 50); X.clip();
      const rb = ['#ff5d5d', '#ff9b3d', '#ffe14d', '#6fe07a', '#5cc2ff', '#a48fdc'];
      rb.forEach((c, i) => { X.beginPath(); X.arc(400, 420, 330 - i * 20, Math.PI, 0); X.lineWidth = 20; X.strokeStyle = c; X.globalAlpha = .55; X.stroke(); });
      X.globalAlpha = 1;
      for (const [cx, cy, s] of [[90, 100, .9], [610, 86, 1.1], [330, 150, .6], [740, 170, .7]]) { X.save(); X.translate(cx, cy); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); }
      X.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 6; i++) X.fillRect(bx0 + 40 + i * 140, 50, 3, floorY - 50);   // paper creases
      X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(bx0, 60); for (let x = bx0; x <= bx1; x += 10) X.lineTo(x, 60 + Math.sin((x - bx0) / (bx1 - bx0) * Math.PI * 4) ** 2 * 18); X.stroke();
      for (let i = 0; i < 24; i++) { const x = bx0 + 18 + i * 35, y = 60 + Math.sin((x - bx0) / (bx1 - bx0) * Math.PI * 4) ** 2 * 18; X.beginPath(); X.moveTo(x - 11, y); X.lineTo(x + 11, y); X.lineTo(x, y + 22); X.closePath(); ink(rb[i % 6], 2); }
      X.restore();
      rr(bx0 - 14, 36, bx1 - bx0 + 28, 22, 11); ink('#cfd8e6', 4); X.fillStyle = '#8f9cb3'; X.fillRect(bx0, 50, bx1 - bx0, 4); X.fillStyle = 'rgba(255,255,255,.6)'; rr(bx0, 40, bx1 - bx0, 4, 2); X.fill();
      // floor
      g = X.createLinearGradient(0, floorY, 0, H); g.addColorStop(0, '#b97a46'); g.addColorStop(1, '#8a5530'); X.fillStyle = g; X.fillRect(L, floorY, R - L, H - floorY);
      X.strokeStyle = 'rgba(20,16,28,.18)'; X.lineWidth = 2; for (let x = Math.floor(L / 70) * 70; x < R; x += 70) { X.beginPath(); X.moveTo(x, floorY); X.lineTo(400 + (x - 400) * 1.6, H); X.stroke(); }
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, floorY); X.lineTo(R, floorY); X.stroke();
      // bleacher risers, back to front
      feet.forEach((fy, r) => {
        const bot = floorY + 6;
        X.fillStyle = 'rgba(20,16,28,.25)'; X.fillRect(L, fy + 4, R - L, 10);
        X.beginPath(); X.rect(L - 10, fy + 6, R - L + 20, bot - fy - 6); ink('#b97a46', 4);
        X.fillStyle = '#a5622c'; for (let y = fy + 26; y < bot - 6; y += 22) X.fillRect(L, y, R - L, 3);
        X.fillStyle = 'rgba(20,16,28,.28)'; X.fillRect(L, fy + 10, R - L, 14);
        rr(L - 10, fy - 4, R - L + 20, 12, 5); ink('#f2b878', 3.5);
        for (let x = 40 + (r % 2) * 60; x < R; x += 120) { if (x < L) continue; X.fillStyle = '#a5622c'; X.beginPath(); X.arc(x, fy + 14, 2.5, 0, TAU); X.fill(); }
      });
    });
  }
  /* the photographer's camera on its tripod, with the "watch the birdie" toy sticking out sideways on a spring.
     The whole rig stays below the bottom row's feet (nothing may hide a candidate) and above the fuse strip.
     x, y = body centre; s = scale; tip = fall angle around the tripod foot at y = PIV */
  function camera(x, y, T, tip, flash, s) {
    const PIV = 548;
    X.save(); X.translate(x, PIV); X.rotate(tip); X.translate(0, y - PIV); X.scale(s, s);
    X.lineCap = 'round';
    for (const dx of [-34, 0, 34]) line([[0, 20], [dx, 80]], 5, '#8f9cb3');
    // birdie: spring out of the left side, bobbing level with the body
    const bx = -84 + Math.sin(T * 6) * 5, byy = -4 + Math.sin(T * 7.3) * 3;
    X.beginPath(); for (let i = 0; i <= 10; i++) X.lineTo(-44 + (bx + 14 + 44) * i / 10, (byy + 2) * i / 10 + (i % 2 ? 5 : -5)); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
    X.save(); X.translate(bx, byy); X.rotate(Math.sin(T * 6) * .15); X.scale(-1, 1);
    el(0, 0, 15, 13); ink('#ffe14d', 3); X.save(); X.rotate(Math.sin(T * 24) * .5); el(-4, 4, 8, 5, -.4); ink('#ffd23f', 2); X.restore();
    X.beginPath(); X.moveTo(12, -2); X.lineTo(22, 1); X.lineTo(12, 5); X.closePath(); ink('#ff9b3d', 2);
    eye(5, -4, 4, [1, -.4], null, T, 3); X.restore();
    // body + lens
    rr(-44, -26, 88, 52, 10); ink('#3b3550', 4); X.fillStyle = '#5a5274'; rr(-38, -20, 76, 12, 5); X.fill();
    X.beginPath(); X.arc(0, 2, 17, 0, TAU); ink('#2a2238', 3.5); X.beginPath(); X.arc(0, 2, 10, 0, TAU); ink('#5cc2ff', 2.5); X.fillStyle = 'rgba(255,255,255,.7)'; el(-3, -2, 3.5, 2.5, -.5); X.fill();
    // flash lamp on the right side
    line([[44, 0], [54, 0]], 4, '#c9ced6'); rr(52, -16, 24, 30, 6); ink(flash > 0 ? '#fff' : '#fffbe0', 3);
    X.restore();
    if (flash > 0) { const fx = x + 64 * s, fy = y; X.save(); X.globalCompositeOperation = 'lighter'; const g = X.createRadialGradient(fx, fy, 4, fx, fy, 110); g.addColorStop(0, `rgba(255,255,230,${flash})`); g.addColorStop(1, 'rgba(255,255,230,0)'); X.fillStyle = g; X.fillRect(fx - 110, fy - 110, 220, 220); X.restore(); }
  }
  /* claude()'s own blink is in unison for the whole class; repaint the eyes per kid: staggered blink, an optional look */
  function kidEyes(x, y, u, col, i, T, look) {
    const ey = y - 6.2 * u;
    X.fillStyle = col;
    for (const e of [x - 2.8 * u, x + 2.8 * u]) X.fillRect(e - 1.05 * u, ey - 1.5 * u, 2.1 * u, 3 * u);
    const shut = Math.sin(T * 1.7 + hr(i) * 9) > .985;
    X.fillStyle = INK;
    for (const e of [x - 2.8 * u, x + 2.8 * u]) {
      if (shut) X.fillRect(e - .7 * u, ey - .15 * u, 1.4 * u, .4 * u);
      else X.fillRect(e - .6 * u + look[0] * .4 * u, ey - 1.2 * u + look[1] * .3 * u, 1.2 * u, 2.4 * u);
    }
  }
  function cap(x, y, u, T, spin) {   // a little graduation cap (everyone wears the same one); spin != null = tossed in the air
    X.save(); X.translate(x, y); X.rotate(-.08 + (spin != null ? spin : 0));
    rr(-3.6 * u, -1.6 * u, 7.2 * u, 2.4 * u, u * .5); ink('#2a2238', Math.max(2, u * .35));
    X.beginPath(); X.moveTo(-6.4 * u, -1.8 * u); X.lineTo(0, -3.6 * u); X.lineTo(6.4 * u, -1.8 * u); X.lineTo(0, 0); X.closePath(); ink('#3b3550', Math.max(2, u * .35));
    X.fillStyle = 'rgba(255,255,255,.25)'; X.beginPath(); X.moveTo(-4.4 * u, -1.9 * u); X.lineTo(0, -3.2 * u); X.lineTo(1.4 * u, -2.8 * u); X.lineTo(-3 * u, -1.5 * u); X.closePath(); X.fill();
    const sw = Math.sin(T * 3) * .5 * u; X.strokeStyle = '#FFE14D'; X.lineWidth = Math.max(2, u * .32); X.lineCap = 'round';
    X.beginPath(); X.moveTo(0, -1.8 * u); X.lineTo(4.6 * u, -1.4 * u); X.lineTo(5 * u + sw, 1.6 * u); X.stroke(); X.beginPath(); X.arc(5 * u + sw, 1.9 * u, u * .55, 0, TAU); ink('#FFE14D', Math.max(1.5, u * .25));
    X.restore();
  }
  function spot(st) {   // st: {cols, rows, cw, ch, y0, u, odd, pick, oddC, base, res, rT, T}
    const { cols, rows, cw, ch, y0, u, odd, pick, oddC, base, res, rT, T } = st;
    const k = .78, feet = [], cells = cols * rows;
    for (let r = 0; r < rows; r++) feet.push(Math.round(y0 + ch * r + ch / 2 + u + 4.5 * u * k));
    const floorY = feet[rows - 1] + 30;
    X = ctx; layer(spotBg(feet, floorY));
    const won = res === 'win', lost = res === 'lose', uk = u * k;
    // idle beat: the kid nearest the pointer side-eyes it (same rule for every cell, so it never gives the odd one away)
    let near = -1, nd = 1e9, look = [0, 0];
    if (!res) for (let i = 0; i < cells; i++) { const d = Math.hypot(mouse.x - (cw * (i % cols) + cw / 2), mouse.y - (feet[i / cols | 0] - 6 * uk)); if (d < nd) { nd = d; near = i; } }
    if (near >= 0 && nd > 4 * uk) { const dx = mouse.x - (cw * (near % cols) + cw / 2), dy = mouse.y - (feet[near / cols | 0] - 6 * uk); look = [dx / nd, dy / nd]; } else near = -1;
    for (let i = 0; i < cells; i++) {
      const c = i % cols, r = i / cols | 0, cx = cw * c + cw / 2, fy = feet[r];
      const isOdd = i === odd, isPick = i === pick;
      const bob = Math.sin(now * 3 + i * 1.3) * 4 * k;
      let hop = 0, mood = null, ar = null;
      if (won && !isOdd) { hop = Math.abs(Math.sin(rT * 9 + i * .7)) * 12; mood = 'happy'; const w = Math.sin(T * 12 + i) * .25; ar = [-.45 + w, .45 - w]; }
      if (lost) mood = isPick ? 'sad' : 'happy';   // the odd one gloats, the whole class laughs at the wrong pick
      const lx = lost && !isPick && !isOdd ? Math.sin(T * 40 + i * 2) * 1.5 : 0;
      const y = fy - Math.max(0, -bob) - hop - (lost && !isPick && !isOdd ? Math.abs(Math.sin(T * 18 + i)) * 3 : 0);
      shadow(cx, fy + 1, uk * 6.5, uk * 1.2, .22);
      if (ar) { X.save(); X.translate(cx, y); arms(uk, ar[0], ar[1], 1, base); X.restore(); }
      if (won && isOdd) { X.save(); X.translate(cx + Math.sin(T * 50) * 2, y); arms(uk, -.9, .9, .8, oddC); X.restore(); }
      claude(cx + lx + (won && isOdd ? Math.sin(T * 50) * 2 : 0), y, uk, { col: isOdd ? oddC : base, mood });
      if (!mood) kidEyes(cx, y, uk, isOdd ? oddC : base, i, T, i === near ? look : [0, 0]);
      const toss = won && !isOdd ? Math.sin(cl(rT / .85) * Math.PI) * (50 + hr(i) * 30) : 0;   // win: caps fly
      cap(cx + (won && isOdd ? Math.sin(T * 50) * 2 : 0), y - 9 * uk - toss, uk, T + i, toss > 2 ? rT * (8 + hr(i + 9) * 6) * (i % 2 ? 1 : -1) : null);
      if (won && isOdd) { for (const s of [-1, 1]) { const q = (T * 2.2 + (s > 0 ? .5 : 0)) % 1; drop(cx + s * 7 * uk, y - 8 * uk + q * 16, uk / 8, 1 - q); } }
      if (lost && isPick) stars(cx, y - 9.5 * uk, 5 * uk, T);
    }
    if (res) {   // circle the impostor (same ring as before), drawn here so it sits under the flash
      const c = odd % cols, r = odd / cols | 0, rad = u * 8 * (1 + Math.max(0, .25 - rT) * 1.2);
      X.strokeStyle = INK; X.lineWidth = 14; X.beginPath(); X.arc(cw * c + cw / 2, y0 + ch * r + ch / 2 + u, rad, 0, TAU); X.stroke();
      X.strokeStyle = won ? '#FFE14D' : '#ff4d5e'; X.lineWidth = 7; X.stroke();
    }
    // camera between two cells for any column count, body between the feet line and the fuse strip
    const cs = .72, camX = cw * (cols / 2 | 0), camY = Math.min(floorY + 8, 545 - 26 * cs), tip = lost ? -outBack(rT / .45) * 1.35 : 0;
    const flash = won ? Math.max(0, 1 - rT / .35) : lost ? Math.max(0, 1 - Math.abs(rT - .4) / .15) * .8 : 0;
    camera(camX, camY, T, tip, flash, cs);
    if (lost && rT > .35) { const q = cl((rT - .35) / .6); X.globalAlpha = 1 - q; for (let i = 0; i < 4; i++) { X.beginPath(); X.arc(camX - 50 - i * 16 - q * 30, 536 - q * 60 - i * 8, 10 + q * 14, 0, TAU); ink('#e4e0ee', 2.5); } X.globalAlpha = 1; }
    if (won && rT < .18) { X.fillStyle = `rgba(255,255,255,${(1 - rT / .18) * .45})`; X.fillRect(-OX, 0, VW, H); }
    vignette(.14);
  }

  /* ═════════════ TYPE: the royal typing chamber (stage 2, KEYBOARD KINGDOM) ═════════════
     The king dictates from his throne (left), Claude hammers the royal keyboard (centre), the word hangs on a scroll
     with a pigeon pacing its rod. Win: the king tosses Claude a little crown and seals the scroll. Lose: a tomato.
     The boss look (g.boss) is the same hall at night: torch glow, purple drapes, a bigger king in a taller crown. */
  const TYFL = 420;                                // wall / floor line
  /* throne: x, seat y, scale. Low and to the left so the king (drawn in front of the scroll) never covers a letter, even CLAUDE / REFACTOR */
  const kGeo = boss => boss ? { x: 82, y: 464, s: 1.04 } : { x: 88, y: 452, s: .9 };
  const tyPal = boss => boss
    ? { w0: '#241a40', w1: '#4a3970', mort: '#17112b', bl: .06, f0: '#4f4276', f1: '#3a2f5c', tile: 'rgba(10,6,24,.22)', vel: '#7b3fb0', velS: '#55267f', robe: '#7b3fb0', robeS: '#55267f', skin: '#ffd6b0', skinS: '#efa982' }
    : { w0: '#dfb174', w1: '#f6dcae', mort: '#c08a50', bl: .14, f0: '#f3e3c3', f1: '#e2c495', tile: 'rgba(150,96,40,.16)', vel: '#d23b4b', velS: '#a52a3a', robe: '#e8434f', robeS: '#b8283a', skin: '#ffd6b0', skinS: '#efa982' };
  function cel(path, base, shade, o, sx = 5, sy = 5, oc) { path(); ink(shade, o, oc); X.save(); path(); X.clip(); X.translate(-sx, -sy); path(); X.fillStyle = base; X.fill(); X.restore(); }
  function celR(x, y, w, h, r, base, shade, o, sx, sy) { cel(() => rr(x, y, w, h, r), base, shade, o, sx, sy); }
  function glint(x, y, rx, ry, a = .45) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, -.5); X.fill(); }
  let TGLOW = null;
  function torchGlow(x, y, r, a) {
    if (!TGLOW) { TGLOW = document.createElement('canvas'); TGLOW.width = TGLOW.height = 128; const c = TGLOW.getContext('2d'), g = c.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,200,90,1)'); g.addColorStop(.45, 'rgba(255,140,50,.35)'); g.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
    X.save(); X.globalCompositeOperation = 'lighter'; X.globalAlpha = a; X.drawImage(TGLOW, x - r, y - r, r * 2, r * 2); X.restore();
  }
  function crownShape(w, h) { X.beginPath(); X.moveTo(-w, 0); X.lineTo(-w * 1.12, -h); X.lineTo(-w * .55, -h * .45); X.lineTo(0, -h * 1.2); X.lineTo(w * .55, -h * .45); X.lineTo(w * 1.12, -h); X.lineTo(w, 0); X.closePath(); }
  function crown(x, y, w, h, rot, tall) {   // gold crown, base centre at (x, y)
    X.save(); X.translate(x, y); X.rotate(rot);
    if (tall) { X.beginPath(); X.arc(0, -h * .5, w * .8, Math.PI, 0); ink('#7b3fb0', 3); }
    cel(() => crownShape(w, h), '#ffd23f', '#c99512', 3.5, 3, 3);
    for (const [a, b] of [[-w * 1.12, -h], [0, -h * 1.2], [w * 1.12, -h]]) { X.beginPath(); X.arc(a, b, Math.max(3, w * .14), 0, TAU); ink('#fff3a0', 2.5); }
    rr(-w - 2, -h * .28, w * 2 + 4, h * .34, 3); ink('#ffd23f', 3);
    X.beginPath(); X.arc(0, -h * .12, Math.max(2.5, w * .16), 0, TAU); ink('#e8434f', 2);
    for (const s of [-1, 1]) { X.beginPath(); X.arc(s * w * .6, -h * .12, Math.max(2, w * .11), 0, TAU); ink('#4db8ff', 2); }
    glint(-w * .45, -h * .55, w * .2, h * .1, .5);
    X.restore();
  }
  function keycap(x, y, w, h, face, side, col, ch, size) {
    rr(x, y + h * .08, w, h * .94, Math.min(w, h) * .18); ink(side, 4);
    rr(x + w * .08, y, w * .84, h * .8, Math.min(w, h) * .15); X.fillStyle = face; X.fill(); X.lineWidth = 2.5; X.strokeStyle = 'rgba(20,16,28,.3)'; X.stroke();
    X.fillStyle = 'rgba(255,255,255,.5)'; rr(x + w * .16, y + h * .07, w * .36, Math.max(3, h * .08), 2); X.fill();
    if (ch) txt(ch, x + w / 2, y + h * .42, size, col);
  }
  let TYBG = null, TYBK = '';
  function typeBg(boss) {
    const key = VW + '|' + boss;
    if (TYBG && TYBK === key) return TYBG; TYBK = key;
    const P = tyPal(boss);
    return TYBG = bake(() => {
      const L = -OX - 2, R = W + OX + 2;
      let g = X.createLinearGradient(0, 0, 0, TYFL); g.addColorStop(0, P.w0); g.addColorStop(1, P.w1); X.fillStyle = g; X.fillRect(L, 0, R - L, TYFL);
      for (let r = 0; r * 42 < TYFL; r++) {                 // stone blocks
        const off = r % 2 ? 46 : 0;
        for (let c = Math.floor((L - off) / 92) - 1; c * 92 + off < R; c++) {
          const x = c * 92 + off, y = r * 42, k = hr(r * 31 + c * 7 + 5);
          rr(x + 3, y + 3, 86, 36, 7); X.fillStyle = `rgba(255,255,255,${P.bl * (.3 + k)})`; X.fill(); X.lineWidth = 3; X.strokeStyle = P.mort; X.stroke();
          X.fillStyle = `rgba(255,255,255,${P.bl})`; rr(x + 10, y + 8, 22 + k * 34, 5, 2.5); X.fill();
          if (k > .82) { X.strokeStyle = P.mort; X.lineWidth = 2; X.beginPath(); X.moveTo(x + 50, y + 8); X.lineTo(x + 58, y + 18); X.lineTo(x + 54, y + 26); X.stroke(); }
        }
      }
      // tall windows in the wide margins only (the 800 frame is busy with the scroll)
      if (OX > 70) for (const cx of [-OX / 2, W + OX / 2]) {
        const ww = Math.min(120, OX - 50), wx = cx - ww / 2, path = () => { X.beginPath(); X.moveTo(wx, 330); X.lineTo(wx, 140); X.arc(cx, 140, ww / 2, Math.PI, 0); X.lineTo(wx + ww, 330); X.closePath(); };
        path(); ink(null, 5); X.save(); path(); X.clip();
        const sg = X.createLinearGradient(0, 80, 0, 330); if (boss) { sg.addColorStop(0, '#1d1840'); sg.addColorStop(1, '#3d3480'); } else { sg.addColorStop(0, '#36b0ea'); sg.addColorStop(1, '#d6f7ff'); } X.fillStyle = sg; X.fillRect(wx, 80, ww, 260);
        if (boss) { X.beginPath(); X.arc(cx + ww * .2, 150, 14, 0, TAU); X.fillStyle = '#fff3b0'; X.fill(); for (let i = 0; i < 6; i++) { X.fillStyle = '#fff'; X.fillRect(wx + hr(i + 300) * ww, 110 + hr(i + 310) * 180, 2.5, 2.5); } }
        else { X.fillStyle = '#87d19b'; X.beginPath(); X.moveTo(wx, 300); X.quadraticCurveTo(cx, 262, wx + ww, 296); X.lineTo(wx + ww, 340); X.lineTo(wx, 340); X.fill(); }
        X.restore(); path(); X.lineWidth = 8; X.strokeStyle = boss ? '#6b5a94' : '#b98042'; X.stroke(); path(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
        X.lineWidth = 6; X.strokeStyle = INK; X.beginPath(); X.moveTo(cx, 96); X.lineTo(cx, 330); X.moveTo(wx, 220); X.lineTo(wx + ww, 220); X.stroke();
        rr(wx - 12, 326, ww + 24, 14, 5); ink(boss ? '#6b5a94' : '#d9944f', 3);
      }
      // the royal crest: a crowned keycap on a shield (top centre, below the hint line)
      X.save(); X.translate(400, 104);
      const sh = () => { X.beginPath(); X.moveTo(-34, -34); X.lineTo(34, -34); X.lineTo(34, 4); X.quadraticCurveTo(32, 28, 0, 40); X.quadraticCurveTo(-32, 28, -34, 4); X.closePath(); };
      X.fillStyle = 'rgba(20,16,28,.25)'; X.save(); X.translate(4, 6); sh(); X.fill(); X.restore();
      cel(sh, P.vel, P.velS, 4, 6, 4); sh(); X.lineWidth = 3; X.strokeStyle = '#ffd23f'; X.save(); X.scale(.84, .84); sh(); X.stroke(); X.restore();
      rr(-14, -6, 28, 24, 6); ink('#fff6e6', 2.5); X.fillStyle = 'rgba(20,16,28,.18)'; rr(-10, -3, 20, 14, 4); X.fill();
      X.restore();
      crown(400, 92, 13, 12, 0, false);
      // wall sconces (the flames are live)
      for (const sx of [205, 595]) { line([[sx, 124], [sx, 104]], 6, '#5a5274'); rr(sx - 13, 118, 26, 10, 4); ink('#5a5274', 3); X.beginPath(); X.moveTo(sx - 12, 104); X.lineTo(sx + 12, 104); X.lineTo(sx + 8, 94); X.lineTo(sx - 8, 94); X.closePath(); ink('#8a5a34', 3); }
      // skirting + floor
      X.fillStyle = P.mort; X.fillRect(L, TYFL - 12, R - L, 12);
      g = X.createLinearGradient(0, TYFL, 0, H); g.addColorStop(0, P.f1); g.addColorStop(1, P.f0); X.fillStyle = g; X.fillRect(L, TYFL, R - L, H - TYFL);
      const VX = 400, VY = 150, rows = [420, 436, 458, 488, 528, 580, 650], at = (X0, y) => VX + (X0 - VX) * (y - VY) / (600 - VY);
      X.fillStyle = P.tile;
      for (let j = 0; j < rows.length - 1; j++) for (let c = -14; c < 14; c++) {
        if (((c + j) % 2 + 2) % 2) continue; const a = 400 + c * 120, b = a + 120, y0 = rows[j], y1 = rows[j + 1];
        X.beginPath(); X.moveTo(at(a, y0), y0); X.lineTo(at(b, y0), y0); X.lineTo(at(b, y1), y1); X.lineTo(at(a, y1), y1); X.closePath(); X.fill();
      }
      // red carpet to the keyboard desk
      const cp = (y, s) => at(400 + s * 170, y);
      X.beginPath(); X.moveTo(cp(TYFL, -1), TYFL); X.lineTo(cp(TYFL, 1), TYFL); X.lineTo(cp(600, 1), 600); X.lineTo(cp(600, -1), 600); X.closePath(); X.fillStyle = P.vel; X.fill();
      for (const s of [-1, 1]) { X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); X.moveTo(cp(TYFL, s * .9), TYFL); X.lineTo(cp(600, s * .9), 600); X.stroke(); X.lineWidth = 4; X.strokeStyle = '#ffd23f'; X.stroke(); }
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, TYFL); X.lineTo(R, TYFL); X.stroke();
      // the throne back (the cushion, armrests and legs are drawn live in front of the king)
      const K = kGeo(boss);
      X.save(); X.translate(K.x, K.y + 78 * K.s); X.fillStyle = 'rgba(20,16,28,.25)'; el(4, 4, 88 * K.s, 13); X.fill();
      X.restore();
    });
  }
  function throneBack(P, boss) {   // throne space (origin = seat centre); drawn live because the king sits in front of the scroll
    if (boss) {   // an ermine-trimmed cape draped over the throne
      const cape = () => { X.beginPath(); X.moveTo(-50, -140); X.quadraticCurveTo(-104, -90, -96, 70); X.lineTo(96, 70); X.quadraticCurveTo(104, -90, 50, -140); X.closePath(); };
      cel(cape, '#7b3fb0', '#55267f', 4, -8, 0);
      X.lineWidth = 10; X.strokeStyle = INK; X.beginPath(); X.moveTo(-92, 66); X.lineTo(92, 66); X.stroke(); X.lineWidth = 7; X.strokeStyle = '#fff'; X.stroke();
      X.fillStyle = INK; for (let i = -4; i <= 4; i++) { el(i * 20, 66, 2, 3); X.fill(); }
    }
    const back = () => { X.beginPath(); X.moveTo(-62, 10); X.lineTo(-62, -100); X.quadraticCurveTo(-62, -150, 0, -152); X.quadraticCurveTo(62, -150, 62, -100); X.lineTo(62, 10); X.closePath(); };
    cel(back, '#ffd23f', '#c99512', 4.5, 5, 0);
    X.save(); X.translate(0, -6); X.scale(.8, .86); cel(back, P.vel, P.velS, 0, 8, 0); X.restore();
    X.fillStyle = 'rgba(255,255,255,.14)'; for (let i = -2; i <= 2; i++) { X.save(); X.translate(i * 20, -70); X.rotate(Math.PI / 4); X.fillRect(-4, -4, 8, 8); X.restore(); }
    glint(-38, -120, 9, 5, .5);
    for (const sx of [-54, 54]) { X.beginPath(); X.arc(sx, -112, 10, 0, TAU); ink('#ffd23f', 3.5); glint(sx - 3, -115, 3.5, 2.2, .6); }
  }
  function flame(x, y, s, T, k) {
    const f = 1 + Math.sin(T * 17 + k) * .1 + Math.sin(T * 29 + k * 2) * .06;
    X.save(); X.translate(x, y); X.scale(s, s * f);
    X.beginPath(); X.moveTo(0, -30); X.quadraticCurveTo(16, -10, 12, 0); X.quadraticCurveTo(0, 10, -12, 0); X.quadraticCurveTo(-16, -10, 0, -30); X.closePath(); ink('#ff8a3d', 2.5);
    X.beginPath(); X.moveTo(0, -18 + Math.sin(T * 23 + k) * 2); X.quadraticCurveTo(8, -4, 6, 1); X.quadraticCurveTo(0, 6, -6, 1); X.quadraticCurveTo(-8, -4, 0, -18); X.fillStyle = '#ffe14d'; X.fill();
    X.restore();
  }
  /* the king, in throne space: origin = seat centre, feet dangling a little short of the floor (y 78) */
  function king(T, st) {
    const { mood, look, rT, boss, P } = st, angry = mood === 'angry', happy = mood === 'happy';
    const rage = angry ? Math.min(1, rT / .2) : 0, shakeX = angry ? Math.sin(T * 50) * 1.5 : 0;
    X.save(); X.translate(shakeX, 0);
    // body + ermine collar
    cel(() => el(0, -46, 54, 52), P.robe, P.robeS, 4, -7, 4);
    X.fillStyle = 'rgba(255,255,255,.22)'; el(-24, -70, 14, 9, -.5); X.fill();
    for (const y of [-62, -40, -18]) { X.beginPath(); X.arc(0, y, 4.5, 0, TAU); ink('#ffd23f', 2); }
    el(0, -92, 44, 13); ink('#fff', 3.5); X.fillStyle = INK; for (const a of [-30, -14, 2, 18, 32]) { el(a, -92 + Math.abs(a) * .05, 2, 3.2); X.fill(); }
    // left arm resting on the armrest
    line([[-38, -70], [-58, -40], [-56, -22]], 16, P.robe); X.beginPath(); X.arc(-56, -20, 9, 0, TAU); ink(P.skin, 3);
    // right arm + keycap sceptre: idle / impatient tap / win wave / lose throw
    let hx = 54, hy = -44, sa = .38;
    if (mood === 'impatient') { sa = .38 + Math.sin(T * 16) * .14; }
    if (mood === 'cross') { hy = -54; sa = -.1; }
    if (happy) { hx = 62; hy = -112 - Math.abs(Math.sin(rT * 9)) * 8; sa = Math.sin(rT * 12) * .5; }
    if (angry) { const k = ease(rT / .14), k2 = ease((rT - .14) / .14); hx = lerp(lerp(54, 26, k), 78, k2); hy = lerp(lerp(-44, -128, k), -96, k2); sa = lerp(-.6, .5, k2); }
    if (!angry) { X.save(); X.translate(hx, hy); X.rotate(sa); line([[0, 26], [0, -56]], 6, '#ffd23f'); keycap(-13, -80, 26, 24, '#fff6e6', '#ffd23f', INK, '', 0); crown(0, -80, 7, 7, 0, false); X.restore(); }
    line([[38, -72], [hx, hy]], 16, P.robe); X.beginPath(); X.arc(hx, hy, 9.5, 0, TAU); ink(P.skin, 3);
    // head
    const hb = mood === 'idle' ? Math.sin(T * 2.2) * 1.5 : 0;
    X.save(); X.translate(0, hb);
    for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 38, -124, 9, 0, TAU); ink(P.skin, 3); }
    cel(() => { X.beginPath(); X.arc(0, -126, 38, 0, TAU); }, P.skin, P.skinS, 4, -6, 4);
    if (rage > 0) { X.save(); X.beginPath(); X.arc(0, -126, 38, 0, TAU); X.clip(); X.fillStyle = `rgba(255,60,60,${rage * .5})`; X.fillRect(-40, -170 + (1 - rage) * 70, 80, 90); X.restore(); }
    glint(-16, -146, 9, 5, .4);
    // eyes + brows
    const em = happy ? 'happy' : null, ey = -136;
    for (const s of [-1, 1]) {
      eye(s * 14, ey, 9, look, em, T, s);
      if (mood === 'idle' && !happy) { X.save(); el(s * 14, ey, 9, 9.7); X.clip(); X.fillStyle = P.skin; X.fillRect(s * 14 - 11, ey - 12, 22, 9); X.restore(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(s * 14 - 9, ey - 3); X.lineTo(s * 14 + 9, ey - 3); X.stroke(); }
      X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath();
      if (angry || mood === 'cross') { X.moveTo(s * 25, ey - 18); X.lineTo(s * 6, ey - 10); }
      else if (mood === 'impatient') { X.moveTo(s * 24, ey - 13); X.lineTo(s * 6, ey - 14); }
      else if (happy) { X.moveTo(s * 24, ey - 15); X.quadraticCurveTo(s * 15, ey - 23, s * 6, ey - 16); }
      else { X.moveTo(s * 24, ey - (s > 0 ? 20 : 14)); X.quadraticCurveTo(s * 15, ey - (s > 0 ? 26 : 18), s * 6, ey - (s > 0 ? 18 : 14)); }
      X.stroke();
    }
    X.fillStyle = `rgba(255,110,165,${happy ? .8 : .5})`; for (const s of [-1, 1]) { el(s * 25, -112, 8, 5); X.fill(); }
    if (boss) {   // the boss king: a great white beard over the collar and a gold monocle
      const bd = () => { X.beginPath(); X.moveTo(-34, -112); for (let j = 0; j <= 8; j++) { const a = Math.PI * (1 - j / 8), r = 40 + (j % 2) * 6; X.lineTo(Math.cos(a) * 36, -96 + Math.sin(a) * r * 1.25); } X.lineTo(34, -112); X.quadraticCurveTo(0, -96, -34, -112); X.closePath(); };
      cel(bd, '#f4f1ff', '#cfc8e6', 3.5, -4, 5);
      X.strokeStyle = '#cfc8e6'; X.lineWidth = 2.5; for (const a of [-16, 0, 16]) { X.beginPath(); X.moveTo(a, -88); X.quadraticCurveTo(a + 6, -70, a, -54); X.stroke(); }
      X.beginPath(); X.arc(14, -136, 13, 0, TAU); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#ffd23f'; X.stroke();
      X.strokeStyle = '#ffd23f'; X.lineWidth = 2; X.beginPath(); X.moveTo(26, -132); X.quadraticCurveTo(40, -100, 30, -78); X.stroke();
    }
    // mouth (under the moustache)
    if (angry) { rr(-14, -112, 28, 20, 9); ink('#5a1a2a', 3); X.fillStyle = '#fff'; X.fillRect(-10, -111, 20, 4); X.fillStyle = '#ff7a8a'; el(0, -96, 8, 4); X.fill(); }
    else if (happy) { X.beginPath(); X.moveTo(-15, -108); X.quadraticCurveTo(0, -84, 15, -108); X.closePath(); ink('#5a1a2a', 3); X.fillStyle = '#ff7a8a'; el(0, -96, 6, 3.5); X.fill(); }
    else if (mood === 'idle') { const o = Math.max(0, Math.sin(T * 13)) * 5; el(0, -104, 7, 2 + o); ink('#5a1a2a', 2.5); }
    else { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-10, -100); X.quadraticCurveTo(-5, -106, 0, -101); X.quadraticCurveTo(5, -96, 10, -102); X.stroke(); }
    // nose + curly moustache
    const tw = angry ? Math.sin(T * 40) * 3 : mood === 'idle' ? Math.sin(T * 13) * 1.5 : 0;
    for (const s of [-1, 1]) line([[s * 3, -114], [s * 14, -110], [s * 26, -113 + tw], [s * 31, -122 + tw], [s * 25, -126 + tw]], 7, '#8a5a34');
    el(0, -121, 11, 9); ink('#ff9d8a', 3); glint(-4, -124, 3.5, 2.2, .7);
    // crown (pops off in a rage)
    const cy = angry ? -Math.abs(Math.sin(rT * 11)) * 16 * rage : 0;
    crown(2, -158 + cy, boss ? 30 : 26, boss ? 34 : 24, angry ? Math.sin(rT * 13) * .2 : -.06, boss);
    // sweat when impatient, steam when furious
    if (mood === 'impatient' || mood === 'cross') { const k = (T * 1.8) % 1; drop(46, -150 + k * 22, 1.1, 1 - k); }
    if (angry) for (let i = 0; i < 3; i++) { const q = (rT * 2.6 + i / 3) % 1; X.globalAlpha = 1 - q; for (const s of [-1, 1]) { X.beginPath(); X.arc(s * (46 + q * 26), -128 - q * 40, 6 + q * 9, 0, TAU); ink('#e4e0ee', 2.5); } X.globalAlpha = 1; }
    X.restore();
    X.restore();
  }
  function throneFront(P, T, mood, boss) {
    const lh = boss ? 56 : 64;   // boss throne: shorter legs so the knobs stay above main.js's fuse band (y 554)
    for (const s of [-1, 1]) { rr(s * 60 - 7, 14, 14, lh, 5); ink('#ffd23f', 3.5); X.beginPath(); X.arc(s * 60, lh + 14, 9, 0, TAU); ink('#c99512', 3); }
    cel(() => rr(-70, -8, 140, 28, 12), P.vel, P.velS, 4, 0, -5);
    X.fillStyle = 'rgba(255,255,255,.25)'; rr(-56, -4, 60, 5, 2.5); X.fill();
    for (const s of [-1, 1]) { cel(() => rr(s * 66 - 11, -70, 22, 66, 9), '#ffd23f', '#c99512', 3.5, -s * 4, 0); X.beginPath(); X.arc(s * 66, -72, 13, 0, TAU); ink('#ffd23f', 3.5); glint(s * 66 - 4, -76, 4, 2.5, .6); }
    // dangling legs (a little short of the floor: the gag)
    const sw = mood === 'impatient' ? 9 : mood === 'angry' ? 22 : 2.2, amp = mood === 'impatient' ? .4 : mood === 'angry' ? .5 : .14;
    for (const s of [-1, 1]) {
      X.save(); X.translate(s * 20, 10); X.rotate(Math.sin(T * sw + (s > 0 ? Math.PI : 0)) * amp);
      rr(-6, 0, 12, 34, 6); ink('#fff6e6', 3); el(s * 5, 38, 14, 8); ink(P.robeS, 3); X.beginPath(); X.arc(s * 17, 34, 4, 0, TAU); ink('#ffd23f', 2);
      X.restore();
    }
  }
  function pigeon(x, y, dir, T, st) {   // background gag: a pigeon patrolling the scroll rod
    const { res, rT } = st, won = res === 'win', lost = res === 'lose';
    const hop = won ? Math.abs(Math.sin(rT * 10)) * 14 : lost ? Math.min(1, rT / .2) * 26 : 0;
    const peck = !res && Math.sin(T * 1.3) > .7 ? Math.abs(Math.sin(T * 14)) : 0;
    X.save(); X.translate(x, y - hop); X.scale(dir, Math.abs(dir));
    X.strokeStyle = '#ff8a3d'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-3, -2); X.lineTo(-3, 4); X.moveTo(5, -2); X.lineTo(5, 4); X.stroke();
    if (won || lost) for (const s of [-1, 1]) { X.save(); X.translate(-2, -14); X.rotate(s * (.9 + Math.sin(T * 30) * .4) - Math.PI / 2); el(0, -14, 7, 15); ink('#9aa3b8', 2.5); X.restore(); }
    el(0, -12, 16, 11); ink('#b3bccf', 3); X.fillStyle = '#8f99b0'; el(-5, -10, 9, 6, .2); X.fill();
    X.beginPath(); X.moveTo(-14, -13); X.lineTo(-26, -8); X.lineTo(-14, -6); X.closePath(); ink('#7a8299', 2.5);
    X.save(); X.translate(10, -22 + peck * 10); X.rotate(peck * .9);
    X.beginPath(); X.arc(0, 0, 8, 0, TAU); ink('#7fb8b0', 2.5); X.fillStyle = '#a77fd1'; el(-2, 6, 6, 3); X.fill();
    X.beginPath(); X.moveTo(6, -1); X.lineTo(14, 1); X.lineTo(6, 3); X.closePath(); ink('#ff8a3d', 1.5);
    if (lost) { X.beginPath(); X.arc(2, -2, 4, 0, TAU); ink('#fff', 1.5); X.fillStyle = INK; X.beginPath(); X.arc(2, -2, 1.6, 0, TAU); X.fill(); }
    else { X.fillStyle = INK; X.beginPath(); X.arc(2, -2, 2.2, 0, TAU); X.fill(); X.fillStyle = '#ffd23f'; X.beginPath(); X.arc(2.6, -2.6, .8, 0, TAU); X.fill(); }
    X.restore(); X.restore();
    if (lost) for (let i = 0; i < 3; i++) { const q = cl(rT / .7), a = i * 2.1 + 1; X.save(); X.globalAlpha = 1 - q; X.translate(x + Math.cos(a) * q * 40, y - 20 + q * 40 + Math.sin(a) * 10); X.rotate(q * 6 + i); el(0, 0, 3, 7); ink('#e4e8f2', 1.5); X.restore(); }
  }
  function armor(x, y, T, peek, clank, res, rT) {   // res: the guy inside cheers (halberd up) or gasps   // a suit of armour by the door (desktop layout); someone inside peeks when time runs low
    X.save(); if (res === 'win') { X.translate(x + 40, y - 60); X.rotate(Math.sin(rT * 12) * .18 - .1); X.translate(-x - 40, -y + 60 - Math.abs(Math.sin(rT * 9)) * 10); }
    line([[x + 40, y], [x + 40, y - 214]], 5, '#8a5a34');
    X.beginPath(); X.moveTo(x + 40, y - 214); X.quadraticCurveTo(x + 66, y - 196, x + 42, y - 172); X.lineTo(x + 40, y - 180); X.closePath(); ink('#cfd8e6', 3);
    X.beginPath(); X.moveTo(x + 40, y - 236); X.lineTo(x + 46, y - 214); X.lineTo(x + 34, y - 214); X.closePath(); ink('#cfd8e6', 2.5);
    X.restore();
    shadow(x, y + 2, 34, 7, .25);
    for (const s of [-1, 1]) { rr(x + s * 13 - 7, y - 54, 14, 52, 5); ink('#c9ced6', 3); el(x + s * 15, y - 2, 13, 6); ink('#8f9cb3', 3); }
    cel(() => rr(x - 28, y - 130, 56, 82, 18), '#cfd8e6', '#8f9cb3', 4, -6, 3); glint(x - 12, y - 112, 8, 12, .5);
    for (const s of [-1, 1]) { X.beginPath(); X.arc(x + s * 30, y - 122, 14, 0, TAU); ink('#c9ced6', 3.5); line([[x + s * 34, y - 112], [x + s * 36, y - 70]], 11, '#c9ced6'); }
    const hx = x, hy = y - 160;
    line([[hx, hy - 30], [hx + 2, hy - 48], [hx - 10, hy - 56]], 9, '#e8434f');
    cel(() => rr(hx - 21, hy - 32, 42, 54, 19), '#cfd8e6', '#8f9cb3', 4, -5, 3);
    if (res) peek = Math.min(1, rT / .15);
    const lift = Math.max(peek, clank) * 16;
    rr(hx - 16, hy - 8, 32, 12, 5); ink('#2a2238', 2.5);
    if (res === 'win' && peek > .1) { X.strokeStyle = '#fff'; X.lineWidth = 3; X.lineCap = 'round'; for (const s of [-1, 1]) { X.beginPath(); X.arc(hx + s * 7 - 2, hy + 1, 4, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); } }
    else if (peek > .1) { for (const s of [-1, 1]) { el(hx + s * 7 - 2, hy - 2, 5.5 * peek, 6 * peek); ink('#fff', 1.5); X.beginPath(); X.arc(hx + s * 7 - 5, hy - 1, 2.6 * peek, 0, TAU); X.fillStyle = INK; X.fill(); } }
    rr(hx - 19, hy - 12 - lift, 38, 9, 4); ink('#b3bccf', 3);
    glint(hx - 9, hy - 22, 6, 4, .55);
  }
  /* Claude's eyes repainted so they look at the scroll; wince = '> <' after a typo */
  function clEyes(x, y, u, look, wince, T) {
    const ey = y - 6.2 * u; X.fillStyle = OR;
    for (const e of [x - 2.8 * u, x + 2.8 * u]) X.fillRect(e - 1.1 * u, ey - 1.6 * u, 2.2 * u, 3.2 * u);
    X.strokeStyle = INK; X.fillStyle = INK; X.lineWidth = Math.max(2, u * .5); X.lineCap = 'round';
    if (wince) { for (const s of [-1, 1]) { const e = x + s * 2.8 * u; X.beginPath(); X.moveTo(e - s * .8 * u, ey - u); X.lineTo(e + s * .7 * u, ey); X.lineTo(e - s * .8 * u, ey + u); X.stroke(); } return; }
    const shut = Math.sin(T * 1.9 + 2) > .985;
    for (const e of [x - 2.8 * u, x + 2.8 * u]) {
      if (shut) { X.fillRect(e - .7 * u, ey - .15 * u, 1.4 * u, .4 * u); continue; }
      const px = e - .6 * u + look[0] * .45 * u, py = ey - 1.2 * u + look[1] * .35 * u;
      X.fillStyle = INK; X.fillRect(px, py, 1.2 * u, 2.4 * u); X.fillStyle = '#fff'; X.fillRect(px + .2 * u, py + .25 * u, .42 * u, .42 * u);
    }
  }
  function tomato(x, y, s, rot) { X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s); X.beginPath(); X.arc(0, 0, 13, 0, TAU); ink('#ff4d5e', 3); glint(-5, -5, 4, 2.5, .6); X.beginPath(); for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - Math.PI / 2; X.moveTo(0, -11); X.lineTo(Math.cos(a) * 7, -11 + Math.sin(a) * 4); } X.lineWidth = 3; X.strokeStyle = '#3fa34d'; X.stroke(); X.restore(); }
  function splat(x, y, u, k) {   // tomato on Claude's face
    X.save(); X.translate(x, y); X.scale(.6 + .4 * outBack(k), .6 + .4 * outBack(k));
    X.beginPath(); for (let i = 0; i <= 14; i++) { const a = i * TAU / 14, r = u * (i % 2 ? 2.2 : 3.2) * (.85 + hr(i + 600) * .3); i ? X.lineTo(Math.cos(a) * r, Math.sin(a) * r * .8) : X.moveTo(Math.cos(a) * r, Math.sin(a) * r * .8); } X.closePath(); ink('#ff4d5e', 3);
    for (const [a, b] of [[-1, 1.6], [.8, 2.2], [1.6, 1.2]]) { const len = u * (1 + k * 2.2) * b * .6; rr(a * u - u * .35, u, u * .7, len, u * .35); ink('#ff4d5e', 2); }
    X.fillStyle = '#fff3a0'; for (const [a, b] of [[-1.2, -.6], [.6, -1], [1.4, .5], [-.3, .8]]) { el(a * u, b * u, u * .3, u * .45, a); X.fill(); }
    glint(-u * 1.2, -u * 1.4, u * .8, u * .4, .5);
    X.restore();
  }
  function type(st) {   // st: {w, i, shk, pad, padRect, boss, res, rT, T, frac, tapT, taps, missT}
    const { w, i, shk, pad, padRect, boss, res, rT, T, frac, tapT, taps, missT } = st;
    const won = res === 'win', lost = res === 'lose', P = tyPal(boss), K = kGeo(boss);
    X = ctx; layer(typeBg(boss));
    for (const [sx, k] of [[205, 0], [595, 2]]) { torchGlow(sx, 84, boss ? 90 : 60, boss ? .55 + Math.sin(T * 9 + k) * .08 : .3); flame(sx, 96, boss ? 1.25 : 1, T, k); }
    // scroll geometry (the tiles keep the old positions: the typing burst lands on y 240)
    const n = w.length, sz = n > 6 ? 66 : 96, gap = n > 6 ? 8 : 12, tot = n * sz + (n - 1) * gap, x0 = (W - tot) / 2;
    const sx = Math.sin(now * 80) * shk * 40;
    const pl = x0 - 30, pr = x0 + tot + 30, pt = 168, pb0 = 190 + sz + 28;
    const roll = lost ? ease((rT - .3) / .3) : 0, pb = lerp(pb0, pt + 6, roll);
    const miss = shk > 0, low = !res && frac > .62, desk = !TOUCH;
    // king + throne
    const kMood = won ? 'happy' : lost ? 'angry' : miss ? 'cross' : low ? 'impatient' : 'idle';
    const kLook = lost || won ? [1, .4] : low ? [1, .5] : [.8, -.3];
    const kw = (lx, ly) => [K.x + lx * K.s, K.y + ly * K.s];
    // scroll: brackets, paper, rollers
    for (const bx of [pl + 8, pr - 8]) line([[bx, 136], [bx, 160]], 4, '#5a5274');
    X.fillStyle = 'rgba(20,16,28,.22)'; rr(pl + 8, pt + 8, pr - pl, pb - pt, 8); X.fill();
    const paper = () => rr(pl, pt, pr - pl, pb - pt, 6);
    cel(paper, boss ? '#fbe6b0' : '#f7e3b5', boss ? '#e0bb6e' : '#e3c58a', 4, -8, -6);
    if (boss) { X.save(); paper(); X.clip(); X.strokeStyle = '#ffd23f'; X.lineWidth = 4; X.strokeRect(pl + 10, pt + 10, pr - pl - 20, pb - pt - 20); X.restore(); }
    // tiles = royal keycaps
    X.save(); paper(); X.clip();
    for (let k = 0; k < n; k++) {
      const done = k < i, cur = k === i && !res, bad = cur && miss;
      const wave = won ? Math.max(0, Math.sin(rT * 10 - k * .7)) * 12 : 0;
      const y = 190 - (cur ? Math.abs(Math.sin(now * 8)) * 12 : 0) - wave, x = x0 + k * (sz + gap) + sx;
      X.fillStyle = 'rgba(150,96,40,.25)'; el(x + sz / 2 + 4, 190 + sz + 6, sz * .46, 6); X.fill();
      if (done) keycap(x, y, sz, sz, '#5CFF7A', '#23a046', '#fff', w[k], sz * .58);
      else if (bad) keycap(x, y, sz, sz, '#ff4d5e', '#b8283a', '#fff', w[k], sz * .58);
      else if (cur) keycap(x, y, sz, sz, '#FFE14D', '#c99512', INK, w[k], sz * .58);
      else keycap(x, y, sz, sz, '#fffbf0', '#d9c39b', INK, w[k], sz * .58);
    }
    X.restore();
    for (const ry of [pt - 2, pb + 2]) { rr(pl - 14, ry - 8, pr - pl + 28, 16, 8); ink('#b06d33', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; rr(pl - 6, ry - 6, pr - pl + 12, 4, 2); X.fill(); for (const ex of [pl - 20, pr + 20]) { X.beginPath(); X.arc(ex, ry, 10, 0, TAU); ink('#ffd23f', 3); glint(ex - 3, ry - 3, 3, 2, .6); } }
    if (boss) for (const ex of [pl - 20, pr + 20]) { const sw = Math.sin(T * 2 + ex) * .1; X.save(); X.translate(ex, pt + 8); X.rotate(sw); X.beginPath(); X.moveTo(-7, 0); X.lineTo(7, 0); X.lineTo(7, 46); X.lineTo(0, 38); X.lineTo(-7, 46); X.closePath(); ink('#e8434f', 2.5); X.restore(); }
    // royal wax seal on a win (long words: up on the right roller end, clear of the NICE! stamp and the armour's plume)
    if (won && rT > .5) { const k = outBack((rT - .5) / .18), cx = n > 6 ? pr - 8 : pr - 34, cy = n > 6 ? pt + 34 : pb - 14; X.save(); X.translate(cx, cy); X.scale(k * 1.4 - .4 * Math.min(1, k), k * 1.4 - .4 * Math.min(1, k)); X.rotate(-.2);
      X.beginPath(); for (let j = 0; j <= 12; j++) { const a = j * TAU / 12, r = j % 2 ? 20 : 24; j ? X.lineTo(Math.cos(a) * r, Math.sin(a) * r) : X.moveTo(r, 0); } X.closePath(); ink('#c02a3f', 3); X.beginPath(); X.arc(0, 0, 14, 0, TAU); X.lineWidth = 2.5; X.strokeStyle = '#8f1d2e'; X.stroke(); X.restore(); crown(cx, cy + 6, 8, 9, -.2, false); }
    // pigeon on the top rod
    const span = pr - pl - 60, pp = .5 + .5 * Math.sin(T * .55), px = pl + 30 + span * pp, dir = Math.cos(T * .55) >= 0 ? 1 : -1;
    pigeon(px, pt - 10, dir * 1.2, T, { res, rT });
    X.save(); X.translate(K.x, K.y); X.scale(K.s, K.s);
    throneBack(P, boss); king(T, { mood: kMood, look: kLook, rT, boss, P }); throneFront(P, T, kMood, boss);
    X.restore();
    // Claude at the royal keyboard (desktop) or on a crate by the letter pad (touch)
    const cx = desk ? 400 : W - 70, u = desk ? 8.5 : 5, base = desk ? 480 : 390, DY = 18;
    const jump = won ? Math.abs(Math.sin(rT * 9)) * (desk ? 5 : 10) : 0, fy = base - jump;
    const tapK = Math.max(0, 1 - (T - tapT) / .12), missK = Math.max(0, 1 - (T - missT) / .2), side = taps % 2;
    const head = [cx, fy - 9 * u], face = [cx, fy - 6 * u];
    if (!desk) { X.fillStyle = 'rgba(20,16,28,.25)'; el(cx, 472, 48, 8); X.fill(); cel(() => rr(cx - 42, base, 84, 72, 6), '#d9944f', '#b06d33', 4, -5, 0); X.strokeStyle = '#a5622c'; X.lineWidth = 3; for (const yy of [base + 24, base + 48]) { X.beginPath(); X.moveTo(cx - 38, yy); X.lineTo(cx + 38, yy); X.stroke(); } rr(cx - 46, base - 4, 92, 10, 4); ink('#f2b878', 3); }
    const typing = desk && !res, typeArms = () => { X.save(); X.translate(cx, fy); arms(u, 2.55 - (side === 0 ? tapK * .3 : 0) + Math.sin(T * 7) * .04, -2.55 + (side === 1 ? tapK * .3 : 0) - Math.sin(T * 7 + 1) * .04, 1.25, OR); X.restore(); };
    X.save(); X.translate(cx, fy);
    if (typing) { /* arms come after the keyboard */ }
    else if (won) { const wv = Math.sin(T * 14) * .25; arms(u, -.5 + wv, .5 - wv, 1, OR); }
    else if (lost) arms(u, -1.3 + Math.sin(T * 10) * .15, 1.3 - Math.sin(T * 9) * .15, 1, OR);
    else arms(u, .3, -2.1 - tapK * .4, 1, OR);
    X.restore();
    if (!desk) shadow(cx, base + 1, 32, 6, .2);
    claude(cx, fy, u, { mood: won ? 'happy' : lost && rT > .3 ? 'sad' : null });
    if (!won && !(lost && rT > .3)) clEyes(cx, fy, u, desk ? [Math.max(-1, Math.min(1, (x0 + i * (sz + gap) + sz / 2 - cx) / 260)), -1] : [-1, -.6], missK > 0, T);
    if (!res && (missK > 0 || low)) { const k = (T * 2.2) % 1; drop(cx + 7 * u, fy - 8 * u + k * 14, .9, 1 - k); if (missK > 0) drop(cx - 7 * u, fy - 8 * u + k * 10, .8, 1 - k); }
    // the royal keyboard on its desk, in front of Claude's legs
    if (desk) {
      X.save(); X.translate(0, DY);
      cel(() => rr(222, 450, 356, 36, 12), '#f2b878', '#d9944f', 4, 0, -5);
      X.beginPath(); X.moveTo(262, 456); X.lineTo(538, 456); X.lineTo(556, 482); X.lineTo(244, 482); X.closePath(); ink('#3b3550', 3.5);
      X.strokeStyle = '#ffd23f'; X.lineWidth = 2.5; X.stroke();
      const lit = tapK > 0 ? (taps * 7 + 3) % 30 : -1, litBad = missK > 0 ? (Math.round(missT * 60) * 11) % 30 : -1;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) {
        const yy = 459 + r * 7.6, k = (yy - 456) / 26, xl = lerp(266, 248, k) + 4, xr = lerp(534, 552, k) - 4, kw2 = (xr - xl) / 10;
        const j = r * 10 + c, on = (j === lit && !res) || (won && (j + Math.floor(rT * 12)) % 4 === 0), bad = j === litBad && !res;
        rr(xl + c * kw2 + 1.5, yy + (on ? 1.5 : 0), kw2 - 3, 6, 2); ink(bad ? '#ff4d5e' : on ? '#FFE14D' : '#fff6e6', 1.5);
      }
      cel(() => rr(232, 482, 336, 38, 10), '#d9944f', '#a5622c', 4, 0, -5);
      X.strokeStyle = '#ffd23f'; X.lineWidth = 3; rr(244, 488, 312, 26, 7); X.stroke();
      crown(400, 508, 9, 8, 0, false);
      X.restore();
      if (typing) typeArms();
      armor(735, 470, T, low ? Math.min(1, (frac - .62) * 6) : 0, res ? 0 : missK, res, rT);
    } else {
      // the touch letter pad = gold-trimmed keys on a wooden lectern (same rects as before)
      cel(() => rr(26, 394, 648, 146, 16), '#d9944f', '#a5622c', 4, 0, -6);
      X.strokeStyle = '#ffd23f'; X.lineWidth = 3; rr(34, 400, 632, 132, 12); X.stroke();
      pad.forEach((c, j) => { const r = padRect(j); keycap(r.x, r.y, r.w, r.h, '#fffbf0', '#d9c39b', INK, c, 38); });
    }
    // win: the king tosses Claude a little crown; hearts over the throne
    if (won) {
      // the stamp covers the middle (and the outcome only lasts ~.95 s), so the crown flies OVER it:
      // lifted high above the throne, a high arc across the top, then a quick drop onto Claude's head
      const [hx, hy] = kw(62, -150), tx = head[0], ty = head[1] - 2, Lx = hx - 34, Ly = 150, top = 150;
      const kA = ease(rT / .22), kB = cl((rT - .22) / .36), kC = cl((rT - .58) / .12), landed = rT >= .7;
      let bx, by;
      if (rT < .22) { bx = lerp(hx, Lx, kA); by = lerp(hy, Ly, kA) + Math.sin(T * 30) * 2; }
      else if (rT < .58) { bx = lerp(Lx, tx, ease(kB)); by = lerp(Ly, top, kB) - Math.sin(kB * Math.PI) * 80; }
      else { bx = tx; by = lerp(top, ty, kC * kC); }
      if (!landed && rT > .22) for (let j = 1; j <= 3; j++) { X.globalAlpha = .5 - j * .14; star(bx - (rT < .58 ? (tx - Lx) * .05 * j : 0), by + (rT < .58 ? 6 * j : -14 * j), 6, 2.5, 5, T * 8 + j, '#FFE14D', 2); X.globalAlpha = 1; }
      const sc = landed ? 1 + .35 * Math.max(0, 1 - (rT - .7) / .15) : 1.6;
      crown(bx, by, u * 2.2 * sc, u * 2 * sc, landed ? -.1 : rT < .22 ? Math.sin(T * 14) * .2 : rT * 14, false);
      if (landed) stars(head[0], head[1] - u * 3, u * 6, T);
      for (let j = 0; j < 3; j++) { const q = (rT * .9 + j * .33) % 1; X.globalAlpha = 1 - q; heart(K.x - 30 + j * 30, K.y - 205 * K.s - q * 60, .8 + .3 * Math.sin(q * 3)); X.globalAlpha = 1; }
    }
    // lose: a royal tomato, straight to the face
    if (lost) {
      const [hx, hy] = kw(78, -96), k = cl((rT - .14) / .2);
      if (rT > .14 && k < 1) tomato(lerp(hx, face[0], k), lerp(hy, face[1], k) - Math.sin(k * Math.PI) * 120, 1.2, rT * 16);
      if (k >= 1) { splat(face[0], face[1], u, cl((rT - .34) / .25)); if (rT < .5) stars(head[0], head[1] - u * 2, u * 6, T); }
    }
    vignette(boss ? .22 : .14);
  }
  /* ═════════════ JUMP: the beetle lane (a meadow path, a windmill, a cow in sunglasses) ═════════════ */
  const JGY = 450;
  function tileBake(pw, h, fn) { const c = document.createElement('canvas'); c.width = pw; c.height = h; const old = X; X = c.getContext('2d'); try { fn(); } finally { X = old; } return c; }
  function strip(c, sc, y) { const pw = c.width, n = Math.ceil((VW + pw) / pw) + 1, o = ((-sc % pw) + pw) % pw; for (let i = 0; i < n; i++) X.drawImage(c, -OX - o + i * pw - 0, y); }
  let JSKY = null, JMT = null, JHL = null, JFE = null, JGR = null, JSW = -1;
  function jumpBuild() {
    if (JSKY && JSW === VW) return; JSW = VW;
    JSKY = bake(() => {
      const L = -OX - 2, R = W + OX + 2;
      const g = X.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, R - L, 345);
      const m = X.createLinearGradient(0, 330, 0, JGY); m.addColorStop(0, '#9be38a'); m.addColorStop(1, '#6fd660'); X.fillStyle = m; X.fillRect(L, 330, R - L, JGY - 330);
      // light stripes on the meadow
      X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -2; i < 14; i++) { X.beginPath(); X.moveTo(L + i * 120, JGY); X.lineTo(L + i * 120 + 60, JGY); X.lineTo(L + i * 120 + 100, 340); X.lineTo(L + i * 120 + 60, 340); X.fill(); }
    });
    JMT = tileBake(1200, 140, () => {   // far lilac mountains (period 1200)
      X.fillStyle = '#c9d0fb'; X.strokeStyle = '#7b80c6'; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 140);
      const pk = [[0, 60], [150, 20], [330, 70], [520, 10], [720, 64], [900, 26], [1050, 66], [1200, 60]];
      pk.forEach(p => X.lineTo(p[0], p[1] + 20)); X.lineTo(1200, 140); X.closePath(); X.fill(); X.stroke();
      X.fillStyle = '#f6f8ff'; for (const [px, py] of [[150, 20], [520, 10], [900, 26]]) { X.beginPath(); X.moveTo(px, py + 20); X.lineTo(px - 32, py + 62); X.lineTo(px - 12, py + 54); X.lineTo(px, py + 66); X.lineTo(px + 14, py + 54); X.lineTo(px + 32, py + 62); X.closePath(); X.fill(); }
    });
    JHL = tileBake(800, 160, () => {    // rolling hills (period 800) with lollipop trees
      X.translate(0, 40);
      X.fillStyle = '#87d19b'; X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 120);
      for (let x = 0; x <= 800; x += 20) X.lineTo(x, 50 - Math.sin(x / 800 * TAU * 2 + 1) * 22 - Math.sin(x / 800 * TAU * 5) * 6);
      X.lineTo(800, 120); X.closePath(); X.fill(); X.stroke();
      for (const tx of [90, 410, 690]) { const ty = 52 - Math.sin(tx / 800 * TAU * 2 + 1) * 22 - Math.sin(tx / 800 * TAU * 5) * 6;
        X.fillStyle = '#8a5a34'; X.fillRect(tx - 3, ty - 18, 6, 22);
        X.beginPath(); X.arc(tx, ty - 28, 17, 0, TAU); ink('#3fb260', 3); X.fillStyle = '#5bcf72'; el(tx - 5, ty - 34, 7, 5, -.5); X.fill(); }
    });
    JFE = tileBake(180, 60, () => {     // a fence tile (period 180): 3 pickets and a rail
      X.fillStyle = '#c4874e'; for (let i = 0; i < 3; i++) { rr(14 + i * 60, 8, 22, 50, 5); ink('#e3a868', 3); X.fillStyle = 'rgba(255,255,255,.28)'; rr(17 + i * 60, 11, 6, 40, 3); X.fill(); }
      rr(-10, 26, 200, 10, 4); ink('#c4874e', 3);
    });
    JGR = tileBake(180, 190, () => {    // the lane: grass lip, dirt, pebbles, tufts (period 180)
      X.fillStyle = INK; X.fillRect(0, 0, 180, 6);
      let g = X.createLinearGradient(0, 4, 0, 30); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(0, 4, 180, 26);
      for (const x of [20, 100, 150]) { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, 22); X.lineTo(x - 9, 12); X.moveTo(x, 22); X.lineTo(x, 9); X.moveTo(x + 6, 22); X.lineTo(x + 9, 12); X.stroke(); }
      g = X.createLinearGradient(0, 30, 0, 190); g.addColorStop(0, '#d9a867'); g.addColorStop(1, '#b97a46'); X.fillStyle = g; X.fillRect(0, 30, 180, 160);
      X.fillStyle = 'rgba(20,16,28,.1)'; X.fillRect(0, 30, 180, 8);
      for (const [x, y, rx, ry] of [[30, 70, 14, 6], [110, 100, 18, 7], [160, 62, 9, 5], [70, 140, 16, 6], [140, 150, 12, 5]]) { el(x, y, rx, ry); ink('#e6c08a', 2.5); X.fillStyle = 'rgba(255,255,255,.35)'; el(x - rx * .3, y - ry * .35, rx * .4, ry * .3); X.fill(); }
      // cart-wheel ruts
      X.strokeStyle = 'rgba(122,82,48,.45)'; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 54); X.lineTo(180, 54); X.moveTo(0, 124); X.lineTo(180, 124); X.stroke();
    });
  }
  function windmill(x, y, T, res) {
    X.save(); X.translate(x, y);
    X.beginPath(); X.moveTo(-18, 0); X.lineTo(-11, -60); X.lineTo(11, -60); X.lineTo(18, 0); X.closePath(); ink('#f4ead6', 3.5);
    X.save(); X.beginPath(); X.moveTo(-18, 0); X.lineTo(-11, -60); X.lineTo(-4, -60); X.lineTo(-6, 0); X.closePath(); X.fillStyle = '#d9c9a8'; X.fill(); X.restore();
    rr(-5, -16, 10, 16, 4); ink('#a5622c', 2.5);
    X.beginPath(); X.moveTo(-15, -58); X.lineTo(0, -80); X.lineTo(15, -58); X.closePath(); ink('#ff5a4d', 3.5);
    X.translate(0, -62); X.rotate(T * (res === 'win' ? 3 : .8));
    for (let i = 0; i < 4; i++) { X.rotate(TAU / 4); X.save(); rr(-3, -52, 6, 52, 3); ink('#c4874e', 2.5); rr(3, -50, 18, 30, 3); ink('#fffbf0', 2.5); X.restore(); }
    X.beginPath(); X.arc(0, 0, 6, 0, TAU); ink('#ffd23f', 3); X.restore();
  }
  function cow(x, y, T, mood, look) {   // a cow in shades, chewing
    X.save(); X.translate(x, y); const ch = Math.sin(T * 7) * 1.5;
    X.fillStyle = 'rgba(20,16,28,.22)'; el(0, 3, 40, 7); X.fill();
    for (const lx of [-24, -12, 12, 24]) { rr(lx - 4, -18, 8, 20, 3); ink('#fffbf0', 3); }
    rr(-34, -52, 66, 40, 14); ink('#fffbf0', 4);
    X.save(); rr(-34, -52, 66, 40, 14); X.clip(); X.fillStyle = '#2b2438'; el(-16, -42, 12, 9, .3); X.fill(); el(14, -26, 14, 10, -.2); X.fill(); X.fillStyle = 'rgba(20,16,28,.12)'; X.fillRect(-36, -26, 70, 16); X.restore();
    line([[32, -30], [44, -20 + Math.sin(T * 3) * 4]], 3, '#2b2438');
    X.translate(38, -48);
    X.beginPath(); X.moveTo(-6, -14); X.lineTo(-12, -24); X.lineTo(-2, -16); ink('#fffbf0', 2.5);
    rr(-16, -16, 36, 32, 12); ink('#fffbf0', 4);
    rr(-6, 0 + ch * .3, 28, 16, 8); ink('#ffb7c5', 3);
    X.fillStyle = INK; el(2, 7, 2, 2.4); X.fill(); el(14, 7, 2, 2.4); X.fill();
    // shades
    if (mood === 'happy') { X.lineWidth = 3; X.strokeStyle = INK; X.beginPath(); X.arc(-2, -2, 5, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); X.beginPath(); X.arc(10, -2, 5, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); heart(4, -30 - (T * 20 % 14), .6); }
    else { rr(-12, -8, 14, 9, 4); ink('#14101c', 2); rr(4, -8, 14, 9, 4); ink('#14101c', 2); X.fillStyle = 'rgba(255,255,255,.5)'; el(-8, -6, 3, 1.5, -.4); X.fill(); }
    if (mood === 'lol') { X.beginPath(); X.moveTo(-2, 8); X.lineTo(20, 8); X.lineTo(18, 14); X.lineTo(0, 14); X.closePath(); ink('#fff', 2); }
    X.restore();
  }
  function beetle(x, T, look, res, k) {   // the angry red spiky beetle (same 60×64 footprint as the old crate)
    const sc = ((x * .05) % 1 + 1) % 1, leg = Math.sin(T * 16 + k * 2);
    X.save(); X.translate(x, JGY);
    X.fillStyle = 'rgba(20,16,28,.28)'; el(0, 4, 38, 7); X.fill();
    for (const lx of [-22, -8, 8, 22]) { const w = Math.sin(T * 16 + lx * .3 + k) * 5; line([[lx, -16], [lx + w, -2]], 4, '#5a1d1d'); }
    X.translate(0, res === 'lose' ? -Math.abs(Math.sin(T * 12)) * 6 : 0);
    // spikes behind the shell
    for (let i = 0; i < 3; i++) { const sx = -22 + i * 22; X.beginPath(); X.moveTo(sx - 11, -56); X.lineTo(sx, -92); X.lineTo(sx + 11, -56); X.closePath(); ink('#ffe14d', 3.5); }
    const shell = () => rr(-30, -64, 60, 52, 24);
    cel(shell, '#ff5a4d', '#c93a3a', 4.5, -7, -6);
    X.save(); shell(); X.clip(); X.fillStyle = '#7a1f2c'; for (const [sx, sy, sr] of [[-20, -26, 5], [20, -28, 5], [0, -18, 4]]) { X.beginPath(); X.arc(sx, sy, sr, 0, TAU); X.fill(); } X.restore();
    X.fillStyle = 'rgba(255,255,255,.55)'; el(-17, -55, 8, 4, -.5); X.fill();
    // face
    const lk = [Math.max(-1, Math.min(1, look[0])), look[1]];
    for (const ex of [-12, 12]) { el(ex, -42, 8, 9); ink('#fff', 2.5); X.beginPath(); X.arc(ex + lk[0] * 3, -42 + lk[1] * 3, 4, 0, TAU); X.fillStyle = INK; X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(ex + lk[0] * 3 - 1.2, -43.5 + lk[1] * 3, 1.4, 0, TAU); X.fill(); }
    line([[-21, -56], [-5, -50]], 3.5, INK); line([[21, -56], [5, -50]], 3.5, INK);
    if (res === 'lose') { X.beginPath(); X.moveTo(-14, -30); X.quadraticCurveTo(0, -14, 14, -30); X.quadraticCurveTo(0, -26, -14, -30); ink('#fff', 2.5); }
    else { X.beginPath(); X.moveTo(-12, -26); for (let i = 0; i < 4; i++) X.lineTo(-12 + i * 8 + 4, -31 + (i % 2 ? 0 : 0)), X.lineTo(-12 + (i + 1) * 8, -26); X.lineWidth = 3; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke(); }
    X.restore();
  }
  function speedLines(scroll) {
    X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 3; X.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const x = (((-scroll * 1.8 + i * 211) % 900) + 900) % 900 - 60 - OX * 0, y = JGY + 56 + (i % 3) * 36 + i * 3; X.beginPath(); X.moveTo(x, y); X.lineTo(x + 44, y); X.stroke(); }
  }
  function jump(s) {
    X = ctx; jumpBuild(); const { scroll, py, land, obs, res, rT, T } = s, won = res === 'win', lost = res === 'lose';
    layer(JSKY);
    X.save(); X.translate(0, 0);
    sun(690, 150, 30, T);
    strip(JMT, scroll * .04, 230);
    for (let i = 0; i < 4; i++) cloud((((i * 290 - T * 14 - scroll * .08) % 1160) + 1160) % 1160 - 160, 96 + (i % 3) * 36, 1 + (i % 2) * .25);
    strip(JHL, scroll * .1, 222);
    // windmill and cow ride the meadow on a slow parallax
    const wp = 1400, wx = (((620 - scroll * .16) % wp) + wp) % wp - 200;
    windmill(wx, 352, T, res);
    const cx = Math.max(440, 690 - scroll * .12);   // slow parallax, always on screen and clear of Claude
    cow(cx, 424, T, won ? 'happy' : lost ? 'lol' : null);
    // a bird crossing the sky
    const bx = ((T * 60) % 1000) - 100, by = 120 + Math.sin(T * 2) * 10, fl = Math.sin(T * 14) * 7;
    X.lineWidth = 3; X.strokeStyle = '#3c6fb4'; X.lineCap = 'round'; X.beginPath(); X.moveTo(bx - 12, by - fl); X.quadraticCurveTo(bx - 5, by - 6, bx, by); X.quadraticCurveTo(bx + 5, by - 6, bx + 12, by - fl); X.stroke();
    strip(JFE, scroll * .6, 392);
    X.restore();
    strip(JGR, scroll, JGY - 4);
    // little ground chips flying past
    // beetles (behind Claude so the face reads)
    obs.forEach((o, i) => { if (o.x > -OX - 80 && o.x < W + OX + 80) beetle(o.x, T, [(150 - o.x) / 160, py < -30 ? -.8 : .3], res, i); });
    if (!res) speedLines(scroll);
    // Claude
    const u = 9, hop = won ? Math.abs(Math.sin(rT * 9)) * 22 : 0;
    const air = py < 0, sqx = lost ? Math.max(0, 1 - rT * 3) : 0;
    X.save(); X.fillStyle = `rgba(20,16,28,${Math.max(.08, .28 + py * .0015)})`; el(150, JGY + 6, 46 - Math.min(20, -py * .12) + (lost ? 8 : 0), 9); X.fill(); X.restore();
    X.save(); X.translate(150, JGY + py + land * 20 - hop);
    if (lost) { const sq = .72 + .28 * (1 - Math.min(1, rT * 4)); X.scale(1.12 - sq * .12 + .1, Math.max(.72, sq)); }
    else if (land > 0) X.scale(1 + land, 1 - land * 1.2);
    // arms
    X.save();
    if (won) { const w = Math.sin(T * 14) * .25; arms(u, -.5 + w, .5 - w, 1, OR); }
    else if (lost) arms(u, -1.2 + Math.sin(T * 10) * .15, 1.2, 1, OR);
    else if (air) arms(u, -.7, .7, 1, OR);
    else arms(u, .5 + Math.sin(T * 16) * .2, -.5 - Math.sin(T * 16) * .2, 1, OR);
    X.restore();
    claude(0, 0, u, { run: !air && !res ? T : null, mood: lost ? 'sad' : won ? 'happy' : null });
    X.restore();
    // after-effects
    if (air && !res) { for (let i = 0; i < 3; i++) { const d = rT; X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(110 + i * 40, JGY + py + 40 + i * 6); X.lineTo(110 + i * 40, JGY + py + 62 + i * 6); X.stroke(); } }
    if (lost) {
      stars(150, JGY - 108, 38, T); drop(215, JGY - 130 + Math.min(40, rT * 80), 1.1, Math.max(0, 1 - rT * 1.2));
      for (let i = 0; i < 4; i++) { const k = Math.min(1, rT * 1.4); X.save(); X.globalAlpha = 1 - k * .8; X.translate(150 + (i - 1.5) * 30, JGY - 20 - k * 40 - (i % 2) * 20); X.rotate(k * 3 + i); X.fillStyle = '#58c24a'; el(0, 0, 8, 3.5); X.fill(); X.restore(); }
    }
    if (won) {
      for (let i = 0; i < 6; i++) { const k = ((rT * 1.2 + i * .17) % 1); heart(80 + i * 128 + Math.sin(i * 2.1 + rT * 3) * 14, JGY - 270 - k * 200, 1.25 - k * .35); }
      for (let i = 0; i < 4; i++) { const an = T * 2.5 + i * TAU / 4; star(150 + Math.cos(an) * 150, JGY - 100 + Math.sin(an) * 90 + Math.sin(T * 6 + i) * 4, 11, 5, 5, T * 3 + i, '#FFE14D', 3); }
    }
  }
  /* ═════════════ MASH: the birthday backyard (stage 4) ═════════════
     Claude pumps a floor pump into a party balloon that gets more nervous as it swells. Win: it pops, confetti, the cat on the fence panics. */
  let MBG = null, MBW = -1;
  const MHZ = 330, MPX = 346;      // horizon / x of the pump
  function mashBg() {
    if (MBG && MBW === VW) return MBG; MBW = VW;
    return MBG = bake(() => {
      const L = -OX - 2, R = W + OX + 2;
      let g = X.createLinearGradient(0, 0, 0, MHZ); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, R - L, MHZ + 4);
      X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(L, MHZ); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 190 - Math.sin(x * .009 + 2) * 26 - Math.sin(x * .023) * 8); X.lineTo(R, MHZ); X.closePath(); X.fill();
      X.fillStyle = '#87d19b'; X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.beginPath(); X.moveTo(L, MHZ); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 238 - Math.sin(x * .014 + 5) * 18); X.lineTo(R, MHZ); X.closePath(); X.fill(); X.stroke();
      // the garden fence: planks with a pale light edge and two rails
      for (let x = L - 10, i = 0; x < R; x += 46, i++) {
        const top = 238 + (hr(i + 40) - .5) * 6; rr(x, top, 40, MHZ - top + 6, 8); ink('#e3a868', 3.5);
        X.fillStyle = '#c4874e'; rr(x + 28, top + 4, 8, MHZ - top - 2, 4); X.fill(); X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 5, top + 6, 6, 40, 3); X.fill();
      }
      for (const y of [264, 302]) { rr(L - 10, y, R - L + 20, 12, 5); ink('#c4874e', 3); X.fillStyle = 'rgba(255,255,255,.25)'; rr(L, y + 2, R - L, 3, 1.5); X.fill(); }
      X.fillStyle = INK; X.fillRect(L, MHZ, R - L, 4);
      g = X.createLinearGradient(0, MHZ, 0, H); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(L, MHZ + 4, R - L, H - MHZ);
      X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = L - 200; x < R; x += 90) { X.beginPath(); X.moveTo(x, MHZ + 4); X.lineTo(x + 40, MHZ + 4); X.lineTo(x - 120, H); X.lineTo(x - 160, H); X.closePath(); X.fill(); }
      for (let i = 0; i < 14; i++) tuft(L + hr(i + 7) * (R - L), MHZ + 30 + hr(i + 21) * 190);
      // bunting across the top (below the hint line)
      const cols = ['#ff5c8a', '#ffd23f', '#4db8ff', '#5CFF7A', '#b49cff'];
      for (const [x0, x1, y0, sag] of [[L - 10, W / 2 + 60, 70, 44], [W / 2 - 60, R + 10, 74, 40]]) {
        X.beginPath(); for (let k = 0; k <= 20; k++) { const q = k / 20; X.lineTo(lerp(x0, x1, q), y0 + Math.sin(q * Math.PI) * sag); } X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
        const n = Math.round((x1 - x0) / 46);
        for (let k = 1; k < n; k++) { const q = k / n, fx = lerp(x0, x1, q), fy = y0 + Math.sin(q * Math.PI) * sag; X.beginPath(); X.moveTo(fx - 15, fy); X.lineTo(fx + 15, fy); X.lineTo(fx, fy + 34); X.closePath(); ink(cols[k % 5], 3); }
      }
      // the party table with a cake, tucked behind the play field on the right
      const tx = 640;
      rr(tx - 4, 396, 12, 64, 4); ink('#a5622c', 3.5); rr(tx + 112, 396, 12, 64, 4); ink('#a5622c', 3.5);
      rr(tx - 26, 372, 176, 26, 10); ink('#fff', 4); X.fillStyle = '#ff9ac2'; for (let k = 0; k < 7; k++) { X.beginPath(); X.moveTo(tx - 22 + k * 24.5, 388); X.lineTo(tx - 10 + k * 24.5, 388); X.lineTo(tx - 16 + k * 24.5, 398); X.closePath(); X.fill(); }
      rr(tx + 24, 332, 76, 40, 8); ink('#ffe3a3', 4); X.fillStyle = '#c98443'; rr(tx + 24, 352, 76, 8, 3); X.fill(); rr(tx + 38, 306, 48, 28, 8); ink('#ff9ac2', 4); rr(tx + 38, 316, 48, 7, 3); X.fillStyle = '#fff'; X.fill();
      rr(tx + 59, 288, 6, 20, 2); ink('#4db8ff', 2.5);
      for (const [px, pc] of [[tx - 4, '#ff5c8a'], [tx + 130, '#5CFF7A']]) { rr(px - 4, 340, 34, 30, 5); ink(pc, 3.5); X.fillStyle = '#ffd23f'; X.fillRect(px + 9, 340, 8, 30); rr(px - 4, 334, 34, 9, 4); ink(pc, 3.5); }
    });
  }
  function mash(s) {
    X = ctx; mashBg(); const { fill, bump, tick, res, rT, T } = s, won = res === 'win', lost = res === 'lose', f = fill / 100;
    layer(mashBg());
    for (const [x, y, sc, v] of [[60, 128, 1.1, 7], [520, 160, .8, 5], [-120, 116, .9, 9], [820, 104, 1, 6]]) cloud(((x + T * v + 300) % (W + OX * 2 + 260)) - OX - 130, y, sc);
    // the cat on the fence: watches the balloon, flinches when it pops
    {
      const cx = 590, cy = 238, up = won ? ease(rT / .18) : 0, hop = won ? Math.abs(Math.sin(rT * 8)) * 14 * up : 0;
      X.save(); X.translate(cx, cy - up * 26 - hop);
      X.beginPath(); X.moveTo(26, -2); X.quadraticCurveTo(48, 0 + Math.sin(T * 3) * 6, 42, -26 + Math.sin(T * (won ? 30 : 2)) * 5); X.lineWidth = 12 + up * 6; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 7 + up * 6; X.strokeStyle = '#b8b8c8'; X.stroke();
      X.save(); X.scale(1 + up * .1, 1 + up * .22); cel(() => el(0, 0, 32, 22), '#cfd2de', '#9a9fb5', 3.5, 4, 4); glint(-10, -10, 9, 4, .45); X.restore();
      X.save(); X.translate(-26, -14 - up * 4);
      for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(sd * 6, -10); X.lineTo(sd * (14 + up * 3), -26 - up * 8); X.lineTo(sd * 16, -6); X.closePath(); ink('#cfd2de', 3); }
      cel(() => el(0, 0, 17, 14), '#d8dbe6', '#9a9fb5', 2, 2, 3);
      const em = won ? 'panic' : lost ? 'happy' : f > .6 ? 'panic' : 'idle'; eye(-6, -2, 4.6, [1, -.2 + f * -.3], em, T, 2); eye(6, -2, 4.6, [1, -.2 + f * -.3], em, T, 3);
      X.fillStyle = '#ff9ac2'; el(0, 5, 2.6, 1.8); X.fill(); X.fillStyle = 'rgba(255,110,165,.5)'; el(-11, 5, 3, 2); X.fill(); el(11, 5, 3, 2); X.fill();
      X.restore(); X.restore();
      if (won) { X.save(); X.translate(cx - 40, cy - 66 - hop); const k = outBack((rT - .05) / .2); X.scale(k, k); rr(-6, -26, 12, 24, 6); ink('#FFE14D', 3); X.beginPath(); X.arc(0, 8, 6, 0, TAU); ink('#FFE14D', 3); X.restore(); }
    }
    // table cake candle
    { const fx = 699, fy = 281; X.save(); X.translate(fx, fy); X.scale(1, 1 + Math.sin(T * 14) * .12); X.beginPath(); X.moveTo(0, 6); X.quadraticCurveTo(-8, -4, 0, -14); X.quadraticCurveTo(8, -4, 0, 6); ink('#ffd23f', 2); X.fillStyle = '#fff3a0'; el(0, 0, 2.5, 4); X.fill(); X.restore(); }
    // the floor pump (handle goes down on every stroke)
    const hk = clamp01(bump / .12), hy = 452 + hk * 26, bx = MPX, by = 520;
    shadow(bx + 10, by + 6, 62, 11, .3);
    celR(bx - 46, by - 12, 92, 18, 8, '#c9ced6', '#8f9cb3', 4, 0, 5);
    celR(bx - 15, 436, 30, by - 440, 8, '#ff5c8a', '#c93a66', 4, 5, 0);
    X.fillStyle = 'rgba(255,255,255,.4)'; rr(bx - 9, 444, 6, 52, 3); X.fill();
    rr(bx - 4, hy, 8, 450 - hy + 40, 3); ink('#c9ced6', 3);
    celR(bx - 34, hy - 12, 68, 16, 8, '#ffd23f', '#c99512', 4, 0, 4);
    // pressure dial on the pump
    X.beginPath(); X.arc(bx, 486, 13, 0, TAU); ink('#fff', 3); X.beginPath(); X.arc(bx, 486, 8, Math.PI * .75, Math.PI * 2.25); X.lineWidth = 3.5; X.strokeStyle = f > .8 ? '#ff4d5e' : '#5CFF7A'; X.stroke();
    X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; const na = Math.PI * .75 + f * Math.PI * 1.5; X.beginPath(); X.moveTo(bx, 486); X.lineTo(bx + Math.cos(na) * 8, 486 + Math.sin(na) * 8); X.stroke();
    // Claude, with a party hat and arms on the handle
    const u = 6, kx = 236, ky = 520, ang = Math.atan2(bx - 34 - (kx + 6.6 * u), -(hy - 6 - (ky - 5.2 * u)));
    const reach = Math.hypot(bx - 34 - (kx + 6.6 * u), hy - 6 - (ky - 5.2 * u)), ak = Math.max(.3, Math.min(1.6, reach / (5.65 * u)));
    shadow(kx, ky + 3, 50, 9, .3);
    X.save(); X.translate(kx, ky);
    if (won) arms(u, -2.7 + Math.sin(T * 14) * .2, 2.7 - Math.sin(T * 14) * .2, 1, OR);
    else if (lost) arms(u, -.5, .55, .9, OR);
    else arms(u, -ang * .9 - .2, ang, ak, OR);
    claude(0, 0, u, { mood: won ? 'happy' : lost ? 'sad' : null });
    X.save(); X.translate(0, -9 * u + 3 - (won ? Math.abs(Math.sin(rT * 9)) * 10 : 0)); X.rotate(won ? Math.sin(rT * 12) * .2 : -.12);
    X.beginPath(); X.moveTo(-3.2 * u, 0); X.lineTo(0, -7 * u); X.lineTo(3.2 * u, 0); X.closePath(); ink('#ffd23f', 3.5);
    X.save(); X.clip(); X.strokeStyle = '#ff5c8a'; X.lineWidth = 6; for (let i = -2; i < 4; i++) { X.beginPath(); X.moveTo(i * 12 - 26, 4); X.lineTo(i * 12 + 10, -44); X.stroke(); } X.restore();
    X.beginPath(); X.arc(0, -7 * u, 7, 0, TAU); ink('#ff5c8a', 2.5); X.restore();
    X.restore();
    if (!res && f > .55) { const q = (T * 1.4) % 1; X.save(); X.globalAlpha = 1 - q; X.translate(kx + 30, ky - 100 + q * 18); X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 1, 0, 6); X.quadraticCurveTo(-7, 1, 0, -9); X.closePath(); ink('#9fe3ff', 2.5); X.restore(); }
    // the balloon
    const r = 36 + fill * 1.5 + bump * 60, wob = Math.sin(tick * 40) * fill * .05, cx = W / 2 + wob, cy = 270 - bump * 20;
    if (!won) {
      const sag = lost ? ease(rT / .4) : 0, rr0 = r * (1 - sag * .45), cy2 = cy + sag * (r * .9);
      const ky0 = cy2 + rr0 + 6, hose = [];
      for (let k = 0; k <= 14; k++) { const q = k / 14, p0x = cx, p0y = ky0, p1x = lerp(cx, bx, .5) + 30, p1y = Math.max(ky0, 450) + 50, p2x = bx + 16, p2y = 452; hose.push([(1 - q) * (1 - q) * p0x + 2 * q * (1 - q) * p1x + q * q * p2x, (1 - q) * (1 - q) * p0y + 2 * q * (1 - q) * p1y + q * q * p2y]); }
      line(hose, 7, '#ffd23f');
      shadow(cx, 486, 40 + fill * .3, 9, .22);
      const hot = f > .8, base = hot ? '#ff2d55' : '#ff4f8b', sh = hot ? '#c01f3f' : '#d9306a';
      X.save(); X.translate(cx, cy2); X.scale(1 + (f > .6 ? Math.sin(T * 30) * .012 : 0), 1);
      cel(() => el(0, 0, rr0 * .88, rr0), base, sh, 5, rr0 * .09, rr0 * .08);
      X.fillStyle = 'rgba(255,255,255,.6)'; el(-rr0 * .38, -rr0 * .45, rr0 * .17, rr0 * .3, .5); X.fill();
      X.beginPath(); X.moveTo(-9, rr0 + 6); X.lineTo(9, rr0 + 6); X.lineTo(0, rr0 - 6); X.closePath(); ink(base, 3);
      // the face carries the joke: calm, sweating, then screaming
      const em = lost ? 'idle' : f > .78 ? 'panic' : 'idle', er = Math.max(5, rr0 * .1), lk = [-.6, .5];
      eye(-rr0 * .28, -rr0 * .05, er, lk, em, T, 4); eye(rr0 * .28, -rr0 * .05, er, lk, em, T, 5);
      X.strokeStyle = INK; X.lineWidth = Math.max(3, rr0 * .035); X.lineCap = 'round';
      if (f > .78 && !lost) { X.beginPath(); X.ellipse(0, rr0 * .26, rr0 * .08, rr0 * (.09 + Math.abs(Math.sin(T * 25)) * .03), 0, 0, TAU); X.fillStyle = INK; X.fill(); }
      else if (lost) { X.beginPath(); X.arc(0, rr0 * .34, rr0 * .12, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); }
      else if (f > .4) { X.beginPath(); X.moveTo(-rr0 * .12, rr0 * .24); for (let k = 1; k <= 4; k++) X.lineTo(-rr0 * .12 + k * rr0 * .06, rr0 * .24 + (k % 2 ? 4 : -2)); X.stroke(); }
      else { X.beginPath(); X.arc(0, rr0 * .17, rr0 * .13, Math.PI * .15, Math.PI * .85); X.stroke(); }
      X.fillStyle = 'rgba(255,255,255,.35)'; el(-rr0 * .5, rr0 * .15, rr0 * .08, rr0 * .05); X.fill();
      if (f > .4 && !lost) { X.fillStyle = 'rgba(255,255,255,.0)'; const q = (T * 2) % 1; X.save(); X.globalAlpha = 1 - q; X.translate(rr0 * .62, -rr0 * .35 + q * 16); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 1, 0, 5); X.quadraticCurveTo(-6, 1, 0, -8); X.closePath(); ink('#9fe3ff', 2); X.restore(); }
      X.restore();
    } else {
      // POP: shards of rubber, a starburst, confetti, all clear of the bottom band
      const k = clamp01(rT / .9);
      X.save(); X.translate(W / 2, 200); X.rotate(T * .4); X.fillStyle = `rgba(255,240,150,${.55 * (1 - k)})`; for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(-14, 60); X.lineTo(14, 60); X.lineTo(0, 150 + k * 60); X.fill(); } X.restore();
      const pk = outBack(rT / .22); star(W / 2, 200, 100 * pk, 52 * pk, 12, T * .6, '#FFE14D', 6); star(W / 2, 200, 70 * pk, 36 * pk, 12, -T * .5, '#fff', 0);
      for (let i = 0; i < 9; i++) { const a = hr(i + 70) * TAU, v = 160 + hr(i + 80) * 220, tt = rT; X.save(); X.translate(W / 2 + Math.cos(a) * v * tt, 240 + Math.sin(a) * v * tt + 420 * tt * tt); X.rotate(i + tt * 7); X.beginPath(); X.moveTo(-14, -6); X.quadraticCurveTo(0, -16, 16, -4); X.lineTo(8, 8); X.quadraticCurveTo(-4, 4, -14, 8); X.closePath(); ink(i % 2 ? '#ff4f8b' : '#ff2d55', 2.5); X.restore(); }
      for (let i = 0; i < 24; i++) { const cc = ['#ff5c8a', '#ffd23f', '#4db8ff', '#5CFF7A', '#b49cff'][i % 5], x = -OX + hr(i + 90) * VW, y = ((hr(i + 110) * 300 + rT * (160 + hr(i + 120) * 140)) % 520) - 20; X.save(); X.translate(x, y); X.rotate(T * 4 + i); X.fillStyle = cc; X.fillRect(-5, -2.5, 10, 5); X.restore(); }
    }
    // the control plate: PUMP! with a SPACE cap, greys out after the verdict
    {
      const px = 600 + OX * .0, py = 452, pw = 176, ph = 64, down = bump > 0 && !res, d = down ? 3 : 9, dead = !!res;
      X.save(); X.globalAlpha = dead ? .8 : 1;
      rr(px, py + 9, pw, ph, 20); ink(dead ? '#8f88a6' : '#24803a', 4); rr(px, py + 9 - d, pw, ph, 20); ink(dead ? '#d3cfe0' : '#4fd06a', 0);
      X.fillStyle = 'rgba(255,255,255,.28)'; rr(px + 10, py + 13 - d, pw - 20, 9, 4.5); X.fill(); rr(px, py + 9 - d, pw, ph, 20); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
      X.beginPath(); X.arc(px + 36, py + 9 - d + ph / 2, 18, 0, TAU); ink('#fff', 3); X.strokeStyle = dead ? '#8f88a6' : '#24803a'; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(px + 28, py + 9 - d + ph / 2 - 6); X.lineTo(px + 36, py + 9 - d + ph / 2 + 5); X.lineTo(px + 44, py + 9 - d + ph / 2 - 6); X.stroke();
      txt(won ? 'POP!' : lost ? 'FLAT...' : 'PUMP!', px + 112, py + 9 - d + (TOUCH ? ph / 2 : 24), 26, dead ? '#f6f4fb' : '#fff');
      if (!TOUCH) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText('SPACE').width + 14); rr(px + 112 - w / 2, py + 9 - d + 36, w, 22, 6); ink('#fff', 2.5); txt('SPACE', px + 112, py + 9 - d + 47, 15, INK); }
      X.restore();
    }
    vignette(.14);
  }
  /* ═════════════ CATCH: the gold mine (stage 5) ═════════════
     Gold coins and grumpy dynamite drop from the cave ceiling. Claude carries a barrel over his head on the mine track, a mole peeks
     out of its hill, lanterns swing, gems twinkle. Win: the barrel overflows, gold rains and hearts rise. Fail: the dynamite goes
     off in the barrel (soot, stars, the barrel hops away); or, if too many coins were missed, Claude sags with an empty barrel. */
  const CAHZ = 468;
  let CABG = null, CAW = -1;
  function pill(x, y, label, col) {
    X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(130, X.measureText(t(label)).width + 24);
    X.beginPath(); X.moveTo(x - 8, y + 11); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 11); X.closePath(); ink(col, 2.5);
    rr(x - w / 2, y - 12, w, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 9, w - 12, 6, 3); X.fill();
    txt(label, x, y + 1, 15, INK, 'center', w - 12);
  }
  function gem(x, y, s, col, lt) { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, -14); X.lineTo(11, -4); X.lineTo(7, 12); X.lineTo(-7, 12); X.lineTo(-11, -4); X.closePath(); ink(col, 2.5); X.fillStyle = lt; X.beginPath(); X.moveTo(0, -14); X.lineTo(-11, -4); X.lineTo(0, 0); X.closePath(); X.fill(); X.fillStyle = 'rgba(255,255,255,.7)'; el(-4, -6, 2.4, 3.4, -.5); X.fill(); X.restore(); }
  function mineBg() {
    if (CABG && CAW === VW) return CABG; CAW = VW;
    return CABG = bake(() => {
      const L = -OX - 2, R = W + OX + 2; let g = X.createLinearGradient(0, 0, 0, CAHZ); g.addColorStop(0, '#6a4a90'); g.addColorStop(1, '#a07ac2'); X.fillStyle = g; X.fillRect(L, 0, R - L, CAHZ + 4);
      // rock boulders on the far wall: lighter plum with a coloured outline
      for (let i = 0; i < 26; i++) { const x = L + hr(i + 3) * (R - L), y = 90 + hr(i + 33) * 360, rx = 34 + hr(i + 63) * 40; el(x, y, rx, rx * .62, hr(i + 9) - .5); X.fillStyle = i % 2 ? '#7d5ca3' : '#8d6bb2'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#4a3670'; X.stroke(); X.fillStyle = 'rgba(255,255,255,.12)'; el(x - rx * .3, y - rx * .2, rx * .35, rx * .15, -.4); X.fill(); }
      // gems in the wall
      for (const [x, y, s, c, l] of [[96, 190, 1.2, '#ff5c8a', '#ffb6cf'], [250, 330, 1, '#4db8ff', '#a6dcff'], [560, 150, 1.1, '#5CFF7A', '#b6ffc6'], [700, 300, 1.3, '#b49cff', '#d9ccff'], [440, 420, .9, '#ffd23f', '#fff0a0']]) gem(x, y, s, c, l);
      // timber frames
      for (let xc = 130 - 540 * 2; xc < R + 540; xc += 540) {
        if (xc < L - 120 || xc > R + 120) continue;
        for (const dx of [-92, 70]) { rr(xc + dx, 80, 22, CAHZ - 76, 4); ink('#d9944f', 4); X.fillStyle = 'rgba(255,255,255,.25)'; rr(xc + dx + 3, 86, 5, CAHZ - 90, 2); X.fill(); X.fillStyle = 'rgba(165,98,44,.5)'; X.fillRect(xc + dx + 14, 82, 6, CAHZ - 80); }
        rr(xc - 104, 66, 208, 28, 5); ink('#d9944f', 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(xc - 98, 70, 130, 5, 2.5); X.fill(); X.fillStyle = 'rgba(165,98,44,.45)'; X.fillRect(xc - 100, 84, 200, 7);
        for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(xc + sx * 82, 94); X.lineTo(xc + sx * 82 - sx * 34, 94); X.lineTo(xc + sx * 82, 128); X.closePath(); ink('#c98443', 3); }
      }
      // ceiling rock with stalactites
      X.fillStyle = '#3a2a5e'; X.beginPath(); X.moveTo(L, -4); X.lineTo(R, -4); X.lineTo(R, 52); for (let x = R; x >= L; x -= 22) X.lineTo(x - 11, 52 + (Math.floor(x / 22) % 2 ? 16 + hr(x * .1) * 18 : 4)); X.lineTo(L, 52); X.closePath(); X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
      X.fillStyle = 'rgba(255,255,255,.1)'; for (let x = L + 10; x < R; x += 70) { el(x, 14 + hr(x) * 20, 18, 5, .1); X.fill(); }
      // the dirt floor, the hard INK horizon, the track
      g = X.createLinearGradient(0, CAHZ, 0, H); g.addColorStop(0, '#dca56a'); g.addColorStop(1, '#a96e3e'); X.fillStyle = g; X.fillRect(L, CAHZ, R - L, H - CAHZ);
      X.fillStyle = INK; X.fillRect(L, CAHZ - 2, R - L, 5);
      X.fillStyle = 'rgba(120,70,30,.3)'; for (let i = 0; i < 40; i++) { el(L + hr(i + 5) * (R - L), CAHZ + 14 + hr(i + 55) * 110, 3 + hr(i + 15) * 4, 2); X.fill(); }
      for (let x = L - 20; x < R + 30; x += 56) { rr(x, 502, 36, 30, 3); ink('#b06d33', 3); X.fillStyle = 'rgba(255,255,255,.2)'; X.fillRect(x + 4, 505, 28, 3); }
      for (const ry of [510, 528]) { rr(L - 10, ry, R - L + 20, 7, 3); ink('#c9ced6', 2.5); }
      // the mole's hill and the mine cart full of gold
      X.beginPath(); X.ellipse(690, CAHZ + 6, 52, 22, 0, Math.PI, TAU); ink('#b8834f', 3.5); X.fillStyle = 'rgba(255,255,255,.2)'; el(672, CAHZ - 8, 14, 5, -.3); X.fill();
      el(690, CAHZ - 10, 18, 7); ink('#4a2f1a', 0);
      X.save(); X.translate(116, 520);
      for (let i = 0; i < 9; i++) { X.beginPath(); X.arc(-34 + i * 8.5, -62 - Math.sin(i * 1.2) * 8, 11, 0, TAU); ink('#FFC93C', 3); }
      cel(() => { X.beginPath(); X.moveTo(-58, -62); X.lineTo(58, -62); X.lineTo(46, -8); X.lineTo(-46, -8); X.closePath(); }, '#8f9cb3', '#5f6a82', 4, 6, 3);
      X.fillStyle = 'rgba(255,255,255,.35)'; rr(-50, -56, 40, 6, 3); X.fill(); rr(-62, -68, 124, 12, 5); ink('#c9ced6', 3.5);
      for (const wx of [-30, 30]) { X.beginPath(); X.arc(wx, -2, 11, 0, TAU); ink('#3b3550', 3.5); X.beginPath(); X.arc(wx, -2, 4, 0, TAU); ink('#c9ced6', 1.5); }
      X.restore();
    });
  }
  function catchGame(s) {
    X = ctx; const { items, me, caught, happy, FY, hitX, res, rT, T } = s, won = res === 'win', bomb = res === 'lose' && hitX != null, sag = res === 'lose' && !bomb;
    layer(mineBg());
    // swinging lanterns (their glow is additive) and twinkling gems
    for (const [lx, ph] of [[240, 0], [560, 1.7]]) {
      const sw = Math.sin(T * 1.6 + ph) * .14, ang = sw; X.save(); X.translate(lx, 56); X.rotate(ang);
      X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 62); X.stroke();
      rr(-13, 62, 26, 34, 6); ink('#ffd23f', 3.5); rr(-8, 69, 16, 20, 3); ink(`rgba(255,${230 + Math.sin(T * 9 + ph) * 15 | 0},150,1)`, 0); X.fillStyle = 'rgba(255,255,255,.7)'; el(-3, 74, 2, 4); X.fill();
      rr(-16, 56, 32, 9, 4); ink('#8f9cb3', 3); X.restore();
      const gx = lx + Math.sin(ang) * 80, gy = 56 + Math.cos(ang) * 80; torchGlow(gx, gy, 96, .45 + Math.sin(T * 9 + ph) * .05);
    }
    for (const [x, y, ph] of [[96, 190, 0], [560, 150, 1.2], [700, 300, 2.4]]) { const q = (T * .9 + ph) % 3; if (q < .5) star(x + 10, y - 12, 9 * Math.sin(q * Math.PI * 2), 2, 4, 0, '#fff', 0); }
    // the mole watches from its hill, ducks when the dynamite goes off
    { const mx = 690, up = bomb ? 0 : won ? 1 : clampK(Math.sin(T * 1.1) * 1.8 + .6); X.save(); X.beginPath(); X.rect(mx - 40, 360, 80, CAHZ - 360 - 4 + 0); X.clip();
      const my = CAHZ - 6 - up * 30; X.translate(mx, my); celF(() => { X.beginPath(); X.ellipse(0, -2, 17, 20, 0, 0, TAU); }, '#8a6a58', '#6a4a3a', 4, 3, 4);
      el(0, 6, 10, 8); ink('#e8b8a8', 2.5); X.beginPath(); X.arc(0, 2, 4, 0, TAU); ink('#ff8fa8', 2);
      const em = won ? 'happy' : 'idle', lk = [clampK2((me.x - mx) / 300), .2]; eye(-8, -10, 4.2, lk, em, T, 1); eye(8, -10, 4.2, lk, em, T, 2);
      X.fillStyle = INK; X.fillRect(-1, 0, 2, 3); X.restore(); }
    // coins and dynamite: shadows on the track, then the things themselves
    for (const it of items) {
      if (!it.on || it.gone) continue;
      X.fillStyle = `rgba(20,16,28,${.1 + it.y / 3000})`; el(it.x, FY + 4, 14 + it.y * .01, 4); X.fill();
      if (it.k === 't') {
        const c = () => { X.beginPath(); X.arc(it.x, it.y, 22, 0, TAU); };
        celF(c, '#FFC93C', '#d99a12', 4, 4, 4); X.beginPath(); X.arc(it.x, it.y, 15, 0, TAU); X.lineWidth = 2.5; X.strokeStyle = '#d99a12'; X.stroke();
        X.strokeStyle = OR; X.lineWidth = 5; X.lineCap = 'round'; for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4 + T * 2; X.beginPath(); X.moveTo(it.x - Math.cos(an) * 10, it.y - Math.sin(an) * 10); X.lineTo(it.x + Math.cos(an) * 10, it.y + Math.sin(an) * 10); X.stroke(); }
        glintC(c, it.x - 9, it.y - 11, 7, 3.4);
      } else {
        const c = () => { X.beginPath(); X.arc(it.x, it.y, 22, 0, TAU); };
        celF(c, '#3a3a50', '#1d1d2c', 5, 5, 4); glintC(c, it.x - 9, it.y - 11, 7, 3.4, .5);
        line([[it.x + 10, it.y - 18], [it.x + 15, it.y - 27], [it.x + 22, it.y - 30]], 4, '#c98443');
        star(it.x + 24, it.y - 33, 9 + Math.sin(T * 30) * 3, 4, 6, T * 9, '#FFE14D', 2);
        const lk = [clampK2((me.x - it.x) / 200), .5]; for (const sd of [-1, 1]) { el(it.x + sd * 8, it.y - 1, 5, 5.6); ink('#fff', 1.8); X.beginPath(); X.arc(it.x + sd * 8 + lk[0] * 1.6, it.y - 1 + lk[1] * 1.4, 2.2, 0, TAU); X.fillStyle = INK; X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(it.x + sd * 13, it.y - 11 - 1); X.lineTo(it.x + sd * 3, it.y - 7); X.stroke(); }
        X.strokeStyle = '#fff'; X.lineWidth = 2.5; X.beginPath(); X.arc(it.x, it.y + 12, 6, Math.PI * 1.15, Math.PI * 1.85); X.stroke();
      }
    }
    // Claude with the barrel overhead
    {
      const u = 8, hop = won ? Math.abs(Math.sin(rT * 9)) * 22 : 0, x = me.x, ys = sag ? 6 : 0, run = Math.abs(me.tx - me.x) > 8, sq = happy > 0 ? 1 + Math.sin((.3 - happy) / .3 * Math.PI) * -.1 : 1;
      shadowE(x, FY + 4, 56 - hop * .4, 10, .3);
      X.save(); X.translate(x, FY - hop + ys);
      // the barrel (its rim is the catch line)
      let bxo = 0, byo = 0, bro = 0;
      if (bomb) { const e = clamp01(rT / .8); bxo = (hitX < x ? 1 : -1) * 0; byo = -Math.sin(Math.min(1, rT / .5) * Math.PI) * 120 + Math.max(0, rT - .5) * 0; bro = rT * 5; }
      X.save(); X.translate(bxo, byo - 86); X.rotate(bro); X.scale(1, sq);
      const bar = () => { X.beginPath(); X.moveTo(-72, -20); X.lineTo(72, -20); X.lineTo(54, 18); X.lineTo(-54, 18); X.closePath(); };
      if (!bomb) for (let i = 0; i < Math.min(3, caught) + (won ? 3 : 0); i++) { X.beginPath(); X.arc(-36 + i * 24 + (i % 2) * 8, -26 - (i % 2) * 8, 13, 0, TAU); ink('#FFC93C', 3); }
      celF(bar, '#d9944f', '#a5622c', 6, 0, 4.5); el(0, -20, 72, 8); ink('#8a5530', 3.5); X.save(); bar(); X.clip(); X.fillStyle = '#8f9cb3'; X.strokeStyle = INK; X.lineWidth = 2.5; for (const hy of [-8, 8]) { X.fillRect(-80, hy - 3, 160, 6); X.strokeRect(-80, hy - 3, 160, 6); } X.restore();
      X.fillStyle = 'rgba(255,255,255,.4)'; el(-40, -6, 9, 3, -.3); X.fill();
      if (bomb && rT > .15) { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-10, -20); X.lineTo(-2, -6); X.lineTo(-14, 6); X.moveTo(24, -20); X.lineTo(16, -4); X.stroke(); }
      X.restore();
      // arms up gripping the barrel, then the body
      if (won) arms(u, -.5 - Math.sin(T * 14) * .1, .5 + Math.sin(T * 14) * .1, 1, OR); else if (bomb) arms(u, -2.6 + Math.sin(T * 25) * .3, 2.6 - Math.sin(T * 25) * .3, 1, '#4a4452'); else if (sag) arms(u, -.2, .3, .7, OR); else arms(u, -.45, .45, 1, OR);
      claude(0, 0, u, { mood: won ? 'happy' : res === 'lose' ? 'sad' : happy > 0 ? 'happy' : null, run: run && !res ? T : null, col: bomb ? '#4a4452' : OR });
      X.restore();
      if (!res) pill(x, FY - 134, 'YOU', '#FFE14D');
      if (bomb) { stars(x, FY - 110, 34, T); const pk = outBack(rT / .22), k = clamp01(rT / .6); X.globalAlpha = 1 - k * .8; star(x, FY - 70, 110 * pk, 54 * pk, 12, T * .8, '#ff9a3a', 6); star(x, FY - 70, 74 * pk, 36 * pk, 12, -T * .6, '#FFE14D', 0); star(x, FY - 70, 40 * pk, 20 * pk, 10, T, '#fff', 0); X.globalAlpha = 1;
        for (let i = 0; i < 5; i++) { const q = (rT * .9 + i * .2) % 1; X.save(); X.globalAlpha = (1 - q) * .8; X.beginPath(); X.arc(x - 30 + i * 15 + q * 20, FY - 120 - q * 80, 12 + q * 16, 0, TAU); ink('#6b6580', 2.5); X.restore(); } }
      if (sag) drop(x + 40, FY - 120, 1.2, 1);
      if (won) for (let i = 0; i < 5; i++) { const q = (rT * 1.1 + i * .2) % 1; X.save(); X.globalAlpha = 1 - q; heart(x + (i - 2) * 38, FY - 160 - q * 70, 1 - q * .3); X.restore(); }
    }
    if (won) for (let i = 0; i < 14; i++) { const x = -OX + 40 + hr(i + 90) * (VW - 80), y = ((hr(i + 110) * 200 + rT * (230 + hr(i + 120) * 120)) % 480) + 20; X.save(); X.translate(x, y); X.rotate(T * 5 + i); X.beginPath(); X.arc(0, 0, 9, 0, TAU); ink('#FFC93C', 2.5); X.restore(); }
    // the ore sign: three coin slots fill as you collect
    {
      const sx = 400 - 78;
      X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(sx + 22, 62); X.lineTo(sx + 22, 84); X.moveTo(sx + 134, 62); X.lineTo(sx + 134, 84); X.stroke();
      X.fillStyle = 'rgba(20,16,28,.3)'; rr(sx + 4, 84 + 6, 156, 42, 14); X.fill(); celF(() => rr(sx, 84, 156, 42, 14), '#d9944f', '#a5622c', 0, 5, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(sx + 8, 88, 100, 5, 2.5); X.fill();
      for (let k = 0; k < 3; k++) { const cx = sx + 32 + k * 46, cy = 106; X.beginPath(); X.arc(cx, cy, 14, 0, TAU); ink('#6b4a2a', 3); if (k < caught || won) { const p = k === caught - 1 ? outBack((.3 - happy) / .3 + .0) : 1; X.save(); X.translate(cx, cy); X.scale(.4 + .6 * clamp01(p), .4 + .6 * clamp01(p)); X.beginPath(); X.arc(0, 0, 12, 0, TAU); ink('#FFC93C', 2.5); X.fillStyle = OR; X.fillRect(-1.5, -6, 3, 12); X.fillRect(-6, -1.5, 12, 3); X.restore(); } }
    }
    vignette(.16);
  }
  function clampK(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clampK2(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
  function celF(path, base, shade, sx, sy, o = 4) { path(); ink(shade, o); X.save(); path(); X.clip(); X.translate(-sx, -sy); path(); X.fillStyle = base; X.fill(); X.restore(); }
  function glintC(path, x, y, rx, ry, a = .45) { X.save(); path(); X.clip(); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, -.5); X.fill(); X.restore(); }
  function shadowE(x, y, rx, ry, a) { X.fillStyle = `rgba(20,16,28,${a})`; X.beginPath(); X.ellipse(x, y, rx, ry, 0, 0, TAU); X.fill(); }
  return { swat, spot, type, jump, mash, catchGame };
})();

/* 1 ── SWAT: click the bugs (mouse) */
function gSwat(sp) {
  const n = 3 + (sp > 1.4) + (sp > 1.9);
  const bugs = Array.from({ length: n }, () => ({
    x: -OX + 120 + Math.random() * (VW - 240), y: 130 + Math.random() * 330, a: Math.random() * 6.28,
    v: (140 + Math.random() * 60) * sp, dead: 0, turn: 0
  }));
  const splats = [], pings = [];
  let rT0 = -1;                                             // art only: when the result landed (for the ending gags)
  const g = {
    wide: true, cmd: 'SWAT!', hint: 'CLICK THE BUGS', thint: 'TAP THE BUGS', dur: 5,
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      for (const s of splats) if (s.t0 == null) s.t0 = now;   // art only: splat age
      pings.forEach(p => p.t += dt);
      if (g.result) return;
      for (const b of bugs) {
        if (b.dead) continue;
        b.turn -= dt; if (b.turn < 0) { b.a += (Math.random() - .5) * 2.4; b.turn = .25 + Math.random() * .5; }
        b.x += Math.cos(b.a) * b.v * dt; b.y += Math.sin(b.a) * b.v * dt;
        if (b.x < 50 - OX) { b.x = 50 - OX; b.a = Math.PI - b.a } if (b.x > 750 + OX) { b.x = 750 + OX; b.a = Math.PI - b.a }
        if (b.y < 100) { b.y = 100; b.a = -b.a } if (b.y > 500) { b.y = 500; b.a = -b.a }
      }
    },
    down(p) {
      pings.push({ x: p.x, y: p.y, t: 0 });
      let hit = false;
      for (const b of bugs) if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < 44) { b.dead = 1; hit = true; splats.push({ x: b.x, y: b.y, r: Math.random() * 6 }); burst(b.x, b.y, '#e8433a', 12); ring(b.x, b.y, '#fff', 70); floatText('SPLAT!', b.x, b.y - 30, '#FFE14D', 30); }
      if (hit) { sfx.splat(); sfx.hit(); shake(5, .15); } else sfx.miss();
      if (bugs.every(b => b.dead)) { g.result = 'win'; sfx.sparkle(); }
    },
    draw() { if (g.result && rT0 < 0) rT0 = now; W1A.swat({ bugs, splats, pings, res: g.result, rT: now - rT0, T: now }); }
  };
  return g;
}

/* 2 ── JUMP: hop over the bugs (space / up / click) */
function gJump(sp) {
  const spd = 420 * sp, GY = 450;
  let py = 0, vy = 0, scroll = 0, land = 0, rT0 = -1;
  const obs = [{ x: W + OX + 60 }, { x: W + OX + 60 + (500 + Math.random() * 80) * sp }];
  const g = {
    wide: true, cmd: 'JUMP!', hint: 'SPACE OR CLICK TO JUMP', thint: 'TAP TO JUMP', dur: 4.4, timeWin: true,
    jump() { if (py === 0 && !g.result) { vy = -960; sfx.boing(); sfx.whoosh(); burst(150, GY, '#c9e8a0', 6, 140); } },
    key(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') g.jump(); },
    down() { g.jump(); },
    update(dt) {
      if (g.result) return;
      scroll += spd * dt;
      vy += 2600 * dt; py += vy * dt; if (py >= 0) { if (vy > 300) { sfx.thud(); burst(150, GY, '#c9e8a0', 5, 120); land = .15; } py = 0; vy = 0; }
      land = Math.max(0, land - dt);
      for (const o of obs) {
        o.x -= spd * dt;
        if (Math.abs(o.x - 150) < 28 + 50 && py > -64) { g.result = 'lose'; sfx.buzz(); sfx.thud(); shake(10, .3); burst(150, GY - 30, '#ff5a4d', 14); }
        else if (!o.passed && o.x < 90 && !g.result) { o.passed = 1; sfx.blip(7); floatText('NICE!', 150, GY - 140, '#5CFF7A', 30); }
      }
    },
    draw() { if (g.result && rT0 < 0) rT0 = now; W1A.jump({ scroll, py, land, obs, res: g.result, rT: now - rT0, T: now }); }
  };
  return g;
}

/* 3 ── TYPE: type the word (keyboard) */
function gType(sp, forced) {
  const pool = sp < 1.2 ? ['BUG', 'FIX', 'SHIP', 'CODE'] : ['BUG', 'FIX', 'SHIP', 'CODE', 'DEBUG', 'MERGE', 'PUSH', 'TEST', 'CLAUDE', 'TOKEN'];
  const w = forced || pool[Math.random() * pool.length | 0];
  let i = 0, shk = 0;
  let el = 0, rT0 = -1, lastI = 0, tapT = -9, taps = 0, missT = -9, lastShk = 0;   // art only (animation timing)
  const artT = dt => {
    if (!g.result) el += dt; else if (rT0 < 0) rT0 = now;
    if (i !== lastI) { lastI = i; tapT = now; taps++; }
    if (shk > lastShk) missT = now; lastShk = shk;
  };
  const uniq = [...new Set(w.split(''))];
  const extra = shuffle('ETAOINSHRDLUCMFWYPBGVK'.split('').filter(c => !uniq.includes(c))).slice(0, Math.max(0, 10 - uniq.length));
  const pad = shuffle(uniq.concat(extra));              // on-screen letters for touch devices
  const padRect = j => ({ x: 40 + (j % 5) * 124, y: 405 + (j / 5 | 0) * 66, w: 110, h: 56 });
  const press = k => {
    if (g.result) return;
    if (k === w[i]) { const bx = (W - (w.length * (w.length > 6 ? 74 : 108) - (w.length > 6 ? 8 : 12))) / 2 + i * (w.length > 6 ? 74 : 108) + (w.length > 6 ? 33 : 48); i++; sfx.blip(i * 2); burst(bx, 240, '#5CFF7A', 8, 200); if (i === w.length) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(W / 2, 240, 40); } }
    else { shk = .25; sfx.miss(); shake(5, .15); }
  };
  const g = {
    wide: true, cmd: 'TYPE!', hint: 'TYPE THE WORD', dur: 5.5,
    key(e) { if (e.key && e.key.length === 1) press(e.key.toUpperCase()); },
    down(p) {
      if (!TOUCH) return;
      pad.forEach((c, j) => { const r = padRect(j); if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) press(c); });
    },
    update(dt) { shk = Math.max(0, shk - dt); artT(dt); },
    draw() {   // art: W1A.type (the royal typing chamber); artT() only drives animation
      artT(0);
      const durE = g.boss ? g.dur : g.dur / Math.sqrt(sp);
      W1A.type({ w, i, shk, pad, padRect, boss: !!g.boss, res: g.result, rT: now - rT0, T: now, frac: Math.min(1, el / durE), tapT, taps, missT });
    }
  };
  return g;
}

/* 4 ── SPOT: find the odd one out (mouse) */
function gSpot(sp) {
  const cols = sp < 1.3 ? 4 : sp < 1.6 ? 5 : 6, rows = 3, y0 = 60;
  const cw = W / cols, ch = 450 / rows, u = Math.min(cw / 15, ch / 13);
  const odd = Math.random() * cols * rows | 0;
  const dh = sp < 1.3 ? 150 : sp < 1.6 ? 70 : 32;
  const base = 'hsl(15,68%,60%)', oddC = `hsl(${15 + dh},68%,60%)`;
  let pick = -1, rT0 = -1;
  const g = {
    wide: true, cmd: 'SPOT IT!', hint: 'FIND THE ODD ONE', thint: 'TAP THE ODD ONE', dur: 4.5,
    down(p) {
      const c = Math.floor(p.x / cw), r = Math.floor((p.y - y0) / ch);
      if (p.y < y0 || c < 0 || c >= cols || r < 0 || r >= rows) return;
      pick = r * cols + c; g.result = pick === odd ? 'win' : 'lose';
      const px = cw * c + cw / 2, py = y0 + ch * r + ch / 2;
      if (pick === odd) { sfx.coin(); sfx.sparkle(); burst(px, py, '#FFE14D', 16); ring(px, py, '#fff', 100); floatText('FOUND IT!', px, py - 40, '#5CFF7A', 36); } else { sfx.buzz(); shake(6, .2); burst(px, py, '#FF4D4D', 8); }
    },
    update() { if (g.result && rT0 < 0) rT0 = now; },     // art only: when the result landed
    draw() { if (g.result && rT0 < 0) rT0 = now; W1A.spot({ cols, rows, cw, ch, y0, u, odd, pick, oddC, base, res: g.result, rT: now - rT0, T: now }); }
  };
  return g;
}

/* 5 ── MASH: pump the balloon (space or click) */
function gMash(sp) {
  let fill = 0, bump = 0, tick = 0, rT0 = -1;   // rT0: art only
  const g = {
    wide: true, cmd: 'MASH!', hint: 'MASH SPACE OR CLICK', thint: 'TAP TAP TAP!', dur: 4.5,
    pump() {
      if (g.result) return;
      fill += 7.5; bump = .12; snd(220 + fill * 5, .06, 'square', .06); sfx.click(); if (fill > 70) noise(.06, .03, 2000, 4000, 'highpass');
      if (fill >= 100) { fill = 100; g.result = 'win'; confetti(W / 2, 260, 50); sfx.pop(); sfx.stamp(); shake(14, .4); ring(W / 2, 260, '#fff', 200, .5); burst(W / 2, 260, '#FF4D9E', 24, 400); }
    },
    key(e) { if (e.code === 'Space') g.pump(); },
    down() { g.pump(); },
    update(dt) { if (g.result && rT0 < 0) rT0 = now; tick += dt; bump = Math.max(0, bump - dt); if (!g.result) fill = Math.max(0, fill - 14 * sp * dt); },
    draw() { if (g.result && rT0 < 0) rT0 = now; W1A.mash({ fill, bump, tick, res: g.result, rT: now - rT0, T: now }); }
  };
  return g;
}

/* 6 ── CATCH: collect tokens, dodge bombs (mouse or arrows / A D) */
function gCatch(sp) {
  const FY = 528;
  const kinds = ['t', 't', 't', 'b', 'b'].sort(() => Math.random() - .5);
  const items = kinds.map((k, i) => ({ k, x: -OX + 90 + Math.random() * (VW - 180), y: -40, at: .2 + i * .6 / sp, on: false }));
  const me = { x: W / 2, tx: W / 2 };
  let caught = 0, happy = 0, clock = 0, hitX = null, rT0 = -1;   // hitX, rT0: art only
  const g = {
    wide: true, cmd: 'CATCH!', hint: 'MOUSE OR ARROWS', thint: 'DRAG LEFT AND RIGHT', dur: 5.2,
    move(p) { me.tx = p.x; },
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      happy = Math.max(0, happy - dt);
      if (g.result) return;
      clock += dt;
      if (keys.ArrowLeft || keys.KeyA) me.tx -= 760 * VW / W * dt;
      if (keys.ArrowRight || keys.KeyD) me.tx += 760 * VW / W * dt;
      me.tx = Math.max(60 - OX, Math.min(740 + OX, me.tx));
      me.x += (me.tx - me.x) * Math.min(1, 18 * dt);
      for (const it of items) {
        if (!it.on && clock >= it.at) it.on = true;
        if (!it.on || it.gone) continue;
        it.y += 380 * sp * dt;
        if (it.y + 22 >= FY - 100 && it.y - 22 <= FY && Math.abs(it.x - me.x) < 64 + 11) {
          it.gone = true;
          if (it.k === 'b') { g.result = 'lose'; hitX = it.x; confetti(it.x, it.y, 20); sfx.splat(); sfx.thud(); sfx.buzz(); shake(12, .35); ring(it.x, it.y, '#FFE14D', 120); }
          else { caught++; happy = .3; sfx.coin(); sfx.blip(caught * 3); burst(it.x, it.y, '#FFC93C', 10); floatText('+1', it.x, it.y - 30, '#FFE14D', 34); if (caught >= 3) { g.result = 'win'; sfx.sparkle(); } }
        } else if (it.y > H + 30) it.gone = true;
      }
      const left = items.filter(i => i.k === 't' && !i.gone).length;
      if (caught + left < 3) g.result = 'lose';
    },
    draw() { if (g.result && rT0 < 0) rT0 = now; W1A.catchGame({ items, me, caught, happy, FY, hitX, res: g.result, rT: now - rT0, T: now }); }
  };
  return g;
}

reg('swat', gSwat, 'SWAT');
reg('jump', gJump, 'JUMP');
reg('type', gType, 'TYPE');
reg('spot', gSpot, 'SPOT IT');
reg('mash', gMash, 'MASH');
reg('catch', gCatch, 'CATCH');
