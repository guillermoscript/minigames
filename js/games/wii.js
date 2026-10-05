'use strict';
/* WII wave — WarioWare: Smooth Moves inspired microgames (browser adaptations). All names prefixed wii / wii_ */
/* ───────────── art kit for the WII games: the DUO look (docs/ART-STYLE.md). A local copy of the DUO drawing helpers.
   Everything draws on X, which can be swapped for an offscreen context so the same code bakes the static scene once.
   Cosmetic only: nothing here calls Math.random, so the seeded game RNG is never touched. ───────────── */
(() => {   // one IIFE for the whole file: the kit's short names (rr, el, ink...) must not leak into the shared global scope
const K = (() => {
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
  const K = { TAU };
  const clamp = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.lerp = (a, b, k) => a + (b - a) * k;
  K.ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
  /* a baked full-width layer: draw it with the returned function every frame (rebuilt only if the screen width changes) */
  K.layer = fn => { let c = null, key = ''; return () => { const k = OX + ':' + VW; if (!c || k !== key) { key = k; c = K.bake(VW, H, x => { x.translate(OX, 0); fn(x); }); } ctx.drawImage(c, -OX, 0); }; };
  K.grad = (y0, y1, stops, x0 = 0, x1 = 0) => { const g = X.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
  const rr = K.rr = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const inkP = K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  /* base / shade / light: the shade is left as a crescent on one side */
  const cel = K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); if (p) X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  const PE = {}; K.pEl = (x, y, rx, ry) => { const k = x + ',' + y + ',' + rx + ',' + ry; if (!PE[k]) { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); PE[k] = p; } return PE[k]; };
  const PR = {}; K.pRR = (x, y, w, h, r) => { const k = x + ',' + y + ',' + w + ',' + h + ',' + r; if (!PR[k]) { const p = new Path2D(); r = Math.min(r, w / 2, h / 2); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); PR[k] = p; } return PR[k]; };
  K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  K.shade = (x, y, rx, ry, a = .25) => { X.fillStyle = `rgba(20,16,28,${a})`; el(x, y, rx, ry); X.fill(); };
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
  const arms = K.arms = (u, la, ra, k, col = OR) => {
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
  const eye = K.eye = (x, y, r, mood, look, T, k) => {
    X.lineCap = 'round';
    if (mood === 'happy') { X.lineWidth = r * .55; X.strokeStyle = INK; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
    if (mood === 'bonk' || mood === 'sleep') { X.lineWidth = r * .5; X.strokeStyle = INK; X.beginPath(); if (mood === 'sleep') X.arc(x, y - r * .2, r * .7, Math.PI * .15, Math.PI * .85); else { const d = k ? -1 : 1; X.moveTo(x - r * .7 * d, y - r * .5); X.lineTo(x + r * .4 * d, y); X.lineTo(x - r * .7 * d, y + r * .5); } X.stroke(); return; }
    const big = mood === 'panic' ? 1.3 : 1;
    el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(1.5, r * .28));
    if (mood === 'dizzy') { X.strokeStyle = INK; X.lineWidth = Math.max(1.5, r * .22); X.beginPath(); for (let i = 0; i < 24; i++) { const a = i * .55 * (k ? -1 : 1) + T * 9 * (k ? -1 : 1), q = i / 24 * r * .85; X.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } X.stroke(); return; }
    if (mood !== 'panic' && Math.sin(T * 1.9 + k * .2 + x * .01) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
    const pr = mood === 'panic' ? r * .32 : r * .52, lx = clamp(look[0], -1, 1) * r * .38, ly = clamp(look[1], -1, 1) * r * .38;
    X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
    X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .38, pr * .32); X.fill();
  };
  /* Claude's face, drawn over the core sprite (same x / y-at-feet / u): big eyes, brows, mouth, blush, sweat.
     mood: idle, eager, worry, panic, happy, sad, dizzy, bonk, sleep, smug */
  K.face = (x, y, u, mood, T, look = [0, 0], o = {}) => {
    const ey = y - 6.2 * u, r = 1.5 * u, my = y - 3.4 * u, lw = Math.max(2, u * .5);
    X.save(); X.lineCap = 'round'; X.lineJoin = 'round';
    if (mood === 'happy' || o.blush) { X.fillStyle = 'rgba(255,110,165,.6)'; for (const sx of [-1, 1]) { el(x + sx * 4.6 * u, y - 4.3 * u, .85 * u, .5 * u); X.fill(); } }
    const em = mood === 'eager' || mood === 'smug' || mood === 'worry' || mood === 'sad' ? 'idle' : mood;
    eye(x - 2.8 * u, ey, r, em, look, T, 0); eye(x + 2.8 * u, ey, r, em, look, T, 1);
    X.strokeStyle = INK; X.lineWidth = lw;
    const brow = (a, b) => { X.beginPath(); X.moveTo(x - 4.3 * u, ey - 1.75 * u - a * u); X.lineTo(x - 1.4 * u, ey - 1.75 * u - b * u); X.moveTo(x + 4.3 * u, ey - 1.75 * u - a * u); X.lineTo(x + 1.4 * u, ey - 1.75 * u - b * u); X.stroke(); };
    if (mood === 'worry' || mood === 'sad') brow(-.1, .75);
    else if (mood === 'eager') brow(.6, -.1);
    else if (mood === 'panic') brow(-.2, .9);
    else if (mood === 'smug') { X.fillStyle = INK; X.fillRect(x - 4.4 * u, ey - r * 1.1, 3.2 * u, r * .9); X.fillRect(x + 1.2 * u, ey - r * 1.1, 3.2 * u, r * .9); }
    if (mood === 'sad') { X.fillStyle = '#9fe3ff'; el(x - 3.7 * u, ey + 2.1 * u, .4 * u, .75 * u); X.fill(); el(x + 3.7 * u, ey + 2.1 * u, .4 * u, .75 * u); X.fill(); }
    X.beginPath();
    if (mood === 'happy') { X.moveTo(x - 1.5 * u, my - .3 * u); X.quadraticCurveTo(x, my + 2.2 * u, x + 1.5 * u, my - .3 * u); X.closePath(); ink('#7a1f2e', lw * .5); X.fillStyle = '#ff7aa8'; el(x, my + .75 * u, .7 * u, .4 * u); X.fill(); }
    else if (mood === 'panic' || mood === 'bonk') { el(x, my + .2 * u, .8 * u, mood === 'bonk' ? .5 * u : 1 * u); ink('#7a1f2e', lw * .5); }
    else if (mood === 'sad') { X.arc(x, my + .9 * u, 1.1 * u, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); }
    else if (mood === 'worry' || mood === 'dizzy') { X.moveTo(x - 1.5 * u, my); for (let i = 1; i <= 6; i++) X.lineTo(x - 1.5 * u + i * .5 * u, my + (i % 2 ? -.3 : .3) * u); X.stroke(); }
    else if (mood === 'smug') { X.moveTo(x - 1.2 * u, my + .1 * u); X.quadraticCurveTo(x + .6 * u, my + .5 * u, x + 1.6 * u, my - .4 * u); X.stroke(); }
    else if (mood === 'sleep') { X.arc(x, my - .1 * u, .6 * u, 0, Math.PI); X.stroke(); }
    else { X.arc(x, my - .8 * u, 1.3 * u, .25 * Math.PI, .75 * Math.PI); X.stroke(); }
    if (mood === 'worry' || mood === 'panic') K.sweat(x + 5.2 * u, y - 9.4 * u, Math.max(.7, u * .17), T);
    X.restore();
  };
  /* the whole hero: arms (optional), core sprite, cel shade + light, face. Live frames only (the core sprite draws on ctx) */
  K.hero = (x, y, u, mood, T, o = {}) => {
    const col = o.col || OR;
    if (o.arms) { X.save(); X.translate(x, y); arms(u, o.arms[0], o.arms[1], o.arms[2] == null ? 1 : o.arms[2], col); X.restore(); }
    claude(x, y, u, { col, run: o.run });
    X.save(); X.fillStyle = 'rgba(20,16,28,.17)'; X.fillRect(x - 6 * u, y - 3.9 * u, 12 * u, 1.9 * u); X.fillRect(x + 4.4 * u, y - 9 * u, 1.6 * u, 5.1 * u);
    X.fillStyle = 'rgba(255,255,255,.32)'; rr(x - 5.4 * u, y - 8.6 * u, 3.4 * u, .9 * u, .45 * u); X.fill(); X.restore();
    K.face(x, y, u, mood, T, o.look || [0, 0], o);
  };
  /* hats sit on the head top (y = feet - 9u) and never cover the eyes */
  K.hat = (kind, x, y, u, col = '#5a3b22', band = '#d9a441') => {
    X.save(); X.translate(x, y); X.scale(u / 8, u / 8);
    if (kind === 'cowboy') {
      X.beginPath(); X.moveTo(-18, 2); X.quadraticCurveTo(-30, 2, -34, -10); X.quadraticCurveTo(-18, 6, 0, 6); X.quadraticCurveTo(18, 6, 34, -10); X.quadraticCurveTo(30, 2, 18, 2); X.closePath(); ink(col, 3);
      rr(-17, -26, 34, 30, 8); ink(col, 3); rr(-17, -6, 34, 7, 2); ink(band, 2.5); X.fillStyle = 'rgba(255,255,255,.3)'; el(-8, -19, 4, 2.5, -.5); X.fill();
    } else if (kind === 'bowler') {
      rr(-26, -4, 52, 9, 4.5); ink(col, 3); X.beginPath(); X.arc(0, -4, 17, Math.PI, 0); X.closePath(); ink(col, 3); rr(-17, -9, 34, 5, 1); ink(band, 2.5); X.fillStyle = 'rgba(255,255,255,.3)'; el(-7, -15, 4, 2.2, -.5); X.fill();
    } else if (kind === 'fedora') {
      rr(-30, -3, 60, 9, 4.5); ink(col, 3); X.beginPath(); X.moveTo(-17, -2); X.lineTo(-15, -21); X.quadraticCurveTo(0, -27, 15, -21); X.lineTo(17, -2); X.closePath(); ink(col, 3); rr(-17, -9, 34, 6, 1); ink(band, 2.5); X.fillStyle = 'rgba(255,255,255,.28)'; el(-8, -18, 4, 2, -.5); X.fill();
    } else if (kind === 'chef') {
      for (const [a, b, r] of [[-12, -22, 11], [0, -28, 13], [12, -22, 11]]) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink('#fff', 3); }
      rr(-15, -14, 30, 16, 3); ink('#fff', 3); X.fillStyle = 'rgba(20,16,28,.12)'; rr(6, -12, 8, 12, 2); X.fill();
    } else if (kind === 'band') {
      rr(-17, -6, 34, 7, 2); ink(col, 2.5); X.beginPath(); X.arc(0, -2.5, 3, 0, TAU); ink('#ff4d5e', 1.5); X.beginPath(); X.moveTo(17, -3); X.quadraticCurveTo(26, -2, 28, 9); X.moveTo(17, -1); X.quadraticCurveTo(30, 6, 26, 14); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.lineWidth = 1.2; X.strokeStyle = col; X.stroke();
    } else if (kind === 'hard') {
      rr(-24, -3, 48, 8, 4); ink(col, 3); X.beginPath(); X.arc(0, -3, 19, Math.PI, 0); X.closePath(); ink(col, 3); rr(-4, -22, 8, 19, 3); ink(band, 2); X.fillStyle = 'rgba(255,255,255,.4)'; el(-9, -12, 4, 2.4, -.7); X.fill();
    } else if (kind === 'party') {
      X.beginPath(); X.moveTo(-12, 3); X.lineTo(0, -34); X.lineTo(12, 3); X.closePath(); ink(col, 3); X.fillStyle = band; for (const [a, b] of [[-3, -8], [4, -16], [-2, -22]]) { X.beginPath(); X.arc(a, b, 2.4, 0, TAU); X.fill(); }
      X.beginPath(); X.arc(0, -35, 4, 0, TAU); ink('#ff5c8a', 2);
    }
    X.restore();
  };
  K.cloud = (x, y, s) => {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
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
  /* a gold star-in-a-pill pointer: marks the player's Claude without words */
  K.tag = (x, y, col = '#FFE14D') => {
    X.beginPath(); X.moveTo(x - 8, y + 10); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 10); X.closePath(); ink(col, 3);
    rr(x - 22, y - 12, 44, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - 16, y - 9, 32, 6, 3); X.fill();
    starP(x, y + 1, 8.5, 4, 5, -Math.PI / 2, '#fff', 2);
  };
  /* feedback word on a coloured slab with a gloss and a drop shadow (hippo badge) */
  K.badge = (s, x, y, size, bg, fg, sc = 1, rot = 0) => {
    s = t(s); X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = X.measureText(s).width; if (tw > 560) size *= 560 / tw;
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(640, X.measureText(s).width + size * .9), h = size * 1.3;
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .46); X.fill();
    rr(-w / 2, -h / 2, w, h, h * .46); ink(bg, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + h * .3, -h / 2 + h * .1, w - h * .6, h * .2, h * .1); X.fill();
    X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round'; X.lineWidth = size / 6; X.strokeStyle = INK; X.strokeText(s, 0, 2); X.fillStyle = fg; X.fillText(s, 0, 2); X.restore();
  };
  /* outro clock from the global `now` (update() stops after the verdict, so draw() can't count itself) */
  K.outro = g => { let o0 = -1; const u = g.update; g.update = function (dt) { u.call(g, dt); if (g.result && o0 < 0) o0 = now; }; return () => g.result ? (o0 < 0 ? (o0 = now, 0) : Math.max(0, now - o0)) : 0; };
  K.sparkle = (x, y, r, T, n = 6) => { for (let i = 0; i < n; i++) { const a = i * TAU / n + T * 2, d = r * (.6 + .4 * Math.sin(T * 5 + i)); starP(x + Math.cos(a) * d, y + Math.sin(a) * d, 7, 3, 4, T * 3 + i, '#FFE14D', 2); } };
  return K;
})();
const { rr, el, ink, inkP, cel, glint, line, grad, pEl, pRR, ease, outBack, lerp, hash, clamp } = K;
const wiiBang = (x = W / 2, y = 300) => { sfx.thud(); sfx.miss(); shake(10, .3); burst(x, y, '#FF4D6D', 16, 300); ring(x, y, '#FF4D6D', 110, .45); };


