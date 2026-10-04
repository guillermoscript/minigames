'use strict';
/* Wave 3 — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* ───────────── art kit for WHACK + DODGE: the DUO look (docs/ART-STYLE.md). A local copy of the DUO drawing helpers.
   Everything draws on X, which can be swapped for an offscreen context so the same code bakes the static scene once.
   Cosmetic only: nothing here calls Math.random, so the seeded game RNG is never touched. ───────────── */
const W3K = (() => {
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
  const K = { TAU };
  K.cx = () => X;
  const clamp = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
  const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const inkP = K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  const cel = K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  const PE = {}; const pEl = K.pEl = (x, y, rx, ry) => { const k = x + ',' + y + ',' + rx + ',' + ry; if (!PE[k]) { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); PE[k] = p; } return PE[k]; };
  const line = K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  const starP = K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
  K.heart = (x, y, s, a = 1) => {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  };
  K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
  K.zee = (x, y, s, a) => {
    X.save(); X.globalAlpha = clamp(a, 0, 1); X.translate(x, y); X.scale(s, s); X.lineJoin = 'round'; X.lineCap = 'round';
    X.beginPath(); X.moveTo(-6, -7); X.lineTo(6, -7); X.lineTo(-6, 7); X.lineTo(6, 7); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.restore();
  };
  /* blocky Claude arms (hippo.js): call with the origin at Claude's feet, before claude() */
  K.arms = (u, la, ra, k, col = OR) => {
    if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
    const one = (sx, an) => {
      X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
      X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
      X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
    };
    one(-1, la); one(1, ra);
  };
  /* crane.js eye: sclera, pupil looking at the action, white dot, blink, moods */
  let LINE = null;                    // colour of line-style eyes (white on the bug's dark head); null = INK
  const eye = K.eye = (x, y, r, mood, look, T, k) => {
    X.lineCap = 'round';
    if (mood === 'happy' || mood === 'rasp' && k) { X.lineWidth = r * .55; X.strokeStyle = LINE || INK; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
    if (mood === 'bonk' || mood === 'sleep') { X.lineWidth = r * .5; X.strokeStyle = LINE || INK; X.beginPath(); if (mood === 'sleep') X.arc(x, y - r * .2, r * .7, Math.PI * .15, Math.PI * .85); else { const d = k ? -1 : 1; X.moveTo(x - r * .7 * d, y - r * .5); X.lineTo(x + r * .4 * d, y); X.lineTo(x - r * .7 * d, y + r * .5); } X.stroke(); return; }
    const big = mood === 'panic' ? 1.3 : 1;
    el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(1.5, r * .28));
    if (mood === 'dizzy') { X.strokeStyle = INK; X.lineWidth = Math.max(1.5, r * .22); X.beginPath(); for (let i = 0; i < 24; i++) { const a = i * .55 * (k ? -1 : 1) + T * 9 * (k ? -1 : 1), q = i / 24 * r * .85; X.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } X.stroke(); return; }
    if (mood !== 'panic' && Math.sin(T * 1.9 + k * .2 + x * .01) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
    const pr = mood === 'panic' ? r * .32 : r * .52, lx = clamp(look[0], -1, 1) * r * .38, ly = clamp(look[1], -1, 1) * r * .38;
    X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
    X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .38, pr * .32); X.fill();
  };
  /* a fluffy 4-puff cloud (hippo sky) */
  K.cloud = (x, y, s) => {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
  };
  K.sun = (sx, sy, T) => {
    X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 40); X.lineTo(8, 40); X.lineTo(0, 70); X.fill(); }
    X.restore(); X.beginPath(); X.arc(sx, sy, 32, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 10, sy - 10, 12, 8, -.6); X.fill();
  };
  /* "that's you" tag with no words (the solo games have no YOU string): a gold pill with a star and a pointer */
  K.tag = (x, y, col = '#FFE14D') => {
    X.beginPath(); X.moveTo(x - 8, y + 10); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 10); X.closePath(); ink(col, 3);
    rr(x - 22, y - 12, 44, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - 16, y - 9, 32, 6, 3); X.fill();
    starP(x, y + 1, 8.5, 4, 5, -Math.PI / 2, '#fff', 2);
  };
  /* ── the bug: a cel-shaded ladybug with a big expressive face. Local coords: head toward -y, ~±32 wide.
     o: { mood: idle|angry|smug|rasp|panic|dizzy|happy|bonk|sleep, look: [lx, ly], T, chomp } ── */
  K.bug = (x, y, rot, sc, legT, o = {}) => {
    const BODY = pEl(0, 4, 22, 27), HEAD = pEl(0, -24, 17, 13);
    const T = o.T || 0, mood = o.mood || 'idle', look = o.look || [0, -1];
    X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc * (o.sx || 1), sc * (o.sy || 1));
    X.lineCap = 'round'; X.lineJoin = 'round';
    for (const i of [-1, 0, 1]) for (const s of [-1, 1]) {
      const w = Math.sin(legT * 25 + i * 2 + s) * 8;
      X.beginPath(); X.moveTo(s * 12, i * 12 + 2); X.quadraticCurveTo(s * 26, i * 12 - 6 + w * .3, s * 33, i * 12 + 4 + w);
      X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#5a4a72'; X.stroke();
    }
    for (const s of [-1, 1]) {
      const w = Math.sin(T * 7 + s) * 3 + (mood === 'panic' ? Math.sin(T * 40 + s) * 3 : 0);
      X.beginPath(); X.moveTo(s * 6, -34); X.quadraticCurveTo(s * 8, -48, s * 17 + w, -51); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.5; X.strokeStyle = '#5a4a72'; X.stroke();
      X.beginPath(); X.arc(s * 17 + w, -51, 4.5, 0, TAU); ink('#ff4d5e', 2);
    }
    cel(BODY, '#ef4438', '#b42a33', 5, 4, 4);
    X.save(); X.clip(BODY); X.fillStyle = INK;
    for (const [a, b, r] of [[-11, -4, 5], [11, 2, 5.5], [-9, 15, 4.5], [10, 18, 4], [-14, 6, 3], [14, -10, 3.5]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fill(); }
    X.restore();
    X.beginPath(); X.moveTo(0, -16); X.lineTo(0, 30); X.lineWidth = 3.5; X.strokeStyle = INK; X.stroke();
    glint(BODY, -10, -8, 7, 4, .5, -.6);
    cel(HEAD, '#3d3158', '#251d3a', 3, 3, 4);
    glint(HEAD, -7, -31, 5, 2.5, .3, -.4);
    // cheeks
    if (mood === 'happy' || mood === 'rasp' || mood === 'smug') { X.fillStyle = 'rgba(255,110,165,.6)'; el(-12, -20, 4, 2.6); X.fill(); el(12, -20, 4, 2.6); X.fill(); }
    // eyes + brows
    const em = mood === 'angry' || mood === 'smug' || mood === 'idle' ? 'idle' : mood;
    LINE = '#fff'; eye(-8, -31, 9, em, look, T, 0); eye(8, -31, 9, em, look, T, 1); LINE = null;
    if (mood === 'angry') { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-15, -42); X.lineTo(-3, -37); X.moveTo(15, -42); X.lineTo(3, -37); X.stroke(); }
    if (mood === 'smug') { X.fillStyle = '#3d3158'; X.beginPath(); X.rect(-17, -40, 34, 8); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(-15, -32); X.lineTo(-2, -32); X.moveTo(2, -32); X.lineTo(15, -32); X.stroke(); }
    // mouth
    X.strokeStyle = '#fff'; X.lineWidth = 2.5; X.beginPath();
    if (mood === 'panic' || mood === 'dizzy') { el(0, -17, 3.5, 2.8); X.fillStyle = INK; X.fill(); X.strokeStyle = '#fff'; X.lineWidth = 2; X.stroke(); }
    else if (mood === 'rasp' || o.chomp) {
      const c = o.chomp ? Math.abs(Math.sin(T * 18)) : 1;
      X.beginPath(); X.moveTo(-5, -18); X.quadraticCurveTo(-5, -9 - 3 * c, 0, -8 - 4 * c); X.quadraticCurveTo(5, -9 - 3 * c, 5, -18); ink('#ff7aa8', 1.8);
      X.strokeStyle = '#c94a7a'; X.lineWidth = 1.5; X.beginPath(); X.moveTo(0, -17); X.lineTo(0, -11 - 2 * c); X.stroke();
    } else if (mood === 'angry') { X.fillStyle = '#fff'; X.beginPath(); X.moveTo(-6, -18); X.lineTo(-3.5, -13); X.lineTo(-1, -18); X.moveTo(1, -18); X.lineTo(3.5, -13); X.lineTo(6, -18); X.fill(); }
    else if (mood === 'bonk' || mood === 'sleep') { X.moveTo(-4, -16); X.lineTo(4, -16); X.stroke(); }
    else { X.arc(0, -21, 6, .25 * Math.PI, .75 * Math.PI); X.stroke(); }
    X.restore(); X.lineCap = 'butt';
  };
  /* (RACE / SOLVE / SORT) a soft ground shadow, a white key cap (desktop control hint), a dust puff, light rays */
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
  K.rays = (x, y, r, T, a = .5, col = '255,240,150') => {
    X.save(); X.translate(x, y); X.rotate(T * .6); X.fillStyle = `rgba(${col},${a})`;
    for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(-r * .12, r * .25); X.lineTo(r * .12, r * .25); X.lineTo(0, r); X.fill(); }
    X.restore();
  };
  return K;
})();

