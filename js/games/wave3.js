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

/* 15 ── RACE: alternate ← → (or A D) to outrun the bug */
function gRace(sp) {
  let me = 0, rival = 0, last = '', shk = 0, clock = 0;
  const rate = 100 / (5 * .88 / Math.sqrt(sp)), x0 = 80 - OX, kx = (620 + OX * 2) / 100, fx = 724 + OX;
  const g = {
    wide: true, cmd: 'RACE!', hint: 'ALTERNATE LEFT AND RIGHT', thint: 'TAP LEFT / RIGHT SIDE', dur: 5,
    down(p) { g.key({ code: p.x < W / 2 ? 'ArrowLeft' : 'ArrowRight' }); },
    key(e) {
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (!k) return;
      if (k === last) { shk = .15; sfx.miss(); return; }
      last = k; me += 5; sfx.blip(me / 8); burst(x0 + Math.min(me, 100) * kx - 30, 330, '#d9a066', 3, 140);
      if (me >= 100) { g.result = 'win'; sfx.coin(); sfx.sparkle(); shake(5, .2); floatText('WINNER!', 400, 250, '#fff', 48); confetti(fx, 240, 30); }
    },
    update(dt) {
      clock += dt; shk = Math.max(0, shk - dt);
      if (g.result) return;
      rival += rate * dt; if (rival >= 100) { g.result = 'lose'; sfx.buzz(); shake(6, .25); }
    },
    draw(t) {
      bg('#FFD166', '#ffc54d', t);
      for (const ly of [150, 330]) { ctx.fillStyle = INK; ctx.fillRect(-OX, ly - 4, VW, 188); ctx.fillStyle = '#d9a066'; ctx.fillRect(-OX, ly, VW, 180); }
      for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#fff' : INK; ctx.fillRect(fx + c * 16, 150 + r * 15, 16, 15); ctx.fillRect(fx + c * 16, 330 + r * 15, 16, 15); }
      const mx = x0 + Math.min(me, 100) * kx + Math.sin(now * 80) * shk * 20, rx = x0 + Math.min(rival, 100) * kx;
      shadow(mx, 372, 46, 12); shadow(rx, 450, 40, 10);
      claude(mx, 300, 8, { run: g.result ? null : now, mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      drawBug(rx, 420, Math.PI / 2, 1.3, now);
      txt('YOU', 50 - OX, 175, 24); txt('BUG', 50 - OX, 355, 24);
    }
  };
  return g;
}

/* 16 ── WAIT: press only when the light turns green */
function gReflex(sp) {
  const goAt = (.9 + Math.random() * 1.5) / Math.sqrt(sp), win = 1.0 / sp;
  let clock = 0, rt = 0;
  const press = () => {
    if (g.result) return;
    if (clock < goAt) { g.result = 'lose'; sfx.buzz(); shake(7, .25); }
    else { rt = (clock - goAt) * 1000 | 0; g.result = 'win'; sfx.hit(); sfx.coin(); burst(W / 2, 330, '#5CFF7A', 16); ring(W / 2, 330, '#5CFF7A', 100); floatText(rt < 300 ? 'FAST!' : 'NICE!', W / 2 - 220, 230, '#fff'); }
  };
  const g = {
    wide: true, cmd: 'WAIT!', hint: 'PRESS ONLY AT GREEN', thint: 'TAP ONLY AT GREEN', dur: 4,
    key() { press(); }, down() { press(); },
    update(dt) {
      if (g.result) return;
      const was = clock < goAt; clock += dt;
      if (was && clock >= goAt) { sfx.pop(); sfx.blip(7); ring(W / 2, 330, '#5CFF7A', 80, .35); }
      if (clock > goAt + win) { g.result = 'lose'; sfx.miss(); }
    },
    draw(t) {
      bg('#6B7A8F', '#5f6e83', t);
      const go = clock >= goAt, early = g.result === 'lose' && clock < goAt;
      shadow(W / 2 + 10, 478, 90, 16); box3(W / 2 - 80, 90, 160, 300, '#2b2b3a', 6);
      if (!go) { ctx.globalAlpha = .25; circ(W / 2, 150, 62, '#ff3b3b', 0); ctx.globalAlpha = 1; } else { ctx.globalAlpha = .3 + Math.sin(now * 20) * .1; circ(W / 2, 330, 64, '#5CFF7A', 0); ctx.globalAlpha = 1; }
      circ(W / 2, 150, 42, go ? '#4a1d1d' : '#ff3b3b', 4);
      circ(W / 2, 240, 42, '#5a4d1d', 4);
      circ(W / 2, 330, 42, go ? '#5CFF7A' : '#1d4a2a', 4);
      ctx.fillStyle = '#2b2b3a'; ctx.fillRect(W / 2 - 14, 394, 28, 80);
      claude(W / 2 + 190, 520, 9, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      if (g.result === 'win') txt(rt + ' ms', W / 2 - 220, 300, 56, '#5CFF7A');
      if (early) txt('TOO SOON!', W / 2 - 220, 300, 50, '#FF4D4D');
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

/* 18 ── SOLVE: quick maths (1 2 3 or click) */
function gMath(sp) {
  let a = 2 + Math.random() * 8 | 0, b = 2 + Math.random() * 7 | 0, op = ['+', '-', 'x'][sp > 1.5 ? Math.random() * 3 | 0 : Math.random() * 2 | 0];
  if (op === '-' && b > a) [a, b] = [b, a];
  if (op === 'x') { a = 2 + Math.random() * 5 | 0; b = 2 + Math.random() * 4 | 0; }
  const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const opts = [ans]; while (opts.length < 3) { const v = ans + ((Math.random() * 7 | 0) - 3); if (v >= 0 && !opts.includes(v)) opts.push(v); }
  shuffle(opts); let picked = -1, pk = 1;
  const choose = i => {
    if (g.result) return; picked = i; g.result = opts[i] === ans ? 'win' : 'lose'; pk = 0;
    if (g.result === 'win') { sfx.hit(); sfx.coin(); burst(200 + i * 220, 405, '#5CFF7A', 14); ring(200 + i * 220, 405, '#fff', 90); floatText('NICE!', 400, 260, '#fff'); } else { sfx.buzz(); shake(6, .22); burst(200 + i * 220, 405, '#FF4D4D', 10); }
  };
  const g = {
    wide: true, cmd: 'SOLVE!', hint: 'PICK THE ANSWER (1 2 3)', thint: 'TAP THE ANSWER', dur: 5,
    key(e) { const v = +e.key; if (v >= 1 && v <= 3) choose(v - 1); },
    down(p) { const i = Math.floor((p.x - 100) / 220); if (i >= 0 && i < 3 && p.x - 100 - i * 220 <= 200 && p.y > 340 && p.y < 470) choose(i); },
    update(dt) { pk = Math.min(1, pk + dt * 5); },
    draw(t) {
      bg('#C0F0A0', '#b0e690', t);
      txt(`${a} ${op} ${b} = ?`, W / 2, 170, 110, '#fff');
      for (let i = 0; i < 3; i++) {
        const show = g.result && (opts[i] === ans || i === picked);
        const pop = i === picked ? 1 + Math.sin(pk * Math.PI) * .1 : 1; ctx.save(); ctx.translate(200 + i * 220, 405); ctx.scale(pop, pop); ctx.translate(-200 - i * 220, -405);
        box3(100 + i * 220, 340, 200, 130, show ? (opts[i] === ans ? '#5CFF7A' : '#FF4D4D') : '#fff', 5, show ? 3 : 6);
        txt(String(opts[i]), 200 + i * 220, 405, 72, show ? '#fff' : INK); ctx.restore();
      }
      shadow(W / 2, 566, 40, 10); claude(W / 2, 560, 5, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
    }
  };
  return g;
}

/* 19 ── SORT: click the numbers in order (mouse) */
function gSort(sp) {
  const n = sp > 1.5 ? 6 : 5;
  const cells = shuffle([...Array(12).keys()]).slice(0, n);
  const balls = cells.map((c, i) => ({ v: i + 1, x: 100 - OX + (c % 4) * (VW - 200) / 3 + (Math.random() - .5) * 40, y: 160 + (c / 4 | 0) * 135 + (Math.random() - .5) * 30, done: false, sh: 0, pk: 1 }));
  shuffle(balls); let next = 1;
  const cols = ['#ff6b6b', '#4DB8FF', '#ffd23f', '#9be564', '#c792ea', '#ff9f43'];
  const g = {
    wide: true, cmd: 'SORT!', hint: 'CLICK 1, 2, 3... IN ORDER', thint: 'TAP 1, 2, 3... IN ORDER', dur: 5,
    down(p) {
      for (const b of balls) if (!b.done && Math.hypot(p.x - b.x, p.y - b.y) < 44) {
        if (b.v === next) { b.done = true; b.pk = 0; next++; sfx.pop(); sfx.blip(next * 2); burst(b.x, b.y, cols[b.v - 1], 8); floatText('+1', b.x, b.y - 40, '#fff', 30); if (next > n) { g.result = 'win'; sfx.coin(); sfx.sparkle(); ring(b.x, b.y, '#fff', 100); } }
        else { b.sh = .3; sfx.miss(); shake(3, .12); }
        return;
      }
    },
    update(dt) { balls.forEach(b => { b.sh = Math.max(0, b.sh - dt); b.pk = Math.min(1, b.pk + dt * 4); }); },
    draw(t) {
      bg('#FFB4A2', '#ffa690', t);
      for (const b of balls) {
        const sx = Math.sin(now * 70) * b.sh * 30;
        const s = 1 + Math.sin(b.pk * Math.PI) * .25; shadow(b.x + sx + 4, b.y + 44, 34 * s, 9);
        ctx.save(); ctx.translate(b.x + sx, b.y); ctx.scale(s, s); circ(0, 0, 40, b.done ? '#5CFF7A' : cols[b.v - 1], 5); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-12, -16, 10, 6, -.6, 0, 7); ctx.fill(); txt(String(b.v), 0, 3, 46); ctx.restore();
      }
    }
  };
  return g;
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