/* 1 ── SAVE ME!: apartment block with a nosy cat; slide the safety net under the window-washer, twice */
const SAVE_BG = K.layer(x => {
  x.fillStyle = grad(0, 525, [[0, '#f4b79f'], [1, '#e8967c']]); x.fillRect(-OX, 0, VW, 526);
  x.strokeStyle = 'rgba(150,70,50,.2)'; x.lineWidth = 2; x.beginPath();
  for (let y = 24; y < 526; y += 24) { x.moveTo(-OX, y); x.lineTo(W + OX, y); for (let c = -OX - 60 + ((y / 24) & 1) * 30; c < W + OX; c += 60) { x.moveTo(c, y); x.lineTo(c, y - 24); } } x.stroke();
  x.fillStyle = 'rgba(255,255,255,.09)'; for (let i = -2; i < 14; i++) { x.beginPath(); x.moveTo(i * 90 - 40, 0); x.lineTo(i * 90, 0); x.lineTo(i * 90 - 160, 526); x.lineTo(i * 90 - 200, 526); x.fill(); }
  const wk = Math.ceil(OX / 85);
  for (let r = 0; r < 5; r++) for (let c = -wk; c < 8 + wk; c++) {
    const wx = 70 + c * 85, wy = 70 + r * 85, h = hash(r * 31 + c * 7 + 3), lit = ((r * 3 + c * 5) % 7 + 7) % 7 === 0;
    rr(wx - 5, wy - 5, 54, 66, 7); ink('#fff2dc', 3.5);
    const glass = pRR(wx, wy, 44, 56, 3); cel(glass, lit ? '#FFE14D' : '#74bdf0', lit ? '#e0b92f' : '#4e93cf', 7, 6, 2.5);
    glint(glass, wx + 12, wy + 12, 12, 4, .5, -.8);
    x.strokeStyle = '#fff2dc'; x.lineWidth = 3; x.beginPath(); x.moveTo(wx + 22, wy); x.lineTo(wx + 22, wy + 56); x.moveTo(wx, wy + 28); x.lineTo(wx + 44, wy + 28); x.stroke();
    if (h > .62 && !lit) { x.fillStyle = '#ff7aa8'; x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 12, wy + 20, wx + 4, wy + 44); x.lineTo(wx, wy + 44); x.fill(); x.beginPath(); x.moveTo(wx + 44, wy); x.quadraticCurveTo(wx + 32, wy + 20, wx + 40, wy + 44); x.lineTo(wx + 44, wy + 44); x.fill(); }
    if (lit) { x.fillStyle = '#7a4a2a'; el(wx + 22, wy + 38, 9, 11); x.fill(); x.beginPath(); x.arc(wx + 22, wy + 22, 7, 0, 7); x.fill(); }
    rr(wx - 8, wy + 58, 60, 8, 4); ink('#d9b07a', 3);
    if (h < .28 && r < 4) { rr(wx + 6, wy + 62, 32, 12, 3); ink('#b4553a', 2.5); for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(wx + 10 + i * 12, wy + 58, 7, 0, 7); ink('#4fb260', 2.5); } }
  }
  // stone plinth + sidewalk
  x.fillStyle = '#c9826c'; x.fillRect(-OX, 494, VW, 32); x.fillStyle = INK; x.fillRect(-OX, 492, VW, 4);
  x.fillStyle = grad(526, 600, [[0, '#cdd3df'], [1, '#9ba2b3']]); x.fillRect(-OX, 526, VW, 80); x.fillStyle = INK; x.fillRect(-OX, 524, VW, 4);
  x.fillStyle = '#eef1f8'; x.fillRect(-OX, 528, VW, 8); x.strokeStyle = 'rgba(70,76,100,.25)'; x.lineWidth = 3; x.beginPath(); for (let c = -OX - 20; c < W + OX; c += 110) { x.moveTo(c, 538); x.lineTo(c - 26, 600); } x.stroke();
  // fire hydrant (right) + bin (left)
  const hx = W + OX - 64; rr(hx - 16, 470, 32, 56, 9); ink('#ff4d5e', 4); rr(hx - 22, 462, 44, 16, 8); ink('#e8434f', 4); rr(hx - 28, 488, 56, 12, 5); ink('#ff4d5e', 3.5); glint(null, hx - 7, 492, 3, 12, .5, 0);
  const bx = -OX + 44; rr(bx - 22, 468, 44, 58, 6); ink('#7f8aa0', 4); rr(bx - 26, 460, 52, 12, 5); ink('#aab4c8', 3.5); x.strokeStyle = 'rgba(20,16,28,.35)'; x.lineWidth = 3; x.beginPath(); for (let i = -1; i <= 1; i++) { x.moveTo(bx + i * 12, 478); x.lineTo(bx + i * 12, 518); } x.stroke();
});
function wiiSave(sp) {
  const grav = 760 * (sp > 1.5 ? 1.15 : 1), BY = 490;
  let tw = mouse.x, tx = mouse.x, caught = 0, stretch = 0, splat = 0, t = 0;
  const SR = 250 + OX * .6, P = { x: W / 2 + (Math.random() - .5) * 2 * (SR - 20), y: 80, vx: 0, vy: 0, rot: 0 };
  const g = {
    wide: true, cmd: 'SAVE ME!', hint: 'MOUSE / ← → SLIDES THE TRAMPOLINE', thint: 'DRAG LEFT AND RIGHT', dur: 6.2,
    move(p) { tx = p.x; },
    update(dt) {
      t += dt; stretch = Math.max(0, stretch - dt * 3);
      if (g.result === 'lose') { splat += dt; return; }
      if (keys.ArrowLeft || keys.KeyA) tx -= 700 * dt; if (keys.ArrowRight || keys.KeyD) tx += 700 * dt;
      tx = Math.max(90 - OX, Math.min(710 + OX, tx)); tw += (tx - tw) * Math.min(1, 16 * dt);
      if (g.result) return;
      if (t < .6) { P.rot = Math.sin(t * 30) * .15; return; }
      P.vy += grav * dt; P.x += P.vx * dt; P.y += P.vy * dt; P.rot += (P.vx / 60 + .5) * dt * 2;
      if (P.vy > 0 && P.y >= BY - 22 && P.y < BY + 30 && Math.abs(P.x - tw) < 78) {
        P.y = BY - 22; P.vy = -690; stretch = 1; caught++; sfx.boing(); sfx.blip(caught * 4); shake(4, .15); burst(P.x, BY, '#FFE14D', 10, 220); ring(P.x, BY, '#fff', 80, .35); floatText(caught >= 2 ? 'SAVED!' : 'BOING!', P.x, BY - 50, '#fff', 34);
        if (caught >= 2) { g.result = 'win'; P.vx = 0; sfx.sparkle(); confetti(P.x, BY - 40, 24); }
        else { const tg = W / 2 + (Math.random() - .5) * 2 * SR; P.vx = (tg - P.x) / (2 * 690 / grav); }
      }
      if (P.x < 40 - OX || P.x > 760 + OX) P.vx *= -1;
      if (P.y > 560) { g.result = 'lose'; sfx.splat(); wiiBang(P.x, 540); confetti(P.x, 540, 10); }
    },
    draw(tt) {
      const lose = g.result === 'lose', win = g.result === 'win', o = oT(), danger = !g.result && P.vy > 0 && P.y > 330 && Math.abs(P.x - tw) > 60;
      SAVE_BG();
      // background gags: a pigeon on the 5th-floor sill, a cat in the 2nd window, a granny in the 3rd row
      const px = 415 + Math.sin(tt * .9) * 12 + (win ? Math.sin(tt * 22) * 2 : 0);
      el(px, 112, 11, 9); ink('#9aa5c4', 2.5); el(px + 9, 104, 6, 6); ink('#b9c3de', 2.5); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px + 11, 103, 1.8, 0, 7); ctx.fill(); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(px + 14, 104); ctx.lineTo(px + 20, 106); ctx.lineTo(px + 14, 108); ctx.fill();
      const lk = [clamp((P.x - 262) / 200, -1, 1), clamp((P.y - 180) / 200, -1, 1)];
      ctx.fillStyle = '#2b1a3f'; ctx.fillRect(240, 155, 44, 56);  // the cat's window: dark room
      ctx.save(); ctx.beginPath(); ctx.rect(240, 155, 44, 56); ctx.clip();
      ctx.beginPath(); ctx.moveTo(246, 182); ctx.lineTo(249, 160); ctx.lineTo(260, 172); ctx.moveTo(278, 182); ctx.lineTo(275, 160); ctx.lineTo(264, 172); ctx.fillStyle = '#ff9a3c'; ctx.fill();
      el(262, 192, 19, 17); ink('#ffab4d', 3); glint(null, 254, 184, 6, 3, .5, -.4);
      for (const sx of [-1, 1]) K.eye(262 + sx * 8, 188, 5.5, win ? 'happy' : lose ? 'panic' : 'idle', lk, tt, sx);
      ctx.fillStyle = '#ff6f91'; ctx.beginPath(); ctx.moveTo(259, 196); ctx.lineTo(265, 196); ctx.lineTo(262, 200); ctx.fill();
      if (lose) { rr(250, 186, 24, 11, 5); ink('#ffab4d', 2); }       // paws over the eyes
      ctx.restore();
      rr(236, 206, 52, 8, 4); ink('#d9b07a', 3);
      // granny in the 3rd-row window (x 580)
      ctx.fillStyle = '#2b1a3f'; ctx.fillRect(580, 240, 44, 56); ctx.save(); ctx.beginPath(); ctx.rect(580, 240, 44, 56); ctx.clip();
      el(602, 288, 20, 18); ink('#6fb7e8', 2); el(602, 270, 13, 14); ink('#ffd3a5', 3); el(602, 258, 15, 9); ink('#d8dff0', 2.5); ctx.beginPath(); ctx.arc(590, 255, 4, 0, 7); ctx.arc(614, 255, 4, 0, 7); ink('#d8dff0', 2);
      for (const sx of [-1, 1]) K.eye(602 + sx * 6, 270, 4, win ? 'happy' : lose ? 'panic' : 'idle', [clamp((P.x - 602) / 200, -1, 1), clamp((P.y - 270) / 200, -1, 1)], tt, sx);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(596, 270, 6.5, 0, 7); ctx.arc(608, 270, 6.5, 0, 7); ctx.stroke();
      if (lose) { ctx.fillStyle = '#ffd3a5'; rr(590, 262, 24, 10, 5); ink('#ffd3a5', 2); } ctx.restore();
      rr(576, 292, 52, 8, 4); ink('#d9b07a', 3);
      if (win && o > .2) { K.heart(602, 232 - (o - .2) * 40, 1.1, 1 - (o - .2)); K.heart(260, 148 - (o - .2) * 40, .9, 1 - (o - .2)); }
      // tally sign: two stars on strings
      const sx0 = -OX + 62; ctx.strokeStyle = '#e6c58c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx0 - 34, 178); ctx.lineTo(sx0 - 20, 156); ctx.moveTo(sx0 + 34, 178); ctx.lineTo(sx0 + 20, 156); ctx.stroke();
      ctx.fillStyle = 'rgba(20,16,28,.3)'; rr(sx0 - 50 + 4, 178 + 7, 100, 40, 14); ctx.fill(); rr(sx0 - 50, 178, 100, 40, 14); ink('#d9944f', 4); ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(sx0 - 42, 182, 84, 6, 3); ctx.fill();
      for (let i = 0; i < 2; i++) { const on = i < caught, k = on ? 1 + Math.max(0, .6 - (tt % 100) * 0) * 0 : 1; K.star(sx0 - 20 + i * 40, 199, 14, 6, 5, -Math.PI / 2, on ? '#FFE14D' : '#a5622c', 3); }
      // helpers hold the net
      const hop = win ? Math.abs(Math.sin(tt * 9)) * 16 : 0, hm = lose ? 'sad' : win ? 'happy' : danger ? 'panic' : 'worry';
      for (const hx of [tw - 105, tw + 105]) { K.shade(hx, 530, 28, 8, .3); K.hero(hx, 530 - hop, 5, hm, tt, { arms: [0, 0, 1], look: [clamp((P.x - hx) / 200, -1, 1), -.6] }); K.hat('hard', hx, 530 - hop - 45, 5, hx < tw ? '#FFC93C' : '#4DB8FF', '#fff'); }
      const fy = BY + stretch * 22, sag = lose ? 14 : 0;
      ctx.beginPath(); ctx.moveTo(tw - 85, BY + 4); ctx.quadraticCurveTo(tw, fy + 12 + sag, tw + 85, BY + 4); ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 18; ctx.stroke(); ctx.strokeStyle = '#FF4D6D'; ctx.lineWidth = 9; ctx.stroke();
      ctx.save(); ctx.setLineDash([10, 12]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.stroke(); ctx.restore(); ctx.beginPath(); ctx.moveTo(tw - 80, BY - 1); ctx.quadraticCurveTo(tw, fy + 7 + sag, tw + 80, BY - 1); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineCap = 'butt';
      if (!lose) {
        K.shade(P.x, 532, Math.max(14, 44 - (BY - P.y) / 9), 7, .22);
        ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot); const sq = Math.min(.22, Math.abs(P.vy) / 3200) - stretch * .12; ctx.scale(1 - sq * .6, 1 + sq);
        const m = win ? 'happy' : P.vy > 0 ? 'panic' : 'worry', fl = Math.sin(tt * 20) * .5;
        K.hero(0, 22, 4.4, m, tt, { arms: [-2.6 + fl, 2.6 - fl, 1], look: [0, 1] }); K.hat('hard', 0, 22 - 39.6, 4.4, '#FFC93C', '#fff'); ctx.restore();
        if (!g.result && P.vy > 250) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(P.x + i * 18, P.y - 60 - i * i * 6); ctx.lineTo(P.x + i * 18, P.y - 95 - i * i * 6); ctx.stroke(); } ctx.lineCap = 'butt'; }
      } else {
        const k = Math.min(1, o * 6);
        K.shade(P.x, 532, 40 + k * 28, 9, .3); ctx.strokeStyle = 'rgba(20,16,28,.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = Math.PI + i * .78 - .1; ctx.moveTo(P.x + Math.cos(a) * 44, 534 + Math.sin(a) * 9); ctx.lineTo(P.x + Math.cos(a) * (60 + (i % 2) * 14), 534 + Math.sin(a) * 18); } ctx.stroke(); ctx.lineCap = 'butt';
        ctx.save(); ctx.translate(P.x, 534); ctx.scale(1.35, .32 + (1 - k) * .7); K.hero(0, 0, 4.4, 'bonk', tt, {}); ctx.restore();
        for (let i = 0; i < 3; i++) { const a = tt * 5 + i * 2.1; K.star(P.x + Math.cos(a) * 34, 500 + Math.sin(a) * 7, 8, 3.5, 5, tt * 4, '#FFE14D', 2.5); }
      }
      if (!g.result) { const near = Math.abs(P.x - tw) < 78; if (stretch > .5) K.badge('BOING!', P.x, BY - 62, 26, '#FFE14D', '#fff', K.pop(1 - stretch + .1), -.06); }
      vignette(.14);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 2 ── ZAP!: haunted two-storey motel; monsters peek out of doors, zap the eye */
const ZAP_BG = K.layer(x => {
  x.fillStyle = grad(0, 526, [[0, '#46308a'], [1, '#2c1f58']]); x.fillRect(-OX, 0, VW, 526);
  x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 3; x.beginPath(); for (let i = -OX - 40; i < W + OX; i += 40) { x.moveTo(i, 0); x.lineTo(i, 526); } x.stroke();
  x.fillStyle = 'rgba(255,255,255,.07)'; for (let r = 0; r < 14; r++) for (let c = -4; c < 24; c++) { x.beginPath(); x.arc(c * 40 - OX + 20 + (r & 1) * 20, r * 40 + 20, 3, 0, 7); x.fill(); }
  // balcony between the floors
  x.fillStyle = INK; x.fillRect(-OX, 288, VW, 50); x.fillStyle = grad(292, 336, [[0, '#a8703a'], [1, '#7a4a28']]); x.fillRect(-OX, 292, VW, 42);
  x.strokeStyle = 'rgba(20,16,28,.35)'; x.lineWidth = 3; x.beginPath(); for (let c = -OX; c < W + OX; c += 60) { x.moveTo(c, 292); x.lineTo(c - 8, 334); } x.stroke();
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(-OX, 294, VW, 5);
  // red carpet floor
  x.fillStyle = INK; x.fillRect(-OX, 522, VW, 90); x.fillStyle = grad(526, 600, [[0, '#b83a58'], [1, '#7e2140']]); x.fillRect(-OX, 526, VW, 80);
  x.fillStyle = '#ffd23f'; x.fillRect(-OX, 560, VW, 5); x.fillStyle = 'rgba(255,255,255,.1)'; for (let c = -OX; c < W + OX; c += 90) { x.beginPath(); x.moveTo(c, 526); x.lineTo(c + 30, 526); x.lineTo(c - 20, 600); x.lineTo(c - 50, 600); x.fill(); }
  // door frames + wall lamps
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const dx = 135 + c * 200, dy = 100 + r * 235; rr(dx - 14, dy - 14, 168, 214, 10); ink('#8a5a34', 4); rr(dx - 8, dy - 8, 156, 198, 6); ink('#c98443', 3); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(dx - 12, dy - 12, 6, 200);
    rr(dx + 52, dy - 36, 36, 18, 5); ink('#ffd23f', 3); x.fillStyle = INK; x.font = '900 13px "Arial Black", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(r * 3 + c + 1, dx + 70, dy - 26); }
  for (const lx of [305, 505]) for (const ly of [190, 425]) { rr(lx - 9, ly - 4, 18, 28, 6); ink('#e8d6a0', 3); x.fillStyle = 'rgba(255,230,150,.2)'; x.beginPath(); x.arc(lx, ly + 10, 38, 0, 7); x.fill(); }
  // round window with the moon (far left, above Claude)
  const mx = -OX + 62, my = 222; x.beginPath(); x.arc(mx, my, 36, 0, 7); ink('#1d1840', 5); x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(mx + 8, my - 6, 20, 0, 7); x.fill(); x.fillStyle = '#1d1840'; x.beginPath(); x.arc(mx + 17, my - 10, 17, 0, 7); x.fill();
  x.strokeStyle = INK; x.lineWidth = 4; x.beginPath(); x.moveTo(mx - 36, my); x.lineTo(mx + 36, my); x.moveTo(mx, my - 36); x.lineTo(mx, my + 36); x.stroke();
});
const ZAP_COLS = ['#C77DFF', '#5CFF7A', '#FF8FAB', '#FFE14D'], ZAP_SH = ['#8f4fd1', '#2fb34e', '#d4577f', '#d9b22a'];
function wiiZap(sp) {
  const vis = 1.2 / Math.pow(sp, .55), gap = .65 / Math.sqrt(sp), need = 4;
  const doors = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) doors.push({ x: 135 + c * 200, y: 100 + r * 235, op: 0, life: 0, z: 0, col: '#C77DFF', t: 0 });
  const cols = ['#C77DFF', '#5CFF7A', '#FF8FAB', '#FFE14D'];
  let sp0 = .5, zaps = 0, laser = 0, lx = 0, ly = 0, esc = null;
  const g = {
    wide: true, cmd: 'ZAP!', hint: 'CLICK THE EYES BEFORE THEY ESCAPE', thint: 'TAP THE EYES', dur: 6,
    down(p) {
      if (g.result) return; laser = .12; lx = p.x; ly = p.y;
      const d = doors.find(d => d.op > 0 && !d.z && p.x > d.x - 10 && p.x < d.x + 150 && p.y > d.y && p.y < d.y + 190);
      if (d) { d.z = .35; zaps++; sfx.zap(); sfx.blip(zaps * 3); shake(5, .15); burst(d.x + 70, d.y + 100, d.col, 14, 300); ring(d.x + 70, d.y + 100, '#FFE14D', 90, .35); floatText('ZAP!', d.x + 70, d.y + 30, '#FFE14D', 32); confetti(d.x + 70, d.y + 100, 10); if (zaps >= need) { g.result = 'win'; sfx.sparkle(); } }
      else sfx.click();
    },
    update(dt) {
      laser = Math.max(0, laser - dt);
      for (const d of doors) {
        d.t += dt;
        if (d.z > 0) { d.z -= dt; if (d.z <= 0) { d.op = 0; d.life = 0; } continue; }
        if (d.op > 0) { d.life += dt; if (d.life > vis && !g.result) { esc = d; g.result = 'lose'; wiiBang(d.x + 70, d.y + 100); } }
      }
      if (g.result) return;
      sp0 -= dt;
      if (sp0 <= 0 && zaps < need) {
        const free = doors.filter(d => !d.op), open = doors.length - free.length;
        if (open < 2 && free.length) { const d = free[Math.floor(Math.random() * free.length)]; d.op = 1; d.life = 0; d.t = 0; d.col = cols[Math.floor(Math.random() * 4)]; sfx.whoosh(true); }
        sp0 = gap;
      }
    },
    draw(t) {
      const o = oT(), lose = g.result === 'lose', win = g.result === 'win';
      ZAP_BG();
      // gag: a ghost janitor in a shower cap floats along the balcony with a mop
      const gx = 400 + Math.sin(t * .55) * 330, gd = Math.cos(t * .55) > 0 ? 1 : -1;
      ctx.save(); ctx.translate(gx, 314 + Math.sin(t * 3) * 3); ctx.globalAlpha = .92;
      ctx.beginPath(); ctx.moveTo(-14, 14); ctx.quadraticCurveTo(-18, -16, 0, -17); ctx.quadraticCurveTo(18, -16, 14, 14); for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(14 - i * 7 - 3.5, 20 + (i & 1 ? -3 : 4), 14 - (i + 1) * 7, 14); ctx.closePath(); ink('#f4f6ff', 3);
      el(0, -14, 15, 7); ink('#7fd8ff', 2.5); for (const sx of [-1, 1]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx * 5.5, -2, 2.6, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 5, 2.5, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(gd * 16, 12); ctx.lineTo(gd * 26, -4); ctx.stroke(); el(gd * 15, 21, 8, 4); ink('#b98042', 2);
      ctx.restore(); ctx.globalAlpha = 1;
      // doors
      for (const d of doors) {
        const dx = d.x, dy = d.y;
        if (d.op > 0) {
          const k = Math.min(1, d.t / .15), peek = d.z > 0 ? 1 : k, hurry = d.life > vis * .65;
          rr(dx, dy, 140, 190, 4); ink('#241338', 4); ctx.fillStyle = 'rgba(199,125,255,.18)'; ctx.fillRect(dx, dy + 150, 140, 40);
          ctx.save(); ctx.beginPath(); ctx.rect(dx, dy, 140, 190); ctx.clip();
          const ex = dx + 70, ey = dy + 118 - (1 - peek) * 60 + Math.sin(d.t * 8) * 3, zi = ZAP_COLS.indexOf(d.col);
          K.shade(ex, dy + 180, 52, 10, .35);
          const body = pEl(ex, ey, 52, 52); K.cel(body, d.col, ZAP_SH[zi < 0 ? 0 : zi], 8, 7, 5); K.glint(body, ex - 30, ey - 34, 12, 6, .45, -.6);
          for (const s of [-1, 1]) { el(ex + s * 54, ey + 26, 12, 9, s * .5); ink(d.col, 3.5); }   // little hands gripping the frame
          if (d.z > 0) { ctx.fillStyle = 'rgba(20,16,28,.5)'; ctx.fill(body); }
          el(ex, ey, 34, 34); ink('#fff', 3.5);
          const lkx = clamp((mouse.x - ex) / 260, -1, 1), lky = clamp((mouse.y - ey) / 260, -1, 1);
          if (d.z > 0) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - 14, ey - 12); ctx.lineTo(ex + 14, ey + 12); ctx.moveTo(ex + 14, ey - 12); ctx.lineTo(ex - 14, ey + 12); ctx.stroke(); ctx.fillStyle = '#ff6f91'; el(ex, ey + 42, 10, 7); ctx.fill(); }
          else {
            ctx.fillStyle = hurry ? '#ff2e4d' : '#ffd0da'; el(ex, ey, 34, 34); ctx.save(); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(ex - 34, ey - 34, 68, 68 * (hurry ? .5 : .12)); ctx.restore();
            ctx.fillStyle = '#fff'; el(ex, ey, 31, 31); ctx.fill();
            const lk = hurry ? 0 : 1; ctx.fillStyle = INK; el(ex + lkx * 10 * lk + Math.sin(d.t * 5) * 4 * (1 - lk), ey + lky * 9, hurry ? 9 : 15, hurry ? 9 : 16); ctx.fill(); ctx.fillStyle = '#fff'; el(ex + lkx * 10 * lk - 5, ey + lky * 9 - 6, 4.5, 3.5); ctx.fill();
            ctx.strokeStyle = INK; ctx.lineWidth = 5.5; ctx.lineCap = 'round'; ctx.beginPath(); if (hurry) { ctx.moveTo(ex - 34, ey - 36); ctx.lineTo(ex - 6, ey - 24); ctx.moveTo(ex + 34, ey - 36); ctx.lineTo(ex + 6, ey - 24); } else { ctx.moveTo(ex - 28, ey - 40); ctx.quadraticCurveTo(ex - 14, ey - 46, ex - 4, ey - 38); ctx.moveTo(ex + 28, ey - 40); ctx.quadraticCurveTo(ex + 14, ey - 46, ex + 4, ey - 38); } ctx.stroke();
            if (hurry) { ctx.beginPath(); ctx.moveTo(ex - 11, ey + 43); for (let i = 0; i < 5; i++) ctx.lineTo(ex - 11 + (i + 1) * 4.4, ey + 43 + (i & 1 ? 0 : 4)); ctx.stroke(); K.sweat(ex + 46, ey - 30, 1.1, d.t + 3); } else { ctx.beginPath(); ctx.arc(ex, ey + 38, 8, .2, Math.PI - .2); ctx.stroke(); }
          }
          ctx.restore();
          if (hurry && d.z <= 0) txt('!', dx + 128, dy + 22 + Math.sin(d.t * 18) * 3, 44, '#ff4d5e');
          if (d.z > 0) K.star(ex, ey, 70, 30, 8, d.t * 8, '#FFE14D', 4);
          // the open door panel
          const sw = 40 * (1 - Math.cos(k * 1.2)) + 10; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx - sw, dy + 12); ctx.lineTo(dx - sw, dy + 180); ctx.lineTo(dx, dy + 190); ctx.closePath(); ink('#FFB3D1', 4); ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.fill();
        } else {
          rr(dx, dy, 140, 190, 6); ink('#FFB3D1', 4); const pn = pRR(dx + 16, dy + 18, 108, 70, 8), pn2 = pRR(dx + 16, dy + 102, 108, 70, 8); ctx.fillStyle = 'rgba(20,16,28,.14)'; ctx.fill(pn); ctx.fill(pn2); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.stroke(pn); ctx.stroke(pn2);
          ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(dx + 6, dy + 6, 12, 178, 6); ctx.fill(); ctx.beginPath(); ctx.arc(dx + 112, dy + 100, 8, 0, 7); ink('#FFE14D', 3); ctx.fillStyle = '#fff'; ctx.fillRect(dx + 108, dy + 94, 3, 3);
          if (((dx / 200 | 0) + (dy / 200 | 0)) % 2 === 0) { ctx.fillStyle = 'rgba(20,16,28,.6)'; el(dx + 70, dy + 188, 22, 2.5); ctx.fill(); }
        }
      }
      if (esc) { const ex = esc.x + 70, ey = esc.y + 100, k = Math.min(1, (esc.life - vis) * 8 + .2); ctx.save(); ctx.beginPath(); ctx.rect(-OX, 0, VW, H); ctx.clip(); const body = pEl(ex, ey, 52 + k * 170, 52 + k * 170); K.cel(body, esc.col, ZAP_SH[Math.max(0, ZAP_COLS.indexOf(esc.col))], 14, 12, 6); el(ex, ey, 31 + k * 108, 31 + k * 108); ink('#fff', 4); ctx.fillStyle = INK; el(ex + 6 * k, ey, 15 + k * 50, 16 + k * 54); ctx.fill(); ctx.fillStyle = '#fff'; el(ex - 6 - k * 14, ey - 6 - k * 14, 5 + k * 16, 4 + k * 12); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 6 + k * 8; ctx.beginPath(); ctx.arc(ex, ey + 60 + k * 150, 20 + k * 90, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.restore(); }
      // Claude with the zapper (left) and the ghost-goo jar (right)
      const cx = -OX + 62, cy = 528, aim = Math.atan2(mouse.y - 480, mouse.x - cx - 34), mood = lose ? 'sad' : win ? 'happy' : doors.some(d => d.op > 0 && d.life > vis * .65) ? 'panic' : 'eager';
      K.shade(cx, cy + 2, 34, 8, .3); K.hero(cx, cy, 5, mood, t, { arms: [-.25, 0, 1], look: [clamp(Math.cos(aim), -1, 1), clamp(Math.sin(aim), -1, 1)] }); K.hat('band', cx, cy - 45, 5, '#4DB8FF');
      ctx.save(); ctx.translate(cx + 38, 498); ctx.rotate(laser > 0 ? Math.atan2(ly - 498, lx - cx - 38) : aim); rr(-6, -7, 38, 15, 5); ink('#4DB8FF', 3); rr(28, -5, 10, 11, 3); ink('#ff4d5e', 2.5); rr(-6, 4, 12, 16, 3); ink('#2b6ea8', 2.5); glint(null, 8, -3, 8, 2, .55, 0); ctx.restore();
      if (laser > 0) { const mx = cx + 38 + Math.cos(Math.atan2(ly - 498, lx - cx - 38)) * 38, my = 498 + Math.sin(Math.atan2(ly - 498, lx - cx - 38)) * 38; ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(lx, ly); ctx.stroke(); ctx.strokeStyle = '#ff2e4d'; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(lx, ly, 14, 0, 7); ink('#fff', 3); }
      const jx = W + OX - 60; rr(jx - 26, 196, 52, 20, 7); ink('#c9ced6', 4); rr(jx - 30, 214, 60, 238, 16); ink('rgba(220,245,255,.35)', 4);
      for (let i = 0; i < need; i++) { const on = i < zaps, jy = 424 - i * 56; rr(jx - 22, jy, 44, 46, 10); ctx.fillStyle = on ? '#5CFF7A' : 'rgba(20,16,28,.28)'; ctx.fill(); if (on) { glint(null, jx - 8, jy + 10, 8, 3.5, .6, -.5); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(jx - 8, jy + 22, 3, 0, 7); ctx.arc(jx + 8, jy + 22, 3, 0, 7); ctx.fill(); } }
      if (win && o > .1) for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + t; K.star(400 + Math.cos(a) * (60 + o * 340), 300 + Math.sin(a) * (30 + o * 200), 10, 4, 5, t * 4, '#FFE14D', 2.5); }
      vignette(.16);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 3 ── DRAW!: quick-draw duel in a western town; fire only after the "!" (not before, not too late) */