/* 13 ── WHACK: bugs pop out of the holes of a giant picnic cheese; a squeaky toy mallet bonks them (mouse) */
function gWhack(sp) {
  const holes = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) holes.push({ x: 200 + c * 200, y: 190 + r * 120 });
  const moles = []; let clock = 0, next = .1, hits = 0;
  const rise = m => { const a = clock - m.t; return m.dead ? 0 : Math.max(0, Math.min(1, a / .15, (m.life - a) / .15)); };
  /* cosmetic only (art): when each hit / swing / the verdict happened */
  const hitTs = []; let swingAt = -9, swingP = null, endAt = -1, lastHit = -9, aimed = 0;
  const g = {
    wide: true, cmd: 'WHACK!', hint: 'HIT 3 BUGS', thint: 'TAP 3 BUGS', dur: 5,
    down(p) {
      swingAt = clock; swingP = { x: p.x, y: p.y };
      for (const m of moles) {
        const h = holes[m.h];
        if (!m.dead && rise(m) > .4 && Math.hypot(p.x - h.x, p.y - (h.y - 30)) < 52) {
          m.dead = 1; m.hitAt = clock; hitTs.push(clock); lastHit = clock; hits++; confetti(h.x, h.y - 30, 8); burst(h.x, h.y - 30, '#FFE14D', 10); ring(h.x, h.y - 30, '#fff', 60, .3); floatText('+1', h.x, h.y - 70, '#fff', 36); sfx.hit(); sfx.blip(hits * 3); shake(3, .12);
          if (hits >= 3) { g.result = 'win'; sfx.sparkle(); } return;
        }
      }
      sfx.miss(); ring(p.x, p.y, '#7a5230', 30, .25);
    },
    update(dt) {
      clock += dt;
      if (g.result && endAt < 0) endAt = clock;
      if (g.result || clock < next) return;
      const live = moles.filter(m => !m.dead && clock - m.t < m.life);
      const free = holes.map((h, i) => i).filter(i => !live.some(m => m.h === i));
      if (live.length < 2) { moles.push({ h: free[Math.random() * free.length | 0], t: clock, life: 1 / Math.sqrt(sp) + .2, dead: 0 }); sfx.blip(-5); }
      next = clock + .5 / sp;
    },
    draw() {
      const K = W3K, { rr, el, ink, TAU, ease, outBack, clamp } = K, X = ctx, T = clock;
      const won = g.result === 'win', lost = g.result === 'lose', rk = endAt < 0 ? 0 : clock - endAt;
      if (!WHACK_BG || WHACK_BG.width !== VW) { WHACK_BG = K.bake(VW, H, c => { c.translate(OX, 0); whackSky(); }); WHACK_FG = K.bake(VW, H, c => { c.translate(OX, 0); whackGround(); }); }
      X.drawImage(WHACK_BG, -OX, 0);
      // live sky: sun, drifting clouds, a bird
      K.sun(-OX + 56, 168, now);
      const span = VW + 260;
      K.cloud(((now * 9 + 420) % span) - OX - 130, 78, .8); K.cloud(((now * 6 + 40) % span) - OX - 130, 250, .6); K.cloud(((now * 7 + 900) % span) - OX - 130, 64, .55);
      X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round';
      { const bx = ((now * 50) % (VW + 200)) - OX - 100, by = 214 + Math.sin(now * 2) * 6, f = Math.sin(now * 10) * 5; X.beginPath(); X.moveTo(bx - 9, by - f); X.quadraticCurveTo(bx - 4, by - 6, bx, by); X.quadraticCurveTo(bx + 4, by - 6, bx + 9, by - f); X.stroke(); }
      X.drawImage(WHACK_FG, -OX, 0);
      // where the mallet is (bugs look at it and panic when it hovers over them)
      const mp = TOUCH ? swingP : mouse;
      const lookAt = (x, y) => mp ? [clamp((mp.x - x) / 120, -1, 1), clamp((mp.y - y) / 120, -1, 1)] : [0, 0];
      // bugs in the holes
      const inHole = (h, draw) => {
        X.save(); X.beginPath(); X.rect(h.x - 95, h.y - 160, 190, 160); X.ellipse(h.x, h.y, 63, 20, 0, 0, Math.PI); X.clip(); draw(); X.restore();
        X.beginPath(); X.ellipse(h.x, h.y, 64, 21, 0, .08, Math.PI - .08); X.lineWidth = 5; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke();
      };
      if (lost) {                         // FAIL: every hole fills with bugs munching the cheese and blowing raspberries
        holes.forEach((h, i) => {
          const k = ease((rk - i * .045) / .18); if (k <= 0) return;
          inHole(h, () => K.bug(h.x + Math.sin(T * 9 + i) * 3, h.y + 70 - k * 92, Math.sin(T * 7 + i) * .12, 1.05, now, { mood: i % 2 ? 'rasp' : 'happy', chomp: i % 2 === 0, T: T + i, look: [0, 0] }));
          for (let j = 0; j < 3; j++) {                       // crumbs flying out of the bites
            const q = (rk * 1.6 + j * .33 + i * .17) % 1, s = (j - 1) * 46 + (i % 3 - 1) * 8;
            rr(h.x + s * q - 5, h.y - 54 - Math.sin(q * Math.PI) * 50 + q * 30 - 5, 10, 10, 3); X.globalAlpha = 1 - q; ink('#ffe98a', 2); X.globalAlpha = 1;
          }
        });
      } else {
        for (const m of moles) {
          const h = holes[m.h];
          if (m.dead) {                    // BONK: flattened like a pancake, dizzy stars, then sinks
            const k = (clock - m.hitAt) / .55; if (k >= 1) continue;
            const sq = outBack(Math.min(1, k / .12));
            inHole(h, () => {
              K.bug(h.x, h.y - 6 + ease((k - .45) / .55) * 70, 0, 1.1, 0, { mood: 'bonk', T, sx: 1 + .45 * sq, sy: 1 - .5 * sq });
            });
            for (let s = 0; s < 3; s++) { const a = T * 8 + s * TAU / 3; K.star(h.x + Math.cos(a) * 34, h.y - 40 + Math.sin(a) * 9, 8, 3.5, 5, a, '#FFE14D', 2); }
            continue;
          }
          const r = rise(m); if (r <= 0) continue;
          const e = 1 + Math.sin(r * Math.PI) * .12 * (r < 1 ? 1 : 0), by = h.y + 70 - r * 90;
          const near = mp && Math.hypot(mp.x - h.x, mp.y - (h.y - 30)) < 90;
          const mood = won ? 'panic' : near ? 'panic' : r < 1 ? 'angry' : (Math.floor((clock - m.t) * 3) % 2 ? 'rasp' : 'smug');
          inHole(h, () => { X.save(); X.translate(h.x, by); X.scale(1 / e, e); K.bug(near || won ? Math.sin(T * 50) * 2 : 0, 0, 0, 1.1, now, { mood, T, look: lookAt(h.x, by - 30) }); X.restore(); });
          if (near || won) K.sweat(h.x + 30, by - 50, 1.1, T + m.h * .3);
        }
      }
      if (won) {                          // the cheese is saved: a golden shine sweeps across it and every hole puffs a sparkle
        X.save(); X.beginPath(); X.moveTo(104, 132); X.lineTo(150, 100); X.lineTo(746, 100); X.lineTo(746, 452); X.lineTo(700, 488); X.lineTo(104, 488); X.closePath(); X.clip();
        const sx = -100 + ((rk % .8) / .55) * 1000; X.fillStyle = 'rgba(255,250,210,.6)'; X.beginPath(); X.moveTo(sx, 90); X.lineTo(sx + 80, 90); X.lineTo(sx - 60, 500); X.lineTo(sx - 140, 500); X.fill(); X.restore();
        holes.forEach((h, i) => { const q = (rk * 1.4 + i * .11) % 1; K.star(h.x + Math.sin(i * 3) * 24, h.y - 6 - q * 80, 11 * Math.sin(q * Math.PI), 4.5, 4, q * 3, '#FFE14D', 2); });
      }
      // the score: a cocktail-stick sign stuck in the cheese, one slot per bonked bug
      {
        const sw = Math.sin(now * 1.3) * .02 + (won ? Math.sin(rk * 18) * .06 * Math.max(0, 1 - rk) : 0);
        X.save(); X.translate(400, 124); X.rotate(sw);
        for (const s of [-46, 46]) K.line([[s, -14], [s, 6]], 4, '#f2e2b8');
        rr(-78, -66, 156, 52, 14); ink('#a5622c', 4); rr(-78, -70, 156, 50, 14); ink('#d9944f', 4);
        X.fillStyle = 'rgba(255,255,255,.25)'; rr(-68, -65, 136, 8, 4); X.fill();
        X.strokeStyle = '#c98443'; X.lineWidth = 2; X.beginPath(); X.moveTo(-70, -33); X.lineTo(-20, -33); X.moveTo(20, -27); X.lineTo(70, -27); X.stroke();
        for (let i = 0; i < 3; i++) {
          const sx = -44 + i * 44, sy = -45;
          X.beginPath(); X.arc(sx, sy, 17, 0, TAU); ink('#8a5530', 3);
          if (i < hitTs.length) {
            const k = outBack((clock - hitTs[i]) / .28), gold = won && Math.sin(now * 12 + i) > 0;
            X.save(); X.translate(sx, sy); X.scale(k, k);
            el(0, 0, 15, 9); ink(gold ? '#FFE14D' : '#ef4438', 2.5);
            X.fillStyle = INK; for (const [a, b] of [[-6, -2], [5, 3], [7, -3]]) { X.beginPath(); X.arc(a, b, 2.2, 0, TAU); X.fill(); }
            X.strokeStyle = '#fff'; X.lineWidth = 2; X.lineCap = 'round'; X.beginPath(); X.moveTo(-5, -9); X.lineTo(-1, -5); X.moveTo(-1, -9); X.lineTo(-5, -5); X.moveTo(1, -9); X.lineTo(5, -5); X.moveTo(5, -9); X.lineTo(1, -5); X.stroke();
            X.restore();
          } else { X.globalAlpha = .35; K.bug(sx, sy + 3, 0, .32, 0, { mood: 'sleep', T }); X.globalAlpha = 1; }
        }
        X.restore();
        if (won) for (let i = 0; i < 6; i++) { const q = (rk * .9 + i / 6) % 1; K.star(400 + Math.cos(i * 1.7) * (60 + q * 50), 60 - q * 30 + Math.sin(i * 2.3) * 14, 7 * Math.sin(q * Math.PI), 3, 4, 0, '#fff', 0); }
      }
      // the background gag: a little mouse guarding its cheese, nibbling a crumb
      {
        const wk = won ? ease(rk / .35) : 0, mx = 676 - wk * 86, my = 532 - wk * 422 - Math.sin(wk * Math.PI) * 60, faint = lost ? ease(rk / .3) : 0, hop = won && wk >= 1 ? Math.abs(Math.sin(rk * 9)) * 16 : 0;
        X.save(); X.translate(mx, my - hop); X.rotate(-faint * 1.4);
        shadowX(0, 4 + hop, 26, 6);
        X.beginPath(); X.moveTo(18, -6); X.quadraticCurveTo(48, -2 + Math.sin(now * 4) * 6, 40, -30 + Math.sin(now * 3) * 6); X.lineWidth = 7; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#ff9ac2'; X.stroke();
        const breathe = Math.sin(now * 3.1) * .03;
        X.save(); X.scale(1 + breathe, 1 - breathe);
        const B = K.pEl(0, -18, 22, 20); K.cel(B, '#c9c3d6', '#9f97b3', 4, 4, 4); K.glint(B, -8, -28, 7, 4, .45);
        X.restore();
        for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 16, -44, 11, 0, TAU); ink('#c9c3d6', 3); X.beginPath(); X.arc(s * 16, -44, 6, 0, TAU); X.fillStyle = '#ff9ac2'; X.fill(); }
        const H2 = K.pEl(0, -34, 16, 14); K.cel(H2, '#d8d2e4', '#a9a1bd', 3, 3, 3.5);
        const mm = faint > .5 ? 'dizzy' : won ? 'happy' : lost ? 'panic' : 'idle';
        K.eye(-6, -37, 5.5, mm, lookAt(mx, my - 40), now, 0); K.eye(6, -37, 5.5, mm, lookAt(mx, my - 40), now, 1);
        X.fillStyle = 'rgba(255,110,165,.6)'; el(-11, -29, 3.5, 2.2); X.fill(); el(11, -29, 3.5, 2.2); X.fill();
        X.beginPath(); X.arc(0, -29, 3, 0, TAU); ink('#ff5c8a', 1.5);
        X.strokeStyle = INK; X.lineWidth = 1.5; X.beginPath(); for (const s of [-1, 1]) { X.moveTo(s * 4, -28); X.lineTo(s * 20, -31); X.moveTo(s * 4, -27); X.lineTo(s * 20, -25); } X.stroke();
        // the crumb it nibbles (raised like a trophy on a win)
        const nib = won ? 0 : Math.max(0, Math.sin(now * 5)) * 5;
        X.save(); X.translate(won ? 20 : 0, won ? -62 : -16 - nib); rr(-8, -6, 16, 12, 3); ink('#ffd23f', 2.5); X.fillStyle = '#e3a91f'; X.beginPath(); X.arc(2, 0, 2.5, 0, TAU); X.fill(); X.restore();
        if (won) { X.beginPath(); X.moveTo(-10, -46); X.lineTo(0, -72); X.lineTo(10, -46); X.closePath(); ink('#4db8ff', 2.5); X.beginPath(); X.arc(0, -73, 4, 0, TAU); ink('#FFE14D', 2); }
        X.restore();
        if (won) for (let i = 0; i < 3; i++) { const q = (rk * .8 + i / 3) % 1; K.heart(mx - 30 + i * 22 - q * 30, my - 66 - q * 26, .7, Math.sin(q * Math.PI)); }
        if (!won && !lost && Math.sin(now * .9) > .6) K.zee(mx + 30, my - 66 - (now * 20 % 14), .7, .8);
      }
      // Claude on the picnic blanket: cheers each bonk, jumps on the win, slumps on the fail
      {
        const cx = 64, cy = 546, u = 5.2, cheer = clamp(1 - (clock - lastHit) / .4, 0, 1);
        const jump = won ? Math.abs(Math.sin(rk * 9)) * 18 : cheer * Math.sin(cheer * Math.PI) * 12, br = Math.sin(now * 3.1) * .025;
        X.save(); X.translate(cx, cy - jump); X.scale(1 - br, 1 + br);
        shadowX(0, 2 + jump, 34, 6);
        if (won) { const w = Math.sin(now * 14) * .3; K.arms(u, -.45 + w, .45 - w, ease(rk / .2)); }
        else if (lost) K.arms(u, -2.6, 2.6, ease(rk / .25));
        else if (cheer > 0) K.arms(u, -.3, .3, cheer);
        claude(0, 0, u, { mood: won || cheer > 0 ? 'happy' : lost ? 'sad' : null });
        X.restore();
        if (lost) K.sweat(cx + 30, cy - 58, 1.3, now);
        K.tag(cx, cy - 72 - jump + Math.sin(now * 3) * 2);
      }
      // the squeaky toy mallet (follows the mouse; on touch it only shows for the swing)
      if (mp && (TOUCH || swingAt > 0 || mouse.x !== W / 2 || mouse.y !== H / 2)) aimed = 1;
      if (mp && aimed && !(TOUCH && clock - swingAt > .45)) {
        const s = clock - swingAt, up = 1, a = s < .07 ? up * (1 - s / .07) : s < .2 ? Math.sin((s - .07) / .13 * Math.PI) * -.06 : up * ease((s - .2) / .18);
        const p = s < .45 && swingP ? swingP : mp;
        mallet(p.x, p.y, a + Math.sin(now * 3) * .02 * (s > .4));
      }
      vignette(.2);
    }
  };
  function shadowX(x, y, rx, ry) { ctx.fillStyle = 'rgba(20,16,28,.25)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, W3K.TAU); ctx.fill(); }
  function mallet(x, y, a) {                // pivot below-right of the pointer; at a = 0 the head lands on it
    const K = W3K, X = ctx; X.save(); X.translate(x + 54, y + 70); X.rotate(-.66 + a);
    K.line([[0, 4], [0, -76]], 11, '#ffd23f');
    X.strokeStyle = '#ff4d5e'; X.lineWidth = 4; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(-5, -10 - i * 17); X.lineTo(5, -16 - i * 17); X.stroke(); }
    X.translate(0, -88);
    K.rr(-40, -22, 80, 44, 16); K.ink('#b8283a', 4); K.rr(-40, -22, 76, 40, 16); X.fillStyle = '#ff4d5e'; X.fill();
    for (const s of [-1, 1]) { K.rr(s * 40 - 9, -25, 18, 50, 8); K.ink('#ffd23f', 3.5); X.fillStyle = '#fff3a0'; K.rr(s * 40 - 6, -20, 6, 16, 3); X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.45)'; K.el(-12, -12, 16, 5, -.1); X.fill();
    X.restore();
  }
  return g;
}
/* WHACK's baked scene: sky, hills, lawn, a picnic blanket and a giant wedge of cheese with nine holes */
let WHACK_BG = null, WHACK_FG = null;
function whackSky() {
  const X = W3K.cx(), sky = X.createLinearGradient(0, 0, 0, 380); sky.addColorStop(0, '#36b0ea'); sky.addColorStop(.55, '#86d8fb'); sky.addColorStop(1, '#d6f7ff');
  X.fillStyle = sky; X.fillRect(-OX, 0, VW, 400);
}
function whackGround() {
  const K = W3K, { el, ink, TAU } = K, X = K.cx();
  const L = -OX, R = W + OX;
  // far hills (no ink), near hills with a coloured outline + lollipop trees
  X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(L, 380); for (let x = L; x <= R + 40; x += 40) X.lineTo(x, 330 - Math.sin(x * .011) * 26 - Math.sin(x * .023 + 1) * 12); X.lineTo(R, 380); X.fill();
  X.beginPath(); X.moveTo(L - 10, 390); for (let x = L - 10; x <= R + 50; x += 30) X.lineTo(x, 356 - Math.sin(x * .016 + 2) * 18); X.lineTo(R + 10, 390); X.closePath(); X.lineWidth = 6; X.strokeStyle = '#4f9a6a'; X.stroke(); X.fillStyle = '#87d19b'; X.fill();
  for (const tx of [L + 40, 90, 720, R - 30]) { const ty = 352 - Math.sin(tx * .016 + 2) * 18; X.beginPath(); X.moveTo(tx, ty + 6); X.lineTo(tx, ty - 22); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = '#8a5a34'; X.stroke(); X.beginPath(); X.arc(tx, ty - 34, 18, 0, TAU); ink('#2f9a55', 3); X.beginPath(); X.arc(tx - 4, ty - 38, 11, 0, TAU); X.fillStyle = '#43b366'; X.fill(); X.fillStyle = 'rgba(255,255,255,.28)'; el(tx - 8, ty - 44, 5, 3, -.5); X.fill(); }
  // lawn with a hard ink horizon
  const gr = X.createLinearGradient(0, 380, 0, 600); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944');
  X.fillStyle = gr; X.fillRect(L, 380, VW, 220);
  X.fillStyle = INK; X.fillRect(L, 378, VW, 4);
  X.save(); X.beginPath(); X.rect(L, 382, VW, 218); X.clip(); X.strokeStyle = 'rgba(255,255,255,.12)'; X.lineWidth = 22; for (let x = L - 300; x < R; x += 70) { X.beginPath(); X.moveTo(x, 600); X.lineTo(x + 220, 382); X.stroke(); } X.restore();
  X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round';
  for (let i = 0; i < 14; i++) { const x = L + K.hash(i) * VW, y = 400 + K.hash(i + 40) * 190; X.beginPath(); X.moveTo(x - 5, y - 6); X.lineTo(x - 2, y + 2); X.moveTo(x, y - 9); X.lineTo(x, y + 2); X.moveTo(x + 5, y - 6); X.lineTo(x + 2, y + 2); X.stroke(); }
  // picnic blanket (red / white gingham) the cheese sits on
  const blanket = new Path2D('M 30 470 L 770 470 L 880 610 L -80 610 Z');
  K.inkP(blanket, '#fff', 4); X.save(); X.clip(blanket);
  X.fillStyle = 'rgba(255,77,94,.55)'; for (let i = -12; i < 14; i++) { X.beginPath(); X.moveTo(400 + i * 60, 470); X.lineTo(400 + i * 60 + 30, 470); X.lineTo(400 + i * 78 + 39, 610); X.lineTo(400 + i * 78, 610); X.fill(); }
  for (let j = 0; j < 4; j++) { const y0 = 470 + j * 36, y1 = y0 + 18; X.fillRect(-100, y0, 1000, y1 - y0); }
  X.restore(); K.inkP(blanket, null, 2);
  // the giant cheese wedge: front face, top face and right side, one ink silhouette
  const sil = new Path2D('M 104 132 L 150 100 L 746 100 L 746 452 L 700 488 L 104 488 Z');
  X.save(); X.fillStyle = 'rgba(20,16,28,.25)'; X.beginPath(); X.ellipse(430, 492, 360, 18, 0, 0, TAU); X.fill(); X.restore();
  K.inkP(sil, '#ffd23f', 5);
  X.fillStyle = '#ffe98a'; X.beginPath(); X.moveTo(104, 132); X.lineTo(150, 100); X.lineTo(746, 100); X.lineTo(700, 132); X.closePath(); X.fill();
  X.fillStyle = '#e8b423'; X.beginPath(); X.moveTo(700, 132); X.lineTo(746, 100); X.lineTo(746, 452); X.lineTo(700, 488); X.closePath(); X.fill();
  X.fillStyle = '#f2c22f'; X.fillRect(104, 468, 596, 20); X.fillRect(684, 132, 16, 356);       // shade crescent on the front face
  X.strokeStyle = INK; X.lineWidth = 3.5; X.lineJoin = 'round'; X.beginPath(); X.moveTo(104, 132); X.lineTo(700, 132); X.lineTo(746, 100); X.moveTo(700, 132); X.lineTo(700, 488); X.stroke();
  X.fillStyle = 'rgba(255,255,255,.4)'; el(170, 116, 40, 5, 0); X.fill(); el(132, 200, 6, 40, 0); X.fill();
  // little decorative holes (never where a bug can pop out)
  const pit = (x, y, r, top) => { el(x, y, r, r * (top ? .45 : .9)); ink('#e3a91f', 0); X.save(); el(x, y, r, r * (top ? .45 : .9)); X.clip(); X.fillStyle = '#c98f12'; el(x - r * .2, y - r * .25, r, r * (top ? .45 : .9)); X.fill(); X.restore(); X.lineWidth = 2; X.strokeStyle = 'rgba(20,16,28,.35)'; el(x, y, r, r * (top ? .45 : .9)); X.stroke(); };
  for (const [x, y, r] of [[300, 252, 11], [500, 250, 13], [300, 372, 9], [500, 370, 12], [134, 300, 8], [668, 410, 9], [400, 470, 7], [240, 466, 6], [580, 160, 7], [140, 160, 8]]) pit(x, y, r);
  for (const [x, y, r] of [[300, 116, 12], [520, 112, 9], [640, 120, 8]]) pit(x, y, r, 1);
  for (const [x, y, r] of [[722, 200, 9], [724, 330, 12], [720, 420, 7]]) { X.save(); X.translate(x, y); X.scale(.55, 1); pit(0, 0, r); X.restore(); }
  // the nine bug holes (the back half; the bugs and the front lip are drawn live)
  for (let rI = 0; rI < 3; rI++) for (let c = 0; c < 3; c++) {
    const hx = 200 + c * 200, hy = 190 + rI * 120;
    X.fillStyle = '#f2c22f'; el(hx, hy + 5, 74, 27); X.fill();
    el(hx, hy, 64, 21); ink('#2a1a08', 3); X.save(); el(hx, hy, 64, 21); X.clip(); X.fillStyle = '#c98f12'; el(hx, hy - 9, 66, 19); X.fill(); X.fillStyle = '#7a520c'; el(hx, hy - 4, 60, 15); X.fill(); X.fillStyle = '#2a1a08'; el(hx, hy + 2, 52, 13); X.fill(); X.restore();
    X.fillStyle = 'rgba(255,255,255,.35)'; el(hx - 30, hy - 21, 16, 3, -.1); X.fill();
  }
}

/* 14 ── DRAG: carry the token into the bin, avoid the guard (mouse drag) */
function gDrag(sp) {
  const sy = 140 + Math.random() * 300, sx = 120 - OX * .8, tok = { x: sx, y: sy, drag: false };
  const bin = { x: 690 + OX * .8, y: 140 + Math.random() * 300, r: sp > 1.5 ? 50 : 66 };
  let gy = 120, gv = 260 * sp;
  const g = {
    wide: true, cmd: 'DRAG!', hint: 'DRAG THE TOKEN INTO THE BIN', thint: 'DRAG THE TOKEN INTO THE BIN', dur: 5.5,
    down(p) { if (Math.hypot(p.x - tok.x, p.y - tok.y) < 48) { tok.drag = true; sfx.click(); ring(tok.x, tok.y, '#fff', 44, .25); } },
    up() { tok.drag = false; },
    move(p) {
      if (!tok.drag) return;
      tok.x = p.x; tok.y = p.y;
      if (Math.hypot(tok.x - bin.x, tok.y - bin.y) < bin.r * .75) { tok.drag = false; tok.x = bin.x; tok.y = bin.y; g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(bin.x, bin.y, '#4DB8FF', 16); ring(bin.x, bin.y, '#fff', 90); floatText('NICE!', bin.x, bin.y - 70, '#fff'); }
    },
    update(dt) {
      if (g.result) return;
      gy += gv * dt; if (gy > 470) { gy = 470; gv = -gv; } if (gy < 100) { gy = 100; gv = -gv; }
      if (Math.hypot(tok.x - 400, tok.y - gy) < 62) { tok.x = sx; tok.y = sy; tok.drag = false; sfx.buzz(); sfx.zap(); shake(7, .25); burst(tok.x, tok.y, '#FF4D4D', 14); ring(tok.x, tok.y, '#FF4D4D', 80); }
    },
    draw(t) {
      bg('#8EE3EF', '#7ed7e4', t);
      ctx.setLineDash([14, 10]); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bin.x, bin.y, bin.r + 12, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      circ(bin.x, bin.y, bin.r, '#4DB8FF', 5); txt('IN', bin.x, bin.y + 3, 40);
      shadow(400, gy + 46, 44, 12); drawBug(400, gy, Math.PI / 2 * (gv > 0 ? 1 : -1), 1.5, now);
      shadow(tok.x + 4, tok.y + 34 + (tok.drag ? 8 : 0), 26, 8, tok.drag ? .18 : .28); token(tok.x, tok.y - (tok.drag ? 6 : 0), tok.drag ? 33 : 30);
    }
  };
  return g;
}

/* 15 ── RACE: sports day at the village track. Claude (sweatband on) sprints against a smug ladybug in
   running shoes while the crowd and a gum-chewing cow watch from the bleachers. Alternate ← → (or A D). */
