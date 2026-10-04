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
  return { swat, spot };
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
  let py = 0, vy = 0, scroll = 0, land = 0;
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
    draw(t) {
      bg('#6EC6FF', '#5fb8f5', t);
      const cn = Math.ceil((VW + 240) / 260), cp = cn * 260;
      for (let i = 0; i < cn; i++) { const cx = ((i * 260 - scroll * .25) % cp + cp) % cp - 120 - OX; circ(cx, 110 + i * 25, 28, '#fff', 4); circ(cx + 34, 120 + i * 25, 22, '#fff', 4); circ(cx - 34, 124 + i * 25, 20, '#fff', 4); }
      ctx.fillStyle = INK; ctx.fillRect(-OX, GY - 4, VW, 160);
      ctx.fillStyle = '#58c24a'; ctx.fillRect(-OX, GY, VW, 26);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(-OX, GY + 26, VW, 140);
      ctx.fillStyle = '#6a4526';
      const dn = Math.ceil((VW + 120) / 90), dp = dn * 90;
      for (let i = 0; i < dn; i++) ctx.fillRect(((i * 90 - scroll) % dp + dp) % dp - 60 - OX, GY + 60 + (i % 3) * 30, 40, 10);
      for (const o of obs) {
        for (let i = 0; i < 3; i++) { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(o.x - 32 + i * 22 - 4, GY - 62); ctx.lineTo(o.x - 21 + i * 22, GY - 92); ctx.lineTo(o.x - 10 + i * 22 + 4, GY - 62); ctx.fill();
          ctx.fillStyle = '#ff5a4d'; ctx.beginPath(); ctx.moveTo(o.x - 29 + i * 22, GY - 64); ctx.lineTo(o.x - 21 + i * 22, GY - 86); ctx.lineTo(o.x - 13 + i * 22, GY - 64); ctx.fill(); }
        box(o.x - 30, GY - 64, 60, 64, '#ff5a4d', 4);
        txt('!', o.x, GY - 32, 44, '#fff');
      }
      shadow(150, GY + 6, 46 - Math.min(20, -py * .12), 9, Math.max(.08, .28 + py * .0015));
      claude(150, GY + py + land * 20, 9, { run: py === 0 && !g.result ? now : null, mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null });
    }
  };
  return g;
}

/* 3 ── TYPE: type the word (keyboard) */
function gType(sp, forced) {
  const pool = sp < 1.2 ? ['BUG', 'FIX', 'SHIP', 'CODE'] : ['BUG', 'FIX', 'SHIP', 'CODE', 'DEBUG', 'MERGE', 'PUSH', 'TEST', 'CLAUDE', 'TOKEN'];
  const w = forced || pool[Math.random() * pool.length | 0];
  let i = 0, shk = 0;
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
    update(dt) { shk = Math.max(0, shk - dt); },
    draw(t) {
      bg('#FF8FD0', '#ff7cc6', t);
      const n = w.length, sz = n > 6 ? 66 : 96, gap = n > 6 ? 8 : 12, tot = n * sz + (n - 1) * gap, x0 = (W - tot) / 2;
      const sx = Math.sin(now * 80) * shk * 40;
      for (let k = 0; k < n; k++) {
        const done = k < i, cur = k === i && !g.result;
        shadow(x0 + k * (sz + gap) + sx + sz / 2 + 6, 190 + sz + 12, sz * .5, 8, .2);
        const y = 190 - (cur ? Math.abs(Math.sin(now * 8)) * 12 : 0);
        box3(x0 + k * (sz + gap) + sx, y, sz, sz, done ? '#5CFF7A' : cur ? '#FFE14D' : '#fff', 5, 6);
        txt(w[k], x0 + k * (sz + gap) + sz / 2 + sx, y + sz / 2 + 4, sz * .66, done ? '#fff' : INK);
      }
      if (TOUCH) {
        pad.forEach((c, j) => { const r = padRect(j); box(r.x, r.y, r.w, r.h, '#fff', 5); txt(c, r.x + r.w / 2, r.y + r.h / 2 + 2, 38, INK); });
        claude(W - 70, 370, 5, { mood: g.result === 'win' ? 'happy' : null });
      } else {
        claude(W / 2, 470, 9, { mood: g.result === 'win' ? 'happy' : null });
        box(W / 2 - 200, 462, 400, 70, '#3c3c4e', 5);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 11; c++) {
          const hot = ((now * 14 | 0) + r * 3 + c) % 7 === 0 && !g.result;
          ctx.fillStyle = hot ? '#FFE14D' : '#8a8aa0'; ctx.fillRect(W / 2 - 188 + c * 34, 472 + r * 19, 28, 14);
        }
      }
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
  let fill = 0, bump = 0, tick = 0;
  const g = {
    wide: true, cmd: 'MASH!', hint: 'MASH SPACE OR CLICK', thint: 'TAP TAP TAP!', dur: 4.5,
    pump() {
      if (g.result) return;
      fill += 7.5; bump = .12; snd(220 + fill * 5, .06, 'square', .06); sfx.click(); if (fill > 70) noise(.06, .03, 2000, 4000, 'highpass');
      if (fill >= 100) { fill = 100; g.result = 'win'; confetti(W / 2, 260, 50); sfx.pop(); sfx.stamp(); shake(14, .4); ring(W / 2, 260, '#fff', 200, .5); burst(W / 2, 260, '#FF4D9E', 24, 400); }
    },
    key(e) { if (e.code === 'Space') g.pump(); },
    down() { g.pump(); },
    update(dt) { tick += dt; bump = Math.max(0, bump - dt); if (!g.result) fill = Math.max(0, fill - 14 * sp * dt); },
    draw(t) {
      bg('#FFD23F', '#ffc61a', t);
      claude(W / 2, 545, 8, { mood: g.result === 'win' ? 'happy' : null });
      if (g.result === 'win') {
        star(W / 2, 260, 240, 140, 14, now * .5, '#fff', 6);
        star(W / 2, 260, 200, 110, 14, -now * .4, '#FF4D9E', 0);
        txt('POP!', W / 2, 260, 120, '#FFE14D');
        return;
      }
      shadow(W / 2, 486, 40 + fill * .3, 9, .22);
      const r = 36 + fill * 1.5 + bump * 60, cx = W / 2 + Math.sin(tick * 40) * fill * .05, cy = 270 - bump * 20;
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy + r); ctx.lineTo(W / 2, 478); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, r * .88, r, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, r * .88 - 5, r - 5, 0, 0, 7); ctx.fillStyle = fill > 80 ? '#ff2d55' : '#ff4f8b'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, r * .65, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cx - 10, cy + r + 10); ctx.lineTo(cx + 10, cy + r + 10); ctx.lineTo(cx, cy + r - 4); ctx.fill();
    }
  };
  return g;
}