const DRAW_BG = K.layer(x => {
  x.fillStyle = grad(0, 440, [[0, '#ff8a4c'], [.55, '#ffb36a'], [1, '#ffe0a0']]); x.fillRect(-OX, 0, VW, 442);
  // setting sun (halo rings + disc) behind the town
  for (const [r, a] of [[210, .1], [168, .14], [138, .2]]) { x.fillStyle = `rgba(255,248,200,${a})`; x.beginPath(); x.arc(W / 2, 440, r, 0, 7); x.fill(); }
  x.beginPath(); x.arc(W / 2, 440, 120, Math.PI, 0); ink('#ffe14d', 4); x.fillStyle = '#fff3a0'; x.beginPath(); x.ellipse(W / 2 - 40, 392, 30, 14, -.5, 0, 7); x.fill();
  // far mesas (coloured outline, no ink)
  for (const [mx, w, h] of [[-OX + 60, 220, 90], [300, 160, 60], [660, 260, 100], [W + OX - 40, 200, 70]]) { x.beginPath(); x.moveTo(mx - w / 2, 440); x.lineTo(mx - w / 2 + 20, 440 - h); x.lineTo(mx + w / 2 - 30, 440 - h); x.lineTo(mx + w / 2, 440); x.closePath(); x.lineWidth = 5; x.strokeStyle = '#a8452e'; x.stroke(); x.fillStyle = '#d4683f'; x.fill(); x.fillStyle = '#b9532f'; x.fillRect(mx - w / 2 + 14, 440 - h * .5, w - 40, 6); }
  // town: false-front buildings behind the duellists
  const bl = [[-OX + 20, 120, 120, '#c98443', '#a5622c'], [W + OX - 150, 130, 105, '#b5835a', '#8f5f3a']];
  for (const [bx, bw, bh, c1, c2] of bl) { rr(bx, 440 - bh, bw, bh, 4); ink(c1, 4); x.fillStyle = c2; x.fillRect(bx + 4, 440 - bh + 4, 8, bh - 8); rr(bx - 6, 440 - bh - 24, bw + 12, 26, 4); ink(c2, 4);
    for (const wx of [bx + 18, bx + bw - 48]) { rr(wx, 440 - bh + 30, 30, 34, 4); ink('#3a2a4a', 3); x.fillStyle = '#ffd23f'; x.fillRect(wx + 4, 440 - bh + 48, 22, 3); } rr(bx + bw / 2 - 14, 440 - 46, 28, 46, 4); ink('#7a4a28', 3); }
  // ground: dusty street
  x.fillStyle = INK; x.fillRect(-OX, 438, VW, 4); x.fillStyle = grad(442, 600, [[0, '#e8b46c'], [1, '#c98a48']]); x.fillRect(-OX, 442, VW, 160);
  x.fillStyle = 'rgba(255,255,255,.14)'; for (let c = -OX; c < W + OX; c += 130) { x.beginPath(); x.moveTo(c, 442); x.lineTo(c + 40, 442); x.lineTo(c - 70, 600); x.lineTo(c - 110, 600); x.fill(); }
  x.strokeStyle = 'rgba(120,70,30,.45)'; x.lineWidth = 3; x.lineCap = 'round'; for (const yy of [490, 520]) { x.beginPath(); x.moveTo(-OX, yy); x.bezierCurveTo(200, yy - 6, 500, yy + 6, W + OX, yy); x.stroke(); }
  // saguaro (right) + hitching post
  const cx = W + OX - 44; rr(cx - 11, 400, 22, 88, 11); ink('#4fb260', 4); rr(cx - 36, 420, 13, 36, 6); ink('#4fb260', 3.5); rr(cx - 36, 444, 36, 12, 6); ink('#4fb260', 3.5); rr(cx + 24, 410, 13, 30, 6); ink('#4fb260', 3.5); rr(cx + 2, 430, 35, 12, 6); ink('#4fb260', 3.5); glint(null, cx - 5, 430, 3, 22, .4, 0);
});
function wiiDraw(sp) {
  const lim = .55 / Math.pow(sp, .5), delay = 1.3 + Math.random() * 1.4;
  let tm = 0, tg = 0, st = 0, react = 0, endT = 0;
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
      if (st === 0 && tm > delay) { st = 1; tg = 0; sfx.coin(); sfx.hit(); shake(3, .12); ring(W / 2, 170, '#FFE14D', 100, .35); }
      if (st === 1) { tg += dt; if (tg > lim) { st = 3; g.result = 'lose'; wiiBang(170, 330); } }
    },
    draw(tt) {
      const o = oT(), win = g.result === 'win', lose = g.result === 'lose', go = st === 1;
      DRAW_BG();
      // gags: a tumbleweed rolling by, a vulture on a signpost who watches the duel, the cactus peeks at the winner
      for (let i = 0; i < 2; i++) { const x = ((tt * 90 + i * 460) % (VW + 200)) - 100 - OX, y = 548 + Math.sin(tt * 7 + i) * 4; ctx.save(); ctx.translate(x, y); ctx.rotate(tt * 5 + i); ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ink('#c9a265', 3); ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 12, .3, 4); ctx.arc(2, 0, 6, 1, 5); ctx.stroke(); ctx.restore(); }
      const vx = 400, vy = 420; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(vx, 442); ctx.lineTo(vx, vy + 8); ctx.stroke(); ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 4; ctx.stroke();
      const fl = go ? Math.sin(tt * 30) * 8 : 0; ctx.save(); ctx.translate(vx, vy - 14 - (go ? 6 : 0));
      ctx.beginPath(); ctx.moveTo(-18, 8); ctx.quadraticCurveTo(-26, -16 - fl, -10, -6); ctx.lineTo(10, -6); ctx.quadraticCurveTo(26, -16 - fl, 18, 8); ctx.quadraticCurveTo(0, 20, -18, 8); ink('#5a4a72', 3);
      ctx.beginPath(); ctx.arc(-3, -16, 7, 0, 7); ink('#ffb3b3', 2.5); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-9, -16); ctx.lineTo(-18, -12); ctx.lineTo(-8, -11); ctx.fill();
      K.eye(-3, -18, 3.4, go ? 'panic' : 'idle', [lose ? -1 : win ? 1 : (tt % 4 < 2 ? -1 : 1), 0], tt, 0); ctx.restore();
      // duellists: Claude (cowboy hat) vs a purple stranger (bowler)
      const L = { x: 170, c: OR, dir: 1 }, R = { x: 630, c: '#8a6ad6', dir: -1 }, ang = Math.min(1, o * 4) * 1.2;
      for (const D of [L, R]) {
        const me = D === L, fell = me ? lose : win, won = me ? win : lose;
        K.shade(D.x, 444, 90, 18, .3);
        ctx.save(); ctx.translate(D.x, 440); if (fell) ctx.rotate(D.dir * -ang);
        const mood = fell ? 'bonk' : won ? 'happy' : go ? (me ? 'panic' : 'eager') : (tm > 1 ? 'worry' : 'eager'), aim = go || g.result ? 1 : .0;
        const sway = fell ? 0 : Math.sin(tt * 1.6 + (me ? 0 : 1)) * 1.5;
        K.hero(0, sway, 12, mood, tt, { col: D.c, arms: aim ? (me ? [-.4, Math.PI / 2 - .1, 1] : [-Math.PI / 2 + .1, .4, 1]) : [.25, -.25, .55], look: [D.dir, 0] });
        K.hat(me ? 'cowboy' : 'bowler', 0, -108 + sway, 12, me ? '#8a5a34' : '#2b2b3a', me ? '#ffd23f' : '#ff4d5e');
        if (aim && !fell) { const gx = D.dir * 79, gy = -62 + sway; ctx.save(); ctx.translate(gx, gy); ctx.scale(D.dir, 1); rr(-4, -9, 40, 16, 5); ink('#c9ced6', 3.5); rr(-10, 0, 14, 22, 4); ink('#8a5a34', 3); rr(30, -7, 10, 12, 3); ink('#ffd23f', 2.5); glint(null, 12, -4, 10, 2.5, .6, 0);
          if (won) { rr(36, -26, 38, 26, 3); ink('#fff', 2.5); ctx.fillStyle = INK; ctx.fillRect(38, -28, 3, 40); txt('BANG!', 56, -13, 12, '#ff4d5e'); }
          ctx.restore(); }
        ctx.restore();
        if (fell && o > .15) for (let i = 0; i < 3; i++) { const a = tt * 5 + i * 2.1; K.star(D.x + Math.cos(a) * 42, 420 + Math.sin(a) * 8 + 40, 9, 4, 5, tt * 4, '#FFE14D', 2.5); }
      }
      if (go) { const pu = 1 + Math.max(0, .25 - tg * 2.5); ctx.save(); ctx.translate(W / 2, 170); ctx.scale(pu, pu); K.star(0, 0, 92, 62, 14, tt * 1.2, '#ff4d5e', 5); txt('!', 0, 6, 120, '#FFE14D'); ctx.restore(); }
      if (st === 0) { ctx.save(); ctx.translate(W / 2, 190); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-30 + i * 30, 8, 10 + (Math.sin(tt * 5 - i) > 0 ? 3 : 0), 0, 7); ink('#fff', 3.5); } ctx.restore(); }
      if (win) { rr(W / 2 - 86, 462, 172, 50, 12); ink('#d9944f', 4); ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(W / 2 - 78, 466, 156, 7, 3); ctx.fill(); txt(t('{n} MS', { n: Math.round(react * 1000) }), W / 2, 489, 30, '#fff'); }
      if (lose && o < .6) K.badge(tg > 0 ? 'TOO SLOW!' : 'TOO EARLY!', W / 2, 150, 44, '#ff4d5e', '#fff', K.outBack(o / .25) , -.05);
      vignette(.16);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 4 ── SNEAK!: burglar Claude's rubber arm creeps up on a sleeping dog's bone in a sunny backyard; freeze when he looks */