function gRace(sp) {
  let me = 0, rival = 0, last = '', shk = 0, clock = 0;
  const rate = 100 / (5 * .88 / Math.sqrt(sp)), x0 = 80 - OX, kx = (620 + OX * 2) / 100, fx = 724 + OX;
  let stepAt = -9, endAt = -1;          // cosmetic only (art): last good step, when the verdict landed
  const g = {
    wide: true, cmd: 'RACE!', hint: 'ALTERNATE LEFT AND RIGHT', thint: 'TAP LEFT / RIGHT SIDE', dur: 5,
    down(p) { g.key({ code: p.x < W / 2 ? 'ArrowLeft' : 'ArrowRight' }); },
    key(e) {
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (!k) return;
      if (k === last) { shk = .15; sfx.miss(); return; }
      last = k; me += 5; stepAt = clock; sfx.blip(me / 8); burst(x0 + Math.min(me, 100) * kx - 30, 330, '#d9a066', 3, 140);
      if (me >= 100) { g.result = 'win'; sfx.coin(); sfx.sparkle(); shake(5, .2); floatText('WINNER!', 400, 250, '#fff', 48); confetti(fx, 240, 30); }
    },
    update(dt) {
      clock += dt; shk = Math.max(0, shk - dt);
      if (g.result && endAt < 0) endAt = clock;
      if (g.result) return;
      rival += rate * dt; if (rival >= 100) { g.result = 'lose'; sfx.buzz(); shake(6, .25); }
    },
    draw() {
      const K = W3K, { rr, el, ink, TAU, ease, outBack, clamp } = K, X = ctx, T = clock;
      const won = g.result === 'win', lost = g.result === 'lose', rk = endAt < 0 ? 0 : clock - endAt;
      if (!RACE_SKY || RACE_SKY.width !== VW) {
        RACE_SKY = K.bake(VW, H, c => { c.translate(OX, 0); raceSky(); });
        RACE_WALL = K.bake(VW, H, c => { c.translate(OX, 0); raceWall(); });
        RACE_FG = K.bake(VW, H, c => { c.translate(OX, 0); raceGround(fx); });
      }
      const mx0 = x0 + Math.min(me, 100) * kx + Math.sin(now * 80) * shk * 20, mx = lost ? mx0 + (x0 - 30 - mx0) * ease(rk / .45) : mx0, rx = x0 + Math.min(rival, 100) * kx;
      const lead = won ? mx : lost ? rx : (me >= rival ? mx : rx), ahead = me > rival;
      X.drawImage(RACE_SKY, -OX, 0);
      const span = VW + 260;
      K.cloud(((now * 9 + 300) % span) - OX - 130, 58, .7); K.cloud(((now * 6 + 820) % span) - OX - 130, 76, .55);
      X.drawImage(RACE_WALL, -OX, 0);
      // the crowd on the bleachers: everyone follows the leader with their eyes; they bounce when a runner crosses the line
      const HC = ['#ffd6a5', '#c9c3d6', '#9be564', '#ffb4a2', '#8fd3ff', '#f3a283', '#e3ac66', '#ffe98a', '#c792ea'];
      for (let r = 0; r < 2; r++) {
        const yb = 142 + r * 46;
        for (let i = 0, hx = -OX + 22 + r * 21; hx < W + OX; i++, hx += 42) {
          if (r === 1 && hx > 520 && hx < 620) continue;               // the cow's seat
          const id = r * 50 + i, hh = K.hash(id), col = HC[(hh * HC.length) | 0];
          const hop = g.result ? Math.abs(Math.sin(rk * 10 + id)) * (won ? 7 : 3) : Math.max(0, Math.sin(now * 5 + id * 1.7)) * 1.5;
          const hy = yb - 12 - hop;
          X.fillStyle = col; rr(hx - 16, hy + 6, 32, 22, 9); ink(col, 2.5);
          el(hx, hy - 3, 13, 12.5); ink(col, 2.5);
          const hat = (K.hash(id + 9) * 5) | 0;
          if (hat === 1) { X.beginPath(); X.moveTo(hx - 8, hy - 11); X.lineTo(hx, hy - 27); X.lineTo(hx + 8, hy - 11); X.closePath(); ink(K.hash(id + 3) > .5 ? '#ff5c8a' : '#4db8ff', 2); }
          else if (hat === 2) { rr(hx - 11, hy - 16, 22, 8, 4); ink('#ff4d5e', 2); rr(hx + 2, hy - 11, 14, 4, 2); ink('#ff4d5e', 1.5); }
          else if (hat === 3) { X.beginPath(); X.arc(hx - 6, hy - 13, 4, 0, TAU); X.arc(hx + 6, hy - 13, 4, 0, TAU); ink(col, 2); }
          const lx = clamp((lead - hx) / 160, -1, 1) * 1.6;
          if (won && K.hash(id + 5) > .5) { X.strokeStyle = INK; X.lineWidth = 2; for (const s of [-4, 4]) { X.beginPath(); X.arc(hx + s, hy - 2, 2.6, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); } }
          else for (const s of [-4, 4]) { X.fillStyle = '#fff'; el(hx + s, hy - 3, 3.2, 3.6); X.fill(); X.fillStyle = INK; el(hx + s + lx, hy - 3, 1.7, 2); X.fill(); }
          if (won) { X.fillStyle = INK; el(hx, hy + 4, 3, 2.4); X.fill(); }
        }
      }
      X.drawImage(RACE_FG, -OX, 0);
      // the background gag: a cow in the front row with a foam finger, blowing bubble gum that keeps popping on its face
      {
        const cx = 570, cy = 160 - (won ? Math.abs(Math.sin(rk * 9)) * 8 : 0), cyc = (now * .45) % 1, bub = won ? 0 : lost ? clamp(rk * 2.5, 0, 1) : cyc < .8 ? ease(cyc / .8) : 0;
        const popped = lost || (!won && cyc >= .8), pa = popped ? (lost ? 1 : 1 - (cyc - .8) / .2) : 0;
        X.save(); X.translate(570, 190); X.scale(1.25, 1.25); X.translate(-570, -190);
        X.save(); X.translate(cx + 30, cy + 6); X.rotate(.35 + (won ? Math.sin(now * 14) * .35 : Math.sin(now * 3) * .12)); X.scale(.8, .8);
        rr(-4, -10, 8, 16, 3); ink('#fff', 2.5);
        X.beginPath(); X.moveTo(-11, -12); X.lineTo(-13, -40); X.quadraticCurveTo(-12, -52, -4, -52); X.lineTo(-2, -66); X.quadraticCurveTo(4, -74, 8, -66); X.lineTo(10, -40); X.lineTo(12, -12); X.closePath(); ink('#FFE14D', 3);
        X.fillStyle = 'rgba(255,255,255,.5)'; el(-6, -44, 2.5, 8); X.fill(); X.restore();
        rr(cx - 24, cy + 4, 48, 24, 10); ink('#fff', 3);
        for (const s of [-1, 1]) { X.beginPath(); X.moveTo(cx + s * 12, cy - 18); X.quadraticCurveTo(cx + s * 22, cy - 30, cx + s * 18, cy - 36); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#fff3c4'; X.stroke(); }
        for (const s of [-1, 1]) { X.save(); X.translate(cx + s * 24, cy - 10); X.rotate(s * (.5 + Math.sin(now * 4) * .15)); el(0, 0, 10, 5); ink('#fff', 2.5); X.restore(); }
        el(cx, cy - 6, 21, 18); ink('#fff', 3);
        X.save(); el(cx, cy - 6, 21, 18); X.clip(); X.fillStyle = INK; el(cx - 13, cy - 16, 9, 7, .4); X.fill(); el(cx + 16, cy + 2, 6, 5); X.fill(); X.restore();
        const chew = Math.sin(now * 9) * 1.5;
        el(cx, cy + 6 + chew * .3, 15, 9 + chew * .2); ink('#ffb4c8', 2.5);
        X.fillStyle = '#c25b7a'; el(cx - 5, cy + 4, 2, 2.5); X.fill(); el(cx + 5, cy + 4, 2, 2.5); X.fill();
        const cm = won ? 'happy' : popped && pa > .4 ? 'bonk' : 'idle';
        K.eye(cx - 8, cy - 10, 5, cm, [clamp((lead - cx) / 200, -1, 1), .3], now, 0); K.eye(cx + 8, cy - 10, 5, cm, [clamp((lead - cx) / 200, -1, 1), .3], now, 1);
        if (bub > .05 && !popped) { X.beginPath(); X.arc(cx + 3, cy + 14 + bub * 6, 3 + bub * 15, 0, TAU); ink('#ff8fc0', 2.5); X.fillStyle = 'rgba(255,255,255,.6)'; el(cx - 2 - bub * 5, cy + 10 + bub * 2, 2 + bub * 3, 1.5 + bub * 2, -.5); X.fill(); }
        if (popped && pa > 0) { X.save(); X.globalAlpha = clamp(pa, 0, 1); X.fillStyle = '#ff8fc0'; X.strokeStyle = INK; X.lineWidth = 2; for (const [a, b, r] of [[-12, 2, 7], [10, -4, 6], [0, 10, 8], [-4, -14, 5], [14, 8, 5]]) { el(cx + a, cy + b, r, r * .8); X.stroke(); X.fill(); } X.restore(); }
        if (won) for (let i = 0; i < 3; i++) { const q = (rk * .9 + i / 3) % 1; K.heart(cx - 22 + i * 22, cy - 40 - q * 30, .55, Math.sin(q * Math.PI)); }
        X.restore();
      }
      // the finish tape: Claude or the bug snaps it, and the two ends flap from the posts
      {
        const tx = fx + 16;
        if (!g.result) { X.beginPath(); X.moveTo(tx, 216); X.quadraticCurveTo(tx + 6 + Math.sin(now * 3) * 4, 341, tx, 466); X.lineCap = 'round'; X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#ff4d5e'; X.stroke(); }
        else {
          const k = ease(rk / .3), fl = Math.sin(rk * 14) * 10 * Math.max(.25, 1 - rk);
          K.line([[tx, 216], [tx + 30 * k + fl * .4, 260], [tx + 60 * k + fl, 296 - 20 * k]], 5, '#ff4d5e');
          K.line([[tx, 466], [tx + 30 * k - fl * .4, 430], [tx + 64 * k - fl, 396 + 30 * k]], 5, '#ff4d5e');
        }
        for (const py of [216, 466]) { rr(tx - 6, py - 14, 12, 28, 5); ink('#fff', 3); X.beginPath(); X.arc(tx, py - 16, 6, 0, TAU); ink('#ffd23f', 2.5); }
      }
      // light rays behind whoever crossed the line first
      if (g.result) K.rays(won ? mx : rx, won ? 290 : 400, 150 * ease(rk / .25), now, .45);
      // the bug: runs upright in sneakers, smug while ahead, sweating while behind; trophy on its win, dizzy on its loss
      {
        const sc = 1.05, fy = 448, bounce = g.result ? 0 : Math.abs(Math.sin(now * 16)) * 5, jump = lost ? Math.abs(Math.sin(rk * 9)) * 14 : 0;
        K.shade(rx, fy, 36, 8);
        const by = fy - 40 * sc - bounce - jump, rot = g.result ? 0 : .22;
        for (const s of [-1, 1]) {                       // sneakers
          const kk = g.result ? 0 : Math.sin(now * 16 + (s > 0 ? Math.PI : 0)) * 8;
          rr(rx + s * 10 - 9 + kk + (won ? s * 6 : 0), fy - 10 - jump - Math.max(0, kk) * .5, 22, 11, 5); ink('#fff', 2.5); X.fillStyle = '#4db8ff'; rr(rx + s * 10 - 9 + kk + (won ? s * 6 : 0), fy - 4 - jump - Math.max(0, kk) * .5, 22, 5, 2.5); X.fill();
        }
        const mood = won ? 'dizzy' : lost ? 'rasp' : ahead ? 'panic' : (Math.floor(now * 2) % 2 ? 'smug' : 'rasp');
        K.bug(rx, by, rot, sc, g.result ? 0 : now, { mood, T: now, look: ahead && !g.result ? [1, 0] : [-1, -.2] });
        if ((ahead && !g.result) || won) K.sweat(rx + 26, by - 44, 1, now);
        if (won) for (let s = 0; s < 3; s++) { const a = now * 7 + s * TAU / 3; K.star(rx + Math.cos(a) * 30, by - 62 + Math.sin(a) * 8, 7, 3, 5, a, '#FFE14D', 2); }
        if (lost) {                                       // the bug raises a tiny trophy
          const k = outBack(rk / .3); X.save(); X.translate(rx, by - 72 * sc); X.scale(k, k); X.rotate(Math.sin(now * 10) * .1);
          X.beginPath(); X.moveTo(-14, -20); X.lineTo(14, -20); X.quadraticCurveTo(14, 2, 0, 4); X.quadraticCurveTo(-14, 2, -14, -20); X.closePath(); ink('#FFE14D', 3);
          for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 15, -12, 6, s > 0 ? -1.4 : Math.PI - 1.7, s > 0 ? 1.7 : Math.PI + 1.4, s < 0); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.5; X.strokeStyle = '#FFE14D'; X.stroke(); }
          rr(-4, 3, 8, 7, 2); ink('#e8b423', 2); rr(-10, 9, 20, 7, 3); ink('#a5622c', 2);
          X.fillStyle = 'rgba(255,255,255,.55)'; el(-6, -14, 3, 5, -.3); X.fill(); X.restore();
        }
      }
      // Claude: pumping arms + a red sweatband; breaks the tape with a medal on the win, on the loss it faceplants and skids all the way back to the start line (clear of the centre stamp)
      {
        const u = 7, cy = 330, running = !g.result && clock - stepAt < .3, k = Math.sin(now * 16);
        const jump = won ? Math.abs(Math.sin(rk * 9)) * 18 : running ? Math.abs(k) * 4 : 0;
        K.shade(mx, cy + 2, 46, 9);
        if (!lost && !won && me < rival - 8) K.sweat(mx + 40, cy - 60, 1.2, now);
        X.save(); X.translate(mx, cy - jump);
        if (lost) { const f = ease(rk / .22); X.translate(5 * u * f, 0); X.rotate(f * 1.35); X.translate(-5 * u * f, 0); }
        if (won) { const w = Math.sin(now * 14) * .3; K.arms(u, -.45 + w, .45 - w, ease(rk / .2)); }
        else if (lost) K.arms(u, -2.4, 2.4, 1);
        else if (running) K.arms(u, -.2 + k * .9, .2 + k * .9, 1);
        else K.arms(u, -.9, .9, .8);
        claude(0, 0, u, { run: running ? now : null, mood: won || (ahead && !lost) ? 'happy' : lost ? 'sad' : null });
        // sweatband with fluttering tails
        rr(-6 * u - 2, -8.8 * u, 12 * u + 4, 1.4 * u, 3); ink('#ff4d5e', 2.5);
        const fl = Math.sin(now * 20) * 4;
        X.beginPath(); X.moveTo(-6 * u, -8.3 * u); X.lineTo(-6 * u - 18, -8.3 * u - 6 + fl); X.lineTo(-6 * u - 14, -8.3 * u + 4 + fl * .5); X.closePath(); ink('#ff4d5e', 2);
        X.fillStyle = 'rgba(255,255,255,.4)'; rr(-6 * u, -8.7 * u, 12 * u, 3, 1.5); X.fill();
        if (won) {                                         // gold medal on a blue ribbon
          const m = outBack((rk - .15) / .3);
          if (m > 0) { X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(-14, -7 * u); X.lineTo(0, -3.6 * u); X.lineTo(14, -7 * u); X.stroke(); X.strokeStyle = '#4db8ff'; X.lineWidth = 3; X.stroke(); X.save(); X.translate(0, -3 * u); X.scale(m, m); X.beginPath(); X.arc(0, 0, 9, 0, TAU); ink('#FFE14D', 3); K.star(0, 0, 5, 2.2, 5, -Math.PI / 2, '#fff3a0', 0); X.restore(); }
        }
        X.restore();
        if (lost) { const q = clamp(rk / .5, 0, 1); K.puff(mx + 50 - q * 20, cy - 8 - q * 16, 16 + q * 10, 1 - q); K.puff(mx + 80 + q * 10, cy - 4 - q * 10, 12 + q * 8, 1 - q); if (rk > .3) for (let s = 0; s < 3; s++) { const a = now * 7 + s * TAU / 3; K.star(mx + 62 + Math.cos(a) * 26, cy - 22 + Math.sin(a) * 7, 7, 3, 5, a, '#FFE14D', 2); } }
        if (!lost) K.tag(mx, cy - 9 * u - 30 - jump + Math.sin(now * 3) * 2);
      }
      vignette(.16);
    }
  };
  return g;
}
/* RACE's baked layers: sky; the bleachers' back wall; then benches, lawn, track, start + finish lines */
let RACE_SKY = null, RACE_WALL = null, RACE_FG = null;
function raceSky() {
  const X = W3K.cx(), sky = X.createLinearGradient(0, 0, 0, 120); sky.addColorStop(0, '#36b0ea'); sky.addColorStop(.6, '#86d8fb'); sky.addColorStop(1, '#d6f7ff');
  X.fillStyle = sky; X.fillRect(-OX, 0, VW, 130);
}
function raceWall() {
  const K = W3K, { rr, ink } = K, X = K.cx(), L = -OX, R = W + OX;
  // bunting across the top of the stand
  rr(L - 10, 94, VW + 20, 110, 6); ink('#5a8fd6', 4);
  X.fillStyle = '#4a7cc2'; for (let x = L; x < R; x += 46) X.fillRect(x, 98, 20, 100);
  X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(L, 98, VW, 6);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(L - 10, 82);
  for (let x = L; x <= R + 40; x += 40) X.quadraticCurveTo(x - 20, 92, x, 82);
  X.stroke();
  const FC = ['#ff4d5e', '#FFE14D', '#4fd06a', '#4db8ff', '#ff9f43', '#c792ea'];
  for (let i = 0, x = L + 10; x < R; i++, x += 40) { X.beginPath(); X.moveTo(x, 86); X.lineTo(x + 20, 86); X.lineTo(x + 10, 104); X.closePath(); ink(FC[i % FC.length], 2); }
}
function raceGround(fx) {
  const K = W3K, { rr, el, ink, TAU } = K, X = K.cx(), L = -OX, R = W + OX;
  // three bench rows (the crowd sits behind them)
  for (let r = 0; r < 2; r++) { const yb = 142 + r * 46; rr(L - 10, yb, VW + 20, 13, 4); ink('#d9944f', 3); X.fillStyle = '#a5622c'; X.fillRect(L, yb + 8, VW, 4); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(L, yb + 2, VW, 3); }
  // lawn + a hard ink horizon
  const gr = X.createLinearGradient(0, 200, 0, 600); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944');
  X.fillStyle = gr; X.fillRect(L, 200, VW, 400); X.fillStyle = INK; X.fillRect(L, 198, VW, 4);
  X.save(); X.beginPath(); X.rect(L, 202, VW, 398); X.clip(); X.strokeStyle = 'rgba(255,255,255,.12)'; X.lineWidth = 22; for (let x = L - 400; x < R; x += 70) { X.beginPath(); X.moveTo(x, 600); X.lineTo(x + 400, 202); X.stroke(); } X.restore();
  // the running track: two lanes of red tartan with white lines
  X.fillStyle = INK; X.fillRect(L, 218, VW, 254);
  X.fillStyle = '#e0714a'; X.fillRect(L, 222, VW, 246);
  X.fillStyle = '#c95a37'; X.fillRect(L, 456, VW, 12); X.fillRect(L, 336, VW, 8);
  X.fillStyle = 'rgba(255,255,255,.14)'; for (let x = L; x < R; x += 9) for (let y = 226; y < 456; y += 9) if (((x + y) / 9 | 0) % 3 === 0) X.fillRect(x, y, 2, 2);
  X.fillStyle = '#fff'; X.fillRect(L, 226, VW, 5); X.fillRect(L, 341, VW, 5); X.fillRect(L, 458, VW, 5);
  // start line
  X.fillRect(80 - OX - 56, 231, 6, 227);
  // checkered finish strip
  for (let r = 0; r < 16; r++) for (let c = 0; c < 2; c++) { X.fillStyle = (r + c) % 2 ? '#fff' : INK; X.fillRect(fx + c * 16, 231 + r * 14.3, 16, 14.3); }
  // tufts, flowers, hay bales on the infield
  X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const x = L + K.hash(i + 7) * VW, y = 488 + K.hash(i + 70) * 50; X.beginPath(); X.moveTo(x - 5, y - 6); X.lineTo(x - 2, y + 2); X.moveTo(x, y - 9); X.lineTo(x, y + 2); X.moveTo(x + 5, y - 6); X.lineTo(x + 2, y + 2); X.stroke(); }
  for (let i = 0; i < 7; i++) { const x = L + 30 + K.hash(i + 200) * (VW - 60), y = 492 + K.hash(i + 300) * 36; for (let p = 0; p < 5; p++) { X.beginPath(); X.arc(x + Math.cos(p * 1.257) * 5, y + Math.sin(p * 1.257) * 5, 3.5, 0, TAU); ink('#fff', 1.5); } X.beginPath(); X.arc(x, y, 3, 0, TAU); ink('#FFE14D', 1.5); }
  for (const bx of [L + 70, R - 180]) {
    rr(bx - 46, 488, 92, 44, 10); ink('#f2c94c', 4);
    X.fillStyle = '#d9a93a'; rr(bx - 46, 518, 92, 14, 6); X.fill();
    X.strokeStyle = '#c4902a'; X.lineWidth = 2; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(bx - 40 + i * 15, 494); X.lineTo(bx - 34 + i * 15, 512); X.stroke(); }
    X.strokeStyle = '#a5622c'; X.lineWidth = 4; X.beginPath(); X.moveTo(bx - 20, 488); X.lineTo(bx - 20, 532); X.moveTo(bx + 20, 488); X.lineTo(bx + 20, 532); X.stroke();
    X.fillStyle = 'rgba(255,255,255,.35)'; el(bx - 26, 494, 12, 3, -.1); X.fill();
  }
}

/* 16 ── WAIT: a drag strip. Claude sits in a soapbox kart on the start line under a giant traffic light; a sleepy tortoise
   idles in the next lane. Press only when the light turns green. Early = the kart falls apart, late = Claude naps. */