/* 6 ── CATCH: collect tokens, dodge bombs (mouse or arrows / A D) */
function gCatch(sp) {
  const FY = 528;
  const kinds = ['t', 't', 't', 'b', 'b'].sort(() => Math.random() - .5);
  const items = kinds.map((k, i) => ({ k, x: -OX + 90 + Math.random() * (VW - 180), y: -40, at: .2 + i * .6 / sp, on: false }));
  const me = { x: W / 2, tx: W / 2 };
  let caught = 0, happy = 0, clock = 0;
  const g = {
    wide: true, cmd: 'CATCH!', hint: 'MOUSE OR ARROWS', thint: 'DRAG LEFT AND RIGHT', dur: 5.2,
    move(p) { me.tx = p.x; },
    update(dt) {
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
          if (it.k === 'b') { g.result = 'lose'; confetti(it.x, it.y, 20); sfx.splat(); sfx.thud(); sfx.buzz(); shake(12, .35); ring(it.x, it.y, '#FFE14D', 120); }
          else { caught++; happy = .3; sfx.coin(); sfx.blip(caught * 3); burst(it.x, it.y, '#FFC93C', 10); floatText('+1', it.x, it.y - 30, '#FFE14D', 34); if (caught >= 3) { g.result = 'win'; sfx.sparkle(); } }
        } else if (it.y > H + 30) it.gone = true;
      }
      const left = items.filter(i => i.k === 't' && !i.gone).length;
      if (caught + left < 3) g.result = 'lose';
    },
    draw(t) {
      bg('#2A1B5C', '#34236e', t);
      ctx.fillStyle = '#fff'; for (let i = 0; i < (24 * VW / W | 0); i++) ctx.fillRect((i * 97) % VW - OX, (i * 53 + now * 30 * (1 + i % 3)) % 520, 3, 3);
      shadow(me.x, FY + 4, 56, 10, .3);
      for (const it of items) {
        if (!it.on || it.gone) continue;
        shadow(it.x, FY + 4, 14 + it.y * .01, 4, .1 + it.y / 3000);
        if (it.k === 't') {
          circ(it.x, it.y, 22, '#FFC93C', 4);
          ctx.strokeStyle = OR; ctx.lineWidth = 5; ctx.lineCap = 'round';
          for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4 + now * 2; ctx.beginPath(); ctx.moveTo(it.x - Math.cos(an) * 12, it.y - Math.sin(an) * 12); ctx.lineTo(it.x + Math.cos(an) * 12, it.y + Math.sin(an) * 12); ctx.stroke(); }
          ctx.lineCap = 'butt';
        } else {
          circ(it.x, it.y, 22, '#2b2b3a', 4);
          ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(it.x + 10, it.y - 18); ctx.lineTo(it.x + 20, it.y - 32); ctx.stroke();
          star(it.x + 21, it.y - 34, 9 + Math.sin(now * 30) * 3, 4, 6, now * 9, '#FFE14D', 2);
          ctx.fillStyle = '#fff'; ctx.fillRect(it.x - 10, it.y - 8, 6, 6);
        }
      }
      claude(me.x, FY, 8, { mood: g.result === 'lose' ? 'sad' : (happy > 0 || g.result === 'win') ? 'happy' : null, run: Math.abs(me.tx - me.x) > 8 ? now : null });
      for (let k = 0; k < 3; k++) circ(W + OX - 100 + k * 36, 90, 12, k < caught ? '#FFC93C' : '#3d2f7a', 3);
    }
  };
  return g;
}

reg('swat', gSwat, 'SWAT');
reg('jump', gJump, 'JUMP');
reg('type', gType, 'TYPE');
reg('spot', gSpot, 'SPOT IT');
reg('mash', gMash, 'MASH');
reg('catch', gCatch, 'CATCH');