const SNEAK_BG = K.layer(x => {
  x.fillStyle = grad(0, 440, [[0, '#7cd0f5'], [.7, '#c8f0ff'], [1, '#effcff']]); x.fillRect(-OX, 0, VW, 442);
  K.cloud(120, 110, 1.1); K.cloud(520, 90, .9); K.cloud(W + OX - 190, 150, 1.2);
  // hedge + hills
  x.fillStyle = '#9be38a'; x.beginPath(); x.moveTo(-OX, 360); for (let c = -OX; c < W + OX + 90; c += 90) x.quadraticCurveTo(c + 45, 290, c + 90, 360); x.lineTo(W + OX, 442); x.lineTo(-OX, 442); x.closePath(); x.fill(); x.strokeStyle = '#4f9a6a'; x.lineWidth = 5; x.stroke();
  for (let c = -OX + 40; c < W + OX; c += 130) { x.beginPath(); x.arc(c, 346, 24, 0, 7); ink('#4fb260', 3.5); x.fillStyle = 'rgba(255,255,255,.3)'; el(c - 8, 338, 8, 5, -.5); x.fill(); }
  // picket fence
  x.fillStyle = INK; x.fillRect(-OX, 372, VW, 7); x.fillRect(-OX, 412, VW, 7);
  for (let c = -OX - 10; c < W + OX; c += 44) { x.beginPath(); x.moveTo(c, 440); x.lineTo(c, 346); x.lineTo(c + 17, 330); x.lineTo(c + 34, 346); x.lineTo(c + 34, 440); x.closePath(); ink('#fff4dc', 3.5); x.fillStyle = 'rgba(160,110,60,.25)'; x.fillRect(c + 24, 346, 10, 94); x.fillStyle = '#e3a868'; x.fillRect(c + 2, 372, 30, 5); x.fillRect(c + 2, 412, 30, 5); }
  // lawn
  x.fillStyle = INK; x.fillRect(-OX, 438, VW, 4); x.fillStyle = grad(442, 600, [[0, '#8fdc5c'], [1, '#5fb944']]); x.fillRect(-OX, 442, VW, 160);
  x.fillStyle = 'rgba(255,255,255,.12)'; for (let c = -OX; c < W + OX; c += 120) { x.beginPath(); x.moveTo(c, 442); x.lineTo(c + 40, 442); x.lineTo(c - 60, 600); x.lineTo(c - 100, 600); x.fill(); }
  x.strokeStyle = '#3f8f35'; x.lineWidth = 3; x.lineCap = 'round'; for (const [tx, ty] of [[220, 470], [330, 540], [470, 505], [700, 535], [140, 560]]) { x.beginPath(); x.moveTo(tx - 6, ty); x.lineTo(tx - 9, ty - 12); x.moveTo(tx, ty); x.lineTo(tx, ty - 15); x.moveTo(tx + 6, ty); x.lineTo(tx + 10, ty - 12); x.stroke(); }
  for (const [fx, fy, c] of [[260, 520, '#ff8fab'], [610, 548, '#ffe14d'], [190, 480, '#fff']]) { x.beginPath(); x.arc(fx, fy, 5, 0, 7); ink(c, 2.5); x.fillStyle = '#ffb347'; x.beginPath(); x.arc(fx, fy, 2, 0, 7); x.fill(); }
  // braided rug under the dog
  el(655, 452, 128, 20); ink('#d2587a', 4); el(655, 452, 100, 14); ink('#f6a5bd', 2.5);
});
function wiiSneak(sp) {
  const k = Math.sqrt(sp), BX = 610, X0 = 80;
  let p = 0, hold = false, st = 'sleep', stT = 0, stD = 1.3, lookT = 0, t = 0;
  const hxp0 = () => X0 + p * (BX - 55 - X0);
  const press = () => { if (!g.result) hold = true; }, rel = () => { hold = false; };
  const g = {
    wide: true, cmd: 'SNEAK!', hint: 'HOLD TO CREEP · RELEASE WHEN HE LOOKS', thint: 'HOLD TO CREEP, LET GO WHEN HE LOOKS', dur: 6.2,
    key(e) { if (e.code === 'Space' && !e.repeat) press(); }, keyup(e) { if (e.code === 'Space') rel(); },
    down() { press(); }, up() { rel(); },
    update(dt) {
      t += dt; if (g.result) return;
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
      const o = oT(), win = g.result === 'win', lose = g.result === 'lose', look = st === 'look' || lose, warn = st === 'warn' && !g.result;
      SNEAK_BG();
      const hxp = X0 + p * (BX - 55 - X0) + (lose ? Math.sin(tt * 40) * 4 : 0), br = Math.sin(tt * 2) * (look ? 0 : 1);
      // gag: a cat on the fence who watches the sneaking hand
      const cx = 300, cy = 372, cl = [clamp((hxp - cx) / 250, -1, 1), clamp((494 - cy) / 150, -1, 1)];
      ctx.beginPath(); ctx.moveTo(cx - 26, cy); ctx.quadraticCurveTo(cx - 54, cy - 12 + Math.sin(tt * 3) * 12, cx - 44, cy - 44); ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = '#6a6f86'; ctx.stroke(); ctx.lineCap = 'butt';
      rr(cx - 28, cy - 38, 56, 42, 22); ink('#8a8fa8', 4); ctx.beginPath(); ctx.moveTo(cx - 24, cy - 62); ctx.lineTo(cx - 16, cy - 82); ctx.lineTo(cx - 4, cy - 64); ctx.moveTo(cx + 24, cy - 62); ctx.lineTo(cx + 16, cy - 82); ctx.lineTo(cx + 4, cy - 64); ctx.fillStyle = '#8a8fa8'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      el(cx, cy - 42, 28, 24); ink('#a3a8c0', 4); glint(null, cx - 9, cy - 52, 8, 4, .5, -.4);
      for (const sx of [-1, 1]) K.eye(cx + sx * 11, cy - 44, 7, win ? 'happy' : lose ? 'bonk' : look ? 'panic' : 'idle', cl, tt, sx);
      ctx.fillStyle = '#ff6f91'; ctx.beginPath(); ctx.moveTo(cx - 3, cy - 36); ctx.lineTo(cx + 3, cy - 36); ctx.lineTo(cx, cy - 32); ctx.fill();
      // bone (taken on a win)
      const bonex = win ? hxp + 4 : BX, boney = win ? 494 - Math.min(1, o * 4) * 34 : 470;
      K.shade(BX, 486, 36, 7, .22);
      ctx.save(); ctx.translate(bonex, boney); ctx.rotate(win ? -.3 + Math.sin(tt * 9) * .12 : -.3);
      for (const [kx, ky] of [[-34, -8], [-34, 8], [34, -8], [34, 8]]) { ctx.beginPath(); ctx.arc(kx, ky, 11, 0, 7); ink('#fff', 3); } rr(-34, -7, 68, 14, 5); ink('#fff', 3); ctx.fillStyle = 'rgba(160,140,110,.35)'; ctx.fillRect(-30, 2, 60, 4); ctx.restore();
      // sleeping dog (cel shaded)
      const lunge = lose ? Math.min(1, o * 5) * -34 : 0, wag = look ? .08 : Math.sin(tt * (warn ? 0 : 6)) * .35;
      ctx.save(); ctx.translate(lunge, 0);
      K.shade(655, 446, 112, 14, .28);
      for (const lx of [570, 710]) { rr(lx, 408, 30, 38, 12); ink('#a8621f', 4); } // far/near legs
      ctx.save(); ctx.translate(748, 365); ctx.rotate(look ? -.9 : -.5 + wag); rr(-4, -10, 52, 20, 10); ink('#B5651D', 4); ctx.restore();
      ctx.save(); ctx.translate(655, 440); ctx.scale(1, 1 + br * .02); ctx.translate(-655, -440); const body = pRR(560, 330, 190, 112, 46); K.cel(body, '#C97A2B', '#9a5a1b', 9, 8, 6); K.glint(body, 600, 352, 26, 8, .35, -.2);
      ctx.fillStyle = 'rgba(255,230,190,.55)'; el(660, 428, 60, 12); ctx.fill(); ctx.restore();
      rr(570, 332, 18, 44, 8); ink('#ff4d5e', 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(579, 380, 6, 0, 7); ctx.fill();
      const hx = look ? 520 : 540, hy = 335 + (look ? 0 : Math.sin(tt * 2) * 3), hc = pEl(hx + 40, hy, 62, 58);
      const ear = look ? -.25 : warn ? Math.sin(tt * 40) * .1 : .1;
      for (const [ex, ey, s] of [[hx - 4, hy - 38, -1], [hx + 90, hy - 40, 1]]) { ctx.save(); ctx.translate(ex + 15, ey); ctx.rotate(ear * s + (s < 0 ? .15 : -.15)); rr(-17, -12, 34, 70, 16); ink('#8a4b12', 4); glint(null, -6, 4, 4, 14, .3, 0); ctx.restore(); }
      K.cel(hc, '#C97A2B', '#9a5a1b', 8, 7, 6); K.glint(hc, hx + 14, hy - 34, 18, 7, .4, -.4);
      el(hx - 2, hy + 20, 32, 26); ink('#F0D2A6', 4.5); ctx.fillStyle = INK; el(hx - 18, hy + 8, 11, 8, -.2); ctx.fill(); ctx.fillStyle = '#fff'; el(hx - 21, hy + 5, 3.5, 2.5); ctx.fill();
      const eyesy = hy - 12;
      if (look) { for (const [ex, sx] of [[hx + 22, -1], [hx + 66, 1]]) { el(ex, eyesy, 15, 16); ink('#fff', 3.5); ctx.fillStyle = '#ff2e4d'; ctx.beginPath(); ctx.arc(ex + (lose ? -4 : 0) - 4, eyesy + 1, 7, 0, 7); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex - 4, eyesy + 1, 3, 0, 7); ctx.fill(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hx + 4, eyesy - 24); ctx.lineTo(hx + 34, eyesy - 12); ctx.moveTo(hx + 84, eyesy - 24); ctx.lineTo(hx + 54, eyesy - 12); ctx.stroke(); }
      else { for (const [ex, sx] of [[hx + 22, 0], [hx + 66, 1]]) { if (warn && sx) { el(ex, eyesy, 13, 12); ink('#fff', 3.5); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex - 3, eyesy + 1, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#C97A2B'; ctx.fillRect(ex - 15, eyesy - 15, 30, 14); } else { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ex, eyesy - 2, 10, .2, Math.PI - .2); ctx.stroke(); } } }
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      if (look) { ctx.moveTo(hx - 22, hy + 44); ctx.lineTo(hx + 20, hy + 44); ctx.stroke(); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 18 + i * 10, hy + 44); ctx.lineTo(hx - 13 + i * 10, hy + 54); ctx.lineTo(hx - 8 + i * 10, hy + 44); ctx.fill(); ctx.stroke(); } }
      else { ctx.arc(hx + 6, hy + 40, 14, .2, Math.PI * .8); ctx.stroke(); if (!warn) { const dr = (tt * 1.3) % 1; ctx.fillStyle = '#9fe3ff'; el(hx + 8, hy + 56 + dr * 12, 4 - dr, 6 - dr * 2); ctx.fill(); } }
      ctx.lineCap = 'butt'; ctx.restore();
      if (st === 'sleep' && !g.result) { K.zee(hx + 112, hy - 64 - ((tt * 30) % 30), 1.1, 1 - ((tt * 30) % 30) / 36); K.zee(hx + 144, hy - 94 - ((tt * 30) % 30), .75, 1 - ((tt * 30) % 30) / 36); }
      if (st === 'sleep' || win) { for (const [bx2, by2, r] of [[hx + 108, hy - 74, 5], [hx + 128, hy - 98, 8]]) { ctx.beginPath(); ctx.arc(bx2 + 70, by2 + 18, r, 0, 7); ink('#fff', 2.5); } ctx.beginPath(); ctx.ellipse(hx + 230, hy - 100, 40, 28, 0, 0, 7); ink('#fff', 3.5); if (!win) { ctx.save(); ctx.translate(hx + 230, hy - 100); ctx.rotate(-.4); rr(-16, -4, 32, 8, 4); ink('#f4ead8', 2); for (const [kx, ky] of [[-16, -4], [-16, 4], [16, -4], [16, 4]]) { ctx.beginPath(); ctx.arc(kx, ky, 5, 0, 7); ink('#f4ead8', 2); } ctx.restore(); } }
      if (warn) K.badge('!', hx + 40, hy - 100 + Math.sin(tt * 30) * 3, 40, '#FFE14D', '#ff4d5e', 1, 0);
      if (look && !lose) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx + 20 + i * 24, hy - 66); ctx.lineTo(hx + 14 + i * 24, hy - 86); ctx.stroke(); } ctx.lineCap = 'butt'; }
      if (lose) for (let i = 0; i < 4; i++) { const a = -.5 + i * .32, d = 40 + ((o * 400 + i * 40) % 120); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(hx - 10, hy + 40, 30 + d, Math.PI + a - .15, Math.PI + a + .15); ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
      // Claude with a stretchy arm (left), a ninja band and a frozen stare when the dog looks
      const cX = 40, cY = 520, sx0 = cX + 33, sy0 = 494, mood = lose ? 'panic' : win ? 'happy' : look ? 'worry' : hold ? 'eager' : 'idle', wob = Math.sin(tt * 14) * (hold ? 1.5 : 0);
      K.shade(cX, cY + 2, 36, 8, .3);
      ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.bezierCurveTo(sx0 + (hxp - sx0) * .35, sy0 + 12 + wob, sx0 + (hxp - sx0) * .65, sy0 - 12 - wob, hxp - 16, 494); ctx.lineCap = 'round'; ctx.lineWidth = 24; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 15; ctx.strokeStyle = OR; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(sx0 + 4, sy0 - 4); ctx.bezierCurveTo(sx0 + (hxp - sx0) * .35, sy0 + 8 + wob, sx0 + (hxp - sx0) * .65, sy0 - 16 - wob, hxp - 20, 489); ctx.stroke(); ctx.lineCap = 'butt';
      K.hero(cX, cY, 5, mood, tt, { arms: [.3, 0, 0], look: [1, 0] }); K.hat('band', cX, cY - 45, 5, '#2b2b3a');
      circ(hxp, 494, 24, '#fff', 4.5); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hxp + 2, 484 + i * 10); ctx.lineTo(hxp + 20, 484 + i * 10); ctx.stroke(); } ctx.lineCap = 'butt'; K.glint(null, hxp - 9, 484, 8, 4, .7, -.5);
      if (lose) { K.sweat(hxp + 10, 460, 1.4, tt); K.sweat(cX + 30, 450, 1.1, tt + .4); }
      if (win && o > .1) K.sparkle(bonex, boney, 40, tt, 6);
      if (!g.result && hold && look) K.badge('FREEZE!', W / 2, 140, 40, '#ff4d6d', '#fff', 1, -.05);
      vignette(.14);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 5 ── UMBRELLA!: a rainy-night spy with an umbrella strapped to his hat; pop it when the rain gauge is in the green */
const UMB_BG = K.layer(x => {
  x.fillStyle = grad(0, 500, [[0, '#46557c'], [1, '#5f7098']]); x.fillRect(-OX, 0, VW, 502);
  x.strokeStyle = 'rgba(20,16,28,.22)'; x.lineWidth = 2.5; x.beginPath(); for (let y = 140; y < 502; y += 26) { x.moveTo(-OX, y); x.lineTo(W + OX, y); for (let c = -OX - 80 + ((y / 26) & 1) * 40; c < W + OX; c += 80) { x.moveTo(c, y); x.lineTo(c, y - 26); } } x.stroke();
  for (let i = 0; i < 9; i++) { const wx = -OX + 40 + i * 120 + (i & 1) * 20, wy = 160 + (i % 3) * 28, lit = hash(i * 5) > .45; rr(wx, wy, 40, 52, 5); ink(lit ? '#ffd86b' : '#2a3350', 3.5); if (lit) { x.fillStyle = 'rgba(20,16,28,.5)'; x.fillRect(wx + 18, wy, 4, 52); x.fillRect(wx, wy + 24, 40, 4); } }
  // thunderheads (coloured outline, far)
  for (let k = -Math.ceil(OX / 500); k <= Math.ceil(OX / 500); k++) for (const [cx, cy, r] of [[180, 90, 60], [260, 70, 75], [340, 95, 60], [470, 80, 70], [560, 70, 75], [640, 95, 58]]) { x.beginPath(); x.arc(cx + k * 500, cy, r, 0, 7); x.lineWidth = 8; x.strokeStyle = '#2f3550'; x.stroke(); }
  for (let k = -Math.ceil(OX / 500); k <= Math.ceil(OX / 500); k++) for (const [cx, cy, r] of [[180, 90, 60], [260, 70, 75], [340, 95, 60], [470, 80, 70], [560, 70, 75], [640, 95, 58]]) { x.beginPath(); x.arc(cx + k * 500, cy, r, 0, 7); x.fillStyle = '#4a5072'; x.fill(); }
  for (let k = -Math.ceil(OX / 500); k <= Math.ceil(OX / 500); k++) for (const [cx, cy, r] of [[180, 90, 60], [260, 70, 75], [470, 80, 70]]) { x.beginPath(); x.arc(cx + k * 500 - 6, cy - 8, r * .75, 0, 7); x.fillStyle = '#5b6288'; x.fill(); }
  // drainpipe spouting (right) + street lamp
  const px = W + OX - 70; rr(px - 8, 150, 16, 300, 5); ink('#8f9cb3', 3.5); rr(px - 14, 440, 28, 62, 4); ink('#8f9cb3', 3.5); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px - 4, 152, 4, 290);
  // wet street
  x.fillStyle = INK; x.fillRect(-OX, 498, VW, 4); x.fillStyle = grad(502, 600, [[0, '#46526f'], [1, '#2d364d']]); x.fillRect(-OX, 502, VW, 100);
  x.fillStyle = 'rgba(255,255,255,.08)'; for (let c = -OX; c < W + OX; c += 150) { x.beginPath(); x.moveTo(c, 502); x.lineTo(c + 30, 502); x.lineTo(c - 40, 600); x.lineTo(c - 70, 600); x.fill(); }
  for (const [pxx, pyy, rw] of [[200, 540, 56], [600, 556, 70], [330, 580, 40], [W + OX - 90, 530, 40]]) { el(pxx, pyy, rw, 9); ink('#7e93b8', 2.5); x.fillStyle = 'rgba(255,255,255,.35)'; el(pxx - rw * .3, pyy - 2, rw * .3, 2.5); x.fill(); }
});
function wiiUmbrella(sp) {
  const zw = .2 / Math.pow(sp, .35), zc = .3 + Math.random() * .45, per = 1.7 / sp;
  let t = 0, cur = 0, open = 0, wet = 0; const drops = [];
  const g = {
    wide: true, cmd: 'UMBRELLA!', hint: 'CLICK / SPACE WHEN THE BAR IS GREEN', thint: 'TAP WHEN THE BAR IS GREEN', dur: 4.8,
    key(e) { if (e.code === 'Space') go(); }, down() { go(); },
    update(dt) {
      t += dt;
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
      const o = oT(), win = g.result === 'win', lose = g.result === 'lose', ow = win ? Math.min(1, o * 7 + .05) : open;
      UMB_BG();
      if (win && o > .1) { const ra = Math.min(.8, (o - .1) * 2); ctx.lineWidth = 12; for (let i = 0; i < 6; i++) { ctx.strokeStyle = ['#ff4d5e', '#ff9a3c', '#ffe14d', '#5CFF7A', '#4DB8FF', '#a98bff'][i]; ctx.globalAlpha = ra; ctx.beginPath(); ctx.arc(400, 560, 420 - i * 11, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); } ctx.globalAlpha = 1; }
      // gag: a stray cat in a tipped box, smug and dry (laughs when the spy gets soaked)
      const bx = 640; ctx.beginPath(); ctx.moveTo(bx - 56, 500); ctx.lineTo(bx - 48, 450); ctx.lineTo(bx + 52, 450); ctx.lineTo(bx + 60, 500); ctx.closePath(); ink('#d9a361', 4); ctx.fillStyle = 'rgba(20,16,28,.2)'; ctx.fillRect(bx - 40, 452, 84, 8);
      ctx.save(); ctx.beginPath(); ctx.rect(bx - 48, 400, 108, 100); ctx.clip(); el(bx, 456, 24, 20); ink('#ff9a3c', 3.5); ctx.beginPath(); ctx.moveTo(bx - 20, 440); ctx.lineTo(bx - 14, 420); ctx.lineTo(bx - 3, 436); ctx.moveTo(bx + 20, 440); ctx.lineTo(bx + 14, 420); ctx.lineTo(bx + 3, 436); ctx.fillStyle = '#ff9a3c'; ctx.fill(); ctx.stroke();
      for (const s of [-1, 1]) K.eye(bx + s * 9, 452, 5.5, lose ? 'happy' : 'idle', [-.5, .3], tt, s); ctx.fillStyle = '#ff6f91'; ctx.beginPath(); ctx.moveTo(bx - 3, 461); ctx.lineTo(bx + 3, 461); ctx.lineTo(bx, 465); ctx.fill(); ctx.restore();
      rr(bx - 58, 490, 124, 14, 4); ink('#d9a361', 3.5);
      // rain, then the spy and the umbrella
      ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (const d of drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y - 16); } ctx.stroke(); ctx.lineCap = 'butt';
      K.shade(400, 504, 70, 10, .3);
      const sad = lose ? Math.min(1, wet) : 0, tilt = sad * .22, mood = lose ? 'sad' : win ? 'happy' : t < .5 ? 'idle' : (cur >= zc - zw / 2 && cur <= zc + zw / 2) ? 'eager' : (t > 2.2 ? 'worry' : 'smug');
      K.hero(400, 500, 9, mood, tt, { col: '#8a8f9e', arms: [.35, -.35, .8], look: [0, lose ? .8 : -.5] });
      ctx.beginPath(); ctx.moveTo(344, 421); ctx.lineTo(358, 421); ctx.lineTo(350, 444); ctx.closePath(); ink('#6e7488', 2.5); ctx.beginPath(); ctx.moveTo(456, 421); ctx.lineTo(442, 421); ctx.lineTo(450, 444); ctx.closePath(); ink('#6e7488', 2.5);
      rr(346, 466, 108, 11, 4); ink('#5b5f6e', 3); rr(392, 464, 16, 15, 3); ink('#ffd23f', 2.5);
      ctx.save(); ctx.translate(400, 419); ctx.rotate(tilt); K.hat('fedora', 0, 0, 9, '#2b2b3a', '#ff4d5e'); ctx.restore();
      if (lose) { ctx.fillStyle = `rgba(77,184,255,${.35 * sad})`; rr(342, 428, 116, 76, 10); ctx.fill(); for (let i = 0; i < 6; i++) { const dx = 350 + i * 20, dy = 470 + ((tt * 90 + i * 31) % 40); ctx.fillStyle = '#9fe3ff'; el(dx, dy, 3, 5); ctx.fill(); } el(400, 506, 40 + sad * 50, 8 + sad * 3); ctx.fillStyle = 'rgba(159,227,255,.55)'; ctx.fill(); }
      // umbrella-hat: a rolled umbrella strapped to the hat, popping open
      const cyU = 392 - 42 * ow;
      if (ow < .05) { ctx.save(); ctx.translate(400, 396); rr(-6, -62, 12, 62, 6); ink('#ff4d5e', 3.5); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, -40); ctx.lineTo(6, -34); ctx.moveTo(-6, -22); ctx.lineTo(6, -16); ctx.stroke(); rr(-3, -72, 6, 14, 3); ink('#ffd23f', 2.5); ctx.restore(); }
      else {
        const s = ow, R = 100 * s + 4; ctx.save(); ctx.translate(400, cyU);
        ctx.fillStyle = INK; ctx.fillRect(-4.5, 0, 9, 392 - cyU + 4); ctx.fillStyle = '#c9ced6'; ctx.fillRect(-2, 0, 4, 392 - cyU + 2);
        const n = 6, dome = new Path2D(); dome.moveTo(-R, 0); dome.bezierCurveTo(-R, -R * .95, R, -R * .95, R, 0); for (let i = n; i > 0; i--) { const x1 = -R + (i - .5) * (2 * R / n), x0 = -R + (i - 1) * (2 * R / n); dome.quadraticCurveTo(x1, 14, x0, 0); } dome.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(dome); ctx.fillStyle = '#ff4d5e'; ctx.fill(dome);
        ctx.save(); ctx.clip(dome); for (let i = 0; i < n; i += 2) { ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(-R + i * (2 * R / n), 16); ctx.lineTo(-R + (i + 1) * (2 * R / n), 16); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = 'rgba(20,16,28,.2)'; ctx.beginPath(); ctx.ellipse(R * .4, -R * .2, R * .9, R * .75, 0, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-R * .42, -R * .5, R * .22, R * .1, -.6, 0, 7); ctx.fill(); ctx.restore();
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 1; i < n; i++) { ctx.moveTo(0, -R * .95 * .9); ctx.lineTo(-R + i * (2 * R / n), 4); } ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -R * .93, 6, 0, 7); ink('#ffd23f', 3); ctx.restore();
      }
      if (win && o > .1) K.sparkle(400, 330, 130, tt, 7);
      // rain gauge on the wall: a glass tube with a green zone and a gold pointer
      rr(62, 128, 90, 372, 16); ink('#d9944f', 4.5); ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(68, 134, 78, 8, 4); ctx.fill();
      ctx.beginPath(); ctx.arc(107, 124, 22, 0, 7); ink('#4DB8FF', 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(107, 122, 10, Math.PI, 0); ctx.lineTo(97, 122); ctx.stroke(); ctx.beginPath(); ctx.moveTo(107, 122); ctx.lineTo(107, 135); ctx.stroke();
      rr(80, 150, 54, 330, 20); ink('#e9f7ff', 4); ctx.save(); rr(80, 150, 54, 330, 20); ctx.clip(); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(80, 480 - (zc + zw / 2) * 340, 54, zw * 340); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(86, 154, 8, 322); ctx.restore();
      ctx.strokeStyle = 'rgba(20,16,28,.5)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 10; i++) { ctx.moveTo(112 + (i % 5 ? 0 : 8), 480 - i * 33); ctx.lineTo(134, 480 - i * 33); } ctx.stroke();
      const cy = 480 - cur * 340; ctx.beginPath(); ctx.moveTo(64, cy - 10); ctx.lineTo(80, cy); ctx.lineTo(64, cy + 10); ctx.closePath(); ink('#FFE14D', 3); rr(80, cy - 6, 62, 12, 6); ink('#FFE14D', 3); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(86, cy - 3, 40, 3);
      if (t < .5) K.badge('RAIN!', W / 2, 250, 50, '#4DB8FF', '#fff', K.outBack(t / .25), -.05);
      vignette(.2);
    }
  };
  function go() {
    if (g.result || t < .35) return;
    if (cur >= zc - zw / 2 && cur <= zc + zw / 2) { g.result = 'win'; sfx.pop(); sfx.sparkle(); ring(400, 350, '#fff', 130, .45); burst(400, 340, '#FF4D6D', 16); floatText('PERFECT!', 400, 250, '#5CFF7A', 38); }
    else { g.result = 'lose'; sfx.splat(); wiiBang(400, 450); }
  }
  const oT = K.outro(g);
  return g;
}