let REFLEX_BG = null;
const RF_P = {}; const rfRR = (x, y, w, h, r) => { const k = [x, y, w, h, r].join(); if (!RF_P[k]) { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); RF_P[k] = p; } return RF_P[k]; };
const RF_TX = 520;                                           // x of the traffic light post
function reflexStage() {
  const K = W3K, { rr, el, ink, TAU } = K, X = K.cx(), L = -OX, R = W + OX;
  const sky = X.createLinearGradient(0, 0, 0, 392); sky.addColorStop(0, '#3fb0ff'); sky.addColorStop(.55, '#8fdcff'); sky.addColorStop(1, '#e6fbff');
  X.fillStyle = sky; X.fillRect(L, 0, VW, 392);
  // far mountains (coloured outline) with snow caps
  for (const [off, base, ol, hh] of [[0, '#c9d0fb', '#7b80c6', 150], [90, '#a4b1f2', '#5b5fa8', 110]]) {
    X.beginPath(); X.moveTo(L, 330);
    for (let x = L - 60 + off % 70, i = 0; x < R + 120; x += 190, i++) { const h = hh * (.7 + K.hash(i + off) * .5); X.lineTo(x, 330); X.lineTo(x + 95, 330 - h); X.lineTo(x + 190, 330); }
    X.lineTo(R, 340); X.lineTo(L, 340); X.closePath(); X.fillStyle = base; X.fill(); X.lineJoin = 'round'; X.lineWidth = 4; X.strokeStyle = ol; X.stroke();
  }
  // green hills with lollipop trees
  for (const [yy, col, ol, k] of [[316, '#a9dfc6', null, 0], [336, '#87d19b', '#4f9a6a', 1]]) {
    X.beginPath(); X.moveTo(L, 380);
    for (let x = L; x <= R; x += 20) X.lineTo(x, yy - Math.sin(x * .009 + k * 2) * 18 - Math.sin(x * .021 + k) * 8);
    X.lineTo(R, 380); X.closePath(); X.fillStyle = col; X.fill(); if (ol) { X.lineWidth = 3; X.strokeStyle = ol; X.stroke(); }
  }
  for (let i = 0; i < 9; i++) { const x = L + 40 + K.hash(i + 9) * (VW - 80), y = 340 - Math.sin(x * .009 + 2) * 18 - Math.sin(x * .021 + 1) * 8;
    X.fillStyle = '#8a5a34'; X.fillRect(x - 3, y - 18, 6, 20); X.beginPath(); X.arc(x, y - 28, 15, 0, TAU); ink('#3fb260', 3); X.fillStyle = 'rgba(255,255,255,.28)'; el(x - 5, y - 34, 5, 3, -.5); X.fill(); }
  // the grandstand: back wall, bleacher steps, striped awning, wooden rail
  X.fillStyle = INK; X.fillRect(L, 304, VW, 90);
  X.fillStyle = '#c9a77a'; X.fillRect(L, 308, VW, 82);
  X.fillStyle = '#b98a58'; for (let r = 0; r < 3; r++) X.fillRect(L, 336 + r * 17, VW, 6);
  X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(L, 308, VW, 5);
  for (let x = L; x < R + 40; x += 36) { X.beginPath(); X.moveTo(x, 282); X.lineTo(x + 36, 282); X.lineTo(x + 36, 306); X.quadraticCurveTo(x + 18, 316, x, 306); X.closePath(); X.fillStyle = ((x - L) / 36 | 0) % 2 ? '#fff' : '#ff4d5e'; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
  X.fillStyle = INK; X.fillRect(L, 278, VW, 8); X.fillStyle = '#a5622c'; X.fillRect(L, 280, VW, 3);
  X.fillStyle = INK; X.fillRect(L, 372, VW, 24);
  X.fillStyle = '#e3a868'; X.fillRect(L, 376, VW, 14); X.fillStyle = '#c4874e'; X.fillRect(L, 386, VW, 4);
  X.fillStyle = INK; for (let x = L + 20; x < R; x += 90) X.fillRect(x - 4, 372, 8, 22);
  // bunting
  X.beginPath(); X.moveTo(L, 296); for (let x = L; x <= R; x += 20) X.lineTo(x, 296 + Math.sin((x - L) / 80 * Math.PI) * 6); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke();
  for (let x = L + 10, i = 0; x < R; x += 40, i++) { const y = 296 + Math.sin((x - L) / 80 * Math.PI) * 6; X.beginPath(); X.moveTo(x - 9, y); X.lineTo(x + 9, y); X.lineTo(x, y + 18); X.closePath(); ink(['#FFE14D', '#4db8ff', '#ff5c8a', '#5CFF7A'][i % 4], 2); }
  // asphalt, lanes, skids, ink horizon
  const as = X.createLinearGradient(0, 392, 0, 600); as.addColorStop(0, '#6b6a82'); as.addColorStop(1, '#3d3a52');
  X.fillStyle = as; X.fillRect(L, 392, VW, 208); X.fillStyle = INK; X.fillRect(L, 390, VW, 5);
  X.save(); X.beginPath(); X.rect(L, 395, VW, 205); X.clip(); X.strokeStyle = 'rgba(255,255,255,.07)'; X.lineWidth = 20; for (let x = L - 300; x < R; x += 80) { X.beginPath(); X.moveTo(x, 600); X.lineTo(x + 300, 395); X.stroke(); } X.restore();
  X.fillStyle = 'rgba(20,16,28,.18)'; for (let i = 0; i < 90; i++) { const x = L + K.hash(i + 400) * VW, y = 400 + K.hash(i + 500) * 150; el(x, y, 2 + K.hash(i) * 3, 1.5); X.fill(); }
  X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 7; X.lineCap = 'round'; for (const y of [488, 520]) { X.beginPath(); X.moveTo(L + 20, y); X.quadraticCurveTo(160, y - 6, 280, y); X.stroke(); }
  X.strokeStyle = '#fff'; X.lineWidth = 5; X.setLineDash([34, 22]); X.beginPath(); X.moveTo(L, 456); X.lineTo(R, 456); X.stroke(); X.setLineDash([]);
  X.beginPath(); X.moveTo(L, 549); X.lineTo(R, 549); X.stroke();
  // the start line: a checkered strip, plus a black-and-white curb in the back lane
  for (let r = 0; r < 10; r++) for (let c = 0; c < 2; c++) { X.fillStyle = (r + c) % 2 ? '#fff' : INK; X.fillRect(292 + c * 14, 398 + r * 15, 14, 15); }
  X.lineWidth = 3; X.strokeStyle = INK; X.strokeRect(292, 398, 28, 150);
  // cones in the lane line
  for (const cx of [610, 700, 790]) { X.beginPath(); X.moveTo(cx - 9, 456); X.lineTo(cx - 5, 432); X.lineTo(cx + 5, 432); X.lineTo(cx + 9, 456); X.closePath(); ink('#ff9a3c', 3); X.fillStyle = '#fff'; X.fillRect(cx - 7, 440, 14, 5); rr(cx - 12, 453, 24, 6, 3); ink('#d97a2c', 2.5); }
  // the traffic-light post: striped pole with a base plate
  X.fillStyle = INK; X.fillRect(RF_TX - 17, 318, 34, 122);
  const pole = rfRR(RF_TX - 13, 318, 26, 118, 4); X.fillStyle = '#e8eaf2'; X.fill(pole);
  X.save(); X.clip(pole); X.fillStyle = '#ff4d5e'; for (let y = 322; y < 436; y += 28) { X.beginPath(); X.moveTo(RF_TX - 14, y); X.lineTo(RF_TX + 14, y - 14); X.lineTo(RF_TX + 14, y); X.lineTo(RF_TX - 14, y + 14); X.fill(); } X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(RF_TX + 4, 318, 10, 120); X.restore();
  K.shade(RF_TX, 440, 56, 9, .3); rr(RF_TX - 36, 428, 72, 16, 7); ink('#8f9cb3', 4); X.fillStyle = 'rgba(255,255,255,.35)'; rr(RF_TX - 28, 431, 40, 4, 2); X.fill();
}
function gReflex(sp) {
  const goAt = (.9 + Math.random() * 1.5) / Math.sqrt(sp), win = 1.0 / sp;
  let clock = 0, rt = 0;
  let endAt = -1;                       // cosmetic only (art): when the verdict landed (in `now` time)
  const press = () => {
    if (g.result) return; endAt = now;
    if (clock < goAt) { g.result = 'lose'; sfx.buzz(); shake(7, .25); }
    else { rt = (clock - goAt) * 1000 | 0; g.result = 'win'; sfx.hit(); sfx.coin(); burst(RF_TX, 280, '#5CFF7A', 16); ring(RF_TX, 280, '#5CFF7A', 100); floatText(rt < 300 ? 'FAST!' : 'NICE!', W / 2 - 220, 230, '#fff'); }
  };
  const g = {
    wide: true, cmd: 'WAIT!', hint: 'PRESS ONLY AT GREEN', thint: 'TAP ONLY AT GREEN', dur: 4,
    key() { press(); }, down() { press(); },
    update(dt) {
      if (g.result) return;
      const was = clock < goAt; clock += dt;
      if (was && clock >= goAt) { sfx.pop(); sfx.blip(7); ring(RF_TX, 280, '#5CFF7A', 80, .35); }
      if (clock > goAt + win) { g.result = 'lose'; endAt = now; sfx.miss(); }
    },
    draw() {
      const K = W3K, { rr, el, ink, TAU, ease, outBack, clamp } = K, X = ctx, L = -OX, R = W + OX;
      const T = now, won = g.result === 'win', lost = g.result === 'lose', early = lost && clock < goAt, late = lost && !early;
      const rk = endAt < 0 ? 0 : now - endAt, go = clock >= goAt, tense = clamp(clock / goAt, 0, 1);
      if (!REFLEX_BG || REFLEX_BG.width !== VW) REFLEX_BG = K.bake(VW, H, c => { c.translate(OX, 0); reflexStage(); });
      X.drawImage(REFLEX_BG, -OX, 0);
      // sky life: sun, drifting clouds, an egg-shaped hot air balloon
      K.sun(116, 150, T);
      for (const [sp2, off, yy, s] of [[7, 0, 112, 1], [5, 460, 188, .8], [9, 780, 244, .6]]) K.cloud((T * sp2 + off) % (VW + 280) - 140 + L, yy, s);
      {
        const bx = (T * 16 + 300) % (VW + 340) - 170 + L, by = 254 + Math.sin(T * .9) * 6;
        X.save(); X.translate(bx, by);
        X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-18, 36); X.lineTo(-10, 66); X.moveTo(18, 36); X.lineTo(10, 66); X.stroke();
        const EG = K.pEl(0, 0, 40, 46); K.cel(EG, '#fff', '#d9d3ea', 3, 3, 4); X.fillStyle = '#ffd23f'; K.cel(K.pEl(2, 6, 18, 18), '#ffd23f', '#c99512', 2, 2, 3); K.glint(K.pEl(2, 6, 18, 18), -4, 0, 5, 3, .55);
        rr(-14, 62, 28, 18, 5); ink('#d9944f', 3.5); X.fillStyle = '#f2c94c'; el(0, 59, 8, 7); X.fill(); el(-3, 57, 1.6, 1.8); X.fillStyle = INK; X.fill(); el(3, 57, 1.6, 1.8); X.fill();
        X.restore();
      }
      // the crowd in the stand: every head is its own colour; they bob, cheer on a win, slump on a loss
      for (let i = 0; i < 70; i++) {
        const row = i % 2, x = L + 14 + (i >> 1) * 28 + K.hash(i + 31) * 10, y0 = 338 + row * 20;
        const jump = won ? Math.abs(Math.sin(rk * 9 + i)) * 9 : lost ? 0 : Math.abs(Math.sin(T * 2.4 + i * 1.7)) * 2.5 * (go ? 2.5 : 1);
        const y = y0 - jump + (lost ? 3 : 0), hue = ['#ffd6a8', '#f4b183', '#c98d62', '#ffe0c2', '#a6d86b', '#b9a8ff'][i % 6];
        X.beginPath(); X.moveTo(x - 9, y + 16); X.quadraticCurveTo(x, y + 4, x + 9, y + 16); X.closePath(); ink(['#ff4d5e', '#4db8ff', '#FFE14D', '#5CFF7A', '#ff5c8a'][(i * 3) % 5], 2.5);
        if (won) { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 8, y + 12); X.lineTo(x - 11, y - 6 - Math.sin(rk * 12 + i) * 3); X.moveTo(x + 8, y + 12); X.lineTo(x + 11, y - 6 + Math.sin(rk * 12 + i) * 3); X.stroke(); }
        X.beginPath(); X.arc(x, y, 8, 0, TAU); ink(hue, 2.5); X.fillStyle = INK;
        if (won) { X.fillRect(x - 5, y - 2, 3, 2); X.fillRect(x + 2, y - 2, 3, 2); } else { el(x - 3, y - 1, 1.5, 2); X.fill(); el(x + 3, y - 1, 1.5, 2); X.fill(); }
        if (i % 7 === 3) { X.beginPath(); X.moveTo(x - 9, y - 4); X.lineTo(x, y - 17); X.lineTo(x + 9, y - 4); X.closePath(); ink(['#ff4d5e', '#4db8ff', '#FFE14D'][i % 3], 2); }   // party hats
      }
      // ───── traffic light (on the post baked into the stage) ─────
      {
        const TX = RF_TX, cols = [['#ff4d5e', '#6b1d28', 150], ['#ffd23f', '#6b5a1d', 214], ['#5CFF7A', '#1d4a2a', 278]];
        X.save(); X.translate(TX, 0); X.rotate(Math.sin(T * 1.2) * .004); X.translate(-TX, 0);
        K.shade(TX + 8, 328, 70, 8, .25);
        const BOX = rfRR(TX - 66, 84, 132, 238, 22); K.cel(BOX, '#4a4466', '#2c2742', 7, 0, 4.5); K.glint(BOX, TX - 44, 120, 8, 60, .25, 0);
        for (const [i, [on, off, yy]] of cols.entries()) {
          const lit = i === 0 ? !go : i === 2 ? go : false, pulse = lit && i === 2 ? .5 + Math.sin(T * 20) * .5 : 0;
          X.beginPath(); X.moveTo(TX - 40, yy - 10); X.quadraticCurveTo(TX, yy - 52, TX + 40, yy - 10); X.lineTo(TX + 40, yy - 24); X.quadraticCurveTo(TX, yy - 62, TX - 40, yy - 24); X.closePath(); ink('#2c2742', 3);
          X.beginPath(); X.arc(TX, yy, 31, 0, TAU); ink(lit ? on : off, 4);
          if (lit) { X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = on; X.globalAlpha = .28 + pulse * .15; X.beginPath(); X.arc(TX, yy, 54 + pulse * 6, 0, TAU); X.fill(); X.restore(); }
          X.fillStyle = `rgba(255,255,255,${lit ? .7 : .22})`; el(TX - 10, yy - 11, 9, 5, -.6); X.fill();
        }
        X.restore();
      }
      // ───── the rival: a tortoise in a helmet in the back lane ─────
      {
        const cr = go ? clamp((clock - goAt) * 1.5, 0, 1) * 18 : 0, tx = 372 + cr + (late ? ease(rk / .8) * 120 : 0), ty = 446;
        const bob = early ? -Math.abs(Math.sin(rk * 14)) * 6 : 0;
        const SH = K.pEl(0, -30, 44, 34);
        X.save(); X.translate(tx, ty + bob); X.scale(1 + (early ? Math.sin(rk * 28) * .03 : 0), 1);
        K.shade(0, 0, 54, 8, .3);
        for (const lx of [-26, 20]) { X.beginPath(); rr(lx - 2, -14 + Math.sin(go ? T * 9 + lx : 0) * 2, 20, 16, 7); ink('#7fb35a', 3.5); }
        X.save(); X.beginPath(); X.rect(-60, -80, 120, 80); X.clip(); K.cel(SH, '#4f9a6a', '#2f7a49', 6, 0, 4.5); X.restore();
        X.save(); X.clip(SH); X.strokeStyle = '#2f7a49'; X.lineWidth = 3; for (const [a, b] of [[-14, -40], [12, -44], [-2, -22], [26, -26], [-30, -24]]) { X.beginPath(); for (let k = 0; k < 6; k++) X.lineTo(a + Math.cos(k * 1.047 + .5) * 11, b + Math.sin(k * 1.047 + .5) * 9); X.closePath(); X.stroke(); } X.restore();
        K.glint(SH, -16, -52, 11, 4, .4, -.4);
        const HD = K.pEl(50, -34, 19, 16); K.cel(HD, '#a6d86b', '#7fb35a', 3, 3, 4); K.glint(HD, 44, -42, 5, 3, .5, -.5);
        const em = early ? 'happy' : won ? 'panic' : go ? 'idle' : 'idle';
        X.fillStyle = INK; X.strokeStyle = INK;
        if (!go && !won && !early) {   // sleepy: lid drooping over the eye
          K.eye(52, -38, 7, 'idle', [-1, 0], T, 2); X.fillStyle = '#a6d86b'; X.beginPath(); X.rect(44, -47, 18, 9 + Math.sin(T * 1.2) * 1.5); X.fill(); X.lineWidth = 2.5; X.beginPath(); X.moveTo(45, -38 + Math.sin(T * 1.2) * 1.5); X.lineTo(60, -38 + Math.sin(T * 1.2) * 1.5); X.stroke();
          if (Math.sin(T * 1.1) > .6) { el(64, -30, 3.2, 4.4 * Math.max(0, Math.sin(T * 1.1))); ink('#7a3040', 1.5); }   // a yawn
        } else K.eye(52, -38, 7, em, [1, 0], T, 2);
        X.lineWidth = 3; X.beginPath(); if (early) { X.moveTo(58, -26); X.quadraticCurveTo(64, -16, 66, -28); X.stroke(); X.beginPath(); el(62, -24, 5, 4 + Math.abs(Math.sin(rk * 20)) * 2); ink('#7a3040', 1.8); } else if (won) { el(62, -24, 3, 4); ink('#7a3040', 1.8); } else { X.moveTo(58, -26); X.lineTo(66, -26); X.stroke(); }
        X.fillStyle = 'rgba(255,110,165,.55)'; el(46, -28, 4, 2.6); X.fill();
        X.beginPath(); X.moveTo(34, -44); X.quadraticCurveTo(52, -66, 68, -44); X.closePath(); ink('#ffd23f', 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(46, -54, 6, 2.4, -.4); X.fill();   // tiny helmet
        X.restore();
      }
      // ───── the foot pedal plate (controls) ─────
      {
        const px = 678, py = 478, down = g.result ? 6 : (go ? Math.max(0, Math.sin(T * 20)) * 3 : 0), grey = !!g.result;
        K.shade(px + 6, py + 52, 78, 9, .3);
        rr(px - 76, py - 36 + 9, 152, 84, 20); ink(grey ? '#8f88a6' : '#b8283a', 4);
        rr(px - 76, py - 36 + 9 - 9 + down, 152, 84, 20); ink(grey ? '#d3cfe0' : '#ff4d5e', 4);
        X.fillStyle = 'rgba(255,255,255,.35)'; rr(px - 66, py - 30 + down, 70, 7, 3.5); X.fill();
        rr(px - 50, py - 20 + down, 100, 32, 10); ink(grey ? '#8f88a6' : '#3b3550', 3.5); X.strokeStyle = grey ? '#d3cfe0' : '#5a5274'; X.lineWidth = 3; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(px - 38 + i * 24, py - 14 + down); X.lineTo(px - 38 + i * 24, py + 6 + down); X.stroke(); }
        if (go && !g.result) { X.strokeStyle = `rgba(255,255,255,${.5 + Math.sin(T * 14) * .4})`; X.lineWidth = 4; rr(px - 84, py - 38, 168, 90, 24); X.stroke(); }
        if (!TOUCH) K.keyCap('SPACE', px, py + 30 + down);
      }
      // ───── Claude's soapbox kart ─────
      {
        const u = 5.2;
        let kx = 178, ky = 532, spin = 0, sink = 0, flame = 0, lurch = 0, wheels = true;
        if (!g.result && go) flame = .75 + Math.sin(T * 40) * .2;
        const jit = !g.result ? Math.sin(T * 50) * (go ? 1.4 : tense * tense * 1.1) : 0;
        if (won) { const d = 1700 * rk * rk; kx += d; spin = d / 24; flame = 1; }
        if (early) { lurch = 52 * ease(rk / .14); kx += lurch; sink = ease((rk - .14) / .1) * 17; wheels = false; }
        const mood = won ? 'happy' : early ? 'sad' : null, ex = kx + (early ? 0 : 0);
        // dust + speed lines behind a launching kart
        if (won) {
          for (let i = 0; i < 7; i++) { const q = rk * 2.4 - i * .11; if (q > 0 && q < 1) K.puff(kx - 90 - i * 34 - q * 30, ky - 14 - (i % 3) * 7, 14 + q * 10, .8 * (1 - q)); }
          X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 6; i++) { const yy = 462 + i * 14, ln = 120 + (i % 3) * 50; X.beginPath(); X.moveTo(kx - 90 - ln - (i % 2) * 30, yy); X.lineTo(kx - 90 - (i % 2) * 30, yy); X.stroke(); }
        }
        X.save(); X.translate(kx, ky + jit * .5 + sink * .4); X.scale(1.2, 1.2);
        if (early) X.rotate(-ease((rk - .14) / .2) * .04);
        K.shade(0, 2 - sink * .4, 90, 10, .32);
        // exhaust flame out the back
        if (flame > 0) { const fl = 36 * flame + Math.sin(T * 60) * 5; X.beginPath(); X.moveTo(-72, -44); X.quadraticCurveTo(-72 - fl * .7, -50, -72 - fl, -36); X.quadraticCurveTo(-72 - fl * .7, -26, -72, -30); X.closePath(); ink('#ff9a3c', 3.5); X.beginPath(); X.moveTo(-72, -41); X.quadraticCurveTo(-72 - fl * .45, -44, -72 - fl * .6, -37); X.quadraticCurveTo(-72 - fl * .45, -32, -72, -34); X.closePath(); X.fillStyle = '#ffe14d'; X.fill(); }
        // Claude at the wheel
        const fy = -47 + sink * .3, bobN = won ? Math.sin(T * 16) * 1.2 : 0, cl = TOUCH ? 0 : 0;
        X.save(); X.translate(0, bobN);
        const armUp = won ? 1 : go ? .75 : early ? .1 : late ? 0 : .5;
        X.save(); X.translate(0, fy); K.arms(u, won ? -.2 : go ? -.3 : -.5, won ? .2 : go ? .3 : .5, armUp, OR); X.restore();
        claude(0, fy, u, { mood });
        const exy = fy - 6.2 * u;
        if (late) { X.fillStyle = OR; for (const sx of [-1, 1]) X.fillRect(sx * 2.8 * u - 1.4 * u, exy - 1.5 * u, 2.8 * u, 3 * u); X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; for (const sx of [-1, 1]) { X.beginPath(); X.arc(sx * 2.8 * u, exy - .2 * u, u * .9, .2 * Math.PI, .8 * Math.PI); X.stroke(); } }
        // goggles (see-through, so the eyes still read) + a red racing helmet
        X.lineWidth = 4; X.strokeStyle = INK; X.beginPath(); X.moveTo(-6 * u, exy); X.lineTo(6 * u, exy); X.stroke();
        for (const sx of [-1, 1]) { X.beginPath(); X.arc(sx * 2.8 * u, exy, u * 1.45, 0, TAU); X.lineWidth = 6.4; X.strokeStyle = INK; X.stroke(); X.fillStyle = 'rgba(127,231,255,.38)'; X.fill(); X.lineWidth = 2.5; X.strokeStyle = '#7fe7ff'; X.stroke(); X.fillStyle = 'rgba(255,255,255,.7)'; el(sx * 2.8 * u - u * .6, exy - u * .7, u * .4, u * .3, -.6); X.fill(); }
        const HEL = rfRR(-6.4 * u, fy - 9 * u - 7, 12.8 * u, 17, 8); K.cel(HEL, '#ff4d5e', '#b8283a', 3, 2, 4); X.save(); X.clip(HEL); X.fillStyle = '#fff'; X.fillRect(-5, fy - 9 * u - 9, 10, 30); X.restore(); K.glint(HEL, -u * 3, fy - 9 * u - 2, 9, 3, .55, -.2);
        // the mouth: calm line, gritted teeth when tense, big grin on go, frown or snore
        X.lineCap = 'round'; X.strokeStyle = INK; X.fillStyle = INK; X.lineWidth = 3; const my = fy - 3.4 * u;
        if (won) { X.beginPath(); X.arc(0, my - 2, 8, .1, Math.PI - .1); X.closePath(); X.fillStyle = INK; X.fill(); X.fillStyle = '#ff7aa8'; el(0, my + 6, 4, 2.6); X.fill(); }
        else if (early) { X.beginPath(); X.arc(0, my + 8, 8, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); }
        else if (late) { el(0, my + 2, 3.5, 3 + Math.sin(T * 2.4) * 1.2); X.fill(); }
        else if (go) { X.beginPath(); X.arc(0, my - 2, 8, .1, Math.PI - .1); X.closePath(); X.fill(); }
        else if (tense > .55) { X.beginPath(); X.moveTo(-8, my); X.lineTo(8, my); X.stroke(); X.lineWidth = 2; X.beginPath(); for (let i = -2; i <= 2; i++) { X.moveTo(i * 3.2, my - 3); X.lineTo(i * 3.2, my + 3); } X.stroke(); }
        else { X.beginPath(); X.moveTo(-6, my); X.quadraticCurveTo(0, my + 3, 6, my); X.stroke(); }
        X.restore();
        // soapbox body: planks, racing stripe and a number roundel
        const BODY = rfRR(-78, -50 + sink, 156, 36, 12); K.cel(BODY, '#d9944f', '#a5622c', 0, -7, 4.5);
        X.save(); X.clip(BODY); X.strokeStyle = '#b06d33'; X.lineWidth = 2.5; for (const yy of [-38, -26]) { X.beginPath(); X.moveTo(-78, yy + sink); X.lineTo(78, yy + sink); X.stroke(); } X.fillStyle = '#fff'; X.fillRect(-78, -44 + sink, 156, 5); X.restore();
        K.glint(BODY, -40, -45 + sink, 26, 3, .5, -.05);
        X.beginPath(); X.arc(-30, -31 + sink, 11, 0, TAU); ink('#fff', 3); star(-30, -31 + sink, 7, 3.2, 5, -Math.PI / 2, '#FFE14D', 1.5);
        rr(60, -46 + sink, 36, 26, 12); ink('#ff4d5e', 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(66, -42 + sink, 18, 5, 2.5); X.fill();
        rr(-86, -48 + sink, 14, 14, 5); ink('#8f9cb3', 3.5);
        // wheels (these fly off on a false start)
        const wheel = (wx, wy, a) => {
          X.save(); X.translate(wx, wy); X.rotate(a); X.beginPath(); X.arc(0, 0, 24, 0, TAU); ink('#3b3550', 4.5); X.beginPath(); X.arc(0, 0, 11, 0, TAU); ink('#cfd8e6', 3.5);
          X.strokeStyle = '#8f9cb3'; X.lineWidth = 3.5; for (let i = 0; i < 4; i++) { X.rotate(Math.PI / 4); X.beginPath(); X.moveTo(-10, 0); X.lineTo(10, 0); X.stroke(); }
          X.fillStyle = 'rgba(255,255,255,.28)'; el(-9, -13, 8, 3.4, -.7); X.fill(); X.restore();
        };
        if (wheels) { const rev = !g.result ? T * (go ? 30 : 0) : spin; wheel(-46, -24, rev); wheel(46, -24, rev); }
        else {
          const q = Math.max(0, rk - .14);
          wheel(46 + q * 420, -24 - Math.abs(Math.sin(q * 6)) * 54 * (1 - Math.min(1, q / .9)) + (q > 0 ? 0 : 0), q * 22);
          wheel(-46 - q * 90, -24 + 2 - Math.abs(Math.sin(q * 7 + 1)) * 40 * (1 - Math.min(1, q / .8)), -q * 14);
        }
        // a false start: bolts and stars fly, Claude sees stars
        if (early) { for (let i = 0; i < 4; i++) { const a = rk * 7 + i * 1.57; star(Math.cos(a) * 46, -112 + Math.sin(a) * 9, 7, 3, 5, a, '#FFE14D', 2); } for (let i = 0; i < 5; i++) { const q = (rk * 1.1 + i * .17); if (q > .1 && q < .9) { X.fillStyle = '#8f9cb3'; X.save(); X.translate(-20 + i * 26 + Math.cos(i * 2) * q * 70, -50 - Math.sin(q * 3.1) * 50 + q * q * 70); X.rotate(q * 12 + i); rr(-5, -2, 10, 4, 2); ink('#c9ced6', 2); X.restore(); } } }
        X.restore();
        // sweat while tense; Zs while asleep
        if (!g.result && tense > .5) { K.sweat(kx - 44, ky - 128, 1, T); K.sweat(kx + 44, ky - 122, .9, T + .5); }
        if (late) for (let i = 0; i < 3; i++) { const q = (rk * .9 + i * .3) % 1; K.zee(kx + 44 + i * 14 + q * 12, ky - 130 - q * 50, .8 + i * .15, 1 - q); }
        // late: a tumbleweed rolls across the strip
        if (late) { const tx = L - 30 + ease(rk / .9) * (VW + 60); X.save(); X.translate(tx, 520 - Math.abs(Math.sin(rk * 8)) * 12); X.rotate(rk * 10); X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.arc(0, 0, 18, 0, TAU); X.stroke(); X.strokeStyle = '#c4902a'; X.lineWidth = 3; X.beginPath(); X.arc(0, 0, 18, 0, TAU); X.moveTo(-14, -8); X.lineTo(14, 8); X.moveTo(-14, 8); X.lineTo(14, -8); X.moveTo(0, -18); X.lineTo(0, 18); X.stroke(); X.restore(); }
      }
      // verdict words: a chunky badge, off-centre so the stamp stays readable
      if (g.result) {
        const bw = (s, size) => { X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; return X.measureText(t(s)).width + 40; };
        const s = won ? rt + ' ms' : early ? 'TOO SOON!' : null;
        if (s) {
          const size = won ? 48 : 40, w = bw(s, size), a = outBack(rk / .25), bgc = won ? '#5CFF7A' : '#ff4d5e', fg = won ? INK : '#fff';
          X.save(); X.translate(285, 104); X.rotate(-.05); X.scale(a, a);
          X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -26 + 7, w, 52, 24); X.fill();
          rr(-w / 2, -26, w, 52, 24); ink(bgc, 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(-w / 2 + 12, -21, w - 24, 8, 4); X.fill();
          txt(s, 0, 2, size, fg, 'center', w - 30);
          X.restore();
        }
      }
      vignette(.18);
    }
  };
  return g;
}

/* 17 ── BEAT IT: pick the move that beats the opponent (1 2 3 or click) */
function gRps(sp) {
  const o = Math.random() * 3 | 0, names = ['ROCK', 'PAPER', 'SCISSORS'];
  let picked = -1, pk = 1;
  const icon = (k, cx, cy, s) => {
    if (k === 0) { circ(cx, cy, s * .8, '#9a9aa8', 5); ctx.fillStyle = '#c8c8d4'; ctx.fillRect(cx - s * .45, cy - s * .4, s * .3, s * .22); }
    else if (k === 1) { box(cx - s * .7, cy - s * .85, s * 1.4, s * 1.7, '#fff', 5); ctx.fillStyle = '#9ad'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - s * .45, cy - s * .5 + i * s * .45, s * .9, s * .12); }
    else {
      ctx.lineCap = 'round';
      for (const [w, c] of [[s * .42, INK], [s * .26, '#ff5a4d']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx - s * .8, cy - s * .8); ctx.lineTo(cx + s * .5, cy + s * .5); ctx.moveTo(cx + s * .8, cy - s * .8); ctx.lineTo(cx - s * .5, cy + s * .5); ctx.stroke(); }
      circ(cx - s * .55, cy + s * .7, s * .26, '#FFE14D', 4); circ(cx + s * .55, cy + s * .7, s * .26, '#FFE14D', 4); ctx.lineCap = 'butt';
    }
  };
  const choose = c => {
    if (g.result) return; picked = c; g.result = (c - o + 3) % 3 === 1 ? 'win' : 'lose'; pk = 0;
    if (g.result === 'win') { sfx.hit(); sfx.coin(); burst(200 + c * 220, 440, '#5CFF7A', 14); floatText('NICE!', 400, 320, '#fff'); } else { sfx.buzz(); shake(6, .22); burst(200 + c * 220, 440, '#FF4D4D', 10); }
  };
  const g = {
    wide: true, cmd: 'BEAT IT!', hint: 'PICK WHAT BEATS IT', thint: 'TAP WHAT BEATS IT', dur: 4.5,
    key(e) { const v = +e.key; if (v >= 1 && v <= 3) choose(v - 1); },
    down(p) { const i = Math.floor((p.x - 100) / 220); if (i >= 0 && i < 3 && p.x - 100 - i * 220 <= 200 && p.y > 380 && p.y < 520) choose(i); },
    update(dt) { pk = Math.min(1, pk + dt * 5); },
    draw(t) {
      bg('#F4A6C0', '#ee95b3', t);
      box3(300, 90, 200, 200, 'rgba(255,255,255,.55)', 6); icon(o, 400, 190 + Math.sin(now * 6) * 4, 62);
      for (let i = 0; i < 3; i++) {
        const show = g.result && i === picked;
        const pop = show ? 1 + Math.sin(pk * Math.PI) * .1 : 1; ctx.save(); ctx.translate(200 + i * 220, 450); ctx.scale(pop, pop); ctx.translate(-200 - i * 220, -450);
        box3(100 + i * 220, 380, 200, 140, show ? (g.result === 'win' ? '#5CFF7A' : '#FF4D4D') : '#fff', 5, show ? 3 : 6);
        icon(i, 200 + i * 220, 440, 32); txt((i + 1) + ' ' + window.t(names[i]), 200 + i * 220, 500, 22, INK); ctx.restore();
      }
    }
  };
  return g;
}

/* 18 ── SOLVE: a TV quiz show. A walrus host reads the sum off a bulb board, Claude buzzes from the contestant
   podium, and a wrong answer tips the gunge bucket. Quick maths (1 2 3 or click). */