/* 6 ── POP IT!: Claude pumps a nervous balloon at a birthday party while a puppy covers its ears */
const POP_BG = K.layer(x => {
  x.fillStyle = '#ffe066'; x.fillRect(-OX, 0, VW, 542);
  x.fillStyle = 'rgba(255,255,255,.28)'; for (let r = 0; r < 14; r++) for (let c = -4; c < 24; c++) { x.beginPath(); x.arc(c * 56 - OX + (r & 1) * 28, r * 40 + 20, 7, 0, 7); x.fill(); }
  x.fillStyle = 'rgba(255,140,60,.18)'; x.fillRect(-OX, 420, VW, 122); x.fillStyle = '#d9944f'; x.fillRect(-OX, 418, VW, 10); x.fillStyle = INK; x.fillRect(-OX, 426, VW, 3);
  // floor: pink carpet with confetti
  x.fillStyle = INK; x.fillRect(-OX, 538, VW, 70); x.fillStyle = grad(542, 600, [[0, '#f59ac0'], [1, '#d56a98']]); x.fillRect(-OX, 542, VW, 70);
  for (let i = 0; i < 40; i++) { x.fillStyle = ['#ffe14d', '#4DB8FF', '#5CFF7A', '#fff'][i & 3]; x.save(); x.translate(-OX + hash(i) * VW, 548 + hash(i + 50) * 48); x.rotate(hash(i + 9) * 3); x.fillRect(-4, -2, 8, 4); x.restore(); }
  // bunting + wall balloons
  x.strokeStyle = '#e6c58c'; x.lineWidth = 3; x.beginPath(); x.moveTo(-OX, 70); x.quadraticCurveTo(W / 2, 128, W + OX, 70); x.stroke();
  for (let i = 0; i < 16; i++) { const f = i / 15, bx = -OX + f * VW, by = 70 + Math.sin(f * Math.PI) * 44 * 1.0 + 4; x.beginPath(); x.moveTo(bx - 14, by); x.lineTo(bx + 14, by); x.lineTo(bx, by + 28); x.closePath(); ink(['#ff4d5e', '#4DB8FF', '#5CFF7A', '#c77dff'][i & 3], 2.5); }
  for (const [bx, by, c] of [[-OX + 40, 250, '#4DB8FF'], [-OX + 90, 300, '#c77dff'], [W + OX - 50, 240, '#5CFF7A'], [W + OX - 100, 300, '#ff9a3c']]) { x.strokeStyle = 'rgba(20,16,28,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(bx, by + 30); x.quadraticCurveTo(bx + 8, by + 90, bx - 4, by + 170); x.stroke(); x.beginPath(); x.ellipse(bx, by, 24, 29, 0, 0, 7); ink(c, 3.5); x.fillStyle = 'rgba(255,255,255,.5)'; el(bx - 8, by - 10, 5, 8, -.5); x.fill(); }
  // cake table (far right)
  rr(W + OX - 150, 470, 120, 12, 4); ink('#d9944f', 4); x.fillStyle = INK; x.fillRect(W + OX - 134, 482, 8, 56); x.fillRect(W + OX - 54, 482, 8, 56);
  rr(W + OX - 132, 436, 84, 34, 8); ink('#fff4e0', 3.5); rr(W + OX - 132, 436, 84, 12, 6); ink('#ff7aa8', 3); for (let i = 0; i < 3; i++) { rr(W + OX - 112 + i * 26, 414, 6, 22, 2); ink('#4DB8FF', 2); x.beginPath(); x.ellipse(W + OX - 109 + i * 26, 408, 3.5, 6, 0, 0, 7); ink('#ffb347', 1.5); }
});
function wiiPop(sp) {
  const n = 9 + Math.floor(sp * 1.4), inc = 1 / n;
  let s = 0, up = true, hy = 0, pop = 0, wob = 0;
  const push = e => { if (g.result || !up || (e && e.repeat)) return; up = false; s = Math.min(1, s + inc); wob = .25; snd(220 + s * 700, .09, 'triangle', .08, 0, 260 + s * 800); noise(.06, .03, 1500, 3000, 'highpass'); burst(430, 395, '#fff', 3, 120); if (s >= 1) { g.result = 'win'; pop = .001; sfx.stamp(); sfx.pop(); sfx.sparkle(); shake(14, .35); ring(520, 300, '#FF4D6D', 200, .5); burst(520, 300, '#FF4D6D', 22, 380); confetti(400, 250, 60); } };
  const pull = () => { up = true; };
  const g = {
    wide: true, cmd: 'POP IT!', hint: 'PUMP: PRESS AND RELEASE SPACE / CLICK', thint: 'TAP TAP TAP TO PUMP', dur: 5.8,
    key(e) { if (e.code === 'Space') push(e); }, keyup(e) { if (e.code === 'Space') pull(); }, down() { push(); }, up() { pull(); },
    update(dt) {
      wob = Math.max(0, wob - dt); hy += ((up ? 0 : 1) - hy) * Math.min(1, 22 * dt);
      if (pop) pop += dt; else if (s > 0) s = Math.max(0, s - .05 * dt);
    },
    draw(tt) {
      const o = oT(), win = g.result === 'win', lose = g.result === 'lose', ss = win ? 1 : s;
      POP_BG();
      const r = win ? 0 : 40 + s * 120 + Math.sin(tt * 40) * wob * 14, bx = 520, by = 420 - r - 18;
      // puppy with a party hat: covers its ears as the balloon swells, bolts up on the bang
      const px = W + OX - 70, jump = win ? Math.min(1, o * 3) * -120 + Math.min(1, o * 3) * Math.min(1, o * 3) * 120 * (o > .3 ? 1 : 0) : 0, pup = ss > .55 ? 1 : 0;
      ctx.save(); ctx.translate(px, 538 + (win ? -Math.abs(Math.sin(Math.min(o, .5) * 6.3)) * 90 : 0));
      K.shade(0, 2, 40, 8, .3); rr(-26, -48, 52, 50, 22); ink('#fff4e0', 4); el(0, -62, 28, 25); ink('#fff4e0', 4);
      for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * 24, -72 + (pup ? 20 : 0)); ctx.rotate(sx * (pup ? 1.2 : .3)); rr(-8, -4, 16, 34, 8); ink('#e0a46a', 3.5); ctx.restore(); }
      for (const sx of [-1, 1]) K.eye(sx * 11, -64, 6, win ? 'bonk' : lose ? 'happy' : pup ? 'sleep' : 'idle', [-1, .2], tt, sx);
      ctx.fillStyle = INK; el(0, -54, 6, 4.5); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -50, 6, .3, Math.PI - .3); ctx.stroke();
      if (pup) { ctx.save(); ctx.translate(0, 0); for (const sx of [-1, 1]) { rr(sx * 26 - 7, -72, 14, 16, 7); ink('#fff4e0', 3); } ctx.restore(); }
      K.hat('party', 0, -85, 8, '#ff5c8a', '#ffe14d'); ctx.restore();
      // pump (bike-pump style): cylinder, handle, gauge
      const hh = 388 + hy * 70; K.shade(290, 546, 40, 8, .25);
      ctx.beginPath(); ctx.moveTo(312, 530); ctx.quadraticCurveTo(430, 556, 520, 424); ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#8f9cb3'; ctx.stroke(); ctx.lineCap = 'butt';
      rr(268, 462, 44, 78, 10); ink('#4DB8FF', 4.5); glint(null, 278, 490, 4, 22, .5, 0); ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.fillRect(298, 466, 10, 70);
      rr(286, hh, 8, 462 - hh + 6, 3); ink('#d3d8e2', 2.5); rr(250, hh - 10, 80, 18, 9); ink('#ff4d5e', 4); glint(null, 262, hh - 6, 12, 3, .55, 0);
      circ(290, 506, 15, '#fff', 3.5); ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(290, 506, 10, -.2, .7); ctx.stroke(); const na = Math.PI * .85 + ss * Math.PI * 1.3 - Math.PI * 1.05; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(290, 506); ctx.lineTo(290 + Math.cos(na - 1.1) * 11, 506 + Math.sin(na - 1.1) * 11); ctx.stroke();
      // Claude does the pumping
      const cX = 170, m = lose ? 'sad' : win ? 'dizzy' : ss > .75 ? 'panic' : ss > .35 ? 'worry' : 'eager', ay = hh + 5;
      K.shade(cX, 542, 50, 9, .3);
      ctx.beginPath(); ctx.moveTo(cX + 54, 498); ctx.lineTo((cX + 54 + 262) / 2 + 4, (498 + ay) / 2 - 6); ctx.lineTo(262, ay); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 17; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 9; ctx.strokeStyle = OR; ctx.stroke(); ctx.lineCap = 'butt';
      K.hero(cX, 540, 8, m, tt, { look: [1, -.4] }); rr(257, ay - 10, 18, 20, 5); ink('#fff', 3.5);
      K.tag(cX, 410);
      // the balloon
      if (!win) {
        const gg = Math.floor(120 * (1 - s)), col = `rgb(255,${60 + gg},${150 - s * 100 | 0})`, sh = `rgb(${215},${30 + gg * .6 | 0},${105 - s * 70 | 0})`;
        ctx.save(); ctx.translate(bx, by); ctx.scale(.9, 1.05);
        if (lose) ctx.scale(1, .88);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = sh; ctx.fill(); ctx.save(); ctx.clip(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-r * .14, -r * .12, r, 0, 7); ctx.fill(); ctx.restore();
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(bx - 9, by + r * 1.05 + 9); ctx.lineTo(bx + 9, by + r * 1.05 + 9); ctx.lineTo(bx, by + r * 1.05 - 3); ctx.closePath(); ink(sh, 3);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; el(bx - r * .38, by - r * .45, r * .12, r * .24, -.6); ctx.fill();
        if (s > .6) { ctx.strokeStyle = 'rgba(180,20,60,.5)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = .3 + i * .6; ctx.moveTo(bx + Math.cos(a) * r * .5, by + Math.sin(a) * r * .55); ctx.quadraticCurveTo(bx + Math.cos(a + .2) * r * .7, by + Math.sin(a) * r * .7, bx + Math.cos(a) * r * .86, by + Math.sin(a + .15) * r * .9); } ctx.stroke(); }
        const e = r * .3, big = s > .6; for (const sx of [-1, 1]) { circ(bx + sx * e, by - r * .08, r * (big ? .17 : .13), '#fff', 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx + sx * e - (sx > 0 ? 1 : -1) * 0, by - r * .08 + (lose ? r * .05 : 0), r * (big ? .05 : .06), 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx + sx * e - 12 * sx, by - r * .28 - (lose ? 0 : s * 6)); ctx.lineTo(bx + sx * e + 12 * sx, by - r * (lose ? .2 : .32 + s * .06)); ctx.stroke(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); if (lose) ctx.arc(bx, by + r * .38, r * .14, Math.PI * 1.1, Math.PI * 1.9); else { ctx.ellipse(bx, by + r * .3, r * .11, r * (.05 + s * .12), 0, 0, 7); } ctx.stroke(); ctx.lineCap = 'butt';
        if (s > .6) K.sweat(bx + r * .75, by - r * .4, 1.1, tt);
        if (lose) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(bx + r * .95 + i * 12, by + 6 + (i - 1) * 14); ctx.lineTo(bx + r * .95 + 20 + i * 12, by + 6 + (i - 1) * 14); ctx.stroke(); } ctx.lineCap = 'butt'; }
      } else {
        const k = Math.min(1, o * 3);
        K.star(bx, by + 40, 120 + k * 80, 50 + k * 30, 12, tt, '#fff', 5); ctx.save(); ctx.globalAlpha = Math.max(0, 1 - o * 1.4);
        for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28, d = 60 + k * 190, cc = ['#ff4d5e', '#FFE14D', '#4DB8FF', '#5CFF7A', '#c77dff'][i % 5]; ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * 40, by + 40 + Math.sin(a) * 40); ctx.quadraticCurveTo(bx + Math.cos(a + .5) * d * .7, by + 40 + Math.sin(a + .5) * d * .7, bx + Math.cos(a) * d, by + 40 + Math.sin(a) * d + k * 30); ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = cc; ctx.stroke(); }
        ctx.restore(); K.badge('BANG!', bx, by + 40 - 6, 56, '#ff4d6e', '#fff', K.outBack(o / .2), -.08);
        for (let i = 0; i < 5; i++) { const a = i * 1.3 + 1, d = 40 + o * 260; ctx.save(); ctx.translate(bx + Math.cos(a) * d, by + 40 + Math.sin(a) * d + o * o * 160); ctx.rotate(a + o * 5); ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(10, -2); ctx.lineTo(4, 8); ctx.closePath(); ink('#ff4d6e', 2.5); ctx.restore(); }
      }
      if (win && o > .12) { for (let i = 0; i < 3; i++) { const a = tt * 5 + i * 2.1; K.star(cX + Math.cos(a) * 36, 458 + Math.sin(a) * 8, 8, 3.5, 5, tt * 4, '#FFE14D', 2.5); } }
      vignette(.14);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 7 ── STRIKE!: a samurai Claude slices a falling coin in a dojo, judged by a sensei cat; only inside the sunbeam */