function gMath(sp) {
  let a = 2 + Math.random() * 8 | 0, b = 2 + Math.random() * 7 | 0, op = ['+', '-', 'x'][sp > 1.5 ? Math.random() * 3 | 0 : Math.random() * 2 | 0];
  if (op === '-' && b > a) [a, b] = [b, a];
  if (op === 'x') { a = 2 + Math.random() * 5 | 0; b = 2 + Math.random() * 4 | 0; }
  const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const opts = [ans]; while (opts.length < 3) { const v = ans + ((Math.random() * 7 | 0) - 3); if (v >= 0 && !opts.includes(v)) opts.push(v); }
  shuffle(opts); let picked = -1, pk = 1;
  let endAt = -1;                       // cosmetic only (art): when the verdict landed (in `now` time)
  const choose = i => {
    if (g.result) return; picked = i; g.result = opts[i] === ans ? 'win' : 'lose'; pk = 0;
    if (g.result === 'win') { sfx.hit(); sfx.coin(); burst(200 + i * 220, 405, '#5CFF7A', 14); ring(200 + i * 220, 405, '#fff', 90); floatText('NICE!', 400, 260, '#fff'); } else { sfx.buzz(); shake(6, .22); burst(200 + i * 220, 405, '#FF4D4D', 10); }
  };
  const g = {
    wide: true, cmd: 'SOLVE!', hint: 'PICK THE ANSWER (1 2 3)', thint: 'TAP THE ANSWER', dur: 5,
    key(e) { const v = +e.key; if (v >= 1 && v <= 3) choose(v - 1); },
    down(p) { const i = Math.floor((p.x - 100) / 220); if (i >= 0 && i < 3 && p.x - 100 - i * 220 <= 200 && p.y > 340 && p.y < 470) choose(i); },
    update(dt) { pk = Math.min(1, pk + dt * 5); if (g.result && endAt < 0) endAt = now; },
    draw() {
      const K = W3K, { rr, el, ink, TAU, ease, outBack, clamp } = K, X = ctx;
      const won = g.result === 'win', lost = g.result === 'lose', rk = endAt < 0 ? 0 : now - endAt;
      if (!QUIZ_BG || QUIZ_BG.width !== VW) QUIZ_BG = K.bake(VW, H, c => { c.translate(OX, 0); quizStage(); });
      X.drawImage(QUIZ_BG, -OX, 0);
      // the question board: a bulb marquee; the bulbs chase while you think, go rainbow on the win and dead red on the fail
      {
        const n = 34;
        for (let i = 0; i < n; i++) {
          const q = i / n, per = 2 * (520 + 200), d = q * per;
          const bx = d < 520 ? 140 + d : d < 720 ? 660 : d < 1240 ? 660 - (d - 720) : 140, by = d < 520 ? 66 : d < 720 ? 66 + (d - 520) : d < 1240 ? 266 : 266 - (d - 1240);
          const on = won ? 1 : lost ? (i % 2 ? .25 : 1) : (Math.floor(now * 8) + i) % 3 === 0 ? 1 : .35;
          const col = won ? `hsl(${(i * 30 + now * 600) % 360},90%,62%)` : lost ? '#ff4d5e' : '#FFE14D';
          X.beginPath(); X.arc(bx, by, 6.5, 0, TAU); ink(on > .5 ? col : '#8a7a3a', 2);
          if (on > .5) { X.fillStyle = 'rgba(255,255,255,.7)'; X.beginPath(); X.arc(bx - 2, by - 2, 2, 0, TAU); X.fill(); }
        }
        txt(`${a} ${op} ${b} = ?`, W / 2, 168, 96, '#fff', 'center', 450);
      }
      // the host: a walrus in a bow tie behind the right podium, reading the card and reacting to the answer
      {
        const hx = 728, hy = 236 + Math.sin(now * 3.1) * 2 + (won ? -Math.abs(Math.sin(rk * 9)) * 8 : 0), shakeH = lost ? Math.sin(rk * 18) * .12 * Math.max(0, 1 - rk) : 0;
        X.save(); X.translate(hx, hy); X.rotate(shakeH);
        const BODY = K.pEl(0, 76, 52, 56); K.cel(BODY, '#b98a6a', '#8d6247', 6, 0, 4.5); K.glint(BODY, -22, 40, 10, 16, .3, -.3);
        rr(-30, 46, 60, 60, 14); X.fillStyle = '#fff'; X.fill();                                   // shirt front
        X.beginPath(); X.moveTo(-20, 52); X.lineTo(0, 62); X.lineTo(-20, 72); X.closePath(); ink('#ff4d5e', 2.5);
        X.beginPath(); X.moveTo(20, 52); X.lineTo(0, 62); X.lineTo(20, 72); X.closePath(); ink('#ff4d5e', 2.5);
        X.beginPath(); X.arc(0, 62, 5, 0, TAU); ink('#b8283a', 2);
        const HEAD = K.pEl(0, 0, 40, 36); K.cel(HEAD, '#c99a78', '#9b6f50', 5, 2, 4.5); K.glint(HEAD, -16, -20, 12, 7, .35, -.5);
        for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 9, 16); X.quadraticCurveTo(s * 11, 44 + (won ? -6 : 0), s * 5, 50 + (won ? -6 : 0)); X.lineTo(s * 3, 18); X.closePath(); ink('#fff8e8', 2.5); }
        for (const s of [-1, 1]) { el(s * 13, 12, 15, 12); ink('#e8c39b', 3); }
        X.fillStyle = '#8d6247'; for (const [dx, dy] of [[-18, 10], [-11, 15], [-20, 17], [11, 15], [18, 10], [20, 17]]) { X.beginPath(); X.arc(dx, dy, 1.6, 0, TAU); X.fill(); }
        el(0, 3, 9, 6); ink('#3d2a22', 2); X.fillStyle = 'rgba(255,255,255,.6)'; el(-3, 1, 3, 1.6); X.fill();
        const hm = won ? 'happy' : lost ? 'bonk' : 'idle', look = picked >= 0 ? [clamp((200 + picked * 220 - hx) / 200, -1, 1), .6] : [-.9, .5];
        K.eye(-14, -14, 8, hm, look, now, 0); K.eye(14, -14, 8, hm, look, now, 1);
        X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();
        const br = won ? -6 : lost ? 4 : Math.sin(now * 2) > .6 ? -4 : 0;
        X.moveTo(-22, -28 + br); X.lineTo(-8, -26 - (lost ? -3 : 0)); X.moveTo(22, -28 + br); X.lineTo(8, -26 - (lost ? -3 : 0)); X.stroke();
        // a microphone in one flipper, a stack of cue cards in the other
        X.save(); X.translate(-44, 54); X.rotate(-.5 + (won ? Math.sin(now * 12) * .3 : 0));
        rr(-5, -32, 10, 34, 4); ink('#5a5274', 2.5); X.beginPath(); X.arc(0, -36, 10, 0, TAU); ink('#c9ced6', 3);
        X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { X.beginPath(); X.moveTo(-8, -36 + i * 4); X.lineTo(8, -36 + i * 4); X.stroke(); }
        X.restore();
        el(-44, 60, 13, 10, -.4); ink('#b98a6a', 3);
        if (!won) { X.save(); X.translate(46, 44); X.rotate(.25); rr(-14, -20, 28, 36, 4); ink('#fff3c4', 3); X.fillStyle = '#c98443'; for (let i = 0; i < 3; i++) X.fillRect(-8, -12 + i * 8, 16, 2.5); X.restore(); }
        el(44, 56, 13, 10, .4); ink('#b98a6a', 3);
        X.restore();
        if (won) for (let i = 0; i < 5; i++) {                              // the cue cards fly up like confetti
          const q = clamp(rk / 1.1, 0, 1), vx = (K.hash(i + 11) - .5) * 260, vy = -360 - K.hash(i + 22) * 180;
          const cx2 = hx + 46 + vx * q, cy2 = hy + 44 + vy * q + 620 * q * q;
          X.save(); X.translate(cx2, cy2); X.rotate(q * (6 + i) * (i % 2 ? 1 : -1)); rr(-12, -16, 24, 32, 4); ink('#fff3c4', 2.5); X.restore();
        }
        if (lost) K.sweat(hx + 34, hy - 36, 1.2, now);
      }
      // the three answer podiums (same hit boxes as always: 100 + i * 220, y 340..470)
      for (let i = 0; i < 3; i++) {
        const show = g.result && (opts[i] === ans || i === picked), right = opts[i] === ans, x = 100 + i * 220, cx = x + 100;
        const pop = i === picked ? 1 + Math.sin(pk * Math.PI) * .1 : 1, press = i === picked && pk < 1 ? 6 : 0;
        X.save(); X.translate(cx, 405); X.scale(pop, pop); X.translate(-cx, -405);
        const off = g.result && !show;
        const [face, base] = show ? (right ? ['#4fd06a', '#24803a'] : ['#ff4d5e', '#b8283a']) : off ? ['#d3cfe0', '#8f88a6'] : ['#6a5ae0', '#3a2d9a'];
        if (off) X.globalAlpha = .8;
        rr(x, 349, 200, 121, 20); ink(base, 4);
        rr(x, 340 + press, 200, 121 - press - 9, 20); ink(face, 4);
        X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 14, 346 + press, 172, 8, 4); X.fill();
        rr(x + 22, 356 + press, 156, 72, 14); ink(show ? (right ? '#145c28' : '#6e1622') : off ? '#a9a3bb' : '#1d1840', 3);
        X.fillStyle = 'rgba(255,255,255,.12)'; rr(x + 28, 360 + press, 70, 10, 5); X.fill();
        txt(String(opts[i]), cx, 393 + press, 60, show && right && won ? '#FFE14D' : '#fff');
        if (show && !right) { X.lineCap = 'round'; for (const [w, c] of [[9, INK], [4, '#fff']]) { X.lineWidth = w; X.strokeStyle = c; X.beginPath(); X.moveTo(cx + 54, 364 + press); X.lineTo(cx + 70, 380 + press); X.moveTo(cx + 70, 364 + press); X.lineTo(cx + 54, 380 + press); X.stroke(); } }
        for (let j = 0; j < 7; j++) {                                        // a row of bulbs under the screen
          const lit = show && right ? Math.sin(now * 20 + j) > 0 : !g.result && (Math.floor(now * 6) + j + i) % 4 === 0;
          X.beginPath(); X.arc(x + 40 + j * 20, 440 + press, 4.5, 0, TAU); ink(lit ? '#FFE14D' : 'rgba(255,255,255,.35)', 1.5);
        }
        if (!TOUCH) K.keyCap(String(i + 1), cx, 458 + press * .5);
        X.globalAlpha = 1; X.restore();
      }
      // Claude on the contestant podium (left); the gunge bucket hangs over it from the lighting rig
      {
        const cx = 58, cy = 336, u = 5.2, jump = won ? Math.abs(Math.sin(rk * 9)) * 16 : 0;
        const tip = lost ? ease(rk / .2) * 2.1 : 0, pour = lost ? clamp((rk - .12) / .25, 0, 1) : 0, cover = lost ? clamp((rk - .25) / .3, 0, 1) : 0;
        if (won) K.rays(cx, cy - 30, 120 * ease(rk / .25), now, .45);
        X.save(); X.translate(cx, cy - jump);
        const br = Math.sin(now * 3.1) * .025; X.scale(1 - br, 1 + br);
        if (won) { const w = Math.sin(now * 14) * .3; K.arms(u, -.45 + w, .45 - w, ease(rk / .2)); }
        else if (lost) K.arms(u, -2.5, 2.5, 1);
        else K.arms(u, -.5, .4 + Math.sin(now * 5) * .1, 1);
        claude(0, 0, u, { mood: won ? 'happy' : lost ? 'sad' : null });
        X.restore();
        if (!won && !lost) K.sweat(cx + 36, cy - 50, 1, now);
        // the gunge (drawn over Claude): a stream from the bucket, then a green blob dripping down
        if (pour > 0 && pour < 1 || (lost && rk < .55)) { X.beginPath(); X.moveTo(cx - 12, 216); X.quadraticCurveTo(cx - 4, 260, cx - 8, cy - 48); X.lineCap = 'round'; X.lineWidth = 24 * (1 - Math.max(0, (rk - .4) / .15)) + 4; X.strokeStyle = INK; X.stroke(); X.lineWidth = Math.max(1, 24 * (1 - Math.max(0, (rk - .4) / .15)) - 4); X.strokeStyle = '#7fd34a'; X.stroke(); }
        if (cover > 0) {
          X.save(); X.translate(cx, cy);
          X.beginPath(); X.moveTo(-46, -30); X.quadraticCurveTo(-48, -54, -20, -52); X.quadraticCurveTo(0, -62, 22, -52); X.quadraticCurveTo(48, -54, 46, -30);
          for (let d = 0; d < 6; d++) { const dx = 40 - d * 16, len = (8 + K.hash(d + 40) * 22) * cover + Math.sin(now * 3 + d) * 2; X.lineTo(dx, -30 + len * .3); X.quadraticCurveTo(dx - 4, -30 + len, dx - 8, -30 + len * .3); }
          X.closePath(); ink('#7fd34a', 3.5); X.fillStyle = 'rgba(255,255,255,.4)'; el(-22, -48, 9, 3.5, -.2); X.fill();
          for (let d = 0; d < 3; d++) { const q = (rk * 1.3 + d / 3) % 1; X.beginPath(); X.arc(-30 + d * 30, -20 + q * 40, 4, 0, TAU); X.globalAlpha = 1 - q; ink('#7fd34a', 1.5); X.globalAlpha = 1; }
          X.restore();
        }
        // the bucket on its rig
        X.save(); X.translate(cx - 12, 172); X.rotate(-tip);
        K.line([[-16, -14], [0, -26], [16, -14]], 2.5, '#c9ced6');
        X.beginPath(); X.moveTo(-22, -14); X.lineTo(22, -14); X.lineTo(17, 34); X.lineTo(-17, 34); X.closePath(); ink('#c9ced6', 4);
        X.fillStyle = '#8f9cb3'; X.beginPath(); X.moveTo(10, -14); X.lineTo(22, -14); X.lineTo(17, 34); X.lineTo(8, 34); X.closePath(); X.fill();
        X.fillStyle = 'rgba(255,255,255,.5)'; rr(-16, -8, 5, 30, 2.5); X.fill();
        if (pour < 1) { el(0, -14, 20, 4.5); ink('#7fd34a', 2); }
        X.restore();
        if (!lost) K.tag(cx, cy - 9 * u - 26 - jump + Math.sin(now * 3) * 2);
      }
      // the audience in the dark: backs of heads bobbing; a fan with a heart sign; on the win they cheer
      for (let i = 0, x = -OX + 30; x < W + OX; i++, x += 58) {
        const hop = won ? Math.abs(Math.sin(rk * 10 + i)) * 10 : lost ? Math.abs(Math.sin(rk * 14 + i)) * 4 : Math.sin(now * 2 + i) * 1.5;
        const hy = 528 - hop + (i % 2) * 6;
        rr(x - 26, hy + 8, 52, 40, 16); ink('#2a2050', 3); el(x, hy, 19, 20); ink('#2a2050', 3);
        X.fillStyle = 'rgba(160,140,255,.35)'; el(x - 7, hy - 9, 6, 9, -.4); X.fill();
        if (won) for (const s of [-1, 1]) K.line([[x + s * 20, hy + 12], [x + s * 30, hy - 22 - Math.sin(now * 16 + i) * 5]], 6, '#2a2050');
        if (i === 3) {                                                         // the fan's sign: a heart and a pixel Claude
          const sy = hy - 30 - (won ? Math.abs(Math.sin(rk * 10)) * 10 : 0);
          K.line([[x, hy - 8], [x, sy + 20]], 4, '#e3ac66');
          X.save(); X.translate(x, sy); X.rotate(Math.sin(now * 3) * .1 + (won ? Math.sin(now * 16) * .25 : 0));
          rr(-34, -22, 68, 44, 6); ink('#fff', 3);
          K.heart(-14, 2, .8, 1);
          X.fillStyle = OR; X.fillRect(4, -8, 22, 14); X.fillRect(2, -4, 26, 5); X.fillStyle = INK; X.fillRect(9, -5, 3, 4); X.fillRect(18, -5, 3, 4);
          X.restore();
        }
      }
      if (won) for (let i = 0; i < 26; i++) {                                // streamers from the rig
        const q = ((rk * .9 + K.hash(i)) % 1), x = -OX + K.hash(i + 3) * VW, y = 150 + q * 390;
        X.save(); X.translate(x + Math.sin(rk * 6 + i) * 12, y); X.rotate(rk * 8 + i); X.fillStyle = ['#ff5c8a', '#FFE14D', '#4db8ff', '#5CFF7A'][i % 4]; X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.rect(-3, -9, 6, 18); X.stroke(); X.fill(); X.restore();
      }
      vignette(.2);
    }
  };
  return g;
}
/* SOLVE's baked stage: purple wall, velvet curtains + valance, spotlight beams, the marquee frame and screen,
   the contestant podium, the lighting rig the bucket hangs from, the stage floor */
let QUIZ_BG = null;
function quizStage() {
  const K = W3K, { rr, el, ink, TAU } = K, X = K.cx(), L = -OX, R = W + OX;
  const wall = X.createLinearGradient(0, 0, 0, 470); wall.addColorStop(0, '#2a1f63'); wall.addColorStop(1, '#5a3fae');
  X.fillStyle = wall; X.fillRect(L, 0, VW, 480);
  X.fillStyle = 'rgba(255,255,255,.05)'; for (let x = L; x < R; x += 60) X.fillRect(x, 0, 28, 480);
  X.fillStyle = 'rgba(255,225,77,.35)'; for (let x = L + 20; x < R; x += 60) for (let y = 300; y < 470; y += 40) { X.beginPath(); X.arc(x, y, 2.5, 0, TAU); X.fill(); }
  // spotlight beams onto the podiums
  X.save(); X.globalCompositeOperation = 'lighter';
  for (const bx of [58, 200, 420, 640]) { X.fillStyle = 'rgba(255,240,190,.07)'; X.beginPath(); X.moveTo(bx + 60, 50); X.lineTo(bx + 90, 50); X.lineTo(bx + 60, 470); X.lineTo(bx - 50, 470); X.fill(); }
  X.restore();
  // stage floor: planks + a hard ink edge
  const fl = X.createLinearGradient(0, 470, 0, 600); fl.addColorStop(0, '#b97a46'); fl.addColorStop(1, '#8a5530');
  X.fillStyle = fl; X.fillRect(L, 470, VW, 130); X.fillStyle = INK; X.fillRect(L, 468, VW, 4);
  X.strokeStyle = 'rgba(80,40,20,.45)'; X.lineWidth = 2; for (let y = 492; y < 600; y += 24) { X.beginPath(); X.moveTo(L, y); X.lineTo(R, y); X.stroke(); }
  for (let y = 472, r = 0; y < 600; y += 24, r++) for (let x = L + (r % 2) * 70; x < R; x += 140) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 20); X.stroke(); }
  // curtains at both sides, then the valance with gold fringe
  const curtain = (x0, w, flip) => {
    X.save(); X.translate(x0, 0); if (flip) X.scale(-1, 1);
    const p = new Path2D(); p.moveTo(-200, 0); p.lineTo(w, 0); p.quadraticCurveTo(w - 30, 220, w - 6, 300); p.quadraticCurveTo(w - 30, 380, w + 4, 476); p.lineTo(-200, 476); p.closePath();
    K.cel(p, '#d23a52', '#9e2238', -8, 0, 4.5);
    X.save(); X.clip(p); X.strokeStyle = 'rgba(110,20,40,.55)'; X.lineWidth = 4; for (let k = -170; k < w; k += 26) { X.beginPath(); X.moveTo(k, 0); X.quadraticCurveTo(k + 8, 240, k - 4, 476); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(w - 26, 0, 8, 476); X.restore();
    X.beginPath(); X.ellipse(w - 12, 300, 10, 16, 0, 0, TAU); ink('#ffd23f', 3);
    X.restore();
  };
  curtain(L + OX + 18, 0, false); curtain(R - OX - 18, 0, true);
  X.save(); X.beginPath(); X.moveTo(L - 10, 0); X.lineTo(R + 10, 0); X.lineTo(R + 10, 34);
  for (let x = R; x > L - 40; x -= 40) X.quadraticCurveTo(x - 20, 56, x - 40, 34);
  X.closePath(); X.lineWidth = 8; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke(); X.fillStyle = '#c42f48'; X.fill();
  X.fillStyle = 'rgba(255,255,255,.15)'; X.fillRect(L, 6, VW, 6); X.restore();
  for (let x = L - 20; x < R + 20; x += 40) { X.beginPath(); X.arc(x, 48, 4, 0, TAU); ink('#ffd23f', 1.5); }
  // the question board
  rr(124, 54, 552, 226, 28); ink('#c99512', 5); rr(124, 50, 552, 222, 28); ink('#ffd23f', 5);
  X.fillStyle = 'rgba(255,255,255,.35)'; rr(140, 56, 520, 6, 3); X.fill();
  rr(160, 86, 480, 160, 14); ink('#1d1840', 4);
  X.save(); rr(160, 86, 480, 160, 14); X.clip(); X.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 88; y < 246; y += 6) X.fillRect(160, y, 480, 2);
  X.fillStyle = 'rgba(255,255,255,.08)'; X.beginPath(); X.moveTo(160, 86); X.lineTo(330, 86); X.lineTo(250, 246); X.lineTo(160, 246); X.fill(); X.restore();
  // contestant podium + the lighting rig arm that holds the gunge bucket
  const pod = new Path2D(); pod.moveTo(14, 336); pod.lineTo(102, 336); pod.lineTo(96, 470); pod.lineTo(20, 470); pod.closePath();
  K.cel(pod, '#4db8ff', '#2f7fc0', 6, 0, 4); K.glint(pod, 34, 350, 10, 40, .3, 0);
  rr(10, 328, 96, 14, 6); ink('#ffd23f', 3.5);
  K.star(58, 402, 20, 9, 5, -Math.PI / 2, '#FFE14D', 3);
  K.line([[L - 10, 128], [80, 128]], 9, '#8f9cb3'); K.line([[46, 128], [46, 146]], 4, '#8f9cb3');
  X.beginPath(); X.arc(80, 128, 8, 0, TAU); ink('#c9ced6', 3);
}

/* 19 ── SORT: a pool hall table seen from above. Pot the numbered balls in order (mouse): each one rolls into
   the nearest pocket and pops up in the ball-return tray. Claude leans on the cue; the hall cat bats at the balls. */