const STR_BG = K.layer(x => {
  x.fillStyle = grad(0, 500, [[0, '#f8ecd0'], [1, '#efdcb4']]); x.fillRect(-OX, 0, VW, 502);
  // shoji screens: paper panels with a wooden lattice
  x.strokeStyle = '#a5622c'; x.lineWidth = 6; x.beginPath(); for (let c = -OX - 50; c < W + OX; c += 100) { x.moveTo(c, 50); x.lineTo(c, 500); } for (const yy of [50, 170, 290, 410]) { x.moveTo(-OX, yy); x.lineTo(W + OX, yy); } x.stroke();
  x.strokeStyle = 'rgba(165,98,44,.5)'; x.lineWidth = 2; x.beginPath(); for (let c = -OX - 50; c < W + OX; c += 100) { for (const f of [.33, .66]) { x.moveTo(c + 100 * f, 50); x.lineTo(c + 100 * f, 500); } } x.stroke();
  x.fillStyle = 'rgba(255,255,255,.35)'; for (let c = -OX - 50; c < W + OX; c += 100) { x.fillRect(c + 8, 60, 14, 100); x.fillRect(c + 8, 180, 14, 100); }
  x.fillStyle = INK; x.fillRect(-OX, 44, VW, 14); x.fillStyle = '#6b3d1f'; x.fillRect(-OX, 48, VW, 8);
  // hanging scroll with an ink-brush circle (no words)
  x.strokeStyle = '#d9a441'; x.lineWidth = 3; x.beginPath(); x.moveTo(400, 58); x.lineTo(400, 82); x.stroke(); rr(350, 82, 100, 150, 4); ink('#f7e6b8', 4); x.strokeStyle = INK; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.arc(400, 156, 28, .6, 6); x.stroke(); rr(344, 226, 112, 10, 5); ink('#a5622c', 3);
  // tatami floor
  x.fillStyle = INK; x.fillRect(-OX, 498, VW, 4); x.fillStyle = grad(502, 600, [[0, '#d8c47a'], [1, '#b89c4e']]); x.fillRect(-OX, 502, VW, 100);
  x.strokeStyle = 'rgba(20,16,28,.7)'; x.lineWidth = 4; x.beginPath(); for (let c = -OX - 20; c < W + OX; c += 100) { x.moveTo(c + 4, 502); x.lineTo(c - 40, 600); } x.moveTo(-OX, 548); x.lineTo(W + OX, 548); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 30; i++) { const lx = -OX + hash(i) * VW, ly = 506 + hash(i + 40) * 90; x.moveTo(lx, ly); x.lineTo(lx + 18, ly); } x.stroke();
  // pillars
  for (const px of [110, 690]) { rr(px - 18, 54, 36, 446, 6); ink('#e8432f', 5); x.fillStyle = '#b3281c'; x.fillRect(px + 8, 58, 8, 440); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(px - 12, 58, 5, 440); rr(px - 24, 480, 48, 20, 4); ink('#8a5a34', 3.5); rr(px - 24, 54, 48, 14, 4); ink('#8a5a34', 3.5); }
});
function wiiStrike(sp) {
  const GY = 380, band = 52, v = 150 * sp, cx = 250 + Math.random() * 300, ph = Math.random() * 6;
  const T = { x: cx, y: -40 }, trail = []; let t = 0, hit = 0, slash = null, warn = 0, hitDir = 0;
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
      if (hit) { hit += dt; return; }
      if (g.result) return;
      if (t > .3) T.y += v * dt;
      T.x = cx + Math.sin(t * 2 + ph) * 25;
      if (T.y > 570) { g.result = 'lose'; sfx.thud(); sfx.miss(); shake(8, .25); burst(T.x, 560, '#FF4D6D', 10); }
    },
    draw(tt) {
      const o = oT(), win = g.result === 'win', lose = g.result === 'lose', inB = Math.abs(T.y - GY) <= band;
      STR_BG();
      // the sunbeam through the paper wall = the strike band
      const gl = .55 + Math.sin(tt * 8) * .2;
      ctx.fillStyle = `rgba(255,225,77,${gl * .5})`; ctx.fillRect(-OX, GY - band, VW, band * 2);
      ctx.fillStyle = INK; ctx.fillRect(-OX, GY - band - 3, VW, 6); ctx.fillRect(-OX, GY + band - 3, VW, 6);
      ctx.fillStyle = '#FFE14D'; ctx.fillRect(-OX, GY - band, VW, 4); ctx.fillRect(-OX, GY + band - 4, VW, 4);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 9; i++) { const mx = -OX + ((tt * 14 + i * 97) % VW), my = GY - band + 10 + hash(i) * (band * 2 - 20); ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, 7); ctx.fill(); }
      // paper lanterns swaying
      for (const lx of [250, 550]) { const sw = Math.sin(tt * 1.6 + lx) * .08; ctx.save(); ctx.translate(lx, 58); ctx.rotate(sw); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.stroke(); el(0, 62, 26, 32); ink('#ff5a4a', 4); ctx.strokeStyle = 'rgba(20,16,28,.55)'; ctx.lineWidth = 2.5; for (const dy of [-14, 0, 14]) { ctx.beginPath(); ctx.ellipse(0, 62 + dy, 26 * Math.sqrt(1 - (dy / 32) ** 2), 4, 0, 0, 7); ctx.stroke(); } glint(null, -9, 50, 5, 9, .5, -.3); rr(-8, 91, 16, 8, 3); ink('#ffd23f', 2); ctx.restore(); }
      // sensei cat on a cushion (right)
      const sx = W + OX - 70, wob = Math.sin(tt * 2) * 2, cl = [clamp((T.x - sx) / 300, -1, 1), clamp((T.y - 440) / 200, -1, 1)];
      K.shade(sx, 508, 60, 10, .3); el(sx, 502, 52, 14); ink('#9b6bd1', 4); glint(null, sx - 20, 497, 12, 3.5, .45, 0);
      ctx.beginPath(); ctx.moveTo(sx - 36, 498); ctx.quadraticCurveTo(sx - 76, 490 + Math.sin(tt * 3) * 10, sx - 60, 450); ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = '#ffb347'; ctx.stroke(); ctx.lineCap = 'butt';
      const cb = pRR(sx - 36, 430, 72, 70, 30); K.cel(cb, '#ffab4d', '#d98a2a', 7, 6, 4.5); rr(sx - 18, 450, 36, 46, 16); ink('#fff4e0', 3);
      const hy = 410 + wob; ctx.beginPath(); ctx.moveTo(sx - 36, hy - 8); ctx.lineTo(sx - 28, hy - 44); ctx.lineTo(sx - 8, hy - 20); ctx.moveTo(sx + 36, hy - 8); ctx.lineTo(sx + 28, hy - 44); ctx.lineTo(sx + 8, hy - 20); ctx.fillStyle = '#ffab4d'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      const ch = pEl(sx, hy, 40, 34); K.cel(ch, '#ffab4d', '#d98a2a', 6, 5, 4.5); K.glint(ch, sx - 14, hy - 14, 10, 4, .45, -.4);
      for (const s2 of [-1, 1]) K.eye(sx + s2 * 15, hy - 4, 9, win ? 'happy' : lose ? 'sleep' : inB ? 'panic' : 'idle', cl, tt, s2);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx - 24, hy - 18); ctx.lineTo(sx - 8, hy - 14); ctx.moveTo(sx + 24, hy - 18); ctx.lineTo(sx + 8, hy - 14); ctx.stroke(); ctx.fillStyle = '#ff6f91'; ctx.beginPath(); ctx.moveTo(sx - 4, hy + 6); ctx.lineTo(sx + 4, hy + 6); ctx.lineTo(sx, hy + 11); ctx.fill(); ctx.beginPath(); ctx.arc(sx, hy + 12, 6, .2, Math.PI - .2); ctx.stroke(); ctx.lineWidth = 2.5; ctx.beginPath(); for (const s2 of [-1, 1]) for (const d of [-3, 3]) { ctx.moveTo(sx + s2 * 18, hy + 8 + d); ctx.lineTo(sx + s2 * 36, hy + 6 + d * 2); } ctx.stroke(); ctx.lineCap = 'butt';
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, hy - 2, 36, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      if (win && o > .1) { const k = Math.min(1, (o - .1) * 5); ctx.save(); ctx.translate(sx - 70, 460 - k * 30); rr(-22, -16, 44, 32, 5); ink('#fff4e0', 3.5); K.star(0, 0, 11, 5, 5, tt * 2, '#FFE14D', 2.5); ctx.restore(); }
      if (lose) { ctx.fillStyle = '#ffd3a5'; rr(sx - 24, hy - 12, 48, 16, 8); ink('#ffab4d', 3); }
      // the coin (or its two halves)
      if (!hit) { K.shade(T.x, 520, 30 - Math.min(14, (520 - T.y) / 30), 6, .2); token(T.x, T.y, 34); }
      else {
        const k = Math.min(1, hit * 3), ca = Math.cos(hitDir), sa = Math.sin(hitDir);
        for (const sg of [-1, 1]) {
          ctx.save(); ctx.translate(T.x - sa * sg * k * 40, T.y + ca * sg * k * 40 + hit * hit * 200); ctx.rotate(hitDir); ctx.beginPath(); ctx.rect(-60, sg < 0 ? -60 : 0, 120, 60); ctx.clip(); ctx.rotate(-hitDir); ctx.translate(0, 0); token(0, 0, 34); ctx.restore();
        }
        if (slash && hit < .35) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 12 * (1 - hit * 2.5); ctx.lineCap = 'round'; ctx.beginPath(); const a = slash[0], b = slash[slash.length - 1]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; ctx.moveTo(T.x - dx / l * 140, T.y - dy / l * 140); ctx.lineTo(T.x + dx / l * 140, T.y + dy / l * 140); ctx.stroke(); ctx.lineCap = 'butt'; }
      }
      if (trail.length > 1 && !g.result) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); trail.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.lineCap = 'butt'; }
      // samurai Claude with a katana
      const cX = 110, cY = 508, mood = lose ? 'sad' : win ? 'happy' : inB ? 'panic' : Math.abs(T.y - GY) <= band + 40 ? 'eager' : 'idle';
      K.shade(cX, 510, 40, 8, .3);
      const sw = win ? clamp(o * 5, 0, 1) : 0; ctx.save(); ctx.translate(cX + 38, cY - 36); ctx.rotate(-.9 + sw * 1.7); rr(-3, -70, 6, 76, 3); ink('#e9eefc', 2.5); rr(-6, 0, 12, 8, 2); ink('#d9a441', 2.5); rr(-3, 6, 6, 24, 3); ink('#5a3b22', 2.5); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-1, -64, 2, 60); ctx.restore();
      K.hero(cX, cY, 7, mood, tt, { arms: [.2, -.1 + sw * .3, .8], look: [1, -.3] }); K.hat('band', cX, cY - 63, 7, '#fff');
      if (warn > 0) K.badge(T.y < GY ? 'TOO EARLY!' : 'TOO LATE!', W / 2, 120, 44, '#ff4d6d', '#fff', 1, -.05);
      else if (!g.result && !inB && Math.abs(T.y - GY) <= band + 40) K.badge('NOW...', W / 2, 120, 38, '#4DB8FF', '#fff', 1, -.03);
      if (!g.result && inB) K.badge('NOW!', W / 2, 120, 52, '#ff2e4d', '#fff', 1 + Math.sin(tt * 20) * .04, -.03);
      vignette(.16);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 8 ── SHAVE!: a bathroom at 7 a.m.; clear Dad's stubble with foam, dodge the angry mole */
const SHV_BG = K.layer(x => {
  x.fillStyle = '#8EE3EF'; x.fillRect(-OX, 0, VW, 524);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3; x.beginPath(); for (let c = -OX; c < W + OX; c += 60) { x.moveTo(c, 0); x.lineTo(c, 524); } for (let y = 0; y < 524; y += 60) { x.moveTo(-OX, y); x.lineTo(W + OX, y); } x.stroke();
  x.fillStyle = 'rgba(255,255,255,.14)'; for (let c = -OX; c < W + OX; c += 120) for (let y = 0; y < 524; y += 120) x.fillRect(c + 6, y + 6, 22, 8);
  // window with a sunrise (right) and rubber duck
  const wx = W + OX - 140; rr(wx, 110, 110, 150, 10); ink('#fff4e0', 5); rr(wx + 8, 118, 94, 134, 6); ink('#ffd86b', 3); x.fillStyle = grad(118, 252, [[0, '#ffb36a'], [1, '#ffe9a0']]); x.fillRect(wx + 10, 120, 90, 130); x.beginPath(); x.arc(wx + 55, 250, 34, Math.PI, 0); x.fillStyle = '#ffe14d'; x.fill(); x.strokeStyle = '#fff4e0'; x.lineWidth = 4; x.beginPath(); x.moveTo(wx + 55, 118); x.lineTo(wx + 55, 252); x.moveTo(wx + 8, 185); x.lineTo(wx + 102, 185); x.stroke(); rr(wx - 6, 258, 122, 12, 5); ink('#fff4e0', 3.5);
  // shelf with a toothbrush cup (left)
  rr(-OX + 14, 190, 130, 12, 5); ink('#d9944f', 4); rr(-OX + 30, 150, 34, 40, 6); ink('#9fe3ff', 3.5); for (const [dx, c] of [[-8, '#ff5c8a'], [4, '#4DB8FF'], [14, '#5CFF7A']]) { x.strokeStyle = INK; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(-OX + 47 + dx, 156); x.lineTo(-OX + 47 + dx * 1.6, 128); x.stroke(); x.strokeStyle = c; x.lineWidth = 4; x.stroke(); }
  rr(-OX + 82, 168, 44, 22, 8); ink('#fff', 3.5); x.fillStyle = 'rgba(77,184,255,.5)'; x.fillRect(-OX + 90, 172, 28, 5);
  // sink counter
  x.fillStyle = INK; x.fillRect(-OX, 520, VW, 90); x.fillStyle = grad(524, 600, [[0, '#e9f3fb'], [1, '#bcd0e4']]); x.fillRect(-OX, 524, VW, 90); x.fillStyle = '#fff'; x.fillRect(-OX, 524, VW, 6);
  rr(W + OX - 150, 486, 56, 38, 8); ink('#ff5c8a', 4); rr(W + OX - 144, 470, 44, 20, 6); ink('#e8eef6', 3.5); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(W + OX - 138, 490, 6, 28);
});
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
  const need = cells.filter(c => !c.skip).length; let lx = null, ly = 0, cut = 0, mx = W / 2, my = H / 2, cleared = 0, lastC = 0, moved = false;
  const clearAt = (x, y) => { for (const c of cells) if (!c.f && Math.abs(c.x - x) < RR + 4 && Math.abs(c.y - y) < RR + 4 && Math.hypot(c.x - x, c.y - y) < RR) c.f = .8; };
  const g = {
    wide: true, cmd: 'SHAVE!', hint: 'MOUSE OVER THE STUBBLE · AVOID THE MOLE', thint: 'DRAG OVER STUBBLE, AVOID MOLE', dur: hard ? 6 : 6.5,
    update(dt) {
      for (const c of cells) if (c.f > 0) c.f = Math.max(.001, c.f - dt * .6);
      cut = Math.max(0, cut - dt);
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
      const o = oT(), win = g.result === 'win', lose = g.result === 'lose'; if (mouse.x !== W / 2 || mouse.y !== H / 2) moved = true;
      const px = moved ? mouse.x : mx, py = moved ? mouse.y : my, near = moles.some(m => Math.hypot(m.x - px, m.y - py) < 75);
      SHV_BG();
      // Dad's head: hair, ears, cel-shaded face
      K.shade(400, 520, 190, 18, .25);
      for (const sx of [-1, 1]) { el(400 + sx * 186, 290, 24, 38); ink('#f0ac7d', 4.5); el(400 + sx * 186, 292, 11, 20); ink('#d98c5c', 2); }
      for (const [hx2, hy2, r] of [[260, 120, 36], [330, 96, 42], [400, 90, 44], [470, 96, 42], [540, 120, 36]]) { ctx.beginPath(); ctx.arc(hx2, hy2, r, 0, 7); ink('#6a3d22', 4.5); }
      const face = pRR(220, 110, 360, 400, 80); K.cel(face, '#FFD3A5', '#f0ac7d', -14, 0, 6); K.glint(face, 270, 150, 44, 12, .5, -.2);
      ctx.fillStyle = 'rgba(255,110,140,.4)'; for (const sx of [-1, 1]) { el(400 + sx * 120, 270, 26, 15); ctx.fill(); }
      const lk = [clamp((px - 400) / 160, -1, 1), clamp((py - 205) / 160, -1, 1)], em = lose ? 'panic' : win ? 'happy' : near ? 'panic' : 'idle';
      for (const ex of [330, 470]) K.eye(ex, 205, 26, em, lk, tt, ex > 400 ? 1 : 0);
      ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); const bw = near || lose ? -14 : 0; ctx.moveTo(296, 168 + bw * .2); ctx.quadraticCurveTo(330, 150 + bw, 366, 162 + bw * .5); ctx.moveTo(434, 162 + bw * .5); ctx.quadraticCurveTo(470, 150 + bw, 504, 168 + bw * .2); ctx.stroke();
      const nose = pEl(400, 262, 26, 30); K.cel(nose, '#f5b88a', '#d98c5c', 5, 4, 4.5); K.glint(nose, 392, 252, 6, 9, .5, -.3);
      // stubble (batched) and foam
      ctx.strokeStyle = '#3a2a26'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); let done = 0, foam = false;
      for (const c of cells) { if (c.skip) continue; if (!c.f) { ctx.moveTo(c.x - 4, c.y - 4); ctx.lineTo(c.x - 5, c.y + 4); ctx.moveTo(c.x + 3, c.y - 2); ctx.lineTo(c.x + 4, c.y + 6); } else { done++; if (c.f > .3) foam = true; } } ctx.stroke();
      if (foam) { ctx.fillStyle = '#fff'; ctx.beginPath(); for (const c of cells) if (!c.skip && c.f > .3) { ctx.moveTo(c.x + 10, c.y); ctx.arc(c.x, c.y, 10, 0, 7); } ctx.fill(); }
      ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.beginPath(); if (lose) { el(400, 440, 34, 26); ink('#7a1f2e', 4); ctx.fillStyle = '#ff7aa8'; el(400, 452, 22, 10); ctx.fill(); } else if (win) { ctx.arc(400, 410, 54, .15, Math.PI - .15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(350, 428); ctx.lineTo(450, 428); ctx.lineWidth = 1; ctx.stroke(); } else if (near) { ctx.moveTo(366, 440); for (let i = 1; i <= 7; i++) ctx.lineTo(366 + i * 10, 440 + (i % 2 ? -5 : 5)); ctx.stroke(); } else { ctx.arc(400, 420, 40, .2, Math.PI - .2); ctx.stroke(); } ctx.lineCap = 'butt';
      if (win && o > .1) { K.sparkle(310, 380, 36, tt, 4); K.sparkle(490, 380, 36, tt + 1, 4); for (let i = 0; i < 3; i++) K.heart(260 + i * 140, 130 - ((o - .1) * 60) % 60, .8, 1 - (o - .1)); }
      // angry moles
      for (const m of moles) { ctx.save(); ctx.translate(m.x, m.y); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); for (const a of [-.6, 0, .6]) { ctx.moveTo(Math.sin(a) * 8, -10); ctx.lineTo(Math.sin(a) * 16, -22 + Math.abs(a) * 4); } ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ink('#8a3a3a', 4); glint(null, -5, -6, 5, 3, .5, -.5); for (const s2 of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s2 * 5.5, -2, 3.6, 0, 7); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s2 * 5.5 + lk[0] * 1.5, -2, 1.8, 0, 7); ctx.fill(); } ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10, -9); ctx.lineTo(-2, -5); ctx.moveTo(10, -9); ctx.lineTo(2, -5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(0, 5); ctx.lineTo(5, 8); ctx.stroke(); ctx.restore(); K.badge('!', m.x, m.y - 40 + Math.sin(tt * 8) * 3, 22, '#FFE14D', '#ff4d6d', 1, 0); }
      // barber Claude (left) watches the razor
      const cX = -OX + 90 < 70 ? 70 : 90, mood = lose ? 'panic' : win ? 'happy' : near ? 'worry' : 'eager';
      K.shade(cX, 530, 36, 8, .3); K.hero(cX, 528, 5, mood, tt, { arms: [.4, -.2, .8], look: [clamp((px - cX) / 300, -1, 1), clamp((py - 480) / 200, -1, 1)] }); rr(cX - 30, 505, 60, 16, 5); ink('#fff', 3); K.tag(cX, 464);
      // razor
      if (moved || lose) { K.shade(px + 10, py + 8, 22, 6, .2); ctx.save(); ctx.translate(px, py); ctx.rotate(-.6); rr(-5, -78, 11, 62, 5); ink('#4DB8FF', 3.5); glint(null, -2, -60, 2.5, 14, .55, 0); rr(-22, -18, 48, 20, 5); ink('#e3e8f2', 3.5); ctx.fillStyle = 'rgba(20,16,28,.4)'; ctx.fillRect(-16, -4, 36, 3); glint(null, -10, -13, 10, 2.5, .8, 0); ctx.restore(); }
      if (cut > 0) { K.star(px, py, 50, 20, 8, tt * 3, '#FF4D6D', 4); K.badge('OUCH!', W / 2, 76, 48, '#ff4d6d', '#fff', K.outBack((1 - cut) / .25), -.05); }
      // foam-can progress pill
      const pf = Math.min(1, done / need / .9); rr(530, 520, 220, 20, 10); ink('#fff', 3.5); ctx.save(); rr(530, 520, 220, 20, 10); ctx.clip(); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(530, 520, 220 * pf, 20); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(534, 523, 212 * pf, 5); ctx.restore(); K.star(750, 530, 13, 6, 5, tt, pf >= 1 ? '#FFE14D' : '#fff', 3);
      vignette(.14);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 9 ── FAN IT!: keep a butterfly above a hungry frog's pond with a paper fan */