function gSort(sp) {
  const n = sp > 1.5 ? 6 : 5;
  const cells = shuffle([...Array(12).keys()]).slice(0, n);
  const balls = cells.map((c, i) => ({ v: i + 1, x: 100 - OX + (c % 4) * (VW - 200) / 3 + (Math.random() - .5) * 40, y: 160 + (c / 4 | 0) * 135 + (Math.random() - .5) * 30, done: false, sh: 0, pk: 1 }));
  shuffle(balls); let next = 1;
  const cols = ['#ff6b6b', '#4DB8FF', '#ffd23f', '#9be564', '#c792ea', '#ff9f43'];
  let endAt = -1, lastPot = -9;          // cosmetic only (art): when the verdict landed / the last ball was potted (in `now` time)
  const g = {
    wide: true, cmd: 'SORT!', hint: 'CLICK 1, 2, 3... IN ORDER', thint: 'TAP 1, 2, 3... IN ORDER', dur: 5,
    down(p) {
      for (const b of balls) if (!b.done && Math.hypot(p.x - b.x, p.y - b.y) < 44) {
        if (b.v === next) { b.done = true; b.pk = 0; next++; lastPot = now; sfx.pop(); sfx.blip(next * 2); burst(b.x, b.y, cols[b.v - 1], 8); floatText('+1', b.x, b.y - 40, '#fff', 30); if (next > n) { g.result = 'win'; sfx.coin(); sfx.sparkle(); ring(b.x, b.y, '#fff', 100); } }
        else { b.sh = .3; sfx.miss(); shake(3, .12); }
        return;
      }
    },
    update(dt) { balls.forEach(b => { b.sh = Math.max(0, b.sh - dt); b.pk = Math.min(1, b.pk + dt * 4); }); if (g.result && endAt < 0) endAt = now; },
    draw() {
      const K = W3K, { rr, el, ink, TAU, ease, outBack, clamp } = K, X = ctx;
      const won = g.result === 'win', lost = g.result === 'lose', rk = endAt < 0 ? 0 : now - endAt;
      if (!POOL_BG || POOL_BG.width !== VW) POOL_BG = K.bake(VW, H, c => { c.translate(OX, 0); poolTable(); });
      X.drawImage(POOL_BG, -OX, 0);
      const pockets = poolPockets(), mp = TOUCH ? null : mouse;
      // Claude at the head of the table (bottom-left), drawn under the balls so it never hides one; leaning on the cue; it cheers each pot, twirls the cue on the win,
      // and on the fail the cue ball pops off the table and bonks it on the head
      {
        const cx = 72 - OX, cy = 534, u = 5, cheer = clamp(1 - (now - lastPot) / .35, 0, 1);
        const jump = won ? Math.abs(Math.sin(rk * 9)) * 14 : cheer * Math.sin(cheer * Math.PI) * 8, br = Math.sin(now * 3.1) * .025;
        K.shade(cx, cy + 2, 38, 7);
        // the cue (a long stick resting on Claude's shoulder; twirls on the win)
        X.save(); X.translate(cx - 40, cy - 40 - jump); X.rotate(won ? Math.sin(rk * 14) * .5 : Math.sin(now * 2) * .04);   // kept on the rail, clear of the balls
        K.line([[0, 40], [0, -80]], 7, '#e3ac66'); K.line([[0, 40], [0, 6]], 9, '#5a3a22'); K.line([[0, -78], [0, -84]], 7, '#4db8ff');
        X.restore();
        X.save(); X.translate(cx, cy - jump); X.scale(1 - br, 1 + br);
        if (won) { const w = Math.sin(now * 14) * .3; K.arms(u, -.45 + w, .45 - w, ease(rk / .2)); }
        else if (lost) K.arms(u, -2.6, 2.6, ease(rk / .25));
        else K.arms(u, -.3 + Math.sin(now * 9) * .25 * (cheer > 0 ? 0 : 1), .35, 1);
        claude(0, 0, u, { mood: won || cheer > 0 ? 'happy' : lost ? 'sad' : null });
        X.restore();
        if (lost) {                                        // the cue ball hops up out of the table and drops on Claude's head
          const q = clamp(rk / .45, 0, 1), bx = cx + 120 - q * 120, by = cy - 120 - Math.sin(q * Math.PI) * 160 + q * 50;
          if (q < 1) { X.save(); X.translate(bx, by); X.scale(.45, .45); poolBall(0, '#fff', 0, 0); X.restore(); }
          else {
            X.save(); X.translate(cx + 14 + Math.min(1, (rk - .45) * 3) * 50, cy - 50 + Math.min(1, (rk - .45) * 3) * 50 - Math.sin(Math.min(1, (rk - .45) * 3) * Math.PI) * 40); X.scale(.45, .45); poolBall(0, '#fff', 0, 0); X.restore();
            for (let s = 0; s < 3; s++) { const a = now * 8 + s * TAU / 3; K.star(cx + Math.cos(a) * 30, cy - 58 + Math.sin(a) * 8, 7, 3, 5, a, '#FFE14D', 2); }
          }
          K.sweat(cx + 30, cy - 56, 1.1, now);
        }
      }
      // the balls: cel-shaded billiard balls with a white number disc; a potted ball rolls into the nearest pocket
      for (const b of balls) {
        if (b.done) {
          const k = ease(b.pk); if (k >= 1) continue;
          let pp = pockets[0], best = 1e9; for (const q of pockets) { const d = Math.hypot(q[0] - b.x, q[1] - b.y); if (d < best) { best = d; pp = q; } }
          const x = b.x + (pp[0] - b.x) * k, y = b.y + (pp[1] - b.y) * k;
          X.save(); X.translate(x, y); X.scale(1 - k * .55, 1 - k * .55); poolBall(b.v, cols[b.v - 1], k * 9, 0); X.restore();
          continue;
        }
        const sx = Math.sin(now * 70) * b.sh * 30;
        K.shade(b.x + sx + 6, b.y + 8, 40, 38, .3);
        X.save(); X.translate(b.x + sx, b.y);
        if (lost) { const j = Math.abs(Math.sin(rk * 10 + b.v)) * 8; X.translate(0, -j); }
        poolBall(b.v, cols[b.v - 1], 0, b.sh);
        X.restore();
      }
      // the ball-return tray in the foot rail: the potted balls line up in order
      {
        const w = n * 34 + 20, tx = 400 - w / 2;
        if (won) K.rays(400, 535, 170 * ease(rk / .25), now, .5);
        rr(tx, 520, w, 30, 12); ink('#5a3a22', 3.5); X.fillStyle = 'rgba(255,255,255,.12)'; rr(tx + 8, 523, w - 16, 5, 2.5); X.fill();
        for (let i = 0; i < n; i++) {
          const bx = tx + 27 + i * 34, b = balls.find(q => q.v === i + 1), inT = b.done ? outBack((b.pk - .7) / .3) : 0;
          X.fillStyle = 'rgba(0,0,0,.35)'; el(bx, 535, 13, 10); X.fill();
          if (inT > 0) { const gold = won && Math.sin(now * 12 - i) > .3; X.save(); X.translate(bx, 535 - (won ? Math.abs(Math.sin(rk * 10 - i * .6)) * 6 : 0)); X.scale(inT * .33, inT * .33); poolBall(i + 1, gold ? '#FFE14D' : cols[i], 0, 0); X.restore(); }
        }
      }
      // the background gag: the hall cat lies on the foot rail, tail swishing, batting a paw at the nearest ball
      {
        const cx = 610 + OX, cy = 528, near = mp ? Math.hypot(mp.x - cx, mp.y - cy) < 140 : false;
        let tgt = null, bd = 1e9; for (const b of balls) if (!b.done) { const d = Math.hypot(b.x - cx, b.y - cy); if (d < bd) { bd = d; tgt = b; } }
        const swat = !g.result && Math.sin(now * 2.3) > .7, sit = won ? ease(rk / .3) : 0;
        X.save(); X.translate(cx, cy - sit * 14);
        X.beginPath(); X.moveTo(34, -4); X.quadraticCurveTo(70, -10 + Math.sin(now * 5) * 14, 64, -40 + Math.sin(now * 4) * 10); X.lineCap = 'round'; X.lineWidth = 14; X.strokeStyle = INK; X.stroke(); X.lineWidth = 7; X.strokeStyle = '#ff9f43'; X.stroke();
        const BODY = K.pEl(10, -6, 36, 16); K.cel(BODY, '#ffb25e', '#d9822f', 4, 3, 4); K.glint(BODY, -4, -14, 12, 4, .35, -.2);
        X.save(); X.clip(BODY); X.strokeStyle = '#d9822f'; X.lineWidth = 4; for (const s of [0, 12, 24]) { X.beginPath(); X.moveTo(s, -22); X.lineTo(s - 4, -8); X.stroke(); } X.restore();
        const pa = swat ? Math.sin(now * 2.3 * 6) * .5 : won ? Math.sin(now * 16) * .6 : 0, ang = tgt ? Math.atan2(tgt.y - (cy - 20), tgt.x - (cx - 30)) : -2;
        X.save(); X.translate(-22, -10); X.rotate(won ? -1.9 + pa : ang * .4 - .8 + pa); rr(-5, -28 - (swat ? 6 : 0), 10, 30, 5); ink('#ffb25e', 3); el(0, -30 - (swat ? 6 : 0), 7, 6); ink('#ffd9a8', 2.5); X.restore();
        const HEAD = K.pEl(-30, -24, 20, 17);
        for (const s of [-1, 1]) { X.beginPath(); X.moveTo(-30 + s * 6, -36); X.lineTo(-30 + s * 17, -48); X.lineTo(-30 + s * 19, -30); X.closePath(); ink('#ffb25e', 3); X.fillStyle = '#ff9ac2'; X.beginPath(); X.moveTo(-30 + s * 10, -36); X.lineTo(-30 + s * 16, -43); X.lineTo(-30 + s * 16, -34); X.fill(); }
        K.cel(HEAD, '#ffb25e', '#d9822f', 3, 3, 3.5);
        const cm = lost ? 'happy' : won ? 'happy' : near ? 'panic' : 'idle', look = tgt ? [clamp((tgt.x - cx) / 200, -1, 1), clamp((tgt.y - cy) / 200, -1, 1)] : [0, 0];
        K.eye(-37, -26, 5.5, cm, look, now, 0); K.eye(-23, -26, 5.5, cm, look, now, 1);
        X.fillStyle = '#ff5c8a'; X.beginPath(); X.moveTo(-33, -17); X.lineTo(-27, -17); X.lineTo(-30, -14); X.closePath(); X.fill();
        X.strokeStyle = INK; X.lineWidth = 1.6; X.beginPath(); for (const s of [-1, 1]) { X.moveTo(-30 + s * 6, -15); X.lineTo(-30 + s * 22, -18); X.moveTo(-30 + s * 6, -13); X.lineTo(-30 + s * 22, -11); } X.stroke();
        if (lost) { X.beginPath(); X.arc(-30, -12, 5, 0, Math.PI); ink('#ff7aa8', 1.5); }
        X.fillStyle = 'rgba(255,110,165,.55)'; el(-42, -19, 3.5, 2.2); X.fill(); el(-18, -19, 3.5, 2.2); X.fill();
        X.restore();
        if (won) for (let i = 0; i < 3; i++) { const q = (rk * .8 + i / 3) % 1; K.heart(cx - 46 + i * 22 - q * 10, cy - 64 - q * 30, .6, Math.sin(q * Math.PI)); }
        if (lost && rk > .5) for (let i = 0; i < 2; i++) { const q = (rk * 1.4 + i / 2) % 1; X.save(); X.globalAlpha = 1 - q; X.translate(cx - 60 - q * 20, cy - 50 - q * 24); X.rotate(-.3); X.font = '900 20px "Arial Black", Impact, sans-serif'; X.lineWidth = 5; X.strokeStyle = INK; X.strokeText('♪', 0, 0); X.fillStyle = '#fff'; X.fillText('♪', 0, 0); X.restore(); }
      }
      if (won) pockets.forEach((q, i) => { if (q[1] < 100) return; const k = (rk * 1.5 + i * .13) % 1; K.star(q[0], q[1] - k * 50, 12 * Math.sin(k * Math.PI), 5, 4, k * 3, '#FFE14D', 2); });
      vignette(.18);
    }
  };
  return g;
}
/* SORT's art: the six pockets, one billiard ball (v 0 = the white cue ball), and the baked table + floor */
let POOL_BG = null;
function poolPockets() { const L = -OX + 30, R = W + OX - 30; return [[L, 86], [400, 80], [R, 86], [L, 500], [400, 506], [R, 500]]; }
function poolBall(v, col, spin, sh) {
  const K = W3K, X = ctx, P = K.pEl(0, 0, 40, 40);
  K.cel(P, col, sh > 0 ? '#b8283a' : 'rgba(20,16,28,.28)', 5, 5, 4);
  if (sh > 0) { X.save(); X.clip(P); X.fillStyle = col; K.el(-5, -5, 40, 40); X.fill(); X.restore(); }
  if (v) {
    X.save(); X.rotate(spin); K.el(0, 1, 21, 20); K.ink('#fff', 2.5);
    X.font = '900 26px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = INK; X.fillText(String(v), 0, 3); X.restore();
  }
  K.glint(P, -14, -18, 11, 6, .55, -.6);
  if (sh > 0) { X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(-16, -26); X.lineTo(-5, -21); X.moveTo(16, -26); X.lineTo(5, -21); X.stroke(); }
}
function poolTable() {
  const K = W3K, { rr, el, ink, TAU } = K, X = K.cx(), L = -OX, R = W + OX;
  // pub floor: wooden planks
  X.fillStyle = '#8a5530'; X.fillRect(L, 0, VW, H);
  X.strokeStyle = 'rgba(40,20,10,.35)'; X.lineWidth = 2; for (let x = L; x < R; x += 44) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, H); X.stroke(); }
  X.fillStyle = 'rgba(255,255,255,.06)'; for (let x = L + 4; x < R; x += 88) X.fillRect(x, 0, 14, H);
  // table shadow, wooden rail (cel), green cushions, felt with the lamp's pool of light
  X.fillStyle = 'rgba(20,16,28,.35)'; rr(L + 14, 70, VW - 16, 470, 30); X.fill();
  const rail = new Path2D(); rail.roundRect ? rail.roundRect(L + 4, 58, VW - 8, 472, 28) : rail.rect(L + 4, 58, VW - 8, 472);
  K.cel(rail, '#b06d33', '#7a4520', 0, -6, 5);
  X.strokeStyle = 'rgba(255,255,255,.18)'; X.lineWidth = 3; X.beginPath(); X.moveTo(L + 30, 64); X.lineTo(R - 30, 64); X.stroke();
  X.fillStyle = '#f3e2b8'; for (let i = 1; i < 8; i++) { if (i === 4) continue; const x = L + 30 + (VW - 60) * i / 8; X.beginPath(); X.arc(x, 71, 3.5, 0, TAU); X.fill(); X.beginPath(); X.arc(x, 517, 3.5, 0, TAU); X.fill(); }
  for (const y of [190, 293, 396]) { X.beginPath(); X.arc(L + 17, y, 3.5, 0, TAU); X.fill(); X.beginPath(); X.arc(R - 17, y, 3.5, 0, TAU); X.fill(); }
  rr(L + 28, 82, VW - 56, 424, 10); ink('#1e7a45', 4);
  const felt = X.createRadialGradient(400, 290, 40, 400, 290, Math.max(420, VW * .55)); felt.addColorStop(0, '#4fc77f'); felt.addColorStop(.6, '#2fa866'); felt.addColorStop(1, '#1f8a50');
  rr(L + 38, 92, VW - 76, 404, 6); X.fillStyle = felt; X.fill(); X.lineWidth = 3; X.strokeStyle = 'rgba(20,16,28,.5)'; X.stroke();
  // head string + spot (decor only)
  X.strokeStyle = 'rgba(255,255,255,.18)'; X.lineWidth = 2; X.beginPath(); X.moveTo(L + 38 + (VW - 76) * .25, 94); X.lineTo(L + 38 + (VW - 76) * .25, 494); X.stroke();
  // pockets
  for (const [x, y] of poolPockets()) { X.beginPath(); X.arc(x, y, 24, 0, TAU); ink('#14101c', 4); X.fillStyle = '#3a2a1a'; X.beginPath(); X.arc(x, y - 3, 18, Math.PI, TAU); X.fill(); X.strokeStyle = '#d9a86a'; X.lineWidth = 3; X.beginPath(); X.arc(x, y, 27, 0, TAU); X.stroke(); }
}

/* 20 ── FIND IT: the cup shuffle (mouse) */
function gShell(sp) {
  const gap = 200 + OX * .6, xs = [W / 2 - gap, W / 2, W / 2 + gap], cups = xs.map(x => ({ x, from: x, to: x, lift: 0 }));
  const hid = Math.random() * 3 | 0, swaps = 4 + (sp > 1.4) * 2 + (sp > 1.8), sd = .4 / sp;
  let phase = 'show', clock = 0, done = 0, sw = null, swT = 0, picked = -1;
  const startSwap = () => {
    const a = Math.random() * 3 | 0; let b; do { b = Math.random() * 3 | 0; } while (b === a);
    sw = { a, b }; swT = 0; cups[a].from = cups[a].x; cups[a].to = cups[b].x; cups[b].from = cups[b].x; cups[b].to = cups[a].x;
  };
  const g = {
    wide: true, cmd: 'FIND IT!', hint: 'FIND CLAUDE', dur: 6.5,
    down(p) {
      if (phase !== 'pick' || g.result) return;
      cups.forEach((c, i) => { if (Math.abs(p.x - c.x) < 66 && p.y > 250 && p.y < 400) { picked = i; g.result = i === hid ? 'win' : 'lose'; if (g.result === 'win') { sfx.coin(); sfx.sparkle(); burst(c.x, 340, '#FFE14D', 16); ring(c.x, 340, '#fff', 90); floatText('NICE!', c.x, 230, '#fff'); } else { sfx.buzz(); shake(6, .22); } } });
    },
    update(dt) {
      clock += dt;
      cups.forEach((c, i) => {
        const up = (phase === 'show' && i === hid) || (g.result && (i === hid || i === picked));
        c.lift += ((up ? 1 : 0) - c.lift) * Math.min(1, 12 * dt);
      });
      if (phase === 'show' && clock > 1.1) { phase = 'swap'; g.hint = 'WATCH...'; sfx.thud(); startSwap(); }
      else if (phase === 'swap') {
        swT += dt; const k = Math.min(1, swT / sd), e = k * k * (3 - 2 * k);
        for (const i of [sw.a, sw.b]) cups[i].x = cups[i].from + (cups[i].to - cups[i].from) * e;
        if (k >= 1) { sfx.blip(-7); if (++done >= swaps) { phase = 'pick'; g.hint = 'PICK A CUP!'; sfx.pop(); } else { sfx.whoosh(); startSwap(); } }
      }
    },
    draw(t) {
      bg('#6C5CE7', '#5e4ed8', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 384, VW, 10); ctx.fillStyle = '#4b3fb3'; ctx.fillRect(-OX, 394, VW, 206);
      for (const c of cups) shadow(c.x, 386, 62 - c.lift * 10, 14, .3 - c.lift * .12);
      claude(cups[hid].x, 380, 5.5, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      for (const c of cups) {
        ctx.save(); ctx.translate(c.x, 380 - c.lift * 120);
        ctx.beginPath(); ctx.moveTo(-42, -112); ctx.lineTo(42, -112); ctx.lineTo(62, 0); ctx.lineTo(-62, 0); ctx.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#4DB8FF'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-26, -90, 10, 50); ctx.fillStyle = '#2f9ae6'; ctx.fillRect(34, -100, 8, 90); ctx.restore();
      }
    }
  };
  return g;
}

/* 21 ── SCRUB: wipe the grime off the window (mouse, rub back and forth) */
function gScrub(sp) {
  const cols = 16, rows = 10, cw = 37.5, ch = 38, ox = 100, oy = 90;
  const dirt = Array.from({ length: cols * rows }, () => 1);
  let prev = null;
  const g = {
    wide: true, cmd: 'SCRUB!', hint: 'RUB THE MOUSE ALL OVER', thint: 'RUB YOUR FINGER ALL OVER', dur: 5.5,
    move(p) {
      if (g.result) { prev = p; return; }
      if (prev) {
        const d = Math.min(80, Math.hypot(p.x - prev.x, p.y - prev.y));
        for (let i = 0; i < dirt.length; i++) {
          const cx = ox + (i % cols + .5) * cw, cy = oy + ((i / cols | 0) + .5) * ch;
          if (Math.hypot(cx - p.x, cy - p.y) < 56) dirt[i] = Math.max(0, dirt[i] - d * .009);
        }
        if (d > 14 && Math.random() < .3) { sfx.blip(Math.random() * 6 | 0); burst(p.x, p.y, '#fff', 2, 120); }
        if (dirt.filter(v => v < .25).length >= dirt.length * .9) { g.result = 'win'; sfx.coin(); sfx.sparkle(); ring(400, 270, '#fff', 160); floatText('SPARKLING!', 400, 270, '#fff', 56); burst(400, 270, '#FFE14D', 20); }
      }
      prev = p;
    },
    update() {},
    draw(t) {
      bg('#A8DADC', '#97cfd2', t);
      box3(ox, oy, cols * cw, rows * ch, '#cfefff', 8, 8);
      claude(400, 450, 17, { mood: g.result === 'win' ? 'happy' : null });
      for (let i = 0; i < dirt.length; i++) {
        if (g.result === 'win' || dirt[i] <= .02) continue;
        ctx.fillStyle = `rgba(105,78,50,${dirt[i] * .93})`;
        ctx.fillRect(ox + (i % cols) * cw, oy + (i / cols | 0) * ch, cw + 1, ch + 1);
      }
      if (g.result === 'win') star(560, 180, 26, 10, 4, now * 2, '#fff', 3);
      const m = mouse; box3(m.x - 24, m.y - 16, 48, 32, '#FFE14D', 4, 4);
    }
  };
  return g;
}

/* 22 ── DODGE: bedtime on a bedbug-infested bed, survive till the alarm rings (mouse or arrows / WASD) */
function gDodge(sp, extra = 0) {
  const me = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2 };
  const n = 5 + (sp > 1.5) + extra + Math.round(OX / 200), L = -OX + 30, R = W + OX - 30;
  const balls = Array.from({ length: n }, () => {
    const a = Math.random() * 6.28, left = Math.random() < .5;
    return { x: left ? L + 40 : R - 40, y: 110 + Math.random() * 380, vx: Math.cos(a) * 250 * sp, vy: Math.sin(a) * 250 * sp, r: 24 };
  });
  let endK = 0, playT = 0;            // cosmetic only: seconds played (the alarm clock) and since the verdict (the ending gags)
  const g = {
    wide: true, cmd: 'DODGE!', hint: 'MOUSE OR ARROWS', thint: 'DRAG TO DODGE', dur: 5, timeWin: true,
    move(p) { me.tx = p.x; me.ty = p.y; },
    update(dt) {
      if (g.result) { endK += dt; return; }
      playT += dt;
      if (keys.ArrowLeft || keys.KeyA) me.tx -= 700 * dt; if (keys.ArrowRight || keys.KeyD) me.tx += 700 * dt;
      if (keys.ArrowUp || keys.KeyW) me.ty -= 700 * dt; if (keys.ArrowDown || keys.KeyS) me.ty += 700 * dt;
      me.tx = Math.max(L + 20, Math.min(R - 20, me.tx)); me.ty = Math.max(90, Math.min(500, me.ty));
      me.x += (me.tx - me.x) * Math.min(1, 16 * dt); me.y += (me.ty - me.y) * Math.min(1, 16 * dt);
      for (const b of balls) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < L || b.x > R) { b.vx = -b.vx; b.x = Math.max(L, Math.min(R, b.x)); b.w = .15; if (Math.random() < .3) sfx.blip(-12); }
        if (b.y < 70 || b.y > 520) { b.vy = -b.vy; b.y = Math.max(70, Math.min(520, b.y)); b.w = .15; if (Math.random() < .3) sfx.blip(-12); }
        if (b.w > 0) b.w -= dt;
        if (Math.hypot(b.x - me.x, b.y - me.y) < b.r + 24) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(10, .35); confetti(me.x, me.y, 20); burst(me.x, me.y, '#FF4D4D', 18); ring(me.x, me.y, '#fff', 90); }
      }
    },
    draw(t) {
      const K = W3K, { rr, el, ink, TAU, ease, clamp } = K, X = ctx;
      const won = g.result === 'win', lost = g.result === 'lose', rk = endK;
      if (!DODGE_BG || DODGE_BG.width !== VW) DODGE_BG = K.bake(VW, H, c => { c.translate(OX, 0); bedScene(); });
      X.drawImage(DODGE_BG, -OX, 0);
      // who is closest to Claude (they all hunt; the closest one gets the bite)
      let near = null, nd = 1e9; for (const b of balls) { const d = Math.hypot(b.x - me.x, b.y - me.y); if (d < nd) { nd = d; near = b; } }
      const scared = !g.result && nd < 130;
      // bedbugs: grumpy hunters, dizzy after a wall bounce; party on the bite, panic when the alarm rings
      if (won) { X.save(); X.globalAlpha = Math.min(.22, rk * .5); X.fillStyle = '#fff3b0'; X.fillRect(-OX, 0, VW, H); X.restore(); }   // morning light
      for (const b of balls) {
        const dx = me.x - b.x, dy = me.y - b.y, dl = Math.hypot(dx, dy) || 1;
        // on the win the alarm scares them off the bed: they scurry away from Claude (drawn offset only, the game is over)
        const run = won ? K.ease(rk / .9) * 760 : 0, x = b.x - dx / dl * run, y = b.y - dy / dl * run;
        const rot = won ? Math.atan2(-dy, -dx) + Math.PI / 2 : Math.atan2(b.vy, b.vx) + Math.PI / 2, c = Math.cos(-rot), s = Math.sin(-rot);
        const look = won ? [0, 1] : [(dx * c - dy * s) / dl, (dx * s + dy * c) / dl];
        const mood = lost ? (b === near ? 'happy' : 'rasp') : won ? 'panic' : b.w > 0 ? 'dizzy' : 'angry';
        shadow(x + 4, y + 26, 22, 7);
        K.bug(x, y, rot, .8 * (1 + (b.w > 0 ? b.w : 0)), won ? now * 2 : lost ? now * .3 : now, { mood, look, T: now + b.y * .01, chomp: lost && b === near });
        if (won) K.sweat(x + 18, y - 30, .9, now + b.x * .01);
        if (lost && b === near) for (let i = 0; i < 2; i++) { const q = (rk * .7 + i * .5) % 1; K.heart(x + Math.sin(q * 9 + i) * 12, Math.min(y - 44, 170) - q * 70, .8, Math.sin(q * Math.PI)); }
      }
      // Claude in a nightcap
      {
        const u = 3.4, bx = me.x, by = me.y + 16, jump = won ? Math.abs(Math.sin(rk * 9)) * 16 : 0, itch = lost ? Math.sin(now * 40) * 2 : 0, br = Math.sin(now * 3.1) * .025;
        shadow(me.x, me.y + 18, 28, 8);
        X.save(); X.translate(bx + itch, by - jump); X.scale(1 - br, 1 + br);
        if (won) { const w = Math.sin(now * 14) * .3; K.arms(u, -.45 + w, .45 - w, ease(rk / .2)); }
        else if (lost) K.arms(u, -2.5 + Math.sin(now * 30) * .3, 2.5 - Math.sin(now * 30) * .3, ease(rk / .2));
        else if (scared) { const w = Math.sin(now * 30) * .35; K.arms(u, -.9 + w, .9 + w, clamp((130 - nd) / 40, 0, 1)); }
        claude(0, 0, u, { mood: lost ? 'sad' : won ? 'happy' : null, run: g.result ? null : now });
        // the nightcap flops the way Claude runs
        const sw = clamp((me.tx - me.x) / 120, -1, 1) * .5 + Math.sin(now * 3) * .08;
        X.save(); X.translate(0, -9 * u - 4); X.rotate(sw);
        X.beginPath(); X.moveTo(-6 * u, 0); X.quadraticCurveTo(-3 * u, -9 * u, 5 * u, -8 * u); X.quadraticCurveTo(8.6 * u, -7.4 * u, 8.6 * u, -3.6 * u); X.quadraticCurveTo(4 * u, -5 * u, 6 * u, 0); X.closePath(); ink('#6EA8FE', 3);
        X.save(); X.clip(); X.strokeStyle = '#fff'; X.lineWidth = 5; for (let i = -2; i < 4; i++) { X.beginPath(); X.moveTo(i * 10 - 14, 4); X.lineTo(i * 10 + 10, -34); X.stroke(); } X.restore();
        rr(-6.6 * u, -4, 13.2 * u, 6, 3); ink('#fff', 2.5);
        X.beginPath(); X.arc(8.6 * u, -3.6 * u, 6, 0, TAU); ink('#fff', 2.5);
        X.restore();
        if (lost) for (let i = 0; i < 4; i++) {          // itchy bites pop up one by one
          const k = K.outBack((rk - i * .12) / .2); if (k <= 0) continue;
          const [px, py] = [[-3, -4.5], [3, -3], [1, -7.4], [-4.6, -2.6]][i];
          X.beginPath(); X.arc(px * u, py * u, 4.5 * k, 0, TAU); ink('#ff4d5e', 1.8); X.fillStyle = 'rgba(255,255,255,.6)'; el(px * u - 1.5, py * u - 1.5, 1.4 * k, 1 * k); X.fill();
        }
        X.restore();
        if (scared || lost) K.sweat(bx + 16, by - 30, 1, now);
        if (won) K.zee(bx + 26, by - 44 - (rk * 26 % 16), .7, 1 - (rk * 1.6 % 1));
        K.tag(bx, by - 84 - jump + Math.sin(now * 3) * 2);
      }
      // the alarm clock on the footboard is the timer: the gold wedge fills up, then it rings
      {
        const D = g.boss ? g.dur : g.dur / Math.sqrt(sp), f = won ? 1 : clamp(playT / D, 0, 1), ringing = won, cx = W / 2 + 200, cy = 26, sc = .8 * (1 + (ringing ? Math.abs(Math.sin(now * 30)) * .08 : 0));
        X.save(); X.translate(cx, cy); X.rotate(ringing ? Math.sin(now * 60) * .14 : 0); X.scale(sc, sc);
        for (const s of [-1, 1]) { K.line([[s * 14, 22], [s * 20, 30]], 4, '#c9ced6'); X.beginPath(); X.arc(s * 18, -24, 11, Math.PI, TAU); X.closePath(); ink('#ffd23f', 3); }
        X.beginPath(); X.arc(0, 0, 27, 0, TAU); ink('#ff4d5e', 4); X.beginPath(); X.arc(0, 0, 20, 0, TAU); ink('#fff', 2);
        X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + TAU * f); X.closePath(); X.fillStyle = f > .75 ? '#5CFF7A' : '#FFE14D'; X.fill();
        X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(-Math.PI / 2 + TAU * f) * 15, Math.sin(-Math.PI / 2 + TAU * f) * 15); X.stroke();
        X.beginPath(); X.arc(0, 0, 2.5, 0, TAU); X.fillStyle = INK; X.fill();
        X.fillStyle = 'rgba(255,255,255,.55)'; el(-10, -16, 7, 3, -.5); X.fill();
        X.restore();
        if (ringing) { X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const a = s > 0 ? -.45 + i * .45 : Math.PI + .45 - i * .45, r0 = 34 + (now * 60 % 8); X.beginPath(); X.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); X.lineTo(cx + Math.cos(a) * (r0 + 18), cy + Math.sin(a) * (r0 + 18)); X.stroke(); } }
      }
      // the background gag: the cat stole the other pillow. Bite: it leaps up puffed in horror. Alarm: it glares at the clock, mid-stretch
      {
        const cx = W / 2 + 115, cy = 104, br = Math.sin(now * 2.4) * .04;
        const up = lost ? ease(rk / .15) : 0, hop = lost ? Math.abs(Math.sin(rk * 7)) * 10 * up : 0;
        const st = won ? ease(rk / .3) : 0, sx = 1 + st * .18 + br, sy = 1 - st * .1 - br + up * .25;
        X.save(); X.translate(cx, cy - up * 22 - hop);
        shadow(0, 20 + up * 22 + hop, 36, 7);
        X.beginPath(); X.moveTo(26, 4); X.quadraticCurveTo(46, 8 + Math.sin(now * 3) * 6, 40 + up * 6, -14 - up * 18 + Math.sin(now * (lost ? 30 : 2)) * (lost ? 3 : 8)); X.lineWidth = 11 + up * 6; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 6 + up * 6; X.strokeStyle = '#ffb347'; X.stroke();
        X.save(); X.scale(sx, sy); const B = K.pEl(0, 0, 34, 18); K.cel(B, '#ffb347', '#d9822b', 4, 4, 3.5);
        if (up > 0) { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (let i = 0; i < 7; i++) { const a = Math.PI + .3 + i * .42, r = 18 + up * 8; X.moveTo(Math.cos(a) * 30, Math.sin(a) * 16); X.lineTo(Math.cos(a) * (30 + r * .5), Math.sin(a) * (16 + r * .5)); } X.stroke(); }   // fur on end
        X.save(); X.clip(B); X.strokeStyle = '#d9822b'; X.lineWidth = 4; for (const qx of [-6, 6, 18]) { X.beginPath(); X.moveTo(qx, -18); X.quadraticCurveTo(qx + 4, -6, qx, 2); X.stroke(); } X.restore();
        K.glint(B, -12, -8, 10, 4, .4); X.restore();
        if (st > 0) for (const s2 of [-1, 1]) { X.save(); X.translate(-30 * sx, 8 + s2 * 5); X.rotate(-.5 * st); K.line([[0, 0], [-12 * st - 4, 4]], 9, '#ffb347'); X.restore(); }   // front paws stretched out
        X.save(); X.translate(-28 * sx, -6 - up * 6);
        for (const s2 of [-1, 1]) { X.beginPath(); X.moveTo(s2 * 5, -10); X.lineTo(s2 * (13 + up * 3), -24 - up * 8); X.lineTo(s2 * 15, -6); X.closePath(); ink('#ffb347', 3); }
        const Hd = K.pEl(0, 0, 16, 14); K.cel(Hd, '#ffbf5e', '#d9822b', 2, 2, 3);
        const em = lost ? 'panic' : won ? (rk < .35 ? 'panic' : 'idle') : 'sleep', lk = won ? [1, -1] : [0, -1];
        K.eye(-6, -2, 4.5 + up, em, lk, now, 0); K.eye(6, -2, 4.5 + up, em, lk, now, 1);
        if (won && rk >= .35) { X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(-11, -9); X.lineTo(-2, -6); X.moveTo(11, -9); X.lineTo(2, -6); X.stroke(); }   // glaring at the alarm
        if (lost) { X.beginPath(); X.ellipse(0, 7, 3.5, 4.5 * up, 0, 0, TAU); X.fillStyle = INK; X.fill(); }   // gasp
        else { X.fillStyle = '#ff9ac2'; el(0, 4, 2.5, 1.8); X.fill(); }
        X.fillStyle = 'rgba(255,110,165,.5)'; el(-10, 5, 3, 2); X.fill(); el(10, 5, 3, 2); X.fill();
        X.restore(); X.restore();
        if (!lost && !won) for (let i = 0; i < 2; i++) { const q = (now * .5 + i * .5) % 1; K.zee(cx + 28 + q * 14, cy - 30 - q * 26, .55 + q * .3, Math.sin(q * Math.PI)); }
        if (lost) {                     // a big inked "!" pops over the cat, plus sweat
          const k = K.outBack((rk - .05) / .2);
          if (k > 0) { X.save(); X.translate(cx - 62, cy - 40 - hop); X.scale(k, k); X.rotate(-.15); rr(-6, -30, 12, 28, 6); ink('#FFE14D', 3); X.beginPath(); X.arc(0, 8, 6, 0, TAU); ink('#FFE14D', 3); X.restore(); }
          K.sweat(cx + 44, cy - 34 - up * 22, 1, now);
        }
        if (won) K.sweat(cx + 40, cy - 30, .9, now);
      }
      vignette(.16);
    }
  };
  return g;
}
/* DODGE's baked scene: a wooden floor, a big bed with a patchwork quilt, pillows, a lost sock, head- and footboard */
let DODGE_BG = null;
function bedScene() {
  const K = W3K, { rr, el, ink, TAU } = K, X = K.cx(), L = -OX + 30, R = W + OX - 30;
  // floor planks
  const fl = X.createLinearGradient(0, 0, 0, H); fl.addColorStop(0, '#b97a46'); fl.addColorStop(1, '#8a5530');
  X.fillStyle = fl; X.fillRect(-OX, 0, VW, H);
  X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 3;
  for (let x = -OX; x < W + OX; x += 48) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, H); X.stroke(); for (let y = (x / 48 & 1) * 90 + 40; y < H; y += 180) { X.beginPath(); X.moveTo(x, y); X.lineTo(x + 48, y); X.stroke(); } }
  // bed frame + mattress
  rr(L - 28, 20, R - L + 56, 570, 30); ink('#a5622c', 5);
  const mat = new Path2D(); { const x = L - 12, y = 52, w = R - L + 24, h = 480, r = 28; mat.moveTo(x + r, y); mat.arcTo(x + w, y, x + w, y + h, r); mat.arcTo(x + w, y + h, x, y + h, r); mat.arcTo(x, y + h, x, y, r); mat.arcTo(x, y, x + w, y, r); mat.closePath(); }
  K.inkP(mat, '#fbf7ff', 5);
  // patchwork quilt from y 160 down, each patch cel-shaded with stitches and a tiny print
  X.save(); X.clip(mat);
  const pal = [['#bfe0ff', '#9cc6f2'], ['#ffd6e6', '#f2b2cb'], ['#d6f5c9', '#b2dfa3'], ['#fff0b8', '#f2d98a']], cw = 84;
  for (let j = 0; j * cw + 160 < 540; j++) for (let i = 0; L - 12 + i * cw < R + 12; i++) {
    const x = L - 12 + i * cw, y = 160 + j * cw, [b, s] = pal[(i + j * 2) % 4];
    X.fillStyle = s; X.fillRect(x, y, cw, cw); X.fillStyle = b; X.fillRect(x, y, cw - 6, cw - 6);
    X.setLineDash([6, 5]); X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = 2; X.strokeRect(x + 6, y + 6, cw - 12, cw - 12); X.setLineDash([]);
    X.fillStyle = 'rgba(255,255,255,.55)'; const k = (i + j) % 3;
    if (k === 0) { for (const [a, c] of [[22, 24], [56, 44], [30, 62]]) { X.beginPath(); X.arc(x + a, y + c, 4, 0, TAU); X.fill(); } }
    else if (k === 1) { X.save(); X.translate(x + cw / 2, y + cw / 2); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-14, -2, -9, -15, 0, -7); X.bezierCurveTo(9, -15, 14, -2, 0, 8); X.fill(); X.restore(); }
    else { X.save(); X.translate(x + cw / 2, y + cw / 2); X.beginPath(); for (let q = 0; q < 10; q++) { const r = q % 2 ? 4 : 10, a = -Math.PI / 2 + q * Math.PI / 5; X.lineTo(Math.cos(a) * r, Math.sin(a) * r); } X.fill(); X.restore(); }
  }
  // the folded-down sheet edge
  rr(L - 20, 148, R - L + 40, 30, 12); ink('#fff', 3.5); X.fillStyle = '#e6e1f2'; X.fillRect(L - 20, 168, R - L + 40, 8);
  X.setLineDash([7, 6]); X.strokeStyle = 'rgba(20,16,28,.2)'; X.lineWidth = 2; X.beginPath(); X.moveTo(L - 10, 158); X.lineTo(R + 10, 158); X.stroke(); X.setLineDash([]);
  // soft shade along the right/bottom edge of the mattress
  X.fillStyle = 'rgba(80,60,120,.12)'; X.fillRect(R - 6, 52, 40, 480); X.fillRect(L - 20, 512, R - L + 40, 30);
  X.restore();
  K.inkP(mat, null, 2.5);
  // pillows
  for (const px of [W / 2 - 200, W / 2 + 30]) {
    const p = new Path2D(); { const x = px, y = 66, w = 170, h = 74, r = 30; p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); }
    K.cel(p, '#ffffff', '#d9d3ea', 5, 5, 4); K.glint(p, px + 40, 82, 30, 7, .8, -.1);
    X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(px + 12, 78); X.lineTo(px + 22, 86); X.moveTo(px + 158, 78); X.lineTo(px + 148, 86); X.moveTo(px + 12, 128); X.lineTo(px + 22, 120); X.moveTo(px + 158, 128); X.lineTo(px + 148, 120); X.stroke();
  }
  X.fillStyle = 'rgba(110,168,254,.35)'; el(W / 2 - 92, 118, 12, 6, .2); X.fill();          // a drool spot on Claude's pillow
  // the lost sock (nobody knows whose)
  X.save(); X.translate(L + 70, 470); X.rotate(-.5);
  const sock = new Path2D('M -10 -34 L 12 -34 L 12 6 Q 12 22 28 22 L 34 22 Q 44 22 44 32 Q 44 42 32 42 L 4 42 Q -10 42 -10 26 Z');
  K.cel(sock, '#ffffff', '#d9d3ea', 3, 3, 3); X.save(); X.clip(sock); X.fillStyle = '#ff4d5e'; for (const y of [-26, -12]) X.fillRect(-12, y, 26, 6); X.fillStyle = '#6EA8FE'; X.beginPath(); X.arc(40, 32, 9, 0, TAU); X.fill(); X.restore();
  X.restore();
  // headboard + footboard with knob posts
  const board = (y, h) => {
    const p = new Path2D(); { const x = L - 40, w = R - L + 80, r = 22; p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); }
    K.cel(p, '#d9944f', '#a5622c', 0, 6, 4);
    X.save(); X.clip(p); X.strokeStyle = '#c98443'; X.lineWidth = 3; X.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const yy = y + 12 + (i % 3) * (h - 24) / 3, x0 = L + (i * 157 % (R - L - 120)); X.beginPath(); X.moveTo(x0, yy); X.quadraticCurveTo(x0 + 40, yy - 4, x0 + 90, yy); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(L - 30, y + 6, R - L + 60, 6); X.restore();
    for (const x of [L - 26, R + 26]) { X.beginPath(); X.arc(x, y + h / 2, 22, 0, TAU); ink('#e3a868', 4); X.fillStyle = 'rgba(255,255,255,.45)'; el(x - 7, y + h / 2 - 8, 7, 4, -.5); X.fill(); }
  };
  board(-30, 82); board(536, 90);
}

reg('whack', gWhack, 'WHACK');
reg('drag', gDrag, 'DRAG');
reg('race', gRace, 'RACE');
reg('reflex', gReflex, 'WAIT');
reg('rps', gRps, 'BEAT IT');
reg('math', gMath, 'SOLVE');
reg('sort', gSort, 'SORT');
reg('shell', gShell, 'FIND IT');
reg('scrub', gScrub, 'SCRUB');
reg('dodge', gDodge, 'DODGE');