const FAN_BG = K.layer(x => {
  x.fillStyle = grad(0, 500, [[0, '#4cc0f0'], [.55, '#9fe3ff'], [1, '#e6fbff']]); x.fillRect(-OX, 0, VW, 520);
  // far hills (coloured outline), trees, bank
  x.fillStyle = '#a9dfc6'; x.beginPath(); x.moveTo(-OX, 420); for (let c = -OX; c < W + OX + 200; c += 200) x.quadraticCurveTo(c + 100, 330, c + 200, 420); x.lineTo(W + OX, 520); x.lineTo(-OX, 520); x.closePath(); x.fill();
  x.fillStyle = '#87d19b'; x.beginPath(); x.moveTo(-OX, 470); for (let c = -OX - 60; c < W + OX + 160; c += 160) x.quadraticCurveTo(c + 80, 390, c + 160, 470); x.lineTo(W + OX, 520); x.lineTo(-OX, 520); x.closePath(); x.fill(); x.strokeStyle = '#4f9a6a'; x.lineWidth = 4; x.stroke();
  for (const tx of [150, 330, 560, 720]) { x.fillStyle = INK; x.fillRect(tx - 5, 420, 10, 50); x.beginPath(); x.arc(tx, 400, 30, 0, 7); ink('#3fb260', 4); x.fillStyle = 'rgba(255,255,255,.28)'; el(tx - 10, 390, 9, 5, -.5); x.fill(); }
  // flower bed along the bank
  x.fillStyle = INK; x.fillRect(-OX, 506, VW, 4); x.fillStyle = grad(510, 524, [[0, '#8fdc5c'], [1, '#5fb944']]); x.fillRect(-OX, 510, VW, 14);
  for (let i = -Math.ceil(OX / 90); i < 9 + Math.ceil(OX / 90); i++) { const px = 40 + i * 90, h = 24 + (Math.abs(i * 37) % 30); x.fillStyle = INK; x.fillRect(px - 3, 508 - h, 6, h); x.beginPath(); x.arc(px, 506 - h, 13, 0, 7); ink(['#FF8FAB', '#FFE14D', '#C77DFF'][(i % 3 + 3) % 3], 3.5); x.fillStyle = '#fff'; x.beginPath(); x.arc(px, 506 - h, 4.5, 0, 7); x.fill(); }
  // pond
  x.fillStyle = grad(524, 600, [[0, '#62d3f0'], [1, '#2a8fcb']]); x.fillRect(-OX, 524, VW, 80); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(-OX, 524, VW, 4);
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; x.lineCap = 'round'; for (let i = 0; i < 16; i++) { const wx = -OX + hash(i) * VW, wy = 540 + hash(i + 20) * 50; x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 14, wy - 5, wx + 28, wy); x.stroke(); }
  for (const [lx, ly] of [[150, 556], [330, 586], [610, 566], [W + OX - 60, 590]]) { x.beginPath(); x.ellipse(lx, ly, 34, 9, 0, .35, 6); x.lineTo(lx, ly); x.closePath(); ink('#5bcf72', 3); x.fillStyle = 'rgba(255,255,255,.3)'; el(lx - 10, ly - 3, 10, 2.5); x.fill(); }
  // rock for Claude + cattails
  const rx = -OX + 60; x.beginPath(); x.ellipse(rx, 526, 56, 20, 0, 0, 7); ink('#b9bfcc', 4); x.fillStyle = 'rgba(255,255,255,.4)'; el(rx - 18, 520, 16, 5, -.1); x.fill();
  for (const cx of [W + OX - 30, W + OX - 52]) { x.strokeStyle = INK; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, 560); x.quadraticCurveTo(cx - 6, 500, cx - 2, 440); x.stroke(); x.strokeStyle = '#3fb260'; x.lineWidth = 3; x.stroke(); rr(cx - 8, 430, 14, 36, 7); ink('#8a5a34', 3); }
});
function wiiFan(sp) {
  const grav = 320 * Math.pow(sp, .6), B = { x: 300 + Math.random() * 200, y: 250, vx: 0, vy: 0 }; let lx = mouse.x, ly = mouse.y, spd = 0, wind = 0, t = 0, lw = 0, ph = Math.random() * 6, fxp = B.x, moved = false;
  const g = {
    wide: true, cmd: 'FAN IT!', hint: 'WAVE THE MOUSE BELOW THE BUTTERFLY', thint: 'WAVE YOUR FINGER BELOW IT', dur: 5.2, timeWin: true,
    update(dt) {
      t += dt; fxp += (B.x - fxp) * Math.min(1, 3 * dt);
      const sx = (Math.abs(mouse.x - lx) + Math.abs(mouse.y - ly) * .5) / Math.max(dt, .001); lx = mouse.x; ly = mouse.y;
      spd += (Math.min(2500, sx) - spd) * Math.min(1, 12 * dt);
      if (g.result) return;
      const dx = mouse.x - B.x, near = Math.abs(dx) < 160 && mouse.y > B.y - 20 && mouse.y < B.y + 270;
      wind = near ? Math.min(1, spd / 1300) : 0;
      B.vy += (grav - wind * 1700) * dt; B.vx += (-dx * (near ? .4 : 0) * wind * .02 * 60 + Math.sin(t * 1.7 + ph) * 60) * dt;
      B.vy = Math.max(-380, Math.min(440, B.vy)); B.vx *= Math.pow(.3, dt);
      B.x += B.vx * dt; B.y += B.vy * dt; B.x = Math.max(60 - OX, Math.min(740 + OX, B.x));
      if (B.y < 80) { B.y = 80; B.vy = Math.abs(B.vy) * .3; }
      if (B.y > 515) { g.result = 'lose'; sfx.splat(); shake(7, .25); burst(B.x, 520, '#FF8FAB', 12); }
      if (wind > .35 && t - lw > .25) { lw = t; sfx.whoosh(true); }
    },
    draw(tt) {
      const o = oT(), dead = g.result === 'lose', win = g.result === 'win'; if (mouse.x !== lx0 || mouse.y !== ly0) moved = true;
      FAN_BG();
      // the frog tracks the butterfly from the pond
      const low = clamp((B.y - 330) / 185, 0, 1), fx = clamp(dead ? B.x : fxp, 70, 730), fy = 566 - low * 30 - (dead ? Math.min(1, o * 6) * 36 : 0), open = low > .45 || dead;
      ctx.save(); ctx.translate(fx, fy);
      K.shade(0, 20, 54, 9, .22); const fb = pEl(0, 0, 50, 36); K.cel(fb, '#6fd660', '#3fa64a', 7, 6, 5); K.glint(fb, -18, -16, 14, 5, .4, -.4);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; el(0, 14, 28, 14); ctx.fill();
      for (const s2 of [-1, 1]) { el(s2 * 28, -30, 15, 15); ink('#6fd660', 4.5); el(s2 * 28, -30, 10, 11); ink('#fff', 2.5); const lk = [clamp((B.x - fx) / 200, -1, 1), clamp((B.y - fy) / 250, -1, 1)]; ctx.fillStyle = INK; el(s2 * 28 + lk[0] * 4, -30 + lk[1] * 4, 5, 6); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s2 * 28 + lk[0] * 4 - 1.5, -32 + lk[1] * 4, 1.7, 0, 7); ctx.fill(); }
      ctx.lineCap = 'round'; if (open) { el(0, -4, 26, 14 + (dead ? 4 : 0) * 1); ink('#7a1f2e', 3.5); ctx.fillStyle = '#ff7aa8'; el(0, 2, 16, 6); ctx.fill(); if (dead && o < .35) { ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(B.x - fx, B.y - fy); ctx.stroke(); ctx.strokeStyle = '#ff6f91'; ctx.lineWidth = 6; ctx.stroke(); } } else { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -8, 22, .25, Math.PI - .25); ctx.stroke(); }
      if (dead && o > .35) { ctx.save(); ctx.translate(14, -4); ctx.rotate(.5 + Math.sin(tt * 18) * .1); ctx.beginPath(); ctx.ellipse(10, -6, 16, 11, 0, 0, 7); ink('#FF8FAB', 3); ctx.restore(); K.heart(34 + Math.sin(tt * 3) * 6, -50 - ((o - .35) * 60), .7, 1 - (o - .35) * 1.2); }
      ctx.lineCap = 'butt'; ctx.restore();
      // Claude on the rock
      const cX = -OX + 62, cm = dead ? 'sad' : win ? 'happy' : B.y > 440 ? 'panic' : B.y > 360 ? 'worry' : 'eager';
      K.hero(cX, 520, 5, cm, tt, { arms: [.5, -.5 - (win ? .6 : 0), 1], look: [1, clamp((B.y - 400) / 120, -1, 1)] }); K.tag(cX, 448);
      // the butterfly
      if (!(dead && o > .15)) {
        const fl = Math.sin(tt * 22) * .8 + .2;
        K.shade(B.x, 520, Math.max(10, 30 - (520 - B.y) / 14), 5, dead ? 0 : .12);
        ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(dead ? 1.2 : B.vx / 400);
        for (const s of [-1, 1]) { ctx.save(); ctx.scale(s * (dead ? .3 : Math.abs(fl) * .9 + .25), 1); ctx.beginPath(); ctx.ellipse(32, -12, 34, 28, -.4, 0, 7); ink('#FF8FAB', 4); ctx.fillStyle = 'rgba(255,255,255,.45)'; el(26, -20, 10, 5, -.5); ctx.fill(); ctx.beginPath(); ctx.ellipse(34, 14, 19, 15, .3, 0, 7); ink('#FFE14D', 3.5); ctx.fillStyle = '#c77dff'; ctx.beginPath(); ctx.arc(30, -10, 5, 0, 7); ctx.fill(); ctx.restore(); }
        rr(-6, -22, 12, 46, 6); ink('#7b4fc4', 3.5); ctx.beginPath(); ctx.arc(0, -26, 9, 0, 7); ink('#7b4fc4', 3.5);
        for (const s of [-1, 1]) { ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s * 3, -33); ctx.quadraticCurveTo(s * 10, -46, s * 14, -44); ctx.stroke(); K.eye(s * 4, -27, 3.2, dead ? 'bonk' : low > .5 ? 'panic' : 'idle', [0, 1], tt, s); }
        if (low > .5 && !dead) K.sweat(14, -36, .8, tt); ctx.restore();
      }
      // the fan: a folding paper fan cursor
      if (moved) {
        const fx2 = mouse.x, fy2 = mouse.y; ctx.save(); ctx.translate(fx2, fy2); ctx.rotate(Math.sin(tt * 30) * wind * .6);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 62, -2.4, -.74); ctx.closePath(); ink('#FFE14D', 4); ctx.save(); ctx.clip(); ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 62, -2.4, -.74); ctx.arc(0, 0, 40, -.74, -2.4, true); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 62, -2.4, -2.05); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const a = -2.3 + i * .35; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); ctx.stroke(); }
        rr(-6, -4, 12, 30, 6); ink('#a5622c', 3); ctx.restore();
        if (wind > .1) { ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const y0 = fy2 - 70 - i * 30 - ((tt * 300) % 60); ctx.beginPath(); ctx.arc(fx2 + (i - 1) * 36, y0, 14, 0, 4.5); ctx.stroke(); } ctx.lineCap = 'butt'; }
      }
      if (win && o > .1) { for (let i = 0; i < 4; i++) K.heart(120 + i * 170, 120 - ((o * 70 + i * 20) % 50), .9, 1 - o * .6); }
      vignette(.14);
    }
  };
  const lx0 = lx, ly0 = ly;
  const oT = K.outro(g);
  return g;
}

/* 10 ── TWIRL!: a pizza chef spins the dough to the size of the pan; too fast tears it */
const TWL_BG = K.layer(x => {
  x.fillStyle = '#d9694c'; x.fillRect(-OX, 0, VW, 524);
  x.strokeStyle = 'rgba(80,20,20,.28)'; x.lineWidth = 2.5; x.beginPath(); for (let y = 36; y < 524; y += 36) { x.moveTo(-OX, y); x.lineTo(W + OX, y); for (let c = -OX - 90 + ((y / 36) & 1) * 45; c < W + OX; c += 90) { x.moveTo(c, y); x.lineTo(c, y - 36); } } x.stroke();
  x.fillStyle = 'rgba(255,255,255,.1)'; for (let i = -2; i < 14; i++) { x.beginPath(); x.moveTo(i * 90, 0); x.lineTo(i * 90 + 40, 0); x.lineTo(i * 90 - 100, 524); x.lineTo(i * 90 - 140, 524); x.fill(); }
  // brick oven (right) with an arch mouth
  const ox = W + OX - 190; x.beginPath(); x.moveTo(ox - 10, 524); x.lineTo(ox - 10, 380); x.quadraticCurveTo(ox + 90, 240, ox + 190, 380); x.lineTo(ox + 190, 524); x.closePath(); ink('#a8452e', 5); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(ox, 470); x.lineTo(ox, 380); x.quadraticCurveTo(ox + 40, 320, ox + 70, 300); x.lineTo(ox + 40, 470); x.fill();
  x.beginPath(); x.moveTo(ox + 36, 524); x.lineTo(ox + 36, 440); x.quadraticCurveTo(ox + 90, 370, ox + 144, 440); x.lineTo(ox + 144, 524); x.closePath(); ink('#2b1a1a', 4);
  rr(ox + 70, 250, 40, 34, 4); ink('#8a5a34', 4);
  // shelf with sauce cans (left, above Claude)
  rr(-OX + 20, 230, 200, 12, 5); ink('#d9944f', 4); for (let i = 0; i < 5; i++) { rr(-OX + 36 + i * 36, 188, 28, 42, 5); ink(['#ff4d5e', '#ffe14d', '#5CFF7A', '#ff4d5e', '#4DB8FF'][i], 3.5); x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(-OX + 41 + i * 36, 194, 5, 30); }
  // counter
  x.fillStyle = INK; x.fillRect(-OX, 518, VW, 90); x.fillStyle = grad(524, 600, [[0, '#d6a074'], [1, '#a8703a']]); x.fillRect(-OX, 524, VW, 90); x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(-OX, 524, VW, 6);
  x.strokeStyle = 'rgba(20,16,28,.3)'; x.lineWidth = 3; x.beginPath(); for (let c = -OX; c < W + OX; c += 120) { x.moveTo(c, 530); x.lineTo(c - 20, 600); } x.stroke();
  // the silver pan on the wall = the target
  x.beginPath(); x.arc(400, 330, 180, 0, 7); ink('#aab4c4', 6); x.beginPath(); x.arc(400, 330, 168, 0, 7); ink('#d8dfeb', 4); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(310, 230, 52, 14, -.7, 0, 7); x.fill();
  x.setLineDash([14, 10]); x.strokeStyle = 'rgba(20,16,28,.35)'; x.lineWidth = 4; x.beginPath(); x.arc(400, 330, 165 + 12, 0, 7); x.stroke(); x.setLineDash([]);
});
function wiiTwirl(sp) {
  const CX = 400, CY = 330, PR = 165; let r = 62, spin = 0, w = 0, la = null, ang = 0, crack = 0, t = 0, lw = 0, lc = 0; const fl = [];
  const g = {
    wide: true, cmd: 'TWIRL!', hint: 'MOUSE IN CIRCLES · NOT TOO FAST!', thint: 'DRAG IN CIRCLES, NOT TOO FAST', dur: 6.2,
    update(dt) {
      t += dt;
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
      const o = oT(), win = g.result === 'win', torn = g.result === 'lose', pf = clamp((r - 62) / (PR - 62), 0, 1), as = Math.abs(spin);
      TWL_BG();
      // oven fire
      const ox = W + OX - 190; ctx.save(); ctx.beginPath(); ctx.rect(ox + 36, 400, 108, 124); ctx.clip(); ctx.fillStyle = '#ff8a2c'; ctx.fillRect(ox + 36, 400, 108, 124); for (let i = 0; i < 4; i++) { const fx = ox + 56 + i * 24, fh = 40 + Math.sin(tt * 9 + i * 2) * 14; ctx.beginPath(); ctx.moveTo(fx - 14, 524); ctx.quadraticCurveTo(fx - 6, 524 - fh * .6, fx + Math.sin(tt * 7 + i) * 6, 524 - fh - 20); ctx.quadraticCurveTo(fx + 8, 524 - fh * .5, fx + 14, 524); ctx.fillStyle = i & 1 ? '#ffe14d' : '#ff5a2c'; ctx.fill(); } ctx.restore();
      // salami swinging over the chef + a mouse with a pizza slice
      const sw = Math.sin(tt * 1.7) * .09; ctx.save(); ctx.translate(150, 56); ctx.rotate(sw); ctx.strokeStyle = '#e6c58c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 28); ctx.stroke(); rr(-14, 28, 28, 90, 13); ink('#c84a4a', 4); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-7, 40, 5, 66); ctx.strokeStyle = 'rgba(20,16,28,.5)'; ctx.lineWidth = 3; ctx.beginPath(); for (const yy of [50, 72, 94]) { ctx.moveTo(-14, yy); ctx.lineTo(14, yy); } ctx.stroke(); ctx.restore();
      const mx = 700, mlk = [clamp((CX - mx) / 300, -1, 1), clamp((CY - 500) / 200, -1, 1)];
      ctx.beginPath(); ctx.moveTo(mx + 18, 516); ctx.quadraticCurveTo(mx + 54, 520, mx + 46, 486); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#d9a3a3'; ctx.stroke();
      el(mx, 504, 22, 17); ink('#c9bfd1', 3.5); for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(mx + s2 * 12, 484, 10, 0, 7); ink('#c9bfd1', 3.5); ctx.beginPath(); ctx.arc(mx + s2 * 12, 484, 5, 0, 7); ctx.fillStyle = '#ffb3c6'; ctx.fill(); }
      for (const s2 of [-1, 1]) K.eye(mx + s2 * 8, 500, 5, win ? 'bonk' : torn ? 'happy' : 'idle', mlk, tt, s2);
      ctx.fillStyle = '#ff6f91'; ctx.beginPath(); ctx.arc(mx, 509, 3, 0, 7); ctx.fill(); ctx.save(); ctx.translate(mx - 24, 514); ctx.rotate(-.3); ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(14, -2); ctx.lineTo(-12, 8); ctx.closePath(); ink('#ffd23f', 2.5); ctx.beginPath(); ctx.arc(-2, 0, 3, 0, 7); ctx.fillStyle = '#e03a3a'; ctx.fill(); ctx.restore();
      // dough, in flight (progress ring around the pan lights up)
      ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(CX, CY, PR + 12, -Math.PI / 2, -Math.PI / 2 + Math.max(.001, pf) * Math.PI * 2); ctx.stroke(); ctx.strokeStyle = win ? '#5CFF7A' : '#FFE14D'; ctx.lineWidth = 7; ctx.stroke(); ctx.lineCap = 'butt';
      K.shade(CX, CY + r * .94 + 14, r * .9, r * .16, .25);
      const ry = r * (.94 + Math.sin(tt * 6) * .02), half = (sg) => {
        ctx.save(); ctx.translate(0, sg ? sg * (8 + Math.min(1, o * 3) * 46) : 0); if (sg) { ctx.beginPath(); ctx.rect(-r - 20, sg < 0 ? -r - 80 : 0, 2 * r + 40, r + 80); ctx.clip(); }
        ctx.translate(CX, CY); ctx.rotate(ang);
        ctx.beginPath(); ctx.ellipse(0, 0, r + 4, ry + 4, 0, 0, 7); ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#d9a95a'; ctx.fill(); ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r, ry, 0, 0, 7); ctx.clip(); ctx.fillStyle = '#F6D58E'; ctx.beginPath(); ctx.ellipse(-r * .09, -ry * .1, r, ry, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-r * .4, -ry * .5, r * .26, ry * .1, -.5, 0, 7); ctx.fill(); ctx.restore();
        for (const [a, k] of [[0, .5], [1.3, .6], [2.5, .45], [3.7, .62], [4.8, .5], [5.7, .38]]) { ctx.beginPath(); ctx.arc(Math.cos(a) * r * k, Math.sin(a) * r * k, r * .1, 0, 7); ink('#e03a3a', 2.5); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * k - r * .03, Math.sin(a) * r * k - r * .03, r * .03, 0, 7); ctx.fill(); }
        if (crack > .05) { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .5; ctx.moveTo(Math.cos(a) * r * .3, Math.sin(a) * r * .3); ctx.lineTo(Math.cos(a + .2) * r * (.3 + crack * .6), Math.sin(a + .2) * r * (.3 + crack * .6)); } ctx.stroke(); }
        ctx.restore();
      };
      if (torn) { half(-1); half(1); } else half(0);
      for (const f of fl) { ctx.globalAlpha = clamp(f.l * 2, 0, 1); ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); } ctx.globalAlpha = 1;
      // chef Claude
      const cX = 110, m = torn ? 'sad' : win ? 'happy' : crack > .3 ? 'panic' : as > 3 ? 'eager' : 'idle', aw = Math.sin(ang * 2) * (as > 2 ? .3 : .05);
      K.shade(cX, 522, 50, 9, .3);
      K.hero(cX, 520, 8, m, tt, { arms: [-.2 + aw, 1.0 - aw, 1], look: [clamp((CX - cX) / 300, -1, 1), -.2], blush: true }); K.hat('chef', cX, 520 - 72, 8);
      rr(cX - 44, 497, 88, 16, 6); ink('#fff', 3.5); ctx.fillStyle = 'rgba(20,16,28,.16)'; ctx.fillRect(cX - 40, 506, 80, 5);
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cX - 20, 488); ctx.quadraticCurveTo(cX - 9, 480, cX, 489); ctx.quadraticCurveTo(cX + 9, 480, cX + 20, 488); ctx.stroke(); ctx.lineCap = 'butt';
      if (torn) { ctx.fillStyle = '#e03a3a'; for (const [dx, dy, rr2] of [[-30, 452, 6], [-6, 484, 8], [28, 458, 6]]) { ctx.beginPath(); ctx.arc(cX + dx, dy, rr2, 0, 7); ctx.fill(); } }
      K.tag(cX, 410);
      if (crack > .3 && !g.result) K.badge('TOO FAST!', W / 2, 80, 44, '#ff4d6d', '#fff', 1 + Math.sin(tt * 20) * .03, -.04);
      if (torn) K.badge('RIIIP!', W / 2, 80, 52, '#ff4d6d', '#fff', K.outBack(o / .25), -.06);
      if (win && o > .1) K.sparkle(CX, CY, 150, tt, 8);
      vignette(.16);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 11 ── ROLL!: a circus acrobat balances on a ball; keep the ball under him while the crowd gasps */
const ROLL_BG = K.layer(x => {
  x.fillStyle = grad(0, 520, [[0, '#ff6f9a'], [1, '#ffb3c9']]); x.fillRect(-OX, 0, VW, 520);
  x.fillStyle = 'rgba(255,255,255,.2)'; for (let i = -6; i < 24; i += 2) { x.beginPath(); x.moveTo(i * 60 - 160, 0); x.lineTo(i * 60 - 100, 0); x.lineTo(W / 2 + (i - 6) * 10 - 20, 130); x.lineTo(W / 2 + (i - 6) * 10 + 20, 130); x.fill(); }
  // tent peak, bunting
  x.strokeStyle = '#e6c58c'; x.lineWidth = 3; x.beginPath(); x.moveTo(-OX, 66); x.quadraticCurveTo(W / 2, 120, W + OX, 66); x.stroke(); for (let i = 0; i < 16; i++) { const f = i / 15, bx = -OX + f * VW, by = 66 + Math.sin(f * Math.PI) * 27 + 3; x.beginPath(); x.moveTo(bx - 12, by); x.lineTo(bx + 12, by); x.lineTo(bx, by + 24); x.closePath(); ink(['#ffe14d', '#4DB8FF', '#5CFF7A', '#fff'][i & 3], 2.5); }
  // bleachers
  for (let r = 0; r < 3; r++) { const y = 250 + r * 76; x.fillStyle = INK; x.fillRect(-OX, y + 52, VW, 5); x.fillStyle = ['#8a3aa8', '#9b4cc0', '#ad60d2'][r]; x.fillRect(-OX, y + 56, VW, 20); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(-OX, y + 57, VW, 4); }
  // sawdust ring
  x.fillStyle = INK; x.fillRect(-OX, 516, VW, 90); x.fillStyle = '#e8432f'; x.fillRect(-OX, 520, VW, 14); x.fillStyle = '#fff'; for (let c = -OX; c < W + OX; c += 56) x.fillRect(c, 520, 28, 14);
  x.fillStyle = grad(534, 600, [[0, '#f3cc8e'], [1, '#d9a95a']]); x.fillRect(-OX, 534, VW, 70); x.fillStyle = 'rgba(160,100,40,.35)'; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(-OX + hash(i) * VW, 540 + hash(i + 70) * 56, 2.5, 0, 7); x.fill(); }
});
function wiiRoll(sp) {
  const BY = 470, BR = 48; let tx = Math.max(220, Math.min(580, mouse.x)), bx = tx, gx = bx + (Math.random() < .5 ? -1 : 1) * 10, gv = 0, ang = 0; const ph = Math.random() * 6; let t = 0, lw = 0;
  const g = {
    wide: true, cmd: 'ROLL!', hint: 'MOUSE / ← → ROLLS THE BALL UNDER HIM', thint: 'DRAG TO ROLL THE BALL', dur: 5, timeWin: true,
    move(p) { tx = p.x; },
    update(dt) {
      t += dt;
      if (keys.ArrowLeft || keys.KeyA) tx -= 600 * dt; if (keys.ArrowRight || keys.KeyD) tx += 600 * dt;
      tx = Math.max(60 - OX, Math.min(740 + OX, tx));
      const old = bx; bx += Math.max(-520 * dt, Math.min(520 * dt, tx - bx)); ang += (bx - old) / BR;
      if (g.result) return;
      const d = gx - bx; gv += (d * 7 * sp + Math.sin(t * 2.1 + ph) * 45 * sp) * dt; gv *= Math.pow(.5, dt); gx += gv * dt;
      if (Math.abs(d) > 54) { g.result = 'lose'; sfx.thud(); sfx.miss(); shake(9, .3); burst(gx, 440, '#FF4D6D', 14); }
      else if (Math.abs(d) > 40 && t - lw > .35) { lw = t; sfx.blip(-7); }
    },
    draw(tt) {
      const o = oT(), lose = g.result === 'lose', win = g.result === 'win', d = gx - bx, ad = Math.abs(d), gasp = !g.result && ad > 32;
      ROLL_BG();
      // crowd: three rows of round faces, cheering / gasping / hiding eyes
      const HEADS = ['#ffd3a5', '#f0b88c', '#c98a5f', '#ffe0c0'], HATC = ['#ff4d5e', '#4DB8FF', '#5CFF7A', '#ffe14d', '#c77dff'];
      for (let r = 0; r < 3; r++) for (let c = -Math.ceil(OX / 90); c < 10 + Math.ceil(OX / 90); c++) {
        const i = r * 31 + c + 40, hx = c * 90 + 20 + (r & 1) * 44 + (hash(i) - .5) * 14, hy = 258 + r * 76 + 34 - (win ? Math.abs(Math.sin(tt * 8 + i)) * 10 : gasp ? 0 : Math.sin(tt * 2 + i) * 2);
        ctx.beginPath(); ctx.arc(hx, hy, 24, 0, 7); ink(HEADS[(i * 7) % 4 & 3], 3.5); ctx.fillStyle = 'rgba(20,16,28,.14)'; ctx.beginPath(); ctx.arc(hx + 6, hy + 4, 18, -.5, 1.9); ctx.fill();
        const m = lose ? 'panic' : win ? 'happy' : gasp ? 'panic' : 'idle', lkx = clamp((bx - hx) / 300, -1, 1);
        for (const s2 of [-1, 1]) K.eye(hx + s2 * 9, hy - 3, 6, m, [lkx, clamp((BY - hy) / 250, -1, 1)], tt, s2 + i);
        ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); if (m === 'panic') { ctx.ellipse(hx, hy + 12, 5, 7, 0, 0, 7); ctx.fill(); } else if (m === 'happy') { ctx.arc(hx, hy + 8, 8, .2, Math.PI - .2); ctx.stroke(); } else { ctx.arc(hx, hy + 8, 6, .3, Math.PI - .3); ctx.stroke(); } ctx.lineCap = 'butt';
        if (hash(i + 3) > .55) { ctx.beginPath(); ctx.moveTo(hx - 16, hy - 18); ctx.lineTo(hx, hy - 42); ctx.lineTo(hx + 16, hy - 18); ctx.closePath(); ink(HATC[Math.abs(i * 3) % 5], 2.5); } else if (hash(i + 5) > .5) { rr(hx - 26, hy + 14, 24, 20, 3); ink('#fff', 2.5); ctx.fillStyle = '#ff4d5e'; ctx.fillRect(hx - 22, hy + 16, 4, 16); ctx.fillRect(hx - 14, hy + 16, 4, 16); }
      }
      // a small elephant in the front row, popcorn in its trunk
      const ex = 740, ey = 420; el(ex, ey, 44, 38); ink('#b9bfd6', 4); for (const s2 of [-1, 1]) { el(ex + s2 * 36, ey - 6, 22, 30, s2 * .3); ink('#c9cfe4', 3.5); } ctx.beginPath(); ctx.moveTo(ex, ey + 6); ctx.quadraticCurveTo(ex - 12, ey + 52, ex - 40, ey + 40); ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = '#b9bfd6'; ctx.stroke(); ctx.lineCap = 'butt';
      for (const s2 of [-1, 1]) K.eye(ex + s2 * 14, ey - 8, 7, win ? 'happy' : lose || gasp ? 'panic' : 'idle', [clamp((bx - ex) / 300, -1, 1), .3], tt, s2);
      rr(ex - 62, ey + 32, 34, 26, 4); ink('#fff', 3); ctx.fillStyle = '#ff4d5e'; ctx.fillRect(ex - 57, ey + 34, 5, 22); ctx.fillRect(ex - 46, ey + 34, 5, 22); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(ex - 56 + i * 8, ey + 30 - (i & 1) * 4, 5, 0, 7); ink('#fff4c4', 2); }
      // spotlight on the ball
      ctx.fillStyle = 'rgba(255,248,200,.25)'; ctx.beginPath(); ctx.moveTo(bx - 20, 0); ctx.lineTo(bx + 20, 0); ctx.lineTo(bx + 120, 520); ctx.lineTo(bx - 120, 520); ctx.closePath(); ctx.fill();
      K.shade(bx, BY + BR + 6, BR * .95, 9, .28);
      // the striped ball
      ctx.save(); ctx.translate(bx, BY); ctx.rotate(ang); ctx.beginPath(); ctx.arc(0, 0, BR, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.save(); ctx.clip(); ctx.fillStyle = '#FF4D6D'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, BR + 4, i * 1.57, i * 1.57 + .785); ctx.fill(); } ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.beginPath(); ctx.arc(14, 12, BR, 0, 7); ctx.arc(-6, -4, BR, 0, 7, true); ctx.fill('evenodd'); ctx.restore(); K.star(0, 0, 11, 5, 5, 0, '#FFE14D', 2.5); ctx.restore();
      ctx.beginPath(); ctx.arc(bx, BY, BR, 0, 7); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(bx - 18, BY - 22, 9, 15, -.6, 0, 7); ctx.fill();
      // the acrobat
      const fall = lose, tilt = fall ? Math.sign(d) * 1.4 : clamp(d / 70, -.6, .6), fy = BY - BR + 2 + (fall ? Math.min(60, 200 * Math.max(0, ad - 54) / 10) : 0), m = lose ? 'dizzy' : win ? 'happy' : ad > 42 ? 'panic' : ad > 26 ? 'worry' : 'smug';
      ctx.save(); ctx.translate(gx, fy); ctx.rotate(tilt); const bal = Math.sin(tt * 6) * (ad / 40);
      K.hero(0, 0, 7, m, tt, { arms: win ? [-2.7, 2.7, 1] : [-1.35 + bal * .4 - d / 80, 1.35 + bal * .4 - d / 80, 1], look: [clamp(-d / 40, -1, 1), .3] }); K.hat('party', 0, -63, 7, '#4DB8FF', '#FFE14D');
      if (fall) for (let i = 0; i < 3; i++) { const a = tt * 5 + i * 2.1; K.star(Math.cos(a) * 36, -80 + Math.sin(a) * 8, 8, 3.5, 5, tt * 4, '#FFE14D', 2.5); }
      ctx.restore();
      // floor marks: gold = where the ball is, green flag = where he stands
      rr(bx - 40, 538, 80, 10, 5); ink('#FFE14D', 3); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(gx, 550); ctx.lineTo(gx, 524); ctx.stroke(); ctx.beginPath(); ctx.moveTo(gx, 524); ctx.lineTo(gx + 16, 530); ctx.lineTo(gx, 536); ctx.closePath(); ink('#5CFF7A', 3);
      if (win && o > .1) { for (let i = 0; i < 6; i++) K.heart(60 + i * 140 + (i & 1) * 20, 330 - ((o * 80 + i * 17) % 70), .8, 1 - o * .6); K.sparkle(gx, 330, 70, tt, 6); }
      vignette(.18);
    }
  };
  const oT = K.outro(g);
  return g;
}

/* 12 ── CLOSE IT!: pull the shutter of a night shop down before a customer with a never-ending shopping list gets in */
const CLS_BG = K.layer(x => {
  x.fillStyle = grad(0, 500, [[0, '#5b4aa8'], [.6, '#e9789a'], [1, '#ffc79a']]); x.fillRect(-OX, 0, VW, 502);
  x.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 24; i++) { x.beginPath(); x.arc(-OX + hash(i) * VW, 8 + hash(i + 30) * 100, 1.4 + hash(i + 7) * 1.4, 0, 7); x.fill(); }
  x.beginPath(); x.arc(W + OX - 120, 120, 30, 0, 7); ink('#fff3b0', 3.5); x.fillStyle = '#e8d890'; for (const [mx2, my2, r] of [[W + OX - 128, 114, 6], [W + OX - 110, 130, 4]]) { x.beginPath(); x.arc(mx2, my2, r, 0, 7); x.fill(); }
  // far city skyline (coloured outline)
  for (const [bx, bw, bh] of [[-OX + 10, 80, 150], [-OX + 100, 70, 220], [W + OX - 160, 90, 190], [W + OX - 60, 70, 140], [W + OX - 230, 60, 120]]) { rr(bx, 500 - bh, bw, bh, 4); x.lineWidth = 4; x.strokeStyle = '#4a3a8a'; x.stroke(); x.fillStyle = '#6a54b0'; x.fill(); x.fillStyle = '#ffd86b'; for (let wy = 500 - bh + 16; wy < 480; wy += 28) for (let wx = bx + 10; wx < bx + bw - 12; wx += 22) if (hash(wx * 3 + wy) > .5) x.fillRect(wx, wy, 10, 12); }
  // street
  x.fillStyle = INK; x.fillRect(-OX, 498, VW, 4); x.fillStyle = grad(502, 600, [[0, '#b9bfcc'], [1, '#8f96a8']]); x.fillRect(-OX, 502, VW, 100); x.fillStyle = '#e6eaf2'; x.fillRect(-OX, 504, VW, 8);
  x.strokeStyle = 'rgba(70,76,100,.25)'; x.lineWidth = 3; x.beginPath(); for (let c = -OX - 20; c < W + OX; c += 110) { x.moveTo(c, 514); x.lineTo(c - 26, 600); } x.stroke();
  // the shop: cream walls, red-white awning, a lit interior
  rr(180, 70, 440, 430, 8); ink('#FFD6A5', 6); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(190, 150, 14, 340); x.fillStyle = 'rgba(20,16,28,.1)'; x.fillRect(596, 150, 20, 340);
  rr(210, 150, 380, 330, 6); ink('#3a2a4a', 4); x.fillStyle = grad(150, 480, [[0, '#6b4a86'], [1, '#4a3366']]); x.fillRect(210, 150, 380, 330);
  for (const sy of [230, 320]) { x.fillStyle = INK; x.fillRect(214, sy, 372, 6); x.fillStyle = '#d9944f'; x.fillRect(214, sy - 2, 372, 5); for (let i = 0; i < 9; i++) { const c = ['#ff4d5e', '#ffe14d', '#4DB8FF', '#5CFF7A', '#c77dff'][i % 5]; rr(222 + i * 41, sy - 34, 28, 32, 5); ink(c, 3); x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(228 + i * 41, sy - 28, 5, 20); } }
  rr(240, 396, 140, 74, 6); ink('#a8703a', 4); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(244, 400, 132, 6);
  rr(470, 366, 90, 104, 6); ink('#7f8aa0', 4); x.beginPath(); x.arc(515, 410, 28, 0, 7); ink('#FFE14D', 3.5); x.fillStyle = INK; x.font = '900 34px "Arial Black", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 515, 412);
  rr(180, 70, 440, 70, 6); ink('#FF4D6D', 6); for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(184 + i * 55, 74); x.lineTo(184 + i * 55 + 27, 74); x.lineTo(184 + i * 55 + 27, 130); x.quadraticCurveTo(184 + i * 55 + 13, 144, 184 + i * 55, 130); x.closePath(); x.fillStyle = '#fff'; x.fill(); } x.fillStyle = 'rgba(20,16,28,.2)'; x.fillRect(184, 134, 432, 5);
  // lamp post (left)
  const lx = 112; x.strokeStyle = INK; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(lx, 500); x.lineTo(lx, 200); x.stroke(); x.strokeStyle = '#6b7488'; x.lineWidth = 6; x.stroke(); rr(lx - 20, 170, 40, 36, 8); ink('#ffe9a0', 4); x.fillStyle = 'rgba(255,240,170,.25)'; x.beginPath(); x.arc(lx, 190, 70, 0, 7); x.fill();
});
function wiiClose(sp) {
  const SY0 = 150, SY1 = 466, DX = 300; let sy = SY0, grab = false, g0 = 0, s0 = 0, cx = -40 - OX, t = 0, bump = 0, lw = 0;
  const v = 175 * Math.sqrt(sp) * (DX + 40 + OX) / (DX + 40);
  const g = {
    wide: true, cmd: 'CLOSE IT!', hint: 'DRAG THE SHUTTER DOWN FAST', thint: 'PULL DOWN FAST', dur: 5,
    down(p) { if (g.result) return; grab = true; g0 = p.y; s0 = sy; sfx.click(); },
    move(p) { if (grab && !g.result) { sy = Math.max(SY0, Math.min(SY1, s0 + p.y - g0)); } },
    up() { grab = false; },
    update(dt) {
      t += dt; if (g.result) { bump += dt; return; }
      if (keys.ArrowDown || keys.KeyS || keys.Space) sy = Math.min(SY1, sy + 700 * dt);
      else if (!grab && sy < SY1) sy = Math.max(SY0, sy - 40 * dt);
      if (sy >= SY1 - 2) { sy = SY1; g.result = 'win'; sfx.stamp(); sfx.thud(); shake(12, .3); burst(400, SY1, '#fff', 16, 300); ring(400, SY1, '#FFE14D', 150, .4); floatText('CLOSED!', 400, 120, '#FFE14D', 40); return; }
      if (t > .3) { cx += v * dt; if (t - lw > .28) { lw = t; sfx.tick(); } }
      if (cx >= DX) { g.result = 'lose'; sfx.miss(); wiiBang(DX, 480); }
    },
    draw(tt) {
      const o = oT(), closed = g.result === 'win', lose = g.result === 'lose', close = !g.result && cx > DX - 160;
      CLS_BG();
      // moth around the lamp
      ctx.save(); ctx.translate(112 + Math.cos(tt * 4) * 30, 190 + Math.sin(tt * 5.3) * 18); ctx.beginPath(); ctx.ellipse(-5, 0, 5, 3, -.4, 0, 7); ctx.ellipse(5, 0, 5, 3, .4, 0, 7); ink('#fff', 1.5); ctx.restore();
      // sleepy owner behind the counter
      if (sy < 400 || lose) { ctx.save(); ctx.beginPath(); ctx.rect(210, 150, 380, 330); ctx.clip(); const om = lose ? 'panic' : close ? 'panic' : 'sleep'; K.hero(310, 438, 4.2, om, tt, { col: '#ffc93c', arms: [-2.6 * (lose || close ? 1 : 0), 2.6 * (lose || close ? 1 : 0), 1] }); K.hat('chef', 310, 438 - 38, 4.2); if (om === 'sleep') { K.zee(352, 380 - ((tt * 20) % 20), 1, 1 - ((tt * 20) % 20) / 24); } ctx.restore(); }
      // flying goods on a lose
      if (lose) for (let i = 0; i < 5; i++) { const k = Math.min(1, o * 1.2), fx = 330 + i * 54 + (i - 2) * k * 60, fy = 330 - Math.sin(k * 3.14) * 90 + k * k * 160; ctx.save(); ctx.translate(fx, fy); ctx.rotate(o * 8 + i); rr(-12, -14, 24, 28, 5); ink(['#ff4d5e', '#ffe14d', '#4DB8FF', '#5CFF7A', '#c77dff'][i], 3); ctx.restore(); }
      // shutter: metal slats, rails and a handle
      ctx.fillStyle = INK; ctx.fillRect(206, SY0 - 4, 388, sy - SY0 + 8);
      for (let y = SY0; y < sy; y += 22) { const i2 = ((y - SY0) / 22) | 0, hh = Math.min(20, sy - y); ctx.fillStyle = i2 % 2 ? '#aab4c4' : '#c3cbd8'; ctx.fillRect(210, y, 380, hh); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(210, y, 380, Math.min(4, hh)); ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.fillRect(210, y + Math.min(16, hh), 380, Math.max(0, hh - 16)); }
      if (sy > SY0 + 30) { ctx.fillStyle = 'rgba(20,16,28,.35)'; for (const rx of [226, 574]) ctx.fillRect(rx - 2, SY0, 4, sy - SY0); }
      rr(330, sy - 6, 140, 18, 8); ink('#7a8497', 4); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(340, sy - 2, 100, 3);
      // the sign hangs from the awning
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(375, 140); ctx.lineTo(375, 160); ctx.moveTo(425, 140); ctx.lineTo(425, 160); ctx.stroke(); rr(350, 160, 100, 32, 8); ink(closed ? '#FF4D6D' : '#5CFF7A', 4); ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(356, 164, 88, 6, 3); ctx.fill(); txt(closed ? 'CLOSED' : 'OPEN', 400, 178, 20, '#fff');
      // customer with a shopping list longer than the street
      const x = lose ? DX + 20 + Math.min(1, bump * 3) * 110 : cx, bounce = closed ? Math.min(1, bump * 6) * -30 : 0, px = Math.min(x, closed ? DX : x) + bounce;
      ctx.beginPath(); ctx.moveTo(px - 24, 458); for (let i = 1; i <= 12; i++) ctx.lineTo(px - 24 - i * 22, 458 + Math.sin(tt * 9 + i * .9) * 12 * (lose || closed ? .2 : 1) - i * 1.5); ctx.lineWidth = 16; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 9; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.setLineDash([3, 14]); ctx.strokeStyle = '#4DB8FF'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
      K.shade(px, 504, 34, 7, .3);
      const cm = lose ? 'happy' : closed ? 'bonk' : close ? 'eager' : 'eager';
      K.hero(px, 500, 6, cm, tt, { col: '#4DB8FF', run: lose || closed ? null : tt, arms: lose ? [-2.6, 2.6, 1] : [.2, .35, 1], look: [1, 0] }); K.hat('bowler', px, 500 - 54, 6, '#2b4a8a', '#fff');
      if (closed && bump < .8) for (let i = 0; i < 3; i++) { const a = tt * 6 + i * 2.1; K.star(px + Math.cos(a) * 36, 430 + Math.sin(a) * 8, 9, 4, 5, tt * 4, '#FFE14D', 2.5); }
      if (!closed && !lose && cx > DX - 160) K.badge('!', cx, 392, 34, '#FFE14D', '#ff4d6d', 1 + Math.sin(tt * 25) * .06, 0);
      if (closed) K.badge('PHEW!', W / 2, 42, 38, '#4DB8FF', '#fff', K.outBack(o / .25), -.05);
      vignette(.16);
    }
  };
  const oT = K.outro(g);
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
})();
